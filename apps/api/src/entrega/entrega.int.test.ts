import { DomainException, runInContext, type InProcessAgenteExecutor } from '@educa/nucleo'
import { entregaResponseSchema, listaDeEntregasResponseSchema, timeResponseSchema } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from '../../test/api-com-sessao.js'
import {
  comoPessoa,
  copiarArtefatoParaOAnoAnterior,
  dispararExecucao,
  execucaoTerminada,
  montarAnoAnterior,
  montarEscolaComAssistente,
  NOME_DA_PROFESSORA_DE_TESTE,
  vincularProfessor,
  zerarLimiteDePedidosDeIa,
  type EscolaComAssistente,
} from '../../test/escola-com-assistente.js'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../test/sessao-de-teste.js'
import { EXECUTOR_DE_AGENTE } from '../ia/ia.module.js'
import { EntregaRepository } from './entrega.repository.js'
import { EntregaService } from './entrega.service.js'

/**
 * As entregas e a decisão do professor (MVP, A2; regra 70, itens 3 e 6), com a API montada pelo `AppModule`, o Postgres
 * do compose de teste e o adaptador falso de IA. Cada entrega de versão adaptada nasce pelo caminho de verdade: a
 * professora gera a atividade e pede a adaptação.
 *
 * Em cada caso de isolamento, a outra escola (ou a colega) tem a entrega que a consulta alcançaria sem a cláusula de
 * escopo do repository (regra 10, item 5).
 */
