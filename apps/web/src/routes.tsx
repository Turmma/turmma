import type { PapelDeUsuario } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { euQueryOptions } from './api/eu'
import { abrirSessaoPeloCookie, assinarSessao, erroDaSessao, estadoDaSessao } from './api/sessao'
import { AREA_BASE_PATH, ROUTES } from './paths'
import { CascaDaEscola } from './components/CascaDaEscola'
import { LoadingState, ErrorState } from './components/states'
import { AreaErrorBoundary } from './components/AreaErrorBoundary'
import { ReauthDialog } from './components/ReauthDialog'
import { NotFoundContent, NotFoundPage } from './components/NotFound'
import { AcessoSuspenso } from './pages/AcessoSuspenso'
import { Casca } from './pages/Casca'
import { ConfigurarMfa } from './pages/ConfigurarMfa'
import { Convite } from './pages/Convite'
import { Entrar } from './pages/Entrar'
import { EntrarNaEscola } from './pages/EntrarNaEscola'
import { EscolherEscola } from './pages/EscolherEscola'
import { Inicio } from './pages/Inicio'
import { Mfa } from './pages/Mfa'
import { TurmaPublica } from './pages/TurmaPublica'
import { tituloDaEscola, tituloDaOperacao } from './document-title'

/**
 * A área do operador Turmma (A0), só por `import()`: vira o chunk `operacao-*.js` (`vite.config.ts`), que nenhuma tela
 * da escola baixa (Tech Spec da A0, seção 9, B2). Nada daqui importa de `./operacao/` de outro jeito: o teste de
 * `apps/web/chunk-names.test.ts` reprova, no build, o `import` estático.
 */
const AreaDaOperacao = lazy(() => import('./operacao/routes'))

/**
 * A galeria das peças do MVP de apresentação, também só por `import()`: vira o chunk `galeria-*.js`, e as peças de
 * `components/ui/ai/` não entram no primeiro carregamento por causa dela (`apps/web/chunk-names.ts`).
 *
 * **Só existe no build feito com `VITE_COM_GALERIA=1`**: o `.env.example`, que é o ambiente da máquina e da esteira, liga a
 * variável, porque o e2e roda sobre aquele build (como o `ROTAS_SINTETICAS` da API). Com qualquer outro valor — o de
 * staging e o de produção —, a rota some, o `import()` sai do código e o endereço responde "Página não encontrada". O
 * compose não sobe sem a variável definida, e o build solto sem ela não leva a galeria: o esquecimento falha para o
 * lado seguro. No servidor de desenvolvimento, `VITE_COM_GALERIA=1 npx vite`.
 */
const Galeria = import.meta.env.VITE_COM_GALERIA === '1' ? lazy(() => import('./gallery/Gallery')) : undefined

/** O caminho da área, repetido aqui para a entrada não importar nada de `./operacao/`. */
const BASE_DA_OPERACAO = '/operacao'

/**
 * A área de cada papel da escola, também só por `import()`: cada uma vira o chunk dela (`coordenacao-*.js`,
 * `professor-*.js`, `aluno-*.js`, em `apps/web/chunk-names.ts`), com teto próprio no `.size-limit.json`, e fica
 * fora da entrada que toda a escola baixa às 7h30.
 */
const AREA_DO_PAPEL: Readonly<Record<PapelDeUsuario, LazyExoticComponent<ComponentType>>> = {
  coordenador: lazy(() => import('./areas/coordenacao/routes')),
  professor: lazy(() => import('./areas/professor/routes')),
  aluno: lazy(() => import('./areas/aluno/routes')),
}

/** O que a fronteira diz quando o chunk de uma área não chega: o título da falha na aba, e o que fazer (W5). */
const FALHA_DA_AREA = {
  tituloDaAba: tituloDaEscola('Não foi possível carregar'),
  titulo: 'Não foi possível carregar esta parte do Turmma',
  texto: 'A página não chegou até aqui. Confira a conexão e tente de novo.',
} as const

