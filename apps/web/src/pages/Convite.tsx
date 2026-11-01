import {
  AVISO_DO_CONVITE_COM_SENHA_NOVA,
  AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE,
  ErrorCode,
  mensagemDoConvite,
  TAMANHO_MAXIMO_SENHA,
  TAMANHO_MINIMO_SENHA_NOVA,
} from '@educa/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { aceitarConviteNaVez, consultarConvite } from '../api/convite'
import { ErroDaApi } from '../api/client'
import { definirAvisoDaEntrada } from '../api/sessao'
import { ROTAS } from '../paths'
import { Button } from '../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../components/ui/button-variants'
import { PasswordInput } from '../components/ui/fields/PasswordInput'
import { CascaPublica } from '../components/CascaPublica'
import { EstadoCarregando, EstadoErro } from '../components/states'
import { apagarFragmentoDaBarra, tokenDoFragmento } from './url-fragment'

type Etapa =
  | { readonly nome: 'sem-token' }
  | { readonly nome: 'consultando' }
  | { readonly nome: 'falhou'; readonly erro: unknown }
  | { readonly nome: 'confirmar'; readonly token: string; readonly escolaNome: string }
  | { readonly nome: 'definir-senha'; readonly token: string; readonly escolaNome: string }
  | { readonly nome: 'invalido' }

/**
 * O aceite do convite (RF1, RF12 e RF20 do F1; RF7 da A1), o mesmo para o da coordenação, que vem de nós, e o do
 * professor, que a coordenação da escola gera (A1, 14.0). A consulta diz só a escola que convida, e a tela não sabe de
 * que tipo é o convite até o aceite responder: por isso os textos valem para os dois. Em três passos:
 *
 * 1. **consultar**, que mostra o nome da escola que convida e nada da pessoa;
 * 2. **aceitar sem senha**, que a API recusa com `ENTRADA_INVALIDA` quando a conta é nova, **sem gastar o convite**,
 *    ou aceita e responde `entrar` quando a conta já existe;
 * 3. **aceitar com a senha nova**, só no caso da conta nova: o coordenador segue para configurar o segundo fator, e o
 *    professor, que não tem segundo fator, vai à entrada, para entrar com a senha que acabou de criar.
 *
 * Quem já tem conta (trabalha em outra escola cliente) nunca vê campo de senha nova: o link não troca a senha de uma
 * conta existente, e o que falta é entrar com a senha que ela já tem.
 *
 * O convite que não vale — usado, vencido, revogado, refeito ou inexistente — mostra o mesmo texto, com a quem pedir
 * outro, e nunca o nome da escola. A consulta que cai por rede ou servidor tem "Tentar de novo", com o token que continua
 * na memória da tela: recarregar o perderia, porque ele já saiu da barra.
 *
 * Outro link colado nesta aba muda só o `#`, sem recarregar — inclusive o mesmo link de novo, depois de a tela ter tirado
 * o fragmento da barra. A tela tira o fragmento outra vez e recomeça pela consulta; a senha que estivesse digitada sai da
 * memória, e a resposta do aceite que ainda estivesse no ar com o link anterior é descartada (`aceitarConviteNaVez`).
 */
