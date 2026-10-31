import type { LoggerService } from '@nestjs/common'
import type { LoggerBase } from './logger.js'

/** Origens do boot do Nest, cujas mensagens só citam módulo e rota declarada, nunca requisição. */
const ORIGENS_DO_BOOT_DO_NEST: ReadonlySet<string> = new Set([
  'NestFactory',
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
  'NestApplication',
])

/** `banco.conexao_ociosa_perdida`: evento fixo, sem espaço onde caberia um valor. */
const FORMATO_DE_EVENTO = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/

/** Nome de contexto do Nest (`RoutesResolver`, `banco`): sem espaço, sem quebra de linha. */
const FORMATO_DE_ORIGEM = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/

export const TEXTO_MENSAGEM_OMITIDA = '[mensagem omitida]'

function mensagemSegura(mensagem: string, origem: string | undefined): boolean {
  return FORMATO_DE_EVENTO.test(mensagem) || (origem !== undefined && ORIGENS_DO_BOOT_DO_NEST.has(origem))
}

/**
 * Faz o log interno do Nest (boot, rotas, `new Logger('banco')`) sair pelo mesmo logger JSON,
 * em vez do texto colorido do console.
 *
 * A mensagem em texto só sai quando é um evento fixo ou vem do boot do Nest. Qualquer outra pode
 * ter sido montada com valor (a mensagem de uma exceção, o texto de uma biblioteca) e sai trocada
 * por texto fixo, com a origem e o nível mantidos para ainda dar para achar o evento. Objeto que
 * não é erro sai trocado do mesmo jeito: nada garante o que ele carrega.
 *
 * É o único lugar que repassa mensagem variável ao logger, e por isso a guarda
 * `log-sem-conteudo-montado` fica desligada só neste arquivo (tools/guardas/index.mjs).
 */
export class NestLogger implements LoggerService {
  constructor(private readonly logger: LoggerBase) {}

  log(mensagem: unknown, ...parametros: unknown[]): void {
    this.escrever('info', mensagem, parametros)
  }

  error(mensagem: unknown, ...parametros: unknown[]): void {
    this.escrever('error', mensagem, parametros)
  }

  warn(mensagem: unknown, ...parametros: unknown[]): void {
    this.escrever('warn', mensagem, parametros)
  }

  debug(mensagem: unknown, ...parametros: unknown[]): void {
    this.escrever('debug', mensagem, parametros)
  }

  verbose(mensagem: unknown, ...parametros: unknown[]): void {
    this.escrever('trace', mensagem, parametros)
  }

  fatal(mensagem: unknown, ...parametros: unknown[]): void {
    this.escrever('fatal', mensagem, parametros)
  }

  private escrever(nivel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', mensagem: unknown, parametros: unknown[]): void {
    // O Nest passa o nome do contexto ("RoutesResolver", "banco") como último parâmetro. Os
    // demais, quando existem, são a pilha de um erro: ela não entra, porque repete a mensagem.
    // Sem contexto, o último é a própria pilha, que tem quebra de linha e fica de fora também,
    // como qualquer último parâmetro que não tem forma de nome de contexto e pode ser um valor.
    const ultimo = parametros.at(-1)
    const origem = typeof ultimo === 'string' && FORMATO_DE_ORIGEM.test(ultimo) ? ultimo : undefined
    // `origem` indefinida não sai na linha: o JSON do pino omite a chave.
    if (mensagem instanceof Error) {
      const erro = mensagem
      this.logger[nivel]({ origem, erro })
    } else if (typeof mensagem === 'string' && mensagemSegura(mensagem, origem)) {
      this.logger[nivel]({ origem }, mensagem)
    } else {
      this.logger[nivel]({ origem }, TEXTO_MENSAGEM_OMITIDA)
    }
  }
}
