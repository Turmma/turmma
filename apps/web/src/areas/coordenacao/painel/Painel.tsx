import { ESTADOS_DO_PROFESSOR_ALOCAVEIS, type EstadoDoProfessor } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { consultaAnosLetivos, consultaDisciplinas, consultaSeries, consultaTurmas, consultaVinculos } from '../../../api/estrutura'
import { consultaConsumo, consultaFuncoesDaGovernanca, consultaPrimeiraPaginaDoResumo } from '../governanca/api/governanca'
import { consultaProfessores } from '../professores/api/professores'
import { caminhoDaAbaDaPrivacidade, ROTAS_DA_COORDENACAO } from '../../../paths'
import { Aviso } from '../../../components/ui/Aviso'
import { Botao } from '../../../components/ui/Botao'
import { CLASSES_DO_LINK_SECUNDARIO } from '../../../components/ui/button-variants'
import { Contador } from '../../../components/ui/Contador'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { Linha } from '../../../components/ui/Linha'
import { NumeroPainel } from '../../../components/ui/NumeroPainel'
import { A_PARTIR_DE_768, useMidia } from '../../../components/ui/media-query'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { CabecalhoDeSecao, Tela } from '../../../components/ui/Tela'
import { useTituloDaTela } from '../../../document-title'
import { SEM_LEITURA_SOZINHA, useFilaDaCoordenacao } from './fila-da-coordenacao'
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
 * - **Nenhuma leitura por tempo, foco ou rede** (regra 80): `SEM_LEITURA_SOZINHA` em todo observador, com cinco minutos de
 *   frescor. Abrir o Painel relê só o que passou disso.
 */
export default function Painel() {
  useTituloDaTela('Painel')
  // O miolo que rola recebe foco, para rolar pelo teclado, a partir de 768 px: abaixo disso rola a página, e não há o que focar.
  const comMiolo = useMidia(A_PARTIR_DE_768)
  return (
    <Tela titulo="Painel">
      <section aria-label="O Painel da escola" {...(comMiolo ? { tabIndex: 0 } : {})} className={`flex min-w-0 flex-col gap-4 ${O_MIOLO_SEM_ABAS_QUE_ROLA}`}>
        <FuncaoSuspensa />
        <ANoEscola />
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <EsperandoVoce />
          <ParaTerminarAEscola />
        </div>
      </section>
    </Tela>
  )
}

/**
 * As opções de leitura do Painel: as da consulta, mais "não reler sozinho". Vale para todo observador da tela, também os que
 * já existem na fila do sino: um observador com o frescor padrão (30 s) leria de novo o que a fila acabou de ler.
 */
function semLeituraSozinha<Opcoes extends object>(opcoes: Opcoes): Opcoes & typeof SEM_LEITURA_SOZINHA {
  return { ...opcoes, ...SEM_LEITURA_SOZINHA }
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
  const funcoes = useQuery(semLeituraSozinha(consultaFuncoesDaGovernanca))
  if (funcoes.data === undefined) {
    return funcoes.isError ? (
      <EstadoErro erro={funcoes.error} tentando={funcoes.isFetching} aoTentarDeNovo={() => void funcoes.refetch()} />
    ) : (
      <EstadoCarregando rotulo="Verificando se alguma IA está suspensa…" />
    )
  }
  const suspensas = funcoes.data.agentes.flatMap((agente) => agente.funcoes).filter((funcao) => funcao.suspensao !== null)
  if (suspensas.length === 0) return null
  const frase = suspensas.length === 1 ? 'Ela recusa pedido novo até ser retomada.' : 'Elas recusam pedido novo até ser retomada.'
  return (
    <Aviso
      tom="atencao"
      titulo={suspensas.length === 1 ? 'Uma função de IA está suspensa nesta escola' : 'Funções de IA estão suspensas nesta escola'}
      acao={
        <Link to={ROTAS_DA_COORDENACAO.agentes} className={CLASSES_DO_LINK_SECUNDARIO}>
          Ver como cada IA trabalha
        </Link>
      }
    >
      {suspensas.map((funcao) => nomeDaFuncao(funcao.chave)).join('; ')}. {frase}
    </Aviso>
  )
}

