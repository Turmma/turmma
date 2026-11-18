import { describe, expect, it } from 'vitest'
import {
  AMOSTRAS_MINIMAS_DO_TURNO,
  codigoDeSaidaDaClassificacao,
  EXECUCOES_ESPERADAS,
  julgarClassificacao,
  MARGEM_SOBRE_A_BASE_MS,
  NOITE_EM_SEGUNDOS,
  projetarAsExecucoes,
  TETO_DO_PLANO_MS,
  TOTAL_DE_MATERIAIS,
  TOTAL_DE_SECOES,
  type MedidaDaClassificacao,
} from '../scripts/conferir-carga-classificacao.ts'
import { ambienteDoFalsoDoLote, argumentosDoK6DaClassificacao, configuracaoDoCenario, materiaisDoArgumento, TOKENS_POR_MINUTO_DO_CONTRATO } from '../scripts/carga-classificacao.ts'

/**
 * O cenário "300 apostilas, classificadas numa noite" sem subir nada (classificacao-bncc, tarefa 5.0; `cenarios.md`, "Carga"): o veredito critério por critério e o que o driver monta. A execução de verdade é
 * `npm run carga:classificacao`, manual, com a corrida registrada no documento da tarefa.
 */

const LIMPA: MedidaDaClassificacao = {
  configuracao: { replicasDaIa: 2, poolLotePorReplica: 1, vagasDaEscolaNoLote: 2, tokensPorMinuto: 2_500_000, baldeDoLotePorMinuto: 125_000, tokensPorExecucao: 31_000, latenciaDoModeloMs: 6_000 },
  agendamento: { secoes: TOTAL_DE_SECOES, execucoes: EXECUCOES_ESPERADAS, jobs: EXECUCOES_ESPERADAS },
  // 630 execuções em 3.750 s de relógio, 600 s deles com o provedor parado: 3.150 s andando, 5 s por execução, 12 por minuto.
  classificacao: { secoesClassificadas: TOTAL_DE_SECOES, secoesSemClassificacao: 0, concluidas: EXECUCOES_ESPERADAS, falhas: 0, pendentes: 0, primeiroInicioMs: 1_000_000, ultimoFimMs: 1_000_000 + 3_750_000 },
  parada: { minutos: 10, inicioMs: 1_800_000, fimMs: 2_400_000, concluidasAntes: 125, concluidasNaParada: 0 },
  turnoDaBNaBase: { amostras: 180, p95Ms: 6_400 },
  turnoDaBNoLote: { amostras: 120, p95Ms: 6_800 },
  planos: [
    { consulta: 'cobertura', tempoMs: 20, plano: ['Hash Join'] },
    { consulta: 'busca', tempoMs: 5, plano: ['Nested Loop'] },
  ],
}

const criterios = (medida: MedidaDaClassificacao): string[] => julgarClassificacao(medida).reprovacoes.map((reprovacao) => reprovacao.criterio)

