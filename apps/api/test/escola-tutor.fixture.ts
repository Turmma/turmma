import type { ConteudoDeAtividade } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { EscolaComAssistente } from './escola-assistente.fixture.js'
import type { BancadaDeSessoes } from './sessao.fixture.js'

/**
 * O que os testes do Tutor (MVP, A4) precisam e que ainda não tem rota neste pacote: a atividade aplicada à turma, o
 * lote de correção em cada estado e as trocas já feitas, gravados direto no banco, com dado sintético; e o **modelo de
 * mentira**, um servidor OpenAI-compatível nesta máquina que responde o que o teste mandar e guarda o que recebeu.
 */

export const HABILIDADE_MASSA_MOLAR = { codigo: 'QUI.EM.05', descricao: 'Calcular a massa molar de uma substância' }
export const HABILIDADE_PROPORCAO = { codigo: 'QUI.EM.06', descricao: 'Aplicar a proporção em mols da equação balanceada' }
export const HABILIDADE_LIMITANTE = { codigo: 'QUI.EM.07', descricao: 'Identificar o reagente limitante de uma reação' }

/** A alternativa correta da questão 3, por extenso: é o que o Tutor nunca pode repetir ao aluno. */
export const ALTERNATIVA_CERTA_DA_QUESTAO_3 = 'O reagente que acaba primeiro e determina quanto produto se forma'
/** Uma palavra que só existe na explicação da questão 3: se chegar ao modelo, a explicação foi junto. */
export const MARCA_NA_EXPLICACAO = 'explicacao-sintetica-zurpa'

/** Uma atividade objetiva de três questões sobre o material de demonstração. A questão 3 é a do reagente limitante (página 4). */
export function conteudoDaAtividade(materialId: string, titulo: string): ConteudoDeAtividade {
  const citacao = (pagina: number) => ({ materialId, pagina, trecho: `Página ${String(pagina)} do material` })
  return {
    tipo: 'atividade_objetiva',
    titulo,
    questoes: [
      { enunciado: 'Qual é a massa molar da água, H2O?', alternativas: ['16 g/mol', '18 g/mol', '20 g/mol', '34 g/mol'], gabarito: 1, habilidade: HABILIDADE_MASSA_MOLAR, citacao: citacao(2), explicacao: 'Dois hidrogênios e um oxigênio somam 18.' },
      { enunciado: 'Na reação N2 + 3 H2 -> 2 NH3, quantos mols de amônia se formam a partir de 6 mol de H2?', alternativas: ['2 mol', '3 mol', '4 mol', '6 mol'], gabarito: 2, habilidade: HABILIDADE_PROPORCAO, citacao: citacao(3), explicacao: 'A proporção é de 3 para 2.' },
      {
        enunciado: 'Em uma reação química, o que é o reagente limitante?',
        alternativas: [ALTERNATIVA_CERTA_DA_QUESTAO_3, 'O reagente que sobra quando a reação termina', 'O produto obtido em maior quantidade', 'O reagente de maior massa molar'],
        gabarito: 0,
        habilidade: HABILIDADE_LIMITANTE,
        citacao: citacao(4),
        explicacao: `É a definição da página 4 (${MARCA_NA_EXPLICACAO}).`,
      },
    ],
  }
}

export interface OpcoesDaAplicacao {
  readonly avaliativa?: boolean
  readonly turmaId?: string
  readonly disciplinaId?: string
  readonly titulo?: string
  /** Quem aplica: precisa ser da equipe da escola (gatilho de autor). O padrão é a professora de Química do 2ºB. */
  readonly aplicadaPor?: string
}

