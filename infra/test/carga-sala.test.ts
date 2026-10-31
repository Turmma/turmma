import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { errosDasLinhas, lerTextoDaLista } from '../../apps/api/src/estrutura/lista/lista-reader.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { CODIGO_THRESHOLD_CRUZADO } from '../scripts/carga.ts'
import type { ResumoDaFase } from '../scripts/carga-login.ts'
import {
  ALUNOS_POR_TURMA,
  argumentosDoK6DaSala,
  CICLO_DO_REDIS_MS,
  descreverFase,
  ESCALA,
  FASES_DO_CENARIO,
  fasesPedidas,
  julgarCenarioDaSala,
  juntarOutraEscola,
  montarAlunos,
  PAUSA_DO_REDIS_MS,
  textoDaLista,
  TURMAS_POR_PROFESSOR,
  turmasDosProfessores,
  type FaseDaSala,
} from '../scripts/carga-sala.ts'
import { julgarContagem, type ContagemDaEscola, type ConferenciaDaSala } from '../scripts/conferir-carga-sala.ts'

/**
 * O cenário "reivindicação em sala" sem subir nada (A1, tarefa 9.0; cenarios.md, K1 e K2): os alunos gerados, o veredito,
 * a conferência de duplicidade e o que o k6 chama. A execução de verdade é `npm run carga:sala`, manual, com o resultado
 * registrado na tarefa (runbook, "Rodar o cenário da sala").
 */

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

const limpo = (valores: Record<string, number> = {}): ResumoDaFase => ({ codigo: 0, cruzados: [], valores })
const cruzado = (...metricas: string[]): ResumoDaFase => ({ codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: metricas.map((metrica) => ({ metrica, criterio: 'x' })), valores: {} })
const conferencia = (...reprovacoes: string[]): ConferenciaDaSala => ({ linhas: [], reprovacoes })
/** O resumo de uma fase com a outra escola medida, como o `juntarOutraEscola` deixa. */
const comOutra = (resumo: ResumoDaFase = limpo()): ResumoDaFase => juntarOutraEscola(resumo, limpo({ 'login_duracao{grupo:outra_escola} p(95)': 120 }))
function resumos(trocas: Partial<Record<FaseDaSala, ResumoDaFase>> = {}): Map<FaseDaSala, ResumoDaFase> {
  return new Map(FASES_DO_CENARIO.map((fase) => [fase, trocas[fase] ?? (ESCALA[fase].comOutraEscola ? comOutra() : limpo())]))
}

describe('os alunos do cenário "reivindicação em sala"', () => {
  it('K1 tem seis turmas de 35 (210) e o K2, sessenta (2.100); cada aluno uma vez, com nome e matrícula únicos na escola', () => {
    expect(montarAlunos(ESCALA.k1)).toHaveLength(210)
    const k2 = montarAlunos(ESCALA.k2)
    expect(k2).toHaveLength(2_100)
    expect(new Set(k2.map((aluno) => aluno.matricula)).size).toBe(2_100)
    expect(new Set(k2.map((aluno) => `${String(aluno.turma)}|${aluno.nome}`)).size).toBe(2_100)
    for (let turma = 0; turma < ESCALA.k2.turmas; turma++) expect(k2.filter((aluno) => aluno.turma === turma), String(turma)).toHaveLength(ALUNOS_POR_TURMA)
  })

  it('20% erram o código, 10% erram a matrícula e dois por turma disputam o nome, espalhados pela chegada inteira', () => {
    for (const fase of FASES_DO_CENARIO) {
      const alunos = montarAlunos(ESCALA[fase])
      expect(alunos.filter((aluno) => aluno.erraCodigo).length / alunos.length, fase).toBe(0.2)
      expect(alunos.filter((aluno) => aluno.erraMatricula).length / alunos.length, fase).toBe(0.1)
      expect(alunos.filter((aluno) => aluno.disputa), fase).toHaveLength(2 * ESCALA[fase].turmas)
      // Quem erra o código entra pelo código; o link e o código dividem a sala.
      expect(alunos.filter((aluno) => aluno.erraCodigo && !aluno.peloCodigo), fase).toEqual([])
      expect(alunos.filter((aluno) => !aluno.peloCodigo).length, fase).toBeGreaterThan(0)
      // O primeiro décimo da chegada já tem erro de código e de matrícula: nenhum grupo fica para o fim.
      const inicio = alunos.slice(0, alunos.length / 10)
      expect(inicio.some((aluno) => aluno.erraCodigo) && inicio.some((aluno) => aluno.erraMatricula), fase).toBe(true)
    }
  })

  it('o K2 erra uns 420 códigos, abaixo do teto de 1.000 da escola: a manhã do primeiro dia não chega ao alerta', () => {
    expect(montarAlunos(ESCALA.k2).filter((aluno) => aluno.erraCodigo)).toHaveLength(420)
  })

  it('a lista que a coordenação cola passa pelo leitor da lista da API sem erro nenhum, e é só da turma', () => {
    for (const fase of FASES_DO_CENARIO) {
      const alunos = montarAlunos(ESCALA[fase])
      const linhas = lerTextoDaLista(textoDaLista(alunos, 3))
      expect(linhas, fase).toHaveLength(ALUNOS_POR_TURMA)
      expect(errosDasLinhas(linhas).filter((erro) => erro !== undefined), fase).toEqual([])
      expect(linhas.map((linha) => linha.matricula), fase).toEqual(alunos.filter((aluno) => aluno.turma === 3).map((aluno) => aluno.matricula))
    }
  })

  it('cada professor tem até seis turmas, e toda turma tem um professor só', () => {
    expect(turmasDosProfessores(60)).toHaveLength(10)
    expect(turmasDosProfessores(6)).toEqual([[0, 1, 2, 3, 4, 5]])
    expect(turmasDosProfessores(12).flat()).toEqual(Array.from({ length: 12 }, (_, turma) => turma))
    for (const turmas of turmasDosProfessores(60)) expect(turmas.length).toBeLessThanOrEqual(TURMAS_POR_PROFESSOR)
  })
})

