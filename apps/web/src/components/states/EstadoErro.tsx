import { mensagemDoErro } from '../../api/client'
import { Button } from '../ui/Button'

interface Props {
  /** O erro da consulta. A mensagem vem do catálogo pelo código; status HTTP nunca aparece. */
  erro: unknown
  aoTentarDeNovo: () => void
  /** Uma nova tentativa já está em andamento. */
  tentando?: boolean
}

/**
 * O erro de uma leitura (`docs/interface.md` 10.2): a mensagem diz o que fazer, e o botão tenta de novo.
 *
 * **O alerta é só a mensagem**; o botão fica fora dele, e o "Tentando de novo…" é anunciado como `status`. Com o botão
 * dentro do `alert`, o leitor de tela o anunciaria junto da mensagem a cada erro, e o `status` não teria por onde dizer
 * que a nova tentativa começou. A borda de 2 px e as famílias `erro` e `erro-cx` são as de antes, e os testes de regra
 * ("Tentar de novo" em 18 specs) continuam afirmando o que afirmavam.
 *
 * Esta peça mora na entrada (Tech Spec da X1, seção 7c): não importa `Alert`, `CountBadge`, `Toggle` nem outra peça que
 * fique fora dela, e o teste do build prova.
 */
export function EstadoErro({ erro, aoTentarDeNovo, tentando = false }: Props) {
  return (
    <div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
      <p role="alert" className="t-apoio text-erro">
        {mensagemDoErro(erro)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={aoTentarDeNovo}>Tentar de novo</Button>
        <span role="status" className="t-apoio text-erro">
          {tentando ? 'Tentando de novo…' : ''}
        </span>
      </div>
    </div>
  )
}
