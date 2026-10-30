import { createDatabase, postgresErrorIn, runInContext, type DatabasePool } from '@educa/nucleo'
import { ErrorCode, acessoGeradoResponseSchema, salaAbertaResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { POOL_BANCO } from '../src/banco.module.js'
import { sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import { ListaLivreRepository } from '../src/sala/reivindicacao/lista-livre.repository.js'
import { ReivindicacaoRepository } from '../src/sala/reivindicacao/reivindicacao.repository.js'
import { ESPERA_MAXIMA_PELO_HASH_MS, HashDeSenha, RETRY_AFTER_MAXIMO_S, RETRY_AFTER_MINIMO_S, SemaforoDeHash } from '../src/credencial/index.js'
import { aguardar, esperarNaTrava, GatilhoDeParada } from './gatilho-de-parada.js'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { FerramentasDaSala } from './sala-de-teste.js'
import { ipSorteado } from './segundo-fator-de-operador.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * A reivindicação do nome pela página pública da sala (A1, tarefa 6.0; `tasks/prd-apresentacao-escola/cenarios.md`):
 * `POST /v1/salas/reivindicar`, sem login. Cobre I5, R2, R5, E21 e C1 (com os contadores da 7.0), E23, E24,
 * C2 (com os contadores), C4, L9, a gravação do E30 (7.0), a parte de `salas/reivindicar` de I4, R1, P5, L10, A6 e A7, o pedido do E2 e a retirada do reivindicado
 * do E7. O R3 com o hash falso é o teste de unidade `apps/api/src/sala/reivindicacao/reivindicacao.service.test.ts`, e aqui o R2 o
 * confere com o hash de verdade; o A3 e o A4 da rota moram na varredura de `escola-montada.int.test.ts`. Postgres e
 * Redis reais do compose de teste.
 *
 * Cada pedido sai de um IP sorteado (`X-Forwarded-For`, com a API confiando no 127.0.0.1): o `rl:ip` anônimo fica no
 * Redis entre os testes.
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }
const LIMITE_POR_IP = 5
/** A senha que o aluno cria, com os 12 caracteres da senha nova: nunca vai a log nem a resposta. */
const SENHA = 'senha-sintetica-da-sala-1'

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

const erro = (codigo: ErrorCode, status: number) => ({ status, texto: JSON.stringify({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: '-' } }) })
const NAO_ENCONTRADO = erro(ErrorCode.NAO_ENCONTRADO, 404)
const RECUSADA = erro(ErrorCode.REIVINDICACAO_RECUSADA, 409)
const ENTRADA_INVALIDA = erro(ErrorCode.ENTRADA_INVALIDA, 400)
const ENVIADO = { status: 200, texto: JSON.stringify({ resultado: 'enviado' }) }

/** Um nome da lista, com a matrícula dele. */
interface Nome {
  readonly id: string
  readonly nome: string
  readonly matricula: string
}

/** Uma escola com o professor confirmado nas duas turmas e o acesso vigente da `turma`. */
interface Sala extends EscolaComTurma {
  readonly escolaId: string
  readonly slug: string
  readonly professor: SessaoDeTeste
  readonly vinculos: readonly string[]
  readonly token: string
  readonly codigo: string
}

