import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'

/**
 * O que os specs da governança e do Analista (MVP, A5) precisam no banco antes de a coordenação entrar: a escola já com
 * entregas, do jeito que o roteiro da demonstração a deixa no passo 5. Tudo sintético, gravado direto.
 *
 * No 2º ano do Ensino Médio: **Química tem duas professoras** (uma no 2ºB, outra no 2ºC) e **Física, uma só** (no 2ºB).
 * As listas de Química do 2ºB e do 2ºC e a de Física do 2ºB estão corrigidas e com o lote aprovado (cada uma pela
 * professora dela); há uma versão adaptada de Química esperando a professora. Com isso a governança tem número e linha, o Analista tem um recorte com número
 * (Química) e um sem (Física), e o resumo gera um alerta (acerto de 50% numa habilidade).
 */
export interface EscolaComEntregas {
  readonly serieNome: string
  readonly turmas: { readonly doB: { readonly id: string; readonly nome: string }; readonly doC: { readonly id: string; readonly nome: string } }
  /** Os nomes das três professoras: é o que nunca pode aparecer no agregado, e o que o dado nominal mostra. */
  readonly professoras: { readonly quimicaDoB: string; readonly quimicaDoC: string; readonly fisicaDoB: string }
  readonly aluno: string
}

const HABILIDADE_MASSA = { codigo: 'QUI.EM.05', descricao: 'Calcular a massa de reagentes e produtos numa reação' }
const HABILIDADE_LIMITANTE = { codigo: 'QUI.EM.06', descricao: 'Identificar o reagente limitante' }

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

async function id(banco: Client, instrucao: string, parametros: unknown[]): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(instrucao, parametros)
  const criado = rows[0]?.id
  if (criado === undefined) throw new Error(`o seed da governança não criou a linha: ${instrucao}`)
  return criado
}

function conteudoDaLista(titulo: string): string {
  const materialId = randomUUID()
  return JSON.stringify({
    tipo: 'atividade_objetiva',
    titulo,
    questoes: [0, 1, 2, 3].map((indice) => ({
      enunciado: `Enunciado sintético da questão ${String(indice + 1)}`,
      alternativas: ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'],
      gabarito: indice,
      habilidade: indice < 2 ? HABILIDADE_MASSA : HABILIDADE_LIMITANTE,
      citacao: { materialId, pagina: indice + 1, trecho: 'Trecho sintético do material' },
      explicacao: `Explicação sintética da questão ${String(indice + 1)}`,
    })),
  })
}

