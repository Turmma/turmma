import { DomainException, runInContext } from '@educa/core'
import { describe, expect, it } from 'vitest'
import { LimiteDePedidosDeIa, TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA, TETO_DE_PEDIDOS_DE_IA_POR_USUARIO } from './limite-de-pedidos-de-ia.js'

const ESCOLA_A = '0190f5a0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0190f5a0-0000-7000-8000-00000000000b'

/** O contador em janela, em memória: só o que o limite usa. `doSeguro` simula o Redis de fila fora. */
function janelaDeTeste(doSeguro = false) {
  const valores = new Map<string, number>()
  return {
    valores,
    chaveDe: (prefixo: string, identificador: string) => `${prefixo}:${identificador}`,
    somar: async (chave: string) => {
      valores.set(chave, (valores.get(chave) ?? 0) + 1)
      return { valor: valores.get(chave) ?? 0, doSeguro }
    },
    restanteMs: async () => 41_500,
  }
}

const semLog = { warn: () => undefined }

const como = <T>(escolaId: string, usuarioId: string, funcao: () => T): T =>
  runInContext({ requisicaoId: 'r', escolaId, usuarioId, papel: 'professor', sessaoId: 's', anoLetivoId: 'a' }, funcao)

async function recusaDe(promessa: Promise<void>): Promise<DomainException | undefined> {
  return promessa.then(
    () => undefined,
    (erro: unknown) => {
      if (erro instanceof DomainException) return erro
      throw erro
    },
  )
}

describe('LimiteDePedidosDeIa: por pessoa e por escola, nunca por IP', () => {
  it('a pessoa passa até o teto dela e é recusada depois, com o Retry-After do resto da janela; a colega da mesma escola segue', async () => {
    const limite = new LimiteDePedidosDeIa({ janela: janelaDeTeste(), instancias: 2, logger: semLog })
    for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO; pedido++) expect(await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))).toBeUndefined()
    const recusa = await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))
    expect(recusa).toMatchObject({ codigo: 'LIMITE_EXCEDIDO', status: 429, tenteDeNovoEmSegundos: 42 })
    expect(await recusaDe(como(ESCOLA_A, 'bia', () => limite.contar()))).toBeUndefined()
  })

  it('quem estourou o próprio teto não gasta o da escola', async () => {
    const janela = janelaDeTeste()
    const limite = new LimiteDePedidosDeIa({ janela, instancias: 2, logger: semLog })
    for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO + 30; pedido++) await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))
    expect(janela.valores.get(limite.chaveDaEscola(ESCOLA_A))).toBe(TETO_DE_PEDIDOS_DE_IA_POR_USUARIO)
  })

  it('a escola inteira tem teto, pessoas diferentes somam nele, e outra escola não é afetada', async () => {
    const limite = new LimiteDePedidosDeIa({ janela: janelaDeTeste(), instancias: 2, logger: semLog })
    for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA; pedido++) expect(await recusaDe(como(ESCOLA_A, `pessoa-${String(pedido)}`, () => limite.contar()))).toBeUndefined()
    expect(await recusaDe(como(ESCOLA_A, 'mais-uma', () => limite.contar()))).toMatchObject({ codigo: 'LIMITE_EXCEDIDO' })
    expect(await recusaDe(como(ESCOLA_B, 'mais-uma', () => limite.contar()))).toBeUndefined()
  })

  it('com o Redis de fila fora, o teto é o dividido pelas instâncias: nunca libera sem limite', async () => {
    const limite = new LimiteDePedidosDeIa({ janela: janelaDeTeste(true), instancias: 2, logger: semLog })
    const metade = TETO_DE_PEDIDOS_DE_IA_POR_USUARIO / 2
    for (let pedido = 0; pedido < metade; pedido++) expect(await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))).toBeUndefined()
    expect(await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))).toMatchObject({ codigo: 'LIMITE_EXCEDIDO' })
  })

  it('o primeiro pedido acima de cada teto escreve uma linha de log, com o tipo e os ids e mais nada; os seguintes da janela não repetem', async () => {
    const linhas: unknown[] = []
    const limite = new LimiteDePedidosDeIa({ janela: janelaDeTeste(), instancias: 2, logger: { warn: (linha: unknown) => linhas.push(linha) } })
    for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_USUARIO; pedido++) await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))
    expect(linhas).toEqual([])
    for (let pedido = 0; pedido < 5; pedido++) expect(await recusaDe(como(ESCOLA_A, 'ana', () => limite.contar()))).toMatchObject({ codigo: 'LIMITE_EXCEDIDO' })
    expect(linhas).toEqual([{ evento: 'ia.limite_de_pedidos_atingido', tipo: 'usuario', escolaId: ESCOLA_A, usuarioId: 'ana' }])
    // O teto da escola: a linha diz quem fez o pedido que passou dele, por id.
    for (let pedido = 0; pedido < TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA; pedido++) await recusaDe(como(ESCOLA_A, `pessoa-${String(pedido)}`, () => limite.contar()))
    expect(linhas.slice(1)).toEqual([{ evento: 'ia.limite_de_pedidos_atingido', tipo: 'escola', escolaId: ESCOLA_A, usuarioId: `pessoa-${String(TETO_DE_PEDIDOS_DE_IA_POR_ESCOLA - TETO_DE_PEDIDOS_DE_IA_POR_USUARIO)}` }])
  })

  it('a chave nunca é o id em texto quando o contador é o de verdade: o limite só entrega o identificador ao HMAC do contador', () => {
    const vistos: string[] = []
    const limite = new LimiteDePedidosDeIa({ janela: { ...janelaDeTeste(), chaveDe: (prefixo, identificador) => (vistos.push(identificador), `${prefixo}:hmac`) }, instancias: 1, logger: semLog })
    expect(limite.chaveDoUsuario(ESCOLA_A, 'ana')).toBe('ia:pedidos-usuario:hmac')
    expect(limite.chaveDaEscola(ESCOLA_A)).toBe('ia:pedidos-escola:hmac')
    expect(vistos).toEqual([`${ESCOLA_A}|ana`, ESCOLA_A])
  })
})
