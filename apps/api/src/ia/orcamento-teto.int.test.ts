import { JobAdiadoError, LLMError, proporFerramenta, runInContext, turnoDoTutor, type TaskDefinition } from '@educa/core'
import { ErrorCode, type ChaveDeFuncao, type ResultadoGravado } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { montarEscolaComTurma, type EscolaComTurma } from '../../test/escola-turma.fixture.js'
import { FilaDeIa } from '../../test/fila-de-ia.fixture.js'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import type { ExecucaoCommand, FilaDeIa as NomeDaFila } from './execucao-command.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'

/**
 * O teto de segurança do orçamento de IA, no lote (camada-ia, tarefa 4.0; Tech Spec §5 "O teto de segurança", §7 e §7c; `cenarios.md`, RF9 e RF10 e a seção 2): acima de orçamento × teto ÷ 100 só o job da fila `lote` da escola
 * espera (a classificação do material: o único comando do lote), até a virada do mês ou até o teto subir. A bancada é a `FilaDeIa`: o gateway de verdade, com o adaptador falso, o orçamento com o relógio dela e o processador
 * do produto, que o teste entrega o job (`entregarDeNovo`) no instante que escolhe.
 */
const medidor = new MedidorDeTeste()
const bancada = new SessaoFixtures()
const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)

const REAIS = 1_000_000
/** Terça-feira, 10 de novembro, 19h05 em São Paulo: meio do mês, fora do horário letivo de segunda a sexta, das 7h às 18h. */
const MEIO_DO_MES = new Date('2026-11-10T19:05:00-03:00')
/** Segunda-feira, 30 de novembro, 23h50 em São Paulo: dez minutos antes de o mês virar. */
const FIM_DO_MES = new Date('2026-11-30T23:50:00-03:00')
/** Terça-feira, 1º de dezembro, 00h10 em São Paulo: o mês virou. */
const MES_SEGUINTE = new Date('2026-12-01T00:10:00-03:00')
const NO_MES = '2026-11-05T12:00:00-03:00'
const NA_JANELA = new Date('2026-11-16T13:05:00Z')
const JANELA_DA_ESCOLA = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' } as const

interface Montagem {
  /** O valor por aluno da escola, em micros; sem ele, e sem valor na rede, a escola é `sem_orcamento`. */
  readonly valor?: number
  readonly teto?: number
  readonly alunos?: number
  readonly gastoMicros?: number
}

interface Escola {
  readonly base: EscolaComTurma
  readonly escolaId: string
  /** As três seções do material (uma página cada), na ordem. */
  readonly secoes: readonly string[]
}

const CODIGO_DE_CNT = 'EM13CNT101'

/**
 * A escola com o material `pronto` de Química do 2º ano do EM, com três seções de uma página, a escola sem dia letivo (o despachante nunca segura o lote), o orçamento dado (valor e teto da escola, alunos ativos e o
 * custo já gasto no mês) e o horário letivo que `fixarHorario` põe no processador.
 */
async function montarEscola(fila: FilaDeIa, montagem: Montagem = {}): Promise<Escola> {
  const base = await montarEscolaComTurma(fila.api, bancada)
  const escolaId = base.coordenacao.escolaId
  await sql("insert into configuracao_operacional_escola (escola_id, dias_letivos, ia_valor_por_aluno_micros, ia_teto_de_seguranca_percentual) values ($1, '{}', $2, $3)", [escolaId, montagem.valor ?? null, montagem.teto ?? null])
  const secoes = await semearMaterial(base)
  await semearAlunos(base, montagem.alunos ?? 0)
  await gastar(escolaId, montagem.gastoMicros ?? 0)
  return { base, escolaId, secoes }
}

/** O id da linha inserida. */
async function inserir(texto: string, valores: unknown[]): Promise<string> {
  const { rows } = await sql<{ id: string }>(texto, valores)
  return rows.map((linha) => linha.id).join('')
}

