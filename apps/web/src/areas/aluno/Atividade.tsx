import { ErrorCode, type MeuDiagnosticoResponse, type ProvaResponse } from '@educa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CircleAlert, MessageCircleQuestion } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'wouter'
import { consultaMeuDiagnostico, consultaProva, enviarAtividade } from '../../api/atividades-do-aluno'
import { CHAVE_DAS_MINHAS_ATIVIDADES } from '../../api/chaves-do-aluno'
import { ErroDaApi, mensagemDoErro } from '../../api/client'
import { consultaEu } from '../../api/eu'
import { caminhoDoTutorNaAtividade, ROTAS_DO_ALUNO } from '../../paths'
import { StickyFooter } from '../../components/ui/StickyFooter'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Button } from '../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../components/ui/button-variants'
import { Card } from '../../components/ui/Card'
import { Comemoracao } from '../../components/ui/Comemoracao'
import { ConfirmDialog } from '../../components/ui/overlays/ConfirmDialog'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../components/states'
import { Banner } from '../../components/ui/Banner'
import { AgentSignature } from '../../components/ui/ai/AgentSignature'
import { CitationChip } from '../../components/ui/ai/CitationChip'
import { ApprovalLine } from '../../components/ui/ai/ApprovalLine'
import { MEDIA_LG, useMediaQuery } from '../../components/ui/media-query'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Page } from '../../components/ui/Page'
import { formatarDiaEHora } from '../../format'
import { useTituloDaTela } from '../../document-title'
import {
  alternativaMarcada,
  AVISO_DE_OUTRA_JANELA,
  avisoDeEscolhasPerdidas,
  comemoracaoNaTela,
  contarRespostas,
  FALA_DA_ENTREGA,
  faseDaAtividade,
  impedimentoDoEnvio,
  letraDaAlternativa,
  marcaDaQuestao,
  questaoValida,
  respostasSalvas,
  resultadoNaTela,
  ROTULO_DE_VOLTAR_AS_TAREFAS,
  rotuloNoMapa,
  textoDasEmBranco,
  textoDasRespondidas,
  textoDoAcerto,
  TEXTO_DA_MARCA,
  type MarcaDaQuestao,
} from './atividade'
import { AVISO_DA_AVALIACAO, TEXTO_DA_ESPERA_PELA_CORRECAO } from './atividades'
import { filaDaAtividade, type FilaDeRespostas } from './fila-de-respostas'
import { alteradaEmOutraJanela, type EstadoDaFila } from './respostas'

/** O aluno não alcança o título do material (`GET /v1/materiais` é do professor e da coordenação): o chip diz a página. */
const SEM_TITULOS = {}

const VOLTAR = (
  // Relativo à área: o `Route` aninhado em `/aluno` resolve o `to` a partir da base dela.
  <Link to={ROTAS_DO_ALUNO.atividades} className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
    <ArrowLeft aria-hidden="true" size={18} />
    Voltar para Tarefas
  </Link>
)

/**
 * Quanto cabe da lista "Questão por questão" antes de ela rolar por dentro, a partir de 1024 px: o resto do resultado fica à vista na janela.
 * `relative`: o que é absoluto dentro da lista (o texto só para leitor de tela do chip de fonte) só é recortado por um ancestral posicionado;
 * sem ele, esse texto escapa da rolagem e estica a página (1174 px a 1366 × 768, com a lista limitada a 192).
 */
const LISTA_QUE_ROLA = 'relative lg:max-h-[clamp(9rem,calc(100dvh_-_30rem),24rem)] lg:overflow-y-auto'

/** Como cada questão aparece no mapa. O estado vai também no nome do botão e no ícone: cor sozinha não diz nada. */
const CLASSES_DO_MAPA: Readonly<Record<MarcaDaQuestao, string>> = {
  sem_resposta: 'border-borda-campo bg-superficie text-sutil',
  salvando: 'border-azul-borda bg-azul-claro text-azul-texto',
  salva: 'border-azul-borda bg-azul-claro text-azul-texto',
  nao_salva: 'border-dashed border-erro bg-erro-cx text-erro',
}

