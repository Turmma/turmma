import { ErrorCode, type AlvoDaSenhaProvisoriaResponse, type SenhaProvisoriaResponse } from '@educa/shared'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { ApiError } from '../../api/client'
import { gerarASenhaProvisoria, lerOAlvoDaSenhaProvisoria, senhaSoletrada, TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA, TEXTOS_DA_FALHA_DA_PROVISORIA } from '../../api/senha-provisoria/senha-provisoria'
import { aoTrocarDeSessao } from '../../api/sessao'
import { formatDayAtTime } from '../../format'
import { CloseConfirmation, CopyStatus, FailureAlert, useCopyToClipboard, useGuardedClose, useStepFocus, type CopyMessages } from '../copy-once'
import { errorText } from '../error-text'
import { LoadingState, ErrorState } from '../states/index'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../ui/button-variants'
import { Dialog } from '../ui/overlays/Dialog'

/**
 * "Gerar senha provisória" (acesso-e-convites, tarefa 12.0; RF13, RF18; Tech Spec, seções 5, "O alvo da provisória", e 9; `cenarios.md`, "Telas"): o diálogo que o menu da linha do aluno
 * aprovado abre, na aba Alunos da turma do professor e na turma aberta da coordenação. Duas etapas e a pergunta de fechar:
 *
 * 1. **Confirmar**: lê o alvo ao abrir (`GET …/senha-provisoria`) e mostra o nome, a turma e a matrícula do aluno e a consequência (a senha atual deixa de valer, e ele sai da conta em todo
 *    lugar). Enquanto lê, "Gerar" fica ocupado. O aluno que entra pela conta da escola mostra o aviso aqui, sem "Gerar". Dois alunos de mesmo nome se distinguem pela matrícula.
 * 2. **A senha**: depois do `POST`, em dois grupos, grande, com "Copiar" e a validade. Aparece uma vez: fechar sem copiar pergunta antes (como o link do convite; regra 20, item 8).
 *
 * **Nada fica fora do diálogo.** O alvo e a senha moram no estado desta abertura (cada abertura é uma instância nova, pela `key` de quem a monta), nunca no cache de consultas, no endereço, no
 * armazenamento do navegador nem em log. A senha vem de uma mutação com `gcTime: 0`, solta ao fechar. A resposta de uma abertura que já fechou não alcança a seguinte: a leitura é abortada ao
 * desmontar, e o `onError` do `mutate` é do observador desta instância, que não existe mais. A troca de sessão fecha o diálogo (a pessoa seguinte na mesma aba não herda nada).
 *
 * O aluno que deixou de ser alcançável (404, na leitura ou na geração) fecha o diálogo pelo `aoPerderOAluno`, e quem o abriu diz o aviso e lê a lista de novo.
 */

type LeituraDoAlvo =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'lida'; readonly alvo: AlvoDaSenhaProvisoriaResponse }
  | { readonly estado: 'falhou'; readonly erro: unknown }

const TITULO = 'Gerar senha provisória'

/** O que a cópia da senha diz: sem área de transferência, ninguém seleciona campo nenhum, e a tela pede para anotar. */
const DITOS_DA_SENHA: CopyMessages = {
  copiado: 'Senha copiada.',
  selecionado: 'Não foi possível copiar. Anote a senha que está na tela.',
}

function temCodigo(erro: unknown, codigo: ErrorCode): boolean {
  return erro instanceof ApiError && erro.codigo === codigo
}

/** O que a pergunta de fechar diz da senha: aparece uma vez, e sem ela só gerando outra (que a anterior deixa de valer). */
function textoDaPergunta(noAr: boolean): string {
  return noAr
    ? 'A senha ainda está sendo gerada, e aparece uma vez só, aqui. Se fechar agora, ela não aparece, e será preciso gerar outra daqui a alguns segundos.'
    : 'A senha aparece uma vez só. Se fechar agora, ela não aparece de novo, e será preciso gerar outra: a atual deixa de valer.'
}

type FuncaoEmRef = RefObject<() => void>

/**
 * A leitura do alvo: ao abrir, e a cada "Tentar de novo". Desmontar a aborta, e a resposta de uma leitura abortada não muda o estado. O 404 não vira estado: o aluno que sumiu é de quem abriu o
 * diálogo, pelo `perderOAluno`.
 */
