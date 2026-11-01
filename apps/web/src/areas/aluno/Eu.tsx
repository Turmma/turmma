import { ErrorCode, nomeDaSerie } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Lock, LogOut, Settings } from 'lucide-react'
import { useContext, useState } from 'react'
import { ApiError } from '../../api/client'
import { minhaTurmaQueryOptions } from '../../api/minha-turma'
import { ALUNO_ROUTES } from '../../paths'
import { LoadingState, ErrorState } from '../../components/states'
import { SignOutContext } from '../../components/sign-out-context'
import { IconTile } from '../../components/ui/IconTile'
import { ListItem } from '../../components/ui/ListItem'
import { Page } from '../../components/ui/Page'
import { usePageTitle } from '../../document-title'
import { ComoEstouIndo } from './ComoEstouIndo'
import { DialogoDeAjustes } from './DialogoDeAjustes'

/**
 * O que a tela diz quando a API não acha turma para o aluno no ano em curso (`NAO_ENCONTRADO`): o ano virou e a turma
 * nova ainda não existe, ou o vínculo dele não está confirmado. Não é falha da rede, e "Tentar de novo" não mudaria
 * nada: o texto diz a quem recorrer.
 */
const SEM_TURMA_NO_ANO = 'Você ainda não está em uma turma neste ano letivo. Fale com quem dá a aula ou com a coordenação.'

/** As linhas da conta, que existem em todos os estados da tela: o "Sair" nunca depende da leitura da turma (D59). */
function LinhasDaConta({ aoAbrirAjustes }: { readonly aoAbrirAjustes: () => void }) {
  const { sair, saindo } = useContext(SignOutContext)
  return (
    <ul aria-label="Conta" className="grid grid-cols-1 gap-0.5 overflow-hidden rounded-cartao border-2 border-borda bg-borda lg:grid-cols-2">
      <li className="bg-superficie">
        <ListItem
          titulo="Privacidade"
          inicio={
            <IconTile familia="verde" tamanho={40}>
              <Lock aria-hidden="true" />
            </IconTile>
          }
          para={ALUNO_ROUTES.privacidade}
        />
      </li>
      <li className="bg-superficie">
        <ListItem
          titulo="Ajustes"
          inicio={
            <IconTile familia="turquesa" tamanho={40}>
              <Settings aria-hidden="true" />
            </IconTile>
          }
          aoAcionar={aoAbrirAjustes}
        />
      </li>
      <li className="bg-superficie">
        <ListItem
          titulo="Rever a introdução"
          tituloEmDuasLinhas
          inicio={
            <IconTile familia="lima" tamanho={40}>
              <BookOpen aria-hidden="true" />
            </IconTile>
          }
          para={ALUNO_ROUTES.bemVindo}
        />
      </li>
      <li className="bg-superficie">
        <ListItem
          titulo={saindo ? 'Saindo…' : 'Sair'}
          inicio={
            <IconTile familia="anil" tamanho={40}>
              <LogOut aria-hidden="true" />
            </IconTile>
          }
          aoAcionar={sair}
        />
      </li>
    </ul>
  )
}

/**
 * "Eu" do aluno (telas do aluno e primeiro acesso, 2.0, 7.0 e 8.0; RF9, RF20): a turma, a série e a escola na linha de apoio do título,
 * como no mockup 2.5, "Como estou indo" (`ComoEstouIndo`, com os quatro estados dele) e as linhas **Privacidade**, **Ajustes** (o diálogo com a aparência e o tamanho da letra, que só grava ao escolher), **Rever a introdução** (9.0; RF9, RF17: o mesmo endereço da primeira entrada, e revendo todo passo fecha) e **Sair**. Sem colegas, sem professor, sem matrícula (regra 50, item 9): o contrato de
 * `GET /v1/minha-turma` não traz nada disso, e a tela não tem de onde tirar.
 *
 * **A página cabe em 1366 × 768** com duas tarefas corrigidas (RF20): as quatro linhas da conta ficam em grade 2 × 2 a partir de 1024 px
 * e em uma coluna abaixo disso. Os estados da turma são carregando, com dado, o erro com "Tentar de novo" (queda de rede não é logout, regra 80, item 6)
 * e, à parte, o aluno sem turma no ano, que não é erro de ninguém e diz o que fazer. **As linhas existem em todos os
 * estados**: o "Sair" nunca depende de a leitura da turma ter dado certo (D59).
 *
 * O "Sair" é o da casca, pelo contexto (`SignOutContext`): a mesma saída do botão da lateral, a um clique.
 */
export default function Eu() {
  usePageTitle('Eu')
  const minhaTurma = useQuery(minhaTurmaQueryOptions)
  const [ajustesAbertos, definirAjustesAbertos] = useState(false)

  function avisoDaTurma() {
    if (minhaTurma.isPending) return <LoadingState rotulo="Carregando a sua turma…" />
    if (minhaTurma.isError) {
      if (minhaTurma.error instanceof ApiError && minhaTurma.error.codigo === ErrorCode.NAO_ENCONTRADO)
        return (
          <p role="status" className="rounded-cartao border border-linha bg-superficie p-4 text-apoio">
            {SEM_TURMA_NO_ANO}
          </p>
        )
      return <ErrorState erro={minhaTurma.error} tentando={minhaTurma.isFetching} aoTentarDeNovo={() => void minhaTurma.refetch({ cancelRefetch: false })} />
    }
    return null
  }

  /** A turma, a série e a escola, na linha de apoio do título (mockup 2.5): sem cartão próprio, que tomava 165 px da janela. */
  function descricaoDaTurma(): string | undefined {
    if (!minhaTurma.isSuccess) return undefined
    const { escola, turma, serie } = minhaTurma.data
    return `${turma.nome} · ${nomeDaSerie(serie)} · ${escola.nome}`
  }

  return (
    <Page titulo="Eu" idDoTitulo="titulo-eu" largura="conversa" descricao={descricaoDaTurma()}>
      {/* A região da tela, com o nome do título: o conteúdo todo, com os 16 px entre blocos que a `Page` dá. */}
      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="titulo-eu">
        {avisoDaTurma()}
        <ComoEstouIndo />
        <LinhasDaConta aoAbrirAjustes={() => definirAjustesAbertos(true)} />
      </section>
      {ajustesAbertos && <DialogoDeAjustes aoFechar={() => definirAjustesAbertos(false)} />}
    </Page>
  )
}
