import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FUNCAO_DA_TAREFA_DE_IA, FUNCOES, TAREFAS_DE_IA, type TarefaDeIa } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { IDENTIDADE_DA_RESERVA_FALSA } from '../config/llm-config.js'
import { MODELO_FALSO } from './fake-adapter.js'
import { AIA_DA_FUNCAO, aprovadaParaAReserva, LINHAS_DA_D55, MODELOS_APROVADOS, problemasDaCadeiaDeAprovacao, problemasDosModelosAprovados, reservaElegivel, tarefasAprovadasParaAReserva, type ModeloAprovado, type ReservaDoGateway } from './modelos-aprovados.js'
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

describe('a cadeia do RF16: entrada → relatório → `resultado.json` aprovado → AIA da função', () => {
  const CAMINHO_DO_RELATORIO = 'docs/avaliacao/provedor-real/2026-11-22/relatorio.md'
  const CAMINHO_DO_RESULTADO = 'docs/avaliacao/provedor-real/2026-11-22/resultado.json'
  const RESULTADO_DO_FALSO = lerDoDisco('docs/avaliacao/falso-reserva/resultado.json') ?? ''
  const LINHA_DO_HASH = /sha256 do `resultado\.json`: `[0-9a-f]{64}`/u

  type Resultado = { eliminado: boolean; linhas: { id: string; tarefa: string; situacao: string; eliminada: boolean; perfil?: string }[] }
  const resultadoDe = (editar: (resultado: Resultado) => void = () => undefined): string => {
    const resultado = JSON.parse(RESULTADO_DO_FALSO) as Resultado
    editar(resultado)
    return `${JSON.stringify(resultado, null, 2)}\n`
  }
  const linhaDe = (resultado: Resultado, id: string): Resultado['linhas'][number] => {
    const linha = resultado.linhas.find((candidata) => candidata.id === id)
    if (linha === undefined) throw new Error(`o resultado sintético deveria ter a linha ${id}`)
    return linha
  }
  const relatorioDo = (resultado: string): string => TEXTO_DO_RELATORIO.replace(LINHA_DO_HASH, `sha256 do \`resultado.json\`: \`${sha256(resultado)}\``)

  /** Os arquivos de um provedor de verdade, de mentira: o relatório que cita o hash do resultado, o resultado e as AIAs que citam (ou não) `provedor-real:modelo-x`. */
  interface Arquivos {
    resultado?: string | null
    relatorio?: string
    aias?: Partial<Record<string, string | null>>
  }
  function leitorDe({ resultado = resultadoDe(), relatorio = relatorioDo(resultado ?? resultadoDe()), aias = {} }: Arquivos = {}): (caminho: string) => string | undefined {
    const citando = 'Modelo aprovado: provedor-real:modelo-x.'
    return (caminho) => {
      if (caminho === CAMINHO_DO_RELATORIO) return relatorio
      if (caminho === CAMINHO_DO_RESULTADO) return resultado ?? undefined
      const aia = Object.values(AIA_DA_FUNCAO).includes(caminho) ? (aias[caminho] === undefined ? citando : aias[caminho]) : undefined
      return aia ?? undefined
    }
  }
  const doProvedor = (tarefa: TarefaDeIa, relatorio = relatorioDo(resultadoDe())): ModeloAprovado => ({ tarefa, provedorId: 'provedor-real', modelo: 'modelo-x', relatorio: CAMINHO_DO_RELATORIO, sha256: sha256(relatorio), aprovadoPor: 'joaquim', aprovadoEm: '2026-11-22' })
  const problemas = (entrada: ModeloAprovado, arquivos: Arquivos = {}): string[] => problemasDaCadeiaDeAprovacao([entrada], leitorDe(arquivos), (tarefa) => TASK_CATALOG[tarefa].perfil)

  it('a constante de hoje fecha a cadeia: o `resultado.json` sintético confere com o relatório, e a reserva falsa fica fora da AIA', () => {
    expect(RESULTADO_DO_FALSO).not.toBe('')
    expect(problemasDaCadeiaDeAprovacao(MODELOS_APROVADOS, lerDoDisco)).toEqual([])
  })

  it('o provedor de verdade com tudo aprovado, relatório e resultado conferidos e a AIA citando o modelo, passa, em cada tarefa', () => {
    for (const tarefa of TAREFAS_DE_IA) expect(problemas(doProvedor(tarefa)), tarefa).toEqual([])
  })

  it('o `resultado.json` com um byte trocado depois do relatório (um `false` virado `true`) quebra: o hash que o relatório traz não confere', () => {
    const editado = resultadoDe().replace('"eliminada": false', '"eliminada": true')
    expect(editado).not.toBe(resultadoDe())
    const quebrado = problemas(doProvedor('gerar_plano_de_aula'), { resultado: editado, relatorio: relatorioDo(resultadoDe()) })
    expect(quebrado).toEqual([`provedor-real:modelo-x:gerar_plano_de_aula: sha256_do_resultado_diferente:${CAMINHO_DO_RESULTADO}`])
  })

  it('o relatório sem o hash do `resultado.json`, e o `resultado.json` que não existe, quebram', () => {
    const semHash = TEXTO_DO_RELATORIO.replace(LINHA_DO_HASH, '')
    expect(problemas(doProvedor('gerar_plano_de_aula'), { relatorio: semHash })).toEqual([`provedor-real:modelo-x:gerar_plano_de_aula: relatorio_sem_sha256_do_resultado:${CAMINHO_DO_RELATORIO}`])
    expect(problemas(doProvedor('gerar_plano_de_aula'), { resultado: null })).toEqual([`provedor-real:modelo-x:gerar_plano_de_aula: resultado_ausente:${CAMINHO_DO_RESULTADO}`])
  })

  it('a linha reprovada da tarefa quebra, e a `nao_medida` também; a de outra tarefa não pesa', () => {
    const reprovada = resultadoDe((resultado) => void (linhaDe(resultado, 'plano_de_aula').situacao = 'reprovada'))
    expect(problemas(doProvedor('gerar_plano_de_aula'), { resultado: reprovada })).toEqual(['provedor-real:modelo-x:gerar_plano_de_aula: linha_reprovada:plano_de_aula'])
    expect(problemas(doProvedor('gerar_atividade_objetiva'), { resultado: reprovada })).toEqual([])
    const naoMedida = resultadoDe((resultado) => void (linhaDe(resultado, 'plano_de_aula').situacao = 'nao_medida'))
    expect(problemas(doProvedor('gerar_plano_de_aula'), { resultado: naoMedida })).toEqual(['provedor-real:modelo-x:gerar_plano_de_aula: linha_nao_medida:plano_de_aula'])
  })

  it('o finalista eliminado quebra todas as tarefas dele, e a linha eliminatória reprovada também', () => {
    const eliminado = resultadoDe((resultado) => void (resultado.eliminado = true))
    expect(problemas(doProvedor('gerar_plano_de_aula'), { resultado: eliminado })).toEqual(['provedor-real:modelo-x:gerar_plano_de_aula: finalista_eliminado'])
    const eliminatoria = resultadoDe((resultado) => {
      const linha = linhaDe(resultado, 'equidade')
      linha.situacao = 'reprovada'
      linha.eliminada = true
    })
    expect(problemas(doProvedor('turno_do_tutor'), { resultado: eliminatoria })).toEqual(['provedor-real:modelo-x:turno_do_tutor: linha_reprovada:equidade', 'provedor-real:modelo-x:turno_do_tutor: linha_eliminatoria_reprovada:equidade'])
  })

  it('a `propor_ferramenta` sem a D55 aprovada quebra, com a linha **ausente** (não reprovada) também: as duas da D55 têm de estar', () => {
    for (const id of LINHAS_DA_D55) {
      const ausente = resultadoDe((resultado) => void (resultado.linhas = resultado.linhas.filter((linha) => linha.id !== id)))
      expect(problemas(doProvedor('propor_ferramenta'), { resultado: ausente }), id).toEqual([`provedor-real:modelo-x:propor_ferramenta: d55_nao_aprovada:${id}`])
      // A mesma linha ausente não pesa em outra tarefa.
      expect(problemas(doProvedor('gerar_plano_de_aula'), { resultado: ausente }), id).toEqual([])
    }
  })

  it('a tarefa sem nenhuma linha no `resultado.json` quebra: o relatório que não mediu a tarefa não a aprova', () => {
    const semATarefa = resultadoDe((resultado) => void (resultado.linhas = resultado.linhas.filter((linha) => linha.tarefa !== 'adaptar_atividade')))
    expect(problemas(doProvedor('adaptar_atividade'), { resultado: semATarefa })).toContain('provedor-real:modelo-x:adaptar_atividade: tarefa_sem_linha_no_resultado')
  })

  it('a função de alto risco sem `provedorId:modelo` na AIA quebra, e a AIA que não existe também; a que não é de alto risco não pede AIA', () => {
    const altoRisco = TAREFAS_DE_IA.filter((tarefa) => FUNCOES[FUNCAO_DA_TAREFA_DE_IA[tarefa]].altoRisco)
    expect(altoRisco.length).toBeGreaterThan(0)
    for (const tarefa of altoRisco) {
      const aia = AIA_DA_FUNCAO[FUNCAO_DA_TAREFA_DE_IA[tarefa]] ?? ''
      expect(problemas(doProvedor(tarefa), { aias: { [aia]: 'Modelo aprovado: outro-provedor:outro-modelo.' } }), tarefa).toEqual([`provedor-real:modelo-x:${tarefa}: aia_sem_o_modelo:${aia}`])
      expect(problemas(doProvedor(tarefa), { aias: { [aia]: null } }), tarefa).toEqual([`provedor-real:modelo-x:${tarefa}: aia_ausente:${aia}`])
    }
    for (const tarefa of TAREFAS_DE_IA.filter((candidata) => !altoRisco.includes(candidata))) {
      const todasSemOModelo = Object.fromEntries(Object.values(AIA_DA_FUNCAO).map((caminho) => [caminho, 'sem modelo']))
      expect(problemas(doProvedor(tarefa), { aias: todasSemOModelo }), tarefa).toEqual([])
    }
  })

  it('a AIA que cita outro modelo com o mesmo começo não vale: `modelo-x2` e `modelo-x-large` não são `modelo-x`; a citação por inteiro, no fim da frase ou entre crases, vale', () => {
    const aia = AIA_DA_FUNCAO[FUNCAO_DA_TAREFA_DE_IA.turno_do_tutor] ?? ''
    const comATexto = (texto: string): string[] => problemas(doProvedor('turno_do_tutor'), { aias: { [aia]: texto } })
    const sem = [`provedor-real:modelo-x:turno_do_tutor: aia_sem_o_modelo:${aia}`]
    expect(comATexto('Modelo aprovado: provedor-real:modelo-x2.')).toEqual(sem)
    expect(comATexto('Modelo aprovado: provedor-real:modelo-x-large.')).toEqual(sem)
    expect(comATexto('Modelo aprovado: provedor-real:modelo-x.5')).toEqual(sem)
    expect(comATexto('Modelo aprovado: outro-provedor-real:modelo-x.')).toEqual(sem)
    expect(comATexto('Modelo aprovado: provedor-real:modelo-x.')).toEqual([])
    expect(comATexto('Modelo aprovado: `provedor-real:modelo-x`, medido em 22/11.')).toEqual([])
    expect(comATexto('provedor-real:modelo-x')).toEqual([])
  })

  it('o `.` e os outros caracteres do modelo valem como letra, e não como curinga: `modeloxx` não casa com `modelo.x`', () => {
    const doPonto = { ...doProvedor('turno_do_tutor'), modelo: 'modelo.x' }
    const aia = AIA_DA_FUNCAO[FUNCAO_DA_TAREFA_DE_IA.turno_do_tutor] ?? ''
    expect(problemas(doPonto, { aias: { [aia]: 'provedor-real:modeloxx' } })).toEqual([`provedor-real:modelo.x:turno_do_tutor: aia_sem_o_modelo:${aia}`])
    expect(problemas(doPonto, { aias: { [aia]: 'provedor-real:modelo.x' } })).toEqual([])
  })

  it('nenhuma entrada de provedor de verdade aponta para a pasta `falso-reserva`: o relatório e o resultado do falso são só do falso', () => {
    const deVerdade = MODELOS_APROVADOS.filter((entrada) => entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA)
    for (const entrada of deVerdade) expect(entrada.relatorio, `${entrada.provedorId}:${entrada.tarefa}`).not.toContain('falso-reserva')
    // O controle: a guarda enxerga a entrada do falso, que aponta para a pasta dele.
    expect(MODELOS_APROVADOS.filter((entrada) => entrada.provedorId === IDENTIDADE_DA_RESERVA_FALSA).every((entrada) => entrada.relatorio.includes('falso-reserva'))).toBe(true)
  })

  it('toda função de alto risco de uma tarefa tem AIA no mapa, e o arquivo existe', () => {
    for (const tarefa of TAREFAS_DE_IA) {
      const funcao = FUNCAO_DA_TAREFA_DE_IA[tarefa]
      if (!FUNCOES[funcao].altoRisco) continue
      const caminho = AIA_DA_FUNCAO[funcao]
      expect(caminho, funcao).toBeDefined()
      expect(lerDoDisco(caminho ?? ''), caminho).toBeDefined()
    }
  })

  it('o relatório do falso não é cobrado na AIA: a mesma entrada com outro provedor, sim', () => {
    const doFalso = { ...doProvedor('turno_do_tutor'), provedorId: IDENTIDADE_DA_RESERVA_FALSA, modelo: MODELO_FALSO }
    expect(problemas(doFalso, { aias: { 'docs/aia/tutor.md': 'sem modelo' } })).toEqual([])
    expect(problemas(doProvedor('turno_do_tutor'), { aias: { 'docs/aia/tutor.md': 'sem modelo' } })).toEqual(['provedor-real:modelo-x:turno_do_tutor: aia_sem_o_modelo:docs/aia/tutor.md'])
  })

  describe('a classificação aprovada no `padrao` só vale com o perfil trocado junto', () => {
    const comPerfil = (perfil: 'rapido' | 'padrao' | undefined): string =>
      resultadoDe((resultado) => {
        const linha = linhaDe(resultado, 'classificacao')
        if (perfil === undefined) delete linha.perfil
        else linha.perfil = perfil
      })
    const aia = 'docs/aia/diagnostico-por-habilidade.md'
    const perfilNoCodigo = (perfil: 'rapido' | 'padrao') => (): 'rapido' | 'padrao' => perfil
    const checar = (perfilNoResultado: 'rapido' | 'padrao' | undefined, noCodigo: 'rapido' | 'padrao'): string[] =>
      problemasDaCadeiaDeAprovacao([doProvedor('classificar_secoes')], leitorDe({ resultado: comPerfil(perfilNoResultado), aias: { [aia]: 'provedor-real:modelo-x' } }), perfilNoCodigo(noCodigo))

    it('aprovada no `padrao` com o perfil trocado para o `padrao` passa; com o perfil antigo (`rapido`) no código, quebra', () => {
      expect(checar('padrao', 'padrao')).toEqual([])
      expect(checar('padrao', 'rapido')).toEqual(['provedor-real:modelo-x:classificar_secoes: classificacao_aprovada_no_padrao_com_o_perfil_rapido_no_codigo'])
    })

    it('aprovada no `rapido` com o código já no `padrao` também quebra: o modelo avaliado não é o que atende', () => {
      expect(checar('rapido', 'rapido')).toEqual([])
      expect(checar('rapido', 'padrao')).toEqual(['provedor-real:modelo-x:classificar_secoes: classificacao_aprovada_no_rapido_com_o_perfil_padrao_no_codigo'])
    })

    it('a linha sem perfil não diz em qual modelo foi aprovada, e quebra', () => {
      expect(checar(undefined, 'rapido')).toEqual(['provedor-real:modelo-x:classificar_secoes: classificacao_sem_perfil'])
    })

    it('o perfil que o catálogo tem hoje para a classificação é o `rapido`, o que o `resultado.json` sintético marca', () => {
      expect(TASK_CATALOG.classificar_secoes.perfil).toBe('rapido')
    })
  })
})
