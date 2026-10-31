import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { TAMANHO_PADRAO_DA_PAGINA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ITERACOES_MINIMAS_ARGON2, MEMORIA_MINIMA_ARGON2_KIB, THREADS_DE_FOLGA_DO_LIBUV } from '../../apps/api/src/credencial/login-config.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { CODIGO_THRESHOLD_CRUZADO } from '../scripts/carga.ts'
import {
  ALUNOS_DA_A_ALVO_DO_ATAQUE,
  ALUNOS_POR_ESCOLA,
  ALUNOS_POR_TURMA,
  ATIVIDADES_NOVAS_COM_TENTATIVA,
  ATIVIDADES_NOVAS_ENVIADAS,
  ATIVIDADES_POR_TURMA,
  argumentosDoK6DeLogin,
  autenticadaBaseP95,
  codigoDeSaidaDoLogin,
  CRITERIOS_DA_PROTECAO,
  descreverFase,
  EQUIPE_POR_ESCOLA,
  FASES_DO_CENARIO,
  FASES_DO_CONTROLE_NEGATIVO,
  fasesPedidas,
  julgarCenarioDeLogin,
  juntarAtacante,
  lerResumoDaFase,
  montarContas,
  turmasDaEscola,
  type FaseDoCenario,
  type ResumoDaFase,
} from '../scripts/carga-login.ts'
import { dispararia, julgarRebaixamento, PASSO_DA_CONSULTA_S, type ConferenciaDoLogin } from '../scripts/conferir-carga-login.ts'

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

const limpo = (valores: Record<string, number> = {}): ResumoDaFase => ({
  codigo: 0,
  cruzados: [],
  valores,
})
const cruzado = (...metricas: string[]): ResumoDaFase => ({
  codigo: CODIGO_THRESHOLD_CRUZADO,
  cruzados: metricas.map((metrica) => ({ metrica, criterio: 'x' })),
  valores: {},
})
const conferencia = (...reprovacoes: string[]): ConferenciaDoLogin => ({
  linhas: [],
  reprovacoes,
})
/** Todas as fases limpas, com a troca pedida. */
function resumos(trocas: Partial<Record<FaseDoCenario, ResumoDaFase>> = {}, fases: readonly FaseDoCenario[] = FASES_DO_CENARIO): Map<FaseDoCenario, ResumoDaFase> {
  return new Map(fases.map((fase) => [fase, trocas[fase] ?? limpo()]))
}

const EMAILS = Object.fromEntries(
  (['A', 'B', 'C'] as const).map((escola) => [
    escola,
    Array.from({ length: EQUIPE_POR_ESCOLA }, (_, posicao) => `sintetico-${escola}-${String(posicao).padStart(2, '0')}@educa.invalid`),
  ]),
) as Record<'A' | 'B' | 'C', string[]>
const SLUGS = { A: 'login-a-x', B: 'login-b-x', C: 'login-c-x' }
const contas = montarContas('senha-gerada-na-hora', 'outra-senha-gerada-na-hora', SLUGS, EMAILS)
const chave = (conta: { escola: string; matricula?: string; email?: string }) => `${conta.escola}|${conta.matricula ?? conta.email ?? ''}`