describe('entregas', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  let executor: InProcessAgenteExecutor
  let a: EscolaComAssistente
  let b: EscolaComAssistente
  let atividadeDeA: string
  let atividadeDeB: string

  const sql = (texto: string, valores: unknown[] = []) => bancada.pool.query(texto, valores)
  const pedir = async (sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, metodo, caminho, await sessao.tokenNovo(), corpo)
  const decidir = (sessao: SessaoDeTeste, id: string, corpo: unknown) => pedir(sessao, 'POST', `/v1/entregas/${id}/decidir`, corpo)
  const listar = async (sessao: SessaoDeTeste, consulta = '') => listaDeEntregasResponseSchema.parse((await pedir(sessao, 'GET', `/v1/entregas${consulta}`)).corpo)
  const semId = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })

  interface EntregaNoBanco {
    readonly estado: string
    readonly decidida_por: string | null
    readonly decidida_em: Date | null
    readonly justificativa: string | null
  }
  async function noBanco(id: string): Promise<EntregaNoBanco> {
    const { rows } = await sql('select estado, decidida_por, decidida_em, justificativa from entrega where id = $1', [id])
    const [linha] = rows as EntregaNoBanco[]
    if (linha === undefined) throw new Error('entrega não encontrada')
    return linha
  }
  const auditoriasDa = async (id: string) => (await sql(`select acao, entidade, autor_usuario_id, antes, depois, finalidade, em from auditoria where entidade_id = $1 and acao = 'entrega.decidida' order by em`, [id])).rows as Record<string, unknown>[]

  async function atividade(escola: EscolaComAssistente): Promise<string> {
    const execucao = await execucaoTerminada(api, escola.professora, await dispararExecucao(api, escola.professora, '/v1/ferramentas/atividade_objetiva/gerar', { turmaId: escola.turma, disciplinaId: escola.quimica, tema: 'reagente limitante', quantidade: 3 }))
    if (execucao.resultado?.artefatoId === undefined) throw new Error(`atividade não gerada: ${execucao.erro ?? execucao.estado}`)
    return execucao.resultado.artefatoId
  }

  /** Uma versão adaptada, com a entrega pendente dela, pelo caminho de verdade. */
  async function entregaPendente(escola: EscolaComAssistente, artefatoId: string): Promise<{ entregaId: string; adaptadaId: string; execucaoId: string }> {
    await zerarLimiteDePedidosDeIa(api)
    const execucaoId = await dispararExecucao(api, escola.professora, `/v1/artefatos/${artefatoId}/adaptar`, { tipos: ['fonte_ampliada'] })
    const execucao = await execucaoTerminada(api, escola.professora, execucaoId)
    const entregaId = execucao.resultado?.entregaId
    if (typeof entregaId !== 'string' || execucao.resultado?.artefatoId === undefined) throw new Error(`adaptação não concluída: ${execucao.erro ?? execucao.estado}`)
    return { entregaId, adaptadaId: execucao.resultado.artefatoId, execucaoId }
  }

  /** O lote de correção pendente de uma atividade aplicada, gravado direto: quem o cria é o módulo da atividade. */
  async function lotePendente(escola: EscolaComAssistente, artefatoId: string): Promise<string> {
    const { rows: aplicadas } = await sql(
      `insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, encerrada_em) values ($1, $2, $3, $4, false, 'encerrada', $5, now()) returning id`,
      [escola.escolaId, escola.anoLetivoId, escola.turma, artefatoId, escola.professora.usuarioId],
    )
    const { rows } = await sql(`insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id) values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4) returning id`, [
      escola.escolaId,
      escola.anoLetivoId,
      escola.turma,
      (aplicadas[0] as { id: string }).id,
    ])
    return (rows[0] as { id: string }).id
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
    executor = api.app.get<InProcessAgenteExecutor>(EXECUTOR_DE_AGENTE)
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    atividadeDeA = await atividade(a)
    atividadeDeB = await atividade(b)
  })

  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
  })

  afterAll(async () => {
    await executor.ociosa()
    await api.app.close()
    await bancada.fechar()
  })

  describe('isolamento', () => {
    it('a entrega de A não é listada nem decidida pela professora de B, pela colega de outra turma, pela professora de outra disciplina da mesma turma, pela coordenação nem pelo aluno: igual ao inexistente, e continua pendente', async () => {
      const { entregaId } = await entregaPendente(a, atividadeDeA)
      const deB = await entregaPendente(b, atividadeDeB)
      for (const sessao of [b.professora, a.colega, a.deFisica, a.coordenacao, a.aluno]) {
        for (const corpo of [{ decisao: 'aprovar' }, { decisao: 'rejeitar', justificativa: 'Não era para esta turma.' }]) {
          const resposta = await decidir(sessao, entregaId, corpo)
          const doInexistente = await decidir(sessao, randomUUID(), corpo)
          expect(semId(resposta)).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
          expect(semId(doInexistente)).toEqual(semId(resposta))
        }
      }
      expect(await noBanco(entregaId)).toEqual({ estado: 'pendente', decidida_por: null, decidida_em: null, justificativa: null })
      expect(await auditoriasDa(entregaId)).toEqual([])

      // A listagem: cada professora vê só as das turmas dela; coordenação e aluno não têm a rota.
      expect((await listar(a.professora)).itens.map((item) => item.id)).toContain(entregaId)
      expect((await listar(a.professora)).itens.map((item) => item.id)).not.toContain(deB.entregaId)
      expect((await listar(b.professora)).itens.map((item) => item.id)).toEqual([deB.entregaId])
      expect((await listar(a.colega)).itens).toEqual([])
      expect((await listar(a.colega, `?turmaId=${a.turma}`)).itens).toEqual([])
      // A professora de Física do 2ºB tem vínculo confirmado na turma, e nem assim: a entrega é de Química.
      expect((await listar(a.deFisica)).itens).toEqual([])
      expect((await listar(a.deFisica, `?turmaId=${a.turma}&estado=pendente`)).itens).toEqual([])
      expect((await listar(b.professora, `?turmaId=${a.turma}`)).itens).toEqual([])
      for (const sessao of [a.coordenacao, a.aluno]) expect(semId(await pedir(sessao, 'GET', '/v1/entregas'))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })

      // No repository: com o id certo e o contexto errado, nada é lido nem decidido.
      for (const [escola, sessao] of [[b, b.professora], [a, a.colega], [a, a.deFisica]] as const) {
        expect(await comoPessoa(escola, sessao, 'professor', () => new EntregaRepository(bancada.banco).porId(entregaId))).toBeUndefined()
        expect(await comoPessoa(escola, sessao, 'professor', () => new EntregaRepository(bancada.banco).decidir(entregaId, 'aprovada', null))).toBe(false)
      }
      expect((await comoPessoa(a, a.professora, 'professor', () => new EntregaRepository(bancada.banco).porId(entregaId)))?.id).toBe(entregaId)
      expect((await noBanco(entregaId)).estado).toBe('pendente')
    })

    it('a entrega do ano letivo anterior não é listada nem decidida no ano em curso, nem com vínculo confirmado naquele ano: igual ao inexistente', async () => {
      const anterior = await montarAnoAnterior(bancada, b)
      const de2025 = await copiarArtefatoParaOAnoAnterior(bancada, b, anterior, atividadeDeB)
      for (const corpo of [{ decisao: 'aprovar' }, { decisao: 'rejeitar', justificativa: 'Entrega de outro ano letivo.' }]) {
        expect(semId(await decidir(b.professora, de2025.entregaId, corpo))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      }
      expect(await noBanco(de2025.entregaId)).toEqual({ estado: 'pendente', decidida_por: null, decidida_em: null, justificativa: null })
      expect(await auditoriasDa(de2025.entregaId)).toEqual([])
      for (const consulta of ['', '?estado=pendente', `?turmaId=${anterior.turmaId}`]) {
        expect((await listar(b.professora, consulta)).itens.map((item) => item.id)).not.toContain(de2025.entregaId)
      }
      expect(await comoPessoa(b, b.professora, 'professor', () => new EntregaRepository(bancada.banco).porId(de2025.entregaId))).toBeUndefined()
      expect(await comoPessoa(b, b.professora, 'professor', () => new EntregaRepository(bancada.banco).decidir(de2025.entregaId, 'aprovada', null))).toBe(false)
      // No contexto do próprio ano de 2025, a mesma consulta acha: o que separou foi o ano letivo, e não o vínculo.
      const em2025 = { requisicaoId: randomUUID(), escolaId: b.escolaId, usuarioId: b.professora.usuarioId, papel: 'professor' as const, sessaoId: b.professora.sessaoId, anoLetivoId: anterior.anoLetivoId }
      expect((await runInContext(em2025, () => new EntregaRepository(bancada.banco).porId(de2025.entregaId)))?.id).toBe(de2025.entregaId)
    })

    it('a turma e a disciplina que autorizam são as da entrega: a colega passa a decidir quando ganha vínculo confirmado em Química na turma, e deixa de decidir quando ele acaba', async () => {
      const primeira = await entregaPendente(a, atividadeDeA)
      const segunda = await entregaPendente(a, atividadeDeA)
      // Vínculo confirmado na turma em outra disciplina não basta; pendente na disciplina certa, também não.
      await vincularProfessor(bancada, a, a.colega.usuarioId, a.turma, a.fisica)
      expect((await decidir(a.colega, primeira.entregaId, { decisao: 'aprovar' })).status).toBe(404)
      await vincularProfessor(bancada, a, a.colega.usuarioId, a.turma, a.quimica, 'pendente')
      expect((await decidir(a.colega, primeira.entregaId, { decisao: 'aprovar' })).status).toBe(404)
      expect((await noBanco(primeira.entregaId)).estado).toBe('pendente')
      await sql(`update vinculo set estado = 'confirmado', decidido_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3 and disciplina_id = $4`, [a.escolaId, a.colega.usuarioId, a.turma, a.quimica])
      expect(await decidir(a.colega, primeira.entregaId, { decisao: 'aprovar' })).toMatchObject({ status: 200, corpo: { estado: 'aprovada', decididaPor: { id: a.colega.usuarioId } } })
      await sql(`update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and usuario_id = $2 and turma_id = $3 and disciplina_id = $4`, [a.escolaId, a.colega.usuarioId, a.turma, a.quimica])
      expect((await decidir(a.colega, segunda.entregaId, { decisao: 'aprovar' })).status).toBe(404)
      expect((await noBanco(segunda.entregaId)).estado).toBe('pendente')
      await sql('delete from vinculo where escola_id = $1 and usuario_id = $2 and turma_id = $3', [a.escolaId, a.colega.usuarioId, a.turma])
    })
  })

  describe('decidir', () => {
    it('aprovar grava quem decidiu e quando, e a auditoria responde o que a IA gerou, quem aprovou e quando', async () => {
      const { entregaId, adaptadaId, execucaoId } = await entregaPendente(a, atividadeDeA)
      const antes = Date.now()
      const resposta = await decidir(a.professora, entregaId, { decisao: 'aprovar' })
      expect(resposta.status).toBe(200)
      const entrega = entregaResponseSchema.parse(resposta.corpo)
      expect(entrega).toMatchObject({ id: entregaId, tipo: 'versao_adaptada', funcao: 'adaptacao', estado: 'aprovada', turmaId: a.turma, artefatoId: adaptadaId, atividadeAplicadaId: null, justificativa: null, decididaPor: { id: a.professora.usuarioId, nome: NOME_DA_PROFESSORA_DE_TESTE } })
      expect(entrega.titulo).toContain('versão adaptada')

      const gravada = await noBanco(entregaId)
      expect(gravada).toMatchObject({ estado: 'aprovada', decidida_por: a.professora.usuarioId, justificativa: null })
      expect(gravada.decidida_em?.getTime()).toBeGreaterThanOrEqual(antes - 5_000)

      // O que a IA gerou (a entrega aponta o artefato e a execução), quem aprovou e quando.
      const auditorias = await auditoriasDa(entregaId)
      expect(auditorias).toHaveLength(1)
      expect(auditorias[0]).toMatchObject({
        acao: 'entrega.decidida',
        entidade: 'entrega',
        autor_usuario_id: a.professora.usuarioId,
        antes: { estado: 'pendente' },
        depois: { tipo: 'versao_adaptada', funcao: 'adaptacao', turmaId: a.turma, estado: 'aprovada', artefatoId: adaptadaId, atividadeAplicadaId: null },
        finalidade: null,
      })
      expect(auditorias[0]?.['em']).toBeInstanceOf(Date)
      const { rows } = await sql('select e.execucao_id, x.funcao, x.tarefa, x.solicitada_por, a.execucao_id as do_artefato from entrega e join execucao_agente x on x.id = e.execucao_id join artefato a on a.id = e.artefato_id where e.id = $1', [entregaId])
      expect(rows).toEqual([{ execucao_id: execucaoId, funcao: 'adaptacao', tarefa: 'adaptar_atividade', solicitada_por: a.professora.usuarioId, do_artefato: execucaoId }])
      // Aprovada, a versão adaptada pode ir à turma: o banco aceita a aplicação.
      await expect(sql('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5)', [a.escolaId, a.anoLetivoId, a.turma, adaptadaId, a.professora.usuarioId])).resolves.toBeDefined()
    })

    it('rejeitar exige justificativa, que fica só na entrega: não vai para a auditoria nem para o log', async () => {
      const { entregaId, execucaoId } = await entregaPendente(a, atividadeDeA)
      for (const corpo of [{ decisao: 'rejeitar' }, { decisao: 'rejeitar', justificativa: 'curta' }, { decisao: 'rejeitar', justificativa: '        ' }, { decisao: 'aprovar', justificativa: 'Aprovo com ressalva.' }, { decisao: 'talvez' }, { decisao: 'aprovar', decididaPor: a.colega.usuarioId }, {}]) {
        expect(semId(await decidir(a.professora, entregaId, corpo)), JSON.stringify(corpo)).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect(await noBanco(entregaId)).toMatchObject({ estado: 'pendente', decidida_por: null })

      const justificativa = 'O enunciado da questão 2 ficou confuso para o Otávio Sintético.'
      const resposta = await decidir(a.professora, entregaId, { decisao: 'rejeitar', justificativa })
      expect(resposta).toMatchObject({ status: 200, corpo: { estado: 'rejeitada', justificativa, decididaPor: { id: a.professora.usuarioId } } })
      expect(await noBanco(entregaId)).toMatchObject({ estado: 'rejeitada', decidida_por: a.professora.usuarioId, justificativa })
      const auditorias = await auditoriasDa(entregaId)
      expect(auditorias).toHaveLength(1)
      expect(auditorias[0]?.['depois']).toMatchObject({ estado: 'rejeitada' })
      expect(JSON.stringify(auditorias)).not.toMatch(/Otávio|confuso/u)
      // O log capturado não está vazio: tem a linha da execução que criou esta entrega. E não tem a justificativa.
      expect(linhasDeLog.some((linha) => linha.includes('ia.execucao.concluida') && linha.includes(execucaoId))).toBe(true)
      expect(linhasDeLog.join('\n')).not.toMatch(/Otávio|enunciado da questão 2/u)
      // Rejeitada, a versão não vai à turma.
      const { rows } = await sql('select artefato_id from entrega where id = $1', [entregaId])
      await expect(sql('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5)', [a.escolaId, a.anoLetivoId, a.turma, (rows[0] as { artefato_id: string }).artefato_id, a.professora.usuarioId])).rejects.toThrow()
    })

    it('dois cliques em aprovar gravam uma decisão e uma auditoria; os outros recebem ENTREGA_JA_DECIDIDA', async () => {
      const { entregaId } = await entregaPendente(a, atividadeDeA)
      const respostas = await Promise.all(Array.from({ length: 5 }, () => decidir(a.professora, entregaId, { decisao: 'aprovar' })))
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409, 409, 409, 409])
      expect(respostas.filter((resposta) => resposta.status === 409).every((resposta) => resposta.corpo.erro?.codigo === 'ENTREGA_JA_DECIDIDA')).toBe(true)
      expect(await auditoriasDa(entregaId)).toHaveLength(1)
      const primeira = await noBanco(entregaId)
      // A segunda decisão, depois, não troca a primeira: nem o estado, nem a data, nem o autor.
      expect(semId(await decidir(a.professora, entregaId, { decisao: 'rejeitar', justificativa: 'Mudei de ideia sobre esta versão.' }))).toEqual({ status: 409, codigo: 'ENTREGA_JA_DECIDIDA' })
      expect(await noBanco(entregaId)).toEqual(primeira)
      expect(await auditoriasDa(entregaId)).toHaveLength(1)
    })

    it('aprovar e rejeitar ao mesmo tempo: vale a primeira, e o que fica gravado é coerente com ela', async () => {
      for (let rodada = 0; rodada < 4; rodada++) {
        const { entregaId } = await entregaPendente(a, atividadeDeA)
        const [aprovar, rejeitar] = await Promise.all([decidir(a.professora, entregaId, { decisao: 'aprovar' }), decidir(a.professora, entregaId, { decisao: 'rejeitar', justificativa: 'Prefiro refazer esta versão.' })])
        expect([aprovar.status, rejeitar.status].sort()).toEqual([200, 409])
        const gravada = await noBanco(entregaId)
        const venceu = aprovar.status === 200 ? { estado: 'aprovada', justificativa: null } : { estado: 'rejeitada', justificativa: 'Prefiro refazer esta versão.' }
        expect(gravada).toMatchObject(venceu)
        const auditorias = await auditoriasDa(entregaId)
        expect(auditorias).toHaveLength(1)
        expect(auditorias[0]?.['depois']).toMatchObject({ estado: venceu.estado })
      }
    })

    it('o lote de correção não se aprova por esta rota (ENTRADA_INVALIDA), e continua pendente; rejeitar o lote é por aqui', async () => {
      const loteId = await lotePendente(a, atividadeDeA)
      expect((await listar(a.professora, '?estado=pendente')).itens.find((item) => item.id === loteId)).toMatchObject({ tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', artefatoId: null })
      expect(semId(await decidir(a.professora, loteId, { decisao: 'aprovar' }))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(await noBanco(loteId)).toMatchObject({ estado: 'pendente', decidida_por: null })
      expect(await auditoriasDa(loteId)).toEqual([])
      // Quem não alcança o lote não descobre, pela resposta, que ele existe nem que é um lote: a outra escola, e a
      // professora de Física da mesma turma, porque o lote é da disciplina do artefato da atividade aplicada.
      for (const sessao of [b.professora, a.deFisica]) {
        expect(semId(await decidir(sessao, loteId, { decisao: 'aprovar' }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
        expect(semId(await decidir(sessao, loteId, { decisao: 'rejeitar', justificativa: 'Não é da minha disciplina.' }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      }
      expect((await listar(a.deFisica)).itens.map((item) => item.id)).not.toContain(loteId)
      expect((await noBanco(loteId)).estado).toBe('pendente')
      expect(await decidir(a.professora, loteId, { decisao: 'rejeitar', justificativa: 'A correção contou errado a questão 1.' })).toMatchObject({ status: 200, corpo: { estado: 'rejeitada', tipo: 'lote_de_correcao' } })
    })

    it('o id do caminho: fora do formato e o de outra escola, também em maiúsculas, respondem como o inexistente; o da própria, em maiúsculas, decide', async () => {
      const { entregaId } = await entregaPendente(a, atividadeDeA)
      const deB = await entregaPendente(b, atividadeDeB)
      const antesDeB = await noBanco(deB.entregaId)
      const recusas = await Promise.all(['nao-e-uuid', randomUUID(), deB.entregaId, deB.entregaId.toUpperCase()].map((id) => decidir(a.professora, id, { decisao: 'aprovar' })))
      for (const recusa of recusas) expect(semId(recusa)).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(new Set(recusas.map((recusa) => JSON.stringify({ ...recusa.corpo.erro, requisicaoId: undefined }))).size).toBe(1)
      // Com o id e o corpo inválidos ao mesmo tempo, o Nest dá o erro do corpo, que é o último parâmetro (antes era o do id,
      // 404). Não revela existência: com o corpo inválido, qualquer id, de B ou inexistente, dá o mesmo 400.
      for (const id of ['nao-e-uuid', randomUUID(), deB.entregaId]) expect(semId(await decidir(a.professora, id, {})), id).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      expect(await noBanco(deB.entregaId)).toEqual(antesDeB)
      expect(await auditoriasDa(deB.entregaId)).toEqual([])

      expect(await decidir(a.professora, entregaId.toUpperCase(), { decisao: 'aprovar' })).toMatchObject({ status: 200, corpo: { id: entregaId, estado: 'aprovada' } })
      expect(await noBanco(entregaId)).toMatchObject({ estado: 'aprovada', decidida_por: a.professora.usuarioId })
    })

    it('a guarda responde antes do pipe: sem sessão, 401; a coordenação, que não decide, 404; nenhum corpo inválido é lido nem auditado', async () => {
      const { entregaId } = await entregaPendente(a, atividadeDeA)
      const semSessao = await chamar(api.url, 'POST', `/v1/entregas/${entregaId}/decidir`, undefined, { decisao: 'talvez', escolaId: b.escolaId })
      expect(semId(semSessao)).toEqual({ status: 401, codigo: 'NAO_AUTENTICADO' })
      expect(semId(await decidir(a.coordenacao, entregaId, { decisao: 'talvez', escolaId: b.escolaId }))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(semId(await pedir(a.coordenacao, 'GET', `/v1/entregas?limite=101`))).toEqual({ status: 404, codigo: 'NAO_ENCONTRADO' })
      expect(await noBanco(entregaId)).toMatchObject({ estado: 'pendente', decidida_por: null })
      expect(await auditoriasDa(entregaId)).toEqual([])
    })
  })

  describe('só uma pessoa decide', () => {
    it('a versão adaptada nasce pendente, sem autor de decisão: a execução que a criou não aprova', async () => {
      const { entregaId } = await entregaPendente(a, atividadeDeA)
      expect(await noBanco(entregaId)).toEqual({ estado: 'pendente', decidida_por: null, decidida_em: null, justificativa: null })
      expect(await auditoriasDa(entregaId)).toEqual([])
    })

    it('sem a sessão de uma pessoa no contexto (job, rotina, execução em segundo plano), decidir é recusado e nada muda', async () => {
      const { entregaId } = await entregaPendente(a, atividadeDeA)
      const servico = new EntregaService(bancada.banco)
      for (const contexto of [
        { requisicaoId: randomUUID(), escolaId: a.escolaId }, // o contexto de uma execução do executor
        { requisicaoId: randomUUID(), escolaId: a.escolaId, anoLetivoId: a.anoLetivoId, rotinaDoSistema: true as const },
        { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.professora.usuarioId, anoLetivoId: a.anoLetivoId }, // pessoa sem sessão nem papel
      ]) {
        const erro: unknown = await runInContext(contexto, () => servico.decidir(entregaId, { decisao: 'aprovar' })).then(
          () => undefined,
          (motivo: unknown) => motivo,
        )
        expect(erro).toBeInstanceOf(DomainException)
        expect((erro as DomainException).codigo).toMatch(/^(NAO_AUTENTICADO|NAO_ENCONTRADO)$/u)
      }
      expect(await noBanco(entregaId)).toEqual({ estado: 'pendente', decidida_por: null, decidida_em: null, justificativa: null })
    })

    it('fora de teste, só a rota de decidir chega ao repository que decide: nenhum job, agendador ou execução o chama', () => {
      const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
      const arquivos = ['apps/api/src', 'apps/worker/src', 'apps/despachante/src', 'packages/nucleo/src'].flatMap((pasta) =>
        (readdirSync(join(raiz, pasta), { recursive: true }) as string[])
          .filter((arquivo) => arquivo.endsWith('.ts') && !arquivo.endsWith('.test.ts'))
          .map((arquivo) => ({ caminho: relative(raiz, join(raiz, pasta, arquivo)).split(sep).join('/'), texto: readFileSync(join(raiz, pasta, arquivo), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') })),
      )
      const quemUsa = (padrao: RegExp) => arquivos.filter((arquivo) => padrao.test(arquivo.texto)).map((arquivo) => arquivo.caminho).sort()
      // Quem chama `decidir` do repository de entregas, e quem chama o service.
      expect(quemUsa(/\bEntregaRepository\b[\s\S]*\.decidir\(/u)).toEqual(['apps/api/src/entrega/entrega.service.ts'])
      expect(quemUsa(/\bEntregaService\b/u)).toEqual(['apps/api/src/entrega/entrega.controller.ts', 'apps/api/src/entrega/entrega.module.ts', 'apps/api/src/entrega/entrega.service.ts'])
      // E ninguém escreve `aprovada` na entrega por SQL ou pelo drizzle fora do repository dela e do lote, que tem rota própria.
      const escrevem = quemUsa(/\.update\(entrega\)/u)
      expect(escrevem).toContain('apps/api/src/entrega/entrega.repository.ts')
      expect(escrevem.filter((caminho) => !caminho.startsWith('apps/api/src/entrega/') && !caminho.startsWith('apps/api/src/atividade/'))).toEqual([])
    })
  })

  describe('listagem e suspensão', () => {
    it('lista da mais nova para a mais antiga, filtra por estado e por turma, e pagina', async () => {
      const todas = await listar(a.professora)
      expect(todas.itens.length).toBeGreaterThanOrEqual(6)
      expect(todas.itens.map((item) => item.id)).toEqual([...todas.itens.map((item) => item.id)].sort().reverse())
      expect(Object.keys(todas.itens[0] ?? {}).sort()).toEqual(['artefatoId', 'atividadeAplicadaId', 'criadaEm', 'decididaEm', 'decididaPor', 'estado', 'funcao', 'id', 'justificativa', 'tipo', 'titulo', 'turmaId'])
      for (const estado of ['pendente', 'aprovada', 'rejeitada'] as const) {
        const doEstado = await listar(a.professora, `?estado=${estado}`)
        expect(doEstado.itens.length).toBeGreaterThan(0)
        expect(doEstado.itens.every((item) => item.estado === estado)).toBe(true)
      }
      expect((await listar(a.professora, `?turmaId=${a.turma}`)).itens).toHaveLength(todas.itens.length)
      expect((await listar(a.professora, `?turmaId=${a.outraTurma}`)).itens).toEqual([])
      const primeira = await listar(a.professora, '?limite=2')
      expect(primeira.itens.map((item) => item.id)).toEqual(todas.itens.slice(0, 2).map((item) => item.id))
      expect((await listar(a.professora, `?limite=2&pagina=${primeira.proxima ?? ''}`)).itens.map((item) => item.id)).toEqual(todas.itens.slice(2, 4).map((item) => item.id))
      for (const consulta of ['?estado=aberta', '?limite=101', `?escolaId=${b.escolaId}`, `?professorId=${a.colega.usuarioId}`]) {
        expect(semId(await pedir(a.professora, 'GET', `/v1/entregas${consulta}`))).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
    })

    it('a consulta fora do esquema responde ENTRADA_INVALIDA, e o limite 100 passa e o 101 não', async () => {
      for (const consulta of ['?estado=aberta', '?limite=101', '?limite=0', `?escolaId=${b.escolaId}`, `?professorId=${a.colega.usuarioId}`, '?turmaId=nao-e-uuid']) {
        expect(semId(await pedir(a.professora, 'GET', `/v1/entregas${consulta}`)), consulta).toEqual({ status: 400, codigo: 'ENTRADA_INVALIDA' })
      }
      expect((await pedir(a.professora, 'GET', '/v1/entregas?limite=100')).status).toBe(200)
    })

    it('a entrega pendente de uma função suspensa continua na lista, diz de que função é, e pode ser aprovada ou rejeitada; o time diz que a função está suspensa', async () => {
      const paraAprovar = await entregaPendente(a, atividadeDeA)
      const paraRejeitar = await entregaPendente(a, atividadeDeA)
      await sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [a.escolaId, 'adaptacao', a.coordenacao.usuarioId])
      try {
        const pendentes = (await listar(a.professora, '?estado=pendente')).itens
        expect(pendentes.filter((item) => [paraAprovar.entregaId, paraRejeitar.entregaId].includes(item.id)).map((item) => item.funcao)).toEqual(['adaptacao', 'adaptacao'])
        const funcoes = timeResponseSchema.parse((await pedir(a.professora, 'GET', '/v1/time')).corpo).agentes.flatMap((agente) => agente.funcoes)
        expect(funcoes.find((funcao) => funcao.chave === 'adaptacao')?.suspensa).toBe(true)
        expect(await decidir(a.professora, paraAprovar.entregaId, { decisao: 'aprovar' })).toMatchObject({ status: 200, corpo: { estado: 'aprovada' } })
        expect(await decidir(a.professora, paraRejeitar.entregaId, { decisao: 'rejeitar', justificativa: 'A função foi suspensa pela coordenação.' })).toMatchObject({ status: 200, corpo: { estado: 'rejeitada' } })
      } finally {
        await sql('update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where escola_id = $1 and retomada_em is null', [a.escolaId, a.coordenacao.usuarioId])
      }
    })
  })
})
