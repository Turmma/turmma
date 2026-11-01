import { ESTADOS_DO_PROFESSOR_ALOCAVEIS, type EstadoDoProfessor } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { anosLetivosQueryOptions, disciplinasQueryOptions, seriesQueryOptions, turmasQueryOptions, vinculosQueryOptions } from '../../../api/estrutura'
import { consumoQueryOptions, funcoesDaGovernancaQueryOptions, primeiraPaginaDoResumoQueryOptions } from '../governanca/api/governanca'
import { professoresQueryOptions } from '../professores/api/professores'
import { caminhoDaAbaDaPrivacidade, COORDENACAO_ROUTES } from '../../../paths'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { CountBadge } from '../../../components/ui/CountBadge'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { ListItem } from '../../../components/ui/ListItem'
import { StatCard } from '../../../components/ui/StatCard'
import { MEDIA_MD, useMediaQuery } from '../../../components/ui/media-query'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SectionHeader, Page } from '../../../components/ui/Page'
import { usePageTitle } from '../../../document-title'
import { NO_AUTO_REFETCH, useFilaDaCoordenacao } from './fila-da-coordenacao'
import { O_MIOLO_SEM_ABAS_QUE_ROLA } from '../comum/miolo-que-rola'
import { oQueFaltaDaEscola, PARA_O_ANO, passosDoRoteiro, type PassoDoRoteiro } from '../estrutura/o-que-falta-da-escola'
import { nomeDaFuncao, textoDoConsumo, textoDoPacoteDoTutor } from '../governanca/textos-da-governanca'

/**
 * Painel (telas da coordenação, 2.0; RF6 e RF7; Tech Spec seções 5, 7c e 9): é onde a coordenação vê, numa tela só, os
 * números da IA na escola, o que espera por ela e o que falta para terminar a escola. Não tem consulta nem rota nova: lê o
 * que a Governança, a Estrutura e o sino já leem, com as mesmas chaves.
 *
 * - **Nada aqui é indicador de professor, de turma ou de pedido de titular** (regra 70, itens 8 e 9; D45, D64): os quatro
 *   números são da escola, a fila tem os cinco tipos do sino e o único número de item é o das turmas sem professor. Os
 *   pedidos de titular entram por uma porta fixa, **sem contagem**: contá-los seria ler a lista, e cada leitura é auditada
 *   (regra 20, item 10). O mesmo vale para a lista de nomes das turmas.
 * - **Cada bloco tem o seu carregando, o seu erro e o seu "Tentar de novo"**: um bloco que falha não derruba os outros.
 * - **Nenhuma leitura por tempo, foco ou rede** (regra 80): `NO_AUTO_REFETCH` em todo observador, com cinco minutos de
 *   frescor. Abrir o Painel relê só o que passou disso.
 */
export default function Painel() {
  usePageTitle('Painel')
  // O miolo que rola recebe foco, para rolar pelo teclado, a partir de 768 px: abaixo disso rola a página, e não há o que focar.
  const comMiolo = useMediaQuery(MEDIA_MD)
  return (
    <Page titulo="Painel">
      <section aria-label="O Painel da escola" {...(comMiolo ? { tabIndex: 0 } : {})} className={`flex min-w-0 flex-col gap-4 ${O_MIOLO_SEM_ABAS_QUE_ROLA}`}>
        <FuncaoSuspensa />
        <ANoEscola />
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <EsperandoVoce />
          <ParaTerminarAEscola />
        </div>
      </section>
    </Page>
  )
}

/**
 * As opções de leitura do Painel: as da consulta, mais "não reler sozinho". Vale para todo observador da tela, também os que
 * já existem na fila do sino: um observador com o frescor padrão (30 s) leria de novo o que a fila acabou de ler.
 */
function semLeituraSozinha<Opcoes extends object>(opcoes: Opcoes): Opcoes & typeof NO_AUTO_REFETCH {
  return { ...opcoes, ...NO_AUTO_REFETCH }
}

