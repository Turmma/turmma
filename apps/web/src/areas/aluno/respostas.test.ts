import { ErrorCode, type QuestaoSalvaResponse } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroDaApi } from '../../api/client'
import { criarFilaDeRespostas, provaComRespostaSalva } from './fila-de-respostas'
import { adotarLeitura, alteradaEmOutraJanela, comecarEnvio, confirmarEnvio, escolher, esperaAntesDeTentar, falharEnvio, FILA_VAZIA, hidratarDoEspelho, MAIOR_ESPERA_DA_FILA_MS, proximoEnvio, tipoDaFalha, type EstadoDaFila } from './respostas'

/** A confirmação do servidor de uma escolha que ele gravou como veio. */
const gravada = (questao: number, alternativa: number, sequencia: number) => ({ questao, alternativa, sequencia })

/** O sorteio do jitter parado no meio: 0,5 dá a espera exata (100 %). */
const semJitter = () => vi.spyOn(Math, 'random').mockReturnValue(0.5)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a fila das respostas ainda não salvas (regra 80, item 6)', () => {
  it('a escolha entra na fila na hora, e a última escolha da mesma questão é a que vale', () => {
    const umaVez = escolher(FILA_VAZIA, 3, 1)
    expect(umaVez.pendentes).toEqual([{ questao: 3, alternativa: 1, sequencia: 1 }])
    const trocada = escolher(escolher(umaVez, 1, 0), 3, 2)
    expect(trocada.pendentes).toEqual([{ questao: 1, alternativa: 0, sequencia: 1 }, { questao: 3, alternativa: 2, sequencia: 2 }])
  })

  it('manda uma por vez, a mais antiga primeiro', () => {
    const duas = escolher(escolher(FILA_VAZIA, 3, 1), 1, 0)
    expect(proximoEnvio(duas)).toEqual({ questao: 3, alternativa: 1, sequencia: 1 })
    const noAr = comecarEnvio(duas)
    expect(noAr.noAr).toEqual({ questao: 3, alternativa: 1, sequencia: 1 })
    expect(proximoEnvio(noAr)).toBeUndefined()
    const confirmada = confirmarEnvio(noAr, gravada(3, 1, 1))
    expect(confirmada.pendentes).toEqual([{ questao: 1, alternativa: 0, sequencia: 1 }])
    expect(proximoEnvio(confirmada)).toEqual({ questao: 1, alternativa: 0, sequencia: 1 })
  })

  it('a gravação que falha NÃO tira a escolha da fila, e a escolha que sai de novo leva a mesma sequência', () => {
    const noAr = comecarEnvio(escolher(FILA_VAZIA, 3, 1))
    const falhou = falharEnvio(noAr, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(falhou.pendentes).toEqual([{ questao: 3, alternativa: 1, sequencia: 1 }])
    expect(falhou).toMatchObject({ noAr: undefined, falha: 'passageira', tentativas: 1 })
    // E volta a ser a próxima a sair, com a mesma `sequencia`: o servidor grava uma vez só.
    expect(proximoEnvio(falhou)).toEqual({ questao: 3, alternativa: 1, sequencia: 1 })
    // Falhar não esquece o que a janela sabe: a escolha seguinte sai uma acima.
    expect(escolher(falhou, 3, 2).pendentes).toEqual([{ questao: 3, alternativa: 2, sequencia: 2 }])
  })

  it('quem troca de alternativa enquanto a anterior é salva continua com a nova na fila', () => {
    const noAr = comecarEnvio(escolher(FILA_VAZIA, 3, 1))
    const trocouNoMeio = escolher(noAr, 3, 2)
    const confirmada = confirmarEnvio(trocouNoMeio, gravada(3, 1, 1))
    expect(confirmada.pendentes).toEqual([{ questao: 3, alternativa: 2, sequencia: 2 }])
    // O que o servidor acabou de gravar (sequência 1) não faz a janela esquecer que já mandou a 2.
    expect(confirmada.conhecidas[3]).toEqual({ alternativa: 2, sequencia: 2 })
    expect(confirmada.alteradas).toEqual([])
  })

  it('com a atividade encerrada a fila para, guarda o que não foi salvo e não aceita escolha nova', () => {
    const encerrada = falharEnvio(comecarEnvio(escolher(FILA_VAZIA, 3, 1)), ErrorCode.ATIVIDADE_ENCERRADA)
    expect(encerrada).toMatchObject({ falha: 'encerrada', pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }] })
    expect(proximoEnvio(encerrada)).toBeUndefined()
    expect(escolher(encerrada, 1, 0)).toBe(encerrada)
  })

  it('só o encerramento e a recusa que não passa com o tempo param a fila; o resto é tentado de novo', () => {
    expect(tipoDaFalha(ErrorCode.ATIVIDADE_ENCERRADA)).toBe('encerrada')
    expect(tipoDaFalha(ErrorCode.NAO_ENCONTRADO)).toBe('recusada')
    for (const codigo of [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, ErrorCode.TEMPO_ESGOTADO, ErrorCode.ERRO_INTERNO, ErrorCode.LIMITE_EXCEDIDO, ErrorCode.NAO_AUTENTICADO]) expect(tipoDaFalha(codigo), codigo).toBe('passageira')
    // Depois de uma recusa, a escolha nova tenta de novo.
    const recusada = falharEnvio(comecarEnvio(escolher(FILA_VAZIA, 3, 1)), ErrorCode.NAO_ENCONTRADO)
    expect(proximoEnvio(recusada)).toBeUndefined()
    expect(proximoEnvio(escolher(recusada, 3, 2))).toEqual({ questao: 3, alternativa: 2, sequencia: 2 })
  })

  it('a espera entre as tentativas cresce e tem teto: a escola inteira atrás da mesma rede não martela a API', () => {
    semJitter()
    expect([1, 2, 3, 4, 9].map(esperaAntesDeTentar)).toEqual([2_000, 4_000, 8_000, MAIOR_ESPERA_DA_FILA_MS, MAIOR_ESPERA_DA_FILA_MS])
  })

  it('o jitter deixa a espera entre 75 % e 125 % da base, e nunca passa do teto (53.4)', () => {
    const sorteio = vi.spyOn(Math, 'random')
    // Sorteio no piso, no meio e no teto, nas três primeiras esperas e na do teto (15 s).
    const esperas = (valor: number) => {
      sorteio.mockReturnValue(valor)
      return [1, 2, 3, 9].map(esperaAntesDeTentar)
    }
    expect(esperas(0)).toEqual([1_500, 3_000, 6_000, 11_250])
    expect(esperas(0.5)).toEqual([2_000, 4_000, 8_000, 15_000])
    // 125 % de 2 s, 4 s e 8 s; no teto, 125 % de 15 s seria 18,75 s, e fica em 15 s.
    expect(esperas(1)).toEqual([2_500, 5_000, 10_000, MAIOR_ESPERA_DA_FILA_MS])
    // Duas alunas que falharam no mesmo instante não voltam no mesmo instante.
    sorteio.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9)
    expect(esperaAntesDeTentar(3)).not.toBe(esperaAntesDeTentar(3))
  })

  it('a pendente que o espelho guardou volta à fila, com a mesma sequência, antes das que já estavam; o que o servidor já tem não volta', () => {
    const guardadas = [{ questao: 3, alternativa: 1, sequencia: 4 }, { questao: 5, alternativa: 0, sequencia: 2 }]
    expect(hidratarDoEspelho(FILA_VAZIA, guardadas)).toMatchObject({ pendentes: guardadas, conhecidas: { 3: { alternativa: 1, sequencia: 4 }, 5: { alternativa: 0, sequencia: 2 } } })
    // A aluna já marcou a questão 3 de novo antes de a fila saber quem ela é: a escolha dela é a mais nova e fica.
    const jaMarcou = escolher(FILA_VAZIA, 3, 2)
    expect(hidratarDoEspelho(jaMarcou, guardadas).pendentes).toEqual([{ questao: 5, alternativa: 0, sequencia: 2 }, { questao: 3, alternativa: 2, sequencia: 1 }])
    // A leitura da prova chegou primeiro: o servidor tem a 3 com sequência 4 (igual) e a 5 com 7 (maior). Nenhuma das duas volta.
    const lida = adotarLeitura(FILA_VAZIA, [{ questao: 3, alternativa: 1, sequencia: 4 }, { questao: 5, alternativa: 3, sequencia: 7 }])
    expect(hidratarDoEspelho(lida, guardadas)).toBe(lida)
  })
})

