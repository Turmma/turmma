import 'reflect-metadata'
import { AuditoriaRejectedError, AuditoriaRepository, createDatabase, createLogger, createPool, runInContext, type Database, type DatabasePool } from '@educa/core'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { criarEscola, criarRede } from '../src/operacao/escola/escola.js'
import { abrirBancoDeOperacao, executarOpsEscola, type BancoDoComando } from '../src/ops/escola.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'

/** O autor dos casos de uso chamados direto, sem o comando: fixo, sem conferir operador ativo. */
const autorFixo = (apelido: string) => async (): Promise<string> => apelido

// O comando sorteia o id (v4); o painel manda o que a web sorteou (v4 ou v7).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

interface Execucao {
  codigo: number
  saida: string
  erro: string
}

async function rodar(argumentos: string[], ambiente: Record<string, string | undefined>, abrirBanco?: (ambiente: Record<string, string | undefined>) => BancoDoComando): Promise<Execucao> {
  let saida = ''
  let erro = ''
  const terminal = { saida: (texto: string) => (saida += texto), erro: (texto: string) => (erro += texto) }
  const codigo = await executarOpsEscola(argumentos, ambiente, terminal, abrirBanco)
  return { codigo, saida, erro }
}

describe('npm run ops:escola: rede e escola nascem só por comando do operador', () => {
  const ambiente = { ...lerAmbienteDeTeste(), OPERADOR: 'operador-teste' }
  const sufixo = randomUUID().slice(0, 8)
  const slug = `colegio-sintetico-${sufixo}`
  const redes: string[] = []
  const escolas: string[] = []
  let pool: DatabasePool
  let banco: Database

  beforeAll(() => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 2, timeoutConexaoMs: 2_000, timeoutConsultaMs: 2_000 }, () => undefined)
    banco = createDatabase(pool)
  })

  afterAll(async () => {
    await pool.query('delete from auditoria where escola_id = any($1::uuid[]) or entidade_id = any($2::uuid[])', [escolas, redes])
    await pool.query('delete from escola where id = any($1::uuid[])', [escolas])
    await pool.query('delete from rede where id = any($1::uuid[])', [redes])
    await pool.end()
  })

  it('caminho feliz: cria rede e escola, grava as duas auditorias com o operador, e a saída tem só os ids', async () => {
    const rede = await rodar(['rede', 'criar', '--nome', 'Rede Sintética de Joinville', '--tipo', 'prefeitura'], ambiente)
    expect(rede).toMatchObject({ codigo: 0, erro: '' })
    const { redeId } = JSON.parse(rede.saida) as { redeId: string }
    expect(Object.keys(JSON.parse(rede.saida) as object)).toEqual(['redeId'])
    expect(redeId).toMatch(UUID)
    redes.push(redeId)

    const antes = (await pool.query<{ t: Date }>('select clock_timestamp() as t')).rows[0]?.t
    const escola = await rodar(['escola', 'criar', '--rede', redeId, '--nome', 'Colégio Sintético Horizonte', '--slug', slug], ambiente)
    const depois = (await pool.query<{ t: Date }>('select clock_timestamp() as t')).rows[0]?.t
    expect(escola).toMatchObject({ codigo: 0, erro: '' })
    const resposta = JSON.parse(escola.saida) as { escolaId: string }
    expect(Object.keys(resposta)).toEqual(['escolaId'])
    expect(resposta.escolaId).toMatch(UUID)
    escolas.push(resposta.escolaId)
    // Nem o nome nem o slug voltam na saída.
    expect(`${rede.saida}${escola.saida}`).not.toMatch(/Sintética|Sintético|colegio/)

    const { rows: criadas } = await pool.query('select rede_id, nome, slug, inatividade_aluno_min, inatividade_equipe_min from escola where id = $1', [resposta.escolaId])
    expect(criadas).toEqual([{ rede_id: redeId, nome: 'Colégio Sintético Horizonte', slug, inatividade_aluno_min: 30, inatividade_equipe_min: 120 }])

    // A vigência de um suboperador de "todas" nunca é anterior à escola (F3, correção da 8.0): `criada_em` é preenchida pelo banco,
    // sem o código informar, e é o instante da transação que cria a escola, o mesmo da auditoria `escola.criada`.
    const { rows: instante } = await pool.query<{ criada_em: Date; igual_ao_da_auditoria: boolean }>(
      `select e.criada_em, e.criada_em = (select min(a.em) from auditoria a where a.escola_id = e.id and a.acao = 'escola.criada') as igual_ao_da_auditoria from escola e where e.id = $1`,
      [resposta.escolaId],
    )
    expect(instante[0]?.igual_ao_da_auditoria).toBe(true)
    expect(instante[0]?.criada_em.getTime()).toBeGreaterThanOrEqual(antes?.getTime() ?? Number.POSITIVE_INFINITY)
    expect(instante[0]?.criada_em.getTime()).toBeLessThanOrEqual(depois?.getTime() ?? Number.NEGATIVE_INFINITY)

    const { rows: registroDaRede } = await pool.query('select escola_id, autor_operador, autor_usuario_id, acao, entidade, antes, depois from auditoria where entidade_id = $1', [redeId])
    expect(registroDaRede).toEqual([
      { escola_id: null, autor_operador: 'operador-teste', autor_usuario_id: null, acao: 'rede.criada', entidade: 'rede', antes: null, depois: { tipo: 'prefeitura' } },
    ])

    // O registro da escola é da própria escola: aparece na listagem com o contexto dela.
    const daEscola = await runInContext({ requisicaoId: randomUUID(), escolaId: resposta.escolaId }, () => new AuditoriaRepository(banco).listarDaEscola())
    expect(daEscola).toEqual([
      expect.objectContaining({
        escolaId: resposta.escolaId,
        autorOperador: 'operador-teste',
        autorUsuarioId: null,
        acao: 'escola.criada',
        entidade: 'escola',
        entidadeId: resposta.escolaId,
        antes: null,
        depois: { redeId },
      }),
    ])
  })

  it('borda: o mesmo slug de novo sai com CONFLITO, sem o slug na mensagem, e não cria nada nem audita', async () => {
    const { id: redeId } = await criarRede(banco, autorFixo('operador-teste'), { id: randomUUID(), nome: 'Rede Sintética do Conflito', tipo: 'grupo' })
    redes.push(redeId)
    escolas.push((await criarEscola(banco, autorFixo('operador-teste'), { id: randomUUID(), redeId, nome: 'Colégio Sintético Original', slug: `conflito-${sufixo}` })).id)
    const { rows: antes } = await pool.query<{ total: string }>(`select count(*) as total from auditoria where acao = 'escola.criada'`)

    const repetida = await rodar(['escola', 'criar', '--rede', redeId, '--nome', 'Outro Colégio Sintético', '--slug', `conflito-${sufixo}`], ambiente)
    expect(repetida.codigo).toBe(1)
    expect(repetida.saida).toBe('')
    expect(repetida.erro).toMatch(/^CONFLITO: /)
    expect(repetida.erro).not.toContain(`conflito-${sufixo}`)
    expect(repetida.erro).not.toContain('Outro Colégio')

    const { rows: depois } = await pool.query<{ total: string }>(`select count(*) as total from auditoria where acao = 'escola.criada'`)
    expect(depois[0]?.total).toBe(antes[0]?.total)
    const { rows: comNome } = await pool.query(`select 1 from escola where nome = 'Outro Colégio Sintético'`)
    expect(comNome).toHaveLength(0)
  })

  it('borda: rede inexistente sai com NAO_ENCONTRADO, sem o id na mensagem', async () => {
    const inexistente = randomUUID()
    const execucao = await rodar(['escola', 'criar', '--rede', inexistente, '--nome', 'Colégio Sintético', '--slug', `sem-rede-${sufixo}`], ambiente)
    expect(execucao).toMatchObject({ codigo: 1, saida: '' })
    expect(execucao.erro).toMatch(/^NAO_ENCONTRADO: /)
    expect(execucao.erro).not.toContain(inexistente)
  })

  it('a escola e a rede não nascem sem a auditoria delas: com a gravação recusada, a transação desfaz a criação', async () => {
    const nomeDaRede = `Rede Sintética Sem Auditoria ${sufixo}`
    await expect(criarRede(banco, autorFixo('Operador Invalido'), { id: randomUUID(), nome: nomeDaRede, tipo: 'independente' })).rejects.toEqual(new AuditoriaRejectedError('sem_autor'))
    const { rows: redesCriadas } = await pool.query('select 1 from rede where nome = $1', [nomeDaRede])
    expect(redesCriadas).toHaveLength(0)

    const { id: redeId } = await criarRede(banco, autorFixo('operador-teste'), { id: randomUUID(), nome: `Rede Sintética Com Auditoria ${sufixo}`, tipo: 'independente' })
    redes.push(redeId)
    const slugSemAuditoria = `sem-auditoria-${sufixo}`
    await expect(criarEscola(banco, autorFixo('Operador Invalido'), { id: randomUUID(), redeId, nome: 'Colégio Sintético', slug: slugSemAuditoria })).rejects.toEqual(new AuditoriaRejectedError('sem_autor'))
    const { rows: escolasCriadas } = await pool.query('select 1 from escola where slug = $1', [slugSemAuditoria])
    expect(escolasCriadas).toHaveLength(0)
  })

  it.each([
    ['sem OPERADOR', undefined],
    ['OPERADOR vazio', ''],
    ['OPERADOR fora do formato', 'Joaquim Paes <joaquim@educa.ia>'],
  ])('borda: %s no ambiente, recusa pelo nome da variável antes de abrir o banco', async (_caso, operador) => {
    let abriuBanco = false
    const abrirBanco = (ambienteDoComando: Record<string, string | undefined>) => {
      abriuBanco = true
      return abrirBancoDeOperacao(ambienteDoComando)
    }
    const semOperador = { ...ambiente, OPERADOR: operador }
    const slugQueNaoPodeNascer = `sem-operador-${sufixo}`
    const execucao = await rodar(['escola', 'criar', '--rede', randomUUID(), '--nome', 'Colégio Sintético', '--slug', slugQueNaoPodeNascer], semOperador, abrirBanco)

    expect(execucao).toEqual({ codigo: 2, saida: '', erro: 'Configuração inválida ou ausente: OPERADOR\n' })
    expect(abriuBanco).toBe(false)
    const { rows } = await pool.query('select 1 from escola where slug = $1', [slugQueNaoPodeNascer])
    expect(rows).toHaveLength(0)
  })
})

