import { ErrorCode, DIGITOS_DO_CODIGO_MFA, formatarEspera, TAMANHO_DO_CODIGO_DE_RECUPERACAO } from '@educa/shared'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { ApiError } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/fields/FormField'
import { definirAvisoDaEntradaDeOperador, desafioDeOperador, entrarComSegundoFatorDeOperador } from '../api/sessao'
import { INICIO_DA_OPERACAO, OPERACAO_ROUTES } from '../paths'
import { CascaPublicaDaOperacao } from '../components/CascaDaOperacao'
import { TEXTO_DO_CODIGO_RECUSADO, textoDaFalhaDoSegundoFator } from '../textos'
import { useOperacaoPageTitle } from '../document-title'

/** Quanto texto o campo de recuperação aceita: os 12 caracteres, com folga para espaço e hífen copiados. */
const TAMANHO_MAXIMO_DIGITADO_NA_RECUPERACAO = TAMANHO_DO_CODIGO_DE_RECUPERACAO + 8

/** O aviso da entrada quando o código foi recusado: com a espera da conta segurada, quando a API a informou. */
function avisoDaRecusa(erro: unknown): string {
  if (erro instanceof ApiError && erro.codigo === ErrorCode.CONTA_SEGURADA && erro.esperaSegundos !== undefined) {
    return `${TEXTO_DO_CODIGO_RECUSADO} Muitas tentativas nesta conta: espere ${formatarEspera(erro.esperaSegundos)} antes de tentar.`
  }
  return TEXTO_DO_CODIGO_RECUSADO
}

/**
 * O segundo fator do operador (PRD da A0, RF3): o código do aplicativo ou um de recuperação. Chega aqui quem provou a
 * senha, com o desafio `mfa` na memória da aba, nunca na URL nem no armazenamento do navegador.
 *
 * A API gasta o desafio em toda tentativa (tarefa 7.0): código recusado leva de volta à entrada, com o aviso do que
 * fazer, e não a um segundo código na mesma tela, que só responderia erro. Formato inválido e 503 deixam a pessoa aqui.
 * Sem desafio (um F5, o endereço digitado), a tela manda entrar de novo, que é o único caminho.
 */
export function Mfa() {
  useOperacaoPageTitle('Segundo fator')
  const [, navegar] = useLocation()
  const [recuperacao, definirRecuperacao] = useState(false)
  const [codigo, definirCodigo] = useState('')
  const [entrando, definirEntrando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)

  if (desafioDeOperador('mfa') === undefined) {
    return (
      <CascaPublicaDaOperacao titulo="Segundo fator">
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          Para continuar, entre de novo com o seu e-mail e a sua senha.
        </p>
        <Link
          to={OPERACAO_ROUTES.entrar}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-caramelo px-4 py-2 text-base font-medium text-sobre-cor hover:bg-caramelo-claro active:bg-caramelo-fundo"
        >
          Ir para a entrada
        </Link>
      </CascaPublicaDaOperacao>
    )
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (entrando) return
    definirEntrando(true)
    definirFalha(undefined)
    try {
      await entrarComSegundoFatorDeOperador(recuperacao ? { recuperacao: codigo } : { codigo })
      definirCodigo('')
      navegar(INICIO_DA_OPERACAO, { replace: true })
    } catch (erro) {
      // O desafio que a API gastou já saiu da memória: sem ele, a tela volta à entrada e explica por quê.
      if (desafioDeOperador('mfa') === undefined) {
        definirAvisoDaEntradaDeOperador(avisoDaRecusa(erro))
        navegar(OPERACAO_ROUTES.entrar, { replace: true })
        return
      }
      definirFalha(erro)
    } finally {
      definirEntrando(false)
    }
  }

  function trocarDeCodigo(): void {
    definirRecuperacao(!recuperacao)
    definirCodigo('')
    definirFalha(undefined)
  }

  return (
    <CascaPublicaDaOperacao titulo="Segundo fator">
      <p className="text-apoio">
        {recuperacao
          ? 'Digite um dos códigos de recuperação que você guardou ao configurar o segundo fator. Cada código vale uma vez só.'
          : 'Digite o código que o seu aplicativo autenticador mostra agora. Ele muda a cada 30 segundos.'}
      </p>
      <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        {recuperacao ? (
          <FormField
            key="recuperacao"
            rotulo="Código de recuperação"
            dica={`${String(TAMANHO_DO_CODIGO_DE_RECUPERACAO)} letras e números.`}
            name="recuperacao"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={TAMANHO_MAXIMO_DIGITADO_NA_RECUPERACAO}
            value={codigo}
            onChange={(evento) => definirCodigo(evento.target.value)}
          />
        ) : (
          <FormField
            key="codigo"
            rotulo="Código do aplicativo"
            dica={`${String(DIGITOS_DO_CODIGO_MFA)} dígitos.`}
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            required
            maxLength={DIGITOS_DO_CODIGO_MFA}
            value={codigo}
            onChange={(evento) => definirCodigo(evento.target.value)}
          />
        )}
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
            {textoDaFalhaDoSegundoFator(falha)}
          </p>
        )}
        <Button type="submit" disabled={entrando} className="w-full">
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
        <span role="status" className="sr-only">
          {entrando ? 'Entrando…' : ''}
        </span>
      </form>
      <button type="button" onClick={trocarDeCodigo} className="min-h-11 self-start text-caramelo-texto underline">
        {recuperacao ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}
      </button>
    </CascaPublicaDaOperacao>
  )
}
