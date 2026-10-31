import { lazy } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { ROTAS_DO_ALUNO } from '../../paths'
import { ConteudoNaoEncontrado } from '../../components/NotFound'

/**
 * As telas da atividade e do Tutor (A3 e A4), cada uma no pedaço dela (`tela-aluno-<Tela>-*.js`), que só se baixa ao
 * abrir a rota: quem abre Tarefas não baixa a conversa do Tutor, e o teto de cada tela é o de
 * `apps/web/chunk-names.ts`. O `Suspense` e a fronteira de erro da área (`src/routes.tsx`) já as cobrem.
 */
const Inicio = lazy(() => import('./Inicio'))
const Eu = lazy(() => import('./Eu'))
const Atividades = lazy(() => import('./Atividades'))
const Atividade = lazy(() => import('./Atividade'))
const Tutor = lazy(() => import('./Tutor'))
/** A introdução do aluno (9.0): tela de foco, dentro da casca; só quem a abre baixa o pedaço. */
const BemVindo = lazy(() => import('./introducao/BemVindo'))
/**
 * "Meus dados" é a mesma tela do aluno e do professor, e por isso mora em `components/` (a tela de uma área não importa
 * módulo de outra, `areas/navigation.ts`, linha 5): sai num pedaço `parte-*` só por `import()`, que nenhuma entrada baixa.
 */
const MeusDados = lazy(() => import('../../components/meus-dados/MeusDados'))

/** O id que vem no endereço só vai à API se for um UUID: o resto é endereço que não existe. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A área do aluno, relativa a `/aluno`, num chunk próprio, `aluno-*.js` (`apps/web/chunk-names.ts`), que só se baixa
 * depois de a guarda de `apps/web/src/routes.tsx` conferir o papel. Tem "Início" (onde o aluno abre) e "Tarefas" (a lista e a
 * atividade aberta), "Eu" (a turma dele e as linhas Privacidade e Sair; X4, 2.0), "Bem-vindo" (a introdução, em tela de foco; X4, 9.0), o Tutor, que continua nos endereços de hoje
 * (a escolha da atividade e a conversa por atividade), e "Privacidade" com "Meus dados" (F3, 18.0), que a linha de Eu abre;
 * qualquer outro endereço daqui responde "Página não encontrada". "Minha turma" não é mais tela: o endereço dela leva a Eu.
 * "Meu desempenho" e "Avisar um adulto" não existem nesta fatia.
 *
 * **Tela nova entra por `lazy(() => import('./Tela'))`**, e não por `import` direto: as cinco linhas da convenção estão
 * no topo de `areas/navigation.ts`.
 */
export default function RotasDoAluno() {
  return (
    <Switch>
      <Route path={ROTAS_DO_ALUNO.inicio} component={Inicio} />
      <Route path={ROTAS_DO_ALUNO.tutor}>
        <Tutor />
      </Route>
      {/* A `key` pela atividade: outra atividade é outra conversa, e o que foi digitado numa não aparece na outra. */}
      <Route path={ROTAS_DO_ALUNO.tutorDaAtividade}>
        {(parametros) => (UUID.test(parametros.atividadeAplicadaId) ? <Tutor key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} /> : <ConteudoNaoEncontrado />)}
      </Route>
      <Route path={ROTAS_DO_ALUNO.atividades} component={Atividades} />
      <Route path={ROTAS_DO_ALUNO.atividade}>
        {(parametros) => (UUID.test(parametros.atividadeAplicadaId) ? <Atividade key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} /> : <ConteudoNaoEncontrado />)}
      </Route>
      <Route path={ROTAS_DO_ALUNO.eu} component={Eu} />
      <Route path={ROTAS_DO_ALUNO.bemVindo} component={BemVindo} />
      {/* O endereço de "Minha turma" leva a Eu, sem ficar no histórico: quem o guardou nos favoritos não cai em "não encontrada". */}
      <Route path={ROTAS_DO_ALUNO.minhaTurma}>
        <Redirect to={ROTAS_DO_ALUNO.eu} replace />
      </Route>
      {/* A tela é uma só com a do professor; o título da aba e o nome da seção são o do aluno ("Privacidade", com "Meus dados"). */}
      <Route path={ROTAS_DO_ALUNO.privacidade}>
        <MeusDados titulo="Privacidade" secao="Meus dados" />
      </Route>
      <Route>
        <ConteudoNaoEncontrado />
      </Route>
    </Switch>
  )
}
