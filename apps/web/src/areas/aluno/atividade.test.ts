import { ErrorCode, type MeuDiagnosticoResponse, type ProvaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import {
  alternativaComTexto,
  alternativaMarcada,
  alternativaOriginal,
  anuncioDoRelogio,
  avisoDeEscolhasPerdidas,
  comemoracaoNaTela,
  countRespostas,
  FALA_DA_ENTREGA,
  faseDaAtividade,
  impedimentoDoEnvio,
  letraDaAlternativa,
  marcaDaQuestao,
  milissegundosQueFaltam,
  posicaoDaAlternativa,
  posicaoDaQuestao,
  questaoPorNumero,
  questaoValida,
  respostasSalvas,
  resultadoNaTela,
  ROTULO_DE_VOLTAR_AS_TAREFAS,
  rotuloNoMapa,
  textoDasEmBranco,
  textoDasRespondidas,
  textoDasQueAindaNaoChegaram,
  textoDasQueNaoChegaram,
  textoDoAcerto,
  textoDoEnvioQueFalhou,
  textoDoErroDaProva,
  textoDoRelogio,
  TEXTO_DA_MARCA,
  TEXTO_DE_AGUARDE,
  TEXTO_DE_ERRO_AO_ABRIR_A_PROVA,
  TEXTO_DO_ENVIO_QUE_NAO_SAIU,
} from './atividade'
import { FILA_VAZIA, type EstadoDaFila } from './respostas'

const ID = '0190f5a0-0000-7000-8000-0000000000a1'

const prova = (campos: Partial<ProvaResponse> = {}): ProvaResponse => ({
  atividadeAplicadaId: ID,
  titulo: 'Atividade de estequiometria',
  avaliativa: false,
  estado: 'aberta',
  adaptacao: null,
  questoes: [1, 2, 3].map((numero) => ({ numero, enunciado: `Enunciado ${String(numero)}`, alternativas: ['a', 'b', 'c', 'd'], ordemDasAlternativas: [0, 1, 2, 3] })),
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
  const NAO_ENCONTRADO = new ApiError(ErrorCode.NAO_ENCONTRADO)

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
    const queda = new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
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
    const contagem = countRespostas(comDuasSalvas, FILA_VAZIA)
    expect(contagem).toEqual({ questoes: 3, respondidas: 2, emBranco: 1, naoSalvas: 0 })
    expect(textoDasRespondidas(contagem)).toBe('2 de 3 questões')
    expect(textoDasEmBranco(contagem.emBranco)).toBe('1 questão em branco')
    expect(textoDasEmBranco(2)).toBe('2 questões em branco')
    expect(textoDasEmBranco(0)).toBe('Nenhuma questão em branco')
  })

  it('com escolha ainda não salva, o envio é segurado, e a tela diz por quê', () => {
    expect(impedimentoDoEnvio(countRespostas(comDuasSalvas, FILA_VAZIA))).toBeUndefined()
    const comUmaNaFila = countRespostas(comDuasSalvas, fila({ pendentes: [{ questao: 3, alternativa: 1, sequencia: 1 }], falha: 'passageira', tentativas: 1 }))
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
    expect(comemoracaoNaTela(true, ENVIADA, { tipo: 'erro', erro: new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) })).toBe(true)
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

describe('a prova embaralhada: o índice original e a posição na tela (avaliacao-e-correcao, 12.7)', () => {
  /** A questão 3 chegou na primeira posição, com as alternativas na ordem C, A, D, B (índices originais 2, 0, 3, 1). */
  const embaralhada = prova({
    questoes: [
      { numero: 3, enunciado: 'Terceira', alternativas: ['Seis', 'Quatro', 'Sete', 'Cinco'], ordemDasAlternativas: [2, 0, 3, 1] },
      { numero: 1, enunciado: 'Primeira', alternativas: ['Quatro', 'Cinco', 'Seis', 'Sete'], ordemDasAlternativas: [0, 1, 2, 3] },
    ],
  })

  it('acha a questão pelo número original, e não pela posição na lista', () => {
    expect(questaoPorNumero(embaralhada, 3)?.enunciado).toBe('Terceira')
    expect(questaoPorNumero(embaralhada, 1)?.enunciado).toBe('Primeira')
    expect(questaoPorNumero(embaralhada, 2)).toBeUndefined()
    expect(posicaoDaQuestao(embaralhada, 3)).toBe(1)
    expect(posicaoDaQuestao(embaralhada, 1)).toBe(2)
    // A questão que a prova não traz fica onde o número a põe: nunca "posição 0".
    expect(posicaoDaQuestao(embaralhada, 9)).toBe(9)
  })

  it('a alternativa da posição vira o índice original (é o que o `PUT` leva), e a conta inversa volta à posição', () => {
    const terceira = questaoPorNumero(embaralhada, 3)
    expect([0, 1, 2, 3].map((posicao) => alternativaOriginal(terceira, posicao))).toEqual([2, 0, 3, 1])
    expect([0, 1, 2, 3].map((original) => posicaoDaAlternativa(terceira, original))).toEqual([1, 3, 0, 2])
    // Sem a questão, a posição é o próprio índice, nos dois sentidos.
    expect(alternativaOriginal(undefined, 2)).toBe(2)
    expect(posicaoDaAlternativa(undefined, 2)).toBe(2)
  })

  it('o diagnóstico lê o texto e a letra pela posição em que o aluno viu a alternativa: "sua resposta" e "a certa" são as do índice original', () => {
    const terceira = questaoPorNumero(embaralhada, 3)
    // O índice original 2 ("Seis") estava na posição 0, e a tela mostrou "A. Seis".
    expect(alternativaComTexto(terceira, 2)).toBe('A. Seis')
    expect(alternativaComTexto(terceira, 0)).toBe('B. Quatro')
    // Sem a questão (a prova não a traz), só a letra, e nunca um texto de outra.
    expect(alternativaComTexto(undefined, 1)).toBe('B')
  })

  it('o aviso da resposta que não chegou diz o número que o aluno viu na tela, e não o original', () => {
    const fila: EstadoDaFila = { ...FILA_VAZIA, falha: 'encerrada', pendentes: [{ questao: 3, alternativa: 2, sequencia: 1 }] }
    expect(avisoDeEscolhasPerdidas(fila, (numero) => posicaoDaQuestao(embaralhada, numero))).toContain('questão 1 ')
    expect(avisoDeEscolhasPerdidas(fila)).toContain('questão 3 ')
  })
})

describe('o relógio da prova, com o desvio do servidor (RF6)', () => {
  const agoraDoServidor = Date.parse('2026-11-28T13:00:00.000Z')
  const limiteEm = '2026-11-28T13:30:00.000Z'

  it('o tempo que falta sai do limite menos o relógio do servidor: o computador 10 min adiantado não tira 10 min da prova', () => {
    // O computador marca 13:10 quando o servidor marca 13:00: o desvio é de -10 min.
    const tempo = { limiteEm, envio: null, desvioMs: -10 * 60_000 }
    expect(milissegundosQueFaltam(tempo, agoraDoServidor + 10 * 60_000)).toBe(30 * 60_000)
    // Sem o desvio, o mesmo relógio diria 20 min.
    expect(milissegundosQueFaltam({ ...tempo, desvioMs: 0 }, agoraDoServidor + 10 * 60_000)).toBe(20 * 60_000)
  })

  it('sem tempo lido ou sem limite, não há o que contar', () => {
    expect(milissegundosQueFaltam(undefined, agoraDoServidor)).toBeUndefined()
    expect(milissegundosQueFaltam({ limiteEm: null, envio: null, desvioMs: 0 }, agoraDoServidor)).toBeUndefined()
  })

  it('o texto é de minutos inteiros, para cima, e nunca de segundos', () => {
    expect(textoDoRelogio(12 * 60_000)).toBe('Faltam 12 min')
    expect(textoDoRelogio(11 * 60_000 + 1)).toBe('Faltam 12 min')
    expect(textoDoRelogio(60_000)).toBe('Falta menos de 1 min')
    expect(textoDoRelogio(1_000)).toBe('Falta menos de 1 min')
    expect(textoDoRelogio(0)).toBe('O tempo acabou')
    expect(textoDoRelogio(-5_000)).toBe('O tempo acabou')
  })

  it('o leitor de tela é avisado a 10, 5 e 1 min, uma vez cada, e a 11 min não é avisado', () => {
    const dito = new Set<number>()
    expect(anuncioDoRelogio(11 * 60_000, dito)).toBeUndefined()
    expect(anuncioDoRelogio(10 * 60_000, dito)).toEqual({ limiares: [10], texto: 'Faltam 10 minutos.' })
    dito.add(10)
    expect(anuncioDoRelogio(9 * 60_000, dito)).toBeUndefined()
    expect(anuncioDoRelogio(5 * 60_000, dito)).toEqual({ limiares: [10, 5], texto: 'Faltam 5 minutos.' })
    dito.add(5)
    expect(anuncioDoRelogio(60_000, dito)).toEqual({ limiares: [10, 5, 1], texto: 'Falta 1 minuto.' })
    dito.add(1)
    expect(anuncioDoRelogio(30_000, dito)).toBeUndefined()
    // O fim é do aviso `assertive`, e não deste.
    expect(anuncioDoRelogio(0, new Set())).toBeUndefined()
  })

  it('quem abre a prova com 8 min recebe um aviso só, e não o de 10 e o de 5', () => {
    const dito = new Set<number>()
    const aviso = anuncioDoRelogio(8 * 60_000, dito)
    expect(aviso).toEqual({ limiares: [10], texto: 'Faltam 8 minutos.' })
    for (const limiar of aviso?.limiares ?? []) dito.add(limiar)
    expect(anuncioDoRelogio(7 * 60_000, dito)).toBeUndefined()
  })
})

describe('os textos da prova em tela de foco (cenarios.md, seção 4)', () => {
  it('diz quantas respostas não chegaram, no fim e na lista, no singular e no plural', () => {
    expect(textoDasQueNaoChegaram(2)).toBe('2 respostas não chegaram. Chame o professor.')
    expect(textoDasQueNaoChegaram(1)).toBe('1 resposta não chegou. Chame o professor.')
    expect(textoDasQueAindaNaoChegaram(2)).toBe('2 respostas ainda não chegaram')
    expect(textoDasQueAindaNaoChegaram(1)).toBe('1 resposta ainda não chegou')
  })

  it('abrir a prova que falha diz para tentar de novo, e o limite por minuto pede para esperar; nenhum código aparece', () => {
    expect(textoDoErroDaProva(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(TEXTO_DE_ERRO_AO_ABRIR_A_PROVA)
    expect(textoDoErroDaProva(new Error('x'))).toBe('Não foi possível abrir a prova. Tente de novo.')
    expect(textoDoErroDaProva(new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe(TEXTO_DE_AGUARDE)
    expect(TEXTO_DE_AGUARDE).toBe('Aguarde um instante.')
  })

  it('"Enviar" que não saiu diz que as respostas estão guardadas e que o tempo da queda volta; o 429 pede para esperar', () => {
    expect(textoDoEnvioQueFalhou(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBe(TEXTO_DO_ENVIO_QUE_NAO_SAIU)
    expect(TEXTO_DO_ENVIO_QUE_NAO_SAIU).toBe('Não deu para enviar agora. Suas respostas estão guardadas; tente de novo em instantes. O tempo da queda volta para você.')
    expect(textoDoEnvioQueFalhou(new ApiError(ErrorCode.LIMITE_EXCEDIDO))).toBe(TEXTO_DE_AGUARDE)
  })
})