describe('veredito do cenário "reivindicação em sala"', () => {
  it('passa só com as três fases limpas, a outra escola medida no K1 e no K2, e a conferência vazia', () => {
    expect(julgarCenarioDaSala(FASES_DO_CENARIO, resumos(), conferencia())).toEqual({ passou: true, reprovacoes: [] })
  })

  it.each([
    ['5xx numa reivindicação do K2', { k2: comOutra(cruzado('respostas_5xx')) }, conferencia(), 'k2:respostas_5xx'],
    ['disputa com dois pedidos aceitos', { k1: comOutra(cruzado('disputa_sem_um_vencedor')) }, conferencia(), 'k1:disputa_sem_um_vencedor'],
    ['p95 do login da outra escola acima de 1 s', { k2: juntarOutraEscola(limpo(), cruzado('login_duracao{grupo:outra_escola}')) }, conferencia(), 'k2:outra_escola:login_duracao{grupo:outra_escola}'],
    ['decidir acima de 2 s com o Redis lento', { k2_redis_lento: cruzado('decidir_duracao') }, conferencia(), 'k2_redis_lento:decidir_duracao'],
    ['a outra escola que nem rodou no K1', { k1: limpo() }, conferencia(), 'k1:outra_escola'],
    ['k6 que caiu sem threshold cruzado', { k2: { ...comOutra(), codigo: 107 } }, conferencia(), 'k2:k6'],
    ['duplicidade no banco', {}, conferencia('k2: nomes com dois pedidos pendentes ou aprovados: 1, e o cenário pede 0'), 'conferencia'],
  ] as const)('%s reprova', (_caso, trocas, conferida, criterio) => {
    const veredito = julgarCenarioDaSala(FASES_DO_CENARIO, resumos(trocas), conferida)
    expect(veredito.passou).toBe(false)
    expect(veredito.reprovacoes.map((reprovacao) => reprovacao.criterio)).toContain(criterio)
  })

  it('fase que não rodou e conferência que não rodou reprovam', () => {
    expect(julgarCenarioDaSala(FASES_DO_CENARIO, new Map([['k1', comOutra()]]), undefined).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['k2:k6', 'k2_redis_lento:k6', 'conferencia'])
  })

  it('--fases roda as pedidas, na ordem do cenário, e recusa fase que não existe', () => {
    expect(fasesPedidas([])).toEqual(FASES_DO_CENARIO)
    expect(fasesPedidas(['--fases', 'k2_redis_lento,k1'])).toEqual(['k1', 'k2_redis_lento'])
    expect(() => fasesPedidas(['--fases', 'k3'])).toThrow('--fases')
    expect(() => fasesPedidas(['--fases', ''])).toThrow('--fases')
  })

  it('o registro da fase leva o p95 do login, do decidir e o maior lote, e deixa de fora o que não é medida do cenário', () => {
    const linhas = descreverFase('k2', comOutra(limpo({ 'decidir_duracao p(95)': 812.4, 'decidir_lote max': 40, 'aprovados count': 2_100, 'http_req_duration p(95)': 80 })))
    expect(linhas).toEqual([
      '\nk2:',
      '  k2: decidir_duracao p(95) = 812',
      '  k2: decidir_lote max = 40',
      '  k2: aprovados count = 2100',
      '  k2: outra_escola:login_duracao{grupo:outra_escola} p(95) = 120',
    ])
  })
})

