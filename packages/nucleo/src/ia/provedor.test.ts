import { ErrorCode } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runInContext } from '../contexto/contexto.js'
import { ScriptedAdapter, PROVEDOR_ROTEIRIZADO } from './__fixtures__/adaptador-roteirizado.js'
import { chatResponse, startFakeLlamaServer, type FakeLlamaServer } from './__fixtures__/servidor-llama-falso.js'
import { withEscolaContextOfRequest } from './__fixtures__/contexto-da-escola.js'
import { ALUNO_1, ALUNO_2, atividadeDeEstequiometria, entradaDeAtividade, entradaDoAssistente, entradaDoRelatorio, entradaDoTutor, ESCOLA_A, ESCOLA_B } from './__fixtures__/entradas.js'
import type { ModelAdapter } from './adaptador.js'
import { FakeAdapter, MODELO_FALSO } from './adaptador-falso.js'
import { InMemoryConsumo, InMemoryOrcamento, type OrcamentoQuery, type ConsumoDeIa, type OrcamentoDeIa, type RegistroDeConsumo } from './consumo.js'
import type { LLMConfig } from '../config/config-ia.js'
import { LLM_ERROR_CODES, LLMError } from './erros.js'
import type { EnvioDaChamada, GenerationMeasurement } from './porta.js'
import { createLLMGateway, MODELO_DA_REGRA_FIXA, LLMGateway, type LLMLogger } from './provedor.js'
import { exigirFuncaoAtiva, InMemorySuspensoes, type SuspensaoDeFuncao } from './suspensao.js'
import type { TaskDefinition } from './tarefa.js'
import { gerarAtividadeObjetiva } from './tarefas/gerar-atividade-objetiva.js'
import { proporFerramenta } from './tarefas/propor-ferramenta.js'
import { relatorioDaCorrecao } from './tarefas/relatorio-da-correcao.js'
import { turnoDoTutor } from './tarefas/turno-do-tutor.js'

const EXECUCAO = '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6'
const PRAZOS = { rapido: 5_000, padrao: 5_000, complexo: 5_000, visao: 5_000 } as const
const SEMPRE = { consultar: async () => ({ permitido: true as const }) } satisfies OrcamentoDeIa

function registrador(): LLMLogger & { linhas: () => unknown[] } {
  const info = vi.fn()
  const warn = vi.fn()
  return { info, warn, linhas: () => [...info.mock.calls, ...warn.mock.calls].flat() }
}

