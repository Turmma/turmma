import { ErrorCode, mensagemDaEntrada, TAMANHO_MAXIMO_EMAIL, TAMANHO_MAXIMO_SENHA } from '@educa/shared'
import { useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { ApiError } from '../api/client'
import { avisoDaEntrada, definirAvisoDaEntrada, entrarPorEmail, saidaPendente } from '../api/sessao'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/fields/FormField'
import { CascaPublica } from '../components/CascaPublica'
import { LOGIN_STEP_ROUTE } from '../paths'

/** A mensagem que a tela mostra para uma falha da entrada, sempre pelo código e nunca pelo status (regra 50, item 12). */
function mensagemDaFalha(erro: unknown): string {
  return erro instanceof ApiError ? mensagemDaEntrada(erro.codigo, erro.esperaSegundos) : mensagemDaEntrada(ErrorCode.ERRO_INTERNO)
}

/**
 * A entrada da equipe por e-mail e senha (RF6). Coluna única a partir de 360 px, rótulo visível em cada campo e
 * botão principal de 44 px (regra 50, itens 2a e 11).
 *
 * Os quatro estados aqui são três: carregando é o "Entrando…" do botão, que também cobre o 503 do semáforo repetido
 * pela web; erro é a mensagem que diz o que fazer; e "com dado" é ter entrado. Não há estado vazio: o formulário é a
 * própria tela, e nada é buscado antes de a pessoa enviá-lo.
 */
export function Entrar() {
  const [, navegar] = useLocation()
  const [email, definirEmail] = useState('')
  const [senha, definirSenha] = useState('')
  const [entrando, definirEntrando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (entrando) return
    definirEntrando(true)
    definirFalha(undefined)
    try {
      const resposta = await entrarPorEmail({ email, senha })
      // A senha sai da memória da tela assim que a resposta chega, em qualquer etapa.
      definirSenha('')
      // Sem `replace`: o Voltar do navegador leva à entrada, que com sessão aberta devolve à área autenticada.
      navegar(LOGIN_STEP_ROUTE[resposta.etapa])
    } catch (erro) {
      // O convite que já não vale (A0b, E16): o aviso de "entre com a sua senha para concluir o convite" deixou de ser
      // verdade, e a tela não pode dizer as duas coisas ao mesmo tempo.
      if (erro instanceof ApiError && erro.codigo === ErrorCode.NAO_ENCONTRADO) definirAvisoDaEntrada(undefined)
      definirFalha(erro)
    } finally {
      definirEntrando(false)
    }
  }

  return (
    <CascaPublica titulo="Entrar">
      {/* A saída que a API não confirmou não pode passar por saída feita: o cookie de renovação ainda vale, e quem
          ficar neste computador volta à sessão anterior. */}
      {saidaPendente() && (
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          Não foi possível encerrar a sessão anterior neste computador. Entre e saia de novo, ou feche o navegador antes
          de deixar a máquina.
        </p>
      )}
      {/* O que trouxe a pessoa de volta para cá: o segundo fator que gastou o desafio, ou o convite aceito por uma
          conta que já existe. Vive só em memória, como o aviso de saída não confirmada. */}
      {avisoDaEntrada() !== undefined && (
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          {avisoDaEntrada()}
        </p>
      )}
      <p className="text-apoio">Use o e-mail e a senha que a sua escola cadastrou.</p>
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
        />
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
            {mensagemDaFalha(falha)}
          </p>
        )}
        <Button type="submit" disabled={entrando} className="w-full">
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
        {/* O "Entrando…" também é anunciado a quem usa leitor de tela: no 503 da rajada das 7h30 a espera passa de um segundo. */}
        <span role="status" className="sr-only">
          {entrando ? 'Entrando…' : ''}
        </span>
      </form>
    </CascaPublica>
  )
}
