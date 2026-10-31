import { ErrorCode } from '@educa/shared'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useEffect, useRef, type FormEvent, type ReactNode, type Ref, type RefObject } from 'react'
import { Botao } from './ui/Botao'
import { CLASSES_DO_BOTAO_PERIGO_CHEIO, CLASSES_DO_BOTAO_SECUNDARIO } from './ui/button-variants'
import { Dialogo } from './ui/overlays/Dialogo'
import { listaMudou, textoDaFalha } from './error-text'

/**
 * As peças dos diálogos das telas da escola: o envio único, o anúncio da ação que terminou, o alerta de falha dentro do
 * diálogo e os dois diálogos que se repetem — o formulário (criar, renomear, acrescentar) e a confirmação de `perigo`
 * (excluir, retirar, revogar). Nasceram na Estrutura da coordenação (A1, 13.0) e vieram para `components/` na 15.0, com
 * a turma do professor usando as mesmas: importar de `areas/coordenacao/` levaria o módulo para o chunk da outra área.
 * O texto de cada falha e o "a lista mudou" moram em `error-text.ts`, sem React.
 *
 * Cada abertura é uma instância nova (`useDialogoDaTela`, `key` pelo número): o aviso e o foco de uma tentativa anterior
 * não sobrevivem ao fechar e abrir de novo (o "recomeço da tela" do 13_task.md).
 */

/**
 * Um pedido por vez: o segundo clique de um clique duplo chega antes do `isPending` da mutação, e sairia outro pedido. A
 * trava é na hora, numa `ref`, e solta quando o pedido termina. As opções são as do `useMutation`, escritas na tela ou
 * vindas de `api/` (as do acesso da turma, que têm teste de unidade); o `gcTime: 0` vale sempre: a resposta não fica no
 * cache depois de o diálogo sair.
 */
export function useEnvioUnico<Entrada, Saida>(opcoes: UseMutationOptions<Saida, Error, Entrada>) {
  const noAr = useRef(false)
  const mutacao = useMutation({ ...opcoes, gcTime: 0 })
  function enviar(entrada: Entrada): void {
    if (noAr.current) return
    noAr.current = true
    // A trava solta pela promessa do próprio pedido, que termina com ele: o `onSettled` passado ao `mutate` é do observador,
    // e um `reset()` com o pedido no ar o desliga — a trava ficaria presa até a tela sair.
    const soltar = (): void => {
      noAr.current = false
    }
    void mutacao.mutateAsync(entrada).then(soltar, soltar)
  }
  return { enviar, mutacao }
}

/**
 * O anúncio da ação que terminou, na seção onde ela aconteceu: quem enxerga o vê ao lado do que mudou, e não no topo de
 * uma página já rolada, e o leitor de tela o ouve, porque a região existe antes do texto.
 */
export function Anuncio({ texto }: { texto: string }) {
  return (
    <div role="status" className="empty:hidden">
      {texto !== '' && <p className="rounded-controle border border-ok bg-ok-cx p-3 break-words text-ok">{texto}</p>}
    </div>
  )
}

const CLASSES_DO_ALERTA = 'rounded-controle border border-erro bg-erro-cx p-3 break-words text-erro'

/** O alerta da falha, dentro do diálogo modal, onde o leitor de tela o alcança; o foco vai para ele quando aparece. */
export function AlertaDaFalha({ texto }: { texto: string }) {
  const alerta = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    alerta.current?.focus()
  }, [texto])
  return (
    <p ref={alerta} tabIndex={-1} role="alert" className={CLASSES_DO_ALERTA}>
      {texto}
    </p>
  )
}

/**
 * O mesmo alerta, sem o foco ao aparecer: quem o desenha leva o foco a ele (`alvo`) quando a falha chega. É o alerta que
 * pode voltar à tela sem falha nova — o da lista colada, que reaparece quando o texto volta a ser o que foi recusado —,
 * e aí levar o foco tiraria a pessoa do campo no meio da digitação.
 */
export function AlertaSemFoco({ texto, alvo }: { texto: string; alvo: RefObject<HTMLParagraphElement | null> }) {
  return (
    <p ref={alvo} tabIndex={-1} role="alert" className={CLASSES_DO_ALERTA}>
      {texto}
    </p>
  )
}

interface PropsDoFormulario {
  readonly titulo: string
  readonly aoFechar: () => void
  readonly aoEnviar: () => void
  readonly enviando: boolean
  readonly rotuloDoEnvio: string
  readonly rotuloEnviando: string
  /** A falha do último envio, já em texto. */
  readonly falha: string | undefined
  /** A falha mudou a lista: some o envio e fica só "Fechar". */
  readonly semNovaTentativa?: boolean
  readonly focoDeReserva?: () => void
  readonly children: ReactNode
}

/**
 * O diálogo de formulário: os campos, a falha, o envio e o "Cancelar" do mesmo tamanho (D59). O `noValidate` deixa a
 * tela dizer o erro de cada campo em português, em vez do balão do navegador.
 */
