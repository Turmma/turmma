import { ErrorCode, listaDaTurmaResponseSchema, previaDaListaResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { esperarNaTrava, GatilhoDeParada } from './gatilho-de-parada.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * A lista de nomes da turma (A1, tarefa 2.0; `tasks/prd-apresentacao-escola/cenarios.md`): E4, E5, E6 e E7 (sem o
 * aprovado nem o reivindicado de verdade, que chegam na 6.0 e na 8.0), a parte da lista do E2, o check da `lista_nome`,
 * o conteúdo de A1 e A2, C8, C9, a gravação ao mesmo tempo em duas turmas, a matrícula com forma de documento (G2), e
 * o log. As varreduras I3, P1, A1, A3 e A4 das
 * cinco rotas moram em `escola-montada.int.test.ts`, e o E3 (a leitura do texto) em `leitor-da-lista.test.ts`.
 * Postgres real do compose de teste; nomes e matrículas gerados.
 */

const FINALIDADE = 'conferencia_de_cadastro'

/** Uma escola com o ano de 2026 em curso, uma série e duas turmas, montada pela API como a coordenação faria. */
interface EscolaComTurmas {
  readonly escolaId: string
  readonly coordenacao: SessaoDeTeste
  readonly anoId: string
  readonly serieId: string
  readonly t1: string
  readonly t2: string
}

