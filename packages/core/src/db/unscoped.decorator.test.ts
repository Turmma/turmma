import { describe, expect, it } from 'vitest'
import { OperationalSettingsRepository } from '../settings/operational-settings.repository.js'
import { DispatchRepository } from '../queue/dispatch.repository.js'
import { JobOutboxRepository } from '../queue/job-outbox.repository.js'
import { ExpurgoDeAcessoRepository } from '../retencao/expurgo-de-acesso.repository.js'
import { ExpurgoDeJobsRepository } from '../retencao/expurgo-de-jobs.repository.js'
import { UsageMeter } from '../usage/usage-meter.js'
import { UsageRepository } from '../usage/usage.repository.js'
import { unscopedJustification, Unscoped } from './unscoped.decorator.js'

function metodosDe(classe: { prototype: object }): string[] {
  return Object.getOwnPropertyNames(classe.prototype).filter((nome) => nome !== 'constructor')
}

describe('@SemEscopo', () => {
  it('recusa marcação sem justificativa escrita', () => {
    expect(() => Unscoped('')).toThrow('@SemEscopo exige justificativa escrita')
    expect(() => Unscoped('rotina')).toThrow('@SemEscopo exige justificativa escrita')
  })

  it('só as consultas da fila inteira do despachante saem sem escopo, e cada uma diz por quê', () => {
    const semEscopo = metodosDe(DispatchRepository).filter((metodo) => unscopedJustification(DispatchRepository, metodo) !== undefined)
    expect(semEscopo.sort()).toEqual(['listarEscolasComPendentes', 'listarParaReconciliar', 'medirFalhos', 'medirPendentes', 'registrarFalhaDaFila', 'reservarParaRepublicar'])
    for (const metodo of semEscopo) expect(unscopedJustification(DispatchRepository, metodo), metodo).toMatch(/despachante/)
    // A medição é só leitura para a observabilidade: diz que nada dela chega a resposta de escola.
    expect(unscopedJustification(DispatchRepository, 'medirPendentes')).toMatch(/observabilidade local/)
    expect(unscopedJustification(DispatchRepository, 'medirFalhos')).toMatch(/observabilidade local/)
    // Reservar, devolver, listar e marcar publicados são da escola do contexto: a vaga e a configuração lidas junto são dela.
    for (const metodo of ['reservarDaEscola', 'devolverParaAguardando', 'publicadosEntre', 'marcarPublicados']) expect(unscopedJustification(DispatchRepository, metodo), metodo).toBeUndefined()
    // Os repositories que atendem a API e o worker não têm exceção nenhuma.
    for (const classe of [JobOutboxRepository, OperationalSettingsRepository]) {
      for (const metodo of metodosDe(classe)) expect(unscopedJustification(classe, metodo), metodo).toBeUndefined()
    }
  })

  it('uso e retenção: só a descoberta das escolas com uso e os lotes dos expurgos (jobs e acesso) saem sem escopo; gravar e consultar uso é sempre na escola do contexto', () => {
    const marcados = (classe: { prototype: object }) =>
      metodosDe(classe)
        .filter((metodo) => unscopedJustification(classe as abstract new (...argumentos: never[]) => unknown, metodo) !== undefined)
        .sort()
    expect(marcados(UsageMeter)).toEqual(['lerDiasFechados'])
    expect(marcados(ExpurgoDeJobsRepository)).toEqual(['apagarLoteVencido'])
    expect(marcados(ExpurgoDeAcessoRepository)).toEqual(['apagarLoteVencido', 'limparLoteDeContasSemUso'])
    for (const metodo of ['apagarLoteVencido', 'limparLoteDeContasSemUso']) expect(unscopedJustification(ExpurgoDeAcessoRepository, metodo), metodo).toMatch(/expurgo/)
    expect(marcados(UsageRepository)).toEqual([])
    expect(unscopedJustification(UsageMeter, 'lerDiasFechados')).toMatch(/consolidação/)
    expect(unscopedJustification(ExpurgoDeJobsRepository, 'apagarLoteVencido')).toMatch(/expurgo/)
  })
})
