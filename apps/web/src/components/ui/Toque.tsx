import { Check, type LucideIcon } from 'lucide-react'

interface Props {
  /** O que o toque escolhe, em texto: "Só as pendentes", "Matemática". É o nome dele para o leitor de tela. */
  readonly children: string
  /** Se está escolhido agora. A peça é controlada: quem usa decide o que `aoMudar` faz, e o grupo é de quem agrupa. */
  readonly selecionado: boolean
  /** Chamado com o valor novo (o contrário de `selecionado`), no clique, no toque, no Espaço e no Enter. */
  readonly aoMudar: (selecionado: boolean) => void
  /** Um glifo de 18 px antes do texto. Escolhido, o visto ocupa o lugar dele. */
  readonly icone?: LucideIcon
  /** Fora de uso: não troca, e o Tab passa por ele. O estado em que estava continua dito (`aria-pressed` e o visto). */
  readonly desligado?: boolean
}

/**
 * O botão de escolha da D80 (`docs/interface.md` 10.2): uma pílula que se liga e desliga, para **filtro e sugestão**. Não
 * é aba (a aba abre outro assunto, e é `Abas`), não é grupo de rádio e não é interruptor: o interruptor muda uma
 * configuração na hora, e o toque escolhe o que se vê ou o que se pede.
 *
 * - **`aria-pressed`** diz o estado, em botão comum: Espaço e Enter trocam, e o Tab entra uma vez em cada toque. Quem
 *   agrupa vários põe o `role="group"` com nome em volta, e o grupo é de quem usa.
 * - **O escolhido não é só cor**: leva o visto, a borda e o fundo da família azul, e o `aria-pressed`. O visto ocupa o
 *   lugar do `icone`; sem ícone, o toque cresce o espaço do visto.
 * - **Face de 40 px no computador e de 44 px abaixo de 768 px** (regra 50, item 2a), com o degrau de 3 px, que desce
 *   quando se aperta, no toque também. Desligado perde o degrau e a cor de ação, como os outros botões: face `borda`,
 *   texto `apoio`.
 */
export function Toque({ children, selecionado, aoMudar, icone: Icone, desligado = false }: Props) {
  const aspecto = selecionado
    ? 'border-azul-borda bg-azul-claro text-azul-texto degrau-azul'
    : 'border-borda bg-fundo text-apoio enabled:hover:bg-fundo-suave degrau-borda'
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      disabled={desligado}
      onClick={() => aoMudar(!selecionado)}
      className={`degrau inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-4 text-[15px] leading-5 font-bold [--altura-degrau:3px] md:min-h-10 disabled:cursor-not-allowed disabled:border-borda disabled:bg-borda disabled:text-apoio ${aspecto}`}
    >
      {selecionado ? (
        <Check aria-hidden="true" size={18} strokeWidth={3} className="shrink-0" />
      ) : (
        Icone !== undefined && <Icone aria-hidden="true" size={18} strokeWidth={2.5} className="shrink-0" />
      )}
      <span className="min-w-0 break-words">{children}</span>
    </button>
  )
}
