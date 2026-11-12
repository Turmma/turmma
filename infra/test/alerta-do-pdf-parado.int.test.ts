import { chaveDoTemporario, runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { parse } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { abrirArmazemDeOperacao } from '../../apps/api/src/ops/armazem-de-operacao.js'
import { PDF_DE_DEMONSTRACAO, pdfSemTexto } from '../../apps/api/test/material.fixture.js'
import { SessaoFixtures } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { arquivosDeAlertaDoRepositorio } from '../../tools/guardas/alerta-tem-runbook.ts'
import { compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA, recriarDoZero } from '../../tools/testes/compose.ts'
import { alertaCom, lerRegrasNoGrafana, MINUTOS_DO_JOB_DE_PDF_DO_ENSAIO, PRIORIDADE_DA_FILA_PDF, REGRAS_DO_ENSAIO } from '../scripts/ensaio-alertas.ts'

// O alerta "Extração de PDF parada" (ingestao-do-material, tarefa 3.0; `techspec.md` §7c) contra o compose de teste, com as imagens construídas: a
// observabilidade com a regra provisionada, o despachante medindo `job.espera_mais_antiga_s` e o `worker-pdf` contando `material.extracao` por OTLP de
// verdade. O teste consulta no Prometheus a expressão do arquivo, a mesma que o Grafana avalia, e só o disparo passa pelo Grafana.
//
// Um job de PDF "parado" fica `reservado` por um despachante que sumiu (a reserva vale um dia): o despachante não o toma de volta, o `worker-pdf` nunca o vê,
// e a espera dele segue medida (`reservado` ainda não começou) enquanto as outras escolas têm extrações terminando. Cada fase recomeça o Prometheus do zero e leva um só tipo de desfecho ao
// `worker-pdf`: o contador do worker continua o mesmo, mas o Prometheus novo só soma o que sobe depois dele.
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'despachante-1', 'worker-pdf'] as const
const UID = REGRAS_DO_ENSAIO.pdfParado
const LIMIAR_DA_ESPERA_S = 900
/** Quantos PDFs de cada desfecho: o Prometheus não soma o primeiro ponto de uma série, e a segunda extração é a que mostra o incremento. */
const PDFS_POR_FASE = 4
const INTERVALO_ENTRE_PDFS_MS = 15_000

const sessoes = new SessaoFixtures()
const escolas: string[] = []
const { armazem, encerrar } = abrirArmazemDeOperacao(ambiente)

/** A expressão da regra como está no arquivo provisionado: a que o Grafana avalia. */
function expressaoDaRegra(): string {
  for (const arquivo of arquivosDeAlertaDoRepositorio()) {
    const documento = parse(arquivo.conteudo) as { groups: Array<{ rules: Array<{ uid: string; data: Array<{ refId: string; model: { expr?: string } }> }> }> }
    for (const grupo of documento.groups) for (const regra of grupo.rules) if (regra.uid === UID) return regra.data.find((consulta) => consulta.refId === 'A')?.model.expr ?? ''
  }
  throw new Error(`regra ${UID} não provisionada`)
}

/** O valor de uma expressão instantânea no Prometheus, ou `undefined` se ela não tem série. */
async function valorNoPrometheus(expr: string): Promise<number | undefined> {
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${new URLSearchParams({ query: expr })}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

const espera = () => valorNoPrometheus('max(job_espera_mais_antiga_s{fila="pdf"})')
const regra = () => valorNoPrometheus(expressaoDaRegra())
const incremento = (resultado: string) => valorNoPrometheus(`sum(increase(material_extracao_total{job="educa/worker", resultado="${resultado}"}[15m]))`)

async function dormir(ms: number): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, ms))
}

