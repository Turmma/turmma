import { DesenhoDaOnca } from './DesenhoDaOnca'

/** A largura da onça da marca, em px: 240 no cenário do painel do computador e 88 acima do formulário no celular (`docs/interface.md` 9.7, 11.3). */
export type TamanhoDaOncaDaMarca = 88 | 160 | 240

interface PropsDaOncaDaMarca {
  readonly tamanho: TamanhoDaOncaDaMarca
  /** O computador anima (entrar e acenar, uma vez cada); o celular fica parado. Com "reduzir movimento" nenhum movimento roda (D59). */
  readonly animada?: boolean
}

/**
 * A onça da marca (`docs/interface.md` 9.7, "A onça da marca"; D80 revista em 30/10/2026): o animal da `Onca`, na pose
 * `acenando`, **sem legenda**. Ela cumprimenta quem chega à tela de entrada e não é a saída de nenhum agente, por isso não
 * tem nome de função, selo "IA" nem nome acessível: a `figure` é `aria-hidden`, e o "Turmma" da marca, ao lado, já diz onde
 * a pessoa está (regra 70, item 4a: o agente nunca se passa por pessoa, e a marca nunca se passa por agente).
 *
 * - **O desenho é o de `DesenhoDaOnca`**, o mesmo da `Onca`, sem segundo traço. A pose é uma só e não é prop.
 * - **O atributo é `data-onca-da-marca`, e não `data-onca`**: `data-onca` é da onça assinada, a que um agente produziu, e um
 *   seletor ou teste que conte `[data-onca]` como produção de agente não pode contar a da marca.
 * - **O aceno é da marca**: a memória de "já acenou" é separada da do agente (`movimento-da-onca.ts`). A entrada leva à
 *   introdução do papel sem recarregar a página, e a onça da introdução ainda acena depois da da entrada.
 * - **Sem laço.** O movimento é só o que já existe: entrar (240 ms) e acenar uma vez por sessão da página; os dois param com
 *   "reduzir movimento". Nada de piscar, respirar ou balançar o rabo (D59).
 * - **Só a `CascaPublica` a importa**, e por `import()` tardio (`ia/avatar-so-nas-duas-pecas.test.ts`): a entrada não leva a
 *   onça para o primeiro carregamento.
 */
export function OncaDaMarca({ tamanho, animada = true }: PropsDaOncaDaMarca) {
  return (
    <figure data-onca-da-marca="" data-pose="acenando" aria-hidden="true" className="m-0 flex shrink-0">
      <DesenhoDaOnca pose="acenando" tamanho={tamanho} animada={animada} aceno="marca" />
    </figure>
  )
}
