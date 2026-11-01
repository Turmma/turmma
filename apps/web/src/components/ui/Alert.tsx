import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Os quatro tons (`docs/interface.md` 10.2): informação (azul), atenção (amarelo), erro (vermelho) e certo (verde). */
export const ALERT_TONES = ['info', 'atencao', 'erro', 'certo'] as const
export type AlertTone = (typeof ALERT_TONES)[number]

/**
 * O desenho de cada tom: a borda e o fundo da família, o texto do glifo e **o glifo**, que é uma forma por tom (i,
 * triângulo, círculo com exclamação, visto). Os nomes são literais, tom por tom: o Tailwind não acha classe montada.
 */
const DESENHO_DO_TOM: Readonly<Record<AlertTone, { readonly caixa: string; readonly glifo: string; readonly Icone: LucideIcon }>> = {
  info: { caixa: 'border-azul-borda bg-azul-claro', glifo: 'text-azul-texto', Icone: Info },
  atencao: { caixa: 'border-amarelo-borda bg-amarelo-claro', glifo: 'text-amarelo-texto', Icone: TriangleAlert },
  erro: { caixa: 'border-vermelho-borda bg-vermelho-claro', glifo: 'text-vermelho-texto', Icone: CircleAlert },
  certo: { caixa: 'border-verde-borda bg-verde-claro', glifo: 'text-verde-texto', Icone: CircleCheck },
}

interface Props {
  readonly tom: AlertTone
  /** A frase que diz o que é, em `t-cartao`. Opcional: o aviso de uma linha só pode ser só o corpo. */
  readonly titulo?: string
  /** O corpo, em 15 px: o que aconteceu e o que fazer. */
  readonly children: ReactNode
  /** O que a pessoa pode fazer a respeito: um botão ou um link, embaixo do texto e fora da região de alerta. */
  readonly acao?: ReactNode
}

/**
 * O aviso da D80 (`docs/interface.md` 10.2): canto de 12, borda de 2 px na borda da família e fundo no claro dela, sem
 * degrau, com o glifo num círculo de 28 px.
 *
 * - **O tom nunca é só cor** (regra 50, item 11): cada um tem o seu glifo, e o texto diz o que houve. O corpo e o título
 *   são `tinta` (4,5:1 sobre cada fundo claro, nos dois temas); só o glifo leva o texto da família.
 * - **Só o erro é região viva** (`role="alert"`), e só o texto dele: o botão da `acao` fica fora, para o leitor de tela
 *   não anunciar o botão a cada vez que o erro aparece. Os outros três tons **não têm papel vivo**: o texto que já está
 *   na tela quando ela abre não precisa interromper ninguém, e o `status` do mockup nele é ruído (`mockup.md` 7.4).
 *   Quem quer que um aviso não-erro seja anunciado porque *acabou de aparecer* põe ele dentro de uma região viva sua.
 * - **Não fecha**: não tem botão de dispensar e não aceita um por prop. O aviso que some sozinho ou por clique é o que o
 *   aluno e o professor não leram.
 *
 * Os avisos escritos à mão nas telas (cerca de 30) não passam por aqui nesta tarefa: cada spec de área os recompõe.
 */
export function Alert({ tom, titulo, children, acao }: Props) {
  const { caixa, glifo, Icone } = DESENHO_DO_TOM[tom]
  return (
    <div data-aviso={tom} className={`flex min-w-0 items-start gap-3 rounded-controle border-2 px-4 py-3 ${caixa}`}>
      <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-fundo ${glifo}`}>
        <Icone size={16} strokeWidth={2.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div role={tom === 'erro' ? 'alert' : undefined} className="flex min-w-0 flex-col gap-1">
          {titulo !== undefined && <p className="t-cartao break-words text-tinta">{titulo}</p>}
          <div className="min-w-0 text-[15px] leading-[21px] font-medium break-words text-tinta">{children}</div>
        </div>
        {acao !== undefined && <div className="flex flex-wrap items-center gap-3">{acao}</div>}
      </div>
    </div>
  )
}
