import { ErrorCode, ESTADOS_DO_ENVIO, ESTADOS_DO_PROFESSOR, type EstadoDoEnvio, type EstadoDoProfessor } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import {
  falhaDoEnvioDeConvites,
  haEnvioEmAberto,
  horaDoEnvio,
  iniciarReleituraDoEnvio,
  INTERVALO_DA_RELEITURA_MS,
  PRAZO_DA_RELEITURA_MS,
  esperaOConvite,
  podeReenviar,
  professoresQueEsperamOConvite,
  rotuloDoEnvio,
  textoDoEnvioEmLote,
  textoDoEnvioFeito,
  textoDoReenvio,
  TEXTO_DO_ENVIO_QUE_FALHOU,
  TEXTO_DOS_LINKS_ANTERIORES,
} from './envio-do-convite'

const ENVIADO_EM = '2026-11-12T17:05:00.000Z'

describe('o rótulo do envio de cada professor (4.0; cenarios.md, "Telas")', () => {
  it('cada um dos cinco estados diz o seu texto, e o cancelado não diz nada: vale o estado do convite', () => {
    const rotulos = Object.fromEntries(ESTADOS_DO_ENVIO.map((envio) => [envio, rotuloDoEnvio({ envio, enviadoEm: envio === 'enviado' ? ENVIADO_EM : null })]))
    expect(rotulos).toEqual({
      na_fila: 'Enviando',
      enviando: 'Enviando',
      enviado: 'Enviado em 12/11 às 14:05',
      falhou: 'Não chegou. Corrija o e-mail e reenvie, ou copie o link',
      cancelado: '',
    })
  })

  it('o convite copiado, sem envio, não diz nada; o falhou não culpa o professor', () => {
    expect(rotuloDoEnvio({ envio: null, enviadoEm: null })).toBe('')
    expect(TEXTO_DO_ENVIO_QUE_FALHOU).not.toMatch(/professor|erro|errou|culpa/i)
  })

  it('a hora é a da parede da escola, e não a do navegador: 02h30 UTC é 23h30 do dia anterior em São Paulo', () => {
    expect(horaDoEnvio('2026-11-13T02:30:00.000Z')).toBe('12/11 às 23:30')
    expect(horaDoEnvio('2026-01-05T03:05:00.000Z')).toBe('05/01 às 00:05')
  })

  it('o enviado sem hora (resposta de antes da 4.0) diz só "Enviado", sem inventar a hora', () => {
    expect(rotuloDoEnvio({ envio: 'enviado', enviadoEm: null })).toBe('Enviado')
  })
})

describe('a quem o "Enviar convites" e o "Reenviar" chegam', () => {
  const ESPERA: Readonly<Record<EstadoDoProfessor, boolean>> = { pendente: true, vencido: true, revogado: false, aceito: false, ativo: false, desativado: false }

  it('só espera o convite quem está pendente ou vencido, pela matriz do servidor', () => {
    for (const estado of ESTADOS_DO_PROFESSOR) expect(esperaOConvite({ estado }), estado).toBe(ESPERA[estado])
  })

  it('a lista do lote tem só quem espera, na ordem em que veio', () => {
    const lista = ESTADOS_DO_PROFESSOR.map((estado) => ({ estado, nome: estado }))
    expect(professoresQueEsperamOConvite(lista).map((professor) => professor.nome)).toEqual(['pendente', 'vencido'])
  })

  it('o "Reenviar" é de quem espera o convite e já teve envio; sem envio, o primeiro é do "Enviar convites"', () => {
    for (const estado of ESTADOS_DO_PROFESSOR) {
      for (const envio of [null, ...ESTADOS_DO_ENVIO] as const) expect(podeReenviar({ estado, envio }), `${estado} ${String(envio)}`).toBe(ESPERA[estado] && envio !== null)
    }
  })

  it('há envio em aberto só com `na_fila` ou `enviando`', () => {
    const em = (envio: EstadoDoEnvio | null) => haEnvioEmAberto([{ envio: 'enviado' }, { envio }])
    expect(em('na_fila')).toBe(true)
    expect(em('enviando')).toBe(true)
    for (const fechado of [null, 'enviado', 'falhou', 'cancelado'] as const) expect(em(fechado), String(fechado)).toBe(false)
    expect(haEnvioEmAberto([])).toBe(false)
  })
})

