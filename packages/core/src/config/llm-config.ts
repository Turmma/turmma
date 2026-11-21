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
export const MOTIVO_RECUO_MAIOR_QUE_O_PRAZO =
  'LLM_RECUO_MS precisa ser menor que o menor prazo de chamada (LLM_TIMEOUT_MS, LLM_TIMEOUT_MS_RAPIDO e LLM_TIMEOUT_MS_PADRAO): a repetição acontece dentro do prazo da chamada, não depois dele'
export const MOTIVO_SEM_TOKENS_POR_MINUTO =
  'LLM_TOKENS_POR_MINUTO é obrigatória fora de AMBIENTE=local: é o contratado com o provedor, e o limite de tokens por minuto do gateway (80 % dele no balde geral) não tem valor escondido no código (D41)'
export const MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO =
  'IA_LATENCIA_FALSA_MS precisa ser menor que o prazo de todo perfil (LLM_TIMEOUT_MS, LLM_TIMEOUT_MS_RAPIDO e LLM_TIMEOUT_MS_PADRAO): senão toda chamada ao adaptador falso, em algum perfil, estoura o prazo'
export const MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO =
  'IA_LATENCIA_FALSA_MS_PADRAO precisa ser menor que LLM_TIMEOUT_MS_PADRAO: é a espera do adaptador falso no perfil `padrao` (a ferramenta), e uma espera igual ou maior estoura o prazo dele em toda chamada'

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
export function enderecoDaNossaRede(endereco: string): boolean {
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
    /**
     * O modelo menor de cada perfil, o degrau do gateway quando falta vaga de tokens (49.0): o mesmo provedor, com preço em `PRECO_DOS_MODELOS`. Ausente, o degrau é pulado. O turno do Tutor
     * nunca o usa (D36, regra 30, item 11).
     */
    LLM_MODELO_MENOR_RAPIDO: modelo,
    LLM_MODELO_MENOR_PADRAO: modelo,
    LLM_MODELO_MENOR_COMPLEXO: modelo,
    LLM_MODELO_MENOR_VISAO: modelo,
    /** O contratado com o provedor, em tokens por minuto (49.0). Obrigatório fora de `AMBIENTE=local`; no `local` sem ele o limite não existe. */
    LLM_TOKENS_POR_MINUTO: opcional(z.coerce.number().int().min(1_000).max(1_000_000_000).optional()),
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
    /**
     * Quantas réplicas do `worker-ia` o compose sobe (o `IA_REPLICAS` de `infra/compose.yml`, que `tools/ci/compose.int.test.ts` confere):
     * com o Redis de fila fora, cada réplica segura o teto de tokens dividido por este número (49.0). Uma, por padrão.
     */
    IA_REPLICAS: inteiro(1, 20, 1),
    /**
     * Espera simulada de cada chamada do adaptador **falso**, para o teste de carga e o ensaio sem provedor (regra 80,
     * item 11). Zero (o padrão) não espera. O adaptador `openai_compat` a ignora: a latência dele é a do provedor.
     */
    IA_LATENCIA_FALSA_MS: inteiro(0, 60_000, 0),
    /**
     * A espera simulada do adaptador falso no perfil `padrao` (a ferramenta, ~50 s de um modelo grande; a X6, 11.0). Zero, o padrão, deixa o `padrao` com a
     * mesma `IA_LATENCIA_FALSA_MS` dos outros perfis. O invariante é o do perfil: menor que `LLM_TIMEOUT_MS_PADRAO`.
     */
    IA_LATENCIA_FALSA_MS_PADRAO: inteiro(0, 60_000, 0),
    /**
     * Os tokens que o adaptador falso **informa** por chamada, no lugar da estimativa pelo tamanho do texto (X6, 11.0): é o que faz o limite de tokens por
     * minuto do gateway morder no teste de carga, na escala de `docs/infra.md` 3.2 (3.000 de entrada e 250 de saída por turno). Zero, o padrão, é a estimativa.
     */
    IA_TOKENS_FALSOS_ENTRADA: inteiro(0, 1_000_000, 0),
    IA_TOKENS_FALSOS_SAIDA: inteiro(0, 1_000_000, 0),
  })
  .superRefine((valores, contexto) => {
    const problema = (variavel: string, message: string): void => contexto.addIssue({ code: 'custom', path: [variavel], message })
    if (valores.AMBIENTE === 'producao' && valores.IA_ADAPTADOR === 'falso') problema('IA_ADAPTADOR', MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO)
    // Os três prazos são o de cada perfil: o recuo e a latência falsa cabem no menor. O prazo da execução é único e vem do perfil
    // (`PRAZO_DA_EXECUCAO_MS`): a chamada usa o menor entre o prazo dela e o que sobra da execução, e por isso nenhum prazo de chamada é comparado a ele.
    const prazos = [valores.LLM_TIMEOUT_MS, valores.LLM_TIMEOUT_MS_RAPIDO, valores.LLM_TIMEOUT_MS_PADRAO]
    const menorPrazo = Math.min(...prazos)
    if (valores.LLM_RECUO_MS >= menorPrazo) problema('LLM_RECUO_MS', MOTIVO_RECUO_MAIOR_QUE_O_PRAZO)
    conferirLatenciasFalsas(valores, menorPrazo, problema)
    if (valores.AMBIENTE !== 'local' && valores.LLM_TOKENS_POR_MINUTO === undefined) problema('LLM_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO)
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

/** A espera do adaptador falso cabe no prazo: a de todo perfil no menor deles, e a do `padrao` (a ferramenta, ~50 s) no dele, e não no menor de todos. */
function conferirLatenciasFalsas(valores: ValoresDoFalso & { readonly LLM_TIMEOUT_MS_PADRAO: number }, menorPrazo: number, problema: (variavel: string, message: string) => void): void {
  if (valores.IA_LATENCIA_FALSA_MS >= menorPrazo) problema('IA_LATENCIA_FALSA_MS', MOTIVO_LATENCIA_FALSA_MAIOR_QUE_O_PRAZO)
  if (valores.IA_LATENCIA_FALSA_MS_PADRAO >= valores.LLM_TIMEOUT_MS_PADRAO) problema('IA_LATENCIA_FALSA_MS_PADRAO', MOTIVO_LATENCIA_FALSA_PADRAO_MAIOR_QUE_O_PRAZO)
}

export interface ModelConfig {
  /** A raiz da API do padrão OpenAI, com o `/v1`: o adaptador só acrescenta `/chat/completions`. */
  readonly baseUrl: string
  /** O id do modelo de cada perfil: o `LLM_MODELO_<PERFIL>`, ou o `LLM_MODELO` comum. */
  readonly modelos: Readonly<Record<Perfil, string>>
  readonly chaveApi?: string
  /** De qual variável vem o modelo de cada perfil: `LLM_MODELO_<PERFIL>` quando o perfil tem o seu, `LLM_MODELO` quando usa o comum. A subida cita a variável quando o modelo não tem preço. */
  readonly variaveisDosModelos?: Readonly<Record<Perfil, string>>
  /** O modelo roda na nossa máquina ou rede: não há envio externo. */
  readonly processamentoLocal: boolean
  /** O id do provedor que recebe o conteúdo (`IA_PROVEDOR_ID`). Obrigatório quando o processamento não é local; o local não tem provedor. */
  readonly provedorId?: string
}

export interface LLMConfig {
  readonly adaptador: LLMAdapterKind
  /** Só com `openai_compat`. */
  readonly modelo?: ModelConfig
  /** O prazo de cada chamada ao modelo, por perfil: cobre a chamada e a repetição, e o disjuntor conta quem o estoura. */
  readonly prazosMs: Readonly<Record<Perfil, number>>
  /** Espera antes da única repetição em 429 e conexão recusada (regra 30, item 8): cabe no menor prazo. */
  readonly recuoMs: number
  /** Fora de `AMBIENTE=local` com `openai_compat`: o modelo de cada perfil precisa de preço em `PRECO_DOS_MODELOS`, ou a subida é recusada (D14). Ausente, vale como em `local`. */
  readonly exigePreco?: true
  /** O contratado com o provedor (`LLM_TOKENS_POR_MINUTO`). Ausente (só em `AMBIENTE=local`), o gateway não limita tokens. */
  readonly tokensPorMinuto?: number
  /** O modelo menor de cada perfil que tem o seu (`LLM_MODELO_MENOR_<PERFIL>`): o degrau depois da espera. Ausente, ou sem o perfil, o degrau é pulado. */
  readonly modelosMenores?: Readonly<Partial<Record<Perfil, string>>>
  /** As réplicas do `worker-ia` (`IA_REPLICAS`): o teto de tokens por minuto se divide entre elas quando o Redis de fila está fora. */
  readonly replicas: number
  /** Só do adaptador falso: a espera simulada de cada chamada (`IA_LATENCIA_FALSA_MS`). Ausente é sem espera. */
  readonly latenciaFalsaMs?: number
  /** Só do adaptador falso: a espera do perfil `padrao` (`IA_LATENCIA_FALSA_MS_PADRAO`). Ausente, o `padrao` espera `latenciaFalsaMs`. */
  readonly latenciaFalsaMsPadrao?: number
  /** Só do adaptador falso: os tokens que ele informa por chamada (`IA_TOKENS_FALSOS_ENTRADA` e `_SAIDA`). Ausente, é a estimativa pelo texto. */
  readonly tokensFalsos?: { readonly entrada: number; readonly saida: number }
}

type ValoresDoFalso = { readonly IA_LATENCIA_FALSA_MS: number; readonly IA_LATENCIA_FALSA_MS_PADRAO: number; readonly IA_TOKENS_FALSOS_ENTRADA: number; readonly IA_TOKENS_FALSOS_SAIDA: number }

/** O que só o adaptador falso lê: a espera de cada chamada, a do `padrao` e os tokens que ele informa. Zero é ausente. */
function opcoesDoAdaptadorFalso(valores: ValoresDoFalso): Pick<LLMConfig, 'latenciaFalsaMs' | 'latenciaFalsaMsPadrao' | 'tokensFalsos'> {
  return {
    ...(valores.IA_LATENCIA_FALSA_MS > 0 ? { latenciaFalsaMs: valores.IA_LATENCIA_FALSA_MS } : {}),
    ...(valores.IA_LATENCIA_FALSA_MS_PADRAO > 0 ? { latenciaFalsaMsPadrao: valores.IA_LATENCIA_FALSA_MS_PADRAO } : {}),
    ...(valores.IA_TOKENS_FALSOS_ENTRADA > 0 || valores.IA_TOKENS_FALSOS_SAIDA > 0
      ? { tokensFalsos: { entrada: valores.IA_TOKENS_FALSOS_ENTRADA, saida: valores.IA_TOKENS_FALSOS_SAIDA } }
      : {}),
  }
}

/** Fora de `AMBIENTE=local`, com o provedor de verdade: o modelo de cada perfil precisa de preço (D14). */
function exigeOPreco(valores: { readonly AMBIENTE: string; readonly IA_ADAPTADOR: string }): boolean {
  return valores.AMBIENTE !== 'local' && valores.IA_ADAPTADOR === 'openai_compat'
}

/** A variável de onde vem o modelo do perfil: a do perfil, se ele tem a sua, e a comum nos outros. */
function variavelDoModelo(perfil: Perfil, doPerfil: Readonly<Record<Perfil, string | undefined>>): string {
  return doPerfil[perfil] === undefined ? 'LLM_MODELO' : `LLM_MODELO_${perfil.toUpperCase()}`
}

export function loadLLMConfig(ambiente: Record<string, string | undefined>): LLMConfig {
  const valores = validateEnvironment(llmEnvSchema, ambiente)
  const menoresDoPerfil: Readonly<Record<Perfil, string | undefined>> = {
    rapido: valores.LLM_MODELO_MENOR_RAPIDO,
    padrao: valores.LLM_MODELO_MENOR_PADRAO,
    complexo: valores.LLM_MODELO_MENOR_COMPLEXO,
    visao: valores.LLM_MODELO_MENOR_VISAO,
  }
  const menoresPresentes = PERFIS.flatMap((perfil) => {
    const menor = menoresDoPerfil[perfil]
    return menor === undefined ? [] : [[perfil, menor] as const]
  })
  const menores = menoresPresentes.length === 0 ? undefined : (Object.fromEntries(menoresPresentes) as Partial<Record<Perfil, string>>)
  const base = {
    adaptador: valores.IA_ADAPTADOR,
    prazosMs: { rapido: valores.LLM_TIMEOUT_MS_RAPIDO, padrao: valores.LLM_TIMEOUT_MS_PADRAO, complexo: valores.LLM_TIMEOUT_MS, visao: valores.LLM_TIMEOUT_MS },
    recuoMs: valores.LLM_RECUO_MS,
    replicas: valores.IA_REPLICAS,
    ...(exigeOPreco(valores) ? { exigePreco: true as const } : {}),
    ...(valores.LLM_TOKENS_POR_MINUTO === undefined ? {} : { tokensPorMinuto: valores.LLM_TOKENS_POR_MINUTO }),
    ...(menores === undefined ? {} : { modelosMenores: menores }),
    ...opcoesDoAdaptadorFalso(valores),
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
  const variaveisDosModelos = Object.fromEntries(PERFIS.map((perfil) => [perfil, variavelDoModelo(perfil, doPerfil)])) as Record<Perfil, string>
  return {
    ...base,
    modelo: {
      baseUrl: valores.LLM_BASE_URL,
      modelos,
      variaveisDosModelos,
      ...(valores.LLM_CHAVE_API === undefined ? {} : { chaveApi: valores.LLM_CHAVE_API }),
      processamentoLocal: valores.LLM_PROCESSAMENTO_LOCAL === 'true',
      ...(valores.IA_PROVEDOR_ID === undefined ? {} : { provedorId: valores.IA_PROVEDOR_ID }),
    },
  }
}