/** Quanto cabe numa lista antes de ela rolar por dentro. Que a página não role a 1366 × 768 (RF23) é do miolo do Painel (`O_MIOLO_SEM_ABAS_QUE_ROLA`); as listas só limitam a própria altura dentro dele. */
const LISTA_QUE_ROLA = 'max-h-[clamp(9rem,calc(100dvh_-_40rem),18rem)] overflow-y-auto'

function Lista({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div role="region" aria-label={rotulo} tabIndex={0} className={`${LISTA_QUE_ROLA} rounded-cartao`}>
      <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda">{children}</ul>
    </div>
  )
}

/** Uma função de IA suspensa na escola: o aviso e o caminho até Agentes, onde se retoma. Sem suspensão, o bloco não existe. */
function FuncaoSuspensa() {
  const funcoes = useQuery(semLeituraSozinha(funcoesDaGovernancaQueryOptions))
  if (funcoes.data === undefined) {
    return funcoes.isError ? (
      <ErrorState erro={funcoes.error} tentando={funcoes.isFetching} aoTentarDeNovo={() => void funcoes.refetch()} />
    ) : (
      <LoadingState rotulo="Verificando se alguma IA está suspensa…" />
    )
  }
  const suspensas = funcoes.data.agentes.flatMap((agente) => agente.funcoes).filter((funcao) => funcao.suspensao !== null)
  if (suspensas.length === 0) return null
  const frase = suspensas.length === 1 ? 'Ela recusa pedido novo até ser retomada.' : 'Elas recusam pedido novo até ser retomada.'
  return (
    <Alert
      tom="atencao"
      titulo={suspensas.length === 1 ? 'Uma função de IA está suspensa nesta escola' : 'Funções de IA estão suspensas nesta escola'}
      acao={
        <Link to={COORDENACAO_ROUTES.agentes} className={SECONDARY_LINK_CLASSES}>
          Ver como cada IA trabalha
        </Link>
      }
    >
      {suspensas.map((funcao) => nomeDaFuncao(funcao.chave)).join('; ')}. {frase}
    </Alert>
  )
}

/** Os quatro números da IA na escola e o consumo do mês, cada um com a sua leitura. */
function ANoEscola() {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        id={idDoTitulo}
        titulo="A IA nesta escola"
        apoio="No ano letivo em curso, somado para a escola toda."
        acao={
          <Link to={COORDENACAO_ROUTES.governanca} className={SECONDARY_LINK_CLASSES}>
            Ver em Registros
          </Link>
        }
      />
      <OsQuatroNumeros />
      <OConsumoDoMes />
    </section>
  )
}

function OsQuatroNumeros() {
  const resumo = useQuery(semLeituraSozinha(primeiraPaginaDoResumoQueryOptions))
  if (resumo.data === undefined) {
    return resumo.isError ? (
      <ErrorState erro={resumo.error} tentando={resumo.isFetching} aoTentarDeNovo={() => void resumo.refetch()} />
    ) : (
      <LoadingState rotulo="Carregando os números da IA…" />
    )
  }
  // Os números vêm em toda página: o Painel lê só a primeira (`primeiraPaginaDoResumoQueryOptions`), e vale a mais recente que o cache tiver.
  const numeros = resumo.data.pages.at(-1)?.numeros ?? { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard rotulo="Gerado por IA" valor={numeros.geradoPorIa} apoio="Atividades, planos, versões adaptadas e correções" />
      <StatCard rotulo="Aprovado por gente" valor={numeros.aprovadoPorPessoa} apoio="Versões adaptadas e correções que um professor aprovou" />
      <StatCard rotulo="Esperando o professor" valor={numeros.esperando} apoio="Só valem depois da decisão dele" />
      <StatCard rotulo="Rejeitado" valor={numeros.rejeitado} apoio="O professor recusou, com justificativa" />
    </div>
  )
}

