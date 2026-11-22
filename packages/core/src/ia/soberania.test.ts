import { CHAVES_DE_CATEGORIA_DO_SUBOPERADOR, type CategoriaDeDadoDoSuboperador } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLLMConfig } from '../config/llm-config.js'
import type { SuboperadorParaAConferenciaDaD62 } from '../titular/suboperador-da-escola.repository.js'
import { MODELO_FALSO } from './fake-adapter.js'
import { reservaElegivel, tarefasAprovadasParaAReserva, type ModeloAprovado } from './modelos-aprovados.js'
import { categoriasDasTarefas, categoriasEnviadasPelasTarefas, motivosDaD62, SoberaniaNaSubida } from './soberania.js'
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

describe('a D62 da reserva: as categorias são as das tarefas aprovadas para ela (reserva-e-avaliacao, 1.0)', () => {
  const aprovada = (tarefa: ModeloAprovado['tarefa']): ModeloAprovado => ({ tarefa, provedorId: 'provedor-reserva', modelo: MODELO_FALSO, relatorio: 'docs/avaliacao/falso-reserva/relatorio.md', sha256: 'x', aprovadoPor: 'teste', aprovadoEm: '2026-11-22' })
  const reserva = { identidade: 'provedor-reserva', modeloDoPerfil: () => MODELO_FALSO }
  /** O que a subida da reserva exigiria do contrato dela, com a aprovação que o teste injeta. */
  const exigidasDa = (...tarefas: ModeloAprovado['tarefa'][]) => categoriasDasTarefas(tarefasAprovadasParaAReserva(reserva, 'producao', tarefas.map(aprovada)))
  const soMaterial: SuboperadorParaAConferenciaDaD62 = { pais: 'BR', vedaTreinamento: true, alcance: 'todas', categorias: ['material_da_escola'] }

  it('as categorias saem das tarefas, sem repetir, na ordem em que aparecem; sem tarefa, nenhuma', () => {
    expect(categoriasDasTarefas([])).toEqual([])
    expect(categoriasDasTarefas(['gerar_atividade_objetiva'])).toEqual(['material_da_escola'])
    expect(categoriasDasTarefas(['gerar_atividade_objetiva', 'turno_do_tutor'])).toEqual(['material_da_escola', 'conversa_do_aluno', 'trabalho_do_aluno'])
  })

  it('controle negativo: contrato só do material da escola, reserva aprovada para a geração e para o Tutor: a categoria da conversa do aluno falta', () => {
    expect(motivosDaD62(soMaterial, exigidasDa('gerar_atividade_objetiva', 'turno_do_tutor'))).toContain('categoria_faltando:conversa_do_aluno')
  })

  it('controle positivo: o mesmo contrato, reserva aprovada só para a geração: conferida', () => {
    expect(motivosDaD62(soMaterial, exigidasDa('gerar_atividade_objetiva'))).toEqual([])
    // O catálogo inteiro exigiria a conversa do aluno: é o que a aprovação por tarefa evita.
    expect(motivosDaD62(soMaterial, EXIGIDAS)).toContain('categoria_faltando:conversa_do_aluno')
  })

  it('fora do Brasil não é elegível, qualquer que seja a tarefa aprovada: a de trabalho do aluno sem texto de aluno e a só de material', () => {
    // `relatorio_da_correcao` envia `trabalho_do_aluno` sem `levaTextoDeAluno`; a geração envia só o material da escola.
    expect(TASK_CATALOG.relatorio_da_correcao.levaTextoDeAluno).toBe(false)
    for (const tarefa of ['relatorio_da_correcao', 'gerar_atividade_objetiva'] as const) {
      const todas: SuboperadorParaAConferenciaDaD62 = { pais: 'US', vedaTreinamento: true, alcance: 'todas', categorias: [...exigidasDa(tarefa)] }
      expect(motivosDaD62(todas, exigidasDa(tarefa)), tarefa).toEqual(['pais_fora_do_brasil'])
    }
  })
})

