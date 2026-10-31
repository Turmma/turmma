import { AGENTES, CHAVES_DE_FUNCAO, FUNCOES, NOMES_DOS_AGENTES } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { agenteDe, nomeDaAssinatura } from './signature'

describe('assinatura da IA', () => {
  it('o agente assina com o nome da função dele, e não com nome próprio (D17)', () => {
    expect(nomeDaAssinatura({ agente: 'assistente_de_ensino' })).toBe('Assistente de ensino')
    expect(nomeDaAssinatura({ agente: 'tutor' })).toBe('Tutor')
    expect(nomeDaAssinatura({ agente: 'analista_de_desempenho_escolar' })).toBe('Analista de desempenho escolar')
    for (const agente of AGENTES) expect(nomeDaAssinatura({ agente })).toBe(NOMES_DOS_AGENTES[agente])
  })

  it('a função assina como "Agente · função", com o agente que a declara', () => {
    expect(nomeDaAssinatura({ funcao: 'correcao_de_objetiva' })).toBe('Assistente · correção de objetiva')
    expect(nomeDaAssinatura({ funcao: 'adaptacao' })).toBe('Assistente · adaptação')
    expect(nomeDaAssinatura({ funcao: 'sinais_para_o_professor' })).toBe('Tutor · sinais para o professor')
    expect(nomeDaAssinatura({ funcao: 'resumo_e_alerta' })).toBe('Analista · resumo e alerta')
  })

  it('o avatar de uma função é o do agente dela, para toda função declarada', () => {
    for (const funcao of CHAVES_DE_FUNCAO) expect(agenteDe({ funcao })).toBe(FUNCOES[funcao].agente)
    expect(agenteDe({ funcao: 'tutor_com_o_aluno' })).toBe('tutor')
    expect(agenteDe({ agente: 'tutor' })).toBe('tutor')
  })

  it('não aceita agente e função juntos: a função já diz de quem é', () => {
    // @ts-expect-error o tipo recusa as duas chaves, que deixariam escrever "Tutor · correção de objetiva"
    expect(nomeDaAssinatura({ agente: 'tutor', funcao: 'correcao_de_objetiva' })).toBe('Assistente · correção de objetiva')
  })
})
