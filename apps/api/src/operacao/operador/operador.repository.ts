import {
  acessoOperacao,
  auditoriaOperacao,
  codigoRecuperacaoOperador,
  conviteOperador,
  ErroDeDominio,
  operador,
  sessaoOperador,
  type AcaoDaAuditoriaDaOperacao,
  type Banco,
  type EventoDeAcessoDaOperacao,
  type MotivoDeEncerramentoDeOperador,
  type TransacaoBanco,
} from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { and, count, eq, exists, isNull, lt, or, sql } from 'drizzle-orm'
import { DURACAO_DA_SESSAO_DE_OPERADOR_HORAS, type SessaoDeOperadorParaGuarda, type SessaoDeOperadorParaRenovar } from '../sessao/prazos-da-sessao.js'

/**
 * Chave do `pg_advisory_xact_lock` que põe em fila o `criar` e o `desativar` do `ops:operador` (Tech Spec da A0, seção
 * 5, "Nascimento"). Com ela, dois `criar` de bootstrap não veem os dois "nenhum operador ativo", e dois `desativar`
 * cruzados não zeram os ativos. A da migração é 7_000_001.
 */
export const CHAVE_DA_TRAVA_DOS_OPERADORES = 7_000_002

/** De quanto em quanto tempo, no máximo, a sessão do operador tem o uso gravado (Tech Spec da A0, seção 5). */
export const INTERVALO_DE_GRAVACAO_DO_USO_SEGUNDOS = 60

/**
 * Até quantas horas depois do aceite do convite a entrada por e-mail ainda leva a configurar o segundo fator (Tech Spec
 * da A0, seção 5, "Etapas"). Depois disso, sem segundo fator ativo, a senha certa responde igual à errada, e o caminho
 * é um convite novo.
 */
export const PRAZO_PARA_CONFIGURAR_O_SEGUNDO_FATOR_HORAS = 72

/**
 * O que a entrada por e-mail lê do operador ativo, numa consulta: o id, o hash da senha, se o segundo fator está ativo e
 * se o último aceite de convite ainda está nas 72 h. Nada de nome, e-mail nem segredo.
 */
export interface CredencialDeEntrada {
  readonly operadorId: string
  readonly senhaHash: string | null
  readonly mfaAtivo: boolean
  readonly aceiteRecente: boolean
}

/**
 * Quem roda o comando, pelo `OPERADOR` do ambiente:
 * - `bootstrap`: não há operador ativo, e qualquer `OPERADOR` no formato é aceito (o nascimento);
 * - `ativo`: há operador ativo, e o `OPERADOR` é um deles;
 * - `recusado`: há operador ativo, e o `OPERADOR` não existe ou foi desativado.
 */
export type SituacaoDoAutor = 'bootstrap' | 'ativo' | 'recusado'

/** Quem assina uma escrita do operador: o operador da sessão do painel, pelo id, ou o `OPERADOR` do comando, pelo apelido. */
export type QuemEscreve = { readonly operadorId: string } | { readonly apelido: string }

export interface OperadorAlvo {
  readonly id: string
  readonly apelido: string
}

/** O convite que ainda vale, pelo hash do token: os dois ids, e nada do operador. */
export interface ConviteValido {
  readonly conviteId: string
  readonly operadorId: string
}

/**
 * O que o `/sessao/mfa` lê do operador ativo, com a linha travada: o e-mail (só para o cookie de dispositivo, nunca
 * sai do service), o segredo cifrado com a versão da chave, a versão do segredo e se o segundo fator está ativo.
 */
export interface OperadorParaSegundoFator {
  readonly id: string
  /** O apelido: o autor da auditoria `operador.mfa_configurado`, que é o operador da sessão que se abre. */
  readonly apelido: string
  readonly email: string
  readonly segredoCifrado: Buffer | null
  readonly chaveVersao: number | null
  readonly mfaVersao: number
  readonly mfaAtivo: boolean
}

