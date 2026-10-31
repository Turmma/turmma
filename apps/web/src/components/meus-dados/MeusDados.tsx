import type { PedidoDeMeusDados, ArquivoResponse, MeusDadosResponse } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { consultaEu } from '../../api/eu'
import { baixarMeuArquivo, consultaMeusDados, relerMeusDados } from '../../api/meus-dados'
import { formatarData, formatarDataHora, formatarQuantidade } from '../../format'
import { useTituloDaTela } from '../../document-title'
import { baixarPorUrl } from '../download-from-url'
import { Botao } from '../ui/Botao'
import { Cartao } from '../ui/Cartao'
import { useDialogoDaTela } from '../ui/overlays/dialog-state'
import { DialogoDeConfirmacao } from '../ui/overlays/DialogoDeConfirmacao'
import { Anuncio, useEnvioUnico } from '../dialogs'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../states'
import { Estado } from '../ui/SeloDeEstado'
import { listaMudou, textoDaFalha } from '../error-text'
import { Tela, type NivelDoTitulo } from '../ui/Tela'
import {
  agendarPreparacao,
  anuncioDoArquivoBaixado,
  AVISO_DE_BAIXAR,
  CODIGOS_QUE_MUDAM_OS_MEUS_DADOS,
  EFEITO_DE_BAIXAR,
  linhasDoResumo,
  ordenarPedidos,
  podeBaixar,
  ROTULO_DO_TIPO,
  situacaoDoPedido,
  TEXTO_DO_VAZIO,
  TEXTOS_DA_FALHA_DE_BAIXAR,
  textoDaEscola,
  TITULO_DO_VAZIO,
} from './regras'

const ANUNCIO_DO_ARQUIVO_PRONTO = 'O seu arquivo ficou pronto.'

interface PropsDoDialogo {
  readonly pedido: PedidoDeMeusDados
  readonly aoFechar: () => void
  /** Chamado com o arquivo já entregue ao navegador: fecha só a abertura em que o pedido saiu. */
  readonly aoBaixar: (arquivo: ArquivoResponse) => void
  /** O foco, quando o botão que abriu o diálogo saiu da página (o arquivo passou dos 7 dias enquanto a pessoa lia). */
  readonly focoDeReserva: () => void
}

/**
 * Antes de baixar, o que vai acontecer (regra 50, item 8): o que o arquivo traz e o que fazer com ele depois num
 * computador da escola. O endereço assinado vale 5 minutos e sai daqui direto para o navegador: não passa por estado, texto
 * da tela nem endereço. Cada clique é um download registrado, e o clique duplo manda uma chamada só (`useEnvioUnico`).
 */
function DialogoDeBaixar({ pedido, aoFechar, aoBaixar, focoDeReserva }: PropsDoDialogo) {
  const cliente = useQueryClient()
  const { enviar, mutacao } = useEnvioUnico<undefined, ArquivoResponse>({
    mutationFn: () => baixarMeuArquivo(pedido.id),
    onSuccess: (arquivo) => {
      baixarPorUrl(arquivo.url, arquivo.nome)
      aoBaixar(arquivo)
    },
    onError: (erro) => {
      // O arquivo saiu enquanto a pessoa lia: a lista é relida e deixa de oferecer o botão.
      if (listaMudou(erro, CODIGOS_QUE_MUDAM_OS_MEUS_DADOS)) void relerMeusDados(cliente)
    },
  })
  const mudou = mutacao.isError && listaMudou(mutacao.error, CODIGOS_QUE_MUDAM_OS_MEUS_DADOS)
  const expiraEm = pedido.arquivo?.expiraEm
  return (
    <DialogoDeConfirmacao
      titulo="Baixar os seus dados"
      familia="oficial"
      resumo={[
        { rotulo: 'Pedido', valor: ROTULO_DO_TIPO[pedido.tipo] },
        { rotulo: 'Chegou à escola em', valor: formatarData(pedido.chegouEm) },
        ...(expiraEm === undefined ? [] : [{ rotulo: 'Disponível até', valor: formatarDataHora(expiraEm) }]),
      ]}
      efeito={EFEITO_DE_BAIXAR}
      aviso={AVISO_DE_BAIXAR}
      rotuloDeConfirmar="Baixar o arquivo"
      rotuloConfirmando="Preparando o arquivo…"
      rotuloDeCancelar={mudou ? 'Fechar' : 'Cancelar'}
      aoConfirmar={() => enviar(undefined)}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      impedido={mudou}
      focoDeReserva={focoDeReserva}
      {...(mutacao.isError ? { falha: textoDaFalha(mutacao.error, TEXTOS_DA_FALHA_DE_BAIXAR) } : {})}
    />
  )
}

