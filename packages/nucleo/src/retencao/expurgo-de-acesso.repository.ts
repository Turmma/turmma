import { sql, type SQL } from 'drizzle-orm'
import type { Database } from '../db/banco.js'
import { Unscoped } from '../db/sem-escopo.decorator.js'
import { LOTE_DO_EXPURGO } from './expurgo-de-jobs.repository.js'

/** Por quantos meses o registro de acesso fica (Marco Civil, art. 15; `docs/lgpd.md`). */
export const RETENCAO_REGISTRO_ACESSO_MESES = 6

/** Por quantos dias a sessão fica depois de encerrada ou expirada (`docs/lgpd.md`, "Sessão"). */
export const RETENCAO_SESSAO_DIAS = 30

/**
 * Por quantos dias o convite, de coordenador ou de professor, fica depois de usado, revogado ou expirado (`docs/lgpd.md`,
 * "Convite de coordenador" e "Convite de professor").
 */
export const RETENCAO_CONVITE_DIAS = 30

/** Por quantos dias o acesso da turma fica depois de vencido ou revogado (`docs/lgpd.md`, "Acesso da turma"; A1). */
export const RETENCAO_ACESSO_TURMA_DIAS = 30

/** Por quantos anos o incidente fica depois de registrado (Resolução CD/ANPD 15/2024, art. 10; `docs/lgpd.md`, seção 8). */
export const RETENCAO_INCIDENTE_ANOS = 5

/**
 * As oito tabelas que o `sistema.expurgar-acesso` apaga por prazo, na ordem em que ele passa; a conta vem depois. As
 * quatro primeiras são das escolas: registro de acesso, sessão e convite (tarefa 17.0), e o acesso da turma (A1, tarefa
 * 10.0); as três seguintes, da operação Turmma (A0, tarefa 9.0), com os mesmos prazos; a última, o incidente de segurança
 * (F3, tarefa 9.0), que é da operação mas leva as seções das escolas em cascata. A `auditoria_operacao` (vigência + 5
 * anos) e o `operador` (o dado pessoal sai no `desativar`) nunca são alvo, nem os pedidos de reivindicação (vigência + 5
 * anos, sem expurgo na A1).
 */
export const ALVOS_DO_EXPURGO_DE_ACESSO = ['registro_acesso', 'sessao', 'convite', 'acesso_turma', 'acesso_operacao', 'sessao_operador', 'convite_operador', 'incidente'] as const
export type AlvoDoExpurgoDeAcesso = (typeof ALVOS_DO_EXPURGO_DE_ACESSO)[number]

/**
 * Cada lote segue o desenho do expurgo de jobs (F0): `id = any(array(...))`, para a subconsulta rodar uma vez só antes
 * do delete; `order by` pelo prazo, que desce pelo índice e para no lote; e `for update skip locked`, para duas
 * execuções ao mesmo tempo (a reentrega de D49) apagarem linhas diferentes sem uma esperar a outra.
 *
 * O prazo é contado do `agora` que o worker passa, e não do `now()` do banco: o teste injeta o relógio nos limites.
 *
 * - **Registro de acesso:** o de todas as escolas, e também a falha por e-mail sem escola, que não tem escola onde
 *   aplicar retenção própria. Desce por `registro_acesso_em_idx`.
 * - **Sessão:** encerrada ou só expirada, pela mesma expressão do índice `sessao_fim_idx`. Uma sessão aberta e no
 *   prazo tem `coalesce` no futuro e nunca sai.
 * - **Convite:** de coordenador e de professor (A1), o prazo conta do primeiro que aconteceu entre usar, revogar e
 *   expirar (`least` ignora os nulos), com `order by` por essa expressão (A1, tarefa 10.0): o lote que não cabe inteiro
 *   leva os mais antigos. Um convite por pessoa da equipe convidada de cada vez, e os vencidos saem em 30 dias: sem
 *   índice próprio, a ordenação é a de uma tabela pequena.
 * - **Acesso da turma** (A1, tarefa 10.0): 30 dias depois de vencer ou ser revogado, o que veio primeiro, pelo mesmo
 *   `least`, com `order by` por ele. Um acesso não revogado por turma, e os revogados saem em 30 dias: a tabela fica na
 *   ordem das turmas da escola vezes os "Gerar novo" de um mês, sem índice próprio, como o convite.
 * - **Acesso à operação:** entrada, falha de entrada e saída do painel da equipe, com 6 meses como o registro de acesso
 *   (Marco Civil, art. 15), inclusive a falha sem operador reconhecido. Desce por `acesso_operacao_em_idx`.
 * - **Sessão de operador:** 30 dias depois de encerrada ou, sem encerramento, de expirada, pela expressão do índice
 *   `sessao_operador_fim_idx`.
 * - **Convite de operador:** 30 dias depois de usado, revogado ou vencido, pelo mesmo `least` do convite, mas, ao
 *   contrário dele, com `order by` por essa expressão (tarefa 9.0 da A0b): o lote que não cabe inteiro leva os mais
 *   antigos. Um por operador de cada vez, dezenas no total: sem índice próprio, a ordenação é a de uma tabela pequena,
 *   lida inteira.
 * - **Incidente** (F3, tarefa 9.0): 5 anos depois de registrado, do mais antigo, e as seções das escolas (`incidente_escola`)
 *   saem junto, pela cascata da FK: este arquivo não cita a tabela delas. Poucos por ano, sem índice próprio.
 */
