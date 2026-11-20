import { BnccRepository, CANDIDATAS_MAXIMAS, JobAdiadoError, JobOutbox, JobOutboxRepository, LLMError, proporFerramenta, runInContext, SECOES_POR_EXECUCAO, type ClassificarSecoesInput } from '@educa/core'
import { ErrorCode, habilidadeEhCandidata, TIPO_EXECUTAR_LOTE, type ResultadoGravado, type SerieDoRecorte } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { FilaDeIa, type ModeloDeTeste } from '../../test/fila-de-ia.fixture.js'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import { vagasPadraoDoAmbiente } from '../../../worker/test/queue.fixture.js'
import { esperarNaTrava, WriteBlockTrigger } from '../../test/write-block-trigger.js'
import { LIMITE_DA_RODANDO_SEGUNDOS, VarreduraDeExecucoes } from '../ia/varredura-de-execucoes.js'
import { ExecucaoRepository } from '../ia/execucao.repository.js'
import { OrcamentoRepository } from '../ia/orcamento.repository.js'
import type { EntradaDaTarefa, ExecucaoCommand, SaidaDaTarefa } from '../ia/execucao-command.js'
import { RegistroDeComandos } from '../ia/registro-de-comandos.js'
import { candidatasDoRecorte } from './habilidades-do-recorte.js'
import { SecoesRepository } from './secoes.repository.js'

/**
 * A classificação do material pela BNCC no worker (classificacao-bncc, 4.0; `techspec.md` §5 "Classificação" e "Degradação do lote", §7, §7c; `cenarios.md` "Classificação no worker"; corridas P1a, P4, P4b, P9):
 * a execução `classificar_secoes` roda no `main-worker` pela fila `lote`, sem pessoa nem ano, fora do horário letivo, e grava os códigos `origem: 'ia'` só nas seções vivas. A bancada é a `FilaDeIa`: o worker
 * consome as filas `api-*` de verdade (o `lote` entre elas), e os casos que escolhem o instante entregam o job ao processador (`entregarDeNovo`) com a bancada sem consumir.
 */
const medidor = new MedidorDeTeste()
const bancada = new SessaoFixtures()
const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)

/** Segunda-feira, 10h05 em São Paulo: dentro do horário letivo de segunda a sexta, das 7h às 18h. */
const NA_JANELA = new Date('2026-11-16T13:05:00Z')
/** Terça-feira, 7h05 em São Paulo: cinco minutos depois de a janela abrir, quando volta o job que o provedor adiou de madrugada. */
const LOGO_DEPOIS_DA_ABERTURA = new Date('2026-11-17T10:05:00Z')
/** Segunda-feira, 19h05 em São Paulo: já fora. */
const FORA_DA_JANELA = new Date('2026-11-16T22:05:00Z')
const JANELA_DA_ESCOLA = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' } as const

interface Escola {
  readonly base: EscolaComTurma
  readonly escolaId: string
  readonly materialId: string
  /** As três seções do material (uma página cada), na ordem. */
  readonly secoes: readonly string[]
  readonly textoDaHabilidade: string
  readonly codigoDaHabilidade: string
}

const CODIGO_DE_CNT = 'EM13CNT101'

