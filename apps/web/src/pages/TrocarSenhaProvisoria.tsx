import { ErrorCode, TAMANHO_MAXIMO_SENHA, TAMANHO_MINIMO_SENHA_NOVA, mensagemDaEntradaPorMatricula, type TrocasDaProvisoriaResponse } from '@educa/shared'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'wouter'
import { ApiError } from '../api/client'
import { bilheteDaTroca, esquecerBilheteDaTroca, trocarSenhaProvisoria } from '../api/sessao'
import { textoDaProvisoriaAnterior, trocasDaProvisoriaQueryOptions } from '../api/troca-da-provisoria'
import { Button } from '../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../components/ui/button-variants'
import { PasswordInput } from '../components/ui/fields/PasswordInput'
import { CascaPublica } from '../components/CascaPublica'
import { ErrorState } from '../components/states'
import { caminhoDaEscola, LOGIN_STEP_ROUTE } from '../paths'

const TITULO = 'Crie a sua senha'

/** A regra da senha nova, dita antes de o aluno digitar e repetida quando a API a recusa. */
const REGRA_DA_SENHA = `Pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres. Use uma frase que só você saiba.`

/** O bilhete vencido, a provisória que já foi usada ou trocada por outra: a API responde igual, e a tela também (regra 10, item 6). O caminho é um só: falar com quem gerou. */
const PROVISORIA_QUE_NAO_VALE = 'Esta senha provisória não vale mais. Peça a senha de novo ao professor.'

/** A aba sem bilhete (um F5, ou o "Voltar à entrada"): a provisória ainda pode valer, e o caminho é entrar de novo com ela. */
const SEM_BILHETE = 'Entre de novo com a sua matrícula e a senha provisória. Se ela não valer mais, peça a senha de novo ao professor.'

/**
 * "Crie a sua senha" (acesso-e-convites, 13.0; RF13): o aluno entrou com a senha provisória e, antes de qualquer tela, define a dele. Mostra as provisórias geradas antes (quem
 * gerou, quando, se foi usada) e, ao trocar, abre a sessão e entra.
 *
 * - **O bilhete** (`api/sessao.ts`) está só em memória, e nunca na URL, no armazenamento do navegador nem no cache de consultas. Sem ele (um F5, ou o "Voltar à entrada"), a tela
 *   manda entrar de novo.
 * - **Os quatro estados.** Carregando: o esqueleto parado da lista (sem animação, D59). Vazio: "É a primeira vez que você troca a senha", sem tabela. Erro: a lista falhada mostra
 *   o aviso com "Tentar de novo" e **não bloqueia** o campo de senha. Com dado: uma linha por provisória de antes, "Gerada pela coordenação em 12/11/2026 às 14:05 · usada".
 * - **O bilhete que não vale** (vencido, ou a provisória que o aluno já usou ou que outra substituiu), na lista ou na troca, troca a tela por "Peça a senha de novo ao professor".
 * - **Recomeço.** O formulário é do aluno do bilhete, e a chave da lista leva o número dele: o colega que chega ao mesmo computador (o "Voltar à entrada" desmonta a tela) começa de uma tela limpa, sem a
 *   senha digitada, o aviso nem a lista do anterior, e a resposta de uma lista que chega depois de o aluno ter saído não vai para a tela do seguinte.
 */
export function TrocarSenhaProvisoria({ slug }: { slug: string }) {
  const bilhete = bilheteDaTroca()
  if (bilhete === undefined) return <SemBilhete slug={slug} />
  return <TrocaDoAluno slug={slug} numeroDoBilhete={bilhete.numero} />
}

function TrocaDoAluno({ slug, numeroDoBilhete }: { slug: string; numeroDoBilhete: number }) {
  const anteriores = useQuery(trocasDaProvisoriaQueryOptions(numeroDoBilhete))
  const [naoVale, definirNaoVale] = useState(false)

  if (naoVale || ehNaoAutenticado(anteriores.error)) return <ProvisoriaQueNaoVale slug={slug} />

  return (
    <CascaPublica titulo={TITULO}>
      <p className="text-apoio">Você entrou com uma senha provisória. Ela serve só para isto: criar a sua senha. Depois você entra com a nova.</p>
      <FormularioDaTroca aoNaoValer={() => definirNaoVale(true)} />
      <section aria-labelledby="titulo-das-anteriores" className="flex flex-col gap-3 border-t border-linha pt-6">
        <h2 id="titulo-das-anteriores" className="font-medium">
          Senhas provisórias de antes
        </h2>
        <ListaDeAntes anteriores={anteriores} />
      </section>
      <div>
        <Link className={SECONDARY_LINK_CLASSES} to={caminhoDaEscola(slug)} onClick={esquecerBilheteDaTroca}>
          Voltar à entrada
        </Link>
      </div>
    </CascaPublica>
  )
}

/**
 * O campo da senha nova e o botão. `aoNaoValer` é o bilhete que a API recusou na troca: a tela inteira vira o aviso. As outras falhas ficam aqui, abaixo do campo, que mantém o que o
 * aluno digitou (menos no bilhete que não vale, onde não há mais o que enviar).
 */
