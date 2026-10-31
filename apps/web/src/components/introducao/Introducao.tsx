import type { Agente } from '@educa/shared'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { classesDoBotao } from '../ui/button-variants'
import { Onca, type PoseDaIntroducao } from '../ui/onca/Onca'
import { Balao } from './Balao'
import { TelaDeFoco } from './TelaDeFoco'

export interface PassoDaIntroducao {
  /** Só acenando ou apontando: a `comemorando` é da `Comemoracao`, e a introdução termina com a onça parada. */
  readonly pose: PoseDaIntroducao
  /** O texto fixo do passo, escrito em `.ts` com teste: é o `h1`. */
  readonly fala: string
  readonly conteudo?: ReactNode
  /** Passo que a primeira entrada não deixa pular (um aviso). Revendo, nenhum passo é obrigatório. */
  readonly obrigatorio: boolean
}

interface PropsDaIntroducao {
  readonly passos: readonly PassoDaIntroducao[]
  /** Quem fala: a função assina embaixo da onça. */
  readonly agente: Agente
  /** A introdução já foi vista: todo passo ganha "Fechar", e nenhum é obrigatório. */
  readonly revendo?: boolean
  /** O último "Continuar". Quem chama grava que a introdução foi vista e leva a pessoa à tela de abertura. */
  readonly aoConcluir: () => void
  /** "Pular" ou "Fechar" (e Esc, que é "Fechar"). Quem chama decide o que grava: na primeira vez "Pular" marca como vista, e revendo não há o que mudar. */
  readonly aoPular: () => void
  /** Leva o foco à fala já na abertura. A galeria, que mostra a peça no meio de outras, desliga. */
  readonly focarNaAbertura?: boolean
}

/** Alvo do Enter que já tem ação própria: o botão, o link e o campo cuidam dele. */
const TEM_ENTER_PROPRIO = 'button, a[href], input, textarea, select, summary, [role="button"], [contenteditable="true"]'

/**
 * A introdução passo a passo (RF3, RF13, RF16, RF19; mockup 2.8): a onça, a fala como `h1`, o conteúdo do passo e, no pé,
 * "Continuar" e "Pular". Cabe numa `TelaDeFoco`, e quem a monta é a introdução de cada papel.
 *
 * - **Seguir e pular são o mesmo botão**: a mesma classe, o mesmo tamanho e o mesmo peso (RF16, D59).
 * - **O passo obrigatório não se pula**: sem "Pular", sem "Fechar" e o Esc não sai. Revendo, todo passo fecha.
 * - **Teclado**: a fala recebe o foco a cada passo e o leitor de tela ouve "Passo N de M"; Enter continua (menos quando o
 *   foco está num botão ou campo, que já o usam, e segurar a tecla avança um passo só); Esc fecha, quando pode.
 * - **Parada**: a onça acena ou aponta e não se mexe, sem temporizador. Nada de pontos, sequência, meta nem aviso.
 */
export function Introducao({ passos, agente, revendo = false, aoConcluir, aoPular, focarNaAbertura = true }: PropsDaIntroducao) {
  const [indice, definirIndice] = useState(0)
  const fala = useRef<HTMLHeadingElement>(null)
  const idDoPasso = useId()
  const passo = passos[indice]
  const ultimo = indice === passos.length - 1
  const podePular = passo !== undefined && !passo.obrigatorio && !revendo
  const podeFechar = revendo

  // O foco vai à fala a cada passo. No primeiro só quando a peça é a tela inteira (não há passo anterior a voltar).
  useEffect(() => {
    if (indice === 0 && !focarNaAbertura) return
    fala.current?.focus()
  }, [indice, focarNaAbertura])

  function continuar(): void {
    if (ultimo) aoConcluir()
    else definirIndice((anterior) => anterior + 1)
  }

  // Os atalhos ficam no documento: com o foco no corpo da página (um clique no vazio), Enter e Esc continuam valendo. O
  // efeito refaz a assinatura quando o passo ou o que quem chama passou muda: assim nunca fala com um passo antigo.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent): void {
      if (evento.defaultPrevented) return
      if (evento.key === 'Enter' && !evento.repeat) {
        const alvo = evento.target instanceof Element ? evento.target : null
        if (alvo?.closest(TEM_ENTER_PROPRIO)) return
        if (ultimo) aoConcluir()
        else definirIndice((anterior) => anterior + 1)
      }
      if (evento.key === 'Escape' && podeFechar) aoPular()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [ultimo, podeFechar, aoConcluir, aoPular])

  if (passo === undefined) return null
  const classe = classesDoBotao({ variante: 'secundario' })
  return (
    <TelaDeFoco
      passo={indice + 1}
      total={passos.length}
      idDoPasso={idDoPasso}
      {...(podeFechar ? { aoFechar: aoPular } : {})}
      rodape={
        <>
          <button type="button" onClick={continuar} className={`${classe} flex-1`}>
            Continuar
          </button>
          {podePular && (
            <button type="button" onClick={aoPular} className={`${classe} flex-1`}>
              Pular
            </button>
          )}
        </>
      }
    >
      <Onca pose={passo.pose} agente={agente} tamanho={120} />
      <Balao fala={passo.fala} refDaFala={fala} descritoPor={idDoPasso} />
      {passo.conteudo}
    </TelaDeFoco>
  )
}
