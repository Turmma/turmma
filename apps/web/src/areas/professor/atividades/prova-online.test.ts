import { describe, expect, it } from 'vitest'
import {
  alunosDoAcompanhamento,
  avisoDeQuemAindaFaz,
  conferirAJanela,
  conferirAMudancaDeJanela,
  conferirAProva,
  efeitoDeEstender,
  FORMULARIO_VAZIO_DA_PROVA,
  horaNaEscola,
  instanteDaParedeDaEscola,
  maisMinutos,
  minutosDaExtensao,
  paredeDaEscolaDoInstante,
  resumoDaProva,
  TEXTO_DA_DURACAO_FORA,
  TEXTO_DA_DURACAO_OBRIGATORIA,
  TEXTO_DO_ABRE_VAZIO,
  TEXTO_DO_FECHA_ANTES_DE_ABRIR,
  TEXTO_DO_FECHA_VAZIO,
  TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO,
  textoDaSituacao,
  textoDoTempoQueNaoCabe,
  type AlunoNoAcompanhamento,
  type FormularioDaProva,
} from './prova-online'

/**
 * As contas da tela de aplicar a prova (avaliacao-e-correcao, 10.0; RF1 a RF3): o horário da parede da escola, o resumo, o que o formulário recusa antes
 * de enviar e o texto do tempo que não cabe. Nenhuma depende do fuso do computador: o fuso entra por parâmetro e o teste troca o da escola por outro.
 */

const ANA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d'
const BIA = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e'
const PROVA: FormularioDaProva = { ...FORMULARIO_VAZIO_DA_PROVA, abre: '2026-11-24T10:00', fecha: '2026-11-24T11:40', duracao: '40' }

