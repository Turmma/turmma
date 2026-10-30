import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import type { criarEscola, criarRede } from '../../apps/api/src/operacao/escola/escola.ts'
import type { criarSessoesSinteticas, emissorDeTokenSintetico } from '../../apps/api/src/sessao/tenant/sessoes-sinteticas.ts'
import type { createDatabase, createPool } from '@educa/nucleo'
import { raizRepositorio } from '../../tools/ci/executar.ts'

/**
 * Ensaio dos alertas locais (Tech Spec, seção 5; runbook, "Ensaiar os alertas"):
 *
 *   npm run ensaio:alertas
 *
 * Com o ambiente local de pé, provoca as condições ao mesmo tempo e confere pela API do Grafana que as regras de
 * `REGRAS_DO_ENSAIO` chegam a disparadas:
 *   - para o `worker-interativo` e manda um job interativo, que fica esperando;
 *   - para o Redis de cache, e a API passa a limitar com o seguro em memória;
 *   - força 5xx em `POST /v1/sistema/jobs-sinteticos`, com um gatilho temporário no banco que recusa a
 *     gravação só da escola sintética do ensaio, e manda requisição a ela a cada segundo;
 *   - recria as APIs com o hash lento (`HASH_LENTO_DO_ENSAIO`) e manda logins em laço, com matrículas que não existem,
 *     ao endereço de uma escola sintética, até o semáforo do hash passar do prazo: o p95 do login passa de 1 s ("Login
 *     lento"), os 503 passam de 1% ("Login recusado pelo semáforo") e as falhas do IP do ensaio naquela escola passam
 *     do limiar, e ela fica rebaixada ("Login rebaixado numa escola");
 *   - manda, em paralelo, logins por e-mail sem conta, acima do limite por IP da rota ("Login por e-mail acima do
 *     limite por IP");
 *   - tenta códigos da turma que não existem no endereço de outra escola sintética, sem parar, até passar do teto de
 *     códigos errados dela e seguir acima dele ("Código da turma errado em massa numa escola", A1, tarefa 9.0).
 * No fim, com sucesso ou não, restaura tudo: remove o gatilho, religa o Redis de cache e os workers, recria as APIs
 * com o ambiente de sempre, e espera as regras voltarem a normal.
 *
 * Só roda com `AMBIENTE=local`: ele para serviço e faz a API falhar de propósito.
 */

export const REGRAS_DO_ENSAIO = {
  jobInterativo: 'educa-job-interativo-esperando',
  seguroDoLimite: 'educa-seguro-limite-ativo',
  taxa5xx: 'educa-taxa-5xx',
  loginLento: 'educa-login-lento',
  loginHashRecusado: 'educa-login-hash-recusado',
  loginRebaixado: 'educa-login-rebaixado-por-escola',
  loginEmailLimiteIp: 'educa-login-email-limite-ip',
  salaCodigoErrado: 'educa-sala-codigo-errado-por-escola',
} as const

export type UidDaRegra = (typeof REGRAS_DO_ENSAIO)[keyof typeof REGRAS_DO_ENSAIO]

/**
 * Todas as regras de `infra/grafana/alertas/`: as que o ensaio provoca e as que têm prova própria no teste de
 * alertas (`infra/test/alertas.int.test.ts`), como o reuso de refresh, que precisa de sessões renovadas e não de
 * serviço parado, e o expurgo incompleto (F3, tarefa 3.0), que precisa de duas noites gravadas em `expurgo_execucao`
 * (`infra/test/alerta-do-expurgo.int.test.ts`), e o incidente sem confirmação em 24 h (F3, tarefa 9.0), que precisa de seções gravadas em
 * `incidente_escola` (`infra/test/alerta-do-incidente.int.test.ts`), e o arquivo do titular em preparação há mais de 2 h (F3, tarefa
 * 13.0), que precisa de pedidos gravados em `pedido_titular` (`infra/test/alerta-do-arquivo.int.test.ts`) e o da eliminação vencida da 15.0 (`infra/test/alerta-da-eliminacao.int.test.ts`).
 */
export const REGRAS_PROVISIONADAS = {
  ...REGRAS_DO_ENSAIO,
  reusoDeRefresh: 'educa-reuso-de-refresh',
  expurgoIncompleto: 'educa-expurgo-noites-incompletas',
  incidenteSemConfirmacao: 'educa-incidente-sem-confirmacao',
  arquivoEmPreparacao: 'educa-arquivo-em-preparacao',
  eliminacaoVencida: 'educa-eliminacao-vencida',
  jobFalhouDeVez: 'educa-job-falhou-de-vez',
} as const

export const WORKERS_INTERATIVOS = ['worker-interativo-1', 'worker-interativo-2'] as const
/**
 * O hash lento com que o ensaio recria as APIs para provocar os alertas de login: um hash por vez e o argon2 dezesseis
 * vezes mais caro que o mínimo da OWASP (centenas de milissegundos por hash). Uma dúzia de logins esperando por API já
 * passa do prazo de 2 s do semáforo, com uma CPU só ocupada, e abaixo do limite anônimo por IP.
 */
