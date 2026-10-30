import { CHAVES_DE_CATEGORIA_DO_SUBOPERADOR, ErrorCode, suboperadoresResponseSchema, FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR, type SuboperadoresResponse, type SuboperadorDaEscola } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { executarOpsSuboperador } from '../src/ops/suboperador.js'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { GatilhoDeParada, esperarNaTrava } from './gatilho-de-parada.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * Os suboperadores (F3, tarefa 8.0; `tasks/prd-lgpd-e-titular/cenarios.md`, RF6 e RF7): a operação cadastra e encerra pelo
 * `ops:suboperador`, que roda de verdade com o banco de operação que ele mesmo abre, e a coordenação lê pelo
 * `GET /v1/privacidade/suboperadores`, na API do teste. Postgres e Redis reais.
 *
 * `suboperador` é global e o banco acumula: toda chave é aleatória por teste, e as asserções olham só as chaves que o teste
 * criou (um suboperador `todas` de outro teste aparece em toda escola).
 */

const OPERADOR = 'operador-teste'
const AGORA = Math.floor(Date.now() / 1_000) * 1_000
const ambienteDeTeste = lerAmbienteDeTeste()
const TODAS_AS_CATEGORIAS = [...CHAVES_DE_CATEGORIA_DO_SUBOPERADOR].join(',')

interface Execucao {
  readonly codigo: number
  readonly saida: string
  readonly erro: string
}

interface LinhaDoSuboperador {
  id: string
  chave: string
  nome: string
  finalidade: string
  categorias: string[]
  pais: string
  contrato: string
  veda_treinamento: boolean
  alcance: string
  fim: Date | null
  registrado_por: string
}

