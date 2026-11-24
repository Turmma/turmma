import { atividadeAplicada, extensaoDeTempo, pulsoDaApi, requireAnoEmCurso, requireEscolaId, requestSessao, tentativaAtividade, usuario, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import type { EnvioDaTentativa, EstadoDeAtividadeAplicada, ExtensaoDoLimite, IntervaloDeIndisponibilidade, PulsoDoLimite } from '@educa/shared'
import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { comVinculoConfirmadoDoProfessor, disciplinaDoArtefato } from '../../assistente/turma-do-professor.repository.js'

/** A tentativa do aluno como o acompanhamento a lê: só o que decide a situação e o limite. Nenhuma saída da aba (D70, D88). */
export interface TentativaDoAcompanhamento {
  readonly iniciadaEm: Date
  readonly enviadaEm: Date | null
  readonly envio: EnvioDaTentativa | null
  /** `limite_base_em`: nulo quando a prova não tem duração nem janela, e então não há limite. */
  readonly limiteBase: Date | null
}

/** Um aluno da turma com tudo o que `limiteDaTentativa` consome, lido na **mesma consulta** da lista. */
export interface AlunoDoAcompanhamento {
  readonly alunoId: string
  readonly nome: string
  /** Nulo: o aluno ainda não começou. */
  readonly tentativa: TentativaDoAcompanhamento | null
  /** As extensões da aplicação, as de cada aluno e as da turma: `limiteDaTentativa` escolhe as que valem para ele. */
  readonly extensoes: readonly ExtensaoDoLimite[]
  /** As indisponibilidades que terminam depois do começo da tentativa dele. */
  readonly indisponibilidades: readonly IntervaloDeIndisponibilidade[]
  readonly pulso: PulsoDoLimite | null
}

export interface LeituraDoAcompanhamento {
  readonly atividadeAplicadaId: string
  readonly estado: EstadoDeAtividadeAplicada
  /** O `now()` do banco: o relógio de toda a leitura, o mesmo do `limiteDaTentativa`. */
  readonly agora: Date
  readonly alunos: readonly AlunoDoAcompanhamento[]
}

/** Como as extensões e as indisponibilidades saem do `jsonb` da consulta: instantes em texto, que o repository converte. */
interface ExtensaoLida {
  readonly alunoId: string | null
  readonly minutos: number
}
interface IndisponibilidadeLida {
  readonly inicio: string
  readonly fim: string
}

/**
 * A aplicação no alcance do professor do contexto (regra 10, itens 3 e 4): escola e ano em curso do contexto e vínculo `confirmado` **na turma e na disciplina
 * do artefato dela**. O professor de outra escola, de outra turma, de outra disciplina, sem vínculo, e a coordenação e o aluno (que não têm vínculo de professor) não a alcançam.
 */
function noAlcanceDoProfessor(banco: Database | DatabaseTransaction): SQL | undefined {
  return and(
    eq(atividadeAplicada.escolaId, requireEscolaId()),
    eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
    comVinculoConfirmadoDoProfessor(banco, atividadeAplicada, disciplinaDoArtefato(banco, atividadeAplicada)),
  )
}

/**
 * O acompanhamento da prova (avaliacao-e-correcao, 5.0; RF4; Tech Spec §4 e §5.4): por aluno da turma, a tentativa, as extensões que valem para ele, as indisponibilidades
 * e o pulso, **numa consulta só** (`consulta`), com uma visão só do banco. Quem a usa calcula o `limiteDaTentativa` de cada aluno **em memória**, com a função pura: o
 * acompanhamento é relido a cada 15 s por professor, e uma leitura por aluno seriam 35 idas ao banco a cada volta. Nada daqui devolve a contagem de saídas da aba.
 */
export class AcompanhamentoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A consulta, sem executar (o `EXPLAIN` do teste lê o `.toSQL()` dela). Parte da aplicação no alcance e a junta ao vínculo `confirmado` de aluno da turma **dela** (a turma é
   * a da própria linha, nunca a do chamador), ao usuário ativo e à tentativa. A aplicação sem aluno devolve uma linha com o aluno nulo, para distinguir "sem alunos" de "fora do alcance".
   */
  consulta(atividadeAplicadaId: string) {
    return this.banco
      .select({
        estado: atividadeAplicada.estado,
        agora: sql`now()`.mapWith(tentativaAtividade.iniciadaEm),
        alunoId: vinculo.usuarioId,
        nome: usuario.nome,
        iniciadaEm: tentativaAtividade.iniciadaEm,
        enviadaEm: tentativaAtividade.enviadaEm,
        envio: tentativaAtividade.envio,
        limiteBase: tentativaAtividade.limiteBaseEm,
        ultimoPulso: sql`(select ${pulsoDaApi.ultimoEm} from ${pulsoDaApi} limit 1)`.mapWith(pulsoDaApi.ultimoEm),
        extensoes: sql<ExtensaoLida[]>`(select coalesce(jsonb_agg(jsonb_build_object('alunoId', ${extensaoDeTempo.alunoId}, 'minutos', ${extensaoDeTempo.minutos})), '[]'::jsonb) from ${extensaoDeTempo} where ${extensaoDeTempo.escolaId} = ${atividadeAplicada.escolaId} and ${extensaoDeTempo.atividadeAplicadaId} = ${atividadeAplicada.id})`,
        indisponibilidades: sql<IndisponibilidadeLida[]>`(select coalesce(jsonb_agg(jsonb_build_object('inicio', i.inicio, 'fim', i.fim)), '[]'::jsonb) from indisponibilidade i where i.fim > ${tentativaAtividade.iniciadaEm})`,
      })
      .from(atividadeAplicada)
      .leftJoin(
        vinculo,
        and(
          eq(vinculo.escolaId, atividadeAplicada.escolaId),
          eq(vinculo.anoLetivoId, atividadeAplicada.anoLetivoId),
          eq(vinculo.turmaId, atividadeAplicada.turmaId),
          eq(vinculo.papel, 'aluno'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
      .leftJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId), isNull(usuario.desativadoEm)))
      .leftJoin(
        tentativaAtividade,
        and(
          eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId),
          eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId),
          eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id),
          eq(tentativaAtividade.alunoId, vinculo.usuarioId),
        ),
      )
      .where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
      .orderBy(asc(usuario.nome), asc(vinculo.usuarioId))
  }

  /** A leitura do acompanhamento, ou `undefined` se a aplicação não está no alcance do professor (a de outra escola, outra turma, outra disciplina, outro ano e a inexistente). */
  async read(atividadeAplicadaId: string): Promise<LeituraDoAcompanhamento | undefined> {
    const linhas = await this.consulta(atividadeAplicadaId)
    const [primeira] = linhas
    if (primeira === undefined) return undefined
    const alunos: AlunoDoAcompanhamento[] = []
    for (const linha of linhas) {
      // Aluno de conta desativada tem o vínculo e não tem o usuário na junção: fica fora da lista. A turma sem aluno devolve uma linha só, com o aluno nulo.
      if (linha.alunoId === null || linha.nome === null) continue
      alunos.push({
        alunoId: linha.alunoId,
        nome: linha.nome,
        tentativa: linha.iniciadaEm === null ? null : { iniciadaEm: linha.iniciadaEm, enviadaEm: linha.enviadaEm, envio: linha.envio, limiteBase: linha.limiteBase },
        extensoes: linha.extensoes.map((extensao) => ({ alunoId: extensao.alunoId, minutos: extensao.minutos })),
        indisponibilidades: linha.indisponibilidades.map((queda) => ({ inicio: new Date(queda.inicio), fim: new Date(queda.fim) })),
        pulso: linha.ultimoPulso === null ? null : { ultimoEm: linha.ultimoPulso, agora: linha.agora },
      })
    }
    return { atividadeAplicadaId, estado: primeira.estado, agora: primeira.agora, alunos }
  }
}