export function Convite() {
  const [, navegar] = useLocation()
  // O token é lido na primeira renderização, e o efeito tira o fragmento da barra antes de qualquer chamada sair.
  const [token, definirToken] = useState(tokenDoFragmento)
  const [etapa, definirEtapa] = useState<Etapa>(token === undefined ? { nome: 'sem-token' } : { nome: 'consultando' })
  // Sobe a cada link colado nesta aba. No `ref`, para o aceite no ar conferir a vez de agora quando volta; no estado,
  // para a consulta recomeçar mesmo com o token igual e para o botão saber de que link é o aceite no ar.
  const vezDoLink = useRef(0)
  const [vez, definirVez] = useState(0)
  const [tentativa, definirTentativa] = useState(0)
  // As vezes dos links com o aceite no ar. O `ref` trava na hora o segundo clique de um clique duplo, que chega antes de
  // a tela desligar o botão; o estado é o que desliga o botão. O aceite do link anterior, ainda no ar, não segura o
  // botão do link novo, e a volta dele não solta o botão do aceite do link novo.
  const noAr = useRef(new Set<number>())
  const [aceitandoNasVezes, definirAceitandoNasVezes] = useState<readonly number[]>([])
  const [falha, definirFalha] = useState<unknown>(undefined)
  const aceitando = aceitandoNasVezes.includes(vez)

  useEffect(() => {
    function aoMudarOFragmento(): void {
      vezDoLink.current++
      const novo = tokenDoFragmento()
      definirFalha(undefined)
      definirToken(novo)
      definirVez(vezDoLink.current)
      definirEtapa(novo === undefined ? { nome: 'sem-token' } : { nome: 'consultando' })
    }
    window.addEventListener('hashchange', aoMudarOFragmento)
    return () => window.removeEventListener('hashchange', aoMudarOFragmento)
  }, [])

  // Também depois de cada link colado na aba (a `vez`), com token ou sem: o fragmento sai da barra antes da consulta.
  useEffect(() => {
    apagarFragmentoDaBarra()
    if (token === undefined) return undefined
    let atual = true
    consultarConvite(token).then(
      (resposta) => atual && definirEtapa({ nome: 'confirmar', token, escolaNome: resposta.escolaNome }),
      (erro: unknown) => atual && definirEtapa(erro instanceof ErroDaApi && erro.codigo === ErrorCode.NAO_ENCONTRADO ? { nome: 'invalido' } : { nome: 'falhou', erro }),
    )
    return () => {
      atual = false
    }
  }, [token, vez, tentativa])

  /** O aceite, com ou sem a senha nova. Sem senha é o que descobre, sem gastar o convite, se a conta já existe. */
  async function aceitar(tokenDoLink: string, escolaNome: string, senha?: string): Promise<void> {
    const vezDoAceite = vezDoLink.current
    if (noAr.current.has(vezDoAceite)) return
    noAr.current.add(vezDoAceite)
    definirAceitandoNasVezes((vezes) => [...vezes, vezDoAceite])
    definirFalha(undefined)
    const desfecho = await aceitarConviteNaVez(senha === undefined ? { token: tokenDoLink } : { token: tokenDoLink, senha }, () => vezDoLink.current)
    noAr.current.delete(vezDoAceite)
    definirAceitandoNasVezes((vezes) => vezes.filter((naVez) => naVez !== vezDoAceite))
    // Outro link chegou enquanto o aceite estava no ar: a tela já é a dele, e nada daqui muda.
    if (desfecho.tipo === 'descartado') return
    if (desfecho.tipo === 'aceito') {
      if (desfecho.resposta.etapa === 'configurar_mfa') {
        navegar(ROTAS.configurarMfa, { replace: true })
        return
      }
      // O bilhete ficou na memória desta aba e vai no próximo login por e-mail. Sem senha nova, a conta já existia, e é
      // o login com a senha dela que ativa o acesso à escola que convidou. Com a senha nova, é o professor que acabou de
      // criá-la: falta entrar com ela.
      definirAvisoDaEntrada(senha === undefined ? AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE : AVISO_DO_CONVITE_COM_SENHA_NOVA)
      navegar(ROTAS.entrar, { replace: true })
      return
    }
    const codigo = desfecho.erro instanceof ErroDaApi ? desfecho.erro.codigo : undefined
    // Conta nova: a API recusa o aceite sem senha e não gasta o convite. Agora dá para pedir a senha com segurança.
    if (senha === undefined && codigo === ErrorCode.ENTRADA_INVALIDA) definirEtapa({ nome: 'definir-senha', token: tokenDoLink, escolaNome })
    // Usado, refeito ou revogado entre a consulta e o aceite: a mesma tela do convite que não vale, sem o nome da escola.
    else if (codigo === ErrorCode.NAO_ENCONTRADO) definirEtapa({ nome: 'invalido' })
    else definirFalha(desfecho.erro)
  }

  /** A consulta de novo, com o token que continua na memória da tela: a tela volta a conferir na hora. */
  function tentarDeNovo(): void {
    definirEtapa({ nome: 'consultando' })
    definirTentativa((anterior) => anterior + 1)
  }

  if (etapa.nome === 'consultando') {
    return (
      <CascaPublica titulo="Convite">
        <EstadoCarregando rotulo="Conferindo o convite…" />
      </CascaPublica>
    )
  }

  if (etapa.nome === 'falhou') {
    return (
      <CascaPublica titulo="Convite">
        <EstadoErro erro={etapa.erro} aoTentarDeNovo={tentarDeNovo} />
      </CascaPublica>
    )
  }

  if (etapa.nome === 'sem-token' || etapa.nome === 'invalido') {
    return (
      <CascaPublica titulo="Convite">
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          {etapa.nome === 'sem-token'
            ? 'O endereço do convite está incompleto. Abra o link inteiro que a escola enviou, ou peça um convite novo.'
            : mensagemDoConvite(ErrorCode.NAO_ENCONTRADO)}
        </p>
        {/* Quem abriu de novo o convite que já aceitou só precisa entrar; a tela não sabe qual dos casos aconteceu. */}
        <p className="text-apoio">Já aceitou o convite? Entre com o seu e-mail e a sua senha.</p>
        <div>
          <Link className={SECONDARY_LINK_CLASSES} to={ROTAS.entrar}>
            Entrar
          </Link>
        </div>
      </CascaPublica>
    )
  }

  const { escolaNome } = etapa

  return (
    <CascaPublica titulo="Convite">
      <p className="text-apoio">
        Você foi convidado para entrar em <span className="font-medium break-words text-tinta">{escolaNome}</span>.
      </p>
      {falha !== undefined && (
        <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
          {falha instanceof ErroDaApi ? mensagemDoConvite(falha.codigo) : mensagemDoConvite(ErrorCode.ERRO_INTERNO)}
        </p>
      )}
      {etapa.nome === 'confirmar' ? (
        <>
          <Button onClick={() => void aceitar(etapa.token, escolaNome)} disabled={aceitando} className="w-full">
            {aceitando ? 'Aceitando…' : 'Aceitar o convite'}
          </Button>
          <span role="status" className="sr-only">
            {aceitando ? 'Aceitando…' : ''}
          </span>
        </>
      ) : (
        <SenhaNova aceitando={aceitando} aoEnviar={(senha) => void aceitar(etapa.token, escolaNome, senha)} />
      )}
    </CascaPublica>
  )
}

