import { conteudoDeAtividadeSchema, type ConteudoDeAtividade } from '@educa/shared'
import { chamar, type ApiDeTeste, type RespostaHttp } from './test-api.js'
import type { EscolaComAssistente } from './escola-assistente.fixture.js'
import type { BancadaDeSessoes, SessaoDeTeste } from './sessao.fixture.js'

/**
 * A bancada da atividade aplicada e da correção (MVP, A3). O artefato é gravado direto, com gabarito e habilidades que
 * o teste conhece: a correção é uma conta, e o teste precisa saber o resultado certo de antemão. Tudo sintético.
 */

/** O gabarito da atividade de teste, pelo índice da alternativa: questão 1 → A, 2 → B, 3 → C, 4 → D, 5 → A. */
export const GABARITO_DE_TESTE = [0, 1, 2, 3, 0] as const
export const HABILIDADE_DAS_TRES_PRIMEIRAS = { codigo: 'QUI.EM.05', descricao: 'Calcular a massa de reagentes e produtos numa reação' }
export const HABILIDADE_DAS_DUAS_ULTIMAS = { codigo: 'QUI.EM.06', descricao: 'Identificar o reagente limitante' }
/** O texto que nunca pode chegar ao aluno antes da aprovação. */
export const EXPLICACAO_DE_TESTE = 'Explicação sintética do gabarito que só aparece depois da aprovação'

/** Uma atividade objetiva com o gabarito dado (o de teste, se nada for dito): três questões de uma habilidade e o resto de outra. */
export function conteudoDeTeste(materialId: string, titulo = 'Estequiometria: lista sintética', gabarito: readonly number[] = GABARITO_DE_TESTE): ConteudoDeAtividade {
  return conteudoDeAtividadeSchema.parse({
    tipo: 'atividade_objetiva',
    titulo,
    questoes: gabarito.map((correta, indice) => ({
      enunciado: `Enunciado sintético da questão ${String(indice + 1)}`,
      alternativas: ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'],
      gabarito: correta,
      habilidade: indice < 3 ? HABILIDADE_DAS_TRES_PRIMEIRAS : HABILIDADE_DAS_DUAS_ULTIMAS,
      citacao: { materialId, pagina: indice + 1, trecho: 'Trecho sintético do material' },
      explicacao: `${EXPLICACAO_DE_TESTE} (questão ${String(indice + 1)})`,
    })),
  })
}

export interface OpcoesDoArtefatoDeTeste {
  readonly turmaId?: string
  readonly disciplinaId?: string
  readonly conteudo?: ConteudoDeAtividade
  readonly anoLetivoId?: string
}

/** Um artefato de atividade objetiva da professora, gravado direto na turma e na disciplina dadas (o 2ºB e Química, se nada for dito). */
export async function criarAtividade(bancada: BancadaDeSessoes, escola: EscolaComAssistente, opcoes: OpcoesDoArtefatoDeTeste = {}): Promise<string> {
  const conteudo = opcoes.conteudo ?? conteudoDeTeste(escola.materialId)
  const { rows } = await bancada.pool.query<{ id: string }>(
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6, $7) returning id`,
    [escola.escolaId, opcoes.anoLetivoId ?? escola.anoLetivoId, opcoes.turmaId ?? escola.turma, opcoes.disciplinaId ?? escola.quimica, conteudo.titulo, JSON.stringify(conteudo), escola.professora.usuarioId],
  )
  const [criado] = rows
  if (criado === undefined) throw new Error('artefato de teste não criado')
  return criado.id
}

/** Um plano de aula da professora no 2ºB, gravado direto: o artefato que não se aplica. */
export async function criarPlanoDeAula(bancada: BancadaDeSessoes, escola: EscolaComAssistente): Promise<string> {
  const conteudo = {
    tipo: 'plano_de_aula',
    titulo: 'Plano sintético',
    objetivos: ['Objetivo sintético'],
    habilidades: [HABILIDADE_DAS_TRES_PRIMEIRAS],
    duracaoMinutos: 50,
    etapas: [{ titulo: 'Etapa', minutos: 50, descricao: 'Descrição sintética' }],
    avaliacao: 'Avaliação sintética',
    citacoes: [{ materialId: escola.materialId, pagina: 1, trecho: 'Trecho sintético' }],
  }
  const { rows } = await bancada.pool.query<{ id: string }>(
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'plano_de_aula', $5, $6, $7) returning id`,
    [escola.escolaId, escola.anoLetivoId, escola.turma, escola.quimica, conteudo.titulo, JSON.stringify(conteudo), escola.professora.usuarioId],
  )
  const [criado] = rows
  if (criado === undefined) throw new Error('plano de teste não criado')
  return criado.id
}

