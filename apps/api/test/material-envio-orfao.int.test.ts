import { createLogger, FileStorageUnavailableError, InMemoryFileStorage, runInContext, type Clock, type Database } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { criarVarreduraDeTemporarios } from '../../worker/src/processors/varrer-envios.js'
import { jobExecution } from '../../worker/test/job-execution.fixture.js'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DB } from '../src/database.module.js'
import { montarEscolaComTurma as montarEscola, type EscolaComTurma } from './escola-turma.fixture.js'
import { apagarMateriais, auditoriaDa, enviarEdicaoDeMaterial, enviarMaterial, esperarExtracao, materiaisDa, materiaisJaEnviados, PDF_DE_DEMONSTRACAO, registrarLicencaDeTeste } from './material.fixture.js'
import { SessaoFixtures } from './sessao.fixture.js'
import { chamar, subirApi, type RespostaHttp, type TestApi } from './test-api.js'
import { aguardar, esperarNaTrava, WriteBlockTrigger } from './write-block-trigger.js'

// O envio de material que deixa PDF no storage sem commit (ingestao-do-material, tarefa 2.0; Tech Spec, seção 5, "Envio e edição"; onda 3b, 3. Falha, "Órfão"), pela API de verdade,
// com o armazém em memória: a linha de `envio_de_material` nasce antes do `guardarBytes` e sai na transação; toda saída depois do `guardarBytes` apaga o objeto e só então a
// linha; a varredura horária (`criarVarreduraDeTemporarios`, a do worker, com o `Clock` do teste) apaga o que sobrou. A varredura em si, sem a API, está em
// `apps/worker/test/varrer-envios.int.test.ts`.

const MINUTO_MS = 60_000

/** Um relógio que o teste move: a varredura roda 61 min depois do envio, do mesmo relógio que a linha usou. */
class RelogioMovel implements Clock {
  constructor(public emMs: number) {}
  agora(): Date {
    return new Date(this.emMs)
  }
}

function armazemDe(api: TestApi): InMemoryFileStorage {
  if (!(api.armazem instanceof InMemoryFileStorage)) throw new Error('a API do teste não tem o armazém em memória')
  return api.armazem
}

const objetosDaEscola = (api: TestApi, escolaId: string): string[] => [...armazemDe(api).bytes.keys()].filter((chave) => chave.startsWith(`material-temporario/${escolaId}/`))

