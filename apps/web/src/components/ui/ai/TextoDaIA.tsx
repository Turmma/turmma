import type { Citacao } from '@educa/shared'
import { ChipFonte } from './ChipFonte'
import { Fontes } from './Fontes'
import { paragrafosDoTexto } from './ai-text'
import { fontesUnicas, type TitulosDosMateriais } from './source-labels'

interface PropsDoTextoDaIA {
  /** O texto que o modelo devolveu, como veio. */
  readonly texto: string
  /** As citações da mensagem (`citacoes[]` do contrato). Não têm posição no texto. */
  readonly citacoes: readonly Citacao[]
  readonly materiais: TitulosDosMateriais
}

/**
 * O texto de uma resposta da IA com as fontes dela: **um jeito só** de mostrar, igual no Assistente, no Tutor e no Seu
 * time (`docs/interface.md` 11.3). O contrato traz o texto e a lista de citações, sem dizer em que frase cada uma
 * entra; por isso os chips de página vêm **juntos, no fim da mensagem**, um por fonte, e embaixo deles a lista `Fontes`.
 * Pôr o chip no meio de uma frase seria a tela inventando de onde a frase saiu.
 *
 * **O texto do modelo entra como texto, nunca como HTML**: o React o escreve como nó de texto, e nada aqui usa
 * `dangerouslySetInnerHTML` nem interpreta Markdown. O que o modelo devolver com cara de marcação aparece escrito.
 */
export function TextoDaIA({ texto, citacoes, materiais }: PropsDoTextoDaIA) {
  const fontes = fontesUnicas(citacoes)
  return (
    <div data-texto-da-ia="" className="flex min-w-0 flex-col gap-3">
      {paragrafosDoTexto(texto).map((paragrafo, indice) => (
        // A ordem dos parágrafos de uma mensagem não muda: o índice é a chave.
        <p key={indice} className="min-w-0 break-words whitespace-pre-wrap">
          {paragrafo}
        </p>
      ))}
      {fontes.length > 0 && (
        <>
          <p className="flex min-w-0 flex-wrap items-center gap-1.5">
            {fontes.map((citacao) => (
              <ChipFonte key={`${citacao.materialId}-${String(citacao.pagina)}`} citacao={citacao} materiais={materiais} />
            ))}
          </p>
          <Fontes citacoes={citacoes} materiais={materiais} />
        </>
      )}
    </div>
  )
}
