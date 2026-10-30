import type { ModelAdapter, ModelCall, RepairHint, ModelResponse } from '../adaptador.js'
import type { Perfil } from '../perfis.js'
import { SEM_ENVIO_EXTERNO, type EnvioDaChamada } from '../porta.js'

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

  readonly envio: EnvioDaChamada

  constructor(
    private readonly roteiro: readonly (string | Error)[],
    envioExterno = true,
  ) {
    this.envio = envioExterno ? { envioExterno: true, provedorId: PROVEDOR_ROTEIRIZADO } : SEM_ENVIO_EXTERNO
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
    if (item === undefined) throw new Error('o roteiro do teste acabou antes das chamadas')
    if (item instanceof Error) throw item
    return { texto: item, modelo: this.modeloDoPerfil(chamada.tarefa.perfil), tokensDeEntrada: 100, tokensDeSaida: 20 }
  }
}