/**
 * A área que exige sessão. O estado vem do módulo de sessão, não do cache de consultas: a sessão não é dado de
 * servidor para guardar (regra 50, item 3), e a troca de escola da 20.0 limpa o cache inteiro do TanStack Query.
 *
 * Sem sessão, leva à entrada. Com a API fora do ar, mostra o erro e o "Tentar de novo" — 5xx e queda de rede nunca
 * mandam ninguém para o login (regra 80, item 6).
 *
 * Com a sessão vencida, a tela continua montada e o login abre por cima dela: a professora pode estar no meio de uma
 * contestação, e o relógio não pode apagar o que ela escreveu (regra 80, item 6). Só o "Sair" e a aba que abriu sem
 * sessão levam à entrada.
 *
 * Com o acesso suspenso (a renovação respondeu `ACESSO_SUSPENSO`, F3, 20.0), a área sai e a tela "Acesso suspenso" toma
 * o lugar dela: sem login por cima, porque a senha certa daria a mesma recusa, e sem "Tentar de novo".
 */
function Protegida({ children }: { children: ReactNode }) {
  const estado = useSyncExternalStore(assinarSessao, estadoDaSessao)
  // Só na aba que acabou de abrir: depois disso, quem muda o estado é a entrada, a saída ou o "Tentar de novo".
  useEffect(() => {
    if (estado === 'desconhecida') void abrirSessaoPeloCookie()
  }, [estado])

  if (estado === 'aberta') return children
  if (estado === 'vencida')
    return (
      <>
        {children}
        <ReauthDialog />
      </>
    )
  if (estado === 'anonima') return <Redirect to={ROUTES.entrar} replace />
  if (estado === 'suspensa') return <AcessoSuspenso />
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
      {estado === 'indisponivel' ? (
        <ErrorState erro={erroDaSessao()} aoTentarDeNovo={() => void abrirSessaoPeloCookie()} />
      ) : (
        <LoadingState rotulo="Abrindo a sua sessão…" />
      )}
    </div>
  )
}

/**
 * A guarda de papel da área (W2): a área só é baixada e montada para a sessão daquele papel. Para qualquer outro papel,
 * o endereço responde "Página não encontrada", igual a um endereço que não existe, e o chunk da área nem é pedido.
 *
 * É só a tela. Quem decide o que cada papel alcança é a API, pela matriz de permissão e pelo escopo do token (regra 00,
 * item 1): a guarda existe para ninguém cair numa tela que não é dele, e não para proteger dado.
 *
 * O papel vem do `/v1/eu`, a mesma consulta da casca. Toda sessão nova esvazia o cache (`main.tsx`), também a da mesma
 * pessoa que volta pelo login por cima da tela, e o `/v1/eu` fica sem dado até a resposta nova chegar. Nesse meio tempo
 * a guarda segue com o papel que já conhecia, e a área fica montada: é ela que guarda o que a professora estava
 * escrevendo, e a sessão vencer não pode apagar isso (regra 80, item 6). Quando é outra pessoa, a casca leva a aba à
 * página inicial (`lembrarQuemEsta`), e a área sai junto; quando a resposta nova traz outro papel, a guarda responde
 * "não encontrada".
 */
function AreaDoPapel({ papel }: { papel: PapelDeUsuario }) {
  const eu = useQuery(euQueryOptions)
  const [papelConhecido, definirPapelConhecido] = useState(eu.data?.papel)
  if (eu.data !== undefined && eu.data.papel !== papelConhecido) definirPapelConhecido(eu.data.papel)
  const papelDaSessao = eu.data?.papel ?? papelConhecido

  if (papelDaSessao === undefined) {
    if (eu.isError) return <ErrorState erro={eu.error} tentando={eu.isFetching} aoTentarDeNovo={() => void eu.refetch({ cancelRefetch: false })} />
    return <LoadingState rotulo="Carregando…" />
  }
  if (papelDaSessao !== papel) return <NotFoundContent />
  const Area = AREA_DO_PAPEL[papel]
  return (
    <AreaErrorBoundary {...FALHA_DA_AREA}>
      <Suspense fallback={<LoadingState rotulo="Carregando…" />}>
        <Area />
      </Suspense>
    </AreaErrorBoundary>
  )
}

