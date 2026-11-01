import type { MinhaAtividade } from '@educa/shared'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { consultaEu } from '../../api/eu'
import { consultaMinhasAtividades } from '../../api/atividades-do-aluno'
import { caminhoDaAtividadeDoAluno, caminhoDoTutorNaAtividade, ROTAS_DO_ALUNO } from '../../paths'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../components/states'
import { AgentSignature } from '../../components/ui/ai/AgentSignature'
import { SECONDARY_LINK_CLASSES } from '../../components/ui/button-variants'
import { SectionHeader, Page } from '../../components/ui/Page'
import { useTituloDaTela } from '../../document-title'
import { AVISO_DA_AVALIACAO, resumoDaAtividade } from './atividades'
import { FaixaDeSupervisao } from './FaixaDeSupervisao'
import { saudacaoDoAluno, tarefasParaFazer, TEXTO_DO_VAZIO, TITULO_DO_VAZIO } from './inicio'

/** As duas leituras do Início envelhecem em 60 s e não se releem ao voltar para a aba (Tech Spec, seção 9): quem entra já as leu. */
const LEITURA_DO_INICIO = { staleTime: 60_000, refetchOnWindowFocus: false } as const

/**
 * Uma tarefa de "Para fazer": o título abre a tarefa, e "Pedir ajuda ao Tutor" leva à conversa dela. A avaliação aberta é
 * avisada **antes** de o aluno abrir, e o caminho até o Tutor continua (D36): quem decide se ele responde é o servidor,
 * e a caixa da conversa existe em todo estado. Os dois são links, e nenhum dentro do outro.
 */
function TarefaParaFazer({ atividade }: { atividade: MinhaAtividade }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <Link to={caminhoDaAtividadeDoAluno(atividade.id)} className="flex min-h-11 min-w-0 items-center text-base font-semibold text-tinta hover:underline">
          <span className="min-w-0 break-words">{atividade.titulo}</span>
        </Link>
        <p className="min-w-0 text-sm break-words text-sutil">{resumoDaAtividade(atividade)}</p>
        {atividade.avaliativa && <p className="min-w-0 text-sm break-words text-apoio">{AVISO_DA_AVALIACAO}</p>}
      </div>
      <Link to={caminhoDoTutorNaAtividade(atividade.id)} className={`${SECONDARY_LINK_CLASSES} self-start md:shrink-0`}>
        Pedir ajuda ao Tutor
      </Link>
    </li>
  )
}

/** A lista das até três tarefas e o caminho para todas; "Ver todas as tarefas" só depois de a leitura terminar. */
function ListaParaFazer({ tarefas, lida }: { tarefas: readonly MinhaAtividade[]; lida: boolean }) {
  return (
    <>
      {tarefas.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-2">
          {tarefas.map((atividade) => (
            <TarefaParaFazer key={atividade.id} atividade={atividade} />
          ))}
        </ul>
      )}
      {lida && (
        <Link to={ROTAS_DO_ALUNO.atividades} className={`${SECONDARY_LINK_CLASSES} self-start`}>
          Ver todas as tarefas
        </Link>
      )}
    </>
  )
}

function ParaFazer() {
  const atividades = useInfiniteQuery({ ...consultaMinhasAtividades, ...LEITURA_DO_INICIO })
  const paraFazer = tarefasParaFazer(atividades.data?.pages[0]?.itens ?? [])
  const lida = atividades.data !== undefined
  return (
    <section aria-labelledby="titulo-para-fazer" className="flex min-w-0 flex-col gap-3">
      <SectionHeader id="titulo-para-fazer" titulo="Para fazer" />
      {atividades.isPending && <EstadoCarregando rotulo="Carregando as suas tarefas…" />}
      {atividades.isError && !lida && (
        <EstadoErro erro={atividades.error} tentando={atividades.isFetching} aoTentarDeNovo={() => void atividades.refetch({ cancelRefetch: false })} />
      )}
      {lida && paraFazer.length === 0 && <EstadoVazio titulo={TITULO_DO_VAZIO} descricao={TEXTO_DO_VAZIO} />}
      <ListaParaFazer tarefas={paraFazer} lida={lida} />
    </section>
  )
}

/**
 * "Início" do aluno (telas do aluno e primeiro acesso, 3.0; RF4, RF5, RF10, RF20): é onde ele abre. A saudação do Tutor
 * (com a função e o selo "IA"), a faixa de supervisão, presa e sem fechar (D8), e até três tarefas "Para fazer", cada uma
 * com o caminho até o Tutor. **Não lê a conversa do Tutor nem mostra o uso do dia**: a leitura conta as trocas do mês da
 * turma inteira e iria para a rajada de login das 7h30 (regra 80; Tech Spec, 7c). O Início só lê `minhas-atividades`, que
 * o aluno já lia ao entrar, e o `/v1/eu`, que o desvio da entrada já leu.
 *
 * Os quatro estados: carregando; vazio, **só com a leitura terminada**; erro das tarefas, com "Tentar de novo" e a
 * saudação e a faixa de pé (nenhuma depende da leitura das tarefas); e com dado. Nada de colega, número de uso ou
 * recompensa (regra 50, item 9; D59). É aba de navegação: o `<h1>` existe só para o leitor de tela.
 */
export default function Inicio() {
  useTituloDaTela('Início')
  const eu = useQuery({ ...consultaEu, ...LEITURA_DO_INICIO })
  return (
    <Page titulo="Início" largura="conversa" tituloSoParaLeitor>
      <div className="pt-2">
        <AgentSignature agente="tutor" tamanho={40} />
        <p className="mt-3 text-3xl leading-tight font-bold break-words text-tinta">{saudacaoDoAluno(eu.data?.nome)}</p>
      </div>
      <FaixaDeSupervisao />
      <ParaFazer />
    </Page>
  )
}