interface AuditoriaDoSuboperador {
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

/** As chaves que o teste criou: a limpeza as apaga no fim, porque um suboperador `todas` aparece em toda escola, também nas telas do e2e. */
const CHAVES_CRIADAS: string[] = []
const chaveNova = () => {
  const chave = `sub-${randomUUID().slice(0, 8)}`
  CHAVES_CRIADAS.push(chave)
  return chave
}
/** O nome é único por teste: o da empresa que a tela mostra, e o que o e2e procura. */
const nomeNovo = () => `Empresa Sintética ${randomUUID().slice(0, 8)}`

describe('suboperadores: a operação cadastra e encerra por comando, e a coordenação lê os da escola (F3, tarefa 8.0)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const ambiente = { ...ambienteDeTeste, OPERADOR }
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    const dasChaves = `(select id from suboperador where chave = any($1::text[]))`
    await bancada.pool.query(`delete from auditoria where entidade = 'suboperador' and entidade_id in ${dasChaves}`, [CHAVES_CRIADAS])
    await bancada.pool.query(`delete from suboperador_escola where suboperador_id in ${dasChaves}`, [CHAVES_CRIADAS])
    await bancada.pool.query('delete from suboperador where chave = any($1::text[])', [CHAVES_CRIADAS])
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  async function rodar(argumentos: string[], doAmbiente: Record<string, string | undefined> = ambiente): Promise<Execucao> {
    let saida = ''
    let erro = ''
    const codigo = await executarOpsSuboperador(argumentos, doAmbiente, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
    return { codigo, saida, erro }
  }

  interface Opcoes {
    readonly chave?: string
    readonly nome?: string
    readonly alcance?: 'todas' | readonly string[]
    readonly categorias?: string
    readonly pais?: string
    readonly contrato?: string
    readonly veda?: 'sim' | 'nao'
  }

  /** O comando `cadastrar`, com um suboperador válido e o que o teste quiser mudar. */
  function cadastrar({ chave = chaveNova(), nome = nomeNovo(), alcance = 'todas', categorias = TODAS_AS_CATEGORIAS, pais = 'BR', contrato = 'DPA-2026-01', veda = 'sim' }: Opcoes = {}): Promise<Execucao> & { chave: string; nome: string } {
    const argumentos = [
      'cadastrar',
      '--chave', chave,
      '--nome', nome,
      '--finalidade', 'Hospedagem do banco e dos arquivos',
      '--pais', pais,
      '--categorias', categorias,
      '--contrato', contrato,
      '--veda-treinamento', veda,
      ...(alcance === 'todas' ? ['--todas'] : ['--escolas', alcance.join(',')]),
    ]
    return Object.assign(rodar(argumentos), { chave, nome })
  }

  const encerrar = (chave: string) => rodar(['encerrar', '--chave', chave])
  /** A data da escola é posta direto no banco, como o `update suboperador_escola` de `RF7, passado`: o código não a informa nem a altera. */
  const definirCriadaEm = (escolaId: string, criadaEm: Date) => bancada.pool.query('update escola set criada_em = $2 where id = $1', [escolaId, criadaEm])
  /** Relativo a um instante só, tirado uma vez: chamar `dias(-30)` duas vezes dá a mesma data, mesmo que o relógio mude de segundo no meio. */
  const dias = (n: number) => new Date(AGORA + n * 86_400_000)
  /** Um suboperador de "todas" com a vigência que o teste quiser, como o `insert` de `RF7, a ordem`. */
  async function inserirDeTodas(inicio: Date, fim: Date | null): Promise<{ chave: string; nome: string }> {
    const chave = chaveNova()
    const nome = nomeNovo()
    await bancada.pool.query(
      `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, inicio, fim, registrado_por)
       values ($1, $2, 'Hospedagem', array['cadastro'], 'BR', 'DPA-1', true, 'todas', $3, $4, $5)`,
      [chave, nome, inicio, fim, OPERADOR],
    )
    return { chave, nome }
  }
  const idDoCadastro = (execucao: Execucao) => (JSON.parse(execucao.saida) as { suboperadorId: string }).suboperadorId

  async function linhasDa(chave: string): Promise<LinhaDoSuboperador[]> {
    const { rows } = await bancada.pool.query<LinhaDoSuboperador>(
      'select id, chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, fim, registrado_por from suboperador where chave = $1 order by inicio, id',
      [chave],
    )
    return rows
  }

  async function ligacoesDe(suboperadorId: string): Promise<Array<{ escola_id: string; fim: Date | null }>> {
    const { rows } = await bancada.pool.query<{ escola_id: string; fim: Date | null }>('select escola_id, fim from suboperador_escola where suboperador_id = $1 order by escola_id', [suboperadorId])
    return rows
  }

  async function auditoriasDe(suboperadorId: string): Promise<AuditoriaDoSuboperador[]> {
    const { rows } = await bancada.pool.query<AuditoriaDoSuboperador>(
      `select acao, escola_id, entidade, entidade_id, autor_operador, autor_usuario_id, antes, depois, finalidade from auditoria where entidade = 'suboperador' and entidade_id = $1 order by em, acao desc`,
      [suboperadorId],
    )
    return rows
  }

  async function dosSuboperadores(coordenacao: SessaoDeTeste): Promise<SuboperadoresResponse> {
    const resposta = await chamar(api.url, 'GET', '/v1/privacidade/suboperadores', await coordenacao.tokenNovo())
    expect(resposta.status).toBe(200)
    return suboperadoresResponseSchema.parse(resposta.corpo)
  }

  /** O que a escola lê das chaves que o teste criou: um suboperador `todas` de outro teste não entra na conta. */
  async function leitura(coordenacao: SessaoDeTeste, ...chaves: string[]): Promise<SuboperadorDaEscola[]> {
    return (await dosSuboperadores(coordenacao)).suboperadores.filter((lido) => chaves.includes(lido.chave))
  }

  it('RF6: cadastrar grava a empresa com o que o comando disse e a auditoria da operação; encerrar a deixa no histórico; a chave encerrada se cadastra de novo', async () => {
    const primeiro = cadastrar({ categorias: 'cadastro,conversa_do_aluno', pais: 'US', contrato: 'DPA-2026/03', veda: 'nao' })
    const feito = await primeiro
    expect({ codigo: feito.codigo, erro: feito.erro }).toEqual({ codigo: 0, erro: '' })
    const id = idDoCadastro(feito)
    expect(JSON.parse(feito.saida)).toEqual({ suboperadorId: id, escolas: 0 })
    expect(await linhasDa(primeiro.chave)).toEqual([
      {
        id,
        chave: primeiro.chave,
        nome: primeiro.nome,
        finalidade: 'Hospedagem do banco e dos arquivos',
        categorias: ['cadastro', 'conversa_do_aluno'],
        pais: 'US',
        contrato: 'DPA-2026/03',
        veda_treinamento: false,
        alcance: 'todas',
        fim: null,
        registrado_por: OPERADOR,
      },
    ])
    expect(await ligacoesDe(id)).toEqual([])

    const encerrado = await encerrar(primeiro.chave)
    expect({ codigo: encerrado.codigo, erro: encerrado.erro }).toEqual({ codigo: 0, erro: '' })
    expect(JSON.parse(encerrado.saida)).toEqual({ suboperadorId: id, ligacoesEncerradas: 0 })
    const depois = await linhasDa(primeiro.chave)
    expect(depois).toHaveLength(1)
    expect(depois[0]?.fim).toBeInstanceOf(Date)
    expect(depois[0]).toMatchObject({ id, nome: primeiro.nome })

    // A auditoria da operação: sem escola, com o autor, e só o alcance e contagens. Nunca a chave, o nome nem o contrato.
    const auditorias = await auditoriasDe(id)
    expect(auditorias).toEqual([
      {
        acao: 'suboperador.cadastrado',
        escola_id: null,
        entidade: 'suboperador',
        entidade_id: id,
        autor_operador: OPERADOR,
        autor_usuario_id: null,
        antes: null,
        depois: { alcance: 'todas', escolas: 0 },
        finalidade: FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
      },
      {
        acao: 'suboperador.encerrado',
        escola_id: null,
        entidade: 'suboperador',
        entidade_id: id,
        autor_operador: OPERADOR,
        autor_usuario_id: null,
        antes: { alcance: 'todas' },
        depois: { ligacoesEncerradas: 0 },
        finalidade: FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
      },
    ])
    expect(JSON.stringify(auditorias)).not.toContain(primeiro.nome)
    expect(JSON.stringify(auditorias)).not.toContain(primeiro.chave)
    expect(JSON.stringify(auditorias)).not.toContain('DPA-2026/03')

    // Encerrar de novo não acha vigente; a chave encerrada se cadastra outra vez, e as duas linhas ficam.
    const repetido = await encerrar(primeiro.chave)
    expect({ codigo: repetido.codigo, saida: repetido.saida }).toEqual({ codigo: 1, saida: '' })
    expect(repetido.erro).toMatch(new RegExp(`^${ErrorCode.NAO_ENCONTRADO}:`))
    expect(await auditoriasDe(id)).toHaveLength(2)

    const outra = await cadastrar({ chave: primeiro.chave })
    expect(outra.codigo).toBe(0)
    const linhas = await linhasDa(primeiro.chave)
    expect(linhas.map((linha) => linha.fim === null)).toEqual([false, true])
    expect(linhas[1]?.id).toBe(idDoCadastro(outra))
    await encerrar(primeiro.chave)
  })

  it('RF6, lista: a ligação nasce em cada escola listada (repetida ou em maiúscula conta uma vez), a auditoria conta as escolas, e encerrar fecha as ligações junto', async () => {
    const [a, b, c] = [await bancada.escola(), await bancada.escola(), await bancada.escola()]
    const lista = cadastrar({ alcance: [a, b, a.toUpperCase()] })
    const cadastro = await lista
    expect({ codigo: cadastro.codigo, erro: cadastro.erro }).toEqual({ codigo: 0, erro: '' })
    const id = idDoCadastro(cadastro)
    expect(JSON.parse(cadastro.saida)).toEqual({ suboperadorId: id, escolas: 2 })
    const ligadas = await ligacoesDe(id)
    // A escola de fora da lista não ganha ligação.
    expect(ligadas.map((ligacao) => ligacao.escola_id).sort()).toEqual([a, b].sort())
    expect(ligadas.every((ligacao) => ligacao.fim === null)).toBe(true)
    expect(ligadas.map((ligacao) => ligacao.escola_id)).not.toContain(c)
    expect((await auditoriasDe(id))[0]?.depois).toEqual({ alcance: 'lista', escolas: 2 })
    expect(JSON.stringify(await auditoriasDe(id))).not.toContain(a)

    // Outro suboperador da mesma escola: encerrar o primeiro não toca nas ligações dele.
    const outro = cadastrar({ alcance: [a] })
    const idDoOutro = idDoCadastro(await outro)

    const encerrado = await encerrar(lista.chave)
    expect(JSON.parse(encerrado.saida)).toEqual({ suboperadorId: id, ligacoesEncerradas: 2 })
    expect((await ligacoesDe(id)).every((ligacao) => ligacao.fim instanceof Date)).toBe(true)
    expect((await auditoriasDe(id))[1]?.depois).toEqual({ ligacoesEncerradas: 2 })
    expect(await ligacoesDe(idDoOutro)).toEqual([{ escola_id: a, fim: null }])
    await encerrar(outro.chave)
  })

  it('RF6: já há vigente com a chave dá CONFLITO sem gravar nada; escola inexistente na lista dá NAO_ENCONTRADO e desfaz a ligação das que existem', async () => {
    const vigente = cadastrar()
    const id = idDoCadastro(await vigente)
    const igual = await cadastrar({ chave: vigente.chave })
    expect({ codigo: igual.codigo, saida: igual.saida }).toEqual({ codigo: 1, saida: '' })
    expect(igual.erro).toMatch(new RegExp(`^${ErrorCode.CONFLITO}:`))
    expect((await linhasDa(vigente.chave)).map((linha) => linha.id)).toEqual([id])
    expect(await auditoriasDe(id)).toHaveLength(1)

    const existente = await bancada.escola()
    const chave = chaveNova()
    const inexistente = await cadastrar({ chave, alcance: [existente, randomUUID()] })
    expect({ codigo: inexistente.codigo, saida: inexistente.saida }).toEqual({ codigo: 1, saida: '' })
    expect(inexistente.erro).toMatch(new RegExp(`^${ErrorCode.NAO_ENCONTRADO}:`))
    expect(await linhasDa(chave)).toEqual([])
    const { rows } = await bancada.pool.query('select 1 from suboperador_escola where escola_id = $1', [existente])
    expect(rows).toEqual([])
    await encerrar(vigente.chave)
  })

  it('RF7, isolamento: B não vê o suboperador "lista" que atende só A e vê o de "todas"; o que atende só B não aparece em A, mesmo com A tendo outra ligação', async () => {
    const a = await bancada.escolaComSessao('coordenador')
    const b = await bancada.escolaComSessao('coordenador')
    const c = await bancada.escolaComSessao('coordenador')
    const soDeA = cadastrar({ alcance: [a.escolaId] })
    const soDeB = cadastrar({ alcance: [b.escolaId] })
    const deTodas = cadastrar({ alcance: 'todas' })
    await Promise.all([soDeA, soDeB, deTodas])
    const chaves = [soDeA.chave, soDeB.chave, deTodas.chave]

    expect((await leitura(a, ...chaves)).map((lido) => lido.nome).sort()).toEqual([soDeA.nome, deTodas.nome].sort())
    expect((await leitura(b, ...chaves)).map((lido) => lido.nome).sort()).toEqual([soDeB.nome, deTodas.nome].sort())
    // Uma terceira escola, sem ligação nenhuma, só vê o de "todas".
    expect((await leitura(c, ...chaves)).map((lido) => lido.nome)).toEqual([deTodas.nome])
    for (const chave of chaves) await encerrar(chave)
  })

  it('RF7, passado: o encerrado aparece com o fim; a escola que saiu da lista o vê como passado e a outra o vê vigente; o recadastrado vem antes do antigo', async () => {
    const a = await bancada.escolaComSessao('coordenador')
    const b = await bancada.escolaComSessao('coordenador')
    const naLista = cadastrar({ alcance: [a.escolaId, b.escolaId] })
    const id = idDoCadastro(await naLista)
    const deTodas = cadastrar({ alcance: 'todas' })
    await deTodas

    expect((await leitura(a, naLista.chave, deTodas.chave)).map((lido) => lido.fim)).toEqual([null, null])
    // A ligação de A termina e o suboperador segue: para A é passado, para B continua vigente.
    const fimDeA = new Date(Date.now() - 3_600_000)
    await bancada.pool.query(`update suboperador_escola set inicio = $3::timestamptz - interval '1 hour', fim = $3 where suboperador_id = $1 and escola_id = $2`, [id, a.escolaId, fimDeA])
    expect((await leitura(a, naLista.chave))[0]?.fim).toBe(fimDeA.toISOString())
    expect((await leitura(b, naLista.chave))[0]?.fim).toBeNull()

    // O suboperador encerrado: passado para as duas, e o de "todas" também. Só a ligação de B estava aberta, e a de A não muda.
    const encerrado = await encerrar(naLista.chave)
    expect(JSON.parse(encerrado.saida)).toEqual({ suboperadorId: id, ligacoesEncerradas: 1 })
    expect((await ligacoesDe(id)).find((ligacao) => ligacao.escola_id === a.escolaId)?.fim?.toISOString()).toBe(fimDeA.toISOString())
    await encerrar(deTodas.chave)
    for (const coordenacao of [a, b]) {
      expect((await leitura(coordenacao, naLista.chave, deTodas.chave)).every((lido) => lido.fim !== null)).toBe(true)
    }

    // A mesma chave cadastrada de novo, com o mesmo nome: a escola lê a vigente antes da encerrada.
    const outra = await cadastrar({ chave: deTodas.chave, nome: deTodas.nome })
    expect(outra.codigo).toBe(0)
    expect((await leitura(a, deTodas.chave)).map((lido) => lido.fim === null)).toEqual([true, false])
    await encerrar(deTodas.chave)
  })

  it('RF7, vigência da escola: o início é o da ligação quando há; o fim é o mais cedo entre a ligação e o suboperador', async () => {
    const a = await bancada.escolaComSessao('coordenador')
    const lista = cadastrar({ alcance: [a.escolaId] })
    const id = idDoCadastro(await lista)
    const [inicioDoSuboperador, inicioDaLigacao, fimCedo, fimTarde] = [dias(-30), dias(-20), dias(5), dias(10)]
    const gravar = (sql: string, valor: Date) => bancada.pool.query(sql, [valor, id])
    await gravar('update suboperador set inicio = $1 where id = $2', inicioDoSuboperador)
    await gravar('update suboperador_escola set inicio = $1 where suboperador_id = $2', inicioDaLigacao)

    // O fim da ligação vem antes do fim do suboperador: vale o da ligação; invertidos, vale o do suboperador.
    await gravar('update suboperador set fim = $1 where id = $2', fimTarde)
    await gravar('update suboperador_escola set fim = $1 where suboperador_id = $2', fimCedo)
    let lido = (await leitura(a, lista.chave))[0]
    expect({ inicio: lido?.inicio, fim: lido?.fim }).toEqual({ inicio: inicioDaLigacao.toISOString(), fim: fimCedo.toISOString() })
    await gravar('update suboperador set fim = $1 where id = $2', fimCedo)
    await gravar('update suboperador_escola set fim = $1 where suboperador_id = $2', fimTarde)
    lido = (await leitura(a, lista.chave))[0]
    expect(lido?.fim).toBe(fimCedo.toISOString())
    // Só o suboperador com fim, ou só a ligação com fim: cada um vale sozinho.
    await bancada.pool.query('update suboperador_escola set fim = null where suboperador_id = $1', [id])
    expect((await leitura(a, lista.chave))[0]?.fim).toBe(fimCedo.toISOString())
    await bancada.pool.query('update suboperador set fim = null where id = $1', [id])
    await gravar('update suboperador_escola set fim = $1 where suboperador_id = $2', fimTarde)
    expect((await leitura(a, lista.chave))[0]?.fim).toBe(fimTarde.toISOString())

    // O suboperador de "todas" não tem ligação: o início é o dele, quando a escola é mais antiga que ele (a escola mais nova que
    // ele lê o `criada_em` dela: `RF7, a vigência nunca é anterior à escola`).
    await definirCriadaEm(a.escolaId, dias(-40))
    const deTodas = cadastrar({ alcance: 'todas' })
    const idDeTodas = idDoCadastro(await deTodas)
    await bancada.pool.query('update suboperador set inicio = $1 where id = $2', [inicioDoSuboperador, idDeTodas])
    expect((await leitura(a, deTodas.chave))[0]?.inicio).toBe(inicioDoSuboperador.toISOString())
    await encerrar(deTodas.chave)
    await encerrar(lista.chave)
  })

  it('RF7, a vigência nunca é anterior à escola: o "todas" encerrado antes de ela existir não aparece, e aparece como passado para a que já existia', async () => {
    const [antiga, nova, nolimite] = [await bancada.escolaComSessao('coordenador'), await bancada.escolaComSessao('coordenador'), await bancada.escolaComSessao('coordenador')]
    await definirCriadaEm(antiga.escolaId, dias(-90))
    await definirCriadaEm(nova.escolaId, dias(-40))
    await definirCriadaEm(nolimite.escolaId, dias(-55))
    const encerrada = await inserirDeTodas(dias(-60), dias(-50))

    // A que já existia recebeu: passado, com a vigência da empresa.
    expect(await leitura(antiga, encerrada.chave)).toMatchObject([{ nome: encerrada.nome, inicio: dias(-60).toISOString(), fim: dias(-50).toISOString() }])
    // A que nasceu depois de a empresa sair nunca recebeu dado dela: a empresa nem aparece.
    expect(await leitura(nova, encerrada.chave)).toEqual([])
    // A que nasceu no meio da vigência lê a vigência a partir do dia em que passou a existir.
    expect(await leitura(nolimite, encerrada.chave)).toMatchObject([{ inicio: dias(-55).toISOString(), fim: dias(-50).toISOString() }])
  })

  it('RF7, a vigência nunca é anterior à escola: o "todas" vigente cadastrado antes dela começa para ela no dia em que ela existiu', async () => {
    const [antiga, nova] = [await bancada.escolaComSessao('coordenador'), await bancada.escolaComSessao('coordenador')]
    await definirCriadaEm(antiga.escolaId, dias(-45))
    await definirCriadaEm(nova.escolaId, dias(-10))
    const vigente = await inserirDeTodas(dias(-30), null)

    // Para a escola mais antiga que a empresa, o início é o da empresa; para a mais nova, o `criada_em` dela.
    expect((await leitura(antiga, vigente.chave)).map((lido) => ({ inicio: lido.inicio, fim: lido.fim }))).toEqual([{ inicio: dias(-30).toISOString(), fim: null }])
    expect((await leitura(nova, vigente.chave)).map((lido) => ({ inicio: lido.inicio, fim: lido.fim }))).toEqual([{ inicio: dias(-10).toISOString(), fim: null }])
  })

  it('RF7, a vigência nunca é anterior à escola: o "lista" não muda, nem o início nem a presença da linha, mesmo com o fim da empresa anterior ao dia em que a escola existiu', async () => {
    const nova = await bancada.escolaComSessao('coordenador')
    await definirCriadaEm(nova.escolaId, dias(-10))
    const lista = cadastrar({ alcance: [nova.escolaId] })
    const id = idDoCadastro(await lista)
    // A escola é "mais nova" que a ligação e que o fim da empresa, de propósito: com a ligação, nada é empurrado para o `criada_em`
    // nem escondido por ele. O `inicio` da empresa vem antes do fim dela (`suboperador_vigencia_ordenada`).
    await bancada.pool.query('update suboperador_escola set inicio = $1, fim = $2 where suboperador_id = $3', [dias(-20), dias(-15), id])
    await bancada.pool.query('update suboperador set inicio = $1, fim = $2 where id = $3', [dias(-30), dias(-12), id])
    // Ficam o início da ligação e o fim mais cedo entre os dois (-15, o da ligação). Sem o `ne(alcance, 'todas')` do repositório,
    // o `fim` da empresa (-12) é anterior ao `criada_em` (-10) e a linha some.
    expect((await leitura(nova, lista.chave)).map((lido) => ({ inicio: lido.inicio, fim: lido.fim }))).toEqual([{ inicio: dias(-20).toISOString(), fim: dias(-15).toISOString() }])
  })

  it('RF7, a vigência nunca é anterior à escola, borda: o fim igual ao dia em que ela existiu fica fora; um segundo depois aparece como passado, a partir desse dia', async () => {
    const [igual, umSegundoDepois] = [await bancada.escolaComSessao('coordenador'), await bancada.escolaComSessao('coordenador')]
    const fim = dias(-50)
    await definirCriadaEm(igual.escolaId, fim)
    await definirCriadaEm(umSegundoDepois.escolaId, new Date(fim.getTime() - 1_000))
    const encerrada = await inserirDeTodas(dias(-60), fim)

    expect(await leitura(igual, encerrada.chave)).toEqual([])
    expect((await leitura(umSegundoDepois, encerrada.chave)).map((lido) => ({ inicio: lido.inicio, fim: lido.fim }))).toEqual([
      { inicio: new Date(fim.getTime() - 1_000).toISOString(), fim: fim.toISOString() },
    ])
  })

  it('RF7, o que a escola lê: só os campos do DTO, ordenados pelo nome, sem id, contrato, operador nem escola; resposta sem cache', async () => {
    const coordenacao = await bancada.escolaComSessao('coordenador')
    // Alfa nasce antes de Zeta: a ordem pelo nome não é a de criação.
    const alfa = cadastrar({ nome: `Alfa ${randomUUID().slice(0, 8)}`, alcance: [coordenacao.escolaId], pais: 'US', veda: 'nao' })
    const idDeAlfa = idDoCadastro(await alfa)
    const zeta = cadastrar({ nome: `Zeta ${randomUUID().slice(0, 8)}`, contrato: 'CONTRATO-SIGILOSO-7', pais: 'BR', categorias: 'cadastro,material_da_escola' })
    const idDeZeta = idDoCadastro(await zeta)

    const resposta = await chamar(api.url, 'GET', '/v1/privacidade/suboperadores', await coordenacao.tokenNovo())
    expect(resposta.status).toBe(200)
    const nossos = suboperadoresResponseSchema.parse(resposta.corpo).suboperadores.filter((lido) => [zeta.chave, alfa.chave].includes(lido.chave))
    expect(nossos.map((lido) => lido.nome)).toEqual([alfa.nome, zeta.nome])
    expect(nossos[0]).toMatchObject({ chave: alfa.chave, finalidade: 'Hospedagem do banco e dos arquivos', pais: 'US', vedaTreinamento: false, fim: null })
    expect(nossos[1]).toMatchObject({ pais: 'BR', vedaTreinamento: true, categorias: ['cadastro', 'material_da_escola'] })
    const corpo = resposta.corpo as { suboperadores: Array<Record<string, unknown>> }
    for (const lido of corpo.suboperadores) expect(Object.keys(lido).sort()).toEqual(['categorias', 'chave', 'fim', 'finalidade', 'inicio', 'nome', 'pais', 'vedaTreinamento'])
    const texto = JSON.stringify(resposta.corpo)
    for (const reservado of ['CONTRATO-SIGILOSO-7', OPERADOR, idDeZeta, idDeAlfa, coordenacao.escolaId]) expect(texto).not.toContain(reservado)
    const direta = await fetch(`${api.url}/v1/privacidade/suboperadores`, { headers: { Authorization: `Bearer ${await coordenacao.tokenNovo()}` } })
    expect(direta.headers.get('cache-control')).toBe('no-store')
    await encerrar(zeta.chave)
    await encerrar(alfa.chave)
  })

  it('RF7, a ordem: pelo nome e, no mesmo nome, do mais recente ao mais antigo, qualquer que seja a ordem em que foram gravados', async () => {
    const coordenacao = await bancada.escolaComSessao('coordenador')
    const chave = chaveNova()
    const nome = nomeNovo()
    // A escola é anterior às duas vigências: senão a regra "nunca anterior à escola" tira as duas linhas da leitura.
    await definirCriadaEm(coordenacao.escolaId, dias(-90))
    // O mais antigo é gravado primeiro: a ordem de gravação é a contrária da que a escola deve ler.
    for (const [inicio, fim] of [[dias(-60), dias(-50)], [dias(-30), dias(-20)]] as const) {
      await bancada.pool.query(
        `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, inicio, fim, registrado_por)
         values ($1, $2, 'Hospedagem', array['cadastro'], 'BR', 'DPA-1', true, 'todas', $3, $4, $5)`,
        [chave, nome, inicio, fim, OPERADOR],
      )
    }
    expect((await leitura(coordenacao, chave)).map((lido) => lido.inicio)).toEqual([dias(-30).toISOString(), dias(-60).toISOString()])
  })

  it('concorrência: dois cadastros da mesma chave ao mesmo tempo deixam um só, e o outro dá CONFLITO sem erro cru', async () => {
    const chave = chaveNova()
    const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'suboperador', evento: 'insert', quando: `new.chave = '${chave}'` })
    await gatilho.armar()
    let resultados: Execucao[]
    try {
      const primeiro = cadastrar({ chave })
      await gatilho.esperarParadas()
      // O primeiro já inseriu e segura a chave no índice único: o segundo espera nele, antes de decidir. Sem o índice
      // único, o segundo não esperaria e a corrida acabaria por ele, com duas linhas vigentes.
      const segundo = cadastrar({ chave })
      await esperarNaTrava(bancada.pool, '%on conflict%', 2)
      await gatilho.soltar()
      resultados = await Promise.all([primeiro, segundo])
    } finally {
      await gatilho.desarmar()
    }
    expect(resultados.map(({ codigo }) => codigo)).toEqual([0, 1])
    expect(resultados[1]?.erro).toMatch(new RegExp(`^${ErrorCode.CONFLITO}:`))
    const linhas = await linhasDa(chave)
    expect(linhas).toHaveLength(1)
    expect(await auditoriasDe(linhas[0]?.id ?? '')).toHaveLength(1)
    await encerrar(chave)
  })

