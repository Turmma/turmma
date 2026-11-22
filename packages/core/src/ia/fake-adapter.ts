import { setTimeout as esperar } from 'node:timers/promises'
import type { ModelAdapter, ModelCall, ModelResponse } from './adapter.js'
import type { FalhaFalsa } from '../config/llm-config.js'
import { LLMError, ProviderError, type ProviderFailure } from './errors.js'
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
  /** A identidade do adaptador (`adapter.ts`): `falso` no principal e o `IA_RESERVA_PROVEDOR_ID` (`falso-reserva`) na reserva. */
  readonly identidade?: string
  /** Os tokens que a chamada informa, no lugar da estimativa pelo texto: o teste de carga os põe na escala de `docs/infra.md` 3.2 (X6, 11.0). */
  readonly tokens?: { readonly entrada: number; readonly saida: number }
  /** A falha que toda chamada deste falso faz (`IA_FALHA_FALSA`, F5b 4.0): o ensaio da queda do principal. Só o falso a tem; o `openai_compat` não. */
  readonly falha?: FalhaFalsa
}

/** Como cada falha sob comando chega ao `ResilientAdapter`: a classificação que o adaptador de verdade lançaria (5xx, prazo, conexão recusada, 429). */
const FALHA_DO_PROVEDOR: Readonly<Record<FalhaFalsa, ProviderFailure>> = { '5xx': 'servidor', prazo: 'tempo', conexao: 'recusada', '429': 'limite' }

/**
 * O adaptador dos testes e da demonstração sem modelo: devolve a versão determinística da tarefa, feita só do que
 * veio na entrada. Mesma entrada, mesma saída. Não chama ninguém, e por isso nunca há envio externo.
 */
export class FakeAdapter implements ModelAdapter {
  readonly origem = 'falso'
  readonly envio = SEM_ENVIO_EXTERNO
  readonly identidade: string

  constructor(private readonly opcoes: FakeAdapterOptions = {}) {
    this.identidade = opcoes.identidade ?? 'falso'
  }

  modeloDoPerfil(_perfil: Perfil): string {
    return MODELO_FALSO
  }

  /** A falha sob comando (`IA_FALHA_FALSA`): sai antes da espera simulada, como a do provedor que cai. */
  private falharSeMandado(): void {
    if (this.opcoes.falha !== undefined) throw new ProviderError(FALHA_DO_PROVEDOR[this.opcoes.falha])
  }

  async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    this.falharSeMandado()
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
