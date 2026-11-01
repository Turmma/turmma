import { ErrorCode, DIGITOS_DO_CODIGO_MFA, formatarEspera } from '@educa/shared'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { ApiError } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/CopyButton'
import { FormField } from '../../components/ui/fields/FormField'
import { QrCode } from '../../components/QrCode'
import { LoadingState } from '../../components/states'
import { configurarSegundoFatorDeOperador, type SegundoFatorParaConfigurar } from '../api/mfa'
import { definirAvisoDaEntradaDeOperador, desafioDeOperador, entrarComSegundoFatorDeOperador, esquecerDesafioDeOperador } from '../api/sessao'
import { INICIO_DA_OPERACAO, OPERACAO_ROUTES } from '../paths'
import { CascaPublicaDaOperacao, ErroDaOperacao } from '../components/CascaDaOperacao'
import {
  TEXTO_DA_CONFIGURACAO_RECUSADA,
  TEXTO_DO_CONFIGURAR_SEM_DESAFIO,
  TEXTO_DO_CONFIGURE_DE_NOVO,
  textoDaFalhaDoSegundoFator,
} from '../textos'
import { useOperacaoPageTitle } from '../document-title'

const TITULO = 'Configurar o segundo fator'

/** O aviso da entrada quando o código da configuração foi recusado e a API gastou o desafio. */
function avisoDaRecusa(erro: unknown): string {
  if (erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO) return TEXTO_DO_CONFIGURE_DE_NOVO
  if (erro instanceof ApiError && erro.codigo === ErrorCode.CONTA_SEGURADA && erro.esperaSegundos !== undefined) {
    return `${TEXTO_DA_CONFIGURACAO_RECUSADA} Muitas tentativas nesta conta: espere ${formatarEspera(erro.esperaSegundos)} antes de tentar.`
  }
  return TEXTO_DA_CONFIGURACAO_RECUSADA
}

/**
 * Configurar o segundo fator do operador (PRD da A0, RF2 e RF3; Tech Spec, seções 4 e 9). Chega aqui quem aceitou o
 * convite, ou quem entrou por e-mail e senha antes de ativar o segundo fator, com o desafio `configurar_mfa` na memória
 * da aba. A tela pede o segredo **uma vez** e mostra, juntos:
 *
 * - o QR, a chave em texto selecionável (o caminho sem celular, regra 50, item 2) e o link `otpauth://`, que abre o
 *   aplicativo autenticador do próprio aparelho quando a tela está no celular;
 * - os dez códigos de recuperação, que só aparecem aqui: o banco guarda o HMAC deles, e nem nós os mostramos de novo;
 * - o campo do primeiro código, que ativa o segundo fator e abre a sessão.
 *
 * Segredo e códigos vivem só no estado deste componente, e somem quando a tela sai; a resposta vem com `no-store` e não
 * passa pelo cache de consultas. O desafio `mfa` que a configuração devolveu fica no módulo da sessão, e sai de lá
 * quando a tela sai sem ativar. Recarregar a tela não os mostra de novo: o desafio de configurar já foi gasto, e a tela
 * manda entrar de novo. Enquanto eles estão na tela, o navegador pergunta antes de sair ou recarregar.
 */