/** Monta, na escola da coordenadora, as turmas, as professoras, o aluno e as entregas descritas acima. */
export async function montarEscolaComEntregas(escolaId: string, coordenadoraId: string): Promise<EscolaComEntregas> {
  const marca = randomUUID().slice(0, 8)
  const professoras = { quimicaDoB: `Professora Sintética Helena ${marca}`, quimicaDoC: `Professora Sintética Marta ${marca}`, fisicaDoB: `Professor Sintético Davi ${marca}` }
  const aluno = `Aluno Sintético Caio ${marca}`
  return comBanco(async (banco) => {
    const { rows: anos } = await banco.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])
    const anoLetivoId = anos[0]?.id
    if (anoLetivoId === undefined) throw new Error('a escola do e2e não tem ano letivo em curso')
    const serieId = await id(banco, "insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) on conflict (escola_id, etapa, ano) do update set ano = excluded.ano returning id", [escolaId])
    const quimica = await id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, 'Química'])
    const fisica = await id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, 'Física'])
    const turma = (nome: string) => id(banco, 'insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoLetivoId, serieId, nome])
    const doB = { id: await turma(`2ºB ${marca}`), nome: `2ºB ${marca}` }
    const doC = { id: await turma(`2ºC ${marca}`), nome: `2ºC ${marca}` }

    // A equipe tem conta (o banco exige); o aluno, não.
    const pessoa = async (papel: 'professor' | 'aluno', nome: string): Promise<string> => {
      const contaId = papel === 'aluno' ? null : await id(banco, 'insert into conta (email) values ($1) returning id', [`professor-${randomUUID()}@educa.invalid`])
      return id(banco, 'insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, $3, $4, now()) returning id', [escolaId, contaId, papel, nome])
    }
    const vincular = (usuarioId: string, turmaId: string, disciplinaId: string | null, papel: 'professor' | 'aluno') =>
      banco.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, decidido_em, criado_por) values ($1, $2, $3, $4, $5, $6, 'confirmado', now(), $7)", [
        escolaId,
        anoLetivoId,
        usuarioId,
        turmaId,
        disciplinaId,
        papel,
        coordenadoraId,
      ])
    const deQuimicaNoB = await pessoa('professor', professoras.quimicaDoB)
    const deQuimicaNoC = await pessoa('professor', professoras.quimicaDoC)
    const deFisicaNoB = await pessoa('professor', professoras.fisicaDoB)
    const alunoId = await pessoa('aluno', aluno)
    await vincular(deQuimicaNoB, doB.id, quimica, 'professor')
    await vincular(deQuimicaNoC, doC.id, quimica, 'professor')
    await vincular(deFisicaNoB, doB.id, fisica, 'professor')
    await vincular(alunoId, doB.id, null, 'aluno')

    const artefato = (disciplinaId: string, titulo: string, autor: string, origemId: string | null = null, turmaId: string = doB.id) =>
      id(
        banco,
        `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por)
         values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6::jsonb || $7::jsonb, $8, $9) returning id`,
        [escolaId, anoLetivoId, turmaId, disciplinaId, titulo, conteudoDaLista(titulo), origemId === null ? '{}' : '{"adaptacao": {"tipos": ["fonte_ampliada"]}}', origemId, autor],
      )

    /** A lista aplicada, respondida, corrigida e com o lote aprovado pela professora, com a validação registrada (D56). */
    async function loteAprovado(
      disciplinaId: string,
      titulo: string,
      professora: string,
      porHabilidade: readonly { codigo: string; acertos: number; total: number }[],
      turmaId: string = doB.id,
      deQuem: string = alunoId,
    ): Promise<string> {
      const artefatoId = await artefato(disciplinaId, titulo, professora, null, turmaId)
      const aplicadaId = await id(
        banco,
        "insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, estado, aplicada_por, encerrada_em) values ($1, $2, $3, $4, false, 'encerrada', $5, now()) returning id",
        [escolaId, anoLetivoId, turmaId, artefatoId, professora],
      )
      const acertos = porHabilidade.reduce((soma, medida) => soma + medida.acertos, 0)
      const total = porHabilidade.reduce((soma, medida) => soma + medida.total, 0)
      await banco.query('begin')
      try {
        await banco.query('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, enviada_em) values ($1, $2, $3, $4, now())', [escolaId, anoLetivoId, aplicadaId, deQuem])
        const entregaId = await id(banco, "insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id) values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4) returning id", [
          escolaId,
          anoLetivoId,
          turmaId,
          aplicadaId,
        ])
        await banco.query('insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade) values ($1, $2, $3, $4, $5, $6, $7, 0, $8)', [
          escolaId,
          anoLetivoId,
          entregaId,
          aplicadaId,
          deQuem,
          acertos,
          total,
          JSON.stringify(porHabilidade),
        ])
        await banco.query('insert into validacao_do_lote (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, apresentado, aberto, confirmada_por) values ($1, $2, $3, $4, $5, $6, $7)', [
          escolaId,
          anoLetivoId,
          entregaId,
          aplicadaId,
          JSON.stringify({ resumo: { alunos: 1, enviadas: 1 }, destaques: [] }),
          '[]',
          professora,
        ])
        await banco.query("update entrega set estado = 'aprovada', decidida_por = $3, decidida_em = now() where escola_id = $1 and id = $2", [escolaId, entregaId, professora])
        await banco.query('commit')
      } catch (erro) {
        await banco.query('rollback')
        throw erro
      }
      return artefatoId
    }

    // Química: tudo certo na primeira habilidade, metade na segunda (50%, abaixo da referência do alerta).
    const listaDeQuimica = await loteAprovado(quimica, 'Estequiometria: lista sintética', deQuimicaNoB, [
      { codigo: HABILIDADE_MASSA.codigo, acertos: 2, total: 2 },
      { codigo: HABILIDADE_LIMITANTE.codigo, acertos: 1, total: 2 },
    ])
    // Química no 2ºC, da segunda professora: com as duas tendo correção aprovada, a Química tem número no Analista.
    const alunoDoC = await pessoa('aluno', `Aluna Sintética Lia ${marca}`)
    await vincular(alunoDoC, doC.id, null, 'aluno')
    await loteAprovado(
      quimica,
      'Estequiometria: lista sintética do 2ºC',
      deQuimicaNoC,
      [
        { codigo: HABILIDADE_MASSA.codigo, acertos: 2, total: 2 },
        { codigo: HABILIDADE_LIMITANTE.codigo, acertos: 1, total: 2 },
      ],
      doC.id,
      alunoDoC,
    )
    await loteAprovado(fisica, 'Cinemática: lista sintética', deFisicaNoB, [
      { codigo: HABILIDADE_MASSA.codigo, acertos: 1, total: 2 },
      { codigo: HABILIDADE_LIMITANTE.codigo, acertos: 0, total: 2 },
    ])
    // A versão adaptada de Química, esperando a professora.
    const adaptada = await artefato(quimica, 'Estequiometria: versão adaptada sintética', deQuimicaNoB, listaDeQuimica)
    await banco.query("insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id) values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4)", [escolaId, anoLetivoId, doB.id, adaptada])

    // O consumo do mês: duas execuções do Assistente e uma do Tutor, sem texto de ninguém.
    for (const [funcao, tarefa, entrada, saida] of [
      ['conversa_e_ferramentas', 'gerar_atividade_objetiva', 900, 300],
      ['conversa_e_ferramentas', 'propor_ferramenta', 250, 50],
      ['tutor_com_o_aluno', 'turno_do_tutor', 400, 100],
    ] as const) {
      await banco.query(
        `insert into consumo_ia (escola_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado)
         values ($1, $2, $3, 'padrao', 'falso', 'modelo-sintetico', '2026-10-04.1', $4, $5, 10, false, 1, 'concluida')`,
        [escolaId, tarefa, funcao, entrada, saida],
      )
    }
    return { serieNome: '2º ano do Ensino Médio', turmas: { doB, doC }, professoras, aluno }
  })
}

