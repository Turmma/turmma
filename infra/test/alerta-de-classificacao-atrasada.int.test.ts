import { lerJanelaPadrao, ultimaNoite, type JanelaLetiva } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SessaoFixtures } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA, recriarDoZero } from '../../tools/testes/compose.ts'
import { alertaCom, lerRegrasNoGrafana, REGRAS_PROVISIONADAS, type EstadoDoAlerta } from '../scripts/ensaio-alertas.ts'

// O alerta "Classificação do material atrasada" (classificacao-bncc, tarefa 5.0; Tech Spec, seção 7c, "Alerta") contra o compose de teste, com as imagens
// construídas: a observabilidade com a regra provisionada de infra/grafana/alertas/, e o worker-lote exportando `classificacao.execucoes_atrasadas` por OTLP de
// verdade, medida no boot a partir de `execucao_agente`. As execuções são gravadas direto no banco antes de o worker subir, em instantes que saem da noite que a
// própria medição julga (`ultimaNoite`, com a janela letiva da escola): a que falhou entre o fecho e a abertura e a que ficou pendente desde antes do fecho
// disparam; a pendente da própria noite (o excedente do onboarding), a falha da abertura em diante e a escola sem execução, não.
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'worker-lote-1'] as const
const UID = REGRAS_PROVISIONADAS.classificacaoAtrasada

const sessoes = new SessaoFixtures()
const escolas: string[] = []

const JANELA_PADRAO = lerJanelaPadrao(ambiente)
/** A escola que abre às 5h e fecha às 22h: a noite dela não é a da padrão. */
const JANELA_DA_ESCOLA_TARDIA = { ...JANELA_PADRAO, inicio: '05:00', fim: '22:00' }

const meio = (noite: { fechouEm: Date; abriuEm: Date }): Date => new Date((noite.fechouEm.getTime() + noite.abriuEm.getTime()) / 2)
const antes = (instante: Date, horas: number): Date => new Date(instante.getTime() - horas * 3_600_000)

function noiteDe(janela: JanelaLetiva): { fechouEm: Date; abriuEm: Date } {
  const noite = ultimaNoite(janela, new Date())
  if (noite === undefined) throw new Error('a janela de teste tem dia letivo')
  return noite
}

