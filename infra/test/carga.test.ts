import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { alcanceDe, INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS } from '@educa/shared'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { lerAmbienteDeCarga } from '../../tools/ci/compose.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import {
  ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS,
  adaptadorDoAmbienteDeCarga,
  ALUNOS_POR_ESCOLA_DA_SALA,
  ambienteDaBase,
  ambienteDaSala,
  DRENAGEM_ANTES_DE_TROCAR_O_WORKER_S,
  IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S,
  ambienteDoFalso,
  AMOSTRAS_MINIMAS_DA_JANELA,
  codigoDeSaidaDaReserva,
  exigirReservaFalsa,
  INTERVALO_ENTRE_AS_JANELAS_S,
  JANELAS_DA_RESERVA,
  julgarReserva,
  falhasNaJanela,
  limiteDaJanelaS,
  medirTutorNaJanela,
  LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO,
  montarMedidaDaJanela,
  PROVEDOR_DA_RESERVA_SEM_APROVACAO,
  reprovadoPeloIndisponivel,
  variaveisDaReserva,
  type MedidaDaJanela,
  type NomeDaJanela,
  type ResultadoDaReserva,
  ATRASO_DO_KILL_MS,
  AMOSTRAS_MINIMAS_DA_SALA,
  argumentosDoCompose,
  argumentosDoK6,
  codigoDeSaida,
  CODIGO_THRESHOLD_CRUZADO,
  ESCOLAS_DA_SALA,
  ESPERA_ATE_A_VOLTA_DO_WORKER_MS,
  ESPERA_P95_DA_FERRAMENTA_MS,
  ESPERA_P95_DO_TUTOR_MS,
  escolherFaseDoExpurgo,
  exigirAdaptadorFalso,
  degrauNaJanela,
  descreverReserva,
  faseDaLinhaDeComando,
  inicioDaLeituraDaJanela,
  julgarCenario,
  julgarSala,
  julgarSoABase,
  memoriaEmMiB,
  montarResultadoDaSala,
  NOMES_DAS_ESCOLAS,
  nomesDasEscolasDaSala,
  lerResumoDoK6,
  PROFESSORAS_POR_ESCOLA_DA_SALA,
  TOKENS_POR_GRUPO,
  TURMAS_POR_ESCOLA_DA_SALA,
  type FaseDoExpurgo,
  type MedidaDaEscolaDaSala,
  type ResultadoDaSala,
  type ResumoDoK6,
} from '../scripts/carga.ts'
import type { ConferenciaDaCarga } from '../scripts/conferir-carga.ts'

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

const limpo = (esperaBP95Ms = 40): ResumoDoK6 => ({ codigo: 0, cruzados: [], esperaBP95Ms })
const cruzado = (...metricas: string[]): ResumoDoK6 => ({ codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: metricas.map((metrica) => ({ metrica, criterio: 'x' })), esperaBP95Ms: 900 })
const conferencia = (...reprovacoes: string[]): ConferenciaDaCarga => ({ linhas: [], reprovacoes })
/** A fase do expurgo (F3, tarefa 19.0) limpa: o k6 dela dentro do limite e o banco sem reprovação. */
const expurgoLimpo: FaseDoExpurgo = { k6: limpo(45), reprovacoes: [] }

describe('veredito do cenário "justiça entre escolas"', () => {
  it('passa só com as duas fases do k6 limpas e o job_registro confirmando', () => {
    const veredito = julgarCenario(limpo(), limpo(), conferencia(), expurgoLimpo)
    expect(veredito).toEqual({ passou: true, reprovacoes: [], reprovadoPelaJustica: false })
    expect(codigoDeSaida(veredito, false)).toBe(0)
    // No controle negativo, passar é o erro: a vaga por escola desligada não fez diferença nenhuma.
    expect(codigoDeSaida(veredito, true)).toBe(1)
  })

  it('a espera da B acima da base + margem reprova o cenário, e é o que o controle negativo precisa ver', () => {
    const veredito = julgarCenario(limpo(), cruzado('espera_b'), conferencia(), expurgoLimpo)
    expect(veredito.passou).toBe(false)
    expect(veredito.reprovadoPelaJustica).toBe(true)
    expect(codigoDeSaida(veredito, false)).toBe(1)
    expect(codigoDeSaida(veredito, true)).toBe(0)
  })

  it('interativo acima de 30 s no job_registro reprova pela justiça, mesmo com o k6 limpo', () => {
    const veredito = julgarCenario(limpo(), limpo(), conferencia('3 job(s) interativo(s) esperaram mais de 30 s para começar'), expurgoLimpo)
    expect(veredito.reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['interativo_acima_de_30s'])
    expect(codigoDeSaida(veredito, true)).toBe(0)
  })

  it.each([
    ['429 para anônimos atrás do mesmo IP', julgarCenario(limpo(), cruzado('respostas_429{grupo:anonimo}'), conferencia(), expurgoLimpo)],
    ['job que falhou', julgarCenario(limpo(), limpo(), conferencia('2 job(s) terminaram falhou'), expurgoLimpo)],
    ['k6 da carga que caiu sem threshold cruzado', julgarCenario(limpo(), { codigo: 107, cruzados: [], esperaBP95Ms: 30 }, conferencia(), expurgoLimpo)],
    ['fase de carga que nem rodou', julgarCenario(limpo(), undefined, undefined, expurgoLimpo)],
    ['base que já reprovou: sem base limpa, a espera da carga não compara nada', julgarCenario(cruzado('respostas_inesperadas'), cruzado('espera_b'), conferencia(), expurgoLimpo)],
    ['base sem p95 da espera', julgarCenario({ codigo: 0, cruzados: [], esperaBP95Ms: undefined }, cruzado('espera_b'), conferencia(), expurgoLimpo)],
  ])('%s reprova o cenário, mas não conta como controle negativo aprovado', (_caso, veredito) => {
    expect(veredito.passou).toBe(false)
    expect(veredito.reprovadoPelaJustica).toBe(false)
    expect(codigoDeSaida(veredito, false)).toBe(1)
    expect(codigoDeSaida(veredito, true)).toBe(1)
  })

  it('saída zero do k6 com threshold cruzado no resumo não passa por limpa', () => {
    const veredito = julgarCenario(limpo(), { codigo: 0, cruzados: [{ metrica: 'respostas_429{grupo:c}', criterio: 'count==0' }], esperaBP95Ms: 30 }, conferencia(), expurgoLimpo)
    expect(veredito.reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['respostas_429{grupo:c}', 'k6_carga'])
  })

  describe('a fase do expurgo e da troca de nome (F3, tarefa 19.0)', () => {
    it('sem a fase, o cenário não passa: o expurgo que nem rodou não prova que a aula continua', () => {
      const veredito = julgarCenario(limpo(), limpo(), conferencia(), undefined)
      expect(veredito.reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['k6_expurgo'])
      expect(veredito.reprovadoPelaJustica).toBe(false)
      expect(codigoDeSaida(veredito, false)).toBe(1)
      // E não conta como controle negativo aprovado: a vaga por escola não tem nada a ver com a fase que faltou.
      expect(codigoDeSaida(veredito, true)).toBe(1)
    })

    it('o controle negativo dispensa a fase: ela não depende da vaga por escola, e o veredito dele fica só com a justiça', () => {
      const veredito = julgarCenario(limpo(), cruzado('espera_b'), conferencia(), 'dispensada')
      expect(veredito.reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['espera_b'])
      expect(veredito.reprovadoPelaJustica).toBe(true)
      expect(codigoDeSaida(veredito, true)).toBe(0)
    })

    it('a espera da B acima da base + margem durante a fase reprova com o nome da fase, e não é a justiça do controle negativo', () => {
      const veredito = julgarCenario(limpo(), limpo(), conferencia(), { k6: cruzado('espera_b'), reprovacoes: [] })
      expect(veredito.passou).toBe(false)
      expect(veredito.reprovacoes).toEqual([{ criterio: 'expurgo:espera_b', detalhe: 'expurgo: espera_b x' }])
      expect(veredito.reprovadoPelaJustica).toBe(false)
    })

    it('o que o banco reprovou na fase entra no veredito, e o k6 da fase que caiu sem threshold também', () => {
      const doBanco = [{ criterio: 'statement_acima_de_2s', detalhe: 'expurgo: statement de 2100 ms' }]
      expect(julgarCenario(limpo(), limpo(), conferencia(), { k6: limpo(), reprovacoes: doBanco }).reprovacoes).toEqual(doBanco)
      const caiu = julgarCenario(limpo(), limpo(), conferencia(), { k6: { codigo: 107, cruzados: [], esperaBP95Ms: 30 }, reprovacoes: [] })
      expect(caiu.reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['k6_expurgo'])
    })
  })

  it('lê o --summary-export do k6: true no threshold é cruzado, false é dentro', () => {
    const resumo = {
      metrics: {
        espera_b: { 'p(95)': 612.4, max: 1_900, thresholds: { 'p(95)<=541': true, 'max<30000': false } },
        'respostas_429{grupo:c_abusivo}': { count: 180, thresholds: { 'count>0': false } },
        'respostas_429{grupo:c}': { count: 0, thresholds: { 'count==0': false } },
        iterations: { count: 10 },
      },
    }
    expect(lerResumoDoK6(CODIGO_THRESHOLD_CRUZADO, resumo)).toEqual({
      codigo: CODIGO_THRESHOLD_CRUZADO,
      cruzados: [{ metrica: 'espera_b', criterio: 'p(95)<=541' }],
      esperaBP95Ms: 612.4,
    })
    expect(lerResumoDoK6(107, undefined)).toEqual({ codigo: 107, cruzados: [], esperaBP95Ms: undefined })
  })
})

