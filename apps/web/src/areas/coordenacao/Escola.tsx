import type { ReactNode } from 'react'
import { COORDENACAO_ROUTES } from '../../paths'
import { TabbedPage, type TabbedPageTab } from './comum/moldura'

/**
 * As abas de Escola, na ordem em que a coordenação monta a escola (D80; Tech Spec da X2, seção 5): Turmas, Professores e
 * Material, cada uma no endereço que já tinha (`/estrutura`, `/professores`, `/material`). O caminho é relativo à área.
 */
export const ABAS_DE_ESCOLA = [
  { id: 'turmas', rotulo: 'Turmas', caminho: COORDENACAO_ROUTES.estrutura },
  { id: 'professores', rotulo: 'Professores', caminho: COORDENACAO_ROUTES.professores },
  { id: 'material', rotulo: 'Material', caminho: COORDENACAO_ROUTES.material },
] as const satisfies readonly TabbedPageTab[]

export type AbaDeEscola = (typeof ABAS_DE_ESCOLA)[number]['id']

/** A aba do navegador de cada uma: "Escola: turmas". */
const TITULO_DA_ABA: Readonly<Record<AbaDeEscola, string>> = {
  turmas: 'Escola: turmas',
  professores: 'Escola: professores',
  material: 'Escola: material',
}

/** A moldura de Escola: o título, as três abas e, dentro, a tela da aba do endereço (X2, 3.0). */
export default function Escola({ aba, children }: { readonly aba: AbaDeEscola; readonly children: ReactNode }) {
  return (
    <TabbedPage titulo="Escola" tituloDaAba={TITULO_DA_ABA[aba]} rotuloDasAbas="Seções de Escola" abas={ABAS_DE_ESCOLA} ativa={aba}>
      {children}
    </TabbedPage>
  )
}