export function DialogoDeFormulario({ titulo, aoFechar, aoEnviar, enviando, rotuloDoEnvio, rotuloEnviando, falha, semNovaTentativa = false, focoDeReserva, children }: PropsDoFormulario) {
  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (!semNovaTentativa) aoEnviar()
  }
  return (
    <Dialogo titulo={titulo} aoFechar={aoFechar} {...(focoDeReserva === undefined ? {} : { focoDeReserva })}>
      <form className="mt-4 flex min-w-0 flex-col gap-4" onSubmit={enviar} noValidate>
        {children}
        {falha !== undefined && <AlertaDaFalha texto={falha} />}
        <div className="flex flex-wrap justify-end gap-3">
          {!semNovaTentativa && (
            <Botao type="submit" disabled={enviando}>
              {enviando ? rotuloEnviando : rotuloDoEnvio}
            </Botao>
          )}
          <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
            {semNovaTentativa ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
        <span role="status" className="sr-only">
          {enviando ? rotuloEnviando : ''}
        </span>
      </form>
    </Dialogo>
  )
}

interface PropsDaConfirmacao {
  readonly titulo: string
  /** O que acontece, antes de confirmar (regra 50, item 8). */
  readonly texto: ReactNode
  readonly rotuloDaAcao: string
  readonly rotuloEmAndamento: string
  readonly acao: () => Promise<void>
  readonly aoFechar: () => void
  /**
   * Roda depois de a lista recarregar, mesmo com o diálogo já fechado: quem recebe fecha só a abertura em que o pedido
   * saiu (`fecharSeAinda`).
   */
  readonly aoConcluir: () => void
  /** Recarrega a lista depois do pedido, deu certo ou não: o `CONFLITO` e o `NAO_ENCONTRADO` dizem que ela mudou. */
  readonly aoTerminar: () => unknown
  readonly textosDaFalha: Partial<Record<ErrorCode, string>>
  /** O foco ao fechar quando o botão que abriu já saiu da página (o item excluído, ou a lista recarregada). */
  readonly focoDeReserva: () => void
}

interface PropsDoCorpoDaConfirmacao extends Omit<PropsDaConfirmacao, 'titulo' | 'focoDeReserva'> {
  /** Onde o foco começa: o texto do que vai acontecer, e não o botão que confirma (regra 50, item 8). */
  readonly inicio: Ref<HTMLParagraphElement>
}

/**
 * O que a confirmação de `perigo` tem dentro da caixa: o texto, a falha, os dois botões e o envio único. Separado do `Dialogo`
 * para o passo "Revogar o acesso" do "Convidar alunos" viver dentro do diálogo que já está aberto, sem diálogo dentro de diálogo
 * (telas do professor, 13.0).
 */
export function CorpoDaConfirmacaoDePerigo({ texto, rotuloDaAcao, rotuloEmAndamento, acao, aoFechar, aoConcluir, aoTerminar, textosDaFalha, inicio }: PropsDoCorpoDaConfirmacao) {
  // Fecha com a lista já recarregada: o botão que abriu saiu com o item, e o foco vai para o `focoDeReserva`.
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: acao,
    onSuccess: async () => {
      await aoTerminar()
      aoConcluir()
    },
    onError: aoTerminar,
  })
  const falha = mutacao.isError ? textoDaFalha(mutacao.error, textosDaFalha) : undefined
  const mudou = mutacao.isError && listaMudou(mutacao.error, [ErrorCode.CONFLITO, ErrorCode.NAO_ENCONTRADO])
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4">
      <p ref={inicio} tabIndex={-1} className="break-words text-apoio">
        {texto}
      </p>
      {falha !== undefined && <AlertaDaFalha texto={falha} />}
      <div className="flex flex-wrap justify-end gap-3">
        {!mudou && (
          <button type="button" onClick={() => enviar(undefined)} disabled={mutacao.isPending} className={CLASSES_DO_BOTAO_PERIGO_CHEIO}>
            {mutacao.isPending ? rotuloEmAndamento : rotuloDaAcao}
          </button>
        )}
        <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
          {mudou ? 'Fechar' : 'Cancelar'}
        </button>
      </div>
      <span role="status" className="sr-only">
        {mutacao.isPending ? rotuloEmAndamento : ''}
      </span>
    </div>
  )
}

/**
 * A confirmação de `perigo` (excluir a turma, a disciplina, retirar o nome): o texto diz o que acontece e o que impede, o
 * foco começa nele e não no botão que exclui, e "Excluir" e "Cancelar" têm o mesmo tamanho (D59). A falha aparece aqui
 * dentro, com o foco nela; o `CONFLITO` e o `NAO_ENCONTRADO` recarregam a lista, e sobra só "Fechar".
 */
export function ConfirmacaoDePerigo({ titulo, focoDeReserva, ...corpo }: PropsDaConfirmacao) {
  const inicio = useRef<HTMLParagraphElement>(null)
  return (
    <Dialogo titulo={titulo} aoFechar={corpo.aoFechar} focoInicial={inicio} focoDeReserva={focoDeReserva}>
      <CorpoDaConfirmacaoDePerigo {...corpo} inicio={inicio} />
    </Dialogo>
  )
}
