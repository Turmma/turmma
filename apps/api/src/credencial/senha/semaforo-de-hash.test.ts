import { ErroDeDominio, METRICAS } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MedidorDeTeste } from '../../../../../tools/testes/metricas.ts'
import { baldeDaEquipe, baldeDaEscola, baldeDaEscolaDesconhecida, type BaldeDeLogin } from './baldes-de-login.js'
import { ESPERA_MAXIMA_PELO_HASH_MS, INTERVALO_PARA_ESQUECER_MS, MAXIMO_ESPERANDO, RETRY_AFTER_MAXIMO_S, RETRY_AFTER_MINIMO_S, SemaforoDeHash, SemaforoSemProtecao } from './semaforo-de-hash.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0190f5a0-0000-7000-8000-00000000000b'
const ESCOLA_C = '0190f5a0-0000-7000-8000-00000000000c'
const IP_DA_ESCOLA = '203.0.113.10'
const IP_DE_FORA = '198.51.100.20'

/** Uma tarefa que só termina quando o teste manda: segura a vez no semáforo pelo tempo que o teste quiser. */
function tarefaSegura(): { tarefa: () => Promise<void>; soltar: () => void } {
  let soltar: () => void = () => undefined
  const liberada = new Promise<void>((resolver) => (soltar = resolver))
  return { tarefa: () => liberada, soltar }
}

/** Deixa rodar tudo que já está na fila de microtarefas e de I/O: as vezes que o semáforo passou adiante. */
async function escoar(): Promise<void> {
  for (let volta = 0; volta < 5; volta++) await new Promise((resolver) => setImmediate(resolver))
}

let medidor: MedidorDeTeste

beforeEach(() => {
  medidor = new MedidorDeTeste()
})

afterEach(async () => {
  vi.useRealTimers()
  await medidor.encerrar()
})

