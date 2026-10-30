import { ErrorCode, type MeuDiagnosticoResponse, type ProvaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../../api/cliente'
import {
  alternativaMarcada,
  avisoDeEscolhasPerdidas,
  comemoracaoNaTela,
  contarRespostas,
  FALA_DA_ENTREGA,
  faseDaAtividade,
  impedimentoDoEnvio,
  letraDaAlternativa,
  marcaDaQuestao,
  questaoValida,
  respostasSalvas,
  resultadoNaTela,
  ROTULO_DE_VOLTAR_AS_TAREFAS,
  rotuloNoMapa,
  textoDasEmBranco,
  textoDasRespondidas,
  textoDoAcerto,
  TEXTO_DA_MARCA,
} from './atividade'
import { FILA_VAZIA, type EstadoDaFila } from './respostas'

const ID = '0190f5a0-0000-7000-8000-0000000000a1'

const prova = (campos: Partial<ProvaResponse> = {}): ProvaResponse => ({
  atividadeAplicadaId: ID,
  titulo: 'Atividade de estequiometria',
  avaliativa: false,
  estado: 'aberta',
  adaptacao: null,
  questoes: [1, 2, 3].map((numero) => ({ numero, enunciado: `Enunciado ${String(numero)}`, alternativas: ['a', 'b', 'c', 'd'] })),
  respostas: [],
  enviadaEm: null,
  ...campos,
})

const DIAGNOSTICO: MeuDiagnosticoResponse = {
  atividadeAplicadaId: ID,
  titulo: 'Atividade de estequiometria',
  acertos: 2,
  total: 3,
  porHabilidade: [{ habilidade: { codigo: 'QUI.EM.04', descricao: 'Usar a proporção da equação.' }, acertos: 2, total: 3 }],
  questoes: [{ numero: 1, alternativa: 1, gabarito: 1, correta: true, explicacao: 'Porque sim.', citacao: { materialId: '0190f5a0-0000-7000-8000-0000000000b1', pagina: 142, trecho: 'Trecho.' } }],
  aprovadoPor: { nome: 'Camila Souza sintética' },
  aprovadoEm: '2026-10-05T14:00:00.000Z',
}

const fila = (campos: Partial<EstadoDaFila>): EstadoDaFila => ({ ...FILA_VAZIA, ...campos })

describe('a fase da atividade', () => {
  it('aberta e não enviada, o aluno responde; enviada ou encerrada, a tela não deixa mudar', () => {
    expect(faseDaAtividade(prova())).toBe('respondendo')
    expect(faseDaAtividade(prova({ enviadaEm: '2026-10-05T13:30:00.000Z' }))).toBe('enviada')
    expect(faseDaAtividade(prova({ estado: 'encerrada' }))).toBe('encerrada')
    // Enviou antes de a professora encerrar: continua sendo a atividade que ele enviou.
    expect(faseDaAtividade(prova({ estado: 'encerrada', enviadaEm: '2026-10-05T13:30:00.000Z' }))).toBe('enviada')
  })
})

describe('o resultado só aparece depois de a professora aprovar a correção (regra 70, item 3)', () => {
  const NAO_ENCONTRADO = new ErroDaApi(ErrorCode.NAO_ENCONTRADO)

  it('com o lote pendente, rejeitado ou ainda não corrigido, a API responde como inexistente e a tela só diz que a correção vai ser revista', () => {
    // Os três casos chegam iguais à tela, de propósito: ela não tem como saber, nem dizer, o que a correção achou.
    expect(resultadoNaTela('enviada', { data: undefined, error: NAO_ENCONTRADO })).toEqual({ tipo: 'aguardando' })
    expect(resultadoNaTela('encerrada', { data: undefined, error: NAO_ENCONTRADO })).toEqual({ tipo: 'aguardando' })
  })

  it('o diagnóstico que ficou no cache não aparece se a API passou a dizer que ele não existe', () => {
    expect(resultadoNaTela('enviada', { data: DIAGNOSTICO, error: NAO_ENCONTRADO })).toEqual({ tipo: 'aguardando' })
  })

  it('enquanto o aluno responde não há resultado, mesmo com uma leitura no cache', () => {
    expect(resultadoNaTela('respondendo', { data: DIAGNOSTICO, error: null })).toEqual({ tipo: 'nenhum' })
  })

  it('aprovado o lote, o diagnóstico aparece; antes da resposta é "carregando", e a queda de rede é erro, não "aguardando"', () => {
    expect(resultadoNaTela('enviada', { data: DIAGNOSTICO, error: null })).toEqual({ tipo: 'pronto', diagnostico: DIAGNOSTICO })
    expect(resultadoNaTela('encerrada', { data: DIAGNOSTICO, error: null })).toEqual({ tipo: 'pronto', diagnostico: DIAGNOSTICO })
    expect(resultadoNaTela('enviada', { data: undefined, error: null })).toEqual({ tipo: 'carregando' })
    const queda = new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(resultadoNaTela('enviada', { data: undefined, error: queda })).toEqual({ tipo: 'erro', erro: queda })
  })

  it('o acerto é contagem de questões, sem percentual, que se leria como nota (D46)', () => {
    expect(textoDoAcerto(2, 3)).toBe('2 de 3 questões')
    expect(textoDoAcerto(0, 1)).toBe('0 de 1 questão')
    expect(textoDoAcerto(2, 3)).not.toMatch(/%|nota|conceito/i)
  })
})

describe('o que a tela diz de cada questão', () => {
  const comDuasSalvas = prova({ respostas: [{ questao: 1, alternativa: 2, sequencia: 1 }, { questao: 2, alternativa: 0, sequencia: 1 }] })
  const salvas = respostasSalvas(comDuasSalvas)

  it('"Resposta salva" só com a confirmação do servidor; a escolha ainda na fila é "salvando", e a que falhou, "não salva"', () => {
    expect(marcaDaQuestao(1, salvas, FILA_VAZIA)).toBe('salva')
    expect(marcaDaQuestao(3, salvas, FILA_VAZIA)).toBe('sem_resposta')
    expect(marcaDaQuestao(3, salvas, fila({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }] }))).toBe('salvando')
    expect(marcaDaQuestao(3, salvas, fila({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }], falha: 'passageira', tentativas: 1 }))).toBe('nao_salva')
    // A questão já salva cuja troca ainda não foi confirmada não diz "Resposta salva": o servidor tem a anterior.
    expect(marcaDaQuestao(1, salvas, fila({ pendentes: [{ questao: 1, alternativa: 3, sequencia: 1 }] }))).toBe('salvando')
    expect(TEXTO_DA_MARCA.salva).toBe('Resposta salva')
    expect(TEXTO_DA_MARCA.sem_resposta).toBe('')
  })

  it('a alternativa marcada é a escolha mais nova: a que ainda não foi salva vem antes da que o servidor tem', () => {
    expect(alternativaMarcada(1, salvas, FILA_VAZIA)).toBe(2)
    expect(alternativaMarcada(1, salvas, fila({ pendentes: [{ questao: 1, alternativa: 3, sequencia: 1 }], falha: 'passageira', tentativas: 2 }))).toBe(3)
    expect(alternativaMarcada(3, salvas, FILA_VAZIA)).toBeUndefined()
  })

  it('o mapa diz o estado de cada questão em texto', () => {
    expect(rotuloNoMapa(1, 'salva')).toBe('Questão 1, respondida')
    expect(rotuloNoMapa(3, 'sem_resposta')).toBe('Questão 3, sem resposta')
    expect(rotuloNoMapa(2, 'nao_salva')).toBe('Questão 2, resposta ainda não salva')
    expect(letraDaAlternativa(0)).toBe('A')
    expect(letraDaAlternativa(3)).toBe('D')
  })

  it('a confirmação do envio diz quantas ficaram em branco', () => {
    const contagem = contarRespostas(comDuasSalvas, FILA_VAZIA)
    expect(contagem).toEqual({ questoes: 3, respondidas: 2, emBranco: 1, naoSalvas: 0 })
    expect(textoDasRespondidas(contagem)).toBe('2 de 3 questões')
    expect(textoDasEmBranco(contagem.emBranco)).toBe('1 questão em branco')
    expect(textoDasEmBranco(2)).toBe('2 questões em branco')
    expect(textoDasEmBranco(0)).toBe('Nenhuma questão em branco')
  })

  it('com escolha ainda não salva, o envio é segurado, e a tela diz por quê', () => {
    expect(impedimentoDoEnvio(contarRespostas(comDuasSalvas, FILA_VAZIA))).toBeUndefined()
    const comUmaNaFila = contarRespostas(comDuasSalvas, fila({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }], falha: 'passageira', tentativas: 1 }))
    // A escolha não salva conta como respondida na tela, mas segura o envio.
    expect(comUmaNaFila).toEqual({ questoes: 3, respondidas: 3, emBranco: 0, naoSalvas: 1 })
    expect(impedimentoDoEnvio(comUmaNaFila)).toMatch(/^Uma resposta ainda não foi salva\./)
    expect(impedimentoDoEnvio({ naoSalvas: 2 })).toMatch(/^2 respostas ainda não foram salvas\./)
  })

  it('se a professora encerra com escolhas na fila, a tela diz quais não chegaram a ser salvas', () => {
    expect(avisoDeEscolhasPerdidas(fila({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }], falha: 'encerrada', tentativas: 1 }))).toBe(
      'A atividade foi encerrada antes de a resposta da questão 3 ser salva. Se isso fizer diferença, avise quem dá a aula.',
    )
    expect(avisoDeEscolhasPerdidas(fila({ pendentes: [{ questao: 5, alternativa: 1, sequencia: 1 }, { questao: 2, alternativa: 0, sequencia: 1 }], falha: 'encerrada', tentativas: 1 }))).toBe(
      'A atividade foi encerrada antes de as respostas das questões 2 e 5 serem salvas. Se isso fizer diferença, avise quem dá a aula.',
    )
    // Falha de rede não é encerramento: a escolha ainda vai ser salva, e nada foi perdido.
    expect(avisoDeEscolhasPerdidas(fila({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }], falha: 'passageira', tentativas: 1 }))).toBeUndefined()
    expect(avisoDeEscolhasPerdidas(fila({ falha: 'encerrada' }))).toBeUndefined()
  })

  it('a questão aberta fica dentro do que a atividade tem', () => {
    expect(questaoValida(0, 3)).toBe(1)
    expect(questaoValida(9, 3)).toBe(3)
    expect(questaoValida(2, 3)).toBe(2)
    expect(questaoValida(Number.NaN, 3)).toBe(1)
  })
})

