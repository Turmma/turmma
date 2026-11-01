import { TAMANHO_MAXIMO_EMAIL, TAMANHO_MAXIMO_SENHA } from '@educa/shared'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/fields/FormField'
import { avisoDaEntradaDeOperador, assinarSessaoDeOperador, entrarComoOperador, estadoDaSessaoDeOperador } from '../api/sessao'
import { INICIO_DA_OPERACAO, OPERACAO_ROUTES } from '../paths'
import { CascaPublicaDaOperacao } from '../components/CascaDaOperacao'
import { textoDaFalhaDaEntrada } from '../textos'
import { useOperacaoPageTitle } from '../document-title'

/**
 * A entrada do operador por e-mail e senha (PRD da A0, RF3). Os quatro estados: o formulário é o "com dado"; carregando
 * é o "Entrando…" do botão, que também cobre o 503 do semáforo repetido pela web; erro é a mensagem que diz o que fazer;
 * e não há vazio, porque nada é buscado antes do envio.
 *
 * O aviso no topo é o que trouxe a pessoa de volta: a sessão que terminou ("Sua sessão terminou…"), o código do segundo
 * fator recusado, ou a saída que a API não confirmou. Vive só na memória da aba.
 */
export function Entrar() {
  useOperacaoPageTitle('Entrar')
  const [, navegar] = useLocation()
  const estado = useSyncExternalStore(assinarSessaoDeOperador, estadoDaSessaoDeOperador)
  const aviso = useSyncExternalStore(assinarSessaoDeOperador, avisoDaEntradaDeOperador)
  const [email, definirEmail] = useState('')
  const [senha, definirSenha] = useState('')
  const [entrando, definirEntrando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)
  const campoDaSenha = useRef<HTMLInputElement>(null)

  // Quem já tem a sessão aberta nesta aba não fica na entrada: o Voltar do navegador devolve à casca.
  useEffect(() => {
    if (estado === 'aberta') navegar(INICIO_DA_OPERACAO, { replace: true })
  }, [estado, navegar])

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (entrando) return
    definirEntrando(true)
    definirFalha(undefined)
    try {
      const etapa = await entrarComoOperador({ email, senha })
      navegar(etapa === 'mfa' ? OPERACAO_ROUTES.mfa : OPERACAO_ROUTES.configurarMfa)
    } catch (erro) {
      definirFalha(erro)
      // A pessoa digita a senha de novo, e o foco já está no campo dela (a mensagem é anunciada pelo `alert`).
      campoDaSenha.current?.focus()
    } finally {
      // A senha sai da memória da tela assim que a resposta chega, dê certo ou não: no computador do laboratório, a
      // senha errada não fica no estado da tela para quem sentar depois (tarefa 10.0 da A0b).
      definirSenha('')
      definirEntrando(false)
    }
  }

  return (
    <CascaPublicaDaOperacao titulo="Entrar na operação">
      {aviso !== undefined && (
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          {aviso}
        </p>
      )}
      <p className="text-apoio">Área da equipe Turmma. Use o e-mail e a senha da sua conta de operador.</p>
      <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        <FormField
          rotulo="E-mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={TAMANHO_MAXIMO_EMAIL}
          value={email}
          onChange={(evento) => definirEmail(evento.target.value)}
        />
        <FormField
          rotulo="Senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          maxLength={TAMANHO_MAXIMO_SENHA}
          value={senha}
          onChange={(evento) => definirSenha(evento.target.value)}
          ref={campoDaSenha}
        />
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
            {textoDaFalhaDaEntrada(falha)}
          </p>
        )}
        <Button type="submit" disabled={entrando} className="w-full">
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
        <span role="status" className="sr-only">
          {entrando ? 'Entrando…' : ''}
        </span>
      </form>
    </CascaPublicaDaOperacao>
  )
}
