import { TAMANHO_MAXIMO_DA_PERGUNTA_AO_TUTOR, TAMANHO_MAXIMO_DO_PEDIDO } from '@educa/shared'
import { ArrowUp, Square } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '../Button'
import { COARSE_POINTER, useMediaQuery } from '../media-query'
import { dicaDoEnter, podeEnviar, teclaEnvia, textoDoPedido, type PromptInputState } from './prompt-input'

type PromptInputProps = {
  /** O nome do campo para o leitor de tela: "Pedido ao Assistente de ensino", "Pergunta para o Tutor". */
  readonly rotulo: string
  /** O texto de exemplo do campo vazio: "Peça uma atividade, um plano de aula…". Fixo: não troca sozinho (D59). */
  readonly exemplo?: string
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  /** Recebe o texto já aparado. Limpar o campo depois de enviar é de quem usa, que é o dono do `valor`. */
  readonly aoEnviar: (texto: string) => void
  /** Com a resposta chegando (`gerando`), o enviar vira "Parar" e chama isto. */
  readonly aoParar?: () => void
  readonly estado?: PromptInputState
  /**
   * Quantos caracteres cabem. Sem ele, o tamanho que o contrato da API aceita (`@educa/shared`): o do pedido ao
   * Assistente na caixa completa, o da pergunta ao Tutor na de só texto. O campo não deixa passar disso, em vez de a
   * API recusar depois.
   */
  readonly maximo?: number
} & (
  | {
      /** A caixa do professor: a barra de baixo tem lugar para o que muda o pedido e para o contexto. */
      readonly variante?: 'completa'
      /** À esquerda, o que se acrescenta ao pedido: o `Menu` de ferramenta (D18). */
      readonly esquerda?: ReactNode
      /** À direita, o contexto: o seletor de turma, no lugar onde o ChatGPT põe o modelo (8.3). */
      readonly direita?: ReactNode
    }
  /** A caixa do aluno: **só texto e enviar**. Sem seletor, sem anexo (11.6): o tipo não deixa passar os encaixes. */
  | { readonly variante: 'so-texto'; readonly esquerda?: never; readonly direita?: never }
)

/** Até onde o campo cresce antes de rolar por dentro: 192 px, perto de oito linhas. */
const ALTURA_MAXIMA_DO_CAMPO = 192

/**
 * Ajusta a altura do campo ao que ele mostra, até o teto. O `scrollHeight` **não conta o texto de exemplo**: um exemplo
 * que quebra em duas linhas a 360 px ficaria cortado numa linha só. Com o campo vazio, a altura é a do **espelho**: um
 * campo igual, fora da tela, que tem o exemplo como valor. **O campo em uso nunca é escrito pela medida**: trocar o
 * valor de um campo por código apaga o histórico do desfazer do navegador, e quem apagou o pedido inteiro perderia o
 * Ctrl+Z.
 */
function ajustarAltura(campo: HTMLTextAreaElement, espelho: HTMLTextAreaElement | null): void {
  campo.style.height = 'auto'
  const altura = campo.value === '' && espelho !== null ? espelho.scrollHeight : campo.scrollHeight
  campo.style.height = `${String(Math.min(altura, ALTURA_MAXIMA_DO_CAMPO))}px`
}

/**
 * A caixa de pedido (`docs/interface.md` 11.2, 11.3 e 11.6): o campo de texto que cresce com o que se escreve, e a barra
 * com o enviar. Canto de 16 px e borda de 2 px, sem sombra (9.3); a borda é a `borda-campo`, e não a linha clara do
 * desenho: campo de formulário de escola precisa de 3:1 de contraste na borda (9.1).
 * - **O anel de foco é da caixa**, por `focus-within`, colado à borda (como o da `OptionCard`, 10.1), e o `textarea` de dentro não
 *   desenha o seu: o contorno global cairia nele, dentro da moldura, e não acompanharia a caixa que cresce com o texto. É
 *   o que o mockup faz (`input-bar.tsx`: a moldura reage ao foco, o campo não).
 * - **O exemplo do campo vazio cabe inteiro**: o campo mede o exemplo num espelho, e não cresce só com o que se digita
 *   (`ajustarAltura`).
 *
 * - **Com teclado, Enter envia e Shift+Enter quebra a linha**, e o Enter que confirma um acento não envia
 *   (`prompt-input.ts`). **Com o dedo, Enter quebra a linha e o envio é o botão**: no teclado virtual não há Shift+Enter.
 * - **O botão de enviar existe sempre**, com 44 px: quem está no toque não depende do Enter (regra 50, item 2a). É o
 *   `primario` da tela, o laranja (8.4, princípio 2), redondo e com o degrau de 3 px.
 * - **Enquanto a resposta chega, enviar vira "Parar"** (9.5, regra 5), e um segundo pedido não sai.
 * - **Sem texto, não envia**: só espaço não é pedido.
 * - **Enviar e parar devolvem o foco ao campo**: o botão acionado dá lugar ao outro, e o foco não cai no `body` (regra
 *   50, item 11).
 *
 * A caixa não se prende ao pé da tela sozinha: quem monta a conversa decide onde ela fica.
 */