describe('as contas do cenário "login às 7h30"', () => {
  it('a rajada tem as 2.100 contas das três escolas, cada uma uma vez, e 30% delas erram a senha uma vez', () => {
    expect(contas.rajada).toHaveLength(2_100)
    expect(new Set(contas.rajada.map(chave)).size).toBe(2_100)
    expect(contas.rajada.filter((conta) => conta.erra === true)).toHaveLength(630)
    for (const escola of ['A', 'B', 'C'])
      expect(
        contas.rajada.filter((conta) => conta.escola === escola),
        escola,
      ).toHaveLength(ALUNOS_POR_ESCOLA + EQUIPE_POR_ESCOLA)
  })

  it('o primeiro minuto (as 840 primeiras) tem as três escolas e a equipe, e os 30% que erram também: a rajada não deixa um grupo para o fim', () => {
    const primeiroMinuto = contas.rajada.slice(0, 840)
    for (const escola of ['A', 'B', 'C']) {
      const daEscola = primeiroMinuto.filter((conta) => conta.escola === escola).length
      expect(daEscola, escola).toBeGreaterThan(250)
      expect(daEscola, escola).toBeLessThan(310)
    }
    const daEquipe = primeiroMinuto.filter((conta) => 'email' in conta).length
    expect(daEquipe).toBeGreaterThan(15)
    expect(daEquipe).toBeLessThan(35)
    expect(primeiroMinuto.filter((conta) => conta.erra === true)).toHaveLength(252)
  })

  it('a equipe do primeiro minuto cabe no limite por IP do login por e-mail (60 por minuto), com as que erram', () => {
    const tentativas = contas.rajada.slice(0, 840).reduce((soma, conta) => soma + ('email' in conta ? (conta.erra === true ? 2 : 1) : 0), 0)
    expect(tentativas).toBeLessThan(60)
  })

  it('isolamento dos grupos: o ataque nunca tenta uma conta legítima dos ataques, e a conta atacada de propósito é só a do dono com cookie', () => {
    const alvos = new Set(contas.alvosAtaqueMatricula)
    expect(alvos.size).toBe(ALUNOS_DA_A_ALVO_DO_ATAQUE)
    for (const conta of [...contas.aComCookie, ...contas.aSemCookie]) expect(alvos.has(conta.matricula), conta.matricula).toBe(false)
    const alvosEmail = new Set(contas.alvosAtaqueEmail)
    for (const conta of contas.equipeSemCookie) expect(alvosEmail.has(conta.email), conta.email).toBe(false)
    expect(alvosEmail.has(contas.equipeAlvo.email)).toBe(false)
    expect(contas.equipeSemCookie.map((conta) => conta.email)).not.toContain(contas.equipeAlvo.email)
    const comCookie = new Set(contas.aComCookie.map(chave))
    for (const conta of contas.aSemCookie) expect(comCookie.has(chave(conta))).toBe(false)
    expect(contas.aComCookie.every((conta) => conta.escola === 'A')).toBe(true)
    expect(contas.bFundo.every((conta) => conta.escola === 'B')).toBe(true)
    expect(contas.cFundo.every((conta) => conta.escola === 'C')).toBe(true)
  })

  it('a renovação tem as 600 contas que o k6 espera, de todas as escolas', () => {
    expect(contas.renovacao).toHaveLength(600)
    expect(new Set(contas.renovacao.map(chave)).size).toBe(600)
  })

  it('privacidade: só identificadores sintéticos, e a senha não vai para a linha de comando do k6', () => {
    for (const conta of contas.rajada) {
      if ('email' in conta) expect(conta.email).toMatch(/\.invalid$/)
      else expect(conta.matricula).toMatch(/^2026\d{4}$/)
    }
    for (const fase of [...FASES_DO_CENARIO, 'atacante'] as const) {
      const argumentos = argumentosDoK6DeLogin(fase, 12.3).join(' ')
      expect(argumentos).not.toContain(contas.senha)
      expect(argumentos).toContain('ARQUIVO_DAS_CONTAS=/execucao/contas.json')
      expect(argumentos).toContain('--no-usage-report')
    }
  })
})

