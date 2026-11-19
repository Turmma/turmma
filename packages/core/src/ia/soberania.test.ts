import { CHAVES_DE_CATEGORIA_DO_SUBOPERADOR, type CategoriaDeDadoDoSuboperador } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLLMConfig } from '../config/llm-config.js'
import type { SuboperadorParaAConferenciaDaD62 } from '../titular/suboperador-da-escola.repository.js'
import { categoriasEnviadasPelasTarefas, motivosDaD62, SoberaniaNaSubida } from './soberania.js'
import { TASK_CATALOG } from './tasks/index.js'

const PROVEDOR = 'provedor-contratado'
const EXIGIDAS = categoriasEnviadasPelasTarefas()

const externo = loadLLMConfig({ AMBIENTE: 'local', IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'https://api.provedor.test/v1', LLM_MODELO: 'modelo', IA_PROVEDOR_ID: PROVEDOR })
const local = loadLLMConfig({ AMBIENTE: 'local', IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'http://localhost:8080/v1', LLM_MODELO: 'modelo', LLM_PROCESSAMENTO_LOCAL: 'true' })
const falso = loadLLMConfig({ AMBIENTE: 'local' })

/** O cadastro que cobre a D62: Brasil, treinamento vedado, toda escola e as categorias das tarefas. */
const cobre = (): SuboperadorParaAConferenciaDaD62 => ({ pais: 'BR', vedaTreinamento: true, alcance: 'todas', categorias: [...EXIGIDAS] })

function registrador() {
  return { info: vi.fn(), warn: vi.fn() }
}

/** O cadastro por chave, como o banco responde: o provedor sem linha vigente devolve `undefined`. */
function leituraDe(cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | Error | undefined>) {
  const vigenteDoProvedor = vi.fn(async (chave: string) => {
    const linha = cadastro[chave]
    if (linha instanceof Error) throw linha
    return linha
  })
  return { vigenteDoProvedor }
}

describe('motivosDaD62: o que falta no suboperador, campo a campo', () => {
  it('cadastro que cobre tudo: nenhum motivo', () => {
    expect(motivosDaD62(cobre(), EXIGIDAS)).toEqual([])
  })

  it('sem suboperador vigente: um motivo só', () => {
    expect(motivosDaD62(undefined, EXIGIDAS)).toEqual(['sem_suboperador_vigente'])
  })

  it.each([
    ['pais', { pais: 'US' }, 'pais_fora_do_brasil'],
    ['veda_treinamento', { vedaTreinamento: false }, 'treinamento_nao_vedado'],
    ['alcance', { alcance: 'lista' as const }, 'alcance_nao_e_todas'],
  ])('um campo errado, %s, é o único motivo', (_campo, errado, motivo) => {
    expect(motivosDaD62({ ...cobre(), ...errado }, EXIGIDAS)).toEqual([motivo])
  })

  it('cada campo errado ao mesmo tempo aparece, e nenhum esconde o outro', () => {
    const todos = motivosDaD62({ pais: 'IE', vedaTreinamento: false, alcance: 'lista', categorias: [...EXIGIDAS] }, EXIGIDAS)
    expect(todos).toEqual(['pais_fora_do_brasil', 'treinamento_nao_vedado', 'alcance_nao_e_todas'])
  })

  it.each(EXIGIDAS.map((categoria) => [categoria]))('sem a categoria %s: só ela é o motivo', (categoria) => {
    const categorias = EXIGIDAS.filter((outra) => outra !== categoria)
    expect(motivosDaD62({ ...cobre(), categorias }, EXIGIDAS)).toEqual([`categoria_faltando:${categoria}`])
  })

  it('categoria que nenhuma tarefa envia não é exigida: o suboperador pode listar mais, e mais não é motivo', () => {
    const sobra = CHAVES_DE_CATEGORIA_DO_SUBOPERADOR.filter((categoria) => !EXIGIDAS.includes(categoria))
    expect(sobra.length).toBeGreaterThan(0)
    expect(motivosDaD62({ ...cobre(), categorias: [...EXIGIDAS, ...sobra] }, EXIGIDAS)).toEqual([])
  })
})

describe('categoriasEnviadasPelasTarefas', () => {
  it('é a união, sem repetir, das categorias de cada tarefa do catálogo', () => {
    expect(new Set(EXIGIDAS).size).toBe(EXIGIDAS.length)
    for (const tarefa of Object.values(TASK_CATALOG)) for (const categoria of tarefa.categoriasEnviadas) expect(EXIGIDAS).toContain(categoria)
    expect(categoriasEnviadasPelasTarefas([{ categoriasEnviadas: ['cadastro'] }, { categoriasEnviadas: ['cadastro', 'trabalho_do_aluno'] }])).toEqual<CategoriaDeDadoDoSuboperador[]>(['cadastro', 'trabalho_do_aluno'])
  })
})