describe('SemaforoDeHash: rodízio entre escolas e, na equipe, entre IPs', () => {
  it('uma escola não degrada outra: com 3.000 pedidos da A na fila, o primeiro pedido da B é o próximo atendido depois do que está em andamento', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const daA = Array.from({ length: 3_000 }, (_, posicao) =>
      semaforo.executar(baldeDaEscola(ESCOLA_A), () => {
        atendidos.push(`A${String(posicao)}`)
        return Promise.resolve()
      }),
    )
    const daB = semaforo.executar(baldeDaEscola(ESCOLA_B), () => {
      atendidos.push('B')
      return Promise.resolve()
    })
    expect(semaforo.esperando).toBe(3_001)
    expect(atendidos).toEqual([])

    emAndamento.soltar()
    await Promise.all([primeiro, daB, ...daA])
    // A vez que abriu foi para o balde seguinte na roda, a B, e não para o pedido mais antigo, que era da A.
    expect(atendidos[0]).toBe('B')
    // E a A foi atendida inteira, na ordem de chegada dela: o rodízio atrasa a A em um pedido, não a descarta.
    expect(atendidos.slice(1)).toEqual(Array.from({ length: 3_000 }, (_, posicao) => `A${String(posicao)}`))
    expect(semaforo.emUso).toBe(0)
    expect(semaforo.esperando).toBe(0)
  })

  it('ataque de um IP não toma o balde da equipe: 100 pedidos de um IP e 1 de outro, e o de outro IP é o próximo atendido depois do que está em andamento, antes dos outros 99', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEquipe(IP_DA_ESCOLA), emAndamento.tarefa)
    atendidos.push(IP_DA_ESCOLA)
    const doMesmoIp = Array.from({ length: 99 }, () =>
      semaforo.executar(baldeDaEquipe(IP_DA_ESCOLA), () => {
        atendidos.push(IP_DA_ESCOLA)
        return Promise.resolve()
      }),
    )
    const deOutroIp = semaforo.executar(baldeDaEquipe(IP_DE_FORA), () => {
      atendidos.push(IP_DE_FORA)
      return Promise.resolve()
    })

    emAndamento.soltar()
    await Promise.all([primeiro, deOutroIp, ...doMesmoIp])
    expect(atendidos).toHaveLength(101)
    // A roda passa pela subfila de cada IP: o primeiro IP já teve a vez (o pedido em andamento), e a próxima é do outro.
    expect(atendidos.indexOf(IP_DE_FORA)).toBe(1)
    expect(atendidos.slice(2).every((ip) => ip === IP_DA_ESCOLA)).toBe(true)
    expect(atendidos.slice(2)).toHaveLength(99)
  })

  it('baldes de escola não têm subfila por IP, e o endereço que não existe tem um balde só, na mesma roda', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const emAndamento = tarefaSegura()
    const pedido = (balde: BaldeDeLogin, nome: string) =>
      semaforo.executar(balde, () => {
        atendidos.push(nome)
        return Promise.resolve()
      })
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const pedidos = [pedido(baldeDaEscolaDesconhecida(), 'desconhecida-1'), pedido(baldeDaEscolaDesconhecida(), 'desconhecida-2'), pedido(baldeDaEscola(ESCOLA_A), 'A'), pedido(baldeDaEquipe(IP_DA_ESCOLA), 'equipe')]
    emAndamento.soltar()
    await Promise.all([primeiro, ...pedidos])
    // A, com o pedido em andamento, é a última da roda; desconhecida e equipe, nunca atendidas, vão na ordem de chegada.
    expect(atendidos).toEqual(['desconhecida-1', 'equipe', 'A', 'desconhecida-2'])
  })

  it('ataque de muitos IPs ao balde da equipe: o IP que chega novo a cada pedido entra atrás de quem já esperava, e não na frente', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const emAndamento = tarefaSegura()
    const pedido = (ip: string) =>
      semaforo.executar(baldeDaEquipe(ip), () => {
        atendidos.push(ip)
        return Promise.resolve()
      })
    // A professora já entrou uma vez hoje (a vez dela ficou para trás na roda), e agora outro IP está com o hash.
    await pedido(IP_DA_ESCOLA)
    atendidos.length = 0
    const primeiro = semaforo.executar(baldeDaEquipe('192.0.2.1'), emAndamento.tarefa)
    const daProfessora = pedido(IP_DA_ESCOLA)
    // Cinquenta IPs novos chegando depois dela, cada um com um pedido: nenhum passa na frente. Se o IP nunca visto
    // entrasse na roda como o mais antigo de todos, os cinquenta passariam na frente de quem já tinha sido atendido.
    const doAtaque = Array.from({ length: 50 }, (_, posicao) => pedido(`198.18.0.${String(posicao + 1)}`))
    emAndamento.soltar()
    await Promise.all([primeiro, daProfessora, ...doAtaque])
    expect(atendidos[0]).toBe(IP_DA_ESCOLA)
    expect(atendidos).toHaveLength(51)
  })
})

