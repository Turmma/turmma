import { createPool, type DatabasePool } from '@educa/core'
import { CHAVES_DE_RETENCAO } from '@educa/shared'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste } from '../../../tools/ci/compose.ts'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { CHAVE_DA_TRAVA_DOS_OPERADORES } from '../src/operacao/operador/operador.repository.js'
import type { BancoDoComando, SaidaDoComando } from '../src/ops/command.js'
import { executarOpsConviteCoordenador } from '../src/ops/convite-coordenador.js'
import { executarOpsEscola } from '../src/ops/escola.js'
import { executarOpsIncidente } from '../src/ops/incidente.js'
import { executarOpsOperador } from '../src/ops/operador.js'
import { executarOpsPrivacidade } from '../src/ops/privacidade.js'
import { executarOpsRedefinirMfa } from '../src/ops/redefinir-mfa.js'
import { executarOpsRetencao } from '../src/ops/retencao.js'
import { executarOpsRevogarAcessosSala } from '../src/ops/revogar-acessos-sala.js'
import { executarOpsRevogarConvite } from '../src/ops/revogar-convite.js'
import { executarOpsSuboperador } from '../src/ops/suboperador.js'
import { executarOpsUso } from '../src/ops/uso.js'
import { subirApi, type ApiDeTeste } from './test-api.js'
import { FerramentasDaSala, type SalaDeTeste } from './sala.fixture.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

type Comando = (argumentos: string[], ambiente: Record<string, string | undefined>, terminal: SaidaDoComando, abrirBanco?: (ambiente: Record<string, string | undefined>) => BancoDoComando) => Promise<number>

interface Execucao {
  codigo: number
  saida: string
  erro: string
}

const RECUSA_DO_OPERADOR = 'OPERADOR não é um operador ativo da equipe\n'
const ambienteBase = lerAmbienteDeTeste()

async function rodarComando(comando: Comando, argumentos: string[], operador: string): Promise<Execucao> {
  let saida = ''
  let erro = ''
  const codigo = await comando(argumentos, { ...ambienteBase, OPERADOR: operador }, { saida: (texto) => (saida += texto), erro: (texto) => (erro += texto) })
  return { codigo, saida, erro }
}

const rodar = (argumentos: string[], operador: string) => rodarComando(executarOpsOperador, argumentos, operador)

/** Chaves de suboperador do C2, novas a cada execução: o banco acumula, e `suboperador` é global. */
const CHAVE_DO_C2_CADASTRO = `c2-${randomUUID().slice(0, 8)}`
const CHAVE_DO_C2_ENCERRAMENTO = `c2-${randomUUID().slice(0, 8)}`

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex')

