import { runInContext } from '@educa/nucleo'
import { ErrorCode, decisaoResponseSchema, MENSAGENS_DE_ERRO, type ResultadoDaDecisao } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AnoLetivoRepository } from '../src/estrutura/ano-letivo/ano-letivo.repository.js'
import { VinculoRepository } from '../src/estrutura/vinculo/vinculo.repository.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { alunosNaTurma, montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { aguardar, GatilhoDeParada } from './gatilho-de-parada.js'
import { FerramentasDaSala, pedidoDaSala, semRequisicao as semRequisicaoDaSala, type NomeDaLista, type SalaDeTeste } from './sala-de-teste.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/** Cada pedido pela sala sai de um IP sorteado (`X-Forwarded-For`), com a API confiando no 127.0.0.1. */
const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }

/** O texto livre que o professor escreveu na contestação: o teste procura por ele no banco depois da virada. */
const TEXTO_DA_CONTESTACAO = `dou só a eletiva ${randomUUID()}`

const NAO_ENCONTRADO = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: expect.any(String) }

const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })

interface LinhaDeVinculo {
  readonly id: string
  readonly papel: string
  readonly estado: string
  readonly contestacao: string | null
  readonly complemento: string | null
  readonly motivo_encerramento: string | null
  readonly decidido_em: Date | null
  readonly encerrado_em: Date | null
}

/**
 * Uma escola em 2026 com os vínculos de todo tipo no 2ºB e no 2ºC: confirmado, pendente, contestado com texto, o
 * contestado com texto e depois desligado em março, e dois alunos confirmados.
 */
interface EscolaNaVirada extends EscolaComTurma {
  readonly confirmado: string
  readonly pendente: string
  readonly contestado: string
  readonly desligado: string
  readonly professorConfirmado: SessaoDeTeste
}

