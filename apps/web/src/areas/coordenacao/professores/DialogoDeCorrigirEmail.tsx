import type { ConviteDeProfessorResponse, CorrigirEmailDoProfessorRequest, EstadoDoProfessor } from '@educa/shared'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { ROUTES } from '../../../paths'
import { CloseConfirmation, CopyStatus, FailureAlert, LinkField, useCopyToClipboard, useGuardedClose, useStepFocus } from '../../../components/copy-once'
import { linkDoConvite } from '../../../components/link-do-convite'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { FormField } from '../../../components/ui/fields/FormField'
import { Dialog } from '../../../components/ui/overlays/Dialog'
import { falhaDaCorrecaoDoEmail, pedidoDeCorrecaoDoEmail, TEXTO_DA_VALIDADE_DO_CONVITE, type FalhaDaCorrecaoDoEmail } from './convite-de-professor'

interface Props {
  /** O nome do professor, que a lista traz: o e-mail de hoje não aparece em lugar nenhum (a lista não o traz, E8). */
  readonly nome: string
  /** O estado do professor na lista de agora, e não o da abertura: o `CONFLITO` relê a lista e decide o texto por ele. `undefined` se ele saiu dela. */
  readonly estadoAgora: EstadoDoProfessor | undefined
  /** As opções de `api/professores.ts`, sem nada por cima: é lá que o `gcTime: 0` tira o link e o e-mail novo do cache, e o `onSettled` relê a lista antes de o erro chegar aqui. */
  readonly mutacao: UseMutationOptions<ConviteDeProfessorResponse, Error, CorrigirEmailDoProfessorRequest>
  /** "Enviar por e-mail": quem abre o diálogo do "Reenviar" deste professor é a tela, que também fecha este. */
  readonly aoEnviarPorEmail: () => void
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

const TEXTO_DA_PERGUNTA_COM_O_PEDIDO_NO_AR =
  'O e-mail ainda está sendo corrigido, e o link aparece uma vez só, aqui. Se fechar agora, ele não aparece, e para a pessoa entrar será preciso refazer o convite.'
const TEXTO_DA_PERGUNTA_COM_O_LINK = 'O link aparece uma vez só. Se fechar agora, ele não aparece de novo, e para a pessoa entrar será preciso refazer o convite.'

/** O link em risco: o pedido ainda no ar, ou o link na tela sem cópia confirmada. */
function linkEmRisco(correcao: { readonly isPending: boolean; readonly isSuccess: boolean }, copiado: boolean): boolean {
  return correcao.isPending || (correcao.isSuccess && !copiado)
}

/** A etapa do diálogo: a pergunta de fechar vem antes de tudo, e o link só existe com o pedido aceito. */
function etapaDoDialogo(perguntando: boolean, aceito: boolean): 'pergunta' | 'link' | 'campo' {
  if (perguntando) return 'pergunta'
  return aceito ? 'link' : 'campo'
}

/** O que se perde ao fechar agora: o pedido ainda no ar, ou o link já na tela. */
function textoDaPergunta(pedidoNoAr: boolean): string {
  return pedidoNoAr ? TEXTO_DA_PERGUNTA_COM_O_PEDIDO_NO_AR : TEXTO_DA_PERGUNTA_COM_O_LINK
}

/**
 * O que a pessoa digitou e o que o cadastro recusou antes de qualquer pedido. Mora no diálogo, e não na etapa: a pergunta de fechar troca a etapa, e
 * "Voltar ao e-mail" devolve o campo com o que estava nele.
 */
function useEmailDigitado(aoValidar: (pedido: CorrigirEmailDoProfessorRequest) => void) {
  const [email, definirEmail] = useState('')
  const [erro, definirErro] = useState<string | undefined>(undefined)
  function mudar(novo: string): void {
    definirEmail(novo)
    definirErro(undefined)
  }
  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const validacao = pedidoDeCorrecaoDoEmail(email)
    if (validacao.ok) aoValidar(validacao.pedido)
    else definirErro(validacao.erro)
  }
  return { email, erro, mudar, enviar }
}

/** O botão que fez o pedido tinha o foco, e o texto do e-mail que não serve é do campo: o foco volta a ele a cada tentativa recusada. */
function useFocoNoCampoDaFalha(campo: RefObject<HTMLInputElement | null>, doCampo: boolean, erro: unknown): void {
  useEffect(() => {
    if (doCampo) campo.current?.focus()
  }, [campo, doCampo, erro])
}