/** O prefixo das matrículas e dos nomes desta execução, que o log nunca pode ter. */
const PREFIXO = `lst${randomUUID().slice(0, 6)}`
const matricula = (): string => `${PREFIXO}-m-${randomUUID().slice(0, 12)}`
const nome = (): string => `${PREFIXO} Aluno ${randomUUID().slice(0, 8)}`
/** O texto da lista, uma linha `nome;matrícula` por aluno. */
const texto = (linhas: ReadonlyArray<readonly [string, string]>): string => linhas.map(([quem, qual]) => `${quem};${qual}`).join('\n')

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const CONFLITO = { status: 409, corpo: { erro: { codigo: ErrorCode.CONFLITO, mensagem: MENSAGENS_DE_ERRO.CONFLITO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }

/** A resposta sem o `requisicaoId`, que muda a cada chamada: o resto precisa ser idêntico. */
function semRequisicao(resposta: RespostaHttp): unknown {
  if (resposta.corpo.erro === undefined) return { status: resposta.status, corpo: resposta.corpo }
  const { requisicaoId: _requisicaoId, ...erro } = resposta.corpo.erro as Record<string, unknown>
  return { status: resposta.status, corpo: { ...resposta.corpo, erro } }
}

describe('lista de nomes da turma (A1, tarefa 2.0): prévia, gravação, avulso, retirada e leitura auditada', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const pedir = (sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)
  const previa = (e: EscolaComTurmas, turma: string, lista: string) => pedir(e.coordenacao, 'POST', `/v1/turmas/${turma}/lista/previa`, { texto: lista })
  const gravar = (e: EscolaComTurmas, turma: string, lista: string) => pedir(e.coordenacao, 'POST', `/v1/turmas/${turma}/lista`, { texto: lista })
  const avulso = (e: EscolaComTurmas, turma: string, corpo: unknown) => pedir(e.coordenacao, 'POST', `/v1/turmas/${turma}/lista/nome`, corpo)
  const ler = (e: EscolaComTurmas, turma: string, consulta = `?finalidade=${FINALIDADE}`) => pedir(e.coordenacao, 'GET', `/v1/turmas/${turma}/lista${consulta}`)
  const retirar = (e: EscolaComTurmas, id: string) => pedir(e.coordenacao, 'DELETE', `/v1/lista-nomes/${id}`)

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  async function turmaNova(coordenacao: SessaoDeTeste, serieId: string): Promise<string> {
    return criado(pedir(coordenacao, 'POST', '/v1/turmas', { serieId, nome: `turma ${randomUUID().slice(0, 8)}` }))
  }

  async function anoAberto(coordenacao: SessaoDeTeste, ano: number): Promise<string> {
    const id = await criado(pedir(coordenacao, 'POST', '/v1/anos-letivos', { ano, inicio: `${String(ano)}-02-01`, fim: `${String(ano)}-12-15` }))
    await criado(pedir(coordenacao, 'POST', `/v1/anos-letivos/${id}/abrir`), 200)
    return id
  }

  async function escolaComTurmas(): Promise<EscolaComTurmas> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const anoId = await anoAberto(coordenacao, 2026)
    const serieId = await criado(pedir(coordenacao, 'POST', '/v1/series', { etapa: 'ef_anos_finais', ano: 7 }))
    return { escolaId, coordenacao, anoId, serieId, t1: await turmaNova(coordenacao, serieId), t2: await turmaNova(coordenacao, serieId) }
  }

  /** Grava a lista e confere o 201 e as contagens. */
  async function gravada(e: EscolaComTurmas, turma: string, linhas: ReadonlyArray<readonly [string, string]>, contagens = { gravados: linhas.length, jaExistentes: 0 }) {
    const resposta = await gravar(e, turma, texto(linhas))
    expect(resposta.status).toBe(201)
    expect(resposta.corpo).toEqual(contagens)
  }

  interface LinhaNoBanco {
    readonly id: string
    readonly ano_letivo_id: string
    readonly turma_id: string
    readonly nome: string | null
    readonly matricula: string | null
    readonly estado: string
    readonly usuario_id: string | null
    readonly criado_por: string | null
  }

  /** As linhas da lista da escola, em ordem de id. */
  async function linhasDa(escolaId: string): Promise<LinhaNoBanco[]> {
    const { rows } = await bancada.pool.query<LinhaNoBanco>(
      'select id, ano_letivo_id, turma_id, nome, matricula, estado, usuario_id, criado_por from lista_nome where escola_id = $1 order by id',
      [escolaId],
    )
    return rows
  }

  /** O id da linha da lista com essa matrícula. */
  async function idDaMatricula(escolaId: string, qual: string): Promise<string> {
    const linha = (await linhasDa(escolaId)).find((gravada) => gravada.matricula === qual)
    if (linha === undefined) throw new Error('matrícula não está na lista')
    return linha.id
  }

  /** Tudo o que as rotas da lista podem gravar na escola: o que é recusado não muda nada disto. */
  async function retrato(escolaId: string) {
    const auditoria = await bancada.pool.query('select id, acao from auditoria where escola_id = $1 order by id', [escolaId])
    const turmas = await bancada.pool.query('select id, nome from turma where escola_id = $1 order by id', [escolaId])
    return { lista: await linhasDa(escolaId), auditoria: auditoria.rows, turmas: turmas.rows }
  }

  interface LinhaDeAuditoria {
    readonly entidade_id: string
    readonly autor_usuario_id: string | null
    readonly antes: Record<string, unknown> | null
    readonly depois: Record<string, unknown> | null
    readonly finalidade: string | null
  }

  async function auditoriaDa(escolaId: string, acao: string): Promise<LinhaDeAuditoria[]> {
    const { rows } = await bancada.pool.query<LinhaDeAuditoria>(
      'select entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = $2 order by em, id',
      [escolaId, acao],
    )
    return rows
  }

  /** Um aluno da escola com credencial por matrícula, como o aprovado terá (8.0). */
  async function alunoComMatricula(escolaId: string, qual = matricula()): Promise<{ usuarioId: string; matricula: string }> {
    const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula: qual, senhaHash: 'hash-sintetico' }])
    if (usuarioId === undefined) throw new Error('aluno não criado')
    return { usuarioId, matricula: qual }
  }

  describe('E4 (RF4): erro por linha, e nada gravado', () => {
    it('a prévia aponta cada linha ruim com o código, entre as boas; a gravação com erro do texto é ENTRADA_INVALIDA, com matrícula em uso é CONFLITO, e nenhuma grava nada', async () => {
      const e = await escolaComTurmas()
      const naOutraTurma = matricula()
      await gravada(e, e.t2, [[nome(), naOutraTurma]])
      const deAluno = (await alunoComMatricula(e.escolaId)).matricula
      const boas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const repetida = matricula()
      const semNome = matricula()
      const semMatricula = nome()
      const [b0, b1, b2, b3] = boas as [[string, string], [string, string], [string, string], [string, string]]
      const linhas: Array<[string, string]> = [b0, ['', semNome], b1, [semMatricula, ''], [`${PREFIXO} Rep A`, repetida], b2, [`${PREFIXO} Rep B`, repetida], [`${PREFIXO} Outra`, naOutraTurma], [`${PREFIXO} Aluno`, deAluno], b3]

      const lida = await previa(e, e.t1, texto(linhas))
      expect(lida.status).toBe(200)
      expect(previaDaListaResponseSchema.parse(lida.corpo)).toEqual({
        linhas: [
          { linha: 1, nome: b0[0], matricula: b0[1], resultado: 'entra' },
          { linha: 2, nome: '', matricula: semNome, resultado: 'erro', erro: 'sem_nome' },
          { linha: 3, nome: b1[0], matricula: b1[1], resultado: 'entra' },
          { linha: 4, nome: semMatricula, matricula: '', resultado: 'erro', erro: 'sem_matricula' },
          { linha: 5, nome: `${PREFIXO} Rep A`, matricula: repetida, resultado: 'erro', erro: 'matricula_repetida' },
          { linha: 6, nome: b2[0], matricula: b2[1], resultado: 'entra' },
          { linha: 7, nome: `${PREFIXO} Rep B`, matricula: repetida, resultado: 'erro', erro: 'matricula_repetida' },
          { linha: 8, nome: `${PREFIXO} Outra`, matricula: naOutraTurma, resultado: 'erro', erro: 'matricula_em_uso' },
          { linha: 9, nome: `${PREFIXO} Aluno`, matricula: deAluno, resultado: 'erro', erro: 'matricula_em_uso' },
          { linha: 10, nome: b3[0], matricula: b3[1], resultado: 'entra' },
        ],
        entram: 4,
        jaExistem: 0,
        comErro: 6,
      })

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await gravar(e, e.t1, texto(linhas)))).toEqual(ENTRADA_INVALIDA)
      // Sem erro do texto, a matrícula em uso, na lista da outra turma ou de aluno da escola, segura a gravação inteira.
      expect(semRequisicao(await gravar(e, e.t1, texto([...boas, [`${PREFIXO} Outra`, naOutraTurma]])))).toEqual(CONFLITO)
      expect(semRequisicao(await gravar(e, e.t1, texto([...boas, [`${PREFIXO} Aluno`, deAluno]])))).toEqual(CONFLITO)
      expect(await retrato(e.escolaId)).toEqual(antes)

      // As boas, sozinhas, gravam: o que segurou foi a linha ruim.
      await gravada(e, e.t1, boas)
    })

    it('201 linhas ou 64 KB + 1 byte na prévia e na gravação: ENTRADA_INVALIDA, e nada gravado; 200 linhas gravam', async () => {
      const e = await escolaComTurmas()
      const linhas = Array.from({ length: 201 }, (): [string, string] => [nome(), matricula()])
      const grande = texto([[nome(), 'x'.repeat(64 * 1024)]])
      const antes = await retrato(e.escolaId)
      for (const lista of [texto(linhas), grande]) {
        expect(semRequisicao(await previa(e, e.t1, lista))).toEqual(ENTRADA_INVALIDA)
        expect(semRequisicao(await gravar(e, e.t1, lista))).toEqual(ENTRADA_INVALIDA)
      }
      expect(await retrato(e.escolaId)).toEqual(antes)
      await gravada(e, e.t1, linhas.slice(0, 200))
    })
  })

  describe('E5: a matrícula é única por escola e por ano, nunca no sistema', () => {
    it('a matrícula da lista de outra escola entra; a que só existe na credencial de outra escola entra na lista e no avulso', async () => {
      const a = await escolaComTurmas()
      const b = await escolaComTurmas()
      const naListaDeA = matricula()
      const outraNaListaDeA = matricula()
      await gravada(a, a.t1, [
        [nome(), naListaDeA],
        [nome(), outraNaListaDeA],
      ])
      const lidaEmB = await previa(b, b.t1, texto([[nome(), naListaDeA]]))
      expect(lidaEmB.status).toBe(200)
      expect(lidaEmB.corpo['linhas']).toEqual([expect.objectContaining({ matricula: naListaDeA, resultado: 'entra' })])
      await gravada(b, b.t1, [[nome(), naListaDeA]])
      expect((await avulso(b, b.t1, { nome: nome(), matricula: outraNaListaDeA })).status).toBe(201)

      const deAlunoDeB = (await alunoComMatricula(b.escolaId)).matricula
      const outraDeAlunoDeB = (await alunoComMatricula(b.escolaId)).matricula
      const lidaEmA = await previa(a, a.t1, texto([[nome(), deAlunoDeB]]))
      expect(lidaEmA.corpo['linhas']).toEqual([expect.objectContaining({ matricula: deAlunoDeB, resultado: 'entra' })])
      await gravada(a, a.t1, [[nome(), deAlunoDeB]])
      expect((await avulso(a, a.t1, { nome: nome(), matricula: outraDeAlunoDeB })).status).toBe(201)

      expect((await linhasDa(b.escolaId)).map((linha) => linha.matricula).sort()).toEqual([naListaDeA, outraNaListaDeA].sort())
      expect((await linhasDa(a.escolaId)).map((linha) => linha.matricula).sort()).toEqual([naListaDeA, outraNaListaDeA, deAlunoDeB, outraDeAlunoDeB].sort())
    })

    it('a matrícula da lista do ano encerrado entra no ano em curso; o nome livre de lá saiu no encerramento (10.0), e a turma de lá não ganha nome', async () => {
      const e = await escolaComTurmas()
      const de2026 = matricula()
      const outraDe2026 = matricula()
      await gravada(e, e.t1, [
        [nome(), de2026],
        [nome(), outraDe2026],
      ])
      const livreDe2026 = await idDaMatricula(e.escolaId, de2026)
      await criado(pedir(e.coordenacao, 'POST', `/v1/anos-letivos/${e.anoId}/encerrar`), 200)
      // O encerramento apagou os nomes livres do ano (10.0, V1).
      expect((await linhasDa(e.escolaId)).filter((linha) => linha.ano_letivo_id === e.anoId)).toEqual([])
      const de2027Ano = await anoAberto(e.coordenacao, 2027)
      const de2027 = await turmaNova(e.coordenacao, e.serieId)

      const lida = await previa(e, de2027, texto([[nome(), de2026]]))
      expect(lida.corpo['linhas']).toEqual([expect.objectContaining({ matricula: de2026, resultado: 'entra' })])
      await gravada(e, de2027, [[nome(), de2026]])
      expect((await avulso(e, de2027, { nome: nome(), matricula: outraDe2026 })).status).toBe(201)

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await retirar(e, livreDe2026))).toEqual(NAO_ENCONTRADO)
      // A turma do ano encerrado também não se lê nem ganha nome por aqui.
      for (const resposta of [
        await previa(e, e.t1, texto([[nome(), matricula()]])),
        await gravar(e, e.t1, texto([[nome(), matricula()]])),
        await avulso(e, e.t1, { nome: nome(), matricula: matricula() }),
        await ler(e, e.t1),
      ]) {
        expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
      }
      expect(await retrato(e.escolaId)).toEqual(antes)
      // A matrícula de 2026 agora só na lista de 2027.
      expect((await linhasDa(e.escolaId)).filter((linha) => linha.matricula === de2026).map((linha) => linha.ano_letivo_id)).toEqual([de2027Ano])
    })
  })

  describe('E6 (RF5): reenviar acrescenta só o que falta, pela matrícula', () => {
    it('a mesma lista duas vezes não muda a contagem; o que já está na lista da turma sai `ja_existe`, mesmo com outro nome; um nome novo acrescenta só ele', async () => {
      const e = await escolaComTurmas()
      const linhas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      await gravada(e, e.t1, linhas)
      await gravada(e, e.t1, linhas, { gravados: 0, jaExistentes: 3 })
      expect(await linhasDa(e.escolaId)).toHaveLength(3)

      const [primeira] = linhas as [[string, string]]
      const comOutroNome: Array<[string, string]> = [...linhas.slice(1), [`${PREFIXO} Outro Nome`, primeira[1]]]
      const lida = await previa(e, e.t1, texto(comOutroNome))
      expect(lida.corpo['linhas']).toEqual(comOutroNome.map(([quem, qual]) => expect.objectContaining({ nome: quem, matricula: qual, resultado: 'ja_existe' })))
      expect(lida.corpo).toEqual(expect.objectContaining({ entram: 0, jaExistem: 3, comErro: 0 }))

      const nova = matricula()
      await gravada(e, e.t1, [...comOutroNome, [nome(), nova]], { gravados: 1, jaExistentes: 3 })

      // Dois alunos com o mesmo nome e matrículas diferentes entram os dois: só a matrícula decide.
      const homonimo = nome()
      const homonimos: Array<[string, string]> = [
        [homonimo, matricula()],
        [homonimo, matricula()],
      ]
      const lidaHomonimos = await previa(e, e.t2, texto(homonimos))
      expect(lidaHomonimos.corpo).toEqual(expect.objectContaining({ entram: 2, jaExistem: 0, comErro: 0 }))
      await gravada(e, e.t2, homonimos)
      const daT2 = (await linhasDa(e.escolaId)).filter((linha) => linha.turma_id === e.t2)
      expect(daT2.map((linha) => [linha.nome, linha.matricula]).sort()).toEqual([...homonimos].sort())
      const gravadas = (await linhasDa(e.escolaId)).filter((linha) => linha.turma_id === e.t1)
      expect(gravadas).toHaveLength(4)
      for (const linha of gravadas) expect(linha).toEqual(expect.objectContaining({ turma_id: e.t1, ano_letivo_id: e.anoId, estado: 'livre', usuario_id: null, criado_por: e.coordenacao.usuarioId }))
      // O nome da linha que já existia não muda: a matrícula decide.
      expect(gravadas.find((linha) => linha.matricula === primeira[1])?.nome).toBe(primeira[0])
    })
  })

  describe('E7 (RF5): nome avulso e retirada do nome livre', () => {
    it('o avulso entra livre, sem espaço nas pontas e com quem gravou; sem nome ou sem matrícula, ENTRADA_INVALIDA; com a matrícula na lista da turma, na de outra turma ou de aluno da escola, CONFLITO; nada gravado nos cinco', async () => {
      const e = await escolaComTurmas()
      const naT1 = matricula()
      const naT2 = matricula()
      await gravada(e, e.t1, [[nome(), naT1]])
      await gravada(e, e.t2, [[nome(), naT2]])
      const deAluno = (await alunoComMatricula(e.escolaId)).matricula

      const quem = nome()
      const qual = matricula()
      const criadoAvulso = await avulso(e, e.t1, { nome: `  ${quem} `, matricula: ` ${qual}  ` })
      expect(criadoAvulso.status).toBe(201)
      expect(criadoAvulso.corpo).toEqual({ id: expect.any(String), nome: quem, matricula: qual, estado: 'livre' })
      expect((await linhasDa(e.escolaId)).find((linha) => linha.id === criadoAvulso.corpo['id'])).toEqual(
        expect.objectContaining({ turma_id: e.t1, ano_letivo_id: e.anoId, nome: quem, matricula: qual, estado: 'livre', usuario_id: null, criado_por: e.coordenacao.usuarioId }),
      )

      const antes = await retrato(e.escolaId)
      const recusas: Array<readonly [unknown, unknown]> = [
        [{ nome: '', matricula: matricula() }, ENTRADA_INVALIDA],
        [{ nome: nome(), matricula: '   ' }, ENTRADA_INVALIDA],
        [{ nome: nome() }, ENTRADA_INVALIDA],
        [{ nome: nome(), matricula: naT1 }, CONFLITO],
        [{ nome: nome(), matricula: naT2 }, CONFLITO],
        [{ nome: nome(), matricula: deAluno }, CONFLITO],
      ]
      for (const [corpo, esperado] of recusas) expect(semRequisicao(await avulso(e, e.t1, corpo)), JSON.stringify(corpo)).toEqual(esperado)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('retirar o nome livre apaga a linha, e só ela; o reivindicado e o aprovado dão CONFLITO e ficam; o id sorteado e o segundo retirar do mesmo nome, NAO_ENCONTRADO', async () => {
      const e = await escolaComTurmas()
      const livre = matricula()
      const reivindicada = matricula()
      const outra = matricula()
      await gravada(e, e.t1, [
        [nome(), livre],
        [nome(), reivindicada],
        [nome(), outra],
      ])
      const idLivre = await idDaMatricula(e.escolaId, livre)
      const idReivindicado = await idDaMatricula(e.escolaId, reivindicada)
      // O pedido do aluno chega na 6.0; aqui o estado é posto no banco, com o nome e a matrícula que o check exige.
      await bancada.pool.query(`update lista_nome set estado = 'reivindicado' where id = $1`, [idReivindicado])

      const retirada = await retirar(e, idLivre)
      expect(retirada.status).toBe(204)
      expect(retirada.corpo).toEqual({})
      expect((await linhasDa(e.escolaId)).map((linha) => [linha.matricula, linha.estado])).toEqual([
        [reivindicada, 'reivindicado'],
        [outra, 'livre'],
      ])

      // O aprovado chega na 8.0; aqui a linha é posta no banco como o check exige: com o usuário, sem nome nem matrícula.
      const { usuarioId } = await alunoComMatricula(e.escolaId)
      const { rows: aprovados } = await bancada.pool.query<{ id: string }>(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4) returning id`,
        [e.escolaId, e.anoId, e.t1, usuarioId],
      )
      const idAprovado = aprovados[0]?.id ?? ''

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await retirar(e, idReivindicado))).toEqual(CONFLITO)
      expect(semRequisicao(await retirar(e, idAprovado))).toEqual(CONFLITO)
      expect(semRequisicao(await retirar(e, idLivre))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await retirar(e, randomUUID()))).toEqual(NAO_ENCONTRADO)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('clique duplo: o mesmo avulso duas vezes em paralelo entra uma vez (a outra, CONFLITO); a mesma retirada duas vezes, uma 204 e a outra NAO_ENCONTRADO', async () => {
      const e = await escolaComTurmas()
      const corpo = { nome: nome(), matricula: matricula() }
      const avulsos = await Promise.all([avulso(e, e.t1, corpo), avulso(e, e.t1, corpo)])
      expect(avulsos.map((resposta) => resposta.status).sort()).toEqual([201, 409])
      expect((await linhasDa(e.escolaId)).map((linha) => linha.matricula)).toEqual([corpo.matricula])
      expect(await auditoriaDa(e.escolaId, 'lista.gravada')).toHaveLength(1)

      const id = await idDaMatricula(e.escolaId, corpo.matricula)
      const retiradas = await Promise.all([retirar(e, id), retirar(e, id)])
      expect(retiradas.map((resposta) => resposta.status).sort()).toEqual([204, 404])
      expect(await linhasDa(e.escolaId)).toEqual([])
      expect(await auditoriaDa(e.escolaId, 'lista_nome.retirado')).toHaveLength(1)
    })

    it('E2 (lista): a turma com nome na lista não se exclui, e nada é apagado; sem o nome, sai', async () => {
      const e = await escolaComTurmas()
      const qual = matricula()
      await gravada(e, e.t1, [[nome(), qual]])
      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await pedir(e.coordenacao, 'DELETE', `/v1/turmas/${e.t1}`))).toEqual(CONFLITO)
      expect(await retrato(e.escolaId)).toEqual(antes)

      expect((await retirar(e, await idDaMatricula(e.escolaId, qual))).status).toBe(204)
      expect((await pedir(e.coordenacao, 'DELETE', `/v1/turmas/${e.t1}`)).status).toBe(204)
    })
  })

  /**
   * G2 da validação da A1 (correção `2026-10-03-trava-de-documento-so-na-tela`; regra 00, item 1; regra 20, item 2): a
   * matrícula com forma de CPF ou de data é recusada pela API, sem a tela no caminho. CPFs sintéticos, com o dígito
   * verificador calculado.
   */
  describe('G2: a matrícula com forma de documento, recusada pela API', () => {
    const CPFS_SEM_PONTUACAO = ['12345678909', '52998224725', '11144477735'] as const

    it('G2: a matrícula com forma de CPF ou de data é recusada pela API na prévia (linha com `matricula_parece_documento`), na gravação e no avulso (ENTRADA_INVALIDA), e nada é gravado', async () => {
      const e = await escolaComTurmas()
      for (const documento of ['123.456.789-09', '01/02/2012', '1/2/12', '2012-02-01']) {
        const boa: [string, string] = [nome(), matricula()]
        const suspeita: [string, string] = [nome(), documento]
        const lista = texto([boa, suspeita])

        const lida = await previa(e, e.t1, lista)
        expect(lida.status, documento).toBe(200)
        expect(previaDaListaResponseSchema.parse(lida.corpo), documento).toEqual({
          linhas: [
            { linha: 1, nome: boa[0], matricula: boa[1], resultado: 'entra' },
            { linha: 2, nome: suspeita[0], matricula: documento, resultado: 'erro', erro: 'matricula_parece_documento' },
          ],
          entram: 1,
          jaExistem: 0,
          comErro: 1,
        })

        const antes = await retrato(e.escolaId)
        expect(semRequisicao(await gravar(e, e.t1, lista)), documento).toEqual(ENTRADA_INVALIDA)
        expect(semRequisicao(await avulso(e, e.t1, { nome: nome(), matricula: documento })), documento).toEqual(ENTRADA_INVALIDA)
        // Com espaço nas pontas, que o contrato tira antes de conferir.
        expect(semRequisicao(await avulso(e, e.t1, { nome: nome(), matricula: `  ${documento} ` })), documento).toEqual(ENTRADA_INVALIDA)
        expect(await retrato(e.escolaId), documento).toEqual(antes)
      }
      // Controle: a mesma lista sem a linha suspeita grava, e o avulso com matrícula normal entra.
      await gravada(e, e.t1, [[nome(), matricula()]])
      expect((await avulso(e, e.t1, { nome: nome(), matricula: matricula() })).status).toBe(201)
    })

    it('G2: a lista com maioria de CPF sem pontuação é marcada como coluna de CPF: cada CPF sai com `matricula_parece_documento`, a gravação é recusada, e nada é gravado', async () => {
      const e = await escolaComTurmas()
      const [a, b, c] = CPFS_SEM_PONTUACAO
      const outra = matricula()
      const linhas: Array<[string, string]> = [
        [nome(), a],
        [nome(), b],
        [nome(), outra],
        [nome(), c],
      ]
      const lida = await previa(e, e.t1, texto(linhas))
      expect(lida.status).toBe(200)
      const resposta = previaDaListaResponseSchema.parse(lida.corpo)
      expect(resposta.linhas.map((linha) => [linha.matricula, linha.resultado, linha.erro])).toEqual([
        [a, 'erro', 'matricula_parece_documento'],
        [b, 'erro', 'matricula_parece_documento'],
        [outra, 'entra', undefined],
        [c, 'erro', 'matricula_parece_documento'],
      ])
      expect({ entram: resposta.entram, comErro: resposta.comErro }).toEqual({ entram: 1, comErro: 3 })

      const antes = await retrato(e.escolaId)
      expect(semRequisicao(await gravar(e, e.t1, texto(linhas)))).toEqual(ENTRADA_INVALIDA)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('G2: o CPF sem pontuação que não é maioria não é marcado: a lista com um só entre matrículas normais grava, e o avulso sozinho entra (matrícula numérica de 11 algarismos)', async () => {
      const e = await escolaComTurmas()
      const [a, b] = CPFS_SEM_PONTUACAO
      const linhas: Array<[string, string]> = [
        [nome(), a],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const lida = previaDaListaResponseSchema.parse((await previa(e, e.t1, texto(linhas))).corpo)
      expect(lida.comErro).toBe(0)
      await gravada(e, e.t1, linhas)
      expect((await avulso(e, e.t1, { nome: nome(), matricula: b })).status).toBe(201)
    })
  })

  describe('o banco: o check e as FKs da `lista_nome`', () => {
    /** O SQLSTATE e a restrição do erro do `insert`, ou `ok`. */
    async function resultadoDo(consulta: Promise<unknown>): Promise<string> {
      try {
        await consulta
        return 'ok'
      } catch (erro) {
        const { code, constraint } = erro as { code?: string; constraint?: string }
        return `${String(code)} ${String(constraint)}`
      }
    }

    it('aprovado ⇔ usuário ⇔ nome e matrícula nulos: cada combinação errada falha com 23514; as certas entram; estado, formato e usuário de outra escola também são recusados', async () => {
      const e = await escolaComTurmas()
      const { usuarioId } = await alunoComMatricula(e.escolaId)
      const deOutraEscola = (await alunoComMatricula((await escolaComTurmas()).escolaId)).usuarioId
      const inserir = (estado: string, usuario: string | null, quem: string | null, qual: string | null) =>
        bancada.pool.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id, nome, matricula) values ($1, $2, $3, $4, $5, $6, $7)', [
          e.escolaId,
          e.anoId,
          e.t1,
          estado,
          usuario,
          quem,
          qual,
        ])
      const CHECK = '23514 lista_nome_aprovado_sem_nome'
      const casos: Array<readonly [string, string | null, string | null, string | null, string]> = [
        ['aprovado', usuarioId, nome(), matricula(), CHECK],
        ['aprovado', usuarioId, null, matricula(), CHECK],
        ['aprovado', usuarioId, nome(), null, CHECK],
        ['aprovado', null, null, null, CHECK],
        ['livre', usuarioId, nome(), matricula(), CHECK],
        ['livre', null, nome(), null, CHECK],
        ['reivindicado', null, null, matricula(), CHECK],
        ['livre', null, null, null, CHECK],
        ['aprovado', usuarioId, null, null, 'ok'],
        ['reivindicado', null, nome(), matricula(), 'ok'],
        ['livre', null, nome(), matricula(), 'ok'],
        ['pendente', null, nome(), matricula(), '23514 lista_nome_estado_valido'],
        ['livre', null, ` ${nome()}`, matricula(), '23514 lista_nome_nome_formato'],
        ['livre', null, 'n'.repeat(201), matricula(), '23514 lista_nome_nome_formato'],
        ['livre', null, nome(), `${matricula()} `, '23514 lista_nome_matricula_formato'],
        ['livre', null, nome(), 'm'.repeat(41), '23514 lista_nome_matricula_formato'],
        ['aprovado', deOutraEscola, null, null, '23503 lista_nome_usuario_da_escola_fk'],
      ]
      for (const [estado, usuario, quem, qual, esperado] of casos) {
        expect(await resultadoDo(inserir(estado, usuario, quem, qual)), `${estado} usuário=${String(usuario !== null)} nome=${String(quem !== null)} matrícula=${String(qual !== null)}`).toBe(esperado)
      }
    })

    it('quem gravou vira nulo quando é eliminado, e a linha fica, com a escola; o autor de outra escola é recusado pela FK', async () => {
      const e = await escolaComTurmas()
      const outra = await escolaComTurmas()
      const autor = await bancada.equipeComEmail(e.escolaId, `autor-${randomUUID()}@escola.invalid`, 'coordenador')
      const deOutraEscola = await bancada.equipeComEmail(outra.escolaId, `autor-${randomUUID()}@escola.invalid`, 'coordenador')
      const inserir = (criadoPor: string) =>
        bancada.pool.query<{ id: string }>(
          'insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, criado_por) values ($1, $2, $3, $4, $5, $6) returning id',
          [e.escolaId, e.anoId, e.t1, nome(), matricula(), criadoPor],
        )
      expect(await resultadoDo(inserir(deOutraEscola.usuarioId))).toBe('23503 lista_nome_criado_por_da_escola_fk')
      const { rows } = await inserir(autor.usuarioId)
      const id = rows[0]?.id

      await bancada.pool.query('delete from usuario where id = $1', [autor.usuarioId])
      expect((await linhasDa(e.escolaId)).find((linha) => linha.id === id)).toEqual(expect.objectContaining({ turma_id: e.t1, criado_por: null, estado: 'livre' }))
    })
  })

  describe('A1 e A2: a auditoria da lista, só com ids e contagens', () => {
    it('`lista.gravada` leva os ids que entraram e as contagens, com o autor, também no avulso; `lista_nome.retirado` leva a turma do nome', async () => {
      const e = await escolaComTurmas()
      const jaNaLista = matricula()
      await gravada(e, e.t1, [[nome(), jaNaLista]])
      const nova = matricula()
      await gravada(e, e.t1, [
        [nome(), jaNaLista],
        [nome(), nova],
      ], { gravados: 1, jaExistentes: 1 })
      const idNova = await idDaMatricula(e.escolaId, nova)
      const doAvulso = await avulso(e, e.t1, { nome: nome(), matricula: matricula() })
      expect(doAvulso.status).toBe(201)

      const gravadas = await auditoriaDa(e.escolaId, 'lista.gravada')
      expect(gravadas.slice(1)).toEqual([
        { entidade_id: e.t1, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { ids: [idNova], gravados: 1, jaExistentes: 1 }, finalidade: null },
        { entidade_id: e.t1, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { ids: [doAvulso.corpo['id']], gravados: 1, jaExistentes: 0 }, finalidade: null },
      ])

      expect((await retirar(e, idNova)).status).toBe(204)
      expect(await auditoriaDa(e.escolaId, 'lista_nome.retirado')).toEqual([
        { entidade_id: idNova, autor_usuario_id: e.coordenacao.usuarioId, antes: { turmaId: e.t1, estado: 'livre' }, depois: null, finalidade: null },
      ])
    })

    it('A2: cada leitura da lista grava `turma.lista_lida` com a finalidade e a quantidade, também a repetida; sem finalidade, ENTRADA_INVALIDA igual para a turma dela, a de outra escola e um id sorteado, e nada é gravado', async () => {
      const e = await escolaComTurmas()
      const b = await escolaComTurmas()
      await gravada(e, e.t1, [
        [nome(), matricula()],
        [nome(), matricula()],
      ])
      expect((await ler(e, e.t1)).status).toBe(200)
      expect((await ler(e, e.t1)).status).toBe(200)
      expect((await ler(e, e.t1, `?finalidade=atendimento_a_familia&limite=1`)).status).toBe(200)
      const registro = (quantidade: number, finalidade: string) => ({ entidade_id: e.t1, autor_usuario_id: e.coordenacao.usuarioId, antes: null, depois: { quantidade }, finalidade })
      expect(await auditoriaDa(e.escolaId, 'turma.lista_lida')).toEqual([registro(2, FINALIDADE), registro(2, FINALIDADE), registro(1, 'atendimento_a_familia')])

      const antes = await retrato(e.escolaId)
      const semFinalidade = [await ler(e, e.t1, ''), await ler(e, b.t1, ''), await ler(e, randomUUID(), '?limite=5')]
      for (const resposta of semFinalidade) expect(semRequisicao(resposta)).toEqual(ENTRADA_INVALIDA)
      expect(semRequisicao(await ler(e, e.t1, '?finalidade=curiosidade'))).toEqual(ENTRADA_INVALIDA)
      // A escola e o ano vêm da sessão: pedi-los na consulta é campo a mais.
      expect(semRequisicao(await ler(e, e.t1, `?finalidade=${FINALIDADE}&escolaId=${b.escolaId}`))).toEqual(ENTRADA_INVALIDA)
      expect(await retrato(e.escolaId)).toEqual(antes)
    })

    it('a leitura traz só os nomes da turma, com matrícula e estado, em ordem de id, paginada', async () => {
      const e = await escolaComTurmas()
      const daT1: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      await gravada(e, e.t1, daT1)
      await gravada(e, e.t2, [[nome(), matricula()]])
      const ids = await Promise.all(daT1.map(([, qual]) => idDaMatricula(e.escolaId, qual)))
      const esperados = daT1.map(([quem, qual], posicao) => ({ id: ids[posicao], nome: quem, matricula: qual, estado: 'livre' })).sort((x, y) => String(x.id).localeCompare(String(y.id)))

      const primeira = await ler(e, e.t1, `?finalidade=${FINALIDADE}&limite=2`)
      expect(primeira.status).toBe(200)
      expect(listaDaTurmaResponseSchema.parse(primeira.corpo)).toEqual({ itens: esperados.slice(0, 2), proxima: esperados[1]?.id })
      const segunda = await ler(e, e.t1, `?finalidade=${FINALIDADE}&limite=2&pagina=${String(primeira.corpo['proxima'])}`)
      expect(segunda.corpo).toEqual({ itens: esperados.slice(2) })
    })
  })

  describe('concorrência (regra 80, item 7)', () => {
    /** Para a gravação na turma depois do `insert` dela, antes do commit. */
    const pararNaTurma = (turma: string) => new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'insert', quando: `new.turma_id = '${turma}'::uuid` })

    it('C8: a mesma lista gravada duas vezes em paralelo entra uma vez; as duas respondem 201, e a segunda conta tudo como já existente', async () => {
      const e = await escolaComTurmas()
      // A turma já tem um nome, fora da lista: a segunda gravação confere só as matrículas dela.
      await gravada(e, e.t1, [[nome(), matricula()]])
      const linhas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const gatilho = pararNaTurma(e.t1)
      await gatilho.armar()
      try {
        const ambas = Promise.all([gravar(e, e.t1, texto(linhas)), gravar(e, e.t1, texto(linhas))])
        // Uma parou depois do `insert`, sem commit; a outra leu a lista antes dele e espera no índice único.
        await gatilho.esperarParadas(1)
        await esperarNaTrava(bancada.pool, '%insert into "lista_nome"%', 2)
        await gatilho.soltar()
        const respostas = await ambas
        expect(respostas.map((resposta) => resposta.status)).toEqual([201, 201])
        expect(respostas.map((resposta) => resposta.corpo).sort((x, y) => Number(y['gravados']) - Number(x['gravados']))).toEqual([
          { gravados: 3, jaExistentes: 0 },
          { gravados: 0, jaExistentes: 3 },
        ])
      } finally {
        await gatilho.desarmar()
      }
      expect(await linhasDa(e.escolaId)).toHaveLength(4)
    })

    it('a mesma matrícula gravada ao mesmo tempo em duas turmas: uma grava; a outra, que leu a lista antes, responde CONFLITO e não grava nada', async () => {
      const e = await escolaComTurmas()
      const linhas: Array<[string, string]> = [
        [nome(), matricula()],
        [nome(), matricula()],
      ]
      const gatilho = pararNaTurma(e.t1)
      await gatilho.armar()
      try {
        const naT1 = gravar(e, e.t1, texto(linhas))
        await gatilho.esperarParadas(1)
        const naT2 = gravar(e, e.t2, texto(linhas))
        await esperarNaTrava(bancada.pool, '%insert into "lista_nome"%', 2)
        await gatilho.soltar()
        expect((await naT1).status).toBe(201)
        expect(semRequisicao(await naT2)).toEqual(CONFLITO)
      } finally {
        await gatilho.desarmar()
      }
      expect((await linhasDa(e.escolaId)).map((linha) => linha.turma_id)).toEqual([e.t1, e.t1])
      expect((await auditoriaDa(e.escolaId, 'lista.gravada')).map((registro) => registro.entidade_id)).toEqual([e.t1])
    })

    it('C9: excluir a turma enquanto a lista grava: a lista grava, e o excluir recebe CONFLITO', async () => {
      const e = await escolaComTurmas()
      const gatilho = pararNaTurma(e.t1)
      await gatilho.armar()
      try {
        const gravacao = gravar(e, e.t1, texto([[nome(), matricula()]]))
        await gatilho.esperarParadas(1)
        const exclusao = pedir(e.coordenacao, 'DELETE', `/v1/turmas/${e.t1}`)
        // Desde a 4.0 o excluir trava a turma em `for update` num comando próprio, antes do `delete`: é nele que espera.
        await esperarNaTrava(bancada.pool, '%from "turma"%for update%')
        await gatilho.soltar()
        expect((await gravacao).status).toBe(201)
        expect(semRequisicao(await exclusao)).toEqual(CONFLITO)
      } finally {
        await gatilho.desarmar()
      }
      expect((await linhasDa(e.escolaId)).map((linha) => linha.turma_id)).toEqual([e.t1])
    })

    it('C9: a turma que sai enquanto a lista espera por ela: a gravação e o avulso recebem NAO_ENCONTRADO, e nada é gravado', async () => {
      const e = await escolaComTurmas()
      const escritas = [(turma: string) => gravar(e, turma, texto([[nome(), matricula()]])), (turma: string) => avulso(e, turma, { nome: nome(), matricula: matricula() })]
      for (const escrever of escritas) {
        const turma = await turmaNova(e.coordenacao, e.serieId)
        const exclusao = await bancada.pool.connect()
        try {
          await exclusao.query('begin')
          await exclusao.query('delete from turma where id = $1', [turma])
          const escrita = escrever(turma)
          await esperarNaTrava(bancada.pool, '%from "turma"%for key share%')
          await exclusao.query('commit')
          expect(semRequisicao(await escrita)).toEqual(NAO_ENCONTRADO)
        } finally {
          exclusao.release()
        }
      }
      expect(await linhasDa(e.escolaId)).toEqual([])
    })
  })

  it('log (A4): as rotas da lista, com e sem erro, não logam nome, matrícula nem o texto', async () => {
    const e = await escolaComTurmas()
    const CPF_SENTINELA = '987.654.321-00'
    const quem = `${PREFIXO} Sentinela ${randomUUID().slice(0, 8)}`
    const qual = `${PREFIXO}-sentinela-${randomUUID().slice(0, 8)}`
    linhasDeLog.length = 0
    const respostas = [
      await previa(e, e.t1, texto([[quem, qual], ['', qual]])),
      await gravar(e, e.t1, texto([[quem, qual], ['', qual]])),
      await gravar(e, e.t1, texto([[quem, qual]])),
      await gravar(e, e.t2, texto([[quem, qual]])),
      await avulso(e, e.t2, { nome: quem, matricula: qual }),
      await avulso(e, e.t2, { nome: quem }),
      // G2: a matrícula com forma de documento recusada não vai ao log, nem a linha dela na prévia.
      await avulso(e, e.t2, { nome: quem, matricula: CPF_SENTINELA }),
      await previa(e, e.t1, texto([[quem, CPF_SENTINELA]])),
      await ler(e, e.t1),
      await ler(e, e.t1, ''),
      await retirar(e, await idDaMatricula(e.escolaId, qual)),
      await retirar(e, randomUUID()),
    ]
    expect(respostas.map((resposta) => resposta.status)).toEqual([200, 400, 201, 409, 409, 400, 400, 200, 200, 400, 204, 404])
    const linhas = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>)
    expect(linhas.filter((linha) => linha['evento'] === 'http.erro')).toHaveLength(7)
    const todoOLog = linhasDeLog.join('\n')
    for (const sentinela of [quem, qual, PREFIXO, CPF_SENTINELA]) expect(todoOLog).not.toContain(sentinela)
  })
})
