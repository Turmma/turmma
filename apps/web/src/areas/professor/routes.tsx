import { lazy, Suspense } from 'react'
import { Route, Switch } from 'wouter'
import { PROFESSOR_ROUTES } from '../../paths'
import { NotFoundContent } from '../../components/NotFound'

/**
 * As telas do Assistente de ensino (A2), cada uma no pedaço dela (`tela-professor-<Tela>-*.js`), que só se baixa ao
 * abrir a rota: quem abre Turmas não baixa a conversa, e o teto de cada tela é o de `apps/web/chunk-names.ts`. O
 * `Suspense` e a fronteira de erro da área (`src/routes.tsx`) já as cobrem.
 */
const Home = lazy(() => import('./inicio/Home'))
const Conversa = lazy(() => import('./assistente/Conversa'))
const Ferramentas = lazy(() => import('./ferramentas/Ferramentas'))
const Ferramenta = lazy(() => import('./ferramentas/Ferramenta'))
/** Criados (telas do professor, 5.0): o que a professora já gerou, por turma, com filtros; sai em `tela-professor-Criados-*.js`. */
const Criados = lazy(() => import('./artefatos/Criados'))
const Artefato = lazy(() => import('./artefatos/Artefato'))
const Time = lazy(() => import('./assistente/Time'))
const Tutor = lazy(() => import('./turmas/Tutor'))
const Aprovar = lazy(() => import('./atividades/Aprovar'))
/** Turmas (telas do professor, 9.0): os cartões, a faixa e o painel de contestação tiraram a fachada do teto de 8 kB; sai em `tela-professor-Turmas-*.js`. */
const Turmas = lazy(() => import('./turmas/Turmas'))
/** A turma aberta (telas do professor, 10.0): a tela e as três abas dela, cada uma num pedaço próprio. */
const Turma = lazy(() => import('./turmas/Turma'))
/**
 * "Meus dados" é a mesma tela do professor e do aluno, e por isso mora em `components/` (a tela de uma área não importa
 * módulo de outra, `areas/navigation.ts`, linha 5): sai num pedaço `parte-*` só por `import()`, que nenhuma entrada baixa.
 */
const MeusDados = lazy(() => import('../../components/meus-dados/MeusDados'))
/** O sino "Esperando você" (telas do professor, 1.0): a fila e a lista num pedaço próprio, desenhado na âncora da casca. */
const SinoDoProfessor = lazy(() => import('./inicio/SinoDoProfessor'))
/** A introdução do professor (telas do aluno e primeiro acesso, 10.0): tela de foco, dentro da casca; só quem a abre baixa o pedaço. */
const BemVindo = lazy(() => import('./introducao/BemVindo'))

/**
 * A área do professor, relativa a `/professor` (o `Route` aninhado de `apps/web/src/routes.tsx`), num chunk próprio,
 * `professor-*.js` (`apps/web/chunk-names.ts`), que só se baixa depois de a guarda conferir o papel. Na A2 (D73) ela
 * tem "Início" (a Home, onde o professor abre, e a conversa com o Assistente), "Ferramentas" (o catálogo, o
 * formulário de cada uma e o artefato aberto), "Criados" (o que ela já gerou, por turma), "Turmas", com a turma aberta dentro dela (A1), "Meus dados" (F3, 18.0, no
 * menu da pessoa), "Bem-vindo" (a introdução, em tela de foco, que o menu da pessoa também abre; X4, 10.0) e, pelo pé do sino, "O que o Assistente fez" e "O que o Tutor viu". O item da lateral continua selecionado nas telas
 * de dentro (`estaNoItem`).
 *
 * **Tela nova entra por `lazy(() => import('./Tela'))`**, e não por `import` direto: as cinco linhas da convenção estão
 * no topo de `areas/navigation.ts`. Turmas saiu da fachada na 9.0 e a turma aberta, na 10.0 (Tech Spec, seção 8): a fachada
 * fica com as rotas e o sino, e o teto dela, 8 kB, não sobe.
 */
export default function RotasDoProfessor() {
  return (
    <>
      {/* Em toda tela da professora, antes dela: o sino "Esperando você". Sem fallback: a tela não espera por ele. */}
      <Suspense fallback={null}>
        <SinoDoProfessor />
      </Suspense>
      <Switch>
        <Route path={PROFESSOR_ROUTES.novaConversa} component={Home} />
        <Route path={PROFESSOR_ROUTES.conversa} component={Conversa} />
        <Route path={PROFESSOR_ROUTES.ferramentas} component={Ferramentas} />
        <Route path={PROFESSOR_ROUTES.criados} component={Criados} />
        {/* A `key` pela ferramenta: outra ferramenta é outro formulário, e não o anterior com os valores dele. */}
        <Route path={PROFESSOR_ROUTES.ferramenta}>{(parametros) => <Ferramenta key={parametros.ferramenta} ferramenta={parametros.ferramenta} />}</Route>
        {/* A `key` pelo artefato: ir de uma versão adaptada à atividade de origem é abrir outra tela, sem o renomear da anterior. */}
        <Route path={PROFESSOR_ROUTES.artefato}>{(parametros) => <Artefato key={parametros.artefatoId} artefatoId={parametros.artefatoId} />}</Route>
        <Route path={PROFESSOR_ROUTES.timeDoAssistente} component={Time} />
        <Route path={PROFESSOR_ROUTES.timeDoTutor} component={Tutor} />
        {/* A `key` pela atividade: outra correção é outra tela, sem os destaques abertos nem o diálogo da anterior. */}
        <Route path={PROFESSOR_ROUTES.aprovar}>{(parametros) => <Aprovar key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} />}</Route>
        <Route path={PROFESSOR_ROUTES.turmas} component={Turmas} />
        <Route path={PROFESSOR_ROUTES.bemVindo} component={BemVindo} />
        {/* No menu da pessoa, e não na lista de seções: o link dele é o que fica selecionado, e nenhuma seção. */}
        <Route path={PROFESSOR_ROUTES.meusDados}>
          <MeusDados titulo="Meus dados" />
        </Route>
        {/*
          A `key` pela turma: outra turma é outra tela. Sem ela, ir de uma turma aberta para outra pelo histórico manteria
          o diálogo da anterior, com o link e o código dela, por cima da turma nova.
        */}
        <Route path={PROFESSOR_ROUTES.turma}>{(parametros) => <Turma key={parametros.turmaId} turmaId={parametros.turmaId} />}</Route>
        <Route>
          <NotFoundContent />
        </Route>
      </Switch>
    </>
  )
}