describe('só a escolha mais nova vale: a sequência manda max(local, servidor) + 1 (RF21)', () => {
  /** Uma janela que já mandou duas escolhas na questão 2 (a conhecida é a 2) e as viu salvas. */
  const janelaNaSequencia2 = (): EstadoDaFila => {
    const primeira = confirmarEnvio(comecarEnvio(escolher(FILA_VAZIA, 2, 0)), gravada(2, 0, 1))
    return confirmarEnvio(comecarEnvio(escolher(primeira, 2, 1)), gravada(2, 1, 2))
  }

  it('depois de uma leitura que traz uma sequência maior que a local, a escolha nova sai uma acima da do servidor', () => {
    const lida = adotarLeitura(janelaNaSequencia2(), [{ questao: 2, alternativa: 3, sequencia: 5 }])
    expect(escolher(lida, 2, 0).pendentes).toEqual([{ questao: 2, alternativa: 0, sequencia: 6 }])
  })

  it('uma leitura atrasada, com sequência menor que a local, não faz a janela recuar', () => {
    const lida = adotarLeitura(janelaNaSequencia2(), [{ questao: 2, alternativa: 3, sequencia: 1 }])
    expect(lida.conhecidas[2]).toEqual({ alternativa: 1, sequencia: 2 })
    expect(escolher(lida, 2, 0).pendentes).toEqual([{ questao: 2, alternativa: 0, sequencia: 3 }])
  })

  it('a primeira escolha de uma questão que o servidor nunca viu sai com a sequência 1; cada questão tem a sua conta', () => {
    const duas = escolher(escolher(FILA_VAZIA, 1, 0), 4, 2)
    expect(duas.pendentes).toEqual([{ questao: 1, alternativa: 0, sequencia: 1 }, { questao: 4, alternativa: 2, sequencia: 1 }])
    const lida = adotarLeitura(FILA_VAZIA, [{ questao: 1, alternativa: 2, sequencia: 9 }])
    expect(escolher(lida, 4, 1).pendentes).toEqual([{ questao: 4, alternativa: 1, sequencia: 1 }])
  })

  it('a aba que perde adota a gravada, não manda nada, avisa; o clique seguinte sai com servidor + 1 e o aviso some', () => {
    // Esta janela mandou a escolha 3 (sequência 3); a outra janela já tinha gravado a sequência 8, com outra alternativa.
    const noAr = comecarEnvio(escolher(janelaNaSequencia2(), 2, 3))
    expect(noAr.noAr).toEqual({ questao: 2, alternativa: 3, sequencia: 3 })
    const perdeu = confirmarEnvio(noAr, gravada(2, 0, 8))
    expect(perdeu.pendentes).toEqual([])
    expect(proximoEnvio(perdeu)).toBeUndefined()
    expect(perdeu.alteradas).toEqual([2])
    expect(alteradaEmOutraJanela(perdeu, 2)).toBe(true)
    expect(alteradaEmOutraJanela(perdeu, 1)).toBe(false)
    expect(perdeu.conhecidas[2]).toEqual({ alternativa: 0, sequencia: 8 })
    const depois = escolher(perdeu, 2, 1)
    expect(depois.pendentes).toEqual([{ questao: 2, alternativa: 1, sequencia: 9 }])
    expect(depois.alteradas).toEqual([])
  })

  it('duas abas que leram a mesma sequência: a que o servidor recusa recebe a alternativa da outra e avisa, mesmo com a sequência igual', () => {
    const noAr = comecarEnvio(escolher(FILA_VAZIA, 1, 3))
    const perdeu = confirmarEnvio(noAr, gravada(1, 0, 1))
    expect(perdeu.pendentes).toEqual([])
    expect(perdeu.alteradas).toEqual([1])
    expect(perdeu.conhecidas[1]).toEqual({ alternativa: 0, sequencia: 1 })
  })

  it('o servidor com a mesma alternativa e uma sequência maior (outra janela marcou a mesma depois) também faz a aba perder: adota a sequência e avisa', () => {
    const perdeu = confirmarEnvio(comecarEnvio(escolher(FILA_VAZIA, 1, 3)), gravada(1, 3, 8))
    expect(perdeu.pendentes).toEqual([])
    expect(perdeu.alteradas).toEqual([1])
    expect(perdeu.conhecidas[1]).toEqual({ alternativa: 3, sequencia: 8 })
  })

  it('a escolha que o servidor grava como veio não avisa nada; e a que perdeu num momento em que a pessoa já clicou de novo fica na fila, sem aviso', () => {
    const ganhou = confirmarEnvio(comecarEnvio(escolher(FILA_VAZIA, 1, 3)), gravada(1, 3, 1))
    expect(ganhou.alteradas).toEqual([])
    expect(ganhou.pendentes).toEqual([])
    // Clicou de novo (sequência 2) com a primeira no ar, e a primeira perdeu: a segunda segue na fila, e o servidor decide por ela.
    const clicouDeNovo = escolher(comecarEnvio(escolher(FILA_VAZIA, 1, 3)), 1, 2)
    const perdeuMasHaNova = confirmarEnvio(clicouDeNovo, gravada(1, 0, 7))
    expect(perdeuMasHaNova.pendentes).toEqual([{ questao: 1, alternativa: 2, sequencia: 2 }])
    expect(perdeuMasHaNova.alteradas).toEqual([])
    expect(proximoEnvio(perdeuMasHaNova)).toEqual({ questao: 1, alternativa: 2, sequencia: 2 })
  })

  it('a escolha feita enquanto um envio que vai perder está no ar sai com a sequência que a aba conhecia, perde também, avisa, e o clique seguinte vence', () => {
    // A outra janela já gravou a sequência 7; esta só conhecia a 0 e mandou a escolha 3 (sequência 1).
    const primeiro = comecarEnvio(escolher(FILA_VAZIA, 1, 3))
    // Com ela no ar, a pessoa clica de novo (alternativa 2): sai com a sequência que a aba conhecia, a 2.
    const clicouDeNovo = escolher(primeiro, 1, 2)
    // A primeira perde: a nova segue na fila, sem aviso, porque ainda não se sabe que ela também perde.
    const primeiraPerdeu = confirmarEnvio(clicouDeNovo, gravada(1, 0, 7))
    expect(primeiraPerdeu.pendentes).toEqual([{ questao: 1, alternativa: 2, sequencia: 2 }])
    expect(alteradaEmOutraJanela(primeiraPerdeu, 1)).toBe(false)
    // A nova sai e perde também (2 < 7): o servidor devolve a gravada, o aviso aparece e a fila esvazia, sem reenviar.
    const segunda = comecarEnvio(primeiraPerdeu)
    expect(segunda.noAr).toEqual({ questao: 1, alternativa: 2, sequencia: 2 })
    const segundaPerdeu = confirmarEnvio(segunda, gravada(1, 0, 7))
    expect(segundaPerdeu.pendentes).toEqual([])
    expect(proximoEnvio(segundaPerdeu)).toBeUndefined()
    expect(alteradaEmOutraJanela(segundaPerdeu, 1)).toBe(true)
    expect(segundaPerdeu.conhecidas[1]).toEqual({ alternativa: 0, sequencia: 7 })
    // O clique seguinte sai uma acima da do servidor, vence, e o aviso some.
    const seguinte = escolher(segundaPerdeu, 1, 1)
    expect(seguinte.pendentes).toEqual([{ questao: 1, alternativa: 1, sequencia: 8 }])
    expect(alteradaEmOutraJanela(seguinte, 1)).toBe(false)
    const venceu = confirmarEnvio(comecarEnvio(seguinte), gravada(1, 1, 8))
    expect(venceu.alteradas).toEqual([])
    expect(venceu.conhecidas[1]).toEqual({ alternativa: 1, sequencia: 8 })
  })

  it('a aba que venceu mostra a sua até a leitura seguinte, e então adota a do servidor com o mesmo aviso', () => {
    const venceu = janelaNaSequencia2()
    expect(venceu.alteradas).toEqual([])
    // A leitura traz a mesma escolha, com a mesma sequência: nada a avisar nem a mudar.
    expect(adotarLeitura(venceu, [{ questao: 2, alternativa: 1, sequencia: 2 }])).toBe(venceu)
    // Mesma alternativa, sequência maior: outra janela gravou depois. A janela adota, e a regra de avisar é a mesma de quem perde.
    const mesmaAlternativa = adotarLeitura(venceu, [{ questao: 2, alternativa: 1, sequencia: 4 }])
    expect(mesmaAlternativa.alteradas).toEqual([2])
    expect(mesmaAlternativa.conhecidas[2]).toEqual({ alternativa: 1, sequencia: 4 })
    // Traz outra alternativa com sequência maior: adota e avisa.
    const outra = adotarLeitura(venceu, [{ questao: 2, alternativa: 3, sequencia: 4 }])
    expect(outra.alteradas).toEqual([2])
    expect(outra.conhecidas[2]).toEqual({ alternativa: 3, sequencia: 4 })
    expect(escolher(outra, 2, 0).pendentes).toEqual([{ questao: 2, alternativa: 0, sequencia: 5 }])
  })

  it('a leitura não passa por cima da escolha que ainda está na fila, e a primeira leitura da janela não avisa', () => {
    const naFila = escolher(janelaNaSequencia2(), 2, 3)
    const lida = adotarLeitura(naFila, [{ questao: 2, alternativa: 0, sequencia: 9 }])
    expect(lida).toBe(naFila)
    const primeira = adotarLeitura(FILA_VAZIA, [{ questao: 2, alternativa: 0, sequencia: 9 }, { questao: 4, alternativa: 2, sequencia: 1 }])
    expect(primeira.alteradas).toEqual([])
    expect(primeira.conhecidas).toEqual({ 2: { alternativa: 0, sequencia: 9 }, 4: { alternativa: 2, sequencia: 1 } })
  })
})

