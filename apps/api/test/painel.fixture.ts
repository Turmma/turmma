import 'reflect-metadata'
import { createLogger, type DatabasePool } from '@educa/core'
import { ESCOLAS_POR_PAGINA, MENSAGENS_DE_ERRO, type ErrorCode } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { expect } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configure-app.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './test-config.js'

/**
 * O que os testes de integração do painel da operação (A0b) têm em comum: a API montada com o log capturado, o pedido
 * com o token de operador, a conferência do erro tipado e o `desativar` segurado pelo teste.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** A espera das travas cabe folgada no prazo das consultas: o `statement_timeout` conta a espera de trava. */
export const PRAZO_DAS_CONSULTAS_MS = 15_000

/** A consulta do autor ativo, parada no `for share` (7c, "Autor ativo"). */
export const ESPERA_DO_AUTOR = '%from "operador"%for share%'

export interface Resposta {
  readonly status: number
  readonly corpo: unknown
  readonly texto: string
  readonly retryAfter: string | null
  readonly cacheControl: string | null
}

/** Um pedido à API, com o token de operador (ou sem nenhum, com `token` indefinido). */
export async function pedir(url: string, verbo: 'GET' | 'POST', caminho: string, token: string | undefined, corpo?: unknown): Promise<Resposta> {
  const resposta = await fetch(`${url}${caminho}`, {
    method: verbo,
    headers: { ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
  const texto = await resposta.text()
  return {
    status: resposta.status,
    corpo: texto === '' ? undefined : (JSON.parse(texto) as unknown),
    texto,
    retryAfter: resposta.headers.get('retry-after'),
    cacheControl: resposta.headers.get('cache-control'),
  }
}

export function esperarErro(resposta: Resposta, status: number, codigo: ErrorCode): void {
  expect(resposta.status).toBe(status)
  expect(resposta.corpo).toEqual({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: expect.stringMatching(UUID) } })
}

/**
 * A API inteira, com cada linha de log em `linhasDeLog` e o prazo das consultas folgado; um prazo curto
 * (`prazoDasConsultasMs`) é para o teste que quer o `statement_timeout` estourando numa trava segura.
 */
export async function subirApiDoPainel(linhasDeLog: string[], ambiente: Record<string, string> = {}, prazoDasConsultasMs = PRAZO_DAS_CONSULTAS_MS): Promise<{ app: INestApplication; url: string }> {
  const app = await NestFactory.create(AppModule.com(configuracaoDeTeste({ banco: { timeoutConsultaMs: prazoDasConsultasMs }, ambiente }), MONTAGEM_DE_TESTE), { logger: false })
  configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'info', destino: { write: (linha: string) => linhasDeLog.push(linha) } }))
  await app.listen(0, '127.0.0.1')
  return { app, url: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}` }
}

/**
 * O que o `desativar` do `ops:operador` faz na linha do operador, numa transação que o teste abre e segura com o
 * `for update`: `confirmar` desativa e confirma; `desfazer` desiste, se ainda não confirmou.
 */
export async function segurarODesativar(pool: DatabasePool, operadorId: string): Promise<{ confirmar: () => Promise<void>; desfazer: () => Promise<void> }> {
  const conexao = await pool.connect()
  await conexao.query('begin')
  await conexao.query('select id from operador where id = $1 for update', [operadorId])
  let terminou = false
  return {
    confirmar: async () => {
      await conexao.query(
        `update operador set nome = null, email = null, senha_hash = null, mfa_segredo_cifrado = null, mfa_chave_versao = null,
           mfa_ativado_em = null, mfa_ultimo_passo = null, desativado_em = now() where id = $1`,
        [operadorId],
      )
      await conexao.query('commit')
      terminou = true
      conexao.release()
    },
    desfazer: async () => {
      if (terminou) return
      terminou = true
      await conexao.query('rollback')
      conexao.release()
    },
  }
}

/**
 * Um nome que vem antes de todos os outros do banco de teste na ordem por nome: o número do começo diminui com o relógio,
 * e o nome de agora passa na frente dos que as execuções anteriores deixaram (o banco local guarda milhares de escolas e
 * redes). É o que põe as escolas de um teste na primeira página da lista do painel, e a rede dele nas 200 do
 * `GET /v1/operacao/redes`, sem percorrer tudo. A mesma regra do `nomeDeRedeQueVemPrimeiro` do e2e.
 */
export function nomeQueVemPrimeiro(resto: string): string {
  return `${String(9_999_999_999_999 - Date.now()).padStart(13, '0')} ${resto} ${randomUUID().slice(0, 8)}`
}

/** Uma página da lista ou do uso do painel, como a API a devolve. */
export interface PaginaDoPainel<Item> {
  readonly itens: readonly Item[]
  readonly pagina: number
  readonly total: number
}

/**
 * Percorre a lista ou o uso do painel página a página, da 1 até a última, e mais uma depois dela, conferindo em cada uma
 * o número, o total (o mesmo em todas) e o tamanho (25, e o resto na última; nenhuma na seguinte). Devolve os itens na
 * ordem em que vieram, e o total. O banco de teste tem as escolas dos outros arquivos: quem chama procura as suas.
 */
export async function todasAsPaginas<Item>(buscar: (pagina: number) => Promise<PaginaDoPainel<Item>>): Promise<{ itens: Item[]; total: number; paginas: PaginaDoPainel<Item>[] }> {
  const primeira = await buscar(1)
  const { total } = primeira
  const ultima = Math.max(1, Math.ceil(total / ESCOLAS_POR_PAGINA))
  const paginas = [primeira]
  for (let numero = 2; numero <= ultima; numero++) paginas.push(await buscar(numero))
  const depois = await buscar(ultima + 1)
  for (const [posicao, pagina] of paginas.entries()) {
    expect(pagina.pagina).toBe(posicao + 1)
    expect(pagina.total).toBe(total)
    expect(pagina.itens).toHaveLength(posicao + 1 < ultima ? ESCOLAS_POR_PAGINA : total - ESCOLAS_POR_PAGINA * (ultima - 1))
  }
  expect([depois.itens, depois.pagina, depois.total]).toEqual([[], ultima + 1, total])
  return { itens: paginas.flatMap((pagina) => pagina.itens), total, paginas }
}