/** A escola com o material `pronto` de Química do 2º ano do EM, com três capítulos de uma página, o texto de cada página e a escola sem dia letivo (o despachante nunca segura o lote). */
async function montarEscola(fila: FilaDeIa): Promise<Escola> {
  const base = await montarEscolaComTurma(fila.api, bancada)
  const escolaId = base.coordenacao.escolaId
  await sql("insert into configuracao_operacional_escola (escola_id, dias_letivos) values ($1, '{}')", [escolaId])
  const habilidade = (await sql<{ descricao: string }>('select descricao from habilidade_bncc where codigo = $1', [CODIGO_DE_CNT])).rows[0]
  const textoDaHabilidade = habilidade?.descricao ?? ''
  const { rows } = await sql<{ id: string }>(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
     values ($1, $2, 'Apostila de teste', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'pronto', 3, now() - interval '2 hours') returning id`,
    [escolaId, base.quimica],
  )
  const materialId = rows[0]?.id ?? ''
  await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaId, materialId, base.serieId])
  const secoes: string[] = []
  for (const ordem of [1, 2, 3]) {
    const capitulo = await sql<{ id: string }>('insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $3::int, $4, $3::int, $3::int) returning id', [
      escolaId,
      materialId,
      ordem,
      `Capítulo ${String(ordem)} sigiloso`,
    ])
    const secao = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, capitulo_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3, $4::smallint, $4::int, $4::int) returning id', [
      escolaId,
      materialId,
      capitulo.rows[0]?.id,
      ordem,
    ])
    secoes.push(secao.rows[0]?.id ?? '')
    await sql('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, base.quimica, materialId, ordem, `${textoDaHabilidade}\nSubtítulo sigiloso ${String(ordem)}`])
  }
  return { base, escolaId, materialId, secoes, textoDaHabilidade, codigoDaHabilidade: CODIGO_DE_CNT }
}

/** A execução `classificar_secoes` da rotina (sem pessoa e sem ano), com as seções apontando para ela. */
async function execucaoDaRotina(escola: Escola, secoes: readonly string[] = escola.secoes): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    "insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, $3) returning id",
    [escola.escolaId, randomUUID(), JSON.stringify({ tarefa: 'classificar_secoes' })],
  )
  const id = rows[0]?.id ?? ''
  await sql('update secao_do_material set execucao_id = $1 where escola_id = $2 and id = any($3::uuid[])', [id, escola.escolaId, secoes])
  return id
}

const outbox = (fila: FilaDeIa) => new JobOutbox(new JobOutboxRepository(fila.banco))

/** O job `ia.executar-lote`, como a rotina das 19h o grava: na transação, na fila `lote`, com a chave da execução. */
const enfileirar = (fila: FilaDeIa, escolaId: string, execucaoId: string): Promise<unknown> =>
  runInContext({ requisicaoId: randomUUID(), escolaId }, () => fila.banco.transaction((tx) => outbox(fila).enfileirarUmaVez(tx, TIPO_EXECUTAR_LOTE, { execucaoId }, execucaoId, { fila: 'lote' })))

interface ExecucaoRow extends Record<string, unknown> {
  readonly estado: string
  readonly erro: string | null
  readonly resultado: Record<string, unknown> | null
}
const execucaoDe = async (id: string): Promise<ExecucaoRow> => (await sql<ExecucaoRow>('select estado, erro, resultado from execucao_agente where id = $1', [id])).rows[0] ?? { estado: 'inexistente', erro: null, resultado: null }
const secaoDe = async (id: string) => (await sql<{ classificada_em: Date | null; falhas_seguidas: number; execucao_id: string | null; corrigida_em: Date | null }>('select classificada_em, falhas_seguidas, execucao_id, corrigida_em from secao_do_material where id = $1', [id])).rows[0]
const habilidadesDa = async (secaoId: string) => (await sql<{ codigo: string; origem: string }>('select codigo, origem from habilidade_da_secao where secao_id = $1 order by codigo', [secaoId])).rows
const consumosDa = async (execucaoId: string): Promise<number> => Number((await sql<{ total: string }>('select count(*) as total from consumo_ia where execucao_id = $1', [execucaoId])).rows[0]?.total)
/** As linhas de consumo da execução, com o que distingue a estimada da rotina: estado, erro, função, tarefa, pessoa e texto. */
const linhasDeConsumoDa = async (execucaoId: string) =>
  (await sql<{ escola_id: string; estado: string; codigo_de_erro: string | null; funcao: string; tarefa: string; aluno_id: string | null; entrada: unknown; saida: unknown }>(
    'select escola_id, estado, codigo_de_erro, funcao, tarefa, aluno_id, entrada, saida from consumo_ia where execucao_id = $1 order by em, id',
    [execucaoId],
  )).rows

/** A linha estimada que a execução da rotina encerrada como interrompida deixa: na escola dela, da classificação, sem pessoa e sem texto. */
const estimadaDaRotina = (escolaId: string) => ({
  escola_id: escolaId,
  estado: 'falhou',
  codigo_de_erro: ErrorCode.EXECUCAO_INTERROMPIDA,
  funcao: 'classificacao_do_material',
  tarefa: 'classificar_secoes',
  aluno_id: null,
  entrada: null,
  saida: null,
})
const jobsDa = async (execucaoId: string) =>
  (await sql<{ estado: string; fila: string; tipo: string }>("select estado, fila, tipo from job_registro where tipo = 'ia.executar-lote' and dados ->> 'execucaoId' = $1", [execucaoId])).rows

/** Só as seções que vieram na entrada, com o primeiro código das candidatas: o modelo de mentira que responde certo e conta quem chamou. */
function respondeComUmCodigo(chamadas: string[], codigo: string = CODIGO_DE_CNT): ModeloDeTeste {
  return (pedido) => {
    chamadas.push(pedido.execucaoId ?? '')
    const entrada = pedido.entrada as ClassificarSecoesInput
    return Promise.resolve({ saida: { secoes: entrada.secoes.map((secao) => ({ secaoId: secao.secaoId, codigos: [codigo] })) }, medicao: {} })
  }
}

/** Espera até `condicao` valer, ou falha: o worker é assíncrono. */
async function esperar(condicao: () => boolean | Promise<boolean>, descricao: string, limiteMs = 20_000): Promise<void> {
  const prazo = Date.now() + limiteMs
  while (!(await condicao())) {
    if (Date.now() > prazo) throw new Error(`não aconteceu no prazo: ${descricao}`)
    await new Promise((resolver) => setTimeout(resolver, 25))
  }
}

const rodar = (fila: FilaDeIa, escolaId: string, execucaoId: string): Promise<void> => fila.entregarDeNovo(execucaoId, escolaId)
const comoEscola = <Resultado>(escolaId: string, trabalho: () => Promise<Resultado>): Promise<Resultado> => runInContext({ requisicaoId: randomUUID(), escolaId }, trabalho)

afterAll(async () => {
  await bancada.fechar()
})

describe('a classificação roda pelo worker real, na fila `lote`', () => {
  let fila: FilaDeIa
  let a: Escola
  let b: Escola

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { pools: { lote: 5 } })
    a = await montarEscola(fila)
    b = await montarEscola(fila)
  })

  afterEach(() => {
    fila.restaurar()
  })

  afterAll(async () => {
    await fila.ociosa().catch(() => undefined)
    await fila.fechar()
    await sql('delete from consumo_ia where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
    await sql('delete from execucao_agente where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
    await sql('delete from configuracao_operacional_escola where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
  })

  it('caminho feliz: o worker consome o job da `lote`, grava `origem: ia` e `classificada_em`, e o consumo leva a função, nenhuma pessoa e só ids e versão', async () => {
    const execucaoId = await execucaoDaRotina(a)
    await enfileirar(fila, a.escolaId, execucaoId)
    await fila.ociosa()
    const execucao = await execucaoDe(execucaoId)
    expect(execucao).toMatchObject({ estado: 'concluida', erro: null })
    expect(execucao.resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 3 })
    for (const secaoId of a.secoes) {
      const secao = await secaoDe(secaoId)
      expect(secao?.classificada_em).not.toBeNull()
      expect(secao?.falhas_seguidas).toBe(0)
      const habilidades = await habilidadesDa(secaoId)
      expect(habilidades.length).toBeGreaterThan(0)
      expect(habilidades.every((habilidade) => habilidade.origem === 'ia' && habilidade.codigo.startsWith('EM13CNT'))).toBe(true)
    }
    const consumos = (await sql<{ funcao: string; tarefa: string; aluno_id: string | null; entrada: { secoes: string[]; promptVersao: string }; estado: string }>('select funcao, tarefa, aluno_id, entrada, estado from consumo_ia where execucao_id = $1', [execucaoId])).rows
    // O consumo e o resultado ficam na escola dona da execução, e nunca na de outra (o worker serve as duas).
    expect(Number((await sql<{ total: string }>('select count(*) as total from consumo_ia where execucao_id = $1 and escola_id = $2', [execucaoId, a.escolaId])).rows[0]?.total)).toBe(1)
    expect(Number((await sql<{ total: string }>('select count(*) as total from execucao_agente where id = $1 and escola_id = $2', [execucaoId, a.escolaId])).rows[0]?.total)).toBe(1)
    expect(consumos).toHaveLength(1)
    expect(consumos[0]).toMatchObject({ funcao: 'classificacao_do_material', tarefa: 'classificar_secoes', aluno_id: null, estado: 'concluida' })
    expect([...(consumos[0]?.entrada.secoes ?? [])].sort()).toEqual([...a.secoes].sort())
    expect(consumos[0]?.entrada.promptVersao).toEqual(expect.any(String))
    const texto = JSON.stringify(consumos[0])
    for (const proibido of ['sigiloso', a.textoDaHabilidade.slice(0, 40)]) expect(texto).not.toContain(proibido)
    expect((await jobsDa(execucaoId)).map((job) => [job.fila, job.estado])).toEqual([['lote', 'concluido']])
  })

  it('o pacote do Tutor não muda: com a turma a uma troca de esgotar o pacote, a classificação não consome nada dele', async () => {
    // Sem aluno na turma, o pacote é o limite por aluno vezes 1: com 1 por mês e nenhuma troca, a turma está em limite − 1, e qualquer troca a mais o esgotaria (`OrcamentoRepository`).
    await sql('update configuracao_operacional_escola set tutor_trocas_por_dia = 50, tutor_trocas_por_mes = 1 where escola_id = $1', [a.escolaId])
    const consulta = { funcao: 'tutor_com_o_aluno' as const, alunoId: randomUUID(), turmaId: a.base.turma }
    const permitido = () => comoEscola(a.escolaId, () => new OrcamentoRepository(fila.banco).check(consulta))
    const mensagensDaTurma = async () => Number((await sql<{ total: string }>('select count(*) as total from mensagem_tutor where escola_id = $1 and turma_id = $2', [a.escolaId, a.base.turma])).rows[0]?.total)
    try {
      const antes = await mensagensDaTurma()
      expect(await permitido()).toEqual({ permitido: true })
      const execucaoId = await execucaoDaRotina(a)
      await enfileirar(fila, a.escolaId, execucaoId)
      await fila.ociosa()
      expect(await consumosDa(execucaoId)).toBe(1)
      expect(await mensagensDaTurma()).toBe(antes)
      expect(await permitido()).toEqual({ permitido: true })
    } finally {
      await sql('update configuracao_operacional_escola set tutor_trocas_por_dia = null, tutor_trocas_por_mes = null where escola_id = $1', [a.escolaId])
    }
  })

  it('três da A e uma da B: a vaga `lote` é de cada escola, a terceira da A espera e a da B roda', async () => {
    const chamadas: string[] = []
    let liberar: () => void = () => undefined
    const solta = new Promise<void>((resolver) => (liberar = resolver))
    const responde = respondeComUmCodigo([])
    fila.comModelo(async (pedido) => {
      // Anota quem chamou **antes** de esperar: o teste conta os que já estão dentro do modelo.
      chamadas.push(pedido.execucaoId ?? '')
      await solta
      return responde(pedido)
    })
    // Uma seção por execução: a vaga é do job, e não da seção.
    const daA = await Promise.all([a.secoes[0] ?? '', a.secoes[1] ?? '', a.secoes[2] ?? ''].map((secao) => execucaoDaRotina(a, [secao])))
    const daB = await execucaoDaRotina(b, [b.secoes[0] ?? ''])
    for (const execucaoId of daA) await enfileirar(fila, a.escolaId, execucaoId)
    await enfileirar(fila, b.escolaId, daB)
    try {
      const vagas = vagasPadraoDoAmbiente().lote
      await esperar(() => chamadas.length >= vagas + 1, 'as vagas da A e a da B chamarem o modelo')
      await esperar(async () => (await Promise.all(daA.map((id) => jobsDa(id)))).flat().filter((job) => job.estado === 'aguardando').length === daA.length - vagas, 'o job da A que não coube na vaga seguir aguardando')
      expect(chamadas.filter((id) => daA.includes(id))).toHaveLength(vagas)
      expect(chamadas).toContain(daB)
    } finally {
      liberar()
    }
    await fila.ociosa()
    for (const execucaoId of [...daA, daB]) expect((await execucaoDe(execucaoId)).estado, execucaoId).toBe('concluida')
  })
})

describe('o processador da classificação, com o instante e o provedor escolhidos pelo teste', () => {
  let fila: FilaDeIa
  let a: Escola
  let b: Escola

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { semConsumir: true })
    a = await montarEscola(fila)
    b = await montarEscola(fila)
  })

  afterEach(async () => {
    fila.restaurar()
    await sql('delete from habilidade_da_secao where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
    await sql('update secao_do_material set execucao_id = null, classificada_em = null, falhas_seguidas = 0, corrigida_em = null, corrigida_por = null where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
    await sql("update material set excluido_em = null, estado = 'pronto', falha = null where escola_id = any($1::uuid[])", [[a?.escolaId, b?.escolaId]])
  })

  afterAll(async () => {
    await fila.fechar()
    await sql('delete from consumo_ia where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
    await sql('delete from execucao_agente where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
    await sql('delete from configuracao_operacional_escola where escola_id = any($1::uuid[])', [[a?.escolaId, b?.escolaId]])
  })

  describe('quem pediu', () => {
    it('a execução sem pessoa roda no comando da rotina; em comando que não é da rotina, `NAO_ENCONTRADO`, sem modelo e sem consumo', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const daRotina = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, daRotina)
      expect((await execucaoDe(daRotina)).estado).toBe('concluida')

      // A mesma ausência de pessoa na execução do Assistente: nenhum comando da rotina a atende.
      const { rows } = await sql<{ id: string }>(
        "insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'conversa_e_ferramentas', 'propor_ferramenta', null, $3, $4) returning id",
        [a.escolaId, a.base.anoLetivoId, randomUUID(), JSON.stringify({ tarefa: 'propor_ferramenta' })],
      )
      const semPessoa = rows[0]?.id ?? ''
      const antes = chamadas.length
      await rodar(fila, a.escolaId, semPessoa)
      expect(await execucaoDe(semPessoa)).toMatchObject({ estado: 'falhou', erro: ErrorCode.NAO_ENCONTRADO })
      expect(chamadas).toHaveLength(antes)
      expect(await consumosDa(semPessoa)).toBe(0)
    })
  })

  describe('`preparar`: só a seção viva', () => {
    /** Sem modelo, sem consumo, resultado de zero seções; e as seções de `preservadas` seguem apontando para a execução: sem seção viva não é sem candidata, e nada é limpo (P11 é só da sem candidata). */
    const semNada = async (execucaoId: string, chamadas: string[], preservadas: readonly string[] = a.secoes) => {
      expect(chamadas).toEqual([])
      expect(await consumosDa(execucaoId)).toBe(0)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', resultado: { tipo: 'classificacao_do_material', secoes: 0 } })
      for (const secaoId of preservadas) expect((await secaoDe(secaoId))?.execucao_id, secaoId).toBe(execucaoId)
    }

    it('todas corrigidas: conclui sem modelo e sem consumo, e a correção fica como estava', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      await sql('update secao_do_material set corrigida_em = now() where id = any($1::uuid[])', [a.secoes])
      await rodar(fila, a.escolaId, execucaoId)
      await semNada(execucaoId, chamadas)
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.classificada_em).toBeNull()
    })

    it('seções de outra execução: nenhuma é viva para esta', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const outra = await execucaoDaRotina(a)
      const execucaoId = await execucaoDaRotina(a, [])
      await rodar(fila, a.escolaId, execucaoId)
      await semNada(execucaoId, chamadas, [])
      expect((await secaoDe(a.secoes[0] ?? ''))?.execucao_id).toBe(outra)
    })

    it('material excluído entre o agendar e o `preparar`: sem modelo e sem consumo', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      await sql('update material set excluido_em = now() where id = $1', [a.materialId])
      await rodar(fila, a.escolaId, execucaoId)
      await semNada(execucaoId, chamadas)
    })

    it('material que não está `pronto`: sem modelo e sem consumo', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      await sql("update material set estado = 'falhou', falha = 'sem_texto' where id = $1", [a.materialId])
      await rodar(fila, a.escolaId, execucaoId)
      await semNada(execucaoId, chamadas)
    })

    it('disciplina sem componente: sem candidata, conclui sem modelo e limpa as seções da execução (P11), que voltam a `nao_agendada`', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [a.escolaId, a.secoes[0], CODIGO_DE_CNT])
      await sql('update secao_do_material set falhas_seguidas = 2 where id = $1', [a.secoes[0]])
      await sql('update disciplina set componente_bncc = null where id = $1', [a.base.quimica])
      try {
        await rodar(fila, a.escolaId, execucaoId)
      } finally {
        await sql("update disciplina set componente_bncc = 'quimica' where id = $1", [a.base.quimica])
      }
      await semNada(execucaoId, chamadas, [])
      for (const secaoId of a.secoes) {
        expect(await secaoDe(secaoId)).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null })
        expect(await habilidadesDa(secaoId)).toEqual([])
      }
    })

    it('material sem série: sem candidata, conclui sem modelo e limpa as seções da execução (P11)', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      const serieDoMaterial = (await sql<{ serie_id: string }>('select serie_id from material_serie where material_id = $1', [a.materialId])).rows
      await sql('delete from material_serie where material_id = $1', [a.materialId])
      try {
        await rodar(fila, a.escolaId, execucaoId)
      } finally {
        for (const linha of serieDoMaterial) await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [a.escolaId, a.materialId, linha.serie_id])
      }
      await semNada(execucaoId, chamadas, [])
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.execucao_id).toBeNull()
    })

    it('a seção corrigida sai do pedido ao modelo: só as vivas vão, e a correção da coordenação não se toca', async () => {
      const pedidas: string[][] = []
      const candidatasPedidas: string[][] = []
      fila.comModelo((pedido) => {
        const entrada = pedido.entrada as ClassificarSecoesInput
        pedidas.push(entrada.secoes.map((secao) => secao.secaoId))
        candidatasPedidas.push(entrada.candidatas.map((candidata) => candidata.codigo))
        return Promise.resolve({ saida: { secoes: entrada.secoes.map((secao) => ({ secaoId: secao.secaoId, codigos: [CODIGO_DE_CNT] })) }, medicao: {} })
      })
      const execucaoId = await execucaoDaRotina(a)
      await sql('update secao_do_material set corrigida_em = now() where id = $1', [a.secoes[0]])
      await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, 'EM13CNT102', 'coordenacao')", [a.escolaId, a.secoes[0]])
      await rodar(fila, a.escolaId, execucaoId)
      expect(pedidas).toEqual([[a.secoes[1], a.secoes[2]]])
      // As candidatas vão ao modelo na ordem do código, todas de Ciências da Natureza do Médio: a mesma entrada, o mesmo pedido.
      expect(candidatasPedidas[0]?.length).toBeGreaterThan(1)
      expect(candidatasPedidas[0]).toEqual([...(candidatasPedidas[0] ?? [])].sort())
      expect(candidatasPedidas[0]?.every((codigo) => codigo.startsWith('EM13CNT'))).toBe(true)
      expect(await habilidadesDa(a.secoes[0] ?? '')).toEqual([{ codigo: 'EM13CNT102', origem: 'coordenacao' }])
      expect((await execucaoDe(execucaoId)).resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 2 })
    })
  })

  describe('o pedido ao modelo', () => {
    it('leva a fila `lote`, a escola e a execução de quem pediu, e nenhuma pessoa', async () => {
      const pedidos: Array<{ fila: unknown; escolaId: unknown; execucaoId: unknown; alunoId: unknown }> = []
      fila.comModelo((pedido) => {
        pedidos.push({ fila: pedido.fila, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, alunoId: pedido.alunoId })
        const entrada = pedido.entrada as ClassificarSecoesInput
        return Promise.resolve({ saida: { secoes: entrada.secoes.map((secao) => ({ secaoId: secao.secaoId, codigos: [CODIGO_DE_CNT] })) }, medicao: {} })
      })
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect(pedidos).toEqual([{ fila: 'lote', escolaId: a.escolaId, execucaoId, alunoId: undefined }])
    })
  })

  describe('mais de um recorte na mesma execução', () => {
    interface MaterialDeTeste {
      readonly materialId: string
      readonly secaoId: string
    }
    const criados: MaterialDeTeste[] = []
    const componentesOriginais = new Map<string, string | null>()

    const serieDe = async (etapa: string, ano: number): Promise<string> =>
      (await sql<{ id: string }>('insert into serie (escola_id, etapa, ano) values ($1, $2, $3::smallint) on conflict (escola_id, etapa, ano) do update set ano = excluded.ano returning id', [a.escolaId, etapa, ano])).rows[0]?.id ?? ''
    const novoMaterial = async (disciplinaId: string, titulo: string, series: ReadonlyArray<readonly [string, number]>): Promise<MaterialDeTeste> => {
      const materialId = (await sql<{ id: string }>(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
         values ($1, $2, $3, 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'pronto', 1, now() - interval '1 hour') returning id`,
        [a.escolaId, disciplinaId, titulo],
      )).rows[0]?.id ?? ''
      for (const [etapa, ano] of series) await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [a.escolaId, materialId, await serieDe(etapa, ano)])
      await sql('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, 1, $4)', [a.escolaId, disciplinaId, materialId, `texto de ${titulo}`])
      const secaoId = (await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, 1, 1, 1) returning id', [a.escolaId, materialId])).rows[0]?.id ?? ''
      const criado = { materialId, secaoId }
      criados.push(criado)
      return criado
    }
    const trocarComponente = async (disciplinaId: string, componente: string): Promise<void> => {
      if (!componentesOriginais.has(disciplinaId)) componentesOriginais.set(disciplinaId, (await sql<{ componente_bncc: string | null }>('select componente_bncc from disciplina where id = $1', [disciplinaId])).rows[0]?.componente_bncc ?? null)
      await sql('update disciplina set componente_bncc = $2 where id = $1', [disciplinaId, componente])
    }
    /** O modelo que responde, a cada seção, o primeiro código que `escolher` dá para ela entre as candidatas que vieram. */
    const respondeCom = (escolher: (secaoId: string, candidatas: readonly string[]) => string, vistas: { candidatas: string[]; secoes: string[] }) => (pedido: { entrada: unknown }) => {
      const entrada = pedido.entrada as ClassificarSecoesInput
      vistas.candidatas = entrada.candidatas.map((candidata) => candidata.codigo)
      vistas.secoes = entrada.secoes.map((secao) => secao.secaoId)
      return Promise.resolve({ saida: { secoes: entrada.secoes.map((secao) => ({ secaoId: secao.secaoId, codigos: [escolher(secao.secaoId, vistas.candidatas)] })) }, medicao: {} })
    }

    afterEach(async () => {
      for (const { materialId, secaoId } of criados.splice(0)) {
        await sql('delete from secao_do_material where id = $1', [secaoId])
        await sql('delete from trecho where material_id = $1', [materialId])
        await sql('delete from material_serie where material_id = $1', [materialId])
        await sql('delete from material where id = $1', [materialId])
      }
      for (const [disciplinaId, original] of componentesOriginais) await sql('update disciplina set componente_bncc = $2 where id = $1', [disciplinaId, original])
      componentesOriginais.clear()
    })

    it('o Médio e o 8º ano vão juntos: as candidatas dos dois, na ordem do código e sem repetir, e cada seção grava o código do próprio recorte', async () => {
      const doFundamental = await novoMaterial(a.base.quimica, 'Apostila do Fundamental', [['ef_anos_finais', 8]])
      const vistas = { candidatas: [] as string[], secoes: [] as string[] }
      let doOitavo = ''
      fila.comModelo(respondeCom((secaoId, candidatas) => (secaoId === doFundamental.secaoId ? (doOitavo = candidatas.find((codigo) => codigo.startsWith('EF08CI')) ?? '') : CODIGO_DE_CNT), vistas))
      const execucaoId = await execucaoDaRotina(a, [...a.secoes, doFundamental.secaoId])
      await rodar(fila, a.escolaId, execucaoId)
      expect(vistas.candidatas.some((codigo) => codigo.startsWith('EM13CNT'))).toBe(true)
      expect(doOitavo).toMatch(/^EF08CI/)
      expect(vistas.candidatas).toEqual([...vistas.candidatas].sort())
      expect(new Set(vistas.candidatas).size).toBe(vistas.candidatas.length)
      expect((await execucaoDe(execucaoId)).resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 4 })
      expect(await habilidadesDa(doFundamental.secaoId)).toEqual([{ codigo: doOitavo, origem: 'ia' }])
      expect(await habilidadesDa(a.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DE_CNT, origem: 'ia' }])
    })

    it('o código do Médio numa seção do Fundamental: `IA_SAIDA_INVALIDA`, nada gravado e uma falha somada em cada seção', async () => {
      const doFundamental = await novoMaterial(a.base.quimica, 'Apostila do Fundamental', [['ef_anos_finais', 8]])
      const vistas = { candidatas: [] as string[], secoes: [] as string[] }
      fila.comModelo(respondeCom(() => CODIGO_DE_CNT, vistas))
      const todas = [...a.secoes, doFundamental.secaoId]
      const execucaoId = await execucaoDaRotina(a, todas)
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: 'IA_SAIDA_INVALIDA' })
      for (const secaoId of todas) {
        expect(await habilidadesDa(secaoId), secaoId).toEqual([])
        expect(await secaoDe(secaoId), secaoId).toMatchObject({ classificada_em: null, falhas_seguidas: 1, execucao_id: execucaoId })
      }
    })

    it('a união dos recortes acima de 300 candidatas não é cortada: o gateway real recusa a entrada, `IA_ENTRADA_INVALIDA`, sem chamar o provedor e sem tocar nas seções', async () => {
      // Língua Portuguesa do 6º ao 9º e do Médio (267) num material, e Matemática do 6º ao 9º no outro: mais de 300 juntas.
      await trocarComponente(a.base.quimica, 'lingua_portuguesa')
      await trocarComponente(a.base.fisica, 'matematica')
      // A premissa do caso, escrita: a união dos dois recortes passa do teto, contada na tabela da BNCC do banco de teste com o mesmo critério do repository.
      const recorteDeMatematica: SerieDoRecorte[] = [6, 7, 8, 9].map((ano) => ({ etapa: 'ef_anos_finais', ano }))
      const recorteDePortugues: SerieDoRecorte[] = [...recorteDeMatematica, { etapa: 'em', ano: 2 }]
      const codigosDaBncc = (await sql<{ codigo: string }>('select codigo from habilidade_bncc')).rows.map((linha) => linha.codigo)
      const uniao = new Set([
        ...codigosDaBncc.filter((codigo) => habilidadeEhCandidata(codigo, 'lingua_portuguesa', recorteDePortugues)),
        ...codigosDaBncc.filter((codigo) => habilidadeEhCandidata(codigo, 'matematica', recorteDeMatematica)),
      ])
      expect(uniao.size).toBeGreaterThan(CANDIDATAS_MAXIMAS)
      const portugues = await novoMaterial(a.base.quimica, 'Português do 6º ao 9º', [['ef_anos_finais', 6], ['ef_anos_finais', 7], ['ef_anos_finais', 8], ['ef_anos_finais', 9], ['em', 2]])
      const matematica = await novoMaterial(a.base.fisica, 'Matemática do 6º ao 9º', [['ef_anos_finais', 6], ['ef_anos_finais', 7], ['ef_anos_finais', 8], ['ef_anos_finais', 9]])
      // Sem `comModelo`: a recusa é do gateway real, que valida a entrada contra o schema da tarefa antes de reservar o balde.
      const execucaoId = await execucaoDaRotina(a, [portugues.secaoId, matematica.secaoId])
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: 'IA_ENTRADA_INVALIDA' })
      expect(await consumosDa(execucaoId)).toBe(0)
      for (const secaoId of [portugues.secaoId, matematica.secaoId]) expect(await secaoDe(secaoId), secaoId).toMatchObject({ classificada_em: null, falhas_seguidas: 0, execucao_id: execucaoId })
    })

    it('a seção de material sem série não vai ao modelo e volta a `nao_agendada`; as outras são classificadas e não levam as candidatas de outro recorte', async () => {
      const semSerie = await novoMaterial(a.base.quimica, 'Apostila sem série', [])
      const vistas = { candidatas: [] as string[], secoes: [] as string[] }
      fila.comModelo(respondeCom(() => CODIGO_DE_CNT, vistas))
      await sql('update secao_do_material set falhas_seguidas = 2 where id = $1', [semSerie.secaoId])
      await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')", [a.escolaId, semSerie.secaoId, CODIGO_DE_CNT])
      const execucaoId = await execucaoDaRotina(a, [...a.secoes, semSerie.secaoId])
      await rodar(fila, a.escolaId, execucaoId)
      expect([...vistas.secoes].sort()).toEqual([...a.secoes].sort())
      expect((await execucaoDe(execucaoId)).resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 3 })
      expect(await secaoDe(semSerie.secaoId)).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null })
      expect(await habilidadesDa(semSerie.secaoId)).toEqual([])
      for (const secaoId of a.secoes) expect(await habilidadesDa(secaoId), secaoId).toEqual([{ codigo: CODIGO_DE_CNT, origem: 'ia' }])
    })
  })

  describe('a função suspensa', () => {
    it('antes de `rodando`: `FUNCAO_SUSPENSA`, nenhuma chamada, nenhum consumo, a seção segue sem classificação e sem falha somada', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      await sql("insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, 'classificacao_do_material', $2)", [a.escolaId, a.base.coordenacao.usuarioId])
      try {
        await rodar(fila, a.escolaId, execucaoId)
      } finally {
        await sql("delete from suspensao_de_funcao where escola_id = $1 and funcao = 'classificacao_do_material'", [a.escolaId])
      }
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.FUNCAO_SUSPENSA })
      expect(chamadas).toEqual([])
      expect(await consumosDa(execucaoId)).toBe(0)
      for (const secaoId of a.secoes) expect(await secaoDe(secaoId)).toMatchObject({ classificada_em: null, falhas_seguidas: 0 })
    })
  })

  describe('a degradação do lote', () => {
    const adiada = async (execucaoId: string, motivo: string) => {
      const erro = await rodar(fila, a.escolaId, execucaoId).then(
        () => undefined,
        (e: unknown) => e,
      )
      expect(erro).toBeInstanceOf(JobAdiadoError)
      expect((erro as JobAdiadoError).motivo).toBe(motivo)
      return erro as JobAdiadoError
    }

    it('balde cheio (a recusa antes da chamada): a execução volta a `pendente`, o job é adiado com motivo `provedor` pela espera do balde, e nada falhou nem foi somado', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_INDISPONIVEL', 12, 'sem_vaga')))
      const execucaoId = await execucaoDaRotina(a)
      const erro = await adiada(execucaoId, 'provedor')
      expect(erro.baseMs).toBe(12_000)
      expect((await execucaoDe(execucaoId)).estado).toBe('pendente')
      expect(await consumosDa(execucaoId)).toBe(0)
      for (const secaoId of a.secoes) expect(await secaoDe(secaoId)).toMatchObject({ classificada_em: null, falhas_seguidas: 0 })
    })

    it('disjuntor aberto e provedor fora depois da chamada sair: adiam do mesmo jeito, com a espera do disjuntor quando o erro não diz outra', async () => {
      for (const erro of [new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor'), new LLMError('IA_INDISPONIVEL')]) {
        fila.comModelo(() => Promise.reject(erro))
        const execucaoId = await execucaoDaRotina(a)
        const adiamento = await adiada(execucaoId, 'provedor')
        expect(adiamento.baseMs).toBe(30_000)
        expect((await execucaoDe(execucaoId)).estado).toBe('pendente')
        expect((await secaoDe(a.secoes[0] ?? ''))?.falhas_seguidas).toBe(0)
      }
    })

    it('a execução que a varredura encerrou durante a chamada não volta a `pendente` nem adia o job: o provedor fora chega tarde', async () => {
      const execucaoId = await execucaoDaRotina(a)
      fila.comModelo(async () => {
        await sql("update execucao_agente set estado = 'falhou', erro = 'EXECUCAO_INTERROMPIDA', concluida_em = now() where id = $1", [execucaoId])
        throw new LLMError('IA_INDISPONIVEL', 5, 'sem_vaga')
      })
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
    })

    it('a execução adiada roda quando o provedor volta: o mesmo job, a mesma execução, uma gravação', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_INDISPONIVEL', 1, 'sem_vaga')))
      const execucaoId = await execucaoDaRotina(a)
      await adiada(execucaoId, 'provedor')
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', resultado: { tipo: 'classificacao_do_material', secoes: 3 } })
      expect(chamadas).toEqual([execucaoId])
    })

    it('a recusa de soberania é definitiva: `falhou` na hora, sem adiar e sem somar `falhas_seguidas`', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_INDISPONIVEL', undefined, 'soberania')))
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_INDISPONIVEL })
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.falhas_seguidas).toBe(0)
    })
  })

  describe('a janela letiva', () => {
    it('o job que volta às 10h05 de segunda: não chama o modelo, não passa a `rodando` e é adiado até as 18h, com motivo `janela`', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      fila.fixarHorario(NA_JANELA, JANELA_DA_ESCOLA)
      const execucaoId = await execucaoDaRotina(a)
      const erro = await rodar(fila, a.escolaId, execucaoId).then(
        () => undefined,
        (e: unknown) => e,
      )
      expect(erro).toBeInstanceOf(JobAdiadoError)
      expect((erro as JobAdiadoError).motivo).toBe('janela')
      // 10h05 → 18h00: 7 h 55 min.
      expect((erro as JobAdiadoError).baseMs).toBe((7 * 60 + 55) * 60_000)
      expect(chamadas).toEqual([])
      expect((await execucaoDe(execucaoId)).estado).toBe('pendente')
      expect(await consumosDa(execucaoId)).toBe(0)
    })

    it('o job que o provedor adiou de madrugada e volta às 7h05, cinco minutos depois da abertura: a janela o adia de novo até as 18h, sem chamar o modelo e sem gastar tentativa', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_INDISPONIVEL', 1, 'sem_vaga')))
      fila.fixarHorario(FORA_DA_JANELA, JANELA_DA_ESCOLA)
      const execucaoId = await execucaoDaRotina(a)
      const daMadrugada = await rodar(fila, a.escolaId, execucaoId).then(() => undefined, (e: unknown) => e)
      expect((daMadrugada as JobAdiadoError).motivo).toBe('provedor')

      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      fila.fixarHorario(LOGO_DEPOIS_DA_ABERTURA, JANELA_DA_ESCOLA)
      const erro = await rodar(fila, a.escolaId, execucaoId).then(() => undefined, (e: unknown) => e)
      expect(erro).toBeInstanceOf(JobAdiadoError)
      expect((erro as JobAdiadoError).motivo).toBe('janela')
      // 7h05 → 18h00: 10 h 55 min.
      expect((erro as JobAdiadoError).baseMs).toBe((10 * 60 + 55) * 60_000)
      expect(chamadas).toEqual([])
      expect((await execucaoDe(execucaoId)).estado).toBe('pendente')
    })

    it('a janela é a da escola: com horário letivo mais curto, o mesmo instante já está fora e a execução roda', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      fila.fixarHorario(NA_JANELA, { ...JANELA_DA_ESCOLA, inicio: '07:00', fim: '10:00' })
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect((await execucaoDe(execucaoId)).estado).toBe('concluida')
      expect(chamadas).toEqual([execucaoId])
    })

    it('fora da janela, às 19h05, roda; e a `pendente` que a varredura vê às 10h, com o job vivo, segue `pendente`', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      fila.fixarHorario(FORA_DA_JANELA, JANELA_DA_ESCOLA)
      const rodada = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, rodada)
      expect((await execucaoDe(rodada)).estado).toBe('concluida')

      const esperando = await execucaoDaRotina(b)
      await enfileirar(fila, b.escolaId, esperando)
      await new VarreduraDeExecucoes(fila.banco, fila.log.logger, fila.destino, medidor.medidor).varrer()
      expect((await execucaoDe(esperando)).estado).toBe('pendente')
    })
  })

  describe('a `pendente` que a varredura vê no horário letivo', () => {
    it('às 10h, com o job já adiado pela janela e ainda vivo, a `pendente` segue `pendente`: só o job que acabou a deixa sem dono', async () => {
      fila.fixarHorario(NA_JANELA, JANELA_DA_ESCOLA)
      const esperando = await execucaoDaRotina(b)
      await enfileirar(fila, b.escolaId, esperando)
      const adiado = await rodar(fila, b.escolaId, esperando).then(() => undefined, (e: unknown) => e)
      expect((adiado as JobAdiadoError).motivo).toBe('janela')
      // `ativo` é o estado do job vivo que a varredura procura (o adiamento da janela o devolve à fila e o worker o pega de novo): o teste o fixa à mão, porque o adiamento de verdade só o deixa assim por instantes.
      await sql("update job_registro set estado = 'ativo' where tipo = 'ia.executar-lote' and dados ->> 'execucaoId' = $1", [esperando])
      const varredura = new VarreduraDeExecucoes(fila.banco, fila.log.logger, fila.destino, medidor.medidor)
      await varredura.varrer()
      expect((await execucaoDe(esperando)).estado).toBe('pendente')
      // O job termina (concluído ou falho): a `pendente` fica sem dono e a varredura a encerra.
      await sql("update job_registro set estado = 'falhou' where tipo = 'ia.executar-lote' and dados ->> 'execucaoId' = $1", [esperando])
      await varredura.varrer()
      expect(await execucaoDe(esperando)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
    })
  })

  describe('a janela é só do lote', () => {
    it('o job entregue de novo às 10h05, com a execução já `concluida`: termina sem adiar e sem nova chamada', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      fila.fixarHorario(FORA_DA_JANELA, JANELA_DA_ESCOLA)
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      fila.fixarHorario(NA_JANELA, JANELA_DA_ESCOLA)
      await rodar(fila, a.escolaId, execucaoId)
      expect(chamadas).toEqual([execucaoId])
      expect((await execucaoDe(execucaoId)).estado).toBe('concluida')
    })
  })

  describe('a classificação não se agenda por requisição', () => {
    it('o agendador da API recusa a tarefa do lote, mesmo no contexto de uma pessoa, e não grava execução nenhuma', async () => {
      const antes = Number((await sql<{ total: string }>('select count(*) as total from execucao_agente where escola_id = $1', [a.escolaId])).rows[0]?.total)
      const contexto = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.base.coordenacao.usuarioId, papel: 'professor' as const, sessaoId: randomUUID(), anoLetivoId: a.base.anoLetivoId }
      await expect(runInContext(contexto, () => fila.agendador().agendar({ comando: 'classificar_secoes', chaveEnvio: randomUUID(), entradaDaExecucao: { tarefa: 'classificar_secoes' } }))).rejects.toThrow('a tarefa do lote não se agenda por requisição')
      expect(Number((await sql<{ total: string }>('select count(*) as total from execucao_agente where escola_id = $1', [a.escolaId])).rows[0]?.total)).toBe(antes)
    })
  })

  describe('a entrega dupla (D49)', () => {
    /**
     * Duas entregas do mesmo job ao mesmo tempo, com a ordem forçada (como em `execucao-interrompida.int.test.ts`): as duas leem `pendente`, a trava segura o `update` para `rodando`, a primeira passa e fica
     * no modelo, a segunda acha a linha `rodando` e a encerra `EXECUCAO_INTERROMPIDA`; só então o modelo da primeira responde.
     */
    async function duasEntregasAoMesmoTempo(execucaoId: string, liberarOModelo: () => void): Promise<void> {
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'execucao_agente', evento: 'update', quando: `new.id = '${execucaoId}'::uuid and new.estado = 'rodando'` })
      await parada.armar()
      try {
        const entregas = [rodar(fila, a.escolaId, execucaoId), rodar(fila, a.escolaId, execucaoId)]
        await parada.esperarParadas(1)
        await esperarNaTrava(bancada.pool, '%update "execucao_agente" set "estado"%', 2)
        await parada.soltar()
        await esperar(async () => (await execucaoDe(execucaoId)).estado === 'falhou', 'a segunda entrega encerrar a execução')
        liberarOModelo()
        await Promise.all(entregas)
      } finally {
        await parada.desarmar()
      }
    }

    it('duas entregas ao mesmo tempo: o modelo é chamado uma vez, a segunda encerra a execução `EXECUCAO_INTERROMPIDA` e a gravação da primeira se desfaz', async () => {
      const chamadas: string[] = []
      let liberar: () => void = () => undefined
      const solta = new Promise<void>((resolver) => (liberar = resolver))
      const responde = respondeComUmCodigo(chamadas)
      fila.comModelo(async (pedido) => {
        await solta
        return responde(pedido)
      })
      const execucaoId = await execucaoDaRotina(a)
      await duasEntregasAoMesmoTempo(execucaoId, liberar)
      expect(chamadas).toEqual([execucaoId])
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA, resultado: null })
      expect(await linhasDeConsumoDa(execucaoId)).toEqual([estimadaDaRotina(a.escolaId)])
      for (const secaoId of a.secoes) {
        expect(await secaoDe(secaoId), secaoId).toMatchObject({ classificada_em: null, falhas_seguidas: 0, execucao_id: execucaoId })
        expect(await habilidadesDa(secaoId), secaoId).toEqual([])
      }
    })

    it('duas entregas ao mesmo tempo e a saída da primeira inválida: chega tarde e não soma em `falhas_seguidas`, porque a execução já foi encerrada como interrompida', async () => {
      const chamadas: string[] = []
      let liberar: () => void = () => undefined
      const solta = new Promise<void>((resolver) => (liberar = resolver))
      fila.comModelo(async (pedido) => {
        chamadas.push(pedido.execucaoId ?? '')
        await solta
        throw new LLMError('IA_SAIDA_INVALIDA')
      })
      const execucaoId = await execucaoDaRotina(a)
      await duasEntregasAoMesmoTempo(execucaoId, liberar)
      expect(chamadas).toEqual([execucaoId])
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
      expect(await linhasDeConsumoDa(execucaoId)).toEqual([estimadaDaRotina(a.escolaId)])
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.falhas_seguidas, secaoId).toBe(0)
    })

    it('o job entregue de novo depois de concluir: uma chamada ao modelo, um consumo, uma gravação', async () => {
      // O provedor da bancada, sem o `comModelo`: a chamada passa pelo gateway e deixa a linha em `consumo_ia`, que é o que conta as chamadas.
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect(await consumosDa(execucaoId)).toBe(1)
      const gravada = (await secaoDe(a.secoes[0] ?? ''))?.classificada_em
      expect(gravada).not.toBeNull()
      await rodar(fila, a.escolaId, execucaoId)
      expect(await consumosDa(execucaoId)).toBe(1)
      expect((await secaoDe(a.secoes[0] ?? ''))?.classificada_em).toEqual(gravada)
      expect((await habilidadesDa(a.secoes[0] ?? '')).length).toBeGreaterThan(0)
      expect((await execucaoDe(execucaoId)).resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 3 })
    })
  })

  describe('`falhas_seguidas`, no worker', () => {
    it('a saída inválida soma 1 nas doze seções da execução, e o sucesso seguinte zera', async () => {
      // O lote cheio: `SECOES_POR_EXECUCAO` seções, as três do material e as demais da mesma apostila.
      const extras: string[] = []
      for (let ordem = a.secoes.length + 1; ordem <= SECOES_POR_EXECUCAO; ordem++) {
        extras.push((await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, 1, 1) returning id', [a.escolaId, a.materialId, ordem])).rows[0]?.id ?? '')
      }
      const doze = [...a.secoes, ...extras]
      expect(doze).toHaveLength(SECOES_POR_EXECUCAO)
      try {
        fila.comModelo(() => Promise.reject(new LLMError('IA_SAIDA_INVALIDA')))
        const primeira = await execucaoDaRotina(a, doze)
        await rodar(fila, a.escolaId, primeira)
        expect(await execucaoDe(primeira)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_SAIDA_INVALIDA })
        for (const secaoId of doze) expect((await secaoDe(secaoId))?.falhas_seguidas, secaoId).toBe(1)

        const segunda = await execucaoDaRotina(a, doze)
        await rodar(fila, a.escolaId, segunda)
        for (const secaoId of doze) expect((await secaoDe(secaoId))?.falhas_seguidas, secaoId).toBe(2)

        fila.comModelo(respondeComUmCodigo([]))
        const terceira = await execucaoDaRotina(a, doze)
        await rodar(fila, a.escolaId, terceira)
        expect((await execucaoDe(terceira)).estado).toBe('concluida')
        for (const secaoId of doze) expect((await secaoDe(secaoId))?.falhas_seguidas, secaoId).toBe(0)
      } finally {
        await sql('delete from habilidade_da_secao where secao_id = any($1::uuid[])', [extras])
        await sql('delete from secao_do_material where id = any($1::uuid[])', [extras])
      }
    })

    it('a execução que a varredura encerrou durante a chamada não soma: a saída inválida chega tarde', async () => {
      const execucaoId = await execucaoDaRotina(a)
      fila.comModelo(async () => {
        await sql("update execucao_agente set estado = 'falhou', erro = 'EXECUCAO_INTERROMPIDA', concluida_em = now() where id = $1", [execucaoId])
        throw new LLMError('IA_SAIDA_INVALIDA')
      })
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.falhas_seguidas).toBe(0)
    })

    it('o job entregue de novo depois de falhar soma uma falha só: a segunda entrega acha a execução já `falhou`', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_SAIDA_INVALIDA')))
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      await rodar(fila, a.escolaId, execucaoId)
      expect((await execucaoDe(execucaoId)).erro).toBe(ErrorCode.IA_SAIDA_INVALIDA)
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.falhas_seguidas).toBe(1)
    })

    it('o tempo esgotado e a execução interrompida pela varredura não somam: só a saída inválida é culpa da seção', async () => {
      fila.comModelo(() => Promise.reject(new LLMError('IA_TEMPO_ESGOTADO')))
      const esgotada = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, esgotada)
      expect(await execucaoDe(esgotada)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_TEMPO_ESGOTADO })

      // O worker morreu no meio: a execução ficou `rodando` há mais do que o limite, e a varredura a encerra. Um segundo antes do limite ela ainda vale; um depois, não.
      const varredura = new VarreduraDeExecucoes(fila.banco, fila.log.logger, fila.destino, medidor.medidor)
      const rodandoHa = async (segundos: number) => {
        const id = await execucaoDaRotina(a)
        await sql("update execucao_agente set estado = 'rodando', iniciada_em = now() - make_interval(secs => $2) where id = $1", [id, segundos])
        return id
      }
      const quaseNoLimite = await rodandoHa(LIMITE_DA_RODANDO_SEGUNDOS - 5)
      await varredura.varrer()
      expect((await execucaoDe(quaseNoLimite)).estado).toBe('rodando')
      const morta = await rodandoHa(LIMITE_DA_RODANDO_SEGUNDOS + 1)
      await varredura.varrer()
      expect(await execucaoDe(morta)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.falhas_seguidas).toBe(0)
    })

    it('o job reentregue de uma classificação que um worker morto deixou `rodando`: a reentrega a encerra `EXECUCAO_INTERROMPIDA`, sem chamar o modelo e sem somar', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const execucaoId = await execucaoDaRotina(a)
      await sql("update execucao_agente set estado = 'rodando', iniciada_em = now() - interval '2 minutes' where id = $1", [execucaoId])
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.EXECUCAO_INTERROMPIDA })
      expect(await linhasDeConsumoDa(execucaoId)).toEqual([estimadaDaRotina(a.escolaId)])
      expect(chamadas).toEqual([])
      for (const secaoId of a.secoes) expect((await secaoDe(secaoId))?.falhas_seguidas, secaoId).toBe(0)
    })
  })

  describe('o que muda entre o `preparar` e o `concluir`', () => {
    it('P1a: a seção que a coordenação corrige durante a chamada não é sobrescrita, e as outras são gravadas', async () => {
      fila.comModelo(async (pedido) => {
        await sql('update secao_do_material set corrigida_em = now() where id = $1', [a.secoes[0]])
        await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, 'EM13CNT102', 'coordenacao')", [a.escolaId, a.secoes[0]])
        return respondeComUmCodigo([])(pedido)
      })
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect((await execucaoDe(execucaoId)).resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 2 })
      expect(await habilidadesDa(a.secoes[0] ?? '')).toEqual([{ codigo: 'EM13CNT102', origem: 'coordenacao' }])
      expect((await secaoDe(a.secoes[0] ?? ''))?.classificada_em).toBeNull()
      expect((await secaoDe(a.secoes[1] ?? ''))?.classificada_em).not.toBeNull()
    })

    it('P9: a seção que passou a outra execução por SQL durante a chamada não é gravada por esta', async () => {
      const outra = await execucaoDaRotina(a, [])
      fila.comModelo(async (pedido) => {
        await sql('update secao_do_material set execucao_id = $1 where id = $2', [outra, a.secoes[0]])
        return respondeComUmCodigo([])(pedido)
      })
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect((await execucaoDe(execucaoId)).resultado).toEqual({ tipo: 'classificacao_do_material', secoes: 2 })
      expect(await secaoDe(a.secoes[0] ?? '')).toMatchObject({ execucao_id: outra, classificada_em: null })
      expect(await habilidadesDa(a.secoes[0] ?? '')).toEqual([])
    })

    it('P4: o material excluído durante a chamada não recebe habilidade nenhuma, e a execução conclui sem efeito', async () => {
      fila.comModelo(async (pedido) => {
        await sql('update material set excluido_em = now() where id = $1', [a.materialId])
        return respondeComUmCodigo([])(pedido)
      })
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', resultado: { tipo: 'classificacao_do_material', secoes: 0 } })
      for (const secaoId of a.secoes) {
        expect((await secaoDe(secaoId))?.classificada_em).toBeNull()
        expect(await habilidadesDa(secaoId)).toEqual([])
      }
    })

    it('P4: o material que deixa de estar `pronto` durante a chamada também não recebe habilidade', async () => {
      fila.comModelo(async (pedido) => {
        await sql("update material set estado = 'falhou', falha = 'sem_texto' where id = $1", [a.materialId])
        return respondeComUmCodigo([])(pedido)
      })
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', resultado: { tipo: 'classificacao_do_material', secoes: 0 } })
      for (const secaoId of a.secoes) expect(await habilidadesDa(secaoId)).toEqual([])
    })

    it('a gravação troca só as habilidades `ia` das seções da execução: a da coordenação e a `ia` de outra execução ficam', async () => {
      const outra = await execucaoDaRotina(a, [a.secoes[2] ?? ''])
      const execucaoId = await execucaoDaRotina(a, [a.secoes[0] ?? '', a.secoes[1] ?? ''])
      const poe = (secaoId: string | undefined, codigo: string, origem: string) => sql('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [a.escolaId, secaoId, codigo, origem])
      await poe(a.secoes[1], 'EM13CNT102', 'ia')
      await poe(a.secoes[1], 'EM13CNT103', 'coordenacao')
      await poe(a.secoes[2], 'EM13CNT102', 'ia')
      fila.comModelo(respondeComUmCodigo([]))
      await rodar(fila, a.escolaId, execucaoId)
      expect(await habilidadesDa(a.secoes[1] ?? '')).toEqual([
        { codigo: 'EM13CNT101', origem: 'ia' },
        { codigo: 'EM13CNT103', origem: 'coordenacao' },
      ])
      expect(await habilidadesDa(a.secoes[2] ?? '')).toEqual([{ codigo: 'EM13CNT102', origem: 'ia' }])
      expect((await secaoDe(a.secoes[2] ?? ''))?.execucao_id).toBe(outra)
    })

    it('a seção sem código: fica classificada, e as habilidades `ia` de antes saem', async () => {
      const execucaoId = await execucaoDaRotina(a)
      await sql("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, 'EM13CNT102', 'ia')", [a.escolaId, a.secoes[0]])
      fila.comModelo((pedido) => Promise.resolve({ saida: { secoes: (pedido.entrada as ClassificarSecoesInput).secoes.map((secao) => ({ secaoId: secao.secaoId, codigos: [] })) }, medicao: {} }))
      await rodar(fila, a.escolaId, execucaoId)
      for (const secaoId of a.secoes) {
        expect((await secaoDe(secaoId))?.classificada_em).not.toBeNull()
        expect(await habilidadesDa(secaoId)).toEqual([])
      }
    })

    it('P4b: com a gravação aberta, a exclusão do material espera a transação (`for share`), e só depois a exclusão passa', async () => {
      const execucaoId = await execucaoDaRotina(a)
      const respostas = a.secoes.map((secaoId) => ({ secaoId, codigos: [CODIGO_DE_CNT] }))
      let exclusaoEsperou = false
      await comoEscola(a.escolaId, () =>
        fila.banco.transaction(async (tx) => {
          const gravadas = await new SecoesRepository(tx).saveClassificacao(execucaoId, respostas)
          expect(gravadas).toHaveLength(3)
          const cliente = await bancada.pool.connect()
          try {
            await cliente.query('begin')
            await cliente.query("set local lock_timeout = '400ms'")
            await cliente.query('update material set excluido_em = now() where id = $1', [a.materialId]).then(
              () => undefined,
              (erro: unknown) => {
                exclusaoEsperou = /lock timeout/u.test(String((erro as Error).message))
              },
            )
            await cliente.query('rollback')
          } finally {
            cliente.release()
          }
        }),
      )
      expect(exclusaoEsperou).toBe(true)
      expect((await sql('update material set excluido_em = now() where id = $1', [a.materialId])).rowCount).toBe(1)
    })
  })

  describe('o repository da classificação, direto', () => {
    const noContextoDaA = <Resultado>(trabalho: () => Promise<Resultado>): Promise<Resultado> => comoEscola(a.escolaId, trabalho)

    it('`paginasDaSecao` lê só as páginas da seção, e só do material dela', async () => {
      const outro = (await sql<{ id: string }>(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
         values ($1, $2, 'Outra apostila', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'pronto', 3, now()) returning id`,
        [a.escolaId, a.base.quimica],
      )).rows[0]?.id
      await sql('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, 2, $4)', [a.escolaId, a.base.quimica, outro, 'texto do outro material'])
      try {
        const paginas = await noContextoDaA(() => new SecoesRepository(fila.banco).paginasDaSecao(a.materialId, 2, 2))
        expect(paginas).toHaveLength(1)
        expect(paginas[0]).toContain('Subtítulo sigiloso 2')
        const tres = await noContextoDaA(() => new SecoesRepository(fila.banco).paginasDaSecao(a.materialId, 1, 3))
        expect(tres).toHaveLength(3)
      } finally {
        await sql('delete from trecho where material_id = $1', [outro])
        await sql('delete from material where id = $1', [outro])
      }
    })

    it('`recorteDosMateriais` devolve só o que foi pedido, e só da escola do contexto', async () => {
      const outro = (await sql<{ id: string }>(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
         values ($1, $2, 'Outra apostila', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'pronto', 3, now()) returning id`,
        [a.escolaId, a.base.fisica],
      )).rows[0]?.id
      await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [a.escolaId, outro, a.base.serieId])
      try {
        const recorte = await noContextoDaA(() => new SecoesRepository(fila.banco).recorteDosMateriais([a.base.quimica], [a.materialId]))
        expect([...recorte.componentes.keys()]).toEqual([a.base.quimica])
        expect([...recorte.series.keys()]).toEqual([a.materialId])
        expect(recorte.series.get(a.materialId)).toEqual([{ etapa: 'em', ano: 2 }])
        const daOutra = await noContextoDaA(() => new SecoesRepository(fila.banco).recorteDosMateriais([b.base.quimica], [b.materialId]))
        expect(daOutra.componentes.size).toBe(0)
        expect(daOutra.series.size).toBe(0)
      } finally {
        await sql('delete from material_serie where material_id = $1', [outro])
        await sql('delete from material where id = $1', [outro])
      }
    })

    it('`candidatasDoRecorte`: só as do componente e das séries, e nenhuma sem série', async () => {
      const bncc = new BnccRepository(fila.banco)
      const doMedio = await candidatasDoRecorte(bncc, 'quimica', [{ etapa: 'em', ano: 2 }])
      expect(doMedio.length).toBeGreaterThan(1)
      expect(doMedio.every((candidata) => candidata.codigo.startsWith('EM13CNT'))).toBe(true)
      expect(doMedio.map((candidata) => candidata.codigo)).toEqual(doMedio.map((candidata) => candidata.codigo).sort())
      expect(await candidatasDoRecorte(bncc, 'quimica', [])).toEqual([])
    })

    it('`clearDaExecucao` limpa só as seções não corrigidas da execução, e só as habilidades `ia` delas', async () => {
      const [primeira = '', segunda = '', terceira = ''] = a.secoes
      const exec1 = await execucaoDaRotina(a, [primeira, segunda])
      const exec2 = await execucaoDaRotina(a, [terceira])
      await sql('update secao_do_material set corrigida_em = now() where id = $1', [segunda])
      const poe = (secaoId: string | undefined, codigo: string, origem: string) => sql('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [a.escolaId, secaoId, codigo, origem])
      for (const secaoId of a.secoes) await poe(secaoId, 'EM13CNT101', 'ia')
      await poe(primeira, 'EM13CNT102', 'coordenacao')
      await sql('update secao_do_material set falhas_seguidas = 3, classificada_em = now() where id = any($1::uuid[])', [a.secoes])
      expect(await noContextoDaA(() => new SecoesRepository(fila.banco).clearDaExecucao(exec1))).toBe(1)
      expect(await secaoDe(primeira)).toMatchObject({ execucao_id: null, falhas_seguidas: 0, classificada_em: null })
      expect(await habilidadesDa(primeira)).toEqual([{ codigo: 'EM13CNT102', origem: 'coordenacao' }])
      expect(await secaoDe(segunda)).toMatchObject({ execucao_id: exec1, falhas_seguidas: 3 })
      expect(await habilidadesDa(segunda)).toEqual([{ codigo: 'EM13CNT101', origem: 'ia' }])
      expect(await secaoDe(terceira)).toMatchObject({ execucao_id: exec2, falhas_seguidas: 3 })
      expect(await habilidadesDa(terceira)).toEqual([{ codigo: 'EM13CNT101', origem: 'ia' }])
    })

    it('`somarFalha` soma 1 só nas seções da execução, e na escola do contexto', async () => {
      const exec1 = await execucaoDaRotina(a, [a.secoes[0] ?? '', a.secoes[1] ?? ''])
      await execucaoDaRotina(a, [a.secoes[2] ?? ''])
      await noContextoDaA(() => new SecoesRepository(fila.banco).somarFalha(exec1))
      expect([(await secaoDe(a.secoes[0] ?? ''))?.falhas_seguidas, (await secaoDe(a.secoes[1] ?? ''))?.falhas_seguidas, (await secaoDe(a.secoes[2] ?? ''))?.falhas_seguidas]).toEqual([1, 1, 0])
    })

    it('`saveClassificacao` sem resposta não grava nada', async () => {
      const execucaoId = await execucaoDaRotina(a)
      expect(await noContextoDaA(() => new SecoesRepository(fila.banco).saveClassificacao(execucaoId, []))).toEqual([])
      expect((await secaoDe(a.secoes[0] ?? ''))?.classificada_em).toBeNull()
    })
  })

  describe('o repository da execução, para a rotina', () => {
    const insere = async (escola: Escola, campos: { solicitadaPor?: string; entrada?: unknown; estado?: string }) =>
      (await sql<{ id: string }>(
        `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, iniciada_em)
         values ($1, null, 'classificacao_do_material', 'classificar_secoes', $2, $3, $4, $5, case when $5 = 'rodando' then now() else null end) returning id`,
        [escola.escolaId, campos.solicitadaPor ?? null, randomUUID(), JSON.stringify(campos.entrada ?? { tarefa: 'classificar_secoes' }), campos.estado ?? 'pendente'],
      )).rows[0]?.id ?? ''
    const naA = <Resultado>(trabalho: (repositorio: ExecucaoRepository) => Promise<Resultado>): Promise<Resultado> => comoEscola(a.escolaId, () => trabalho(new ExecucaoRepository(fila.banco)))

    it('`paraExecutarDaRotina` acha só a execução da escola, sem pessoa e com a entrada válida', async () => {
      const valida = await insere(a, {})
      const daB = await insere(b, {})
      const comPessoa = await insere(a, { solicitadaPor: a.base.coordenacao.usuarioId })
      const deEntradaInvalida = await insere(a, { entrada: { tarefa: 'classificar_secoes', sobra: true } })
      expect((await naA((r) => r.paraExecutarDaRotina(valida)))?.id).toBe(valida)
      expect(await naA((r) => r.paraExecutarDaRotina(randomUUID()))).toBeUndefined()
      expect(await naA((r) => r.paraExecutarDaRotina(daB))).toBeUndefined()
      expect(await naA((r) => r.paraExecutarDaRotina(comPessoa))).toBeUndefined()
      expect(await naA((r) => r.paraExecutarDaRotina(deEntradaInvalida))).toBeUndefined()
    })

    it('`voltarAPendente` só volta a `rodando` da escola, e `falharPendente` só falha a `pendente` da escola', async () => {
      const rodando = await insere(a, { estado: 'rodando' })
      const pendente = await insere(a, { estado: 'pendente' })
      const rodandoDaB = await insere(b, { estado: 'rodando' })
      const pendenteDaB = await insere(b, { estado: 'pendente' })
      expect(await naA((r) => r.voltarAPendente(randomUUID()))).toBe(false)
      expect(await naA((r) => r.voltarAPendente(pendente))).toBe(false)
      expect(await naA((r) => r.voltarAPendente(rodandoDaB))).toBe(false)
      expect(await naA((r) => r.voltarAPendente(rodando))).toBe(true)
      expect((await execucaoDe(rodando)).estado).toBe('pendente')
      const rodandoDeNovo = await insere(a, { estado: 'rodando' })
      expect(await naA((r) => r.falharPendente(randomUUID(), ErrorCode.FUNCAO_SUSPENSA))).toBe(false)
      expect(await naA((r) => r.falharPendente(rodandoDeNovo, ErrorCode.FUNCAO_SUSPENSA))).toBe(false)
      expect(await naA((r) => r.falharPendente(pendenteDaB, ErrorCode.FUNCAO_SUSPENSA))).toBe(false)
      expect(await naA((r) => r.falharPendente(pendente, ErrorCode.FUNCAO_SUSPENSA))).toBe(true)
      expect(await execucaoDe(pendente)).toMatchObject({ estado: 'falhou', erro: ErrorCode.FUNCAO_SUSPENSA })
    })
  })

  describe('isolamento entre escolas', () => {
    it('o repository, no contexto da A, não lê, não grava e não soma nada da execução da B', async () => {
      const daB = await execucaoDaRotina(b)
      await comoEscola(a.escolaId, async () => {
        const repositorio = new SecoesRepository(fila.banco)
        expect(await repositorio.vivasDaExecucao(daB, 12)).toEqual([])
        expect(await repositorio.saveClassificacao(daB, b.secoes.map((secaoId) => ({ secaoId, codigos: [CODIGO_DE_CNT] })))).toEqual([])
        expect(await repositorio.clearDaExecucao(daB)).toBe(0)
        await repositorio.somarFalha(daB)
        expect(await repositorio.paginasDaSecao(b.materialId, 1, 3)).toEqual([])
      })
      for (const secaoId of b.secoes) expect(await secaoDe(secaoId)).toMatchObject({ execucao_id: daB, classificada_em: null, falhas_seguidas: 0 })
      expect(await habilidadesDa(b.secoes[0] ?? '')).toEqual([])
    })

    it('o repository da A grava a resposta da própria seção e ignora, sem quebrar, a da seção da B que veio junto', async () => {
      const daA = await execucaoDaRotina(a, [a.secoes[0] ?? ''])
      const daB = await execucaoDaRotina(b, [b.secoes[0] ?? ''])
      const gravadas = await comoEscola(a.escolaId, () =>
        new SecoesRepository(fila.banco).saveClassificacao(daA, [
          { secaoId: b.secoes[0] ?? '', codigos: [CODIGO_DE_CNT] },
          { secaoId: a.secoes[0] ?? '', codigos: [CODIGO_DE_CNT] },
        ]),
      )
      expect(gravadas.map((gravada) => gravada.secaoId)).toEqual([a.secoes[0]])
      expect(await habilidadesDa(a.secoes[0] ?? '')).toEqual([{ codigo: CODIGO_DE_CNT, origem: 'ia' }])
      expect(await habilidadesDa(b.secoes[0] ?? '')).toEqual([])
      expect(await secaoDe(b.secoes[0] ?? '')).toMatchObject({ execucao_id: daB, classificada_em: null })
      expect(await secaoDe(a.secoes[1] ?? ''), 'a vizinha da mesma escola, fora da execução, não é marcada como classificada').toMatchObject({ classificada_em: null })
    })

    it('o job da A com o `execucaoId` da B: nada muda, o modelo não roda, e o job é recusado', async () => {
      const chamadas: string[] = []
      fila.comModelo(respondeComUmCodigo(chamadas))
      const daB = await execucaoDaRotina(b)
      await expect(rodar(fila, a.escolaId, daB)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' })
      expect(chamadas).toEqual([])
      expect((await execucaoDe(daB)).estado).toBe('pendente')
      for (const secaoId of b.secoes) expect(await secaoDe(secaoId)).toMatchObject({ classificada_em: null, falhas_seguidas: 0 })
    })

    it('a execução da A com a seção da B apontando para ela é impossível: a FK composta recusa', async () => {
      const daA = await execucaoDaRotina(a, [])
      await expect(sql('update secao_do_material set execucao_id = $1 where id = $2', [daA, b.secoes[0]])).rejects.toThrow(/secao_do_material_execucao_da_escola_fk/u)
    })
  })

  describe('log e métrica', () => {
    it('a espera da classificação sai por escola, em segundos desde o envio do material', async () => {
      fila.comModelo(respondeComUmCodigo([]))
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      const pontos = (await medidor.pontos('material.classificacao.espera')).filter((ponto) => ponto.atributos['escola_id'] === a.escolaId)
      expect(pontos).toHaveLength(1)
      const { contagem, soma } = pontos[0]?.valor as { contagem: number; soma: number }
      expect(contagem).toBeGreaterThanOrEqual(3)
      // O material foi enviado há 2 horas: cada seção esperou mais que isso.
      expect(soma).toBeGreaterThan(contagem * 7_000)
      // Só a escola no rótulo: nunca o material, a seção, o título nem o código.
      expect(Object.keys(pontos[0]?.atributos ?? {})).toEqual(['escola_id'])
    })

    it('o log da execução leva ids, a tarefa e o código: nunca o título, o texto da página nem o código escolhido', async () => {
      fila.comModelo(respondeComUmCodigo([]))
      const execucaoId = await execucaoDaRotina(a)
      await rodar(fila, a.escolaId, execucaoId)
      const daExecucao = fila.log.linhas.filter((linha) => linha.includes(execucaoId))
      expect(daExecucao.length).toBeGreaterThan(0)
      expect(daExecucao.join('\n')).toContain('ia.execucao')
      const texto = fila.log.linhas.join('\n')
      for (const proibido of ['sigiloso', 'Apostila de teste', CODIGO_DE_CNT, a.textoDaHabilidade.slice(0, 40)]) expect(texto, proibido).not.toContain(proibido)
    })
  })
})