/** Grava o artefato e a atividade aplicada à turma, como o pacote de atividade fará pela rota. Devolve o id da aplicação. */
export async function aplicarAtividade(bancada: BancadaDeSessoes, escola: EscolaComAssistente, opcoes: OpcoesDaAplicacao = {}): Promise<string> {
  const { avaliativa = false, turmaId = escola.turma, disciplinaId = escola.quimica, titulo = 'Lista sintética de estequiometria', aplicadaPor = escola.professora.usuarioId } = opcoes
  const { rows: artefatos } = await bancada.pool.query<{ id: string }>(
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6, $7) returning id`,
    [escola.escolaId, escola.anoLetivoId, turmaId, disciplinaId, titulo, JSON.stringify(conteudoDaAtividade(escola.materialId, titulo)), aplicadaPor],
  )
  const { rows } = await bancada.pool.query<{ id: string }>(
    'insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, $5, $6) returning id',
    [escola.escolaId, escola.anoLetivoId, turmaId, artefatos[0]?.id, avaliativa, aplicadaPor],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('atividade de teste não aplicada')
  return id
}

export async function encerrarAtividade(bancada: BancadaDeSessoes, escola: EscolaComAssistente, atividadeAplicadaId: string): Promise<void> {
  await bancada.pool.query(`update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where escola_id = $1 and id = $2`, [escola.escolaId, atividadeAplicadaId])
}

export interface CorrecaoDeTeste {
  readonly alunoId: string
  readonly acertos: number
  readonly total: number
  readonly porHabilidade: readonly { codigo: string; acertos: number; total: number }[]
}

const RESUMO_SINTETICO = { alunos: 1, enviadas: 1 }

/**
 * A tentativa enviada do aluno e o lote de correção da aplicação, no estado pedido. `aprovada` grava a validação e a
 * aprovação na mesma transação, como o banco exige (D56); `rejeitada`, com a justificativa.
 */
export async function lancarLote(bancada: BancadaDeSessoes, escola: EscolaComAssistente, atividadeAplicadaId: string, estado: 'pendente' | 'aprovada' | 'rejeitada', correcao: CorrecaoDeTeste, turmaId: string = escola.turma): Promise<string> {
  const { escolaId, anoLetivoId } = escola
  const professorId = escola.professora.usuarioId
  const cliente = await bancada.pool.connect()
  try {
    await cliente.query('begin')
    await cliente.query(
      `insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, enviada_em) values ($1, $2, $3, $4, now()) on conflict on constraint tentativa_atividade_uma_por_aluno do nothing`,
      [escolaId, anoLetivoId, atividadeAplicadaId, correcao.alunoId],
    )
    const { rows } = await cliente.query<{ id: string }>(
      `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id) values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4) returning id`,
      [escolaId, anoLetivoId, turmaId, atividadeAplicadaId],
    )
    const entregaId = rows[0]?.id
    if (entregaId === undefined) throw new Error('lote de teste não gravado')
    await cliente.query(
      `insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade) values ($1, $2, $3, $4, $5, $6, $7, 0, $8)`,
      [escolaId, anoLetivoId, entregaId, atividadeAplicadaId, correcao.alunoId, correcao.acertos, correcao.total, JSON.stringify(correcao.porHabilidade)],
    )
    if (estado === 'aprovada') {
      await cliente.query(
        'insert into validacao_do_lote (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, apresentado, aberto, confirmada_por) values ($1, $2, $3, $4, $5, $6, $7)',
        [escolaId, anoLetivoId, entregaId, atividadeAplicadaId, JSON.stringify({ resumo: RESUMO_SINTETICO, destaques: [] }), '[]', professorId],
      )
      await cliente.query(`update entrega set estado = 'aprovada', decidida_por = $3, decidida_em = now() where escola_id = $1 and id = $2`, [escolaId, entregaId, professorId])
    }
    if (estado === 'rejeitada') {
      await cliente.query(`update entrega set estado = 'rejeitada', decidida_por = $3, decidida_em = now(), justificativa = 'Gabarito da questão 2 trocado' where escola_id = $1 and id = $2`, [escolaId, entregaId, professorId])
    }
    await cliente.query('commit')
    return entregaId
  } catch (erro) {
    await cliente.query('rollback')
    throw erro
  } finally {
    cliente.release()
  }
}

/**
 * Trocas já feitas pelo aluno com o Tutor, gravadas direto: a execução concluída, a pergunta e a resposta. Serve ao
 * teste do freio, que precisa de sessenta trocas sem mandar sessenta pedidos. `haDias` as põe no passado.
 */
export async function trocasJaFeitas(bancada: BancadaDeSessoes, escola: EscolaComAssistente, alunoId: string, quantidade: number, { turmaId = escola.turma, haDias = 0 }: { turmaId?: string; haDias?: number } = {}): Promise<void> {
  for (let indice = 0; indice < quantidade; indice += 1) {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, estado, entrada, iniciada_em)
       values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, $4, 'rodando', '{"tarefa":"turno_do_tutor"}', now()) returning id`,
      [escola.escolaId, escola.anoLetivoId, alunoId, randomUUID()],
    )
    const execucaoId = rows[0]?.id
    const quando = `now() - make_interval(days => ${String(haDias)})`
    await bancada.pool.query(
      `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, criada_em) values ($1, $2, $3, $4, $5, 'aluno', 'Pergunta sintética já feita', ${quando})`,
      [escola.escolaId, escola.anoLetivoId, turmaId, alunoId, execucaoId],
    )
    const { rows: respostas } = await bancada.pool.query<{ id: string }>(
      `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto, citacoes, criada_em) values ($1, $2, $3, $4, $5, 'tutor', 'O que a questão pede?', '[]', ${quando}) returning id`,
      [escola.escolaId, escola.anoLetivoId, turmaId, alunoId, execucaoId],
    )
    await bancada.pool.query(`update execucao_agente set estado = 'concluida', resultado = $3, concluida_em = now() where escola_id = $1 and id = $2`, [
      escola.escolaId,
      execucaoId,
      JSON.stringify({ tipo: 'mensagem_do_tutor', mensagemId: respostas[0]?.id }),
    ])
  }
}

