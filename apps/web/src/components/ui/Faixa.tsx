import { Info, type LucideIcon } from 'lucide-react'

interface PropsDaFaixa {
  /** O aviso, numa frase: "Seu professor acompanha como você usa o Tutor." */
  readonly children: string
  readonly icone?: LucideIcon
}

/**
 * A faixa fixa de aviso, em família `info` (`docs/interface.md` 9.1 e 10.2): cinza, porque aviso não é alarme, com a borda
 * de 2 px das peças da D80. **Não fecha**, e por isso não tem botão nem aceita um: o aluno não dispensa o aviso de que o
 * professor acompanha o Tutor (D8; regra 70, item 4). É uma nota, não um alerta: não interrompe o leitor de tela a cada
 * tela que abre, e por isso é `role="note"` e nunca uma região viva.
 *
 * Não é o `Aviso`: o aviso tem tom (informação, atenção, erro, certo) e título. A faixa é um aviso permanente, de uma
 * frase, e só existe em `info`.
 */
export function Faixa({ children, icone: Icone = Info }: PropsDaFaixa) {
  return (
    <p role="note" className="t-apoio flex min-w-0 items-start gap-2 rounded-controle border-2 border-borda bg-info-cx px-4 py-3 text-info">
      <Icone aria-hidden="true" size={20} strokeWidth={2} className="shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}
