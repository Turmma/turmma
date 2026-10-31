import type { ReactNode } from 'react'
import { ROTAS_DA_COORDENACAO } from '../../paths'
import { Moldura, type AbaDaMoldura } from './comum/moldura'

/**
 * As abas de Escola, na ordem em que a coordenação monta a escola (D80; Tech Spec da X2, seção 5): Turmas, Professores e
 * Material, cada uma no endereço que já tinha (`/estrutura`, `/professores`, `/material`). O caminho é relativo à área.
 */
export const ABAS_DE_ESCOLA = [
  { id: 'turmas', rotulo: 'Turmas', caminho: ROTAS_DA_COORDENACAO.estrutura },
  { id: 'professores', rotulo: 'Professores', caminho: ROTAS_DA_COORDENACAO.professores },
  { id: 'material', rotulo: 'Material', caminho: ROTAS_DA_COORDENACAO.material },
] as const satisfies readonly AbaDaMoldura[]

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
    <Moldura titulo="Escola" tituloDaAba={TITULO_DA_ABA[aba]} rotuloDasAbas="Seções de Escola" abas={ABAS_DE_ESCOLA} ativa={aba}>
      {children}
    </Moldura>
  )
}
