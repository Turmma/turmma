import { pino, stdTimeFunctions, type DestinationStream, type Logger, type LevelWithSilent } from 'pino'
import { currentContext } from '../context/context.js'
import { summarizeError } from '../error/summarize-error.js'

export type LoggerBase = Logger

/**
 * Chaves que nunca saem no log, até dois níveis abaixo do primeiro (`nome`, `aluno.nome`,
 * `dados.aluno.nome`, `req.headers.authorization`). É a rede de segurança: a regra continua
 * sendo logar só id (regra 20, item 9), e a guarda de lint (`tools/guardas`) pega o que o redact
 * não alcança, como chave composta ou em profundidade maior. As duas listas são comparadas em teste.
 */
export const CHAVES_PESSOAIS = [
  'nome',
  'matricula',
  'email',
  'telefone',
  'cpf',
  'senha',
  'resposta',
  'nota',
  'conversa',
  'prompt',
  'conteudo',
  'adaptacao',
  'diagnostico',
  'laudo',
] as const
/** Cabeçalhos de credencial: saem do log em qualquer nível, inclusive no primeiro. Também nunca vão num corpo de resposta. */
export const CHAVES_DE_CREDENCIAL = ['authorization', 'cookie', 'set-cookie'] as const

/**
 * O que a identidade manipula e nunca pode sair no log (Tech Spec do F1, seção 7): o que o Google e a Microsoft
 * devolvem (tokens, claims, nome e foto), o desafio de login, o segredo e os códigos do MFA, o refresh e o `state`
 * do OAuth, o complemento da contestação e o cookie de dispositivo. Valem aninhadas (`*.chave` e `*.*.chave`): no
 * primeiro nível, `codigo` e `token` são campos operacionais do próprio log (o código do erro).
 */
export const CHAVES_DE_IDENTIDADE = [
  'id_token',
  'access_token',
  'claims',
  'picture',
  'name',
  'given_name',
  'family_name',
  'preferred_username',
  'upn',
  'unique_name',
  'token',
  'desafio',
  'uri',
  'segredo',
  'codigo',
  'recuperacao',
  'codigosRecuperacao',
  'refresh',
  'state',
  'complemento',
  'dispositivo',
] as const

/** O caminho do redact para a chave abaixo do prefixo, com colchetes quando o nome não é identificador (`set-cookie`). */
function caminhoDoRedact(prefixo: '' | '*.' | '*.*.', chave: string): string {
  if (/^[A-Za-z_$][\w$]*$/.test(chave)) return `${prefixo}${chave}`
  return `${prefixo.replace(/\.$/, '')}["${chave}"]`
}

export const CAMINHOS_REDACT: readonly string[] = [
  ...[...CHAVES_PESSOAIS, ...CHAVES_DE_CREDENCIAL].flatMap((chave) => (['', '*.', '*.*.'] as const).map((prefixo) => caminhoDoRedact(prefixo, chave))),
  ...CHAVES_DE_IDENTIDADE.flatMap((chave) => (['*.', '*.*.'] as const).map((prefixo) => caminhoDoRedact(prefixo, chave))),
]

export const TEXTO_REMOVIDO = '[removido]'

type MetodoDeLog = (...argumentos: unknown[]) => void

export const TEXTO_OMITIDO_POR_PROFUNDIDADE = '[omitido: profundo demais]'
const PROFUNDIDADE_MAXIMA = 6

export const TEXTO_TOJSON_FALHOU = '[toJSON falhou]'

function temToJson(valor: object): valor is { toJSON: () => unknown } {
  return typeof (valor as { toJSON?: unknown }).toJSON === 'function'
}

/**
 * Copia o valor trocando todo `Error`, em qualquer nível de objeto ou lista, pelo resumo. Ciclo
 * e nível além do limite viram texto fixo: log leva id, e objeto fundo assim não é id.
 *
 * Objeto com `toJSON()` é trocado pelo que ele devolve antes de seguir, porque é isso que o
 * `JSON.stringify` do pino escreveria: um `toJSON()` que devolve o erro do Postgres levaria o
 * `detail` para a linha, e um que devolve `{ nome }` passaria ao largo do redact, que só olha as
 * propriedades do objeto original.
 */
