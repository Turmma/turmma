import {
  ErrorCode,
  acessoGeradoResponseSchema,
  salaAbertaResponseSchema,
  MAXIMO_DE_NOMES_NA_SALA,
  MENSAGENS_DE_ERRO,
  TAMANHO_MAXIMO_CODIGO_DIGITADO,
  TAMANHO_MAXIMO_SLUG_NO_LOGIN,
  TAMANHO_MAXIMO_TOKEN_DE_CONVITE,
  type SalaAbertaResponse,
} from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { ListaLivreRepository } from '../src/sala/reivindicacao/lista-livre.repository.js'
import { sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import { chamar, subirApi, type ApiDeTeste } from './test-api.js'
import { MONTAGEM_DE_TESTE } from './test-config.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { ipSorteado } from './operador-mfa.fixture.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

/**
 * A página pública da sala (A1, tarefa 5.0; `tasks/prd-apresentacao-escola/cenarios.md`): `POST /v1/salas/abrir`, sem
 * login, pelo slug e pelo token do link ou pelo código. Cobre I4, R1, E17, E26, E28, V2, P5, L10, A6 e A7 (a parte de
 * `salas/abrir`). O A3 e o A4 da rota moram na varredura de `escola-montada.int.test.ts`; o I1, em `architecture.test.ts`;
 * o I2, no teste de unidade da lista fechada de `@Unscoped` do `sessao`. Postgres e Redis reais do compose de teste.
 *
 * Cada pedido sai de um IP sorteado (`X-Forwarded-For`, com a API confiando no 127.0.0.1): o `rl:ip` anônimo fica no
 * Redis entre os testes, e o do IP do runner é dividido com as outras suítes.
 */

const LIMITE_POR_IP = 5
const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }

/** A resposta crua: o texto do corpo, para comparar byte a byte, e os cabeçalhos que a regra olha. */
interface RespostaCrua {
  readonly status: number
  readonly texto: string
  readonly cacheControl: string | null
  readonly retryAfter: string | null
  readonly setCookie: string[]
}