export const HASH_LENTO_DO_ENSAIO = { LOGIN_HASH_CONCORRENCIA: '1', LOGIN_ARGON2_ITERACOES: '32' } as const
/** Logins em laço, ao mesmo tempo, durante o ensaio: cada um repete assim que o anterior responde. */
const LOGINS_SIMULTANEOS_DO_ENSAIO = 24
/**
 * Logins por e-mail em laço, cada um com uma pausa depois da resposta: juntos passam de 60 por minuto do IP do ensaio
 * (o limite da rota) mesmo quando cada resposta leva os 2 s do 503, e passam de 20 rebaixadas por minuto; e, com a
 * pausa, não tiram do balde da escola a vez que as falhas dela precisam para passar do limiar.
 */
const LOGINS_POR_EMAIL_DO_ENSAIO = 10
const PAUSA_ENTRE_LOGINS_POR_EMAIL_MS = 3_000
/**
 * Tentativas de código da turma em laço, cada uma com uma pausa depois da resposta. Abaixo do teto da escola (1.000 em
 * 10 min) a resposta é imediata, e o teto chega em uns 90 s; acima dele cada busca espera 1 s, e as seguradas passam de
 * 300 por minuto, muito acima do limiar de 10 da regra, até ela disparar, antes de a janela de 10 min da escola virar. No
 * pico, uns 700 por minuto do IP do ensaio: abaixo do limite anônimo por IP, também dividido pelas instâncias com o Redis
 * de cache parado.
 */
export const TENTATIVAS_DE_CODIGO_SIMULTANEAS = 12
const PAUSA_ENTRE_CODIGOS_MS = 1_000
/** O alfabeto do código da turma (Tech Spec da A1, seção 3): o ensaio tenta códigos no formato, que não existem. */
const ALFABETO_DO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Um código da turma sorteado, no formato de 8 caracteres: numa escola sem acesso nenhum, sempre errado. */
export function codigoSorteado(): string {
  return Array.from(randomBytes(8), (byte) => ALFABETO_DO_CODIGO[byte % ALFABETO_DO_CODIGO.length]).join('')
}

/** Rota template onde o ensaio força o 5xx, como aparece no rótulo `http_route`. */
export const ROTA_DA_FALHA = '/v1/sistema/jobs-sinteticos'
/**
 * Nome do gatilho e da função temporários: fixo, para um ensaio interrompido ser limpo pelo seguinte. Por isso
 * dois ensaios ao mesmo tempo no mesmo banco atrapalham um ao outro (runbook, "Ensaiar os alertas").
 */
export const GATILHO_DA_FALHA = 'ensaio_alerta_falha_forcada'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const USUARIOS_POR_ESCOLA = 10
/** Quem a auditoria das escolas sintéticas do ensaio registra como operador. */
const OPERADOR_DO_ENSAIO = 'ensaio-alertas'

export type EstadoDoAlerta = 'normal' | 'pendente' | 'disparado' | 'erro'

export interface AlertaNoGrafana {
  estado: EstadoDoAlerta
  rotulos: Record<string, string>
  /**
   * Desde quando o alerta está no estado atual, em ms (o `activeAt` do Grafana): o início da pendência enquanto
   * pendente, e o do disparo depois de disparado. `undefined` se normal.
   */
  desdeMs: number | undefined
}

export interface RegraNoGrafana {
  uid: string
  titulo: string
  /** Estado da regra: `inactive`, `pending` ou `firing`. */
  estado: string
  /** O `for:` da regra, em segundos. */
  duracaoS: number
  alertas: AlertaNoGrafana[]
}

export interface ResultadoDeComando {
  codigo: number
  saida: string
}

/** Uma escola do ensaio com as sessões dela: cada item dá um token novo da sua sessão a cada chamada. */
export interface EscolaDoEnsaio {
  escolaId: string
  /** O endereço da escola: os logins por matrícula do ensaio vão a ele. */
  slug: string
  tokens: Array<() => Promise<string>>
}

/**
 * Cria uma escola com `quantidade` sessões reais: a API só aceita token de sessão gravada. O token de acesso vale
 * 10 min, e o ensaio passa disso: por isso cada pedido pede um token novo.
 */
export type CriarEscolaComSessoes = (quantidade: number) => Promise<EscolaDoEnsaio>

export interface OpcoesDoEnsaio {
  /** `docker compose` já com projeto e arquivos: recebe só o subcomando. */
  compose: (...argumentos: string[]) => Promise<ResultadoDeComando>
  /** O mesmo `docker compose`, com variáveis que sobrepõem as do arquivo de ambiente (o hash lento das APIs). */
  composeCom: (sobreposicao: Readonly<Record<string, string>>, ...argumentos: string[]) => Promise<ResultadoDeComando>
  /** Serviços que o ensaio sobe antes de começar; vazio sobe o ambiente inteiro. */
  servicos: readonly string[]
  /** As APIs atrás de `apiUrl`: o ensaio as recria com o hash lento e, no fim, com o ambiente de sempre. */
  apis: readonly string[]
  apiUrl: string
  grafanaUrl: string
  bancoUrl: string
  ambiente: Record<string, string | undefined>
  criarEscolaComSessoes: CriarEscolaComSessoes
  registrar?: (linha: string) => void
  sinal?: AbortSignal
  prazoParaDispararMs?: number
  prazoParaNormalizarMs?: number
}