/** O consumo do mês numa linha: somado, nunca por função, por professor nem por aluno (D64). */
function OConsumoDoMes() {
  const consumo = useQuery(semLeituraSozinha(consumoQueryOptions))
  if (consumo.data === undefined) {
    return consumo.isError ? (
      <ErrorState erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch()} />
    ) : (
      <LoadingState rotulo="Carregando o consumo do mês…" />
    )
  }
  if (consumo.data.porFuncao.length === 0) return <p className="t-apoio text-sutil">Nenhuma função da IA trabalhou neste mês.</p>
  return (
    <p className="t-apoio text-apoio">
      Consumo do mês: {textoDoConsumo(consumo.data.total)}. Trocas dos alunos com o Tutor: {textoDoPacoteDoTutor(consumo.data.tutor)}.
    </p>
  )
}

/**
 * O que espera a coordenação: os itens da fila do sino (a mesma conta, as mesmas leituras) e, sempre, a porta dos pedidos
 * dos titulares, sem número. Fila lida em parte nunca diz "Tudo em dia".
 */
function EsperandoVoce() {
  const idDoTitulo = useId()
  const fila = useFilaDaCoordenacao()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <SectionHeader id={idDoTitulo} titulo="Esperando você" />
      {fila.situacao === 'carregando' && <LoadingState rotulo="Carregando o que espera você…" />}
      {fila.situacao === 'erro' && <ErrorState erro={fila.erro} tentando={fila.tentandoDeNovo} aoTentarDeNovo={fila.tentarDeNovo} />}
      {fila.situacao === 'parcial' && (
        <Alert
          tom="atencao"
          acao={
            <Button variante="secundario" disabled={fila.tentandoDeNovo} onClick={fila.tentarDeNovo}>
              {fila.tentandoDeNovo ? 'Tentando de novo…' : 'Tentar de novo'}
            </Button>
          }
        >
          Parte da lista não carregou
        </Alert>
      )}
      {(fila.situacao === 'pronta' || fila.situacao === 'parcial') && fila.itens.length > 0 && (
        <Lista rotulo="Itens que esperam você">
          {fila.itens.map((item) => (
            <li key={item.id}>
              <ListItem
                para={item.para}
                titulo={item.titulo}
                abaixo={item.detalhe}
                {...(item.contador === undefined && !item.urgente
                  ? {}
                  : {
                      fim: (
                        <>
                          {item.urgente && <StatusBadge familia="erro">Urgente</StatusBadge>}
                          {item.contador !== undefined && <CountBadge n={item.contador.n} oQueConta={item.contador.oQueConta} />}
                        </>
                      ),
                    })}
              />
            </li>
          ))}
        </Lista>
      )}
      {fila.situacao === 'pronta' && fila.itens.length === 0 && <EmptyState titulo="Tudo em dia" descricao="Nada espera a coordenação agora." />}
      <ul className="overflow-hidden rounded-cartao border-2 border-borda">
        <li>
          <ListItem para={caminhoDaAbaDaPrivacidade('pedidos')} titulo="Pedidos dos titulares" abaixo="Os prazos aparecem ao abrir. Cada leitura fica na auditoria." />
        </li>
      </ul>
    </section>
  )
}

/**
 * O que falta para terminar a escola: só os passos que faltam, cada um com o link da tela onde se faz. Sem ano letivo, o
 * convite a começar por ele; com tudo feito, "A escola está montada". **Um passo que não foi lido não vira "falta"** (mandaria
 * a coordenação criar o que a escola já tem): a leitura que falhou (`isError`) ganha o aviso e o "Tentar de novo", e a frase de escola
 * montada espera todas as leituras.
 */
