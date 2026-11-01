import { nomeDaSerie } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useId, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { turmaAbertaQueryOptions } from '../../../api/estrutura'
import { euQueryOptions } from '../../../api/eu'
import { PROFESSOR_ROUTES } from '../../../paths'
import { Tabs } from '../../../components/ui/Tabs'
import { LoadingState, ErrorState } from '../../../components/states/index'
import { Page } from '../../../components/ui/Page'
import { TurmaIndisponivel } from '../../../components/TurmaIndisponivel'
import { usePageTitle } from '../../../document-title'
import { TEXTO_DA_TURMA_INDISPONIVEL, turmaIndisponivel } from './acesso/acesso-da-turma'
import { ABAS_DA_TURMA, abaDoEndereco, abaDoId, enderecoDaAba } from './endereco-da-turma'
import { O_MIOLO_DO_DOCUMENTO, useTopoDoPainel } from '../artefatos/miolo-do-documento'

/**
 * Cada aba só é baixada com ela aberta, cada uma no seu pedaço (`tela-professor-<Aba>-*.js`): a fachada da área fica com a
 * moldura da turma, e as abas crescem sem tocar nela (a 11.0 e a 12.0 só alteram o arquivo da aba delas).
 */
const baixarHoje = () => import('./TurmaHoje')
const baixarAtividades = () => import('../atividades/AtividadesDaTurma')
const baixarAlunos = () => import('./AlunosDaTurma')
const TurmaHoje = lazy(baixarHoje)
const AtividadesDaTurma = lazy(baixarAtividades)
const AlunosDaTurma = lazy(baixarAlunos)
const BAIXAR_A_ABA = { hoje: baixarHoje, atividades: baixarAtividades, alunos: baixarAlunos } as const

/**
 * A turma aberta pelo professor, dentro de Turmas (A1, 15.0 e 16.0; telas do professor, 10.0; `docs/interface.md` 1 e 11.1): o
 * nome e a série e três abas, **Hoje, Atividades e Alunos**, guardadas no endereço (`?aba=`). Sem aba, ou com aba que não existe
 * (o `visao-geral` de antes), abre em Hoje; trocar de aba troca o endereço (`replace`), sem passo no histórico.
 *
 * Só abre a turma em que o vínculo dele está confirmado, no ano em curso: quem decide é a API (`GET /v1/turmas/:id`), e
 * a turma de outro professor, a de outra escola, a pendente e a que não existe respondem igual (regra 10, item 6). A tela
 * diz uma coisa só para as quatro, com a quem recorrer.
 *
 * As seções só existem com a turma e a escola da sessão lidas. Toda sessão que acaba ou muda esvazia as duas leituras
 * (`main.tsx`), e as seções saem com o que estiver aberto nelas — o link e o código, os pedidos marcados e o diálogo da
 * decisão inclusive. A releitura que cai por rede ou servidor com o dado já na tela não desmonta nada: a professora pode
 * estar com o código projetado.
 *
 * **A página não rola, rola o painel da aba** (RF22; `mockup.md` 10.2): do `md` para cima o título, a série e as abas ficam parados e
 * só o painel da aba ativa rola por dentro, com o mesmo miolo do documento aberto (`miolo-do-documento.ts`), que mede onde o painel
 * começa. Abaixo de 768 px a página rola inteira.
 *
 * A turma que sai do alcance com a tela aberta tira a página inteira, com um aviso só: pela releitura da turma, ou pela
 * leitura dos pedidos (aba Alunos) ou a dos sinais (aba Hoje, aos 15 s), que se repetem sozinhas e são as primeiras a saber (`perdida`).
 * Só o 404 tira a página: a releitura que cai por rede ou servidor, com o dado na tela, não tira.
 */
