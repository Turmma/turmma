import { type PoolBanco } from '@educa/nucleo'
import { ErrorCode, salaAbertaResponseSchema, MENSAGENS_DE_ERRO } from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { POOL_BANCO } from '../src/banco.module.js'
import { sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import {
  ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS,
  JANELA_DOS_LIMITES_DA_SALA_MS,
  LimitesDaSala,
  PREFIXO_MATRICULA_ERRADA_POR_NOME,
  TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA,
  TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA,
  TETO_DE_MATRICULAS_ERRADAS_POR_NOME,
} from '../src/sala/limites-da-sala.js'
import { type BaldeDeLogin, ContadorEmJanela, HashDeSenha, JANELA_DO_CONTADOR_POR_IP_MS, SemaforoDeHash } from '../src/credencial/index.js'
import { subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { aguardar } from './gatilho-de-parada.js'
import { FerramentasDaSala, pedidoDaSala, semRequisicao, SENHA_DA_SALA, type NomeDaLista, type RespostaDaSala, type SalaDeTeste } from './sala-de-teste.js'
import { ipSorteado } from './segundo-fator-de-operador.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

/**
 * Os limites da página pública da sala (A1, tarefa 7.0; `tasks/prd-apresentacao-escola/cenarios.md`, seção L, e o I10):
 * código errado por escola (1.000 em 10 min; acima, a busca espera 1 s), matrícula errada por nome livre e acesso (5;
 * acima, `LIMITE_EXCEDIDO` só àquele nome) e hash sem pedido por turma (150; acima, o hash vai rebaixado). Nada disso é
 * por IP: 35 alunos do mesmo IP nunca recebem 429. Os contadores são lidos no Redis de fila pelas chaves que os limites
 * calculam. O L7 (Redis fora) e o log por janela estão também em `apps/api/src/sala/limites-da-sala.test.ts`; C1, C2, E21 e
 * E30 com os contadores, em `salas-reivindicar.int.test.ts`. Postgres e Redis reais do compose de teste.
 */

const AMBIENTE = { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' }

const erro = (codigo: ErrorCode, status: number) => ({ status, texto: JSON.stringify({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: '-' } }) })
const RECUSADA = erro(ErrorCode.REIVINDICACAO_RECUSADA, 409)
const LIMITE = erro(ErrorCode.LIMITE_EXCEDIDO, 429)
const NAO_ENCONTRADO = erro(ErrorCode.NAO_ENCONTRADO, 404)
const ENVIADO = { status: 200, texto: JSON.stringify({ resultado: 'enviado' }) }

/**
 * Quantos pedidos com hash vão juntos: o semáforo tem dois hashes por vez e 2 s de prazo, e 35 de uma vez numa máquina
 * carregada chegariam ao 503, que é outro cenário (L9).
 */
const LOTE_DE_HASHES = 10

/** Uma matrícula que não é de nome nenhum da lista. */
const matriculaErrada = () => `errada-${randomUUID().slice(0, 8)}`

/** Roda `tarefas` em lotes paralelos de `tamanho`, em ordem. */
async function emLotes<T>(quantas: number, tamanho: number, tarefa: (posicao: number) => Promise<T>): Promise<T[]> {
  const resultados: T[] = []
  for (let inicio = 0; inicio < quantas; inicio += tamanho) {
    resultados.push(...(await Promise.all(Array.from({ length: Math.min(tamanho, quantas - inicio) }, (_, posicao) => tarefa(inicio + posicao)))))
  }
  return resultados
}

describe('limites da sala (A1, tarefa 7.0): por escola, por nome e por turma, nunca por IP', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  /** Com o pool do banco no tamanho mínimo (L3). */
  let apiDoPool: ApiDeTeste
  let sala: FerramentasDaSala
  let hashes: MockInstance<HashDeSenha['gerar']>
  let gerarReal: HashDeSenha['gerar']

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: AMBIENTE }, linhasDeLog)
    apiDoPool = await subirApi(medidor.medidor, { ambiente: AMBIENTE, banco: { maximoConexoes: 1 } })
    sala = new FerramentasDaSala(api, bancada)
    const hash = api.app.get(HashDeSenha)
    gerarReal = hash.gerar.bind(hash)
    hashes = vi.spyOn(hash, 'gerar')
  })

  beforeEach(() => {
    hashes.mockClear()
    // Cada teste lê só as linhas de log dele; o filtro por `escolaId` continua como segunda proteção.
    linhasDeLog.length = 0
  })

  afterAll(async () => {
    await api.app.close()
    await apiDoPool.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** A soma de uma métrica da sala por um rótulo, somadas as duas APIs do arquivo (que dividem o medidor). */
  async function porRotulo(metrica: string, rotulo: string): Promise<Record<string, number>> {
    const soma: Record<string, number> = {}
    for (const { atributos, valor } of await medidor.pontos(metrica)) soma[String(atributos[rotulo])] = (soma[String(atributos[rotulo])] ?? 0) + (valor as number)
    return soma
  }

  /** O quanto cada tipo de `sala.limite_atingido` subiu durante `funcao`. */
  async function atingidosDurante(funcao: () => Promise<void>): Promise<Record<string, number>> {
    const antes = await porRotulo('sala.limite_atingido', 'tipo')
    await funcao()
    const depois = await porRotulo('sala.limite_atingido', 'tipo')
    return Object.fromEntries(['escola', 'nome', 'turma'].map((tipo) => [tipo, (depois[tipo] ?? 0) - (antes[tipo] ?? 0)]))
  }

  /** As linhas `sala.limite_atingido` do log, já lidas como JSON. */
  const linhasDoLimite = () => linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((linha) => linha['evento'] === 'sala.limite_atingido')

  /** Um pedido com matrícula errada no nome, pelo código da sala. */
  const errar = (de: SalaDeTeste, nome: NomeDaLista, extra: Record<string, unknown> = {}, ip?: string) =>
    sala.reivindicar(pedidoDaSala(de, nome, { matricula: matriculaErrada(), ...extra }), ip === undefined ? {} : { ip })

  describe('I10 e L4: o limite por nome só alcança o nome livre da turma do acesso', () => {
    it('I10: pelo acesso de T1, sete matrículas erradas num nome de T2, num de B e num UUID aleatório: 21 recusas idênticas e nenhuma chave de nome; num nome livre de T1, a 6ª e a 7ª travam', async () => {
      const [a, b] = [await sala.montar(), await sala.montar()]
      const acessoId = await sala.acessoVigente(a.turma)
      const deT1 = await sala.umNome(a)
      const deT2 = await sala.umNome(a, a.outraTurma)
      const deB = await sala.umNome(b)
      const aleatorio = { id: randomUUID(), nome: '-', matricula: 'sem-lista' }
      // Toda chave nasce de um `somar`, no Redis ou no seguro em memória: o espião vê as duas.
      const somadas: string[] = []
      const somarReal = ContadorEmJanela.prototype.somar
      const espiao = vi.spyOn(ContadorEmJanela.prototype, 'somar').mockImplementation(async function (this: ContadorEmJanela, chave) {
        somadas.push(chave)
        return somarReal.call(this, chave)
      })
      const respostas: Array<ReturnType<typeof semRequisicao>> = []
      try {
        for (const nome of [deT2, deB, aleatorio]) for (let vez = 0; vez < 7; vez++) respostas.push(semRequisicao(await errar(a, nome)))
      } finally {
        espiao.mockRestore()
      }
      expect(respostas).toHaveLength(21)
      expect(new Set(respostas.map((resposta) => JSON.stringify(resposta)))).toEqual(new Set([JSON.stringify(RECUSADA)]))
      for (const nome of [deT2, deB, aleatorio]) expect(await sala.existeContadorDoNome({ acessoId, listaNomeId: nome.id }), nome.id).toBe(false)
      // Só a turma contou: 21 hashes sem pedido, e nenhuma soma com o prefixo do nome.
      expect(somadas.filter((chave) => chave.startsWith(`${PREFIXO_MATRICULA_ERRADA_POR_NOME}:`))).toEqual([])
      expect(somadas.filter((chave) => chave === api.app.get(LimitesDaSala).chaveDaTurma(a.turma))).toHaveLength(21)

      const deT1Respostas: Array<ReturnType<typeof semRequisicao>> = []
      for (let vez = 0; vez < 7; vez++) deT1Respostas.push(semRequisicao(await errar(a, deT1)))
      expect(deT1Respostas).toEqual([RECUSADA, RECUSADA, RECUSADA, RECUSADA, RECUSADA, LIMITE, LIMITE])
    })

    it('L4: a 6ª matrícula errada no mesmo nome livre trava esse nome, também com a matrícula certa, com Retry-After; sai tipo="nome"; os outros 34 nomes da turma reivindicam', async () => {
      const a = await sala.montar()
      const nomes = await sala.nomes(a, a.turma, 35)
      const [alvo, ...outros] = nomes
      if (alvo === undefined) throw new Error('nomes não gravados')
      for (let vez = 0; vez < TETO_DE_MATRICULAS_ERRADAS_POR_NOME; vez++) expect(semRequisicao(await errar(a, alvo))).toEqual(RECUSADA)
      hashes.mockClear()
      let errada: RespostaDaSala | undefined
      let certa: RespostaDaSala | undefined
      const atingidos = await atingidosDurante(async () => {
        errada = await errar(a, alvo)
        certa = await sala.reivindicar(pedidoDaSala(a, alvo))
      })
      for (const resposta of [errada, certa]) {
        if (resposta === undefined) throw new Error('sem resposta')
        expect(semRequisicao(resposta)).toEqual(LIMITE)
        expect(Number(resposta.retryAfter)).toBeGreaterThan(JANELA_DOS_LIMITES_DA_SALA_MS / 1_000 - 120)
        expect(Number(resposta.retryAfter)).toBeLessThanOrEqual(JANELA_DOS_LIMITES_DA_SALA_MS / 1_000)
      }
      expect(atingidos).toEqual({ escola: 0, nome: 2, turma: 0 })
      // A linha do log do tipo nome, com o escolaId, sem o nome nem a matrícula (A4, com o logger da aplicação montada).
      const daEscola = linhasDoLimite().filter((linha) => linha['escolaId'] === a.escolaId)
      expect(daEscola).toEqual([expect.objectContaining({ evento: 'sala.limite_atingido', tipo: 'nome', escolaId: a.escolaId })])
      for (const proibido of [alvo.nome, alvo.matricula, a.codigo, a.slug]) expect(JSON.stringify(daEscola)).not.toContain(proibido)
      // O nome travado não roda o hash nem grava: continua livre.
      expect(hashes).not.toHaveBeenCalled()
      expect((await bancada.pool.query<{ estado: string }>('select estado from lista_nome where id = $1', [alvo.id])).rows[0]?.estado).toBe('livre')

      for (const resposta of await emLotes(outros.length, LOTE_DE_HASHES, (posicao) => sala.reivindicar(pedidoDaSala(a, outros[posicao] ?? alvo)))) {
        expect(semRequisicao(resposta)).toEqual(ENVIADO)
      }
      expect((await bancada.pool.query('select 1 from reivindicacao where escola_id = $1', [a.escolaId])).rowCount).toBe(34)
    })

    it('L4, em paralelo (regra 80, item 7): dez matrículas erradas ao mesmo tempo no mesmo nome livre dão cinco recusas e cinco LIMITE_EXCEDIDO, e só cinco hashes', async () => {
      const a = await sala.montar()
      const alvo = await sala.umNome(a)
      const acessoId = await sala.acessoVigente(a.turma)
      hashes.mockClear()
      const respostas = await Promise.all(Array.from({ length: 10 }, () => errar(a, alvo)))
      const corpos = respostas.map((resposta) => JSON.stringify(semRequisicao(resposta)))
      expect(corpos.filter((corpo) => corpo === JSON.stringify(RECUSADA))).toHaveLength(TETO_DE_MATRICULAS_ERRADAS_POR_NOME)
      expect(corpos.filter((corpo) => corpo === JSON.stringify(LIMITE))).toHaveLength(10 - TETO_DE_MATRICULAS_ERRADAS_POR_NOME)
      expect(hashes).toHaveBeenCalledTimes(TETO_DE_MATRICULAS_ERRADAS_POR_NOME)
      // As seguradas também somaram no nome (a soma vem antes da decisão), e a matrícula certa, depois, continua travada. É
      // esta asserção do 10, e não a divisão 5 e 5, que pega o "lê e depois soma" aqui: no Redis local os pedidos acabam
      // em sequência, e a atomicidade de verdade está no teste de unidade "nome, em paralelo".
      expect((await sala.contadores(a, a.turma, { acessoId, listaNomeId: alvo.id })).nome).toBe(10)
      expect(semRequisicao(await sala.reivindicar(pedidoDaSala(a, alvo)))).toEqual(LIMITE)
    })

    it('E30, em paralelo: a matrícula certa, com o hash dela em andamento enquanto três erradas chegam ao mesmo nome, grava teve_matricula_errada em true: a marca é lida depois do hash', async () => {
      const a = await sala.montar()
      const alvo = await sala.umNome(a)
      const acessoId = await sala.acessoVigente(a.turma)
      const senhaDaCerta = `${SENHA_DA_SALA}-certa`
      let soltar: () => void = () => undefined
      const portao = new Promise<void>((resolver) => (soltar = resolver))
      // O hash da certa fica parado até o teste soltar: ela já passou pelos limites, sem errada nenhuma no nome.
      hashes.mockImplementation(async (senha) => {
        if (senha === senhaDaCerta) await portao
        return gerarReal(senha)
      })
      try {
        const certa = sala.reivindicar(pedidoDaSala(a, alvo, { senha: senhaDaCerta }))
        await vi.waitFor(() => expect(hashes).toHaveBeenCalledWith(senhaDaCerta))
        const erradas = await Promise.all([errar(a, alvo), errar(a, alvo), errar(a, alvo)])
        for (const resposta of erradas) expect(semRequisicao(resposta)).toEqual(RECUSADA)
        expect((await sala.contadores(a, a.turma, { acessoId, listaNomeId: alvo.id })).nome).toBe(3)
        soltar()
        expect(semRequisicao(await certa)).toEqual(ENVIADO)
      } finally {
        soltar()
        hashes.mockImplementation(gerarReal)
      }
      const { rows } = await bancada.pool.query<{ teve_matricula_errada: boolean }>('select teve_matricula_errada from reivindicacao where escola_id = $1', [a.escolaId])
      expect(rows).toEqual([{ teve_matricula_errada: true }])
    })

    it('L4b: o ator trava os 35 nomes com o código X; com X, os 35 recebem LIMITE_EXCEDIDO com a matrícula certa; o professor gera Y, e os 35 reivindicam com Y', async () => {
      const a = await sala.montar()
      const nomes = await sala.nomes(a, a.turma, 35)
      await emLotes(nomes.length * TETO_DE_MATRICULAS_ERRADAS_POR_NOME, LOTE_DE_HASHES, async (posicao) => {
        const nome = nomes[posicao % nomes.length]
        if (nome === undefined) throw new Error('sem nome')
        expect(semRequisicao(await errar(a, nome))).toEqual(RECUSADA)
      })
      for (const resposta of await Promise.all(nomes.map((nome) => sala.reivindicar(pedidoDaSala(a, nome))))) expect(semRequisicao(resposta)).toEqual(LIMITE)

      const y = await sala.gerar(a, a.turma)
      const comY = { ...a, ...y }
      const comCodigoY = await emLotes(nomes.length, LOTE_DE_HASHES, (posicao) => {
        const nome = nomes[posicao]
        if (nome === undefined) throw new Error('sem nome')
        return sala.reivindicar(pedidoDaSala(comY, nome))
      })
      for (const resposta of comCodigoY) expect(semRequisicao(resposta)).toEqual(ENVIADO)
      const { rows } = await bancada.pool.query<{ estado: string; teve_matricula_errada: boolean }>('select estado, teve_matricula_errada from reivindicacao where escola_id = $1', [a.escolaId])
      expect(rows).toHaveLength(35)
      // O contador de X não marca os pedidos feitos por Y (E30, a parte do "Gerar novo").
      for (const linha of rows) expect(linha).toEqual({ estado: 'pendente', teve_matricula_errada: false })
    })
  })

  describe('L1 e L2: o mesmo IP e o mesmo cliente não são limite', () => {
    it('L1: 35 alunos do mesmo IP, de navegadores diferentes, na mesma turma e no mesmo minuto, com um erro de matrícula cada: nenhum 429, e os 35 pendentes', async () => {
      const a = await sala.montar()
      const nomes = await sala.nomes(a, a.turma, 35)
      const ip = ipSorteado()
      const navegador = () => ({ Cookie: `educa_dispositivo=${randomBytes(16).toString('base64url')}` })
      const doNome = (posicao: number) => {
        const nome = nomes[posicao]
        if (nome === undefined) throw new Error('sem nome')
        return nome
      }
      const erradas = await emLotes(nomes.length, LOTE_DE_HASHES, (posicao) => sala.reivindicar(pedidoDaSala(a, doNome(posicao), { matricula: matriculaErrada() }), { ip, cabecalhos: navegador() }))
      const certas = await emLotes(nomes.length, LOTE_DE_HASHES, (posicao) => sala.reivindicar(pedidoDaSala(a, doNome(posicao)), { ip, cabecalhos: navegador() }))
      for (const resposta of erradas) expect(semRequisicao(resposta)).toEqual(RECUSADA)
      for (const resposta of certas) expect(semRequisicao(resposta)).toEqual(ENVIADO)
      expect((await bancada.pool.query('select 1 from reivindicacao where escola_id = $1 and estado = $2', [a.escolaId, 'pendente'])).rowCount).toBe(35)
    })

    it('L2: 100 códigos errados do mesmo cliente, abaixo do teto da escola: o código certo abre sem espera nem 429; a conta é da escola (a chave do escolaId), e o cookie não entra nela', async () => {
      const a = await sala.montar()
      const ip = ipSorteado()
      const cookie = { Cookie: `educa_dispositivo=${randomBytes(16).toString('base64url')}` }
      const atingidos = await atingidosDurante(async () => {
        for (const resposta of await emLotes(100, 20, () => sala.abrir({ slug: a.slug, codigo: sortearCodigoDaTurma() }, { ip, cabecalhos: cookie }))) {
          expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
          expect(resposta.setCookie).toEqual([])
        }
        const inicio = performance.now()
        const certa = await sala.abrir({ slug: a.slug, codigo: a.codigo }, { ip, cabecalhos: cookie })
        expect(certa.status).toBe(200)
        expect(performance.now() - inicio).toBeLessThan(ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS)
      })
      expect(atingidos).toEqual({ escola: 0, nome: 0, turma: 0 })
      // A conta está só na chave do escolaId: o mesmo número, contado por outro cookie, soma na mesma.
      expect((await sala.contadores(a, a.turma)).escola).toBe(100)
      await sala.abrir({ slug: a.slug, codigo: sortearCodigoDaTurma() }, { ip: ipSorteado(), cabecalhos: { Cookie: `educa_dispositivo=${randomBytes(16).toString('base64url')}` } })
      expect((await sala.contadores(a, a.turma)).escola).toBe(101)
    })
  })

  describe('L3: acima do teto da escola, o código só atrasa, sem conexão presa', () => {
    it('1.000 códigos errados: o certo abre depois de 1 s, sai tipo="escola" e uma linha de log com o escolaId; a escola B, do mesmo IP, abre sem espera; o link não espera', async () => {
      const [a, b] = [await sala.montar(), await sala.montar()]
      const [, , reivindicado] = await sala.nomes(a, a.turma, 3)
      if (reivindicado === undefined) throw new Error('nomes não gravados')
      await emLotes(TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA, 50, async () => {
        expect(semRequisicao(await sala.abrir({ slug: a.slug, codigo: sortearCodigoDaTurma() }))).toEqual(NAO_ENCONTRADO)
      })
      expect((await sala.contadores(a, a.turma)).escola).toBe(TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA)
      linhasDeLog.length = 0
      const ip = ipSorteado()

      const atingidos = await atingidosDurante(async () => {
        for (let vez = 0; vez < 2; vez++) {
          const inicio = performance.now()
          const certa = await sala.abrir({ slug: a.slug, codigo: a.codigo }, { ip })
          expect(performance.now() - inicio).toBeGreaterThanOrEqual(ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS - 20)
          expect(certa.status).toBe(200)
          expect(salaAbertaResponseSchema.parse(JSON.parse(certa.texto)).nomes).toHaveLength(3)
        }
        // A reivindicação pelo código passa pela mesma espera, e segue.
        const inicio = performance.now()
        expect(semRequisicao(await sala.reivindicar(pedidoDaSala(a, reivindicado), { ip }))).toEqual(ENVIADO)
        expect(performance.now() - inicio).toBeGreaterThanOrEqual(ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS - 20)

        for (const [caso, corpo] of [
          ['B pelo código, do mesmo IP', { slug: b.slug, codigo: b.codigo }],
          ['A pelo link', { slug: a.slug, token: a.token }],
        ] as const) {
          const semEspera = performance.now()
          expect((await sala.abrir(corpo, { ip })).status, caso).toBe(200)
          expect(performance.now() - semEspera, caso).toBeLessThan(ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS)
        }
      })
      expect(atingidos).toEqual({ escola: 3, nome: 0, turma: 0 })
      // Uma linha só, na janela, com o evento, o tipo e a escola: nada de IP, código, slug, matrícula nem nome.
      const linhas = linhasDoLimite()
      expect(linhas).toHaveLength(1)
      expect(linhas[0]).toMatchObject({ evento: 'sala.limite_atingido', tipo: 'escola', escolaId: a.escolaId, level: 'warn' })
      const texto = JSON.stringify(linhas)
      for (const proibido of [ip, a.codigo, a.slug, a.token, SENHA_DA_SALA, reivindicado.nome, reivindicado.matricula]) expect(texto).not.toContain(proibido)
    })

    it('com o pool no tamanho mínimo e 50 aberturas pelo código esperando o 1 s, nenhuma conexão fica presa, e uma leitura de outra rota não espera', async () => {
      const [a, b] = [await sala.montar(), await sala.montar()]
      await emLotes(TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA, 50, () => sala.abrir({ slug: a.slug, codigo: sortearCodigoDaTurma() }))
      expect((await sala.contadores(a, a.turma)).escola).toBe(TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA)
      const limites = apiDoPool.app.get(LimitesDaSala)
      const pool = apiDoPool.app.get<PoolBanco>(POOL_BANCO, { strict: false })
      expect(pool.options.max).toBe(1)

      const esperando = Array.from({ length: 50 }, () => sala.abrir({ slug: a.slug, codigo: a.codigo }, { url: apiDoPool.url }))
      await aguardar(async () => limites.esperandoOCodigo === 50, 'as 50 aberturas na espera de 1 s')
      expect(pool.totalCount - pool.idleCount).toBe(0)
      const inicio = performance.now()
      expect((await sala.abrir({ slug: b.slug, token: b.token }, { url: apiDoPool.url })).status).toBe(200)
      expect(performance.now() - inicio).toBeLessThan(ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS / 2)
      for (const resposta of await Promise.all(esperando)) expect(resposta.status).toBe(200)
    }, 60_000)
  })

  describe('L5, L6 e L6b: o teto da turma rebaixa e nunca recusa; quem conta em cada contador', () => {
    it('L5: 151 matrículas erradas espalhadas por 38 nomes (nenhum passa de 4): ninguém recebe 429, e o espião do semáforo vê o 151º em diante rebaixado', async () => {
      const a = await sala.montar()
      const nomes = await sala.nomes(a, a.turma, 38)
      const semaforo = api.app.get(SemaforoDeHash)
      const baldes: BaldeDeLogin[] = []
      const executarReal = semaforo.executar.bind(semaforo)
      const espiao = vi.spyOn(semaforo, 'executar').mockImplementation(async (balde, tarefa) => {
        baldes.push(balde)
        return executarReal(balde, tarefa)
      })
      try {
        const atingidos = await atingidosDurante(async () => {
          for (let vez = 0; vez < TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA + 1; vez++) {
            const nome = nomes[vez % nomes.length]
            if (nome === undefined) throw new Error('sem nome')
            expect(semRequisicao(await errar(a, nome))).toEqual(RECUSADA)
          }
        })
        expect(atingidos).toEqual({ escola: 0, nome: 0, turma: 1 })
        const daEscola = linhasDoLimite().filter((linha) => linha['escolaId'] === a.escolaId)
        expect(daEscola).toEqual([expect.objectContaining({ evento: 'sala.limite_atingido', tipo: 'turma', escolaId: a.escolaId })])
        for (const proibido of [...nomes.flatMap((nome) => [nome.nome, nome.matricula]), a.codigo, a.slug]) expect(JSON.stringify(daEscola)).not.toContain(proibido)
        // O pedido certo, depois do teto, também vai rebaixado, e grava: rebaixar nunca recusa.
        const [ultimo] = nomes.slice(-1)
        if (ultimo === undefined) throw new Error('sem nome')
        expect(semRequisicao(await sala.reivindicar(pedidoDaSala(a, ultimo)))).toEqual(ENVIADO)
      } finally {
        espiao.mockRestore()
      }
      const rebaixados = baldes.map((balde) => balde.rebaixado)
      expect(rebaixados).toEqual([...Array<boolean>(TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA).fill(false), true, true])
      for (const balde of baldes) expect(balde.id).toBe(a.escolaId)
      expect((await sala.contadores(a, a.turma)).turma).toBe(TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA + 1)
    }, 60_000)

    it('L6: o que cada caso faz com cada contador, lido no Redis', async () => {
      const [a, b] = [await sala.montar(), await sala.montar()]
      const acessoId = await sala.acessoVigente(a.turma)
      const [livre, tomado, criado, paralelo] = await sala.nomes(a, a.turma, 4)
      if (livre === undefined || tomado === undefined || criado === undefined || paralelo === undefined) throw new Error('nomes não gravados')
      const deT2 = await sala.umNome(a, a.outraTurma)
      const deB = await sala.umNome(b)
      expect(semRequisicao(await sala.reivindicar(pedidoDaSala(a, tomado)))).toEqual(ENVIADO)
      const contadores = (nome: NomeDaLista = livre) => sala.contadores(a, a.turma, { acessoId, listaNomeId: nome.id })
      const efeito = async (acao: () => Promise<unknown>, nome?: NomeDaLista) => {
        const antes = await contadores(nome)
        await acao()
        const depois = await contadores(nome)
        return { escola: depois.escola - antes.escola, turma: depois.turma - antes.turma, nome: depois.nome - antes.nome }
      }

      expect(await efeito(() => errar(a, livre))).toEqual({ escola: 0, turma: 1, nome: 1 })
      const casos: ReadonlyArray<readonly [string, NomeDaLista]> = [
        ['nome inexistente', { id: randomUUID(), nome: '-', matricula: 'sem-lista' }],
        ['nome de outra turma', deT2],
        ['nome de outra escola', deB],
        ['nome tomado', tomado],
      ]
      for (const [caso, nome] of casos) {
        expect(await efeito(() => errar(a, nome), nome), caso).toEqual({ escola: 0, turma: 1, nome: 0 })
        expect(await efeito(() => sala.reivindicar(pedidoDaSala(a, nome)), nome), `${caso}, matrícula certa`).toEqual({ escola: 0, turma: 1, nome: 0 })
      }
      // O reenvio com a mesma chave de um pedido criado não soma em nenhum; o pedido criado também não.
      const corpo = pedidoDaSala(a, criado)
      expect(await efeito(() => sala.reivindicar(corpo), criado)).toEqual({ escola: 0, turma: 0, nome: 0 })
      expect(await efeito(() => sala.reivindicar(corpo), criado)).toEqual({ escola: 0, turma: 0, nome: 0 })
      // O reenvio em paralelo de uma matrícula errada soma duas vezes no nome: a chave não fica gravada no erro (aceito).
      const errado = pedidoDaSala(a, paralelo, { matricula: matriculaErrada() })
      expect(await efeito(() => Promise.all([sala.reivindicar(errado), sala.reivindicar(errado)]), paralelo)).toEqual({ escola: 0, turma: 2, nome: 2 })
      // A chave de um pedido de T1, enviada pelo acesso de T2 com a matrícula certa do nome de T2 (E21): só a turma de T2.
      const deT2Acesso = await sala.gerar(a, a.outraTurma)
      const antesDeT2 = await sala.contadores(a, a.outraTurma, { acessoId: await sala.acessoVigente(a.outraTurma), listaNomeId: deT2.id })
      expect(semRequisicao(await sala.reivindicar({ ...pedidoDaSala({ ...a, ...deT2Acesso }, deT2), chaveEnvio: corpo.chaveEnvio }))).toEqual(RECUSADA)
      const depoisDeT2 = await sala.contadores(a, a.outraTurma, { acessoId: await sala.acessoVigente(a.outraTurma), listaNomeId: deT2.id })
      expect({ turma: depoisDeT2.turma - antesDeT2.turma, nome: depoisDeT2.nome - antesDeT2.nome, escola: depoisDeT2.escola - antesDeT2.escola }).toEqual({ turma: 1, nome: 0, escola: 0 })
      // O código errado soma só na escola.
      expect(await efeito(() => sala.abrir({ slug: a.slug, codigo: sortearCodigoDaTurma() }))).toEqual({ escola: 1, turma: 0, nome: 0 })
      expect(await efeito(() => errar({ ...a, codigo: sortearCodigoDaTurma() }, livre))).toEqual({ escola: 1, turma: 0, nome: 0 })
      // O link errado e o slug inexistente não somam em nada.
      expect(await efeito(() => sala.abrir({ slug: a.slug, token: randomBytes(32).toString('base64url') }))).toEqual({ escola: 0, turma: 0, nome: 0 })
      expect(await efeito(() => sala.abrir({ slug: `nao-existe-${randomUUID().slice(0, 8)}`, codigo: a.codigo }))).toEqual({ escola: 0, turma: 0, nome: 0 })

      // L8, pela aplicação montada: a chave da sala vale 10 min, e o contador do login continua com o minuto.
      const prazo = await sala.redis().pttl(api.app.get(LimitesDaSala).chaveDaTurma(a.turma))
      expect(prazo).toBeGreaterThan(JANELA_DO_CONTADOR_POR_IP_MS)
      expect(prazo).toBeLessThanOrEqual(JANELA_DOS_LIMITES_DA_SALA_MS)
      expect(api.app.get(ContadorEmJanela).janelaMs).toBe(JANELA_DO_CONTADOR_POR_IP_MS)
    })

    it('sala.reivindicacao{resultado}: um ponto por pedido, só com o resultado', async () => {
      const a = await sala.montar()
      const [certo, travado] = await sala.nomes(a, a.turma, 2)
      if (certo === undefined || travado === undefined) throw new Error('nomes não gravados')
      const antes = await porRotulo('sala.reivindicacao', 'resultado')
      const corpo = pedidoDaSala(a, certo)
      await sala.reivindicar(corpo)
      await sala.reivindicar(corpo)
      for (let vez = 0; vez < TETO_DE_MATRICULAS_ERRADAS_POR_NOME + 1; vez++) await errar(a, travado)
      await sala.reivindicar(pedidoDaSala({ ...a, codigo: sortearCodigoDaTurma() }, travado))
      const depois = await porRotulo('sala.reivindicacao', 'resultado')
      const delta = Object.fromEntries(Object.entries(depois).map(([resultado, valor]) => [resultado, valor - (antes[resultado] ?? 0)]).filter(([, valor]) => valor !== 0))
      expect(delta).toEqual({ enviado: 1, reenvio: 1, recusada: TETO_DE_MATRICULAS_ERRADAS_POR_NOME, limite: 1, sem_acesso: 1 })
      for (const { atributos } of await medidor.pontos('sala.reivindicacao')) expect(Object.keys(atributos)).toEqual(['resultado'])
      for (const { atributos } of await medidor.pontos('sala.limite_atingido')) expect(Object.keys(atributos)).toEqual(['tipo'])
    })

    it('L6b: um nome tomado repetido 200 vezes com matrículas quaisquer: todas recusadas, nenhum contador de nome, do 151º em diante rebaixado; com o semáforo cheio desses pedidos, 30 logins da escola entram, nenhum com 503', async () => {
      const a = await sala.montar()
      const acessoId = await sala.acessoVigente(a.turma)
      const [tomado, outro] = await sala.nomes(a, a.turma, 2)
      if (tomado === undefined || outro === undefined) throw new Error('nomes não gravados')
      expect(semRequisicao(await sala.reivindicar(pedidoDaSala(a, tomado)))).toEqual(ENVIADO)
      const semaforo = api.app.get(SemaforoDeHash)
      const baldes: BaldeDeLogin[] = []
      const executarReal = semaforo.executar.bind(semaforo)
      const espiao = vi.spyOn(semaforo, 'executar').mockImplementation(async (balde, tarefa) => {
        baldes.push(balde)
        return executarReal(balde, tarefa)
      })
      const matriculas = Array.from({ length: 30 }, (_, posicao) => `sala-login-${randomUUID().slice(0, 8)}-${String(posicao)}`)
      const hashDoLogin = await gerarReal(SENHA_DA_SALA)
      await bancada.alunosComMatricula(a.escolaId, matriculas.map((matricula) => ({ matricula, senhaHash: hashDoLogin })))
      try {
        for (let vez = 0; vez < 200; vez++) expect(semRequisicao(await errar(a, tomado))).toEqual(RECUSADA)
        expect(await sala.existeContadorDoNome({ acessoId, listaNomeId: tomado.id })).toBe(false)
        expect(baldes.map((balde) => balde.rebaixado)).toEqual([...Array<boolean>(TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA).fill(false), ...Array<boolean>(200 - TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA).fill(true)])

        // O semáforo cheio: os dois hashes da vez presos em pedidos rebaixados, e dez deles esperando atrás.
        const soltar: Array<() => void> = []
        for (let vez = 0; vez < 2; vez++) {
          const portao = new Promise<void>((resolver) => soltar.push(resolver))
          hashes.mockImplementationOnce(async (senha) => {
            await portao
            return gerarReal(senha)
          })
        }
        const rebaixados = Array.from({ length: 12 }, () => errar(a, tomado))
        await aguardar(async () => semaforo.emUso === 2 && semaforo.esperando === 10, 'dois pedidos rebaixados no hash e dez esperando')
        const logins = matriculas.map((matricula) =>
          fetch(`${api.url}/v1/sessao/matricula`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ipSorteado() },
            body: JSON.stringify({ slug: a.slug, matricula, senha: SENHA_DA_SALA }),
          }),
        )
        await aguardar(async () => semaforo.esperando === 40, 'os 30 logins na fila, com os dez rebaixados')
        for (const libera of soltar) libera()
        expect((await Promise.all(logins)).map((resposta) => resposta.status)).toEqual(Array<number>(30).fill(200))
        for (const resposta of await Promise.all(rebaixados)) expect([409, 503]).toContain(resposta.status)
      } finally {
        espiao.mockRestore()
        hashes.mockImplementation(gerarReal)
      }
    }, 90_000)
  })
})
