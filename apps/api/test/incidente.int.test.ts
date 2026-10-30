import { executarNoContexto, ExpurgoDeAcessoRepository } from '@educa/nucleo'
import { CicloDeVidaService } from '@educa/nucleo/ciclo-de-vida'
import { CHAVES_DE_CATEGORIA_DO_INCIDENTE, ErrorCode, incidentesResponseSchema, FINALIDADE_DO_REGISTRO_DE_INCIDENTE, MAXIMO_DE_TITULARES_ESTIMADOS, TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE, type IncidentesResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { executarOpsIncidente } from '../src/ops/incidente.js'
import { EmissorDeDesafio } from '../src/credencial/index.js'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { esperarNaTrava, GatilhoDeParada } from './gatilho-de-parada.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * O incidente de segurança (F3, tarefa 9.0; `tasks/prd-lgpd-e-titular/cenarios.md`, RF8 e RF9): a operação o registra pelo
 * `ops:incidente`, que roda de verdade com o banco de operação que ele mesmo abre, com uma seção por escola; a coordenação lê pelo
 * `GET /v1/privacidade/incidentes` e confirma pelo `POST …/:id/confirmar`, na API do teste. Postgres e Redis reais.
 *
 * `incidente` é global e o banco acumula: toda escola é nova por teste, o nome dela é sorteado (o comando o compara), e as asserções
 * olham só as seções das escolas que o teste criou.
 */

const OPERADOR = 'operador-teste'
const ambienteDeTeste = lerAmbienteDeTeste()
const CHAVE = new TextEncoder().encode(ambienteDeTeste['IDENTIDADE_CHAVE_ASSINATURA'])

interface Execucao {
  readonly codigo: number
  readonly saida: string
  readonly erro: string
}

interface SecaoDoArquivo {
  escola: string
  circunstancias: string
  categorias: string[]
  titularesEstimados: number
  risco: string
  contencao: string
  correcao: string
}

interface LinhaDaSecao {
  id: string
  incidente_id: string
  escola_id: string
  circunstancias: string
  categorias: string[]
  titulares_estimados: number
  risco: string
  contencao: string
  correcao: string
  confirmado_em: Date | null
  confirmado_por: string | null
}

interface AuditoriaDoIncidente {
  acao: string
  escola_id: string | null
  entidade: string
  entidade_id: string
  autor_operador: string | null
  autor_usuario_id: string | null
  antes: unknown
  depois: unknown
  finalidade: string | null
}

/** Uma escola do teste: o nome sorteado, o id, e a coordenação com o token. */
interface EscolaDoTeste {
  readonly id: string
  readonly nome: string
  readonly coordenacao: SessaoDeTeste
}

describe('incidente: a operação registra por comando, e cada coordenação lê e confirma só a seção da escola dela (F3, tarefa 9.0)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const ambiente = { ...ambienteDeTeste, OPERADOR }
  const pasta = mkdtempSync(join(tmpdir(), 'incidente-int-'))
  let arquivos = 0
  let api: ApiDeTeste
  /** Os incidentes que o teste registrou: a limpeza os apaga no fim, e as seções saem em cascata. */
  const incidentes: string[] = []

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    await bancada.pool.query('delete from incidente where id = any($1::uuid[])', [incidentes])
    rmSync(pasta, { recursive: true, force: true })
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Uma escola nova com o nome sorteado (sem acento, para o teste do acento escolher o que muda) e uma coordenação. */
  async function escolaNova(prefixo = 'Colegio Ametista'): Promise<EscolaDoTeste> {
    const nome = `${prefixo} ${randomUUID().slice(0, 8)}`
    const id = await bancada.escola(nome)
    return { id, nome, coordenacao: await bancada.sessao(id, 'coordenador') }
  }

  const secao = (escola: EscolaDoTeste, resto: Partial<SecaoDoArquivo> = {}): SecaoDoArquivo => ({
    escola: escola.id,
    circunstancias: 'Acesso indevido ao armazenamento de arquivos por credencial vazada.',
    categorias: ['cadastro', 'conversa_do_aluno'],
    titularesEstimados: 120,
    risco: 'relevante',
    contencao: 'Credencial revogada e acesso bloqueado.',
    correcao: 'Rotação de todas as credenciais.',
    ...resto,
  })

  /** Escreve o arquivo do comando. `conteudo` cru serve ao teste do JSON quebrado. */
  function arquivo(conteudo: unknown): string {
    const caminho = join(pasta, `incidente-${++arquivos}.json`)
    writeFileSync(caminho, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
    return caminho
  }

  const ha = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString()

  async function rodar(argumentos: string[], doAmbiente: Record<string, string | undefined> = ambiente): Promise<Execucao> {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsIncidente(argumentos, doAmbiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
    return { codigo, saida, erro }
  }

  /** O comando `registrar` com as seções dadas; o id do incidente fica na lista da limpeza. */
  async function registrar(secoes: SecaoDoArquivo[], conhecidoEm = ha(2)): Promise<Execucao & { incidenteId: string | undefined }> {
    const execucao = await rodar(['registrar', '--arquivo', arquivo({ conhecidoEm, escolas: secoes })])
    const incidenteId = execucao.codigo === 0 ? (JSON.parse(execucao.saida) as { incidenteId: string }).incidenteId : undefined
    if (incidenteId !== undefined) incidentes.push(incidenteId)
    return { ...execucao, incidenteId }
  }

  const secoesDe = async (escolaId: string): Promise<LinhaDaSecao[]> =>
    (
      await bancada.pool.query<LinhaDaSecao>(
        `select id, incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao, confirmado_em, confirmado_por
           from incidente_escola where escola_id = $1 order by avisado_em, id`,
        [escolaId],
      )
    ).rows

  async function auditoriasDe(escolaId: string, acao?: string): Promise<AuditoriaDoIncidente[]> {
    const { rows } = await bancada.pool.query<AuditoriaDoIncidente>(
      `select acao, escola_id, entidade, entidade_id, autor_operador, autor_usuario_id, antes, depois, finalidade from auditoria
        where escola_id = $1 and acao like 'incidente.%' and ($2::text is null or acao = $2) order by em, acao`,
      [escolaId, acao ?? null],
    )
    return rows
  }

  const quantasSecoes = async (...escolas: EscolaDoTeste[]) => (await bancada.pool.query('select 1 from incidente_escola where escola_id = any($1::uuid[])', [escolas.map((escola) => escola.id)])).rowCount

  async function lista(escola: EscolaDoTeste): Promise<IncidentesResponse> {
    const resposta = await chamar(api.url, 'GET', '/v1/privacidade/incidentes', await escola.coordenacao.tokenNovo())
    expect(resposta.status).toBe(200)
    return incidentesResponseSchema.parse(resposta.corpo)
  }

  const confirmar = async (escola: EscolaDoTeste, id: string) => chamar(api.url, 'POST', `/v1/privacidade/incidentes/${id}/confirmar`, await escola.coordenacao.tokenNovo(), {})

  it('RF8, registro: cada escola recebe a seção com os números e os textos dela, a auditoria da escola, e nada de titular; o incidente guarda quando se soube e quem registrou', async () => {
    const a = await escolaNova()
    const b = await escolaNova('Colegio Basalto')
    const conhecidoEm = ha(5)
    const feito = await registrar(
      [
        secao(a, { titularesEstimados: 7001, risco: 'alto', circunstancias: 'Texto da seção da escola A.', categorias: ['cadastro'], contencao: 'Contenção de A.', correcao: 'Correção de A.' }),
        secao(b, { titularesEstimados: 7002, risco: 'baixo', circunstancias: 'Texto da seção da escola B.', categorias: ['conversa_do_aluno', 'trabalho_do_aluno'], contencao: 'Contenção de B.', correcao: 'Correção de B.' }),
      ],
      conhecidoEm,
    )
    expect({ codigo: feito.codigo, erro: feito.erro }).toEqual({ codigo: 0, erro: '' })
    expect(JSON.parse(feito.saida)).toEqual({ incidenteId: feito.incidenteId, escolas: 2 })

    const { rows: incidente } = await bancada.pool.query<{ id: string; conhecido_em: Date; registrado_por: string; registrado_em: Date }>('select id, conhecido_em, registrado_por, registrado_em from incidente where id = $1', [feito.incidenteId])
    expect(incidente).toHaveLength(1)
    expect(incidente[0]?.registrado_por).toBe(OPERADOR)
    expect(incidente[0]?.conhecido_em.toISOString()).toBe(conhecidoEm)
    expect(incidente[0]?.registrado_em.getTime()).toBeGreaterThanOrEqual(incidente[0]?.conhecido_em.getTime() ?? Infinity)

    const [daA] = await secoesDe(a.id)
    const [daB] = await secoesDe(b.id)
    expect(daA).toMatchObject({ incidente_id: feito.incidenteId, titulares_estimados: 7001, risco: 'alto', circunstancias: 'Texto da seção da escola A.', categorias: ['cadastro'], contencao: 'Contenção de A.', correcao: 'Correção de A.', confirmado_em: null, confirmado_por: null })
    expect(daB).toMatchObject({ incidente_id: feito.incidenteId, titulares_estimados: 7002, risco: 'baixo', circunstancias: 'Texto da seção da escola B.', categorias: ['conversa_do_aluno', 'trabalho_do_aluno'], contencao: 'Contenção de B.', correcao: 'Correção de B.' })
    expect(await secoesDe(a.id)).toHaveLength(1)
    expect(daA?.id).not.toBe(daB?.id)

    // A auditoria de cada escola traz só o risco e o número dela, com o autor da operação e a finalidade fixa.
    expect(await auditoriasDe(a.id)).toEqual([
      { acao: 'incidente.registrado', escola_id: a.id, entidade: 'incidente_escola', entidade_id: daA?.id, autor_operador: OPERADOR, autor_usuario_id: null, antes: null, depois: { risco: 'alto', titularesEstimados: 7001 }, finalidade: FINALIDADE_DO_REGISTRO_DE_INCIDENTE },
    ])
    expect(await auditoriasDe(b.id)).toEqual([
      { acao: 'incidente.registrado', escola_id: b.id, entidade: 'incidente_escola', entidade_id: daB?.id, autor_operador: OPERADOR, autor_usuario_id: null, antes: null, depois: { risco: 'baixo', titularesEstimados: 7002 }, finalidade: FINALIDADE_DO_REGISTRO_DE_INCIDENTE },
    ])
  })

  it('RF8, sem dado de titular: as duas tabelas só têm colunas de data, número, categoria e texto da seção, e nenhuma de pessoa', async () => {
    const { rows } = await bancada.pool.query<{ tabela: string; colunas: string[] }>(
      `select table_name as tabela, array_agg(column_name::text order by column_name) as colunas from information_schema.columns
        where table_schema = 'public' and table_name in ('incidente', 'incidente_escola') group by table_name order by table_name`,
    )
    expect(rows).toEqual([
      { tabela: 'incidente', colunas: ['conhecido_em', 'id', 'registrado_em', 'registrado_por'] },
      {
        tabela: 'incidente_escola',
        colunas: ['avisado_em', 'categorias', 'circunstancias', 'confirmado_em', 'confirmado_por', 'contencao', 'correcao', 'escola_id', 'id', 'incidente_id', 'risco', 'titulares_estimados'],
      },
    ])
  })

  describe('RF8, o texto que cita outra escola afetada é recusado, sem gravar nada', () => {
    const variantes: Array<[nome: string, escrever: (outra: EscolaDoTeste) => string]> = [
      ['o nome como está', (outra) => `Também afetou a ${outra.nome}.`],
      ['o nome em maiúsculas', (outra) => `Também afetou a ${outra.nome.toUpperCase()}.`],
      ['o nome com acento onde a escola não tem', (outra) => `Também afetou a ${outra.nome.replace('Colegio', 'Colégio')}.`],
      ['o nome com espaços a mais', (outra) => `Também afetou a ${outra.nome.replace(' ', '   ')}.`],
      ['o id', (outra) => `Veja ${outra.id}.`],
      ['o id em maiúsculas', (outra) => `Veja ${outra.id.toUpperCase()}.`],
      ['o id sem hífen', (outra) => `Veja ${outra.id.replaceAll('-', '')}.`],
    ]
    const campos = ['circunstancias', 'contencao', 'correcao'] as const

    for (const [descricao, escrever] of variantes) {
      it(descricao, async () => {
        const a = await escolaNova()
        const b = await escolaNova('Colegio Basalto')
        // Cada um dos três textos, em rodadas separadas: a trava vale para todos, e a posição da seção sai na mensagem.
        for (const campo of campos) {
          const execucao = await registrar([secao(a), secao(b, { [campo]: escrever(a) })])
          expect(execucao.codigo, campo).toBe(2)
          expect(execucao.saida).toBe('')
          expect(execucao.erro, campo).toBe('Opção inválida ou ausente: --arquivo (a seção 2 cita o nome ou o id de outra escola afetada)\n')
          expect(execucao.erro).not.toContain(a.id)
          expect(execucao.erro).not.toContain(a.nome)
        }
        expect(await quantasSecoes(a, b)).toBe(0)
        expect(await auditoriasDe(a.id)).toEqual([])
        expect(await auditoriasDe(b.id)).toEqual([])
      })
    }

    it('o nome da própria escola no texto passa, também quando contém o nome da outra', async () => {
      const curta = await escolaNova('Colegio Ametista')
      // O nome da escola longa contém o da curta ("colegio ametista"), mas só o da própria escola longa aparece no texto dela.
      const longa = await escolaNova(`${curta.nome.replace(/ [0-9a-f]{8}$/, '')} ${curta.nome.slice(-8)} Norte`)
      expect(longa.nome.toLowerCase()).toContain(curta.nome.toLowerCase())
      const feito = await registrar([secao(curta), secao(longa, { circunstancias: `A ${longa.nome} teve o acesso indevido.` })])
      expect({ codigo: feito.codigo, erro: feito.erro }).toEqual({ codigo: 0, erro: '' })
      expect(await quantasSecoes(curta, longa)).toBe(2)
    })

    it('o nome da outra escola que contém o da própria é recusado, também quando a própria escola está na seção', async () => {
      const curta = await escolaNova('Colegio Ametista')
      const longa = await escolaNova(`${curta.nome.replace(/ [0-9a-f]{8}$/, '')} ${curta.nome.slice(-8)} Norte`)
      const recusado = await registrar([secao(curta, { circunstancias: `A ${longa.nome} teve o acesso indevido.` }), secao(longa)])
      expect({ codigo: recusado.codigo, saida: recusado.saida, erro: recusado.erro }).toEqual({
        codigo: 2,
        saida: '',
        erro: 'Opção inválida ou ausente: --arquivo (a seção 1 cita o nome ou o id de outra escola afetada)\n',
      })
      expect(await quantasSecoes(curta, longa)).toBe(0)
    })
  })

  it('RF8, o arquivo e a escola: escola que não existe é NAO_ENCONTRADO e desfaz a seção da que existe; escola repetida, categoria de fora, texto grande, número negativo e data no futuro são recusados antes de abrir o banco; o erro nunca traz o conteúdo', async () => {
    const a = await escolaNova()
    const inexistente = randomUUID()
    const semEscola = await registrar([secao(a), { ...secao(a), escola: inexistente }])
    expect({ codigo: semEscola.codigo, saida: semEscola.saida, erro: semEscola.erro }).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: escola não encontrada\n' })
    expect(semEscola.erro).not.toContain(inexistente)
    expect(await quantasSecoes(a)).toBe(0)
    expect(await auditoriasDe(a.id)).toEqual([])

    const segredo = 'SENTINELA-DO-CONTEUDO-DO-ARQUIVO'
    const casos: Array<[nome: string, conteudo: unknown, erro: string]> = [
      ['escola repetida', { conhecidoEm: ha(1), escolas: [secao(a), secao(a)] }, 'Opção inválida ou ausente: --arquivo (escola repetida)\n'],
      ['categoria fora da lista', { conhecidoEm: ha(1), escolas: [secao(a, { categorias: [segredo] })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.categorias.0)\n'],
      ['categoria nenhuma', { conhecidoEm: ha(1), escolas: [secao(a, { categorias: [] })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.categorias)\n'],
      ['texto de mil e um caracteres', { conhecidoEm: ha(1), escolas: [secao(a, { correcao: `${segredo}${'x'.repeat(1001)}` })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.correcao)\n'],
      ['texto só de espaços', { conhecidoEm: ha(1), escolas: [secao(a, { contencao: '   ' })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.contencao)\n'],
      ['caractere de controle no texto', { conhecidoEm: ha(1), escolas: [secao(a, { circunstancias: `${segredo}\u0007` })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.circunstancias)\n'],
      ['número negativo', { conhecidoEm: ha(1), escolas: [secao(a, { titularesEstimados: -1 })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.titularesEstimados)\n'],
      ['número quebrado', { conhecidoEm: ha(1), escolas: [secao(a, { titularesEstimados: 1.5 })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.titularesEstimados)\n'],
      ['número acima do teto', { conhecidoEm: ha(1), escolas: [secao(a, { titularesEstimados: MAXIMO_DE_TITULARES_ESTIMADOS + 1 })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.titularesEstimados)\n'],
      ['risco de fora', { conhecidoEm: ha(1), escolas: [secao(a, { risco: segredo })] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0.risco)\n'],
      ['campo a mais na seção', { conhecidoEm: ha(1), escolas: [{ ...secao(a), titulares: [segredo] }] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas.0)\n'],
      ['data no futuro', { conhecidoEm: new Date(Date.now() + 3_600_000).toISOString(), escolas: [secao(a)] }, 'Opção inválida ou ausente: --arquivo (campo inválido: conhecidoEm no futuro)\n'],
      ['data que não é data', { conhecidoEm: segredo, escolas: [secao(a)] }, 'Opção inválida ou ausente: --arquivo (campo inválido: conhecidoEm)\n'],
      ['nenhuma escola', { conhecidoEm: ha(1), escolas: [] }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas)\n'],
      ['201 escolas', { conhecidoEm: ha(1), escolas: Array.from({ length: 201 }, () => secao(a, { escola: randomUUID() })) }, 'Opção inválida ou ausente: --arquivo (campo inválido: escolas)\n'],
      ['campo a mais no arquivo', { conhecidoEm: ha(1), escolas: [secao(a)], registradoPor: segredo }, 'Opção inválida ou ausente: --arquivo (campo inválido: raiz)\n'],
      ['JSON quebrado', `{ "conhecidoEm": "${segredo}`, 'Opção inválida ou ausente: --arquivo (não é um JSON válido)\n'],
    ]
    for (const [nome, conteudo, erro] of casos) {
      const execucao = await rodar(['registrar', '--arquivo', arquivo(conteudo)])
      expect({ nome, codigo: execucao.codigo, saida: execucao.saida, erro: execucao.erro }).toEqual({ nome, codigo: 2, saida: '', erro })
      expect(execucao.erro).not.toContain(segredo)
    }
    const naoExiste = await rodar(['registrar', '--arquivo', join(pasta, 'nao-existe.json')])
    expect(naoExiste).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --arquivo (não foi possível ler o arquivo)\n' })
    const grande = arquivo(`{"conhecidoEm": "${'x'.repeat(300 * 1024)}"}`)
    expect(await rodar(['registrar', '--arquivo', grande])).toEqual({ codigo: 2, saida: '', erro: 'Opção inválida ou ausente: --arquivo (maior que 256 KB)\n' })
    for (const argumentos of [[], ['registrar'], ['apagar', '--arquivo', arquivo({})], ['registrar', '--arquivo', arquivo({}), '--escola', a.id]]) {
      expect((await rodar(argumentos)).codigo, argumentos.join(' ')).toBe(2)
    }
    expect(await quantasSecoes(a)).toBe(0)
  })

  it('RF8, o arquivo normaliza o que o operador escreveu: categoria repetida vira uma, e o id da escola em maiúsculas é o mesmo id', async () => {
    const a = await escolaNova()
    const feito = await registrar([secao(a, { escola: a.id.toUpperCase(), categorias: ['conversa_do_aluno', 'cadastro', 'conversa_do_aluno'] })])
    expect({ codigo: feito.codigo, erro: feito.erro }).toEqual({ codigo: 0, erro: '' })
    expect((await secoesDe(a.id)).map((linha) => linha.categorias)).toEqual([['conversa_do_aluno', 'cadastro']])
    // Maiúscula e minúscula são a mesma escola: repetida.
    const repetida = await registrar([secao(a), secao(a, { escola: a.id.toUpperCase() })])
    expect(repetida).toMatchObject({ codigo: 2, erro: 'Opção inválida ou ausente: --arquivo (escola repetida)\n' })
  })

  it('RF8, conhecidoEm com fuso: o instante gravado é o mesmo em UTC', async () => {
    const a = await escolaNova()
    const feito = await registrar([secao(a)], '2026-10-01T08:30:00-03:00')
    expect({ codigo: feito.codigo, erro: feito.erro }).toEqual({ codigo: 0, erro: '' })
    const { rows } = await bancada.pool.query<{ conhecido_em: Date }>('select conhecido_em from incidente where id = $1', [feito.incidenteId])
    expect(rows[0]?.conhecido_em.toISOString()).toBe('2026-10-01T11:30:00.000Z')
  })

  it('RF8, o banco recusa o que o comando deixaria passar: categoria, risco, tamanho, número, data do conhecimento e confirmação sem data', async () => {
    const a = await escolaNova()
    const incidenteId = (await bancada.pool.query<{ id: string }>(`insert into incidente (conhecido_em, registrado_por) values (now() - interval '1 hour', $1) returning id`, [OPERADOR])).rows[0]?.id ?? ''
    incidentes.push(incidenteId)
    const inserir = (colunas: Record<string, unknown>) => {
      const valores = { circunstancias: 'c', categorias: ['cadastro'], titulares_estimados: 1, risco: 'baixo', contencao: 'c', correcao: 'c', ...colunas }
      const nomes = Object.keys(valores)
      return bancada.pool.query(`insert into incidente_escola (incidente_id, escola_id, ${nomes.join(', ')}) values ($1, $2, ${nomes.map((_, posicao) => `$${posicao + 3}`).join(', ')})`, [incidenteId, a.id, ...Object.values(valores)])
    }
    const recusa = (constraint: string) => ({ code: '23514', constraint })
    await expect(inserir({ categorias: ['cadastro', 'diagnostico'] })).rejects.toMatchObject(recusa('incidente_escola_categorias_validas'))
    await expect(inserir({ categorias: [] })).rejects.toMatchObject(recusa('incidente_escola_categorias_validas'))
    await expect(inserir({ risco: 'critico' })).rejects.toMatchObject(recusa('incidente_escola_risco_valido'))
    await expect(inserir({ circunstancias: '' })).rejects.toMatchObject(recusa('incidente_escola_circunstancias_tamanho'))
    await expect(inserir({ contencao: 'x'.repeat(1001) })).rejects.toMatchObject(recusa('incidente_escola_contencao_tamanho'))
    await expect(inserir({ correcao: '' })).rejects.toMatchObject(recusa('incidente_escola_correcao_tamanho'))
    await expect(inserir({ titulares_estimados: -1 })).rejects.toMatchObject(recusa('incidente_escola_titulares_estimados_validos'))
    await expect(inserir({ titulares_estimados: 100_000_001 })).rejects.toMatchObject(recusa('incidente_escola_titulares_estimados_validos'))
    await expect(inserir({ confirmado_por: a.coordenacao.usuarioId })).rejects.toMatchObject(recusa('incidente_escola_confirmado_por_so_no_confirmado'))
    await expect(bancada.pool.query(`insert into incidente (conhecido_em, registrado_por) values (now() + interval '1 hour', $1)`, [OPERADOR])).rejects.toMatchObject(recusa('incidente_conhecido_antes_do_registro'))
    await expect(bancada.pool.query(`insert into incidente (conhecido_em, registrado_por) values (now(), 'Operador Com Espaço')`)).rejects.toMatchObject(recusa('incidente_registrado_por_formato'))
    await inserir({ titulares_estimados: 0, categorias: [...CHAVES_DE_CATEGORIA_DO_INCIDENTE], risco: 'alto' })
    // A escola aparece uma vez por incidente.
    await expect(inserir({})).rejects.toMatchObject({ code: '23505', constraint: 'incidente_escola_da_escola_unico' })
    // O confirmado de verdade passa, e a confirmação de quem não é da escola é recusada pela FK composta.
    const outra = await escolaNova()
    await expect(bancada.pool.query('update incidente_escola set confirmado_em = now(), confirmado_por = $2 where escola_id = $1', [a.id, outra.coordenacao.usuarioId])).rejects.toMatchObject({ code: '23503' })
    await bancada.pool.query('update incidente_escola set confirmado_em = now(), confirmado_por = $2 where escola_id = $1', [a.id, a.coordenacao.usuarioId])
  })

  it('RF8, o banco: o check de categorias da seção tem exatamente as categorias do contrato', async () => {
    const { rows } = await bancada.pool.query<{ definicao: string }>(`select pg_get_constraintdef(oid) as definicao from pg_constraint where conname = 'incidente_escola_categorias_validas'`)
    expect(rows).toHaveLength(1)
    const literais = [...(rows[0]?.definicao ?? '').matchAll(/'(\w+)'/g)].map((literal) => literal[1])
    expect(literais.toSorted()).toEqual([...CHAVES_DE_CATEGORIA_DO_INCIDENTE].toSorted())
  })

  it('RF9, isolamento: a coordenação de A não recebe a contagem, o texto, o id nem o nome de B; o id que ela vê é o da seção dela', async () => {
    const a = await escolaNova()
    const b = await escolaNova('Colegio Basalto')
    const feito = await registrar([
      secao(a, { titularesEstimados: 8101, circunstancias: 'Circunstância de A.', contencao: 'Contenção de A.', correcao: 'Correção de A.', categorias: ['cadastro'] }),
      secao(b, { titularesEstimados: 8202, circunstancias: 'SENTINELA-DE-B-circunstancia', contencao: 'SENTINELA-DE-B-contencao', correcao: 'SENTINELA-DE-B-correcao', categorias: ['trabalho_do_aluno'] }),
    ])
    expect(feito.codigo).toBe(0)
    const [daA] = await secoesDe(a.id)
    const [daB] = await secoesDe(b.id)

    const resposta = await lista(a)
    expect(resposta.incidentes).toHaveLength(1)
    expect(resposta.incidentes[0]).toMatchObject({ id: daA?.id, titularesEstimados: 8101, circunstancias: 'Circunstância de A.', categorias: ['cadastro'], confirmadoEm: null })
    const texto = JSON.stringify(resposta)
    for (const proibido of ['SENTINELA-DE-B', '8202', 'trabalho_do_aluno', b.nome, b.id, daB?.id ?? '', feito.incidenteId ?? '', OPERADOR]) expect(texto, proibido).not.toContain(proibido)
    // O id que A vê é o da seção dela, e não o do incidente que as duas dividem.
    expect(daA?.id).not.toBe(feito.incidenteId)
    expect(texto).toContain(daA?.id)

    // B, ao contrário, lê a dela e só ela.
    expect((await lista(b)).incidentes.map((incidente) => ({ id: incidente.id, titularesEstimados: incidente.titularesEstimados }))).toEqual([{ id: daB?.id, titularesEstimados: 8202 }])
  })

  it('RF9, isolamento: confirmar o id de B pela coordenação de A responde como o id que não existe, e não toca em B; confirmar em A não confirma B', async () => {
    const a = await escolaNova()
    const b = await escolaNova('Colegio Basalto')
    const c = await escolaNova('Colegio Cobre')
    expect((await registrar([secao(a), secao(b)])).codigo).toBe(0)
    // O incidente só de C: nem A nem B o alcançam.
    expect((await registrar([secao(c)])).codigo).toBe(0)
    const [daA] = await secoesDe(a.id)
    const [daB] = await secoesDe(b.id)
    const [daC] = await secoesDe(c.id)

    /** O que a resposta diz a quem perguntou: o status, o código e a mensagem. O `requisicaoId` é de cada chamada. */
    const resposta404 = (resposta: Awaited<ReturnType<typeof confirmar>>) => ({ status: resposta.status, codigo: resposta.corpo.erro?.codigo, mensagem: (resposta.corpo.erro as { mensagem?: string } | undefined)?.mensagem })
    const inexistente = resposta404(await confirmar(a, randomUUID()))
    expect(inexistente).toMatchObject({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
    for (const alheio of [daB, daC]) expect(resposta404(await confirmar(a, alheio?.id ?? ''))).toEqual(inexistente)
    // O id que nem é um id responde igual.
    expect(resposta404(await confirmar(a, 'nao-e-um-id'))).toEqual(inexistente)
    expect((await secoesDe(b.id))[0]?.confirmado_em).toBeNull()
    expect((await secoesDe(c.id))[0]?.confirmado_em).toBeNull()
    expect(await auditoriasDe(b.id, 'incidente.confirmado')).toEqual([])

    // A confirma a dela: B e C ficam como estavam.
    expect((await confirmar(a, daA?.id ?? '')).status).toBe(204)
    expect((await secoesDe(a.id))[0]?.confirmado_em).toBeInstanceOf(Date)
    expect((await secoesDe(b.id))[0]?.confirmado_em).toBeNull()
    expect((await secoesDe(c.id))[0]?.confirmado_em).toBeNull()
    expect((await lista(b)).incidentes.map((incidente) => incidente.confirmadoEm)).toEqual([null])
  })

  it('RF9, confirmação: grava quem e quando, audita uma vez, e a lista mostra primeiro o que falta confirmar', async () => {
    const a = await escolaNova()
    // Três incidentes, e a coordenação confirma o mais novo: ele vai para o fim da lista, atrás dos que faltam, mesmo sendo o mais recente.
    expect((await registrar([secao(a, { circunstancias: 'O velho.' })], ha(30))).codigo).toBe(0)
    expect((await registrar([secao(a, { circunstancias: 'O novo.' })], ha(1))).codigo).toBe(0)
    expect((await registrar([secao(a, { circunstancias: 'O do meio.' })], ha(10))).codigo).toBe(0)
    const antes = await lista(a)
    expect(antes.prazoLegal).toBe(TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE)
    expect(antes.incidentes.map((incidente) => incidente.circunstancias)).toEqual(['O novo.', 'O do meio.', 'O velho.'])
    const novo = antes.incidentes[0]
    expect(novo?.confirmadoEm).toBeNull()

    const resposta = await confirmar(a, novo?.id ?? '')
    expect({ status: resposta.status, corpo: resposta.corpo }).toEqual({ status: 204, corpo: {} })
    const linha = (await secoesDe(a.id)).find((secaoDaEscola) => secaoDaEscola.id === novo?.id)
    expect(linha?.confirmado_por).toBe(a.coordenacao.usuarioId)
    expect(linha?.confirmado_em).toBeInstanceOf(Date)
    expect(Math.abs((linha?.confirmado_em?.getTime() ?? 0) - Date.now())).toBeLessThan(60_000)

    // Os que faltam vêm à frente, do mais recente ao mais antigo, e o confirmado vai para o fim, com a data.
    const depois = await lista(a)
    expect(depois.incidentes.map((incidente) => incidente.circunstancias)).toEqual(['O do meio.', 'O velho.', 'O novo.'])
    expect(depois.incidentes.map((incidente) => incidente.confirmadoEm !== null)).toEqual([false, false, true])
    expect(depois.incidentes[2]?.confirmadoEm).toBe(linha?.confirmado_em?.toISOString())

    // Uma linha de auditoria da escola, da pessoa que confirmou, com a finalidade fixa e sem texto.
    expect(await auditoriasDe(a.id, 'incidente.confirmado')).toEqual([
      { acao: 'incidente.confirmado', escola_id: a.id, entidade: 'incidente_escola', entidade_id: novo?.id, autor_operador: null, autor_usuario_id: a.coordenacao.usuarioId, antes: null, depois: null, finalidade: FINALIDADE_DO_REGISTRO_DE_INCIDENTE },
    ])

    // Confirmar de novo não muda a data, nem o autor, nem a auditoria.
    const segunda = await confirmar(a, novo?.id ?? '')
    expect(segunda.status).toBe(204)
    const [mesma] = (await secoesDe(a.id)).filter((secaoDaEscola) => secaoDaEscola.id === novo?.id)
    expect(mesma?.confirmado_em?.getTime()).toBe(linha?.confirmado_em?.getTime())
    expect(await auditoriasDe(a.id, 'incidente.confirmado')).toHaveLength(1)
  })

  it('RF9, a lista traz até 50 e os sem confirmação sempre entram, mesmo os mais antigos: 49 confirmados mais novos não os empurram para fora', async () => {
    const a = await escolaNova()
    // Dois pendentes velhos e 49 confirmados recentes: 51 no total, direto no banco.
    const inserir = async (horasAtras: number, confirmado: boolean) => {
      const { rows } = await bancada.pool.query<{ id: string }>(`insert into incidente (conhecido_em, registrado_por) values (now() - $1::int * interval '1 hour', $2) returning id`, [horasAtras, OPERADOR])
      const id = rows[0]?.id ?? ''
      incidentes.push(id)
      await bancada.pool.query(
        `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao, confirmado_em)
         values ($1, $2, $3, array['cadastro'], 1, 'baixo', 'c', 'c', case when $4::boolean then now() else null end)`,
        [id, a.id, `Incidente de ${horasAtras} h.`, confirmado],
      )
    }
    await inserir(900, false)
    await inserir(800, false)
    for (let hora = 1; hora <= 49; hora++) await inserir(hora, true)
    const resposta = await lista(a)
    expect(resposta.incidentes).toHaveLength(50)
    expect(resposta.incidentes.slice(0, 2).map((incidente) => incidente.circunstancias)).toEqual(['Incidente de 800 h.', 'Incidente de 900 h.'])
    expect(resposta.incidentes.slice(2).every((incidente) => incidente.confirmadoEm !== null)).toBe(true)
    // Entre os confirmados, o mais recente primeiro; o corte leva o mais antigo (o de 49 h), e nunca um pendente.
    expect(resposta.incidentes.slice(2).map((incidente) => incidente.circunstancias)).toEqual(Array.from({ length: 48 }, (_, posicao) => `Incidente de ${posicao + 1} h.`))
  })

  it('RF9, concorrência: duas confirmações ao mesmo tempo, de duas pessoas da coordenação, mantêm a primeira, respondem 204 as duas e auditam uma só', async () => {
    const a = await escolaNova()
    const segunda = await bancada.sessao(a.id, 'coordenador')
    expect((await registrar([secao(a)])).codigo).toBe(0)
    const [daA] = await secoesDe(a.id)
    const id = daA?.id ?? ''
    // O primeiro `update` para depois de gravar, com a linha travada; o segundo espera na trava dela, antes de reler `confirmado_em`.
    const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'incidente_escola', evento: 'update', quando: `new.id = '${id}'` })
    await gatilho.armar()
    let resposta: Awaited<ReturnType<typeof confirmar>> | undefined
    let primeira: Awaited<ReturnType<typeof confirmar>> | undefined
    try {
      const promessaPrimeira = confirmar(a, id)
      await gatilho.esperarParadas()
      const promessaSegunda = chamar(api.url, 'POST', `/v1/privacidade/incidentes/${id}/confirmar`, await segunda.tokenNovo(), {})
      // Dois esperando na trava: o primeiro, parado no gatilho, e o segundo, na linha que o primeiro segura.
      await esperarNaTrava(bancada.pool, '%update "incidente_escola"%', 2)
      await gatilho.soltar()
      primeira = await promessaPrimeira
      resposta = await promessaSegunda
    } finally {
      await gatilho.desarmar()
    }
    expect([primeira?.status, resposta?.status]).toEqual([204, 204])
    const [linha] = await secoesDe(a.id)
    expect(linha?.confirmado_por).toBe(a.coordenacao.usuarioId)
    const auditorias = await auditoriasDe(a.id, 'incidente.confirmado')
    expect(auditorias.map((auditoria) => auditoria.autor_usuario_id)).toEqual([a.coordenacao.usuarioId])
  })

  it('RF9, permissão: professor, aluno e a coordenação sem segundo fator não leem nem confirmam; sem token, 401', async () => {
    const a = await escolaNova()
    expect((await registrar([secao(a)])).codigo).toBe(0)
    const [daA] = await secoesDe(a.id)
    const professor = await bancada.sessao(a.id, 'professor')
    const aluno = await bancada.sessao(a.id, 'aluno')
    const { rows } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [a.coordenacao.usuarioId])
    const desafio = await new EmissorDeDesafio(CHAVE).emitir({ contaId: rows[0]?.conta_id ?? randomUUID(), etapa: 'mfa', mfaCumprido: false })
    const rotas: Array<[string, string]> = [
      ['GET', '/v1/privacidade/incidentes'],
      ['POST', `/v1/privacidade/incidentes/${daA?.id}/confirmar`],
    ]
    for (const [verbo, caminho] of rotas) {
      const pedir = (token: string | undefined) => chamar(api.url, verbo, caminho, token, verbo === 'POST' ? {} : undefined)
      for (const [quem, sessao] of [['professor', professor], ['aluno', aluno]] as const) {
        const resposta = await pedir(await sessao.tokenNovo())
        expect({ status: resposta.status, codigo: resposta.corpo.erro?.codigo }, `${quem} ${verbo}`).toEqual({ status: 404, codigo: ErrorCode.NAO_ENCONTRADO })
      }
      expect((await pedir(desafio)).status, `sem segundo fator ${verbo}`).toBe(401)
      expect((await pedir(undefined)).status, `sem token ${verbo}`).toBe(401)
    }
    expect((await secoesDe(a.id))[0]?.confirmado_em).toBeNull()
    expect(await auditoriasDe(a.id, 'incidente.confirmado')).toEqual([])
    // O corpo a mais na confirmação é recusado, como o das outras rotas sem corpo.
    const comCorpo = await chamar(api.url, 'POST', `/v1/privacidade/incidentes/${daA?.id}/confirmar`, await a.coordenacao.tokenNovo(), { por: 'outra pessoa' })
    expect(comCorpo.status).toBe(400)
    expect((await secoesDe(a.id))[0]?.confirmado_em).toBeNull()
  })

  it('RF9, a eliminação de quem confirmou não apaga a seção: a data fica, e a pessoa vira nula', async () => {
    const a = await escolaNova()
    const outra = await bancada.sessao(a.id, 'coordenador')
    expect((await registrar([secao(a)])).codigo).toBe(0)
    const [daA] = await secoesDe(a.id)
    expect((await confirmar(a, daA?.id ?? '')).status).toBe(204)
    expect((await secoesDe(a.id))[0]?.confirmado_por).toBe(a.coordenacao.usuarioId)

    const servico = new CicloDeVidaService(bancada.banco)
    await executarNoContexto({ requisicaoId: randomUUID(), escolaId: a.id, usuarioId: outra.usuarioId, papel: 'coordenador' }, () => servico.eliminar(a.coordenacao.usuarioId))
    const [depois] = await secoesDe(a.id)
    expect(depois).toMatchObject({ id: daA?.id, confirmado_por: null })
    expect(depois?.confirmado_em).toBeInstanceOf(Date)
    // A auditoria da escola continua com o autor, pelo id.
    expect((await auditoriasDe(a.id, 'incidente.confirmado')).map((auditoria) => auditoria.autor_usuario_id)).toEqual([a.coordenacao.usuarioId])
    const resposta = await lista({ ...a, coordenacao: outra })
    expect(resposta.incidentes.map((incidente) => incidente.confirmadoEm !== null)).toEqual([true])
  })

  it('RF9, o expurgo leva o incidente com mais de 5 anos e as seções em cascata, e deixa o de cinco anos menos um dia', async () => {
    const a = await escolaNova()
    const agora = new Date()
    const velho = await bancada.pool.query<{ id: string }>(
      `insert into incidente (conhecido_em, registrado_por, registrado_em) values ($1::timestamptz - interval '5 years 1 day 2 hours', $2, $1::timestamptz - interval '5 years 1 day') returning id`,
      [agora.toISOString(), OPERADOR],
    )
    const novo = await bancada.pool.query<{ id: string }>(
      `insert into incidente (conhecido_em, registrado_por, registrado_em) values ($1::timestamptz - interval '5 years 1 day', $2, $1::timestamptz - interval '5 years' + interval '1 day') returning id`,
      [agora.toISOString(), OPERADOR],
    )
    const ids = [velho.rows[0]?.id ?? '', novo.rows[0]?.id ?? '']
    incidentes.push(...ids)
    for (const id of ids) {
      await bancada.pool.query(
        `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao) values ($1, $2, 'c', array['cadastro'], 1, 'baixo', 'c', 'c')`,
        [id, a.id],
      )
    }
    const apagadas = await new ExpurgoDeAcessoRepository(bancada.banco).apagarLoteVencido('incidente', agora)
    expect(apagadas).toBeGreaterThanOrEqual(1)
    const restam = async (tabela: 'incidente' | 'incidente_escola') =>
      (await bancada.pool.query<{ id: string }>(tabela === 'incidente' ? 'select id from incidente where id = any($1::uuid[])' : 'select incidente_id as id from incidente_escola where incidente_id = any($1::uuid[])', [ids])).rows.map((linha) => linha.id)
    expect(await restam('incidente')).toEqual([ids[1]])
    expect(await restam('incidente_escola')).toEqual([ids[1]])
  })
})
