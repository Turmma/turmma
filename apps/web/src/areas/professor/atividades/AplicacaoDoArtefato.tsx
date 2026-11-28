import { ErrorCode, PERCENTUAIS_DE_TEMPO_ADICIONAL, type AplicarAtividadeRequest, type AtividadeAplicada, type ArtefatoResponse } from '@educa/shared'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Link } from 'wouter'
import { alunosDaTurmaQueryOptions } from '../../../api/alunos-da-turma'
import { aplicarAtividade, atividadesAplicadasQueryOptions, recarregarAtividades } from './api/atividades'
import { errorText } from '../../../components/error-text'
import { caminhoDaCorrecaoDoProfessor } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, type ConfirmDialogRow } from '../../../components/ui/overlays/ConfirmDialog'
import { FormField } from '../../../components/ui/fields/FormField'
import { OptionCard } from '../../../components/ui/fields/OptionCard'
import { Select } from '../../../components/ui/fields/Select'
import { LoadingState } from '../../../components/states/index'
import { SectionHeader } from '../../../components/ui/Page'
import { formatDateTime } from '../../../format'
import { ordemDeNome } from '../turmas/alunos-da-turma'
import { avisoDaAvaliativaAberta, EFEITO_DE_APLICAR, ESCOLHA_DE_AVALIATIVA, semCorrecao, situacaoDaAplicacao, TEXTO_SEM_CORRECAO } from './aprovar'
import { useCorrigirDeNovo } from './corrigir-de-novo'
import { EncerramentoDaAtividade } from './EncerramentoDaAtividade'
import { conferirAProva, FORMULARIO_VAZIO_DA_PROVA, resumoDaProva, type CamposDaJanela, type ErrosDaProva, type FormularioDaProva, type PedidoDaProva } from './prova-online'

/** O que a tela diz quando a API recusa aplicar: a que já está aberta, e a versão adaptada que ainda não foi aprovada. */
const TEXTOS_DA_APLICACAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.CONFLITO]: 'Esta atividade já está aberta para a turma. Encerre a que está aberta antes de aplicar de novo.',
}

type Escolha = (typeof ESCOLHA_DE_AVALIATIVA)[number]['valor']

/**
 * A atividade pode ir para a turma? Só a atividade objetiva; a versão adaptada, só depois de aprovada (regra 70, item
 * 3: o banco também recusa); e não enquanto ela já está aberta para a turma.
 */
export function canAplicar(artefato: Pick<ArtefatoResponse, 'tipo' | 'entrega'>, aplicadas: readonly Pick<AtividadeAplicada, 'estado'>[]): boolean {
  if (artefato.tipo !== 'atividade_objetiva') return false
  if (artefato.entrega !== null && artefato.entrega.estado !== 'aprovada') return false
  return !aplicadas.some((aplicada) => aplicada.estado === 'aberta')
}

interface PropsDaAplicacao {
  readonly artefato: ArtefatoResponse
  readonly nomeDaTurma: string | undefined
}

/** O que o professor escolhe de tempo adicional por aluno: o texto de cada opção, sem dizer por quê (RF3; não há campo de motivo). */
const OPCOES_DE_TEMPO_ADICIONAL = [
  { valor: '0', rotulo: 'Sem tempo adicional' },
  ...PERCENTUAIS_DE_TEMPO_ADICIONAL.map((percentual) => ({ valor: String(percentual), rotulo: `+${String(percentual)}%` })),
]

interface PropsDosCamposDaJanela {
  readonly valor: CamposDaJanela
  readonly aoMudar: (campos: CamposDaJanela) => void
  readonly erros: ErrosDaProva
  readonly desligados?: boolean
}

/**
 * O horário em que a prova abre e fecha e a duração (RF1): cada campo com rótulo e erro (`FormField`). O horário é o da escola. Serve ao aplicar e à
 * mudança de janela (`MudarJanela`), que escrevem os mesmos três campos.
 */
