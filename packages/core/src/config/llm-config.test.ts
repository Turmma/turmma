import { parseEnv } from 'node:util'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  IDENTIDADE_DA_RESERVA_FALSA,
  loadLLMConfig,
  MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO,
  MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO,
  MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO,
  MOTIVO_LLM_SEM_ENDERECO,
  MOTIVO_LLM_SEM_MODELO,
  MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA,
  MOTIVO_PROVEDOR_ID_DE_EXEMPLO,
  MOTIVO_RECUO_MAIOR_QUE_O_PRAZO,
  MOTIVO_RESERVA_COM_A_IDENTIDADE_DO_PRINCIPAL,
  MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO,
  MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL,
  MOTIVO_RESERVA_FALSA_EM_PRODUCAO,
  MOTIVO_RESERVA_SEM_ADAPTADOR,
  MOTIVO_RESERVA_SEM_ENDERECO,
  MOTIVO_RESERVA_SEM_MODELO,
  MOTIVO_RESERVA_SEM_PROVEDOR_ID,
  MOTIVO_SEM_PROVEDOR_ID,
  MOTIVO_SEM_TOKENS_POR_MINUTO,
  MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA,
} from './llm-config.js'
import { InvalidConfigError } from './validate-config.js'

const LOCAL = { AMBIENTE: 'local' }
/** Fora da nossa rede (o padrão) o provedor tem de ter id; o teste que prova a exigência o tira. */
const LLAMA = { ...LOCAL, IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'http://127.0.0.1:8080/v1', LLM_MODELO: 'qwen3-8b', IA_PROVEDOR_ID: 'provedor-de-teste' }
const SEM_PROVEDOR = { IA_PROVEDOR_ID: undefined }
/** O contratado: fora de `local` a variável é obrigatória. */
const TOKENS = { LLM_TOKENS_POR_MINUTO: '2500000' }
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

