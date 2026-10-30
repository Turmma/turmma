import { AMBIENTES, InvalidConfigError, isLoginProtectionDisabled, TIMEOUT_COMANDO_REDIS_API_MS, validateEnvironment, type Environment } from '@educa/nucleo'
import { hkdfSync } from 'node:crypto'
import { z } from 'zod'

/** Mínimo da OWASP para argon2id com um fio (m=19456 KiB, t=2). A calibração da 16.0 só sobe a partir daqui. */
export const MEMORIA_MINIMA_ARGON2_KIB = 19_456
export const ITERACOES_MINIMAS_ARGON2 = 2

/**
 * Threads do libuv que ficam fora do hash de senha: a resolução de nome e o arquivo rodam nelas (`docs/infra.md`,
 * "Threads e DNS"). `LOGIN_HASH_CONCORRENCIA` vai no máximo até `UV_THREADPOOL_SIZE` menos esta folga.
 */
export const THREADS_DE_FOLGA_DO_LIBUV = 8

export const MOTIVO_CONCORRENCIA_DO_HASH =
  'LOGIN_HASH_CONCORRENCIA vai no máximo até UV_THREADPOOL_SIZE − 8: as 8 threads de folga do libuv são da resolução de nome e de arquivo'

/**
 * Piso de `LOGIN_REDIS_PRAZO_MS`, um décimo do corte. Abaixo dele o prazo deixa de ser "desistir cedo" e vira
 * "desistir sempre": o comando estoura no tick seguinte, e todo login cai no seguro com o Redis sadio. A variável só
 * aperta, mas apertar até sumir não é apertar (`test-engineer`). De 10 a 99 ms continua aceito de propósito: 10 ms
 * ainda é espera de verdade contra um `EXISTS` de poucos milissegundos.
 *
 * `Math.round` porque o piso alimenta um `z.coerce.number().int()`: um corte que não fosse múltiplo de 10 daria um
 * piso fracionário, e o valor logo abaixo dele passaria a ser recusado pelo `.int()`, não pelo piso — o teste seguiria
 * verde pelo motivo errado (`test-engineer` e `infra-guardian`).
 */
export const PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS = Math.round(TIMEOUT_COMANDO_REDIS_API_MS / 10)

/**
 * `LOGIN_REDIS_PRAZO_MS` acima do corte só existe fora de produção e de staging: lá o Redis que não responde não pode
 * segurar a requisição do aluno (regra 80), e o staging ensaia a produção.
 */
export const MOTIVO_PRAZO_DO_REDIS_DO_LOGIN = `LOGIN_REDIS_PRAZO_MS não passa de ${String(TIMEOUT_COMANDO_REDIS_API_MS)} ms com AMBIENTE=producao nem staging: um Redis que não responde não pode segurar a requisição do aluno`

/**
 * Se este prazo do cliente Redis do login vale no ambiente. A variável **só aperta**: qualquer valor até o corte de
 * `TIMEOUT_COMANDO_REDIS_API_MS` passa em qualquer ambiente, e acima dele só em `local`.
 *
 * Os 100 ms do corte são o desenho em produção: com o Redis lento ou travado, o contador cai no seguro em memória e o
 * desafio é recusado (`docs/infra.md` 5.2). Redis gerenciado na mesma região responde um `EXISTS` ou um `SET NX` em
 * poucos milissegundos no p99, e 100 ms dão dezenas de vezes de folga.
 *
 * Em `local` o valor sobe para os 2 s do cliente da fila, porque ali o Postgres, os dois Redis, a observabilidade, os
 * nossos contêineres e a suíte dividem a mesma CPU: uma resposta acima de 100 ms é rotina da máquina, e cortar nela
 * recusava o desafio e derrubava o login no meio do e2e, sem defeito nenhum de produção (correção
 * `2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e`). O cenário de carga é a exceção dentro de `local`:
 * `infra/carga.env` fixa o corte de produção, porque é lá que ele é medido com a rajada das 7h30.
 */