function useLeituraDoAlvo(usuarioId: string, perderOAluno: FuncaoEmRef) {
  const [leitura, definirLeitura] = useState<LeituraDoAlvo>({ estado: 'lendo' })
  // Sobe a cada "Tentar de novo": é o que refaz o efeito.
  const [tentativa, definirTentativa] = useState(0)
  useEffect(() => {
    const controle = new AbortController()
    lerOAlvoDaSenhaProvisoria(usuarioId, controle.signal).then(
      (alvo) => {
        definirLeitura({ estado: 'lida', alvo })
      },
      (erro: unknown) => {
        if (controle.signal.aborted) return
        if (temCodigo(erro, ErrorCode.NAO_ENCONTRADO)) perderOAluno.current()
        else definirLeitura({ estado: 'falhou', erro })
      },
    )
    return () => controle.abort()
  }, [usuarioId, tentativa, perderOAluno])
  function tentarDeNovo(): void {
    definirLeitura({ estado: 'lendo' })
    definirTentativa((n) => n + 1)
  }
  return { leitura, tentarDeNovo }
}

/** A geração, uma por vez: o segundo clique de um clique duplo chega antes do `isPending`. O `onError` e o `onSettled` são do observador desta abertura. */
function useGeracao(usuarioId: string, perderOAluno: FuncaoEmRef) {
  const noAr = useRef(false)
  const gerar = useMutation({ mutationFn: () => gerarASenhaProvisoria(usuarioId), gcTime: 0 })
  function confirmar(): void {
    if (noAr.current) return
    noAr.current = true
    gerar.mutate(undefined, {
      onSettled: () => {
        noAr.current = false
      },
      onError: (erro) => {
        if (temCodigo(erro, ErrorCode.NAO_ENCONTRADO)) perderOAluno.current()
      },
    })
  }
  return { gerar, confirmar }
}

/** A consequência, dita antes de gerar (regra 50, item 8). */
function ConsequenciaDaGeracao() {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio">
      <li>A senha atual deixa de valer, e o aluno sai da conta em todo lugar.</li>
      <li>A senha provisória vale 24 horas, aparece uma vez só e o aluno a troca na primeira entrada.</li>
    </ul>
  )
}

/** O aluno que a leitura trouxe: nome, turma (some sem turma) e matrícula (some no aluno só com a conta da escola). Dois alunos de mesmo nome diferem pela matrícula. */
function AlunoDaConfirmacao({ alvo }: { alvo: AlvoDaSenhaProvisoriaResponse }) {
  return (
    <dl className="grid gap-3">
      <div>
        <dt className="text-sm text-sutil">Aluno</dt>
        <dd className="wrap-anywhere">{alvo.nome}</dd>
      </div>
      {alvo.turma !== null && (
        <div>
          <dt className="text-sm text-sutil">Turma</dt>
          <dd className="wrap-anywhere">{alvo.turma}</dd>
        </div>
      )}
      {alvo.matricula !== null && (
        <div>
          <dt className="text-sm text-sutil">Matrícula</dt>
          <dd className="wrap-anywhere">{alvo.matricula}</dd>
        </div>
      )}
    </dl>
  )
}

interface PropsDaConfirmacao {
  readonly leitura: LeituraDoAlvo
  readonly tentarDeNovo: () => void
  readonly gerar: { readonly isPending: boolean; readonly isError: boolean; readonly error: unknown }
  readonly entraPelaConta: boolean
  readonly aoGerar: () => void
  readonly aoCancelar: () => void
  readonly textoDaConfirmacao: RefObject<HTMLParagraphElement | null>
}

