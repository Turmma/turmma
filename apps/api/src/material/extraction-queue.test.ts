import { describe, expect, it } from 'vitest'
import { FilaDeExtracao } from './extraction-queue.js'

/** Um trabalho que o teste solta quando quer, e que anota quando começou e com que sinal. */
function trabalhoControlado(nome: string, ordem: string[]) {
  let soltar: () => void = () => undefined
  const solto = new Promise<void>((resolver) => {
    soltar = resolver
  })
  const estado = { comecou: false, abortadoAoComecar: false, abortadoDepois: false, soltar }
  const trabalho = async (sinal: AbortSignal): Promise<void> => {
    estado.comecou = true
    estado.abortadoAoComecar = sinal.aborted
    ordem.push(nome)
    if (sinal.aborted) return
    await Promise.race([
      solto,
      new Promise<void>((resolver) =>
        sinal.addEventListener('abort', () => {
          estado.abortadoDepois = true
          resolver()
        }),
      ),
    ])
  }
  return { estado, trabalho }
}

const voltas = async (quantas = 3): Promise<void> => {
  for (let volta = 0; volta < quantas; volta += 1) await new Promise((resolver) => setImmediate(resolver))
}

describe('fila de extração no processo', () => {
  it('uma escola que sobe vários arquivos não trava as outras: uma extração por escola, e a de trás passa', async () => {
    const fila = new FilaDeExtracao({ aoMesmoTempo: 2, porEscola: 1 })
    const ordem: string[] = []
    const a1 = trabalhoControlado('a1', ordem)
    const a2 = trabalhoControlado('a2', ordem)
    const a3 = trabalhoControlado('a3', ordem)
    const b1 = trabalhoControlado('b1', ordem)
    fila.agendar('escola-a', a1.trabalho)
    fila.agendar('escola-a', a2.trabalho)
    fila.agendar('escola-a', a3.trabalho)
    fila.agendar('escola-b', b1.trabalho)
    await voltas()

    // A escola A tem três na fila, na frente da B, e há duas vagas: a segunda vaga é da B, e não do segundo da A.
    expect(ordem).toEqual(['a1', 'b1'])
    expect(a2.estado.comecou).toBe(false)
    expect(fila.esperando).toBe(2)

    b1.estado.soltar()
    await voltas()
    // A vaga que a B liberou não vai para a A, que ainda está lendo o primeiro.
    expect(ordem).toEqual(['a1', 'b1'])

    a1.estado.soltar()
    await voltas()
    expect(ordem).toEqual(['a1', 'b1', 'a2'])
    a2.estado.soltar()
    await voltas()
    a3.estado.soltar()
    await fila.ociosa()
    expect(ordem).toEqual(['a1', 'b1', 'a2', 'a3'])
  })

  it('o teto no total vale entre escolas diferentes', async () => {
    const fila = new FilaDeExtracao({ aoMesmoTempo: 2, porEscola: 1 })
    const ordem: string[] = []
    const trabalhos = ['a', 'b', 'c'].map((escola) => trabalhoControlado(escola, ordem))
    for (const [indice, { trabalho }] of trabalhos.entries()) fila.agendar(`escola-${String(indice)}`, trabalho)
    await voltas()
    expect(ordem).toEqual(['a', 'b'])
    trabalhos[0]?.estado.soltar()
    await voltas()
    expect(ordem).toEqual(['a', 'b', 'c'])
    for (const { estado } of trabalhos) estado.soltar()
    await fila.ociosa()
  })

  it('passou do prazo, o sinal aborta a extração, e a vaga volta para a fila', async () => {
    const fila = new FilaDeExtracao({ aoMesmoTempo: 1, porEscola: 1, prazoMs: 20 })
    const ordem: string[] = []
    const lento = trabalhoControlado('lento', ordem)
    const seguinte = trabalhoControlado('seguinte', ordem)
    fila.agendar('escola-a', lento.trabalho)
    fila.agendar('escola-b', seguinte.trabalho)
    await new Promise((resolver) => setTimeout(resolver, 80))

    expect(lento.estado.abortadoDepois).toBe(true)
    expect(ordem).toEqual(['lento', 'seguinte'])
    await fila.ociosa()
    expect(seguinte.estado.abortadoDepois).toBe(true)
  })

  it('o trabalho que rejeita não derruba a fila nem segura a vaga', async () => {
    const fila = new FilaDeExtracao({ aoMesmoTempo: 1, porEscola: 1 })
    const ordem: string[] = []
    const depois = trabalhoControlado('depois', ordem)
    fila.agendar('escola-a', () => Promise.reject(new Error('defeito')))
    fila.agendar('escola-a', depois.trabalho)
    await voltas(6)
    expect(ordem).toEqual(['depois'])
    depois.estado.soltar()
    await fila.ociosa()
  })

  it('no desligamento, o que roda é abortado e o que espera é chamado já abortado: todos gravam a própria falha', async () => {
    const fila = new FilaDeExtracao({ aoMesmoTempo: 1, porEscola: 1 })
    const ordem: string[] = []
    const rodando = trabalhoControlado('rodando', ordem)
    const esperando = trabalhoControlado('esperando', ordem)
    fila.agendar('escola-a', rodando.trabalho)
    fila.agendar('escola-a', esperando.trabalho)
    await voltas()
    expect(esperando.estado.comecou).toBe(false)

    await fila.encerrar()

    expect(rodando.estado.abortadoDepois).toBe(true)
    expect(esperando.estado).toMatchObject({ comecou: true, abortadoAoComecar: true })
    expect(fila.esperando).toBe(0)

    // Depois de encerrada, o que chega também não lê nada.
    const atrasado = trabalhoControlado('atrasado', ordem)
    fila.agendar('escola-b', atrasado.trabalho)
    await fila.ociosa()
    expect(atrasado.estado).toMatchObject({ comecou: true, abortadoAoComecar: true })
  })
})
