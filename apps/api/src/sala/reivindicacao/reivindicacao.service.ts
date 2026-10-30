import { DomainException, postgresErrorIn, METRICS, type Database, type Meter } from '@educa/nucleo'
import { ErrorCode, reivindicacaoResponseSchema, type ReivindicarSalaRequest, type ReivindicacaoResponse } from '@educa/shared'
import { TurmaRepository } from '../../estrutura/turma/turma.repository.js'
import type { AcessoDaSala } from '../../sessao/index.js'
import { baldeDaEscola, type HashDeSenha, type SemaforoDeHash } from '../../credencial/index.js'
import type { LimitesDaSala } from '../limites-da-sala.js'
import { ListaLivreRepository } from './lista-livre.repository.js'
import { ReivindicacaoRepository } from './reivindicacao.repository.js'
import { entradaDaSala } from '../entrada-da-sala.js'

export interface DependenciasDaReivindicacao {
  readonly banco: Database
  readonly acessoDaSala: Pick<AcessoDaSala, 'naSala'>
  /** O semáforo do hash do login, um só por instância: o teto que ele guarda é o das threads do processo. */
  readonly semaforo: Pick<SemaforoDeHash, 'executar'>
  readonly hash: Pick<HashDeSenha, 'gerar'>
  readonly chaveCodigo: Uint8Array
  /** Os três contadores da sala (7.0): o do código errado vai ao `AcessoDaSala`, o do nome e o da turma rodam aqui. */
  readonly limites: Pick<LimitesDaSala, 'antesDaBusca' | 'codigoErrado' | 'antesDoHash' | 'teveMatriculaErrada' | 'hashSemPedido'>
  readonly medidor: Meter
}

/** Os valores de `resultado` em `sala.reivindicacao` (7.0): fechados, para a série não crescer com texto de erro. */
export type ResultadoDaReivindicacao = 'enviado' | 'reenvio' | 'recusada' | 'limite' | 'sem_acesso' | 'indisponivel' | 'erro'

const RESULTADO_DO_ERRO: Partial<Record<ErrorCode, ResultadoDaReivindicacao>> = {
  [ErrorCode.REIVINDICACAO_RECUSADA]: 'recusada',
  [ErrorCode.LIMITE_EXCEDIDO]: 'limite',
  [ErrorCode.NAO_ENCONTRADO]: 'sem_acesso',
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'indisponivel',
}

/**
 * Os SQLSTATE que fazem a gravação voltar atrás e reler a chave: `foreign_key_violation` (o nome de outra escola ou
 * inexistente, ou que saiu da lista no meio) e `unique_violation` (o nome que já tem pendente, ou a chave já gravada).
 * Nunca se lê qual restrição foi (Tech Spec da A1, seção 5, passo 4).
 */
const VOLTA_E_RELE = new Set(['23503', '23505'])

/**
 * A transação volta atrás sem gravar, como no 23505: o `update` da `lista_nome` não achou o nome, ou o ano deixou de
 * estar em curso enquanto o pedido esperava a trava dele (10.0, C10).
 */
class NaoGravou extends Error {}

const ENVIADO: ReivindicacaoResponse = reivindicacaoResponseSchema.parse({ resultado: 'enviado' })

/** O que o pedido virou, para a resposta (sempre o mesmo `enviado`) e para a métrica. */
type Desfecho = 'enviado' | 'reenvio'

