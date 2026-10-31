import { runInContext } from '@educa/core'
import {
  ErrorCode,
  alunosDaTurmaResponseSchema,
  decisaoResponseSchema,
  loginResponseSchema,
  pedidosDaTurmaResponseSchema,
  previaDaListaResponseSchema,
  salaAbertaResponseSchema,
  MENSAGENS_DE_ERRO,
  type ResultadoDaDecisao,
} from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { DecisaoRepository } from '../src/sala/decisao/decisao.repository.js'
import { ListaLivreRepository } from '../src/sala/reivindicacao/lista-livre.repository.js'
import { ReivindicacaoRepository } from '../src/sala/reivindicacao/reivindicacao.repository.js'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './test-api.js'
import { esperarNaTrava, GatilhoDeParada } from './write-block-trigger.js'
import { FerramentasDaSala, pedidoDaSala, semRequisicao, SENHA_DA_SALA, type NomeDaLista, type SalaDeTeste } from './sala.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

/**
 * Os pedidos da turma e a decisão (A1, tarefa 8.0; `tasks/prd-apresentacao-escola/cenarios.md`): `GET
 * /v1/turmas/:id/reivindicacoes` e `POST /v1/reivindicacoes/decidir`. Cobre I6, P3, a parte de `decidir` do P4, os
 * pedidos do E12, E18, E19, E20, E22, E25, E27, C3, C12, o aprovado de E6 e de R2, a retirada do aprovado do E7, o resto
 * de E21 e de E30, A1 (`reivindicacao.decidida`) e A2. O I3, o A3 e o A4 das duas rotas moram na varredura de
 * `escola-montada.int.test.ts`; o `minha-turma`, em `minha-turma.int.test.ts`. Postgres e Redis reais do compose de teste.
 *
 * Os pedidos nascem pela página pública da sala, com o hash de verdade, salvo no I6, que precisa de pedidos em turmas sem
 * acesso (sem vínculo confirmado de ninguém) e num ano já encerrado: lá eles são gravados no banco, como a sala os grava.
 * Cada pedido pela sala sai de um IP sorteado (`X-Forwarded-For`, com a API confiando no 127.0.0.1).
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const FINALIDADE = 'conferencia_de_cadastro'

describe('decisão dos pedidos (A1, tarefa 8.0): uma pessoa aprova ou recusa, e só a aprovação cria o aluno', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  let sala: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    sala = new FerramentasDaSala(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, sessao.token, corpo)
  const decidir = (sessao: SessaoDeTeste, ids: readonly string[], decisao: 'aprovar' | 'recusar' = 'aprovar') => post(sessao, '/v1/reivindicacoes/decidir', { ids, decisao })
  const lerPedidos = (sessao: SessaoDeTeste, turmaId: string, consulta = '') => chamar(api.url, 'GET', `/v1/turmas/${turmaId}/reivindicacoes${consulta}`, sessao.token)

  /** O resultado de cada id, na ordem do pedido, de uma decisão que respondeu 200. */
  function resultados(resposta: RespostaHttp): ResultadoDaDecisao[] {
    expect(resposta.status).toBe(200)
    return decisaoResponseSchema.parse(resposta.corpo).resultados.map((linha) => linha.resultado)
  }

  /** O aluno reivindica o nome pela sala, com a matrícula certa, e o id do pedido pendente que nasceu. */
  async function pedir(s: SalaDeTeste, nome: NomeDaLista, extra: Record<string, unknown> = {}): Promise<string> {
    const resposta = await sala.reivindicar(pedidoDaSala(s, nome, extra))
    expect(resposta.status).toBe(200)
    const { rows } = await bancada.pool.query<{ id: string }>(`select id from reivindicacao where escola_id = $1 and lista_nome_id = $2 and estado = 'pendente'`, [s.escolaId, nome.id])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('pedido não gravado')
    return id
  }

  interface PedidoNoBanco {
    readonly estado: string
    readonly senha_hash: string | null
    readonly chave_envio: string | null
    readonly teve_matricula_errada: boolean | null
    readonly decidida_em: Date | null
    readonly decidida_por: string | null
    readonly decidida_como: string | null
  }

  async function pedidoNoBanco(id: string): Promise<PedidoNoBanco> {
    const { rows } = await bancada.pool.query<PedidoNoBanco>(
      'select estado, senha_hash, chave_envio, teve_matricula_errada, decidida_em, decidida_por, decidida_como from reivindicacao where id = $1',
      [id],
    )
    const [linha] = rows
    if (linha === undefined) throw new Error('pedido não encontrado')
    return linha
  }

  async function nomeNoBanco(id: string): Promise<{ nome: string | null; matricula: string | null; estado: string; usuario_id: string | null } | undefined> {
    return (await bancada.pool.query<{ nome: string | null; matricula: string | null; estado: string; usuario_id: string | null }>('select nome, matricula, estado, usuario_id from lista_nome where id = $1', [id])).rows[0]
  }

  /** As decisões gravadas na auditoria de um pedido, em ordem. */
  async function auditoriaDo(pedidoId: string): Promise<Array<{ autor_usuario_id: string; depois: Record<string, unknown> }>> {
    const { rows } = await bancada.pool.query<{ autor_usuario_id: string; depois: Record<string, unknown> }>(
      `select autor_usuario_id, depois from auditoria where acao = 'reivindicacao.decidida' and entidade_id = $1 order by id`,
      [pedidoId],
    )
    return rows
  }

  /** Quantos alunos (usuários e credenciais) a escola tem. */
  async function alunosDa(escolaId: string): Promise<{ usuarios: number; credenciais: number }> {
    const { rows } = await bancada.pool.query<{ usuarios: number; credenciais: number }>(
      `select (select count(*)::int from usuario where escola_id = $1 and papel = 'aluno') as usuarios, (select count(*)::int from credencial_matricula where escola_id = $1) as credenciais`,
      [escolaId],
    )
    return rows[0] ?? { usuarios: 0, credenciais: 0 }
  }

  /** O login por matrícula na escola, como a página da escola faz. */
  const entrar = (s: SalaDeTeste, matricula: string, senha = SENHA_DA_SALA) => chamar(api.url, 'POST', '/v1/sessao/matricula', undefined, { slug: s.slug, matricula, senha })

  /** Os vínculos de professor do usuário na turma. */
  async function vinculosDe(usuarioId: string, turmaId: string): Promise<string[]> {
    return (await bancada.pool.query<{ id: string }>(`select id from vinculo where usuario_id = $1 and turma_id = $2 and papel = 'professor' order by id`, [usuarioId, turmaId])).rows.map((linha) => linha.id)
  }

  describe('E18, E22 e A1: a aprovação cria o aluno com a matrícula da lista e a senha do pedido', () => {
    it('E18: as escritas da aprovação; " 123 " de ponta a ponta; E22: o aluno que errou o login antes entra logo depois; A1 com decididaComo professor', async () => {
      const s = await sala.montar()
      const nome = `Aluna ${randomUUID().slice(0, 8)}`
      // A lista grava a matrícula sem os espaços das pontas, e o aluno a digita com eles.
      expect((await post(s.coordenacao, `/v1/turmas/${s.turma}/lista`, { texto: `${nome}; 123 ` })).status).toBe(201)
      const { rows } = await bancada.pool.query<{ id: string; matricula: string }>('select id, matricula from lista_nome where escola_id = $1', [s.escolaId])
      const linha = rows[0]
      if (linha === undefined) throw new Error('nome não gravado')
      expect(linha.matricula).toBe('123')
      const pedidoId = await pedir(s, { id: linha.id, nome, matricula: ' 123 ' })
      const { senha_hash: hashDoPedido } = await pedidoNoBanco(pedidoId)

      // E22: antes da aprovação a credencial não existe, e cinco tentativas seguram a matrícula.
      const tentativas: RespostaHttp[] = []
      for (let vez = 0; vez < 5; vez++) tentativas.push(await entrar(s, '123'))
      expect(tentativas.map((resposta) => resposta.corpo.erro?.codigo)).toEqual([...Array<string>(4).fill(ErrorCode.NAO_AUTENTICADO), ErrorCode.CONTA_SEGURADA])

      expect(resultados(await decidir(s.professor, [pedidoId]))).toEqual(['decidida'])

      const { rows: usuarios } = await bancada.pool.query<{ id: string; nome: string; conta_id: string | null }>(`select id, nome, conta_id from usuario where escola_id = $1 and papel = 'aluno'`, [s.escolaId])
      expect(usuarios).toHaveLength(1)
      const aluno = usuarios[0]
      if (aluno === undefined) throw new Error('aluno não criado')
      expect(aluno).toMatchObject({ nome, conta_id: null })
      const { rows: credenciais } = await bancada.pool.query('select usuario_id, matricula, senha_hash from credencial_matricula where escola_id = $1', [s.escolaId])
      expect(credenciais).toEqual([{ usuario_id: aluno.id, matricula: '123', senha_hash: hashDoPedido }])
      const { rows: vinculos } = await bancada.pool.query<{ turma_id: string; disciplina_id: string | null; estado: string; decidido_em: Date | null; criado_por: string }>(
        `select turma_id, disciplina_id, estado, decidido_em, criado_por from vinculo where escola_id = $1 and usuario_id = $2 and papel = 'aluno'`,
        [s.escolaId, aluno.id],
      )
      expect(vinculos).toEqual([{ turma_id: s.turma, disciplina_id: null, estado: 'confirmado', decidido_em: expect.any(Date), criado_por: s.professor.usuarioId }])
      expect(await nomeNoBanco(linha.id)).toEqual({ nome: null, matricula: null, estado: 'aprovado', usuario_id: aluno.id })
      expect(await pedidoNoBanco(pedidoId)).toEqual({
        estado: 'aprovada',
        senha_hash: null,
        chave_envio: null,
        teve_matricula_errada: null,
        decidida_em: expect.any(Date),
        decidida_por: s.professor.usuarioId,
        decidida_como: 'professor',
      })
      expect(await auditoriaDo(pedidoId)).toEqual([
        { autor_usuario_id: s.professor.usuarioId, depois: { turmaId: s.turma, estado: 'aprovada', decididaComo: 'professor', alunoId: aluno.id } },
      ])

      // E22 e E18: entra logo depois, sem a espera da conta segurada, com "123" e com " 123 ".
      for (const matricula of ['123', ' 123 ']) {
        const entrada = await entrar(s, matricula)
        expect(entrada.status, matricula).toBe(200)
        expect(loginResponseSchema.parse(entrada.corpo)).toMatchObject({ etapa: 'pronta' })
      }
    })
  })

  describe('E22 com o lote parado no meio', () => {
    it('um erro no meio do lote não desfaz as aprovações de antes, e o contador de cada uma é zerado mesmo assim', async () => {
      const s = await sala.montar()
      const nomes = await sala.nomes(s, s.turma, 2)
      const aprovados: string[] = []
      for (const nome of nomes) {
        aprovados.push(await pedir(s, nome))
        for (let vez = 0; vez < 5; vez++) await entrar(s, nome.matricula)
        expect((await entrar(s, nome.matricula)).corpo.erro?.codigo).toBe(ErrorCode.CONTA_SEGURADA)
      }
      // Um pedido pendente que aponta para um nome de outro ano da escola, que a FK (só com a escola) aceita e a API nunca
      // grava: a aprovação dele não acha o nome no ano em curso e para o lote com um erro interno.
      const { rows: anos } = await bancada.pool.query<{ id: string }>(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`, [
        s.escolaId,
      ])
      const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, 'Antiga') returning id`, [
        s.escolaId,
        anos[0]?.id,
        s.serieId,
      ])
      const { rows: antigos } = await bancada.pool.query<{ id: string }>(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, 'Nome antigo', $4, 'reivindicado') returning id`,
        [s.escolaId, anos[0]?.id, turmas[0]?.id, `antiga-${randomUUID().slice(0, 8)}`],
      )
      const { rows: quebrados } = await bancada.pool.query<{ id: string }>(
        `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada) values ($1, $2, $3, $4, gen_random_uuid(), 'hash-sintetico', false) returning id`,
        [s.escolaId, s.anoLetivoId, s.turma, antigos[0]?.id],
      )
      const quebrado = quebrados[0]?.id ?? ''

      // Um pedido depois do erro: o lote para no quebrado, e este não é decidido.
      const depoisDoErro = await pedir(s, await sala.umNome(s))
      const lote = await decidir(s.professor, [...aprovados, quebrado, depoisDoErro])
      expect(lote.status).toBe(500)
      // O erro sai curto e tipado, sem a mensagem interna nem a pilha (regra 20, item 11).
      expect(Object.keys(lote.corpo)).toEqual(['erro'])
      expect(Object.keys(lote.corpo.erro ?? {}).sort()).toEqual(['codigo', 'mensagem', 'requisicaoId'])
      expect(JSON.stringify(lote.corpo)).not.toContain('nome do pedido')
      for (const id of aprovados) expect((await pedidoNoBanco(id)).estado, id).toBe('aprovada')
      expect((await pedidoNoBanco(quebrado)).estado).toBe('pendente')
      expect((await pedidoNoBanco(depoisDoErro)).estado).toBe('pendente')
      // Os dois contadores foram zerados, e não só o primeiro.
      for (const nome of nomes) expect((await entrar(s, nome.matricula)).status, nome.matricula).toBe(200)
    })
  })

  describe('E20, E25, E21 e E30: aprovar os selecionados, recusar, e o que sai do pedido', () => {
    it('E20: três selecionados aprovados criam três alunos; 0, 41 e o id repetido dão ENTRADA_INVALIDA, sem decidir nada', async () => {
      const s = await sala.montar()
      const nomes = await sala.nomes(s, s.turma, 4)
      const ids: string[] = []
      for (const nome of nomes) ids.push(await pedir(s, nome))
      const [primeiro, segundo, terceiro, quarto] = ids as [string, string, string, string]

      const invalidos = [[], Array.from({ length: 41 }, () => randomUUID()), [primeiro, primeiro], [primeiro, primeiro.toUpperCase()]]
      for (const lote of invalidos) {
        const resposta = await decidir(s.professor, lote)
        expect(resposta.status, String(lote.length)).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      expect((await post(s.professor, '/v1/reivindicacoes/decidir', { ids: [primeiro], decisao: 'aprovar_todos' })).status).toBe(400)
      expect((await post(s.professor, '/v1/reivindicacoes/decidir', { ids: [primeiro], decisao: 'aprovar', escolaId: s.escolaId })).status).toBe(400)
      expect((await alunosDa(s.escolaId)).usuarios).toBe(0)

      // 40 é o teto, e passa: os três selecionados e 37 que não existem. O id em maiúsculas volta como o banco o guarda.
      const lote = [primeiro, segundo, terceiro.toUpperCase(), ...Array.from({ length: 37 }, () => randomUUID())]
      const decididos = await decidir(s.professor, lote)
      expect(resultados(decididos)).toEqual(['decidida', 'decidida', 'decidida', ...Array<string>(37).fill('nao_encontrada')])
      expect(decisaoResponseSchema.parse(decididos.corpo).resultados.slice(0, 3).map((linha) => linha.id)).toEqual([primeiro, segundo, terceiro])
      expect(await alunosDa(s.escolaId)).toEqual({ usuarios: 3, credenciais: 3 })
      expect((await pedidoNoBanco(quarto)).estado).toBe('pendente')
    })

    it('E25 e E20: o pedido com a matrícula do colega é recusado; o nome volta à sala, sem o hash, e o dono o reivindica; A1 da recusa', async () => {
      const s = await sala.montar()
      const dono = await sala.umNome(s)
      // O colega sabe a matrícula do dono: o pedido fica pendente, e o professor o vê.
      const pedidoId = await pedir(s, dono)
      const antes = await pedidoNoBanco(pedidoId)
      expect(antes.senha_hash).not.toBeNull()

      expect(resultados(await decidir(s.professor, [pedidoId], 'recusar'))).toEqual(['decidida'])
      expect(await pedidoNoBanco(pedidoId)).toEqual({
        estado: 'recusada',
        senha_hash: null,
        chave_envio: null,
        teve_matricula_errada: null,
        decidida_em: expect.any(Date),
        decidida_por: s.professor.usuarioId,
        decidida_como: 'professor',
      })
      expect(await nomeNoBanco(dono.id)).toMatchObject({ estado: 'livre', usuario_id: null, matricula: dono.matricula })
      expect(await alunosDa(s.escolaId)).toEqual({ usuarios: 0, credenciais: 0 })
      expect(await auditoriaDo(pedidoId)).toEqual([{ autor_usuario_id: s.professor.usuarioId, depois: { turmaId: s.turma, estado: 'recusada', decididaComo: 'professor', alunoId: null } }])

      const aberta = salaAbertaResponseSchema.parse(JSON.parse((await sala.abrir({ slug: s.slug, codigo: s.codigo })).texto))
      expect(aberta.nomes.map((nome) => nome.id)).toContain(dono.id)
      const doDono = await pedir(s, dono)
      expect(doDono).not.toBe(pedidoId)
      expect((await pedidoNoBanco(doDono)).estado).toBe('pendente')
    })

    it('E21 e E30: aprovado e recusado ficam sem chave e sem teve_matricula_errada; a lista mostra a marca antes; a auditoria não a leva', async () => {
      const s = await sala.montar()
      const [marcadoAprovado, marcadoRecusado, limpo] = (await sala.nomes(s, s.turma, 3)) as [NomeDaLista, NomeDaLista, NomeDaLista]
      for (const nome of [marcadoAprovado, marcadoRecusado]) {
        for (let vez = 0; vez < 2; vez++) expect((await sala.reivindicar(pedidoDaSala(s, nome, { matricula: `errada-${randomUUID().slice(0, 8)}` }))).status).toBe(409)
      }
      const aprovado = await pedir(s, marcadoAprovado)
      const recusado = await pedir(s, marcadoRecusado)
      const semMarca = await pedir(s, limpo)

      const lidos = pedidosDaTurmaResponseSchema.parse((await lerPedidos(s.professor, s.turma)).corpo).itens
      expect(Object.fromEntries(lidos.map((pedido) => [pedido.id, pedido.teveMatriculaErrada]))).toEqual({ [aprovado]: true, [recusado]: true, [semMarca]: false })

      expect(resultados(await decidir(s.professor, [aprovado]))).toEqual(['decidida'])
      expect(resultados(await decidir(s.professor, [recusado], 'recusar'))).toEqual(['decidida'])
      for (const id of [aprovado, recusado]) {
        expect(await pedidoNoBanco(id), id).toMatchObject({ chave_envio: null, senha_hash: null, teve_matricula_errada: null })
        const [registro] = await auditoriaDo(id)
        expect(Object.keys(registro?.depois ?? {}).sort()).toEqual(['alunoId', 'decididaComo', 'estado', 'turmaId'])
      }
    })
  })

  describe('dois alunos com o mesmo nome', () => {
    it('os dois pedidos aparecem com ids distintos, e aprovar um grava a matrícula do nome dele; o outro continua pendente', async () => {
      const s = await sala.montar()
      const nome = `Ana Souza ${randomUUID().slice(0, 8)}`
      const [primeira, segunda] = [`ana-1-${randomUUID().slice(0, 8)}`, `ana-2-${randomUUID().slice(0, 8)}`]
      expect((await post(s.coordenacao, `/v1/turmas/${s.turma}/lista`, { texto: `${nome};${primeira}\n${nome};${segunda}` })).status).toBe(201)
      const { rows } = await bancada.pool.query<{ id: string; matricula: string }>('select id, matricula from lista_nome where escola_id = $1', [s.escolaId])
      const idDa = (matricula: string) => rows.find((linha) => linha.matricula === matricula)?.id ?? ''
      const daPrimeira = await pedir(s, { id: idDa(primeira), nome, matricula: primeira })
      const daSegunda = await pedir(s, { id: idDa(segunda), nome, matricula: segunda })
      const lidos = pedidosDaTurmaResponseSchema.parse((await lerPedidos(s.professor, s.turma)).corpo).itens
      expect(lidos.map((pedido) => [pedido.id, pedido.nome])).toEqual([
        [daPrimeira, nome],
        [daSegunda, nome],
      ])

      expect(resultados(await decidir(s.professor, [daSegunda]))).toEqual(['decidida'])
      const { rows: credenciais } = await bancada.pool.query('select matricula from credencial_matricula where escola_id = $1', [s.escolaId])
      expect(credenciais).toEqual([{ matricula: segunda }])
      expect((await pedidoNoBanco(daPrimeira)).estado).toBe('pendente')
      expect(await nomeNoBanco(idDa(primeira))).toMatchObject({ estado: 'reivindicado', matricula: primeira })
    })
  })

  describe('I6: o lote misto responde nao_encontrada igual para tudo que quem decide não alcança', () => {
    /** Um pedido gravado no banco, como a sala o grava: o pendente com o nome `reivindicado`; o decidido com o nome livre. */
    async function gravado(escolaId: string, anoLetivoId: string, turmaId: string, estado: 'pendente' | 'recusada'): Promise<string> {
      const matricula = `i6-${randomUUID().slice(0, 12)}`
      const { rows: nomes } = await bancada.pool.query<{ id: string }>(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, $4, $5, $6) returning id`,
        [escolaId, anoLetivoId, turmaId, `Nome ${matricula}`, matricula, estado === 'pendente' ? 'reivindicado' : 'livre'],
      )
      const listaNomeId = nomes[0]?.id
      const { rows } =
        estado === 'pendente'
          ? await bancada.pool.query<{ id: string }>(
              `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada) values ($1, $2, $3, $4, gen_random_uuid(), 'hash-sintetico', false) returning id`,
              [escolaId, anoLetivoId, turmaId, listaNomeId],
            )
          : await bancada.pool.query<{ id: string }>(
              `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, estado, decidida_em, decidida_como) values ($1, $2, $3, $4, 'recusada', now(), 'coordenacao') returning id`,
              [escolaId, anoLetivoId, turmaId, listaNomeId],
            )
      const id = rows[0]?.id
      if (id === undefined) throw new Error('pedido não gravado')
      return id
    }

    async function estadosDe(ids: readonly string[]): Promise<Record<string, string>> {
      const { rows } = await bancada.pool.query<{ id: string; estado: string }>('select id, estado from reivindicacao where id = any($1::uuid[])', [ids])
      return Object.fromEntries(rows.map((linha) => [linha.id, linha.estado]))
    }

    it('pelo professor de T1: o aleatório, B, T2 sem vínculo, T3 pendente, T4 contestado e T5 de ano encerrado respondem igual, e só T1 é decidida; pela coordenação de A, B continua nao_encontrada', async () => {
      // T5: a turma do professor no ano que depois é encerrado, com o vínculo dele confirmado.
      const a = await sala.montar()
      const t5 = await gravado(a.escolaId, a.anoLetivoId, a.turma, 'pendente')
      await bancada.pool.query(`update ano_letivo set situacao = 'encerrado' where id = $1`, [a.anoLetivoId])
      const { rows: anos } = await bancada.pool.query<{ id: string }>(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'em_curso') returning id`, [
        a.escolaId,
      ])
      const anoEmCurso = anos[0]?.id
      if (anoEmCurso === undefined) throw new Error('ano não criado')
      const turma = async (nome: string) => {
        const criada = await post(a.coordenacao, '/v1/turmas', { serieId: a.serieId, nome })
        expect(criada.status).toBe(201)
        return criada.corpo['id'] as string
      }
      const [t1, t2, t3, t4] = [await turma('T1'), await turma('T2'), await turma('T3'), await turma('T4')]
      const alocar = async (turmaId: string) => {
        const criado = await post(a.coordenacao, '/v1/vinculos', { usuarioId: a.professor.usuarioId, turmaId, disciplinaId: a.quimica, papel: 'professor' })
        expect(criado.status).toBe(201)
        return criado.corpo['id'] as string
      }
      expect((await post(a.professor, `/v1/vinculos/${await alocar(t1)}/confirmar`)).status).toBe(200)
      await alocar(t3)
      expect((await post(a.professor, `/v1/vinculos/${await alocar(t4)}/contestar`, { contestacao: 'nao_leciono' })).status).toBe(200)
      // T2 tem outro professor confirmado, e nenhum vínculo do professor que decide: o vínculo tem de ser dele.
      const outro = await bancada.sessao(a.escolaId, 'professor')
      const doOutro = await post(a.coordenacao, '/v1/vinculos', { usuarioId: outro.usuarioId, turmaId: t2, disciplinaId: a.quimica, papel: 'professor' })
      expect((await post(outro, `/v1/vinculos/${doOutro.corpo['id'] as string}/confirmar`)).status).toBe(200)
      // T6: o usuário do professor com um vínculo confirmado de aluno, que o banco aceita e a API nunca cria: não é o dele de professor.
      const t6 = await turma('T6')
      await bancada.pool.query(
        `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
        [a.escolaId, anoEmCurso, a.professor.usuarioId, t6, a.coordenacao.usuarioId],
      )

      const b = await sala.montar()
      const bPendente = await gravado(b.escolaId, b.anoLetivoId, b.turma, 'pendente')
      const bDecidido = await gravado(b.escolaId, b.anoLetivoId, b.turma, 'recusada')
      const t2Pendente = await gravado(a.escolaId, anoEmCurso, t2, 'pendente')
      const t2Decidido = await gravado(a.escolaId, anoEmCurso, t2, 'recusada')
      const t3Pendente = await gravado(a.escolaId, anoEmCurso, t3, 'pendente')
      const t4Pendente = await gravado(a.escolaId, anoEmCurso, t4, 'pendente')
      const t6Pendente = await gravado(a.escolaId, anoEmCurso, t6, 'pendente')
      const t1Pendente = await gravado(a.escolaId, anoEmCurso, t1, 'pendente')
      const deFora = [bPendente, bDecidido, t2Pendente, t2Decidido, t3Pendente, t4Pendente, t5, t6Pendente]
      const antes = await estadosDe(deFora)
      const alunosAntes = { a: await alunosDa(a.escolaId), b: await alunosDa(b.escolaId) }

      const lote = [randomUUID(), ...deFora, t1Pendente]
      const resposta = await decidir(a.professor, lote)
      expect(resultados(resposta)).toEqual([...Array<string>(9).fill('nao_encontrada'), 'decidida'])
      // Idênticos entre si e ao aleatório: o mesmo objeto, só com o id de cada um.
      const linhas = decisaoResponseSchema.parse(resposta.corpo).resultados
      expect(linhas.map((linha) => linha.id)).toEqual(lote)
      expect(await estadosDe(deFora)).toEqual(antes)
      expect((await pedidoNoBanco(t1Pendente)).estado).toBe('aprovada')
      expect(await alunosDa(a.escolaId)).toEqual({ usuarios: alunosAntes.a.usuarios + 1, credenciais: alunosAntes.a.credenciais + 1 })
      expect(await alunosDa(b.escolaId)).toEqual(alunosAntes.b)

      // A coordenação de A alcança toda turma de A no ano em curso, e nada de B nem do ano encerrado.
      const peloCoordenador = [randomUUID(), bPendente, bDecidido, t2Pendente, t2Decidido, t3Pendente, t4Pendente, t5, t6Pendente, t1Pendente]
      expect(resultados(await decidir(a.coordenacao, peloCoordenador, 'recusar'))).toEqual([
        'nao_encontrada',
        'nao_encontrada',
        'nao_encontrada',
        'decidida',
        'ja_decidida',
        'decidida',
        'decidida',
        'nao_encontrada',
        'decidida',
        'ja_decidida',
      ])
      expect(await estadosDe([bPendente, bDecidido, t5])).toEqual({ [bPendente]: 'pendente', [bDecidido]: 'recusada', [t5]: 'pendente' })
      expect(await estadosDe([t2Pendente, t3Pendente, t4Pendente])).toEqual({ [t2Pendente]: 'recusada', [t3Pendente]: 'recusada', [t4Pendente]: 'recusada' })
      expect(await alunosDa(b.escolaId)).toEqual(alunosAntes.b)
    })
  })

  describe('P3, E12, A2 e P4: quem lê os pedidos, e com que registro', () => {
    it('E12 e P3: o professor com o vínculo pendente e o aluno recebem 404, e o professor pendente não decide; P4: o aluno no decidir recebe 404', async () => {
      const s = await sala.montar()
      const pedidoId = await pedir(s, await sala.umNome(s))
      const alocado = await bancada.sessao(s.escolaId, 'professor')
      expect((await post(s.coordenacao, '/v1/vinculos', { usuarioId: alocado.usuarioId, turmaId: s.turma, disciplinaId: s.fisica, papel: 'professor' })).status).toBe(201)
      const aluno = await bancada.sessao(s.escolaId, 'aluno')
      const NAO_ENCONTRADO = { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO }
      for (const [quem, sessao] of [
        ['professor com o vínculo pendente', alocado],
        ['aluno', aluno],
      ] as const) {
        const lida = await lerPedidos(sessao, s.turma)
        expect(lida.status, quem).toBe(404)
        expect(lida.corpo.erro, quem).toMatchObject(NAO_ENCONTRADO)
      }
      expect(resultados(await decidir(alocado, [pedidoId]))).toEqual(['nao_encontrada'])
      const doAluno = await decidir(aluno, [pedidoId])
      expect(doAluno.status).toBe(404)
      expect(doAluno.corpo.erro).toMatchObject(NAO_ENCONTRADO)
      expect((await pedidoNoBanco(pedidoId)).estado).toBe('pendente')
    })

    it('P3: a coordenação sem finalidade recebe ENTRADA_INVALIDA para qualquer id, inclusive inexistente e de B, e nada é registrado', async () => {
      const s = await sala.montar()
      const b = await sala.montar()
      const { rows: marco } = await bancada.pool.query<{ agora: Date }>('select clock_timestamp() as agora')
      const respostas = await Promise.all([s.turma, randomUUID(), b.turma].map((turmaId) => lerPedidos(s.coordenacao, turmaId)))
      for (const resposta of respostas) {
        expect(resposta.status).toBe(400)
        expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      }
      // A consulta é estrita: a escola nunca vem do cliente, nem com a finalidade.
      const comEscola = await lerPedidos(s.coordenacao, s.turma, `?finalidade=${FINALIDADE}&escolaId=${s.escolaId}`)
      expect(comEscola.status).toBe(400)
      expect(comEscola.corpo.erro?.codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
      const { rows } = await bancada.pool.query('select id from auditoria where escola_id = $1 and em >= $2', [s.escolaId, marco[0]?.agora])
      expect(rows).toEqual([])
    })

    it('P3: o professor com duas disciplinas na turma, as duas confirmadas, vê cada pedido uma vez; com uma só confirmada, decide', async () => {
      const s = await sala.montar()
      const nomes = await sala.nomes(s, s.turma, 3)
      const ids: string[] = []
      for (const nome of nomes) ids.push(await pedir(s, nome))
      const fisica = await post(s.coordenacao, '/v1/vinculos', { usuarioId: s.professor.usuarioId, turmaId: s.turma, disciplinaId: s.fisica, papel: 'professor' })
      expect(fisica.status).toBe(201)
      // Química confirmada e Física pendente: decide.
      expect(resultados(await decidir(s.professor, [ids[0] as string]))).toEqual(['decidida'])
      expect((await post(s.professor, `/v1/vinculos/${fisica.corpo['id'] as string}/confirmar`)).status).toBe(200)
      const lidos = pedidosDaTurmaResponseSchema.parse((await lerPedidos(s.professor, s.turma)).corpo).itens
      expect(lidos.map((pedido) => pedido.id)).toEqual([ids[1], ids[2]])
    })

    it('A2: a coordenação grava turma.reivindicacoes_lidas com a finalidade a cada leitura; o professor lê sem registro; o pedido traz nome, hora e a marca, e nada mais', async () => {
      const s = await sala.montar()
      const nomes = await sala.nomes(s, s.turma, 2)
      const ids: string[] = []
      for (const nome of nomes) ids.push(await pedir(s, nome))
      // Um pedido de outra turma não aparece.
      const outro = await sala.gerar(s, s.outraTurma)
      await pedir(s, await sala.umNome(s, s.outraTurma), { codigo: outro.codigo })
      const { rows: marco } = await bancada.pool.query<{ agora: Date }>('select clock_timestamp() as agora')

      const pelaCoordenacao = [await lerPedidos(s.coordenacao, s.turma, `?finalidade=${FINALIDADE}`), await lerPedidos(s.coordenacao, s.turma, `?finalidade=${FINALIDADE}`)]
      // O professor lê sem registro, também quando manda uma finalidade.
      const peloProfessor = [await lerPedidos(s.professor, s.turma), await lerPedidos(s.professor, s.turma, `?finalidade=${FINALIDADE}`)]
      for (const resposta of [...pelaCoordenacao, ...peloProfessor]) {
        expect(resposta.status).toBe(200)
        const { itens } = pedidosDaTurmaResponseSchema.parse(resposta.corpo)
        expect(itens).toEqual(
          nomes.map((nome, posicao) => ({ id: ids[posicao], nome: nome.nome, solicitadaEm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), teveMatriculaErrada: false })),
        )
      }
      const { rows } = await bancada.pool.query<{ acao: string; entidade_id: string; autor_usuario_id: string; depois: unknown; finalidade: string }>(
        'select acao, entidade_id, autor_usuario_id, depois, finalidade from auditoria where escola_id = $1 and em >= $2 order by id',
        [s.escolaId, marco[0]?.agora],
      )
      const registro = { acao: 'turma.reivindicacoes_lidas', entidade_id: s.turma, autor_usuario_id: s.coordenacao.usuarioId, depois: { quantidade: 2 }, finalidade: FINALIDADE }
      expect(rows).toEqual([registro, registro])
    })

    it('a página: com limite 1, o primeiro pedido e a próxima; a segunda página traz o outro', async () => {
      const s = await sala.montar()
      const ids: string[] = []
      for (const nome of await sala.nomes(s, s.turma, 2)) ids.push(await pedir(s, nome))
      const primeira = pedidosDaTurmaResponseSchema.parse((await lerPedidos(s.professor, s.turma, '?limite=1')).corpo)
      expect(primeira.itens.map((pedido) => pedido.id)).toEqual([ids[0]])
      expect(primeira.proxima).toBe(ids[0])
      const segunda = pedidosDaTurmaResponseSchema.parse((await lerPedidos(s.professor, s.turma, `?limite=1&pagina=${primeira.proxima ?? ''}`)).corpo)
      expect(segunda).toEqual({ itens: [expect.objectContaining({ id: ids[1] })] })
    })
  })

  describe('E27: a turma sem professor é decidida pela coordenação', () => {
    it('com o vínculo encerrado depois do pedido, o link antigo deixa de aceitar pedido, o professor não decide, a coordenação decide como coordenacao e não gera acesso', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const pedidoId = await pedir(s, nome, { codigo: undefined, token: s.token })
      for (const id of await vinculosDe(s.professor.usuarioId, s.turma)) expect((await post(s.coordenacao, `/v1/vinculos/${id}/encerrar`, { motivo: 'desligamento' })).status).toBe(200)
      // O fim do último vínculo de quem gerou revoga o acesso (correção 2026-10-03-acesso-sobrevive-ao-vinculo): o link
      // antigo responde como inexistente, e o pedido que chegou antes continua para a coordenação decidir.
      const pedidoPeloRevogado = await sala.reivindicar(pedidoDaSala(s, await sala.umNome(s), { codigo: undefined, token: s.token }))
      const pedidoPeloInexistente = await sala.reivindicar(pedidoDaSala(s, await sala.umNome(s), { codigo: undefined, token: randomBytes(32).toString('base64url') }))
      expect(pedidoPeloRevogado.status).toBe(404)
      expect(semRequisicao(pedidoPeloRevogado)).toEqual(semRequisicao(pedidoPeloInexistente))
      expect((await lerPedidos(s.professor, s.turma)).status).toBe(404)
      expect(resultados(await decidir(s.professor, [pedidoId]))).toEqual(['nao_encontrada'])

      expect(resultados(await decidir(s.coordenacao, [pedidoId]))).toEqual(['decidida'])
      expect(await pedidoNoBanco(pedidoId)).toMatchObject({ estado: 'aprovada', decidida_por: s.coordenacao.usuarioId, decidida_como: 'coordenacao' })
      const [registro] = await auditoriaDo(pedidoId)
      expect(registro).toMatchObject({ autor_usuario_id: s.coordenacao.usuarioId, depois: { decididaComo: 'coordenacao', estado: 'aprovada' } })
      expect((await post(s.coordenacao, `/v1/turmas/${s.turma}/acesso`, { validadeDias: 7 })).status).toBe(404)
    })
  })

  describe('C3: decisões ao mesmo tempo no mesmo pedido', () => {
    /** Os resultados das duas respostas, em ordem, e o que ficou no banco. */
    async function depois(pedidoId: string, escolaId: string) {
      return { estado: (await pedidoNoBanco(pedidoId)).estado, auditorias: (await auditoriaDo(pedidoId)).length, alunos: await alunosDa(escolaId) }
    }

    it('aprovar × recusar, pelo mesmo professor: um decide, o outro ja_decidida; uma auditoria; um aluno só se a aprovação venceu', async () => {
      const s = await sala.montar()
      const pedidoId = await pedir(s, await sala.umNome(s))
      const [aprovar, recusar] = await Promise.all([decidir(s.professor, [pedidoId]), decidir(s.professor, [pedidoId], 'recusar')])
      expect([...resultados(aprovar), ...resultados(recusar)].sort()).toEqual(['decidida', 'ja_decidida'])
      const final = await depois(pedidoId, s.escolaId)
      const aprovou = final.estado === 'aprovada'
      expect(final).toEqual({ estado: aprovou ? 'aprovada' : 'recusada', auditorias: 1, alunos: aprovou ? { usuarios: 1, credenciais: 1 } : { usuarios: 0, credenciais: 0 } })
      expect(resultados(aprovou ? aprovar : recusar)).toEqual(['decidida'])
    })

    it('com a aprovação parada no meio, a recusa da coordenação espera a trava do pedido e sai ja_decidida, sem gravar nada', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const pedidoId = await pedir(s, nome)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'update', quando: `new.id = '${nome.id}'::uuid and new.estado = 'aprovado'` })
      await gatilho.armar()
      try {
        const aprovando = decidir(s.professor, [pedidoId])
        await gatilho.esperarParadas()
        // A segunda decisão para na trava da linha do pedido, e não mais adiante: é o `for update` que a segura.
        const recusando = decidir(s.coordenacao, [pedidoId], 'recusar')
        await esperarNaTrava(bancada.pool, '%from "reivindicacao"%for update%')
        await gatilho.soltar()
        const [aprovada, recusada] = await Promise.all([aprovando, recusando])
        expect(resultados(aprovada)).toEqual(['decidida'])
        expect(resultados(recusada)).toEqual(['ja_decidida'])
      } finally {
        await gatilho.desarmar()
      }
      expect(await depois(pedidoId, s.escolaId)).toEqual({ estado: 'aprovada', auditorias: 1, alunos: { usuarios: 1, credenciais: 1 } })
    })

    it('professor × coordenação aprovando o mesmo pedido: um aluno, uma credencial, uma auditoria', async () => {
      const s = await sala.montar()
      const pedidoId = await pedir(s, await sala.umNome(s))
      const respostas = await Promise.all([decidir(s.professor, [pedidoId]), decidir(s.coordenacao, [pedidoId])])
      expect(respostas.flatMap(resultados).sort()).toEqual(['decidida', 'ja_decidida'])
      expect(await depois(pedidoId, s.escolaId)).toEqual({ estado: 'aprovada', auditorias: 1, alunos: { usuarios: 1, credenciais: 1 } })
    })

    it('o mesmo lote de três duas vezes: cada pedido decidido uma vez, com três alunos e três auditorias', async () => {
      const s = await sala.montar()
      const ids: string[] = []
      for (const nome of await sala.nomes(s, s.turma, 3)) ids.push(await pedir(s, nome))
      const [primeiro, segundo] = await Promise.all([decidir(s.professor, ids), decidir(s.professor, ids)])
      const deUm = resultados(primeiro)
      const deOutro = resultados(segundo)
      for (const [posicao, id] of ids.entries()) {
        expect([deUm[posicao], deOutro[posicao]].sort(), id).toEqual(['decidida', 'ja_decidida'])
        expect((await auditoriaDo(id)).length, id).toBe(1)
      }
      expect(await alunosDa(s.escolaId)).toEqual({ usuarios: 3, credenciais: 3 })
    })
  })

  describe('o nome aprovado na lista (E6, E7, R2) e na virada do ano (E19)', () => {
    async function aprovado(s: SalaDeTeste): Promise<{ nome: NomeDaLista; alunoId: string }> {
      const nome = await sala.umNome(s)
      const pedidoId = await pedir(s, nome)
      expect(resultados(await decidir(s.professor, [pedidoId]))).toEqual(['decidida'])
      const alunoId = (await nomeNoBanco(nome.id))?.usuario_id
      if (alunoId == null) throw new Error('nome não aprovado')
      return { nome, alunoId }
    }

    it('E6: a matrícula do aprovado nesta turma sai ja_existe na prévia e não entra de novo na gravação; em outra turma, matricula_em_uso', async () => {
      const s = await sala.montar()
      const { nome } = await aprovado(s)
      const nova = `nova-${randomUUID().slice(0, 8)}`
      const previa = previaDaListaResponseSchema.parse((await post(s.coordenacao, `/v1/turmas/${s.turma}/lista/previa`, { texto: `${nome.nome};${nome.matricula}\nNova;${nova}` })).corpo)
      expect(previa.linhas.map((linha) => [linha.matricula, linha.resultado, linha.erro])).toEqual([
        [nome.matricula, 'ja_existe', undefined],
        [nova, 'entra', undefined],
      ])
      const naOutra = previaDaListaResponseSchema.parse((await post(s.coordenacao, `/v1/turmas/${s.outraTurma}/lista/previa`, { texto: `${nome.nome};${nome.matricula}` })).corpo)
      expect(naOutra.linhas.map((linha) => [linha.resultado, linha.erro])).toEqual([['erro', 'matricula_em_uso']])

      const gravada = await post(s.coordenacao, `/v1/turmas/${s.turma}/lista`, { texto: `${nome.nome};${nome.matricula}` })
      expect(gravada.status).toBe(201)
      expect(gravada.corpo).toEqual({ gravados: 0, jaExistentes: 1 })
      const { rows } = await bancada.pool.query('select id from lista_nome where escola_id = $1', [s.escolaId])
      expect(rows).toHaveLength(1)
    })

    it('E7: retirar o nome aprovado dá CONFLITO e não apaga; o avulso com a matrícula do aprovado dá CONFLITO sem gravar; R2: reivindicar o nome aprovado é recusado sem gravar', async () => {
      const s = await sala.montar()
      const { nome, alunoId } = await aprovado(s)
      const retirada = await chamar(api.url, 'DELETE', `/v1/lista-nomes/${nome.id}`, s.coordenacao.token)
      expect(retirada.status).toBe(409)
      expect(retirada.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      expect(await nomeNoBanco(nome.id)).toMatchObject({ estado: 'aprovado', usuario_id: alunoId })

      const avulso = await post(s.coordenacao, `/v1/turmas/${s.outraTurma}/lista/nome`, { nome: 'Chegou em maio', matricula: nome.matricula })
      expect(avulso.status).toBe(409)
      expect(avulso.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      const { rows: lista } = await bancada.pool.query('select id from lista_nome where escola_id = $1', [s.escolaId])
      expect(lista).toHaveLength(1)

      const { rows: pedidosAntes } = await bancada.pool.query('select id from reivindicacao where escola_id = $1', [s.escolaId])
      const recusa = await sala.reivindicar(pedidoDaSala(s, nome))
      expect(recusa.status).toBe(409)
      expect(JSON.parse(recusa.texto)).toMatchObject({ erro: { codigo: ErrorCode.REIVINDICACAO_RECUSADA } })
      const { rows: pedidosDepois } = await bancada.pool.query('select id from reivindicacao where escola_id = $1', [s.escolaId])
      expect(pedidosDepois).toEqual(pedidosAntes)
    })

    it('E19: depois do encerrar, o aprovado aparece nos alunos do ano encerrado', async () => {
      const s = await sala.montar()
      const { nome, alunoId } = await aprovado(s)
      expect((await post(s.coordenacao, `/v1/anos-letivos/${s.anoLetivoId}/encerrar`)).status).toBe(200)
      const lidos = await chamar(api.url, 'GET', `/v1/turmas/${s.turma}/alunos?anoLetivoId=${s.anoLetivoId}&finalidade=${FINALIDADE}`, s.coordenacao.token)
      expect(lidos.status).toBe(200)
      expect(alunosDaTurmaResponseSchema.parse(lidos.corpo).itens).toEqual([{ usuarioId: alunoId, nome: nome.nome }])
    })
  })

  describe('C12 (herdado da 2.0): a lista e a aprovação da mesma matrícula ao mesmo tempo', () => {
    it('o avulso com a matrícula que está sendo aprovada espera o commit e sai CONFLITO; a gravação a acha na lista e não a grava', async () => {
      const s = await sala.montar()
      const [avulso, gravacao] = (await sala.nomes(s, s.turma, 2)) as [NomeDaLista, NomeDaLista]
      for (const nome of [avulso, gravacao]) {
        const pedidoId = await pedir(s, nome)
        const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'update', quando: `new.id = '${nome.id}'::uuid and new.estado = 'aprovado'` })
        await gatilho.armar()
        try {
          const aprovando = decidir(s.professor, [pedidoId])
          await gatilho.esperarParadas()
          if (nome === avulso) {
            // A aprovação já tirou a matrícula da lista e gravou a credencial, sem commit: o `insert` espera no índice único.
            const acrescentando = post(s.coordenacao, `/v1/turmas/${s.outraTurma}/lista/nome`, { nome: 'Chegou em maio', matricula: nome.matricula })
            await esperarNaTrava(bancada.pool, '%insert into "lista_nome"%')
            await gatilho.soltar()
            const [aprovada, acrescentado] = await Promise.all([aprovando, acrescentando])
            expect(resultados(aprovada)).toEqual(['decidida'])
            expect(acrescentado.status).toBe(409)
            expect(acrescentado.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
          } else {
            // A lista é lida antes da credencial: a matrícula ainda está na lista, sem o commit da aprovação.
            const naOutra = await post(s.coordenacao, `/v1/turmas/${s.outraTurma}/lista`, { texto: `Outro;${nome.matricula}` })
            expect(naOutra.status).toBe(409)
            const naMesma = await post(s.coordenacao, `/v1/turmas/${s.turma}/lista`, { texto: `${nome.nome};${nome.matricula}` })
            expect(naMesma.corpo).toEqual({ gravados: 0, jaExistentes: 1 })
            await gatilho.soltar()
            expect(resultados(await aprovando)).toEqual(['decidida'])
          }
        } finally {
          await gatilho.desarmar()
        }
        const { rows } = await bancada.pool.query('select id from lista_nome where escola_id = $1 and btrim(matricula) = $2', [s.escolaId, nome.matricula])
        expect(rows, nome.matricula).toEqual([])
        const { rows: credenciais } = await bancada.pool.query('select id from credencial_matricula where escola_id = $1 and matricula = $2', [s.escolaId, nome.matricula])
        expect(credenciais).toHaveLength(1)
      }
    })
  })

  describe('segunda camada: os repositories da sala e da decisão, com a turma, o nome ou o pedido de outra escola ou de outro ano', () => {
    it('no contexto de A, nada de B é lido nem escrito; no ano que não é o da linha, nada de A também', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const chaveDeA = randomUUID()
      const chaveDeB = randomUUID()
      const [nomeDeA, livreDeA] = (await sala.nomes(a, a.turma, 2)) as [NomeDaLista, NomeDaLista]
      const [nomeDeB, livreDeB] = (await sala.nomes(b, b.turma, 2)) as [NomeDaLista, NomeDaLista]
      const pedidoDeA = await pedir(a, nomeDeA, { chaveEnvio: chaveDeA })
      const pedidoDeB = await pedir(b, nomeDeB, { chaveEnvio: chaveDeB })
      const retrato = async () =>
        (await bancada.pool.query('select l.id, l.estado, l.nome, r.estado as pedido from lista_nome l left join reivindicacao r on r.lista_nome_id = l.id where l.escola_id = any($1::uuid[]) order by l.id', [[a.escolaId, b.escolaId]])).rows
      const antes = await retrato()

      /** O contexto de A, no ano em curso dela ou num ano que não é o da linha. */
      const emA = <T>(anoLetivoId: string, funcao: () => Promise<T>) =>
        runInContext({ requisicaoId: randomUUID(), escolaId: a.escolaId, anoLetivoId, usuarioId: a.coordenacao.usuarioId, papel: 'coordenador', sessaoId: a.coordenacao.sessaoId }, funcao)
      const outroAno = randomUUID()
      const casos: Array<readonly [string, string, NomeDaLista, NomeDaLista, string, string, string]> = [
        ['B no ano de A', a.anoLetivoId, nomeDeB, livreDeB, pedidoDeB, b.turma, chaveDeB],
        // O ano é por escola: só com o ano de B no contexto de A a escola do contexto é a única cláusula que segura B.
        ['B no ano de B', b.anoLetivoId, nomeDeB, livreDeB, pedidoDeB, b.turma, chaveDeB],
        ['A em outro ano', outroAno, nomeDeA, livreDeA, pedidoDeA, a.turma, chaveDeA],
      ]
      for (const [caso, ano, reivindicado, livre, pedidoId, turmaId, chave] of casos) {
        await emA(ano, async () => {
          expect(await new ReivindicacaoRepository(bancada.banco).chaveGravada(turmaId, chave), caso).toBe(false)
          expect(await new ListaLivreRepository(bancada.banco).tomar({ turmaId, listaNomeId: livre.id, matricula: livre.matricula }), caso).toBe(false)
          const decisoes = new DecisaoRepository(bancada.banco)
          expect(await decisoes.travarPendente(pedidoId, 'unidade'), caso).toBeUndefined()
          expect(await decisoes.alcancavel(pedidoId, 'unidade'), caso).toBe(false)
          expect(await decisoes.pendentes(turmaId, { limite: 10 }), caso).toEqual([])
          expect(await decisoes.nomeDoPedido(reivindicado.id), caso).toBeUndefined()
          await decisoes.devolverNome(reivindicado.id)
          await decisoes.aprovarNome(livre.id, a.coordenacao.usuarioId)
          // O fechar só filtra a escola: o pedido de A em outro ano é o mesmo pedido, travado antes pela decisão.
          if (turmaId === b.turma) await decisoes.fechar(pedidoId, 'recusada', 'coordenacao')
        })
      }
      expect(await retrato()).toEqual(antes)
    })
  })
})
