import { ErrorCode, TAREFAS_DE_IA, type TarefaDeIa } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runInContext } from '../context/context.js'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { ScriptedAdapter, PROVEDOR_ROTEIRIZADO } from './__fixtures__/scripted-adapter.js'
import { chatResponse, startFakeLlamaServer, type FakeLlamaServer } from './__fixtures__/fake-llama-server.js'
import { withEscolaContextOfRequest } from './__fixtures__/escola-context.js'
import { ALUNO_1, ALUNO_2, atividadeDeEstequiometria, entradaDeAtividade, entradaDoAssistente, entradaDoRelatorio, entradaDoTutor, ESCOLA_A, ESCOLA_B } from './__fixtures__/inputs.js'
import type { ModelAdapter, ModelCall, ModelResponse } from './adapter.js'
import { FakeAdapter, MODELO_FALSO } from './fake-adapter.js'
import { chaveDoPreco, custoDaChamada, InMemoryConsumo, precoDoModelo, InMemoryOrcamento, type OrcamentoQuery, type ConsumoDeIa, type OrcamentoDeIa, type RegistroDeConsumo, type TabelaDePrecos } from './consumo.js'
import { loadLLMConfig, type LLMConfig } from '../config/llm-config.js'
import { HTTP_STATUS_BY_CODE } from '../error/domain.exception.js'
import { LLM_ERROR_CODES, LLMError, ProviderError } from './errors.js'
import type { DeclaracaoDeSoberania, EnvioDaChamada, GenerationMeasurement } from './port.js'
import { adaptadorDaReserva, createLLMGateway, destinoDoAdaptador, ESPERA_MAXIMA_DA_VAGA_MS, MODELO_DA_REGRA_FIXA, MOTIVO_MODELO_DA_RESERVA_SEM_PRECO, MOTIVO_MODELO_MENOR_SEM_PRECO, MOTIVO_MODELO_SEM_PRECO, LLMGateway, type LLMGatewayDependencies, type LLMLogger } from './llm-gateway.js'
import type { FilaDeTokens, LimiteDeTokens, ResultadoDaReserva } from './token-limiter.js'
import { InvalidConfigError } from '../config/validate-config.js'
import { RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO } from './tasks/propor-ferramenta.js'
import { exigirFuncaoAtiva, InMemorySuspensoes, type SuspensaoDeFuncao } from './suspensao.js'
import { tokensDoPedido } from './teto-de-entrada.js'
import type { TaskDefinition } from './task.js'
import { gerarAtividadeObjetiva } from './tasks/gerar-atividade-objetiva.js'
import { proporFerramenta } from './tasks/propor-ferramenta.js'
import { relatorioDaCorrecao } from './tasks/relatorio-da-correcao.js'
import { turnoDoTutor } from './tasks/turno-do-tutor.js'
import { classificarSecoes } from './tasks/classificar-secoes.js'
import { PROMPT_CLASSIFICAR_SECOES } from './prompts/classificar-secoes.js'
import { ResilientAdapter } from './resilient-adapter.js'
import { MATERIAL_DE_ESTEQUIOMETRIA } from './__fixtures__/estequiometria.js'
import type { ModeloAprovado } from './modelos-aprovados.js'
import type { Perfil } from './perfis.js'
import { METRICS } from '../telemetry/metrics.js'
import { OpenAICompatAdapter } from './openai-compat-adapter.js'

const EXECUCAO = '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6'
const PRAZOS = { rapido: 5_000, padrao: 5_000, complexo: 5_000, visao: 5_000 } as const
/** A subida conferiu a D62: o suboperador do provedor cobre o texto de aluno. */
const CONFERIDA: DeclaracaoDeSoberania = { conferida: true }
const SEMPRE = { check: async () => ({ permitido: true as const }) } satisfies OrcamentoDeIa

function registrador(): LLMLogger & { linhas: () => unknown[] } {
  const info = vi.fn()
  const warn = vi.fn()
  return { info, warn, linhas: () => [...info.mock.calls, ...warn.mock.calls].flat() }
}

/** Só as opções que o teste passou: com `exactOptionalPropertyTypes`, o campo opcional não aceita `undefined`. */
function soOQuePassou<Campos extends object>(campos: Campos): { [Chave in keyof Campos]?: Exclude<Campos[Chave], undefined> } {
  return Object.fromEntries(Object.entries(campos).filter(([, valor]) => valor !== undefined)) as { [Chave in keyof Campos]?: Exclude<Campos[Chave], undefined> }
}

/** `semContexto`: o provedor puro, sem o contexto da escola do pedido, para o teste do que acontece sem escola no contexto. */
function montar(opcoes: { adaptador?: ModelAdapter; orcamento?: OrcamentoDeIa; registro?: RegistroDeConsumo; suspensao?: SuspensaoDeFuncao; soberania?: DeclaracaoDeSoberania; logger?: LLMLogger; agora?: () => Date; semContexto?: true; medidor?: MedidorDeTeste['medidor']; limiteDeTokens?: LimiteDeTokens; modelosMenores?: LLMGatewayDependencies['modelosMenores']; precos?: TabelaDePrecos; reserva?: LLMGatewayDependencies['reserva']; soberaniaDaReserva?: DeclaracaoDeSoberania } = {}) {
  const consumo = new InMemoryConsumo()
  const relogio = { agora: opcoes.agora ?? (() => new Date('2026-10-05T13:00:00Z')) }
  const puro = new LLMGateway({
    adaptador: opcoes.adaptador ?? new FakeAdapter(),
    registro: opcoes.registro ?? consumo,
    orcamento: opcoes.orcamento ?? SEMPRE,
    suspensao: opcoes.suspensao ?? new InMemorySuspensoes(),
    relogio,
    ...soOQuePassou({ soberania: opcoes.soberania, logger: opcoes.logger, medidor: opcoes.medidor, limiteDeTokens: opcoes.limiteDeTokens, modelosMenores: opcoes.modelosMenores, precos: opcoes.precos, reserva: opcoes.reserva, soberaniaDaReserva: opcoes.soberaniaDaReserva }),
  })
  const ia = opcoes.semContexto === true ? puro : withEscolaContextOfRequest(puro)
  return { ia, consumo, relogio }
}

async function erroDe(promessa: Promise<unknown>): Promise<LLMError> {
  const erro: unknown = await promessa.then(
    () => undefined,
    (motivo: unknown) => motivo,
  )
  if (!(erro instanceof LLMError)) throw new Error('a chamada deveria ter falhado com ErroDeIa')
  return erro
}

const consumidaDeMedida = () =>
  ({
    origem: 'openai_compat',
    perfil: 'padrao',
    modelo: 'm',
    promptVersao: 'v',
    tokensDeEntrada: 1,
    tokensDeSaida: 1,
    custoMicros: 0,
    duracaoMs: 1,
    tentativas: 1,
    tarefa: 'gerar_atividade_objetiva',
    funcao: 'conversa_e_ferramentas',
    estado: 'concluida',
    em: new Date(),
    envioExterno: false,
    provedorId: null,
  }) as const

describe('ProvedorDeIa: saída validada e medição', () => {
  it('devolve a saída da tarefa já validada, e a medição diz o perfil, o modelo, os tokens, a duração e que não houve envio externo', async () => {
    const { ia } = montar()
    const { saida, medicao } = await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(saida).toEqual(atividadeDeEstequiometria())
    expect(medicao).toMatchObject({ origem: 'falso', perfil: 'padrao', modelo: MODELO_FALSO, promptVersao: gerarAtividadeObjetiva.prompt.versao, envioExterno: false, provedorId: null, tentativas: 1 })
    expect(medicao.tokensDeEntrada).toBeGreaterThan(0)
    expect(medicao.tokensDeSaida).toBeGreaterThan(0)
    expect(medicao.duracaoMs).toBeGreaterThanOrEqual(0)
  })

  it('com adaptador que manda para fora, a medição e o registro dizem que houve envio externo', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())], true) })
    const { medicao } = await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao.envioExterno).toBe(true)
    expect(consumo.registros[0]?.envioExterno).toBe(true)
  })

  it('com envio externo, o id do provedor que atendeu vai junto na medição e no registro; sem envio, o provedor é nulo', async () => {
    const externo = montar({ adaptador: new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())], true) })
    const { medicao } = await externo.ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao).toMatchObject({ envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO })
    expect(externo.consumo.registros).toMatchObject([{ envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO }])
    // Modelo local: a chamada aconteceu, e nada saiu daqui.
    const local = montar({ adaptador: new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())], false) })
    const { medicao: daLocal } = await local.ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(daLocal).toMatchObject({ envioExterno: false, provedorId: null })
    expect(local.consumo.registros).toMatchObject([{ envioExterno: false, provedorId: null }])
  })

  it('a chamada que falhou depois de sair para o provedor também registra qual foi', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([new Error('provedor fora')]) })
    await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', tentativas: 1, envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO }])
  })

  it('a falha antes de qualquer chamada não conta como envio, mesmo com adaptador externo: a regra fixa defeituosa não leva provedor', async () => {
    const adaptador = new ScriptedAdapter([])
    const regraFixaDefeituosa = { ...turnoDoTutor, semModelo: () => ({ classificacao: 'normal' as const, resposta: '', citacoes: [] }) }
    const { ia, consumo } = montar({ adaptador })
    await erroDe(ia.generate({ tarefa: regraFixaDefeituosa, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    expect(adaptador.chamadas).toBe(0)
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 0, envioExterno: false, provedorId: null }])
  })

  it('o tipo da porta só aceita os dois pares possíveis: com envio externo, o provedor; sem envio, nulo', () => {
    const medida = { origem: 'openai_compat', perfil: 'padrao', modelo: 'm', promptVersao: 'v', tokensDeEntrada: 1, tokensDeSaida: 1, duracaoMs: 1, tentativas: 1 } as const
    const consumida = { ...medida, custoMicros: 0, tarefa: 'gerar_atividade_objetiva', funcao: 'conversa_e_ferramentas', estado: 'concluida', em: new Date() } as const
    const externo: EnvioDaChamada = { envioExterno: true, provedorId: 'maritaca' }
    const local: EnvioDaChamada = { envioExterno: false, provedorId: null }
    const medicoes: GenerationMeasurement[] = [
      { ...medida, ...externo },
      { ...medida, ...local },
    ]
    const consumos: ConsumoDeIa[] = [
      { ...consumida, ...externo },
      { ...consumida, ...local },
    ]
    expect([...medicoes, ...consumos].map((item) => item.provedorId)).toEqual(['maritaca', null, 'maritaca', null])

    // @ts-expect-error envio externo sem provedor: a escola não saberia para onde o dado foi
    const semProvedor: EnvioDaChamada = { envioExterno: true, provedorId: null }
    // @ts-expect-error provedor sem envio externo: o banco recusa (consumo_ia_provedor_so_no_envio_externo)
    const provedorSemEnvio: EnvioDaChamada = { envioExterno: false, provedorId: 'maritaca' }
    // @ts-expect-error a medição leva o mesmo par
    const medicaoSemProvedor: GenerationMeasurement = { ...medida, envioExterno: true, provedorId: null }
    // @ts-expect-error o registro de consumo leva o mesmo par
    const consumoSemEnvio: ConsumoDeIa = { ...consumida, envioExterno: false, provedorId: 'maritaca' }
    expect([semProvedor, provedorSemEnvio, medicaoSemProvedor, consumoSemEnvio]).toHaveLength(4)
  })

  it('o tipo das três portas não leva a escola: ela é a do contexto (regra 10, item 3)', async () => {
    // @ts-expect-error o registro de consumo não traz escola: a porta grava na do contexto
    const consumoComEscola: ConsumoDeIa = { ...consumidaDeMedida(), escolaId: ESCOLA_A }
    // @ts-expect-error a consulta de orçamento não traz escola
    const consultaComEscola: OrcamentoQuery = { escolaId: ESCOLA_A, funcao: 'tutor_com_o_aluno' }
    const suspensao: SuspensaoDeFuncao = new InMemorySuspensoes()
    // @ts-expect-error a interface da suspensão é perguntada só pela função, com a escola do contexto
    const perguntaComEscola = suspensao.estaSuspensa(ESCOLA_A, 'adaptacao')
    expect(consumoComEscola).toBeDefined()
    expect(consultaComEscola).toBeDefined()
    await expect(perguntaComEscola).rejects.toThrow('sem escola no contexto')
  })

  it('criarProvedorDeIa: sem nada configurado, a porta é a do adaptador falso', async () => {
    const consumo = new InMemoryConsumo()
    const ia = withEscolaContextOfRequest(createLLMGateway({ adaptador: 'falso', prazosMs: PRAZOS, recuoMs: 500, replicas: 1 }, { registro: consumo, orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }))
    const { medicao } = await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao.origem).toBe('falso')
  })

  it('criarProvedorDeIa: com latenciaFalsaMs a chamada do adaptador falso espera pelo menos isso, e sem ela não espera', async () => {
    const config = { adaptador: 'falso' as const, prazosMs: PRAZOS, recuoMs: 500, replicas: 1 }
    const portas = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
    const chamar = async (latenciaFalsaMs?: number): Promise<number> => {
      const ia = withEscolaContextOfRequest(createLLMGateway(latenciaFalsaMs === undefined ? config : { ...config, latenciaFalsaMs }, portas))
      const inicio = performance.now()
      await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
      return performance.now() - inicio
    }
    // A chamada com latência primeiro: o custo da primeira chamada do arquivo só soma a ela.
    const com = await chamar(200)
    const sem = await chamar()
    expect(com).toBeGreaterThanOrEqual(190)
    // Sem a opção não há espera: a chamada termina antes da que espera 200 ms, qualquer que seja a velocidade da máquina.
    expect(sem).toBeLessThan(com)
  })

  it('criarProvedorDeIa: os tokens falsos e a latência do `padrao` da configuração chegam ao adaptador falso, e a medição leva os 3.000 + 250 (a carga da manhã, X6, 11.0)', async () => {
    const config = { adaptador: 'falso' as const, prazosMs: PRAZOS, recuoMs: 500, replicas: 1 }
    const portas = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
    const ia = withEscolaContextOfRequest(createLLMGateway({ ...config, tokensFalsos: { entrada: 3_000, saida: 250 } }, portas))
    const { medicao } = await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao).toMatchObject({ tokensDeEntrada: 3_000, tokensDeSaida: 250 })
    // O `padrao` espera a latência dele: 60 s estouram o prazo de 300 ms do perfil, e o gateway devolve o erro de tempo; o `rapido` não a espera.
    const lento = withEscolaContextOfRequest(createLLMGateway({ ...config, prazosMs: { ...PRAZOS, padrao: 300 }, latenciaFalsaMsPadrao: 60_000 }, portas))
    await expect(lento.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })).rejects.toMatchObject({ codigoDeIa: 'IA_TEMPO_ESGOTADO' })
    // O sinal curto faz o erro aparecer na hora, em vez de o caso ficar pendurado até o prazo do Vitest, se o `rapido` esperasse os 60 s do `padrao`.
    const rapidoNaoEspera = withEscolaContextOfRequest(createLLMGateway({ ...config, latenciaFalsaMsPadrao: 60_000 }, portas))
    await expect(
      rapidoNaoEspera.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('Como acho o reagente limitante?'), escolaId: ESCOLA_A, alunoId: ALUNO_1, sinal: AbortSignal.timeout(1_000) }),
    ).resolves.toBeDefined()
  })
})

describe('criarProvedorDeIa: o adaptador do provedor sai decorado com o prazo do perfil e o recuo da configuração', () => {
  let servidor: FakeLlamaServer | undefined
  afterEach(async () => {
    await servidor?.fechar()
    servidor = undefined
  })

  async function provedorComModelo(roteiro: Parameters<typeof startFakeLlamaServer>[0], config: { prazosMs: LLMConfig['prazosMs']; recuoMs: number }) {
    servidor = await startFakeLlamaServer(roteiro)
    const configuracao: LLMConfig = {
      adaptador: 'openai_compat',
      ...config,
      replicas: 1,
      modelo: { baseUrl: servidor.url, modelos: { rapido: 'm', padrao: 'm', complexo: 'm', visao: 'm' }, processamentoLocal: true },
    }
    const consumo = new InMemoryConsumo()
    return withEscolaContextOfRequest(createLLMGateway(configuracao, { registro: consumo, orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }))
  }

  it('as opções do adaptador falso (latência, latência do `padrao` e tokens), preenchidas junto do provedor, não chegam a ele: o provedor mede os próprios tokens e não espera nada', async () => {
    const texto = JSON.stringify(atividadeDeEstequiometria())
    servidor = await startFakeLlamaServer(() => ({ corpo: chatResponse(texto, { uso: { prompt_tokens: 1_234, completion_tokens: 56 } }) }))
    const configuracao: LLMConfig = {
      adaptador: 'openai_compat',
      prazosMs: { rapido: 2_000, padrao: 2_000, complexo: 2_000, visao: 2_000 },
      recuoMs: 20,
      replicas: 1,
      modelo: { baseUrl: servidor.url, modelos: { rapido: 'm', padrao: 'm', complexo: 'm', visao: 'm' }, processamentoLocal: true },
      latenciaFalsaMs: 60_000,
      latenciaFalsaMsPadrao: 60_000,
      tokensFalsos: { entrada: 3_000, saida: 250 },
    }
    const ia = withEscolaContextOfRequest(createLLMGateway(configuracao, { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }))
    const inicio = performance.now()
    const { medicao } = await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao).toMatchObject({ origem: 'openai_compat', tokensDeEntrada: 1_234, tokensDeSaida: 56 })
    expect(performance.now() - inicio).toBeLessThan(1_500)
  })

  it('o prazo é o do perfil da tarefa: o turno do Tutor (`rapido`) estoura aos 150 ms, e a atividade (`padrao`) espera a mesma demora', async () => {
    const texto = JSON.stringify(atividadeDeEstequiometria())
    const ia = await provedorComModelo(() => ({ corpo: chatResponse(texto), atrasoMs: 600 }), { prazosMs: { rapido: 150, padrao: 3_000, complexo: 3_000, visao: 3_000 }, recuoMs: 20 })
    const inicio = performance.now()
    const tutor = await erroDe(ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    expect(tutor.codigoDeIa).toBe('IA_TEMPO_ESGOTADO')
    expect(performance.now() - inicio).toBeLessThan(1_100)
    await expect(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })).resolves.toBeDefined()
  })

  it('a repetição do 429 espera o recuo da configuração, com jitter entre metade dele e ele inteiro', async () => {
    const texto = JSON.stringify(atividadeDeEstequiometria())
    const chegadas: number[] = []
    const ia = await provedorComModelo(
      (_pedido, numero) => {
        chegadas.push(performance.now())
        return numero === 1 ? { status: 429, corpo: {} } : { corpo: chatResponse(texto) }
      },
      { prazosMs: { rapido: 5_000, padrao: 5_000, complexo: 5_000, visao: 5_000 }, recuoMs: 400 },
    )
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    const espera = (chegadas[1] ?? 0) - (chegadas[0] ?? 0)
    expect(espera).toBeGreaterThanOrEqual(190)
    expect(espera).toBeLessThan(1_100)
  })
})

