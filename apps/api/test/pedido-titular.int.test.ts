import { InMemoryFileStorage, diaDeUso, JobOutbox, runInContext, JobOutboxRepository, JobRequestRejectedError } from '@educa/nucleo'
import { CicloDeVidaService } from '@educa/nucleo/ciclo-de-vida'
import {
  ErrorCode,
  FINALIDADE_DO_ATENDIMENTO_DO_TITULAR,
  LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO,
  MENSAGENS_DE_ERRO,
  type CategoriaDeRetencao,
} from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { PrivacidadeService } from '../src/privacidade/privacidade.service.js'
import { TitularesRepository } from '../src/privacidade/titulares.repository.js'
import { EmissorDeDesafio } from '../src/credencial/index.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { CapturaDeDadoPessoal } from './captura-de-dado-pessoal.js'
import { alunosNaTurma, montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { esperarNaTrava, GatilhoDeParada } from './gatilho-de-parada.js'
import { FerramentasDaSala, pedidoDaSala, type SalaDeTeste } from './sala-de-teste.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * O pedido do titular (F3, tarefa 11.0; `tasks/prd-lgpd-e-titular/cenarios.md`, RF10, RF13b, RF16, RF17 e as
 * transversais): a busca por `POST`, a prévia, o registro, a lista, o detalhe, o `concluir` e o `corrigir-nome` pela
 * API, auditados, com a prévia do professor igual para quem usou e quem não usou a IA (D64). Nomes e matrículas são
 * gerados; o nome do titular é dado pessoal e nunca vai a log (regra 20, item 9).
 *
 * Os limites por usuário e por escola do F0 vêm altos, para o teste provar o `rl:busca-titular` sozinho: o rate limit
 * do F0 em si continua provado em `limite.int.test.ts`.
 */

const HOJE = (): string => diaDeUso(new Date())
const AMANHA = (): string => diaDeUso(new Date(Date.now() + 86_400_000))
/** Dois dias à frente: futura para o check do banco (`current_date` da sessão) em qualquer hora do dia. */
const DEPOIS_DE_AMANHA = (): string => diaDeUso(new Date(Date.now() + 2 * 86_400_000))
const PREFIXO = `pt${randomUUID().slice(0, 6)}`
const nome = (quem: string): string => `${PREFIXO} ${quem} ${randomUUID().slice(0, 8)}`
/** Um pedaço do nome gerado, que só casa com ele: é o termo da busca. */
const termoDe = (gerado: string): string => gerado.slice(6, 26)
const CHAVE = new TextEncoder().encode(lerAmbienteDeTeste()['IDENTIDADE_CHAVE_ASSINATURA'])

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }
const ESTADO_INVALIDO = { status: 409, corpo: { erro: { codigo: ErrorCode.PEDIDO_EM_ESTADO_INVALIDO, mensagem: MENSAGENS_DE_ERRO.PEDIDO_EM_ESTADO_INVALIDO } } }

/** A resposta sem o `requisicaoId` (que muda a cada chamada) nem os cookies: o resto precisa ser idêntico. */
function resposta(http: Pick<RespostaHttp, 'status' | 'corpo'>): unknown {
  if (http.corpo.erro === undefined) return { status: http.status, corpo: http.corpo }
  const { requisicaoId: _requisicaoId, ...erro } = http.corpo.erro as Record<string, unknown>
  return { status: http.status, corpo: { ...http.corpo, erro } }
}

/** Quantas respostas de cada status, para conferir o limite sem laço de asserção. */
function contarStatus(respostas: readonly RespostaHttp[]): Record<number, number> {
  const contagem: Record<number, number> = {}
  for (const resposta of respostas) contagem[resposta.status] = (contagem[resposta.status] ?? 0) + 1
  return contagem
}

/** Uma pessoa da escola: aluno ou professor, com nome gerado. */
interface Pessoa {
  readonly id: string
  readonly nome: string
}

interface Escola extends EscolaComTurma {
  readonly escolaId: string
  readonly alunos: Pessoa[]
  readonly professores: Pessoa[]
}

