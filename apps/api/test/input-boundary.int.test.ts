import { ErrorCode, MENSAGENS_DE_ERRO, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type TestApi, type RespostaHttp } from './test-api.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

/**
 * A borda de entrada de `estrutura/`, `sala/` e `governanca/` (reengenharia, 15.0, RF5; D81): cada rota diz o mesmo
 * antes e depois de o controller passar a validar pelo `ZodValidationPipe` e pelo `IdPipe` no parâmetro. O que cada rota
 * responde, ao pé da letra, a id fora do formato, a corpo ou consulta fora do esquema, a corpo que falta e a pessoa de
 * outro papel (a guarda responde antes do pipe). O caso é uma rota por vez, para que a mutação de um parâmetro caia só
 * no caso dele. Postgres e Redis reais do compose de teste; nada é gravado, e o banco prova.
 */

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const NAO_AUTENTICADO = { status: 401, corpo: { erro: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }

const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, corpo: { ...resposta.corpo, erro: { ...resposta.corpo.erro, requisicaoId: undefined } } })

interface Rota {
  /** O nome do caso: o método e a rota, como o código a declara. */
  readonly nome: string
  /** Quem alcança a rota. Quem não alcança é sempre o aluno, que recebe o 404 da guarda; a rota anônima não tem guarda. */
  readonly papel: PapelDeUsuario | 'anonimo'
  readonly metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** O caminho, com o parâmetro que o caso troca. */
  readonly caminho: (parametro: string) => string
  /** O parâmetro de caminho, se houver: fora do formato, e um que o formato aceita. `noServico`: o formato aceito chega ao service e lá é o 404. */
  readonly parametro?: { readonly foraDoFormato: string; readonly valido: string; readonly noServico: boolean }
  /** O corpo que o esquema aceita. Sem ele, a rota não lê corpo. */
  readonly corpo?: unknown
  readonly corpoInvalido?: unknown
  /** A consulta que o esquema aceita (com o `?`), e uma que não aceita. */
  readonly consulta?: string
  readonly consultaInvalida?: string
  /** Sem corpo nenhum: `aceito` passa do pipe, `recusado` é `ENTRADA_INVALIDA`. Só nas rotas que declaram o que fazem sem corpo. */
  readonly semCorpo?: 'aceito' | 'recusado'
}

const ID_QUALQUER = { foraDoFormato: 'nao-e-uuid', noServico: true } as const
const idSorteado = () => randomUUID()
const parametroDeId = () => ({ ...ID_QUALQUER, valido: idSorteado() })
const FUNCAO_FORA_DO_CATALOGO = 'corretor_de_redacao'

const consultaPaginada = { consulta: '?limite=100', consultaInvalida: '?limite=101' }

