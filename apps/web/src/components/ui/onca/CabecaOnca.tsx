import { useId } from 'react'
import { CABECA_D, PINTA_PATH, ROSETAS, type Roseta } from './geometria'

/**
 * As cores da onça (`docs/interface.md` 9.7): **fixas nos dois temas**. A onça é a mesma no claro e no escuro, e por isso não
 * lê token: é o único desenho do produto, com o QR, que escreve cor à mão (`ARQUIVOS_COM_COR_EM_LINHA`, em `estilos.test.ts`).
 * São as nove do desenho do mockup de outubro. A língua (`#FF9FB0`) é só da boca aberta, que a cabeça do avatar não tem. A sombra
 * do chão não é da onça, é do cenário: o token `onca-chao`.
 */
export const ONCA = {
  pelagem: '#E8732E',
  sombra: '#D75F18',
  realce: '#ED935D',
  creme: '#FDEBDD',
  roseta: '#7A3412',
  pupila: '#16233E',
  olho: '#FFFFFF',
  nariz: '#E5838C',
  lingua: '#FF9FB0',
} as const

/** Os tamanhos do avatar, em px: 24 na linha da mensagem, 32 na assinatura, 40 e 48 no cabeçalho (9.7). */
export type TamanhoDaCabeca = 24 | 32 | 40 | 48

/** O recorte da cabeça no quadro de 240: as orelhas inteiras, e a máscara chega a 9 unidades das bordas. */
const RECORTE_DA_CABECA = '44 32 152 152'

/** Abaixo de 40 px a roseta da testa sai: vira ruído (a regra do avatar do mockup). */
const MENOR_TAMANHO_COM_ROSETA = 40

/** Um id que serve de `id` de SVG: o do React tem `:` ou `«»`, que o `url(#…)` não aceita. */
export function useIdDoDesenho(prefixo: string): string {
  return prefixo + useId().replace(/[^a-zA-Z0-9-]/g, '')
}

/** As rosetas: a pinta da marca girada, recortada pelo contorno de `clip`. A pinta (`pinta`) é declarada uma vez por desenho. */
export function Rosetas({ pinta, clip, lista }: { readonly pinta: string; readonly clip: string; readonly lista: readonly Roseta[] }) {
  return (
    <g clipPath={`url(#${clip})`} fill={ONCA.roseta}>
      {lista.map((p) => (
        <use key={`${String(p.x)}-${String(p.y)}`} href={`#${pinta}`} transform={`translate(${String(p.x)} ${String(p.y)}) rotate(${String(p.r)}) scale(${String(p.s)})`} />
      ))}
    </g>
  )
}

/** Orelhas: círculo de r 22 com miolo de r 11, metade atrás da cabeça. */
export function Orelha({ lado }: { readonly lado: 'e' | 'd' }) {
  const cx = lado === 'e' ? 68 : 172
  return (
    <g data-parte={`orelha-${lado}`}>
      <circle cx={cx} cy={58} r={22} fill={ONCA.pelagem} />
      <circle cx={cx} cy={58} r={11} fill={ONCA.realce} />
    </g>
  )
}

/** Máscara clara: dois círculos de r 38. */
export function Mascara() {
  return (
    <>
      <circle cx={91} cy={110} r={38} fill={ONCA.realce} />
      <circle cx={149} cy={110} r={38} fill={ONCA.realce} />
    </>
  )
}

/**
 * O olhar de cada expressão. A cabeça do avatar tem só `frente`. As outras são as que o mockup usa nas poses do corpo inteiro:
 * `lado` (apontando), `cima` e `pensando` (pensando) e `feliz` (comemorando). Cada uma é expressão nova (D80, item 3) e
 * só entra pela pose que a pede (`Onca.tsx`).
 */
export type OlharDaOnca = 'frente' | 'cima' | 'lado' | 'feliz' | 'pensando'
/** A boca de cada expressão: o "w" é a neutra. `aberta`, `muito-aberta` e `sorriso` são de acenando, comemorando e apontando. */
export type BocaDaOnca = 'w' | 'aberta' | 'muito-aberta' | 'lado' | 'sorriso'

