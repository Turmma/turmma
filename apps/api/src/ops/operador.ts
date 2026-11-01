import {
  AUTOR_BOOTSTRAP,
  InvalidConfigError,
  DomainException,
  postgresErrorIn,
  FORMATO_OPERADOR,
  systemClock,
  summarizeError,
  VALIDADE_DO_CONVITE_DE_OPERADOR_HORAS,
  type Database,
  type Clock,
} from '@educa/core'
import { AUTOR_DA_ROTINA, ErrorCode, TAMANHO_MAXIMO_EMAIL } from '@educa/shared'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { OperadorRepository } from '../operacao/operador/operador.repository.js'
import { hashDoTokenDeConvite, sortearTokenDeConvite } from '../operacao/token-do-convite.js'
import {
  abrirBancoDeOperacao,
  InvalidArgumentError,
  criarArquivoDoToken,
  nomeSchema,
  lerOperador,
  OperadorRejectedError,
  type CommandDatabase,
  type CommandOutput,
} from './command.js'

/**
 * A conta do operador Turmma nasce e termina só por aqui (A0, RF1; Tech Spec da A0, seção 5, "Nascimento"). Nenhuma
 * rota cria operador.
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:operador -- criar --apelido <apelido> --nome <nome> --email <e-mail> --saida <arquivo>
 *   OPERADOR=<pessoa da equipe> npm run -s ops:operador -- desativar --apelido <apelido>
 *   OPERADOR=<pessoa da equipe> npm run -s ops:operador -- convite --apelido <apelido> --saida <arquivo>
 *
 * - **Bootstrap.** Sem operador ativo, `criar` aceita o `OPERADOR` do ambiente e grava o autor `bootstrap`. Com um
 *   ativo, os três exigem `OPERADOR` de operador ativo, conferido dentro da transação, sob a trava.
 * - **Trava.** Os três rodam sob o mesmo `pg_advisory_xact_lock`: dois `criar` de bootstrap não nascem juntos, e dois
 *   `desativar` cruzados não zeram os ativos. Ninguém desativa o último ativo nem a si mesmo, e por isso o bootstrap
 *   nunca reabre.
 * - **Desativar** apaga nome, e-mail, senha, segredo e códigos, revoga o convite pendente e encerra as sessões, numa
 *   transação só com a auditoria: falha no meio não deixa nada pela metade. O apelido fica, porque a auditoria o cita.
 * - **Convite** revoga o pendente e gera outro na mesma transação (um pendente por operador, pelo único parcial). Vale
 *   72 h. O token vai só para o arquivo de `--saida`, criado com modo 0600 antes de abrir o banco e sem sobrescrever;
 *   se o comando falha, o arquivo é apagado. Dívida aceita: uma vez por pessoa da equipe.
 * - Toda mudança grava a `AuditoriaOperacao`, com o autor do comando e o operador alvo.
 * - O terminal mostra só ids e o caminho do arquivo: nunca o token, o nome nem o e-mail.
 */

export type PedidoDeOperador =
  | { readonly acao: 'criar'; readonly apelido: string; readonly nome: string; readonly email: string; readonly saida: string }
  | { readonly acao: 'desativar'; readonly apelido: string }
  | { readonly acao: 'convite'; readonly apelido: string; readonly saida: string }

/** Por que o `desativar` foi recusado, sem nada do pedido. */
export class DesativacaoRejectedError extends Error {
  constructor(readonly motivo: 'ultimo_ativo' | 'a_si_mesmo') {
    super(motivo === 'ultimo_ativo' ? 'o último operador ativo não pode ser desativado' : 'ninguém desativa a si mesmo')
    this.name = 'DesativacaoRejectedError'
  }
}

const emailSchema = z.email().max(TAMANHO_MAXIMO_EMAIL)

const OPCOES = { apelido: { type: 'string' }, nome: { type: 'string' }, email: { type: 'string' }, saida: { type: 'string' } } as const

/** As opções que cada subcomando aceita; outra qualquer é recusada. */
const OPCOES_DA_ACAO: Record<PedidoDeOperador['acao'], readonly (keyof typeof OPCOES)[]> = {
  criar: ['apelido', 'nome', 'email', 'saida'],
  desativar: ['apelido'],
  convite: ['apelido', 'saida'],
}

/**
 * O apelido segue o formato do `OPERADOR` (`FORMATO_OPERADOR`) e nunca é um autor reservado: o do nascimento (`bootstrap`)
 * nem o da rotina (`rotina`, F3 tarefa 15.0), que assina a eliminação e o expurgo e que o banco só aceita em quatro ações.
 */
function apelidoValido(valor: string | undefined): string {
  if (valor === undefined || !FORMATO_OPERADOR.test(valor) || valor === AUTOR_BOOTSTRAP || valor === AUTOR_DA_ROTINA) throw new InvalidArgumentError('--apelido')
  return valor
}

