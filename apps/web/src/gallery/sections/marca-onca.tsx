import { AgentSignature, type TamanhoDoAvatar } from '../../components/ui/ai/AgentSignature'
import { AIMessage, ThinkingIndicator } from '../../components/ui/ai/Message'
import { Secao } from '../GallerySection'

/** Os quatro tamanhos do avatar (`docs/interface.md` 9.7): a linha da mensagem, a assinatura e o cabeçalho. */
const TAMANHOS: readonly TamanhoDoAvatar[] = [24, 32, 40, 48]
const AGENTES = ['assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar'] as const

/**
 * A onça, vista como o produto a mostra (`docs/interface.md` 9.7; D80, item 3): a cabeça no círculo com o anel do agente,
 * **sempre com o nome da função e o selo "IA" ao lado**. A seção só usa a `AgentSignature` e a `AIMessage`, que são as duas
 * peças que desenham o avatar: o avatar sozinho não existe, nem aqui. A onça de corpo inteiro é da introdução e da comemoração.
 */
export default function SecoesDaMarcaOnca() {
  return (
    <Secao nome="marca-onca" titulo="Avatar dos agentes">
      {TAMANHOS.map((tamanho) => (
        <div key={tamanho} data-tamanho={tamanho} className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
          {AGENTES.map((agente) => (
            <AgentSignature key={agente} agente={agente} tamanho={tamanho} />
          ))}
        </div>
      ))}
      <div data-onca-na-mensagem="" className="flex min-w-0 flex-col gap-4">
        <AIMessage agente="tutor">Vamos por partes: o que você já sabe sobre a equação balanceada?</AIMessage>
        <AIMessage variante="balao" agente="assistente_de_ensino">
          Corrigi as 32 atividades da turma e separei os casos fora da curva para você abrir primeiro. O diagnóstico só chega aos alunos
          depois que você revisar os destaques e aprovar o lote.
        </AIMessage>
        <ThinkingIndicator agente="analista_de_desempenho_escolar" />
      </div>
    </Secao>
  )
}
