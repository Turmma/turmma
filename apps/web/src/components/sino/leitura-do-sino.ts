/**
 * O que os dois sinos "Esperando você" (o da coordenação, X2, e o do professor, X3) dividem na leitura: o que uma consulta
 * devolve à fila e as opções que mantêm a leitura quieta. Mora em `components/` porque a tela de uma área não importa
 * módulo de outra (`areas/navigation.ts`, item 5), e as duas contas dependem das mesmas opções: copiar as quatro daria dois
 * lugares para esquecer uma (regra 80).
 */

/** O que uma consulta devolve à fila: ainda lendo, falhou, foi lida (inteira ou truncada) ou nem se aplica. */
export type LeituraDaFila<Dado> =
  | { readonly estado: 'carregando' }
  | { readonly estado: 'erro'; readonly erro: unknown }
  | { readonly estado: 'lida'; readonly dado: Dado; readonly completa: boolean }
  | { readonly estado: 'nao-se-aplica' }

/**
 * As opções de leitura da fila (Tech Spec das telas da coordenação, seção 7c, "Releitura"; a das telas do professor, seção
 * 5): cinco minutos de frescor e **nenhuma leitura por tempo, por foco ou por rede**. `materiaisQueryOptions` traz o
 * `refetchInterval` de 1,5 s da tela Material, e sem o `false` um material `processando` faria cerca de 40 leituras por
 * minuto por aba (regra 80).
 */
export const NO_AUTO_REFETCH = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const

/**
 * As opções dos observadores da fila: as de cima, mais **nenhuma releitura de consulta que já falhou só porque o sino
 * montou**. O sino é `lazy()` e chega depois da tela: se a consulta já falhou ali, a releitura da montagem a refaz sem
 * ninguém tocar, e o erro e o "Tentar de novo" da tela somem debaixo do dedo (esteira de 16/10/2026, "Tentar de novo" da
 * Estrutura no celular). Quem relê o que falhou é o "Tentar de novo" do sino ou o da tela. Consulta que ainda não existe
 * carrega normalmente: `retryOnMount` só vale para a que já está em erro.
 */
export const QUEUE_QUERY_OPTIONS = { ...NO_AUTO_REFETCH, retryOnMount: false } as const