export function CamposDaJanela({ valor, aoMudar, erros, desligados = false }: PropsDosCamposDaJanela) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FormField rotulo="Abre em" type="datetime-local" value={valor.abre} onChange={(evento) => aoMudar({ ...valor, abre: evento.target.value })} erro={erros.abre} dica="No horário da escola." disabled={desligados} />
      <FormField rotulo="Fecha em" type="datetime-local" value={valor.fecha} onChange={(evento) => aoMudar({ ...valor, fecha: evento.target.value })} erro={erros.fecha} disabled={desligados} />
      <FormField
        rotulo="Duração (minutos)"
        type="number"
        inputMode="numeric"
        min={5}
        max={300}
        step={1}
        value={valor.duracao}
        onChange={(evento) => aoMudar({ ...valor, duracao: evento.target.value })}
        erro={erros.duracao}
        dica="Conta do começo de cada aluno. Sem duração, vale a janela."
        disabled={desligados}
      />
    </div>
  )
}

interface PropsDoTempoAdicional {
  readonly turmaId: string
  readonly valor: FormularioDaProva['tempoAdicional']
  readonly aoMudar: (valor: FormularioDaProva['tempoAdicional']) => void
  readonly erro: string | undefined
  readonly desligado: boolean
}

/**
 * **Tempo adicional por aluno** (RF3): a lista da turma, uma coluna em qualquer largura, com um seletor por aluno (sem tempo adicional, +25%, +50%, +100%). É
 * adaptação, dado sensível (D35): só o percentual, **sem campo de motivo**, e a lista só existe nesta janela. Os nomes vêm de `GET /v1/turmas/:id/alunos`, lida
 * de cem em cem como na aba Alunos.
 */
function TempoAdicionalPorAluno({ turmaId, valor, aoMudar, erro, desligado }: PropsDoTempoAdicional) {
  const idDoTitulo = useId()
  const idDoErro = useId()
  return (
    <div role="group" aria-labelledby={idDoTitulo} {...(erro === undefined ? {} : { 'aria-describedby': idDoErro })} className="flex min-w-0 flex-col gap-2">
      <p id={idDoTitulo} className="font-medium">
        Tempo adicional
      </p>
      <p className="text-sm break-words text-apoio">Só para quem tem direito. Vale para esta prova e fica registrado com o seu nome.</p>
      <ListaDoTempoAdicional turmaId={turmaId} valor={valor} aoMudar={aoMudar} desligado={desligado} />
      {erro !== undefined && (
        <p id={idDoErro} className="text-sm font-bold break-words text-vermelho-texto">
          {erro}
        </p>
      )}
    </div>
  )
}

/** Os alunos da turma, lidos de cem em cem, cada um com o seu seletor; carregando, com falha e vazio dizem o que é. */
function ListaDoTempoAdicional({ turmaId, valor, aoMudar, desligado }: Omit<PropsDoTempoAdicional, 'erro'>) {
  const alunos = useInfiniteQuery(alunosDaTurmaQueryOptions(turmaId))
  const lidos = (alunos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).sort(ordemDeNome)

  function escolher(alunoId: string, texto: string): void {
    const { [alunoId]: _anterior, ...resto } = valor
    const percentual = PERCENTUAIS_DE_TEMPO_ADICIONAL.find((opcao) => String(opcao) === texto)
    aoMudar(percentual === undefined ? resto : { ...resto, [alunoId]: percentual })
  }

  if (alunos.isPending) return <LoadingState rotulo="Carregando os alunos da turma…" />
  if (alunos.isError) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p role="alert" className="min-w-0 flex-1 basis-56 rounded-controle bg-erro-cx p-3 break-words text-erro">
          {errorText(alunos.error)}
        </p>
        <Button variante="secundario" onClick={() => void alunos.refetch({ cancelRefetch: false })}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  if (lidos.length === 0) return <p className="text-sm text-sutil">Esta turma ainda não tem alunos.</p>
  return (
    <>
      <ul className="flex min-w-0 flex-col gap-2">
        {lidos.map((aluno) => (
          <li key={aluno.usuarioId} className="min-w-0">
            <Select rotulo={aluno.nome} opcoes={OPCOES_DE_TEMPO_ADICIONAL} valor={String(valor[aluno.usuarioId] ?? 0)} aoMudar={(texto) => escolher(aluno.usuarioId, texto)} desligada={desligado} />
          </li>
        ))}
      </ul>
      {alunos.hasNextPage && (
        <Button variante="secundario" disabled={alunos.isFetchingNextPage} onClick={() => void alunos.fetchNextPage()}>
          {alunos.isFetchingNextPage ? 'Carregando…' : 'Ver mais alunos'}
        </Button>
      )}
    </>
  )
}

