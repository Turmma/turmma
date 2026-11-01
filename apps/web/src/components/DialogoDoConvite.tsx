import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useRef, useState, type ComponentType, type FormEvent, type ReactNode, type RefObject } from 'react'
import { ROUTES } from '../paths'
import { Button } from './ui/Button'
import { SECONDARY_BUTTON_CLASSES } from './ui/button-variants'
import { FormField } from './ui/fields/FormField'
import { CopyStatus, LinkField, FailureAlert, CloseConfirmation, useCopyToClipboard, useGuardedClose, useStepFocus } from './copy-once'
import type { DialogProps } from './ui/overlays/Dialog'
import { linkDoConvite } from './link-do-convite'
import type { CampoDoConvite, ValidacaoDoConvite } from './pedido-de-convite'

/**
 * O diálogo do convite de cópia única: o link que aparece uma vez, logo depois de gerar, para quem convida copiar e
 * mandar. Nasceu na operação, no convite da coordenação (A0b, tarefa 7.0), e veio para `components/` na A1 (14.0), com
 * a coordenação da escola convidando o professor pelo mesmo diálogo. Nada da operação nem da escola mora aqui: quem usa
 * passa a moldura (o `Dialog`, ou o da operação, com o aviso de inatividade), os textos, a mutação e o texto de cada
 * falha.
 *
 * A pergunta de fechar, a cópia, a falha com o foco e o foco de cada etapa são as peças de `copy-once.tsx`, que o acesso
 * da turma do professor também usa (15.0).
 *
 * O token vive só na mutação do diálogo que o pediu: cada abertura é outra instância (a `key` da abertura), e a resposta
 * que chega depois de o diálogo fechar não cai em nenhum outro. As opções da mutação vêm de quem usa, com `gcTime: 0`, e
 * entram no `useMutation` como estão: fechado o diálogo, o token sai do cache na mesma hora (regra 20, item 8).
 */

/** A moldura do diálogo: o `Dialog` de `components/`, ou o da operação, que acrescenta o aviso de inatividade. */
export type MolduraDoConvite = ComponentType<Omit<DialogProps, 'rodape'>>

/** A falha de uma ação do convite: o texto, e se a lista deixou de valer e precisa ser recarregada. */
export interface FalhaDoConvite {
  readonly texto: string
  /** `CONFLITO` e `NAO_ENCONTRADO`: o estado que a tela mostrava não é mais o do servidor, e tentar de novo não resolve. */
  readonly listaMudou: boolean
}

/** O que a etapa do link e a pergunta de fechar dizem, que muda com quem é convidado. */
interface TextosDoLink {
  /** O prazo e o uso único, numa frase: "O convite vale 72 horas e entra uma vez só." */
  readonly validade: string
  /** Quem entra pelo link, com o artigo: "a coordenadora", "o professor". Fecha a frase da pergunta de fechar. */
  readonly quemEntra: string
}

/** A ação que gera o link: o rótulo do botão, o dele com o pedido no ar, e o que o leitor de tela ouve enquanto isso. */
interface TextosDaAcao {
  readonly confirmar: string
  readonly confirmando: string
  readonly anuncio: string
}

const ROTULO_DE_VOLTAR = 'Voltar ao convite'

/** O que a pergunta de fechar diz do convite: o link aparece uma vez, e sem ele só refazendo. */
function textoDaPergunta(noAr: boolean, quemEntra: string): string {
  return noAr
    ? `O convite ainda está sendo gerado, e o link aparece uma vez só, aqui. Se fechar agora, ele não aparece, e para ${quemEntra} entrar será preciso refazer o convite.`
    : `O link aparece uma vez só. Se fechar agora, ele não aparece de novo, e para ${quemEntra} entrar será preciso refazer o convite.`
}

/**
 * O link do convite, uma vez: num campo de leitura, com "Copiar link". Com a área de transferência, copia e anuncia "Link
 * copiado." dentro do diálogo; sem ela, seleciona o campo e pede a cópia. A cópia feita à mão no campo (Ctrl+C, ou o menu
 * do toque) também conta, pelo evento `copy`.
 */
function EtapaDoLink({
  mandePara,
  validade,
  link,
  titulo,
  copia,
  vezDaCopia,
  copiado,
  aoCopiar,
  aoCopiarAMao,
  aoFechar,
}: {
  /** A quem mandar, numa frase com ponto: "Mande à coordenadora de <Escola>." */
  mandePara: ReactNode
  validade: string
  link: string
  titulo: RefObject<HTMLHeadingElement | null>
  copia: string
  vezDaCopia: number
  copiado: boolean
  aoCopiar: (campo: HTMLInputElement | null) => void
  aoCopiarAMao: () => void
  aoFechar: () => void
}) {
  const campo = useRef<HTMLInputElement>(null)
  return (
    <div className="mt-4 flex flex-col gap-4">
      <h3 ref={titulo} tabIndex={-1} className="t-cartao">
        Copie o link do convite
      </h3>
      <p className="text-apoio">
        {mandePara} {validade} Depois de fechar, este link não aparece de novo.
      </p>
      <LinkField ref={campo} rotulo="Link do convite" link={link} aoCopiarAMao={aoCopiarAMao} />
      <CopyStatus texto={copia} vez={vezDaCopia} copiado={copiado} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={() => aoCopiar(campo.current)}>Copiar link</Button>
        <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
          Fechar
        </button>
      </div>
    </div>
  )
}