describe('veredito do cenário "login às 7h30"', () => {
  it('passa só com todas as fases do k6 limpas e a conferência vazia', () => {
    const veredito = julgarCenarioDeLogin(FASES_DO_CENARIO, resumos(), conferencia())
    expect(veredito).toEqual({
      passou: true,
      reprovacoes: [],
      reprovadoPelaProtecao: false,
    })
    expect(codigoDeSaidaDoLogin(veredito, false)).toBe(0)
    // No controle negativo, passar é o erro: a proteção desligada não fez diferença nenhuma.
    expect(codigoDeSaidaDoLogin(veredito, true)).toBe(1)
  })

  it.each([
    ['o login da B acima de 1 s no ataque de fora', 'ataque_fora', 'login_duracao{grupo:b}'],
    ['as autenticadas da C acima da margem no ataque de dentro', 'ataque_dentro', 'autenticada_duracao{grupo:c}'],
    ['a conta da A sem cookie que não entrou em 30 s no ataque de dentro', 'ataque_dentro', 'login_erro_final{grupo:a_sem_cookie}'],
    ['429 para o dono da conta da equipe atacada, com cookie', 'ataque_fora', 'respostas_429{grupo:equipe_com_cookie}'],
  ] as const)('%s reprova pela proteção, e é o que o controle negativo precisa ver', (_caso, fase, metrica) => {
    const veredito = julgarCenarioDeLogin(FASES_DO_CENARIO, resumos({ [fase]: cruzado(metrica) }), conferencia())
    expect(veredito.passou).toBe(false)
    expect(veredito.reprovadoPelaProtecao).toBe(true)
    expect(codigoDeSaidaDoLogin(veredito, false)).toBe(1)
    expect(codigoDeSaidaDoLogin(veredito, true)).toBe(0)
  })

  it.each([
    ['p95 do login acima de 1 s na rajada, sem ataque', julgarCenarioDeLogin(FASES_DO_CENARIO, resumos({ rajada: cruzado('login_duracao{grupo:rajada}') }), conferencia())],
    ['família de sessão encerrada por reuso', julgarCenarioDeLogin(FASES_DO_CENARIO, resumos(), conferencia('1 família(s) de sessão encerrada(s) por reuso'))],
    ['o ataque que não chegou inteiro', julgarCenarioDeLogin(FASES_DO_CENARIO, resumos({ ataque_fora: cruzado('atacante:ataque_enviado') }), conferencia())],
    ['k6 que caiu sem threshold cruzado', julgarCenarioDeLogin(FASES_DO_CENARIO, resumos({ ataque_dentro: { codigo: 107, cruzados: [], valores: {} } }), conferencia())],
    [
      'k6 que saiu com zero e threshold cruzado no resumo',
      julgarCenarioDeLogin(
        FASES_DO_CENARIO,
        resumos({
          ataque_fora: { ...cruzado('login_duracao{grupo:b}'), codigo: 0 },
        }),
        conferencia(),
      ),
    ],
    ['fase de ataque que nem rodou', julgarCenarioDeLogin(FASES_DO_CENARIO, new Map([['base', limpo()]]), conferencia())],
    ['conferência que não rodou', julgarCenarioDeLogin(FASES_DO_CENARIO, resumos(), undefined)],
    [
      'base que já reprovou: sem base de pé, a degradação da B não prova nada',
      julgarCenarioDeLogin(
        FASES_DO_CENARIO,
        resumos({
          base: cruzado('login_duracao{grupo:b}'),
          ataque_fora: cruzado('login_duracao{grupo:b}'),
        }),
        conferencia(),
      ),
    ],
  ])('%s reprova o cenário, mas não conta como controle negativo aprovado', (_caso, veredito) => {
    expect(veredito.passou).toBe(false)
    expect(veredito.reprovadoPelaProtecao).toBe(false)
    expect(codigoDeSaidaDoLogin(veredito, false)).toBe(1)
    expect(codigoDeSaidaDoLogin(veredito, true)).toBe(1)
  })

  it('o controle negativo roda a base e os dois ataques, e todo critério da proteção é de um grupo que as fases de ataque medem', () => {
    expect(FASES_DO_CONTROLE_NEGATIVO).toEqual(['base', 'preparacao', 'ataque_fora', 'ataque_dentro'])
    const script = lerArquivo('infra/k6/login-7h30.js')
    for (const criterio of CRITERIOS_DA_PROTECAO) {
      const grupo = /\{grupo:([a-z_]+)\}/.exec(criterio)?.[1] ?? ''
      expect(script, criterio).toMatch(new RegExp(`'${grupo}'`))
    }
    const veredito = julgarCenarioDeLogin(
      FASES_DO_CONTROLE_NEGATIVO,
      resumos({ ataque_dentro: cruzado('login_erro_final{grupo:a_com_cookie}') }, FASES_DO_CONTROLE_NEGATIVO),
      conferencia(),
    )
    expect(codigoDeSaidaDoLogin(veredito, true)).toBe(0)
  })

  it('o threshold do atacante entra na fase dele, com prefixo, e o código de saída diferente de zero de qualquer um dos dois vale', () => {
    const junto = juntarAtacante(limpo({ 'login_duracao{grupo:b} p(95)': 40 }), {
      codigo: CODIGO_THRESHOLD_CRUZADO,
      cruzados: [{ metrica: 'ataque_enviado', criterio: 'count>=8550' }],
      valores: { 'ataque_enviado count': 10 },
    })
    expect(junto).toEqual({
      codigo: CODIGO_THRESHOLD_CRUZADO,
      cruzados: [{ metrica: 'atacante:ataque_enviado', criterio: 'count>=8550' }],
      valores: {
        'login_duracao{grupo:b} p(95)': 40,
        'atacante:ataque_enviado count': 10,
      },
    })
  })

  it('lê o --summary-export do k6: true no threshold é cruzado; a base das autenticadas é o maior p95 entre B e C', () => {
    const resumo = lerResumoDaFase(CODIGO_THRESHOLD_CRUZADO, {
      metrics: {
        'autenticada_duracao{grupo:b}': {
          'p(95)': 21.4,
          max: 90,
          thresholds: { 'p(95)<1000': false },
        },
        'autenticada_duracao{grupo:c}': {
          'p(95)': 33.9,
          max: 70,
          thresholds: { 'p(95)<1000': false },
        },
        'login_duracao{grupo:b}': {
          'p(95)': 1_200,
          thresholds: { 'p(95)<1000': true },
        },
        'respostas_429{grupo:b}': {
          count: 0,
          thresholds: { 'count==0': false },
        },
      },
    })
    expect(resumo.cruzados).toEqual([{ metrica: 'login_duracao{grupo:b}', criterio: 'p(95)<1000' }])
    expect(autenticadaBaseP95(resumo)).toBe(33.9)
    expect(autenticadaBaseP95(lerResumoDaFase(0, undefined))).toBeUndefined()
    expect(argumentosDoK6DeLogin('ataque_fora', 33.9)).toContain('AUTENTICADA_BASE_P95_MS=34')
    expect(argumentosDoK6DeLogin('base').some((argumento) => argumento.startsWith('AUTENTICADA_BASE_P95_MS'))).toBe(false)
  })

  it('o registro da fase leva o p95 do login por grupo e o tempo até entrar da A e da equipe sob ataque, e deixa de fora o que não é medida do cenário', () => {
    const linhas = descreverFase(
      'ataque_dentro',
      limpo({
        'login_duracao{grupo:b} p(95)': 274.4,
        'ate_entrar_a_sem_cookie p(95)': 5_120.6,
        'ate_entrar_equipe_com_cookie max': 310,
        'respostas_503{grupo:a_sem_cookie} count': 12,
        'http_req_duration p(95)': 80,
        'ate_entrar_a_sem_cookie count': 151,
      }),
    )
    expect(linhas).toEqual([
      '\nataque_dentro:',
      '  ataque_dentro: login_duracao{grupo:b} p(95) = 274',
      '  ataque_dentro: ate_entrar_a_sem_cookie p(95) = 5121',
      '  ataque_dentro: ate_entrar_equipe_com_cookie max = 310',
      '  ataque_dentro: respostas_503{grupo:a_sem_cookie} count = 12',
    ])
  })

  it('--fases roda a base, a preparação com qualquer ataque e as pedidas, na ordem do cenário, e recusa fase que não existe', () => {
    expect(fasesPedidas([], false)).toEqual(FASES_DO_CENARIO)
    expect(fasesPedidas([], true)).toEqual(FASES_DO_CONTROLE_NEGATIVO)
    expect(fasesPedidas(['--fases', 'redis_fora,rajada'], false)).toEqual(['base', 'rajada', 'preparacao', 'redis_fora'])
    expect(fasesPedidas(['--fases', 'renovacao'], false)).toEqual(['base', 'renovacao'])
    expect(() => fasesPedidas(['--fases', 'rajada'], true)).toThrow('--fases')
    expect(() => fasesPedidas(['--fases', ''], false)).toThrow('--fases')
  })
})

