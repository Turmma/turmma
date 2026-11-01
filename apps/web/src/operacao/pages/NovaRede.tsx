import { TIPOS_DE_REDE, type RedeDoPainel, type TipoDeRede } from '@educa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/fields/FormField'
import { REDES_QUERY_KEY, criarRedeNoPainel } from '../api/painel'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'
import { DialogoDaOperacao } from '../components/DialogoDaOperacao'
import { pedidoDeRede, newRequestId } from '../pedidos-do-painel'
import { ROTULO_DO_TIPO_DE_REDE, textoDaFalha } from '../textos'

interface Props {
  readonly aoFechar: () => void
  /** A rede criada (ou a mesma, no pedido repetido): a tela anuncia e a oferece no diálogo Nova escola. */
  readonly aoCriar: (rede: RedeDoPainel) => void
}

/**
 * O diálogo Nova rede (Tech Spec da A0b, seção 9; RF1): nome e tipo. O id do pedido é sorteado quando o diálogo abre e
 * morre quando ele fecha; enquanto está aberto, toda tentativa manda o mesmo, e o clique duplo ou a resposta perdida não
 * criam duas redes. Não há revisão como na escola: nada da rede fica fixo depois.
 *
 * O tipo começa em "Escola independente", a rede de uma escola só, que é a do colégio particular: assim o diálogo inteiro
 * se preenche com Tab e Enter (cenário W8), e quem cria a rede de uma prefeitura muda o tipo.
 */
export function NovaRede({ aoFechar, aoCriar }: Props) {
  const [id] = useState(newRequestId)
  const [nome, definirNome] = useState('')
  const [tipo, definirTipo] = useState<TipoDeRede>('independente')
  const [erroDoNome, definirErroDoNome] = useState<string | undefined>(undefined)
  // O pedido no ar, na hora: o `isPending` da mutação só chega à tela no próximo render, e o segundo clique de um clique
  // duplo chega antes dele. O id é o mesmo nos dois, e o servidor não criaria duas; aqui o segundo nem sai.
  const noAr = useRef(false)
  const clienteDeConsultas = useQueryClient()
  const grupoDoTipo = useId()
  const criar = useMutation({
    mutationFn: criarRedeNoPainel,
    onSuccess: async (_resposta, pedido) => {
      await clienteDeConsultas.invalidateQueries({ queryKey: REDES_QUERY_KEY })
      aoCriar({ id: pedido.id, nome: pedido.nome, tipo: pedido.tipo })
    },
  })

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (noAr.current) return
    const validacao = pedidoDeRede(id, { nome, tipo })
    if (!validacao.ok) {
      definirErroDoNome(validacao.erros.nome)
      return
    }
    definirErroDoNome(undefined)
    noAr.current = true
    criar.mutate(validacao.pedido, { onSettled: () => (noAr.current = false) })
  }

  return (
    <DialogoDaOperacao titulo="Nova rede" aoFechar={aoFechar}>
      <form className="mt-4 flex flex-col gap-4" onSubmit={enviar} noValidate>
        <FormField
          rotulo="Nome da rede"
          dica="Como a rede é chamada: a prefeitura, o grupo educacional ou o próprio colégio."
          name="nome"
          type="text"
          autoComplete="off"
          required
          value={nome}
          onChange={(evento) => definirNome(evento.target.value)}
          erro={erroDoNome}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">Tipo de rede</legend>
          {TIPOS_DE_REDE.map((opcao) => (
            <label key={opcao} className="flex min-h-11 items-center gap-3">
              <input type="radio" name={grupoDoTipo} value={opcao} checked={tipo === opcao} onChange={() => definirTipo(opcao)} className="h-5 w-5 shrink-0" />
              {ROTULO_DO_TIPO_DE_REDE[opcao]}
            </label>
          ))}
        </fieldset>
        {criar.isError && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {textoDaFalha(criar.error)}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? 'Criando…' : 'Criar rede'}
          </Button>
          <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
            Cancelar
          </button>
        </div>
        <span role="status" className="sr-only">
          {criar.isPending ? 'Criando a rede…' : ''}
        </span>
      </form>
    </DialogoDaOperacao>
  )
}