describe('npm run ops:operador: o operador nasce, é reconvidado e é desativado só por comando', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'ops-operador-int-'))
  const redes: string[] = []
  let pool: DatabasePool
  let arquivos = 0

  const arquivoNovo = () => join(pasta, `token-${++arquivos}.txt`)
  const nomeDe = (apelido: string) => `Pessoa Sintética ${apelido}`
  const emailDe = (apelido: string) => `${apelido}@turmma.invalid`

  /** `criar` pelo comando; devolve o id, o convite e o arquivo do token. */
  async function criar(apelido: string, operador: string): Promise<{ operadorId: string; conviteId: string; arquivo: string }> {
    const execucao = await rodar(['criar', '--apelido', apelido, '--nome', nomeDe(apelido), '--email', emailDe(apelido), '--saida', arquivoNovo()], operador)
    expect(execucao).toMatchObject({ codigo: 0, erro: '' })
    return JSON.parse(execucao.saida) as { operadorId: string; conviteId: string; arquivo: string }
  }

  const idDe = async (apelido: string) => (await pool.query<{ id: string }>('select id from operador where apelido = $1', [apelido])).rows[0]?.id ?? ''
  const ativos = async () => (await pool.query<{ apelido: string }>('select apelido from operador where desativado_em is null order by apelido')).rows.map((linha) => linha.apelido)
  // `em` é o `now()` da transação: igual dentro de uma, crescente entre as seguintes. Dentro de uma, a ordem é a da ação.
  const auditoriaDe = async (operadorId: string) =>
    (await pool.query<{ autor: string; acao: string }>('select autor, acao from auditoria_operacao where operador_alvo_id = $1 order by em, acao', [operadorId])).rows

  async function limparOperacao(): Promise<void> {
    await pool.query('delete from auditoria_operacao')
    await pool.query('delete from acesso_operacao')
    await pool.query('delete from sessao_operador')
    await pool.query('delete from convite_operador')
    await pool.query('delete from codigo_recuperacao_operador')
    await pool.query('delete from operador')
  }

  /**
   * Segura a trava dos operadores numa transação à parte, dispara as duas chamadas e espera as duas ficarem paradas na
   * trava antes de soltar. Se o comando não pegasse a trava, a espera não chegaria a dois e o teste vence o prazo; se
   * pegasse depois de conferir, as duas conferências já teriam passado e o resultado das duas seria sucesso.
   */
  async function emParaleloNaTrava(chamadas: (() => Promise<Execucao>)[]): Promise<Execucao[]> {
    const segurador = await pool.connect()
    let soltou = false
    try {
      await segurador.query('begin')
      await segurador.query('select pg_advisory_xact_lock($1)', [CHAVE_DA_TRAVA_DOS_OPERADORES])
      const execucoes = Promise.all(chamadas.map((chamada) => chamada()))
      const prazo = Date.now() + 15_000
      for (;;) {
        const { rows } = await pool.query<{ esperando: number }>(
          "select count(*)::int as esperando from pg_locks where locktype = 'advisory' and classid = 0 and objid = $1 and objsubid = 1 and not granted",
          [CHAVE_DA_TRAVA_DOS_OPERADORES],
        )
        if (rows[0]?.esperando === chamadas.length) break
        if (Date.now() > prazo) throw new Error('as chamadas não chegaram à trava dos operadores')
        await new Promise((pronto) => setTimeout(pronto, 20))
      }
      await segurador.query('commit')
      soltou = true
      return await execucoes
    } finally {
      // Falhou antes de soltar: desfaz a transação, e a trava não volta ao pool presa na conexão.
      if (!soltou) await segurador.query('rollback')
      segurador.release()
    }
  }

  beforeAll(() => {
    pool = createPool({ url: urlDoBancoDeTeste(), maximoConexoes: 4, timeoutConexaoMs: 2_000, timeoutConsultaMs: 5_000 }, () => undefined)
  })

  // A conferência do OPERADOR é global: os outros arquivos de teste rodam `ops:*` sem operador ativo (bootstrap). Cada
  // caso começa sem operador, e o arquivo termina sem nenhum.
  beforeEach(limparOperacao)

  afterAll(async () => {
    await limparOperacao()
    await pool.query('delete from auditoria where entidade_id = any($1::uuid[])', [redes])
    await pool.query('delete from rede where id = any($1::uuid[])', [redes])
    await pool.end()
    rmSync(pasta, { recursive: true, force: true })
  })

  it('C1: sem operador ativo, criar aceita o OPERADOR do ambiente e grava o autor bootstrap, e não o OPERADOR', async () => {
    // Sem operador ativo, qualquer OPERADOR no formato roda os ops:* (o nascimento).
    expect((await rodarComando(executarOpsUso, ['--escola', randomUUID()], 'qualquer-pessoa')).codigo).toBe(0)

    const arquivo = arquivoNovo()
    const execucao = await rodar(['criar', '--apelido', 'ana', '--nome', nomeDe('ana'), '--email', 'Ana@Turmma.invalid', '--saida', arquivo], 'fundadora')
    expect(execucao).toMatchObject({ codigo: 0, erro: '' })
    const resposta = JSON.parse(execucao.saida) as Record<string, string>
    expect(Object.keys(resposta)).toEqual(['operadorId', 'conviteId', 'arquivo'])
    expect(resposta.arquivo).toBe(arquivo)
    // Nem o nome, nem o e-mail, nem o token saem no terminal.
    const token = readFileSync(arquivo, 'utf8').trim()
    for (const proibido of [nomeDe('ana'), 'turmma.invalid', token]) expect(execucao.saida).not.toContain(proibido)

    const { rows: operadores } = await pool.query('select id, apelido, nome, email::text as email, desativado_em from operador')
    expect(operadores).toEqual([{ id: resposta.operadorId, apelido: 'ana', nome: nomeDe('ana'), email: 'ana@turmma.invalid', desativado_em: null }])
    expect(await auditoriaDe(resposta.operadorId ?? '')).toEqual([
      { autor: 'bootstrap', acao: 'convite_operador.gerado' },
      { autor: 'bootstrap', acao: 'operador.criado' },
    ])

    // O banco guarda o SHA-256 do token do arquivo, e o convite vale 72 h.
    const { rows: convites } = await pool.query<{ id: string; token_hash: string; horas: number; usado_em: Date | null; revogado_em: Date | null }>(
      'select id, token_hash, extract(epoch from expira_em - now()) / 3600 as horas, usado_em, revogado_em from convite_operador where operador_id = $1',
      [resposta.operadorId],
    )
    expect(convites).toHaveLength(1)
    expect(convites[0]).toMatchObject({ id: resposta.conviteId, token_hash: sha256(token), usado_em: null, revogado_em: null })
    expect(Number(convites[0]?.horas)).toBeGreaterThan(71.9)
    expect(Number(convites[0]?.horas)).toBeLessThanOrEqual(72)
  })

  it('C3: dois criar de bootstrap em paralelo, os dois parados na trava antes de conferir: um cria, o outro é recusado', async () => {
    const [primeiro, segundo] = [arquivoNovo(), arquivoNovo()]
    const execucoes = await emParaleloNaTrava([
      () => rodar(['criar', '--apelido', 'ana', '--nome', nomeDe('ana'), '--email', emailDe('ana'), '--saida', primeiro], 'fundadora'),
      () => rodar(['criar', '--apelido', 'bruno', '--nome', nomeDe('bruno'), '--email', emailDe('bruno'), '--saida', segundo], 'fundadora'),
    ])
    expect(execucoes.map((execucao) => execucao.codigo).sort()).toEqual([0, 2])
    expect(execucoes.find((execucao) => execucao.codigo === 2)?.erro).toBe(RECUSA_DO_OPERADOR)
    const criados = await ativos()
    expect(criados).toHaveLength(1)
    expect((await pool.query('select 1 from operador')).rows).toHaveLength(1)
    expect(await auditoriaDe(await idDe(criados[0] ?? ''))).toEqual([
      { autor: 'bootstrap', acao: 'convite_operador.gerado' },
      { autor: 'bootstrap', acao: 'operador.criado' },
    ])
    // O arquivo do recusado é apagado; o do criado fica com o token.
    expect([existsSync(primeiro), existsSync(segundo)].sort()).toEqual([false, true])
  })

  describe('C2: com operador ativo, OPERADOR inexistente ou desativado é recusado em cada ops:*, e o ativo passa', () => {
    // O convite pendente de ana, gravado no começo de cada caso.
    let conviteDaAna = ''
    // A escola com um acesso da turma vigente, que o `ops:revogar-acessos-sala` recusado não pode tocar (A1, 9.0).
    const bancada = new BancadaDeSessoes()
    const medidor = new MedidorDeTeste()
    let api: ApiDeTeste | undefined
    let sala: SalaDeTeste | undefined
    let acessoVigente = ''

    beforeAll(async () => {
      // O suboperador vigente que o `ops:suboperador encerrar` recusado não pode encerrar (F3, 8.0).
      await pool.query(
        `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, registrado_por)
         values ($1, 'Empresa Sintética do C2', 'Hospedagem', array['cadastro'], 'BR', 'DPA-C2', true, 'todas', 'equipe-de-teste')`,
        [CHAVE_DO_C2_ENCERRAMENTO],
      )
      api = await subirApi(medidor.medidor, { ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } })
      const ferramentas = new FerramentasDaSala(api, bancada)
      sala = await ferramentas.montar()
      acessoVigente = await ferramentas.acessoVigente(sala.turma)
    })

    afterAll(async () => {
      // Um suboperador `todas` aparece em toda escola, também nas telas do e2e: o do C2 não fica.
      const dasChaves = `(select id from suboperador where chave = any($1::text[]))`
      const chaves = [CHAVE_DO_C2_CADASTRO, CHAVE_DO_C2_ENCERRAMENTO]
      await pool.query(`delete from auditoria where entidade = 'suboperador' and entidade_id in ${dasChaves}`, [chaves])
      await pool.query(`delete from suboperador_escola where suboperador_id in ${dasChaves}`, [chaves])
      await pool.query('delete from suboperador where chave = any($1::text[])', [chaves])
      // O incidente que o `ops:incidente registrar` do operador ativo gravou na escola da sala; as seções saem em cascata.
      await pool.query('delete from incidente where id in (select incidente_id from incidente_escola where escola_id = $1)', [escolaDaSala()])
      await api?.app.close()
      await bancada.fechar()
      await medidor.encerrar()
    })

    const escolaDaSala = () => sala?.escolaId ?? ''
    const casos: { nome: string; comando: Comando; argumentos: () => string[]; nadaFeito: () => Promise<void>; passou: (execucao: Execucao) => void | Promise<void> }[] = [
      {
        nome: 'escola',
        comando: executarOpsEscola,
        argumentos: () => ['rede', 'criar', '--nome', 'Rede Sintética do Operador', '--tipo', 'grupo'],
        nadaFeito: async () => expect((await pool.query(`select 1 from rede where nome = 'Rede Sintética do Operador'`)).rows).toHaveLength(0),
        passou: (execucao) => {
          expect(execucao.codigo).toBe(0)
          redes.push((JSON.parse(execucao.saida) as { redeId: string }).redeId)
        },
      },
      {
        nome: 'convite-coordenador',
        comando: executarOpsConviteCoordenador,
        argumentos: () => ['--escola', `sem-escola-${randomUUID().slice(0, 8)}`, '--email', 'coordenacao@escola.invalid', '--nome', 'Coordenação Sintética', '--saida', arquivoNovo()],
        nadaFeito: async () => expect((await pool.query(`select 1 from conta where email = 'coordenacao@escola.invalid'`)).rows).toHaveLength(0),
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 1, erro: 'NAO_ENCONTRADO: escola não encontrada\n' }),
      },
      {
        nome: 'revogar-convite',
        comando: executarOpsRevogarConvite,
        argumentos: () => ['--convite', randomUUID()],
        nadaFeito: async () => undefined,
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 1, erro: 'NAO_ENCONTRADO\n' }),
      },
      {
        nome: 'redefinir-mfa',
        comando: executarOpsRedefinirMfa,
        argumentos: () => ['--usuario', randomUUID(), '--pedido', '12'],
        nadaFeito: async () => undefined,
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 1, erro: 'NAO_ENCONTRADO\n' }),
      },
      {
        nome: 'revogar-acessos-sala',
        comando: executarOpsRevogarAcessosSala,
        argumentos: () => ['--escola', escolaDaSala()],
        // O acesso vigente continua vigente, e a auditoria da escola não tem revogação nenhuma.
        nadaFeito: async () => {
          expect((await pool.query('select revogado_em from acesso_turma where id = $1', [acessoVigente])).rows).toEqual([{ revogado_em: null }])
          expect((await pool.query(`select 1 from auditoria where escola_id = $1 and acao = 'acesso_turma.revogado'`, [escolaDaSala()])).rows).toEqual([])
        },
        passou: (execucao) => expect(execucao).toEqual({ codigo: 0, saida: `${JSON.stringify({ revogados: 1 })}\n`, erro: '' }),
      },
      {
        nome: 'retencao ajustar',
        comando: executarOpsRetencao,
        argumentos: () => ['ajustar', '--escola', escolaDaSala(), '--categoria', 'conversa_tutor', '--meses', '6', '--contrato', '3'],
        // Nenhum ajuste e nenhuma auditoria do ajuste na escola: quem saiu da equipe não muda o prazo de guarda dela (F3, 2.0).
        nadaFeito: async () => {
          expect((await pool.query('select 1 from retencao_escola where escola_id = $1', [escolaDaSala()])).rows).toEqual([])
          expect((await pool.query(`select 1 from auditoria where escola_id = $1 and acao = 'retencao.ajustada'`, [escolaDaSala()])).rows).toEqual([])
        },
        passou: (execucao) => expect(execucao).toEqual({ codigo: 0, saida: `${JSON.stringify({ categoria: 'conversa_tutor', meses: 6, origem: 'ajustada', limitadaPor: null })}\n`, erro: '' }),
      },
      {
        nome: 'retencao listar',
        comando: executarOpsRetencao,
        argumentos: () => ['listar', '--escola', escolaDaSala()],
        nadaFeito: async () => undefined,
        passou: (execucao) => {
          expect(execucao).toMatchObject({ codigo: 0, erro: '' })
          const { categorias } = JSON.parse(execucao.saida) as { categorias: Array<{ categoria: string }> }
          expect(categorias.map(({ categoria }) => categoria)).toEqual([...CHAVES_DE_RETENCAO])
        },
      },
      {
        nome: 'suboperador cadastrar',
        comando: executarOpsSuboperador,
        argumentos: () => ['cadastrar', '--chave', CHAVE_DO_C2_CADASTRO, '--nome', 'Empresa Sintética do C2', '--finalidade', 'Hospedagem', '--pais', 'BR', '--categorias', 'cadastro', '--contrato', 'DPA-C2', '--veda-treinamento', 'sim', '--todas'],
        // Nenhum suboperador, e nenhuma auditoria dele: quem saiu da equipe não cadastra empresa que recebe dado das escolas (F3, 8.0).
        nadaFeito: async () => expect((await pool.query('select 1 from suboperador where chave = $1', [CHAVE_DO_C2_CADASTRO])).rows).toEqual([]),
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 0, erro: '' }),
      },
      {
        nome: 'suboperador encerrar',
        comando: executarOpsSuboperador,
        argumentos: () => ['encerrar', '--chave', CHAVE_DO_C2_ENCERRAMENTO],
        // O suboperador vigente continua vigente: o `encerrar` recusado não pode ter tocado nele.
        nadaFeito: async () => expect((await pool.query('select fim from suboperador where chave = $1 and fim is null', [CHAVE_DO_C2_ENCERRAMENTO])).rows).toHaveLength(1),
        passou: async (execucao) => {
          expect(execucao).toMatchObject({ codigo: 0, erro: '' })
          expect((await pool.query('select 1 from suboperador where chave = $1 and fim is null', [CHAVE_DO_C2_ENCERRAMENTO])).rows).toEqual([])
        },
      },
      {
        nome: 'incidente registrar',
        comando: executarOpsIncidente,
        argumentos: () => {
          const caminho = arquivoNovo()
          const secao = { escola: escolaDaSala(), circunstancias: 'Circunstância sintética.', categorias: ['cadastro'], titularesEstimados: 3, risco: 'baixo', contencao: 'Contenção sintética.', correcao: 'Correção sintética.' }
          writeFileSync(caminho, JSON.stringify({ conhecidoEm: new Date(Date.now() - 3_600_000).toISOString(), escolas: [secao] }))
          return ['registrar', '--arquivo', caminho]
        },
        // Nenhuma seção e nenhuma auditoria na escola: quem saiu da equipe não registra incidente que a coordenação vai ler (F3, 9.0).
        nadaFeito: async () => {
          expect((await pool.query('select 1 from incidente_escola where escola_id = $1', [escolaDaSala()])).rows).toEqual([])
          expect((await pool.query(`select 1 from auditoria where escola_id = $1 and acao = 'incidente.registrado'`, [escolaDaSala()])).rows).toEqual([])
        },
        passou: async (execucao) => {
          expect(execucao).toMatchObject({ codigo: 0, erro: '' })
          expect((await pool.query('select 1 from incidente_escola where escola_id = $1', [escolaDaSala()])).rows).toHaveLength(1)
        },
      },
      {
        nome: 'uso',
        comando: executarOpsUso,
        argumentos: () => ['--escola', randomUUID()],
        nadaFeito: async () => undefined,
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 0, erro: '' }),
      },
      {
        nome: 'privacidade',
        comando: executarOpsPrivacidade,
        argumentos: () => ['--escola', escolaDaSala()],
        // Só lê: a recusa não grava nada, e a leitura do operador ativo é a única que devolve as contagens da escola (F3, 19.0).
        nadaFeito: async () => undefined,
        passou: (execucao) => {
          expect(execucao).toMatchObject({ codigo: 0, erro: '' })
          expect(JSON.parse(execucao.saida)).toMatchObject({ escolaId: escolaDaSala() })
        },
      },
      {
        nome: 'operador criar',
        comando: executarOpsOperador,
        argumentos: () => ['criar', '--apelido', 'dora', '--nome', nomeDe('dora'), '--email', emailDe('dora'), '--saida', arquivoNovo()],
        nadaFeito: async () => expect(await idDe('dora')).toBe(''),
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 0, erro: '' }),
      },
      {
        nome: 'operador desativar',
        comando: executarOpsOperador,
        argumentos: () => ['desativar', '--apelido', 'carla'],
        nadaFeito: async () => expect(await ativos()).toEqual(['ana', 'carla']),
        passou: (execucao) => expect(execucao).toEqual({ codigo: 0, saida: 'ok\n', erro: '' }),
      },
      {
        nome: 'operador convite',
        comando: executarOpsOperador,
        argumentos: () => ['convite', '--apelido', 'ana', '--saida', arquivoNovo()],
        // O pendente de ana continua o mesmo, e nenhum convite novo nasce: um token no arquivo de quem saiu tomaria a conta.
        nadaFeito: async () => {
          const { rows } = await pool.query<{ id: string; pendente: boolean }>(
            'select c.id, c.usado_em is null and c.revogado_em is null as pendente from convite_operador c join operador o on o.id = c.operador_id where o.apelido = $1',
            ['ana'],
          )
          expect(rows).toEqual([{ id: conviteDaAna, pendente: true }])
        },
        passou: (execucao) => expect(execucao).toMatchObject({ codigo: 0, erro: '' }),
      },
    ]

    it.each(casos)('ops:$nome', async ({ comando, argumentos, nadaFeito, passou }) => {
      // ana e carla são ativas (ana nasceu no bootstrap); bruno foi criado e desativado por ela.
      conviteDaAna = (await criar('ana', 'fundadora')).conviteId
      await criar('bruno', 'ana')
      await criar('carla', 'ana')
      expect(await rodar(['desativar', '--apelido', 'bruno'], 'ana')).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })

      for (const recusado of ['ninguem', 'bruno', 'fundadora']) {
        const argumentosDoCaso = argumentos()
        const execucao = await rodarComando(comando, argumentosDoCaso, recusado)
        expect(execucao, recusado).toEqual({ codigo: 2, saida: '', erro: RECUSA_DO_OPERADOR })
        await nadaFeito()
        // O arquivo do token, quando o comando tem um, não fica para trás.
        const saida = argumentosDoCaso[argumentosDoCaso.indexOf('--saida') + 1]
        if (argumentosDoCaso.includes('--saida') && saida !== undefined) expect(existsSync(saida)).toBe(false)
      }

      // O operador ativo passa pela conferência: o resultado é o do próprio comando.
      await passou(await rodarComando(comando, argumentos(), 'ana'))
    })
  })

  it('C4: criar, desativar e convite gravam a AuditoriaOperacao com o autor do comando e o alvo certo', async () => {
    const ana = await criar('ana', 'fundadora')
    const bruno = await criar('bruno', 'ana')
    const carla = await criar('carla', 'bruno')

    expect(await rodar(['desativar', '--apelido', 'bruno'], 'ana')).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })
    expect((await rodar(['convite', '--apelido', 'carla', '--saida', arquivoNovo()], 'ana')).codigo).toBe(0)

    // Sem convite pendente (o de ana foi usado), `convite` não grava revogação.
    await pool.query('update convite_operador set usado_em = now() where operador_id = $1', [ana.operadorId])
    expect((await rodar(['convite', '--apelido', 'ana', '--saida', arquivoNovo()], 'carla')).codigo).toBe(0)

    // Por transação (`em` é o `now()` dela) e, dentro de uma, pela ação.
    const { rows } = await pool.query<{ autor: string; acao: string; alvo: string }>('select autor, acao, operador_alvo_id as alvo from auditoria_operacao order by em, acao')
    expect(rows).toEqual([
      { autor: 'bootstrap', acao: 'convite_operador.gerado', alvo: ana.operadorId },
      { autor: 'bootstrap', acao: 'operador.criado', alvo: ana.operadorId },
      { autor: 'ana', acao: 'convite_operador.gerado', alvo: bruno.operadorId },
      { autor: 'ana', acao: 'operador.criado', alvo: bruno.operadorId },
      { autor: 'bruno', acao: 'convite_operador.gerado', alvo: carla.operadorId },
      { autor: 'bruno', acao: 'operador.criado', alvo: carla.operadorId },
      { autor: 'ana', acao: 'convite_operador.revogado', alvo: bruno.operadorId },
      { autor: 'ana', acao: 'operador.desativado', alvo: bruno.operadorId },
      { autor: 'ana', acao: 'convite_operador.gerado', alvo: carla.operadorId },
      { autor: 'ana', acao: 'convite_operador.revogado', alvo: carla.operadorId },
      { autor: 'carla', acao: 'convite_operador.gerado', alvo: ana.operadorId },
    ])
  })

  describe('C5: desativar recusa o apelido inexistente, a si mesmo e o último ativo', () => {
    it('apelido inexistente e operador já desativado: NAO_ENCONTRADO tipado, sem o apelido na mensagem', async () => {
      await criar('ana', 'fundadora')
      await criar('bruno', 'ana')
      await criar('carla', 'ana')
      expect(await rodar(['desativar', '--apelido', 'ninguem'], 'ana')).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: operador ativo não encontrado\n' })
      expect(await rodar(['desativar', '--apelido', 'bruno'], 'ana')).toMatchObject({ codigo: 0 })
      expect(await rodar(['desativar', '--apelido', 'bruno'], 'carla')).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: operador ativo não encontrado\n' })
      expect(await ativos()).toEqual(['ana', 'carla'])
    })

    it('o último ativo não é desativado, nem por ele mesmo', async () => {
      await criar('ana', 'fundadora')
      expect(await rodar(['desativar', '--apelido', 'ana'], 'ana')).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: o último operador ativo não pode ser desativado\n' })
      expect(await ativos()).toEqual(['ana'])
      expect(await auditoriaDe(await idDe('ana'))).not.toContainEqual(expect.objectContaining({ acao: 'operador.desativado' }))
    })

    it('com outro ativo, ninguém desativa a si mesmo', async () => {
      await criar('ana', 'fundadora')
      await criar('bruno', 'ana')
      expect(await rodar(['desativar', '--apelido', 'ana'], 'ana')).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: ninguém desativa a si mesmo\n' })
      expect(await ativos()).toEqual(['ana', 'bruno'])
    })

    it('concorrência: com exatamente dois ativos, A desativa B e B desativa A, os dois parados na trava: um passa, e resta um ativo', async () => {
      await criar('ana', 'fundadora')
      await criar('bruno', 'ana')
      const execucoes = await emParaleloNaTrava([() => rodar(['desativar', '--apelido', 'bruno'], 'ana'), () => rodar(['desativar', '--apelido', 'ana'], 'bruno')])
      expect(execucoes.map((execucao) => execucao.codigo).sort()).toEqual([0, 2])
      // Quem perde já foi desativado por quem ganhou: o OPERADOR dele deixou de ser ativo.
      expect(execucoes.find((execucao) => execucao.codigo === 2)?.erro).toBe(RECUSA_DO_OPERADOR)
      expect(await ativos()).toHaveLength(1)
    })
  })

  describe('C6: desativar apaga o dado pessoal, os códigos, o convite pendente e as sessões, numa transação só', () => {
    const SENHA_HASH = '$argon2id$v=19$m=19456,t=2,p=1$sintetico$sintetico'

    /** O que o F1 grava depois do aceite e do configurar, direto no banco (as rotas são das tarefas 5.0 a 8.0). */
    async function comSegundoFatorESessao(operadorId: string): Promise<void> {
      await pool.query(
        `update operador set senha_hash = $2, mfa_segredo_cifrado = $3, mfa_chave_versao = 1, mfa_versao = 1, mfa_ativado_em = now(), mfa_ultimo_passo = 59000000
         where id = $1`,
        [operadorId, SENHA_HASH, randomBytes(48)],
      )
      for (let codigo = 0; codigo < 2; codigo++) {
        await pool.query('insert into codigo_recuperacao_operador (operador_id, hmac) values ($1, $2)', [operadorId, randomBytes(32).toString('base64url')])
      }
      await pool.query(`insert into sessao_operador (operador_id, refresh_hash, expira_em) values ($1, $2, now() + interval '8 hours')`, [operadorId, sha256(randomUUID())])
    }

    interface Estado {
      operador: Record<string, unknown>
      codigos: number
      convitesPendentes: number
      convitesRevogados: number
      sessoes: { encerrada: boolean; motivo: string | null }[]
      auditoria: { autor: string; acao: string }[]
    }

    async function estadoDe(operadorId: string): Promise<Estado> {
      // A linha inteira: uma coluna pessoal nova na tabela aparece aqui e a asserção fechada do desativar fica vermelha.
      const { rows: operadores } = await pool.query<Record<string, unknown>>('select * from operador where id = $1', [operadorId])
      const contar = async (consulta: string) => (await pool.query<{ total: number }>(consulta, [operadorId])).rows[0]?.total ?? -1
      return {
        operador: operadores[0] ?? {},
        codigos: await contar('select count(*)::int as total from codigo_recuperacao_operador where operador_id = $1'),
        convitesPendentes: await contar('select count(*)::int as total from convite_operador where operador_id = $1 and usado_em is null and revogado_em is null'),
        convitesRevogados: await contar('select count(*)::int as total from convite_operador where operador_id = $1 and revogado_em is not null'),
        sessoes: (
          await pool.query<{ encerrada: boolean; motivo: string | null }>('select encerrada_em is not null as encerrada, motivo from sessao_operador where operador_id = $1', [operadorId])
        ).rows,
        auditoria: await auditoriaDe(operadorId),
      }
    }

    it('bruno fica só com id, apelido e datas, sem códigos, com o convite revogado e a sessão encerrada; carla, intacta', async () => {
      await criar('ana', 'fundadora')
      const bruno = await criar('bruno', 'ana')
      const carla = await criar('carla', 'ana')
      await comSegundoFatorESessao(bruno.operadorId)
      await comSegundoFatorESessao(carla.operadorId)
      const carlaAntes = await estadoDe(carla.operadorId)

      expect(await rodar(['desativar', '--apelido', 'bruno'], 'ana')).toEqual({ codigo: 0, saida: 'ok\n', erro: '' })

      expect(await estadoDe(bruno.operadorId)).toEqual({
        // Só id, apelido e datas; `mfa_versao` é o contador de segredos gravados (tarefa 7.0), e não dado da pessoa.
        operador: {
          id: bruno.operadorId,
          apelido: 'bruno',
          nome: null,
          email: null,
          senha_hash: null,
          mfa_segredo_cifrado: null,
          mfa_chave_versao: null,
          mfa_versao: 1,
          mfa_ativado_em: null,
          mfa_ultimo_passo: null,
          criado_em: expect.any(Date),
          desativado_em: expect.any(Date),
        },
        codigos: 0,
        convitesPendentes: 0,
        convitesRevogados: 1,
        sessoes: [{ encerrada: true, motivo: 'desativacao' }],
        auditoria: [
          { autor: 'ana', acao: 'convite_operador.gerado' },
          { autor: 'ana', acao: 'operador.criado' },
          { autor: 'ana', acao: 'convite_operador.revogado' },
          { autor: 'ana', acao: 'operador.desativado' },
        ],
      })
      // O outro operador, com o mesmo tipo de dado, não é tocado: cada passo do desativar é do alvo só.
      expect(await estadoDe(carla.operadorId)).toEqual(carlaAntes)
      expect(carlaAntes).toMatchObject({ codigos: 2, convitesPendentes: 1, sessoes: [{ encerrada: false, motivo: null }] })

      // O apelido reservado do nascimento também é recusado pelo banco, por fora do comando.
      await expect(pool.query(`insert into operador (apelido, nome, email) values ('bootstrap', 'Pessoa Sintética', 'boot@turmma.invalid')`)).rejects.toMatchObject({
        constraint: 'operador_apelido_formato',
      })
      // O banco também recusa devolver dado pessoal a quem foi desativado, por fora do comando.
      await expect(pool.query(`update operador set nome = 'Pessoa Sintética' where id = $1`, [bruno.operadorId])).rejects.toMatchObject({ constraint: 'operador_desativado_sem_dado_pessoal' })
    })

    it('falha injetada na última gravação (a auditoria) desfaz tudo: nada fica pela metade', async () => {
      await criar('ana', 'fundadora')
      const bruno = await criar('bruno', 'ana')
      await criar('carla', 'ana')
      await comSegundoFatorESessao(bruno.operadorId)
      const antes = await estadoDe(bruno.operadorId)

      const sufixo = randomUUID().replaceAll('-', '')
      await pool.query(`create function falha_injetada_${sufixo}() returns trigger language plpgsql as $$ begin raise exception 'falha injetada'; end $$`)
      await pool.query(
        `create trigger falha_injetada_${sufixo} before insert on auditoria_operacao for each row
         when (new.acao = 'operador.desativado' and new.operador_alvo_id = '${bruno.operadorId}') execute function falha_injetada_${sufixo}()`,
      )
      try {
        const execucao = await rodar(['desativar', '--apelido', 'bruno'], 'ana')
        expect(execucao.codigo).toBe(1)
        expect(execucao.erro).toMatch(/^ERRO_INTERNO: /)
      } finally {
        await pool.query(`drop trigger falha_injetada_${sufixo} on auditoria_operacao`)
        await pool.query(`drop function falha_injetada_${sufixo}()`)
      }

      expect(await estadoDe(bruno.operadorId)).toEqual(antes)
      expect(antes).toMatchObject({ operador: { nome: nomeDe('bruno'), desativado_em: null }, codigos: 2, convitesPendentes: 1, sessoes: [{ encerrada: false, motivo: null }] })
    })
  })

  describe('C7 (parte): um convite pendente por operador', () => {
    it('convite revoga o pendente e gera outro na mesma transação; o outro operador não é tocado', async () => {
      await criar('ana', 'fundadora')
      const bruno = await criar('bruno', 'ana')
      const carla = await criar('carla', 'ana')

      const arquivo = arquivoNovo()
      const execucao = await rodar(['convite', '--apelido', 'bruno', '--saida', arquivo], 'ana')
      expect(execucao).toMatchObject({ codigo: 0, erro: '' })
      const resposta = JSON.parse(execucao.saida) as Record<string, string>
      expect(Object.keys(resposta)).toEqual(['conviteId', 'arquivo'])

      const { rows } = await pool.query<{ id: string; operador_id: string; token_hash: string; revogado: boolean }>(
        'select id, operador_id, token_hash, revogado_em is not null as revogado from convite_operador where usado_em is null order by operador_id, revogado',
      )
      expect(rows.filter((linha) => linha.operador_id === bruno.operadorId)).toEqual([
        { id: resposta.conviteId, operador_id: bruno.operadorId, token_hash: sha256(readFileSync(arquivo, 'utf8').trim()), revogado: false },
        { id: bruno.conviteId, operador_id: bruno.operadorId, token_hash: expect.any(String), revogado: true },
      ])
      expect(rows.filter((linha) => linha.operador_id === carla.operadorId)).toEqual([expect.objectContaining({ id: carla.conviteId, revogado: false })])
    })

    it('o único parcial impede dois pendentes pelo banco, por fora do comando', async () => {
      await criar('ana', 'fundadora')
      const ana = await idDe('ana')
      await expect(
        pool.query(`insert into convite_operador (operador_id, token_hash, expira_em) values ($1, $2, now() + interval '72 hours')`, [ana, sha256(randomUUID())]),
      ).rejects.toMatchObject({ constraint: 'convite_operador_pendente_unico' })
      // Usado ou revogado deixa de ser pendente, e o próximo entra.
      await pool.query('update convite_operador set usado_em = now() where operador_id = $1', [ana])
      await pool.query(`insert into convite_operador (operador_id, token_hash, expira_em) values ($1, $2, now() + interval '72 hours')`, [ana, sha256(randomUUID())])
    })

    it('convite para operador desativado ou inexistente: NAO_ENCONTRADO, sem convite novo e sem arquivo', async () => {
      await criar('ana', 'fundadora')
      const bruno = await criar('bruno', 'ana')
      await rodar(['desativar', '--apelido', 'bruno'], 'ana')
      for (const apelido of ['bruno', 'ninguem']) {
        const arquivo = arquivoNovo()
        expect(await rodar(['convite', '--apelido', apelido, '--saida', arquivo], 'ana')).toEqual({ codigo: 1, saida: '', erro: 'NAO_ENCONTRADO: operador ativo não encontrado\n' })
        expect(existsSync(arquivo)).toBe(false)
      }
      expect((await pool.query('select 1 from convite_operador where operador_id = $1', [bruno.operadorId])).rows).toHaveLength(1)
    })
  })

  describe('C8: o arquivo do token', () => {
    it('nasce com modo 0600 no criar e no convite', async () => {
      const ana = await criar('ana', 'fundadora')
      expect(statSync(ana.arquivo).mode & 0o777).toBe(0o600)
      const arquivo = arquivoNovo()
      expect((await rodar(['convite', '--apelido', 'ana', '--saida', arquivo], 'ana')).codigo).toBe(0)
      expect(statSync(arquivo).mode & 0o777).toBe(0o600)
      expect(readFileSync(arquivo, 'utf8')).toMatch(/^[A-Za-z0-9_-]{43}\n$/)
    })

    it('arquivo que já existe é recusado antes de abrir o banco, e fica como estava', async () => {
      const arquivo = arquivoNovo()
      writeFileSync(arquivo, 'conteúdo anterior')
      let abriuBanco = false
      let erro = ''
      const codigo = await executarOpsOperador(
        ['criar', '--apelido', 'ana', '--nome', nomeDe('ana'), '--email', emailDe('ana'), '--saida', arquivo],
        { ...ambienteBase, OPERADOR: 'fundadora' },
        { saida: () => undefined, erro: (texto) => (erro += texto) },
        () => {
          abriuBanco = true
          throw new Error('não deveria abrir o banco')
        },
      )
      expect({ codigo, erro, abriuBanco }).toEqual({ codigo: 2, erro: 'Opção inválida ou ausente: --saida (o arquivo já existe ou a pasta não aceita escrita)\n', abriuBanco: false })
      expect(readFileSync(arquivo, 'utf8')).toBe('conteúdo anterior')
    })

    it('apelido ou e-mail repetido: CONFLITO sem o valor, e o arquivo criado é apagado', async () => {
      await criar('ana', 'fundadora')
      for (const [apelido, email] of [
        ['ana', 'outra@turmma.invalid'],
        ['bia', 'ANA@turmma.invalid'],
      ] as const) {
        const arquivo = arquivoNovo()
        const execucao = await rodar(['criar', '--apelido', apelido, '--nome', nomeDe(apelido), '--email', email, '--saida', arquivo], 'ana')
        expect(execucao).toEqual({ codigo: 1, saida: '', erro: 'CONFLITO: já existe operador com este apelido ou e-mail\n' })
        expect(existsSync(arquivo)).toBe(false)
      }
      expect(await ativos()).toEqual(['ana'])
    })
  })
})
