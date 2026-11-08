import { TAMANHO_MAXIMO_EMAIL } from '@educa/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { pedirLinkDeSenha } from '../api/senha'
import { Button } from '../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../components/ui/button-variants'
import { FormField } from '../components/ui/fields/FormField'
import { CascaPublica } from '../components/CascaPublica'
import { ErrorState } from '../components/states'
import { ROUTES } from '../paths'

/** A frase que toda resposta do pedido recebe: a mesma exista ou não a conta (RF12), e por isso nunca diz qual dos dois foi. */
const CONFIRMACAO_DO_ESQUECI = 'Se houver conta com este e-mail, mandamos um link. Ele vale 1 hora.'

/**
 * "Esqueci a senha" (acesso-e-convites, 6.0; RF12): a equipe pede o link por e-mail. Alcançada pelo link da entrada; o aluno não
 * tem e-mail (regra 20, item 2) e a tela o manda ao professor, que gera a senha provisória.
 *
 * Os quatro estados: carregando é o "Enviando…" do botão; vazio é o formulário, com a linha do aluno; erro é o aviso do que
 * fazer com o "Tentar de novo" (rede, ou o 429 do limite geral por IP das rotas anônimas: os baldes do "esqueci" nunca respondem
 * 429, respondem 202 sem envio); e "com dado" é a frase única da confirmação, que toma o foco para o leitor de tela. A resposta é
 * a mesma exista ou não a conta, e a tela não repete o e-mail digitado.
 */
export function EsqueciASenha() {
  const [email, definirEmail] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [enviado, definirEnviado] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)
  // Trava o segundo clique, que chega antes de a tela desligar o botão; o estado é o que o desliga.
  const noAr = useRef(false)
  const confirmacao = useRef<HTMLParagraphElement>(null)

  // O formulário sai da tela com a resposta, e o foco que estava no botão iria para o `body`: ele vai para a confirmação.
  useEffect(() => {
    if (enviado) confirmacao.current?.focus()
  }, [enviado])

  /** O "Tentar de novo" mantém o aviso na tela até a resposta, para o botão que tem o foco não sair dela: quem sai da tela perde o foco. */
  async function pedir(deNovo: boolean): Promise<void> {
    if (noAr.current) return
    noAr.current = true
    definirEnviando(true)
    if (!deNovo) definirFalha(undefined)
    try {
      await pedirLinkDeSenha({ email })
      definirEnviado(true)
    } catch (erro) {
      definirFalha(erro)
    } finally {
      noAr.current = false
      definirEnviando(false)
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    void pedir(false)
  }

  if (enviado) {
    return (
      <CascaPublica titulo="Esqueci a senha">
        <p ref={confirmacao} tabIndex={-1} role="status" className="rounded-controle border border-ok bg-ok-cx p-4 text-ok">
          {CONFIRMACAO_DO_ESQUECI}
        </p>
        <div>
          <Link className={SECONDARY_LINK_CLASSES} to={ROUTES.entrar}>
            Voltar para Entrar
          </Link>
        </div>
      </CascaPublica>
    )
  }

  return (
    <CascaPublica titulo="Esqueci a senha">
      <p className="text-apoio">Digite o e-mail da sua conta. Mandamos um link para você escolher uma senha nova.</p>
      <p className="text-apoio">Aluno: peça a senha provisória ao professor.</p>
      <form className="flex flex-col gap-4" onSubmit={enviar}>
        <FormField
          rotulo="E-mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={TAMANHO_MAXIMO_EMAIL}
          value={email}
          onChange={(evento) => definirEmail(evento.target.value)}
        />
        {falha !== undefined && <ErrorState erro={falha} aoTentarDeNovo={() => void pedir(true)} tentando={enviando} />}
        <Button type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Enviando…' : 'Enviar o link'}
        </Button>
        <span role="status" className="sr-only">
          {enviando ? 'Enviando…' : ''}
        </span>
      </form>
      <div>
        <Link className={SECONDARY_LINK_CLASSES} to={ROUTES.entrar}>
          Voltar para Entrar
        </Link>
      </div>
    </CascaPublica>
  )
}