describe('ProvedorDeIa: toda execução registra (regra 30, item 4)', () => {
  it('grava entrada, saída, tarefa, função, perfil, modelo, versão do prompt, tokens, duração, envio externo e a execução', async () => {
    const { ia, consumo } = montar()
    const entrada = entradaDeAtividade()
    const { saida, medicao } = await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    expect(consumo.registros).toEqual([
      {
        escolaId: ESCOLA_A,
        execucaoId: EXECUCAO,
        tarefa: 'gerar_atividade_objetiva',
        funcao: 'conversa_e_ferramentas',
        ...medicao,
        // A linha é a da chamada: a duração dela, e não a da execução inteira; o adaptador falso não tem preço.
        duracaoMs: expect.any(Number) as number,
        custoMicros: 0,
        entrada,
        saida,
        estado: 'concluida',
        // A chamada foi ao principal: a coluna da reserva é explícita, e falsa.
        peloProvedorDeReserva: false,
        em: new Date('2026-10-05T13:00:00Z'),
      },
    ])
  })

  it('a falha também fica registrada, com o código, sem saída', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', '{"tipo":"outra coisa"}']) })
    await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    // Uma linha por chamada que saiu (D14): as duas inválidas, cada uma com os seus tokens; a saída nunca fica.
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 1, tokensDeEntrada: 100, tokensDeSaida: 20 },
      { estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 1, tokensDeEntrada: 100, tokensDeSaida: 20 },
    ])
    for (const registro of consumo.registros) expect(registro).not.toHaveProperty('saida')
  })

  it('tarefa que leva texto de aluno não deixa entrada nem saída no consumo: o registro da conversa é do Tutor, não daqui', async () => {
    const { ia, consumo } = montar()
    const duvida = 'como eu acho o reagente limitante? palavra-marcada-do-aluno'
    const { saida } = await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(turnoDoTutor).toMatchObject({ levaTextoLivreDePessoa: true, levaTextoDeAluno: true })
    expect(consumo.registros).toMatchObject([{ tarefa: 'turno_do_tutor', alunoId: ALUNO_1, estado: 'concluida' }])
    expect(consumo.registros[0]).not.toHaveProperty('entrada')
    expect(consumo.registros[0]).not.toHaveProperty('saida')
    expect(consumo.registros[0]?.tokensDeEntrada).toBeGreaterThan(0)
    const gravado = JSON.stringify(consumo.registros)
    expect(gravado).not.toContain('palavra-marcada-do-aluno')
    expect(gravado).not.toContain(saida.resposta.slice(0, 20))
  })

  it('na falha de tarefa que leva texto de aluno, o consumo também fica sem a entrada', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', 'não é json']), soberania: CONFERIDA })
    await erroDe(ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi palavra-marcada-do-aluno'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' },
      { estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' },
    ])
    expect(JSON.stringify(consumo.registros)).not.toContain('palavra-marcada')
  })

  it('a conversa do professor com o Assistente não é copiada para o consumo, no sucesso e na falha: só ele a lê, e ela mora em mensagem_agente', async () => {
    const mensagem = 'monta uma atividade para o Enzo, que tem dislexia: palavra-marcada-do-professor'
    const entrada = { ...entradaDoAssistente(mensagem), turnosAnteriores: [{ autor: 'professor' as const, texto: 'turno-anterior-marcado' }] }
    expect(proporFerramenta).toMatchObject({ levaTextoLivreDePessoa: true, levaTextoDeAluno: true })
    const { ia, consumo } = montar()
    await ia.generate({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    const falhando = montar({ registro: consumo, adaptador: new ScriptedAdapter(['não é json', 'não é json']), soberania: CONFERIDA })
    await erroDe(falhando.ia.generate({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO }))
    expect(consumo.registros).toMatchObject([
      { tarefa: 'propor_ferramenta', funcao: 'conversa_e_ferramentas', estado: 'concluida', execucaoId: EXECUCAO },
      { tarefa: 'propor_ferramenta', estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' },
      { tarefa: 'propor_ferramenta', estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' },
    ])
    for (const registro of consumo.registros) {
      expect(registro).not.toHaveProperty('entrada')
      expect(registro).not.toHaveProperty('saida')
    }
    expect(JSON.stringify(consumo.registros)).not.toMatch(/marcad|Enzo|dislexia/)
  })

  it('as tarefas de geração continuam gravando entrada e saída: é o que responde por que a IA gerou aquilo', async () => {
    const { ia, consumo } = montar()
    for (const [tarefa, entrada] of [
      [gerarAtividadeObjetiva, entradaDeAtividade()],
      [relatorioDaCorrecao, entradaDoRelatorio()],
    ] as const) {
      const { saida } = await ia.generate({ tarefa: tarefa as TaskDefinition<unknown, unknown>, entrada, escolaId: ESCOLA_A })
      expect(consumo.registros.at(-1)).toMatchObject({ tarefa: tarefa.nome, entrada, saida })
    }
  })

  it('o aluno só entra no consumo da função que é dele: em outra tarefa, o id passado por engano não é gravado (D64)', async () => {
    const { ia, consumo } = montar()
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(consumo.registros[0]).not.toHaveProperty('alunoId')
  })

  it('tarefa sem texto de aluno guarda a entrada na falha: é o que explica depois por que a IA não entregou', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', 'não é json']) })
    const entrada = entradaDeAtividade()
    await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada, escolaId: ESCOLA_A }))
    // Uma linha por chamada: a entrada fica só na última (a inválida que ainda teve repetição não guarda nada, regra 20).
    expect(consumo.registros).toHaveLength(2)
    expect(consumo.registros[0]).not.toHaveProperty('entrada')
    expect(consumo.registros[1]?.entrada).toEqual(entrada)
  })

  it('se o registro falhar, a saída não é devolvida: nada que não foi registrado chega ao domínio', async () => {
    const registro = { registrar: async () => Promise.reject(new Error('banco fora')) }
    const { ia } = montar({ registro })
    expect((await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_INDISPONIVEL')
  })
})

describe('ProvedorDeIa: o log leva id, nunca conteúdo (regra 20, item 9)', () => {
  it('a linha de sucesso tem evento, tarefa, ids, duração e tentativas, e mais nada', async () => {
    const logger = registrador()
    const { ia } = montar({ logger })
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    expect(logger.linhas()).toEqual([{ evento: 'ia.geracao.concluida', tipo: 'gerar_atividade_objetiva', escolaId: ESCOLA_A, execucaoId: EXECUCAO, duracaoMs: expect.any(Number) as number, tentativas: 1 }])
  })

  it('o que o aluno escreveu e o que o Tutor respondeu não aparecem em nenhuma linha, nem no sucesso nem na falha', async () => {
    const logger = registrador()
    const duvida = 'como eu acho o reagente limitante? palavra-marcada-do-aluno'
    const { ia } = montar({ logger })
    const { saida } = await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    const falhando = montar({ logger, adaptador: new ScriptedAdapter(['palavra-marcada-do-modelo', 'palavra-marcada-do-modelo']), soberania: CONFERIDA })
    await erroDe(falhando.ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    const linhas = JSON.stringify(logger.linhas())
    expect(logger.linhas()).toHaveLength(2)
    expect(linhas).not.toContain('palavra-marcada')
    expect(linhas).not.toContain(saida.resposta.slice(0, 20))
    expect(linhas).toContain('"codigo":"IA_SAIDA_INVALIDA"')
  })
})

describe('ProvedorDeIa: o domínio nunca vê erro cru', () => {
  it('erro qualquer do adaptador vira ErroDeIa indisponível, sem a mensagem original', async () => {
    const logger = registrador()
    const { ia, consumo } = montar({ logger, adaptador: new ScriptedAdapter([new Error('HTTP 400: prompt era "texto do aluno Enzo"')]) })
    const erro = await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(erro.codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(erro.codigo).toBe('IA_INDISPONIVEL')
    expect(`${erro.message} ${JSON.stringify(erro)} ${JSON.stringify(logger.linhas())}`).not.toContain('Enzo')
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL' }])
  })

  it('cada código de IA é um código do contrato da API, com o status dele', () => {
    expect(new LLMError('IA_INDISPONIVEL')).toMatchObject({ codigo: 'IA_INDISPONIVEL', status: 503 })
    expect(new LLMError('IA_TEMPO_ESGOTADO')).toMatchObject({ codigo: 'IA_TEMPO_ESGOTADO', status: 503 })
    expect(new LLMError('IA_SAIDA_INVALIDA')).toMatchObject({ codigo: 'IA_SAIDA_INVALIDA', status: 502 })
    expect(new LLMError('IA_ORCAMENTO_ESGOTADO', 30)).toMatchObject({ codigo: 'IA_ORCAMENTO_ESGOTADO', status: 429, tenteDeNovoEmSegundos: 30 })
    expect(new LLMError('LIMITE_DIARIO_DO_TUTOR')).toMatchObject({ codigo: 'LIMITE_DIARIO_DO_TUTOR', status: 429 })
    expect(new LLMError('IA_ENTRADA_INVALIDA')).toMatchObject({ codigo: 'IA_ENTRADA_INVALIDA', status: 500 })
    expect(new LLMError('FUNCAO_SUSPENSA')).toMatchObject({ codigo: 'FUNCAO_SUSPENSA', status: 409 })
    expect(new LLMError('MATERIAL_INSUFICIENTE')).toMatchObject({ codigo: 'MATERIAL_INSUFICIENTE', status: 422 })
    // Só guarda de defeito: nenhuma rota o devolve como status (a execução o grava em `execucao_agente.erro`), mas o contrato tem o dele.
    expect(new LLMError('PEDIDO_ACIMA_DO_TETO')).toMatchObject({ codigo: 'PEDIDO_ACIMA_DO_TETO', status: 503 })
    expect(LLM_ERROR_CODES).toContain('PEDIDO_ACIMA_DO_TETO')
    expect(HTTP_STATUS_BY_CODE.PEDIDO_ACIMA_DO_TETO).toBe(503)
    // Todo código da camada é um código do contrato da API: o que a execução grava é o que a tela sabe mostrar.
    for (const codigo of LLM_ERROR_CODES) expect(Object.values(ErrorCode)).toContain(codigo)
  })
})

describe('ProvedorDeIa: a escola do pedido é a de quem pede (regra 10, item 3)', () => {
  const pedir = (ia: LLMGateway, escolaId: string) => ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId })

  it('com contexto da escola A, o pedido em nome da escola B é recusado antes de consultar, gastar ou registrar', async () => {
    const adaptador = new ScriptedAdapter([])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const estaSuspensa = vi.fn(async () => false)
    const logger = registrador()
    const { ia, consumo } = montar({ adaptador, orcamento: { check: consultar }, suspensao: { estaSuspensa }, logger })
    const erro = await runInContext({ requisicaoId: 'r', escolaId: ESCOLA_A, usuarioId: 'u' }, () => erroDe(pedir(ia, ESCOLA_B)))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_ENTRADA_INVALIDA', status: 500 })
    expect(adaptador.chamadas).toBe(0)
    expect(consultar).not.toHaveBeenCalled()
    expect(estaSuspensa).not.toHaveBeenCalled()
    expect(consumo.registros).toEqual([])
    expect(logger.linhas()).toEqual([{ evento: 'ia.geracao.escola_fora_do_contexto', tipo: 'gerar_atividade_objetiva' }])
  })

  it('com a escola do contexto, o pedido passa', async () => {
    const { ia } = montar()
    await expect(runInContext({ requisicaoId: 'r', escolaId: ESCOLA_A }, () => pedir(ia, ESCOLA_A))).resolves.toBeDefined()
  })

  it('sem escola no contexto, a chamada não executa: IA_INDISPONIVEL, sem chamar o adaptador e sem registrar consumo', async () => {
    const adaptador = new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())])
    const { ia, consumo } = montar({ adaptador, semContexto: true })
    expect(await erroDe(pedir(ia, ESCOLA_A))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', status: 503 })
    // O contexto da rotina nossa, e o da requisição sem escola, também não valem: a porta não os trata como uma escola.
    expect(await erroDe(runInContext({ requisicaoId: 'r' }, () => pedir(ia, ESCOLA_B)))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL' })
    expect(await erroDe(runInContext({ requisicaoId: 'r', rotinaDoSistema: true }, () => pedir(ia, ESCOLA_B)))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL' })
    expect(adaptador.chamadas).toBe(0)
    expect(consumo.registros).toEqual([])
  })
})

describe('ProvedorDeIa: entrada inválida para antes de qualquer gasto', () => {
  it('entrada com nome de aluno é recusada, o modelo não é chamado e o orçamento não é consultado', async () => {
    const adaptador = new ScriptedAdapter([])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const { ia, consumo } = montar({ adaptador, orcamento: { check: consultar } })
    const comNome = { ...entradaDeAtividade(), nomeDoAluno: 'Enzo Martins' }
    expect((await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: comNome, escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_ENTRADA_INVALIDA')
    expect(adaptador.chamadas).toBe(0)
    expect(consultar).not.toHaveBeenCalled()
    expect(consumo.registros).toEqual([])
  })
})

describe('ProvedorDeIa: o pedido acima do teto de entrada para antes de qualquer gasto (reengenharia-continuacao, 4.0)', () => {
  /** A entrada passa pelo esquema; quem estoura é o teto, rebaixado na definição injetada (o esquema nem é tocado). */
  const comTeto = (teto: number) => ({ ...gerarAtividadeObjetiva, maximoDeTokensDeEntrada: teto })

  it('acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica +1 na tarefa', async () => {
    const adaptador = new ScriptedAdapter([])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const leitor = new MedidorDeTeste()
    const { ia, consumo } = montar({ adaptador, orcamento: { check: consultar }, medidor: leitor.medidor })
    const erro = await erroDe(ia.generate({ tarefa: comTeto(1), entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(erro).toMatchObject({ codigoDeIa: 'PEDIDO_ACIMA_DO_TETO', status: 503 })
    expect(adaptador.chamadas).toBe(0)
    expect(consultar).not.toHaveBeenCalled()
    expect(consumo.registros).toEqual([])
    const valores = Object.fromEntries((await leitor.pontos('ia.pedido_acima_do_teto')).map((ponto) => [String(ponto.atributos['tarefa']), ponto.valor]))
    expect(valores['gerar_atividade_objetiva']).toBe(1)
    // Cada tarefa já nasce em zero, e só a que recusou saiu dele.
    expect(Object.keys(valores).sort()).toEqual([...TAREFAS_DE_IA].sort())
    expect(Object.entries(valores).filter(([, valor]) => valor !== 0)).toEqual([['gerar_atividade_objetiva', 1]])
    await leitor.encerrar()
  })

  it('o teto é inclusivo: o pedido do tamanho exato do teto passa, e um token a menos o recusa', async () => {
    const entrada = entradaDeAtividade()
    const tamanho = tokensDoPedido(gerarAtividadeObjetiva, entrada)
    const adaptador = new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())])
    const { ia } = montar({ adaptador })
    // Controle: com o teto no tamanho do pedido, a mesma chamada vai ao modelo, e então a recusa abaixo não veio de outra checagem.
    await ia.generate({ tarefa: comTeto(tamanho), entrada, escolaId: ESCOLA_A })
    expect(adaptador.chamadas).toBe(1)
    expect((await erroDe(ia.generate({ tarefa: comTeto(tamanho - 1), entrada, escolaId: ESCOLA_A }))).codigoDeIa).toBe('PEDIDO_ACIMA_DO_TETO')
    expect(adaptador.chamadas).toBe(1)
  })

  it('a regra fixa não manda nada ao modelo e não passa pelo teto: o aluno no assunto delicado recebe a mensagem mesmo com o teto estourado', async () => {
    const adaptador = new ScriptedAdapter([])
    const fixa = { ...turnoDoTutor, maximoDeTokensDeEntrada: 1, semModelo: () => turnoDoTutor.falso(entradaDoTutor('não entendi')) }
    const { ia } = montar({ adaptador })
    const { saida } = await ia.generate({ tarefa: fixa, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    // O aluno recebe a mensagem da regra fixa, e não só "nada falhou": o D36 vale com o teto estourado.
    expect(saida).toEqual(turnoDoTutor.falso(entradaDoTutor('não entendi')))
    expect(adaptador.chamadas).toBe(0)
  })

  it('a métrica leva só o rótulo `tarefa`: nenhuma escola, execução nem usuário', async () => {
    const leitor = new MedidorDeTeste()
    const { ia } = montar({ medidor: leitor.medidor })
    await erroDe(ia.generate({ tarefa: comTeto(1), entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO }))
    await erroDe(ia.generate({ tarefa: comTeto(1), entrada: entradaDeAtividade(), escolaId: ESCOLA_B }))
    const pontos = await leitor.pontos('ia.pedido_acima_do_teto')
    expect(pontos.map((ponto) => Object.keys(ponto.atributos))).toEqual(pontos.map(() => ['tarefa']))
    expect(pontos.find((ponto) => ponto.atributos['tarefa'] === 'gerar_atividade_objetiva')?.valor).toBe(2)
    await leitor.encerrar()
  })

  it('o log da recusa leva a tarefa, os ids e o código; nunca a entrada nem o prompt (regra 20, item 9)', async () => {
    const logger = registrador()
    const { ia } = montar({ logger })
    await erroDe(ia.generate({ tarefa: comTeto(1), entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO }))
    const linha = logger.linhas().find((item) => (item as { evento?: string }).evento === 'ia.geracao.pedido_acima_do_teto')
    expect(linha).toMatchObject({ evento: 'ia.geracao.pedido_acima_do_teto', tipo: 'gerar_atividade_objetiva', codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    const texto = JSON.stringify(logger.linhas())
    expect(texto).not.toContain(gerarAtividadeObjetiva.prompt.sistema.slice(0, 40))
    // O texto dos trechos do material é entrada: não vai ao log.
    expect(texto).not.toContain(entradaDeAtividade().trechos[0]?.texto.slice(0, 40) ?? 'trecho-ausente')
  })
})

describe('ProvedorDeIa: a D62 na chamada, antes do orçamento e do envio (reengenharia-continuacao, 8.0)', () => {
  const duvida = 'como eu acho o reagente limitante? palavra-marcada-do-aluno'
  const pedidoDoTutor = { tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1, execucaoId: EXECUCAO }
  const respostaDoTutor = () => JSON.stringify(turnoDoTutor.falso(entradaDoTutor(duvida)))

  it.each([
    ['o Tutor', pedidoDoTutor],
    ['o Assistente', { tarefa: proporFerramenta, entrada: entradaDoAssistente('monte uma atividade de estequiometria'), escolaId: ESCOLA_A, execucaoId: EXECUCAO }],
  ] as const)('%s com provedor externo e a D62 não conferida: IA_INDISPONIVEL, nenhuma chamada ao provedor, orçamento não consultado, sem consumo', async (_nome, pedido) => {
    const adaptador = new ScriptedAdapter([])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const { ia, consumo } = montar({ adaptador, orcamento: { check: consultar } })
    const erro = await erroDe(ia.generate(pedido as typeof pedidoDoTutor))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', status: 503 })
    expect(adaptador.chamadas).toBe(0)
    expect(consultar).not.toHaveBeenCalled()
    expect(consumo.registros).toEqual([])
  })

  it('a declaração dita `conferida: false` recusa do mesmo jeito que a ausência dela', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, soberania: { conferida: false } })
    expect((await erroDe(ia.generate(pedidoDoTutor))).codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(adaptador.chamadas).toBe(0)
  })

  it('com a D62 conferida a chamada sai, e a declaração é lida a cada chamada: a que fica conferida depois deixa passar', async () => {
    const adaptador = new ScriptedAdapter([respostaDoTutor()])
    const soberania = { conferida: false }
    const { ia } = montar({ adaptador, soberania })
    expect((await erroDe(ia.generate(pedidoDoTutor))).codigoDeIa).toBe('IA_INDISPONIVEL')
    soberania.conferida = true
    const { medicao } = await ia.generate(pedidoDoTutor)
    expect(adaptador.chamadas).toBe(1)
    expect(medicao).toMatchObject({ envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO })
  })

  it('o adaptador falso e o modelo local não precisam da declaração: a chamada sai sem ela', async () => {
    const falso = montar()
    expect((await falso.ia.generate(pedidoDoTutor)).medicao).toMatchObject({ envioExterno: false, provedorId: null })
    const adaptadorLocal = new ScriptedAdapter([respostaDoTutor()], false)
    const local = montar({ adaptador: adaptadorLocal })
    await local.ia.generate(pedidoDoTutor)
    expect(adaptadorLocal.chamadas).toBe(1)
  })

  it('a tarefa sem texto de aluno sai para o provedor externo sem a declaração: a marca é que liga a recusa', async () => {
    const adaptador = new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())])
    const { ia } = montar({ adaptador })
    expect(gerarAtividadeObjetiva.levaTextoDeAluno).toBe(false)
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(adaptador.chamadas).toBe(1)
  })

  it('a regra fixa não envia nada: o aluno no assunto delicado recebe a mensagem com o 188 mesmo com a D62 não conferida (D36)', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador })
    const { saida } = await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('eu quero morrer'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(saida.resposta).toContain('188')
    expect(adaptador.chamadas).toBe(0)
  })

  it('createLLMGateway entrega a declaração das portas ao gateway: com provedor externo, nenhum pedido sai sem ela, e com ela sai um', async () => {
    const servidor = await startFakeLlamaServer(() => ({ corpo: chatResponse(respostaDoTutor()) }))
    try {
      // O endereço é desta máquina, mas o processamento não é declarado local: para o gateway é um provedor de fora.
      const configuracao: LLMConfig = {
        adaptador: 'openai_compat',
        prazosMs: PRAZOS,
        recuoMs: 20,
        replicas: 1,
        modelo: { baseUrl: servidor.url, modelos: { rapido: 'm', padrao: 'm', complexo: 'm', visao: 'm' }, processamentoLocal: false, provedorId: PROVEDOR_ROTEIRIZADO },
      }
      const portas = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
      const semDeclaracao = withEscolaContextOfRequest(createLLMGateway(configuracao, portas))
      expect((await erroDe(semDeclaracao.generate(pedidoDoTutor))).codigoDeIa).toBe('IA_INDISPONIVEL')
      expect(servidor.pedidos).toHaveLength(0)
      const comDeclaracao = withEscolaContextOfRequest(createLLMGateway(configuracao, { ...portas, soberania: CONFERIDA }))
      await comDeclaracao.generate(pedidoDoTutor)
      expect(servidor.pedidos).toHaveLength(1)
    } finally {
      await servidor.fechar()
    }
  })

  it('o log da recusa leva o evento, a tarefa, os ids e o provedor; nunca a entrada, o nome nem o prompt (regra 20, item 9)', async () => {
    const logger = registrador()
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), logger })
    await erroDe(ia.generate(pedidoDoTutor))
    const linha = logger.linhas().find((item) => (item as { evento?: string }).evento === 'ia.geracao.soberania_recusada')
    expect(linha).toMatchObject({ evento: 'ia.geracao.soberania_recusada', tipo: 'turno_do_tutor', codigo: 'IA_INDISPONIVEL', escolaId: ESCOLA_A, execucaoId: EXECUCAO, provedorId: PROVEDOR_ROTEIRIZADO })
    expect(logger.linhas()).toHaveLength(1)
    const texto = JSON.stringify(logger.linhas())
    expect(texto).not.toContain('palavra-marcada')
    expect(texto).not.toContain(turnoDoTutor.prompt.sistema.slice(0, 40))
    expect(texto).not.toContain(ALUNO_1)
  })
})