/** A versão adaptada de uma atividade do 2ºB, com a entrega dela no estado pedido, gravadas direto. */
export async function criarVersaoAdaptada(bancada: BancadaDeSessoes, escola: EscolaComAssistente, origemId: string, estado: 'pendente' | 'aprovada' | 'rejeitada'): Promise<string> {
  const conteudo = { ...conteudoDeTeste(escola.materialId, 'Estequiometria: versão adaptada sintética'), adaptacao: { tipos: ['fonte_ampliada'] } }
  const { rows } = await bancada.pool.query<{ id: string }>(
    `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6, $7, $8) returning id`,
    [escola.escolaId, escola.anoLetivoId, escola.turma, escola.quimica, conteudo.titulo, JSON.stringify(conteudo), origemId, escola.professora.usuarioId],
  )
  const [criado] = rows
  if (criado === undefined) throw new Error('versão adaptada de teste não criada')
  await bancada.pool.query(
    `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id, estado, decidida_por, decidida_em, justificativa)
     values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4, $5, case when $5 <> 'pendente' then $6::uuid end, case when $5 <> 'pendente' then now() end, case when $5 = 'rejeitada' then 'Justificativa sintética da rejeição' end)`,
    [escola.escolaId, escola.anoLetivoId, escola.turma, criado.id, estado, escola.professora.usuarioId],
  )
  return criado.id
}

/** Alunos sintéticos com sessão e vínculo `confirmado` na turma, cada um com o nome dado. Voltam na ordem dos nomes. */
export async function alunosComSessao(bancada: BancadaDeSessoes, escola: EscolaComAssistente, turmaId: string, nomes: readonly string[]): Promise<SessaoDeTeste[]> {
  const alunos = await bancada.sessoes(escola.escolaId, { papel: 'aluno', quantidade: nomes.length })
  for (const [posicao, aluno] of alunos.entries()) {
    await bancada.pool.query('update usuario set nome = $1 where id = $2', [nomes[posicao], aluno.usuarioId])
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
      [escola.escolaId, escola.anoLetivoId, aluno.usuarioId, turmaId, escola.coordenacao.usuarioId],
    )
  }
  return alunos
}

/** As chamadas da atividade, como a tela as faz, cada uma com um token novo da sessão. */
export function rotasDaAtividade(api: ApiDeTeste) {
  const pedir = async (sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, metodo, caminho, await sessao.tokenNovo(), corpo)
  return {
    pedir,
    aplicar: (sessao: SessaoDeTeste, corpo: unknown) => pedir(sessao, 'POST', '/v1/atividades-aplicadas', corpo),
    listar: (sessao: SessaoDeTeste, consulta: string) => pedir(sessao, 'GET', `/v1/atividades-aplicadas${consulta}`),
    encerrar: (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'POST', `/v1/atividades-aplicadas/${id}/encerrar`, {}),
    minhas: (sessao: SessaoDeTeste, consulta = '') => pedir(sessao, 'GET', `/v1/minhas-atividades${consulta}`),
    prova: (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'GET', `/v1/atividades-aplicadas/${id}/prova`),
    responder: (sessao: SessaoDeTeste, id: string, questao: number | string, alternativa: number) => pedir(sessao, 'PUT', `/v1/atividades-aplicadas/${id}/respostas/${String(questao)}`, { alternativa }),
    enviar: (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'POST', `/v1/atividades-aplicadas/${id}/enviar`, {}),
    diagnostico: (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'GET', `/v1/atividades-aplicadas/${id}/meu-diagnostico`),
    correcao: (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'GET', `/v1/atividades-aplicadas/${id}/correcao`),
    abrirDestaque: (sessao: SessaoDeTeste, id: string, alunoId: string) => pedir(sessao, 'POST', `/v1/atividades-aplicadas/${id}/correcao/destaques/${alunoId}/abrir`, {}),
    aprovarLote: (sessao: SessaoDeTeste, entregaId: string, corpo: unknown = {}) => pedir(sessao, 'POST', `/v1/entregas/${entregaId}/aprovar-lote`, corpo),
    rejeitar: (sessao: SessaoDeTeste, entregaId: string) => pedir(sessao, 'POST', `/v1/entregas/${entregaId}/decidir`, { decisao: 'rejeitar', justificativa: 'Justificativa sintética da rejeição' }),
    desempenho: (sessao: SessaoDeTeste, turmaId: string, consulta = '') => pedir(sessao, 'GET', `/v1/turmas/${turmaId}/desempenho${consulta}`),
  }
}
export type RotasDaAtividade = ReturnType<typeof rotasDaAtividade>

