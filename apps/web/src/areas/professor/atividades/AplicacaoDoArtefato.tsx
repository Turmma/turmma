import { ErrorCode, type AtividadeAplicada, type ArtefatoResponse } from '@educa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Link } from 'wouter'
import { aplicarAtividade, atividadesAplicadasQueryOptions, recarregarAtividades } from './api/atividades'
import { errorText } from '../../../components/error-text'
import { caminhoDaCorrecaoDoProfessor } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/overlays/ConfirmDialog'
import { LoadingState } from '../../../components/states/index'
import { SectionHeader } from '../../../components/ui/Page'
import { formatDateTime } from '../../../format'
import { AVISO_DA_AVALIATIVA_ABERTA, EFEITO_DE_APLICAR, ESCOLHA_DE_AVALIATIVA, semCorrecao, situacaoDaAplicacao, TEXTO_SEM_CORRECAO } from './aprovar'
import { useCorrigirDeNovo } from './corrigir-de-novo'
import { EncerramentoDaAtividade } from './EncerramentoDaAtividade'

/** O que a tela diz quando a API recusa aplicar: a que já está aberta, e a versão adaptada que ainda não foi aprovada. */
const TEXTOS_DA_APLICACAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.CONFLITO]: 'Esta atividade já está aberta para a turma. Encerre a que está aberta antes de aplicar de novo.',
}

type Escolha = (typeof ESCOLHA_DE_AVALIATIVA)[number]['valor']

/**
 * A atividade pode ir para a turma? Só a atividade objetiva; a versão adaptada, só depois de aprovada (regra 70, item
 * 3: o banco também recusa); e não enquanto ela já está aberta para a turma.
 */
export function podeAplicar(artefato: Pick<ArtefatoResponse, 'tipo' | 'entrega'>, aplicadas: readonly Pick<AtividadeAplicada, 'estado'>[]): boolean {
  if (artefato.tipo !== 'atividade_objetiva') return false
  if (artefato.entrega !== null && artefato.entrega.estado !== 'aprovada') return false
  return !aplicadas.some((aplicada) => aplicada.estado === 'aberta')
}

interface PropsDaAplicacao {
  readonly artefato: ArtefatoResponse
  readonly nomeDaTurma: string | undefined
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
  const decidindo = useRef(false)
  const secao = useRef<HTMLElement>(null)
  const idDoTitulo = useId()
  const idDaEscolha = useId()

  const aplicadas = (atividades.data?.itens ?? []).filter((aplicada) => aplicada.artefatoId === artefato.id)
  const fechar = () => definirAplicando(false)
  const aplicar = useMutation({
    mutationFn: (avaliativa: boolean) => aplicarAtividade({ artefatoId: artefato.id, turmaId: artefato.turmaId, avaliativa }),
    onSuccess: async () => {
      recarregarAtividades(cliente)
      await cliente.invalidateQueries({ queryKey: atividadesAplicadasQueryOptions(artefato.turmaId).queryKey })
      fechar()
    },
    onSettled: () => (decidindo.current = false),
  })
  // Encerrar de novo uma atividade que já está encerrada (a correção que não nasceu): sem confirmação, porque nada muda para os alunos.
  const { corrigirDeNovo, aviso, falha: falhaDaCorrecao, corrigindo } = useCorrigirDeNovo(artefato.turmaId)

  function abrirAplicar(): void {
    aplicar.reset()
    definirEscolha(undefined)
    definirTentou(false)
    definirAplicando(true)
  }

  function confirmarAplicar(): void {
    definirTentou(true)
    const escolhida = ESCOLHA_DE_AVALIATIVA.find((opcao) => opcao.valor === escolha)
    if (escolhida === undefined || decidindo.current) return
    decidindo.current = true
    aplicar.mutate(escolhida.avaliativa)
  }

  const turma = nomeDaTurma ?? 'Turma da atividade'
  const aplicavel = atividades.data !== undefined && podeAplicar(artefato, aplicadas)
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
            <Button variante="oficial" onClick={abrirAplicar}>
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
                {aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="text-sm break-words text-sutil">{AVISO_DA_AVALIATIVA_ABERTA}</p>}
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
          resumo={[
            { rotulo: 'Atividade', valor: artefato.titulo },
            { rotulo: 'Turma', valor: turma },
            { rotulo: 'Questões', valor: artefato.conteudo.tipo === 'atividade_objetiva' ? String(artefato.conteudo.questoes.length) : '—' },
          ]}
          efeito={EFEITO_DE_APLICAR}
          rotuloDeConfirmar="Aplicar à turma"
          rotuloConfirmando="Aplicando…"
          aoConfirmar={confirmarAplicar}
          aoFechar={fechar}
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
        </ConfirmDialog>
      )}
    </section>
  )
}
