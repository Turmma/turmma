import { ErrorCode, TAREFAS_DE_IA } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runInContext } from '../context/context.js'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { ScriptedAdapter, PROVEDOR_ROTEIRIZADO } from './__fixtures__/scripted-adapter.js'
import { chatResponse, startFakeLlamaServer, type FakeLlamaServer } from './__fixtures__/fake-llama-server.js'
import { withEscolaContextOfRequest } from './__fixtures__/escola-context.js'
import { ALUNO_1, ALUNO_2, atividadeDeEstequiometria, entradaDeAtividade, entradaDoAssistente, entradaDoRelatorio, entradaDoTutor, ESCOLA_A, ESCOLA_B } from './__fixtures__/inputs.js'
import type { ModelAdapter } from './adapter.js'
import { FakeAdapter, MODELO_FALSO } from './fake-adapter.js'
import { InMemoryConsumo, InMemoryOrcamento, type OrcamentoQuery, type ConsumoDeIa, type OrcamentoDeIa, type RegistroDeConsumo } from './consumo.js'
import type { LLMConfig } from '../config/llm-config.js'
import { HTTP_STATUS_BY_CODE } from '../error/domain.exception.js'
import { LLM_ERROR_CODES, LLMError } from './errors.js'
import type { DeclaracaoDeSoberania, EnvioDaChamada, GenerationMeasurement } from './port.js'
import { createLLMGateway, destinoDoAdaptador, ESPERA_MAXIMA_DA_VAGA_MS, MODELO_DA_REGRA_FIXA, MOTIVO_MODELO_MENOR_SEM_PRECO, LLMGateway, type LLMGatewayDependencies, type LLMLogger } from './llm-gateway.js'
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
function montar(opcoes: { adaptador?: ModelAdapter; orcamento?: OrcamentoDeIa; registro?: RegistroDeConsumo; suspensao?: SuspensaoDeFuncao; soberania?: DeclaracaoDeSoberania; logger?: LLMLogger; agora?: () => Date; semContexto?: true; medidor?: MedidorDeTeste['medidor']; limiteDeTokens?: LimiteDeTokens; modelosMenores?: LLMGatewayDependencies['modelosMenores'] } = {}) {
  const consumo = new InMemoryConsumo()
  const relogio = { agora: opcoes.agora ?? (() => new Date('2026-10-05T13:00:00Z')) }
  const puro = new LLMGateway({
    adaptador: opcoes.adaptador ?? new FakeAdapter(),
    registro: opcoes.registro ?? consumo,
    orcamento: opcoes.orcamento ?? SEMPRE,
    suspensao: opcoes.suspensao ?? new InMemorySuspensoes(),
    relogio,
    ...soOQuePassou({ soberania: opcoes.soberania, logger: opcoes.logger, medidor: opcoes.medidor, limiteDeTokens: opcoes.limiteDeTokens, modelosMenores: opcoes.modelosMenores }),
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
    const consumida = { ...medida, tarefa: 'gerar_atividade_objetiva', funcao: 'conversa_e_ferramentas', estado: 'concluida', em: new Date() } as const
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
        entrada,
        saida,
        estado: 'concluida',
        em: new Date('2026-10-05T13:00:00Z'),
      },
    ])
  })

  it('a falha também fica registrada, com o código, sem saída', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', '{"tipo":"outra coisa"}']) })
    await erroDe(ia.generate({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 2, tokensDeEntrada: 200, tokensDeSaida: 40 }])
    expect(consumo.registros[0]).not.toHaveProperty('saida')
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
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' }])
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
    expect(consumo.registros[0]?.entrada).toEqual(entrada)
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
  /** Os `provedor:modelo` sem vaga agora: o teste os abre com o relógio. */
  readonly fechados = new Set<string>()
  uso = 0.5
  /** A recusa do balde da fila vem sem o uso do geral, que nem foi consultado. */
  recusaSemUso = false

  constructor(private readonly msAteLiberar = 1_000) {}

  async reservar(modelo: string, estimativa: number, fila: FilaDeTokens): Promise<ResultadoDaReserva> {
    this.pedidos.push({ modelo, estimativa, fila })
    if (this.fechados.has(modelo)) return this.recusaSemUso ? { concedida: false, msAteLiberar: this.msAteLiberar } : { concedida: false, msAteLiberar: this.msAteLiberar, usoDoTeto: this.uso }
    return { concedida: true, usoDoTeto: this.uso, reserva: { acertar: async (usoReal) => void this.acertos.push(usoReal) } }
  }

  get modelosPedidos(): string[] {
    return this.pedidos.map((pedido) => pedido.modelo)
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
    expect(consumo.registros).toMatchObject([{ modelo: 'menor-rapido', tentativas: 2 }])
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
