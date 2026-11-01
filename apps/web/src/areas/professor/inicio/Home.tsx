import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { emCurso } from '../../../api/ciclo-de-execucao'
import { euQueryOptions } from '../../../api/eu'
import { useExecutionLifecycle } from '../../../api/execucoes'
import { useTabStore } from '../../../api/tab-store'
import { timeQueryOptions, funcaoSuspensa } from '../assistente/api/time'
import { meusVinculosQueryOptions } from '../comum/api/vinculos'
import { PROFESSOR_ROUTES } from '../../../paths'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { AgentSignature } from '../../../components/ui/ai/AgentSignature'
import { Page } from '../../../components/ui/Page'
import { usePageTitle } from '../../../document-title'
import { AvisoDeIA, AvisoDeSuspensao } from '../comum/avisos'
import { CaixaDoAssistente } from '../assistente/CaixaDoAssistente'
import { CICLO_DA_CONVERSA, CONTEXTO_ESCOLHIDO, enviarPedidoDaConversa } from '../assistente/memoria-do-professor'
import { saudacao } from './saudacao'
import { turmaEscolhida, turmasDaProfessora } from '../comum/turmas-da-professora'

/**
 * A Home do professor, "Início" (D73, D80; `docs/interface.md` 11.5): o Assistente de ensino se apresenta — a onça, a
 * função e o selo "IA" (regra 70, item 4a) —, a saudação pela hora, a caixa de pedido e um atalho por ferramenta. **O que
 * espera a professora não está aqui: está no sino** (`SinoDoProfessor`), em toda tela; a Home não lê entrega nenhuma.
 * Não há enfeite no lugar, nem pílula da aula (a linha do dia nasce com a grade, F8), nem anexo ou busca na web (F7).
 *
 * É uma tela de conversa: o `h1` só para o leitor de tela, e o grupo inteiro a **um terço da altura livre**, com o dobro
 * de espaço embaixo do que em cima.
 *
 * Na caixa, o contexto é a **turma e a disciplina** (das turmas com vínculo confirmado dela), e embaixo ficam os atalhos
 * (`AtalhosDeFerramenta`). Enviar leva à conversa:
 * - o pedido escrito vai sempre ao Assistente, que responde ou pergunta se ela quer a ferramenta (D18);
 * - o atalho da atividade ou do plano abre o cartão da ferramenta já na conversa, com a turma e, como tema, o que está na
 *   caixa, e nenhum pedido é gasto perguntando o que ela já disse;
 * - o atalho da **Adaptação** abre o cartão dela direto, e **nunca recebe o que foi escrito na caixa** (D35, D67).
 *
 * Os quatro estados são os das turmas dela: carregando, erro, vazio (o que falta, e onde resolver) e com dado.
 */
export default function Home() {
  usePageTitle('Início')
  const [, navegar] = useLocation()
  const eu = useQuery(euQueryOptions)
  const vinculos = useInfiniteQuery(meusVinculosQueryOptions)
  const time = useQuery(timeQueryOptions)
  const contexto = useTabStore(CONTEXTO_ESCOLHIDO)
  const { ciclo, iniciar } = useExecutionLifecycle(CICLO_DA_CONVERSA, enviarPedidoDaConversa)
  // A hora de quando a tela abriu: a saudação não muda com a professora olhando para ela.
  const [agora] = useState(() => new Date())

  const turmas = turmasDaProfessora(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? [])
  const turma = turmaEscolhida(turmas, contexto)
  const suspensa = funcaoSuspensa(time.data, 'conversa_e_ferramentas')
  const adaptacaoSuspensa = funcaoSuspensa(time.data, 'adaptacao')
  const respondendo = emCurso(ciclo)

  return (
    <Page titulo="Início" largura="conversa" tituloSoParaLeitor>
      {/* Uma coluna de três linhas, 1fr · auto · 2fr: o grupo fica na do meio, a um terço da altura livre. O piso é a janela
          menos a casca (barra de cima, margens e a barra de baixo do celular), e a tela cresce além dele se o grupo pedir. */}
      <div className="grid min-h-[calc(100dvh-14rem)] min-w-0 grid-rows-[1fr_auto_2fr] md:min-h-[calc(100dvh-9rem)]">
        <div data-grupo-do-inicio="" className="row-start-2 flex min-w-0 flex-col gap-6 pb-4">
          <div className="flex min-w-0 flex-col items-center gap-3 text-center">
            <AgentSignature agente="assistente_de_ensino" tamanho={40} />
            <div className="min-w-0">
              <p className="text-[28px] leading-tight break-words text-tinta">{saudacao(eu.data?.nome, agora)}</p>
              <p className="mt-1 text-lg text-sutil">O que vamos preparar hoje?</p>
            </div>
          </div>

          {vinculos.isPending && <LoadingState rotulo="Carregando as suas turmas…" />}
          {vinculos.isError && <ErrorState erro={vinculos.error} tentando={vinculos.isFetching} aoTentarDeNovo={() => void vinculos.refetch({ cancelRefetch: false })} />}
          {vinculos.data !== undefined && turma === undefined && (
            <EmptyState
              titulo="Falta uma turma confirmada"
              descricao="O Assistente trabalha a partir do material de uma turma e de uma disciplina suas. Confirme as suas turmas em Turmas; se nenhuma aparece lá, quem aloca é a coordenação."
              acao={{ rotulo: 'Ir para Turmas', aoAcionar: () => navegar(PROFESSOR_ROUTES.turmas) }}
            />
          )}

          {turma !== undefined && (
            <div className="flex min-w-0 flex-col gap-3">
              {suspensa && <AvisoDeSuspensao funcao="conversa_e_ferramentas" />}
              {adaptacaoSuspensa && <AvisoDeSuspensao funcao="adaptacao" />}
              <CaixaDoAssistente
                turmas={turmas}
                turma={turma}
                iniciar={iniciar}
                respondendo={respondendo}
                desligada={suspensa}
                depois={() => navegar(PROFESSOR_ROUTES.conversa)}
                semMenu
                funcaoSuspensa={(funcao) => funcaoSuspensa(time.data, funcao)}
              />
              <AvisoDeIA />
              <p className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 text-sm text-sutil">
                <span className="min-w-0 break-words" role="status">
                  {respondendo ? 'O Assistente ainda está respondendo ao seu último pedido.' : ''}
                </span>
                {/* Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela. */}
                <Link to={PROFESSOR_ROUTES.conversa} className="inline-flex min-h-11 items-center gap-1 text-caramelo-texto underline md:min-h-9">
                  Abrir a conversa com o Assistente
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
