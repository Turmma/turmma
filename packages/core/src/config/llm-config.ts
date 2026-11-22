import { isIP } from 'node:net'
import { z } from 'zod'
import { PERFIS, type Perfil } from '../ia/perfis.js'
import { AMBIENTES, validateEnvironment, type Environment } from './validate-config.js'

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

export const MOTIVO_RESERVA_SEM_ADAPTADOR =
  'IA_RESERVA_ADAPTADOR é obrigatória quando alguma outra variável da reserva (LLM_RESERVA_*, IA_RESERVA_PROVEDOR_ID) está definida: a reserva meio configurada ficaria desligada sem ninguém ver, e a queda do principal não teria para onde ir'
export const MOTIVO_RESERVA_FALSA_EM_PRODUCAO =
  'IA_RESERVA_ADAPTADOR=falso é proibido com AMBIENTE=producao: a reserva falsa devolve conteúdo determinístico de demonstração, e escola real receberia isso como se fosse a IA'
export const MOTIVO_RESERVA_SEM_ENDERECO = 'IA_RESERVA_ADAPTADOR=openai_compat precisa de LLM_RESERVA_BASE_URL, em http ou https'
export const MOTIVO_RESERVA_SEM_PROVEDOR_ID =
  'IA_RESERVA_PROVEDOR_ID é obrigatória com IA_RESERVA_ADAPTADOR=openai_compat: o registro de consumo guarda qual provedor recebeu cada chamada, também a da reserva (LGPD, art. 18, VII)'
export const MOTIVO_RESERVA_SEM_MODELO = 'IA_RESERVA_ADAPTADOR=openai_compat precisa de LLM_RESERVA_MODELO, ou de LLM_RESERVA_MODELO_<PERFIL> para os quatro perfis'
export const MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO =
  'IA_RESERVA_PROVEDOR_ID=falso-reserva é a identidade da reserva falsa e é proibida com AMBIENTE=producao: o registro de consumo gravaria como falso o provedor que recebeu o conteúdo (LGPD, art. 18, VII)'
export const MOTIVO_RESERVA_COM_A_IDENTIDADE_DO_PRINCIPAL =
  'a reserva tem a mesma identidade do principal (IA_PROVEDOR_ID do principal, ou o falso): a queda do provedor derrubaria os dois. Só com openai_compat nos dois e outro modelo em todo perfil a reserva pode ser do mesmo provedor'
export const MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL =
  'LLM_RESERVA_MODELO[_<PERFIL>] repete um modelo do principal (ou o menor dele): com a mesma identidade, a reserva só vale com outro modelo em todo perfil, senão a queda daquele modelo derruba os dois'
export const MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA =
  'LLM_RESERVA_TOKENS_POR_MINUTO é obrigatória fora de AMBIENTE=local com a reserva configurada: é o contratado com o provedor da reserva, e o limitador próprio dela não tem valor escondido no código (D41)'

export const MOTIVO_FALHA_FALSA_EM_PRODUCAO =
  'IA_FALHA_FALSA é proibida com AMBIENTE=producao: ela faz o adaptador falso falhar de propósito, para o ensaio da queda do principal, e em produção derrubaria o provedor de verdade'

/** As quatro falhas que o adaptador falso sabe fazer sob comando (`IA_FALHA_FALSA`): o 5xx, o prazo, a conexão recusada e o 429. */
export const FALHAS_FALSAS = ['5xx', 'prazo', 'conexao', '429'] as const
export type FalhaFalsa = (typeof FALHAS_FALSAS)[number]
/** Qual dos dois adaptadores falsos falha: o principal, ou a reserva. */
export const DESTINOS_DA_FALHA_FALSA = ['principal', 'reserva'] as const
export type DestinoDaFalhaFalsa = (typeof DESTINOS_DA_FALHA_FALSA)[number]

