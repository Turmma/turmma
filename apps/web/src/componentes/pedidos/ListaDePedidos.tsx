import { ErrorCode, type DecisaoDePedido, type DecisorDaReivindicacao, type PedidoDaTurma, type PedidosDaTurmaResponse } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { aplicarDecisao, consultaPedidosDaTurma, descartarListaDepoisDaFalha } from '../../api/pedidos'
import { formatarDataHora } from '../../formatar'
import { CLASSES_DO_BOTAO_OFICIAL, CLASSES_DO_BOTAO_PERIGO, CLASSES_DO_BOTAO_SECUNDARIO } from '../ui/botao-secundario'
import { useDialogoDaTela } from '../ui/sobrepostos/dialogo-aberto'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../estado'
import { listaMudou } from '../texto-da-falha'
import { agendarAtualizacao, alternarMarca, atualizaSozinha, pedidosQueContinuam, podeMarcarMais, quantosNovos, semOsDecididos } from './atualizacao-dos-pedidos'
import { DialogoDeDecisao } from './DialogoDeDecisao'
import {
  quantidadeDePedidos,
  rotuloDaDecisao,
  TEXTO_ANTES_DA_LEITURA,
  TEXTO_DA_ATUALIZACAO_SOZINHA,
  TEXTO_DA_AUDITORIA_DA_LEITURA,
  TEXTO_DA_MATRICULA_ERRADA,
  TEXTO_DE_COMO_DECIDIR,
  TEXTO_DE_QUE_HA_MAIS,
  TEXTO_DO_LIMITE,
  textoDosNovos,
} from './textos'

/** O vazio de cada papel (W4): o texto e, para quem tem para onde ir, o próximo passo. */
interface VazioDosPedidos {
  readonly titulo: string
  readonly descricao: string
  readonly acao?: { readonly rotulo: string; readonly aoAcionar: () => void }
}

interface PropsDosPedidos {
  readonly turma: { readonly id: string; readonly nome: string }
  /** Quem decide nesta tela: o professor da turma, ou a coordenação, de dentro da turma na Estrutura. */
  readonly quem: DecisorDaReivindicacao
  readonly vazio: VazioDosPedidos
  /** A API deixou de achar a turma para esta pessoa: quem desenha a página troca tudo pelo aviso dela. */
  readonly aoPerderATurma: () => void
  /** Depois de uma decisão, o que mais na tela mudou com ela (a lista de nomes da coordenação). */
  readonly aoDecidir?: () => unknown
}

/** A lista como a tela a viu por último, para dizer quantos pedidos chegaram na atualização seguinte. */
interface ListaVista {
  readonly dados: PedidosDaTurmaResponse | undefined
  readonly novos: { readonly texto: string; readonly vez: number }
}

/**
 * Os pedidos de nome da turma, com a decisão (A1, 16.0; RF12; W4, "Pedidos"; W6; W15): cada pedido com o nome, a hora e,
 * se houve, a marca da tentativa com matrícula errada; quem decide marca até 40, e aprova ou recusa depois de revisar. Não
 * existe "aprovar todos" (RF12; D4).
 *
 * A mesma peça serve aos dois papéis, e o que muda vem de `quem`:
 * - **professor**: a lista é lida ao abrir a turma e relida a cada 15 s, só com a aba à vista (`agendarAtualizacao`);
 * - **coordenação**: nenhuma leitura sai sem o clique em "Atualizar", porque cada uma fica na auditoria em nome dela; a
 *   tela diz isso ao lado do botão, e a decisão diz de novo antes de confirmar.
 *
 * O que a atualização não muda: a marcação, que é por id; o foco, porque cada linha tem o id como `key`; e o diálogo
 * aberto, que guarda os ids e mostra os que continuam na lista. Os pedidos novos são anunciados numa região viva, sem
 * levar o foco.
 *
 * A marcação e o diálogo vivem aqui, e saem com a tela: outra pessoa na mesma aba não os herda, e a lista dela vem do
 * cache esvaziado na troca de sessão (`main.tsx`).
 */