/** O olho esquerdo é 2 px menor, como no Duo. */
const OLHO = {
  e: { x: 71, y: 86, w: 38, h: 48 },
  d: { x: 130, y: 85, w: 40, h: 50 },
} as const

/** Onde fica a pupila em cada olhar: [x, y, largura, altura] para o olho esquerdo e o direito. */
const PUPILA = {
  frente: { e: [82, 99, 24, 32], d: [134, 99, 25, 33] },
  cima: { e: [84, 86, 24, 30], d: [144, 85, 25, 31] },
  lado: { e: [85, 97, 24, 32], d: [145, 97, 25, 33] },
} as const

function Olho({ lado, uid, olhar, palpebraBaixa }: { readonly lado: 'e' | 'd'; readonly uid: string; readonly olhar: keyof typeof PUPILA; readonly palpebraBaixa: boolean }) {
  const o = OLHO[lado]
  const [px, py, pw, ph] = PUPILA[olhar][lado]
  const clip = `${uid}-olho-${lado}`
  /* A pálpebra não é uma peça por cima (deixaria um fio branco na borda): é o recorte do próprio olho, a abertura que sobra
     embaixo da linha dela. */
  const abertura = palpebraBaixa ? `M${String(o.x - 4)} ${String(o.y + o.h * 0.22)} H${String(o.x + o.w + 4)} V${String(o.y + o.h + 4)} H${String(o.x - 4)} Z` : null
  const olho = (
    <g data-parte={`olho-${lado}`}>
      <rect x={o.x} y={o.y} width={o.w} height={o.h} rx={o.w / 2} fill={ONCA.olho} />
      <g clipPath={`url(#${clip})`}>
        <rect data-parte="pupila" x={px} y={py} width={pw} height={ph} rx={pw / 2} fill={ONCA.pupila} />
        <circle cx={px + pw * 0.28} cy={py + ph * 0.24} r={5} fill={ONCA.olho} />
      </g>
    </g>
  )
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} rx={o.w / 2} />
        </clipPath>
        {abertura !== null && (
          <clipPath id={`${clip}-abre`}>
            <path d={abertura} />
          </clipPath>
        )}
      </defs>
      {abertura === null ? olho : <g clipPath={`url(#${clip}-abre)`}>{olho}</g>}
    </>
  )
}

/**
 * Os dois olhos. De frente é o neutro, e o único da cabeça do avatar. Fechados em alegria viram um arco de traço redondo, sem
 * branco. No "pensando" só o olho direito leva a pálpebra baixa, como no mockup. Os olhos não piscam: o piscar por
 * temporizador foi vetado (D59).
 */
export function Olhos({ uid, tipo = 'frente' }: { readonly uid: string; readonly tipo?: OlharDaOnca }) {
  if (tipo === 'feliz') {
    const arco = (d: string) => <path d={d} fill="none" stroke={ONCA.pupila} strokeWidth={8} strokeLinecap="round" />
    return (
      <g data-parte="olhos">
        {arco('M76 116 Q90 96 104 116')}
        {arco('M136 116 Q150 96 164 116')}
      </g>
    )
  }
  const olhar = tipo === 'cima' || tipo === 'pensando' ? 'cima' : tipo === 'lado' ? 'lado' : 'frente'
  return (
    <g data-parte="olhos">
      <Olho lado="e" uid={uid} olhar={olhar} palpebraBaixa={false} />
      <Olho lado="d" uid={uid} olhar={olhar} palpebraBaixa={tipo === 'pensando'} />
    </g>
  )
}

/** O focinho creme e o nariz (um triângulo arredondado de 22 × 13). */
export function Focinho() {
  return (
    <>
      <rect x={98} y={128} width={44} height={30} rx={15} fill={ONCA.creme} />
      <path d="M111 130 H129 Q134 130 131 134 L123 141 Q120 144 117 141 L109 134 Q106 130 111 130 Z" fill={ONCA.nariz} />
    </>
  )
}

const TRACO_DA_BOCA = {
  w: 'M110 147 Q115 152 120 146 Q125 152 130 147',
  lado: 'M121 150 Q127 152 131 147',
  sorriso: 'M111 147 Q122 155 133 145',
} as const

/**
 * A boca. A neutra é o "w" pequeno de quem olha de frente. A aberta só existe em alegria, com língua e nunca dente: é a de
 * acenando e a de comemorando, e entra pela pose, não por quem usa.
 */
