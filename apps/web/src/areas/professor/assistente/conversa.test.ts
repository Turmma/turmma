import type { MensagemDaConversa, MensagemDoAgente } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import type { CicloDeExecucao } from '../../../api/ciclo-de-execucao'
import { mensagemAoAssistenteRequestSchema } from '@educa/shared'
import { itensDaConversa, marcaDoFim, mensagensNaTela, pedidoDeSoConversar, pendenteNaConversa, propostaQuePergunta } from './conversa'
import type { PedidoDaConversa } from './memoria-do-professor'

const TURMA = '0190f5a0-0000-7000-8000-00000000002b'
const DISCIPLINA = '0190f5a0-0000-7000-8000-0000000000c1'
const EXECUCAO = '0190f5a0-0000-7000-8000-0000000000e1'
const id = (final: string) => `0190f5a0-0000-7000-8000-0000000000${final}`

const dela = (final: string, texto: string): MensagemDaConversa => ({ id: id(final), criadaEm: '2026-10-05T13:00:00.000Z', autor: 'usuario', tipo: 'texto', texto, turmaId: TURMA, disciplinaId: DISCIPLINA })
const doAgente = (final: string, texto: string): MensagemDoAgente => ({ id: id(final), criadaEm: '2026-10-05T13:00:05.000Z', autor: 'agente', tipo: 'texto', texto, citacoes: [] })
const proposta = (final: string): MensagemDoAgente => ({
  id: id(final),
  criadaEm: '2026-10-05T13:00:05.000Z',
  autor: 'agente',
  tipo: 'proposta_de_ferramenta',
  texto: 'Posso fazer isso com a ferramenta Atividade objetiva, ou só conversar.',
  proposta: { ferramenta: 'atividade_objetiva', parametros: { turmaId: TURMA, disciplinaId: DISCIPLINA, tema: 'Estequiometria', quantidade: 10 } },
})