/** A identidade da reserva falsa: o `IA_RESERVA_PROVEDOR_ID` que ela assume sem outro. Fora de produção, é a chave do balde, do preço e da aprovação dela. */
export const IDENTIDADE_DA_RESERVA_FALSA = 'falso-reserva'

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
     * O provedor de reserva (F5b, 1.0): um segundo adaptador, com a identidade própria, que só atende a tarefa e o modelo aprovados em `MODELOS_APROVADOS`. `IA_RESERVA_ADAPTADOR` ausente é sem reserva;
     * `falso` (a reserva dos testes, da carga e da demonstração, com a identidade `falso-reserva`) é recusado com `AMBIENTE=producao`. Com `openai_compat` a reserva é sempre envio externo.
     */
    IA_RESERVA_ADAPTADOR: opcional(z.enum(ADAPTADORES_DE_IA).optional()),
    LLM_RESERVA_BASE_URL: opcional(z.url({ protocol: /^https?$/ }).optional()),
    LLM_RESERVA_MODELO: modelo,
    LLM_RESERVA_MODELO_RAPIDO: modelo,
    LLM_RESERVA_MODELO_PADRAO: modelo,
    LLM_RESERVA_MODELO_COMPLEXO: modelo,
    LLM_RESERVA_MODELO_VISAO: modelo,
    /** Só para provedor que exige chave. Nunca vai para log, erro nem registro. */
    LLM_RESERVA_CHAVE_API: opcional(z.string().min(1).optional()),
    /** Quem recebe o conteúdo quando a reserva atende: vai para `consumo_ia.provedor`. Sem ele, a reserva falsa assume `falso-reserva`. */
    IA_RESERVA_PROVEDOR_ID: opcional(z.string().regex(FORMATO_DO_PROVEDOR_ID).optional()),
    /** O contratado com o provedor da reserva, em tokens por minuto: o limitador dela é próprio. Obrigatório fora de `AMBIENTE=local` com a reserva configurada. */
    LLM_RESERVA_TOKENS_POR_MINUTO: opcional(z.coerce.number().int().min(1_000).max(1_000_000_000).optional()),
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
    /**
     * A falha que o adaptador **falso** faz sob comando, `<principal|reserva>:<5xx|prazo|conexao|429>` (F5b, 4.0): o ensaio da queda do principal e a fase `reserva` da carga. Só o falso a lê (o
     * `openai_compat` a ignora), e a subida a recusa com `AMBIENTE=producao`.
     */
    IA_FALHA_FALSA: opcional(z.string().regex(/^(principal|reserva):(5xx|prazo|conexao|429)$/).optional()),
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
    conferirAReserva(valores, problema)
    if (valores.AMBIENTE === 'producao' && valores.IA_FALHA_FALSA !== undefined) problema('IA_FALHA_FALSA', MOTIVO_FALHA_FALSA_EM_PRODUCAO)
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

/** O que a conferência da reserva lê do que o schema devolve: o principal (para a identidade e os modelos) e as variáveis da reserva. */
interface ValoresDaReserva {
  readonly AMBIENTE: Environment
  readonly IA_ADAPTADOR: LLMAdapterKind
  readonly LLM_PROCESSAMENTO_LOCAL: string
  readonly IA_PROVEDOR_ID?: string | undefined
  readonly LLM_MODELO?: string | undefined
  readonly LLM_MODELO_RAPIDO?: string | undefined
  readonly LLM_MODELO_PADRAO?: string | undefined
  readonly LLM_MODELO_COMPLEXO?: string | undefined
  readonly LLM_MODELO_VISAO?: string | undefined
  readonly LLM_MODELO_MENOR_RAPIDO?: string | undefined
  readonly LLM_MODELO_MENOR_PADRAO?: string | undefined
  readonly LLM_MODELO_MENOR_COMPLEXO?: string | undefined
  readonly LLM_MODELO_MENOR_VISAO?: string | undefined
  readonly IA_RESERVA_ADAPTADOR?: LLMAdapterKind | undefined
  readonly LLM_RESERVA_BASE_URL?: string | undefined
  readonly LLM_RESERVA_MODELO?: string | undefined
  readonly LLM_RESERVA_MODELO_RAPIDO?: string | undefined
  readonly LLM_RESERVA_MODELO_PADRAO?: string | undefined
  readonly LLM_RESERVA_MODELO_COMPLEXO?: string | undefined
  readonly LLM_RESERVA_MODELO_VISAO?: string | undefined
  readonly LLM_RESERVA_CHAVE_API?: string | undefined
  readonly IA_RESERVA_PROVEDOR_ID?: string | undefined
  readonly LLM_RESERVA_TOKENS_POR_MINUTO?: number | undefined
}