describe('execução do cenário', () => {
  it('a fase de carga leva a base arredondada para cima no threshold da espera, e a base não leva nenhuma', () => {
    expect(argumentosDoK6('carga', 41.2)).toContain('ESPERA_BASE_P95_MS=42')
    // A fase do expurgo compara a B com a mesma base, e é a mesma carga dela: só o nome da fase muda.
    expect(argumentosDoK6('expurgo', 41.2)).toEqual(expect.arrayContaining(['FASE=expurgo', 'ESPERA_BASE_P95_MS=42', '/execucao/resumo-expurgo.json']))
    expect(argumentosDoK6('base').some((argumento) => argumento.startsWith('ESPERA_BASE_P95_MS'))).toBe(false)
    expect(argumentosDoK6('base')).toContain('--no-usage-report')
  })

  it('o turno do Tutor da B leva o p95 da base arredondado para cima ao k6 da fase do expurgo, e o resumo da base o devolve', () => {
    expect(argumentosDoK6('expurgo', 41.2, 400.4)).toEqual(expect.arrayContaining(['ESPERA_BASE_P95_MS=42', 'TURNO_BASE_P95_MS=401']))
    expect(argumentosDoK6('base').some((argumento) => argumento.startsWith('TURNO_BASE_P95_MS'))).toBe(false)
    expect(argumentosDoK6('carga', 41.2).some((argumento) => argumento.startsWith('TURNO_BASE_P95_MS'))).toBe(false)
    const resumo = { metrics: { espera_b: { 'p(95)': 30.5 }, turno_b: { 'p(95)': 612.25 } } }
    expect(lerResumoDoK6(0, resumo)).toEqual({ codigo: 0, cruzados: [], esperaBP95Ms: 30.5, turnoBP95Ms: 612.25 })
    expect(lerResumoDoK6(0, { metrics: { espera_b: { 'p(95)': 30.5 } } }).turnoBP95Ms).toBeUndefined()
  })

  it('a fase do expurgo: dispensada no controle negativo, roda com a base, e não roda sem a base', () => {
    expect(escolherFaseDoExpurgo(true, 40)).toEqual({ fase: 'dispensada' })
    expect(escolherFaseDoExpurgo(true, undefined)).toEqual({ fase: 'dispensada' })
    expect(escolherFaseDoExpurgo(false, 40)).toEqual({ fase: 'rodar', esperaBaseP95Ms: 40 })
    expect(escolherFaseDoExpurgo(false, 0)).toEqual({ fase: 'rodar', esperaBaseP95Ms: 0 })
    expect(escolherFaseDoExpurgo(false, undefined)).toEqual({ fase: 'sem_base' })
  })

  it('o compose de carga é um projeto próprio, com as portas de infra/carga.env sobre .env.example', () => {
    const argumentos = argumentosDoCompose()
    expect(argumentos.slice(0, 3)).toEqual(['compose', '--project-name', 'educa-carga'])
    expect(argumentos.join(' ')).toContain('--env-file .env.example --env-file infra/carga.env -f infra/compose.yml -f infra/compose.carga.yml')
  })

  it('as portas do cenário não colidem com as do desenvolvimento nem com as dos testes', () => {
    const portas = (arquivo: string) => new Set(Object.entries(parseEnv(lerArquivo(arquivo))).filter(([chave]) => chave.endsWith('_PORTA_HOST')).map(([, valor]) => valor))
    const daCarga = portas('infra/carga.env')
    const doExemplo = portas('.env.example')
    expect(daCarga.size).toBe(doExemplo.size)
    for (const porta of [...doExemplo, ...portas('infra/teste.env')]) expect(daCarga.has(porta), porta).toBe(false)
  })

  it('as três escolas são distintas, e há token da C para todo VU do teste: dois VUs com o mesmo usuário somariam no mesmo limite', () => {
    expect(new Set(NOMES_DAS_ESCOLAS).size).toBe(3)
    const script = lerArquivo('infra/k6/justica-entre-escolas.js')
    const constante = (nome: string) => Number(new RegExp(`const ${nome} = ([0-9_]+)`).exec(script)?.[1]?.replaceAll('_', ''))
    const vusNoTeste =
      constante('USUARIOS_NORMAIS_DA_C') +
      constante('VUS_DO_ABUSIVO') +
      constante('VISITANTES_ANONIMOS') +
      constante('USUARIOS_DA_A_NO_LOTE') +
      constante('USUARIOS_DA_A_NO_INTERATIVO') +
      constante('VUS_MAXIMOS_DA_B')
    expect(script).toContain('maxVUs: VUS_MAXIMOS_DA_B')
    expect(script.match(/maxVUs: VUS_DO_ABUSIVO/g)).toHaveLength(1)
    expect(vusNoTeste).toBeGreaterThan(800)
    expect(TOKENS_POR_GRUPO.c.quantidade).toBeGreaterThanOrEqual(vusNoTeste)
    expect(TOKENS_POR_GRUPO.a_lote.quantidade).toBe(constante('USUARIOS_DA_A_NO_LOTE'))
    expect(TOKENS_POR_GRUPO.a_interativo.quantidade).toBe(constante('USUARIOS_DA_A_NO_INTERATIVO'))
    expect(TOKENS_POR_GRUPO.abusivo.escola).toBe('C')
    expect(TOKENS_POR_GRUPO.c.escola).toBe('C')
  })

  it('os alunos do Tutor da B são da B e bastam para o teto de pedidos de IA por usuário: 1,5 turno por segundo, 12 por minuto cada', () => {
    const turnosPor2s = Number(/const TURNOS_DA_B_POR_2S = (\d+)/.exec(lerArquivo('infra/k6/justica-entre-escolas.js'))?.[1])
    const tetoPorUsuario = Number(/export const TETO_DE_PEDIDOS_DE_IA_POR_USUARIO = (\d+)/.exec(lerArquivo('apps/api/src/assistente/ai-request-rate-limit.ts'))?.[1])
    expect(TOKENS_POR_GRUPO.b_tutor).toMatchObject({ escola: 'B', papel: 'aluno' })
    expect((turnosPor2s / 2) * 60 / TOKENS_POR_GRUPO.b_tutor.quantidade).toBeLessThan(tetoPorUsuario)
  })

  it('cada grupo pede o papel que a MATRIZ deixa chamar a rota dele: equipe no job sintético, aluno no contexto', () => {
    // Sem isto, a A e a B receberiam 404 em `POST /v1/sistema/jobs-sinteticos` e o cenário mediria fila vazia.
    for (const grupo of ['a_lote', 'a_interativo', 'b'] as const) {
      expect(alcanceDe(TOKENS_POR_GRUPO[grupo].papel, 'sistema_job_sintetico', 'criar'), grupo).not.toBe('nunca')
    }
    for (const grupo of ['c', 'abusivo'] as const) {
      expect(alcanceDe(TOKENS_POR_GRUPO[grupo].papel, 'sistema_contexto', 'ler'), grupo).not.toBe('nunca')
    }
  })

  it('o token sintético do F0 não é mais emitido em lugar nenhum do cenário', () => {
    // O resto do caminho (escolas antes das sessões, sessão nova por fase, papel certo) quem prova é a
    // execução do cenário, registrada no 3_task.md: teste de texto sobre a ordem do script não pega falha real.
    expect(lerArquivo('infra/scripts/carga.ts')).not.toContain('ops:token-sintetico')
    expect(lerArquivo('infra/k6/justica-entre-escolas.js')).not.toContain('ops:token-sintetico')
  })
})

interface ServicoDaCarga {
  command?: string[]
  cpus?: number
  environment?: Record<string, string>
  image?: string
  profiles?: string[]
}