describe('alerta de extração de PDF parada, na observabilidade local', () => {
  let escolaParada = ''
  let escolaQueTrabalha = ''
  let disciplina = ''
  let jobParado = ''

  /** Um material `processando` da escola que trabalha, com o PDF no storage (ou sem, para o objeto ausente), e o job de extração dele aguardando. */
  async function enfileirarPdf(bytes: Buffer | null): Promise<void> {
    const { rows } = await sessoes.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado)
       values ($1, $2, 'Material do ensaio', 'escola', 'autoria_da_escola', true, md5(random()::text) || md5(random()::text), 1000, 'processando') returning id`,
      [escolaQueTrabalha, disciplina],
    )
    const materialId = rows[0]?.id ?? ''
    if (bytes !== null) await runInContext({ requisicaoId: randomUUID(), escolaId: escolaQueTrabalha }, () => armazem.guardarBytes(chaveDoTemporario(materialId), new Uint8Array(bytes), { prazoMs: 10_000 }))
    await sessoes.pool.query(
      `insert into job_registro (escola_id, fila, prioridade, tipo, dados, nao_urgente, estado)
       values ($1, 'pdf', $2, 'material.extrair-pdf', jsonb_build_object('materialId', $3::text), false, 'aguardando')`,
      [escolaQueTrabalha, PRIORIDADE_DA_FILA_PDF, materialId],
    )
  }

  async function terminados(): Promise<number> {
    const { rows } = await sessoes.pool.query<{ total: string }>("select count(*) as total from job_registro where escola_id = $1 and fila = 'pdf' and estado in ('concluido', 'falhou')", [escolaQueTrabalha])
    return Number(rows[0]?.total)
  }

  /** O job parado passa a esperar há 16 min: o caso que o exige não depende de outro ter rodado antes. */
  async function envelhecerOJobParado(): Promise<void> {
    await sessoes.pool.query(`update job_registro set criado_em = now() - $2::int * interval '1 minute' where id = $1`, [jobParado, MINUTOS_DO_JOB_DE_PDF_DO_ENSAIO])
  }

  /** O Prometheus recomeça do zero: a regra e o contador voltam a ser medidos só pelo que acontece daqui em diante, e o job parado continua lá, medido. */
  async function recomecarPrometheus(): Promise<void> {
    await envelhecerOJobParado()
    await recriarDoZero('observabilidade')
    await expect.poll(espera, { timeout: 120_000, interval: 2_000 }).toBeGreaterThan(LIMIAR_DA_ESPERA_S)
  }

  /** Leva `PDFS_POR_FASE` PDFs de um desfecho ao worker e espera o incremento daquele resultado aparecer no Prometheus. */
  async function fase(bytes: () => Buffer | null, resultado: string): Promise<void> {
    // O `worker-pdf` sobe com a fase (e já de pé não muda nada): cada caso roda sozinho, sem depender de outro ter rodado antes.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', 'worker-pdf')
    // Um por vez, com uma exportação de métrica entre eles: os quatro de uma vez chegariam ao Prometheus novo num ponto só, e `increase` não soma o primeiro.
    const antes = await terminados()
    for (let i = 0; i < PDFS_POR_FASE; i += 1) {
      await enfileirarPdf(bytes())
      await expect.poll(terminados, { timeout: 180_000, interval: 1_000 }).toBeGreaterThanOrEqual(antes + i + 1)
      await dormir(INTERVALO_ENTRE_PDFS_MS)
    }
    await expect.poll(() => incremento(resultado), { timeout: 120_000, interval: 2_000 }).toBeGreaterThan(0)
  }

  beforeAll(async () => {
    compose('stop', ...PROCESSOS_DA_FILA)
    // O banco de teste guarda o que as outras execuções deixaram: um job `pdf` velho de outra execução seria o mais antigo da medida.
    await sessoes.pool.query("delete from job_registro where fila = 'pdf' and estado not in ('concluido', 'falhou')")
    await recriarDoZero('observabilidade')
    escolaParada = await sessoes.escola()
    escolaQueTrabalha = await sessoes.escola()
    escolas.push(escolaParada, escolaQueTrabalha)
    disciplina = (await sessoes.pool.query<{ id: string }>("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaQueTrabalha])).rows[0]?.id ?? ''
    // O primeiro PDF depois de horas sem nenhum: acabou de chegar, e a reserva dele não vence tão cedo.
    jobParado = (
      await sessoes.pool.query<{ id: string }>(
        `insert into job_registro (escola_id, fila, prioridade, tipo, dados, nao_urgente, estado, reservado_ate)
         values ($1, 'pdf', $2, 'material.extrair-pdf', jsonb_build_object('materialId', $3::text), false, 'reservado', now() + interval '1 day') returning id`,
        [escolaParada, PRIORIDADE_DA_FILA_PDF, randomUUID()],
      )
    ).rows[0]?.id ?? ''
    // O despachante mede; o `worker-pdf` fica de fora até a fase 1.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', 'observabilidade', 'despachante-1')
  }, 900_000)

  afterAll(async () => {
    await sessoes.pool.query('delete from job_registro where escola_id = any($1::uuid[])', [escolas])
    await sessoes.pool.query('delete from material where escola_id = any($1::uuid[])', [escolas])
    await sessoes.fechar()
    encerrar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('o primeiro job depois de horas sem PDF espera segundos: o termo da espera não vale e a regra não dispara', async () => {
    await expect.poll(espera, { timeout: 120_000, interval: 2_000 }).toBeDefined()
    expect(await espera()).toBeLessThan(LIMIAR_DA_ESPERA_S)
    // O limiar está na regra do Grafana (`gt 900`): com o valor abaixo dele, a regra não dispara, nem pendente.
    expect((await regra()) ?? 0).toBeLessThan(LIMIAR_DA_ESPERA_S)
    const estado = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), {})?.estado ?? 'normal'
    expect(estado).toBe('normal')
  }, 240_000)

  it('o worker-pdf parado e o job pendente há 16 min: a expressão passa do limiar e o Grafana dispara', async () => {
    await envelhecerOJobParado()
    await expect.poll(regra, { timeout: 120_000, interval: 2_000 }).toBeGreaterThan(LIMIAR_DA_ESPERA_S)
    await expect
      .poll(async () => alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), {})?.estado ?? 'normal', { timeout: 240_000, interval: 3_000 })
      .toBe('disparado')
  }, 420_000)

  it('o termo das extrações: com `falhou` terminando e o job ainda esperando há 16 min, a regra não vale', async () => {
    await recomecarPrometheus()
    // Um PDF de verdade sem texto: o worker fecha o material como `falhou`, numa tentativa só.
    await fase(() => pdfSemTexto(), 'falhou')
    // O termo da espera segue valendo (o job parado espera há mais de 15 min), e é o das extrações terminadas que derruba a regra.
    expect(await espera()).toBeGreaterThan(LIMIAR_DA_ESPERA_S)
    expect(await incremento('pronto')).toSatisfy((valor: number | undefined) => valor === undefined || valor === 0)
    expect(await regra()).toBeUndefined()
    await expect.poll(async () => alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), {})?.estado ?? 'normal', { timeout: 240_000, interval: 3_000 }).toBe('normal')
  }, 900_000)

  it('o termo das extrações: com `pronto` terminando e o job ainda esperando há 16 min, a regra não vale', async () => {
    await recomecarPrometheus()
    await fase(() => PDF_DE_DEMONSTRACAO, 'pronto')
    expect(await espera()).toBeGreaterThan(LIMIAR_DA_ESPERA_S)
    // O Prometheus recomeçou depois das `falhou` da fase anterior: o contador delas não sobe mais, e só a `pronto` derruba a regra.
    expect(await incremento('falhou')).toSatisfy((valor: number | undefined) => valor === undefined || valor === 0)
    expect(await regra()).toBeUndefined()
  }, 900_000)

  it('o objeto ausente não é extração terminada: `arquivo_ausente` terminando com o job esperando há 16 min deixa a regra valer', async () => {
    await recomecarPrometheus()
    await fase(() => null, 'arquivo_ausente')
    expect(await incremento('pronto')).toSatisfy((valor: number | undefined) => valor === undefined || valor === 0)
    expect(await incremento('falhou')).toSatisfy((valor: number | undefined) => valor === undefined || valor === 0)
    expect(await regra()).toBeGreaterThan(LIMIAR_DA_ESPERA_S)
  }, 900_000)
})