const PEDIDO: PedidoDaConversa = { texto: 'uma atividade de estequiometria', turmaId: TURMA, disciplinaId: DISCIPLINA }
const enviando: CicloDeExecucao<PedidoDaConversa> = { etapa: 'enviando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 1_000 }
const esperando: CicloDeExecucao<PedidoDaConversa> = { etapa: 'esperando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 1_000, execucaoId: EXECUCAO }
const concluida = (resposta: MensagemDoAgente): CicloDeExecucao<PedidoDaConversa> => ({ etapa: 'concluida', pedido: PEDIDO, chaveEnvio: 'chave-1', execucaoId: EXECUCAO, resultado: { tipo: 'mensagem', mensagem: resposta } })

describe('o que a conversa mostra além do que a API já devolveu', () => {
  it('sem pedido no ar, só a conversa lida', () => {
    expect(pendenteNaConversa([dela('01', 'oi')], undefined)).toBeUndefined()
  })

  it('o pedido que acabou de sair aparece na hora, com o "pensando", antes de a API devolver qualquer coisa', () => {
    expect(pendenteNaConversa([], enviando)).toEqual({ pedido: PEDIDO.texto, pensando: true })
    expect(pendenteNaConversa([dela('01', 'outro pedido'), doAgente('02', 'Resposta.')], esperando)).toEqual({ pedido: PEDIDO.texto, pensando: true })
  })

  it('o pedido que a conversa lida já tem não aparece duas vezes', () => {
    expect(pendenteNaConversa([dela('01', PEDIDO.texto)], esperando)).toEqual({ pensando: true })
  })

  it('quem manda duas vezes o mesmo texto vê as duas: só a última mensagem conta como já gravada', () => {
    expect(pendenteNaConversa([dela('01', PEDIDO.texto), doAgente('02', 'Resposta.')], esperando)).toEqual({ pedido: PEDIDO.texto, pensando: true })
  })

  it('a resposta que a execução trouxe aparece antes de a conversa ser lida de novo, e some quando a conversa a traz', () => {
    const resposta = doAgente('02', 'Resposta com a página citada.')
    expect(pendenteNaConversa([], concluida(resposta))).toEqual({ pedido: PEDIDO.texto, pensando: false, resposta })
    expect(mensagensNaTela([dela('01', PEDIDO.texto)], pendenteNaConversa([dela('01', PEDIDO.texto)], concluida(resposta))).map((mensagem) => mensagem.id)).toEqual([id('01'), id('02')])
    const lida = [dela('01', PEDIDO.texto), resposta]
    expect(pendenteNaConversa(lida, concluida(resposta))).toBeUndefined()
    expect(mensagensNaTela(lida, undefined)).toBe(lida)
  })

  it('a pergunta vem antes da resposta, também quando as duas ainda não foram lidas de volta da API', () => {
    const anterior = [dela('01', 'outro pedido'), doAgente('02', 'Outra resposta.')]
    const resposta = doAgente('04', 'Resposta com a página citada.')
    const itens = itensDaConversa(anterior, pendenteNaConversa(anterior, concluida(resposta)))
    expect(itens.map((item) => (item.tipo === 'pedido' ? `pedido: ${item.texto}` : item.mensagem.id))).toEqual([id('01'), id('02'), `pedido: ${PEDIDO.texto}`, id('04')])
    // Com o pedido já lido de volta e a resposta ainda não, a ordem é a mesma, sem o pedido duas vezes.
    const comOPedido = [...anterior, dela('03', PEDIDO.texto)]
    expect(itensDaConversa(comOPedido, pendenteNaConversa(comOPedido, concluida(resposta))).map((item) => (item.tipo === 'pedido' ? 'pedido' : item.mensagem.id))).toEqual([id('01'), id('02'), id('03'), id('04')])
    // E, com tudo lido, só as mensagens lidas.
    const tudo = [...comOPedido, resposta]
    expect(itensDaConversa(tudo, pendenteNaConversa(tudo, concluida(resposta)))).toEqual(tudo.map((mensagem) => ({ tipo: 'mensagem', mensagem })))
  })

  it('carregar as mensagens anteriores não muda o fim da conversa: a tela não rola sozinha', () => {
    const recentes = [dela('03', 'terceira'), doAgente('04', 'quarta')]
    const comAsAnteriores = [dela('01', 'primeira'), doAgente('02', 'segunda'), ...recentes]
    expect(marcaDoFim(itensDaConversa(comAsAnteriores, undefined), undefined)).toBe(marcaDoFim(itensDaConversa(recentes, undefined), undefined))
    // A mensagem nova, o pedido no ar e a troca de etapa mudam.
    expect(marcaDoFim(itensDaConversa([...recentes, dela('05', 'quinta')], undefined), undefined)).not.toBe(marcaDoFim(itensDaConversa(recentes, undefined), undefined))
    expect(marcaDoFim(itensDaConversa(recentes, pendenteNaConversa(recentes, enviando)), 'enviando')).not.toBe(marcaDoFim(itensDaConversa(recentes, undefined), undefined))
    expect(marcaDoFim(itensDaConversa(recentes, pendenteNaConversa(recentes, esperando)), 'esperando')).not.toBe(marcaDoFim(itensDaConversa(recentes, pendenteNaConversa(recentes, enviando)), 'enviando'))
  })

  it('a falha fica com o código, e o pedido continua na tela para ser repetido', () => {
    expect(pendenteNaConversa([], { etapa: 'falhou', pedido: PEDIDO, chaveEnvio: 'chave-1', erro: 'IA_INDISPONIVEL', execucaoId: EXECUCAO })).toEqual({ pedido: PEDIDO.texto, pensando: false, erro: 'IA_INDISPONIVEL' })
  })
})

describe('a pergunta da D18: qual proposta ainda pergunta', () => {
  it('só a última mensagem, quando é uma proposta ainda sem resposta', () => {
    expect(propostaQuePergunta([dela('01', PEDIDO.texto), proposta('02')], {}, undefined)).toBe(id('02'))
  })

  it('a proposta respondida não pergunta de novo, qualquer que tenha sido a escolha', () => {
    expect(propostaQuePergunta([proposta('02')], { [id('02')]: 'ferramenta' }, undefined)).toBeUndefined()
    expect(propostaQuePergunta([proposta('02')], { [id('02')]: 'conversa' }, undefined)).toBeUndefined()
  })

  it('a proposta antiga, depois de a conversa seguir, não volta a perguntar', () => {
    expect(propostaQuePergunta([proposta('02'), dela('03', 'deixa, me explica reagente limitante'), doAgente('04', 'Claro.')], {}, undefined)).toBeUndefined()
    expect(propostaQuePergunta([proposta('02'), dela('03', 'outro pedido')], {}, undefined)).toBeUndefined()
  })

  it('"só conversar" vira a mensagem seguinte dela, na turma da proposta, com a marca que pede a resposta em texto; e o corpo passa no contrato', () => {
    const mensagem = proposta('02')
    if (mensagem.tipo !== 'proposta_de_ferramenta') throw new Error('era para ser proposta')
    const pedido = pedidoDeSoConversar(mensagem.proposta)
    expect(pedido).toEqual({ texto: 'Só conversar', turmaId: TURMA, disciplinaId: DISCIPLINA, resposta: 'so_conversar' })
    expect(mensagemAoAssistenteRequestSchema.safeParse({ ...pedido, chaveEnvio: EXECUCAO }).success).toBe(true)
    // Sem a marca, o Assistente proporia a ferramenta de novo: é ela que diz que a professora já respondeu.
    expect(pendenteNaConversa([mensagem], { etapa: 'enviando', pedido, chaveEnvio: 'chave-2', desde: 2_000 })).toEqual({ pedido: 'Só conversar', pensando: true })
  })

  it('com um pedido novo no ar, a proposta anterior deixa de perguntar', () => {
    expect(propostaQuePergunta([proposta('02')], {}, enviando)).toBeUndefined()
    expect(propostaQuePergunta([], {}, undefined)).toBeUndefined()
  })
})
