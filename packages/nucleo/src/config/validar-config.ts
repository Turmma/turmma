import { SYSTEM_ENVIRONMENTS } from '@educa/shared'
import { z } from 'zod'

/**
 * Configuração inválida no boot. A mensagem cita só o nome da variável, e o motivo quando ele
 * é texto fixo nosso: o valor pode ser senha ou chave de assinatura.
 */
export class ConfiguracaoInvalida extends Error {
  constructor(
    readonly variaveis: string[],
    readonly motivos: string[] = [],
  ) {
    super(['Configuração inválida ou ausente: ' + variaveis.join(', '), ...motivos].join('. '))
    this.name = 'ConfiguracaoInvalida'
  }
}

/**
 * Valida o ambiente contra o esquema e devolve os valores convertidos. Toda variável inválida é
 * apontada de uma vez, pelo nome. Mensagem de problema só entra quando é de regra nossa
 * (`code: 'custom'`), que é texto fixo; a do zod pode repetir o valor recebido.
 */
export function validarAmbiente<Esquema extends z.ZodType>(
  esquema: Esquema,
  ambiente: Record<string, string | undefined>,
): z.output<Esquema> {
  const resultado = esquema.safeParse(ambiente)
  if (resultado.success) return resultado.data
  const problemas = resultado.error.issues
  const variaveis = [...new Set(problemas.map((problema) => String(problema.path[0])))].sort()
  const motivos = problemas.filter((problema) => problema.code === 'custom').map((problema) => problema.message)
  throw new ConfiguracaoInvalida(variaveis, motivos)
}

/** Um só conjunto: a casca recebe o ambiente pelo contrato de `packages/shared`. */
export const AMBIENTES = SYSTEM_ENVIRONMENTS
export type Ambiente = (typeof AMBIENTES)[number]

/**
 * Único emissor de token de acesso do sistema: o da sessão real (`EmissorDeToken`). Não há segundo emissor
 * nem variável que acrescente um: o token sintético do F0 saiu na tarefa 3.0, e com ele o caminho de
 * identidade que não passava por `sessao`.
 */
export const EMISSOR_TOKEN = 'educa'

/** HMAC-SHA256 pede chave de pelo menos 256 bits; abaixo disso a assinatura fica fácil de forjar. */
export const TAMANHO_MINIMO_CHAVE_ASSINATURA = 32

/** Variáveis da identidade. O emissor não é configurável: só `educa` vale, em todo ambiente. */
export const esquemaAmbienteIdentidade = z.object({
  AMBIENTE: z.enum(AMBIENTES),
  IDENTIDADE_CHAVE_ASSINATURA: z.string().min(TAMANHO_MINIMO_CHAVE_ASSINATURA),
})

export const MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO =
  'VAGAS_POR_ESCOLA_DESLIGADAS=true é proibido com AMBIENTE=producao: sem a vaga por escola, uma escola barulhenta ocupa os workers de todas'

/**
 * Controle negativo do cenário "justiça entre escolas" (`npm run carga:controle-negativo`): com a flag em
 * `true`, despachante e worker deixam de limitar os jobs simultâneos de cada escola, e o cenário precisa
 * reprovar. Só aceita `true` ou `false`, escritos assim, e nunca `true` em produção: a flag de teste não
 * pode virar porta aberta (regra 80, item 3).
 */
export const esquemaAmbienteVagasDesligadas = z
  .object({
    AMBIENTE: z.enum(AMBIENTES),
    VAGAS_POR_ESCOLA_DESLIGADAS: z.enum(['true', 'false']),
  })
  .superRefine((valores, contexto) => {
    if (valores.AMBIENTE === 'producao' && valores.VAGAS_POR_ESCOLA_DESLIGADAS === 'true') {
      contexto.addIssue({ code: 'custom', path: ['VAGAS_POR_ESCOLA_DESLIGADAS'], message: MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO })
    }
  })

/** `true` só no controle negativo do cenário de carga, e nunca em produção. */
export function lerVagasPorEscolaDesligadas(ambiente: Record<string, string | undefined>): boolean {
  return validarAmbiente(esquemaAmbienteVagasDesligadas, ambiente).VAGAS_POR_ESCOLA_DESLIGADAS === 'true'
}

export const MOTIVO_PROTECAO_DO_LOGIN_DESLIGADA_EM_PRODUCAO =
  'LOGIN_PROTECAO_DESLIGADA=true é proibido com AMBIENTE=producao: sem os baldes por escola e o rebaixamento, um ataque de senha atrasa o login de todas as escolas'

/**
 * Controle negativo do cenário "login às 7h30" (`npm run carga:login:controle-negativo`, tarefa 16.0): com a flag em
 * `true`, o semáforo do hash da API atende todo login numa fila só, sem baldes por escola, sem subfila por IP e sem
 * rebaixamento, e o cenário precisa reprovar. Como a `VAGAS_POR_ESCOLA_DESLIGADAS`, só aceita `true` ou `false`,
 * escritos assim, e nunca `true` em produção: a flag de teste não pode virar porta aberta (regra 80, itens 1 e 3).
 */
export const esquemaAmbienteProtecaoDoLogin = z
  .object({
    AMBIENTE: z.enum(AMBIENTES),
    LOGIN_PROTECAO_DESLIGADA: z.enum(['true', 'false']),
  })
  .superRefine((valores, contexto) => {
    if (valores.AMBIENTE === 'producao' && valores.LOGIN_PROTECAO_DESLIGADA === 'true') {
      contexto.addIssue({ code: 'custom', path: ['LOGIN_PROTECAO_DESLIGADA'], message: MOTIVO_PROTECAO_DO_LOGIN_DESLIGADA_EM_PRODUCAO })
    }
  })

/** `true` só no controle negativo do cenário de login, e nunca em produção. */
export function lerProtecaoDoLoginDesligada(ambiente: Record<string, string | undefined>): boolean {
  return validarAmbiente(esquemaAmbienteProtecaoDoLogin, ambiente).LOGIN_PROTECAO_DESLIGADA === 'true'
}

export interface ConfiguracaoIdentidade {
  readonly ambiente: Ambiente
  /** Chave HMAC do HS256. Nunca vai para log nem para resposta. */
  readonly chaveAssinatura: Uint8Array
}

export function lerConfiguracaoIdentidade(ambiente: Record<string, string | undefined>): ConfiguracaoIdentidade {
  const valores = validarAmbiente(esquemaAmbienteIdentidade, ambiente)
  return {
    ambiente: valores.AMBIENTE,
    chaveAssinatura: new TextEncoder().encode(valores.IDENTIDADE_CHAVE_ASSINATURA),
  }
}
