import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useLocation } from 'wouter'
import { concluirIntroducao, consultaEu } from '../../api/eu'

/** O `['eu']` envelhece em 60 s e não se relê ao voltar para a aba (Tech Spec, seção 9): o desvio da entrada já o leu. Vale para as introduções do aluno, do professor e da coordenação: mudar um dos dois valores muda as três. */
const LEITURA_DA_INTRODUCAO = { staleTime: 60_000, refetchOnWindowFocus: false } as const

interface DestinosDaIntroducao {
  /** Para onde vai quem acabou de ver a introdução pela primeira vez (concluiu ou pulou): a tela de abertura do papel. */
  readonly aoTerminar: string
  /** O destino de quem a revê (fechou, concluiu ou apertou Esc): cada papel diz o seu. O aluno volta a Eu; o professor vai ao primeiro lugar dele, porque o link está no menu da pessoa, em toda tela. */
  readonly aoRever: string
}

/**
 * O que a introdução de **qualquer papel** faz com a data (telas do aluno e primeiro acesso, 9.0 e 10.0; RF12, RF16, RF18): lê o
 * `['eu']`, sabe se a pessoa está **revendo** e termina. A tela de cada papel só põe os passos e os destinos.
 *
 * - **Revendo** é ter uma data **conhecida e preenchida**. Data desconhecida (a leitura ainda não chegou, ou falhou) vale a primeira vez.
 * - **Terminar** grava a data uma vez só e leva a pessoa embora, **mesmo se a gravação falhar**: ninguém fica preso, e a introdução volta
 *   na entrada seguinte. A resposta da rota entra no cache `['eu']`. Dois cliques seguidos fazem um POST só. Revendo, nada é gravado.
 * - "Sair" e fechar a aba não passam por aqui: não gravam.
 *
 * Os destinos são endereços como o `navigate` do wouter os entende: relativos à base do `Router` em que a tela está, ou absolutos
 * com o prefixo `~`.
 */
export function useIntroducao(destinos: DestinosDaIntroducao) {
  const eu = useQuery({ ...consultaEu, ...LEITURA_DA_INTRODUCAO })
  const cliente = useQueryClient()
  const [, ir] = useLocation()
  /** O POST já saiu: o segundo clique, no mesmo quadro, não faz outro. */
  const jaGravou = useRef(false)

  // O que o `onSuccess` guarda é a primeira data, a mesma que o `GET /v1/eu` devolveria; sem `['eu']` no cache não há o que atualizar.
  const gravar = useMutation({
    mutationFn: concluirIntroducao,
    onSuccess: ({ introducaoVistaEm }) => cliente.setQueryData(consultaEu.queryKey, (antes) => (antes === undefined ? antes : { ...antes, introducaoVistaEm })),
  })

  const revendo = eu.data !== undefined && eu.data.introducaoVistaEm !== null

  function terminar(): void {
    if (!revendo && !jaGravou.current) {
      jaGravou.current = true
      gravar.mutate()
    }
    ir(revendo ? destinos.aoRever : destinos.aoTerminar, { replace: true })
  }

  return { eu, revendo, terminar }
}
