import { TIMEOUT_COMANDO_REDIS_FILA_MS, type DatabaseConfig } from '@educa/core'
import type { ConfiguracaoLogin } from '../src/credencial/index.js'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { lerConfiguracao, type ConfiguracaoApi } from '../src/config.js'

/** O `oidc-falso` do compose de teste, visto da máquina. */
export function urlDoOidcFalso(ambiente: Record<string, string> = lerAmbienteDeTeste()): string {
  return `http://127.0.0.1:${valorObrigatorio(ambiente, 'OIDC_FALSO_PORTA_HOST')}`
}

/**
 * A montagem da API nos testes que sobem a aplicação inteira e não provam o corte do Redis (15.5): o cliente Redis do
 * login espera até 2 s por comando, como o do despachante, em vez dos 100 ms de produção. No runner carregado da
 * esteira, uma resposta acima de 100 ms viraria reserva no seguro ou desafio recusado, e um vermelho falso. É opção de
 * montagem, e não variável de ambiente: a produção não tem como ler.
 *
 * Ela **fixa** o prazo qualquer que seja a configuração. Desde a correção
 * `2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e`, montar *sem* ela não é mais montar como produção: aí
 * quem decide é `LOGIN_REDIS_PRAZO_MS`, e o do compose de teste é o de 2 s. Quem quer provar o corte de 100 ms pela
 * aplicação montada pede o prazo na configuração, com `{ login: { prazoDoRedisMs: TIMEOUT_COMANDO_REDIS_API_MS } }`
 * (`ataque-de-senha.int.test.ts`, "falha (15.5)"); quem o prova pelo cliente monta o cliente direto com
 * `createApiRedisClient` (`limite.int.test.ts`, e o "Redis fora" e o "Redis travado" do contador e do desafio).
 */
export const MONTAGEM_DE_TESTE = { prazoDoRedisDeLoginMs: TIMEOUT_COMANDO_REDIS_FILA_MS } as const

export interface SobreposicaoDeTeste {
  banco?: Partial<DatabaseConfig>
  /**
   * O prazo do Redis do login que o teste quer, depois da leitura da configuração. O caso é o teste que prova o corte
   * de 100 ms **pela aplicação montada**: ele precisa do valor de produção sem trocar o `AMBIENTE` para `staging`, que
   * exigiria https no emissor do login pela conta da escola (o `oidc-falso` é http). Assim o prazo entra pelo mesmo
   * caminho do contêiner — `config.login.prazoDoRedisMs`, que o `SessaoModule` lê —, e trocar essa leitura por um
   * valor fixo deixa o teste vermelho. Só este campo: `Partial<ConfiguracaoLogin>` alcançaria `protecaoDesligada`, que
   * a configuração recusa em produção de propósito.
   */
  login?: Pick<ConfiguracaoLogin, 'prazoDoRedisMs'>
  /** Variáveis que trocam as de `.env.example` e as URLs do compose de teste, como `ROTAS_SINTETICAS` ou `REDIS_FILA_URL`. */
  ambiente?: Record<string, string>
}

/**
 * Configuração da API nos testes de integração, lida pelo mesmo `lerConfiguracao` do boot a partir
 * do ambiente de teste (`.env.example` e `infra/teste.env`), com o banco e o Redis de cache do
 * compose de teste. A porta não importa: o teste escuta numa porta livre.
 */
export function configuracaoDeTeste(sobreposicao: SobreposicaoDeTeste = {}): ConfiguracaoApi {
  // Espera curta da drenagem: no teste não há borda a avisar, e todo `app.close()` passa por ela.
  const ambiente = { ...lerAmbienteDeTeste(), DRENAGEM_ESPERA_BORDA_MS: '10', ...sobreposicao.ambiente }
  const usuario = valorObrigatorio(ambiente, 'POSTGRES_USUARIO')
  const senha = valorObrigatorio(ambiente, 'POSTGRES_SENHA')
  const banco = valorObrigatorio(ambiente, 'POSTGRES_BANCO')
  const porta = valorObrigatorio(ambiente, 'POSTGRES_PORTA_HOST')
  const config = lerConfiguracao({
    ...ambiente,
    API_PORTA: '3000',
    BANCO_URL: `postgres://${usuario}:${senha}@127.0.0.1:${porta}/${banco}`,
    REDIS_CACHE_URL: `redis://127.0.0.1:${valorObrigatorio(ambiente, 'REDIS_CACHE_PORTA_HOST')}`,
    REDIS_FILA_URL: `redis://127.0.0.1:${valorObrigatorio(ambiente, 'REDIS_FILA_PORTA_HOST')}`,
    // A do compose. No teste nada é exportado: a aplicação montada sem telemetria mede num medidor vazio.
    TELEMETRIA_OTLP_URL: 'http://observabilidade:4318',
    // O storage do compose de teste, visto da máquina (F3, tarefa 13.0): o mesmo endereço para falar com ele e para assinar.
    STORAGE_URL: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
    // O oidc-falso do compose de teste, visto da máquina: o emissor é o endereço que a API usa, e o ID token sai com ele.
    LOGIN_EXTERNO_GOOGLE_EMISSOR: `${urlDoOidcFalso(ambiente)}/google`,
    LOGIN_EXTERNO_MICROSOFT_EMISSOR: `${urlDoOidcFalso(ambiente)}/microsoft`,
    ...sobreposicao.ambiente,
  })
  return { ...config, banco: { ...config.banco, ...sobreposicao.banco }, login: { ...config.login, ...sobreposicao.login } }
}