/** Os quatro números da IA na escola e o consumo do mês, cada um com a sua leitura. */
function ANoEscola() {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <CabecalhoDeSecao
        id={idDoTitulo}
        titulo="A IA nesta escola"
        apoio="No ano letivo em curso, somado para a escola toda."
        acao={
          <Link to={ROTAS_DA_COORDENACAO.governanca} className={CLASSES_DO_LINK_SECUNDARIO}>
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
  const resumo = useQuery(semLeituraSozinha(consultaPrimeiraPaginaDoResumo))
  if (resumo.data === undefined) {
    return resumo.isError ? (
      <EstadoErro erro={resumo.error} tentando={resumo.isFetching} aoTentarDeNovo={() => void resumo.refetch()} />
    ) : (
      <EstadoCarregando rotulo="Carregando os números da IA…" />
    )
  }
  // Os números vêm em toda página: o Painel lê só a primeira (`consultaPrimeiraPaginaDoResumo`), e vale a mais recente que o cache tiver.
  const numeros = resumo.data.pages.at(-1)?.numeros ?? { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <NumeroPainel rotulo="Gerado por IA" valor={numeros.geradoPorIa} apoio="Atividades, planos, versões adaptadas e correções" />
      <NumeroPainel rotulo="Aprovado por gente" valor={numeros.aprovadoPorPessoa} apoio="Versões adaptadas e correções que um professor aprovou" />
      <NumeroPainel rotulo="Esperando o professor" valor={numeros.esperando} apoio="Só valem depois da decisão dele" />
      <NumeroPainel rotulo="Rejeitado" valor={numeros.rejeitado} apoio="O professor recusou, com justificativa" />
    </div>
  )
}

/** O consumo do mês numa linha: somado, nunca por função, por professor nem por aluno (D64). */
function OConsumoDoMes() {
  const consumo = useQuery(semLeituraSozinha(consultaConsumo))
  if (consumo.data === undefined) {
    return consumo.isError ? (
      <EstadoErro erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch()} />
    ) : (
      <EstadoCarregando rotulo="Carregando o consumo do mês…" />
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
      <CabecalhoDeSecao id={idDoTitulo} titulo="Esperando você" />
      {fila.situacao === 'carregando' && <EstadoCarregando rotulo="Carregando o que espera você…" />}
      {fila.situacao === 'erro' && <EstadoErro erro={fila.erro} tentando={fila.tentandoDeNovo} aoTentarDeNovo={fila.tentarDeNovo} />}
      {fila.situacao === 'parcial' && (
        <Aviso
          tom="atencao"
          acao={
            <Botao variante="secundario" disabled={fila.tentandoDeNovo} onClick={fila.tentarDeNovo}>
              {fila.tentandoDeNovo ? 'Tentando de novo…' : 'Tentar de novo'}
            </Botao>
          }
        >
          Parte da lista não carregou
        </Aviso>
      )}
      {(fila.situacao === 'pronta' || fila.situacao === 'parcial') && fila.itens.length > 0 && (
        <Lista rotulo="Itens que esperam você">
          {fila.itens.map((item) => (
            <li key={item.id}>
              <Linha
                para={item.para}
                titulo={item.titulo}
                abaixo={item.detalhe}
                {...(item.contador === undefined && !item.urgente
                  ? {}
                  : {
                      fim: (
                        <>
                          {item.urgente && <Estado familia="erro">Urgente</Estado>}
                          {item.contador !== undefined && <Contador n={item.contador.n} oQueConta={item.contador.oQueConta} />}
                        </>
                      ),
                    })}
              />
            </li>
          ))}
        </Lista>
      )}
      {fila.situacao === 'pronta' && fila.itens.length === 0 && <EstadoVazio titulo="Tudo em dia" descricao="Nada espera a coordenação agora." />}
      <ul className="overflow-hidden rounded-cartao border-2 border-borda">
        <li>
          <Linha para={caminhoDaAbaDaPrivacidade('pedidos')} titulo="Pedidos dos titulares" abaixo="Os prazos aparecem ao abrir. Cada leitura fica na auditoria." />
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
  const anos = useQuery(semLeituraSozinha(consultaAnosLetivos))
  const anoEmCurso = anos.data?.itens.find((ano) => ano.situacao === 'em_curso')
  const series = useQuery(semLeituraSozinha(consultaSeries))
  const disciplinas = useQuery(semLeituraSozinha(consultaDisciplinas))
  // Turmas e vínculos são do ano em curso: sem ele a API responde como inexistente, e o Painel nem pergunta.
  const turmas = useQuery({ ...semLeituraSozinha(consultaTurmas), enabled: anoEmCurso !== undefined })
  const professores = useQuery(semLeituraSozinha(consultaProfessores))
  const vinculos = useQuery({ ...semLeituraSozinha(consultaVinculos), enabled: anoEmCurso !== undefined })

  const cabecalho = <CabecalhoDeSecao id={idDoTitulo} titulo="Para terminar a escola" />

  if (anos.data === undefined) {
    return (
      <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
        {cabecalho}
        {anos.isError ? (
          <EstadoErro erro={anos.error} tentando={anos.isFetching} aoTentarDeNovo={() => void anos.refetch()} />
        ) : (
          <EstadoCarregando rotulo="Carregando o que falta para a escola…" />
        )}
      </section>
    )
  }

  if (anos.data.itens.length === 0) {
    return (
      <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
        {cabecalho}
        <EstadoVazio
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
  // TanStack cancela a leitura que corre e começa outra a cada clique. Os blocos sem dado (`EstadoErro`) já reaproveitam a que corre.

  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      {cabecalho}
      {falhas.length > 0 && (
        <Aviso
          tom="atencao"
          acao={
            <Botao variante="secundario" onClick={() => falhas.forEach((consulta) => void consulta.refetch({ cancelRefetch: false }))}>
              Tentar de novo
            </Botao>
          }
        >
          Parte do que falta não carregou
        </Aviso>
      )}
      {faltam.length > 0 && <Lista rotulo="Passos que faltam">{faltam.map((passo) => <PassoQueFalta key={passo.titulo} passo={passo} />)}</Lista>}
      {montada && (
        <EstadoVazio titulo="A escola está montada" descricao="O ano, as séries, as disciplinas, as turmas, os professores e a alocação estão feitos. A lista de nomes de cada turma se confere abrindo a turma: o Painel não a lê, porque cada leitura fica na auditoria." />
      )}
      {faltam.length === 0 && !montada && falhas.length === 0 && <EstadoCarregando rotulo="Carregando o que falta para a escola…" />}
    </section>
  )
}

function PassoQueFalta({ passo }: { readonly passo: PassoDoRoteiro }) {
  return (
    <li>
      <Linha para={passo.para} titulo={passo.titulo} abaixo={passo.acao} fim={<Estado familia="pendente">Falta</Estado>} />
    </li>
  )
}
