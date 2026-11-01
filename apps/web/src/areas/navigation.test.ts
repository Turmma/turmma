import { describe, expect, it } from 'vitest'
import * as navegacao from './navigation'
import { estaNoItem, PERSON_MENU, NAVIGATION, SIDEBAR_FOOTER } from './navigation'

describe('navegação por papel', () => {
  it('W2: os quatro lugares da coordenação, os três do aluno (Início, Tarefas e Eu) e, na ordem da D80, "Início" (era "Nova conversa"), "Turmas", "Ferramentas" e "Criados" do professor têm tela', () => {
    expect(NAVIGATION.professor.map(({ rotulo, caminho }) => ({ rotulo, caminho }))).toEqual([
      { rotulo: 'Início', caminho: '/professor/nova-conversa' },
      { rotulo: 'Turmas', caminho: '/professor/turmas' },
      { rotulo: 'Ferramentas', caminho: '/professor/ferramentas' },
      { rotulo: 'Criados', caminho: '/professor/criados' },
    ])
    // X4 (2.0): o aluno tem Início, Tarefas e Eu, nesta ordem, e mais nada. Tarefas ficou no endereço de Atividades.
    expect(NAVIGATION.aluno.map(({ rotulo, caminho }) => ({ rotulo, caminho }))).toEqual([
      { rotulo: 'Início', caminho: '/aluno/inicio' },
      { rotulo: 'Tarefas', caminho: '/aluno/atividades' },
      { rotulo: 'Eu', caminho: '/aluno/eu' },
    ])
    // X2 (3.0): a coordenação tem quatro lugares, nesta ordem, e o Painel é o primeiro.
    expect(NAVIGATION.coordenador.map(({ rotulo, caminho }) => ({ rotulo, caminho }))).toEqual([
      { rotulo: 'Painel', caminho: '/coordenacao/painel' },
      { rotulo: 'Analista', caminho: '/coordenacao/analista' },
      { rotulo: 'Escola', caminho: '/coordenacao/estrutura' },
      { rotulo: 'Registros', caminho: '/coordenacao/governanca' },
    ])
  })

  it('X2: "Privacidade" já não é item da lista, e o professor e o aluno não a têm na lista de seções', () => {
    // Na coordenação a Privacidade é uma aba de Registros; a do aluno é uma linha de Eu (X4, 2.0).
    expect(NAVIGATION.coordenador.map((item) => item.rotulo)).not.toContain('Privacidade')
    expect(NAVIGATION.professor.map((item) => item.rotulo)).not.toContain('Privacidade')
    expect(NAVIGATION.aluno.map((item) => item.rotulo)).not.toContain('Privacidade')
  })

  it('X4 (2.0, 10.0 e 11.0): o aluno não tem rodapé fixo nem menu da pessoa com links; o professor tem "Meus dados" e "Rever a introdução" no menu, nesta ordem, e a coordenação só a "Rever a introdução"', () => {
    expect(PERSON_MENU.professor.map(({ rotulo, caminho }) => ({ rotulo, caminho }))).toEqual([
      { rotulo: 'Meus dados', caminho: '/professor/meus-dados' },
      { rotulo: 'Rever a introdução', caminho: '/professor/bem-vindo' },
    ])
    // "Privacidade" do aluno saiu do rodapé e virou uma linha de Eu: o rodapé de nenhum papel tem item.
    for (const papel of ['aluno', 'professor', 'coordenador'] as const) expect(SIDEBAR_FOOTER[papel], papel).toEqual([])
    expect(PERSON_MENU.aluno).toEqual([])
    // A coordenação não é titular de pedido (a API não lhe dá `meus_dados`): o menu dela tem só o link para rever a introdução.
    expect(PERSON_MENU.coordenador.map(({ rotulo, caminho }) => ({ rotulo, caminho }))).toEqual([{ rotulo: 'Rever a introdução', caminho: '/coordenacao/bem-vindo' }])
    // Nenhum item do menu da pessoa repete um da lista de seções do mesmo papel: seriam duas linhas para a mesma tela.
    for (const papel of ['aluno', 'professor', 'coordenador'] as const) {
      const secoes = new Set(NAVIGATION[papel].map((item) => item.caminho))
      for (const item of PERSON_MENU[papel]) expect(secoes.has(item.caminho)).toBe(false)
    }
  })

  it('F3 (18.0): "Meus dados" fica selecionado no endereço dele, e nenhuma seção do professor fica selecionada ali', () => {
    const [meusDados] = PERSON_MENU.professor
    if (meusDados === undefined) throw new Error('faltou item no menu da pessoa')
    expect(estaNoItem('/professor/meus-dados', meusDados)).toBe(true)
    for (const item of NAVIGATION.professor) expect(estaNoItem('/professor/meus-dados', item)).toBe(false)
    // Um endereço que só começa com as mesmas letras é outra tela.
    expect(estaNoItem('/professor/meus-dados-antigos', meusDados)).toBe(false)
  })

  it('X4 (2.0): cada endereço do aluno acende o lugar dele, e só ele — o Tutor e a conversa em Início, Privacidade em Eu, a tarefa aberta em Tarefas', () => {
    const acesos = (caminho: string) => NAVIGATION.aluno.filter((item) => estaNoItem(caminho, item)).map((item) => item.rotulo)
    const ID = '0190f5a0-0000-7000-8000-000000000001'
    expect(acesos('/aluno/inicio')).toEqual(['Início'])
    expect(acesos('/aluno/tutor')).toEqual(['Início'])
    expect(acesos(`/aluno/tutor/${ID}`)).toEqual(['Início'])
    expect(acesos('/aluno/atividades')).toEqual(['Tarefas'])
    expect(acesos(`/aluno/atividades/${ID}`)).toEqual(['Tarefas'])
    expect(acesos('/aluno/eu')).toEqual(['Eu'])
    expect(acesos('/aluno/privacidade')).toEqual(['Eu'])
    // Um endereço que só começa com as mesmas letras é outra tela, e "Minha turma" já não é lugar de ninguém.
    expect(acesos('/aluno/privacidade-antiga')).toEqual([])
    expect(acesos('/aluno/eu-mesmo')).toEqual([])
    expect(acesos('/aluno/minha-turma')).toEqual([])
    expect(acesos('/aluno/bem-vindo')).toEqual([])
  })

  it('X2 (3.0): cada endereço de hoje da coordenação acende o lugar dele, e só ele', () => {
    const lugares = Object.fromEntries(NAVIGATION.coordenador.map((item) => [item.rotulo, item]))
    const acesos = (caminho: string) => NAVIGATION.coordenador.filter((item) => estaNoItem(caminho, item)).map((item) => item.rotulo)
    const ID = '0190f5a0-0000-7000-8000-000000000001'
    expect(Object.keys(lugares)).toEqual(['Painel', 'Analista', 'Escola', 'Registros'])
    expect(acesos('/coordenacao/painel')).toEqual(['Painel'])
    expect(acesos('/coordenacao/analista')).toEqual(['Analista'])
    // Escola: as três abas e a lista da turma, que é a Estrutura aberta.
    for (const caminho of ['/coordenacao/estrutura', `/coordenacao/estrutura/turmas/${ID}`, '/coordenacao/professores', '/coordenacao/material']) expect(acesos(caminho), caminho).toEqual(['Escola'])
    // Registros: a IA, os agentes, os pedidos, o detalhe do pedido e as três telas da Privacidade.
    for (const caminho of [
      '/coordenacao/governanca',
      '/coordenacao/agentes',
      '/coordenacao/privacidade',
      '/coordenacao/privacidade/pedidos',
      `/coordenacao/privacidade/pedidos/${ID}`,
      '/coordenacao/privacidade/retencao',
      '/coordenacao/privacidade/suboperadores',
      '/coordenacao/privacidade/incidentes',
    ])
      expect(acesos(caminho), caminho).toEqual(['Registros'])
    // Um endereço que só começa com as mesmas letras é outra tela.
    expect(acesos('/coordenacao/professores-antigos')).toEqual([])
    expect(acesos('/coordenacao/governanca-velha')).toEqual([])
  })

  it('X3 (6.0): o documento aberto acende Criados, a lista de onde ele vem, e só ela', () => {
    const acesos = (caminho: string) => NAVIGATION.professor.filter((item) => estaNoItem(caminho, item)).map((item) => item.rotulo)
    const ID = '0190f5a0-0000-7000-8000-000000000001'
    expect(acesos(`/professor/artefatos/${ID}`)).toEqual(['Criados'])
    expect(acesos('/professor/criados')).toEqual(['Criados'])
    expect(acesos('/professor/ferramentas/adaptacao')).toEqual(['Ferramentas'])
    // Um endereço que só começa com as mesmas letras é outra tela.
    expect(acesos('/professor/artefatos-velhos')).toEqual([])
  })

  it('D73: cada item só aparece com a fase dele — o professor não tem Calendário nem Histórico, e os agentes não são lugar da lateral (X3, 2.0)', () => {
    const rotulos = NAVIGATION.professor.map((item) => item.rotulo)
    expect(rotulos).not.toContain('Calendário')
    expect(rotulos).not.toContain('Histórico')
    // "Seu time" saiu: o Assistente e o Tutor abrem pelo pé do sino, e nenhum papel tem item de agente na lateral.
    for (const papel of ['professor', 'aluno', 'coordenador'] as const) {
      const nomes = [...NAVIGATION[papel], ...SIDEBAR_FOOTER[papel], ...PERSON_MENU[papel]].map((item) => item.rotulo)
      expect(nomes, papel).not.toContain('Assistente de ensino')
      expect(nomes, papel).not.toContain('Seu time')
    }
    expect(navegacao).not.toHaveProperty('SEU_TIME')
  })

  it('o aluno não tem item que leva a tela inexistente nesta fatia: nem Tutor, Atividades, Minha turma e Privacidade como seção, nem Avisar um adulto', () => {
    const rotulos = NAVIGATION.aluno.map((item) => item.rotulo)
    for (const fora of ['Tutor', 'Atividades', 'Minha turma', 'Meu desempenho', 'Privacidade', 'Avisar um adulto', 'Ranking', 'Colegas']) expect(rotulos).not.toContain(fora)
  })

  it('a conversa aberta fica dentro de "Início", e o documento aberto, dentro de "Criados" (X3, 6.0)', () => {
    const [inicio, , ferramentas, criados] = NAVIGATION.professor
    if (inicio === undefined || ferramentas === undefined || criados === undefined) throw new Error('faltou item na navegação do professor')
    expect(estaNoItem('/professor/conversa', inicio)).toBe(true)
    expect(estaNoItem('/professor/conversa', ferramentas)).toBe(false)
    expect(estaNoItem('/professor/artefatos/0190f5a0-0000-7000-8000-000000000001', criados)).toBe(true)
    expect(estaNoItem('/professor/artefatos/0190f5a0-0000-7000-8000-000000000001', ferramentas)).toBe(false)
    expect(estaNoItem('/professor/ferramentas/adaptacao', ferramentas)).toBe(true)
    expect(estaNoItem('/professor/artefatos/0190f5a0-0000-7000-8000-000000000001', inicio)).toBe(false)
    // As telas do pé do sino não são de nenhum item: a lateral não acende nada nelas.
    for (const item of NAVIGATION.professor) {
      expect(estaNoItem('/professor/time/assistente', item), item.rotulo).toBe(false)
      expect(estaNoItem('/professor/time/tutor', item), item.rotulo).toBe(false)
    }
    expect(estaNoItem('/professor/conversas', inicio)).toBe(false)
  })

  it('o item fica selecionado no endereço dele e abaixo dele, e só neles', () => {
    const turmas = { caminho: '/professor/turmas' }
    expect(estaNoItem('/professor/turmas', turmas)).toBe(true)
    expect(estaNoItem('/professor/turmas/0190f5a0-0000-7000-8000-000000000001', turmas)).toBe(true)
    // Um endereço que só começa com as mesmas letras é outra tela.
    expect(estaNoItem('/professor/turmas-antigas', turmas)).toBe(false)
    expect(estaNoItem('/professor', turmas)).toBe(false)
    expect(estaNoItem('/', turmas)).toBe(false)
  })
})
