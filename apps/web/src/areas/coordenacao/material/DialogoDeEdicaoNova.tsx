import { type Material } from '@educa/shared'
import { useRef, useState } from 'react'
import { FormDialog, useSingleSubmit } from '../../../components/dialogs'
import { FieldError, FormField } from '../../../components/ui/fields/FormField'
import { SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { enviarEdicao } from './api/material'
import { conferirArquivo, tamanhoPorExtenso, type ArquivoConferido } from './material-envio'
import { erroDoRotuloDaEdicao, falhaMudouOMaterial, MAXIMO_DO_ROTULO_DA_EDICAO, textoDaFalhaDaEdicao, TEXTO_DO_EFEITO_DA_EDICAO_NOVA } from './material-painel'

interface Props {
  /** O material que a edição vai substituir: `pronto`, e sem outra edição em leitura. */
  readonly alvo: Pick<Material, 'id' | 'titulo'>
  /** Relê a lista depois do pedido, deu certo ou não: é ela que diz se o material mudou. */
  readonly recarregar: () => Promise<void>
  readonly aoEnviar: () => void
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

const ID_DO_ERRO_DO_ARQUIVO = 'erro-do-arquivo-da-edicao'

/**
 * "Enviar edição nova" (ingestao-do-material, 12.0; RF10): o PDF da edição e, se a coordenação quiser, o nome dela ("2ª edição"). O resto (disciplina, séries, de quem é, licença) a edição herda do material, e a tela
 * diz isso e o que acontece com a anterior **antes** de enviar (regra 50, item 8). O arquivo é conferido na tela como no envio (PDF, até 20 MB); o clique duplo manda um pedido só. Cada abertura é um formulário novo (`key` de quem o monta).
 */
export function DialogoDeEdicaoNova({ alvo, recarregar, aoEnviar, aoFechar, focoDeReserva }: Props) {
  const [arquivo, definirArquivo] = useState<ArquivoConferido | undefined>(undefined)
  const [rotulo, definirRotulo] = useState('')
  const [tentou, definirTentou] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const botaoDoArquivo = useRef<HTMLButtonElement>(null)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: ({ arquivoEscolhido, nome }: { readonly arquivoEscolhido: File; readonly nome: string }) => enviarEdicao(alvo.id, nome === '' ? {} : { edicao: nome }, arquivoEscolhido),
    onSuccess: async () => {
      await recarregar()
      aoEnviar()
    },
    onError: (erro) => {
      if (falhaMudouOMaterial(erro)) void recarregar()
    },
  })
  const erroDoArquivo = arquivo === undefined ? (tentou ? 'Escolha o PDF da edição nova.' : undefined) : arquivo.problema
  const erroDoRotulo = erroDoRotuloDaEdicao(rotulo)
  const mudou = mutacao.isError && falhaMudouOMaterial(mutacao.error)

  function aoEnviarOFormulario(): void {
    definirTentou(true)
    if (arquivo === undefined || arquivo.problema !== undefined || erroDoRotulo !== undefined) {
      if (arquivo === undefined || arquivo.problema !== undefined) botaoDoArquivo.current?.focus()
      return
    }
    enviar({ arquivoEscolhido: arquivo.arquivo, nome: rotulo.trim() })
  }

  async function aoEscolher(arquivos: FileList | null): Promise<void> {
    const primeiro = arquivos?.item(0)
    if (primeiro === null || primeiro === undefined) return
    definirArquivo(await conferirArquivo(primeiro))
  }

  return (
    <FormDialog
      titulo="Enviar edição nova"
      aoFechar={aoFechar}
      aoEnviar={aoEnviarOFormulario}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Enviar edição nova"
      rotuloEnviando="Enviando…"
      falha={mutacao.isError ? textoDaFalhaDaEdicao(mutacao.error) : undefined}
      semNovaTentativa={mudou}
      focoDeReserva={focoDeReserva}
    >
      <p className="break-words text-apoio">
        Edição nova de <span className="font-semibold text-tinta">{alvo.titulo}</span>. A disciplina, as séries, de quem é o material e a licença seguem os do material atual.
      </p>
      <p className="text-apoio">{TEXTO_DO_EFEITO_DA_EDICAO_NOVA}</p>
      <div data-campo="arquivo" className="flex min-w-0 flex-col items-start gap-2">
        <button ref={botaoDoArquivo} type="button" className={`${SECONDARY_BUTTON_CLASSES} min-h-11`} onClick={() => entrada.current?.click()} disabled={mutacao.isPending} {...(erroDoArquivo === undefined ? {} : { 'aria-describedby': ID_DO_ERRO_DO_ARQUIVO })}>
          {arquivo === undefined ? 'Escolher o PDF' : 'Trocar o PDF'}
        </button>
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          tabIndex={-1}
          data-testid="arquivo-da-edicao"
          onChange={(evento) => {
            void aoEscolher(evento.target.files)
            evento.target.value = ''
          }}
        />
        {arquivo !== undefined && arquivo.problema === undefined && <p className="break-words text-apoio">PDF escolhido, com {tamanhoPorExtenso(arquivo.arquivo.size)}.</p>}
        {erroDoArquivo !== undefined && <FieldError id={ID_DO_ERRO_DO_ARQUIVO}>{erroDoArquivo}</FieldError>}
      </div>
      <FormField
        rotulo="Nome da edição (opcional)"
        dica="Por exemplo: 2ª edição, 2027."
        value={rotulo}
        maxLength={MAXIMO_DO_ROTULO_DA_EDICAO}
        onChange={(evento) => definirRotulo(evento.target.value)}
        erro={erroDoRotulo}
        autoComplete="off"
      />
    </FormDialog>
  )
}