describe('conferência do cenário "login às 7h30"', () => {
  const serie = (valores: number[], inicio = 1_000): Array<readonly [number, string]> =>
    valores.map((valor, posicao) => [inicio + posicao * PASSO_DA_CONSULTA_S, String(valor)] as const)

  it('o alerta de 5xx dispararia só com 5 min seguidos acima de 5%: 31 pontos a cada 10 s', () => {
    expect(dispararia(serie(Array.from({ length: 31 }, () => 0.06)))).toBe(true)
    expect(dispararia(serie(Array.from({ length: 30 }, () => 0.06)))).toBe(false)
    expect(dispararia(serie([...Array.from({ length: 20 }, () => 0.06), 0.05, ...Array.from({ length: 20 }, () => 0.06)]))).toBe(false)
    // Um buraco na série (rota sem requisição) quebra o trecho, como no alerta.
    expect(
      dispararia([
        ...serie(Array.from({ length: 20 }, () => 0.9)),
        ...serie(
          Array.from({ length: 20 }, () => 0.9),
          1_000 + 21 * PASSO_DA_CONSULTA_S,
        ),
      ]),
    ).toBe(false)
  })

  it('o rebaixamento só pode aparecer na A e só nos ataques, e cada ataque precisa rebaixar a A', () => {
    const certo = [
      { fase: 'rajada', escola: 'A', maximo: 0 },
      { fase: 'ataque_fora', escola: 'A', maximo: 1 },
      { fase: 'ataque_fora', escola: 'B', maximo: 0 },
      { fase: 'ataque_dentro', escola: 'A', maximo: 1 },
    ]
    const rodaram = ['base', 'rajada', 'ataque_fora', 'ataque_dentro']
    expect(julgarRebaixamento(certo, 'A', rodaram)).toEqual([])
    expect(julgarRebaixamento([...certo, { fase: 'rajada', escola: 'C', maximo: 1 }], 'A', rodaram)).toEqual([
      'rajada: login.prioridade_rebaixada em 1 na escola C, fora de ataque',
    ])
    expect(julgarRebaixamento([...certo, { fase: 'ataque_dentro', escola: 'B', maximo: 1 }], 'A', rodaram)).toEqual([
      'ataque_dentro: login.prioridade_rebaixada em 1 na escola B, que não era a atacada',
    ])
    expect(julgarRebaixamento([{ fase: 'ataque_fora', escola: 'B', maximo: 0 }], 'A', ['ataque_fora'])).toEqual(['ataque_fora: o ataque não rebaixou a escola A'])
  })

  it('o ataque que rodou e não rebaixou ninguém não deixa série no Prometheus, e mesmo assim reprova: as fases vêm das janelas', () => {
    expect(julgarRebaixamento([], 'A', ['base', 'rajada', 'ataque_fora', 'ataque_dentro', 'redis_fora'])).toEqual([
      'ataque_fora: o ataque não rebaixou a escola A',
      'ataque_dentro: o ataque não rebaixou a escola A',
      'redis_fora: o ataque não rebaixou a escola A',
    ])
    // Só a fase de ataque que rodou é cobrada: a execução parcial (--fases rajada) não tem ataque.
    expect(julgarRebaixamento([], 'A', ['base', 'rajada'])).toEqual([])
  })
})