/**
 * Um servidor de mentira: cada gravação fica esperando o teste dizer se deu certo. `aceitar` grava como veio;
 * `gravadaPorOutraJanela` responde com uma escolha mais nova, que não é a mandada.
 */
function servidorDeMentira() {
  const chamadas: { questao: number; alternativa: number; sequencia: number; aceitar: () => void; gravadaPorOutraJanela: (alternativa: number, sequencia: number) => void; recusar: (codigo: ErrorCode) => void }[] = []
  const salvar = (questao: number, alternativa: number, sequencia: number): Promise<QuestaoSalvaResponse> =>
    new Promise((resolver, rejeitar) => {
      chamadas.push({
        questao,
        alternativa,
        sequencia,
        aceitar: () => resolver({ questao, alternativa, sequencia, respondidaEm: '2026-10-05T13:10:00.000Z' }),
        gravadaPorOutraJanela: (outraAlternativa, outraSequencia) => resolver({ questao, alternativa: outraAlternativa, sequencia: outraSequencia, respondidaEm: '2026-10-05T13:10:00.000Z' }),
        recusar: (codigo) => rejeitar(new ErroDaApi(codigo)),
      })
    })
  return { chamadas, salvar }
}

/** Um relógio de mentira: guarda o que foi agendado, e o teste dispara. */
function relogioDeMentira() {
  const agendados: { funcao: () => void; esperaMs: number; cancelado: boolean }[] = []
  const agendar = (funcao: () => void, esperaMs: number) => {
    const item = { funcao, esperaMs, cancelado: false }
    agendados.push(item)
    return () => {
      item.cancelado = true
    }
  }
  return { agendados, agendar }
}

