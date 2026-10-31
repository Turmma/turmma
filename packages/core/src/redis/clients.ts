import { Redis } from 'ioredis'

/**
 * Tempo máximo de um comando no Redis da API. Passou disso, o comando falha e quem chamou segue
 * sem o Redis (no rate limit, pelo seguro em memória). Um Redis travado não pode segurar a
 * requisição do aluno.
 */
export const TIMEOUT_COMANDO_REDIS_API_MS = 100

/**
 * Cliente do Redis de cache para a API:
 *
 * - `enableOfflineQueue: false`: com o Redis fora, o comando falha na hora, em vez de esperar numa
 *   fila a reconexão com a requisição pendurada;
 * - `commandTimeout`: com o Redis travado (conectado, mas sem responder), o comando falha em
 *   `TIMEOUT_COMANDO_REDIS_API_MS`;
 * - sem `lazyConnect`: a API sobe mesmo com o Redis fora, e o ioredis reconecta sozinho quando ele
 *   volta.
 *
 * O ouvinte de erro é obrigatório: sem ele, o ioredis escreve cada tentativa de reconexão no
 * console, fora do log JSON.
 *
 * `timeoutMs` tem dois usos. O cliente do login (`api-login`) o recebe **da configuração**, em todo boot, inclusive no
 * `main.ts`: é `LOGIN_REDIS_PRAZO_MS`, 100 ms em produção e no staging (a API recusa mais que isso lá) e 2 s em
 * `local`, onde uma resposta lenta é da máquina e não do Redis. Os outros clientes da API ficam no padrão de 100 ms.
 * A montagem de teste (`prazoDoRedisDeLoginMs` do `AppModule`) o fixa por cima, para o teste não depender do ambiente.
 * Quem prova o corte de 100 ms monta o cliente direto, com o padrão, ou pede `login.prazoDoRedisMs` na configuração.
 */
export function createApiRedisClient(url: string, nome: string, aoErrar: (erro: Error) => void, timeoutMs = TIMEOUT_COMANDO_REDIS_API_MS): Redis {
  return criarClienteSemFilaOffline(url, nome, timeoutMs, aoErrar)
}

/**
 * Tempo máximo de um comando do despachante no Redis de fila (Tech Spec, seção 5, "Publicação").
 * Maior que o da API: ninguém espera na tela por ele, e um `addBulk` leva até cem jobs de uma vez.
 */
export const TIMEOUT_COMANDO_REDIS_FILA_MS = 2_000

/**
 * Cliente do Redis de fila para o despachante (publicar e consultar no BullMQ), com as mesmas
 * garantias do da API: com o Redis fora o comando falha na hora, e com ele travado falha em
 * `TIMEOUT_COMANDO_REDIS_FILA_MS`. Sem fila offline, uma publicação que falhou não é reenviada
 * sozinha quando o Redis volta: quem publica de novo é a rodada seguinte, depois de a reserva vencer.
 *
 * Não serve ao worker: o BullMQ exige fila offline e espera sem limite no comando bloqueante dele.
 */
export function createQueueRedisClient(url: string, nome: string, aoErrar: (erro: Error) => void): Redis {
  return criarClienteSemFilaOffline(url, nome, TIMEOUT_COMANDO_REDIS_FILA_MS, aoErrar)
}

function criarClienteSemFilaOffline(url: string, nome: string, timeoutMs: number, aoErrar: (erro: Error) => void): Redis {
  const cliente = new Redis(url, {
    connectionName: nome,
    enableOfflineQueue: false,
    commandTimeout: timeoutMs,
    // Sem fila offline, a tentativa por comando não se aplica; fica explícito que nada é repetido.
    maxRetriesPerRequest: 0,
    // Reconexão com recuo curto e teto de 2 s: o Redis que volta é usado de novo em segundos.
    retryStrategy: (tentativa) => Math.min(tentativa * 100, 2_000),
  })
  cliente.on('error', aoErrar)
  return cliente
}
