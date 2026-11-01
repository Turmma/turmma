import type { Agente, EuResponse } from '@educa/shared'
import { useId } from 'react'
import { Link } from 'wouter'
import { useTituloDaTela } from '../../document-title'
import { EstadoErro } from '../states'
import { SECONDARY_LINK_CLASSES } from '../ui/button-variants'
import { Onca } from '../ui/onca/Onca'
import { Balao } from './Balao'
import { Introducao, type PassoDaIntroducao } from './Introducao'
import { TelaDeFoco } from './TelaDeFoco'
import { useIntroducao } from './use-introducao'

interface PropsDaIntroducaoDoPapel {
  /** Quem fala: a função assina embaixo da onça. */
  readonly agente: Agente
  /** Quantos passos há: o carregando e o erro mostram "Passo 1 de N" sem ainda saber qual é o modo. */
  readonly totalDePassos: number
  /** A fala do passo 1, que o carregando mostra enquanto a leitura do `/v1/eu` não chega. */
  readonly falaDoCarregando: string
  /** Os passos do papel. Recebem o `/v1/eu` já lido: a coordenação diz o nome da escola no passo 1. */
  readonly passosDe: (eu: EuResponse) => readonly PassoDaIntroducao[]
  /** Para onde vai quem termina ou pula pela primeira vez, e quem escolhe "Voltar para a abertura" no erro. */
  readonly aoTerminar: string
  /** Para onde vai quem revê e fecha: cada papel diz o seu. */
  readonly aoRever: string
}

/**
 * A introdução de **qualquer papel**, nos quatro estados (telas do aluno e primeiro acesso, 11.0; RF12, RF16, RF18, RF20): carregando,
 * erro, data desconhecida e com dado. A tela de cada papel só diz quem fala, a fala do carregando, os passos e os destinos; o resto,
 * que era copiado de uma introdução para a outra, mora aqui (e a gravação da data, em `useIntroducao`).
 *
 * - **Carregando:** a fala do passo 1 e o "Sair", sem "Fechar" nem "Pular" (o modo ainda não se sabe).
 * - **Erro:** `EstadoErro` com "Tentar de novo", "Voltar para a abertura" e o "Sair" da moldura. O erro só vale para quem ainda não tem dado:
 *   uma releitura que falha com os passos já na tela não os tira.
 * - **Data desconhecida** vale a primeira vez. **Com dado,** os passos.
 *
 * A leitura do `['eu']` (60 s de `staleTime`, sem reler ao voltar para a aba) é a mesma das três introduções: mudá-la em `useIntroducao` muda
 * a do aluno, a do professor e a da coordenação.
 */
export function IntroducaoDoPapel({ agente, totalDePassos, falaDoCarregando, passosDe, aoTerminar, aoRever }: PropsDaIntroducaoDoPapel) {
  useTituloDaTela('Bem-vindo')
  const idDoPasso = useId()
  const { eu, revendo, terminar } = useIntroducao({ aoTerminar, aoRever })

  if (eu.data === undefined && eu.isError) {
    return (
      <TelaDeFoco
        passo={1}
        total={totalDePassos}
        idDoPasso={idDoPasso}
        rodape={
          <Link to={aoTerminar} replace className={`${SECONDARY_LINK_CLASSES} flex-1`}>
            Voltar para a abertura
          </Link>
        }
      >
        <h1 className="sr-only">Introdução</h1>
        <EstadoErro erro={eu.error} tentando={eu.isFetching} aoTentarDeNovo={() => void eu.refetch({ cancelRefetch: false })} />
      </TelaDeFoco>
    )
  }

  if (eu.data === undefined) {
    return (
      <TelaDeFoco passo={1} total={totalDePassos} idDoPasso={idDoPasso} rodape={null}>
        <Onca pose="acenando" agente={agente} tamanho={120} />
        <Balao fala={falaDoCarregando} descritoPor={idDoPasso} />
        <p role="status" className="sr-only">
          Carregando…
        </p>
      </TelaDeFoco>
    )
  }

  return <Introducao passos={passosDe(eu.data)} agente={agente} revendo={revendo} aoConcluir={terminar} aoPular={terminar} />
}
