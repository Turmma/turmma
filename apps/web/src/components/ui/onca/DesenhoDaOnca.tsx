import { Boca, DeclaracaoDaPinta, Focinho, Mascara, Olhos, ONCA, Orelha, Rosetas, useIdDoDesenho, type BocaDaOnca, type OlharDaOnca } from './CabecaOnca'
import { CORPO_D, OMBRO_D, OMBRO_E, ROSETAS } from './geometria'
import { useAcenarNaPrimeiraVez, type DonoDoAceno } from './movimento-da-onca'
import './Onca.css'

/**
 * As quatro poses da onça de corpo inteiro (`docs/interface.md` 9.7; D80, item 3). **Acolhendo** (a expressão de preocupação)
 * não entra, e **dormindo** (o vazio) ainda não tem lugar no produto: o tipo não as aceita.
 */
export const POSES = ['acenando', 'apontando', 'comemorando', 'pensando'] as const
export type Pose = (typeof POSES)[number]

/** As poses da introdução: acenando, apontando e pensando. A comemorando é só da `Comemoracao`, e o tipo já a recusa. */
export type PoseDaIntroducao = Exclude<Pose, 'comemorando'>

/** A largura do desenho, em px: 88 no celular e 120 no computador, 120 e 160 na comemoração (mockup 2.8) e 240 no cenário da marca (9.7). */
export type TamanhoDaOnca = 88 | 120 | 160 | 240

/** O quadro do desenho, em unidades: o do mockup, quadrado. O desenho é um quadrado de `tamanho` × `tamanho`. */
const QUADRO = 240

type Lado = 'e' | 'd'
/** A mão: 'creme' cai em cima do corpo; 'punho' é o círculo da cor da pata, com a almofada creme, quando o braço sai da silhueta. */
type Mao = 'creme' | 'punho'

interface Rabo {
  readonly d: string
  /** Onde o rabo termina: a ponta escura é um círculo ali. */
  readonly fim: readonly [number, number]
}

interface ConfigDaPose {
  /** Tudo menos a sombra do chão; o giro ou o deslocamento do corpo inteiro. */
  readonly figura?: string
  readonly rosto?: string
  readonly orelhaE?: string
  readonly orelhaD?: string
  readonly pataE?: string
  readonly pataD?: string
  /** O braço esticado de 26 × 64 (apontando). */
  readonly pataLonga?: boolean
  readonly maoE?: Mao
  readonly maoD?: Mao
  readonly peE?: string
  readonly peD?: string
  readonly sombraDoChao?: string
  /** O lado de trás do corpo em 3/4. */
  readonly ladoDeTras?: boolean
  readonly rabo: Rabo
  /** O rosto da pose: o olhar e a boca. Só `frente` e `w` são o neutro. */
  readonly olhar: OlharDaOnca
  readonly boca: BocaDaOnca
  /** O balão de três pontos da pose `pensando`. */
  readonly balao?: boolean
  /** As duas linhas curtas ao lado da pata que acena: traço parado, que só ajuda a ler o gesto. */
  readonly linhasDoAceno?: boolean
}

const giro = (angulo: number, ombro: { readonly x: number; readonly y: number }) => `rotate(${String(angulo)} ${String(ombro.x)} ${String(ombro.y)})`

const RABO_BASE: Rabo = { d: 'M196 196 C226 192 230 160 214 140', fim: [214, 140] }

/**
 * O que muda de uma pose para outra: o corpo — os braços, o rabo, os pés e a inclinação — **e o rosto**, que é o do mockup de
 * outubro: acenando e comemorando de boca aberta, apontando de lado e sorrindo, pensando com a pálpebra baixa. O rosto neutro
 * (de frente, com o "w") é o da cabeça do avatar. Cada rosto que não é o neutro é expressão nova (D80, item 3) e só entra pela
 * pose, nunca por quem usa. As medidas são as do mockup.
 */