interface RotaRegistrada {
  metodo: string
  caminho: string
}

/**
 * Rotas de escrita com `rede(s)` ou `escola(s)` em qualquer segmento fixo que já foram conferidas. Quem acrescentar uma
 * rota dessas a declara aqui, e a revisão confere:
 * - `POST /v1/operacao/redes` e `POST /v1/operacao/escolas` (A0b, tarefa 1.0): as únicas que criam rede e escola, pelo
 *   painel da operação. São `@RotaDeOperacao`: só a sessão de operador Turmma as alcança, e credencial de escola
 *   responde como rota inexistente (C41 e C46). Não é cadastro público (D2).
 *
 * As outras não criam rede nem escola:
 * - `POST /v1/operacao/escolas/:id/convite-coordenacao` (A0b, tarefa 2.0): gera o convite da primeira coordenação de uma
 *   escola que já existe (escola inexistente é `NAO_ENCONTRADO`, sem gravar nada); `@RotaDeOperacao`, como as duas acima.
 * - `PUT /v1/escola/sessao` (5.0): muda a inatividade da escola da sessão, que já existe; não recebe escola nenhuma.
 * - `POST /v1/sessao/escola` (12.0): escolhe ou troca a escola da sessão entre os usuários ativos da conta; recebe só o
 *   `usuarioId`, e a escola vem do banco. Não cria escola nem rede.
 * - `PUT /v1/escola/provedores` (13.0): troca a lista de domínios e tenants do login pela conta da escola da sessão,
 *   que já existe; não recebe escola nenhuma.
 */
