import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { currentContext, runInContext } from '../contexto/contexto.js'
import {
  OperationalSettings,
  NOVA_TENTATIVA_DA_CONFIGURACAO_MS,
  resolverJanela,
  resolverLimites,
  resolverVagas,
  resolverVagasDaEscola,
  VAGAS_SEM_LIMITE,
  VALIDADE_DA_CONFIGURACAO_MS,
} from './configuracao-operacional.js'
import type { OperationalSettingsRow } from './configuracao-operacional.repository.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0190f5a0-0000-7000-8000-00000000000b'
const VAGAS_PADRAO = { interativa: 5, normal: 5, lote: 2 }
const LIMITES_PADRAO = { porUsuarioMin: 120, porEscolaMin: 30_000 }
const JANELA_PADRAO = { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' }

const linha = (parcial: Partial<OperationalSettingsRow>): OperationalSettingsRow => ({ fuso: null, diasLetivos: null, inicio: null, fim: null, limiteReqUsuarioMin: null, limiteReqEscolaMin: null, vagas: null, ...parcial })
const naEscola = <T>(escolaId: string, funcao: () => T): T => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

describe('resolverVagas e resolverLimites', () => {
  it('escola sem linha opera com o padrão do ambiente inteiro', () => {
    expect(resolverVagas(VAGAS_PADRAO, undefined)).toEqual(VAGAS_PADRAO)
    expect(resolverLimites(LIMITES_PADRAO, undefined)).toEqual(LIMITES_PADRAO)
  })

  it('vagas nulas usam o padrão; a fila configurada troca só ela', () => {
    expect(resolverVagas(VAGAS_PADRAO, linha({ limiteReqEscolaMin: 10 }))).toEqual(VAGAS_PADRAO)
    expect(resolverVagas(VAGAS_PADRAO, linha({ vagas: { lote: 5 } }))).toEqual({ interativa: 5, normal: 5, lote: 5 })
  })

  it('com a vaga por escola desligada (controle negativo), nenhuma fila tem teto, nem a da escola que configurou o seu', () => {
    expect(resolverVagasDaEscola(VAGAS_PADRAO, linha({ vagas: { lote: 1 } }), false)).toEqual({ interativa: 5, normal: 5, lote: 1 })
    expect(resolverVagasDaEscola(VAGAS_PADRAO, linha({ vagas: { lote: 1 } }), true)).toEqual(VAGAS_SEM_LIMITE)
    expect(Object.values(VAGAS_SEM_LIMITE)).toEqual([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])
  })

  it('cada limite nulo cai no padrão, independente do outro', () => {
    expect(resolverLimites(LIMITES_PADRAO, linha({ limiteReqEscolaMin: 3 }))).toEqual({ porUsuarioMin: 120, porEscolaMin: 3 })
    expect(resolverLimites(LIMITES_PADRAO, linha({ limiteReqUsuarioMin: 7 }))).toEqual({ porUsuarioMin: 7, porEscolaMin: 30_000 })
  })
})

describe('resolverJanela', () => {
  function resolver(parcial: Partial<OperationalSettingsRow> | undefined) {
    const descartados: string[] = []
    const janela = resolverJanela(JANELA_PADRAO, parcial === undefined ? undefined : linha(parcial), (campo) => descartados.push(campo))
    return { janela, descartados }
  }

  it('configuração nula usa o padrão do ambiente: São Paulo, segunda a sexta, 07:00 às 18:00', () => {
    expect(resolver(undefined)).toEqual({ janela: JANELA_PADRAO, descartados: [] })
    expect(resolver({ vagas: { lote: 5 } })).toEqual({ janela: JANELA_PADRAO, descartados: [] })
  })

  it('cada coluna configurada troca só ela: sábado letivo, fuso de Manaus, horário do Postgres', () => {
    expect(resolver({ diasLetivos: [1, 2, 3, 4, 5, 6] }).janela).toEqual({ ...JANELA_PADRAO, diasLetivos: [1, 2, 3, 4, 5, 6] })
    expect(resolver({ fuso: 'America/Manaus' }).janela).toEqual({ ...JANELA_PADRAO, fuso: 'America/Manaus' })
    expect(resolver({ inicio: '13:00:00', fim: '22:30:00' })).toEqual({ janela: { ...JANELA_PADRAO, inicio: '13:00:00', fim: '22:30:00' }, descartados: [] })
    expect(resolver({ fim: '12:00:00' }).janela).toEqual({ ...JANELA_PADRAO, fim: '12:00:00' })
  })

  it('dias letivos vazios são da escola, não nulos: não caem no padrão', () => {
    expect(resolver({ diasLetivos: [] }).janela.diasLetivos).toEqual([])
  })

  it('fuso que o runtime não conhece cai no fuso padrão e avisa, em vez de lançar a cada rodada', () => {
    expect(resolver({ fuso: 'Brasil/Joinville', diasLetivos: [6] })).toEqual({ janela: { ...JANELA_PADRAO, diasLetivos: [6] }, descartados: ['fuso'] })
  })

  it('só o fim configurado, antes do início padrão, não forma horário: vale o par do padrão, com aviso', () => {
    expect(resolver({ fim: '06:00:00' })).toEqual({ janela: JANELA_PADRAO, descartados: ['horario'] })
    expect(resolver({ inicio: '19:00:00' })).toEqual({ janela: JANELA_PADRAO, descartados: ['horario'] })
  })
})

describe('ConfiguracaoOperacional', () => {
  /** Repository falso que lê a escola do contexto, como o de verdade, a partir de linhas por escola. */
  function montar(linhas: Record<string, OperationalSettingsRow>, opcoes: { falhar?: () => boolean } = {}) {
    let agora = 0
    const lidas: string[] = []
    const aoFalhar = vi.fn()
    const repositorio = {
      daEscola: vi.fn(async () => {
        const escolaId = currentContext()?.escolaId ?? ''
        lidas.push(escolaId)
        if (opcoes.falhar?.() === true) throw new Error('Postgres fora')
        return linhas[escolaId]
      }),
    }
    const configuracao = new OperationalSettings(repositorio, (lida) => resolverVagas(VAGAS_PADRAO, lida), { agora: () => agora, aoFalhar })
    return { configuracao, lidas, aoFalhar, avancar: (ms: number) => (agora += ms) }
  }

  it('isolamento: cada escola recebe a própria configuração, e a de A não muda a de B', async () => {
    const { configuracao } = montar({ [ESCOLA_A]: linha({ vagas: { lote: 5 } }) })
    expect(await naEscola(ESCOLA_A, () => configuracao.daEscola())).toEqual({ interativa: 5, normal: 5, lote: 5 })
    expect(await naEscola(ESCOLA_B, () => configuracao.daEscola())).toEqual(VAGAS_PADRAO)
    // Já guardada a de A, a de B continua a dela.
    expect(await naEscola(ESCOLA_B, () => configuracao.daEscola())).toEqual(VAGAS_PADRAO)
  })

  it('sem escola no contexto falha fechado; rotina do sistema usa o padrão sem consultar', async () => {
    const { configuracao, lidas } = montar({})
    await expect(runInContext({ requisicaoId: randomUUID() }, () => configuracao.daEscola())).rejects.toThrow('sem escola no contexto')
    expect(await runInContext({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => configuracao.daEscola())).toEqual(VAGAS_PADRAO)
    expect(lidas).toEqual([])
  })

  it('guarda por VALIDADE_DA_CONFIGURACAO_MS: cem requisições da mesma escola fazem uma leitura', async () => {
    const { configuracao, lidas } = montar({ [ESCOLA_A]: linha({ vagas: { lote: 5 } }) })
    await Promise.all(Array.from({ length: 100 }, () => naEscola(ESCOLA_A, () => configuracao.daEscola())))
    expect(lidas).toEqual([ESCOLA_A])
  })

  it('vencida, devolve a anterior na hora e lê de novo em segundo plano', async () => {
    const linhas = { [ESCOLA_A]: linha({ vagas: { lote: 5 } }) }
    const { configuracao, lidas, avancar } = montar(linhas)
    await naEscola(ESCOLA_A, () => configuracao.daEscola())
    linhas[ESCOLA_A] = linha({ vagas: { lote: 9 } })
    avancar(VALIDADE_DA_CONFIGURACAO_MS)

    expect((await naEscola(ESCOLA_A, () => configuracao.daEscola())).lote).toBe(5)
    await vi.waitFor(() => expect(lidas).toHaveLength(2))
    await vi.waitFor(async () => expect((await naEscola(ESCOLA_A, () => configuracao.daEscola())).lote).toBe(9))
  })

  it('leitura que falha não vira erro: sem anterior vale o padrão, com anterior vale a anterior, e tenta de novo depois', async () => {
    let falhar = true
    const { configuracao, lidas, aoFalhar, avancar } = montar({ [ESCOLA_A]: linha({ vagas: { lote: 5 } }) }, { falhar: () => falhar })

    expect(await naEscola(ESCOLA_A, () => configuracao.daEscola())).toEqual(VAGAS_PADRAO)
    expect(aoFalhar).toHaveBeenCalledOnce()
    // Antes da nova tentativa, nenhuma leitura a mais.
    avancar(NOVA_TENTATIVA_DA_CONFIGURACAO_MS - 1)
    await naEscola(ESCOLA_A, () => configuracao.daEscola())
    expect(lidas).toHaveLength(1)

    falhar = false
    avancar(1)
    await naEscola(ESCOLA_A, () => configuracao.daEscola())
    await vi.waitFor(async () => expect((await naEscola(ESCOLA_A, () => configuracao.daEscola())).lote).toBe(5))

    falhar = true
    avancar(VALIDADE_DA_CONFIGURACAO_MS)
    await naEscola(ESCOLA_A, () => configuracao.daEscola())
    await vi.waitFor(() => expect(aoFalhar).toHaveBeenCalledTimes(2))
    expect((await naEscola(ESCOLA_A, () => configuracao.daEscola())).lote).toBe(5)
  })
})
