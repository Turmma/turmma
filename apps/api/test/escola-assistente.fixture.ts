import { runInContext, PREFIXO_LIMITE_USUARIO, type RequestContext, type InProcessAgenteExecutor } from '@educa/core'
import type { PapelDeUsuario } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { MATERIAL_DE_DEMONSTRACAO } from '../../../tools/demonstracao/conteudo-estequiometria.ts'
import { EXECUTOR_DE_AGENTE } from '../src/ia/ia.module.js'
import { REDIS_CACHE_CLIENT } from '../src/rate-limit.module.js'
import { REDIS_LOGIN_CLIENT } from '../src/credencial/index.js'
import { chamar, type ApiDeTeste, type RespostaHttp } from './test-api.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { enviarMaterial, esperarExtracao, PDF_DE_DEMONSTRACAO } from './material.fixture.js'
import type { BancadaDeSessoes, SessaoDeTeste } from './sessao.fixture.js'

/**
 * Uma escola pronta para o Assistente de ensino (MVP, A2): a de `montarEscolaComTurma`, mais a professora com vínculo
 * confirmado em Química no 2ºB, a colega com vínculo confirmado em Química no 2ºC (mesma escola, outra turma), a
 * professora de Física do 2ºB (mesma turma, outra disciplina), um aluno
 * do 2ºB e o material de demonstração de Química, enviado pela coordenação e já extraído. Tudo sintético.
 */
export interface EscolaComAssistente extends EscolaComTurma {
  readonly escolaId: string
  readonly professora: SessaoDeTeste
  readonly colega: SessaoDeTeste
  /** A professora de Física do 2ºB: a mesma turma da professora, outra disciplina. */
  readonly deFisica: SessaoDeTeste
  readonly aluno: SessaoDeTeste
  readonly materialId: string
}

/** Os nomes que o teste procura onde eles nunca podem aparecer (PDF, log, auditoria). */
export const NOME_DA_PROFESSORA_DE_TESTE = 'Professora Sintética Helena Prado'
export const NOME_DO_ALUNO_DE_TESTE = 'Aluno Sintético Caio Moreira'

/** Vínculo de professor `confirmado`, como a coordenação cria e o professor confirma (9.0), gravado direto. */
export async function vincularProfessor(bancada: BancadaDeSessoes, escola: EscolaComTurma, usuarioId: string, turmaId: string, disciplinaId: string, estado: 'confirmado' | 'pendente' = 'confirmado'): Promise<void> {
  await bancada.pool.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', $6, $7, case when $6 = 'confirmado' then now() end)`,
    [escola.coordenacao.escolaId, escola.anoLetivoId, usuarioId, turmaId, disciplinaId, estado, escola.coordenacao.usuarioId],
  )
}

/**
 * O PDF de demonstração enviado pela coordenação, pela rota `POST /v1/materiais`, com titularidade da escola e a
 * licença declarada, e já extraído: `pronto`, com um trecho por página. Devolve o id do material. `arquivo` troca o
 * PDF quando a mesma escola precisa de um segundo material (o mesmo arquivo duas vezes é `CONFLITO`).
 */
export async function enviarMaterialDeDemonstracao(api: ApiDeTeste, escola: EscolaComTurma, disciplinaId: string, titulo: string = MATERIAL_DE_DEMONSTRACAO.titulo, arquivo: Buffer = PDF_DE_DEMONSTRACAO): Promise<string> {
  const resposta = await enviarMaterial(api, { token: await escola.coordenacao.tokenNovo() }, { titulo, disciplinaId }, { arquivo })
  if (resposta.status !== 201) throw new Error(`material de teste não enviado: ${String(resposta.status)} ${resposta.corpo.erro?.codigo ?? ''}`)
  await esperarExtracao(api)
  return resposta.corpo['id'] as string
}

export async function montarEscolaComAssistente(api: ApiDeTeste, bancada: BancadaDeSessoes): Promise<EscolaComAssistente> {
  const escola = await montarEscolaComTurma(api, bancada)
  const { escolaId } = escola.coordenacao
  const [professora, colega, deFisica] = await bancada.sessoes(escolaId, { papel: 'professor', quantidade: 3 })
  const aluno = await bancada.sessao(escolaId, 'aluno')
  if (professora === undefined || colega === undefined || deFisica === undefined) throw new Error('sessões de teste não criadas')
  await bancada.pool.query('update usuario set nome = $1 where id = $2', [NOME_DA_PROFESSORA_DE_TESTE, professora.usuarioId])
  await bancada.pool.query('update usuario set nome = $1 where id = $2', [NOME_DO_ALUNO_DE_TESTE, aluno.usuarioId])
  await vincularProfessor(bancada, escola, professora.usuarioId, escola.turma, escola.quimica)
  await vincularProfessor(bancada, escola, colega.usuarioId, escola.outraTurma, escola.quimica)
  await vincularProfessor(bancada, escola, deFisica.usuarioId, escola.turma, escola.fisica)
  await bancada.pool.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
    [escolaId, escola.anoLetivoId, aluno.usuarioId, escola.turma, escola.coordenacao.usuarioId],
  )
  const materialId = await enviarMaterialDeDemonstracao(api, escola, escola.quimica)
  return { ...escola, escolaId, professora, colega, deFisica, aluno, materialId }
}

/** O ano letivo anterior da escola, já encerrado, com uma turma e o vínculo da professora nela, em Química. */
export interface AnoAnterior {
  readonly anoLetivoId: string
  readonly turmaId: string
}

/**
 * O ano de 2025 da escola, `encerrado`, com uma turma e o vínculo **confirmado** da professora em Química naquele ano.
 * O vínculo fica confirmado de propósito: o que tira do alcance o que é de 2025 tem de ser a cláusula de ano letivo do
 * repository, e não a falta de vínculo (regra 10, item 2).
 */