  it('concorrência: dois encerramentos da mesma chave passam um de cada vez, e o segundo não acha vigente', async () => {
    const lista = cadastrar({ alcance: [await bancada.escola()] })
    const id = idDoCadastro(await lista)
    const gatilho = new GatilhoDeParada(bancada.pool, { tabela: 'suboperador', evento: 'update', quando: `new.id = '${id}'` })
    await gatilho.armar()
    let resultados: Execucao[]
    try {
      const primeiro = encerrar(lista.chave)
      await gatilho.esperarParadas()
      // O primeiro já encerrou e segura a linha: o segundo espera na trava dela (`for no key update`), antes de ler o vigente.
      const segundo = encerrar(lista.chave)
      await esperarNaTrava(bancada.pool, '%for no key update%')
      await gatilho.soltar()
      resultados = await Promise.all([primeiro, segundo])
    } finally {
      await gatilho.desarmar()
    }
    expect(resultados.map(({ codigo }) => codigo)).toEqual([0, 1])
    expect(resultados[1]?.erro).toMatch(new RegExp(`^${ErrorCode.NAO_ENCONTRADO}:`))
    expect((await auditoriasDe(id)).map((auditoria) => auditoria.acao)).toEqual(['suboperador.cadastrado', 'suboperador.encerrado'])
  })