/** O `LLM_MODELO_<PERFIL>` de cada perfil, sem o comum. */
function modelosDoPrincipalPorPerfil(valores: ValoresDaReserva): Readonly<Record<Perfil, string | undefined>> {
  return { rapido: valores.LLM_MODELO_RAPIDO, padrao: valores.LLM_MODELO_PADRAO, complexo: valores.LLM_MODELO_COMPLEXO, visao: valores.LLM_MODELO_VISAO }
}

/** O `LLM_RESERVA_MODELO_<PERFIL>` de cada perfil, sem o comum. */
function modelosDaReservaPorPerfil(valores: ValoresDaReserva): Readonly<Record<Perfil, string | undefined>> {
  return { rapido: valores.LLM_RESERVA_MODELO_RAPIDO, padrao: valores.LLM_RESERVA_MODELO_PADRAO, complexo: valores.LLM_RESERVA_MODELO_COMPLEXO, visao: valores.LLM_RESERVA_MODELO_VISAO }
}

/** A identidade do principal, a mesma que o adaptador dele tem: `falso`, ou o `IA_PROVEDOR_ID` do que envia para fora, ou `openai_compat` no processamento local (onde nada sai e não há provedor). */
function identidadeDoPrincipal(valores: ValoresDaReserva): string | undefined {
  if (valores.IA_ADAPTADOR === 'falso') return 'falso'
  return valores.LLM_PROCESSAMENTO_LOCAL === 'true' ? 'openai_compat' : valores.IA_PROVEDOR_ID
}

/**
 * A reserva configurada de verdade, ou nenhuma (F5b, 1.0). Reserva meio configurada recusa a subida em qualquer ambiente, citando a variável que falta: desligada sem ninguém ver, a queda do principal
 * não teria para onde ir. A reserva falsa não existe em produção, e a mesma identidade do principal derrubaria os dois juntos: só vale a "outro modelo do mesmo provedor", com `openai_compat` nos dois e
 * nenhum modelo da reserva igual a um do principal, o menor incluído, em qualquer perfil.
 */
function conferirAReserva(valores: ValoresDaReserva, problema: (variavel: string, message: string) => void): void {
  const adaptador = valores.IA_RESERVA_ADAPTADOR
  if (adaptador === undefined) {
    const definidas = [valores.LLM_RESERVA_BASE_URL, valores.LLM_RESERVA_MODELO, valores.LLM_RESERVA_CHAVE_API, valores.IA_RESERVA_PROVEDOR_ID, valores.LLM_RESERVA_TOKENS_POR_MINUTO, ...Object.values(modelosDaReservaPorPerfil(valores))]
    if (definidas.some((valor) => valor !== undefined)) problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_SEM_ADAPTADOR)
    return
  }
  if (valores.AMBIENTE === 'producao' && adaptador === 'falso') problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_FALSA_EM_PRODUCAO)
  if (valores.AMBIENTE !== 'local' && valores.LLM_RESERVA_TOKENS_POR_MINUTO === undefined) problema('LLM_RESERVA_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA)
  if (adaptador === 'openai_compat') conferirOEnvioDaReserva(valores, problema)
  conferirAIdentidadeDaReserva(valores, adaptador, problema)
}

/** A reserva `openai_compat` é sempre envio externo: precisa de endereço, de provedor e de modelo, e em produção não pode ter a identidade da reserva falsa. */
function conferirOEnvioDaReserva(valores: ValoresDaReserva, problema: (variavel: string, message: string) => void): void {
  if (valores.LLM_RESERVA_BASE_URL === undefined) problema('LLM_RESERVA_BASE_URL', MOTIVO_RESERVA_SEM_ENDERECO)
  if (valores.IA_RESERVA_PROVEDOR_ID === undefined) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_SEM_PROVEDOR_ID)
  if (valores.LLM_RESERVA_MODELO === undefined && Object.values(modelosDaReservaPorPerfil(valores)).includes(undefined)) problema('LLM_RESERVA_MODELO', MOTIVO_RESERVA_SEM_MODELO)
  if (valores.AMBIENTE === 'producao' && valores.IA_RESERVA_PROVEDOR_ID === IDENTIDADE_DA_RESERVA_FALSA) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO)
}

