import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { executarOpsPrivacidade } from '../src/ops/privacidade.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

/**
 * `ops:privacidade` (F3, tarefa 19.0; RF17, "a operação vê só contagens"): o comando roda de verdade, com o banco de
 * operação que ele mesmo abre, contra o Postgres do compose de teste. Cada escola do teste tem **números diferentes** em
 * cada tabela que o comando conta: sem a cláusula de escopo de uma delas, o número da A passa a ser o da A mais o da B.
 *
 * A montagem da escola e do comando é a de `ops-uso.int.test.ts` (`BancadaDeSessoes`). As sentinelas estão em cada tabela de
 * pessoa e de texto que a escola tem (nome, e-mail, matrícula, o texto do incidente e a empresa), e o teste procura todas
 * na saída e no erro de cada caminho do comando, inclusive o que recusa.
 */

const ambienteBase = lerAmbienteDeTeste()
const OPERADOR = 'operador-privacidade'

interface Execucao {
  readonly codigo: number
  readonly saida: string
  readonly erro: string
}

/** `operador` nulo roda sem a variável `OPERADOR`, que o ambiente de teste pode trazer. */
async function rodar(argumentos: string[], operador: string | null = OPERADOR): Promise<Execucao> {
  let saida = ''
  let erro = ''
  const ambiente = { ...ambienteBase, OPERADOR: operador ?? undefined }
  const codigo = await executarOpsPrivacidade(argumentos, ambiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
  return { codigo, saida, erro }
}

describe('npm run ops:privacidade: só contagens, por escola', () => {
  const bancada = new BancadaDeSessoes()
  const marca = randomUUID().slice(0, 8)
  const sentinelas = {
    aluno: `Aluno Sentinela ${marca}`,
    professor: `Professor Sentinela ${marca}`,
    coordenacao: `Coordenação Sentinela ${marca}`,
    email: `sentinela-${marca}@escola.invalid`,
    matricula: `MAT-SENTINELA-${marca}`,
    circunstancia: `Circunstância Sentinela ${marca}`,
    contencao: `Contenção Sentinela ${marca}`,
    correcao: `Correção Sentinela ${marca}`,
    empresa: `Empresa Sentinela ${marca}`,
    contrato: `DPA-SENT-${marca}`,
  }
  const incidentes: string[] = []
  const suboperadores: string[] = []
  let escolaA = ''
  let escolaB = ''
  let escolaVazia = ''

  const um = async (texto: string, valores: unknown[]): Promise<string> => {
    const { rows } = await bancada.pool.query<{ id: string }>(texto, valores)
    const id = rows[0]?.id
    if (id === undefined) throw new Error('linha de teste não criada')
    return id
  }

  async function pessoa(escolaId: string, papel: 'coordenador' | 'professor' | 'aluno', nome: string, comConta = false): Promise<string> {
    const contaId = comConta ? await um('insert into conta (email) values ($1) returning id', [`${papel}-${randomUUID()}@privacidade.invalid`]) : null
    return um('insert into usuario (escola_id, papel, nome, conta_id) values ($1, $2, $3, $4) returning id', [escolaId, papel, nome, contaId])
  }

  /** Um pedido do titular no estado dado. `eliminarEm` só vale em `agendado`. */
  async function pedido(escolaId: string, titularId: string, registradoPor: string, tipo: string, estado: string, eliminarEm?: string): Promise<string> {
    return um(
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, eliminar_em, compartilhamento, registrado_por, chave_envio)
       values ($1, $2, 'aluno', $3, 'titular', current_date, $4, ${eliminarEm ?? 'null'}, '[]'::jsonb, $5, $6) returning id`,
      [escolaId, titularId, tipo, estado, registradoPor, randomUUID()],
    )
  }

  /** O arquivo do pedido: pronto há 10 dias, e a validade em `expiraEm` (uma expressão de SQL). */
  async function arquivo(escolaId: string, pedidoId: string, versao: 'completa' | 'coordenacao', expiraEm: string, apagado = false): Promise<void> {
    await bancada.pool.query(
      `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em, apagado_em)
       values ($1, $2, $3, $4, 100, now() - interval '10 days', ${expiraEm}, ${apagado ? "now() - interval '1 day'" : 'null'})`,
      [escolaId, pedidoId, versao, `titular/${escolaId}/${pedidoId}/${versao}.json`],
    )
  }

  /** Uma execução do expurgo da categoria, `horas` atrás. */
  async function expurgo(escolaId: string, categoria: string, concluida: boolean, horas: number): Promise<void> {
    await bancada.pool.query(`insert into expurgo_execucao (escola_id, categoria, linhas, concluida, em) values ($1, $2, 7, $3, now() - make_interval(hours => $4))`, [escolaId, categoria, concluida, horas])
  }

  async function incidente(secoes: Array<{ escolaId: string; confirmadaPor?: string }>): Promise<void> {
    const id = await um(`insert into incidente (conhecido_em, registrado_por) values (now() - interval '3 hours', 'equipe-de-teste') returning id`, [])
    incidentes.push(id)
    for (const { escolaId, confirmadaPor } of secoes) {
      await bancada.pool.query(
        `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao, confirmado_em, confirmado_por)
         values ($1, $2, $3, array['cadastro'], 10, 'baixo', $4, $5, ${confirmadaPor === undefined ? 'null' : 'now()'}, $6)`,
        [id, escolaId, sentinelas.circunstancia, sentinelas.contencao, sentinelas.correcao, confirmadaPor ?? null],
      )
    }
  }

  async function empresa(alcance: 'todas' | 'lista', opcoes: { fim?: boolean; escolas?: Array<{ escolaId: string; encerrada?: boolean }> } = {}): Promise<void> {
    const id = await um(
      `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, inicio, fim, registrado_por)
       values ($1, $2, 'Hospedagem', array['cadastro'], 'BR', $3, true, $4, now() - interval '5 days', ${opcoes.fim === true ? "now() - interval '1 day'" : 'null'}, 'equipe-de-teste') returning id`,
      [`priv-${randomUUID().slice(0, 12)}`, sentinelas.empresa, sentinelas.contrato, alcance],
    )
    suboperadores.push(id)
    for (const { escolaId, encerrada } of opcoes.escolas ?? []) {
      await bancada.pool.query(
        `insert into suboperador_escola (escola_id, suboperador_id, inicio, fim) values ($1, $2, now() - interval '4 days', ${encerrada === true ? "now() - interval '1 day'" : 'null'})`,
        [escolaId, id],
      )
    }
  }

  const lerSaida = (execucao: Execucao): Record<string, unknown> => JSON.parse(execucao.saida) as Record<string, unknown>

  beforeAll(async () => {
    ;[escolaA, escolaB, escolaVazia] = await Promise.all([bancada.escola(), bancada.escola(), bancada.escola()])
  })

  afterAll(async () => {
    await bancada.pool.query('delete from incidente where id = any($1::uuid[])', [incidentes])
    await bancada.pool.query('delete from suboperador_escola where suboperador_id = any($1::uuid[])', [suboperadores])
    await bancada.pool.query('delete from suboperador where id = any($1::uuid[])', [suboperadores])
    await bancada.fechar()
  })

  it('conta, em cada tabela, só o da escola do pedido, com números diferentes nas duas, e nenhuma sentinela sai', async () => {
    // O que `suboperador` global já tinha: a diferença é o que o teste põe.
    const antesA = lerSaida(await rodar(['--escola', escolaA]))
    const antesB = lerSaida(await rodar(['--escola', escolaB]))

    const coordenacaoA = await pessoa(escolaA, 'coordenador', sentinelas.coordenacao, true)
    const professorA = await pessoa(escolaA, 'professor', sentinelas.professor, true)
    const alunos = await Promise.all([1, 2, 3, 4, 5].map((n) => pessoa(escolaA, 'aluno', `${sentinelas.aluno} ${n}`)))
    await bancada.pool.query(`insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, 'hash-sintetico')`, [escolaA, alunos[0], sentinelas.matricula])
    const [a1, a2, a3, a4, a5] = alunos as [string, string, string, string, string]

    // A: 2 recebidos, 1 em preparação, 1 pronto, 2 agendados (1 vencido e 1 por vir), 3 concluídos, 1 cancelado.
    await pedido(escolaA, a1, coordenacaoA, 'acesso', 'recebido')
    await pedido(escolaA, a1, coordenacaoA, 'portabilidade', 'recebido')
    await pedido(escolaA, a1, coordenacaoA, 'acesso', 'em_preparacao')
    const prontoA = await pedido(escolaA, a1, coordenacaoA, 'acesso', 'pronto')
    await pedido(escolaA, a2, coordenacaoA, 'eliminacao', 'agendado', "now() - interval '2 hours'")
    await pedido(escolaA, a3, coordenacaoA, 'eliminacao', 'agendado', "now() + interval '3 days'")
    const concluidoA = await pedido(escolaA, a4, coordenacaoA, 'acesso', 'concluido')
    // Uma eliminação já concluída guarda o `eliminar_em` que passou: só o estado `agendado` conta como vencida.
    const eliminadoA = await pedido(escolaA, a4, coordenacaoA, 'eliminacao', 'concluido', "now() - interval '9 days'")
    await pedido(escolaA, professorA, coordenacaoA, 'compartilhamento', 'concluido')
    await pedido(escolaA, a5, coordenacaoA, 'acesso', 'cancelado')
    // Os arquivos de A: 2 que ainda baixam (uma versão de cada), 1 vencido que a rotina ainda não apagou, e 2 já apagados
    // (um vencido e um antes da validade).
    await arquivo(escolaA, prontoA, 'completa', "now() + interval '2 days'")
    await arquivo(escolaA, prontoA, 'coordenacao', "now() + interval '1 day'")
    await arquivo(escolaA, concluidoA, 'completa', "now() - interval '3 days'")
    await arquivo(escolaA, concluidoA, 'coordenacao', "now() - interval '2 days'", true)
    // Apagado antes da validade (o pedido foi concluído): a validade que ainda não chegou não o faz "ativo".
    await arquivo(escolaA, eliminadoA, 'completa', "now() + interval '5 days'", true)

    // B: números maiores em tudo, para a cláusula de escopo de cada contagem fazer diferença.
    const coordenacaoB = await pessoa(escolaB, 'coordenador', `${sentinelas.coordenacao} B`, true)
    const titularesB = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => pessoa(escolaB, 'aluno', `${sentinelas.aluno} B${n}`)))
    for (const titular of titularesB.slice(0, 4)) await pedido(escolaB, titular, coordenacaoB, 'acesso', 'recebido')
    for (const titular of titularesB.slice(0, 3)) await pedido(escolaB, titular, coordenacaoB, 'eliminacao', 'agendado', "now() - interval '5 hours'")
    const prontoB = await pedido(escolaB, titularesB[5] as string, coordenacaoB, 'acesso', 'pronto')
    await pedido(escolaB, titularesB[5] as string, coordenacaoB, 'acesso', 'concluido')
    await arquivo(escolaB, prontoB, 'completa', "now() + interval '2 days'")
    await arquivo(escolaB, prontoB, 'coordenacao', "now() + interval '2 days'")
    const concluidoB = await pedido(escolaB, titularesB[4] as string, coordenacaoB, 'acesso', 'concluido')
    await arquivo(escolaB, concluidoB, 'completa', "now() - interval '3 days'")
    await arquivo(escolaB, concluidoB, 'coordenacao', "now() - interval '4 days'")

    // Incidentes: A tem 2 avisados e 1 sem confirmação; B, 3 avisados, todos sem confirmação.
    await incidente([{ escolaId: escolaA }, { escolaId: escolaB }])
    await incidente([{ escolaId: escolaA, confirmadaPor: coordenacaoA }, { escolaId: escolaB }])
    await incidente([{ escolaId: escolaB }])

    // Suboperadores: o `todas` vigente vale para as duas; o da lista com a A vigente só para a A; o da lista só com a B,
    // o encerrado e o de ligação encerrada não valem para a A.
    await empresa('todas')
    await empresa('lista', { escolas: [{ escolaId: escolaA }] })
    await empresa('lista', { escolas: [{ escolaId: escolaB }] })
    await empresa('lista', { fim: true, escolas: [{ escolaId: escolaA }] })
    await empresa('lista', { escolas: [{ escolaId: escolaA, encerrada: true }] })

    // Expurgo: A tem 3 categorias; a última execução de `conversa_tutor` parou (a mais antiga terminou), e as outras terminaram.
    await expurgo(escolaA, 'conversa_tutor', true, 30)
    await expurgo(escolaA, 'conversa_tutor', false, 6)
    await expurgo(escolaA, 'sinal_tutor', true, 5)
    await expurgo(escolaA, 'execucao_agente', true, 7)
    await expurgo(escolaB, 'conversa_tutor', true, 1)

    const saidaA = await rodar(['--escola', escolaA])
    const saidaB = await rodar(['--escola', escolaB])
    expect(saidaA).toMatchObject({ codigo: 0, erro: '' })
    const a = lerSaida(saidaA)
    const b = lerSaida(saidaB)
    const vigentesAntes = (antes: Record<string, unknown>) => antes['suboperadoresVigentes'] as number

    expect(a).toEqual({
      escolaId: escolaA,
      pedidos: { recebido: 2, em_preparacao: 1, pronto: 1, agendado: 2, concluido: 3, cancelado: 1 },
      eliminacoes: { agendadas: 2, vencidas: 1 },
      arquivos: { ativos: 2, vencidos: 1 },
      suboperadoresVigentes: vigentesAntes(antesA) + 2,
      incidentes: { avisados: 2, semConfirmacao: 1 },
      expurgo: { categoriasConcluidas: 2, categoriasPendentes: 1, ultimaExecucaoEm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    })
    expect(b).toEqual({
      escolaId: escolaB,
      pedidos: { recebido: 4, em_preparacao: 0, pronto: 1, agendado: 3, concluido: 2, cancelado: 0 },
      eliminacoes: { agendadas: 3, vencidas: 3 },
      arquivos: { ativos: 2, vencidos: 2 },
      suboperadoresVigentes: vigentesAntes(antesB) + 2,
      incidentes: { avisados: 3, semConfirmacao: 3 },
      expurgo: { categoriasConcluidas: 1, categoriasPendentes: 0, ultimaExecucaoEm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    })

    // A última execução da A é a mais recente das suas (5 h atrás, a de `sinal_tutor`), e não a da B (1 h).
    const ultimaDaA = Date.parse((a['expurgo'] as { ultimaExecucaoEm: string }).ultimaExecucaoEm)
    expect(Math.abs(Date.now() - ultimaDaA - 5 * 3_600_000)).toBeLessThan(10 * 60_000)

    // Nenhuma sentinela, e nenhum id além do da escola pedida, na saída nem no erro.
    for (const execucao of [saidaA, saidaB]) {
      for (const [chave, valor] of Object.entries(sentinelas)) expect(execucao.saida, chave).not.toContain(valor)
      expect(execucao.saida).not.toContain('titular/')
      expect(execucao.saida).not.toMatch(/-sentinela-|Sentinela/i)
    }
    expect(saidaA.saida).not.toContain(escolaB)
    expect(saidaB.saida).not.toContain(escolaA)
  })

  it('a escola sem nada tem zero em tudo, com a data nula', async () => {
    // A escola existe há dez dias. A vigência de um `todas` nunca é anterior à escola: sem isto, o encerrado de ontem nem
    // chegaria ao comando, e a linha dele abaixo não provaria nada.
    await bancada.pool.query(`update escola set criada_em = now() - interval '10 days' where id = $1`, [escolaVazia])
    const antes = lerSaida(await rodar(['--escola', escolaVazia]))
    // Só o `todas` vigente passa a valer para ela: o `todas` encerrado ontem é passado, e o da lista é de outra escola.
    await empresa('todas')
    await empresa('todas', { fim: true })
    await empresa('lista', { escolas: [{ escolaId: escolaA }] })
    const execucao = await rodar(['--escola', escolaVazia])
    expect(execucao.codigo).toBe(0)
    const saida = lerSaida(execucao)
    expect(saida).toEqual({
      escolaId: escolaVazia,
      pedidos: { recebido: 0, em_preparacao: 0, pronto: 0, agendado: 0, concluido: 0, cancelado: 0 },
      eliminacoes: { agendadas: 0, vencidas: 0 },
      arquivos: { ativos: 0, vencidos: 0 },
      suboperadoresVigentes: (antes['suboperadoresVigentes'] as number) + 1,
      incidentes: { avisados: 0, semConfirmacao: 0 },
      expurgo: { categoriasConcluidas: 0, categoriasPendentes: 0, ultimaExecucaoEm: null },
    })
  })

  describe('os caminhos que recusam não trazem o valor recebido nem pessoa', () => {
    it('escola que não existe: NAO_ENCONTRADO fixo, sem o id', async () => {
      const inexistente = randomUUID()
      const execucao = await rodar(['--escola', inexistente])
      expect(execucao).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: escola não encontrada\n' })
      expect(execucao.erro).not.toContain(inexistente)
    })

    it.each([
      ['sem a opção', [] as string[]],
      ['id que não é uuid, com o texto de uma sentinela', ['--escola', sentinelas.aluno]],
      ['opção desconhecida', ['--escola', randomUUID(), '--nome', sentinelas.aluno]],
      ['argumento solto', [sentinelas.professor]],
    ])('argumento inválido (%s): código 2, só o nome da opção', async (_caso, argumentos) => {
      const execucao = await rodar(argumentos)
      expect(execucao).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --escola\n' })
      for (const valor of Object.values(sentinelas)) expect(execucao.erro).not.toContain(valor)
    })

    it('OPERADOR ausente ou fora do formato: código 2, sem repetir o valor', async () => {
      const ausente = await rodar(['--escola', escolaA], null)
      expect(ausente.codigo).toBe(2)
      expect(ausente.saida).toBe('')
      const malformado = await rodar(['--escola', escolaA], `Sentinela ${marca}`)
      expect(malformado.codigo).toBe(2)
      expect(malformado.saida).toBe('')
      expect(malformado.erro).not.toContain(marca)
    })
  })
})
