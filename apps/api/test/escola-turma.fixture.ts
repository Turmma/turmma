import { expect } from 'vitest'
import { chamar, type ApiDeTeste, type RespostaHttp } from './test-api.js'
import type { BancadaDeSessoes, SessaoDeTeste } from './sessao.fixture.js'

/** Uma escola pronta para vínculo: 2026 em curso, o 2º ano do EM, Química e Física, e as turmas 2ºB e 2ºC. */
export interface EscolaComTurma {
  readonly coordenacao: SessaoDeTeste
  readonly anoLetivoId: string
  readonly serieId: string
  readonly quimica: string
  readonly fisica: string
  readonly turma: string
  readonly outraTurma: string
}

async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
  const lida = await resposta
  expect(lida.status).toBe(status)
  return lida.corpo['id'] as string
}

/** Monta a escola pela API, como a coordenação faria (8.0). */
export async function montarEscolaComTurma(api: ApiDeTeste, bancada: BancadaDeSessoes): Promise<EscolaComTurma> {
  const coordenacao = await bancada.escolaComSessao('coordenador')
  const post = (caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, coordenacao.token, corpo)
  const anoLetivoId = await criado(post('/v1/anos-letivos', { ano: 2026, inicio: '2026-02-01', fim: '2026-12-15' }))
  await criado(post(`/v1/anos-letivos/${anoLetivoId}/abrir`), 200)
  const serieId = await criado(post('/v1/series', { etapa: 'em', ano: 2 }))
  const quimica = await criado(post('/v1/disciplinas', { nome: 'Química' }))
  const fisica = await criado(post('/v1/disciplinas', { nome: 'Física' }))
  const turma = await criado(post('/v1/turmas', { serieId, nome: '2ºB' }))
  const outraTurma = await criado(post('/v1/turmas', { serieId, nome: '2ºC' }))
  return { coordenacao, anoLetivoId, serieId, quimica, fisica, turma, outraTurma }
}

/**
 * Alunos sintéticos com vínculo `confirmado` na turma, como o seed do F1 os deixa (Tech Spec, seção 3, "Aluno"): no F1
 * nenhuma rota cria vínculo de aluno. Cada um ganha um nome sintético distinto, e os ids voltam em ordem de criação.
 */
export async function alunosNaTurma(bancada: BancadaDeSessoes, escola: EscolaComTurma, turmaId: string, quantidade: number): Promise<string[]> {
  const alunos = await bancada.sessoes(escola.coordenacao.escolaId, { papel: 'aluno', quantidade })
  const ids = alunos.map((aluno) => aluno.usuarioId)
  for (const [posicao, id] of ids.entries()) {
    await bancada.pool.query('update usuario set nome = $1 where id = $2', [`Aluno sintético ${String(posicao + 1)}`, id])
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
      [escola.coordenacao.escolaId, escola.anoLetivoId, id, turmaId, escola.coordenacao.usuarioId],
    )
  }
  return ids
}