/** Os botões do formulário: o que corrige (e, depois de uma falha fora do campo, tenta de novo) some quando a lista deixou de valer, e sobra "Fechar". */
function AcoesDoEmail({ pendente, soFechar, tentarDeNovo, aoCancelar }: { readonly pendente: boolean; readonly soFechar: boolean; readonly tentarDeNovo: boolean; readonly aoCancelar: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      {!soFechar && (
        <Button type="submit" disabled={pendente}>
          {pendente ? 'Corrigindo…' : tentarDeNovo ? 'Tentar de novo' : 'Corrigir o e-mail'}
        </Button>
      )}
      <button type="button" onClick={aoCancelar} className={SECONDARY_BUTTON_CLASSES}>
        {soFechar ? 'Fechar' : 'Cancelar'}
      </button>
    </div>
  )
}

interface PropsDaEtapaDoEmail {
  readonly nome: string
  readonly campo: RefObject<HTMLInputElement | null>
  readonly digitado: ReturnType<typeof useEmailDigitado>
  /** A falha do pedido, já com o texto e o que ela faz com o diálogo; `undefined` sem falha. */
  readonly falha: FalhaDaCorrecaoDoEmail | undefined
  readonly erro: unknown
  readonly pendente: boolean
  readonly aoCancelar: () => void
}

/** A etapa do e-mail: o campo, o que o servidor recusou nele ou fora dele, e os botões. O e-mail fora do formato volta com o texto do cadastro, sem pedido. */
function EtapaDoEmail({ nome, campo, digitado, falha, erro, pendente, aoCancelar }: PropsDaEtapaDoEmail) {
  const doCampo = falha?.doCampo === true
  const soFechar = falha?.listaMudou === true
  const avisoFora = falha !== undefined && !doCampo
  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={digitado.enviar} noValidate>
      <p className="text-apoio">
        O e-mail certo de <span className="font-medium text-tinta wrap-anywhere">{nome}</span>. O professor continua o mesmo, com as turmas e as aulas dele.
      </p>
      {!soFechar && (
        <FormField
          ref={campo}
          rotulo="E-mail certo"
          dica="O link anterior deixa de valer."
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          obrigatorio
          value={digitado.email}
          onChange={(evento) => digitado.mudar(evento.target.value)}
          erro={digitado.erro ?? (doCampo ? falha.texto : undefined)}
        />
      )}
      {avisoFora && <FailureAlert texto={falha.texto} erro={erro} />}
      <AcoesDoEmail pendente={pendente} soFechar={soFechar} tentarDeNovo={avisoFora} aoCancelar={aoCancelar} />
      <span role="status" className="sr-only">
        {pendente ? 'Corrigindo o e-mail…' : ''}
      </span>
    </form>
  )
}

interface PropsDaEtapaDoLink {
  readonly nome: string
  /** O e-mail com que o pedido saiu: o mesmo que a pessoa vai usar para entrar. */
  readonly email: string | undefined
  readonly token: string
  readonly titulo: RefObject<HTMLHeadingElement | null>
  readonly copia: ReturnType<typeof useCopyToClipboard>
  readonly aoEnviarPorEmail: () => void
  readonly aoFechar: () => void
}

/** A etapa do link: "E-mail corrigido", o link do convite novo uma vez, com "Copiar link", e "Enviar por e-mail", que passa ao "Reenviar". */
function EtapaDoLink({ nome, email, token, titulo, copia, aoEnviarPorEmail, aoFechar }: PropsDaEtapaDoLink) {
  const campo = useRef<HTMLInputElement>(null)
  const link = linkDoConvite(window.location.origin, ROUTES.convite, token)
  return (
    <div className="mt-4 flex flex-col gap-4">
      <h3 ref={titulo} tabIndex={-1} className="t-cartao">
        E-mail corrigido
      </h3>
      <p className="text-apoio">
        Mande o link a <span className="font-medium text-tinta wrap-anywhere">{nome}</span>
        {email !== undefined && (
          <>
            , que passa a entrar com o e-mail <span className="font-medium text-tinta wrap-anywhere">{email}</span>
          </>
        )}
        . {TEXTO_DA_VALIDADE_DO_CONVITE} O link anterior deixou de valer. Depois de fechar, este link não aparece de novo.
      </p>
      <LinkField ref={campo} rotulo="Link do convite" link={link} aoCopiarAMao={copia.copiadoAMao} />
      <CopyStatus texto={copia.texto} vez={copia.vez} copiado={copia.copiado} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={() => void copia.copiar(link, campo.current)}>Copiar link</Button>
        <button type="button" onClick={aoEnviarPorEmail} className={SECONDARY_BUTTON_CLASSES}>
          Enviar por e-mail
        </button>
        <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
          Fechar
        </button>
      </div>
    </div>
  )
}

