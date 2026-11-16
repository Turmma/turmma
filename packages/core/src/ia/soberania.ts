import type { CategoriaDeDadoDoSuboperador } from '@educa/shared'
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import type { LLMConfig } from '../config/llm-config.js'
import { summarizeError } from '../error/summarize-error.js'
import type { LoggerBase } from '../log/logger.js'
import type { SuboperadorParaAConferenciaDaD62 } from '../titular/suboperador-da-escola.repository.js'
import { destinoDoAdaptador } from './llm-gateway.js'
import type { DeclaracaoDeSoberania, EnvioDaChamada } from './port.js'
import { TASK_CATALOG } from './tasks/index.js'

/**
 * A D62 (texto de aluno só em provedor que processa no Brasil) conferida pelo código, e não só pelo contrato escrito (reengenharia-continuacao,
 * 8.0). Duas conferências dividem este arquivo:
 *
 * 1. **A subida** (`SoberaniaNaSubida`): com provedor externo, o `main-worker` não consome fila sem o suboperador vigente da `IA_PROVEDOR_ID`
 *    com `pais = 'BR'`, treinamento vedado, `alcance = 'todas'` e todas as categorias que as tarefas registradas enviam. A API não tem esta
 *    conferência, porque não monta modelo: a `/prontidao` dela responde como antes da 8.0 (o horário de aula é sagrado, regra 80).
 * 2. **A chamada** (o `LLMGateway`): a tarefa com `levaTextoDeAluno` só sai para provedor externo se a subida conferiu (`DeclaracaoDeSoberania`).
 *
 * O adaptador falso e o modelo local não enviam nada para fora (`envioExterno: false`): não têm suboperador a conferir e sobem sem ele.
 */

/** Quantos milissegundos entre uma conferência recusada, ou sem banco, e a seguinte: a instância se levanta sozinha quando o cadastro é corrigido. */
export const INTERVALO_DA_NOVA_CONFERENCIA_MS = 5_000

/** De quantas em quantas tentativas seguidas **do mesmo motivo** o log se repete (12 de 5 s, um minuto): a primeira e a que muda de motivo sempre saem. */
const REPETICAO_DO_LOG = 12

/** Por que o suboperador não cobre a D62. Cada motivo é uma coisa só que o operador corrige no cadastro (`ops:suboperador`). */
export type MotivoDaD62 = 'sem_suboperador_vigente' | 'pais_fora_do_brasil' | 'treinamento_nao_vedado' | 'alcance_nao_e_todas' | `categoria_faltando:${CategoriaDeDadoDoSuboperador}`

/** A união das categorias que as tarefas enviam ao provedor, sem repetir, na ordem em que aparecem. */
export function categoriasEnviadasPelasTarefas(tarefas: Iterable<{ readonly categoriasEnviadas: readonly CategoriaDeDadoDoSuboperador[] }> = Object.values(TASK_CATALOG)): CategoriaDeDadoDoSuboperador[] {
  return [...new Set([...tarefas].flatMap((tarefa) => tarefa.categoriasEnviadas))]
}

/**
 * Tudo o que falta no suboperador para cobrir a D62; lista vazia é conferido. Cada campo é uma cláusula própria, e cada categoria exigida também: o
 * contrato que cobre só a conversa do aluno deixa sair, sem constar, o material da escola que o Tutor leva junto.
 */
export function motivosDaD62(suboperador: SuboperadorParaAConferenciaDaD62 | undefined, exigidas: readonly CategoriaDeDadoDoSuboperador[]): MotivoDaD62[] {
  if (suboperador === undefined) return ['sem_suboperador_vigente']
  const motivos: MotivoDaD62[] = []
  if (suboperador.pais !== 'BR') motivos.push('pais_fora_do_brasil')
  if (!suboperador.vedaTreinamento) motivos.push('treinamento_nao_vedado')
  if (suboperador.alcance !== 'todas') motivos.push('alcance_nao_e_todas')
  for (const categoria of exigidas) if (!suboperador.categorias.includes(categoria)) motivos.push(`categoria_faltando:${categoria}`)
  return motivos
}

export interface SoberaniaNaSubidaOpcoes {
  /** A configuração de IA da instância: quem diz se há envio externo e para qual provedor é o adaptador, como na chamada (`destinoDoAdaptador`). */
  readonly config: LLMConfig
  readonly leitura: { vigenteDoProvedor(chave: string): Promise<SuboperadorParaAConferenciaDaD62 | undefined> }
  readonly logger: Pick<LoggerBase, 'info' | 'warn'>
  /** Só o teste: o intervalo da nova conferência. */
  readonly intervaloMs?: number
}

