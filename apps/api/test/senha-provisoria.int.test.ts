import { DomainException, runInContext } from '@educa/core'
import { CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import {
  ALFABETO_DA_SENHA_PROVISORIA,
  ErrorCode,
  LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO,
  LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO,
  senhaProvisoriaResponseSchema,
  type SenhaProvisoriaResponse,
} from '@educa/shared'
import { hash, verify } from '@node-rs/argon2'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { METRICS } from '@educa/core'
import { HashBulkhead } from '../src/credencial/index.js'
import { vincularProfessor } from './escola-assistente.fixture.js'
import { FerramentasDaSala, pedidoDaSala, type TestSala } from './sala.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

/**
 * A senha provisória do aluno (acesso-e-convites, tarefa 9.0; `tasks/prd-acesso-e-convites/cenarios.md`, RF13, "Corridas" e "Limites"):
 * `POST /v1/usuarios/:usuarioId/senha-provisoria`. Postgres e Redis reais do compose de teste. O login com a provisória e a troca são da 10.0, então
 * aqui a senha mostrada se confere contra o hash guardado, com o mesmo `argon2` que o login usará.
 *
 * Cada caso monta a escola que precisa (`sala.montar()`: coordenação, o professor `s.professor` com vínculo confirmado nas duas turmas, 2026 em curso)
 * e os alunos com credencial e sessão. O "10 s" do `CONFLITO` se atravessa recuando a validade gravada (`recuar`), nunca esperando.
 */

/** A senha como o service a hasheia: os oito caracteres, sem o hífen da tela. */
const crua = (senha: string): string => senha.replace('-', '')

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const SENHA_ANTIGA = 'senha-antiga-sintetica-1'

describe('senha provisória (acesso-e-convites, tarefa 9.0): a coordenação e o professor da turma dão ao aluno uma senha de 24 h, e só a eles', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let sala: FerramentasDaSala
  let hashAntigo: string

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    sala = new FerramentasDaSala(api, bancada)
    hashAntigo = await hash(SENHA_ANTIGA, { memoryCost: 8192, timeCost: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const gerar = (quem: TestSessao, alunoId: string) => chamar(api.url, 'POST', `/v1/usuarios/${alunoId}/senha-provisoria`, quem.token)

  /** O mesmo pedido, com os cabeçalhos da resposta, que o `chamar` não devolve. */
  async function gerarBruto(quem: TestSessao, alunoId: string): Promise<{ status: number; cabecalhos: Headers; texto: string }> {
    const resposta = await fetch(`${api.url}/v1/usuarios/${alunoId}/senha-provisoria`, { method: 'POST', headers: { Authorization: `Bearer ${quem.token}` } })
    return { status: resposta.status, cabecalhos: resposta.headers, texto: await resposta.text() }
  }

  const resposta = (r: RespostaHttp): SenhaProvisoriaResponse => {
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    return senhaProvisoriaResponseSchema.parse(r.corpo)
  }

  /** O corpo de erro sem o id da requisição, para comparar byte a byte o 404 de um id com o de outro. */
  const semRequisicao = (r: RespostaHttp) => ({ status: r.status, corpo: JSON.stringify({ ...r.corpo, erro: { ...r.corpo.erro, requisicaoId: '-' } }) })

  /** Um aluno com sessão, credencial por matrícula (a senha antiga) e, se `turmaId`, vínculo `confirmado` nela. */
  async function novoAluno(s: Pick<TestSala, 'escolaId' | 'anoLetivoId' | 'coordenacao'>, turmaId: string | null): Promise<TestSessao> {
    const aluno = await bancada.sessao(s.escolaId, 'aluno')
    if (turmaId !== null) await vincularAluno(s, aluno.usuarioId, turmaId)
    await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [s.escolaId, aluno.usuarioId, `prov-${randomUUID().slice(0, 18)}`, hashAntigo])
    return aluno
  }

  async function vincularAluno(s: Pick<TestSala, 'escolaId' | 'anoLetivoId' | 'coordenacao'>, alunoId: string, turmaId: string, estado: 'confirmado' | 'encerrado' = 'confirmado'): Promise<void> {
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, 'aluno', $5, $6, now(), case when $5::text = 'encerrado' then 'realocacao' end, case when $5::text = 'encerrado' then now() end)`,
      [s.escolaId, s.anoLetivoId, alunoId, turmaId, estado, s.coordenacao.usuarioId],
    )
  }

  /** Um professor novo com vínculo de professor na turma, no estado pedido (o `confirmado`, o `pendente`, o `contestado` ou o `encerrado`). */
  async function professorNaTurma(s: TestSala, turmaId: string, estado: 'confirmado' | 'pendente' | 'contestado' | 'encerrado' = 'confirmado'): Promise<TestSessao> {
    const professor = await bancada.sessao(s.escolaId, 'professor')
    await vincularProfessor(bancada, s, professor.usuarioId, turmaId, s.quimica, estado === 'confirmado' ? 'confirmado' : 'pendente')
    if (estado === 'contestado') {
      await bancada.pool.query("update vinculo set estado = 'contestado', contestacao = $2 where usuario_id = $1 and turma_id = $3", [professor.usuarioId, 'outro', turmaId])
    }
    if (estado === 'encerrado') {
      await bancada.pool.query("update vinculo set estado = 'encerrado', motivo_encerramento = 'desligamento', encerrado_em = now() where usuario_id = $1 and turma_id = $2", [professor.usuarioId, turmaId])
    }
    return professor
  }

  interface CredencialNoBanco {
    readonly senha_hash: string | null
    readonly provisoria_hash: string | null
    readonly provisoria_expira_em: Date | null
    readonly provisoria_gerada_por: string | null
  }

  async function credencialDe(alunoId: string): Promise<CredencialNoBanco> {
    const { rows } = await bancada.pool.query<CredencialNoBanco>('select senha_hash, provisoria_hash, provisoria_expira_em, provisoria_gerada_por from credencial_matricula where usuario_id = $1', [alunoId])
    const linha = rows[0]
    if (linha === undefined) throw new Error('credencial de teste não encontrada')
    return linha
  }

  /** Recua em 11 s a hora da geração (a validade gravada), para o `CONFLITO` de 10 s não valer mais. */
  async function recuar(alunoId: string): Promise<void> {
    await bancada.pool.query("update credencial_matricula set provisoria_expira_em = provisoria_expira_em - interval '11 seconds' where usuario_id = $1", [alunoId])
  }

  async function auditoriasDe(alunoId: string): Promise<Array<{ autor_usuario_id: string; entidade: string; depois: Record<string, unknown>; antes: unknown; finalidade: unknown }>> {
    const { rows } = await bancada.pool.query<{ autor_usuario_id: string; entidade: string; depois: Record<string, unknown>; antes: unknown; finalidade: unknown }>(
      "select autor_usuario_id, entidade, depois, antes, finalidade from auditoria where acao = 'senha_provisoria.gerada' and entidade_id = $1 order by em",
      [alunoId],
    )
    return rows
  }

  async function sessoesAbertasDe(alunoId: string): Promise<number> {
    const { rows } = await bancada.pool.query<{ total: number }>('select count(*)::int as total from sessao where usuario_id = $1 and encerrada_em is null', [alunoId])
    return rows[0]?.total ?? 0
  }

  /** A credencial do aluno não foi tocada: nenhuma provisória, a senha antiga de pé, e nenhum registro de geração. */
  async function intacto(alunoId: string): Promise<void> {
    expect(await credencialDe(alunoId)).toEqual({ senha_hash: hashAntigo, provisoria_hash: null, provisoria_expira_em: null, provisoria_gerada_por: null })
    expect(await auditoriasDe(alunoId)).toEqual([])
  }

  describe('quem gera', () => {
    it('a coordenação gera: a resposta traz a senha em dois grupos e a validade de 24 h, o banco guarda só o hash dela, no lugar da senha antiga, e o papel de quem gerou fica na auditoria', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const antes = Date.now()

      const bruta = await gerarBruto(s.coordenacao, aluno.usuarioId)
      expect(bruta.status).toBe(200)
      expect(bruta.cabecalhos.get('cache-control')).toBe('no-store')
      const gerada = senhaProvisoriaResponseSchema.parse(JSON.parse(bruta.texto))
      const [grupo1, grupo2] = gerada.senha.split('-')
      expect([grupo1?.length, grupo2?.length]).toEqual([4, 4])
      for (const letra of crua(gerada.senha)) expect(ALFABETO_DA_SENHA_PROVISORIA).toContain(letra)
      const validadeMs = new Date(gerada.expiraEm).getTime() - antes
      expect(validadeMs).toBeGreaterThan(24 * 3_600_000 - 60_000)
      expect(validadeMs).toBeLessThan(24 * 3_600_000 + 60_000)

      const credencial = await credencialDe(aluno.usuarioId)
      expect(credencial.senha_hash).toBeNull()
      expect(credencial.provisoria_gerada_por).toBe(s.coordenacao.usuarioId)
      expect(credencial.provisoria_expira_em?.toISOString()).toBe(gerada.expiraEm)
      // O hash é o da senha mostrada (sem o hífen, em maiúsculas), e a senha não está em claro em coluna nenhuma.
      expect(credencial.provisoria_hash).toMatch(/^\$argon2id\$/)
      expect(await verify(credencial.provisoria_hash ?? '', crua(gerada.senha))).toBe(true)
      expect(JSON.stringify(credencial)).not.toContain(crua(gerada.senha))

      expect(await auditoriasDe(aluno.usuarioId)).toEqual([{ autor_usuario_id: s.coordenacao.usuarioId, entidade: 'usuario', depois: { papel: 'coordenador' }, antes: null, finalidade: null }])
    })

    it('o professor com vínculo confirmado na turma do aluno gera, e a auditoria diz `professor`', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)

      const gerada = resposta(await gerar(s.professor, aluno.usuarioId))

      const credencial = await credencialDe(aluno.usuarioId)
      expect(credencial.provisoria_gerada_por).toBe(s.professor.usuarioId)
      expect(await verify(credencial.provisoria_hash ?? '', crua(gerada.senha))).toBe(true)
      expect(await auditoriasDe(aluno.usuarioId)).toEqual([expect.objectContaining({ autor_usuario_id: s.professor.usuarioId, depois: { papel: 'professor' } })])
    })

    it('o professor com dois vínculos confirmados na mesma turma (duas disciplinas) gera uma vez só, sem repetir a linha do aluno', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      await vincularProfessor(bancada, s, s.professor.usuarioId, s.turma, s.fisica)

      resposta(await gerar(s.professor, aluno.usuarioId))

      expect(await auditoriasDe(aluno.usuarioId)).toHaveLength(1)
    })
  })

  describe('a senha anterior e a provisória anterior param de valer', () => {
    it('gerar derruba a senha, a provisória anterior (outro hash, que não confere mais com a senha que ela mostrou) e as sessões do aluno', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(1)

      const primeira = resposta(await gerar(s.coordenacao, aluno.usuarioId))
      expect(await sessoesAbertasDe(aluno.usuarioId)).toBe(0)
      const hashDaPrimeira = (await credencialDe(aluno.usuarioId)).provisoria_hash ?? ''
      const { rows } = await bancada.pool.query<{ motivo: string }>('select motivo from sessao where usuario_id = $1', [aluno.usuarioId])
      expect(rows).toEqual([{ motivo: 'senha_redefinida' }])

      await recuar(aluno.usuarioId)
      const segunda = resposta(await gerar(s.professor, aluno.usuarioId))
      const credencial = await credencialDe(aluno.usuarioId)
      expect(credencial.senha_hash).toBeNull()
      expect(credencial.provisoria_hash).not.toBe(hashDaPrimeira)
      expect(await verify(credencial.provisoria_hash ?? '', crua(segunda.senha))).toBe(true)
      expect(await verify(credencial.provisoria_hash ?? '', crua(primeira.senha))).toBe(false)
      expect(await verify(hashAntigo, SENHA_ANTIGA)).toBe(true)
      expect(credencial.provisoria_gerada_por).toBe(s.professor.usuarioId)
    })

    it('a sessão de outro aluno da escola não cai', async () => {
      const s = await sala.montar()
      const alvo = await novoAluno(s, s.turma)
      const outro = await novoAluno(s, s.turma)

      resposta(await gerar(s.coordenacao, alvo.usuarioId))

      expect(await sessoesAbertasDe(outro.usuarioId)).toBe(1)
      // E a credencial dele, a senha dele, não foi tocada: a gravação é por aluno, não por escola.
      await intacto(outro.usuarioId)
    })
  })

  describe('permissão e isolamento: quem não alcança o aluno recebe o 404 do aluno que não existe', () => {
    it('professor com vínculo pendente, contestado ou encerrado na turma, e professor de outra turma: 404 igual ao inexistente, sem tocar a credencial', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      // Um colega na outra turma: o professor de lá alcança ele, mas não o aluno da `turma`.
      await novoAluno(s, s.outraTurma)
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))
      expect(inexistente.status).toBe(404)

      for (const estado of ['pendente', 'contestado', 'encerrado'] as const) {
        const professor = await professorNaTurma(s, s.turma, estado)
        expect(semRequisicao(await gerar(professor, aluno.usuarioId)), estado).toEqual(inexistente)
      }
      const deOutraTurma = await professorNaTurma(s, s.outraTurma)
      expect(semRequisicao(await gerar(deOutraTurma, aluno.usuarioId))).toEqual(inexistente)
      await intacto(aluno.usuarioId)
    })

    it('`:usuarioId` de professor ou de coordenador da mesma escola: 404 igual ao inexistente, para a coordenação e para o professor', async () => {
      const s = await sala.montar()
      const outroProfessor = await bancada.sessao(s.escolaId, 'professor')
      const outraCoordenacao = await bancada.sessao(s.escolaId, 'coordenador')
      // Um aluno ativo na escola: sem o filtro pelo id, a trava devolveria `true` por ele, qualquer que fosse o `:usuarioId`.
      await novoAluno(s, s.turma)
      // Mesmo com uma linha de credencial (que o sistema não grava para quem não é aluno), o papel do alvo decide: só aluno.
      for (const quem of [outroProfessor, outraCoordenacao]) {
        await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [s.escolaId, quem.usuarioId, `prov-${randomUUID().slice(0, 18)}`, hashAntigo])
      }
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))

      for (const [quem, alvo] of [
        [s.coordenacao, outroProfessor.usuarioId],
        [s.coordenacao, outraCoordenacao.usuarioId],
        [s.coordenacao, s.coordenacao.usuarioId],
        [s.professor, outroProfessor.usuarioId],
        [s.professor, s.professor.usuarioId],
      ] as const) {
        expect(semRequisicao(await gerar(quem, alvo))).toEqual(inexistente)
      }
      const { rows } = await bancada.pool.query<{ total: number }>("select count(*)::int as total from auditoria where acao = 'senha_provisoria.gerada' and escola_id = $1", [s.escolaId])
      expect(rows[0]?.total).toBe(0)
    })

    it('isolamento: a coordenação e o professor da escola A não alcançam o aluno da escola B, e a credencial de B fica como estava', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const deB = await novoAluno(b, b.turma)
      const inexistente = semRequisicao(await gerar(a.coordenacao, randomUUID()))

      expect(semRequisicao(await gerar(a.coordenacao, deB.usuarioId))).toEqual(inexistente)
      expect(semRequisicao(await gerar(a.professor, deB.usuarioId))).toEqual(inexistente)
      await intacto(deB.usuarioId)
      // E o mesmo pedido, feito por quem alcança, vale: não é o aluno que não existe.
      resposta(await gerar(b.coordenacao, deB.usuarioId))
    })

    it('aluno transferido: o professor da turma antiga recebe 404, o da nova gera', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, null)
      await vincularAluno(s, aluno.usuarioId, s.turma, 'encerrado')
      await vincularAluno(s, aluno.usuarioId, s.outraTurma)
      const daAntiga = await professorNaTurma(s, s.turma)
      const daNova = await professorNaTurma(s, s.outraTurma)
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))

      expect(semRequisicao(await gerar(daAntiga, aluno.usuarioId))).toEqual(inexistente)
      await intacto(aluno.usuarioId)
      resposta(await gerar(daNova, aluno.usuarioId))
    })

    it('vínculo confirmado de aluno e professor numa turma de um ano encerrado não alcança: só o ano em curso vale', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, null)
      const { rows: anos } = await bancada.pool.query<{ id: string }>("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id", [s.escolaId])
      const anoAnterior = anos[0]?.id ?? ''
      const { rows: turmas } = await bancada.pool.query<{ id: string }>("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB de 2025') returning id", [s.escolaId, anoAnterior, s.serieId])
      const turmaAnterior = turmas[0]?.id ?? ''
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`,
        [s.escolaId, anoAnterior, s.professor.usuarioId, turmaAnterior, s.quimica, s.coordenacao.usuarioId],
      )
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
        [s.escolaId, anoAnterior, aluno.usuarioId, turmaAnterior, s.coordenacao.usuarioId],
      )
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))

      expect(semRequisicao(await gerar(s.professor, aluno.usuarioId))).toEqual(inexistente)
      await intacto(aluno.usuarioId)
      // A coordenação alcança o aluno da escola, qualquer que seja a turma dele.
      resposta(await gerar(s.coordenacao, aluno.usuarioId))
    })

    it('aluno com pedido de reivindicação pendente: ainda não há usuário, e o id do pedido e o do nome da lista dão 404 igual ao inexistente', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const enviado = await sala.reivindicar(pedidoDaSala(s, nome))
      expect(enviado.status).toBe(200)
      const { rows } = await bancada.pool.query<{ id: string }>("select id from reivindicacao where escola_id = $1 and lista_nome_id = $2 and estado = 'pendente'", [s.escolaId, nome.id])
      const pedidoId = rows[0]?.id ?? ''
      expect(pedidoId).not.toBe('')
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))

      for (const id of [pedidoId, nome.id]) {
        expect(semRequisicao(await gerar(s.coordenacao, id))).toEqual(inexistente)
        expect(semRequisicao(await gerar(s.professor, id))).toEqual(inexistente)
      }
    })

    it('aluno desativado, ou com a eliminação agendada: 404 igual ao inexistente, e a senha dele não muda', async () => {
      const s = await sala.montar()
      const desativado = await novoAluno(s, s.turma)
      const suspenso = await novoAluno(s, s.turma)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [desativado.usuarioId])
      await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [suspenso.usuarioId])
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))

      for (const aluno of [desativado, suspenso]) {
        expect(semRequisicao(await gerar(s.coordenacao, aluno.usuarioId))).toEqual(inexistente)
        await intacto(aluno.usuarioId)
      }
    })

    it('aluno aprovado sem credencial por matrícula: 404 igual ao inexistente, e nada é gravado nem gasto', async () => {
      const s = await sala.montar()
      const semCredencial = await bancada.sessao(s.escolaId, 'aluno')
      await vincularAluno(s, semCredencial.usuarioId, s.turma)
      // O segundo dado: outro aluno da escola, com credencial. Sem o filtro por aluno, a leitura do estado enxergaria a dele.
      await novoAluno(s, s.turma)
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))
      const espiao = vi.spyOn(api.app.get(HashBulkhead, { strict: false }), 'executar')

      expect(semRequisicao(await gerar(s.coordenacao, semCredencial.usuarioId))).toEqual(inexistente)
      expect(semRequisicao(await gerar(s.professor, semCredencial.usuarioId))).toEqual(inexistente)
      // Sem credencial não há o que trocar: nenhum hash é calculado, e nenhuma cota é gasta.
      expect(espiao).not.toHaveBeenCalled()
      expect(await auditoriasDe(semCredencial.usuarioId)).toEqual([])
      expect(await sessoesAbertasDe(semCredencial.usuarioId)).toBe(1)
    })

    it('a id fora do formato de UUID responde como a que não existe', async () => {
      const s = await sala.montar()
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))
      expect(semRequisicao(await chamar(api.url, 'POST', '/v1/usuarios/nao-e-um-uuid/senha-provisoria', s.coordenacao.token))).toEqual(inexistente)
    })

    it('o aluno e quem não está logado não geram: 404 e 401', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const outro = await novoAluno(s, s.turma)
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))
      expect(semRequisicao(await gerar(aluno, outro.usuarioId))).toEqual(inexistente)
      expect((await chamar(api.url, 'POST', `/v1/usuarios/${outro.usuarioId}/senha-provisoria`, undefined)).status).toBe(401)
      await intacto(outro.usuarioId)
    })
  })

  describe('escola sem ano em curso', () => {
    it('a coordenação gera para o aluno, e o professor recebe 404', async () => {
      const escolaId = await bancada.escola()
      const coordenacao = await bancada.sessao(escolaId, 'coordenador')
      const professor = await bancada.sessao(escolaId, 'professor')
      const aluno = await bancada.sessao(escolaId, 'aluno')
      await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [escolaId, aluno.usuarioId, `prov-${randomUUID().slice(0, 18)}`, hashAntigo])
      const inexistente = semRequisicao(await gerar(coordenacao, randomUUID()))

      expect(semRequisicao(await gerar(professor, aluno.usuarioId))).toEqual(inexistente)
      await intacto(aluno.usuarioId)
      resposta(await gerar(coordenacao, aluno.usuarioId))
      expect(await auditoriasDe(aluno.usuarioId)).toHaveLength(1)
    })
  })

  describe('conta da escola ligada', () => {
    async function ligarConta(s: Pick<TestSala, 'escolaId'>, alunoId: string): Promise<void> {
      await bancada.pool.query("insert into conta_externa (escola_id, usuario_id, provedor, sujeito) values ($1, $2, 'google', $3)", [s.escolaId, alunoId, `sujeito-${randomUUID()}`])
    }

    it('aluno só com a conta ligada, e aluno com a conta e a senha: `ENTRA_PELA_CONTA_DA_ESCOLA` para quem o alcança, a senha dele não muda e nada é registrado', async () => {
      const s = await sala.montar()
      const comSenha = await novoAluno(s, s.turma)
      const soConta = await novoAluno(s, s.turma)
      await bancada.pool.query('update credencial_matricula set senha_hash = null where usuario_id = $1', [soConta.usuarioId])
      await ligarConta(s, comSenha.usuarioId)
      await ligarConta(s, soConta.usuarioId)

      for (const quem of [s.coordenacao, s.professor]) {
        for (const aluno of [comSenha, soConta]) {
          const recusada = await gerar(quem, aluno.usuarioId)
          expect(recusada.status).toBe(409)
          expect(recusada.corpo.erro?.codigo).toBe(ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA)
        }
      }
      // O outro aluno da escola, sem a conta ligada, gera: a conta ligada é do aluno, não da escola.
      const semConta = await novoAluno(s, s.turma)
      resposta(await gerar(s.coordenacao, semConta.usuarioId))
      expect(await credencialDe(comSenha.usuarioId)).toEqual({ senha_hash: hashAntigo, provisoria_hash: null, provisoria_expira_em: null, provisoria_gerada_por: null })
      expect(await credencialDe(soConta.usuarioId)).toEqual({ senha_hash: null, provisoria_hash: null, provisoria_expira_em: null, provisoria_gerada_por: null })
      expect(await sessoesAbertasDe(comSenha.usuarioId)).toBe(1)
      expect(await auditoriasDe(comSenha.usuarioId)).toEqual([])
    })

    it('o professor de outra turma recebe 404, e não 409: o código não revela a conta a quem não alcança o aluno', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      await ligarConta(s, aluno.usuarioId)
      const deOutraTurma = await professorNaTurma(s, s.outraTurma)
      const inexistente = semRequisicao(await gerar(s.coordenacao, randomUUID()))

      expect(semRequisicao(await gerar(deOutraTurma, aluno.usuarioId))).toEqual(inexistente)
    })

    it('o 409 da conta ligada não gasta cota de quem gera', async () => {
      const s = await sala.montar()
      const ligado = await novoAluno(s, s.turma)
      await ligarConta(s, ligado.usuarioId)
      for (let vez = 0; vez < LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO + 1; vez++) expect((await gerar(s.coordenacao, ligado.usuarioId)).status).toBe(409)
      await bancada.pool.query('delete from conta_externa where usuario_id = $1', [ligado.usuarioId])

      resposta(await gerar(s.coordenacao, ligado.usuarioId))
    })
  })

  describe('a resposta é a única que traz a senha', () => {
    it('`no-store` na resposta; a senha não aparece na lista de alunos da turma, na credencial nem na auditoria', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)

      const bruta = await gerarBruto(s.coordenacao, aluno.usuarioId)
      expect(bruta.cabecalhos.get('cache-control')).toBe('no-store')
      const { senha } = senhaProvisoriaResponseSchema.parse(JSON.parse(bruta.texto))
      const pura = crua(senha)

      // Cada leitura responde 200 (uma que respondesse erro passaria no vazio), e o aluno aparece nela: a lista traz o aluno que acabou de ganhar a provisória.
      const listaDaCoordenacao = await chamar(api.url, 'GET', `/v1/turmas/${s.turma}/alunos?finalidade=conferencia_de_cadastro`, s.coordenacao.token)
      const listaDoProfessor = await chamar(api.url, 'GET', `/v1/turmas/${s.turma}/alunos`, s.professor.token)
      expect([listaDaCoordenacao.status, listaDoProfessor.status]).toEqual([200, 200])
      for (const lista of [listaDaCoordenacao, listaDoProfessor]) expect(JSON.stringify(lista.corpo)).toContain(aluno.usuarioId)
      const lidas = [
        JSON.stringify(listaDaCoordenacao.corpo),
        JSON.stringify(listaDoProfessor.corpo),
        JSON.stringify(await credencialDe(aluno.usuarioId)),
        JSON.stringify(await auditoriasDe(aluno.usuarioId)),
      ]
      for (const lida of lidas) {
        expect(lida).not.toContain(pura)
        expect(lida).not.toContain(senha)
      }
    })

    it('o hash passa pelo semáforo do argon2, uma vez, no balde da escola; quem não alcança o aluno não ocupa o semáforo', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const semaforo = api.app.get(HashBulkhead, { strict: false })
      const espiao = vi.spyOn(semaforo, 'executar')

      expect((await gerar(await professorNaTurma(s, s.outraTurma), aluno.usuarioId)).status).toBe(404)
      expect(espiao).not.toHaveBeenCalled()

      resposta(await gerar(s.coordenacao, aluno.usuarioId))
      expect(espiao).toHaveBeenCalledTimes(1)
      expect(espiao.mock.calls[0]?.[0]).toMatchObject({ id: s.escolaId, rotulo: s.escolaId })

      // O `CONFLITO` também não chega ao hash.
      expect((await gerar(s.coordenacao, aluno.usuarioId)).status).toBe(409)
      expect(espiao).toHaveBeenCalledTimes(1)
    })

    it('o hash espera o semáforo fora da transação, com a linha do aluno destravada', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const semaforo = api.app.get(HashBulkhead, { strict: false })
      // O de verdade, ligado antes do espião: o módulo pode registrar uma subclasse do `HashBulkhead`.
      const executarDeVerdade = semaforo.executar.bind(semaforo)
      // Enquanto o hash espera a vez, outra conexão tenta prender a linha do usuário do aluno sem esperar: com a transação
      // da geração já aberta e a trava dela segura, viria `55P03` (regra 80, item 5: o hash não segura conexão nem trava).
      // O código é guardado e conferido depois: lançar de dentro do espião viraria um 500 e o caso cairia no `resposta`.
      const travas: Array<string | null> = []
      vi.spyOn(semaforo, 'executar').mockImplementation(async (balde, tarefa) => {
        const sonda = await bancada.pool.connect()
        try {
          await sonda.query('begin')
          await sonda.query('select 1 from usuario where id = $1 for no key update nowait', [aluno.usuarioId])
          travas.push(null)
        } catch (erro) {
          travas.push((erro as { code?: string }).code ?? 'sem código')
        } finally {
          await sonda.query('rollback')
          sonda.release()
        }
        return executarDeVerdade(balde, tarefa)
      })

      resposta(await gerar(s.coordenacao, aluno.usuarioId))
      expect(travas).toEqual([null])
    })
  })

  describe('`CONFLITO` e as cotas', () => {
    it('uma provisória não usada de menos de 10 s, de qualquer autor, é `CONFLITO` e deixa a senha que acabou de sair valendo; passados 10 s, gerar vale', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const primeira = resposta(await gerar(s.coordenacao, aluno.usuarioId))
      const hashDaPrimeira = (await credencialDe(aluno.usuarioId)).provisoria_hash

      for (const quem of [s.coordenacao, s.professor]) {
        const conflito = await gerar(quem, aluno.usuarioId)
        expect(conflito.status).toBe(409)
        expect(conflito.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      }
      expect((await credencialDe(aluno.usuarioId)).provisoria_hash).toBe(hashDaPrimeira)
      expect(await verify(hashDaPrimeira ?? '', crua(primeira.senha))).toBe(true)
      expect(await auditoriasDe(aluno.usuarioId)).toHaveLength(1)

      await recuar(aluno.usuarioId)
      resposta(await gerar(s.professor, aluno.usuarioId))
      expect(await auditoriasDe(aluno.usuarioId)).toHaveLength(2)
    })

    it('5 por dia por aluno: o `CONFLITO` não gasta ponto (cinco gerações valem depois de três conflitos), a sexta é 429 com `Retry-After`, e outro aluno do mesmo autor segue', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const outro = await novoAluno(s, s.turma)

      resposta(await gerar(s.coordenacao, aluno.usuarioId))
      for (let vez = 0; vez < 3; vez++) expect((await gerar(s.coordenacao, aluno.usuarioId)).status).toBe(409)
      for (let vez = 1; vez < LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO; vez++) {
        await recuar(aluno.usuarioId)
        resposta(await gerar(s.coordenacao, aluno.usuarioId))
      }

      await recuar(aluno.usuarioId)
      const hashAntes = (await credencialDe(aluno.usuarioId)).provisoria_hash
      const sexta = await gerarBruto(s.professor, aluno.usuarioId)
      expect(sexta.status).toBe(429)
      expect(JSON.parse(sexta.texto)).toMatchObject({ erro: { codigo: ErrorCode.LIMITE_EXCEDIDO } })
      // A janela do aluno é de um dia: falta mais de uma hora (e no máximo as 24 h).
      const esperaDoDia = Number(sexta.cabecalhos.get('retry-after'))
      expect(esperaDoDia).toBeGreaterThan(3_600)
      expect(esperaDoDia).toBeLessThanOrEqual(24 * 3_600)
      expect((await credencialDe(aluno.usuarioId)).provisoria_hash).toBe(hashAntes)
      expect(await auditoriasDe(aluno.usuarioId)).toHaveLength(LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO)

      resposta(await gerar(s.coordenacao, outro.usuarioId))
    })

    it('o 503 do semáforo não gasta cota: seis recusas e as cinco gerações do dia do aluno ainda valem, a sexta é 429', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      // A recusa do semáforo cheio, simulada: saturar o `HashBulkhead` de verdade pediria segurar a escola inteira de hashes no
      // teste. O erro é o mesmo que ele lança na espera esgotada (`hash-bulkhead.ts`), e o que se prova é a ordem: a cota vem depois.
      const espiao = vi.spyOn(api.app.get(HashBulkhead, { strict: false }), 'executar').mockRejectedValue(new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))

      for (let vez = 0; vez <= LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO; vez++) {
        const recusada = await gerar(s.coordenacao, aluno.usuarioId)
        expect(recusada.status).toBe(503)
        expect(recusada.corpo.erro?.codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
      }
      espiao.mockRestore()
      await intacto(aluno.usuarioId)

      for (let vez = 0; vez < LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO; vez++) {
        if (vez > 0) await recuar(aluno.usuarioId)
        resposta(await gerar(s.coordenacao, aluno.usuarioId))
      }
      await recuar(aluno.usuarioId)
      expect((await gerar(s.coordenacao, aluno.usuarioId)).status).toBe(429)
    })

    it('60 por hora por quem gera: a 61ª, em outro aluno, é 429; outro autor segue', async () => {
      const s = await sala.montar()
      const outroProfessor = await professorNaTurma(s, s.turma)
      const alunos = await Promise.all(Array.from({ length: 13 }, () => novoAluno(s, s.turma)))

      for (let gerada = 0; gerada < LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO; gerada++) {
        const aluno = alunos[Math.floor(gerada / LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO)]
        if (aluno === undefined) throw new Error('alunos a menos')
        if (gerada % LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO !== 0) await recuar(aluno.usuarioId)
        resposta(await gerar(s.coordenacao, aluno.usuarioId))
      }
      const ultimo = alunos[12]
      if (ultimo === undefined) throw new Error('alunos a menos')
      const acima = await gerar(s.coordenacao, ultimo.usuarioId)
      expect(acima.status).toBe(429)
      expect(acima.corpo.erro?.codigo).toBe(ErrorCode.LIMITE_EXCEDIDO)
      await intacto(ultimo.usuarioId)
      // A janela de quem gera é de uma hora: falta entre 1 s e 1 h.
      const acimaBruto = await gerarBruto(s.coordenacao, ultimo.usuarioId)
      expect(acimaBruto.status).toBe(429)
      const esperaDaHora = Number(acimaBruto.cabecalhos.get('retry-after'))
      expect(esperaDaHora).toBeGreaterThanOrEqual(1)
      expect(esperaDaHora).toBeLessThanOrEqual(3_600)

      resposta(await gerar(outroProfessor, ultimo.usuarioId))
    }, 120_000)

    it('as cotas contam só depois do escopo: 70 pedidos de um professor a alunos que ele não alcança não gastam a cota dele nem a do aluno', async () => {
      const s = await sala.montar()
      const intruso = await professorNaTurma(s, s.outraTurma)
      const alvo = await novoAluno(s, s.turma)
      const proprio = await novoAluno(s, s.outraTurma)

      for (let vez = 0; vez < LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO + 10; vez++) expect((await gerar(intruso, alvo.usuarioId)).status).toBe(404)
      await intacto(alvo.usuarioId)

      // A cota por hora do intruso também está inteira: ele gera para o aluno da turma dele.
      resposta(await gerar(intruso, proprio.usuarioId))
      resposta(await gerar(s.coordenacao, alvo.usuarioId))
      for (let vez = 2; vez < LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO; vez++) {
        await recuar(alvo.usuarioId)
        resposta(await gerar(s.coordenacao, alvo.usuarioId))
      }
      // A quinta e última do dia do aluno ainda vale: as 70 recusas por escopo não gastaram ponto dele.
      await recuar(alvo.usuarioId)
      resposta(await gerar(s.coordenacao, alvo.usuarioId))
    }, 120_000)
  })

  describe('[P] dois "gerar" ao mesmo tempo para o mesmo aluno', () => {
    it.each([
      ['mesmo autor', 'coordenacao', 'coordenacao'],
      ['autores diferentes, coordenação e professor', 'coordenacao', 'professor'],
    ] as const)('%s: um gera, o outro é `CONFLITO` sem gastar cota, uma só `.gerada`, e a senha mostrada é a que entra (barreira entre a checagem e a gravação)', async (_nome, primeiro, segundo) => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const parada = new WriteBlockTrigger(bancada.pool, { tabela: 'credencial_matricula', evento: 'update', quando: `new.escola_id = '${s.escolaId}'::uuid and new.provisoria_hash is not null` })
      await parada.armar()
      try {
        const doPrimeiro = gerar(s[primeiro], aluno.usuarioId)
        await parada.esperarParadas(1)
        const doSegundo = gerar(s[segundo], aluno.usuarioId)
        // O segundo espera a trava da linha do usuário do aluno, que o primeiro segura: não passou da checagem.
        await esperarNaTrava(bancada.pool, '%"usuario"%for no key update%')
        await parada.soltar()
        const respostas = await Promise.all([doPrimeiro, doSegundo])

        expect(respostas.map((r) => r.status).sort()).toEqual([200, 409])
        const conflito = respostas.find((r) => r.status === 409)
        expect(conflito?.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
        const ok = respostas.find((r) => r.status === 200)
        if (ok === undefined) throw new Error('nenhuma geração deu 200')
        const gerada = resposta(ok)
        expect(await verify((await credencialDe(aluno.usuarioId)).provisoria_hash ?? '', crua(gerada.senha))).toBe(true)
        expect(await auditoriasDe(aluno.usuarioId)).toHaveLength(1)

        // O `CONFLITO` não gastou ponto: restam as quatro gerações do dia.
        for (let vez = 1; vez < LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO; vez++) {
          await recuar(aluno.usuarioId)
          resposta(await gerar(s.coordenacao, aluno.usuarioId))
        }
      } finally {
        await parada.desarmar()
      }
    })
  })

  describe('auditoria', () => {
    it('`senha_provisoria.gerada` tem o aluno como alvo, quem gerou como autor e só o papel no `depois`: nem a senha, nem o hash, nem o nome, nem a matrícula', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      const { rows: antes } = await bancada.pool.query<{ matricula: string }>('select matricula from credencial_matricula where usuario_id = $1', [aluno.usuarioId])
      const gerada = resposta(await gerar(s.professor, aluno.usuarioId))

      const { rows } = await bancada.pool.query<{ linha: string }>("select row_to_json(a)::text as linha from auditoria a where acao = 'senha_provisoria.gerada' and entidade_id = $1", [aluno.usuarioId])
      expect(rows).toHaveLength(1)
      const linha = rows[0]?.linha ?? ''
      expect(linha).not.toContain(crua(gerada.senha))
      expect(linha).not.toContain('argon2')
      expect(linha).not.toContain(antes[0]?.matricula ?? 'x')
      expect(JSON.parse(linha)).toMatchObject({ escola_id: s.escolaId, autor_usuario_id: s.professor.usuarioId, entidade: 'usuario', entidade_id: aluno.usuarioId, antes: null, depois: { papel: 'professor' }, finalidade: null })
    })
  })

  describe('desativar e eliminar', () => {
    const servico = () => new CicloDeVidaService(bancada.banco)
    const pela = <T>(quem: TestSessao, acao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId: quem.escolaId, usuarioId: quem.usuarioId, papel: 'coordenador' }, acao)

    it('o `desativar` do aluno anula a senha e as três colunas da provisória, mesmo quando só ela existe', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      resposta(await gerar(s.coordenacao, aluno.usuarioId))
      expect((await credencialDe(aluno.usuarioId)).senha_hash).toBeNull()
      expect((await credencialDe(aluno.usuarioId)).provisoria_hash).not.toBeNull()

      await pela(s.coordenacao, () => servico().desativar(aluno.usuarioId))

      expect(await credencialDe(aluno.usuarioId)).toEqual({ senha_hash: null, provisoria_hash: null, provisoria_expira_em: null, provisoria_gerada_por: null })
      const { rows } = await bancada.pool.query<{ depois: Record<string, unknown> }>("select depois from auditoria where acao = 'usuario.desativado' and entidade_id = $1", [aluno.usuarioId])
      expect(rows[0]?.depois).toMatchObject({ credencialApagada: true })
    })

    it('o `desativar` anula também a provisória do aluno que ainda tem a senha (a escola desativa quem tem as duas)', async () => {
      const s = await sala.montar()
      const aluno = await novoAluno(s, s.turma)
      resposta(await gerar(s.coordenacao, aluno.usuarioId))
      await bancada.pool.query('update credencial_matricula set senha_hash = $2 where usuario_id = $1', [aluno.usuarioId, hashAntigo])

      await pela(s.coordenacao, () => servico().desativar(aluno.usuarioId))

      expect(await credencialDe(aluno.usuarioId)).toEqual({ senha_hash: null, provisoria_hash: null, provisoria_expira_em: null, provisoria_gerada_por: null })
    })

    it('eliminar quem gerou passa: `provisoria_gerada_por` fica nulo, o hash e a validade ficam, e a auditoria guarda o autor', async () => {
      const s = await sala.montar()
      const quemGera = await professorNaTurma(s, s.turma)
      const aluno = await novoAluno(s, s.turma)
      resposta(await gerar(quemGera, aluno.usuarioId))
      const antes = await credencialDe(aluno.usuarioId)
      expect(antes.provisoria_gerada_por).toBe(quemGera.usuarioId)

      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [quemGera.usuarioId])
      await pela(s.coordenacao, () => servico().eliminar(quemGera.usuarioId))

      expect(await credencialDe(aluno.usuarioId)).toEqual({ ...antes, provisoria_gerada_por: null })
      expect((await bancada.pool.query('select 1 from usuario where id = $1', [quemGera.usuarioId])).rowCount).toBe(0)
      expect(await auditoriasDe(aluno.usuarioId)).toEqual([expect.objectContaining({ autor_usuario_id: quemGera.usuarioId })])
    })
  })

  describe('a métrica de provisórias por escola', () => {
    it('cada geração soma um na série da escola, com `escola_id` e mais nenhum rótulo; o pedido recusado não soma', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const deA = await novoAluno(a, a.turma)
      const deB = await novoAluno(b, b.turma)
      const lidas = async (escolaId: string) =>
        (await medidor.pontos(METRICS.senhaProvisoriaGerada)).filter(({ atributos }) => atributos['escola_id'] === escolaId).map(({ atributos, valor }) => ({ atributos, valor }))
      expect(await lidas(a.escolaId)).toEqual([])

      resposta(await gerar(a.coordenacao, deA.usuarioId))
      expect((await gerar(a.coordenacao, deA.usuarioId)).status).toBe(409)
      expect((await gerar(a.coordenacao, deB.usuarioId)).status).toBe(404)

      expect(await lidas(a.escolaId)).toEqual([{ atributos: { escola_id: a.escolaId }, valor: 1 }])
      expect(await lidas(b.escolaId)).toEqual([])
      resposta(await gerar(b.coordenacao, deB.usuarioId))
      expect(await lidas(b.escolaId)).toEqual([{ atributos: { escola_id: b.escolaId }, valor: 1 }])
    })
  })
})