describe('ProvedorDeIa: orçamento consultado antes de gastar (D14, D38)', () => {
  it('toda chamada consulta o orçamento com a função, sem a escola (a porta a lê do contexto); no Tutor, também com o aluno', async () => {
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const { ia } = montar({ orcamento: { check: consultar } })
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(consultar.mock.calls).toEqual([[{ funcao: 'conversa_e_ferramentas' }], [{ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 }]])
  })

  it('orçamento esgotado: erro tipado com a espera sugerida, e o modelo não é chamado', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, orcamento: { check: async () => ({ permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: 3600 }) } })
    const erro = await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_ORCAMENTO_ESGOTADO', status: 429, tenteDeNovoEmSegundos: 3600 })
    expect(adaptador.chamadas).toBe(0)
  })

  it('sem conseguir consultar o orçamento, não gasta', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, orcamento: { check: async () => Promise.reject(new Error('banco fora')) } })
    expect((await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(adaptador.chamadas).toBe(0)
  })

  it('a consulta leva a turma e a execução, quando vêm no pedido: o pacote do mês é da turma, e a pergunta da própria execução não conta contra ela', async () => {
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const { ia } = montar({ orcamento: { check: consultar } })
    await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1, turmaId: ESCOLA_B, execucaoId: EXECUCAO })
    expect(consultar.mock.calls).toEqual([[{ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1, turmaId: ESCOLA_B, execucaoId: EXECUCAO }]])
  })

  it('o código da recusa é o que o orçamento deu: freio do dia e pacote do mês chegam com o código próprio', async () => {
    for (const codigo of ['LIMITE_DIARIO_DO_TUTOR', 'PACOTE_DO_TUTOR_ESGOTADO'] as const) {
      const { ia } = montar({ adaptador: new ScriptedAdapter([]), soberania: CONFERIDA, orcamento: { check: async () => ({ permitido: false, codigo }) } })
      const erro = await erroDe(ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
      expect(erro).toMatchObject({ codigoDeIa: codigo, codigo, status: 429 })
    }
  })

  it('assunto delicado não passa pelo orçamento: no fim do freio do dia, o aluno ainda recebe a mensagem fixa com o 188', async () => {
    const consultar = vi.fn(async () => ({ permitido: false as const, codigo: 'LIMITE_DIARIO_DO_TUTOR' as const }))
    const { ia, consumo } = montar({ orcamento: { check: consultar }, adaptador: new ScriptedAdapter([]), soberania: CONFERIDA })
    const { saida } = await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('eu quero morrer'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(saida.resposta).toContain('188')
    expect(consultar).not.toHaveBeenCalled()
    // O adaptador deste teste é externo: a regra fixa não chama ninguém, e por isso não leva provedor.
    expect(consumo.registros).toMatchObject([{ origem: 'regra_fixa', modelo: MODELO_DA_REGRA_FIXA, tentativas: 0, estado: 'concluida', envioExterno: false, provedorId: null }])
    // A dúvida comum, com o mesmo orçamento esgotado, é recusada.
    expect((await erroDe(ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))).codigoDeIa).toBe('LIMITE_DIARIO_DO_TUTOR')
  })
})

describe('ProvedorDeIa: função suspensa pela escola não executa (D60)', () => {
  function comSuspensao() {
    const suspensao = new InMemorySuspensoes()
    const adaptador = new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria()), JSON.stringify(atividadeDeEstequiometria())])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const logger = registrador()
    return { suspensao, adaptador, consultar, logger, ...montar({ suspensao, adaptador, orcamento: { check: consultar }, logger }) }
  }
  const gerar = (ia: LLMGateway, escolaId: string) => ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId })

  it('função suspensa na escola A recusa com erro próprio, sem chamar o adaptador, sem consultar orçamento e sem registrar consumo', async () => {
    const { ia, suspensao, adaptador, consultar, consumo, logger } = comSuspensao()
    suspensao.suspender(ESCOLA_A, 'conversa_e_ferramentas')
    const erro = await erroDe(gerar(ia, ESCOLA_A))
    expect(erro).toMatchObject({ codigoDeIa: 'FUNCAO_SUSPENSA', codigo: 'FUNCAO_SUSPENSA', status: 409 })
    expect(adaptador.chamadas).toBe(0)
    expect(consultar).not.toHaveBeenCalled()
    expect(consumo.registros).toEqual([])
    expect(logger.linhas()).toMatchObject([{ evento: 'ia.geracao.falhou', codigo: 'FUNCAO_SUSPENSA', escolaId: ESCOLA_A }])
  })

  it('a mesma função na escola B executa', async () => {
    const { ia, suspensao, adaptador } = comSuspensao()
    suspensao.suspender(ESCOLA_A, 'conversa_e_ferramentas')
    await expect(gerar(ia, ESCOLA_B)).resolves.toMatchObject({ saida: atividadeDeEstequiometria() })
    expect(adaptador.chamadas).toBe(1)
  })

  it('outra função na escola A executa: suspender a adaptação não desliga a conversa e as ferramentas', async () => {
    const { ia, suspensao, adaptador } = comSuspensao()
    suspensao.suspender(ESCOLA_A, 'adaptacao')
    suspensao.suspender(ESCOLA_A, 'tutor_com_o_aluno')
    await expect(gerar(ia, ESCOLA_A)).resolves.toBeDefined()
    expect(adaptador.chamadas).toBe(1)
  })

  it('retomada a função, ela volta a executar', async () => {
    const { ia, suspensao } = comSuspensao()
    suspensao.suspender(ESCOLA_A, 'conversa_e_ferramentas')
    expect((await erroDe(gerar(ia, ESCOLA_A))).codigoDeIa).toBe('FUNCAO_SUSPENSA')
    suspensao.retomar(ESCOLA_A, 'conversa_e_ferramentas')
    await expect(gerar(ia, ESCOLA_A)).resolves.toBeDefined()
  })

  it('o Tutor suspenso não responde nem com a mensagem fixa: nada da função executa', async () => {
    const suspensao = new InMemorySuspensoes()
    suspensao.suspender(ESCOLA_A, 'tutor_com_o_aluno')
    const { ia, consumo } = montar({ suspensao })
    const erro = await erroDe(ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('eu quero morrer'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    expect(erro.codigoDeIa).toBe('FUNCAO_SUSPENSA')
    expect(consumo.registros).toEqual([])
  })

  it('sem conseguir consultar a suspensão, não executa', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, suspensao: { estaSuspensa: async () => Promise.reject(new Error('banco fora')) } })
    expect((await erroDe(gerar(ia, ESCOLA_A))).codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(adaptador.chamadas).toBe(0)
  })

  it('a função sem modelo usa a mesma conferência: a correção de objetiva suspensa é recusada antes da conta', async () => {
    const suspensao = new InMemorySuspensoes()
    suspensao.suspender(ESCOLA_A, 'correcao_de_objetiva')
    const corrigir = vi.fn(() => 'lote corrigido')
    const encerrar = async (escolaId: string): Promise<string> => {
      await runInContext({ requisicaoId: 'r', escolaId }, () => exigirFuncaoAtiva(suspensao, 'correcao_de_objetiva'))
      return corrigir()
    }
    const erro: unknown = await encerrar(ESCOLA_A).catch((motivo: unknown) => motivo)
    expect(erro).toBeInstanceOf(LLMError)
    expect((erro as LLMError).codigoDeIa).toBe('FUNCAO_SUSPENSA')
    expect(corrigir).not.toHaveBeenCalled()
    await expect(encerrar(ESCOLA_B)).resolves.toBe('lote corrigido')
    // E o relatório da correção, que usa modelo, é recusado pelo provedor com o mesmo código.
    const { ia } = montar({ suspensao })
    expect((await erroDe(ia.generate({ tarefa: relatorioDaCorrecao, entrada: entradaDoRelatorio(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('FUNCAO_SUSPENSA')
  })
})

describe('OrcamentoEmMemoria', () => {
  function comLimites(limites: { tokensPorEscolaNoMes?: number; trocasPorAlunoNoDia?: number }) {
    let agora = new Date('2026-10-05T13:00:00Z')
    const consumo = new InMemoryConsumo()
    const relogio = { agora: () => agora }
    const ia = withEscolaContextOfRequest(new LLMGateway({ adaptador: new FakeAdapter(), registro: consumo, orcamento: new InMemoryOrcamento(consumo, limites, relogio), suspensao: new InMemorySuspensoes(), relogio }))
    const tutor = (escolaId: string, alunoId: string) => ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId, alunoId })
    return { ia, tutor, avancarPara: (iso: string) => void (agora = new Date(iso)) }
  }

  it('freio diário do aluno: a troca além do limite é recusada, outro aluno segue, e no dia seguinte volta', async () => {
    const { tutor, avancarPara } = comLimites({ trocasPorAlunoNoDia: 2 })
    await tutor(ESCOLA_A, ALUNO_1)
    await tutor(ESCOLA_A, ALUNO_1)
    expect((await erroDe(tutor(ESCOLA_A, ALUNO_1))).codigoDeIa).toBe('LIMITE_DIARIO_DO_TUTOR')
    await expect(tutor(ESCOLA_A, ALUNO_2)).resolves.toBeDefined()
    // 23h59 de São Paulo ainda é o mesmo dia; 00h01 já é o seguinte.
    avancarPara('2026-10-06T02:59:00Z')
    expect((await erroDe(tutor(ESCOLA_A, ALUNO_1))).codigoDeIa).toBe('LIMITE_DIARIO_DO_TUTOR')
    avancarPara('2026-10-06T03:01:00Z')
    await expect(tutor(ESCOLA_A, ALUNO_1)).resolves.toBeDefined()
  })

  it('teto da escola: o gasto da escola A não segura a escola B', async () => {
    const { ia } = comLimites({ tokensPorEscolaNoMes: 100 })
    const gerar = (escolaId: string) => ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId })
    await gerar(ESCOLA_A)
    expect((await erroDe(gerar(ESCOLA_A))).codigoDeIa).toBe('IA_ORCAMENTO_ESGOTADO')
    await expect(gerar(ESCOLA_B)).resolves.toBeDefined()
  })

  it('sem limite configurado, não há teto: os valores são de quem configura, não constantes daqui', async () => {
    const { tutor } = comLimites({})
    for (let troca = 0; troca < 5; troca += 1) await expect(tutor(ESCOLA_A, ALUNO_1)).resolves.toBeDefined()
  })
})

