import type { Agente } from '@educa/shared'
import { CabecaOnca } from '../onca/CabecaOnca'

/**
 * O anel de cada agente (`docs/interface.md` 9.7): a cor dele no produto inteiro. Quem conversa com o professor é azul, o
 * Tutor é laranja, e o Analista, que só avisa a coordenação, é anil. O mapa é literal, nome por nome: o Tailwind só gera a
 * classe que acha escrita por inteiro.
 */
const ANEL_DO_AGENTE: Readonly<Record<Agente, string>> = {
  assistente_de_ensino: 'border-azul',
  tutor: 'border-laranja',
  analista_de_desempenho_escolar: 'border-anil',
}

/** 24 px na linha da mensagem, 32 px na assinatura, 40 e 48 px no cabeçalho de uma conversa e no cartão de agente. */
const CAIXA_DO_AVATAR = {
  24: 'size-6',
  32: 'size-8',
  40: 'size-10',
  48: 'size-12',
} as const

/**
 * Onde a cabeça fica dentro do círculo, nas medidas do avatar do mockup: a cabeça (com as orelhas) recua 3 px da borda em 24 px
 * e 4 px a partir de 32 (senão o rosto some no anel), e desce 6% do tamanho, para o rosto ficar no meio. Em px contados do
 * miolo, que já descontou o anel de 2 px: o recuo menos 2, mais a descida. O mapa é literal, nome por nome: o Tailwind só gera a
 * classe que acha escrita por inteiro.
 */
const LUGAR_DA_CABECA = {
  24: 'top-[2.44px] left-px size-[18px]',
  32: 'top-[3.92px] left-0.5 size-6',
  40: 'top-[4.4px] left-0.5 size-8',
  48: 'top-[4.88px] left-0.5 size-10',
} as const
export type TamanhoDoAvatar = keyof typeof CAIXA_DO_AVATAR

interface PropsDoAvatar {
  readonly agente: Agente
  readonly tamanho?: TamanhoDoAvatar
}

/**
 * O avatar do agente: **a cabeça da onça num círculo `fundo`, com o anel de 2 px na cor do agente** (D80, item 3), recuada
 * do anel como no mockup. A onça
 * é animal, nunca pessoa — sem rosto de gente, sem foto, sem nome próprio (D17, D58; Decreto 12.880, art. 11) — e o agente
 * tem identidade de função: quem assina é o nome dela, ao lado.
 *
 * **As props são só `agente` e `tamanho`**, e o desenho não muda com quem usa: nenhuma pose, nenhum "pensando", nenhum
 * ponto de "online" (D59). É enfeite para o leitor de tela (`aria-hidden`): o avatar nunca é a única identificação.
 *
 * **Quem o desenha é só a `AssinaturaIA`** (e o balão da `MensagemIA`, que a usa), e é por isso que ele nunca aparece sem
 * o nome da função e o selo "IA" no mesmo bloco: `ia/avatar-so-nas-duas-pecas.test.ts` reprova outro arquivo que o importe.
 */
export function AvatarAgente({ agente, tamanho = 24 }: PropsDoAvatar) {
  return (
    <span
      aria-hidden="true"
      data-agente={agente}
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full border-2 bg-fundo ${ANEL_DO_AGENTE[agente]} ${CAIXA_DO_AVATAR[tamanho]}`}
    >
      <span className={`absolute block ${LUGAR_DA_CABECA[tamanho]}`}>
        <CabecaOnca tamanho={tamanho} />
      </span>
    </span>
  )
}
