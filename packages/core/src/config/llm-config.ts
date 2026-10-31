import { isIP } from 'node:net'
import { z } from 'zod'
import { PERFIS, type Perfil } from '../ia/perfis.js'
import { AMBIENTES, validateEnvironment } from './validate-config.js'

/**
 * `falso` é o adaptador determinístico dos testes e da demonstração sem modelo; `openai_compat` fala com qualquer
 * servidor do padrão `chat/completions` (o `llama-server` local no ensaio, o provedor contratado depois). Trocar de
 * um para o outro é só variável de ambiente (D13).
 */
export const ADAPTADORES_DE_IA = ['falso', 'openai_compat'] as const
export type LLMAdapterKind = (typeof ADAPTADORES_DE_IA)[number]

export const MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO =
  'IA_ADAPTADOR=falso é proibido com AMBIENTE=producao: o adaptador falso devolve conteúdo determinístico de demonstração, e escola real receberia isso como se fosse a IA'
export const MOTIVO_LLM_SEM_ENDERECO = 'IA_ADAPTADOR=openai_compat precisa de LLM_BASE_URL, em http ou https'
export const MOTIVO_SEM_PROVEDOR_ID =
  'IA_PROVEDOR_ID é obrigatória com IA_ADAPTADOR=openai_compat fora do processamento local: o registro de consumo guarda qual provedor recebeu cada chamada, para a escola saber para onde o dado do aluno foi (LGPD, art. 18, VII)'
export const MOTIVO_PROVEDOR_ID_DE_EXEMPLO =
  'IA_PROVEDOR_ID=provedor-de-exemplo é o valor do .env.example e só vale com AMBIENTE=local: fora dele, o registro de consumo gravaria um provedor que não recebeu o conteúdo (LGPD, art. 18, VII)'
export const MOTIVO_LLM_SEM_MODELO = 'IA_ADAPTADOR=openai_compat precisa de LLM_MODELO, ou de LLM_MODELO_<PERFIL> para os quatro perfis'
export const MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA =
  'LLM_PROCESSAMENTO_LOCAL=true só vale com LLM_BASE_URL nesta máquina ou em rede privada: declarar local um provedor de fora apagaria o registro de envio externo'
export const MOTIVO_EXECUCAO_MAIS_CURTA_QUE_A_CHAMADA =
  'IA_EXECUCAO_TIMEOUT_MS precisa ser maior que o maior prazo de chamada (LLM_TIMEOUT_MS, LLM_TIMEOUT_MS_RAPIDO e LLM_TIMEOUT_MS_PADRAO): senão a execução estoura antes de a chamada ao modelo terminar'
export const MOTIVO_RECUO_MAIOR_QUE_O_PRAZO =
  'LLM_RECUO_MS precisa ser menor que o menor prazo de chamada (LLM_TIMEOUT_MS, LLM_TIMEOUT_MS_RAPIDO e LLM_TIMEOUT_MS_PADRAO): a repetição acontece dentro do prazo da chamada, não depois dele'
export const MOTIVO_VAGAS_DE_IA_INCOERENTES = 'IA_EXECUCOES_POR_ESCOLA não pode passar de IA_EXECUCOES_TOTAL: uma escola sozinha ocuparia todas as vagas'
export const MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO =
  'IA_LATENCIA_FALSA_MS precisa ser menor que o prazo de todo perfil (LLM_TIMEOUT_MS, LLM_TIMEOUT_MS_RAPIDO e LLM_TIMEOUT_MS_PADRAO): senão toda chamada ao adaptador falso, em algum perfil, estoura o prazo'

/** O mesmo formato da chave do suboperador (Tech Spec do F3, seção 3): é por ela que a chamada se liga ao cadastro. */
export const FORMATO_DO_PROVEDOR_ID = /^[a-z][a-z0-9_-]{1,39}$/

/** O placeholder do `.env.example`: vale em `local`, e fora dele gravaria em `consumo_ia.provedor` quem não recebeu o conteúdo. */
export const PROVEDOR_ID_DE_EXEMPLO = 'provedor-de-exemplo'

