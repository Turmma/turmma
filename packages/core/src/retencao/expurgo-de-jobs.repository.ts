import { sql } from 'drizzle-orm'
import type { Database } from '../db/database.js'
import { Unscoped } from '../db/unscoped.decorator.js'

/** Por quantos dias `job_registro` guarda o job que terminou `concluido` (Tech Spec, seção 7, "Retenção e expurgo"). */
export const RETENCAO_JOB_REGISTRO_DIAS = 7

/**
 * Por quantos dias `job_registro` guarda o job que terminou `falhou` (44.0): o operador tem um mês para ver o alerta
 * "Job que falhou de vez" e abrir a correção. A exceção é o de `titular.*`, que não sai pelo prazo (abaixo).
 */
export const RETENCAO_JOB_REGISTRO_FALHO_DIAS = 30

/** Quantas linhas cada instrução do expurgo apaga no máximo: transação curta, lock curto. */
export const LOTE_DO_EXPURGO = 5_000

/**
 * Apaga um lote e diz quantas linhas saíram. Desce pelo índice parcial de finalizados
 * (`job_registro_finalizados_idx`): cada ramo do `or` fixa o `estado` (`concluido` ou `falhou`), e é isso que faz o
 * Postgres provar que a condição implica o predicado do índice; o `order by concluido_em` faz o `limit` parar no lote
 * sem ler os demais. Ramo sem o `estado` tira o índice do plano (o teste do `EXPLAIN` fica vermelho).
 *
 * `id = any(array(...))`, e não `id in (select ...)`: o `array` vira um passo executado uma vez só,
 * antes do delete. Com `in`, e a estatística da tabela velha (logo depois de uma carga grande), o
 * Postgres escolhe repetir a subconsulta a cada linha: o lote levou 22 s e apagou 8.586 linhas em vez
 * de 5.000, porque cada repetição do `limit` com `skip locked` devolve outras linhas.
 *
 * O que sai: o `concluido` depois de 7 dias e o `falhou` depois de 30, no mesmo lote e pelo mesmo índice, e **nunca o
 * `falhou` de `titular.*`** (44.0, RF18): o pedido do titular é enfileirado uma vez só (`titular.montar-arquivo`), e a
 * linha `falhou` é o único rastro de que o arquivo ou a eliminação não saiu; ela fica até a ação do operador (46.0, X6).
 * A exceção é só do `falhou`: o `concluido` de `titular.*` sai em 7 dias como os outros. Ela está no SQL do lote, e não num
 * filtro depois: o `limit` conta só o que vai sair, e o lote continua de `LOTE_DO_EXPURGO`. O `falhou` que ainda está no
 * prazo e o de `titular.*` ficam na frente do índice (ordenado por `concluido_em`) e são lidos e descartados a cada lote;
 * são os que o alerta "Job que falhou de vez" já mostrou ao operador, e a medição `job.falhos` os conta.
 *
 * `for update skip locked`: duas execuções ao mesmo tempo (a reexecução de D49) apagam linhas
 * diferentes, sem uma esperar a outra; a linha presa numa transação que ainda não terminou (de um
 * worker que morreu no meio do lote) fica para a próxima instrução.
 */
const APAGAR_LOTE_VENCIDO = (limite: number) => sql`
  delete from job_registro
  where id = any(array(
    select id from job_registro
    where (estado = 'concluido' and concluido_em < now() - make_interval(days => ${RETENCAO_JOB_REGISTRO_DIAS}))
      or (estado = 'falhou' and tipo not like 'titular.%' and concluido_em < now() - make_interval(days => ${RETENCAO_JOB_REGISTRO_FALHO_DIAS}))
    order by concluido_em
    limit ${limite}
    for update skip locked
  ))
`

/**
 * A retenção de `job_registro`: o job concluído há mais de `RETENCAO_JOB_REGISTRO_DIAS` e o falho há mais de
 * `RETENCAO_JOB_REGISTRO_FALHO_DIAS` saem do banco, menos o falho de `titular.*`. Fica fora do módulo da fila de
 * propósito: o despachante distribui, este apaga, e o expurgo por retenção de dado de escola (F3) mora aqui também.
 */
export class ExpurgoDeJobsRepository {
  constructor(private readonly banco: Database) {}

  /**
   * Apaga até `limite` jobs vencidos, de qualquer escola. Job `aguardando`, `reservado`, `publicado`
   * ou `ativo` nunca sai, por mais antigo que seja; o `concluido` há menos de 7 dias e o `falhou` há menos de 30
   * também não, e o `falhou` de `titular.*` não sai por prazo nenhum.
   */
  @Unscoped(
    'o expurgo é rotina nossa e aplica a mesma retenção de job a todas as escolas; ' +
      'não devolve linha, só a quantidade apagada, e não atende requisição de escola nenhuma',
  )
  async apagarLoteVencido(limite: number = LOTE_DO_EXPURGO): Promise<number> {
    const resultado = await this.banco.execute(APAGAR_LOTE_VENCIDO(limite))
    return resultado.rowCount ?? 0
  }
}

/** A instrução do lote, para o teste conferir o plano sem apagar nada. */
export function expurgoExpiredBatchStatement(limite: number = LOTE_DO_EXPURGO) {
  return APAGAR_LOTE_VENCIDO(limite)
}
