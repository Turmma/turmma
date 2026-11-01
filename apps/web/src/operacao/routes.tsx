import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, Redirect, Route, Switch } from 'wouter'
import { createQueryClient } from '../api/query-client'
import { LoadingState } from '../components/states'
import { euDoOperadorQueryOptions } from './api/eu'
import {
  abrirSessaoDeOperadorPeloCookie,
  aoTrocarDeSessaoDeOperador,
  assinarSessaoDeOperador,
  erroDaSessaoDeOperador,
  estadoDaSessaoDeOperador,
  sairComoOperador,
} from './api/sessao'
import { OPERACAO_ROUTES } from './paths'
import { AvisoDeInatividade, SessionWarningContext, type SessionWarningContextValue } from './components/AvisoDeInatividade'
import { CascaDaOperacao, CascaPublicaDaOperacao, ErroDaOperacao } from './components/CascaDaOperacao'
import { useOperatorIdleTimeout } from './idle-timeout'
import { ConfigurarMfa } from './pages/ConfigurarMfa'
import { Convite } from './pages/Convite'
import { Entrar } from './pages/Entrar'
import { Mfa } from './pages/Mfa'
import { Escolas } from './pages/Escolas'
import { Uso } from './pages/Uso'
import { useOperacaoPageTitle } from './document-title'

/**
 * A área do operador Turmma (A0), carregada por `import()` num chunk próprio (`operacao-*.js`): a web da escola nunca
 * baixa este código (Tech Spec da A0, seção 9, B2).
 *
 * O cache de consultas é **outro**, e não o da escola: a troca de pessoa numa sessão não esvazia a outra, e nenhuma
 * consulta de uma aparece na outra. Toda sessão de operador que acaba, ou que muda de dono, esvazia o daqui inteiro.
 */
const clienteDaOperacao = createQueryClient()
aoTrocarDeSessaoDeOperador(() => {
  clienteDaOperacao.clear()
})

/** A área que exige a sessão do operador. Sem sessão, a entrada; com a API fora, a mensagem e o "Tentar de novo". */
function Protegida({ children }: { children: ReactNode }) {
  const estado = useSyncExternalStore(assinarSessaoDeOperador, estadoDaSessaoDeOperador)
  useEffect(() => {
    if (estado === 'desconhecida') void abrirSessaoDeOperadorPeloCookie()
  }, [estado])

  if (estado === 'aberta') return children
  if (estado === 'anonima') return <Redirect to={OPERACAO_ROUTES.entrar} replace />
  return (
    <CascaPublicaDaOperacao titulo="Operação Turmma">
      {estado === 'indisponivel' ? (
        <ErroDaOperacao erro={erroDaSessaoDeOperador()} aoTentarDeNovo={() => void abrirSessaoDeOperadorPeloCookie()} />
      ) : (
        <LoadingState rotulo="Abrindo a sua sessão…" />
      )}
    </CascaPublicaDaOperacao>
  )
}

/**
 * A casca da operação com a sessão aberta, em volta de cada tela do painel: a barra de topo com o nome que o `/eu`
 * devolve, o "Sair", a navegação e o aviso de inatividade. O `/eu` e a tela carregam juntos, sem um esperar o outro no Chromebook em
 * rede lenta: enquanto o `/eu` não chega a barra fica sem nome, e se ele falhar (503) a mensagem e o "Tentar de novo"
 * ficam no alto, com a tela embaixo no lugar.
 */
function ComSessao({ children }: { children: ReactNode }) {
  const eu = useQuery(euDoOperadorQueryOptions)
  const [saindo, definirSaindo] = useState(false)
  const { avisoVisivel, continuar } = useOperatorIdleTimeout(true)
  // Quantos diálogos estão abertos: com um aberto, o aviso vai para dentro dele (`AvisoDeInatividade.tsx`).
  const [dialogosAbertos, definirDialogosAbertos] = useState(0)
  const registrarDialogo = useCallback(() => {
    definirDialogosAbertos((abertos) => abertos + 1)
    return () => definirDialogosAbertos((abertos) => abertos - 1)
  }, [])

  function sair(): void {
    if (saindo) return
    definirSaindo(true)
    void sairComoOperador().finally(() => definirSaindo(false))
  }

  const aviso: SessionWarningContextValue = { visivel: avisoVisivel, continuar, sair, registrarDialogo }
  return (
    <SessionWarningContext value={aviso}>
      <CascaDaOperacao nome={eu.data?.nome} aoSair={sair} saindo={saindo}>
        {eu.isError && <ErroDaOperacao erro={eu.error} aoTentarDeNovo={() => void eu.refetch()} tentando={eu.isFetching} />}
        {children}
        {avisoVisivel && dialogosAbertos === 0 && <AvisoDeInatividade aoContinuar={continuar} aoSair={sair} />}
      </CascaDaOperacao>
    </SessionWarningContext>
  )
}

/** As rotas da operação, relativas a `/operacao` (o `Route` aninhado em `apps/web/src/routes.tsx`). */
export default function OperacaoRoutes() {
  return (
    <QueryClientProvider client={clienteDaOperacao}>
      <Switch>
        <Route path={OPERACAO_ROUTES.convite} component={Convite} />
        <Route path={OPERACAO_ROUTES.entrar} component={Entrar} />
        <Route path={OPERACAO_ROUTES.mfa} component={Mfa} />
        <Route path={OPERACAO_ROUTES.configurarMfa} component={ConfigurarMfa} />
        <Route path={OPERACAO_ROUTES.uso}>
          <Protegida>
            <ComSessao>
              <Uso />
            </ComSessao>
          </Protegida>
        </Route>
        <Route path={OPERACAO_ROUTES.inicio}>
          <Protegida>
            <ComSessao>
              <Escolas />
            </ComSessao>
          </Protegida>
        </Route>
        <Route>
          <NaoEncontradaNaOperacao />
        </Route>
      </Switch>
    </QueryClientProvider>
  )
}

/** Endereço da operação que não existe: diz o que fazer, sem código nem status (regra 50, item 12). */
function NaoEncontradaNaOperacao() {
  useOperacaoPageTitle('Página não encontrada')
  return (
    <CascaPublicaDaOperacao titulo="Página não encontrada">
      <p className="text-apoio">
        Confira o endereço digitado ou volte à{' '}
        <Link className="text-caramelo-texto underline" to={OPERACAO_ROUTES.entrar}>
          entrada da operação
        </Link>
        .
      </p>
    </CascaPublicaDaOperacao>
  )
}