/** O compose entrega variável sem valor como texto vazio: vale como ausente, e o padrão entra. */
const opcional = <Esquema extends z.ZodType>(esquema: Esquema) => z.preprocess((valor) => (valor === '' ? undefined : valor), esquema)

const modelo = opcional(z.string().min(1).max(200).optional())
const inteiro = (minimo: number, maximo: number, padrao: number) => opcional(z.coerce.number().int().min(minimo).max(maximo).default(padrao))

const IPV4_DA_NOSSA_REDE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/
/** `::1` (loopback), `fc00::/7` (endereço local único) e `fe80::/10` (link local). */
const IPV6_DA_NOSSA_REDE = /^(::1$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i

/**
 * O endereço é desta máquina ou da nossa rede? Quem decide é o tipo do host, e não a cara dele:
 * - IPv4: só loopback, as faixas privadas e link local. `8.8.8.8` é de fora.
 * - IPv6: só `::1`, `fc00::/7` e `fe80::/10`. Um IPv6 público não tem ponto, e nem por isso é "nome sem ponto".
 * - nome: só o que não tem ponto (`localhost`, o nome de um serviço do compose) ou `host.docker.internal`.
 *   `10.provedor.com` é um nome com ponto que começa por "10.": é de fora.
 * O nome de um rótulo só (`http://ai/v1`) passa como local porque quem o resolve é o DNS da nossa rede (o do compose, o
 * da máquina): a garantia vale enquanto esse DNS for nosso. Em rede que resolve nome curto para fora, use o IP.
 */
function enderecoDaNossaRede(endereco: string): boolean {
  // Endereço que nem é URL já foi apontado pelo próprio campo: aqui não há o que conferir.
  if (!URL.canParse(endereco)) return true
  const host = new URL(endereco).hostname.replace(/^\[|\]$/g, '')
  const versao = isIP(host)
  if (versao === 4) return IPV4_DA_NOSSA_REDE.test(host)
  if (versao === 6) return IPV6_DA_NOSSA_REDE.test(host)
  return host === 'host.docker.internal' || !host.includes('.')
}

/**
 * Nenhuma destas variáveis é obrigatória: sem elas a API sobe com o adaptador falso. Em produção o falso é recusado,
 * e aí o adaptador, o endereço e o modelo passam a ser exigidos.
 */
export const llmEnvSchema = z
  .object({
    AMBIENTE: z.enum(AMBIENTES),
    IA_ADAPTADOR: opcional(z.enum(ADAPTADORES_DE_IA).default('falso')),
    LLM_BASE_URL: opcional(z.url({ protocol: /^https?$/ }).optional()),
    LLM_MODELO: modelo,
    LLM_MODELO_RAPIDO: modelo,
    LLM_MODELO_PADRAO: modelo,
    LLM_MODELO_COMPLEXO: modelo,
    LLM_MODELO_VISAO: modelo,
    /** Só para provedor que exige chave. Nunca vai para log, erro nem registro. */
    LLM_CHAVE_API: opcional(z.string().min(1).optional()),
    /** O prazo da chamada de cada perfil que não tem o seu: `complexo` e `visao`. */
    LLM_TIMEOUT_MS: inteiro(1_000, 600_000, 60_000),
    /** O prazo do `rapido` (o turno do Tutor, o aluno esperando): curto, para o disjuntor ver o provedor lento cedo. */
    LLM_TIMEOUT_MS_RAPIDO: inteiro(1_000, 600_000, 20_000),
    /** O prazo do `padrao` (a ferramenta com o professor esperando): a normal leva ~50 s. */
    LLM_TIMEOUT_MS_PADRAO: inteiro(1_000, 600_000, 60_000),
    /** Quanto esperar antes da única repetição depois de um 429 ou de uma conexão recusada do provedor. */
    LLM_RECUO_MS: inteiro(0, 60_000, 500),
    LLM_PROCESSAMENTO_LOCAL: opcional(z.enum(['true', 'false']).default('false')),
    /** Quem recebe o conteúdo quando ele sai da nossa rede. Não é segredo: vai para `consumo_ia.provedor`. */
    IA_PROVEDOR_ID: opcional(z.string().regex(FORMATO_DO_PROVEDOR_ID).optional()),
    IA_EXECUCOES_POR_ESCOLA: inteiro(1, 100, 2),
    IA_EXECUCOES_TOTAL: inteiro(1, 1_000, 8),
    IA_EXECUCAO_TIMEOUT_MS: inteiro(1_000, 3_600_000, 150_000),
    /**
     * Espera simulada de cada chamada do adaptador **falso**, para o teste de carga e o ensaio sem provedor (regra 80,
     * item 11). Zero (o padrão) não espera. O adaptador `openai_compat` a ignora: a latência dele é a do provedor.
     */
    IA_LATENCIA_FALSA_MS: inteiro(0, 60_000, 0),
  })
  .superRefine((valores, contexto) => {
    const problema = (variavel: string, message: string): void => contexto.addIssue({ code: 'custom', path: [variavel], message })
    if (valores.AMBIENTE === 'producao' && valores.IA_ADAPTADOR === 'falso') problema('IA_ADAPTADOR', MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO)
    // Os três prazos são o de cada perfil: o recuo e a latência falsa cabem no menor, a execução cobre o maior.
    const prazos = [valores.LLM_TIMEOUT_MS, valores.LLM_TIMEOUT_MS_RAPIDO, valores.LLM_TIMEOUT_MS_PADRAO]
    const menorPrazo = Math.min(...prazos)
    if (valores.LLM_RECUO_MS >= menorPrazo) problema('LLM_RECUO_MS', MOTIVO_RECUO_MAIOR_QUE_O_PRAZO)
    if (valores.IA_EXECUCAO_TIMEOUT_MS <= Math.max(...prazos)) problema('IA_EXECUCAO_TIMEOUT_MS', MOTIVO_EXECUCAO_MAIS_CURTA_QUE_A_CHAMADA)
    if (valores.IA_EXECUCOES_POR_ESCOLA > valores.IA_EXECUCOES_TOTAL) problema('IA_EXECUCOES_POR_ESCOLA', MOTIVO_VAGAS_DE_IA_INCOERENTES)
    if (valores.IA_LATENCIA_FALSA_MS >= menorPrazo) problema('IA_LATENCIA_FALSA_MS', MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO)
    if (valores.IA_ADAPTADOR !== 'openai_compat') return
    if (valores.LLM_BASE_URL === undefined) problema('LLM_BASE_URL', MOTIVO_LLM_SEM_ENDERECO)
    else if (valores.LLM_PROCESSAMENTO_LOCAL === 'true' && !enderecoDaNossaRede(valores.LLM_BASE_URL)) {
      problema('LLM_PROCESSAMENTO_LOCAL', MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA)
    }
    if (valores.LLM_PROCESSAMENTO_LOCAL !== 'true' && valores.IA_PROVEDOR_ID === undefined) problema('IA_PROVEDOR_ID', MOTIVO_SEM_PROVEDOR_ID)
    if (valores.LLM_PROCESSAMENTO_LOCAL !== 'true' && valores.AMBIENTE !== 'local' && valores.IA_PROVEDOR_ID === PROVEDOR_ID_DE_EXEMPLO) problema('IA_PROVEDOR_ID', MOTIVO_PROVEDOR_ID_DE_EXEMPLO)
    const porPerfil = [valores.LLM_MODELO_RAPIDO, valores.LLM_MODELO_PADRAO, valores.LLM_MODELO_COMPLEXO, valores.LLM_MODELO_VISAO]
    if (valores.LLM_MODELO === undefined && porPerfil.includes(undefined)) problema('LLM_MODELO', MOTIVO_LLM_SEM_MODELO)
  })

export interface ModelConfig {
  /** A raiz da API do padrão OpenAI, com o `/v1`: o adaptador só acrescenta `/chat/completions`. */
  readonly baseUrl: string
  /** O id do modelo de cada perfil: o `LLM_MODELO_<PERFIL>`, ou o `LLM_MODELO` comum. */
  readonly modelos: Readonly<Record<Perfil, string>>
  readonly chaveApi?: string
  /** O modelo roda na nossa máquina ou rede: não há envio externo. */
  readonly processamentoLocal: boolean
  /** O id do provedor que recebe o conteúdo (`IA_PROVEDOR_ID`). Obrigatório quando o processamento não é local; o local não tem provedor. */
  readonly provedorId?: string
}

export interface AgenteExecutorConfig {
  /** Execuções de IA de uma mesma escola ao mesmo tempo (regra 80, item 3). */
  readonly vagasPorEscola: number
  /** Execuções de IA ao mesmo tempo neste processo. */
  readonly vagasNoTotal: number
  readonly timeoutMs: number
}

export interface LLMConfig {
  readonly adaptador: LLMAdapterKind
  /** Só com `openai_compat`. */
  readonly modelo?: ModelConfig
  /** O prazo de cada chamada ao modelo, por perfil: cobre a chamada e a repetição, e o disjuntor conta quem o estoura. */
  readonly prazosMs: Readonly<Record<Perfil, number>>
  /** Espera antes da única repetição em 429 e conexão recusada (regra 30, item 8): cabe no menor prazo. */
  readonly recuoMs: number
  readonly executor: AgenteExecutorConfig
  /** Só do adaptador falso: a espera simulada de cada chamada (`IA_LATENCIA_FALSA_MS`). Ausente é sem espera. */
  readonly latenciaFalsaMs?: number
}

export function loadLLMConfig(ambiente: Record<string, string | undefined>): LLMConfig {
  const valores = validateEnvironment(llmEnvSchema, ambiente)
  const base = {
    adaptador: valores.IA_ADAPTADOR,
    prazosMs: { rapido: valores.LLM_TIMEOUT_MS_RAPIDO, padrao: valores.LLM_TIMEOUT_MS_PADRAO, complexo: valores.LLM_TIMEOUT_MS, visao: valores.LLM_TIMEOUT_MS },
    recuoMs: valores.LLM_RECUO_MS,
    executor: { vagasPorEscola: valores.IA_EXECUCOES_POR_ESCOLA, vagasNoTotal: valores.IA_EXECUCOES_TOTAL, timeoutMs: valores.IA_EXECUCAO_TIMEOUT_MS },
    ...(valores.IA_LATENCIA_FALSA_MS > 0 ? { latenciaFalsaMs: valores.IA_LATENCIA_FALSA_MS } : {}),
  }
  if (valores.IA_ADAPTADOR !== 'openai_compat' || valores.LLM_BASE_URL === undefined) return base
  const doPerfil: Readonly<Record<Perfil, string | undefined>> = {
    rapido: valores.LLM_MODELO_RAPIDO,
    padrao: valores.LLM_MODELO_PADRAO,
    complexo: valores.LLM_MODELO_COMPLEXO,
    visao: valores.LLM_MODELO_VISAO,
  }
  const comum = valores.LLM_MODELO ?? ''
  const modelos = Object.fromEntries(PERFIS.map((perfil) => [perfil, doPerfil[perfil] ?? comum])) as Record<Perfil, string>
  return {
    ...base,
    modelo: {
      baseUrl: valores.LLM_BASE_URL,
      modelos,
      ...(valores.LLM_CHAVE_API === undefined ? {} : { chaveApi: valores.LLM_CHAVE_API }),
      processamentoLocal: valores.LLM_PROCESSAMENTO_LOCAL === 'true',
      ...(valores.IA_PROVEDOR_ID === undefined ? {} : { provedorId: valores.IA_PROVEDOR_ID }),
    },
  }
}