describe('o horário é o da parede da escola, e não o do computador', () => {
  it('10:00 em São Paulo é 13:00 em UTC; no mesmo texto, outro fuso dá outro instante; e o caminho de volta devolve o texto', () => {
    expect(instanteDaParedeDaEscola('2026-11-24T10:00')).toBe('2026-11-24T13:00:00.000Z')
    expect(instanteDaParedeDaEscola('2026-11-24T10:00', 'UTC')).toBe('2026-11-24T10:00:00.000Z')
    expect(instanteDaParedeDaEscola('2026-11-24T10:00', 'Asia/Tokyo')).toBe('2026-11-24T01:00:00.000Z')
    expect(paredeDaEscolaDoInstante('2026-11-24T13:00:00.000Z')).toBe('2026-11-24T10:00')
    expect(paredeDaEscolaDoInstante('2026-11-24T13:00:00.000Z', 'UTC')).toBe('2026-11-24T13:00')
  })

  it('vira o dia: 23:30 em São Paulo já é o dia seguinte em UTC, e a volta devolve o dia certo', () => {
    expect(instanteDaParedeDaEscola('2026-11-24T23:30')).toBe('2026-11-25T02:30:00.000Z')
    expect(paredeDaEscolaDoInstante('2026-11-25T02:30:00.000Z')).toBe('2026-11-24T23:30')
  })

  it('a hora que não existe na parede do fuso (a que pula na virada do horário de verão) não vira instante', () => {
    // Em Nova York, às 02:00 de 08/03/2026 o relógio vai para 03:00: 02:30 não existe, e o instante achado volta como 01:30 ou 03:30.
    expect(instanteDaParedeDaEscola('2026-03-08T02:30', 'America/New_York')).toBeUndefined()
    expect(instanteDaParedeDaEscola('2026-03-08T03:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z')
  })

  it('o que não é horário (vazio, sem a hora, dia que não existe) não vira instante', () => {
    for (const texto of ['', '2026-11-24', '2026-11-24T10', '2026-02-30T10:00', 'amanhã', '2026-11-24T10:00:30', ' 2026-11-24T10:00', '2026-11-24T10:00 ']) expect(instanteDaParedeDaEscola(texto), texto).toBeUndefined()
  })
})

describe('o resumo antes de confirmar', () => {
  const janela = { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' }

  it('diz a turma, a abertura, o fim sem repetir o dia, a duração e quantos têm tempo adicional, no horário da escola', () => {
    expect(resumoDaProva({ turma: '7ºA', janela, duracaoMin: 40, comTempoAdicional: 2 })).toBe('7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo adicional')
  })

  it('o mesmo instante mostra outra hora num fuso que não é o da escola: a hora que vale é a do fuso que a tela passa', () => {
    expect(resumoDaProva({ turma: '7ºA', janela, duracaoMin: 40, comTempoAdicional: 0 }, 'UTC')).toBe('7ºA · abre 24/11 às 13:00 · fecha às 14:40 · 40 min')
  })

  it('o fim em outro dia leva o dia; sem duração e sem tempo adicional, as duas partes somem; um aluno é singular', () => {
    const doisDias = { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-25T13:00:00.000Z' }
    expect(resumoDaProva({ turma: '7ºA', janela: doisDias, comTempoAdicional: 0 })).toBe('7ºA · abre 24/11 às 10:00 · fecha 25/11 às 10:00')
    expect(resumoDaProva({ turma: '7ºA', janela, duracaoMin: 40, comTempoAdicional: 1 })).toBe('7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 1 aluno com tempo adicional')
  })

  it('a prova que passa da meia-noite da escola leva o dia no fim: abre 24/11 às 23:30 e fecha 25/11 às 00:30', () => {
    const tarde = { abreEm: '2026-11-25T02:30:00.000Z', fechaEm: '2026-11-25T03:30:00.000Z' }
    expect(resumoDaProva({ turma: '7ºA', janela: tarde, comTempoAdicional: 0 })).toBe('7ºA · abre 24/11 às 23:30 · fecha 25/11 às 00:30')
  })
})

describe('o tempo que não cabe na janela', () => {
  it('a frase leva a duração, o maior percentual e a janela que cabe: com 40 min e +50% são 60; com 30 min e +100% são 60, e com 25 min e +25% são 32', () => {
    expect(textoDoTempoQueNaoCabe(40, 50)).toBe('O tempo adicional não cabe na janela: com 40 min e +50%, a janela precisa de 60 min.')
    expect(textoDoTempoQueNaoCabe(30, 100)).toBe('O tempo adicional não cabe na janela: com 30 min e +100%, a janela precisa de 60 min.')
    expect(textoDoTempoQueNaoCabe(25, 25)).toBe('O tempo adicional não cabe na janela: com 25 min e +25%, a janela precisa de 32 min.')
  })

  it('o formulário com 50 min de janela, 40 de duração e um aluno com +50% recusa no campo "Fecha em", com a frase; com 60 min, passa', () => {
    const curta = conferirAProva({ ...PROVA, fecha: '2026-11-24T10:50', tempoAdicional: { [ANA]: 50 } })
    expect(curta.pedido).toBeUndefined()
    expect(curta.erros).toEqual({ fecha: 'O tempo adicional não cabe na janela: com 40 min e +50%, a janela precisa de 60 min.' })
    expect(conferirAProva({ ...PROVA, fecha: '2026-11-24T11:00', tempoAdicional: { [ANA]: 50 } }).erros).toEqual({})
  })

  it('com vários alunos, o maior percentual decide a frase', () => {
    const curta = conferirAProva({ ...PROVA, fecha: '2026-11-24T10:50', duracao: '30', tempoAdicional: { [ANA]: 25, [BIA]: 100 } })
    expect(curta.erros.fecha).toBe(textoDoTempoQueNaoCabe(30, 100))
  })
})

describe('o formulário da prova conferido antes de enviar', () => {
  it('sem nada escrito, os dois horários são erro; com tudo certo, o pedido sai no formato da API, em UTC', () => {
    expect(conferirAProva(FORMULARIO_VAZIO_DA_PROVA).erros).toEqual({ abre: TEXTO_DO_ABRE_VAZIO, fecha: TEXTO_DO_FECHA_VAZIO })
    const conferida = conferirAProva({ ...PROVA, embaralhar: { questoes: true, alternativas: false }, tempoAdicional: { [ANA]: 25, [BIA]: 100 } })
    expect(conferida.erros).toEqual({})
    expect(conferida.pedido).toEqual({
      janela: { abreEm: '2026-11-24T13:00:00.000Z', fechaEm: '2026-11-24T14:40:00.000Z' },
      duracaoMin: 40,
      embaralhar: { questoes: true, alternativas: false },
      tempoAdicional: [
        { alunoId: ANA, percentual: 25 },
        { alunoId: BIA, percentual: 100 },
      ],
    })
  })

  it('o fim antes da abertura (ou igual a ela) é erro do "Fecha em"', () => {
    expect(conferirAProva({ ...PROVA, fecha: '2026-11-24T09:00' }).erros).toEqual({ fecha: TEXTO_DO_FECHA_ANTES_DE_ABRIR })
    expect(conferirAProva({ ...PROVA, fecha: PROVA.abre }).erros).toEqual({ fecha: TEXTO_DO_FECHA_ANTES_DE_ABRIR })
  })

  it('a duração vale de 5 a 300 minutos, inteira; vazia é prova sem duração (e sai sem o campo)', () => {
    for (const ruim of ['4', '301', '40,5', '0', '-10', 'muito']) expect(conferirAProva({ ...PROVA, duracao: ruim }).erros, ruim).toEqual({ duracao: TEXTO_DA_DURACAO_FORA })
    for (const boa of ['5', '300']) expect(conferirAProva({ ...PROVA, duracao: boa }).erros, boa).toEqual({})
    const semDuracao = conferirAProva({ ...PROVA, duracao: '' })
    expect(semDuracao.erros).toEqual({})
    expect(semDuracao.pedido).not.toHaveProperty('duracaoMin')
  })

  it('tempo adicional sem duração é erro do "Tempo adicional", e a conta da janela não se faz sem duração', () => {
    const semDuracao = conferirAProva({ ...PROVA, duracao: '', tempoAdicional: { [ANA]: 25 } })
    expect(semDuracao.erros).toEqual({ tempoAdicional: TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO })
    expect(semDuracao.pedido).toBeUndefined()
  })

  it('a prova sem embaralhar nem tempo adicional manda as duas coisas vazias, e não omite o campo', () => {
    expect(conferirAProva(PROVA).pedido).toMatchObject({ embaralhar: { questoes: false, alternativas: false }, tempoAdicional: [] })
  })
})

describe('a mudança de janela', () => {
  it('confere o horário e a duração como o aplicar, e o pedido leva só a janela e a duração', () => {
    expect(conferirAJanela({ abre: '', fecha: '', duracao: '' }).erros).toEqual({ abre: TEXTO_DO_ABRE_VAZIO, fecha: TEXTO_DO_FECHA_VAZIO })
    const mudanca = conferirAMudancaDeJanela({ abre: '2026-11-25T10:00', fecha: '2026-11-25T12:00', duracao: '60' }, true)
    expect(mudanca.erros).toEqual({})
    expect(mudanca.pedido).toEqual({ janela: { abreEm: '2026-11-25T13:00:00.000Z', fechaEm: '2026-11-25T15:00:00.000Z' }, duracaoMin: 60 })
  })

  it('a prova que já tem duração não a deixa vazia (o PATCH parcial não a tira); a que não tinha, pode seguir sem', () => {
    const campos = { abre: '2026-11-25T10:00', fecha: '2026-11-25T12:00', duracao: '' }
    expect(conferirAMudancaDeJanela(campos, true).erros).toEqual({ duracao: TEXTO_DA_DURACAO_OBRIGATORIA })
    expect(conferirAMudancaDeJanela(campos, true).pedido).toBeUndefined()
    const semDuracao = conferirAMudancaDeJanela(campos, false)
    expect(semDuracao.erros).toEqual({})
    expect(semDuracao.pedido).toStrictEqual({ janela: { abreEm: '2026-11-25T13:00:00.000Z', fechaEm: '2026-11-25T15:00:00.000Z' } })
  })

  it('sem horário escrito, ou com a duração fora de 5 a 300, não há pedido: só o erro do campo', () => {
    const vazio = conferirAMudancaDeJanela({ abre: '', fecha: '', duracao: '60' }, true)
    expect(vazio.erros).toEqual({ abre: TEXTO_DO_ABRE_VAZIO, fecha: TEXTO_DO_FECHA_VAZIO })
    expect(vazio.pedido).toBeUndefined()
    const curta = conferirAMudancaDeJanela({ abre: '2026-11-25T10:00', fecha: '2026-11-25T12:00', duracao: '4' }, true)
    expect(curta.erros).toEqual({ duracao: TEXTO_DA_DURACAO_FORA })
    expect(curta.pedido).toBeUndefined()
    expect(conferirAJanela({ abre: '2026-11-25T10:00', fecha: '2026-11-25T12:00', duracao: '60' })).toStrictEqual({
      erros: {},
      janela: { abreEm: '2026-11-25T13:00:00.000Z', fechaEm: '2026-11-25T15:00:00.000Z' },
      duracaoMin: 60,
    })
    expect(conferirAJanela({ abre: '2026-11-25T10:00', fecha: '2026-11-25T12:00', duracao: '' })).toStrictEqual({ erros: {}, janela: { abreEm: '2026-11-25T13:00:00.000Z', fechaEm: '2026-11-25T15:00:00.000Z' } })
  })
})

describe('o acompanhamento da prova (11.0; RF4)', () => {
  const aluno = (n: number, nome: string, situacao: AlunoNoAcompanhamento['situacao'], limiteEm: string | null = null): AlunoNoAcompanhamento => ({ alunoId: `0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a${String(n).padStart(2, '0')}`, nome, situacao, limiteEm })

  it('a hora é a da parede da escola, e o fuso entra por parâmetro: 13:42 UTC é 10:42 em São Paulo e 22:42 em Tóquio', () => {
    expect(horaNaEscola('2026-11-24T13:42:00.000Z')).toBe('10:42')
    expect(horaNaEscola('2026-11-24T13:42:00.000Z', 'Asia/Tokyo')).toBe('22:42')
  })

  it('a situação é texto: o "termina às" só existe em "fazendo", e "Tempo esgotado" não diz falta nem consequência', () => {
    expect(textoDaSituacao(aluno(1, 'Ana', 'fazendo', '2026-11-24T13:42:00.000Z'))).toBe('Fazendo · termina às 10:42')
    expect(textoDaSituacao(aluno(1, 'Ana', 'fazendo', '2026-11-24T13:42:00.000Z'), 'Asia/Tokyo')).toBe('Fazendo · termina às 22:42')
    expect(textoDaSituacao(aluno(1, 'Ana', 'fazendo'))).toBe('Fazendo')
    expect(textoDaSituacao(aluno(2, 'Bia', 'nao_comecou'))).toBe('Não começou')
    expect(textoDaSituacao(aluno(3, 'Caio', 'enviou'))).toBe('Enviou')
    expect(textoDaSituacao(aluno(4, 'Dora', 'tempo_esgotado'))).toBe('Tempo esgotado')
  })

  it('em ordem de nome (o id desempata) e nunca por situação; dois nomes iguais, sem caixa nem espaço de sobra, ganham "(1 de 2)" e "(2 de 2)", e o nome único fica como está', () => {
    const lista = alunosDoAcompanhamento([aluno(9, 'Bia Lima', 'enviou'), aluno(5, 'Ana  Souza', 'fazendo'), aluno(3, ' ana souza ', 'nao_comecou'), aluno(1, 'Caio Rocha', 'fazendo')])
    expect(lista.map(({ nomeNaTela }) => nomeNaTela)).toEqual(expect.arrayContaining(['Bia Lima', 'Caio Rocha']))
    const homonimos = lista.filter(({ aluno: a }) => /ana\s+souza/i.test(a.nome))
    expect(homonimos.map(({ nomeNaTela }) => nomeNaTela.slice(-8))).toEqual(['(1 de 2)', '(2 de 2)'])
    // Entre os iguais a ordem é a do id, e não a de chegada.
    expect(homonimos.map(({ aluno: a }) => a.alunoId.slice(-2))).toEqual(['03', '05'])
    expect(lista.map(({ aluno: a }) => a.nome.trim().split(/\s+/)[0]?.toLowerCase())).toEqual(['ana', 'ana', 'bia', 'caio'])
    expect(alunosDoAcompanhamento([])).toEqual([])
  })

  it('maisMinutos soma ao instante; os minutos da extensão são inteiro de 1 a 120, e o resto é recusado', () => {
    expect(maisMinutos('2026-11-24T13:42:00.000Z', 10)).toBe('2026-11-24T13:52:00.000Z')
    expect(minutosDaExtensao('1')).toBe(1)
    expect(minutosDaExtensao(' 120 ')).toBe(120)
    for (const texto of ['', '0', '121', '-5', '2.5', 'dez', '1e1']) expect(minutosDaExtensao(texto), texto).toBeUndefined()
  })

  it('o efeito de estender: o horário novo ao lado do velho para quem faz (10 min: 10:52; 5 min: 10:47), os minutos para quem não faz, e o que anda junto para a turma', () => {
    const fazendo = aluno(1, 'Ana', 'fazendo', '2026-11-24T13:42:00.000Z')
    expect(efeitoDeEstender({ tipo: 'aluno', nome: 'Ana Souza', aluno: fazendo }, 10)).toBe('Ana Souza termina às 10:52 em vez de 10:42.')
    expect(efeitoDeEstender({ tipo: 'aluno', nome: 'Ana Souza', aluno: fazendo }, 5)).toBe('Ana Souza termina às 10:47 em vez de 10:42.')
    expect(efeitoDeEstender({ tipo: 'aluno', nome: 'Bia Lima', aluno: aluno(2, 'Bia', 'nao_comecou') }, 1)).toBe('Bia Lima ganha 1 minuto a mais na prova.')
    // Quem faz a prova sem relógio (sem duração) não tem horário de fim a mostrar.
    expect(efeitoDeEstender({ tipo: 'aluno', nome: 'Dora Alves', aluno: aluno(4, 'Dora', 'fazendo', null) }, 10)).toBe('Dora Alves ganha 10 minutos a mais na prova.')
    // Quem não está fazendo não tem "termina às", mesmo com um limite na leitura.
    expect(efeitoDeEstender({ tipo: 'aluno', nome: 'Caio Rocha', aluno: aluno(3, 'Caio', 'tempo_esgotado', '2026-11-24T13:42:00.000Z') }, 10)).toBe('Caio Rocha ganha 10 minutos a mais na prova.')
    expect(efeitoDeEstender({ tipo: 'turma' }, 15)).toMatch(/^A turma toda ganha 15 minutos: quem está fazendo termina 15 minutos depois/)
    expect(efeitoDeEstender({ tipo: 'turma' }, undefined)).toMatch(/Diga quantos minutos a mais/)
  })

  it('o aviso do encerramento conta quem faz, no plural e no singular, e com ninguém fazendo não diz nada', () => {
    expect(avisoDeQuemAindaFaz(3)).toBe('3 alunos ainda estão fazendo. As respostas salvas deles vão para a correção.')
    expect(avisoDeQuemAindaFaz(1)).toBe('1 aluno ainda está fazendo. As respostas salvas dele vão para a correção.')
    expect(avisoDeQuemAindaFaz(0)).toBeUndefined()
  })
})