describe('infra/compose.carga.yml', () => {
  const { services: carga } = parse(lerArquivo('infra/compose.carga.yml'), { merge: true }) as { services: Record<string, ServicoDaCarga> }
  const { services: base } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as { services: Record<string, unknown> }

  it('fixa a CPU de todo serviço do ambiente, para o resultado não depender da máquina', () => {
    for (const nome of Object.keys(base)) {
      expect(carga[nome]?.cpus, nome).toBeGreaterThan(0)
    }
  })

  it('o sandbox de cada worker tem uma thread por núcleo inteiro e sobra pelo menos meio núcleo para o event loop', () => {
    // O `worker-ia` não tem sandbox de threads: espera o modelo pela rede, e só os workers de CPU entram na conta.
    const workers = Object.keys(base).filter((nome) => nome.startsWith('worker-') && !nome.startsWith('worker-ia-'))
    expect(workers).toHaveLength(5)
    for (const nome of workers) {
      const threads = Number(carga[nome]?.environment?.['WORKER_THREADS_MAXIMO'])
      const cpus = carga[nome]?.cpus ?? 0
      expect(Number.isInteger(threads) && threads >= 1, nome).toBe(true)
      expect(threads, nome).toBeLessThanOrEqual(cpus - 0.5)
    }
  })

  it('o Postgres carrega o pg_stat_statements e mantém o teto de conexões do compose: sem o módulo, a fase do expurgo não mede statement', () => {
    const comando = carga['postgres']?.command ?? []
    expect(comando).toContain('shared_preload_libraries=pg_stat_statements')
    expect(comando.some((argumento) => argumento.startsWith('max_connections='))).toBe(true)
    expect(comando[0]).toBe('postgres')
  })

  it('a latência simulada do Tutor chega a quem chama o modelo: o compose a passa às duas instâncias da API e às duas do `worker-ia`, e infra/carga.env a liga', () => {
    // A API validou a configuração e já não chama o modelo (X6, 5.0): quem espera a latência simulada é o `worker-ia`. Sem a variável nele, o adaptador falso
    // responde sem espera e o cenário deixa de medir o Tutor (regra 80, item 11).
    for (const nome of ['api-1', 'api-2', 'worker-ia-1', 'worker-ia-2']) {
      const servico = base[nome] as { environment?: Record<string, string> }
      expect(servico.environment?.['IA_LATENCIA_FALSA_MS'], nome).toMatch(/^\$\{IA_LATENCIA_FALSA_MS:\?/)
    }
    const doCarga = parseEnv(lerArquivo('infra/carga.env'))
    const latencia = Number(doCarga['IA_LATENCIA_FALSA_MS'])
    expect(latencia).toBeGreaterThan(0)
    // O adaptador falso a respeita no prazo de todo perfil do ambiente: a espera precisa caber no menor deles.
    const ambiente = parseEnv(lerArquivo('.env.example'))
    expect(latencia).toBeLessThan(Math.min(...['LLM_TIMEOUT_MS', 'LLM_TIMEOUT_MS_RAPIDO', 'LLM_TIMEOUT_MS_PADRAO'].map((variavel) => Number(ambiente[variavel]))))
    expect(doCarga['IA_ADAPTADOR'] ?? parseEnv(lerArquivo('.env.example'))['IA_ADAPTADOR']).toBe('falso')
  })

  it('não desliga a vaga por escola: só o controle negativo liga, pela linha de comando', () => {
    expect(lerArquivo('infra/compose.carga.yml')).not.toContain('VAGAS_POR_ESCOLA_DESLIGADAS')
  })

  it('o k6 tem versão fixa, só sobe por perfil, e não manda relatório de uso para fora da máquina', () => {
    const k6 = carga['k6']
    expect(k6?.image).toMatch(/^grafana\/k6:\d+\.\d+\.\d+$/)
    expect(k6?.profiles).toEqual(['carga'])
    expect(k6?.environment?.['K6_NO_USAGE_REPORT']).toBe('true')
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// A carga da manhã (X6, tarefa 11.0; RF6): `FASE=sala`
// ---------------------------------------------------------------------------------------------------------------------

const roteiro = () => lerArquivo('infra/k6/justica-entre-escolas.js')
const constanteDoK6 = (nome: string): number => Number(new RegExp(`const ${nome} = ([0-9_.]+)`).exec(roteiro())?.[1]?.replaceAll('_', ''))
const ambienteExemplo = (): Record<string, string | undefined> => parseEnv(lerArquivo('.env.example'))

const escolaDaSala = (nome: string, mudanca: Partial<MedidaDaEscolaDaSala> = {}): MedidaDaEscolaDaSala => ({
  escola: nome,
  amostrasDoTutor: 400,
  esperaDoTutorP95Ms: 300,
  amostrasDaFerramenta: 40,
  esperaDaFerramentaP95Ms: 1_200,
  turnoDoTutorP95Ms: 6_400,
  ...mudanca,
})
const salaLimpa = (mudanca: Partial<ResultadoDaSala> = {}, escolas: readonly MedidaDaEscolaDaSala[] = nomesDasEscolasDaSala().map((nome) => escolaDaSala(nome))): ResultadoDaSala => ({
  k6: { codigo: 0, cruzados: [], esperaBP95Ms: undefined, interrompidas: 14 },
  escolas,
  interrompidas: 14,
  tetoDeInterrompidas: 40,
  falhasForaDoKill: 0,
  indisponiveis: 0,
  reservasRecusadas: 30,
  ...mudanca,
})
const criterios = (resultado: ResultadoDaSala): string[] => julgarSala(resultado).map((reprovacao) => reprovacao.criterio)

describe('a carga da manhã: o roteiro e o script falam das mesmas dez escolas', () => {
  it('as constantes do k6 são as do script, e a fase `sala` é uma fase como as outras', () => {
    expect(constanteDoK6('ESCOLAS_DA_SALA')).toBe(ESCOLAS_DA_SALA)
    expect(constanteDoK6('ALUNOS_POR_ESCOLA_DA_SALA')).toBe(ALUNOS_POR_ESCOLA_DA_SALA)
    expect(constanteDoK6('PROFESSORAS_POR_ESCOLA_DA_SALA')).toBe(PROFESSORAS_POR_ESCOLA_DA_SALA)
    expect(ESCOLAS_DA_SALA).toBe(10)
    expect(TURMAS_POR_ESCOLA_DA_SALA).toBe(6)
    expect(nomesDasEscolasDaSala()).toHaveLength(ESCOLAS_DA_SALA)
    expect(new Set(nomesDasEscolasDaSala()).size).toBe(ESCOLAS_DA_SALA)
    expect(argumentosDoK6('sala')).toEqual(expect.arrayContaining(['FASE=sala', '/execucao/resumo-sala.json']))
    // A base segue igual: a comparação do RF6 mede o mesmo turno no build anterior e no da tarefa.
    expect(argumentosDoK6('base')).toContain('FASE=base')
    expect(argumentosDoK6('base').some((argumento) => argumento.includes('sala'))).toBe(false)
  })

  it('a carga é a da tabela de `onda-3a.md`: 0,75 turno por segundo por escola, 1 ferramenta e 4 propostas por minuto, e os alunos e professoras bastam para o teto de pedidos de IA por usuário', () => {
    const tetoPorUsuario = Number(/export const TETO_DE_PEDIDOS_DE_IA_POR_USUARIO = (\d+)/.exec(lerArquivo('apps/api/src/assistente/ai-request-rate-limit.ts'))?.[1])
    expect(constanteDoK6('TURNOS_DA_SALA_POR_MINUTO') / 60).toBe(0.75)
    expect(constanteDoK6('FERRAMENTAS_DA_SALA_POR_MINUTO')).toBe(1)
    expect(constanteDoK6('PROPOSTAS_DA_SALA_POR_MINUTO')).toBe(4)
    expect(constanteDoK6('TURNOS_DA_SALA_POR_MINUTO') / ALUNOS_POR_ESCOLA_DA_SALA).toBeLessThan(tetoPorUsuario)
    expect((constanteDoK6('FERRAMENTAS_DA_SALA_POR_MINUTO') + constanteDoK6('PROPOSTAS_DA_SALA_POR_MINUTO')) / PROFESSORAS_POR_ESCOLA_DA_SALA).toBeLessThan(tetoPorUsuario)
    // O Tutor espera a execução além do prazo dele (60 s) e da reentrega do worker morto (~15 s); a ferramenta, além dos 150 s dela.
    expect(constanteDoK6('PRAZO_DO_TURNO_DA_SALA_MS')).toBeGreaterThan(60_000 + 15_000)
    expect(constanteDoK6('PRAZO_DA_FERRAMENTA_DA_SALA_MS')).toBeGreaterThan(150_000)
  })

  it('o k6 tem os thresholds por escola (o turno e a ferramenta terminam, o p95 cabe na espera do RF6 mais o modelo) e nenhum "indisponível"', () => {
    const script = roteiro()
    const thresholds = [
      "indisponiveis_sala: ['count==0']",
      "thresholds[`respostas_429{grupo:${grupo}}`] = ['count==0']",
      "thresholds[`respostas_inesperadas{grupo:${grupo}}`] = ['count==0']",
      "thresholds[`turnos_sala_concluidos{escola:${escola}}`] = ['count>0']",
      "thresholds[`ferramentas_sala_concluidas{escola:${escola}}`] = ['count>0']",
      'thresholds[`turno_sala{escola:${escola}}`] = [`p(95)<${TURNO_P95_DA_SALA_MS}`]',
      'thresholds[`ferramenta_sala{escola:${escola}}`] = [`p(95)<${FERRAMENTA_P95_DA_SALA_MS}`]',
    ]
    for (const trecho of thresholds) expect(script, trecho).toContain(trecho)
    // O kill -9 cai aos 75 s, e a fase dura até depois da volta do worker e da reentrega do job: com a carga ainda no ritmo, a pergunta seguinte roda.
    expect(script).toContain("const DURACAO_DA_SALA = '3m'")
    expect(ATRASO_DO_KILL_MS + ESPERA_ATE_A_VOLTA_DO_WORKER_MS + 60_000).toBeLessThan(3 * 60_000)
    // A espera p95 do RF6 mais a latência do falso (6 s no turno, 50 s na ferramenta) e a folga da consulta: é o que o k6 consegue medir de fora.
    expect(constanteDoK6('TURNO_P95_DA_SALA_MS')).toBe(ESPERA_P95_DO_TUTOR_MS + 6_000 + INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS)
    expect(constanteDoK6('FERRAMENTA_P95_DA_SALA_MS')).toBe(ESPERA_P95_DA_FERRAMENTA_MS + 50_000 + 1_000)
    // O passo da consulta é o da web: com 0,5 s, uma professora com a ferramenta de 50 s esperando passa dos 120 pedidos por minuto e leva 429 que a tela real não leva.
    expect(constanteDoK6('PASSO_DA_CONSULTA_DA_SALA_S') * 1_000).toBe(INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS)
    expect(ESPERA_P95_DO_TUTOR_MS).toBe(2_000)
    expect(ESPERA_P95_DA_FERRAMENTA_MS).toBe(10_000)
  })
})

describe('a carga da manhã: nenhum provedor pago', () => {
  it('o ambiente de carga é o do adaptador falso, e o script recusa qualquer outro', () => {
    expect(() => exigirAdaptadorFalso({ IA_ADAPTADOR: 'falso' })).not.toThrow()
    expect(() => exigirAdaptadorFalso({ IA_ADAPTADOR: 'openai_compat' })).toThrow(/IA_ADAPTADOR=falso/)
    expect(() => exigirAdaptadorFalso({})).toThrow(/IA_ADAPTADOR=falso/)
    // O ambiente de verdade: `infra/carga.env` sobre o `.env.example`, nessa ordem.
    expect(() => exigirAdaptadorFalso(adaptadorDoAmbienteDeCarga(lerAmbienteDeCarga()))).not.toThrow()
    expect(adaptadorDoAmbienteDeCarga({ IA_ADAPTADOR: 'openai_compat' })).toEqual({ IA_ADAPTADOR: 'openai_compat' })
    expect(() => exigirAdaptadorFalso(adaptadorDoAmbienteDeCarga({ IA_ADAPTADOR: 'openai_compat' }))).toThrow(/IA_ADAPTADOR=falso/)
  })

  it('a latência por perfil e os tokens do falso são os da sala, cabem no prazo de cada perfil, e as outras fases ficam como estavam', () => {
    const sala = ambienteDoFalso('sala')
    expect(sala).toEqual({ IA_LATENCIA_FALSA_MS: '6000', IA_LATENCIA_FALSA_MS_PADRAO: '50000', IA_TOKENS_FALSOS_ENTRADA: '3000', IA_TOKENS_FALSOS_SAIDA: '250' })
    const exemplo = ambienteExemplo()
    expect(Number(sala['IA_LATENCIA_FALSA_MS'])).toBeLessThan(Number(exemplo['LLM_TIMEOUT_MS_RAPIDO']))
    expect(Number(sala['IA_LATENCIA_FALSA_MS_PADRAO'])).toBeLessThan(Number(exemplo['LLM_TIMEOUT_MS_PADRAO']))
    for (const fase of ['base', 'expurgo', 'carga'] as const) {
      const outra = ambienteDoFalso(fase)
      // A latência de 300 ms é a de `infra/carga.env`: a fase não a troca, e os tokens voltam à estimativa pelo texto.
      expect(outra).toEqual({ IA_LATENCIA_FALSA_MS_PADRAO: '0', IA_TOKENS_FALSOS_ENTRADA: '0', IA_TOKENS_FALSOS_SAIDA: '0' })
    }
  })

  it('o compose passa a latência do `padrao` e os tokens do falso aos dois `worker-ia`, que são quem chama o modelo', () => {
    const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as { services: Record<string, { environment?: Record<string, string> }> }
    for (const nome of ['worker-ia-1', 'worker-ia-2']) {
      for (const variavel of ['IA_LATENCIA_FALSA_MS_PADRAO', 'IA_TOKENS_FALSOS_ENTRADA', 'IA_TOKENS_FALSOS_SAIDA']) {
        expect(services[nome]?.environment?.[variavel], `${nome} ${variavel}`).toMatch(new RegExp(`^\\$\\{${variavel}:\\?`))
      }
    }
    for (const variavel of ['IA_LATENCIA_FALSA_MS_PADRAO', 'IA_TOKENS_FALSOS_ENTRADA', 'IA_TOKENS_FALSOS_SAIDA']) expect(ambienteExemplo()[variavel], variavel).toBe('0')
  })
})

describe('a carga da manhã: o teto de tokens morde, mas só no fim da janela', () => {
  it('o `LLM_TOKENS_POR_MINUTO` da carga deixa o balde geral (80 %) um pouco abaixo da carga, e acima do que a espera de 8 s do degrau suporta', () => {
    const contratado = Number(parseEnv(lerArquivo('infra/carga.env'))['LLM_TOKENS_POR_MINUTO'])
    const porChamada = Number(ambienteDoFalso('sala')['IA_TOKENS_FALSOS_ENTRADA']) + Number(ambienteDoFalso('sala')['IA_TOKENS_FALSOS_SAIDA'])
    // Por minuto: 45 turnos, 1 ferramenta e 4 propostas em cada escola.
    const chamadas = ESCOLAS_DA_SALA * (constanteDoK6('TURNOS_DA_SALA_POR_MINUTO') + constanteDoK6('FERRAMENTAS_DA_SALA_POR_MINUTO') + constanteDoK6('PROPOSTAS_DA_SALA_POR_MINUTO'))
    const carga = chamadas * porChamada
    const balde = contratado * 0.8
    expect(carga).toBe(1_625_000)
    // Morde: o balde enche antes de a janela de 60 s acabar. E a espera de quem chega depois (até o fim da janela) cabe nos 8 s do degrau: o balde cobre
    // ao menos 52 s de carga (60 − 8), senão o Tutor termina `IA_INDISPONIVEL`.
    expect(balde).toBeLessThan(carga)
    expect(balde / carga).toBeGreaterThanOrEqual((60 - 8) / 60)
    // Fica abaixo do piso do contrato de produção (2,5 milhões): o valor de produção é outro, e o da carga não o substitui.
    expect(contratado).toBeLessThan(Number(ambienteExemplo()['LLM_TOKENS_POR_MINUTO']))
  })
})

describe('a carga da manhã: o veredito', () => {
  it('passa com as dez escolas dentro do RF6, o kill interrompendo dentro do teto e o balde recusando', () => {
    expect(julgarSala(salaLimpa())).toEqual([])
  })

  it('os `EXECUCAO_INTERROMPIDA` acima do teto lido antes do kill falham a fase, e no teto exato passam', () => {
    expect(criterios(salaLimpa({ interrompidas: 41, tetoDeInterrompidas: 40 }))).toEqual(['interrompidas_acima_do_teto'])
    expect(criterios(salaLimpa({ interrompidas: 40, tetoDeInterrompidas: 40 }))).toEqual([])
  })

  it('o kill que não interrompeu nenhuma execução não prova a reentrega: a fase falha', () => {
    expect(criterios(salaLimpa({ interrompidas: 0 }))).toEqual(['kill_sem_efeito'])
  })

  it('qualquer outra falha, e todo "indisponível", falham a fase, mesmo com o k6 limpo', () => {
    expect(criterios(salaLimpa({ falhasForaDoKill: 1 }))).toEqual(['falhas_fora_do_kill'])
    expect(criterios(salaLimpa({ indisponiveis: 1 }))).toEqual(['indisponivel'])
  })

  it('threshold do k6 cruzado reprova com o nome da fase, e o k6 que caiu sem threshold cruzado também', () => {
    const cruzada = salaLimpa({ k6: { codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: [{ metrica: 'indisponiveis_sala', criterio: 'count==0' }], esperaBP95Ms: undefined, interrompidas: 14 } })
    expect(criterios(cruzada)).toEqual(['sala:indisponiveis_sala'])
    expect(criterios(salaLimpa({ k6: { codigo: 107, cruzados: [], esperaBP95Ms: undefined, interrompidas: 14 } }))).toEqual(['k6_sala'])
    // O k6 saiu com o código do threshold cruzado e o resumo não tem nenhum cruzado, ou o contrário: o resumo e o código se contradizem.
    expect(criterios(salaLimpa({ k6: { codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: [], esperaBP95Ms: undefined, interrompidas: 14 } }))).toEqual(['k6_sala'])
    expect(criterios(salaLimpa({ k6: { codigo: 0, cruzados: [{ metrica: 'indisponiveis_sala', criterio: 'count==0' }], esperaBP95Ms: undefined, interrompidas: 14 } }))).toEqual(['sala:indisponiveis_sala', 'k6_sala'])
  })

  it('a espera p95 de cada escola é julgada contra 2 s no Tutor e 10 s na ferramenta, e o limite exato reprova', () => {
    const escolas = nomesDasEscolasDaSala().map((nome) => (nome === 'e4' ? escolaDaSala(nome, { esperaDoTutorP95Ms: ESPERA_P95_DO_TUTOR_MS }) : nome === 'e7' ? escolaDaSala(nome, { esperaDaFerramentaP95Ms: ESPERA_P95_DA_FERRAMENTA_MS }) : escolaDaSala(nome)))
    expect(julgarSala(salaLimpa({}, escolas))).toEqual([
      { criterio: 'espera_interativa', detalhe: 'sala: e4 espera p95 de 2000 ms na fila interativa, e o limite é 2000 ms' },
      { criterio: 'espera_ferramenta', detalhe: 'sala: e7 espera p95 de 10000 ms na fila ferramenta, e o limite é 10000 ms' },
    ])
    expect(criterios(salaLimpa({}, nomesDasEscolasDaSala().map((nome) => escolaDaSala(nome, { esperaDoTutorP95Ms: ESPERA_P95_DO_TUTOR_MS - 1, esperaDaFerramentaP95Ms: ESPERA_P95_DA_FERRAMENTA_MS - 1 }))))).toEqual([])
  })

  it('escola sem amostra de uma fila não passa em branco: poucos jobs, ou nenhum p95, reprovam', () => {
    const poucos = nomesDasEscolasDaSala().map((nome) => (nome === 'e2' ? escolaDaSala(nome, { amostrasDaFerramenta: AMOSTRAS_MINIMAS_DA_SALA - 1 }) : escolaDaSala(nome)))
    expect(criterios(salaLimpa({}, poucos))).toEqual(['sem_amostra_ferramenta'])
    const nenhum = nomesDasEscolasDaSala().map((nome) => (nome === 'e9' ? escolaDaSala(nome, { amostrasDoTutor: 0, esperaDoTutorP95Ms: null }) : escolaDaSala(nome)))
    expect(criterios(salaLimpa({}, nenhum))).toEqual(['sem_amostra_interativa'])
    // Amostras bastam, mas o p95 não saiu (a consulta não achou o início de nenhum job): não passa em branco.
    const semP95 = nomesDasEscolasDaSala().map((nome) => (nome === 'e3' ? escolaDaSala(nome, { esperaDoTutorP95Ms: null }) : escolaDaSala(nome)))
    expect(criterios(salaLimpa({}, semP95))).toEqual(['sem_amostra_interativa'])
    expect(AMOSTRAS_MINIMAS_DA_SALA).toBe(10)
    expect(criterios(salaLimpa({}, nomesDasEscolasDaSala().map((nome) => escolaDaSala(nome, { amostrasDoTutor: AMOSTRAS_MINIMAS_DA_SALA }))))).toEqual([])
  })

  it('o balde que não recusou nenhuma reserva reprova (o teto não mordeu); sem o Prometheus a fase só não diz', () => {
    expect(criterios(salaLimpa({ reservasRecusadas: 0 }))).toEqual(['balde_nao_recusou'])
    expect(criterios(salaLimpa({ reservasRecusadas: undefined }))).toEqual([])
  })

  it('o k6 lê o contador das interrompidas do resumo, e a fase `base` sozinha julga pelo k6 e pela espera da B', () => {
    expect(lerResumoDoK6(0, { metrics: { execucoes_interrompidas: { count: 12 } } }).interrompidas).toBe(12)
    expect(lerResumoDoK6(0, { metrics: {} }).interrompidas).toBeUndefined()
    expect(julgarSoABase({ codigo: 0, cruzados: [], esperaBP95Ms: 40 })).toEqual({ passou: true, reprovacoes: [], reprovadoPelaJustica: false })
    expect(julgarSoABase({ codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: [{ metrica: 'turno_b', criterio: 'max<30000' }], esperaBP95Ms: 40 }).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['base:turno_b'])
    expect(julgarSoABase({ codigo: 0, cruzados: [], esperaBP95Ms: undefined }).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['base:espera_b'])
    // O k6 caiu (107) sem threshold cruzado, ou saiu com zero com um cruzado no resumo: o código e o resumo se contradizem.
    expect(julgarSoABase({ codigo: 107, cruzados: [], esperaBP95Ms: 40 }).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['k6_base'])
    expect(julgarSoABase({ codigo: 0, cruzados: [{ metrica: 'turno_b', criterio: 'max<30000' }], esperaBP95Ms: 40 }).reprovacoes.map((reprovacao) => reprovacao.criterio)).toEqual(['base:turno_b', 'k6_base'])
  })

  it('o resultado da sala separa as falhas do banco: só o `EXECUCAO_INTERROMPIDA` e o `IA_INDISPONIVEL` ficam fora das outras, e o contador do k6 ausente vale zero', () => {
    const escolas = nomesDasEscolasDaSala().map((nome) => escolaDaSala(nome))
    const resultado = montarResultadoDaSala({
      k6: { codigo: 0, cruzados: [], esperaBP95Ms: undefined, interrompidas: 21 },
      escolas,
      teto: 60,
      falhas: { EXECUCAO_INTERROMPIDA: 3, IA_INDISPONIVEL: 1, IA_SAIDA_INVALIDA: 2, IA_TEMPO_ESGOTADO: 4 },
      reservasRecusadas: 93,
    })
    expect(resultado).toMatchObject({ interrompidas: 21, tetoDeInterrompidas: 60, falhasForaDoKill: 6, indisponiveis: 1, reservasRecusadas: 93 })
    expect(resultado.escolas).toBe(escolas)
    const semNada = montarResultadoDaSala({ k6: { codigo: 0, cruzados: [], esperaBP95Ms: undefined }, escolas, teto: 5, falhas: {}, reservasRecusadas: undefined })
    expect(semNada).toMatchObject({ interrompidas: 0, tetoDeInterrompidas: 5, falhasForaDoKill: 0, indisponiveis: 0, reservasRecusadas: undefined })
    // O que o banco diz entra no veredito: outra falha reprova, e o Prometheus sem resposta não inventa o balde.
    expect(criterios(montarResultadoDaSala({ k6: { codigo: 0, cruzados: [], esperaBP95Ms: undefined, interrompidas: 21 }, escolas, teto: 60, falhas: { IA_SAIDA_INVALIDA: 1 }, reservasRecusadas: 93 }))).toEqual(['falhas_fora_do_kill'])
  })

  it('o contador das interrompidas só é lido quando é número', () => {
    expect(lerResumoDoK6(0, { metrics: { execucoes_interrompidas: { count: '12' } } }).interrompidas).toBeUndefined()
    expect(lerResumoDoK6(0, { metrics: { execucoes_interrompidas: { count: 0 } } }).interrompidas).toBe(0)
    // O prazo esgotado da queda por prazo (`FASE=reserva`) é lido do contador próprio, e do mesmo jeito: número, ou nada.
    expect(lerResumoDoK6(0, { metrics: { tempos_esgotados_reserva: { count: 10 } } }).temposEsgotados).toBe(10)
    expect(lerResumoDoK6(0, { metrics: { tempos_esgotados_reserva: { count: '10' } } }).temposEsgotados).toBeUndefined()
    expect(lerResumoDoK6(0, { metrics: {} }).temposEsgotados).toBeUndefined()
  })

  it('o RSS do `docker stats` vira MiB, e o que não é memória não vira número', () => {
    expect(memoriaEmMiB('123.4MiB / 15.5GiB')).toBeCloseTo(123.4)
    expect(memoriaEmMiB('1.5GiB / 15.5GiB')).toBeCloseTo(1_536)
    expect(memoriaEmMiB('2048KiB / 15.5GiB')).toBeCloseTo(2)
    expect(memoriaEmMiB('1048576B / 15.5GiB')).toBeCloseTo(1)
    expect(memoriaEmMiB('1.2.3MiB / 4GiB')).toBeUndefined()
    expect(memoriaEmMiB('')).toBeUndefined()
    expect(memoriaEmMiB('--')).toBeUndefined()
  })
})


// ---------------------------------------------------------------------------------------------------------------------
// A queda do principal (F5b, tarefa 9.0; RF3): `FASE=reserva`
// ---------------------------------------------------------------------------------------------------------------------

const doArquivoDeCarga = (): Record<string, string> => lerAmbienteDeCarga()
const VARIAVEIS_DA_RESERVA = ['IA_RESERVA_ADAPTADOR', 'IA_RESERVA_PROVEDOR_ID', 'LLM_RESERVA_TOKENS_POR_MINUTO', 'IA_FALHA_FALSA'] as const
const janelaDe = (nome: NomeDaJanela) => {
  const janela = JANELAS_DA_RESERVA.find((candidata) => candidata.nome === nome)
  if (janela === undefined) throw new Error(`janela ${nome} não existe`)
  return janela
}

describe('a fase `reserva`: o roteiro e o script falam das mesmas janelas', () => {
  it('as durações e o intervalo do k6 são os do script, e a fase é uma fase como as outras', () => {
    const lista = /const DURACOES_DAS_JANELAS_DA_RESERVA_S = \[([0-9, ]+)\]/.exec(roteiro())?.[1]?.split(',').map(Number)
    expect(lista).toEqual(JANELAS_DA_RESERVA.map((janela) => janela.duracaoS))
    expect(constanteDoK6('INTERVALO_ENTRE_AS_JANELAS_S')).toBe(INTERVALO_ENTRE_AS_JANELAS_S)
    expect(JANELAS_DA_RESERVA.map((janela) => janela.nome)).toEqual(['controle', '5xx', 'prazo', '429', 'balde'])
    expect(argumentosDoK6('reserva')).toEqual(expect.arrayContaining(['FASE=reserva', '/execucao/resumo-reserva.json']))
    expect(ambienteDoFalso('reserva')).toEqual(ambienteDoFalso('sala'))
  })

  it('cada janela começa depois da anterior e do intervalo, e o k6 inteiro, com a ferramenta no tempo dela e os tokens na idade máxima, cabe nos 10 min do token de acesso', () => {
    expect(limiteDaJanelaS(0)).toBe(0)
    expect(limiteDaJanelaS(0, true)).toBe(30)
    expect(limiteDaJanelaS(1)).toBe(30 + INTERVALO_ENTRE_AS_JANELAS_S)
    expect(limiteDaJanelaS(4)).toBe(4 * (30 + INTERVALO_ENTRE_AS_JANELAS_S))
    const fim = limiteDaJanelaS(JANELAS_DA_RESERVA.length - 1, true)
    const validade = Number(/VALIDADE_TOKEN_ACESSO_SEGUNDOS = (\d+) \* (\d+)/.exec(lerArquivo('packages/core/src/identidade/token-issuer.ts'))?.slice(1).reduce((produto, fator) => produto * Number(fator), 1))
    expect(validade).toBe(600)
    // O token nasce antes do k6 (as sessões das dez escolas, em paralelo, com o teto de idade abaixo). Depois do fim da carga ainda corre o que já começou: a ferramenta do falso leva 50 s (a mais lenta) e o k6 a consulta de
    // segundo em segundo. O prazo de desistência da ferramenta no k6 (170 s) é maior que a folga, de propósito: ferramenta que o passa é corrida que já está vermelha, e o 401 que viria depois não muda o veredito.
    const latenciaDaFerramentaS = Number(ambienteDoFalso('reserva').IA_LATENCIA_FALSA_MS_PADRAO) / 1_000
    expect(fim + latenciaDaFerramentaS + constanteDoK6('PASSO_DA_CONSULTA_DA_SALA_S') + IDADE_MAXIMA_DO_TOKEN_NO_INICIO_DO_K6_S).toBeLessThan(validade)
    expect(constanteDoK6('PRAZO_DA_FERRAMENTA_DA_SALA_MS') / 1_000).toBeGreaterThan(latenciaDaFerramentaS)
    // O script espera a ferramenta de 50 s terminar antes de trocar o worker, e o worker ainda dá 20 s de graça aos jobs em voo: o intervalo cobre a espera, a graça e a subida do novo.
    // Sem a espera (2 s), a ferramenta em voo era abortada e o aluno via `sem_conclusao` (segunda corrida da 9.0).
    expect(DRENAGEM_ANTES_DE_TROCAR_O_WORKER_S * 1_000 + 20_000).toBeGreaterThan(latenciaDaFerramentaS * 1_000)
    expect(INTERVALO_ENTRE_AS_JANELAS_S).toBeGreaterThan(DRENAGEM_ANTES_DE_TROCAR_O_WORKER_S + 20)
  })

  it('o k6 da `reserva` dá a carga da sala em estágios que caem a zero no intervalo, e não julga "indisponível" nem o turno: quem julga a janela é o banco', () => {
    const script = roteiro()
    const reserva = script.slice(script.indexOf('function reserva()'), script.indexOf('const daBase'))
    expect(reserva).toContain("executor: 'ramping-arrival-rate'")
    expect(reserva).toContain('{ target: 0, duration:')
    for (const grupo of ['sala_tutor', 'sala_ferramenta', 'sala_proposta']) expect(reserva).toContain(`'${grupo}'`)
    expect(reserva).toContain("thresholds[`turnos_sala_concluidos{escola:${escola}}`] = ['count>0']")
    expect(reserva).not.toContain('indisponiveis_sala')
    expect(reserva).not.toContain('turno_sala')
    // O prazo esgotado é tipado e esperado na queda por prazo, só nesta fase: na `sala` ele continua sendo resposta inesperada.
    expect(script).toContain("desfecho === 'IA_TEMPO_ESGOTADO' && FASE === 'reserva'")
    // A validação da `FASE`, a escolha das dez escolas da sala, o intervalo que não vem depois da última janela e a escolha entre `sala` e `reserva`: sem qualquer uma, o k6 não sobe ou sobe sem carga.
    expect(script).toContain("FASE !== 'sala' && FASE !== 'reserva') throw new Error('FASE precisa ser base, expurgo, carga, sala ou reserva')")
    expect(script).toContain("const NA_SALA = FASE === 'sala' || FASE === 'reserva'")
    expect(reserva).toContain('if (indice < DURACOES_DAS_JANELAS_DA_RESERVA_S.length - 1) lista.push({ target: 0, duration:')
    expect(script).toContain("const daSala = FASE === 'sala' ? sala() : FASE === 'reserva' ? reserva() : { cenarios: {}, thresholds: {} }")
    const sala = script.slice(script.indexOf('function sala()'), script.indexOf('function reserva()'))
    expect(sala).toContain("indisponiveis_sala: ['count==0']")
  })

  it('o contratado da janela do balde cheio deixa o balde do principal abaixo da carga e o enche antes do fim da janela, e o do resto das janelas é o da `sala`', () => {
    const porChamada = Number(ambienteDoFalso('reserva')['IA_TOKENS_FALSOS_ENTRADA']) + Number(ambienteDoFalso('reserva')['IA_TOKENS_FALSOS_SAIDA'])
    const chamadasPorMinuto = ESCOLAS_DA_SALA * (constanteDoK6('TURNOS_DA_SALA_POR_MINUTO') + constanteDoK6('FERRAMENTAS_DA_SALA_POR_MINUTO') + constanteDoK6('PROPOSTAS_DA_SALA_POR_MINUTO'))
    const carga = (chamadasPorMinuto * porChamada) / 60
    const balde = LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO * 0.8
    const segundosAteEncher = balde / carga
    const balde2 = janelaDe('balde')
    expect(balde2.tokensPorMinuto).toBe(LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO)
    // Enche e ainda sobra janela para a espera de 8 s do degrau e o transbordo à reserva (o balde zera a cada 60 s).
    expect(segundosAteEncher + 8).toBeLessThan(balde2.duracaoS)
    expect(LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO).toBeLessThan(Number(doArquivoDeCarga()['LLM_TOKENS_POR_MINUTO']))
    for (const janela of JANELAS_DA_RESERVA.filter((candidata) => candidata.nome !== 'balde')) expect(janela.tokensPorMinuto, janela.nome).toBeUndefined()
  })
})

describe('a fase `reserva`: a reserva só liga nela', () => {
  it('a `sala` não liga a reserva: as variáveis dela e a falha ficam vazias, mesmo com o shell exportando as do worker', () => {
    const vazias = Object.fromEntries(VARIAVEIS_DA_RESERVA.map((variavel) => [variavel, '']))
    expect(variaveisDaReserva(undefined, doArquivoDeCarga())).toEqual(vazias)
    vi.stubEnv('IA_RESERVA_ADAPTADOR', 'falso')
    vi.stubEnv('IA_FALHA_FALSA', 'principal:5xx')
    vi.stubEnv('LLM_RESERVA_TOKENS_POR_MINUTO', '1')
    try {
      const sala = ambienteDaSala('/pasta', doArquivoDeCarga())
      for (const variavel of VARIAVEIS_DA_RESERVA) expect(sala[variavel], variavel).toBe('')
      expect(sala['IA_ADAPTADOR']).toBe('falso')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('o `infra/carga.env` guarda a reserva com nomes que o compose não leva ao worker, e o compose só os passa vazios por padrão', () => {
    const doCarga = parseEnv(lerArquivo('infra/carga.env'))
    for (const variavel of VARIAVEIS_DA_RESERVA) expect(doCarga[variavel], variavel).toBeUndefined()
    expect(doCarga['RESERVA_DA_CARGA_ADAPTADOR']).toBe('falso')
    expect(doCarga['RESERVA_DA_CARGA_PROVEDOR_ID']).toBe('falso-reserva')
    expect(Number(doCarga['RESERVA_DA_CARGA_TOKENS_POR_MINUTO'])).toBe(Number(doCarga['LLM_TOKENS_POR_MINUTO']))
    const { services } = parse(lerArquivo('infra/compose.carga.yml'), { merge: true }) as { services: Record<string, { environment?: Record<string, string> }> }
    for (const nome of ['worker-ia-1', 'worker-ia-2']) {
      for (const variavel of VARIAVEIS_DA_RESERVA) expect(services[nome]?.environment?.[variavel], `${nome} ${variavel}`).toBe(`\${${variavel}:-}`)
    }
    // Só os dois `worker-ia` a recebem: a API não tem provedor, e o compose base não as conhece.
    for (const nome of ['api-1', 'api-2']) expect(services[nome]?.environment?.['IA_RESERVA_ADAPTADOR']).toBeUndefined()
    expect(lerArquivo('infra/compose.yml')).not.toContain('IA_RESERVA_ADAPTADOR')
  })

  it('cada janela leva ao worker a falha e a reserva dela: só o controle a tem desligada, e o do balde troca o contratado do principal', () => {
    const doArquivo = doArquivoDeCarga()
    expect(variaveisDaReserva(janelaDe('controle'), doArquivo)).toEqual({ IA_RESERVA_ADAPTADOR: '', IA_RESERVA_PROVEDOR_ID: '', LLM_RESERVA_TOKENS_POR_MINUTO: '', IA_FALHA_FALSA: '' })
    const ligada = { IA_RESERVA_ADAPTADOR: 'falso', IA_RESERVA_PROVEDOR_ID: 'falso-reserva', LLM_RESERVA_TOKENS_POR_MINUTO: doArquivo['RESERVA_DA_CARGA_TOKENS_POR_MINUTO'] }
    expect(variaveisDaReserva(janelaDe('5xx'), doArquivo)).toEqual({ ...ligada, IA_FALHA_FALSA: 'principal:5xx' })
    expect(variaveisDaReserva(janelaDe('prazo'), doArquivo)).toEqual({ ...ligada, IA_FALHA_FALSA: 'principal:prazo' })
    expect(variaveisDaReserva(janelaDe('429'), doArquivo)).toEqual({ ...ligada, IA_FALHA_FALSA: 'principal:429' })
    expect(variaveisDaReserva(janelaDe('balde'), doArquivo)).toEqual({ ...ligada, IA_FALHA_FALSA: '', LLM_TOKENS_POR_MINUTO: String(LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO) })
    // A falha do ensaio só tem formato `<destino>:<falha>` que a configuração aceita (`llm-config.ts`).
    for (const janela of JANELAS_DA_RESERVA) expect(janela.falha ?? 'principal:5xx').toMatch(/^principal:(5xx|prazo|conexao|429)$/)
  })

  it('o controle negativo troca só o id do provedor de reserva: o worker sobe com uma reserva que nenhuma aprovação cobre', () => {
    const doArquivo = doArquivoDeCarga()
    expect(variaveisDaReserva(janelaDe('5xx'), doArquivo, true)).toEqual({ ...variaveisDaReserva(janelaDe('5xx'), doArquivo), IA_RESERVA_PROVEDOR_ID: PROVEDOR_DA_RESERVA_SEM_APROVACAO })
    expect(PROVEDOR_DA_RESERVA_SEM_APROVACAO).toBe('falso-sem-aprovacao')
    // Nas janelas sem reserva ele não muda nada: o controle é a configuração da `sala`.
    expect(variaveisDaReserva(janelaDe('controle'), doArquivo, true)).toEqual(variaveisDaReserva(janelaDe('controle'), doArquivo))
  })

  it('a reserva da carga é sempre a falsa: outro adaptador no `infra/carga.env` derruba o script antes de subir', () => {
    expect(() => exigirReservaFalsa(doArquivoDeCarga())).not.toThrow()
    expect(() => exigirReservaFalsa({ RESERVA_DA_CARGA_ADAPTADOR: 'openai_compat' })).toThrow(/RESERVA_DA_CARGA_ADAPTADOR=falso/)
    expect(() => exigirReservaFalsa({})).toThrow(/RESERVA_DA_CARGA_ADAPTADOR=falso/)
  })
})

const medidaDaJanela = (janela: NomeDaJanela, mudanca: Partial<MedidaDaJanela> = {}): MedidaDaJanela => ({
  janela,
  amostrasDoTutor: 300,
  turnoDoTutorP95Ms: 6_400,
  indisponiveis: 0,
  temposEsgotados: 0,
  interrompidas: 0,
  outrasFalhas: 0,
  degrauDaReserva: janela === 'controle' ? 0 : 120,
  recusadasPeloBalde: janela === 'balde' ? 80 : 0,
  ...mudanca,
})
const reservaLimpa = (mudancas: Partial<Record<NomeDaJanela, Partial<MedidaDaJanela>>> = {}, resto: Partial<ResultadoDaReserva> = {}): ResultadoDaReserva => ({
  k6: { codigo: 0, cruzados: [], esperaBP95Ms: undefined },
  janelas: JANELAS_DA_RESERVA.map((janela) => medidaDaJanela(janela.nome, mudancas[janela.nome])),
  trocasAtrasadas: [],
  ...resto,
})
const criteriosDaReserva = (resultado: ResultadoDaReserva): string[] => julgarReserva(resultado).map((reprovacao) => reprovacao.criterio)

describe('a fase `reserva`: o veredito', () => {
  it('passa com a queda atendida pela reserva em todas as janelas, nenhum indisponível e o transbordo do balde cheio', () => {
    expect(julgarReserva(reservaLimpa())).toEqual([])
  })

  it('indisponível acima de zero na janela de 5xx reprova com o nome da janela, e no zero passa', () => {
    expect(julgarReserva(reservaLimpa({ '5xx': { indisponiveis: 3 } }))).toEqual([{ criterio: 'indisponivel_5xx', detalhe: 'reserva: 3 execuções terminaram IA_INDISPONIVEL na janela 5xx' }])
    expect(criteriosDaReserva(reservaLimpa({ '5xx': { indisponiveis: 0 } }))).toEqual([])
    // O mesmo vale para o 429 e para o balde cheio: o aluno não fica sem resposta em nenhuma janela.
    expect(criteriosDaReserva(reservaLimpa({ '429': { indisponiveis: 1 }, balde: { indisponiveis: 1 } }))).toEqual(['indisponivel_429', 'indisponivel_balde'])
  })

  it('o p95 do turno do Tutor 1 s acima do controle passa, e um milissegundo acima reprova (5xx e 429)', () => {
    const controle = 6_400
    const limite = controle + ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS
    expect(ACRESCIMO_MAXIMO_DO_TURNO_NA_QUEDA_MS).toBe(1_000)
    expect(criteriosDaReserva(reservaLimpa({ controle: { turnoDoTutorP95Ms: controle }, '5xx': { turnoDoTutorP95Ms: limite }, '429': { turnoDoTutorP95Ms: limite } }))).toEqual([])
    expect(criteriosDaReserva(reservaLimpa({ controle: { turnoDoTutorP95Ms: controle }, '5xx': { turnoDoTutorP95Ms: limite + 1 } }))).toEqual(['turno_5xx'])
    expect(criteriosDaReserva(reservaLimpa({ controle: { turnoDoTutorP95Ms: controle }, '429': { turnoDoTutorP95Ms: limite + 1 } }))).toEqual(['turno_429'])
    // A referência é a do controle da mesma corrida: com o controle mais lento, o mesmo p95 da queda passa.
    expect(criteriosDaReserva(reservaLimpa({ controle: { turnoDoTutorP95Ms: 9_000 }, '5xx': { turnoDoTutorP95Ms: 9_900 } }))).toEqual([])
    // Na queda por prazo e no balde cheio o turno não é julgado: o prazo da chamada e a espera de 8 s do degrau o alongam por desenho.
    expect(criteriosDaReserva(reservaLimpa({ prazo: { turnoDoTutorP95Ms: 30_000 }, balde: { turnoDoTutorP95Ms: 30_000 } }))).toEqual([])
  })

  it('a janela com poucos turnos, ou sem p95, não passa em branco; e sem o controle o limite não existe', () => {
    expect(AMOSTRAS_MINIMAS_DA_JANELA).toBe(30)
    expect(criteriosDaReserva(reservaLimpa({ '5xx': { amostrasDoTutor: AMOSTRAS_MINIMAS_DA_JANELA - 1 } }))).toEqual(['sem_amostra_5xx'])
    expect(criteriosDaReserva(reservaLimpa({ '429': { turnoDoTutorP95Ms: null } }))).toEqual(['sem_amostra_429'])
    expect(criteriosDaReserva(reservaLimpa({ '5xx': { amostrasDoTutor: AMOSTRAS_MINIMAS_DA_JANELA } }))).toEqual([])
    expect(criteriosDaReserva(reservaLimpa({ controle: { amostrasDoTutor: 0, turnoDoTutorP95Ms: null } }))).toEqual(['sem_amostra_controle'])
    // O controle com p95 mas poucos turnos não é referência: o limite da queda não nasce dele, e a janela de 5xx lenta não reprova por ele.
    expect(criteriosDaReserva(reservaLimpa({ controle: { amostrasDoTutor: AMOSTRAS_MINIMAS_DA_JANELA - 1 }, '5xx': { turnoDoTutorP95Ms: 99_000 } }))).toEqual(['sem_amostra_controle'])
    // O controle com turnos de sobra e sem p95 também não é referência: o `null` não vira limite de 1 s.
    expect(criteriosDaReserva(reservaLimpa({ controle: { amostrasDoTutor: 300, turnoDoTutorP95Ms: null }, '5xx': { turnoDoTutorP95Ms: 99_000 } }))).toEqual(['sem_amostra_controle'])
    const semBalde = reservaLimpa()
    expect(criteriosDaReserva({ ...semBalde, janelas: semBalde.janelas.filter((medida) => medida.janela !== 'balde') })).toEqual(['sem_amostra_balde'])
  })

  it('na queda por prazo o `IA_TEMPO_ESGOTADO` passa, contado, e o `IA_INDISPONIVEL` e o prazo esgotado fora da janela do prazo reprovam', () => {
    expect(criteriosDaReserva(reservaLimpa({ prazo: { temposEsgotados: 12 } }))).toEqual([])
    expect(criteriosDaReserva(reservaLimpa({ prazo: { indisponiveis: 1 } }))).toEqual(['indisponivel_prazo'])
    expect(criteriosDaReserva(reservaLimpa({ '5xx': { temposEsgotados: 1 }, controle: { temposEsgotados: 1 } }))).toEqual(['tempo_esgotado_controle', 'tempo_esgotado_5xx'])
  })

  it('qualquer outro erro em qualquer janela reprova, e as interrompidas da troca de worker são contadas e não julgadas', () => {
    expect(criteriosDaReserva(reservaLimpa({ prazo: { outrasFalhas: 2 } }))).toEqual(['falhas_prazo'])
    expect(criteriosDaReserva(reservaLimpa({ controle: { interrompidas: 25 }, '5xx': { interrompidas: 25 } }))).toEqual([])
  })

  it('o degrau da reserva que não subiu reprova a janela, inclusive o contador que o Prometheus não devolveu; o controle não o exige', () => {
    expect(criteriosDaReserva(reservaLimpa({ '5xx': { degrauDaReserva: 0 } }))).toEqual(['reserva_nao_atendeu_5xx'])
    expect(criteriosDaReserva(reservaLimpa({ prazo: { degrauDaReserva: undefined } }))).toEqual(['reserva_nao_atendeu_prazo'])
    expect(criteriosDaReserva(reservaLimpa({ '429': { degrauDaReserva: 1 }, balde: { degrauDaReserva: 1 } }))).toEqual([])
    expect(criteriosDaReserva(reservaLimpa({ controle: { degrauDaReserva: 0 } }))).toEqual([])
  })

  it('o balde cheio que não recusou nada não provou o transbordo: reprova, e sem o Prometheus também', () => {
    expect(criteriosDaReserva(reservaLimpa({ balde: { recusadasPeloBalde: 0 } }))).toEqual(['balde_nao_recusou'])
    expect(criteriosDaReserva(reservaLimpa({ balde: { recusadasPeloBalde: undefined } }))).toEqual(['balde_nao_recusou'])
    expect(criteriosDaReserva(reservaLimpa({ balde: { recusadasPeloBalde: 1 } }))).toEqual([])
    // Só a janela do balde precisa do balde recusando: nas de queda, o principal sequer chega a pedir vaga ao balde cheio.
    expect(criteriosDaReserva(reservaLimpa({ '5xx': { recusadasPeloBalde: 0 } }))).toEqual([])
  })

  it('threshold do k6 cruzado reprova com o nome da fase, o k6 que caiu também, e a troca de worker atrasada reprova a janela dela', () => {
    expect(julgarReserva(reservaLimpa({}, { k6: { codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: [{ metrica: 'respostas_inesperadas{grupo:sala_tutor}', criterio: 'count==0' }], esperaBP95Ms: undefined } })).map((reprovacao) => reprovacao.criterio)).toEqual([
      'reserva:respostas_inesperadas{grupo:sala_tutor}',
    ])
    expect(criteriosDaReserva(reservaLimpa({}, { k6: { codigo: 107, cruzados: [], esperaBP95Ms: undefined } }))).toEqual(['k6_reserva'])
    expect(criteriosDaReserva(reservaLimpa({}, { k6: { codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: [], esperaBP95Ms: undefined } }))).toEqual(['k6_reserva'])
    expect(criteriosDaReserva(reservaLimpa({}, { trocasAtrasadas: ['prazo'] }))).toEqual(['troca_atrasada_prazo'])
  })

  it('o resultado de cada janela separa as falhas do banco: indisponível, prazo esgotado e interrompida têm campo próprio, e o resto é "outra"', () => {
    const medida = montarMedidaDaJanela('prazo', { amostras: 250, p95Ms: 6_500 }, { IA_INDISPONIVEL: 1, IA_TEMPO_ESGOTADO: 4, EXECUCAO_INTERROMPIDA: 3, IA_SAIDA_INVALIDA: 2, ERRO_X: 5 }, 120, 0)
    expect(medida).toEqual({ janela: 'prazo', amostrasDoTutor: 250, turnoDoTutorP95Ms: 6_500, indisponiveis: 1, temposEsgotados: 4, interrompidas: 3, outrasFalhas: 7, degrauDaReserva: 120, recusadasPeloBalde: 0 })
    expect(montarMedidaDaJanela('controle', { amostras: 0, p95Ms: null }, {}, undefined, undefined)).toMatchObject({ indisponiveis: 0, temposEsgotados: 0, interrompidas: 0, outrasFalhas: 0, degrauDaReserva: undefined })
    expect(lerResumoDoK6(0, { metrics: { tempos_esgotados_reserva: { count: 9 } } }).temposEsgotados).toBe(9)
    expect(lerResumoDoK6(0, { metrics: {} }).temposEsgotados).toBeUndefined()
  })
})

describe('a fase `reserva`: o controle negativo', () => {
  it('a fase que não terminou, porque o compose ou o worker não subiu, sai 1 também no controle negativo: não provou nada', () => {
    expect(codigoDeSaidaDaReserva(undefined, false)).toBe(1)
    expect(codigoDeSaidaDaReserva(undefined, true)).toBe(1)
  })

  it('o controle negativo exige o indisponível nas duas janelas de queda, e o de uma só não basta', () => {
    expect(reprovadoPeloIndisponivel(julgarReserva(reservaLimpa({ '5xx': { indisponiveis: 40 } })))).toBe(false)
    expect(reprovadoPeloIndisponivel(julgarReserva(reservaLimpa({ '429': { indisponiveis: 35 } })))).toBe(false)
    expect(reprovadoPeloIndisponivel(julgarReserva(reservaLimpa({ '5xx': { indisponiveis: 40 }, '429': { indisponiveis: 35 } })))).toBe(true)
  })

  it('reprova pelo indisponível das janelas de queda por servidor e por 429, e não pela subida, pela amostra ou pelo degrau', () => {
    const semReserva = reservaLimpa({ '5xx': { indisponiveis: 40, degrauDaReserva: 0 }, '429': { indisponiveis: 35, degrauDaReserva: 0 }, prazo: { indisponiveis: 20, degrauDaReserva: 0 } })
    const reprovacoes = julgarReserva(semReserva)
    expect(reprovadoPeloIndisponivel(reprovacoes)).toBe(true)
    expect(codigoDeSaidaDaReserva(reprovacoes, true)).toBe(0)
    // Com a reserva elegível, passar é o certo, e o controle negativo que passa não provou nada.
    expect(codigoDeSaidaDaReserva([], true)).toBe(1)
    expect(codigoDeSaidaDaReserva([], false)).toBe(0)
    expect(codigoDeSaidaDaReserva(reprovacoes, false)).toBe(1)
  })

  it('o worker que nem subiu reprova por outro motivo, e o controle negativo não o aceita como prova', () => {
    // Sem worker não há execução concluída nem falha lida: a janela reprova por amostra e por degrau, e nenhuma por indisponível.
    const semWorker = julgarReserva(reservaLimpa({ '5xx': { amostrasDoTutor: 0, turnoDoTutorP95Ms: null, degrauDaReserva: 0 }, '429': { amostrasDoTutor: 0, turnoDoTutorP95Ms: null, degrauDaReserva: 0 } }))
    expect(semWorker.map((reprovacao) => reprovacao.criterio)).toEqual(['sem_amostra_5xx', 'reserva_nao_atendeu_5xx', 'sem_amostra_429', 'reserva_nao_atendeu_429'])
    expect(reprovadoPeloIndisponivel(semWorker)).toBe(false)
    expect(codigoDeSaidaDaReserva(semWorker, true)).toBe(1)
    // O indisponível só do prazo ou do controle não é o que o controle negativo precisa ver.
    expect(reprovadoPeloIndisponivel(julgarReserva(reservaLimpa({ prazo: { indisponiveis: 9 } })))).toBe(false)
  })
})

describe('a fase `reserva`: as leituras da janela no banco', () => {
  it('as consultas da janela levam as escolas e o intervalo [de, até) como parâmetros, e leem só o turno concluído do Tutor e as falhas', async () => {
    // O comportamento no banco é o do `infra/test/carga-da-manha.int.test.ts` (projeto `infra`, que o portão roda mas a corrida de mutações não alcança): aqui ficam as cláusulas e a ordem dos parâmetros.
    const chamadas: Array<{ texto: string; valores: unknown[] }> = []
    const banco = {
      query: (texto: string, valores: unknown[]) => {
        chamadas.push({ texto, valores })
        return Promise.resolve({ rows: [] })
      },
    } as unknown as Parameters<typeof medirTutorNaJanela>[0]
    const de = new Date('2026-11-23T10:00:00Z')
    const ate = new Date('2026-11-23T10:01:00Z')
    await medirTutorNaJanela(banco, ['escola-1'], de, ate)
    await falhasNaJanela(banco, ['escola-1'], de, ate)
    const [tutor = '', falhas = ''] = chamadas.map((chamada) => chamada.texto)
    for (const chamada of chamadas) expect(chamada.valores).toEqual([['escola-1'], de, ate])
    for (const texto of [tutor, falhas]) {
      expect(texto).toContain('escola_id = any($1::uuid[])')
      expect(texto).toContain('criada_em >= $2 and criada_em < $3')
    }
    expect(tutor).toContain("funcao = 'tutor_com_o_aluno' and estado = 'concluida'")
    expect(falhas).toContain("estado = 'falhou'")
  })
})

describe('a fase `reserva`: o que a corrida lê e escolhe', () => {
  it('as fases `base` e `carga` também levam a reserva e a falha falsa desligadas, mesmo com o shell exportando as do worker', () => {
    vi.stubEnv('IA_RESERVA_ADAPTADOR', 'falso')
    vi.stubEnv('IA_FALHA_FALSA', 'principal:5xx')
    vi.stubEnv('LLM_RESERVA_TOKENS_POR_MINUTO', '1')
    try {
      const base = ambienteDaBase('/pasta', doArquivoDeCarga(), false)
      for (const variavel of VARIAVEIS_DA_RESERVA) expect(base[variavel], variavel).toBe('')
      expect(base['IA_ADAPTADOR']).toBe('falso')
      expect(base['VAGAS_POR_ESCOLA_DESLIGADAS']).toBe('false')
      expect(ambienteDaBase('/pasta', doArquivoDeCarga(), true)['VAGAS_POR_ESCOLA_DESLIGADAS']).toBe('true')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('`--so=` escolhe uma das três fases, e qualquer outro valor derruba o script antes de subir', () => {
    expect(faseDaLinhaDeComando(['node', 'carga.ts'])).toBeUndefined()
    expect(faseDaLinhaDeComando(['node', 'carga.ts', '--controle-negativo'])).toBeUndefined()
    for (const fase of ['base', 'sala', 'reserva'] as const) expect(faseDaLinhaDeComando(['node', 'carga.ts', `--so=${fase}`, '--controle-negativo'])).toBe(fase)
    for (const invalido of ['--so=outra', '--so=', '--so=Reserva']) expect(() => faseDaLinhaDeComando(['node', 'carga.ts', invalido]), invalido).toThrow('--so aceita base, sala ou reserva')
  })

  it('o degrau da janela é a soma das séries no fim da janela, lida com `max_over_time` por tantos segundos quantos a janela tem (no mínimo 10); o Prometheus mudo é `undefined`', async () => {
    const chamadas: string[] = []
    const responder = (corpo: unknown, ok = true) =>
      vi.fn((url: string) => {
        chamadas.push(url)
        return Promise.resolve({ ok, json: () => Promise.resolve(corpo) })
      })
    try {
      vi.stubGlobal('fetch', responder({ data: { result: [{ value: [0, '7'] }, { value: [0, '3'] }] } }))
      expect(await degrauNaJanela('http://prom', 'espera', { inicio: new Date(0), fim: new Date(30_500) })).toBe(10)
      const url = new URL(chamadas[0] ?? '')
      expect(url.searchParams.get('query')).toBe('sum(max_over_time(ia_degradacao_total{degrau="espera"}[31s]))')
      expect(url.searchParams.get('time')).toBe('30.5')
      await degrauNaJanela('http://prom', 'provedor_de_reserva', { inicio: new Date(0), fim: new Date(5_000) })
      expect(new URL(chamadas[1] ?? '').searchParams.get('query')).toBe('sum(max_over_time(ia_degradacao_total{degrau="provedor_de_reserva"}[10s]))')
      vi.stubGlobal('fetch', responder({ data: { result: [] } }))
      expect(await degrauNaJanela('http://prom', 'espera', { inicio: new Date(0), fim: new Date(60_000) })).toBe(0)
      vi.stubGlobal('fetch', responder({}, false))
      expect(await degrauNaJanela('http://prom', 'espera', { inicio: new Date(0), fim: new Date(60_000) })).toBeUndefined()
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede'))))
      expect(await degrauNaJanela('http://prom', 'espera', { inicio: new Date(0), fim: new Date(60_000) })).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a leitura do Prometheus de cada janela começa quando a troca do worker voltou, e a da primeira, 5 s antes da carga', () => {
    const comeco = { inicioLocalMs: 1_000_000 }
    expect(inicioDaLeituraDaJanela(0, comeco, {}).getTime()).toBe(1_000_000 - 5_000)
    expect(inicioDaLeituraDaJanela(2, comeco, { 2: 1_200_000 }).getTime()).toBe(1_200_000)
    // Sem a hora da troca (a que não houve), vale o começo da carga da janela menos os 5 s.
    expect(inicioDaLeituraDaJanela(1, comeco, { 2: 1_200_000 }).getTime()).toBe(1_000_000 + limiteDaJanelaS(1) * 1_000 - 5_000)
  })

  it('o turno do Tutor e as falhas da janela viram o que o banco devolve: sem linha ou sem p95, nada medido; com p95, o número', async () => {
    const bancoCom = (rows: unknown[]) => ({ query: () => Promise.resolve({ rows }) }) as unknown as Parameters<typeof medirTutorNaJanela>[0]
    const de = new Date('2026-11-23T10:00:00Z')
    const ate = new Date('2026-11-23T10:01:00Z')
    expect(await medirTutorNaJanela(bancoCom([]), ['e1'], de, ate)).toEqual({ amostras: 0, p95Ms: null })
    expect(await medirTutorNaJanela(bancoCom([{ amostras: 0, p95: null }]), ['e1'], de, ate)).toEqual({ amostras: 0, p95Ms: null })
    expect(await medirTutorNaJanela(bancoCom([{ amostras: 230, p95: 6228.5 }]), ['e1'], de, ate)).toEqual({ amostras: 230, p95Ms: 6228.5 })
    expect(await falhasNaJanela(bancoCom([{ erro: 'IA_INDISPONIVEL', n: 3 }, { erro: 'IA_TEMPO_ESGOTADO', n: 1 }]), ['e1'], de, ate)).toEqual({ IA_INDISPONIVEL: 3, IA_TEMPO_ESGOTADO: 1 })
    expect(await falhasNaJanela(bancoCom([]), ['e1'], de, ate)).toEqual({})
  })

  it('o relatório da fase traz, por janela, o prazo esgotado e o resto, o que não foi lido e o limite da queda; diz que as falhas são de qualquer função', () => {
    const linhas = descreverReserva(
      reservaLimpa(
        { prazo: { temposEsgotados: 10, indisponiveis: 2 }, '5xx': { degrauDaReserva: undefined, turnoDoTutorP95Ms: null }, balde: { recusadasPeloBalde: 140 } },
        { k6: { codigo: 0, cruzados: [], esperaBP95Ms: undefined, temposEsgotados: 10, interrompidas: 3 }, trocasAtrasadas: ['429'] },
      ),
    )
    const texto = linhas.join('\n')
    expect(linhas[1]).toBe('▶ queda do principal (FASE=reserva): por janela')
    expect(linhas[2]).toContain('prazo esgotado')
    // A linha da janela do prazo: 2 indisponíveis na coluna delas e 10 na do prazo esgotado, na ordem do cabeçalho.
    expect(linhas.find((linha) => linha.trimStart().startsWith('prazo'))).toMatch(/prazo\s+\d+\s+\d+ ms\s+2\s+10\s+0\s+0\s/)
    // O que o Prometheus não devolveu e o p95 que não houve aparecem como tal, e não como zero.
    expect(linhas.find((linha) => linha.trimStart().startsWith('5xx'))).toMatch(/5xx\s+\d+\s+-\s/)
    expect(linhas.find((linha) => linha.trimStart().startsWith('5xx'))).toContain('não lido')
    expect(texto).toContain('limite da queda 7400 ms')
    expect(texto).toContain('k6: 10 execuções com IA_TEMPO_ESGOTADO e 3 interrompidas vistas pelo aluno; trocas de worker atrasadas: 429')
    expect(texto).toContain('de qualquer função (Tutor, ferramenta e proposta)')
    // Sem o controle medido, o limite não existe.
    expect(descreverReserva(reservaLimpa({ controle: { turnoDoTutorP95Ms: null } })).join('\n')).toContain('p95 do turno -; limite da queda -')
  })
})