describe('SemaforoDeHash: rebaixamento (15.0), fim do balde e nunca recusa', () => {
  /** Um pedido que anota o nome quando recebe a vez. */
  function pedidoQueAnota(semaforo: SemaforoDeHash, atendidos: string[]) {
    return (balde: BaldeDeLogin, nome: string) =>
      semaforo.executar(balde, () => {
        atendidos.push(nome)
        return Promise.resolve()
      })
  }

  it('na escola: o pedido rebaixado vai para o fim do balde, e o normal que chegou depois dele é atendido antes', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const pedido = pedidoQueAnota(semaforo, atendidos)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const pedidos = [pedido(baldeDaEscola(ESCOLA_A, true), 'rebaixado-1'), pedido(baldeDaEscola(ESCOLA_A, true), 'rebaixado-2'), pedido(baldeDaEscola(ESCOLA_A), 'normal')]
    emAndamento.soltar()
    await Promise.all([primeiro, ...pedidos])
    // Os rebaixados não foram recusados: foram atendidos, na ordem deles, depois do normal.
    expect(atendidos).toEqual(['normal', 'rebaixado-1', 'rebaixado-2'])
  })

  it('isolamento: o rebaixamento na A não tira vez da B; a roda entre baldes segue igual, e a A rebaixada ainda anda quando é a vez dela', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const pedido = pedidoQueAnota(semaforo, atendidos)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const pedidos = [
      pedido(baldeDaEscola(ESCOLA_A, true), 'A-rebaixado-1'),
      pedido(baldeDaEscola(ESCOLA_A, true), 'A-rebaixado-2'),
      pedido(baldeDaEscola(ESCOLA_A, true), 'A-rebaixado-3'),
      pedido(baldeDaEscola(ESCOLA_B), 'B-1'),
      pedido(baldeDaEscola(ESCOLA_B), 'B-2'),
    ]
    emAndamento.soltar()
    await Promise.all([primeiro, ...pedidos])
    expect(atendidos).toEqual(['B-1', 'A-rebaixado-1', 'B-2', 'A-rebaixado-2', 'A-rebaixado-3'])
  })

  it('na equipe: do mesmo IP, quem traz o cookie de dispositivo (não rebaixado) é atendido antes das tentativas rebaixadas desse IP', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const pedido = pedidoQueAnota(semaforo, atendidos)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEquipe(IP_DE_FORA), emAndamento.tarefa)
    const pedidos = [
      pedido(baldeDaEquipe(IP_DA_ESCOLA, true), 'script-1'),
      pedido(baldeDaEquipe(IP_DA_ESCOLA, true), 'script-2'),
      pedido(baldeDaEquipe(IP_DA_ESCOLA), 'professora-com-cookie'),
    ]
    emAndamento.soltar()
    await Promise.all([primeiro, ...pedidos])
    expect(atendidos).toEqual(['professora-com-cookie', 'script-1', 'script-2'])
  })

  it('o pedido rebaixado com o semáforo livre entra na hora: rebaixar é ir para o fim da fila, não esperar sem fila', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    await expect(semaforo.executar(baldeDaEscola(ESCOLA_A, true), () => Promise.resolve('entrou'))).resolves.toBe('entrou')
    await expect(semaforo.executar(baldeDaEquipe(IP_DA_ESCOLA, true), () => Promise.resolve('entrou'))).resolves.toBe('entrou')
  })

  it('o rebaixado que desiste pelo prazo sai da fila rebaixada, e a vez seguinte vai a quem ainda espera', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const atendidos: string[] = []
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const desistente = semaforo.executar(baldeDaEscola(ESCOLA_A, true), () => Promise.resolve()).catch((erro: unknown) => erro)
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    expect(await desistente).toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    expect(semaforo.esperando).toBe(0)
    const depois = pedidoQueAnota(semaforo, atendidos)(baldeDaEscola(ESCOLA_A, true), 'rebaixado-que-chegou-depois')
    emAndamento.soltar()
    await Promise.all([primeiro, depois])
    expect(atendidos).toEqual(['rebaixado-que-chegou-depois'])
  })
})

describe('SemaforoDeHash: IP em memória com prazo (15.6)', () => {
  it('a roda esquece, a cada minuto, o IP de quem não está esperando, e guarda o de quem espera', async () => {
    let agora = 0
    const semaforo = new SemaforoDeHash(1, medidor.medidor, ESPERA_MAXIMA_PELO_HASH_MS, () => agora)
    for (let posicao = 1; posicao <= 20; posicao++) await semaforo.executar(baldeDaEquipe(`198.18.1.${String(posicao)}`), () => Promise.resolve())
    // O balde da equipe e os vinte IPs.
    expect(semaforo.naRoda).toBe(21)

    agora += INTERVALO_PARA_ESQUECER_MS - 1
    await semaforo.executar(baldeDaEquipe('198.18.2.1'), () => Promise.resolve())
    expect(semaforo.naRoda).toBe(22)

    // Passado o intervalo, a próxima vez concedida esquece quem não espera: sobra só quem está com a vez ou na fila.
    agora += 1
    const emAndamento = tarefaSegura()
    const comAVez = semaforo.executar(baldeDaEquipe('198.18.3.1'), emAndamento.tarefa)
    const naFila = semaforo.executar(baldeDaEquipe('198.18.3.2'), () => Promise.resolve())
    // Os vinte IPs de antes, vistos há um intervalo, foram esquecidos. Ficam o balde da equipe e o IP de 59,999 s (vistos
    // agora há pouco), o IP com a vez e o IP na fila.
    expect(semaforo.naRoda).toBe(4)
    emAndamento.soltar()
    await Promise.all([comAVez, naFila])
    // A fila andou, e o que foi esquecido volta à roda como novo, sem erro.
    await semaforo.executar(baldeDaEquipe('198.18.1.1'), () => Promise.resolve())
    expect(semaforo.esperando).toBe(0)
  })
})

