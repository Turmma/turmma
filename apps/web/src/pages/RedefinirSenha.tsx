import { ErrorCode, TAMANHO_MAXIMO_SENHA, TAMANHO_MINIMO_SENHA_NOVA } from '@educa/shared'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { ApiError } from '../api/client'
import { redefinirSenha } from '../api/senha'
import { definirAvisoDaEntrada } from '../api/sessao'
import { Button } from '../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../components/ui/button-variants'
import { PasswordInput } from '../components/ui/fields/PasswordInput'
import { CascaPublica } from '../components/CascaPublica'
import { ErrorState } from '../components/states'
import { ROUTES } from '../paths'
import { clearFragment, readFragmentToken } from './url-fragment'

/** O que a entrada diz depois de a senha ser trocada. Não há login automático: o segundo fator da coordenação continua exigido (RF12). */
const AVISO_DA_SENHA_TROCADA = 'Senha trocada. Entre com a nova.'

/** Vencido, usado, substituído, de outro formato ou sem token: a API responde igual, e a tela também (regra 10, item 6). */
const LINK_DA_SENHA_QUE_NAO_VALE = 'Este link não vale mais. Peça outro em Esqueci a senha.'

/** A regra da senha nova, dita antes de a pessoa digitar e repetida quando a API a recusa. */
const REGRA_DA_SENHA = `Pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres. Use uma frase que só você saiba.`

/**
 * "Redefinir" (acesso-e-convites, 6.0; RF12): a equipe define a senha nova pelo link do e-mail, que chega em `/redefinir#<token>`.
 * O token é lido do fragmento `#` e tirado da barra antes de qualquer chamada (regra 20, item 8), como no convite, e vai no corpo.
 * Não há consulta antes: a API só diz se o link vale quando a senha chega, e é então que a tela mostra o link que não vale. Dá
 * certo, a tela volta à entrada com o aviso, **sem abrir sessão**.
 *
 * Os quatro estados: carregando é o "Salvando…" do botão; vazio é o formulário, com a regra à vista; erro é o link que não vale
 * (com a saída: pedir outro), a senha recusada (a regra, no campo) e a falha de rede (com "Tentar de novo"); e "com dado" é a volta
 * à entrada. Tela anônima, sem sessão: não há segunda pessoa no mesmo computador a considerar.
 *
 * **Recomeço.** Outro link colado nesta aba muda só o `#`, sem recarregar, inclusive o mesmo link de novo depois de a tela tê-lo
 * tirado da barra. A tela recomeça: o formulário é remontado (`key={vez}`), o que esvazia a senha e tira o aviso, o fragmento sai da
 * barra outra vez e o foco volta ao campo. A resposta do envio que ainda estivesse no ar com o link anterior é descartada: não
 * navega e não troca a tela do link novo.
 */
export function RedefinirSenha() {
  const { token, vez, vezAtual } = useLinkColado()
  if (token === undefined) return <LinkQueNaoVale />
  return <FormularioDaSenha key={vez} token={token} vez={vez} vezAtual={vezAtual} />
}