/** Os botões da confirmação. "Gerar" fica ocupado enquanto o alvo é lido e enquanto a geração anda, e some quando não há senha a gerar (a conta da escola, a leitura que falhou). */
function BotoesDaConfirmacao({ leitura, gerar, entraPelaConta, aoGerar, aoCancelar }: Omit<PropsDaConfirmacao, 'tentarDeNovo' | 'textoDaConfirmacao'>) {
  const podeGerar = !entraPelaConta && leitura.estado !== 'falhou'
  return (
    <div className="flex flex-wrap justify-end gap-3">
      {podeGerar && (
        <Button onClick={aoGerar} disabled={leitura.estado !== 'lida' || gerar.isPending} aria-busy={leitura.estado === 'lendo' || gerar.isPending}>
          {gerar.isPending ? 'Gerando…' : TITULO}
        </Button>
      )}
      <button type="button" onClick={aoCancelar} className={SECONDARY_BUTTON_CLASSES}>
        {entraPelaConta ? 'Fechar' : 'Cancelar'}
      </button>
    </div>
  )
}

/** A confirmação: o aluno, a consequência e os botões; ou "Carregando…", ou a falha da leitura com "Tentar de novo", ou o aviso da conta da escola. */
function EtapaDeConfirmar(props: PropsDaConfirmacao) {
  const { leitura, tentarDeNovo, gerar, entraPelaConta, textoDaConfirmacao } = props
  const falha = gerar.isError && !entraPelaConta ? errorText(gerar.error, TEXTOS_DA_FALHA_DA_PROVISORIA) : undefined
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p ref={textoDaConfirmacao} tabIndex={-1} className="text-apoio">
        Confira quem é o aluno antes de gerar a senha provisória.
      </p>
      {leitura.estado === 'lendo' && <LoadingState rotulo="Carregando…" />}
      {leitura.estado === 'falhou' && <ErrorState erro={leitura.erro} aoTentarDeNovo={tentarDeNovo} />}
      {leitura.estado === 'lida' && <AlunoDaConfirmacao alvo={leitura.alvo} />}
      {entraPelaConta ? <Alert tom="info">{TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA}</Alert> : leitura.estado === 'lida' && <ConsequenciaDaGeracao />}
      {falha !== undefined && <FailureAlert texto={falha} erro={gerar.error} />}
      <BotoesDaConfirmacao {...props} />
      <span role="status" className="sr-only">
        {gerar.isPending ? 'Gerando a senha provisória…' : ''}
      </span>
    </div>
  )
}

interface PropsDaSenha {
  readonly senha: SenhaProvisoriaResponse
  readonly nome: string | undefined
  readonly copia: ReturnType<typeof useCopyToClipboard>
  readonly titulo: RefObject<HTMLHeadingElement | null>
  readonly aoFechar: () => void
}

/** A senha, uma vez: em dois grupos, grande, com "Copiar" e a validade. O leitor de tela ouve a versão soletrada, grupo a grupo (como o código da turma). */
function EtapaDaSenha({ senha, nome, copia, titulo, aoFechar }: PropsDaSenha) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <h3 ref={titulo} tabIndex={-1} className="t-cartao">
        {nome === undefined ? 'Senha provisória' : `Senha provisória de ${nome}`}
      </h3>
      <p className="text-apoio">Entregue a senha ao aluno. Ela vale até {formatDayAtTime(senha.expiraEm)} e aparece uma vez só, aqui. Na primeira entrada, o aluno cria a senha dele.</p>
      <p aria-hidden="true" data-senha-provisoria="" className="font-mono text-4xl font-semibold tracking-widest text-tinta sm:text-6xl">
        {senha.senha}
      </p>
      <p className="sr-only">{senhaSoletrada(senha.senha)}</p>
      <CopyStatus texto={copia.texto} vez={copia.vez} copiado={copia.copiado} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={() => void copia.copiar(senha.senha, null, DITOS_DA_SENHA)}>Copiar</Button>
        <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
          Fechar
        </button>
      </div>
    </div>
  )
}

interface Props {
  /** O aluno, pelo id do usuário. */
  readonly usuarioId: string
  /** Fechar: quem fecha é quem desmonta (a tela, pela abertura deste diálogo). */
  readonly aoFechar: () => void
  /** O aluno que a API já não acha para esta pessoa (404): a tela fecha o diálogo, diz o aviso e lê a lista de novo. */
  readonly aoPerderOAluno: () => void
  /** O foco ao fechar quando o botão que abriu o diálogo já saiu da tela (a lista recarregou sem o aluno). */
  readonly focoDeReserva: () => void
}