interface PropsDeQuemResponde {
  readonly prova: ProvaResponse
  readonly fila: FilaDeRespostas
  readonly estadoDaFila: EstadoDaFila
  /** Para onde o foco vai quando o botão de enviar some, com a atividade enviada. */
  readonly focoDepoisDeEnviar: () => void
  /** Chamado uma vez, só quando o servidor confirmou o envio: quem guarda o estado de tela da comemoração é a tela, e não esta fase, que sai do ar com o envio. */
  readonly aoEntregar: () => void
}

/**
 * A atividade sendo respondida: **uma questão por vez**, com as alternativas em botões de rádio grandes (o rádio nativo,
 * que o teclado e o leitor de tela já conhecem), "Anterior" e "Próxima", e o mapa das questões dizendo quais já têm
 * resposta.
 *
 * **Cada escolha vai ao servidor na hora** (regra 80, item 6), pela fila de `fila-de-respostas.ts`. A tela diz "Resposta
 * salva" só quando o servidor confirmou; quando não consegue salvar, diz, mantém a escolha marcada e tenta de novo
 * sozinha. Nada aqui observa a janela, o foco ou a aba: sair e voltar não é medido (regra 70, item 7).
 */
function Respondendo({ prova, fila, estadoDaFila, focoDepoisDeEnviar, aoEntregar }: PropsDeQuemResponde) {
  const cliente = useQueryClient()
  const [atual, definirAtual] = useState(1)
  const [confirmando, definirConfirmando] = useState(false)
  // Trocar de questão leva o foco ao enunciado dela: o leitor de tela lê "Questão N: …", e o "Próxima" que fica desligado
  // na última questão não deixa o foco cair no `body`. Só quando o aluno troca: ao abrir a atividade o foco não se move.
  const enunciado = useRef<HTMLHeadingElement>(null)
  const trocou = useRef(false)
  function irParaQuestao(alvo: number): void {
    trocou.current = true
    definirAtual(alvo)
  }
  const numero = questaoValida(atual, prova.questoes.length)
  const questao = prova.questoes[numero - 1]
  const salvas = respostasSalvas(prova)
  const contagem = contarRespostas(prova, estadoDaFila)
  const marca = marcaDaQuestao(numero, salvas, estadoDaFila)
  const marcada = alternativaMarcada(numero, salvas, estadoDaFila)
  const impedimento = impedimentoDoEnvio(contagem)
  const ampliada = prova.adaptacao?.tipos.includes('fonte_ampliada') === true
  const provaId = prova.atividadeAplicadaId
  useEffect(() => {
    if (!trocou.current) return
    trocou.current = false
    enunciado.current?.focus()
  }, [numero])

  const envio = useMutation({
    mutationFn: () => enviarAtividade(provaId),
    onSuccess: (enviada) => {
      // Antes de a leitura da prova ganhar `enviadaEm` e esta fase sair do ar: a tela nunca passa pelo "enviada" sem saber que foi agora.
      aoEntregar()
      cliente.setQueryData(consultaProva(provaId).queryKey, (lida) => (lida === undefined ? lida : { ...lida, enviadaEm: enviada.enviadaEm }))
      void cliente.invalidateQueries({ queryKey: CHAVE_DAS_MINHAS_ATIVIDADES })
      definirConfirmando(false)
    },
    onError: (erro) => {
      // A professora encerrou enquanto o diálogo estava aberto: a tela relê a atividade e mostra o que ficou.
      if (!(erro instanceof ErroDaApi) || erro.codigo !== ErrorCode.ATIVIDADE_ENCERRADA) return
      definirConfirmando(false)
      void cliente.invalidateQueries({ queryKey: consultaProva(provaId).queryKey })
    },
  })

  if (questao === undefined) return null

  return (
    <>
      {prova.avaliativa && <Banner>{AVISO_DA_AVALIACAO}</Banner>}

      {/* Onde estou: o número em texto e uma marca por questão. Sem barra que enche para comemorar (D59). */}
      <nav aria-label="Questões" className="flex min-w-0 flex-col gap-3">
        <p className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-base font-semibold text-tinta">
            Questão {numero} de {prova.questoes.length}
          </span>
          <span className="text-sm text-sutil">{textoDasRespondidas(contagem)} com resposta</span>
        </p>
        <ol className="flex min-w-0 flex-wrap gap-1.5">
          {prova.questoes.map((item) => {
            const marcaDoItem = marcaDaQuestao(item.numero, salvas, estadoDaFila)
            const aberta = item.numero === numero
            return (
              <li key={item.numero}>
                <button
                  type="button"
                  onClick={() => irParaQuestao(item.numero)}
                  aria-label={rotuloNoMapa(item.numero, marcaDoItem)}
                  {...(aberta ? { 'aria-current': 'step' as const } : {})}
                  data-marca={marcaDoItem}
                  className={`relative grid size-11 place-items-center rounded-controle border text-base font-medium ${aberta ? 'border-noite bg-noite text-sobre-grafite' : CLASSES_DO_MAPA[marcaDoItem]}`}
                >
                  {item.numero}
                  {marcaDoItem === 'salva' && <Check aria-hidden="true" size={12} strokeWidth={3} className="absolute top-0.5 right-0.5" />}
                  {marcaDoItem === 'nao_salva' && <CircleAlert aria-hidden="true" size={12} strokeWidth={2.4} className="absolute top-0.5 right-0.5" />}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <Card className="flex flex-col gap-4">
        <h2 ref={enunciado} tabIndex={-1} className={`min-w-0 rounded-controle leading-relaxed font-normal break-words whitespace-pre-wrap text-tinta ${ampliada ? 'text-2xl' : 'text-[1.0625rem]'}`}>
          <span className="sr-only">Questão {numero}: </span>
          {questao.enunciado}
        </h2>
        {/* A `key` pela questão: outra questão é outro grupo de rádio, e o foco não fica na alternativa da anterior. */}
        <fieldset key={numero} className="flex min-w-0 flex-col gap-2">
          <legend className="sr-only">Alternativas da questão {numero}</legend>
          {questao.alternativas.map((texto, indice) => {
            const escolhida = marcada === indice
            return (
              // O índice é a identidade da alternativa no contrato: a ordem delas não muda.
              <label
                key={indice}
                data-alternativa={indice}
                className={`flex min-h-14 min-w-0 cursor-pointer items-start gap-3 rounded-controle border p-3 ${escolhida ? 'border-noite bg-realce-suave' : 'border-borda-campo bg-superficie hover:bg-realce-suave'}`}
              >
                <input type="radio" name={`questao-${String(numero)}`} value={indice} checked={escolhida} onChange={() => fila.escolher(numero, indice)} className="mt-1 size-5 shrink-0 accent-noite" />
                <span className={`min-w-0 break-words text-tinta ${ampliada ? 'text-xl' : 'text-base'}`}>
                  <span className="font-semibold">{letraDaAlternativa(indice)}.</span> {texto}
                </span>
              </label>
            )
          })}
        </fieldset>

        {/* A ajuda é desta questão: fica no cartão dela, na linha do estado da resposta. Em avaliação o Tutor está pausado para a turma, e a tela não oferece um caminho que só levaria ao aviso. */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {/* Sempre na tela, mesmo vazia: é uma região de status, e o leitor de tela anuncia o que entra nela. */}
          <div role="status" data-resposta={marca} className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-base">
            {marca === 'salva' && (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-ok">
                <Check aria-hidden="true" size={18} strokeWidth={2.4} className="shrink-0" />
                {TEXTO_DA_MARCA.salva}
              </span>
            )}
            {marca === 'salvando' && <span className="text-sutil">{TEXTO_DA_MARCA.salvando}</span>}
            {marca === 'nao_salva' && estadoDaFila.falha === 'passageira' && <span className="min-w-0 break-words text-erro">{TEXTO_DA_MARCA.nao_salva}</span>}
            {marca === 'nao_salva' && estadoDaFila.falha === 'recusada' && <span className="min-w-0 break-words text-erro">Não foi possível salvar esta resposta. Chame quem dá a aula.</span>}
            {alteradaEmOutraJanela(estadoDaFila, numero) && <span className="min-w-0 break-words text-apoio">{AVISO_DE_OUTRA_JANELA}</span>}
          </div>
          {!prova.avaliativa && (
            <Link to={caminhoDoTutorNaAtividade(provaId, numero)} className={`${SECONDARY_LINK_CLASSES} gap-2`}>
              <MessageCircleQuestion aria-hidden="true" size={18} className="shrink-0" />
              Pedir ajuda ao Tutor nesta questão
            </Link>
          )}
        </div>
        {marca === 'nao_salva' && estadoDaFila.falha === 'passageira' && (
          <Button variante="secundario" onClick={fila.tentarAgora} className="self-start">
            Tentar salvar agora
          </Button>
        )}
      </Card>

      {/* No celular (`contents`) os três blocos são filhos da coluna: as ações, o ponto de parada e a barra presa embaixo, como na 6.1.
          A partir de 768 px é uma linha só: "Enviar a atividade", o ponto de parada e "Anterior" e "Próxima", que deixam de ser presas: presa,
          a barra cobria "Enviar a atividade" e o ponto de parada na janela do Chromebook (RF20), e a tela de trabalho tem de caber nela. */}
      <div className="contents md:flex md:flex-wrap md:items-center md:gap-x-4 md:gap-y-3">
        <div className="flex min-w-0 justify-end border-t border-linha pt-4 md:justify-start md:border-t-0 md:pt-0">
          <Button variante="oficial" onClick={() => definirConfirmando(true)}>
            Enviar a atividade
          </Button>
        </div>
        {/* O ponto de parada, dito: sair não custa nada, e voltar é do mesmo tamanho (D59). Sempre à vista: em janela larga, no vão entre "Enviar" e a navegação. */}
        <p className="text-sm text-sutil md:min-w-56 md:flex-1">Pode parar quando quiser. O que você respondeu fica guardado, e dá para continuar depois.</p>

        {/* Presa embaixo no celular: "Anterior" e "Próxima" ficam à mão enquanto a questão rola. */}
        <StickyFooter rotulo="Trocar de questão" className="md:static md:border-t-0 md:py-0">
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            <Button variante="secundario" disabled={numero === 1} onClick={() => irParaQuestao(numero - 1)}>
              <ArrowLeft aria-hidden="true" size={18} className="shrink-0" />
              Anterior
            </Button>
            <Button variante="secundario" disabled={numero === prova.questoes.length} onClick={() => irParaQuestao(numero + 1)}>
              Próxima
              <ArrowRight aria-hidden="true" size={18} className="shrink-0" />
            </Button>
          </div>
        </StickyFooter>
      </div>

      {confirmando && (
        <ConfirmDialog
          titulo="Enviar a atividade?"
          familia="oficial"
          resumo={[
            { rotulo: 'Atividade', valor: prova.titulo },
            { rotulo: 'Com resposta', valor: textoDasRespondidas(contagem) },
            { rotulo: 'Em branco', valor: textoDasEmBranco(contagem.emBranco) },
          ]}
          efeito="Depois de enviar, não dá para mudar as respostas. Quem dá a aula revisa a correção antes de você ver o resultado."
          {...(impedimento !== undefined
            ? { aviso: impedimento }
            : contagem.emBranco > 0
              ? { aviso: `${textoDasEmBranco(contagem.emBranco)}. Dá para voltar e responder antes de enviar.` }
              : {})}
          rotuloDeConfirmar="Enviar a atividade"
          rotuloConfirmando="Enviando…"
          rotuloDeCancelar="Continuar respondendo"
          aoConfirmar={() => envio.mutate()}
          aoFechar={() => {
            definirConfirmando(false)
            envio.reset()
          }}
          confirmando={envio.isPending}
          impedido={impedimento !== undefined}
          {...(envio.isError ? { falha: mensagemDoErro(envio.error) } : {})}
          focoDeReserva={focoDepoisDeEnviar}
        />
      )}
    </>
  )
}

/**
 * O diagnóstico do próprio aluno, **que só existe depois de a professora aprovar a correção** (regra 70, item 3): os
 * acertos por habilidade e questão por questão, em contagem. **Sem nota, sem conceito, sem percentual e sem comparação
 * com ninguém** (D46; regra 50, item 9). Leva a assinatura da função que corrigiu, com o selo "IA", e quem aprovou.
 */
function Diagnostico({ diagnostico, prova }: { diagnostico: MeuDiagnosticoResponse; prova: ProvaResponse }) {
  // A lista questão por questão é o que cresce com a atividade: a partir de 1024 px, na segunda coluna, ela rola por dentro, para o
  // resultado caber na janela do Chromebook (RF20), e ganha nome e foco para rolar pelo teclado (um nome só dele: o da seção é o do título). Abaixo disso rola a página, e não há o que focar nem o que nomear.
  const listaRola = useMediaQuery(MEDIA_LG)
  return (
    <Card titulo="Seu resultado" className="flex flex-col gap-4">
      {/* Em janela larga (1024 px), duas colunas: o resumo à esquerda e, à direita, a lista que rola por dentro. */}
      <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <AgentSignature funcao="correcao_de_objetiva" />
            <ApprovalLine aprovacao={{ estado: 'aprovada', por: diagnostico.aprovadoPor?.nome ?? 'quem dava aula para a turma', quando: diagnostico.aprovadoEm }} verbo="Correção aprovada por" />
          </div>
          <p className="text-base text-tinta">Você acertou {textoDoAcerto(diagnostico.acertos, diagnostico.total)}.</p>

          {diagnostico.porHabilidade.length > 0 && (
            <section aria-labelledby="titulo-por-habilidade" className="flex min-w-0 flex-col gap-3">
              <h3 id="titulo-por-habilidade" className="text-base font-semibold text-tinta">
                Acertos por habilidade
              </h3>
              {diagnostico.porHabilidade.map((item) => (
                <ProgressBar key={item.habilidade.codigo} rotulo={item.habilidade.descricao} valor={item.acertos} maximo={item.total} texto={textoDoAcerto(item.acertos, item.total)} />
              ))}
            </section>
          )}
        </div>

        <section aria-labelledby="titulo-por-questao" className="flex min-w-0 flex-col gap-3">
          <h3 id="titulo-por-questao" className="text-base font-semibold text-tinta">
            Questão por questão
          </h3>
          <div {...(listaRola ? { role: 'group', 'aria-label': 'Questões corrigidas', tabIndex: 0 } : {})} className={`min-w-0 ${LISTA_QUE_ROLA}`}>
            <ol className="flex min-w-0 flex-col gap-3">
              {diagnostico.questoes.map((questao) => {
                const alternativas = prova.questoes.find((item) => item.numero === questao.numero)?.alternativas ?? []
                const comTexto = (indice: number): string => {
                  const texto = alternativas[indice]
                  return texto === undefined ? letraDaAlternativa(indice) : `${letraDaAlternativa(indice)}. ${texto}`
                }
                return (
                  <li key={questao.numero} data-questao-corrigida={questao.correta ? 'certa' : 'outra'} className="flex min-w-0 flex-col items-start gap-1.5 rounded-controle border border-linha p-3">
                    <p className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-semibold text-tinta">Questão {questao.numero}</span>
                      {questao.correta ? <StatusBadge familia="ok">Você acertou</StatusBadge> : <StatusBadge familia="info">{questao.alternativa === null ? 'Ficou em branco' : 'Para rever'}</StatusBadge>}
                    </p>
                    {questao.alternativa !== null && <p className="min-w-0 break-words text-apoio">Você marcou: {comTexto(questao.alternativa)}</p>}
                    {!questao.correta && <p className="min-w-0 break-words text-apoio">A resposta é: {comTexto(questao.gabarito)}</p>}
                    <p className="min-w-0 break-words text-tinta">
                      {questao.explicacao} <CitationChip citacao={questao.citacao} materiais={SEM_TITULOS} />
                    </p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      </div>
    </Card>
  )
}

interface PropsDoFim {
  readonly prova: ProvaResponse
  readonly estadoDaFila: EstadoDaFila
  /** O envio foi confirmado nesta tela, nesta abertura (estado de tela, `comemoracaoNaTela`). */
  readonly entregueAgora: boolean
}

/**
 * A atividade que não recebe mais resposta: enviada pelo aluno, ou encerrada pela professora. A tela **não deixa mudar
 * nada**, e do resultado diz só o que já pode ser dito: enquanto a correção não foi aprovada, que ela vai ser revista.
 */
function SemMaisRespostas({ prova, estadoDaFila, entregueAgora }: PropsDoFim) {
  const fase = faseDaAtividade(prova)
  const diagnostico = useQuery(consultaMeuDiagnostico(prova.atividadeAplicadaId))
  const resultado = resultadoNaTela(fase, diagnostico)
  const contagem = contarRespostas(prova, { ...estadoDaFila, pendentes: [] })
  const perdidas = avisoDeEscolhasPerdidas(estadoDaFila)

  return (
    <>
      {comemoracaoNaTela(entregueAgora, prova, resultado) && (
        <Card className="flex flex-col items-center gap-4">
          <Comemoracao agente="tutor">{FALA_DA_ENTREGA}</Comemoracao>
          <Link to={ROTAS_DO_ALUNO.atividades} className={SECONDARY_LINK_CLASSES}>
            {ROTULO_DE_VOLTAR_AS_TAREFAS}
          </Link>
        </Card>
      )}
      <Card titulo={prova.enviadaEm === null ? 'Quem dá a aula encerrou esta atividade' : 'Atividade enviada'} className="flex flex-col gap-2">
        <p className="break-words text-apoio">
          {prova.enviadaEm === null ? '' : `Enviada em ${formatarDiaEHora(prova.enviadaEm)}. `}
          Você respondeu {textoDasRespondidas(contagem)}. Não dá mais para mudar as respostas.
        </p>
        {perdidas !== undefined && (
          <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro">
            {perdidas}
          </p>
        )}
      </Card>

      {resultado.tipo === 'carregando' && <EstadoCarregando rotulo="Procurando o resultado…" />}
      {resultado.tipo === 'aguardando' && (
        <div data-resultado="aguardando">
          <Banner>{`${TEXTO_DA_ESPERA_PELA_CORRECAO} O resultado aparece aqui depois que ela aprovar.`}</Banner>
        </div>
      )}
      {resultado.tipo === 'erro' && <EstadoErro erro={resultado.erro} tentando={diagnostico.isFetching} aoTentarDeNovo={() => void diagnostico.refetch({ cancelRefetch: false })} />}
      {resultado.tipo === 'pronto' && <Diagnostico diagnostico={resultado.diagnostico} prova={prova} />}
    </>
  )
}

/**
 * Uma atividade aberta pelo aluno (MVP, A3): respondendo, uma questão por vez; depois de enviada ou encerrada, o que
 * ficou e, **só depois de a professora aprovar a correção**, o diagnóstico por habilidade. Os quatro estados: carregando,
 * a atividade que não existe para este aluno (igual à de outra turma: regra 10, item 6), o erro com "Tentar de novo" e a
 * atividade.
 *
 * É tela de objeto: o título é o nome da atividade, e aparece.
 */
export default function Atividade({ atividadeAplicadaId }: { atividadeAplicadaId: string }) {
  const cliente = useQueryClient()
  const prova = useQuery(consultaProva(atividadeAplicadaId))
  const fila = filaDaAtividade(cliente, atividadeAplicadaId)
  const estadoDaFila = useSyncExternalStore(fila.assinar, fila.ler)
  // Quem é o aluno da sessão, lido do cache (a casca é quem busca o `/v1/eu`): `enabled: false` assina sem buscar de novo.
  const alunoDaSessao = useQuery({ ...consultaEu, enabled: false }).data?.usuarioId
  // As escolhas que o servidor ainda não confirmou e ficaram no espelho (o F5, a sessão vencida) voltam e saem, só com o mesmo aluno.
  useEffect(() => {
    fila.hidratar()
  }, [alunoDaSessao, fila])
  const topo = useRef<HTMLDivElement>(null)
  // O envio confirmado nesta tela, e só nela: estado de tela, sem `localStorage`, URL nem cache. A `key` da rota (`routes.tsx`) a zera ao trocar de tarefa.
  const [entregueAgora, definirEntregueAgora] = useState(false)
  useTituloDaTela(prova.data?.titulo ?? 'Atividade')

  // O que o servidor tem de mais novo que esta janela (uma leitura da prova, ou o que o `PUT` que perdeu devolveu) é adotado.
  const respostasLidas = prova.data?.respostas
  useEffect(() => {
    if (respostasLidas !== undefined) fila.adotar(respostasLidas)
  }, [respostasLidas, fila])

  // O servidor recusou uma resposta porque a atividade foi encerrada: a tela relê a atividade, que agora diz isso.
  const encerradaNoServidor = estadoDaFila.falha === 'encerrada'
  useEffect(() => {
    if (encerradaNoServidor) void cliente.invalidateQueries({ queryKey: consultaProva(atividadeAplicadaId).queryKey })
  }, [encerradaNoServidor, cliente, atividadeAplicadaId])

  if (prova.data === undefined) {
    const naoEncontrada = prova.error instanceof ErroDaApi && prova.error.codigo === ErrorCode.NAO_ENCONTRADO
    return (
      <Page titulo="Atividade" antes={VOLTAR} largura="leitura">
        {prova.isPending ? (
          <EstadoCarregando rotulo="Carregando a atividade…" />
        ) : naoEncontrada ? (
          <EstadoVazio titulo="Esta atividade não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />
        ) : (
          <EstadoErro erro={prova.error} tentando={prova.isFetching} aoTentarDeNovo={() => void prova.refetch({ cancelRefetch: false })} />
        )}
      </Page>
    )
  }

  const dados = prova.data
  return (
    <Page titulo={dados.titulo} objeto antes={VOLTAR} largura="leitura">
      {/* Quem recebe o foco quando o botão de enviar some: sem isto ele cairia no `body` (regra 50, item 11). */}
      <div ref={topo} tabIndex={-1} className="flex min-w-0 flex-col gap-4">
        {faseDaAtividade(dados) === 'respondendo' ? (
          <Respondendo prova={dados} fila={fila} estadoDaFila={estadoDaFila} focoDepoisDeEnviar={() => topo.current?.focus()} aoEntregar={() => definirEntregueAgora(true)} />
        ) : (
          <SemMaisRespostas prova={dados} estadoDaFila={estadoDaFila} entregueAgora={entregueAgora} />
        )}
      </div>
    </Page>
  )
}