describe('a comemoração é só da entrega (RF8; D59)', () => {
  const ENVIADA = prova({ enviadaEm: '2026-10-05T13:30:00.000Z' })
  const AGUARDANDO = { tipo: 'aguardando' } as const

  it('aparece com o envio confirmado nesta tela e a leitura já com o envio', () => {
    expect(comemoracaoNaTela(true, ENVIADA, AGUARDANDO)).toBe(true)
    // O resultado que ainda carrega, ou que falhou ao carregar, não tira a comemoração: ela não depende dele.
    expect(comemoracaoNaTela(true, ENVIADA, { tipo: 'carregando' })).toBe(true)
    expect(comemoracaoNaTela(true, ENVIADA, { tipo: 'erro', erro: new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) })).toBe(true)
  })

  it('a tarefa enviada em outra hora, aberta pela lista ou recarregada, não a tem: falta o envio desta tela', () => {
    expect(comemoracaoNaTela(false, ENVIADA, AGUARDANDO)).toBe(false)
  })

  it('sem o envio lido não há comemoração, nem a da tarefa encerrada pela professora', () => {
    expect(comemoracaoNaTela(true, prova(), AGUARDANDO)).toBe(false)
    expect(comemoracaoNaTela(true, prova({ estado: 'encerrada' }), AGUARDANDO)).toBe(false)
  })

  it('nunca divide a tela com o resultado: com a correção aprovada à vista, some', () => {
    expect(comemoracaoNaTela(true, ENVIADA, { tipo: 'pronto', diagnostico: DIAGNOSTICO })).toBe(false)
  })
})

