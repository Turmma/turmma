import { parseEnv } from 'node:util'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  loadLLMConfig,
  MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO,
  MOTIVO_EXECUCAO_MAIS_CURTA_QUE_A_CHAMADA,
  MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO,
  MOTIVO_LLM_SEM_ENDERECO,
  MOTIVO_LLM_SEM_MODELO,
  MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA,
  MOTIVO_PROVEDOR_ID_DE_EXEMPLO,
  MOTIVO_RECUO_MAIOR_QUE_O_PRAZO,
  MOTIVO_SEM_PROVEDOR_ID,
  MOTIVO_VAGAS_DE_IA_INCOERENTES,
} from './llm-config.js'
import { InvalidConfigError } from './validate-config.js'

const LOCAL = { AMBIENTE: 'local' }
/** Fora da nossa rede (o padrão) o provedor tem de ter id; o teste que prova a exigência o tira. */
const LLAMA = { ...LOCAL, IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'http://127.0.0.1:8080/v1', LLM_MODELO: 'qwen3-8b', IA_PROVEDOR_ID: 'provedor-de-teste' }
const SEM_PROVEDOR = { IA_PROVEDOR_ID: undefined }
const PRAZOS_PADRAO = { rapido: 20_000, padrao: 60_000, complexo: 60_000, visao: 60_000 }