export function ListaDePedidos({ turma, quem, vazio, aoPerderATurma, aoDecidir }: PropsDosPedidos) {
  const cliente = useQueryClient()
  const pedidos = useQuery(consultaPedidosDaTurma(turma.id, quem))
  const sozinha = atualizaSozinha(quem)
  const [marcados, definirMarcados] = useState<readonly string[]>([])
  const dialogo = useDialogoDaTela<DecisaoDePedido, readonly string[]>()
  const aberta = dialogo.aberta
  const titulo = useRef<HTMLHeadingElement>(null)
  const idDoTitulo = useId()
  const idDoLimite = useId()

  const dados = pedidos.data
  // A cada lista nova: os pedidos que chegaram desde a anterior (a primeira leitura não anuncia nada), e a marcação sem
  // os que saíram. O pedido que saiu da lista não volta marcado, nem quando a lista sai inteira da tela e é lida de novo.
  const [vista, definirVista] = useState<ListaVista>({ dados: undefined, novos: { texto: '', vez: 0 } })
  if (dados !== vista.dados) {
    const chegaram = dados === undefined || vista.dados === undefined ? 0 : quantosNovos(new Set(vista.dados.itens.map((pedido) => pedido.id)), dados.itens)
    definirVista({ dados, novos: chegaram > 0 ? { texto: textoDosNovos(chegaram), vez: vista.novos.vez + 1 } : vista.novos })
    definirMarcados(pedidosQueContinuam(marcados, dados?.itens ?? []).map((pedido) => pedido.id))
  }

  const { refetch } = pedidos
  useEffect(() => agendarAtualizacao(quem, () => void refetch({ cancelRefetch: false }), document), [quem, refetch])

  // A turma que saiu do alcance (o vínculo encerrado com a tela aberta, a turma excluída, o ano virado): quem desenha a
  // página a troca inteira pelo aviso dela, e esta seção sai com os nomes.
  const semATurma = listaMudou(pedidos.error, [ErrorCode.NAO_ENCONTRADO])
  useEffect(() => {
    if (semATurma) aoPerderATurma()
  }, [semATurma, aoPerderATurma])

  const itens = dados?.itens ?? []
  // Os marcados, na ordem da lista: é a ordem em que o diálogo os mostra e em que a decisão os manda.
  const marcadosNaLista = pedidosQueContinuam(marcados, itens)
  const noLimite = !podeMarcarMais(marcadosNaLista.length)

  function alternar(pedido: PedidoDaTurma): void {
    definirMarcados(alternarMarca(marcadosNaLista.map((marcado) => marcado.id), pedido.id))
  }

  const tentarDeNovo = () => void refetch({ cancelRefetch: false })
  const erroDaLeitura = <EstadoErro erro={pedidos.error} tentando={pedidos.isFetching} aoTentarDeNovo={tentarDeNovo} />

  function conteudo(): ReactNode {
    if (dados === undefined) {
      if (pedidos.isFetching) return <EstadoCarregando rotulo="Carregando os pedidos…" />
      if (pedidos.isError) return erroDaLeitura
      // Só a coordenação chega aqui: a lista dela ainda não foi pedida.
      return <p className="rounded-cartao border border-linha bg-superficie p-4 break-words text-apoio">{TEXTO_ANTES_DA_LEITURA}</p>
    }
    if (itens.length === 0) {
      // A releitura que cai com a lista vazia não afirma o vazio: pode haver pedido esperando.
      if (pedidos.isError) return erroDaLeitura
      return <EstadoVazio titulo={vazio.titulo} descricao={vazio.descricao} {...(vazio.acao === undefined ? {} : { acao: vazio.acao })} />
    }
    return (
      <>
        {pedidos.isError && erroDaLeitura}
        <p className="text-sm text-sutil">{quantidadeDePedidos(itens.length)} esperando a decisão</p>
        <ul className="flex flex-col gap-3" aria-label="Pedidos esperando a decisão">
          {itens.map((pedido) => {
            const marcado = marcadosNaLista.some((outro) => outro.id === pedido.id)
            const desligado = !marcado && noLimite
            return (
              <li key={pedido.id}>
                <label
                  className={`flex min-h-11 min-w-0 items-start gap-3 rounded-cartao border bg-superficie p-4 ${marcado ? 'border-noite' : 'border-linha'} ${desligado ? '' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={desligado}
                    aria-describedby={desligado ? idDoLimite : undefined}
                    onChange={() => alternar(pedido)}
                    className="mt-0.5 h-6 w-6 shrink-0 accent-noite"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium break-words text-tinta">{pedido.nome}</span>
                    <span className="block text-sm text-apoio">Pediu em {formatarDataHora(pedido.solicitadaEm)}</span>
                    {pedido.teveMatriculaErrada && <span className="block text-sm break-words text-pendente">{TEXTO_DA_MATRICULA_ERRADA}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {dados.proxima !== undefined && <p className="text-sm break-words text-apoio">{TEXTO_DE_QUE_HA_MAIS}</p>}
        {noLimite && (
          <p id={idDoLimite} className="rounded-controle border border-pendente bg-pendente-cx p-3 break-words text-pendente">
            {TEXTO_DO_LIMITE}
          </p>
        )}
        {marcadosNaLista.length === 0 ? (
          <p className="break-words text-apoio">{TEXTO_DE_COMO_DECIDIR}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => dialogo.abrir('aprovar', marcadosNaLista.map((pedido) => pedido.id))} className={CLASSES_DO_BOTAO_OFICIAL}>
              {rotuloDaDecisao('aprovar', marcadosNaLista.length)}
            </button>
            <button type="button" onClick={() => dialogo.abrir('recusar', marcadosNaLista.map((pedido) => pedido.id))} className={CLASSES_DO_BOTAO_PERIGO}>
              {rotuloDaDecisao('recusar', marcadosNaLista.length)}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={idDoTitulo}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={titulo} id={idDoTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
          Pedidos de nome
        </h2>
        {!sozinha && (
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-sm text-apoio">
              {pedidos.isFetching ? 'Atualizando…' : ''}
            </span>
            <button type="button" onClick={tentarDeNovo} className={CLASSES_DO_BOTAO_SECUNDARIO}>
              Atualizar<span className="sr-only"> os pedidos</span>
            </button>
          </div>
        )}
      </div>
      {/* Como a lista se atualiza: sozinha, a do professor; no "Atualizar", com registro, a da coordenação. */}
      <p className="text-sm break-words text-apoio">{sozinha ? TEXTO_DA_ATUALIZACAO_SOZINHA : TEXTO_DA_AUDITORIA_DA_LEITURA}</p>
      {/* Os pedidos que chegaram, para o leitor de tela: a região existe antes do texto, e não leva o foco. */}
      <p aria-live="polite" className="sr-only">
        <span key={vista.novos.vez}>{vista.novos.texto}</span>
      </p>
      {conteudo()}

      {aberta !== undefined && aberta.alvo !== undefined && (
        <DialogoDeDecisao
          key={aberta.numero}
          decisao={aberta.tipo}
          ids={aberta.alvo}
          pedidos={itens}
          turmaNome={turma.nome}
          quem={quem}
          aoDecidir={async (resposta) => {
            // O que a resposta fechou sai da marcação aqui, e não só quando a tela desenhar a lista sem ele: a lista tirada
            // e a releitura podem chegar à tela na mesma vez, e uma releitura velha o traria de volta ainda marcado, com o
            // botão que abriu o diálogo de pé e o foco indo para ele ao fechar
            // (correção 2026-10-03-decididos-continuam-marcados).
            definirMarcados((atuais) => semOsDecididos(atuais, resposta))
            await aplicarDecisao(cliente, turma.id, quem, resposta)
            void aoDecidir?.()
          }}
          aoFalhar={async () => {
            await descartarListaDepoisDaFalha(cliente, turma.id, quem)
            void aoDecidir?.()
          }}
          aoFechar={dialogo.fechar}
          focoDeReserva={() => titulo.current?.focus()}
        />
      )}
    </section>
  )
}
