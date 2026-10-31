import { InvalidConfigError, DomainException, runInContext, AuditoriaRecorder, summarizeError, type Database } from '@educa/core'
import {
  CHAVES_DE_CATEGORIA_DO_SUBOPERADOR,
  ErrorCode,
  FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
  FORMATO_DA_CHAVE_DO_SUBOPERADOR,
  FORMATO_DO_CONTRATO_DO_SUBOPERADOR,
  FORMATO_DO_PAIS_DO_SUBOPERADOR,
  MAXIMO_DA_FINALIDADE_DO_SUBOPERADOR,
  MAXIMO_DO_NOME_DO_SUBOPERADOR,
  type AlcanceDoSuboperador,
  type CategoriaDeDadoDoSuboperador,
} from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { AcessoDaEscolaRepository } from '../credencial/index.js'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './command.js'
import { OperacaoPrivacidadeRepository } from './operacao-privacidade.repository.js'
import type { ConferenciaDoAutor } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/**
 * O cadastro e o encerramento de suboperador pela operação (F3, RF6; Tech Spec do F3, seções 3 e 6):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:suboperador -- cadastrar --chave <chave> --nome <empresa> --finalidade <o que ela faz>
 *       --pais <BR> --categorias <cadastro,conversa_do_aluno,…> --contrato <código> --veda-treinamento sim|nao (--todas | --escolas <uuid,uuid,…>)
 *   OPERADOR=<pessoa da equipe> npm run -s ops:suboperador -- encerrar --chave <chave>
 *
 * - `--todas` é a empresa que atende toda escola (a hospedagem); `--escolas` é a que atende só as listadas. Um dos dois,
 *   nunca os dois, nunca nenhum. `--veda-treinamento` é dito sempre, `sim` ou `nao`: é um fato do contrato, sem padrão.
 * - O cadastro, a ligação com cada escola da lista e o `suboperador.cadastrado` da auditoria são uma transação só, que
 *   começa pela conferência do autor. A ligação é escrita **no contexto de cada escola**, aberto antes (regra 10, item 3):
 *   escola inexistente na lista é `NAO_ENCONTRADO` e desfaz tudo. Já há um vigente com a chave: `CONFLITO`, sem gravar nada.
 * - `encerrar` fecha o suboperador vigente da chave e as ligações abertas dele, e grava `suboperador.encerrado`. Ele fica
 *   como histórico: a escola precisa dizer ao titular por onde o dado passou, mesmo depois de a empresa sair. Sem vigente:
 *   `NAO_ENCONTRADO`. A chave encerrada pode ser cadastrada de novo.
 * - A auditoria é sem escola (o ato é da operação, e a empresa pode atender toda escola): ver
 *   `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`. O id do suboperador identifica a empresa, e a auditoria leva só o alcance e contagens: não aceita texto livre, então nunca
 *   a chave, o nome, o contrato nem a lista de escolas.
 */

export type PedidoDeSuboperador =
  | {
      readonly comando: 'cadastrar'
      readonly chave: string
      readonly nome: string
      readonly finalidade: string
      readonly pais: string
      readonly categorias: readonly CategoriaDeDadoDoSuboperador[]
      readonly contrato: string
      readonly vedaTreinamento: boolean
      readonly alcance: AlcanceDoSuboperador
      readonly escolas: readonly string[]
    }
  | { readonly comando: 'encerrar'; readonly chave: string }

/** Texto de empresa: uma linha, sem caractere de controle. */
const SEM_CONTROLE = /^[^\p{Cc}]+$/u
const MAXIMO_DE_ESCOLAS = 200

const esquemaChave = z.string().regex(FORMATO_DA_CHAVE_DO_SUBOPERADOR)
const esquemaNomeDaEmpresa = z.string().trim().min(1).max(MAXIMO_DO_NOME_DO_SUBOPERADOR).regex(SEM_CONTROLE)
const esquemaFinalidade = z.string().trim().min(1).max(MAXIMO_DA_FINALIDADE_DO_SUBOPERADOR).regex(SEM_CONTROLE)
const esquemaPais = z.string().regex(FORMATO_DO_PAIS_DO_SUBOPERADOR)
const esquemaContrato = z.string().regex(FORMATO_DO_CONTRATO_DO_SUBOPERADOR)
const esquemaCategorias = z.array(z.enum(CHAVES_DE_CATEGORIA_DO_SUBOPERADOR)).min(1)
const esquemaEscolas = z.array(z.uuid()).min(1).max(MAXIMO_DE_ESCOLAS)

function lerOpcoes(argumentos: string[]) {
  try {
    return parseArgs({
      args: argumentos,
      options: {
        chave: { type: 'string' },
        nome: { type: 'string' },
        finalidade: { type: 'string' },
        pais: { type: 'string' },
        categorias: { type: 'string' },
        contrato: { type: 'string' },
        'veda-treinamento': { type: 'string' },
        todas: { type: 'boolean' },
        escolas: { type: 'string' },
      },
      strict: true,
      allowPositionals: true,
    })
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new ArgumentoInvalido('--chave, --nome, --finalidade, --pais, --categorias, --contrato, --veda-treinamento, --todas ou --escolas')
  }
}

/** O valor conferido contra o esquema, ou `ArgumentoInvalido` com o nome da opção e nunca o valor. */
function conferido<Valor>(esquema: z.ZodType<Valor>, valor: unknown, opcao: string): Valor {
  const lido = esquema.safeParse(valor)
  if (!lido.success) throw new ArgumentoInvalido(opcao)
  return lido.data
}

