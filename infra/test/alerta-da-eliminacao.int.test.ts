import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SessaoFixtures } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA, recriarDoZero } from '../../tools/testes/compose.ts'
import { alertaCom, lerRegrasNoGrafana, REGRAS_PROVISIONADAS, type EstadoDoAlerta } from '../scripts/ensaio-alertas.ts'

// O alerta "Eliminação do titular agendada há mais de 48 h do prazo" (F3, tarefa 15.0; Tech Spec do F3, seção 7c) contra o compose de
// teste, com as imagens construídas: a observabilidade com a regra provisionada de infra/grafana/alertas/, e o worker-lote exportando
// `eliminacao.horas_vencida` por OTLP de verdade, medida no boot a partir de `pedido_titular`. Os pedidos são gravados direto no
// banco antes de o worker subir, vencidos há 47 h e há 48 h do instante do banco: 47 h não alerta, 48 h alerta.
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'worker-lote-1'] as const
const UID = REGRAS_PROVISIONADAS.eliminacaoVencida

const sessoes = new SessaoFixtures()
const escolas: string[] = []

/**
 * Um pedido de eliminação de aluno da escola, vencido há `horasAtras` horas (`eliminar_em`, do instante do banco) no estado dado.
 * O titular e quem registrou são o mesmo usuário de teste da escola (o gatilho de inserção exige usuário da escola), e o pedido
 * guarda só ids e datas.
 */
async function pedido(escolaId: string, horasAtras: number, estado: 'agendado' | 'concluido'): Promise<void> {
  const [aluno] = await sessoes.sessoes(escolaId, { papel: 'aluno', quantidade: 1 })
  if (aluno === undefined) throw new Error('aluno de teste não criado')
  await sessoes.pool.query(
    `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio, concluido_em, concluido_por)
     values ($1, $2, 'aluno', 'eliminacao', 'titular', current_date, $3::text, now() - $4::int * interval '1 hour', '[]'::jsonb, $2, $5,
             case when $3::text = 'concluido' then now() end, case when $3::text = 'concluido' then $2::uuid end)`,
    [escolaId, aluno.usuarioId, estado, horasAtras, randomUUID()],
  )
}

async function noPrometheus(escolaId: string): Promise<number | undefined> {
  const consulta = new URLSearchParams({ query: `max(eliminacao_horas_vencida{job="educa/worker", escola_id="${escolaId}"})` })
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${consulta}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

async function estadoDa(escolaId: string): Promise<EstadoDoAlerta> {
  return alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: escolaId })?.estado ?? 'normal'
}

describe('alerta de eliminação do titular agendada há mais de 48 h do prazo, na observabilidade local', () => {
  let quarentaESete = ''
  let quarentaEOito = ''
  let concluida = ''
  let concluidaEUmNovo = ''

  beforeAll(async () => {
    // Nenhum despachante nem outro worker: o worker-lote do teste só mede, sem rodar job que alguém tenha deixado.
    compose('stop', ...PROCESSOS_DA_FILA)
    await recriarDoZero('observabilidade')
    quarentaESete = await sessoes.escola()
    quarentaEOito = await sessoes.escola()
    concluida = await sessoes.escola()
    concluidaEUmNovo = await sessoes.escola()
    escolas.push(quarentaESete, quarentaEOito, concluida, concluidaEUmNovo)
    await pedido(quarentaESete, 47, 'agendado')
    await pedido(quarentaEOito, 48, 'agendado')
    // Vencida há 100 h, mas já concluída: não conta.
    await pedido(concluida, 100, 'concluido')
    // Uma velha concluída e uma nova agendada: vale a agendada, e a idade da concluída não aparece.
    await pedido(concluidaEUmNovo, 120, 'concluido')
    await pedido(concluidaEUmNovo, 47, 'agendado')
    // O worker-lote mede no boot: sobe depois dos pedidos gravados.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', ...SERVICOS)
  }, 900_000)

  afterAll(async () => {
    await sessoes.pool.query('delete from arquivo_titular where escola_id = any($1::uuid[])', [escolas])
    await sessoes.pool.query('delete from pedido_titular where escola_id = any($1::uuid[])', [escolas])
    await sessoes.fechar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('47 h não dispara; 48 h dispara; a concluída não tem série, e a idade medida é a do agendado mais antigo', async () => {
    await expect.poll(() => noPrometheus(quarentaEOito), { timeout: 120_000, interval: 2_000 }).toBeGreaterThan(48)
    const mais = await noPrometheus(quarentaEOito)
    const menos = await noPrometheus(quarentaESete)
    expect(mais).toBeLessThan(49)
    expect(menos).toBeGreaterThanOrEqual(47)
    expect(menos).toBeLessThan(48)
    expect(await noPrometheus(concluida)).toBeUndefined()
    const novo = await noPrometheus(concluidaEUmNovo)
    expect(novo).toBeGreaterThanOrEqual(47)
    expect(novo).toBeLessThan(48)

    // O estado da regra para as escolas abaixo do limiar, amostrado do começo ao fim: um disparo entre duas leituras não passa
    // despercebido.
    const estadosDasQueNaoDisparam: EstadoDoAlerta[] = []
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        estadosDasQueNaoDisparam.push(await estadoDa(quarentaESete), await estadoDa(concluidaEUmNovo), await estadoDa(concluida))
        await new Promise((resolver) => setTimeout(resolver, 2_000))
      }
    })()
    try {
      await expect.poll(() => estadoDa(quarentaEOito), { timeout: 180_000, interval: 2_000 }).toBe('disparado')
      // Mais duas avaliações da regra depois do disparo, para uma pendência atrasada das outras aparecer.
      await new Promise((resolver) => setTimeout(resolver, 25_000))
    } finally {
      amostrando = false
      await amostragem
    }
    expect(estadosDasQueNaoDisparam.length).toBeGreaterThan(30)
    expect(estadosDasQueNaoDisparam.every((estado) => estado === 'normal')).toBe(true)
    // O disparo traz a escola, e só ela.
    const disparo = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: quarentaEOito })
    expect(disparo?.rotulos['escola_id']).toBe(quarentaEOito)
  }, 420_000)
})
