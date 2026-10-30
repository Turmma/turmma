import { ErrorCode, type Entrega, type DecidirEntregaRequest } from '@educa/shared'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { ErroDaApi, mensagemDoErro } from '../../../api/cliente'
import { aplicarEntregaDecidida, consultaEntregas, decidirEntrega, recarregarEntregas } from '../artefatos/api/entregas'
import { agenteDoTime, consultaTime, funcaoSuspensa } from './api/time'
import { consultaMeusVinculos } from '../comum/api/vinculos'
import { caminhoDaCorrecaoDoProfessor, caminhoDoArtefatoDoProfessor, ROTAS_DO_PROFESSOR } from '../../../caminhos'
import { Abas } from '../../../componentes/ui/Abas'
import { Botao } from '../../../componentes/ui/Botao'
import { classesDoBotao } from '../../../componentes/ui/botao-secundario'
import { CampoLongo } from '../../../componentes/ui/campos/CampoLongo'
import { Cartao } from '../../../componentes/ui/Cartao'
import { DialogoDeConfirmacao } from '../../../componentes/ui/sobrepostos/DialogoDeConfirmacao'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../componentes/estado/index'
import { AssinaturaIA } from '../../../componentes/ui/ia/AssinaturaIA'
import { Conversa, MensagemIA } from '../../../componentes/ui/ia/Mensagem'
import { Estado } from '../../../componentes/ui/SeloDeEstado'
import { problemaDoTexto } from '../../../componentes/ui/campos/texto-longo'
import { Tela } from '../../../componentes/ui/Tela'
import { formatarDataHora } from '../../../formatar'
import { useTituloDaTela } from '../../../titulo'
import { AvisoNaEntregaDeFuncaoSuspensa } from '../comum/avisos'
import {
  aprovacaoDaEntrega,
  AVISO_DA_JUSTIFICATIVA,
  avisoDaFuncaoSuspensa,
  decideAqui,
  EFEITO_DE_APROVAR,
  EFEITO_DE_REJEITAR,
  ehFiltroDoTime,
  entregasDoFiltro,
  falaDaEntrega,
  FILTROS_DO_TIME,
  LIMITES_DA_JUSTIFICATIVA,
  resumoDaAprovacao,
  VERBO_DA_ENTREGA,
  type FiltroDoTime,
} from '../artefatos/entregas'
import { O_MIOLO_DO_DOCUMENTO, useTopoDoPainel } from '../artefatos/miolo-do-documento'
import { nomesDasTurmas, turmasDaProfessora } from '../comum/turmas-da-professora'

/** De quanto em quanto a conversa do Assistente relê as entregas, com a aba à vista: não há WebSocket nesta fatia. */
const INTERVALO_DAS_ENTREGAS_MS = 15_000

const CLASSES_DA_ACAO = `${classesDoBotao({ variante: 'discreto', tamanho: 'compacto' })} hover:bg-realce-suave hover:text-tinta`

/** A decisão que está sendo confirmada: qual entrega, e se é aprovar ou rejeitar. */
interface DecisaoAberta {
  readonly entrega: Entrega
  readonly decisao: DecidirEntregaRequest['decisao']
}

const idDoCartao = (entregaId: string) => `entrega-${entregaId}`

/**
 * O que o Assistente de ensino fez (`docs/interface.md` 11.4; pelo pé do sino): a conversa em que o Assistente diz o que as funções dele
 * fizeram, em balão, com a faixa **"Esperando você"** presa no alto, o filtro por função e, em cada entrega, o que foi
 * feito e a situação dela.
 *
 * **Aprovar é a decisão oficial**: o botão preto abre a confirmação, que diz o que é, de qual turma, e que só depois
 * disso a versão pode ir ao aluno; **Rejeitar** pede a justificativa. As duas passam por `POST /v1/entregas/:id/decidir`,
 * a aprovação registrada (regra 70, item 3): não há atalho em volta dela. Depois de decidir, a entrega mostra quem e
 * quando. O clique duplo não decide duas vezes, e a entrega que outra aba já decidiu vira a tela atualizada, e não erro.
 *
 * **O feed não aparece vazio** para a professora com turma (regra 50, item 6): sem entrega nenhuma, a tela mostra o que
 * cada função do Assistente faz e como pedir. O cabeçalho diz, em português comum e como a escola o configurou
 * (`GET /v1/time`), o que cada função faz sozinha e o que espera aprovação (regra 70, item 5).
 */
