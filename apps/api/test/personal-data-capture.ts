import { expect } from 'vitest'
import type { RespostaHttp } from './test-api.js'

/**
 * O harness de captura de dado pessoal (F3, RF17; tarefa 11.0): junta o log da API — que o `subirApi` recebe na lista
 * dada — com as respostas que o teste passou por ele, e procura o que nunca pode aparecer em nenhum dos dois: o nome
 * do titular (o atual e o anterior a uma correção), o termo da busca e, na 13.0, a URL assinada do arquivo.
 *
 * Duas varreduras, porque nem tudo pode sumir de todo lugar: o nome do titular **sai na resposta** de quem tem o direito
 * de vê-lo (a busca, a prévia, a lista de pedidos), e por isso é só o log que o varre inteiro; o que nunca aparece em
 * resposta nenhuma (o nome anterior a uma correção, o termo digitado) varre o log **e** as respostas capturadas.
 *
 * As respostas capturadas são as **outras** respostas (RF17): as chamadas que não podem mostrar o nome. Quem mostra
 * chama a API direto e confere o que quer, para a varredura não ser vazia — o teste de 11.0 confere que o nome aparece
 * na busca antes de varrer o log.
 */
export class CapturaDeDadoPessoal {
  readonly #respostas: string[] = []
  /** Quantas linhas o log já tinha quando a captura nasceu: o que vem antes é de outro teste do mesmo arquivo. */
  readonly #inicio: number

  constructor(private readonly linhasDeLog: readonly string[]) {
    this.#inicio = linhasDeLog.length
  }

  /** Captura o corpo da resposta e a devolve, para o teste conferir o que quiser nela. */
  async capturar(pedido: Promise<RespostaHttp>): Promise<RespostaHttp> {
    const resposta = await pedido
    this.#respostas.push(JSON.stringify(resposta.corpo))
    return resposta
  }

  /** Nada disto aparece no log da API, mesmo quando a resposta o mostra (regra 20, item 9). */
  varrerLog(oQueNuncaPodeAparecer: readonly string[]): void {
    const log = this.linhasDeLog.slice(this.#inicio).join('\n')
    // A varredura só vale se o log capturou alguma coisa depois de criada a captura: o teste que varre precisa ter
    // provocado ao menos uma resposta de erro.
    expect(log, 'o log da API não capturou nada depois de criada a captura: a varredura seria vazia').toContain('http.erro')
    for (const proibido of oQueNuncaPodeAparecer) expect(log, `o log traz dado de pessoa: ${proibido}`).not.toContain(proibido)
  }

  /** Nada disto aparece no log nem em nenhuma resposta capturada (RF17, "as outras respostas"). */
  varrerTudo(oQueNuncaPodeAparecer: readonly string[]): void {
    this.varrerLog(oQueNuncaPodeAparecer)
    const respostas = this.#respostas.join('\n')
    for (const proibido of oQueNuncaPodeAparecer) expect(respostas, `a resposta traz dado de pessoa: ${proibido}`).not.toContain(proibido)
  }
}
