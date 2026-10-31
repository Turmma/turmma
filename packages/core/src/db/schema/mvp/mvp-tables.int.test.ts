import { randomUUID } from 'node:crypto'
import {
  AGENTES,
  CHAVES_DE_FUNCAO,
  ErrorCode,
  ESTADOS_DE_ATIVIDADE_APLICADA,
  ESTADOS_DE_CONSUMO_DE_IA,
  ESTADOS_DE_ENTREGA,
  ESTADOS_DE_EXECUCAO,
  ESTADOS_DE_MATERIAL,
  FALHAS_DE_MATERIAL,
  FORMATO_DO_CODIGO_DE_ERRO,
  FUNCAO_DA_TAREFA_DE_IA,
  LICENCAS_DE_MATERIAL,
  MOTIVOS_DE_DESTAQUE,
  MOTIVOS_DE_SUSPENSAO,
  ORIGENS_DA_SAIDA_DE_IA,
  PERFIS_DE_IA,
  TAREFAS_DE_IA,
  TIPOS_DE_ADAPTACAO,
  TIPOS_DE_ARTEFATO,
  TIPOS_DE_ENTREGA,
  TIPOS_DE_MENSAGEM_DO_TUTOR,
  TIPOS_DE_SINAL,
  TITULARIDADES_DE_MATERIAL,
} from '@educa/shared'
import { getTableName } from 'drizzle-orm'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../../../../../../tools/testes/integracao.setup.ts'
import * as exportadas from './tables.js'

/**
 * As invariantes das dezessete tabelas do MVP de apresentação (migrations 0022 e 0023), provadas no banco, por fora do
 * código: é o que segura um insert escrito à mão, um job ou um repository de outro pacote que esqueça a regra.
 *
 * O isolamento entre escolas é provado de dois jeitos, e nenhum dos dois cobre sozinho:
 * - **pelo catálogo** (`pg_constraint`, `pg_trigger`): **toda** FK das dezessete tabelas, fora a da própria escola,
 *   começa por `escola_id` dos dois lados, e leva o ano letivo quando as duas pontas têm ano; toda coluna de autor sem FK
 *   tem o gatilho dela. Trocar qualquer FK composta por FK simples, ou apagar um gatilho, quebra este teste, inclusive
 *   nas tabelas em que não há caso escrito;
 * - **por casos**, com duas escolas, com dois anos letivos da mesma escola e com duas turmas do mesmo ano: o objeto de
 *   fora é recusado pela restrição nomeada. Os casos provam que a restrição do catálogo recusa de fato; não cobrem
 *   todas as FKs, e é por isso que o teste de catálogo existe.
 *
 * O resto é regra de negócio no banco: sem o check, a entrega aprovada sem autor entra; sem o gatilho, o lote aprovado
 * sem validação entra.
 */

const TABELAS_DO_MVP = [
  'material',
  'trecho',
  'consumo_ia',
  'thread_agente',
  'mensagem_agente',
  'execucao_agente',
  'entrega',
  'artefato',
  'atividade_aplicada',
  'tentativa_atividade',
  'resposta_atividade',
  'correcao',
  'validacao_do_lote',
  'mensagem_tutor',
  'sinal_tutor',
  'suspensao_de_funcao',
  'resumo_do_analista',
] as const

/** As que crescem com o aluno (regra 80, item 8). */
/** Toda FK composta das dezessete tabelas, em ordem de nome: a lista escrita à mão que o catálogo precisa repetir. */
const FKS_COMPOSTAS_DO_MVP = [
  'artefato_criado_por_da_escola_fk',
  'artefato_disciplina_da_escola_fk',
  'artefato_execucao_do_ano_da_escola_fk',
  'artefato_origem_da_turma_fk',
  'artefato_turma_do_ano_da_escola_fk',
  'atividade_aplicada_artefato_do_ano_da_escola_fk',
  'atividade_aplicada_turma_do_ano_da_escola_fk',
  'consumo_ia_aluno_da_escola_fk',
  'consumo_ia_execucao_da_escola_fk',
  'correcao_lote_da_aplicacao_da_escola_fk',
  'correcao_tentativa_fk',
  'entrega_artefato_da_turma_fk',
  'entrega_atividade_aplicada_da_turma_fk',
  'entrega_execucao_do_ano_da_escola_fk',
  'entrega_turma_do_ano_da_escola_fk',
  'execucao_agente_ano_letivo_da_escola_fk',
  'execucao_agente_solicitada_por_da_escola_fk',
  'material_disciplina_da_escola_fk',
  'material_enviado_por_da_escola_fk',
  'material_excluido_por_da_escola_fk',
  'mensagem_agente_disciplina_da_escola_fk',
  'mensagem_agente_execucao_do_ano_da_escola_fk',
  'mensagem_agente_thread_do_ano_da_escola_fk',
  'mensagem_agente_turma_do_ano_da_escola_fk',
  'mensagem_tutor_aluno_da_escola_fk',
  'mensagem_tutor_atividade_aplicada_da_turma_fk',
  'mensagem_tutor_execucao_do_ano_da_escola_fk',
  'mensagem_tutor_material_da_escola_fk',
  'mensagem_tutor_turma_do_ano_da_escola_fk',
  'resposta_atividade_tentativa_fk',
  'resumo_do_analista_ano_letivo_da_escola_fk',
  'resumo_do_analista_execucao_do_ano_da_escola_fk',
  'sinal_tutor_aluno_da_escola_fk',
  'sinal_tutor_atividade_aplicada_da_turma_fk',
  'sinal_tutor_execucao_do_ano_da_escola_fk',
  'sinal_tutor_material_da_escola_fk',
  'sinal_tutor_turma_do_ano_da_escola_fk',
  'tentativa_atividade_aluno_da_escola_fk',
  'tentativa_atividade_aplicacao_do_ano_da_escola_fk',
  'thread_agente_ano_letivo_da_escola_fk',
  'thread_agente_usuario_da_escola_fk',
  'trecho_material_da_disciplina_da_escola_fk',
  'validacao_do_lote_aplicacao_do_ano_da_escola_fk',
  'validacao_do_lote_lote_da_aplicacao_da_escola_fk',
]

const TABELAS_QUE_CRESCEM = ['trecho', 'resposta_atividade', 'mensagem_tutor', 'sinal_tutor', 'consumo_ia', 'mensagem_agente', 'tentativa_atividade', 'correcao', 'execucao_agente']

interface Cenario {
  escolaId: string
  anoLetivoId: string
  serieId: string
  turmaId: string
  disciplinaId: string
  coordenadorId: string
  professorId: string
  alunoId: string
}

const questao = (materialId: string) => ({
  enunciado: 'Quantos mols de água se formam a partir de 2 mol de hidrogênio?',
  alternativas: ['1 mol', '2 mol', '3 mol', '4 mol'],
  gabarito: 1,
  habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação balanceada.' },
  citacao: { materialId, pagina: 3, trecho: 'A proporção entre reagentes e produtos vem da equação balanceada.' },
  explicacao: 'A proporção é de 2 para 2.',
})

