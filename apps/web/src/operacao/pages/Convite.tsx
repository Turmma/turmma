import { TAMANHO_MAXIMO_SENHA, TAMANHO_MAXIMO_TOKEN_DE_CONVITE, TAMANHO_MINIMO_SENHA_NOVA } from '@educa/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { Botao } from '../../components/ui/Botao'
import { Campo } from '../../components/ui/fields/Campo'
import { EstadoCarregando } from '../../components/states'
import { aceitarConviteDeOperadorNaVez, consultarConviteDeOperador, ehConviteInvalido } from '../api/convite'
import { ROTAS_DA_OPERACAO } from '../paths'
import { CascaPublicaDaOperacao, ErroDaOperacao } from '../components/CascaDaOperacao'
import { TEXTO_DO_CONVITE_INVALIDO, textoDaFalha } from '../textos'
import { useTituloDaPagina } from '../document-title'

/**
 * O token do convite, lido do fragmento `#`. O navegador nunca manda o fragmento ao servidor, e por isso é onde o
 * token do link vive; mas ele ficaria no histórico e na barra, e é isso que `apagarFragmentoDaBarra` resolve antes de
 * qualquer chamada sair (regra 20, item 8).
 */
function tokenDoFragmento(): string | undefined {
  const bruto = window.location.hash.replace(/^#/, '')
  let token: string
  try {
    token = decodeURIComponent(bruto).trim()
  } catch {
    // `%` solto no link colado pela metade: não é token nenhum, e a tela diz o mesmo que diria a um convite inválido.
    return undefined
  }
  return token === '' || token.length > TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? undefined : token
}

/** Tira o fragmento da barra, sem recarregar e sem entrada nova no histórico. */
function apagarFragmentoDaBarra(): void {
  if (window.location.hash !== '') window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

type Etapa =
  | { readonly nome: 'consultando' }
  | { readonly nome: 'falhou'; readonly erro: unknown }
  | { readonly nome: 'criar-senha' }
  | { readonly nome: 'invalido' }

/**
 * O convite do operador Turmma (PRD da A0, RF2): quem recebeu o link do `ops:operador` abre, cria a senha e segue para
 * configurar o segundo fator. Os quatro estados: carregando é a consulta; erro é a API fora, com "Tentar de novo"; com
 * dado é o formulário da senha; e o "vazio" é o convite que não vale, que diz o que fazer.
 *
 * Usado, vencido, revogado e inexistente mostram a **mesma** tela (C9): nem o apelido nem o nome de quem foi convidado
 * aparecem, porque quem tem o link ainda não provou nada. O link sem token cai na mesma mensagem.
 *
 * O token vive só no estado desta tela e some quando ela sai; a senha sai da memória assim que a resposta chega, dê
 * certo ou não, ou antes, quando outro link chega à aba. O desafio que o aceite devolve fica no módulo da sessão do
 * operador, nunca na URL; o de um aceite feito com o link anterior nem fica.
 */
export function Convite() {
  useTituloDaPagina('Convite')
  const [, navegar] = useLocation()
  // Lido na primeira renderização; o efeito abaixo tira o fragmento da barra antes de a consulta sair.
  const [token, definirToken] = useState(tokenDoFragmento)
  const [etapa, definirEtapa] = useState<Etapa>(token === undefined ? { nome: 'invalido' } : { nome: 'consultando' })
  const [tentativa, definirTentativa] = useState(0)
  const [senha, definirSenha] = useState('')
  const [aceitando, definirAceitando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)
  // Sobe a cada link colado nesta aba: o aceite que estava no ar com o link anterior volta e é descartado.
  const vezDoLink = useRef(0)

  // Outro link colado nesta mesma aba muda só o `#`, sem recarregar — inclusive o mesmo link de novo, depois de a tela
  // ter tirado o fragmento da barra. A tela tira o fragmento da barra de novo e recomeça a consulta, mesmo com o token
  // igual; a senha que estivesse digitada sai da memória, e a resposta do aceite que ainda estivesse no ar não vale mais
  // para esta tela (`aceitarConviteDeOperadorNaVez`). Fragmento que não é token (vazio, `%` quebrado, longo demais)
  // mostra a mesma tela do convite que não vale.
  useEffect(() => {
    function aoMudarOFragmento(): void {
      vezDoLink.current++
      const novo = tokenDoFragmento()
      apagarFragmentoDaBarra()
      definirSenha('')
      definirFalha(undefined)
      definirToken(novo)
      if (novo === undefined) {
        definirEtapa({ nome: 'invalido' })
        return
      }
      definirEtapa({ nome: 'consultando' })
      definirTentativa((anterior) => anterior + 1)
    }
    window.addEventListener('hashchange', aoMudarOFragmento)
    return () => window.removeEventListener('hashchange', aoMudarOFragmento)
  }, [])

  useEffect(() => {
    apagarFragmentoDaBarra()
    if (token === undefined) return undefined
    let atual = true
    consultarConviteDeOperador(token).then(
      () => atual && definirEtapa({ nome: 'criar-senha' }),
      (erro: unknown) => atual && definirEtapa(ehConviteInvalido(erro) ? { nome: 'invalido' } : { nome: 'falhou', erro }),
    )
    return () => {
      atual = false
    }
  }, [token, tentativa])

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (aceitando || token === undefined) return
    definirAceitando(true)
    definirFalha(undefined)
    try {
      const desfecho = await aceitarConviteDeOperadorNaVez({ token, senha }, () => vezDoLink.current)
      // Outro link chegou enquanto o aceite estava no ar: a tela já é a dele, e nada daqui muda.
      if (desfecho.tipo === 'descartado') return
      definirSenha('')
      if (desfecho.tipo === 'aceito') navegar(ROTAS_DA_OPERACAO.configurarMfa, { replace: true })
      // Usado entre a consulta e o aceite (outra aba, o link aberto duas vezes): a mesma tela do convite que não vale.
      else if (desfecho.tipo === 'invalido') definirEtapa({ nome: 'invalido' })
      else definirFalha(desfecho.erro)
    } finally {
      definirAceitando(false)
    }
  }

  return (
    <CascaPublicaDaOperacao titulo="Convite para a operação">
      {etapa.nome === 'consultando' && <EstadoCarregando rotulo="Conferindo o convite…" />}
      {etapa.nome === 'falhou' && (
        <ErroDaOperacao
          erro={etapa.erro}
          aoTentarDeNovo={() => {
            definirEtapa({ nome: 'consultando' })
            definirTentativa((anterior) => anterior + 1)
          }}
        />
      )}
      {etapa.nome === 'invalido' && (
        <>
          <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
            {TEXTO_DO_CONVITE_INVALIDO}
          </p>
          {/* Quem abriu de novo um convite que já usou só precisa entrar; o link não diz qual dos casos aconteceu. */}
          <p className="text-apoio">
            Já criou a sua senha?{' '}
            <Link className="text-caramelo-texto underline" to={ROTAS_DA_OPERACAO.entrar}>
              Entrar na operação
            </Link>
          </p>
        </>
      )}
      {etapa.nome === 'criar-senha' && (
        <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
          <p className="text-apoio">
            Você foi convidado para a equipe de operação do Turmma. Crie a sua senha; depois dela, você configura o segundo
            fator.
          </p>
          <Campo
            rotulo="Senha nova"
            dica={`Pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres. Use uma frase que só você saiba.`}
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={TAMANHO_MINIMO_SENHA_NOVA}
            maxLength={TAMANHO_MAXIMO_SENHA}
            value={senha}
            onChange={(evento) => definirSenha(evento.target.value)}
          />
          {falha !== undefined && (
            <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
              {textoDaFalha(falha)}
            </p>
          )}
          <Botao type="submit" disabled={aceitando} className="w-full">
            {aceitando ? 'Salvando…' : 'Criar a senha e continuar'}
          </Botao>
          <span role="status" className="sr-only">
            {aceitando ? 'Salvando…' : ''}
          </span>
        </form>
      )}
    </CascaPublicaDaOperacao>
  )
}
