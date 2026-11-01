import { ErrorCode, type CompartilhamentoRow, type PedidoDoTitular } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { ApiError } from '../../../api/client'
import { pedidoDoTitularQueryOptions, suboperadoresQueryOptions, relerPedidoDoTitular } from './api/privacidade'
import { caminhoDaAbaDaPrivacidade, COORDENACAO_ROUTES } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { Card } from '../../../components/ui/Card'
import { StatusAnnouncement } from '../../../components/dialogs'
import { LoadingState, ErrorState } from '../../../components/states'
import { MEDIA_MD, useMediaQuery } from '../../../components/ui/media-query'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { Page } from '../../../components/ui/Page'
import { formatDate, formatDateTime } from '../../../format'
import { usePageTitle } from '../../../document-title'
import { O_MIOLO_QUE_ROLA } from '../comum/miolo-que-rola'
import { AcoesDoPedido } from './AcoesDoPedido'
import { agendarPreparacao } from './preparacao-do-arquivo'
import { ROTULO_DE_QUEM_PEDIU, ROTULO_DO_TIPO, SITUACAO_DO_PEDIDO, TEXTO_DO_TITULAR_ELIMINADO, hojeEmSaoPaulo, textoDasTurmas } from './textos-dos-pedidos'
import {
  acoesDoPedido,
  ANUNCIO_DO_ARQUIVO_PRONTO,
  AVISO_DE_AVISAR_AS_EMPRESAS,
  nomeDaEmpresa,
  orientacaoDoPedido,
  ordenarOCompartilhamento,
  periodoDaLinha,
  PRAZO_DA_DECLARACAO_COMPLETA_DIAS,
  prazoDoPedido,
  ROTULO_DA_ORIGEM,
  TEXTO_DO_PEDIDO_AUSENTE,
  textoDaTrocaDeNome,
  textoDoPrazo,
} from './textos-do-pedido'

const TEXTO_SEM_EMPRESAS = 'Nenhuma empresa recebeu dado desta pessoa no período em que a escola guarda o rastro das chamadas, e nenhuma atendia a escola enquanto ela estava aqui.'

/** O pedido de um titular que ainda não foi eliminado diz a turma; o eliminado, "Não consta": nome e turma saíram do sistema com ele. */
function textoDaPessoa(pedido: PedidoDoTitular): string {
  if (pedido.titular === null) return TEXTO_DO_TITULAR_ELIMINADO
  return `${pedido.titular.nome} · ${textoDasTurmas(pedido.titular.turmas)}`
}

function Linha({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <dt className="text-sm text-sutil">{rotulo}</dt>
      <dd className="min-w-0 font-medium break-words text-tinta">{children}</dd>
    </div>
  )
}

/**
 * O detalhe de um pedido de titular (F3, 17.0; X2, 12.0; RF12, RF13, RF13b, RF14, RF16): o prazo da declaração completa no
 * topo, depois quem, o quê, quem pediu, a situação, as empresas por onde passou dado da pessoa e o que a coordenação pode
 * fazer agora (concluir, cancelar a eliminação, corrigir o nome e baixar a versão da escola). É uma página de leitura, com
 * "‹ Pedidos" para voltar à lista.
 *
 * - **Cada leitura é auditada** (`pedido.lido`, regra 20, item 10): a página lê ao abrir e depois de cada ação, e nunca ao
 *   voltar o foco nem quando a rede volta. A única leitura sozinha é a do arquivo em preparação, a cada 10 s e só com a
 *   aba à vista (`preparacao-do-arquivo.ts`); "Atualizar" lê quando a pessoa pede.
 * - **O pedido não fica na memória** depois de a tela sair (`gcTime: 0`): nome e turma de titular não ficam num computador
 *   compartilhado da secretaria. O nome nunca vai ao endereço nem ao título da aba.
 * - **Os quatro estados**: carregando, erro com "Tentar de novo", pedido que não se acha (outra escola e inexistente
 *   respondem igual, regra 10, item 6) e o dado.
 */
