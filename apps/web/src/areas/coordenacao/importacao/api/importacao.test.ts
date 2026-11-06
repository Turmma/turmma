import { ErrorCode, type Importacao } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../../api/client'
import { acompanharImportacao, ImportacaoNaoConcluidaError, PRAZO_PARA_AVISAR_DA_FILA_MS, rotasDaPlanilha } from './importacao'

const importacao = (estado: Importacao['estado'], erro: Importacao['erro'] = null): Importacao => ({
  id: '0197a1c0-0000-7000-8000-000000000900',
  tipo: 'alunos',
  estado,
  resumo: estado === 'concluida' ? { entram: 1 } : null,
  erro,
  criadoEm: '2026-11-04T10:00:00-03:00',
  concluidaEm: estado === 'na_fila' ? null : '2026-11-04T10:00:01-03:00',
})

/** Um relógio e uma espera falsos: a espera só soma ao relógio, e ninguém espera de verdade. */
function relogioFalso() {
  const estado = { agora: 0, esperas: [] as number[] }
  return {
    estado,
    agora: () => estado.agora,
    esperar: (ms: number) => {
      estado.esperas.push(ms)
      estado.agora += ms
      return Promise.resolve()
    },
  }
}

describe('13.0 (unidade): as rotas da planilha', () => {
  it('a planilha da escola usa a rota por tipo; o gravar e a prévia são irmãos', () => {
    expect(rotasDaPlanilha('alunos')).toEqual({ previa: '/v1/importacoes/alunos/previa', gravar: '/v1/importacoes/alunos' })
  })
})