const POSES_DO_CORPO: Readonly<Record<Pose, ConfigDaPose>> = {
  acenando: {
    figura: 'rotate(-4 120 220)',
    pataD: `translate(30 -16) ${giro(-150, OMBRO_D)}`,
    maoD: 'punho',
    peE: 'rotate(-15 98 213)',
    rabo: { d: 'M196 196 C230 190 234 140 214 124 C202 114 190 126 198 136', fim: [198, 136] },
    olhar: 'frente',
    boca: 'aberta',
    linhasDoAceno: true,
  },
  comemorando: {
    figura: 'translate(0 -10) scale(1 1.06)',
    sombraDoChao: 'translate(120 228) scale(.8 1) translate(-120 -228)',
    pataE: `translate(-30 -16) ${giro(150, OMBRO_E)}`,
    pataD: `translate(30 -16) ${giro(-150, OMBRO_D)}`,
    maoE: 'punho',
    maoD: 'punho',
    peE: 'translate(-4 4) rotate(-12 78 213)',
    peD: 'translate(4 4) rotate(12 162 213)',
    rabo: { d: 'M196 198 C232 196 204 160 226 138', fim: [226, 138] },
    olhar: 'feliz',
    boca: 'muito-aberta',
  },
  apontando: {
    rosto: 'translate(9 0)',
    orelhaE: 'translate(12 8)',
    orelhaD: 'translate(4 0)',
    pataD: `translate(14 -6) ${giro(-90, OMBRO_D)}`,
    pataLonga: true,
    maoD: 'punho',
    ladoDeTras: true,
    rabo: { d: 'M196 196 C224 196 226 170 216 152', fim: [216, 152] },
    olhar: 'lado',
    boca: 'sorriso',
  },
  pensando: {
    rosto: 'rotate(8 120 120)',
    orelhaE: 'rotate(8 120 120) translate(0 -2)',
    orelhaD: 'rotate(8 120 120) translate(0 4)',
    pataD: giro(116, OMBRO_D),
    maoD: 'creme',
    rabo: RABO_BASE,
    olhar: 'pensando',
    boca: 'lado',
    balao: true,
  },
}

function DesenhoDoRabo({ d, fim }: Rabo) {
  return (
    <g data-parte="rabo">
      <path d={d} fill="none" stroke={ONCA.pelagem} strokeWidth={16} strokeLinecap="round" />
      <path d={d} fill="none" stroke={ONCA.roseta} strokeWidth={16} strokeLinecap="butt" strokeDasharray="0 40 6 10 6 400" />
      <circle cx={fim[0]} cy={fim[1]} r={8} fill={ONCA.roseta} />
    </g>
  )
}

/** O lado de trás do corpo em 3/4 (apontando): a sombra recortada pelo contorno do corpo. */
function DesenhoDoLadoDeTras({ clip }: { readonly clip: string }) {
  return (
    <g clipPath={`url(#${clip})`}>
      <rect x={30} y={40} width={22} height={180} fill={ONCA.sombra} />
    </g>
  )
}

/** As classes do `svg`: `onca` e `onca-animada` ligam o `Onca.css`. */
function classesDoSvg(animada: boolean): string {
  return ['onca', animada ? 'onca-animada' : '', 'block shrink-0 overflow-visible'].filter(Boolean).join(' ')
}

/** O movimento do corpo ao aparecer: a comemoração salta, as outras poses entram; parada, nenhum. */
function movimentoDoCorpoNa(pose: Pose, animada: boolean): string | undefined {
  if (!animada) return undefined
  return pose === 'comemorando' ? 'onca-comemora' : 'onca-entra'
}

/** As duas linhas curtas ao lado da pata que acena (o `extra` do `acenando` no mockup): traço parado, sem animação. */
function DesenhoDasLinhasDoAceno() {
  return (
    <g data-parte="movimento" fill="none" stroke={ONCA.sombra} strokeWidth={5} strokeLinecap="round">
      <path d="M212 88 Q222 96 223 108" />
      <path d="M220 72 Q236 86 235 106" />
    </g>
  )
}

/** O balão da pose `pensando`: três pontos **parados** (nada em laço, D59). Sem texto. */
function DesenhoDoBalao() {
  return (
    <g data-parte="balao">
      <circle cx={182} cy={54} r={5} fill={ONCA.realce} />
      <rect x={178} y={14} width={58} height={30} rx={15} fill={ONCA.realce} />
      <g fill={ONCA.olho}>
        <circle cx={194} cy={29} r={4.5} />
        <circle cx={207} cy={29} r={4.5} />
        <circle cx={220} cy={29} r={4.5} />
      </g>
    </g>
  )
}

function DesenhoDaPata({ lado, transform, longa, mao, classe }: { readonly lado: Lado; readonly transform?: string | undefined; readonly longa?: boolean | undefined; readonly mao?: Mao | undefined; readonly classe?: string | undefined }) {
  const ombro = lado === 'e' ? OMBRO_E : OMBRO_D
  const altura = longa === true ? 64 : 54
  return (
    <g data-parte={`pata-${lado}`} transform={transform}>
      <g className={classe}>
        <rect x={ombro.x - 13} y={160} width={26} height={altura} rx={13} fill={ONCA.sombra} />
        {mao === 'creme' && <circle cx={ombro.x} cy={160 + altura - 12} r={14} fill={ONCA.creme} />}
        {mao === 'punho' && (
          <>
            <circle cx={ombro.x} cy={160 + altura - 12} r={16} fill={ONCA.sombra} />
            <circle cx={ombro.x} cy={160 + altura - 10} r={7} fill={ONCA.creme} />
          </>
        )}
      </g>
    </g>
  )
}

