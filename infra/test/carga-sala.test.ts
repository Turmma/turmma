import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lerTextoDaLista } from '../../apps/api/src/estrutura/lista/lista-reader.ts'
import { classificar } from '../../packages/core/src/importacao/tipos/alunos.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { CODIGO_THRESHOLD_CRUZADO, lerAmbienteDeCarga } from '../scripts/carga.ts'
import type { ResumoDaFase } from '../scripts/carga-login.ts'
import {
  ALUNOS_POR_TURMA,
  argumentosDoK6DaSala,
  chavesDoBaldeAnonimo,
  CICLO_DO_REDIS_MS,
  descreverFase,
  ESCALA,
  FASES_DO_CENARIO,
  fasesPedidas,
  FRACAO_DO_TETO_DO_BALDE,
  julgarCenarioDaSala,
  julgarPicoDoBalde,
  juntarOutraEscola,
  montarAlunos,
  PAUSA_DO_REDIS_MS,
  pedePelaConta,
  type PicoDoBalde,
  reduzirLeiturasDoBalde,
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

  it('na escola sem Workspace, 1 em cada 20 prova a conta da escola, espalhados pela chegada inteira, e quem prova não erra nada nem disputa o nome', () => {
    for (const fase of FASES_DO_CENARIO.filter((fase) => ESCALA[fase].pelaConta === 'um_em_vinte')) {
      const alunos = montarAlunos(ESCALA[fase])
      const viaConta = alunos.filter((aluno) => aluno.viaConta)
      expect(viaConta.length / alunos.length, fase).toBeGreaterThan(0.04)
      expect(viaConta.length / alunos.length, fase).toBeLessThanOrEqual(0.05)
      expect(viaConta.filter((aluno) => aluno.erraCodigo || aluno.erraMatricula || aluno.disputa), fase).toEqual([])
      expect(alunos.slice(0, alunos.length / 10).some((aluno) => aluno.viaConta), fase).toBe(true)
    }
  })

  it('o `k2_conta` é a escola da D48: ao menos 80% prova a conta da escola, nenhum disputa o nome nem erra a matrícula, e o K2 e o K1 seguem com 1 em 20', () => {
    const alunos = montarAlunos(ESCALA.k2_conta)
    const viaConta = alunos.filter((aluno) => aluno.viaConta)
    expect(alunos).toHaveLength(2_100)
    expect(ESCALA.k2_conta.comOutraEscola).toBe(true)
    expect(viaConta.length / alunos.length).toBeGreaterThanOrEqual(0.8)
    expect(viaConta.filter((aluno) => aluno.disputa || aluno.erraMatricula)).toEqual([])
    // A matrícula fica para quem erra, para quem disputa e para o resto: o caminho dela continua medido.
    expect(alunos.filter((aluno) => !aluno.viaConta).length).toBeGreaterThan(0)
    expect(alunos.slice(0, alunos.length / 10).filter((aluno) => aluno.viaConta).length / (alunos.length / 10)).toBeGreaterThanOrEqual(0.8)
    expect(ESCALA.k2.pelaConta).toBe('um_em_vinte')
    expect(ESCALA.k1.pelaConta).toBe('um_em_vinte')
    // O primeiro dia é da escola que chega inteira (K2 e `k2_conta`): é ele que faz a conferência cobrar zero pedido segurado pelo teto de códigos errados.
    expect(FASES_DO_CENARIO.filter((fase) => ESCALA[fase].primeiroDia)).toEqual(['k2', 'k2_conta'])
    expect(ESCALA.k2_conta.primeiroDia).toBe(true)
    expect(montarAlunos(ESCALA.k2).filter((aluno) => aluno.viaConta).length / 2_100).toBeLessThanOrEqual(0.05)
  })

  it('quem pede pela conta: a disputa nunca; no modo da D48 todos menos quem erra a matrícula; no outro, 1 em 20 pela posição de chegada', () => {
    expect(pedePelaConta('quase_todos', 5, 0, true)).toBe(false)
    expect(pedePelaConta('quase_todos', 5, 2, false)).toBe(false)
    expect(pedePelaConta('quase_todos', 5, 3, false)).toBe(true)
    expect(pedePelaConta('um_em_vinte', 9, 3, false)).toBe(true)
    expect(pedePelaConta('um_em_vinte', 10, 3, false)).toBe(false)
    expect(pedePelaConta('um_em_vinte', 9, 3, true)).toBe(false)
  })

  it('o K2 erra uns 420 códigos, abaixo do teto de 1.000 da escola: a manhã do primeiro dia não chega ao alerta', () => {
    expect(montarAlunos(ESCALA.k2).filter((aluno) => aluno.erraCodigo)).toHaveLength(420)
  })

  it('a lista que a coordenação cola passa pelo leitor da lista da API sem erro nenhum, e é só da turma', () => {
    for (const fase of FASES_DO_CENARIO) {
      const alunos = montarAlunos(ESCALA[fase])
      const linhas = lerTextoDaLista(textoDaLista(alunos, 3))
      expect(linhas, fase).toHaveLength(ALUNOS_POR_TURMA)
      // A classificação da planilha de alunos, com a turma dada: nenhuma linha da lista da carga tem erro.
      const turma = { id: 'turma-da-carga', nome: 'Turma 04', chave: null, serie: { id: 'serie-da-carga', etapa: 'em' as const, ano: 1 } }
      const classificada = classificar('ano-da-carga', linhas.map((linha) => ({ ...linha, turma: '', turmaId: turma.id })), [turma], new Set())
      expect(classificada.linhas.filter((linha) => linha.resultado === 'erro'), fase).toEqual([])
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
  it('passa só com as quatro fases limpas, a outra escola medida no K1, no K2 e no `k2_conta`, o pico do balde de cada uma e a conferência vazia', () => {
    const picos = new Map<FaseDaSala, PicoDoBalde>(FASES_DO_CENARIO.map((fase) => [fase, { pico: 3_400, teto: 6_000 }]))
    expect(julgarCenarioDaSala(FASES_DO_CENARIO, resumos(), conferencia(), picos)).toEqual({ passou: true, reprovacoes: [] })
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
    expect(julgarCenarioDaSala(FASES_DO_CENARIO, new Map([['k1', comOutra()]]), undefined).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['k2:k6', 'k2_conta:k6', 'k2_redis_lento:k6', 'conferencia'])
  })

  it('o pico do balde anônimo por IP acima de 80% do teto reprova, o de até 80% passa, e o `k2_conta` sem pico medido reprova', () => {
    const picos = (k2_conta: PicoDoBalde, outras: PicoDoBalde = { pico: 100, teto: 6_000 }) => new Map<FaseDaSala, PicoDoBalde>([['k1', outras], ['k2', outras], ['k2_conta', k2_conta], ['k2_redis_lento', outras]])
    const criterios = (mapa: Map<FaseDaSala, PicoDoBalde>) => julgarCenarioDaSala(FASES_DO_CENARIO, resumos(), conferencia(), mapa).reprovacoes.map((reprovacao) => reprovacao.criterio)

    expect(criterios(picos({ pico: 4_800, teto: 6_000 }))).toEqual([])
    expect(criterios(picos({ pico: 4_801, teto: 6_000 }))).toEqual(['k2_conta:balde'])
    expect(criterios(picos({ pico: 100, teto: 6_000 }, { pico: 5_000, teto: 6_000 }))).toEqual(['k1:balde', 'k2:balde', 'k2_redis_lento:balde'])
    expect(julgarCenarioDaSala(FASES_DO_CENARIO, resumos(), conferencia()).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['k2_conta:balde'])
    // Pico 0 não é medida: a conta da escola passa quase todo mundo pelo balde, e um balde vazio é leitura que falhou. As outras fases, que quase não o usam, seguem passando.
    expect(criterios(picos({ pico: 0, teto: 6_000 }))).toEqual(['k2_conta:balde'])
    expect(criterios(picos({ pico: 100, teto: 6_000 }, { pico: 0, teto: 6_000 }))).toEqual([])
    expect(julgarPicoDoBalde('k2_conta', { pico: 4_801, teto: 6_000 })).toContain('4801 de 6000')
    expect(julgarPicoDoBalde('k2_conta', { pico: 4_800, teto: 6_000 })).toBeUndefined()
  })

  it('o balde anônimo é o `rl:ip:<ip>`: a entrada da operação (`rl:ip:op:`), o "esqueci a senha" (`rl:ip:senha:`), o login (`rl:ip-login:`) e os outros baldes ficam de fora', () => {
    expect(chavesDoBaldeAnonimo(['rl:ip:172.20.0.5', 'rl:ip:op:172.20.0.5', 'rl:ip:senha:abc123', 'rl:ip-login:172.20.0.5', 'rl:u:abc', 'rl:e:abc', 'rl:ip:fd00::1'])).toEqual(['rl:ip:172.20.0.5', 'rl:ip:fd00::1'])
  })

  it('o pico medido é o maior valor das leituras, e sem nenhuma leitura que achou a chave o pico não foi medido (`undefined`, e não 0)', () => {
    expect(reduzirLeiturasDoBalde([])).toBeUndefined()
    expect(reduzirLeiturasDoBalde([0])).toBe(0)
    expect(reduzirLeiturasDoBalde([120, 3_579, 800])).toBe(3_579)
    expect(reduzirLeiturasDoBalde([3_579])).toBe(3_579)
  })

  it('o teto que a carga recebe é o do `.env.example`, e a previsão do primeiro dia pela conta (cerca de 3.400 por minuto) passa no corte de 80% dele', () => {
    const teto = Number(lerAmbienteDeCarga()['LIMITE_REQ_IP_ANONIMO_MIN'])
    expect(teto).toBe(6_000)
    expect(FRACAO_DO_TETO_DO_BALDE).toBe(0.8)
    expect(julgarPicoDoBalde('k2_conta', { pico: 3_400, teto })).toBeUndefined()
  })

  it('--fases roda as pedidas, na ordem do cenário, e recusa fase que não existe', () => {
    expect(fasesPedidas([])).toEqual(FASES_DO_CENARIO)
    expect(fasesPedidas(['--fases', 'k2_redis_lento,k2_conta,k1'])).toEqual(['k1', 'k2_conta', 'k2_redis_lento'])
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
  const certa: ContagemDaEscola = { nomesAprovados: 210, nomesSemAprovar: 0, pedidosAprovados: 210, pedidosPendentes: 0, nomesComDoisPedidos: 0, alunos: 210, credenciais: 210, contasLigadas: 0, entraramPelaConta: 0, alunosComDoisVinculos: 0 }

  it('todos os nomes aprovados uma vez, um aluno por nome: nada a reprovar', () => {
    expect(julgarContagem('k1', 210, certa)).toEqual([])
  })

  it('quem pediu pela conta da escola tem a conta ligada, uma por aluno, além da credencial de matrícula', () => {
    const comContas = { ...certa, contasLigadas: 10, entraramPelaConta: 10 }

    expect(julgarContagem('k1', 210, comContas, 10)).toEqual([])
    expect(julgarContagem('k1', 210, { ...comContas, contasLigadas: 9 }, 10).join(' ')).toContain('contas da escola ligadas')
    expect(julgarContagem('k1', 210, { ...comContas, contasLigadas: 11 }, 10).join(' ')).toContain('contas da escola ligadas')
    // Sem ninguém pela conta, a conta ligada é um excesso.
    expect(julgarContagem('k1', 210, { ...certa, contasLigadas: 1 }).join(' ')).toContain('contas da escola ligadas')
  })

  it('todo aluno que pediu pela conta e foi aprovado entra pela conta: uma sessão `externo` por aluno ligado, e nenhuma a mais', () => {
    const daConta = { ...certa, contasLigadas: 180, entraramPelaConta: 180 }

    expect(julgarContagem('k2_conta', 210, daConta, 180)).toEqual([])
    expect(julgarContagem('k2_conta', 210, { ...daConta, entraramPelaConta: 179 }, 180).join(' ')).toContain('entraram pela conta da escola')
    expect(julgarContagem('k2_conta', 210, { ...daConta, entraramPelaConta: 0 }, 180).join(' ')).toContain('nenhum aluno entrou pela conta')
    // Sem ninguém pela conta, uma sessão `externo` é excesso.
    expect(julgarContagem('k2', 210, { ...certa, entraramPelaConta: 1 }).join(' ')).toContain('entraram pela conta da escola')
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
      '/v1/escolas/${SLUG}/acesso',
      '/v1/reivindicacoes/decidir',
      '/v1/salas/abrir',
      '/v1/salas/reivindicar',
      '/v1/sessao/matricula',
      '/v1/sessao/renovar',
      '/v1/sistema/contexto',
      '/v1/turmas/${turma.id}/reivindicacoes',
    ])
  })

  it('a conta da escola é a do `oidc-falso` do compose: o iniciar e o retorno da API, o formulário e a volta do provedor falso, sem seguir o redirecionamento', () => {
    const script = lerArquivo('infra/k6/reivindicacao-em-sala.js')
    expect(script).toContain('/google/iniciar?${consulta}')
    expect(script).toContain('irAoProvedor(`slug=${SLUG}&intencao=reivindicar&${pelo}`, numero, \'aluno\')')
    // A entrada do aprovado: `iniciar` sem intenção, `retorno` e `renovar`, com o mesmo sujeito da prova.
    expect(script).toContain('irAoProvedor(`slug=${SLUG}`, numero, \'aprovado\')')
    expect(script).toContain('`${API}/v1/sessao/renovar`')
    expect(script).toContain('aprovado_entrou_pela_conta: [`count==${viaConta}`]')
    expect(script).toContain("const entrou = renovada.status === 200 && typeof renovada.json('token') === 'string'")
    expect(script).toContain('if (pedido.numeroDaConta !== undefined) entrarPelaConta(pedido.numeroDaConta)')
    expect(script).toContain('google-aluna-carga-${FASE}-${numero}')
    expect(script).toContain('redirects: 0')
    expect(script).toContain("contas_provadas: [`count==${viaConta}`]")
    expect(script).toContain("aprovado_entrou: [`count==${alunos - viaConta}`]")
    // O sujeito de cada aluno é o mapeamento por modelo do provedor falso: nenhuma conta fixa de e2e.
    expect(lerArquivo('infra/oidc-falso/config.json')).toContain('"match": "google-aluna-carga-.*"')
  })

  it('os thresholds do K1 e do K2 são os do cenário: zero 5xx, zero duplicidade, o decidir em 2 s e o login da outra escola em 1 s', () => {
    const script = lerArquivo('infra/k6/reivindicacao-em-sala.js')
    expect(script).toContain("respostas_5xx: ['count==0']")
    // A linha que alimenta o contador: sem ela, o threshold abaixo seria um contador que nunca soma.
    expect(script).toContain('respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })')
    expect(script).toContain("respostas_429: ['count==0']")
    expect(script).toContain("'respostas_429{grupo:outra_escola}': ['count==0']")
    expect(script).toContain("disputa_sem_um_vencedor: ['count==0']")
    expect(script).toContain('pedidos_enviados: [`count==${alunos}`]')
    expect(script).toContain('aprovados: [`count==${alunos}`]')
    expect(script).toContain('decidir_duracao: [`p(95)<${P95_MAXIMO_DO_DECIDIR_MS}`]')
    expect(script).toMatch(/export const P95_MAXIMO_DO_DECIDIR_MS = 2_000/)
    expect(script).toMatch(/export const P95_MAXIMO_DO_LOGIN_MS = 1_000/)
    expect(script).toContain("'login_duracao{grupo:outra_escola}': [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`]")
    expect(script).toMatch(/export const LOTE_DO_DECIDIR = 40/)
  })

  it('a disputa do mesmo nome repete o 503 do semáforo como a página, com a mesma chave, e não o conta como corrida', () => {
    const script = lerArquivo('infra/k6/reivindicacao-em-sala.js')
    expect(script).toContain('http.batch(requisicoes).map((primeira, indice) => repetirNo503(primeira, corpos[indice]))')
    expect(script).toContain('for (let envio = 0; envio < REENVIOS_NO_503 && resposta.status === 503; envio++)')
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
