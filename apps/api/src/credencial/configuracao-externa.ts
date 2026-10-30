import { InvalidConfigError, PROVEDORES_EXTERNOS, type ProvedorExterno } from '@educa/nucleo'
import { hkdfSync } from 'node:crypto'
import { TAMANHO_MINIMO_CHAVE_DE_LOGIN } from './configuracao-de-login.js'

/** O caminho do retorno, o mesmo para os dois provedores: o provedor do login em andamento vai no cookie `educa_oidc`. */
export const CAMINHO_DO_RETORNO = '/v1/sessao/externa/retorno'

/** Bytes da chave AES-256 do cookie `educa_oidc`, derivada pelo HKDF do texto da variável. */
const BYTES_DA_CHAVE_DO_COOKIE = 32
/** O rótulo (`info`) do HKDF: a chave do cookie nunca é a mesma sequência de bytes de outra chave, mesmo com texto copiado. */
const ROTULO_DA_CHAVE_DO_COOKIE = 'educa.login-externo.cookie.aes-256-gcm'

/** Um provedor ligado: o emissor (o endereço do discovery sem `/.well-known/...`) e o cliente cadastrado nele. */
export interface ProvedorConfigurado {
  readonly emissor: URL
  readonly clienteId: string
  readonly segredoCliente: string
}

/**
 * O login pela conta da escola (13.0). É um adaptador opcional (regra 00, itens 7 e 8): sem as variáveis de um
 * provedor, ele fica desligado, a escola não o oferece, e o resto do login segue igual.
 */
export interface ConfiguracaoLoginExterno {
  /** Os provedores ligados; vazio desliga o login pela conta da escola. */
  readonly provedores: ReadonlyMap<ProvedorExterno, ProvedorConfigurado>
  /** O `redirect_uri` cadastrado nos provedores: o endereço público de `CAMINHO_DO_RETORNO`. */
  readonly retorno: URL | undefined
  /** A chave AES-256 do cookie `educa_oidc`. */
  readonly chaveDoCookie: Uint8Array | undefined
  /** Só no ambiente local: aceita emissor em `http` (o `oidc-falso` do compose). */
  readonly aceitaEmissorSemTls: boolean
}

export const MOTIVO_PROVEDOR_INCOMPLETO = 'cada provedor do login pela conta da escola precisa das três variáveis (emissor, cliente e segredo), ou de nenhuma'
export const MOTIVO_EMISSOR_SEM_TLS = 'fora do ambiente local, o emissor e o retorno do login pela conta da escola precisam ser https'
export const MOTIVO_RETORNO = `LOGIN_EXTERNO_RETORNO_URL precisa ser o endereço completo de ${CAMINHO_DO_RETORNO}`
export const MOTIVO_CHAVE_DO_COOKIE = 'LOGIN_EXTERNO_CHAVE_COOKIE é obrigatória com um provedor ligado, com pelo menos 32 caracteres e diferente das outras chaves'

/** O prefixo das variáveis de um provedor: `LOGIN_EXTERNO_GOOGLE_`, `LOGIN_EXTERNO_MICROSOFT_`. */
function prefixo(provedor: ProvedorExterno): string {
  return `LOGIN_EXTERNO_${provedor.toUpperCase()}_`
}

function url(texto: string | undefined): URL | undefined {
  if (texto === undefined || texto === '') return undefined
  try {
    return new URL(texto)
  } catch {
    return undefined
  }
}

/** As chaves de outros usos: a do cookie não pode repetir nenhuma. */
const OUTRAS_CHAVES = [
  'IDENTIDADE_CHAVE_ASSINATURA',
  'LOGIN_CHAVE_CONTADOR',
  'IDENTIDADE_CHAVE_RECUPERACAO',
] as const

/**
 * Lê a configuração do login pela conta da escola. Um provedor é ligado com as três variáveis dele preenchidas, e
 * desligado com as três vazias; meio preenchido não sobe. Com algum ligado, o retorno e a chave do cookie são
 * obrigatórios. Fora do ambiente local, só `https`. As mensagens citam só o nome da variável.
 */
export function lerConfiguracaoLoginExterno(ambiente: Record<string, string | undefined>): ConfiguracaoLoginExterno {
  const local = ambiente['AMBIENTE'] === 'local'
  const provedores = new Map<ProvedorExterno, ProvedorConfigurado>()
  const invalidas: string[] = []
  const motivos = new Set<string>()
  for (const provedor of PROVEDORES_EXTERNOS) {
    const nomes = ['EMISSOR', 'CLIENTE', 'SEGREDO'].map((sufixo) => `${prefixo(provedor)}${sufixo}`)
    const valores = nomes.map((nome) => ambiente[nome] ?? '')
    const preenchidas = valores.filter((valor) => valor !== '').length
    if (preenchidas === 0) continue
    const [textoDoEmissor = '', clienteId = '', segredoCliente = ''] = valores
    const emissor = url(textoDoEmissor)
    if (preenchidas < nomes.length || emissor === undefined) {
      invalidas.push(...nomes)
      motivos.add(MOTIVO_PROVEDOR_INCOMPLETO)
      continue
    }
    if (emissor.protocol !== 'https:' && !(local && emissor.protocol === 'http:')) {
      invalidas.push(nomes[0] ?? '')
      motivos.add(MOTIVO_EMISSOR_SEM_TLS)
      continue
    }
    provedores.set(provedor, { emissor, clienteId, segredoCliente })
  }

  let retorno: URL | undefined
  let chaveDoCookie: Uint8Array | undefined
  if (provedores.size > 0) {
    retorno = url(ambiente['LOGIN_EXTERNO_RETORNO_URL'])
    if (retorno === undefined || retorno.pathname !== CAMINHO_DO_RETORNO || retorno.search !== '' || retorno.hash !== '') {
      invalidas.push('LOGIN_EXTERNO_RETORNO_URL')
      motivos.add(MOTIVO_RETORNO)
    } else if (retorno.protocol !== 'https:' && !(local && retorno.protocol === 'http:')) {
      invalidas.push('LOGIN_EXTERNO_RETORNO_URL')
      motivos.add(MOTIVO_EMISSOR_SEM_TLS)
    }
    const texto = ambiente['LOGIN_EXTERNO_CHAVE_COOKIE']
    const repetida = OUTRAS_CHAVES.some((nome) => ambiente[nome] === texto) || Object.entries(ambiente).some(([nome, valor]) => /^(LOGIN_CHAVE_DISPOSITIVO_V|IDENTIDADE_CHAVE_CIFRA_V)\d+$/.test(nome) && valor === texto)
    if (texto === undefined || texto.length < TAMANHO_MINIMO_CHAVE_DE_LOGIN || repetida) {
      invalidas.push('LOGIN_EXTERNO_CHAVE_COOKIE')
      motivos.add(MOTIVO_CHAVE_DO_COOKIE)
    } else {
      chaveDoCookie = new Uint8Array(hkdfSync('sha256', texto, new Uint8Array(0), ROTULO_DA_CHAVE_DO_COOKIE, BYTES_DA_CHAVE_DO_COOKIE))
    }
  }
  if (invalidas.length > 0) throw new InvalidConfigError([...new Set(invalidas)].sort(), [...motivos])
  return { provedores, retorno, chaveDoCookie, aceitaEmissorSemTls: local }
}