describe('13.0 (unidade): acompanhar a importação até o fim (regra 80)', () => {
  it('lê até concluir e devolve a importação concluída', async () => {
    const relogio = relogioFalso()
    const respostas = [importacao('na_fila'), importacao('na_fila'), importacao('concluida')]
    let leituras = 0
    const lida = await acompanharImportacao(() => Promise.resolve(respostas[leituras++] as Importacao), relogio)
    expect(lida.estado).toBe('concluida')
    expect(leituras).toBe(3)
    // A espera cresce 1,5 vez a cada leitura, e tem teto.
    expect(relogio.estado.esperas).toEqual([1_000, 1_500])
  })

  it('"desatualizada" e "falhou" sobem como importação não concluída, com a causa', async () => {
    const relogio = relogioFalso()
    await expect(acompanharImportacao(() => Promise.resolve(importacao('desatualizada')), relogio)).rejects.toMatchObject({ estado: 'desatualizada', erro: null })
    await expect(acompanharImportacao(() => Promise.resolve(importacao('falhou', 'expirou')), relogio)).rejects.toBeInstanceOf(ImportacaoNaoConcluidaError)
    await expect(acompanharImportacao(() => Promise.resolve(importacao('falhou', 'trava_esgotada')), relogio)).rejects.toMatchObject({ estado: 'falhou', erro: 'trava_esgotada' })
  })

  it('a fila lenta avisa uma vez depois de 60 s e NÃO desiste: a importação que conclui aos 200 s é concluída, e não "falhou"', async () => {
    const relogio = relogioFalso()
    let avisos = 0
    let avisouAos = -1
    let leituras = 0
    const lida = await acompanharImportacao(
      () => {
        leituras += 1
        return Promise.resolve(relogio.estado.agora >= 200_000 ? importacao('concluida') : importacao('na_fila'))
      },
      {
        ...relogio,
        aoDemorar: () => {
          avisos += 1
          avisouAos = relogio.estado.agora
        },
      },
    )
    expect(lida.estado).toBe('concluida')
    expect(avisos).toBe(1)
    // Só avisa quando passou o prazo: não na primeira leitura.
    expect(avisouAos).toBeGreaterThanOrEqual(PRAZO_PARA_AVISAR_DA_FILA_MS)
    expect(relogio.estado.agora).toBeGreaterThan(PRAZO_PARA_AVISAR_DA_FILA_MS * 3)
    // Em 200 s com espera de até 3 s, são umas 70 leituras: nunca uma por 100 ms.
    expect(leituras).toBeLessThan(90)
    expect(Math.min(...relogio.estado.esperas)).toBeGreaterThanOrEqual(1_000)
    // A espera cresce até o teto de 3 s e fica nele: sem o teto, passaria de 3 s e a tela esperaria minutos entre duas leituras.
    expect(Math.max(...relogio.estado.esperas)).toBe(3_000)
  })

  it('o 429 de uma leitura vale como "ainda na fila" e a próxima espera é o Retry-After ou mais, nunca menos', async () => {
    const relogio = relogioFalso()
    const respostas: (Importacao | ApiError)[] = [new ApiError(ErrorCode.LIMITE_EXCEDIDO, 20), importacao('na_fila'), new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), importacao('concluida')]
    let leituras = 0
    const lida = await acompanharImportacao(() => {
      const resposta = respostas[leituras++] as Importacao | ApiError
      return resposta instanceof ApiError ? Promise.reject(resposta) : Promise.resolve(resposta)
    }, relogio)
    expect(lida.estado).toBe('concluida')
    expect(relogio.estado.esperas[0]).toBe(20_000)
    // Sem Retry-After, vale a espera comum.
    expect(relogio.estado.esperas[2]).toBeGreaterThanOrEqual(1_000)
    expect(relogio.estado.esperas[2]).toBeLessThan(20_000)
  })

  it('outro erro de leitura (a sessão que caiu, o contrato que mudou) não é "ainda na fila": sobe na hora', async () => {
    const relogio = relogioFalso()
    let leituras = 0
    // Se o erro fosse tratado como "ainda na fila", a quarta leitura concluiria e o teste acusaria, em vez de ficar lendo para sempre.
    const leitura = () => {
      leituras += 1
      return leituras > 3 ? Promise.resolve(importacao('concluida')) : Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
    }
    await expect(acompanharImportacao(leitura, relogio)).rejects.toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    expect(leituras).toBe(1)
    expect(relogio.estado.esperas).toEqual([])
  })

  it('sair da tela cancela: o sinal aborta a espera e nenhuma leitura nova sai', async () => {
    const controle = new AbortController()
    let leituras = 0
    const espera = acompanharImportacao(
      () => {
        leituras += 1
        return Promise.resolve(importacao('na_fila'))
      },
      { sinal: controle.signal },
    )
    // A primeira leitura sai; a espera de 1 s é cancelada antes de ela terminar.
    await Promise.resolve()
    controle.abort(new DOMException('saiu', 'AbortError'))
    await expect(espera).rejects.toMatchObject({ name: 'AbortError' })
    expect(leituras).toBe(1)
  })

  it('o sinal já abortado quando a leitura termina cancela a espera na hora, sem esperar o tempo dela', async () => {
    const controle = new AbortController()
    const espera = acompanharImportacao(
      () => {
        controle.abort(new DOMException('saiu', 'AbortError'))
        return Promise.resolve(importacao('na_fila'))
      },
      { sinal: controle.signal },
    )
    // A espera é de 1 s: cancelada na hora, ela já terminou antes dos 300 ms.
    const quemTerminou = await Promise.race([espera.then(() => 'concluiu', (erro: unknown) => (erro as Error).name), new Promise((resolver) => setTimeout(() => resolver('travou'), 300))])
    expect(quemTerminou).toBe('AbortError')
  })

  it('a leitura que cai com o 429 quando a tela já saiu sobe o erro dela, e não vira espera', async () => {
    const controle = new AbortController()
    const erro = new ApiError(ErrorCode.LIMITE_EXCEDIDO, 20)
    const resultado = acompanharImportacao(
      () => {
        controle.abort(new DOMException('saiu', 'AbortError'))
        return Promise.reject(erro)
      },
      { sinal: controle.signal },
    )
    await expect(resultado).rejects.toBe(erro)
  })
})
