import { ErrorCode, mensagemDaEntrada, mensagemDaEntradaPorMatricula, TAMANHO_MAXIMO_EMAIL, TAMANHO_MAXIMO_MATRICULA, TAMANHO_MAXIMO_SENHA } from '@educa/shared'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { ApiError } from '../api/client'
import { descartarSessaoVencida, entrarPorEmail, entrarPorMatricula, quemEstaNaSessao } from '../api/sessao'
import { LOGIN_STEP_ROUTE, ROUTES } from '../paths'
import { Button } from './ui/Button'
import { FIELD_BOX } from './ui/fields/field-styles'

/** O campo do login, igual ao do `FormField`: 48 px, canto de 12, borda de 2 px em `borda-campo` e fundo `campo`. */
const CLASSES_DO_CAMPO_DO_LOGIN = `min-h-12 px-3.5 py-2 t-corpo ${FIELD_BOX}`

/**
 * A sessão venceu, e a tela continua atrás do diálogo. Quem volta é quase sempre a mesma pessoa, pelo mesmo caminho
 * por onde entrou: o aluno pela matrícula, no endereço da escola; a equipe pelo e-mail.
 *
 * O `dialog` nativo é o que prende o foco e deixa o resto da página inerte sem nenhum JavaScript nosso — e o Esc não
 * fecha, porque não há para onde fechar: atrás dele não há sessão nenhuma.
 *
 * A caixa é a do `Dialog` (`docs/interface.md` 10.2, "na mesma caixa"): canto de 16 px, borda de 2 px e degrau sólido de
 * 4 px (`shadow-flutua`). O véu é outro, de propósito: `data-sessao-vencida` o pede forte em `index.css`, e o `Dialog`
 * usa o `veu`.
 */
export function ReauthDialog() {
  const [, navegar] = useLocation()
  const dialogo = useRef<HTMLDialogElement>(null)
  // Quem estava aqui. A entrada bem-sucedida desmonta este diálogo, então este valor não muda embaixo do formulário.
  const anterior = quemEstaNaSessao()
  const [identificador, definirIdentificador] = useState('')
  const [senha, definirSenha] = useState('')
  const [entrando, definirEntrando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)
  const campoIdentificador = useId()
  const campoSenha = useId()
  const titulo = useId()
  const porMatricula = anterior?.papel === 'aluno'

  useEffect(() => {
    const atual = dialogo.current
    if (atual === null) return
    // `showModal` duas vezes lança: sob `StrictMode` o efeito roda de novo com o diálogo ainda aberto.
    if (!atual.open) atual.showModal()
    return () => {
      if (atual.open) atual.close()
    }
  }, [])

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (entrando) return
    definirEntrando(true)
    definirFalha(undefined)
    try {
      const escolaSlug = anterior?.escolaSlug
      const resposta =
        porMatricula && escolaSlug !== undefined
          ? await entrarPorMatricula({ slug: escolaSlug, matricula: identificador, senha })
          : await entrarPorEmail({ email: identificador, senha })
      definirSenha('')
      // `pronta` fecha o diálogo sozinho, porque a sessão volta a estar aberta e a tela de trás continua onde estava.
      // As outras etapas (segundo fator, escolher escola) são telas próprias, e aí esta sai de cena.
      if (resposta.etapa !== 'pronta') navegar(LOGIN_STEP_ROUTE[resposta.etapa], { replace: true })
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirEntrando(false)
    }
  }

  function irParaAEntrada(): void {
    const escolaSlug = anterior?.escolaSlug
    descartarSessaoVencida()
    navegar(porMatricula && escolaSlug !== undefined ? `/e/${escolaSlug}` : ROUTES.entrar, { replace: true })
  }

  const mensagem = (erro: unknown): string => {
    const codigo = erro instanceof ApiError ? erro.codigo : ErrorCode.ERRO_INTERNO
    const espera = erro instanceof ApiError ? erro.esperaSegundos : undefined
    return porMatricula ? mensagemDaEntradaPorMatricula(codigo, espera) : mensagemDaEntrada(codigo, espera)
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={titulo}
      data-sessao-vencida=""
      onCancel={(evento) => evento.preventDefault()}
      className="max-h-[calc(100svh-2rem)] w-[min(32.5rem,calc(100%-2rem))] overflow-y-auto rounded-caixa bg-superficie p-6 text-tinta shadow-flutua"
    >
      <h2 id={titulo} className="t-secao">
        Sua sessão expirou
      </h2>
      <p className="mt-2 text-apoio">
        {porMatricula
          ? 'Entre de novo com a sua matrícula e a sua senha para continuar de onde você parou. O que você escreveu continua aqui.'
          : 'Entre de novo com o seu e-mail e a sua senha para continuar de onde você parou. O que você escreveu continua aqui.'}
      </p>
      <form className="mt-4 flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        <div className="flex flex-col gap-1">
          <label htmlFor={campoIdentificador} className="t-apoio font-bold text-tinta">
            {porMatricula ? 'Matrícula' : 'E-mail'}
          </label>
          <input
            id={campoIdentificador}
            name={porMatricula ? 'matricula' : 'email'}
            type={porMatricula ? 'text' : 'email'}
            inputMode={porMatricula ? 'numeric' : 'email'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={porMatricula ? TAMANHO_MAXIMO_MATRICULA : TAMANHO_MAXIMO_EMAIL}
            value={identificador}
            onChange={(evento) => definirIdentificador(evento.target.value)}
            className={CLASSES_DO_CAMPO_DO_LOGIN}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={campoSenha} className="t-apoio font-bold text-tinta">
            Senha
          </label>
          <input
            id={campoSenha}
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            maxLength={TAMANHO_MAXIMO_SENHA}
            value={senha}
            onChange={(evento) => definirSenha(evento.target.value)}
            className={CLASSES_DO_CAMPO_DO_LOGIN}
          />
        </div>
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {mensagem(falha)}
          </p>
        )}
        <Button type="submit" disabled={entrando} className="w-full">
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
        <span role="status" className="sr-only">
          {entrando ? 'Entrando…' : ''}
        </span>
      </form>
      {/* Quem sentou no computador é outra pessoa, ou quer entrar por outro caminho: a tela de trás sai junto. */}
      <button type="button" onClick={irParaAEntrada} className="mt-3 min-h-11 text-caramelo-texto underline">
        Entrar com outra conta
      </button>
    </dialog>
  )
}
