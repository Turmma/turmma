import { CHAVES_DE_FUNCAO, ErrorCode, montarTime, TIPOS_DE_ALERTA_DO_ANALISTA, type AlertaDoAnalista, type FuncaoDaGovernanca, type FuncoesDaGovernancaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { trocarFuncao } from './api/governanca'
import { textoDaAprovacao } from '../../../componentes/ui/ia/aprovacao'
import { O_QUE_A_IA_NUNCA_FAZ } from './nunca-faz'
import {
  agenteDoEndereco,
  aprovacaoDoItem,
  AVISO_DA_SUSPENSAO,
  AVISO_DO_NOMINAL,
  EFEITO_DA_SUSPENSAO,
  ESPERANDO_O_PROFESSOR,
  estadoDoEndereco,
  NOME_DA_AUTONOMIA,
  O_QUE_CHEGA_AO_ALUNO,
  falhaDoResumo,
  formatarPercentual,
  fraseDoAlerta,
  nomeDaFuncao,
  OPCOES_DO_ESTADO,
  textoDoConsumo,
  textoDoCusto,
  textoDoPacoteDoTutor,
  VAZIO_DO_FILTRO,
} from './textos-da-governanca'

const QUANDO = '2026-10-04T13:00:00.000Z'
const alerta: AlertaDoAnalista = {
  tipo: 'habilidade_com_acerto_baixo',
  serie: { id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', etapa: 'em', ano: 2 },
  disciplina: { id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c', nome: 'Química' },
  habilidade: { codigo: 'QUI.EM.06', descricao: 'Identificar o reagente limitante' },
  valor: 46.7,
  referencia: 60,
  hipoteses: ['poucas_atividades_no_tema'],
}

describe('a linha da governança diz que uma pessoa decidiu, nunca quem (D45, D64)', () => {
  it('a pendente espera o professor, e não "você": a coordenação não é quem aprova', () => {
    expect(textoDaAprovacao(aprovacaoDoItem({ estado: 'pendente', decididaEm: null }), { espera: ESPERANDO_O_PROFESSOR })).toBe('Esperando o professor')
  })

  it('a aprovada e a rejeitada dizem "um professor" e a data, sem nome', () => {
    const agora = new Date('2026-10-04T15:00:00.000Z')
    const aprovada = textoDaAprovacao(aprovacaoDoItem({ estado: 'aprovada', decididaEm: QUANDO }), { fuso: 'America/Sao_Paulo', agora })
    const rejeitada = textoDaAprovacao(aprovacaoDoItem({ estado: 'rejeitada', decididaEm: QUANDO }), { fuso: 'America/Sao_Paulo', agora })
    expect(aprovada).toBe('Aprovado por um professor · 04/10, 10h00')
    expect(rejeitada).toBe('Um professor rejeitou · 04/10, 10h00')
  })

  it('a entrega decidida sem data é tratada como pendente: a tela não inventa a decisão', () => {
    expect(aprovacaoDoItem({ estado: 'aprovada', decididaEm: null })).toEqual({ estado: 'pendente' })
  })

  it('o registro diz o agente e a função, como em "Assistente de ensino · Correção de objetiva"', () => {
    expect(nomeDaFuncao('correcao_de_objetiva')).toBe('Assistente de ensino · Correção de objetiva')
    expect(new Set(CHAVES_DE_FUNCAO.map(nomeDaFuncao)).size).toBe(CHAVES_DE_FUNCAO.length)
  })
})

describe('o consumo', () => {
  it('soma os tokens de entrada e de saída e diz as execuções', () => {
    expect(textoDoConsumo({ chamadas: 1, tokensDeEntrada: 1200, tokensDeSaida: 34 })).toBe('1.234 tokens · 1 execução')
    expect(textoDoConsumo({ chamadas: 8, tokensDeEntrada: 0, tokensDeSaida: 1 })).toBe('1 token · 8 execuções')
  })

  it('com o custo em zero, a tela diz que não é medido, e nunca "R$ 0,00"', () => {
    const texto = textoDoCusto({ custoMicros: 0, chamadas: 12 })
    expect(texto).toContain('não é medido')
    expect(texto).not.toContain('R$')
    expect(textoDoCusto({ custoMicros: 12_340_000, chamadas: 12 })).toMatch(/^Custo do mês: R\$\s12,34\.$/)
  })

  it('o pacote do Tutor é dito em trocas, contra o pacote da escola', () => {
    expect(textoDoPacoteDoTutor({ trocasNoMes: 412, pacoteDoMes: 9600 })).toBe('412 de 9.600 trocas')
  })
})

describe('o alerta do Analista é hipótese com contexto', () => {
  it('a frase diz o recorte, a habilidade, o número medido e a referência', () => {
    expect(fraseDoAlerta(alerta)).toBe('Em 2º ano do Ensino Médio · Química, o acerto em "Identificar o reagente limitante" (QUI.EM.06) ficou em 46,7%, abaixo de 60%, um limite provisório desta versão, a definir com a escola.')
  })

  it('a frase não conclui nem cita pessoa: nada de professor, aluno, turma, culpa ou recomendação', () => {
    const frase = fraseDoAlerta(alerta) ?? ''
    for (const proibido of ['professor', 'aluno', 'turma', 'culpa', 'deve', 'recomend', 'porque', 'por causa']) expect(frase.toLowerCase()).not.toContain(proibido)
  })

  it('só o alerta de habilidade com acerto baixo ganha frase: os outros tipos do contrato não aparecem na tela', () => {
    for (const tipo of TIPOS_DE_ALERTA_DO_ANALISTA) {
      const frase = fraseDoAlerta({ ...alerta, tipo })
      if (tipo === 'habilidade_com_acerto_baixo') expect(frase).not.toBeNull()
      else expect(frase, tipo).toBeNull()
    }
    expect(fraseDoAlerta({ ...alerta, habilidade: null })).toBeNull()
  })

  it('o percentual sai com vírgula e no máximo uma casa', () => {
    expect([formatarPercentual(50), formatarPercentual(46.7), formatarPercentual(66.66)]).toEqual(['50%', '46,7%', '66,7%'])
  })
})

describe('gerar o resumo: a falha nunca é erro cru', () => {
  it('a que passa sozinha oferece tentar de novo', () => {
    expect(falhaDoResumo(ErrorCode.IA_INDISPONIVEL)).toEqual({ repetivel: true, texto: '' })
  })

  it('a função suspensa manda retomar em Agentes, e não "falar com a coordenação": quem lê é a coordenação', () => {
    const { repetivel, texto } = falhaDoResumo(ErrorCode.FUNCAO_SUSPENSA)
    expect(repetivel).toBe(false)
    expect(texto).toContain('Agentes')
    expect(texto).not.toContain('coordenação')
  })

  it('o limite de pedidos pede para esperar, com calma', () => {
    expect(falhaDoResumo(ErrorCode.LIMITE_EXCEDIDO)).toEqual({ repetivel: false, texto: 'Foram muitos pedidos em pouco tempo. Espere um minuto e peça de novo.' })
  })
})

describe('a suspensão e o dado nominal dizem o que acontece antes de confirmar', () => {
  it('toda suspensão diz que as outras funções continuam, que nada é apagado e que o professor decide o que espera', () => {
    for (const chave of CHAVES_DE_FUNCAO) {
      expect(EFEITO_DA_SUSPENSAO[chave], chave).toContain('As outras funções continuam')
      expect(EFEITO_DA_SUSPENSAO[chave], chave).toContain('não é apagado')
      expect(EFEITO_DA_SUSPENSAO[chave], chave).toContain('continua podendo ser aprovado ou rejeitado')
    }
    expect(AVISO_DA_SUSPENSAO).toContain('auditoria')
  })

  it('cada função diz o que para nela, e o que nunca para (D36)', () => {
    expect(EFEITO_DA_SUSPENSAO.sinais_para_o_professor).toContain('Param os avisos de aprendizagem')
    expect(EFEITO_DA_SUSPENSAO.sinais_para_o_professor).toContain('aviso de que um aluno precisa de um adulto continua')
    expect(EFEITO_DA_SUSPENSAO.sinais_para_o_professor).toContain('uso do Tutor por turma continua visível')
    expect(EFEITO_DA_SUSPENSAO.tutor_com_o_aluno).toContain('continua recebendo a mensagem de encaminhamento')
    expect(EFEITO_DA_SUSPENSAO.correcao_de_objetiva).toContain('fica sem correção até a função voltar')
    expect(new Set(Object.values(EFEITO_DA_SUSPENSAO)).size).toBe(CHAVES_DE_FUNCAO.length)
  })

  it('a Governança diz que só o Tutor responde sem aprovação prévia, com o professor acompanhando (D47)', () => {
    expect(O_QUE_CHEGA_AO_ALUNO).toContain('Nenhum material nem diagnóstico da IA chega ao aluno sem um professor aprovar')
    expect(O_QUE_CHEGA_AO_ALUNO).toContain('o Tutor responde ao aluno na hora, com o professor acompanhando')
    expect(O_QUE_CHEGA_AO_ALUNO).not.toMatch(/nada do que a IA gera chega ao aluno/i)
  })

  it('o selo de autonomia diz em português comum o que a função faz, nunca o número do nível', () => {
    expect([NOME_DA_AUTONOMIA[1], NOME_DA_AUTONOMIA[2], NOME_DA_AUTONOMIA[3]]).toEqual(['Faz e registra', 'Faz e avisa', 'Propõe e espera aprovação'])
    for (const texto of Object.values(NOME_DA_AUTONOMIA)) expect(texto).not.toMatch(/\d|nível/)
  })

  it('abrir o dado nominal avisa que fica na auditoria', () => {
    expect(AVISO_DO_NOMINAL).toContain('auditoria')
    expect(AVISO_DO_NOMINAL).toContain('finalidade')
  })

  it('a lista do que a IA nunca faz traz as quatro coisas que a escola pergunta primeiro', () => {
    const lista = O_QUE_A_IA_NUNCA_FAZ.join('\n').toLowerCase()
    for (const trecho of ['aprovação, reprovação', 'redação e discursiva', 'inferir emoção', 'ranquear professores', 'tempo ocioso']) expect(lista).toContain(trecho)
  })
})

describe('a função que a API devolve entra no lugar da antiga', () => {
  const lista: FuncoesDaGovernancaResponse = { agentes: montarTime(new Set()).agentes.map((agente) => ({ ...agente, funcoes: agente.funcoes.map((funcao) => ({ ...funcao, suspensao: null })) })) }
  const suspensa: FuncaoDaGovernanca = { ...(lista.agentes[0]?.funcoes[1] as FuncaoDaGovernanca), suspensa: true, suspensao: { suspensaEm: QUANDO, motivo: 'incidente' } }

  it('só a função suspensa muda; as outras do mesmo agente e dos outros ficam como estavam', () => {
    const depois = trocarFuncao(lista, suspensa)
    const funcoes = depois?.agentes.flatMap((agente) => agente.funcoes) ?? []
    expect(funcoes.filter((funcao) => funcao.suspensa).map((funcao) => funcao.chave)).toEqual([suspensa.chave])
    expect(funcoes).toHaveLength(CHAVES_DE_FUNCAO.length)
  })

  it('sem lista lida, nada é inventado', () => {
    expect(trocarFuncao(undefined, suspensa)).toBeUndefined()
  })
})

describe('o filtro "Estado" da lista da governança (telas da coordenação, 10.0)', () => {
  it('as quatro opções, com o valor que a API e o endereço entendem, e "Todos" primeiro', () => {
    expect(OPCOES_DO_ESTADO).toEqual([
      { valor: 'todos', rotulo: 'Todos' },
      { valor: 'pendente', rotulo: 'Esperando o professor' },
      { valor: 'aprovada', rotulo: 'Aprovados' },
      { valor: 'rejeitada', rotulo: 'Rejeitados' },
    ])
  })

  it('o estado do endereço vale só se for um dos três da entrega; qualquer outro valor, inclusive "todos", é ignorado', () => {
    expect(estadoDoEndereco('estado=pendente')).toBe('pendente')
    expect(estadoDoEndereco('painel=ano&estado=aprovada')).toBe('aprovada')
    expect(estadoDoEndereco('estado=rejeitada')).toBe('rejeitada')
    for (const busca of ['', 'estado=', 'estado=todos', 'estado=APROVADA', 'estado=aprovada,pendente', 'estado=qualquer-coisa', 'professor=0197a1c0-0000-7000-8000-000000000301']) {
      expect(estadoDoEndereco(busca), busca).toBeUndefined()
    }
  })

  it('a IA do endereço vale só se for um dos três agentes; qualquer outro valor abre no Assistente de ensino', () => {
    expect(agenteDoEndereco('ia=tutor')).toBe('tutor')
    expect(agenteDoEndereco('estado=aprovada&ia=analista_de_desempenho_escolar')).toBe('analista_de_desempenho_escolar')
    expect(agenteDoEndereco('ia=assistente_de_ensino')).toBe('assistente_de_ensino')
    for (const busca of ['', 'ia=', 'ia=TUTOR', 'ia=tutor,assistente_de_ensino', 'ia=professor', 'estado=aprovada']) {
      expect(agenteDoEndereco(busca), busca).toBe('assistente_de_ensino')
    }
  })

  it('o vazio de cada estado diz o que vai aparecer ali, e nenhum diz quem decidiu nem de que turma é a entrega', () => {
    expect(Object.keys(VAZIO_DO_FILTRO).sort()).toEqual(['aprovada', 'pendente', 'rejeitada'])
    expect(VAZIO_DO_FILTRO.pendente.titulo).toBe('Nenhuma entrega esperando o professor')
    expect(VAZIO_DO_FILTRO.aprovada.titulo).toBe('Nenhuma entrega aprovada ainda')
    expect(VAZIO_DO_FILTRO.rejeitada.titulo).toBe('Nenhuma entrega rejeitada')
    for (const { titulo, descricao } of Object.values(VAZIO_DO_FILTRO)) expect(`${titulo} ${descricao}`).not.toMatch(/turma|quem (decidiu|aprovou)|por [A-Z]/)
  })
})