export interface DisparoObservado {
  /** Rótulos do alerta disparado que o ensaio provocou. */
  rotulos: Record<string, string>
  /** Início da pendência, como o Grafana informou enquanto o alerta estava pendente. */
  pendenteDesdeMs: number
  /** Início do disparo, como o Grafana informou depois de disparado. */
  disparadoDesdeMs: number
  /** O `for:` da regra, em segundos. */
  duracaoS: number
}

export interface ResultadoDoEnsaio {
  escolaDoJob: string
  escolaDaFalha: string
  escolaDoSeguro: string
  jobId: string
  /** Job que outra escola gravou na rota da falha, com o gatilho valendo: a falha forçada é só da escola do ensaio. */
  jobDeOutraEscolaNaFalha: string
  /** A escola cujo endereço recebeu os logins do ensaio, e que fica rebaixada para o IP dele. */
  escolaDoLogin: string
  disparos: Record<UidDaRegra, DisparoObservado>
  normalizadoEmMs: number
  /** Status das requisições à rota da falha, contados durante o ensaio. */
  statusDaFalha: Record<string, number>
  /** Status dos logins por matrícula que o ensaio mandou para lotar o semáforo do hash. */
  statusDoLogin: Record<string, number>
  /** Status dos logins por e-mail que o ensaio mandou acima do limite por IP. */
  statusDoEmail: Record<string, number>
  /** A escola cujo endereço recebeu os códigos da turma errados. */
  escolaDaSala: string
  /** Status das tentativas de código da turma: todas `NAO_ENCONTRADO`, sem 429 nem 5xx. */
  statusDaSala: Record<string, number>
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '')
const registro = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : {})
const lista = (valor: unknown): unknown[] => (Array.isArray(valor) ? valor : [])

/** `Normal`, `Normal (NoData)`, `Pending`, `Alerting`, `Alerting (NoData)`, `Error`: o estado que importa ao ensaio. */
export function estadoDoAlerta(estado: string): EstadoDoAlerta {
  if (estado.startsWith('Alerting')) return 'disparado'
  if (estado.startsWith('Pending')) return 'pendente'
  if (estado.startsWith('Error')) return 'erro'
  if (estado.startsWith('Normal')) return 'normal'
  // Estado que o ensaio não conhece não pode passar por normal: "voltou a normal" seria verdade por construção.
  throw new Error(`estado de alerta desconhecido no Grafana: ${estado || 'vazio'}`)
}

/** As regras da resposta de `/api/prometheus/grafana/api/v1/rules`, por uid. */
export function regrasDaResposta(corpo: unknown): Map<string, RegraNoGrafana> {
  const regras = new Map<string, RegraNoGrafana>()
  for (const grupo of lista(registro(registro(corpo)['data'])['groups'])) {
    for (const bruta of lista(registro(grupo)['rules'])) {
      const regra = registro(bruta)
      const uid = texto(regra['uid'])
      if (uid === '') continue
      regras.set(uid, {
        uid,
        titulo: texto(regra['name']),
        estado: texto(regra['state']),
        duracaoS: typeof regra['duration'] === 'number' ? regra['duration'] : 0,
        alertas: lista(regra['alerts']).map((alertaBruto) => {
          const alerta = registro(alertaBruto)
          const estado = estadoDoAlerta(texto(alerta['state']))
          const ativoDesde = Date.parse(texto(alerta['activeAt']))
          const rotulos = Object.fromEntries(Object.entries(registro(alerta['labels'])).map(([chave, valor]) => [chave, texto(valor)]))
          return { estado, rotulos, desdeMs: estado === 'normal' || Number.isNaN(ativoDesde) ? undefined : ativoDesde }
        }),
      })
    }
  }
  return regras
}

export async function lerRegrasNoGrafana(grafanaUrl: string): Promise<Map<string, RegraNoGrafana>> {
  const resposta = await fetch(`${grafanaUrl}/api/prometheus/grafana/api/v1/rules`, { signal: AbortSignal.timeout(5_000) })
  if (!resposta.ok) throw new Error(`Grafana respondeu ${resposta.status} ao listar as regras de alerta`)
  return regrasDaResposta(await resposta.json())
}

/** O alerta de uma regra cujos rótulos contêm todos os `rotulos` pedidos. */
export function alertaCom(regra: RegraNoGrafana | undefined, rotulos: Record<string, string>): AlertaNoGrafana | undefined {
  return regra?.alertas.find((alerta) => Object.entries(rotulos).every(([chave, valor]) => alerta.rotulos[chave] === valor))
}