/**
 * Acrescenta à escola do `montarEscolaComEntregas` uma série de **um professor só**: o 3º ano, com uma turma, uma professora e uma versão
 * adaptada dela esperando decisão. A entrega conta nos números (um artefato original, a versão adaptada e uma entrega pendente) e não
 * entra na lista, porque a linha diria o que ela fez (D45, D64). O nome da professora é o que nunca pode aparecer.
 */
export async function acrescentarSerieDeUmProfessorSo(escolaId: string): Promise<{ readonly serieNome: string; readonly professora: string }> {
  const marca = randomUUID().slice(0, 8)
  const professora = `Professora Sintética Rita ${marca}`
  return comBanco(async (banco) => {
    const { rows: anos } = await banco.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])
    const anoLetivoId = anos[0]?.id
    if (anoLetivoId === undefined) throw new Error('a escola do e2e não tem ano letivo em curso')
    const serieId = await id(banco, "insert into serie (escola_id, etapa, ano) values ($1, 'em', 3) on conflict (escola_id, etapa, ano) do update set ano = excluded.ano returning id", [escolaId])
    const disciplinaId = await id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, `Matemática ${marca}`])
    const turmaId = await id(banco, 'insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoLetivoId, serieId, `3ºA ${marca}`])
    const contaId = await id(banco, 'insert into conta (email) values ($1) returning id', [`professor-${randomUUID()}@educa.invalid`])
    const professoraId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'professor', $3, now()) returning id", [escolaId, contaId, professora])
    await banco.query(
      "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, decidido_em, criado_por) values ($1, $2, $3, $4, $5, 'professor', 'confirmado', now(), $3)",
      [escolaId, anoLetivoId, professoraId, turmaId, disciplinaId],
    )
    const artefato = (titulo: string, origemId: string | null) =>
      id(
        banco,
        `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, origem_id, criado_por)
         values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6::jsonb || $7::jsonb, $8, $9) returning id`,
        [escolaId, anoLetivoId, turmaId, disciplinaId, titulo, conteudoDaLista(titulo), origemId === null ? '{}' : '{"adaptacao": {"tipos": ["fonte_ampliada"]}}', origemId, professoraId],
      )
    const original = await artefato('Funções: lista sintética', null)
    const adaptada = await artefato('Funções: versão adaptada sintética', original)
    await banco.query("insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, artefato_id) values ($1, $2, $3, 'adaptacao', 'versao_adaptada', $4)", [escolaId, anoLetivoId, turmaId, adaptada])
    return { serieNome: '3º ano do Ensino Médio', professora }
  })
}

/**
 * "Outra pessoa da coordenação" suspende a função, por fora da tela da coordenadora do teste (X2, 11.0): uma segunda coordenação,
 * criada na mesma escola, e a suspensão gravada em nome dela. **Só a linha de `suspensao_de_funcao`**: não passa pela API nem grava a
 * auditoria (`funcao.suspensa`), e por isso não serve a teste da auditoria (regra 70, item 6). Devolve quem suspendeu, para o teste conferir
 * que a suspensão vigente continua sendo a dela depois de a coordenadora do teste tentar suspender de novo.
 */
export async function suspenderFuncaoPorOutraPessoa(escolaId: string, funcao: string): Promise<{ readonly usuarioId: string }> {
  return comBanco(async (banco) => {
    const contaId = await id(banco, 'insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@educa.invalid`])
    const usuarioId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'coordenador', $3, now()) returning id", [escolaId, contaId, `Coordenação Sintética ${randomUUID().slice(0, 8)}`])
    await banco.query('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escolaId, funcao, usuarioId])
    return { usuarioId }
  })
}

/** As suspensões da função na escola, da mais antiga para a mais nova, com o que o banco gravou. */
export async function suspensoesNoBanco(escolaId: string, funcao: string): Promise<{ suspensaPor: string; motivo: string | null; retomada: boolean }[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ suspensaPor: string; motivo: string | null; retomada: boolean }>(
      'select suspensa_por as "suspensaPor", motivo, retomada_em is not null as retomada from suspensao_de_funcao where escola_id = $1 and funcao = $2 order by id',
      [escolaId, funcao],
    )
    return rows
  })
}

/** Os registros de auditoria da ação na escola: quem, sobre o quê e com que finalidade. */
export async function auditoriasNoBanco(escolaId: string, acao: string): Promise<{ autor: string; entidadeId: string; finalidade: string | null }[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ autor: string; entidadeId: string; finalidade: string | null }>(
      'select autor_usuario_id as autor, entidade_id as "entidadeId", finalidade from auditoria where escola_id = $1 and acao = $2 order by id',
      [escolaId, acao],
    )
    return rows
  })
}
