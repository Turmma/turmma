import { ErrorCode, type Material } from '@educa/shared'
import { ApiError } from '../../../api/client'
import { errorText } from '../../../components/error-text'
import type { CamposDoEnvioDeMaterial } from './api/material'
import { TEXTOS_DA_FALHA_DO_ENVIO, type ItemDoLote } from './material-envio'

/**
 * O envio em lote (ingestao-do-material, 7.0; RF14), sem React: os PDFs vão **um por vez**, na ordem da lista, e o que acontece com cada um é dito a quem
 * chamou, que o mostra. A API é a mesma de um arquivo só; o lote é só a tela chamando-a em fila, e por isso o teto de envios dela (por pessoa e por escola, nunca por IP)
 * vale para o lote inteiro e o 429 pode chegar no meio dele.
 *
 * - **O que falha não derruba os outros**: o arquivo que a API não aceita (`ENTRADA_INVALIDA`, o storage fora) fica `falhou` com o texto, e o lote segue. O **repetido** (`CONFLITO`) é
 *   "já enviado", e conta como feito.
 * - **O que vale para o lote todo para o lote**: o 429 (`LIMITE_EXCEDIDO`, com a espera da API), a licença que deixou de valer (`LICENCA_VENCIDA`), a disciplina, a série ou a licença
 *   que saiu (`NAO_ENCONTRADO`), a sessão que acabou e a recusa por licença que a tela não previu. O arquivo em que isso aconteceu **volta a `pendente`**, com os que faltam: nada foi gravado,
 *   e a pessoa os envia de novo ao resolver, ou no horário, sem escolher os arquivos outra vez.
 */

/** Por que o lote parou antes de terminar. `undefined` quando todos os arquivos foram tratados. */
export type ParadaDoLote =
  | { readonly tipo: 'limite'; readonly esperaSegundos: number | undefined }
  | { readonly tipo: 'licenca_vencida' }
  | { readonly tipo: 'nao_encontrado' }
  | { readonly tipo: 'recusa' }
  | { readonly tipo: 'sessao' }
  | { readonly tipo: 'cancelado' }

interface Opcoes {
  /** Os arquivos a enviar, na ordem: só os `pendente`. */
  readonly itens: readonly ItemDoLote[]
  /** O pedido de cada arquivo; `undefined` é item sem pedido válido (o formulário já o barra antes). */
  readonly camposDe: (item: ItemDoLote) => CamposDoEnvioDeMaterial | undefined
  readonly enviar: (campos: CamposDoEnvioDeMaterial, arquivo: File) => Promise<Material>
  /** O que mudou no arquivo: o chamador o põe na tela. */
  readonly aoMudar: (chave: number, parte: Partial<Pick<ItemDoLote, 'situacao' | 'texto'>>) => void
  /** O envio já enviado, para o chamador contar (e, no "Tentar de novo", apagar o que o substitui). */
  readonly aoEnviar: (item: ItemDoLote, material: Material) => Promise<void> | void
  /** A pessoa fechou o diálogo, ou a sessão trocou: nada de novo sai depois do arquivo que está no ar. */
  readonly cancelado: () => boolean
}

function paradaDoErro(erro: unknown): ParadaDoLote | undefined {
  if (!(erro instanceof ApiError)) return undefined
  switch (erro.codigo) {
    case ErrorCode.LIMITE_EXCEDIDO:
      return { tipo: 'limite', esperaSegundos: erro.esperaSegundos }
    case ErrorCode.LICENCA_VENCIDA:
      return { tipo: 'licenca_vencida' }
    case ErrorCode.NAO_ENCONTRADO:
      return { tipo: 'nao_encontrado' }
    case ErrorCode.MATERIAL_SEM_LICENCA:
      return { tipo: 'recusa' }
    case ErrorCode.NAO_AUTENTICADO:
      return { tipo: 'sessao' }
    default:
      return undefined
  }
}

export async function enviarOLote({ itens, camposDe, enviar, aoMudar, aoEnviar, cancelado }: Opcoes): Promise<ParadaDoLote | undefined> {
  for (const item of itens) {
    if (cancelado()) return { tipo: 'cancelado' }
    const campos = camposDe(item)
    if (campos === undefined) continue
    aoMudar(item.chave, { situacao: 'enviando' })
    try {
      const material = await enviar(campos, item.arquivo)
      aoMudar(item.chave, { situacao: 'enviado' })
      await aoEnviar(item, material)
    } catch (erro) {
      if (erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO) {
        aoMudar(item.chave, { situacao: 'ja_enviado' })
        continue
      }
      const parada = paradaDoErro(erro)
      if (parada !== undefined) {
        aoMudar(item.chave, { situacao: 'pendente' })
        return parada
      }
      aoMudar(item.chave, { situacao: 'falhou', texto: errorText(erro, TEXTOS_DA_FALHA_DO_ENVIO) })
    }
  }
  return cancelado() ? { tipo: 'cancelado' } : undefined
}

/** O que a tela diz de cada parada que não é o limite (esse tem a hora, em `material-envio.ts`). */
export const TEXTO_DA_PARADA: Readonly<Record<Exclude<ParadaDoLote['tipo'], 'limite' | 'cancelado'>, string>> = {
  licenca_vencida: 'A licença deste material não está vigente. Atualize a vigência em Licenças, ou escolha outra, e continue o envio: os arquivos que faltam ficam aqui.',
  nao_encontrado: 'A disciplina, a série ou a licença escolhida não existe mais. Atualize a página e escolha de novo: os arquivos que faltam ficam aqui.',
  recusa: 'O envio foi recusado por falta de licença ou de declaração. Confira a licença e a declaração, e continue o envio: os arquivos que faltam ficam aqui.',
  sessao: 'Sua sessão acabou. Entre de novo para continuar o envio.',
}