describe('as falas da comemoração (regra 70, item 4a; D58; D59)', () => {
  /** O que se diz ao lado da onça: a fala e o botão. */
  const TEXTOS = [FALA_DA_ENTREGA, ROTULO_DE_VOLTAR_AS_TAREFAS]

  it('diz só o fato da entrega e de quem vê a correção: sem número, acerto, nota, tempo nem festa', () => {
    expect(FALA_DA_ENTREGA).toBe('Atividade entregue. Quem dá a aula vê a correção antes de você.')
    for (const texto of TEXTOS) {
      expect(texto).not.toMatch(/\d/)
      expect(texto).not.toMatch(/acert|errou|nota|conceito|ponto|%|tempo|minuto|segundo|rápid|parab[ée]ns|incr[ií]vel|muito bem|orgulh|feliz|!/i)
    }
  })

  it('não afirma ser pessoa, professor ou amigo, e não promete voltar, esperar ou estar sempre ali', () => {
    // A fala é do produto, em terceira pessoa: quem dá a aula é a professora, e a onça não diz "eu".
    expect(FALA_DA_ENTREGA).not.toMatch(/\b(?:eu|sou|estou|estarei|fico|ficarei|vou|te|lhe|meu|minha)\b/i)
    expect(FALA_DA_ENTREGA).not.toMatch(/\b(?:sou|somos)\s+(?:um|uma)?\s*(?:pessoa|gente|humano|professor|professora|amig[oa]|colega)/i)
    expect(FALA_DA_ENTREGA).not.toMatch(/\b(?:volto|voltarei|voltar|espero|esperarei|esperando|aguardo|estarei|sempre|aqui|ali)\b/i)
  })

  it('não tem vínculo nem saudade', () => {
    expect(FALA_DA_ENTREGA).not.toMatch(/saudade|sinto|falta|amig|carinho|v[ií]nculo|junt[oa]s?\b|nossa?s?\b|gosto|querid|amor/i)
  })

  it('o botão leva de volta às tarefas, e não é promessa: o "voltar" é do aluno, no imperativo da tela', () => {
    expect(ROTULO_DE_VOLTAR_AS_TAREFAS).toBe('Voltar às tarefas')
  })
})