describe('as portas em memória leem a escola do contexto (8.0)', () => {
  const noContexto = <T>(escolaId: string, funcao: () => T): T => runInContext({ requisicaoId: 'r', escolaId }, funcao)

  it('sem escola no contexto, cada uma lança antes de ler ou de gravar', async () => {
    const consumo = new InMemoryConsumo()
    await expect(new InMemorySuspensoes().estaSuspensa('adaptacao')).rejects.toThrow('sem escola no contexto')
    await expect(consumo.registrar(consumidaDeMedida())).rejects.toThrow('sem escola no contexto')
    await expect(new InMemoryOrcamento(consumo).check({ funcao: 'conversa_e_ferramentas' })).rejects.toThrow('sem escola no contexto')
    expect(consumo.registros).toEqual([])
  })

  it('o consumo fica na escola do contexto, e o orçamento conta só a escola em que é perguntado', async () => {
    const consumo = new InMemoryConsumo()
    const orcamento = new InMemoryOrcamento(consumo, { trocasPorAlunoNoDia: 1 })
    const troca = { ...consumidaDeMedida(), funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 } as const
    await noContexto(ESCOLA_A, () => consumo.registrar(troca))
    expect(consumo.registros.map((registro) => registro.escolaId)).toEqual([ESCOLA_A])
    expect(await noContexto(ESCOLA_A, () => orcamento.check({ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 }))).toEqual({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
    expect(await noContexto(ESCOLA_B, () => orcamento.check({ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 }))).toEqual({ permitido: true })
  })

  it('a suspensão da escola A não vale no contexto da B', async () => {
    const suspensao = new InMemorySuspensoes()
    suspensao.suspender(ESCOLA_A, 'adaptacao')
    expect(await noContexto(ESCOLA_A, () => suspensao.estaSuspensa('adaptacao'))).toBe(true)
    expect(await noContexto(ESCOLA_B, () => suspensao.estaSuspensa('adaptacao'))).toBe(false)
  })
})

describe('destinoDoAdaptador: para onde a configuração manda o conteúdo (a linha estimada da execução interrompida, X6)', () => {
  const base = { prazosMs: PRAZOS, recuoMs: 500, replicas: 1 } as const

  it('o adaptador falso: origem `falso`, sem envio externo e o modelo falso em todo perfil', () => {
    const destino = destinoDoAdaptador({ adaptador: 'falso', ...base })
    expect(destino.origem).toBe('falso')
    expect(destino.envio).toEqual({ envioExterno: false, provedorId: null })
    expect(destino.modeloDoPerfil('padrao')).toBe(MODELO_FALSO)
  })

  it('o provedor externo: origem `openai_compat`, envio externo com o id do provedor e o modelo de cada perfil', () => {
    const destino = destinoDoAdaptador({
      adaptador: 'openai_compat',
      ...base,
      modelo: { baseUrl: 'http://provedor.invalido', modelos: { rapido: 'pequeno', padrao: 'medio', complexo: 'grande', visao: 'visual' }, processamentoLocal: false, provedorId: 'provedor-de-teste' },
    })
    expect(destino.origem).toBe('openai_compat')
    expect(destino.envio).toEqual({ envioExterno: true, provedorId: 'provedor-de-teste' })
    expect([destino.modeloDoPerfil('rapido'), destino.modeloDoPerfil('padrao'), destino.modeloDoPerfil('complexo'), destino.modeloDoPerfil('visao')]).toEqual(['pequeno', 'medio', 'grande', 'visual'])
  })

  it('o modelo local: origem `openai_compat`, sem envio externo', () => {
    const destino = destinoDoAdaptador({ adaptador: 'openai_compat', ...base, modelo: { baseUrl: 'http://localhost:11434/v1', modelos: { rapido: 'm', padrao: 'm', complexo: 'm', visao: 'm' }, processamentoLocal: true } })
    expect(destino.envio).toEqual({ envioExterno: false, provedorId: null })
  })

  it('o externo sem o id do provedor não monta, como o gateway não monta', () => {
    const config: LLMConfig = { adaptador: 'openai_compat', ...base, modelo: { baseUrl: 'http://provedor.invalido', modelos: { rapido: 'm', padrao: 'm', complexo: 'm', visao: 'm' }, processamentoLocal: false } }
    expect(() => destinoDoAdaptador(config)).toThrow()
    expect(() => createLLMGateway(config, { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() })).toThrow()
  })
})

/** O limitador de mentira: reserva o que `fechados` não nomeia, e recusa o resto com a espera dita. Anota cada pedido e cada acerto, para o teste ler. */
class LimiteDeMentira implements LimiteDeTokens {
  readonly pedidos: { modelo: string; estimativa: number; fila: FilaDeTokens }[] = []
  readonly acertos: number[] = []
  /** O mesmo que `acertos`, por `provedor:modelo`: diz de qual reserva veio cada acerto. */
  readonly acertosPorModelo: Record<string, number[]> = {}
  /** Os `provedor:modelo` sem vaga agora: o teste os abre com o relógio. */
  readonly fechados = new Set<string>()
  uso = 0.5
  /** A recusa do balde da fila vem sem o uso do geral, que nem foi consultado. */
  recusaSemUso = false

  constructor(private readonly msAteLiberar = 1_000) {}

  async reservar(modelo: string, estimativa: number, fila: FilaDeTokens): Promise<ResultadoDaReserva> {
    this.pedidos.push({ modelo, estimativa, fila })
    if (this.fechados.has(modelo)) return this.recusaSemUso ? { concedida: false, msAteLiberar: this.msAteLiberar } : { concedida: false, msAteLiberar: this.msAteLiberar, usoDoTeto: this.uso }
    return { concedida: true, usoDoTeto: this.uso, reserva: { acertar: async (usoReal) => void (this.acertos.push(usoReal), (this.acertosPorModelo[modelo] ??= []).push(usoReal)) } }
  }

  get modelosPedidos(): string[] {
    return this.pedidos.map((pedido) => pedido.modelo)
  }
}

/**
 * Um balde que enche de verdade: a capacidade é de `vagas` vezes a primeira estimativa, a reserva soma a estimativa, e o acerto a troca pelo uso real. O `LimiteDeMentira` só anota os pedidos, e não deixaria ver a
 * vaga que fica no balde (reserva-e-avaliacao, 4.0).
 */
class LimiteComBalde implements LimiteDeTokens {
  readonly acertos: number[] = []
  private capacidade: number | undefined
  private usado = 0

  constructor(private readonly vagas: number) {}

  async reservar(_modelo: string, estimativa: number): Promise<ResultadoDaReserva> {
    this.capacidade ??= estimativa * this.vagas
    if (this.usado + estimativa > this.capacidade) return { concedida: false, msAteLiberar: 60_000, usoDoTeto: 1 }
    this.usado += estimativa
    return { concedida: true, usoDoTeto: this.usado / this.capacidade, reserva: { acertar: async (usoReal) => void (this.acertos.push(usoReal), (this.usado += usoReal - estimativa)) } }
  }
}

const PRINCIPAL_DO_PADRAO = `${PROVEDOR_ROTEIRIZADO}:roteirizado-padrao`
const PRINCIPAL_DO_RAPIDO = `${PROVEDOR_ROTEIRIZADO}:roteirizado-rapido`
const MENOR_DO_PADRAO = `${PROVEDOR_ROTEIRIZADO}:menor-padrao`
const MENOR_DO_RAPIDO = `${PROVEDOR_ROTEIRIZADO}:menor-rapido`
const MENORES = { padrao: 'menor-padrao', rapido: 'menor-rapido' } as const
const saidaDeAtividade = () => JSON.stringify(atividadeDeEstequiometria())
const pedidoDaFerramenta = () => ({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO, fila: 'ferramenta' as const })

async function valorDe(leitor: MedidorDeTeste, nome: string, atributo: string, valor: string): Promise<number> {
  const ponto = (await leitor.pontos(nome)).find((candidato) => candidato.atributos[atributo] === valor)
  return typeof ponto?.valor === 'number' ? ponto.valor : Number.NaN
}

describe('LLMGateway: o limite de tokens e a degradação (49.0; RF7, RF8; regra 80, item 4)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('com vaga, a chamada roda no modelo do perfil, reservada na fila do pedido, e a reserva é acertada pelo uso real; nenhum degrau', async () => {
    const limite = new LimiteDeMentira()
    const leitor = new MedidorDeTeste()
    const adaptador = new ScriptedAdapter([saidaDeAtividade()])
    const { ia } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, medidor: leitor.medidor })
    await ia.generate(pedidoDaFerramenta())
    expect(limite.pedidos).toEqual([{ modelo: PRINCIPAL_DO_PADRAO, estimativa: tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()) + gerarAtividadeObjetiva.maximoDeTokensDeSaida, fila: 'ferramenta' }])
    expect(adaptador.modelosPedidos).toEqual([undefined])
    // O uso real (100 de entrada e 20 de saída, do roteiro) troca a estimativa.
    expect(limite.acertos).toEqual([120])
    for (const degrau of ['espera', 'modelo_menor', 'indisponivel']) expect(await valorDe(leitor, 'ia.degradacao', 'degrau', degrau), degrau).toBe(0)
    await leitor.encerrar()
  })

  it('sem fila no pedido, a reserva vale a `normal`, a do menor teto', async () => {
    const limite = new LimiteDeMentira()
    const { ia } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), limiteDeTokens: limite })
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(limite.pedidos.map((pedido) => pedido.fila)).toEqual(['normal'])
  })

  it('degrau 1: sem vaga, espera até 8 s; a vaga que abre aos 7 s leva a chamada ao modelo principal, e só a espera conta', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const leitor = new MedidorDeTeste()
    const adaptador = new ScriptedAdapter([saidaDeAtividade()])
    const { ia } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, medidor: leitor.medidor })
    const resultado = ia.generate(pedidoDaFerramenta())
    await vi.advanceTimersByTimeAsync(6_999)
    expect(adaptador.chamadas).toBe(0)
    limite.fechados.delete(PRINCIPAL_DO_PADRAO)
    await vi.advanceTimersByTimeAsync(1_000)
    await resultado
    expect(adaptador.modelosPedidos).toEqual([undefined])
    expect(limite.modelosPedidos.every((modelo) => modelo === PRINCIPAL_DO_PADRAO)).toBe(true)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'espera')).toBe(1)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(0)
    await leitor.encerrar()
  })

  it('degrau 2: passados os 8 s sem vaga, vai ao modelo menor do perfil, que responde e fica no consumo e na medição; conta a espera e o menor', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const leitor = new MedidorDeTeste()
    const adaptador = new ScriptedAdapter([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, medidor: leitor.medidor })
    const resultado = ia.generate(pedidoDaFerramenta())
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS - 1)
    expect(adaptador.chamadas).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    const { medicao } = await resultado
    expect(adaptador.modelosPedidos).toEqual(['menor-padrao'])
    expect(limite.modelosPedidos.at(-1)).toBe(MENOR_DO_PADRAO)
    expect(medicao.modelo).toBe('menor-padrao')
    expect(consumo.registros).toMatchObject([{ modelo: 'menor-padrao', estado: 'concluida', tentativas: 1 }])
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'espera')).toBe(1)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(1)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(0)
    await leitor.encerrar()
  })

  it('o modelo menor que falha: o consumo de `falhou` grava o menor, que recebeu o pedido, e não o do perfil', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const adaptador = new ScriptedAdapter([new LLMError('IA_INDISPONIVEL')])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES })
    const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    expect(await resultado).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL' })
    expect(adaptador.modelosPedidos).toEqual(['menor-padrao'])
    // Antes de a chamada sair o consumo dizia o principal (`gasto.modelo` só mudava com a resposta).
    expect(consumo.registros).toMatchObject([{ modelo: 'menor-padrao', estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL' }])
  })

  it('degrau 3: sem vaga no principal nem no menor, termina IA_INDISPONIVEL aos 8 s, sem chamar o modelo, sem erro cru e sem dizer que houve envio', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO).add(MENOR_DO_PADRAO)
    const leitor = new MedidorDeTeste()
    const adaptador = new ScriptedAdapter([])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, medidor: leitor.medidor })
    const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    expect(await resultado).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', status: 503 })
    expect(adaptador.chamadas).toBe(0)
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', tentativas: 0, envioExterno: false, provedorId: null }])
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'espera')).toBe(1)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(1)
    await leitor.encerrar()
  })

  it('o turno do Tutor pula o modelo menor (D36, regra 30, item 11): sem vaga, termina IA_INDISPONIVEL sem nem reservar o menor', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_RAPIDO)
    const leitor = new MedidorDeTeste()
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, soberania: CONFERIDA, medidor: leitor.medidor })
    const resultado = erroDe(ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId: ESCOLA_A, alunoId: ALUNO_1, execucaoId: EXECUCAO, fila: 'interativa' }))
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    expect((await resultado).codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(limite.modelosPedidos).not.toContain(MENOR_DO_RAPIDO)
    expect(adaptador.chamadas).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(1)
    await leitor.encerrar()
  })

  describe('a classificação do material, do lote (classificacao-bncc, 4.0)', () => {
    const SECAO = '0190f5a0-0000-7000-8000-0000000000a1'
    const entradaDaClassificacao = () => ({
      candidatas: [{ codigo: 'EF07MA01', descricao: 'Resolver problemas com números naturais, inteiros e racionais.' }],
      secoes: [{ secaoId: SECAO, titulo: 'Capítulo secreto da apostila', comeco: 'Texto do começo que não vai ao consumo.', subtitulos: 'Subtítulo reservado' }],
    })
    const pedidoDoLote = () => ({ tarefa: classificarSecoes, entrada: entradaDaClassificacao(), escolaId: ESCOLA_A, execucaoId: EXECUCAO, fila: 'lote' as const })

    it('balde `lote` cheio: termina IA_INDISPONIVEL com `sem_vaga` e a espera do balde, sem nem reservar o modelo menor, sem chamar o provedor e sem linha de consumo', async () => {
      vi.useFakeTimers()
      const limite = new LimiteDeMentira(7_200)
      limite.fechados.add(PRINCIPAL_DO_RAPIDO)
      const adaptador = new ScriptedAdapter([])
      const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, soberania: CONFERIDA })
      const resultado = erroDe(ia.generate(pedidoDoLote()))
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
      const erro = await resultado
      expect(erro.codigoDeIa).toBe('IA_INDISPONIVEL')
      expect(erro.motivo).toBe('sem_vaga')
      expect(erro.semEnvio).toBe(true)
      expect(erro.tenteDeNovoEmSegundos).toBe(8)
      expect(limite.modelosPedidos).not.toContain(MENOR_DO_RAPIDO)
      expect(limite.pedidos.every((pedido) => pedido.fila === 'lote')).toBe(true)
      expect(adaptador.chamadas).toBe(0)
      expect(consumo.registros).toEqual([])
    })

    it('fora do lote, o balde cheio registra a linha da falha: só o lote adia sem consumo', async () => {
      vi.useFakeTimers()
      const limite = new LimiteDeMentira(7_200)
      limite.fechados.add(PRINCIPAL_DO_RAPIDO)
      const adaptador = new ScriptedAdapter([])
      const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, soberania: CONFERIDA })
      const resultado = erroDe(ia.generate({ ...pedidoDoLote(), fila: 'normal' as const }))
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
      const erro = await resultado
      expect(erro.codigoDeIa).toBe('IA_INDISPONIVEL')
      expect(consumo.registros).toHaveLength(1)
      expect(consumo.registros[0]).toMatchObject({ estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL' })
    })

    it('o provedor que falhou depois de a chamada sair não é `semEnvio`: o motivo fica vazio e a linha de consumo registra a falha', async () => {
      const adaptador = new ScriptedAdapter([new LLMError('IA_INDISPONIVEL')])
      const { ia, consumo } = montar({ adaptador, soberania: CONFERIDA })
      const erro = await erroDe(ia.generate(pedidoDoLote()))
      expect(erro.codigoDeIa).toBe('IA_INDISPONIVEL')
      expect(erro.motivo).toBeUndefined()
      expect(erro.semEnvio).toBe(false)
      expect(adaptador.chamadas).toBe(1)
      expect(consumo.registros).toHaveLength(1)
      expect(consumo.registros[0]).toMatchObject({ estado: 'falhou', funcao: 'classificacao_do_material', tarefa: 'classificar_secoes' })
    })

    it('o consumo guarda só os ids das seções e a versão do prompt, e a saída; nunca o título, o texto nem a lista de candidatas', async () => {
      const { ia, consumo } = montar({ soberania: CONFERIDA })
      await ia.generate(pedidoDoLote())
      const registro = consumo.registros[0]
      expect(registro).toMatchObject({ estado: 'concluida', funcao: 'classificacao_do_material', tarefa: 'classificar_secoes' })
      expect(registro?.entrada).toEqual({ secoes: [SECAO], promptVersao: PROMPT_CLASSIFICAR_SECOES.versao })
      const texto = JSON.stringify(registro)
      for (const proibido of ['Capítulo secreto', 'começo que não vai', 'Subtítulo reservado', 'Resolver problemas']) expect(texto).not.toContain(proibido)
      expect(registro?.alunoId).toBeUndefined()
    })

    it('a classificação não desce a modelo menor nem com o menor configurado: a recusa é a mesma do balde cheio', async () => {
      vi.useFakeTimers()
      const limite = new LimiteDeMentira()
      limite.fechados.add(PRINCIPAL_DO_RAPIDO)
      const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, modelosMenores: MENORES, soberania: CONFERIDA })
      const resultado = erroDe(ia.generate(pedidoDoLote()))
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
      expect((await resultado).codigoDeIa).toBe('IA_INDISPONIVEL')
      expect(limite.modelosPedidos.length).toBeGreaterThan(0)
      expect(limite.modelosPedidos.every((modelo) => modelo === PRINCIPAL_DO_RAPIDO)).toBe(true)
    })
  })

  it('sem modelo menor configurado para o perfil, o degrau é pulado e a métrica dele não muda', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const leitor = new MedidorDeTeste()
    // Só o `rapido` tem menor: a ferramenta, que é do `padrao`, não tem.
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, modelosMenores: { rapido: 'menor-rapido' }, medidor: leitor.medidor })
    const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    expect((await resultado).codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(limite.modelosPedidos.every((modelo) => modelo === PRINCIPAL_DO_PADRAO)).toBe(true)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(1)
    await leitor.encerrar()
  })

  it('a saída do modelo menor passa pela mesma conferência: propor_ferramenta com nota na saída é recusada pela regra fixa da D55, e o menor é quem respondeu', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_RAPIDO)
    const comNota = JSON.stringify({ tipo: 'texto', texto: 'A nota do aluno nessa redação é 8.', citacoes: [] })
    const adaptador = new ScriptedAdapter([comNota, comNota])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, soberania: CONFERIDA })
    const resultado = ia.generate({ tarefa: proporFerramenta, entrada: entradaDoAssistente('monta uma atividade com 5 questões sobre reagente limitante'), escolaId: ESCOLA_A, execucaoId: EXECUCAO, fila: 'ferramenta' })
    // Cada tentativa reserva de novo: a repetição também espera os 8 s pela vaga do principal antes de ir ao menor.
    await vi.advanceTimersByTimeAsync(2 * ESPERA_MAXIMA_DA_VAGA_MS)
    const { saida, medicao } = await resultado
    expect(adaptador.modelosPedidos).toEqual(['menor-rapido', 'menor-rapido'])
    expect(saida).toEqual({ tipo: 'texto', texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] })
    expect(JSON.stringify(saida)).not.toContain('nota do aluno')
    expect(medicao.modelo).toBe('menor-rapido')
    // Duas chamadas ao menor, duas linhas; a execução terminou pela regra fixa da D55, e a última é a que carrega o resultado.
    expect(consumo.registros).toMatchObject([
      { modelo: 'menor-rapido', tentativas: 1, estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' },
      { modelo: 'menor-rapido', tentativas: 1, estado: 'concluida' },
    ])
  })

  it('a ordem: a D62 e o teto de entrada recusam antes do reservar, e nada é reservado', async () => {
    const limite = new LimiteDeMentira()
    // A D62: texto de aluno para provedor de fora, com a subida não conferida.
    const daD62 = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, modelosMenores: MENORES })
    expect((await erroDe(daD62.ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId: ESCOLA_A, alunoId: ALUNO_1, fila: 'interativa' }))).codigoDeIa).toBe('IA_INDISPONIVEL')
    // O teto de entrada: a tarefa com o teto abaixo do pedido.
    const pequena = { ...gerarAtividadeObjetiva, maximoDeTokensDeEntrada: 1 }
    const doTeto = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, modelosMenores: MENORES })
    expect((await erroDe(doTeto.ia.generate({ tarefa: pequena, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('PEDIDO_ACIMA_DO_TETO')
    expect(limite.pedidos).toEqual([])
  })

  it('o orçamento recusa antes do reservar: nada fica reservado por pedido que não vai ao modelo', async () => {
    const limite = new LimiteDeMentira()
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, orcamento: { check: async () => ({ permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO' }) } })
    await erroDe(ia.generate(pedidoDaFerramenta()))
    expect(limite.pedidos).toEqual([])
  })

  it('a resposta de regra fixa não reserva token: não chama o modelo', async () => {
    const limite = new LimiteDeMentira()
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, soberania: CONFERIDA })
    const fixa = { ...turnoDoTutor, semModelo: () => turnoDoTutor.falso(entradaDoTutor('não entendi')) }
    const { saida } = await ia.generate({ tarefa: fixa, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1, fila: 'interativa' })
    expect(saida.resposta.length).toBeGreaterThan(0)
    expect(limite.pedidos).toEqual([])
  })

  it('a repetição por saída inválida reserva de novo, com a resposta anterior e a correção na estimativa; cada chamada é acertada pelo seu uso', async () => {
    const limite = new LimiteDeMentira()
    const adaptador = new ScriptedAdapter(['não é json', saidaDeAtividade()])
    const { ia } = montar({ adaptador, limiteDeTokens: limite })
    await ia.generate(pedidoDaFerramenta())
    expect(limite.pedidos).toHaveLength(2)
    expect(limite.pedidos[1]?.estimativa).toBeGreaterThan(limite.pedidos[0]?.estimativa ?? Number.POSITIVE_INFINITY)
    expect(limite.acertos).toEqual([120, 120])
    // A repetição leva ao modelo a resposta anterior e o que estava errado nela; a primeira chamada não leva correção.
    expect(adaptador.correcoes[0]).toBeUndefined()
    expect(adaptador.correcoes[1]).toMatchObject({ respostaAnterior: 'não é json' })
  })

  it('o prazo que vence durante a espera a encerra na hora: IA_TEMPO_ESGOTADO, sem chamar o modelo e sem esperar os 8 s', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const adaptador = new ScriptedAdapter([])
    const prazo = new AbortController()
    const { ia } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES })
    const resultado = erroDe(ia.generate({ ...pedidoDaFerramenta(), sinal: prazo.signal }))
    await vi.advanceTimersByTimeAsync(3_000)
    prazo.abort()
    expect((await resultado).codigoDeIa).toBe('IA_TEMPO_ESGOTADO')
    expect(adaptador.chamadas).toBe(0)
    // Nada mais é reservado depois: nem o menor.
    expect(limite.modelosPedidos.every((modelo) => modelo === PRINCIPAL_DO_PADRAO)).toBe(true)
  })

  it('o sinal já abortado quando a espera começa a encerra sem esperar', async () => {
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const prazo = new AbortController()
    prazo.abort()
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite })
    expect((await erroDe(ia.generate({ ...pedidoDaFerramenta(), sinal: prazo.signal }))).codigoDeIa).toBe('IA_TEMPO_ESGOTADO')
  })

  it('o balde que libera em milissegundos não vira laço apertado: entre duas reservas há ao menos 50 ms', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira(1)
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite })
    const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
    await vi.advanceTimersByTimeAsync(1_000)
    // 1 000 ms a 50 ms: no máximo 21 reservas (a primeira e uma a cada 50 ms), nunca uma por milissegundo.
    expect(limite.pedidos.length).toBeLessThanOrEqual(21)
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    await resultado
  })

  it('o log de cada degrau leva só o evento, a tarefa, o id do modelo e o código; nunca a escola, a execução, o aluno nem o pedido (regra 20, item 9)', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO).add(MENOR_DO_PADRAO)
    const logger = registrador()
    const { ia } = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, modelosMenores: MENORES, logger })
    const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    await resultado
    const degraus = logger.linhas().filter((linha) => ['ia.geracao.espera_de_vaga', 'ia.geracao.sem_vaga'].includes((linha as { evento?: string }).evento ?? ''))
    expect(degraus).toEqual([
      { evento: 'ia.geracao.espera_de_vaga', tipo: 'gerar_atividade_objetiva', modeloId: 'roteirizado-padrao' },
      { evento: 'ia.geracao.sem_vaga', tipo: 'gerar_atividade_objetiva', modeloId: 'menor-padrao', codigo: 'IA_INDISPONIVEL' },
    ])
  })

  it('o log do degrau do modelo menor leva só o evento, a tarefa e o id do modelo', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const logger = registrador()
    const { ia } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), limiteDeTokens: limite, modelosMenores: MENORES, logger })
    const resultado = ia.generate(pedidoDaFerramenta())
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    await resultado
    expect(logger.linhas()).toContainEqual({ evento: 'ia.geracao.modelo_menor', tipo: 'gerar_atividade_objetiva', modeloId: 'menor-padrao' })
  })

  it('sem limitador (o local sem LLM_TOKENS_POR_MINUTO), a chamada vai direto ao modelo do perfil, sem espera nem degrau', async () => {
    const adaptador = new ScriptedAdapter([saidaDeAtividade()])
    const { ia } = montar({ adaptador, modelosMenores: MENORES })
    await ia.generate(pedidoDaFerramenta())
    expect(adaptador.modelosPedidos).toEqual([undefined])
  })

  it('as métricas do gateway nunca levam usuário nem escola, nem execução, aluno ou texto: só provedor, perfil, resultado, código, degrau e modelo', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    const leitor = new MedidorDeTeste()
    const { ia } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), limiteDeTokens: limite, modelosMenores: MENORES, medidor: leitor.medidor })
    const resultado = ia.generate(pedidoDaFerramenta())
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    await resultado
    const lidas = (await leitor.atributosDeTodas()).filter((ponto) => ponto.nome.startsWith('ia.'))
    expect(new Set(lidas.map((ponto) => ponto.nome))).toEqual(new Set(['ia.pedido_acima_do_teto', 'ia.degradacao', 'ia.chamada.duracao', 'ia.tokens.uso_do_teto']))
    const nomes = new Set(lidas.flatMap((ponto) => Object.keys(ponto.atributos)))
    expect([...nomes].sort()).toEqual(['degrau', 'modelo', 'perfil', 'provedor', 'resultado', 'tarefa'])
    await leitor.encerrar()
  })

  it('a duração e os erros da chamada ao provedor: ok na que respondeu, erro com o código na que falhou; a espera pela vaga não entra', async () => {
    const leitor = new MedidorDeTeste()
    const { ia } = montar({ adaptador: new ScriptedAdapter([new LLMError('IA_TEMPO_ESGOTADO'), saidaDeAtividade()]), medidor: leitor.medidor })
    await erroDe(ia.generate(pedidoDaFerramenta()))
    await ia.generate(pedidoDaFerramenta())
    const duracoes = await leitor.pontos('ia.chamada.duracao')
    expect(duracoes.map((ponto) => [ponto.atributos['provedor'], ponto.atributos['perfil'], ponto.atributos['resultado'], (ponto.valor as { contagem: number }).contagem]).sort()).toEqual([
      [PROVEDOR_ROTEIRIZADO, 'padrao', 'erro', 1],
      [PROVEDOR_ROTEIRIZADO, 'padrao', 'ok', 1],
    ])
    expect((await leitor.pontos('ia.chamada.erros')).map((ponto) => [ponto.atributos['codigo'], ponto.valor])).toEqual([['IA_TEMPO_ESGOTADO', 1]])
    await leitor.encerrar()
  })

  it('o uso do teto é o da última reserva do modelo, e volta a 0 um minuto depois sem reservar', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.uso = 0.8
    const leitor = new MedidorDeTeste()
    const { ia } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), limiteDeTokens: limite, medidor: leitor.medidor })
    await ia.generate(pedidoDaFerramenta())
    expect(await valorDe(leitor, 'ia.tokens.uso_do_teto', 'modelo', 'roteirizado-padrao')).toBe(0.8)
    await vi.advanceTimersByTimeAsync(59_000)
    expect(await valorDe(leitor, 'ia.tokens.uso_do_teto', 'modelo', 'roteirizado-padrao')).toBe(0.8)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(await valorDe(leitor, 'ia.tokens.uso_do_teto', 'modelo', 'roteirizado-padrao')).toBe(0)
    await leitor.encerrar()
  })
})

describe('LLMGateway: o uso do teto na recusa do balde da fila (49.0)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a recusa que não traz o uso do geral (o balde da fila cheio) não zera nem inventa a métrica: vale a última reserva', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    limite.uso = 0.6
    const leitor = new MedidorDeTeste()
    const { ia } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), limiteDeTokens: limite, medidor: leitor.medidor })
    await ia.generate(pedidoDaFerramenta())
    expect(await valorDe(leitor, 'ia.tokens.uso_do_teto', 'modelo', 'roteirizado-padrao')).toBe(0.6)
    limite.fechados.add(PRINCIPAL_DO_PADRAO)
    limite.recusaSemUso = true
    const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    await resultado
    expect(await valorDe(leitor, 'ia.tokens.uso_do_teto', 'modelo', 'roteirizado-padrao')).toBe(0.6)
    await leitor.encerrar()
  })
})