interface PropsDosCamposDaProva {
  readonly turmaId: string
  readonly formulario: FormularioDaProva
  readonly aoMudar: (formulario: FormularioDaProva) => void
  readonly erros: ErrosDaProva
  readonly desligados: boolean
}

/** Os campos que só a atividade **avaliativa** tem (RF1 a RF3, RF8): a janela, a duração, o embaralhamento e o tempo adicional por aluno. */
function CamposDaProva({ turmaId, formulario, aoMudar, erros, desligados }: PropsDosCamposDaProva) {
  return (
    <div data-campos-da-prova="" className="flex min-w-0 flex-col gap-4">
      <p className="text-sm break-words text-apoio">Os alunos começam a prova dentro da janela, e a duração conta do começo de cada um.</p>
      <CamposDaJanela valor={formulario} aoMudar={(campos) => aoMudar({ ...formulario, ...campos })} erros={erros} desligados={desligados} />
      <div className="grid min-w-0 grid-cols-1 gap-2">
        <OptionCard
          tipo="checkbox"
          nome="embaralhar-questoes"
          valor="questoes"
          rotulo="Embaralhar questões"
          marcada={formulario.embaralhar.questoes}
          desligada={desligados}
          aoMudar={(marcada) => aoMudar({ ...formulario, embaralhar: { ...formulario.embaralhar, questoes: marcada } })}
        />
        <OptionCard
          tipo="checkbox"
          nome="embaralhar-alternativas"
          valor="alternativas"
          rotulo="Embaralhar alternativas"
          marcada={formulario.embaralhar.alternativas}
          desligada={desligados}
          aoMudar={(marcada) => aoMudar({ ...formulario, embaralhar: { ...formulario.embaralhar, alternativas: marcada } })}
        />
      </div>
      <TempoAdicionalPorAluno turmaId={turmaId} valor={formulario.tempoAdicional} aoMudar={(tempoAdicional) => aoMudar({ ...formulario, tempoAdicional })} erro={erros.tempoAdicional} desligado={desligados} />
    </div>
  )
}

/** O resumo do diálogo: a atividade, a turma, as questões e, na avaliativa com a prova conferida, a frase da prova (janela no fuso da escola, duração e tempo adicional). */
function resumoDaAplicacao(artefato: ArtefatoResponse, turma: string, prova: PedidoDaProva | undefined): [ConfirmDialogRow, ...ConfirmDialogRow[]] {
  const resumo: [ConfirmDialogRow, ...ConfirmDialogRow[]] = [
    { rotulo: 'Atividade', valor: artefato.titulo },
    { rotulo: 'Turma', valor: turma },
    { rotulo: 'Questões', valor: artefato.conteudo.tipo === 'atividade_objetiva' ? String(artefato.conteudo.questoes.length) : '—' },
  ]
  if (prova !== undefined) resumo.push({ rotulo: 'Prova', valor: resumoDaProva({ turma, janela: prova.janela, duracaoMin: prova.duracaoMin, comTempoAdicional: prova.tempoAdicional.length }) })
  return resumo
}

/**
 * **Aplicar à turma e encerrar** (A3; `docs/mvp-contratos.md`, "Atividade e correção"): a atividade objetiva vai para a
 * turma com a escolha "é avaliativa?", que diz o que acontece com o Tutor; depois ela aparece como "Atribuída à turma",
 * com quantos já enviaram, e pode ser encerrada.
 *
 * As duas são decisões da professora, registradas com quem e quando, e por isso passam pela confirmação que diz o que
 * vai acontecer antes (regra 50, item 8): aplicar mostra a atividade, a turma e o efeito da escolha; encerrar diz que as
 * respostas param, que a correção é feita e que ela fica esperando a professora. A versão adaptada só aplica aprovada.
 *
 * A trava do envio único é de cada ação: "Aplicar" tem a sua (`decidindo`, aqui), e "Corrigir de novo" a do gancho `useCorrigirDeNovo`, que o
 * painel da turma também usa. Elas já não eram a mesma coisa que o usuário percebesse (um é diálogo, o outro é botão de linha), e uma não
 * segura a outra.
 */