describe('SemaforoDeHash: teto de concorrência', () => {
  it('nunca roda mais tarefas que o teto ao mesmo tempo, e as que esperam entram conforme as de antes terminam', async () => {
    const semaforo = new SemaforoDeHash(3, medidor.medidor)
    let rodando = 0
    let maximo = 0
    const seguras = Array.from({ length: 10 }, () => tarefaSegura())
    const execucoes = seguras.map((segura, posicao) =>
      semaforo.executar(baldeDaEscola(posicao % 2 === 0 ? ESCOLA_A : ESCOLA_B), async () => {
        rodando++
        maximo = Math.max(maximo, rodando)
        await segura.tarefa()
        rodando--
      }),
    )
    await escoar()
    expect([rodando, semaforo.emUso, semaforo.esperando]).toEqual([3, 3, 7])
    for (const segura of seguras) {
      segura.soltar()
      await escoar()
      expect(rodando).toBeLessThanOrEqual(3)
    }
    await Promise.all(execucoes)
    expect(maximo).toBe(3)
    expect([semaforo.emUso, semaforo.esperando]).toEqual([0, 0])
  })

  it('a tarefa que falha devolve a vez: o erro dela sobe, e o pedido seguinte entra', async () => {
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const falha = new Error('argon2 quebrou')
    await expect(semaforo.executar(baldeDaEscola(ESCOLA_A), () => Promise.reject(falha))).rejects.toBe(falha)
    expect(semaforo.emUso).toBe(0)
    await expect(semaforo.executar(baldeDaEscola(ESCOLA_A), () => Promise.resolve('entrou'))).resolves.toBe('entrou')
  })

  it('concorrência que não é inteiro positivo não constrói o semáforo', () => {
    for (const concorrencia of [0, -1, 1.5, Number.NaN]) expect(() => new SemaforoDeHash(concorrencia, medidor.medidor), String(concorrencia)).toThrow(RangeError)
  })
})

