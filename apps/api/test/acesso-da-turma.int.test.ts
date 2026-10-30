import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { hmacDoCodigoDaTurma, sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './configuracao-de-teste.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { esperarNaTrava, GatilhoDeParada } from './gatilho-de-parada.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * O acesso da turma (A1, tarefa 4.0; `tasks/prd-apresentacao-escola/cenarios.md`): E13, E14, P2 com o E12, a parte do
 * acesso do E2, o conteúdo de A1 e A5, C5, C6, C11 nos dois arranjos, e o gerar contra o encerramento do ano (a política
 * de trava da 4.5). As varreduras I3, P1, A1, A3 e A4 das três rotas moram em `escola-montada.int.test.ts`; o E15, em
 * `packages/shared/src/sala/acesso.test.ts` e `apps/api/src/sala/codigo-da-sala.test.ts`; o I9, em `matriz.test.ts`.
 * Postgres real do compose de teste.
 */

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const CONFLITO = { status: 409, corpo: { erro: { codigo: ErrorCode.CONFLITO, mensagem: MENSAGENS_DE_ERRO.CONFLITO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }

const UM_DIA_MS = 86_400_000

/** A resposta sem o `requisicaoId`, que muda a cada chamada: o resto precisa ser idêntico. */
function semRequisicao(resposta: RespostaHttp): unknown {
  if (resposta.corpo.erro === undefined) return { status: resposta.status, corpo: resposta.corpo }
  const { requisicaoId: _requisicaoId, ...erro } = resposta.corpo.erro as Record<string, unknown>
  return { status: resposta.status, corpo: { ...resposta.corpo, erro } }
}

/** Uma escola da `montarEscolaComTurma` com um professor de Química confirmado na `turma`. */
interface EscolaComProfessor extends EscolaComTurma {
  readonly escolaId: string
  readonly professor: SessaoDeTeste
  /** O vínculo confirmado do professor na `turma`. */
  readonly vinculo: string
}

interface LinhaDoAcesso {
  readonly id: string
  readonly token_hash: string
  readonly codigo_hmac: string
  readonly validade_dias: number
  readonly expira_em: Date
  readonly revogado_em: Date | null
  readonly criado_por: string | null
  readonly criado_em: Date
}

describe('acesso da turma (A1, tarefa 4.0): gerar, revogar e ler o link e o código', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  /** A API com o sorteio do código na mão do teste (C6): tira da fila e, vazia, sorteia de verdade. */
  let apiDoSorteio: ApiDeTeste
  const filaDeCodigos: string[] = []

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    apiDoSorteio = await subirApi(medidor.medidor, {}, undefined, { ...MONTAGEM_DE_TESTE, sortearCodigoDaSala: () => filaDeCodigos.shift() ?? sortearCodigoDaTurma() })
  })

  afterAll(async () => {
    await api.app.close()
    await apiDoSorteio.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown, url = api.url) => chamar(url, 'POST', caminho, sessao.token, corpo)
  const gerar = (sessao: SessaoDeTeste, turma: string, validadeDias: number = 7, url = api.url) => post(sessao, `/v1/turmas/${turma}/acesso`, { validadeDias }, url)
  const revogar = (sessao: SessaoDeTeste, turma: string) => post(sessao, `/v1/turmas/${turma}/acesso/revogar`, {})
  const ler = (sessao: SessaoDeTeste, turma: string) => chamar(api.url, 'GET', `/v1/turmas/${turma}/acesso`, sessao.token)
  const excluirTurma = (escola: EscolaComTurma, turma: string) => chamar(api.url, 'DELETE', `/v1/turmas/${turma}`, escola.coordenacao.token)

  async function vincular(escola: EscolaComTurma, usuarioId: string, turmaId = escola.turma, disciplinaId = escola.quimica): Promise<string> {
    const resposta = await post(escola.coordenacao, '/v1/vinculos', { usuarioId, turmaId, disciplinaId, papel: 'professor' })
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function confirmar(professor: SessaoDeTeste, vinculo: string): Promise<void> {
    expect((await post(professor, `/v1/vinculos/${vinculo}/confirmar`)).status).toBe(200)
  }

  async function contestar(professor: SessaoDeTeste, vinculo: string): Promise<void> {
    expect((await post(professor, `/v1/vinculos/${vinculo}/contestar`, { contestacao: 'nao_leciono' })).status).toBe(200)
  }

  /** Um professor novo da escola, com o vínculo confirmado na turma e na disciplina. */
  async function professorConfirmado(escola: EscolaComTurma, turmaId = escola.turma, disciplinaId = escola.quimica): Promise<{ sessao: SessaoDeTeste; vinculo: string }> {
    const sessao = await bancada.sessao(escola.coordenacao.escolaId, 'professor')
    const vinculo = await vincular(escola, sessao.usuarioId, turmaId, disciplinaId)
    await confirmar(sessao, vinculo)
    return { sessao, vinculo }
  }

  async function montar(): Promise<EscolaComProfessor> {
    const escola = await montarEscolaComTurma(api, bancada)
    const { sessao, vinculo } = await professorConfirmado(escola)
    return { ...escola, escolaId: escola.coordenacao.escolaId, professor: sessao, vinculo }
  }

  /** Todos os acessos da turma, em ordem de criação. */
  async function acessosDa(escola: EscolaComProfessor, turma: string): Promise<LinhaDoAcesso[]> {
    const { rows } = await bancada.pool.query<LinhaDoAcesso>(
      `select id, token_hash, codigo_hmac, validade_dias, expira_em, revogado_em, criado_por, criado_em from acesso_turma
        where escola_id = $1 and turma_id = $2 order by criado_em, id`,
      [escola.escolaId, turma],
    )
    return rows
  }

  async function naoRevogados(escola: EscolaComProfessor, turma: string): Promise<LinhaDoAcesso[]> {
    return (await acessosDa(escola, turma)).filter((linha) => linha.revogado_em === null)
  }

  interface RegistroDoAcesso {
    readonly acao: string
    readonly entidade_id: string
    readonly autor_usuario_id: string | null
    readonly antes: Record<string, unknown> | null
    readonly depois: Record<string, unknown> | null
  }

  async function auditoriaDoAcesso(escola: EscolaComProfessor): Promise<RegistroDoAcesso[]> {
    const { rows } = await bancada.pool.query<RegistroDoAcesso>(
      `select acao, entidade_id, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao like 'acesso_turma.%' order by id`,
      [escola.escolaId],
    )
    return rows
  }

  /** Tira o vínculo do professor pelo banco: sem isso, a FK do vínculo barraria a exclusão da turma sozinha (E2, C11). */
  async function semOVinculo(vinculo: string): Promise<void> {
    await bancada.pool.query('delete from vinculo where id = $1', [vinculo])
  }

  describe('E13: a validade, o "Gerar novo" e a leitura', () => {
    it('1, 7 e 30 dias gravam o expira_em pela validade, e a resposta e o GET trazem o mesmo instante', async () => {
      const e = await montar()
      for (const dias of [1, 7, 30]) {
        const gerado = await gerar(e.professor, e.turma, dias)
        expect(gerado.status, String(dias)).toBe(201)
        const [vigente, ...outros] = await naoRevogados(e, e.turma)
        expect(outros).toEqual([])
        expect(vigente?.validade_dias).toBe(dias)
        expect((vigente?.expira_em.getTime() ?? 0) - (vigente?.criado_em.getTime() ?? 0)).toBe(dias * UM_DIA_MS)
        expect(gerado.corpo['expiraEm']).toBe(vigente?.expira_em.toISOString())
        const lido = await ler(e.professor, e.turma)
        expect(lido.status).toBe(200)
        // Só a validade: nem o link, nem o código, nem o id.
        expect(lido.corpo).toEqual({ expiraEm: vigente?.expira_em.toISOString() })
      }
    })

    it('o gerar e a leitura saem com Cache-Control: no-store', async () => {
      const e = await montar()
      for (const [metodo, corpo] of [
        ['POST', JSON.stringify({ validadeDias: 7 })],
        ['GET', undefined],
      ] as const) {
        const resposta = await fetch(`${api.url}/v1/turmas/${e.turma}/acesso`, {
          method: metodo,
          headers: { Authorization: `Bearer ${e.professor.token}`, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(corpo === undefined ? {} : { body: corpo }),
        })
        expect(resposta.status, metodo).toBe(metodo === 'POST' ? 201 : 200)
        expect(resposta.headers.get('cache-control'), metodo).toBe('no-store')
      }
    })

    it('0, 2, 31, texto e campo a mais são ENTRADA_INVALIDA, e nada é gravado nem revogado', async () => {
      const e = await montar()
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const antes = await acessosDa(e, e.turma)
      for (const corpo of [{ validadeDias: 0 }, { validadeDias: 2 }, { validadeDias: 31 }, { validadeDias: '7' }, {}, { validadeDias: 7, escolaId: e.escolaId }]) {
        expect(semRequisicao(await post(e.professor, `/v1/turmas/${e.turma}/acesso`, corpo)), JSON.stringify(corpo)).toEqual(ENTRADA_INVALIDA)
      }
      expect(await acessosDa(e, e.turma)).toEqual(antes)
    })

    it('"Gerar novo" revoga o anterior na mesma transação, e só ele: o revogado antes não entra de novo nos substituídos', async () => {
      const e = await montar()
      for (let vez = 0; vez < 3; vez++) expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const [primeiro, segundo, terceiro] = await acessosDa(e, e.turma)
      // O anterior cai no instante em que o novo nasce: a mesma transação (o `now()` dela).
      expect(primeiro?.revogado_em).toEqual(segundo?.criado_em)
      expect(segundo?.revogado_em).toEqual(terceiro?.criado_em)
      expect(terceiro?.revogado_em).toBeNull()
      const gerados = (await auditoriaDoAcesso(e)).filter((registro) => registro.acao === 'acesso_turma.gerado')
      expect(gerados.map((registro) => registro.depois?.['substituidos'])).toEqual([[], [primeiro?.id], [segundo?.id]])
    })

    it('sem acesso vigente o GET traz null, e revogar é NAO_ENCONTRADO: nunca gerado, revogado e vencido; o vencido não barra o novo', async () => {
      const e = await montar()
      expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: null })
      expect(semRequisicao(await revogar(e.professor, e.turma))).toEqual(NAO_ENCONTRADO)

      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      expect((await revogar(e.professor, e.turma)).status).toBe(204)
      expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: null })
      expect(semRequisicao(await revogar(e.professor, e.turma))).toEqual(NAO_ENCONTRADO)

      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const [vencido] = await naoRevogados(e, e.turma)
      await bancada.pool.query(`update acesso_turma set expira_em = now() - interval '1 minute' where id = $1`, [vencido?.id])
      expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: null })
      expect(semRequisicao(await revogar(e.professor, e.turma))).toEqual(NAO_ENCONTRADO)
      // O vencido não foi revogado, e o índice de um por turma olha só o `revogado_em`: o gerar o revoga antes de gravar.
      expect((await naoRevogados(e, e.turma)).map((linha) => linha.id)).toEqual([vencido?.id])
      const novo = await gerar(e.professor, e.turma)
      expect(novo.status).toBe(201)
      const naoRevogadosDepois = await naoRevogados(e, e.turma)
      expect(naoRevogadosDepois).toHaveLength(1)
      expect(naoRevogadosDepois[0]?.id).not.toBe(vencido?.id)
      expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: novo.corpo['expiraEm'] })
    })

    it('o acesso é da turma: o de outra turma da escola não aparece no GET, não é revogado e não é substituído', async () => {
      const e = await montar()
      const daOutra = await professorConfirmado(e, e.outraTurma)
      expect((await gerar(daOutra.sessao, e.outraTurma)).status).toBe(201)
      const outraAntes = await acessosDa(e, e.outraTurma)
      expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: null })
      expect(semRequisicao(await revogar(e.professor, e.turma))).toEqual(NAO_ENCONTRADO)
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      expect(await acessosDa(e, e.outraTurma)).toEqual(outraAntes)
    })
  })

  it('E14: dois professores confirmados na turma: o gerar do segundo derruba o do primeiro, e os dois leem e revogam o mesmo acesso', async () => {
    const e = await montar()
    const fisica = await professorConfirmado(e, e.turma, e.fisica)
    expect((await gerar(e.professor, e.turma)).status).toBe(201)
    const [doPrimeiro] = await naoRevogados(e, e.turma)
    const doSegundo = await gerar(fisica.sessao, e.turma, 30)
    expect(doSegundo.status).toBe(201)

    const [primeiro, segundo] = await acessosDa(e, e.turma)
    expect(primeiro?.id).toBe(doPrimeiro?.id)
    expect(primeiro?.revogado_em).not.toBeNull()
    expect(segundo?.revogado_em).toBeNull()
    expect(segundo?.criado_por).toBe(fisica.sessao.usuarioId)
    expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: doSegundo.corpo['expiraEm'] })
    expect((await revogar(e.professor, e.turma)).status).toBe(204)
    expect(await naoRevogados(e, e.turma)).toEqual([])
  })

  describe('P2 e E12: só o vínculo confirmado na turma alcança o acesso', () => {
    it('coordenação, aluno, professor sem vínculo, pendente, contestado, encerrado e de outra turma recebem o 404 do id sorteado, e nada muda', async () => {
      const e = await montar()
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const antes = await acessosDa(e, e.turma)

      const semVinculo = await bancada.sessao(e.escolaId, 'professor')
      // E12: a alocação cria o vínculo pendente, e sem confirmar o professor não gera nem lê.
      const pendente = await bancada.sessao(e.escolaId, 'professor')
      await vincular(e, pendente.usuarioId)
      const contestado = await bancada.sessao(e.escolaId, 'professor')
      await contestar(contestado, await vincular(e, contestado.usuarioId))
      const encerrado = await professorConfirmado(e)
      expect((await post(e.coordenacao, `/v1/vinculos/${encerrado.vinculo}/encerrar`, { motivo: 'desligamento' })).status).toBe(200)
      const deOutraTurma = await professorConfirmado(e, e.outraTurma)
      const aluno = await bancada.sessao(e.escolaId, 'aluno')

      const quem: ReadonlyArray<readonly [string, SessaoDeTeste]> = [
        ['coordenação', e.coordenacao],
        ['aluno', aluno],
        ['professor sem vínculo', semVinculo],
        ['vínculo pendente', pendente],
        ['vínculo contestado', contestado],
        ['vínculo encerrado', encerrado.sessao],
        ['professor de outra turma', deOutraTurma.sessao],
      ]
      const sorteado = randomUUID()
      for (const [rotulo, sessao] of quem) {
        for (const [rota, pedir] of [
          ['gerar', (turma: string) => gerar(sessao, turma)],
          ['ler', (turma: string) => ler(sessao, turma)],
          ['revogar', (turma: string) => revogar(sessao, turma)],
        ] as const) {
          const resposta = await pedir(e.turma)
          expect(semRequisicao(resposta), `${rotulo} ${rota}`).toEqual(NAO_ENCONTRADO)
          expect(semRequisicao(resposta), `${rotulo} ${rota}`).toEqual(semRequisicao(await pedir(sorteado)))
        }
      }
      expect(await acessosDa(e, e.turma)).toEqual(antes)
      // O professor de outra turma alcança a dele, e o dono continua alcançando esta.
      expect((await ler(deOutraTurma.sessao, e.outraTurma)).status).toBe(200)
      expect((await ler(e.professor, e.turma)).corpo).toEqual({ expiraEm: antes[0]?.expira_em.toISOString() })
    })

    it('a turma de um ano encerrado da escola, com o vínculo confirmado nela, dá o 404 do id sorteado nas três rotas, sem 5xx', async () => {
      const e = await montar()
      // Montado pelo banco: pela API, o encerrar leva o vínculo a `fim_do_ano`, e o confirmado não sobraria.
      const { rows: anos } = await bancada.pool.query<{ id: string }>(
        `insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`,
        [e.escolaId],
      )
      const anoAntigo = anos[0]?.id
      const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, 'turma de 2025') returning id`, [
        e.escolaId,
        anoAntigo,
        e.serieId,
      ])
      const turmaAntiga = turmas[0]?.id ?? ''
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em)
         values ($1, $2, $3, $4, $5, 'professor', 'confirmado', $6, now())`,
        [e.escolaId, anoAntigo, e.professor.usuarioId, turmaAntiga, e.quimica, e.coordenacao.usuarioId],
      )
      const sorteado = randomUUID()
      for (const pedir of [gerar, ler, revogar]) {
        const resposta = await pedir(e.professor, turmaAntiga)
        expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
        expect(semRequisicao(resposta)).toEqual(semRequisicao(await pedir(e.professor, sorteado)))
      }
      expect(await acessosDa(e, turmaAntiga)).toEqual([])
    })

    it('com duas disciplinas na turma: os dois vínculos pendentes ou contestados dão 404; um confirmado e o outro pendente ou contestado alcança', async () => {
      const e = await montarEscolaComTurma(api, bancada)
      const escola = { ...e, escolaId: e.coordenacao.escolaId }
      const dois = await bancada.sessao(escola.escolaId, 'professor')
      const quimica = await vincular(e, dois.usuarioId, e.turma, e.quimica)
      const fisica = await vincular(e, dois.usuarioId, e.turma, e.fisica)
      const nenhumAlcanca = async (quando: string) => {
        for (const pedir of [gerar, ler, revogar]) expect(semRequisicao(await pedir(dois, e.turma)), quando).toEqual(NAO_ENCONTRADO)
      }
      await nenhumAlcanca('os dois pendentes')
      await contestar(dois, quimica)
      await contestar(dois, fisica)
      await nenhumAlcanca('os dois contestados')

      await confirmar(dois, quimica)
      expect((await gerar(dois, e.turma)).status).toBe(201)
      expect((await ler(dois, e.turma)).status).toBe(200)
      expect((await revogar(dois, e.turma)).status).toBe(204)

      const outro = await bancada.sessao(escola.escolaId, 'professor')
      await vincular(e, outro.usuarioId, e.turma, e.quimica)
      const confirmado = await vincular(e, outro.usuarioId, e.turma, e.fisica)
      await confirmar(outro, confirmado)
      expect((await gerar(outro, e.turma)).status).toBe(201)
      expect((await ler(outro, e.turma)).status).toBe(200)
      expect((await revogar(outro, e.turma)).status).toBe(204)
    })
  })

  describe('E2 (acesso): a turma com acesso vigente não sai; a com o acesso revogado ou vencido sai levando-o', () => {
    it('com acesso vigente: CONFLITO, e nada é apagado', async () => {
      const e = await montar()
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const antes = await acessosDa(e, e.turma)
      await semOVinculo(e.vinculo)
      expect(semRequisicao(await excluirTurma(e, e.turma))).toEqual(CONFLITO)
      expect(await acessosDa(e, e.turma)).toEqual(antes)
      const { rows } = await bancada.pool.query('select id from turma where id = $1', [e.turma])
      expect(rows).toHaveLength(1)
    })

    for (const como of ['revogado', 'vencido'] as const) {
      it(`com o acesso ${como}: a turma sai, e o acesso sai com ela pela cascata`, async () => {
        const e = await montar()
        expect((await gerar(e.professor, e.turma)).status).toBe(201)
        expect((await gerar(e.professor, e.turma)).status).toBe(201)
        if (como === 'revogado') expect((await revogar(e.professor, e.turma)).status).toBe(204)
        else await bancada.pool.query(`update acesso_turma set expira_em = now() - interval '1 minute' where turma_id = $1 and revogado_em is null`, [e.turma])
        expect(await acessosDa(e, e.turma)).toHaveLength(2)
        await semOVinculo(e.vinculo)
        expect((await excluirTurma(e, e.turma)).status).toBe(204)
        expect(await acessosDa(e, e.turma)).toEqual([])
      })
    }

    it('a turma com vínculo continua CONFLITO, a inexistente NAO_ENCONTRADO, e o acesso vigente de outra turma não barra a vazia', async () => {
      const e = await montar()
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      expect(semRequisicao(await excluirTurma(e, e.turma))).toEqual(CONFLITO)
      expect(semRequisicao(await excluirTurma(e, randomUUID()))).toEqual(NAO_ENCONTRADO)
      expect((await excluirTurma(e, e.outraTurma)).status).toBe(204)
    })
  })

  describe('A1 e A5: a auditoria e o banco, sem o token nem o código', () => {
    it('gerado e revogado gravam o autor, a turma, a validade e os substituídos; o banco guarda o SHA-256 do token e o HMAC do código com a chave da sala', async () => {
      const e = await montar()
      const primeiro = await gerar(e.professor, e.turma, 1)
      const segundo = await gerar(e.professor, e.turma, 30)
      expect((await revogar(e.professor, e.turma)).status).toBe(204)
      const [linhaDoPrimeiro, linhaDoSegundo] = await acessosDa(e, e.turma)

      expect(await auditoriaDoAcesso(e)).toEqual([
        {
          acao: 'acesso_turma.gerado',
          entidade_id: linhaDoPrimeiro?.id,
          autor_usuario_id: e.professor.usuarioId,
          antes: null,
          depois: { turmaId: e.turma, validadeDias: 1, expiraEm: primeiro.corpo['expiraEm'], substituidos: [] },
        },
        {
          acao: 'acesso_turma.gerado',
          entidade_id: linhaDoSegundo?.id,
          autor_usuario_id: e.professor.usuarioId,
          antes: null,
          depois: { turmaId: e.turma, validadeDias: 30, expiraEm: segundo.corpo['expiraEm'], substituidos: [linhaDoPrimeiro?.id] },
        },
        { acao: 'acesso_turma.revogado', entidade_id: linhaDoSegundo?.id, autor_usuario_id: e.professor.usuarioId, antes: null, depois: { turmaId: e.turma } },
      ])
      expect(linhaDoPrimeiro?.criado_por).toBe(e.professor.usuarioId)

      const config = configuracaoDeTeste()
      const chaveCodigo = config.sala.chaveCodigo
      const chaveContador = config.login.chaveContador
      for (const [resposta, linha] of [
        [primeiro, linhaDoPrimeiro],
        [segundo, linhaDoSegundo],
      ] as const) {
        const token = resposta.corpo['token'] as string
        const codigo = resposta.corpo['codigo'] as string
        expect(linha?.token_hash).toBe(createHash('sha256').update(token).digest('hex'))
        expect(linha?.codigo_hmac).toBe(hmacDoCodigoDaTurma(chaveCodigo, codigo))
        expect(linha?.codigo_hmac).not.toBe(createHmac('sha256', chaveContador).update(codigo).digest('base64url'))
        // Em claro, em nenhuma coluna do acesso nem da auditoria da escola.
        const { rows } = await bancada.pool.query<{ texto: string }>(
          `select (select coalesce(string_agg(a::text, ' '), '') from acesso_turma a where a.escola_id = $1)
                  || (select coalesce(string_agg(r::text, ' '), '') from auditoria r where r.escola_id = $1) as texto`,
          [e.escolaId],
        )
        expect(rows[0]?.texto).not.toContain(token)
        expect(rows[0]?.texto).not.toContain(codigo)
      }
    })

    it('quem gerou vira nulo quando é eliminado, e o acesso fica, com a escola; o autor de outra escola é recusado pela FK', async () => {
      const e = await montar()
      const outra = await montarEscolaComTurma(api, bancada)
      // Sem vínculo nem sessão, para o usuário sair pelo banco como a eliminação o tira (10.0, V4).
      const autor = await bancada.equipeComEmail(e.escolaId, `autor-${randomUUID()}@escola.invalid`, 'professor')
      const deOutraEscola = await bancada.equipeComEmail(outra.coordenacao.escolaId, `autor-${randomUUID()}@escola.invalid`, 'professor')
      const inserir = (criadoPor: string) =>
        bancada.pool.query<{ id: string }>(
          `insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em, criado_por)
           values ($1, $2, $3, $4, $5, 7, now() + interval '7 days', $6) returning id`,
          [e.escolaId, e.anoLetivoId, e.turma, randomUUID(), randomUUID(), criadoPor],
        )
      await expect(inserir(deOutraEscola.usuarioId)).rejects.toMatchObject({ code: '23503', constraint: 'acesso_turma_criado_por_da_escola_fk' })
      const { rows } = await inserir(autor.usuarioId)
      await bancada.pool.query('delete from usuario where id = $1', [autor.usuarioId])
      expect((await acessosDa(e, e.turma)).find((linha) => linha.id === rows[0]?.id)).toEqual(expect.objectContaining({ criado_por: null, revogado_em: null }))
    })

    it('o 400 e os 404 (sem acesso vigente, e da coordenação) não gravam auditoria', async () => {
      const e = await montar()
      expect(semRequisicao(await gerar(e.professor, e.turma, 2))).toEqual(ENTRADA_INVALIDA)
      expect(semRequisicao(await revogar(e.professor, e.turma))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await gerar(e.coordenacao, e.turma))).toEqual(NAO_ENCONTRADO)
      expect(await auditoriaDoAcesso(e)).toEqual([])
    })
  })

  describe('C5: dois gerar na mesma turma ao mesmo tempo', () => {
    for (const comAcesso of [false, true]) {
      it(`${comAcesso ? 'com' : 'sem'} acesso antes: um vigente no fim, o outro CONFLITO sem auditoria, nunca 5xx`, async () => {
        const e = await montar()
        const fisica = await professorConfirmado(e, e.turma, e.fisica)
        if (comAcesso) expect((await gerar(e.professor, e.turma)).status).toBe(201)
        const auditoriaAntes = (await auditoriaDoAcesso(e)).length
        const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${e.turma}'::uuid` })
        await gatilho.armar()
        try {
          const primeiro = gerar(e.professor, e.turma)
          await gatilho.esperarParadas()
          const segundo = gerar(fisica.sessao, e.turma)
          // O primeiro parado no gatilho, e o segundo na trava da linha (com acesso) ou do índice (sem).
          await esperarNaTrava(bancada.pool, '%acesso_turma%', 2)
          await gatilho.soltar()
          const respostas = await Promise.all([primeiro, segundo])
          expect(respostas.map((resposta) => resposta.status)).toEqual([201, 409])
          expect(semRequisicao(respostas[1] as RespostaHttp)).toEqual(CONFLITO)
        } finally {
          await gatilho.desarmar()
        }
        const vigentes = await naoRevogados(e, e.turma)
        expect(vigentes).toHaveLength(1)
        expect(vigentes[0]?.criado_por).toBe(e.professor.usuarioId)
        const registros = await auditoriaDoAcesso(e)
        expect(registros).toHaveLength(auditoriaAntes + 1)
        expect(registros.at(-1)?.entidade_id).toBe(vigentes[0]?.id)
      })
    }
  })

  describe('revogar em paralelo', () => {
    it('clique duplo em revogar: um 204, o outro NAO_ENCONTRADO, e um acesso_turma.revogado só', async () => {
      const e = await montar()
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const respostas = await Promise.all([revogar(e.professor, e.turma), revogar(e.professor, e.turma)])
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([204, 404])
      expect(semRequisicao(respostas.find((resposta) => resposta.status === 404) as RespostaHttp)).toEqual(NAO_ENCONTRADO)
      expect(await naoRevogados(e, e.turma)).toEqual([])
      expect((await auditoriaDoAcesso(e)).filter((registro) => registro.acao === 'acesso_turma.revogado')).toHaveLength(1)
    })

    it('o "Gerar novo" parado depois do insert e o revogar na trava do anterior: o revogar sai NAO_ENCONTRADO, e o novo fica vigente', async () => {
      const e = await montar()
      const fisica = await professorConfirmado(e, e.turma, e.fisica)
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${e.turma}'::uuid` })
      await gatilho.armar()
      try {
        const gerando = gerar(fisica.sessao, e.turma)
        await gatilho.esperarParadas()
        const revogando = revogar(e.professor, e.turma)
        // O gerar parado no gatilho (no insert), e o revogar no update, na trava da linha anterior que o gerar já revogou.
        await esperarNaTrava(bancada.pool, '%update "acesso_turma"%')
        await gatilho.soltar()
        const [gerado, revogado] = await Promise.all([gerando, revogando])
        expect(gerado.status).toBe(201)
        // Relida, a linha anterior já está revogada, e o novo não estava no retrato do revogar.
        expect(semRequisicao(revogado)).toEqual(NAO_ENCONTRADO)
      } finally {
        await gatilho.desarmar()
      }
      const vigentes = await naoRevogados(e, e.turma)
      expect(vigentes).toHaveLength(1)
      expect(vigentes[0]?.criado_por).toBe(fisica.sessao.usuarioId)
      expect((await auditoriaDoAcesso(e)).filter((registro) => registro.acao === 'acesso_turma.revogado')).toEqual([])
    })

    it('o revogar parado depois do update e o "Gerar novo" na trava da mesma linha: o revogar sai 204, e o novo nasce sem substituir ninguém', async () => {
      const e = await montar()
      const fisica = await professorConfirmado(e, e.turma, e.fisica)
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const [anterior] = await naoRevogados(e, e.turma)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'acesso_turma', evento: 'update', quando: `new.id = '${anterior?.id ?? ''}'::uuid and new.revogado_em is not null` })
      await gatilho.armar()
      try {
        const revogando = revogar(e.professor, e.turma)
        await gatilho.esperarParadas()
        const gerando = gerar(fisica.sessao, e.turma)
        // O revogar parado no gatilho, e o gerar na trava da linha que ele está revogando: os dois num update.
        await esperarNaTrava(bancada.pool, '%update "acesso_turma"%', 2)
        await gatilho.soltar()
        const [revogado, gerado] = await Promise.all([revogando, gerando])
        expect(revogado.status).toBe(204)
        expect(gerado.status).toBe(201)
      } finally {
        await gatilho.desarmar()
      }
      const vigentes = await naoRevogados(e, e.turma)
      expect(vigentes).toHaveLength(1)
      expect(vigentes[0]?.criado_por).toBe(fisica.sessao.usuarioId)
      const registros = await auditoriaDoAcesso(e)
      expect(registros.filter((registro) => registro.acao === 'acesso_turma.revogado').map((registro) => registro.entidade_id)).toEqual([anterior?.id])
      expect(registros.filter((registro) => registro.acao === 'acesso_turma.gerado').at(-1)?.depois?.['substituidos']).toEqual([])
    })
  })

  describe('C6: a colisão do código sorteia de novo num savepoint', () => {
    it('com o código vigente de outra turma da escola no primeiro sorteio, grava com o segundo', async () => {
      const e = await montar()
      const daOutra = await professorConfirmado(e, e.outraTurma)
      filaDeCodigos.push('AAAA2222')
      const outra = await gerar(daOutra.sessao, e.outraTurma, 7, apiDoSorteio.url)
      expect(outra.corpo['codigo']).toBe('AAAA2222')

      filaDeCodigos.push('AAAA2222', 'BBBB3333')
      const gerado = await gerar(e.professor, e.turma, 7, apiDoSorteio.url)
      expect(gerado.status).toBe(201)
      expect(gerado.corpo['codigo']).toBe('BBBB3333')
      expect(filaDeCodigos).toEqual([])
      const [vigente] = await naoRevogados(e, e.turma)
      expect(vigente?.codigo_hmac).toBe(hmacDoCodigoDaTurma(configuracaoDeTeste().sala.chaveCodigo, 'BBBB3333'))
      // O da outra turma continua vigente, com o mesmo código.
      expect(await naoRevogados(e, e.outraTurma)).toHaveLength(1)
    })

    it('três colisões seguidas: 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After, nada gravado, e o acesso anterior da turma continua', async () => {
      const e = await montar()
      const daOutra = await professorConfirmado(e, e.outraTurma)
      filaDeCodigos.push('CCCC4444')
      expect((await gerar(daOutra.sessao, e.outraTurma, 7, apiDoSorteio.url)).status).toBe(201)
      expect((await gerar(e.professor, e.turma)).status).toBe(201)
      const antes = await acessosDa(e, e.turma)
      const auditoriaAntes = await auditoriaDoAcesso(e)

      filaDeCodigos.push('CCCC4444', 'CCCC4444', 'CCCC4444')
      const resposta = await fetch(`${apiDoSorteio.url}/v1/turmas/${e.turma}/acesso`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${e.professor.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ validadeDias: 7 }),
      })
      expect(resposta.status).toBe(503)
      expect(((await resposta.json()) as { erro: { codigo: string } }).erro.codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
      expect(Number(resposta.headers.get('retry-after'))).toBeGreaterThan(0)
      expect(filaDeCodigos).toEqual([])
      expect(await acessosDa(e, e.turma)).toEqual(antes)
      expect(await auditoriaDoAcesso(e)).toEqual(auditoriaAntes)
    })
  })

  describe('C11: excluir a turma × gerar o acesso, em paralelo, sem acesso antes', () => {
    it('o gerar parado depois do insert: o excluir espera a turma e sai CONFLITO; o acesso entregue continua vigente', async () => {
      const e = await montar()
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'acesso_turma', evento: 'insert', quando: `new.turma_id = '${e.turma}'::uuid` })
      await gatilho.armar()
      try {
        const gerando = gerar(e.professor, e.turma)
        await gatilho.esperarParadas()
        await semOVinculo(e.vinculo)
        const excluindo = excluirTurma(e, e.turma)
        // O excluir parado na trava da turma, que o gerar segura.
        await esperarNaTrava(bancada.pool, '%"turma"%')
        await gatilho.soltar()
        const [gerado, excluido] = await Promise.all([gerando, excluindo])
        expect(gerado.status).toBe(201)
        expect(semRequisicao(excluido)).toEqual(CONFLITO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await naoRevogados(e, e.turma)).toHaveLength(1)
    })

    it('o excluir parado com a turma já travada: o gerar espera a turma e sai NAO_ENCONTRADO, não 5xx, e nada fica gravado', async () => {
      const e = await montar()
      // O vínculo apagado numa transação que o teste segura: o `delete` da turma espera nele, na FK, depois de travar a
      // turma, e o gerar ainda enxerga o vínculo (o apagar não foi confirmado).
      const segurador = await bancada.pool.connect()
      let confirmado = false
      try {
        await segurador.query('begin')
        await segurador.query('delete from vinculo where id = $1', [e.vinculo])
        const excluindo = excluirTurma(e, e.turma)
        await esperarNaTrava(bancada.pool, '%delete from "turma"%')
        const gerando = gerar(e.professor, e.turma)
        // O excluir e o gerar parados, o gerar na trava da turma (ou na FK, se ele não a travasse).
        await esperarNaTrava(bancada.pool, '%turma%', 2)
        await segurador.query('commit')
        confirmado = true
        const [excluido, gerado] = await Promise.all([excluindo, gerando])
        expect(excluido.status).toBe(204)
        expect(semRequisicao(gerado)).toEqual(NAO_ENCONTRADO)
      } finally {
        if (!confirmado) await segurador.query('rollback')
        segurador.release()
      }
      expect(await acessosDa(e, e.turma)).toEqual([])
      expect(await auditoriaDoAcesso(e)).toEqual([])
    })
  })

  it('4.5: o gerar trava o ano em curso; o encerramento no meio faz o gerar sair NAO_ENCONTRADO, sem acesso no ano encerrado', async () => {
    const e = await montar()
    const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'ano_letivo', evento: 'update', quando: `new.id = '${e.anoLetivoId}'::uuid and new.situacao = 'encerrado'` })
    await gatilho.armar()
    try {
      const encerrando = post(e.coordenacao, `/v1/anos-letivos/${e.anoLetivoId}/encerrar`)
      await gatilho.esperarParadas()
      const gerando = gerar(e.professor, e.turma)
      await esperarNaTrava(bancada.pool, '%from "ano_letivo"%for share%')
      await gatilho.soltar()
      const [encerrado, gerado] = await Promise.all([encerrando, gerando])
      expect(encerrado.status).toBe(200)
      expect(semRequisicao(gerado)).toEqual(NAO_ENCONTRADO)
    } finally {
      await gatilho.desarmar()
    }
    expect(await acessosDa(e, e.turma)).toEqual([])
  })
})