  it('argumento fora do formato, ou sem OPERADOR, recusa antes de tocar no banco, citando só a opção', async () => {
    const chave = chaveNova()
    const base = ['--chave', chave, '--nome', 'Empresa Sintética', '--finalidade', 'Hospedagem', '--pais', 'BR', '--categorias', 'cadastro', '--contrato', 'DPA-1', '--veda-treinamento', 'sim', '--todas']
    const trocar = (opcao: string, valor: string) => base.map((item, indice) => (base[indice - 1] === opcao ? valor : item))
    const sem = (opcao: string) => base.filter((item, indice) => item !== opcao && base[indice - 1] !== opcao)
    const casos: Array<[string[], string]> = [
      [['apagar', '--chave', chave], 'comando (cadastrar | encerrar)'],
      [['cadastrar', ...trocar('--chave', 'Chave Maiúscula')], '--chave'],
      [['cadastrar', ...sem('--nome')], '--nome'],
      [['cadastrar', ...trocar('--nome', 'duas\nlinhas')], '--nome'],
      [['cadastrar', ...trocar('--nome', '   ')], '--nome'],
      [['cadastrar', ...trocar('--nome', 'Empresa\tSintética')], '--nome'],
      [['cadastrar', ...trocar('--finalidade', 'Hospedagem\u0007')], '--finalidade'],
      [['cadastrar', ...trocar('--finalidade', 'x'.repeat(301))], '--finalidade'],
      [['cadastrar', ...trocar('--pais', 'br')], '--pais'],
      [['cadastrar', ...trocar('--categorias', 'cadastro,inventada')], '--categorias'],
      [['cadastrar', ...trocar('--contrato', 'contrato da Maria')], '--contrato'],
      [['cadastrar', ...trocar('--veda-treinamento', 'talvez')], '--veda-treinamento'],
      [['cadastrar', ...sem('--veda-treinamento')], '--veda-treinamento'],
      [['cadastrar', ...base.filter((item) => item !== '--todas')], '--todas ou --escolas, um dos dois'],
      [['cadastrar', ...base, '--escolas', randomUUID()], '--todas ou --escolas, um dos dois'],
      [['cadastrar', ...base.filter((item) => item !== '--todas'), '--escolas', 'escola-a'], '--escolas'],
      [['cadastrar', ...base.filter((item) => item !== '--todas'), '--escolas', Array.from({ length: 201 }, () => randomUUID()).join(',')], '--escolas'],
      [['encerrar', '--chave', chave, '--nome', 'Outra'], 'só --chave vale para encerrar'],
      [['encerrar'], '--chave'],
    ]
    for (const [argumentos, opcao] of casos) {
      const execucao = await rodar(argumentos)
      expect(execucao, opcao).toEqual({ codigo: 2, saida: '', erro: `Opção inválida ou ausente: ${opcao}\n` })
    }
    const desconhecida = await rodar(['cadastrar', ...base, '--inventada', 'x'])
    expect({ codigo: desconhecida.codigo, saida: desconhecida.saida }).toEqual({ codigo: 2, saida: '' })
    expect(desconhecida.erro).not.toContain('inventada')
    const semOperador = await rodar(['cadastrar', ...base], { ...ambiente, OPERADOR: undefined })
    expect(semOperador.codigo).toBe(2)
    expect(semOperador.erro).toContain('OPERADOR')
    expect(await linhasDa(chave)).toEqual([])
  })