/** O que `GET /v1/operacao/eu` devolve do operador: o apelido e o nome, e nada mais. */
export interface OperadorDaSessao {
  readonly apelido: string
  readonly nome: string
}

/**
 * O único código que toca as seis tabelas da operação (Tech Spec da A0, seção 6; o expurgo entra na tarefa 9.0). As
 * tabelas são da nossa equipe e não têm `escola_id`, então nenhum método leva escopo de escola nem `@SemEscopo`; o
 * contrapeso é que este repository não toca nenhuma outra tabela, e nenhuma outra classe toca estas (C45, em
 * `apps/api/test/arquitetura.test.ts`).
 *
 * Recebe o banco ou a transação de quem chama: o `ops:operador` grava tudo de uma operação numa transação só.
 * Devolve id e apelido, e o nome só ao `eu` do próprio operador (`daSessao`): e-mail, hash e segredo nunca saem daqui.
 */
export class OperadorRepository {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  /**
   * O autor ativo de uma escrita, dentro da transação dela (Tech Spec da A0b, seção 7c, "Autor ativo"): `select apelido
   * from operador where id (ou apelido) = $1 and desativado_em is null for share`. O `for share` segura a linha até o fim
   * da transação, e o `desativar` começa pelo `for update` dessa linha: se ele chegou antes, a escrita espera, relê a
   * condição depois do commit dele e não acha o operador; se a escrita chegou antes, o `desativar` espera ela confirmar,
   * com a auditoria. Devolve o apelido, ou `undefined` quando não há operador ativo com esse id ou apelido.
   *
   * Recebe a transação, e não o banco: fora de uma, o `for share` soltaria a linha na hora e não seguraria nada.
   */
  static async autorAtivoNaTransacao(tx: TransacaoBanco, quem: QuemEscreve): Promise<string | undefined> {
    const [linha] = await tx
      .select({ apelido: operador.apelido })
      .from(operador)
      .where(and('operadorId' in quem ? eq(operador.id, quem.operadorId) : eq(operador.apelido, quem.apelido), isNull(operador.desativadoEm)))
      .for('share')
    return linha?.apelido
  }