describe('os textos do diálogo', () => {
  it('o lote diz quantos recebem, no singular e no plural, e os dois diálogos dizem que os links de antes caducam', () => {
    expect(textoDoEnvioEmLote(1)).toContain('a 1 professor.')
    expect(textoDoEnvioEmLote(40)).toContain('a 40 professores.')
    expect(textoDoReenvio('Ana')).toContain('para Ana')
    expect(TEXTO_DOS_LINKS_ANTERIORES).toBe('Os links enviados ou copiados antes deixam de valer na hora.')
  })

  it('depois de enfileirar, diz a contagem que o servidor devolveu; zero diz que a lista mudou', () => {
    expect(textoDoEnvioFeito({ quantidade: 1 })).toContain('1 convite entrou na fila')
    expect(textoDoEnvioFeito({ quantidade: 40 })).toContain('40 convites entraram na fila')
    expect(textoDoEnvioFeito({ quantidade: 0 })).toContain('Nenhum convite entrou na fila')
  })

  it('o 429 da cota diz para esperar e tentar de novo, sem código; outra falha fica com o texto do catálogo', () => {
    expect(falhaDoEnvioDeConvites(new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe('Muitos convites enviados em pouco tempo. Espere alguns minutos e envie de novo.')
    expect(falhaDoEnvioDeConvites(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).not.toContain('INDISPONIVEL')
  })
})

describe('a releitura do envio: a cada 5 s, só com a aba visível e linha em envio, e para depois de 5 min', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function comecar(estado: { visivel: boolean; haEnvio: boolean }) {
    const reler = vi.fn()
    const parar = iniciarReleituraDoEnvio({ reler, haEnvio: () => estado.haEnvio, visivel: () => estado.visivel })
    return { reler, parar }
  }

  it('com a aba visível e a linha em envio, relê a cada 5 s', () => {
    const { reler, parar } = comecar({ visivel: true, haEnvio: true })
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS - 1)
    expect(reler).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(1)
    expect(reler).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS * 2)
    expect(reler).toHaveBeenCalledTimes(3)
    parar()
  })

  it('com a aba oculta, zero leituras; ao voltar a ficar visível, volta a ler', () => {
    const estado = { visivel: false, haEnvio: true }
    const { reler, parar } = comecar(estado)
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS * 6)
    expect(reler).toHaveBeenCalledTimes(0)
    estado.visivel = true
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS)
    expect(reler).toHaveBeenCalledTimes(1)
    parar()
  })

  it('sem nenhuma linha em envio, zero leituras', () => {
    const { reler, parar } = comecar({ visivel: true, haEnvio: false })
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS * 6)
    expect(reler).toHaveBeenCalledTimes(0)
    parar()
  })

  it('5 minutos depois do começo, para de vez, mesmo com a aba visível e a linha ainda em envio', () => {
    const { reler } = comecar({ visivel: true, haEnvio: true })
    vi.advanceTimersByTime(PRAZO_DA_RELEITURA_MS)
    const ate5Minutos = reler.mock.calls.length
    expect(ate5Minutos).toBe(PRAZO_DA_RELEITURA_MS / INTERVALO_DA_RELEITURA_MS - 1)
    vi.advanceTimersByTime(PRAZO_DA_RELEITURA_MS)
    expect(reler).toHaveBeenCalledTimes(ate5Minutos)
  })

  it('quem a para (a lista sem envio, a tela que saiu) não lê mais', () => {
    const { reler, parar } = comecar({ visivel: true, haEnvio: true })
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS)
    parar()
    vi.advanceTimersByTime(INTERVALO_DA_RELEITURA_MS * 6)
    expect(reler).toHaveBeenCalledTimes(1)
  })
})