describe('virada do ano: encerrar o ano letivo encerra os vínculos por `fim_do_ano` e apaga o `complemento`, numa transação (10.0)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  /** O log da API montada, para o log novo do `encerrar` (10.0): só ids. */
  const linhasDeLog: string[] = []
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE }, linhasDeLog)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown): Promise<RespostaHttp> => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const get = (sessao: SessaoDeTeste, caminho: string): Promise<RespostaHttp> => chamar(api.url, 'GET', caminho, sessao.token)

  async function vincular(escola: EscolaComTurma, professor: SessaoDeTeste, turmaId: string): Promise<string> {
    const resposta = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, disciplinaId: escola.quimica, papel: 'professor' })
    expect(resposta.status).toBe(201)
    return resposta.corpo['id'] as string
  }

  async function montar(): Promise<EscolaNaVirada> {
    const escola = await montarEscolaComTurma(api, bancada)
    await alunosNaTurma(bancada, escola, escola.turma, 2)
    const [professorConfirmado, professorPendente, professorContestando, professorDesligado] = await bancada.sessoes(escola.coordenacao.escolaId, { papel: 'professor', quantidade: 4 })
    if (professorConfirmado === undefined || professorPendente === undefined || professorContestando === undefined || professorDesligado === undefined) throw new Error('professores')
    const confirmado = await vincular(escola, professorConfirmado, escola.turma)
    expect((await post(professorConfirmado, `/v1/vinculos/${confirmado}/confirmar`)).status).toBe(200)
    const pendente = await vincular(escola, professorPendente, escola.turma)
    const contestado = await vincular(escola, professorContestando, escola.outraTurma)
    expect((await post(professorContestando, `/v1/vinculos/${contestado}/contestar`, { contestacao: 'outro', complemento: TEXTO_DA_CONTESTACAO })).status).toBe(200)
    const desligado = await vincular(escola, professorDesligado, escola.outraTurma)
    expect((await post(professorDesligado, `/v1/vinculos/${desligado}/contestar`, { contestacao: 'nao_leciono', complemento: TEXTO_DA_CONTESTACAO })).status).toBe(200)
    expect((await post(escola.coordenacao, `/v1/vinculos/${desligado}/encerrar`, { motivo: 'desligamento' })).status).toBe(200)
    return { ...escola, confirmado, pendente, contestado, desligado, professorConfirmado }
  }

  /** As linhas de `vinculo` do ano, lidas direto do banco: é a coluna que precisa estar vazia, não só a resposta da API. */
  async function vinculosDoAno(anoLetivoId: string): Promise<LinhaDeVinculo[]> {
    const { rows } = await bancada.pool.query<LinhaDeVinculo>(
      'select id, papel, estado, contestacao, complemento, motivo_encerramento, decidido_em, encerrado_em from vinculo where ano_letivo_id = $1 order by id',
      [anoLetivoId],
    )
    return rows
  }

  async function situacaoDoAno(anoLetivoId: string): Promise<string | undefined> {
    const { rows } = await bancada.pool.query<{ situacao: string }>('select situacao from ano_letivo where id = $1', [anoLetivoId])
    return rows[0]?.situacao
  }

  async function auditoriasDaVirada(escolaId: string): Promise<Array<{ entidade: string; entidade_id: string; autor_usuario_id: string; antes: unknown; depois: unknown; finalidade: string | null }>> {
    const { rows } = await bancada.pool.query<{ entidade: string; entidade_id: string; autor_usuario_id: string; antes: unknown; depois: unknown; finalidade: string | null }>(
      "select entidade, entidade_id, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = 'ano_letivo.encerrado' order by em, id",
      [escolaId],
    )
    return rows
  }

  it('caminho feliz: confirmado, pendente, contestado e alunos vão a `encerrado` por `fim_do_ano`; o desligado mantém o motivo; nenhum `complemento` sobra no banco', async () => {
    const escola = await montar()
    const antes = await vinculosDoAno(escola.anoLetivoId)
    expect(antes.filter((linha) => linha.complemento !== null)).toHaveLength(2)
    const desligadoAntes = antes.find((linha) => linha.id === escola.desligado)

    const resposta = await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)
    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ id: escola.anoLetivoId, ano: 2026, inicio: '2026-02-01', fim: '2026-12-15', situacao: 'encerrado' })

    const depois = await vinculosDoAno(escola.anoLetivoId)
    expect(depois).toHaveLength(6)
    for (const linha of depois) {
      expect(linha.estado, linha.id).toBe('encerrado')
      expect(linha.complemento, linha.id).toBeNull()
      expect(linha.encerrado_em, linha.id).not.toBeNull()
      expect(linha.motivo_encerramento, linha.id).toBe(linha.id === escola.desligado ? 'desligamento' : 'fim_do_ano')
    }
    // O desligado em março não é reescrito: mantém a data em que saiu. Só o texto dele some.
    expect(depois.find((linha) => linha.id === escola.desligado)?.encerrado_em).toEqual(desligadoAntes?.encerrado_em)
    // O código da contestação fica: é enum, não texto livre, e é ele que diz que o vínculo nunca foi aceito.
    expect(depois.find((linha) => linha.id === escola.contestado)?.contestacao).toBe('outro')
    const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from vinculo where ano_letivo_id = $1 and complemento is not null', [escola.anoLetivoId])
    expect(Number(rows[0]?.total)).toBe(0)

    expect(await auditoriasDaVirada(escola.coordenacao.escolaId)).toEqual([
      {
        entidade: 'ano_letivo',
        entidade_id: escola.anoLetivoId,
        autor_usuario_id: escola.coordenacao.usuarioId,
        antes: { situacao: 'em_curso' },
        depois: { situacao: 'encerrado', vinculosEncerrados: 5, textosDeContestacaoApagados: 2, acessosRevogados: 0, pedidosEncerrados: 0, linhasDaListaApagadas: 0 },
        finalidade: null,
      },
    ])

    // O professor confirmado perde a turma do ano em curso, que não existe mais.
    expect(semRequisicao(await get(escola.professorConfirmado, `/v1/turmas/${escola.turma}`))).toEqual(NAO_ENCONTRADO)

    // O segundo clique responde o ano como está, sem outra virada nem outra auditoria.
    const segundo = await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)
    expect(segundo.status).toBe(200)
    expect(segundo.corpo).toEqual(resposta.corpo)
    expect(await vinculosDoAno(escola.anoLetivoId)).toEqual(depois)
    expect(await auditoriasDaVirada(escola.coordenacao.escolaId)).toHaveLength(1)
  })

  it('privacidade: a auditoria da virada guarda só contagens, sem o texto livre nem id de pessoa', async () => {
    const escola = await montar()
    expect((await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)).status).toBe(200)
    const [virada] = await auditoriasDaVirada(escola.coordenacao.escolaId)
    const texto = JSON.stringify(virada)
    expect(texto).not.toContain(TEXTO_DA_CONTESTACAO)
    const { rows } = await bancada.pool.query<{ usuario_id: string }>('select usuario_id from vinculo where ano_letivo_id = $1', [escola.anoLetivoId])
    for (const { usuario_id } of rows) expect(texto).not.toContain(usuario_id)
    // Nenhuma auditoria da escola tem o texto, nem a da contestação.
    const { rows: todas } = await bancada.pool.query<{ linha: string }>('select row_to_json(a)::text as linha from auditoria a where escola_id = $1', [escola.coordenacao.escolaId])
    for (const { linha } of todas) expect(linha).not.toContain(TEXTO_DA_CONTESTACAO)
  })

  it('borda: falha forçada na gravação da auditoria desfaz tudo; o ano continua `em_curso`, os vínculos intactos, e o professor lê a turma', async () => {
    const escola = await montar()
    const antes = await vinculosDoAno(escola.anoLetivoId)
    const gatilho = `falha_virada_${randomUUID().replaceAll('-', '')}`
    // A auditoria é o último passo da virada: se os vínculos fossem gravados fora da transação do ano, a falha dela os
    // deixaria encerrados e sem texto.
    await bancada.pool.query(`
      create function ${gatilho}() returns trigger language plpgsql as $$
      begin
        if new.acao = 'ano_letivo.encerrado' and new.escola_id = '${escola.coordenacao.escolaId}' then raise exception 'falha forçada da virada'; end if;
        return new;
      end $$`)
    await bancada.pool.query(`create trigger ${gatilho} before insert on auditoria for each row execute function ${gatilho}()`)
    try {
      const falha = await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)
      expect(falha.status).toBe(500)
      expect(falha.corpo.erro?.codigo).toBe(ErrorCode.ERRO_INTERNO)
    } finally {
      await bancada.pool.query(`drop trigger ${gatilho} on auditoria`)
      await bancada.pool.query(`drop function ${gatilho}()`)
    }

    expect(await situacaoDoAno(escola.anoLetivoId)).toBe('em_curso')
    expect(await vinculosDoAno(escola.anoLetivoId)).toEqual(antes)
    expect(await auditoriasDaVirada(escola.coordenacao.escolaId)).toEqual([])
    expect((await get(escola.professorConfirmado, `/v1/turmas/${escola.turma}`)).status).toBe(200)

    // O controle: sem a falha, a mesma virada acontece.
    expect((await post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`)).status).toBe(200)
    expect((await vinculosDoAno(escola.anoLetivoId)).every((linha) => linha.estado === 'encerrado' && linha.complemento === null)).toBe(true)
  })

  it('clique duplo: dois `encerrar` em paralelo fazem uma virada só, com uma auditoria, e os dois respondem o ano encerrado', async () => {
    const escola = await montar()
    const [primeiro, segundo] = await Promise.all([
      post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`),
      post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`),
    ])
    expect([primeiro?.status, segundo?.status]).toEqual([200, 200])
    expect(primeiro?.corpo['situacao']).toBe('encerrado')
    expect(segundo?.corpo['situacao']).toBe('encerrado')
    const auditorias = await auditoriasDaVirada(escola.coordenacao.escolaId)
    expect(auditorias).toHaveLength(1)
    expect(auditorias[0]?.depois).toEqual({ situacao: 'encerrado', vinculosEncerrados: 5, textosDeContestacaoApagados: 2, acessosRevogados: 0, pedidosEncerrados: 0, linhasDaListaApagadas: 0 })
  })

  it('concorrência: o professor contesta com texto no mesmo instante em que o ano é encerrado; ganhe quem ganhar, nenhum `complemento` sobra', async () => {
    const escola = await montar()
    const [professor] = await bancada.sessoes(escola.coordenacao.escolaId, { papel: 'professor', quantidade: 1 })
    if (professor === undefined) throw new Error('professor')
    const pendente = await vincular(escola, professor, escola.outraTurma)
    const [encerrado, contestado] = await Promise.all([
      post(escola.coordenacao, `/v1/anos-letivos/${escola.anoLetivoId}/encerrar`),
      post(professor, `/v1/vinculos/${pendente}/contestar`, { contestacao: 'outro', complemento: TEXTO_DA_CONTESTACAO }),
    ])
    expect(encerrado.status).toBe(200)
    // Se a contestação chegou antes, ela vale até a virada; se chegou depois, o vínculo já não está em decisão.
    expect([200, 404, 409]).toContain(contestado.status)
    const depois = await vinculosDoAno(escola.anoLetivoId)
    expect(depois.every((linha) => linha.estado === 'encerrado' && linha.complemento === null)).toBe(true)
  })

  describe('V1, C10 e o log (A1, tarefa 10.0): a virada alcança a sala das turmas', () => {
    let sala: FerramentasDaSala

    beforeAll(() => {
      sala = new FerramentasDaSala(api, bancada)
    })

    const encerrar = (s: SalaDeTeste) => post(s.coordenacao, `/v1/anos-letivos/${s.anoLetivoId}/encerrar`)
    const decidir = (sessao: SessaoDeTeste, ids: readonly string[], decisao: 'aprovar' | 'recusar' = 'aprovar') => post(sessao, '/v1/reivindicacoes/decidir', { ids, decisao })

    function resultados(resposta: RespostaHttp): ResultadoDaDecisao[] {
      expect(resposta.status).toBe(200)
      return decisaoResponseSchema.parse(resposta.corpo).resultados.map((linha) => linha.resultado)
    }

    /** O aluno reivindica o nome pela sala, com a matrícula certa, e o id do pedido pendente que nasceu. */
    async function pedir(s: SalaDeTeste, nome: NomeDaLista): Promise<string> {
      expect((await sala.reivindicar(pedidoDaSala(s, nome))).status).toBe(200)
      const { rows } = await bancada.pool.query<{ id: string }>(`select id from reivindicacao where escola_id = $1 and lista_nome_id = $2 and estado = 'pendente'`, [s.escolaId, nome.id])
      const id = rows[0]?.id
      if (id === undefined) throw new Error('pedido não gravado')
      return id
    }

    interface PedidoNoBanco {
      readonly estado: string
      readonly lista_nome_id: string | null
      readonly senha_hash: string | null
      readonly chave_envio: string | null
      readonly teve_matricula_errada: boolean | null
      readonly decidida_em: Date | null
      readonly decidida_por: string | null
      readonly decidida_como: string | null
    }

    async function pedidoNoBanco(id: string): Promise<PedidoNoBanco | undefined> {
      const { rows } = await bancada.pool.query<PedidoNoBanco>(
        'select estado, lista_nome_id, senha_hash, chave_envio, teve_matricula_errada, decidida_em, decidida_por, decidida_como from reivindicacao where id = $1',
        [id],
      )
      return rows[0]
    }

    /** Os pedidos da escola no ano: estado e se sobrou algum segredo do pendente. */
    async function pedidosDoAno(s: SalaDeTeste): Promise<Array<{ estado: string; com_segredo: boolean }>> {
      const { rows } = await bancada.pool.query<{ estado: string; com_segredo: boolean }>(
        `select estado, (senha_hash is not null or chave_envio is not null or teve_matricula_errada is not null) as com_segredo
           from reivindicacao where escola_id = $1 and ano_letivo_id = $2 order by id`,
        [s.escolaId, s.anoLetivoId],
      )
      return rows
    }

    async function estadoDoNome(id: string): Promise<string | undefined> {
      return (await bancada.pool.query<{ estado: string }>('select estado from lista_nome where id = $1', [id])).rows[0]?.estado
    }

    /** Os estados das linhas da lista da escola no ano, em ordem. */
    async function nomesDoAno(s: SalaDeTeste): Promise<string[]> {
      const { rows } = await bancada.pool.query<{ estado: string }>('select estado from lista_nome where escola_id = $1 and ano_letivo_id = $2 order by estado', [s.escolaId, s.anoLetivoId])
      return rows.map((linha) => linha.estado)
    }

    /** Os vínculos do ano que não foram encerrados: depois da virada, nenhum. */
    async function vinculosAbertosDoAno(s: SalaDeTeste): Promise<Array<{ papel: string; estado: string }>> {
      const { rows } = await bancada.pool.query<{ papel: string; estado: string }>(
        `select papel, estado from vinculo where escola_id = $1 and ano_letivo_id = $2 and estado <> 'encerrado' order by id`,
        [s.escolaId, s.anoLetivoId],
      )
      return rows
    }

    async function alunosDa(escolaId: string): Promise<number> {
      return (await bancada.pool.query<{ total: number }>(`select count(*)::int as total from usuario where escola_id = $1 and papel = 'aluno'`, [escolaId])).rows[0]?.total ?? -1
    }

    /**
     * Espera a `promessa` terminar ou algum backend deste banco parar numa trava de linha com uma consulta que case um dos
     * `padroes`. É o efeito que o teste confere depois, e não a espera: sem a trava do ano, a escrita não espera o ano, e
     * termina ou para em outra trava.
     */
    async function terminarOuTravar(promessa: Promise<unknown>, padroes: readonly string[]): Promise<void> {
      let terminou = false
      void promessa.then(
        () => (terminou = true),
        () => (terminou = true),
      )
      await aguardar(async () => {
        if (terminou) return true
        const { rows } = await bancada.pool.query<{ total: number }>(
          `select count(*)::int as total from pg_stat_activity
            where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query ilike any($1::text[])`,
          [padroes],
        )
        return (rows[0]?.total ?? 0) > 0
      }, `a escrita terminar ou travar em ${padroes.join(', ')}`)
    }

    /** O `encerrar` parado logo depois de mudar o ano, com a trava da linha do ano segura. */
    const paradaNoAno = (s: SalaDeTeste) => new GatilhoDeParada(bancada.pool, { tabela: 'ano_letivo', evento: 'update', quando: `new.id = '${s.anoLetivoId}'::uuid and new.situacao = 'encerrado'` })

    it('V1: o acesso fica revogado, o pendente vira `encerrada` sem segredo, os nomes livre e reivindicado saem, o recusado fica sem nome, o aprovado fica; depois, link e código `NAO_ENCONTRADO` e o pedido `nao_encontrada`', async () => {
      const montada = await sala.montar()
      // "Gerar novo": o ano tem um acesso já revogado, que a virada não toca, e o vigente, que ela revoga.
      const anterior = await sala.acessoVigente(montada.turma)
      const s: SalaDeTeste = { ...montada, ...(await sala.gerar(montada, montada.turma)) }
      const revogadoAntes = async () =>
        (await bancada.pool.query<{ revogado_em: Date | null }>('select revogado_em from acesso_turma where id = $1', [anterior])).rows[0]?.revogado_em
      const revogadoEm = await revogadoAntes()
      expect(revogadoEm).toBeInstanceOf(Date)
      const [comErrada, recusado, livre, aprovado] = await sala.nomes(s, s.turma, 4)
      if (comErrada === undefined || recusado === undefined || livre === undefined || aprovado === undefined) throw new Error('nomes')
      // A matrícula errada no nome, antes do pedido: o pendente nasce com a marca.
      const errada = await sala.reivindicar(pedidoDaSala(s, comErrada, { matricula: `${comErrada.matricula}x` }))
      expect(errada.status).toBe(409)
      const pendente = await pedir(s, comErrada)
      expect(await pedidoNoBanco(pendente)).toMatchObject({ estado: 'pendente', teve_matricula_errada: true, lista_nome_id: comErrada.id })
      const pedidoRecusado = await pedir(s, recusado)
      expect(resultados(await decidir(s.professor, [pedidoRecusado], 'recusar'))).toEqual(['decidida'])
      const pedidoAprovado = await pedir(s, aprovado)
      expect(resultados(await decidir(s.professor, [pedidoAprovado]))).toEqual(['decidida'])
      const acessoId = await sala.acessoVigente(s.turma)
      expect(await nomesDoAno(s)).toEqual(['aprovado', 'livre', 'livre', 'reivindicado'])
      const recusadoAntes = await pedidoNoBanco(pedidoRecusado)
      const aprovadoAntes = await pedidoNoBanco(pedidoAprovado)
      linhasDeLog.length = 0

      const resposta = await encerrar(s)
      expect(resposta.status).toBe(200)

      const { rows: acessos } = await bancada.pool.query<{ id: string; revogado: boolean }>('select id, revogado_em is not null as revogado from acesso_turma where escola_id = $1 and ano_letivo_id = $2', [
        s.escolaId,
        s.anoLetivoId,
      ])
      expect(acessos.sort((x, y) => x.id.localeCompare(y.id))).toEqual(
        [
          { id: anterior, revogado: true },
          { id: acessoId, revogado: true },
        ].sort((x, y) => x.id.localeCompare(y.id)),
      )
      // O já revogado guarda a hora da revogação dele: é dela que o expurgo conta os 30 dias.
      expect(await revogadoAntes()).toEqual(revogadoEm)
      // O pendente fecha sem decisão humana (regra 70, item 2): sem hash, chave, marca, quem nem quando decidiu; e o nome
      // dele saiu, então a referência ficou nula.
      expect(await pedidoNoBanco(pendente)).toEqual({
        estado: 'encerrada',
        lista_nome_id: null,
        senha_hash: null,
        chave_envio: null,
        teve_matricula_errada: null,
        decidida_em: null,
        decidida_por: null,
        decidida_como: null,
      })
      // O recusado perde só a referência ao nome, que saiu; o aprovado continua apontando para o nome aprovado.
      expect(await pedidoNoBanco(pedidoRecusado)).toEqual({ ...recusadoAntes, lista_nome_id: null })
      expect(await pedidoNoBanco(pedidoAprovado)).toEqual(aprovadoAntes)
      expect(aprovadoAntes?.lista_nome_id).toBe(aprovado.id)
      for (const saiu of [comErrada, recusado, livre]) expect(await estadoDoNome(saiu.id), saiu.id).toBeUndefined()
      expect(await estadoDoNome(aprovado.id)).toBe('aprovado')
      expect(await nomesDoAno(s)).toEqual(['aprovado'])
      expect(await pedidosDoAno(s)).toEqual([
        { estado: 'encerrada', com_segredo: false },
        { estado: 'recusada', com_segredo: false },
        { estado: 'aprovada', com_segredo: false },
      ])

      const [virada] = await auditoriasDaVirada(s.escolaId)
      expect(virada?.depois).toMatchObject({ situacao: 'encerrado', acessosRevogados: 1, pedidosEncerrados: 1, linhasDaListaApagadas: 3 })

      // Depois: o link e o código não abrem a sala, e o pedido, visto do ano novo, não existe.
      const naoEncontrado = { status: 404, codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO }
      for (const corpo of [
        { slug: s.slug, token: s.token },
        { slug: s.slug, codigo: s.codigo },
      ]) {
        const aberta = await sala.abrir(corpo)
        const { erro } = JSON.parse(aberta.texto) as { erro?: { codigo?: string; mensagem?: string } }
        expect({ status: aberta.status, codigo: erro?.codigo, mensagem: erro?.mensagem }, Object.keys(corpo).join()).toEqual(naoEncontrado)
      }
      const de2027 = await post(s.coordenacao, '/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' })
      expect(de2027.status).toBe(201)
      expect((await post(s.coordenacao, `/v1/anos-letivos/${de2027.corpo['id'] as string}/abrir`)).status).toBe(200)
      expect(resultados(await decidir(s.coordenacao, [pendente]))).toEqual(['nao_encontrada'])

      // O log novo: o `encerrar` não leva nome, matrícula, token nem código a log, e a auditoria dele, só contagens. A
      // captura funciona: desde o `encerrar`, a API escreveu linhas nela.
      const texto = linhasDeLog.join('\n')
      expect(linhasDeLog.length).toBeGreaterThan(0)
      for (const proibido of [comErrada, recusado, livre, aprovado].flatMap((nome) => [nome.nome, nome.matricula]).concat(s.token, s.codigo)) {
        expect(texto.includes(proibido), proibido).toBe(false)
        expect(JSON.stringify(virada).includes(proibido), proibido).toBe(false)
      }
    })

    /** Uma foto das três tabelas da sala da escola, linha inteira, para conferir que nada mudou. */
    async function salaNoBanco(escolaId: string): Promise<Record<string, unknown[]>> {
      const foto: Record<string, unknown[]> = {}
      for (const tabela of ['acesso_turma', 'reivindicacao', 'lista_nome']) {
        foto[tabela] = (await bancada.pool.query(`select * from ${tabela} where escola_id = $1 order by id`, [escolaId])).rows
      }
      return foto
    }

    it('V1, borda: a virada alcança só o ano que encerra; o de 2025, encerrado antes da 10.0 com acesso não revogado, pedido pendente e nomes (montado pelo banco), fica como está', async () => {
      const s = await sala.montar()
      await sala.nomes(s, s.turma, 2)
      const { rows: anos } = await bancada.pool.query<{ id: string }>(
        `insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`,
        [s.escolaId],
      )
      const de2025 = anos[0]?.id ?? ''
      const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB de 2025') returning id`, [
        s.escolaId,
        de2025,
        s.serieId,
      ])
      const turmaDe2025 = turmas[0]?.id ?? ''
      const sufixo = randomUUID().slice(0, 8)
      const { rows: nomes } = await bancada.pool.query<{ id: string; estado: string }>(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values
           ($1, $2, $3, $4, $5, 'livre'), ($1, $2, $3, $6, $7, 'reivindicado') returning id, estado`,
        [s.escolaId, de2025, turmaDe2025, `Livre ${sufixo}`, `m25-${sufixo}-1`, `Reivindicado ${sufixo}`, `m25-${sufixo}-2`],
      )
      const reivindicado = nomes.find((nome) => nome.estado === 'reivindicado')?.id
      await bancada.pool.query(
        `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada) values ($1, $2, $3, $4, $5, 'hash-sintetico', false)`,
        [s.escolaId, de2025, turmaDe2025, reivindicado, randomUUID()],
      )
      // Vencido há um dia, e não há 30: o expurgo de outro arquivo, rodando junto, não o apaga no meio do teste.
      await bancada.pool.query(
        `insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em) values ($1, $2, $3, $4, $5, 7, now() - interval '1 day')`,
        [s.escolaId, de2025, turmaDe2025, randomUUID(), randomUUID()],
      )
      const doAno = (foto: Record<string, unknown[]>) =>
        Object.fromEntries(Object.entries(foto).map(([tabela, linhas]) => [tabela, linhas.filter((linha) => (linha as { ano_letivo_id: string }).ano_letivo_id === de2025)]))
      const antes = doAno(await salaNoBanco(s.escolaId))
      expect(Object.values(antes).map((linhas) => linhas.length)).toEqual([1, 1, 2])

      expect((await encerrar(s)).status).toBe(200)

      expect(doAno(await salaNoBanco(s.escolaId))).toEqual(antes)
      const [virada] = await auditoriasDaVirada(s.escolaId)
      expect(virada?.depois).toMatchObject({ acessosRevogados: 1, pedidosEncerrados: 0, linhasDaListaApagadas: 2 })
    })

    it('isolamento: num contexto de A, `virarSala` com o ano de B não muda nada em B; com a escola de B, a mesma chamada alcança a sala de B', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const nomeEmB = await sala.umNome(b)
      await pedir(b, nomeEmB)
      await sala.nomes(b, b.turma, 1)
      const antesEmB = await salaNoBanco(b.escolaId)
      const forjado = { requisicaoId: randomUUID(), escolaId: a.escolaId, usuarioId: a.coordenacao.usuarioId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: b.anoLetivoId }
      const contagens = await runInContext(forjado, () => new AnoLetivoRepository(bancada.banco).virarSala(b.anoLetivoId))
      expect(contagens).toEqual({ acessosRevogados: 0, pedidosEncerrados: 0, linhasDaListaApagadas: 0 })
      expect(await salaNoBanco(b.escolaId)).toEqual(antesEmB)

      // O controle: com a escola de B no contexto, a mesma chamada alcança a sala de B. A transação é desfeita.
      const desfeita = new Error('desfazer o controle')
      const doControle = await runInContext({ ...forjado, escolaId: b.escolaId }, () =>
        bancada.banco
          .transaction(async (tx) => {
            const alcancadas = await new AnoLetivoRepository(tx).virarSala(b.anoLetivoId)
            throw Object.assign(desfeita, { alcancadas })
          })
          .catch((erro: unknown) => (erro === desfeita ? (desfeita as Error & { alcancadas?: unknown }).alcancadas : Promise.reject(erro))),
      )
      expect(doControle).toEqual({ acessosRevogados: 1, pedidosEncerrados: 1, linhasDaListaApagadas: 2 })
      expect(await salaNoBanco(b.escolaId)).toEqual(antesEmB)
    })

    it('clique duplo com a sala: dois `encerrar` em paralelo fazem uma virada só da sala, com as contagens numa auditoria', async () => {
      const s = await sala.montar()
      const [pendente, livre] = await sala.nomes(s, s.turma, 2)
      if (pendente === undefined || livre === undefined) throw new Error('nomes')
      await pedir(s, pendente)
      const [primeiro, segundo] = await Promise.all([encerrar(s), encerrar(s)])
      expect([primeiro.status, segundo.status]).toEqual([200, 200])
      const auditorias = await auditoriasDaVirada(s.escolaId)
      expect(auditorias).toHaveLength(1)
      expect(auditorias[0]?.depois).toMatchObject({ acessosRevogados: 1, pedidosEncerrados: 1, linhasDaListaApagadas: 2 })
      expect(await pedidosDoAno(s)).toEqual([{ estado: 'encerrada', com_segredo: false }])
      expect(await nomesDoAno(s)).toEqual([])
    })

    it('C10: `encerrar` × reivindicar, com a reivindicação parada depois do `insert`: o `encerrar` espera o ano e fecha o pedido; nada pendente sobra no ano encerrado', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const parada = new GatilhoDeParada(bancada.pool, { tabela: 'reivindicacao', evento: 'insert', quando: `new.lista_nome_id = '${nome.id}'::uuid` })
      await parada.armar()
      try {
        const reivindicando = sala.reivindicar(pedidoDaSala(s, nome))
        await parada.esperarParadas()
        const encerrando = encerrar(s)
        await terminarOuTravar(encerrando, ['%update "ano_letivo"%', '%delete from "lista_nome"%', '%update "reivindicacao"%'])
        await parada.soltar()
        const [reivindicado, encerrado] = await Promise.all([reivindicando, encerrando])
        expect(reivindicado.status).toBe(200)
        expect(encerrado.status).toBe(200)
      } finally {
        await parada.desarmar()
      }
      expect(await pedidosDoAno(s)).toEqual([{ estado: 'encerrada', com_segredo: false }])
      expect(await estadoDoNome(nome.id)).toBeUndefined()
    })

    it('C10: `encerrar` × reivindicar, com o `encerrar` parado depois de mudar o ano: a reivindicação espera o ano e é recusada, sem pedido', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const parada = paradaNoAno(s)
      await parada.armar()
      try {
        const encerrando = encerrar(s)
        await parada.esperarParadas()
        const reivindicando = sala.reivindicar(pedidoDaSala(s, nome))
        await terminarOuTravar(reivindicando, ['%from "ano_letivo"%for share%'])
        await parada.soltar()
        const [encerrado, reivindicado] = await Promise.all([encerrando, reivindicando])
        expect(encerrado.status).toBe(200)
        expect(semRequisicaoDaSala(reivindicado)).toEqual({
          status: 409,
          texto: JSON.stringify({ erro: { codigo: ErrorCode.REIVINDICACAO_RECUSADA, mensagem: MENSAGENS_DE_ERRO.REIVINDICACAO_RECUSADA, requisicaoId: '-' } }),
        })
      } finally {
        await parada.desarmar()
      }
      expect(await pedidosDoAno(s)).toEqual([])
      expect(await estadoDoNome(nome.id)).toBeUndefined()
    })

    it('C10: `encerrar` × aprovar, com a aprovação parada no meio: o `encerrar` espera o ano e encerra o vínculo do aluno aprovado', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const pedidoId = await pedir(s, nome)
      const parada = new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'update', quando: `new.id = '${nome.id}'::uuid and new.estado = 'aprovado'` })
      await parada.armar()
      try {
        const aprovando = decidir(s.professor, [pedidoId])
        await parada.esperarParadas()
        const encerrando = encerrar(s)
        await terminarOuTravar(encerrando, ['%update "ano_letivo"%', '%update "reivindicacao"%', '%update "vinculo"%'])
        await parada.soltar()
        const [aprovado, encerrado] = await Promise.all([aprovando, encerrando])
        expect(resultados(aprovado)).toEqual(['decidida'])
        expect(encerrado.status).toBe(200)
      } finally {
        await parada.desarmar()
      }
      // A aprovação veio antes do encerramento: o aluno existe, e o vínculo dele terminou com o ano, como o dos outros.
      expect(await vinculosAbertosDoAno(s)).toEqual([])
      expect(await alunosDa(s.escolaId)).toBe(1)
      expect(await pedidosDoAno(s)).toEqual([{ estado: 'aprovada', com_segredo: false }])
    })

    it('C10: `encerrar` × aprovar, com o `encerrar` parado depois de mudar o ano: a aprovação espera o ano e sai `nao_encontrada`, sem aluno', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const pedidoId = await pedir(s, nome)
      const parada = paradaNoAno(s)
      await parada.armar()
      try {
        const encerrando = encerrar(s)
        await parada.esperarParadas()
        const aprovando = decidir(s.professor, [pedidoId])
        await terminarOuTravar(aprovando, ['%from "ano_letivo"%for share%'])
        await parada.soltar()
        const [encerrado, aprovado] = await Promise.all([encerrando, aprovando])
        expect(encerrado.status).toBe(200)
        expect(resultados(aprovado)).toEqual(['nao_encontrada'])
      } finally {
        await parada.desarmar()
      }
      expect(await alunosDa(s.escolaId)).toBe(0)
      expect(await vinculosAbertosDoAno(s)).toEqual([])
      expect(await pedidosDoAno(s)).toEqual([{ estado: 'encerrada', com_segredo: false }])
      expect(await estadoDoNome(nome.id)).toBeUndefined()
    })

    for (const caminho of ['nome avulso', 'gravação da lista'] as const) {
      it(`C10 (decidido na 10.0): \`encerrar\` × ${caminho}, parado depois do \`insert\`: o \`encerrar\` espera o ano e apaga o nome livre; nenhum sobra no ano encerrado`, async () => {
        const s = await sala.montar()
        const matricula = `virada-${randomUUID().slice(0, 8)}`
        const parada = new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'insert', quando: `new.matricula = '${matricula}'` })
        await parada.armar()
        try {
          const nome = `Aluna ${randomUUID().slice(0, 8)}`
          const gravando =
            caminho === 'nome avulso' ? post(s.coordenacao, `/v1/turmas/${s.turma}/lista/nome`, { nome, matricula }) : post(s.coordenacao, `/v1/turmas/${s.turma}/lista`, { texto: `${nome};${matricula}` })
          await parada.esperarParadas()
          const encerrando = encerrar(s)
          await terminarOuTravar(encerrando, ['%update "ano_letivo"%', '%delete from "lista_nome"%'])
          await parada.soltar()
          const [gravado, encerrado] = await Promise.all([gravando, encerrando])
          expect(gravado.status).toBe(201)
          expect(encerrado.status).toBe(200)
        } finally {
          await parada.desarmar()
        }
        expect(await nomesDoAno(s)).toEqual([])
      })
    }
  })

  describe('isolamento entre escolas (regra 10)', () => {
    let a: EscolaNaVirada
    let b: EscolaNaVirada

    beforeAll(async () => {
      a = await montar()
      b = await montar()
    })

    it('a virada de A não toca vínculo nem ano de B, e encerrar o ano de B a partir de A dá o 404 do inexistente', async () => {
      const antesEmB = await vinculosDoAno(b.anoLetivoId)
      const comIdDeB = await post(a.coordenacao, `/v1/anos-letivos/${b.anoLetivoId}/encerrar`)
      expect(semRequisicao(comIdDeB)).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(comIdDeB)).toEqual(semRequisicao(await post(a.coordenacao, `/v1/anos-letivos/${randomUUID()}/encerrar`)))
      expect(await situacaoDoAno(b.anoLetivoId)).toBe('em_curso')

      expect((await post(a.coordenacao, `/v1/anos-letivos/${a.anoLetivoId}/encerrar`)).status).toBe(200)
      expect(await vinculosDoAno(b.anoLetivoId)).toEqual(antesEmB)
      expect(await situacaoDoAno(b.anoLetivoId)).toBe('em_curso')
      expect(await auditoriasDaVirada(b.coordenacao.escolaId)).toEqual([])
    })

    it('o escopo de escola vale sozinho na virada: num contexto de A, `virarAno` com o ano de B não muda nada em B', async () => {
      const antesEmB = await vinculosDoAno(b.anoLetivoId)
      const forjado = { requisicaoId: randomUUID(), escolaId: a.coordenacao.escolaId, usuarioId: a.coordenacao.usuarioId, papel: 'coordenador' as const, sessaoId: randomUUID(), anoLetivoId: b.anoLetivoId }
      const contagens = await runInContext(forjado, () => new VinculoRepository(bancada.banco).virarAno(b.anoLetivoId))
      expect(contagens).toEqual({ vinculosEncerrados: 0, textosDeContestacaoApagados: 0 })
      expect(await vinculosDoAno(b.anoLetivoId)).toEqual(antesEmB)

      // O controle: com a escola de B no contexto, a mesma chamada alcança os vínculos de B. A transação é desfeita.
      const desfeita = new Error('desfazer o controle')
      const doControle = await runInContext({ ...forjado, escolaId: b.coordenacao.escolaId }, () =>
        bancada.banco
          .transaction(async (tx) => {
            const alcancadas = await new VinculoRepository(tx).virarAno(b.anoLetivoId)
            throw Object.assign(desfeita, { alcancadas })
          })
          .catch((erro: unknown) => (erro === desfeita ? (desfeita as Error & { alcancadas?: unknown }).alcancadas : Promise.reject(erro))),
      )
      expect(doControle).toEqual({ vinculosEncerrados: 5, textosDeContestacaoApagados: 2 })
      expect(await vinculosDoAno(b.anoLetivoId)).toEqual(antesEmB)
    })
  })
})