/** `semContexto`: o provedor puro, sem o contexto da escola do pedido, para o teste do que acontece sem escola no contexto. */
function montar(opcoes: { adaptador?: ModelAdapter; orcamento?: OrcamentoDeIa; registro?: RegistroDeConsumo; suspensao?: SuspensaoDeFuncao; logger?: LLMLogger; agora?: () => Date; semContexto?: true } = {}) {
  const consumo = new InMemoryConsumo()
  const relogio = { agora: opcoes.agora ?? (() => new Date('2026-10-05T13:00:00Z')) }
  const puro = new LLMGateway({
    adaptador: opcoes.adaptador ?? new FakeAdapter(),
    registro: opcoes.registro ?? consumo,
    orcamento: opcoes.orcamento ?? SEMPRE,
    suspensao: opcoes.suspensao ?? new InMemorySuspensoes(),
    relogio,
    ...(opcoes.logger === undefined ? {} : { logger: opcoes.logger }),
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
    const { saida, medicao } = await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(saida).toEqual(atividadeDeEstequiometria())
    expect(medicao).toMatchObject({ origem: 'falso', perfil: 'padrao', modelo: MODELO_FALSO, promptVersao: gerarAtividadeObjetiva.prompt.versao, envioExterno: false, provedorId: null, tentativas: 1 })
    expect(medicao.tokensDeEntrada).toBeGreaterThan(0)
    expect(medicao.tokensDeSaida).toBeGreaterThan(0)
    expect(medicao.duracaoMs).toBeGreaterThanOrEqual(0)
  })

  it('com adaptador que manda para fora, a medição e o registro dizem que houve envio externo', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())], true) })
    const { medicao } = await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao.envioExterno).toBe(true)
    expect(consumo.registros[0]?.envioExterno).toBe(true)
  })

  it('com envio externo, o id do provedor que atendeu vai junto na medição e no registro; sem envio, o provedor é nulo', async () => {
    const externo = montar({ adaptador: new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())], true) })
    const { medicao } = await externo.ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao).toMatchObject({ envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO })
    expect(externo.consumo.registros).toMatchObject([{ envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO }])
    // Modelo local: a chamada aconteceu, e nada saiu daqui.
    const local = montar({ adaptador: new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria())], false) })
    const { medicao: daLocal } = await local.ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(daLocal).toMatchObject({ envioExterno: false, provedorId: null })
    expect(local.consumo.registros).toMatchObject([{ envioExterno: false, provedorId: null }])
  })

  it('a chamada que falhou depois de sair para o provedor também registra qual foi', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter([new Error('provedor fora')]) })
    await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', tentativas: 1, envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO }])
  })

  it('a falha antes de qualquer chamada não conta como envio, mesmo com adaptador externo: a regra fixa defeituosa não leva provedor', async () => {
    const adaptador = new ScriptedAdapter([])
    const regraFixaDefeituosa = { ...turnoDoTutor, semModelo: () => ({ classificacao: 'normal' as const, resposta: '', citacoes: [] }) }
    const { ia, consumo } = montar({ adaptador })
    await erroDe(ia.gerar({ tarefa: regraFixaDefeituosa, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
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
    const ia = withEscolaContextOfRequest(createLLMGateway({ adaptador: 'falso', prazosMs: PRAZOS, recuoMs: 500, executor: { vagasPorEscola: 2, vagasNoTotal: 8, timeoutMs: 10_000 } }, { registro: consumo, orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }))
    const { medicao } = await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    expect(medicao.origem).toBe('falso')
  })

  it('criarProvedorDeIa: com latenciaFalsaMs a chamada do adaptador falso espera pelo menos isso, e sem ela não espera', async () => {
    const config = { adaptador: 'falso' as const, prazosMs: PRAZOS, recuoMs: 500, executor: { vagasPorEscola: 2, vagasNoTotal: 8, timeoutMs: 10_000 } }
    const portas = { registro: new InMemoryConsumo(), orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }
    const chamar = async (latenciaFalsaMs?: number): Promise<number> => {
      const ia = withEscolaContextOfRequest(createLLMGateway(latenciaFalsaMs === undefined ? config : { ...config, latenciaFalsaMs }, portas))
      const inicio = performance.now()
      await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
      return performance.now() - inicio
    }
    // A chamada com latência primeiro: o custo da primeira chamada do arquivo só soma a ela.
    const com = await chamar(200)
    const sem = await chamar()
    expect(com).toBeGreaterThanOrEqual(190)
    // Sem a opção não há espera: a chamada termina antes da que espera 200 ms, qualquer que seja a velocidade da máquina.
    expect(sem).toBeLessThan(com)
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
      executor: { vagasPorEscola: 2, vagasNoTotal: 8, timeoutMs: 10_000 },
      modelo: { baseUrl: servidor.url, modelos: { rapido: 'm', padrao: 'm', complexo: 'm', visao: 'm' }, processamentoLocal: true },
    }
    const consumo = new InMemoryConsumo()
    return withEscolaContextOfRequest(createLLMGateway(configuracao, { registro: consumo, orcamento: SEMPRE, suspensao: new InMemorySuspensoes() }))
  }

  it('o prazo é o do perfil da tarefa: o turno do Tutor (`rapido`) estoura aos 150 ms, e a atividade (`padrao`) espera a mesma demora', async () => {
    const texto = JSON.stringify(atividadeDeEstequiometria())
    const ia = await provedorComModelo(() => ({ corpo: chatResponse(texto), atrasoMs: 600 }), { prazosMs: { rapido: 150, padrao: 3_000, complexo: 3_000, visao: 3_000 }, recuoMs: 20 })
    const inicio = performance.now()
    const tutor = await erroDe(ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    expect(tutor.codigoDeIa).toBe('IA_TEMPO_ESGOTADO')
    expect(performance.now() - inicio).toBeLessThan(1_100)
    await expect(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })).resolves.toBeDefined()
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
    await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    const espera = (chegadas[1] ?? 0) - (chegadas[0] ?? 0)
    expect(espera).toBeGreaterThanOrEqual(190)
    expect(espera).toBeLessThan(1_100)
  })
})

