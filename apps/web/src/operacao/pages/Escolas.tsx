import type { PainelQuery, EscolaDoPainel } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { Button } from '../../components/ui/Button'
import { LoadingState, EmptyState } from '../../components/states'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import { formatQuantity } from '../../format'
import { acoesDoConvite, ROTULO_DA_ACAO, type AcaoDoConvite } from '../acoes-do-convite'
import { buscaDaConsulta, dasEscolasQueryOptions, lerConsultaDaTela, paginasDoTotal } from '../api/painel'
import { INICIO_DA_OPERACAO } from '../paths'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'
import { ErroDaOperacao } from '../components/CascaDaOperacao'
import { ConfirmarConvite } from '../components/ConfirmarConvite'
import { GerarConvite, RefazerConvite } from '../components/DialogoDoConvite'
import { Pagination, SortSelect, VazioAlemDaUltima } from '../components/NavegacaoDaLista'
import { ScrollableList } from '../components/ScrollableList'
import { useDialogState } from '../../components/ui/overlays/dialog-state'
import { TEXTO_DO_ESTADO, TOM_DO_ESTADO } from '../estados-da-escola'
import { TEXTO_DA_LISTA_VAZIA } from '../textos'
import { useOperacaoPageTitle } from '../document-title'
import { NovaEscola } from './NovaEscola'
import { NovaRede } from './NovaRede'

/** O estado da coordenação em texto, com o ícone e a cor de reforço da família dele (regra 50, item 11). */
function EstadoDaCoordenacao({ escola }: { escola: EscolaDoPainel }) {
  return <StatusBadge familia={TOM_DO_ESTADO[escola.estado]}>{TEXTO_DO_ESTADO[escola.estado]}</StatusBadge>
}

/** O resto do nome acessível de cada ação, depois do rótulo visível: o botão diz de que escola é (WCAG 2.5.3). */
const COMPLEMENTO_DA_ACAO: Readonly<Record<AcaoDoConvite, string>> = {
  gerar: 'a coordenação de',
  refazer: 'o convite de',
  revogar: 'o convite de',
}

type AoAcionar = (acao: AcaoDoConvite, escola: EscolaDoPainel) => void

/** O que a linha precisa da tela: abrir o diálogo da ação, e pôr o foco num lugar estável da escola quando o perde. */
interface AcoesDaLinha {
  readonly aoAcionar: AoAcionar
  readonly focarNaEscola: (escolaId: string) => void
}

/** O atributo que marca as ações de cada escola na tabela e no cartão: é por ele que o foco acha a linha de novo. */
const ATRIBUTO_DAS_ACOES = 'data-acoes-da-escola'

/**
 * As ações do convite da coordenação na linha e no cartão da escola, pela matriz (`acoes-do-convite.ts`): só o que o
 * estado que a API deu permite. A chave é a **posição**: quando a lista recarrega com o estado novo ("Convidar" vira
 * "Refazer"), o botão continua o mesmo elemento, e o foco que o diálogo devolve a ele ao fechar não se perde.
 *
 * Quando o botão com o foco sai da linha (o "Revogar" depois do revogar: `revogado` só tem "Convidar"), o foco vai para
 * a primeira ação que sobrou na escola, ou para o anúncio da tela (`focarNaEscola`), e não para o `body`.
 */
function AcoesDoConvite({ escola, aoAcionar, focarNaEscola }: { escola: EscolaDoPainel } & AcoesDaLinha) {
  const acoes = acoesDoConvite(escola)
  // O botão que tinha o foco quando o `ref` dele foi desligado. O `ref` em linha é desligado a cada renderização, e não
  // só quando o botão sai; por isso, depois do commit, só conta se ele de fato saiu da página e o foco ficou no `body`.
  const comOFoco = useRef<HTMLButtonElement | undefined>(undefined)
  useEffect(() => {
    const botao = comOFoco.current
    comOFoco.current = undefined
    if (botao === undefined || botao.isConnected || document.activeElement !== document.body) return
    focarNaEscola(escola.id)
  })
  return (
    <div {...{ [ATRIBUTO_DAS_ACOES]: escola.id }} className={acoes.length === 0 ? 'hidden' : 'mt-2 flex flex-wrap gap-2'}>
      {acoes.map((acao, posicao) => (
        <button
          key={posicao}
          ref={(botao) => () => {
            if (botao !== null && botao === document.activeElement) comOFoco.current = botao
          }}
          type="button"
          onClick={() => aoAcionar(acao, escola)}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {ROTULO_DA_ACAO[acao]}
          <span className="sr-only">
            {' '}
            {COMPLEMENTO_DA_ACAO[acao]} {escola.nome}
          </span>
        </button>
      ))}
    </div>
  )
}