interface ServicoDaCarga {
  cpus?: number
  environment?: Record<string, string>
  image?: string
  profiles?: string[]
  volumes?: string[]
}

describe('ambiente do cenário "login às 7h30"', () => {
  const { services: carga } = parse(lerArquivo('infra/compose.carga.yml'), {
    merge: true,
  }) as { services: Record<string, ServicoDaCarga> }
  const daCarga = parseEnv(lerArquivo('infra/carga.env'))
  const doExemplo = parseEnv(lerArquivo('.env.example'))

  it('as duas APIs são a CPU de referência: 1 CPU cada', () => {
    expect(carga['api-1']?.cpus).toBe(1)
    expect(carga['api-2']?.cpus).toBe(1)
  })

  it('o hash calibrado é uma configuração que a API aceita: nunca abaixo da OWASP, e a concorrência dentro das threads fixas', () => {
    expect(Number(daCarga['LOGIN_ARGON2_MEMORIA_KIB'])).toBeGreaterThanOrEqual(MEMORIA_MINIMA_ARGON2_KIB)
    expect(Number(daCarga['LOGIN_ARGON2_ITERACOES'])).toBeGreaterThan(ITERACOES_MINIMAS_ARGON2)
    expect(Number(daCarga['UV_THREADPOOL_SIZE'])).toBe(16)
    expect(Number(daCarga['LOGIN_HASH_CONCORRENCIA'])).toBeLessThanOrEqual(Number(daCarga['UV_THREADPOOL_SIZE']) - THREADS_DE_FOLGA_DO_LIBUV)
  })

  it('o atacante é um segundo container, com IP próprio, a mesma versão do k6 e CPU fixa, e só sobe por perfil', () => {
    const atacante = carga['k6-atacante']
    expect(atacante?.image).toBe(carga['k6']?.image)
    expect(atacante?.profiles).toEqual(['carga'])
    expect(atacante?.cpus).toBeGreaterThan(0)
    expect(atacante?.environment?.['K6_NO_USAGE_REPORT']).toBe('true')
  })

  it('permissão: a proteção do login nunca vem desligada do arquivo; só o controle negativo liga, pela linha de comando', () => {
    expect(lerArquivo('infra/compose.carga.yml')).not.toContain('LOGIN_PROTECAO_DESLIGADA')
    expect(daCarga['LOGIN_PROTECAO_DESLIGADA']).toBeUndefined()
    expect(doExemplo['LOGIN_PROTECAO_DESLIGADA']).toBe('false')
  })

  it('o cenário só chama as rotas do login por matrícula e e-mail, a renovação e as autenticadas, as do Início do aluno entre elas: nem o login externo (oidc-falso), nem provedor pago (regra 80, item 11)', () => {
    const script = lerArquivo('infra/k6/login-7h30.js')
    // A rota vem depois de `${API}` ou como texto entre aspas (o `caminho` das autenticadas); `GET /v1/...` é o nome da tag, e não entra.
    const rotas = new Set([...script.matchAll(/(?:\$\{API\}|['"`])(\/v1\/[^`'"$]*)/g)].map((achado) => achado[1]))
    expect([...rotas].sort()).toEqual(['/v1/eu', '/v1/minhas-atividades', '/v1/sessao/email', '/v1/sessao/matricula', '/v1/sessao/renovar', '/v1/sistema/contexto'])
    expect(argumentosDoK6DeLogin('atacante')).toContain('API_URL=http://borda:8080')
  })
})

describe('o Início do aluno na rajada do cenário "login às 7h30"', () => {
  const script = lerArquivo('infra/k6/login-7h30.js')

  it('o seed enche a primeira página: mais atividades por turma do que cabem nela, turmas de 35 e tentativa só nas mais novas', () => {
    expect(ATIVIDADES_POR_TURMA).toBeGreaterThan(TAMANHO_PADRAO_DA_PAGINA)
    expect(ALUNOS_POR_TURMA).toBe(35)
    expect(turmasDaEscola(ALUNOS_POR_ESCOLA)).toBe(20)
    expect(turmasDaEscola(35)).toBe(1)
    expect(turmasDaEscola(36)).toBe(2)
    expect(ATIVIDADES_NOVAS_COM_TENTATIVA).toBeLessThan(TAMANHO_PADRAO_DA_PAGINA)
    expect(ATIVIDADES_NOVAS_ENVIADAS).toBeLessThanOrEqual(ATIVIDADES_NOVAS_COM_TENTATIVA)
  })

  it('a rajada julga o p95 de todas as autenticadas e o da minhas-atividades sozinho, no mesmo limite de 1 s do login', () => {
    expect(script).toContain("'autenticada_duracao{grupo:rajada}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`]")
    expect(script).toContain('[`autenticada_duracao{grupo:rajada,name:${ROTA_DAS_TAREFAS}}`]: [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`]')
    expect(script).toContain("export const ROTA_DAS_TAREFAS = 'GET /v1/minhas-atividades'")
    expect(script).toContain('export const P95_MAXIMO_DO_LOGIN_MS = 1_000')
  })

  it('as duas leituras entram em autenticada_duracao com a tag name da rota, e a página vazia conta como resposta inesperada', () => {
    expect(script).toContain('duracaoAutenticada.add(resposta.timings.duration, { grupo, name: nome })')
    expect(script).toContain("autenticada(token, grupo, '/v1/eu', ROTA_DO_EU)")
    expect(script).toContain("autenticada(token, grupo, '/v1/minhas-atividades', ROTA_DAS_TAREFAS)")
    expect(script).toContain("itens.length > 0) ? 0 : 1, { grupo, status: 'pagina_vazia' }")
    // Só o aluno tem Início: a conta de matrícula lê as duas rotas, e a da equipe, não.
    expect(script).toContain("if (conta.matricula !== undefined) leituraDoInicio(token, 'rajada')")
  })
})