interface PropsDoDesenho {
  readonly pose: Pose
  readonly tamanho: TamanhoDaOnca
  /**
   * Os movimentos de `Onca.css`: entrar, acenar na primeira vez e saltar na comemoração, cada um uma vez. Ligados por padrão; `false` deixa a onça parada. Com "reduzir movimento" nenhum deles roda, qualquer que seja o valor (D59).
   */
  readonly animada: boolean
  /** De quem é o aceno que esta onça gasta: o do agente (`Onca`) ou o da marca (`OncaDaMarca`). Um não gasta o do outro. */
  readonly aceno: DonoDoAceno
}

/**
 * O desenho da onça de corpo inteiro (`docs/interface.md` 9.7; D80, item 3; regra 70, itens 4a e 4b): só o `svg`, **sem nome,
 * sem selo e sem figura**. É o animal do mockup de outubro, nas cores fixas da `CabecaOnca`, sem contorno nas formas nem degradê,
 * e nunca tem traço de pessoa. Quem o usa decide o que o cerca: a `Onca` o põe numa `figure` com o nome da função e o selo
 * "IA" (a saída de um agente), e a `OncaDaMarca` o põe numa `figure` escondida da leitura de tela (a onça da marca, que não é
 * saída de agente nenhum). O desenho é um só: não há segundo traço para a marca.
 *
 * - **Quatro poses, e o rosto é o da pose.** Nenhum rosto depende de quem usa: nem do acerto, do erro, do tempo de uso ou do
 *   assunto. Dois renders da mesma pose dão o mesmo desenho.
 * - **O movimento é do `Onca.css` e de `movimento-da-onca.ts`**, só quando `animada`: entrar (240 ms, uma vez), acenar (uma
 *   vez por sessão, e só enquanto a pose é `acenando`) e saltar na comemoração (uma vez). Nada disso roda com "reduzir
 *   movimento" (D59), nada fica em laço (os três pontos do `pensando` são parados), e o desenho em si não tem `animate`,
 *   `style` nem temporizador. O piscar por temporizador foi vetado pelo `conformidade-reviewer`.
 */
export function DesenhoDaOnca({ pose, tamanho, animada, aceno }: PropsDoDesenho) {
  const c = POSES_DO_CORPO[pose]
  const uid = useIdDoDesenho('onca')
  const pinta = `${uid}-pinta`
  const clip = `${uid}-corpo`
  const acena = useAcenarNaPrimeiraVez(animada && pose === 'acenando', aceno)
  const classeDoSvg = classesDoSvg(animada)
  const movimentoDoCorpo = movimentoDoCorpoNa(pose, animada)
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${String(QUADRO)} ${String(QUADRO)}`}
      aria-hidden="true"
      focusable="false"
      className={classeDoSvg}
    >
      <DeclaracaoDaPinta id={pinta} />
      <defs>
        <clipPath id={clip}>
          <path d={CORPO_D} />
        </clipPath>
      </defs>
      <g data-parte="sombra" transform={c.sombraDoChao}>
        <rect x={50} y={222} width={140} height={12} rx={6} className="fill-onca-chao" />
      </g>
      <g data-parte="corpo" transform={c.figura}>
        <g className={movimentoDoCorpo}>
          <DesenhoDoRabo {...c.rabo} />
          <g transform={c.orelhaE}>
            <Orelha lado="e" />
          </g>
          <g transform={c.orelhaD}>
            <Orelha lado="d" />
          </g>
          <path d={CORPO_D} fill={ONCA.pelagem} />
          {c.ladoDeTras === true && <DesenhoDoLadoDeTras clip={clip} />}
          <Rosetas pinta={pinta} clip={clip} lista={ROSETAS} />
          <g data-parte="barriga">
            <rect x={84} y={150} width={72} height={62} rx={30} fill={ONCA.creme} />
            <use href={`#${pinta}`} transform="translate(120 180) scale(.03)" fill={ONCA.pelagem} />
          </g>
          <g data-parte="rosto" data-rosto="" transform={c.rosto}>
            <Mascara />
            <Olhos uid={uid} tipo={c.olhar} />
            <Focinho />
            <Boca uid={uid} tipo={c.boca} />
          </g>
          <DesenhoDaPata lado="e" transform={c.pataE} mao={c.maoE} />
          <DesenhoDaPata lado="d" transform={c.pataD} longa={c.pataLonga} mao={c.maoD} classe={acena && pose === 'acenando' ? 'onca-acena' : undefined} />
          <g data-parte="pe-e" transform={c.peE}>
            <rect x={58} y={204} width={40} height={18} rx={9} fill={ONCA.creme} />
          </g>
          <g data-parte="pe-d" transform={c.peD}>
            <rect x={142} y={204} width={40} height={18} rx={9} fill={ONCA.creme} />
          </g>
          {c.balao === true && <DesenhoDoBalao />}
          {c.linhasDoAceno === true && <DesenhoDasLinhasDoAceno />}
        </g>
      </g>
    </svg>
  )
}
