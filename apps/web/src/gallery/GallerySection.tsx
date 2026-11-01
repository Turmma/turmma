import type { ReactNode } from 'react'
import { SectionHeader } from '../components/ui/Page'

/**
 * Um bloco da galeria: o título e a peça nos estados dela. O `data-galeria` é o nome que o e2e usa para achar o bloco
 * (`e2e/pecas-*.spec.ts`), e por isso não muda de nome quando a seção muda de arquivo.
 */
export function Secao({ nome, titulo, children }: { nome: string; titulo: string; children: ReactNode }) {
  return (
    <section data-galeria={nome} aria-label={titulo} className="flex min-w-0 flex-col gap-3">
      <SectionHeader titulo={titulo} />
      {children}
    </section>
  )
}
