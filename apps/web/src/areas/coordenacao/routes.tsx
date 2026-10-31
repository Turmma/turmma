import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { ROTAS_DA_COORDENACAO } from '../../paths'
import { ConteudoNaoEncontrado } from '../../components/NotFound'

/**
 * Cada tela é um pedaço próprio (`tela-coordenacao-<Tela>-*.js`), baixado só por quem a abre: a fachada da área (`coordenacao-*.js`,
 * 16 kB) leva só este arquivo (X2, 3.0). As molduras `Escola` e `Registros` também: elas desenham o título e as abas, e a tela da
 * aba chega por dentro delas.
 */
const Escola = lazy(() => import('./Escola'))
const Registros = lazy(() => import('./Registros'))
/** As telas de Escola (A1, 13.0 e 14.0; MVP, A2): a Estrutura é a aba Turmas, e a lista da turma abre abaixo dela. */
const Estrutura = lazy(() => import('./estrutura/Estrutura'))
const ListaDaTurma = lazy(() => import('./estrutura/ListaDaTurma'))
const Professores = lazy(() => import('./professores/Professores'))
const Material = lazy(() => import('./material/Material'))
/** Governança (a aba IA de Registros), Agentes e Analista (MVP, A5). */
const Governanca = lazy(() => import('./governanca/Governanca'))
const Agentes = lazy(() => import('./governanca/Agentes'))
const Analista = lazy(() => import('./governanca/Analista'))
/** O Painel (telas da coordenação, 2.0): onde a coordenação abre. */
const Painel = lazy(() => import('./painel/Painel'))
/** A aba Pedidos de Registros (F3, 16.0) e as três telas do seletor da aba Privacidade (F3, 6.0, 8.0 e 10.0). */
const Pedidos = lazy(() => import('./privacidade/Pedidos'))
const Privacidade = lazy(() => import('./privacidade/Privacidade'))
/** O detalhe do pedido de titular (F3, 17.0): num pedaço só dele, para a aba Pedidos não pagar pelos diálogos de quem não abre um pedido. */
const DetalheDoPedido = lazy(() => import('./privacidade/DetalheDoPedido'))
/** O aviso de incidente (F3, 10.0): o diálogo e a faixa, num pedaço próprio, para a fachada da área não crescer (`.size-limit.json`). */
const AvisoDeIncidente = lazy(() => import('./privacidade/AvisoDeIncidente'))
/** A introdução da coordenação (telas do aluno e primeiro acesso, 11.0): tela de foco, num pedaço próprio como as outras. */
const BemVindo = lazy(() => import('./introducao/BemVindo'))
/** O sino "Esperando você" (telas da coordenação, 1.0): a fila e a lista num pedaço próprio, desenhado na âncora da casca. */
const SinoDaCoordenacao = lazy(() => import('./painel/SinoDaCoordenacao'))

/**
 * A área da coordenação, relativa a `/coordenacao`, num chunk próprio, `coordenacao-*.js` (`apps/web/chunk-names.ts`),
 * que só se baixa depois de a guarda de `apps/web/src/routes.tsx` conferir o papel.
 *
 * Quatro lugares (X2, 3.0): Painel, Analista, **Escola** (Turmas, Professores e Material) e **Registros** (IA, Pedidos e
 * Privacidade). Cada aba é a tela que já existia, **no endereço que já tinha**, desenhada dentro da moldura do lugar
 * (`Escola.tsx`, `Registros.tsx`); a lateral acende o lugar pelo endereço (`areas/navigation.ts`, `tambemEm`). A lista da turma, os
 * Agentes e o detalhe do pedido são páginas com o "voltar" delas, abaixo do lugar. Qualquer outro endereço responde "Página não
 * encontrada".
 *
 * **Tela nova entra por `lazy(() => import('./Tela'))`**, e não por `import` direto: as cinco linhas da convenção estão
 * no topo de `areas/navigation.ts`.
 */
export default function RotasDaCoordenacao() {
  return (
    <>
      {/* Em toda tela da coordenação, antes dela: o diálogo ao entrar e, com "Ver depois", a faixa até a confirmação. Sem fallback: a tela não espera por ele. */}
      <Suspense fallback={null}>
        <AvisoDeIncidente />
      </Suspense>
      <Suspense fallback={null}>
        <SinoDaCoordenacao />
      </Suspense>
      <Switch>
        <Route path={ROTAS_DA_COORDENACAO.painel} component={Painel} />
        <Route path={ROTAS_DA_COORDENACAO.bemVindo} component={BemVindo} />
        <Route path={ROTAS_DA_COORDENACAO.analista} component={Analista} />
        {/* Escola: as três abas. */}
        <Route path={ROTAS_DA_COORDENACAO.estrutura}>
          <Escola aba="turmas">
            <Estrutura />
          </Escola>
        </Route>
        {/*
          A `key` pela turma: outra turma é outra tela. Sem ela, ir de uma turma já aberta para outra pelo histórico
          manteria o texto colado e a prévia da anterior, e "Gravar lista" os mandaria para a turma nova.
        */}
        <Route path={ROTAS_DA_COORDENACAO.turma}>{(parametros) => <ListaDaTurma key={parametros.turmaId} turmaId={parametros.turmaId} />}</Route>
        <Route path={ROTAS_DA_COORDENACAO.professores}>
          <Escola aba="professores">
            <Professores />
          </Escola>
        </Route>
        <Route path={ROTAS_DA_COORDENACAO.material}>
          <Escola aba="material">
            <Material />
          </Escola>
        </Route>
        {/* Registros › IA, e os Agentes, que ficam abaixo dele. */}
        <Route path={ROTAS_DA_COORDENACAO.governanca}>
          <Registros aba="ia">
            <Governanca />
          </Registros>
        </Route>
        <Route path={ROTAS_DA_COORDENACAO.agentes} component={Agentes} />
        {/* A Privacidade sem aba no endereço abre a dos pedidos, a primeira de Registros depois da IA. */}
        <Route path={ROTAS_DA_COORDENACAO.privacidade}>
          <Redirect to={ROTAS_DA_COORDENACAO.pedidos} replace />
        </Route>
        {/* Antes da aba: `/privacidade/pedidos/<id>` tem um trecho a mais que `/privacidade/<aba>`, e o `Switch` fica com a primeira que casa. */}
        <Route path={ROTAS_DA_COORDENACAO.pedidoDoTitular}>{(parametros) => <DetalheDoPedido key={parametros.pedidoId} pedidoId={parametros.pedidoId} />}</Route>
        <Route path={ROTAS_DA_COORDENACAO.pedidos}>
          <Registros aba="pedidos">
            <Pedidos />
          </Registros>
        </Route>
        {/* Registros › Privacidade: os prazos de guarda, as empresas e os incidentes. Uma tela que não existe abre os pedidos, pela troca: quem a faz é a `Privacidade`. */}
        <Route path={ROTAS_DA_COORDENACAO.privacidadeDaAba}>
          {(parametros) => (
            <Registros aba="privacidade">
              <Privacidade aba={parametros.aba} />
            </Registros>
          )}
        </Route>
        <Route>
          <ConteudoNaoEncontrado />
        </Route>
      </Switch>
    </>
  )
}
