import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, Redirect, Route, Switch } from 'wouter'
import { criarClienteDeConsultas } from '../api/query-client'
import { EstadoCarregando } from '../components/states'
import { consultaEuDoOperador } from './api/eu'
import {
  abrirSessaoDeOperadorPeloCookie,
  aoTrocarDeSessaoDeOperador,
  assinarSessaoDeOperador,
  erroDaSessaoDeOperador,
  estadoDaSessaoDeOperador,
  sairComoOperador,
} from './api/sessao'
import { ROTAS_DA_OPERACAO } from './paths'
import { AvisoDeInatividade, ContextoDoAviso, type AvisoDaSessao } from './components/AvisoDeInatividade'
import { CascaDaOperacao, CascaPublicaDaOperacao, ErroDaOperacao } from './components/CascaDaOperacao'
import { useInatividadeDaOperacao } from './idle-timeout'
import { ConfigurarMfa } from './pages/ConfigurarMfa'
import { Convite } from './pages/Convite'
import { Entrar } from './pages/Entrar'
import { Mfa } from './pages/Mfa'
import { Escolas } from './pages/Escolas'
import { Uso } from './pages/Uso'
import { useTituloDaPagina } from './document-title'

/**
 * A área do operador Turmma (A0), carregada por `import()` num chunk próprio (`operacao-*.js`): a web da escola nunca
 * baixa este código (Tech Spec da A0, seção 9, B2).
 *
 * O cache de consultas é **outro**, e não o da escola: a troca de pessoa numa sessão não esvazia a outra, e nenhuma
 * consulta de uma aparece na outra. Toda sessão de operador que acaba, ou que muda de dono, esvazia o daqui inteiro.
 */
const clienteDaOperacao = criarClienteDeConsultas()
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
  if (estado === 'anonima') return <Redirect to={ROTAS_DA_OPERACAO.entrar} replace />
  return (
    <CascaPublicaDaOperacao titulo="Operação Turmma">
      {estado === 'indisponivel' ? (
        <ErroDaOperacao erro={erroDaSessaoDeOperador()} aoTentarDeNovo={() => void abrirSessaoDeOperadorPeloCookie()} />
      ) : (
        <EstadoCarregando rotulo="Abrindo a sua sessão…" />
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
  const eu = useQuery(consultaEuDoOperador)
  const [saindo, definirSaindo] = useState(false)
  const { avisoVisivel, continuar } = useInatividadeDaOperacao(true)
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

  const aviso: AvisoDaSessao = { visivel: avisoVisivel, continuar, sair, registrarDialogo }
  return (
    <ContextoDoAviso value={aviso}>
      <CascaDaOperacao nome={eu.data?.nome} aoSair={sair} saindo={saindo}>
        {eu.isError && <ErroDaOperacao erro={eu.error} aoTentarDeNovo={() => void eu.refetch()} tentando={eu.isFetching} />}
        {children}
        {avisoVisivel && dialogosAbertos === 0 && <AvisoDeInatividade aoContinuar={continuar} aoSair={sair} />}
      </CascaDaOperacao>
    </ContextoDoAviso>
  )
}

/** As rotas da operação, relativas a `/operacao` (o `Route` aninhado em `apps/web/src/routes.tsx`). */
export default function RotasDaOperacao() {
  return (
    <QueryClientProvider client={clienteDaOperacao}>
      <Switch>
        <Route path={ROTAS_DA_OPERACAO.convite} component={Convite} />
        <Route path={ROTAS_DA_OPERACAO.entrar} component={Entrar} />
        <Route path={ROTAS_DA_OPERACAO.mfa} component={Mfa} />
        <Route path={ROTAS_DA_OPERACAO.configurarMfa} component={ConfigurarMfa} />
        <Route path={ROTAS_DA_OPERACAO.uso}>
          <Protegida>
            <ComSessao>
              <Uso />
            </ComSessao>
          </Protegida>
        </Route>
        <Route path={ROTAS_DA_OPERACAO.inicio}>
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
  useTituloDaPagina('Página não encontrada')
  return (
    <CascaPublicaDaOperacao titulo="Página não encontrada">
      <p className="text-apoio">
        Confira o endereço digitado ou volte à{' '}
        <Link className="text-caramelo-texto underline" to={ROTAS_DA_OPERACAO.entrar}>
          entrada da operação
        </Link>
        .
      </p>
    </CascaPublicaDaOperacao>
  )
}