export function Boca({ tipo = 'w', uid }: { readonly tipo?: BocaDaOnca; readonly uid: string }) {
  if (tipo === 'aberta' || tipo === 'muito-aberta') {
    const aberta = tipo === 'aberta'
    const d = aberta ? 'M109 146 Q121 150 133 145 Q133 158 122 160 Q110 160 109 146 Z' : 'M104 145 Q120 151 137 145 Q137 168 121 169 Q104 168 104 145 Z'
    const clip = `${uid}-boca`
    return (
      <g data-parte="boca">
        <defs>
          <clipPath id={clip}>
            <path d={d} />
          </clipPath>
        </defs>
        <path d={d} fill={ONCA.pupila} />
        <g clipPath={`url(#${clip})`}>
          <circle cx={aberta ? 124 : 121} cy={aberta ? 164 : 172} r={aberta ? 9 : 13} fill={ONCA.lingua} />
        </g>
      </g>
    )
  }
  return (
    <g data-parte="boca">
      <path d={TRACO_DA_BOCA[tipo]} fill="none" stroke={ONCA.pupila} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** A declaração da pinta da marca, uma vez por desenho: as rosetas e a barriga a repetem por `<use>`. */
export function DeclaracaoDaPinta({ id }: { readonly id: string }) {
  return (
    <defs>
      <path id={id} fillRule="evenodd" d={PINTA_PATH} />
    </defs>
  )
}

interface PropsDaCabecaOnca {
  readonly tamanho: TamanhoDaCabeca
}

/**
 * A cabeça da onça: **um desenho só, com uma expressão neutra, parado** (`docs/interface.md` 9.7; D80, item 3). É a cabeça
 * do desenho do mockup de outubro, recortada de perto: as orelhas, o topo do corpo (`CABECA_D`), a roseta da testa, a
 * máscara, os olhos de frente, o focinho e a boca em "w". Só formas chapadas, sem contorno e sem degradê; o único traço é a boca.
 *
 * É a peça mais restrita do produto, de propósito (D58; Decreto 12.880, art. 11; regra 70, itens 4a e 4b):
 *
 * - **Só `tamanho`.** Não há pose, "pensando", humor nem expressão que mude com quem usa: nem com a presença ou a ausência,
 *   nem com o acerto, o erro, o tempo de uso ou o assunto da conversa. O tamanho só decide se a roseta da testa aparece
 *   (a partir de 40 px).
 * - **Parada.** Nenhum `animate`, transição, temporizador nem efeito: ela é desenho, e o que a faria viva não existe aqui.
 * - **Sem nome e sem texto.** `aria-hidden`, sem `<title>` nem `<desc>`: "onça" não é o nome de agente nenhum. Quem
 *   assina é a função, ao lado (`AgentSignature`).
 *
 * Quem a desenha é só o `AgentAvatar`, que a põe num círculo com o anel do agente (a cadeia fechada é um teste:
 * `components/ui/ai/avatar-so-nas-duas-pecas.test.ts`). O SVG preenche a caixa em que está: o círculo e o recuo são do avatar.
 */
export function CabecaOnca({ tamanho }: PropsDaCabecaOnca) {
  const uid = useIdDoDesenho('cab')
  const pinta = `${uid}-pinta`
  const clip = `${uid}-corpo`
  return (
    <svg width={tamanho} height={tamanho} viewBox={RECORTE_DA_CABECA} aria-hidden="true" focusable="false" className="block size-full shrink-0 overflow-visible">
      <DeclaracaoDaPinta id={pinta} />
      <defs>
        <clipPath id={clip}>
          <path d={CABECA_D} />
        </clipPath>
      </defs>
      <Orelha lado="e" />
      <Orelha lado="d" />
      <path d={CABECA_D} fill={ONCA.pelagem} />
      {tamanho >= MENOR_TAMANHO_COM_ROSETA && <Rosetas pinta={pinta} clip={clip} lista={ROSETAS.slice(0, 1)} />}
      <g data-rosto="">
        <Mascara />
        <Olhos uid={uid} />
        <Focinho />
        <Boca uid={uid} />
      </g>
    </svg>
  )
}
