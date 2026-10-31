import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA, recriarDoZero } from '../../tools/testes/compose.ts'
import { alertaCom, lerRegrasNoGrafana, REGRAS_PROVISIONADAS, type EstadoDoAlerta } from '../scripts/ensaio-alertas.ts'

// O alerta "Incidente sem confirmação em 24 h" (F3, tarefa 9.0; Tech Spec do F3, seção 7c) contra o compose de teste, com as
// imagens construídas: a observabilidade com a regra provisionada de infra/grafana/alertas/, e o worker-lote exportando
// `incidente.horas_sem_confirmacao` por OTLP de verdade, medida no boot a partir de `incidente_escola`. Os incidentes são gravados
// direto no banco antes de o worker subir, com a data em que a Turmma soube a 23 h e a 25 h do instante do banco.
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'worker-lote-1'] as const
const UID = REGRAS_PROVISIONADAS.incidenteSemConfirmacao

const sessoes = new BancadaDeSessoes()
const escolas: string[] = []
const incidentes: string[] = []

/**
 * Um incidente que a Turmma soube há `horasAtras` horas, com a seção da escola; `confirmado` põe a confirmação nela. O registro é
 * gravado agora, e a data em que se soube é anterior a ele (o check `incidente_conhecido_antes_do_registro`).
 */
async function incidente(escolaId: string, horasAtras: number, confirmado = false): Promise<void> {
  const { rows } = await sessoes.pool.query<{ id: string }>(`insert into incidente (conhecido_em, registrado_por) values (now() - $1::int * interval '1 hour', 'equipe-de-teste') returning id`, [horasAtras])
  const incidenteId = rows[0]?.id ?? ''
  incidentes.push(incidenteId)
  await sessoes.pool.query(
    `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao, confirmado_em)
     values ($1, $2, 'Circunstância sintética', array['cadastro'], 10, 'baixo', 'Contenção sintética', 'Correção sintética', case when $3::boolean then now() else null end)`,
    [incidenteId, escolaId, confirmado],
  )
}

async function noPrometheus(escolaId: string): Promise<number | undefined> {
  const consulta = new URLSearchParams({ query: `max(incidente_horas_sem_confirmacao{job="educa/worker", escola_id="${escolaId}"})` })
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${consulta}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

async function estadoDa(escolaId: string): Promise<EstadoDoAlerta> {
  return alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: escolaId })?.estado ?? 'normal'
}

describe('alerta de incidente sem confirmação em 24 h, na observabilidade local', () => {
  let vinteETresHoras = ''
  let vinteECincoHoras = ''
  let confirmado = ''
  let confirmadoEUmNovo = ''

  beforeAll(async () => {
    // Nenhum despachante nem outro worker: o worker-lote do teste só mede, sem rodar job que alguém tenha deixado.
    compose('stop', ...PROCESSOS_DA_FILA)
    await recriarDoZero('observabilidade')
    vinteETresHoras = await sessoes.escola()
    vinteECincoHoras = await sessoes.escola()
    confirmado = await sessoes.escola()
    confirmadoEUmNovo = await sessoes.escola()
    escolas.push(vinteETresHoras, vinteECincoHoras, confirmado, confirmadoEUmNovo)
    await incidente(vinteETresHoras, 23)
    await incidente(vinteECincoHoras, 25)
    // Há 40 h, mas a coordenação já confirmou: não conta.
    await incidente(confirmado, 40, true)
    // Um velho confirmado e um novo sem confirmação: vale o novo, e a idade do confirmado não aparece.
    await incidente(confirmadoEUmNovo, 50, true)
    await incidente(confirmadoEUmNovo, 2)
    // O worker-lote mede no boot: sobe depois dos incidentes gravados.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', ...SERVICOS)
  }, 900_000)

  afterAll(async () => {
    // As seções saem em cascata com o incidente.
    await sessoes.pool.query('delete from incidente where id = any($1::uuid[])', [incidentes])
    await sessoes.fechar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('23 h não dispara; 25 h dispara; o confirmado não tem série, e a idade medida é a do mais antigo sem confirmação', async () => {
    await expect.poll(() => noPrometheus(vinteECincoHoras), { timeout: 120_000, interval: 2_000 }).toBeGreaterThanOrEqual(25)
    const mais = await noPrometheus(vinteECincoHoras)
    const menos = await noPrometheus(vinteETresHoras)
    expect(mais).toBeLessThan(26)
    expect(menos).toBeGreaterThanOrEqual(23)
    expect(menos).toBeLessThan(24)
    expect(await noPrometheus(confirmado)).toBeUndefined()
    const novo = await noPrometheus(confirmadoEUmNovo)
    expect(novo).toBeGreaterThanOrEqual(2)
    expect(novo).toBeLessThan(3)

    // O estado da regra para as escolas abaixo do limiar, amostrado do começo ao fim: um disparo entre duas leituras não passa
    // despercebido.
    const estadosDasQueNaoDisparam: EstadoDoAlerta[] = []
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        estadosDasQueNaoDisparam.push(await estadoDa(vinteETresHoras), await estadoDa(confirmadoEUmNovo), await estadoDa(confirmado))
        await new Promise((resolver) => setTimeout(resolver, 2_000))
      }
    })()
    try {
      await expect.poll(() => estadoDa(vinteECincoHoras), { timeout: 180_000, interval: 2_000 }).toBe('disparado')
      // Mais duas avaliações da regra depois do disparo, para uma pendência atrasada das outras aparecer.
      await new Promise((resolver) => setTimeout(resolver, 25_000))
    } finally {
      amostrando = false
      await amostragem
    }
    expect(estadosDasQueNaoDisparam.length).toBeGreaterThan(30)
    expect(estadosDasQueNaoDisparam.every((estado) => estado === 'normal')).toBe(true)
    // O disparo traz a escola, e só ela.
    const disparo = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: vinteECincoHoras })
    expect(disparo?.rotulos['escola_id']).toBe(vinteECincoHoras)
  }, 420_000)
})
