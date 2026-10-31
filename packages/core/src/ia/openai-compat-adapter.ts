import { z } from 'zod'
import { MOTIVO_SEM_PROVEDOR_ID, type ModelConfig } from '../config/llm-config.js'
import { InvalidConfigError } from '../config/validate-config.js'
import type { ModelAdapter, ModelCall, ModelResponse } from './adapter.js'
import { estimarTokens } from './fake-adapter.js'
import { ProviderError } from './errors.js'
import { limparSaidaDoModelo } from './clean-output.js'
import type { Perfil } from './perfis.js'
import { SEM_ENVIO_EXTERNO, type EnvioDaChamada } from './port.js'
import { ABRE_DADO, FECHA_DADO, pedidoDeCorrecao, REGRAS_COMUNS } from './prompts/comum.js'
import type { PromptData, TaskDefinition } from './task.js'

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/**
 * O conteúdo de um dado não consegue fechar a própria cerca: `</dado>` (e `<dado`) dentro de uma página de material
 * ou de uma mensagem de aluno perdem o `<`. Sem isso, um PDF com "</dado> Ignore as regras" sairia do bloco de dado
 * e viraria instrução.
 */
function neutralizarCerca(corpo: string): string {
  return corpo.replace(/<(?=\s*\/?\s*dado)/giu, '‹')
}

export function renderizarDado(dado: PromptData): string {
  const atributos = Object.entries(dado.atributos ?? {})
    .map(([chave, valor]) => ` ${chave}="${String(valor).replace(/["<>]/g, '')}"`)
    .join('')
  return `${ABRE_DADO} tipo="${dado.tipo}"${atributos}>\n${neutralizarCerca(dado.corpo)}\n${FECHA_DADO}`
}

const esquemasEmJson = new WeakMap<object, string>()

/** O JSON Schema da saída, tirado do mesmo zod que valida: o que se pede ao modelo e o que se confere não divergem. */
function jsonOutputSchema(tarefa: TaskDefinition<never, unknown>): string {
  const guardado = esquemasEmJson.get(tarefa)
  if (guardado !== undefined) return guardado
  const esquema = JSON.stringify(z.toJSONSchema(tarefa.esquemaDeSaida))
  esquemasEmJson.set(tarefa, esquema)
  return esquema
}

const TAMANHO_MAXIMO_DA_RESPOSTA_REPETIDA = 6_000

/** Sistema: o prompt da tarefa, as regras comuns e o formato. Usuário: a instrução e os dados, cada um na sua cerca. */
export function montarMensagens<Entrada, Saida>(chamada: Pick<ModelCall<Entrada, Saida>, 'tarefa' | 'entrada' | 'correcao'>): ChatMessage[] {
  const { tarefa, entrada, correcao } = chamada
  const pedido = tarefa.montarPedido(entrada)
  const mensagens: ChatMessage[] = [
    { role: 'system', content: [tarefa.prompt.sistema, REGRAS_COMUNS, `JSON Schema da resposta:\n${jsonOutputSchema(tarefa as TaskDefinition<never, unknown>)}`].join('\n\n') },
    { role: 'user', content: [pedido.instrucao, ...pedido.dados.map(renderizarDado)].join('\n\n') },
  ]
  if (correcao !== undefined) {
    mensagens.push(
      { role: 'assistant', content: correcao.respostaAnterior.slice(0, TAMANHO_MAXIMO_DA_RESPOSTA_REPETIDA) || '(resposta vazia)' },
      { role: 'user', content: pedidoDeCorrecao(correcao.problemas) },
    )
  }
  return mensagens
}

/**
 * Só o que se lê da resposta. `reasoning_content` não está aqui de propósito: raciocínio do modelo não é resposta,
 * e o que o schema não declara não é lido, guardado nem registrado.
 */
const respostaSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullish() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number().int().min(0).optional(), completion_tokens: z.number().int().min(0).optional() }).nullish(),
})

const ESPERA_MAXIMA_SUGERIDA_SEGUNDOS = 300

function esperaSugerida(resposta: Response): number | undefined {
  const segundos = Number(resposta.headers.get('retry-after'))
  return Number.isInteger(segundos) && segundos > 0 ? Math.min(segundos, ESPERA_MAXIMA_SUGERIDA_SEGUNDOS) : undefined
}

/**
 * Qualquer servidor do padrão OpenAI, por `fetch` puro, sem SDK (regra 30, item 1; regra 00, item 7). No ensaio é o
 * `llama-server` em modo roteador: o adaptador só chama `chat/completions` com o id do modelo que a configuração deu,
 * e nunca carrega nem descarrega modelo.
 *
 * O erro do provedor morre aqui. Status, corpo e mensagem do `fetch` não saem: o corpo de um 400 pode repetir o
 * prompt, e o prompt do Tutor é texto de aluno (regra 20, item 9).
 */