describe('createLLMGateway: o modelo menor precisa de preço (49.0, D14)', () => {
  const PORTAS = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
  const CONFIG: LLMConfig = { adaptador: 'falso', prazosMs: PRAZOS, recuoMs: 100, replicas: 1 }

  it('modelo menor sem preço em PRECO_DOS_MODELOS: a subida falha, dizendo a variável e nunca o valor', () => {
    let erro: unknown
    try {
      createLLMGateway({ ...CONFIG, modelosMenores: { padrao: 'modelo-sem-preco', rapido: 'falso-menor' } }, PORTAS)
    } catch (motivo) {
      erro = motivo
    }
    expect(erro).toBeInstanceOf(InvalidConfigError)
    expect(erro).toMatchObject({ variaveis: ['LLM_MODELO_MENOR_PADRAO'], motivos: [MOTIVO_MODELO_MENOR_SEM_PRECO] })
    expect(JSON.stringify(erro)).not.toContain('modelo-sem-preco')
  })

  it('com preço, sobe; sem modelo menor, sobe', () => {
    expect(() => createLLMGateway({ ...CONFIG, modelosMenores: { padrao: 'falso-menor' } }, PORTAS)).not.toThrow()
    expect(() => createLLMGateway(CONFIG, PORTAS)).not.toThrow()
  })

  it('o medidor das portas chega ao decorador: depois de uma chamada, `ia.disjuntor.aberto` existe para o modelo e o perfil, fechado', async () => {
    const leitor = new MedidorDeTeste()
    const ia = withEscolaContextOfRequest(createLLMGateway(CONFIG, { ...PORTAS, registro: new InMemoryConsumo(), medidor: leitor.medidor }))
    await ia.generate(pedidoDaFerramenta())
    const pontos = await leitor.pontos('ia.disjuntor.aberto')
    expect(pontos.map((ponto) => [ponto.atributos['provedor'], ponto.atributos['modelo'], ponto.atributos['perfil'], ponto.valor])).toEqual([['falso', MODELO_FALSO, 'padrao', 0]])
    await leitor.encerrar()
  })

  it('o menor do adaptador falso responde com o nome dele, e o disjuntor conta por modelo', async () => {
    vi.useFakeTimers()
    try {
      const limite = new LimiteDeMentira()
      limite.fechados.add(`falso:${MODELO_FALSO}`)
      const consumo = new InMemoryConsumo()
      const ia = withEscolaContextOfRequest(createLLMGateway({ ...CONFIG, modelosMenores: { padrao: 'falso-menor' } }, { ...PORTAS, registro: consumo, limiteDeTokens: limite }))
      const resultado = ia.generate(pedidoDaFerramenta())
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
      await resultado
      expect(consumo.registros).toMatchObject([{ modelo: 'falso-menor', origem: 'falso', estado: 'concluida' }])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('LLMGateway: uma linha por chamada enviada, com o custo pelo preço vigente (camada-ia 1.0; RF5, RF6; D14)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** 100 de entrada e 20 de saída por chamada (o `ScriptedAdapter`): a 1.300 e 5.200 micros por mil, (130.000 + 104.000) ÷ 1.000 = 234. */
  const ANTIGO = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste', entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }
  const CUSTO_ANTIGO = 234
  const PRECOS: TabelaDePrecos = {
    [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'roteirizado-padrao')]: [ANTIGO],
    [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'menor-padrao')]: [{ ...ANTIGO, entradaMicrosPorMilTokens: 300, saidaMicrosPorMilTokens: 1_200 }],
  }
  const pedido = () => ({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO })
  const pedidoDoLote = () => ({ ...pedido(), fila: 'lote' as const })

  it('a chamada que voltou grava o custo: 100 + 20 tokens a 1.300 e 5.200 micros por mil custam 234', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), precos: PRECOS })
    await ia.generate(pedido())
    expect(consumo.registros).toMatchObject([{ estado: 'concluida', tentativas: 1, tokensDeEntrada: 100, tokensDeSaida: 20, custoMicros: CUSTO_ANTIGO }])
  })

  it('primeira saída inválida e a segunda válida: duas linhas, a primeira `falhou`/`IA_SAIDA_INVALIDA`, cada uma com os seus tokens e o seu custo', async () => {
    const adaptador = new ScriptedAdapter(['não é json', saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador, precos: PRECOS })
    await ia.generate(pedido())
    expect(adaptador.chamadas).toBe(2)
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 1, tokensDeEntrada: 100, tokensDeSaida: 20, custoMicros: CUSTO_ANTIGO, modelo: 'roteirizado-padrao', provedorId: PROVEDOR_ROTEIRIZADO, execucaoId: EXECUCAO },
      { estado: 'concluida', tentativas: 1, tokensDeEntrada: 100, tokensDeSaida: 20, custoMicros: CUSTO_ANTIGO, modelo: 'roteirizado-padrao', provedorId: PROVEDOR_ROTEIRIZADO, execucaoId: EXECUCAO },
    ])
  })

  it('`entrada` e `saida` ficam só na última linha: a saída inválida não é guardada para depuração (regra 20)', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', saidaDeAtividade()]), precos: PRECOS })
    const entrada = entradaDeAtividade()
    const { saida } = await ia.generate({ ...pedido(), entrada })
    expect(consumo.registros).toHaveLength(2)
    expect(consumo.registros[0]).not.toHaveProperty('entrada')
    expect(consumo.registros[0]).not.toHaveProperty('saida')
    expect(consumo.registros[1]).toMatchObject({ entrada, saida })
  })

  it('duas vigências do mesmo modelo: cada chamada grava o preço do seu instante, e a linha antiga não muda com o preço novo', async () => {
    let agora = new Date('2026-10-05T11:59:59Z')
    const novo = { ...ANTIGO, vigenteDesde: '2026-10-05T12:00:00Z', entradaMicrosPorMilTokens: 2_000, saidaMicrosPorMilTokens: 8_000 }
    const precos: TabelaDePrecos = { [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'roteirizado-padrao')]: [ANTIGO, novo] }
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade(), saidaDeAtividade()]), precos, agora: () => agora })
    await ia.generate(pedido())
    agora = new Date('2026-10-05T12:00:00Z')
    await ia.generate(pedido())
    // (100 × 2.000 + 20 × 8.000) ÷ 1.000 = 360
    expect(consumo.registros.map((registro) => registro.custoMicros)).toEqual([CUSTO_ANTIGO, 360])
  })

  it('o mesmo modelo em dois provedores, a preços diferentes: a chave leva o provedor que atendeu', async () => {
    const precos: TabelaDePrecos = {
      [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'roteirizado-padrao')]: [ANTIGO],
      // O modelo local do `ScriptedAdapter` sem envio externo tem a origem como provedor. (100 × 900 + 20 × 1.800) ÷ 1.000 = 126
      [chaveDoPreco('openai_compat', 'roteirizado-padrao')]: [{ ...ANTIGO, entradaMicrosPorMilTokens: 900, saidaMicrosPorMilTokens: 1_800 }],
    }
    const externo = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()], true), precos })
    await externo.ia.generate(pedido())
    const local = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()], false), precos })
    await local.ia.generate(pedido())
    expect(externo.consumo.registros).toMatchObject([{ custoMicros: CUSTO_ANTIGO }])
    expect(local.consumo.registros).toMatchObject([{ custoMicros: 126 }])
  })

  it('o adaptador falso e o modelo sem preço gravam custo zero', async () => {
    const falso = montar()
    await falso.ia.generate(pedido())
    const semPreco = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()]), precos: {} })
    await semPreco.ia.generate(pedido())
    expect(falso.consumo.registros).toMatchObject([{ custoMicros: 0 }])
    expect(semPreco.consumo.registros).toMatchObject([{ custoMicros: 0 }])
  })

  it('troca para o menor: duas linhas, cada uma com o seu modelo e o seu preço', async () => {
    vi.useFakeTimers()
    const limite = new LimiteDeMentira()
    // O principal responde a primeira vez com saída inválida e fecha: a repetição não acha vaga nele e desce ao menor.
    class FechaOPrincipalDepoisDaPrimeira extends ScriptedAdapter {
      override async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
        const resposta = await super.chamar(chamada)
        limite.fechados.add(PRINCIPAL_DO_PADRAO)
        return resposta
      }
    }
    const { ia, consumo } = montar({ adaptador: new FechaOPrincipalDepoisDaPrimeira(['não é json', saidaDeAtividade()]), limiteDeTokens: limite, modelosMenores: MENORES, precos: PRECOS })
    const resultado = ia.generate({ ...pedido(), fila: 'ferramenta' as const })
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
    await resultado
    // O menor a 300 e 1.200 micros por mil: (100 × 300 + 20 × 1.200) ÷ 1.000 = 54.
    expect(consumo.registros).toMatchObject([
      { modelo: 'roteirizado-padrao', custoMicros: CUSTO_ANTIGO, estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' },
      { modelo: 'menor-padrao', custoMicros: 54, estado: 'concluida' },
    ])
  })

  describe('a chamada que saiu sem voltar com uso grava a estimativa (D14: superestima)', () => {
    it.each(['IA_TEMPO_ESGOTADO', 'IA_INDISPONIVEL'] as const)('%s depois do envio: a entrada contada, a saída no teto da tarefa e o custo disso', async (codigo) => {
      const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([new LLMError(codigo)]), precos: PRECOS })
      await erroDe(ia.generate(pedido()))
      const tokens = { tokensDeEntrada: tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()), tokensDeSaida: gerarAtividadeObjetiva.maximoDeTokensDeSaida }
      expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: codigo, tentativas: 1, envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO, ...tokens, custoMicros: custoDaChamada(tokens, ANTIGO) }])
      expect(consumo.registros[0]?.custoMicros).toBeGreaterThan(0)
      expect(consumo.registros[0]?.entrada).toEqual(entradaDeAtividade())
    })

    it('a repetição que cai leva a correção na entrada contada: a primeira inválida grava o uso real, a segunda a estimativa', async () => {
      const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', new LLMError('IA_TEMPO_ESGOTADO')]), precos: PRECOS })
      await erroDe(ia.generate(pedido()))
      expect(consumo.registros).toHaveLength(2)
      expect(consumo.registros[0]).toMatchObject({ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tokensDeEntrada: 100, tokensDeSaida: 20 })
      expect(consumo.registros[0]).not.toHaveProperty('entrada')
      expect(consumo.registros[1]).toMatchObject({ estado: 'falhou', codigoDeErro: 'IA_TEMPO_ESGOTADO', tokensDeSaida: gerarAtividadeObjetiva.maximoDeTokensDeSaida })
      expect(consumo.registros[1]?.tokensDeEntrada).toBeGreaterThan(tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()))
      expect(consumo.registros[1]?.entrada).toEqual(entradaDeAtividade())
    })
  })

  describe('a chamada que não saiu não é chamada (D14: a conta é do que foi enviado)', () => {
    const DISJUNTOR_ABERTO = () => new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor')

    it('disjuntor aberto no lote: nenhuma linha, e o job adia', async () => {
      const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([DISJUNTOR_ABERTO()]), precos: PRECOS })
      const erro = await erroDe(ia.generate(pedidoDoLote()))
      expect(erro.semEnvio).toBe(true)
      expect(consumo.registros).toEqual([])
    })

    it('disjuntor aberto fora do lote: uma linha da falha, sem tokens, sem custo e sem dizer que houve envio', async () => {
      const adaptador = new ScriptedAdapter([DISJUNTOR_ABERTO()])
      const { ia, consumo } = montar({ adaptador, precos: PRECOS })
      await erroDe(ia.generate(pedido()))
      expect(adaptador.chamadas).toBe(1)
      expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', tentativas: 0, tokensDeEntrada: 0, tokensDeSaida: 0, custoMicros: 0, envioExterno: false, provedorId: null }])
    })

    it('a chamada anterior que saiu continua tendo a sua linha, mesmo com a repetição adiada pelo disjuntor', async () => {
      const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', DISJUNTOR_ABERTO()]), precos: PRECOS })
      await erroDe(ia.generate(pedidoDoLote()))
      expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 1, custoMicros: CUSTO_ANTIGO }])
      expect(consumo.registros).toHaveLength(1)
    })
  })

  it('principal inválido duas vezes: duas linhas, e o limite de chamadas é o de sempre', async () => {
    const adaptador = new ScriptedAdapter(['não é json', 'não é json', saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador, precos: PRECOS })
    await erroDe(ia.generate(pedido()))
    expect(adaptador.chamadas).toBe(2)
    expect(consumo.registros).toHaveLength(2)
    expect(consumo.registros.map((registro) => registro.custoMicros)).toEqual([CUSTO_ANTIGO, CUSTO_ANTIGO])
    // As duas chamadas saíram e nenhuma deu certo: as duas linhas são `falhou`/`IA_SAIDA_INVALIDA`, e a última não vira `concluida`.
    expect(consumo.registros.map((registro) => [registro.estado, registro.codigoDeErro])).toEqual([
      ['falhou', 'IA_SAIDA_INVALIDA'],
      ['falhou', 'IA_SAIDA_INVALIDA'],
    ])
  })

  it('a regra fixa não chama modelo: uma linha, sem tokens e sem custo', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([]), precos: PRECOS })
    await ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('eu quero morrer'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(consumo.registros).toMatchObject([{ origem: 'regra_fixa', tentativas: 0, tokensDeEntrada: 0, tokensDeSaida: 0, custoMicros: 0 }])
  })

  it('se o registro de uma das linhas falhar, a saída não é devolvida, e a outra linha ainda é gravada', async () => {
    const gravadas: ConsumoDeIa[] = []
    let chamadas = 0
    const registro: RegistroDeConsumo = {
      registrar: async (linha) => {
        chamadas += 1
        if (chamadas === 1) throw new Error('banco fora')
        gravadas.push(linha)
      },
    }
    const { ia } = montar({ adaptador: new ScriptedAdapter(['não é json', saidaDeAtividade()]), registro, precos: PRECOS })
    const erro = await erroDe(ia.generate(pedido()))
    expect(erro.codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(gravadas).toMatchObject([{ estado: 'concluida' }])
  })
})

describe('createLLMGateway: fora de `local`, o modelo do principal precisa de preço (camada-ia 1.0; RF6)', () => {
  const PORTAS = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
  const VIGENTE = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste', entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }
  const AMBIENTE = { AMBIENTE: 'producao', IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'https://api.provedor.example/v1', IA_PROVEDOR_ID: 'provedor-de-teste', LLM_TOKENS_POR_MINUTO: '2500000' }
  const precosDe = (provedor: string, ...modelos: string[]): TabelaDePrecos => Object.fromEntries(modelos.map((modelo) => [chaveDoPreco(provedor, modelo), [VIGENTE]]))
  const subir = (ambiente: Record<string, string | undefined>, precos: TabelaDePrecos, relogio?: { agora: () => Date }): void => {
    createLLMGateway(loadLLMConfig({ ...AMBIENTE, ...ambiente }), { ...PORTAS, precos, ...(relogio === undefined ? {} : { relogio }) })
  }
  const recusa = (ambiente: Record<string, string | undefined>, precos: TabelaDePrecos, relogio?: { agora: () => Date }): InvalidConfigError => {
    try {
      subir(ambiente, precos, relogio)
    } catch (erro) {
      if (erro instanceof InvalidConfigError) return erro
      throw erro
    }
    throw new Error('a subida deveria ter sido recusada')
  }

  it('`AMBIENTE=producao` com `openai_compat` e o modelo comum sem preço: recusa citando `LLM_MODELO`, nunca o valor', () => {
    const erro = recusa({ LLM_MODELO: 'modelo-sem-preco' }, {})
    expect(erro).toMatchObject({ variaveis: ['LLM_MODELO'], motivos: [MOTIVO_MODELO_SEM_PRECO] })
    expect(JSON.stringify(erro)).not.toContain('modelo-sem-preco')
  })

  it('o perfil com modelo próprio sem preço cita a variável dele, e só a dele', () => {
    const precos = precosDe('provedor-de-teste', 'modelo-comum')
    expect(recusa({ LLM_MODELO: 'modelo-comum', LLM_MODELO_RAPIDO: 'modelo-do-tutor', LLM_MODELO_VISAO: 'modelo-da-foto' }, precos)).toMatchObject({ variaveis: ['LLM_MODELO_RAPIDO', 'LLM_MODELO_VISAO'], motivos: [MOTIVO_MODELO_SEM_PRECO] })
    // O comum sem preço, com os de dois perfis cobertos: o comum ainda atende os outros dois.
    expect(recusa({ LLM_MODELO: 'modelo-comum', LLM_MODELO_RAPIDO: 'a', LLM_MODELO_PADRAO: 'b' }, precosDe('provedor-de-teste', 'a', 'b'))).toMatchObject({ variaveis: ['LLM_MODELO'] })
  })

  it('com preço em todos os modelos, sobe; o staging também exige, e o `local` dispensa', () => {
    const precos = precosDe('provedor-de-teste', 'modelo-comum', 'modelo-do-tutor')
    expect(() => subir({ LLM_MODELO: 'modelo-comum', LLM_MODELO_RAPIDO: 'modelo-do-tutor' }, precos)).not.toThrow()
    expect(recusa({ AMBIENTE: 'staging', LLM_MODELO: 'modelo-sem-preco' }, {})).toMatchObject({ variaveis: ['LLM_MODELO'] })
    expect(() => subir({ AMBIENTE: 'local', LLM_MODELO: 'modelo-sem-preco' }, {})).not.toThrow()
  })

  it('o preço é do `provedor:modelo`: o mesmo modelo com preço em outro provedor não vale', () => {
    expect(recusa({ LLM_MODELO: 'modelo-comum' }, precosDe('outro-provedor', 'modelo-comum'))).toMatchObject({ variaveis: ['LLM_MODELO'], motivos: [MOTIVO_MODELO_SEM_PRECO] })
    // O provedor é o `IA_PROVEDOR_ID`, e não a origem do adaptador (`openai_compat`): o preço escrito com a origem não vale.
    expect(recusa({ LLM_MODELO: 'modelo-comum' }, precosDe('openai_compat', 'modelo-comum'))).toMatchObject({ variaveis: ['LLM_MODELO'] })
  })

  it('o preço precisa já estar vigente: só com vigência futura, a subida é recusada', () => {
    const futuro = { [chaveDoPreco('provedor-de-teste', 'modelo-comum')]: [{ ...VIGENTE, vigenteDesde: '2026-12-01T00:00:00Z' }] }
    expect(recusa({ LLM_MODELO: 'modelo-comum' }, futuro, { agora: () => new Date('2026-11-20T12:00:00Z') })).toMatchObject({ variaveis: ['LLM_MODELO'] })
    expect(() => subir({ LLM_MODELO: 'modelo-comum' }, futuro, { agora: () => new Date('2026-12-01T00:00:00Z') })).not.toThrow()
  })

  it('o principal e o menor sem preço juntos: as duas variáveis e os dois motivos, em ordem', () => {
    const erro = recusa({ LLM_MODELO: 'modelo-sem-preco', LLM_MODELO_MENOR_PADRAO: 'menor-sem-preco' }, {})
    expect(erro).toMatchObject({ variaveis: ['LLM_MODELO', 'LLM_MODELO_MENOR_PADRAO'], motivos: [MOTIVO_MODELO_SEM_PRECO, MOTIVO_MODELO_MENOR_SEM_PRECO] })
  })
})

describe('createLLMGateway: fora de `local`, o modelo da reserva precisa de preço, na identidade dela (reserva-e-avaliacao, 1.0; RF6)', () => {
  const PORTAS = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
  const VIGENTE = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste', entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }
  const AMBIENTE = {
    AMBIENTE: 'producao',
    IA_ADAPTADOR: 'openai_compat',
    LLM_BASE_URL: 'https://api.provedor.example/v1',
    IA_PROVEDOR_ID: 'provedor-de-teste',
    LLM_TOKENS_POR_MINUTO: '2500000',
    LLM_MODELO: 'modelo-comum',
    IA_RESERVA_ADAPTADOR: 'openai_compat',
    LLM_RESERVA_BASE_URL: 'https://reserva.provedor.example/v1',
    IA_RESERVA_PROVEDOR_ID: 'provedor-de-reserva',
    LLM_RESERVA_TOKENS_POR_MINUTO: '1500000',
    LLM_RESERVA_MODELO: 'modelo-da-reserva',
  }
  /** Os preços que o teste dá, por `provedor:modelo`: o principal já tem o dele, e cada caso diz o que a reserva tem. */
  const precosDe = (...chaves: [string, string][]): TabelaDePrecos => Object.fromEntries([['provedor-de-teste', 'modelo-comum'], ...chaves].map(([provedor, modelo]) => [chaveDoPreco(provedor as string, modelo as string), [VIGENTE]]))
  const subir = (ambiente: Record<string, string | undefined>, precos: TabelaDePrecos): void => {
    createLLMGateway(loadLLMConfig({ ...AMBIENTE, ...ambiente }), { ...PORTAS, precos })
  }
  const recusa = (ambiente: Record<string, string | undefined>, precos: TabelaDePrecos): InvalidConfigError => {
    try {
      subir(ambiente, precos)
    } catch (erro) {
      if (erro instanceof InvalidConfigError) return erro
      throw erro
    }
    throw new Error('a subida deveria ter sido recusada')
  }

  it('`LLM_RESERVA_MODELO` sem preço recusa citando a variável, nunca o valor; com o preço dela, sobe', () => {
    const erro = recusa({}, precosDe())
    expect(erro).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO'], motivos: [MOTIVO_MODELO_DA_RESERVA_SEM_PRECO] })
    expect(JSON.stringify(erro)).not.toContain('modelo-da-reserva')
    expect(() => subir({}, precosDe(['provedor-de-reserva', 'modelo-da-reserva']))).not.toThrow()
  })

  it('o perfil da reserva com modelo próprio sem preço cita a variável dele, e só a dele; o que tem preço não entra', () => {
    const precos = precosDe(['provedor-de-reserva', 'modelo-da-reserva'])
    expect(recusa({ LLM_RESERVA_MODELO_RAPIDO: 'rapido-sem-preco', LLM_RESERVA_MODELO_VISAO: 'visao-sem-preco' }, precos)).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO_RAPIDO', 'LLM_RESERVA_MODELO_VISAO'], motivos: [MOTIVO_MODELO_DA_RESERVA_SEM_PRECO] })
    // O comum sem preço e um perfil com preço: o comum ainda atende os outros três, e é o único citado.
    expect(recusa({ LLM_RESERVA_MODELO_RAPIDO: 'rapido-com-preco' }, precosDe(['provedor-de-reserva', 'rapido-com-preco']))).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO'] })
    expect(() => subir({ LLM_RESERVA_MODELO_RAPIDO: 'rapido-com-preco' }, precosDe(['provedor-de-reserva', 'modelo-da-reserva'], ['provedor-de-reserva', 'rapido-com-preco']))).not.toThrow()
  })

  it('o preço é da identidade da reserva: o preço do mesmo modelo no principal, ou em outro provedor, não vale', () => {
    expect(recusa({}, precosDe(['provedor-de-teste', 'modelo-da-reserva']))).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO'] })
    expect(recusa({}, precosDe(['outro-provedor', 'modelo-da-reserva']))).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO'] })
  })

  it('o staging também exige, e o `local` dispensa; a reserva falsa não exige preço (o dela é zero em `PRECO_DOS_MODELOS`)', () => {
    expect(recusa({ AMBIENTE: 'staging' }, precosDe())).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO'] })
    expect(() => subir({ AMBIENTE: 'local' }, precosDe())).not.toThrow()
    expect(() => subir({ AMBIENTE: 'staging', IA_RESERVA_ADAPTADOR: 'falso', LLM_RESERVA_BASE_URL: undefined, LLM_RESERVA_MODELO: undefined, IA_RESERVA_PROVEDOR_ID: undefined }, precosDe())).not.toThrow()
  })

  it('o principal, o menor e a reserva sem preço juntos: as três variáveis e os três motivos, em ordem', () => {
    const erro = recusa({ LLM_MODELO: 'modelo-sem-preco', LLM_MODELO_MENOR_PADRAO: 'menor-sem-preco' }, {})
    expect(erro).toMatchObject({ variaveis: ['LLM_MODELO', 'LLM_MODELO_MENOR_PADRAO', 'LLM_RESERVA_MODELO'], motivos: [MOTIVO_MODELO_SEM_PRECO, MOTIVO_MODELO_MENOR_SEM_PRECO, MOTIVO_MODELO_DA_RESERVA_SEM_PRECO] })
  })

  it('sem reserva configurada a subida é a de antes: o principal com preço sobe, sem exigir nada da reserva', () => {
    expect(() => subir({ IA_RESERVA_ADAPTADOR: undefined, LLM_RESERVA_BASE_URL: undefined, IA_RESERVA_PROVEDOR_ID: undefined, LLM_RESERVA_TOKENS_POR_MINUTO: undefined, LLM_RESERVA_MODELO: undefined }, precosDe())).not.toThrow()
  })
})

