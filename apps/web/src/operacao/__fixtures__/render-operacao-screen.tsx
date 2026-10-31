import type { EscolaDoPainel, UsoDaEscolaDoPainel } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeAll, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from '../../api/query-client'
import { abrirSessaoDeOperadorPeloCookie } from '../api/sessao'

export { redeFalsa, type RedeFalsa, type RespostaFalsa } from '../../__fixtures__/render-screen'

/**
 * O que o teste de componente das telas da operação usa (telas da coordenação, 14.0). É o molde de `__fixtures__/render-screen.tsx`
 * com o que a operação tem de próprio: a **sessão do operador** (`operacao/api/sessao.ts`, que não divide nada com a da
 * escola) e o **roteador** da área, com base `/operacao`. A rede continua falsa (a API está fora da web) e o resto é o
 * código de verdade: o cliente de consultas, a sessão e as consultas do painel (`operacao/api/painel.ts`).
 */

const TOKEN_DE_TESTE = 'token-de-operador-de-teste'
/** O `Authorization` da sessão que `prepararTelaDaOperacao` abre, para o teste conferir que a tela chamou a API com ela. */
export const AUTORIZACAO_DE_OPERADOR_DE_TESTE = `Bearer ${TOKEN_DE_TESTE}`

/**
 * Abre a sessão do operador uma vez, como a aba faz ao chegar à área (o acesso fica em memória), e, depois de cada caso,
 * desmonta a tela e tira a rede falsa. Chame no corpo do arquivo, antes dos `describe`.
 */
export function prepararTelaDaOperacao(): void {
  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: TOKEN_DE_TESTE, expiraEm: new Date(Date.now() + 600_000).toISOString() }), { status: 200 })),
    )
    await abrirSessaoDeOperadorPeloCookie()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
}

/**
 * A largura da janela, para a consulta `(min-width: 768px)`, e um `ResizeObserver` que não avisa nada: o `jsdom` não tem
 * nenhum dos dois, e são API do navegador, não peça nossa. A medida de verdade é do e2e.
 */
export function janelaDe(largura: number): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta === '(min-width: 768px)' ? largura >= 768 : false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
}

export interface TelaDaOperacao extends RenderResult {
  /** Os endereços para onde a tela navegou, na ordem, com a consulta: `/operacao?pagina=2&ordem=nome`. */
  readonly navegou: readonly string[]
}

/**
 * A tela dentro do cliente de consultas da aba (um novo a cada chamada: o cache de um caso não passa ao outro) e do
 * roteador da operação, no endereço dado. `busca` é a query string de entrada, sem o `?`.
 */
export function renderizarTelaDaOperacao(tela: ReactElement, { caminho = '/', busca = '' }: { caminho?: string; busca?: string } = {}): TelaDaOperacao {
  const memoria = memoryLocation({ path: caminho, searchPath: busca, record: true })
  const resultado = render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <Router base="/operacao" hook={memoria.hook} searchHook={memoria.searchHook}>
        {tela}
      </Router>
    </QueryClientProvider>,
  )
  // Lido na hora, e não copiado: o teste pergunta depois do clique.
  return Object.defineProperty(resultado, 'navegou', { get: () => memoria.history.slice(1) }) as TelaDaOperacao
}

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`

/** Uma escola da lista do painel, com tudo em ordem; o caso muda só o que importa para ele. */
export function escolaDoPainel(n: number, extra: Partial<EscolaDoPainel> = {}): EscolaDoPainel {
  return {
    id: id(1000 + n),
    nome: `Escola Sintética ${String(n)}`,
    slug: `escola-sintetica-${String(n)}`,
    rede: { id: id(2000), nome: 'Rede Sintética' },
    estado: 'sem_convite',
    turmas: 4,
    professores: 6,
    alunos: 112,
    ...extra,
  }
}

/** O uso de uma escola no painel: o dia e o mês de referência, com as três medidas de cada um. */
export function usoDaEscolaDoPainel(n: number, extra: Partial<UsoDaEscolaDoPainel> = {}): UsoDaEscolaDoPainel {
  return {
    id: id(1000 + n),
    nome: `Escola Sintética ${String(n)}`,
    dia: { requisicoes: 1234, jobs: 12, bytesStorage: 1_288_490_189 },
    mes: { requisicoes: 56_789, jobs: 345, bytesStorage: 2048 },
    ...extra,
  }
}

/** O convite que a lista traz para refazer e revogar. */
export const CONVITE_DE_TESTE = id(3000)
