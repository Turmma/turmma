import { ErrorCode } from '@educa/shared'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { verificarConta } from '../api/senha'
import { CascaPublica } from '../components/CascaPublica'
import { ErrorState, LoadingState } from '../components/states'
import { clearFragment, readFragmentToken } from './url-fragment'

/** Vencido, usado, substituído, de outro formato ou sem token: a API responde igual, e a tela também (regra 10, item 6). */
const LINK_DE_VERIFICAR_QUE_NAO_VALE = 'Este link não vale mais. Peça outro link abrindo o convite de novo.'

/** Sem link para `/convite`: o token do convite só vive na aba que o abriu, e `/convite` sem ele só diria "endereço incompleto" (triagem da 16.0). */
const VOLTE_AO_CONVITE = 'Volte à aba do convite e aceite de novo; se a fechou, abra o link do convite outra vez.'

type Etapa =
  | { readonly nome: 'sem-token' }
  | { readonly nome: 'confirmando' }
  | { readonly nome: 'confirmado' }
  | { readonly nome: 'invalido' }
  | { readonly nome: 'falhou'; readonly erro: unknown }

/**
 * "Verificar" (acesso-e-convites, 8.0; RF12): quem aceitou um convite copiado de outra escola recebe, por e-mail, o link que prova que
 * o e-mail é dele, e ele abre em `/verificar#<token>`. O token é lido do fragmento `#` e tirado da barra antes de qualquer chamada
 * (regra 20, item 8), como no convite e no redefinir, e vai no corpo. Não há botão de confirmar: o link já é o gesto, e a tela confirma
 * ao abrir. Dá certo, a tela diz "E-mail confirmado" e manda a pessoa de volta à aba do convite (ou ao link dele, se a fechou), que ela aceita de
 * novo, sem link para `/convite`: a tela não tem o token do convite; a verificação **não** aceita o convite nem abre sessão.
 *
 * Os quatro estados: carregando é o "Confirmando…"; vazio não existe (a tela nasce confirmando); erro é o link que não vale (o aviso já diz a saída: abrir o convite de
 * novo, que manda outro link; sem botão para `/convite`) e a falha de rede (com "Tentar de novo"); e "com dado" é o "E-mail confirmado".
 * Tela anônima, sem sessão: não há segunda pessoa no mesmo computador a considerar.
 *
 * **O link é de uso único**, e por isso a tela nunca manda o mesmo pedido duas vezes: o efeito é protegido contra a segunda execução do
 * `StrictMode`, e o mesmo link colado de novo enquanto o primeiro pedido está no ar, ou depois de ele ter dado certo, não manda outro
 * (o segundo responderia "não vale mais" a quem acabou de confirmar); só tira o fragmento da barra outra vez.
 *
 * **Recomeço.** Outro link colado nesta aba muda só o `#`, sem recarregar. A tela recomeça pelo pedido do link novo, o aviso de
 * antes sai, e a resposta do pedido do link anterior que ainda estivesse no ar é descartada. O mesmo link colado de novo depois de uma
 * falha (link que não vale, ou rede) recomeça: o aviso sai e o pedido é refeito.
 */
export function VerificarEmail() {
  const { etapa, tentarDeNovo } = useLinkDeVerificar()
  const confirmacao = useRef<HTMLParagraphElement>(null)

  // O "Confirmando…" saiu da tela com a resposta: o foco vai para o resultado, e o leitor de tela o diz.
  useEffect(() => {
    if (etapa.nome === 'confirmado') confirmacao.current?.focus()
  }, [etapa.nome])

  if (etapa.nome === 'confirmando') {
    return (
      <CascaPublica titulo="Verificar o e-mail">
        <LoadingState rotulo="Confirmando…" />
      </CascaPublica>
    )
  }

  if (etapa.nome === 'falhou') {
    return (
      <CascaPublica titulo="Verificar o e-mail">
        <ErrorState erro={etapa.erro} aoTentarDeNovo={tentarDeNovo} />
      </CascaPublica>
    )
  }

  if (etapa.nome === 'confirmado') {
    return (
      <CascaPublica titulo="Verificar o e-mail">
        <p ref={confirmacao} role="status" tabIndex={-1} className="rounded-controle border border-ok bg-ok-cx p-4 text-ok">
          E-mail confirmado
        </p>
        <p className="text-apoio">{VOLTE_AO_CONVITE}</p>
      </CascaPublica>
    )
  }

  return (
    <CascaPublica titulo="Verificar o e-mail">
      <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        {LINK_DE_VERIFICAR_QUE_NAO_VALE}
      </p>
    </CascaPublica>
  )
}

