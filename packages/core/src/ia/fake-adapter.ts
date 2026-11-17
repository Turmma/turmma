import { setTimeout as esperar } from 'node:timers/promises'
import type { ModelAdapter, ModelCall, ModelResponse } from './adapter.js'
import { LLMError } from './errors.js'
import type { Perfil } from './perfis.js'
import { SEM_ENVIO_EXTERNO } from './port.js'
import { MaterialSemConteudoAproveitavelError, type TaskDefinition } from './task.js'

export const MODELO_FALSO = 'falso-deterministico'
/** O modelo menor do adaptador falso (`LLM_MODELO_MENOR_<PERFIL>=falso-menor`): o degrau da carga e do ensaio sem provedor. */
export const MODELO_FALSO_MENOR = 'falso-menor'

/** Estimativa grosseira e estável: quatro caracteres por token. Serve para o consumo aparecer na governança sem modelo. */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4)
}

function versaoDeterministica<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada): Saida {
  try {
    return tarefa.falso(entrada)
  } catch (erro) {
    // Sem material aproveitável não há o que citar, e por isso não há saída (regra 30, item 12).
    if (erro instanceof MaterialSemConteudoAproveitavelError) throw new LLMError('MATERIAL_INSUFICIENTE')
    throw erro
  }
}

export interface FakeAdapterOptions {
  /** Espera simulada por chamada, para ensaio e teste de carga sem provedor (regra 80, item 11). */
  readonly latenciaMs?: number
  /** A espera do perfil `padrao` (a ferramenta), quando difere da dos outros: a ferramenta leva ~50 s, e o turno do Tutor, ~6 s (X6, 11.0). */
  readonly latenciaMsPadrao?: number
  /** Os tokens que a chamada informa, no lugar da estimativa pelo texto: o teste de carga os põe na escala de `docs/infra.md` 3.2 (X6, 11.0). */
  readonly tokens?: { readonly entrada: number; readonly saida: number }
}

/**
 * O adaptador dos testes e da demonstração sem modelo: devolve a versão determinística da tarefa, feita só do que
 * veio na entrada. Mesma entrada, mesma saída. Não chama ninguém, e por isso nunca há envio externo.
 */
export class FakeAdapter implements ModelAdapter {
  readonly origem = 'falso'
  readonly envio = SEM_ENVIO_EXTERNO

  constructor(private readonly opcoes: FakeAdapterOptions = {}) {}

  modeloDoPerfil(_perfil: Perfil): string {
    return MODELO_FALSO
  }

  async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const latenciaMs = (chamada.tarefa.perfil === 'padrao' ? this.opcoes.latenciaMsPadrao : undefined) ?? this.opcoes.latenciaMs ?? 0
    if (latenciaMs > 0) {
      await esperar(latenciaMs, undefined, { signal: chamada.sinal }).catch(() => {
        throw new LLMError('IA_TEMPO_ESGOTADO')
      })
    }
    const texto = JSON.stringify(versaoDeterministica(chamada.tarefa, chamada.entrada))
    return {
      texto,
      modelo: chamada.modelo ?? MODELO_FALSO,
      tokensDeEntrada: this.opcoes.tokens?.entrada ?? estimarTokens(JSON.stringify(chamada.entrada)),
      tokensDeSaida: this.opcoes.tokens?.saida ?? estimarTokens(texto),
    }
  }
}
