import { acessoGeradoResponseSchema } from '@educa/shared'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'
import { SalaRateLimits, type NomePeloAcesso } from '../src/sala/sala-rate-limits.js'
import { REDIS_LOGIN_CLIENT } from '../src/credencial/index.js'
import { chamar, type TestApi } from './test-api.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { ipSorteado } from './operador-mfa.fixture.js'
import type { SessaoFixtures, TestSessao } from './sessao.fixture.js'

/**
 * A montagem da página pública da sala nos testes dos limites (A1, tarefa 7.0): a escola com o professor confirmado nas
 * duas turmas e o acesso vigente da `turma`, os nomes da lista, o corpo do pedido e a leitura dos contadores no Redis.
 * Nomes e matrículas são gerados pelo teste (regra 20, item 17). Cada pedido sai de um IP sorteado, salvo o que o teste
 * fixa: o `rl:ip` anônimo fica no Redis entre os testes.
 */

/** A senha que o aluno cria, com os 12 caracteres da senha nova: nunca vai a log nem a resposta. */
export const SENHA_DA_SALA = 'senha-sintetica-da-sala-1'

/** Um nome da lista, com a matrícula dele. */
export interface NomeDaLista {
  readonly id: string
  readonly nome: string
  readonly matricula: string
}

/** Uma escola com o professor confirmado nas duas turmas e o acesso vigente da `turma`. */
export interface TestSala extends EscolaComTurma {
  readonly escolaId: string
  readonly slug: string
  readonly professor: TestSessao
  readonly token: string
  readonly codigo: string
}

/** A resposta crua: o texto do corpo, para comparar byte a byte, e os cabeçalhos que a regra olha. */
export interface RespostaDaSala {
  readonly status: number
  readonly texto: string
  readonly retryAfter: string | null
  readonly setCookie: string[]
}

export interface SalaRequestOptions {
  readonly url?: string
  readonly ip?: string
  readonly cabecalhos?: Record<string, string>
}

