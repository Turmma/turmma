import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * Todo job nasce aqui, na transação de quem o pediu, e só depois o despachante o publica na fila
 * (Tech Spec, seção 5). É a fonte da verdade do estado: o Redis de fila pode perder o job, esta
 * tabela não.
 *
 * - `escola_id` só é nulo em rotina do sistema (`tipo` `sistema.*`), e o check garante isso no banco.
 * - `dados` leva só id e parâmetro técnico, nunca dado de pessoa (regra 20).
 * - `requisicao_id` é o da requisição que pediu o job, para a trilha seguir de API a despachante e
 *   worker (RF9).
 * - A FK de `escola_id` entrou `NOT VALID` na tarefa 3.0 do F1: vale para toda escrita nova, e a
 *   validação das linhas antigas é uma pendência de deploy (`TODO.md`).
 * - `chave_idempotencia` (F3, tarefa 3.0) é o "uma vez só" de quem enfileira: o índice único parcial
 *   `(escola_id, tipo, chave_idempotencia)`, só entre os não finalizados, faz a segunda gravação da mesma chave
 *   colidir (`JobOutbox.enfileirarUmaVez`). Depois de o job terminar, a mesma chave grava outro: quem usa a chave
 *   (o expurgo da escola, com "a data local da noite") tolera reexecução. Só existe em job de escola: rotina do
 *   sistema não tem escola para a chave, e o check recusa.
 */
export const jobRegistro = pgTable(
  'job_registro',
  {
    // UUIDv7 gerado pelo Postgres 18: ordenado no tempo, sem entregar volume como um sequencial.
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid().references(() => escola.id),
    fila: text().notNull(),
    prioridade: smallint().notNull(),
    tipo: text().notNull(),
    dados: jsonb().$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    naoUrgente: boolean().notNull().default(false),
    estado: text().notNull().default('aguardando'),
    requisicaoId: uuid(),
    reservadoAte: timestamp({ withTimezone: true }),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    iniciadoEm: timestamp({ withTimezone: true }),
    concluidoEm: timestamp({ withTimezone: true }),
    codigoFalha: text(),
    chaveIdempotencia: text(),
  },
  (tabela) => [
    // O despachante procura só entre os não finalizados, por fila e escola, do mais antigo.
    index('job_registro_pendentes_idx')
      .on(tabela.fila, tabela.escolaId, tabela.criadoEm)
      .where(sql`estado not in ('concluido', 'falhou')`),
    // No horário letivo, o despachante reserva só os urgentes da escola (tarefa 10.0). Sem este índice,
    // a reserva desceria pelo de pendentes atravessando cada não urgente segurado, a cada rodada, a
    // manhã inteira; com ele, desce direto aos urgentes.
    index('job_registro_pendentes_urgentes_idx')
      .on(tabela.fila, tabela.escolaId, tabela.criadoEm)
      .where(sql`estado not in ('concluido', 'falhou') and not nao_urgente`),
    // O expurgo (11.0) apaga os finalizados antigos sem varrer os pendentes.
    index('job_registro_finalizados_idx').on(tabela.concluidoEm).where(sql`estado in ('concluido', 'falhou')`),
    // A medição `job.falhos{tipo}` (44.0) salta de tipo em tipo e conta só os `falhou`, que são poucos: sem este índice a
    // contagem desceria pelo de finalizados atravessando os concluídos de 7 dias, a cada 5 s.
    index('job_registro_falhos_idx').on(tabela.tipo).where(sql`estado = 'falhou'`),
    // Uma vez só por escola, tipo e chave, entre os que ainda não terminaram (F3, tarefa 3.0).
    uniqueIndex('job_registro_chave_idempotencia_unica')
      .on(tabela.escolaId, tabela.tipo, tabela.chaveIdempotencia)
      .where(sql`chave_idempotencia is not null and estado not in ('concluido', 'falhou')`),
    check('job_registro_chave_so_com_escola', sql`chave_idempotencia is null or escola_id is not null`),
    check('job_registro_escola_ou_sistema', sql`escola_id is not null or tipo like 'sistema.%'`),
    check('job_registro_estado_valido', sql`estado in ('aguardando', 'reservado', 'publicado', 'ativo', 'concluido', 'falhou')`),
    check('job_registro_fila_valida', sql`fila in ('interativa', 'normal', 'lote')`),
  ],
)
