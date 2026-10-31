import { Eye } from 'lucide-react'
import { Faixa } from '../../components/ui/Faixa'
import { TEXTO_DA_SUPERVISAO } from './tutor'

/**
 * A faixa de supervisão, **presa no topo e sem botão de fechar** (D8; regra 70, item 4): em qualquer ponto da conversa
 * o aluno vê que o professor acompanha o uso. No celular ela fica logo abaixo da barra do menu. O fundo cheio é para a
 * conversa não aparecer por trás dela enquanto rola. Uma formulação só, a de `TEXTO_DA_SUPERVISAO`: está no Início e na
 * conversa com o Tutor, e em nenhum outro lugar.
 */
export function FaixaDeSupervisao() {
  return (
    <div data-faixa-de-supervisao="" className="sticky top-14 z-[5] bg-fundo py-2 md:top-0">
      <Faixa icone={Eye}>{TEXTO_DA_SUPERVISAO}</Faixa>
    </div>
  )
}