/** O texto do corpo sem o valor do `requisicaoId`, que muda a cada chamada: o resto tem de ser idêntico, byte a byte. */
const semRequisicao = (resposta: RespostaCrua) => ({ status: resposta.status, texto: resposta.texto.replace(/"requisicaoId":"[^"]*"/, '"requisicaoId":"-"') })

const NAO_ENCONTRADO = {
  status: 404,
  texto: JSON.stringify({ erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO, requisicaoId: '-' } }),
}

/** Uma escola com o professor confirmado nas duas turmas, a lista da `turma` e o acesso vigente dela. */
interface Sala extends EscolaComTurma {
  readonly escolaId: string
  readonly slug: string
  readonly professor: SessaoDeTeste
  readonly vinculos: readonly string[]
  readonly token: string
  readonly codigo: string
}

describe('salas/abrir (A1, tarefa 5.0): o aluno abre a turma pelo link ou pelo código', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  /** Com o sorteio do código na mão do teste: o mesmo código vigente em duas escolas (I4). */
  let apiDoSorteio: ApiDeTeste
  const filaDeCodigos: string[] = []
  /** Com o limite anônimo por IP baixo (L10). */
  let apiDoLimite: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    apiDoSorteio = await subirApi(medidor.medidor, { ambiente: AMBIENTE }, undefined, { ...MONTAGEM_DE_TESTE, sortearCodigoDaSala: () => filaDeCodigos.shift() ?? sortearCodigoDaTurma() })
    apiDoLimite = await subirApi(medidor.medidor, { ambiente: { ...AMBIENTE, LIMITE_REQ_IP_ANONIMO_MIN: String(LIMITE_POR_IP) } })
  })

  afterAll(async () => {
    await api.app.close()
    await apiDoSorteio.app.close()
    await apiDoLimite.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** `POST /v1/salas/abrir` sem token, como a página pública, de um IP sorteado (ou do dado). */
  async function abrir(corpo: unknown, { url = api.url, ip = ipSorteado(), cabecalhos = {} }: { url?: string; ip?: string; cabecalhos?: Record<string, string> } = {}): Promise<RespostaCrua> {
    const resposta = await fetch(`${url}/v1/salas/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...cabecalhos },
      body: JSON.stringify(corpo),
    })
    return {
      status: resposta.status,
      texto: await resposta.text(),
      cacheControl: resposta.headers.get('cache-control'),
      retryAfter: resposta.headers.get('retry-after'),
      setCookie: resposta.headers.getSetCookie(),
    }
  }

  const aberta = (resposta: RespostaCrua): SalaAbertaResponse => {
    expect(resposta.status, resposta.texto).toBe(200)
    return salaAbertaResponseSchema.parse(JSON.parse(resposta.texto))
  }

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, sessao.token, corpo)

  async function gerar(sala: Pick<Sala, 'professor'>, turmaId: string, url = api.url): Promise<{ token: string; codigo: string }> {
    const gerado = await chamar(url, 'POST', `/v1/turmas/${turmaId}/acesso`, sala.professor.token, { validadeDias: 7 })
    expect(gerado.status).toBe(201)
    const { token, codigo } = acessoGeradoResponseSchema.parse(gerado.corpo)
    return { token, codigo }
  }

  /** Uma escola da `montarEscolaComTurma`, com o professor confirmado na `turma` e na `outraTurma`, e o acesso da `turma`. */
  async function montar(url = api.url): Promise<Sala> {
    const escola = await montarEscolaComTurma(api, bancada)
    const escolaId = escola.coordenacao.escolaId
    const professor = await bancada.sessao(escolaId, 'professor')
    const vinculos: string[] = []
    for (const turmaId of [escola.turma, escola.outraTurma]) {
      const vinculo = await post(escola.coordenacao, '/v1/vinculos', { usuarioId: professor.usuarioId, turmaId, disciplinaId: escola.quimica, papel: 'professor' })
      expect(vinculo.status).toBe(201)
      const id = vinculo.corpo['id'] as string
      expect((await post(professor, `/v1/vinculos/${id}/confirmar`)).status).toBe(200)
      vinculos.push(id)
    }
    const acesso = await gerar({ professor }, escola.turma, url)
    return { ...escola, escolaId, slug: await bancada.slugDe(escolaId), professor, vinculos, ...acesso }
  }

  /** Grava a lista da turma pela coordenação, uma linha por nome, e devolve o id de cada nome pela matrícula. */
  async function comLista(sala: Sala, turmaId: string, linhas: ReadonlyArray<{ readonly nome: string; readonly matricula: string }>): Promise<Map<string, string>> {
    const gravada = await post(sala.coordenacao, `/v1/turmas/${turmaId}/lista`, { texto: linhas.map((linha) => `${linha.nome};${linha.matricula}`).join('\n') })
    expect(gravada.status).toBe(201)
    const { rows } = await bancada.pool.query<{ id: string; matricula: string }>('select id, matricula from lista_nome where escola_id = $1 and turma_id = $2', [sala.escolaId, turmaId])
    return new Map(rows.map((linha) => [linha.matricula, linha.id]))
  }

  const pelo = {
    token: (sala: Pick<Sala, 'slug' | 'token'>) => ({ slug: sala.slug, token: sala.token }),
    codigo: (sala: Pick<Sala, 'slug' | 'codigo'>) => ({ slug: sala.slug, codigo: sala.codigo }),
  }

  describe('E17 e E26: o nome da turma e só os nomes livres dela, com id e nome, lidos a cada abertura', () => {
    it('E17: pelo link e pelo código, só os livres da turma do acesso, em ordem de nome, sem matrícula; reivindicado, aprovado e os da outra turma não aparecem', async () => {
      const sala = await montar()
      const sufixo = randomUUID().slice(0, 8)
      const matricula = (rotulo: string) => `abrir-${rotulo}-${sufixo}`
      // Gravados fora da ordem de nome: a resposta os ordena.
      const ids = await comLista(sala, sala.turma, [
        { nome: `Zélia ${sufixo}`, matricula: matricula('zelia') },
        { nome: `Carla ${sufixo}`, matricula: matricula('carla') },
        { nome: `Bruno ${sufixo}`, matricula: matricula('bruno') },
        { nome: `Ana ${sufixo}`, matricula: matricula('ana') },
      ])
      const daOutra = await comLista(sala, sala.outraTurma, [{ nome: `Davi ${sufixo}`, matricula: matricula('davi') }])
      // O reivindicado chega na 6.0, e o aprovado na 8.0: aqui, postos no banco.
      await bancada.pool.query(`update lista_nome set estado = 'reivindicado' where id = $1`, [ids.get(matricula('bruno'))])
      const aluno = await bancada.sessao(sala.escolaId, 'aluno')
      await bancada.pool.query(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4)`,
        [sala.escolaId, sala.anoLetivoId, sala.turma, aluno.usuarioId],
      )

      const esperado = {
        turma: { nome: '2ºB' },
        nomes: [
          { id: ids.get(matricula('ana')), nome: `Ana ${sufixo}` },
          { id: ids.get(matricula('carla')), nome: `Carla ${sufixo}` },
          { id: ids.get(matricula('zelia')), nome: `Zélia ${sufixo}` },
        ],
      }
      for (const corpo of [pelo.token(sala), pelo.codigo(sala)]) {
        const resposta = await abrir(corpo)
        expect(JSON.parse(resposta.texto)).toEqual(esperado)
        expect(aberta(resposta)).toEqual(esperado)
        expect(resposta.texto).not.toContain(`abrir-`)
        expect(resposta.texto).not.toContain(sala.escolaId)
        expect(resposta.texto).not.toContain(sala.turma)
      }

      // A outra turma, pelo acesso dela: o nome dela e só o nome dela.
      const daOutraTurma = await gerar(sala, sala.outraTurma)
      expect(aberta(await abrir({ slug: sala.slug, token: daOutraTurma.token }))).toEqual({ turma: { nome: '2ºC' }, nomes: [{ id: daOutra.get(matricula('davi')), nome: `Davi ${sufixo}` }] })
    })

    it('o código vale como o aluno o digita: em minúsculas, com o espaço ou o hífen entre os grupos', async () => {
      const sala = await montar()
      for (const codigo of [sala.codigo.toLowerCase(), `${sala.codigo.slice(0, 4)} ${sala.codigo.slice(4)}`, ` ${sala.codigo.slice(0, 4)}-${sala.codigo.slice(4).toLowerCase()} `]) {
        expect(aberta(await abrir({ slug: sala.slug, codigo })).turma.nome, codigo).toBe('2ºB')
      }
    })

    it('E26: o nome avulso acrescentado depois de gerar aparece no link já vigente, sem gerar outro', async () => {
      const sala = await montar()
      expect(aberta(await abrir(pelo.token(sala))).nomes).toEqual([])
      const nome = `Aluno de maio ${randomUUID().slice(0, 8)}`
      const avulso = await post(sala.coordenacao, `/v1/turmas/${sala.turma}/lista/nome`, { nome, matricula: `maio-${randomUUID().slice(0, 8)}` })
      expect(avulso.status).toBe(201)
      expect(aberta(await abrir(pelo.token(sala))).nomes).toEqual([{ id: avulso.corpo['id'], nome }])
      expect(aberta(await abrir(pelo.codigo(sala))).nomes).toEqual([{ id: avulso.corpo['id'], nome }])
    })

    it('dois alunos com o mesmo nome aparecem os dois, cada um com o seu id; o nome retirado some do link já vigente', async () => {
      const sala = await montar()
      const sufixo = randomUUID().slice(0, 8)
      const nome = `Ana Souza ${sufixo}`
      const ids = await comLista(sala, sala.turma, [
        { nome, matricula: `igual-1-${sufixo}` },
        { nome, matricula: `igual-2-${sufixo}` },
      ])
      const [primeiro, segundo] = [ids.get(`igual-1-${sufixo}`), ids.get(`igual-2-${sufixo}`)]
      const antes = aberta(await abrir(pelo.token(sala))).nomes
      expect(antes).toHaveLength(2)
      expect(new Set(antes.map((linha) => linha.id))).toEqual(new Set([primeiro, segundo]))
      for (const linha of antes) expect(linha.nome).toBe(nome)

      // Aluno transferido: a coordenação retira o nome livre, e ele some do mesmo link, sem gerar outro.
      expect((await chamar(api.url, 'DELETE', `/v1/lista-nomes/${String(primeiro)}`, sala.coordenacao.token)).status).toBe(204)
      expect(aberta(await abrir(pelo.token(sala))).nomes).toEqual([{ id: segundo, nome }])
    })

    it(`a lista mostra até ${String(MAXIMO_DE_NOMES_NA_SALA)} nomes livres, os primeiros em ordem de nome`, async () => {
      const sala = await montar()
      const sufixo = randomUUID().slice(0, 8)
      // Gravados do maior para o menor: o corte fica com os primeiros pela ordem de nome, não pela de gravação.
      await bancada.pool.query(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula)
         select $1, $2, $3, 'Nome ' || lpad(n::text, 4, '0'), 'teto-' || $4 || '-' || n from generate_series($5::int, 1, -1) as n`,
        [sala.escolaId, sala.anoLetivoId, sala.turma, sufixo, MAXIMO_DE_NOMES_NA_SALA + 1],
      )
      const { nomes } = aberta(await abrir(pelo.codigo(sala)))
      expect(nomes).toHaveLength(MAXIMO_DE_NOMES_NA_SALA)
      expect(nomes[0]?.nome).toBe('Nome 0001')
      expect(nomes.at(-1)?.nome).toBe(`Nome ${String(MAXIMO_DE_NOMES_NA_SALA).padStart(4, '0')}`)
    })
  })

  describe('I4, R1, E28 e V2: tudo que não é um acesso vigente da escola do slug no ano em curso responde o mesmo NAO_ENCONTRADO', () => {
    it('I4: o código e o token vigentes de B com o slug de A não abrem nada, e com o slug de B abrem a turma de B', async () => {
      const [a, b] = [await montar(), await montar()]
      await comLista(b, b.turma, [{ nome: `Só de B ${randomUUID().slice(0, 8)}`, matricula: `b-${randomUUID().slice(0, 8)}` }])
      for (const corpo of [{ slug: a.slug, token: b.token }, { slug: a.slug, codigo: b.codigo }]) {
        expect(semRequisicao(await abrir(corpo)), JSON.stringify(Object.keys(corpo))).toEqual(NAO_ENCONTRADO)
      }
      expect(aberta(await abrir(pelo.token(b))).nomes).toHaveLength(1)
      expect(aberta(await abrir(pelo.codigo(b))).nomes).toHaveLength(1)
    })

    it('I4: o mesmo código vigente em A e em B (o HMAC é o mesmo) abre, com cada slug, a turma da escola do slug', async () => {
      const codigo = sortearCodigoDaTurma()
      filaDeCodigos.push(codigo, codigo)
      const [a, b] = [await montar(apiDoSorteio.url), await montar(apiDoSorteio.url)]
      expect([a.codigo, b.codigo]).toEqual([codigo, codigo])
      const sufixo = randomUUID().slice(0, 8)
      const deA = await comLista(a, a.turma, [{ nome: `De A ${sufixo}`, matricula: `a-${sufixo}` }])
      const deB = await comLista(b, b.turma, [{ nome: `De B ${sufixo}`, matricula: `b-${sufixo}` }])
      // Várias vezes: sem a escola do slug na busca, a linha achada seria a primeira do índice, de A ou de B.
      for (let vez = 0; vez < 3; vez++) {
        expect(aberta(await abrir({ slug: a.slug, codigo })).nomes).toEqual([{ id: deA.get(`a-${sufixo}`), nome: `De A ${sufixo}` }])
        expect(aberta(await abrir({ slug: b.slug, codigo })).nomes).toEqual([{ id: deB.get(`b-${sufixo}`), nome: `De B ${sufixo}` }])
      }
    })

    it('R1: pelo link e pelo código, o inexistente, o vencido, o revogado, o de ano encerrado, o de turma excluída, o de outra escola e o slug inexistente dão o mesmo corpo, byte a byte', async () => {
      const [a, b, vencido, revogado, encerrado, excluida] = [await montar(), await montar(), await montar(), await montar(), await montar(), await montar()]
      // Cada um abre antes de virar o caso: o NAO_ENCONTRADO de depois é o da regra, e não de um acesso que nunca abriu.
      for (const sala of [vencido, revogado, encerrado, excluida]) {
        expect((await abrir(pelo.token(sala))).status).toBe(200)
        expect((await abrir(pelo.codigo(sala))).status).toBe(200)
      }

      // E28: o relógio além do `expira_em`.
      await bancada.pool.query(`update acesso_turma set expira_em = now() - interval '1 second' where escola_id = $1`, [vencido.escolaId])
      expect((await post(revogado.professor, `/v1/turmas/${revogado.turma}/acesso/revogar`, {})).status).toBe(204)
      // V2: o ano posto em encerrado no banco, sem revogar o acesso, com outro ano em curso na mesma escola: nem a
      // situação do ano do acesso nem o ano em curso de outro ano abrem a sala.
      await bancada.pool.query(`update ano_letivo set situacao = 'encerrado' where id = $1`, [encerrado.anoLetivoId])
      await bancada.pool.query(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'em_curso')`, [encerrado.escolaId])
      // Turma excluída: revogado, sem os vínculos (a FK deles barraria o excluir), e a cascata leva o acesso.
      expect((await post(excluida.professor, `/v1/turmas/${excluida.turma}/acesso/revogar`, {})).status).toBe(204)
      await bancada.pool.query('delete from vinculo where id = any($1::uuid[])', [excluida.vinculos])
      expect((await chamar(api.url, 'DELETE', `/v1/turmas/${excluida.turma}`, excluida.coordenacao.token)).status).toBe(204)
      const { rows } = await bancada.pool.query<{ n: number }>('select count(*)::int as n from acesso_turma where escola_id = $1', [excluida.escolaId])
      expect(rows[0]?.n).toBe(0)

      const slugInexistente = `nao-existe-${randomUUID().slice(0, 8)}`
      const casos: ReadonlyArray<readonly [string, Record<string, string>]> = [
        ['token inexistente', { slug: a.slug, token: randomBytes(32).toString('base64url') }],
        ['token fora do formato', { slug: a.slug, token: 'nao-e-um-token' }],
        ['token vencido', pelo.token(vencido)],
        ['token revogado', pelo.token(revogado)],
        ['token de ano encerrado', pelo.token(encerrado)],
        ['token de turma excluída', pelo.token(excluida)],
        ['token de outra escola', { slug: a.slug, token: b.token }],
        ['token com slug inexistente', { slug: slugInexistente, token: a.token }],
        ['código inexistente', { slug: a.slug, codigo: sortearCodigoDaTurma() }],
        ['código fora do alfabeto', { slug: a.slug, codigo: 'OOOO-1111' }],
        ['código vencido', pelo.codigo(vencido)],
        ['código revogado', pelo.codigo(revogado)],
        ['código de ano encerrado', pelo.codigo(encerrado)],
        ['código de turma excluída', pelo.codigo(excluida)],
        ['código de outra escola', { slug: a.slug, codigo: b.codigo }],
        ['código com slug inexistente', { slug: slugInexistente, codigo: a.codigo }],
        ['slug fora do formato', { slug: 'Não É Slug', codigo: a.codigo }],
      ]
      for (const [caso, corpo] of casos) expect(semRequisicao(await abrir(corpo)), caso).toEqual(NAO_ENCONTRADO)

      // O acesso vigente de A, com o slug de A, continua abrindo: o 404 acima é o do caso, e não da escola.
      expect((await abrir(pelo.token(a))).status).toBe(200)
      expect((await abrir(pelo.codigo(a))).status).toBe(200)
    })

    it('a turma que some entre achar o acesso e ler o nome dela responde o mesmo NAO_ENCONTRADO', async () => {
      const sala = await montar()
      // Simulação: a exclusão entre as duas leituras não se reproduz sem pausar o banco no meio do pedido, e o que o teste
      // prova é a resposta do ramo, igual à do acesso inexistente.
      const leitura = vi.spyOn(ListaLivreRepository.prototype, 'nomeDaTurma').mockResolvedValue(undefined)
      try {
        expect(semRequisicao(await abrir(pelo.token(sala)))).toEqual(NAO_ENCONTRADO)
        expect(leitura).toHaveBeenCalledWith(sala.turma)
      } finally {
        leitura.mockRestore()
      }
      expect((await abrir(pelo.token(sala))).status).toBe(200)
    })
  })

  describe('P5: o contrato é estrito, e escola e turma nunca vêm do corpo', () => {
    it('escolaId, turmaId, campo a mais, token e código juntos, nenhum dos dois, slug, token ou código longos: 400 ENTRADA_INVALIDA, sem gravar', async () => {
      const [a, b] = [await montar(), await montar()]
      const estado = async () =>
        (
          await bancada.pool.query(
            `select (select count(*) from auditoria where escola_id = $1)::int as auditoria,
                    (select count(*) from registro_acesso where escola_id = $1)::int as registros,
                    (select count(*) from lista_nome where escola_id = $1)::int as lista,
                    (select count(*) from acesso_turma where escola_id = $1 and revogado_em is null)::int as acessos`,
            [a.escolaId],
          )
        ).rows[0]
      const antes = await estado()
      const invalidos: ReadonlyArray<readonly [string, unknown]> = [
        ['escolaId de B', { ...pelo.token(a), escolaId: b.escolaId }],
        ['turmaId de B', { ...pelo.codigo(a), turmaId: b.turma }],
        ['campo a mais', { ...pelo.token(a), validadeDias: 7 }],
        ['token e código', { slug: a.slug, token: a.token, codigo: a.codigo }],
        ['sem token nem código', { slug: a.slug }],
        ['sem slug', { token: a.token }],
        ['slug longo', { slug: 'a'.repeat(TAMANHO_MAXIMO_SLUG_NO_LOGIN + 1), token: a.token }],
        ['token longo', { slug: a.slug, token: 'a'.repeat(TAMANHO_MAXIMO_TOKEN_DE_CONVITE + 1) }],
        ['token vazio', { slug: a.slug, token: '' }],
        ['código longo', { slug: a.slug, codigo: 'A'.repeat(TAMANHO_MAXIMO_CODIGO_DIGITADO + 1) }],
        ['corpo vazio', {}],
      ]
      const ENTRADA_INVALIDA = {
        status: 400,
        texto: JSON.stringify({ erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA, requisicaoId: '-' } }),
      }
      for (const [caso, corpo] of invalidos) expect(semRequisicao(await abrir(corpo)), caso).toEqual(ENTRADA_INVALIDA)
      expect(await estado()).toEqual(antes)
      // O mesmo acesso, sem o campo a mais, abre.
      expect((await abrir(pelo.token(a))).status).toBe(200)
    })
  })

  describe('L10, A6 e A7: rota anônima, contada no rl:ip, sem registro de acesso e sem cache', () => {
    it('L10: acima do limite anônimo do IP, 429 LIMITE_EXCEDIDO com Retry-After; outro IP segue', async () => {
      const sala = await montar()
      const [ip, outro] = [ipSorteado(), ipSorteado()]
      for (let vez = 0; vez < LIMITE_POR_IP; vez++) expect((await abrir(pelo.codigo(sala), { url: apiDoLimite.url, ip })).status).toBe(200)
      const recusada = await abrir(pelo.codigo(sala), { url: apiDoLimite.url, ip })
      expect(recusada.status).toBe(429)
      expect(JSON.parse(recusada.texto)).toEqual({ erro: { codigo: ErrorCode.LIMITE_EXCEDIDO, mensagem: MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO, requisicaoId: expect.any(String) } })
      expect(Number(recusada.retryAfter)).toBeGreaterThanOrEqual(1)
      expect((await abrir(pelo.codigo(sala), { url: apiDoLimite.url, ip: outro })).status).toBe(200)
    })

    it('A6: nem a abertura nem a recusa gravam registro de acesso, e a sessão e o cookie de quem chama não mudam a escola', async () => {
      const [a, b] = [await montar(), await montar()]
      const ip = ipSorteado()
      const registros = async () =>
        (await bancada.pool.query<{ n: number }>('select count(*)::int as n from registro_acesso where ip = $1::inet or escola_id = any($2::uuid[])', [ip, [a.escolaId, b.escolaId]])).rows[0]?.n
      const antes = await registros()
      // Com o token e um cookie de sessão da coordenação de B: a rota é anônima, e a escola é a do slug.
      const deB = { Authorization: `Bearer ${b.coordenacao.token}`, Cookie: `educa_sessao=${randomBytes(32).toString('base64url')}` }
      const resposta = await abrir(pelo.token(a), { ip, cabecalhos: deB })
      expect(aberta(resposta).turma.nome).toBe('2ºB')
      expect(resposta.setCookie).toEqual([])
      expect(semRequisicao(await abrir({ slug: b.slug, token: a.token }, { ip, cabecalhos: deB }))).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await abrir({ slug: a.slug, codigo: sortearCodigoDaTurma() }, { ip }))).toEqual(NAO_ENCONTRADO)
      expect(await registros()).toBe(antes)
    })

    it('A7: a abertura e a recusa respondem Cache-Control: no-store', async () => {
      const sala = await montar()
      expect((await abrir(pelo.token(sala))).cacheControl).toBe('no-store')
      expect((await abrir(pelo.codigo(sala))).cacheControl).toBe('no-store')
      expect((await abrir({ slug: sala.slug, codigo: sortearCodigoDaTurma() })).cacheControl).toBe('no-store')
      expect((await abrir({ slug: sala.slug })).cacheControl).toBe('no-store')
    })
  })
})