describe('ProvedorDeIa: toda execução registra (regra 30, item 4)', () => {
  it('grava entrada, saída, tarefa, função, perfil, modelo, versão do prompt, tokens, duração, envio externo e a execução', async () => {
    const { ia, consumo } = montar()
    const entrada = entradaDeAtividade()
    const { saida, medicao } = await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO })
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
    await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA', tentativas: 2, tokensDeEntrada: 200, tokensDeSaida: 40 }])
    expect(consumo.registros[0]).not.toHaveProperty('saida')
  })

  it('tarefa que leva texto de aluno não deixa entrada nem saída no consumo: o registro da conversa é do Tutor, não daqui', async () => {
    const { ia, consumo } = montar()
    const duvida = 'como eu acho o reagente limitante? palavra-marcada-do-aluno'
    const { saida } = await ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
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
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', 'não é json']) })
    await erroDe(ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi palavra-marcada-do-aluno'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
    expect(consumo.registros).toMatchObject([{ estado: 'falhou', codigoDeErro: 'IA_SAIDA_INVALIDA' }])
    expect(JSON.stringify(consumo.registros)).not.toContain('palavra-marcada')
  })

  it('a conversa do professor com o Assistente não é copiada para o consumo, no sucesso e na falha: só ele a lê, e ela mora em mensagem_agente', async () => {
    const mensagem = 'monta uma atividade para o Enzo, que tem dislexia: palavra-marcada-do-professor'
    const entrada = { ...entradaDoAssistente(mensagem), turnosAnteriores: [{ autor: 'professor' as const, texto: 'turno-anterior-marcado' }] }
    expect(proporFerramenta).toMatchObject({ levaTextoLivreDePessoa: true, levaTextoDeAluno: true })
    const { ia, consumo } = montar()
    await ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    const falhando = montar({ registro: consumo, adaptador: new ScriptedAdapter(['não é json', 'não é json']) })
    await erroDe(falhando.ia.gerar({ tarefa: proporFerramenta, entrada, escolaId: ESCOLA_A, execucaoId: EXECUCAO }))
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
      const { saida } = await ia.gerar({ tarefa: tarefa as TaskDefinition<unknown, unknown>, entrada, escolaId: ESCOLA_A })
      expect(consumo.registros.at(-1)).toMatchObject({ tarefa: tarefa.nome, entrada, saida })
    }
  })

  it('o aluno só entra no consumo da função que é dele: em outra tarefa, o id passado por engano não é gravado (D64)', async () => {
    const { ia, consumo } = montar()
    await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(consumo.registros[0]).not.toHaveProperty('alunoId')
  })

  it('tarefa sem texto de aluno guarda a entrada na falha: é o que explica depois por que a IA não entregou', async () => {
    const { ia, consumo } = montar({ adaptador: new ScriptedAdapter(['não é json', 'não é json']) })
    const entrada = entradaDeAtividade()
    await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada, escolaId: ESCOLA_A }))
    expect(consumo.registros[0]?.entrada).toEqual(entrada)
  })

  it('se o registro falhar, a saída não é devolvida: nada que não foi registrado chega ao domínio', async () => {
    const registro = { registrar: async () => Promise.reject(new Error('banco fora')) }
    const { ia } = montar({ registro })
    expect((await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_INDISPONIVEL')
  })
})

describe('ProvedorDeIa: o log leva id, nunca conteúdo (regra 20, item 9)', () => {
  it('a linha de sucesso tem evento, tarefa, ids, duração e tentativas, e mais nada', async () => {
    const logger = registrador()
    const { ia } = montar({ logger })
    await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A, execucaoId: EXECUCAO })
    expect(logger.linhas()).toEqual([{ evento: 'ia.geracao.concluida', tipo: 'gerar_atividade_objetiva', escolaId: ESCOLA_A, execucaoId: EXECUCAO, duracaoMs: expect.any(Number) as number, tentativas: 1 }])
  })

  it('o que o aluno escreveu e o que o Tutor respondeu não aparecem em nenhuma linha, nem no sucesso nem na falha', async () => {
    const logger = registrador()
    const duvida = 'como eu acho o reagente limitante? palavra-marcada-do-aluno'
    const { ia } = montar({ logger })
    const { saida } = await ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    const falhando = montar({ logger, adaptador: new ScriptedAdapter(['palavra-marcada-do-modelo', 'palavra-marcada-do-modelo']) })
    await erroDe(falhando.ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor(duvida), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
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
    const erro = await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
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
    // Todo código da camada é um código do contrato da API: o que a execução grava é o que a tela sabe mostrar.
    for (const codigo of LLM_ERROR_CODES) expect(Object.values(ErrorCode)).toContain(codigo)
  })
})