describe('o veredito do cenário das 300 apostilas classificadas', () => {
  it('a medida limpa passa, e o relatório diz a configuração, a vazão, a parada, o Tutor da B e os planos', () => {
    const { passou, linhas } = julgarClassificacao(LIMPA)
    expect(passou).toBe(true)
    const texto = linhas.join('\n')
    expect(texto).toContain('2 réplicas do worker-ia com pool `lote` de 1, vaga da escola no lote 2, balde do lote 125000 tokens/min')
    expect(texto).toContain('7500 seções em 630 execuções, 630 jobs')
    expect(texto).toContain('5000 ms por execução (12 por minuto)')
    expect(texto).toContain('parada do provedor: 10 min, 125 execuções concluídas antes, 0 durante')
    expect(texto).toContain('p95 6800 ms com o lote (120 turnos), base 6400 ms')
    expect(texto).toContain('plano — cobertura: 20 ms')
  })

  it('as constantes são as da spec: 300 apostilas de 25 seções, 630 execuções (15 lotes de 500, 42 cada um), a noite de 10 h', () => {
    expect([TOTAL_DE_MATERIAIS, TOTAL_DE_SECOES, EXECUCOES_ESPERADAS, NOITE_EM_SEGUNDOS, MARGEM_SOBRE_A_BASE_MS]).toEqual([300, 7_500, 630, 36_000, 500])
  })

  it('a projeção é a vazão medida (sem a parada) vezes as 630, e só cabe na noite se a execução for rápida o bastante', () => {
    expect(projetarAsExecucoes({ concluidas: 100, primeiroInicioMs: 0, ultimoFimMs: 600_000 })).toEqual({ vazaoPorExecucaoMs: 6_000, projecaoEmSegundos: 3_780, execucoesPorMinuto: 10 })
    expect(projetarAsExecucoes({ concluidas: 100, primeiroInicioMs: 0, ultimoFimMs: 700_000 }, 100_000)).toEqual({ vazaoPorExecucaoMs: 6_000, projecaoEmSegundos: 3_780, execucoesPorMinuto: 10 })
    expect(projetarAsExecucoes({ concluidas: 0, primeiroInicioMs: null, ultimoFimMs: null })).toEqual({ vazaoPorExecucaoMs: null, projecaoEmSegundos: null, execucoesPorMinuto: null })
    // 60 s por execução: as 630 levam 37.500 s, acima das 10 h (36.000 s).
    expect(criterios({ ...LIMPA, classificacao: { ...LIMPA.classificacao, primeiroInicioMs: 0, ultimoFimMs: 630 * 60_000 + 600_000 } })).toEqual(['vazao'])
  })

  it.each([
    { caso: 'seções que não viraram 630 execuções', medida: { ...LIMPA, agendamento: { secoes: TOTAL_DE_SECOES, execucoes: 629, jobs: 629 } }, esperado: ['agendamento'] },
    { caso: 'execução sem o job dela', medida: { ...LIMPA, agendamento: { secoes: TOTAL_DE_SECOES, execucoes: EXECUCOES_ESPERADAS, jobs: EXECUCOES_ESPERADAS - 1 } }, esperado: ['agendamento'] },
    { caso: 'seção sem classificação na abertura da janela', medida: { ...LIMPA, classificacao: { ...LIMPA.classificacao, secoesClassificadas: TOTAL_DE_SECOES - 12, secoesSemClassificacao: 12, concluidas: EXECUCOES_ESPERADAS - 1, pendentes: 1 } }, esperado: ['classificacao'] },
    { caso: 'execução que falhou', medida: { ...LIMPA, classificacao: { ...LIMPA.classificacao, concluidas: EXECUCOES_ESPERADAS - 1, falhas: 1 } }, esperado: ['classificacao'] },
    { caso: 'o provedor não foi parado', medida: { ...LIMPA, parada: { minutos: 10, inicioMs: null, fimMs: null, concluidasAntes: 0, concluidasNaParada: 0 } }, esperado: ['parada'] },
    { caso: 'execuções concluídas com o worker-ia parado', medida: { ...LIMPA, parada: { ...LIMPA.parada, concluidasNaParada: 3 } }, esperado: ['parada'] },
    { caso: 'o lote não voltou depois da parada', medida: { ...LIMPA, parada: { ...LIMPA.parada, concluidasAntes: EXECUCOES_ESPERADAS } }, esperado: ['parada'] },
    { caso: 'turno da B acima da base mais a margem', medida: { ...LIMPA, turnoDaBNoLote: { amostras: 120, p95Ms: 6_400 + MARGEM_SOBRE_A_BASE_MS + 1 } }, esperado: ['turno_da_b'] },
    { caso: 'turno da B sem amostra suficiente', medida: { ...LIMPA, turnoDaBNoLote: { amostras: AMOSTRAS_MINIMAS_DO_TURNO - 1, p95Ms: 100 } }, esperado: ['turno_da_b'] },
    { caso: 'base do turno sem amostra', medida: { ...LIMPA, turnoDaBNaBase: { amostras: 0, p95Ms: null } }, esperado: ['turno_da_b'] },
    { caso: 'plano acima do teto', medida: { ...LIMPA, planos: [{ consulta: 'busca', tempoMs: TETO_DO_PLANO_MS + 1, plano: [] }] }, esperado: ['plano'] },
    { caso: 'nenhum plano medido', medida: { ...LIMPA, planos: [] }, esperado: ['plano'] },
  ])('$caso reprova só pelo critério dele', ({ medida, esperado }) => {
    expect(criterios(medida)).toEqual(esperado)
  })

  it('no limite exato passa: o critério é "até"', () => {
    expect(criterios({ ...LIMPA, turnoDaBNoLote: { amostras: 120, p95Ms: 6_400 + MARGEM_SOBRE_A_BASE_MS }, planos: [{ consulta: 'busca', tempoMs: TETO_DO_PLANO_MS, plano: [] }] })).toEqual([])
  })

  it('a saída do cenário é 0 sem reprovação e 1 com qualquer uma', () => {
    expect(codigoDeSaidaDaClassificacao([])).toBe(0)
    expect(codigoDeSaidaDaClassificacao(julgarClassificacao({ ...LIMPA, planos: [] }).reprovacoes)).toBe(1)
  })
})