export function PromptInput({ rotulo, exemplo, valor, aoMudar, aoEnviar, aoParar, estado = 'pronta', maximo, variante = 'completa', esquerda, direita }: PromptInputProps) {
  const campo = useRef<HTMLTextAreaElement>(null)
  const espelho = useRef<HTMLTextAreaElement>(null)
  const idDoCampo = useId()
  const idDaDica = useId()
  const soTexto = variante === 'so-texto'
  const ponteiroGrosso = useMediaQuery(COARSE_POINTER)

  // O campo cresce com o texto, até o teto, e encolhe de volta quando o texto é enviado ou apagado.
  useLayoutEffect(() => {
    if (campo.current !== null) ajustarAltura(campo.current, espelho.current)
  }, [valor, exemplo])

  // A largura do campo muda (a lateral recolhe, o aparelho gira): o exemplo quebra em outro lugar, e o campo vazio o mede
  // de novo. Quem se observa é o espelho, e não a caixa: o espelho não muda de altura com o campo, e assim o ajuste
  // não provoca nova observação no mesmo quadro.
  useEffect(() => {
    const medido = espelho.current
    if (medido === null || typeof ResizeObserver === 'undefined') return
    let largura = medido.clientWidth
    const observador = new ResizeObserver(() => {
      if (medido.clientWidth === largura) return
      largura = medido.clientWidth
      if (campo.current !== null) ajustarAltura(campo.current, medido)
    })
    observador.observe(medido)
    return () => observador.disconnect()
  }, [exemplo])

  function enviar(): void {
    const texto = textoDoPedido(valor)
    if (estado !== 'pronta' || texto === undefined) return
    aoEnviar(texto)
    // O enviar vai dar lugar ao "Parar": o foco volta para o campo antes de o botão sumir.
    campo.current?.focus()
  }

  function parar(): void {
    aoParar?.()
    campo.current?.focus()
  }

  function aoSubmeter(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    enviar()
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>): void {
    if (!teclaEnvia({ key: evento.key, shiftKey: evento.shiftKey, isComposing: evento.nativeEvent.isComposing }, ponteiroGrosso)) return
    evento.preventDefault()
    enviar()
  }

  // As chaves fazem do "Parar" e do enviar dois botões, e não um que troca de tipo: sem elas o React reaproveitaria o
  // mesmo `button`, que viraria `submit` no meio do clique em "Parar", e o clique enviaria o pedido seguinte.
  const botao =
    estado === 'gerando' && aoParar !== undefined ? (
      <Button key="parar" variante="secundario" onClick={parar} className="shrink-0">
        <Square aria-hidden="true" size={14} strokeWidth={2.4} className="shrink-0" />
        Parar
      </Button>
    ) : (
      <Button key="enviar" type="submit" tamanho="icone" aria-label="Enviar" disabled={!podeEnviar(valor, estado)}>
        <ArrowUp aria-hidden="true" size={20} strokeWidth={2} />
      </Button>
    )

  const campoDeTexto = (
    <textarea
      ref={campo}
      id={idDoCampo}
      rows={1}
      value={valor}
      disabled={estado === 'desligada'}
      {...(exemplo === undefined ? {} : { placeholder: exemplo })}
      aria-describedby={idDaDica}
      maxLength={maximo ?? (soTexto ? TAMANHO_MAXIMO_DA_PERGUNTA_AO_TUTOR : TAMANHO_MAXIMO_DO_PEDIDO)}
      // A tecla do teclado virtual diz o que ela faz: com o dedo é quebra de linha, e não "enviar".
      enterKeyHint={ponteiroGrosso ? 'enter' : 'send'}
      onChange={(evento) => aoMudar(evento.target.value)}
      onKeyDown={aoTeclar}
      className="t-corpo block max-h-48 min-h-11 w-full min-w-0 resize-none rounded-controle bg-campo px-3 py-2.5 text-tinta outline-none disabled:bg-fundo-suave disabled:text-apoio"
    />
  )

  // O campo e o espelho dividem a largura: o espelho é do tamanho do campo, fora do fluxo, e só existe para medir o exemplo.
  const entrada = (
    <div className={soTexto ? 'relative min-w-0 flex-1' : 'relative min-w-0'}>
      {campoDeTexto}
      {exemplo !== undefined && (
        <textarea
          ref={espelho}
          aria-hidden="true"
          tabIndex={-1}
          readOnly
          rows={1}
          value={exemplo}
          data-espelho-do-exemplo=""
          className="t-corpo pointer-events-none invisible absolute inset-x-0 top-0 block min-h-11 w-full min-w-0 resize-none px-3 py-2.5"
        />
      )}
    </div>
  )

  return (
    <form onSubmit={aoSubmeter} data-caixa-pedido={variante} className="flex min-w-0 flex-col gap-1 rounded-caixa border-2 border-borda-campo bg-campo p-2 focus-within:outline-3 focus-within:outline-offset-0 focus-within:outline-solid focus-within:outline-foco">
      <label htmlFor={idDoCampo} className="sr-only">
        {rotulo}
      </label>
      <span id={idDaDica} className="sr-only">
        {dicaDoEnter(ponteiroGrosso)}
      </span>
      {soTexto ? (
        <div className="flex min-w-0 items-end gap-2">
          {entrada}
          {botao}
        </div>
      ) : (
        <>
          {entrada}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {esquerda !== undefined && <div className="flex min-w-0 flex-wrap items-center gap-2">{esquerda}</div>}
            <div className="ml-auto flex min-w-0 items-center gap-2">
              {direita}
              {botao}
            </div>
          </div>
        </>
      )}
    </form>
  )
}