export default function DetalheDoPedido({ pedidoId }: { readonly pedidoId: string }) {
  usePageTitle('Pedido de titular')
  const cliente = useQueryClient()
  const consulta = useQuery(pedidoDoTitularQueryOptions(pedidoId))
  const pedido = consulta.data
  const estado = pedido?.estado
  const [anuncio, definirAnuncio] = useState('')
  const inicio = useRef<HTMLElement>(null)
  // A partir de 768 px quem rola é este miolo, e ele recebe foco para rolar pelo teclado; abaixo disso rola a página.
  const comMiolo = useMediaQuery(MEDIA_MD)

  const ler = useCallback(() => {
    void relerPedidoDoTitular(cliente, pedidoId)
  }, [cliente, pedidoId])

  // O arquivo em montagem aparece pronto sem recarregar; parado o relógio, ele não volta sozinho com a aba escondida.
  useEffect(() => {
    if (estado === undefined) return undefined
    return agendarPreparacao(estado, ler, document)
  }, [estado, ler])

  const anterior = useRef(estado)
  useEffect(() => {
    if (anterior.current === 'em_preparacao' && estado === 'pronto') definirAnuncio(ANUNCIO_DO_ARQUIVO_PRONTO)
    anterior.current = estado
  }, [estado])

  const temEmpresas = (pedido?.compartilhamento.length ?? 0) > 0
  const suboperadores = useQuery({
    ...suboperadoresQueryOptions,
    enabled: temEmpresas,
  })
  const linhas = useMemo(() => ordenarOCompartilhamento(pedido?.compartilhamento ?? []), [pedido?.compartilhamento])
  const colunas: readonly [TableColumn<CompartilhamentoRow>, ...TableColumn<CompartilhamentoRow>[]] = useMemo(
    () => [
      {
        chave: 'empresa',
        titulo: 'Empresa',
        celula: (linha) => nomeDaEmpresa(linha, suboperadores.data?.suboperadores),
      },
      {
        chave: 'periodo',
        titulo: 'Período',
        celula: (linha) => periodoDaLinha(linha),
      },
      {
        chave: 'origem',
        titulo: 'Como sabemos',
        celula: (linha) => ROTULO_DA_ORIGEM[linha.origem],
      },
    ],
    [suboperadores.data],
  )

  const voltar = (
    // Relativo à área: o `Route` aninhado em `/coordenacao` resolve o `to` a partir da base dela.
    <Link to={caminhoDaAbaDaPrivacidade('pedidos')} aria-label="Voltar para Pedidos" className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
      <ArrowLeft aria-hidden="true" size={18} />
      Pedidos
    </Link>
  )

  if (consulta.isPending) {
    return (
      <Page titulo="Pedido de titular" largura="leitura" antes={voltar}>
        <LoadingState rotulo="Carregando o pedido…" />
      </Page>
    )
  }
  if (pedido === undefined) {
    const naoAchado = consulta.error instanceof ApiError && consulta.error.codigo === ErrorCode.NAO_ENCONTRADO
    return (
      <Page titulo="Pedido de titular" largura="leitura" antes={voltar}>
        {naoAchado ? (
          <p role="status" className="rounded-cartao border border-linha bg-superficie p-4 text-apoio">
            {TEXTO_DO_PEDIDO_AUSENTE}
          </p>
        ) : (
          <ErrorState erro={consulta.error} tentando={consulta.isFetching} aoTentarDeNovo={() => void consulta.refetch({ cancelRefetch: false })} />
        )}
      </Page>
    )
  }

  const situacao = SITUACAO_DO_PEDIDO[pedido.estado]
  const prazo = textoDoPrazo(prazoDoPedido(pedido, hojeEmSaoPaulo()))
  const orientacao = orientacaoDoPedido(pedido)
  const troca = textoDaTrocaDeNome(pedido)

  return (
    <Page
      titulo={pedido.titular?.nome ?? TEXTO_DO_TITULAR_ELIMINADO}
      largura="leitura"
      objeto
      descricao={ROTULO_DO_TIPO[pedido.tipo]}
      antes={voltar}
      acoes={
        <Button variante="secundario" onClick={ler} disabled={consulta.isFetching}>
          {consulta.isFetching ? 'Atualizando…' : 'Atualizar'}
        </Button>
      }
    >
      <section ref={inicio} aria-label="Tudo sobre este pedido" tabIndex={comMiolo ? 0 : -1} className={`flex min-w-0 flex-col gap-4 ${O_MIOLO_QUE_ROLA}${comMiolo ? '' : ' outline-none'}`}>
        <Card titulo="Prazo da declaração completa">
          <div className="flex min-w-0 flex-col gap-2">
            <div>
              <StatusBadge familia={prazo.familia}>{prazo.texto}</StatusBadge>
            </div>
            <p className="text-sm break-words text-sutil">
              O prazo é de {String(PRAZO_DA_DECLARACAO_COMPLETA_DIAS)} dias e conta do dia em que o pedido chegou à escola (LGPD, art. 19, II).
            </p>
          </div>
        </Card>
        <Card titulo="O pedido">
          <div className="flex min-w-0 flex-col gap-3">
            <dl className="flex min-w-0 flex-col gap-1.5 rounded-controle border border-linha p-3">
              <Linha rotulo="Pessoa">{textoDaPessoa(pedido)}</Linha>
              <Linha rotulo="Pedido">{ROTULO_DO_TIPO[pedido.tipo]}</Linha>
              <Linha rotulo="Quem pediu">{ROTULO_DE_QUEM_PEDIU[pedido.solicitante]}</Linha>
              <Linha rotulo="Chegou à escola em">{formatDate(pedido.chegouEm)}</Linha>
              <Linha rotulo="Situação">
                <StatusBadge familia={situacao.familia}>{situacao.texto}</StatusBadge>
              </Linha>
              {pedido.concluidoEm !== null && <Linha rotulo="Concluído em">{formatDateTime(pedido.concluidoEm)}</Linha>}
            </dl>
            {orientacao !== undefined && <p className="break-words text-apoio">{orientacao}</p>}
            {/* A correção de turma ou de vínculo não é deste pedido: o caminho é a turma, em Escola › Turmas (A1). */}
            {acoesDoPedido(pedido).corrigirNome && (
              <div>
                <Link to={COORDENACAO_ROUTES.estrutura} className={SECONDARY_LINK_CLASSES}>
                  Ir para as turmas
                </Link>
              </div>
            )}
            {troca !== undefined && <p className="rounded-controle border border-linha bg-info-cx p-3 break-words text-info">{troca}</p>}
            <StatusAnnouncement texto={anuncio} />
            <AcoesDoPedido pedido={pedido} aoAnunciar={definirAnuncio} focoDeReserva={() => inicio.current?.focus()} />
          </div>
        </Card>
        <Card titulo="Empresas que receberam dado desta pessoa">
          <div className="flex min-w-0 flex-col gap-3">
            {linhas.length === 0 ? (
              <p className="break-words text-apoio">{TEXTO_SEM_EMPRESAS}</p>
            ) : (
              <>
                <Table rotulo="Empresas que receberam dado desta pessoa" colunas={colunas} linhas={linhas} chaveDaLinha={(linha) => `${linha.chave}-${linha.primeiroEm}`} />
                <p className="text-sm break-words text-sutil">{AVISO_DE_AVISAR_AS_EMPRESAS}</p>
              </>
            )}
          </div>
        </Card>
      </section>
    </Page>
  )
}