export default function Turma({ turmaId }: { turmaId: string }) {
  const turma = useQuery(turmaAbertaQueryOptions(turmaId))
  const eu = useQuery(euQueryOptions)
  const idDoTitulo = useId()
  const [caminho, navegar] = useLocation()
  // A aba é do endereço, e não de `useState`: recarregar e voltar pelo histórico devolvem a mesma.
  const aba = abaDoEndereco(useSearch())
  // O pedaço da aba sai junto com as leituras da turma, e não depois delas: o navegador guarda o módulo, e a aba que aparece em
  // seguida o encontra pronto (a rede lenta do Chromebook paga uma ida só, e não duas em fila). Se falhar, quem avisa é a aba.
  useEffect(() => {
    BAIXAR_A_ABA[aba]().catch(() => undefined)
  }, [aba])
  // A leitura dos pedidos deixou de achar a turma: vale como a releitura da turma que deixa de achá-la.
  const [perdida, definirPerdida] = useState(false)
  const perderATurma = useCallback(() => definirPerdida(true), [])
  // A turma que a API deixou de achar sai também do título da aba.
  const indisponivel = perdida || turmaIndisponivel(turma.error)
  // O mesmo nome na aba e no `h1`; sem a turma lida, ou com ela fora do ano, é só "Turma".
  const nomeDaTurma = turma.data === undefined || indisponivel ? 'Turma' : `Turma ${turma.data.nome}`
  const serieDaTurma = turma.data === undefined || indisponivel ? undefined : nomeDaSerie(turma.data.serie)
  usePageTitle(nomeDaTurma)
  // O topo do painel só é medido com a turma à vista: antes disso a tela é o aviso de carregando, de erro ou de indisponível.
  const topoDoPainel = useTopoDoPainel(turma.data !== undefined && eu.data !== undefined && !indisponivel)

  const voltar = (
    // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
    <Link to={PROFESSOR_ROUTES.turmas} className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
      <ArrowLeft aria-hidden="true" size={18} />
      Voltar para Turmas
    </Link>
  )

  // A turma que a API deixou de achar (o vínculo encerrado com a tela aberta) sai da página mesmo com o nome já lido: o
  // título da página e o da aba não continuam afirmando uma turma que a seção diz não estar disponível.
  if (turma.data === undefined || eu.data === undefined || indisponivel) {
    // A que falhou, a turma primeiro: sem ela não há o que mostrar, e é dela o "não está disponível".
    const falha = turma.isError ? turma : eu.isError ? eu : undefined
    return (
      <Page titulo={nomeDaTurma} descricao={serieDaTurma} antes={voltar}>
        {indisponivel ? (
          // Com a turma já na tela, tudo o que tinha o foco saiu com ela (o diálogo aberto, os botões das seções): o foco
          // vem para o aviso. Na página que abre já sem a turma, fica onde o navegador o pôs.
          <TurmaIndisponivel texto={TEXTO_DA_TURMA_INDISPONIVEL} comFoco={turma.data !== undefined} />
        ) : falha === undefined ? (
          <LoadingState rotulo="Carregando a turma…" />
        ) : (
          <ErrorState erro={falha.error} tentando={falha.isFetching} aoTentarDeNovo={() => void falha.refetch({ cancelRefetch: false })} />
        )}
      </Page>
    )
  }

  return (
    <Page titulo={nomeDaTurma} descricao={serieDaTurma} antes={voltar} idDoTitulo={idDoTitulo}>
      <section className="flex min-w-0 flex-col gap-6" aria-labelledby={idDoTitulo}>
        <div ref={topoDoPainel} className="min-w-0">
          <Tabs rotulo="Seções da turma" abas={ABAS_DA_TURMA} ativa={aba} aoMudar={(id) => navegar(enderecoDaAba(caminho, abaDoId(id)), { replace: true })} classeDoPainel={O_MIOLO_DO_DOCUMENTO}>
            {/* Só a aba à vista existe: a que sai da tela leva com ela as leituras dela, e Hoje, a que se repete a cada 15 s. */}
            <Suspense fallback={<LoadingState rotulo="Carregando a aba…" />}>
              {aba === 'hoje' && <TurmaHoje turmaId={turmaId} aoPerderATurma={perderATurma} />}
              {aba === 'atividades' && <AtividadesDaTurma turmaId={turmaId} />}
              {aba === 'alunos' && <AlunosDaTurma turmaId={turmaId} turmaNome={turma.data.nome} escola={eu.data.escola} aoPerderATurma={perderATurma} />}
            </Suspense>
          </Tabs>
        </div>
      </section>
    </Page>
  )
}