const APAGAR_LOTE: Record<AlvoDoExpurgoDeAcesso, (agora: Date, limite: number) => SQL> = {
  registro_acesso: (agora, limite) => sql`
    delete from registro_acesso
    where id = any(array(
      select id from registro_acesso
      where em < ${agora.toISOString()}::timestamptz - make_interval(months => ${RETENCAO_REGISTRO_ACESSO_MESES})
      order by em
      limit ${limite}
      for update skip locked
    ))
  `,
  sessao: (agora, limite) => sql`
    delete from sessao
    where id = any(array(
      select id from sessao
      where coalesce(encerrada_em, expira_em) < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_SESSAO_DIAS})
      order by coalesce(encerrada_em, expira_em)
      limit ${limite}
      for update skip locked
    ))
  `,
  convite: (agora, limite) => sql`
    delete from convite
    where id = any(array(
      select id from convite
      where least(usado_em, revogado_em, expira_em) < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_CONVITE_DIAS})
      order by least(usado_em, revogado_em, expira_em)
      limit ${limite}
      for update skip locked
    ))
  `,
  acesso_turma: (agora, limite) => sql`
    delete from acesso_turma
    where id = any(array(
      select id from acesso_turma
      where least(revogado_em, expira_em) < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_ACESSO_TURMA_DIAS})
      order by least(revogado_em, expira_em)
      limit ${limite}
      for update skip locked
    ))
  `,
  acesso_operacao: (agora, limite) => sql`
    delete from acesso_operacao
    where id = any(array(
      select id from acesso_operacao
      where em < ${agora.toISOString()}::timestamptz - make_interval(months => ${RETENCAO_REGISTRO_ACESSO_MESES})
      order by em
      limit ${limite}
      for update skip locked
    ))
  `,
  sessao_operador: (agora, limite) => sql`
    delete from sessao_operador
    where id = any(array(
      select id from sessao_operador
      where coalesce(encerrada_em, expira_em) < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_SESSAO_DIAS})
      order by coalesce(encerrada_em, expira_em)
      limit ${limite}
      for update skip locked
    ))
  `,
  convite_operador: (agora, limite) => sql`
    delete from convite_operador
    where id = any(array(
      select id from convite_operador
      where least(usado_em, revogado_em, expira_em) < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_CONVITE_DIAS})
      order by least(usado_em, revogado_em, expira_em)
      limit ${limite}
      for update skip locked
    ))
  `,
  incidente: (agora, limite) => sql`
    delete from incidente
    where id = any(array(
      select id from incidente
      where registrado_em < ${agora.toISOString()}::timestamptz - make_interval(years => ${RETENCAO_INCIDENTE_ANOS})
      order by registrado_em
      limit ${limite}
      for update skip locked
    ))
  `,
}

/** A conta sem uso: sem usuário ativo e sem usuário esperando convite ainda válido no `agora`. `c` é a conta. */
const SEM_USO = (agora: Date) => sql`
  not exists (
    select 1 from usuario u
    where u.conta_id = c.id
      and (
        u.desativado_em is null
        or exists (
          select 1 from convite cv
          where cv.escola_id = u.escola_id and cv.usuario_id = u.id
            and cv.usado_em is null and cv.revogado_em is null and cv.expira_em > ${agora.toISOString()}::timestamptz
        )
      )
  )
`

/**
 * A conta da equipe que deixou de servir a qualquer escola depois da desativação, pelo mesmo critério da limpeza na
 * desativação (`limparContaSemUso`, no ciclo de vida), que adia a limpeza enquanto um convite a segura; quando o
 * convite vence ou é revogado, é aqui que a conta perde e-mail, senha e segundo fator, e as sessões abertas dela são
 * encerradas com motivo `conta_limpa`. A linha fica só com o id, que os usuários desativados apontam.
 *
 * Duas instruções numa transação, e não uma: a primeira escolhe e trava as candidatas (`for update skip locked`, e a
 * conta que um convite trava agora, em `contaParaConvite`, fica para a noite seguinte); a segunda, com a visão do banco
 * de depois da trava, confere de novo o critério e só então limpa. Numa instrução só, o `not exists` usaria a visão do
 * começo dela, e um convite que fizesse commit entre esse começo e a trava da conta não seria visto. Depois da trava,
 * todo convite novo para a conta espera o commit do lote e, relendo, não acha mais o e-mail: cria outra conta. A tabela
 * é só da equipe (dezenas de contas por escola), e o `email is not null` pula as já limpas.
 */
