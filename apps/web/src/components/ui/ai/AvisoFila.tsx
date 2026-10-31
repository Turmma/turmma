import { CircleAlert, Hourglass } from 'lucide-react'
import { Botao } from '../Botao'

interface PropsDoAviso {
  /** `demora`: a fila está cheia ou o modelo está lento, e a resposta ainda vai sair. `falha`: desta vez não saiu. */
  readonly situacao: 'demora' | 'falha'
  /** Só na `falha`: pedir de novo, com o mesmo pedido. */
  readonly aoTentarDeNovo?: () => void
}

/**
 * O que o aviso diz. **Não recebe a mensagem do erro**: fila cheia, provedor lento ou recusa do modelo viram estas duas
 * frases, e nenhum código, nome de provedor ou texto de exceção chega à conversa (regra 80, item 4; regra 20, item 11).
 * As palavras servem ao aluno de 11 anos e à professora.
 */
const TEXTO_DO_AVISO = {
  // Verdade sempre: com uma pessoa só e um modelo lento a geração também demora, e a tela não culpa quem não existe.
  demora: { titulo: 'Ainda preparando.', texto: 'Pode levar mais alguns segundos. Você não precisa pedir de novo.' },
  falha: { titulo: 'Não foi possível responder agora.', texto: 'Tente de novo em instantes.' },
} as const

/**
 * O aviso dentro da conversa quando a geração demora ou falha (`docs/interface.md` 11.3; 10.2, "degradação declarada").
 * **Nunca erro cru.**
 *
 * A demora é cinza (`info`) e é anunciada com calma (`status`): aviso não é alarme, e nada aqui pisca nem conta o tempo
 * (D59). A falha é `erro`, anunciada na hora (`alert`), e diz o que fazer, com o botão `secundario` ao lado. Os dois têm
 * a borda de 2 px; nenhum tem degrau, porque o aviso se lê e não se aperta.
 */
export function AvisoFila({ situacao, aoTentarDeNovo }: PropsDoAviso) {
  const falha = situacao === 'falha'
  const Icone = falha ? CircleAlert : Hourglass
  const { titulo, texto } = TEXTO_DO_AVISO[situacao]
  return (
    <div data-aviso-fila={situacao} className={`flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-controle border-2 p-3 ${falha ? 'border-vermelho-borda bg-erro-cx text-erro' : 'border-borda bg-info-cx text-info'}`}>
      <p role={falha ? 'alert' : 'status'} className="t-corpo flex min-w-0 flex-1 basis-56 items-start gap-2">
        <Icone aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words">
          <span className="font-bold">{titulo}</span> {texto}
        </span>
      </p>
      {falha && aoTentarDeNovo !== undefined && (
        <Botao variante="secundario" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Botao>
      )}
    </div>
  )
}