interface PropsDaLista {
  readonly pedidos: readonly PedidoDeMeusDados[]
  readonly agora: Date
  readonly aoBaixar: (pedido: PedidoDeMeusDados) => void
  /** O foco, quando o botão de baixar sai da lista com ele (a releitura chegou depois de o diálogo fechar). */
  readonly focoDeReserva: () => void
}

/**
 * O botão de baixar de um pedido. O arquivo que passou dos 7 dias enquanto a pessoa lia tira o botão da lista quando a
 * releitura chega, e ela pode chegar depois de o diálogo fechar: o foco já voltou ao botão, e sem este cuidado o navegador
 * o põe no `body` quando ele sai (o `focoDeReserva` do diálogo só vale se o botão já saiu ao fechar). A limpeza roda com o
 * botão ainda na página: só quem o tem com o foco o leva à reserva, e quem já foi para outro controle não perde o dele
 * (regra 50, item 11).
 */
function BotaoDeBaixar({ aoClicar, focoDeReserva }: { readonly aoClicar: () => void; readonly focoDeReserva: () => void }) {
  const botao = useRef<HTMLButtonElement>(null)
  const reserva = useRef(focoDeReserva)
  useEffect(() => {
    reserva.current = focoDeReserva
  }, [focoDeReserva])
  useLayoutEffect(() => {
    const elemento = botao.current
    return () => {
      if (document.activeElement === elemento) reserva.current()
    }
  }, [])
  return (
    <Botao ref={botao} variante="secundario" onClick={aoClicar}>
      Baixar meus dados
    </Botao>
  )
}

