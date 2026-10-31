import type { PapelDeUsuario } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { consultaEu } from '../api/eu'
import { Redirect } from 'wouter'
import { ROTAS } from '../paths'
import { EstadoCarregando, EstadoErro } from '../components/states'
import { useTituloDaTela } from '../document-title'

/**
 * A introdução de cada papel, que a primeira entrada abre antes da tela de abertura (telas do aluno e primeiro acesso, 9.0 e 10.0). O
 * aluno, o professor e a coordenação têm a deles nesta tabela.
 */
const INTRODUCAO_POR_PAPEL: Readonly<Partial<Record<PapelDeUsuario, string>>> = {
  aluno: ROTAS.bemVindoDoAluno,
  professor: ROTAS.bemVindoDoProfessor,
  coordenador: ROTAS.bemVindoDaCoordenacao,
}

/** A tela em que cada papel abre (o texto de `Inicio`, abaixo, diz por quê). */
const ABERTURA_POR_PAPEL: Readonly<Partial<Record<PapelDeUsuario, string>>> = {
  coordenador: ROTAS.painel,
  professor: ROTAS.novaConversa,
  aluno: ROTAS.inicioDoAluno,
}

function doPapel(tabela: Readonly<Partial<Record<PapelDeUsuario, string>>>, papel: PapelDeUsuario | undefined): string | undefined {
  return papel === undefined ? undefined : tabela[papel]
}

/**
 * A raiz de quem entrou: cada papel é levado à tela em que abre, sem ficar no histórico. A coordenação abre no Painel
 * (X2, 3.0; `docs/interface.md` 11.1: é a tela que fecha a venda), o professor em "Início" (A2; D73; D80) e o aluno
 * em "Início" (X4, 2.0): a faixa de supervisão e a escolha da atividade, antes das tarefas. A navegação de cada papel está na
 * lateral (`areas/navigation.ts`), que também diz quem está na sessão e em qual escola.
 *
 * Não há estado vazio: a resposta de `/v1/eu` sempre traz a pessoa e a escola. Carregando e erro estão aqui, e o erro
 * mantém a tela em pé com "Tentar de novo" — queda de rede não é logout (regra 80, item 6).
 */
export function Inicio() {
  useTituloDaTela('Início')
  const eu = useQuery(consultaEu)

  if (eu.isPending) return <EstadoCarregando rotulo="Carregando a sua escola…" />
  const papel = eu.data?.papel
  // Data nula: a pessoa ainda não viu a introdução do papel dela. Só a raiz desvia; o endereço aberto direto não (Tech Spec, seção 5).
  const introducao = doPapel(INTRODUCAO_POR_PAPEL, papel)
  if (introducao !== undefined && eu.data?.introducaoVistaEm === null) return <Redirect to={introducao} replace />
  const abertura = doPapel(ABERTURA_POR_PAPEL, papel)
  if (abertura !== undefined) return <Redirect to={abertura} replace />
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="titulo-inicio">
      <h1 id="titulo-inicio" className="text-xl font-semibold sm:text-2xl">
        Início
      </h1>
      {eu.isError && <EstadoErro erro={eu.error} tentando={eu.isFetching} aoTentarDeNovo={() => void eu.refetch({ cancelRefetch: false })} />}
    </section>
  )
}
