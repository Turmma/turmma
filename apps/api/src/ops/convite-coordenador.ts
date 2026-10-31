import { InvalidConfigError, DomainException, FORMATO_SLUG, summarizeError, TAMANHO_MAXIMO_SLUG } from '@educa/core'
import { ErrorCode, emailConvidadoSchema } from '@educa/shared'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { criarConviteDeCoordenador, type PedidoDeConvite } from '../sessao/index.js'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, criarArquivoDoToken, esquemaNome, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './command.js'

/**
 * O convite do primeiro coordenador, pelo operador, depois do contrato (RF1; Tech Spec, seção 5, "Operador"):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:convite-coordenador -- --escola <slug> --email <e-mail> --nome <nome> --saida <arquivo>
 *
 * - `OPERADOR` e os argumentos são conferidos antes de abrir o banco. O arquivo de `--saida` é criado antes também, com
 *   modo 0600 e sem sobrescrever um que já exista: se ele não pode ser criado, nada é gravado no banco.
 * - Com operador ativo (A0), o `OPERADOR` precisa ser um deles, conferido como primeira instrução da transação,
 *   antes de ler a escola; recusado, o arquivo é apagado.
 * - É o mesmo caso de uso do gerar do painel da operação (A0b), com a mesma trava da escola e a mesma matriz estado ×
 *   ação: **com convite em aberto (pendente ou vencido), ou com coordenação ativa, ele recusa com `CONFLITO`** e não
 *   grava nada. Não refaz sozinho: o caminho é revogar o convite (`ops:revogar-convite`) e gerar de novo, ou refazer
 *   pelo painel. Com o convite anterior aceito e sem primeira entrada, ou com a coordenação desativada, ele revoga o
 *   anterior (`convite.revogado` na auditoria) e gera.
 * - O token (32 bytes sorteados) vai só para o arquivo. O terminal mostra o id do convite (que o `ops:revogar-convite`
 *   recebe) e o caminho do arquivo: nunca o token, o nome nem o e-mail. Se o banco falha, o arquivo é apagado.
 * - Escola inexistente sai com `NAO_ENCONTRADO`, e a recusa da matriz com `CONFLITO`, sem o valor recebido.
 * - O operador manda o link à pessoa à mão no F1 (o envio por e-mail é do F2).
 */

/** O pedido do comando: a escola sempre pelo endereço, e o arquivo do token. */
export type PedidoDoConvite = Extract<PedidoDeConvite, { readonly slug: string }> & { readonly saida: string }

export function lerPedidoDoConvite(argumentos: string[]): PedidoDoConvite {
  let valores: { escola?: string | undefined; email?: string | undefined; nome?: string | undefined; saida?: string | undefined }
  try {
    valores = parseArgs({
      args: argumentos,
      options: { escola: { type: 'string' }, email: { type: 'string' }, nome: { type: 'string' }, saida: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }).values
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new ArgumentoInvalido('--escola, --email, --nome ou --saida')
  }
  const slug = valores.escola
  if (slug === undefined || slug.length > TAMANHO_MAXIMO_SLUG || !FORMATO_SLUG.test(slug)) throw new ArgumentoInvalido('--escola')
  const email = emailConvidadoSchema.safeParse(valores.email)
  if (!email.success) throw new ArgumentoInvalido('--email')
  const nome = esquemaNome.safeParse(valores.nome)
  if (!nome.success) throw new ArgumentoInvalido('--nome')
  if (valores.saida === undefined || valores.saida.trim() === '') throw new ArgumentoInvalido('--saida')
  return { slug, email: email.data, nome: nome.data, saida: resolve(valores.saida) }
}

/** Texto fixo por código, sem nada do pedido: o e-mail, o nome e o endereço nunca voltam na mensagem. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  NAO_ENCONTRADO: 'escola não encontrada',
  CONFLITO: 'a escola já tem coordenação ativa ou convite em aberto; revogue o convite antes de gerar outro',
}

/**
 * Executa o comando e devolve o código de saída: 0 criado, 1 erro (`NAO_ENCONTRADO`, `CONFLITO` ou `ERRO_INTERNO`
 * resumido), 2 argumento, arquivo ou ambiente inválido.
 */
export async function executarOpsConviteCoordenador(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDoConvite(argumentos)
    const operador = lerOperador(ambiente)
    const arquivo = await criarArquivoDoToken(pedido.saida, () => new ArgumentoInvalido('--saida (o arquivo já existe ou a pasta não aceita escrita)'))
    let gravado = false
    try {
      const { banco, fechar } = abrirBanco(ambiente)
      try {
        const { conviteId, token } = await criarConviteDeCoordenador(banco, autorDoComando(operador), pedido)
        await arquivo.writeFile(`${token}\n`)
        gravado = true
        terminal.saida(`${JSON.stringify({ conviteId, arquivo: pedido.saida })}\n`)
        return 0
      } finally {
        await fechar()
      }
    } finally {
      await arquivo.close()
      if (!gravado) await rm(pedido.saida, { force: true })
    }
  } catch (erro) {
    if (erro instanceof ArgumentoInvalido || erro instanceof InvalidConfigError || erro instanceof OperadorRecusado) {
      // Só o nome da opção ou da variável: nunca o valor.
      terminal.erro(`${erro.message}\n`)
      return 2
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
  process.exitCode = await executarOpsConviteCoordenador(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