/** O que os dois diálogos têm em comum: a moldura, a falha, a etapa do link e o fechar. */
interface PropsComuns {
  readonly Moldura: MolduraDoConvite
  readonly titulo: string
  /** O que cada linha da lista do que vai acontecer diz, antes de confirmar: o prazo e o "aparece uma vez". */
  readonly avisos: readonly string[]
  readonly acao: TextosDaAcao
  /** O texto de cada falha, e se ela mudou a lista (aí só sobra "Fechar"). */
  readonly falha: (erro: unknown) => FalhaDoConvite
  readonly link: TextosDoLink
  /** Quem fecha é quem desmonta: a tela, pela abertura deste diálogo. */
  readonly aoFechar: () => void
  /** O foco ao fechar quando o botão que abriu já saiu da tela (`Dialog`). */
  readonly focoDeReserva?: (() => void) | undefined
}

interface PropsDoConviteNovo<Pedido, Resposta extends { readonly token: string }> extends PropsComuns {
  /** O parágrafo de cima do formulário: de quem é o convite, e o que acontece com o link. */
  readonly apresentacao: ReactNode
  readonly rotulos: Readonly<Record<CampoDoConvite, string>>
  /** O pedido pelo contrato estrito da API, ou o texto de cada campo (`pedido-de-convite.ts`). */
  readonly validar: (campos: { readonly nome: string; readonly email: string }) => ValidacaoDoConvite<Pedido>
  readonly tituloDaRevisao: string
  /** O que vai ao servidor, linha a linha, para a pessoa conferir antes de enviar (regra 50, item 8). */
  readonly resumo: (pedido: Pedido) => ReadonlyArray<{ readonly rotulo: string; readonly valor: string }>
  /** As opções da mutação, com `gcTime: 0`. O diálogo não põe nada por cima. */
  readonly mutacao: UseMutationOptions<Resposta, Error, Pedido>
  /** A quem mandar o link, numa frase com ponto. */
  readonly mandePara: (pedido: Pedido) => ReactNode
  /** O que a tela tem a dizer daquele pedido antes de enviar, sem impedir: o nome que já está na lista, por exemplo. */
  readonly avisosDoPedido?: (pedido: Pedido) => readonly string[]
}

/**
 * O convite novo: o nome e o e-mail, o resumo do que vai acontecer, e o link, uma vez. A resposta do pedido não fecha
 * nada: só preenche o diálogo que a pediu.
 */
