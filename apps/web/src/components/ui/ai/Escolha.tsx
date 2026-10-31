import { Check, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

export interface OpcaoDeEscolha {
  readonly id: string
  /** O que a opção faz: "Usar a ferramenta Atividade". */
  readonly titulo: string
  /** A consequência, numa frase: "Salva na biblioteca, liga à turma e cita a página." */
  readonly descricao: string
  readonly icone: LucideIcon
}

interface PropsDaEscolha {
  /** A frase do Assistente: "Posso fazer isso com a ferramenta Atividade, ou só conversar." */
  readonly pergunta: string
  /** **Duas** opções, pelo tipo: é a pergunta da D18, e não um menu. */
  readonly opcoes: readonly [OpcaoDeEscolha, OpcaoDeEscolha]
  /** O id da opção escolhida. Com ele, o cartão encolhe para uma linha. */
  readonly escolhida?: string | undefined
  readonly aoEscolher: (id: string) => void
  /** A escolha já saiu e a resposta não chegou: as duas opções desligam juntas, e um segundo clique não escolhe de novo. */
  readonly desligada?: boolean
}

/**
 * O desenho de uma opção. **É uma constante só, para as duas**: nenhuma tem estilo de primária. É o do botão
 * `secundario` (borda de 2 px, face `superficie` e o degrau `borda`, que desce quando se aperta), e desligada perde o degrau e
 * fica na face `borda` com o texto `apoio`, como todo botão desligado (`docs/interface.md` 10.2).
 */
const CLASSES_DA_OPCAO =
  'degrau degrau-borda flex min-h-11 w-full min-w-0 cursor-pointer items-start gap-3 rounded-controle border-2 border-borda bg-superficie p-3 text-left text-tinta enabled:hover:bg-fundo-suave disabled:cursor-not-allowed disabled:border-borda disabled:bg-borda disabled:text-apoio'

/**
 * A pergunta da D18 — "quer usar a ferramenta?" — dentro da conversa (`docs/interface.md` 11.3; P16): uma frase do
 * Assistente e um cartão estreito com **duas opções do mesmo peso**, cada uma com ícone, título e uma frase.
 *
 * **Nenhuma das duas é a "certa"** (D59): as duas têm o mesmo desenho (o do botão `secundario`), o mesmo tamanho — a
 * grade dá a mesma largura e a mesma altura às duas, lado a lado ou empilhadas — e nenhuma vem marcada, destacada nem
 * com o foco. Um clique escolhe: não há "selecionar e depois enviar".
 *
 * Depois da escolha o cartão **encolhe para uma linha** que diz o que foi escolhido, e não deixa escolher de novo: a
 * conversa segue dali. O botão que tinha o foco some com o cartão, e por isso **o foco vai para a linha**: quem escolheu
 * pelo teclado continua de onde estava, e o leitor de tela lê o que ficou escolhido (regra 50, item 11). Só quando a
 * escolha foi feita aqui: a conversa antiga que abre com a escolha já feita não puxa o foco de ninguém.
 */
export function Escolha({ pergunta, opcoes, escolhida, aoEscolher, desligada = false }: PropsDaEscolha) {
  const idDaPergunta = useId()
  const linha = useRef<HTMLParagraphElement>(null)
  // Alguém escolheu neste cartão, e a linha ainda não recebeu o foco.
  const escolheuAqui = useRef(false)
  const feita = opcoes.find((opcao) => opcao.id === escolhida)
  const idDaFeita = feita?.id
  useEffect(() => {
    if (idDaFeita === undefined || !escolheuAqui.current) return
    escolheuAqui.current = false
    linha.current?.focus()
  }, [idDaFeita])

  function escolher(id: string): void {
    escolheuAqui.current = true
    aoEscolher(id)
  }

  if (feita !== undefined)
    return (
      <p ref={linha} tabIndex={-1} data-escolha="feita" className="t-apoio inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border-2 border-borda bg-fundo-suave px-3 py-1 text-apoio">
        <Check aria-hidden="true" size={14} strokeWidth={2.4} className="shrink-0" />
        <span className="min-w-0 break-words">
          Você escolheu: <span className="font-bold text-tinta">{feita.titulo}</span>
        </span>
      </p>
    )
  return (
    <div role="group" aria-labelledby={idDaPergunta} data-escolha="aberta" className="flex w-full max-w-[520px] min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-3">
      <p id={idDaPergunta} className="t-corpo px-1 break-words text-tinta">
        {pergunta}
      </p>
      <div className="grid auto-rows-fr grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {opcoes.map((opcao) => {
          const Icone = opcao.icone
          return (
            <button key={opcao.id} type="button" disabled={desligada} onClick={() => escolher(opcao.id)} className={CLASSES_DA_OPCAO}>
              <Icone aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="t-cartao break-words">{opcao.titulo}</span>
                <span className={`t-apoio break-words ${desligada ? '' : 'text-sutil'}`}>{opcao.descricao}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