export function ConfigurarMfa() {
  useOperacaoPageTitle(TITULO)
  const [, navegar] = useLocation()
  const [temDesafio] = useState(() => desafioDeOperador('configurar_mfa') !== undefined)
  const [dados, definirDados] = useState<SegundoFatorParaConfigurar | undefined>(undefined)
  const [falhaDoPreparo, definirFalhaDoPreparo] = useState<unknown>(undefined)
  const [tentativa, definirTentativa] = useState(0)
  /**
   * O pedido em voo, preso à tentativa que o motivou. Cada `configurar` gera um segredo novo e troca os códigos: em
   * `StrictMode` o efeito roda duas vezes na montagem, e duas chamadas deixariam a tela com o segredo que a conta já
   * não guarda. A segunda execução reaproveita a promessa; só o "Tentar de novo" pede outra.
   */
  const pedido = useRef<{ tentativa: number; promessa: Promise<SegundoFatorParaConfigurar> } | undefined>(undefined)
  /** Se a tela ainda está aberta quando a resposta chega: fora dela, o desafio `mfa` que chegou não fica na aba. */
  const montada = useRef(false)

  useEffect(() => {
    if (!temDesafio) return undefined
    let atual = true
    if (pedido.current?.tentativa !== tentativa) pedido.current = { tentativa, promessa: configurarSegundoFatorDeOperador() }
    pedido.current.promessa.then(
      (resposta) => {
        if (!montada.current) {
          esquecerDesafioDeOperador()
          return
        }
        if (atual) definirDados(resposta)
      },
      (erro: unknown) => {
        if (!atual) return
        // O desafio que ficou (503, limite) permite tentar de novo aqui; sem ele, o caminho é a entrada.
        if (desafioDeOperador('configurar_mfa') !== undefined) {
          definirFalhaDoPreparo(erro)
          return
        }
        definirAvisoDaEntradaDeOperador(TEXTO_DO_CONFIGURAR_SEM_DESAFIO)
        navegar(OPERACAO_ROUTES.entrar, { replace: true })
      },
    )
    return () => {
      atual = false
    }
  }, [temDesafio, tentativa, navegar])

  // Sair da tela sem ativar leva junto o desafio `mfa`: ele só serve a este segredo, que só esta tela mostrava.
  useEffect(() => {
    montada.current = true
    return () => {
      montada.current = false
      if (desafioDeOperador('mfa') !== undefined) esquecerDesafioDeOperador()
    }
  }, [])

  // Com os códigos na tela, sair ou recarregar pergunta antes: eles não voltam.
  useEffect(() => {
    if (dados === undefined) return undefined
    const avisarAntesDeSair = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
      // O Chrome 109 ainda pede o `returnValue` para mostrar a pergunta.
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisarAntesDeSair)
    return () => window.removeEventListener('beforeunload', avisarAntesDeSair)
  }, [dados])

  if (!temDesafio) {
    return (
      <CascaPublicaDaOperacao titulo={TITULO}>
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          {TEXTO_DO_CONFIGURAR_SEM_DESAFIO}
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

  async function ativar(codigo: string): Promise<void> {
    try {
      await entrarComSegundoFatorDeOperador({ codigo })
      navegar(INICIO_DA_OPERACAO, { replace: true })
    } catch (erro) {
      // A API gastou o desafio ("configure de novo", código recusado, conta segurada): o caminho é a entrada, que
      // devolve a etapa de configurar enquanto o segundo fator não estiver ativo. Formato e 503 deixam a pessoa aqui.
      if (desafioDeOperador('mfa') === undefined) {
        definirAvisoDaEntradaDeOperador(avisoDaRecusa(erro))
        navegar(OPERACAO_ROUTES.entrar, { replace: true })
        return
      }
      throw erro
    }
  }

  return (
    <CascaPublicaDaOperacao titulo={TITULO}>
      <p className="text-apoio">
        O operador entra com a senha e com um código que muda a cada 30 segundos. Nenhum passo pede celular: você pode colar a
        chave num gerenciador de senhas do computador, como KeePassXC ou Bitwarden. Se preferir o celular, leia o código QR
        ou abra o link nele.
      </p>
      {dados === undefined && falhaDoPreparo === undefined && <LoadingState rotulo="Preparando o segundo fator…" />}
      {falhaDoPreparo !== undefined && (
        <ErroDaOperacao
          erro={falhaDoPreparo}
          aoTentarDeNovo={() => {
            definirFalhaDoPreparo(undefined)
            definirTentativa(tentativa + 1)
          }}
        />
      )}
      {dados !== undefined && <Configuracao dados={dados} aoAtivar={ativar} />}
    </CascaPublicaDaOperacao>
  )
}

/** A chave, os códigos de recuperação e o primeiro código, na ordem em que a pessoa os usa. */
function Configuracao({ dados, aoAtivar }: { dados: SegundoFatorParaConfigurar; aoAtivar: (codigo: string) => Promise<void> }) {
  const campoDosCodigos = useId()
  const dicaDosCodigos = useId()
  const [codigo, definirCodigo] = useState('')
  const [ativando, definirAtivando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (ativando) return
    definirAtivando(true)
    definirFalha(undefined)
    try {
      await aoAtivar(codigo)
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirAtivando(false)
    }
  }

  return (
    <>
      <section aria-labelledby="titulo-da-chave" className="flex flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4">
        <h2 id="titulo-da-chave" className="font-medium">
          1. Guarde a chave no aplicativo autenticador
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <QrCode conteudo={dados.uri} descricao="Código QR com a chave do segundo fator" />
          <p className="min-w-0 flex-1 text-apoio">No celular, leia o código QR com o aplicativo. No computador, copie a chave abaixo.</p>
        </div>
        <p className="select-all break-all font-mono text-base text-tinta">{dados.segredo}</p>
        <CopyButton texto={dados.segredo} rotulo="Copiar a chave" avisoDeCopiado="Chave copiada." />
        <a href={dados.uri} className="inline-flex min-h-11 items-center self-start text-caramelo-texto underline">
          Abrir no aplicativo autenticador deste aparelho
        </a>
      </section>

      <section aria-labelledby="titulo-dos-codigos" className="flex flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4">
        <h2 id="titulo-dos-codigos" className="font-medium">
          2. Guarde os códigos de recuperação
        </h2>
        <p id={dicaDosCodigos} className="rounded-controle border border-pendente bg-pendente-cx p-3 text-pendente">
          Eles aparecem só agora: se você sair desta tela ou recarregá-la, eles não voltam. Guarde-os fora deste computador.
          Cada um vale uma vez, quando você não tiver o aplicativo à mão.
        </p>
        <label htmlFor={campoDosCodigos} className="font-medium">
          Códigos de recuperação
        </label>
        <textarea
          id={campoDosCodigos}
          aria-describedby={dicaDosCodigos}
          readOnly
          rows={dados.codigosRecuperacao.length}
          spellCheck={false}
          value={dados.codigosRecuperacao.join('\n')}
          onFocus={(evento) => evento.currentTarget.select()}
          className="resize-none rounded-controle border border-borda-campo bg-superficie px-3 py-2 font-mono text-base text-tinta"
        />
        <CopyButton texto={dados.codigosRecuperacao.join('\n')} rotulo="Copiar os códigos" avisoDeCopiado="Códigos copiados." />
      </section>

      <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        <FormField
          rotulo="3. Digite o código que o aplicativo mostra"
          dica={`${String(DIGITOS_DO_CODIGO_MFA)} dígitos. Ele ativa o segundo fator e abre a sua sessão.`}
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
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
            {textoDaFalhaDoSegundoFator(falha)}
          </p>
        )}
        <Button type="submit" disabled={ativando} className="w-full">
          {ativando ? 'Ativando…' : 'Ativar e entrar'}
        </Button>
        <span role="status" className="sr-only">
          {ativando ? 'Ativando…' : ''}
        </span>
      </form>
    </>
  )
}