export default function Time() {
  useTituloDaTela('Assistente de ensino')
  const cliente = useQueryClient()
  const [, navegar] = useLocation()
  const time = useQuery(consultaTime)
  const entregas = useInfiniteQuery({ ...consultaEntregas, refetchInterval: INTERVALO_DAS_ENTREGAS_MS })
  const vinculos = useInfiniteQuery(consultaMeusVinculos)
  const [filtro, definirFiltro] = useState<FiltroDoTime>('tudo')
  const [aberta, definirAberta] = useState<DecisaoAberta | undefined>(undefined)
  const [justificativa, definirJustificativa] = useState('')
  const [tentouRejeitar, definirTentouRejeitar] = useState(false)
  const [aviso, definirAviso] = useState('')
  const [alvo, definirAlvo] = useState<string | undefined>(undefined)
  // O clique duplo chega antes de o `isPending` da mutação desligar o botão: quem segura a segunda decisão é esta marca.
  const decidindo = useRef(false)
  const idDaFaixa = useId()
  const idDasFuncoes = useId()

  const decidir = useMutation({
    mutationFn: ({ entrega, pedido }: { entrega: Entrega; pedido: DecidirEntregaRequest }) => decidirEntrega(entrega.id, pedido),
    onSuccess: async (decidida) => {
      definirAviso('')
      // A lista muda antes de o diálogo fechar: o botão que o abriu já saiu da tela, e o foco vai para a entrega decidida
      // (`focoDeReserva`), e não para um botão que some em seguida, o que o jogaria no `body`.
      await aplicarEntregaDecidida(cliente, decidida)
      definirAberta(undefined)
    },
    onError: async (erro) => {
      // Outra aba, ou o primeiro clique, já decidiu: a tela se atualiza e mostra como ficou.
      if (!(erro instanceof ErroDaApi) || erro.codigo !== ErrorCode.ENTREGA_JA_DECIDIDA) return
      definirAviso('Esta entrega já tinha sido decidida. A tela foi atualizada com a decisão.')
      // Pela mesma razão, o diálogo só fecha depois da releitura.
      await recarregarEntregas(cliente)
      definirAberta(undefined)
    },
    onSettled: () => {
      decidindo.current = false
    },
  })

  // "Ver", na faixa: o cartão daquela entrega vem para a tela e recebe o foco, depois de o filtro o mostrar.
  useEffect(() => {
    if (alvo === undefined) return
    const cartao = document.getElementById(idDoCartao(alvo))
    cartao?.scrollIntoView({ block: 'center' })
    cartao?.focus()
  }, [alvo, filtro])

  const itensDosVinculos = vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const nomes = nomesDasTurmas(itensDosVinculos)
  const temTurma = turmasDaProfessora(itensDosVinculos).length > 0
  // Em ordem de conversa: a mais antiga em cima, a de agora embaixo.
  const todas = (entregas.data?.pages.flatMap((pagina) => pagina.itens) ?? []).sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
  const esperando = entregasDoFiltro(todas, 'esperando')
  // A conversa é o miolo: a faixa, o filtro e o cabeçalho ficam parados e só ela rola, a partir de 768 px (RF22).
  const topoDoPainel = useTopoDoPainel(todas.length > 0)
  const visiveis = entregasDoFiltro(todas, filtro)
  const assistente = agenteDoTime(time.data, 'assistente_de_ensino')

  function abrir(entrega: Entrega, decisao: DecidirEntregaRequest['decisao']): void {
    decidir.reset()
    definirJustificativa('')
    definirTentouRejeitar(false)
    definirAviso('')
    definirAberta({ entrega, decisao })
  }

  function confirmar(): void {
    if (aberta === undefined || decidindo.current) return
    if (aberta.decisao === 'rejeitar') {
      definirTentouRejeitar(true)
      if (problemaDoTexto(justificativa, LIMITES_DA_JUSTIFICATIVA) !== undefined) return
    }
    decidindo.current = true
    decidir.mutate({ entrega: aberta.entrega, pedido: aberta.decisao === 'aprovar' ? { decisao: 'aprovar' } : { decisao: 'rejeitar', justificativa: justificativa.trim() } })
  }

  const turmaDaAberta = aberta === undefined ? undefined : nomes[aberta.entrega.turmaId]
  const falhaDaDecisao = decidir.isError && !(decidir.error instanceof ErroDaApi && decidir.error.codigo === ErrorCode.ENTREGA_JA_DECIDIDA) ? mensagemDoErro(decidir.error) : undefined
  const problemaDaJustificativa = problemaDoTexto(justificativa, LIMITES_DA_JUSTIFICATIVA)
  const focoDeReserva = aberta === undefined ? undefined : () => document.getElementById(idDoCartao(aberta.entrega.id))?.focus()

  // A lista do que espera a professora, uma só: na linha, com uma pendência, e dentro do recolhido, com várias.
  const listaDoQueEspera = (
    <ul className="flex max-h-40 min-w-0 flex-col gap-1 overflow-y-auto">
      {esperando.map((entrega) => (
        <li key={entrega.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1 basis-40 text-sm break-words text-tinta">
            {entrega.titulo}
            {nomes[entrega.turmaId] !== undefined && ` · ${nomes[entrega.turmaId] ?? ''}`}
          </span>
          <Botao
            variante="secundario"
            tamanho="compacto"
            onClick={() => {
              if (!visiveis.some((visivel) => visivel.id === entrega.id)) definirFiltro('esperando')
              definirAlvo(undefined)
              // Depois do render com o filtro certo: o mesmo alvo duas vezes seguidas ainda leva até ele.
              requestAnimationFrame(() => definirAlvo(entrega.id))
            }}
          >
            Ver<span className="sr-only"> {entrega.titulo}</span>
          </Botao>
        </li>
      ))}
    </ul>
  )

  return (
    <Tela titulo="Assistente de ensino" largura="conversa" tituloSoParaLeitor>
      <header className="flex min-w-0 flex-col gap-2">
        <AssinaturaIA agente="assistente_de_ensino" tamanho={32} />
        <details className="group min-w-0 rounded-cartao border border-linha bg-superficie">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-sm font-medium text-tinta hover:bg-realce-suave">
            {/* A seta diz que a linha abre, e gira aberta: é aqui que está a resposta a "o que essa IA faz sozinha?". */}
            <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 group-open:rotate-90" />
            O que cada função faz sozinha, e o que espera você
          </summary>
          <div className="flex min-w-0 flex-col gap-3 border-t border-linha p-4">
            <h2 id={idDasFuncoes} className="sr-only">
              Funções do Assistente de ensino
            </h2>
            {time.isPending && <p className="text-apoio">Carregando as funções…</p>}
            {time.isError && (
              <div className="flex min-w-0 flex-wrap items-center gap-3 text-erro">
                <p role="alert" className="min-w-0 break-words">
                  {mensagemDoErro(time.error)}
                </p>
                <Botao variante="secundario" onClick={() => void time.refetch({ cancelRefetch: false })}>
                  Tentar de novo
                </Botao>
              </div>
            )}
            {assistente !== undefined && (
              <ul aria-labelledby={idDasFuncoes} className="flex min-w-0 flex-col gap-3">
                {assistente.funcoes.map((funcao) => (
                  <li key={funcao.chave} data-funcao={funcao.chave} className="flex min-w-0 flex-col gap-1">
                    <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium text-tinta">
                      {funcao.nome}
                      {funcao.suspensa && <Estado familia="info">Suspensa pela coordenação</Estado>}
                    </p>
                    <p className="min-w-0 text-sm break-words text-apoio">
                      <span className="font-medium">Faz sozinha: </span>
                      {funcao.fazSozinha}
                    </p>
                    <p className="min-w-0 text-sm break-words text-apoio">
                      <span className="font-medium">Espera você: </span>
                      {funcao.esperaAprovacao}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </header>

      <p role="status" className="rounded-controle bg-info-cx p-3 break-words text-info empty:hidden">
        {aviso}
      </p>

      {entregas.isPending && <EstadoCarregando rotulo="Carregando o que o Assistente fez…" />}
      {entregas.isError && entregas.data === undefined && <EstadoErro erro={entregas.error} tentando={entregas.isFetching} aoTentarDeNovo={() => void entregas.refetch({ cancelRefetch: false })} />}

      {entregas.data !== undefined && todas.length === 0 && vinculos.data !== undefined && !temTurma && (
        <EstadoVazio
          titulo="Falta uma turma confirmada"
          descricao="O Assistente trabalha para as suas turmas. Confirme as suas turmas em Turmas; se nenhuma aparece lá, quem aloca é a coordenação."
          acao={{ rotulo: 'Ir para Turmas', aoAcionar: () => navegar(ROTAS_DO_PROFESSOR.turmas) }}
        />
      )}

      {/* Sem entrega nenhuma, a tela não fica vazia: diz o que o Assistente faz e como pedir (regra 50, item 6). */}
      {entregas.data !== undefined && todas.length === 0 && (vinculos.data === undefined || temTurma) && (
        <Cartao titulo="O que o Assistente de ensino faz por você">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="min-w-0 break-words text-apoio">
              Ele prepara a versão adaptada de uma atividade e corrige as objetivas da turma, e o que fez aparece aqui, esperando a sua decisão: nada chega ao aluno antes de você aprovar. Agora não há nada esperando você.
            </p>
            {assistente !== undefined && (
              <ul className="flex min-w-0 list-disc flex-col gap-1.5 pl-5 text-apoio">
                {assistente.funcoes.map((funcao) => (
                  <li key={funcao.chave} className="break-words">
                    <span className="font-medium text-tinta">{funcao.nome}: </span>
                    {funcao.fazSozinha}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Botao onClick={() => navegar(ROTAS_DO_PROFESSOR.novaConversa)}>Pedir ao Assistente</Botao>
              <Botao variante="secundario" onClick={() => navegar(ROTAS_DO_PROFESSOR.ferramentas)}>
                Ver as ferramentas
              </Botao>
            </div>
          </div>
        </Cartao>
      )}

      {todas.length > 0 && (
        <>
          {esperando.length > 0 && (
            // No celular a página rola e a faixa fica presa abaixo da barra do topo (56 px). A partir de 768 px a página não rola: a faixa fica parada acima da conversa.
            <section aria-labelledby={idDaFaixa} data-faixa-esperando="" className="sticky top-14 z-10 flex min-w-0 flex-col gap-2 rounded-cartao border border-pendente bg-pendente-cx p-3">
              <h2 id={idDaFaixa} className="sr-only">
                Esperando você
              </h2>
              {/*
                Uma pendência cabe numa linha. Com várias, a faixa presa ocuparia a tela do celular: fica recolhida no
                contador, e abre a pedido.
              */}
              {esperando.length === 1 ? (
                <>
                  <p aria-hidden="true" className="text-sm font-semibold text-pendente">
                    Esperando você
                  </p>
                  {listaDoQueEspera}
                </>
              ) : (
                <details className="group min-w-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-pendente md:min-h-9">
                    <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 group-open:rotate-90" />
                    {esperando.length} entregas esperando você
                  </summary>
                  {listaDoQueEspera}
                </details>
              )}
            </section>
          )}

          <div ref={topoDoPainel} className="min-w-0">
            <Abas
              classeDoPainel={O_MIOLO_DO_DOCUMENTO}
              rotulo="Filtro por função"
              abas={FILTROS_DO_TIME.map((item) => ({ id: item.id, rotulo: item.rotulo, ...(item.id === 'esperando' ? { contador: esperando.length } : {}) }))}
              ativa={filtro}
              aoMudar={(id) => {
                if (ehFiltroDoTime(id)) definirFiltro(id)
              }}
            >
              {visiveis.length === 0 ? (
                <p className="rounded-cartao border border-dashed border-borda-campo bg-superficie p-4 text-apoio">Nada neste filtro. Em "Tudo" está o que o Assistente já fez.</p>
              ) : (
                <Conversa rotulo="O que o Assistente de ensino fez">
                  {visiveis.map((entrega) => {
                    const suspensao = avisoDaFuncaoSuspensa(entrega, funcaoSuspensa(time.data, entrega.funcao))
                    return (
                    <div key={entrega.id} id={idDoCartao(entrega.id)} tabIndex={-1} data-entrega={entrega.estado} className="flex min-w-0 scroll-mt-48 flex-col gap-1 rounded-cartao">
                      <p className="text-[13px] text-sutil">{formatarDataHora(entrega.criadaEm)}</p>
                      <MensagemIA
                        variante="balao"
                        funcao={entrega.funcao}
                        aprovacao={{ aprovacao: aprovacaoDaEntrega(entrega), verbo: VERBO_DA_ENTREGA }}
                        acoes={
                          <>
                            {entrega.artefatoId !== null && (
                              // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
                              <Link to={caminhoDoArtefatoDoProfessor(entrega.artefatoId)} className={CLASSES_DA_ACAO}>
                                Abrir a versão<span className="sr-only">: {entrega.titulo}</span>
                              </Link>
                            )}
                            {/* O lote de correção não se aprova de dentro do balão: "Revisar" leva à tela dos destaques. */}
                            {entrega.tipo === 'lote_de_correcao' && entrega.atividadeAplicadaId !== null && (
                              <Link to={caminhoDaCorrecaoDoProfessor(entrega.atividadeAplicadaId)} className={entrega.estado === 'pendente' ? classesDoBotao({ variante: 'secundario' }).replaceAll('enabled:', '') : CLASSES_DA_ACAO}>
                                {entrega.estado === 'pendente' ? 'Revisar' : 'Ver a correção'}
                                <span className="sr-only">: {entrega.titulo}</span>
                              </Link>
                            )}
                            {decideAqui(entrega) && (
                              <>
                                <Botao variante="oficial" onClick={() => abrir(entrega, 'aprovar')}>
                                  Aprovar<span className="sr-only"> {entrega.titulo}</span>
                                </Botao>
                                <Botao variante="perigo" onClick={() => abrir(entrega, 'rejeitar')}>
                                  Rejeitar…<span className="sr-only"> {entrega.titulo}</span>
                                </Botao>
                              </>
                            )}
                          </>
                        }
                      >
                        {falaDaEntrega(entrega, nomes[entrega.turmaId])}
                      </MensagemIA>
                      {suspensao !== undefined && <AvisoNaEntregaDeFuncaoSuspensa texto={suspensao} />}
                    </div>
                    )
                  })}
                </Conversa>
              )}
              {/* Dentro do miolo: fora dele, a página passaria da janela (RF22). */}
              {entregas.hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Botao variante="secundario" onClick={() => void entregas.fetchNextPage()} disabled={entregas.isFetchingNextPage}>
                    {entregas.isFetchingNextPage ? 'Carregando…' : 'Ver mais entregas'}
                  </Botao>
                </div>
              )}
            </Abas>
          </div>
        </>
      )}

      {aberta?.decisao === 'aprovar' && (
        <DialogoDeConfirmacao
          titulo="Aprovar a versão adaptada"
          familia="oficial"
          resumo={resumoDaAprovacao(aberta.entrega, turmaDaAberta)}
          efeito={EFEITO_DE_APROVAR}
          rotuloDeConfirmar="Aprovar a versão adaptada"
          rotuloConfirmando="Aprovando…"
          aoConfirmar={confirmar}
          aoFechar={() => definirAberta(undefined)}
          confirmando={decidir.isPending}
          {...(falhaDaDecisao === undefined ? {} : { falha: falhaDaDecisao })}
          {...(focoDeReserva === undefined ? {} : { focoDeReserva })}
        />
      )}
      {aberta?.decisao === 'rejeitar' && (
        <DialogoDeConfirmacao
          titulo="Rejeitar a versão adaptada"
          familia="perigo"
          resumo={resumoDaAprovacao(aberta.entrega, turmaDaAberta)}
          efeito={EFEITO_DE_REJEITAR}
          rotuloDeConfirmar="Rejeitar a versão adaptada"
          rotuloConfirmando="Rejeitando…"
          aoConfirmar={confirmar}
          aoFechar={() => definirAberta(undefined)}
          confirmando={decidir.isPending}
          {...(falhaDaDecisao === undefined ? {} : { falha: falhaDaDecisao })}
          {...(focoDeReserva === undefined ? {} : { focoDeReserva })}
        >
          <CampoLongo
            rotulo="Por que você está rejeitando?"
            dica={AVISO_DA_JUSTIFICATIVA}
            valor={justificativa}
            aoMudar={definirJustificativa}
            obrigatorio
            desligado={decidir.isPending}
            erro={tentouRejeitar ? problemaDaJustificativa : undefined}
            {...LIMITES_DA_JUSTIFICATIVA}
          />
        </DialogoDeConfirmacao>
      )}
    </Tela>
  )
}
