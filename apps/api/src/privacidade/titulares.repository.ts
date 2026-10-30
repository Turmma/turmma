import {
  currentContext,
  credencialMatricula,
  disciplina,
  requireEscolaId,
  haHomonimoDoTitular,
  requestIdentity,
  turma,
  usuario,
  vinculo,
  type Database,
  type DatabaseTransaction,
} from '@educa/nucleo'
import {
  CATEGORIAS_DE_CADASTRO_E_VINCULO,
  CHAVES_DE_RETENCAO,
  InvariantException,
  MAXIMO_DE_RESULTADOS_DA_BUSCA,
  type CategoriaDeRetencao,
  type EstadoDoTitular,
  type PapelDeUsuario,
  type PapelDoTitular,
  type TitularAchado,
} from '@educa/shared'
import { and, eq, inArray, ne, sql, type SQL } from 'drizzle-orm'

/**
 * A contagem do texto do modelo da prévia, por junção com as execuções que a pessoa pediu: desce pelo
 * `execucao_agente_solicitada_por_idx` e pelo `consumo_ia_execucao_idx` (13.0), e não lê o consumo da escola inteira. Fora da
 * classe para o teste de plano usar a mesma instrução que a prévia roda; a escola é a do contexto.
 */
export function instrucaoDoTextoDoModelo(titularId: string): SQL {
  const escolaId = requireEscolaId()
  return sql`select 'texto_do_modelo', count(*)::int from consumo_ia c
        join execucao_agente e on e.escola_id = c.escola_id and e.id = c.execucao_id
        where c.escola_id = ${escolaId} and e.solicitada_por = ${titularId} and (c.entrada is not null or c.saida is not null)`
}

/** O titular, como o pedido e a prévia o acham: id, nome, papel e a conta, que decide o "pedido sobre si mesmo". */
export interface TitularAchadoNoBanco {
  readonly id: string
  readonly nome: string
  readonly papel: PapelDoTitular
  readonly contaId: string | null
}

/** O nome e as turmas do titular, para a lista e o detalhe do pedido: `null` quando ele não existe mais. */
export interface TitularParaOPedido {
  readonly nome: string
  readonly turmas: string[]
}

/** A contagem por categoria da prévia, na ordem do catálogo. */
export interface ContagemDoTitular {
  readonly categoria: CategoriaDeRetencao
  readonly quantidade: number
}

const colunasDoTitular = {
  id: usuario.id,
  nome: usuario.nome,
  papel: usuario.papel,
  contaId: usuario.contaId,
}

/** Só o aluno e o professor são titular de pedido (F3, RF10): a coordenação registra o pedido de um deles. */
const PAPEIS_QUE_PODEM_SER_TITULAR = ['aluno', 'professor'] as const

/** O papel do `usuario` é o de um titular, e o tipo fecha nele. Quem não é aluno nem professor não é achado. */
function papelDeTitular(papel: PapelDeUsuario): PapelDoTitular {
  if (papel === 'aluno' || papel === 'professor') return papel
  throw new InvariantException('papel fora da busca de titulares')
}

/** O nome como a comparação o lê: sem espaço nas pontas e sem caixa ("Ana Souza" é "ana souza"). */
const nomeComparavel = (coluna: SQL | typeof usuario.nome) => sql<string>`lower(btrim(${coluna}))`

/**
 * Os titulares da escola do contexto e a prévia deles (F3, RF10 e RF11; Tech Spec do F3, seção 4; regra 10, item 3):
 * escola, ano e pessoa vêm do contexto, e nenhum método os recebe. Só alcança quem é `usuario` da escola: o aluno que
 * só está na lista de nomes é atendido pela lista da turma (A1), e a busca não o acha.
 *
 * Nada disto loga: nome, matrícula e o termo da busca nunca saem daqui para o log nem para a auditoria (regra 20,
 * item 9). O nome sai só para a resposta da coordenação, que é auditada.
 */