describe('SemaforoDeHash: prazo de 2 s', () => {
  it('borda: quem espera mais de 2 s sai com 503 INDISPONIVEL_TENTE_DE_NOVO e Retry-After entre 2 e 6, sem a tarefa rodar; e sai da fila', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const tarefa = vi.fn(() => Promise.resolve())
    let resultado: unknown = 'esperando'
    const segundo = semaforo.executar(baldeDaEscola(ESCOLA_B), tarefa).then(
      () => (resultado = 'entrou'),
      (erro: unknown) => (resultado = erro),
    )

    // Relógio simulado: um milissegundo antes do prazo ainda espera; no prazo, sai.
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS - 1)
    expect(resultado).toBe('esperando')
    await vi.advanceTimersByTimeAsync(1)
    await segundo
    expect(resultado).toBeInstanceOf(ErroDeDominio)
    const erro = resultado as ErroDeDominio
    expect([erro.codigo, erro.status]).toEqual([ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, 503])
    expect(erro.tenteDeNovoEmSegundos).toBeGreaterThanOrEqual(RETRY_AFTER_MINIMO_S)
    expect(erro.tenteDeNovoEmSegundos).toBeLessThanOrEqual(RETRY_AFTER_MAXIMO_S)
    expect(tarefa).not.toHaveBeenCalled()
    expect(semaforo.esperando).toBe(0)
    expect(await medidor.pontos(METRICAS.hashRecusado)).toEqual([{ atributos: {}, valor: 1 }])

    // A vez que abre depois não vai para quem já desistiu: fica livre.
    emAndamento.soltar()
    await primeiro
    expect(semaforo.emUso).toBe(0)
    expect(tarefa).not.toHaveBeenCalled()
  })

  it('o Retry-After é sorteado entre 2 e 6 s, inteiro, e varia: a rajada que volta não volta toda no mesmo segundo', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const recusas = Array.from({ length: 200 }, () =>
      semaforo.executar(baldeDaEscola(ESCOLA_A), () => Promise.resolve()).then(
        () => undefined,
        (erro: unknown) => (erro as ErroDeDominio).tenteDeNovoEmSegundos,
      ),
    )
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    const esperas = await Promise.all(recusas)
    expect(esperas.every((segundos) => Number.isInteger(segundos) && segundos !== undefined && segundos >= RETRY_AFTER_MINIMO_S && segundos <= RETRY_AFTER_MAXIMO_S)).toBe(true)
    expect(new Set(esperas).size).toBeGreaterThan(1)
    emAndamento.soltar()
    await primeiro
  })

  it('carga (15.0): com a fila cheia, o pedido não rebaixado toma o lugar do rebaixado mais antigo da fila com mais rebaixados, que sai com o 503; o rebaixado que chega com a fila cheia sai ele mesmo', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const desfechos: string[] = []
    const anotar = (nome: string) => [() => desfechos.push(`entrou-${nome}`), () => desfechos.push(`503-${nome}`)] as const
    // A escola C tem um aluno legítimo rebaixado, que chegou antes de todos; a A, o ataque que enche a fila.
    const daC = semaforo.executar(baldeDaEscola(ESCOLA_C, true), () => Promise.resolve()).then(...anotar('C'))
    const rebaixados = Array.from({ length: MAXIMO_ESPERANDO - 1 }, (_, posicao) =>
      semaforo.executar(baldeDaEscola(ESCOLA_A, true), () => Promise.resolve()).then(...anotar(`A${String(posicao)}`)),
    )
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)

    const tarefaDaB = vi.fn(() => Promise.resolve())
    const daB = semaforo.executar(baldeDaEscola(ESCOLA_B), tarefaDaB)
    await vi.advanceTimersByTimeAsync(0)
    // Saiu com o 503 o rebaixado mais antigo da fila com mais rebaixados (a A), e não o da C, que era o mais antigo de
    // todos: o ataque da A não despeja o aluno da escola vizinha. A fila não cresceu.
    expect(desfechos).toEqual(['503-A0'])
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)

    const rebaixadoNovo = vi.fn(() => Promise.resolve())
    await expect(semaforo.executar(baldeDaEscola(ESCOLA_A, true), rebaixadoNovo)).rejects.toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, status: 503 })
    expect(rebaixadoNovo).not.toHaveBeenCalled()
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)

    // A vez que abre vai à B, que não foi rebaixada; na roda, a seguinte vai à C, que continuava esperando.
    emAndamento.soltar()
    await primeiro
    await daB
    expect(tarefaDaB).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(0)
    expect(desfechos).toContain('entrou-C')
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    await Promise.all([daC, ...rebaixados])
  })

  it('carga (16.5): com a fila cheia de rebaixados da equipe espalhados por muitos IPs, o professor com cookie que chega fica, e sai o rebaixado mais antigo do ataque; nem o professor atrás do NAT, com a maior subfila, nem o aluno da escola vizinha', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const despejados: string[] = []
    const esperar = (balde: BaldeDeLogin, nome: string) =>
      semaforo.executar(balde, () => Promise.resolve()).catch(() => {
        despejados.push(nome)
      })
    // A escola C tem dois alunos de verdade rebaixados (o NAT dela passou do limite), que chegaram antes de todos.
    const daC = [esperar(baldeDaEscola(ESCOLA_C, true), 'C-1'), esperar(baldeDaEscola(ESCOLA_C, true), 'C-2')]
    // O ataque à equipe, um IP por tentativa: cada subfila tem um só.
    const PROFESSORES_NO_NAT = 3
    const ataque = Array.from({ length: MAXIMO_ESPERANDO - daC.length - PROFESSORES_NO_NAT }, (_, posicao) =>
      esperar(baldeDaEquipe(`10.${String(posicao >> 16)}.${String((posicao >> 8) & 255)}.${String(posicao & 255)}`, true), `ataque-${String(posicao)}`),
    )
    // Três professores atrás do NAT da escola, sem cookie e rebaixados pelo limite do IP: a maior subfila da fila.
    const doNat = Array.from({ length: PROFESSORES_NO_NAT }, (_, posicao) => esperar(baldeDaEquipe(IP_DA_ESCOLA, true), `professor-no-nat-${String(posicao)}`))
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)

    // Chegam, com a fila cheia, um professor com o cookie de dispositivo (não rebaixado) e um aluno normal da B.
    const daProfessora = esperar(baldeDaEquipe(IP_DE_FORA), 'professor-com-cookie')
    const daB = esperar(baldeDaEscola(ESCOLA_B), 'B')
    await vi.advanceTimersByTimeAsync(0)
    // Saíram os dois rebaixados mais antigos do balde com mais rebaixados (a equipe), na ordem de chegada: o ataque. Os
    // dois que chegaram ficaram na fila, esperando a vez, e a fila não cresceu.
    expect(despejados).toEqual(['ataque-0', 'ataque-1'])
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)

    // Fim do teste: o prazo tira todos da fila (sem servir 10.000 pedidos um a um).
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    await Promise.all([...daC, ...ataque, ...doNat, daProfessora, daB])
    expect(semaforo.esperando).toBe(0)
    emAndamento.soltar()
    await primeiro
  })

  it('carga (16.5): o índice dos rebaixados anda com a fila; quem saiu pela vez ou pelo prazo não é despejado de novo, e sem rebaixado esperando o pedido novo sai ele mesmo', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    // Um rebaixado da A espera e é atendido pela vez: saiu da fila, e do índice.
    const antes = tarefaSegura()
    const vezAntes = semaforo.executar(baldeDaEscola(ESCOLA_A), antes.tarefa)
    const atendido = semaforo.executar(baldeDaEscola(ESCOLA_A, true), () => Promise.resolve('atendido'))
    antes.soltar()
    await vezAntes
    await expect(atendido).resolves.toBe('atendido')
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    // Outro rebaixado da A desiste pelo prazo antes de a fila encher: também não pode voltar a ser escolhido para o despejo.
    const desistente = semaforo.executar(baldeDaEscola(ESCOLA_A, true), () => Promise.resolve()).catch((erro: unknown) => erro)
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    expect(await desistente).toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    const normais = Array.from({ length: MAXIMO_ESPERANDO }, () => semaforo.executar(baldeDaEscola(ESCOLA_A), () => Promise.resolve()).catch(() => undefined))
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)
    const tarefa = vi.fn(() => Promise.resolve())
    await expect(semaforo.executar(baldeDaEscola(ESCOLA_B), tarefa)).rejects.toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
    expect(tarefa).not.toHaveBeenCalled()
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    await Promise.all(normais)
    emAndamento.soltar()
    await primeiro
  })

  it('carga: acima de 10.000 esperando, o pedido novo sai na hora com o mesmo 503, e a fila não cresce', async () => {
    vi.useFakeTimers()
    const semaforo = new SemaforoDeHash(1, medidor.medidor)
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const esperando = Array.from({ length: MAXIMO_ESPERANDO }, () => semaforo.executar(baldeDaEscola(ESCOLA_A), () => Promise.resolve()).catch(() => undefined))
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)
    const tarefa = vi.fn(() => Promise.resolve())
    const excedente = semaforo.executar(baldeDaEscola(ESCOLA_B), tarefa)
    await expect(excedente).rejects.toMatchObject({ codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, status: 503 })
    expect(tarefa).not.toHaveBeenCalled()
    expect(semaforo.esperando).toBe(MAXIMO_ESPERANDO)
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_PELO_HASH_MS)
    await Promise.all(esperando)
    emAndamento.soltar()
    await primeiro
  })
})

