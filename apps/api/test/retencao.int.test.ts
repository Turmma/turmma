import { CATEGORIAS_DE_RETENCAO, CHAVES_DE_PRAZO_FIXO, CHAVES_DE_RETENCAO, ErrorCode, retencaoResponseSchema, FINALIDADE_DO_AJUSTE_DE_RETENCAO, type CategoriaDeRetencao, type RetencaoResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { AppModule } from '../src/app.module.js'
import { executarOpsRetencao } from '../src/ops/retencao.js'
import { ChallengeIssuer } from '../src/credencial/index.js'
import { chamar, subirApi, type ApiDeTeste } from './test-api.js'
import { configuracaoDeTeste } from './test-config.js'
import { esperarNaTrava, GatilhoDeParada } from './write-block-trigger.js'
import { controladoresDoModulo, rotasDe } from './registered-routes.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'

/**
 * A retenção da escola (F3, tarefa 2.0; `tasks/prd-lgpd-e-titular/cenarios.md`, RF1, RF2 e Permissão): a operação
 * ajusta pelo `ops:retencao`, que roda de verdade com o banco de operação que ele mesmo abre, e a coordenação lê pelo
 * `GET /v1/privacidade/retencao`, na API do teste. Postgres e Redis reais.
 */

const OPERADOR = 'operador-teste'
const ambienteDeTeste = lerAmbienteDeTeste()
const CHAVE = new TextEncoder().encode(ambienteDeTeste['IDENTIDADE_CHAVE_ASSINATURA'])

interface Execucao {
  readonly codigo: number
  readonly saida: string
  readonly erro: string
}

interface AuditoriaDoAjuste {
  entidade: string
  entidade_id: string
  autor_operador: string | null
  autor_usuario_id: string | null
  antes: unknown
  depois: unknown
  finalidade: string | null
}

describe('retenção da escola: a operação ajusta por comando, e a coordenação lê (F3, tarefa 2.0)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const ambiente = { ...ambienteDeTeste, OPERADOR }
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function rodar(argumentos: string[], doAmbiente: Record<string, string | undefined> = ambiente): Promise<Execucao> {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsRetencao(argumentos, doAmbiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
    return { codigo, saida, erro }
  }

  const ajustar = (escolaId: string, categoria: string, meses: number, contrato = 14) =>
    rodar(['ajustar', '--escola', escolaId, '--categoria', categoria, '--meses', String(meses), '--contrato', String(contrato)])

  async function retencaoDe(coordenacao: SessaoDeTeste): Promise<RetencaoResponse> {
    const resposta = await chamar(api.url, 'GET', '/v1/privacidade/retencao', await coordenacao.tokenNovo())
    expect(resposta.status).toBe(200)
    return retencaoResponseSchema.parse(resposta.corpo)
  }

  async function categoriaDe(coordenacao: SessaoDeTeste, categoria: CategoriaDeRetencao) {
    const achada = (await retencaoDe(coordenacao)).categorias.find((candidata) => candidata.categoria === categoria)
    if (achada === undefined) throw new Error('categoria fora da resposta')
    return achada
  }

  async function ajustesNoBanco(escolaId: string): Promise<Array<{ categoria: string; meses: number; referencia_contrato: number; alterada_por: string }>> {
    const { rows } = await bancada.pool.query<{ categoria: string; meses: number; referencia_contrato: number; alterada_por: string }>(
      'select categoria, meses, referencia_contrato, alterada_por from retencao_escola where escola_id = $1 order by categoria',
      [escolaId],
    )
    return rows
  }

  async function auditoriasDoAjuste(escolaId: string): Promise<AuditoriaDoAjuste[]> {
    const { rows } = await bancada.pool.query<AuditoriaDoAjuste>(
      `select entidade, entidade_id, autor_operador, autor_usuario_id, antes, depois, finalidade from auditoria where escola_id = $1 and acao = 'retencao.ajustada' order by id`,
      [escolaId],
    )
    return rows
  }

  /** Uma escola nova com a coordenação dela. */
  async function escolaComCoordenacao(): Promise<SessaoDeTeste> {
    return bancada.escolaComSessao('coordenador')
  }

  it('RF1: a escola recém-criada lê todas as categorias com origem "padrão", com o prazo do catálogo, e os prazos fixos', async () => {
    const coordenacao = await escolaComCoordenacao()
    const lida = await retencaoDe(coordenacao)
    expect(lida.categorias).toEqual(
      CHAVES_DE_RETENCAO.map((categoria) => ({
        categoria,
        descricao: CATEGORIAS_DE_RETENCAO[categoria].descricao,
        contaDe: CATEGORIAS_DE_RETENCAO[categoria].contaDe,
        meses: CATEGORIAS_DE_RETENCAO[categoria].padrao,
        origem: 'padrao',
        limitadaPor: null,
      })),
    )
    expect(lida.prazosFixos.map((prazo) => prazo.chave)).toEqual([...CHAVES_DE_PRAZO_FIXO])
    expect(await ajustesNoBanco(coordenacao.escolaId)).toEqual([])
    const direta = await fetch(`${api.url}/v1/privacidade/retencao`, { headers: { Authorization: `Bearer ${await coordenacao.tokenNovo()}` } })
    expect(direta.headers.get('cache-control')).toBe('no-store')
  })

  it('RF2: o piso exato é aceito e o GET mostra a origem ajustada; piso − 1 e acima do teto dão RETENCAO_FORA_DO_LIMITE sem gravar nada', async () => {
    const coordenacao = await escolaComCoordenacao()
    const { piso, teto } = CATEGORIAS_DE_RETENCAO.sinal_tutor

    for (const meses of [piso - 1, teto + 1]) {
      const recusada = await ajustar(coordenacao.escolaId, 'sinal_tutor', meses)
      expect({ codigo: recusada.codigo, saida: recusada.saida }, String(meses)).toEqual({ codigo: 1, saida: '' })
      expect(recusada.erro).toMatch(new RegExp(`^${ErrorCode.RETENCAO_FORA_DO_LIMITE}:`))
    }
    expect(await ajustesNoBanco(coordenacao.escolaId)).toEqual([])
    expect(await auditoriasDoAjuste(coordenacao.escolaId)).toEqual([])
    expect(await categoriaDe(coordenacao, 'sinal_tutor')).toMatchObject({ meses: CATEGORIAS_DE_RETENCAO.sinal_tutor.padrao, origem: 'padrao' })

    const aceita = await ajustar(coordenacao.escolaId, 'sinal_tutor', piso)
    expect(aceita.codigo).toBe(0)
    expect(JSON.parse(aceita.saida)).toEqual({ categoria: 'sinal_tutor', meses: piso, origem: 'ajustada', limitadaPor: null })
    expect(await categoriaDe(coordenacao, 'sinal_tutor')).toMatchObject({ meses: piso, origem: 'ajustada', limitadaPor: null })

    const noTeto = await ajustar(coordenacao.escolaId, 'sinal_tutor', teto)
    expect(noTeto.codigo).toBe(0)
    expect(await categoriaDe(coordenacao, 'sinal_tutor')).toMatchObject({ meses: teto, origem: 'ajustada' })
  })

  it('RF2: as categorias fixas (registro de acesso, auditoria) são recusadas com RETENCAO_FORA_DO_LIMITE, e nada é gravado', async () => {
    const coordenacao = await escolaComCoordenacao()
    for (const fixa of ['registro_acesso', 'registro_de_decisao']) {
      const recusada = await ajustar(coordenacao.escolaId, fixa, 12)
      expect(recusada.codigo, fixa).toBe(1)
      expect(recusada.erro, fixa).toMatch(new RegExp(`^${ErrorCode.RETENCAO_FORA_DO_LIMITE}:`))
    }
    expect(await ajustesNoBanco(coordenacao.escolaId)).toEqual([])
    expect(await auditoriasDoAjuste(coordenacao.escolaId)).toEqual([])
  })

  it('RF2, travas: texto_do_modelo acima da conversa do professor ajustada, e consumo_por_aluno acima da conversa do Tutor, são recusados; com a mãe acima, aceitos', async () => {
    const coordenacao = await escolaComCoordenacao()
    const { escolaId } = coordenacao

    // A conversa do professor ajustada para 6: o texto do modelo em 7 passa do piso e do teto dele, e da trava não.
    expect((await ajustar(escolaId, 'conversa_professor', 6)).codigo).toBe(0)
    const textoAcima = await ajustar(escolaId, 'texto_do_modelo', 7)
    expect(textoAcima.codigo).toBe(1)
    expect(textoAcima.erro).toMatch(new RegExp(`^${ErrorCode.RETENCAO_FORA_DO_LIMITE}:`))
    expect((await ajustar(escolaId, 'texto_do_modelo', 6)).codigo).toBe(0)

    // A conversa do Tutor no padrão (12): o consumo por aluno em 13 é recusado; com a conversa do Tutor em 24, aceito.
    const consumoAcima = await ajustar(escolaId, 'consumo_por_aluno', 13)
    expect(consumoAcima.codigo).toBe(1)
    expect(consumoAcima.erro).toMatch(new RegExp(`^${ErrorCode.RETENCAO_FORA_DO_LIMITE}:`))
    expect((await ajustar(escolaId, 'conversa_tutor', 24)).codigo).toBe(0)
    expect((await ajustar(escolaId, 'consumo_por_aluno', 13)).codigo).toBe(0)

    expect((await ajustesNoBanco(escolaId)).map(({ categoria, meses }) => ({ categoria, meses }))).toEqual([
      { categoria: 'consumo_por_aluno', meses: 13 },
      { categoria: 'conversa_professor', meses: 6 },
      { categoria: 'conversa_tutor', meses: 24 },
      { categoria: 'texto_do_modelo', meses: 6 },
    ])
  })

  it('RF2, travas: baixar a categoria-mãe é aceito, e o prazo efetivo das travadas acompanha, com a trava dita na leitura', async () => {
    const coordenacao = await escolaComCoordenacao()
    const { escolaId } = coordenacao
    expect((await ajustar(escolaId, 'execucao_agente', 12)).codigo).toBe(0)

    const mae = await ajustar(escolaId, 'conversa_professor', 3)
    expect(mae.codigo).toBe(0)
    expect(await categoriaDe(coordenacao, 'conversa_professor')).toMatchObject({ meses: 3, origem: 'ajustada', limitadaPor: null })
    // A execução ajustada em 12 vale 3, e o texto do modelo, sem ajuste, também.
    expect(await categoriaDe(coordenacao, 'execucao_agente')).toMatchObject({ meses: 3, origem: 'ajustada', limitadaPor: 'conversa_professor' })
    expect(await categoriaDe(coordenacao, 'texto_do_modelo')).toMatchObject({ meses: 3, origem: 'padrao', limitadaPor: 'conversa_professor' })
    // O consumo por aluno é travado pela conversa do Tutor, que não mudou.
    expect(await categoriaDe(coordenacao, 'consumo_por_aluno')).toMatchObject({ meses: 12, origem: 'padrao', limitadaPor: null })
  })

  it('RF2, auditoria: retencao.ajustada com o operador, a escola, o prazo anterior e o número do contrato; o segundo ajuste leva o primeiro como anterior', async () => {
    const coordenacao = await escolaComCoordenacao()
    const { escolaId } = coordenacao
    expect((await ajustar(escolaId, 'conversa_tutor', 18, 2026)).codigo).toBe(0)
    expect((await ajustar(escolaId, 'conversa_tutor', 6, 2027)).codigo).toBe(0)

    expect(await auditoriasDoAjuste(escolaId)).toEqual([
      {
        entidade: 'retencao_escola',
        entidade_id: escolaId,
        autor_operador: OPERADOR,
        autor_usuario_id: null,
        antes: { meses: 12, origem: 'padrao' },
        depois: { categoria: 'conversa_tutor', meses: 18, referenciaContrato: 2026 },
        finalidade: FINALIDADE_DO_AJUSTE_DE_RETENCAO,
      },
      {
        entidade: 'retencao_escola',
        entidade_id: escolaId,
        autor_operador: OPERADOR,
        autor_usuario_id: null,
        antes: { meses: 18, origem: 'ajustada' },
        depois: { categoria: 'conversa_tutor', meses: 6, referenciaContrato: 2027 },
        finalidade: FINALIDADE_DO_AJUSTE_DE_RETENCAO,
      },
    ])
    expect(await ajustesNoBanco(escolaId)).toEqual([{ categoria: 'conversa_tutor', meses: 6, referencia_contrato: 2027, alterada_por: OPERADOR }])
    expect(await categoriaDe(coordenacao, 'conversa_tutor')).toMatchObject({ meses: 6, origem: 'ajustada' })
  })

  it('isolamento: o ajuste em A não muda o GET de B, e o de B, noutra categoria, não aparece no de A', async () => {
    const a = await escolaComCoordenacao()
    const b = await escolaComCoordenacao()
    expect((await ajustar(a.escolaId, 'conversa_tutor', 6)).codigo).toBe(0)
    expect((await ajustar(b.escolaId, 'sinal_tutor', 24)).codigo).toBe(0)

    const deA = await retencaoDe(a)
    const deB = await retencaoDe(b)
    expect(deA.categorias.filter((categoria) => categoria.origem === 'ajustada').map(({ categoria, meses }) => ({ categoria, meses }))).toEqual([{ categoria: 'conversa_tutor', meses: 6 }])
    expect(deB.categorias.filter((categoria) => categoria.origem === 'ajustada').map(({ categoria, meses }) => ({ categoria, meses }))).toEqual([{ categoria: 'sinal_tutor', meses: 24 }])
    expect((await auditoriasDoAjuste(a.escolaId)).map(({ depois }) => depois)).toEqual([{ categoria: 'conversa_tutor', meses: 6, referenciaContrato: 14 }])
    expect((await auditoriasDoAjuste(b.escolaId)).map(({ depois }) => depois)).toEqual([{ categoria: 'sinal_tutor', meses: 24, referenciaContrato: 14 }])
  })

  it('escola inexistente: ajustar e listar dão NAO_ENCONTRADO, sem gravar nada; listar a escola existente imprime o prazo efetivo de cada categoria', async () => {
    const inexistente = randomUUID()
    const ajuste = await ajustar(inexistente, 'conversa_tutor', 6)
    expect({ codigo: ajuste.codigo, saida: ajuste.saida }).toEqual({ codigo: 1, saida: '' })
    expect(ajuste.erro).toMatch(new RegExp(`^${ErrorCode.NAO_ENCONTRADO}:`))
    const lista = await rodar(['listar', '--escola', inexistente])
    expect(lista.codigo).toBe(1)
    expect(lista.erro).toMatch(new RegExp(`^${ErrorCode.NAO_ENCONTRADO}:`))
    expect((await bancada.pool.query('select 1 from retencao_escola where escola_id = $1', [inexistente])).rowCount).toBe(0)

    const coordenacao = await escolaComCoordenacao()
    expect((await ajustar(coordenacao.escolaId, 'conversa_professor', 4)).codigo).toBe(0)
    const listada = await rodar(['listar', '--escola', coordenacao.escolaId])
    expect(listada.codigo).toBe(0)
    const { categorias } = JSON.parse(listada.saida) as { categorias: Array<{ categoria: string; meses: number; origem: string; limitadaPor: string | null }> }
    expect(categorias.find((categoria) => categoria.categoria === 'conversa_professor')).toEqual({ categoria: 'conversa_professor', meses: 4, origem: 'ajustada', limitadaPor: null })
    expect(categorias.find((categoria) => categoria.categoria === 'execucao_agente')).toEqual({ categoria: 'execucao_agente', meses: 4, origem: 'padrao', limitadaPor: 'conversa_professor' })
  })

  it('sem OPERADOR, ou com argumento fora do formato, recusa antes de tocar no banco, citando só a opção', async () => {
    const coordenacao = await escolaComCoordenacao()
    const semOperador = await rodar(['ajustar', '--escola', coordenacao.escolaId, '--categoria', 'conversa_tutor', '--meses', '6', '--contrato', '1'], { ...ambiente, OPERADOR: undefined })
    expect(semOperador.codigo).toBe(2)
    expect(semOperador.erro).toContain('OPERADOR')
    for (const [argumentos, opcao] of [
      [['ajustar', '--escola', coordenacao.escolaId, '--categoria', 'apagar_tudo', '--meses', '6', '--contrato', '1'], '--categoria'],
      [['ajustar', '--escola', coordenacao.escolaId, '--categoria', 'conversa_tutor', '--meses', 'seis', '--contrato', '1'], '--meses'],
      [['ajustar', '--escola', coordenacao.escolaId, '--categoria', 'conversa_tutor', '--meses', '6', '--contrato', 'contrato da Maria'], '--contrato'],
      [['ajustar', '--escola', coordenacao.escolaId, '--categoria', 'conversa_tutor', '--meses', '6', '--contrato', '0'], '--contrato'],
      [['ajustar', '--escola', 'escola-a', '--categoria', 'conversa_tutor', '--meses', '6', '--contrato', '1'], '--escola'],
      [['listar', '--escola', coordenacao.escolaId, '--meses', '6'], '--categoria, --meses e --contrato não valem para listar'],
      [['apagar', '--escola', coordenacao.escolaId], 'comando (ajustar | listar)'],
    ] as const) {
      const execucao = await rodar([...argumentos])
      expect(execucao.codigo, opcao).toBe(2)
      expect(execucao.erro, opcao).toBe(`Opção inválida ou ausente: ${opcao}\n`)
    }
    expect(await ajustesNoBanco(coordenacao.escolaId)).toEqual([])
  })

  it('concorrência: dois ajustes da mesma escola passam um de cada vez, e o segundo audita o primeiro como anterior', async () => {
    const coordenacao = await escolaComCoordenacao()
    const { escolaId } = coordenacao
    const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'retencao_escola', evento: 'insert', quando: `new.escola_id = '${escolaId}'` })
    await gatilho.armar()
    try {
      const primeiro = ajustar(escolaId, 'conversa_tutor', 18)
      await gatilho.esperarParadas()
      // O primeiro já gravou e segura a escola: o segundo espera na trava dela, antes de ler os ajustes.
      const segundo = ajustar(escolaId, 'conversa_tutor', 20)
      await esperarNaTrava(bancada.pool, '%for no key update%')
      await gatilho.soltar()
      expect((await primeiro).codigo).toBe(0)
      expect((await segundo).codigo).toBe(0)
    } finally {
      await gatilho.desarmar()
    }
    const auditorias = await auditoriasDoAjuste(escolaId)
    expect(auditorias.map(({ antes, depois }) => ({ antes, depois }))).toEqual([
      { antes: { meses: 12, origem: 'padrao' }, depois: { categoria: 'conversa_tutor', meses: 18, referenciaContrato: 14 } },
      { antes: { meses: 18, origem: 'ajustada' }, depois: { categoria: 'conversa_tutor', meses: 20, referenciaContrato: 14 } },
    ])
    expect((await ajustesNoBanco(escolaId)).map(({ meses }) => meses)).toEqual([20])
  })

  it('concorrência: baixar a mãe e subir a travada ao mesmo tempo passam um de cada vez, e a travada lê a mãe já baixada e é recusada', async () => {
    const coordenacao = await escolaComCoordenacao()
    const { escolaId } = coordenacao
    const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'retencao_escola', evento: 'insert', quando: `new.escola_id = '${escolaId}' and new.categoria = 'conversa_professor'` })
    await gatilho.armar()
    let travada: Execucao | undefined
    try {
      const mae = ajustar(escolaId, 'conversa_professor', 3)
      await gatilho.esperarParadas()
      // A mãe já gravou 3 e segura a escola: a travada espera na trava dela. Sem a trava, a travada não espera: lê a mãe
      // no padrão (12), aceita 12 e termina antes, e a corrida acaba por ela; a prova é o efeito, nas asserções abaixo.
      const segunda = ajustar(escolaId, 'texto_do_modelo', 12)
      const naTrava = esperarNaTrava(bancada.pool, '%for no key update%')
      // Sem a trava, ninguém chega a esperar nela, e esta espera estoura o prazo depois de a corrida já ter acabado pela
      // travada: a rejeição é esperada nesse caminho, e o `catch` só a impede de virar erro solto do processo.
      naTrava.catch(() => undefined)
      await Promise.race([naTrava, segunda])
      await gatilho.soltar()
      expect((await mae).codigo).toBe(0)
      travada = await segunda
    } finally {
      await gatilho.desarmar()
    }
    expect({ codigo: travada.codigo, saida: travada.saida }).toEqual({ codigo: 1, saida: '' })
    expect(travada.erro).toMatch(new RegExp(`^${ErrorCode.RETENCAO_FORA_DO_LIMITE}:`))
    expect(await ajustesNoBanco(escolaId)).toEqual([{ categoria: 'conversa_professor', meses: 3, referencia_contrato: 14, alterada_por: OPERADOR }])
    expect((await auditoriasDoAjuste(escolaId)).map(({ depois }) => depois)).toEqual([{ categoria: 'conversa_professor', meses: 3, referenciaContrato: 14 }])
  })

  it('banco: recusa, por fora do comando, a categoria fixa, os meses fora de 1 a 60, o contrato zero, o operador fora do formato e a escola inexistente', async () => {
    const escolaId = await bancada.escola()
    const valida = { categoria: 'conversa_tutor', meses: 12, referencia: 1, operador: OPERADOR }
    const inserir = (linha: typeof valida) =>
      bancada.pool.query('insert into retencao_escola (escola_id, categoria, meses, referencia_contrato, alterada_por) values ($1, $2, $3, $4, $5)', [
        escolaId,
        linha.categoria,
        linha.meses,
        linha.referencia,
        linha.operador,
      ])
    for (const [restricao, linha] of [
      ['retencao_escola_categoria_valida', { ...valida, categoria: 'registro_acesso' }],
      ['retencao_escola_meses_validos', { ...valida, meses: 0 }],
      ['retencao_escola_meses_validos', { ...valida, meses: 61 }],
      ['retencao_escola_referencia_positiva', { ...valida, referencia: 0 }],
      ['retencao_escola_alterada_por_formato', { ...valida, operador: 'Operador Teste' }],
    ] as const) {
      await expect(inserir(linha), restricao).rejects.toMatchObject({ code: '23514', constraint: restricao })
    }
    await expect(
      bancada.pool.query('insert into retencao_escola (escola_id, categoria, meses, referencia_contrato, alterada_por) values ($1, $2, $3, $4, $5)', [randomUUID(), 'conversa_tutor', 12, 1, OPERADOR]),
      'escola inexistente',
    ).rejects.toMatchObject({ code: '23503', constraint: 'retencao_escola_escola_id_escola_id_fk' })
    await inserir({ ...valida, meses: 60 })
    await inserir({ ...valida, categoria: 'sinal_tutor', meses: 1 })
    expect((await bancada.pool.query('select 1 from retencao_escola where escola_id = $1', [escolaId])).rowCount).toBe(2)
  })

  it('banco: o check de categoria da retencao_escola tem exatamente as categorias do catálogo', async () => {
    const { rows } = await bancada.pool.query<{ definicao: string }>(
      `select pg_get_constraintdef(oid) as definicao from pg_constraint where conname = 'retencao_escola_categoria_valida'`,
    )
    expect(rows).toHaveLength(1)
    const literais = [...(rows[0]?.definicao ?? '').matchAll(/'(\w+)'/g)].map((literal) => literal[1])
    expect(literais.toSorted()).toEqual([...CHAVES_DE_RETENCAO].toSorted())
  })

  it('permissão: aluno, professor e a coordenação sem MFA não chegam a nenhuma rota de /v1/privacidade; a coordenação chega', async () => {
    // O teste percorre as rotas de leitura sem `:id` de /v1/privacidade: a da retenção, a das empresas que recebem dados (F3, 8.0),
    // a dos incidentes (F3, 9.0) e a lista de pedidos do titular (F3, 11.0). Rota de leitura nova do módulo entra aqui sozinha, e a
    // lista abaixo impede que uma delas saia sem o teste reclamar. As de escrita e as de leitura por `:id` (a prévia do titular e o
    // detalhe do pedido, 11.0) respondem 404 à coordenação quando o id é de ninguém, o que não as distingue de quem a guarda
    // barrou: cada uma tem a permissão provada no teste do módulo dela (`incidente.int.test.ts` e `pedido-titular.int.test.ts`,
    // "permissão"; a do arquivo da escola, 13.0, também no segundo; a do cancelamento da eliminação, 14.0, em
    // `eliminacao-agendada.int.test.ts`, "só a coordenação cancela").
    const todas = rotasDe(controladoresDoModulo(AppModule.forRoot(configuracaoDeTeste()))).filter((rota) => rota.caminho.startsWith('/v1/privacidade/'))
    const rotas = todas.filter((rota) => rota.verbo === 'GET' && !rota.caminho.includes(':'))
    expect(todas.filter((rota) => rota.verbo === 'GET').map((rota) => rota.caminho)).toEqual(
      expect.arrayContaining([
        '/v1/privacidade/retencao',
        '/v1/privacidade/suboperadores',
        '/v1/privacidade/incidentes',
        '/v1/privacidade/pedidos',
        '/v1/privacidade/titulares/:id/previa',
        '/v1/privacidade/pedidos/:id',
      ]),
    )
    expect(todas.filter((rota) => rota.verbo !== 'GET').map((rota) => `${rota.verbo} ${rota.caminho}`)).toEqual([
      'POST /v1/privacidade/incidentes/:id/confirmar',
      'POST /v1/privacidade/titulares/busca',
      'POST /v1/privacidade/pedidos',
      'POST /v1/privacidade/pedidos/:id/concluir',
      'POST /v1/privacidade/pedidos/:id/cancelar',
      'POST /v1/privacidade/pedidos/:id/corrigir-nome',
      'POST /v1/privacidade/pedidos/:id/arquivo',
    ])
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const professor = await bancada.sessao(escolaId, 'professor')
    const aluno = await bancada.sessao(escolaId, 'aluno')
    const { rows } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [coordenacao.usuarioId])
    const desafio = await new ChallengeIssuer(CHAVE).emitir({ contaId: rows[0]?.conta_id ?? randomUUID(), etapa: 'mfa', mfaCumprido: false })

    for (const rota of rotas) {
      const caminho = rota.caminho.replace(/:\w+/g, randomUUID())
      const pedir = (token: string) => chamar(api.url, rota.verbo, caminho, token)
      expect((await pedir(await coordenacao.tokenNovo())).status, `coordenação ${rota.caminho}`).toBe(200)
      for (const [quem, sessao] of [['aluno', aluno], ['professor', professor]] as const) {
        const resposta = await pedir(await sessao.tokenNovo())
        expect({ status: resposta.status, codigo: resposta.corpo.erro?.codigo }, `${quem} ${rota.caminho}`).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      }
      const semMfa = await pedir(desafio)
      expect({ status: semMfa.status, codigo: semMfa.corpo.erro?.codigo }, `desafio ${rota.caminho}`).toEqual({ status: 401, codigo: ErrorCode.NAO_AUTENTICADO })
    }
  })
})
