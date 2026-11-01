import type { AtividadeAplicada } from '@educa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { atividadesAplicadasQueryOptions, encerrarAtividade, recarregarAtividades } from './api/atividades'
import { semCorrecao, TEXTO_SEM_CORRECAO } from './aprovar'

/**
 * **Corrigir de novo** (A3; telas do professor, 6.0 e 11.0): a atividade que já está encerrada e não tem correção que valha — a
 * função estava suspensa, ou o lote foi rejeitado — pede a correção outra vez. Não passa por confirmação, porque nada muda para os
 * alunos: é o mesmo `POST …/encerrar`, que a API responde sem segundo lote. Quem o usa é o documento aberto (`AplicacaoDoArtefato`)
 * e o painel da atividade na turma (`AtividadesDaTurma`), com o mesmo texto do que aconteceu.
 *
 * - **O pedido sai uma vez só**: o segundo clique no mesmo instante, antes de o botão desligar, não manda outro (regra 80, item 7).
 * - **`corrigindo`** é o id da atividade com o pedido no ar, para o botão dela dizer "Corrigindo…" e os outros esperarem.
 * - **`aviso`** é o que a professora lê depois: a correção feita, esperando ela, ou por que a função continua sem corrigir.
 */
export function useCorrigirDeNovo(turmaId: string) {
  const cliente = useQueryClient()
  const decidindo = useRef(false)
  const [aviso, definirAviso] = useState('')
  const corrigir = useMutation({
    mutationFn: (id: string) => encerrarAtividade(id),
    onSuccess: async () => {
      recarregarAtividades(cliente)
      await cliente.invalidateQueries({ queryKey: atividadesAplicadasQueryOptions(turmaId).queryKey })
    },
    onSettled: () => (decidindo.current = false),
  })

  function corrigirDeNovo(aplicada: AtividadeAplicada): void {
    if (decidindo.current) return
    decidindo.current = true
    definirAviso('')
    corrigir.mutate(aplicada.id, {
      onSuccess: ({ atividade }) => definirAviso(atividade.entrega === null ? TEXTO_SEM_CORRECAO[semCorrecao(atividade) ?? 'correcao_suspensa'] : 'Correção feita. Ela está esperando você revisar.'),
    })
  }

  return {
    corrigirDeNovo,
    aviso,
    falha: corrigir.isError ? corrigir.error : undefined,
    corrigindo: corrigir.isPending ? corrigir.variables : undefined,
  }
}
