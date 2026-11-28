import { ErrorCode } from '@educa/shared'
import { registrarSaidaDaAba } from '../../api/atividades-do-aluno'
import { codigoDoErro } from '../../api/ciclo-de-execucao'
import { aoAbrirSessao, aoTrocarDeSessao } from '../../api/sessao'
import { esperaAntesDeTentar, esperaNaVoltaDaRede } from './respostas'

/**
 * A fila das saídas da aba durante a prova (D70; Tech Spec §5.8). **É própria, e em série**: a saída é um fato que o professor lê, e o servidor soma só com uma `chave`
 * nova. Cada saída nasce com a sua chave (uuid v4, sem horário: a saída não tem hora), e o reenvio da mesma saída leva a mesma chave, por isso a queda e o 5xx não a contam
 * duas vezes. Uma por vez, na ordem: a primeira que não chega segura as seguintes, e nenhuma é descartada na queda.
 *
 * **Não é a fila de respostas.** O limite de 30 por minuto da saída (429) vale só para ela: com o 429, esta fila espera o recuo, e a das respostas segue gravando.
 * Só a recusa que não passa com o tempo (`NAO_ENCONTRADO`: a prova já foi enviada ou não está em andamento; `ENTRADA_INVALIDA`) descarta a saída.
 *
 * Nada aqui é nota, destaque nem bloqueio (D70, D88): a tela não sabe a contagem, e o aluno é avisado antes de começar.
 */

/** Uma saída ainda não confirmada pelo servidor. */
export interface SaidaPendente {
  readonly chave: string
}

export interface FilaDeSaidas {
  /** O aluno saiu da aba: a saída entra no fim da fila, com chave nova, e é mandada se não há outra no ar. */
  readonly registrar: () => void
  /** Quantas saídas o servidor ainda não confirmou. */
  readonly pendentes: () => number
  /** Tenta agora: a sessão voltou. */
  readonly tryAgora: () => void
  /** A rede voltou: espera o sorteio, como a fila de respostas. */
  readonly redeVoltou: () => void
  /** A sessão acabou ou mudou de dono: nada mais sai. */
  readonly stop: () => void
}

interface PartesDaFilaDeSaidas {
  readonly send: (chave: string) => Promise<void>
  /** Sorteia a chave (uuid v4). No teste, uma sequência conhecida. */
  readonly novaChave?: () => string
  readonly agendar?: (funcao: () => void, esperaMs: number) => () => void
  readonly sortear?: () => number
}

function agendarNoRelogio(funcao: () => void, esperaMs: number): () => void {
  const relogio = setTimeout(funcao, esperaMs)
  return () => clearTimeout(relogio)
}

/** A recusa que não passa com o tempo: o servidor disse que esta saída não conta (prova enviada, ou fora de andamento). */
function recusadaDeVez(codigo: ErrorCode): boolean {
  return codigo === ErrorCode.NAO_ENCONTRADO || codigo === ErrorCode.ENTRADA_INVALIDA
}

export function createFilaDeSaidas({ send, novaChave = () => crypto.randomUUID(), agendar = agendarNoRelogio, sortear = Math.random }: PartesDaFilaDeSaidas): FilaDeSaidas {
  let fila: readonly SaidaPendente[] = []
  let noAr = false
  let tentativas = 0
  let parada = false
  let cancelarEspera: (() => void) | undefined

  function bombear(): void {
    cancelarEspera?.()
    cancelarEspera = undefined
    const proxima = fila[0]
    if (parada || noAr || proxima === undefined) return
    noAr = true
    send(proxima.chave).then(
      () => {
        if (parada) return
        noAr = false
        tentativas = 0
        fila = fila.filter((saida) => saida !== proxima)
        bombear()
      },
      (erro: unknown) => {
        if (parada) return
        noAr = false
        if (recusadaDeVez(codigoDoErro(erro))) {
          tentativas = 0
          fila = fila.filter((saida) => saida !== proxima)
          bombear()
          return
        }
        // A saída fica, com a mesma chave, e a seguinte espera atrás dela: a ordem não se troca.
        tentativas += 1
        cancelarEspera = agendar(bombear, esperaAntesDeTentar(tentativas))
      },
    )
  }

  return {
    registrar: () => {
      if (parada) return
      fila = [...fila, { chave: novaChave() }]
      // Com a saída da frente esperando o recuo, a nova entra atrás e espera com ela: a saída é rara, mas o 429 e a queda não se resolvem com mais tentativas.
      if (cancelarEspera === undefined) bombear()
    },
    pendentes: () => fila.length,
    tryAgora: bombear,
    redeVoltou: () => {
      if (parada || noAr || fila.length === 0) return
      cancelarEspera?.()
      cancelarEspera = agendar(bombear, esperaNaVoltaDaRede(sortear))
    },
    stop: () => {
      parada = true
      cancelarEspera?.()
      cancelarEspera = undefined
      fila = []
    },
  }
}

/**
 * Quando a aba perde o foco, e quando o recupera: **uma saída é do momento em que sai até o momento em que volta**. `visibilitychange` (a aba escondida) e `blur` (a janela sem foco)
 * costumam vir juntos na mesma saída, e contam uma vez; só depois de o foco voltar a próxima conta. Só durante a prova: quem usa isto o liga ao entrar nela e o desliga ao sair.
 */
export interface AlvoDaVigia {
  readonly janela: Pick<Window, 'addEventListener' | 'removeEventListener'>
  readonly documento: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
}

export function vigiarASaidaDaAba(aoSair: () => void, alvo: AlvoDaVigia = { janela: window, documento: document }): () => void {
  let fora = false
  const sair = (): void => {
    if (fora) return
    fora = true
    aoSair()
  }
  const voltar = (): void => {
    fora = false
  }
  const aoMudarAVisibilidade = (): void => (alvo.documento.visibilityState === 'hidden' ? sair() : voltar())
  alvo.documento.addEventListener('visibilitychange', aoMudarAVisibilidade)
  alvo.janela.addEventListener('blur', sair)
  alvo.janela.addEventListener('focus', voltar)
  return () => {
    alvo.documento.removeEventListener('visibilitychange', aoMudarAVisibilidade)
    alvo.janela.removeEventListener('blur', sair)
    alvo.janela.removeEventListener('focus', voltar)
  }
}

/** As filas desta aba, uma por prova. Só em memória: somem com a aba e com a sessão (o gancho abaixo; `ProvaEmFoco.test.tsx › o recomeço`, o caso da saída que não chegou, prova que a da primeira pessoa não sai com a sessão da segunda). */
const filas = new Map<string, FilaDeSaidas>()

aoTrocarDeSessao(() => {
  for (const fila of filas.values()) fila.stop()
  filas.clear()
})
aoAbrirSessao(() => {
  for (const fila of filas.values()) fila.tryAgora()
})
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    for (const fila of filas.values()) fila.redeVoltou()
  })
}

/** A fila de saídas da prova, criada na primeira vez que a tela a pede. */
export function filaDeSaidasDaProva(atividadeAplicadaId: string): FilaDeSaidas {
  const existente = filas.get(atividadeAplicadaId)
  if (existente !== undefined) return existente
  const fila = createFilaDeSaidas({ send: (chave) => registrarSaidaDaAba(atividadeAplicadaId, chave) })
  filas.set(atividadeAplicadaId, fila)
  return fila
}
