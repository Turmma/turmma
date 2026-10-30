import { NOMES_DOS_AGENTES, type Agente } from '@educa/shared'
import { SeloIA } from '../ia/AssinaturaIA'
import { DesenhoDaOnca, POSES, type Pose, type PoseDaIntroducao, type TamanhoDaOnca } from './DesenhoDaOnca'

export { POSES }
export type { Pose, PoseDaIntroducao, TamanhoDaOnca }

interface PropsDaOnca {
  readonly pose: Pose
  /** Quem a onça é na tela: a função dele assina embaixo (D17, D58). */
  readonly agente: Agente
  readonly tamanho: TamanhoDaOnca
  /**
   * Os movimentos de `Onca.css`: entrar, acenar na primeira vez e saltar na comemoração, cada um uma vez. Ligados por padrão; `false` deixa a onça parada. Com "reduzir movimento" nenhum deles roda, qualquer que seja o valor (D59).
   */
  readonly animada?: boolean
}

/**
 * A onça de corpo inteiro **assinada** (`docs/interface.md` 9.7; D80, item 3; regra 70, itens 4a e 4b): o desenho de
 * `DesenhoDaOnca`, na mesma `figure` do nome da função e do selo "IA". O desenho, as quatro poses e o movimento estão lá.
 *
 * - **Sempre assinada.** O nome acessível é a função: "onça" não é o nome de agente nenhum (D17, D58). Por isso só a
 *   `Introducao`, a `Comemoracao`, as introduções de cada papel e o vazio de Criados (`TELAS_COM_A_ONCA`) a importam
 *   (`ia/avatar-so-nas-duas-pecas.test.ts`). Em tela, ela só entra onde a região guarda produção daquele agente (9.7).
 *   A onça **sem** assinatura é a `OncaDaMarca`, que só a casca pública importa e que nunca é saída de agente.
 * - **`comemorando` é da `Comemoracao`.** Só ela a desenha, depois do envio confirmado (RF8, RF19).
 */
export function Onca({ pose, agente, tamanho, animada = true }: PropsDaOnca) {
  const funcao = NOMES_DOS_AGENTES[agente]
  return (
    <figure data-onca="" data-pose={pose} className="m-0 flex min-w-0 flex-col items-center gap-2">
      <DesenhoDaOnca pose={pose} tamanho={tamanho} animada={animada} aceno="agente" />
      <figcaption data-onca-assinatura="" className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="text-[15px] leading-5 font-bold break-words text-tinta">{funcao}</span>
        <SeloIA />
      </figcaption>
    </figure>
  )
}