export function AplicacaoDoArtefato({ artefato, nomeDaTurma }: PropsDaAplicacao) {
  const cliente = useQueryClient()
  const atividades = useQuery(atividadesAplicadasQueryOptions(artefato.turmaId))
  const [aplicando, definirAplicando] = useState(false)
  const [escolha, definirEscolha] = useState<Escolha | undefined>(undefined)
  const [tentou, definirTentou] = useState(false)
  const [formulario, definirFormulario] = useState<FormularioDaProva>(FORMULARIO_VAZIO_DA_PROVA)
  const decidindo = useRef(false)
  const secao = useRef<HTMLElement>(null)
  const idDoTitulo = useId()
  const idDaEscolha = useId()

  const aplicadas = (atividades.data?.itens ?? []).filter((aplicada) => aplicada.artefatoId === artefato.id)
  const ehAvaliativa = escolha === 'avaliativa'
  const conferida = conferirAProva(formulario)
  const close = () => definirAplicando(false)
  const aplicar = useMutation({
    mutationFn: (prova: Pick<AplicarAtividadeRequest, 'avaliativa' | 'janela' | 'duracaoMin' | 'embaralhar' | 'tempoAdicional'>) => aplicarAtividade({ artefatoId: artefato.id, turmaId: artefato.turmaId, ...prova }),
    onSuccess: async () => {
      recarregarAtividades(cliente)
      await cliente.invalidateQueries({ queryKey: atividadesAplicadasQueryOptions(artefato.turmaId).queryKey })
      close()
    },
    onSettled: () => (decidindo.current = false),
  })
  // Encerrar de novo uma atividade que já está encerrada (a correção que não nasceu): sem confirmação, porque nada muda para os alunos.
  const { corrigirDeNovo, aviso, falha: falhaDaCorrecao, corrigindo } = useCorrigirDeNovo(artefato.turmaId)

  function openAplicar(): void {
    aplicar.reset()
    definirEscolha(undefined)
    definirTentou(false)
    definirFormulario(FORMULARIO_VAZIO_DA_PROVA)
    definirAplicando(true)
  }

  function confirmarAplicar(): void {
    definirTentou(true)
    const escolhida = ESCOLHA_DE_AVALIATIVA.find((opcao) => opcao.valor === escolha)
    if (escolhida === undefined || decidindo.current) return
    // A avaliativa leva a prova (RF1 a RF3), conferida antes de sair; a prática vai como sempre foi, sem janela.
    if (escolhida.avaliativa && conferida.pedido === undefined) return
    decidindo.current = true
    aplicar.mutate(escolhida.avaliativa && conferida.pedido !== undefined ? { avaliativa: true, ...conferida.pedido } : { avaliativa: false })
  }

  const turma = nomeDaTurma ?? 'Turma da atividade'
  const aplicavel = atividades.data !== undefined && canAplicar(artefato, aplicadas)
  // A versão adaptada que ainda não foi aprovada não vai à turma: a tela diz por quê, em vez de oferecer um botão que a API recusa.
  const esperaAprovacao = artefato.tipo === 'atividade_objetiva' && artefato.entrega !== null && artefato.entrega.estado === 'pendente'
  if (artefato.tipo !== 'atividade_objetiva') return null

  return (
    <section ref={secao} tabIndex={-1} aria-labelledby={idDoTitulo} data-aplicacao-do-artefato="" className="flex min-w-0 flex-col gap-3 rounded-cartao">
      <SectionHeader
        id={idDoTitulo}
        titulo="Na turma"
        // A frase só com a lista lida: carregando ou com falha, a tela não afirma que a atividade não foi aplicada.
        {...(atividades.data === undefined ? {} : { apoio: aplicadas.length === 0 ? 'Esta atividade ainda não foi aplicada.' : 'Atribuída à turma.' })}
        acao={
          aplicavel ? (
            <Button variante="oficial" onClick={openAplicar}>
              Aplicar à turma
            </Button>
          ) : undefined
        }
      />
      {atividades.isPending && <LoadingState rotulo="Carregando as aplicações desta atividade…" />}
      {atividades.isError && (
        // O erro fica na seção, com "Tentar de novo" secundário: a ação principal do artefato continua sendo uma só.
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p role="alert" className="min-w-0 flex-1 basis-56 rounded-controle bg-erro-cx p-3 break-words text-erro">
            {errorText(atividades.error)}
          </p>
          <Button variante="secundario" disabled={atividades.isFetching} onClick={() => void atividades.refetch({ cancelRefetch: false })}>
            {atividades.isFetching ? 'Tentando…' : 'Tentar de novo'}
          </Button>
        </div>
      )}
      <p role="status" className="rounded-controle bg-info-cx p-3 break-words text-info empty:hidden">
        {aviso}
      </p>
      {falhaDaCorrecao !== undefined && (
        <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro">
          {errorText(falhaDaCorrecao)}
        </p>
      )}
      {esperaAprovacao && <p className="min-w-0 text-sm break-words text-sutil">Esta versão adaptada só pode ser aplicada à turma depois que você aprovar.</p>}
      {aplicadas.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-2">
          {aplicadas.map((aplicada) => {
            const motivo = semCorrecao(aplicada)
            return (
            <li key={aplicada.id} data-atividade-aplicada={aplicada.estado} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-cartao border border-linha bg-superficie p-4">
              <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
                <p className="font-medium break-words text-tinta">{situacaoDaAplicacao(aplicada)}</p>
                <p className="text-sm break-words text-sutil">
                  {turma} · aplicada em {formatDateTime(aplicada.aplicadaEm)}
                  {aplicada.encerradaEm !== null && ` · encerrada em ${formatDateTime(aplicada.encerradaEm)}`}
                </p>
                {aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="text-sm break-words text-sutil">{avisoDaAvaliativaAberta(aplicada)}</p>}
                {motivo !== undefined && (
                  <p data-sem-correcao={motivo} className="text-sm break-words text-sutil">
                    {TEXTO_SEM_CORRECAO[motivo]}
                  </p>
                )}
              </div>
              <EncerramentoDaAtividade aplicada={aplicada} nomeDaTurma={turma} focoDeReserva={() => secao.current?.focus()} />
              {aplicada.entrega !== null && (
                // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
                <Link to={caminhoDaCorrecaoDoProfessor(aplicada.id)} className="inline-flex min-h-11 items-center text-caramelo-texto underline">
                  {aplicada.entrega.estado === 'pendente' ? 'Revisar a correção' : 'Ver a correção'}
                </Link>
              )}
              {/* Encerrada sem lote que valha (função suspensa, ou lote rejeitado): encerrar de novo corrige de novo. */}
              {(motivo === 'correcao_suspensa' || motivo === 'lote_rejeitado') && (
                <Button variante="secundario" disabled={corrigindo !== undefined} onClick={() => corrigirDeNovo(aplicada)}>
                  {corrigindo === aplicada.id ? 'Corrigindo…' : 'Corrigir de novo'}
                </Button>
              )}
            </li>
            )
          })}
        </ul>
      )}

      {aplicando && (
        <ConfirmDialog
          titulo="Aplicar à turma"
          familia="oficial"
          resumo={resumoDaAplicacao(artefato, turma, ehAvaliativa ? conferida.pedido : undefined)}
          efeito={EFEITO_DE_APLICAR}
          rotuloDeConfirmar="Aplicar à turma"
          rotuloConfirmando="Aplicando…"
          aoConfirmar={confirmarAplicar}
          aoFechar={close}
          confirmando={aplicar.isPending}
          focoDeReserva={() => secao.current?.focus()}
          {...(aplicar.isError ? { falha: errorText(aplicar.error, TEXTOS_DA_APLICACAO) } : {})}
        >
          <fieldset aria-describedby={idDaEscolha} className="flex min-w-0 flex-col gap-2">
            <legend className="font-medium">Esta atividade é avaliativa?</legend>
            {ESCOLHA_DE_AVALIATIVA.map((opcao) => (
              <label key={opcao.valor} className={`flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-controle border border-borda-campo px-3 py-2 ${escolha === opcao.valor ? 'bg-realce-suave' : 'bg-superficie'}`}>
                <input type="radio" name="avaliativa" value={opcao.valor} checked={escolha === opcao.valor} onChange={() => definirEscolha(opcao.valor)} disabled={aplicar.isPending} className="mt-0.5 size-6 shrink-0 accent-noite" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">{opcao.rotulo}</span>
                  <span className="text-sm break-words text-apoio">{opcao.descricao}</span>
                </span>
              </label>
            ))}
            <p id={idDaEscolha} className="text-sm text-erro empty:hidden">
              {tentou && escolha === undefined ? 'Escolha se a atividade é prática ou avaliativa.' : ''}
            </p>
          </fieldset>
          {ehAvaliativa && <CamposDaProva turmaId={artefato.turmaId} formulario={formulario} aoMudar={definirFormulario} erros={tentou ? conferida.erros : {}} desligados={aplicar.isPending} />}
        </ConfirmDialog>
      )}
    </section>
  )
}
