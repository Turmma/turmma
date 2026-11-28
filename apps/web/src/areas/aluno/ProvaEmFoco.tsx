import { ErrorCode, type EnvioDaTentativa, type ProvaResponse } from '@educa/shared'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, Redirect, useLocation } from 'wouter'
import { INTERVALO_DO_TEMPO_MS, ProvaNaoComecou, provaEmFocoQueryOptions, tempoDaProvaQueryOptions, type TempoLido } from '../../api/atividades-do-aluno'
import { ApiError } from '../../api/client'
import { euQueryOptions } from '../../api/eu'
import { EmptyState, LoadingState } from '../../components/states'
import { Button } from '../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../components/ui/button-variants'
import { usePageTitle } from '../../document-title'
import { ALUNO_ROUTES, caminhoDaAtividadeDoAluno } from '../../paths'
import {
  anuncioDoRelogio,
  milissegundosQueFaltam,
  ROTULO_DE_VOLTAR_AS_TAREFAS,
  TEXTO_DE_ERRO_AO_ABRIR_A_PROVA,
  TEXTO_DE_SAIR_DA_PROVA,
  TEXTO_DO_FIM_DO_TEMPO,
  TEXTO_DO_FIM_ENCERRADA,
  TEXTO_DO_FIM_ENVIADA,
  TEXTO_SEM_CONEXAO,
  textoDasQueNaoChegaram,
  textoDoRelogio,
} from './atividade'
import { Respondendo } from './Atividade'
import { filaDaAtividade, type FilaDeRespostas } from './fila-de-respostas'
import type { EstadoDaFila } from './respostas'
import { filaDeSaidasDaProva, vigiarASaidaDaAba } from './fila-de-saidas'

/**
 * A prova em tela de foco (avaliacao-e-correcao, 12.0; RF6, RF7; `docs/interface.md` §2): `/aluno/prova/:id`, **fora da casca** (`isTelaDeFoco`): sem lateral, sem barras e sem o Tutor. Só a prova, o relógio do
 * servidor, o "Salvo" e o "Sair da prova", que é **um clique** e nunca pede confirmação (D59: sair não é mais difícil que entrar); o relógio segue, e voltar mostra o mesmo.
 *
 * **Ela só mostra prova que já começou.** Quem começa é o "Começar" de "Antes de começar", depois do aviso (D70): o endereço digitado sem a prova ter começado leva de volta à atividade.
 *
 * - **O tempo é o do servidor** (RF6): `limiteEm` menos o relógio do computador corrigido pelo desvio que a leitura trouxe. Relido a cada 30 s e ao voltar para a aba; a falha da leitura (503, queda) mantém o último.
 * - **A fila de respostas vive no app** (`fila-de-respostas.ts`): resposta nenhuma se perde na queda (regra 80, item 6), e ela segue depois do "Sair" e do fim, até esvaziar. Com a extensão do professor, o limite novo
 *   chega pela releitura e a fila reenvia na hora.
 * - **A saída da aba** (D70) vai por uma fila própria, em série (`fila-de-saidas.ts`): o aluno é avisado antes de começar, e nada na tela a mostra, a soma nem a usa contra ele.
 * - **Acessibilidade**: o relógio não fica em região viva (ele muda a cada minuto, e leria sozinho para sempre); um aviso `polite` a 10, 5 e 1 min; o fim ("O tempo acabou…") é `assertive` e leva o foco; "Salvando…"
 *   é `polite`; ao entrar, o foco vai ao enunciado da primeira questão.
 */