describe('o envio de material não deixa PDF para trás', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  const escolasDoTeste: string[] = []

  async function montarEscolaComTurma(): Promise<EscolaComTurma> {
    const escola = await montarEscola(api, bancada)
    escolasDoTeste.push(escola.coordenacao.escolaId)
    return escola
  }

  const erroDe = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo })

  /** As chaves de um aviso do log além das que o log do processo põe em toda linha (a escola e a pessoa do contexto da requisição entram pelo contexto): só ids, o erro e o evento, nunca título, arquivo nem chave do objeto. */
  const chavesDoAviso = (aviso: Record<string, unknown>): string[] => Object.keys(aviso).filter((chave) => !['level', 'time', 'servico', 'requisicaoId'].includes(chave)).toSorted()

  /** As linhas de `envio_de_material` da escola. */
  async function linhasDoEnvio(escolaId: string): Promise<string[]> {
    const { rows } = await bancada.pool.query<{ material_id: string }>('select material_id from envio_de_material where escola_id = $1 order by criado_em', [escolaId])
    return rows.map((linha) => linha.material_id)
  }

  /**
   * A varredura do worker, no armazém desta API, rodando `depoisDeMin` minutos adiante do relógio do teste. Ela olha **todas** as escolas e o banco de teste acumula
   * as de outras execuções: o que este arquivo afirma é só sobre as linhas e os objetos das escolas dele, e rodar a varredura sobre o banco inteiro só é seguro
   * porque o projeto `integracao` roda um arquivo por vez (`fileParallelism: false`); com arquivos em paralelo, outro teste teria o objeto apagado no meio do caso.
   */
  function varrer(depoisDeMin: number): Promise<void> {
    const logger = createLogger({ servico: 'worker-teste', nivel: 'silent' })
    const processador = criarVarreduraDeTemporarios({ banco: api.app.get<Database>(DB), armazem: armazemDe(api), relogio: new RelogioMovel(Date.now() + depoisDeMin * MINUTO_MS), logger })
    return runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, jobExecution(randomUUID())))
  }

  /**
   * Troca o `guardarBytes` do armazém desta API por um que roda `depois` logo que o objeto foi gravado (ou, com `falhar`, grava e lança o que o storage lançaria): é onde o
   * teste põe o que acontece entre o `guardarBytes` e a transação. Devolve como desfazer a troca.
   */
  function aoGuardar(opcoes: { antes?: () => Promise<void>; depois?: (chave: string) => Promise<void>; falhar?: Error }): () => void {
    const armazem = armazemDe(api)
    const original = armazem.guardarBytes.bind(armazem)
    armazem.guardarBytes = async (chave, bytes, prazo) => {
      await opcoes.antes?.()
      await original(chave, bytes, prazo)
      // O PUT chegou, mas a resposta não: o envio não sabe se o objeto está lá.
      if (opcoes.falhar !== undefined) throw opcoes.falhar
      await opcoes.depois?.(chave)
    }
    return () => {
      armazem.guardarBytes = original
    }
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, {}, linhasDeLog)
  })

  beforeEach(async () => {
    // A varredura olha todas as escolas: a linha de outro caso (ou de outro arquivo) não entra nas contas deste.
    await bancada.pool.query('delete from envio_de_material')
  })

  afterEach(() => {
    linhasDeLog.length = 0
  })

  afterAll(async () => {
    await api.app.close()
    await apagarMateriais(bancada, escolasDoTeste)
    await bancada.fechar()
    await medidor.encerrar()
  })

  it('caminho feliz: a linha existe antes do `guardarBytes` e não sobra depois do commit', async () => {
    const escola = await montarEscolaComTurma()
    const vistas: string[][] = []
    const desfazer = aoGuardar({ antes: async () => void vistas.push(await linhasDoEnvio(escola.coordenacao.escolaId)) })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      desfazer()
    }

    expect(resposta.status).toBe(201)
    expect(vistas).toHaveLength(1)
    expect(vistas[0]).toHaveLength(1)
    expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toEqual([])
    await esperarExtracao(api)
  })

  it('`CONFLITO` depois do `guardarBytes`: o objeto e a linha saem', async () => {
    const escola = await montarEscolaComTurma()
    expect((await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).status).toBe(201)
    await esperarExtracao(api)

    const repetido = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })

    expect(erroDe(repetido)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([])
    expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toEqual([])
  })

  it('a edição com o arquivo do alvo, `CONFLITO` depois do `guardarBytes`: o objeto e a linha saem, e continua um material só (8.0)', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const alvo = (await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).corpo['id'] as string
    await esperarExtracao(api)

    const repetida = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, {}, PDF_DE_DEMONSTRACAO)

    expect(erroDe(repetida)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(objetosDaEscola(api, escolaId)).toEqual([])
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    expect((await materiaisDa(bancada, escolaId)).map((material) => material.id)).toEqual([alvo])
  })

  it('a segunda edição sobre o mesmo alvo, `EDICAO_EM_ANDAMENTO` sob a trava: o objeto e a linha saem, e a primeira segue (8.0)', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const alvo = (await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).corpo['id'] as string
    await esperarExtracao(api)
    const primeira = (await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'primeira' })).corpo['id'] as string

    const segunda = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'segunda' })

    expect(erroDe(segunda)).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
    expect(objetosDaEscola(api, escolaId)).toEqual([`material-temporario/${escolaId}/${primeira}`])
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    expect((await materiaisDa(bancada, escolaId)).map((material) => material.id)).toContain(primeira)
    expect(await materiaisDa(bancada, escolaId)).toHaveLength(2)
    await esperarExtracao(api)
  })

  it('a segunda edição recusada com o `apagar` falhando: o objeto e a linha dela ficam, o log diz só o id, e a varredura apaga os dois sem tocar o da primeira (8.0)', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const alvo = (await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).corpo['id'] as string
    await esperarExtracao(api)
    const primeira = (await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'primeira' })).corpo['id'] as string
    const armazem = armazemDe(api)
    armazem.falhaAoApagar = true
    let segunda: RespostaHttp
    try {
      segunda = await enviarEdicaoDeMaterial(api, escola.coordenacao, alvo, { edicao: 'segunda' })
    } finally {
      armazem.falhaAoApagar = false
    }

    expect(erroDe(segunda)).toEqual({ status: 409, codigo: ErrorCode.EDICAO_EM_ANDAMENTO })
    const [id] = await linhasDoEnvio(escolaId)
    expect(id).toBeDefined()
    expect(id).not.toBe(primeira)
    expect(objetosDaEscola(api, escolaId).toSorted()).toEqual([`material-temporario/${escolaId}/${primeira}`, `material-temporario/${escolaId}/${id ?? ''}`].toSorted())
    const avisos = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'material.objeto_nao_apagado')
    expect(avisos.map((aviso) => aviso['materialId'])).toEqual([id])

    await varrer(61)
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([`material-temporario/${escolaId}/${primeira}`])
    await esperarExtracao(api)
  })

  it('`LIMITE_EXCEDIDO` reconferido sob a trava: o objeto e a linha saem', async () => {
    const escola = await montarEscolaComTurma()
    // O teto de materiais em leitura enche depois da conferência da entrada e antes da transação, no meio do `guardarBytes`.
    const desfazer = aoGuardar({
      depois: async () => void (await materiaisJaEnviados(bancada, escola.coordenacao, escola.quimica, 3, { estado: 'processando' })),
    })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      desfazer()
    }

    expect(erroDe(resposta)).toEqual({ status: 429, codigo: ErrorCode.LIMITE_EXCEDIDO })
    expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([])
    expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toEqual([])
    expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toHaveLength(3)
  })

  it('o commit forçado a falhar: o objeto e a linha saem, e nada fica em `material`', async () => {
    const escola = await montarEscolaComTurma()
    const nome = `teste_commit_${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'commit forçado a falhar'; end $$`)
    await bancada.pool.query(
      `create constraint trigger ${nome} after insert on material deferrable initially deferred for each row when (new.escola_id = '${escola.coordenacao.escolaId}') execute function ${nome}()`,
    )
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      await bancada.pool.query(`drop trigger ${nome} on material`)
      await bancada.pool.query(`drop function ${nome}()`)
    }

    expect(resposta.status).toBe(500)
    expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([])
    expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toEqual([])
    expect(await materiaisDa(bancada, escola.coordenacao.escolaId)).toEqual([])
  })

  it('o `guardarBytes` estoura o prazo e o objeto chega depois do `apagar`: 503, a linha fica, e a varredura das 61 min apaga o objeto e a linha', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const desfazer = aoGuardar({ falhar: new FileStorageUnavailableError() })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      desfazer()
    }
    expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    expect(await materiaisDa(bancada, escolaId)).toEqual([])
    // O PUT tinha chegado: o `apagar` do envio o leva, e a linha fica.
    expect(objetosDaEscola(api, escolaId)).toEqual([])
    const [id] = await linhasDoEnvio(escolaId)
    expect(id).toBeDefined()
    // E o PUT atrasado de outra tentativa grava depois de o `apagar` do envio ter passado.
    armazemDe(api).bytes.set(`material-temporario/${escolaId}/${id ?? ''}`, new Uint8Array(PDF_DE_DEMONSTRACAO))

    await varrer(59)
    expect(await linhasDoEnvio(escolaId)).toEqual([id])
    expect(objetosDaEscola(api, escolaId)).toHaveLength(1)

    await varrer(61)
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([])
  })

  it('`CONFLITO` com o `apagar` falhando: o objeto e a linha ficam, o log diz só o id, e a varredura apaga os dois', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    expect((await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).status).toBe(201)
    await esperarExtracao(api)
    const armazem = armazemDe(api)
    armazem.falhaAoApagar = true
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      armazem.falhaAoApagar = false
    }

    expect(erroDe(resposta)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    const [id] = await linhasDoEnvio(escolaId)
    expect(id).toBeDefined()
    expect(objetosDaEscola(api, escolaId)).toEqual([`material-temporario/${escolaId}/${id ?? ''}`])
    const avisos = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'material.objeto_nao_apagado')
    expect(avisos.map(chavesDoAviso)).toEqual([['erro', 'escolaId', 'evento', 'materialId', 'usuarioId']])
    expect(avisos.map((aviso) => aviso['materialId'])).toEqual([id])

    await varrer(61)
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([])
  })

  it('a linha do envio que não sai (o `delete` falha): a recusa continua sendo a resposta, o objeto saiu, e a varredura apaga a linha', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    expect((await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })).status).toBe(201)
    await esperarExtracao(api)
    const nome = `teste_linha_${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await bancada.pool.query(`create function ${nome}() returns trigger language plpgsql as $$ begin raise exception 'a linha não sai'; end $$`)
    await bancada.pool.query(`create trigger ${nome} before delete on envio_de_material for each row when (old.escola_id = '${escolaId}') execute function ${nome}()`)
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      await bancada.pool.query(`drop trigger ${nome} on envio_de_material`)
      await bancada.pool.query(`drop function ${nome}()`)
    }

    expect(erroDe(resposta)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
    expect(objetosDaEscola(api, escolaId)).toEqual([])
    const [id] = await linhasDoEnvio(escolaId)
    expect(id).toBeDefined()
    const avisos = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'material.envio_nao_apagado')
    expect(avisos.map(chavesDoAviso)).toEqual([['erro', 'escolaId', 'evento', 'materialId', 'usuarioId']])
    expect(avisos.map((aviso) => aviso['materialId'])).toEqual([id])

    await varrer(61)
    expect(await linhasDoEnvio(escolaId)).toEqual([])
  })

  it('a varredura apagou a linha de um envio lento: 503, e nada em `material`', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    // O envio é lento: entre o `guardarBytes` e a transação passa mais de uma hora, e a varredura apaga o objeto e a linha.
    const desfazer = aoGuardar({ depois: () => varrer(61) })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      desfazer()
    }

    expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    expect(await materiaisDa(bancada, escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([])
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    const { rows } = await bancada.pool.query("select 1 from job_registro where escola_id = $1 and tipo = 'material.extrair-pdf'", [escolaId])
    expect(rows).toEqual([])
  })

  it('a varredura segurando a linha do envio: o envio espera pouco (`lock_timeout`), desfaz com 503 e não deixa material nem objeto', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const varredura = await bancada.pool.connect()
    let soltou: Promise<void> = Promise.resolve()
    const desfazer = aoGuardar({
      depois: async () => {
        // A varredura trava a linha e a segura até o envio desistir da espera: sem o `lock_timeout`, o envio ficaria na fila da trava até o `statement_timeout`.
        await varredura.query('begin')
        await varredura.query('select 1 from envio_de_material where escola_id = $1 for update', [escolaId])
        soltou = (async () => {
          await esperarNaTrava(bancada.pool, '%delete from "envio_de_material"%')
          await aguardar(async () => {
            const { rows } = await bancada.pool.query<{ total: number }>(
              `select count(*)::int as total from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%delete from "envio_de_material"%' and pid <> pg_backend_pid()`,
            )
            return rows[0]?.total === 0
          }, 'o envio desistir da espera pela linha')
          await varredura.query('rollback')
          varredura.release()
        })()
      },
    })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
    } finally {
      desfazer()
      await soltou
    }

    expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    expect(await materiaisDa(bancada, escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([])
  })

  it('[P] o envio lento com a linha travada: a varredura das 61 min pula a linha e não apaga o objeto, e o envio confirma', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'envio_de_material', evento: 'delete', quando: `old.escola_id = '${escolaId}'` })
    await gatilho.armar()
    let resposta: RespostaHttp
    try {
      const envio = enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica })
      // O envio já apagou a linha dele (a transação a segura até o commit) e está parado no gatilho.
      await gatilho.esperarParadas()
      const espera = new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('a varredura esperou a linha travada')), 5_000))
      await Promise.race([varrer(61), espera])
      expect(objetosDaEscola(api, escolaId)).toHaveLength(1)
      await gatilho.soltar()
      resposta = await envio
    } finally {
      await gatilho.desarmar()
    }

    expect(resposta.status).toBe(201)
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    expect(await materiaisDa(bancada, escolaId)).toHaveLength(1)
    await esperarExtracao(api)
    expect((await materiaisDa(bancada, escolaId))[0]).toMatchObject({ estado: 'pronto' })
    expect(objetosDaEscola(api, escolaId)).toEqual([])
  })

  it('`LICENCA_VENCIDA` reconferida na transação: a licença encurtada depois da conferência da entrada recusa o envio, o objeto e a linha saem, e a recusa é auditada (7.0)', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao)
    // A licença acaba entre a leitura da entrada (vigente) e a transação do envio, no meio do `guardarBytes`.
    const desfazer = aoGuardar({
      depois: async () => {
        const encurtada = await chamar(api.url, 'PATCH', `/v1/licencas/${licencaId}`, escola.coordenacao.token, { vigenteAte: '2020-06-01' })
        expect(encurtada.status).toBe(200)
      },
    })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licencaId })
    } finally {
      desfazer()
    }

    expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
    expect(await materiaisDa(bancada, escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([])
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    const { rows } = await bancada.pool.query("select 1 from job_registro where escola_id = $1 and tipo = 'material.extrair-pdf'", [escolaId])
    expect(rows).toEqual([])
    const recusas = await auditoriaDa(bancada, escolaId, 'material.recusado')
    expect(recusas).toHaveLength(1)
    expect(recusas[0]).toMatchObject({ entidade: 'disciplina', entidade_id: escola.quimica, depois: { motivo: 'licenca_vencida', serieIds: [escola.serieId] } })
  })

  it('`LICENCA_VENCIDA` reconferida na transação: a licença que some do banco depois da conferência da entrada recusa o envio como vencida, e nada fica (7.0)', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao)
    const desfazer = aoGuardar({
      depois: async () => {
        await bancada.pool.query('delete from licenca_de_material where escola_id = $1 and id = $2', [escolaId, licencaId])
      },
    })
    let resposta: RespostaHttp
    try {
      resposta = await enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licencaId })
    } finally {
      desfazer()
    }

    expect(erroDe(resposta)).toEqual({ status: 422, codigo: ErrorCode.LICENCA_VENCIDA })
    expect(await materiaisDa(bancada, escolaId)).toEqual([])
    expect(objetosDaEscola(api, escolaId)).toEqual([])
    expect(await linhasDoEnvio(escolaId)).toEqual([])
    const recusas = await auditoriaDa(bancada, escolaId, 'material.recusado')
    expect(recusas).toHaveLength(1)
    expect(recusas[0]).toMatchObject({ depois: { motivo: 'licenca_vencida', serieIds: [escola.serieId] } })
  })

  it('[P] o envio segura a licença (`for share`) até o commit: o `PATCH` que a encurta espera o envio e não perde para ele, e o material fica com a licença que valia (7.0)', async () => {
    const escola = await montarEscolaComTurma()
    const escolaId = escola.coordenacao.escolaId
    const licencaId = await registrarLicencaDeTeste(api, escola.coordenacao, { licenciante: 'Editora do envio' })
    // O gatilho para o envio **antes** do `insert` do material: a licença já foi lida e travada, e a FK do material (que também a travaria, em `for key share`) ainda não rodou.
    // Sem isso o teste não distinguiria o `for share` do envio da trava que a própria FK já poria: o `PATCH` esperaria do mesmo jeito.
    const gatilho = new WriteBlockTrigger(bancada.pool, { tabela: 'material', evento: 'insert', quando: `new.escola_id = '${escolaId}'`, momento: 'before' })
    await gatilho.armar()
    let resposta: RespostaHttp
    let alteracao: Promise<RespostaHttp> | undefined
    try {
      const envio = enviarMaterial(api, escola.coordenacao, { disciplinaId: escola.quimica, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licencaId })
      await gatilho.esperarParadas()
      alteracao = chamar(api.url, 'PATCH', `/v1/licencas/${licencaId}`, escola.coordenacao.token, { vigenteAte: '2020-06-01' })
      // O `PATCH` trava a licença (`for update`), que o envio ainda segura: ele fica na fila da trava, e só sai quando o envio confirma.
      await esperarNaTrava(bancada.pool, '%licenca_de_material%for update%')
      await gatilho.soltar()
      resposta = await envio
    } finally {
      await gatilho.desarmar()
    }

    expect(resposta.status).toBe(201)
    expect((await alteracao)?.status).toBe(200)
    expect((await materiaisDa(bancada, escolaId))[0]).toMatchObject({ estado: 'processando' })
    const { rows } = await bancada.pool.query<{ licenciante: string | null; licenca_id: string | null }>('select licenciante, licenca_id from material where escola_id = $1', [escolaId])
    expect(rows).toEqual([{ licenciante: 'Editora do envio', licenca_id: licencaId }])
    await esperarExtracao(api)
  })
})
