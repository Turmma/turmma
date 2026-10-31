import { describe, expect, it } from 'vitest'
import { esperarORedisNaPrimeiraVez, type MontadoQueEspera } from './queue.fixture.js'

/**
 * O contrato do conserto da correção `2026-09-16-rodada-antes-do-redis-do-despachante`: a bancada não
 * deixa nenhuma porta que lê o Redis sair antes de o cliente do despachante estar de pé. A corrida que
 * causou o defeito não é determinística; este contrato é, e é ele que impede a volta.
 */
describe('a bancada segura a primeira leitura de Redis do despachante até o `pronto`', () => {
  function montadoDeMentira(pronto: Promise<void>): { montado: MontadoQueEspera; chamadas: string[] } {
    const chamadas: string[] = []
    const anotar = (nome: string) => {
      chamadas.push(nome)
      return Promise.resolve()
    }
    return {
      chamadas,
      montado: {
        pronto,
        despachante: {
          rodada: async () => {
            await anotar('rodada')
            return 1
          },
        },
        reconciliacao: { reconciliar: () => anotar('reconciliar') },
        medicao: { medir: () => anotar('medir') },
      },
    }
  }

  it('rodada, reconciliar e medir só alcançam o despachante depois de o `pronto` resolver', async () => {
    let dePe!: () => void
    const { montado, chamadas } = montadoDeMentira(new Promise<void>((resolver) => (dePe = resolver)))
    esperarORedisNaPrimeiraVez(montado)

    const emCurso = Promise.all([montado.despachante.rodada(), montado.reconciliacao.reconciliar(), montado.medicao?.medir()])
    // Várias voltas do laço de eventos: sem o `pronto`, nada passa, por mais que se espere.
    for (let volta = 0; volta < 10; volta++) await Promise.resolve()
    expect(chamadas).toEqual([])

    dePe()
    await emCurso
    expect([...chamadas].sort()).toEqual(['medir', 'reconciliar', 'rodada'])
  })

  it('a rodada devolve o que o despachante devolveu, e não o da espera', async () => {
    const { montado } = montadoDeMentira(Promise.resolve())
    esperarORedisNaPrimeiraVez(montado)

    expect(await montado.despachante.rodada()).toBe(1)
  })

  it('borda: com o Redis já de pé, a chamada seguinte não espera de novo', async () => {
    let esperas = 0
    // Contar `then` é o jeito de ver a espera: um `await` a mais é exatamente o que não pode sobrar.
    const pronto = {
      then: (resolver: () => void) => {
        esperas++
        resolver()
      },
    } as unknown as Promise<void>
    const { montado } = montadoDeMentira(pronto)
    esperarORedisNaPrimeiraVez(montado)

    await montado.despachante.rodada()
    await montado.reconciliacao.reconciliar()
    await montado.medicao?.medir()

    expect(esperas).toBe(1)
  })

  it('borda: montagem sem medição (o despachante sem medidor) embrulha o resto sem quebrar', async () => {
    const { montado, chamadas } = montadoDeMentira(Promise.resolve())
    delete montado.medicao
    esperarORedisNaPrimeiraVez(montado)

    await montado.despachante.rodada()
    expect(chamadas).toEqual(['rodada'])
  })
})
