import type { ReactNode } from 'react'
import { caminhoDaAbaDaPrivacidade, ROTAS_DA_COORDENACAO } from '../../paths'
import { Moldura, type AbaDaMoldura } from './comum/moldura'

/**
 * As abas de Registros (D80; Tech Spec da X2, seção 5): IA, Pedidos e Privacidade. IA é a Governança, em `/governanca`; Pedidos
 * abre em `/privacidade/pedidos`; e Privacidade abre nos prazos de guarda, `/privacidade/retencao`, com as empresas e os
 * incidentes num seletor lá dentro, nunca aba dentro de aba (RF17). O caminho é relativo à área.
 */
export const ABAS_DE_REGISTROS = [
  { id: 'ia', rotulo: 'IA', caminho: ROTAS_DA_COORDENACAO.governanca },
  { id: 'pedidos', rotulo: 'Pedidos', caminho: ROTAS_DA_COORDENACAO.pedidos },
  { id: 'privacidade', rotulo: 'Privacidade', caminho: caminhoDaAbaDaPrivacidade('retencao') },
] as const satisfies readonly AbaDaMoldura[]

export type AbaDeRegistros = (typeof ABAS_DE_REGISTROS)[number]['id']

/** A aba do navegador de cada uma: "Registros: IA". */
const TITULO_DA_ABA: Readonly<Record<AbaDeRegistros, string>> = {
  ia: 'Registros: IA',
  pedidos: 'Registros: pedidos',
  privacidade: 'Registros: privacidade',
}

/** A moldura de Registros: o título, as três abas e, dentro, a tela da aba do endereço (X2, 3.0). */
export default function Registros({ aba, children }: { readonly aba: AbaDeRegistros; readonly children: ReactNode }) {
  return (
    <Moldura titulo="Registros" tituloDaAba={TITULO_DA_ABA[aba]} rotuloDasAbas="Seções de Registros" abas={ABAS_DE_REGISTROS} ativa={aba}>
      {children}
    </Moldura>
  )
}
