import {
  ErrorCode,
  mensagemDaEntradaPorMatricula,
  mensagemDaFalhaExterna,
  mensagemDoAcessoDaEscola,
  PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO,
  TAMANHO_MAXIMO_MATRICULA,
  TAMANHO_MAXIMO_SENHA,
  type AcessoDaEscolaResponse,
} from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { ErroDaApi } from '../api/client'
import { consultaAcessoDaEscola, enderecoDoLoginExterno, NOME_DO_PROVEDOR } from '../api/escola'
import { entrarPorMatricula } from '../api/sessao'
import { ROTA_DA_ETAPA } from '../paths'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/fields/Campo'
import { CascaPublica } from '../components/CascaPublica'
import { EstadoCarregando } from '../components/states'

/**
 * O aviso fixo dos botões da conta da escola (PRD, casos de borda "Admin da escola não liberou o app" e "Escola revoga
 * o app"). Vem **antes** dos botões de propósito: o Google e a Microsoft não dizem com clareza o que devolvem quando a
 * escola não liberou o aplicativo (Tech Spec, seção 12), então o aluno precisa saber disso antes de tentar.
 */
const AVISO_DA_TI = 'A equipe de tecnologia da escola precisa liberar este aplicativo para as contas de aluno. Se não funcionar, entre com a sua matrícula.'

/**
 * A entrada do aluno pelo endereço da escola (RF7 a RF11, RF20): matrícula e senha, ou a conta Google ou Microsoft da
 * escola quando ela liberou.
 *
 * Os quatro estados: carregando enquanto o nome da escola não chega; erro quando o endereço não abre; "com dado" é o
 * formulário com o nome da escola. Não há estado vazio — a escola sem provedor liberado simplesmente não mostra os
 * botões, e a matrícula, que é o caminho de toda escola, continua ali.
 *
 * A linguagem é a do aluno de 11 anos (`docs/interface.md`, seção 2): frases curtas, sem jargão e sem código de erro.
 */
export function EntrarNaEscola({ slug }: { slug: string }) {
  const acesso = useQuery(consultaAcessoDaEscola(slug))
  const falha = useFalhaDaContaDaEscola()

  return (
    <CascaPublica titulo={acesso.data?.nome ?? 'Entrar na escola'}>
      {acesso.isPending && <EstadoCarregando rotulo="Abrindo o endereço da escola…" />}
      {acesso.isError && <ErroDoEndereco erro={acesso.error} aoTentarDeNovo={() => void acesso.refetch({ cancelRefetch: false })} tentando={acesso.isFetching} />}
      {falha !== undefined && (
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          {mensagemDaFalhaExterna(falha)}
        </p>
      )}
      {acesso.data && <FormularioDaMatricula slug={slug} />}
      {acesso.data && <ContasDaEscola slug={slug} provedores={acesso.data.provedores} />}
    </CascaPublica>
  )
}

/**
 * A falha da volta do Google ou da Microsoft, tirada da barra antes de a tela seguir (regra 50, item 7). O parâmetro
 * não é segredo, mas fica no histórico do computador compartilhado e reaparece em cada F5 como se o aluno tivesse
 * errado de novo.
 */
function useFalhaDaContaDaEscola(): string | undefined {
  // A leitura acontece na primeira renderização, e a limpeza da barra no efeito: assim o estado não depende de um
  // `setState` dentro do efeito, que dispararia uma renderização em cascata no Chromebook fraco.
  const [falha] = useState(() => new URL(window.location.href).searchParams.get(PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO) ?? undefined)
  useEffect(() => {
    if (falha === undefined) return
    const endereco = new URL(window.location.href)
    endereco.searchParams.delete(PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO)
    window.history.replaceState(null, '', `${endereco.pathname}${endereco.search}${endereco.hash}`)
  }, [falha])
  return falha
}

/** O endereço que não abre. `NAO_ENCONTRADO` não oferece "tentar de novo": insistir não faz o endereço existir. */
function ErroDoEndereco({ erro, aoTentarDeNovo, tentando }: { erro: unknown; aoTentarDeNovo: () => void; tentando: boolean }) {
  const codigo = erro instanceof ErroDaApi ? erro.codigo : ErrorCode.ERRO_INTERNO
  return (
    <div className="rounded-controle border border-erro bg-erro-cx p-4">
      <p role="alert" className="text-erro">
        {mensagemDoAcessoDaEscola(codigo)}
      </p>
      {codigo !== ErrorCode.NAO_ENCONTRADO && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Botao onClick={aoTentarDeNovo}>Tentar de novo</Botao>
          <span role="status" className="text-erro">
            {tentando ? 'Tentando de novo…' : ''}
          </span>
        </div>
      )}
    </div>
  )
}

function FormularioDaMatricula({ slug }: { slug: string }) {
  const [, navegar] = useLocation()
  const [matricula, definirMatricula] = useState('')
  const [senha, definirSenha] = useState('')
  const [entrando, definirEntrando] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (entrando) return
    definirEntrando(true)
    definirFalha(undefined)
    try {
      // O endereço vai no corpo: é ele que diz a escola, e a mesma matrícula em outra escola é outra conta (RF7).
      const resposta = await entrarPorMatricula({ slug, matricula, senha })
      definirSenha('')
      navegar(ROTA_DA_ETAPA[resposta.etapa])
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirEntrando(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(evento) => void enviar(evento)}>
      <Campo
        rotulo="Matrícula"
        name="matricula"
        type="text"
        // A matrícula é numérica na maioria das redes: o teclado do celular abre nos números, sem impedir letra.
        inputMode="numeric"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={TAMANHO_MAXIMO_MATRICULA}
        value={matricula}
        onChange={(evento) => definirMatricula(evento.target.value)}
      />
      <Campo
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
          {falha instanceof ErroDaApi ? mensagemDaEntradaPorMatricula(falha.codigo, falha.esperaSegundos) : mensagemDaEntradaPorMatricula(ErrorCode.ERRO_INTERNO)}
        </p>
      )}
      <Botao type="submit" disabled={entrando} className="w-full">
        {entrando ? 'Entrando…' : 'Entrar'}
      </Botao>
      {/* Às 7h30 o 503 do semáforo faz a espera passar de um segundo: quem usa leitor de tela precisa ouvir isso. */}
      <span role="status" className="sr-only">
        {entrando ? 'Entrando…' : ''}
      </span>
    </form>
  )
}

/**
 * Os botões da conta da escola (RF8 a RF10). São links, e não botões de formulário, porque o que acontece é navegação:
 * o `iniciar` responde com o redirecionamento ao Google ou à Microsoft.
 */
function ContasDaEscola({ slug, provedores }: { slug: string; provedores: AcessoDaEscolaResponse['provedores'] }) {
  if (provedores.length === 0) return null
  return (
    <section aria-labelledby="titulo-contas" className="flex flex-col gap-3 border-t border-linha pt-6">
      <h2 id="titulo-contas" className="font-medium">
        Ou entre com a conta da escola
      </h2>
      <p className="text-apoio">{AVISO_DA_TI}</p>
      {provedores.map((provedor) => (
        <a
          key={provedor}
          href={enderecoDoLoginExterno(provedor, slug)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-borda-campo bg-superficie px-4 py-2 text-base font-medium text-tinta hover:bg-realce-suave active:bg-realce"
        >
          Entrar com a conta {NOME_DO_PROVEDOR[provedor]} da escola
        </a>
      ))}
    </section>
  )
}
