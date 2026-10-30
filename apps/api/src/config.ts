import {
  ConfiguracaoInvalida,
  lerConfiguracaoBanco,
  lerConfiguracaoDeIa,
  lerConfiguracaoDrenagem,
  lerConfiguracaoIdentidade,
  lerConfiguracaoLimite,
  lerConfiguracaoTelemetria,
  validarAmbiente,
  type ConfiguracaoBanco,
  type ConfiguracaoDeIa,
  type ConfiguracaoDrenagem,
  type ConfiguracaoIdentidade,
  type ConfiguracaoLimite,
  type ConfiguracaoTelemetria,
} from '@educa/nucleo'
import { avisoSchema, MAXIMO_DE_AVISOS, type Aviso } from '@educa/shared'
import { z } from 'zod'
import { lerConfiguracaoDoArmazem, type ConfiguracaoDoArmazemDaApi } from './privacidade/configuracao-do-armazem.js'
import { lerConfiguracaoSala, type ConfiguracaoSala } from './sala/configuracao-da-sala.js'
import { type ConfiguracaoLogin, type ConfiguracaoLoginExterno, lerConfiguracaoLogin, lerConfiguracaoLoginExterno } from './credencial/index.js'

export { ConfiguracaoInvalida }

const inteiroPositivo = z.coerce.number().int().positive()

/**
 * `AVISOS_SISTEMA` é um JSON com a lista de avisos que a casca mostra, `[]` quando não há nenhum. JSON
 * quebrado ou aviso fora do formato reprova o boot, como qualquer outra variável.
 */
export const MOTIVO_AVISOS_SEM_JSON = 'AVISOS_SISTEMA precisa ser um JSON com a lista de avisos, [] quando não há nenhum'

const avisosEmJson = z
  .string()
  .transform((texto, contexto) => {
    try {
      return JSON.parse(texto) as unknown
    } catch {
      contexto.addIssue({ code: 'custom', message: MOTIVO_AVISOS_SEM_JSON })
      return z.NEVER
    }
  })
  .pipe(z.array(avisoSchema).max(MAXIMO_DE_AVISOS))

export const MOTIVO_ROTAS_SINTETICAS_EM_PRODUCAO =
  'ROTAS_SINTETICAS=true é proibido com AMBIENTE=producao: rota de teste não existe em produção'

/**
 * `ROTAS_SINTETICAS` liga o `POST /v1/sistema/jobs-sinteticos`, que só serve a teste e ao cenário de
 * carga. Como a flag do token sintético, só aceita `true` ou `false` escrito assim, e não sobe ligada
 * em produção.
 */
const esquemaAmbiente = z
  .object({
    API_PORTA: inteiroPositivo,
    // Validado pela identidade; aqui só é lido para a trava de produção, sem apontar a falta duas vezes.
    AMBIENTE: z.string().optional(),
    ROTAS_SINTETICAS: z.enum(['true', 'false']),
    // Versão do código que a casca mostra: `local` na máquina, o commit no staging.
    VERSAO: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
    AVISOS_SISTEMA: avisosEmJson,
    // Só para o contador de uso por escola (D30): a API não depende dele para atender.
    REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
  })
  .superRefine((valores, contexto) => {
    if (valores.AMBIENTE === 'producao' && valores.ROTAS_SINTETICAS === 'true') {
      contexto.addIssue({ code: 'custom', path: ['ROTAS_SINTETICAS'], message: MOTIVO_ROTAS_SINTETICAS_EM_PRODUCAO })
    }
  })