/** Se o navegador diz que há rede. O `online` e o `offline` são os do navegador: a tela não mede a conexão do aluno (regra 70, item 7), só diz o que ele já sabe. */
function useOnline(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener('online', avisar)
      window.addEventListener('offline', avisar)
      return () => {
        window.removeEventListener('online', avisar)
        window.removeEventListener('offline', avisar)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

interface PropsDoRelogio {
  readonly tempo: TempoLido | undefined
  /** A prova acabou: o relógio para de bater. */
  readonly parado: boolean
  /** O relógio chegou ao limite lido: a tela confere o tempo de novo (a extensão e a queda andam o limite) e, se nada mudou, é o fim. */
  readonly aoVencer: (limiteEm: string) => void
}

/**
 * O relógio da faixa. **Bate sozinho (1 s), de propósito num componente à parte**: a tela das questões não se desenha a cada segundo no Chromebook. O texto é de minutos inteiros e **fora de região viva**; o
 * leitor de tela recebe só o aviso de 10, 5 e 1 min, numa região `polite` escondida.
 */
function RelogioDaProva({ tempo, parado, aoVencer }: PropsDoRelogio) {
  const [agora, definirAgora] = useState(() => Date.now())
  useEffect(() => {
    if (parado) return
    const batida = setInterval(() => definirAgora(Date.now()), 1_000)
    return () => clearInterval(batida)
  }, [parado])
  const falta = milissegundosQueFaltam(tempo, agora)
  const venceu = falta !== undefined && falta <= 0
  const limiteLido = tempo?.limiteEm ?? undefined
  useEffect(() => {
    if (venceu && limiteLido !== undefined) aoVencer(limiteLido)
  }, [venceu, limiteLido, aoVencer])

  const anunciados = useRef(new Set<number>())
  const [anuncio, definirAnuncio] = useState('')
  const minutos = falta === undefined || falta <= 0 ? undefined : Math.ceil(falta / 60_000)
  useEffect(() => {
    if (falta === undefined || parado) return
    const aviso = anuncioDoRelogio(falta, anunciados.current)
    if (aviso === undefined) return
    for (const limiar of aviso.limiares) anunciados.current.add(limiar)
    definirAnuncio(aviso.texto)
    // O texto do aviso muda de minuto em minuto: só o minuto, e não o milissegundo, é motivo de olhar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutos, parado])

  return (
    <>
      <p data-relogio="" className="min-w-0 text-base font-semibold break-words text-tinta">
        {falta === undefined ? (tempo === undefined ? 'Lendo o tempo…' : '') : textoDoRelogio(falta)}
      </p>
      <p role="status" data-anuncio-do-relogio="" className="sr-only">
        {anuncio}
      </p>
    </>
  )
}

interface FrameProps {
  readonly aoSair: () => void
  /** O relógio e o "Salvo", na faixa. Sem eles (a prova ainda não abriu), fica só o "Sair da prova". */
  readonly faixa?: ReactNode
  readonly children: ReactNode
}

/** A moldura da prova: a faixa de **uma linha** no topo (relógio, "Salvo" e "Sair da prova", também a 360 px) e, embaixo, o que a tela tem a dizer. */
function Frame({ aoSair, faixa, children }: FrameProps) {
  return (
    <div data-prova-em-foco="" className="mx-auto flex w-full max-w-[880px] min-w-0 flex-1 flex-col gap-4">
      <header data-faixa-da-prova="" className="sticky top-0 z-10 flex min-w-0 flex-nowrap items-center justify-between gap-3 border-b-2 border-borda bg-fundo py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">{faixa}</div>
        <Button variante="secundario" onClick={aoSair} className="shrink-0">
          {TEXTO_DE_SAIR_DA_PROVA}
        </Button>
      </header>
      {children}
    </div>
  )
}

interface PropsDoFim {
  readonly texto: string
  readonly naoChegaram: number
}

/**
 * O fim da prova: o tempo acabou, a professora encerrou ou o aluno enviou. A questão sai, e o aviso é `assertive` (`role="alert"`) e **leva o foco**. Com respostas ainda na fila, diz quantas não chegaram:
 * a fila segue tentando, e o texto acompanha a contagem.
 */
function FimDaProva({ texto, naoChegaram }: PropsDoFim) {
  const aviso = useRef<HTMLDivElement>(null)
  useEffect(() => {
    aviso.current?.focus()
  }, [])
  return (
    <div ref={aviso} role="alert" tabIndex={-1} data-fim-da-prova="" className="flex min-w-0 flex-col items-start gap-3 rounded-cartao border-2 border-borda bg-superficie p-4 lg:p-5">
      <p className="text-lg font-semibold break-words text-tinta">{texto}</p>
      {naoChegaram > 0 && <p className="break-words text-erro">{textoDasQueNaoChegaram(naoChegaram)}</p>}
      <Link to={ALUNO_ROUTES.atividades} className={SECONDARY_LINK_CLASSES}>
        {ROTULO_DE_VOLTAR_AS_TAREFAS}
      </Link>
    </div>
  )
}

interface PropsDaFilaDaProva {
  readonly fila: FilaDeRespostas
  readonly estadoDaFila: EstadoDaFila
}

/** A fila de respostas da prova, ligada ao que a tela sabe: o aluno da sessão (o espelho só volta para o mesmo), o que o servidor tem de mais novo, e a recusa por prova encerrada. */
function useFilaDaProva(atividadeAplicadaId: string, respostasLidas: ProvaResponse['respostas']): PropsDaFilaDaProva {
  const cliente = useQueryClient()
  const fila = filaDaAtividade(cliente, atividadeAplicadaId)
  const estadoDaFila = useSyncExternalStore(fila.assinar, fila.read)
  // Quem é o aluno da sessão, lido do cache (a casca é quem busca o `/v1/eu`): as escolhas que o servidor ainda não confirmou e ficaram no espelho (o F5, a sessão vencida) voltam e saem, só com o mesmo aluno.
  const alunoDaSessao = useQuery({ ...euQueryOptions, enabled: false }).data?.usuarioId
  useEffect(() => {
    fila.hidratar()
  }, [alunoDaSessao, fila])
  // O que o servidor tem de mais novo que esta janela é adotado.
  useEffect(() => {
    fila.adotar(respostasLidas)
  }, [respostasLidas, fila])
  // O servidor recusou uma resposta porque a prova foi encerrada: a tela relê a prova e o tempo, e o fim aparece.
  const encerradaNoServidor = estadoDaFila.falha === 'encerrada'
  useEffect(() => {
    if (encerradaNoServidor) void cliente.invalidateQueries({ queryKey: provaEmFocoQueryOptions(atividadeAplicadaId).queryKey })
  }, [encerradaNoServidor, cliente, atividadeAplicadaId])
  return { fila, estadoDaFila }
}

/** O limite andou para a frente (a extensão do professor, o tempo da queda): o que está na fila e esbarrou no limite antigo sai agora, sem esperar o recuo. */
function useReenvioQuandoOLimiteAnda(limiteEm: string | null | undefined, fila: FilaDeRespostas): void {
  const limiteDeAntes = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (limiteEm === undefined) return
    const antes = limiteDeAntes.current
    limiteDeAntes.current = limiteEm
    if (typeof antes === 'string' && typeof limiteEm === 'string' && Date.parse(limiteEm) > Date.parse(antes)) fila.tryAgora()
  }, [limiteEm, fila])
}

interface TempoDaProva {
  readonly lido: TempoLido | undefined
  /** O relógio chegou ao limite lido e o servidor, relido, confirmou o mesmo limite: é o fim. Enquanto a releitura está no ar, a prova segue (a extensão e a queda andam o limite). */
  readonly venceu: boolean
  readonly aoVencer: (limiteEm: string) => void
}

/**
 * O tempo da prova, lido do servidor: a cada 30 s enquanto ela importa (em andamento, ou acabada com resposta ainda na fila: a extensão pode chegar) e, quando o relógio vence o limite que conhecia, na hora.
 * Acabada e com a fila vazia, não há mais o que ler. **O fim por relógio só vale com a releitura terminada** e o mesmo limite: a falha da leitura (503, queda) mantém o último limite, e a extensão do professor o anda.
 */
function useTempoDaProva(atividadeAplicadaId: string, fila: FilaDeRespostas, pendentes: number): TempoDaProva {
  const tempo = useQuery({
    ...tempoDaProvaQueryOptions(atividadeAplicadaId),
    refetchInterval: (consulta) => (consulta.state.data?.envio != null && pendentes === 0 ? false : INTERVALO_DO_TEMPO_MS),
  })
  const [limiteVencido, definirLimiteVencido] = useState<string | null>(null)
  const [conferido, definirConferido] = useState<string | null>(null)
  const refazer = tempo.refetch
  useEffect(() => {
    if (limiteVencido === null) return
    let vivo = true
    void refazer({ cancelRefetch: false }).finally(() => {
      if (vivo) definirConferido(limiteVencido)
    })
    return () => {
      vivo = false
    }
  }, [limiteVencido, refazer])
  useReenvioQuandoOLimiteAnda(tempo.data?.limiteEm, fila)
  return { lido: tempo.data, venceu: conferido !== null && conferido === tempo.data?.limiteEm, aoVencer: definirLimiteVencido }
}

/** A saída da aba só conta com a prova em andamento (D70), e o aluno foi avisado em "Antes de começar". */
function useVigiaDaSaida(atividadeAplicadaId: string, emAndamento: boolean): void {
  useEffect(() => {
    if (!emAndamento) return
    return vigiarASaidaDaAba(() => filaDeSaidasDaProva(atividadeAplicadaId).registrar())
  }, [emAndamento, atividadeAplicadaId])
}

/** O que diz o fim, ou `undefined` se a prova segue. O texto sai da conta do relógio e do que o servidor diz, e não de um estado que ficaria preso depois da extensão. */
function textoDoFimDaProva(dados: ProvaResponse, envio: EnvioDaTentativa | null, enviadaAgora: boolean, venceuNoRelogio: boolean): string | undefined {
  if (enviadaAgora || envio === 'aluno') return TEXTO_DO_FIM_ENVIADA
  if (envio === 'encerramento' || (envio === null && dados.estado === 'encerrada')) return TEXTO_DO_FIM_ENCERRADA
  if (envio !== null || venceuNoRelogio) return TEXTO_DO_FIM_DO_TEMPO
  if (dados.enviadaEm !== null) return TEXTO_DO_FIM_ENVIADA
  return dados.estado === 'aberta' ? undefined : TEXTO_DO_FIM_ENCERRADA
}

/** "Salvando…" enquanto há resposta na fila, "Salvo" quando a fila esvazia (e há o que ter salvo). */
function textoDoSalvo(naFila: number, salvas: number): string {
  if (naFila > 0) return 'Salvando…'
  return salvas > 0 ? 'Salvo' : ''
}

/** O navegador diz que está sem rede, ou a fila acabou de esbarrar numa falha passageira. */
function estaSemConexao(online: boolean, fila: EstadoDaFila): boolean {
  return !online || fila.falha === 'passageira'
}

interface PropsDaProvaAberta {
  readonly atividadeAplicadaId: string
  readonly dados: ProvaResponse
  readonly aoSair: () => void
}

function ProvaAberta({ atividadeAplicadaId, dados, aoSair }: PropsDaProvaAberta) {
  usePageTitle(dados.titulo)
  const { fila, estadoDaFila } = useFilaDaProva(atividadeAplicadaId, dados.respostas)
  const online = useOnline()
  const pendentes = estadoDaFila.pendentes.length
  // O envio feito pelo aluno nesta tela.
  const [enviadaAgora, definirEnviadaAgora] = useState(false)
  const { lido, venceu, aoVencer } = useTempoDaProva(atividadeAplicadaId, fila, pendentes)
  const textoDoFim = textoDoFimDaProva(dados, lido?.envio ?? null, enviadaAgora, venceu)
  useVigiaDaSaida(atividadeAplicadaId, textoDoFim === undefined)
  const topo = useRef<HTMLDivElement>(null)
  const semConexao = textoDoFim === undefined && estaSemConexao(online, estadoDaFila)

  return (
    <Frame
      aoSair={aoSair}
      faixa={
        <>
          <RelogioDaProva tempo={lido} parado={textoDoFim !== undefined} aoVencer={aoVencer} />
          {/* "Salvando…" enquanto há resposta na fila, "Salvo" quando a fila esvazia: região `polite`, sempre na tela, para o leitor de tela anunciar o que entra nela. */}
          <p role="status" data-salvo="" className="min-w-0 shrink text-sm break-words text-sutil">
            {textoDoSalvo(pendentes, dados.respostas.length)}
          </p>
        </>
      }
    >
      <div ref={topo} tabIndex={-1} className="flex min-w-0 flex-col gap-4">
        <h1 className="t-cartao min-w-0 break-words text-tinta">{dados.titulo}</h1>
        {semConexao && (
          <p role="status" data-sem-conexao="" className="rounded-controle bg-erro-cx p-3 break-words text-erro">
            {TEXTO_SEM_CONEXAO}
          </p>
        )}
        {textoDoFim === undefined ? (
          <Respondendo emProva prova={dados} fila={fila} estadoDaFila={estadoDaFila} focoDepoisDeEnviar={() => topo.current?.focus()} aoEntregar={() => definirEnviadaAgora(true)} />
        ) : (
          <FimDaProva texto={textoDoFim} naoChegaram={pendentes} />
        )}
      </div>
    </Frame>
  )
}

/** A prova que ainda não abriu: carregando, não disponível, ou erro com "Tentar de novo". A que não começou leva de volta à atividade, onde está o aviso. */
function ProvaSemDados({ atividadeAplicadaId, prova, aoSair }: { atividadeAplicadaId: string; prova: UseQueryResult<ProvaResponse, unknown>; aoSair: () => void }) {
  usePageTitle('Prova')
  if (prova.error instanceof ProvaNaoComecou) return <Redirect to={caminhoDaAtividadeDoAluno(atividadeAplicadaId)} replace />
  const naoEncontrada = prova.error instanceof ApiError && prova.error.codigo === ErrorCode.NAO_ENCONTRADO
  return (
    <Frame aoSair={aoSair}>
      {prova.isPending && <LoadingState rotulo="Abrindo a prova…" />}
      {naoEncontrada && <EmptyState titulo="Esta prova não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
      {prova.isError && !naoEncontrada && (
        <div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
          <p role="alert" className="t-apoio text-erro">
            {TEXTO_DE_ERRO_AO_ABRIR_A_PROVA}
          </p>
          <Button className="mt-3" onClick={() => void prova.refetch({ cancelRefetch: false })}>
            Tentar de novo
          </Button>
        </div>
      )}
    </Frame>
  )
}

export default function ProvaEmFoco({ atividadeAplicadaId }: { atividadeAplicadaId: string }) {
  const [, navegar] = useLocation()
  const prova = useQuery(provaEmFocoQueryOptions(atividadeAplicadaId))
  const aoSair = () => navegar(ALUNO_ROUTES.atividades, { state: { voltouDaProva: atividadeAplicadaId } })
  if (prova.data === undefined) return <ProvaSemDados atividadeAplicadaId={atividadeAplicadaId} prova={prova} aoSair={aoSair} />
  return <ProvaAberta atividadeAplicadaId={atividadeAplicadaId} dados={prova.data} aoSair={aoSair} />
}