/** A aplicação travada para estender: o que decide se a extensão cabe, e a turma de onde vêm os alunos. */
export interface AplicacaoParaEstender {
  readonly id: string
  readonly turmaId: string
  readonly estado: EstadoDeAtividadeAplicada
}

/**
 * A extensão de tempo (avaliacao-e-correcao, 5.0; RF4; Tech Spec §4, §5.6 e §6): o professor da turma e da disciplina dá minutos a mais a um aluno ou à turma. **A tabela só se toca
 * por aqui**, e o escopo (escola, ano em curso e vínculo do professor) é o do contexto, nunca o do corpo. Que o aluno é da turma da aplicação o banco não garante (só que é da escola):
 * quem chama confere antes, com `alunosDaTurmaEntre`.
 */
export class ExtensaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A aplicação no alcance do professor **travada em `for share`** até o fim da transação (§5.6). O `encerrar` e a rotina que encerra a prova vencida a tomam em `for update`: uma
   * extensão que chega com o encerramento em andamento espera, relê o estado e recebe `ATIVIDADE_ENCERRADA` sem gravar; e a rotina que chega com a extensão em andamento espera
   * a extensão confirmar e relê o fim efetivo. Duas extensões ao mesmo tempo não se travam entre si (`for share` convive com `for share`): quem as ordena é a chave única.
   */
  async lockParaEstender(atividadeAplicadaId: string): Promise<AplicacaoParaEstender | undefined> {
    const [linha] = await this.banco
      .select({ id: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, estado: atividadeAplicada.estado })
      .from(atividadeAplicada)
      .where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
      .for('share', { of: atividadeAplicada })
    return linha
  }

  /**
   * Grava a extensão, com a pessoa da sessão como quem a deu e a hora do banco. A `chave` é por aplicação: o mesmo pedido de novo (o clique duplo, o reenvio da fila) não grava outra
   * linha, e a segunda chamada ao mesmo tempo espera a primeira confirmar. Devolve `true` se gravou, `false` se a chave já estava gravada. Sem motivo: a tabela não tem onde guardá-lo.
   */
  async save(atividadeAplicadaId: string, extensao: { readonly alunoId?: string | undefined; readonly minutos: number; readonly chave: string }): Promise<boolean> {
    const gravadas = await this.banco
      .insert(extensaoDeTempo)
      .values({
        escolaId: requireEscolaId(),
        anoLetivoId: requireAnoEmCurso(),
        atividadeAplicadaId,
        alunoId: extensao.alunoId?.toLowerCase() ?? null,
        minutos: extensao.minutos,
        concedidaPor: requestSessao().usuarioId,
        chave: extensao.chave.toLowerCase(),
      })
      .onConflictDoNothing({ target: [extensaoDeTempo.escolaId, extensaoDeTempo.atividadeAplicadaId, extensaoDeTempo.chave] })
      .returning({ id: extensaoDeTempo.id })
    return gravadas.length > 0
  }
}