describe('ProvedorDeIa: a escola do pedido é a de quem pede (regra 10, item 3)', () => {
  const pedir = (ia: LLMGateway, escolaId: string) => ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId })

  it('com contexto da escola A, o pedido em nome da escola B é recusado antes de consultar, gastar ou registrar', async () => {
    const adaptador = new ScriptedAdapter([])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const estaSuspensa = vi.fn(async () => false)
    const logger = registrador()
    const { ia, consumo } = montar({ adaptador, orcamento: { consultar }, suspensao: { estaSuspensa }, logger })
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
    const { ia, consumo } = montar({ adaptador, orcamento: { consultar } })
    const comNome = { ...entradaDeAtividade(), nomeDoAluno: 'Enzo Martins' }
    expect((await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: comNome, escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_ENTRADA_INVALIDA')
    expect(adaptador.chamadas).toBe(0)
    expect(consultar).not.toHaveBeenCalled()
    expect(consumo.registros).toEqual([])
  })
})

describe('ProvedorDeIa: orçamento consultado antes de gastar (D14, D38)', () => {
  it('toda chamada consulta o orçamento com a função, sem a escola (a porta a lê do contexto); no Tutor, também com o aluno', async () => {
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const { ia } = montar({ orcamento: { consultar } })
    await ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A })
    await ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(consultar.mock.calls).toEqual([[{ funcao: 'conversa_e_ferramentas' }], [{ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 }]])
  })

  it('orçamento esgotado: erro tipado com a espera sugerida, e o modelo não é chamado', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, orcamento: { consultar: async () => ({ permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: 3600 }) } })
    const erro = await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))
    expect(erro).toMatchObject({ codigoDeIa: 'IA_ORCAMENTO_ESGOTADO', status: 429, tenteDeNovoEmSegundos: 3600 })
    expect(adaptador.chamadas).toBe(0)
  })

  it('sem conseguir consultar o orçamento, não gasta', async () => {
    const adaptador = new ScriptedAdapter([])
    const { ia } = montar({ adaptador, orcamento: { consultar: async () => Promise.reject(new Error('banco fora')) } })
    expect((await erroDe(ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('IA_INDISPONIVEL')
    expect(adaptador.chamadas).toBe(0)
  })

  it('a consulta leva a turma e a execução, quando vêm no pedido: o pacote do mês é da turma, e a pergunta da própria execução não conta contra ela', async () => {
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const { ia } = montar({ orcamento: { consultar } })
    await ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1, turmaId: ESCOLA_B, execucaoId: EXECUCAO })
    expect(consultar.mock.calls).toEqual([[{ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1, turmaId: ESCOLA_B, execucaoId: EXECUCAO }]])
  })

  it('o código da recusa é o que o orçamento deu: freio do dia e pacote do mês chegam com o código próprio', async () => {
    for (const codigo of ['LIMITE_DIARIO_DO_TUTOR', 'PACOTE_DO_TUTOR_ESGOTADO'] as const) {
      const { ia } = montar({ adaptador: new ScriptedAdapter([]), orcamento: { consultar: async () => ({ permitido: false, codigo }) } })
      const erro = await erroDe(ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
      expect(erro).toMatchObject({ codigoDeIa: codigo, codigo, status: 429 })
    }
  })

  it('assunto delicado não passa pelo orçamento: no fim do freio do dia, o aluno ainda recebe a mensagem fixa com o 188', async () => {
    const consultar = vi.fn(async () => ({ permitido: false as const, codigo: 'LIMITE_DIARIO_DO_TUTOR' as const }))
    const { ia, consumo } = montar({ orcamento: { consultar }, adaptador: new ScriptedAdapter([]) })
    const { saida } = await ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('eu quero morrer'), escolaId: ESCOLA_A, alunoId: ALUNO_1 })
    expect(saida.resposta).toContain('188')
    expect(consultar).not.toHaveBeenCalled()
    // O adaptador deste teste é externo: a regra fixa não chama ninguém, e por isso não leva provedor.
    expect(consumo.registros).toMatchObject([{ origem: 'regra_fixa', modelo: MODELO_DA_REGRA_FIXA, tentativas: 0, estado: 'concluida', envioExterno: false, provedorId: null }])
    // A dúvida comum, com o mesmo orçamento esgotado, é recusada.
    expect((await erroDe(ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))).codigoDeIa).toBe('LIMITE_DIARIO_DO_TUTOR')
  })
})