/** O uso da escola em uma linha: as três contagens do ano em curso, cada uma inteira na linha (nunca "612" numa e "alunos" na outra). */
function UsoDaEscola({ escola }: { escola: EscolaDoPainel }) {
  if (escola.turmas === 0) return <span className="text-sutil">Sem turma ainda</span>
  return (
    <span className="tabular-nums">
      <span className="whitespace-nowrap">{formatQuantity(escola.turmas, 'turma', 'turmas')}</span>
      {' · '}
      <span className="whitespace-nowrap">{formatQuantity(escola.professores, 'professor', 'professores')}</span>
      {' · '}
      <span className="whitespace-nowrap">{formatQuantity(escola.alunos, 'aluno', 'alunos')}</span>
    </span>
  )
}

/** A coluna da coordenação: o estado em texto e as ações do convite que ele permite. */
function CoordenacaoDaEscola({ escola, aoAcionar, focarNaEscola }: { escola: EscolaDoPainel } & AcoesDaLinha) {
  return (
    <>
      <EstadoDaCoordenacao escola={escola} />
      <AcoesDoConvite escola={escola} aoAcionar={aoAcionar} focarNaEscola={focarNaEscola} />
    </>
  )
}

/** A coluna da escola: o nome e o endereço dela. O nome leva `data-nome-da-escola`: é por ele que o roteiro lê a ordem, na tabela e na lista do celular. */
function IdentidadeDaEscola({ escola }: { escola: EscolaDoPainel }) {
  return (
    <>
      <span data-nome-da-escola="" className="block font-bold wrap-anywhere">
        {escola.nome}
      </span>
      <span className="block font-normal text-sutil wrap-anywhere">/e/{escola.slug}</span>
    </>
  )
}

/**
 * Escolas (`/operacao`; Tech Spec da A0b, seção 9; RF3 e RF5): a lista de todas as escolas, com a rede, o estado da
 * primeira coordenação e as contagens do ano letivo em curso — **só número**, nunca pessoa (D10, D76). A página e a ordem
 * ficam na query string; a troca mantém a página anterior na tela até a nova chegar. Nova rede e Nova escola abrem em
 * diálogo, daqui, e também o convite da coordenação de cada escola: convidar, refazer e revogar, pela matriz do estado
 * (tarefa 7.0).
 *
 * Os quatro estados (regra 50, item 5): carregando; erro, com "Tentar de novo" e a tela no lugar; vazio, que convida a
 * criar a rede; e com dado. A página além da última (endereço digitado, escola que saiu) tem o seu vazio, com o caminho
 * de volta à primeira.
 */
