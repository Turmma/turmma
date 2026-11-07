import type { DatabasePool } from '@educa/core'

/**
 * O convite só ativa o usuário se `convite.usado_em >= usuario.desativado_em` (`ativarPorConvite`,
 * `usuarioComConviteAceito`): o usuário que espera o convite nasce inativo com `desativado_em = now()` do convidar, e o
 * aceite grava `usado_em = now()` numa transação que começa depois. As duas horas vêm do relógio do computador, e na
 * máquina de desenvolvimento (WSL2, com o `systemd-timesyncd` ajustando um TSC adiantado) o relógio de parede **recua**
 * de 0,8 a 1,7 s a cada uns 15 s. Se o recuo cai entre o convidar e o aceite, `usado_em` fica antes de `desativado_em`, o
 * login não ativa ninguém e o caso falha por um motivo que não é o que ele prova ('pronta' no lugar de 'escolher', o
 * `CONFLITO` da revogação, a escrita que nunca chega ao gatilho). Na esteira, com o relógio disciplinado, isso não
 * acontece; o produto confia no relógio do banco de propósito.
 *
 * Estes dois ajudantes tiram o caso do relógio **sem mudar a regra que ele prova**: o primeiro põe o `desativado_em` de
 * um usuário recém-convidado um minuto no passado; o segundo desativa um usuário que já entrou, sempre depois do último
 * aceite dele.
 */

/** Depois do convidar: o usuário segue inativo, e o aceite que vier agora é, por construção, posterior ao `desativado_em`. */
export async function anteciparODesativado(pool: DatabasePool, usuarioId: string): Promise<void> {
  await pool.query("update usuario set desativado_em = desativado_em - interval '1 minute' where id = $1 and desativado_em is not null", [usuarioId])
}

/** Desativa o usuário que já entrou: `desativado_em` fica depois de qualquer `usado_em` dele, mesmo com o relógio recuado. */
export async function desativarDepoisDoUltimoAceite(pool: DatabasePool, usuarioId: string): Promise<void> {
  await pool.query(
    "update usuario set desativado_em = greatest(now(), (select max(usado_em) from convite where usuario_id = usuario.id)) + interval '1 second' where id = $1",
    [usuarioId],
  )
}
