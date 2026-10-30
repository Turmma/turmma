import {
  avisoDoSegundoFatorConsumido,
  ErrorCode,
  DIGITOS_DO_CODIGO_MFA,
  mensagemDoSegundoFator,
  TAMANHO_DO_CODIGO_DE_RECUPERACAO,
  type MfaRequest,
} from '@educa/shared'
import { useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { ErroDaApi } from '../api/cliente'
import { definirAvisoDaEntrada, desafioDaEtapa, entrarComSegundoFator, esquecerDesafio } from '../api/sessao'
import { ROTA_DA_ETAPA, ROTAS } from '../caminhos'
import { Botao } from '../componentes/ui/Botao'
import { Campo } from '../componentes/ui/campos/Campo'
import { CascaPublica } from '../componentes/CascaPublica'
import { SemDesafio } from './SemDesafio'

/** Quanto texto o campo de recuperação aceita: os 12 caracteres do código, com folga para espaço e hífen copiados. */
const TAMANHO_MAXIMO_DIGITADO_NA_RECUPERACAO = TAMANHO_DO_CODIGO_DE_RECUPERACAO + 8

/**
 * O segundo fator do coordenador (RF12, RF20). Chega aqui quem já provou a senha: o desafio `mfa` está na memória
 * desta aba, e nunca na URL nem no armazenamento do navegador.
 *
 * Estados: "com dado" é o formulário; erro é a mensagem que diz o que fazer; carregando é o botão em "Entrando…".
 * Sem desafio — um F5, ou o quinto código errado, que o gasta —, a tela manda entrar de novo, que é o único caminho.
 */
export function Mfa() {
  const [, navegar] = useLocation()
  const [recuperacao, definirRecuperacao] = useState(false)
  const [codigo, definirCodigo] = useState('')
  const [entrando, definirEntrando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)

  if (desafioDaEtapa('mfa') === undefined) {
    return <SemDesafio titulo="Segundo fator" explicacao="Para continuar, entre de novo com o seu e-mail e a sua senha." />
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (entrando) return
    definirEntrando(true)
    definirFalha(undefined)
    const pedido: MfaRequest = recuperacao ? { recuperacao: codigo } : { codigo }
    try {
      const resposta = await entrarComSegundoFator(pedido)
      definirCodigo('')
      navegar(ROTA_DA_ETAPA[resposta.etapa])
    } catch (erro) {
      // O quinto código errado gasta o desafio na API (6.0): daí em diante nem o código certo passa com ele, e
      // insistir aqui só seguraria mais a conta. A pessoa refaz a senha, e a entrada explica por quê.
      if (erro instanceof ErroDaApi && erro.codigo === ErrorCode.CONTA_SEGURADA) {
        esquecerDesafio()
        definirAvisoDaEntrada(avisoDoSegundoFatorConsumido(erro.esperaSegundos))
        navegar(ROTAS.entrar, { replace: true })
        return
      }
      // O código certo com o convite que já não vale (A0b, E16): a API já gastou o desafio, e repetir o código aqui só
      // daria "Código incorreto". A pessoa volta à entrada, que diz o que fazer: pedir um convite novo.
      if (erro instanceof ErroDaApi && erro.codigo === ErrorCode.NAO_ENCONTRADO) {
        esquecerDesafio()
        definirAvisoDaEntrada(mensagemDoSegundoFator(ErrorCode.NAO_ENCONTRADO))
        navegar(ROTAS.entrar, { replace: true })
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
    <CascaPublica titulo="Segundo fator">
      <p className="text-apoio">
        {recuperacao
          ? 'Digite um dos códigos de recuperação que você guardou quando configurou o segundo fator. Cada código vale uma vez só.'
          : 'Digite o código que o seu aplicativo autenticador mostra agora. Ele muda a cada 30 segundos.'}
      </p>
      <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
        {recuperacao ? (
          <Campo
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
          <Campo
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
            {falha instanceof ErroDaApi ? mensagemDoSegundoFator(falha.codigo, falha.esperaSegundos) : mensagemDoSegundoFator(ErrorCode.ERRO_INTERNO)}
          </p>
        )}
        <Botao type="submit" disabled={entrando} className="w-full">
          {entrando ? 'Entrando…' : 'Entrar'}
        </Botao>
        <span role="status" className="sr-only">
          {entrando ? 'Entrando…' : ''}
        </span>
      </form>
      {/* Botão, e não link: não é navegação, é o mesmo formulário com o outro código. */}
      <button type="button" onClick={trocarDeCodigo} className="min-h-11 self-start text-caramelo-texto underline">
        {recuperacao ? 'Usar o código do aplicativo' : 'Usar um código de recuperação'}
      </button>
    </CascaPublica>
  )
}
