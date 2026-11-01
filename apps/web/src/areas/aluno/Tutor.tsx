import { ErrorCode } from '@educa/shared'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, Hourglass, Lock, MoonStar, PauseCircle, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearch } from 'wouter'
import { consultaMinhasAtividades } from '../../api/atividades-do-aluno'
import { CHAVE_DA_CONVERSA_DO_TUTOR } from '../../api/chaves-do-aluno'
import { emCurso } from '../../api/ciclo-de-execucao'
import { ErroDaApi } from '../../api/client'
import { useCicloDeExecucao } from '../../api/execucoes'
import { consultaConversaDoTutor, mensagensDoTutorEmOrdem } from '../../api/tutor'
import { caminhoDaAtividadeDoAluno } from '../../paths'
import { StickyFooter } from '../../components/ui/StickyFooter'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Button } from '../../components/ui/Button'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../components/states'
import { AgentSignature } from '../../components/ui/ai/AgentSignature'
import { PromptInput } from '../../components/ui/ai/PromptInput'
import { Conversation as ListaDeMensagens, AIMessage, UserMessage, ThinkingIndicator } from '../../components/ui/ai/Message'
import { AIText } from '../../components/ui/ai/AIText'
import { Page } from '../../components/ui/Page'
import { useTituloDaTela } from '../../document-title'
import { EscolhaDaAtividade } from './EscolhaDaAtividade'
import { FaixaDeSupervisao } from './FaixaDeSupervisao'
import { CICLO_DO_TUTOR, enviarPerguntaAoTutor } from './memoria-do-aluno'
import {
  avisoDaPausa,
  LINHA_DO_CVV,
  itensDoTutor,
  marcaDoFim,
  partesDoEncaminhamento,
  pausaDoEstado,
  pausaNaTela,
  pendenteNoTutor,
  questaoDoEndereco,
  recusaVencida,
  TELEFONE_DO_CVV,
  temTelefone,
  usoDoDia,
  type FalhaDaPergunta,
  type PausaDoTutor,
} from './tutor'

/** O aluno não alcança o título do material (`GET /v1/materiais` é do professor e da coordenação): o chip diz a página. */
const SEM_TITULOS = {}

const ICONE_DA_PAUSA: Readonly<Record<PausaDoTutor, LucideIcon>> = { avaliacao: Lock, limite_do_dia: MoonStar, pacote_do_mes: MoonStar, fora: PauseCircle, suspenso: PauseCircle }

/**
 * O Tutor pausado: **uma tela que explica, com ícone e uma frase, e não parece erro** (11.6). Cinza, sem botão de tentar
 * de novo, sem contagem. Anunciada com calma ao leitor de tela.
 */
function Pausa({ pausa, avaliacao, limiteDoDia }: { pausa: PausaDoTutor; avaliacao: string | undefined; limiteDoDia: number | undefined }) {
  const Icone = ICONE_DA_PAUSA[pausa]
  const { titulo, texto } = avisoDaPausa(pausa, { avaliacao, limiteDoDia })
  return (
    <div role="status" data-pausa-do-tutor={pausa} className="flex min-w-0 items-start gap-3 rounded-cartao border border-linha bg-superficie p-4">
      <Icone aria-hidden="true" size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-sutil" />
      <p className="min-w-0 break-words text-apoio">
        <span className="font-semibold text-tinta">{titulo}</span> {texto}
      </p>
    </div>
  )
}

/**
 * A mensagem fixa de assunto delicado (D36), com desenho próprio: calma, cinza, **sem animação e sem alarme**. O texto é
 * o que a API mandou; o 188 é texto que se seleciona e link `tel:`, e está sempre lá. Continua assinada pelo Tutor, com
 * o selo "IA": ele não se passa por pessoa (D58).
 */