const assentar = () => new Promise<void>((resolver) => setTimeout(resolver, 0))

describe('o reenvio das respostas', () => {
  it('a resposta que falha ao salvar continua marcada e é mandada de novo sozinha, com a mesma escolha, até o servidor confirmar', async () => {
    semJitter()
    const servidor = servidorDeMentira()
    const relogio = relogioDeMentira()
    const salvas: QuestaoSalvaResponse[] = []
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: (salva) => salvas.push(salva), agendar: relogio.agendar })

    fila.escolher(3, 1)
    expect(servidor.chamadas).toHaveLength(1)
    servidor.chamadas[0]?.recusar(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await assentar()
    // Falhou: a escolha fica, nada foi dado como salvo, e a tentativa seguinte está agendada.
    expect(fila.ler()).toMatchObject({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }], falha: 'passageira', tentativas: 1 })
    expect(salvas).toEqual([])
    expect(relogio.agendados.map((item) => item.esperaMs)).toEqual([2_000])

    // O relógio dispara: a mesma escolha sai de novo, e falha de novo, com a espera maior.
    relogio.agendados[0]?.funcao()
    // A mesma escolha, com a mesma `sequencia`: o servidor grava uma vez só, por mais que o reenvio chegue.
    expect(servidor.chamadas[1]).toMatchObject({ questao: 3, alternativa: 1, sequencia: 1 })
    servidor.chamadas[1]?.recusar(ErrorCode.TEMPO_ESGOTADO)
    await assentar()
    expect(relogio.agendados.map((item) => item.esperaMs)).toEqual([2_000, 4_000])

    // A rota voltou: a tentativa seguinte é aceita, a fila esvazia, e só agora a resposta conta como salva.
    relogio.agendados[1]?.funcao()
    servidor.chamadas[2]?.aceitar()
    await assentar()
    expect(fila.ler()).toMatchObject({ pendentes: [], noAr: undefined, falha: undefined, alteradas: [] })
    expect(salvas).toEqual([{ questao: 3, alternativa: 1, sequencia: 1, respondidaEm: '2026-10-05T13:10:00.000Z' }])
    expect(servidor.chamadas).toHaveLength(3)
    expect(servidor.chamadas.map((chamada) => chamada.sequencia)).toEqual([1, 1, 1])
  })

  it('"tentar agora" (a rede voltou, a sessão voltou) não espera o relógio, e cancela a espera para não mandar duas vezes', async () => {
    const servidor = servidorDeMentira()
    const relogio = relogioDeMentira()
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: () => undefined, agendar: relogio.agendar })
    fila.escolher(1, 0)
    servidor.chamadas[0]?.recusar(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await assentar()
    fila.tentarAgora()
    expect(servidor.chamadas).toHaveLength(2)
    expect(relogio.agendados[0]?.cancelado).toBe(true)
    // Com um envio no ar, pedir de novo não manda outro.
    fila.tentarAgora()
    expect(servidor.chamadas).toHaveLength(2)
  })

  it('a escolha feita com a rede fora entra atrás das que já esperavam, e todas saem quando a rota volta, uma por vez', async () => {
    const servidor = servidorDeMentira()
    const relogio = relogioDeMentira()
    const salvas: number[] = []
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: (salva) => salvas.push(salva.questao), agendar: relogio.agendar })
    fila.escolher(1, 0)
    servidor.chamadas[0]?.recusar(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await assentar()
    // O aluno continua respondendo sem rede: a escolha nova tenta na hora (e a questão 1 continua na frente).
    fila.escolher(2, 3)
    expect(servidor.chamadas[1]).toMatchObject({ questao: 1, alternativa: 0, sequencia: 1 })
    servidor.chamadas[1]?.aceitar()
    await assentar()
    expect(servidor.chamadas[2]).toMatchObject({ questao: 2, alternativa: 3, sequencia: 1 })
    servidor.chamadas[2]?.aceitar()
    await assentar()
    expect(salvas).toEqual([1, 2])
    expect(fila.ler()).toMatchObject({ pendentes: [], noAr: undefined, falha: undefined })
  })

  it('com a atividade encerrada pelo servidor, a fila não tenta de novo', async () => {
    const servidor = servidorDeMentira()
    const relogio = relogioDeMentira()
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: () => undefined, agendar: relogio.agendar })
    fila.escolher(3, 1)
    servidor.chamadas[0]?.recusar(ErrorCode.ATIVIDADE_ENCERRADA)
    await assentar()
    expect(fila.ler()).toMatchObject({ falha: 'encerrada', pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }] })
    expect(relogio.agendados).toEqual([])
    fila.tentarAgora()
    fila.escolher(1, 0)
    expect(servidor.chamadas).toHaveLength(1)
  })

  it('a sessão que acaba esvazia a fila: nada da pessoa anterior é mandado nem mostrado à seguinte', async () => {
    const servidor = servidorDeMentira()
    const relogio = relogioDeMentira()
    const salvas: QuestaoSalvaResponse[] = []
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: (salva) => salvas.push(salva), agendar: relogio.agendar })
    fila.escolher(3, 1)
    fila.parar()
    expect(fila.ler()).toEqual(FILA_VAZIA)
    // A resposta que volta depois não mexe em nada, e nenhuma escolha nova sai.
    servidor.chamadas[0]?.aceitar()
    await assentar()
    fila.escolher(1, 0)
    expect(salvas).toEqual([])
    expect(servidor.chamadas).toHaveLength(1)
  })

  it('o envio que perdeu para uma escolha mais nova de outra janela não é reenviado: a fila esvazia, a tela acerta a gravada e avisa', async () => {
    const servidor = servidorDeMentira()
    const relogio = relogioDeMentira()
    const salvas: QuestaoSalvaResponse[] = []
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: (salva) => salvas.push(salva), agendar: relogio.agendar })
    fila.escolher(3, 1)
    servidor.chamadas[0]?.gravadaPorOutraJanela(2, 8)
    await assentar()
    // Nada foi reenviado, nada ficou na fila, e o que o servidor gravou é o que a tela passa a ler.
    expect(servidor.chamadas).toHaveLength(1)
    expect(relogio.agendados).toEqual([])
    expect(salvas).toEqual([{ questao: 3, alternativa: 2, sequencia: 8, respondidaEm: '2026-10-05T13:10:00.000Z' }])
    expect(fila.ler()).toMatchObject({ pendentes: [], noAr: undefined, falha: undefined, alteradas: [3] })
    // O clique seguinte sai com `servidor + 1` e vence.
    fila.escolher(3, 0)
    expect(servidor.chamadas[1]).toMatchObject({ questao: 3, alternativa: 0, sequencia: 9 })
    servidor.chamadas[1]?.aceitar()
    await assentar()
    expect(fila.ler()).toMatchObject({ pendentes: [], alteradas: [] })
  })

  it('a leitura da prova com uma escolha mais nova (a aba que venceu) é adotada com o aviso, e a escolha nova sai uma acima', async () => {
    const servidor = servidorDeMentira()
    const fila = criarFilaDeRespostas({ salvar: servidor.salvar, aoSalvar: () => undefined, agendar: relogioDeMentira().agendar })
    fila.escolher(1, 0)
    servidor.chamadas[0]?.aceitar()
    await assentar()
    fila.adotar([{ questao: 1, alternativa: 3, sequencia: 6 }])
    expect(fila.ler()).toMatchObject({ alteradas: [1], conhecidas: { 1: { alternativa: 3, sequencia: 6 } } })
    fila.escolher(1, 2)
    expect(servidor.chamadas[1]).toMatchObject({ questao: 1, alternativa: 2, sequencia: 7 })
    // Parada a fila, a leitura não muda mais nada.
    fila.parar()
    fila.adotar([{ questao: 1, alternativa: 0, sequencia: 20 }])
    expect(fila.ler()).toEqual(FILA_VAZIA)
  })

  it('a resposta confirmada entra na prova lida, no lugar da anterior da mesma questão', () => {
    const prova = { atividadeAplicadaId: 'x', titulo: 't', avaliativa: false, estado: 'aberta' as const, adaptacao: null, questoes: [], respostas: [{ questao: 1, alternativa: 0, sequencia: 2 }, { questao: 2, alternativa: 2, sequencia: 1 }], enviadaEm: null }
    expect(provaComRespostaSalva(prova, { questao: 1, alternativa: 3, sequencia: 3 }).respostas).toEqual([{ questao: 2, alternativa: 2, sequencia: 1 }, { questao: 1, alternativa: 3, sequencia: 3 }])
    // A confirmada que chega atrasada, com sequência menor que a do cache, não a troca.
    expect(provaComRespostaSalva(prova, { questao: 1, alternativa: 3, sequencia: 1 })).toBe(prova)
    // A de mesma sequência troca: é o servidor dizendo o que ficou gravado.
    expect(provaComRespostaSalva(prova, { questao: 1, alternativa: 1, sequencia: 2 }).respostas).toContainEqual({ questao: 1, alternativa: 1, sequencia: 2 })
    // Questão que ainda não tinha resposta no cache: entra.
    expect(provaComRespostaSalva(prova, { questao: 3, alternativa: 0, sequencia: 1 }).respostas).toContainEqual({ questao: 3, alternativa: 0, sequencia: 1 })
  })
})