/** Uma execução da classificação da escola, criada e concluída nos instantes dados (e só com ids e datas). */
async function execucao(escolaId: string, estado: 'pendente' | 'falhou', criadaEm: Date, concluidaEm: Date | null = null): Promise<void> {
  await sessoes.pool.query(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, criada_em, concluida_em, iniciada_em)
     values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, case when $3::text = 'falhou' then 'IA_SAIDA_INVALIDA' end,
             $4::timestamptz, $5::timestamptz, case when $3::text = 'falhou' then $4::timestamptz end)`,
    [escolaId, randomUUID(), estado, criadaEm, concluidaEm],
  )
}

async function noPrometheus(escolaId: string): Promise<number | undefined> {
  const consulta = new URLSearchParams({ query: `max(classificacao_execucoes_atrasadas{job="educa/worker", escola_id="${escolaId}"})` })
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${consulta}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

async function estadoDa(escolaId: string): Promise<EstadoDoAlerta> {
  return alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: escolaId })?.estado ?? 'normal'
}

describe('alerta de classificação do material atrasada, na observabilidade local', () => {
  let falhouNaNoite = ''
  let pendenteDeAntes = ''
  let daJanelaTardia = ''
  let pendenteDaNoite = ''
  let falhouNaAbertura = ''
  let semExecucao = ''

  beforeAll(async () => {
    // Nenhum despachante nem outro worker: o worker-lote do teste só mede, sem rodar job que alguém tenha deixado.
    compose('stop', ...PROCESSOS_DA_FILA)
    await recriarDoZero('observabilidade')
    falhouNaNoite = await sessoes.escola()
    pendenteDeAntes = await sessoes.escola()
    daJanelaTardia = await sessoes.escola()
    pendenteDaNoite = await sessoes.escola()
    falhouNaAbertura = await sessoes.escola()
    semExecucao = await sessoes.escola()
    escolas.push(falhouNaNoite, pendenteDeAntes, daJanelaTardia, pendenteDaNoite, falhouNaAbertura, semExecucao)
    await sessoes.pool.query("insert into configuracao_operacional_escola (escola_id, inicio, fim) values ($1, '05:00', '22:00') on conflict (escola_id) do update set inicio = '05:00', fim = '22:00'", [daJanelaTardia])

    const padrao = noiteDe(JANELA_PADRAO)
    const tardia = noiteDe(JANELA_DA_ESCOLA_TARDIA)
    await execucao(falhouNaNoite, 'falhou', antes(meio(padrao), 1), meio(padrao))
    await execucao(pendenteDeAntes, 'pendente', antes(padrao.fechouEm, 3))
    // A falha no meio da noite da escola tardia dispara. Este caso depende do relógio de parede (a noite sai de `new Date()` aqui e o worker do compose mede minutos depois), e só distingue a janela da escola da padrão
    // se rodar entre 5h e 7h de um dia letivo. A prova que não depende da hora é `apps/worker/test/classificacao-agendada.int.test.ts` › "a janela é a da escola".
    await execucao(daJanelaTardia, 'falhou', antes(meio(tardia), 1), meio(tardia))
    // Criada na noite: é o excedente do onboarding, que a noite seguinte termina.
    await execucao(pendenteDaNoite, 'pendente', meio(padrao))
    // Concluída exatamente na abertura: o intervalo da noite é [fecho, abertura), e ela fica de fora.
    await execucao(falhouNaAbertura, 'falhou', antes(padrao.abriuEm, 1), padrao.abriuEm)
    // O worker-lote mede no boot: sobe depois das execuções gravadas.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', ...SERVICOS)
  }, 900_000)

  afterAll(async () => {
    await sessoes.pool.query('delete from execucao_agente where escola_id = any($1::uuid[])', [escolas])
    await sessoes.pool.query('delete from configuracao_operacional_escola where escola_id = any($1::uuid[])', [escolas])
    await sessoes.fechar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('a falha da noite, a pendente de antes e a falha da noite da janela própria disparam; a pendente da noite, a falha da abertura e a escola sem execução não', async () => {
    for (const escola of [falhouNaNoite, pendenteDeAntes, daJanelaTardia]) await expect.poll(() => noPrometheus(escola), { timeout: 120_000, interval: 2_000 }).toBe(1)
    for (const escola of [pendenteDaNoite, falhouNaAbertura, semExecucao]) expect(await noPrometheus(escola), escola).toBeUndefined()

    // O estado da regra para as escolas sem série, amostrado do começo ao fim: um disparo entre duas leituras não passa despercebido.
    const estadosDasQueNaoDisparam: EstadoDoAlerta[] = []
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        estadosDasQueNaoDisparam.push(await estadoDa(pendenteDaNoite), await estadoDa(falhouNaAbertura), await estadoDa(semExecucao))
        await new Promise((resolver) => setTimeout(resolver, 2_000))
      }
    })()
    try {
      for (const escola of [falhouNaNoite, pendenteDeAntes, daJanelaTardia]) await expect.poll(() => estadoDa(escola), { timeout: 180_000, interval: 2_000 }).toBe('disparado')
      // Mais duas avaliações da regra depois do disparo, para uma pendência atrasada das outras aparecer.
      await new Promise((resolver) => setTimeout(resolver, 25_000))
    } finally {
      amostrando = false
      await amostragem
    }
    expect(estadosDasQueNaoDisparam.length).toBeGreaterThan(30)
    expect(estadosDasQueNaoDisparam.every((estado) => estado === 'normal')).toBe(true)
    // O disparo traz a escola, e só ela.
    const disparo = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: falhouNaNoite })
    expect(disparo?.rotulos['escola_id']).toBe(falhouNaNoite)
  }, 480_000)
})