describe('SoberaniaNaSubida', () => {
  it.each([
    ['o adaptador falso', falso],
    ['o modelo local', local],
  ])('%s nasce conferido e nem lê o cadastro', async (_nome, config) => {
    const leitura = leituraDe({})
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config, leitura, logger })
    expect(soberania.conferida).toBe(true)
    await soberania.start()
    expect(leitura.vigenteDoProvedor).not.toHaveBeenCalled()
    // Nem o aviso de "conferida" sai: não houve conferência.
    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    await expect(soberania.aguardarConferida()).resolves.toBe(true)
  })

  it('provedor externo nasce não conferido, e o cadastro que cobre a D62, lido pela chave da IA_PROVEDOR_ID, o confere', async () => {
    const leitura = leituraDe({ [PROVEDOR]: cobre() })
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger })
    expect(soberania.conferida).toBe(false)
    await soberania.start()
    expect(leitura.vigenteDoProvedor).toHaveBeenCalledExactlyOnceWith(PROVEDOR)
    expect(soberania.conferida).toBe(true)
    expect(logger.info).toHaveBeenCalledWith({ evento: 'ia.soberania_conferida', provedorId: PROVEDOR })
    soberania.encerrar()
  })

  it('o suboperador vigente é de outro provedor: a chave da instância não tem linha e a conferência recusa', async () => {
    const leitura = leituraDe({ 'outro-provedor': cobre() })
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger, intervaloMs: 60_000 })
    await soberania.start()
    expect(soberania.conferida).toBe(false)
    expect(leitura.vigenteDoProvedor).toHaveBeenCalledWith(PROVEDOR)
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ evento: 'ia.soberania_na_subida_recusada', provedorId: PROVEDOR, codigo: 'sem_suboperador_vigente' }))
    soberania.encerrar()
  })

  it('o cadastro que não cobre fica não conferido e o log diz o motivo; consertado o cadastro, a instância se confere sozinha, sem reiniciar', async () => {
    const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | undefined> = { [PROVEDOR]: { ...cobre(), pais: 'US' } }
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger, intervaloMs: 10 })
    await soberania.start()
    expect(soberania.conferida).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ evento: 'ia.soberania_na_subida_recusada', codigo: 'pais_fora_do_brasil' }))
    const espera = soberania.aguardarConferida()
    cadastro[PROVEDOR] = cobre()
    await expect(espera).resolves.toBe(true)
    expect(soberania.conferida).toBe(true)
    soberania.encerrar()
  })

  it('o banco fora é falha fechada, com o evento próprio e sem o texto do erro além do resumo, e a conferência volta quando o banco volta', async () => {
    const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | Error | undefined> = { [PROVEDOR]: new Error('connect ECONNREFUSED 127.0.0.1:5432') }
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger, intervaloMs: 10 })
    await soberania.start()
    expect(soberania.conferida).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ evento: 'ia.soberania_na_subida_sem_banco', provedorId: PROVEDOR }))
    expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ evento: 'ia.soberania_na_subida_recusada' }))
    const espera = soberania.aguardarConferida()
    cadastro[PROVEDOR] = cobre()
    await expect(espera).resolves.toBe(true)
    soberania.encerrar()
  })

  describe('o log da instância que espera o cadastro (relógio falso: cada tentativa é uma volta do intervalo)', () => {
    afterEach(() => vi.useRealTimers())

    it.each([
      ['o cadastro que não cobre', { [PROVEDOR]: { ...cobre(), vedaTreinamento: false } }],
      ['o banco fora', { [PROVEDOR]: new Error('connect ECONNREFUSED 127.0.0.1:5432') }],
    ])('%s: o primeiro aviso sai e o mesmo motivo repetido espera', async (_nome, cadastro) => {
      vi.useFakeTimers()
      const logger = registrador()
      const leitura = leituraDe(cadastro)
      const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger, intervaloMs: 10 })
      await soberania.start()
      await vi.advanceTimersByTimeAsync(10 * 5)
      soberania.encerrar()
      expect(leitura.vigenteDoProvedor).toHaveBeenCalledTimes(6)
      expect(logger.warn).toHaveBeenCalledTimes(1)
    })

    it('o aviso se repete a cada 12 tentativas do mesmo motivo, e a tentativa vem junto', async () => {
      vi.useFakeTimers()
      const logger = registrador()
      const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe({ [PROVEDOR]: undefined }), logger, intervaloMs: 10 })
      await soberania.start()
      await vi.advanceTimersByTimeAsync(10 * 11)
      soberania.encerrar()
      expect(logger.warn.mock.calls.map(([linha]) => (linha as { tentativas: number }).tentativas)).toEqual([1, 12])
    })

    it('a repetição conta as tentativas do mesmo motivo, e não todas: o motivo que muda recomeça a conta', async () => {
      vi.useFakeTimers()
      const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | Error | undefined> = { [PROVEDOR]: undefined }
      const logger = registrador()
      const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger, intervaloMs: 10 })
      await soberania.start()
      cadastro[PROVEDOR] = { ...cobre(), pais: 'US' }
      await vi.advanceTimersByTimeAsync(10 * 12)
      soberania.encerrar()
      // A 1ª é a do primeiro motivo, a 2ª a do segundo, e a repetição dele é a 12ª tentativa **dele**, a 13ª da instância (e não a 12ª).
      expect(logger.warn.mock.calls.map(([linha]) => (linha as { tentativas: number }).tentativas)).toEqual([1, 2, 13])
    })

    it('o motivo que muda sai na hora, ainda que o anterior tenha acabado de sair', async () => {
      vi.useFakeTimers()
      const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | Error | undefined> = { [PROVEDOR]: undefined }
      const logger = registrador()
      const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger, intervaloMs: 10 })
      await soberania.start()
      cadastro[PROVEDOR] = { ...cobre(), pais: 'US' }
      await vi.advanceTimersByTimeAsync(10)
      soberania.encerrar()
      expect(logger.warn.mock.calls.map(([linha]) => (linha as { codigo: string }).codigo)).toEqual(['sem_suboperador_vigente', 'pais_fora_do_brasil'])
    })
  })

  it('o cadastro sem uma categoria que uma tarefa envia não confere, para cada categoria: a exigida é a união das tarefas, e não só a conversa do aluno', async () => {
    for (const categoria of EXIGIDAS) {
      const leitura = leituraDe({ [PROVEDOR]: { ...cobre(), categorias: EXIGIDAS.filter((outra) => outra !== categoria) } })
      const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger: registrador(), intervaloMs: 60_000 })
      await soberania.start()
      expect(soberania.conferida, categoria).toBe(false)
      soberania.encerrar()
    }
  })

  it('iniciar é idempotente: quem espera a primeira conferência e o bootstrap dividem a mesma leitura', async () => {
    const leitura = leituraDe({ [PROVEDOR]: cobre() })
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger: registrador() })
    await Promise.all([soberania.start(), soberania.start()])
    await soberania.start()
    expect(leitura.vigenteDoProvedor).toHaveBeenCalledTimes(1)
  })

  it('depois de encerrada, a instância não lê o cadastro: nem a primeira conferência, nem a que estava em andamento ao encerrar', async () => {
    const encerradaAntes = leituraDe({ [PROVEDOR]: cobre() })
    const antes = new SoberaniaNaSubida({ config: externo, leitura: encerradaAntes, logger: registrador() })
    antes.encerrar()
    await antes.start()
    expect(encerradaAntes.vigenteDoProvedor).not.toHaveBeenCalled()
    expect(antes.conferida).toBe(false)

    // A leitura em andamento volta recusando depois do `encerrar`: a instância não agenda outra, e não deixa um temporizador ocioso segurando o desligamento.
    vi.useFakeTimers()
    try {
      let devolver: (valor: undefined) => void = () => undefined
      const vigenteDoProvedor = vi.fn(() => new Promise<undefined>((resolver) => (devolver = resolver)))
      const durante = new SoberaniaNaSubida({ config: externo, leitura: { vigenteDoProvedor }, logger: registrador(), intervaloMs: 1 })
      const primeira = durante.start()
      durante.encerrar()
      devolver(undefined)
      await primeira
      expect(vi.getTimerCount()).toBe(0)
      await vi.advanceTimersByTimeAsync(30)
      expect(vigenteDoProvedor).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }

    // A leitura em andamento volta **conferida** depois do `encerrar`: a instância que encerrou não se declara conferida, não solta ninguém com `true` e não loga a conferência.
    let devolverCobre: (valor: SuboperadorParaAConferenciaDaD62) => void = () => undefined
    const logger = registrador()
    const passando = new SoberaniaNaSubida({ config: externo, leitura: { vigenteDoProvedor: () => new Promise((resolver) => (devolverCobre = resolver)) }, logger })
    const primeira = passando.start()
    passando.encerrar()
    devolverCobre(cobre())
    await primeira
    expect(passando.conferida).toBe(false)
    await expect(passando.aguardarConferida()).resolves.toBe(false)
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('encerrar para as conferências e solta quem esperava com false', async () => {
    const leitura = leituraDe({ [PROVEDOR]: undefined })
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger: registrador(), intervaloMs: 5 })
    await soberania.start()
    const espera = soberania.aguardarConferida()
    soberania.encerrar()
    await expect(espera).resolves.toBe(false)
    await expect(soberania.aguardarConferida()).resolves.toBe(false)
    const lidas = leitura.vigenteDoProvedor.mock.calls.length
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(leitura.vigenteDoProvedor.mock.calls.length).toBe(lidas)
  })

  it('depois de conferida, a instância não lê o cadastro de novo: encerrar o suboperador pede reiniciar (runbook)', async () => {
    const leitura = leituraDe({ [PROVEDOR]: cobre() })
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger: registrador(), intervaloMs: 5 })
    await soberania.start()
    await new Promise((resolver) => setTimeout(resolver, 30))
    expect(leitura.vigenteDoProvedor).toHaveBeenCalledTimes(1)
    soberania.encerrar()
  })
})
