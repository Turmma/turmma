import { useMutation } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { baixarPdfDoArtefato, salvarArquivo } from './api/artefatos'
import { mensagemDoErro } from '../../../api/client'
import { Botao } from '../../../components/ui/Botao'
import type { VarianteDeBotao } from '../../../components/ui/button-variants'

interface PropsDoExportar {
  readonly artefatoId: string
  /** O título do artefato: vira o nome do arquivo quando a API não diz um. */
  readonly titulo: string
  readonly variante?: Extract<VarianteDeBotao, 'secundario' | 'discreto'>
  /**
   * A versão adaptada que ainda espera a decisão sai como **rascunho**: a API marca toda página, e o botão já diz isso
   * antes do clique, para ninguém levar à turma o que não foi aprovado (regra 70, item 3).
   */
  readonly rascunho?: boolean
}

/**
 * "Exportar em PDF" (D67): baixa o artefato pela API, com a sessão, e entrega o arquivo ao navegador. O botão diz que
 * está exportando e desliga enquanto isso (um clique, um arquivo); a falha vira a mensagem do catálogo, ao lado.
 *
 * Quem decide se a versão adaptada rejeitada tem botão é quem usa a peça: ela não exporta (`podeExportar`).
 */
export function ExportarPdf({ artefatoId, titulo, variante = 'discreto', rascunho = false }: PropsDoExportar) {
  const exportar = useMutation({ mutationFn: () => baixarPdfDoArtefato(artefatoId, titulo), onSuccess: salvarArquivo })
  return (
    <>
      <Botao variante={variante} tamanho={variante === 'discreto' ? 'compacto' : 'principal'} disabled={exportar.isPending} onClick={() => exportar.mutate()}>
        <FileDown aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />
        {exportar.isPending ? 'Exportando…' : rascunho ? 'Exportar rascunho em PDF' : 'Exportar em PDF'}
      </Botao>
      <span role="alert" className="min-w-0 text-sm break-words text-erro empty:hidden">
        {exportar.isError ? mensagemDoErro(exportar.error) : ''}
      </span>
    </>
  )
}