describe('a conferência da reserva: o mesmo contrato da D62, pela chave dela, sem segurar o principal (reserva-e-avaliacao, 2.0)', () => {
  const RESERVA = 'reserva-contratada'
  const MODELO_DA_RESERVA = 'modelo-da-reserva'
  const envioDaReserva = { envioExterno: true, provedorId: RESERVA } as const
  const daReserva = (...tarefas: ModeloAprovado['tarefa'][]) => ({ envio: envioDaReserva, tarefas })
  const soMaterial: SuboperadorParaAConferenciaDaD62 = { pais: 'BR', vedaTreinamento: true, alcance: 'todas', categorias: ['material_da_escola'] }
  const aprovada = (tarefa: ModeloAprovado['tarefa']): ModeloAprovado => ({ tarefa, provedorId: RESERVA, modelo: MODELO_DA_RESERVA, relatorio: 'docs/avaliacao/falso-reserva/relatorio.md', sha256: 'x', aprovadoPor: 'teste', aprovadoEm: '2026-11-22' })

  it('nasce não conferida e lê o cadastro pela chave da reserva, e não pela do principal; o cadastro que cobre a confere, com o evento dela', async () => {
    const leitura = leituraDe({ [PROVEDOR]: undefined, [RESERVA]: soMaterial })
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger, daReserva: daReserva('gerar_atividade_objetiva') })
    expect(soberania.conferida).toBe(false)
    await soberania.start()
    expect(leitura.vigenteDoProvedor).toHaveBeenCalledExactlyOnceWith(RESERVA)
    expect(soberania.conferida).toBe(true)
    expect(logger.info).toHaveBeenCalledExactlyOnceWith({ evento: 'ia.provedor_de_reserva.conferida', provedorId: RESERVA })
    soberania.encerrar()
  })

  it('as categorias exigidas são as das tarefas aprovadas para ela: a mesma instância confere sem a conversa do aluno só se o Tutor não está aprovado', async () => {
    const semOTutor = new SoberaniaNaSubida({ config: externo, leitura: leituraDe({ [RESERVA]: soMaterial }), logger: registrador(), daReserva: daReserva('gerar_atividade_objetiva') })
    await semOTutor.start()
    expect(semOTutor.conferida).toBe(true)
    const logger = registrador()
    const comOTutor = new SoberaniaNaSubida({ config: externo, leitura: leituraDe({ [RESERVA]: soMaterial }), logger, daReserva: daReserva('gerar_atividade_objetiva', 'turno_do_tutor'), intervaloMs: 60_000 })
    await comOTutor.start()
    expect(comOTutor.conferida).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'categoria_faltando:conversa_do_aluno,categoria_faltando:trabalho_do_aluno' }))
    semOTutor.encerrar()
    comOTutor.encerrar()
  })

  it.each([
    ['fora do Brasil', { ...soMaterial, pais: 'US' }, 'pais_fora_do_brasil'],
    ['treinamento não vedado', { ...soMaterial, vedaTreinamento: false }, 'treinamento_nao_vedado'],
    ['alcance que não é todas', { ...soMaterial, alcance: 'lista' as const }, 'alcance_nao_e_todas'],
    ['sem suboperador vigente (o encerrado não volta do cadastro)', undefined, 'sem_suboperador_vigente'],
  ])('%s: não conferida, e o log da reserva traz só o evento, a chave, a tentativa e o código', async (_nome, cadastro, codigo) => {
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe({ [RESERVA]: cadastro }), logger, daReserva: daReserva('gerar_atividade_objetiva'), intervaloMs: 60_000 })
    await soberania.start()
    expect(soberania.conferida).toBe(false)
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({ evento: 'ia.provedor_de_reserva.conferencia_recusada', provedorId: RESERVA, tentativas: 1, codigo })
    soberania.encerrar()
  })

  it('o log da recusa nunca leva o contrato, o nome do suboperador nem a chave da reserva, ainda que o cadastro e a configuração os tragam', async () => {
    const CHAVE = 'chave-secreta-da-reserva-0123456789'
    const CONTRATO = 'CONTRATO-RECONHECIVEL-987'
    const config = loadLLMConfig({
      AMBIENTE: 'local',
      IA_ADAPTADOR: 'openai_compat',
      LLM_BASE_URL: 'https://api.provedor.test/v1',
      LLM_MODELO: 'modelo',
      IA_PROVEDOR_ID: PROVEDOR,
      IA_RESERVA_ADAPTADOR: 'openai_compat',
      LLM_RESERVA_BASE_URL: 'https://reserva.provedor.test/v1',
      LLM_RESERVA_MODELO: MODELO_DA_RESERVA,
      IA_RESERVA_PROVEDOR_ID: RESERVA,
      LLM_RESERVA_CHAVE_API: CHAVE,
    })
    // O cadastro de verdade tem mais campos do que a conferência lê; a leitura devolve o que o banco devolveria.
    const cadastro = { ...soMaterial, pais: 'US', contrato: CONTRATO, nome: 'Provedor Reconhecível Ltda' } as SuboperadorParaAConferenciaDaD62
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config, leitura: leituraDe({ [RESERVA]: cadastro }), logger, daReserva: daReserva('gerar_atividade_objetiva'), intervaloMs: 60_000 })
    await soberania.start()
    soberania.encerrar()
    const dito = JSON.stringify([...logger.warn.mock.calls, ...logger.info.mock.calls])
    expect(dito).toContain('ia.provedor_de_reserva.conferencia_recusada')
    for (const segredo of [CHAVE, CONTRATO, 'Provedor Reconhecível']) expect(dito).not.toContain(segredo)
  })

  it('o cadastro corrigido, sem reiniciar: a reserva se confere sozinha na próxima volta, e quem a espera é solto com true', async () => {
    const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | undefined> = { [RESERVA]: { ...soMaterial, pais: 'US' } }
    const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger: registrador(), daReserva: daReserva('gerar_atividade_objetiva'), intervaloMs: 10 })
    await soberania.start()
    expect(soberania.conferida).toBe(false)
    const espera = soberania.aguardarConferida()
    cadastro[RESERVA] = soMaterial
    await expect(espera).resolves.toBe(true)
    expect(soberania.conferida).toBe(true)
    soberania.encerrar()
  })

  it('o banco fora é falha fechada, com o evento da reserva, e o log do principal não é o dela', async () => {
    const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | Error | undefined> = { [RESERVA]: new Error('connect ECONNREFUSED 127.0.0.1:5432') }
    const logger = registrador()
    const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger, daReserva: daReserva('gerar_atividade_objetiva'), intervaloMs: 10 })
    await soberania.start()
    expect(soberania.conferida).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ evento: 'ia.provedor_de_reserva.conferencia_sem_banco', provedorId: RESERVA }))
    expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ evento: 'ia.soberania_na_subida_sem_banco' }))
    soberania.encerrar()
  })

  it('a reserva que não envia nada para fora (a falsa) nasce conferida e nem lê o cadastro', async () => {
    const leitura = leituraDe({})
    const soberania = new SoberaniaNaSubida({ config: externo, leitura, logger: registrador(), daReserva: { envio: { envioExterno: false, provedorId: null }, tarefas: ['gerar_atividade_objetiva'] } })
    expect(soberania.conferida).toBe(true)
    await soberania.start()
    expect(leitura.vigenteDoProvedor).not.toHaveBeenCalled()
  })

  it('a elegibilidade lê esta conferência: enquanto não passa a reserva não é elegível, e quando passa, é, na tarefa que tem aprovação (a porta que a 1.0 deixou)', async () => {
    const cadastro: Record<string, SuboperadorParaAConferenciaDaD62 | undefined> = { [RESERVA]: undefined }
    const soberania = new SoberaniaNaSubida({ config: externo, leitura: leituraDe(cadastro), logger: registrador(), daReserva: daReserva('gerar_atividade_objetiva'), intervaloMs: 10 })
    const reserva = { identidade: RESERVA, modeloDoPerfil: () => MODELO_DA_RESERVA }
    const tarefa = { nome: 'gerar_atividade_objetiva', perfil: TASK_CATALOG.gerar_atividade_objetiva.perfil } as const
    const contexto = { reserva, soberania, ambiente: 'local', aprovados: [aprovada('gerar_atividade_objetiva')] } as const
    await soberania.start()
    expect(reservaElegivel(tarefa, contexto)).toBe(false)
    cadastro[RESERVA] = soMaterial
    await soberania.aguardarConferida()
    expect(reservaElegivel(tarefa, contexto)).toBe(true)
    soberania.encerrar()
  })
})
