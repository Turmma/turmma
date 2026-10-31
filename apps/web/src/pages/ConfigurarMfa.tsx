import { ErrorCode, DIGITOS_DO_CODIGO_MFA, mensagemDoSegundoFator, type ConfigurarMfaResponse } from '@educa/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { ErroDaApi, mensagemDoErro } from '../api/client'
import { ativarMfa, configurarMfa } from '../api/mfa'
import { desafioDaEtapa } from '../api/sessao'
import { ROTAS } from '../paths'
import { Botao } from '../components/ui/Botao'
import { BotaoCopiar } from '../components/ui/BotaoCopiar'
import { Campo } from '../components/ui/fields/Campo'
import { CascaPublica } from '../components/CascaPublica'
import { CodigoQr } from '../components/CodigoQr'
import { EstadoCarregando } from '../components/states'
import { SemDesafio } from './SemDesafio'

/**
 * A configuração do segundo fator do coordenador (RF12, RF20). Nenhum passo exige celular (regra 50, item 2): o
 * segredo aparece em texto, com botão copiar, para colar num gerenciador de senhas do computador. O QR fica ao lado,
 * para quem preferir um aplicativo de celular, e nunca é o único caminho.
 *
 * Segredo e códigos de recuperação ficam só no estado do componente, e somem quando a tela sai: as respostas vêm com
 * `Cache-Control: no-store` e não passam pelo cache de consultas (regra 20, itens 4 e 7).
 */
export function ConfigurarMfa() {
  const temDesafio = desafioDaEtapa('configurar_mfa') !== undefined
  const [segredo, definirSegredo] = useState<ConfigurarMfaResponse | undefined>(undefined)
  const [falhaDoPreparo, definirFalhaDoPreparo] = useState<unknown>(undefined)
  const [codigosDeRecuperacao, definirCodigosDeRecuperacao] = useState<readonly string[] | undefined>(undefined)
  const [tentativa, definirTentativa] = useState(0)
  /** O pedido de segredo em voo, preso à tentativa que o motivou. Ver o efeito abaixo. */
  const pedido = useRef<{ tentativa: number; promessa: Promise<ConfigurarMfaResponse> } | undefined>(undefined)

  // Cada chamada gera um segredo novo e sobrescreve o anterior na conta; por isso a tela pede um só, e o "tentar de
  // novo" é uma escolha da pessoa, nunca uma repetição automática que trocaria o segredo já copiado.
  //
  // O pedido fica preso à tentativa que o motivou, e não à execução do efeito: em `StrictMode`, que o
  // desenvolvimento usa, o efeito roda duas vezes na montagem, e duas chamadas deixariam a tela mostrando um segredo
  // enquanto a conta guarda o outro — a coordenadora nunca conseguiria ativar, e sem erro que explicasse. A segunda
  // execução reaproveita a promessa da primeira; só o "tentar de novo", que muda `tentativa`, pede outro segredo.
  useEffect(() => {
    if (!temDesafio) return undefined
    let atual = true
    if (pedido.current?.tentativa !== tentativa) pedido.current = { tentativa, promessa: configurarMfa() }
    pedido.current.promessa.then(
      (resposta) => atual && definirSegredo(resposta),
      (erro: unknown) => atual && definirFalhaDoPreparo(erro),
    )
    return () => {
      atual = false
    }
  }, [temDesafio, tentativa])

  // Com os códigos na tela, o desafio já foi consumido pela ativação: a tela precisa continuar mostrando o que só
  // aparece uma vez, em vez de mandar entrar de novo justamente ali.
  if (!temDesafio && codigosDeRecuperacao === undefined) {
    return <SemDesafio titulo="Configurar o segundo fator" explicacao="Para configurar o segundo fator, entre de novo com o seu e-mail e a sua senha." />
  }

  return (
    <CascaPublica titulo="Configurar o segundo fator">
      {codigosDeRecuperacao === undefined ? (
        <>
          <p className="text-apoio">
            A coordenação entra com senha e com um código que muda a cada 30 segundos. Use um aplicativo autenticador no
            computador — KeePassXC, Bitwarden ou 1Password, por exemplo. Nenhum passo pede celular.
          </p>
          {segredo === undefined && falhaDoPreparo === undefined && <EstadoCarregando rotulo="Preparando o segundo fator…" />}
          {falhaDoPreparo !== undefined && (
            <div className="rounded-controle border border-erro bg-erro-cx p-4">
              <p role="alert" className="text-erro">
                {mensagemDoErro(falhaDoPreparo)} Se continuar assim, entre de novo com a sua senha.
              </p>
              <div className="mt-3">
                <Botao
                  onClick={() => {
                    definirFalhaDoPreparo(undefined)
                    definirTentativa(tentativa + 1)
                  }}
                >
                  Tentar de novo
                </Botao>
              </div>
            </div>
          )}
          {segredo && <Segredo segredo={segredo} aoAtivar={definirCodigosDeRecuperacao} />}
        </>
      ) : (
        <CodigosDeRecuperacao codigos={codigosDeRecuperacao} />
      )}
    </CascaPublica>
  )
}