describe('ProvedorDeIa: função suspensa pela escola não executa (D60)', () => {
  function comSuspensao() {
    const suspensao = new InMemorySuspensoes()
    const adaptador = new ScriptedAdapter([JSON.stringify(atividadeDeEstequiometria()), JSON.stringify(atividadeDeEstequiometria())])
    const consultar = vi.fn(async () => ({ permitido: true as const }))
    const logger = registrador()
    return { suspensao, adaptador, consultar, logger, ...montar({ suspensao, adaptador, orcamento: { consultar }, logger }) }
  }
  const gerar = (ia: LLMGateway, escolaId: string) => ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId })

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
    const erro = await erroDe(ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('eu quero morrer'), escolaId: ESCOLA_A, alunoId: ALUNO_1 }))
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
    expect((await erroDe(ia.gerar({ tarefa: relatorioDaCorrecao, entrada: entradaDoRelatorio(), escolaId: ESCOLA_A }))).codigoDeIa).toBe('FUNCAO_SUSPENSA')
  })
})

describe('OrcamentoEmMemoria', () => {
  function comLimites(limites: { tokensPorEscolaNoMes?: number; trocasPorAlunoNoDia?: number }) {
    let agora = new Date('2026-10-05T13:00:00Z')
    const consumo = new InMemoryConsumo()
    const relogio = { agora: () => agora }
    const ia = withEscolaContextOfRequest(new LLMGateway({ adaptador: new FakeAdapter(), registro: consumo, orcamento: new InMemoryOrcamento(consumo, limites, relogio), suspensao: new InMemorySuspensoes(), relogio }))
    const tutor = (escolaId: string, alunoId: string) => ia.gerar({ tarefa: turnoDoTutor, entrada: entradaDoTutor('não entendi essa'), escolaId, alunoId })
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
    const gerar = (escolaId: string) => ia.gerar({ tarefa: gerarAtividadeObjetiva, entrada: entradaDeAtividade(), escolaId })
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
    await expect(new InMemoryOrcamento(consumo).consultar({ funcao: 'conversa_e_ferramentas' })).rejects.toThrow('sem escola no contexto')
    expect(consumo.registros).toEqual([])
  })

  it('o consumo fica na escola do contexto, e o orçamento conta só a escola em que é perguntado', async () => {
    const consumo = new InMemoryConsumo()
    const orcamento = new InMemoryOrcamento(consumo, { trocasPorAlunoNoDia: 1 })
    const troca = { ...consumidaDeMedida(), funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 } as const
    await noContexto(ESCOLA_A, () => consumo.registrar(troca))
    expect(consumo.registros.map((registro) => registro.escolaId)).toEqual([ESCOLA_A])
    expect(await noContexto(ESCOLA_A, () => orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 }))).toEqual({ permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' })
    expect(await noContexto(ESCOLA_B, () => orcamento.consultar({ funcao: 'tutor_com_o_aluno', alunoId: ALUNO_1 }))).toEqual({ permitido: true })
  })

  it('a suspensão da escola A não vale no contexto da B', async () => {
    const suspensao = new InMemorySuspensoes()
    suspensao.suspender(ESCOLA_A, 'adaptacao')
    expect(await noContexto(ESCOLA_A, () => suspensao.estaSuspensa('adaptacao'))).toBe(true)
    expect(await noContexto(ESCOLA_B, () => suspensao.estaSuspensa('adaptacao'))).toBe(false)
  })
})