export async function criarJobSintetico(apiUrl: string, token: string, pedido: { fila: string; cpuMs: number }): Promise<Response> {
  return fetch(`${apiUrl}/v1/sistema/jobs-sinteticos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...pedido, naoUrgente: false }),
    signal: AbortSignal.timeout(10_000),
  })
}

/** Sobe os serviços pedidos (ou o ambiente inteiro) e espera o healthcheck de cada um. */
async function subir(opcoes: OpcoesDoEnsaio, servicos: readonly string[]): Promise<void> {
  const resultado = await opcoes.compose('up', '--detach', '--wait', ...servicos)
  if (resultado.codigo !== 0) throw new Error(`docker compose up ${servicos.join(' ')} falhou:\n${resultado.saida}`)
}

async function comandoOuFalha(opcoes: OpcoesDoEnsaio, ...argumentos: string[]): Promise<void> {
  const resultado = await opcoes.compose(...argumentos)
  if (resultado.codigo !== 0) throw new Error(`docker compose ${argumentos.join(' ')} falhou:\n${resultado.saida}`)
}

/** Repete `verificar` até devolver algo diferente de `undefined`, ou estoura o prazo. */
async function aguardar<T>(descricao: string, prazoMs: number, sinal: AbortSignal | undefined, verificar: () => Promise<T | undefined>): Promise<T> {
  const limite = Date.now() + prazoMs
  let ultimoErro: unknown
  while (Date.now() < limite) {
    sinal?.throwIfAborted()
    try {
      const valor = await verificar()
      if (valor !== undefined) return valor
    } catch (erro) {
      ultimoErro = erro
    }
    await esperar(2_000, undefined, sinal === undefined ? {} : { signal: sinal })
  }
  throw new Error(`${descricao}: prazo de ${Math.round(prazoMs / 1_000)} s esgotado${ultimoErro instanceof Error ? ` (${ultimoErro.message})` : ''}`)
}

async function comBanco<T>(bancoUrl: string, usar: (cliente: pg.Client) => Promise<T>): Promise<T> {
  const cliente = new pg.Client({ connectionString: bancoUrl, connectionTimeoutMillis: 5_000 })
  await cliente.connect()
  try {
    return await usar(cliente)
  } finally {
    await cliente.end()
  }
}

/** Cria o gatilho que recusa a gravação de job da escola do ensaio, e só dela: as outras escolas seguem. */
export async function criarGatilhoDaFalha(bancoUrl: string, escolaId: string): Promise<void> {
  // DDL não aceita parâmetro: o id entra no texto, e só depois de conferido como UUID.
  if (!UUID.test(escolaId)) throw new Error('escola do ensaio precisa ser um UUID')
  await comBanco(bancoUrl, async (cliente) => {
    await cliente.query('begin')
    await cliente.query(`drop trigger if exists ${GATILHO_DA_FALHA} on job_registro`)
    await cliente.query(`create or replace function ${GATILHO_DA_FALHA}() returns trigger language plpgsql as $$ begin raise exception 'ensaio de alerta: falha forcada'; end $$`)
    await cliente.query(`create trigger ${GATILHO_DA_FALHA} before insert on job_registro for each row when (new.escola_id = '${escolaId}'::uuid) execute function ${GATILHO_DA_FALHA}()`)
    await cliente.query('commit')
  })
}

export async function removerGatilhoDaFalha(bancoUrl: string): Promise<void> {
  await comBanco(bancoUrl, async (cliente) => {
    await cliente.query(`drop trigger if exists ${GATILHO_DA_FALHA} on job_registro`)
    await cliente.query(`drop function if exists ${GATILHO_DA_FALHA}()`)
  })
}

export async function gatilhoDaFalhaExiste(bancoUrl: string): Promise<boolean> {
  return comBanco(bancoUrl, async (cliente) => {
    const { rows } = await cliente.query<{ existe: boolean }>('select exists (select 1 from pg_trigger where tgname = $1) or exists (select 1 from pg_proc where proname = $1) as existe', [GATILHO_DA_FALHA])
    return rows[0]?.existe === true
  })
}

/** O token da vez, de um usuário por volta: nenhum passa do próprio limite. */
function tokenDaVez(escola: EscolaDoEnsaio, volta: number): Promise<string> {
  const gerar = escola.tokens[volta % escola.tokens.length]
  return gerar === undefined ? Promise.resolve('') : gerar()
}

/**
 * Tráfego enquanto as condições valem: a cada segundo, um `POST` da escola da falha (que o gatilho recusa)
 * e uma leitura de contexto de outra escola (que o seguro limita). Usuários alternados, para nenhum passar
 * do próprio limite com o seguro dividindo o limite pelas instâncias.
 */
function iniciarTrafego(opcoes: OpcoesDoEnsaio, daFalha: EscolaDoEnsaio, doSeguro: EscolaDoEnsaio, statusDaFalha: Record<string, number>): { parar: () => Promise<void> } {
  let ativo = true
  const laco = (async () => {
    for (let volta = 0; ativo; volta++) {
      const inicio = Date.now()
      try {
        const falha = await criarJobSintetico(opcoes.apiUrl, await tokenDaVez(daFalha, volta), { fila: 'normal', cpuMs: 0 })
        statusDaFalha[String(falha.status)] = (statusDaFalha[String(falha.status)] ?? 0) + 1
        await falha.body?.cancel()
        const contexto = await fetch(`${opcoes.apiUrl}/v1/sistema/contexto`, { headers: { Authorization: `Bearer ${await tokenDaVez(doSeguro, volta)}` }, signal: AbortSignal.timeout(5_000) })
        await contexto.body?.cancel()
      } catch {
        statusDaFalha['sem_resposta'] = (statusDaFalha['sem_resposta'] ?? 0) + 1
      }
      await esperar(Math.max(0, 1_000 - (Date.now() - inicio)))
    }
  })()
  return {
    parar: async () => {
      ativo = false
      await laco
    },
  }
}

/**
 * Logins por matrícula no endereço da escola do login, em laço, enquanto as condições valem: com o hash lento, a fila do
 * semáforo passa do prazo, os logins saem com 503 depois de 2 s, e o p95 passa de 1 s. Cada pedido leva uma matrícula
 * que não existe: nenhuma conta chega a ser segurada, e as falhas do IP do ensaio naquela escola passam do limiar de
 * 100 por minuto, e ela fica rebaixada. Nenhum pedido é recusado com 429 por isso.
 */
function iniciarRajadaDeLogin(opcoes: OpcoesDoEnsaio, slug: string, statusDoLogin: Record<string, number>): { parar: () => Promise<void> } {
  let ativo = true
  const lacos = Array.from({ length: LOGINS_SIMULTANEOS_DO_ENSAIO }, async () => {
    while (ativo) {
      try {
        const resposta = await fetch(`${opcoes.apiUrl}/v1/sessao/matricula`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, matricula: `ENSAIO${randomUUID().slice(0, 8)}`, senha: 'senha-sintetica-do-ensaio' }),
          signal: AbortSignal.timeout(15_000),
        })
        statusDoLogin[String(resposta.status)] = (statusDoLogin[String(resposta.status)] ?? 0) + 1
        await resposta.body?.cancel()
      } catch {
        statusDoLogin['sem_resposta'] = (statusDoLogin['sem_resposta'] ?? 0) + 1
        await esperar(1_000)
      }
    }
  })
  return {
    parar: async () => {
      ativo = false
      await Promise.all(lacos)
    },
  }
}

/**
 * Logins por e-mail sem conta, em laço, com pausa entre um e outro: o IP do ensaio passa do limite por minuto da rota, e
 * as tentativas acima dele vão para o fim do balde da equipe, sem recusa.
 */
function iniciarRajadaDeEmail(opcoes: OpcoesDoEnsaio, statusDoEmail: Record<string, number>): { parar: () => Promise<void> } {
  let ativo = true
  const lacos = Array.from({ length: LOGINS_POR_EMAIL_DO_ENSAIO }, async () => {
    while (ativo) {
      try {
        const resposta = await fetch(`${opcoes.apiUrl}/v1/sessao/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `ensaio-${randomUUID()}@escola.invalid`, senha: 'senha-sintetica-do-ensaio' }),
          signal: AbortSignal.timeout(15_000),
        })
        statusDoEmail[String(resposta.status)] = (statusDoEmail[String(resposta.status)] ?? 0) + 1
        await resposta.body?.cancel()
      } catch {
        statusDoEmail['sem_resposta'] = (statusDoEmail['sem_resposta'] ?? 0) + 1
      }
      await esperar(PAUSA_ENTRE_LOGINS_POR_EMAIL_MS)
    }
  })
  return {
    parar: async () => {
      ativo = false
      await Promise.all(lacos)
    },
  }
}