/**
 * "Corrigir o e-mail" (acesso-e-convites, 19.0; RF18; `cenarios.md`, "Telas", linha "Corrigir o e-mail"): a coordenação digita o e-mail certo do professor que
 * ainda não entrou, e o diálogo diz antes que o link anterior deixa de valer. Aceito, mostra "E-mail corrigido" e o link do convite novo, uma vez, com
 * "Copiar link" e "Enviar por e-mail", que passa ao diálogo do "Reenviar" deste professor (o link mostrado deixa de valer: o reenvio refaz o convite).
 *
 * O link é credencial (regra 20, item 8) e vive só na mutação deste diálogo: com `gcTime: 0` e o `reset()` de fechar, sai do cache de mutações na hora, nenhuma consulta o guarda, e ele nunca
 * vai ao endereço nem ao armazenamento do navegador. Fechar sem copiar pergunta antes, como no refazer. O pedido no ar não repete com o segundo clique, nem
 * com o segundo envio do mesmo quadro: quem trava é a referência `noAr`, e não o botão desligado.
 *
 * As falhas ficam aqui dentro. A do `CONFLITO` com o professor ainda em aberto é do campo (o e-mail que não serve), e o campo segue com o foco; a do convite que
 * mudou (`CONFLITO` com o estado mudado, `NAO_ENCONTRADO`) deixa só "Fechar", com o texto e a lista já relida; a rede e o resto mantêm o botão, que passa a dizer
 * "Tentar de novo" e apaga o aviso ao sair.
 */
export function DialogoDeCorrigirEmail({ nome, estadoAgora, mutacao, aoEnviarPorEmail, aoFechar, focoDeReserva }: Props) {
  // O pedido no ar, na hora: o segundo envio chega antes do `isPending`.
  const noAr = useRef(false)
  const corrigir = useMutation(mutacao)
  const copia = useCopyToClipboard()
  const fechamento = useGuardedClose(linkEmRisco(corrigir, copia.copiado), corrigir.reset, aoFechar)
  const campo = useRef<HTMLInputElement>(null)
  const tituloDoLink = useRef<HTMLHeadingElement>(null)
  const tituloDaPergunta = useRef<HTMLHeadingElement>(null)
  const etapa = etapaDoDialogo(fechamento.perguntando, corrigir.isSuccess)
  useStepFocus(etapa, { pergunta: tituloDaPergunta, link: tituloDoLink, campo }[etapa], corrigir.isError)
  const falha = corrigir.isError ? falhaDaCorrecaoDoEmail(corrigir.error, estadoAgora) : undefined
  useFocoNoCampoDaFalha(campo, falha?.doCampo === true, corrigir.error)

  const digitado = useEmailDigitado((pedido) => {
    if (noAr.current) return
    noAr.current = true
    corrigir.mutate(pedido, { onSettled: () => (noAr.current = false) })
  })

  /** O link sai por outro caminho, que o diálogo seguinte oferece: solta o link e entrega a tela ao "Reenviar", sem perguntar. */
  function enviarPorEmail(): void {
    corrigir.reset()
    aoEnviarPorEmail()
  }

  return (
    <Dialog titulo="Corrigir o e-mail" aoFechar={fechamento.pedirParaFechar} aoFecharPeloNavegador={fechamento.fecharDeVez} fecharAoClicarFora focoInicial={campo} focoDeReserva={focoDeReserva}>
      {etapa === 'pergunta' && (
        <CloseConfirmation
          titulo={tituloDaPergunta}
          texto={textoDaPergunta(corrigir.isPending)}
          rotuloDeVoltar="Voltar ao e-mail"
          aoVoltar={fechamento.voltar}
          aoFecharDeVez={fechamento.fecharDeVez}
        />
      )}
      {etapa === 'link' && corrigir.data !== undefined && (
        <EtapaDoLink
          nome={nome}
          email={corrigir.variables?.email}
          token={corrigir.data.token}
          titulo={tituloDoLink}
          copia={copia}
          aoEnviarPorEmail={enviarPorEmail}
          aoFechar={fechamento.pedirParaFechar}
        />
      )}
      {etapa === 'campo' && (
        <EtapaDoEmail nome={nome} campo={campo} digitado={digitado} falha={falha} erro={corrigir.error} pendente={corrigir.isPending} aoCancelar={fechamento.pedirParaFechar} />
      )}
    </Dialog>
  )
}
