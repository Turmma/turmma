import { hkdfSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { lerAmbienteDeCarga, lerAmbienteDeTeste, lerAmbienteExemplo } from '../../../tools/ci/compose.ts'
import { MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO, TIMEOUT_COMANDO_REDIS_API_MS, TIMEOUT_COMANDO_REDIS_FILA_MS } from '@educa/core'
import { InvalidConfigError, loadConfig, MOTIVO_AVISOS_SEM_JSON, MOTIVO_ROTAS_SINTETICAS_EM_PRODUCAO } from './config.js'
import { MOTIVO_CHAVE_DA_SALA_REPETIDA } from './sala/sala-config.js'
import { loadLoginConfig, MOTIVO_PRAZO_DO_REDIS_DO_LOGIN, PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS } from './credencial/index.js'

const ambienteValido = {
  API_PORTA: '3000',
  BANCO_URL: 'postgres://educa:senha_sintetica_xyz@postgres:5432/educa',
  BANCO_POOL_MAXIMO: '10',
  BANCO_TIMEOUT_CONEXAO_MS: '2000',
  BANCO_TIMEOUT_CONSULTA_MS: '1500',
  AMBIENTE: 'local',
  IDENTIDADE_CHAVE_ASSINATURA: 'chave_sintetica_de_teste_com_32_caracteres',
  DRENAGEM_ESPERA_BORDA_MS: '4000',
  DRENAGEM_PRAZO_MS: '10000',
  REDIS_CACHE_URL: 'redis://redis-cache:6379',
  REDIS_FILA_URL: 'redis://redis-fila:6379',
  LIMITE_REQ_USUARIO_MIN: '120',
  LIMITE_REQ_ESCOLA_MIN: '30000',
  LIMITE_REQ_IP_ANONIMO_MIN: '3000',
  LIMITE_REQ_OPERADOR_MIN: '120',
  LIMITE_INSTANCIAS_API: '2',
  LIMITE_PROXIES_CONFIAVEIS: 'borda',
  ROTAS_SINTETICAS: 'false',
  VERSAO: 'local',
  AVISOS_SISTEMA: '[]',
  TELEMETRIA_OTLP_URL: 'http://observabilidade:4318/',
  TELEMETRIA_INTERVALO_MS: '5000',
  LOGIN_ARGON2_MEMORIA_KIB: '19456',
  LOGIN_ARGON2_ITERACOES: '2',
  LOGIN_HASH_CONCORRENCIA: '2',
  LOGIN_PROTECAO_DESLIGADA: 'false',
  UV_THREADPOOL_SIZE: '16',
  LIMITE_LOGIN_EMAIL_IP_MIN: '60',
  LOGIN_REDIS_PRAZO_MS: '100',
  LOGIN_CHAVE_CONTADOR: 'chave_sintetica_do_contador_com_32_caracteres',
  LOGIN_CHAVE_DISPOSITIVO_VERSAO: '1',
  LOGIN_CHAVE_DISPOSITIVO_V1: 'chave_sintetica_do_dispositivo_com_32_caracteres',
  IDENTIDADE_CHAVE_CIFRA_VERSAO: '1',
  IDENTIDADE_CHAVE_CIFRA_V1: 'chave_sintetica_da_cifra_do_mfa_com_32_caracteres',
  IDENTIDADE_CHAVE_RECUPERACAO: 'chave_sintetica_da_recuperacao_com_32_caracteres',
  SALA_CHAVE_CODIGO: 'chave_sintetica_do_codigo_da_turma_com_32_caracteres',
  STORAGE_URL: 'http://storage:8333',
  STORAGE_REGIAO: 'us-east-1',
  STORAGE_BUCKET: 'educa-local',
  STORAGE_CHAVE_ACESSO: 'chave_sintetica',
  STORAGE_CHAVE_SECRETA: 'segredo_sintetico_do_storage',
}

/**
 * A camada de IA como a produção a configura: o adaptador falso é recusado lá, e a API só sobe com o provedor declarado.
 * Endereço e modelo sintéticos.
 */
const IA_DE_PRODUCAO = { IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'https://modelo.sintetico.example/v1', LLM_MODELO: 'modelo-sintetico', IA_PROVEDOR_ID: 'provedor-sintetico' }

/** A chave AES-256 que o HKDF deriva do texto da variável, como a configuração faz. */
function chaveDerivada(texto: string): Uint8Array {
  return new Uint8Array(hkdfSync('sha256', texto, new Uint8Array(0), 'educa.mfa.segredo.aes-256-gcm', 32))
}

/** O erro de `loadLoginConfig` chamada direto, para o que `loadConfig` não alcança. */
function erroDeLogin(ambiente: Record<string, string | undefined>): InvalidConfigError {
  try {
    loadLoginConfig(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração do login deveria ter sido recusada')
}

function erroDe(ambiente: Record<string, string | undefined>): InvalidConfigError {
  try {
    loadConfig(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração deveria ter sido recusada')
}

describe('lerConfiguracao', () => {
  it('converte o ambiente em configuração tipada', () => {
    expect(loadConfig(ambienteValido)).toEqual({
      porta: 3000,
      rotasSinteticas: false,
      versao: 'local',
      avisos: [],
      redisFilaUrl: 'redis://redis-fila:6379',
      banco: {
        url: ambienteValido.BANCO_URL,
        maximoConexoes: 10,
        timeoutConexaoMs: 2000,
        timeoutConsultaMs: 1500,
      },
      identidade: {
        ambiente: 'local',
        chaveAssinatura: new TextEncoder().encode(ambienteValido.IDENTIDADE_CHAVE_ASSINATURA),
      },
      drenagem: { esperaDaBordaMs: 4000, prazoMs: 10000 },
      limite: {
        redisCacheUrl: 'redis://redis-cache:6379',
        porUsuarioMin: 120,
        porEscolaMin: 30000,
        porIpAnonimoMin: 3000,
        porOperadorMin: 120,
        instancias: 2,
        proxiesConfiaveis: ['borda'],
      },
      telemetria: { otlpUrl: 'http://observabilidade:4318', intervaloMs: 5000 },
      login: {
        hash: { memoriaKib: 19_456, iteracoes: 2 },
        concorrenciaDoHash: 2,
        protecaoDesligada: false,
        prazoDoRedisMs: TIMEOUT_COMANDO_REDIS_API_MS,
        limiteEmailPorIpMin: 60,
        chaveContador: new TextEncoder().encode(ambienteValido.LOGIN_CHAVE_CONTADOR),
        dispositivo: { versao: 1, chave: new TextEncoder().encode(ambienteValido.LOGIN_CHAVE_DISPOSITIVO_V1) },
        mfa: {
          versaoCifra: 1,
          chavesCifra: new Map([[1, chaveDerivada(ambienteValido.IDENTIDADE_CHAVE_CIFRA_V1)]]),
          chaveRecuperacao: new TextEncoder().encode(ambienteValido.IDENTIDADE_CHAVE_RECUPERACAO),
        },
      },
      // Sem as variáveis de provedor, o login pela conta da escola fica desligado, e a API sobe igual (13.0).
      loginExterno: { provedores: new Map(), retorno: undefined, chaveDoCookie: undefined, aceitaEmissorSemTls: true },
      sala: { chaveCodigo: new TextEncoder().encode(ambienteValido.SALA_CHAVE_CODIGO) },
      // Sem nenhuma variável de IA, o adaptador falso, com os padrões do prazo e das vagas.
      ia: { adaptador: 'falso', prazosMs: { rapido: 20_000, padrao: 60_000, complexo: 60_000, visao: 60_000 }, recuoMs: 500, executor: { vagasPorEscola: 2, vagasNoTotal: 8, timeoutMs: 150_000 } },
      // O storage do arquivo do titular (F3, tarefa 13.0): sem `STORAGE_URL_PUBLICA`, a assinatura vale o endereço interno.
      // Uma tentativa e prazo de 5 s: o cliente da API espera a resposta (o do worker repete, com o prazo dele).
      armazem: {
        url: 'http://storage:8333',
        regiao: 'us-east-1',
        bucket: 'educa-local',
        chaveAcesso: 'chave_sintetica',
        chaveSecreta: 'segredo_sintetico_do_storage',
        tentativas: 1,
        timeoutRequisicaoMs: 5000,
      },
    })
  })

  it('o armazém do arquivo do titular (F3, tarefa 13.0): o endereço público entra na configuração, e a falta ou o valor inválido são apontados pelo nome, sem o segredo', () => {
    expect(loadConfig({ ...ambienteValido, STORAGE_URL_PUBLICA: 'http://127.0.0.1:58333' }).armazem).toMatchObject({ url: 'http://storage:8333', urlPublica: 'http://127.0.0.1:58333' })
    expect(erroDe({ ...ambienteValido, STORAGE_URL: undefined }).variaveis).toEqual(['STORAGE_URL'])
    expect(erroDe({ ...ambienteValido, STORAGE_BUCKET: undefined, STORAGE_CHAVE_SECRETA: '' }).variaveis).toEqual(['STORAGE_BUCKET', 'STORAGE_CHAVE_SECRETA'])
    const recusada = erroDe({ ...ambienteValido, STORAGE_URL_PUBLICA: 'armazem:8333', STORAGE_CHAVE_SECRETA: '' })
    expect(recusada.variaveis).toEqual(['STORAGE_CHAVE_SECRETA', 'STORAGE_URL_PUBLICA'])
    expect(recusada.message).not.toContain(ambienteValido.STORAGE_CHAVE_SECRETA)
  })

  it('a camada de IA é lida aqui, com as outras: nenhuma variável é obrigatória, a inválida é apontada pelo nome, e o adaptador falso não sobe em produção', () => {
    expect(Object.keys(ambienteValido).filter((variavel) => variavel.startsWith('IA_') || variavel.startsWith('LLM_'))).toEqual([])
    expect(loadConfig({ ...ambienteValido, ...IA_DE_PRODUCAO, IA_EXECUCOES_POR_ESCOLA: '3' }).ia).toMatchObject({
      adaptador: 'openai_compat',
      modelo: { baseUrl: IA_DE_PRODUCAO.LLM_BASE_URL, processamentoLocal: false, provedorId: 'provedor-sintetico' },
      executor: { vagasPorEscola: 3 },
    })
    // O compose entrega a variável sem valor como texto vazio: vale como ausente.
    expect(loadConfig({ ...ambienteValido, IA_ADAPTADOR: '', LLM_BASE_URL: '' }).ia.adaptador).toBe('falso')
    expect(erroDe({ ...ambienteValido, IA_ADAPTADOR: 'outro' }).variaveis).toEqual(['IA_ADAPTADOR'])
    expect(erroDe({ ...ambienteValido, IA_ADAPTADOR: 'openai_compat' }).variaveis).toEqual(['IA_PROVEDOR_ID', 'LLM_BASE_URL', 'LLM_MODELO'])
    // Somada às outras leituras, e sem repetir o AMBIENTE, que a identidade já aponta.
    expect(erroDe({ ...ambienteValido, API_PORTA: '0', LLM_TIMEOUT_MS: 'um minuto' }).variaveis).toEqual(['API_PORTA', 'LLM_TIMEOUT_MS'])
    expect(erroDe({ ...ambienteValido, AMBIENTE: 'homologacao' }).variaveis).toEqual(['AMBIENTE'])
    const emProducao = erroDe({ ...ambienteValido, AMBIENTE: 'producao' })
    expect(emProducao.variaveis).toEqual(['IA_ADAPTADOR'])
    expect(emProducao.message).toContain(MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO)
  })

  it('o login pela conta da escola meio configurado reprova o boot junto com as outras variáveis', () => {
    const erro = erroDe({ ...ambienteValido, LOGIN_EXTERNO_GOOGLE_EMISSOR: 'https://accounts.google.com' })
    expect(erro.variaveis).toEqual(['LOGIN_EXTERNO_GOOGLE_CLIENTE', 'LOGIN_EXTERNO_GOOGLE_EMISSOR', 'LOGIN_EXTERNO_GOOGLE_SEGREDO'])
  })

  it.each([
    ['LOGIN_ARGON2_MEMORIA_KIB', '19455'],
    ['LOGIN_ARGON2_ITERACOES', '1'],
    ['LOGIN_CHAVE_CONTADOR', 'curta_sintetica'],
    ['LOGIN_CHAVE_DISPOSITIVO_VERSAO', '0'],
    ['LOGIN_CHAVE_DISPOSITIVO_V1', 'curta_sintetica'],
    ['IDENTIDADE_CHAVE_CIFRA_VERSAO', '0'],
    ['IDENTIDADE_CHAVE_CIFRA_V1', 'curta_sintetica'],
    ['IDENTIDADE_CHAVE_RECUPERACAO', 'curta_sintetica'],
    ['SALA_CHAVE_CODIGO', 'curta_sintetica'],
  ])('não sobe com %s=%s: o hash nunca abaixo da OWASP e as chaves do login com 256 bits', (variavel, valor) => {
    const erro = erroDe({ ...ambienteValido, [variavel]: valor })
    expect(erro.variaveis).toEqual([variavel])
    expect(erro.message).not.toContain(valor)
  })

  it('semáforo do hash: LOGIN_HASH_CONCORRENCIA e UV_THREADPOOL_SIZE são obrigatórias, sem padrão no código, e a falta aponta só o nome', () => {
    for (const variavel of ['LOGIN_HASH_CONCORRENCIA', 'UV_THREADPOOL_SIZE']) {
      expect(erroDe({ ...ambienteValido, [variavel]: undefined }).variaveis, variavel).toEqual([variavel])
      expect(erroDe({ ...ambienteValido, [variavel]: '' }).variaveis, variavel).toEqual([variavel])
    }
    expect(erroDe({ ...ambienteValido, LOGIN_HASH_CONCORRENCIA: '0' }).variaveis).toEqual(['LOGIN_HASH_CONCORRENCIA'])
  })

  it('limite por IP do login por e-mail (15.2): LIMITE_LOGIN_EMAIL_IP_MIN é obrigatória, inteira e positiva, sem padrão no código', () => {
    expect(loadConfig(ambienteValido).login.limiteEmailPorIpMin).toBe(60)
    expect(loadConfig({ ...ambienteValido, LIMITE_LOGIN_EMAIL_IP_MIN: '180' }).login.limiteEmailPorIpMin).toBe(180)
    for (const valor of [undefined, '', '0', '-1', '1.5', 'sessenta']) {
      expect(erroDe({ ...ambienteValido, LIMITE_LOGIN_EMAIL_IP_MIN: valor }).variaveis, String(valor)).toEqual(['LIMITE_LOGIN_EMAIL_IP_MIN'])
    }
  })

  it('semáforo do hash: a concorrência vai até UV_THREADPOOL_SIZE − 8, e um acima derruba o boot apontando só LOGIN_HASH_CONCORRENCIA, sem o valor', () => {
    // No limite, sobe: 16 threads, 8 de folga para nome e arquivo, 8 para o hash.
    expect(loadConfig({ ...ambienteValido, UV_THREADPOOL_SIZE: '16', LOGIN_HASH_CONCORRENCIA: '8' }).login.concorrenciaDoHash).toBe(8)
    const acima = erroDe({ ...ambienteValido, UV_THREADPOOL_SIZE: '16', LOGIN_HASH_CONCORRENCIA: '9' })
    expect(acima.variaveis).toEqual(['LOGIN_HASH_CONCORRENCIA'])
    expect(acima.message).not.toMatch(/\b9\b/)
    // O padrão do Node (4 threads) não deixa nenhuma para o hash: o processo sem UV_THREADPOOL_SIZE de verdade não sobe.
    expect(erroDe({ ...ambienteValido, UV_THREADPOOL_SIZE: '4', LOGIN_HASH_CONCORRENCIA: '1' }).variaveis).toEqual(['LOGIN_HASH_CONCORRENCIA'])
  })

  it('permissão (16.0): LOGIN_PROTECAO_DESLIGADA=true liga o controle negativo fora de produção, e a API não sobe com ela em produção', () => {
    expect(loadConfig({ ...ambienteValido, LOGIN_PROTECAO_DESLIGADA: 'true' }).login.protecaoDesligada).toBe(true)
    expect(erroDe({ ...ambienteValido, ...IA_DE_PRODUCAO, AMBIENTE: 'producao', ROTAS_SINTETICAS: 'false', LOGIN_PROTECAO_DESLIGADA: 'true' }).variaveis).toEqual(['LOGIN_PROTECAO_DESLIGADA'])
    expect(erroDe({ ...ambienteValido, LOGIN_PROTECAO_DESLIGADA: undefined }).variaveis).toEqual(['LOGIN_PROTECAO_DESLIGADA'])
  })

  it('LOGIN_REDIS_PRAZO_MS só aperta: acima do corte de 100 ms a API não sobe em produção nem no staging, e sobe em local', () => {
    // O corte é o desenho (regra 80): o Redis que não responde não segura a requisição do aluno. Em `local` — a
    // máquina de desenvolvimento e o compose de teste, que é o que o e2e sobe — 100 ms é o tempo normal de uma
    // máquina ocupada, e cortar nele recusava o desafio no meio do login, sem defeito nenhum de produção (correção
    // 2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e).
    expect(TIMEOUT_COMANDO_REDIS_FILA_MS).toBeGreaterThan(TIMEOUT_COMANDO_REDIS_API_MS)
    const acimaDoCorte = String(TIMEOUT_COMANDO_REDIS_FILA_MS)
    // Até o corte, passa em todo ambiente: é o valor de `ambienteValido`, e é o que o cenário de carga fixa.
    for (const ambiente of ['local', 'staging', 'producao'] as const) {
      expect(loadConfig({ ...ambienteValido, ...IA_DE_PRODUCAO, AMBIENTE: ambiente }).login.prazoDoRedisMs).toBe(TIMEOUT_COMANDO_REDIS_API_MS)
    }
    // Acima dele, só em `local`.
    expect(loadConfig({ ...ambienteValido, LOGIN_REDIS_PRAZO_MS: acimaDoCorte }).login.prazoDoRedisMs).toBe(TIMEOUT_COMANDO_REDIS_FILA_MS)
    const emProducao = erroDe({ ...ambienteValido, ...IA_DE_PRODUCAO, AMBIENTE: 'producao', LOGIN_REDIS_PRAZO_MS: acimaDoCorte })
    expect(emProducao.variaveis).toEqual(['LOGIN_REDIS_PRAZO_MS'])
    expect(emProducao.message).toContain(MOTIVO_PRAZO_DO_REDIS_DO_LOGIN)
    expect(erroDe({ ...ambienteValido, AMBIENTE: 'staging', LOGIN_REDIS_PRAZO_MS: acimaDoCorte }).variaveis).toEqual(['LOGIN_REDIS_PRAZO_MS'])
    // Um a mais que o corte já não passa, nos dois: o limite é o valor, não uma faixa.
    for (const ambiente of ['staging', 'producao'] as const) {
      expect(erroDe({ ...ambienteValido, ...IA_DE_PRODUCAO, AMBIENTE: ambiente, LOGIN_REDIS_PRAZO_MS: String(TIMEOUT_COMANDO_REDIS_API_MS + 1) }).variaveis, ambiente).toEqual(['LOGIN_REDIS_PRAZO_MS'])
    }
    // O piso é a única defesa contra o prazo que não espera nada: zero passaria pelo teto (0 ≤ 100) e a API subiria
    // em produção, mas o ioredis corta todo comando no tick seguinte — desafio recusado e contador no seguro a cada
    // login, com a escola inteira às 7h30 (regra 80). Negativo faz o mesmo.
    for (const valor of [undefined, '', '0', '-1', '1.5', 'cem', String(PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS - 1)]) {
      expect(erroDe({ ...ambienteValido, LOGIN_REDIS_PRAZO_MS: valor }).variaveis, String(valor)).toEqual(['LOGIN_REDIS_PRAZO_MS'])
    }
    // O piso é inteiro: ele alimenta um `.int()`, e fracionário faria o caso acima passar pelo motivo errado.
    expect(Number.isInteger(PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS)).toBe(true)
    // No piso, passa: é apertar, não sumir.
    expect(loadConfig({ ...ambienteValido, LOGIN_REDIS_PRAZO_MS: String(PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS) }).login.prazoDoRedisMs).toBe(PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS)
    // O que o contêiner do compose de teste vê é `.env.example` mais `infra/teste.env`, e não só o exemplo; o do
    // cenário de carga é `.env.example` mais `infra/carga.env`, que fixa o corte de produção.
    expect(lerAmbienteDeTeste()['AMBIENTE']).toBe('local')
    const comoNoProjeto = (doProjeto: Record<string, string>) =>
      loadConfig({ ...ambienteValido, ...doProjeto, BANCO_URL: ambienteValido.BANCO_URL, REDIS_CACHE_URL: ambienteValido.REDIS_CACHE_URL, REDIS_FILA_URL: ambienteValido.REDIS_FILA_URL })
        .login.prazoDoRedisMs
    expect(comoNoProjeto(lerAmbienteDeTeste())).toBe(TIMEOUT_COMANDO_REDIS_FILA_MS)
    expect(comoNoProjeto(lerAmbienteDeCarga())).toBe(TIMEOUT_COMANDO_REDIS_API_MS)
  })

  it('o .env.example não sobe em produção, e aponta exatamente as variáveis que o staging e a produção precisam trocar', () => {
    // O item do TODO.md "valores que o staging e a produção não herdam do .env.example" mora aqui, executável: quem
    // copiar o exemplo para lá recebe esta lista no primeiro boot, antes de qualquer escola. Uma variável nova na
    // mesma classe entra aqui **se estiver em outro leitor**, porque `loadConfig` soma os oito e ordena;
    // `loadLoginConfig` lança no primeiro `if`, então uma segunda recusa dentro dela não apareceria na lista
    // (`test-engineer`). E a lista é do que o boot **recusa**: chave sintética do exemplo sobe em produção sem
    // reclamar, e é por isso que o item do TODO.md separa as duas coisas.
    // `API_PORTA` e `TELEMETRIA_OTLP_URL` vêm do `environment:` do compose, não do arquivo; as URLs, do serviço.
    const exemplo = { ...ambienteValido, ...lerAmbienteExemplo(), API_PORTA: '3000', BANCO_URL: ambienteValido.BANCO_URL, REDIS_CACHE_URL: ambienteValido.REDIS_CACHE_URL, REDIS_FILA_URL: ambienteValido.REDIS_FILA_URL, TELEMETRIA_OTLP_URL: ambienteValido.TELEMETRIA_OTLP_URL }
    expect(loadConfig(exemplo).identidade.ambiente).toBe('local')
    // O prazo do Redis do login, que aqui é o de desenvolvimento, e os dois emissores do login pela conta da escola,
    // que apontam para o `oidc-falso` em http. Em produção somam a rota sintética, que o exemplo deixa ligada, e o
    // adaptador falso de IA, que o exemplo usa e a produção recusa.
    const semTls = ['LOGIN_EXTERNO_GOOGLE_EMISSOR', 'LOGIN_EXTERNO_MICROSOFT_EMISSOR', 'LOGIN_REDIS_PRAZO_MS']
    expect(erroDe({ ...exemplo, AMBIENTE: 'staging' }).variaveis).toEqual(semTls)
    expect(erroDe({ ...exemplo, AMBIENTE: 'producao' }).variaveis).toEqual(['IA_ADAPTADOR', ...semTls, 'ROTAS_SINTETICAS'])
  })

  it('AMBIENTE ausente ou inválido vale como produção na leitura do login, e o prazo acima do corte cai junto', () => {
    // `loadConfig` nunca chega aqui: `authEnvSchema` exige o enum e derruba o boot antes. A leitura
    // restrita é defesa em profundidade de `loadLoginConfig`, e só se prova chamando-a direto.
    const acimaDoCorte = { ...ambienteValido, LOGIN_REDIS_PRAZO_MS: String(TIMEOUT_COMANDO_REDIS_FILA_MS) }
    expect(loadLoginConfig(acimaDoCorte).prazoDoRedisMs).toBe(TIMEOUT_COMANDO_REDIS_FILA_MS)
    for (const ambiente of [undefined, 'homologacao']) {
      const erro = erroDeLogin({ ...acimaDoCorte, AMBIENTE: ambiente })
      expect(erro.variaveis, String(ambiente)).toEqual(['LOGIN_REDIS_PRAZO_MS'])
      expect(erro.message).toContain(MOTIVO_PRAZO_DO_REDIS_DO_LOGIN)
    }
  })

  it('a chave de dispositivo lida é a da versão declarada, e a versão sem chave não sobe', () => {
    const chaveV2 = 'chave_sintetica_do_dispositivo_v2_com_32_caracteres'
    const config = loadConfig({ ...ambienteValido, LOGIN_CHAVE_DISPOSITIVO_VERSAO: '2', LOGIN_CHAVE_DISPOSITIVO_V2: chaveV2 })
    expect(config.login.dispositivo).toEqual({ versao: 2, chave: new TextEncoder().encode(chaveV2) })
    expect(erroDe({ ...ambienteValido, LOGIN_CHAVE_DISPOSITIVO_VERSAO: '2' }).variaveis).toEqual(['LOGIN_CHAVE_DISPOSITIVO_V2'])
  })

  it('não sobe com a mesma chave no contador e no dispositivo: cada HMAC tem a sua', () => {
    const erro = erroDe({ ...ambienteValido, LOGIN_CHAVE_DISPOSITIVO_V1: ambienteValido.LOGIN_CHAVE_CONTADOR })
    expect(erro.variaveis).toEqual(['LOGIN_CHAVE_DISPOSITIVO_V1'])
    expect(erro.message).not.toContain(ambienteValido.LOGIN_CHAVE_CONTADOR)
  })

  it('MFA: a chave de cifra da versão atual é obrigatória; a anterior, se declarada, continua decifrando; e a de recuperação não repete nenhuma outra', () => {
    const chaveV2 = 'chave_sintetica_da_cifra_v2_com_32_caracteres'
    const config = loadConfig({ ...ambienteValido, IDENTIDADE_CHAVE_CIFRA_VERSAO: '2', IDENTIDADE_CHAVE_CIFRA_V2: chaveV2 })
    expect(config.login.mfa.versaoCifra).toBe(2)
    expect([...config.login.mfa.chavesCifra.entries()]).toEqual([
      [1, chaveDerivada(ambienteValido.IDENTIDADE_CHAVE_CIFRA_V1)],
      [2, chaveDerivada(chaveV2)],
    ])
    // A versão 1 aposentada pode sair do ambiente; a atual, nunca.
    expect([...loadConfig({ ...ambienteValido, IDENTIDADE_CHAVE_CIFRA_VERSAO: '2', IDENTIDADE_CHAVE_CIFRA_V1: undefined, IDENTIDADE_CHAVE_CIFRA_V2: chaveV2 }).login.mfa.chavesCifra.keys()]).toEqual([2])
    expect(erroDe({ ...ambienteValido, IDENTIDADE_CHAVE_CIFRA_VERSAO: '2' }).variaveis).toEqual(['IDENTIDADE_CHAVE_CIFRA_V2'])
    // A chave derivada tem 256 bits e não é o texto da variável.
    expect(config.login.mfa.chavesCifra.get(2)?.length).toBe(32)
    for (const repetida of [ambienteValido.LOGIN_CHAVE_CONTADOR, ambienteValido.LOGIN_CHAVE_DISPOSITIVO_V1, ambienteValido.IDENTIDADE_CHAVE_CIFRA_V1]) {
      const erro = erroDe({ ...ambienteValido, IDENTIDADE_CHAVE_RECUPERACAO: repetida })
      expect(erro.variaveis).toEqual(['IDENTIDADE_CHAVE_RECUPERACAO'])
      expect(erro.message).not.toContain(repetida)
    }
  })

  it('código da turma (A1, 4.0): SALA_CHAVE_CODIGO não repete nenhuma outra chave do ambiente, e a recusa não mostra o valor', () => {
    const outras = {
      LOGIN_CHAVE_CONTADOR: ambienteValido.LOGIN_CHAVE_CONTADOR,
      LOGIN_CHAVE_DISPOSITIVO_V1: ambienteValido.LOGIN_CHAVE_DISPOSITIVO_V1,
      IDENTIDADE_CHAVE_ASSINATURA: ambienteValido.IDENTIDADE_CHAVE_ASSINATURA,
      IDENTIDADE_CHAVE_CIFRA_V1: ambienteValido.IDENTIDADE_CHAVE_CIFRA_V1,
      IDENTIDADE_CHAVE_RECUPERACAO: ambienteValido.IDENTIDADE_CHAVE_RECUPERACAO,
      LOGIN_EXTERNO_CHAVE_COOKIE: 'chave_sintetica_do_cookie_externo_com_32_caracteres',
    }
    for (const [variavel, repetida] of Object.entries(outras)) {
      const erro = erroDe({ ...ambienteValido, LOGIN_EXTERNO_CHAVE_COOKIE: outras.LOGIN_EXTERNO_CHAVE_COOKIE, SALA_CHAVE_CODIGO: repetida })
      expect(erro.variaveis, variavel).toEqual(expect.arrayContaining(['SALA_CHAVE_CODIGO']))
      expect(erro.message, variavel).toContain(MOTIVO_CHAVE_DA_SALA_REPETIDA)
      expect(erro.message, variavel).not.toContain(repetida)
    }
    // O piso é 256 bits: 31 caracteres não sobem, 32 sobem.
    expect(erroDe({ ...ambienteValido, SALA_CHAVE_CODIGO: 's'.repeat(31) }).variaveis).toEqual(['SALA_CHAVE_CODIGO'])
    expect(loadConfig({ ...ambienteValido, SALA_CHAVE_CODIGO: 's'.repeat(32) }).sala.chaveCodigo).toHaveLength(32)
    // Com uma chave própria, sobe, e a chave lida é a da variável.
    expect(loadConfig(ambienteValido).sala.chaveCodigo).toEqual(new TextEncoder().encode(ambienteValido.SALA_CHAVE_CODIGO))
  })

  it('.env.example sobe com o argon2 no mínimo da OWASP (m=19456, t=2)', () => {
    const exemplo = lerAmbienteExemplo()
    const { login } = loadConfig({ ...ambienteValido, ...exemplo, API_PORTA: '3000', BANCO_URL: ambienteValido.BANCO_URL, REDIS_CACHE_URL: ambienteValido.REDIS_CACHE_URL, REDIS_FILA_URL: ambienteValido.REDIS_FILA_URL })
    expect(login.hash).toEqual({ memoriaKib: 19_456, iteracoes: 2 })
  })

  it.each(Object.keys(ambienteValido))(
    'não sobe sem %s: limite e endereço são configuração, nunca valor escondido no código',
    (variavel) => {
      const incompleto: Record<string, string | undefined> = { ...ambienteValido, [variavel]: undefined }
      expect(erroDe(incompleto).variaveis).toEqual([variavel])
    },
  )

  it('aponta todas as variáveis inválidas pelo nome e nunca repete o valor, que pode ter senha ou chave', () => {
    const urlComSenhaInvalida = 'mysql://educa:senha_sintetica_xyz@postgres/educa'
    const chaveCurta = 'chave_curta_sintetica'
    const erro = erroDe({ ...ambienteValido, BANCO_URL: urlComSenhaInvalida, API_PORTA: '0', IDENTIDADE_CHAVE_ASSINATURA: chaveCurta })
    expect(erro.variaveis).toEqual(['API_PORTA', 'BANCO_URL', 'IDENTIDADE_CHAVE_ASSINATURA'])
    expect(erro.message).not.toContain('senha_sintetica_xyz')
    expect(erro.message).not.toContain(chaveCurta)
  })

  it('não sobe com a espera da borda igual ou maior que o prazo da drenagem: nenhuma requisição terminaria', () => {
    expect(erroDe({ ...ambienteValido, DRENAGEM_ESPERA_BORDA_MS: '10000' }).variaveis).toEqual(['DRENAGEM_ESPERA_BORDA_MS'])
    expect(erroDe({ ...ambienteValido, DRENAGEM_ESPERA_BORDA_MS: '12000' }).variaveis).toEqual(['DRENAGEM_ESPERA_BORDA_MS'])
  })

  it.each([
    ['LIMITE_REQ_USUARIO_MIN', '0'],
    ['LIMITE_REQ_ESCOLA_MIN', '-1'],
    ['LIMITE_REQ_IP_ANONIMO_MIN', '1.5'],
    ['LIMITE_REQ_OPERADOR_MIN', '0'],
    ['LIMITE_INSTANCIAS_API', 'duas'],
    ['LIMITE_PROXIES_CONFIAVEIS', ' , '],
    ['LIMITE_PROXIES_CONFIAVEIS', 'http://borda:8080'],
    ['REDIS_CACHE_URL', 'redis-cache:6379'],
    ['REDIS_FILA_URL', 'http://redis-fila:6379'],
  ])('não sobe com %s=%s: limite sem valor válido não vira "sem limite"', (variavel, valor) => {
    expect(erroDe({ ...ambienteValido, [variavel]: valor }).variaveis).toEqual([variavel])
  })

  it('.env.example traz os padrões da Tech Spec: 120/min por usuário, 30.000/min por escola, 3.000/min por IP anônimo, duas instâncias e a borda', () => {
    const exemplo = lerAmbienteExemplo()
    const { limite } = loadConfig({ ...ambienteValido, ...exemplo, API_PORTA: '3000', BANCO_URL: ambienteValido.BANCO_URL, REDIS_CACHE_URL: ambienteValido.REDIS_CACHE_URL, REDIS_FILA_URL: ambienteValido.REDIS_FILA_URL })
    expect(limite).toMatchObject({ porUsuarioMin: 120, porEscolaMin: 30_000, porIpAnonimoMin: 3_000, porOperadorMin: 120, instancias: 2, proxiesConfiaveis: ['borda'] })
  })

  it('aceita mais de um proxy confiável, por nome ou IP, separados por vírgula', () => {
    const config = loadConfig({ ...ambienteValido, LIMITE_PROXIES_CONFIAVEIS: 'borda, 10.0.0.2,fd00::1' })
    expect(config.limite.proxiesConfiaveis).toEqual(['borda', '10.0.0.2', 'fd00::1'])
  })

  it('sobe em produção sem nenhuma variável a mais: a flag do token sintético do F0 não existe mais', () => {
    const config = loadConfig({ ...ambienteValido, ...IA_DE_PRODUCAO, AMBIENTE: 'producao' })
    expect(config.identidade.ambiente).toBe('producao')
  })

  it('ROTAS_SINTETICAS liga a rota de teste só quando é exatamente true, e não sobe ligada em produção', () => {
    expect(loadConfig({ ...ambienteValido, ROTAS_SINTETICAS: 'true' }).rotasSinteticas).toBe(true)
    for (const valor of ['1', 'TRUE', '', 'sim']) {
      expect(erroDe({ ...ambienteValido, ROTAS_SINTETICAS: valor }).variaveis).toEqual(['ROTAS_SINTETICAS'])
    }
    const emProducao = erroDe({ ...ambienteValido, ...IA_DE_PRODUCAO, AMBIENTE: 'producao', ROTAS_SINTETICAS: 'true' })
    expect(emProducao.variaveis).toEqual(['ROTAS_SINTETICAS'])
    expect(emProducao.message).toContain(MOTIVO_ROTAS_SINTETICAS_EM_PRODUCAO)
  })

  it('AVISOS_SISTEMA vira a lista de avisos, e JSON quebrado ou aviso fora do formato não sobe', () => {
    const aviso = { id: 'manutencao-sabado', texto: 'Manutenção programada no sábado, das 8h às 10h.', publicadoEm: '2026-09-13' }
    expect(loadConfig({ ...ambienteValido, AVISOS_SISTEMA: JSON.stringify([aviso]) }).avisos).toEqual([aviso])

    const semJson = erroDe({ ...ambienteValido, AVISOS_SISTEMA: '[{"id":' })
    expect(semJson.variaveis).toEqual(['AVISOS_SISTEMA'])
    expect(semJson.message).toContain(MOTIVO_AVISOS_SEM_JSON)
    for (const invalido of [
      '{}',
      JSON.stringify([{ ...aviso, publicadoEm: '13/09/2026' }]),
      JSON.stringify([{ ...aviso, texto: '' }]),
      JSON.stringify([{ ...aviso, escolaId: '0190f5a0-0000-7000-8000-00000000000a' }]),
      JSON.stringify(Array.from({ length: 11 }, (_, indice) => ({ ...aviso, id: `aviso-${indice}` }))),
    ]) {
      expect(erroDe({ ...ambienteValido, AVISOS_SISTEMA: invalido }).variaveis, invalido).toEqual(['AVISOS_SISTEMA'])
    }
  })

  it('VERSAO só aceita um identificador curto, sem espaço nem barra', () => {
    expect(loadConfig({ ...ambienteValido, VERSAO: '3d4099c' }).versao).toBe('3d4099c')
    for (const valor of ['', 'v 1', '../etc', 'x'.repeat(65)]) {
      expect(erroDe({ ...ambienteValido, VERSAO: valor }).variaveis).toEqual(['VERSAO'])
    }
  })
})