/** A senha nova, pedida só depois de a API dizer que a conta é nova. */
function SenhaNova({ aceitando, aoEnviar }: { aceitando: boolean; aoEnviar: (senha: string) => void }) {
  const [senha, definirSenha] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  // O "Aceitar o convite" que tinha o foco saiu da tela com este passo: o foco vem para o campo, e não fica no `body`,
  // e o leitor de tela diz o que agora se pede (regra 50, item 11).
  useEffect(() => {
    campo.current?.focus()
  }, [])

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    aoEnviar(senha)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={enviar}>
      <p className="text-apoio">Crie a senha que você vai usar para entrar.</p>
      <PasswordInput
        ref={campo}
        rotulo="Senha nova"
        dica={`Pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres. Use uma frase que só você saiba.`}
        name="senha"
        autoComplete="new-password"
        required
        minLength={TAMANHO_MINIMO_SENHA_NOVA}
        maxLength={TAMANHO_MAXIMO_SENHA}
        value={senha}
        onChange={(evento) => definirSenha(evento.target.value)}
      />
      <Button type="submit" disabled={aceitando} className="w-full">
        {aceitando ? 'Salvando…' : 'Definir a senha e continuar'}
      </Button>
      <span role="status" className="sr-only">
        {aceitando ? 'Salvando…' : ''}
      </span>
    </form>
  )
}
