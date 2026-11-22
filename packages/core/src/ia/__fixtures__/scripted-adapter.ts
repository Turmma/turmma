import type { ModelAdapter, ModelCall, RepairHint, ModelResponse } from '../adapter.js'
import type { Perfil } from '../perfis.js'
import { SEM_ENVIO_EXTERNO, type EnvioDaChamada } from '../port.js'

/** O id do provedor de mentira: o teste que olha o `provedor` do registro compara com ele. */
export const PROVEDOR_ROTEIRIZADO = 'provedor-roteirizado'

/**
 * Um modelo de mentira que devolve, em ordem, os textos do roteiro: é como o teste põe na boca do "modelo" a saída
 * que a conferência precisa barrar. Um item que é `Error` é lançado, como um adaptador com defeito faria.
 */
export class ScriptedAdapter implements ModelAdapter {
  readonly origem = 'openai_compat'
  /** O que cada chamada recebeu de correção (`undefined` na primeira). */
  readonly correcoes: (RepairHint | undefined)[] = []
  /** O modelo que cada chamada pediu (`undefined`: o do perfil). O degrau do modelo menor o troca. */
  readonly modelosPedidos: (string | undefined)[] = []

  readonly envio: EnvioDaChamada
  readonly identidade: string

  /** `provedorId` é o de cada instância: o principal e a reserva da bancada são dois, cada um com o seu. Sem envio externo a identidade é a origem, como no adaptador de verdade. */
  constructor(
    private readonly roteiro: readonly (string | Error)[],
    envioExterno = true,
    provedorId = PROVEDOR_ROTEIRIZADO,
  ) {
    this.envio = envioExterno ? { envioExterno: true, provedorId } : SEM_ENVIO_EXTERNO
    this.identidade = this.envio.provedorId ?? this.origem
  }

  get chamadas(): number {
    return this.correcoes.length
  }

  modeloDoPerfil(perfil: Perfil): string {
    return `roteirizado-${perfil}`
  }

  async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const item = this.roteiro[this.correcoes.length]
    this.correcoes.push(chamada.correcao)
    this.modelosPedidos.push(chamada.modelo)
    if (item === undefined) throw new Error('o roteiro do teste acabou antes das chamadas')
    if (item instanceof Error) throw item
    return { texto: item, modelo: chamada.modelo ?? this.modeloDoPerfil(chamada.tarefa.perfil), tokensDeEntrada: 100, tokensDeSaida: 20 }
  }
}