describe('o que o driver monta', () => {
  it('o falso tem a latência do `rapido` e os tokens de uma execução, e o contratado de produção: nada de provedor pago', () => {
    expect(ambienteDoFalsoDoLote()).toEqual({
      IA_ADAPTADOR: 'falso',
      IA_LATENCIA_FALSA_MS: '6000',
      IA_LATENCIA_FALSA_MS_PADRAO: '0',
      IA_TOKENS_FALSOS_ENTRADA: '30400',
      IA_TOKENS_FALSOS_SAIDA: '600',
      LLM_TOKENS_POR_MINUTO: String(TOKENS_POR_MINUTO_DO_CONTRATO),
    })
  })

  it('a configuração do relatório: o balde do lote é 5 % do contratado, e as réplicas, o pool e a vaga são os do ambiente', () => {
    expect(configuracaoDoCenario({ IA_REPLICAS: '3', WORKER_IA_POOL_LOTE: '2', VAGAS_ESCOLA_LOTE: '4' })).toEqual({
      replicasDaIa: 3,
      poolLotePorReplica: 2,
      vagasDaEscolaNoLote: 4,
      tokensPorMinuto: 2_500_000,
      baldeDoLotePorMinuto: 125_000,
      tokensPorExecucao: 31_000,
      latenciaDoModeloMs: 6_000,
    })
    expect(configuracaoDoCenario({})).toMatchObject({ replicasDaIa: 2, poolLotePorReplica: 1, vagasDaEscolaNoLote: 2 })
  })

  it('o k6 leva o ritmo do Tutor deste cenário antes do script: 1 turno a cada 2 s, e o script segue como último argumento', () => {
    const argumentos = argumentosDoK6DaClassificacao('ingestao', '3m', 6_059)
    expect(argumentos.at(-1)).toBe('/cenario/ingestao.js')
    expect(argumentos.slice(-3)).toEqual(['--env', 'TURNOS_DA_B_POR_2S=1', '/cenario/ingestao.js'])
    expect(argumentos).toContain('TURNO_BASE_P95_MS=6059')
  })

  it('--materiais ensaia o driver com menos apostilas, e recusa o que não é de 1 a 300', () => {
    expect(materiaisDoArgumento([])).toBe(300)
    expect(materiaisDoArgumento(['--materiais=12'])).toBe(12)
    for (const ruim of ['--materiais=0', '--materiais=301', '--materiais=abc', '--materiais=1.5']) expect(() => materiaisDoArgumento([ruim]), ruim).toThrow('--materiais precisa de um inteiro')
  })
})
