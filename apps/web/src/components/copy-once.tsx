import { useEffect, useId, useRef, useState, type Ref, type RefObject } from 'react'
import { Button } from './ui/Button'
import { SECONDARY_BUTTON_CLASSES } from './ui/button-variants'
import { copiarLink } from './link-do-convite'
import { FIELD_BOX } from './ui/fields/field-styles'

/**
 * As peças do diálogo cujo link aparece uma vez só: a pergunta antes de fechar sem copiar, a cópia e o que é dito dela, o
 * campo de leitura do link, a falha com o foco nela, e o foco que acompanha a etapa. Nasceram no diálogo do convite (A0b,
 * 7.0; A1, 14.0) e saíram dele na 15.0, com o acesso da turma do professor usando as mesmas: o link da sala e o código
 * também aparecem uma vez (regra 20, item 8). Cada diálogo monta as etapas dele com estas peças
 * (`DialogoDoConvite.tsx`, `areas/professor/turmas/acesso/AcessoDaTurma.tsx`).
 */

/** O que a área de transferência fez, dito no `role="status"` de dentro do diálogo. */
const TEXTO_DO_LINK_COPIADO = 'Link copiado.'
const TEXTO_DO_LINK_SELECIONADO = 'O link está selecionado no campo. Copie com Ctrl+C, ou toque e segure no campo e escolha Copiar.'

/** O que a cópia diz quando copia e quando só consegue selecionar o campo do link. */
export interface DitosDaCopia {
  readonly copiado: string
  readonly selecionado: string
}

const DITOS_DO_LINK: DitosDaCopia = { copiado: TEXTO_DO_LINK_COPIADO, selecionado: TEXTO_DO_LINK_SELECIONADO }

/**
 * Fechar o diálogo que tem, ou vai ter, um link que ninguém copiou. Com o link em risco — o pedido no ar, ou o link na
 * tela sem cópia confirmada —, o primeiro pedido de fechar (o botão, o Esc ou o toque fora) mostra a pergunta; o segundo,
 * feito na pergunta, fecha. Sem link em risco, fecha na hora.
 *
 * Fechar de vez solta a mutação (`reset()`): o token sai do diálogo e, com o `gcTime: 0` das mutações que o trazem, do
 * cache na mesma hora (regra 20, item 8).
 */
export function useFechamento(linkEmRisco: boolean, soltar: () => void, aoFechar: () => void) {
  const [perguntando, definirPerguntando] = useState(false)
  // A pergunta só vale enquanto há link em risco. O pedido que falha com ela aberta leva o diálogo de volta à etapa
  // dele, com a falha à vista: a pergunta diria que há um link, e "Fechar sem copiar" esconderia a recusa.
  if (perguntando && !linkEmRisco) definirPerguntando(false)
  function fecharDeVez(): void {
    soltar()
    aoFechar()
  }
  function pedirParaFechar(): void {
    if (!linkEmRisco || perguntando) fecharDeVez()
    else definirPerguntando(true)
  }
  return { perguntando, pedirParaFechar, fecharDeVez, voltar: () => definirPerguntando(false) }
}

/** A pergunta antes de fechar sem o link copiado. Voltar e "Fechar sem copiar" do mesmo tamanho (D59). */
export function Pergunta({
  titulo,
  texto,
  rotuloDeVoltar,
  aoVoltar,
  aoFecharDeVez,
}: {
  titulo: RefObject<HTMLHeadingElement | null>
  /** O que se perde ao fechar agora, e como se consegue outro: muda com o que o diálogo gera, e com o pedido ainda no ar. */
  texto: string
  /** "Voltar ao convite", "Voltar ao acesso". */
  rotuloDeVoltar: string
  aoVoltar: () => void
  aoFecharDeVez: () => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <h3 ref={titulo} tabIndex={-1} className="t-cartao">
        Fechar sem copiar o link?
      </h3>
      <p className="text-apoio">{texto}</p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={aoVoltar}>{rotuloDeVoltar}</Button>
        <button type="button" onClick={aoFecharDeVez} className={SECONDARY_BUTTON_CLASSES}>
          Fechar sem copiar
        </button>
      </div>
    </div>
  )
}

/**
 * A cópia do link e o que foi dito dela: vazio, "Link copiado." ou o pedido de copiar à mão. `copiado` é o link que já
 * saiu do diálogo pela mão da pessoa: daí em diante, fechar não pergunta.
 */
