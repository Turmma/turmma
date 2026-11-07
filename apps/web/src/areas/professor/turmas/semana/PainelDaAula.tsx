import { ErrorCode, TAMANHO_MAXIMO_DO_TEXTO_DA_AULA, type AulaDaSemana, type SemanaResponse } from '@educa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { SEMANA_QUERY_KEY } from '../../../../api/chaves-do-professor'
import { ApiError } from '../../../../api/client'
import { Button } from '../../../../components/ui/Button'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import { Textarea } from '../../../../components/ui/fields/Textarea'
import { Sheet } from '../../../../components/ui/overlays/Sheet'
import { PROFESSOR_ROUTES } from '../../../../paths'
import { CONTEXTO_ESCOLHIDO } from '../../assistente/memoria-do-professor'
import { valorDoContexto } from '../../comum/turmas-da-professora'
import { gravarAula } from '../api/aulas'
import { comTextoGravado, DICA_DO_TEXTO_DA_AULA, FRASE_DA_AULA_QUE_SAIU, FRASE_DA_FALHA_AO_SALVAR, horarioDaAula, nomeCompletoDoDia, rotuloDoTexto } from './semana'

interface Props {
  readonly aula: AulaDaSemana
  /** A data da aula, `AAAA-MM-DD`. */
  readonly data: string
  readonly hoje: string
  /** Fecha o painel. `atualizar` é verdadeiro quando a aula saiu da grade no meio: quem fecha lê a semana de novo, e o cartão some. */
  readonly aoFechar: (atualizar: boolean) => void
  readonly focoDeReserva: () => void
}

/**
 * O painel da aula (F2b, RF5, RF8, RF15; `docs/interface.md` 1.8): o que a professora vai dar, ou deu, escrito e corrigido ao lado da semana
 * (folha de baixo a 360 px). Quem o monta passa uma `key` pela aula: outra aula é outro painel, com o próprio rascunho, a própria gravação e o
 * próprio erro, e nada de uma passa para a outra (a gravação de A que responde atrasada não escreve nada na tela de B).
 *
 * - **O rascunho vive aqui, em memória** (`useState`): nunca em `localStorage`, `sessionStorage` nem no endereço (regra 50, item 7; regra 20,
 *   item 9). Fechar sem salvar o descarta — a dica do campo diz isso —, e reabrir mostra o texto gravado. Como o painel é desmontado com a rota,
 *   a troca de escola e a pessoa seguinte na mesma aba o levam junto.
 * - **Uma gravação por vez** (RF15): uma trava de `useRef` segura o segundo clique do clique duplo, que chega antes de a tela desligar o "Salvar"
 *   (o `isPending` do TanStack vem agrupado, depois do clique). Duas abas gravando a mesma aula é caso do servidor (G6): uma linha só.
 * - **Salvar** grava, põe o texto no cache da semana (o cartão mostra o novo texto sem uma leitura nova) e fecha. **Falha**: a frase da
 *   Tech Spec, e o texto continua no campo. **`NAO_ENCONTRADO`**: a aula saiu da grade no meio, e o texto não foi salvo; o painel fica aberto, com
 *   o texto para a professora copiar, e a semana é lida de novo ao fechar.
 * - **"Preparar esta aula"** guarda a turma e a disciplina na caixa de pedido e abre o Início. Não cria conversa, não chama a API e não leva o texto
 *   da aula (regra 20, item 12): o que a professora escreveu aqui não vai ao Assistente.
 */
export function PainelDaAula({ aula, data, hoje, aoFechar, focoDeReserva }: Props) {
  const cliente = useQueryClient()
  const [, navegar] = useLocation()
  const [escrito, definirEscrito] = useState<string | undefined>(undefined)
  const gravando = useRef(false)
  const valor = escrito ?? aula.texto ?? ''

  const gravar = useMutation({
    mutationFn: (texto: string) => gravarAula({ vinculoId: aula.vinculoId, data, inicio: aula.inicio, texto }),
    // No `useMutation`, e não no `mutate`: a resposta que chega depois de o painel fechar ainda põe o texto no cartão dela. O que o painel
    // fecha, e o erro que ele mostra, são do `mutate`, que só roda enquanto este painel (desta aula) está na tela.
    onSuccess: (gravado) => {
      cliente.setQueriesData<SemanaResponse>({ queryKey: SEMANA_QUERY_KEY }, (lida) => (lida === undefined ? lida : comTextoGravado(lida, gravado)))
    },
    onSettled: () => {
      gravando.current = false
    },
  })
  const saiuDaGrade = gravar.error instanceof ApiError && gravar.error.codigo === ErrorCode.NAO_ENCONTRADO

  function salvar(): void {
    // O `isPending` do TanStack chega à tela depois do clique (as notificações são agrupadas): o segundo clique da mesma tarefa ainda acharia o
    // botão ligado. A trava é síncrona.
    if (gravando.current) return
    gravando.current = true
    gravar.mutate(valor, { onSuccess: () => aoFechar(false) })
  }

  function preparar(): void {
    // Leva só a turma e a disciplina, ids que a caixa de pedido já guarda. O texto da aula NÃO vai: quando a F11 reabrir a ligação da aula com a IA
    // (`docs/lgpd.md`, o mapa de dados), este é o primeiro lugar que vai ser tentado a levá-lo ao Assistente, e isso exige revisão de privacidade
    // antes (regra 20, itens 1 e 12), com a aula entrando no mapa de dados e na avaliação de impacto, e nunca por este caminho de passagem.
    CONTEXTO_ESCOLHIDO.guardar(valorDoContexto(aula.turmaId, aula.disciplinaId))
    navegar(PROFESSOR_ROUTES.novaConversa)
  }

  return (
    <Sheet
      titulo={nomeCompletoDoDia(data)}
      aoFechar={() => aoFechar(saiuDaGrade)}
      focoDeReserva={focoDeReserva}
      rodape={
        <>
          <Button variante="secundario" onClick={preparar}>
            Preparar esta aula
          </Button>
          <Button onClick={salvar} disabled={gravar.isPending}>
            {gravar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="t-cartao min-w-0 break-words text-tinta">{horarioDaAula(aula)}</p>
          <p className="min-w-0 break-words text-tinta">
            {aula.turma} · {aula.disciplina}
          </p>
          {aula.sala !== null && <p className="min-w-0 break-words text-apoio">Sala {aula.sala}</p>}
          {aula.foraDaGrade && (
            <p>
              <StatusBadge familia="info">Fora da grade</StatusBadge>
            </p>
          )}
        </div>
        <Textarea
          rotulo={rotuloDoTexto(data, hoje)}
          dica={DICA_DO_TEXTO_DA_AULA}
          valor={valor}
          aoMudar={definirEscrito}
          maximo={TAMANHO_MAXIMO_DO_TEXTO_DA_AULA}
          linhas={6}
          contadorAnunciado
        />
        {gravar.isError && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {saiuDaGrade ? FRASE_DA_AULA_QUE_SAIU : FRASE_DA_FALHA_AO_SALVAR}
          </p>
        )}
      </div>
    </Sheet>
  )
}
