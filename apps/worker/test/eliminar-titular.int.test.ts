import 'reflect-metadata'
import {
  InMemoryFileStorage,
  ArquivoDoTitularRepository,
  OperationalSettings,
  OperationalSettingsRepository,
  EliminacaoDoTitularRepository,
  runInContext,
  ExpurgoDaEscolaRepository,
  haHomonimoDoTitular,
  padraoDoNome,
  JobRequestRejectedError,
  resolverJanela,
  RetencaoDaEscolaRepository,
  TrocaDeNome,
  type JanelaLetiva,
  type Clock,
  type DatabaseTransaction,
} from '@educa/nucleo'
import { AUTOR_DA_ROTINA, TIPO_ELIMINAR_TITULAR } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import type { ConfiguracaoStorage } from '../src/config.js'
import { montarWorker } from '../src/montagem.js'
import { criarEliminacaoDoTitular } from '../src/processadores/eliminar-titular.js'
import { criarExpurgoDaEscola } from '../src/processadores/expurgar-escola.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'
import { execucaoDoJob } from './execucao-do-job.js'

// O job `titular.eliminar` (F3, tarefa 15.0; Tech Spec do F3, seção 5, "Eliminação") contra o Postgres do compose de teste:
// o prazo, a troca do nome completo em faixas (cada coluna, a caixa, a fronteira de palavra, o JSON válido), o homônimo, o
// professor, a janela letiva entre as faixas, a etapa 3 inteira numa transação, o autor (a coordenação ativa ou a rotina) e o
// que fica depois. A escola usa o horário letivo padrão (São Paulo, de segunda a sexta, das 7h às 18h): quarta, 7/10/2026, à
// 1h está fora da janela, e às 8h, dentro.

const ambiente = lerAmbienteDeTeste()
const STORAGE: ConfiguracaoStorage = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}

const QUARTA_1H = new Date('2026-10-07T01:00:00-03:00')
const QUARTA_8H = new Date('2026-10-07T08:00:00-03:00')

const NOME = "Joana d'Ávila Müller"
const REMOVIDO = '[nome removido]'
const NOME_DA_PROFESSORA = 'Professora sintética da eliminação'

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar o pedido com o do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

/** Um relógio que o teste avança. */
function relogioEm(inicio: Date): Clock & { atual: Date } {
  const relogio = { atual: inicio, agora: () => relogio.atual }
  return relogio
}

/** Um relógio fora da janela nas primeiras `chamadas` leituras e dentro dela depois: a janela abre no meio da troca. */
function relogioQueAbreDepoisDe(chamadas: number): Clock {
  let lidas = 0
  return {
    agora: () => {
      lidas += 1
      return lidas <= chamadas ? QUARTA_1H : QUARTA_8H
    },
  }
}