describe('o prazo único do lote', () => {
  let fila: FilaDeIa
  let a: Escola
  let prazo: AbortController

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, {
      semConsumir: true,
      prazo: () => {
        prazo = new AbortController()
        return { sinal: prazo.signal, cancelar: () => undefined }
      },
    })
    a = await montarEscola(fila)
  })

  afterAll(async () => {
    await fila.fechar()
    await sql('delete from consumo_ia where escola_id = $1', [a.escolaId])
    await sql('delete from execucao_agente where escola_id = $1', [a.escolaId])
    await sql('delete from configuracao_operacional_escola where escola_id = $1', [a.escolaId])
  })

  it('o provedor fora que chega depois de o prazo estourar não adia o lote: a execução falha com `IA_TEMPO_ESGOTADO`', async () => {
    const execucaoId = await execucaoDaRotina(a)
    fila.comModelo(() => {
      prazo.abort()
      return Promise.reject(new LLMError('IA_INDISPONIVEL', 5, 'sem_vaga'))
    })
    await rodar(fila, a.escolaId, execucaoId)
    expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'falhou', erro: ErrorCode.IA_TEMPO_ESGOTADO })
  })
})

describe('a janela letiva é só do lote', () => {
  let fila: FilaDeIa
  let a: Escola

  beforeAll(async () => {
    // Um registro só com a ferramenta do Assistente, de uma pessoa: o `preparar` entrega a entrada que o modelo de mentira ignora, e o `concluir` devolve só a referência.
    const registro = new RegistroDeComandos()
    const ferramenta: ExecucaoCommand<EntradaDaTarefa<typeof proporFerramenta>, SaidaDaTarefa<typeof proporFerramenta>, Record<string, never>> = {
      tarefa: proporFerramenta,
      fila: 'ferramenta',
      preparar: () => Promise.resolve({ entrada: {} as EntradaDaTarefa<typeof proporFerramenta>, lido: {} }),
      concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'mensagem', mensagemId: randomUUID() }),
    }
    registro.registrar(ferramenta)
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { semConsumir: true, registro })
    a = await montarEscola(fila)
  })

  afterEach(() => {
    fila.restaurar()
  })

  afterAll(async () => {
    await fila.fechar()
    await sql('delete from consumo_ia where escola_id = $1', [a.escolaId])
    await sql('delete from execucao_agente where escola_id = $1', [a.escolaId])
    await sql('delete from configuracao_operacional_escola where escola_id = $1', [a.escolaId])
  })

  it('a execução do Assistente, de uma pessoa, às 10h05 de segunda: não espera pela janela, roda pelo caminho dela e conclui', async () => {
    fila.comModelo(() => Promise.resolve({ saida: {}, medicao: {} }))
    fila.fixarHorario(NA_JANELA, JANELA_DA_ESCOLA)
    const professor = await bancada.sessao(a.escolaId, 'professor')
    const { execucaoId } = await runInContext(
      { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: professor.usuarioId, papel: 'professor', sessaoId: professor.sessaoId, anoLetivoId: a.base.anoLetivoId },
      () => fila.agendador().agendar({ comando: 'propor_ferramenta', chaveEnvio: randomUUID(), entradaDaExecucao: { tarefa: 'propor_ferramenta' } }),
    )
    await rodar(fila, a.escolaId, execucaoId)
    expect(await execucaoDe(execucaoId)).toMatchObject({ estado: 'concluida', erro: null })
  })
})