/** O aluno entra pela conta da escola: já na leitura do alvo, ou na resposta da geração (outra pessoa a ligou entre as duas). */
function semSenha(leitura: LeituraDoAlvo, geracao: { readonly isError: boolean; readonly error: unknown }): boolean {
  if (leitura.estado === 'lida' && leitura.alvo.entraPelaContaDaEscola) return true
  return geracao.isError && temCodigo(geracao.error, ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA)
}

function nomeDoAluno(leitura: LeituraDoAlvo): string | undefined {
  return leitura.estado === 'lida' ? leitura.alvo.nome : undefined
}

/** Em que etapa o diálogo está: a pergunta de fechar vale sobre as outras duas. */
function etapaDoDialogo(perguntando: boolean, gerada: boolean): 'pergunta' | 'senha' | 'confirmar' {
  if (perguntando) return 'pergunta'
  return gerada ? 'senha' : 'confirmar'
}

/** A senha que ninguém copiou ainda: a geração no ar, ou a senha na tela sem cópia confirmada. Fechar agora a perderia. */
function senhaEmRisco(geracao: { readonly isPending: boolean; readonly isSuccess: boolean }, copiada: boolean): boolean {
  return geracao.isPending || (geracao.isSuccess && !copiada)
}

export function DialogoDaSenhaProvisoria({ usuarioId, aoFechar, aoPerderOAluno, focoDeReserva }: Props) {
  // As duas funções que vêm de fora vão por `ref`: o efeito da leitura e o da sessão não refazem, nem leem de novo, quando a identidade delas muda.
  const perderOAluno = useRef(aoPerderOAluno)
  const fecharDeVez = useRef(aoFechar)
  const { leitura, tentarDeNovo } = useLeituraDoAlvo(usuarioId, perderOAluno)
  const { gerar, confirmar } = useGeracao(usuarioId, perderOAluno)
  const copia = useCopyToClipboard()
  const fechamento = useGuardedClose(senhaEmRisco(gerar, copia.copiado), gerar.reset, aoFechar)
  const textoDaConfirmacao = useRef<HTMLParagraphElement>(null)
  const tituloDaSenha = useRef<HTMLHeadingElement>(null)
  const tituloDaPergunta = useRef<HTMLHeadingElement>(null)
  const etapa = etapaDoDialogo(fechamento.perguntando, gerar.isSuccess)
  const focos = { pergunta: tituloDaPergunta, senha: tituloDaSenha, confirmar: textoDaConfirmacao }
  useStepFocus(etapa, focos[etapa], gerar.isError)

  useEffect(() => {
    perderOAluno.current = aoPerderOAluno
    fecharDeVez.current = fechamento.fecharDeVez
  })
  // A pessoa seguinte na mesma aba não herda o aluno nem a senha: a troca de sessão fecha o diálogo e solta a mutação.
  useEffect(() => aoTrocarDeSessao(() => fecharDeVez.current()), [])

  return (
    <Dialog
      titulo={TITULO}
      aoFechar={fechamento.pedirParaFechar}
      aoFecharPeloNavegador={fechamento.fecharDeVez}
      fecharAoClicarFora
      focoInicial={textoDaConfirmacao}
      focoDeReserva={focoDeReserva}
    >
      {etapa === 'pergunta' && (
        <CloseConfirmation
          titulo={tituloDaPergunta}
          pergunta="Fechar sem copiar a senha?"
          texto={textoDaPergunta(gerar.isPending)}
          rotuloDeVoltar="Voltar à senha"
          aoVoltar={fechamento.voltar}
          aoFecharDeVez={fechamento.fecharDeVez}
        />
      )}
      {etapa === 'senha' && gerar.data !== undefined && (
        <EtapaDaSenha senha={gerar.data} nome={nomeDoAluno(leitura)} copia={copia} titulo={tituloDaSenha} aoFechar={fechamento.pedirParaFechar} />
      )}
      {etapa === 'confirmar' && (
        <EtapaDeConfirmar
          leitura={leitura}
          tentarDeNovo={tentarDeNovo}
          gerar={gerar}
          entraPelaConta={semSenha(leitura, gerar)}
          aoGerar={confirmar}
          aoCancelar={fechamento.pedirParaFechar}
          textoDaConfirmacao={textoDaConfirmacao}
        />
      )}
    </Dialog>
  )
}
