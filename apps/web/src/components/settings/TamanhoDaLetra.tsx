import { useTextSize, type TextSize as TipoDaLetra } from '../../text-size'
import { OptionCard } from '../ui/fields/OptionCard'

const OPCOES: readonly { readonly valor: TipoDaLetra; readonly rotulo: string }[] = [
  { valor: 'padrao', rotulo: 'Padrão' },
  { valor: 'grande', rotulo: 'Grande' },
  { valor: 'maior', rotulo: 'Maior' },
]

/** O que o aluno lê para ver como a letra fica: o texto dele já está no tamanho escolhido, porque o tamanho é do `<html>`. */
export const TEXTO_DA_PREVIA = 'Assim fica a minha letra.'

/**
 * O tamanho da letra do aluno (telas do aluno e primeiro acesso, 8.0; RF11): Padrão, Grande ou Maior, em Eu › Ajustes. É um
 * grupo de rádio de `OptionCard` (setas trocam a escolha, uma parada só no Tab), com a prévia embaixo. Num grupo de rádio só a opção que passou
 * a estar marcada avisa (`OptionCard`), e por isso `aoMudar` escolhe sem conferir o estado.
 *
 * **Só a escolha grava** (`src/text-size.ts`): montar a peça, abrir o diálogo e entrar na área não escrevem nada, e escolher Padrão
 * apaga a chave. A escolha vale na hora, em toda a área do aluno, porque quem muda o tamanho é o `<html>`.
 *
 * Mora numa pasta própria: `components/` já está no teto de 25 arquivos de produção (`tools/guardas/tamanho-das-pastas.test.ts`).
 * Fora da entrada (`PECAS_FORA_DA_ENTRADA`): só a área do aluno e a galeria a baixam.
 */
export function TamanhoDaLetra() {
  const { letra, escolher } = useTextSize()
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="t-cartao mb-3">Tamanho da letra</legend>
      {OPCOES.map((opcao) => (
        <OptionCard key={opcao.valor} tipo="radio" nome="tamanho-da-letra" valor={opcao.valor} rotulo={opcao.rotulo} marcada={letra === opcao.valor} aoMudar={() => escolher(opcao.valor)} />
      ))}
      <p data-previa-da-letra="" className="t-corpo rounded-controle border-2 border-borda bg-fundo-suave px-3 py-2 break-words text-tinta">
        {TEXTO_DA_PREVIA}
      </p>
    </fieldset>
  )
}