  /** Põe a transação na fila da trava dos operadores; solta sozinha no commit ou no rollback. */
  async travarOperadores(): Promise<void> {
    await this.banco.execute(sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DOS_OPERADORES})`)
  }

  /** A situação do `OPERADOR` numa consulta só: há ativo, e ele é um deles. */
  async situacaoDoAutor(apelido: string): Promise<SituacaoDoAutor> {
    const [linha] = await this.banco
      .select({
        haAtivo: sql<boolean>`bool_or(${operador.desativadoEm} is null)`,
        ehAtivo: sql<boolean>`bool_or(${operador.desativadoEm} is null and ${operador.apelido} = ${apelido})`,
      })
      .from(operador)
    if (linha?.haAtivo !== true) return 'bootstrap'
    return linha.ehAtivo ? 'ativo' : 'recusado'
  }

  /** O operador ativo com este apelido, com a linha travada até o fim da transação (`desativar`, `convite`). */
  async ativoParaAtualizar(apelido: string): Promise<OperadorAlvo | undefined> {
    const [linha] = await this.banco
      .select({ id: operador.id, apelido: operador.apelido })
      .from(operador)
      .where(and(eq(operador.apelido, apelido), isNull(operador.desativadoEm)))
      .for('update')
    return linha
  }

  async contarAtivos(): Promise<number> {
    const [linha] = await this.banco.select({ total: count() }).from(operador).where(isNull(operador.desativadoEm))
    return linha?.total ?? 0
  }

  /** Apelido ou e-mail repetido sai como erro do banco (23505), que o comando traduz sem o valor. */
  async criar(dados: { apelido: string; nome: string; email: string }): Promise<string> {
    const [criado] = await this.banco.insert(operador).values(dados).returning({ id: operador.id })
    if (criado === undefined) throw new ErroDeDominio(ErrorCode.ERRO_INTERNO)
    return criado.id
  }

  async criarConvite(dados: { operadorId: string; tokenHash: string; expiraEm: Date }): Promise<string> {
    const [criado] = await this.banco.insert(conviteOperador).values(dados).returning({ id: conviteOperador.id })
    if (criado === undefined) throw new ErroDeDominio(ErrorCode.ERRO_INTERNO)
    return criado.id
  }

  /** Revoga o convite pendente do operador, se houver (há no máximo um, pelo único parcial). Devolve se revogou. */
  async revogarConvitePendente(operadorId: string): Promise<boolean> {
    const revogados = await this.banco
      .update(conviteOperador)
      .set({ revogadoEm: sql`now()` })
      .where(and(eq(conviteOperador.operadorId, operadorId), isNull(conviteOperador.usadoEm), isNull(conviteOperador.revogadoEm)))
      .returning({ id: conviteOperador.id })
    return revogados.length > 0
  }

  /**
   * Apaga o dado pessoal e marca a desativação: ficam id, apelido, `criado_em`, `desativado_em` e o contador
   * `mfa_versao`. Devolve se desativou (a linha já estava travada por `ativoParaAtualizar`).
   */
  async desativar(operadorId: string): Promise<boolean> {
    const desativados = await this.banco
      .update(operador)
      .set({
        nome: null,
        email: null,
        senhaHash: null,
        mfaSegredoCifrado: null,
        mfaChaveVersao: null,
        mfaAtivadoEm: null,
        mfaUltimoPasso: null,
        desativadoEm: sql`now()`,
      })
      .where(and(eq(operador.id, operadorId), isNull(operador.desativadoEm)))
      .returning({ id: operador.id })
    return desativados.length > 0
  }

  async apagarCodigosDeRecuperacao(operadorId: string): Promise<void> {
    await this.banco.delete(codigoRecuperacaoOperador).where(eq(codigoRecuperacaoOperador.operadorId, operadorId))
  }

  async encerrarSessoes(operadorId: string, motivo: MotivoDeEncerramentoDeOperador): Promise<void> {
    await this.banco
      .update(sessaoOperador)
      .set({ encerradaEm: sql`now()`, motivo })
      .where(and(eq(sessaoOperador.operadorId, operadorId), isNull(sessaoOperador.encerradaEm)))
  }

  /**
   * A sessão do token de operador, com o operador dela, para a `GuardaDeOperador`. Só casa a sessão **deste** operador:
   * um `sid` de outro operador no token não lê nada.
   */
  async lerSessaoParaGuarda(sessaoId: string, operadorId: string): Promise<SessaoDeOperadorParaGuarda | undefined> {
    const [linha] = await this.banco
      .select({
        encerradaEm: sessaoOperador.encerradaEm,
        expiraEm: sessaoOperador.expiraEm,
        ultimoUsoEm: sessaoOperador.ultimoUsoEm,
        operadorDesativadoEm: operador.desativadoEm,
        agora: sql<Date>`now()`.mapWith(sessaoOperador.expiraEm),
      })
      .from(sessaoOperador)
      .innerJoin(operador, eq(operador.id, sessaoOperador.operadorId))
      .where(and(eq(sessaoOperador.id, sessaoId), eq(sessaoOperador.operadorId, operadorId)))
      .limit(1)
    return linha
  }

  /**
   * Grava o uso da sessão, no máximo uma vez por minuto: a condição está no próprio `update`, e por isso vinte
   * requisições juntas gravam uma vez só (a primeira trava a linha; as outras, liberadas, releem a condição e não casam).
   * Sessão encerrada não é tocada. Devolve se gravou.
   */
  async marcarUsoDaSessao(sessaoId: string, operadorId: string): Promise<boolean> {
    const marcadas = await this.banco
      .update(sessaoOperador)
      .set({ ultimoUsoEm: sql`now()` })
      .where(
        and(
          eq(sessaoOperador.id, sessaoId),
          eq(sessaoOperador.operadorId, operadorId),
          isNull(sessaoOperador.encerradaEm),
          sql`${sessaoOperador.ultimoUsoEm} <= now() - make_interval(secs => ${INTERVALO_DE_GRAVACAO_DO_USO_SEGUNDOS})`,
        ),
      )
      .returning({ id: sessaoOperador.id })
    return marcadas.length > 0
  }

  /**
   * A sessão do cookie de renovação, pelo hash do refresh atual **ou** do anterior, com o operador dela e a hora do
   * banco. Sem trava: quem decide a corrida é a condição do `rotacionarSessao`.
   */
  async sessaoParaRenovar(refreshHash: string): Promise<SessaoDeOperadorParaRenovar | undefined> {
    const [linha] = await this.banco
      .select({
        id: sessaoOperador.id,
        operadorId: sessaoOperador.operadorId,
        pelo: sql<'atual' | 'anterior'>`case when ${sessaoOperador.refreshHash} = ${refreshHash} then 'atual' else 'anterior' end`,
        rotacionadoEm: sessaoOperador.rotacionadoEm,
        encerradaEm: sessaoOperador.encerradaEm,
        expiraEm: sessaoOperador.expiraEm,
        ultimoUsoEm: sessaoOperador.ultimoUsoEm,
        operadorDesativadoEm: operador.desativadoEm,
        agora: sql<Date>`now()`.mapWith(sessaoOperador.expiraEm),
      })
      .from(sessaoOperador)
      .innerJoin(operador, eq(operador.id, sessaoOperador.operadorId))
      .where(or(eq(sessaoOperador.refreshHash, refreshHash), eq(sessaoOperador.refreshHashAnterior, refreshHash)))
      .limit(1)
    return linha
  }

  /**
   * A trava da renovação (Tech Spec da A0, seção 5): `update … set refresh_hash = $novo, refresh_hash_anterior = $atual,
   * rotacionado_em = now() where id = $1 and refresh_hash = $atual and encerrada_em is null`. Duas renovações com o
   * mesmo cookie: a primeira rotaciona; a segunda espera a linha, relê a condição e não casa. Devolve se rotacionou.
   */
  async rotacionarSessao(dados: { sessaoId: string; refreshHashAtual: string; refreshHashNovo: string }): Promise<boolean> {
    const rotacionadas = await this.banco
      .update(sessaoOperador)
      .set({ refreshHash: dados.refreshHashNovo, refreshHashAnterior: dados.refreshHashAtual, rotacionadoEm: sql`now()` })
      .where(and(eq(sessaoOperador.id, dados.sessaoId), eq(sessaoOperador.refreshHash, dados.refreshHashAtual), isNull(sessaoOperador.encerradaEm)))
      .returning({ id: sessaoOperador.id })
    return rotacionadas.length > 0
  }

  /** Encerra uma sessão aberta, com o motivo. Devolve se encerrou (a já encerrada não muda de motivo). */
  async encerrarSessao(sessaoId: string, motivo: MotivoDeEncerramentoDeOperador): Promise<boolean> {
    const encerradas = await this.banco
      .update(sessaoOperador)
      .set({ encerradaEm: sql`now()`, motivo })
      .where(and(eq(sessaoOperador.id, sessaoId), isNull(sessaoOperador.encerradaEm)))
      .returning({ id: sessaoOperador.id })
    return encerradas.length > 0
  }

  /**
   * A saída: encerra a sessão aberta do cookie, pelo refresh atual ou pelo anterior, com motivo `saida`. Devolve o
   * operador da sessão encerrada, ou `undefined` se não havia sessão aberta com esse cookie.
   */
  async encerrarSessaoPelaSaida(refreshHash: string): Promise<string | undefined> {
    const [encerrada] = await this.banco
      .update(sessaoOperador)
      .set({ encerradaEm: sql`now()`, motivo: 'saida' })
      .where(and(or(eq(sessaoOperador.refreshHash, refreshHash), eq(sessaoOperador.refreshHashAnterior, refreshHash)), isNull(sessaoOperador.encerradaEm)))
      .returning({ operadorId: sessaoOperador.operadorId })
    return encerrada?.operadorId
  }

  /** O apelido e o nome do operador ativo, para `GET /v1/operacao/eu`. Desativado não tem nome, e não volta. */
  async daSessao(operadorId: string): Promise<OperadorDaSessao | undefined> {
    const [linha] = await this.banco
      .select({ apelido: operador.apelido, nome: operador.nome })
      .from(operador)
      .where(and(eq(operador.id, operadorId), isNull(operador.desativadoEm)))
      .limit(1)
    if (linha?.nome === null || linha === undefined) return undefined
    return { apelido: linha.apelido, nome: linha.nome }
  }

  /**
   * O convite pendente deste hash, que ainda vale: nem usado, nem revogado, nem vencido, e de operador ativo. Devolve só
   * os dois ids; o que não vale volta `undefined`, qualquer que seja o motivo (C9).
   */
  async conviteValidoPorHash(tokenHash: string): Promise<ConviteValido | undefined> {
    const [linha] = await this.banco
      .select({ conviteId: conviteOperador.id, operadorId: conviteOperador.operadorId })
      .from(conviteOperador)
      .innerJoin(operador, eq(operador.id, conviteOperador.operadorId))
      .where(
        and(
          eq(conviteOperador.tokenHash, tokenHash),
          isNull(conviteOperador.usadoEm),
          isNull(conviteOperador.revogadoEm),
          sql`${conviteOperador.expiraEm} > now()`,
          isNull(operador.desativadoEm),
        ),
      )
      .limit(1)
    return linha
  }

  /**
   * O aceite do convite (Tech Spec da A0, seção 5, "Travas no banco"), dentro da transação de quem chama:
   * 1. trava a linha do operador ativo (`for update … where desativado_em is null`), a mesma que o `desativar` trava
   *    primeiro: um espera o outro, e o aceite que chega depois do `desativar` não acha o operador;
   * 2. usa o convite: `update … set usado_em = now() where … usado_em is null and revogado_em is null and expira_em >
   *    now()`, com `returning`. Dois aceites juntos: um usa, o outro não casa;
   * 3. grava a senha e zera o segundo fator (segredo, chave, ativação, último passo e códigos de recuperação): o convite
   *    novo é o caminho de recuperar a conta (PRD da A0, seções 3 e 7), e leva a configurar o segundo fator de novo.
   *
   * Devolve o apelido do operador que aceitou (o autor da auditoria do aceite, que quem chama grava na mesma transação),
   * ou `undefined` quando não aceitou. Quem perde não grava nada.
   */
  async aceitarConvite(dados: { conviteId: string; operadorId: string; senhaHash: string }): Promise<string | undefined> {
    const [ativo] = await this.banco
      .select({ apelido: operador.apelido })
      .from(operador)
      .where(and(eq(operador.id, dados.operadorId), isNull(operador.desativadoEm)))
      .for('update')
    if (ativo === undefined) return undefined
    const usados = await this.banco
      .update(conviteOperador)
      .set({ usadoEm: sql`now()` })
      .where(
        and(
          eq(conviteOperador.id, dados.conviteId),
          eq(conviteOperador.operadorId, dados.operadorId),
          isNull(conviteOperador.usadoEm),
          isNull(conviteOperador.revogadoEm),
          sql`${conviteOperador.expiraEm} > now()`,
        ),
      )
      .returning({ id: conviteOperador.id })
    if (usados.length === 0) return undefined
    const gravados = await this.banco
      .update(operador)
      .set({ senhaHash: dados.senhaHash, mfaSegredoCifrado: null, mfaChaveVersao: null, mfaAtivadoEm: null, mfaUltimoPasso: null })
      .where(and(eq(operador.id, dados.operadorId), isNull(operador.desativadoEm)))
      .returning({ id: operador.id })
    // A linha está travada desde o passo 1: só não casa se alguém mudou a trava; aí nada do aceite fica.
    if (gravados.length === 0) throw new ErroDeDominio(ErrorCode.ERRO_INTERNO)
    await this.apagarCodigosDeRecuperacao(dados.operadorId)
    return ativo.apelido
  }

  /**
   * A trava "configurar" (Tech Spec da A0, seção 5, "Travas no banco"), o primeiro passo da transação de quem chama:
   * `update operador set mfa_segredo_cifrado = $s, mfa_versao = mfa_versao + 1 … where id = $1 and mfa_ativado_em is
   * null and desativado_em is null returning mfa_versao`. O `update` trava a linha, a mesma que o `desativar` e o
   * `/sessao/mfa` travam primeiro: o que chega depois espera. O passo usado volta a nulo, porque o segredo é outro.
   *
   * Devolve a versão nova, ou `undefined` quando o segundo fator já está ativo ou o operador foi desativado: aí nada
   * foi gravado, e quem chama recusa como desafio inválido.
   */
  async gravarSegredoParaConfigurar(dados: { operadorId: string; segredoCifrado: Buffer; chaveVersao: number }): Promise<number | undefined> {
    const [gravado] = await this.banco
      .update(operador)
      .set({ mfaSegredoCifrado: dados.segredoCifrado, mfaChaveVersao: dados.chaveVersao, mfaVersao: sql`${operador.mfaVersao} + 1`, mfaUltimoPasso: null })
      .where(and(eq(operador.id, dados.operadorId), isNull(operador.mfaAtivadoEm), isNull(operador.desativadoEm)))
      .returning({ versao: operador.mfaVersao })
    return gravado?.versao
  }

  /**
   * Troca os códigos de recuperação do operador pelos deste segredo: apaga os que houver e insere os novos, na mesma
   * transação da `gravarSegredoParaConfigurar` (com a linha do operador já travada por ela).
   */
  async trocarCodigosDeRecuperacao(operadorId: string, hmacs: readonly string[]): Promise<void> {
    await this.apagarCodigosDeRecuperacao(operadorId)
    if (hmacs.length > 0) await this.banco.insert(codigoRecuperacaoOperador).values(hmacs.map((hmac) => ({ operadorId, hmac })))
  }

  /**
   * O primeiro passo da transação do `/sessao/mfa` (Tech Spec da A0, seção 5): `select … for update where id = $1 and
   * desativado_em is null`. É a mesma linha que o `desativar` trava primeiro: se ele confirmou antes, o operador não é
   * achado; se chegou depois, espera esta transação terminar e encerra a sessão que ela abriu.
   */
  async ativoParaSegundoFator(operadorId: string): Promise<OperadorParaSegundoFator | undefined> {
    const [linha] = await this.banco
      .select({
        id: operador.id,
        email: operador.email,
        segredoCifrado: operador.mfaSegredoCifrado,
        chaveVersao: operador.mfaChaveVersao,
        mfaVersao: operador.mfaVersao,
        mfaAtivadoEm: operador.mfaAtivadoEm,
        apelido: operador.apelido,
      })
      .from(operador)
      .where(and(eq(operador.id, operadorId), isNull(operador.desativadoEm)))
      .for('update')
    // O ativo sempre tem e-mail (check `operador_ativo_com_nome_e_email`).
    if (linha === undefined || linha.email === null) return undefined
    const { mfaAtivadoEm, email, ...resto } = linha
    return { ...resto, email, mfaAtivo: mfaAtivadoEm !== null }
  }

  /**
   * Gasta o passo do código do app: `set mfa_ultimo_passo = $p where mfa_ultimo_passo is null or mfa_ultimo_passo <
   * $p`. O mesmo código, ou o de um passo já usado, não casa. Devolve se gastou.
   */
  async avancarPassoDoSegundoFator(operadorId: string, passo: number): Promise<boolean> {
    const avancados = await this.banco
      .update(operador)
      .set({ mfaUltimoPasso: passo })
      .where(and(eq(operador.id, operadorId), isNull(operador.desativadoEm), or(isNull(operador.mfaUltimoPasso), lt(operador.mfaUltimoPasso, passo))))
      .returning({ id: operador.id })
    return avancados.length > 0
  }

  /** Gasta um código de recuperação: `delete … returning`. O mesmo código duas vezes: a segunda não acha nada. */
  async usarCodigoDeRecuperacao(operadorId: string, hmac: string): Promise<boolean> {
    const usados = await this.banco
      .delete(codigoRecuperacaoOperador)
      .where(and(eq(codigoRecuperacaoOperador.operadorId, operadorId), eq(codigoRecuperacaoOperador.hmac, hmac)))
      .returning({ hmac: codigoRecuperacaoOperador.hmac })
    return usados.length > 0
  }

  /**
   * Ativa o segundo fator no primeiro código válido, só com o segredo da versão conferida: `where mfa_versao = $v and
   * mfa_ativado_em is null`. Devolve se ativou.
   */
  async ativarSegundoFator(operadorId: string, versao: number): Promise<boolean> {
    const ativados = await this.banco
      .update(operador)
      .set({ mfaAtivadoEm: sql`now()` })
      .where(and(eq(operador.id, operadorId), eq(operador.mfaVersao, versao), isNull(operador.mfaAtivadoEm), isNull(operador.desativadoEm)))
      .returning({ id: operador.id })
    return ativados.length > 0
  }

  /** A sessão nova do operador, de 8 h, com o hash do refresh. Devolve o id. */
  async abrirSessao(operadorId: string, refreshHash: string): Promise<string> {
    const [criada] = await this.banco
      .insert(sessaoOperador)
      .values({ operadorId, refreshHash, expiraEm: sql`now() + make_interval(hours => ${DURACAO_DA_SESSAO_DE_OPERADOR_HORAS})` })
      .returning({ id: sessaoOperador.id })
    if (criada === undefined) throw new ErroDeDominio(ErrorCode.ERRO_INTERNO)
    return criada.id
  }

  /**
   * A credencial do operador **ativo** com este e-mail (já normalizado; a coluna é `citext`), para a entrada por e-mail.
   * O desativado não tem e-mail, e o filtro repete a condição: ele responde igual ao e-mail que não existe. O prazo do
   * aceite é medido no relógio do banco, o mesmo que gravou `usado_em`.
   */
  async credencialDeEntrada(email: string): Promise<CredencialDeEntrada | undefined> {
    const [linha] = await this.banco
      .select({
        operadorId: operador.id,
        senhaHash: operador.senhaHash,
        mfaAtivo: sql<boolean>`${operador.mfaAtivadoEm} is not null`,
        aceiteRecente: sql<boolean>`${exists(
          this.banco
            .select({ um: sql`1` })
            .from(conviteOperador)
            .where(
              and(
                eq(conviteOperador.operadorId, operador.id),
                sql`${conviteOperador.usadoEm} > now() - make_interval(hours => ${PRAZO_PARA_CONFIGURAR_O_SEGUNDO_FATOR_HORAS})`,
              ),
            ),
        )}`,
      })
      .from(operador)
      .where(and(eq(operador.email, email), isNull(operador.desativadoEm)))
      .limit(1)
    return linha
  }

  /** A entrada que falhou, em `acesso_operacao`: evento, IP e data. Sem operador e sem o e-mail digitado (C25). */
  async registrarFalhaDeEntrada(ip: string): Promise<void> {
    await this.banco.insert(acessoOperacao).values({ operadorId: null, evento: 'entrada_falha', ip })
  }

  /** A entrada ou a saída do operador, em `acesso_operacao`: evento, operador, IP e data (Marco Civil, art. 15). */
  async registrarAcesso(evento: Exclude<EventoDeAcessoDaOperacao, 'entrada_falha'>, operadorId: string, ip: string): Promise<void> {
    await this.banco.insert(acessoOperacao).values({ operadorId, evento, ip })
  }

  /** A auditoria da operação: autor (apelido ou `bootstrap`), ação da lista fechada e operador alvo. Nada mais. */
  async auditar(registro: { autor: string; acao: AcaoDaAuditoriaDaOperacao; operadorAlvoId: string }): Promise<void> {
    await this.banco.insert(auditoriaOperacao).values(registro)
  }
}