describe('titular.eliminar', () => {
  const bancada = new BancadaDeFila()
  const log = new LogEmMemoria('worker-teste')
  const escolas: string[] = []

  afterAll(async () => {
    await bancada.pool.query('delete from job_registro where escola_id = any($1::uuid[])', [escolas])
    await bancada.fechar()
  })

  interface Cenario {
    escolaId: string
    anoId: string
    turmaId: string
    disciplinaId: string
    coordenadoraId: string
    professorId: string
    alunoId: string
    nome: string
  }

  async function um(texto: string, valores: unknown[]): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(texto, valores)
    const id = rows[0]?.id
    if (id === undefined) throw new Error('linha de teste não criada')
    return id
  }

  async function pessoaDaEquipe(escolaId: string, papel: 'coordenador' | 'professor', nome: string): Promise<string> {
    const contaId = await um('insert into conta (email) values ($1) returning id', [`${papel}-${randomUUID()}@eliminar.invalid`])
    return um('insert into usuario (escola_id, papel, nome, conta_id) values ($1, $2, $3, $4) returning id', [escolaId, papel, nome, contaId])
  }

  /** Uma escola nova, com ano em curso, turma, disciplina, coordenação, professor e o aluno com o `nome` dado. */
  async function cenario(nome = NOME): Promise<Cenario> {
    const escolaId = await bancada.escola()
    escolas.push(escolaId)
    const anoId = await um("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await um("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const turmaId = await um("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB sintética') returning id", [escolaId, anoId, serieId])
    const disciplinaId = await um("insert into disciplina (escola_id, nome) values ($1, 'Matemática') returning id", [escolaId])
    const coordenadoraId = await pessoaDaEquipe(escolaId, 'coordenador', 'Coordenação sintética da eliminação')
    const professorId = await pessoaDaEquipe(escolaId, 'professor', NOME_DA_PROFESSORA)
    const alunoId = await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [escolaId, nome])
    return { escolaId, anoId, turmaId, disciplinaId, coordenadoraId, professorId, alunoId, nome }
  }

  /** O pedido de eliminação `agendado` do titular, como o registro o grava (14.0), já vencido (a menos que `eliminarEm` diga outro). */
  async function agendar(
    c: Cenario,
    titularId: string,
    opcoes: { papel?: 'aluno' | 'professor'; registradoPor?: string; eliminarEm?: string } = {},
  ): Promise<string> {
    const pedidoId = await um(
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio)
       values ($1, $2, $3, 'eliminacao', 'titular', current_date, 'agendado', ${opcoes.eliminarEm ?? "now() - interval '1 hour'"}, '[]'::jsonb, $4, $5) returning id`,
      [c.escolaId, titularId, opcoes.papel ?? 'aluno', opcoes.registradoPor ?? c.coordenadoraId, randomUUID()],
    )
    await bancada.pool.query("update usuario set eliminacao_agendada_em = now() - interval '8 days' where id = $1", [titularId])
    return pedidoId
  }

  async function janelaDaEscola(): Promise<OperationalSettings<JanelaLetiva>> {
    return new OperationalSettings<JanelaLetiva>(new OperationalSettingsRepository(bancada.banco), (linha) => resolverJanela(janelaPadraoDoAmbiente(), linha))
  }

  /** Roda o processador `titular.eliminar` na escola dada, com o relógio, a faixa e os dados. */
  async function rodar(escolaId: string | undefined, dados: { pedidoId: string }, opcoes: { relogio?: Clock; faixa?: number } = {}): Promise<void> {
    const processador = criarEliminacaoDoTitular({
      banco: bancada.banco,
      janelaDaEscola: await janelaDaEscola(),
      relogio: opcoes.relogio ?? relogioEm(QUARTA_1H),
      logger: log.logger,
      ...(opcoes.faixa === undefined ? {} : { faixa: opcoes.faixa }),
    })
    const jobId = randomUUID()
    const executar = () => processador(dados, execucaoDoJob(jobId))
    return escolaId === undefined ? executar() : runInContext({ requisicaoId: randomUUID(), escolaId }, executar)
  }

  async function existeUsuario(id: string): Promise<boolean> {
    return (await bancada.pool.query('select 1 from usuario where id = $1', [id])).rowCount === 1
  }

  async function pedido(pedidoId: string): Promise<{
    estado: string
    concluidoPor: string | null
    registradoPor: string
    nomeTrocado: boolean | null
    homonimo: boolean | null
    compartilhamento: Array<Record<string, unknown>>
  }> {
    const { rows } = await bancada.pool.query<{
      estado: string
      concluidoPor: string | null
      registradoPor: string
      nomeTrocado: boolean | null
      homonimo: boolean | null
      compartilhamento: Array<Record<string, unknown>>
    }>(
      `select estado, concluido_por as "concluidoPor", registrado_por as "registradoPor", nome_trocado as "nomeTrocado", homonimo, compartilhamento from pedido_titular where id = $1`,
      [pedidoId],
    )
    const linha = rows[0]
    if (linha === undefined) throw new Error('pedido não encontrado')
    return linha
  }

  interface LinhaDeAuditoria {
    acao: string
    entidadeId: string | null
    autorUsuarioId: string | null
    autorOperador: string | null
    depois: Record<string, unknown> | null
  }

  async function auditoria(escolaId: string, acao: string): Promise<LinhaDeAuditoria[]> {
    const { rows } = await bancada.pool.query<LinhaDeAuditoria>(
      `select acao, entidade_id as "entidadeId", autor_usuario_id as "autorUsuarioId", autor_operador as "autorOperador", depois from auditoria where escola_id = $1 and acao = $2 order by em, id`,
      [escolaId, acao],
    )
    return rows
  }

  // ---- Fixtures de texto livre ------------------------------------------------------------------------------------------

  async function execucaoDoProfessor(c: Cenario, entrada: unknown): Promise<string> {
    return um(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $3, $4, $5) returning id`,
      [c.escolaId, c.anoId, c.professorId, randomUUID(), JSON.stringify(entrada)],
    )
  }

  async function consumoDa(c: Cenario, execucaoId: string, entrada: unknown, saida: unknown): Promise<string> {
    return um(
      `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, custo_micros, duracao_ms, envio_externo, tentativas, estado, entrada, saida)
       values ($1, null, $2, 'gerar_plano_de_aula', 'conversa_e_ferramentas', 'padrao', 'falso', 'modelo-falso', 'v1', 120, 80, 7, 900, false, 1, 'concluida', $3, $4) returning id`,
      [c.escolaId, execucaoId, entrada === null ? null : JSON.stringify(entrada), saida === null ? null : JSON.stringify(saida)],
    )
  }

  async function artefatoDe(c: Cenario, titulo: string, conteudo: unknown): Promise<string> {
    return um(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'plano_de_aula', $5, $6, $7) returning id`,
      [c.escolaId, c.anoId, c.turmaId, c.disciplinaId, titulo, JSON.stringify(conteudo), c.professorId],
    )
  }

  async function mensagemDoProfessor(c: Cenario, conteudo: unknown): Promise<string> {
    const threadId = await um("insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id", [c.escolaId, c.anoId, c.professorId])
    const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula' })
    return um(
      `insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo) values ($1, $2, $3, $4, 'agente', $5) returning id`,
      [c.escolaId, c.anoId, threadId, execucaoId, JSON.stringify(conteudo)],
    )
  }

  /** Uma versão adaptada rejeitada, com a justificativa do professor: é a que a troca de nome alcança em `entrega`. */
  async function entregaRejeitada(c: Cenario, justificativa: string): Promise<string> {
    const artefatoId = await artefatoDe(c, 'Versão adaptada sintética', { tipo: 'plano_de_aula', titulo: 'Versão adaptada sintética' })
    return um(
      `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id, estado, decidida_por, decidida_em, justificativa)
       values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4, 'rejeitada', $5, now(), $6) returning id`,
      [c.escolaId, c.anoId, c.turmaId, artefatoId, c.professorId, justificativa],
    )
  }

  async function texto(tabela: string, coluna: string, id: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ t: string | null }>(`select ${coluna}::text as t from ${tabela} where id = $1`, [id])
    return rows[0]?.t ?? ''
  }

  // ---- A expressão do nome, no próprio Postgres --------------------------------------------------------------------------

  describe('a expressão do nome', () => {
    async function trocarNoJsonb(nome: string, documento: unknown): Promise<unknown> {
      const { rows } = await bancada.pool.query<{ r: unknown }>(`select regexp_replace($1::jsonb::text, $2, $3, 'g')::jsonb as r`, [JSON.stringify(documento), padraoDoNome(nome, 'jsonb'), REMOVIDO])
      return rows[0]?.r
    }

    it('nome com aspas, barra invertida, colchetes, ponto e outros metacaracteres vira o `[nome removido]` e o documento continua JSON válido', async () => {
      const nome = 'Zé "Zeca" O\'Neil \\ (Jr.) [A]+ {x} ^$ |'
      const trocado = await trocarNoJsonb(nome, { tema: `antes ${nome} depois`, outro: 'sem relação' })
      expect(trocado).toEqual({ tema: `antes ${REMOVIDO} depois`, outro: 'sem relação' })
    })

    it('a chave do documento que é o nome fica, e o valor é trocado: o formato do JSON não é mexido', async () => {
      const trocado = await trocarNoJsonb('Joana Silva', { 'Joana Silva': 'Joana Silva', lista: ['joana silva'] })
      expect(trocado).toEqual({ 'Joana Silva': REMOVIDO, lista: [REMOVIDO] })
    })

    it('o nome logo depois de uma quebra de linha do JSON (`\\n`) é trocado, e o nome dentro de outra palavra não', async () => {
      const trocado = await trocarNoJsonb('Ana Souza', { texto: 'Linha.\nAna Souza foi bem.\tAna Souza', outra: 'Mariana Souza e Ana Souzaldo' })
      expect(trocado).toEqual({ texto: `Linha.\n${REMOVIDO} foi bem.\t${REMOVIDO}`, outra: 'Mariana Souza e Ana Souzaldo' })
    })
  })

  // ---- O prazo e o que não tem efeito ------------------------------------------------------------------------------------

  describe('o prazo e o pedido que não se elimina', () => {
    it('antes do 8º dia nada acontece: a pessoa fica, o pedido continua `agendado` e o texto não é trocado', async () => {
      const c = await cenario()
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId, { eliminarEm: "now() + interval '1 hour'" })
      await rodar(c.escolaId, { pedidoId })
      expect(await existeUsuario(c.alunoId)).toBe(true)
      expect((await pedido(pedidoId)).estado).toBe('agendado')
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(c.nome)
      expect(log.linhas.some((linha) => linha.includes('"status":"sem_efeito"'))).toBe(true)
    })

    it('o pedido cancelado e o concluído não são eliminados', async () => {
      const c = await cenario()
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      await bancada.pool.query("update pedido_titular set estado = 'cancelado', cancelado_em = now(), cancelado_por = registrado_por where id = $1", [pedidoId])
      await rodar(c.escolaId, { pedidoId })
      expect(await existeUsuario(c.alunoId)).toBe(true)
      expect((await pedido(pedidoId)).estado).toBe('cancelado')
      // A troca de nome nem começa: o texto continua com o nome.
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(c.nome)

      const d = await cenario()
      const outraExecucaoId = await execucaoDoProfessor(d, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${d.nome}` } })
      const concluidoId = await agendar(d, d.alunoId)
      await bancada.pool.query("update pedido_titular set estado = 'concluido', concluido_em = now(), concluido_por = registrado_por where id = $1", [concluidoId])
      await rodar(d.escolaId, { pedidoId: concluidoId })
      expect(await existeUsuario(d.alunoId)).toBe(true)
      expect(await texto('execucao_agente', 'entrada', outraExecucaoId)).toContain(d.nome)
    })

    it('o pedido de outra escola não é alcançado: o job da escola B com o id do pedido da A não muda nada', async () => {
      const a = await cenario()
      const b = await cenario()
      const execucaoId = await execucaoDoProfessor(a, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${a.nome}` } })
      const pedidoId = await agendar(a, a.alunoId)
      await rodar(b.escolaId, { pedidoId })
      expect(await existeUsuario(a.alunoId)).toBe(true)
      expect((await pedido(pedidoId)).estado).toBe('agendado')
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(a.nome)
      for (const acao of ['titular.nome_trocado', 'pedido.concluido', 'usuario.eliminado']) {
        expect(await auditoria(a.escolaId, acao)).toEqual([])
        expect(await auditoria(b.escolaId, acao)).toEqual([])
      }
    })

    it('sem escola no contexto o processador não elimina ninguém: a escola vem do contexto, nunca dos dados', async () => {
      const c = await cenario()
      const pedidoId = await agendar(c, c.alunoId)
      await expect(rodar(undefined, { pedidoId })).rejects.toThrow('sem escola no contexto')
      expect(await existeUsuario(c.alunoId)).toBe(true)
      expect((await pedido(pedidoId)).estado).toBe('agendado')
    })
  })

  // ---- A troca do nome -------------------------------------------------------------------------------------------------

  describe('a troca do nome completo', () => {
    it('o nome sai de cada coluna de texto livre (a caixa, o acento e o apóstrofo não importam), a auditoria assina por linha e a outra escola não é tocada', async () => {
      const c = await cenario()
      const outra = await cenario()
      const maiusculas = c.nome.toUpperCase()
      const minusculas = c.nome.toLowerCase()

      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço de frações para ${c.nome} na semana` } })
      const consumoId = await consumoDa(c, execucaoId, { tema: `Plano para ${maiusculas}` }, { texto: `Plano de aula de ${minusculas}.\nContinua` })
      const artefatoId = await artefatoDe(c, `Plano para ${c.nome}`, { tipo: 'plano_de_aula', titulo: `Plano para ${c.nome}`, secoes: [{ texto: `Anterior.\n${c.nome} foi bem.` }] })
      const mensagemId = await mensagemDoProfessor(c, { tipo: 'texto', texto: `Prepare a prova do ${maiusculas}` })
      const entregaId = await entregaRejeitada(c, `${c.nome} não precisa desta adaptação`)

      // O que é parecido e não é o nome: o primeiro nome só, e o nome de outra pessoa.
      const parecidaId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: 'Joana e a turma; Marina d\'Ávila Müller' } })
      const deOutraEscolaId = await execucaoDoProfessor(outra, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const artefatoDeOutraId = await artefatoDe(outra, `Plano para ${c.nome}`, { tipo: 'plano_de_aula', titulo: `Plano para ${c.nome}` })

      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })

      for (const [tabela, coluna, id] of [
        ['execucao_agente', 'entrada', execucaoId],
        ['consumo_ia', 'entrada', consumoId],
        ['consumo_ia', 'saida', consumoId],
        ['artefato', 'titulo', artefatoId],
        ['artefato', 'conteudo', artefatoId],
        ['mensagem_agente', 'conteudo', mensagemId],
        ['entrega', 'justificativa', entregaId],
      ] as const) {
        const depois = await texto(tabela, coluna, id)
        expect(depois, `${tabela}.${coluna}`).toContain(REMOVIDO)
        expect(depois.toLowerCase(), `${tabela}.${coluna}`).not.toContain(c.nome.toLowerCase())
      }
      // O resto do texto fica, e o documento continua com a mesma forma.
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain('Reforço de frações para')
      expect(JSON.parse(await texto('artefato', 'conteudo', artefatoId))).toMatchObject({ tipo: 'plano_de_aula', titulo: `Plano para ${REMOVIDO}`, secoes: [{ texto: `Anterior.\n${REMOVIDO} foi bem.` }] })
      expect(await texto('entrega', 'justificativa', entregaId)).toBe(`${REMOVIDO} não precisa desta adaptação`)
      // Não é o nome completo: fica.
      expect(await texto('execucao_agente', 'entrada', parecidaId)).toContain('Joana e a turma')
      expect(await texto('execucao_agente', 'entrada', parecidaId)).toContain("Marina d'Ávila Müller")
      expect(await texto('execucao_agente', 'entrada', parecidaId)).not.toContain(REMOVIDO)
      // A outra escola tem o mesmo texto e não é tocada.
      expect(await texto('execucao_agente', 'entrada', deOutraEscolaId)).toContain(c.nome)
      expect(await texto('artefato', 'titulo', artefatoDeOutraId)).toBe(`Plano para ${c.nome}`)
      expect((await auditoria(outra.escolaId, 'titular.nome_trocado')).length).toBe(0)

      // Uma entrada de auditoria por linha de execução, consumo, artefato e entrega alterada, assinada pela coordenação que pediu.
      const trocas = await auditoria(c.escolaId, 'titular.nome_trocado')
      const porId = new Map(trocas.map((linha) => [linha.entidadeId, linha]))
      expect([...porId.keys()].sort()).toEqual([execucaoId, consumoId, artefatoId, entregaId].sort())
      expect(trocas).toHaveLength(4)
      for (const linha of trocas) {
        expect(linha.autorUsuarioId).toBe(c.coordenadoraId)
        expect(linha.autorOperador).toBeNull()
      }
      expect(porId.get(execucaoId)?.depois).toEqual({ tabela: 'execucao_agente', pedidoId })
      expect(porId.get(consumoId)?.depois).toEqual({ tabela: 'consumo_ia', pedidoId })
      expect(porId.get(artefatoId)?.depois).toEqual({ tabela: 'artefato', pedidoId })
      expect(porId.get(entregaId)?.depois).toEqual({ tabela: 'entrega', pedidoId })
      // A conversa do professor é trocada sem uma linha de auditoria por mensagem.
      expect(porId.has(mensagemId)).toBe(false)
    })

    it('o nome curto que alonga o texto além do limite da coluna é cortado nele, em vez de o check derrubar a eliminação', async () => {
      const c = await cenario('Ana Lu')
      const titulo = `${'t'.repeat(150)} Ana Lu`
      const artefatoId = await artefatoDe(c, titulo, { tipo: 'plano_de_aula', titulo })
      const entregaId = await entregaRejeitada(c, `${'j'.repeat(490)} Ana Lu`)
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      const tituloDepois = await texto('artefato', 'titulo', artefatoId)
      expect(tituloDepois).toHaveLength(160)
      expect(tituloDepois.startsWith('t'.repeat(150))).toBe(true)
      expect(await texto('entrega', 'justificativa', entregaId)).toHaveLength(500)
    })

    it('nome em branco não troca nada: o padrão sem letra casaria em todo lugar', async () => {
      const c = await cenario()
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const resultado = await runInContext({ requisicaoId: randomUUID(), escolaId: c.escolaId, usuarioId: c.coordenadoraId }, () =>
        new TrocaDeNome(bancada.banco).trocar({ pedidoId: randomUUID(), nome: '   ', autoria: {}, janelaAberta: () => false }),
      )
      expect(resultado).toEqual({ concluida: true, linhas: 0 })
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(c.nome)
    })

    it('o nome dentro de outra palavra fica, e o nome no fim da frase, separado por vírgula ou com espaço duplo é trocado', async () => {
      const c = await cenario('Ana Souza')
      const execucaoId = await execucaoDoProfessor(c, {
        tarefa: 'gerar_plano_de_aula',
        parametros: { tema: 'Mariana Souza | Ana Souzaldo | Ana | ana  souza, | Ana Souza. | (ANA SOUZA)' },
      })
      await rodar(c.escolaId, { pedidoId: await agendar(c, c.alunoId) })
      const entrada = JSON.parse(await texto('execucao_agente', 'entrada', execucaoId)) as { parametros: { tema: string } }
      expect(entrada.parametros.tema).toBe(`Mariana Souza | Ana Souzaldo | Ana | ${REMOVIDO}, | ${REMOVIDO}. | (${REMOVIDO})`)
    })

    it('a fronteira de palavra vale também nas colunas de texto (título do artefato e justificativa da entrega), antes e depois do nome', async () => {
      const c = await cenario('Ana Souza')
      const titulo = 'Mariana Souza | Ana Souzaldo | Ana Souza'
      const artefatoId = await artefatoDe(c, titulo, { tipo: 'plano_de_aula', titulo })
      const entregaId = await entregaRejeitada(c, 'Mariana Souza | Ana Souzaldo | Ana Souza')
      await rodar(c.escolaId, { pedidoId: await agendar(c, c.alunoId) })
      expect(await texto('artefato', 'titulo', artefatoId)).toBe(`Mariana Souza | Ana Souzaldo | ${REMOVIDO}`)
      expect(await texto('entrega', 'justificativa', entregaId)).toBe(`Mariana Souza | Ana Souzaldo | ${REMOVIDO}`)
    })

    it('mais de mil linhas examinadas passam por mais de uma faixa, e a de depois da primeira faixa também é trocada', async () => {
      const c = await cenario()
      const tema = JSON.stringify({ tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      await bancada.pool.query(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         select $1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $3, gen_random_uuid(), $4::jsonb from generate_series(1, 1001)`,
        [c.escolaId, c.anoId, c.professorId, tema],
      )
      await rodar(c.escolaId, { pedidoId: await agendar(c, c.alunoId) })
      const { rows } = await bancada.pool.query<{ total: string; comNome: string }>(
        `select count(*)::text as total, count(*) filter (where entrada::text like '%' || $2 || '%')::text as "comNome" from execucao_agente where escola_id = $1 and solicitada_por is not null`,
        [c.escolaId, c.nome],
      )
      // As execuções ficam (a anonimização é só das que o titular pediu); o nome saiu de todas, nas duas faixas.
      expect(rows[0]).toEqual({ total: '1001', comNome: '0' })
      expect((await auditoria(c.escolaId, 'titular.nome_trocado')).length).toBe(1001)
    })

    it('linhas grandes (1.000 de ~60 KB) passam do orçamento da faixa e a troca termina dentro do statement_timeout de 2 s do pool, em várias faixas', async () => {
      const c = await cenario()
      await bancada.pool.query(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         select $1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $3, gen_random_uuid(),
                jsonb_build_object('tarefa', 'gerar_plano_de_aula', 'parametros', jsonb_build_object('tema', repeat('Trecho sintético do material da aula. ', 1700) || $4::text))
         from generate_series(1, 1000)`,
        [c.escolaId, c.anoId, c.professorId, `Reforço para ${c.nome}`],
      )
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      const { rows } = await bancada.pool.query<{ total: string; comNome: string }>(
        `select count(*)::text as total, count(*) filter (where entrada::text like '%' || $2 || '%')::text as "comNome" from execucao_agente where escola_id = $1 and solicitada_por is not null`,
        [c.escolaId, c.nome],
      )
      expect(rows[0]).toEqual({ total: '1000', comNome: '0' })
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect((await auditoria(c.escolaId, 'titular.nome_trocado')).length).toBe(1000)
      expect(await existeUsuario(c.alunoId)).toBe(false)
    })

    it('a linha sozinha acima do orçamento da faixa entra sozinha, e a troca segue para as linhas seguintes: nenhuma fica com o nome e o pedido conclui', async () => {
      const c = await cenario()
      // A linha grande tem o menor `id` da escola: é a primeira da faixa, e sozinha (~4,9 MB) já passa do orçamento de 4 MB.
      const [grande, ...pequenas] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()].sort()
      await bancada.pool.query(
        `insert into execucao_agente (id, escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         values ($1, $2, $3, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $4, gen_random_uuid(),
                 jsonb_build_object('tarefa', 'gerar_plano_de_aula', 'parametros', jsonb_build_object('tema', repeat('Trecho sintético do material da aula. ', 125000) || $5::text)))`,
        [grande, c.escolaId, c.anoId, c.professorId, `Reforço para ${c.nome}`],
      )
      for (const id of pequenas) {
        await bancada.pool.query(
          `insert into execucao_agente (id, escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
           values ($1, $2, $3, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $4, gen_random_uuid(), $5::jsonb)`,
          [id, c.escolaId, c.anoId, c.professorId, JSON.stringify({ tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })],
        )
      }
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      const { rows } = await bancada.pool.query<{ total: string; comNome: string }>(
        `select count(*)::text as total, count(*) filter (where entrada::text like '%' || $2 || '%')::text as "comNome" from execucao_agente where escola_id = $1 and solicitada_por is not null`,
        [c.escolaId, c.nome],
      )
      expect(rows[0]).toEqual({ total: '4', comNome: '0' })
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect(await existeUsuario(c.alunoId)).toBe(false)
    })

    it('a faixa leva só as linhas que cabem no orçamento de bytes: com a janela abrindo depois da primeira faixa, a linha que passaria do orçamento fica com o nome, e a noite seguinte a troca', async () => {
      const c = await cenario()
      // Três linhas de ~1,5 MB: duas somam ~3 MB e cabem no orçamento de 4 MB; a terceira o passaria, e fica para a faixa seguinte.
      await bancada.pool.query(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
         select $1, $2, 'conversa_e_ferramentas', 'gerar_plano_de_aula', $3, gen_random_uuid(),
                jsonb_build_object('tarefa', 'gerar_plano_de_aula', 'parametros', jsonb_build_object('tema', repeat('Trecho sintético do material da aula. ', 40000) || $4::text))
         from generate_series(1, 3)`,
        [c.escolaId, c.anoId, c.professorId, `Reforço para ${c.nome}`],
      )
      const contagem = async (): Promise<{ total: string; comNome: string } | undefined> => {
        const { rows } = await bancada.pool.query<{ total: string; comNome: string }>(
          `select count(*)::text as total, count(*) filter (where entrada::text like '%' || $2 || '%')::text as "comNome" from execucao_agente where escola_id = $1 and solicitada_por is not null`,
          [c.escolaId, c.nome],
        )
        return rows[0]
      }
      const pedidoId = await agendar(c, c.alunoId)

      // A janela é lida antes de cada faixa: a primeira roda (fora da janela), a segunda já encontra o horário letivo aberto.
      await rodar(c.escolaId, { pedidoId }, { relogio: relogioQueAbreDepoisDe(1) })
      expect(await contagem()).toEqual({ total: '3', comNome: '1' })
      expect((await pedido(pedidoId)).estado).toBe('agendado')
      expect(await existeUsuario(c.alunoId)).toBe(true)

      // A noite seguinte: a linha que o orçamento deixou de fora é trocada, e a eliminação conclui.
      await rodar(c.escolaId, { pedidoId })
      expect(await contagem()).toEqual({ total: '3', comNome: '0' })
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect(await existeUsuario(c.alunoId)).toBe(false)
    })

    it('a janela que abre entre as faixas para a troca sem eliminar: o que já foi trocado fica, o pedido continua `agendado`, e a noite seguinte termina', async () => {
      const c = await cenario()
      const ids: string[] = []
      for (let i = 0; i < 5; i += 1) ids.push(await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço ${i} para ${c.nome}` } }))
      const pedidoId = await agendar(c, c.alunoId)

      // A janela é lida antes de cada faixa: a primeira roda (fora da janela), a segunda já encontra o horário letivo aberto.
      await rodar(c.escolaId, { pedidoId }, { relogio: relogioQueAbreDepoisDe(1), faixa: 2 })
      expect(await existeUsuario(c.alunoId)).toBe(true)
      expect((await pedido(pedidoId)).estado).toBe('agendado')
      const trocadas = (await Promise.all(ids.map((id) => texto('execucao_agente', 'entrada', id)))).filter((entrada) => entrada.includes(REMOVIDO)).length
      expect(trocadas).toBe(2)
      expect(log.linhas.some((linha) => linha.includes('"status":"interrompida_pela_janela"'))).toBe(true)

      await rodar(c.escolaId, { pedidoId }, { faixa: 2 })
      for (const id of ids) expect(await texto('execucao_agente', 'entrada', id)).toContain(REMOVIDO)
      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      // Cada linha foi assinada uma vez só, mesmo com a faixa repetida.
      expect((await auditoria(c.escolaId, 'titular.nome_trocado')).length).toBe(5)
    })

    it('a linha antiga do consumo (envio externo e sem `provedor`) é trocada sem esbarrar no check, e a eliminação conclui', async () => {
      const c = await cenario()
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const consumoId = await consumoDa(c, execucaoId, { tema: `Plano para ${c.nome}` }, null)
      await bancada.pool.query('update consumo_ia set envio_externo = true, provedor = null, aluno_id = null where id = $1', [consumoId])
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      expect(await texto('consumo_ia', 'entrada', consumoId)).toContain(REMOVIDO)
      expect((await pedido(pedidoId)).estado).toBe('concluido')
    })

    it('o homônimo ativo, ou o mesmo nome livre na lista de uma turma, impede a troca: o texto fica, `homonimo` fica verdadeiro e a pessoa sai', async () => {
      const c = await cenario()
      await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [c.escolaId, `  ${c.nome.toUpperCase()} `])
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(c.nome)
      expect(await pedido(pedidoId)).toMatchObject({ estado: 'concluido', nomeTrocado: false, homonimo: true })
      expect(await auditoria(c.escolaId, 'titular.nome_trocado')).toEqual([])

      const d = await cenario()
      // O mesmo nome com outra caixa: a comparação não distingue maiúscula de minúscula.
      await um("insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, $4, 'm-livre-1', 'livre') returning id", [d.escolaId, d.anoId, d.turmaId, d.nome.toUpperCase()])
      const outraExecucaoId = await execucaoDoProfessor(d, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${d.nome}` } })
      const outroPedidoId = await agendar(d, d.alunoId)
      await rodar(d.escolaId, { pedidoId: outroPedidoId })
      expect(await texto('execucao_agente', 'entrada', outraExecucaoId)).toContain(d.nome)
      expect(await pedido(outroPedidoId)).toMatchObject({ estado: 'concluido', nomeTrocado: false, homonimo: true })
    })

    it('o professor com o mesmo nome e o nome que outra pessoa reivindicou e ainda espera aprovação não são homônimo: a troca acontece', async () => {
      const c = await cenario()
      await pessoaDaEquipe(c.escolaId, 'professor', c.nome)
      await um("insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, $4, 'm-reivindicada-1', 'reivindicado') returning id", [c.escolaId, c.anoId, c.turmaId, c.nome])
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      expect(await pedido(pedidoId)).toMatchObject({ estado: 'concluido', nomeTrocado: true, homonimo: false })
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(REMOVIDO)
    })

    it('o homônimo desativado não impede a troca', async () => {
      const c = await cenario()
      const outro = await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [c.escolaId, c.nome])
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [outro])
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })
      expect(await pedido(pedidoId)).toMatchObject({ estado: 'concluido', nomeTrocado: true, homonimo: false })
    })

    it('o professor é eliminado sem troca de nome: o texto fica, a execução que ele pediu sai anonimizada, e as duas marcas ficam falsas', async () => {
      const c = await cenario()
      const artefatoId = await artefatoDe(c, `Plano para ${c.nome}`, { tipo: 'plano_de_aula', titulo: `Plano para ${c.nome}` })
      // O nome do próprio professor num texto (o título de um artefato que ele fez) também não é trocado: o professor não tem troca.
      const doProfessorId = await artefatoDe(c, `Aula da ${NOME_DA_PROFESSORA}`, { tipo: 'plano_de_aula', titulo: `Aula da ${NOME_DA_PROFESSORA}` })
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.professorId, { papel: 'professor' })
      await rodar(c.escolaId, { pedidoId })
      expect(await existeUsuario(c.professorId)).toBe(false)
      expect(await pedido(pedidoId)).toMatchObject({ estado: 'concluido', nomeTrocado: false, homonimo: false })
      expect(await texto('artefato', 'titulo', artefatoId)).toBe(`Plano para ${c.nome}`)
      expect(await texto('artefato', 'titulo', doProfessorId)).toBe(`Aula da ${NOME_DA_PROFESSORA}`)
      // O tema que o próprio professor escreveu sai com a anonimização das execuções dele.
      expect(JSON.parse(await texto('execucao_agente', 'entrada', execucaoId))).toEqual({ tarefa: 'gerar_plano_de_aula' })
      expect(await auditoria(c.escolaId, 'titular.nome_trocado')).toEqual([])
    })
  })

  // ---- A etapa 3 -------------------------------------------------------------------------------------------------------

  describe('a eliminação', () => {
    it('conclui o pedido, apaga a pessoa e deixa o que a IA gerou sem ela: execução anonimizada, texto do modelo sem entrada nem saída, arquivo marcado', async () => {
      const c = await cenario()
      // A execução que o aluno pediu (o Tutor) e o consumo dela, que guarda o aluno e o provedor.
      const execucaoDoAlunoId = await um(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, $4, $5) returning id`,
        [c.escolaId, c.anoId, c.alunoId, randomUUID(), JSON.stringify({ tarefa: 'turno_do_tutor', parametros: { tema: `Dúvida de ${c.nome}` } })],
      )
      const consumoDoAlunoId = await um(
        `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, custo_micros, duracao_ms, envio_externo, provedor, tentativas, estado, em)
         values ($1, $2, $3, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'openai_compat', 'modelo', 'v1', 10, 10, 1, 100, true, 'maritaca', 1, 'concluida', '2026-10-06T12:00:00-03:00') returning id`,
        [c.escolaId, c.alunoId, execucaoDoAlunoId],
      )
      // O rastro que só existe pela execução que o aluno pediu (sem `aluno_id`): se a anonimização rodar antes da foto, ele some dela.
      await um(
        `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, custo_micros, duracao_ms, envio_externo, provedor, tentativas, estado, em)
         values ($1, null, $2, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'openai_compat', 'modelo', 'v1', 10, 10, 1, 100, true, 'provedor_so_pela_execucao', 1, 'concluida', '2026-10-06T12:00:00-03:00') returning id`,
        [c.escolaId, execucaoDoAlunoId],
      )
      // O pedido de acesso `pronto` do aluno, com o arquivo, e um em andamento: a eliminação conclui os dois.
      const acessoId = await um(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'acesso', 'titular', current_date, 'pronto', '[]'::jsonb, $3, $4) returning id`,
        [c.escolaId, c.alunoId, c.coordenadoraId, randomUUID()],
      )
      const emPreparacaoId = await um(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'portabilidade', 'titular', current_date, 'em_preparacao', '[]'::jsonb, $3, $4) returning id`,
        [c.escolaId, c.alunoId, c.coordenadoraId, randomUUID()],
      )
      const arquivoId = await um(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em) values ($1, $2, 'completa', $3, 10, now(), now() + interval '7 days') returning id`,
        [c.escolaId, acessoId, `titular/${c.escolaId}/${acessoId}/completa.json`],
      )
      // O que a eliminação deste aluno não toca: o consumo de uma execução do professor, o arquivo de outro titular, o arquivo já marcado
      // e o pedido cancelado do próprio aluno, e o pedido aberto de outro aluno da mesma escola.
      const execucaoDoProfessorId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: 'Tema do professor' } })
      const consumoDoProfessorId = await consumoDa(c, execucaoDoProfessorId, { tema: 'Tema do professor' }, { texto: 'Plano do professor' })
      const outroAlunoId = await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Outro aluno sintético da eliminação') returning id", [c.escolaId])
      const acessoDoOutroId = await um(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'acesso', 'titular', current_date, 'pronto', '[]'::jsonb, $3, $4) returning id`,
        [c.escolaId, outroAlunoId, c.coordenadoraId, randomUUID()],
      )
      const arquivoDoOutroId = await um(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em) values ($1, $2, 'completa', $3, 10, now(), now() + interval '7 days') returning id`,
        [c.escolaId, acessoDoOutroId, `titular/${c.escolaId}/${acessoDoOutroId}/completa.json`],
      )
      const canceladoId = await um(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio, cancelado_em, cancelado_por)
         values ($1, $2, 'aluno', 'portabilidade', 'titular', current_date, 'cancelado', '[]'::jsonb, $3, $4, now(), $3) returning id`,
        [c.escolaId, c.alunoId, c.coordenadoraId, randomUUID()],
      )
      const jaMarcadoEm = '2026-01-01T12:00:00.000Z'
      const arquivoJaMarcadoId = await um(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em, apagado_em) values ($1, $2, 'coordenacao', $3, 10, now(), now() + interval '7 days', $4) returning id`,
        [c.escolaId, acessoId, `titular/${c.escolaId}/${acessoId}/coordenacao.json`, jaMarcadoEm],
      )
      const pedidoId = await agendar(c, c.alunoId)

      await rodar(c.escolaId, { pedidoId })

      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect((await bancada.pool.query<{ entrada: unknown }>('select entrada from consumo_ia where id = $1', [consumoDoProfessorId])).rows[0]?.entrada).not.toBeNull()
      expect((await bancada.pool.query<{ marcado: boolean }>('select apagado_em is not null as marcado from arquivo_titular where id = $1', [arquivoDoOutroId])).rows[0]).toEqual({ marcado: false })
      expect((await pedido(acessoDoOutroId)).estado).toBe('pronto')
      expect((await pedido(canceladoId)).estado).toBe('cancelado')
      expect((await bancada.pool.query<{ em: Date }>('select apagado_em as em from arquivo_titular where id = $1', [arquivoJaMarcadoId])).rows[0]?.em.toISOString()).toBe(jaMarcadoEm)
      const concluido = await pedido(pedidoId)
      expect(concluido).toMatchObject({ estado: 'concluido', nomeTrocado: true, homonimo: false, concluidoPor: c.coordenadoraId })
      // A execução fica, ligada ao que foi aprovado, sem a pessoa e sem o tema dela.
      const { rows } = await bancada.pool.query<{ solicitadaPor: string | null; anonimizada: boolean; entrada: unknown }>(
        'select solicitada_por as "solicitadaPor", anonimizada_em is not null as anonimizada, entrada from execucao_agente where id = $1',
        [execucaoDoAlunoId],
      )
      expect(rows[0]).toEqual({ solicitadaPor: null, anonimizada: true, entrada: { tarefa: 'turno_do_tutor' } })
      expect((await bancada.pool.query<{ alunoId: string | null }>('select aluno_id as "alunoId" from consumo_ia where id = $1', [consumoDoAlunoId])).rows[0]).toEqual({ alunoId: null })
      // Os outros pedidos abertos do titular saem do aberto, e o arquivo passa a ser apagado pelo expurgo.
      expect((await pedido(acessoId)).estado).toBe('concluido')
      expect((await pedido(emPreparacaoId)).estado).toBe('concluido')
      expect((await bancada.pool.query<{ marcado: boolean }>('select apagado_em is not null as marcado from arquivo_titular where id = $1', [arquivoId])).rows[0]).toEqual({ marcado: true })
      // A foto salva no pedido responde por quais empresas receberam o dado dele, depois de ele sair.
      expect(concluido.compartilhamento).toEqual(expect.arrayContaining([expect.objectContaining({ chave: 'maritaca', origem: 'rastro', suboperadorId: null })]))
      expect(concluido.compartilhamento).toEqual(expect.arrayContaining([expect.objectContaining({ chave: 'provedor_so_pela_execucao', origem: 'rastro' })]))

      const concluidos = await auditoria(c.escolaId, 'pedido.concluido')
      expect(concluidos.map((linha) => linha.entidadeId).sort()).toEqual([pedidoId, acessoId, emPreparacaoId].sort())
      for (const linha of concluidos) expect(linha).toMatchObject({ autorUsuarioId: c.coordenadoraId, autorOperador: null })
      expect(await auditoria(c.escolaId, 'usuario.eliminado')).toEqual([
        expect.objectContaining({ entidadeId: c.alunoId, autorUsuarioId: c.coordenadoraId, autorOperador: null }),
      ])
    })

    it('a coordenação que registrou e já foi desativada não assina: a eliminação, a troca e a conclusão saem como `rotina`, e o `concluido_por` fica o de quem registrou', async () => {
      const c = await cenario()
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [c.coordenadoraId])

      await rodar(c.escolaId, { pedidoId })

      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(REMOVIDO)
      expect(await pedido(pedidoId)).toMatchObject({ estado: 'concluido', concluidoPor: c.coordenadoraId })
      for (const acao of ['usuario.eliminado', 'pedido.concluido', 'titular.nome_trocado']) {
        const linhas = await auditoria(c.escolaId, acao)
        expect(linhas.length, acao).toBeGreaterThan(0)
        for (const linha of linhas) expect(linha, acao).toMatchObject({ autorUsuarioId: null, autorOperador: AUTOR_DA_ROTINA })
      }
    })

    it('a pessoa que já saiu por outro caminho não tem o que eliminar: o pedido conclui sem `usuario.eliminado`', async () => {
      const c = await cenario()
      const pedidoId = await agendar(c, c.alunoId)
      await bancada.pool.query('delete from usuario where id = $1', [c.alunoId])
      await rodar(c.escolaId, { pedidoId })
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect(await auditoria(c.escolaId, 'usuario.eliminado')).toEqual([])
      expect((await auditoria(c.escolaId, 'pedido.concluido')).map((linha) => linha.entidadeId)).toEqual([pedidoId])
    })

    it('falha ao eliminar desfaz a etapa 3 inteira: a pessoa fica, a execução dela não é anonimizada, o pedido continua `agendado`; sem a falha, o job seguinte conclui', async () => {
      const c = await cenario()
      const execucaoDoAlunoId = await um(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, $4, $5) returning id`,
        [c.escolaId, c.anoId, c.alunoId, randomUUID(), JSON.stringify({ tarefa: 'turno_do_tutor' })],
      )
      // O que a etapa 3 também escreve na mesma transação: a foto (o consumo só pela execução), o arquivo marcado e o outro pedido concluído.
      await um(
        `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, custo_micros, duracao_ms, envio_externo, provedor, tentativas, estado, em)
         values ($1, null, $2, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'openai_compat', 'modelo', 'v1', 10, 10, 1, 100, true, 'provedor_so_pela_execucao', 1, 'concluida', '2026-10-06T12:00:00-03:00') returning id`,
        [c.escolaId, execucaoDoAlunoId],
      )
      const acessoId = await um(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'acesso', 'titular', current_date, 'pronto', '[]'::jsonb, $3, $4) returning id`,
        [c.escolaId, c.alunoId, c.coordenadoraId, randomUUID()],
      )
      const arquivoId = await um(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em) values ($1, $2, 'completa', $3, 10, now(), now() + interval '7 days') returning id`,
        [c.escolaId, acessoId, `titular/${c.escolaId}/${acessoId}/completa.json`],
      )
      const pedidoId = await agendar(c, c.alunoId)
      const nome = `teste_falha_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$`)
      await bancada.pool.query(`create trigger ${nome} before delete on usuario for each row when (old.id = '${c.alunoId}') execute function ${nome}()`)
      try {
        await expect(rodar(c.escolaId, { pedidoId })).rejects.toThrow()
        expect(await existeUsuario(c.alunoId)).toBe(true)
        expect((await pedido(pedidoId)).estado).toBe('agendado')
        const { rows } = await bancada.pool.query<{ anonimizada: boolean; solicitadaPor: string | null }>(
          'select anonimizada_em is not null as anonimizada, solicitada_por as "solicitadaPor" from execucao_agente where id = $1',
          [execucaoDoAlunoId],
        )
        expect(rows[0]).toEqual({ anonimizada: false, solicitadaPor: c.alunoId })
        expect(await auditoria(c.escolaId, 'pedido.concluido')).toEqual([])
        // A foto e o arquivo marcado são da mesma transação: a falha desfaz os dois.
        expect((await pedido(pedidoId)).compartilhamento).toEqual([])
        expect((await bancada.pool.query<{ marcado: boolean }>('select apagado_em is not null as marcado from arquivo_titular where id = $1', [arquivoId])).rows[0]).toEqual({ marcado: false })
        expect((await pedido(acessoId)).estado).toBe('pronto')
      } finally {
        await bancada.pool.query(`drop trigger ${nome} on usuario`)
        await bancada.pool.query(`drop function ${nome}()`)
      }
      await rodar(c.escolaId, { pedidoId })
      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect((await pedido(pedidoId)).estado).toBe('concluido')
    })

    it('[P] dois jobs do mesmo pedido ao mesmo tempo eliminam uma vez: uma auditoria de eliminação, uma conclusão e nenhum erro', async () => {
      const c = await cenario()
      await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      await Promise.all([rodar(c.escolaId, { pedidoId }), rodar(c.escolaId, { pedidoId })])
      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect(await auditoria(c.escolaId, 'usuario.eliminado')).toHaveLength(1)
      expect((await auditoria(c.escolaId, 'pedido.concluido')).filter((linha) => linha.entidadeId === pedidoId)).toHaveLength(1)
    })

    it('[P] a eliminação e o expurgo da escola do mesmo desativado ao mesmo tempo: a pessoa sai uma vez, o pedido conclui e nenhum dos dois falha', async () => {
      const c = await cenario()
      await bancada.pool.query("update usuario set desativado_em = now() - interval '61 months' where id = $1", [c.alunoId])
      const pedidoId = await agendar(c, c.alunoId)
      const relogio = relogioEm(QUARTA_1H)
      const expurgo = criarExpurgoDaEscola({
        repositorio: new ExpurgoDaEscolaRepository(bancada.banco),
        enfileirador: bancada.enfileirador,
        arquivos: new ArquivoDoTitularRepository(bancada.banco),
        armazem: new InMemoryFileStorage(),
        retencao: new RetencaoDaEscolaRepository(bancada.banco),
        janelaDaEscola: await janelaDaEscola(),
        relogio,
        logger: log.logger,
      })
      const jobId = randomUUID()
      const expurgar = runInContext({ requisicaoId: randomUUID(), escolaId: c.escolaId }, () => expurgo({}, execucaoDoJob(jobId)))
      await Promise.all([rodar(c.escolaId, { pedidoId }, { relogio }), expurgar])
      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect(await auditoria(c.escolaId, 'usuario.eliminado')).toHaveLength(1)
    })

    it('o cancelamento que chega antes da trava vence: o job não elimina nem conclui o pedido cancelado', async () => {
      const c = await cenario()
      const pedidoId = await agendar(c, c.alunoId)
      // A transação do cancelamento segura a linha; o job começa, lê o pedido `agendado` e espera na trava do pedido.
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        await cliente.query("update pedido_titular set estado = 'cancelado', cancelado_em = now(), cancelado_por = registrado_por where id = $1", [pedidoId])
        const job = rodar(c.escolaId, { pedidoId })
        // Só confirma quando o job está de fato esperando a trava do pedido: o tempo fixo deixava o commit vir antes dele.
        const inicio = Date.now()
        for (;;) {
          const { rowCount } = await bancada.pool.query(
            "select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%pedido_titular%' and query ilike '%for update%'",
          )
          if (rowCount !== null && rowCount > 0) break
          if (Date.now() - inicio > 10_000) throw new Error('o job não chegou a esperar a trava do pedido')
          await new Promise((resolver) => setTimeout(resolver, 25))
        }
        await cliente.query('commit')
        await job
      } finally {
        cliente.release()
      }
      expect(await existeUsuario(c.alunoId)).toBe(true)
      expect((await pedido(pedidoId)).estado).toBe('cancelado')
    })
  })

  describe('o que fica depois da eliminação', () => {
    it('o pedido guarda o id do titular e as duas marcas; o nome atual não está em nenhuma linha de pedido nem de auditoria da escola', async () => {
      const c = await cenario()
      await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      await artefatoDe(c, `Plano para ${c.nome}`, { tipo: 'plano_de_aula', titulo: `Plano para ${c.nome}` })
      const pedidoId = await agendar(c, c.alunoId)
      await rodar(c.escolaId, { pedidoId })

      const { rows: pedidos } = await bancada.pool.query<{ titularId: string; texto: string }>(
        `select titular_id as "titularId", to_jsonb(p)::text as texto from pedido_titular p where escola_id = $1`,
        [c.escolaId],
      )
      expect(pedidos).toHaveLength(1)
      expect(pedidos[0]?.titularId).toBe(c.alunoId)
      const { rows: auditorias } = await bancada.pool.query<{ texto: string }>('select to_jsonb(a)::text as texto from auditoria a where escola_id = $1', [c.escolaId])
      expect(auditorias.length).toBeGreaterThan(0)
      for (const { texto: linha } of [...pedidos, ...auditorias]) {
        expect(linha.toLowerCase()).not.toContain(c.nome.toLowerCase())
        expect(linha.toLowerCase()).not.toContain('müller')
      }
      // O que a coordenação recebe do pedido é só `nomeTrocado` (a contagem por tabela não existe em coluna nenhuma do pedido).
      const { rows: colunas } = await bancada.pool.query<{ coluna: string }>(
        `select column_name as coluna from information_schema.columns where table_name = 'pedido_titular' and (column_name like '%troca%' or column_name like '%linhas%' or column_name like '%contagem%')`,
      )
      expect(colunas).toEqual([{ coluna: 'nome_trocado' }])
    })
  })

  describe('isolamento: cada método com o id de A no contexto de B não alcança nada', () => {
    it('o repositório da eliminação, o homônimo e o arquivo respondem como inexistentes e não mudam a linha de A', async () => {
      const a = await cenario()
      const b = await cenario(a.nome)
      const execucaoId = await um(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, $4, $5) returning id`,
        [a.escolaId, a.anoId, a.alunoId, randomUUID(), JSON.stringify({ tarefa: 'turno_do_tutor', parametros: { tema: 'Dúvida sintética' } })],
      )
      const acessoId = await um(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'acesso', 'titular', current_date, 'em_preparacao', '[]'::jsonb, $3, $4) returning id`,
        [a.escolaId, a.alunoId, a.coordenadoraId, randomUUID()],
      )
      const arquivoId = await um(
        `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em) values ($1, $2, 'completa', $3, 10, now(), now() + interval '7 days') returning id`,
        [a.escolaId, acessoId, `titular/${a.escolaId}/${acessoId}/completa.json`],
      )
      const pedidoId = await agendar(a, a.alunoId)
      // Em A o titular tem homônimo: visto do contexto de B, a pessoa não existe, e a resposta é `false` (não "tem homônimo").
      await um("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', $2) returning id", [a.escolaId, a.nome])

      const resultado = await runInContext({ requisicaoId: randomUUID(), escolaId: b.escolaId }, () =>
        bancada.banco.transaction(async (tx) => {
          const repositorio = new EliminacaoDoTitularRepository(tx)
          return {
            vencido: await repositorio.vencido(pedidoId),
            travado: await repositorio.travarVencido(pedidoId),
            nome: await repositorio.nomeDoTitular(a.alunoId),
            registrador: await repositorio.registradorAtivo(a.coordenadoraId),
            execucoes: await repositorio.anonimizarExecucoes(a.alunoId, new Date()),
            arquivos: await repositorio.marcarArquivosApagados(a.alunoId),
            abertos: await repositorio.concluirOutrosAbertos(a.alunoId, pedidoId),
            concluiu: await repositorio.concluir(pedidoId, { nomeTrocado: true, homonimo: false }),
            homonimo: await haHomonimoDoTitular(tx, a.alunoId),
          }
        }),
      )
      expect(resultado).toEqual({ vencido: undefined, travado: undefined, nome: undefined, registrador: false, execucoes: 0, arquivos: 0, abertos: [], concluiu: false, homonimo: false })
      await runInContext({ requisicaoId: randomUUID(), escolaId: b.escolaId }, () => new EliminacaoDoTitularRepository(bancada.banco).gravarCompartilhamento(pedidoId, [{ suboperadorId: null, chave: 'x', primeiroEm: new Date().toISOString(), ultimoEm: new Date().toISOString(), origem: 'rastro' }]))

      // A linha de A continua como estava.
      expect((await pedido(pedidoId)).estado).toBe('agendado')
      expect((await pedido(pedidoId)).compartilhamento).toEqual([])
      expect((await pedido(acessoId)).estado).toBe('em_preparacao')
      expect((await bancada.pool.query<{ anonimizada: boolean }>('select anonimizada_em is not null as anonimizada from execucao_agente where id = $1', [execucaoId])).rows[0]).toEqual({ anonimizada: false })
      expect((await bancada.pool.query<{ marcado: boolean }>('select apagado_em is not null as marcado from arquivo_titular where id = $1', [arquivoId])).rows[0]).toEqual({ marcado: false })

      // O arquivo, no contexto de B: o pedido e a pessoa de A não existem.
      const doArquivo = await runInContext({ requisicaoId: randomUUID(), escolaId: b.escolaId }, async () => {
        const arquivos = new ArquivoDoTitularRepository(bancada.banco)
        return { arquivo: await arquivos.doPedido(acessoId, 'completa'), conta: await arquivos.contaAtiva(a.alunoId) }
      })
      expect(doArquivo).toEqual({ arquivo: undefined, conta: undefined })
    })
  })

  describe('o job da eliminação ao enfileirar', () => {
    it('o payload inválido de `enfileirarUmaVez` é recusado sem gravar e sem ocupar a chave: o válido, com a mesma chave, entra depois', async () => {
      const escolaId = await bancada.escola()
      const pedidoId = randomUUID()
      const chave = `eliminacao:${pedidoId}`
      const naEscola = <T>(fazer: (tx: DatabaseTransaction) => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => fazer(tx)))
      const jobs = async () => Number((await bancada.pool.query<{ total: string }>('select count(*) as total from job_registro where escola_id = $1', [escolaId])).rows[0]?.total)

      // @ts-expect-error o payload da eliminação é só o pedidoId
      const invalido = naEscola((tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId, escolaId }, chave))
      await expect(invalido).rejects.toBeInstanceOf(JobRequestRejectedError)
      expect(await jobs()).toBe(0)

      const valido = await naEscola((tx) => bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId }, chave))
      expect(valido.situacao).toBe('enfileirado')
      expect(await jobs()).toBe(1)
    })
  })

  describe('montado no worker de lote', () => {
    it('o job enfileirado pela rotina é despachado e executado pelo worker: o pedido vencido conclui e a pessoa sai', async () => {
      const c = await cenario()
      const execucaoId = await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      const relogio = relogioEm(QUARTA_1H)
      const worker = montarWorker(
        { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
        log.logger,
        { prefixo: bancada.prefixo, relogio, agendamentos: [] },
      )
      onTestFinished(() => worker.encerrar())
      bancada.despachante(log, { relogio }).iniciar()
      const enfileirado = await runInContext({ requisicaoId: randomUUID(), escolaId: c.escolaId }, () =>
        bancada.banco.transaction((tx) =>
          bancada.enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId }, `eliminacao:${pedidoId}`),
        ),
      )
      await expect.poll(async () => (await bancada.estado(enfileirado.id ?? ''))?.estado, { timeout: 20_000, interval: 100 }).toBe('concluido')
      expect(await existeUsuario(c.alunoId)).toBe(false)
      expect((await pedido(pedidoId)).estado).toBe('concluido')
      expect(await texto('execucao_agente', 'entrada', execucaoId)).toContain(REMOVIDO)
    })
  })

  describe('o que o job registra', () => {
    it('o log leva só o evento e o resultado: nunca o nome, o titular, o pedido ou contagem por tabela', async () => {
      const c = await cenario()
      await execucaoDoProfessor(c, { tarefa: 'gerar_plano_de_aula', parametros: { tema: `Reforço para ${c.nome}` } })
      const pedidoId = await agendar(c, c.alunoId)
      const antes = log.linhas.length
      await rodar(c.escolaId, { pedidoId })
      const novas = log.linhas.slice(antes)
      expect(novas.length).toBeGreaterThan(0)
      for (const linha of novas) {
        expect(linha).not.toContain(c.nome)
        expect(linha).not.toContain(c.alunoId)
        expect(linha).not.toContain(pedidoId)
        const campos = Object.keys(JSON.parse(linha) as Record<string, unknown>)
        for (const campo of campos) expect(['level', 'time', 'servico', 'requisicaoId', 'escolaId', 'evento', 'status']).toContain(campo)
      }
      expect(novas.some((linha) => linha.includes('"evento":"titular.eliminacao"') && linha.includes('"status":"concluida"'))).toBe(true)
    })

    it('o tipo do job é o do contrato', () => {
      expect(TIPO_ELIMINAR_TITULAR).toBe('titular.eliminar')
    })
  })
})
