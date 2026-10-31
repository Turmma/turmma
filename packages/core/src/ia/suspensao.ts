import type { ChaveDeFuncao } from '@educa/shared'
import { requireEscolaId } from '../context/context-escola.js'
import { LLMError } from './errors.js'

/**
 * A escola pode suspender **uma função** de IA sem desligar as outras (D60): suspende a correção automática e o chat
 * do professor continua. A suspensão vale no servidor, e é esta porta que responde, a cada execução, se a função
 * está suspensa naquela escola agora. **A escola é a do contexto de quem executa** (a requisição ou a execução em segundo
 * plano), lida a cada chamada com `requireEscolaId()`: a porta não a recebe por argumento (regra 10, item 3). A
 * implementação em Postgres lê `suspensao_de_funcao`, com `escola_id` na cláusula.
 */
export interface SuspensaoDeFuncao {
  estaSuspensa(funcao: ChaveDeFuncao): Promise<boolean>
}

/**
 * A conferência, num ponto só. O `LLMProvider` a faz antes de qualquer chamada de modelo; o domínio a chama onde a
 * função roda **sem** modelo — a correção de objetiva é uma conta, e é função suspensível como as outras.
 *
 * Sem conseguir consultar, não executa: a falha da consulta fecha a porta (`IA_INDISPONIVEL`), não abre. Isso inclui a
 * chamada sem escola no contexto, que a porta recusa antes de qualquer leitura.
 */
export async function exigirFuncaoAtiva(suspensao: SuspensaoDeFuncao, funcao: ChaveDeFuncao): Promise<void> {
  let suspensa: boolean
  try {
    suspensa = await suspensao.estaSuspensa(funcao)
  } catch {
    throw new LLMError('IA_INDISPONIVEL')
  }
  if (suspensa) throw new LLMError('FUNCAO_SUSPENSA')
}

/**
 * Suspensões em memória, para teste. Quem prepara o cenário diz a escola (`suspender`, `retomar`); quem consulta
 * (`estaSuspensa`) é perguntado pela escola do contexto, como a implementação em Postgres, e sem contexto lança.
 */
export class InMemorySuspensoes implements SuspensaoDeFuncao {
  private readonly suspensas = new Set<string>()

  suspender(escolaId: string, funcao: ChaveDeFuncao): void {
    this.suspensas.add(`${escolaId}:${funcao}`)
  }

  retomar(escolaId: string, funcao: ChaveDeFuncao): void {
    this.suspensas.delete(`${escolaId}:${funcao}`)
  }

  async estaSuspensa(funcao: ChaveDeFuncao): Promise<boolean> {
    return this.suspensas.has(`${requireEscolaId()}:${funcao}`)
  }
}