function saidaValida(valor: string | undefined): string {
  if (valor === undefined || valor.trim() === '') throw new InvalidArgumentError('--saida')
  return resolve(valor)
}

export function lerPedidoDeOperador(argumentos: string[]): PedidoDeOperador {
  let lido: { values: { apelido?: string | undefined; nome?: string | undefined; email?: string | undefined; saida?: string | undefined }; positionals: string[] }
  try {
    lido = parseArgs({ args: argumentos, options: OPCOES, strict: true, allowPositionals: true })
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new InvalidArgumentError('--apelido, --nome, --email ou --saida')
  }
  const { values: valores, positionals: posicionais } = lido
  const acao = posicionais.length === 1 ? posicionais[0] : undefined
  if (acao !== 'criar' && acao !== 'desativar' && acao !== 'convite') throw new InvalidArgumentError('comando (criar | desativar | convite)')
  const aceitas = OPCOES_DA_ACAO[acao]
  const sobrando = (Object.keys(valores) as (keyof typeof OPCOES)[]).find((opcao) => !aceitas.includes(opcao))
  if (sobrando !== undefined) throw new InvalidArgumentError(`--${sobrando} não vale para ${acao}`)
  const apelido = apelidoValido(valores.apelido)
  if (acao === 'desativar') return { acao, apelido }
  if (acao === 'convite') return { acao, apelido, saida: saidaValida(valores.saida) }
  const nome = nomeSchema.safeParse(valores.nome)
  if (!nome.success) throw new InvalidArgumentError('--nome')
  const email = emailSchema.safeParse(valores.email?.trim().toLowerCase())
  if (!email.success) throw new InvalidArgumentError('--email')
  return { acao, apelido, nome: nome.data, email: email.data, saida: saidaValida(valores.saida) }
}

/** A situação do `OPERADOR` sob a trava; recusado sai daqui. Devolve o autor da auditoria. */
async function autorSobATrava(repositorio: OperadorRepository, operadorDoAmbiente: string): Promise<string> {
  await repositorio.travarOperadores()
  const situacao = await repositorio.situacaoDoAutor(operadorDoAmbiente)
  if (situacao === 'recusado') throw new OperadorRejectedError()
  return situacao === 'bootstrap' ? AUTOR_BOOTSTRAP : operadorDoAmbiente
}

function expiracaoDoConvite(relogio: Clock): Date {
  return new Date(relogio.agora().getTime() + VALIDADE_DO_CONVITE_DE_OPERADOR_HORAS * 60 * 60 * 1_000)
}

export interface ConviteGerado {
  readonly operadorId: string
  readonly conviteId: string
  readonly token: string
}

/**
 * Cria o operador e o convite dele, com `operador.criado` e `convite_operador.gerado`, numa transação sob a trava.
 * Apelido ou e-mail repetido: `CONFLITO`, sem o valor.
 */
export async function criarOperador(
  banco: Database,
  operadorDoAmbiente: string,
  dados: { apelido: string; nome: string; email: string },
  relogio: Clock = systemClock,
): Promise<ConviteGerado> {
  const token = sortearTokenDeConvite()
  try {
    return await banco.transaction(async (tx) => {
      const repositorio = new OperadorRepository(tx)
      const autor = await autorSobATrava(repositorio, operadorDoAmbiente)
      const operadorId = await repositorio.criar(dados)
      const conviteId = await repositorio.criarConvite({ operadorId, tokenHash: hashDoTokenDeConvite(token), expiraEm: expiracaoDoConvite(relogio) })
      await repositorio.auditar({ autor, acao: 'operador.criado', operadorAlvoId: operadorId })
      await repositorio.auditar({ autor, acao: 'convite_operador.gerado', operadorAlvoId: operadorId })
      return { operadorId, conviteId, token }
    })
  } catch (erro) {
    // unique_violation: o apelido ou o e-mail já é de outro operador.
    if (postgresErrorIn(erro)?.code === '23505') throw new DomainException(ErrorCode.CONFLITO)
    throw erro
  }
}

/**
 * Desativa o operador ativo do apelido: apaga o dado pessoal e os códigos, revoga o convite pendente, encerra as
 * sessões e grava `operador.desativado` (e `convite_operador.revogado`, se havia um pendente), numa transação sob a
 * trava. Apelido inexistente ou já desativado: `NAO_ENCONTRADO`. O último ativo e a si mesmo: `DesativacaoRejectedError`.
 */