/** O material `pronto` de Química do 2º ano do EM, com três capítulos e seções de uma página cada, e o trecho de cada página com a habilidade da BNCC. Devolve as seções, na ordem. */
async function semearMaterial(base: EscolaComTurma): Promise<string[]> {
  const escolaId = base.coordenacao.escolaId
  const habilidade = (await sql<{ descricao: string }>('select descricao from habilidade_bncc where codigo = $1', [CODIGO_DE_CNT])).rows.map((linha) => linha.descricao).join('')
  const materialId = await inserir(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_em)
     values ($1, $2, 'Apostila de teste', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'pronto', 3, now() - interval '2 hours') returning id`,
    [escolaId, base.quimica],
  )
  await sql('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaId, materialId, base.serieId])
  const secoes: string[] = []
  for (const ordem of [1, 2, 3]) {
    const capituloId = await inserir('insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $3::int, $4, $3::int, $3::int) returning id', [
      escolaId,
      materialId,
      ordem,
      `Capítulo ${String(ordem)}`,
    ])
    secoes.push(await inserir('insert into secao_do_material (escola_id, material_id, capitulo_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3, $4::smallint, $4::int, $4::int) returning id', [escolaId, materialId, capituloId, ordem]))
    await sql('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, base.quimica, materialId, ordem, `${habilidade}\nSubtítulo ${String(ordem)}`])
  }
  return secoes
}

/** `alunosAtivosDaEscola`: vínculo de aluno não encerrado no ano em curso, de usuário não desativado. */
async function semearAlunos(base: EscolaComTurma, quantos: number): Promise<void> {
  if (quantos === 0) return
  await sql(
    `with novos as (
       insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético' from generate_series(1, $2::int) returning id
     ) insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, criado_por) select $1, $3, id, $4, 'aluno', $5 from novos`,
    [base.coordenacao.escolaId, quantos, base.anoLetivoId, base.turma, base.coordenacao.usuarioId],
  )
}

/** Uma chamada da escola no mês, com o custo gravado. */
async function gastar(escolaId: string, custoMicros: number, em = NO_MES): Promise<void> {
  if (custoMicros === 0) return
  await sql(
    `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, custo_micros, em)
     values ($1, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-de-teste', '2026-11-21.1', 100, 50, 10, false, 1, 'concluida', $2, $3::timestamptz)`,
    [escolaId, custoMicros, em],
  )
}

/** A execução `classificar_secoes` da rotina (sem pessoa e sem ano), com as seções apontando para ela. */
async function execucaoDaRotina(escola: Escola): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    "insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, $3) returning id",
    [escola.escolaId, randomUUID(), JSON.stringify({ tarefa: 'classificar_secoes' })],
  )
  const id = rows[0]?.id ?? ''
  await sql('update secao_do_material set execucao_id = $1 where escola_id = $2 and id = any($3::uuid[])', [id, escola.escolaId, escola.secoes])
  return id
}

/** Uma execução pendente de uma pessoa, gravada à mão como o `POST` de um pacote de domínio a deixaria. */
async function execucaoDe(escola: Escola, tarefa: string, funcao: ChaveDeFuncao, pessoaId: string): Promise<string> {
  return inserir('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
    escola.escolaId,
    escola.base.anoLetivoId,
    funcao,
    tarefa,
    pessoaId,
    randomUUID(),
    JSON.stringify({ tarefa }),
  ])
}

/** Um comando de teste para uma tarefa real: prepara a entrada fixa e conclui com uma referência qualquer. O que passa por ele é o processador e o gateway de verdade, com o adaptador falso. */
function comandoDeTeste<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, filaDoComando: NomeDaFila, entrada: Entrada, extra: { alunoId?: string; turmaId?: string } = {}): ExecucaoCommand<Entrada, Saida, null> {
  return {
    tarefa,
    fila: filaDoComando,
    preparar: () => Promise.resolve({ entrada, lido: null, ...extra }),
    concluir: (): Promise<ResultadoGravado> => Promise.resolve({ tipo: 'artefato', artefatoId: randomUUID(), entregaId: null }),
  }
}

