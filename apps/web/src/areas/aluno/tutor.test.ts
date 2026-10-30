import { ErrorCode, mensagemAoTutorRequestSchema, MENSAGENS_DE_ERRO, type MensagemDoTutor, type MensagemDoTutorAoAluno, type ConversaDoTutorResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import type { CicloDeExecucao } from '../../api/ciclo-de-execucao'
import {
  avisoDaPausa,
  falhaDaPergunta,
  itensDoTutor,
  marcaDoFim,
  LINHA_DO_CVV,
  mensagensNaTela,
  partesDoEncaminhamento,
  pausaDoErro,
  pausaDoEstado,
  pausaNaTela,
  pendenteNoTutor,
  questaoDoEndereco,
  recusaVencida,
  temTelefone,
  TEXTO_DA_FALHA_DO_TUTOR,
  TEXTO_DA_SUPERVISAO,
  usoDoDia,
  type PausaDoTutor,
  type PedidoAoTutor,
} from './tutor'

const ATIVIDADE = '0190f5a0-0000-7000-8000-0000000000a1'
const OUTRA_ATIVIDADE = '0190f5a0-0000-7000-8000-0000000000a2'
const EXECUCAO = '0190f5a0-0000-7000-8000-0000000000e1'
const id = (final: string) => `0190f5a0-0000-7000-8000-0000000000${final}`

const doAluno = (final: string, texto: string): MensagemDoTutor => ({ id: id(final), criadaEm: '2026-10-05T13:00:00.000Z', autor: 'aluno', tipo: 'texto', texto })
const doTutor = (final: string, texto: string): MensagemDoTutorAoAluno => ({ id: id(final), criadaEm: '2026-10-05T13:00:05.000Z', autor: 'tutor', tipo: 'texto', texto, citacoes: [] })

const PEDIDO: PedidoAoTutor = { texto: 'qual é a resposta da questão 2?', atividadeAplicadaId: ATIVIDADE, questao: 2 }
const enviando: CicloDeExecucao<PedidoAoTutor> = { etapa: 'enviando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 1_000 }
const esperando: CicloDeExecucao<PedidoAoTutor> = { etapa: 'esperando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 1_000, execucaoId: EXECUCAO }
const concluida = (mensagem: MensagemDoTutorAoAluno): CicloDeExecucao<PedidoAoTutor> => ({ etapa: 'concluida', pedido: PEDIDO, chaveEnvio: 'chave-1', execucaoId: EXECUCAO, resultado: { tipo: 'mensagem_do_tutor', mensagem } })
const falhou = (erro: ErrorCode): CicloDeExecucao<PedidoAoTutor> => ({ etapa: 'falhou', pedido: PEDIDO, chaveEnvio: 'chave-1', erro })

const conversa = (campos: Partial<Pick<ConversaDoTutorResponse, 'estado' | 'uso'>> = {}): Pick<ConversaDoTutorResponse, 'estado' | 'uso'> => ({ estado: 'ligado', uso: { hoje: 12, limiteDoDia: 60 }, ...campos })

describe('"Hoje: N de 60 perguntas" (D38, D59)', () => {
  it('diz em texto quanto já foi e quanto falta, com o limite que a API mandou', () => {
    expect(usoDoDia({ hoje: 12, limiteDoDia: 60 })).toEqual({ rotulo: 'Hoje: 12 de 60 perguntas', resto: 'faltam 48', valor: 12, maximo: 60 })
    expect(usoDoDia({ hoje: 0, limiteDoDia: 40 })).toMatchObject({ rotulo: 'Hoje: 0 de 40 perguntas', resto: 'faltam 40' })
    expect(usoDoDia({ hoje: 59, limiteDoDia: 60 }).resto).toBe('falta 1')
  })

  it('no limite diz com calma que por hoje acabou, e a contagem não passa do fim', () => {
    expect(usoDoDia({ hoje: 60, limiteDoDia: 60 })).toEqual({ rotulo: 'Hoje: 60 de 60 perguntas', resto: 'por hoje acabou', valor: 60, maximo: 60 })
    expect(usoDoDia({ hoje: 63, limiteDoDia: 60 })).toEqual({ rotulo: 'Hoje: 60 de 60 perguntas', resto: 'por hoje acabou', valor: 60, maximo: 60 })
    expect(usoDoDia({ hoje: 1, limiteDoDia: 1 }).rotulo).toBe('Hoje: 1 de 1 pergunta')
  })
})

describe('o Tutor pausado é aviso que explica, e não erro', () => {
  it('a pausa vem do estado que o servidor mandou; no limite, é o do dia quando o aluno chegou nele, senão é o pacote da turma', () => {
    expect(pausaDoEstado(conversa())).toBeUndefined()
    expect(pausaDoEstado(conversa({ estado: 'avaliacao' }))).toBe('avaliacao')
    expect(pausaDoEstado(conversa({ estado: 'fora' }))).toBe('fora')
    expect(pausaDoEstado(conversa({ estado: 'limite', uso: { hoje: 60, limiteDoDia: 60 } }))).toBe('limite_do_dia')
    expect(pausaDoEstado(conversa({ estado: 'limite', uso: { hoje: 12, limiteDoDia: 60 } }))).toBe('pacote_do_mes')
  })

  it('em avaliação diz o título dela e quando o Tutor volta; no limite, que por hoje acabou e que amanhã volta', () => {
    const avaliacao = avisoDaPausa('avaliacao', { avaliacao: 'Prova de estequiometria' })
    expect(avaliacao.titulo).toBe('O Tutor está pausado durante a avaliação.')
    expect(avaliacao.texto).toBe('A sua turma tem uma avaliação aberta agora: Prova de estequiometria. Ele volta quando quem dá a aula encerrar.')
    const limite = avisoDaPausa('limite_do_dia', { limiteDoDia: 60 })
    expect(limite.titulo).toBe('Por hoje acabou.')
    expect(limite.texto).toBe('Você fez as 60 perguntas de hoje. Amanhã o Tutor volta. As suas atividades continuam abertas.')
    // O pacote da turma não volta amanhã: a tela não promete.
    expect(avisoDaPausa('pacote_do_mes').texto).not.toMatch(/amanhã/i)
  })

  it('nenhum aviso de pausa grita, culpa o aluno ou mostra código', () => {
    const pausas: readonly PausaDoTutor[] = ['avaliacao', 'limite_do_dia', 'pacote_do_mes', 'fora', 'suspenso']
    for (const pausa of pausas) {
      const { titulo, texto } = avisoDaPausa(pausa, { avaliacao: 'Prova', limiteDoDia: 60 })
      expect(`${titulo} ${texto}`, pausa).not.toMatch(/!|falh|proibid|bloquead|castig|409|429|[A-Z]{3,}_/)
    }
    expect(avisoDaPausa('suspenso').texto).toMatch(/não é com você/)
  })

  it('a recusa do servidor (409 ou 429) vira o aviso do estado; a função suspensa, o aviso que explica', () => {
    expect(pausaDoErro(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)).toBe('avaliacao')
    expect(pausaDoErro(ErrorCode.LIMITE_DIARIO_DO_TUTOR)).toBe('limite_do_dia')
    expect(pausaDoErro(ErrorCode.PACOTE_DO_TUTOR_ESGOTADO)).toBe('pacote_do_mes')
    expect(pausaDoErro(ErrorCode.FUNCAO_SUSPENSA)).toBe('suspenso')
    expect(pausaDoErro(ErrorCode.IA_INDISPONIVEL)).toBeUndefined()
    expect(falhaDaPergunta(ErrorCode.LIMITE_DIARIO_DO_TUTOR)).toEqual({ tipo: 'pausa', pausa: 'limite_do_dia' })
    expect(falhaDaPergunta(ErrorCode.FUNCAO_SUSPENSA)).toEqual({ tipo: 'pausa', pausa: 'suspenso' })
  })

  it('a falha do modelo deixa a pergunta com "Tente de novo"; pergunta demais em pouco tempo pede para esperar; nenhuma mostra código', () => {
    for (const erro of [ErrorCode.IA_INDISPONIVEL, ErrorCode.IA_TEMPO_ESGOTADO, ErrorCode.IA_SAIDA_INVALIDA, ErrorCode.EXECUCAO_INTERROMPIDA, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO])
      expect(falhaDaPergunta(erro), erro).toEqual({ tipo: 'tentar', texto: TEXTO_DA_FALHA_DO_TUTOR })
    expect(TEXTO_DA_FALHA_DO_TUTOR).toBe('O Tutor não conseguiu responder agora. Tente de novo.')
    expect(falhaDaPergunta(ErrorCode.LIMITE_EXCEDIDO).tipo).toBe('esperar')
    expect(falhaDaPergunta(ErrorCode.IA_ORCAMENTO_ESGOTADO)).toEqual({ tipo: 'explicada', texto: MENSAGENS_DE_ERRO.IA_ORCAMENTO_ESGOTADO })
  })

  it('a pausa que a última pergunta recebeu vem antes da que a conversa lida dizia', () => {
    const recusada = pendenteNoTutor([], falhou(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO), ATIVIDADE)
    expect(pausaNaTela(conversa(), recusada)).toBe('avaliacao')
    expect(pausaNaTela(conversa({ estado: 'limite', uso: { hoje: 60, limiteDoDia: 60 } }), undefined)).toBe('limite_do_dia')
    expect(pausaNaTela(conversa(), undefined)).toBeUndefined()
    expect(pausaNaTela(undefined, undefined)).toBeUndefined()
  })

  it('a recusa por pausa deixa de valer quando a conversa, lida depois dela, diz que o Tutor voltou; a suspensão fica', () => {
    expect(recusaVencida('avaliacao', undefined, true)).toBe(true)
    // Ainda não foi lida de novo, ou a leitura confirma a pausa: o aviso fica.
    expect(recusaVencida('avaliacao', undefined, false)).toBe(false)
    expect(recusaVencida('avaliacao', 'avaliacao', true)).toBe(false)
    // A conversa lida não diz nada sobre a suspensão pela escola: ela não a desmente.
    expect(recusaVencida('suspenso', undefined, true)).toBe(false)
    expect(recusaVencida(undefined, undefined, true)).toBe(false)
  })
})

describe('o que a conversa mostra além do que a API já devolveu', () => {
  it('a pergunta aparece na hora, com o "preparando", e não aparece duas vezes quando a conversa lida já a tem', () => {
    expect(pendenteNoTutor([], enviando, ATIVIDADE)).toEqual({ pergunta: PEDIDO.texto, pensando: true })
    expect(pendenteNoTutor([doAluno('01', PEDIDO.texto)], esperando, ATIVIDADE)).toEqual({ pensando: true })
    expect(pendenteNoTutor([], undefined, ATIVIDADE)).toBeUndefined()
  })

  it('a pergunta feita em outra atividade não aparece nesta conversa', () => {
    expect(pendenteNoTutor([], esperando, OUTRA_ATIVIDADE)).toBeUndefined()
  })

  it('a resposta que a execução trouxe entra uma vez só: some do pendente quando a conversa lida a tem', () => {
    const resposta = doTutor('02', 'Quantos mols há em 24 g de carbono?')
    const pendente = pendenteNoTutor([doAluno('01', PEDIDO.texto)], concluida(resposta), ATIVIDADE)
    expect(pendente).toEqual({ pensando: false, resposta })
    expect(mensagensNaTela([doAluno('01', PEDIDO.texto)], pendente)).toEqual([doAluno('01', PEDIDO.texto), resposta])
    expect(pendenteNoTutor([doAluno('01', PEDIDO.texto), resposta], concluida(resposta), ATIVIDADE)).toBeUndefined()
  })

  it('com a conversa vazia e a execução já concluída, a pergunta vem antes da resposta, também na mensagem com o 188', () => {
    const encaminhamento: MensagemDoTutorAoAluno = { ...doTutor('03', 'Isso é importante. Ligue 188.'), tipo: 'assunto_delicado' }
    const pendente = pendenteNoTutor([], concluida(encaminhamento), ATIVIDADE)
    expect(itensDoTutor([], pendente)).toEqual([
      { tipo: 'pergunta', texto: PEDIDO.texto },
      { tipo: 'mensagem', mensagem: encaminhamento },
    ])
    // Com a conversa lida de volta, a pergunta e a resposta vêm dela, na ordem dela, uma vez cada.
    const lidas = [doAluno('01', PEDIDO.texto), encaminhamento]
    expect(itensDoTutor(lidas, pendenteNoTutor(lidas, concluida(encaminhamento), ATIVIDADE))).toEqual(lidas.map((mensagem) => ({ tipo: 'mensagem', mensagem })))
  })

  it('a rolagem até o fim segue o último item, e não muda quando as mensagens anteriores chegam no começo', () => {
    const recentes = [doAluno('04', 'e agora?'), doTutor('05', 'O que você já sabe da massa molar?')]
    const comAnteriores = [doAluno('01', 'oi'), doTutor('02', 'Olá!'), ...recentes]
    expect(marcaDoFim(itensDoTutor(comAnteriores, undefined), undefined, undefined)).toBe(marcaDoFim(itensDoTutor(recentes, undefined), undefined, undefined))
    expect(marcaDoFim(itensDoTutor(recentes, { pergunta: 'e a 3?', pensando: true }), 'esperando', undefined)).not.toBe(marcaDoFim(itensDoTutor(recentes, undefined), undefined, undefined))
  })

  it('a pergunta que falhou fica na conversa, com o que houve', () => {
    expect(pendenteNoTutor([], falhou(ErrorCode.IA_INDISPONIVEL), ATIVIDADE)).toEqual({ pergunta: PEDIDO.texto, pensando: false, falha: { tipo: 'tentar', texto: TEXTO_DA_FALHA_DO_TUTOR } })
  })

  it('o pedido que a tela monta é o do contrato: o texto, a atividade e a questão, e nada de turma nem de aluno', () => {
    expect(mensagemAoTutorRequestSchema.safeParse({ ...PEDIDO, chaveEnvio: '0190f5a0-0000-4000-8000-0000000000f1' }).success).toBe(true)
    expect(Object.keys(PEDIDO).sort()).toEqual(['atividadeAplicadaId', 'questao', 'texto'])
  })
})

describe('a mensagem de assunto delicado (D36)', () => {
  const FIXA = ['Obrigado por me contar.', 'Se você estiver em perigo, ligue 188 (CVV). A ligação é gratuita.', 'Procure um adulto de confiança.'].join('\n\n')

  it('o texto da API fica palavra por palavra, em parágrafos, com o 188 separado para virar link', () => {
    const partes = partesDoEncaminhamento(FIXA)
    expect(partes).toEqual([
      [{ tipo: 'texto', texto: 'Obrigado por me contar.' }],
      [{ tipo: 'texto', texto: 'Se você estiver em perigo, ligue ' }, { tipo: 'telefone', numero: '188' }, { tipo: 'texto', texto: ' (CVV). A ligação é gratuita.' }],
      [{ tipo: 'texto', texto: 'Procure um adulto de confiança.' }],
    ])
    expect(temTelefone(partes)).toBe(true)
    // Nada se perde nem se acrescenta ao texto.
    expect(partes.map((paragrafo) => paragrafo.map((parte) => (parte.tipo === 'telefone' ? parte.numero : parte.texto)).join('')).join('\n\n')).toBe(FIXA)
  })

  it('o 188 dentro de outro número não é telefone', () => {
    expect(temTelefone(partesDoEncaminhamento('A página 1188 e o ano de 1885.'))).toBe(false)
  })

  it('a mensagem que não traz o número faz a tela acrescentar a linha dele: o 188 está sempre lá', () => {
    expect(temTelefone(partesDoEncaminhamento('Procure hoje um adulto de confiança na escola.'))).toBe(false)
    expect(`${LINHA_DO_CVV.antes}188${LINHA_DO_CVV.depois}`).toBe('Se você estiver em perigo ou pensando em se machucar, ligue 188 (CVV). A ligação é gratuita e funciona a qualquer hora.')
  })
})

describe('o que acompanha a pergunta', () => {
  it('a questão vem do endereço, e só vale um número de questão', () => {
    expect(questaoDoEndereco('questao=3')).toBe(3)
    expect(questaoDoEndereco('?questao=20')).toBe(20)
    for (const invalido of ['', 'questao=0', 'questao=21', 'questao=abc', 'questao=3.5', 'questao=-1', 'outra=3']) expect(questaoDoEndereco(invalido), invalido).toBeUndefined()
  })

  it('a faixa de supervisão diz que o professor acompanha (D8)', () => {
    expect(TEXTO_DA_SUPERVISAO).toBe('Quem dá a aula acompanha como você usa o Tutor.')
  })
})