function Encaminhamento({ texto }: { texto: string }) {
  const paragrafos = partesDoEncaminhamento(texto)
  const telefone = (
    <a href={`tel:${TELEFONE_DO_CVV}`} className="font-semibold text-tinta underline select-text">
      {TELEFONE_DO_CVV}
    </a>
  )
  return (
    <article data-assunto-delicado="" className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-info-cx p-4 text-base text-info">
      <AgentSignature agente="tutor" />
      {paragrafos.map((paragrafo, posicao) => (
        // A ordem dos parágrafos da mensagem fixa não muda: a posição é a chave.
        <p key={posicao} className="min-w-0 break-words">
          {paragrafo.map((parte, indice) =>
            parte.tipo === 'telefone' ? (
              <a key={indice} href={`tel:${parte.numero}`} className="font-semibold text-tinta underline select-text">
                {parte.numero}
              </a>
            ) : (
              parte.texto
            ),
          )}
        </p>
      ))}
      {!temTelefone(paragrafos) && (
        <p className="min-w-0 break-words">
          {LINHA_DO_CVV.antes}
          {telefone}
          {LINHA_DO_CVV.depois}
        </p>
      )}
    </article>
  )
}

/**
 * A pergunta que não teve resposta, dentro da conversa: **nunca o código nem o erro cru** (regra 80, item 4), e sem
 * vermelho. A pergunta continua na conversa; aqui vai o que houve e, quando adianta, "Tentar de novo".
 */