/** A lista separada por vírgula, sem repetição; cada item passa por `normalizar` depois do `trim`. */
function listaDe(texto: string | undefined, opcao: string, normalizar: (item: string) => string): string[] {
  if (texto === undefined) throw new ArgumentoInvalido(opcao)
  const itens = texto.split(',').map((item) => normalizar(item.trim()))
  return [...new Set(itens)]
}

export function lerPedidoDeSuboperador(argumentos: string[]): PedidoDeSuboperador {
  const { values: valores, positionals: posicionais } = lerOpcoes(argumentos)
  const comando = posicionais.join(' ')
  if (comando !== 'cadastrar' && comando !== 'encerrar') throw new ArgumentoInvalido('comando (cadastrar | encerrar)')
  const chave = conferido(esquemaChave, valores.chave, '--chave')
  if (comando === 'encerrar') {
    const sobra = ['nome', 'finalidade', 'pais', 'categorias', 'contrato', 'veda-treinamento', 'todas', 'escolas'].some((opcao) => valores[opcao as keyof typeof valores] !== undefined)
    if (sobra) throw new ArgumentoInvalido('só --chave vale para encerrar')
    return { comando, chave }
  }
  const nome = conferido(esquemaNomeDaEmpresa, valores.nome, '--nome')
  const finalidade = conferido(esquemaFinalidade, valores.finalidade, '--finalidade')
  const pais = conferido(esquemaPais, valores.pais, '--pais')
  const categorias = conferido(esquemaCategorias, listaDe(valores.categorias, '--categorias', (item) => item), '--categorias')
  const contrato = conferido(esquemaContrato, valores.contrato, '--contrato')
  const veda = conferido(z.enum(['sim', 'nao']), valores['veda-treinamento'], '--veda-treinamento')
  const todas = valores.todas === true
  if (todas === (valores.escolas !== undefined)) throw new ArgumentoInvalido('--todas ou --escolas, um dos dois')
  const escolas = todas ? [] : conferido(esquemaEscolas, listaDe(valores.escolas, '--escolas', (item) => item.toLowerCase()), '--escolas')
  return { comando, chave, nome, finalidade, pais, categorias, contrato, vedaTreinamento: veda === 'sim', alcance: todas ? 'todas' : 'lista', escolas }
}

/**
 * Cadastra o suboperador, liga cada escola da lista no contexto dela e grava `suboperador.cadastrado`, na mesma transação,
 * com o autor conferido como primeira instrução. Devolve o id.
 */
export function cadastrarSuboperador(banco: Database, autor: ConferenciaDoAutor, pedido: Extract<PedidoDeSuboperador, { comando: 'cadastrar' }>): Promise<{ suboperadorId: string; escolas: number }> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const repositorio = new OperacaoPrivacidadeRepository(tx)
      const suboperadorId = await repositorio.cadastrar({ ...pedido, registradoPor: autorOperador })
      if (suboperadorId === undefined) throw new DomainException(ErrorCode.CONFLITO)
      for (const escolaId of pedido.escolas) {
        await runInContext({ requisicaoId, escolaId }, async () => {
          if ((await new AcessoDaEscolaRepository(tx).nome()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
          await repositorio.ligarEscola(suboperadorId)
        })
      }
      await registro.gravar(tx, 'suboperador.cadastrado', {
        entidadeId: suboperadorId,
        depois: { alcance: pedido.alcance, escolas: pedido.escolas.length },
        finalidade: FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
        autorOperador,
      })
      return { suboperadorId, escolas: pedido.escolas.length }
    }),
  )
}

/** Encerra o suboperador vigente da chave e as ligações abertas dele, e grava `suboperador.encerrado`, numa transação só. */
export function encerrarSuboperador(banco: Database, autor: ConferenciaDoAutor, pedido: Extract<PedidoDeSuboperador, { comando: 'encerrar' }>): Promise<{ suboperadorId: string; ligacoesEncerradas: number }> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const repositorio = new OperacaoPrivacidadeRepository(tx)
      const vigente = await repositorio.travarVigente(pedido.chave)
      if (vigente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await repositorio.encerrar(vigente.id)
      const ligacoesEncerradas = await repositorio.encerrarLigacoes(vigente.id)
      await registro.gravar(tx, 'suboperador.encerrado', {
        entidadeId: vigente.id,
        antes: { alcance: vigente.alcance },
        depois: { ligacoesEncerradas },
        finalidade: FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
        autorOperador,
      })
      return { suboperadorId: vigente.id, ligacoesEncerradas }
    }),
  )
}

/** Texto fixo por código, sem nada do pedido. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  CONFLITO: 'já existe suboperador vigente com esta chave',
  NAO_ENCONTRADO: 'suboperador vigente ou escola não encontrados',
}

/**
 * Executa o comando e devolve o código de saída: 0 cadastrado ou encerrado, 1 `CONFLITO`, `NAO_ENCONTRADO` ou `ERRO_INTERNO`
 * resumido, 2 argumento ou ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento e formato do `OPERADOR` são
 * conferidos antes de abrir o banco; o `OPERADOR` contra os ativos, dentro da transação.
 */
export async function executarOpsSuboperador(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDeSuboperador(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const autor = autorDoComando(operador)
      const resposta = pedido.comando === 'cadastrar' ? await cadastrarSuboperador(banco, autor, pedido) : await encerrarSuboperador(banco, autor, pedido)
      terminal.saida(`${JSON.stringify(resposta)}\n`)
      return 0
    } finally {
      await fechar()
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
  process.exitCode = await executarOpsSuboperador(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
