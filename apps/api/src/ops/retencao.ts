import { InvalidConfigError, DomainException, runInContext, AuditoriaRecorder, summarizeError, RetencaoDaEscolaRepository, type Database } from '@educa/nucleo'
import {
  ajusteDeRetencaoCabe,
  CATEGORIAS_DE_RETENCAO,
  CHAVES_DE_PRAZO_FIXO,
  CHAVES_DE_RETENCAO,
  ErrorCode,
  InvariantException,
  FINALIDADE_DO_AJUSTE_DE_RETENCAO,
  retencaoDaEscola,
  type RetencaoDaCategoria,
} from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { AcessoDaEscolaRepository } from '../credencial/index.js'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './comando.js'
import type { ConferenciaDoAutor } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/**
 * O ajuste da retenção de uma escola pela operação (F3, RF2; Tech Spec do F3, seções 3 e 6):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:retencao -- ajustar --escola <uuid> --categoria <categoria> --meses <n> --contrato <número>
 *   OPERADOR=<pessoa da equipe> npm run -s ops:retencao -- listar --escola <uuid>
 *
 * - O contexto é o da escola do id, como os outros `ops:*`: quem lê e grava é o `RetencaoDaEscolaRepository`, com o
 *   escopo dela, e nenhum `@Unscoped` novo.
 * - `ajustar` confere o prazo contra o catálogo (`ajusteDeRetencaoCabe`): dentro do piso e do teto, nunca acima da
 *   categoria que a trava, e só nas doze categorias; os prazos fixos (registro de acesso, auditoria…) e o que estiver
 *   fora disso dão `RETENCAO_FORA_DO_LIMITE`, sem gravar nada. Baixar a categoria que trava outra é aceito: o prazo
 *   efetivo da travada acompanha.
 * - O ajuste e o `retencao.ajustada` da auditoria da escola, com `autor_operador`, o prazo anterior e o número do
 *   contrato (`--contrato`, inteiro positivo, como o `--pedido` do `ops:redefinir-mfa`: nunca texto livre), são uma
 *   transação só, que começa pela conferência do autor e trava a escola: dois ajustes da mesma escola passam um de cada
 *   vez. Escola inexistente: `NAO_ENCONTRADO`.
 * - `listar` imprime o prazo efetivo de cada categoria, de onde ele vem e a trava que o encurtou. Nada de pessoa.
 */

export type PedidoDeRetencao =
  | { readonly comando: 'listar'; readonly escolaId: string }
  | { readonly comando: 'ajustar'; readonly escolaId: string; readonly categoria: string; readonly meses: number; readonly referenciaContrato: number }

/** As categorias que o comando aceita ler: as do catálogo, e os prazos fixos, que ele recusa no domínio. */
const CATEGORIAS_ACEITAS: readonly string[] = [...CHAVES_DE_RETENCAO, ...CHAVES_DE_PRAZO_FIXO]
const MESES = /^\d{1,4}$/
const CONTRATO = /^[1-9]\d{0,8}$/

function lerOpcoes(argumentos: string[]) {
  try {
    return parseArgs({
      args: argumentos,
      options: { escola: { type: 'string' }, categoria: { type: 'string' }, meses: { type: 'string' }, contrato: { type: 'string' } },
      strict: true,
      allowPositionals: true,
    })
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new ArgumentoInvalido('--escola, --categoria, --meses ou --contrato')
  }
}

export function lerPedidoDeRetencao(argumentos: string[]): PedidoDeRetencao {
  const { values: valores, positionals: posicionais } = lerOpcoes(argumentos)
  const comando = posicionais.join(' ')
  if (comando !== 'listar' && comando !== 'ajustar') throw new ArgumentoInvalido('comando (ajustar | listar)')
  const escola = z.uuid().safeParse(valores.escola)
  if (!escola.success) throw new ArgumentoInvalido('--escola')
  const escolaId = escola.data.toLowerCase()
  if (comando === 'listar') {
    if (valores.categoria !== undefined || valores.meses !== undefined || valores.contrato !== undefined) throw new ArgumentoInvalido('--categoria, --meses e --contrato não valem para listar')
    return { comando, escolaId }
  }
  if (valores.categoria === undefined || !CATEGORIAS_ACEITAS.includes(valores.categoria)) throw new ArgumentoInvalido('--categoria')
  if (valores.meses === undefined || !MESES.test(valores.meses)) throw new ArgumentoInvalido('--meses')
  if (valores.contrato === undefined || !CONTRATO.test(valores.contrato)) throw new ArgumentoInvalido('--contrato')
  return { comando, escolaId, categoria: valores.categoria, meses: Number(valores.meses), referenciaContrato: Number(valores.contrato) }
}