describe('SemaforoSemProtecao: o controle negativo do cenário de carga (16.0)', () => {
  it('sem baldes, sem subfila e sem rebaixamento: com 3.000 pedidos da A na fila, a B espera atrás de todos, e o rebaixado passa na frente de quem chegou depois', async () => {
    const semaforo = new SemaforoSemProtecao(1, medidor.medidor)
    const atendidos: string[] = []
    const emAndamento = tarefaSegura()
    const primeiro = semaforo.executar(baldeDaEscola(ESCOLA_A), emAndamento.tarefa)
    const anotar = (nome: string) => () => {
      atendidos.push(nome)
      return Promise.resolve()
    }
    const rebaixado = semaforo.executar(baldeDaEscola(ESCOLA_A, true), anotar('A-rebaixado'))
    const daA = Array.from({ length: 3_000 }, (_, posicao) => semaforo.executar(baldeDaEscola(ESCOLA_A), anotar(`A${String(posicao)}`)))
    const daB = semaforo.executar(baldeDaEscola(ESCOLA_B), anotar('B'))
    emAndamento.soltar()
    await Promise.all([primeiro, rebaixado, daB, ...daA])
    // Com a proteção, a B seria a primeira e o rebaixado o último: aqui é tudo por ordem de chegada.
    expect(atendidos[0]).toBe('A-rebaixado')
    expect(atendidos.at(-1)).toBe('B')
    expect(atendidos).toHaveLength(3_002)
  })

  it('a espera continua medida com o rótulo do balde de verdade, nunca o do balde único', async () => {
    const semaforo = new SemaforoSemProtecao(1, medidor.medidor)
    await semaforo.executar(baldeDaEscola(ESCOLA_B), () => Promise.resolve())
    const rotulos = (await medidor.pontos(METRICAS.esperaPeloHash)).map((ponto) => ponto.atributos['escola_id'])
    expect(rotulos).toEqual([ESCOLA_B])
  })
})