describe('a identidade do adaptador: a reserva falsa é outro provedor para o balde, o rótulo, o disjuntor e o preço (reserva-e-avaliacao, 1.0)', () => {
  const TOKENS = { entrada: 100, saida: 20 }
  const CONFIG: LLMConfig = { adaptador: 'falso', prazosMs: PRAZOS, recuoMs: 100, replicas: 1, tokensFalsos: TOKENS, reserva: { adaptador: 'falso', identidade: 'falso-reserva', ambiente: 'local' } }
  const PRECO = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste', entradaMicrosPorMilTokens: 1_000, saidaMicrosPorMilTokens: 1_000 }
  /** Os dois falsos têm o mesmo modelo, e o preço que o teste injeta é diferente para cada identidade. */
  const PRECOS: TabelaDePrecos = {
    [chaveDoPreco('falso', MODELO_FALSO)]: [PRECO],
    [chaveDoPreco('falso-reserva', MODELO_FALSO)]: [{ ...PRECO, entradaMicrosPorMilTokens: 2_000, saidaMicrosPorMilTokens: 2_000 }],
  }

  /** Uma chamada da ferramenta por um gateway cujo único adaptador é o dado, com o limitador, as métricas e os preços do teste. */
  async function chamarCom(adaptador: ModelAdapter) {
    const leitor = new MedidorDeTeste()
    const limite = new LimiteDeMentira()
    const resiliente = new ResilientAdapter(adaptador, { prazosMs: PRAZOS, recuoMs: 100, aleatorio: () => 1, medidor: leitor.medidor })
    const { ia, consumo } = montar({ adaptador: resiliente, limiteDeTokens: limite, medidor: leitor.medidor, precos: PRECOS })
    const { medicao } = await ia.generate(pedidoDaFerramenta())
    const provedorDe = async (metrica: string): Promise<unknown[]> => (await leitor.pontos(metrica)).map((ponto) => ponto.atributos['provedor'])
    const lido = { baldes: limite.modelosPedidos, duracao: await provedorDe(METRICS.duracaoDaChamadaDeIa), disjuntor: await provedorDe(METRICS.disjuntorDeIaAberto), linhas: consumo.registros, medicao }
    await leitor.encerrar()
    return lido
  }

  it('o balde, o rótulo `provedor` das medidas, o disjuntor e a chave do preço são os do falso do principal: `falso`', async () => {
    const lido = await chamarCom(new FakeAdapter({ tokens: TOKENS }))
    expect(lido.baldes).toEqual([`falso:${MODELO_FALSO}`])
    expect(lido.duracao).toEqual(['falso'])
    expect(lido.disjuntor).toEqual(['falso'])
    // (100 × 1.000 + 20 × 1.000) ÷ 1.000: o preço da chave `falso:falso-deterministico`.
    expect(lido.linhas).toMatchObject([{ envioExterno: false, provedorId: null, custoMicros: 120 }])
  })

  it('o mesmo falso com a identidade da reserva: tudo é `falso-reserva`, o preço é o dela, e na linha o provedor continua nulo (nada saiu)', async () => {
    const reserva = adaptadorDaReserva(CONFIG)
    if (reserva === undefined) throw new Error('a reserva deveria ter sido montada')
    expect(reserva.modeloDoPerfil('padrao')).toBe(MODELO_FALSO)
    const lido = await chamarCom(reserva)
    expect(lido.baldes).toEqual([`falso-reserva:${MODELO_FALSO}`])
    expect(lido.duracao).toEqual(['falso-reserva'])
    expect(lido.disjuntor).toEqual(['falso-reserva'])
    expect(lido.linhas).toMatchObject([{ envioExterno: false, provedorId: null, custoMicros: 240 }])
    expect(lido.medicao).toMatchObject({ origem: 'falso', envioExterno: false, provedorId: null })
  })

  it('cada identidade lê o preço da chave dela: sem o preço da reserva falsa na tabela, a linha dela sai sem custo, e a do principal não muda', async () => {
    const reserva = adaptadorDaReserva(CONFIG)
    if (reserva === undefined) throw new Error('a reserva deveria ter sido montada')
    const { ia, consumo } = montar({ adaptador: reserva, precos: { [chaveDoPreco('falso', MODELO_FALSO)]: [PRECO] } })
    await ia.generate(pedidoDaFerramenta())
    expect(consumo.registros).toMatchObject([{ custoMicros: 0 }])
  })

  it('o falso da reserva está em `PRECO_DOS_MODELOS`, com preço zero, e o gateway real o usa', async () => {
    const reserva = adaptadorDaReserva(CONFIG)
    if (reserva === undefined) throw new Error('a reserva deveria ter sido montada')
    expect(precoDoModelo(chaveDoPreco('falso-reserva', MODELO_FALSO), new Date('2026-11-22T12:00:00Z'))).toMatchObject({ entradaMicrosPorMilTokens: 0, saidaMicrosPorMilTokens: 0 })
    const { ia, consumo } = montar({ adaptador: reserva })
    await ia.generate(pedidoDaFerramenta())
    expect(consumo.registros).toMatchObject([{ envioExterno: false, provedorId: null, custoMicros: 0 }])
  })

  it('o balde e a linha do adaptador com envio externo leem a identidade de cada instância, e não um provedor fixo', async () => {
    const limite = new LimiteDeMentira()
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()], true, 'provedor-a'), limiteDeTokens: limite })
    await ia.generate(pedidoDaFerramenta())
    expect(limite.modelosPedidos).toEqual(['provedor-a:roteirizado-padrao'])
    expect(consumo.registros).toMatchObject([{ envioExterno: true, provedorId: 'provedor-a' }])
    // O `provedorId` por instância: duas bancadas com o mesmo modelo e provedores diferentes têm baldes e linhas diferentes.
    const outro = new LimiteDeMentira()
    const segunda = montar({ adaptador: new ScriptedAdapter([saidaDeAtividade()], true, 'provedor-b'), limiteDeTokens: outro })
    await segunda.ia.generate(pedidoDaFerramenta())
    expect(outro.modelosPedidos).toEqual(['provedor-b:roteirizado-padrao'])
    expect(segunda.consumo.registros).toMatchObject([{ provedorId: 'provedor-b' }])
  })

  it('o adaptador da reserva: nenhum sem configuração, o falso com a identidade dela, e o `openai_compat` com o endereço, o modelo de cada perfil e o provedor dela', () => {
    expect(adaptadorDaReserva({ adaptador: 'falso', prazosMs: PRAZOS, recuoMs: 100, replicas: 1 })).toBeUndefined()
    expect(adaptadorDaReserva(CONFIG)).toMatchObject({ origem: 'falso', identidade: 'falso-reserva', envio: { envioExterno: false, provedorId: null } })
    const configuracao = loadLLMConfig({
      AMBIENTE: 'local',
      IA_RESERVA_ADAPTADOR: 'openai_compat',
      LLM_RESERVA_BASE_URL: 'https://reserva.provedor.example/v1',
      IA_RESERVA_PROVEDOR_ID: 'provedor-de-reserva',
      LLM_RESERVA_MODELO: 'modelo-da-reserva',
      LLM_RESERVA_MODELO_RAPIDO: 'rapido-da-reserva',
    })
    const reserva = adaptadorDaReserva(configuracao)
    expect(reserva).toBeInstanceOf(OpenAICompatAdapter)
    expect(reserva).toMatchObject({ origem: 'openai_compat', identidade: 'provedor-de-reserva', envio: { envioExterno: true, provedorId: 'provedor-de-reserva' } })
    expect(reserva?.modeloDoPerfil('rapido')).toBe('rapido-da-reserva')
    expect(reserva?.modeloDoPerfil('padrao')).toBe('modelo-da-reserva')
    // O principal da mesma configuração segue falso, com a identidade de sempre.
    expect(destinoDoAdaptador(configuracao)).toMatchObject({ origem: 'falso', identidade: 'falso' })
  })

  it('a reserva falsa herda do falso a espera e os tokens que ele informa, e só leva a identidade a mais', async () => {
    const reserva = adaptadorDaReserva({ ...CONFIG, latenciaFalsaMs: 0, tokensFalsos: { entrada: 7, saida: 3 } })
    if (reserva === undefined) throw new Error('a reserva deveria ter sido montada')
    const resposta = await reserva.chamar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), sinal: new AbortController().signal })
    expect(resposta).toMatchObject({ modelo: MODELO_FALSO, tokensDeEntrada: 7, tokensDeSaida: 3 })
  })

  it('a reserva falsa herda a espera simulada, a geral e a do `padrao`: a chamada que passa do sinal termina com o prazo esgotado, e sem espera responde', async () => {
    for (const espera of [{ latenciaFalsaMs: 5_000 }, { latenciaFalsaMsPadrao: 5_000 }]) {
      const reserva = adaptadorDaReserva({ ...CONFIG, ...espera })
      if (reserva === undefined) throw new Error('a reserva deveria ter sido montada')
      const chamada = reserva.chamar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), sinal: AbortSignal.timeout(50) })
      await expect(chamada, JSON.stringify(espera)).rejects.toMatchObject({ codigoDeIa: 'IA_TEMPO_ESGOTADO' })
    }
    const semEspera = adaptadorDaReserva(CONFIG)
    await expect(semEspera?.chamar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), sinal: AbortSignal.timeout(50) })).resolves.toMatchObject({ modelo: MODELO_FALSO })
  })
})

describe('LLMGateway: a causa da falha atravessa o `ResilientAdapter` (reserva-e-avaliacao, 3.0; RF3; regra 80, item 4; D14)', () => {
  /** 100 de entrada e 20 de saída por chamada que volta; o principal a 1.300 e 5.200 micros por mil, o menor a 300 e 1.200 (54 por chamada que volta). */
  const ANTIGO = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste', entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }
  const PRECOS: TabelaDePrecos = {
    [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'roteirizado-padrao')]: [ANTIGO],
    [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'menor-padrao')]: [{ ...ANTIGO, entradaMicrosPorMilTokens: 300, saidaMicrosPorMilTokens: 1_200 }],
    [chaveDoPreco(PROVEDOR_ROTEIRIZADO, 'roteirizado-rapido')]: [ANTIGO],
  }
  const tokensEstimadosDaFerramenta = () => ({ tokensDeEntrada: tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()), tokensDeSaida: gerarAtividadeObjetiva.maximoDeTokensDeSaida })
  const limiteDoProvedor = (retryAfter?: number) => new ProviderError('limite', retryAfter)

  /** O `ResilientAdapter` real, com recuo de 1 ms (relógio real), sobre o adaptador roteirizado que lança o `ProviderError` de verdade. */
  function resiliente(roteiro: readonly (string | Error)[]) {
    const interno = new ScriptedAdapter(roteiro)
    return { interno, adaptador: new ResilientAdapter(interno, { prazosMs: PRAZOS, recuoMs: 1, aleatorio: () => 1 }) }
  }

  it('`limite` no principal, tarefa com menor: vai ao menor; as linhas, na ordem: a estimada do principal (`envio_externo`, o provedor) e a do menor', async () => {
    const leitor = new MedidorDeTeste()
    const limite = new LimiteDeMentira()
    // O 429 duas vezes (a chamada e a única repetição do `ResilientAdapter`), e depois o menor responde.
    const { interno, adaptador } = resiliente([limiteDoProvedor(), limiteDoProvedor(), saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, precos: PRECOS, medidor: leitor.medidor })
    const { medicao } = await ia.generate(pedidoDaFerramenta())
    expect(interno.modelosPedidos).toEqual([undefined, undefined, 'menor-padrao'])
    expect(limite.modelosPedidos).toEqual([PRINCIPAL_DO_PADRAO, MENOR_DO_PADRAO])
    expect(medicao.modelo).toBe('menor-padrao')
    expect(consumo.registros).toMatchObject([
      { modelo: 'roteirizado-padrao', estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO, ...tokensEstimadosDaFerramenta(), custoMicros: custoDaChamada(tokensEstimadosDaFerramenta(), ANTIGO) },
      { modelo: 'menor-padrao', estado: 'concluida', tokensDeEntrada: 100, tokensDeSaida: 20, custoMicros: 54, envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO },
    ])
    // O menor reservou a estimativa do pedido, na fila dele, e acertou pelo uso real; o balde do principal ficou como estava.
    expect(limite.pedidos[1]).toEqual({ modelo: MENOR_DO_PADRAO, estimativa: tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()) + gerarAtividadeObjetiva.maximoDeTokensDeSaida, fila: 'ferramenta' })
    expect(limite.acertosPorModelo).toEqual({ [MENOR_DO_PADRAO]: [120] })
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'espera')).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(1)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(0)
    await leitor.encerrar()
  })

  it('o `limite` com `Retry-After` além do prazo também desce ao menor, sem repetir o principal', async () => {
    const limite = new LimiteDeMentira()
    const { interno, adaptador } = resiliente([limiteDoProvedor(90), saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, precos: PRECOS })
    // Sem fila no pedido: o balde do menor é o da `normal`, como o do principal.
    await ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    expect(interno.modelosPedidos).toEqual([undefined, 'menor-padrao'])
    expect(limite.pedidos.map((pedido) => [pedido.modelo, pedido.fila])).toEqual([[PRINCIPAL_DO_PADRAO, 'normal'], [MENOR_DO_PADRAO, 'normal']])
    expect(consumo.registros).toMatchObject([{ modelo: 'roteirizado-padrao', estado: 'falhou' }, { modelo: 'menor-padrao', estado: 'concluida' }])
  })

  it('o balde do principal cheio, sem menor para o perfil: o log do degrau diz o modelo do principal, e o do `limite` também', async () => {
    vi.useFakeTimers()
    try {
      const logger = registrador()
      const limite = new LimiteDeMentira()
      limite.fechados.add(PRINCIPAL_DO_PADRAO)
      const cheio = montar({ adaptador: new ScriptedAdapter([]), limiteDeTokens: limite, modelosMenores: { rapido: 'menor-rapido' }, logger })
      const resultado = erroDe(cheio.ia.generate(pedidoDaFerramenta()))
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
      expect((await resultado).motivo).toBe('sem_vaga')
      expect(logger.linhas()).toContainEqual({ evento: 'ia.geracao.sem_vaga', tipo: 'gerar_atividade_objetiva', modeloId: 'roteirizado-padrao', codigo: 'IA_INDISPONIVEL' })
    } finally {
      vi.useRealTimers()
    }
    const doLimite = registrador()
    const { adaptador } = resiliente([limiteDoProvedor(90)])
    const semMenor = montar({ adaptador, limiteDeTokens: new LimiteDeMentira(), modelosMenores: { rapido: 'menor-rapido' }, logger: doLimite })
    await erroDe(semMenor.ia.generate(pedidoDaFerramenta()))
    expect(doLimite.linhas()).toContainEqual({ evento: 'ia.geracao.sem_vaga', tipo: 'gerar_atividade_objetiva', modeloId: 'roteirizado-padrao', codigo: 'IA_INDISPONIVEL' })
  })

  it('`limite` sem menor para o perfil: termina `IA_INDISPONIVEL` com `limite`, a espera que o provedor deu, a linha estimada e o degrau `indisponivel`; não é `semEnvio`', async () => {
    const leitor = new MedidorDeTeste()
    const limite = new LimiteDeMentira()
    const { interno, adaptador } = resiliente([limiteDoProvedor(90)])
    // Só o `rapido` tem menor: a ferramenta, que é do `padrao`, não tem.
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: { rapido: 'menor-rapido' }, precos: PRECOS, medidor: leitor.medidor })
    const erro = await erroDe(ia.generate(pedidoDaFerramenta()))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite', semEnvio: false, tenteDeNovoEmSegundos: 90 })
    expect(interno.chamadas).toBe(1)
    expect(limite.modelosPedidos).toEqual([PRINCIPAL_DO_PADRAO])
    expect(consumo.registros).toMatchObject([{ modelo: 'roteirizado-padrao', estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO, ...tokensEstimadosDaFerramenta() }])
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor')).toBe(0)
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel')).toBe(1)
    await leitor.encerrar()
  })

  it('o menor também sem vaga (o balde dele cheio): termina `IA_INDISPONIVEL` com `limite`, e só a linha do principal', async () => {
    const limite = new LimiteDeMentira()
    limite.fechados.add(MENOR_DO_PADRAO)
    const { interno, adaptador } = resiliente([limiteDoProvedor(90)])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, precos: PRECOS })
    const erro = await erroDe(ia.generate(pedidoDaFerramenta()))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite', semEnvio: false })
    expect(interno.chamadas).toBe(1)
    expect(limite.modelosPedidos).toEqual([PRINCIPAL_DO_PADRAO, MENOR_DO_PADRAO])
    expect(consumo.registros).toHaveLength(1)
  })

  it('o menor que também recusa por limite: termina `IA_INDISPONIVEL`, sem terceira chamada, com as duas linhas estimadas, cada uma no preço do seu modelo', async () => {
    const { interno, adaptador } = resiliente([limiteDoProvedor(90), limiteDoProvedor(90)])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: new LimiteDeMentira(), modelosMenores: MENORES, precos: PRECOS })
    const erro = await erroDe(ia.generate(pedidoDaFerramenta()))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
    expect(interno.modelosPedidos).toEqual([undefined, 'menor-padrao'])
    const tokens = tokensEstimadosDaFerramenta()
    expect(consumo.registros).toMatchObject([
      { modelo: 'roteirizado-padrao', custoMicros: custoDaChamada(tokens, ANTIGO), ...tokens },
      { modelo: 'menor-padrao', custoMicros: custoDaChamada(tokens, { ...ANTIGO, entradaMicrosPorMilTokens: 300, saidaMicrosPorMilTokens: 1_200 }), ...tokens },
    ])
  })

  it('o `limite` do menor, que já era o modelo da chamada (o principal esperou 8 s sem vaga): não desce de novo, e termina com `limite`', async () => {
    vi.useFakeTimers()
    try {
      const limite = new LimiteDeMentira()
      limite.fechados.add(PRINCIPAL_DO_PADRAO)
      const { interno, adaptador } = resiliente([limiteDoProvedor(90)])
      const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, precos: PRECOS })
      const resultado = erroDe(ia.generate(pedidoDaFerramenta()))
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_DA_VAGA_MS)
      expect(await resultado).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
      expect(interno.modelosPedidos).toEqual(['menor-padrao'])
      expect(limite.modelosPedidos.filter((modelo) => modelo === MENOR_DO_PADRAO)).toHaveLength(1)
      expect(consumo.registros).toMatchObject([{ modelo: 'menor-padrao', estado: 'falhou' }])
    } finally {
      vi.useRealTimers()
    }
  })

  it('o sinal de quem chamou é o da chamada ao adaptador, e sem sinal a chamada leva um que não está abortado', async () => {
    const sinais: AbortSignal[] = []
    class GuardaOSinal extends ScriptedAdapter {
      override async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
        sinais.push(chamada.sinal)
        return super.chamar(chamada)
      }
    }
    const { ia } = montar({ adaptador: new GuardaOSinal([saidaDeAtividade(), saidaDeAtividade()]) })
    const controle = new AbortController()
    await ia.generate({ ...pedidoDaFerramenta(), sinal: controle.signal })
    await ia.generate(pedidoDaFerramenta())
    expect(sinais[0]).toBe(controle.signal)
    expect(sinais[1]?.aborted).toBe(false)
  })

  it('o sinal de quem chamou é também o da chamada ao menor: o prazo único da execução cancela as duas', async () => {
    const sinais: AbortSignal[] = []
    class GuardaOSinal extends ScriptedAdapter {
      override async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
        sinais.push(chamada.sinal)
        return super.chamar(chamada)
      }
    }
    // O principal devolve o `limite` já traduzido; o menor responde.
    const { ia } = montar({ adaptador: new GuardaOSinal([new LLMError('IA_INDISPONIVEL', 90, 'limite'), saidaDeAtividade()]), limiteDeTokens: new LimiteDeMentira(), modelosMenores: MENORES })
    const controle = new AbortController()
    await ia.generate({ ...pedidoDaFerramenta(), sinal: controle.signal })
    expect(sinais).toHaveLength(2)
    expect(sinais[0]).toBe(controle.signal)
    expect(sinais[1]).toBe(controle.signal)
  })

  it('a duração da linha do menor é a da chamada dele, e não inclui o 429 do principal', async () => {
    // O relógio de `performance.now()` é do teste: o principal gasta 500 ms até o 429 e o menor 7 ms.
    let agora = 0
    const relogio = vi.spyOn(performance, 'now').mockImplementation(() => agora)
    try {
      const passos = [500, 7]
      class GastaTempo extends ScriptedAdapter {
        override async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
          agora += passos.shift() ?? 0
          return super.chamar(chamada)
        }
      }
      const { ia, consumo } = montar({ adaptador: new GastaTempo([new LLMError('IA_INDISPONIVEL', 90, 'limite'), saidaDeAtividade()]), limiteDeTokens: new LimiteDeMentira(), modelosMenores: MENORES })
      await ia.generate(pedidoDaFerramenta())
      expect(consumo.registros.map((registro) => [registro.modelo, registro.duracaoMs])).toEqual([['roteirizado-padrao', 500], ['menor-padrao', 7]])
    } finally {
      relogio.mockRestore()
    }
  })

  it('sem limitador configurado não há degrau: o `limite` termina como veio, com a linha estimada', async () => {
    const { interno, adaptador } = resiliente([limiteDoProvedor(90)])
    const { ia, consumo } = montar({ adaptador, modelosMenores: MENORES, precos: PRECOS })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
    expect(interno.chamadas).toBe(1)
    expect(consumo.registros).toHaveLength(1)
  })

  it('o `limite` do Tutor e da classificação, com `modelosMenores` configurado para o `rapido`, não vai ao menor (D36): termina `IA_INDISPONIVEL`', async () => {
    const entradaDaClassificacao = {
      candidatas: [{ codigo: 'EF07MA01', descricao: 'Resolver problemas com números naturais, inteiros e racionais.' }],
      secoes: [{ secaoId: '0190f5a0-0000-7000-8000-0000000000a1', titulo: 'Capítulo', comeco: 'Texto do começo.', subtitulos: 'Subtítulo' }],
    }
    type Ia = ReturnType<typeof montar>['ia']
    const pedidos: { rotulo: string; gerar: (ia: Ia) => Promise<unknown> }[] = [
      { rotulo: 'o Tutor', gerar: (ia) => ia.generate({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId: ESCOLA_A, alunoId: ALUNO_1, execucaoId: EXECUCAO, fila: 'interativa' }) },
      { rotulo: 'a classificação', gerar: (ia) => ia.generate({ tarefa: classificarSecoes, entrada: entradaDaClassificacao, escolaId: ESCOLA_A, execucaoId: EXECUCAO, fila: 'lote' }) },
    ]
    for (const { rotulo, gerar } of pedidos) {
      const leitor = new MedidorDeTeste()
      const limite = new LimiteDeMentira()
      const { interno, adaptador } = resiliente([limiteDoProvedor(90)])
      const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, soberania: CONFERIDA, medidor: leitor.medidor })
      const erro = await erroDe(gerar(ia))
      expect(erro, rotulo).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
      expect(interno.modelosPedidos, rotulo).toEqual([undefined])
      expect(limite.modelosPedidos, rotulo).toEqual([PRINCIPAL_DO_RAPIDO])
      // A chamada saiu: a linha dela fica, mesmo no lote, que só adia sem linha a chamada que não saiu.
      expect(consumo.registros, rotulo).toHaveLength(1)
      expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'modelo_menor'), rotulo).toBe(0)
      expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'indisponivel'), rotulo).toBe(1)
      await leitor.encerrar()
    }
  })

  it('`rejeitada` (o 401 e o 403 do servidor, em `resilient-adapter.test.ts`) no principal, com menor disponível: não vai ao menor; termina `IA_INDISPONIVEL`, sem degrau e sem repetir', async () => {
    const leitor = new MedidorDeTeste()
    const limite = new LimiteDeMentira()
    const { interno, adaptador } = resiliente([new ProviderError('rejeitada'), saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador, limiteDeTokens: limite, modelosMenores: MENORES, precos: PRECOS, medidor: leitor.medidor })
    const erro = await erroDe(ia.generate(pedidoDaFerramenta()))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'rejeitada', semEnvio: false })
    expect(interno.modelosPedidos).toEqual([undefined])
    expect(limite.modelosPedidos).toEqual([PRINCIPAL_DO_PADRAO])
    // O pedido chegou ao provedor: a linha leva a estimativa e o provedor.
    expect(consumo.registros).toMatchObject([{ modelo: 'roteirizado-padrao', estado: 'falhou', envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO, ...tokensEstimadosDaFerramenta() }])
    for (const degrau of ['espera', 'modelo_menor', 'indisponivel']) expect(await valorDe(leitor, 'ia.degradacao', 'degrau', degrau), degrau).toBe(0)
    await leitor.encerrar()
  })

  describe('o 429 que sobra e a conexão recusada gravam a estimativa, pelo `ResilientAdapter` com o servidor falso (TODO.md, camada-ia, validação)', () => {
    let servidor: FakeLlamaServer | undefined
    afterEach(async () => {
      await servidor?.fechar()
      servidor = undefined
    })
    const PROVEDOR = 'provedor-de-teste'
    const MODELOS = { rapido: 'm-rapido', padrao: 'm-padrao', complexo: 'm-complexo', visao: 'm-visao' } as const
    const PRECOS_DO_SERVIDOR: TabelaDePrecos = { [chaveDoPreco(PROVEDOR, 'm-padrao')]: [ANTIGO] }

    async function gerarContra(baseUrl: string) {
      const adaptador = new ResilientAdapter(new OpenAICompatAdapter({ baseUrl, modelos: MODELOS, processamentoLocal: false, provedorId: PROVEDOR }), { prazosMs: PRAZOS, recuoMs: 5, aleatorio: () => 1 })
      const { ia, consumo } = montar({ adaptador, precos: PRECOS_DO_SERVIDOR })
      const erro = await erroDe(ia.generate(pedido()))
      return { erro, consumo }
    }
    const pedido = () => ({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO })

    it('429 que sobra da repetição: uma linha, com a entrada contada, a saída no teto, o custo disso e o provedor', async () => {
      servidor = await startFakeLlamaServer(() => ({ status: 429, corpo: {} }))
      const { erro, consumo } = await gerarContra(servidor.url)
      expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
      expect(servidor.pedidos).toHaveLength(2)
      const tokens = tokensEstimadosDaFerramenta()
      expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', modelo: 'm-padrao', envioExterno: true, provedorId: PROVEDOR, ...tokens, custoMicros: custoDaChamada(tokens, ANTIGO) }])
      expect(consumo.registros[0]?.custoMicros).toBeGreaterThan(0)
    })

    it('conexão recusada: a mesma linha estimada, com o provedor', async () => {
      servidor = await startFakeLlamaServer(() => ({ corpo: {} }))
      const { url } = servidor
      await servidor.fechar()
      servidor = undefined
      const { erro, consumo } = await gerarContra(url)
      expect(erro).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: undefined, semEnvio: false })
      const tokens = tokensEstimadosDaFerramenta()
      expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', modelo: 'm-padrao', envioExterno: true, provedorId: PROVEDOR, ...tokens, custoMicros: custoDaChamada(tokens, ANTIGO) }])
      expect(consumo.registros[0]?.custoMicros).toBeGreaterThan(0)
    })
  })
})

