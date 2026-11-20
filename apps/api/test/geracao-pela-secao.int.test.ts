import { type LLMProvider } from '@educa/core'
import { artefatoResponseSchema, conteudoDeAtividadeSchema, conteudoDePlanoDeAulaSchema, descricaoParaOModelo, MAXIMO_DE_HABILIDADES_DO_PLANO, type ChaveDeFuncao, type ConteudoDeAtividade } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { IaRequestRateLimit } from '../src/assistente/ai-request-rate-limit.js'
import { TRECHOS_NA_FERRAMENTA } from '../src/artefato/ferramentas.command.js'
import { FerramentasService } from '../src/artefato/ferramentas.service.js'
import { SecoesRepository } from '../src/material/secoes.repository.js'
import { TrechoSearch } from '../src/material/trecho-search.js'
import { comoPessoa, execucaoTerminada, montarEscolaComAssistente, zerarLimiteDePedidosDeIa, type EscolaComAssistente } from './escola-assistente.fixture.js'
import { FilaDeIa } from './fila-de-ia.fixture.js'
import { criarAtividade, conteudoDeTeste } from './atividade.fixture.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'
import { chamar, type TestApi } from './test-api.js'

/**
 * A geração usa a BNCC da seção da página citada, e o catálogo próprio saiu (classificacao-bncc, 10.0; Tech Spec, seção 5, "Geração").
 *
 * Com a API montada pelo `AppModule`, o Postgres do compose de teste, o material de demonstração (seis páginas) e o adaptador falso de IA.
 * A escola A tem as seções que o teste põe no material dela: as páginas 1 e 2 vêm antes do primeiro capítulo (sem seção), as 3 e 4 são o
 * "capítulo 3" e as 5 e 6 o "capítulo 7". A escola B tem uma seção só, com outra habilidade, no material dela: é o dado que a busca de A
 * alcançaria sem o `escola_id` do join (regra 10, item 5).
 */