  it('banco: recusa, por fora do comando, o que o comando já recusa; uma vigente por chave; e a lista de categorias é a do contrato', async () => {
    const chave = chaveNova()
    const valida = { chave, nome: 'Empresa', finalidade: 'Hospedagem', categorias: ['cadastro'], pais: 'BR', contrato: 'DPA-1', veda: true, alcance: 'todas', operador: OPERADOR }
    const inserir = (linha: typeof valida, colunasExtras = '', valoresExtras: unknown[] = []) =>
      bancada.pool.query(
        `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, registrado_por${colunasExtras}) values ($1, $2, $3, $4, $5, $6, $7, $8, $9${valoresExtras.map((_, i) => `, $${10 + i}`).join('')})`,
        [linha.chave, linha.nome, linha.finalidade, linha.categorias, linha.pais, linha.contrato, linha.veda, linha.alcance, linha.operador, ...valoresExtras],
      )
    for (const [restricao, linha] of [
      ['suboperador_chave_formato', { ...valida, chave: 'Chave Maiúscula' }],
      ['suboperador_nome_tamanho', { ...valida, nome: '' }],
      ['suboperador_finalidade_tamanho', { ...valida, finalidade: 'x'.repeat(301) }],
      ['suboperador_pais_formato', { ...valida, pais: 'br' }],
      ['suboperador_contrato_formato', { ...valida, contrato: 'contrato da Maria' }],
      ['suboperador_categorias_validas', { ...valida, categorias: [] }],
      ['suboperador_categorias_validas', { ...valida, categorias: ['cadastro', 'diagnostico'] }],
      ['suboperador_alcance_valido', { ...valida, alcance: 'algumas' }],
      ['suboperador_registrado_por_formato', { ...valida, operador: 'Operador Teste' }],
    ] as const) {
      await expect(inserir({ ...linha, categorias: [...linha.categorias] }), restricao).rejects.toMatchObject({ code: '23514', constraint: restricao })
    }
    await expect(inserir(valida, ', inicio, fim', [new Date('2026-10-02'), new Date('2026-10-01')]), 'fim antes do início').rejects.toMatchObject({ code: '23514', constraint: 'suboperador_vigencia_ordenada' })

    await inserir(valida)
    await expect(inserir(valida), 'duas vigentes').rejects.toMatchObject({ code: '23505', constraint: 'suboperador_chave_vigente_idx' })
    await bancada.pool.query('update suboperador set fim = now() where chave = $1', [chave])
    await inserir(valida)
    expect((await linhasDa(chave)).filter((linha) => linha.fim === null)).toHaveLength(1)
    await encerrar(chave)

    const { rows } = await bancada.pool.query<{ definicao: string }>(`select pg_get_constraintdef(oid) as definicao from pg_constraint where conname = 'suboperador_categorias_validas'`)
    expect(rows).toHaveLength(1)
    const literais = [...(rows[0]?.definicao ?? '').matchAll(/'(\w+)'/g)].map((literal) => literal[1])
    expect(literais.toSorted()).toEqual([...CHAVES_DE_CATEGORIA_DO_SUBOPERADOR].toSorted())
  })