export async function desativarOperador(banco: Database, operadorDoAmbiente: string, apelido: string): Promise<void> {
  await banco.transaction(async (tx) => {
    const repositorio = new OperadorRepository(tx)
    const autor = await autorSobATrava(repositorio, operadorDoAmbiente)
    const alvo = await repositorio.ativoParaAtualizar(apelido)
    if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if ((await repositorio.contarAtivos()) <= 1) throw new DesativacaoRejectedError('ultimo_ativo')
    if (alvo.apelido === autor) throw new DesativacaoRejectedError('a_si_mesmo')
    await repositorio.desativar(alvo.id)
    await repositorio.apagarCodigosDeRecuperacao(alvo.id)
    const revogou = await repositorio.revogarConvitePendente(alvo.id)
    await repositorio.encerrarSessoes(alvo.id, 'desativacao')
    if (revogou) await repositorio.auditar({ autor, acao: 'convite_operador.revogado', operadorAlvoId: alvo.id })
    await repositorio.auditar({ autor, acao: 'operador.desativado', operadorAlvoId: alvo.id })
  })
}

/**
 * Gera um convite novo para o operador ativo do apelido, revogando o pendente na mesma transação, com
 * `convite_operador.revogado` (se havia) e `convite_operador.gerado`. Apelido inexistente ou desativado: `NAO_ENCONTRADO`.
 */
export async function gerarConviteDeOperador(banco: Database, operadorDoAmbiente: string, apelido: string, relogio: Clock = systemClock): Promise<ConviteGerado> {
  const token = sortearTokenDeConvite()
  return banco.transaction(async (tx) => {
    const repositorio = new OperadorRepository(tx)
    const autor = await autorSobATrava(repositorio, operadorDoAmbiente)
    const alvo = await repositorio.ativoParaAtualizar(apelido)
    if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const revogou = await repositorio.revogarConvitePendente(alvo.id)
    const conviteId = await repositorio.criarConvite({ operadorId: alvo.id, tokenHash: hashDoTokenDeConvite(token), expiraEm: expiracaoDoConvite(relogio) })
    if (revogou) await repositorio.auditar({ autor, acao: 'convite_operador.revogado', operadorAlvoId: alvo.id })
    await repositorio.auditar({ autor, acao: 'convite_operador.gerado', operadorAlvoId: alvo.id })
    return { operadorId: alvo.id, conviteId, token }
  })
}

/** Texto fixo por código, sem nada do pedido: o apelido, o nome e o e-mail nunca voltam na mensagem. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  NAO_ENCONTRADO: 'operador ativo não encontrado',
  CONFLITO: 'já existe operador com este apelido ou e-mail',
}

async function executarComBanco(pedido: PedidoDeOperador, operadorDoAmbiente: string, banco: Database): Promise<{ resposta: Record<string, string>; token?: string }> {
  if (pedido.acao === 'desativar') {
    await desativarOperador(banco, operadorDoAmbiente, pedido.apelido)
    return { resposta: {} }
  }
  if (pedido.acao === 'convite') {
    const { conviteId, token } = await gerarConviteDeOperador(banco, operadorDoAmbiente, pedido.apelido)
    return { resposta: { conviteId, arquivo: pedido.saida }, token }
  }
  const { operadorId, conviteId, token } = await criarOperador(banco, operadorDoAmbiente, pedido)
  return { resposta: { operadorId, conviteId, arquivo: pedido.saida }, token }
}

/**
 * Executa o comando e devolve o código de saída: 0 feito, 1 erro (`NAO_ENCONTRADO`, `CONFLITO` ou `ERRO_INTERNO`
 * resumido), 2 argumento, arquivo ou ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento, `OPERADOR` e
 * arquivo são conferidos antes de abrir o banco.
 */
export async function executarOpsOperador(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDeOperador(argumentos)
    const operadorDoAmbiente = lerOperador(ambiente)
    const saida = pedido.acao === 'desativar' ? undefined : pedido.saida
    const arquivo = saida === undefined ? undefined : await criarArquivoDoToken(saida, () => new InvalidArgumentError('--saida (o arquivo já existe ou a pasta não aceita escrita)'))
    let gravado = false
    try {
      const { banco, fechar } = abrirBanco(ambiente)
      try {
        const { resposta, token } = await executarComBanco(pedido, operadorDoAmbiente, banco)
        if (arquivo !== undefined && token !== undefined) await arquivo.writeFile(`${token}\n`)
        gravado = true
        terminal.saida(pedido.acao === 'desativar' ? 'ok\n' : `${JSON.stringify(resposta)}\n`)
        return 0
      } finally {
        await fechar()
      }
    } finally {
      if (arquivo !== undefined) {
        await arquivo.close()
        if (!gravado && saida !== undefined) await rm(saida, { force: true })
      }
    }
  } catch (erro) {
    if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
      // Só o nome da opção ou da variável: nunca o valor.
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DesativacaoRejectedError) {
      terminal.erro(`${ErrorCode.CONFLITO}: ${erro.message}\n`)
      return 1
    }
    if (erro instanceof DomainException && MENSAGEM_DO_OPERADOR[erro.codigo] !== undefined) {
      terminal.erro(`${erro.codigo}: ${MENSAGEM_DO_OPERADOR[erro.codigo]}\n`)
      return 1
    }
    // O erro cru do Postgres traz o valor da linha na mensagem e no `detail`: sai só o resumo seguro.
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsOperador(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