describe('loadLLMConfig', () => {
  it('sem nenhuma variável de IA, sobe com o adaptador falso: nada novo é obrigatório', () => {
    expect(loadLLMConfig(LOCAL)).toEqual({ adaptador: 'falso', prazosMs: PRAZOS_PADRAO, recuoMs: 500, replicas: 1 })
  })

  it('o prazo de cada perfil: 20 s no `rapido`, 60 s no `padrao`, e o `LLM_TIMEOUT_MS` nos que não têm o seu', () => {
    expect(loadLLMConfig(LOCAL).prazosMs).toEqual({ rapido: 20_000, padrao: 60_000, complexo: 60_000, visao: 60_000 })
    // Um valor para cada variável: trocar uma pela outra, ou esquecer uma, muda o que sai.
    const ambiente = { ...LOCAL, LLM_TIMEOUT_MS: '45000', LLM_TIMEOUT_MS_RAPIDO: '15000', LLM_TIMEOUT_MS_PADRAO: '90000' }
    expect(loadLLMConfig(ambiente).prazosMs).toEqual({ rapido: 15_000, padrao: 90_000, complexo: 45_000, visao: 45_000 })
    expect(loadLLMConfig({ ...ambiente, LLM_TIMEOUT_MS_RAPIDO: '', LLM_TIMEOUT_MS_PADRAO: '' }).prazosMs).toEqual({ rapido: 20_000, padrao: 60_000, complexo: 45_000, visao: 45_000 })
  })

  it('variável vazia, como o compose entrega a que não tem valor, vale como ausente', () => {
    const vazias = { ...LOCAL, IA_ADAPTADOR: '', LLM_BASE_URL: '', LLM_MODELO: '', LLM_TIMEOUT_MS: '', LLM_PROCESSAMENTO_LOCAL: '', IA_REPLICAS: '' }
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
    const erro = erroDe({ AMBIENTE: 'producao', ...TOKENS })
    expect(erro.variaveis).toEqual(['IA_ADAPTADOR'])
    expect(erro.motivos).toEqual([MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO])
    expect(loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: 'producao', LLM_BASE_URL: 'https://api.provedor.example/v1' }).adaptador).toBe('openai_compat')
  })

  it('o modelo local: endereço, um id comum para os quatro perfis e processamento local declarado', () => {
    expect(loadLLMConfig({ ...LLAMA, ...SEM_PROVEDOR, LLM_PROCESSAMENTO_LOCAL: 'true', LLM_TIMEOUT_MS: '45000' })).toEqual({
      adaptador: 'openai_compat',
      prazosMs: { rapido: 20_000, padrao: 60_000, complexo: 45_000, visao: 45_000 },
      recuoMs: 500,
      replicas: 1,
      modelo: {
        baseUrl: 'http://127.0.0.1:8080/v1',
        modelos: { rapido: 'qwen3-8b', padrao: 'qwen3-8b', complexo: 'qwen3-8b', visao: 'qwen3-8b' },
        variaveisDosModelos: { rapido: 'LLM_MODELO', padrao: 'LLM_MODELO', complexo: 'LLM_MODELO', visao: 'LLM_MODELO' },
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
      expect(erroDe({ ...LLAMA, ...outros, [variavel]: '4000', LLM_RECUO_MS: '4000' }), variavel).toMatchObject({ variaveis: ['LLM_RECUO_MS'], motivos: [MOTIVO_RECUO_MAIOR_QUE_O_PRAZO] })
      expect(loadLLMConfig({ ...LLAMA, ...outros, [variavel]: '4000', LLM_RECUO_MS: '3999' }).recuoMs, variavel).toBe(3_999)
    }
  })

  it('o id por perfil vence o comum, e só o perfil declarado muda', () => {
    const { modelo } = loadLLMConfig({ ...LLAMA, LLM_MODELO_RAPIDO: 'qwen3-4b', LLM_MODELO_VISAO: 'qwen-vl' })
    expect(modelo?.modelos).toEqual({ rapido: 'qwen3-4b', padrao: 'qwen3-8b', complexo: 'qwen3-8b', visao: 'qwen-vl' })
  })

  it('de qual variável vem o modelo de cada perfil: a do perfil quando ele tem a sua, a comum nos outros (é a que a subida cita quando falta preço)', () => {
    const { modelo } = loadLLMConfig({ ...LLAMA, LLM_MODELO_RAPIDO: 'qwen3-4b', LLM_MODELO_VISAO: 'qwen-vl' })
    expect(modelo?.variaveisDosModelos).toEqual({ rapido: 'LLM_MODELO_RAPIDO', padrao: 'LLM_MODELO', complexo: 'LLM_MODELO', visao: 'LLM_MODELO_VISAO' })
  })

  it('fora de `local`, com `openai_compat`, o preço do modelo é exigido na subida; em `local` e com o adaptador falso, não', () => {
    expect(loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: 'producao' })).toHaveProperty('exigePreco', true)
    expect(loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: 'staging' })).toHaveProperty('exigePreco', true)
    expect(loadLLMConfig(LLAMA)).not.toHaveProperty('exigePreco')
    expect(loadLLMConfig({ ...LOCAL, ...TOKENS, AMBIENTE: 'staging' })).not.toHaveProperty('exigePreco')
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
      expect(erroDe({ ...LLAMA, ...TOKENS, AMBIENTE: ambiente, IA_PROVEDOR_ID: 'provedor-de-exemplo' }), ambiente).toMatchObject({ variaveis: ['IA_PROVEDOR_ID'], motivos: [MOTIVO_PROVEDOR_ID_DE_EXEMPLO] })
    }
    expect(loadLLMConfig({ ...LLAMA, AMBIENTE: 'local', IA_PROVEDOR_ID: 'provedor-de-exemplo' }).modelo?.provedorId).toBe('provedor-de-exemplo')
    expect(() => loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: 'producao', LLM_PROCESSAMENTO_LOCAL: 'true', IA_PROVEDOR_ID: 'provedor-de-exemplo' })).not.toThrow()
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

  it('as réplicas do worker de IA: uma por padrão, e o número do compose quando ele diz (o teto de tokens se divide entre elas)', () => {
    expect(loadLLMConfig(LOCAL).replicas).toBe(1)
    expect(loadLLMConfig({ ...LOCAL, IA_REPLICAS: '2' }).replicas).toBe(2)
    expect(erroDe({ ...LOCAL, IA_REPLICAS: '0' }).variaveis).toEqual(['IA_REPLICAS'])
    expect(erroDe({ ...LOCAL, IA_REPLICAS: 'duas' }).variaveis).toEqual(['IA_REPLICAS'])
  })

  it('o prazo da execução não é variável: IA_EXECUCAO_TIMEOUT_MS e as vagas do processo saíram, e o prazo vem do perfil da tarefa', () => {
    // Variável que saiu não é lida: um valor absurdo nela não recusa a subida.
    expect(loadLLMConfig({ ...LOCAL, IA_EXECUCAO_TIMEOUT_MS: 'dois minutos', IA_EXECUCOES_POR_ESCOLA: '0', IA_EXECUCOES_TOTAL: 'muitas' })).toEqual(loadLLMConfig(LOCAL))
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
    const comPrazoLongo = { ...LOCAL, LLM_TIMEOUT_MS: '120000', LLM_TIMEOUT_MS_RAPIDO: '120000', LLM_TIMEOUT_MS_PADRAO: '120000' }
    expect(loadLLMConfig({ ...comPrazoLongo, IA_LATENCIA_FALSA_MS: '60000' }).latenciaFalsaMs).toBe(60_000)
    expect(erroDe({ ...comPrazoLongo, IA_LATENCIA_FALSA_MS: '60001' }).variaveis).toEqual(['IA_LATENCIA_FALSA_MS'])
    expect(erroDe({ ...LOCAL, LLM_TIMEOUT_MS: '5000', IA_LATENCIA_FALSA_MS: '5000' })).toMatchObject({
      variaveis: ['IA_LATENCIA_FALSA_MS'],
      motivos: [MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO],
    })
    expect(loadLLMConfig({ ...LOCAL, LLM_TIMEOUT_MS: '5000', IA_LATENCIA_FALSA_MS: '4999' }).latenciaFalsaMs).toBe(4_999)
  })

  it('a latência do perfil `padrao` do adaptador falso (a ferramenta de ~50 s, X6, 11.0): ausente ou zero não existe, e é menor que o prazo do `padrao`, e não que o menor de todos', () => {
    expect(loadLLMConfig(LOCAL).latenciaFalsaMsPadrao).toBeUndefined()
    expect(loadLLMConfig(LOCAL).latenciaFalsaMs).toBeUndefined()
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS: '0' }).latenciaFalsaMs).toBeUndefined()
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS_PADRAO: '0' }).latenciaFalsaMsPadrao).toBeUndefined()
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS_PADRAO: '' }).latenciaFalsaMsPadrao).toBeUndefined()
    // 50 s cabem no prazo de 60 s do `padrao`, mesmo acima do prazo de 20 s do `rapido`: é a regra do perfil, e não a do menor prazo.
    expect(loadLLMConfig({ ...LOCAL, IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000' })).toMatchObject({ latenciaFalsaMs: 6_000, latenciaFalsaMsPadrao: 50_000 })
    expect(erroDe({ ...LOCAL, IA_LATENCIA_FALSA_MS_PADRAO: '60000' })).toMatchObject({
      variaveis: ['IA_LATENCIA_FALSA_MS_PADRAO'],
      motivos: [MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO],
    })
    expect(erroDe({ ...LOCAL, LLM_TIMEOUT_MS_PADRAO: '5000', IA_LATENCIA_FALSA_MS_PADRAO: '5000' }).variaveis).toEqual(['IA_LATENCIA_FALSA_MS_PADRAO'])
    expect(loadLLMConfig({ ...LOCAL, LLM_TIMEOUT_MS_PADRAO: '5000', IA_LATENCIA_FALSA_MS_PADRAO: '4999' }).latenciaFalsaMsPadrao).toBe(4_999)
    expect(erroDe({ ...LOCAL, IA_LATENCIA_FALSA_MS_PADRAO: '60001' }).variaveis).toEqual(['IA_LATENCIA_FALSA_MS_PADRAO'])
  })

  it('os tokens que o adaptador falso informa (X6, 11.0): sem nenhum dos dois é a estimativa pelo texto, e com um deles o outro vale zero', () => {
    expect(loadLLMConfig(LOCAL).tokensFalsos).toBeUndefined()
    expect(loadLLMConfig({ ...LOCAL, IA_TOKENS_FALSOS_ENTRADA: '0', IA_TOKENS_FALSOS_SAIDA: '' }).tokensFalsos).toBeUndefined()
    expect(loadLLMConfig({ ...LOCAL, IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' }).tokensFalsos).toEqual({ entrada: 3_000, saida: 250 })
    expect(loadLLMConfig({ ...LOCAL, IA_TOKENS_FALSOS_SAIDA: '250' }).tokensFalsos).toEqual({ entrada: 0, saida: 250 })
    expect(loadLLMConfig({ ...LOCAL, IA_TOKENS_FALSOS_ENTRADA: '3000' }).tokensFalsos).toEqual({ entrada: 3_000, saida: 0 })
    expect(erroDe({ ...LOCAL, IA_TOKENS_FALSOS_ENTRADA: '-1' }).variaveis).toEqual(['IA_TOKENS_FALSOS_ENTRADA'])
    expect(erroDe({ ...LOCAL, IA_TOKENS_FALSOS_SAIDA: '1000001' }).variaveis).toEqual(['IA_TOKENS_FALSOS_SAIDA'])
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
    ['IA_REPLICAS', '0'],
  ])('recusa %s="%s"', (variavel, valor) => {
    // Um prazo inválido também reprova o que se compara com ele; o que importa é a variável errada estar apontada.
    expect(erroDe({ ...LLAMA, [variavel]: valor }).variaveis).toContain(variavel)
  })

  it('endereço inválido com processamento local declarado aponta só o endereço, sem quebrar a validação', () => {
    expect(erroDe({ ...LLAMA, LLM_BASE_URL: 'llama', LLM_PROCESSAMENTO_LOCAL: 'true' }).variaveis).toEqual(['LLM_BASE_URL'])
  })

  it('LLM_TOKENS_POR_MINUTO é obrigatória fora de local e opcional no local (49.0)', () => {
    for (const ambiente of ['staging', 'producao']) {
      expect(erroDe({ ...LLAMA, AMBIENTE: ambiente }), ambiente).toMatchObject({ variaveis: ['LLM_TOKENS_POR_MINUTO'], motivos: [MOTIVO_SEM_TOKENS_POR_MINUTO] })
      // O compose entrega a variável sem valor como texto vazio: vale como ausente, e a subida recusa do mesmo jeito.
      expect(erroDe({ ...LLAMA, AMBIENTE: ambiente, LLM_TOKENS_POR_MINUTO: '' }).variaveis, ambiente).toEqual(['LLM_TOKENS_POR_MINUTO'])
      expect(loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: ambiente }).tokensPorMinuto, ambiente).toBe(2_500_000)
    }
    expect(loadLLMConfig(LOCAL)).not.toHaveProperty('tokensPorMinuto')
    expect(loadLLMConfig({ ...LOCAL, ...TOKENS }).tokensPorMinuto).toBe(2_500_000)
    // Valor que não é número inteiro razoável é recusado, com o nome da variável.
    expect(erroDe({ ...LOCAL, LLM_TOKENS_POR_MINUTO: 'muito' }).variaveis).toEqual(['LLM_TOKENS_POR_MINUTO'])
    expect(erroDe({ ...LOCAL, LLM_TOKENS_POR_MINUTO: '999' }).variaveis).toEqual(['LLM_TOKENS_POR_MINUTO'])
  })

  it('o modelo menor é opcional por perfil: só o perfil declarado entra, e sem nenhum a configuração não o traz (49.0)', () => {
    expect(loadLLMConfig(LOCAL)).not.toHaveProperty('modelosMenores')
    expect(loadLLMConfig({ ...LOCAL, LLM_MODELO_MENOR_RAPIDO: '', LLM_MODELO_MENOR_PADRAO: '' })).not.toHaveProperty('modelosMenores')
    const menores = { LLM_MODELO_MENOR_RAPIDO: 'a', LLM_MODELO_MENOR_PADRAO: 'b', LLM_MODELO_MENOR_COMPLEXO: 'c', LLM_MODELO_MENOR_VISAO: 'd' }
    expect(loadLLMConfig({ ...LOCAL, ...menores }).modelosMenores).toEqual({ rapido: 'a', padrao: 'b', complexo: 'c', visao: 'd' })
    expect(loadLLMConfig({ ...LOCAL, LLM_MODELO_MENOR_PADRAO: 'b' }).modelosMenores).toEqual({ padrao: 'b' })
  })

  it('as variáveis que a 5.0 tirou (IA_EXECUCOES_POR_ESCOLA, IA_EXECUCOES_TOTAL, IA_EXECUCAO_TIMEOUT_MS) não existem mais na configuração nem no exemplo', () => {
    const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
    const exemplo = readFileSync(`${raiz}.env.example`, 'utf8')
    const compose = readFileSync(`${raiz}infra/compose.yml`, 'utf8')
    const fonte = readFileSync(fileURLToPath(new URL('./llm-config.ts', import.meta.url)), 'utf8')
    for (const saiu of ['IA_EXECUCOES_POR_ESCOLA', 'IA_EXECUCOES_TOTAL', 'IA_EXECUCAO_TIMEOUT_MS']) {
      expect(exemplo, saiu).not.toContain(saiu)
      expect(compose, saiu).not.toContain(saiu)
      expect(fonte, saiu).not.toContain(saiu)
    }
  })

  it('o .env.example declara o contratado e o compose o entrega à API e ao worker de IA (49.0)', () => {
    const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
    const exemplo = parseEnv(readFileSync(`${raiz}.env.example`, 'utf8'))
    expect(Number(exemplo['LLM_TOKENS_POR_MINUTO'])).toBeGreaterThanOrEqual(1_000)
    const compose = readFileSync(`${raiz}infra/compose.yml`, 'utf8')
    expect(compose.match(/LLM_TOKENS_POR_MINUTO: \$\{LLM_TOKENS_POR_MINUTO:\?/g)).toHaveLength(2)
  })
})

/** A reserva de verdade: outro provedor, com o endereço, o modelo e a identidade dela. Cada variável sai uma vez nos casos de reserva meio configurada. */
const RESERVA = { IA_RESERVA_ADAPTADOR: 'openai_compat', LLM_RESERVA_BASE_URL: 'https://reserva.provedor.test/v1', LLM_RESERVA_MODELO: 'modelo-da-reserva', IA_RESERVA_PROVEDOR_ID: 'provedor-de-reserva' }
const TOKENS_DA_RESERVA = { LLM_RESERVA_TOKENS_POR_MINUTO: '1500000' }
/** O principal em produção, com o contratado dele: o único defeito de cada caso é o da reserva. */
const PRINCIPAL_EM_PRODUCAO = { ...LLAMA, ...TOKENS, AMBIENTE: 'producao' }

describe('loadLLMConfig: o provedor de reserva (reserva-e-avaliacao, 1.0)', () => {
  it('sem IA_RESERVA_ADAPTADOR não há reserva, e variável vazia (como o compose entrega) vale como ausente', () => {
    expect(loadLLMConfig(LOCAL)).not.toHaveProperty('reserva')
    expect(loadLLMConfig({ ...LOCAL, IA_RESERVA_ADAPTADOR: '', LLM_RESERVA_BASE_URL: '', IA_RESERVA_PROVEDOR_ID: '' })).not.toHaveProperty('reserva')
  })

  it('a reserva falsa assume a identidade `falso-reserva`, a menos que IA_RESERVA_PROVEDOR_ID diga outra, e não tem modelo nem preço exigido', () => {
    expect(loadLLMConfig({ ...LOCAL, IA_RESERVA_ADAPTADOR: 'falso' }).reserva).toEqual({ adaptador: 'falso', identidade: IDENTIDADE_DA_RESERVA_FALSA, ambiente: 'local' })
    expect(IDENTIDADE_DA_RESERVA_FALSA).toBe('falso-reserva')
    expect(loadLLMConfig({ ...LOCAL, IA_RESERVA_ADAPTADOR: 'falso', IA_RESERVA_PROVEDOR_ID: 'outra-falsa' }).reserva).toMatchObject({ identidade: 'outra-falsa' })
    expect(loadLLMConfig({ ...LOCAL, ...TOKENS, AMBIENTE: 'staging', IA_RESERVA_ADAPTADOR: 'falso', ...TOKENS_DA_RESERVA }).reserva).not.toHaveProperty('exigePreco')
  })

  it('a reserva `openai_compat` leva endereço, modelo de cada perfil (e de qual variável), chave e a identidade como provedor: é sempre envio externo', () => {
    const { reserva } = loadLLMConfig({ ...LOCAL, ...RESERVA, LLM_RESERVA_MODELO_RAPIDO: 'rapido-da-reserva', LLM_RESERVA_CHAVE_API: 'chave-sintetica-da-reserva' })
    expect(reserva).toEqual({
      adaptador: 'openai_compat',
      identidade: 'provedor-de-reserva',
      ambiente: 'local',
      modelo: {
        baseUrl: 'https://reserva.provedor.test/v1',
        modelos: { rapido: 'rapido-da-reserva', padrao: 'modelo-da-reserva', complexo: 'modelo-da-reserva', visao: 'modelo-da-reserva' },
        variaveisDosModelos: { rapido: 'LLM_RESERVA_MODELO_RAPIDO', padrao: 'LLM_RESERVA_MODELO', complexo: 'LLM_RESERVA_MODELO', visao: 'LLM_RESERVA_MODELO' },
        chaveApi: 'chave-sintetica-da-reserva',
        processamentoLocal: false,
        provedorId: 'provedor-de-reserva',
      },
    })
    expect(loadLLMConfig({ ...LOCAL, ...RESERVA }).reserva?.modelo).not.toHaveProperty('chaveApi')
  })

  it('o preço da reserva só é exigido fora de `local` e com `openai_compat`, como o do principal', () => {
    for (const ambiente of ['staging', 'producao']) {
      expect(loadLLMConfig({ ...PRINCIPAL_EM_PRODUCAO, AMBIENTE: ambiente, ...RESERVA, ...TOKENS_DA_RESERVA }).reserva, ambiente).toHaveProperty('exigePreco', true)
    }
    expect(loadLLMConfig({ ...LOCAL, ...RESERVA }).reserva).not.toHaveProperty('exigePreco')
  })

  it('reserva meio configurada recusa citando a variável que falta, uma por vez', () => {
    expect(erroDe({ ...LOCAL, ...RESERVA, LLM_RESERVA_BASE_URL: undefined })).toMatchObject({ variaveis: ['LLM_RESERVA_BASE_URL'], motivos: [MOTIVO_RESERVA_SEM_ENDERECO] })
    expect(erroDe({ ...LOCAL, ...RESERVA, LLM_RESERVA_BASE_URL: 'reserva' }).variaveis).toEqual(['LLM_RESERVA_BASE_URL'])
    // Só http e https: o endereço que não é do padrão não chega ao adaptador.
    expect(erroDe({ ...LOCAL, ...RESERVA, LLM_RESERVA_BASE_URL: 'ftp://reserva.provedor.test/v1' }).variaveis).toEqual(['LLM_RESERVA_BASE_URL'])
    expect(erroDe({ ...LOCAL, ...RESERVA, IA_RESERVA_PROVEDOR_ID: undefined })).toMatchObject({ variaveis: ['IA_RESERVA_PROVEDOR_ID'], motivos: [MOTIVO_RESERVA_SEM_PROVEDOR_ID] })
    expect(erroDe({ ...LOCAL, ...RESERVA, LLM_RESERVA_MODELO: undefined })).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO'], motivos: [MOTIVO_RESERVA_SEM_MODELO] })
    // Sem o comum, os quatro perfis têm de estar declarados.
    const porPerfil = { LLM_RESERVA_MODELO_RAPIDO: 'a', LLM_RESERVA_MODELO_PADRAO: 'b', LLM_RESERVA_MODELO_COMPLEXO: 'c', LLM_RESERVA_MODELO_VISAO: 'd' }
    expect(loadLLMConfig({ ...LOCAL, ...RESERVA, LLM_RESERVA_MODELO: undefined, ...porPerfil }).reserva?.modelo?.modelos).toEqual({ rapido: 'a', padrao: 'b', complexo: 'c', visao: 'd' })
    expect(erroDe({ ...LOCAL, ...RESERVA, LLM_RESERVA_MODELO: undefined, ...porPerfil, LLM_RESERVA_MODELO_VISAO: undefined }).variaveis).toEqual(['LLM_RESERVA_MODELO'])
  })

  it('variável da reserva sem IA_RESERVA_ADAPTADOR recusa citando-o: a reserva que parece ligada e não está não passa', () => {
    for (const definida of [{ LLM_RESERVA_BASE_URL: RESERVA.LLM_RESERVA_BASE_URL }, { LLM_RESERVA_MODELO: 'm' }, { LLM_RESERVA_MODELO_PADRAO: 'm' }, { LLM_RESERVA_CHAVE_API: 'k' }, { IA_RESERVA_PROVEDOR_ID: 'provedor-x' }, TOKENS_DA_RESERVA]) {
      expect(erroDe({ ...LOCAL, ...definida }), JSON.stringify(Object.keys(definida))).toMatchObject({ variaveis: ['IA_RESERVA_ADAPTADOR'], motivos: [MOTIVO_RESERVA_SEM_ADAPTADOR] })
    }
  })

  it('em produção a reserva falsa é recusada, e a identidade `falso-reserva` sobre `openai_compat` também; fora dela, as duas sobem', () => {
    expect(erroDe({ ...PRINCIPAL_EM_PRODUCAO, IA_RESERVA_ADAPTADOR: 'falso', ...TOKENS_DA_RESERVA })).toMatchObject({ variaveis: ['IA_RESERVA_ADAPTADOR'], motivos: [MOTIVO_RESERVA_FALSA_EM_PRODUCAO] })
    expect(erroDe({ ...PRINCIPAL_EM_PRODUCAO, ...RESERVA, IA_RESERVA_PROVEDOR_ID: IDENTIDADE_DA_RESERVA_FALSA, ...TOKENS_DA_RESERVA })).toMatchObject({
      variaveis: ['IA_RESERVA_PROVEDOR_ID'],
      motivos: [MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO],
    })
    expect(loadLLMConfig({ ...PRINCIPAL_EM_PRODUCAO, ...RESERVA, ...TOKENS_DA_RESERVA }).reserva?.identidade).toBe('provedor-de-reserva')
    for (const ambiente of ['local', 'staging']) {
      expect(loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: ambiente, IA_RESERVA_ADAPTADOR: 'falso', ...TOKENS_DA_RESERVA }).reserva?.identidade, ambiente).toBe(IDENTIDADE_DA_RESERVA_FALSA)
      expect(loadLLMConfig({ ...LLAMA, ...TOKENS, AMBIENTE: ambiente, ...RESERVA, IA_RESERVA_PROVEDOR_ID: IDENTIDADE_DA_RESERVA_FALSA, ...TOKENS_DA_RESERVA }).reserva?.identidade, ambiente).toBe(IDENTIDADE_DA_RESERVA_FALSA)
    }
  })

  it('a mesma identidade do principal recusa em qualquer ambiente: no falso, no `openai_compat` com outro adaptador na reserva, e no modelo local, cuja identidade é a origem', () => {
    expect(erroDe({ ...LOCAL, IA_RESERVA_ADAPTADOR: 'falso', IA_RESERVA_PROVEDOR_ID: 'falso' })).toMatchObject({ variaveis: ['IA_RESERVA_PROVEDOR_ID'], motivos: [MOTIVO_RESERVA_COM_A_IDENTIDADE_DO_PRINCIPAL] })
    // O principal falso e a reserva `openai_compat` que se chama `falso`: a mesma identidade, e só `openai_compat` nos dois a deixa passar.
    expect(erroDe({ ...LOCAL, ...RESERVA, IA_RESERVA_PROVEDOR_ID: 'falso' }).variaveis).toEqual(['IA_RESERVA_PROVEDOR_ID'])
    // O principal `openai_compat` e a reserva falsa com o id dele: a mesma identidade, e o falso na reserva não é "outro modelo do mesmo provedor".
    expect(erroDe({ ...LLAMA, IA_RESERVA_ADAPTADOR: 'falso', IA_RESERVA_PROVEDOR_ID: 'provedor-de-teste' }).variaveis).toEqual(['IA_RESERVA_PROVEDOR_ID'])
    // O processamento local não tem provedor: a identidade do principal é `openai_compat`, mesmo com IA_PROVEDOR_ID definido, e é a que a reserva não pode ter.
    const local = { ...LLAMA, LLM_PROCESSAMENTO_LOCAL: 'true' }
    expect(erroDe({ ...local, IA_RESERVA_ADAPTADOR: 'falso', IA_RESERVA_PROVEDOR_ID: 'openai_compat' }).variaveis).toEqual(['IA_RESERVA_PROVEDOR_ID'])
    // Em staging e em produção também: a mesma identidade e o mesmo modelo recusam, e no staging a reserva falsa com a identidade do principal falso também.
    for (const ambiente of ['staging', 'producao']) {
      const mesmoProvedor = { ...PRINCIPAL_EM_PRODUCAO, AMBIENTE: ambiente, ...RESERVA, ...TOKENS_DA_RESERVA, IA_RESERVA_PROVEDOR_ID: 'provedor-de-teste', LLM_RESERVA_MODELO: 'qwen3-8b' }
      expect(erroDe(mesmoProvedor).variaveis, ambiente).toEqual(['LLM_RESERVA_MODELO'])
      expect(loadLLMConfig({ ...mesmoProvedor, LLM_RESERVA_MODELO: 'outro-modelo' }).reserva?.identidade, ambiente).toBe('provedor-de-teste')
    }
    expect(erroDe({ ...LOCAL, AMBIENTE: 'staging', ...TOKENS, ...TOKENS_DA_RESERVA, IA_RESERVA_ADAPTADOR: 'falso', IA_RESERVA_PROVEDOR_ID: 'falso' }).variaveis).toEqual(['IA_RESERVA_PROVEDOR_ID'])
    expect(loadLLMConfig({ ...local, ...RESERVA, IA_RESERVA_PROVEDOR_ID: 'provedor-de-teste' }).reserva?.identidade).toBe('provedor-de-teste')
    // O principal que se chama como a reserva falsa (`falso-reserva`): a reserva falsa sem id própria assume essa identidade, e é a mesma do principal.
    expect(erroDe({ ...LLAMA, IA_PROVEDOR_ID: IDENTIDADE_DA_RESERVA_FALSA, IA_RESERVA_ADAPTADOR: 'falso' })).toMatchObject({ variaveis: ['IA_RESERVA_PROVEDOR_ID'], motivos: [MOTIVO_RESERVA_COM_A_IDENTIDADE_DO_PRINCIPAL] })
  })

  it('a reserva falsa ignora o endereço que sobrou no ambiente: não tem modelo, e a configuração não o carrega', () => {
    expect(loadLLMConfig({ ...LOCAL, IA_RESERVA_ADAPTADOR: 'falso', LLM_RESERVA_BASE_URL: RESERVA.LLM_RESERVA_BASE_URL }).reserva).toEqual({ adaptador: 'falso', identidade: IDENTIDADE_DA_RESERVA_FALSA, ambiente: 'local' })
  })

  it('a reserva leva o AMBIENTE em que a configuração subiu: é dele que a aprovação da reserva falsa depende, e o `main-worker` não tem outro lugar de onde o ler', () => {
    for (const ambiente of ['local', 'staging'] as const) {
      expect(loadLLMConfig({ ...LOCAL, ...TOKENS, AMBIENTE: ambiente, IA_RESERVA_ADAPTADOR: 'falso', ...TOKENS_DA_RESERVA }).reserva, ambiente).toHaveProperty('ambiente', ambiente)
    }
    expect(loadLLMConfig({ ...PRINCIPAL_EM_PRODUCAO, AMBIENTE: 'producao', ...RESERVA, ...TOKENS_DA_RESERVA }).reserva).toHaveProperty('ambiente', 'producao')
  })

  it('`openai_compat` nos dois e nenhum modelo da reserva igual a um do principal: a reserva "outro modelo do mesmo provedor" sobe', () => {
    const mesmoProvedor = { ...LLAMA, ...RESERVA, IA_RESERVA_PROVEDOR_ID: 'provedor-de-teste' }
    expect(loadLLMConfig({ ...mesmoProvedor, LLM_RESERVA_MODELO: 'outro-modelo' }).reserva).toMatchObject({ adaptador: 'openai_compat', identidade: 'provedor-de-teste' })
    // Mesmo provedor com o menor do principal declarado e diferente: continua subindo.
    expect(loadLLMConfig({ ...mesmoProvedor, LLM_RESERVA_MODELO: 'outro-modelo', LLM_MODELO_MENOR_RAPIDO: 'menor-do-principal' }).reserva?.identidade).toBe('provedor-de-teste')
  })

  it('com a mesma identidade, modelo repetido recusa citando a variável do perfil: o mesmo perfil, o perfil cruzado e o menor do principal', () => {
    const mesmoProvedor = { ...LLAMA, ...RESERVA, IA_RESERVA_PROVEDOR_ID: 'provedor-de-teste', LLM_RESERVA_MODELO: 'outro-modelo' }
    // Um perfil igual (o comum do principal, `qwen3-8b`, no `complexo` da reserva).
    expect(erroDe({ ...mesmoProvedor, LLM_RESERVA_MODELO_COMPLEXO: 'qwen3-8b' })).toMatchObject({ variaveis: ['LLM_RESERVA_MODELO_COMPLEXO'], motivos: [MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL] })
    // Todos os perfis iguais, pelo comum: a variável citada é a comum.
    expect(erroDe({ ...mesmoProvedor, LLM_RESERVA_MODELO: 'qwen3-8b' }).variaveis).toEqual(['LLM_RESERVA_MODELO'])
    // O `rapido` da reserva igual ao `padrao` do principal: o cruzamento de perfis também vale.
    expect(erroDe({ ...mesmoProvedor, LLM_MODELO_PADRAO: 'so-do-padrao', LLM_RESERVA_MODELO_RAPIDO: 'so-do-padrao' }).variaveis).toEqual(['LLM_RESERVA_MODELO_RAPIDO'])
    // Um igual ao modelo menor do principal.
    expect(erroDe({ ...mesmoProvedor, LLM_MODELO_MENOR_PADRAO: 'menor-do-padrao', LLM_RESERVA_MODELO_VISAO: 'menor-do-padrao' }).variaveis).toEqual(['LLM_RESERVA_MODELO_VISAO'])
    // Dois perfis repetidos: os dois são citados.
    expect(erroDe({ ...mesmoProvedor, LLM_RESERVA_MODELO_RAPIDO: 'qwen3-8b', LLM_RESERVA_MODELO_PADRAO: 'qwen3-8b' }).variaveis).toEqual(['LLM_RESERVA_MODELO_PADRAO', 'LLM_RESERVA_MODELO_RAPIDO'])
  })

  it('com outra identidade o mesmo modelo é permitido: o outro provedor pode ter o mesmo id de modelo', () => {
    expect(loadLLMConfig({ ...LLAMA, ...RESERVA, LLM_RESERVA_MODELO: 'qwen3-8b' }).reserva?.identidade).toBe('provedor-de-reserva')
  })

  it('LLM_RESERVA_TOKENS_POR_MINUTO é obrigatória fora de `local` com a reserva configurada, e no `local` a reserva sobe sem ela', () => {
    for (const ambiente of ['staging', 'producao']) {
      expect(erroDe({ ...PRINCIPAL_EM_PRODUCAO, AMBIENTE: ambiente, ...RESERVA }), ambiente).toMatchObject({ variaveis: ['LLM_RESERVA_TOKENS_POR_MINUTO'], motivos: [MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA] })
      expect(erroDe({ ...PRINCIPAL_EM_PRODUCAO, AMBIENTE: ambiente, ...RESERVA, LLM_RESERVA_TOKENS_POR_MINUTO: '' }).variaveis, ambiente).toEqual(['LLM_RESERVA_TOKENS_POR_MINUTO'])
      expect(loadLLMConfig({ ...PRINCIPAL_EM_PRODUCAO, AMBIENTE: ambiente, ...RESERVA, ...TOKENS_DA_RESERVA }).reserva?.tokensPorMinuto, ambiente).toBe(1_500_000)
    }
    expect(loadLLMConfig({ ...LOCAL, ...RESERVA }).reserva).not.toHaveProperty('tokensPorMinuto')
    // Sem reserva, o contratado dela não é exigido: o principal sobe como antes.
    expect(loadLLMConfig(PRINCIPAL_EM_PRODUCAO)).not.toHaveProperty('reserva')
    expect(erroDe({ ...LOCAL, LLM_RESERVA_TOKENS_POR_MINUTO: '999', IA_RESERVA_ADAPTADOR: 'falso' }).variaveis).toEqual(['LLM_RESERVA_TOKENS_POR_MINUTO'])
  })

  it('a chave da reserva entra na configuração e nunca na mensagem de erro', () => {
    const chave = 'chave-sintetica-da-reserva-que-nao-pode-vazar'
    expect(loadLLMConfig({ ...LOCAL, ...RESERVA, LLM_RESERVA_CHAVE_API: chave }).reserva?.modelo?.chaveApi).toBe(chave)
    const erro = erroDe({ ...LOCAL, ...RESERVA, LLM_RESERVA_CHAVE_API: chave, LLM_RESERVA_BASE_URL: undefined, LLM_RESERVA_MODELO: undefined, IA_RESERVA_PROVEDOR_ID: undefined })
    expect(erro.variaveis).toEqual(['IA_RESERVA_PROVEDOR_ID', 'LLM_RESERVA_BASE_URL', 'LLM_RESERVA_MODELO'])
    expect(`${erro.message} ${JSON.stringify(erro.motivos)} ${JSON.stringify(erro.variaveis)}`).not.toContain(chave)
    const comIdentidadeRepetida = erroDe({ ...LLAMA, ...RESERVA, IA_RESERVA_PROVEDOR_ID: 'provedor-de-teste', LLM_RESERVA_MODELO: 'qwen3-8b', LLM_RESERVA_CHAVE_API: chave })
    expect(`${comIdentidadeRepetida.message} ${JSON.stringify(comIdentidadeRepetida.motivos)}`).not.toContain(chave)
  })

  it('o .env.example não liga a reserva e a carga liga a falsa, `falso-reserva`, com o contratado próprio', () => {
    const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
    const exemplo = parseEnv(readFileSync(`${raiz}.env.example`, 'utf8'))
    const carga = parseEnv(readFileSync(`${raiz}infra/carga.env`, 'utf8'))
    expect(loadLLMConfig(exemplo)).not.toHaveProperty('reserva')
    expect(loadLLMConfig({ ...exemplo, ...carga }).reserva).toEqual({ adaptador: 'falso', identidade: 'falso-reserva', ambiente: 'local', tokensPorMinuto: 1_950_000 })
  })
})