const estadoDe = async (id: string): Promise<string> => (await sql<{ estado: string }>('select estado from execucao_agente where id = $1', [id])).rows[0]?.estado ?? 'inexistente'
const consumosDa = async (execucaoId: string): Promise<number> => Number((await sql<{ total: string }>('select count(*) as total from consumo_ia where execucao_id = $1', [execucaoId])).rows[0]?.total)
const falhasSeguidasDe = async (escola: Escola): Promise<number[]> => (await sql<{ falhas_seguidas: number }>('select falhas_seguidas from secao_do_material where escola_id = $1 order by ordem', [escola.escolaId])).rows.map((linha) => linha.falhas_seguidas)
const comoEscola = <Resultado>(escolaId: string, trabalho: () => Promise<Resultado>): Promise<Resultado> => runInContext({ requisicaoId: randomUUID(), escolaId }, trabalho)

/** Entrega o job da execução ao processador; devolve o erro que ele lançou, ou `undefined` se a execução terminou. */
async function rodar(fila: FilaDeIa, escola: Escola, execucaoId: string): Promise<unknown> {
  return fila.entregarDeNovo(execucaoId, escola.escolaId).then(
    () => undefined,
    (erro: unknown) => erro,
  )
}

/** Quantos jobs do lote foram adiados por `motivo` até agora, na bancada. */
async function adiadosPor(motivo: string): Promise<number> {
  return (await medidor.pontos('ia.lote.adiado')).filter((ponto) => ponto.atributos['motivo'] === motivo).reduce((soma, ponto) => soma + Number(ponto.valor), 0)
}

afterAll(async () => {
  await bancada.fechar()
})