export async function montarAnoAnterior(bancada: BancadaDeSessoes, escola: EscolaComAssistente): Promise<AnoAnterior> {
  const { rows: anos } = await bancada.pool.query<{ id: string }>(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`, [escola.escolaId])
  const anoLetivoId = anos[0]?.id
  if (anoLetivoId === undefined) throw new Error('ano anterior não criado')
  const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB de 2025') returning id`, [escola.escolaId, anoLetivoId, escola.serieId])
  const turmaId = turmas[0]?.id
  if (turmaId === undefined) throw new Error('turma do ano anterior não criada')
  await bancada.pool.query(
    `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`,
    [escola.escolaId, anoLetivoId, escola.professora.usuarioId, turmaId, escola.quimica, escola.coordenacao.usuarioId],
  )
  return { anoLetivoId, turmaId }
}

/**
 * Uma cópia do artefato no ano anterior, na turma daquele ano; com `adaptada`, a versão adaptada dela, com a entrega
 * `pendente`. Devolve os ids. É gravado direto: nenhuma rota escreve em ano encerrado.
 */
export async function copiarArtefatoParaOAnoAnterior(bancada: BancadaDeSessoes, escola: EscolaComAssistente, anterior: AnoAnterior, artefatoId: string): Promise<{ artefatoId: string; adaptadaId: string; entregaId: string }> {
  const copiar = async (origemId: string | null, conteudo: string): Promise<string> => {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por)
       select escola_id, $2, $3, disciplina_id, tipo, titulo, ${conteudo}, $4, criado_por from artefato where escola_id = $1 and id = $5 returning id`,
      [escola.escolaId, anterior.anoLetivoId, anterior.turmaId, origemId, artefatoId],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('artefato do ano anterior não gravado')
    return id
  }
  const original = await copiar(null, 'conteudo')
  const adaptadaId = await copiar(original, `conteudo || '{"adaptacao": {"tipos": ["fonte_ampliada"]}}'::jsonb`)
  const { rows } = await bancada.pool.query<{ id: string }>(`insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id) values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4) returning id`, [
    escola.escolaId,
    anterior.anoLetivoId,
    anterior.turmaId,
    adaptadaId,
  ])
  const entregaId = rows[0]?.id
  if (entregaId === undefined) throw new Error('entrega do ano anterior não gravada')
  return { artefatoId: original, adaptadaId, entregaId }
}

/** O contexto que a `SessaoGuard` gravaria para esta pessoa: é nele que um service chamado direto roda, como numa rota. */
export function comoPessoa<T>(escola: EscolaComAssistente, sessao: SessaoDeTeste, papel: PapelDeUsuario, funcao: () => T): T {
  const contexto: RequestContext = { requisicaoId: randomUUID(), escolaId: escola.escolaId, usuarioId: sessao.usuarioId, papel, sessaoId: sessao.sessaoId, anoLetivoId: escola.anoLetivoId }
  return runInContext(contexto, funcao)
}

export interface ExecucaoLida {
  readonly estado: string
  readonly erro: string | null
  readonly resultado: (Record<string, unknown> & { tipo: string; artefatoId?: string; entregaId?: string | null; mensagem?: Record<string, unknown> }) | null
}

/** Espera o executor terminar o que tem e lê a execução como a tela lê, em `GET /v1/execucoes/:id`. */
export async function execucaoTerminada(api: ApiDeTeste, sessao: SessaoDeTeste, execucaoId: string): Promise<ExecucaoLida> {
  await api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE).ociosa()
  const resposta = await chamar(api.url, 'GET', `/v1/execucoes/${execucaoId}`, await sessao.tokenNovo())
  if (resposta.status !== 200) throw new Error(`a execução não foi lida: ${String(resposta.status)}`)
  return resposta.corpo as unknown as ExecucaoLida
}

/** O `POST` que dispara IA, e o id da execução que o `202` devolveu. */
export async function dispararExecucao(api: ApiDeTeste, sessao: SessaoDeTeste, caminho: string, corpo: Record<string, unknown>): Promise<string> {
  const resposta: RespostaHttp = await chamar(api.url, 'POST', caminho, await sessao.tokenNovo(), { chaveEnvio: randomUUID(), ...corpo })
  if (resposta.status !== 202) throw new Error(`o pedido não foi aceito: ${String(resposta.status)} ${resposta.corpo.erro?.codigo ?? ''}`)
  return resposta.corpo['execucaoId'] as string
}

/**
 * Zera os contadores do limite de pedidos de IA e os do limite geral por usuário, para um teste não gastar o minuto do
 * outro: um arquivo destes faz, pela mesma professora, mais requisições por minuto do que uma pessoa faria.
 */
export async function zerarLimiteDePedidosDeIa(api: ApiDeTeste): Promise<void> {
  for (const [redis, padrao] of [[api.app.get<Redis>(REDIS_LOGIN_CLIENT), 'ia:pedidos-*'], [api.app.get<Redis>(REDIS_CACHE_CLIENT), `${PREFIXO_LIMITE_USUARIO}:*`]] as const) {
    const chaves = await redis.keys(padrao)
    if (chaves.length > 0) await redis.del(...chaves)
  }
}

/** Quantas linhas da escola há na tabela, com o filtro dado. */
export async function contarNaEscola(bancada: BancadaDeSessoes, tabela: string, escolaId: string, filtro = 'true'): Promise<number> {
  const { rows } = await bancada.pool.query<{ total: string }>(`select count(*) as total from ${tabela} where escola_id = $1 and ${filtro}`, [escolaId])
  return Number(rows[0]?.total)
}
