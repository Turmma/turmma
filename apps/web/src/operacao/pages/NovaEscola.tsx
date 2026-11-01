import type { CriarEscolaRequest } from '@educa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/fields/FormField'
import { LoadingState } from '../../components/states'
import { ESCOLAS_QUERY_KEY, USO_QUERY_KEY, dasRedesQueryOptions, criarEscolaNoPainel } from '../api/painel'
import { ErroDaOperacao } from '../components/CascaDaOperacao'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'
import { DialogoDaOperacao } from '../components/DialogoDaOperacao'
import { pedidoDeEscola, newRequestId, type CampoDaEscola } from '../pedidos-do-painel'
import { ehEnderecoRepetido, ehResultadoIncerto, REGRA_DO_ENDERECO, TEXTO_DA_TENTATIVA_INCERTA, TEXTO_DO_ENDERECO_REPETIDO, TEXTO_SEM_REDE, textoDaFalha } from '../textos'

interface Props {
  readonly aoFechar: () => void
  /** A escola criada (ou a mesma, no pedido repetido): a tela anuncia pelo nome. */
  readonly aoCriar: (escola: { readonly id: string; readonly nome: string }) => void
  /** Sem rede nenhuma, o caminho é criar a rede: este diálogo fecha e o Nova rede abre. */
  readonly aoPedirNovaRede: () => void
  /** A rede que acabou de ser criada nesta tela, já escolhida: o fluxo rede → escola segue sem trocar de campo. */
  readonly redeSugeridaId?: string | undefined
}

/** O mesmo pedido: o mesmo id com a mesma rede, o mesmo nome e o mesmo endereço, que o servidor devolve sem criar outra. */
function mesmoPedido(a: CriarEscolaRequest, b: CriarEscolaRequest): boolean {
  return a.id === b.id && a.redeId === b.redeId && a.nome === b.nome && a.slug === b.slug
}

/** O endereço como a coordenação vai abri-lo: o host desta web e `/e/<endereço>`. */
function enderecoCompleto(slug: string): string {
  return `${window.location.host}/e/${slug}`
}

/**
 * O diálogo Nova escola (Tech Spec da A0b, seção 9; RF1): rede, nome e o **endereço da escola** — o `slug` de `/e/<slug>`,
 * por onde ela entra no Turmma, e não o endereço postal. O endereço não muda depois, e por isso há um passo de revisão
 * antes de criar, com a rede, o nome e o endereço completo (regra 50, item 8).
 *
 * O id do pedido nasce na abertura e morre no fechamento, como no Nova rede. O `CONFLITO` do servidor é o endereço que
 * já é de outra escola: a tela volta ao campo, com o texto nele e o foco nele (cenário W10). A exceção é o `CONFLITO`
 * depois de uma tentativa em que a conexão caiu, com os dados já mudados: o servidor pode ter criado a escola com os
 * dados de antes, e a tela manda conferir a lista, sem chamar isso de endereço repetido. Qualquer outra falha fica no
 * passo de revisão, e "Criar escola" tenta de novo com o mesmo id.
 */