/** O segredo em texto, o QR e o código que prova que o aplicativo guardou o segredo. */
function Segredo({ segredo, aoAtivar }: { segredo: ConfigurarMfaResponse; aoAtivar: (codigos: readonly string[]) => void }) {
  const [codigo, definirCodigo] = useState('')
  const [ativando, definirAtivando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (ativando) return
    definirAtivando(true)
    definirFalha(undefined)
    try {
      const resposta = await ativarMfa(codigo)
      aoAtivar(resposta.codigosRecuperacao)
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirAtivando(false)
    }
  }

  return (
    <>
      <section aria-labelledby="titulo-segredo" className="flex flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4">
        <h2 id="titulo-segredo" className="font-medium">
          1. Guarde o segredo no seu aplicativo
        </h2>
        <p className="break-all font-mono text-base text-tinta">{segredo.segredo}</p>
        <BotaoCopiar texto={segredo.segredo} rotulo="Copiar o segredo" avisoDeCopiado="Segredo copiado." />
        <div className="flex flex-wrap items-center gap-3">
          <CodigoQr conteudo={segredo.uri} descricao="Código QR com o segredo do segundo fator" />
          <p className="min-w-0 flex-1 text-apoio">Se você usa um aplicativo de celular, leia o código ao lado. No computador, cole o segredo.</p>
        </div>
      </section>
      <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        <Campo
          rotulo="2. Digite o código que o aplicativo mostra"
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
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
            {falha instanceof ErroDaApi ? mensagemDoSegundoFator(falha.codigo, falha.esperaSegundos) : mensagemDoSegundoFator(ErrorCode.ERRO_INTERNO)}
          </p>
        )}
        <Botao type="submit" disabled={ativando} className="w-full">
          {ativando ? 'Ativando…' : 'Ativar o segundo fator'}
        </Botao>
        <span role="status" className="sr-only">
          {ativando ? 'Ativando…' : ''}
        </span>
      </form>
    </>
  )
}

/**
 * Os dez códigos de recuperação, mostrados uma vez só: o banco guarda só o HMAC deles, e nem nós conseguimos mostrá-los
 * de novo. É o que salva o único coordenador que perde o aplicativo autenticador (PRD, casos de borda).
 */
function CodigosDeRecuperacao({ codigos }: { codigos: readonly string[] }) {
  return (
    <>
      <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        Guarde estes códigos agora, fora do computador da escola. Eles não aparecem de novo, e cada um vale uma vez só,
        quando você não tiver o aplicativo à mão.
      </p>
      <ul className="grid grid-cols-1 gap-1 rounded-cartao border border-linha bg-superficie p-4 font-mono text-base sm:grid-cols-2">
        {codigos.map((codigo) => (
          <li key={codigo}>{codigo}</li>
        ))}
      </ul>
      <BotaoCopiar texto={codigos.join('\n')} rotulo="Copiar os códigos" avisoDeCopiado="Códigos copiados." />
      <p className="text-apoio">O segundo fator está ativo. Entre de novo com a sua senha e com o código do aplicativo.</p>
      <Link
        to={ROTAS.entrar}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-caramelo px-4 py-2 text-base font-medium text-sobre-cor hover:bg-caramelo-claro active:bg-caramelo-fundo"
      >
        Ir para a entrada
      </Link>
    </>
  )
}