function FalhaNaConversa({ falha, aoTentarDeNovo }: { falha: FalhaDaPergunta; aoTentarDeNovo: () => void }) {
  // A recusa por pausa não é falha: o aviso da pausa, logo abaixo da conversa, é quem explica.
  if (falha.tipo === 'pausa') return <p className="self-end text-sm text-sutil">O Tutor não recebeu esta mensagem.</p>
  const Icone = falha.tipo === 'esperar' ? Hourglass : CircleAlert
  return (
    <div data-falha-do-tutor={falha.tipo} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-controle bg-info-cx p-3 text-info">
      <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-base">
        <Icone aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words">{falha.texto}</span>
      </p>
      {falha.tipo !== 'explicada' && (
        <Button variante="secundario" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

/**
 * A conversa do aluno com o Tutor numa atividade (`docs/interface.md` 11.6). Quem escreve fica à direita, em bolha; o
 * Tutor não tem bolha e **sempre assina**, com o selo "IA", e mostra a página de onde tirou.
 *
 * - **A caixa é só texto e enviar**, e **não trava** quando o Tutor está pausado ou no limite: o aluno que escrever sobre
 *   um assunto delicado nesses estados recebe a mensagem de encaminhamento, com o 188 (D36). A pergunta comum volta
 *   recusada, e a tela mostra o aviso do estado, não erro.
 * - **"Hoje: N de 60 perguntas"** em texto, com a barra neutra: não muda de cor, não pisca (D38, D59).
 * - Sem saudação, sem sugestão de pergunta, sem número subindo, sem sequência de dias, sem nada de colega (regra 50,
 *   item 9), e nada começa sozinho.
 *
 * A conversa é da API e mora no cache de consultas, que toda troca de sessão esvazia: nada dela vai a `localStorage`.
 */
function ConversaComOTutor({ atividadeAplicadaId }: { atividadeAplicadaId: string }) {
  const cliente = useQueryClient()
  const conversa = useInfiniteQuery(consultaConversaDoTutor(atividadeAplicadaId))
  const atividades = useInfiniteQuery(consultaMinhasAtividades)
  const { ciclo, demorando, iniciar, repetir, limpar } = useCicloDeExecucao(CICLO_DO_TUTOR, enviarPerguntaAoTutor)
  const questao = questaoDoEndereco(useSearch())
  const [texto, definirTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  const agora = conversa.data?.pages[0]
  const lidas = conversa.data === undefined ? [] : mensagensDoTutorEmOrdem(conversa.data.pages)
  const pendente = pendenteNoTutor(lidas, ciclo, atividadeAplicadaId)
  const pausa = pausaNaTela(agora, pendente)
  const atividade = atividades.data?.pages.flatMap((pagina) => pagina.itens).find((item) => item.id === atividadeAplicadaId)
  const uso = agora === undefined ? undefined : usoDoDia(agora.uso)

  // A pergunta terminou, com resposta ou com recusa: a conversa, o estado do Tutor e o uso do dia são lidos de novo.
  const terminada = ciclo?.etapa === 'concluida' || ciclo?.etapa === 'falhou' ? ciclo.chaveEnvio : undefined
  const terminou = useRef<{ readonly chave: string; readonly em: number } | undefined>(undefined)
  useEffect(() => {
    if (terminada === undefined) return
    terminou.current = { chave: terminada, em: Date.now() }
    void cliente.invalidateQueries({ queryKey: CHAVE_DA_CONVERSA_DO_TUTOR })
  }, [terminada, cliente])

  // A recusa por pausa deixa de valer quando a conversa, lida depois dela, diz que o Tutor voltou.
  const pausaRecusada = pendente?.falha?.tipo === 'pausa' ? pendente.falha.pausa : undefined
  const pausaLida = agora === undefined ? undefined : pausaDoEstado(agora)
  const conversaLida = agora !== undefined && !conversa.isFetching
  const lidaEm = conversa.dataUpdatedAt
  useEffect(() => {
    const marca = terminou.current
    const lidaDepois = conversaLida && marca !== undefined && marca.chave === terminada && lidaEm > marca.em
    if (recusaVencida(pausaRecusada, pausaLida, lidaDepois)) limpar()
  }, [pausaRecusada, pausaLida, conversaLida, lidaEm, terminada, limpar])

  // O que acabou de entrar fica à vista: a pergunta, a resposta, o aviso. Sem animação: a tela só vai até o fim.
  // Pela marca do fim, e não pelo número de mensagens: "Ver mensagens anteriores" não joga o aluno para o fim.
  const itens = itensDoTutor(lidas, pendente)
  const etapa = pendente === undefined ? undefined : ciclo?.etapa
  const marca = marcaDoFim(itens, etapa, pausa)
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [marca])

  function aoEnviar(pergunta: string): void {
    // `iniciar` grava a pergunta como enviada antes de devolver: o segundo Enter encontra a pergunta no ar.
    if (!iniciar({ texto: pergunta, atividadeAplicadaId, ...(questao === undefined ? {} : { questao }) })) return
    definirTexto('')
  }

  const naoEncontrada = conversa.error instanceof ErroDaApi && conversa.error.codigo === ErrorCode.NAO_ENCONTRADO
  const semNada = conversa.data !== undefined && itens.length === 0 && pendente === undefined && pausa === undefined

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-sm break-words text-sutil">
          {atividade === undefined ? 'Ajuda em uma atividade' : `Ajuda em: ${atividade.titulo}`}
          {questao === undefined ? '' : ` · questão ${String(questao)}`}
        </p>
        <Link to={caminhoDaAtividadeDoAluno(atividadeAplicadaId)} className="inline-flex min-h-11 items-center gap-2 text-caramelo-texto underline">
          <ArrowLeft aria-hidden="true" size={18} />
          Voltar para a atividade
        </Link>
      </div>

      {conversa.isPending && <EstadoCarregando rotulo="Carregando a conversa…" />}
      {conversa.isError && conversa.data === undefined && naoEncontrada && (
        <EstadoVazio titulo="Esta atividade não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. Escolha a atividade em Início, no menu." />
      )}
      {conversa.isError && conversa.data === undefined && !naoEncontrada && (
        <EstadoErro erro={conversa.error} tentando={conversa.isFetching} aoTentarDeNovo={() => void conversa.refetch({ cancelRefetch: false })} />
      )}
      {semNada && (
        <EstadoVazio
          titulo="Nenhuma pergunta ainda"
          descricao="Escreva a sua dúvida na caixa abaixo. O Tutor não entrega a resposta pronta: ele faz perguntas para você chegar lá e mostra a página do material. Ele é uma inteligência artificial e pode errar."
        />
      )}

      {conversa.hasNextPage && (
        <Button variante="secundario" onClick={() => void conversa.fetchNextPage()} disabled={conversa.isFetchingNextPage} className="self-center">
          {conversa.isFetchingNextPage ? 'Carregando…' : 'Ver mensagens anteriores'}
        </Button>
      )}

      {conversa.data !== undefined && (itens.length > 0 || pendente !== undefined) && (
        <ListaDeMensagens rotulo="Conversa com o Tutor" ocupada={pendente?.pensando === true}>
          {itens.map((item) => {
            if (item.tipo === 'pergunta') return <UserMessage key={`pergunta:${item.texto}`}>{item.texto}</UserMessage>
            const { mensagem } = item
            if (mensagem.autor === 'aluno') return <UserMessage key={mensagem.id}>{mensagem.texto}</UserMessage>
            if (mensagem.tipo === 'assunto_delicado') return <Encaminhamento key={mensagem.id} texto={mensagem.texto} />
            return (
              <AIMessage key={mensagem.id} agente="tutor">
                <AIText texto={mensagem.texto} citacoes={mensagem.citacoes} materiais={SEM_TITULOS} />
              </AIMessage>
            )
          })}
          {pendente?.pensando === true && <ThinkingIndicator agente="tutor" demorando={demorando} />}
          {pendente?.falha !== undefined && <FalhaNaConversa falha={pendente.falha} aoTentarDeNovo={repetir} />}
        </ListaDeMensagens>
      )}

      {pausa !== undefined && <Pausa pausa={pausa} avaliacao={agora?.avaliacaoAberta?.titulo} limiteDoDia={agora?.uso.limiteDoDia} />}

      <div ref={fim} aria-hidden="true" />

      {/* A caixa existe em todos os estados do Tutor, e só espera enquanto uma pergunta está no ar. */}
      {conversa.data !== undefined && (
        <StickyFooter rotulo="Pergunta para o Tutor" semLinha>
          <div className="flex w-full min-w-0 flex-col gap-3">
            {uso !== undefined && (
              <div data-uso-do-dia="">
                {/* Com a tela baixa (o teclado aberto no celular), a barra vira uma linha de texto: a caixa continua à vista. */}
                <div className="[@media(max-height:32rem)]:hidden">
                  <ProgressBar rotulo={uso.rotulo} valor={uso.valor} maximo={uso.maximo} texto={uso.resto} />
                </div>
                <p className="hidden text-sm text-sutil [@media(max-height:32rem)]:block">
                  {uso.rotulo} · {uso.resto}
                </p>
              </div>
            )}
            <PromptInput variante="so-texto" rotulo="Pergunta para o Tutor" exemplo="Escreva a sua dúvida…" valor={texto} aoMudar={definirTexto} aoEnviar={aoEnviar} estado={emCurso(ciclo) ? 'gerando' : 'pronta'} />
          </div>
        </StickyFooter>
      )}
    </>
  )
}

/**
 * O Tutor do aluno (MVP, A4): pelo endereço `/aluno/tutor`, a escolha da atividade (a mesma do Início, que é o lugar da
 * lateral que o acende); a partir de uma atividade ("Pedir ajuda ao Tutor nesta questão"), a conversa dela. Nas duas, a
 * **faixa de supervisão no topo, que não fecha** (D8).
 *
 * Já não é item da lateral: o `<h1>` existe só para o leitor de tela (`Page`).
 */
export default function Tutor({ atividadeAplicadaId }: { atividadeAplicadaId?: string }) {
  useTituloDaTela('Tutor')
  return (
    <Page titulo="Tutor" largura="conversa" tituloSoParaLeitor>
      <FaixaDeSupervisao />
      {atividadeAplicadaId === undefined ? <EscolhaDaAtividade /> : <ConversaComOTutor atividadeAplicadaId={atividadeAplicadaId} />}
    </Page>
  )
}