describe('conferência de duplicidade no banco', () => {
  const certa: ContagemDaEscola = { nomesAprovados: 210, nomesSemAprovar: 0, pedidosAprovados: 210, pedidosPendentes: 0, nomesComDoisPedidos: 0, alunos: 210, credenciais: 210, alunosComDoisVinculos: 0 }

  it('todos os nomes aprovados uma vez, um aluno por nome: nada a reprovar', () => {
    expect(julgarContagem('k1', 210, certa)).toEqual([])
  })

  it.each([
    ['um nome com dois pedidos', { nomesComDoisPedidos: 1 }],
    ['um aluno a mais que os nomes', { alunos: 211 }],
    ['uma credencial a mais', { credenciais: 211 }],
    ['um aluno com dois vínculos', { alunosComDoisVinculos: 1 }],
    ['um pedido esperando no fim', { pedidosPendentes: 1, pedidosAprovados: 209 }],
    ['um nome que não terminou aprovado', { nomesSemAprovar: 1, nomesAprovados: 209 }],
  ])('%s reprova', (_caso, troca) => {
    expect(julgarContagem('k1', 210, { ...certa, ...troca }).length).toBeGreaterThan(0)
  })
})

describe('o k6 e o ambiente do cenário "reivindicação em sala"', () => {
  it('a senha, o link e o código não vão para a linha de comando do k6: ficam no arquivo da pasta da execução', () => {
    for (const fase of FASES_DO_CENARIO) {
      for (const outra of [false, true]) {
        const argumentos = argumentosDoK6DaSala(fase, outra).join(' ')
        expect(argumentos).toContain(`ARQUIVO_DAS_CONTAS=/execucao/contas-${fase}.json`)
        expect(argumentos).toContain('--no-usage-report')
        expect(argumentos).toContain('API_URL=http://borda:8080')
        expect(argumentos).toContain(outra ? 'FASE=outra_escola' : `FASE=${fase}`)
        expect(argumentos).not.toMatch(/senha|token|codigo/i)
      }
    }
  })

  it('o cenário só chama a página da sala, os pedidos, o decidir, o login por matrícula e uma autenticada: nada de provedor pago (regra 80, item 11)', () => {
    const script = lerArquivo('infra/k6/reivindicacao-em-sala.js')
    const rotas = new Set([...script.matchAll(/(?:\$\{API\}|post\(')(\/v1\/[^`'"?]*)/g)].map((achado) => achado[1]))
    expect([...rotas].sort()).toEqual([
      '/v1/reivindicacoes/decidir',
      '/v1/salas/abrir',
      '/v1/salas/reivindicar',
      '/v1/sessao/matricula',
      '/v1/sistema/contexto',
      '/v1/turmas/${turma.id}/reivindicacoes',
    ])
  })

  it('os thresholds do K1 e do K2 são os do cenário: zero 5xx, zero duplicidade, o decidir em 2 s e o login da outra escola em 1 s', () => {
    const script = lerArquivo('infra/k6/reivindicacao-em-sala.js')
    expect(script).toContain("respostas_5xx: ['count==0']")
    expect(script).toContain("disputa_sem_um_vencedor: ['count==0']")
    expect(script).toContain('pedidos_enviados: [`count==${alunos}`]')
    expect(script).toContain('aprovados: [`count==${alunos}`]')
    expect(script).toContain('decidir_duracao: [`p(95)<${P95_MAXIMO_DO_DECIDIR_MS}`]')
    expect(script).toMatch(/export const P95_MAXIMO_DO_DECIDIR_MS = 2_000/)
    expect(script).toMatch(/export const P95_MAXIMO_DO_LOGIN_MS = 1_000/)
    expect(script).toContain("'login_duracao{grupo:outra_escola}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`]")
    expect(script).toMatch(/export const LOTE_DO_DECIDIR = 40/)
  })

  it('o Redis lento responde abaixo do corte de 100 ms do cliente do login da carga: lento, e não fora', () => {
    const daCarga = Object.fromEntries(lerArquivo('infra/carga.env').split('\n').filter((linha) => /^[A-Z_]+=/.test(linha)).map((linha) => linha.split('=') as [string, string]))
    expect(PAUSA_DO_REDIS_MS).toBeLessThan(Number(daCarga['LOGIN_REDIS_PRAZO_MS']))
    expect(PAUSA_DO_REDIS_MS).toBeLessThan(CICLO_DO_REDIS_MS)
  })

  it('`npm run carga:sala` compila a API e roda o cenário', () => {
    const pacote = JSON.parse(lerArquivo('package.json')) as { scripts: Record<string, string> }
    expect(pacote.scripts['carga:sala']).toMatch(/build -w @educa\/api && node infra\/scripts\/carga-sala\.ts$/)
  })
})
