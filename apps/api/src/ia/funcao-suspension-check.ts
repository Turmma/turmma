import { exigirFuncaoAtiva, type SuspensaoDeFuncao } from '@educa/core'
import type { ChaveDeFuncao } from '@educa/shared'

/**
 * A conferência da suspensão para quem roda uma função **sem modelo** (a correção de objetiva é uma conta, e é função
 * suspensível como as outras; D60). Com modelo não precisa: o `AgendadorDeExecucoes` e o `LLMProvider` já conferem.
 *
 * A escola é a do contexto, lida pela porta da suspensão. Suspensa, lança `FUNCAO_SUSPENSA` (409). Suspender recusa
 * execução nova e não desfaz o que a função já produziu: decidir uma entrega pendente não passa por aqui.
 */
export class ConferenciaDeFuncao {
  constructor(private readonly suspensao: SuspensaoDeFuncao) {}

  exigirAtiva(funcao: ChaveDeFuncao): Promise<void> {
    return exigirFuncaoAtiva(this.suspensao, funcao)
  }
}
