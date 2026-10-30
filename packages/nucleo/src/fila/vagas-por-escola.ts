import type { QueueName } from '@educa/shared'
import type { Redis } from 'ioredis'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { InvariantException } from '@educa/shared'

/** Quanto uma vaga vale sem renovação. Worker morto segurando vaga a perde nesse prazo (Tech Spec, seção 5). */
export const VALIDADE_DA_VAGA_MS = 60_000
/** De quanto em quanto tempo o worker renova a vaga do job em execução: quatro renovações por validade. */
export const INTERVALO_RENOVACAO_DA_VAGA_MS = 15_000
/** Dono das vagas de rotina do sistema (`sistema.*`, sem escola): uma chave própria, com o padrão do ambiente. */
export const DONO_DAS_VAGAS_DO_SISTEMA = 'sistema'

const SCRIPT = readFileSync(new URL('./vaga.lua', import.meta.url), 'utf8')
const SHA_DO_SCRIPT = createHash('sha1').update(SCRIPT).digest('hex')

/**
 * Quantos jobs de uma escola podem estar em execução ao mesmo tempo numa fila, para uma escola
 * barulhenta não ocupar os workers de todas (regra 80, item 3). A vaga é um membro no ZSET
 * `vaga:{fila}:{escola}`, e toda leitura e escrita passa pelo `vaga.lua`, atômico no Redis de fila.
 *
 * O limite chega por argumento porque vem da configuração da escola do job, lida por quem chama no
 * contexto dessa escola (D41). A escola também vem de quem chama, e sempre da linha persistida em
 * `job_registro`, nunca do `data` do job no BullMQ.
 */
export class VagasPorEscola {
  readonly #prefixo: string

  /**
   * @param redis cliente do Redis de fila sem fila offline e com `commandTimeout`: com o Redis fora ou
   *   travado, cada operação falha no prazo em vez de pendurar o despachante ou o fim do job.
   * @param prefixo só o teste passa, para não disputar vaga com outro teste.
   * @param validadeMs só o teste troca, para ver a vaga vencer sem esperar 60 s.
   */
  constructor(
    private readonly redis: Redis,
    prefixo?: string,
    private readonly validadeMs: number = VALIDADE_DA_VAGA_MS,
  ) {
    this.#prefixo = prefixo === undefined ? '' : `${prefixo}:`
  }

  chave(fila: QueueName, escolaId: string | null): string {
    return `${this.#prefixo}vaga:${fila}:${escolaId ?? DONO_DAS_VAGAS_DO_SISTEMA}`
  }

  /**
   * Estimativa de vagas livres, para o despachante não reservar linha que certamente não teria vaga.
   * Não garante nada: quem garante é `tomar`, depois da reserva.
   */
  async livres(fila: QueueName, escolaId: string | null, limite: number): Promise<number> {
    return Number(await this.executar(this.chave(fila, escolaId), 'livres', limite))
  }

  /** Vagas tomadas agora na escola e fila, sem as vencidas. É a métrica `fila.vagas_em_uso`. */
  async emUso(fila: QueueName, escolaId: string | null): Promise<number> {
    // `livres` com limite 0 devolve menos as vagas em uso, depois de tirar as vencidas, no mesmo script.
    return 0 - Number(await this.executar(this.chave(fila, escolaId), 'livres', 0))
  }

  /** Toma vaga para cada job, na ordem, até o limite. Devolve os que ficaram com vaga; job que já tinha, mantém. */
  async tomar(fila: QueueName, escolaId: string | null, limite: number, jobIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (jobIds.length === 0) return new Set()
    const concedidos = await this.executar(this.chave(fila, escolaId), 'tomar', this.validadeMs, limite, ...jobIds)
    if (!Array.isArray(concedidos)) throw new InvariantException('vaga.lua devolveu resposta inesperada ao tomar')
    return new Set(concedidos.map(String))
  }

  /** Renova a vaga do job em execução por mais uma validade. */
  async renovar(fila: QueueName, escolaId: string | null, jobId: string): Promise<void> {
    await this.executar(this.chave(fila, escolaId), 'renovar', this.validadeMs, jobId)
  }

  /** Os jobs que têm vaga na escola e fila, vencida ou não: no máximo cerca do limite dela. */
  async membros(fila: QueueName, escolaId: string | null): Promise<string[]> {
    return this.redis.zrange(this.chave(fila, escolaId), '0', '-1')
  }

  /**
   * Renova a vaga de jobs publicados que ainda não começaram, sem readmitir a que já venceu. Sem
   * isto, a vaga de um job parado na fila do BullMQ (pool cheio, réplica fora) venceria em 60 s, e a
   * escola ganharia mais jobs publicados a cada minuto, acima do teto.
   */
  async manter(fila: QueueName, escolaId: string | null, jobIds: readonly string[]): Promise<void> {
    if (jobIds.length === 0) return
    await this.executar(this.chave(fila, escolaId), 'manter', this.validadeMs, ...jobIds)
  }

  async liberar(fila: QueueName, escolaId: string | null, jobIds: readonly string[]): Promise<void> {
    if (jobIds.length === 0) return
    await this.executar(this.chave(fila, escolaId), 'liberar', ...jobIds)
  }

  /** `EVALSHA`, e `EVAL` só na primeira vez que este Redis vê o script (ou depois de ele reiniciar sem o cache). */
  private async executar(chave: string, ...argumentos: Array<string | number>): Promise<unknown> {
    try {
      return await this.redis.evalsha(SHA_DO_SCRIPT, 1, chave, ...argumentos)
    } catch (erro) {
      if (!(erro instanceof Error) || !erro.message.startsWith('NOSCRIPT')) throw erro
      return this.redis.eval(SCRIPT, 1, chave, ...argumentos)
    }
  }
}
