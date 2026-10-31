import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../apps/api/test/sessao.fixture.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { compose, composeAssincronoOuFalha, PROCESSOS_DA_FILA, recriarDoZero } from '../../tools/testes/compose.ts'
import { alertaCom, lerRegrasNoGrafana, REGRAS_PROVISIONADAS, type EstadoDoAlerta } from '../scripts/ensaio-alertas.ts'

// O alerta "Arquivo do titular em preparação há mais de 2 h" (F3, tarefa 13.0; Tech Spec do F3, seção 7c) contra o compose de teste,
// com as imagens construídas: a observabilidade com a regra provisionada de infra/grafana/alertas/, e o worker-lote exportando
// `arquivo.horas_em_preparacao` por OTLP de verdade, medida no boot a partir de `pedido_titular`. Os pedidos são gravados direto no
// banco antes de o worker subir, registrados a 1 h e a 3 h do instante do banco.
const ambiente = lerAmbienteDeTeste()
const porta = (variavel: string) => valorObrigatorio(ambiente, variavel)
const GRAFANA = `http://127.0.0.1:${porta('GRAFANA_PORTA_HOST')}`
const PROMETHEUS = `http://127.0.0.1:${porta('PROMETHEUS_PORTA_HOST')}`
const SERVICOS = ['observabilidade', 'worker-lote-1'] as const
const UID = REGRAS_PROVISIONADAS.arquivoEmPreparacao

const sessoes = new BancadaDeSessoes()
const escolas: string[] = []

/**
 * Um pedido de acesso de aluno da escola, registrado há `horasAtras` horas no estado dado. O titular e quem registrou são o mesmo
 * usuário de teste da escola (o gatilho de inserção exige usuário da escola), e o pedido guarda só ids e datas.
 */
async function pedido(escolaId: string, horasAtras: number, estado: 'em_preparacao' | 'pronto'): Promise<void> {
  const [aluno] = await sessoes.sessoes(escolaId, { papel: 'aluno', quantidade: 1 })
  if (aluno === undefined) throw new Error('aluno de teste não criado')
  await sessoes.pool.query(
    `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, registrado_em, chave_envio)
     values ($1, $2, 'aluno', 'acesso', 'titular', current_date, $3, '[]'::jsonb, $2, now() - $4::int * interval '1 hour', $5)`,
    [escolaId, aluno.usuarioId, estado, horasAtras, randomUUID()],
  )
}

async function noPrometheus(escolaId: string): Promise<number | undefined> {
  const consulta = new URLSearchParams({ query: `max(arquivo_horas_em_preparacao{job="educa/worker", escola_id="${escolaId}"})` })
  const corpo = (await (await fetch(`${PROMETHEUS}/api/v1/query?${consulta}`)).json()) as { data: { result: Array<{ value: [number, string] }> } }
  const [serie] = corpo.data.result
  return serie === undefined ? undefined : Number(serie.value[1])
}

async function estadoDa(escolaId: string): Promise<EstadoDoAlerta> {
  return alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: escolaId })?.estado ?? 'normal'
}

describe('alerta de arquivo do titular em preparação há mais de 2 h, na observabilidade local', () => {
  let umaHora = ''
  let tresHoras = ''
  let pronto = ''
  let prontoEUmNovo = ''

  beforeAll(async () => {
    // Nenhum despachante nem outro worker: o worker-lote do teste só mede, sem rodar job que alguém tenha deixado.
    compose('stop', ...PROCESSOS_DA_FILA)
    await recriarDoZero('observabilidade')
    umaHora = await sessoes.escola()
    tresHoras = await sessoes.escola()
    pronto = await sessoes.escola()
    prontoEUmNovo = await sessoes.escola()
    escolas.push(umaHora, tresHoras, pronto, prontoEUmNovo)
    await pedido(umaHora, 1, 'em_preparacao')
    await pedido(tresHoras, 3, 'em_preparacao')
    // Há 40 h, mas já ficou pronto: não conta.
    await pedido(pronto, 40, 'pronto')
    // Um velho pronto e um novo em preparação: vale o novo, e a idade do pronto não aparece.
    await pedido(prontoEUmNovo, 50, 'pronto')
    await pedido(prontoEUmNovo, 1, 'em_preparacao')
    // O worker-lote mede no boot: sobe depois dos pedidos gravados.
    await composeAssincronoOuFalha('up', '--detach', '--build', '--wait', ...SERVICOS)
  }, 900_000)

  afterAll(async () => {
    await sessoes.pool.query('delete from arquivo_titular where escola_id = any($1::uuid[])', [escolas])
    await sessoes.pool.query('delete from pedido_titular where escola_id = any($1::uuid[])', [escolas])
    await sessoes.fechar()
    await composeAssincronoOuFalha('stop', ...SERVICOS)
  }, 180_000)

  it('1 h não dispara; 3 h dispara; o pronto não tem série, e a idade medida é a do mais antigo em preparação', async () => {
    await expect.poll(() => noPrometheus(tresHoras), { timeout: 120_000, interval: 2_000 }).toBeGreaterThanOrEqual(3)
    const mais = await noPrometheus(tresHoras)
    const menos = await noPrometheus(umaHora)
    expect(mais).toBeLessThan(4)
    expect(menos).toBeGreaterThanOrEqual(1)
    expect(menos).toBeLessThan(2)
    expect(await noPrometheus(pronto)).toBeUndefined()
    const novo = await noPrometheus(prontoEUmNovo)
    expect(novo).toBeGreaterThanOrEqual(1)
    expect(novo).toBeLessThan(2)

    // O estado da regra para as escolas abaixo do limiar, amostrado do começo ao fim: um disparo entre duas leituras não passa
    // despercebido.
    const estadosDasQueNaoDisparam: EstadoDoAlerta[] = []
    let amostrando = true
    const amostragem = (async () => {
      while (amostrando) {
        estadosDasQueNaoDisparam.push(await estadoDa(umaHora), await estadoDa(prontoEUmNovo), await estadoDa(pronto))
        await new Promise((resolver) => setTimeout(resolver, 2_000))
      }
    })()
    try {
      await expect.poll(() => estadoDa(tresHoras), { timeout: 180_000, interval: 2_000 }).toBe('disparado')
      // Mais duas avaliações da regra depois do disparo, para uma pendência atrasada das outras aparecer.
      await new Promise((resolver) => setTimeout(resolver, 25_000))
    } finally {
      amostrando = false
      await amostragem
    }
    expect(estadosDasQueNaoDisparam.length).toBeGreaterThan(30)
    expect(estadosDasQueNaoDisparam.every((estado) => estado === 'normal')).toBe(true)
    // O disparo traz a escola, e só ela.
    const disparo = alertaCom((await lerRegrasNoGrafana(GRAFANA)).get(UID), { escola_id: tresHoras })
    expect(disparo?.rotulos['escola_id']).toBe(tresHoras)
  }, 420_000)
})
