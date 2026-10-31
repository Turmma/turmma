import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { consultaIncidentes } from './api/privacidade'
import { Botao } from '../../../components/ui/Botao'
import { Dialogo } from '../../../components/ui/overlays/Dialogo'
import { useDialogoPrioritario } from '../../../components/ui/overlays/priority-dialog'
import { useConfirmarIncidente } from './confirmar-o-incidente'
import { DetalhesDoIncidente } from './DetalhesDoIncidente'
import { TEXTO_DO_QUE_CONFIRMAR_FAZ, textoDaFaixa, textoDaFila } from './textos-dos-incidentes'

/** O vão entre a faixa e a tela que vem depois dela: o `gap-6` do `main` da casca. */
const VAO_DA_FAIXA_PX = 24

/**
 * A faixa de depois do "Ver depois". Ela fica acima da tela, fora do miolo que rola, e por isso diz a altura que ocupa em
 * `--faixa-de-incidente` (`miolo-que-rola.ts`): o miolo encolhe por ela e a página continua sem rolar (RF23). A variável sai com a faixa.
 */
function FaixaDoIncidente({ pendentes, botao, aoVer }: { readonly pendentes: number; readonly botao: RefObject<HTMLButtonElement | null>; readonly aoVer: () => void }) {
  const faixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const elemento = faixa.current
    if (elemento === null) return
    const raiz = document.documentElement
    const medir = () => raiz.style.setProperty('--faixa-de-incidente', `${String(elemento.offsetHeight + VAO_DA_FAIXA_PX)}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => {
      observador.disconnect()
      raiz.style.removeProperty('--faixa-de-incidente')
    }
  }, [])
  return (
    <div ref={faixa} role="region" aria-label="Aviso de incidente de segurança" className="flex min-w-0 flex-wrap items-center gap-3 rounded-controle border border-pendente bg-pendente-cx p-3 text-pendente">
      <TriangleAlert aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
      <p className="min-w-0 flex-1 basis-60 break-words">{textoDaFaixa(pendentes)}</p>
      <Botao ref={botao} variante="secundario" onClick={aoVer}>
        Ver o aviso
      </Botao>
    </div>
  )
}

/**
 * Marca o diálogo do aviso como prioritário enquanto ele está na tela: o painel que abre pelo endereço espera por ele em vez de
 * abrir por cima (`components/ui/overlays/priority-dialog.ts`). É um filho do `Dialogo`: o efeito dos filhos roda antes do que abre o `dialog`.
 */
function PrioridadeDoAviso() {
  useDialogoPrioritario()
  return null
}

/**
 * O aviso de incidente da coordenação (F3, 10.0; RF9; Tech Spec do F3, seções 5 e 9). Vive na área da coordenação, e por isso
 * em toda tela dela: ao entrar, se algum incidente que afetou a escola ainda não teve o recebimento confirmado, um diálogo
 * mostra todos os campos do aviso, com "Confirmo que recebi" e "Ver depois".
 *
 * - **Uma leitura por sessão**: `staleTime: Infinity`. Voltar à aba do navegador ou andar entre telas não relê, e o aviso não
 *   aparece no meio de um trabalho; a leitura nova vem da sessão nova (o cache é esvaziado a cada entrada, `main.tsx`), da
 *   aba Incidentes, que sempre relê ao abrir, e de uma confirmação.
 * - **"Ver depois" não prende, e não esconde**: fecha o diálogo (o Esc faz o mesmo) e deixa uma faixa fixa, que não fecha, até
 *   a confirmação. O "Sair" da casca continua a um toque (D59; `docs/interface.md` 11.1). A faixa tem "Ver o aviso", que abre o
 *   diálogo de novo. Recusar nunca é mais difícil que aceitar: os dois botões têm o mesmo tamanho.
 * - **O adiamento vale enquanto a área da coordenação está montada**: sair, entrar de novo (a coordenação sempre passa pelo
 *   segundo fator, que é uma tela própria, e a área sai de cena) e trocar de escola desmontam a área, e o diálogo volta.
 *   Vários avisos viram um por vez, na ordem da lista.
 * - **O foco começa no texto**, e não no botão que confirma: um Enter a mais não confirma o que ninguém leu.
 * - Se a leitura falha, o aviso não aparece e a tela não quebra: a aba Incidentes tem o erro e o "Tentar de novo".
 *
 * Pessoa que não é da coordenação nunca chega aqui: a área só monta para o papel dela, e a API responde o inexistente aos
 * demais papéis (regra 10).
 */
export default function AvisoDeIncidente() {
  const consulta = useQuery({ ...consultaIncidentes, staleTime: Infinity })
  const [adiado, definirAdiado] = useState(false)
  const botaoDaFaixa = useRef<HTMLButtonElement>(null)
  const inicio = useRef<HTMLDivElement>(null)
  const idDaDescricao = useId()
  const { confirmar, confirmando, falha } = useConfirmarIncidente()
  // "Ver depois" e o Esc pedem o foco da faixa: o `Dialogo` devolve o foco a quem o tinha antes de abrir (o corpo da página, ao
  // entrar), e a faixa que acabou de nascer ficaria sem o foco de quem acabou de usar o teclado (regra 50, item 11).
  const focarAFaixa = useRef(false)
  function adiar(): void {
    focarAFaixa.current = true
    definirAdiado(true)
  }
  useEffect(() => {
    if (adiado && focarAFaixa.current) botaoDaFaixa.current?.focus()
    focarAFaixa.current = false
  }, [adiado])

  const pendentes = consulta.data?.incidentes.filter((incidente) => incidente.confirmadoEm === null) ?? []
  const atual = pendentes[0]
  const idDoAtual = atual?.id

  // O foco fica no começo do texto, e não no botão que confirma, mas sem rolar o diálogo até ele: o `div` do texto fica abaixo do
  // título e da frase que diz o que o aviso é, e `focus()` com rolagem os deixaria para fora da tela quando o aviso passa da
  // janela. Vale nos dois casos em que o diálogo muda de texto: o seguinte da fila, depois de confirmar o primeiro, e "Ver o
  // aviso", que monta o diálogo de novo com o mesmo texto (o `Dialogo` já focou com rolagem antes deste efeito rodar).
  useEffect(() => {
    const comeco = inicio.current
    if (comeco === null) return
    comeco.focus({ preventScroll: true })
    comeco.closest('dialog')?.scrollTo({ top: 0 })
  }, [idDoAtual, adiado])

  if (atual === undefined || consulta.data === undefined) return null
  const fila = textoDaFila(pendentes.length)

  if (adiado) {
    return <FaixaDoIncidente pendentes={pendentes.length} botao={botaoDaFaixa} aoVer={() => definirAdiado(false)} />
  }

  return (
    <Dialogo
      titulo="Aviso de incidente de segurança"
      aoFechar={adiar}
      focoInicial={inicio}
      papel="alertdialog"
      descritoPor={idDaDescricao}
    >
      <PrioridadeDoAviso />
      <div className="mt-4 flex min-w-0 flex-col gap-4">
        <p id={idDaDescricao} className="break-words text-apoio">
          A Turmma registrou um incidente de segurança que afetou dados desta escola. Leia o aviso e confirme que a coordenação o recebeu.
        </p>
        <div ref={inicio} tabIndex={-1} className="flex min-w-0 flex-col gap-3 focus-visible:outline-none">
          {fila !== undefined && <p className="font-medium break-words text-tinta">{fila}</p>}
          <DetalhesDoIncidente incidente={atual} />
          <p className="break-words text-apoio">{consulta.data.prazoLegal}</p>
        </div>
        <p className="rounded-controle border border-pendente bg-pendente-cx p-3 break-words text-pendente">{TEXTO_DO_QUE_CONFIRMAR_FAZ}</p>
        <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro empty:hidden">
          {falha?.id === atual.id ? falha.texto : ''}
        </p>
        <div className="flex flex-wrap gap-3">
          <Botao variante="oficial" disabled={confirmando !== undefined} onClick={() => void confirmar(atual.id)}>
            {confirmando === undefined ? 'Confirmo que recebi' : 'Confirmando…'}
          </Botao>
          <Botao variante="secundario" onClick={adiar}>
            Ver depois
          </Botao>
        </div>
        <span role="status" className="sr-only">
          {confirmando === undefined ? '' : 'Confirmando…'}
        </span>
      </div>
    </Dialogo>
  )
}