/** Aplica a atividade pela rota e devolve o id da aplicação. */
export async function aplicarAtividade(rotas: RotasDaAtividade, sessao: SessaoDeTeste, artefatoId: string, turmaId: string, avaliativa = false): Promise<string> {
  const resposta = await rotas.aplicar(sessao, { artefatoId, turmaId, avaliativa })
  if (resposta.status !== 201) throw new Error(`atividade não aplicada: ${String(resposta.status)} ${resposta.corpo.erro?.codigo ?? ''}`)
  return resposta.corpo['id'] as string
}

/** O aluno abre a prova e marca as alternativas dadas, na ordem das questões (`null` deixa em branco), pela rota. */
export async function responderProva(rotas: RotasDaAtividade, aluno: SessaoDeTeste, atividadeAplicadaId: string, marcadas: readonly (number | null)[], enviar = true): Promise<void> {
  const prova = await rotas.prova(aluno, atividadeAplicadaId)
  if (prova.status !== 200) throw new Error(`prova não aberta: ${String(prova.status)}`)
  for (const [indice, alternativa] of marcadas.entries()) {
    if (alternativa === null) continue
    const salva = await rotas.responder(aluno, atividadeAplicadaId, indice + 1, alternativa)
    if (salva.status !== 200) throw new Error(`resposta não salva: ${String(salva.status)} ${salva.corpo.erro?.codigo ?? ''}`)
  }
  if (enviar) {
    const enviada = await rotas.enviar(aluno, atividadeAplicadaId)
    if (enviada.status !== 200) throw new Error(`atividade não enviada: ${String(enviada.status)}`)
  }
}

/** Encerra pela rota e devolve o id da entrega do lote (nulo quando a correção não rodou). */
export async function encerrarAtividade(rotas: RotasDaAtividade, sessao: SessaoDeTeste, atividadeAplicadaId: string): Promise<string | null> {
  const resposta = await rotas.encerrar(sessao, atividadeAplicadaId)
  if (resposta.status !== 200) throw new Error(`atividade não encerrada: ${String(resposta.status)} ${resposta.corpo.erro?.codigo ?? ''}`)
  const atividade = resposta.corpo['atividade'] as { entrega: { id: string } | null }
  return atividade.entrega?.id ?? null
}

/** A professora lê a correção, abre todos os destaques e aprova o lote, pelas rotas. Devolve o corpo da aprovação. */
export async function aprovarOLote(rotas: RotasDaAtividade, sessao: SessaoDeTeste, atividadeAplicadaId: string): Promise<RespostaHttp> {
  const correcao = await rotas.correcao(sessao, atividadeAplicadaId)
  if (correcao.status !== 200) throw new Error(`correção não lida: ${String(correcao.status)}`)
  for (const destaque of correcao.corpo['destaques'] as { alunoId: string }[]) await rotas.abrirDestaque(sessao, atividadeAplicadaId, destaque.alunoId)
  const entrega = correcao.corpo['entrega'] as { id: string }
  const aprovado = await rotas.aprovarLote(sessao, entrega.id)
  if (aprovado.status !== 200) throw new Error(`lote não aprovado: ${String(aprovado.status)} ${aprovado.corpo.erro?.codigo ?? ''}`)
  return aprovado
}