describe('LLMGateway: a queda do principal vai ao provedor de reserva, e cada chamada leva o seu destino (reserva-e-avaliacao, 4.0; RF2 a RF5; regra 80, item 4; D14)', () => {
  const PRINCIPAL = 'principal-x'
  const RESERVA = 'reserva-y'
  /** 100 de entrada e 20 de saída por chamada que volta. O principal a 1.300 e 5.200 micros por mil; a reserva, a 2.000 e 8.000, e com outro modelo: dois preços, dois provedores e dois modelos diferentes. */
  const PRECO_DO_PRINCIPAL = { vigenteDesde: '2026-01-01T00:00:00Z', fonte: 'tabela do teste', entradaMicrosPorMilTokens: 1_300, saidaMicrosPorMilTokens: 5_200 }
  const PRECO_DA_RESERVA = { ...PRECO_DO_PRINCIPAL, entradaMicrosPorMilTokens: 2_000, saidaMicrosPorMilTokens: 8_000 }
  const PRECOS: TabelaDePrecos = {
    [chaveDoPreco(PRINCIPAL, 'roteirizado-padrao')]: [PRECO_DO_PRINCIPAL],
    [chaveDoPreco(RESERVA, 'reserva-padrao')]: [PRECO_DA_RESERVA],
  }
  const tokensEstimadosDaFerramenta = () => ({ tokensDeEntrada: tokensDoPedido(gerarAtividadeObjetiva, entradaDeAtividade()), tokensDeSaida: gerarAtividadeObjetiva.maximoDeTokensDeSaida })

  /** A reserva tem outro modelo em cada perfil (`reserva-<perfil>`), ou o que o teste fixa: é o modelo que a aprovação confere. */
  class ReservaRoteirizada extends ScriptedAdapter {
    constructor(
      roteiro: readonly (string | Error)[],
      private readonly modelos: Partial<Record<Perfil, string>> = {},
      provedorId = RESERVA,
    ) {
      super(roteiro, true, provedorId)
    }

    override modeloDoPerfil(perfil: Perfil): string {
      return this.modelos[perfil] ?? `reserva-${perfil}`
    }
  }

  /** O principal que só cai para o pedido de um tema, e que segura as duas chamadas até as duas chegarem: as duas execuções estão no ar ao mesmo tempo. */
  class PrincipalPorTema extends ScriptedAdapter {
    private chegadas = 0
    private largar: () => void = () => undefined
    private readonly largada = new Promise<void>((resolver) => (this.largar = resolver))

    constructor(private readonly temaQueCai: string) {
      super([], true, PRINCIPAL)
    }

    override async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
      this.chegadas += 1
      if (this.chegadas === 2) this.largar()
      await this.largada
      if (JSON.stringify(chamada.entrada).includes(this.temaQueCai)) throw new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor')
      return { texto: saidaDeAtividade(), modelo: this.modeloDoPerfil(chamada.tarefa.perfil), tokensDeEntrada: 100, tokensDeSaida: 20 }
    }
  }

  const aprovada = (tarefa: TarefaDeIa, modelo: string, provedorId = RESERVA): ModeloAprovado => ({ tarefa, provedorId, modelo, relatorio: 'docs/avaliacao/teste/relatorio.md', sha256: 'sha-do-teste', aprovadoPor: 'teste', aprovadoEm: '2026-11-22' })
  const daReserva = (adaptador: ModelAdapter, aprovados: readonly ModeloAprovado[]): NonNullable<LLMGatewayDependencies['reserva']> => ({ adaptador, ambiente: 'local', aprovados })
  const APROVADA_A_GERACAO = [aprovada('gerar_atividade_objetiva', 'reserva-padrao')]
  const disjuntor = () => new LLMError('IA_INDISPONIVEL', undefined, 'disjuntor')
  const principalRoteirizado = (roteiro: readonly (string | Error)[]) => new ScriptedAdapter(roteiro, true, PRINCIPAL)
  /** O `ResilientAdapter` real, com recuo de 1 ms, sobre o adaptador roteirizado que lança o `ProviderError` de verdade. */
  const resiliente = (interno: ModelAdapter) => new ResilientAdapter(interno, { prazosMs: PRAZOS, recuoMs: 1, aleatorio: () => 1 })
  const entradaDaClassificacao = {
    candidatas: [{ codigo: 'EF07MA01', descricao: 'Resolver problemas com números naturais, inteiros e racionais.' }],
    secoes: [{ secaoId: '0190f5a0-0000-7000-8000-0000000000a1', titulo: 'Capítulo', comeco: 'Texto do começo.', subtitulos: 'Subtítulo' }],
  }
  const pedidoDoTutor = (duvida = 'não entendi o reagente limitante') => ({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1, execucaoId: EXECUCAO, fila: 'interativa' as const })
  const respostaDoTutor = () => JSON.stringify(turnoDoTutor.falso(entradaDoTutor('não entendi o reagente limitante')))
  type Ia = ReturnType<typeof montar>['ia']

  it('disjuntor do principal aberto: a saída e a única linha são da reserva, e o degrau `provedor_de_reserva` nasce em 0 e soma 1', async () => {
    const leitor = new MedidorDeTeste()
    const principal = principalRoteirizado([disjuntor()])
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, medidor: leitor.medidor })
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'provedor_de_reserva')).toBe(0)
    const { saida } = await ia.generate(pedidoDaFerramenta())
    expect(saida).toEqual(atividadeDeEstequiometria())
    expect([principal.chamadas, reserva.chamadas]).toEqual([1, 1])
    // O disjuntor aberto não deixou a chamada sair: o principal não tem linha. A da reserva é a única, e é dela.
    expect(consumo.registros).toHaveLength(1)
    expect(consumo.registros).toMatchObject([{ estado: 'concluida', modelo: 'reserva-padrao', envioExterno: true, provedorId: RESERVA, peloProvedorDeReserva: true }])
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'provedor_de_reserva')).toBe(1)
    for (const degrau of ['espera', 'modelo_menor', 'indisponivel']) expect(await valorDe(leitor, 'ia.degradacao', 'degrau', degrau), degrau).toBe(0)
    await leitor.encerrar()
  })

  it.each([
    { causa: 'o 5xx do servidor', principal: () => principalRoteirizado([new LLMError('IA_INDISPONIVEL')]) },
    { causa: 'a conexão recusada, depois da única repetição do `ResilientAdapter`', principal: () => resiliente(principalRoteirizado([new ProviderError('recusada'), new ProviderError('recusada')])) },
  ])('$causa: vai à reserva; o principal deixa a linha estimada (a chamada pode ter saído) e a reserva, a dela', async ({ principal }) => {
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principal(), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    await ia.generate(pedidoDaFerramenta())
    expect(reserva.chamadas).toBe(1)
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', provedorId: PRINCIPAL, peloProvedorDeReserva: false },
      { estado: 'concluida', provedorId: RESERVA, peloProvedorDeReserva: true },
    ])
  })

  it('o prazo estourado com o sinal da execução vivo vai à reserva; com o sinal já abortado, não vai', async () => {
    const vivo = new ReservaRoteirizada([saidaDeAtividade()])
    const noVivo = montar({ adaptador: principalRoteirizado([new LLMError('IA_TEMPO_ESGOTADO')]), reserva: daReserva(vivo, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    await noVivo.ia.generate({ ...pedidoDaFerramenta(), sinal: new AbortController().signal })
    expect(vivo.chamadas).toBe(1)

    // O prazo único da execução cortou: o sinal aborta enquanto o principal responde `IA_TEMPO_ESGOTADO`. A execução que estourou o prazo não segue gastando na reserva.
    const controle = new AbortController()
    class AbortaEFalha extends ScriptedAdapter {
      override async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
        controle.abort()
        return super.chamar(chamada)
      }
    }
    const abortado = new ReservaRoteirizada([saidaDeAtividade()])
    const noAbortado = montar({ adaptador: new AbortaEFalha([new LLMError('IA_TEMPO_ESGOTADO')], true, PRINCIPAL), reserva: daReserva(abortado, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(noAbortado.ia.generate({ ...pedidoDaFerramenta(), sinal: controle.signal }))).toMatchObject({ codigoDeIa: 'IA_TEMPO_ESGOTADO' })
    expect(abortado.chamadas).toBe(0)
  })

  it('`rejeitada` (o 401 de chave revogada) com reserva elegível: não é queda, e termina `IA_INDISPONIVEL` sem chamar a reserva', async () => {
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: resiliente(principalRoteirizado([new ProviderError('rejeitada')])), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'rejeitada' })
    expect(reserva.chamadas).toBe(0)
    expect(consumo.registros).toMatchObject([{ provedorId: PRINCIPAL, peloProvedorDeReserva: false }])
  })

  it('função suspensa e principal fora: a suspensão vem antes, e nenhum dos dois provedores é chamado', async () => {
    const suspensao = new InMemorySuspensoes()
    suspensao.suspender(ESCOLA_A, 'conversa_e_ferramentas')
    const principal = principalRoteirizado([disjuntor()])
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principal, suspensao, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'FUNCAO_SUSPENSA' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([0, 0])
    expect(consumo.registros).toEqual([])
  })

  it('aprovação só da geração, principal fora: a geração vai à reserva, o Tutor não, e a mensagem da D36 sai pela regra fixa, sem provedor nenhum', async () => {
    const principal = principalRoteirizado([disjuntor(), disjuntor()])
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, soberania: CONFERIDA })
    await ia.generate(pedidoDaFerramenta())
    expect(reserva.chamadas).toBe(1)
    // O Tutor não está aprovado para a reserva: o principal fora é indisponível, e a reserva não recebe o texto do aluno.
    expect(await erroDe(ia.generate(pedidoDoTutor()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'disjuntor' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([2, 1])
    // O assunto delicado não chega a nenhum provedor, nem ao principal fora.
    const { saida } = await ia.generate(pedidoDoTutor('eu quero morrer'))
    expect(saida).toMatchObject({ classificacao: 'assunto_delicado' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([2, 1])
  })

  it('Tutor aprovado no `rapido` da reserva, principal fora: a reserva atende, e a linha leva o aluno, a identidade dela, a coluna da reserva e conteúdo nulo', async () => {
    const reserva = new ReservaRoteirizada([respostaDoTutor()])
    const { ia, consumo } = montar({ adaptador: principalRoteirizado([disjuntor()]), reserva: daReserva(reserva, [aprovada('turno_do_tutor', 'reserva-rapido')]), soberaniaDaReserva: CONFERIDA, soberania: CONFERIDA })
    await ia.generate(pedidoDoTutor())
    expect(reserva.chamadas).toBe(1)
    expect(consumo.registros).toMatchObject([{ alunoId: ALUNO_1, tarefa: 'turno_do_tutor', estado: 'concluida', modelo: 'reserva-rapido', envioExterno: true, provedorId: RESERVA, peloProvedorDeReserva: true }])
    expect(consumo.registros[0]).not.toHaveProperty('entrada')
    expect(consumo.registros[0]).not.toHaveProperty('saida')
  })

  it('a reserva só atende o que a subida conferiu na D62: sem a conferência dela, o Tutor aprovado não chega à reserva', async () => {
    for (const soberaniaDaReserva of [undefined, { conferida: false }]) {
      const reserva = new ReservaRoteirizada([respostaDoTutor()])
      const { ia } = montar({ adaptador: principalRoteirizado([disjuntor()]), reserva: daReserva(reserva, [aprovada('turno_do_tutor', 'reserva-rapido')]), soberania: CONFERIDA, ...soOQuePassou({ soberaniaDaReserva }) })
      expect(await erroDe(ia.generate(pedidoDoTutor()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'disjuntor' })
      expect(reserva.chamadas).toBe(0)
    }
  })

  it.each([
    { caso: 'o modelo do `rapido` da reserva trocado depois da aprovação', gerar: (ia: Ia) => ia.generate(pedidoDoTutor()), aprovados: [aprovada('turno_do_tutor', 'modelo-x')], modelos: { rapido: 'modelo-y' } },
    {
      caso: 'o mesmo na classificação do material',
      gerar: (ia: Ia) => ia.generate({ tarefa: classificarSecoes, entrada: entradaDaClassificacao, escolaId: ESCOLA_A, execucaoId: EXECUCAO, fila: 'lote' }),
      aprovados: [aprovada('classificar_secoes', 'modelo-x')],
      modelos: { rapido: 'modelo-y' },
    },
    { caso: 'a aprovação é de outro `provedorId`, com o mesmo modelo', gerar: (ia: Ia) => ia.generate(pedidoDoTutor()), aprovados: [aprovada('turno_do_tutor', 'reserva-rapido', 'outro-provedor')], modelos: {} },
  ])('$caso: indisponível, sem chamar a reserva', async ({ gerar, aprovados, modelos }) => {
    const reserva = new ReservaRoteirizada([respostaDoTutor()], modelos)
    const { ia } = montar({ adaptador: principalRoteirizado([disjuntor()]), reserva: daReserva(reserva, aprovados), soberaniaDaReserva: CONFERIDA, soberania: CONFERIDA })
    expect(await erroDe(gerar(ia))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'disjuntor' })
    expect(reserva.chamadas).toBe(0)
  })

  it('os dois fora: uma chamada à reserva, sem laço de volta ao principal; o interativo termina indisponível, e só a reserva deixa linha', async () => {
    const principal = principalRoteirizado([disjuntor()])
    const reserva = new ReservaRoteirizada([new LLMError('IA_INDISPONIVEL')])
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([1, 1])
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', provedorId: RESERVA, peloProvedorDeReserva: true }])
    expect(consumo.registros).toHaveLength(1)
  })

  it('a reserva que falha depois de sair: a linha estimada leva o provedor dela e a coluna verdadeira, e a do principal, a coluna falsa', async () => {
    const reserva = new ReservaRoteirizada([new LLMError('IA_INDISPONIVEL')])
    const { ia, consumo } = montar({ adaptador: principalRoteirizado([new LLMError('IA_TEMPO_ESGOTADO')]), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, precos: PRECOS })
    await erroDe(ia.generate(pedidoDaFerramenta()))
    const tokens = tokensEstimadosDaFerramenta()
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', codigoDeErro: 'IA_TEMPO_ESGOTADO', modelo: 'roteirizado-padrao', provedorId: PRINCIPAL, peloProvedorDeReserva: false, ...tokens, custoMicros: custoDaChamada(tokens, PRECO_DO_PRINCIPAL) },
      { estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', modelo: 'reserva-padrao', provedorId: RESERVA, peloProvedorDeReserva: true, ...tokens, custoMicros: custoDaChamada(tokens, PRECO_DA_RESERVA) },
    ])
  })

  it('a saída inválida da reserva repete na reserva, com a correção, e nunca volta ao principal', async () => {
    const principal = principalRoteirizado([disjuntor()])
    const reserva = new ReservaRoteirizada(['não é json', saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    await ia.generate(pedidoDaFerramenta())
    expect([principal.chamadas, reserva.chamadas]).toEqual([1, 2])
    expect(reserva.correcoes[0]).toBeUndefined()
    expect(reserva.correcoes[1]).toBeDefined()
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', provedorId: RESERVA, peloProvedorDeReserva: true },
      { estado: 'concluida', provedorId: RESERVA, peloProvedorDeReserva: true },
    ])
  })

  it('saída inválida do principal não é queda: duas inválidas terminam `IA_SAIDA_INVALIDA` sem chamar a reserva', async () => {
    const principal = principalRoteirizado(['não é json', 'não é json'])
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([2, 0])
  })

  it('no máximo quatro chamadas: o principal inválido e depois fora, a reserva inválida duas vezes; a reserva começa sem a correção do principal e a execução para', async () => {
    const principal = principalRoteirizado(['não é json', new LLMError('IA_INDISPONIVEL')])
    const reserva = new ReservaRoteirizada(['não é json', 'não é json', saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([2, 2])
    expect(principal.correcoes[1]).toBeDefined()
    expect(reserva.correcoes[0]).toBeUndefined()
    expect(consumo.registros.map((linha) => [linha.provedorId, linha.peloProvedorDeReserva])).toEqual([[PRINCIPAL, false], [PRINCIPAL, false], [RESERVA, true], [RESERVA, true]])
  })

  it('no máximo quatro chamadas com principal e reserva do mesmo `provedorId` e modelos diferentes: o contador é por destino, e não pelo `provedorId`; quatro linhas e a execução para', async () => {
    const principal = principalRoteirizado(['não é json', new LLMError('IA_INDISPONIVEL')])
    const reserva = new ReservaRoteirizada(['não é json', 'não é json', saidaDeAtividade()], {}, PRINCIPAL)
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, [aprovada('gerar_atividade_objetiva', 'reserva-padrao', PRINCIPAL)]), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
    expect([principal.chamadas, reserva.chamadas]).toEqual([2, 2])
    expect(principal.correcoes[1]).toBeDefined()
    expect(reserva.correcoes[0]).toBeUndefined()
    expect(consumo.registros.map((linha) => [linha.provedorId, linha.modelo, linha.peloProvedorDeReserva])).toEqual([
      [PRINCIPAL, 'roteirizado-padrao', false],
      [PRINCIPAL, 'roteirizado-padrao', false],
      [PRINCIPAL, 'reserva-padrao', true],
      [PRINCIPAL, 'reserva-padrao', true],
    ])
  })

  describe('duas inválidas na reserva: a saída de reserva da tarefa (`reservaQuandoInvalida`) vale com os `problemas` da última chamada da reserva (reserva-e-avaliacao, 6.0; RF3; D55)', () => {
    const TEXTO_DA_BIA = 'Segue o que a Bia escreveu. A tecnologia mudou muito a vida das pessoas e hoje todo mundo conversa pelo celular.'
    /** O modelo julgou o texto da aluna: reprovada **na conferência** pela D55, que é o único motivo que a tarefa aceita para a recusa fixa. */
    const juizo = JSON.stringify({ tipo: 'texto', texto: 'O texto da Bia está confuso e fraco, sem coesão.', citacoes: [] })
    /** Forma certa e conteúdo errado, mas **não** da D55: a citação aponta um material que a conversa não trouxe. */
    const citacaoInvalida = JSON.stringify({ tipo: 'texto', texto: 'Está na página 1.', citacoes: [{ materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina: 1, trecho: 'O mol é…' }] })
    const recusa = { tipo: 'texto' as const, texto: RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO, citacoes: [] }
    const APROVADA_A_CONVERSA = [aprovada('propor_ferramenta', 'reserva-rapido')]
    const pedidoDoAssistente = () => ({ tarefa: proporFerramenta, entrada: entradaDoAssistente(TEXTO_DA_BIA), escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    const montarComAssistente = (principalRoteiro: readonly (string | Error)[], reservaRoteiro: readonly (string | Error)[], logger?: LLMLogger) => {
      const principal = principalRoteirizado(principalRoteiro)
      const reserva = new ReservaRoteirizada(reservaRoteiro)
      const gateway = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_CONVERSA), soberania: CONFERIDA, soberaniaDaReserva: CONFERIDA, ...(logger === undefined ? {} : { logger }) })
      return { ...gateway, principal, reserva }
    }

    it('o principal reprovado por outro motivo e depois fora, e a reserva reprovada duas vezes pela D55: a recusa fixa, com quatro tentativas, e a reserva começa sem a correção do principal', async () => {
      const logger = registrador()
      const { ia, consumo, principal, reserva } = montarComAssistente([citacaoInvalida, new LLMError('IA_INDISPONIVEL')], [juizo, juizo], logger)
      const { saida } = await ia.generate(pedidoDoAssistente())
      expect(saida).toEqual(recusa)
      expect([principal.chamadas, reserva.chamadas]).toEqual([2, 2])
      expect(reserva.correcoes[0]).toBeUndefined()
      expect(reserva.correcoes[1]?.problemas.join(' ')).toContain('julga texto de aluno')
      expect(consumo.registros.map((linha) => [linha.provedorId, linha.peloProvedorDeReserva, linha.estado])).toEqual([
        [PRINCIPAL, false, 'falhou'],
        [PRINCIPAL, false, 'falhou'],
        [RESERVA, true, 'falhou'],
        [RESERVA, true, 'concluida'],
      ])
      expect(logger.linhas().filter((linha) => (linha as { evento?: string }).evento === 'ia.geracao.reserva')).toEqual([
        { evento: 'ia.geracao.reserva', tipo: 'propor_ferramenta', escolaId: ESCOLA_A, execucaoId: EXECUCAO, tentativas: 4 },
      ])
      expect(JSON.stringify([consumo.registros, logger.linhas()])).not.toMatch(/Bia|confuso|sem coesão/u)
    })

    it('o principal reprovado pela D55 e depois fora, e a reserva reprovada duas vezes por outro motivo: os `problemas` do principal não valem, e termina `IA_SAIDA_INVALIDA`', async () => {
      const { ia, principal, reserva } = montarComAssistente([juizo, new LLMError('IA_INDISPONIVEL')], [citacaoInvalida, citacaoInvalida])
      expect(await erroDe(ia.generate(pedidoDoAssistente()))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
      expect([principal.chamadas, reserva.chamadas]).toEqual([2, 2])
    })

    it('a última chamada da reserva é que decide: a D55 na primeira e outro motivo na segunda, `IA_SAIDA_INVALIDA`; o inverso, a recusa fixa', async () => {
      const dePrimeira = montarComAssistente([new LLMError('IA_INDISPONIVEL')], [juizo, citacaoInvalida])
      expect(await erroDe(dePrimeira.ia.generate(pedidoDoAssistente()))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
      const dePorUltimo = montarComAssistente([new LLMError('IA_INDISPONIVEL')], [citacaoInvalida, juizo])
      expect((await dePorUltimo.ia.generate(pedidoDoAssistente())).saida).toEqual(recusa)
    })

    it('a reserva que devolve JSON quebrado duas vezes segue sendo `IA_SAIDA_INVALIDA`: só a reprovação na conferência chega à saída de reserva', async () => {
      const { ia, reserva } = montarComAssistente([new LLMError('IA_INDISPONIVEL')], ['não é json', 'não é json'])
      expect(await erroDe(ia.generate(pedidoDoAssistente()))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
      expect(reserva.chamadas).toBe(2)
    })

    it('o JSON quebrado na última chamada da reserva apaga a reprovação na conferência de antes: no Tutor, cuja saída de reserva não olha os `problemas`, é `IA_SAIDA_INVALIDA`, e não a recusa por regra', async () => {
      const conferenciaReprovada = JSON.stringify({ classificacao: 'normal', resposta: 'Isso! Você acertou. Qual é a próxima dúvida?', citacoes: [] })
      const duvida = 'é a letra B, né?'
      const montarTutor = (reservaRoteiro: readonly string[]) => {
        const reserva = new ReservaRoteirizada(reservaRoteiro)
        const { ia } = montar({ adaptador: principalRoteirizado([disjuntor()]), reserva: daReserva(reserva, [aprovada('turno_do_tutor', 'reserva-rapido')]), soberania: CONFERIDA, soberaniaDaReserva: CONFERIDA })
        return { ia, reserva }
      }
      // O controle: as duas reprovadas na conferência entregam a recusa por regra do Tutor.
      const controle = montarTutor([conferenciaReprovada, conferenciaReprovada])
      expect((await controle.ia.generate(pedidoDoTutor(duvida))).saida).toMatchObject({ classificacao: 'pediu_resposta_pronta' })
      // A última é JSON quebrado: a reprovação da primeira não vale mais.
      const quebrada = montarTutor([conferenciaReprovada, 'não é json'])
      expect(await erroDe(quebrada.ia.generate(pedidoDoTutor(duvida)))).toMatchObject({ codigoDeIa: 'IA_SAIDA_INVALIDA' })
      expect(quebrada.reserva.chamadas).toBe(2)
    })
  })

  it('o principal fora e a reserva atende, com preço, provedor e modelo diferentes: cada linha leva os dela, e a `medicao` é a da reserva', async () => {
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principalRoteirizado([new LLMError('IA_TEMPO_ESGOTADO')]), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, precos: PRECOS })
    const { medicao } = await ia.generate(pedidoDaFerramenta())
    const tokens = tokensEstimadosDaFerramenta()
    expect(consumo.registros).toMatchObject([
      { estado: 'falhou', modelo: 'roteirizado-padrao', provedorId: PRINCIPAL, peloProvedorDeReserva: false, ...tokens, custoMicros: custoDaChamada(tokens, PRECO_DO_PRINCIPAL) },
      { estado: 'concluida', modelo: 'reserva-padrao', provedorId: RESERVA, peloProvedorDeReserva: true, tokensDeEntrada: 100, tokensDeSaida: 20, custoMicros: custoDaChamada({ tokensDeEntrada: 100, tokensDeSaida: 20 }, PRECO_DA_RESERVA) },
    ])
    expect(consumo.registros[0]?.custoMicros).toBeGreaterThan(0)
    expect(medicao).toMatchObject({ modelo: 'reserva-padrao', provedorId: RESERVA, envioExterno: true, tokensDeEntrada: 100, tokensDeSaida: 20 })
  })

  it('o principal falso cai e a reserva envia: a linha do falso não leva envio, e a da reserva e a `medicao` levam o envio e a origem dela, não os do último adaptador em todas as linhas', async () => {
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: new FakeAdapter({ falha: 'prazo' }), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, precos: PRECOS })
    const { medicao } = await ia.generate(pedidoDaFerramenta())
    expect(consumo.registros).toMatchObject([
      { origem: 'falso', envioExterno: false, provedorId: null, peloProvedorDeReserva: false },
      { origem: 'openai_compat', envioExterno: true, provedorId: RESERVA, peloProvedorDeReserva: true },
    ])
    expect(medicao).toMatchObject({ origem: 'openai_compat', envioExterno: true, provedorId: RESERVA })
  })

  it('o disjuntor do principal aberto devolve a vaga: cinco pedidos seguidos, com o balde para dois, chegam todos à reserva, nenhum termina `sem_vaga`, e os acertos do principal são 0', async () => {
    const limite = new LimiteComBalde(2)
    const principal = principalRoteirizado(Array.from({ length: 5 }, disjuntor))
    const reserva = new ReservaRoteirizada(Array.from({ length: 5 }, saidaDeAtividade))
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, limiteDeTokens: limite })
    for (let vez = 0; vez < 5; vez += 1) await ia.generate(pedidoDaFerramenta())
    expect(reserva.chamadas).toBe(5)
    expect(limite.acertos).toEqual([0, 0, 0, 0, 0])
    expect(consumo.registros).toHaveLength(5)
    expect(consumo.registros).toMatchObject(Array.from({ length: 5 }, () => ({ estado: 'concluida', provedorId: RESERVA, peloProvedorDeReserva: true })))
  })

  it('a chamada que pode ter saído (o 5xx) mantém a estimativa no balde: não é devolvida, porque o provedor pode tê-la contado (D14)', async () => {
    const limite = new LimiteComBalde(5)
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia } = montar({ adaptador: principalRoteirizado([new LLMError('IA_INDISPONIVEL')]), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, limiteDeTokens: limite })
    await ia.generate(pedidoDaFerramenta())
    expect(reserva.chamadas).toBe(1)
    expect(limite.acertos).toEqual([])
  })

  it('duas execuções ao mesmo tempo no mesmo gateway, uma desviada e outra não: cada linha leva o destino da chamada dela', async () => {
    const principal = new PrincipalPorTema('tema-que-cai')
    const reserva = new ReservaRoteirizada([saidaDeAtividade()])
    const { ia, consumo } = montar({ adaptador: principal, reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    const daquelaQueCai = { ...pedidoDaFerramenta(), execucaoId: 'execucao-que-cai', entrada: { ...entradaDeAtividade(), tema: 'tema-que-cai' } }
    const daOutra = { ...pedidoDaFerramenta(), execucaoId: 'execucao-que-passa', entrada: { ...entradaDeAtividade(), tema: 'outro-tema' } }
    await Promise.all([ia.generate(daquelaQueCai), ia.generate(daOutra)])
    expect(consumo.registros).toHaveLength(2)
    expect(consumo.registros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ execucaoId: 'execucao-que-cai', estado: 'concluida', provedorId: RESERVA, peloProvedorDeReserva: true }),
        expect.objectContaining({ execucaoId: 'execucao-que-passa', estado: 'concluida', provedorId: PRINCIPAL, peloProvedorDeReserva: false }),
      ]),
    )
    expect(reserva.chamadas).toBe(1)
  })

  it('sem reserva configurada a queda do principal termina como na X6: o prazo esgotado, só a linha do principal, e nenhum degrau da reserva', async () => {
    const leitor = new MedidorDeTeste()
    const principal = principalRoteirizado([new LLMError('IA_TEMPO_ESGOTADO')])
    const { ia, consumo } = montar({ adaptador: principal, soberaniaDaReserva: CONFERIDA, medidor: leitor.medidor })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_TEMPO_ESGOTADO' })
    expect(principal.chamadas).toBe(1)
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_TEMPO_ESGOTADO', provedorId: PRINCIPAL, peloProvedorDeReserva: false }])
    expect(await valorDe(leitor, 'ia.degradacao', 'degrau', 'provedor_de_reserva')).toBe(0)
    await leitor.encerrar()
  })

  it('o erro que não é da camada de IA não é queda, mesmo com a forma de um, e o que é de IA mas não é queda (o material insuficiente) também não vai à reserva', async () => {
    const aparentaSerQueda = Object.assign(new Error('defeito do adaptador'), { codigoDeIa: 'IA_TEMPO_ESGOTADO' })
    for (const erro of [aparentaSerQueda, new LLMError('MATERIAL_INSUFICIENTE')]) {
      const reserva = new ReservaRoteirizada([saidaDeAtividade()])
      const { ia } = montar({ adaptador: principalRoteirizado([erro]), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
      const terminou = await erroDe(ia.generate(pedidoDaFerramenta()))
      expect(terminou.codigoDeIa, String(erro)).toBe(erro instanceof LLMError ? 'MATERIAL_INSUFICIENTE' : 'IA_INDISPONIVEL')
      expect(reserva.chamadas, String(erro)).toBe(0)
    }
  })

  it('os dois fora por disjuntor, no interativo: nada saiu, e a linha única é a de "nada enviado": sem provedor e com a coluna da reserva falsa', async () => {
    const { ia, consumo } = montar({ adaptador: principalRoteirizado([disjuntor()]), reserva: daReserva(new ReservaRoteirizada([disjuntor()]), APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'disjuntor' })
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', tentativas: 0, envioExterno: false, provedorId: null, peloProvedorDeReserva: false }])
    expect(consumo.registros).toHaveLength(1)
  })

  it('a reserva que recusa por `limite` não desce ao modelo menor do principal nem reserva vaga no balde dele: termina com `limite`, uma chamada, e o balde só viu o principal', async () => {
    const limite = new LimiteDeMentira()
    const reserva = new ReservaRoteirizada([new LLMError('IA_INDISPONIVEL', 90, 'limite')])
    const { ia } = montar({ adaptador: principalRoteirizado([disjuntor()]), reserva: daReserva(reserva, APROVADA_A_GERACAO), soberaniaDaReserva: CONFERIDA, limiteDeTokens: limite, modelosMenores: MENORES })
    expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
    expect(reserva.chamadas).toBe(1)
    expect(reserva.modelosPedidos).toEqual([undefined])
    expect(limite.modelosPedidos).toEqual([`${PRINCIPAL}:roteirizado-padrao`])
  })

  describe('pela configuração: `IA_FALHA_FALSA` e o log do desvio', () => {
    const LOCAL = { AMBIENTE: 'local' } as const
    const gatewayDa = (config: LLMConfig, extras: Partial<Parameters<typeof createLLMGateway>[1]> = {}) => {
      const consumo = new InMemoryConsumo()
      const ia = withEscolaContextOfRequest(createLLMGateway(config, { registro: consumo, orcamento: SEMPRE, suspensao: new InMemorySuspensoes(), soberaniaDaReserva: CONFERIDA, ...extras }))
      return { ia, consumo }
    }

    it('`principal:5xx` com a reserva falsa: o principal falha em toda chamada, a reserva atende, e o provedor das duas linhas é nulo (nada saiu)', async () => {
      const { ia, consumo } = gatewayDa(loadLLMConfig({ ...LOCAL, IA_RESERVA_ADAPTADOR: 'falso', IA_FALHA_FALSA: 'principal:5xx' }))
      await ia.generate(pedidoDaFerramenta())
      expect(consumo.registros).toMatchObject([
        { estado: 'falhou', codigoDeErro: 'IA_INDISPONIVEL', origem: 'falso', provedorId: null, peloProvedorDeReserva: false },
        { estado: 'concluida', origem: 'falso', provedorId: null, peloProvedorDeReserva: true },
      ])
    })

    it('`reserva:5xx` só derruba a reserva: o principal atende sozinho, sem desvio e com uma linha só', async () => {
      const soReserva = gatewayDa(loadLLMConfig({ ...LOCAL, IA_RESERVA_ADAPTADOR: 'falso', IA_FALHA_FALSA: 'reserva:5xx' }))
      await soReserva.ia.generate(pedidoDaFerramenta())
      expect(soReserva.consumo.registros).toMatchObject([{ estado: 'concluida', peloProvedorDeReserva: false }])
      expect(soReserva.consumo.registros).toHaveLength(1)
    })

    it('com o `openai_compat` nos dois, `IA_FALHA_FALSA` não tem efeito: os dois falam com o servidor, e o principal atende sem desvio', async () => {
      const servidor = await startFakeLlamaServer(() => ({ corpo: chatResponse(saidaDeAtividade()) }))
      try {
        const config = loadLLMConfig({
          ...LOCAL,
          IA_ADAPTADOR: 'openai_compat',
          LLM_BASE_URL: servidor.url,
          LLM_MODELO: 'm-principal',
          IA_PROVEDOR_ID: PRINCIPAL,
          IA_RESERVA_ADAPTADOR: 'openai_compat',
          LLM_RESERVA_BASE_URL: servidor.url,
          IA_RESERVA_PROVEDOR_ID: RESERVA,
          LLM_RESERVA_MODELO: 'm-reserva',
          IA_FALHA_FALSA: 'principal:5xx',
        })
        expect(config.falhaFalsa).toEqual({ destino: 'principal', falha: '5xx' })
        expect(adaptadorDaReserva(config)).toBeInstanceOf(OpenAICompatAdapter)
        const { ia, consumo } = gatewayDa(config, { aprovados: [aprovada('gerar_atividade_objetiva', 'm-reserva')] })
        await ia.generate(pedidoDaFerramenta())
        expect(servidor.pedidos).toHaveLength(1)
        expect(consumo.registros).toMatchObject([{ estado: 'concluida', provedorId: PRINCIPAL, peloProvedorDeReserva: false }])
      } finally {
        await servidor.fechar()
      }
    })

    it('a reserva `openai_compat` sai com a resiliência do `ResilientAdapter`: o 429 sem `Retry-After` é repetido uma vez, e só uma, e termina `limite`', async () => {
      const servidor = await startFakeLlamaServer(() => ({ status: 429, corpo: {} }))
      try {
        const config = loadLLMConfig({
          ...LOCAL,
          LLM_RECUO_MS: '10',
          IA_FALHA_FALSA: 'principal:5xx',
          IA_RESERVA_ADAPTADOR: 'openai_compat',
          LLM_RESERVA_BASE_URL: servidor.url,
          IA_RESERVA_PROVEDOR_ID: RESERVA,
          LLM_RESERVA_MODELO: 'm-reserva',
        })
        const { ia } = gatewayDa(config, { aprovados: [aprovada('gerar_atividade_objetiva', 'm-reserva')] })
        expect(await erroDe(ia.generate(pedidoDaFerramenta()))).toMatchObject({ codigoDeIa: 'IA_INDISPONIVEL', motivo: 'limite' })
        expect(servidor.pedidos).toHaveLength(2)
      } finally {
        await servidor.fechar()
      }
    })

    it('o log do desvio leva a tarefa, os ids e o `provedorId`: nunca o texto da entrada nem a chave de API da reserva (regra 20, item 9)', async () => {
      const servidor = await startFakeLlamaServer(() => ({ corpo: chatResponse(saidaDeAtividade()) }))
      try {
        const logger = registrador()
        const config = loadLLMConfig({
          ...LOCAL,
          IA_FALHA_FALSA: 'principal:5xx',
          IA_RESERVA_ADAPTADOR: 'openai_compat',
          LLM_RESERVA_BASE_URL: servidor.url,
          IA_RESERVA_PROVEDOR_ID: RESERVA,
          LLM_RESERVA_MODELO: 'm-reserva',
          LLM_RESERVA_CHAVE_API: 'chave-da-reserva-xyz',
        })
        const { ia, consumo } = gatewayDa(config, { logger, aprovados: [aprovada('gerar_atividade_objetiva', 'm-reserva')] })
        await ia.generate({ ...pedidoDaFerramenta(), entrada: { ...entradaDeAtividade(), tema: 'tema-marcado-do-professor' } })
        expect(servidor.pedidos).toHaveLength(1)
        expect(consumo.registros).toMatchObject([{ provedorId: null }, { provedorId: RESERVA, envioExterno: true, peloProvedorDeReserva: true }])
        expect(logger.linhas().filter((linha) => (linha as { evento?: string }).evento === 'ia.geracao.provedor_de_reserva')).toEqual([
          { evento: 'ia.geracao.provedor_de_reserva', tipo: 'gerar_atividade_objetiva', escolaId: ESCOLA_A, execucaoId: EXECUCAO, provedorId: RESERVA },
        ])
        const tudo = JSON.stringify(logger.linhas())
        expect(tudo).not.toContain('tema-marcado-do-professor')
        expect(tudo).not.toContain('chave-da-reserva-xyz')
      } finally {
        await servidor.fechar()
      }
    })
  })
})