/**
 * Os endereços com sessão: a página inicial e as áreas de cada papel. Uma rota só para todos, para a casca ficar montada
 * na troca de tela — a gaveta, o seletor e o relógio de inatividade não recomeçam a cada clique na lateral.
 */
const CAMINHOS_COM_SESSAO = /^\/(?:(?:coordenacao|professor|aluno)(?:\/.*)?)?$/

/** A área autenticada: a casca da escola em volta de cada tela, com a navegação do papel e o "Sair" (RF13 do F1). */
function AreaAutenticada() {
  return (
    <Protegida>
      <CascaDaEscola>
        <Switch>
          <Route path={ROUTES.inicio} component={Inicio} />
          <Route path={AREA_BASE_PATH.coordenador} nest>
            <AreaDoPapel papel="coordenador" />
          </Route>
          <Route path={AREA_BASE_PATH.professor} nest>
            <AreaDoPapel papel="professor" />
          </Route>
          <Route path={AREA_BASE_PATH.aluno} nest>
            <AreaDoPapel papel="aluno" />
          </Route>
        </Switch>
      </CascaDaEscola>
    </Protegida>
  )
}

/**
 * Quem já tem sessão **nesta aba** não fica na tela de entrada: o Voltar depois de entrar devolve à área autenticada.
 *
 * Abrir `/entrar` direto, com a aba recém-carregada, mostra o formulário mesmo com o cookie de renovação válido, e é
 * de propósito: renovar aqui faria toda a escola somar uma chamada a `/v1/sessao/renovar` ao abrir a tela de entrada
 * às 7h30, justamente para receber 401 na maioria das vezes (regra 80). Quem já entrou chega pela área autenticada.
 */
function Entrada() {
  const estado = useSyncExternalStore(assinarSessao, estadoDaSessao)
  const [, navegar] = useLocation()
  useEffect(() => {
    if (estado === 'aberta') navegar(ROUTES.inicio, { replace: true })
  }, [estado, navegar])
  return <Entrar />
}

export function AppRoutes() {
  return (
    <Switch>
      <Route path={ROUTES.entrar} component={Entrada} />
      {/* A área do operador, aninhada: dentro dela os caminhos são relativos a `/operacao`. */}
      <Route path={BASE_DA_OPERACAO} nest>
        <AreaErrorBoundary
          tituloDaAba={tituloDaOperacao('Não foi possível carregar')}
          titulo="Operação Turmma"
          texto="Não foi possível carregar a área da operação. Confira a conexão e tente de novo."
          paginaInteira
        >
          <Suspense
            fallback={
              <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:px-6">
                <LoadingState rotulo="Carregando a área da operação…" />
              </div>
            }
          >
            <AreaDaOperacao />
          </Suspense>
        </AreaErrorBoundary>
      </Route>
      <Route path={ROUTES.sistema} component={Casca} />
      {Galeria !== undefined && (
        <Route path={ROUTES.galeria}>
          <AreaErrorBoundary {...FALHA_DA_AREA} paginaInteira>
            <Suspense fallback={<LoadingState rotulo="Carregando…" />}>
              <Galeria />
            </Suspense>
          </AreaErrorBoundary>
        </Route>
      )}
      {/* A página pública da turma, por onde o aluno pede o nome (A1, 17.0). Na entrada, e não num chunk de área: é a primeira tela do aluno. */}
      <Route path={ROUTES.salaDaTurma}>{(parametros) => <TurmaPublica slug={parametros.slug} />}</Route>
      {/* O endereço da escola, por onde o aluno entra (RF7). Fica antes das rotas fixas por ser a única com parâmetro. */}
      <Route path={ROUTES.escola}>{(parametros) => <EntrarNaEscola slug={parametros.slug} />}</Route>
      {/* Etapas do login, sem sessão ainda. */}
      <Route path={ROUTES.mfa} component={Mfa} />
      <Route path={ROUTES.configurarMfa} component={ConfigurarMfa} />
      <Route path={ROUTES.convite} component={Convite} />
      <Route path={ROUTES.escolherEscola} component={EscolherEscola} />
      <Route path={CAMINHOS_COM_SESSAO} component={AreaAutenticada} />
      <Route component={NotFoundPage} />
    </Switch>
  )
}