const TRAVAR_CANDIDATAS = (agora: Date, limite: number) => sql`
  select c.id from conta c
  where c.email is not null and ${SEM_USO(agora)}
  order by c.id
  limit ${limite}
  for update of c skip locked
`

const LIMPAR_TRAVADAS = (ids: readonly string[], agora: Date) => sql`
  with alvo as (
    select c.id from conta c where c.id = any(${`{${ids.join(',')}}`}::uuid[]) and ${SEM_USO(agora)}
  ),
  limpas as (
    update conta set email = null, senha_hash = null, mfa_segredo_cifrado = null, mfa_chave_versao = null, mfa_ativado_em = null, mfa_ultimo_passo = null
    from alvo where conta.id = alvo.id
    returning conta.id
  ),
  codigos as (delete from codigo_recuperacao where conta_id in (select id from limpas)),
  sessoes as (
    update sessao set encerrada_em = ${agora.toISOString()}::timestamptz, motivo = 'conta_limpa'
    where conta_id in (select id from limpas) and encerrada_em is null
  )
  select count(*)::int as limpas from limpas
`

/**
 * A retenção do acesso (tarefa 17.0; Tech Spec, seção 5, "Ciclo de vida"): registro de acesso com mais de 6 meses,
 * sessão encerrada ou expirada há mais de 30 dias, convite (de coordenador ou de professor) usado, revogado ou expirado
 * há mais de 30 dias e acesso da turma vencido ou revogado há mais de 30 dias (A1, tarefa 10.0) saem do banco, e com os
 * mesmos prazos o acesso, a sessão e o convite da operação Turmma (A0, tarefa 9.0); depois, a conta da
 * equipe sem uso perde a credencial. Mora em `retencao`, como o expurgo de jobs do F0, e seus
 * dois métodos são, com o dele, as exceções ao escopo fora da resolução de tenant e da conta global do ciclo de vida
 * (Tech Spec, seção 6): rotinas nossas,
 * sem requisição de escola.
 */
export class ExpurgoDeAcessoRepository {
  constructor(private readonly banco: Database) {}

  /**
   * Apaga até `limite` linhas vencidas de `alvo`, de qualquer escola ou da operação, e diz quantas saíram. O critério é
   * só o prazo: nada no prazo sai, de escola nenhuma nem da equipe.
   */
  @Unscoped(
    'o expurgo é rotina nossa e aplica o mesmo prazo de registro de acesso, sessão, convite (de coordenador e de professor) ' +
      'e acesso da turma (link e código da sala) a todas as escolas (e à falha de login sem escola), e às tabelas de acesso, ' +
      'sessão e convite da operação Turmma, que são da equipe e não têm escola, e ao incidente de segurança, que também não tem ' +
      'escola e leva as seções delas em cascata; não devolve linha, só a quantidade apagada, ' +
      'e não atende requisição de escola nenhuma',
  )
  async apagarLoteVencido(alvo: AlvoDoExpurgoDeAcesso, agora: Date, limite: number = LOTE_DO_EXPURGO): Promise<number> {
    const resultado = await this.banco.execute(APAGAR_LOTE[alvo](agora, limite))
    return resultado.rowCount ?? 0
  }

  /**
   * Limpa até `limite` contas da equipe que não servem mais a escola nenhuma, e diz quantas. O critério é o mesmo da
   * desativação: nenhuma conta com usuário ativo, ou com convite ainda válido, é tocada.
   */
  @Unscoped(
    'o expurgo é rotina nossa: a conta da equipe é global e não tem escola, e a que ficou sem usuário ativo e sem convite ' +
      'válido em escola nenhuma perde a credencial; não devolve linha, só a quantidade limpa, e não atende requisição de escola nenhuma',
  )
  async limparLoteDeContasSemUso(agora: Date, limite: number = LOTE_DO_EXPURGO, depoisDeTravar?: () => Promise<void>): Promise<number> {
    return this.banco.transaction(async (tx) => {
      const travadas = await tx.execute<{ id: string }>(TRAVAR_CANDIDATAS(agora, limite))
      const ids = travadas.rows.map(({ id }) => id)
      if (ids.length === 0) return 0
      // Só o teste passa isto: é a janela entre a trava e a reconferência, onde um convite pode ter feito commit.
      if (depoisDeTravar !== undefined) await depoisDeTravar()
      const resultado = await tx.execute<{ limpas: number }>(LIMPAR_TRAVADAS(ids, agora))
      return resultado.rows[0]?.limpas ?? 0
    })
  }
}

/** A instrução do lote, para o teste conferir o plano sem apagar nada. */
export function expurgoAccessBatchStatement(alvo: AlvoDoExpurgoDeAcesso, agora: Date, limite: number = LOTE_DO_EXPURGO) {
  return APAGAR_LOTE[alvo](agora, limite)
}