describe('salas/reivindicar (A1, tarefa 6.0): o aluno pede o próprio nome, e o pedido fica pendente', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  /** Com o limite anônimo por IP baixo (L10). */
  let apiDoLimite: ApiDeTeste
  /** Com um hash por vez: a saturação do semáforo é determinística, sem depender da CPU (C2 (b), L9). */
  let apiDoSemaforo: ApiDeTeste
  let hashes: MockInstance<HashDeSenha['gerar']>
  let gerarReal: HashDeSenha['gerar']
  let hashesDoSemaforo: MockInstance<HashDeSenha['gerar']>
  let gerarRealDoSemaforo: HashDeSenha['gerar']
  let verificacoesDoSemaforo: MockInstance<HashDeSenha['verificar']>
  let verificarRealDoSemaforo: HashDeSenha['verificar']
  /** A leitura dos contadores da sala no Redis de fila (7.0). */
  let limites: FerramentasDaSala

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE })
    limites = new FerramentasDaSala(api, bancada)
    apiDoLimite = await subirApi(medidor.medidor, { ambiente: { ...AMBIENTE, LIMITE_REQ_IP_ANONIMO_MIN: String(LIMITE_POR_IP) } })
    apiDoSemaforo = await subirApi(medidor.medidor, { ambiente: { ...AMBIENTE, LOGIN_HASH_CONCORRENCIA: '1' } })
    const hash = api.app.get(HashDeSenha)
    gerarReal = hash.gerar.bind(hash)
    hashes = vi.spyOn(hash, 'gerar')
    const doSemaforo = apiDoSemaforo.app.get(HashDeSenha)
    gerarRealDoSemaforo = doSemaforo.gerar.bind(doSemaforo)
    hashesDoSemaforo = vi.spyOn(doSemaforo, 'gerar')
    verificarRealDoSemaforo = doSemaforo.verificar.bind(doSemaforo)
    verificacoesDoSemaforo = vi.spyOn(doSemaforo, 'verificar')
  })

  beforeEach(() => {
    hashes.mockClear()
    hashesDoSemaforo.mockClear()
    verificacoesDoSemaforo.mockClear()
  })

  afterAll(async () => {
    await api.app.close()
    await apiDoLimite.app.close()
    await apiDoSemaforo.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** `POST /v1/salas/reivindicar` sem token, como a página pública, de um IP sorteado (ou do dado). */
  async function reivindicar(corpo: unknown, { url = api.url, ip = ipSorteado(), cabecalhos = {} }: { url?: string; ip?: string; cabecalhos?: Record<string, string> } = {}): Promise<RespostaCrua> {
    const resposta = await fetch(`${url}/v1/salas/reivindicar`, {
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

  const post = (sessao: SessaoDeTeste, caminho: string, corpo?: unknown, url = api.url) => chamar(url, 'POST', caminho, sessao.token, corpo)

  async function gerar(sala: Pick<Sala, 'professor'>, turmaId: string, url = api.url): Promise<{ token: string; codigo: string }> {
    const gerado = await post(sala.professor, `/v1/turmas/${turmaId}/acesso`, { validadeDias: 7 }, url)
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

  /** Grava `quantos` nomes na lista da turma pela coordenação, com nomes e matrículas gerados, e os devolve. */
  async function nomes(sala: Sala, turmaId: string, quantos: number, nome?: string): Promise<Nome[]> {
    const sufixo = randomUUID().slice(0, 8)
    const linhas = Array.from({ length: quantos }, (_, posicao) => ({ nome: nome ?? `Aluno ${String(posicao + 1)} ${sufixo}`, matricula: `sala-${sufixo}-${String(posicao + 1)}` }))
    const gravada = await post(sala.coordenacao, `/v1/turmas/${turmaId}/lista`, { texto: linhas.map((linha) => `${linha.nome};${linha.matricula}`).join('\n') })
    expect(gravada.status).toBe(201)
    const { rows } = await bancada.pool.query<{ id: string; matricula: string }>('select id, matricula from lista_nome where escola_id = $1 and turma_id = $2', [sala.escolaId, turmaId])
    return linhas.map((linha) => {
      const id = rows.find((gravado) => gravado.matricula === linha.matricula)?.id
      if (id === undefined) throw new Error('nome da lista não gravado')
      return { id, ...linha }
    })
  }

  async function umNome(sala: Sala, turmaId = sala.turma): Promise<Nome> {
    const [nome] = await nomes(sala, turmaId, 1)
    if (nome === undefined) throw new Error('nome não gravado')
    return nome
  }

  /** O corpo do pedido pelo código (ou pelo link) da sala, com o nome e a matrícula dele e uma chave nova. */
  function pedido(sala: Pick<Sala, 'slug' | 'codigo' | 'token'>, nome: Pick<Nome, 'id' | 'matricula'>, extra: Record<string, unknown> = {}, caminho: 'codigo' | 'token' = 'codigo') {
    const pelo = caminho === 'codigo' ? { codigo: sala.codigo } : { token: sala.token }
    return { slug: sala.slug, ...pelo, listaNomeId: nome.id, matricula: nome.matricula, senha: SENHA, chaveEnvio: randomUUID(), ...extra }
  }

  /** A lista e os pedidos das escolas, com o hash e a chave: "nada gravado" compara dois retratos. */
  async function retrato(...escolas: readonly string[]): Promise<unknown> {
    const lista = await bancada.pool.query('select id, turma_id, nome, matricula, estado, usuario_id from lista_nome where escola_id = any($1::uuid[]) order by id', [escolas])
    const pedidos = await bancada.pool.query('select * from reivindicacao where escola_id = any($1::uuid[]) order by id', [escolas])
    return { lista: lista.rows, pedidos: pedidos.rows }
  }

  interface Pedido {
    readonly id: string
    readonly ano_letivo_id: string
    readonly turma_id: string
    readonly lista_nome_id: string | null
    readonly chave_envio: string | null
    readonly senha_hash: string | null
    readonly teve_matricula_errada: boolean | null
    readonly estado: string
    readonly solicitada_em: Date
    readonly decidida_em: Date | null
    readonly decidida_por: string | null
    readonly decidida_como: string | null
  }

  async function pedidosDa(escolaId: string): Promise<Pedido[]> {
    return (await bancada.pool.query<Pedido>('select * from reivindicacao where escola_id = $1 order by id', [escolaId])).rows
  }

  async function estadoDoNome(id: string): Promise<string | undefined> {
    return (await bancada.pool.query<{ estado: string }>('select estado from lista_nome where id = $1', [id])).rows[0]?.estado
  }

  /** Os ids dos nomes que a página pública da sala mostra agora. */
  async function livresNaSala(sala: Sala): Promise<string[]> {
    const aberta = await fetch(`${api.url}/v1/salas/abrir`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() }, body: JSON.stringify({ slug: sala.slug, codigo: sala.codigo }) })
    return salaAbertaResponseSchema.parse(await aberta.json()).nomes.map((nome) => nome.id)
  }

  /** Os contadores da turma e do nome (pelo acesso vigente da turma) e o da escola, no Redis de fila (7.0). */
  async function contadores(sala: Sala, nome: Pick<Nome, 'id'>, turmaId = sala.turma) {
    return limites.contadores(sala, turmaId, { acessoId: await limites.acessoVigente(turmaId), listaNomeId: nome.id })
  }

  /** Quantos pedidos saíram com o 503 do semáforo em `sala.reivindicacao`, somadas as APIs do arquivo (7.0). */
  async function indisponiveis(): Promise<number> {
    return (await medidor.pontos('sala.reivindicacao')).filter(({ atributos }) => atributos['resultado'] === 'indisponivel').reduce((soma, { valor }) => soma + (valor as number), 0)
  }

  /** Um portão para o próximo hash de `gerar`: ele só termina quando o teste soltar. */
  function segurarOProximoHash(espiao: MockInstance<HashDeSenha['gerar']>, real: HashDeSenha['gerar']): { soltar: () => void } {
    let soltar: () => void = () => undefined
    const portao = new Promise<void>((resolver) => (soltar = resolver))
    espiao.mockImplementationOnce(async (senha) => {
      await portao
      return real(senha)
    })
    return { soltar }
  }

  describe('o pedido pendente', () => {
    it('pelo código e pelo link: enviado; o pedido pendente guarda o hash argon2id da senha, a chave e teve_matricula_errada em false (sem erro no nome), e o nome sai da sala', async () => {
      const sala = await montar()
      const [peloCodigo, peloLink, outro] = await nomes(sala, sala.turma, 3)
      if (peloCodigo === undefined || peloLink === undefined || outro === undefined) throw new Error('nomes não gravados')
      const corpos = [pedido(sala, peloCodigo), pedido(sala, peloLink, {}, 'token')]
      for (const corpo of corpos) {
        const resposta = await reivindicar(corpo)
        expect(semRequisicao(resposta)).toEqual(ENVIADO)
        expect(resposta.setCookie).toEqual([])
      }

      const pedidos = await pedidosDa(sala.escolaId)
      expect(pedidos).toHaveLength(2)
      for (const [posicao, nome] of [peloCodigo, peloLink].entries()) {
        const gravado = pedidos.find((linha) => linha.lista_nome_id === nome.id)
        expect(gravado).toMatchObject({
          ano_letivo_id: sala.anoLetivoId,
          turma_id: sala.turma,
          chave_envio: corpos[posicao]?.chaveEnvio,
          teve_matricula_errada: false,
          estado: 'pendente',
          decidida_em: null,
          decidida_por: null,
          decidida_como: null,
        })
        expect(gravado?.senha_hash).toMatch(/^\$argon2id\$/)
        expect(await api.app.get(HashDeSenha).verificar(gravado?.senha_hash, SENHA)).toBe(true)
        expect(await estadoDoNome(nome.id)).toBe('reivindicado')
      }
      // O nome e a matrícula do reivindicado ficam na lista; ele só sai da página pública.
      const { rows } = await bancada.pool.query<{ nome: string; matricula: string }>('select nome, matricula from lista_nome where id = $1', [peloCodigo.id])
      expect(rows[0]).toEqual({ nome: peloCodigo.nome, matricula: peloCodigo.matricula })
      expect(await livresNaSala(sala)).toEqual([outro.id])
    })

    it('E24: dois "Ana Souza", cada um só com a própria matrícula, também digitada com espaço nas pontas; com a do outro, a recusa', async () => {
      const sala = await montar()
      const [primeira, segunda] = await nomes(sala, sala.turma, 2, `Ana Souza ${randomUUID().slice(0, 8)}`)
      if (primeira === undefined || segunda === undefined) throw new Error('nomes não gravados')
      expect(primeira.nome).toBe(segunda.nome)
      const antes = await retrato(sala.escolaId)
      expect(semRequisicao(await reivindicar(pedido(sala, primeira, { matricula: segunda.matricula })))).toEqual(RECUSADA)
      expect(semRequisicao(await reivindicar(pedido(sala, segunda, { matricula: primeira.matricula })))).toEqual(RECUSADA)
      expect(await retrato(sala.escolaId)).toEqual(antes)

      expect(semRequisicao(await reivindicar(pedido(sala, primeira, { matricula: ` ${primeira.matricula} ` })))).toEqual(ENVIADO)
      expect(semRequisicao(await reivindicar(pedido(sala, segunda)))).toEqual(ENVIADO)
      expect((await pedidosDa(sala.escolaId)).map((linha) => linha.lista_nome_id).sort()).toEqual([primeira.id, segunda.id].sort())
    })

    it('E21: o reenvio com a mesma chave responde enviado sem pedido novo e sem hash; a mesma chave pelo acesso de T2, com a matrícula certa de T2, é recusada, sem pedido em T2', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const corpo = pedido(sala, nome)
      expect(semRequisicao(await reivindicar(corpo))).toEqual(ENVIADO)
      expect(hashes).toHaveBeenCalledTimes(1)

      hashes.mockClear()
      expect(semRequisicao(await reivindicar(corpo))).toEqual(ENVIADO)
      expect(semRequisicao(await reivindicar({ ...corpo, codigo: undefined, token: sala.token }))).toEqual(ENVIADO)
      expect(hashes).not.toHaveBeenCalled()
      expect(await pedidosDa(sala.escolaId)).toHaveLength(1)
      // O pedido criado e os reenvios não somam em contador nenhum (7.0).
      expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 0, nome: 0 })

      // A mesma chave, pelo acesso de T2 da mesma escola, com um nome livre de T2 e a matrícula certa dele: segue o fluxo,
      // passa pelo hash, e o 23505 do único da chave na escola leva à releitura, que não a acha em T2.
      const deT2 = await gerar(sala, sala.outraTurma)
      const nomeDeT2 = await umNome(sala, sala.outraTurma)
      const antes = await retrato(sala.escolaId)
      expect(semRequisicao(await reivindicar({ ...pedido({ ...sala, ...deT2 }, nomeDeT2), chaveEnvio: corpo.chaveEnvio }))).toEqual(RECUSADA)
      expect(hashes).toHaveBeenCalledTimes(1)
      expect(await retrato(sala.escolaId)).toEqual(antes)
      expect(await estadoDoNome(nomeDeT2.id)).toBe('livre')
      // O hash rodou sem pedido: soma na turma de T2; a matrícula era a certa, e o nome de T2 não soma (7.0, L6).
      expect(await contadores(sala, nomeDeT2, sala.outraTurma)).toEqual({ escola: 0, turma: 1, nome: 0 })
      expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 0, nome: 0 })

      // A chave que não é UUID nem chega à sala.
      expect(semRequisicao(await reivindicar({ ...corpo, chaveEnvio: 'chave-que-nao-e-uuid' }))).toEqual(ENTRADA_INVALIDA)
    })

    it('E30 (gravação, 7.0): duas matrículas erradas e depois a certa gravam teve_matricula_errada em true; o nome de primeira, em false; depois de "Gerar novo", o contador do código anterior não marca o pedido', async () => {
      const sala = await montar()
      const [errado, deprimeira, antigo] = await nomes(sala, sala.turma, 3)
      if (errado === undefined || deprimeira === undefined || antigo === undefined) throw new Error('nomes não gravados')
      for (let vez = 0; vez < 2; vez++) expect(semRequisicao(await reivindicar(pedido(sala, errado, { matricula: `errada-${String(vez)}` })))).toEqual(RECUSADA)
      const certo = await reivindicar(pedido(sala, errado))
      // A resposta é a mesma de qualquer pedido: nem número, nem hora, nem a matrícula tentada.
      expect(semRequisicao(certo)).toEqual(ENVIADO)
      expect(semRequisicao(await reivindicar(pedido(sala, deprimeira)))).toEqual(ENVIADO)
      // Duas erradas no terceiro nome pelo código atual; o professor gera outro, e o pedido pelo novo sai sem marca.
      for (let vez = 0; vez < 2; vez++) expect(semRequisicao(await reivindicar(pedido(sala, antigo, { matricula: `errada-${String(vez)}` })))).toEqual(RECUSADA)
      const novo = await gerar(sala, sala.turma)
      expect(semRequisicao(await reivindicar(pedido({ ...sala, ...novo }, antigo)))).toEqual(ENVIADO)

      const marca = new Map((await pedidosDa(sala.escolaId)).map((linha) => [linha.lista_nome_id, linha.teve_matricula_errada]))
      expect(Object.fromEntries([errado, deprimeira, antigo].map((nome) => [nome.id, marca.get(nome.id)]))).toEqual({ [errado.id]: true, [deprimeira.id]: false, [antigo.id]: false })
    })

    it('E23: a falha entre o insert do pedido e o update do nome volta as duas escritas; o nome continua livre e sem pedido, e o pedido seguinte grava', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const ordem: string[] = []
      const inserirReal = ReivindicacaoRepository.prototype.inserirPendente
      const insercoes = vi.spyOn(ReivindicacaoRepository.prototype, 'inserirPendente').mockImplementationOnce(async function (this: ReivindicacaoRepository, novo) {
        await inserirReal.call(this, novo)
        ordem.push('insert do pedido gravado na transação')
      })
      const tomar = vi.spyOn(ListaLivreRepository.prototype, 'tomar').mockImplementationOnce(async () => {
        // O insert do pedido já rodou, na transação que ainda está aberta: de fora dela, ele não aparece.
        ordem.push(`falha antes do update, com ${String((await pedidosDa(sala.escolaId)).length)} pedido visível de fora`)
        throw new Error('falha injetada entre as duas escritas')
      })
      try {
        const resposta = await reivindicar(pedido(sala, nome))
        expect(semRequisicao(resposta)).toEqual(erro(ErrorCode.ERRO_INTERNO, 500))
        expect(ordem).toEqual(['insert do pedido gravado na transação', 'falha antes do update, com 0 pedido visível de fora'])
      } finally {
        insercoes.mockRestore()
        tomar.mockRestore()
      }
      expect(await pedidosDa(sala.escolaId)).toEqual([])
      expect(await estadoDoNome(nome.id)).toBe('livre')
      expect(await livresNaSala(sala)).toEqual([nome.id])

      expect(semRequisicao(await reivindicar(pedido(sala, nome)))).toEqual(ENVIADO)
      expect(await pedidosDa(sala.escolaId)).toHaveLength(1)
    })

    it('R5: o login com a matrícula e a senha do pedido pendente responde igual à senha errada de uma matrícula que existe e à de uma que não existe', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      expect(semRequisicao(await reivindicar(pedido(sala, nome)))).toEqual(ENVIADO)
      const existente = `sala-aluno-${randomUUID().slice(0, 8)}`
      await bancada.alunosComMatricula(sala.escolaId, [{ matricula: existente, senhaHash: await gerarReal(SENHA) }])
      const entrar = async (matricula: string, senha: string) => {
        const resposta = await fetch(`${api.url}/v1/sessao/matricula`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() },
          body: JSON.stringify({ slug: sala.slug, matricula, senha }),
        })
        return { status: resposta.status, texto: await resposta.text(), cacheControl: null, retryAfter: null, setCookie: resposta.headers.getSetCookie() }
      }
      const doPendente = await entrar(nome.matricula, SENHA)
      expect(doPendente.setCookie).toEqual([])
      expect(semRequisicao(doPendente)).toEqual(erro(ErrorCode.NAO_AUTENTICADO, 401))
      expect(semRequisicao(await entrar(existente, `${SENHA}-errada`))).toEqual(semRequisicao(doPendente))
      expect(semRequisicao(await entrar(`sala-ninguem-${randomUUID().slice(0, 8)}`, SENHA))).toEqual(semRequisicao(doPendente))
      // O 401 é o da credencial, e não do endereço: a matrícula que existe entra com a senha dela.
      expect((await entrar(existente, SENHA)).status).toBe(200)
    })

    it('E7: o nome reivindicado não se retira: CONFLITO, e o nome e o pedido ficam', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      expect(semRequisicao(await reivindicar(pedido(sala, nome)))).toEqual(ENVIADO)
      const antes = await retrato(sala.escolaId)
      const retirada = await chamar(api.url, 'DELETE', `/v1/lista-nomes/${nome.id}`, sala.coordenacao.token)
      expect(retirada.status).toBe(409)
      expect(retirada.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      expect(await retrato(sala.escolaId)).toEqual(antes)
    })

    it('E2: a turma com pedido não se exclui, mesmo sem nome na lista, sem acesso vigente e sem vínculo: CONFLITO; sem o pedido, sai', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      expect(semRequisicao(await reivindicar(pedido(sala, nome)))).toEqual(ENVIADO)
      // Só o pedido fica apontando para a turma: o acesso revogado, os vínculos e o nome tirados pelo banco. O pedido vira
      // recusado sem os segredos (o check), e o `set null` da FK o deixa sem nome.
      expect((await post(sala.professor, `/v1/turmas/${sala.turma}/acesso/revogar`, {})).status).toBe(204)
      await bancada.pool.query('delete from vinculo where id = any($1::uuid[])', [sala.vinculos])
      await bancada.pool.query(`update reivindicacao set estado = 'recusada', senha_hash = null, chave_envio = null, teve_matricula_errada = null where escola_id = $1`, [sala.escolaId])
      await bancada.pool.query('delete from lista_nome where id = $1', [nome.id])
      expect((await pedidosDa(sala.escolaId)).map((linha) => linha.lista_nome_id)).toEqual([null])

      const excluir = () => chamar(api.url, 'DELETE', `/v1/turmas/${sala.turma}`, sala.coordenacao.token)
      const recusada = await excluir()
      expect(recusada.status).toBe(409)
      expect(recusada.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      expect(await pedidosDa(sala.escolaId)).toHaveLength(1)

      await bancada.pool.query('delete from reivindicacao where escola_id = $1', [sala.escolaId])
      expect((await excluir()).status).toBe(204)
    })

    it('o check do pedido: hash, chave e teve_matricula_errada só no pendente, e o pendente com os três e com o nome; estado e decisor nos valores da spec (23514)', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const inserir = (colunas: Record<string, unknown>) => {
        const todas = { escola_id: sala.escolaId, ano_letivo_id: sala.anoLetivoId, turma_id: sala.turma, lista_nome_id: nome.id, ...colunas }
        const nomes = Object.keys(todas)
        return bancada.pool.query(`insert into reivindicacao (${nomes.join(', ')}) values (${nomes.map((_, posicao) => `$${String(posicao + 1)}`).join(', ')})`, Object.values(todas))
      }
      const segredos = { senha_hash: '$argon2id$sintetico', chave_envio: randomUUID(), teve_matricula_errada: false }
      const violacoes: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
        ['pendente sem hash', { ...segredos, senha_hash: null }],
        ['pendente sem chave', { ...segredos, chave_envio: null }],
        ['pendente sem teve_matricula_errada', { ...segredos, teve_matricula_errada: null }],
        ['pendente sem nome', { ...segredos, lista_nome_id: null }],
        ['recusada com hash', { estado: 'recusada', senha_hash: segredos.senha_hash }],
        ['aprovada com chave', { estado: 'aprovada', chave_envio: randomUUID() }],
        ['encerrada com teve_matricula_errada', { estado: 'encerrada', teve_matricula_errada: true }],
        ['estado fora da lista, sem segredos', { estado: 'cancelada' }],
        ['decidida_como fora da lista', { estado: 'recusada', decidida_como: 'operador' }],
      ]
      for (const [caso, colunas] of violacoes) {
        await expect(inserir(colunas), caso).rejects.toMatchObject({ code: '23514' })
      }
      await inserir(segredos)
      await inserir({ estado: 'recusada', decidida_como: 'coordenacao' })
      expect(await pedidosDa(sala.escolaId)).toHaveLength(2)
      // O nome de um pendente não sai: o `set null` da FK deixaria o hash da senha num pedido sem nome.
      await expect(bancada.pool.query('delete from lista_nome where id = $1', [nome.id])).rejects.toMatchObject({ code: '23514', constraint: 'reivindicacao_pendente_com_nome' })
      expect(await estadoDoNome(nome.id)).toBe('livre')
    })

    it('os únicos e as FKs: um pendente por nome; a chave única na escola, e não no sistema (23505); quem decidiu, eliminado, deixa o pedido sem autor e na escola', async () => {
      const [a, b] = [await montar(), await montar()]
      const [nome, outro] = await nomes(a, a.turma, 2)
      if (nome === undefined || outro === undefined) throw new Error('nomes não gravados')
      const deB = await umNome(b)
      const inserir = (sala: Sala, colunas: Record<string, unknown>) => {
        const todas = { escola_id: sala.escolaId, ano_letivo_id: sala.anoLetivoId, turma_id: sala.turma, ...colunas }
        const campos = Object.keys(todas)
        return bancada.pool.query(`insert into reivindicacao (${campos.join(', ')}) values (${campos.map((_, posicao) => `$${String(posicao + 1)}`).join(', ')})`, Object.values(todas))
      }
      const pendente = (listaNomeId: string, chaveEnvio: string) => ({ lista_nome_id: listaNomeId, chave_envio: chaveEnvio, senha_hash: '$argon2id$sintetico', teve_matricula_errada: false })
      const chave = randomUUID()
      await inserir(a, pendente(nome.id, chave))
      await expect(inserir(a, pendente(nome.id, randomUUID()))).rejects.toMatchObject({ code: '23505', constraint: 'reivindicacao_pendente_por_nome' })
      await expect(inserir(a, pendente(outro.id, chave))).rejects.toMatchObject({ code: '23505', constraint: 'reivindicacao_chave_na_escola_unica' })
      // A mesma chave em outra escola grava, e o recusado no nome não conflita com o pendente dele.
      await inserir(b, pendente(deB.id, chave))
      await inserir(a, { lista_nome_id: nome.id, estado: 'recusada' })

      const decisor = await bancada.equipeComEmail(a.escolaId, `decisor-${randomUUID()}@escola.invalid`)
      await inserir(a, { lista_nome_id: outro.id, estado: 'recusada', decidida_por: decisor.usuarioId, decidida_como: 'professor', decidida_em: new Date() })
      await bancada.pool.query('delete from usuario where id = $1', [decisor.usuarioId])
      await bancada.pool.query('delete from conta where id = $1', [decisor.contaId])
      const { rows } = await bancada.pool.query<{ escola_id: string; decidida_por: string | null }>(`select escola_id, decidida_por from reivindicacao where lista_nome_id = $1`, [outro.id])
      expect(rows).toEqual([{ escola_id: a.escolaId, decidida_por: null }])
    })
  })

  describe('uma resposta só: acesso que não vale é NAO_ENCONTRADO; nome que não se toma é REIVINDICACAO_RECUSADA', () => {
    it('I4: o código e o token vigentes de B com o slug de A não reivindicam nada, e com o slug de B reivindicam o nome de B', async () => {
      const [a, b] = [await montar(), await montar()]
      const deB = await umNome(b)
      for (const corpo of [pedido({ ...b, slug: a.slug }, deB), pedido({ ...b, slug: a.slug }, deB, {}, 'token')]) {
        expect(semRequisicao(await reivindicar(corpo))).toEqual(NAO_ENCONTRADO)
      }
      expect(await pedidosDa(b.escolaId)).toEqual([])
      expect(hashes).not.toHaveBeenCalled()
      expect(semRequisicao(await reivindicar(pedido(b, deB, {}, 'token')))).toEqual(ENVIADO)
    })

    it('R1: pelo link e pelo código, o inexistente, o vencido, o revogado, o de ano encerrado, o de turma excluída, o de outra escola e o slug inexistente dão o mesmo corpo, byte a byte, sem hash e sem gravar', async () => {
      const [a, b, vencido, revogado, encerrado, excluida] = [await montar(), await montar(), await montar(), await montar(), await montar(), await montar()]
      const nomeDe = new Map<string, Nome>()
      for (const sala of [a, b, vencido, revogado, encerrado]) nomeDe.set(sala.escolaId, await umNome(sala))
      const nome = (sala: Sala): Pick<Nome, 'id' | 'matricula'> => nomeDe.get(sala.escolaId) ?? { id: randomUUID(), matricula: 'sem-lista' }

      await bancada.pool.query(`update acesso_turma set expira_em = now() - interval '1 second' where escola_id = $1`, [vencido.escolaId])
      expect((await post(revogado.professor, `/v1/turmas/${revogado.turma}/acesso/revogar`, {})).status).toBe(204)
      await bancada.pool.query(`update ano_letivo set situacao = 'encerrado' where id = $1`, [encerrado.anoLetivoId])
      await bancada.pool.query(`insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'em_curso')`, [encerrado.escolaId])
      expect((await post(excluida.professor, `/v1/turmas/${excluida.turma}/acesso/revogar`, {})).status).toBe(204)
      await bancada.pool.query('delete from vinculo where id = any($1::uuid[])', [excluida.vinculos])
      expect((await chamar(api.url, 'DELETE', `/v1/turmas/${excluida.turma}`, excluida.coordenacao.token)).status).toBe(204)

      const escolas = [a, b, vencido, revogado, encerrado, excluida].map((sala) => sala.escolaId)
      const antes = await retrato(...escolas)
      const slugInexistente = `nao-existe-${randomUUID().slice(0, 8)}`
      const casos: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
        ['token inexistente', pedido({ ...a, token: randomBytes(32).toString('base64url') }, nome(a), {}, 'token')],
        ['token vencido', pedido(vencido, nome(vencido), {}, 'token')],
        ['token revogado', pedido(revogado, nome(revogado), {}, 'token')],
        ['token de ano encerrado', pedido(encerrado, nome(encerrado), {}, 'token')],
        ['token de turma excluída', pedido(excluida, nome(excluida), {}, 'token')],
        ['token de outra escola', pedido({ ...b, slug: a.slug }, nome(b), {}, 'token')],
        ['token com slug inexistente', pedido({ ...a, slug: slugInexistente }, nome(a), {}, 'token')],
        ['código inexistente', pedido({ ...a, codigo: sortearCodigoDaTurma() }, nome(a))],
        ['código vencido', pedido(vencido, nome(vencido))],
        ['código revogado', pedido(revogado, nome(revogado))],
        ['código de ano encerrado', pedido(encerrado, nome(encerrado))],
        ['código de turma excluída', pedido(excluida, nome(excluida))],
        ['código de outra escola', pedido({ ...b, slug: a.slug }, nome(b))],
        ['código com slug inexistente', pedido({ ...a, slug: slugInexistente }, nome(a))],
      ]
      for (const [caso, corpo] of casos) expect(semRequisicao(await reivindicar(corpo)), caso).toEqual(NAO_ENCONTRADO)
      expect(hashes).not.toHaveBeenCalled()
      expect(await retrato(...escolas)).toEqual(antes)

      // O acesso vigente de A, com o slug de A, continua reivindicando: o 404 acima é o do caso, e não da escola.
      expect(semRequisicao(await reivindicar(pedido(a, nome(a), {}, 'token')))).toEqual(ENVIADO)
    })

    it('I5: pelo acesso de T1, o nome livre de T2 da mesma escola e o de uma turma de B, com a matrícula certa de cada um: a recusa, e nada muda', async () => {
      const [a, b] = [await montar(), await montar()]
      const deT1 = await umNome(a)
      const deT2 = await umNome(a, a.outraTurma)
      const deB = await umNome(b)
      const antes = await retrato(a.escolaId, b.escolaId)
      for (const [caso, nome] of [
        ['nome de T2', deT2],
        ['nome de B', deB],
      ] as const) {
        expect(semRequisicao(await reivindicar(pedido(a, nome))), caso).toEqual(RECUSADA)
        expect(semRequisicao(await reivindicar(pedido(a, nome, {}, 'token'))), caso).toEqual(RECUSADA)
      }
      expect(await retrato(a.escolaId, b.escolaId)).toEqual(antes)
      // O nome de T1, pelo mesmo acesso, se toma.
      expect(semRequisicao(await reivindicar(pedido(a, deT1)))).toEqual(ENVIADO)
    })

    it('matrícula repetida em escolas diferentes (regra 60, item 6) e a mesma chave nas duas: o pedido pelo acesso de A toma só o nome de A, e o de B segue livre', async () => {
      const [a, b] = [await montar(), await montar()]
      const matricula = `sala-igual-${randomUUID().slice(0, 8)}`
      const deA = { ...(await umNome(a)), matricula }
      const deB = { ...(await umNome(b)), matricula }
      await bancada.pool.query('update lista_nome set matricula = $1 where id = any($2::uuid[])', [matricula, [deA.id, deB.id]])
      const chaveEnvio = randomUUID()
      expect(semRequisicao(await reivindicar(pedido(b, deB, { chaveEnvio })))).toEqual(ENVIADO)
      // A mesma chave, já gravada num pedido de B, não é reenvio em A: o pedido de A grava, com a chave única só na escola.
      expect(semRequisicao(await reivindicar(pedido(a, deA, { chaveEnvio })))).toEqual(ENVIADO)
      expect((await pedidosDa(a.escolaId)).map((linha) => [linha.lista_nome_id, linha.chave_envio])).toEqual([[deA.id, chaveEnvio]])
      expect((await pedidosDa(b.escolaId)).map((linha) => [linha.lista_nome_id, linha.chave_envio])).toEqual([[deB.id, chaveEnvio]])

      // E com um nome livre de B ainda com a mesma matrícula de um livre de A, o pedido de A não toca B.
      const [outroDeA, outroDeB] = [await umNome(a), await umNome(b)]
      await bancada.pool.query('update lista_nome set matricula = $1 where id = $2', [outroDeA.matricula, outroDeB.id])
      expect(semRequisicao(await reivindicar(pedido(a, outroDeA)))).toEqual(ENVIADO)
      expect(await estadoDoNome(outroDeA.id)).toBe('reivindicado')
      expect(await estadoDoNome(outroDeB.id)).toBe('livre')
    })

    it('R2 e R3: nome inexistente, de outra turma, de outra escola, de ano encerrado, matrícula errada, matrícula de outro nome e nome já reivindicado: o mesmo corpo, um hash em cada, nada gravado', async () => {
      const [a, b] = [await montar(), await montar()]
      const [alvo, outroDaTurma, tomado] = await nomes(a, a.turma, 3)
      if (alvo === undefined || outroDaTurma === undefined || tomado === undefined) throw new Error('nomes não gravados')
      const deT2 = await umNome(a, a.outraTurma)
      const deB = await umNome(b)
      // O nome de uma turma do ano encerrado da mesma escola, posto no banco, como o de uma turma que virou o ano.
      const { rows: anos } = await bancada.pool.query<{ id: string }>(
        `insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2025, '2025-02-01', '2025-12-15', 'encerrado') returning id`,
        [a.escolaId],
      )
      const { rows: turmas } = await bancada.pool.query<{ id: string }>(`insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB de 2025') returning id`, [
        a.escolaId,
        anos[0]?.id,
        a.serieId,
      ])
      const matriculaDe2025 = `sala-2025-${randomUUID().slice(0, 8)}`
      const { rows: antigos } = await bancada.pool.query<{ id: string }>(
        `insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula) values ($1, $2, $3, 'Aluno de 2025', $4) returning id`,
        [a.escolaId, anos[0]?.id, turmas[0]?.id, matriculaDe2025],
      )
      const encerrado = { id: antigos[0]?.id ?? '', matricula: matriculaDe2025 }
      expect(semRequisicao(await reivindicar(pedido(a, tomado)))).toEqual(ENVIADO)

      const antes = await retrato(a.escolaId, b.escolaId)
      hashes.mockClear()
      const casos: ReadonlyArray<readonly [string, Pick<Nome, 'id' | 'matricula'>]> = [
        ['nome inexistente', { id: randomUUID(), matricula: alvo.matricula }],
        ['nome de outra turma', deT2],
        ['nome de outra escola', deB],
        ['nome de ano encerrado', encerrado],
        ['matrícula errada', { id: alvo.id, matricula: `sala-errada-${randomUUID().slice(0, 8)}` }],
        ['matrícula de outro nome da turma', { id: alvo.id, matricula: outroDaTurma.matricula }],
        ['nome já reivindicado, com a matrícula dele', tomado],
      ]
      for (const [caso, nome] of casos) {
        hashes.mockClear()
        expect(semRequisicao(await reivindicar(pedido(a, nome))), caso).toEqual(RECUSADA)
        // R3: o argon2id rodou uma vez, com a senha do pedido, em todo caso.
        expect(hashes.mock.calls, caso).toEqual([[SENHA]])
      }
      expect(await retrato(a.escolaId, b.escolaId)).toEqual(antes)
      expect(semRequisicao(await reivindicar(pedido(a, alvo)))).toEqual(ENVIADO)
    })
  })

  describe('corridas, com as chamadas em paralelo', () => {
    it('C1: dois pedidos no mesmo nome, com a matrícula certa e chaves diferentes: um pendente, o outro recusado, nunca 5xx', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const respostas = await Promise.all([reivindicar(pedido(sala, nome)), reivindicar(pedido(sala, nome, {}, 'token'))])
      expect(respostas.map(semRequisicao).sort((x, y) => x.status - y.status)).toEqual([ENVIADO, RECUSADA])
      expect(await pedidosDa(sala.escolaId)).toHaveLength(1)
      expect(await estadoDoNome(nome.id)).toBe('reivindicado')
      // O perdedor rodou o hash sem pedido: soma um na turma, e nada no nome, que já não está livre (7.0, L6).
      expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 1, nome: 0 })
    })

    it('C1 (repository): o update num nome já reivindicado não acha linha', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      expect(semRequisicao(await reivindicar(pedido(sala, nome)))).toEqual(ENVIADO)
      const pool = api.app.get<DatabasePool>(POOL_BANCO, { strict: false })
      const tomou = await runInContext({ requisicaoId: randomUUID(), escolaId: sala.escolaId, anoLetivoId: sala.anoLetivoId }, () =>
        new ListaLivreRepository(createDatabase(pool)).tomar({ turmaId: sala.turma, listaNomeId: nome.id, matricula: nome.matricula }),
      )
      expect(tomou).toBe(false)
      expect(await estadoDoNome(nome.id)).toBe('reivindicado')
    })

    it('C2 (a): a mesma chave em dois envios paralelos: um pedido, as duas respostas enviado', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const corpo = pedido(sala, nome)
      const respostas = await Promise.all([reivindicar(corpo), reivindicar(corpo)])
      for (const resposta of respostas) expect(semRequisicao(resposta)).toEqual(ENVIADO)
      expect(await pedidosDa(sala.escolaId)).toHaveLength(1)
      expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 0, nome: 0 })
    })

    it('C2 (b): com o teto do semáforo ocupado, o segundo envio chega enquanto o primeiro espera, e é atendido depois dele: um pedido, os dois enviado', async () => {
      const sala = await montar()
      const [ocupante, nome] = await nomes(sala, sala.turma, 2)
      if (ocupante === undefined || nome === undefined) throw new Error('nomes não gravados')
      const semaforo = apiDoSemaforo.app.get(SemaforoDeHash)
      const segurado = segurarOProximoHash(hashesDoSemaforo, gerarRealDoSemaforo)
      const doOcupante = reivindicar(pedido(sala, ocupante), { url: apiDoSemaforo.url })
      await vi.waitFor(() => expect(hashesDoSemaforo).toHaveBeenCalledTimes(1))
      const corpo = pedido(sala, nome)
      const primeiro = reivindicar(corpo, { url: apiDoSemaforo.url })
      await aguardar(async () => semaforo.esperando === 1, 'o primeiro envio esperando no semáforo')
      const segundo = reivindicar(corpo, { url: apiDoSemaforo.url })
      await aguardar(async () => semaforo.esperando === 2, 'o segundo envio esperando atrás do primeiro')
      segurado.soltar()

      expect(semRequisicao(await doOcupante)).toEqual(ENVIADO)
      expect(semRequisicao(await primeiro)).toEqual(ENVIADO)
      expect(semRequisicao(await segundo)).toEqual(ENVIADO)
      expect((await pedidosDa(sala.escolaId)).map((linha) => linha.lista_nome_id).sort()).toEqual([ocupante.id, nome.id].sort())
      expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 0, nome: 0 })
    })

    it('C2 (c): com o índice da chave depois do "um pendente por nome", o segundo envio, que leu a chave antes do commit do primeiro, recebe o 23505 do pendente e relê a chave: enviado; um terceiro, com outra chave, a recusa', async () => {
      const indice = 'reivindicacao_chave_na_escola_unica'
      const pendente = 'reivindicacao_pendente_por_nome'
      const oid = async (nome: string) => Number((await bancada.pool.query<{ oid: string }>('select $1::regclass::oid::bigint as oid', [nome])).rows[0]?.oid)
      const definicao = async () => (await bancada.pool.query<{ indexdef: string }>(`select indexdef from pg_indexes where schemaname = 'public' and indexname = $1`, [indice])).rows[0]?.indexdef
      const original = await definicao()
      expect(original).toContain('WHERE (chave_envio IS NOT NULL)')
      if ((await oid(indice)) < (await oid(pendente))) {
        // Recriado numa transação só, pelo `indexdef`: o mesmo nome e o mesmo predicado, com o OID depois do outro. O banco
        // de teste fica assim até ser recriado (o portão começa com o banco novo); nas rodadas seguintes, o `if` pula, e o
        // 23505 do reenvio em paralelo passa a vir do pendente por nome em toda a suíte, com a mesma resposta.
        const cliente = await bancada.pool.connect()
        try {
          await cliente.query('begin')
          await cliente.query(`drop index "${indice}"`)
          await cliente.query(original ?? '')
          await cliente.query('commit')
        } catch (falha) {
          await cliente.query('rollback')
          throw falha
        } finally {
          cliente.release()
        }
      }
      expect(await oid(indice)).toBeGreaterThan(await oid(pendente))
      expect(await definicao()).toBe(original)

      const sala = await montar()
      const nome = await umNome(sala)
      const corpo = pedido(sala, nome)
      const inserirReal = ReivindicacaoRepository.prototype.inserirPendente
      const restricoes: Array<string | undefined> = []
      const insercoes = vi.spyOn(ReivindicacaoRepository.prototype, 'inserirPendente').mockImplementation(async function (this: ReivindicacaoRepository, novo) {
        try {
          await inserirReal.call(this, novo)
        } catch (falha) {
          restricoes.push(postgresErrorIn(falha)?.constraint)
          throw falha
        }
      })
      const leituras = vi.spyOn(ReivindicacaoRepository.prototype, 'chaveGravada')
      try {
        // O ponto de pausa: o hash do segundo envio, que já leu a chave (ainda não gravada) e ainda não abriu a transação.
        const segurado = segurarOProximoHash(hashes, gerarReal)
        const segundo = reivindicar(corpo)
        await vi.waitFor(() => expect(hashes).toHaveBeenCalledTimes(1))
        expect(leituras).toHaveBeenCalledTimes(1)
        expect(semRequisicao(await reivindicar(corpo))).toEqual(ENVIADO)
        segurado.soltar()
        expect(semRequisicao(await segundo)).toEqual(ENVIADO)
        expect(restricoes).toEqual([pendente])
        // Duas leituras iniciais e a releitura do segundo, depois do 23505.
        expect(leituras).toHaveBeenCalledTimes(3)
        expect(await pedidosDa(sala.escolaId)).toHaveLength(1)
        expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 0, nome: 0 })

        // Um terceiro envio no mesmo nome, com outra chave: o mesmo 23505, e sem a própria chave gravada, a recusa, que
        // soma um no teto da turma (L6) e nada no nome, já tomado.
        expect(semRequisicao(await reivindicar(pedido(sala, nome)))).toEqual(RECUSADA)
        expect(restricoes).toEqual([pendente, pendente])
        expect(await pedidosDa(sala.escolaId)).toHaveLength(1)
        expect(await contadores(sala, nome)).toEqual({ escola: 0, turma: 1, nome: 0 })
      } finally {
        insercoes.mockRestore()
        leituras.mockRestore()
      }
    })

    it('C4: reivindicar × retirar o mesmo nome livre, parado depois do update do nome: o pedido fica, e a retirada recebe CONFLITO', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'update', quando: `new.id = '${nome.id}'::uuid` })
      await gatilho.armar()
      try {
        const reivindicando = reivindicar(pedido(sala, nome))
        await gatilho.esperarParadas()
        const retirando = chamar(api.url, 'DELETE', `/v1/lista-nomes/${nome.id}`, sala.coordenacao.token)
        await esperarNaTrava(bancada.pool, '%delete from "lista_nome"%')
        await gatilho.soltar()
        const [reivindicado, retirado] = await Promise.all([reivindicando, retirando])
        expect(semRequisicao(reivindicado)).toEqual(ENVIADO)
        expect(retirado.status).toBe(409)
        expect(retirado.corpo.erro?.codigo).toBe(ErrorCode.CONFLITO)
      } finally {
        await gatilho.desarmar()
      }
      expect(await estadoDoNome(nome.id)).toBe('reivindicado')
      expect((await pedidosDa(sala.escolaId)).map((linha) => linha.lista_nome_id)).toEqual([nome.id])
    })

    it('C4: retirar × reivindicar, com a retirada parada depois do delete: o nome sai, e a reivindicação, que esperou a FK, é recusada, sem pedido', async () => {
      const sala = await montar()
      const nome = await umNome(sala)
      const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'lista_nome', evento: 'delete', quando: `old.id = '${nome.id}'::uuid` })
      await gatilho.armar()
      try {
        const retirando = chamar(api.url, 'DELETE', `/v1/lista-nomes/${nome.id}`, sala.coordenacao.token)
        await gatilho.esperarParadas()
        const reivindicando = reivindicar(pedido(sala, nome))
        await esperarNaTrava(bancada.pool, '%insert into "reivindicacao"%')
        await gatilho.soltar()
        const [retirado, reivindicado] = await Promise.all([retirando, reivindicando])
        expect(retirado.status).toBe(204)
        expect(semRequisicao(reivindicado)).toEqual(RECUSADA)
      } finally {
        await gatilho.desarmar()
      }
      expect(await estadoDoNome(nome.id)).toBeUndefined()
      expect(await pedidosDa(sala.escolaId)).toEqual([])
    })
  })

  describe('L9: o hash no semáforo, no balde da escola, fora da transação', () => {
    it('com o teto ocupado por reivindicações da escola A, o login da escola B recebe a vez no rodízio, e nenhuma conexão do pool fica presa na espera', async () => {
      const a = await montar()
      const [ocupante, segundo, terceiro] = await nomes(a, a.turma, 3)
      if (ocupante === undefined || segundo === undefined || terceiro === undefined) throw new Error('nomes não gravados')
      const escolaB = await bancada.escola()
      const matriculaDeB = `sala-b-${randomUUID().slice(0, 8)}`
      await bancada.alunosComMatricula(escolaB, [{ matricula: matriculaDeB, senhaHash: await gerarRealDoSemaforo(SENHA) }])
      hashesDoSemaforo.mockClear()
      const ordem: string[] = []
      const semaforo = apiDoSemaforo.app.get(SemaforoDeHash)
      const pool = apiDoSemaforo.app.get<DatabasePool>(POOL_BANCO, { strict: false })

      const segurado = segurarOProximoHash(hashesDoSemaforo, gerarRealDoSemaforo)
      hashesDoSemaforo.mockImplementation(async (senha) => {
        ordem.push('reivindicação de A')
        return gerarRealDoSemaforo(senha)
      })
      verificacoesDoSemaforo.mockImplementationOnce(async (guardado, senha) => {
        ordem.push('login de B')
        return verificarRealDoSemaforo(guardado, senha)
      })
      try {
        const doOcupante = reivindicar(pedido(a, ocupante), { url: apiDoSemaforo.url })
        await vi.waitFor(() => expect(hashesDoSemaforo).toHaveBeenCalledTimes(1))
        const deA = [reivindicar(pedido(a, segundo), { url: apiDoSemaforo.url }), reivindicar(pedido(a, terceiro), { url: apiDoSemaforo.url })]
        await aguardar(async () => semaforo.esperando === 2, 'as duas reivindicações de A esperando')
        const slugDeB = await bancada.slugDe(escolaB)
        const loginDeB = fetch(`${apiDoSemaforo.url}/v1/sessao/matricula`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() },
          body: JSON.stringify({ slug: slugDeB, matricula: matriculaDeB, senha: SENHA }),
        })
        await aguardar(async () => semaforo.esperando === 3, 'o login de B esperando atrás de A')
        // Três pedidos esperando a vez e um no hash: nenhum deles segura conexão do pool.
        expect(pool.totalCount - pool.idleCount).toBe(0)
        segurado.soltar()

        expect(semRequisicao(await doOcupante)).toEqual(ENVIADO)
        expect((await loginDeB).status).toBe(200)
        for (const resposta of await Promise.all(deA)) expect(semRequisicao(resposta)).toEqual(ENVIADO)
        // A primeira vez que abre vai ao balde de B, que ainda não foi atendido; os dois de A esperam a vez deles.
        expect(ordem).toEqual(['login de B', 'reivindicação de A', 'reivindicação de A'])
      } finally {
        hashesDoSemaforo.mockImplementation(gerarRealDoSemaforo)
      }
    })

    it('passado o prazo do semáforo, 503 INDISPONIVEL_TENTE_DE_NOVO com Retry-After, sem gravar; o reenvio com a mesma chave grava o pedido', async () => {
      const a = await montar()
      const [ocupante, nome] = await nomes(a, a.turma, 2)
      if (ocupante === undefined || nome === undefined) throw new Error('nomes não gravados')
      const segurado = segurarOProximoHash(hashesDoSemaforo, gerarRealDoSemaforo)
      const doOcupante = reivindicar(pedido(a, ocupante), { url: apiDoSemaforo.url })
      await vi.waitFor(() => expect(hashesDoSemaforo).toHaveBeenCalledTimes(1))
      const antes = await retrato(a.escolaId)
      const corpo = pedido(a, nome)
      const indisponiveisAntes = await indisponiveis()
      const inicio = performance.now()
      const recusado = await reivindicar(corpo, { url: apiDoSemaforo.url })
      expect(performance.now() - inicio).toBeGreaterThanOrEqual(ESPERA_MAXIMA_PELO_HASH_MS - 100)
      expect(semRequisicao(recusado)).toEqual(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, 503))
      expect(Number(recusado.retryAfter)).toBeGreaterThanOrEqual(RETRY_AFTER_MINIMO_S)
      expect(Number(recusado.retryAfter)).toBeLessThanOrEqual(RETRY_AFTER_MAXIMO_S)
      expect(recusado.cacheControl).toBe('no-store')
      // O 503 soma em `sala.reivindicacao{resultado="indisponivel"}` (7.0).
      expect((await indisponiveis()) - indisponiveisAntes).toBe(1)
      // O ocupante ainda está no hash: o retrato de antes do 503 é o de agora, e o nome do recusado segue livre.
      expect(await retrato(a.escolaId)).toEqual(antes)
      expect(await estadoDoNome(nome.id)).toBe('livre')
      segurado.soltar()
      expect(semRequisicao(await doOcupante)).toEqual(ENVIADO)

      expect(semRequisicao(await reivindicar(corpo, { url: apiDoSemaforo.url }))).toEqual(ENVIADO)
      expect((await pedidosDa(a.escolaId)).filter((linha) => linha.chave_envio === corpo.chaveEnvio)).toHaveLength(1)
    }, 30_000)
  })

  describe('P5, L10, A6 e A7: contrato estrito, rota anônima no rl:ip, sem registro de acesso e sem cache', () => {
    it('P5: escolaId, turmaId, campo a mais, os dois caminhos, senha curta, sem chave e nome que não é UUID: 400 ENTRADA_INVALIDA, sem hash e sem gravar', async () => {
      const [a, b] = [await montar(), await montar()]
      const nome = await umNome(a)
      const antes = await retrato(a.escolaId, b.escolaId)
      const { chaveEnvio: _chave, ...semChave } = pedido(a, nome)
      const invalidos: ReadonlyArray<readonly [string, unknown]> = [
        ['escolaId de B', pedido(a, nome, { escolaId: b.escolaId })],
        ['turmaId de B', pedido(a, nome, { turmaId: b.turma })],
        ['campo a mais', pedido(a, nome, { nome: nome.nome })],
        ['token e código', pedido(a, nome, { token: a.token })],
        ['senha curta', pedido(a, nome, { senha: 'curta' })],
        ['sem chave', semChave],
        ['nome que não é UUID', pedido(a, nome, { listaNomeId: 'nao-e-uuid' })],
        ['corpo vazio', {}],
      ]
      for (const [caso, corpo] of invalidos) expect(semRequisicao(await reivindicar(corpo)), caso).toEqual(ENTRADA_INVALIDA)
      expect(hashes).not.toHaveBeenCalled()
      expect(await retrato(a.escolaId, b.escolaId)).toEqual(antes)
      expect(semRequisicao(await reivindicar(pedido(a, nome)))).toEqual(ENVIADO)
    })

    it('L10: acima do limite anônimo do IP, 429 LIMITE_EXCEDIDO com Retry-After; outro IP segue', async () => {
      const sala = await montar()
      const [ip, outro] = [ipSorteado(), ipSorteado()]
      const nome = { id: randomUUID(), matricula: 'sala-sem-nome' }
      for (let vez = 0; vez < LIMITE_POR_IP; vez++) expect(semRequisicao(await reivindicar(pedido(sala, nome), { url: apiDoLimite.url, ip }))).toEqual(RECUSADA)
      const recusada = await reivindicar(pedido(sala, nome), { url: apiDoLimite.url, ip })
      expect(semRequisicao(recusada)).toEqual(erro(ErrorCode.LIMITE_EXCEDIDO, 429))
      expect(Number(recusada.retryAfter)).toBeGreaterThanOrEqual(1)
      expect(semRequisicao(await reivindicar(pedido(sala, await umNome(sala)), { url: apiDoLimite.url, ip: outro }))).toEqual(ENVIADO)
    })

    it('A6 e A7: o pedido, o reenvio, a recusa e o 404 não gravam registro de acesso nem cookie, e respondem no-store; a sessão e o cookie de quem chama não mudam a escola', async () => {
      const [a, b] = [await montar(), await montar()]
      const nome = await umNome(a)
      const ip = ipSorteado()
      const registros = async () =>
        (await bancada.pool.query<{ n: number }>('select count(*)::int as n from registro_acesso where ip = $1::inet or escola_id = any($2::uuid[])', [ip, [a.escolaId, b.escolaId]])).rows[0]?.n
      const antes = await registros()
      const deB = { Authorization: `Bearer ${b.coordenacao.token}`, Cookie: `educa_sessao=${randomBytes(32).toString('base64url')}` }
      const corpo = pedido(a, nome)
      const respostas = [
        await reivindicar(corpo, { ip, cabecalhos: deB }),
        await reivindicar(corpo, { ip }),
        await reivindicar(pedido(a, { id: randomUUID(), matricula: 'sala-sem-nome' }), { ip }),
        await reivindicar(pedido({ ...a, codigo: sortearCodigoDaTurma() }, nome), { ip }),
        await reivindicar({}, { ip }),
      ]
      expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200, 409, 404, 400])
      for (const resposta of respostas) {
        expect(resposta.cacheControl).toBe('no-store')
        expect(resposta.setCookie).toEqual([])
      }
      expect((await pedidosDa(a.escolaId)).map((linha) => linha.turma_id)).toEqual([a.turma])
      expect(await pedidosDa(b.escolaId)).toEqual([])
      expect(await registros()).toBe(antes)
    })
  })
})