describe('SemaforoDeHash: métricas', () => {
  it('login.hash_espera leva só o rótulo do balde (a escola, `equipe` ou `desconhecida`), nunca o IP; login.hash_recusado nasce em 0', async () => {
    const semaforo = new SemaforoDeHash(2, medidor.medidor)
    expect(await medidor.pontos(METRICAS.hashRecusado)).toEqual([{ atributos: {}, valor: 0 }])
    for (const balde of [baldeDaEscola(ESCOLA_A), baldeDaEscola(ESCOLA_B), baldeDaEquipe(IP_DA_ESCOLA), baldeDaEquipe(IP_DE_FORA), baldeDaEscolaDesconhecida()]) {
      await semaforo.executar(balde, () => Promise.resolve())
    }
    const pontos = await medidor.pontos(METRICAS.esperaPeloHash)
    expect(pontos.map(({ atributos }) => atributos)).toEqual([{ escola_id: ESCOLA_A }, { escola_id: ESCOLA_B }, { escola_id: 'equipe' }, { escola_id: 'desconhecida' }])
    expect(pontos.find(({ atributos }) => atributos['escola_id'] === 'equipe')?.valor).toMatchObject({ contagem: 2 })
    expect(JSON.stringify(await medidor.atributosDeTodas())).not.toMatch(new RegExp(`${IP_DA_ESCOLA}|${IP_DE_FORA}`.replaceAll('.', '\\.')))
  })
})