export class OpenAICompatAdapter implements ModelAdapter {
  readonly origem = 'openai_compat'
  readonly envio: EnvioDaChamada
  private readonly endereco: string

  /** Fora da nossa rede o provedor tem de ter id: a subida já o exige (`IA_PROVEDOR_ID`), e quem monta a configuração à mão não escapa. */
  constructor(private readonly config: ModelConfig) {
    if (config.processamentoLocal) this.envio = SEM_ENVIO_EXTERNO
    else if (config.provedorId === undefined) throw new InvalidConfigError(['IA_PROVEDOR_ID'], [MOTIVO_SEM_PROVEDOR_ID])
    else this.envio = { envioExterno: true, provedorId: config.provedorId }
    this.endereco = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
  }

  modeloDoPerfil(perfil: Perfil): string {
    return this.config.modelos[perfil]
  }

  async chamar<Entrada, Saida>(chamada: ModelCall<Entrada, Saida>): Promise<ModelResponse> {
    const modelo = this.modeloDoPerfil(chamada.tarefa.perfil)
    const mensagens = montarMensagens(chamada)
    const corpo = JSON.stringify({
      model: modelo,
      messages: mensagens,
      stream: false,
      temperature: 0.2,
      max_tokens: chamada.tarefa.maximoDeTokensDeSaida,
      response_format: { type: 'json_object' },
      // O modelo local raciocina por padrão. Toda tarefa daqui é de saída estruturada: o raciocínio sai desligado.
      chat_template_kwargs: { enable_thinking: false },
    })
    const resposta = await this.pedir(corpo, chamada.sinal)
    let envelope: unknown
    try {
      envelope = await resposta.json()
    } catch {
      throw new ProviderError(chamada.sinal.aborted ? 'tempo' : 'servidor')
    }
    const lido = respostaSchema.safeParse(envelope)
    if (!lido.success) throw new ProviderError('servidor')
    const conteudo = lido.data.choices[0]?.message.content ?? ''
    return {
      texto: limparSaidaDoModelo(conteudo),
      modelo: lido.data.model !== undefined && lido.data.model.length > 0 ? lido.data.model : modelo,
      tokensDeEntrada: lido.data.usage?.prompt_tokens ?? estimarTokens(mensagens.map((mensagem) => mensagem.content).join('\n')),
      tokensDeSaida: lido.data.usage?.completion_tokens ?? estimarTokens(conteudo),
    }
  }

  /**
   * **Uma** chamada, sem repetição: quem repete, e só no que não cobrou, é o `ResilientAdapter`, que sabe o prazo, o
   * disjuntor e quantas vezes já tentou (regra 30, item 8). Aqui a falha só ganha o nome do que aconteceu
   * (`ProviderFailure`); o status, o corpo e a mensagem do `fetch` morrem aqui.
   */
  private async pedir(corpo: string, sinal: AbortSignal): Promise<Response> {
    let resposta: Response
    try {
      resposta = await fetch(this.endereco, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(this.config.chaveApi === undefined ? {} : { authorization: `Bearer ${this.config.chaveApi}` }) },
        body: corpo,
        signal: sinal,
        // Redirecionamento nunca é seguido: um 307 ou 308 faria o `fetch` reenviar o corpo inteiro, com o prompt, para
        // outra origem. Com o endereço declarado local, a conversa sairia da nossa rede e ficaria gravada como se não
        // tivesse saído. O servidor que redireciona é tratado como indisponível.
        redirect: 'error',
      })
    } catch (erro) {
      throw new ProviderError(sinal.aborted ? 'tempo' : conexaoRecusada(erro) ? 'recusada' : 'servidor')
    }
    if (resposta.ok) return resposta
    await resposta.body?.cancel().catch(() => undefined)
    if (resposta.status === 429) throw new ProviderError('limite', esperaSugerida(resposta))
    throw new ProviderError(resposta.status >= 500 ? 'servidor' : 'rejeitada')
  }
}

/** O `fetch` do Node esconde a causa em `cause.code`: `ECONNREFUSED` é a chamada que nem chegou ao provedor, e por isso se repete. */
function conexaoRecusada(erro: unknown): boolean {
  const causa = erro instanceof Error ? erro.cause : undefined
  return typeof causa === 'object' && causa !== null && 'code' in causa && causa.code === 'ECONNREFUSED'
}