export function Escolas() {
  useOperacaoPageTitle('Escolas')
  const busca = useSearch()
  const [, navegar] = useLocation()
  const consulta = lerConsultaDaTela(busca)
  const escolas = useQuery(dasEscolasQueryOptions(consulta))
  // O diálogo aberto: um de cada vez, e só enquanto está aberto ele existe; cada abertura é uma instância própria. Os do
  // convite levam a escola da linha, fotografada na abertura.
  const dialogo = useDialogState<'rede' | 'escola' | AcaoDoConvite, EscolaDoPainel>()
  const aberta = dialogo.aberta
  const alvo = aberta?.alvo
  const [anuncio, definirAnuncio] = useState('')
  // A rede criada por último nesta tela: o Nova escola já a traz escolhida (o fluxo rede → escola, cenário W8).
  const [redeSugerida, definirRedeSugerida] = useState<string | undefined>(undefined)
  const regiaoDoAnuncio = useRef<HTMLDivElement>(null)

  /**
   * O foco num lugar estável da escola, quando o botão que o tinha saiu da linha: a primeira ação que sobrou nela, na
   * tabela ou no cartão (o que está à vista); sem ação nenhuma, o anúncio da tela.
   */
  const focarNaEscola = useCallback((escolaId: string) => {
    const grupos = Array.from(document.querySelectorAll<HTMLElement>(`[${ATRIBUTO_DAS_ACOES}="${CSS.escape(escolaId)}"]`))
    const botao = grupos.find((grupo) => grupo.getClientRects().length > 0)?.querySelector('button')
    if (botao) botao.focus()
    else regiaoDoAnuncio.current?.focus()
  }, [])

  function irPara(nova: PainelQuery): void {
    navegar(`${INICIO_DA_OPERACAO}?${buscaDaConsulta(nova)}`)
  }

  const dados = escolas.data
  const paginas = paginasDoTotal(dados?.total ?? 0)
  const trocando = escolas.isPlaceholderData

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => dialogo.abrir('escola')}>Nova escola</Button>
          <button type="button" onClick={() => dialogo.abrir('rede')} className={SECONDARY_BUTTON_CLASSES}>
            Nova rede
          </button>
        </div>
        <SortSelect ordem={consulta.ordem} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
      </div>

      <div ref={regiaoDoAnuncio} tabIndex={-1} role="status">{anuncio !== '' && <p className="rounded-controle border border-ok bg-ok-cx p-3 text-ok wrap-anywhere">{anuncio}</p>}</div>

      {escolas.isPending ? (
        <LoadingState rotulo="Carregando as escolas…" />
      ) : escolas.isError && dados === undefined ? (
        <ErroDaOperacao erro={escolas.error} aoTentarDeNovo={() => void escolas.refetch()} tentando={escolas.isFetching} />
      ) : dados === undefined || dados.total === 0 ? (
        // Sem ação no vazio: o "Nova rede" do topo é o convite, e a tela fica com um só deles e um só botão cheio.
        <EmptyState titulo={TEXTO_DA_LISTA_VAZIA.titulo} descricao={TEXTO_DA_LISTA_VAZIA.descricao} />
      ) : dados.itens.length === 0 ? (
        <VazioAlemDaUltima paginas={paginas} aoIrParaAPrimeira={() => irPara({ pagina: 1, ordem: consulta.ordem })} />
      ) : (
        <ScrollableList
          rotulo="Lista de escolas"
          ocupada={trocando}
          pe={<Pagination rotulo="Páginas da lista" pagina={consulta.pagina} paginas={paginas} trocando={trocando} aoIr={(pagina) => irPara({ pagina, ordem: consulta.ordem })} />}
        >
          {escolas.isError && <ErroDaOperacao erro={escolas.error} aoTentarDeNovo={() => void escolas.refetch()} tentando={escolas.isFetching} />}
          <p className="text-sm text-sutil">{formatQuantity(dados.total, 'escola', 'escolas')}</p>
          {/* As quatro colunas (RF21; mockup 12.1): a coordenação aparece pelo estado, nunca por nome ou e-mail (D76). */}
          <Table
            rotulo="Escolas, com a rede, o estado da coordenação e as contagens do ano letivo em curso"
            colunas={[
              { chave: 'escola', titulo: 'Escola', celula: (escola) => <IdentidadeDaEscola escola={escola} /> },
              { chave: 'rede', titulo: 'Rede', celula: (escola) => <span className="wrap-anywhere">{escola.rede.nome}</span> },
              { chave: 'coordenacao', titulo: 'Coordenação', celula: (escola) => <CoordenacaoDaEscola escola={escola} aoAcionar={dialogo.abrir} focarNaEscola={focarNaEscola} /> },
              { chave: 'uso', titulo: 'Uso', celula: (escola) => <UsoDaEscola escola={escola} /> },
            ]}
            linhas={dados.itens}
            chaveDaLinha={(escola) => escola.id}
          />
        </ScrollableList>
      )}

      {aberta?.tipo === 'rede' && (
        <NovaRede
          key={aberta.numero}
          aoFechar={dialogo.fechar}
          aoCriar={(rede) => {
            definirAnuncio(`Rede ${rede.nome} criada. Agora crie a escola dela em Nova escola.`)
            // A resposta pode chegar depois de o diálogo fechar, com outro já aberto, até outro Nova rede: só esta
            // abertura fecha (`dialog-state.ts`).
            dialogo.fecharSeAinda(aberta)
            definirRedeSugerida(rede.id)
          }}
        />
      )}
      {aberta?.tipo === 'escola' && (
        <NovaEscola
          key={aberta.numero}
          redeSugeridaId={redeSugerida}
          aoFechar={dialogo.fechar}
          aoPedirNovaRede={() => dialogo.abrir('rede')}
          aoCriar={(escola) => {
            definirAnuncio(`Escola ${escola.nome} criada.`)
            dialogo.fecharSeAinda(aberta)
          }}
        />
      )}
      {/* O gerar e o refazer não fecham sozinhos: a resposta deles só preenche o diálogo que a pediu (`DialogoDoConvite.tsx`). */}
      {aberta?.tipo === 'gerar' && alvo !== undefined && <GerarConvite key={aberta.numero} escola={alvo} aoFechar={dialogo.fechar} focoDeReserva={() => focarNaEscola(alvo.id)} />}
      {aberta?.tipo === 'refazer' && alvo?.conviteId !== undefined && (
        <RefazerConvite key={aberta.numero} escola={alvo} conviteId={alvo.conviteId} aoFechar={dialogo.fechar} focoDeReserva={() => focarNaEscola(alvo.id)} />
      )}
      {aberta?.tipo === 'revogar' && alvo?.conviteId !== undefined && (
        <ConfirmarConvite
          key={aberta.numero}
          escola={alvo}
          conviteId={alvo.conviteId}
          aoFechar={dialogo.fechar}
          focoDeReserva={() => focarNaEscola(alvo.id)}
          aoRevogar={() => {
            definirAnuncio(`Convite de ${alvo.nome} revogado.`)
            dialogo.fecharSeAinda(aberta)
          }}
        />
      )}
    </>
  )
}
