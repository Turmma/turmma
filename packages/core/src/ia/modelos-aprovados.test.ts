import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TAREFAS_DE_IA, type TarefaDeIa } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { IDENTIDADE_DA_RESERVA_FALSA } from '../config/llm-config.js'
import { MODELO_FALSO } from './fake-adapter.js'
import { aprovadaParaAReserva, MODELOS_APROVADOS, problemasDosModelosAprovados, reservaElegivel, tarefasAprovadasParaAReserva, type ModeloAprovado, type ReservaDoGateway } from './modelos-aprovados.js'
import { TASK_CATALOG } from './tasks/index.js'

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

/** Quem lê o disco é o teste: a guarda é pura e recebe o leitor. `undefined` é o relatório que não existe. */
function lerDoDisco(caminho: string): string | undefined {
  try {
    return readFileSync(`${RAIZ}${caminho}`, 'utf8')
  } catch {
    return undefined
  }
}

const sha256 = (texto: string): string => createHash('sha256').update(texto).digest('hex')

/** A entrada do falso, a que a constante traz: o ponto de partida de cada defeito. */
const DO_FALSO = MODELOS_APROVADOS.find((entrada) => entrada.tarefa === 'turno_do_tutor')
if (DO_FALSO === undefined) throw new Error('a constante deveria ter a entrada do falso para o Tutor')

const RELATORIO_DO_FALSO = DO_FALSO.relatorio
const TEXTO_DO_RELATORIO = lerDoDisco(RELATORIO_DO_FALSO) ?? ''

/** Uma entrada de provedor de verdade, de mentira: o relatório é o sintético, que existe, com o `sha256` dele. */
const entradaDe = (tarefa: TarefaDeIa, provedorId: string, modelo: string): ModeloAprovado => ({ ...DO_FALSO, tarefa, provedorId, modelo })

/** A reserva como o gateway a vê: a identidade e um modelo por perfil. */
const reservaDe = (identidade: string, modelos: Partial<Record<'rapido' | 'padrao' | 'complexo' | 'visao', string>> = {}, padrao = 'modelo-x'): ReservaDoGateway => ({
  identidade,
  modeloDoPerfil: (perfil) => modelos[perfil] ?? padrao,
})

const CONFERIDA = { conferida: true }