const ROTAS: readonly Rota[] = [
  { nome: 'POST /v1/anos-letivos', papel: 'coordenador', metodo: 'POST', caminho: () => '/v1/anos-letivos', corpo: { ano: 2031, inicio: '2031-02-01', fim: '2031-12-15' }, corpoInvalido: { ano: 2031, inicio: '2031-12-15', fim: '2031-02-01' } },
  { nome: 'GET /v1/anos-letivos', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/anos-letivos', ...consultaPaginada },
  { nome: 'POST /v1/anos-letivos/:id/abrir', papel: 'coordenador', metodo: 'POST', caminho: (id) => `/v1/anos-letivos/${id}/abrir`, parametro: parametroDeId() },
  { nome: 'POST /v1/anos-letivos/:id/encerrar', papel: 'coordenador', metodo: 'POST', caminho: (id) => `/v1/anos-letivos/${id}/encerrar`, parametro: parametroDeId() },
  { nome: 'POST /v1/disciplinas', papel: 'coordenador', metodo: 'POST', caminho: () => '/v1/disciplinas', corpo: { nome: 'Disciplina da borda' }, corpoInvalido: { nome: '' } },
  { nome: 'GET /v1/disciplinas', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/disciplinas', ...consultaPaginada },
  { nome: 'PATCH /v1/disciplinas/:id', papel: 'coordenador', metodo: 'PATCH', caminho: (id) => `/v1/disciplinas/${id}`, parametro: parametroDeId(), corpo: { nome: 'Outro nome' }, corpoInvalido: { nome: '' } },
  { nome: 'DELETE /v1/disciplinas/:id', papel: 'coordenador', metodo: 'DELETE', caminho: (id) => `/v1/disciplinas/${id}`, parametro: parametroDeId() },
  { nome: 'PUT /v1/escola/sessao', papel: 'coordenador', metodo: 'PUT', caminho: () => '/v1/escola/sessao', corpo: { inatividadeAlunoMin: 30, inatividadeEquipeMin: 120 }, corpoInvalido: { inatividadeAlunoMin: 4, inatividadeEquipeMin: 120 } },
  { nome: 'PUT /v1/escola/provedores', papel: 'coordenador', metodo: 'PUT', caminho: () => '/v1/escola/provedores', corpo: { provedores: [] }, corpoInvalido: { provedores: [], escolaId: idSorteado() } },
  { nome: 'POST /v1/series', papel: 'coordenador', metodo: 'POST', caminho: () => '/v1/series', corpo: { etapa: 'em', ano: 3 }, corpoInvalido: { etapa: 'ef_anos_finais', ano: 5 } },
  { nome: 'GET /v1/series', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/series', ...consultaPaginada },
  { nome: 'POST /v1/turmas', papel: 'coordenador', metodo: 'POST', caminho: () => '/v1/turmas', corpo: { serieId: idSorteado(), nome: '7ºZ' }, corpoInvalido: { serieId: 'nao-e-uuid', nome: '7ºZ' } },
  { nome: 'GET /v1/turmas', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/turmas', ...consultaPaginada },
  { nome: 'GET /v1/turmas/:id', papel: 'coordenador', metodo: 'GET', caminho: (id) => `/v1/turmas/${id}`, parametro: parametroDeId(), consulta: '', consultaInvalida: `?escolaId=${idSorteado()}` },
  { nome: 'PATCH /v1/turmas/:id', papel: 'coordenador', metodo: 'PATCH', caminho: (id) => `/v1/turmas/${id}`, parametro: parametroDeId(), corpo: { nome: '7ºY' }, corpoInvalido: { nome: '' } },
  { nome: 'DELETE /v1/turmas/:id', papel: 'coordenador', metodo: 'DELETE', caminho: (id) => `/v1/turmas/${id}`, parametro: parametroDeId() },
  {
    nome: 'GET /v1/turmas/:id/alunos',
    papel: 'coordenador',
    metodo: 'GET',
    caminho: (id) => `/v1/turmas/${id}/alunos`,
    parametro: parametroDeId(),
    consulta: '?finalidade=conferencia_de_cadastro',
    // Com a finalidade, que a coordenação é obrigada a mandar: sem ela o service já responde ENTRADA_INVALIDA, com ou sem o pipe.
    consultaInvalida: '?finalidade=conferencia_de_cadastro&limite=101',
  },
  {
    nome: 'POST /v1/turmas/:id/lista/previa',
    papel: 'coordenador',
    metodo: 'POST',
    caminho: (id) => `/v1/turmas/${id}/lista/previa`,
    parametro: parametroDeId(),
    corpo: { texto: 'Ana Souza;123' },
    corpoInvalido: { texto: 'Ana Souza;123', escolaId: idSorteado() },
  },
  { nome: 'POST /v1/turmas/:id/lista', papel: 'coordenador', metodo: 'POST', caminho: (id) => `/v1/turmas/${id}/lista`, parametro: parametroDeId(), corpo: { texto: 'Ana Souza;123' }, corpoInvalido: { texto: 7 } },
  {
    nome: 'POST /v1/turmas/:id/lista/nome',
    papel: 'coordenador',
    metodo: 'POST',
    caminho: (id) => `/v1/turmas/${id}/lista/nome`,
    parametro: parametroDeId(),
    corpo: { nome: 'Ana Souza', matricula: '123' },
    corpoInvalido: { nome: 'Ana Souza' },
  },
  {
    nome: 'GET /v1/turmas/:id/lista',
    papel: 'coordenador',
    metodo: 'GET',
    caminho: (id) => `/v1/turmas/${id}/lista`,
    parametro: parametroDeId(),
    consulta: '?finalidade=conferencia_de_cadastro',
    consultaInvalida: '?finalidade=curiosidade',
  },
  { nome: 'DELETE /v1/lista-nomes/:id', papel: 'coordenador', metodo: 'DELETE', caminho: (id) => `/v1/lista-nomes/${id}`, parametro: parametroDeId() },
  {
    nome: 'POST /v1/vinculos',
    papel: 'coordenador',
    metodo: 'POST',
    caminho: () => '/v1/vinculos',
    corpo: { usuarioId: idSorteado(), turmaId: idSorteado(), papel: 'professor' },
    corpoInvalido: { usuarioId: idSorteado(), turmaId: idSorteado(), papel: 'aluno' },
  },
  { nome: 'GET /v1/vinculos', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/vinculos', consulta: '?estado=pendente', consultaInvalida: '?estado=talvez' },
  {
    nome: 'POST /v1/vinculos/:id/encerrar',
    papel: 'coordenador',
    metodo: 'POST',
    caminho: (id) => `/v1/vinculos/${id}/encerrar`,
    parametro: parametroDeId(),
    corpo: { motivo: 'desligamento' },
    corpoInvalido: { motivo: 'fim_do_ano' },
  },
  { nome: 'POST /v1/vinculos/:id/confirmar', papel: 'professor', metodo: 'POST', caminho: (id) => `/v1/vinculos/${id}/confirmar`, parametro: parametroDeId() },
  {
    nome: 'POST /v1/vinculos/:id/contestar',
    papel: 'professor',
    metodo: 'POST',
    caminho: (id) => `/v1/vinculos/${id}/contestar`,
    parametro: parametroDeId(),
    corpo: { contestacao: 'nao_leciono' },
    corpoInvalido: { contestacao: 'porque sim' },
  },
  { nome: 'GET /v1/meus-vinculos', papel: 'professor', metodo: 'GET', caminho: () => '/v1/meus-vinculos', ...consultaPaginada },
  {
    nome: 'POST /v1/turmas/:id/acesso',
    papel: 'professor',
    metodo: 'POST',
    caminho: (id) => `/v1/turmas/${id}/acesso`,
    parametro: parametroDeId(),
    corpo: { validadeDias: 7 },
    corpoInvalido: { validadeDias: 3 },
  },
  { nome: 'GET /v1/turmas/:id/acesso', papel: 'professor', metodo: 'GET', caminho: (id) => `/v1/turmas/${id}/acesso`, parametro: parametroDeId() },
  {
    nome: 'POST /v1/turmas/:id/acesso/revogar',
    papel: 'professor',
    metodo: 'POST',
    caminho: (id) => `/v1/turmas/${id}/acesso/revogar`,
    parametro: parametroDeId(),
    corpo: {},
    corpoInvalido: { turmaId: idSorteado() },
    semCorpo: 'aceito',
  },
  {
    nome: 'GET /v1/turmas/:id/reivindicacoes',
    papel: 'coordenador',
    metodo: 'GET',
    caminho: (id) => `/v1/turmas/${id}/reivindicacoes`,
    parametro: parametroDeId(),
    consulta: '?finalidade=conferencia_de_cadastro',
    // Com a finalidade, que a coordenação é obrigada a mandar: sem ela o service já responde ENTRADA_INVALIDA, com ou sem o pipe.
    consultaInvalida: '?finalidade=conferencia_de_cadastro&limite=101',
  },
  { nome: 'POST /v1/reivindicacoes/decidir', papel: 'professor', metodo: 'POST', caminho: () => '/v1/reivindicacoes/decidir', corpo: { ids: [idSorteado()], decisao: 'recusar' }, corpoInvalido: { ids: [], decisao: 'recusar' } },
  {
    nome: 'POST /v1/salas/abrir',
    papel: 'anonimo',
    metodo: 'POST',
    caminho: () => '/v1/salas/abrir',
    corpo: { slug: 'escola-que-nao-existe', codigo: 'ABCD-EFGH' },
    corpoInvalido: { slug: 'escola-que-nao-existe', codigo: 'ABCD-EFGH', turmaId: idSorteado() },
  },
  {
    nome: 'POST /v1/salas/reivindicar',
    papel: 'anonimo',
    metodo: 'POST',
    caminho: () => '/v1/salas/reivindicar',
    corpo: { slug: 'escola-que-nao-existe', codigo: 'ABCD-EFGH', listaNomeId: idSorteado(), matricula: '123', senha: 'senha-de-doze-letras', chaveEnvio: idSorteado() },
    corpoInvalido: { slug: 'escola-que-nao-existe', codigo: 'ABCD-EFGH', listaNomeId: 'nao-e-uuid', matricula: '123', senha: 'senha-de-doze-letras', chaveEnvio: idSorteado() },
  },
  { nome: 'GET /v1/governanca/resumo', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/governanca/resumo', ...consultaPaginada },
  { nome: 'GET /v1/governanca/consumo', papel: 'coordenador', metodo: 'GET', caminho: () => '/v1/governanca/consumo', consulta: '?mes=2026-10', consultaInvalida: '?mes=2026-13' },
  {
    nome: 'POST /v1/governanca/funcoes/:chave/suspender',
    papel: 'coordenador',
    metodo: 'POST',
    caminho: (chave) => `/v1/governanca/funcoes/${chave}/suspender`,
    parametro: { foraDoFormato: FUNCAO_FORA_DO_CATALOGO, valido: 'adaptacao', noServico: false },
    corpo: { motivo: 'incidente' },
    corpoInvalido: { motivo: 'a professora Helena errou' },
  },
  {
    nome: 'POST /v1/governanca/funcoes/:chave/retomar',
    papel: 'coordenador',
    metodo: 'POST',
    caminho: (chave) => `/v1/governanca/funcoes/${chave}/retomar`,
    // O `chave` fora do catálogo sozinho não prova o pipe: sem ele o service já responde 404 a uma função desconhecida, e a
    // mutação ficaria verde. O byte nulo prova: o Postgres o recusa (22021, 500) se chegar à consulta, e só o pipe o faz
    // responder o 404 do inexistente. A prova depende desse detalhe do banco.
    parametro: { foraDoFormato: `${FUNCAO_FORA_DO_CATALOGO}%00`, valido: 'adaptacao', noServico: true },
    corpo: {},
    corpoInvalido: { escolaId: idSorteado() },
    semCorpo: 'recusado',
  },
  { nome: 'POST /v1/analista/gerar', papel: 'coordenador', metodo: 'POST', caminho: () => '/v1/analista/gerar', corpo: { chaveEnvio: idSorteado() }, corpoInvalido: { chaveEnvio: 'nao-e-uuid' } },
  {
    nome: 'GET /v1/analista/nominal',
    papel: 'coordenador',
    metodo: 'GET',
    caminho: () => '/v1/analista/nominal',
    consulta: `?turmaId=${idSorteado()}&finalidade=acompanhamento_pedagogico`,
    consultaInvalida: `?turmaId=${idSorteado()}`,
  },
]

describe('a borda de entrada de estrutura, sala e governança: cada rota responde igual antes e depois do ZodValidationPipe e do IdPipe', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi
  let escola: string
  const sessoes = new Map<PapelDeUsuario, TestSessao>()

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    escola = await bancada.escola()
    for (const papel of ['coordenador', 'professor', 'aluno'] as const) sessoes.set(papel, await bancada.sessao(escola, papel))
    // Com o ano em curso: sem ele a rota da turma responde o 404 de `requireAnoEmCurso()` antes de olhar o id, e o caso passaria
    // com o pipe ou sem ele.
    const coordenacao = sessoes.get('coordenador')
    const ano = await chamar(api.url, 'POST', '/v1/anos-letivos', coordenacao?.token, { ano: 2026, inicio: '2026-02-01', fim: '2026-12-15' })
    expect(ano.status).toBe(201)
    expect((await chamar(api.url, 'POST', `/v1/anos-letivos/${String(ano.corpo['id'])}/abrir`, coordenacao?.token)).status).toBe(200)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const sessaoDe = (papel: PapelDeUsuario | 'anonimo'): TestSessao | undefined => (papel === 'anonimo' ? undefined : sessoes.get(papel))
  const pedir = (rota: Rota, papel: PapelDeUsuario | 'anonimo', parametro: string, corpo?: unknown, consulta = '') =>
    chamar(api.url, rota.metodo, `${rota.caminho(parametro)}${consulta}`, sessaoDe(papel)?.token, corpo)
  /** O que a escola tem, para provar que nenhuma rota escreveu nada nela. */
  const retrato = async (): Promise<string> => {
    const tabelas = ['ano_letivo', 'serie', 'disciplina', 'turma', 'lista_nome', 'vinculo', 'acesso_turma', 'reivindicacao', 'suspensao_de_funcao', 'auditoria']
    const contagens = await Promise.all(tabelas.map(async (tabela) => (await bancada.pool.query<{ n: string }>(`select count(*) as n from ${tabela} where escola_id = $1`, [escola])).rows[0]?.n))
    return JSON.stringify(contagens)
  }

  it.each(ROTAS.map((rota) => [rota.nome, rota] as const))('a borda de %s: o id fora do formato é o 404 do inexistente, o corpo e a consulta fora do esquema são ENTRADA_INVALIDA, e nada é gravado', async (_nome, rota) => {
    const antes = await retrato()
    const { papel, parametro } = rota
    const corpo = rota.corpo
    const consulta = rota.consulta ?? ''
    if (parametro !== undefined) {
      const foraDoFormato = semRequisicao(await pedir(rota, papel, parametro.foraDoFormato, corpo, consulta))
      expect(foraDoFormato).toEqual(NAO_ENCONTRADO)
      // O formato que o pipe aceita chega ao service, e o inexistente de lá responde o mesmo, ao pé da letra.
      if (parametro.noServico) expect(semRequisicao(await pedir(rota, papel, parametro.valido, corpo, consulta))).toEqual(foraDoFormato)
    }
    const valido = parametro?.valido
    if (rota.corpoInvalido !== undefined) expect(semRequisicao(await pedir(rota, papel, valido ?? '', rota.corpoInvalido, consulta))).toEqual(ENTRADA_INVALIDA)
    if (rota.consultaInvalida !== undefined) expect(semRequisicao(await pedir(rota, papel, valido ?? '', corpo, rota.consultaInvalida))).toEqual(ENTRADA_INVALIDA)
    expect(await retrato()).toBe(antes)
  })

  it.each(ROTAS.filter((rota) => rota.parametro !== undefined && (rota.corpoInvalido !== undefined || rota.consultaInvalida !== undefined)).map((rota) => [rota.nome, rota] as const))(
    'com o id e o corpo ou a consulta inválidos ao mesmo tempo, %s responde o erro do corpo ou da consulta, o último parâmetro, que o Nest resolve primeiro',
    async (_nome, rota) => {
      const { papel, parametro } = rota
      if (parametro === undefined) throw new Error('rota sem parâmetro')
      const corpo = rota.corpoInvalido ?? rota.corpo
      const consulta = rota.consultaInvalida ?? rota.consulta ?? ''
      // Antes era o erro do id (404), que o controller lia primeiro. Não revela existência: com a entrada inválida,
      // qualquer id, fora do formato, inexistente ou de outra escola, dá o mesmo 400 (onda-1a.md T1).
      for (const id of [parametro.foraDoFormato, parametro.valido]) expect(semRequisicao(await pedir(rota, papel, id, corpo, consulta)), id).toEqual(ENTRADA_INVALIDA)
    },
  )

  it.each(ROTAS.filter((rota) => rota.semCorpo !== undefined).map((rota) => [rota.nome, rota] as const))('sem corpo nenhum, %s responde como já respondia', async (_nome, rota) => {
    const resposta = semRequisicao(await pedir(rota, rota.papel, rota.parametro?.valido ?? '', undefined, rota.consulta ?? ''))
    expect(resposta).toEqual(rota.semCorpo === 'aceito' ? NAO_ENCONTRADO : ENTRADA_INVALIDA)
  })

  it.each(ROTAS.filter((rota) => rota.papel !== 'anonimo').map((rota) => [rota.nome, rota] as const))('a guarda responde antes do pipe: sem sessão, 401; o aluno, o 404 da guarda, mesmo com o id e o corpo fora do esquema (%s)', async (_nome, rota) => {
    const { parametro } = rota
    const invalido = rota.corpoInvalido ?? rota.corpo
    const consulta = rota.consultaInvalida ?? rota.consulta ?? ''
    expect(semRequisicao(await pedir(rota, 'anonimo', parametro?.foraDoFormato ?? '', invalido, consulta))).toEqual(NAO_AUTENTICADO)
    expect(semRequisicao(await pedir(rota, 'aluno', parametro?.foraDoFormato ?? '', invalido, consulta))).toEqual(NAO_ENCONTRADO)
  })
})