/**
 * A reivindicação do nome pela página pública da sala (A1, tarefa 6.0, RF10 e RF11; Tech Spec da A1, seção 5, passo 4).
 * Sem login: a escola, o ano e a turma saem do acesso vigente que o `AcessoDaSala` achou pelo slug e pelo link ou pelo
 * código, e nada deles vem do cliente. Não lê cookie, não grava registro de acesso nem auditoria (a decisão, 8.0, grava),
 * e nada disto loga: a matrícula, a senha, a chave e o nome nunca vão a log.
 *
 * 1. **A chave já gravada** num pedido da escola, do ano e da turma do acesso: é o reenvio, e responde `enviado`, sem hash,
 *    sem pedido novo e sem contar em limite nenhum (E21).
 * 2. **Os limites** (7.0, `LimitesDaSala`): uma leitura, com a escola e o ano do contexto e a turma do acesso, diz se é
 *    matrícula errada num nome livre; se é, ela soma no contador do nome **antes** do hash, de forma atômica, e as
 *    tentativas ao mesmo tempo no mesmo nome não passam do teto juntas. O nome travado pelo mesmo acesso sai com
 *    `LIMITE_EXCEDIDO` e `Retry-After`, sem hash; a turma no teto de hashes sem pedido manda o hash rebaixado. O código
 *    errado já contou antes, no `AcessoDaSala`. Depois do hash, o contador do nome dá o `teve_matricula_errada` do pedido,
 *    com as erradas que chegaram junto.
 * 3. **O hash, sempre**: argon2id no `SemaforoDeHash`, no balde da escola, fora da transação e sem conexão presa (L9), em
 *    todo pedido que passou da chave, com a matrícula certa ou não, com o nome tomado ou inexistente (R3): rodar o hash
 *    só quando a matrícula bate diria, pelo tempo, qual dos dois errou. O 503 do prazo do semáforo sai daqui, sem gravar.
 * 4. **A transação**: o ano em curso travado em `FOR SHARE` (10.0, C10), o `insert` do pedido e, **depois**, o `update`
 *    condicional da `lista_nome` (id, escola, ano, turma, `livre` e matrícula). As duas escritas voltam juntas (E23). O
 *    `encerrar` que chega depois espera o commit e fecha o pedido como `encerrada`; o que chegou antes deixa o ano
 *    `encerrado`, e o pedido, relido o ano, não grava.
 * 5. **Ano fora de curso, FK violada, qualquer 23505 ou `update` sem linha**: a transação volta atrás, e um comando novo
 *    relê a chave na escola e na turma do acesso. Achou, foi o mesmo envio que gravou antes, ao mesmo tempo (C2):
 *    `enviado`, sem contar. Não achou: `REIVINDICACAO_RECUSADA`, a mesma resposta para o nome inexistente, de outra
 *    turma, escola ou ano, de ano encerrado, tomado ou com a matrícula errada (R2), sem gravar nada. O nome da
 *    restrição nunca é lido: a ordem dos índices não muda a resposta. A recusa rodou o hash sem criar pedido, e conta
 *    no teto da turma (Tech Spec da A1, seção 5, passo 5).
 *
 * Cada pedido soma um em `sala.reivindicacao{resultado}`, sem escola.
 */
export class ReivindicacaoService {
  readonly #pedidos: ReturnType<Meter['createCounter']>

  constructor(private readonly dependencias: DependenciasDaReivindicacao) {
    this.#pedidos = dependencias.medidor.createCounter(METRICS.reivindicacaoNaSala, { description: 'Pedidos de reivindicação de nome na página da sala, por resultado' })
  }

  /** `POST /v1/salas/reivindicar`: o pedido fica pendente e o nome sai da lista, ou a recusa única. */
  async reivindicar(pedido: ReivindicarSalaRequest): Promise<ReivindicacaoResponse> {
    let resultado: ResultadoDaReivindicacao = 'erro'
    try {
      resultado = await this.#reivindicar(pedido)
      return ENVIADO
    } catch (erro) {
      resultado = (erro instanceof DomainException ? RESULTADO_DO_ERRO[erro.codigo] : undefined) ?? 'erro'
      throw erro
    } finally {
      this.#pedidos.add(1, { resultado })
    }
  }

  async #reivindicar(pedido: ReivindicarSalaRequest): Promise<Desfecho> {
    const { banco, acessoDaSala, semaforo, hash, chaveCodigo, limites } = this.dependencias
    const { listaNomeId, matricula, senha, chaveEnvio } = pedido
    return acessoDaSala.naSala(
      entradaDaSala(pedido, chaveCodigo),
      async ({ acessoId, escolaId, turmaId }) => {
        const pedidos = new ReivindicacaoRepository(banco)
        if (await pedidos.chaveGravada(turmaId, chaveEnvio)) return 'reenvio'
        const nome = { acessoId, listaNomeId }
        const matriculaErrada = await new ListaLivreRepository(banco).livreComOutraMatricula({ turmaId, listaNomeId, matricula })
        const { rebaixado } = await limites.antesDoHash(nome, turmaId, escolaId, matriculaErrada)
        const senhaHash = await semaforo.executar(baldeDaEscola(escolaId, rebaixado), () => hash.gerar(senha))
        const teveMatriculaErrada = await limites.teveMatriculaErrada(nome)
        try {
          await banco.transaction(async (tx) => {
            if (!(await new TurmaRepository(tx).travarAnoEmCurso())) throw new NaoGravou()
            await new ReivindicacaoRepository(tx).inserirPendente({ turmaId, listaNomeId, chaveEnvio, senhaHash, teveMatriculaErrada })
            if (!(await new ListaLivreRepository(tx).tomar({ turmaId, listaNomeId, matricula }))) throw new NaoGravou()
          })
        } catch (erro) {
          if (!(erro instanceof NaoGravou) && !VOLTA_E_RELE.has(postgresErrorIn(erro)?.code ?? '')) throw erro
          if (await pedidos.chaveGravada(turmaId, chaveEnvio)) return 'reenvio'
          await limites.hashSemPedido(turmaId)
          throw new DomainException(ErrorCode.REIVINDICACAO_RECUSADA)
        }
        return 'enviado'
      },
      limites,
    )
  }
}
