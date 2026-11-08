import { ErrorCode, InvariantException } from '@educa/shared'
import { isNotNull, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { convite, type TipoDeConvite } from '../db/schema/convite.js'
import { usuario } from '../db/schema/usuario.js'
import { DomainException } from '../error/domain.exception.js'
import { postgresErrorIn } from '../error/summarize-error.js'

/**
 * A primeira metade da chave do `pg_advisory_xact_lock` que põe em fila, por escola, o que mexe no convite da coordenação
 * dela (Tech Spec da A0b, seção 7c, "Convite da escola" e "Ativação por convite"): gerar, refazer e revogar pelo painel e
 * pelo `ops:*`, e a ativação pelo convite (o aceite, e o login com o bilhete, com ou sem MFA). O convite do professor usa a
 * mesma trava (A1, tarefa 3.0): cadastrar, refazer e revogar pela coordenação da escola, e o job da planilha de professores
 * (onboarding-por-convite, 6.0). A segunda metade é `hashtext` do id da escola, e escolas diferentes não esperam uma pela
 * outra. As outras chaves do código são 7_000_001 (migração) e 7_000_002 (operadores).
 */
export const CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA = 7_000_003

/**
 * O que o convite tem de comum entre a API (`ConviteRepository`, que a estende) e o job da planilha de professores: pôr na fila
 * da trava da escola, achar ou criar o usuário convidado e gravar o convite. Subiu de `apps/api/src/sessao/convite/` na 6.0
 * (Tech Spec do onboarding, seção 6: "o que o worker da 6.0 precisar do convite sobe para o core"). Tudo leva a escola do
 * contexto (regra 10, item 3).
 */
export class ConviteDaEscolaRepository {
  constructor(protected readonly banco: Database | DatabaseTransaction) {}

  /**
   * O usuário convidado, com o papel do convite (o coordenador, pelo operador; o professor, pela coordenação da escola,
   * A1), inativo até o aceite (`desativado_em = now()`). Se a conta já tem usuário inativo desse papel nesta escola
   * (convite revogado ou aceito sem a primeira entrada, ou usuário desativado que a escola chama de volta), ele volta a
   * esperar o convite novo, com `desativado_em` de agora e o nome digitado agora: revogar e gerar (ou cadastrar de novo)
   * com o mesmo e-mail é como se corrige o nome (Tech Spec da A0b, seção 5). O `desativado_em` novo, posterior ao aceite
   * antigo, faz o convite antigo já usado deixar de ativar. Se o usuário está ativo, não devolve nada e não muda nada, nem
   * o nome: não há o que convidar.
   */
  async usuarioConvidado(contaId: string, nome: string, papel: TipoDeConvite): Promise<string | undefined> {
    const [linha] = await this.banco
      .insert(usuario)
      .values({ escolaId: requireEscolaId(), contaId, papel, nome, desativadoEm: sql`now()` })
      .onConflictDoUpdate({
        target: [usuario.escolaId, usuario.contaId, usuario.papel],
        set: { desativadoEm: sql`now()`, nome },
        setWhere: isNotNull(usuario.desativadoEm),
      })
      .returning({ id: usuario.id })
    return linha?.id
  }

  /**
   * Grava o convite do tipo pedido. Se o usuário já tem convite em aberto nesta escola, o índice
   * `convite_pendente_unico` recusa, e a recusa sai como `CONFLITO`: é a rede de segurança da trava da escola.
   *
   * Com `cifrarParaEnvio`, o convite nasce de canal `email`, com o envio `na_fila` e o token e o endereço cifrados (acesso-e-convites, tarefa 3.0): a
   * cifra leva o **id da linha** como dado autenticado, e por isso o id (`uuidv7()`, o mesmo do padrão da coluna, que ordena o desempate do "último
   * convite") sai do banco antes do insert. Sem ele, o convite é o `copiado` de sempre.
   */
  async criarConvite(dados: {
    tipo: TipoDeConvite
    tokenHash: string
    usuarioId: string
    expiraEm: Date
    cifrarParaEnvio?: (conviteId: string) => { tokenCifrado: Buffer; destinoCifrado: Buffer }
  }): Promise<string> {
    let criado: { id: string } | undefined
    const escolaId = requireEscolaId()
    const base = { escolaId, tokenHash: dados.tokenHash, tipo: dados.tipo, usuarioId: dados.usuarioId, expiraEm: dados.expiraEm }
    try {
      if (dados.cifrarParaEnvio === undefined) {
        ;[criado] = await this.banco.insert(convite).values(base).returning({ id: convite.id })
      } else {
        const { rows } = await this.banco.execute<{ id: string }>(sql`select uuidv7() as id`)
        const id = rows[0]?.id
        if (id === undefined) throw new InvariantException('uuidv7 não devolvido pelo banco')
        ;[criado] = await this.banco
          .insert(convite)
          .values({ ...base, id, canal: 'email', envio: 'na_fila', ...dados.cifrarParaEnvio(id) })
          .returning({ id: convite.id })
      }
    } catch (erro) {
      const doPostgres = postgresErrorIn(erro)
      if (doPostgres?.code === '23505' && doPostgres.constraint === 'convite_pendente_unico') throw new DomainException(ErrorCode.CONFLITO)
      throw erro
    }
    if (criado === undefined) throw new InvariantException('convite não devolvido pelo insert')
    return criado.id
  }

  /**
   * Põe a transação na fila da trava do convite da escola do contexto (`pg_advisory_xact_lock(7_000_003,
   * hashtext(escola_id::text))`); solta sozinha no commit ou no rollback. Quem gera, refaz ou revoga pega a trava antes
   * de ler o estado da coordenação, e quem ativa pelo convite a pega como primeira instrução da transação: dois pedidos
   * na mesma escola decidem um depois do outro, cada um vendo o que o anterior gravou.
   */
  async travarEscola(): Promise<void> {
    await this.banco.execute(sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA}, hashtext(${requireEscolaId()}::uuid::text))`)
  }
}