  it('banco: a ligação recusa escola ou suboperador inexistente, a escola repetida e a vigência invertida', async () => {
    const escolaId = await bancada.escola()
    const lista = cadastrar({ alcance: [escolaId] })
    const id = idDoCadastro(await lista)
    const ligar = (escola: string, suboperadorId: string) => bancada.pool.query('insert into suboperador_escola (escola_id, suboperador_id) values ($1, $2)', [escola, suboperadorId])
    await expect(ligar(escolaId, id), 'a mesma escola duas vezes').rejects.toMatchObject({ code: '23505', constraint: 'suboperador_escola_pk' })
    await expect(ligar(randomUUID(), id), 'escola inexistente').rejects.toMatchObject({ code: '23503', constraint: 'suboperador_escola_escola_id_escola_id_fk' })
    await expect(ligar(escolaId, randomUUID()), 'suboperador inexistente').rejects.toMatchObject({ code: '23503', constraint: 'suboperador_escola_suboperador_id_suboperador_id_fk' })
    await expect(bancada.pool.query(`update suboperador_escola set fim = inicio - interval '1 day' where suboperador_id = $1`, [id]), 'fim antes do início').rejects.toMatchObject({
      code: '23514',
      constraint: 'suboperador_escola_vigencia_ordenada',
    })
    await encerrar(lista.chave)
  })
})
