import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CATEGORIAS_DO_EXPURGO } from '../../packages/core/src/retencao/expurgo-da-escola.repository.ts'
import { SessaoFixtures } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA, recriarDoZero } from '../../tools/testes/compose.ts'
import { alertaCom, lerRegrasNoGrafana, REGRAS_PROVISIONADAS, type EstadoDoAlerta } from '../scripts/ensaio-alertas.ts'

// O alerta "Expurgo incompleto por duas noites numa escola" (F3, tarefa 3.0; Tech Spec do F3, seção 7c) contra o compose
// de teste, com as imagens construídas: a observabilidade com a regra provisionada de infra/grafana/alertas/, e o
// worker-lote exportando `expurgo.noites_incompletas` por OTLP de verdade, medida no boot a partir de `expurgo_execucao`.
// As noites são gravadas direto no banco antes de o worker subir, em ontem e anteontem no fuso padrão (São Paulo).
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'worker-lote-1'] as const
const UID = REGRAS_PROVISIONADAS.expurgoIncompleto

const sessoes = new SessaoFixtures()
const escolas: string[] = []

/** A noite de `diasAtras` dias, às 2h no fuso de São Paulo, com uma linha por categoria pedida. */
async function noite(escolaId: string, diasAtras: number, linhas: ReadonlyArray<readonly [string, boolean]>): Promise<void> {
  for (const [categoria, concluida] of linhas) {
    await sessoes.pool.query(
      `insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em)
       values ($1, $2, 0, $3, ((now() at time zone 'America/Sao_Paulo')::date - $4::int)::timestamp at time zone 'America/Sao_Paulo' + interval '2 hours')`,
      [escolaId, categoria, concluida, diasAtras],
    )
  }
}

const COMPLETA = CATEGORIAS_DO_EXPURGO.map((categoria) => [categoria, true] as const)
const PARCIAL = [
  ['conversa_tutor', true],
  ['sinal_tutor', false],
] as const

async function noPrometheus(escolaId: string): Promise<number | undefined> {
  const consulta = new URLSearchParams({ query: `max(expurgo_noites_incompletas{job="educa/worker", escola_id="${escolaId}"})` })
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${consulta}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

async function estadoDa(escolaId: string): Promise<EstadoDoAlerta> {
  return alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: escolaId })?.estado ?? 'normal'
}

describe('alerta de duas noites sem expurgo completo, na observabilidade local', () => {
  let duasParciais = ''
  let parcialECompleta = ''
  let semLinha = ''

  beforeAll(async () => {
    // Nenhum despachante nem outro worker: o worker-lote do teste só mede, sem rodar job que alguém tenha deixado.
    compose('stop', ...PROCESSOS_DA_FILA)
    await recriarDoZero('observabilidade')
    duasParciais = await sessoes.escola()
    parcialECompleta = await sessoes.escola()
    semLinha = await sessoes.escola()
    escolas.push(duasParciais, parcialECompleta, semLinha)
    await noite(duasParciais, 2, PARCIAL)
    await noite(duasParciais, 1, PARCIAL)
    await noite(parcialECompleta, 2, PARCIAL)
    await noite(parcialECompleta, 1, COMPLETA)
    // Ontem, as duas primeiras terminaram e a conversa do professor nem tem linha: conta como não concluída.
    await noite(semLinha, 2, PARCIAL)
    await noite(semLinha, 1, [
      ['conversa_tutor', true],
      ['sinal_tutor', true],
    ])
    // O worker-lote mede no boot: sobe depois das noites gravadas.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', ...SERVICOS)
  }, 900_000)

  afterAll(async () => {
    await sessoes.pool.query('delete from expurgo_execucao where escola_id = any($1::uuid[])', [escolas])
    await sessoes.fechar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('duas noites parciais disparam; parcial seguida de completa não; a categoria sem linha conta como não concluída', async () => {
    await expect.poll(() => noPrometheus(duasParciais), { timeout: 120_000, interval: 2_000 }).toBe(2)
    expect(await noPrometheus(parcialECompleta)).toBe(0)
    expect(await noPrometheus(semLinha)).toBe(2)

    // O estado da regra para a escola com uma noite completa, amostrado do começo ao fim: um disparo entre duas leituras
    // não passa despercebido.
    const estadosDaCompleta: EstadoDoAlerta[] = []
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        estadosDaCompleta.push(await estadoDa(parcialECompleta))
        await new Promise((resolver) => setTimeout(resolver, 2_000))
      }
    })()
    try {
      await expect.poll(() => estadoDa(duasParciais), { timeout: 180_000, interval: 2_000 }).toBe('disparado')
      await expect.poll(() => estadoDa(semLinha), { timeout: 60_000, interval: 2_000 }).toBe('disparado')
      // Mais duas avaliações da regra depois do disparo, para uma pendência atrasada da completa aparecer.
      await new Promise((resolver) => setTimeout(resolver, 25_000))
    } finally {
      amostrando = false
      await amostragem
    }
    expect(estadosDaCompleta.length).toBeGreaterThan(30)
    expect(estadosDaCompleta.every((estado) => estado === 'normal')).toBe(true)
    // O disparo traz a escola, e só ela.
    const disparo = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: duasParciais })
    expect(disparo?.rotulos['escola_id']).toBe(duasParciais)
  }, 420_000)
})
