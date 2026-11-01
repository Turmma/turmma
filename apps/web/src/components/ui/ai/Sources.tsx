import type { Citacao } from '@educa/shared'
import { ChevronRight, FileText } from 'lucide-react'
import { fontesUnicas, resumoDasFontes, textoDoChip, tituloDoMaterial, type TitulosDosMateriais } from './source-labels'

interface SourcesProps {
  /** Todas as citações da resposta, como vieram: a repetição da mesma página some aqui. */
  readonly citacoes: readonly Citacao[]
  readonly materiais: TitulosDosMateriais
}

/**
 * A lista de fontes no fim da resposta, recolhida (`docs/interface.md` 11.3): "Fontes (3): Química 2, p. 142 · p. 145 ·
 * p. 151". A linha já diz as páginas sem abrir nada; aberta, cada fonte mostra o material, a página e o trecho.
 *
 * É o `details` do navegador: abre e fecha por clique, toque, Enter e Espaço sem uma linha de JavaScript, e o leitor de
 * tela já sabe dizer se está aberto. Resposta sem citação não tem lista de fontes: a linha "Fontes (0)" pareceria uma
 * fonte que sumiu.
 */
export function Sources({ citacoes, materiais }: SourcesProps) {
  const unicas = fontesUnicas(citacoes)
  if (unicas.length === 0) return null
  return (
    <details className="group min-w-0">
      <summary className="t-apoio flex min-h-11 min-w-0 cursor-pointer list-none items-center gap-1.5 rounded-linha px-1.5 text-apoio hover:bg-fundo-suave">
        <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 group-open:rotate-90" />
        <span className="min-w-0 break-words">{resumoDasFontes(citacoes, materiais)}</span>
      </summary>
      <ul className="mt-1.5 flex min-w-0 flex-col gap-1.5">
        {unicas.map((citacao) => (
          <li key={`${citacao.materialId}-${String(citacao.pagina)}`} className="t-apoio flex min-w-0 gap-2.5 rounded-controle border-2 border-borda bg-ia-cx px-3 py-2 text-ia">
            <FileText aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="font-bold break-words text-tinta">
                {tituloDoMaterial(citacao.materialId, materiais)}, {textoDoChip(citacao.pagina)}
              </span>
              <span className="break-words">“{citacao.trecho}”</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