/**
 * Códigos da turma errados, em laço, no endereço da escola da sala (`POST /v1/salas/abrir`, sem login): passam do teto de
 * códigos errados da escola e seguem acima dele, e cada tentativa acima do teto soma em `sala.limite_atingido{tipo="escola"}`.
 * Nenhuma é recusada: a busca só espera 1 s.
 */
export function iniciarAtaqueDeCodigo(apiUrl: string, slug: string, statusDaSala: Record<string, number>, simultaneas = TENTATIVAS_DE_CODIGO_SIMULTANEAS, pausaMs = PAUSA_ENTRE_CODIGOS_MS): { parar: () => Promise<void> } {
  let ativo = true
  const lacos = Array.from({ length: simultaneas }, async () => {
    while (ativo) {
      try {
        const resposta = await fetch(`${apiUrl}/v1/salas/abrir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, codigo: codigoSorteado() }),
          signal: AbortSignal.timeout(15_000),
        })
        statusDaSala[String(resposta.status)] = (statusDaSala[String(resposta.status)] ?? 0) + 1
        await resposta.body?.cancel()
      } catch {
        statusDaSala['sem_resposta'] = (statusDaSala['sem_resposta'] ?? 0) + 1
      }
      await esperar(pausaMs)
    }
  })
  return {
    parar: async () => {
      ativo = false
      await Promise.all(lacos)
    },
  }
}

/** Recria as APIs, com a sobreposição (o hash lento) ou sem ela (o ambiente de sempre), e espera o healthcheck. */
async function recriarApis(opcoes: OpcoesDoEnsaio, sobreposicao: Readonly<Record<string, string>>): Promise<void> {
  const resultado = await opcoes.composeCom(sobreposicao, 'up', '--detach', '--wait', '--force-recreate', '--no-deps', ...opcoes.apis)
  if (resultado.codigo !== 0) throw new Error(`docker compose up --force-recreate ${opcoes.apis.join(' ')} falhou:\n${resultado.saida}`)
}

function descreverEstados(regras: Map<string, RegraNoGrafana>): string {
  return Object.values(REGRAS_DO_ENSAIO)
    .map((uid) => `${regras.get(uid)?.titulo ?? uid}: ${regras.get(uid)?.estado ?? 'ausente'}`)
    .join(' | ')
}

/** Nenhum alerta das regras do ensaio pendente, disparado ou em erro. */
function todasNormais(regras: Map<string, RegraNoGrafana>): boolean {
  return Object.values(REGRAS_DO_ENSAIO).every((uid) => {
    const regra = regras.get(uid)
    return regra !== undefined && regra.alertas.every((alerta) => alerta.estado === 'normal')
  })
}

export async function executarEnsaioDeAlertas(opcoes: OpcoesDoEnsaio): Promise<ResultadoDoEnsaio> {
  if (opcoes.ambiente['AMBIENTE'] !== 'local') throw new Error('o ensaio de alertas só roda com AMBIENTE=local: ele para serviço e força erro na API')
  const registrar = opcoes.registrar ?? (() => undefined)
  const prazoParaDisparar = opcoes.prazoParaDispararMs ?? 9 * 60_000
  const prazoParaNormalizar = opcoes.prazoParaNormalizarMs ?? 4 * 60_000
  const { sinal } = opcoes

  registrar('subindo os serviços do ensaio')
  await subir(opcoes, opcoes.servicos)
  // Um ensaio interrompido antes da limpeza não deixa o gatilho para este.
  await removerGatilhoDaFalha(opcoes.bancoUrl)

  await aguardar('as regras do ensaio provisionadas e normais antes de começar', prazoParaNormalizar, sinal, async () => {
    const regras = await lerRegrasNoGrafana(opcoes.grafanaUrl)
    registrar(`antes: ${descreverEstados(regras)}`)
    return todasNormais(regras) ? regras : undefined
  })

  const doJob = await opcoes.criarEscolaComSessoes(1)
  const daFalha = await opcoes.criarEscolaComSessoes(USUARIOS_POR_ESCOLA)
  const doSeguro = await opcoes.criarEscolaComSessoes(USUARIOS_POR_ESCOLA)
  const doLogin = await opcoes.criarEscolaComSessoes(1)
  const daSala = await opcoes.criarEscolaComSessoes(1)
  const [escolaDoJob, escolaDaFalha, escolaDoSeguro, escolaDoLogin, escolaDaSala] = [doJob.escolaId, daFalha.escolaId, doSeguro.escolaId, doLogin.escolaId, daSala.escolaId]
  const statusDaFalha: Record<string, number> = {}
  const statusDoLogin: Record<string, number> = {}
  const statusDoEmail: Record<string, number> = {}
  const statusDaSala: Record<string, number> = {}
  const disparos: Partial<Record<UidDaRegra, DisparoObservado>> = {}
  let jobId = ''
  let jobDeOutraEscolaNaFalha = ''
  let trafego: { parar: () => Promise<void> } | undefined
  let rajadaDeLogin: { parar: () => Promise<void> } | undefined
  let rajadaDeEmail: { parar: () => Promise<void> } | undefined
  let ataqueDeCodigo: { parar: () => Promise<void> } | undefined
  let hashLento = false
  let erroDoEnsaio: unknown

  try {
    registrar('recriando as APIs com o hash lento')
    hashLento = true
    await recriarApis(opcoes, HASH_LENTO_DO_ENSAIO)

    registrar('parando o worker-interativo e mandando um job interativo')
    await comandoOuFalha(opcoes, 'stop', ...WORKERS_INTERATIVOS)
    const resposta = await criarJobSintetico(opcoes.apiUrl, await tokenDaVez(doJob, 0), { fila: 'interativa', cpuMs: 0 })
    if (resposta.status !== 202) throw new Error(`o job interativo do ensaio não foi aceito (status ${resposta.status})`)
    jobId = ((await resposta.json()) as { jobId: string }).jobId

    registrar('parando o Redis de cache e forçando falha na rota sintética')
    await comandoOuFalha(opcoes, 'stop', 'redis-cache')
    await criarGatilhoDaFalha(opcoes.bancoUrl, escolaDaFalha)
    const outraEscola = await criarJobSintetico(opcoes.apiUrl, await tokenDaVez(doSeguro, 0), { fila: 'normal', cpuMs: 0 })
    if (outraEscola.status !== 202) throw new Error(`com o gatilho da falha, outra escola também não gravou job (status ${outraEscola.status})`)
    jobDeOutraEscolaNaFalha = ((await outraEscola.json()) as { jobId: string }).jobId
    trafego = iniciarTrafego(opcoes, daFalha, doSeguro, statusDaFalha)
    registrar('lotando o semáforo do hash com logins que falham numa escola, e passando do limite por IP do e-mail')
    rajadaDeLogin = iniciarRajadaDeLogin(opcoes, doLogin.slug, statusDoLogin)
    rajadaDeEmail = iniciarRajadaDeEmail(opcoes, statusDoEmail)
    registrar('tentando códigos da turma que não existem numa escola, acima do teto dela')
    ataqueDeCodigo = iniciarAtaqueDeCodigo(opcoes.apiUrl, daSala.slug, statusDaSala)

    const esperados: Record<UidDaRegra, Record<string, string>> = {
      [REGRAS_DO_ENSAIO.jobInterativo]: { fila: 'interativa', escola_id: escolaDoJob },
      [REGRAS_DO_ENSAIO.seguroDoLimite]: {},
      [REGRAS_DO_ENSAIO.taxa5xx]: { job: 'educa/api', http_route: ROTA_DA_FALHA },
      [REGRAS_DO_ENSAIO.loginLento]: {},
      [REGRAS_DO_ENSAIO.loginHashRecusado]: {},
      [REGRAS_DO_ENSAIO.loginRebaixado]: { escola_id: escolaDoLogin },
      [REGRAS_DO_ENSAIO.loginEmailLimiteIp]: {},
      [REGRAS_DO_ENSAIO.salaCodigoErrado]: {},
    }
    // A pendência de cada regra, anotada quando vista: o disparo só vale se veio depois dela e do `for:` inteiro.
    const pendencias: Partial<Record<UidDaRegra, number>> = {}
    await aguardar('as regras do ensaio disparadas', prazoParaDisparar, sinal, async () => {
      const regras = await lerRegrasNoGrafana(opcoes.grafanaUrl)
      registrar(`provocando: ${descreverEstados(regras)}`)
      for (const [uid, rotulos] of Object.entries(esperados) as Array<[UidDaRegra, Record<string, string>]>) {
        if (disparos[uid] !== undefined) continue
        const regra = regras.get(uid)
        const doEnsaio = (regra?.alertas ?? []).filter((candidato) => Object.entries(rotulos).every(([chave, valor]) => candidato.rotulos[chave] === valor))
        const pendente = doEnsaio.find((candidato) => candidato.estado === 'pendente')
        if (pendente?.desdeMs !== undefined) pendencias[uid] ??= pendente.desdeMs
        const disparado = doEnsaio.find((candidato) => candidato.estado === 'disparado')
        if (regra === undefined || disparado?.desdeMs === undefined) continue
        const pendenteDesdeMs = pendencias[uid]
        if (pendenteDesdeMs === undefined) throw new Error(`${regra.titulo} disparou sem o ensaio ter visto a regra pendente`)
        disparos[uid] = { rotulos: disparado.rotulos, pendenteDesdeMs, disparadoDesdeMs: disparado.desdeMs, duracaoS: regra.duracaoS }
        registrar(`disparou: ${regra.titulo}, ${Math.round((disparado.desdeMs - pendenteDesdeMs) / 1_000)} s depois de pendente (for: ${regra.duracaoS} s)`)
      }
      return Object.keys(disparos).length === Object.keys(esperados).length ? true : undefined
    })
  } catch (erro) {
    erroDoEnsaio = erro
  }

  // Com sucesso ou não, restaura tudo, e cada passo tenta mesmo que o anterior tenha falhado.
  registrar('restaurando: gatilho removido, Redis de cache e worker-interativo religados')
  const falhasDaRestauracao: unknown[] = []
  for (const passo of [
    () => trafego?.parar() ?? Promise.resolve(),
    () => rajadaDeLogin?.parar() ?? Promise.resolve(),
    () => rajadaDeEmail?.parar() ?? Promise.resolve(),
    () => ataqueDeCodigo?.parar() ?? Promise.resolve(),
    () => removerGatilhoDaFalha(opcoes.bancoUrl),
    () => subir(opcoes, ['redis-cache', ...WORKERS_INTERATIVOS]),
  ]) {
    try {
      await passo()
    } catch (erro) {
      falhasDaRestauracao.push(erro)
    }
  }
  const erroAntesDeNormalizar = falhasDaRestauracao.length > 0 || erroDoEnsaio !== undefined
  try {
    // As APIs com o hash lento só saem depois de as regras voltarem a normal: a instância que sai deixa no Prometheus o
    // último valor que exportou por até 5 min (a série empurrada por OTLP não fica obsoleta ao parar). Recriada com o
    // Redis de cache ainda fora nesse último valor, ela prenderia o "Seguro de limite ativo" disparado.
    if (!erroAntesDeNormalizar) {
      await aguardar('as regras do ensaio de volta a normal', prazoParaNormalizar, sinal, async () => {
        const regras = await lerRegrasNoGrafana(opcoes.grafanaUrl)
        registrar(`restaurado: ${descreverEstados(regras)}`)
        return todasNormais(regras) ? true : undefined
      })
    }
  } finally {
    if (hashLento) {
      registrar('recriando as APIs com o hash de sempre')
      try {
        await recriarApis(opcoes, {})
      } catch (erro) {
        falhasDaRestauracao.push(erro)
      }
    }
  }
  if (falhasDaRestauracao.length > 0) {
    registrar('a restauração falhou em algum passo: confira o gatilho, o Redis de cache, o worker-interativo e as APIs (docker compose up -d --force-recreate --no-deps api-1 api-2)')
    throw new AggregateError(erroDoEnsaio === undefined ? falhasDaRestauracao : [erroDoEnsaio, ...falhasDaRestauracao], 'restauração do ensaio de alertas incompleta')
  }
  if (erroDoEnsaio !== undefined) throw erroDoEnsaio
  // Com as APIs recriadas, as regras continuam normais: a instância nova sobe com o Redis de cache de pé.
  await aguardar('as regras do ensaio normais com as APIs recriadas', prazoParaNormalizar, sinal, async () => {
    const regras = await lerRegrasNoGrafana(opcoes.grafanaUrl)
    return todasNormais(regras) ? true : undefined
  })
  return {
    escolaDoJob,
    escolaDaFalha,
    escolaDoSeguro,
    jobId,
    jobDeOutraEscolaNaFalha,
    escolaDoLogin,
    disparos: disparos as Record<UidDaRegra, DisparoObservado>,
    normalizadoEmMs: Date.now(),
    statusDaFalha,
    statusDoLogin,
    statusDoEmail,
    escolaDaSala,
    statusDaSala,
  }
}

function composeDoAmbienteLocal(...argumentos: string[]): Promise<ResultadoDeComando> {
  return composeDoAmbienteLocalCom({}, ...argumentos)
}

function composeDoAmbienteLocalCom(sobreposicao: Readonly<Record<string, string>>, ...argumentos: string[]): Promise<ResultadoDeComando> {
  return new Promise((resolver) => {
    // O projeto de desenvolvimento, pelo compose.yaml da raiz, com as variáveis de .env.example; a sobreposição vence
    // na interpolação, porque a variável do processo vence a do arquivo.
    const processo = spawn('docker', ['compose', ...argumentos], { cwd: raizRepositorio, env: { ...process.env, ...sobreposicao } })
    let saida = ''
    processo.stdout.on('data', (parte: Buffer) => (saida += parte.toString()))
    processo.stderr.on('data', (parte: Buffer) => (saida += parte.toString()))
    processo.on('error', () => resolver({ codigo: 127, saida }))
    processo.on('close', (codigo) => resolver({ codigo: codigo ?? 1, saida }))
  })
}

function obrigatoria(ambiente: Record<string, string | undefined>, chave: string): string {
  const valor = ambiente[chave]
  if (valor === undefined || valor === '') throw new Error(`defina ${chave} (npm run ensaio:alertas lê .env.example)`)
  return valor
}

async function executarPelaLinhaDeComando(): Promise<void> {
  const ambiente = process.env
  const controle = new AbortController()
  // Ctrl+C interrompe a espera e ainda restaura; o segundo encerra na hora.
  process.once('SIGINT', () => controle.abort())
  const importar = <T>(caminho: string) => import(pathToFileURL(join(raizRepositorio, caminho)).href) as Promise<T>
  const nucleo = await importar<{ createDatabase: typeof createDatabase; createPool: typeof createPool }>('packages/nucleo/dist/index.js')
  const escolas = await importar<{ criarRede: typeof criarRede; criarEscola: typeof criarEscola }>('apps/api/dist/operacao/escola/escola.js')
  const sessoes = await importar<{ criarSessoesSinteticas: typeof criarSessoesSinteticas; emissorDeTokenSintetico: typeof emissorDeTokenSintetico }>('apps/api/dist/sessao/tenant/sessoes-sinteticas.js')
  const inicio = Date.now()
  const escrever = (linha: string) => process.stdout.write(`[${Math.round((Date.now() - inicio) / 1_000)} s] ${linha}\n`)
  const bancoUrl = `postgres://${obrigatoria(ambiente, 'POSTGRES_USUARIO')}:${obrigatoria(ambiente, 'POSTGRES_SENHA')}@127.0.0.1:${obrigatoria(ambiente, 'POSTGRES_PORTA_HOST')}/${obrigatoria(ambiente, 'POSTGRES_BANCO')}`
  const pool = nucleo.createPool({ url: bancoUrl, maximoConexoes: 1, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
  const banco = nucleo.createDatabase(pool)
  // Escola e sessões sintéticas do ensaio, só no ambiente local (o ensaio e o emissor recusam outro), com o ensaio
  // como operador na auditoria delas.
  const criarEscolaComSessoes: CriarEscolaComSessoes = async (quantidade) => {
    // O ensaio não é o comando nem o painel: o autor é fixo, sem conferir operador ativo.
    const autor = async () => OPERADOR_DO_ENSAIO
    const { id: redeId } = await escolas.criarRede(banco, autor, { id: randomUUID(), nome: 'Rede sintética do ensaio', tipo: 'independente' })
    const slug = `ensaio-${randomUUID()}`
    const { id: escolaId } = await escolas.criarEscola(banco, autor, { id: randomUUID(), redeId, nome: 'Escola sintética do ensaio', slug })
    const emissor = sessoes.emissorDeTokenSintetico(ambiente)
    const criadas = await sessoes.criarSessoesSinteticas(banco, ambiente, { escolaId, papel: 'coordenador', quantidade })
    return { escolaId, slug, tokens: criadas.map((criada) => async () => (await emissor.emitir({ escolaId, usuarioId: criada.usuarioId, sessaoId: criada.sessaoId })).token) }
  }
  try {
    await executarEnsaioDeAlertas({
      compose: composeDoAmbienteLocal,
      composeCom: composeDoAmbienteLocalCom,
      servicos: [],
      // Pela borda, o ensaio chega às duas APIs: as duas são recriadas com o hash lento.
      apis: ['api-1', 'api-2'],
      apiUrl: `http://127.0.0.1:${obrigatoria(ambiente, 'BORDA_PORTA_HOST')}`,
      grafanaUrl: `http://127.0.0.1:${obrigatoria(ambiente, 'GRAFANA_PORTA_HOST')}`,
      bancoUrl,
      ambiente,
      criarEscolaComSessoes,
      registrar: escrever,
      sinal: controle.signal,
    })
    escrever('ensaio concluído: as regras do ensaio dispararam e voltaram a normal')
  } catch (erro) {
    escrever(`ensaio falhou: ${erro instanceof Error ? erro.message : String(erro)}`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await executarPelaLinhaDeComando()
}
