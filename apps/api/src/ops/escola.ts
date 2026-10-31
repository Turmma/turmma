import { InvalidConfigError, DomainException, FORMATO_SLUG, summarizeError, TAMANHO_MAXIMO_SLUG, TIPOS_DE_REDE, type TipoDeRede } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { abrirBancoDeOperacao, InvalidArgumentError, autorDoComando, esquemaNome, lerOperador, OperadorRejectedError, type CommandDatabase, type CommandOutput } from './command.js'
import { criarEscola, criarRede } from '../operacao/escola/escola.js'

// O que é comum aos comandos do operador mora em `command.ts`; reexportado aqui para quem já o importava daqui.
export { abrirBancoDeOperacao, InvalidArgumentError, lerOperador, type CommandDatabase, type CommandOutput }

/**
 * Criação de rede e de escola pelo operador Turmma (RF1, D2): por este comando, ou pelo painel da operação
 * (`POST /v1/operacao/redes` e `/escolas`, A0b); os dois chamam os mesmos `criarRede` e `criarEscola`, que moram em
 * `operacao/escola/escola.ts`. Este arquivo é só o terminal. Não há rota de escola nem cadastro público: a escola
 * nasce só por um dos dois.
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:escola -- rede criar --nome <nome> --tipo prefeitura|grupo|independente
 *   OPERADOR=<pessoa da equipe> npm run -s ops:escola -- escola criar --rede <uuid> --nome <nome> --slug <endereco>
 *
 * - `OPERADOR` é obrigatório em qualquer ambiente e vai para `autor_operador` da auditoria. Sem ele, o
 *   comando recusa antes de abrir conexão com o banco. Com operador ativo (A0), só o apelido de um deles passa,
 *   conferido dentro da transação da criação (`autorDoComando`).
 * - O comando sorteia o id da rede e da escola; o painel manda o que a web sorteou.
 * - A criação e a auditoria dela são uma transação só. A da escola é gravada no contexto da escola
 *   criada; a da rede, com escola nula. O pedido repetido (mesmo id, mesmos dados) devolve o id sem auditoria nova.
 * - Imprime só o id criado, em JSON. Nenhum comando do operador lista ou lê pessoa.
 */

export type PedidoDoOperador = { entidade: 'rede'; nome: string; tipo: TipoDeRede } | { entidade: 'escola'; redeId: string; nome: string; slug: string }

function lerOpcoes(argumentos: string[]) {
  try {
    return parseArgs({
      args: argumentos,
      options: { nome: { type: 'string' }, tipo: { type: 'string' }, rede: { type: 'string' }, slug: { type: 'string' } },
      strict: true,
      allowPositionals: true,
    })
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new InvalidArgumentError('--nome, --tipo, --rede ou --slug')
  }
}

function nomeValido(valor: string | undefined): string {
  const resultado = esquemaNome.safeParse(valor)
  if (!resultado.success) throw new InvalidArgumentError('--nome')
  return resultado.data
}

export function lerPedidoDoOperador(argumentos: string[]): PedidoDoOperador {
  const { values: valores, positionals: posicionais } = lerOpcoes(argumentos)
  const comando = posicionais.join(' ')
  if (comando === 'rede criar') {
    if (valores.rede !== undefined || valores.slug !== undefined) throw new InvalidArgumentError('--rede e --slug não valem para rede')
    const tipo = TIPOS_DE_REDE.find((aceito) => aceito === valores.tipo)
    if (tipo === undefined) throw new InvalidArgumentError('--tipo')
    return { entidade: 'rede', nome: nomeValido(valores.nome), tipo }
  }
  if (comando === 'escola criar') {
    if (valores.tipo !== undefined) throw new InvalidArgumentError('--tipo não vale para escola')
    if (valores.rede === undefined || !z.uuid().safeParse(valores.rede).success) throw new InvalidArgumentError('--rede')
    const slug = valores.slug
    if (slug === undefined || slug.length > TAMANHO_MAXIMO_SLUG || !FORMATO_SLUG.test(slug)) throw new InvalidArgumentError('--slug')
    return { entidade: 'escola', redeId: valores.rede.toLowerCase(), nome: nomeValido(valores.nome), slug }
  }
  throw new InvalidArgumentError('comando (rede criar | escola criar)')
}

/** Texto fixo por código, sem nada do pedido: o slug e o nome nunca voltam na mensagem. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  CONFLITO: 'já existe escola com este endereço',
  NAO_ENCONTRADO: 'rede não encontrada',
}

/**
 * Executa o comando e devolve o código de saída: 0 criado, 1 erro (`CONFLITO`, `NAO_ENCONTRADO` ou
 * `ERRO_INTERNO` resumido), 2 argumento ou ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento e
 * formato do `OPERADOR` são conferidos antes de abrir o banco; o `OPERADOR` contra os ativos, dentro da transação.
 */
export async function executarOpsEscola(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: CommandOutput,
  abrirBanco: (ambiente: Record<string, string | undefined>) => CommandDatabase = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDoOperador(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const autor = autorDoComando(operador)
      const resposta =
        pedido.entidade === 'rede'
          ? { redeId: (await criarRede(banco, autor, { id: randomUUID(), nome: pedido.nome, tipo: pedido.tipo })).id }
          : { escolaId: (await criarEscola(banco, autor, { id: randomUUID(), redeId: pedido.redeId, nome: pedido.nome, slug: pedido.slug })).id }
      terminal.saida(`${JSON.stringify(resposta)}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof InvalidArgumentError || erro instanceof InvalidConfigError || erro instanceof OperadorRejectedError) {
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
  process.exitCode = await executarOpsEscola(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
