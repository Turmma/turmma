import { OncaDaMarca } from './OncaDaMarca'

/**
 * O cenário da onça da marca (`docs/interface.md` 9.7, "O cenário da onça da marca"; D80 revista em 30/10/2026, às 21:45): um
 * canto de sala de aula, de 432 × 300 px, que a `CascaPublica` põe no centro do painel a partir de 1024 px. A onça de 240 px, a
 * mesma da `OncaDaMarca`, pisa numa pilha de três livros e acena; a lousa fica ao lado dela, e um vaso e um lápis completam o chão.
 *
 * - **Chapado e parado.** Sem contorno, degradê, filtro nem recorte, e sem estilo escrito na peça: o cenário é um SVG de formas e
 *   nada nele se mexe nem reage a cursor, foco ou digitação. Só a onça se mexe (entrar e acenar, uma vez, que param com "reduzir
 *   movimento"; D59)
 * - **Sem texto.** A lousa tem só triângulo, círculo e linha ondulada em giz. Nenhum `text`, `title`, `desc`, `role` nem
 *   `aria-label`; a `figure` é `aria-hidden` e o cenário não é saída de agente nenhum (regra 70, item 4a)
 * - **A onça não ensina.** Ela não segura nada, não aponta e não olha para a lousa, que fica ao lado e nunca atrás. As marcas
 *   de giz ficam à esquerda de x 168, longe da pata que acena (a partir de x 379)
 * - **Cor só por classe `fill-*` e `stroke-*`**, de tokens que não invertem entre os temas (a lista está na 9.7). Os livros não
 *   repetem o trio dos agentes nem as cores de estado
 * - **Só a `CascaPublica` a importa**, por `import()` tardio (`ia/avatar-so-nas-duas-pecas.test.ts`); no celular não há cenário
 *
 * O quadro do SVG tem a medida da figura (432 × 300), e a onça é posta por cima no quadro dela (x 184–424, y 0–240): a sombra
 * `onca-chao` do desenho cai em y 222–234, no livro de cima, que tem o topo em y 222.
 */
export function CenaDaOnca() {
  return (
    <figure data-cena-da-onca="" aria-hidden="true" className="relative m-0 h-75 w-108 max-w-full select-none">
      <svg width={432} height={300} viewBox="0 0 432 300" focusable="false" className="absolute inset-0 block overflow-visible">
        <rect x={208} y={288} width={192} height={12} rx={6} className="fill-onca-chao" />
        <g className="fill-laranja-degrau">
          <rect data-lousa="" x={0} y={40} width={168} height={160} rx={10} />
          <rect x={44} y={262} width={52} height={9} rx={3} />
          <path d="M49 271H91L86 298Q85 300 83 300H57Q55 300 54 298Z" />
        </g>
        <rect x={8} y={48} width={152} height={132} rx={5} className="fill-verde-degrau" />
        <g data-giz="" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="stroke-white">
          <path d="M26 112L50 72L74 112Z" />
          <circle cx={118} cy={92} r={20} />
          <path d="M24 152q14-18 28 0t28 0t28 0t28 0" />
        </g>
        <g className="fill-white">
          <rect x={30} y={188} width={22} height={5} rx={2} />
          <rect x={60} y={190} width={14} height={4} rx={2} />
        </g>
        <g className="fill-lima-degrau">
          <path d="M70 262C50 258 42 244 46 232C62 236 72 248 70 262Z" />
          <path d="M70 262C90 258 98 244 94 232C78 236 68 248 70 262Z" />
          <path d="M70 262C61 250 62 238 70 230C78 238 79 250 70 262Z" />
        </g>
        <g transform="rotate(-5 152 289)">
          <path d="M114 284H174L192 288.5L174 293H114Q112 293 112 291V286Q112 284 114 284Z" className="fill-amarelo-degrau" />
          <path d="M184 286.4L192 288.5L184 290.6Z" className="fill-white" />
        </g>
        <rect x={216} y={266} width={176} height={22} rx={5} data-livro="" className="fill-rosa-degrau" />
        <rect x={230} y={274} width={158} height={10} rx={3} className="fill-white" />
        <rect x={224} y={244} width={160} height={22} rx={5} data-livro="" className="fill-turquesa-degrau" />
        <rect x={228} y={252} width={142} height={10} rx={3} className="fill-white" />
        <rect x={232} y={222} width={144} height={22} rx={5} data-livro="" className="fill-roxo-degrau" />
        <rect x={246} y={230} width={126} height={10} rx={3} className="fill-white" />
      </svg>
      <div className="pointer-events-none absolute left-46 top-0">
        <OncaDaMarca tamanho={240} />
      </div>
    </figure>
  )
}