describe('MODELOS_APROVADOS: a constante e a guarda do relatório', () => {
  it('a constante de hoje não tem defeito: toda entrada cita um relatório que existe e confere com o `sha256` dela', () => {
    expect(TEXTO_DO_RELATORIO).not.toBe('')
    expect(problemasDosModelosAprovados(MODELOS_APROVADOS, lerDoDisco)).toEqual([])
  })

  it('o falso da reserva tem uma entrada por tarefa de `TAREFAS_DE_IA`, todas no modelo do falso e no relatório sintético, e nenhuma de outro provedor', () => {
    expect(MODELOS_APROVADOS.map((entrada) => entrada.tarefa)).toEqual([...TAREFAS_DE_IA])
    for (const entrada of MODELOS_APROVADOS) {
      expect(entrada).toMatchObject({ provedorId: IDENTIDADE_DA_RESERVA_FALSA, modelo: MODELO_FALSO, relatorio: 'docs/avaliacao/falso-reserva/relatorio.md', sha256: sha256(TEXTO_DO_RELATORIO) })
    }
  })

  it('cada defeito quebra, um por caso, também na entrada do falso', () => {
    const quem = `${DO_FALSO.provedorId}:${DO_FALSO.modelo}:${DO_FALSO.tarefa}`
    const defeitos: [string, ModeloAprovado, string][] = [
      ['tarefa fora de TAREFAS_DE_IA', { ...DO_FALSO, tarefa: 'tarefa_que_nao_existe' as TarefaDeIa }, 'tarefa_fora_de_TAREFAS_DE_IA'],
      ['sem relatório', { ...DO_FALSO, relatorio: '' }, 'sem_relatorio'],
      ['sem sha256', { ...DO_FALSO, sha256: '' }, 'sem_sha256'],
      ['sem aprovadoPor', { ...DO_FALSO, aprovadoPor: '' }, 'sem_aprovadoPor'],
      ['relatório que não existe', { ...DO_FALSO, relatorio: 'docs/avaliacao/nao-existe/relatorio.md' }, 'relatorio_ausente:docs/avaliacao/nao-existe/relatorio.md'],
      ['sha256 que não bate', { ...DO_FALSO, sha256: sha256('outro texto') }, `sha256_diferente:${RELATORIO_DO_FALSO}`],
    ]
    for (const [nome, entrada, motivo] of defeitos) {
      const esperado = entrada.tarefa === DO_FALSO.tarefa ? quem : `${entrada.provedorId}:${entrada.modelo}:${entrada.tarefa}`
      expect(problemasDosModelosAprovados([entrada], lerDoDisco), nome).toEqual([`${esperado}: ${motivo}`])
    }
  })

  it('a guarda recalcula o hash do texto que o leitor devolve: relatório editado depois da aprovação deixa de valer', () => {
    expect(problemasDosModelosAprovados([DO_FALSO], () => TEXTO_DO_RELATORIO)).toEqual([])
    expect(problemasDosModelosAprovados([DO_FALSO], () => `${TEXTO_DO_RELATORIO} `)).toHaveLength(1)
    expect(problemasDosModelosAprovados([DO_FALSO], () => undefined)).toEqual([expect.stringContaining('relatorio_ausente')])
  })

  it('cada entrada é conferida, e o defeito de uma não esconde o da outra', () => {
    const quebradas = [{ ...DO_FALSO, sha256: '' }, entradaDe('gerar_plano_de_aula', 'provedor-real', 'modelo-x'), { ...DO_FALSO, aprovadoPor: '' }]
    expect(problemasDosModelosAprovados(quebradas, lerDoDisco)).toEqual([expect.stringContaining('sem_sha256'), expect.stringContaining('sem_aprovadoPor')])
  })
})