describe('o teto de segurança do orçamento de IA, no lote', () => {
  let fila: FilaDeIa
  /** O registro do produto, que o caso do Tutor e da ferramenta troca por um de teste e o `afterEach` devolve. */
  let registroDoProduto: RegistroDeComandos

  beforeAll(async () => {
    // Sem consumir: o teste entrega o job ao processador no instante que escolhe, e o worker real não o pega antes.
    fila = await FilaDeIa.subir(medidor.medidor, {}, undefined, { semConsumir: true })
    registroDoProduto = fila.registro
  })

  afterEach(() => {
    fila.restaurar()
    fila.usarRegistro(registroDoProduto)
  })

  afterAll(async () => {
    await fila.fechar()
  })

  /** O orçamento de R$ 50 (10 alunos × R$ 5) com o teto de 200%: o lote espera acima de R$ 100,000000. */
  const comTetoDeCem = (extra: Montagem = {}): Promise<Escola> => montarEscola(fila, { valor: 5 * REAIS, teto: 200, alunos: 10, ...extra })

  it('teto 200%: no limite exato o lote segue; um micro acima, a execução volta a `pendente` com `JobAdiadoError(orcamento)`, sem consumo, sem falha e com `ia.lote.adiado` +1', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 100 * REAIS })
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    // R$ 100,000000 de R$ 100,000000: o teto exato. `>`, e não `>=`: o lote segue.
    const noLimite = await execucaoDaRotina(escola)
    expect(await rodar(fila, escola, noLimite)).toBeUndefined()
    expect(await estadoDe(noLimite)).toBe('concluida')

    await gastar(escola.escolaId, 1)
    const antes = await adiadosPor('orcamento')
    const acima = await execucaoDaRotina(escola)
    const erro = await rodar(fila, escola, acima)
    expect(erro).toBeInstanceOf(JobAdiadoError)
    expect((erro as JobAdiadoError).motivo).toBe('orcamento')
    // Meio do mês: a espera é a de uma hora, e o executor soma o sorteio dele. A execução fica `pendente`, sem linha de consumo e sem somar `falhas_seguidas` (não gastou tentativa).
    expect((erro as JobAdiadoError).baseMs).toBe(3_600_000)
    expect(await estadoDe(acima)).toBe('pendente')
    expect(await consumosDa(acima)).toBe(0)
    expect(await falhasSeguidasDe(escola)).toEqual([0, 0, 0])
    expect(await adiadosPor('orcamento')).toBe(antes + 1)
  })

  it('a espera é a menor entre o que falta para a virada do mês e uma hora: 600 s às 23h50 do último dia, e 3.600 s no meio do mês', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 101 * REAIS })
    fila.fixarHorario(FIM_DO_MES, JANELA_DA_ESCOLA)
    const noFim = (await rodar(fila, escola, await execucaoDaRotina(escola))) as JobAdiadoError
    expect([noFim.motivo, noFim.baseMs]).toEqual(['orcamento', 600_000])
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const noMeio = (await rodar(fila, escola, await execucaoDaRotina(escola))) as JobAdiadoError
    expect([noMeio.motivo, noMeio.baseMs]).toEqual(['orcamento', 3_600_000])
  })

  it('na virada do mês o lote adiado roda; e com o teto subido pela Operação, também', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 101 * REAIS })
    fila.fixarHorario(FIM_DO_MES, JANELA_DA_ESCOLA)
    const execucaoId = await execucaoDaRotina(escola)
    expect(((await rodar(fila, escola, execucaoId)) as JobAdiadoError).motivo).toBe('orcamento')
    expect(await estadoDe(execucaoId)).toBe('pendente')
    // O mês virou: o custo de novembro não conta em dezembro, e o mesmo job, a mesma execução, roda.
    fila.fixarHorario(MES_SEGUINTE, JANELA_DA_ESCOLA)
    expect(await rodar(fila, escola, execucaoId)).toBeUndefined()
    expect(await estadoDe(execucaoId)).toBe('concluida')

    // De volta a novembro, acima do teto: espera; a Operação sobe o teto para 400% (R$ 200) e o mesmo job roda.
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const outra = await execucaoDaRotina(escola)
    expect(((await rodar(fila, escola, outra)) as JobAdiadoError).motivo).toBe('orcamento')
    await sql('update configuracao_operacional_escola set ia_teto_de_seguranca_percentual = 400 where escola_id = $1', [escola.escolaId])
    expect(await rodar(fila, escola, outra)).toBeUndefined()
    expect(await estadoDe(outra)).toBe('concluida')
  })

  it('escola `sem_orcamento` ou `sem_aluno_ativo`: o lote nunca é adiado pelo teto, mesmo com um gasto enorme (orçamento zero não é teto zero)', async () => {
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const semValor = await montarEscola(fila, { alunos: 20, gastoMicros: 5_000 * REAIS })
    const semAluno = await montarEscola(fila, { valor: 5 * REAIS, teto: 200, gastoMicros: 5_000 * REAIS })
    for (const escola of [semValor, semAluno]) {
      const execucaoId = await execucaoDaRotina(escola)
      expect(await rodar(fila, escola, execucaoId)).toBeUndefined()
      expect(await estadoDe(execucaoId)).toBe('concluida')
    }
  })

  it('acima de 100% e do teto, `interativa`, `ferramenta` e `normal` são atendidas, com ou sem aluno (o Tutor), e só a `lote` é recusada', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 500 * REAIS })
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const orcamento = new OrcamentoRepository(fila.banco, { agora: () => MEIO_DO_MES })
    const consultar = (consulta: Parameters<OrcamentoRepository['check']>[0]) => comoEscola(escola.escolaId, () => orcamento.check(consulta))
    for (const filaDaConsulta of ['interativa', 'ferramenta', 'normal'] as const) {
      expect(await consultar({ funcao: 'conversa_e_ferramentas', fila: filaDaConsulta }), filaDaConsulta).toEqual({ permitido: true })
    }
    // O Tutor: o freio dele é outro (D38), e o teto do mês não o toca.
    expect(await consultar({ funcao: 'tutor_com_o_aluno', alunoId: randomUUID(), turmaId: escola.base.turma, fila: 'interativa' })).toEqual({ permitido: true })
    // Sem `fila`, vale a `normal`.
    expect(await consultar({ funcao: 'conversa_e_ferramentas' })).toEqual({ permitido: true })
    expect(await consultar({ funcao: 'classificacao_do_material', fila: 'lote' })).toEqual({ permitido: false, codigo: ErrorCode.IA_ORCAMENTO_ESGOTADO, tenteDeNovoEmSegundos: 3_600 })
  })

  it('acima do teto, uma ferramenta e um turno do Tutor, pelo processador e pelo gateway de verdade, terminam `concluida` e gravam consumo: o teto só segura a fila `lote`', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 500 * REAIS })
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const [professor] = await bancada.sessoes(escola.escolaId, { papel: 'professor', quantidade: 1 })
    const [aluno] = await bancada.sessoes(escola.escolaId, { papel: 'aluno', quantidade: 1 })
    if (professor === undefined || aluno === undefined) throw new Error('sessões de teste não criadas')
    const contexto = { serie: '2º ano do Ensino Médio', disciplina: 'Química' }
    const registro = new RegistroDeComandos()
    registro.registrar(comandoDeTeste(proporFerramenta, 'ferramenta', { mensagem: 'monta uma atividade', contexto, trechos: [], turnosAnteriores: [] }))
    registro.registrar(comandoDeTeste(turnoDoTutor, 'interativa', { duvida: 'como acho o reagente limitante?', contexto, trechos: [], memoria: [], turnosAnteriores: [] }, { alunoId: aluno.usuarioId, turmaId: escola.base.turma }))
    fila.usarRegistro(registro)
    for (const [tarefa, funcao, pessoa] of [['propor_ferramenta', 'conversa_e_ferramentas', professor], ['turno_do_tutor', 'tutor_com_o_aluno', aluno]] as const) {
      const execucaoId = await execucaoDe(escola, tarefa, funcao, pessoa.usuarioId)
      expect(await rodar(fila, escola, execucaoId), tarefa).toBeUndefined()
      expect(await estadoDe(execucaoId), tarefa).toBe('concluida')
      expect(await consumosDa(execucaoId), tarefa).toBe(1)
    }
  })

  it('a A (20%, teto de R$ 1.000) segue e a B (111%, teto de R$ 900) é adiada, no mesmo mês: a soma é de cada escola', async () => {
    // A: 100 alunos × R$ 5 = R$ 500, teto 200%, R$ 100 gastos. B: 900 alunos × R$ 1 = R$ 900, teto 100%, R$ 1.000 gastos. Se a soma de A somasse a de B, A passaria dos R$ 1.000.
    const a = await montarEscola(fila, { valor: 5 * REAIS, teto: 200, alunos: 100, gastoMicros: 100 * REAIS })
    const b = await montarEscola(fila, { valor: 1 * REAIS, teto: 100, alunos: 900, gastoMicros: 1_000 * REAIS })
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const daA = await execucaoDaRotina(a)
    const daB = await execucaoDaRotina(b)
    expect(await rodar(fila, a, daA)).toBeUndefined()
    expect(await estadoDe(daA)).toBe('concluida')
    expect(((await rodar(fila, b, daB)) as JobAdiadoError).motivo).toBe('orcamento')
    expect(await estadoDe(daB)).toBe('pendente')
  })

  it('os três adiamentos do lote somam `ia.lote.adiado` cada um no seu motivo: `orcamento`, `provedor` (balde cheio) e `janela`', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 101 * REAIS })
    const antes = { orcamento: await adiadosPor('orcamento'), provedor: await adiadosPor('provedor'), janela: await adiadosPor('janela') }
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    expect(((await rodar(fila, escola, await execucaoDaRotina(escola))) as JobAdiadoError).motivo).toBe('orcamento')

    // O balde cheio: com o teto subido, o orçamento deixa passar e o provedor recusa.
    await sql('update configuracao_operacional_escola set ia_teto_de_seguranca_percentual = 1000 where escola_id = $1', [escola.escolaId])
    fila.comModelo(() => Promise.reject(new LLMError('IA_INDISPONIVEL', 12, 'sem_vaga')))
    expect(((await rodar(fila, escola, await execucaoDaRotina(escola))) as JobAdiadoError).motivo).toBe('provedor')

    // Dentro do horário letivo da escola: a janela segura o job antes de qualquer conferência.
    fila.fixarHorario(NA_JANELA, JANELA_DA_ESCOLA)
    expect(((await rodar(fila, escola, await execucaoDaRotina(escola))) as JobAdiadoError).motivo).toBe('janela')

    expect({ orcamento: await adiadosPor('orcamento'), provedor: await adiadosPor('provedor'), janela: await adiadosPor('janela') }).toEqual({ orcamento: antes.orcamento + 1, provedor: antes.provedor + 1, janela: antes.janela + 1 })
  })

  it('só o código do teto (e o provedor sem vaga) adia o lote: outro erro do gateway termina a execução como falhou, sem adiar o job nem contar `ia.lote.adiado`', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 1 * REAIS })
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    fila.comModelo(() => Promise.reject(new LLMError('IA_SAIDA_INVALIDA')))
    const antes = { orcamento: await adiadosPor('orcamento'), provedor: await adiadosPor('provedor') }
    const execucaoId = await execucaoDaRotina(escola)
    expect(await rodar(fila, escola, execucaoId)).toBeUndefined()
    expect(await estadoDe(execucaoId)).toBe('falhou')
    expect({ orcamento: await adiadosPor('orcamento'), provedor: await adiadosPor('provedor') }).toEqual(antes)
  })

  it('o log do adiamento leva só ids, a tarefa, o código e a espera: nunca o custo, o orçamento nem a porcentagem', async () => {
    const escola = await comTetoDeCem({ gastoMicros: 100 * REAIS + 7 })
    fila.fixarHorario(MEIO_DO_MES, JANELA_DA_ESCOLA)
    const execucaoId = await execucaoDaRotina(escola)
    await rodar(fila, escola, execucaoId)
    const linhas = fila.log.doEvento('ia.lote.adiado_pelo_orcamento').filter((linha) => linha['execucaoId'] === execucaoId)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ evento: 'ia.lote.adiado_pelo_orcamento', escolaId: escola.escolaId, execucaoId, tipo: 'classificar_secoes', codigo: ErrorCode.IA_ORCAMENTO_ESGOTADO, esperaMs: 3_600_000 })
    // O custo (100000007 micros) e o orçamento (50000000) não vão ao log, e a espera é o único número da linha: nem a porcentagem entra.
    for (const valor of ['100000007', '50000000']) expect(fila.log.contemValor(valor), valor).toBe(false)
    const numeros = Object.entries(linhas[0] ?? {}).filter(([, valor]) => typeof valor === 'number')
    expect(numeros.map(([chave]) => chave).filter((chave) => chave !== 'esperaMs' && !['nivel', 'level', 'time', 'tempo', 'pid'].includes(chave))).toEqual([])
  })

  it('o único comando do lote é a classificação do material: a correção da objetiva e a vista da avaliação não esperam pelo teto, e comando novo no lote reabre a conta (D33, D56)', () => {
    const doLote = fila.registro.tarefas().filter((tarefa) => fila.registro.de(tarefa).fila === 'lote')
    expect(doLote).toEqual(['classificar_secoes'])
  })
})
