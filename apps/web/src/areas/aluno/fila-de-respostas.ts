import { type ProvaResponse, type QuestaoSalvaResponse, type RespostaSalva } from '@educa/shared'
import type { QueryClient } from '@tanstack/react-query'
import { responderQuestao, provaQueryOptions } from '../../api/atividades-do-aluno'
import { MINHAS_ATIVIDADES_QUERY_KEY } from '../../api/chaves-do-aluno'
import { estourouNoCliente } from '../../api/client'
import { codigoDoErro } from '../../api/ciclo-de-execucao'
import { euQueryOptions } from '../../api/eu'
import { esquecerEspelhosDeOutroDono, saveEspelho, readEspelho } from '../../api/espelho-da-fila'
import { aoAbrirSessao, aoTrocarDeSessao } from '../../api/sessao'
import { adotarLeitura, comecarEnvio, confirmarEnvio, escolher, esperaAntesDeTentar, falharEnvio, FILA_VAZIA, haOutraEsperando, hidratarDoEspelho, esperaNaVoltaDaRede, proximoEnvio, type EstadoDaFila } from './respostas'

/**
 * A fila de respostas de uma atividade, ligada à rede e ao relógio (regra 80, item 6). A regra é de `respostas.ts`; aqui
 * ela só é posta para andar: manda uma escolha por vez, e, se a gravação falha, **tenta de novo sozinha** depois de uma
 * espera, e na hora em que a rede ou a sessão voltam.
 *
 * Mora fora da tela, de propósito: o aluno que marca a alternativa e vai pedir ajuda ao Tutor não perde a escolha que
 * ainda estava sendo salva, e a gravação continua enquanto ele está em outra tela.
 */
export interface FilaDeRespostas {
  readonly read: () => EstadoDaFila
  readonly assinar: (ouvinte: () => void) => () => void
  /** O aluno marcou uma alternativa: entra na fila, com a `sequencia` seguinte, e é mandada. */
  readonly escolher: (questao: number, alternativa: number) => void
  /** A prova foi lida, ou o cache acertado: o que o servidor tem de mais novo que esta janela é adotado, com o aviso se a alternativa mudou. */
  readonly adotar: (lidas: readonly RespostaSalva[]) => void
  /** Tenta agora, sem esperar o relógio: a sessão voltou, o aluno pediu ("Tentar de novo") ou acabou de marcar. */
  readonly tryAgora: () => void
  /**
   * A rede voltou (`online`): **não manda na hora**. A rede da escola volta para a sala inteira no mesmo instante, e cada fila espera um sorteio de 0 a
   * `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` antes de tentar (regra 80, item 6). Sem nada a mandar, não faz nada; a espera do recuo que já estava marcada dá lugar ao sorteio.
   */
  readonly redeVoltou: () => void
  /**
   * Traz de volta o que o espelho guardou (o F5, a sessão vencida e o mesmo aluno voltando), **só se o dono é quem está
   * na sessão agora**, e manda. Sem saber quem é, não faz nada: chame de novo quando souber.
   */
  readonly hidratar: () => void
  /** A sessão acabou ou mudou de dono: nada mais sai, e o que estava na memória é esquecido. O espelho não é tocado aqui: quem o apaga é o "Sair". */
  readonly stop: () => void
}

interface PartesDaFila {
  readonly save: (questao: number, alternativa: number, sequencia: number) => Promise<QuestaoSalvaResponse>
  /** O servidor respondeu com o que ficou gravado (a escolha mandada, ou a mais nova de outra janela): a tela acerta o que ela lê como salvo. */
  readonly aoSalvar: (salva: QuestaoSalvaResponse) => void
  /** Chama a função depois da espera; devolve o cancelamento. No teste, um relógio que o teste adianta. */
  readonly agendar?: (funcao: () => void, esperaMs: number) => () => void
  /** O sorteio de 0 a 1 da volta da rede (`Math.random` em produção); o teste fixa o que quer. */
  readonly sortear?: () => number
  /**
   * O espelho em `sessionStorage` (53.0): de qual atividade é a fila, e quem é o aluno da sessão agora (`undefined`
   * enquanto não se sabe: nada é lido nem gravado). Sem isto, a fila vive só na memória.
   */
  readonly espelho?: { readonly atividade: string; readonly dono: () => string | undefined }
}