/**
 * Ajusta o prazo de uma categoria da escola e grava `retencao.ajustada`, na mesma transação, com o autor conferido como
 * primeira instrução. Devolve o prazo efetivo da categoria depois do ajuste.
 */
export function ajustarRetencao(banco: Database, autor: ConferenciaDoAutor, pedido: Extract<PedidoDeRetencao, { comando: 'ajustar' }>): Promise<RetencaoDaCategoria> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      return runInContext({ requisicaoId, escolaId: pedido.escolaId }, async () => {
        const repositorio = new RetencaoDaEscolaRepository(tx)
        if (!(await repositorio.travarEscola())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        const ajustes = await repositorio.ajustes()
        const categoria = CHAVES_DE_RETENCAO.find((chave) => chave === pedido.categoria)
        if (categoria === undefined || !ajusteDeRetencaoCabe(categoria, pedido.meses, ajustes)) throw new DomainException(ErrorCode.RETENCAO_FORA_DO_LIMITE)
        const anterior = ajustes.find((ajuste) => ajuste.categoria === categoria)
        await repositorio.gravar({ categoria, meses: pedido.meses, referenciaContrato: pedido.referenciaContrato, alteradaPor: autorOperador })
        await registro.gravar(tx, 'retencao.ajustada', {
          entidadeId: pedido.escolaId,
          antes: anterior === undefined ? { meses: CATEGORIAS_DE_RETENCAO[categoria].padrao, origem: 'padrao' } : { meses: anterior.meses, origem: 'ajustada' },
          depois: { categoria, meses: pedido.meses, referenciaContrato: pedido.referenciaContrato },
          finalidade: FINALIDADE_DO_AJUSTE_DE_RETENCAO,
          autorOperador,
        })
        const efetiva = retencaoDaEscola(await repositorio.ajustes()).find((retencao) => retencao.categoria === categoria)
        if (efetiva === undefined) throw new InvariantException('categoria ajustada fora do catálogo')
        return efetiva
      })
    }),
  )
}

/** O prazo efetivo de cada categoria da escola, lido no contexto dela, numa transação que começa pelo autor. */
export function listarRetencao(banco: Database, autor: ConferenciaDoAutor, escolaId: string): Promise<RetencaoDaCategoria[]> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      await autor(tx)
      return runInContext({ requisicaoId, escolaId }, async () => {
        if ((await new AcessoDaEscolaRepository(tx).nome()) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        return retencaoDaEscola(await new RetencaoDaEscolaRepository(tx).ajustes())
      })
    }),
  )
}

/** Texto fixo por código, sem nada do pedido. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  NAO_ENCONTRADO: 'escola não encontrada',
  RETENCAO_FORA_DO_LIMITE: 'o prazo não cabe no piso, no teto ou na trava da categoria, ou a categoria não se ajusta',
}

/**
 * Executa o comando e devolve o código de saída: 0 ajustado ou listado, 1 `RETENCAO_FORA_DO_LIMITE`, `NAO_ENCONTRADO` ou
 * `ERRO_INTERNO` resumido, 2 argumento ou ambiente inválido, ou `OPERADOR` que não é operador ativo. Argumento e formato
 * do `OPERADOR` são conferidos antes de abrir o banco; o `OPERADOR` contra os ativos, dentro da transação.
 */
export async function executarOpsRetencao(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = lerPedidoDeRetencao(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const autor = autorDoComando(operador)
      const resposta = pedido.comando === 'listar' ? { categorias: await listarRetencao(banco, autor, pedido.escolaId) } : await ajustarRetencao(banco, autor, pedido)
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
  process.exitCode = await executarOpsRetencao(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