export function NovaEscola({ aoFechar, aoCriar, aoPedirNovaRede, redeSugeridaId }: Props) {
  const [id] = useState(newRequestId)
  const redes = useQuery(dasRedesQueryOptions)
  const [redeId, definirRedeId] = useState(redeSugeridaId ?? '')
  const [nome, definirNome] = useState('')
  const [endereco, definirEndereco] = useState('')
  const [erros, definirErros] = useState<Partial<Record<CampoDaEscola, string>>>({})
  const [revisando, definirRevisando] = useState<CriarEscolaRequest | undefined>(undefined)
  // O último pedido que saiu sem se saber se o servidor o gravou (a conexão caiu): repetir os mesmos dados é seguro, pelo
  // id; mudar os dados depois dele pode esbarrar na escola que já nasceu.
  const [incerto, definirIncerto] = useState<CriarEscolaRequest | undefined>(undefined)
  // O pedido no ar, na hora: o `isPending` da mutação só chega à tela no próximo render, e o segundo clique de um clique
  // duplo chega antes dele. O id é o mesmo nos dois, e o servidor não criaria duas; aqui o segundo nem sai.
  const noAr = useRef(false)
  const campoDoEndereco = useRef<HTMLInputElement>(null)
  const tituloDaRevisao = useRef<HTMLHeadingElement>(null)
  const campoDaRede = useId()
  const erroDaRede = useId()
  const clienteDeConsultas = useQueryClient()
  const criar = useMutation({
    mutationFn: criarEscolaNoPainel,
    onSuccess: async (_resposta, pedido) => {
      // A escola nova entra na lista e no Uso (com zero): as duas deixam de valer, e a próxima visita ao Uso a traz.
      await Promise.all([clienteDeConsultas.invalidateQueries({ queryKey: ESCOLAS_QUERY_KEY }), clienteDeConsultas.invalidateQueries({ queryKey: USO_QUERY_KEY })])
      aoCriar({ id: pedido.id, nome: pedido.nome })
    },
    onError: (erro, pedido) => {
      if (ehResultadoIncerto(erro)) {
        definirIncerto(pedido)
        return
      }
      // Depois de uma tentativa incerta, o `CONFLITO` com outros dados é o servidor recusando o mesmo id com dados novos: a
      // escola pode já existir com os de antes. Fica no alerta da revisão, com o texto que manda conferir a lista.
      if (!ehEnderecoRepetido(erro) || (incerto !== undefined && !mesmoPedido(incerto, pedido))) return
      definirErros({ slug: TEXTO_DO_ENDERECO_REPETIDO })
      definirRevisando(undefined)
    },
  })

  // O foco acompanha o passo: a revisão começa pelo título dela; a volta pelo endereço repetido cai no campo.
  useEffect(() => {
    if (revisando !== undefined) tituloDaRevisao.current?.focus()
    else if (erros.slug === TEXTO_DO_ENDERECO_REPETIDO) campoDoEndereco.current?.focus()
  }, [revisando, erros.slug])

  function revisar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const validacao = pedidoDeEscola(id, { redeId, nome, slug: endereco })
    if (!validacao.ok) {
      definirErros(validacao.erros)
      return
    }
    definirErros({})
    criar.reset()
    definirRevisando(validacao.pedido)
  }

  function confirmar(): void {
    if (revisando === undefined || noAr.current) return
    noAr.current = true
    criar.mutate(revisando, { onSettled: () => (noAr.current = false) })
  }

  if (redes.isPending) {
    return (
      <DialogoDaOperacao titulo="Nova escola" aoFechar={aoFechar}>
        <div className="mt-4 flex flex-col gap-4">
          <LoadingState rotulo="Carregando as redes…" />
          <button type="button" onClick={aoFechar} className={`${SECONDARY_BUTTON_CLASSES} self-start`}>
            Cancelar
          </button>
        </div>
      </DialogoDaOperacao>
    )
  }

  if (redes.isError) {
    return (
      <DialogoDaOperacao titulo="Nova escola" aoFechar={aoFechar}>
        <div className="mt-4 flex flex-col gap-4">
          <ErroDaOperacao erro={redes.error} aoTentarDeNovo={() => void redes.refetch()} tentando={redes.isFetching} />
          <button type="button" onClick={aoFechar} className={`${SECONDARY_BUTTON_CLASSES} self-start`}>
            Cancelar
          </button>
        </div>
      </DialogoDaOperacao>
    )
  }

  const itens = redes.data.itens
  if (itens.length === 0) {
    return (
      <DialogoDaOperacao titulo="Nova escola" aoFechar={aoFechar}>
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-apoio">{TEXTO_SEM_REDE}</p>
          <div className="flex flex-wrap gap-3">
            {/* O foco estava no "Cancelar" do carregando, que saiu da tela: ele vem para a ação que o vazio oferece. */}
            <Button onClick={aoPedirNovaRede} autoFocus>
              Nova rede
            </Button>
            <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
              Cancelar
            </button>
          </div>
        </div>
      </DialogoDaOperacao>
    )
  }

  if (revisando !== undefined) {
    const rede = itens.find((item) => item.id === revisando.redeId)
    return (
      <DialogoDaOperacao titulo="Nova escola" aoFechar={aoFechar}>
        <div className="mt-4 flex flex-col gap-4">
          <h3 ref={tituloDaRevisao} tabIndex={-1} className="font-semibold">
            Confira antes de criar
          </h3>
          <dl className="grid gap-3">
            <div>
              <dt className="text-sm text-sutil">Rede</dt>
              <dd className="wrap-anywhere">{rede?.nome}</dd>
            </div>
            <div>
              <dt className="text-sm text-sutil">Nome da escola</dt>
              <dd className="wrap-anywhere">{revisando.nome}</dd>
            </div>
            <div>
              <dt className="text-sm text-sutil">Endereço da escola</dt>
              <dd className="font-medium wrap-anywhere">{enderecoCompleto(revisando.slug)}</dd>
            </div>
          </dl>
          <p className="rounded-controle border border-pendente bg-pendente-cx p-3 text-pendente">
            O endereço não muda depois. É por ele que a coordenação, os professores e os alunos entram na escola.
          </p>
          {criar.isError && (
            <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
              {incerto !== undefined && ehEnderecoRepetido(criar.error) ? TEXTO_DA_TENTATIVA_INCERTA : textoDaFalha(criar.error)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={confirmar} disabled={criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Criar escola'}
            </Button>
            <button type="button" onClick={() => definirRevisando(undefined)} disabled={criar.isPending} className={SECONDARY_BUTTON_CLASSES}>
              Voltar e corrigir
            </button>
            <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
              Cancelar
            </button>
          </div>
          <span role="status" className="sr-only">
            {criar.isPending ? 'Criando a escola…' : ''}
          </span>
        </div>
      </DialogoDaOperacao>
    )
  }

  const redeEscolhida = itens.some((item) => item.id === redeId) ? redeId : ''
  return (
    <DialogoDaOperacao titulo="Nova escola" aoFechar={aoFechar}>
      <form className="mt-4 flex flex-col gap-4" onSubmit={revisar} noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor={campoDaRede} className="font-medium">
            Rede
          </label>
          {/* O foco estava no "Cancelar" do carregando, que saiu da tela: ele vem para o primeiro campo. */}
          <select
            autoFocus
            id={campoDaRede}
            name="rede"
            required
            value={redeEscolhida}
            onChange={(evento) => definirRedeId(evento.target.value)}
            {...(erros.redeId === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': erroDaRede })}
            className="min-h-11 w-full min-w-0 rounded-controle border border-borda-campo bg-superficie px-3 py-2 text-base text-tinta"
          >
            <option value="" disabled>
              Escolha a rede
            </option>
            {itens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          {erros.redeId !== undefined && (
            <p id={erroDaRede} className="text-sm text-erro">
              {erros.redeId}
            </p>
          )}
        </div>
        <FormField
          rotulo="Nome da escola"
          name="nome"
          type="text"
          autoComplete="off"
          required
          value={nome}
          onChange={(evento) => definirNome(evento.target.value)}
          erro={erros.nome}
        />
        <FormField
          ref={campoDoEndereco}
          rotulo="Endereço da escola"
          dica={REGRA_DO_ENDERECO}
          name="endereco"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={endereco}
          onChange={(evento) => definirEndereco(evento.target.value)}
          erro={erros.slug}
        />
        <p className="text-sm text-apoio">
          A escola vai entrar por <span className="font-medium text-tinta wrap-anywhere">{enderecoCompleto(endereco.trim() === '' ? 'endereco-da-escola' : endereco.trim())}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Revisar</Button>
          <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
            Cancelar
          </button>
        </div>
      </form>
    </DialogoDaOperacao>
  )
}
