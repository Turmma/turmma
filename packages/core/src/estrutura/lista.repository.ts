import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { credencialMatricula } from '../db/schema/credencial-matricula.js'
import { listaNome } from '../db/schema/lista-nome.js'
import { usuario } from '../db/schema/usuario.js'
import { vinculo } from '../db/schema/vinculo.js'
import { requestSessao } from '../identidade/auth.guard.js'
import type { PaginationQuery, NomeDaLista } from '@educa/shared'
import { and, asc, eq, gt, inArray, isNull, ne, notExists, or, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

/** Um nome a gravar: nome e matrícula já conferidos, sem espaço nas pontas. */
export interface NomeNovo {
  readonly nome: string
  readonly matricula: string
}

/** Um nome ainda não aprovado, como a reimportação o compara: o `estado` é o que a escrita confere (`livre` ou `reivindicado`). */
export interface NomeNaoAprovado {
  readonly id: string
  readonly turmaId: string
  readonly nome: string
  readonly matricula: string
  readonly estado: 'livre' | 'reivindicado'
}

/** Um aluno aprovado e ativo com linha na lista deste ano: o nome é o do `usuario`, e a matrícula, a da credencial. */
export interface AlunoAprovado {
  readonly usuarioId: string
  readonly turmaId: string
  readonly nome: string
  readonly matricula: string
}

/** O que a escola já tem de aluno neste ano, para as matrículas da planilha e para as turmas que ela cita. */
export interface AlunosParaReimportar {
  readonly naoAprovados: readonly NomeNaoAprovado[]
  readonly aprovados: readonly AlunoAprovado[]
}

/**
 * O aluno que a matrícula da planilha acha pela credencial e que não tem linha `aprovado` no ano de destino (a virada de ano, 10.0): o
 * `desativado` o recusa, e `comVinculo` diz que ele já tem vínculo de aluno aberto no ano, e então não "volta".
 */
export interface AlunoDaVirada {
  readonly usuarioId: string
  readonly matricula: string
  readonly desativado: boolean
  readonly comVinculo: boolean
}

/** Um nome ainda não aprovado a sair da lista (a planilha de alunos, 10.0): o `estado` e a turma lidos são a condição da escrita. */
export interface RetiradaDeNome {
  readonly id: string
  readonly estadoLido: 'livre' | 'reivindicado'
  readonly turmaLidaId: string
}

/** Um nome a corrigir na lista: o `estado` lido é a condição da escrita (a aprovação do mesmo nome muda o estado e a deixa sem linha). */
export interface CorrecaoDeNomeNaLista {
  readonly id: string
  readonly estadoLido: 'livre' | 'reivindicado'
  readonly nome: string
}

/** Um nome ainda não aprovado a passar de turma: o `estado` e a turma lidos são a condição da escrita. */
export interface TransferenciaDeNome {
  readonly id: string
  readonly estadoLido: 'livre' | 'reivindicado'
  readonly turmaLidaId: string
  readonly turmaId: string
}

/** O nome do aluno aprovado a passar de turma: a linha dele é a `aprovado` do usuário, na turma lida. */
export interface TransferenciaDeAprovado {
  readonly usuarioId: string
  readonly turmaLidaId: string
  readonly turmaId: string
}

const colunas = { id: listaNome.id, nome: listaNome.nome, matricula: listaNome.matricula, estado: listaNome.estado }

/** A matrícula como o índice único a guarda: é por ela que a busca usa o índice `(escola_id, ano_letivo_id, btrim)`. */
const matriculaDoIndice = sql<string>`btrim(${listaNome.matricula})`

/**
 * A lista de nomes da escola do contexto no ano letivo em curso dela, e só dela (A1, 2.0; regra 10, itens 2 e 3): escola
 * e ano vêm do contexto que a `SessaoGuard` gravou, nunca de argumento. Sem ano em curso, `requireAnoEmCurso` falha
 * fechado com `NAO_ENCONTRADO` antes de qualquer consulta. A turma de cada escrita já foi conferida pelo service
 * (`TurmaRepository.travarContraExclusao`), e a FK composta `(escola_id, ano_letivo_id, turma_id)` é a segunda camada.
 *
 * O nome e a matrícula nunca saem daqui para log: só para a resposta da coordenação.
 */
export class ListaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Das matrículas dadas, as que são de um aluno da escola (`credencial_matricula`, de qualquer ano, também a do aluno
   * desativado, que continua com ela). Só da escola do contexto: a matrícula de outra escola é outra matrícula (regra 60,
   * item 6), e dizer que ela existe lá confirmaria à coordenação um aluno de outra escola (E5).
   */
  async comCredencial(matriculas: readonly string[]): Promise<string[]> {
    if (matriculas.length === 0) return []
    const linhas = await this.banco
      .select({ matricula: credencialMatricula.matricula })
      .from(credencialMatricula)
      .where(and(eq(credencialMatricula.escolaId, requireEscolaId()), inArray(credencialMatricula.matricula, [...matriculas])))
    return linhas.map((linha) => linha.matricula)
  }

  /**
   * Das matrículas dadas, as que já são de alguém da escola no ano de destino da planilha (F2, 7.0): as que estão na lista de
   * alguma turma do ano (`lista_nome`, no ano dado) ou são de um aluno da escola (`credencial_matricula`, de qualquer ano, também a
   * do aluno desativado). Duas consultas, qualquer que seja o número de matrículas, e só da escola do contexto: a matrícula de
   * outra escola é outra matrícula (regra 60, item 6) e nunca aparece aqui.
   *
   * Não há único entre a `credencial_matricula` e a `lista_nome`: a proteção é a releitura sob a trava do passo (3), que muda a
   * assinatura. Uma credencial gravada depois dela, sem trava, dá o mesmo estado final de "planilha primeiro, aprovação depois", e essa ordem serial é aceita.
   */
  async emUsoNoAno(anoLetivoId: string, matriculas: readonly string[]): Promise<Set<string>> {
    if (matriculas.length === 0) return new Set()
    const escolaId = requireEscolaId()
    const naLista = await this.banco
      .select({ matricula: matriculaDoIndice })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), inArray(matriculaDoIndice, [...matriculas])))
    const comCredencial = await this.banco
      .select({ matricula: credencialMatricula.matricula })
      .from(credencialMatricula)
      .where(and(eq(credencialMatricula.escolaId, escolaId), inArray(credencialMatricula.matricula, [...matriculas])))
    return new Set([...naLista, ...comCredencial].map((linha) => linha.matricula))
  }

  /**
   * O que a escola já tem de aluno no ano de destino da planilha (F2, 8.0), em duas consultas, qualquer que seja o número de
   * linhas: os nomes ainda não aprovados e os alunos aprovados e ativos com linha na lista do ano, cuja matrícula é a de uma
   * linha da planilha ou cuja turma a planilha cita (os ausentes dessas turmas). O aprovado desativado, ou sem linha na lista deste
   * ano (o que a virada de ano trata), não entra: a reimportação não o corrige nem o muda de turma. Só da escola do contexto.
   */
  async paraReimportar(anoLetivoId: string, matriculas: readonly string[], turmaIds: readonly string[]): Promise<AlunosParaReimportar> {
    if (matriculas.length === 0 && turmaIds.length === 0) return { naoAprovados: [], aprovados: [] }
    const escolaId = requireEscolaId()
    const daNaoAprovada: SQL[] = []
    const daAprovada: SQL[] = []
    if (matriculas.length > 0) {
      daNaoAprovada.push(inArray(matriculaDoIndice, [...matriculas]))
      daAprovada.push(inArray(credencialMatricula.matricula, [...matriculas]))
    }
    if (turmaIds.length > 0) {
      daNaoAprovada.push(inArray(listaNome.turmaId, [...turmaIds]))
      daAprovada.push(inArray(listaNome.turmaId, [...turmaIds]))
    }
    const naoAprovados = await this.banco
      .select({ id: listaNome.id, turmaId: listaNome.turmaId, nome: listaNome.nome, matricula: listaNome.matricula, estado: listaNome.estado })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), ne(listaNome.estado, 'aprovado'), or(...daNaoAprovada)))
    const aprovados = await this.banco
      .select({ usuarioId: usuario.id, turmaId: listaNome.turmaId, nome: usuario.nome, matricula: credencialMatricula.matricula })
      .from(listaNome)
      .innerJoin(usuario, and(eq(usuario.escolaId, listaNome.escolaId), eq(usuario.id, listaNome.usuarioId)))
      .innerJoin(credencialMatricula, and(eq(credencialMatricula.escolaId, usuario.escolaId), eq(credencialMatricula.usuarioId, usuario.id)))
      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), eq(listaNome.estado, 'aprovado'), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm), or(...daAprovada)))
    return {
      naoAprovados: naoAprovados.flatMap(({ nome, matricula, estado, ...resto }) => (nome === null || matricula === null || estado === 'aprovado' ? [] : [{ ...resto, nome, matricula, estado }])),
      aprovados,
    }
  }

  /**
   * Os alunos da escola que as matrículas dadas acham pela credencial e que não têm linha `aprovado` no ano de destino, ativos ou
   * desativados (a virada de ano, F2, 10.0; Tech Spec do onboarding, seção 5, "Gravar"): numa consulta, com o vínculo de aluno
   * aberto (não `encerrado`) deste ano. Só da escola do contexto: a matrícula de outra escola é outra matrícula (regra 60, item 6).
   * O `anoLetivoId` só pode ser um ano já conferido na escola (o `anoDeDestino` do motor), nunca um id vindo do cliente.
   */
  async daVirada(anoLetivoId: string, matriculas: readonly string[]): Promise<AlunoDaVirada[]> {
    if (matriculas.length === 0) return []
    const escolaId = requireEscolaId()
    const aprovadoNoAno = this.banco
      .select({ um: listaNome.id })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), eq(listaNome.estado, 'aprovado'), eq(listaNome.usuarioId, usuario.id)))
    const vinculoAberto = this.banco
      .select({ um: vinculo.id })
      .from(vinculo)
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.usuarioId, usuario.id), eq(vinculo.papel, 'aluno'), ne(vinculo.estado, 'encerrado')))
    return this.banco
      .select({
        usuarioId: usuario.id,
        matricula: credencialMatricula.matricula,
        desativado: sql<boolean>`${usuario.desativadoEm} is not null`,
        comVinculo: sql<boolean>`exists ${vinculoAberto}`,
      })
      .from(credencialMatricula)
      .innerJoin(usuario, and(eq(usuario.escolaId, credencialMatricula.escolaId), eq(usuario.id, credencialMatricula.usuarioId)))
      .where(and(eq(credencialMatricula.escolaId, escolaId), inArray(credencialMatricula.matricula, [...matriculas]), eq(usuario.papel, 'aluno'), notExists(aprovadoNoAno)))
  }

  /**
   * Corrige o nome de quem ainda não foi aprovado (F2, 8.0), em lote: cada linha só muda se continua no estado que a planilha
   * leu e não está aprovada (a aprovação passa o nome ao `usuario` e o apaga da lista). Devolve quantas mudou; menos que as
   * pedidas é diferença, e o motor fecha a importação `desatualizada`. O isolamento entre escolas desta escrita depende de o
   * `anoLetivoId` vir sempre do `anoDeDestino` ou do `anoPorId` do motor (ano já conferido na escola), e nunca do cliente: a chave
   * composta prende o ano à escola, e por isso tirar o `escola_id` do `where` não muda resultado (ele fica por escopo explícito).
   */
  async corrigirNomes(anoLetivoId: string, correcoes: readonly CorrecaoDeNomeNaLista[]): Promise<number> {
    if (correcoes.length === 0) return 0
    const valores = sql.join(correcoes.map(({ id, estadoLido, nome }) => sql`(${id}::uuid, ${estadoLido}, ${nome})`), sql`, `)
    const corrigidas = await this.banco.execute(sql`
      update lista_nome as l set nome = v.nome
      from (values ${valores}) as v(id, estado, nome)
      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado and l.estado <> 'aprovado'
      returning l.id`)
    return corrigidas.rows.length
  }

  /**
   * Passa de turma, em lote, o nome de quem ainda não foi aprovado (F2, 9.0; Tech Spec do onboarding, seção 5, "Gravar"): a linha vai
   * à turma de destino e fica `livre` (o `reivindicado` perde o pedido, que `DecisaoRepository.fechar(…, 'encerrada')` já fechou). A
   * escrita é condicional ao que a planilha leu: o `estado` e a turma da linha. Uma reivindicação que tomou o nome entre a prévia e o
   * passo (3) o deixou `reivindicado`, e a linha não é mexida. Devolve quantas mudou; menos que as pedidas é diferença, e o motor fecha a
   * importação `desatualizada`. O `anoLetivoId` só pode ser um ano já conferido na escola, o `anoDeDestino` ou o `anoPorId` do motor, nunca um id vindo do cliente.
   */
  async transferirNomes(anoLetivoId: string, transferencias: readonly TransferenciaDeNome[]): Promise<number> {
    if (transferencias.length === 0) return 0
    const valores = sql.join(transferencias.map(({ id, estadoLido, turmaLidaId, turmaId }) => sql`(${id}::uuid, ${estadoLido}, ${turmaLidaId}::uuid, ${turmaId}::uuid)`), sql`, `)
    const movidas = await this.banco.execute(sql`
      update lista_nome as l set turma_id = v.turma_id, estado = 'livre'
      from (values ${valores}) as v(id, estado_lido, turma_lida_id, turma_id)
      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
      returning l.id`)
    return movidas.rows.length
  }

  /**
   * Passa de turma, em lote, a linha `aprovado` de cada aluno (F2, 9.0): ela guarda só o estado e o usuário, e acompanha o aluno à
   * turma nova (a lista da turma e a virada do ano a leem). Condicional à turma que a planilha leu; menos linhas mudadas que pedidas é
   * diferença. O usuário foi travado antes (`travarUsuarios`). Só aceita ano já conferido na escola (o do motor), nunca um id vindo do cliente.
   */
  async transferirAprovados(anoLetivoId: string, transferencias: readonly TransferenciaDeAprovado[]): Promise<number> {
    if (transferencias.length === 0) return 0
    const valores = sql.join(transferencias.map(({ usuarioId, turmaLidaId, turmaId }) => sql`(${usuarioId}::uuid, ${turmaLidaId}::uuid, ${turmaId}::uuid)`), sql`, `)
    const movidas = await this.banco.execute(sql`
      update lista_nome as l set turma_id = v.turma_id
      from (values ${valores}) as v(usuario_id, turma_lida_id, turma_id)
      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.usuario_id = v.usuario_id and l.estado = 'aprovado' and l.turma_id = v.turma_lida_id
      returning l.id`)
    return movidas.rows.length
  }

  /**
   * Tira da lista, em lote, os nomes ainda não aprovados que a coordenação marcou para desligar (F2, 10.0; Tech Spec do onboarding, seção 5,
   * "Gravar"): a linha sai de fato, porque é pré-cadastro, sem conta nem histórico. A escrita é condicional ao que a planilha leu, o
   * `estado` e a turma da linha: uma reivindicação que tomou o nome, ou a troca de turma à mão, entre a prévia e o passo (3) deixa a linha
   * e o pedido como estão. Devolve os ids que saíram; menos que os pedidos é diferença, e o motor fecha a importação `desatualizada`. O
   * pedido pendente do nome (`reivindicado`) já foi encerrado pelo `DecisaoRepository.fechar(…, 'encerrada')`, e o `set null` da FK
   * deixa os pedidos antigos sem nome. O `anoLetivoId` só pode ser um ano já conferido na escola, nunca um id vindo do cliente.
   */
  async retirarNomes(anoLetivoId: string, retiradas: readonly RetiradaDeNome[]): Promise<string[]> {
    if (retiradas.length === 0) return []
    const valores = sql.join(retiradas.map(({ id, estadoLido, turmaLidaId }) => sql`(${id}::uuid, ${estadoLido}, ${turmaLidaId}::uuid)`), sql`, `)
    const apagadas = await this.banco.execute<{ id: string }>(sql`
      delete from lista_nome as l
      using (values ${valores}) as v(id, estado_lido, turma_lida_id)
      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
      returning l.id`)
    return apagadas.rows.map((linha) => linha.id)
  }

  /**
   * Grava a linha `aprovado` de cada aluno que volta na turma nova (a virada de ano, F2, 10.0): só o estado e o usuário, como a aprovação a
   * deixa (check `lista_nome_aprovado_sem_nome`), com quem gravou a planilha como autora. É ela que a reimportação seguinte lê para
   * corrigir, transferir ou desligar o aluno no ano. Sem `on conflict`: a matrícula nula não colide, e o vínculo único é o do `vinculo`.
   */
  async inserirAprovados(anoLetivoId: string, criadoPor: string, alunos: ReadonlyArray<{ readonly usuarioId: string; readonly turmaId: string }>): Promise<void> {
    if (alunos.length === 0) return
    const escolaId = requireEscolaId()
    await this.banco.insert(listaNome).values(alunos.map(({ usuarioId, turmaId }) => ({ escolaId, anoLetivoId, turmaId, estado: 'aprovado' as const, usuarioId, criadoPor })))
  }

  /**
   * Grava os nomes na turma de cada um, `livre`, no ano de destino da planilha e com quem a gravou (F2, 7.0). Sem `on conflict`: a
   * matrícula que entrou na lista entre a prévia e a gravação viola o índice único (23505), e o motor fecha a importação
   * `desatualizada` com a transação desfeita.
   */
  async inserirNoAno(anoLetivoId: string, criadoPor: string, nomes: ReadonlyArray<NomeNovo & { readonly turmaId: string }>): Promise<void> {
    if (nomes.length === 0) return
    const escolaId = requireEscolaId()
    await this.banco.insert(listaNome).values(nomes.map(({ turmaId, nome, matricula }) => ({ escolaId, anoLetivoId, turmaId, nome, matricula, criadoPor })))
  }

  /**
   * Grava um nome avulso na turma, `livre`. A matrícula que já está na lista da escola neste ano é barrada pelo índice
   * único (23505), que o filtro global traduz em `CONFLITO`, e a transação de quem chamou volta atrás inteira.
   */
  async inserir(turmaId: string, { nome, matricula }: NomeNovo): Promise<NomeDaLista> {
    const [criado] = await this.banco
      .insert(listaNome)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), turmaId, nome, matricula, criadoPor: requestSessao().usuarioId })
      .returning(colunas)
    if (criado === undefined) throw new InvariantException('nome da lista não criado')
    return criado
  }

  /**
   * Apaga o nome `livre` com esse id, do ano em curso, e devolve a turma dele; o nome livre sai de fato, porque é
   * pré-cadastro, sem conta nem histórico (Tech Spec da A1, seção 7). O reivindicado e o aprovado não saem, nem o nome de
   * outro ano, de outra escola ou inexistente (`undefined`).
   */
  async retirarLivre(id: string): Promise<{ readonly turmaId: string } | undefined> {
    const [apagado] = await this.banco
      .delete(listaNome)
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, id), eq(listaNome.estado, 'livre')))
      .returning({ turmaId: listaNome.turmaId })
    return apagado
  }

  /** Se o nome com esse id existe na escola, no ano em curso, em qualquer estado. */
  async existe(id: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: listaNome.id })
      .from(listaNome)
      .where(and(eq(listaNome.escolaId, requireEscolaId()), eq(listaNome.anoLetivoId, requireAnoEmCurso()), eq(listaNome.id, id)))
    return linha !== undefined
  }

  /**
   * Uma página dos nomes da turma no ano em curso, em ordem de id, com uma linha a mais que diz se há próxima. Não
   * confere quem pede: o service chama depois de abrir a turma.
   */
  pagina(turmaId: string, { pagina, limite }: PaginationQuery): Promise<NomeDaLista[]> {
    return this.banco
      .select(colunas)
      .from(listaNome)
      .where(
        and(
          eq(listaNome.escolaId, requireEscolaId()),
          eq(listaNome.anoLetivoId, requireAnoEmCurso()),
          eq(listaNome.turmaId, turmaId),
          pagina === undefined ? undefined : gt(listaNome.id, pagina),
        ),
      )
      .orderBy(asc(listaNome.id))
      .limit(limite + 1)
  }
}