export function DialogoDeConviteNovo<Pedido, Resposta extends { readonly token: string }>({
  Moldura,
  titulo,
  apresentacao,
  rotulos,
  validar,
  tituloDaRevisao,
  resumo,
  avisos,
  acao,
  mutacao,
  falha: textoDaFalha,
  mandePara,
  avisosDoPedido,
  link: textosDoLink,
  aoFechar,
  focoDeReserva,
}: PropsDoConviteNovo<Pedido, Resposta>) {
  const [nome, definirNome] = useState('')
  const [email, definirEmail] = useState('')
  const [erros, definirErros] = useState<Partial<Record<CampoDoConvite, string>>>({})
  const [revisando, definirRevisando] = useState<{ readonly pedido: Pedido } | undefined>(undefined)
  // O pedido no ar, na hora: o segundo clique de um clique duplo chega antes do `isPending`.
  const noAr = useRef(false)
  const gerar = useMutation(mutacao)
  const copia = useCopyToClipboard()
  const fechamento = useGuardedClose(gerar.isPending || (gerar.isSuccess && !copia.copiado), gerar.reset, aoFechar)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const tituloDaEtapaDeRevisao = useRef<HTMLHeadingElement>(null)
  const tituloDoLink = useRef<HTMLHeadingElement>(null)
  const tituloDaPergunta = useRef<HTMLHeadingElement>(null)
  const etapa = fechamento.perguntando ? 'pergunta' : gerar.isSuccess ? 'link' : revisando !== undefined ? 'revisar' : 'preencher'
  const focos = { pergunta: tituloDaPergunta, link: tituloDoLink, revisar: tituloDaEtapaDeRevisao, preencher: campoDoNome } as const
  useStepFocus(etapa, focos[etapa], gerar.isError)

  function revisar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const validacao = validar({ nome, email })
    if (!validacao.ok) {
      definirErros(validacao.erros)
      return
    }
    definirErros({})
    definirRevisando({ pedido: validacao.pedido })
  }

  /**
   * "Voltar e corrigir" solta a falha do pedido junto: o aviso é da tentativa que a pessoa vai corrigir, e não volta com
   * a revisão nova; e, sem ele, o foco vai para o campo do nome, e não fica no `body` com o alerta que saiu da tela.
   */
  function voltarECorrigir(): void {
    gerar.reset()
    definirRevisando(undefined)
  }

  function confirmar(): void {
    if (revisando === undefined || noAr.current) return
    noAr.current = true
    gerar.mutate(revisando.pedido, { onSettled: () => (noAr.current = false) })
  }

  const dialogo = (conteudo: ReactNode) => (
    <Moldura titulo={titulo} aoFechar={fechamento.pedirParaFechar} aoFecharPeloNavegador={fechamento.fecharDeVez} fecharAoClicarFora {...(focoDeReserva === undefined ? {} : { focoDeReserva })}>
      {conteudo}
    </Moldura>
  )

  if (etapa === 'pergunta')
    return dialogo(<CloseConfirmation titulo={tituloDaPergunta} texto={textoDaPergunta(gerar.isPending, textosDoLink.quemEntra)} rotuloDeVoltar={ROTULO_DE_VOLTAR} aoVoltar={fechamento.voltar} aoFecharDeVez={fechamento.fecharDeVez} />)

  if (etapa === 'link' && gerar.data !== undefined && revisando !== undefined) {
    const link = linkDoConvite(window.location.origin, ROUTES.convite, gerar.data.token)
    return dialogo(
      <EtapaDoLink
        mandePara={mandePara(revisando.pedido)}
        validade={textosDoLink.validade}
        link={link}
        titulo={tituloDoLink}
        copia={copia.texto}
        vezDaCopia={copia.vez}
        copiado={copia.copiado}
        aoCopiar={(campo) => void copia.copiar(link, campo)}
        aoCopiarAMao={copia.copiadoAMao}
        aoFechar={fechamento.pedirParaFechar}
      />,
    )
  }

  if (revisando !== undefined) {
    const falha = gerar.isError ? textoDaFalha(gerar.error) : undefined
    return dialogo(
      <div className="mt-4 flex flex-col gap-4">
        <h3 ref={tituloDaEtapaDeRevisao} tabIndex={-1} className="t-cartao">
          {tituloDaRevisao}
        </h3>
        <dl className="grid gap-3">
          {resumo(revisando.pedido).map((linha) => (
            <div key={linha.rotulo}>
              <dt className="text-sm text-sutil">{linha.rotulo}</dt>
              <dd className="wrap-anywhere">{linha.valor}</dd>
            </div>
          ))}
        </dl>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio">
          {[...avisos, ...(avisosDoPedido?.(revisando.pedido) ?? [])].map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
        {falha !== undefined && <FailureAlert texto={falha.texto} erro={gerar.error} />}
        <div className="flex flex-wrap justify-end gap-3">
          {falha?.listaMudou !== true && (
            <>
              <Button onClick={confirmar} disabled={gerar.isPending}>
                {gerar.isPending ? acao.confirmando : acao.confirmar}
              </Button>
              <button type="button" onClick={voltarECorrigir} disabled={gerar.isPending} className={SECONDARY_BUTTON_CLASSES}>
                Voltar e corrigir
              </button>
            </>
          )}
          <button type="button" onClick={fechamento.pedirParaFechar} className={SECONDARY_BUTTON_CLASSES}>
            {falha?.listaMudou === true ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
        <span role="status" className="sr-only">
          {gerar.isPending ? acao.anuncio : ''}
        </span>
      </div>,
    )
  }

  return dialogo(
    <form className="mt-4 flex flex-col gap-4" onSubmit={revisar} noValidate>
      <p className="text-apoio">{apresentacao}</p>
      <FormField
        ref={campoDoNome}
        rotulo={rotulos.nome}
        name="nome"
        type="text"
        autoComplete="off"
        required
        value={nome}
        onChange={(evento) => definirNome(evento.target.value)}
        erro={erros.nome}
      />
      <FormField
        rotulo={rotulos.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        value={email}
        onChange={(evento) => definirEmail(evento.target.value)}
        erro={erros.email}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit">Revisar</Button>
        <button type="button" onClick={fechamento.pedirParaFechar} className={SECONDARY_BUTTON_CLASSES}>
          Cancelar
        </button>
      </div>
    </form>,
  )
}

interface PropsDoConviteRefeito<Resposta extends { readonly token: string }> extends PropsComuns {
  /** O que o refazer faz, antes de confirmar: o link novo de quem, e que o anterior para de valer. */
  readonly confirmacao: ReactNode
  /** As opções da mutação, com `gcTime: 0`. O diálogo não põe nada por cima. */
  readonly mutacao: UseMutationOptions<Resposta, Error, void>
  /** A quem mandar o link, numa frase com ponto. */
  readonly mandePara: ReactNode
}

/**
 * Refazer o convite: confirma antes, dizendo que o link anterior para de valer, e então mostra o link novo, uma vez, como
 * o convite novo. A falha que mudou a lista (outra pessoa refez ou revogou antes) fica aqui dentro, e sobra só "Fechar".
 * O botão trava enquanto o pedido está no ar: dois pedidos seguidos dariam dois links, e o primeiro, que a tela mostraria,
 * já nasceria revogado pelo segundo.
 */
export function DialogoDeConviteRefeito<Resposta extends { readonly token: string }>({
  Moldura,
  titulo,
  confirmacao,
  avisos,
  acao,
  mutacao,
  falha: textoDaFalha,
  mandePara,
  link: textosDoLink,
  aoFechar,
  focoDeReserva,
}: PropsDoConviteRefeito<Resposta>) {
  const noAr = useRef(false)
  const refazer = useMutation(mutacao)
  const copia = useCopyToClipboard()
  const fechamento = useGuardedClose(refazer.isPending || (refazer.isSuccess && !copia.copiado), refazer.reset, aoFechar)
  const textoDaConfirmacao = useRef<HTMLParagraphElement>(null)
  const tituloDoLink = useRef<HTMLHeadingElement>(null)
  const tituloDaPergunta = useRef<HTMLHeadingElement>(null)
  const etapa = fechamento.perguntando ? 'pergunta' : refazer.isSuccess ? 'link' : 'confirmar'
  useStepFocus(etapa, etapa === 'pergunta' ? tituloDaPergunta : etapa === 'link' ? tituloDoLink : textoDaConfirmacao, refazer.isError)

  function confirmar(): void {
    if (noAr.current) return
    noAr.current = true
    refazer.mutate(undefined, { onSettled: () => (noAr.current = false) })
  }

  const dialogo = (conteudo: ReactNode) => (
    <Moldura
      titulo={titulo}
      aoFechar={fechamento.pedirParaFechar}
      aoFecharPeloNavegador={fechamento.fecharDeVez}
      fecharAoClicarFora
      focoInicial={textoDaConfirmacao}
      {...(focoDeReserva === undefined ? {} : { focoDeReserva })}
    >
      {conteudo}
    </Moldura>
  )

  if (etapa === 'pergunta')
    return dialogo(<CloseConfirmation titulo={tituloDaPergunta} texto={textoDaPergunta(refazer.isPending, textosDoLink.quemEntra)} rotuloDeVoltar={ROTULO_DE_VOLTAR} aoVoltar={fechamento.voltar} aoFecharDeVez={fechamento.fecharDeVez} />)

  if (etapa === 'link' && refazer.data !== undefined) {
    const link = linkDoConvite(window.location.origin, ROUTES.convite, refazer.data.token)
    return dialogo(
      <EtapaDoLink
        mandePara={mandePara}
        validade={textosDoLink.validade}
        link={link}
        titulo={tituloDoLink}
        copia={copia.texto}
        vezDaCopia={copia.vez}
        copiado={copia.copiado}
        aoCopiar={(campo) => void copia.copiar(link, campo)}
        aoCopiarAMao={copia.copiadoAMao}
        aoFechar={fechamento.pedirParaFechar}
      />,
    )
  }

  const falha = refazer.isError ? textoDaFalha(refazer.error) : undefined
  return dialogo(
    <div className="mt-4 flex flex-col gap-4">
      <p ref={textoDaConfirmacao} tabIndex={-1} className="text-apoio">
        {confirmacao}
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio">
        {avisos.map((aviso) => (
          <li key={aviso}>{aviso}</li>
        ))}
      </ul>
      {falha !== undefined && <FailureAlert texto={falha.texto} erro={refazer.error} />}
      <div className="flex flex-wrap justify-end gap-3">
        {falha?.listaMudou !== true && (
          <Button onClick={confirmar} disabled={refazer.isPending}>
            {refazer.isPending ? acao.confirmando : acao.confirmar}
          </Button>
        )}
        <button type="button" onClick={fechamento.pedirParaFechar} className={SECONDARY_BUTTON_CLASSES}>
          {falha?.listaMudou === true ? 'Fechar' : 'Cancelar'}
        </button>
      </div>
      <span role="status" className="sr-only">
        {refazer.isPending ? acao.anuncio : ''}
      </span>
    </div>,
  )
}