function resumirErrosEmProfundidade(valor: unknown, profundidade: number, vistos: WeakSet<object>): unknown {
  if (valor instanceof Error) return summarizeError(valor)
  if (typeof valor !== 'object' || valor === null || valor instanceof Date || ArrayBuffer.isView(valor)) return valor
  if (vistos.has(valor)) return '[ciclo]'
  if (profundidade >= PROFUNDIDADE_MAXIMA) return TEXTO_OMITIDO_POR_PROFUNDIDADE
  vistos.add(valor)
  if (temToJson(valor)) {
    let serializado: unknown
    try {
      serializado = valor.toJSON()
    } catch {
      serializado = TEXTO_TOJSON_FALHOU
    }
    const resumido = resumirErrosEmProfundidade(serializado, profundidade + 1, vistos)
    vistos.delete(valor)
    return resumido
  }
  const copia = Array.isArray(valor)
    ? valor.map((item) => resumirErrosEmProfundidade(item, profundidade + 1, vistos))
    : Object.fromEntries(
        Object.entries(valor).map(([chave, item]) => [chave, resumirErrosEmProfundidade(item, profundidade + 1, vistos)]),
      )
  vistos.delete(valor)
  return copia
}

/**
 * Todo erro passado ao logger, direto (`logger.error(erro)`) ou dentro do objeto em qualquer
 * nível (`{ erro }`, `{ contexto: { erro } }`, `{ lista: [erro] }`), vira o resumo antes de o
 * pino vê-lo. Sem isso o pino usa `erro.message` como `msg` da linha e serializa as
 * propriedades do erro, e as do Postgres trazem `detail` com o valor da linha
 * ("Key (nome)=(Enzo Martins) already exists").
 *
 * Os argumentos depois da mensagem passam pelo mesmo resumo: `%j` e `%o` os escreveriam no texto.
 */
function resumirErrosAntesDeLogar(this: unknown, argumentos: unknown[], metodo: MetodoDeLog): void {
  const resumidos = argumentos.map((valor, indice) =>
    indice === 0 && valor instanceof Error ? { erro: summarizeError(valor) } : resumirErrosEmProfundidade(valor, 0, new WeakSet()),
  )
  metodo.apply(this, resumidos)
}

/**
 * Último registro de um processo que vai cair: promessa rejeitada sem tratamento ou exceção
 * fora de requisição. Sem isso o Node imprime o erro no stderr com as propriedades próprias,
 * `detail` do Postgres junto, e em texto em vez de JSON.
 */
export function registerProcessErrorHandlers(logger: LoggerBase): void {
  const encerrar = (codigo: number): void => process.exit(codigo)
  process.on('uncaughtException', processErrorHandler(logger, 'processo.excecao_nao_tratada', encerrar))
  process.on('unhandledRejection', processErrorHandler(logger, 'processo.rejeicao_nao_tratada', encerrar))
}

export function processErrorHandler(logger: LoggerBase, evento: string, encerrar: (codigo: number) => void) {
  return (erro: unknown): void => {
    logger.fatal({ evento, erro: summarizeError(erro) })
    encerrar(1)
  }
}

export interface LoggerOptions {
  servico: string
  nivel?: LevelWithSilent
  /** Para teste. Sem destino, o log sai no stdout, em JSON, uma linha por evento. */
  destino?: DestinationStream
}

/**
 * Logger JSON de todo processo. Toda linha leva `requisicaoId`, e `escolaId`, `usuarioId` e
 * `operadorId` (o operador Turmma, A0) quando existirem, lidos do contexto da requisição em
 * andamento: só ids, nunca nome, e-mail ou apelido (regra 20, item 9).
 */
export function createLogger(opcoes: LoggerOptions): LoggerBase {
  const configuracao = {
    level: opcoes.nivel ?? 'info',
    base: { servico: opcoes.servico },
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (rotulo: string) => ({ level: rotulo }) },
    redact: { paths: [...CAMINHOS_REDACT], censor: TEXTO_REMOVIDO },
    hooks: { logMethod: resumirErrosAntesDeLogar },
    mixin: () => {
      const contexto = currentContext()
      if (contexto === undefined) return {}
      return {
        requisicaoId: contexto.requisicaoId,
        ...(contexto.escolaId === undefined ? {} : { escolaId: contexto.escolaId }),
        ...(contexto.usuarioId === undefined ? {} : { usuarioId: contexto.usuarioId }),
        ...(contexto.operadorId === undefined ? {} : { operadorId: contexto.operadorId }),
      }
    },
  }
  return opcoes.destino === undefined ? pino(configuracao) : pino(configuracao, opcoes.destino)
}