export class TitularesRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O titular deste id na escola do contexto, com a conta dele. O de outra escola e o inexistente não são achados. */
  async paraOPedido(titularId: string): Promise<TitularAchadoNoBanco | undefined> {
    const [linha] = await this.banco
      .select(colunasDoTitular)
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, titularId), inArray(usuario.papel, [...PAPEIS_QUE_PODEM_SER_TITULAR])))
    return linha === undefined ? undefined : { ...linha, papel: papelDeTitular(linha.papel) }
  }

  /** A conta de quem pediu: o pedido sobre a própria pessoa (mesma `conta_id`) responde como inexistente. */
  async contaDeQuemPediu(): Promise<string | null> {
    const { usuarioId } = requestIdentity()
    const [linha] = await this.banco
      .select({ contaId: usuario.contaId })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId)))
    return linha?.contaId ?? null
  }

  /**
   * A busca de titulares por um pedaço do nome (F3, RF10), no máximo 20, em ordem de nome. O termo casa com o nome
   * inteiro, sem caixa e sem espaço nas pontas, e **nunca vai a log nem à auditoria**: é nome de pessoa. A matrícula e
   * as turmas do ano em curso (aluno) ou as disciplinas e turmas (professor) vêm junto, para a coordenação escolher a
   * pessoa certa entre homônimos.
   */
  async buscar(termo: string): Promise<TitularAchado[]> {
    const escolaId = requireEscolaId()
    const procurado = termo.trim().toLowerCase()
    const achados = await this.banco
      .select({ ...colunasDoTitular, desativadoEm: usuario.desativadoEm, matricula: credencialMatricula.matricula })
      .from(usuario)
      .leftJoin(credencialMatricula, and(eq(credencialMatricula.escolaId, usuario.escolaId), eq(credencialMatricula.usuarioId, usuario.id)))
      .where(and(eq(usuario.escolaId, escolaId), inArray(usuario.papel, [...PAPEIS_QUE_PODEM_SER_TITULAR]), sql`position(${procurado} in ${nomeComparavel(usuario.nome)}) > 0`))
      .orderBy(usuario.nome, usuario.id)
      .limit(MAXIMO_DE_RESULTADOS_DA_BUSCA)
    const porPessoa = await this.#vinculosDe(
      achados.map(({ id }) => id),
    )
    return achados.map(({ id, nome, papel, desativadoEm, matricula }) => {
      const daPessoa = porPessoa.get(id) ?? { turmas: [], disciplinas: [] }
      return {
        id,
        nome,
        papel: papelDeTitular(papel),
        matricula: matricula ?? null,
        turmas: daPessoa.turmas,
        disciplinas: daPessoa.disciplinas,
        estado: (desativadoEm === null ? 'ativo' : 'desativado') satisfies EstadoDoTitular,
      }
    })
  }

  /**
   * O nome e as turmas do ano em curso de cada titular, para a lista e o detalhe do pedido. Quem não é mais usuário da
   * escola (eliminado) não vem: a resposta mostra "Titular eliminado".
   */
  async titularesParaOPedido(titularIds: readonly string[]): Promise<Map<string, TitularParaOPedido>> {
    const escolaId = requireEscolaId()
    if (titularIds.length === 0) return new Map()
    const linhas = await this.banco
      .select({ id: usuario.id, nome: usuario.nome })
      .from(usuario)
      .where(and(eq(usuario.escolaId, escolaId), inArray(usuario.id, [...titularIds])))
    const porPessoa = await this.#vinculosDe(linhas.map(({ id }) => id))
    return new Map(linhas.map(({ id, nome }) => [id, { nome, turmas: (porPessoa.get(id)?.turmas ?? []).map(({ nome: daTurma }) => daTurma) }]))
  }

  /**
   * O `homonimo` da prévia e do registro: a regra **da troca de nome** da eliminação (F3, tarefa 15.0), que mora no `nucleo` e
   * é uma só para os três lugares. Outro aluno ativo com o mesmo nome completo nesta escola, ou um nome livre igual na lista;
   * a resposta nunca diz quem é o outro.
   */
  async homonimo(titularId: string): Promise<boolean> {
    return haHomonimoDoTitular(this.banco, titularId)
  }

  /**
   * A contagem por categoria do titular (F3, RF11): as linhas dele em cada categoria de retenção, na ordem do
   * catálogo, e só as que existem. É o que a prévia mostra antes do pedido e o que o arquivo do titular leva depois
   * (tarefa 13.0). Cada categoria conta as tabelas que `CLASSIFICACAO_DAS_TABELAS` liga a ele.
   */
  async contagemPorCategoria(titularId: string): Promise<ContagemDoTitular[]> {
    const escolaId = requireEscolaId()
    const { rows } = await this.banco.execute<{ categoria: string; quantidade: number }>(sql`
      select 'conversa_tutor' as categoria, count(*)::int as quantidade from mensagem_tutor where escola_id = ${escolaId} and aluno_id = ${titularId}
      union all select 'sinal_tutor', count(*)::int from sinal_tutor where escola_id = ${escolaId} and aluno_id = ${titularId}
      union all select 'conversa_professor', count(*)::int from mensagem_agente m
        join thread_agente t on t.escola_id = m.escola_id and t.id = m.thread_id
        where m.escola_id = ${escolaId} and t.usuario_id = ${titularId}
      union all select 'execucao_agente', count(*)::int from execucao_agente where escola_id = ${escolaId} and solicitada_por = ${titularId}
      union all ${instrucaoDoTextoDoModelo(titularId)}
      union all select 'consumo_por_aluno', count(*)::int from consumo_ia where escola_id = ${escolaId} and aluno_id = ${titularId}
      union all select 'trabalho_do_aluno', count(*)::int from tentativa_atividade where escola_id = ${escolaId} and aluno_id = ${titularId}
      union all select 'reivindicacao_decidida', count(*)::int from reivindicacao r
        left join lista_nome l on l.escola_id = r.escola_id and l.id = r.lista_nome_id
        where r.escola_id = ${escolaId} and (r.decidida_por = ${titularId} or l.usuario_id = ${titularId})
      union all select 'autoria_de_artefato', count(*)::int from artefato where escola_id = ${escolaId} and criado_por = ${titularId}
      union all select 'material_excluido', count(*)::int from material where escola_id = ${escolaId} and (enviado_por = ${titularId} or excluido_por = ${titularId})
      union all select 'vinculo_encerrado', count(*)::int from vinculo where escola_id = ${escolaId} and usuario_id = ${titularId}
      union all select 'pessoa_desativada', count(*)::int from usuario where escola_id = ${escolaId} and id = ${titularId}
    `)
    const contadas = new Map(rows.map(({ categoria, quantidade }) => [categoria, quantidade]))
    return CHAVES_DE_RETENCAO.flatMap((categoria) => {
      const quantidade = contadas.get(categoria) ?? 0
      return quantidade === 0 ? [] : [{ categoria, quantidade }]
    })
  }

  /**
   * As categorias que a prévia do professor mostra: só as de cadastro e vínculo (D64). As de uso da IA não aparecem,
   * e por isso a resposta é a mesma para quem usou e para quem não usou a IA.
   */
  categoriasDoProfessor(): readonly CategoriaDeRetencao[] {
    return CATEGORIAS_DE_CADASTRO_E_VINCULO
  }

  /**
   * As turmas e as disciplinas do ano em curso de cada pessoa, na ordem do nome da turma. **Sem ano em curso** (entre o
   * encerramento de um ano e a abertura do seguinte, quando o pedido de acesso e o de eliminação mais chegam) não há
   * vínculo a mostrar: a virada já os encerrou, e o mapa vem vazio. Turma e disciplina só completam a linha; o pedido, a
   * busca e a lista não dependem delas, e nunca caem num ano qualquer (regra 10, item 2). A escola continua exigida do
   * contexto, e sem ela a chamada falha como antes.
   */
  async #vinculosDe(usuarioIds: readonly string[]): Promise<Map<string, { turmas: Array<{ id: string; nome: string }>; disciplinas: Array<{ id: string; nome: string }> }>> {
    const escolaId = requireEscolaId()
    const anoLetivoId = currentContext()?.anoLetivoId
    if (usuarioIds.length === 0 || typeof anoLetivoId !== 'string') return new Map()
    const linhas = await this.banco
      .select({ usuarioId: vinculo.usuarioId, turmaId: turma.id, turma: turma.nome, disciplinaId: disciplina.id, disciplina: disciplina.nome })
      .from(vinculo)
      .innerJoin(turma, and(eq(turma.escolaId, vinculo.escolaId), eq(turma.anoLetivoId, vinculo.anoLetivoId), eq(turma.id, vinculo.turmaId)))
      .leftJoin(disciplina, and(eq(disciplina.escolaId, vinculo.escolaId), eq(disciplina.id, vinculo.disciplinaId)))
      .where(
        and(
          eq(vinculo.escolaId, escolaId),
          eq(vinculo.anoLetivoId, anoLetivoId),
          ne(vinculo.estado, 'encerrado'),
          inArray(vinculo.usuarioId, [...usuarioIds]),
        ),
      )
      .orderBy(turma.nome, vinculo.usuarioId)
    const porPessoa = new Map<string, { turmas: Array<{ id: string; nome: string }>; disciplinas: Array<{ id: string; nome: string }> }>()
    for (const { usuarioId, turmaId, turma: nomeDaTurma, disciplinaId, disciplina: nomeDaDisciplina } of linhas) {
      const daPessoa = porPessoa.get(usuarioId) ?? { turmas: [], disciplinas: [] }
      if (!daPessoa.turmas.some(({ id }) => id === turmaId)) daPessoa.turmas.push({ id: turmaId, nome: nomeDaTurma })
      if (disciplinaId !== null && nomeDaDisciplina !== null && !daPessoa.disciplinas.some(({ id }) => id === disciplinaId)) {
        daPessoa.disciplinas.push({ id: disciplinaId, nome: nomeDaDisciplina })
      }
      porPessoa.set(usuarioId, daPessoa)
    }
    return porPessoa
  }
}
