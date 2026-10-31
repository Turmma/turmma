import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  /** `radio` escolhe uma entre as de mesmo `nome`; `checkbox` marca e desmarca a própria. */
  readonly tipo: 'radio' | 'checkbox'
  /** O nome do grupo. Rádios de mesmo `nome` são um grupo: as setas trocam a marcada, e o Tab entra uma vez só. */
  readonly nome: string
  readonly valor: string
  /** O texto da opção, e o nome dela para o leitor de tela. */
  readonly rotulo: string
  readonly marcada: boolean
  /** Chamado com o estado novo, quando a pessoa troca. Num grupo de rádio só a que passou a estar marcada avisa. */
  readonly aoMudar: (marcada: boolean) => void
  /** Um desenho de 40 px à esquerda. Decoração: o nome da opção é o `rotulo`. */
  readonly icone?: ReactNode
  readonly desligada?: boolean
}

/**
 * A opção de um grupo de escolha (`docs/interface.md` 10.2): um `<label>` com o `<input>` nativo **dentro**, escondido só
 * da vista. O teclado é o do navegador, e por isso o grupo de rádio se comporta como o do sistema: setas, uma parada de
 * Tab, Espaço para marcar a caixa.
 *
 * - **O anel de foco é do rótulo**, por `focus-within`, e não do `<input>`, que é de 1 px: o contorno aparece em volta da
 *   opção inteira. Não usa `:has()`, que o Chromebook de laboratório (Chrome 109) não conhece
 * - **Marcada não é só cor**: leva a borda, o fundo e o texto da família azul e, à direita, o círculo com o visto; a
 *   desmarcada tem o círculo vazio com a borda `borda-campo`, de 3:1 contra o chão
 * - **Desligada** perde o degrau e a cor de ação, inclusive no círculo da que está marcada (o visto fica, em `apoio`), e
 *   não troca
 * - Mínimo de 64 px de altura: é alvo de toque com folga
 *
 * Quem usa a peça põe o `fieldset` e a `legend` em volta do grupo, porque só ela sabe a pergunta que as opções respondem.
 */
export function Opcao({ tipo, nome, valor, rotulo, marcada, aoMudar, icone, desligada = false }: Props) {
  const aspecto = desligada
    ? 'cursor-not-allowed border-borda bg-fundo-suave text-apoio'
    : marcada
      ? 'cursor-pointer border-azul-borda bg-azul-claro text-azul-texto degrau-azul'
      : 'cursor-pointer border-borda bg-fundo text-tinta hover:bg-fundo-suave degrau-borda'
  // Desligada, o círculo não leva a cor de ação nem marcada: o visto continua, em `apoio`, para dizer o estado.
  const circulo = desligada ? 'border-borda-campo bg-campo text-apoio' : marcada ? 'border-azul bg-azul text-sobre-cor' : 'border-borda-campo bg-campo'
  return (
    <label
      aria-disabled={desligada}
      className={`degrau relative flex min-h-16 min-w-0 items-center gap-3 rounded-controle border-2 px-3 py-2 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-foco ${aspecto}`}
    >
      <input type={tipo} name={nome} value={valor} checked={marcada} disabled={desligada} onChange={(evento) => aoMudar(evento.target.checked)} className="sr-only" />
      {icone !== undefined && (
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center">
          {icone}
        </span>
      )}
      <span className="t-cartao min-w-0 flex-1 break-words">{rotulo}</span>
      <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${circulo}`}>
        {marcada && <Check className="size-4" strokeWidth={3} />}
      </span>
    </label>
  )
}
