import { InvalidConfigError, createDatabase, createPool, validateEnvironment, type Database } from '@educa/core'
import { nomeDigitadoSchema, FORMATO_OPERADOR } from '@educa/shared'
import { open, type FileHandle } from 'node:fs/promises'
import { z } from 'zod'
import { OperadorRepository } from '../operacao/operador/operador.repository.js'
import type { ConferenciaDoAutor } from '../sessao/index.js'

/**
 * O que os comandos do operador (`ops:escola`, `ops:redefinir-mfa`, `ops:convite-coordenador`, `ops:revogar-convite`,
 * `ops:uso`, `ops:revogar-acessos-sala`, `ops:retencao`, `ops:suboperador`, `ops:incidente`, `ops:privacidade` e `ops:operador`) têm em comum: o erro de argumento, que cita só a opção e nunca o valor; o nome aceito; o
 * `OPERADOR` que vai para a auditoria e a conferência dele contra os operadores ativos, dentro da transação da escrita; a
 * saída do terminal; o arquivo 0600 do token; e o banco de operação, com uma conexão só.
 */

export class ArgumentoInvalido extends Error {
  constructor(readonly opcao: string) {
    super(`Opção inválida ou ausente: ${opcao}`)
    this.name = 'ArgumentoInvalido'
  }
}

/**
 * Nome de rede, de escola ou da pessoa convidada (`ops:convite-coordenador`): o mesmo esquema do contrato do painel da
 * operação (`@educa/shared`), para o comando e a tela aceitarem o mesmo nome.
 */
export const esquemaNome = nomeDigitadoSchema

const esquemaAmbienteOperador = z.object({ OPERADOR: z.string().regex(FORMATO_OPERADOR) })

/** Quem da equipe roda o comando. Ausente ou fora do formato, recusa pelo nome da variável, sem o valor. */
export function lerOperador(ambiente: Record<string, string | undefined>): string {
  return validateEnvironment(esquemaAmbienteOperador, ambiente).OPERADOR
}

/** O `OPERADOR` não é um operador ativo, e há operador ativo. A mensagem é fixa: nunca repete o valor da variável. */
export class OperadorRecusado extends Error {
  constructor() {
    super('OPERADOR não é um operador ativo da equipe')
    this.name = 'OperadorRecusado'
  }
}

/**
 * O autor dos dez comandos de escola (`ops:escola`, `ops:convite-coordenador`, `ops:revogar-convite`,
 * `ops:redefinir-mfa`, `ops:uso`, `ops:revogar-acessos-sala`, `ops:retencao`, `ops:suboperador`, `ops:incidente` e
 * `ops:privacidade`), conferido como primeira instrução da transação do caso de uso (Tech Spec da A0b,
 * seção 7c, "Autor ativo"):
 * - o `OPERADOR` é um operador ativo: a linha dele fica em `for share` até o fim da transação, e um `desativar` que
 *   chegue depois espera a escrita confirmar; o que chegou antes faz a escrita não o achar;
 * - não há operador ativo nenhum: qualquer `OPERADOR` no formato passa, e é ele o autor (o nascimento, Tech Spec da A0,
 *   seção 5). O `desativar` nunca deixa zero ativos, então isso só vale antes do primeiro `ops:operador criar`;
 * - senão, `OperadorRecusado`, e a transação desfaz tudo: nada é lido nem gravado antes desta conferência.
 *
 * O `ops:operador` tem a própria conferência, sob a trava dos operadores (`autorSobATrava`).
 */
export function autorDoComando(apelido: string): ConferenciaDoAutor {
  return async (tx) => {
    const ativo = await OperadorRepository.autorAtivoNaTransacao(tx, { apelido })
    if (ativo !== undefined) return ativo
    if ((await new OperadorRepository(tx).contarAtivos()) === 0) return apelido
    throw new OperadorRecusado()
  }
}

/** Cria o arquivo do token só se ele não existe, com modo 0600: só o dono lê. */
export async function criarArquivoDoToken(caminho: string, invalido: () => Error): Promise<FileHandle> {
  try {
    return await open(caminho, 'wx', 0o600)
  } catch {
    throw invalido()
  }
}

export interface SaidaDoComando {
  saida: (texto: string) => void
  erro: (texto: string) => void
}

export interface BancoDoComando {
  banco: Database
  fechar: () => Promise<void>
}

export function abrirBancoDeOperacao(ambiente: Record<string, string | undefined>): BancoDoComando {
  const pool = createPool({ ...urlDoBancoDeOperacao(ambiente), maximoConexoes: 1 }, () => undefined)
  return { banco: createDatabase(pool), fechar: () => pool.end() }
}

const inteiroPositivo = z.coerce.number().int().positive()

const esquemaAmbienteDoBanco = z.object({
  BANCO_TIMEOUT_CONEXAO_MS: inteiroPositivo,
  BANCO_TIMEOUT_CONSULTA_MS: inteiroPositivo,
  // No container, o BANCO_URL do serviço; na máquina, com `.env.example`, o Postgres do compose local.
  BANCO_URL: z.string().regex(/^postgres(ql)?:\/\/[^/]+\/[^/]+$/).optional(),
  POSTGRES_USUARIO: z.string().optional(),
  POSTGRES_SENHA: z.string().optional(),
  POSTGRES_BANCO: z.string().optional(),
  POSTGRES_PORTA_HOST: inteiroPositivo.optional(),
})

export function urlDoBancoDeOperacao(ambiente: Record<string, string | undefined>): { url: string; timeoutConexaoMs: number; timeoutConsultaMs: number } {
  const valores = validateEnvironment(esquemaAmbienteDoBanco, ambiente)
  const { POSTGRES_USUARIO: usuario, POSTGRES_SENHA: senha, POSTGRES_BANCO: nome, POSTGRES_PORTA_HOST: porta } = valores
  const url =
    valores.BANCO_URL ??
    (usuario === undefined || senha === undefined || nome === undefined || porta === undefined
      ? undefined
      : `postgres://${encodeURIComponent(usuario)}:${encodeURIComponent(senha)}@127.0.0.1:${porta}/${nome}`)
  if (url === undefined) throw new InvalidConfigError(['BANCO_URL'])
  return { url, timeoutConexaoMs: valores.BANCO_TIMEOUT_CONEXAO_MS, timeoutConsultaMs: valores.BANCO_TIMEOUT_CONSULTA_MS }
}