function agendarNoRelogio(funcao: () => void, esperaMs: number): () => void {
  const relogio = setTimeout(funcao, esperaMs)
  return () => clearTimeout(relogio)
}

export function createFilaDeRespostas({ save: salvar, aoSalvar, agendar = agendarNoRelogio, sortear = Math.random, espelho }: PartesDaFila): FilaDeRespostas {
  let estado = FILA_VAZIA
  let parada = false
  let cancelarEspera: (() => void) | undefined
  const ouvintes = new Set<() => void>()

  /** O espelho acompanha as pendentes, só com o aluno da sessão conhecido. A fila parada não o toca. */
  function refletir(): void {
    if (parada || espelho === undefined) return
    const dono = espelho.dono()
    if (dono !== undefined) saveEspelho(dono, espelho.atividade, estado.pendentes)
  }

  function publish(novo: EstadoDaFila): void {
    if (novo === estado) return
    const mudouAFila = novo.pendentes !== estado.pendentes
    estado = novo
    if (mudouAFila) refletir()
    for (const ouvinte of ouvintes) ouvinte()
  }

  function bombear(): void {
    cancelarEspera?.()
    cancelarEspera = undefined
    if (parada) return
    const proximo = proximoEnvio(estado)
    if (proximo === undefined) return
    publish(comecarEnvio(estado))
    salvar(proximo.questao, proximo.alternativa, proximo.sequencia).then(
      (salva) => {
        if (parada) return
        aoSalvar(salva)
        // Se o servidor tinha uma mais nova, a escolha sai da fila sem ser reenviada: a tela já mostra a gravada.
        publish(confirmarEnvio(estado, salva))
        bombear()
      },
      (erro: unknown) => {
        if (parada) return
        const codigo = codigoDoErro(erro)
        publish(falharEnvio(estado, codigo))
        // O prazo do cliente estourou (a rede pendurou, e não a API recusou): a pendurada foi para o fim da fila, e a seguinte sai já.
        // O `TEMPO_ESGOTADO` que a API devolve (503 do `statement_timeout`, 408, 504) passa pelo recuo com jitter: mandar a seguinte
        // na hora, a cada recusa rápida, faria cada aluno martelar o banco sobrecarregado a cada 2 s.
        if (estourouNoCliente(erro) && haOutraEsperando(estado)) return bombear()
        // Só a falha que passa sozinha é tentada de novo pelo relógio; a escolha fica na fila em qualquer uma.
        if (estado.falha === 'passageira') cancelarEspera = agendar(bombear, esperaAntesDeTentar(estado.tentativas))
      },
    )
  }

  return {
    read: () => estado,
    assinar: (ouvinte) => {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    escolher: (questao, alternativa) => {
      if (parada) return
      publish(escolher(estado, questao, alternativa))
      bombear()
    },
    adotar: (lidas) => {
      if (parada) return
      publish(adotarLeitura(estado, lidas))
    },
    tryAgora: bombear,
    redeVoltou: () => {
      if (parada || proximoEnvio(estado) === undefined) return
      cancelarEspera?.()
      cancelarEspera = agendar(bombear, esperaNaVoltaDaRede(sortear))
    },
    hidratar: () => {
      if (parada || espelho === undefined) return
      const dono = espelho.dono()
      if (dono === undefined) return
      // Quem sentou depois não herda, nem deixa ao alcance, a escolha da pessoa anterior.
      esquecerEspelhosDeOutroDono(dono)
      publish(hidratarDoEspelho(estado, readEspelho(dono, espelho.atividade)))
      // O `publicar` acima já espelha o que a hidratação trouxe. Esta chamada é para o caso em que ela não trouxe nada: o que o
      // aluno marcou antes de se saber quem ele é só entra no espelho agora.
      refletir()
      bombear()
    },
    stop: () => {
      parada = true
      cancelarEspera?.()
      cancelarEspera = undefined
      publish(FILA_VAZIA)
    },
  }
}

/**
 * A prova no cache com a resposta que o servidor acabou de dizer ter gravada: é dela que a tela lê "Resposta salva". A
 * resposta que chega **atrasada**, com `sequencia` menor que a que o cache já tem (uma leitura mais nova passou na
 * frente), não a troca.
 */
export function provaComRespostaSalva(prova: ProvaResponse, salva: Pick<QuestaoSalvaResponse, 'questao' | 'alternativa' | 'sequencia'>): ProvaResponse {
  const atual = prova.respostas.find((resposta) => resposta.questao === salva.questao)
  if (atual !== undefined && atual.sequencia > salva.sequencia) return prova
  return { ...prova, respostas: [...prova.respostas.filter((resposta) => resposta.questao !== salva.questao), { questao: salva.questao, alternativa: salva.alternativa, sequencia: salva.sequencia }] }
}

/** As filas desta aba, uma por atividade. Só em memória: some com a aba e com a sessão. */
const filas = new Map<string, FilaDeRespostas>()

function tryTodas(): void {
  for (const fila of filas.values()) fila.tryAgora()
}

function redeVoltouEmTodas(): void {
  for (const fila of filas.values()) fila.redeVoltou()
}

/** Quem acompanha as filas de **todas** as atividades (a lista "Tarefas" diz quantas respostas ainda não chegaram, mesmo depois do "Sair da prova"). */
const ouvintesDasFilas = new Set<() => void>()

export function assinarAsFilas(ouvinte: () => void): () => void {
  ouvintesDasFilas.add(ouvinte)
  return () => {
    ouvintesDasFilas.delete(ouvinte)
  }
}

/**
 * Quantas respostas da atividade o servidor ainda não confirmou: 0 sem fila. É um número, e por isso serve de retrato estável para `useSyncExternalStore`.
 * **Lê a fila pelo `atividadeAplicadaId`, sem conferir o dono da sessão** (regra 10, item 4): só está certo porque `aoTrocarDeSessao`, logo abaixo, esvazia as filas quando a sessão acaba. Quem mexer nessa limpeza mexe aqui.
 */
export function respostasQueNaoChegaram(atividadeAplicadaId: string): number {
  return filas.get(atividadeAplicadaId)?.read().pendentes.length ?? 0
}

// A pessoa seguinte no Chromebook do carrinho não herda a escolha da anterior, e nada da anterior é mandado com a sessão dela.
// Só a memória sai aqui: o espelho acompanha o fim da sessão no gancho de `api/espelho-da-fila.ts`, que não depende desta tela.
aoTrocarDeSessao(() => {
  for (const fila of filas.values()) fila.stop()
  filas.clear()
  for (const ouvinte of ouvintesDasFilas) ouvinte()
})
// A sessão voltou (o login por cima, a renovação): o que ficou esperando sai agora.
aoAbrirSessao(tryTodas)
// A rede voltou: cada fila espera o sorteio dela, e a sala inteira não reenvia no mesmo segundo.
if (typeof window !== 'undefined') window.addEventListener('online', redeVoltouEmTodas)

/** A fila da atividade, criada na primeira vez que a tela a pede. */
export function filaDaAtividade(cliente: QueryClient, atividadeAplicadaId: string): FilaDeRespostas {
  const existente = filas.get(atividadeAplicadaId)
  if (existente !== undefined) return existente
  const fila = createFilaDeRespostas({
    save: (questao, alternativa, sequencia) => responderQuestao(atividadeAplicadaId, questao, alternativa, sequencia),
    // Quem é o aluno vem do `/v1/eu` desta sessão, no cache: ele sai com a troca de sessão, ao contrário do que a aba lembra.
    espelho: { atividade: atividadeAplicadaId, dono: () => cliente.getQueryData(euQueryOptions.queryKey)?.usuarioId },
    aoSalvar: (salva) => {
      cliente.setQueryData(provaQueryOptions(atividadeAplicadaId).queryKey, (prova) => (prova === undefined ? prova : provaComRespostaSalva(prova, salva)))
      // A lista de atividades conta as respondidas: ela é lida de novo quando o aluno voltar a ela.
      void cliente.invalidateQueries({ queryKey: MINHAS_ATIVIDADES_QUERY_KEY, refetchType: 'none' })
    },
  })
  filas.set(atividadeAplicadaId, fila)
  fila.assinar(() => {
    for (const ouvinte of ouvintesDasFilas) ouvinte()
  })
  return fila
}