/** Os pedidos, o mais recente primeiro: cada um diz o que é, em que pé está e, com o arquivo pronto, deixa baixá-lo. */
function ListaDePedidos({ pedidos, agora, aoBaixar, focoDeReserva }: PropsDaLista) {
  return (
    <ul className="flex min-w-0 flex-col gap-3">
      {ordenarPedidos(pedidos).map((pedido) => {
        const situacao = situacaoDoPedido(pedido, agora)
        // O arquivo que ainda vale: é ele que deixa baixar e que diz até quando.
        const disponivel = podeBaixar(pedido, agora) ? pedido.arquivo : null
        return (
          <li key={pedido.id} className="flex min-w-0 flex-col gap-2 rounded-controle border border-linha p-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="min-w-0 font-medium break-words text-tinta">{ROTULO_DO_TIPO[pedido.tipo]}</p>
              <Estado familia={situacao.familia}>{situacao.selo}</Estado>
            </div>
            <p className="text-sm text-sutil">Chegou à escola em {formatarData(pedido.chegouEm)}</p>
            <p className="break-words text-apoio">{situacao.explicacao}</p>
            {disponivel !== null && (
              <>
                <p className="text-sm break-words text-sutil">O arquivo fica disponível até {formatarDataHora(disponivel.expiraEm)}.</p>
                <div>
                  <BotaoDeBaixar aoClicar={() => aoBaixar(pedido)} focoDeReserva={focoDeReserva} />
                </div>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface Props {
  /** O nome da tela: o título da aba e o `h1`, visível como o de toda tela aberta pela lateral. "Privacidade" no aluno, "Meus dados" no professor. */
  readonly titulo: string
  /** O nome da seção quando a tela tem um acima do conteúdo: o aluno acha "Meus dados" **dentro** de "Privacidade". */
  readonly secao?: string
}

/**
 * "Meus dados" do aluno e do professor (F3, 18.0; RF12 e RF20): os pedidos de cópia dos dados da própria pessoa que a
 * coordenação registrou, com o estado de cada um, o arquivo para baixar e o resumo do que a escola guarda dela por
 * categoria. A pessoa não pede aqui: o pedido é da escola (D10), e o vazio diz a quem pedir.
 *
 * - **Só a escola ativa**: a API lê pela escola do token, e a tela diz isso. Trocar de escola esvazia o cache inteiro
 *   (`main.tsx`), e a outra pessoa na mesma aba não vê o arquivo da anterior, nem enquanto a leitura dela não chega.
 * - **Os quatro estados**: carregando, erro com "Tentar de novo", vazio (o convite a pedir à coordenação) e o dado, que por
 *   pedido é "em preparação" (relê a cada 10 s com a aba à vista), "pronto para baixar" ou "arquivo apagado".
 * - **Nada fica na memória** depois de a tela sair (`gcTime: 0`): o arquivo e o resumo são dados de uma pessoa, num
 *   computador que a próxima usa. O JSON nunca é renderizado: sai como arquivo.
 * - **O arquivo é entregue pela URL assinada de 5 minutos** (`baixarPorUrl`), depois de a pessoa ler o que ele traz e o
 *   que fazer com ele num computador da escola.
 *
 * Mora em `components/` porque é a mesma tela das duas áreas (`areas/navigation.ts`, linha 5).
 */
export default function MeusDados({ titulo, secao }: Props) {
  useTituloDaTela(titulo)
  const cliente = useQueryClient()
  const eu = useQuery(consultaEu)
  const consulta = useQuery(consultaMeusDados)
  const dados = consulta.data
  const pedidos = dados?.pedidos
  const dialogo = useDialogoDaTela<'baixar', PedidoDeMeusDados>()
  const [anuncio, definirAnuncio] = useState('')
  const inicio = useRef<HTMLDivElement>(null)

  const ler = useCallback(() => {
    void relerMeusDados(cliente)
  }, [cliente])

  // O arquivo em montagem aparece pronto sem recarregar; com a aba escondida o relógio para, e ao voltar relê na hora.
  useEffect(() => {
    if (pedidos === undefined) return undefined
    return agendarPreparacao(pedidos, ler, document)
  }, [pedidos, ler])

  // Quem estava em preparação e agora não está: o anúncio diz que ficou pronto, para quem não vê a lista mudar.
  const emPreparacao = useRef<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (pedidos === undefined) return
    const agora = new Set(pedidos.filter((pedido) => pedido.estado === 'em_preparacao').map((pedido) => pedido.id))
    const ficouPronto = pedidos.some((pedido) => emPreparacao.current.has(pedido.id) && pedido.estado === 'pronto')
    if (ficouPronto) definirAnuncio(ANUNCIO_DO_ARQUIVO_PRONTO)
    emPreparacao.current = agora
  }, [pedidos])

  const nivel: NivelDoTitulo = secao === undefined ? 2 : 3
  const agora = new Date()
  // A abertura de **este** render: a resposta do download fecha só ela, nunca outro diálogo aberto depois.
  const aberta = dialogo.aberta

  return (
    <Tela titulo={titulo} largura="conversa">
      <div ref={inicio} tabIndex={-1} className="flex min-w-0 flex-col gap-4 outline-none">
        {secao !== undefined && <h2 className="text-[22px] leading-tight font-semibold break-words text-tinta">{secao}</h2>}
        <p className="break-words text-apoio">{textoDaEscola(eu.data?.escola.nome)}</p>
        {consulta.isPending && <EstadoCarregando rotulo="Carregando os seus pedidos…" />}
        {consulta.isError && dados === undefined && (
          <EstadoErro erro={consulta.error} tentando={consulta.isFetching} aoTentarDeNovo={() => void consulta.refetch({ cancelRefetch: false })} />
        )}
        {dados !== undefined && (
          <>
            <Cartao titulo="Seus pedidos" nivel={nivel}>
              <div className="flex min-w-0 flex-col gap-3">
                <Anuncio texto={anuncio} />
                {dados.pedidos.length === 0 ? (
                  <EstadoVazio titulo={TITULO_DO_VAZIO} descricao={TEXTO_DO_VAZIO} />
                ) : (
                  <ListaDePedidos
                    pedidos={dados.pedidos}
                    agora={agora}
                    aoBaixar={(pedido) => dialogo.abrir('baixar', pedido)}
                    focoDeReserva={() => inicio.current?.focus()}
                  />
                )}
              </div>
            </Cartao>
            <Cartao titulo="O que a escola guarda de você" nivel={nivel}>
              <ResumoPorCategoria categorias={dados.categorias} />
            </Cartao>
          </>
        )}
      </div>
      {aberta?.tipo === 'baixar' && aberta.alvo !== undefined && (
        <DialogoDeBaixar
          pedido={aberta.alvo}
          aoFechar={dialogo.fechar}
          focoDeReserva={() => inicio.current?.focus()}
          aoBaixar={(arquivo) => {
            dialogo.fecharSeAinda(aberta)
            definirAnuncio(anuncioDoArquivoBaixado(arquivo.nome))
          }}
        />
      )}
    </Tela>
  )
}

/** O que a escola guarda da pessoa, por categoria, só com registro: o resumo legível. O conteúdo de cada um vem no arquivo. */
function ResumoPorCategoria({ categorias }: { readonly categorias: MeusDadosResponse['categorias'] }) {
  const linhas = linhasDoResumo(categorias)
  if (linhas.length === 0) return <p className="break-words text-apoio">A escola não guarda nenhum registro seu por categoria por enquanto.</p>
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ul className="flex min-w-0 flex-col gap-2">
        {linhas.map((linha) => (
          <li key={linha.categoria} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 break-words text-tinta">{linha.descricao}</span>
            <span className="shrink-0 text-sm text-sutil tabular-nums">{formatarQuantidade(linha.quantidade, 'registro', 'registros')}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm break-words text-sutil">Aqui está só a conta dos registros. O que há em cada um vem no arquivo.</p>
    </div>
  )
}
