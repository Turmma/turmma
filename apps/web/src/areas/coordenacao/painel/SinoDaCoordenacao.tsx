import { createPortal } from 'react-dom'
import { useAncoraDoSino } from '../../../components/sino-anchor-context'
import { Sino } from '../../../components/sino/Sino'
import { useFilaDaCoordenacao } from './fila-da-coordenacao'

/**
 * O sino da coordenação (Tech Spec das telas da coordenação, seção 5, "O sino"): montado acima do `Switch` da área, como o
 * `AvisoDeIncidente`, e por `lazy()`, para a fachada da área não crescer. Lê a fila (`useFilaDaCoordenacao`) e desenha o
 * `Sino` na âncora que a casca deixa vazia, por `createPortal`. A casca não importa nada daqui.
 *
 * Só a área da coordenação o monta: o professor e o aluno não o têm, e nenhuma leitura da fila sai nas áreas deles. O do
 * professor é da X3, por outra montagem da mesma peça.
 */
export default function SinoDaCoordenacao() {
  const ancora = useAncoraDoSino()
  const fila = useFilaDaCoordenacao()
  if (ancora === null) return null
  return createPortal(
    <Sino
      itens={fila.itens}
      situacao={fila.situacao}
      erro={fila.erro}
      aoTentarDeNovo={fila.tentarDeNovo}
      tentandoDeNovo={fila.tentandoDeNovo}
      aoAtualizar={fila.atualizar}
      atualizando={fila.atualizando}
      atualizadoEm={fila.atualizadoEm}
      faltaPara="/estrutura?painel=falta"
    />,
    ancora,
  )
}