/**
 * O estado do link: o token lido do fragmento, a etapa, o pedido de uso único e o recomeço. Fora do componente só para a tela caber nas
 * 80 linhas de função que o lint permite; nada aqui é de outra tela.
 */
function useLinkDeVerificar(): { etapa: Etapa; tentarDeNovo: () => void } {
  const [token, definirToken] = useState(readFragmentToken)
  const [etapa, definirEtapa] = useState<Etapa>(token === undefined ? { nome: 'sem-token' } : { nome: 'confirmando' })
  // Sobe a cada link novo nesta aba. No `ref`, para o pedido no ar conferir a vez de agora quando volta; no estado, para o efeito recomeçar.
  const vezDoLink = useRef(0)
  const [vez, definirVez] = useState(0)
  const [tentativa, definirTentativa] = useState(0)
  // O token cujo pedido está no ar ou já deu certo: o mesmo link colado de novo não manda outro pedido (uso único).
  const tokenGasto = useRef<string | undefined>(undefined)
  // Qual par (link, tentativa) já saiu: a segunda execução do efeito, no `StrictMode`, não manda o pedido outra vez.
  const pedidoFeito = useRef<string | undefined>(undefined)

  useEffect(() => {
    function aoMudarOFragmento(): void {
      const novo = readFragmentToken()
      if (novo !== undefined && novo === tokenGasto.current) {
        clearFragment()
        return
      }
      vezDoLink.current++
      definirToken(novo)
      definirVez(vezDoLink.current)
      definirEtapa(novo === undefined ? { nome: 'sem-token' } : { nome: 'confirmando' })
    }
    window.addEventListener('hashchange', aoMudarOFragmento)
    return () => window.removeEventListener('hashchange', aoMudarOFragmento)
  }, [])

  // Também depois de cada link colado na aba (a `vez`), com token ou sem: o fragmento sai da barra antes de qualquer chamada.
  useEffect(() => {
    clearFragment()
    if (token === undefined) return
    const chave = `${String(vez)}:${String(tentativa)}`
    if (pedidoFeito.current === chave) return
    pedidoFeito.current = chave
    tokenGasto.current = token
    verificarConta({ token }).then(
      () => {
        if (vezDoLink.current === vez) definirEtapa({ nome: 'confirmado' })
      },
      (erro: unknown) => {
        // Outro link chegou enquanto o pedido estava no ar: a tela já é a dele, e nada daqui muda.
        if (vezDoLink.current !== vez) return
        // Não deu certo, então o link não foi gasto aqui: colá-lo de novo recomeça.
        tokenGasto.current = undefined
        definirEtapa(erro instanceof ApiError && erro.codigo === ErrorCode.NAO_ENCONTRADO ? { nome: 'invalido' } : { nome: 'falhou', erro })
      },
    )
  }, [token, vez, tentativa])

  /** O pedido de novo, com o token que continua na memória da tela: recarregar o perderia, porque ele já saiu da barra. */
  function tentarDeNovo(): void {
    definirEtapa({ nome: 'confirmando' })
    definirTentativa((anterior) => anterior + 1)
  }

  return { etapa, tentarDeNovo }
}