describe('reservaElegivel: configurada, conferida e com aprovação para a tarefa, o provedor e o modelo', () => {
  const tutor = { nome: 'turno_do_tutor', perfil: TASK_CATALOG.turno_do_tutor.perfil } as const
  const geracao = { nome: 'gerar_atividade_objetiva', perfil: TASK_CATALOG.gerar_atividade_objetiva.perfil } as const
  const aprovadoParaTudo = [entradaDe('turno_do_tutor', 'provedor-real', 'modelo-x'), entradaDe('gerar_atividade_objetiva', 'provedor-real', 'modelo-x')]
  const elegivel = (tarefa: typeof tutor | typeof geracao, reserva: ReservaDoGateway | undefined, aprovados: readonly ModeloAprovado[], ambiente: 'local' | 'staging' | 'producao' = 'producao', soberania = CONFERIDA) =>
    reservaElegivel(tarefa, { ...(reserva === undefined ? {} : { reserva }), soberania, ambiente, aprovados })

  it('controle positivo: a que bate em tarefa, provedor e modelo do perfil é elegível, na geração e no Tutor', () => {
    const reserva = reservaDe('provedor-real')
    expect(elegivel(tutor, reserva, aprovadoParaTudo)).toBe(true)
    expect(elegivel(geracao, reserva, aprovadoParaTudo)).toBe(true)
  })

  it('outro provedorId com o mesmo modelo não é elegível, e o mesmo provedor com outro modelo também não', () => {
    expect(elegivel(tutor, reservaDe('outro-provedor'), aprovadoParaTudo)).toBe(false)
    expect(elegivel(tutor, reservaDe('provedor-real', {}, 'modelo-y'), aprovadoParaTudo)).toBe(false)
  })

  it('o modelo que conta é o do perfil da tarefa: trocar o do `rapido` tira o Tutor e deixa a geração, que é do `padrao`', () => {
    expect(tutor.perfil).toBe('rapido')
    expect(geracao.perfil).toBe('padrao')
    const reserva = reservaDe('provedor-real', { rapido: 'modelo-y' })
    expect(elegivel(tutor, reserva, aprovadoParaTudo)).toBe(false)
    expect(elegivel(geracao, reserva, aprovadoParaTudo)).toBe(true)
  })

  it('a aprovação é por tarefa: aprovada só para a geração, o Tutor não é elegível', () => {
    const soAGeracao = [entradaDe('gerar_atividade_objetiva', 'provedor-real', 'modelo-x')]
    const reserva = reservaDe('provedor-real')
    expect(elegivel(geracao, reserva, soAGeracao)).toBe(true)
    expect(elegivel(tutor, reserva, soAGeracao)).toBe(false)
    expect(elegivel(tutor, reserva, [])).toBe(false)
  })

  it('sem reserva configurada, ou sem a conferência da D62 dela, nenhuma tarefa é elegível: falha fechada', () => {
    expect(elegivel(geracao, undefined, aprovadoParaTudo)).toBe(false)
    expect(elegivel(geracao, reservaDe('provedor-real'), aprovadoParaTudo, 'producao', { conferida: false })).toBe(false)
    expect(reservaElegivel(geracao, { reserva: reservaDe('provedor-real'), ambiente: 'producao', aprovados: aprovadoParaTudo })).toBe(false)
  })

  it('a entrada do `falso-reserva` não vale em produção e vale em `local` e em `staging`; a de outro provedor vale nos três', () => {
    const falsa = reservaDe(IDENTIDADE_DA_RESERVA_FALSA, {}, MODELO_FALSO)
    const real = reservaDe('provedor-real')
    expect(elegivel(tutor, falsa, MODELOS_APROVADOS, 'producao')).toBe(false)
    expect(elegivel(tutor, falsa, MODELOS_APROVADOS, 'local')).toBe(true)
    expect(elegivel(tutor, falsa, MODELOS_APROVADOS, 'staging')).toBe(true)
    for (const ambiente of ['local', 'staging', 'producao'] as const) expect(elegivel(tutor, real, aprovadoParaTudo, ambiente), ambiente).toBe(true)
  })

  it('sem aprovados injetados vale `MODELOS_APROVADOS`: o falso da reserva é elegível fora de produção, e a função não aceita nada em produção', () => {
    const falsa = reservaDe(IDENTIDADE_DA_RESERVA_FALSA, {}, MODELO_FALSO)
    expect(reservaElegivel(tutor, { reserva: falsa, soberania: CONFERIDA, ambiente: 'local' })).toBe(true)
    expect(reservaElegivel(tutor, { reserva: falsa, soberania: CONFERIDA, ambiente: 'producao' })).toBe(false)
    expect(aprovadaParaAReserva(tutor, falsa, 'staging')).toBe(true)
    expect(aprovadaParaAReserva(tutor, falsa, 'producao')).toBe(false)
  })

  it('as tarefas aprovadas para a reserva são as que a elegibilidade aceitaria, na ordem de `TAREFAS_DE_IA`', () => {
    const reserva = reservaDe('provedor-real')
    const aprovados = [entradaDe('gerar_plano_de_aula', 'provedor-real', 'modelo-x'), entradaDe('turno_do_tutor', 'provedor-real', 'modelo-x'), entradaDe('adaptar_atividade', 'outro', 'modelo-x')]
    expect(tarefasAprovadasParaAReserva(reserva, 'producao', aprovados)).toEqual(TAREFAS_DE_IA.filter((nome) => nome === 'gerar_plano_de_aula' || nome === 'turno_do_tutor'))
    expect(tarefasAprovadasParaAReserva(reservaDe(IDENTIDADE_DA_RESERVA_FALSA, {}, MODELO_FALSO), 'producao')).toEqual([])
    expect(tarefasAprovadasParaAReserva(reservaDe(IDENTIDADE_DA_RESERVA_FALSA, {}, MODELO_FALSO), 'local')).toEqual([...TAREFAS_DE_IA])
  })
})