/** O formulário de um link. Estado de um link só: o link novo o remonta, e nada do anterior sobra. */
function FormularioDaSenha({ token, vez, vezAtual }: { token: string; vez: number; vezAtual: () => number }) {
  const [, navegar] = useLocation()
  const [senha, definirSenha] = useState('')
  const [salvando, definirSalvando] = useState(false)
  const [invalido, definirInvalido] = useState(false)
  const [recusada, definirRecusada] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)
  // Trava na hora o segundo clique, que chega antes de o botão desligar; o estado é o que o desliga.
  const noAr = useRef(false)
  const campo = useRef<HTMLInputElement>(null)

  // O foco vem para o campo ao abrir e a cada recomeço: o "Tentar de novo" que o tinha sai da tela com o aviso.
  useEffect(() => {
    campo.current?.focus()
  }, [])

  /** O "Tentar de novo" mantém o aviso até a resposta, para o botão que tem o foco não sair da tela com ele. */
  async function salvar(deNovo: boolean): Promise<void> {
    if (noAr.current) return
    noAr.current = true
    definirSalvando(true)
    definirRecusada(false)
    if (!deNovo) definirFalha(undefined)
    let trocada = false
    let erro: unknown
    try {
      await redefinirSenha({ token, senha })
      trocada = true
    } catch (capturado) {
      erro = capturado
    }
    noAr.current = false
    // Outro link chegou enquanto o envio estava no ar: a tela já é a dele, e nada daqui muda.
    if (vezAtual() !== vez) return
    definirSalvando(false)
    definirFalha(undefined)
    if (trocada) {
      // A senha sai da memória da tela assim que a resposta chega.
      definirSenha('')
      definirAvisoDaEntrada(AVISO_DA_SENHA_TROCADA)
      navegar(ROUTES.entrar, { replace: true })
      return
    }
    const codigo = erro instanceof ApiError ? erro.codigo : undefined
    if (codigo === ErrorCode.NAO_ENCONTRADO) {
      definirSenha('')
      definirInvalido(true)
    } else if (codigo === ErrorCode.ENTRADA_INVALIDA) {
      definirRecusada(true)
      campo.current?.focus()
    } else definirFalha(erro)
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    void salvar(false)
  }

  if (invalido) return <LinkQueNaoVale />

  return (
    <CascaPublica titulo="Redefinir a senha">
      <p className="text-apoio">Escolha a senha nova. Depois de trocar, você volta à entrada para usá-la.</p>
      <form className="flex flex-col gap-4" onSubmit={enviar}>
        <PasswordInput
          ref={campo}
          rotulo="Senha nova"
          dica={REGRA_DA_SENHA}
          erro={recusada ? `A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.` : undefined}
          name="senha"
          autoComplete="new-password"
          obrigatorio
          maxLength={TAMANHO_MAXIMO_SENHA}
          value={senha}
          onChange={(evento) => {
            definirSenha(evento.target.value)
            definirRecusada(false)
          }}
        />
        {falha !== undefined && <ErrorState erro={falha} aoTentarDeNovo={() => void salvar(true)} tentando={salvando} />}
        <Button type="submit" disabled={salvando} className="w-full">
          {salvando ? 'Salvando…' : 'Definir a senha'}
        </Button>
        <span role="status" className="sr-only">
          {salvando ? 'Salvando…' : ''}
        </span>
      </form>
    </CascaPublica>
  )
}

/** A tela do link que não vale, com a saída: pedir outro. */
function LinkQueNaoVale() {
  return (
    <CascaPublica titulo="Redefinir a senha">
      <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        {LINK_DA_SENHA_QUE_NAO_VALE}
      </p>
      <div>
        <Link className={SECONDARY_LINK_CLASSES} to={ROUTES.esqueci}>
          Esqueci a senha
        </Link>
      </div>
    </CascaPublica>
  )
}

/**
 * O token do link, lido do fragmento na primeira renderização, e o fragmento tirado da barra antes de qualquer chamada. Outro link
 * colado na aba muda só o `#`: a `vez` sobe e o token é lido de novo. `vezAtual` é o que o envio no ar confere quando volta.
 */
function useLinkColado(): { token: string | undefined; vez: number; vezAtual: () => number } {
  const [token, definirToken] = useState(readFragmentToken)
  const [vez, definirVez] = useState(0)
  const vezDoLink = useRef(0)
  const vezAtual = useCallback(() => vezDoLink.current, [])

  useEffect(() => {
    function aoMudarOFragmento(): void {
      vezDoLink.current++
      definirToken(readFragmentToken())
      definirVez(vezDoLink.current)
    }
    window.addEventListener('hashchange', aoMudarOFragmento)
    return () => window.removeEventListener('hashchange', aoMudarOFragmento)
  }, [])

  // Também depois de cada link colado na aba (a `vez`), com token ou sem: o fragmento sai da barra antes de qualquer chamada.
  useEffect(() => {
    clearFragment()
  }, [token, vez])

  return { token, vez, vezAtual }
}