const ROTAS_PERMITIDAS: readonly string[] = [
  'POST /v1/operacao/redes',
  'POST /v1/operacao/escolas',
  'POST /v1/operacao/escolas/:id/convite-coordenacao',
  'PUT /v1/escola/sessao',
  'POST /v1/sessao/escola',
  'PUT /v1/escola/provedores',
]

/** Rota que escreve e tem rede ou escola em algum segmento fixo: `POST /v1/escolas`, `POST /v1/escolas/criar`. */
function criaRedeOuEscola(rota: RotaRegistrada): boolean {
  if (rota.metodo === 'GET' || rota.metodo === 'HEAD' || rota.metodo === 'OPTIONS') return false
  if (ROTAS_PERMITIDAS.includes(`${rota.metodo} ${rota.caminho}`)) return false
  const fixos = rota.caminho.split('/').filter((segmento) => segmento !== '' && !segmento.startsWith(':'))
  // A palavra dentro do segmento também conta: `nova-escola`, `escolas-importadas`.
  return fixos.some((segmento) => /(^|[-_.])(redes?|escolas?|instituic(ao|oes)|unidades?)([-_.]|$)/i.test(segmento))
}

describe('permissão: nenhuma rota da API cria rede nem escola, fora das duas do painel da operação', () => {
  let app: INestApplication

  beforeAll(async () => {
    // Com as rotas sintéticas ligadas: a lista inclui toda rota que alguma configuração registra.
    app = await NestFactory.create(AppModule.com(configuracaoDeTeste({ ambiente: { ROTAS_SINTETICAS: 'true' } })), { logger: false })
    configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'silent' }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('o filtro pega a rota de escrita com rede ou escola em qualquer segmento, e deixa passar a leitura', () => {
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/escolas' })).toBe(true)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/escolas/criar' })).toBe(true)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/redes/:redeId/escolas/importar' })).toBe(true)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/instituicoes' })).toBe(true)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/onboarding/nova-escola' })).toBe(true)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/sessao/renovar' })).toBe(false)
    expect(criaRedeOuEscola({ metodo: 'PUT', caminho: '/v1/escola/configurar' })).toBe(true)
    // A conferida passa, e só com o método conferido.
    expect(criaRedeOuEscola({ metodo: 'PUT', caminho: '/v1/escola/sessao' })).toBe(false)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/escola/sessao' })).toBe(true)
    expect(criaRedeOuEscola({ metodo: 'GET', caminho: '/v1/escolas/:slug/acesso' })).toBe(false)
    expect(criaRedeOuEscola({ metodo: 'POST', caminho: '/v1/sistema/jobs-sinteticos' })).toBe(false)
  })

  it('lista as rotas registradas no Nest e nenhuma de escrita fala de rede ou escola, fora da lista conferida', () => {
    const express = app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }
    const rotas: RotaRegistrada[] = express.router.stack.flatMap((camada) =>
      camada.route === undefined ? [] : Object.keys(camada.route.methods).map((metodo) => ({ metodo: metodo.toUpperCase(), caminho: camada.route?.path ?? '' })),
    )
    // A lista não pode sair vazia por mudança de versão do Express: aí o teste passaria sem olhar nada.
    expect(rotas).toContainEqual({ metodo: 'GET', caminho: '/saude' })
    expect(rotas.some((rota) => rota.metodo === 'POST')).toBe(true)

    expect(rotas.filter(criaRedeOuEscola)).toEqual([])
  })
})