function ParaTerminarAEscola() {
  const idDoTitulo = useId()
  const [, navegar] = useLocation()
  const anos = useQuery(semLeituraSozinha(anosLetivosQueryOptions))
  const anoEmCurso = anos.data?.itens.find((ano) => ano.situacao === 'em_curso')
  const series = useQuery(semLeituraSozinha(seriesQueryOptions))
  const disciplinas = useQuery(semLeituraSozinha(disciplinasQueryOptions))
  // Turmas e vínculos são do ano em curso: sem ele a API responde como inexistente, e o Painel nem pergunta.
  const turmas = useQuery({ ...semLeituraSozinha(turmasQueryOptions), enabled: anoEmCurso !== undefined })
  const professores = useQuery(semLeituraSozinha(professoresQueryOptions))
  const vinculos = useQuery({ ...semLeituraSozinha(vinculosQueryOptions), enabled: anoEmCurso !== undefined })

  const cabecalho = <SectionHeader id={idDoTitulo} titulo="Para terminar a escola" />

  if (anos.data === undefined) {
    return (
      <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
        {cabecalho}
        {anos.isError ? (
          <ErrorState erro={anos.error} tentando={anos.isFetching} aoTentarDeNovo={() => void anos.refetch()} />
        ) : (
          <LoadingState rotulo="Carregando o que falta para a escola…" />
        )}
      </section>
    )
  }

  if (anos.data.itens.length === 0) {
    return (
      <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
        {cabecalho}
        <EmptyState
          titulo="Comece pelo ano letivo"
          descricao="As turmas nascem no ano letivo em curso."
          acao={{ rotulo: 'Criar o ano letivo', aoAcionar: () => navegar(PARA_O_ANO) }}
        />
      </section>
    )
  }

  const alocaveis = professores.data?.itens.filter((professor) => (ESTADOS_DO_PROFESSOR_ALOCAVEIS as readonly EstadoDoProfessor[]).includes(professor.estado))
  const passos = passosDoRoteiro({
    anoEmCurso: anoEmCurso !== undefined,
    series: series.data?.itens.length,
    disciplinas: disciplinas.data?.itens.length,
    turmas: anoEmCurso === undefined ? 0 : turmas.data?.itens.length,
    professores: alocaveis?.length,
    vinculos: anoEmCurso === undefined ? 0 : vinculos.data?.itens.length,
  })
  const { faltam, montada } = oQueFaltaDaEscola(passos)
  const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
  // `cancelRefetch: false` porque a consulta pode ter dado de antes (a releitura que falhou o deixa no cache): com dado, o padrão do
  // TanStack cancela a leitura que corre e começa outra a cada clique. Os blocos sem dado (`ErrorState`) já reaproveitam a que corre.

  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      {cabecalho}
      {falhas.length > 0 && (
        <Alert
          tom="atencao"
          acao={
            <Button variante="secundario" onClick={() => falhas.forEach((consulta) => void consulta.refetch({ cancelRefetch: false }))}>
              Tentar de novo
            </Button>
          }
        >
          Parte do que falta não carregou
        </Alert>
      )}
      {faltam.length > 0 && <Lista rotulo="Passos que faltam">{faltam.map((passo) => <PassoQueFalta key={passo.titulo} passo={passo} />)}</Lista>}
      {montada && (
        <EmptyState titulo="A escola está montada" descricao="O ano, as séries, as disciplinas, as turmas, os professores e a alocação estão feitos. A lista de nomes de cada turma se confere abrindo a turma: o Painel não a lê, porque cada leitura fica na auditoria." />
      )}
      {faltam.length === 0 && !montada && falhas.length === 0 && <LoadingState rotulo="Carregando o que falta para a escola…" />}
    </section>
  )
}

function PassoQueFalta({ passo }: { readonly passo: PassoDoRoteiro }) {
  return (
    <li>
      <ListItem para={passo.para} titulo={passo.titulo} abaixo={passo.acao} fim={<StatusBadge familia="pendente">Falta</StatusBadge>} />
    </li>
  )
}