/** Os perfis cujo modelo da reserva é igual a um do principal: o do mesmo perfil, o de outro perfil e o menor, que o principal tem. */
function perfisDaReservaComModeloDoPrincipal(valores: ValoresDaReserva): Perfil[] {
  const doPrincipal = modelosDoPrincipalPorPerfil(valores)
  const menores = [valores.LLM_MODELO_MENOR_RAPIDO, valores.LLM_MODELO_MENOR_PADRAO, valores.LLM_MODELO_MENOR_COMPLEXO, valores.LLM_MODELO_MENOR_VISAO]
  const modelosDoPrincipal = new Set<string | undefined>([...PERFIS.map((perfil) => doPrincipal[perfil] ?? valores.LLM_MODELO), ...menores])
  const daReserva = modelosDaReservaPorPerfil(valores)
  return PERFIS.filter((perfil) => modelosDoPrincipal.has(daReserva[perfil] ?? valores.LLM_RESERVA_MODELO ?? ''))
}

/** A reserva não pode ter a identidade do principal: a queda do provedor derrubaria os dois. Só `openai_compat` nos dois, com outro modelo em todo perfil, é "outro modelo do mesmo provedor". */
function conferirAIdentidadeDaReserva(valores: ValoresDaReserva, adaptador: LLMAdapterKind, problema: (variavel: string, message: string) => void): void {
  const identidadeDaReserva = adaptador === 'falso' ? (valores.IA_RESERVA_PROVEDOR_ID ?? IDENTIDADE_DA_RESERVA_FALSA) : valores.IA_RESERVA_PROVEDOR_ID
  if (identidadeDaReserva !== identidadeDoPrincipal(valores)) return
  if (valores.IA_ADAPTADOR !== 'openai_compat' || adaptador !== 'openai_compat') {
    problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_COM_A_IDENTIDADE_DO_PRINCIPAL)
    return
  }
  const doPerfil = modelosDaReservaPorPerfil(valores)
  for (const perfil of perfisDaReservaComModeloDoPrincipal(valores)) problema(variavelDoModelo(perfil, doPerfil, 'LLM_RESERVA_MODELO'), MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL)
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

/**
 * O provedor de reserva (F5b, 1.0): o segundo adaptador, com a identidade própria. Só existe com `IA_RESERVA_ADAPTADOR`. Com `openai_compat` o `modelo` leva o endereço, a chave e o modelo de cada perfil
 * (`LLM_RESERVA_MODELO[_<PERFIL>]`), e a reserva é sempre envio externo; com `falso` não há `modelo`.
 */
export interface ReservaConfig {
  readonly adaptador: LLMAdapterKind
  /** O `IA_RESERVA_PROVEDOR_ID` (`falso-reserva` na reserva falsa sem outro): a chave do balde, do preço, do disjuntor e da aprovação dela. */
  readonly identidade: string
  /** O `AMBIENTE` em que a configuração subiu: a aprovação da reserva falsa não vale em `producao` (`aprovadaParaAReserva`), e quem a lê (o `main-worker`, 2.0) não tem outro lugar de onde o tirar. */
  readonly ambiente: Environment
  /** Só com `openai_compat`. */
  readonly modelo?: ModelConfig
  /** Fora de `AMBIENTE=local` com `openai_compat`: o modelo de cada perfil da reserva precisa de preço em `PRECO_DOS_MODELOS`, ou a subida é recusada (D14). */
  readonly exigePreco?: true
  /** O contratado com o provedor da reserva (`LLM_RESERVA_TOKENS_POR_MINUTO`): o limitador dela é próprio. Ausente só em `AMBIENTE=local`. */
  readonly tokensPorMinuto?: number
}