function erroDe(ambiente: Record<string, string | undefined>): InvalidConfigError {
  try {
    loadLLMConfig(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração deveria ter sido recusada')
}

describe('lerConfiguracaoDeIa', () => {
  it('sem nenhuma variável de IA, sobe com o adaptador falso: nada novo é obrigatório', () => {
    expect(loadLLMConfig(LOCAL)).toEqual({ adaptador: 'falso', prazosMs: PRAZOS_PADRAO, recuoMs: 500, executor: { vagasPorEscola: 2, vagasNoTotal: 8, timeoutMs: 150_000 } })
  })

  it('o prazo de cada perfil: 20 s no `rapido`, 60 s no `padrao`, e o `LLM_TIMEOUT_MS` nos que não têm o seu', () => {
    expect(loadLLMConfig(LOCAL).prazosMs).toEqual({ rapido: 20_000, padrao: 60_000, complexo: 60_000, visao: 60_000 })
    // Um valor para cada variável: trocar uma pela outra, ou esquecer uma, muda o que sai.
    const ambiente = { ...LOCAL, LLM_TIMEOUT_MS: '45000', LLM_TIMEOUT_MS_RAPIDO: '15000', LLM_TIMEOUT_MS_PADRAO: '90000' }
    expect(loadLLMConfig(ambiente).prazosMs).toEqual({ rapido: 15_000, padrao: 90_000, complexo: 45_000, visao: 45_000 })
    expect(loadLLMConfig({ ...ambiente, LLM_TIMEOUT_MS_RAPIDO: '', LLM_TIMEOUT_MS_PADRAO: '' }).prazosMs).toEqual({ rapido: 20_000, padrao: 60_000, complexo: 45_000, visao: 45_000 })
  })

  it('variável vazia, como o compose entrega a que não tem valor, vale como ausente', () => {
    const vazias = { ...LOCAL, IA_ADAPTADOR: '', LLM_BASE_URL: '', LLM_MODELO: '', LLM_TIMEOUT_MS: '', LLM_PROCESSAMENTO_LOCAL: '', IA_EXECUCOES_POR_ESCOLA: '' }
    expect(loadLLMConfig(vazias)).toEqual(loadLLMConfig(LOCAL))
  })

  it('.env.example e o ambiente de teste sobem com o adaptador falso', () => {
    const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
    const exemplo = parseEnv(readFileSync(`${raiz}.env.example`, 'utf8'))
    const teste = { ...exemplo, ...parseEnv(readFileSync(`${raiz}infra/teste.env`, 'utf8')) }
    expect(exemplo['IA_ADAPTADOR']).toBe('falso')
    expect(loadLLMConfig(exemplo).adaptador).toBe('falso')
    expect(loadLLMConfig(teste).adaptador).toBe('falso')
    // O que está no exemplo para o ensaio com o modelo local já é uma configuração válida: basta trocar o adaptador.
    expect(loadLLMConfig({ ...exemplo, IA_ADAPTADOR: 'openai_compat' }).modelo).toMatchObject({ baseUrl: exemplo['LLM_BASE_URL'], processamentoLocal: true })
  })

  it('em produção o adaptador falso é recusado: escola real não recebe conteúdo de demonstração', () => {
    const erro = erroDe({ AMBIENTE: 'producao' })
    expect(erro.variaveis).toEqual(['IA_ADAPTADOR'])
    expect(erro.motivos).toEqual([MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO])
    expect(loadLLMConfig({ ...LLAMA, AMBIENTE: 'producao', LLM_BASE_URL: 'https://api.provedor.example/v1' }).adaptador).toBe('openai_compat')
  })

  it('o modelo local: endereço, um id comum para os quatro perfis e processamento local declarado', () => {
    expect(loadLLMConfig({ ...LLAMA, ...SEM_PROVEDOR, LLM_PROCESSAMENTO_LOCAL: 'true', LLM_TIMEOUT_MS: '45000' })).toEqual({
      adaptador: 'openai_compat',
      prazosMs: { rapido: 20_000, padrao: 60_000, complexo: 45_000, visao: 45_000 },
      recuoMs: 500,
      executor: { vagasPorEscola: 2, vagasNoTotal: 8, timeoutMs: 150_000 },
      modelo: {
        baseUrl: 'http://127.0.0.1:8080/v1',
        modelos: { rapido: 'qwen3-8b', padrao: 'qwen3-8b', complexo: 'qwen3-8b', visao: 'qwen3-8b' },
        processamentoLocal: true,
      },
    })
  })

  it('o recuo da repetição em 429 e conexão recusada é configurável e precisa caber no prazo da chamada, de todo perfil', () => {
    expect(loadLLMConfig({ ...LLAMA, LLM_RECUO_MS: '1500' }).recuoMs).toBe(1_500)
    expect(loadLLMConfig({ ...LLAMA, LLM_RECUO_MS: '0' }).recuoMs).toBe(0)
    expect(erroDe({ ...LLAMA, LLM_RECUO_MS: '60000', LLM_TIMEOUT_MS: '60000' })).toMatchObject({ variaveis: ['LLM_RECUO_MS'], motivos: [MOTIVO_RECUO_MAIOR_QUE_O_PRAZO] })
    // O menor prazo manda, qualquer que seja o perfil dele: um caso para cada variável de prazo, no limite e logo abaixo.
    const prazos = ['LLM_TIMEOUT_MS', 'LLM_TIMEOUT_MS_RAPIDO', 'LLM_TIMEOUT_MS_PADRAO'] as const
    for (const variavel of prazos) {
      const outros = Object.fromEntries(prazos.filter((outro) => outro !== variavel).map((outro) => [outro, '90000']))
      expect(erroDe({ ...LLAMA, ...outros, [variavel]: '4000', LLM_RECUO_MS: '4000', IA_EXECUCAO_TIMEOUT_MS: '200000' }), variavel).toMatchObject({ variaveis: ['LLM_RECUO_MS'], motivos: [MOTIVO_RECUO_MAIOR_QUE_O_PRAZO] })
      expect(loadLLMConfig({ ...LLAMA, ...outros, [variavel]: '4000', LLM_RECUO_MS: '3999', IA_EXECUCAO_TIMEOUT_MS: '200000' }).recuoMs, variavel).toBe(3_999)
    }
  })

  it('o id por perfil vence o comum, e só o perfil declarado muda', () => {
    const { modelo } = loadLLMConfig({ ...LLAMA, LLM_MODELO_RAPIDO: 'qwen3-4b', LLM_MODELO_VISAO: 'qwen-vl' })
    expect(modelo?.modelos).toEqual({ rapido: 'qwen3-4b', padrao: 'qwen3-8b', complexo: 'qwen3-8b', visao: 'qwen-vl' })
  })

  it('sem o id comum, os quatro perfis precisam estar declarados', () => {
    const porPerfil = { LLM_MODELO_RAPIDO: 'a', LLM_MODELO_PADRAO: 'b', LLM_MODELO_COMPLEXO: 'c', LLM_MODELO_VISAO: 'd' }
    expect(loadLLMConfig({ ...LLAMA, LLM_MODELO: undefined, ...porPerfil }).modelo?.modelos).toEqual({ rapido: 'a', padrao: 'b', complexo: 'c', visao: 'd' })
    const erro = erroDe({ ...LLAMA, LLM_MODELO: undefined, ...porPerfil, LLM_MODELO_VISAO: undefined })
    expect(erro.variaveis).toEqual(['LLM_MODELO'])
    expect(erro.motivos).toEqual([MOTIVO_LLM_SEM_MODELO])
  })

  it('fora da nossa rede, o provedor precisa de id: sem IA_PROVEDOR_ID, ou com id fora do formato, a subida é recusada', () => {
    expect(erroDe({ ...LLAMA, ...SEM_PROVEDOR })).toMatchObject({ variaveis: ['IA_PROVEDOR_ID'], motivos: [MOTIVO_SEM_PROVEDOR_ID] })
    // O compose entrega a variável sem valor como texto vazio: vale como ausente.
    expect(erroDe({ ...LLAMA, IA_PROVEDOR_ID: '' })).toMatchObject({ variaveis: ['IA_PROVEDOR_ID'], motivos: [MOTIVO_SEM_PROVEDOR_ID] })
    // O formato é o da chave do suboperador: minúscula na frente, de 2 a 40 caracteres, sem nome de pessoa nem ponto.
    for (const invalido of ['Maritaca', '1maritaca', 'm', 'a'.repeat(41), 'maritaca.ai', 'maritaca ai', '-maritaca']) {
      expect(erroDe({ ...LLAMA, IA_PROVEDOR_ID: invalido }), invalido).toMatchObject({ variaveis: ['IA_PROVEDOR_ID'], motivos: [] })
    }
    for (const valido of ['ma', 'maritaca', 'google-vertex', 'provedor_reserva_2', 'a'.repeat(40)]) {
      expect(loadLLMConfig({ ...LLAMA, IA_PROVEDOR_ID: valido }).modelo?.provedorId, valido).toBe(valido)
    }
  })

  it('o id de exemplo do .env.example só vale em local: em staging e produção, com envio externo, a subida é recusada', () => {
    for (const ambiente of ['staging', 'producao']) {
      expect(erroDe({ ...LLAMA, AMBIENTE: ambiente, IA_PROVEDOR_ID: 'provedor-de-exemplo' }), ambiente).toMatchObject({ variaveis: ['IA_PROVEDOR_ID'], motivos: [MOTIVO_PROVEDOR_ID_DE_EXEMPLO] })
    }
    expect(loadLLMConfig({ ...LLAMA, AMBIENTE: 'local', IA_PROVEDOR_ID: 'provedor-de-exemplo' }).modelo?.provedorId).toBe('provedor-de-exemplo')
    expect(() => loadLLMConfig({ ...LLAMA, AMBIENTE: 'producao', LLM_PROCESSAMENTO_LOCAL: 'true', IA_PROVEDOR_ID: 'provedor-de-exemplo' })).not.toThrow()
  })

  it('com processamento local não há provedor a declarar: a variável é dispensada', () => {
    expect(loadLLMConfig({ ...LLAMA, ...SEM_PROVEDOR, LLM_PROCESSAMENTO_LOCAL: 'true' }).modelo).not.toHaveProperty('provedorId')
    // O id errado continua apontado: o formato vale com ou sem processamento local.
    expect(erroDe({ ...LLAMA, LLM_PROCESSAMENTO_LOCAL: 'true', IA_PROVEDOR_ID: 'Maritaca' }).variaveis).toEqual(['IA_PROVEDOR_ID'])
  })

  it('openai_compat sem endereço, ou com endereço que não é http, não sobe', () => {
    expect(erroDe({ ...LLAMA, LLM_BASE_URL: undefined })).toMatchObject({ variaveis: ['LLM_BASE_URL'], motivos: [MOTIVO_LLM_SEM_ENDERECO] })
    expect(erroDe({ ...LLAMA, LLM_BASE_URL: 'ftp://127.0.0.1/v1' }).variaveis).toEqual(['LLM_BASE_URL'])
    expect(erroDe({ ...LLAMA, LLM_BASE_URL: 'llama' }).variaveis).toEqual(['LLM_BASE_URL'])
  })

  it('por padrão a chamada conta como envio externo; local só vale para endereço da nossa máquina ou rede', () => {
    expect(loadLLMConfig({ ...LLAMA }).modelo?.processamentoLocal).toBe(false)
    for (const endereco of ['http://127.0.0.1:8080/v1', 'http://localhost:8080/v1', 'http://host.docker.internal:8080/v1', 'http://llama:8080/v1', 'http://192.168.0.20:8080/v1', 'http://10.1.2.3/v1']) {
      expect(loadLLMConfig({ ...LLAMA, LLM_BASE_URL: endereco, LLM_PROCESSAMENTO_LOCAL: 'true' }).modelo?.processamentoLocal, endereco).toBe(true)
    }
    const erro = erroDe({ ...LLAMA, LLM_BASE_URL: 'https://api.provedor.example/v1', LLM_PROCESSAMENTO_LOCAL: 'true' })
    expect(erro.variaveis).toEqual(['LLM_PROCESSAMENTO_LOCAL'])
    expect(erro.motivos).toEqual([MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA])
  })

  it.each([
    'http://127.0.0.1:8080/v1',
    'http://localhost:8080/v1',
    'http://host.docker.internal:8080/v1',
    'http://llama:8080/v1',
    'http://10.1.2.3/v1',
    'http://172.16.0.9/v1',
    'http://172.31.255.1/v1',
    'http://192.168.0.20:8080/v1',
    'http://[::1]:8080/v1',
    'http://[fd12:3456:789a::1]/v1',
    'http://[fe80::1]/v1',
  ])('processamento local vale para %s', (endereco) => {
    expect(loadLLMConfig({ ...LLAMA, LLM_BASE_URL: endereco, LLM_PROCESSAMENTO_LOCAL: 'true' }).modelo?.processamentoLocal).toBe(true)
  })

  it.each([
    // IPv6 público não tem ponto, e nome com ponto pode começar como faixa privada: nenhum dos dois é rede nossa.
    'http://[2606:4700:4700::1111]/v1',
    'https://10.provedor.com/v1',
    'https://192.168.provedor.com/v1',
    'http://172.15.0.1/v1',
    'http://172.32.0.1/v1',
    'http://8.8.8.8/v1',
    'http://[2001:db8::1]/v1',
    'https://api.provedor.example/v1',
    'https://localhost.provedor.com/v1',
  ])('processamento local declarado com %s não sobe: a chamada ficaria gravada como se não saísse daqui', (endereco) => {
    const erro = erroDe({ ...LLAMA, LLM_BASE_URL: endereco, LLM_PROCESSAMENTO_LOCAL: 'true' })
    expect(erro.variaveis).toEqual(['LLM_PROCESSAMENTO_LOCAL'])
    expect(erro.motivos).toEqual([MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA])
    // Sem a declaração, o mesmo endereço sobe, e a chamada conta como envio externo.
    expect(loadLLMConfig({ ...LLAMA, LLM_BASE_URL: endereco }).modelo?.processamentoLocal).toBe(false)
  })

  it('a chave do provedor entra na configuração e nunca na mensagem de erro', () => {
    const chave = 'chave-sintetica-que-nao-pode-vazar'
    expect(loadLLMConfig({ ...LLAMA, LLM_CHAVE_API: chave }).modelo?.chaveApi).toBe(chave)
    expect(loadLLMConfig({ ...LLAMA }).modelo).not.toHaveProperty('chaveApi')
    const erro = erroDe({ ...LLAMA, LLM_CHAVE_API: chave, LLM_TIMEOUT_MS: 'abc' })
    expect(erro.variaveis).toEqual(['LLM_TIMEOUT_MS'])
    expect(`${erro.message} ${JSON.stringify(erro.motivos)}`).not.toContain(chave)
  })

  it('o prazo da execução precisa ser maior que o da chamada, de todo perfil, e uma escola não pode ter mais vagas que o total', () => {
    expect(erroDe({ ...LOCAL, LLM_TIMEOUT_MS: '60000', IA_EXECUCAO_TIMEOUT_MS: '60000' })).toMatchObject({ variaveis: ['IA_EXECUCAO_TIMEOUT_MS'], motivos: [MOTIVO_EXECUCAO_MAIS_CURTA_QUE_A_CHAMADA] })
    // O maior prazo manda, qualquer que seja o perfil dele: o `rapido` e o `padrao` também seguram a execução.
    for (const variavel of ['LLM_TIMEOUT_MS_RAPIDO', 'LLM_TIMEOUT_MS_PADRAO']) {
      expect(erroDe({ ...LOCAL, [variavel]: '150000', IA_EXECUCAO_TIMEOUT_MS: '150000' }), variavel).toMatchObject({ variaveis: ['IA_EXECUCAO_TIMEOUT_MS'], motivos: [MOTIVO_EXECUCAO_MAIS_CURTA_QUE_A_CHAMADA] })
      expect(loadLLMConfig({ ...LOCAL, [variavel]: '149999', IA_EXECUCAO_TIMEOUT_MS: '150000' }).executor.timeoutMs, variavel).toBe(150_000)
    }
    expect(erroDe({ ...LOCAL, IA_EXECUCOES_POR_ESCOLA: '9', IA_EXECUCOES_TOTAL: '8' })).toMatchObject({ variaveis: ['IA_EXECUCOES_POR_ESCOLA'], motivos: [MOTIVO_VAGAS_DE_IA_INCOERENTES] })
    expect(loadLLMConfig({ ...LOCAL, IA_EXECUCOES_POR_ESCOLA: '3', IA_EXECUCOES_TOTAL: '12', IA_EXECUCAO_TIMEOUT_MS: '90000' }).executor).toEqual({ vagasPorEscola: 3, vagasNoTotal: 12, timeoutMs: 90_000 })
  })

  it('a latência simulada do adaptador falso (teste de carga, regra 80, item 11): ausente ou zero não espera, e precisa caber no prazo da chamada', () => {
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS: '250' }).latenciaFalsaMs).toBe(250)
    expect(loadLLMConfig({ ...LOCAL }).latenciaFalsaMs).toBeUndefined()
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS: '0' }).latenciaFalsaMs).toBeUndefined()
    // O compose entrega a variável sem valor como texto vazio: vale como ausente.
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS: '' }).latenciaFalsaMs).toBeUndefined()
    expect(erroDe({ ...LOCAL, IA_LATENCIA_FALSA_MS: '-1' }).variaveis).toEqual(['IA_LATENCIA_FALSA_MS'])
    expect(erroDe({ ...LOCAL, IA_LATENCIA_FALSA_MS: '60001' }).variaveis).toEqual(['IA_LATENCIA_FALSA_MS'])
    // Com o prazo da chamada maior que o teto, é o teto da variável (60 s) que recusa, e não a comparação com o prazo.
    const comPrazoLongo = { ...LOCAL, LLM_TIMEOUT_MS: '120000', LLM_TIMEOUT_MS_RAPIDO: '120000', LLM_TIMEOUT_MS_PADRAO: '120000', IA_EXECUCAO_TIMEOUT_MS: '300000' }
    expect(loadLLMConfig({ ...comPrazoLongo, IA_LATENCIA_FALSA_MS: '60000' }).latenciaFalsaMs).toBe(60_000)
    expect(erroDe({ ...comPrazoLongo, IA_LATENCIA_FALSA_MS: '60001' }).variaveis).toEqual(['IA_LATENCIA_FALSA_MS'])
    expect(erroDe({ ...LOCAL, LLM_TIMEOUT_MS: '5000', IA_LATENCIA_FALSA_MS: '5000' })).toMatchObject({
      variaveis: ['IA_LATENCIA_FALSA_MS'],
      motivos: [MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO],
    })
    expect(loadLLMConfig({ ...LOCAL, LLM_TIMEOUT_MS: '5000', IA_LATENCIA_FALSA_MS: '4999' }).latenciaFalsaMs).toBe(4_999)
  })

  it('a latência simulada cabe no prazo de cada perfil, e não só no global: o `rapido` e o `padrao` têm o seu', () => {
    // Com o prazo padrão de 20 s no `rapido`, 20 s de latência estourariam toda chamada do Tutor ao adaptador falso.
    expect(erroDe({ ...LOCAL, IA_LATENCIA_FALSA_MS: '20000' })).toMatchObject({ variaveis: ['IA_LATENCIA_FALSA_MS'], motivos: [MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO] })
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS: '19999' }).latenciaFalsaMs).toBe(19_999)
    expect(erroDe({ ...LOCAL, LLM_TIMEOUT_MS_PADRAO: '5000', IA_LATENCIA_FALSA_MS: '5000' })).toMatchObject({ variaveis: ['IA_LATENCIA_FALSA_MS'], motivos: [MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO] })
    expect(loadLLMConfig({ ...LOCAL, LLM_TIMEOUT_MS_PADRAO: '5000', IA_LATENCIA_FALSA_MS: '4999' }).latenciaFalsaMs).toBe(4_999)
    expect(erroDe({ ...LOCAL, LLM_TIMEOUT_MS_RAPIDO: '5000', IA_LATENCIA_FALSA_MS: '5000' })).toMatchObject({ variaveis: ['IA_LATENCIA_FALSA_MS'], motivos: [MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO] })
    expect(loadLLMConfig({ ...LOCAL, LLM_TIMEOUT_MS_RAPIDO: '5000', IA_LATENCIA_FALSA_MS: '4999' }).latenciaFalsaMs).toBe(4_999)
  })

  it.each([
    ['IA_ADAPTADOR', 'ollama'],
    ['LLM_TIMEOUT_MS', '0'],
    ['LLM_TIMEOUT_MS_RAPIDO', '999'],
    ['LLM_TIMEOUT_MS_RAPIDO', '600001'],
    ['LLM_TIMEOUT_MS_PADRAO', '0'],
    ['LLM_TIMEOUT_MS_PADRAO', '600001'],
    ['LLM_TIMEOUT_MS_PADRAO', 'um minuto'],
    ['LLM_PROCESSAMENTO_LOCAL', 'sim'],
    ['IA_EXECUCOES_POR_ESCOLA', '0'],
    ['IA_EXECUCAO_TIMEOUT_MS', 'dois minutos'],
  ])('recusa %s="%s"', (variavel, valor) => {
    // Um prazo inválido também reprova o que se compara com ele; o que importa é a variável errada estar apontada.
    expect(erroDe({ ...LLAMA, [variavel]: valor }).variaveis).toContain(variavel)
  })

  it('endereço inválido com processamento local declarado aponta só o endereço, sem quebrar a validação', () => {
    expect(erroDe({ ...LLAMA, LLM_BASE_URL: 'llama', LLM_PROCESSAMENTO_LOCAL: 'true' }).variaveis).toEqual(['LLM_BASE_URL'])
  })
})