function prazoDoRedisDoLoginVale(prazoMs: number, ambiente: Environment): boolean {
  return prazoMs <= TIMEOUT_COMANDO_REDIS_API_MS || ambiente === 'local'
}

/** Chave de HMAC com pelo menos 256 bits, como a de assinatura do token. */
export const TAMANHO_MINIMO_CHAVE_DE_LOGIN = 32

/** Os parâmetros do argon2id. O paralelismo é sempre 1 (Tech Spec, seção 5, "Hash"). */
export interface ParametrosDoHash {
  readonly memoriaKib: number
  readonly iteracoes: number
}

export interface ConfiguracaoLogin {
  readonly hash: ParametrosDoHash
  /** Quantos hashes de senha rodam ao mesmo tempo nesta instância (o semáforo do hash, tarefa 14.0). */
  readonly concorrenciaDoHash: number
  /**
   * Só no controle negativo do cenário "login às 7h30" (`LOGIN_PROTECAO_DESLIGADA=true`, tarefa 16.0): o semáforo atende
   * todo login numa fila só, sem baldes por escola nem rebaixamento. Recusada com `AMBIENTE=producao`.
   */
  readonly protecaoDesligada: boolean
  /** Quanto o cliente Redis do login espera por comando antes de desistir (`LOGIN_REDIS_PRAZO_MS`). */
  readonly prazoDoRedisMs: number
  /**
   * Tentativas por minuto de um IP em `/v1/sessao/email` antes de ele ir para o fim do balde da equipe (15.2): vezes as
   * escolas da rede, se o IP é de saída de uma (`rede.ips_saida`). Acima dele nada é recusado.
   */
  readonly limiteEmailPorIpMin: number
  /** Chave do HMAC do identificador na chave do contador de tentativas: o Redis nunca vê o e-mail. */
  readonly chaveContador: Uint8Array
  /** A chave do HMAC das entradas do cookie `educa_dispositivo`, com a versão que vai no próprio cookie. */
  readonly dispositivo: { readonly versao: number; readonly chave: Uint8Array }
  /** As chaves do segundo fator (tarefa 6.0). */
  readonly mfa: ConfiguracaoMfa
}

export interface ConfiguracaoMfa {
  /** A versão da chave que cifra todo segredo novo; vai para `conta.mfa_chave_versao`. */
  readonly versaoCifra: number
  /**
   * As chaves AES-256 de cada versão declarada (`IDENTIDADE_CHAVE_CIFRA_V{n}`, derivadas pelo HKDF): a atual cifra, e as
   * anteriores continuam decifrando o segredo de quem configurou antes da troca.
   */
  readonly chavesCifra: ReadonlyMap<number, Uint8Array>
  /** A chave do HMAC dos códigos de recuperação, separada das da cifra: quem tem uma não tem a outra. */
  readonly chaveRecuperacao: Uint8Array
}

/** AES-256 pede chave de exatamente 256 bits, que o HKDF deriva do texto da variável. */
export const BYTES_DA_CHAVE_DE_CIFRA = 32
/** Maior versão de chave de cifra aceita, a mesma faixa da versão do cookie de dispositivo. */
const MAIOR_VERSAO_DE_CHAVE = 99

/** O nome da variável da chave de cifra do segredo do MFA na versão. */
export function variavelDaChaveDeCifra(versao: number): string {
  return `IDENTIDADE_CHAVE_CIFRA_V${String(versao)}`
}

export const MOTIVO_CHAVE_DE_CIFRA = 'a chave de cifra do MFA da versão atual é obrigatória, com pelo menos 32 caracteres'
/** O rótulo (`info`) do HKDF que deriva a chave AES-256 do texto da variável. */
const ROTULO_DA_CHAVE_DE_CIFRA = 'educa.mfa.segredo.aes-256-gcm'
export const MOTIVO_CHAVE_DE_RECUPERACAO_REPETIDA = 'IDENTIDADE_CHAVE_RECUPERACAO precisa ser diferente das outras chaves: cada HMAC e cada cifra têm a própria chave'