/** O texto do corpo sem o valor do `requisicaoId`, que muda a cada chamada. */
export const semRequisicao = (resposta: RespostaDaSala) => ({ status: resposta.status, texto: resposta.texto.replace(/"requisicaoId":"[^"]*"/, '"requisicaoId":"-"') })

/** Os três contadores de uma sala, lidos no Redis de fila pelas chaves que os limites calculam. */
export interface ContadoresDaSala {
  readonly escola: number
  readonly turma: number
  readonly nome: number
}

export class FerramentasDaSala {
  constructor(
    private readonly api: TestApi,
    private readonly bancada: SessaoFixtures,
  ) {}

  /** `POST /v1/salas/<rota>` sem token, como a página pública, de um IP sorteado (ou do dado). */
  async chamarSala(rota: 'abrir' | 'reivindicar', corpo: unknown, { url = this.api.url, ip = ipSorteado(), cabecalhos = {} }: SalaRequestOptions = {}): Promise<RespostaDaSala> {
    const resposta = await fetch(`${url}/v1/salas/${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...cabecalhos },
      body: JSON.stringify(corpo),
    })
    return { status: resposta.status, texto: await resposta.text(), retryAfter: resposta.headers.get('retry-after'), setCookie: resposta.headers.getSetCookie() }
  }

  reivindicar(corpo: unknown, opcoes: SalaRequestOptions = {}): Promise<RespostaDaSala> {
    return this.chamarSala('reivindicar', corpo, opcoes)
  }

  abrir(corpo: unknown, opcoes: SalaRequestOptions = {}): Promise<RespostaDaSala> {
    return this.chamarSala('abrir', corpo, opcoes)
  }

  /** O professor gera o acesso da turma: o link e o código novos, e o anterior revogado ("Gerar novo"). */
  async gerar(sala: Pick<TestSala, 'professor'>, turmaId: string): Promise<{ token: string; codigo: string }> {
    const gerado = await chamar(this.api.url, 'POST', `/v1/turmas/${turmaId}/acesso`, sala.professor.token, { validadeDias: 7 })
    expect(gerado.status).toBe(201)
    const { token, codigo } = acessoGeradoResponseSchema.parse(gerado.corpo)
    return { token, codigo }
  }

  async montar(): Promise<TestSala> {
    const escola = await montarEscolaComTurma(this.api, this.bancada)
    const escolaId = escola.coordenacao.escolaId
    const professor = await this.bancada.sessao(escolaId, 'professor')
    for (const turmaId of [escola.turma, escola.outraTurma]) {
      const vinculo = await chamar(this.api.url, 'POST', '/v1/vinculos', escola.coordenacao.token, { usuarioId: professor.usuarioId, turmaId, disciplinaId: escola.quimica, papel: 'professor' })
      expect(vinculo.status).toBe(201)
      expect((await chamar(this.api.url, 'POST', `/v1/vinculos/${vinculo.corpo['id'] as string}/confirmar`, professor.token)).status).toBe(200)
    }
    const acesso = await this.gerar({ professor }, escola.turma)
    return { ...escola, escolaId, slug: await this.bancada.slugDe(escolaId), professor, ...acesso }
  }

  /** Grava `quantos` nomes na lista da turma pela coordenação, com nomes e matrículas gerados, e os devolve. */
  async nomes(sala: TestSala, turmaId: string, quantos: number): Promise<NomeDaLista[]> {
    const sufixo = randomUUID().slice(0, 8)
    const linhas = Array.from({ length: quantos }, (_, posicao) => ({ nome: `Aluno ${String(posicao + 1)} ${sufixo}`, matricula: `sala-${sufixo}-${String(posicao + 1)}` }))
    const gravada = await chamar(this.api.url, 'POST', `/v1/turmas/${turmaId}/lista`, sala.coordenacao.token, { texto: linhas.map((linha) => `${linha.nome};${linha.matricula}`).join('\n') })
    expect(gravada.status).toBe(201)
    const { rows } = await this.bancada.pool.query<{ id: string; matricula: string }>('select id, matricula from lista_nome where escola_id = $1 and turma_id = $2', [sala.escolaId, turmaId])
    return linhas.map((linha) => {
      const id = rows.find((gravado) => gravado.matricula === linha.matricula)?.id
      if (id === undefined) throw new Error('nome da lista não gravado')
      return { id, ...linha }
    })
  }

  async umNome(sala: TestSala, turmaId = sala.turma): Promise<NomeDaLista> {
    const [nome] = await this.nomes(sala, turmaId, 1)
    if (nome === undefined) throw new Error('nome não gravado')
    return nome
  }

  /** O id do acesso vigente da turma: é ele que entra na chave do contador do nome. */
  async acessoVigente(turmaId: string): Promise<string> {
    const { rows } = await this.bancada.pool.query<{ id: string }>('select id from acesso_turma where turma_id = $1 and revogado_em is null', [turmaId])
    const [linha] = rows
    if (linha === undefined || rows.length !== 1) throw new Error('a turma não tem um acesso vigente só')
    return linha.id
  }

  /** Os contadores da escola, da turma e do nome (pelo acesso vigente da turma), no Redis de fila; 0 quando a chave não existe. */
  async contadores(sala: Pick<TestSala, 'escolaId'>, turmaId: string, nome?: NomePeloAcesso): Promise<ContadoresDaSala> {
    const limites = this.api.app.get(SalaRateLimits)
    const ler = async (chave: string) => Number((await this.redis().get(chave)) ?? 0)
    return {
      escola: await ler(limites.chaveDaEscola(sala.escolaId)),
      turma: await ler(limites.chaveDaTurma(turmaId)),
      nome: nome === undefined ? 0 : await ler(limites.chaveDoNome(nome)),
    }
  }

  /** Se a chave do contador do nome existe no Redis de fila. */
  async existeContadorDoNome(nome: NomePeloAcesso): Promise<boolean> {
    return (await this.redis().exists(this.api.app.get(SalaRateLimits).chaveDoNome(nome))) === 1
  }

  redis(): Redis {
    return this.api.app.get<Redis>(REDIS_LOGIN_CLIENT, { strict: false })
  }
}

/** O corpo do pedido pelo código (ou pelo link) da sala, com o nome e a matrícula dele e uma chave nova. */
export function pedidoDaSala(
  sala: Pick<TestSala, 'slug' | 'codigo' | 'token'>,
  nome: Pick<NomeDaLista, 'id' | 'matricula'>,
  extra: Record<string, unknown> = {},
  caminho: 'codigo' | 'token' = 'codigo',
) {
  const pelo = caminho === 'codigo' ? { codigo: sala.codigo } : { token: sala.token }
  return { slug: sala.slug, ...pelo, listaNomeId: nome.id, matricula: nome.matricula, senha: SENHA_DA_SALA, chaveEnvio: randomUUID(), ...extra }
}