describe('pedido do titular (F3, tarefa 11.0): busca, prévia, registro, lista, detalhe, concluir e corrigir nome', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let ferramentas: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } }, linhasDeLog)
    ferramentas = new FerramentasDaSala(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const buscar = (sessao: SessaoDeTeste, termo: string) => pedir(sessao, 'POST', '/v1/privacidade/titulares/busca', { termo })
  const previa = (sessao: SessaoDeTeste, titularId: string) => pedir(sessao, 'GET', `/v1/privacidade/titulares/${titularId}/previa`)
  const registrar = (sessao: SessaoDeTeste, titularId: string, extras: Record<string, unknown> = {}) =>
    pedir(sessao, 'POST', '/v1/privacidade/pedidos', { titularId, tipo: 'acesso', solicitante: 'titular', chegouEm: HOJE(), chaveEnvio: randomUUID(), ...extras })
  const listar = (sessao: SessaoDeTeste, consulta = '') => pedir(sessao, 'GET', `/v1/privacidade/pedidos${consulta}`)
  const ler = (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'GET', `/v1/privacidade/pedidos/${id}`)
  const concluir = (sessao: SessaoDeTeste, id: string) => pedir(sessao, 'POST', `/v1/privacidade/pedidos/${id}/concluir`, {})
  const corrigir = (sessao: SessaoDeTeste, id: string, novo: string) => pedir(sessao, 'POST', `/v1/privacidade/pedidos/${id}/corrigir-nome`, { nome: novo })

  /** Os usuários dos ids, com nome gerado e gravado (o seed sintético deixa o mesmo nome para todos). */
  async function comNome(usuarioIds: readonly string[], quem: string): Promise<Pessoa[]> {
    const pessoas: Pessoa[] = []
    for (const id of usuarioIds) {
      const gerado = nome(quem)
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [gerado, id])
      pessoas.push({ id, nome: gerado })
    }
    return pessoas
  }

  /** Uma escola com ano em curso, duas turmas, dois alunos na turma e dois professores com vínculo confirmado. */
  async function escolaComPessoas(): Promise<Escola> {
    const escola = await montarEscolaComTurma(api, bancada)
    const alunos = await comNome(await alunosNaTurma(bancada, escola, escola.turma, 2), 'Aluno')
    const professores: Pessoa[] = []
    for (const quem of ['Professora', 'Professor']) {
      const [sessao] = await bancada.sessoes(escola.coordenacao.escolaId, { papel: 'professor', quantidade: 1 })
      if (sessao === undefined) throw new Error('professor de teste não criado')
      const [gerado] = await comNome([sessao.usuarioId], quem)
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`,
        [escola.coordenacao.escolaId, escola.anoLetivoId, sessao.usuarioId, escola.turma, escola.quimica, escola.coordenacao.usuarioId],
      )
      if (gerado !== undefined) professores.push(gerado)
    }
    return { ...escola, escolaId: escola.coordenacao.escolaId, alunos, professores }
  }

  /** As linhas de auditoria da ação, na ordem do id, com os campos que o teste confere. */
  interface Auditoria {
    readonly entidade: string
    readonly entidade_id: string
    readonly autor_usuario_id: string | null
    readonly antes: unknown
    readonly depois: unknown
    readonly finalidade: string | null
  }

  async function auditoriasDa(escolaId: string, acao: string): Promise<Auditoria[]> {
    const { rows } = await bancada.pool.query<Auditoria>('select entidade, entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = $2 order by id', [
      escolaId,
      acao,
    ])
    return rows
  }

  async function pedidosNoBanco(escolaId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await bancada.pool.query('select * from pedido_titular where escola_id = $1 order by id', [escolaId])
    return rows as Array<Record<string, unknown>>
  }

  /**
   * Execuções pedidas pela pessoa, que a prévia conta e o arquivo levaria. `tutor` é a do Tutor (a conversa aponta para
   * ela); `ferramenta`, a geração de atividade, que tem tema e texto do modelo.
   */
  async function execucaoDe(escola: Escola, pessoaId: string, quantidade: number, tarefa: 'tutor' | 'ferramenta' = 'tutor'): Promise<string[]> {
    const daTarefa = tarefa === 'tutor' ? { funcao: 'tutor_com_o_aluno', tarefa: 'turno_do_tutor' } : { funcao: 'conversa_e_ferramentas', tarefa: 'gerar_atividade_objetiva' }
    const ids: string[] = []
    for (let vez = 0; vez < quantidade; vez++) {
      const id = randomUUID()
      await bancada.pool.query(
        `insert into execucao_agente (id, escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         values ($1, $2, $3, $4, $5, $6, $7, jsonb_build_object('tarefa', $5::text))`,
        [id, escola.escolaId, escola.anoLetivoId, daTarefa.funcao, daTarefa.tarefa, pessoaId, randomUUID()],
      )
      ids.push(id)
    }
    return ids
  }

  /**
   * As linhas de **cada** categoria de retenção ligadas ao titular, para a contagem da prévia provar categoria a
   * categoria (a classificação das tabelas é a de `CLASSIFICACAO_DAS_TABELAS`). A conversa do professor e a autoria de
   * artefato e de material só aceitam gente da equipe (gatilho `exigir_equipe_da_escola`), e a conversa do Tutor, a
   * resposta e o sinal, só aluno: cada bloco semeia o que a pessoa pode ter, e a contagem é conferida para as duas.
   */
  async function umaLinhaPorCategoria(escola: Escola, titular: Pessoa): Promise<void> {
    const { escolaId, anoLetivoId, turma, quimica } = escola
    const [tutor] = await execucaoDe(escola, titular.id, 1)
    const [ferramenta] = await execucaoDe(escola, titular.id, 1, 'ferramenta')
    if (tutor === undefined || ferramenta === undefined) throw new Error('execução de teste não gravada')
    const { rows: threads } = await bancada.pool.query<{ id: string }>(
      `insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id`,
      [escolaId, anoLetivoId, titular.id],
    )
    await Promise.all([
      // conversa_professor: a thread da pessoa e uma mensagem dela.
      bancada.pool.query(`insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, turma_id, disciplina_id) values ($1, $2, $3, $4, 'usuario', '{"tipo":"texto","texto":"oi"}'::jsonb, $5, $6)`, [
        escolaId,
        anoLetivoId,
        threads[0]?.id,
        ferramenta,
        turma,
        quimica,
      ]),
      // texto_do_modelo: a chamada com tema e resposta; consumo_por_aluno: a chamada do Tutor, com o aluno.
      bancada.pool.query(
        `insert into consumo_ia (escola_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, entrada, saida)
         values ($1, $2, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'falso', 'modelo-falso', 'v1', 10, 20, 30, false, 1, 'concluida', '{"tema":"x"}'::jsonb, '{"texto":"y"}'::jsonb)`,
        [escolaId, ferramenta],
      ),
      bancada.pool.query(
        `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado)
         values ($1, $2, $3, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'falso', 'modelo-falso', 'v1', 10, 20, 30, false, 1, 'concluida')`,
        [escolaId, titular.id, tutor],
      ),
    ])
    await linhasDeAluno(escola, titular, tutor)
    await linhasDeEquipe(escola, titular, ferramenta)
  }

  /** As categorias que só o aluno tem: a conversa do Tutor, o sinal e o trabalho do aluno, com a reivindicação que o aprovou. */
  async function linhasDeAluno(escola: Escola, aluno: Pessoa, execucao: string): Promise<void> {
    const { escolaId, anoLetivoId, turma, quimica, coordenacao } = escola
    await Promise.all([
      bancada.pool.query(`insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'aluno', 'oi')`, [escolaId, anoLetivoId, turma, aluno.id, execucao]),
      bancada.pool.query(`insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'tutor', 'olá')`, [escolaId, anoLetivoId, turma, aluno.id, execucao]),
      bancada.pool.query(`insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo) values ($1, $2, $3, $4, 'travou')`, [escolaId, anoLetivoId, turma, aluno.id]),
    ])
    // trabalho_do_aluno: a atividade aplicada e a tentativa dela.
    const { rows: artefatos } = await bancada.pool.query<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade de teste', '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $5) returning id`,
      [escolaId, anoLetivoId, turma, quimica, coordenacao.usuarioId],
    )
    const { rows: aplicadas } = await bancada.pool.query<{ id: string }>(
      `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5) returning id`,
      [escolaId, anoLetivoId, turma, artefatos[0]?.id, coordenacao.usuarioId],
    )
    await bancada.pool.query(`insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4)`, [escolaId, anoLetivoId, aplicadas[0]?.id, aluno.id])
    // reivindicacao_decidida: o pedido que o aprovou, ligado à linha da lista que virou o usuário dele.
    const { rows: nomes } = await bancada.pool.query<{ id: string }>(
      `insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id, criado_por) values ($1, $2, $3, 'aprovado', $4, $5) returning id`,
      [escolaId, anoLetivoId, turma, aluno.id, coordenacao.usuarioId],
    )
    await bancada.pool.query(`insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, estado, decidida_em, decidida_por, decidida_como) values ($1, $2, $3, $4, 'aprovada', now(), $5, 'coordenacao')`, [
      escolaId,
      anoLetivoId,
      turma,
      nomes[0]?.id,
      coordenacao.usuarioId,
    ])
  }

  /** As categorias que só a equipe tem: a autoria do artefato e o material enviado e excluído. */
  async function linhasDeEquipe(escola: Escola, professor: Pessoa, execucao: string): Promise<void> {
    const { escolaId, anoLetivoId, turma, quimica } = escola
    await bancada.pool.query(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por, execucao_id) values ($1, $2, $3, $4, 'atividade_objetiva', 'Atividade de teste', '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $5, $6)`,
      [escolaId, anoLetivoId, turma, quimica, professor.id, execucao],
    )
    await bancada.pool.query(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_por, excluido_por, excluido_em)
       values ($1, $2, 'Material de teste', 'escola', 'autoria_da_escola', true, lpad('a', 64, 'a'), 1024, 'pronto', 3, $3, $3, now())`,
      [escolaId, quimica, professor.id],
    )
  }

  describe('mesmo que inexistente: titular de B, id de ninguém e pedido sobre si mesmo', () => {
    it('o titularId de B, o id sorteado e o pedido sobre si mesmo (pelo id e pela conta) respondem igual, e nada é gravado', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const alunoDeB = b.alunos[0]
      if (alunoDeB === undefined) throw new Error('aluno de teste não criado')
      // Um professor da mesma conta da coordenação, na mesma escola: o "sobre si mesmo" pelo `conta_id`.
      const { rows: contas } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [a.coordenacao.usuarioId])
      await bancada.pool.query('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4)', [a.escolaId, contas[0]?.conta_id, 'professor', nome('Professor da mesma conta')])
      const { rows: daMesmaConta } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1 and papel = $2 and conta_id = $3', [a.escolaId, 'professor', contas[0]?.conta_id])
      const professorDaMesmaConta = daMesmaConta[0]?.id
      if (professorDaMesmaConta === undefined) throw new Error('usuário da mesma conta não criado')

      const sorteado = randomUUID()
      const esperado = await registrar(a.coordenacao, sorteado)
      expect(resposta(esperado)).toEqual(NAO_ENCONTRADO)
      for (const alvo of [alunoDeB.id, a.coordenacao.usuarioId, professorDaMesmaConta]) {
        expect(resposta(await registrar(a.coordenacao, alvo)), alvo).toEqual(resposta(esperado))
        expect(resposta(await previa(a.coordenacao, alvo)), alvo).toEqual(resposta(NAO_ENCONTRADO))
      }
      expect(resposta(await previa(a.coordenacao, sorteado))).toEqual(NAO_ENCONTRADO)
      // O pedido é de aluno ou professor (RF10): a coordenação da escola não é titular dele.
      const [outraCoordenacao] = await bancada.sessoes(a.escolaId, { papel: 'coordenador', quantidade: 1 })
      if (outraCoordenacao === undefined) throw new Error('coordenação de teste não criada')
      expect(resposta(await registrar(a.coordenacao, outraCoordenacao.usuarioId))).toEqual(resposta(esperado))

      // O pedido de B existe para B, e para A ele é o id inexistente, em toda rota que o alcança.
      const registrado = await registrar(b.coordenacao, alunoDeB.id, { tipo: 'correcao' })
      expect(registrado.status).toBe(201)
      const idDeB = registrado.corpo['id'] as string
      expect(resposta(await ler(a.coordenacao, idDeB))).toEqual(NAO_ENCONTRADO)
      expect(resposta(await concluir(a.coordenacao, idDeB))).toEqual(NAO_ENCONTRADO)
      expect(resposta(await corrigir(a.coordenacao, idDeB, nome('De B')))).toEqual(NAO_ENCONTRADO)
      expect(await pedidosNoBanco(a.escolaId)).toEqual([])

      // O pedido sobre a própria pessoa, registrado por **outra** coordenação, é inexistente para quem é dele: nas
      // rotas que o alcançam e na lista. É o caso do professor da mesma conta da coordenação (RF10, "sobre si mesmo").
      const sobreEla = await registrar(outraCoordenacao, professorDaMesmaConta, { tipo: 'correcao' })
      expect(sobreEla.status).toBe(201)
      const idSobreEla = sobreEla.corpo['id'] as string
      expect(resposta(await ler(a.coordenacao, idSobreEla))).toEqual(resposta(NAO_ENCONTRADO))
      expect(resposta(await concluir(a.coordenacao, idSobreEla))).toEqual(resposta(NAO_ENCONTRADO))
      expect(resposta(await corrigir(a.coordenacao, idSobreEla, nome('Ela')))).toEqual(resposta(NAO_ENCONTRADO))
      expect((await listar(a.coordenacao)).corpo).toEqual({ itens: [] })
      const paraEla = await listar(outraCoordenacao)
      expect(paraEla.status).toBe(200)
      expect(((paraEla.corpo as { itens: Array<Record<string, unknown>> }).itens ?? []).map(({ id }) => id)).toEqual([idSobreEla])
    })

    it('a lista pagina pela chegada mais recente primeiro e pelo id no empate: o registrado por último com a chegada antiga não abre a lista, a auditoria leva só os ids da página e nenhuma página repete nem pula', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const haDias = (dias: number): string => diaDeUso(new Date(Date.now() - dias * 86_400_000))
      // A ordem do registro (que é a do id) não é a da chegada: o último a ser registrado é o que chegou há mais tempo, e dois
      // chegaram no mesmo dia. Com a página por id, a primeira trazia os dois primeiros registrados, e o de hoje ficava na segunda.
      const registrados: Array<{ readonly id: string; readonly chegouEm: string }> = []
      for (const chegouEm of [3, 1, 1, 0, 5].map((dias) => haDias(dias))) {
        const criado = await registrar(a.coordenacao, aluno.id, { chegouEm })
        expect(criado.status).toBe(201)
        registrados.push({ id: criado.corpo['id'] as string, chegouEm })
      }
      // A ordem esperada é a da chave da tela: chegada decrescente e id crescente no empate. O id se ordena como texto, e não pela
      // versão do UUID: o que importa é o `asc(id)` do banco.
      const esperados = [...registrados]
        .sort((x, y) => (x.chegouEm === y.chegouEm ? (x.id < y.id ? -1 : 1) : x.chegouEm < y.chegouEm ? 1 : -1))
        .map(({ id }) => id)
      const emOrdemDeRegistro = [...registrados].map(({ id }) => id)
      expect(esperados).not.toEqual([...emOrdemDeRegistro].sort())
      const finalidade = { finalidade: FINALIDADE_DO_ATENDIMENTO_DO_TITULAR }
      const idsDe = (corpo: unknown): string[] => ((corpo as { itens: Array<{ id: string }> }).itens ?? []).map(({ id }) => id)

      const pagina1 = await listar(a.coordenacao, '?limite=2')
      expect(idsDe(pagina1.corpo)).toEqual(esperados.slice(0, 2))
      expect((pagina1.corpo as { proxima?: string }).proxima).toBe(esperados[1])
      expect(await auditoriasDa(a.escolaId, 'pedidos.listados')).toEqual([
        { entidade: 'escola', entidade_id: a.escolaId, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: { ids: esperados.slice(0, 2) }, ...finalidade },
      ])

      const pagina2 = await listar(a.coordenacao, `?limite=2&pagina=${String(esperados[1])}`)
      expect(idsDe(pagina2.corpo)).toEqual(esperados.slice(2, 4))
      expect((pagina2.corpo as { proxima?: string }).proxima).toBe(esperados[3])

      const pagina3 = await listar(a.coordenacao, `?limite=2&pagina=${String(esperados[3])}`)
      expect(idsDe(pagina3.corpo)).toEqual([esperados[4]])
      expect(pagina3.corpo).not.toHaveProperty('proxima')

      const listagens = await auditoriasDa(a.escolaId, 'pedidos.listados')
      expect(listagens.map(({ depois }) => depois)).toEqual([{ ids: esperados.slice(0, 2) }, { ids: esperados.slice(2, 4) }, { ids: [esperados[4]] }])
      // Sem repetir nem pular: as três páginas, juntas, são a lista toda, uma vez cada.
      expect([...idsDe(pagina1.corpo), ...idsDe(pagina2.corpo), ...idsDe(pagina3.corpo)]).toEqual(esperados)
      // E a lista sem limite entrega a mesma ordem de uma vez só.
      expect(idsDe((await listar(a.coordenacao)).corpo)).toEqual(esperados)
    })

    it('o cursor de um pedido de outra escola, o inexistente e o do pedido sobre a própria pessoa respondem a mesma página vazia, sem próxima', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const alunoDeA = a.alunos[0]
      const alunoDeB = b.alunos[0]
      if (alunoDeA === undefined || alunoDeB === undefined) throw new Error('aluno de teste não criado')
      // O pedido de B, que existe, e o pedido sobre a própria pessoa de quem lê (o professor da mesma conta da coordenação, registrado
      // por outra coordenação): para A, os dois são o id que não existe.
      const { rows: contas } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [a.coordenacao.usuarioId])
      await bancada.pool.query('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4)', [a.escolaId, contas[0]?.conta_id, 'professor', nome('Professor da mesma conta')])
      const { rows: daMesmaConta } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1 and papel = $2 and conta_id = $3', [a.escolaId, 'professor', contas[0]?.conta_id])
      const professorDaMesmaConta = daMesmaConta[0]?.id
      if (professorDaMesmaConta === undefined) throw new Error('usuário da mesma conta não criado')
      const [outraCoordenacao] = await bancada.sessoes(a.escolaId, { papel: 'coordenador', quantidade: 1 })
      if (outraCoordenacao === undefined) throw new Error('coordenação de teste não criada')

      // Os dois vêm antes do pedido do aluno na chave da lista (mesmo dia, id menor): o cursor de qualquer um deles, se fosse achado,
      // teria o pedido do aluno depois de si, e a página não sairia vazia. E o pedido sobre ela é o primeiro da lista de A: se o
      // filtro dela viesse depois do limite, a página de um item sairia vazia, com próxima.
      const deB = await registrar(b.coordenacao, alunoDeB.id)
      const sobreEla = await registrar(outraCoordenacao, professorDaMesmaConta)
      const doAluno = await registrar(a.coordenacao, alunoDeA.id)
      // E dois que vêm **depois** dele (chegaram antes): o de B, que a escola A nunca alcança, e o sobre ela, que a lista dela nunca traz.
      // Sem o escopo e sem o filtro na página que segue o cursor, a página depois do pedido do aluno deixaria de ser vazia.
      const deBDepois = await registrar(b.coordenacao, alunoDeB.id, { chegouEm: diaDeUso(new Date(Date.now() - 3 * 86_400_000)) })
      const sobreElaDepois = await registrar(outraCoordenacao, professorDaMesmaConta, { chegouEm: diaDeUso(new Date(Date.now() - 2 * 86_400_000)) })
      for (const criado of [doAluno, deB, sobreEla, deBDepois, sobreElaDepois]) expect(criado.status).toBe(201)
      const idDeB = deB.corpo['id'] as string
      const idSobreEla = sobreEla.corpo['id'] as string

      // O pedido do aluno é o único que A lê, e o cursor dele é válido: com `limite=1` a página é a dele, e depois dele não há mais nada
      // (nem o de B, nem o sobre ela, que chegaram depois na chave).
      const lida = await listar(a.coordenacao, '?limite=1')
      expect(((lida.corpo as { itens: Array<{ id: string }> }).itens ?? []).map(({ id }) => id)).toEqual([doAluno.corpo['id']])
      const depoisDoSeu = await listar(a.coordenacao, `?limite=1&pagina=${String(doAluno.corpo['id'])}`)
      expect(depoisDoSeu.corpo).toEqual({ itens: [] })

      const vazia = { status: 200, corpo: { itens: [] } }
      for (const [oQue, cursor] of [
        ['de outra escola', idDeB],
        ['inexistente', randomUUID()],
        ['do pedido sobre si mesmo', idSobreEla],
      ] as const) {
        const lidaComOCursor = await listar(a.coordenacao, `?pagina=${cursor}`)
        expect({ status: lidaComOCursor.status, corpo: lidaComOCursor.corpo }, oQue).toEqual(vazia)
      }
    })
  })

  describe('validação e imutabilidade: erro tipado, e a escola e o titular do pedido não mudam', () => {
    it('o nome da correção e o termo da busca fora do contrato, com uma sentinela dentro, dão ENTRADA_INVALIDA: o nome não muda, nenhuma busca é auditada, e a sentinela não vai ao log nem à resposta (17.0)', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const criado = await registrar(a.coordenacao, aluno.id, { tipo: 'correcao' })
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string
      const sentinela = `sentinela-${randomUUID()}`
      const captura = new CapturaDeDadoPessoal(linhasDeLog)
      const longo = `${sentinela} ${'x'.repeat(201)}`
      expect(resposta(await captura.capturar(corrigir(a.coordenacao, id, longo)))).toEqual(resposta(ENTRADA_INVALIDA))
      expect(resposta(await captura.capturar(pedir(a.coordenacao, 'POST', `/v1/privacidade/pedidos/${id}/corrigir-nome`, { nome: sentinela, titularId: aluno.id })))).toEqual(resposta(ENTRADA_INVALIDA))
      expect(resposta(await captura.capturar(buscar(a.coordenacao, longo)))).toEqual(resposta(ENTRADA_INVALIDA))
      expect(resposta(await captura.capturar(pedir(a.coordenacao, 'POST', '/v1/privacidade/titulares/busca', { termo: sentinela, escolaId: a.escolaId })))).toEqual(resposta(ENTRADA_INVALIDA))
      const { rows } = await bancada.pool.query<{ nome: string }>('select nome from usuario where id = $1', [aluno.id])
      expect(rows[0]?.nome).toBe(aluno.nome)
      expect(await auditoriasDa(a.escolaId, 'titular.buscado')).toEqual([])
      captura.varrerTudo([sentinela])
    })

    it('chegouEm no futuro, nome vazio, só de espaço ou acima de 200 e termo de duas letras, de espaços ou acima de 200 dão ENTRADA_INVALIDA', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')

      expect(resposta(await registrar(a.coordenacao, aluno.id, { chegouEm: AMANHA() }))).toEqual(ENTRADA_INVALIDA)
      for (const termo of ['ab', '   ', ' ab ', 'x'.repeat(201)]) {
        expect(resposta(await buscar(a.coordenacao, termo)), JSON.stringify(termo.slice(0, 10))).toEqual(resposta(ENTRADA_INVALIDA))
      }
      expect(resposta(await buscar(a.coordenacao, ''))).toEqual(ENTRADA_INVALIDA)

      const criado = await registrar(a.coordenacao, aluno.id, { tipo: 'correcao' })
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string
      for (const vazio of ['', '   ', 'x'.repeat(201)]) {
        expect(resposta(await corrigir(a.coordenacao, id, vazio)), JSON.stringify(vazio.slice(0, 10))).toEqual(resposta(ENTRADA_INVALIDA))
      }
      // O erro é o do contrato, e não o 23514 cru do check do nome: o nome não muda, e nenhuma busca foi auditada.
      const { rows } = await bancada.pool.query<{ nome: string }>('select nome from usuario where id = $1', [aluno.id])
      expect(rows[0]?.nome).toBe(aluno.nome)
      expect(await auditoriasDa(a.escolaId, 'titular.buscado')).toEqual([])
      expect(await pedidosNoBanco(a.escolaId)).toHaveLength(1)
    })

    it('um UPDATE que troca a escola ou o titular do pedido é recusado pelo gatilho, e o resto do pedido muda normalmente', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const aluno = a.alunos[0]
      const alunoDeB = b.alunos[0]
      if (aluno === undefined || alunoDeB === undefined) throw new Error('aluno de teste não criado')
      const criado = await registrar(a.coordenacao, aluno.id)
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string

      for (const [oQue, comando, parametros] of [
        ['a escola', 'update pedido_titular set escola_id = $1 where id = $2', [b.escolaId, id]],
        ['o titular', 'update pedido_titular set titular_id = $1 where id = $2', [alunoDeB.id, id]],
      ] as const) {
        const falha = await bancada.pool.query(comando, [...parametros]).then(
          () => undefined,
          (erro: { code?: string; constraint?: string }) => erro,
        )
        expect({ oQue, code: falha?.code, constraint: falha?.constraint }, oQue).toEqual({ oQue, code: '23514', constraint: 'pedido_titular_imutavel' })
      }
      // O que não é imutável muda: o `concluir` conclui o mesmo pedido.
      expect(resposta(await concluir(a.coordenacao, id))).toEqual({ status: 204, corpo: {} })
    })
  })

  describe('o job do arquivo ao registrar o pedido (reengenharia, 18.0)', () => {
    it('o job que a definição recusa desfaz a transação de quem pede: o pedido de acesso não fica, nem o job, nem a auditoria; sem o defeito, o mesmo pedido entra', async () => {
      const escola = await escolaComPessoas()
      const aluno = escola.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const real = new JobOutbox(new JobOutboxRepository(bancada.banco))
      // O serviço manda o pedidoId certo; o que se estraga é só o payload, no caminho até o `JobOutbox` de verdade.
      const comPayloadEstragado: Pick<JobOutbox, 'enfileirar'> = { enfileirar: (tx, tipo, dados, ...opcoes) => real.enfileirar(tx, tipo, Object.assign({}, dados, { escolaId: escola.escolaId }), ...opcoes) }
      const comoCoordenacao = { requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: escola.coordenacao.usuarioId, papel: 'coordenador' as const, sessaoId: escola.coordenacao.sessaoId, anoLetivoId: null }
      const registro = () => ({ titularId: aluno.id, tipo: 'acesso' as const, solicitante: 'titular' as const, chegouEm: HOJE(), chaveEnvio: randomUUID() })
      const jobs = async () => Number((await bancada.pool.query<{ total: string }>('select count(*) as total from job_registro where escola_id = $1', [escola.escolaId])).rows[0]?.total)

      const comDefeito = new PrivacidadeService(bancada.banco, { enfileirador: comPayloadEstragado, armazem: new InMemoryFileStorage() })
      await expect(runInContext(comoCoordenacao, () => comDefeito.registrarPedido(registro()))).rejects.toBeInstanceOf(JobRequestRejectedError)
      expect(await pedidosNoBanco(escola.escolaId)).toEqual([])
      expect(await jobs()).toBe(0)
      expect(await auditoriasDa(escola.escolaId, 'pedido.registrado')).toEqual([])

      const semDefeito = new PrivacidadeService(bancada.banco, { enfileirador: real, armazem: new InMemoryFileStorage() })
      const pedido = await runInContext(comoCoordenacao, () => semDefeito.registrarPedido(registro()))
      expect((await pedidosNoBanco(escola.escolaId)).map((linha) => linha['id'])).toEqual([pedido.id])
      expect(await jobs()).toBe(1)
    })
  })

  describe('corrigir nome: muda o titular, audita sem o nome, e recusa fora de correção ou no pedido fechado', () => {
    it('muda o nome do titular, não muda o de B da mesma conta, e o pedido de outro tipo ou fechado responde PEDIDO_EM_ESTADO_INVALIDO', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const professor = a.professores[0]
      if (professor === undefined) throw new Error('professor de teste não criado')
      // O mesmo professor dá aula em B: a correção de A não muda o usuário de B, que é da mesma conta.
      const { rows: contas } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [professor.id])
      await bancada.pool.query('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4)', [b.escolaId, contas[0]?.conta_id, 'professor', professor.nome])
      const { rows: emB } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1 and conta_id = $2', [b.escolaId, contas[0]?.conta_id])
      const emBId = emB[0]?.id
      if (emBId === undefined) throw new Error('usuário de B não criado')

      const correcao = await registrar(a.coordenacao, professor.id, { tipo: 'correcao' })
      expect(correcao.status).toBe(201)
      const id = correcao.corpo['id'] as string
      const novo = nome('Professora corrigida')
      expect(resposta(await corrigir(a.coordenacao, id, novo))).toEqual({ status: 204, corpo: {} })

      const { rows: depois } = await bancada.pool.query<{ nome: string }>('select nome from usuario where id = $1', [professor.id])
      expect(depois[0]?.nome).toBe(novo)
      const { rows: deB } = await bancada.pool.query<{ nome: string }>('select nome from usuario where id = $1', [emBId])
      expect(deB[0]?.nome).toBe(professor.nome)

      const gravadas = await auditoriasDa(a.escolaId, 'pedido.nome_corrigido')
      expect(gravadas).toEqual([{ entidade: 'pedido_titular', entidade_id: id, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: null, finalidade: null }])
      // A auditoria não traz o nome, nem o anterior nem o novo (RF13b).
      expect(JSON.stringify(gravadas)).not.toContain(novo)
      expect(JSON.stringify(gravadas)).not.toContain(professor.nome)

      const deAcesso = await registrar(a.coordenacao, professor.id)
      expect(resposta(await corrigir(a.coordenacao, deAcesso.corpo['id'] as string, novo))).toEqual(ESTADO_INVALIDO)
      // O pedido de correção em preparação não corrige o nome — o `where` do update decide — e o `concluir` dele conclui.
      const emPreparacao = await registrar(a.coordenacao, professor.id, { tipo: 'correcao' })
      const idEmPreparacao = emPreparacao.corpo['id'] as string
      await bancada.pool.query("update pedido_titular set estado = 'em_preparacao' where id = $1", [idEmPreparacao])
      const nomeDeAntes = (await bancada.pool.query<{ nome: string }>('select nome from usuario where id = $1', [professor.id])).rows[0]?.nome
      expect(resposta(await corrigir(a.coordenacao, idEmPreparacao, nome('Preparando')))).toEqual(ESTADO_INVALIDO)
      expect((await bancada.pool.query<{ nome: string }>('select nome from usuario where id = $1', [professor.id])).rows[0]?.nome).toBe(nomeDeAntes)
      expect(resposta(await concluir(a.coordenacao, idEmPreparacao))).toEqual({ status: 204, corpo: {} })
      expect(resposta(await concluir(a.coordenacao, id))).toEqual({ status: 204, corpo: {} })
      expect(resposta(await corrigir(a.coordenacao, id, nome('De novo')))).toEqual(ESTADO_INVALIDO)
      // A eliminação não conclui por aqui: é o job dela (15.0), e o pedido dela responde o mesmo erro.
      const deEliminacao = await registrar(a.coordenacao, professor.id, { tipo: 'eliminacao' })
      expect(resposta(await concluir(a.coordenacao, deEliminacao.corpo['id'] as string))).toEqual(ESTADO_INVALIDO)
    })
  })

  describe('auditoria e log: cada passo com finalidade, e nada de pessoa em log nem em resposta', () => {
    it('a busca, a prévia, a lista e o detalhe auditam com a finalidade; a busca não grava o termo; o concluir audita o estado', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const termo = termoDe(aluno.nome)

      expect((await buscar(a.coordenacao, termo)).status).toBe(200)
      expect((await previa(a.coordenacao, aluno.id)).status).toBe(200)
      const criado = await registrar(a.coordenacao, aluno.id)
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string
      expect((await listar(a.coordenacao)).status).toBe(200)
      expect((await ler(a.coordenacao, id)).status).toBe(200)
      expect((await concluir(a.coordenacao, id)).status).toBe(204)

      const finalidade = { finalidade: FINALIDADE_DO_ATENDIMENTO_DO_TITULAR }
      expect(await auditoriasDa(a.escolaId, 'titular.buscado')).toEqual([{ entidade: 'escola', entidade_id: a.escolaId, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: { ids: [aluno.id] }, ...finalidade }])
      expect(await auditoriasDa(a.escolaId, 'titular.previa_lida')).toEqual([{ entidade: 'titular', entidade_id: aluno.id, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: null, ...finalidade }])
      expect(await auditoriasDa(a.escolaId, 'pedidos.listados')).toEqual([{ entidade: 'escola', entidade_id: a.escolaId, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: { ids: [id] }, ...finalidade }])
      expect(await auditoriasDa(a.escolaId, 'pedido.lido')).toEqual([{ entidade: 'pedido_titular', entidade_id: id, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: null, ...finalidade }])
      expect(await auditoriasDa(a.escolaId, 'pedido.registrado')).toEqual([
        {
          entidade: 'pedido_titular',
          entidade_id: id,
          autor_usuario_id: a.coordenacao.usuarioId,
          antes: null,
          depois: { titularId: aluno.id, papelTitular: 'aluno', tipo: 'acesso', solicitante: 'titular', chegouEm: HOJE() },
          finalidade: null,
        },
      ])
      // O pedido de acesso nasce `em_preparacao` desde a 13.0 (gera arquivo), e o `antes` é o estado que o `update` trocou.
      expect(await auditoriasDa(a.escolaId, 'pedido.concluido')).toEqual([
        { entidade: 'pedido_titular', entidade_id: id, autor_usuario_id: a.coordenacao.usuarioId, antes: { estado: 'em_preparacao' }, depois: { estado: 'concluido' }, finalidade: null },
      ])
      // O termo da busca não vai à auditoria (RF17).
      expect(JSON.stringify(await auditoriasDa(a.escolaId, 'titular.buscado'))).not.toContain(termo)

      // O termo não vai ao log nem às outras respostas (RF17): ele só vai ao corpo do pedido de busca.
      const captura = new CapturaDeDadoPessoal(linhasDeLog)
      expect((await buscar(a.coordenacao, termo)).status).toBe(200)
      await captura.capturar(ler(a.coordenacao, randomUUID()))
      captura.varrerTudo([termo])
      // O detalhe tem só os campos do contrato: sem nome de quem registrou, sem matrícula e sem texto.
      const detalhe = await ler(a.coordenacao, id)
      expect(Object.keys(detalhe.corpo).sort()).toEqual(['compartilhamento', 'concluidoEm', 'estado', 'homonimo', 'id', 'nomeTrocado', 'solicitante', 'titular', 'tipo', 'chegouEm'].sort())
      // A foto do compartilhamento nasce vazia, e a 12.0 a preenche no registro.
      expect(detalhe.corpo).toMatchObject({ estado: 'concluido', homonimo: false, nomeTrocado: null, compartilhamento: [] })
    })

    it('permissão: professor, aluno e a coordenação sem segundo fator não chegam a nenhuma rota; sem token, 401', async () => {
      const a = await escolaComPessoas()
      const professor = await bancada.sessao(a.escolaId, 'professor')
      const alunoDeSessao = await bancada.sessao(a.escolaId, 'aluno')
      const { rows } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [a.coordenacao.usuarioId])
      const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: rows[0]?.conta_id ?? randomUUID(), etapa: 'mfa', mfaCumprido: false })
      const titular = a.alunos[0]
      if (titular === undefined) throw new Error('aluno de teste não criado')
      // Um pedido real: as rotas com `:id` só provam a permissão com ele, porque o id de ninguém daria 404 a qualquer um.
      const criado = await registrar(a.coordenacao, titular.id, { tipo: 'correcao' })
      expect(criado.status).toBe(201)
      const pedidoId = criado.corpo['id'] as string
      const rotas: Array<[string, string, unknown?]> = [
        ['POST', '/v1/privacidade/titulares/busca', { termo: PREFIXO }],
        ['GET', `/v1/privacidade/titulares/${titular.id}/previa`],
        ['POST', '/v1/privacidade/pedidos', { titularId: titular.id, tipo: 'acesso', solicitante: 'titular', chegouEm: HOJE(), chaveEnvio: randomUUID() }],
        ['GET', '/v1/privacidade/pedidos'],
        ['GET', `/v1/privacidade/pedidos/${pedidoId}`],
        ['POST', `/v1/privacidade/pedidos/${pedidoId}/concluir`, {}],
        ['POST', `/v1/privacidade/pedidos/${pedidoId}/corrigir-nome`, { nome: 'Qualquer' }],
        // A versão da escola do arquivo (13.0): só a coordenação com segundo fator chega; o conteúdo é de `arquivo-do-titular.int.test.ts`.
        ['POST', `/v1/privacidade/pedidos/${pedidoId}/arquivo`, { finalidade: 'entregar_ao_titular' }],
      ]
      for (const [verbo, caminho, corpo] of rotas) {
        const pedir = (token: string | undefined) => chamar(api.url, verbo, caminho, token, corpo)
        for (const [quem, sessao] of [['professor', professor], ['aluno', alunoDeSessao]] as const) {
          const resposta = await pedir(await sessao.tokenNovo())
          expect({ status: resposta.status, codigo: resposta.corpo.erro?.codigo }, `${quem} ${verbo} ${caminho}`).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
        }
        expect((await pedir(desafio)).status, `sem segundo fator ${verbo} ${caminho}`).toBe(401)
        expect((await pedir(undefined)).status, `sem token ${verbo} ${caminho}`).toBe(401)
      }
      // Ninguém além da coordenação tocou o pedido: um só registro, o estado intacto e nenhum passo dado.
      expect(await pedidosNoBanco(a.escolaId)).toHaveLength(1)
      expect((await ler(a.coordenacao, pedidoId)).corpo).toMatchObject({ estado: 'recebido', titular: { nome: titular.nome } })
      expect(await auditoriasDa(a.escolaId, 'pedido.concluido')).toEqual([])
      expect(await auditoriasDa(a.escolaId, 'pedido.nome_corrigido')).toEqual([])
      expect(await auditoriasDa(a.escolaId, 'pedido.lido')).toHaveLength(1)
    })

    it('RF17: o log não traz o nome do titular — o atual e o anterior a uma correção — e as outras respostas não trazem o anterior nem o termo', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const captura = new CapturaDeDadoPessoal(linhasDeLog)

      // O nome aparece para quem tem o direito de vê-lo: é o que torna a varredura do log não vazia.
      const achados = await buscar(a.coordenacao, termoDe(aluno.nome))
      expect(JSON.stringify(achados.corpo)).toContain(aluno.nome)

      const criado = await registrar(a.coordenacao, aluno.id, { tipo: 'correcao' })
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string
      const anterior = aluno.nome
      const novo = nome('Aluno corrigido')
      await captura.capturar(corrigir(a.coordenacao, id, novo))
      await captura.capturar(concluir(a.coordenacao, id))
      await captura.capturar(listar(a.coordenacao))
      await captura.capturar(ler(a.coordenacao, id))
      await captura.capturar(buscar(a.coordenacao, 'nao-existe-este-nome'))
      await captura.capturar(previa(a.coordenacao, randomUUID()))

      // O nome anterior a uma correção não volta em resposta nenhuma, e o termo digitado nem isso.
      captura.varrerTudo([anterior, 'nao-existe-este-nome'])
      // O nome atual não vai a log, mesmo saindo na lista e no detalhe (regra 20, item 9).
      captura.varrerLog([novo, anterior])
    })
  })

  describe('D64 e homônimo: a prévia do professor não mede o uso dele, e a do aluno conta por categoria', () => {
    it('a prévia do professor sai igual para quem usou e quem não usou a IA: só as categorias de cadastro e vínculo, sem contagem nem período', async () => {
      const a = await escolaComPessoas()
      const [usou, naoUsou] = a.professores
      if (usou === undefined || naoUsou === undefined) throw new Error('professor de teste não criado')
      // Quem usou tem pedido, tema, texto do modelo e conversa com o Assistente.
      const [execucao] = await execucaoDe(a, usou.id, 1, 'ferramenta')
      await execucaoDe(a, usou.id, 2, 'ferramenta')
      await bancada.pool.query(
        `insert into consumo_ia (escola_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, entrada, saida)
         values ($1, $2, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'falso', 'modelo-falso', 'v1', 10, 20, 30, false, 1, 'concluida', '{"tema":"x"}'::jsonb, '{"texto":"y"}'::jsonb)`,
        [a.escolaId, execucao],
      )
      const { rows: threads } = await bancada.pool.query<{ id: string }>(
        `insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id`,
        [a.escolaId, a.anoLetivoId, usou.id],
      )
      await bancada.pool.query(
        `insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, turma_id, disciplina_id) values ($1, $2, $3, $4, 'usuario', '{"tipo":"texto","texto":"oi"}'::jsonb, $5, $6)`,
        [a.escolaId, a.anoLetivoId, threads[0]?.id, execucao, a.turma, a.quimica],
      )

      const deQuemUsou = await previa(a.coordenacao, usou.id)
      const deQuemNaoUsou = await previa(a.coordenacao, naoUsou.id)
      expect(deQuemUsou.status).toBe(200)
      expect(deQuemNaoUsou.status).toBe(200)
      expect(deQuemUsou.corpo).toMatchObject({ papel: 'professor', categorias: ['pessoa_desativada', 'vinculo_encerrado'] })
      // Só o id e o nome diferem: nenhuma contagem, nenhum período, nada de uso (D64).
      expect({ ...deQuemUsou.corpo, id: '-', nome: '-' }).toEqual({ ...deQuemNaoUsou.corpo, id: '-', nome: '-' })
      expect(Object.keys(deQuemUsou.corpo).sort()).toEqual(['categorias', 'homonimo', 'id', 'nome', 'papel'])
      for (const deUso of ['conversa_professor', 'execucao_agente', 'texto_do_modelo', 'autoria_de_artefato']) {
        expect(JSON.stringify(deQuemUsou.corpo), deUso).not.toContain(deUso)
      }
    })

    it('a prévia do aluno conta por categoria, com uma linha em cada uma delas, e o homônimo vem do aluno ativo do mesmo nome e do nome livre igual na lista', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      await umaLinhaPorCategoria(a, aluno)

      const lida = await previa(a.coordenacao, aluno.id)
      expect(lida.status).toBe(200)
      expect(lida.corpo).toMatchObject({ id: aluno.id, nome: aluno.nome, papel: 'aluno', homonimo: false })
      // Contagem por categoria, na ordem do catálogo, de cada linha que o arquivo do titular levaria.
      expect((lida.corpo as { categorias: Array<{ categoria: CategoriaDeRetencao; quantidade: number }> }).categorias).toEqual([
        { categoria: 'conversa_tutor', quantidade: 2 },
        { categoria: 'sinal_tutor', quantidade: 1 },
        { categoria: 'conversa_professor', quantidade: 1 },
        { categoria: 'execucao_agente', quantidade: 2 },
        { categoria: 'texto_do_modelo', quantidade: 1 },
        { categoria: 'consumo_por_aluno', quantidade: 1 },
        { categoria: 'trabalho_do_aluno', quantidade: 1 },
        { categoria: 'reivindicacao_decidida', quantidade: 1 },
        { categoria: 'autoria_de_artefato', quantidade: 1 },
        { categoria: 'material_excluido', quantidade: 1 },
        { categoria: 'vinculo_encerrado', quantidade: 1 },
        { categoria: 'pessoa_desativada', quantidade: 1 },
      ])

      // O nome do titular é único nesta escola: sem homônimo, e cada caso abaixo muda só o que ele testa.
      const unico = nome('Aluno único')
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [unico, aluno.id])
      const [outro, desativado] = await bancada.sessoes(a.escolaId, { papel: 'aluno', quantidade: 2 })
      const professor = a.professores[0]
      if (outro === undefined || desativado === undefined || professor === undefined) throw new Error('pessoa de teste não criada')
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: false })

      // O aluno **desativado** com o mesmo nome não é homônimo: é o aluno ativo que conta.
      await bancada.pool.query('update usuario set nome = $1, desativado_em = now() where id = $2', [unico, desativado.usuarioId])
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: false })

      // O professor com o mesmo nome não é homônimo: a regra é a do aluno (a troca de nome é dele).
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [unico, professor.id])
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: false })

      // A linha da lista com o mesmo nome e estado diferente de livre não é homônimo: é o nome livre que conta.
      await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado, criado_por) values ($1, $2, $3, $4, $5, $6, $7)', [
        a.escolaId,
        a.anoLetivoId,
        a.turma,
        unico,
        `${PREFIXO}-m-${randomUUID().slice(0, 12)}`,
        'reivindicado',
        a.coordenacao.usuarioId,
      ])
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: false })

      // Homônimo por aluno ativo com o mesmo nome completo.
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [unico, outro.usuarioId])
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: true })

      // Homônimo por nome livre igual na lista, mesmo sem ninguém com aquele nome entre os usuários.
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [nome('Aluno sem homônimo'), outro.usuarioId])
      await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado, criado_por) values ($1, $2, $3, $4, $5, $6, $7)', [
        a.escolaId,
        a.anoLetivoId,
        a.turma,
        unico,
        `${PREFIXO}-m-${randomUUID().slice(0, 12)}`,
        'livre',
        a.coordenacao.usuarioId,
      ])
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: true })
      // A marca fica no registro e volta no detalhe: é ela que avisa a coordenação antes de confirmar.
      const comHomonimo = await registrar(a.coordenacao, aluno.id)
      expect(comHomonimo.status).toBe(201)
      expect((await ler(a.coordenacao, comHomonimo.corpo['id'] as string)).corpo).toMatchObject({ homonimo: true })
    })

    it('o titular eliminado some do pedido: a lista e o detalhe mostram "Titular eliminado"', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const criado = await registrar(a.coordenacao, aluno.id)
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string
      expect((await ler(a.coordenacao, id)).corpo).toMatchObject({ titular: { nome: aluno.nome } })

      await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.coordenacao.usuarioId, papel: 'coordenador' }, () =>
        new CicloDeVidaService(bancada.banco).eliminar(aluno.id),
      )
      expect((await ler(a.coordenacao, id)).corpo).toMatchObject({ titular: null })
      expect(((await listar(a.coordenacao)).corpo as { itens: Array<Record<string, unknown>> }).itens).toEqual([expect.objectContaining({ id, titular: null })])
    })

    it('a contagem alcança a autoria do artefato e o material, que só a equipe pode ter (a prévia de professor não mostra contagem, D64)', async () => {
      const a = await escolaComPessoas()
      const professor = a.professores[0]
      if (professor === undefined) throw new Error('professor de teste não criado')
      const [execucao] = await execucaoDe(a, professor.id, 1, 'ferramenta')
      if (execucao === undefined) throw new Error('execução de teste não gravada')
      await linhasDeEquipe(a, professor, execucao)

      // O que a prévia de professor esconde (D64) é o que o `GET meus-dados` mostra a ele (13.0): a contagem é a mesma.
      const contagens = await runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.coordenacao.usuarioId }, () => new TitularesRepository(bancada.banco).contagemPorCategoria(professor.id))
      expect(contagens).toEqual([
        { categoria: 'execucao_agente', quantidade: 1 },
        { categoria: 'autoria_de_artefato', quantidade: 1 },
        { categoria: 'material_excluido', quantidade: 1 },
        { categoria: 'vinculo_encerrado', quantidade: 1 },
        { categoria: 'pessoa_desativada', quantidade: 1 },
      ])
    })
  })

  describe('a busca devolve até 20 titulares, com matrícula, turmas e disciplinas', () => {
    it('traz o aluno com a matrícula e a turma, o professor com as disciplinas e as turmas, e corta em 20', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      const professor = a.professores[0]
      if (aluno === undefined || professor === undefined) throw new Error('pessoa de teste não criada')
      await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [
        a.escolaId,
        aluno.id,
        `${PREFIXO}-m-${randomUUID().slice(0, 12)}`,
        'hash-de-teste',
      ])

      const achados = await buscar(a.coordenacao, PREFIXO)
      expect(achados.status).toBe(200)
      const titulares = achados.corpo as { titulares: Array<Record<string, unknown>> }
      expect(titulares.titulares.find(({ id }) => id === aluno.id)).toMatchObject({ papel: 'aluno', turmas: [{ id: a.turma, nome: '2ºB' }], disciplinas: [], estado: 'ativo' })
      expect((titulares.titulares.find(({ id }) => id === aluno.id) as { matricula: string }).matricula).toMatch(new RegExp(`^${PREFIXO}-m-`))
      expect(titulares.titulares.find(({ id }) => id === professor.id)).toMatchObject({ papel: 'professor', turmas: [{ id: a.turma, nome: '2ºB' }], disciplinas: [{ id: a.quimica, nome: 'Química' }], estado: 'ativo' })

      // O vínculo encerrado não entra: a busca mostra as turmas e as disciplinas de agora.
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em, encerrado_em, motivo_encerramento) values ($1, $2, $3, $4, 'aluno', 'encerrado', $5, now(), now(), 'realocacao')`,
        [a.escolaId, a.anoLetivoId, aluno.id, a.outraTurma, a.coordenacao.usuarioId],
      )
      const depois = await buscar(a.coordenacao, PREFIXO)
      expect((depois.corpo as { titulares: Array<Record<string, unknown>> }).titulares.find(({ id }) => id === aluno.id)).toMatchObject({
        turmas: [{ id: a.turma, nome: '2ºB' }],
      })

      // Vinte e cinco pessoas com o mesmo prefixo: a busca devolve 20, e a resposta não passa do teto do contrato.
      await bancada.sessoes(a.escolaId, { papel: 'aluno', quantidade: 25 })
      const { rows } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1', [a.escolaId])
      await Promise.all(rows.map(({ id }) => bancada.pool.query('update usuario set nome = $1 where id = $2', [nome('Aluno do lote'), id])))
      const lote = await buscar(a.coordenacao, PREFIXO)
      expect(((lote.corpo as { titulares: unknown[] }).titulares ?? []).length).toBe(20)
    })
  })

  describe('o banco recusa o que o comando deixaria passar (check, gatilho e chave única)', () => {
    it('papel, tipo, solicitante, estado, datas e autor juntos são recusados, e o titular e quem registrou têm de ser da escola', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const aluno = a.alunos[0]
      const alunoDeB = b.alunos[0]
      if (aluno === undefined || alunoDeB === undefined) throw new Error('aluno de teste não criado')
      const alunoId = aluno.id

      interface PedidoCru {
        readonly papelTitular?: string
        readonly tipo?: string
        readonly solicitante?: string
        readonly estado?: string
        readonly chegouEm?: string
        readonly concluidoEm?: string | null
        readonly concluidoPor?: string | null
        readonly canceladoEm?: string | null
        readonly canceladoPor?: string | null
        readonly eliminarEm?: string | null
        readonly eliminacaoEnfileiradaEm?: string | null
        readonly titularId?: string
        readonly registradoPor?: string
      }

      let ultimoId: string | undefined

      /** Insere o pedido cru, sem passar pelo código, e devolve `ok` ou o `code constraint` do banco. */
      async function inserir(sobrescrita: PedidoCru = {}): Promise<string> {
        const cru = {
          papelTitular: 'aluno',
          tipo: 'acesso',
          solicitante: 'titular',
          estado: 'recebido',
          chegouEm: HOJE(),
          concluidoEm: null,
          concluidoPor: null,
          canceladoEm: null,
          canceladoPor: null,
          eliminarEm: null,
          eliminacaoEnfileiradaEm: null,
          titularId: alunoId,
          registradoPor: a.coordenacao.usuarioId,
          ...sobrescrita,
        }
        return bancada.pool
          .query(
            `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio, concluido_em, concluido_por, cancelado_em, cancelado_por, eliminacao_enfileirada_em, eliminar_em)
             values ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
            [
              a.escolaId,
              cru.titularId,
              cru.papelTitular,
              cru.tipo,
              cru.solicitante,
              cru.chegouEm,
              cru.estado,
              cru.registradoPor,
              randomUUID(),
              cru.concluidoEm,
              cru.concluidoPor,
              cru.canceladoEm,
              cru.canceladoPor,
              cru.eliminacaoEnfileiradaEm,
              cru.eliminarEm,
            ],
          )
          .then(
            (gravado: { rows: Array<{ id: string }> }) => {
              ultimoId = gravado.rows[0]?.id
              return 'ok'
            },
            (erro: { code?: string; constraint?: string }) => `${String(erro.code)} ${String(erro.constraint ?? '')}`,
          )
      }

      for (const [oQue, esperado, sobrescrita] of [
        ['papel', '23514 pedido_titular_papel_valido', { papelTitular: 'coordenador' }],
        ['tipo', '23514 pedido_titular_tipo_valido', { tipo: 'apagar_tudo' }],
        ['solicitante', '23514 pedido_titular_solicitante_valido', { solicitante: 'vizinho' }],
        ['estado', '23514 pedido_titular_estado_valido', { estado: 'em_andamento' }],
        ['chegada futura', '23514 pedido_titular_chegou_em_nao_futura', { chegouEm: DEPOIS_DE_AMANHA() }],
        ['conclusão sem autor', '23514 pedido_titular_concluido_so_com_data', { concluidoEm: new Date().toISOString() }],
        ['cancelamento sem autor', '23514 pedido_titular_cancelado_so_com_data', { canceladoEm: new Date().toISOString() }],
        ['enfileirado sem agendamento', '23514 pedido_titular_enfileirado_so_agendado', { eliminacaoEnfileiradaEm: new Date().toISOString() }],
        // O estado `agendado` é só da eliminação e sempre com o instante dela (14.0): a segunda camada do registro.
        ['agendado que não é eliminação', '23514 pedido_titular_agendado_com_prazo', { estado: 'agendado', tipo: 'acesso', eliminarEm: new Date(Date.now() + 86_400_000).toISOString() }],
        ['agendado sem o instante da eliminação', '23514 pedido_titular_agendado_com_prazo', { estado: 'agendado', tipo: 'eliminacao' }],
      ] as const) {
        expect(await inserir(sobrescrita), oQue).toBe(esperado)
      }
      // Uma eliminação agendada por titular (14.0): a segunda cai no único parcial, e a cancelada não conta.
      const agendada = { estado: 'agendado', tipo: 'eliminacao', eliminarEm: new Date(Date.now() + 7 * 86_400_000).toISOString() } as const
      expect(await inserir(agendada)).toBe('ok')
      expect(await inserir(agendada)).toBe('23505 pedido_titular_agendado_unico')
      expect(await inserir({ estado: 'cancelado', tipo: 'eliminacao', eliminarEm: agendada.eliminarEm, canceladoEm: new Date().toISOString(), canceladoPor: a.coordenacao.usuarioId })).toBe('ok')
      // Quem cancelou é usuário da escola do pedido (gatilho, 14.0), na inserção e na troca do `cancelado_por`.
      expect(await inserir({ estado: 'cancelado', tipo: 'eliminacao', eliminarEm: agendada.eliminarEm, canceladoEm: new Date().toISOString(), canceladoPor: b.coordenacao.usuarioId })).toBe(
        '23503 pedido_titular_cancelado_por_da_escola_fk',
      )
      const trocaDeCancelador = await bancada.pool
        .query('update pedido_titular set cancelado_por = $1 where id = $2', [b.coordenacao.usuarioId, ultimoId])
        .then(
          () => 'ok',
          (erro: { code?: string; constraint?: string }) => `${String(erro.code)} ${String(erro.constraint ?? '')}`,
        )
      expect(trocaDeCancelador).toBe('23503 pedido_titular_cancelado_por_da_escola_fk')
      // O titular e quem registrou são conferidos pelo gatilho, que mantém o que a FK garantia: o de outra escola
      // responde o erro dela, na inserção e na troca do `registrado_por`.
      expect(await inserir({ titularId: alunoDeB.id })).toBe('23503 pedido_titular_titular_da_escola_fk')
      expect(await inserir({ registradoPor: b.coordenacao.usuarioId })).toBe('23503 pedido_titular_registrado_por_da_escola_fk')
      expect(await inserir()).toBe('ok')
      const trocaDeAutor = await bancada.pool
        .query('update pedido_titular set registrado_por = $1 where id = $2', [b.coordenacao.usuarioId, ultimoId])
        .then(
          () => 'ok',
          (erro: { code?: string; constraint?: string }) => `${String(erro.code)} ${String(erro.constraint ?? '')}`,
        )
      expect(trocaDeAutor).toBe('23503 pedido_titular_registrado_por_da_escola_fk')
    })
  })

  describe('aluno só na lista de nomes: a busca não o acha, e ele é atendido pela lista da turma', () => {
    it('a busca não acha o nome livre nem o reivindicado, e o reivindicado passa por decidir e retirar com as duas auditorias', async () => {
      const sala: SalaDeTeste = await ferramentas.montar()
      const [livre, reivindicado] = await ferramentas.nomes(sala, sala.turma, 2)
      if (livre === undefined || reivindicado === undefined) throw new Error('nome da lista não gravado')

      const achado = await buscar(sala.coordenacao, termoDe(livre.nome))
      expect(achado.status).toBe(200)
      expect(achado.corpo).toEqual({ titulares: [] })

      expect((await ferramentas.reivindicar(pedidoDaSala(sala, reivindicado))).status).toBe(200)
      const durante = await buscar(sala.coordenacao, termoDe(reivindicado.nome))
      expect(durante.corpo).toEqual({ titulares: [] })

      // A coordenação decide o pendente e retira o nome: o caminho da A1, com as duas auditorias.
      const { rows: pendentes } = await bancada.pool.query<{ id: string }>("select id from reivindicacao where escola_id = $1 and lista_nome_id = $2 and estado = 'pendente'", [sala.escolaId, reivindicado.id])
      const pedidoId = pendentes[0]?.id
      expect(pedidoId).toBeDefined()
      expect((await pedir(sala.coordenacao, 'POST', '/v1/reivindicacoes/decidir', { ids: [pedidoId], decisao: 'recusar' })).status).toBe(200)
      expect(await auditoriasDa(sala.escolaId, 'reivindicacao.decidida')).toHaveLength(1)
      expect((await pedir(sala.coordenacao, 'DELETE', `/v1/lista-nomes/${reivindicado.id}`)).status).toBe(204)
      expect(await auditoriasDa(sala.escolaId, 'lista_nome.retirado')).toHaveLength(1)
    })
  })

  describe('rate limit da busca: 30 por minuto por usuário, nunca por IP', () => {
    it('a 31ª busca do minuto responde 429 com Retry-After, e duas coordenadoras da mesma escola têm 30 cada', async () => {
      const a = await escolaComPessoas()
      const aceitas = await Promise.all(Array.from({ length: LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO }, () => buscar(a.coordenacao, PREFIXO)))
      expect(contarStatus(aceitas)).toEqual({ 200: LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO })

      const token = await a.coordenacao.tokenNovo()
      const trigésimaPrimeira = await fetch(`${api.url}/v1/privacidade/titulares/busca`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ termo: PREFIXO }),
      })
      const corpo = (await trigésimaPrimeira.json()) as { erro?: { codigo?: string } }
      expect({ status: trigésimaPrimeira.status, codigo: corpo.erro?.codigo }).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
      expect(trigésimaPrimeira.headers.get('retry-after')).not.toBeNull()

      // Duas coordenações da mesma escola, atrás do mesmo IP (a máquina do teste): 30 cada.
      const [outraCoordenacao] = await bancada.sessoes(a.escolaId, { papel: 'coordenador', quantidade: 1 })
      if (outraCoordenacao === undefined) throw new Error('coordenação de teste não criada')
      const daSegunda = await Promise.all(Array.from({ length: LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO }, () => buscar(outraCoordenacao, PREFIXO)))
      expect(contarStatus(daSegunda)).toEqual({ 200: LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO })
    })
  })

  describe('isolamento: de B não se alcança nada, e a mesma matrícula em outra escola é outro titular', () => {
    it('a prévia, a busca, o detalhe, o concluir e o corrigir de B, a partir de A, respondem como inexistente', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const alunoDeB = b.alunos[0]
      if (alunoDeB === undefined) throw new Error('aluno de teste não criado')
      const deB = await registrar(b.coordenacao, alunoDeB.id, { tipo: 'correcao' })
      expect(deB.status).toBe(201)
      const idDeB = deB.corpo['id'] as string

      expect(resposta(await previa(a.coordenacao, alunoDeB.id))).toEqual(resposta(NAO_ENCONTRADO))
      expect(await buscar(a.coordenacao, termoDe(alunoDeB.nome))).toMatchObject({ status: 200, corpo: { titulares: [] } })
      expect(resposta(await ler(a.coordenacao, idDeB))).toEqual(NAO_ENCONTRADO)
      expect(resposta(await concluir(a.coordenacao, idDeB))).toEqual(NAO_ENCONTRADO)
      expect(resposta(await corrigir(a.coordenacao, idDeB, nome('De B')))).toEqual(NAO_ENCONTRADO)
      expect((await listar(a.coordenacao)).corpo).toEqual({ itens: [] })
      expect((await listar(b.coordenacao)).status).toBe(200)
    })

    it('o homônimo não olha a escola B: aluno ativo e nome livre iguais em B não marcam o titular de A', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const mesmoNome = nome('Aluno de B')
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [mesmoNome, aluno.id])
      const [emB] = await bancada.sessoes(b.escolaId, { papel: 'aluno', quantidade: 1 })
      if (emB === undefined) throw new Error('aluno de teste não criado')
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [mesmoNome, emB.usuarioId])

      // O aluno ativo de B com o mesmo nome não é homônimo do titular de A.
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: false })
      const primeiro = await registrar(a.coordenacao, aluno.id)
      expect(primeiro.status).toBe(201)
      expect((await ler(a.coordenacao, primeiro.corpo['id'] as string)).corpo).toMatchObject({ homonimo: false })

      // O nome livre na lista de B, idem: a homonímia é da escola.
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [nome('Aluno de B outro'), emB.usuarioId])
      await bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado, criado_por) values ($1, $2, $3, $4, $5, $6, $7)', [
        b.escolaId,
        b.anoLetivoId,
        b.turma,
        mesmoNome,
        `${PREFIXO}-m-${randomUUID().slice(0, 12)}`,
        'livre',
        b.coordenacao.usuarioId,
      ])
      expect((await previa(a.coordenacao, aluno.id)).corpo).toMatchObject({ homonimo: false })
      const segundo = await registrar(a.coordenacao, aluno.id)
      expect(segundo.status).toBe(201)
      expect((await ler(a.coordenacao, segundo.corpo['id'] as string)).corpo).toMatchObject({ homonimo: false })
    })

    it('o aluno transferido tem pedidos separados em cada escola, e a mesma matrícula em outra escola é outro titular', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      // Ele foi transferido: desativado em A, e o mesmo nome e a mesma matrícula em B são de outra pessoa.
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const matricula = `${PREFIXO}-m-${randomUUID().slice(0, 12)}`
      await bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, 'hash-de-teste')", [a.escolaId, aluno.id, matricula])
      const [emB] = await bancada.sessoes(b.escolaId, { papel: 'aluno', quantidade: 1 })
      if (emB === undefined) throw new Error('aluno de teste não criado')
      await bancada.pool.query('update usuario set nome = $1 where id = $2', [aluno.nome, emB.usuarioId])
      await bancada.pool.query("insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, 'hash-de-teste')", [b.escolaId, emB.usuarioId, matricula])

      const emA = await registrar(a.coordenacao, aluno.id)
      const registradoEmB = await registrar(b.coordenacao, emB.usuarioId)
      expect(emA.status).toBe(201)
      expect(registradoEmB.status).toBe(201)
      expect(emA.corpo['id']).not.toBe(registradoEmB.corpo['id'])

      // Cada escola vê o seu: a busca de A não acha o de B, e a do B não devolve o de A.
      const achadoEmA = await buscar(a.coordenacao, termoDe(aluno.nome))
      expect((achadoEmA.corpo as { titulares: Array<{ id: string }> }).titulares.map(({ id }) => id)).toEqual([aluno.id])
      // O estado do titular vem na busca: o transferido, desativado em A, aparece como desativado.
      expect((achadoEmA.corpo as { titulares: Array<{ estado?: string }> }).titulares[0]?.estado).toBe('desativado')
      const achadoEmB = await buscar(b.coordenacao, termoDe(aluno.nome))
      expect((achadoEmB.corpo as { titulares: Array<{ id: string }> }).titulares.map(({ id }) => id)).toEqual([emB.usuarioId])
      expect(resposta(await ler(b.coordenacao, emA.corpo['id'] as string))).toEqual(NAO_ENCONTRADO)
    })
  })

  describe('virada de ano letivo: a escola sem ano em curso atende o titular (regra 40; C1 da validação)', () => {
    it('depois de encerrar o ano, a busca, o registro, a lista, o detalhe, o corrigir nome, o concluir e o cancelar respondem, só sem turma nem disciplina; e B continua sem alcançar A', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const aluno = a.alunos[0]
      const professor = a.professores[0]
      const alunoDeB = b.alunos[0]
      if (aluno === undefined || professor === undefined || alunoDeB === undefined) throw new Error('pessoa de teste não criada')
      // Com o ano em curso: a correção do professor e a eliminação agendada do aluno, para o concluir e o cancelar de depois.
      const doProfessor = await registrar(a.coordenacao, professor.id, { tipo: 'correcao' })
      const daEliminacao = await registrar(a.coordenacao, aluno.id, { tipo: 'eliminacao' })
      expect([doProfessor.status, daEliminacao.status]).toEqual([201, 201])
      const idDoProfessor = doProfessor.corpo['id'] as string
      const idDaEliminacao = daEliminacao.corpo['id'] as string
      expect(((await buscar(a.coordenacao, termoDe(professor.nome))).corpo as { titulares: Array<{ turmas: unknown[] }> }).titulares[0]?.turmas).toHaveLength(1)

      // A virada: a coordenação encerra o ano (pela API, como faz) e o seguinte ainda não abriu.
      expect((await pedir(a.coordenacao, 'POST', `/v1/anos-letivos/${a.anoLetivoId}/encerrar`)).status).toBe(200)
      const { rows: emCurso } = await bancada.pool.query('select id from ano_letivo where escola_id = $1 and situacao = $2', [a.escolaId, 'em_curso'])
      expect(emCurso).toEqual([])
      // O que o encerramento deixou de pé: um vínculo ainda `confirmado` num ano que não está em curso (montado pelo banco, como em
      // `acesso-da-turma.int.test.ts`, porque pela API o encerrar leva todos a `encerrado`). Se a leitura caísse num ano qualquer
      // quando não há ano em curso, a turma 2ºC e a disciplina apareceriam abaixo.
      for (const [usuarioId, papel, disciplinaId] of [
        [professor.id, 'professor', a.fisica],
        [aluno.id, 'aluno', null],
      ] as const) {
        await bancada.pool.query(
          `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, $6, 'confirmado', $7, now())`,
          [a.escolaId, a.anoLetivoId, usuarioId, a.outraTurma, disciplinaId, papel, a.coordenacao.usuarioId],
        )
      }

      // A busca acha as duas pessoas; sem ano em curso, a linha vem sem turma e sem disciplina, e nunca com as de um ano qualquer.
      const doProfessorAchado = await buscar(a.coordenacao, termoDe(professor.nome))
      expect(doProfessorAchado.status).toBe(200)
      expect(doProfessorAchado.corpo).toMatchObject({ titulares: [{ id: professor.id, nome: professor.nome, turmas: [], disciplinas: [] }] })
      const doAlunoAchado = await buscar(a.coordenacao, termoDe(aluno.nome))
      expect(doAlunoAchado.status).toBe(200)
      expect(doAlunoAchado.corpo).toMatchObject({ titulares: [{ id: aluno.id, nome: aluno.nome, turmas: [], disciplinas: [] }] })

      // O registro grava, devolve o pedido com o nome do titular e sem turma, e não desfaz a transação.
      const novo = await registrar(a.coordenacao, aluno.id, { tipo: 'compartilhamento' })
      expect(novo.status).toBe(201)
      expect(novo.corpo).toMatchObject({ titular: { nome: aluno.nome, turmas: [] } })
      const idDoNovo = novo.corpo['id'] as string
      expect((await pedidosNoBanco(a.escolaId)).map((linha) => linha['id'])).toContain(idDoNovo)

      // A lista e o detalhe mostram os pedidos com o nome, sem 404.
      const lista = await listar(a.coordenacao)
      expect(lista.status).toBe(200)
      const itens = (lista.corpo as { itens: Array<{ id: string; titular: { nome: string } | null }> }).itens
      expect(itens.map(({ id }) => id).sort()).toEqual([idDoProfessor, idDaEliminacao, idDoNovo].sort())
      expect(itens.find(({ id }) => id === idDoProfessor)?.titular?.nome).toBe(professor.nome)
      const detalhe = await ler(a.coordenacao, idDaEliminacao)
      expect(detalhe.status).toBe(200)
      expect(detalhe.corpo).toMatchObject({ id: idDaEliminacao, estado: 'agendado', titular: { nome: aluno.nome, turmas: [] } })

      // O corrigir nome e o concluir do professor, e o cancelar da eliminação dentro dos 7 dias: o que o ano encerrado não pode tirar.
      const corrigido = nome('Professora corrigida na virada')
      expect(resposta(await corrigir(a.coordenacao, idDoProfessor, corrigido))).toEqual({ status: 204, corpo: {} })
      expect(resposta(await concluir(a.coordenacao, idDoProfessor))).toEqual({ status: 204, corpo: {} })
      expect(resposta(await pedir(a.coordenacao, 'POST', `/v1/privacidade/pedidos/${idDaEliminacao}/cancelar`, {}))).toEqual({ status: 204, corpo: {} })
      expect((await ler(a.coordenacao, idDaEliminacao)).corpo).toMatchObject({ estado: 'cancelado' })
      // A auditoria de cada passo ficou gravada: sem ano em curso a resposta não cai, e a transação, com a auditoria dentro, não se desfaz.
      expect(await auditoriasDa(a.escolaId, 'pedido.registrado')).toHaveLength(3)
      expect(await auditoriasDa(a.escolaId, 'pedido.nome_corrigido')).toHaveLength(1)
      expect(await auditoriasDa(a.escolaId, 'pedido.concluido')).toHaveLength(1)
      expect(await auditoriasDa(a.escolaId, 'pedido.cancelado')).toHaveLength(1)

      // O isolamento não afrouxa: a escola B, com o ano dela em curso, não alcança o pedido de A, e A não alcança o de B.
      const deB = await registrar(b.coordenacao, alunoDeB.id)
      expect(deB.status).toBe(201)
      expect(resposta(await ler(b.coordenacao, idDaEliminacao))).toEqual(NAO_ENCONTRADO)
      expect(resposta(await ler(a.coordenacao, deB.corpo['id'] as string))).toEqual(NAO_ENCONTRADO)
      // A busca de A, sem ano em curso, também não acha a pessoa de B: o escopo da escola vale na leitura que a correção mexeu.
      expect(await buscar(a.coordenacao, termoDe(alunoDeB.nome))).toMatchObject({ status: 200, corpo: { titulares: [] } })
    })
  })

  describe('concorrência (regra 80, item 7)', () => {
    it('[P] a mesma chave de envio duas vezes ao mesmo tempo grava um pedido só, e as duas chamadas devolvem o mesmo', async () => {
      const a = await escolaComPessoas()
      const aluno = a.alunos[0]
      if (aluno === undefined) throw new Error('aluno de teste não criado')
      const chaveEnvio = randomUUID()
      const [primeira, segunda] = await Promise.all([registrar(a.coordenacao, aluno.id, { chaveEnvio }), registrar(a.coordenacao, aluno.id, { chaveEnvio })])
      expect(primeira.status).toBe(201)
      expect(segunda.status).toBe(201)
      expect(segunda.corpo['id']).toBe(primeira.corpo['id'])
      expect(await pedidosNoBanco(a.escolaId)).toHaveLength(1)
      expect(await auditoriasDa(a.escolaId, 'pedido.registrado')).toHaveLength(1)
      // O pedido de acesso enfileira o job do arquivo uma vez só: o reenvio simultâneo não grava um segundo (regra 80, item 7).
      const { rows: jobs } = await bancada.pool.query<{ total: number }>(
        `select count(*)::int as total from job_registro where escola_id = $1 and tipo = 'titular.montar-arquivo'`,
        [a.escolaId],
      )
      expect(jobs[0]?.total).toBe(1)
    })

    it('a chave de envio devolve só o pedido que é este mesmo: o de quem pediu, do mesmo titular, tipo, solicitante e chegada', async () => {
      const a = await escolaComPessoas()
      const b = await escolaComPessoas()
      const [primeiro, segundo] = a.alunos
      if (primeiro === undefined || segundo === undefined) throw new Error('aluno de teste não criado')

      // (a) a mesma chave com outro titular responde como inexistente, e nada muda nem é auditado.
      const chaveEnvio = randomUUID()
      const criado = await registrar(a.coordenacao, primeiro.id, { chaveEnvio })
      expect(criado.status).toBe(201)
      const comOutroTitular = await registrar(a.coordenacao, segundo.id, { chaveEnvio })
      expect(resposta(comOutroTitular)).toEqual(resposta(NAO_ENCONTRADO))
      expect(JSON.stringify(comOutroTitular.corpo)).not.toContain(primeiro.nome)
      expect(await pedidosNoBanco(a.escolaId)).toHaveLength(1)
      expect(await auditoriasDa(a.escolaId, 'pedido.registrado')).toHaveLength(1)

      // (a2) a mesma chave e o mesmo titular, mudando um campo por vez: tipo, solicitante e chegada.
      const outroTipo = await registrar(a.coordenacao, primeiro.id, { chaveEnvio, tipo: 'correcao' })
      const outroSolicitante = await registrar(a.coordenacao, primeiro.id, { chaveEnvio, solicitante: 'responsavel_legal' })
      const outraChegada = await registrar(a.coordenacao, primeiro.id, { chaveEnvio, chegouEm: diaDeUso(new Date(Date.now() - 86_400_000)) })
      for (const [quem, resultado] of [['tipo', outroTipo], ['solicitante', outroSolicitante], ['chegada', outraChegada]] as const) {
        expect(resposta(resultado), quem).toEqual(resposta(NAO_ENCONTRADO))
        expect(JSON.stringify(resultado.corpo), quem).not.toContain(primeiro.nome)
      }
      expect(await pedidosNoBanco(a.escolaId)).toHaveLength(1)
      expect(await auditoriasDa(a.escolaId, 'pedido.registrado')).toHaveLength(1)

      // (b) a chave registrada por outra coordenação da mesma escola não devolve o pedido dela, mesmo sendo do mesmo
      // titular, tipo, solicitante e chegada: é a cláusula do `registrado_por` que a barra.
      const [outraCoordenacao] = await bancada.sessoes(a.escolaId, { papel: 'coordenador', quantidade: 1 })
      if (outraCoordenacao === undefined) throw new Error('coordenação de teste não criada')
      const chaveDaOutra = randomUUID()
      const daOutra = await registrar(outraCoordenacao, segundo.id, { chaveEnvio: chaveDaOutra })
      expect(daOutra.status).toBe(201)
      expect(resposta(await registrar(a.coordenacao, segundo.id, { chaveEnvio: chaveDaOutra }))).toEqual(resposta(NAO_ENCONTRADO))
      expect(await auditoriasDa(a.escolaId, 'pedido.registrado')).toHaveLength(2)

      // (c) a chave já usada em B é de outra escola: as duas chamadas de A devolvem o mesmo pedido de A, e não o de B.
      const chaveDeB = randomUUID()
      const { rows: doB } = await bancada.pool.query<{ id: string }>(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'acesso', 'titular', $3, 'recebido', '[]'::jsonb, $4, $5) returning id`,
        [b.escolaId, b.alunos[0]?.id ?? randomUUID(), HOJE(), b.coordenacao.usuarioId, chaveDeB],
      )
      const primeiraDeA = await registrar(a.coordenacao, primeiro.id, { chaveEnvio: chaveDeB })
      const segundaDeA = await registrar(a.coordenacao, primeiro.id, { chaveEnvio: chaveDeB })
      expect(primeiraDeA.status).toBe(201)
      expect(segundaDeA.status).toBe(201)
      expect(segundaDeA.corpo['id']).toBe(primeiraDeA.corpo['id'])
      expect(primeiraDeA.corpo['id']).not.toBe(doB[0]?.id)
    })

    it('[P] o clique duplo em concluir decide no banco: uma só conclusão, uma auditoria, e nenhuma resposta 500', async () => {
      const a = await escolaComPessoas()
      const criado = await registrar(a.coordenacao, a.alunos[0]?.id ?? randomUUID())
      expect(criado.status).toBe(201)
      const id = criado.corpo['id'] as string

      // A ordem é forçada: a primeira chamada para depois do `update`, dentro da transação, e a segunda espera na trava dela.
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'pedido_titular', evento: 'update', quando: `new.id = '${id}'::uuid` })
      await gatilho.armar()
      let primeira: RespostaHttp | undefined
      let segunda: RespostaHttp | undefined
      try {
        const promessaPrimeira = concluir(a.coordenacao, id)
        await gatilho.esperarParadas()
        const promessaSegunda = concluir(a.coordenacao, id)
        await esperarNaTrava(bancada.pool, '%update pedido_titular p%')
        await gatilho.soltar()
        primeira = await promessaPrimeira
        segunda = await promessaSegunda
      } finally {
        await gatilho.desarmar()
      }
      expect([primeira?.status, segunda?.status]).toEqual([204, 409])
      expect([primeira, segunda].map((resposta) => resposta?.status)).not.toContain(500)
      expect(segunda?.corpo.erro?.codigo).toBe(ErrorCode.PEDIDO_EM_ESTADO_INVALIDO)
      expect(await auditoriasDa(a.escolaId, 'pedido.concluido')).toHaveLength(1)
    })
  })
})