export function useCopia() {
  const [copiado, definirCopiado] = useState(false)
  const [dito, definirDito] = useState({ texto: '', vez: 0 })
  // Cada vez é um nó novo na região, e o leitor de tela anuncia de novo o "Link copiado." da segunda cópia.
  const dizer = (texto: string) => definirDito((anterior) => ({ texto, vez: anterior.vez + 1 }))
  /** O link saiu do diálogo: copiado, ou mandado por outro caminho que o diálogo oferece. */
  function saiu(texto: string): void {
    definirCopiado(true)
    dizer(texto)
  }
  /**
   * Copia o texto (o link, ou o convite inteiro) e diz o que aconteceu. Sem área de transferência, o campo do link fica
   * selecionado, e a tela pede a cópia à mão: nada foi copiado, e fechar continua perguntando.
   */
  async function copiar(texto: string, campo: HTMLInputElement | null, ditos: DitosDaCopia = DITOS_DO_LINK): Promise<void> {
    // Sem contexto seguro não há `navigator.clipboard`, embora o tipo diga que sempre há.
    const area: Clipboard | undefined = navigator.clipboard
    if ((await copiarLink(texto, area)) === 'copiado') {
      saiu(ditos.copiado)
      return
    }
    campo?.focus()
    campo?.select()
    dizer(ditos.selecionado)
  }
  return { copiado, texto: dito.texto, vez: dito.vez, copiar, copiadoAMao: () => saiu(TEXTO_DO_LINK_COPIADO), saiu }
}

/**
 * O link, uma vez, num campo de leitura que se seleciona inteiro ao receber o foco. A cópia feita à mão no campo (Ctrl+C,
 * ou o menu do toque) também conta, pelo evento `copy`. A caixa é a do `FormField` (`field-styles.ts`: borda de 2 px em
 * `borda-campo`, fundo `campo`, 48 px), para o campo de leitura e o de escrita não se parecerem com peças diferentes.
 */
export function CampoDoLink({ rotulo, link, aoCopiarAMao, ref }: { rotulo: string; link: string; aoCopiarAMao: () => void; ref: Ref<HTMLInputElement> }) {
  const idDoCampo = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idDoCampo} className="t-apoio font-bold text-tinta">
        {rotulo}
      </label>
      <input
        ref={ref}
        id={idDoCampo}
        type="text"
        readOnly
        value={link}
        autoComplete="off"
        spellCheck={false}
        onFocus={(evento) => evento.currentTarget.select()}
        onCopy={aoCopiarAMao}
        className={`min-h-12 w-full min-w-0 px-3.5 py-2 t-corpo ${FIELD_BOX}`}
      />
    </div>
  )
}

/**
 * O que foi dito da cópia. Sempre na árvore, mesmo vazio: a região que aparece junto com o texto nem sempre é anunciada.
 * A altura fica reservada, e o texto chega sem empurrar os botões.
 */
export function AvisoDaCopia({ texto, vez, copiado }: { texto: string; vez: number; copiado: boolean }) {
  return (
    <p role="status" className={`min-h-6 text-sm ${copiado ? 'text-ok' : 'text-apoio'}`}>
      <span key={vez}>{texto}</span>
    </p>
  )
}

/**
 * A falha de um pedido, com o foco nela: o botão que o fez pode sumir (a lista mudou, e só sobra "Fechar") ou estar
 * desligado, e o foco não fica solto no diálogo. O alerta é lido pelo `role="alert"` de qualquer jeito.
 */
export function Falha({ texto, erro }: { texto: string; erro: unknown }) {
  const alerta = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    alerta.current?.focus()
  }, [erro])
  return (
    <p ref={alerta} tabIndex={-1} role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
      {texto}
    </p>
  )
}

/**
 * O foco que acompanha a etapa: a pergunta, o link, ou o começo da etapa a que se voltou. Quando a etapa volta por causa
 * de uma falha (o pedido recusado com a pergunta de fechar aberta), o foco é do alerta da falha, e não do começo da etapa.
 *
 * Na abertura, quem põe o foco é o diálogo (`focoInicial`, depois do `showModal`) e este gancho espera a primeira mudança de
 * etapa. O diálogo de passos (`ConvidarAlunos`) não tem um alvo só na abertura, e por isso pede `daPrimeira`: o foco do passo
 * em que ele abriu também é daqui, e roda depois do `showModal`, porque o efeito do filho vem antes do do pai.
 */
export function useFocoDaEtapa(etapa: string, alvo: RefObject<HTMLElement | null>, comFalha: boolean, daPrimeira = false): void {
  const primeira = useRef(!daPrimeira)
  // A falha desta renderização, para o efeito da etapa: ele só roda quando a etapa muda.
  const falhou = useRef(comFalha)
  useEffect(() => {
    falhou.current = comFalha
  }, [comFalha])
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    if (!falhou.current) alvo.current?.focus()
  }, [etapa, alvo])
}
