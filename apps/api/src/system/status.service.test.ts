import { systemStatusResponseSchema } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { StatusService, VALIDADE_DA_VERIFICACAO_MS } from './status.service.js'
import type { HealthService } from './health.service.js'

class SaudeFalsa {
  chamadas = 0
  ok = true
  private pendentes: (() => void)[] = []
  segurar = false

  verificar(): Promise<{ ok: boolean }> {
    this.chamadas++
    if (!this.segurar) return Promise.resolve({ ok: this.ok })
    return new Promise((resolver) => this.pendentes.push(() => resolver({ ok: this.ok })))
  }

  soltar(): void {
    for (const soltar of this.pendentes.splice(0)) soltar()
  }
}

function montar() {
  const saude = new SaudeFalsa()
  let instante = new Date('2026-09-14T10:00:00.000Z')
  const servico = new StatusService(saude as unknown as HealthService, '3d4099c', 'local', () => instante)
  return {
    saude,
    servico,
    avancar: (ms: number) => {
      instante = new Date(instante.getTime() + ms)
    },
  }
}

describe('EstadoService', () => {
  it('devolve versão, ambiente e a situação da API e do banco no contrato de packages/shared', async () => {
    const { servico } = montar()
    const estado = await servico.obter()
    expect(systemStatusResponseSchema.parse(estado)).toEqual(estado)
    expect(estado).toEqual({
      versao: '3d4099c',
      ambiente: 'local',
      componentes: [
        { nome: 'api', situacao: 'disponivel', verificadoEm: '2026-09-14T10:00:00.000Z' },
        { nome: 'banco', situacao: 'disponivel', verificadoEm: '2026-09-14T10:00:00.000Z' },
      ],
    })
  })

  it('com o banco fora, responde assim mesmo, com o banco indisponível', async () => {
    const { servico, saude } = montar()
    saude.ok = false
    const estado = await servico.obter()
    expect(estado.componentes.find((componente) => componente.nome === 'banco')?.situacao).toBe('indisponivel')
  })

  it('dentro da validade, recargas seguidas não consultam o banco de novo; vencida, consulta', async () => {
    const { servico, saude, avancar } = montar()
    await servico.obter()
    avancar(VALIDADE_DA_VERIFICACAO_MS - 1)
    saude.ok = false
    const reaproveitado = await servico.obter()
    expect(saude.chamadas).toBe(1)
    expect(reaproveitado.componentes[1]).toMatchObject({ situacao: 'disponivel', verificadoEm: '2026-09-14T10:00:00.000Z' })

    avancar(1)
    const renovado = await servico.obter()
    expect(saude.chamadas).toBe(2)
    expect(renovado.componentes[1]).toMatchObject({ situacao: 'indisponivel', verificadoEm: '2026-09-14T10:00:05.000Z' })
  })

  it('cem requisições ao mesmo tempo com o banco lento fazem uma consulta só, não cem conexões presas', async () => {
    const { servico, saude } = montar()
    saude.segurar = true
    const respostas = Array.from({ length: 100 }, () => servico.obter())
    await Promise.resolve()
    expect(saude.chamadas).toBe(1)
    saude.soltar()
    expect(await Promise.all(respostas)).toHaveLength(100)
    expect(saude.chamadas).toBe(1)
  })
})