function FormularioDaTroca({ aoNaoValer }: { aoNaoValer: () => void }) {
  const [, navegar] = useLocation()
  const [senha, definirSenha] = useState('')
  const [salvando, definirSalvando] = useState(false)
  const [recusada, definirRecusada] = useState(false)
  const [falha, definirFalha] = useState<unknown>(undefined)
  // Trava na hora o segundo clique, que chega antes de o botão desligar; o estado é o que o desliga.
  const noAr = useRef(false)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    campo.current?.focus()
  }, [])

  /** O "Tentar de novo" da troca mantém o aviso até a resposta, para o botão que tem o foco não sair da tela com ele. */
  async function salvar(deNovo: boolean): Promise<void> {
    if (noAr.current) return
    noAr.current = true
    definirSalvando(true)
    definirRecusada(false)
    if (!deNovo) definirFalha(undefined)
    try {
      const resposta = await trocarSenhaProvisoria(senha)
      // A senha sai da memória da tela assim que a resposta chega.
      definirSenha('')
      navegar(LOGIN_STEP_ROUTE[resposta.etapa], { replace: true })
    } catch (erro) {
      definirFalha(undefined)
      const codigo = erro instanceof ApiError ? erro.codigo : undefined
      if (codigo === ErrorCode.NAO_AUTENTICADO) aoNaoValer()
      else if (codigo === ErrorCode.ENTRADA_INVALIDA) {
        definirRecusada(true)
        campo.current?.focus()
      } else definirFalha(erro)
    } finally {
      noAr.current = false
      definirSalvando(false)
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    void salvar(false)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={enviar}>
      <PasswordInput
        ref={campo}
        rotulo="Senha nova"
        dica={REGRA_DA_SENHA}
        erro={recusada ? `A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.` : undefined}
        name="senha"
        autoComplete="new-password"
        obrigatorio
        maxLength={TAMANHO_MAXIMO_SENHA}
        value={senha}
        onChange={(evento) => {
          definirSenha(evento.target.value)
          definirRecusada(false)
        }}
      />
      {falha !== undefined &&
        (ehContaSegurada(falha) ? (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
            {mensagemDaEntradaPorMatricula(ErrorCode.CONTA_SEGURADA, falha.esperaSegundos)}
          </p>
        ) : (
          <ErrorState erro={falha} aoTentarDeNovo={() => void salvar(true)} tentando={salvando} />
        ))}
      <Button type="submit" disabled={salvando} className="w-full">
        {salvando ? 'Salvando…' : 'Criar a senha e entrar'}
      </Button>
      <span role="status" className="sr-only">
        {salvando ? 'Salvando…' : ''}
      </span>
    </form>
  )
}

/** A lista de antes nos quatro estados: carregando, erro (o aviso, e o formulário segue), vazio (a primeira vez, sem tabela) e com dado. */
function ListaDeAntes({ anteriores }: { anteriores: UseQueryResult<TrocasDaProvisoriaResponse> }) {
  if (anteriores.isPending) return <EsqueletoDaLista />
  if (anteriores.isError) return <ErrorState erro={anteriores.error} aoTentarDeNovo={() => void anteriores.refetch({ cancelRefetch: false })} tentando={anteriores.isFetching} />
  if (anteriores.data.anteriores.length === 0) return <p className="text-apoio">É a primeira vez que você troca a senha.</p>
  return (
    <ul className="flex flex-col gap-2">
      {anteriores.data.anteriores.map((anterior) => (
        <li key={`${anterior.geradaEm}-${anterior.papel}`} className="rounded-controle border border-linha p-3 text-apoio">
          {textoDaProvisoriaAnterior(anterior)}
        </li>
      ))}
    </ul>
  )
}

/** O carregamento da lista (`docs/interface.md` 11.3): duas barras paradas no lugar das linhas, sem pulso nem giro, e o texto só para o leitor de tela (D59). */
function EsqueletoDaLista() {
  return (
    <div role="status" data-esqueleto="">
      <span className="sr-only">Carregando as senhas provisórias de antes…</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-12 rounded-controle bg-realce-suave" />
        <div className="h-12 rounded-controle bg-realce-suave" />
      </div>
    </div>
  )
}

function ehNaoAutenticado(erro: unknown): boolean {
  return erro instanceof ApiError && erro.codigo === ErrorCode.NAO_AUTENTICADO
}

function ehContaSegurada(erro: unknown): erro is ApiError {
  return erro instanceof ApiError && erro.codigo === ErrorCode.CONTA_SEGURADA
}

/** A provisória que não vale mais: o caminho é pedir a senha de novo a quem a gerou. */
function ProvisoriaQueNaoVale({ slug }: { slug: string }) {
  return <AvisoComSaida slug={slug} texto={PROVISORIA_QUE_NAO_VALE} />
}

/** A tela aberta sem o bilhete: um F5 na troca, ou o endereço digitado à mão. */
function SemBilhete({ slug }: { slug: string }) {
  return <AvisoComSaida slug={slug} texto={SEM_BILHETE} />
}

function AvisoComSaida({ slug, texto }: { slug: string; texto: string }) {
  return (
    <CascaPublica titulo={TITULO}>
      <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        {texto}
      </p>
      <div>
        <Link className={SECONDARY_LINK_CLASSES} to={caminhoDaEscola(slug)} onClick={esquecerBilheteDaTroca}>
          Voltar à entrada
        </Link>
      </div>
    </CascaPublica>
  )
}