export interface ConfiguracaoApi {
  porta: number
  /** Liga as rotas que só existem para teste e carga. */
  rotasSinteticas: boolean
  /** Versão do código, mostrada em `GET /v1/sistema/estado`. */
  versao: string
  /** Avisos do sistema, lidos da configuração e servidos em `GET /v1/sistema/avisos`. */
  avisos: readonly Aviso[]
  /** Redis de fila, onde a API marca o uso de cada escola sem esperar resposta. */
  redisFilaUrl: string
  banco: ConfiguracaoBanco
  identidade: ConfiguracaoIdentidade
  /** Hash de senha, chave do contador de tentativas e chave do cookie de dispositivo do login por e-mail. */
  login: ConfiguracaoLogin
  /** O login pela conta Google ou Microsoft da escola: provedores ligados, retorno e chave do cookie `educa_oidc`. */
  loginExterno: ConfiguracaoLoginExterno
  /** A chave do HMAC do código da turma (A1, 4.0), separada das do login. */
  sala: ConfiguracaoSala
  drenagem: ConfiguracaoDrenagem
  limite: ConfiguracaoLimite
  /** Para onde e de quanto em quanto tempo as métricas vão. */
  telemetria: ConfiguracaoTelemetria
  /**
   * A camada de IA: o adaptador (o falso, sem nenhuma variável), o modelo de cada perfil, o prazo da chamada e as vagas
   * e o prazo das execuções em segundo plano. Nenhuma variável dela é obrigatória fora de produção, onde o adaptador
   * falso é recusado.
   */
  ia: ConfiguracaoDeIa
  /**
   * O storage privado do arquivo do titular (F3, tarefa 13.0): a API confere que o objeto existe e assina a URL de
   * download de 5 minutos. O worker grava e apaga; a API só assina e confere.
   */
  armazem: ConfiguracaoDoArmazemDaApi
}

/** Executa a leitura e devolve o erro de configuração em vez de lançar, para somar os problemas. */
function tentar<T>(ler: () => T): { valor: T } | { erro: ConfiguracaoInvalida } {
  try {
    return { valor: ler() }
  } catch (erro) {
    if (erro instanceof ConfiguracaoInvalida) return { erro }
    throw erro
  }
}

/**
 * Lê e valida o ambiente da API. Não sobe com variável faltando ou inválida, e não sobe com
 * token sintético ligado em produção. Todos os problemas saem de uma vez, só pelo nome.
 */
export function lerConfiguracao(ambiente: Record<string, string | undefined>): ConfiguracaoApi {
  const api = tentar(() => validarAmbiente(esquemaAmbiente, ambiente))
  const banco = tentar(() => lerConfiguracaoBanco(ambiente))
  const identidade = tentar(() => lerConfiguracaoIdentidade(ambiente))
  const login = tentar(() => lerConfiguracaoLogin(ambiente))
  const loginExterno = tentar(() => lerConfiguracaoLoginExterno(ambiente))
  const sala = tentar(() => lerConfiguracaoSala(ambiente))
  const drenagem = tentar(() => lerConfiguracaoDrenagem(ambiente))
  const limite = tentar(() => lerConfiguracaoLimite(ambiente))
  const telemetria = tentar(() => lerConfiguracaoTelemetria(ambiente))
  const ia = tentar(() => lerConfiguracaoDeIa(ambiente))
  const armazem = tentar(() => lerConfiguracaoDoArmazem(ambiente))
  if ('erro' in api || 'erro' in banco || 'erro' in identidade || 'erro' in login || 'erro' in loginExterno || 'erro' in sala || 'erro' in drenagem || 'erro' in limite || 'erro' in telemetria || 'erro' in ia || 'erro' in armazem) {
    const erros = [api, banco, identidade, login, loginExterno, sala, drenagem, limite, telemetria, ia, armazem].flatMap((leitura) => ('erro' in leitura ? [leitura.erro] : []))
    throw new ConfiguracaoInvalida(
      // Sem repetir: o `AMBIENTE` é validado pela identidade e de novo pela IA, que o lê para a trava de produção.
      [...new Set(erros.flatMap((erro) => erro.variaveis))].sort(),
      erros.flatMap((erro) => erro.motivos),
    )
  }
  return {
    porta: api.valor.API_PORTA,
    rotasSinteticas: api.valor.ROTAS_SINTETICAS === 'true',
    versao: api.valor.VERSAO,
    avisos: api.valor.AVISOS_SISTEMA,
    redisFilaUrl: api.valor.REDIS_FILA_URL,
    banco: banco.valor,
    identidade: identidade.valor,
    login: login.valor,
    loginExterno: loginExterno.valor,
    sala: sala.valor,
    drenagem: drenagem.valor,
    limite: limite.valor,
    telemetria: telemetria.valor,
    ia: ia.valor,
    armazem: armazem.valor,
  }
}