const esquemaAmbienteLogin = z.object({
  LOGIN_ARGON2_MEMORIA_KIB: z.coerce.number().int().min(MEMORIA_MINIMA_ARGON2_KIB),
  LOGIN_ARGON2_ITERACOES: z.coerce.number().int().min(ITERACOES_MINIMAS_ARGON2),
  // Obrigatórias e sem padrão no código: o teto do semáforo é conferido contra as threads que o processo tem de fato.
  LOGIN_HASH_CONCORRENCIA: z.coerce.number().int().min(1),
  UV_THREADPOOL_SIZE: z.coerce.number().int().min(1),
  // Obrigatória e sem padrão no código: o valor de referência (60) fica no `.env.example` (15.2).
  LIMITE_LOGIN_EMAIL_IP_MIN: z.coerce.number().int().min(1),
  // Obrigatória e sem padrão no código: o prazo com que a API sobe é sempre o do ambiente, à vista. O piso não é 1:
  // um prazo de poucos milissegundos estoura no tick seguinte, como o zero, e viraria desafio recusado e contador no
  // seguro em todo login.
  LOGIN_REDIS_PRAZO_MS: z.coerce.number().int().min(PRAZO_MINIMO_DO_REDIS_DO_LOGIN_MS),
  LOGIN_CHAVE_CONTADOR: z.string().min(TAMANHO_MINIMO_CHAVE_DE_LOGIN),
  LOGIN_CHAVE_DISPOSITIVO_VERSAO: z.coerce.number().int().min(1).max(99),
  IDENTIDADE_CHAVE_CIFRA_VERSAO: z.coerce.number().int().min(1).max(MAIOR_VERSAO_DE_CHAVE),
  IDENTIDADE_CHAVE_RECUPERACAO: z.string().min(TAMANHO_MINIMO_CHAVE_DE_LOGIN),
})

/**
 * A chave AES-256 da versão: o segredo do ambiente (texto de pelo menos 32 caracteres, como as outras chaves) passa
 * pelo HKDF-SHA256, com o rótulo do uso, e dá os 32 bytes. Assim a chave de cifra nunca é a mesma sequência de bytes
 * de nenhum HMAC, mesmo que alguém copie o texto de uma variável para outra.
 */
function chaveDeCifra(valor: string | undefined): Uint8Array | undefined {
  if (valor === undefined || valor.length < TAMANHO_MINIMO_CHAVE_DE_LOGIN) return undefined
  return new Uint8Array(hkdfSync('sha256', valor, new Uint8Array(0), ROTULO_DA_CHAVE_DE_CIFRA, BYTES_DA_CHAVE_DE_CIFRA))
}

/**
 * As chaves de cifra de todas as versões declaradas até a atual. A atual é obrigatória; uma anterior pode faltar (a
 * versão foi aposentada depois de todo segredo dela ser recifrado), mas, se estiver declarada, precisa ser válida.
 */
function lerChavesDeCifra(ambiente: Record<string, string | undefined>, versaoAtual: number): Map<number, Uint8Array> {
  const chaves = new Map<number, Uint8Array>()
  const invalidas: string[] = []
  for (let versao = 1; versao <= versaoAtual; versao++) {
    const variavel = variavelDaChaveDeCifra(versao)
    const valor = ambiente[variavel]
    if (valor === undefined && versao < versaoAtual) continue
    const chave = chaveDeCifra(valor)
    if (chave === undefined) invalidas.push(variavel)
    else chaves.set(versao, chave)
  }
  if (invalidas.length > 0) throw new InvalidConfigError(invalidas, [MOTIVO_CHAVE_DE_CIFRA])
  return chaves
}

/** O nome da variável da chave de dispositivo da versão: trocar a versão invalida todo cookie já emitido. */
export function variavelDaChaveDeDispositivo(versao: number): string {
  return `LOGIN_CHAVE_DISPOSITIVO_V${String(versao)}`
}