describe('tabelas do MVP de apresentação: o banco recusa o que o contrato proíbe', () => {
  const cliente = new pg.Client({ connectionString: urlDoBancoDeTeste() })
  const escolas: string[] = []
  const redes: string[] = []
  const contas: string[] = []

  async function recusa(consulta: Promise<unknown>): Promise<{ codigo: string; restricao: string | undefined }> {
    try {
      await consulta
    } catch (erro) {
      const { code, constraint } = erro as { code: string; constraint?: string }
      return { codigo: code, restricao: constraint }
    }
    throw new Error('o banco deveria ter recusado')
  }

  async function id(instrucao: string, valores: unknown[]): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>(instrucao, valores)
    const linha = rows[0]
    if (linha === undefined) throw new Error('insert sem linha')
    return linha.id
  }

  async function novoUsuario(escolaId: string, papel: 'coordenador' | 'professor' | 'aluno'): Promise<string> {
    let contaId: string | null = null
    if (papel !== 'aluno') {
      contaId = await id('insert into conta (email) values ($1) returning id', [`mvp-${randomUUID()}@educa.invalid`])
      contas.push(contaId)
    }
    return id("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, 'Pessoa sintética') returning id", [escolaId, contaId, papel])
  }

  /** Uma escola sintética inteira: ano em curso, série, turma, disciplina e uma pessoa de cada papel. */
  async function novoCenario(): Promise<Cenario> {
    const redeId = await id("insert into rede (nome, tipo) values ('Rede sintética do MVP', 'independente') returning id", [])
    redes.push(redeId)
    const escolaId = await id("insert into escola (rede_id, nome, slug) values ($1, 'Escola sintética do MVP', $2) returning id", [redeId, `mvp-${randomUUID()}`])
    escolas.push(escolaId)
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-15', 'em_curso') returning id", [escolaId])
    const serieId = await id("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const turmaId = await id("insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, '2ºB') returning id", [escolaId, anoLetivoId, serieId])
    const disciplinaId = await id("insert into disciplina (escola_id, nome) values ($1, 'Química') returning id", [escolaId])
    return {
      escolaId,
      anoLetivoId,
      serieId,
      turmaId,
      disciplinaId,
      coordenadorId: await novoUsuario(escolaId, 'coordenador'),
      professorId: await novoUsuario(escolaId, 'professor'),
      alunoId: await novoUsuario(escolaId, 'aluno'),
    }
  }

  const novoMaterial = (c: Cenario, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, disciplina_id: c.disciplinaId, titulo: 'Química 2, cap. 7', titularidade: 'escola', licenca: 'autoria_da_escola', declaracao: true, sha256: randomUUID().replaceAll('-', '').padEnd(64, '0'), tamanho_bytes: 1024, enviado_por: c.coordenadorId, ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into material (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  const novoTrecho = (c: Pick<Cenario, 'escolaId' | 'disciplinaId'>, materialId: string, pagina: number, texto: string) =>
    id('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5) returning id', [c.escolaId, c.disciplinaId, materialId, pagina, texto])

  const novaExecucao = (c: Cenario, tarefa = 'gerar_atividade_objetiva', ajuste: { funcao?: string; chave?: string; entrada?: unknown; solicitadaPor?: string; anoLetivoId?: string } = {}) =>
    id('insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id', [
      c.escolaId,
      ajuste.anoLetivoId ?? c.anoLetivoId,
      ajuste.funcao ?? FUNCAO_DA_TAREFA_DE_IA[tarefa as keyof typeof FUNCAO_DA_TAREFA_DE_IA],
      tarefa,
      ajuste.solicitadaPor ?? c.professorId,
      ajuste.chave ?? randomUUID(),
      JSON.stringify(ajuste.entrada ?? { tarefa }),
    ])

  /** Uma chamada ao modelo, como a porta `RegistroDeConsumo` grava. */
  const consumir = (c: Cenario, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, tarefa: 'gerar_atividade_objetiva', funcao: 'conversa_e_ferramentas', perfil: 'padrao', origem: 'falso', modelo: 'adaptador-falso', prompt_versao: '2026-10-04', tokens_de_entrada: 120, tokens_de_saida: 80, duracao_ms: 35, envio_externo: false, tentativas: 1, estado: 'concluida', ...ajuste }
    const colunas = Object.keys(linha)
    return cliente.query(`insert into consumo_ia (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')})`, Object.values(linha))
  }

  /** Um artefato de atividade objetiva. Com `origemId` é versão adaptada, e leva `adaptacao` no conteúdo. */
  const novoArtefato = (c: Cenario, ajuste: { origemId?: string; adaptacao?: unknown; tipo?: string; turmaId?: string; criadoPor?: string; escolaId?: string; anoLetivoId?: string; execucaoId?: string } = {}) => {
    const tipo = ajuste.tipo ?? 'atividade_objetiva'
    const conteudo: Record<string, unknown> = { tipo, titulo: 'Lista de estequiometria', questoes: [questao(randomUUID())] }
    if (ajuste.adaptacao !== undefined) conteudo['adaptacao'] = ajuste.adaptacao
    else if (ajuste.origemId !== undefined) conteudo['adaptacao'] = { tipos: ['fonte_ampliada'] }
    return id('insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por, execucao_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id', [
      ajuste.escolaId ?? c.escolaId,
      ajuste.anoLetivoId ?? c.anoLetivoId,
      ajuste.turmaId ?? c.turmaId,
      c.disciplinaId,
      tipo,
      'Lista de estequiometria',
      JSON.stringify(conteudo),
      ajuste.origemId ?? null,
      ajuste.criadoPor ?? c.professorId,
      ajuste.execucaoId ?? null,
    ])
  }

  const aplicar = (c: Cenario, artefatoId: string, ajuste: { aplicadaPor?: string; avaliativa?: boolean; anoLetivoId?: string; turmaId?: string } = {}) =>
    id('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, $5, $6) returning id', [
      c.escolaId,
      ajuste.anoLetivoId ?? c.anoLetivoId,
      ajuste.turmaId ?? c.turmaId,
      artefatoId,
      ajuste.avaliativa ?? false,
      ajuste.aplicadaPor ?? c.professorId,
    ])

  const novaTentativa = (c: Cenario, atividadeAplicadaId: string, alunoId = c.alunoId) =>
    id('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4) returning id', [c.escolaId, c.anoLetivoId, atividadeAplicadaId, alunoId])

  const entregaDeAdaptacao = (c: Cenario, artefatoId: string, ajuste: { turmaId?: string; anoLetivoId?: string } = {}) =>
    id("insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id) values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4) returning id", [
      c.escolaId,
      ajuste.anoLetivoId ?? c.anoLetivoId,
      ajuste.turmaId ?? c.turmaId,
      artefatoId,
    ])

  const entregaDeLote = (c: Cenario, atividadeAplicadaId: string, ajuste: { turmaId?: string; anoLetivoId?: string } = {}) =>
    id("insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id) values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4) returning id", [
      c.escolaId,
      ajuste.anoLetivoId ?? c.anoLetivoId,
      ajuste.turmaId ?? c.turmaId,
      atividadeAplicadaId,
    ])

  /** Outra turma do mesmo ano letivo, na mesma escola. */
  const outraTurma = (c: Cenario, anoLetivoId = c.anoLetivoId) =>
    id('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [c.escolaId, anoLetivoId, c.serieId, `2º${randomUUID().slice(0, 6)}`])

  /** Outro ano letivo da mesma escola, com uma turma dele: a virada de ano (regra 60, item 5). */
  async function outroAno(c: Cenario): Promise<{ anoLetivoId: string; turmaId: string }> {
    const anoLetivoId = await id("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2027, '2027-02-01', '2027-12-15', 'planejado') returning id", [c.escolaId])
    return { anoLetivoId, turmaId: await outraTurma(c, anoLetivoId) }
  }

  const aprovar = (c: Cenario, entregaId: string, por = c.professorId) =>
    cliente.query("update entrega set estado = 'aprovada', decidida_por = $3, decidida_em = now() where escola_id = $1 and id = $2 and estado = 'pendente'", [c.escolaId, entregaId, por])

  const resumoDoLote = { alunosDaTurma: 1, corrigidos: 1, questoes: 1, mediaDeAcertos: 0, distribuicao: [], porHabilidade: [], porQuestao: [] }

  const validar = (c: Cenario, entregaId: string, atividadeAplicadaId: string, destaques: string[], abertos: string[]) =>
    cliente.query('insert into validacao_do_lote (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, apresentado, aberto, confirmada_por) values ($1, $2, $3, $4, $5, $6, $7)', [
      c.escolaId,
      c.anoLetivoId,
      entregaId,
      atividadeAplicadaId,
      JSON.stringify({ resumo: resumoDoLote, destaques: destaques.map((alunoId) => ({ alunoId, motivos: ['em_branco'] })) }),
      JSON.stringify(abertos.map((alunoId) => ({ alunoId, abertoEm: '2026-10-04T12:00:00.000Z' }))),
      c.professorId,
    ])

  const novaCorrecao = (c: Cenario, entregaId: string, atividadeAplicadaId: string, destaques: string[] = []) =>
    id("insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade, destaques) values ($1, $2, $3, $4, $5, 0, 1, 1, '[]', $6) returning id", [
      c.escolaId,
      c.anoLetivoId,
      entregaId,
      atividadeAplicadaId,
      c.alunoId,
      destaques,
    ])

  const mensagemAoTutor = (c: Cenario, execucaoId: string, autor: 'aluno' | 'tutor', ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, turma_id: c.turmaId, aluno_id: c.alunoId, execucao_id: execucaoId, autor, texto: 'Como acho o reagente limitante?', ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into mensagem_tutor (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  const novoSinal = (c: Cenario, tipo: string, ajuste: Record<string, unknown> = {}) => {
    const linha = { escola_id: c.escolaId, ano_letivo_id: c.anoLetivoId, turma_id: c.turmaId, aluno_id: c.alunoId, tipo, ...ajuste }
    const colunas = Object.keys(linha)
    return id(`insert into sinal_tutor (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id`, Object.values(linha))
  }

  const suspender = (c: Cenario, funcao: string) => id('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3) returning id', [c.escolaId, funcao, c.coordenadorId])

  const contar = async (tabela: string, escolaId: string): Promise<number> => {
    const { rows } = await cliente.query<{ total: string }>(`select count(*) as total from ${tabela} where escola_id = $1`, [escolaId])
    return Number(rows[0]?.total)
  }

  beforeAll(async () => {
    await cliente.connect()
  })

  afterAll(async () => {
    // Na ordem das FKs: primeiro o que aponta, depois o que é apontado.
    for (const tabela of [
      'correcao',
      'validacao_do_lote',
      'resposta_atividade',
      'tentativa_atividade',
      'sinal_tutor',
      'mensagem_tutor',
      'consumo_ia',
      'mensagem_agente',
      'thread_agente',
      'entrega',
      'atividade_aplicada',
      'artefato',
      'resumo_do_analista',
      'execucao_agente',
      'trecho',
      'material',
      'suspensao_de_funcao',
      'configuracao_operacional_escola',
      'usuario',
      'turma',
      'serie',
      'disciplina',
      'ano_letivo',
    ]) {
      await cliente.query(`delete from ${tabela} where escola_id = any($1::uuid[])`, [escolas])
    }
    await cliente.query('delete from conta where id = any($1::uuid[])', [contas])
    await cliente.query('delete from escola where id = any($1::uuid[])', [escolas])
    await cliente.query('delete from rede where id = any($1::uuid[])', [redes])
    await cliente.end()
  })

  describe('regra 10: a estrutura impede apontar para objeto de outra escola', () => {
    it('as dezessete tabelas existem, todas com `escola_id` obrigatório e com FK para a escola', async () => {
      const { rows } = await cliente.query<{ table_name: string; is_nullable: string }>(
        "select table_name, is_nullable from information_schema.columns where table_schema = 'public' and column_name = 'escola_id' and table_name = any($1::text[]) order by table_name",
        [[...TABELAS_DO_MVP]],
      )
      expect(rows.map((linha) => linha.table_name)).toEqual([...TABELAS_DO_MVP].sort())
      // O que o pacote exporta do schema são estas dezessete, pelo nome exportado e pelo objeto `mvpTables`.
      const { mvpTables, ...porNome } = exportadas
      expect(Object.values(mvpTables).map((tabela) => getTableName(tabela)).sort()).toEqual([...TABELAS_DO_MVP].sort())
      expect(Object.keys(porNome).sort()).toEqual(Object.keys(mvpTables).sort())
      expect(rows.filter((linha) => linha.is_nullable !== 'NO')).toEqual([])
      const { rows: fks } = await cliente.query<{ tabela: string }>(
        "select conrelid::regclass::text as tabela from pg_constraint where contype = 'f' and confrelid = 'escola'::regclass and conrelid::regclass::text = any($1::text[]) order by 1",
        [[...TABELAS_DO_MVP]],
      )
      expect(fks.map((linha) => linha.tabela)).toEqual([...TABELAS_DO_MVP].sort())
    })

    it('turma, disciplina, usuário, material, artefato, execução e atividade aplicada de outra escola são recusados pela FK composta ou pelo gatilho', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const materialDeB = await novoMaterial(b)
      const artefatoDeB = await novoArtefato(b)
      const execucaoDeB = await novaExecucao(b)
      const aplicadaDeB = await aplicar(b, artefatoDeB)
      const artefatoDeA = await novoArtefato(a)
      const aplicadaDeA = await aplicar(a, artefatoDeA)
      await novaTentativa(a, aplicadaDeA)
      const loteDeA = await entregaDeLote(a, aplicadaDeA)
      await novaTentativa(b, aplicadaDeB)
      const loteDeB = await entregaDeLote(b, aplicadaDeB)
      const novaThread = (c: Cenario, usuarioId = c.professorId) =>
        id("insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id", [c.escolaId, c.anoLetivoId, usuarioId])
      const [threadDeA, threadDeB] = [await novaThread(a), await novaThread(b)]
      const mensagemDoProfessor = async (threadId: string, turmaId: string) =>
        cliente.query("insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, turma_id, disciplina_id) values ($1, $2, $3, $4, 'usuario', $5, $6, $7)", [
          a.escolaId,
          a.anoLetivoId,
          threadId,
          await novaExecucao(a, 'propor_ferramenta'),
          JSON.stringify({ tipo: 'texto', texto: 'Monta uma lista' }),
          turmaId,
          a.disciplinaId,
        ])
      const responder = (atividadeAplicadaId: string, alunoId: string) =>
        cliente.query('insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 1, 0)', [a.escolaId, a.anoLetivoId, atividadeAplicadaId, alunoId])
      const corrigir = (entregaId: string, alunoId: string) =>
        cliente.query("insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade) values ($1, $2, $3, $4, $5, 0, 1, 1, '[]')", [a.escolaId, a.anoLetivoId, entregaId, aplicadaDeA, alunoId])

      // Cada caso é montado na hora de rodar: a promessa recusada nunca fica sem quem a espere.
      const casos: Array<[string, () => Promise<unknown>]> = [
        // A disciplina, a turma e o usuário de B, num registro de A.
        ['material_disciplina_da_escola_fk', () => novoMaterial(a, { disciplina_id: b.disciplinaId })],
        ['material_enviado_por_da_escola_fk', () => novoMaterial(a, { enviado_por: b.coordenadorId })],
        ['trecho_material_da_disciplina_da_escola_fk', () => novoTrecho(a, materialDeB, 1, 'texto')],
        ['artefato_turma_do_ano_da_escola_fk', () => novoArtefato(a, { turmaId: b.turmaId })],
        ['artefato_criado_por_da_escola_fk', () => novoArtefato(a, { criadoPor: b.professorId })],
        ['artefato_origem_da_turma_fk', () => novoArtefato(a, { origemId: artefatoDeB })],
        ['execucao_agente_solicitada_por_da_escola_fk', () => novaExecucao(a, 'gerar_atividade_objetiva', { solicitadaPor: b.professorId })],
        ['atividade_aplicada_artefato_do_ano_da_escola_fk', () => aplicar(a, artefatoDeB)],
        ['atividade_aplicada_aplicada_por_da_escola_fk', async () => aplicar(a, await novoArtefato(a), { aplicadaPor: b.professorId })],
        ['tentativa_atividade_aplicacao_do_ano_da_escola_fk', () => novaTentativa(a, aplicadaDeB)],
        ['entrega_artefato_da_turma_fk', () => entregaDeAdaptacao(a, artefatoDeB)],
        ['entrega_atividade_aplicada_da_turma_fk', () => entregaDeLote(a, aplicadaDeB)],
        ['mensagem_tutor_execucao_do_ano_da_escola_fk', () => mensagemAoTutor(a, execucaoDeB, 'aluno')],
        ['mensagem_tutor_material_da_escola_fk', async () => mensagemAoTutor(a, await novaExecucao(a, 'turno_do_tutor', { solicitadaPor: a.alunoId }), 'aluno', { material_id: materialDeB })],
        ['mensagem_tutor_aluno_da_escola_fk', async () => mensagemAoTutor(a, await novaExecucao(a, 'turno_do_tutor', { solicitadaPor: a.alunoId }), 'aluno', { aluno_id: b.alunoId })],
        ['sinal_tutor_turma_do_ano_da_escola_fk', () => novoSinal(a, 'travou', { turma_id: b.turmaId })],
        ['sinal_tutor_atividade_aplicada_da_turma_fk', () => novoSinal(a, 'travou', { atividade_aplicada_id: aplicadaDeB, questao: 1 })],
        ['suspensao_de_funcao_suspensa_por_da_escola_fk', () => cliente.query("insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, 'adaptacao', $2)", [a.escolaId, b.coordenadorId])],
        // As tabelas que só alcançam a escola por outra tabela: a thread, a mensagem, o resumo, a resposta, a correção e a validação.
        ['thread_agente_usuario_da_escola_fk', () => novaThread(a, b.professorId)],
        ['mensagem_agente_thread_do_ano_da_escola_fk', () => mensagemDoProfessor(threadDeB, a.turmaId)],
        ['mensagem_agente_turma_do_ano_da_escola_fk', () => mensagemDoProfessor(threadDeA, b.turmaId)],
        ['resumo_do_analista_execucao_do_ano_da_escola_fk', () => cliente.query("insert into resumo_do_analista (escola_id, ano_letivo_id, execucao_id, conteudo) values ($1, $2, $3, '{\"recortes\":[],\"alertas\":[]}')", [a.escolaId, a.anoLetivoId, execucaoDeB])],
        ['resposta_atividade_tentativa_fk', () => responder(aplicadaDeB, b.alunoId)],
        ['resposta_atividade_tentativa_fk', () => responder(aplicadaDeA, b.alunoId)],
        ['correcao_lote_da_aplicacao_da_escola_fk', () => corrigir(loteDeB, a.alunoId)],
        ['correcao_tentativa_fk', () => corrigir(loteDeA, b.alunoId)],
        ['validacao_do_lote_lote_da_aplicacao_da_escola_fk', () => validar(a, loteDeB, aplicadaDeA, [], [])],
        ['consumo_ia_execucao_da_escola_fk', () => consumir(a, { execucao_id: execucaoDeB })],
        ['consumo_ia_aluno_da_escola_fk', () => consumir(a, { tarefa: 'turno_do_tutor', funcao: 'tutor_com_o_aluno', aluno_id: b.alunoId })],
      ]
      for (const [restricao, consulta] of casos) expect(await recusa(consulta()), restricao).toEqual({ codigo: '23503', restricao })

      // A tentativa com o aluno de outra escola e a entrega decidida por professor de outra escola, com o resto de A.
      expect(await recusa(novaTentativa(a, aplicadaDeA, b.alunoId))).toEqual({ codigo: '23503', restricao: 'tentativa_atividade_aluno_da_escola_fk' })
      const adaptadaDeA = await novoArtefato(a, { origemId: artefatoDeA })
      const entregaDeA = await entregaDeAdaptacao(a, adaptadaDeA)
      expect(await recusa(aprovar(a, entregaDeA, b.professorId))).toEqual({ codigo: '23503', restricao: 'entrega_decidida_por_da_escola_fk' })
      // Com as pessoas e os objetos da própria escola, as mesmas escritas passam: a FK barra o de fora, não o uso legítimo.
      await expect(mensagemDoProfessor(threadDeA, a.turmaId)).resolves.toMatchObject({ rowCount: 1 })
      await expect(responder(aplicadaDeA, a.alunoId)).resolves.toMatchObject({ rowCount: 1 })
      await expect(corrigir(loteDeA, a.alunoId)).resolves.toMatchObject({ rowCount: 1 })
      expect((await aprovar(a, entregaDeA)).rowCount).toBe(1)
    })

    it('pelo catálogo: toda FK das dezessete tabelas, fora a da própria escola, começa por `escola_id` dos dois lados, e leva o ano letivo quando as duas pontas têm ano', async () => {
      const { rows: fks } = await cliente.query<{ nome: string; tabela: string; alvo: string; colunas: string[]; colunas_do_alvo: string[] }>(
        `select c.conname as nome, c.conrelid::regclass::text as tabela, c.confrelid::regclass::text as alvo,
           (select array_agg(a.attname::text order by k.ordem) from unnest(c.conkey) with ordinality k(numero, ordem) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.numero) as colunas,
           (select array_agg(a.attname::text order by k.ordem) from unnest(c.confkey) with ordinality k(numero, ordem) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.numero) as colunas_do_alvo
         from pg_constraint c where c.contype = 'f' and c.conrelid::regclass::text = any($1::text[]) order by c.conname`,
        [[...TABELAS_DO_MVP]],
      )
      const daEscola = fks.filter((fk) => fk.alvo === 'escola')
      const compostas = fks.filter((fk) => fk.alvo !== 'escola')
      // A FK simples para a escola, uma por tabela, e mais nenhuma FK simples.
      expect(daEscola.map((fk) => fk.tabela).sort()).toEqual([...TABELAS_DO_MVP].sort())
      for (const fk of daEscola) expect([fk.colunas, fk.colunas_do_alvo], fk.nome).toEqual([['escola_id'], ['id']])

      // Toda outra FK é composta e começa pela escola, na tabela e no alvo: trocar qualquer uma por FK simples cai aqui.
      expect(compostas.filter((fk) => fk.colunas[0] !== 'escola_id' || fk.colunas_do_alvo[0] !== 'escola_id' || fk.colunas.length < 2).map((fk) => fk.nome)).toEqual([])
      // A lista inteira, pelo nome: a FK que some, ou que muda de nome, precisa ser olhada.
      expect(compostas.map((fk) => fk.nome)).toEqual(FKS_COMPOSTAS_DO_MVP)
      // E cada uma das dezessete tabelas tem pelo menos uma FK composta: nenhuma depende só da FK simples da escola.
      expect([...new Set(compostas.map((fk) => fk.tabela))].sort()).toEqual([...TABELAS_DO_MVP].filter((tabela) => tabela !== 'suspensao_de_funcao').sort())

      // O ano letivo: quando a tabela e o alvo têm `ano_letivo_id`, a FK o leva dos dois lados. Nada cruza de ano na mesma escola.
      const { rows: comAno } = await cliente.query<{ tabela: string }>("select table_name as tabela from information_schema.columns where table_schema = 'public' and column_name = 'ano_letivo_id'")
      const temAno = new Set(comAno.map((linha) => linha.tabela))
      const semAno = compostas.filter((fk) => temAno.has(fk.tabela) && temAno.has(fk.alvo) && !(fk.colunas.includes('ano_letivo_id') && fk.colunas_do_alvo.includes('ano_letivo_id')))
      // As duas exceções vão à entrega pelo par (entrega, atividade aplicada): o ano delas é preso pela FK da tentativa e
      // pela FK da aplicação, que levam o ano, e a entrega do lote é presa à aplicação com o ano.
      expect(semAno.map((fk) => fk.nome)).toEqual(['correcao_lote_da_aplicacao_da_escola_fk', 'validacao_do_lote_lote_da_aplicacao_da_escola_fk'])
      // O alvo que é o próprio ano letivo: a tabela leva `(escola_id, ano_letivo_id)`.
      for (const fk of compostas.filter((item) => item.alvo === 'ano_letivo')) expect([fk.colunas, fk.colunas_do_alvo], fk.nome).toEqual([['escola_id', 'ano_letivo_id'], ['escola_id', 'id']])
    })

    it('pelo catálogo: toda coluna que aponta para pessoa tem FK composta para o usuário ou o gatilho de autor dela, e os gatilhos da regra existem', async () => {
      const { rows: gatilhos } = await cliente.query<{ tabela: string; nome: string; funcao: string; coluna: string; adiado: boolean }>(
        `select t.tgrelid::regclass::text as tabela, t.tgname as nome, p.proname as funcao, split_part(encode(t.tgargs, 'escape'), '\\000', 1) as coluna, t.tginitdeferred as adiado
         from pg_trigger t join pg_proc p on p.oid = t.tgfoid
         where not t.tgisinternal and t.tgrelid::regclass::text = any($1::text[]) order by 1, 2`,
        [[...TABELAS_DO_MVP]],
      )
      expect(gatilhos).toEqual([
        { tabela: 'atividade_aplicada', nome: 'atividade_aplicada_aplicada_por_da_equipe', funcao: 'exigir_equipe_da_escola', coluna: 'aplicada_por', adiado: false },
        { tabela: 'atividade_aplicada', nome: 'atividade_aplicada_so_do_que_pode_ir_ao_aluno', funcao: 'exigir_artefato_que_pode_ir_ao_aluno', coluna: '', adiado: false },
        { tabela: 'correcao', nome: 'correcao_destaque_aberto_por_da_equipe', funcao: 'exigir_equipe_da_escola', coluna: 'destaque_aberto_por', adiado: false },
        { tabela: 'entrega', nome: 'entrega_decidida_por_da_equipe', funcao: 'exigir_equipe_da_escola', coluna: 'decidida_por', adiado: false },
        { tabela: 'entrega', nome: 'entrega_lote_aprovado_com_validacao', funcao: 'exigir_validacao_do_lote_aprovado', coluna: '', adiado: true },
        { tabela: 'suspensao_de_funcao', nome: 'suspensao_de_funcao_retomada_por_da_escola', funcao: 'exigir_usuario_da_escola', coluna: 'retomada_por', adiado: false },
        { tabela: 'suspensao_de_funcao', nome: 'suspensao_de_funcao_suspensa_por_da_escola', funcao: 'exigir_usuario_da_escola', coluna: 'suspensa_por', adiado: false },
        { tabela: 'validacao_do_lote', nome: 'validacao_do_lote_confirmada_por_da_equipe', funcao: 'exigir_equipe_da_escola', coluna: 'confirmada_por', adiado: false },
        { tabela: 'validacao_do_lote', nome: 'validacao_do_lote_destaques_do_lote', funcao: 'exigir_destaques_do_lote_abertos', coluna: '', adiado: false },
      ])

      // Toda coluna de pessoa (`*_por`, `aluno_id`, `usuario_id`) das dezessete tabelas: FK composta para `usuario` (ou para a
      // tentativa, que leva o aluno por FK composta), ou gatilho de autor.
      const { rows: dePessoa } = await cliente.query<{ tabela: string; coluna: string; com_fk: boolean }>(
        `select c.table_name as tabela, c.column_name as coluna,
           exists (
             select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
             where k.contype = 'f' and k.conrelid = c.table_name::regclass and k.confrelid in ('usuario'::regclass, 'tentativa_atividade'::regclass) and a.attname = c.column_name
           ) as com_fk
         from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = any($1::text[]) and c.column_name ~ '(_por|^aluno_id|^usuario_id)$' order by 1, 2`,
        [[...TABELAS_DO_MVP]],
      )
      const comGatilho = new Set(gatilhos.filter((gatilho) => gatilho.coluna !== '').map((gatilho) => `${gatilho.tabela}.${gatilho.coluna}`))
      expect(dePessoa.map((linha) => `${linha.tabela}.${linha.coluna}`)).toEqual([
        'artefato.criado_por',
        'atividade_aplicada.aplicada_por',
        'consumo_ia.aluno_id',
        'correcao.aluno_id',
        'correcao.destaque_aberto_por',
        'entrega.decidida_por',
        'execucao_agente.solicitada_por',
        'material.enviado_por',
        'material.excluido_por',
        'mensagem_tutor.aluno_id',
        'resposta_atividade.aluno_id',
        'sinal_tutor.aluno_id',
        'suspensao_de_funcao.retomada_por',
        'suspensao_de_funcao.suspensa_por',
        'tentativa_atividade.aluno_id',
        'thread_agente.usuario_id',
        'validacao_do_lote.confirmada_por',
      ])
      expect(dePessoa.filter((linha) => !linha.com_fk && !comGatilho.has(`${linha.tabela}.${linha.coluna}`)).map((linha) => `${linha.tabela}.${linha.coluna}`)).toEqual([])
      // Nenhuma coluna tem os dois: a que tem gatilho é justamente a que não pode ter FK, para o id ficar depois da eliminação.
      expect(dePessoa.filter((linha) => linha.com_fk && comGatilho.has(`${linha.tabela}.${linha.coluna}`))).toEqual([])

      // O gatilho do lote aprovado relê a entrega pela escola e pelo id (regra 10, item 3).
      const { rows: corpo } = await cliente.query<{ definicao: string }>("select pg_get_functiondef('exigir_validacao_do_lote_aprovado'::regproc) as definicao")
      expect(corpo[0]?.definicao).toContain('e."escola_id" = NEW."escola_id" AND e."id" = NEW."id"')
    })

    it('ano letivo: na mesma escola, nada aponta para turma, artefato, execução, aplicação, thread ou tentativa de outro ano', async () => {
      const c = await novoCenario()
      const outro = await outroAno(c)
      const artefatoDesteAno = await novoArtefato(c)
      const artefatoDoOutroAno = await novoArtefato(c, { anoLetivoId: outro.anoLetivoId, turmaId: outro.turmaId })
      const execucaoDoOutroAno = await novaExecucao(c, 'gerar_atividade_objetiva', { anoLetivoId: outro.anoLetivoId })
      const aplicada = await aplicar(c, artefatoDesteAno)
      await novaTentativa(c, aplicada)
      const lote = await entregaDeLote(c, aplicada)
      const aplicadaSemLote = await aplicar(c, await novoArtefato(c))
      const threadId = await id("insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id", [c.escolaId, c.anoLetivoId, c.professorId])
      const noOutroAno = (tabela: string, colunas: Record<string, unknown>) => {
        const linha = { escola_id: c.escolaId, ano_letivo_id: outro.anoLetivoId, ...colunas }
        const nomes = Object.keys(linha)
        return cliente.query(`insert into ${tabela} (${nomes.join(', ')}) values (${nomes.map((_, i) => `$${String(i + 1)}`).join(', ')})`, Object.values(linha))
      }

      const casos: Array<[string, () => Promise<unknown>]> = [
        // A turma de 2027 num registro de 2026.
        ['artefato_turma_do_ano_da_escola_fk', () => novoArtefato(c, { turmaId: outro.turmaId })],
        ['atividade_aplicada_turma_do_ano_da_escola_fk', () => aplicar(c, artefatoDesteAno, { turmaId: outro.turmaId })],
        ['mensagem_tutor_turma_do_ano_da_escola_fk', async () => mensagemAoTutor(c, await novaExecucao(c, 'turno_do_tutor', { solicitadaPor: c.alunoId }), 'aluno', { turma_id: outro.turmaId })],
        ['sinal_tutor_turma_do_ano_da_escola_fk', () => novoSinal(c, 'travou', { turma_id: outro.turmaId })],
        // O artefato, a execução e a aplicação de outro ano.
        ['atividade_aplicada_artefato_do_ano_da_escola_fk', () => aplicar(c, artefatoDoOutroAno)],
        ['artefato_origem_da_turma_fk', () => novoArtefato(c, { origemId: artefatoDoOutroAno })],
        ['artefato_execucao_do_ano_da_escola_fk', () => novoArtefato(c, { execucaoId: execucaoDoOutroAno })],
        ['mensagem_tutor_execucao_do_ano_da_escola_fk', () => mensagemAoTutor(c, execucaoDoOutroAno, 'aluno')],
        ['sinal_tutor_execucao_do_ano_da_escola_fk', () => novoSinal(c, 'travou', { execucao_id: execucaoDoOutroAno })],
        ['resumo_do_analista_execucao_do_ano_da_escola_fk', () => cliente.query("insert into resumo_do_analista (escola_id, ano_letivo_id, execucao_id, conteudo) values ($1, $2, $3, '{\"recortes\":[],\"alertas\":[]}')", [c.escolaId, c.anoLetivoId, execucaoDoOutroAno])],
        ['entrega_execucao_do_ano_da_escola_fk', () => cliente.query('update entrega set execucao_id = $2 where id = $1', [lote, execucaoDoOutroAno])],
        // O registro gravado com o ano errado: a entrega, a tentativa, a resposta, a correção, a validação e a mensagem de 2027 para o que é de 2026.
        ['entrega_atividade_aplicada_da_turma_fk', () => entregaDeLote(c, aplicadaSemLote, { anoLetivoId: outro.anoLetivoId, turmaId: outro.turmaId })],
        ['tentativa_atividade_aplicacao_do_ano_da_escola_fk', () => noOutroAno('tentativa_atividade', { atividade_aplicada_id: aplicada, aluno_id: c.alunoId })],
        ['resposta_atividade_tentativa_fk', () => noOutroAno('resposta_atividade', { atividade_aplicada_id: aplicada, aluno_id: c.alunoId, questao: 1, alternativa: 0 })],
        ['correcao_tentativa_fk', () => noOutroAno('correcao', { entrega_id: lote, atividade_aplicada_id: aplicada, aluno_id: c.alunoId, acertos: 0, total: 1, em_branco: 1, por_habilidade: '[]' })],
        ['validacao_do_lote_aplicacao_do_ano_da_escola_fk', () => noOutroAno('validacao_do_lote', { entrega_id: lote, atividade_aplicada_id: aplicada, apresentado: JSON.stringify({ resumo: resumoDoLote, destaques: [] }), aberto: '[]', confirmada_por: c.professorId })],
        ['mensagem_agente_thread_do_ano_da_escola_fk', async () => noOutroAno('mensagem_agente', { thread_id: threadId, execucao_id: execucaoDoOutroAno, autor: 'agente', conteudo: JSON.stringify({ tipo: 'texto', texto: 'Resposta', citacoes: [] }) })],
      ]
      for (const [restricao, consulta] of casos) expect(await recusa(consulta()), restricao).toEqual({ codigo: '23503', restricao })
      // A entrega de 2026 com a turma de 2027 cai em duas FKs, a da turma e a da aplicação: qualquer uma a recusa.
      expect(await recusa(entregaDeLote(c, aplicadaSemLote, { turmaId: outro.turmaId }))).toEqual({ codigo: '23503', restricao: expect.stringMatching(/^entrega_(turma_do_ano_da_escola|atividade_aplicada_da_turma)_fk$/) })
      // O ano de 2027 funciona por inteiro com o que é dele: a FK barra o que cruza, não o ano novo.
      await expect(aplicar(c, artefatoDoOutroAno, { anoLetivoId: outro.anoLetivoId, turmaId: outro.turmaId })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      await expect(novoArtefato(c, { anoLetivoId: outro.anoLetivoId, turmaId: outro.turmaId, execucaoId: execucaoDoOutroAno })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('turma: a entrega, a mensagem e o sinal do Tutor não apontam para a aplicação nem para o artefato de outra turma do mesmo ano', async () => {
      const c = await novoCenario()
      const turmaY = await outraTurma(c)
      const artefatoDaX = await novoArtefato(c)
      const aplicadaNaX = await aplicar(c, artefatoDaX)
      const adaptadaDaX = await novoArtefato(c, { origemId: artefatoDaX })
      const execucao = () => novaExecucao(c, 'turno_do_tutor', { solicitadaPor: c.alunoId })

      const casos: Array<[string, () => Promise<unknown>]> = [
        // É pela turma da entrega que o professor é autorizado: a entrega da Y não decide o que é da X.
        ['entrega_atividade_aplicada_da_turma_fk', () => entregaDeLote(c, aplicadaNaX, { turmaId: turmaY })],
        ['entrega_artefato_da_turma_fk', () => entregaDeAdaptacao(c, adaptadaDaX, { turmaId: turmaY })],
        // O sinal e a conversa lidos pelo professor da Y não trazem a atividade da X.
        ['sinal_tutor_atividade_aplicada_da_turma_fk', () => novoSinal(c, 'travou', { turma_id: turmaY, atividade_aplicada_id: aplicadaNaX, questao: 1 })],
        ['mensagem_tutor_atividade_aplicada_da_turma_fk', async () => mensagemAoTutor(c, await execucao(), 'aluno', { turma_id: turmaY, atividade_aplicada_id: aplicadaNaX })],
        // A versão adaptada é da turma do original.
        ['artefato_origem_da_turma_fk', () => novoArtefato(c, { origemId: artefatoDaX, turmaId: turmaY })],
      ]
      for (const [restricao, consulta] of casos) expect(await recusa(consulta()), restricao).toEqual({ codigo: '23503', restricao })

      // Com a turma certa, passam; e o mesmo artefato pode ser aplicado à outra turma do mesmo ano, com a entrega dela.
      await expect(entregaDeLote(c, aplicadaNaX)).resolves.toMatch(/^[0-9a-f-]{36}$/)
      await expect(novoSinal(c, 'travou', { atividade_aplicada_id: aplicadaNaX, questao: 1 })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      const aplicadaNaY = await aplicar(c, artefatoDaX, { turmaId: turmaY })
      await expect(entregaDeLote(c, aplicadaNaY, { turmaId: turmaY })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('regra 80, item 8: nas tabelas que crescem com o aluno, todo índice que não é a chave primária começa pela escola', async () => {
      const { rows } = await cliente.query<{ tablename: string; indexname: string; indexdef: string }>(
        "select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = any($1::text[]) and indexname not like '%_pkey' order by indexname",
        [TABELAS_QUE_CRESCEM],
      )
      // Cada tabela tem pelo menos um índice além da chave primária: é por ele que a rota lê.
      expect([...new Set(rows.map((linha) => linha.tablename))].sort()).toEqual([...TABELAS_QUE_CRESCEM].sort())
      expect(rows.filter((linha) => !/\((escola_id)[,)]/.test(linha.indexdef)).map((linha) => linha.indexname)).toEqual([])
    })
  })

  describe('material e trecho (D5, D75; busca em português)', () => {
    it('não existe material sem declaração, com licença fora da lista ou de terceiro sem licenciante', async () => {
      const c = await novoCenario()
      expect(await recusa(novoMaterial(c, { declaracao: false }))).toEqual({ codigo: '23514', restricao: 'material_com_declaracao' })
      // `sem_licenca` é o que o formulário manda quando a escola não tem a licença: não cabe na coluna.
      expect(await recusa(novoMaterial(c, { licenca: 'sem_licenca' }))).toEqual({ codigo: '23514', restricao: 'material_licenca_valida' })
      expect(await recusa(novoMaterial(c, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada' }))).toEqual({ codigo: '23514', restricao: 'material_licenciante_so_de_terceiro' })
      expect(await recusa(novoMaterial(c, { licenciante: 'Editora Sintética' }))).toEqual({ codigo: '23514', restricao: 'material_licenciante_so_de_terceiro' })
      await expect(novoMaterial(c, { titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada', licenciante: 'Editora Sintética' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('o mesmo arquivo enviado duas vezes entra uma vez na escola; o que falhou pode voltar, e outra escola tem o seu', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const sha256 = 'a'.repeat(64)
      const primeiro = await novoMaterial(a, { sha256 })
      expect(await recusa(novoMaterial(a, { sha256 }))).toEqual({ codigo: '23505', restricao: 'material_arquivo_na_escola_unico' })
      await expect(novoMaterial(b, { sha256 })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      await cliente.query("update material set estado = 'falhou', falha = 'sem_texto' where id = $1", [primeiro])
      await expect(novoMaterial(a, { sha256 })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('a busca em português acha o trecho pela palavra flexionada, e filtrada pelo escopo não acha o de outra escola', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const [materialDeA, materialDeB] = [await novoMaterial(a), await novoMaterial(b)]
      const palavra = `xenonio${randomUUID().slice(0, 8)}`
      await novoTrecho(a, materialDeA, 151, `O reagente limitante do ${palavra} é consumido primeiro, e os produtos formados dependem dele.`)
      await novoTrecho(a, materialDeA, 152, `O rendimento do ${palavra} compara o que se obteve com o que se esperava.`)
      await novoTrecho(b, materialDeB, 9, `Na outra escola, o reagente limitante do ${palavra} também aparece.`)

      const buscar = (termos: string, escolaId: string | null) =>
        cliente.query<{ escola_id: string; pagina: number }>(
          `select escola_id, pagina from trecho where ($2::uuid is null or escola_id = $2) and busca @@ websearch_to_tsquery('portuguese', $1) and busca @@ websearch_to_tsquery('portuguese', $3) order by pagina`,
          [termos, escolaId, palavra],
        )

      // "reagentes limitantes" e "consumidos" não estão escritos assim em trecho nenhum: quem acha é a flexão do português.
      for (const termos of ['reagentes limitantes', 'consumidos', 'produto formado']) {
        expect((await buscar(termos, a.escolaId)).rows, termos).toEqual([{ escola_id: a.escolaId, pagina: 151 }])
      }
      expect((await buscar('reagentes', b.escolaId)).rows).toEqual([{ escola_id: b.escolaId, pagina: 9 }])
      // Sem o filtro de escola a mesma busca traz as duas: quem isola é o `escola_id` do contexto, que nenhuma consulta dispensa.
      expect((await buscar('reagentes', null)).rows.map((linha) => linha.escola_id).sort()).toEqual([a.escolaId, b.escolaId].sort())
      // E a palavra que não está no trecho não acha nada, nem na própria escola.
      expect((await buscar('fotossíntese', a.escolaId)).rows).toEqual([])
    })

    it('`busca` é coluna gerada em português com índice GIN que começa pela escola, e a página não se repete no material', async () => {
      const c = await novoCenario()
      const materialId = await novoMaterial(c)
      const { rows: gerada } = await cliente.query<{ generation_expression: string }>("select generation_expression from information_schema.columns where table_name = 'trecho' and column_name = 'busca'")
      expect(gerada[0]?.generation_expression).toMatch(/to_tsvector\('portuguese'::regconfig, texto\)/)
      const { rows: indices } = await cliente.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'trecho' and indexname = 'trecho_busca_idx'")
      expect(indices[0]?.indexdef).toMatch(/USING gin \(escola_id, disciplina_id, busca\)/)
      await novoTrecho(c, materialId, 7, 'Página sete.')
      expect(await recusa(novoTrecho(c, materialId, 7, 'Página sete, de novo.'))).toEqual({ codigo: '23505', restricao: 'trecho_pagina_do_material_unica' })
      // A exclusão do material leva os trechos junto.
      await cliente.query('delete from material where id = $1', [materialId])
      expect(await contar('trecho', c.escolaId)).toBe(0)
    })
  })

  describe('execução de agente: idempotência e função (D49, D60)', () => {
    it('a chave de envio repetida não cria segunda execução na escola, e a mesma chave em outra escola é outra execução', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const chave = randomUUID()
      await novaExecucao(a, 'gerar_atividade_objetiva', { chave })
      expect(await recusa(novaExecucao(a, 'propor_ferramenta', { chave }))).toEqual({ codigo: '23505', restricao: 'execucao_agente_chave_na_escola_unica' })
      await expect(novaExecucao(b, 'gerar_atividade_objetiva', { chave })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      // O `on conflict do nothing` de quem grava devolve zero linha, e a execução continua sendo uma.
      const repetida = await cliente.query(
        "insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'conversa_e_ferramentas', 'gerar_atividade_objetiva', $3, $4, '{\"tarefa\":\"gerar_atividade_objetiva\"}') on conflict (escola_id, chave_envio) do nothing",
        [a.escolaId, a.anoLetivoId, a.professorId, chave],
      )
      expect(repetida.rowCount).toBe(0)
      expect(await contar('execucao_agente', a.escolaId)).toBe(1)
    })

    it('a tarefa fica presa à função dela e a entrada à tarefa', async () => {
      const c = await novoCenario()
      // A correção com a função do chat escaparia da suspensão da correção de objetiva.
      expect(await recusa(novaExecucao(c, 'relatorio_da_correcao', { funcao: 'conversa_e_ferramentas' }))).toEqual({ codigo: '23514', restricao: 'execucao_agente_tarefa_da_funcao' })
      // A tarefa fora do catálogo cai na lista e no par: qualquer um dos dois checks a recusa.
      expect(await recusa(novaExecucao(c, 'tarefa_inventada', { funcao: 'adaptacao' }))).toEqual({ codigo: '23514', restricao: expect.stringMatching(/^execucao_agente_tarefa_(valida|da_funcao)$/) })
      expect(await recusa(novaExecucao(c, 'gerar_atividade_objetiva', { entrada: { tarefa: 'adaptar_atividade' } }))).toEqual({ codigo: '23514', restricao: 'execucao_agente_entrada_da_tarefa' })
      expect(await recusa(novaExecucao(c, 'gerar_atividade_objetiva', { entrada: { semTarefa: true } }))).toEqual({ codigo: '23514', restricao: 'execucao_agente_entrada_da_tarefa' })
    })

    it('o caminho pendente, rodando, concluída ou falhou: o resultado só na concluída, o erro só na que falhou, e sempre como código', async () => {
      const c = await novoCenario()
      const execucaoId = await novaExecucao(c)
      const mudar = (campos: string, valores: unknown[] = []) => cliente.query(`update execucao_agente set ${campos} where escola_id = $1 and id = $2`, [c.escolaId, execucaoId, ...valores])
      expect(await recusa(mudar("estado = 'rodando'"))).toEqual({ codigo: '23514', restricao: 'execucao_agente_rodando_tem_inicio' })
      // `pendente` → `rodando` é um `update` condicional: a segunda instância que tenta pegar a mesma execução não acha linha.
      const pegar = () => cliente.query("update execucao_agente set estado = 'rodando', iniciada_em = now() where escola_id = $1 and id = $2 and estado = 'pendente'", [c.escolaId, execucaoId])
      expect([(await pegar()).rowCount, (await pegar()).rowCount]).toEqual([1, 0])

      expect(await recusa(mudar("estado = 'falhou', concluida_em = now()"))).toEqual({ codigo: '23514', restricao: 'execucao_agente_erro_so_na_que_falhou' })
      expect(await recusa(mudar("estado = 'falhou', erro = 'IA_INDISPONIVEL'"))).toEqual({ codigo: '23514', restricao: 'execucao_agente_fim_so_na_terminada' })
      // A mensagem crua do provedor, que pode repetir o prompt, não cabe na coluna do erro.
      for (const cru of ['Error: 429 Too Many Requests for prompt "..."', 'saida invalida', 'ia_indisponivel']) {
        expect(await recusa(mudar("estado = 'falhou', erro = $3, concluida_em = now()", [cru])), cru).toEqual({ codigo: '23514', restricao: 'execucao_agente_erro_e_codigo' })
      }
      expect(await recusa(mudar("estado = 'concluida', concluida_em = now()"))).toEqual({ codigo: '23514', restricao: 'execucao_agente_resultado_so_na_concluida' })
      expect(await recusa(mudar("estado = 'concluida', concluida_em = now(), resultado = $3", [JSON.stringify({ texto: 'a resposta inteira do Tutor' })]))).toEqual({
        codigo: '23514',
        restricao: 'execucao_agente_resultado_so_na_concluida',
      })
      expect(await recusa(mudar("estado = 'falhou', erro = 'IA_SAIDA_INVALIDA', concluida_em = now(), resultado = $3", [JSON.stringify({ tipo: 'artefato' })]))).toEqual({
        codigo: '23514',
        restricao: 'execucao_agente_resultado_so_na_concluida',
      })
      await expect(mudar("estado = 'concluida', concluida_em = now(), resultado = $3", [JSON.stringify({ tipo: 'artefato', artefatoId: randomUUID(), entregaId: null })])).resolves.toMatchObject({ rowCount: 1 })
      // Todo código do contrato cabe na coluna: é o que a execução que falhou guarda, e o que a tela recebe.
      for (const codigo of Object.values(ErrorCode)) expect(codigo, codigo).toMatch(FORMATO_DO_CODIGO_DE_ERRO)
      const outra = await novaExecucao(c)
      await expect(cliente.query("update execucao_agente set estado = 'falhou', erro = 'EXECUCAO_INTERROMPIDA', concluida_em = now() where id = $1", [outra])).resolves.toMatchObject({ rowCount: 1 })
    })

    it('a varredura das execuções paradas lê só o índice parcial das abertas, que começa pela escola e pelo estado', async () => {
      const { rows } = await cliente.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'execucao_agente' and indexname = 'execucao_agente_abertas_idx'")
      expect(rows[0]?.indexdef).toMatch(/\(escola_id, estado, criada_em\) WHERE \(estado = ANY \(ARRAY\['pendente'::text, 'rodando'::text\]\)\)$/)
    })

    it('uma execução produz um artefato, uma resposta na conversa e um sinal de cada tipo: reexecutar não duplica', async () => {
      const c = await novoCenario()
      const execucaoId = await novaExecucao(c)
      const comExecucao = (artefatoId: string) => cliente.query('update artefato set execucao_id = $2 where id = $1', [artefatoId, execucaoId])
      await comExecucao(await novoArtefato(c))
      expect(await recusa(comExecucao(await novoArtefato(c)))).toEqual({ codigo: '23505', restricao: 'artefato_um_por_execucao' })

      const tutor = await novaExecucao(c, 'turno_do_tutor', { solicitadaPor: c.alunoId })
      await mensagemAoTutor(c, tutor, 'aluno')
      await mensagemAoTutor(c, tutor, 'tutor', { texto: 'O que a equação balanceada diz sobre a proporção?' })
      expect(await recusa(mensagemAoTutor(c, tutor, 'aluno'))).toEqual({ codigo: '23505', restricao: 'mensagem_tutor_uma_por_execucao' })
      expect(await recusa(mensagemAoTutor(c, tutor, 'tutor'))).toEqual({ codigo: '23505', restricao: 'mensagem_tutor_uma_por_execucao' })
      await novoSinal(c, 'travou', { execucao_id: tutor })
      expect(await recusa(novoSinal(c, 'travou', { execucao_id: tutor }))).toEqual({ codigo: '23505', restricao: 'sinal_tutor_um_por_execucao' })
    })

    it('a conversa do professor: uma thread por pessoa, agente e ano; só o agente propõe ferramenta; o contexto de turma é só da mensagem dele', async () => {
      const c = await novoCenario()
      const novaThread = () => id("insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id", [c.escolaId, c.anoLetivoId, c.professorId])
      const threadId = await novaThread()
      expect(await recusa(novaThread())).toEqual({ codigo: '23505', restricao: 'thread_agente_uma_por_pessoa' })
      const execucaoId = await novaExecucao(c, 'propor_ferramenta')
      const mensagem = (autor: string, conteudo: unknown, comContexto: boolean) =>
        cliente.query('insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, turma_id, disciplina_id) values ($1, $2, $3, $4, $5, $6, $7, $8)', [
          c.escolaId,
          c.anoLetivoId,
          threadId,
          execucaoId,
          autor,
          JSON.stringify(conteudo),
          comContexto ? c.turmaId : null,
          comContexto ? c.disciplinaId : null,
        ])
      const proposta = { tipo: 'proposta_de_ferramenta', texto: 'Quer abrir a ferramenta?', proposta: {} }
      expect(await recusa(mensagem('usuario', proposta, true))).toEqual({ codigo: '23514', restricao: 'mensagem_agente_conteudo_do_autor' })
      expect(await recusa(mensagem('usuario', { tipo: 'texto', texto: 'Monta uma lista' }, false))).toEqual({ codigo: '23514', restricao: 'mensagem_agente_contexto_so_do_usuario' })
      expect(await recusa(mensagem('agente', { texto: 'sem tipo' }, false))).toEqual({ codigo: '23514', restricao: 'mensagem_agente_conteudo_do_autor' })
      await mensagem('usuario', { tipo: 'texto', texto: 'Monta uma lista de estequiometria' }, true)
      await mensagem('agente', proposta, false)
      expect(await recusa(mensagem('agente', { tipo: 'texto', texto: 'Outra resposta', citacoes: [] }, false))).toEqual({ codigo: '23505', restricao: 'mensagem_agente_uma_por_execucao' })
      // A conversa é do professor: a eliminação dele leva a thread e as mensagens.
      await cliente.query('delete from usuario where id = $1', [c.professorId])
      expect(await contar('mensagem_agente', c.escolaId)).toBe(0)
      expect(await contar('thread_agente', c.escolaId)).toBe(0)
    })
  })

  describe('artefato e adaptação (D35, D67): tipo de lista fechada, sem texto e sem vínculo com aluno', () => {
    it('a adaptação com campo de texto livre, com tipo fora da lista, vazia, nula ou em artefato original é recusada', async () => {
      const c = await novoCenario()
      const origemId = await novoArtefato(c)
      const recusados: Array<[string, unknown]> = [
        ['texto livre sobre o aluno', { tipos: ['fonte_ampliada'], observacao: 'aluno com baixa visão' }],
        ['motivo', { tipos: ['tempo_adicional'], tempoExtraPercentual: 50, motivo: 'laudo' }],
        ['tipo fora da lista', { tipos: ['fonte_ampliada', 'laudo_medico'] }],
        ['tipo que é texto livre', { tipos: ['o aluno tem dislexia'] }],
        ['sem tipo nenhum', { tipos: [] }],
        ['tipos que não é lista', { tipos: 'fonte_ampliada' }],
        ['adaptação que não é objeto', 'fonte ampliada para o João'],
        ['adaptação nula', null],
      ]
      for (const [caso, adaptacao] of recusados) {
        expect(await recusa(novoArtefato(c, { origemId, adaptacao })), caso).toEqual({ codigo: '23514', restricao: 'artefato_adaptacao_fechada' })
      }
      // O original não carrega adaptação, e a versão adaptada não existe sem ela.
      expect(await recusa(novoArtefato(c, { adaptacao: { tipos: ['fonte_ampliada'] } }))).toEqual({ codigo: '23514', restricao: 'artefato_adaptacao_fechada' })
      expect(
        await recusa(
          cliente.query("insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id) values ($1, $2, $3, $4, 'atividade_objetiva', 'Sem adaptação', $5, $6)", [
            c.escolaId,
            c.anoLetivoId,
            c.turmaId,
            c.disciplinaId,
            JSON.stringify({ tipo: 'atividade_objetiva' }),
            origemId,
          ]),
        ),
      ).toEqual({ codigo: '23514', restricao: 'artefato_adaptacao_fechada' })
      for (const tipos of TIPOS_DE_ADAPTACAO.map((tipo) => [tipo])) await expect(novoArtefato(c, { origemId, adaptacao: { tipos } }), tipos[0]).resolves.toMatch(/^[0-9a-f-]{36}$/)
      await expect(novoArtefato(c, { origemId, adaptacao: { tipos: ['tempo_adicional', 'fonte_ampliada'], tempoExtraPercentual: 50 } })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('o conteúdo é do tipo da coluna, e plano de aula não vira versão adaptada', async () => {
      const c = await novoCenario()
      const inserir = (tipo: string, conteudo: unknown, origemId: string | null = null) =>
        cliente.query('insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id) values ($1, $2, $3, $4, $5, $6, $7, $8)', [
          c.escolaId,
          c.anoLetivoId,
          c.turmaId,
          c.disciplinaId,
          tipo,
          'Título',
          JSON.stringify(conteudo),
          origemId,
        ])
      expect(await recusa(inserir('plano_de_aula', { tipo: 'atividade_objetiva' }))).toEqual({ codigo: '23514', restricao: 'artefato_conteudo_do_tipo' })
      expect(await recusa(inserir('atividade_objetiva', { titulo: 'sem tipo' }))).toEqual({ codigo: '23514', restricao: 'artefato_conteudo_do_tipo' })
      expect(await recusa(inserir('atividade_objetiva', ['lista']))).toEqual({ codigo: '23514', restricao: 'artefato_conteudo_do_tipo' })
      const origemId = await novoArtefato(c)
      expect(await recusa(inserir('plano_de_aula', { tipo: 'plano_de_aula', adaptacao: { tipos: ['fonte_ampliada'] } }, origemId))).toEqual({ codigo: '23514', restricao: 'artefato_adaptada_so_de_atividade' })
    })

    it('D35: nenhuma tabela do MVP liga aluno a adaptação, e nenhuma coluna tem nome de adaptação, diagnóstico ou laudo', async () => {
      const { rows } = await cliente.query<{ table_name: string; column_name: string }>(
        "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1::text[]) and column_name ~ '(adaptac|diagnostic|laudo|(^|_)cid(_|$)|necessidade|deficien)'",
        [[...TABELAS_DO_MVP]],
      )
      expect(rows).toEqual([])
      const { rows: tabelas } = await cliente.query<{ tabela: string | null }>("select to_regclass('public.adaptacao_aluno')::text as tabela")
      expect(tabelas[0]?.tabela).toBeNull()
    })
  })

  describe('regra 70, item 3: nada da IA chega ao aluno sem aprovação registrada', () => {
    it('a entrega nasce pendente; aprovada sem autor e data, pendente com autor e rejeitada sem justificativa são recusadas', async () => {
      const c = await novoCenario()
      const adaptada = await novoArtefato(c, { origemId: await novoArtefato(c) })
      const entregaId = await entregaDeAdaptacao(c, adaptada)
      const { rows } = await cliente.query<{ estado: string; decidida_por: string | null }>('select estado, decidida_por from entrega where id = $1', [entregaId])
      expect(rows).toEqual([{ estado: 'pendente', decidida_por: null }])

      const mudar = (campos: string, valores: unknown[] = []) => cliente.query(`update entrega set ${campos} where id = $1`, [entregaId, ...valores])
      expect(await recusa(mudar("estado = 'aprovada'"))).toEqual({ codigo: '23514', restricao: 'entrega_decisao_registrada' })
      expect(await recusa(mudar("estado = 'aprovada', decidida_em = now()"))).toEqual({ codigo: '23514', restricao: 'entrega_decisao_registrada' })
      expect(await recusa(mudar("estado = 'aprovada', decidida_por = $2", [c.professorId]))).toEqual({ codigo: '23514', restricao: 'entrega_decisao_registrada' })
      expect(await recusa(mudar('decidida_por = $2, decidida_em = now()', [c.professorId]))).toEqual({ codigo: '23514', restricao: 'entrega_decisao_registrada' })
      expect(await recusa(mudar("estado = 'rejeitada', decidida_por = $2, decidida_em = now()", [c.professorId]))).toEqual({ codigo: '23514', restricao: 'entrega_rejeitada_com_justificativa' })
      expect(await recusa(mudar("estado = 'rejeitada', decidida_por = $2, decidida_em = now(), justificativa = 'curta'", [c.professorId]))).toEqual({ codigo: '23514', restricao: 'entrega_justificativa_preenchida' })
      expect(await recusa(mudar("estado = 'aprovada', decidida_por = $2, decidida_em = now(), justificativa = 'justificativa na aprovada'", [c.professorId]))).toEqual({
        codigo: '23514',
        restricao: 'entrega_rejeitada_com_justificativa',
      })
      expect(await recusa(mudar("estado = 'publicada', decidida_por = $2, decidida_em = now()", [c.professorId]))).toEqual({ codigo: '23514', restricao: 'entrega_estado_valido' })
    })

    it('quem aprova, aplica, confirma e abre destaque é professor ou coordenação da escola: o id de um aluno é recusado', async () => {
      const c = await novoCenario()
      const original = await novoArtefato(c)
      const entregaId = await entregaDeAdaptacao(c, await novoArtefato(c, { origemId: original }))
      expect(await recusa(aprovar(c, entregaId, c.alunoId))).toEqual({ codigo: '23503', restricao: 'entrega_decidida_por_da_escola_fk' })
      expect(await recusa(aplicar(c, original, { aplicadaPor: c.alunoId }))).toEqual({ codigo: '23503', restricao: 'atividade_aplicada_aplicada_por_da_escola_fk' })
      const aplicada = await aplicar(c, original)
      await novaTentativa(c, aplicada)
      const lote = await entregaDeLote(c, aplicada)
      const correcaoId = await novaCorrecao(c, lote, aplicada, ['em_branco'])
      const abrir = (por: string) => cliente.query('update correcao set destaque_aberto_em = now(), destaque_aberto_por = $2 where id = $1 and destaque_aberto_em is null', [correcaoId, por])
      expect(await recusa(abrir(c.alunoId))).toEqual({ codigo: '23503', restricao: 'correcao_destaque_aberto_por_da_escola_fk' })
      const validarComo = (por: string) =>
        cliente.query('insert into validacao_do_lote (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, apresentado, aberto, confirmada_por) values ($1, $2, $3, $4, $5, $6, $7)', [
          c.escolaId,
          c.anoLetivoId,
          lote,
          aplicada,
          JSON.stringify({ resumo: resumoDoLote, destaques: [{ alunoId: c.alunoId, motivos: ['em_branco'] }] }),
          JSON.stringify([{ alunoId: c.alunoId, abertoEm: '2026-10-04T12:00:00.000Z' }]),
          por,
        ])
      await expect(abrir(c.professorId)).resolves.toMatchObject({ rowCount: 1 })
      expect(await recusa(validarComo(c.alunoId))).toEqual({ codigo: '23503', restricao: 'validacao_do_lote_confirmada_por_da_escola_fk' })
      // O professor e a coordenação passam no banco; quem pode de fato é a `MATRIZ` que diz.
      expect((await aprovar(c, entregaId, c.coordenadorId)).rowCount).toBe(1)
      await expect(validarComo(c.professorId)).resolves.toMatchObject({ rowCount: 1 })
    })

    it('decidir duas vezes não cria segundo registro nem troca a primeira decisão', async () => {
      const c = await novoCenario()
      const outroProfessor = await novoUsuario(c.escolaId, 'professor')
      const adaptada = await novoArtefato(c, { origemId: await novoArtefato(c) })
      const entregaId = await entregaDeAdaptacao(c, adaptada)
      // Dois cliques: o `update … where estado = 'pendente'` de um acha a linha, o do outro não.
      const [primeira, segunda] = await Promise.all([aprovar(c, entregaId), aprovar(c, entregaId, outroProfessor)])
      expect([primeira.rowCount, segunda.rowCount].sort()).toEqual([0, 1])
      const rejeicao = await cliente.query(
        "update entrega set estado = 'rejeitada', decidida_por = $2, decidida_em = now(), justificativa = 'A versão ficou longa demais' where id = $1 and estado = 'pendente'",
        [entregaId, outroProfessor],
      )
      expect(rejeicao.rowCount).toBe(0)
      const { rows } = await cliente.query<{ estado: string; decidida_por: string; justificativa: string | null }>('select estado, decidida_por, justificativa from entrega where escola_id = $1', [c.escolaId])
      expect(rows).toEqual([{ estado: 'aprovada', decidida_por: c.professorId, justificativa: null }])
      // E a versão adaptada tem uma entrega só: a segunda nem nasce.
      expect(await recusa(entregaDeAdaptacao(c, adaptada))).toEqual({ codigo: '23505', restricao: 'entrega_uma_por_versao_adaptada' })
    })

    it('a versão adaptada só é aplicada à turma com a entrega aprovada; pendente, rejeitada e sem entrega são recusadas', async () => {
      const c = await novoCenario()
      const original = await novoArtefato(c)
      const adaptada = await novoArtefato(c, { origemId: original })
      const recusada = { codigo: '23514', restricao: 'atividade_aplicada_versao_adaptada_aprovada' }
      expect(await recusa(aplicar(c, adaptada)), 'sem entrega').toEqual(recusada)
      const entregaId = await entregaDeAdaptacao(c, adaptada)
      expect(await recusa(aplicar(c, adaptada)), 'pendente').toEqual(recusada)
      await cliente.query("update entrega set estado = 'rejeitada', decidida_por = $2, decidida_em = now(), justificativa = 'O enunciado mudou o que é cobrado' where id = $1", [entregaId, c.professorId])
      expect(await recusa(aplicar(c, adaptada)), 'rejeitada').toEqual(recusada)
      expect(await contar('atividade_aplicada', c.escolaId)).toBe(0)

      const outraAdaptada = await novoArtefato(c, { origemId: original })
      await aprovar(c, await entregaDeAdaptacao(c, outraAdaptada))
      await expect(aplicar(c, outraAdaptada)).resolves.toMatch(/^[0-9a-f-]{36}$/)
      // O original é rascunho do professor, e aplicar é o ato registrado dele: passa sem entrega.
      await expect(aplicar(c, original)).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('só atividade objetiva é aplicada, sempre com quem aplicou, e o duplo clique não abre duas', async () => {
      const c = await novoCenario()
      const plano = await id("insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo) values ($1, $2, $3, $4, 'plano_de_aula', 'Plano', '{\"tipo\":\"plano_de_aula\"}') returning id", [
        c.escolaId,
        c.anoLetivoId,
        c.turmaId,
        c.disciplinaId,
      ])
      expect(await recusa(aplicar(c, plano))).toEqual({ codigo: '23514', restricao: 'atividade_aplicada_so_atividade_objetiva' })
      const atividade = await novoArtefato(c)
      expect(
        await recusa(cliente.query('insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa) values ($1, $2, $3, $4, false)', [c.escolaId, c.anoLetivoId, c.turmaId, atividade])),
      ).toMatchObject({ codigo: '23502' })
      const aplicada = await aplicar(c, atividade)
      expect(await recusa(aplicar(c, atividade))).toEqual({ codigo: '23505', restricao: 'atividade_aplicada_aberta_unica' })
      expect(await recusa(cliente.query("update atividade_aplicada set estado = 'encerrada' where id = $1", [aplicada]))).toEqual({ codigo: '23514', restricao: 'atividade_aplicada_encerrada_tem_data' })
      await cliente.query("update atividade_aplicada set estado = 'encerrada', encerrada_em = now() where id = $1", [aplicada])
      // Encerrada, a mesma atividade pode ser aplicada de novo à turma.
      await expect(aplicar(c, atividade)).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('resposta do aluno: nenhuma se perde nem se duplica (regra 80, item 6)', () => {
    it('a mesma resposta gravada duas vezes é uma linha só, e a última alternativa é a que vale', async () => {
      const c = await novoCenario()
      const aplicada = await aplicar(c, await novoArtefato(c))
      await novaTentativa(c, aplicada)
      const responder = (alternativa: number, comConflito: boolean) =>
        cliente.query(
          `insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 1, $5)${
            comConflito ? ' on conflict (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao) do update set alternativa = excluded.alternativa, respondida_em = now()' : ''
          }`,
          [c.escolaId, c.anoLetivoId, aplicada, c.alunoId, alternativa],
        )
      await responder(2, true)
      // O reenvio da tela, as duas abas e a troca de alternativa: sempre a mesma linha.
      await Promise.all([responder(2, true), responder(2, true)])
      await responder(3, true)
      const { rows } = await cliente.query<{ questao: number; alternativa: number }>('select questao, alternativa from resposta_atividade where escola_id = $1', [c.escolaId])
      expect(rows).toEqual([{ questao: 1, alternativa: 3 }])
      // Sem o `on conflict`, a segunda linha é recusada pelo banco, em vez de criada.
      expect(await recusa(responder(0, false))).toEqual({ codigo: '23505', restricao: 'resposta_atividade_uma_por_questao' })
    })

    it('não existe resposta sem tentativa, de questão fora de 1 a 20 nem de alternativa fora de 0 a 3; e a tentativa é uma por aluno', async () => {
      const c = await novoCenario()
      const aplicada = await aplicar(c, await novoArtefato(c))
      const responder = (questaoNumero: number, alternativa: number) =>
        cliente.query('insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, $5, $6)', [c.escolaId, c.anoLetivoId, aplicada, c.alunoId, questaoNumero, alternativa])
      expect(await recusa(responder(1, 0))).toEqual({ codigo: '23503', restricao: 'resposta_atividade_tentativa_fk' })
      await novaTentativa(c, aplicada)
      expect(await recusa(novaTentativa(c, aplicada))).toEqual({ codigo: '23505', restricao: 'tentativa_atividade_uma_por_aluno' })
      for (const numero of [0, 21]) expect(await recusa(responder(numero, 0)), String(numero)).toEqual({ codigo: '23514', restricao: 'resposta_atividade_questao_valida' })
      for (const alternativa of [-1, 4]) expect(await recusa(responder(1, alternativa)), String(alternativa)).toEqual({ codigo: '23514', restricao: 'resposta_atividade_alternativa_valida' })
      await expect(responder(20, 3)).resolves.toMatchObject({ rowCount: 1 })
    })
  })

  describe('correção e validação do lote (D33, D46, D55, D56)', () => {
    async function lote(c: Cenario): Promise<{ aplicada: string; entregaId: string }> {
      const aplicada = await aplicar(c, await novoArtefato(c))
      await novaTentativa(c, aplicada)
      return { aplicada, entregaId: await entregaDeLote(c, aplicada) }
    }

    it('o lote aprovado sem o registro da validação é recusado no commit, e com ele, na mesma transação, passa', async () => {
      const c = await novoCenario()
      const { aplicada, entregaId } = await lote(c)
      // Fora de transação o gatilho adiado confere no fim do comando: a aprovação solta não fica.
      expect(await recusa(aprovar(c, entregaId))).toEqual({ codigo: '23514', restricao: 'entrega_lote_aprovado_com_validacao' })
      await cliente.query('begin')
      await aprovar(c, entregaId)
      expect(await recusa(cliente.query('commit'))).toEqual({ codigo: '23514', restricao: 'entrega_lote_aprovado_com_validacao' })
      const { rows: antes } = await cliente.query<{ estado: string }>('select estado from entrega where id = $1', [entregaId])
      expect(antes).toEqual([{ estado: 'pendente' }])

      await cliente.query('begin')
      await aprovar(c, entregaId)
      await validar(c, entregaId, aplicada, [], [])
      await cliente.query('commit')
      const { rows: depois } = await cliente.query<{ estado: string; decidida_por: string }>('select estado, decidida_por from entrega where id = $1', [entregaId])
      expect(depois).toEqual([{ estado: 'aprovada', decidida_por: c.professorId }])
      // A versão adaptada não é lote: a aprovação dela não pede validação.
      const adaptada = await novoArtefato(c, { origemId: await novoArtefato(c) })
      expect((await aprovar(c, await entregaDeAdaptacao(c, adaptada))).rowCount).toBe(1)
    })

    it('a validação guarda o que foi apresentado, o que foi aberto e quem confirmou, e não existe com destaque sem abrir', async () => {
      const c = await novoCenario()
      const outroAluno = await novoUsuario(c.escolaId, 'aluno')
      const { aplicada, entregaId } = await lote(c)
      const semAbrir = { codigo: '23514', restricao: 'validacao_do_lote_destaques_todos_abertos' }
      expect(await recusa(validar(c, entregaId, aplicada, [c.alunoId, outroAluno], [])), 'nenhum aberto').toEqual(semAbrir)
      expect(await recusa(validar(c, entregaId, aplicada, [c.alunoId, outroAluno], [c.alunoId])), 'um de dois').toEqual(semAbrir)
      expect(await recusa(validar(c, entregaId, aplicada, [c.alunoId], [outroAluno])), 'aberto o de outro aluno').toEqual(semAbrir)
      await validar(c, entregaId, aplicada, [c.alunoId, outroAluno], [outroAluno, c.alunoId])
      // O duplo clique em aprovar: a segunda validação do mesmo lote não entra.
      expect(await recusa(validar(c, entregaId, aplicada, [], []))).toEqual({ codigo: '23505', restricao: 'validacao_do_lote_uma_por_lote' })

      const { rows } = await cliente.query<{ apresentado: { resumo: unknown; destaques: Array<{ alunoId: string; motivos: string[] }> }; aberto: Array<{ alunoId: string; abertoEm: string }>; confirmada_por: string; confirmada_em: Date }>(
        'select apresentado, aberto, confirmada_por, confirmada_em from validacao_do_lote where escola_id = $1',
        [c.escolaId],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]?.apresentado.resumo).toEqual(resumoDoLote)
      expect(rows[0]?.apresentado.destaques.map((destaque) => destaque.alunoId).sort()).toEqual([c.alunoId, outroAluno].sort())
      expect(rows[0]?.aberto.map((aberto) => aberto.alunoId).sort()).toEqual([c.alunoId, outroAluno].sort())
      expect(rows[0]?.confirmada_por).toBe(c.professorId)
      expect(rows[0]?.confirmada_em).toBeInstanceOf(Date)
    })

    it('D56: a validação é recusada havendo correção do lote com destaque sem abrir, mesmo que o registro diga que não havia destaque', async () => {
      const c = await novoCenario()
      const { aplicada, entregaId } = await lote(c)
      const correcaoId = await novaCorrecao(c, entregaId, aplicada, ['em_branco', 'padrao_de_erro'])
      const semAbrir = { codigo: '23514', restricao: 'validacao_do_lote_destaques_do_lote_abertos' }
      // O registro com a lista de destaques vazia passava no check, que só compara o JSON com ele mesmo.
      expect(await recusa(validar(c, entregaId, aplicada, [], [])), 'apresentado vazio').toEqual(semAbrir)
      // E o registro que diz que abriu, sem a correção ter sido aberta de fato.
      expect(await recusa(validar(c, entregaId, aplicada, [c.alunoId], [c.alunoId])), 'aberto só no registro').toEqual(semAbrir)
      // Aprovar o lote na mesma transação não muda nada: sem a validação, o commit cai.
      await cliente.query('begin')
      await aprovar(c, entregaId)
      expect(await recusa(validar(c, entregaId, aplicada, [], []))).toEqual(semAbrir)
      await cliente.query('rollback')

      await cliente.query('update correcao set destaque_aberto_em = now(), destaque_aberto_por = $2 where id = $1', [correcaoId, c.professorId])
      // Aberto, o destaque ainda precisa constar do que foi apresentado: o registro não pode omitir o caso.
      expect(await recusa(validar(c, entregaId, aplicada, [], [])), 'aberto e fora do apresentado').toEqual({ codigo: '23514', restricao: 'validacao_do_lote_destaques_do_lote_apresentados' })
      await cliente.query('begin')
      await aprovar(c, entregaId)
      await validar(c, entregaId, aplicada, [c.alunoId], [c.alunoId])
      await cliente.query('commit')
      const { rows } = await cliente.query<{ estado: string }>('select estado from entrega where id = $1', [entregaId])
      expect(rows).toEqual([{ estado: 'aprovada' }])
    })

    it('D56: a correção sem destaque não segura a validação, e o destaque de outro lote também não', async () => {
      const c = await novoCenario()
      const { aplicada, entregaId } = await lote(c)
      await novaCorrecao(c, entregaId, aplicada)
      const outro = await lote(c)
      await novaCorrecao(c, outro.entregaId, outro.aplicada, ['em_branco'])
      await expect(validar(c, entregaId, aplicada, [], [])).resolves.toMatchObject({ rowCount: 1 })
      expect(await recusa(validar(c, outro.entregaId, outro.aplicada, [], []))).toEqual({ codigo: '23514', restricao: 'validacao_do_lote_destaques_do_lote_abertos' })
    })

    it('a validação precisa do formato, de quem confirmou, e só existe para entrega que é lote', async () => {
      const c = await novoCenario()
      const { aplicada, entregaId } = await lote(c)
      const inserir = (apresentado: unknown, aberto: unknown, confirmadaPor: string | null, entrega = entregaId) =>
        cliente.query('insert into validacao_do_lote (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, apresentado, aberto, confirmada_por) values ($1, $2, $3, $4, $5, $6, $7)', [
          c.escolaId,
          c.anoLetivoId,
          entrega,
          aplicada,
          JSON.stringify(apresentado),
          JSON.stringify(aberto),
          confirmadaPor,
        ])
      // Sem o resumo ou sem a lista de destaques, não há prova do que foi apresentado.
      expect(await recusa(inserir({ destaques: [] }, [], c.professorId))).toEqual({ codigo: '23514', restricao: 'validacao_do_lote_formato' })
      expect(await recusa(inserir({ resumo: resumoDoLote }, [], c.professorId))).toEqual({ codigo: '23514', restricao: 'validacao_do_lote_formato' })
      expect(await recusa(inserir({ resumo: resumoDoLote, destaques: [] }, [], null))).toMatchObject({ codigo: '23502' })
      const adaptada = await novoArtefato(c, { origemId: await novoArtefato(c) })
      expect(await recusa(inserir({ resumo: resumoDoLote, destaques: [] }, [], c.professorId, await entregaDeAdaptacao(c, adaptada)))).toEqual({
        codigo: '23503',
        restricao: 'validacao_do_lote_lote_da_aplicacao_da_escola_fk',
      })
    })

    it('um lote não rejeitado por atividade aplicada; uma correção por aluno no lote; destaque de lista fechada, e só destaque se abre', async () => {
      const c = await novoCenario()
      const { aplicada, entregaId } = await lote(c)
      // Encerrar duas vezes, ou o job de correção rodar duas vezes, não cria dois lotes.
      expect(await recusa(entregaDeLote(c, aplicada))).toEqual({ codigo: '23505', restricao: 'entrega_um_lote_por_aplicacao' })
      const correcaoId = await novaCorrecao(c, entregaId, aplicada, ['em_branco'])
      expect(await recusa(novaCorrecao(c, entregaId, aplicada))).toEqual({ codigo: '23505', restricao: 'correcao_uma_por_aluno_no_lote' })
      expect(await recusa(cliente.query("update correcao set destaques = array['suspeita de cola'] where id = $1", [correcaoId]))).toEqual({ codigo: '23514', restricao: 'correcao_destaques_validos' })
      expect(await recusa(cliente.query('update correcao set acertos = 2 where id = $1', [correcaoId]))).toEqual({ codigo: '23514', restricao: 'correcao_contagem_valida' })
      // Abrir registra quem e quando, juntos; o que não tem destaque não se abre.
      expect(await recusa(cliente.query('update correcao set destaque_aberto_em = now() where id = $1', [correcaoId]))).toEqual({ codigo: '23514', restricao: 'correcao_abertura_so_de_destaque' })
      expect(await recusa(cliente.query("update correcao set destaques = '{}', destaque_aberto_em = now(), destaque_aberto_por = $2 where id = $1", [correcaoId, c.professorId]))).toEqual({
        codigo: '23514',
        restricao: 'correcao_abertura_so_de_destaque',
      })
      const abrir = () => cliente.query('update correcao set destaque_aberto_em = now(), destaque_aberto_por = $2 where id = $1 and destaque_aberto_em is null', [correcaoId, c.professorId])
      expect([(await abrir()).rowCount, (await abrir()).rowCount]).toEqual([1, 0])
      // O lote rejeitado deixa corrigir de novo.
      await cliente.query("update entrega set estado = 'rejeitada', decidida_por = $2, decidida_em = now(), justificativa = 'O gabarito da questão 7 está errado' where id = $1", [entregaId, c.professorId])
      await expect(entregaDeLote(c, aplicada)).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('D46 e D55: não existe tabela `nota`, nem coluna de nota, conceito, pontuação, devolutiva ou feedback nas tabelas do MVP', async () => {
      const { rows: tabelas } = await cliente.query<{ tabela: string | null }>("select to_regclass('public.nota')::text as tabela")
      expect(tabelas[0]?.tabela).toBeNull()
      const { rows } = await cliente.query<{ table_name: string; column_name: string }>(
        "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1::text[]) and column_name ~ '(nota|conceito|pontu|pontos|devolutiva|feedback|merito|rubrica)'",
        [[...TABELAS_DO_MVP]],
      )
      expect(rows).toEqual([])
      // A resposta do aluno é só a alternativa marcada: não há coluna de texto onde uma discursiva caberia.
      const { rows: colunas } = await cliente.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name in ('resposta_atividade', 'correcao') and data_type in ('text', 'character varying')",
      )
      expect(colunas).toEqual([])
    })
  })

  describe('Tutor e sinais (D36, D57, D66)', () => {
    it('o sinal é tipo fechado mais referência ao trabalho: não tem coluna de texto livre nem de conteúdo', async () => {
      const { rows } = await cliente.query<{ column_name: string; data_type: string }>(
        "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'sinal_tutor' and data_type not in ('uuid', 'smallint', 'integer', 'timestamp with time zone') order by column_name",
      )
      // A única coluna que não é id, número ou data é o tipo, e o check o prende à lista.
      expect(rows).toEqual([{ column_name: 'tipo', data_type: 'text' }])
      const c = await novoCenario()
      expect(await recusa(novoSinal(c, 'desatento'))).toEqual({ codigo: '23514', restricao: 'sinal_tutor_tipo_valido' })
      expect(await recusa(novoSinal(c, 'parece triste'))).toEqual({ codigo: '23514', restricao: 'sinal_tutor_tipo_valido' })
    })

    it('o sinal `atencao_humana` não carrega nada da conversa: atividade, questão, material e página são recusados nele', async () => {
      const c = await novoCenario()
      const aplicada = await aplicar(c, await novoArtefato(c))
      const materialId = await novoMaterial(c)
      const semReferencia = { codigo: '23514', restricao: 'sinal_tutor_atencao_humana_sem_referencia' }
      expect(await recusa(novoSinal(c, 'atencao_humana', { atividade_aplicada_id: aplicada }))).toEqual(semReferencia)
      expect(await recusa(novoSinal(c, 'atencao_humana', { atividade_aplicada_id: aplicada, questao: 3 }))).toEqual(semReferencia)
      expect(await recusa(novoSinal(c, 'atencao_humana', { material_id: materialId, pagina: 12 }))).toEqual(semReferencia)
      await expect(novoSinal(c, 'atencao_humana')).resolves.toMatch(/^[0-9a-f-]{36}$/)
      // Os sinais de trabalho carregam onde aconteceu, e a questão só existe dentro de uma atividade.
      await expect(novoSinal(c, 'travou', { atividade_aplicada_id: aplicada, questao: 3 })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      expect(await recusa(novoSinal(c, 'travou', { questao: 3 }))).toEqual({ codigo: '23514', restricao: 'sinal_tutor_questao_valida' })
      expect(await recusa(novoSinal(c, 'duvida_repetida', { pagina: 12 }))).toEqual({ codigo: '23514', restricao: 'sinal_tutor_pagina_valida' })
    })

    it('D66: as colunas de texto que não são código de lista fechada, e as de jsonb, são só estas; nenhuma é sobre a pessoa do aluno', async () => {
      // Texto que não é código de lista fechada: o que não tem check `in (...)` prendendo a coluna a uma lista. Coluna nova
      // de texto ou de jsonb quebra este teste, e quem a cria precisa dizer aqui o que ela guarda.
      const { rows } = await cliente.query<{ tabela: string; coluna: string }>(
        `select c.table_name as tabela, c.column_name as coluna from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = any($1::text[]) and c.data_type in ('text', 'character varying')
           and not exists (
             select 1 from pg_constraint k where k.conrelid = c.table_name::regclass and k.contype = 'c'
               and pg_get_constraintdef(k.oid) ~ (c.column_name || E' = (ANY \\\\(ARRAY\\\\[|''[a-z_]+''::text\\\\))')
           )
         order by 1, 2`,
        [[...TABELAS_DO_MVP]],
      )
      expect(rows).toEqual([
        // O título e os metadados do material e do artefato, sobre conteúdo didático.
        { tabela: 'artefato', coluna: 'titulo' },
        // Códigos e nomes do catálogo da camada de IA, presos por formato: o código do erro, o modelo, a versão do prompt e a tarefa.
        // O `provedor` é o id de quem recebeu o conteúdo (`IA_PROVEDOR_ID`, F3): vem de variável de ambiente nossa, não de pessoa; o formato dele é conferido na subida (`FORMATO_DO_PROVEDOR_ID`), não no banco.
        { tabela: 'consumo_ia', coluna: 'codigo_de_erro' },
        { tabela: 'consumo_ia', coluna: 'modelo' },
        { tabela: 'consumo_ia', coluna: 'prompt_versao' },
        { tabela: 'consumo_ia', coluna: 'provedor' },
        { tabela: 'consumo_ia', coluna: 'tarefa' },
        // A justificativa do professor sobre a saída da IA (`docs/lgpd.md`).
        { tabela: 'entrega', coluna: 'justificativa' },
        // O código do erro da execução, preso por formato.
        { tabela: 'execucao_agente', coluna: 'erro' },
        { tabela: 'material', coluna: 'licenciante' },
        { tabela: 'material', coluna: 'sha256' },
        { tabela: 'material', coluna: 'titulo' },
        // A conversa do aluno com o Tutor (12 meses, `docs/lgpd.md`).
        { tabela: 'mensagem_tutor', coluna: 'texto' },
        // O texto da página do material.
        { tabela: 'trecho', coluna: 'texto' },
      ])
      const { rows: jsonbs } = await cliente.query<{ tabela: string; coluna: string }>(
        "select table_name as tabela, column_name as coluna from information_schema.columns where table_schema = 'public' and table_name = any($1::text[]) and data_type = 'jsonb' order by 1, 2",
        [[...TABELAS_DO_MVP]],
      )
      expect(jsonbs).toEqual([
        // Questões e plano, com a página citada: `conteudoDoArtefatoSchema`.
        { tabela: 'artefato', coluna: 'conteudo' },
        // O que foi ao modelo e o que voltou, nulos nas tarefas do Tutor (`docs/lgpd.md`).
        { tabela: 'consumo_ia', coluna: 'entrada' },
        { tabela: 'consumo_ia', coluna: 'saida' },
        // Código da habilidade, acertos e total: `diagnosticoGravadoSchema`.
        { tabela: 'correcao', coluna: 'por_habilidade' },
        // Parâmetros da ferramenta e tipos de adaptação (`execucaoInputSchema`), e a referência ao que a execução gravou (`resultadoGravadoSchema`).
        { tabela: 'execucao_agente', coluna: 'entrada' },
        { tabela: 'execucao_agente', coluna: 'resultado' },
        // A conversa do professor com o Assistente, que só ele lê (`docs/lgpd.md`).
        { tabela: 'mensagem_agente', coluna: 'conteudo' },
        // As páginas que o Tutor citou.
        { tabela: 'mensagem_tutor', coluna: 'citacoes' },
        // Números, ids de série e disciplina e códigos: `conteudoDoResumoDoAnalistaSchema`.
        { tabela: 'resumo_do_analista', coluna: 'conteudo' },
        // O que foi aberto e o que foi apresentado, com ids e números: `destaquesAbertosSchema` e `loteApresentadoSchema`.
        { tabela: 'validacao_do_lote', coluna: 'aberto' },
        { tabela: 'validacao_do_lote', coluna: 'apresentado' },
      ])
    })

    it('a mensagem fixa de assunto delicado é só do Tutor, e a citação também', async () => {
      const c = await novoCenario()
      const execucaoId = await novaExecucao(c, 'turno_do_tutor', { solicitadaPor: c.alunoId })
      expect(await recusa(mensagemAoTutor(c, execucaoId, 'aluno', { tipo: 'assunto_delicado' }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_fixa_so_do_tutor' })
      expect(await recusa(mensagemAoTutor(c, execucaoId, 'aluno', { citacoes: '[]' }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_citacoes_so_do_tutor' })
      expect(await recusa(mensagemAoTutor(c, execucaoId, 'aluno', { texto: 'x'.repeat(2001) }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_texto_preenchido' })
      await expect(mensagemAoTutor(c, execucaoId, 'tutor', { tipo: 'assunto_delicado', texto: 'Mensagem combinada com a sua escola.' })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('a mensagem do aluno leva em que ele estava: a questão só com a atividade, a página só com o material, e nunca na resposta do Tutor', async () => {
      const c = await novoCenario()
      const aplicada = await aplicar(c, await novoArtefato(c))
      const materialId = await novoMaterial(c)
      const execucao = () => novaExecucao(c, 'turno_do_tutor', { solicitadaPor: c.alunoId })
      expect(await recusa(mensagemAoTutor(c, await execucao(), 'aluno', { questao: 3 }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_questao_valida' })
      expect(await recusa(mensagemAoTutor(c, await execucao(), 'aluno', { atividade_aplicada_id: aplicada, questao: 21 }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_questao_valida' })
      expect(await recusa(mensagemAoTutor(c, await execucao(), 'tutor', { atividade_aplicada_id: aplicada, questao: 3 }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_questao_valida' })
      expect(await recusa(mensagemAoTutor(c, await execucao(), 'aluno', { pagina: 12 }))).toEqual({ codigo: '23514', restricao: 'mensagem_tutor_pagina_valida' })
      await expect(mensagemAoTutor(c, await execucao(), 'aluno', { atividade_aplicada_id: aplicada, questao: 3 })).resolves.toMatch(/^[0-9a-f-]{36}$/)
      await expect(mensagemAoTutor(c, await execucao(), 'aluno', { material_id: materialId, pagina: 151 })).resolves.toMatch(/^[0-9a-f-]{36}$/)
    })

    it('regra 70, item 4: o aluno que nunca gerou sinal aparece no uso da turma, com as trocas do dia, a última e em que estava, sem a conversa', async () => {
      const c = await novoCenario()
      const semSinal = await novoUsuario(c.escolaId, 'aluno')
      const aplicada = await aplicar(c, await novoArtefato(c))
      const trocar = async (alunoId: string, ajuste: Record<string, unknown> = {}) => {
        const execucaoId = await novaExecucao(c, 'turno_do_tutor', { solicitadaPor: alunoId })
        await mensagemAoTutor(c, execucaoId, 'aluno', { aluno_id: alunoId, ...ajuste })
        await mensagemAoTutor(c, execucaoId, 'tutor', { aluno_id: alunoId, texto: 'O que a equação balanceada diz?' })
      }
      // Um aluno com sinal, e outro com três trocas comuns, uma delas de outro dia, e nenhum sinal.
      await trocar(c.alunoId)
      await novoSinal(c, 'travou')
      await trocar(semSinal, { criada_em: '2026-01-10T12:00:00.000Z' })
      await trocar(semSinal, { atividade_aplicada_id: aplicada, questao: 2 })
      await trocar(semSinal, { atividade_aplicada_id: aplicada, questao: 5 })

      // A leitura que a rota faz: só colunas de contagem, hora e referência, pelo índice parcial das mensagens do aluno.
      const { rows } = await cliente.query<{ aluno_id: string; trocas_hoje: string; atividade_aplicada_id: string | null; questao: number | null }>(
        `select distinct on (m.aluno_id) m.aluno_id,
           count(*) filter (where m.criada_em >= date_trunc('day', now())) over (partition by m.aluno_id) as trocas_hoje,
           m.atividade_aplicada_id, m.questao
         from mensagem_tutor m
         where m.escola_id = $1 and m.ano_letivo_id = $2 and m.turma_id = $3 and m.autor = 'aluno'
         order by m.aluno_id, m.criada_em desc`,
        [c.escolaId, c.anoLetivoId, c.turmaId],
      )
      const porAluno = new Map(rows.map((linha) => [linha.aluno_id, linha]))
      expect(porAluno.size).toBe(2)
      expect(porAluno.get(semSinal)).toEqual({ aluno_id: semSinal, trocas_hoje: '2', atividade_aplicada_id: aplicada, questao: 5 })
      expect(porAluno.get(c.alunoId)).toMatchObject({ trocas_hoje: '1', atividade_aplicada_id: null, questao: null })
      // E ele não tem sinal nenhum: sem o uso, o professor não o veria.
      const { rows: sinais } = await cliente.query<{ total: string }>('select count(*) as total from sinal_tutor where escola_id = $1 and aluno_id = $2', [c.escolaId, semSinal])
      expect(sinais).toEqual([{ total: '0' }])
      const { rows: indice } = await cliente.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'mensagem_tutor' and indexname = 'mensagem_tutor_trocas_idx'")
      expect(indice[0]?.indexdef).toMatch(/\(escola_id, turma_id, criada_em, aluno_id\) WHERE \(autor = 'aluno'::text\)$/)
    })

    it('D38 e D41: o freio e o pacote do Tutor são configuração da escola, nulos por padrão e nunca zero', async () => {
      const c = await novoCenario()
      await cliente.query('insert into configuracao_operacional_escola (escola_id) values ($1)', [c.escolaId])
      const { rows } = await cliente.query<{ tutor_trocas_por_dia: number | null; tutor_trocas_por_mes: number | null }>('select tutor_trocas_por_dia, tutor_trocas_por_mes from configuracao_operacional_escola where escola_id = $1', [
        c.escolaId,
      ])
      expect(rows).toEqual([{ tutor_trocas_por_dia: null, tutor_trocas_por_mes: null }])
      const configurar = (coluna: string, valor: number) => cliente.query(`update configuracao_operacional_escola set ${coluna} = $2 where escola_id = $1`, [c.escolaId, valor])
      expect(await recusa(configurar('tutor_trocas_por_dia', 0))).toEqual({ codigo: '23514', restricao: 'configuracao_operacional_tutor_trocas_por_dia_positivo' })
      expect(await recusa(configurar('tutor_trocas_por_mes', -1))).toEqual({ codigo: '23514', restricao: 'configuracao_operacional_tutor_trocas_por_mes_positivo' })
      await expect(configurar('tutor_trocas_por_dia', 20)).resolves.toMatchObject({ rowCount: 1 })
    })
  })

  describe('governança: suspensão por função e consumo sem pessoa (D60, D64)', () => {
    it('no máximo uma suspensão vigente por escola e função; retomada, a função pode ser suspensa de novo', async () => {
      const [a, b] = [await novoCenario(), await novoCenario()]
      const suspensaoId = await suspender(a, 'correcao_de_objetiva')
      expect(await recusa(suspender(a, 'correcao_de_objetiva'))).toEqual({ codigo: '23505', restricao: 'suspensao_de_funcao_uma_vigente' })
      // Suspender a correção não suspende a adaptação, e a suspensão de A não é a de B.
      await expect(suspender(a, 'adaptacao')).resolves.toMatch(/^[0-9a-f-]{36}$/)
      await expect(suspender(b, 'correcao_de_objetiva')).resolves.toMatch(/^[0-9a-f-]{36}$/)
      expect(await recusa(cliente.query('update suspensao_de_funcao set retomada_em = now() where id = $1', [suspensaoId]))).toEqual({ codigo: '23514', restricao: 'suspensao_de_funcao_retomada_registrada' })
      await cliente.query('update suspensao_de_funcao set retomada_em = now(), retomada_por = $2 where id = $1 and retomada_em is null', [suspensaoId, a.coordenadorId])
      await expect(suspender(a, 'correcao_de_objetiva')).resolves.toMatch(/^[0-9a-f-]{36}$/)
      const { rows } = await cliente.query<{ vigentes: string; total: string }>(
        "select count(*) filter (where retomada_em is null) as vigentes, count(*) as total from suspensao_de_funcao where escola_id = $1 and funcao = 'correcao_de_objetiva'",
        [a.escolaId],
      )
      expect(rows).toEqual([{ vigentes: '1', total: '2' }])
      expect(await recusa(suspender(a, 'funcao_que_nao_existe'))).toEqual({ codigo: '23514', restricao: 'suspensao_de_funcao_funcao_valida' })
      expect(await recusa(cliente.query("insert into suspensao_de_funcao (escola_id, funcao, suspensa_por, motivo) values ($1, 'resumo_e_alerta', $2, 'a professora Ana errou')", [a.escolaId, a.coordenadorId]))).toEqual({
        codigo: '23514',
        restricao: 'suspensao_de_funcao_motivo_valido',
      })
    })

    it('D64: o consumo não tem coluna de usuário nem de professor, e o aluno só entra nas funções do Tutor', async () => {
      const { rows } = await cliente.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'consumo_ia' and column_name ~ '(usuario|professor|solicitad|criado_por)'")
      expect(rows).toEqual([])
      const c = await novoCenario()
      const doTutor = { tarefa: 'turno_do_tutor', funcao: 'tutor_com_o_aluno', perfil: 'rapido' }
      expect(await recusa(consumir(c, { aluno_id: c.professorId }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_aluno_so_no_tutor' })
      expect(await recusa(consumir(c, { funcao: 'funcao_inventada' }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_funcao_valida' })
      await consumir(c)
      await consumir(c, { ...doTutor, aluno_id: c.alunoId })
      // A eliminação do aluno tira a pessoa do consumo, e o custo da escola fica.
      await cliente.query('delete from usuario where id = $1', [c.alunoId])
      const { rows: consumo } = await cliente.query<{ funcao: string; aluno_id: string | null; custo_micros: string }>('select funcao, aluno_id, custo_micros from consumo_ia where escola_id = $1 order by funcao', [c.escolaId])
      expect(consumo).toEqual([
        { funcao: 'conversa_e_ferramentas', aluno_id: null, custo_micros: '0' },
        { funcao: 'tutor_com_o_aluno', aluno_id: null, custo_micros: '0' },
      ])
    })

    it('regra 20 contra regra 30, item 4: `entrada` e `saida` ficam nulas onde a chamada leva conversa de pessoa (o Tutor e a mensagem do professor ao Assistente); nas outras, guardam o que foi e voltou', async () => {
      const c = await novoCenario()
      const doTutor = { tarefa: 'turno_do_tutor', funcao: 'tutor_com_o_aluno', perfil: 'rapido', aluno_id: c.alunoId }
      const semTextoDeAluno = { codigo: '23514', restricao: 'consumo_ia_sem_conversa_de_pessoa' }
      const conversa = JSON.stringify({ mensagem: 'não consigo achar o reagente limitante, e meus pais brigaram ontem' })
      expect(await recusa(consumir(c, { ...doTutor, entrada: conversa })), 'entrada').toEqual(semTextoDeAluno)
      expect(await recusa(consumir(c, { ...doTutor, saida: JSON.stringify({ resposta: 'O que a equação diz?' }) })), 'saida').toEqual(semTextoDeAluno)
      // Sem aluno e na função dos sinais a regra é a mesma: o que prende é a função, e não o campo do aluno.
      expect(await recusa(consumir(c, { tarefa: 'turno_do_tutor', funcao: 'sinais_para_o_professor', perfil: 'rapido', entrada: conversa })), 'sinais').toEqual(semTextoDeAluno)
      await expect(consumir(c, doTutor)).resolves.toMatchObject({ rowCount: 1 })
      // A conversa do professor com o Assistente também não é copiada: fica em `mensagem_agente`, que só ele lê.
      const doProfessor = JSON.stringify({ texto: 'monta uma lista para o 2ºB, o João e a Ana estão com dificuldade' })
      expect(await recusa(consumir(c, { tarefa: 'propor_ferramenta', perfil: 'rapido', entrada: doProfessor })), 'propor_ferramenta, entrada').toEqual(semTextoDeAluno)
      expect(await recusa(consumir(c, { tarefa: 'propor_ferramenta', perfil: 'rapido', saida: JSON.stringify({ texto: 'Quer abrir a ferramenta?' }) })), 'propor_ferramenta, saida').toEqual(semTextoDeAluno)
      await expect(consumir(c, { tarefa: 'propor_ferramenta', perfil: 'rapido' })).resolves.toMatchObject({ rowCount: 1 })
      await expect(consumir(c, { ...doTutor, origem: 'regra_fixa', modelo: 'regra-fixa', tentativas: 0 })).resolves.toMatchObject({ rowCount: 1 })
      // A geração de atividade guarda a entrada e a saída: é o que responde "por que a IA disse isso?".
      await expect(consumir(c, { entrada: JSON.stringify({ tema: 'Reagente limitante' }), saida: JSON.stringify({ tipo: 'atividade_objetiva' }) })).resolves.toMatchObject({ rowCount: 1 })
      const { rows } = await cliente.query<{ funcao: string; com_conteudo: boolean }>('select funcao, (entrada is not null or saida is not null) as com_conteudo from consumo_ia where escola_id = $1 group by 1, 2 order by 1', [c.escolaId])
      expect(rows).toEqual([
        { funcao: 'conversa_e_ferramentas', com_conteudo: false },
        { funcao: 'conversa_e_ferramentas', com_conteudo: true },
        { funcao: 'tutor_com_o_aluno', com_conteudo: false },
      ])
    })

    it('o consumo guarda como a chamada terminou: o erro só no que falhou e só como código; a tarefa só como nome do catálogo', async () => {
      const c = await novoCenario()
      expect(await recusa(consumir(c, { estado: 'falhou' }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_erro_so_no_que_falhou' })
      expect(await recusa(consumir(c, { codigo_de_erro: 'IA_INDISPONIVEL' }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_erro_so_no_que_falhou' })
      expect(await recusa(consumir(c, { estado: 'falhou', codigo_de_erro: 'timeout while sending the prompt' }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_erro_e_codigo' })
      expect(await recusa(consumir(c, { tarefa: 'Gerar a prova da professora Ana' }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_tarefa_e_nome' })
      expect(await recusa(consumir(c, { tokens_de_saida: -1 }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_numeros_validos' })
      await expect(consumir(c, { estado: 'falhou', codigo_de_erro: 'IA_TEMPO_ESGOTADO', tentativas: 2 })).resolves.toMatchObject({ rowCount: 1 })
      // Toda tarefa do contrato cabe no formato do nome.
      for (const tarefa of TAREFAS_DE_IA) await expect(consumir(c, { tarefa, funcao: FUNCAO_DA_TAREFA_DE_IA[tarefa] }), tarefa).resolves.toMatchObject({ rowCount: 1 })
    })

    it('o provedor só existe onde houve envio externo; a linha no formato anterior à coluna continua entrando', async () => {
      const c = await novoCenario()
      expect(await recusa(consumir(c, { provedor: 'provedor-de-teste' }))).toEqual({ codigo: '23514', restricao: 'consumo_ia_provedor_so_no_envio_externo' })
      await expect(consumir(c, { envio_externo: true, provedor: 'provedor-de-teste' })).resolves.toMatchObject({ rowCount: 1 })
      // O código anterior não conhece a coluna: externo sem provedor, e local sem provedor, entram como entravam. A exigência
      // contrária (externo sempre com provedor) só vem num release posterior, para o rollback não quebrar.
      await expect(consumir(c, { envio_externo: true })).resolves.toMatchObject({ rowCount: 1 })
      await expect(consumir(c)).resolves.toMatchObject({ rowCount: 1 })
    })

    it('D38: o freio diário do Tutor conta as chamadas do aluno no dia pelo índice parcial que começa pela escola e pelo aluno', async () => {
      const { rows: indices } = await cliente.query<{ indexdef: string }>("select indexdef from pg_indexes where tablename = 'consumo_ia' and indexname = 'consumo_ia_aluno_idx'")
      expect(indices[0]?.indexdef).toMatch(/\(escola_id, aluno_id, em\) WHERE \(aluno_id IS NOT NULL\)$/)
      const c = await novoCenario()
      const outroAluno = await novoUsuario(c.escolaId, 'aluno')
      const doTutor = { tarefa: 'turno_do_tutor', funcao: 'tutor_com_o_aluno', perfil: 'rapido' }
      await consumir(c, { ...doTutor, aluno_id: c.alunoId })
      await consumir(c, { ...doTutor, aluno_id: c.alunoId, origem: 'regra_fixa', modelo: 'regra-fixa', tentativas: 0 })
      await consumir(c, { ...doTutor, aluno_id: c.alunoId, em: '2026-01-10T12:00:00.000Z' })
      await consumir(c, { ...doTutor, aluno_id: outroAluno })
      const { rows } = await cliente.query<{ trocas: string }>(
        "select count(*) as trocas from consumo_ia where escola_id = $1 and aluno_id = $2 and funcao = 'tutor_com_o_aluno' and estado = 'concluida' and em >= date_trunc('day', now())",
        [c.escolaId, c.alunoId],
      )
      // As duas de hoje, a do modelo e a de regra fixa; não a de janeiro nem a do colega.
      expect(rows).toEqual([{ trocas: '2' }])
    })

    it('o resumo do Analista só entra como objeto com recortes e alertas, e um por execução', async () => {
      const c = await novoCenario()
      const execucaoId = await novaExecucao(c, 'resumo_do_analista', { solicitadaPor: c.coordenadorId })
      const gravar = (conteudo: unknown) => cliente.query('insert into resumo_do_analista (escola_id, ano_letivo_id, execucao_id, conteudo) values ($1, $2, $3, $4)', [c.escolaId, c.anoLetivoId, execucaoId, JSON.stringify(conteudo)])
      expect(await recusa(gravar('A professora de Química do 2ºB está com a turma abaixo da média'))).toEqual({ codigo: '23514', restricao: 'resumo_do_analista_conteudo_formato' })
      expect(await recusa(gravar({ recortes: [] }))).toEqual({ codigo: '23514', restricao: 'resumo_do_analista_conteudo_formato' })
      await gravar({ recortes: [], alertas: [] })
      expect(await recusa(gravar({ recortes: [], alertas: [] }))).toEqual({ codigo: '23505', restricao: 'resumo_do_analista_um_por_execucao' })
    })
  })

  describe('eliminação a pedido do titular (regra 20, item 15)', () => {
    it('a eliminação do aluno apaga a tentativa, as respostas, a correção, a conversa com o Tutor e os sinais dele', async () => {
      const c = await novoCenario()
      const aplicada = await aplicar(c, await novoArtefato(c))
      await novaTentativa(c, aplicada)
      await cliente.query('insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 1, 1)', [c.escolaId, c.anoLetivoId, aplicada, c.alunoId])
      const entregaId = await entregaDeLote(c, aplicada)
      await novaCorrecao(c, entregaId, aplicada)
      const execucaoId = await novaExecucao(c, 'turno_do_tutor', { solicitadaPor: c.alunoId })
      await mensagemAoTutor(c, execucaoId, 'aluno')
      await mensagemAoTutor(c, execucaoId, 'tutor')
      await novoSinal(c, 'travou', { execucao_id: execucaoId })
      const doAluno = ['tentativa_atividade', 'resposta_atividade', 'correcao', 'mensagem_tutor', 'sinal_tutor']
      for (const tabela of doAluno) expect(await contar(tabela, c.escolaId), tabela).toBeGreaterThan(0)

      await cliente.query('delete from usuario where id = $1', [c.alunoId])
      for (const tabela of doAluno) expect(await contar(tabela, c.escolaId), tabela).toBe(0)
      // A execução fica, sem quem pediu: ninguém mais a consulta.
      const { rows } = await cliente.query<{ solicitada_por: string | null }>('select solicitada_por from execucao_agente where id = $1', [execucaoId])
      expect(rows).toEqual([{ solicitada_por: null }])
    })

    it('a eliminação do professor não apaga quem aprovou, quem aplicou nem quem validou; a autoria do artefato vira nula', async () => {
      const c = await novoCenario()
      const artefatoId = await novoArtefato(c)
      const aplicada = await aplicar(c, artefatoId)
      const entregaId = await entregaDeLote(c, aplicada)
      await cliente.query('begin')
      await aprovar(c, entregaId)
      await validar(c, entregaId, aplicada, [], [])
      await cliente.query('commit')

      await cliente.query('delete from usuario where id = $1', [c.professorId])
      const { rows } = await cliente.query<{ criado_por: string | null; aplicada_por: string; decidida_por: string; confirmada_por: string }>(
        `select a.criado_por, p.aplicada_por, e.decidida_por, v.confirmada_por
         from artefato a join atividade_aplicada p on p.artefato_id = a.id join entrega e on e.atividade_aplicada_id = p.id join validacao_do_lote v on v.entrega_id = e.id
         where a.id = $1`,
        [artefatoId],
      )
      expect(rows).toEqual([{ criado_por: null, aplicada_por: c.professorId, decidida_por: c.professorId, confirmada_por: c.professorId }])
    })
  })

  describe('o banco e o contrato dizem a mesma lista', () => {
    // Cada check de lista fechada é escrito por extenso no schema, porque o drizzle-kit lê `@educa/shared` pelo `dist`.
    // Este teste compara o que ficou no banco com a constante do contrato: mudar uma sem a outra deixa a esteira vermelha.
    const LISTAS: ReadonlyArray<readonly [tabela: string, restricao: string, lista: readonly string[]]> = [
      ['material', 'material_titularidade_valida', TITULARIDADES_DE_MATERIAL],
      ['material', 'material_licenca_valida', LICENCAS_DE_MATERIAL],
      ['material', 'material_estado_valido', ESTADOS_DE_MATERIAL],
      ['material', 'material_falha_valida', FALHAS_DE_MATERIAL],
      ['consumo_ia', 'consumo_ia_funcao_valida', CHAVES_DE_FUNCAO],
      ['consumo_ia', 'consumo_ia_perfil_valido', PERFIS_DE_IA],
      ['consumo_ia', 'consumo_ia_origem_valida', ORIGENS_DA_SAIDA_DE_IA],
      ['consumo_ia', 'consumo_ia_estado_valido', ESTADOS_DE_CONSUMO_DE_IA],
      ['thread_agente', 'thread_agente_agente_valido', AGENTES],
      ['execucao_agente', 'execucao_agente_funcao_valida', CHAVES_DE_FUNCAO],
      ['execucao_agente', 'execucao_agente_tarefa_valida', TAREFAS_DE_IA],
      ['execucao_agente', 'execucao_agente_estado_valido', ESTADOS_DE_EXECUCAO],
      ['entrega', 'entrega_estado_valido', ESTADOS_DE_ENTREGA],
      ['entrega', 'entrega_tipo_valido', TIPOS_DE_ENTREGA],
      ['artefato', 'artefato_tipo_valido', TIPOS_DE_ARTEFATO],
      ['atividade_aplicada', 'atividade_aplicada_estado_valido', ESTADOS_DE_ATIVIDADE_APLICADA],
      ['correcao', 'correcao_destaques_validos', MOTIVOS_DE_DESTAQUE],
      ['mensagem_tutor', 'mensagem_tutor_tipo_valido', TIPOS_DE_MENSAGEM_DO_TUTOR],
      ['sinal_tutor', 'sinal_tutor_tipo_valido', TIPOS_DE_SINAL],
      ['suspensao_de_funcao', 'suspensao_de_funcao_funcao_valida', CHAVES_DE_FUNCAO],
      ['suspensao_de_funcao', 'suspensao_de_funcao_motivo_valido', MOTIVOS_DE_SUSPENSAO],
    ]

    async function definicao(tabela: string, restricao: string): Promise<string> {
      const { rows } = await cliente.query<{ definicao: string }>('select pg_get_constraintdef(oid) as definicao from pg_constraint where conrelid = $1::regclass and conname = $2', [tabela, restricao])
      const linha = rows[0]
      if (linha === undefined) throw new Error(`restrição ausente: ${restricao}`)
      return linha.definicao
    }

    const textos = (texto: string): string[] => [...texto.matchAll(/'([a-z_]+)'::text/g)].map((achado) => achado[1] ?? '')

    it.each(LISTAS)('%s: o check %s aceita exatamente a lista do contrato', async (tabela, restricao, lista) => {
      expect([...new Set(textos(await definicao(tabela, restricao)))].sort()).toEqual([...lista].sort())
    })

    it('os tipos de adaptação do check do artefato são os do contrato, e o par tarefa e função da execução e o formato do código de erro também', async () => {
      const adaptacao = await definicao('artefato', 'artefato_adaptacao_fechada')
      const lista = /<@ '(\[[^\]]+\])'::jsonb/.exec(adaptacao)?.[1]
      expect((JSON.parse(lista ?? '[]') as string[]).sort()).toEqual([...TIPOS_DE_ADAPTACAO].sort())

      const c = await novoCenario()
      for (const [tarefa, funcao] of Object.entries(FUNCAO_DA_TAREFA_DE_IA)) {
        await expect(novaExecucao(c, tarefa, { funcao }), tarefa).resolves.toMatch(/^[0-9a-f-]{36}$/)
        const outra = CHAVES_DE_FUNCAO.find((chave) => chave !== funcao) ?? ''
        expect(await recusa(novaExecucao(c, tarefa, { funcao: outra })), `${tarefa} com ${outra}`).toEqual({ codigo: '23514', restricao: 'execucao_agente_tarefa_da_funcao' })
      }
      // O formato do código de erro é o mesmo no contrato e nos dois checks do banco.
      for (const [tabela, restricao] of [['execucao_agente', 'execucao_agente_erro_e_codigo'], ['consumo_ia', 'consumo_ia_erro_e_codigo']] as const) {
        expect(await definicao(tabela, restricao), restricao).toContain(`'${FORMATO_DO_CODIGO_DE_ERRO.source}'`)
      }
    })
  })
})