/**
 * A conferência da subida, só no `main-worker` (`worker-ia`). Sem envio externo, nasce conferida e não lê o banco. Com ele, nasce **não conferida** e
 * confere o suboperador vigente da `IA_PROVEDOR_ID`; se o cadastro não cobre a D62, ou o banco não responde, segue não conferida e confere de novo a cada
 * `INTERVALO_DA_NOVA_CONFERENCIA_MS`, falhando fechada: o `main-worker` não cria o consumidor das filas nem o batimento, e o gateway recusa a tarefa de
 * aluno. Corrigir o cadastro basta; não é preciso reiniciar. **O contrário é que pede reinício**: depois de conferida, a instância não lê o
 * suboperador de novo, e encerrá-lo (`ops:suboperador encerrar`) só vale quando os `worker-ia` forem reiniciados, a qualquer hora (`docs/runbook.md`).
 * A API não reinicia: ela não monta modelo.
 *
 * O log leva o evento, o provedor e os motivos fixos, nunca o contrato (regra 20, item 9).
 */
export class SoberaniaNaSubida implements DeclaracaoDeSoberania, OnApplicationBootstrap, OnApplicationShutdown {
  readonly #envio: EnvioDaChamada
  readonly #intervaloMs: number
  readonly #exigidas: readonly CategoriaDeDadoDoSuboperador[]
  #conferida: boolean
  #encerrada = false
  #nova: NodeJS.Timeout | undefined
  #primeira: Promise<void> | undefined
  #tentativas = 0
  #ultimoMotivo = ''
  #repeticoes = 0
  readonly #aguardando = new Set<(conferida: boolean) => void>()

  constructor(private readonly opcoes: SoberaniaNaSubidaOpcoes) {
    this.#envio = destinoDoAdaptador(opcoes.config).envio
    this.#conferida = !this.#envio.envioExterno
    this.#intervaloMs = opcoes.intervaloMs ?? INTERVALO_DA_NOVA_CONFERENCIA_MS
    this.#exigidas = categoriasEnviadasPelasTarefas()
  }

  get conferida(): boolean {
    return this.#conferida
  }

  onApplicationBootstrap(): void {
    void this.iniciar()
  }

  onApplicationShutdown(): void {
    this.encerrar()
  }

  /** Faz a primeira conferência e, se ela não passa, agenda as seguintes. A promessa termina com a primeira conferência, passe ela ou não. */
  iniciar(): Promise<void> {
    this.#primeira ??= this.#conferirEAgendar()
    return this.#primeira
  }

  /** Resolve `true` quando a instância fica conferida (já conferida, ou depois de uma nova conferência), e `false` se ela encerra antes. */
  aguardarConferida(): Promise<boolean> {
    if (this.#conferida) return Promise.resolve(true)
    if (this.#encerrada) return Promise.resolve(false)
    return new Promise((resolver) => this.#aguardando.add(resolver))
  }

  encerrar(): void {
    this.#encerrada = true
    clearTimeout(this.#nova)
    this.#nova = undefined
    for (const resolver of this.#aguardando) resolver(false)
    this.#aguardando.clear()
  }

  async #conferirEAgendar(): Promise<void> {
    const envio = this.#envio
    // Sem envio externo (o falso e o local) a instância já nasceu conferida e não há cadastro a ler; a guarda também estreita o tipo do envio.
    if (!envio.envioExterno || this.#encerrada) return
    const passou = await this.#conferirUma(envio.provedorId)
    // O desligamento pode ter chegado durante a leitura: a instância que encerrou não se declara conferida nem agenda outra conferência.
    if (this.#encerrada) return
    if (passou) {
      this.#conferida = true
      this.opcoes.logger.info({ evento: 'ia.soberania_conferida', provedorId: envio.provedorId })
      for (const resolver of this.#aguardando) resolver(true)
      this.#aguardando.clear()
      return
    }
    this.#nova = setTimeout(() => {
      this.#nova = undefined
      void this.#conferirEAgendar()
    }, this.#intervaloMs)
  }

  /** Uma leitura do cadastro e a conta dos motivos. Nunca lança: o banco fora é uma não conferência, com o log dele. */
  async #conferirUma(provedorId: string): Promise<boolean> {
    this.#tentativas += 1
    const tentativas = this.#tentativas
    let motivos: MotivoDaD62[]
    try {
      motivos = motivosDaD62(await this.opcoes.leitura.vigenteDoProvedor(provedorId), this.#exigidas)
    } catch (erro) {
      if (this.#deveAvisar('sem_banco')) this.opcoes.logger.warn({ evento: 'ia.soberania_na_subida_sem_banco', provedorId, tentativas, erro: summarizeError(erro) })
      return false
    }
    if (motivos.length === 0) return true
    // Os motivos são códigos fixos (`MotivoDaD62`), separados por vírgula: o que o operador procura no runbook.
    const codigo = motivos.join(',')
    if (this.#deveAvisar(codigo)) this.opcoes.logger.warn({ evento: 'ia.soberania_na_subida_recusada', provedorId, tentativas, codigo })
    return false
  }

  /** O primeiro aviso de cada motivo sai na hora, e o mesmo motivo repetido só de tempos em tempos: instância esperando o cadastro não enche o log. */
  #deveAvisar(motivo: string): boolean {
    if (motivo !== this.#ultimoMotivo) {
      this.#ultimoMotivo = motivo
      this.#repeticoes = 1
      return true
    }
    this.#repeticoes += 1
    return this.#repeticoes % REPETICAO_DO_LOG === 0
  }
}
