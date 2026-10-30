import { createDatabase, createPool, DURACAO_DA_SESSAO_HORAS, runInContext, type Database, type DatabasePool } from '@educa/nucleo'
import type { PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { criarEscola, criarRede } from '../src/operacao/escola/escola.js'
import { CriacaoDeSessaoRepository } from '../src/credencial/index.js'
import { type AlunoComMatriculaSintetico, criarAlunosComMatricula, criarSessoesSinteticas, emissorDeTokenSintetico, NOME_SINTETICO } from '../src/sessao/index.js'

/** O operador que os testes gravam na auditoria da rede e da escola que criam. */
export const OPERADOR_DE_TESTE = 'teste-integracao'

/**
 * O autor da rede e da escola que a bancada cria: fixo, sem conferir operador ativo. A bancada não é o comando nem o
 * painel, e os testes que criam operador ativo também criam escola por ela.
 */
export const autorDaBancada = async (): Promise<string> => OPERADOR_DE_TESTE

export interface SessaoDeTeste {
  readonly escolaId: string
  readonly usuarioId: string
  readonly sessaoId: string
  /** Token de acesso emitido na criação: vale 10 min. Teste mais longo pede outro a `tokenNovo`. */
  readonly token: string
  /** Um token novo da mesma sessão, pelo `TokenIssuer`. */
  tokenNovo(): Promise<string>
  /** Um token desta sessão emitido em outro instante, para o caso do token já vencido. */
  tokenEm(agora: Date): Promise<string>
}

export interface OpcoesDeSessao {
  papel?: PapelDeUsuario
  quantidade?: number
}

/**
 * Escola e sessão reais para os testes que chamam a API autenticada, pelos mesmos serviços de `ops:escola` e de
 * `ops:sessao-sintetica`, no Postgres do compose de teste. A `SessaoGuard` lê a sessão gravada: token sem sessão
 * não passa. Nada de pessoa: nomes fixos e sintéticos.
 */
/**
 * As tabelas do MVP de apresentação, na ordem em que a limpeza as esvazia: primeiro o que aponta, depois o que é
 * apontado (a validação e a correção antes da entrega; a entrega e a conversa do Tutor antes da atividade aplicada;
 * tudo que guarda `execucao_id` antes da execução; o trecho antes do material). Tabela nova do MVP entra aqui, ou o
 * `fechar` quebra na FK da turma.
 */
export const TABELAS_DO_MVP_NA_ORDEM_DE_LIMPEZA = [
  'validacao_do_lote',
  'correcao',
  'resposta_atividade',
  'tentativa_atividade',
  'sinal_tutor',
  'mensagem_tutor',
  'entrega',
  'atividade_aplicada',
  'mensagem_agente',
  'thread_agente',
  'resumo_do_analista',
  'consumo_ia',
  'artefato',
  'execucao_agente',
  'trecho',
  'material',
  'suspensao_de_funcao',
] as const

export class BancadaDeSessoes {
  readonly pool: DatabasePool
  readonly banco: Database
  readonly #ambiente: Record<string, string | undefined>
  readonly #escolas: string[] = []

  constructor(url = urlDoBancoDeTeste(), ambiente: Record<string, string | undefined> = lerAmbienteDeTeste()) {
    this.pool = createPool({ url, maximoConexoes: 2, timeoutConexaoMs: 5_000, timeoutConsultaMs: 30_000 }, () => undefined)
    this.banco = createDatabase(this.pool)
    this.#ambiente = ambiente
  }

  /**
   * Uma rede independente e uma escola nova nela, com endereço sorteado. O id é sorteado (UUID v4), como o `ops:escola`
   * e o painel fazem: não cresce com a criação, e teste nenhum supõe ordem entre escolas. `nome` é para o teste que
   * procura a escola numa página da lista do painel.
   */
  async escola(nome = 'Escola sintética de teste'): Promise<string> {
    const { id: redeId } = await criarRede(this.banco, autorDaBancada, { id: randomUUID(), nome: 'Rede sintética de teste', tipo: 'independente' })
    const { id: escolaId } = await criarEscola(this.banco, autorDaBancada, { id: randomUUID(), redeId, nome, slug: `teste-${randomUUID()}` })
    this.#escolas.push(escolaId)
    return escolaId
  }

  /**
   * Uma rede municipal com `quantidade` escolas, saindo pela internet pelos IPs de `ipsDeSaida` (`rede.ips_saida`, que no
   * F1 só se grava por comando ou seed: a tela é do F14). As escolas voltam na ordem em que nasceram.
   */
  async redeComEscolas(quantidade: number, ipsDeSaida: readonly string[]): Promise<string[]> {
    const { id: redeId } = await criarRede(this.banco, autorDaBancada, { id: randomUUID(), nome: 'Rede municipal sintética de teste', tipo: 'prefeitura' })
    await this.pool.query('update rede set ips_saida = $1::inet[] where id = $2', [ipsDeSaida, redeId])
    const escolas: string[] = []
    for (let posicao = 0; posicao < quantidade; posicao++) {
      const { id: escolaId } = await criarEscola(this.banco, autorDaBancada, { id: randomUUID(), redeId, nome: 'Escola municipal sintética de teste', slug: `teste-${randomUUID()}` })
      this.#escolas.push(escolaId)
      escolas.push(escolaId)
    }
    return escolas
  }

  /** `quantidade` sessões na escola, cada uma de um usuário novo com o papel pedido (aluno, se nada for dito). */
  async sessoes(escolaId: string, { papel = 'aluno', quantidade = 1 }: OpcoesDeSessao = {}): Promise<SessaoDeTeste[]> {
    const emissor = emissorDeTokenSintetico(this.#ambiente)
    const criadas = await criarSessoesSinteticas(this.banco, this.#ambiente, { escolaId, papel, quantidade })
    return criadas.map((criada) => ({
      escolaId,
      ...criada,
      tokenNovo: async () => (await emissor.emitir({ escolaId, usuarioId: criada.usuarioId, sessaoId: criada.sessaoId })).token,
      tokenEm: async (agora: Date) =>
        (await emissorDeTokenSintetico(this.#ambiente, { agora: () => agora }).emitir({ escolaId, usuarioId: criada.usuarioId, sessaoId: criada.sessaoId })).token,
    }))
  }

  async sessao(escolaId: string, papel: PapelDeUsuario = 'aluno'): Promise<SessaoDeTeste> {
    const [criada] = await this.sessoes(escolaId, { papel })
    if (criada === undefined) throw new Error('sessão de teste não criada')
    return criada
  }

  /**
   * Um usuário na `escolaId` para a mesma conta do usuário de equipe `usuarioId` (outra escola), com uma sessão, e o
   * token dela. É a professora que dá aula em duas escolas: uma conta, um usuário e um `sub` em cada escola.
   */
  async sessaoDaMesmaConta(usuarioId: string, escolaId: string): Promise<string> {
    const { rows } = await this.pool.query<{ conta_id: string | null; papel: PapelDeUsuario }>('select conta_id, papel from usuario where id = $1', [usuarioId])
    const origem = rows[0]
    if (origem?.conta_id === null || origem === undefined) throw new Error('o usuário de origem precisa ter conta')
    const contaId = origem.conta_id
    const criada = await runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
      this.banco.transaction(async (tx) => {
        const criacao = new CriacaoDeSessaoRepository(tx)
        const [usuario] = await criacao.criarUsuarios([{ contaId, papel: origem.papel, nome: NOME_SINTETICO }])
        if (usuario === undefined) throw new Error('usuário não criado')
        const [sessao] = await criacao.criarSessoes([{ usuarioId: usuario.id, contaId, metodo: 'email', refreshHash: randomUUID(), duracaoHoras: DURACAO_DA_SESSAO_HORAS }])
        if (sessao === undefined) throw new Error('sessão não criada')
        return { usuarioId: usuario.id, sessaoId: sessao.id }
      }),
    )
    return (await emissorDeTokenSintetico(this.#ambiente).emitir({ escolaId, ...criada })).token
  }

  /** Alunos com credencial por matrícula na escola, pelo seed sintético da 11.0; os ids voltam na ordem pedida. */
  async alunosComMatricula(escolaId: string, alunos: readonly AlunoComMatriculaSintetico[]): Promise<string[]> {
    return criarAlunosComMatricula(this.banco, this.#ambiente, escolaId, alunos)
  }

  /**
   * Um usuário de equipe na escola, ligado à conta global do e-mail (achada, ou criada se não existe), sem sessão. É a
   * pessoa que o login pela conta da escola (13.0) procura pelo e-mail do provedor: os e-mails do `oidc-falso` são
   * fixos, e a conta fica entre execuções quando o usuário dela é autor de auditoria, por isso ela é reaproveitada.
   */
  async equipeComEmail(escolaId: string, email: string, papel: 'professor' | 'coordenador' = 'professor'): Promise<{ usuarioId: string; contaId: string }> {
    await this.pool.query('insert into conta (email) values ($1) on conflict (email) do nothing', [email])
    const { rows: contas } = await this.pool.query<{ id: string }>('select id from conta where email = $1', [email])
    const contaId = contas[0]?.id
    if (contaId === undefined) throw new Error('conta de teste não criada')
    const { rows } = await this.pool.query<{ id: string }>('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4) returning id', [escolaId, contaId, papel, NOME_SINTETICO])
    const usuarioId = rows[0]?.id
    if (usuarioId === undefined) throw new Error('usuário de teste não criado')
    return { usuarioId, contaId }
  }

  /** O endereço (slug) da escola. */
  async slugDe(escolaId: string): Promise<string> {
    const { rows } = await this.pool.query<{ slug: string }>('select slug from escola where id = $1', [escolaId])
    const slug = rows[0]?.slug
    if (slug === undefined) throw new Error('escola de teste não encontrada')
    return slug
  }

  /** Escola nova com uma sessão. */
  async escolaComSessao(papel: PapelDeUsuario = 'aluno'): Promise<SessaoDeTeste> {
    return this.sessao(await this.escola(), papel)
  }

  /** Encerra a sessão no banco, como `DELETE /v1/sessao` fará: a requisição (ou o handshake) seguinte é recusada. */
  async encerrar(sessaoId: string): Promise<void> {
    await this.pool.query(`update sessao set encerrada_em = now(), motivo = 'saida' where id = $1`, [sessaoId])
  }

  /**
   * Apaga as sessões, os usuários e as contas que esta bancada criou, e fecha o pool. A escola, a rede e a auditoria
   * delas ficam, e com a auditoria o usuário que é autor dela: a auditoria só se escreve pela porta dela, e o banco de
   * teste é descartável.
   */
  async fechar(): Promise<void> {
    try {
      if (this.#escolas.length > 0) {
        const escolas = this.#escolas
        const { rows } = await this.pool.query<{ conta_id: string }>('select conta_id from usuario where escola_id = any($1::uuid[]) and conta_id is not null', [escolas])
        await this.pool.query('delete from sessao where escola_id = any($1::uuid[])', [escolas])
        await this.pool.query('delete from credencial_matricula where escola_id = any($1::uuid[])', [escolas])
        // O login pela conta da escola (13.0): a ligação aponta para o usuário; o domínio liberado, só para a escola.
        await this.pool.query('delete from conta_externa where escola_id = any($1::uuid[])', [escolas])
        await this.pool.query('delete from provedor_escola where escola_id = any($1::uuid[])', [escolas])
        // As tabelas do MVP de apresentação (migrations 0022 e 0023) apontam para a turma, o ano letivo, a disciplina e o
        // usuário: saem antes deles, do que aponta para o que é apontado.
        for (const tabela of TABELAS_DO_MVP_NA_ORDEM_DE_LIMPEZA) {
          await this.pool.query(`delete from ${tabela} where escola_id = any($1::uuid[])`, [escolas])
        }
        // O vínculo da 9.0 aponta para a turma e o usuário, e a estrutura da 8.0 para o ano letivo: saem antes deles.
        await this.pool.query('delete from vinculo where escola_id = any($1::uuid[])', [escolas])
        // O pedido de reivindicação da A1 (6.0) aponta para a turma, para o nome da lista e para quem decidiu.
        await this.pool.query('delete from reivindicacao where escola_id = any($1::uuid[])', [escolas])
        // A lista de nomes da A1 (2.0) aponta para a turma e para o usuário.
        await this.pool.query('delete from lista_nome where escola_id = any($1::uuid[])', [escolas])
        await this.pool.query('delete from turma where escola_id = any($1::uuid[])', [escolas])
        await this.pool.query('delete from serie where escola_id = any($1::uuid[])', [escolas])
        await this.pool.query('delete from disciplina where escola_id = any($1::uuid[])', [escolas])
        await this.pool.query('delete from ano_letivo where escola_id = any($1::uuid[])', [escolas])
        // O usuário que é autor de auditoria fica, com a conta dele: a auditoria só se escreve (e não se apaga) pela porta dela.
        await this.pool.query('delete from usuario u where u.escola_id = any($1::uuid[]) and not exists (select 1 from auditoria a where a.escola_id = u.escola_id and a.autor_usuario_id = u.id)', [escolas])
        await this.pool.query('delete from conta c where c.id = any($1::uuid[]) and not exists (select 1 from usuario u where u.conta_id = c.id)', [rows.map((linha) => linha.conta_id)])
      }
    } finally {
      await this.pool.end()
    }
  }
}