/** Os limites do Tutor da escola (`configuracao_operacional_escola`); `null` volta ao padrão do contrato. */
export async function configurarLimitesDoTutor(bancada: BancadaDeSessoes, escolaId: string, limites: { porDia?: number | null; porMes?: number | null }): Promise<void> {
  await bancada.pool.query(
    `insert into configuracao_operacional_escola (escola_id, tutor_trocas_por_dia, tutor_trocas_por_mes) values ($1, $2, $3)
     on conflict (escola_id) do update set tutor_trocas_por_dia = excluded.tutor_trocas_por_dia, tutor_trocas_por_mes = excluded.tutor_trocas_por_mes`,
    [escolaId, limites.porDia ?? null, limites.porMes ?? null],
  )
}

/** Uma citação tirada do primeiro trecho que o pedido levou ao modelo: é o que um modelo obediente citaria. */
export function citacaoDoPrimeiroTrecho(pedido: string): { materialId: string; pagina: number; trecho: string }[] {
  const achado = /tipo=\\?"trecho_do_material\\?" materialId=\\?"([0-9a-f-]{36})\\?" pagina=\\?"(\d+)\\?"/.exec(pedido)
  return achado?.[1] === undefined ? [] : [{ materialId: achado[1], pagina: Number(achado[2]), trecho: `Página ${String(achado[2])} do material` }]
}

export interface ModeloDeMentira {
  /** O endereço para `LLM_BASE_URL`. */
  readonly url: string
  /** O corpo de cada pedido que chegou, como veio: é exatamente o que sairia do sistema para o provedor. */
  readonly pedidos: string[]
  /** O que o modelo responde a partir de agora: recebe o corpo do pedido e o número da chamada (a partir de 1), e devolve o texto. */
  responder(resposta: (pedido: string, chamada: number) => string): void
  /** O modelo passa a responder com erro HTTP, como o provedor fora do ar. */
  cair(status: number): void
  fechar(): Promise<void>
}

/**
 * Um servidor OpenAI-compatível nesta máquina (`/chat/completions`), que responde o que o teste mandar: é o modelo que
 * tenta entregar a resposta, confirmar o palpite ou se passar por pessoa. Entra pela mesma porta que o modelo de
 * verdade (`IA_ADAPTADOR=openai_compat`), então a rota, o provedor, a conferência da tarefa e o adaptador rodam como
 * em produção, e `pedidos` guarda o que chegaria ao provedor.
 */
export async function subirModeloDeMentira(): Promise<ModeloDeMentira> {
  const pedidos: string[] = []
  let resposta: (pedido: string, chamada: number) => string = () => '{}'
  let caido: number | undefined
  let chamadas = 0
  const servidor: Server = createServer((requisicao, saida) => {
    const partes: Buffer[] = []
    requisicao.on('data', (parte: Buffer) => partes.push(parte))
    requisicao.on('end', () => {
      const pedido = Buffer.concat(partes).toString('utf8')
      pedidos.push(pedido)
      chamadas += 1
      if (caido !== undefined) {
        saida.writeHead(caido, { 'content-type': 'application/json' }).end('{"error":"fora do ar"}')
        return
      }
      const corpo = JSON.stringify({ model: 'modelo-de-mentira', choices: [{ message: { content: resposta(pedido, chamadas) } }], usage: { prompt_tokens: 100, completion_tokens: 20 } })
      saida.writeHead(200, { 'content-type': 'application/json' }).end(corpo)
    })
  })
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto))
  return {
    url: `http://127.0.0.1:${String((servidor.address() as AddressInfo).port)}/v1`,
    pedidos,
    responder(nova) {
      resposta = nova
      caido = undefined
      chamadas = 0
      pedidos.length = 0
    },
    cair(status) {
      caido = status
      chamadas = 0
      pedidos.length = 0
    },
    fechar: () => new Promise<void>((fechado) => servidor.close(() => fechado())),
  }
}

/** As variáveis que apontam a API de teste para o modelo de mentira, como modelo local (o endereço é desta máquina). */
export function ambienteDoModeloDeMentira(modelo: ModeloDeMentira): Record<string, string> {
  return { IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: modelo.url, LLM_MODELO: 'modelo-de-mentira', LLM_PROCESSAMENTO_LOCAL: 'true', LLM_RECUO_MS: '0', LLM_TIMEOUT_MS: '5000', LLM_TIMEOUT_MS_RAPIDO: '5000', LLM_TIMEOUT_MS_PADRAO: '5000', IA_EXECUCAO_TIMEOUT_MS: '20000' }
}