/**
 * Lê a configuração do login por e-mail e do segundo fator. Não sobe sem `LOGIN_HASH_CONCORRENCIA`, nem com ela acima de
 * `UV_THREADPOOL_SIZE − 8`; nem com parâmetro do argon2 abaixo da OWASP, com
 * chave curta, sem a chave da versão de dispositivo declarada, sem a chave de cifra da versão atual do MFA, nem com a
 * chave dos códigos de recuperação repetindo outra. As mensagens citam só o nome da variável.
 */
export function lerConfiguracaoLogin(ambiente: Record<string, string | undefined>): ConfiguracaoLogin {
  const valores = validateEnvironment(esquemaAmbienteLogin, ambiente)
  // O AMBIENTE é validado pela identidade: aqui, ausente ou inválido vale como produção, a leitura mais restrita, sem
  // apontar a falta duas vezes. É defesa em profundidade, e não a garantia: `authEnvSchema` exige o enum e
  // derruba o boot antes de este ramo ser alcançado por `lerConfiguracao`.
  const doAmbiente = AMBIENTES.find((valor) => valor === ambiente['AMBIENTE']) ?? 'producao'
  const protecaoDesligada = isLoginProtectionDisabled({ ...ambiente, AMBIENTE: doAmbiente })
  if (!prazoDoRedisDoLoginVale(valores.LOGIN_REDIS_PRAZO_MS, doAmbiente)) {
    throw new InvalidConfigError(['LOGIN_REDIS_PRAZO_MS'], [MOTIVO_PRAZO_DO_REDIS_DO_LOGIN])
  }
  if (valores.LOGIN_HASH_CONCORRENCIA > valores.UV_THREADPOOL_SIZE - THREADS_DE_FOLGA_DO_LIBUV) {
    throw new InvalidConfigError(['LOGIN_HASH_CONCORRENCIA'], [MOTIVO_CONCORRENCIA_DO_HASH])
  }
  const variavel = variavelDaChaveDeDispositivo(valores.LOGIN_CHAVE_DISPOSITIVO_VERSAO)
  const chaveDispositivo = ambiente[variavel]
  if (chaveDispositivo === undefined || chaveDispositivo.length < TAMANHO_MINIMO_CHAVE_DE_LOGIN) throw new InvalidConfigError([variavel])
  if (chaveDispositivo === valores.LOGIN_CHAVE_CONTADOR) {
    throw new InvalidConfigError([variavel], [`${variavel} precisa ser diferente de LOGIN_CHAVE_CONTADOR: cada HMAC tem a própria chave`])
  }
  const chavesCifra = lerChavesDeCifra(ambiente, valores.IDENTIDADE_CHAVE_CIFRA_VERSAO)
  const outrasChaves = [valores.LOGIN_CHAVE_CONTADOR, chaveDispositivo, ambiente[variavelDaChaveDeCifra(valores.IDENTIDADE_CHAVE_CIFRA_VERSAO)]]
  if (outrasChaves.includes(valores.IDENTIDADE_CHAVE_RECUPERACAO)) {
    throw new InvalidConfigError(['IDENTIDADE_CHAVE_RECUPERACAO'], [MOTIVO_CHAVE_DE_RECUPERACAO_REPETIDA])
  }
  const codificar = (texto: string) => new TextEncoder().encode(texto)
  return {
    hash: { memoriaKib: valores.LOGIN_ARGON2_MEMORIA_KIB, iteracoes: valores.LOGIN_ARGON2_ITERACOES },
    concorrenciaDoHash: valores.LOGIN_HASH_CONCORRENCIA,
    protecaoDesligada,
    prazoDoRedisMs: valores.LOGIN_REDIS_PRAZO_MS,
    limiteEmailPorIpMin: valores.LIMITE_LOGIN_EMAIL_IP_MIN,
    chaveContador: codificar(valores.LOGIN_CHAVE_CONTADOR),
    dispositivo: { versao: valores.LOGIN_CHAVE_DISPOSITIVO_VERSAO, chave: codificar(chaveDispositivo) },
    mfa: { versaoCifra: valores.IDENTIDADE_CHAVE_CIFRA_VERSAO, chavesCifra, chaveRecuperacao: codificar(valores.IDENTIDADE_CHAVE_RECUPERACAO) },
  }
}