describe('a geração usa a BNCC da seção da página citada', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: TestApi
  let fila: FilaDeIa
  let a: EscolaComAssistente
  let b: EscolaComAssistente

  const CAP_3 = 'EM13CNT101'
  const CAP_7 = ['EM13CNT102', 'EM13CNT103'] as const
  const DE_B = 'EM13CNT104'
  /** As habilidades que a seção de cada página tem em A, na ordem do código. */
  const ESPERADAS_EM_A: Readonly<Record<number, readonly string[]>> = { 1: [], 2: [], 3: [CAP_3], 4: [CAP_3], 5: CAP_7, 6: CAP_7 }

  interface SecaoDoTeste {
    readonly de: number
    readonly ate: number
    readonly habilidades: readonly (readonly [codigo: string, origem: 'ia' | 'coordenacao'])[]
  }

  const sql = <Row extends Record<string, unknown> = Record<string, unknown>>(texto: string, valores: unknown[] = []) => bancada.pool.query<Row>(texto, valores)
  const pedir = async (sessao: TestSessao, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, await sessao.tokenNovo(), corpo)
  const artefatoDe = async (sessao: TestSessao, id: string) => artefatoResponseSchema.parse((await pedir(sessao, 'GET', `/v1/artefatos/${id}`)).corpo)
  const suspender = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) => sql('insert into suspensao_de_funcao (escola_id, funcao, suspensa_por) values ($1, $2, $3)', [escola.escolaId, funcao, escola.coordenacao.usuarioId])
  const retomar = (escola: EscolaComAssistente, funcao: ChaveDeFuncao) =>
    sql('update suspensao_de_funcao set retomada_em = greatest(now(), suspensa_em), retomada_por = $3 where escola_id = $1 and funcao = $2 and retomada_em is null', [escola.escolaId, funcao, escola.coordenacao.usuarioId])

  /** As seções do material da escola, no lugar das que houver: cada uma com as habilidades e a origem dadas (nenhuma habilidade é a seção `aguardando` ou `sem_habilidade`). */
  async function secoes(escola: EscolaComAssistente, lista: readonly SecaoDoTeste[]): Promise<void> {
    await sql('delete from secao_do_material where escola_id = $1 and material_id = $2', [escola.escolaId, escola.materialId])
    for (const [indice, secao] of lista.entries()) {
      const { rows } = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, $3::smallint, $4, $5) returning id', [escola.escolaId, escola.materialId, indice + 1, secao.de, secao.ate])
      for (const [codigo, origem] of secao.habilidades) await sql('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [escola.escolaId, rows[0]?.id, codigo, origem])
    }
  }
  const secoesDeA = (): Promise<void> =>
    secoes(a, [
      { de: 3, ate: 4, habilidades: [[CAP_3, 'ia']] },
      { de: 5, ate: 6, habilidades: CAP_7.map((codigo) => [codigo, 'ia'] as const) },
    ])

  /** Os services atrás de um modelo que guarda a entrada da tarefa e devolve o que `saida` decidir (por padrão, a saída do adaptador falso). */
  function geracao(saida?: (conteudo: ConteudoDeAtividade) => ConteudoDeAtividade) {
    const entradas: { trechos: { pagina: number; habilidades: { codigo: string; descricao: string }[] }[] }[] = []
    fila.comModelo(async (pedido) => {
      entradas.push(pedido.entrada as (typeof entradas)[number])
      const falso = (await fila.falso().generate(pedido as Parameters<LLMProvider['generate']>[0])).saida
      return { saida: saida === undefined ? falso : saida(falso as ConteudoDeAtividade), medicao: {} }
    })
    const agendador = fila.agendador()
    const limite = api.app.get(IaRequestRateLimit)
    const ferramentas = new FerramentasService(bancada.banco, agendador, limite, api.app.get(TrechoSearch))
    return { entradas, ferramentas }
  }

  /** A professora gera a ferramenta e o teste espera a execução: devolve o artefato gravado e a entrada que o modelo recebeu. */
  async function gerar(escola: EscolaComAssistente, ferramenta: 'atividade_objetiva' | 'plano_de_aula', saida?: (conteudo: ConteudoDeAtividade) => ConteudoDeAtividade) {
    const { entradas, ferramentas } = geracao(saida)
    const parametros = { turmaId: escola.turma, disciplinaId: escola.quimica, tema: 'reagente limitante e reagente em excesso', chaveEnvio: randomUUID() }
    const { execucaoId } = await comoPessoa(escola, escola.professora, 'professor', () => ferramentas.generate(ferramenta, parametros))
    const execucao = await execucaoTerminada(api, escola.professora, execucaoId)
    if (execucao.estado !== 'concluida' || execucao.resultado?.artefatoId === undefined) throw new Error(`a geração não concluiu: ${execucao.erro ?? execucao.estado}`)
    return { artefato: await artefatoDe(escola.professora, execucao.resultado.artefatoId), entrada: entradas[0] }
  }

  /** O que `ia.habilidade_anulada` somou para a escola até agora. */
  async function anuladasDe(escola: EscolaComAssistente): Promise<number> {
    const pontos = (await medidor.pontos('ia.habilidade_anulada')).filter((ponto) => ponto.atributos['escola_id'] === escola.escolaId)
    return pontos.reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)
  }
  const codigosDe = (habilidades: readonly { codigo: string }[]): string[] => habilidades.map((habilidade) => habilidade.codigo)

  beforeAll(async () => {
    fila = await FilaDeIa.subir(medidor.medidor, {}, linhasDeLog)
    api = fila.api
    a = await montarEscolaComAssistente(api, bancada)
    b = await montarEscolaComAssistente(api, bancada)
    await secoes(b, [{ de: 1, ate: 6, habilidades: [[DE_B, 'ia']] }])
  })

  afterEach(() => fila.restaurar())
  beforeEach(async () => {
    await zerarLimiteDePedidosDeIa(api)
    await secoesDeA()
  })

  afterAll(async () => {
    await fila.ociosa()
    await fila.fechar()
    await bancada.fechar()
  })

  describe('a busca da ferramenta', () => {
    it('devolve com cada trecho as habilidades da seção da página, e nenhuma para a página de antes do primeiro capítulo', async () => {
      const { entrada } = await gerar(a, 'atividade_objetiva')
      const trechos = entrada?.trechos ?? []
      expect(trechos.length).toBeGreaterThan(0)
      for (const trecho of trechos) expect(codigosDe(trecho.habilidades), `página ${String(trecho.pagina)}`).toEqual([...(ESPERADAS_EM_A[trecho.pagina] ?? [])])
      // As páginas das duas seções e a de antes do primeiro capítulo vieram juntas: é o que dá sentido ao resto.
      const paginas = trechos.map((trecho) => trecho.pagina)
      expect(Math.min(...paginas)).toBeLessThanOrEqual(2)
      expect(Math.max(...paginas)).toBeGreaterThanOrEqual(5)
      // O texto da habilidade é o da BNCC (no tamanho do contrato): a descrição vem da tabela pública, não do que o modelo ou a seção guardam.
      const { rows } = await sql<{ descricao: string }>('select descricao from habilidade_bncc where codigo = $1', [CAP_3])
      expect(trechos.find((trecho) => trecho.pagina === 3)?.habilidades[0]?.descricao).toBe(descricaoParaOModelo(rows[0]?.descricao ?? ''))
    })

    it('a seção ainda `aguardando` ou `sem_habilidade` (sem habilidade nenhuma) não dá habilidade, e a questão sai com `null`: a geração não espera a classificação', async () => {
      await secoes(a, [{ de: 1, ate: 6, habilidades: [] }])
      const { artefato, entrada } = await gerar(a, 'atividade_objetiva')
      expect(entrada?.trechos.every((trecho) => trecho.habilidades.length === 0)).toBe(true)
      const conteudo = conteudoDeAtividadeSchema.parse(artefato.conteudo)
      expect(conteudo.questoes.length).toBeGreaterThan(0)
      expect(conteudo.questoes.every((questao) => questao.habilidade === null)).toBe(true)
    })

    it('a correção da coordenação vale na geração seguinte, e com a função suspensa só a da coordenação chega ao modelo', async () => {
      await secoes(a, [{ de: 1, ate: 6, habilidades: [[CAP_3, 'ia'], [CAP_7[0], 'coordenacao']] }])
      const ligada = await gerar(a, 'atividade_objetiva')
      expect(codigosDe(ligada.entrada?.trechos[0]?.habilidades ?? [])).toEqual([CAP_3, CAP_7[0]])

      await suspender(a, 'classificacao_do_material')
      try {
        const suspensa = await gerar(a, 'atividade_objetiva')
        for (const trecho of suspensa.entrada?.trechos ?? []) expect(codigosDe(trecho.habilidades)).toEqual([CAP_7[0]])
        const conteudo = conteudoDeAtividadeSchema.parse(suspensa.artefato.conteudo)
        expect(conteudo.questoes.every((questao) => questao.habilidade === null || questao.habilidade.codigo === CAP_7[0])).toBe(true)
      } finally {
        await retomar(a, 'classificacao_do_material')
      }

      // A coordenação troca a habilidade da seção: a geração seguinte já usa a nova (nada ficou guardado na geração anterior).
      await sql(`delete from habilidade_da_secao where escola_id = $1 and codigo = $2`, [a.escolaId, CAP_3])
      await sql(`insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) select escola_id, secao_id, $2, 'coordenacao' from habilidade_da_secao where escola_id = $1 and codigo = $3`, [a.escolaId, CAP_7[1], CAP_7[0]])
      const trocada = await gerar(a, 'atividade_objetiva')
      expect(codigosDe(trocada.entrada?.trechos[0]?.habilidades ?? [])).toEqual([CAP_7[0], CAP_7[1]])
    })
  })

  describe('a atividade', () => {
    it('cada questão leva a habilidade da seção da página que cita, ou `null` quando a página não tem seção', async () => {
      const { artefato } = await gerar(a, 'atividade_objetiva')
      const conteudo = conteudoDeAtividadeSchema.parse(artefato.conteudo)
      for (const questao of conteudo.questoes) {
        const daPagina = ESPERADAS_EM_A[questao.citacao.pagina] ?? []
        // Página sem habilidade na seção: `null`. Com habilidade: uma das da seção (o adaptador falso escolhe a mais próxima da frase).
        expect(questao.habilidade === null, `a questão que cita a página ${String(questao.citacao.pagina)}`).toBe(daPagina.length === 0)
        if (questao.habilidade !== null) expect(daPagina).toContain(questao.habilidade.codigo)
      }
      // O catálogo próprio acabou: nenhuma questão traz código do `QUI.EM.*`.
      expect(JSON.stringify(conteudo)).not.toContain('QUI.EM')
    })

    it('a habilidade que o modelo escolhe de outra seção (a do capítulo 3 na questão que cita o capítulo 7) é anulada na gravação, e `ia.habilidade_anulada` soma para a escola', async () => {
      const antesDeA = await anuladasDe(a)
      const antesDeB = await anuladasDe(b)
      let pagina = 0
      const { artefato } = await gerar(a, 'atividade_objetiva', (conteudo) => ({
        ...conteudo,
        questoes: conteudo.questoes.map((questao, indice) => {
          if (indice !== 0) return questao
          pagina = questao.citacao.pagina
          // Uma habilidade que existe em A, mas não é da seção da página que a questão cita.
          const deOutraSecao = (ESPERADAS_EM_A[pagina] ?? []).includes(CAP_3) ? CAP_7[0] : CAP_3
          return { ...questao, habilidade: { codigo: deOutraSecao, descricao: 'Habilidade de outra seção.' } }
        }),
      }))
      expect(pagina, 'a primeira questão cita alguma página').toBeGreaterThan(0)
      // A página citada tem de ser de uma seção com habilidade: numa página sem seção, qualquer habilidade seria anulada e o caso passaria sem provar a conferência da seção.
      expect((ESPERADAS_EM_A[pagina] ?? []).length, `a página ${String(pagina)} que o adaptador falso cita é de uma seção com habilidade`).toBeGreaterThan(0)
      const conteudo = conteudoDeAtividadeSchema.parse(artefato.conteudo)
      expect(conteudo.questoes[0]?.habilidade).toBeNull()
      // As outras questões ficam como o modelo as deu: cada uma com uma habilidade da seção da página que cita.
      for (const questao of conteudo.questoes.slice(1)) expect(questao.habilidade === null, `página ${String(questao.citacao.pagina)}`).toBe((ESPERADAS_EM_A[questao.citacao.pagina] ?? []).length === 0)
      expect(await anuladasDe(a)).toBe(antesDeA + 1)
      expect(await anuladasDe(b)).toBe(antesDeB)
    })

    it('o código do antigo catálogo (`QUI.EM.05`) que chegasse à gravação não é de seção nenhuma: sai anulado, e nenhuma questão o guarda', async () => {
      const antes = await anuladasDe(a)
      const { artefato } = await gerar(a, 'atividade_objetiva', (conteudo) => ({ ...conteudo, questoes: conteudo.questoes.map((questao) => ({ ...questao, habilidade: { codigo: 'QUI.EM.05', descricao: 'Reagente limitante.' } })) }))
      const conteudo = conteudoDeAtividadeSchema.parse(artefato.conteudo)
      expect(conteudo.questoes.every((questao) => questao.habilidade === null)).toBe(true)
      expect(JSON.stringify(artefato.conteudo)).not.toContain('QUI.EM')
      expect(await anuladasDe(a)).toBe(antes + conteudo.questoes.length)
    })
  })

  describe('o plano de aula', () => {
    it('leva a união das habilidades das seções que cita, e a lista pode ser vazia quando nenhuma seção citada tem habilidade', async () => {
      const { artefato } = await gerar(a, 'plano_de_aula')
      const plano = conteudoDePlanoDeAulaSchema.parse(artefato.conteudo)
      const citadas = new Set([...plano.citacoes, ...plano.etapas.flatMap((etapa) => (etapa.citacao === undefined ? [] : [etapa.citacao]))].flatMap((citacao) => ESPERADAS_EM_A[citacao.pagina] ?? []))
      // O plano cita páginas das seções 3 a 6: a união delas não é vazia, e um plano sempre sem habilidade não passa.
      expect(citadas.size).toBeGreaterThan(0)
      expect(plano.habilidades.length).toBeGreaterThan(0)
      expect(plano.habilidades.length).toBeLessThanOrEqual(MAXIMO_DE_HABILIDADES_DO_PLANO)
      for (const habilidade of plano.habilidades) expect(citadas.has(habilidade.codigo), habilidade.codigo).toBe(true)

      await secoes(a, [])
      const semSecao = conteudoDePlanoDeAulaSchema.parse((await gerar(a, 'plano_de_aula')).artefato.conteudo)
      expect(semSecao.habilidades).toEqual([])
      expect(semSecao.citacoes.length).toBeGreaterThan(0)
    })
  })

  describe('o recorte é o atual da turma, não o da classificação', () => {
    it('material de seção com habilidades do 6º e do 9º ano: a turma do 9º ano não recebe a `EF06…`, e a série que não é a da turma não recebe a do Médio', async () => {
      const serie9 = (await pedir(a.coordenacao, 'POST', '/v1/series', { etapa: 'ef_anos_finais', ano: 9 })).corpo['id'] as string
      await secoes(a, [{ de: 1, ate: 6, habilidades: [['EF06CI01', 'ia'], ['EF09CI01', 'ia'], [CAP_3, 'ia']] }])
      const habilidades = (serieId: string) =>
        comoPessoa(a, a.professora, 'professor', async () => {
          const achadas = await new SecoesRepository(bancada.banco).habilidadesDasPaginas([{ materialId: a.materialId, pagina: 2 }], { disciplinaId: a.quimica, serieId }, false)
          return codigosDe(achadas.get(`${a.materialId}:2`) ?? [])
        })
      // No Fundamental, Química é Ciências: do 9º ano só a que vale para o 9º; no Médio (a turma), só a da área de Ciências da Natureza.
      expect(await habilidades(serie9)).toEqual(['EF09CI01'])
      expect(await habilidades(a.serieId)).toEqual([CAP_3])
    })

    it('virada do ano: a seção classificada no ano passado vale para a turma do ano novo, que lê a série dela e não o ano em que a seção foi classificada', async () => {
      await sql(`update secao_do_material set classificada_em = now() - interval '400 days' where escola_id = $1 and material_id = $2`, [a.escolaId, a.materialId])
      const { entrada } = await gerar(a, 'atividade_objetiva')
      for (const trecho of entrada?.trechos ?? []) expect(codigosDe(trecho.habilidades), `página ${String(trecho.pagina)}`).toEqual([...(ESPERADAS_EM_A[trecho.pagina] ?? [])])
      expect(entrada?.trechos.some((trecho) => trecho.habilidades.length > 0)).toBe(true)
    })

    it('dois materiais na mesma busca: a seção de um não empresta habilidade à página do outro, ainda que cubra o mesmo número de página', async () => {
      // Um segundo material da escola, copiado do primeiro (o envio de verdade recusa o mesmo arquivo duas vezes): só a linha importa a esta consulta.
      const { rows: copiados } = await sql<{ id: string }>(
        `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, licenca_id, declaracao, sha256, tamanho_bytes, paginas, estado, enviado_por, enviado_em, processado_em)
         select escola_id, disciplina_id, 'Outro material', titularidade, licenca, licenca_id, declaracao, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), tamanho_bytes, paginas, estado, enviado_por, enviado_em, processado_em from material where escola_id = $1 and id = $2 returning id`,
        [a.escolaId, a.materialId],
      )
      const outro = copiados[0]?.id ?? ''
      expect(outro).not.toBe('')
      try {
        const { rows } = await sql<{ id: string }>('insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final) values ($1, $2, 1::smallint, 3, 6) returning id', [a.escolaId, outro])
        await sql(`insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'ia')`, [a.escolaId, rows[0]?.id, CAP_7[0]])
        const lidas = await comoPessoa(a, a.professora, 'professor', () =>
          new SecoesRepository(bancada.banco).habilidadesDasPaginas([{ materialId: a.materialId, pagina: 3 }, { materialId: outro, pagina: 5 }], { disciplinaId: a.quimica, serieId: a.serieId }, false),
        )
        // A página 3 do material de A é do capítulo 3; a seção do outro material também cobre a página 3, e nem por isso entra.
        expect(codigosDe(lidas.get(`${a.materialId}:3`) ?? [])).toEqual([CAP_3])
        expect(codigosDe(lidas.get(`${outro}:5`) ?? [])).toEqual([CAP_7[0]])
      } finally {
        await sql('delete from secao_do_material where escola_id = $1 and material_id = $2', [a.escolaId, outro])
        await sql('delete from material where escola_id = $1 and id = $2', [a.escolaId, outro])
      }
    })

    it('a série do pedido é a da turma: sem componente na disciplina, ou série de outra escola, a lista vem vazia', async () => {
      await sql('update disciplina set componente_bncc = null where id = $1', [a.quimica])
      try {
        const vazia = await comoPessoa(a, a.professora, 'professor', () => new SecoesRepository(bancada.banco).habilidadesDasPaginas([{ materialId: a.materialId, pagina: 3 }], { disciplinaId: a.quimica, serieId: a.serieId }, false))
        expect(vazia.get(`${a.materialId}:3`) ?? []).toEqual([])
        // E a busca da ferramenta devolve os trechos, cada um com a lista vazia (nunca sem o campo).
        const trechos = await comoPessoa(a, a.professora, 'professor', () => new TrechoSearch(bancada.banco).findComHabilidades({ texto: 'reagente limitante e reagente em excesso', disciplinaId: a.quimica, serieId: a.serieId }))
        expect(trechos.length).toBeGreaterThan(0)
        for (const trecho of trechos) expect(trecho.habilidades).toEqual([])
      } finally {
        await sql("update disciplina set componente_bncc = 'quimica' where id = $1", [a.quimica])
      }
      const deOutra = await comoPessoa(a, a.professora, 'professor', () => new SecoesRepository(bancada.banco).habilidadesDasPaginas([{ materialId: a.materialId, pagina: 3 }], { disciplinaId: a.quimica, serieId: b.serieId }, false))
      expect(deOutra.get(`${a.materialId}:3`) ?? []).toEqual([])
    })
  })

  describe('isolamento entre escolas (regra 10, item 5)', () => {
    it('a busca de A não alcança a seção de B: o material de B, lido no contexto de A, volta sem habilidade nenhuma', async () => {
      const doMaterialDeB = await comoPessoa(a, a.professora, 'professor', () =>
        new SecoesRepository(bancada.banco).habilidadesDasPaginas([{ materialId: b.materialId, pagina: 2 }], { disciplinaId: a.quimica, serieId: a.serieId }, false),
      )
      expect(doMaterialDeB.get(`${b.materialId}:2`) ?? []).toEqual([])
      // O mesmo pedido no contexto de B enxerga a seção de B: sem isso o caso acima não provaria o escopo.
      const noContextoDeB = await comoPessoa(b, b.professora, 'professor', () =>
        new SecoesRepository(bancada.banco).habilidadesDasPaginas([{ materialId: b.materialId, pagina: 2 }], { disciplinaId: b.quimica, serieId: b.serieId }, false),
      )
      expect(codigosDe(noContextoDeB.get(`${b.materialId}:2`) ?? [])).toEqual([DE_B])
    })

    it('a geração de A nunca leva a habilidade de B ao modelo nem ao artefato (o escopo da seção é o do caso acima: aqui o `find` já limita os trechos ao material de A)', async () => {
      const { artefato, entrada } = await gerar(a, 'atividade_objetiva')
      expect(JSON.stringify(entrada)).not.toContain(DE_B)
      expect(JSON.stringify(artefato.conteudo)).not.toContain(DE_B)
    })
  })

  describe('a leitura aceita o que a produção já guarda', () => {
    it('a atividade de antes, com o código `QUI.EM.05`, e a que tem questão sem habilidade (`null`), abrem para a professora', async () => {
      const base = conteudoDeTeste(a.materialId, `Atividade de antes ${randomUUID()}`)
      const antiga = await criarAtividade(bancada, a, { conteudo: base })
      const comNula = await criarAtividade(bancada, a, { conteudo: { ...base, titulo: `Atividade sem habilidade ${randomUUID()}`, questoes: base.questoes.map((questao, indice) => (indice === 0 ? { ...questao, habilidade: null } : questao)) } })
      // O artefato de antes é gravado como o antigo catálogo gravava, direto no banco.
      await sql(`update artefato set conteudo = jsonb_set(conteudo, '{questoes,0,habilidade,codigo}', '"QUI.EM.05"') where id = $1`, [antiga])
      const lidaAntiga = conteudoDeAtividadeSchema.parse((await artefatoDe(a.professora, antiga)).conteudo)
      expect(lidaAntiga.questoes[0]?.habilidade?.codigo).toBe('QUI.EM.05')
      const lidaNula = conteudoDeAtividadeSchema.parse((await artefatoDe(a.professora, comNula)).conteudo)
      expect(lidaNula.questoes[0]?.habilidade).toBeNull()
    })
  })

  describe('o seed de teste e de demonstração', () => {
    it('todo código de habilidade que os seeds gravam existe em `habilidade_bncc`', async () => {
      const raiz = fileURLToPath(new URL('../../../', import.meta.url))
      const arquivos = ['apps/api/test/atividade.fixture.ts', 'apps/api/test/escola-tutor.fixture.ts', 'e2e/support/atividade-db.ts', 'e2e/support/assistente.ts', 'e2e/support/aluno.ts', 'e2e/support/governanca.ts', 'e2e/support/professor/criados.ts']
      const codigos = new Set(arquivos.flatMap((arquivo) => readFileSync(`${raiz}${arquivo}`, 'utf8').match(/\b(?:EM13[A-Z]{2,4}\d{3}|EF\d{2}[A-Z]{2}\d{2,3})\b/gu) ?? []))
      expect(codigos.size).toBeGreaterThan(0)
      const { rows } = await sql<{ codigo: string }>('select codigo from habilidade_bncc where codigo = any($1::text[])', [[...codigos]])
      expect(rows.map((linha) => linha.codigo).sort()).toEqual([...codigos].sort())
      // O catálogo próprio não sobrou em seed nenhum.
      for (const arquivo of arquivos) expect(readFileSync(`${raiz}${arquivo}`, 'utf8'), arquivo).not.toContain('QUI.EM')
    })
  })

  describe('o desempenho da consulta (Tech Spec, seção 7c)', () => {
    it('o join da busca usa o índice `(escola_id, material_id, pagina_inicial)` da seção', async () => {
      // A consulta de verdade do `habilidadesDasPaginas` (`consultaDasHabilidadesDasPaginas`, `.toSQL()`), numa tabela com a escala de uma escola de verdade (5.000 seções, perto das 7.500 das 300 apostilas) e estatística em dia: é onde o planejador escolhe entre o índice da página e a leitura inteira.
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        await cliente.query(
          `insert into secao_do_material (escola_id, material_id, ordem, pagina_inicial, pagina_final)
           select $1, $2, ordem, 100 + ordem * 10, 109 + ordem * 10 from generate_series(10, 5000) as ordem`,
          [a.escolaId, a.materialId],
        )
        await cliente.query(
          `insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) select escola_id, id, $3, 'ia' from secao_do_material where escola_id = $1 and material_id = $2 and ordem >= 10`,
          [a.escolaId, a.materialId, CAP_3],
        )
        await cliente.query('analyze secao_do_material')
        await cliente.query('analyze habilidade_da_secao')
        // A consulta é a que o repository monta (`.toSQL()`), com as 12 páginas da busca da ferramenta (`TRECHOS_NA_FERRAMENTA`): a de baixo, que as sementes do teste têm, e onze das seções semeadas acima.
        const paginas = [{ materialId: a.materialId, pagina: 4 }, ...Array.from({ length: TRECHOS_NA_FERRAMENTA - 1 }, (_, indice) => ({ materialId: a.materialId, pagina: 200 + indice * 10 }))]
        const { sql: texto, params } = await comoPessoa(a, a.professora, 'professor', async () => new SecoesRepository(bancada.banco).consultaDasHabilidadesDasPaginas(paginas, false).toSQL())
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) ${texto}`, params as unknown[])
        const nos: Array<Record<string, unknown>> = []
        const andar = (no: Record<string, unknown> | undefined): void => {
          if (no === undefined) return
          nos.push(no)
          for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
        }
        andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Relation Name'] ?? '-')} ${String(no['Index Name'] ?? '-')} ${String(no['Index Cond'] ?? '')}`).join(' > ')
        const doIndice = nos.filter((no) => no['Index Name'] === 'secao_do_material_pagina_idx')
        expect(doIndice.length, resumo).toBeGreaterThan(0)
        // O índice entra pela escola e pelo material, e não só pela página: a condição dele cita as duas colunas que o precedem.
        for (const no of doIndice) expect(String(no['Index Cond']), resumo).toMatch(/escola_id.*material_id/)
        expect(nos.filter((no) => no['Node Type'] === 'Seq Scan' && no['Relation Name'] === 'secao_do_material'), resumo).toEqual([])
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })
})