export interface LLMConfig {
  readonly adaptador: LLMAdapterKind
  /** O provedor de reserva, quando configurado. */
  readonly reserva?: ReservaConfig
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
  /** Só do adaptador falso: qual deles falha (o principal ou a reserva) e como (`IA_FALHA_FALSA`). Ausente, nenhum falha. */
  readonly falhaFalsa?: { readonly destino: DestinoDaFalhaFalsa; readonly falha: FalhaFalsa }
}

type ValoresDoFalso = {
  readonly IA_LATENCIA_FALSA_MS: number
  readonly IA_LATENCIA_FALSA_MS_PADRAO: number
  readonly IA_TOKENS_FALSOS_ENTRADA: number
  readonly IA_TOKENS_FALSOS_SAIDA: number
  readonly IA_FALHA_FALSA?: string | undefined
}

/** O `IA_FALHA_FALSA` já conferido pelo esquema (`destino:falha`) em forma de configuração. */
function falhaFalsaDe(texto: string | undefined): Pick<LLMConfig, 'falhaFalsa'> {
  if (texto === undefined) return {}
  const [destino, falha] = texto.split(':') as [DestinoDaFalhaFalsa, FalhaFalsa]
  return { falhaFalsa: { destino, falha } }
}

/** O que só o adaptador falso lê: a espera de cada chamada, a do `padrao`, os tokens que ele informa e a falha sob comando. Zero é ausente. */
function opcoesDoAdaptadorFalso(valores: ValoresDoFalso): Pick<LLMConfig, 'latenciaFalsaMs' | 'latenciaFalsaMsPadrao' | 'tokensFalsos' | 'falhaFalsa'> {
  return {
    ...falhaFalsaDe(valores.IA_FALHA_FALSA),
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
function variavelDoModelo(perfil: Perfil, doPerfil: Readonly<Record<Perfil, string | undefined>>, comum = 'LLM_MODELO'): string {
  return doPerfil[perfil] === undefined ? comum : `${comum}_${perfil.toUpperCase()}`
}

/** A reserva que `conferirAReserva` já aprovou, em forma de configuração: o campo `reserva`, ou nada. */
function configDaReserva(valores: ValoresDaReserva): { readonly reserva?: ReservaConfig } {
  const reserva = reservaConfigurada(valores)
  return reserva === undefined ? {} : { reserva }
}

function reservaConfigurada(valores: ValoresDaReserva): ReservaConfig | undefined {
  const adaptador = valores.IA_RESERVA_ADAPTADOR
  if (adaptador === undefined) return undefined
  const identidade = valores.IA_RESERVA_PROVEDOR_ID ?? IDENTIDADE_DA_RESERVA_FALSA
  const base: ReservaConfig = {
    adaptador,
    identidade,
    ambiente: valores.AMBIENTE,
    ...(exigeOPreco({ AMBIENTE: valores.AMBIENTE, IA_ADAPTADOR: adaptador }) ? { exigePreco: true as const } : {}),
    ...(valores.LLM_RESERVA_TOKENS_POR_MINUTO === undefined ? {} : { tokensPorMinuto: valores.LLM_RESERVA_TOKENS_POR_MINUTO }),
  }
  if (adaptador !== 'openai_compat' || valores.LLM_RESERVA_BASE_URL === undefined) return base
  const doPerfil = modelosDaReservaPorPerfil(valores)
  const comum = valores.LLM_RESERVA_MODELO
  return {
    ...base,
    modelo: {
      baseUrl: valores.LLM_RESERVA_BASE_URL,
      modelos: Object.fromEntries(PERFIS.map((perfil) => [perfil, doPerfil[perfil] ?? comum])) as Record<Perfil, string>,
      variaveisDosModelos: Object.fromEntries(PERFIS.map((perfil) => [perfil, variavelDoModelo(perfil, doPerfil, 'LLM_RESERVA_MODELO')])) as Record<Perfil, string>,
      ...(valores.LLM_RESERVA_CHAVE_API === undefined ? {} : { chaveApi: valores.LLM_RESERVA_CHAVE_API }),
      processamentoLocal: false,
      provedorId: identidade,
    },
  }
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
    ...configDaReserva(valores),
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
