import { createPortal } from 'react-dom'
import { ROTAS_DO_PROFESSOR } from '../../../paths'
import { useAncoraDoSino } from '../../../components/sino-anchor-context'
import { Sino, type PeDoSino } from '../../../components/sino/Sino'
import { useFilaDoProfessor } from './fila-do-professor'

const AVISO_SEM_ANO_LETIVO = 'Não há ano letivo em curso nesta escola. O que espera você aparece aqui quando a coordenação abrir o ano.'

/**
 * O pé da lista (telas do professor, 2.0): as duas telas que "Seu time" tinha na lateral. Não são pendência e não entram no
 * número do sino. O Tutor continua visível à professora (regra 70, item 4): a tela dele abre pelo sino, de qualquer tela.
 */
const PE_DO_SINO: PeDoSino = {
  titulo: 'Acompanhar a IA',
  links: [
    { rotulo: 'O que o Assistente fez', para: ROTAS_DO_PROFESSOR.timeDoAssistente },
    { rotulo: 'O que o Tutor viu', para: ROTAS_DO_PROFESSOR.timeDoTutor },
  ],
}

/** O que o aviso da lista lida em parte diz: o que o sino não leu, em palavras. Quem monta a fila escreve cada parte. */
function avisoDaLeituraParcial(semAnoLetivo: boolean, naoLeu: readonly string[]): string {
  if (semAnoLetivo) return AVISO_SEM_ANO_LETIVO
  return `Parte da lista não carregou. Não foi possível ler ${naoLeu.join('; ')}.`
}

/**
 * O sino da professora (telas do professor, 1.0; Tech Spec, seção 5, "Montagem"): montado acima do `Switch` da área, como o
 * da coordenação (`SinoDaCoordenacao`), por `lazy()`, para a fachada da área não crescer. Lê a fila (`useFilaDoProfessor`) e
 * desenha o `Sino` na âncora que a casca deixa vazia, por `createPortal`. A casca não importa nada daqui.
 *
 * Só a área do professor o monta: a coordenação e o aluno não o têm, e nenhuma leitura da fila sai nas áreas deles. A peça
 * é a mesma do sino da coordenação (X2), com o vazio e o aviso da leitura parcial no texto da professora, e os itens
 * agrupados por turma.
 */
export default function SinoDoProfessor() {
  const ancora = useAncoraDoSino()
  const fila = useFilaDoProfessor()
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
      textoDoVazio="Nada espera a sua decisão agora."
      avisoDaLeituraParcial={avisoDaLeituraParcial(fila.semAnoLetivo, fila.naoLeu)}
      pe={PE_DO_SINO}
      ouMais={fila.haMais}
    />,
    ancora,
  )
}
