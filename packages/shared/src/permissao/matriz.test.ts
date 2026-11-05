import { describe, expect, it } from 'vitest'
import { EXPECTATIVA_DA_MATRIZ } from './matriz.expectativa.js'
import { ALCANCES, ALCANCES_INDIVIDUAIS, alcanceDe, MATRIZ, PAPEIS, RECURSOS, type Alcance } from './matriz.js'

/** Toda célula da matriz, como a expectativa as escreve. */
function celulasDa(matriz: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>>): string[] {
  return Object.entries(matriz).flatMap(([papel, recursos]) =>
    Object.entries(recursos).flatMap(([recurso, acoes]) => Object.entries(acoes).map(([acao, alcance]) => `${papel}|${recurso}|${acao}|${alcance}`)),
  )
}

const expectativa = EXPECTATIVA_DA_MATRIZ.map((linha) => linha.join('|'))

describe('MATRIZ de permissão', () => {
  it('cada célula da matriz está na expectativa escrita à mão, e cada linha da expectativa está na matriz', () => {
    expect(new Set(expectativa).size).toBe(expectativa.length)
    expect([...celulasDa(MATRIZ)].sort()).toEqual([...expectativa].sort())
  })

  it('a matriz cobre todo papel × recurso × ação, e só com alcance conhecido', () => {
    const total = Object.values(RECURSOS).reduce((soma, acoes) => soma + acoes.length, 0) * PAPEIS.length
    expect(celulasDa(MATRIZ)).toHaveLength(total)
    for (const celula of celulasDa(MATRIZ)) expect(ALCANCES, celula).toContain(celula.split('|')[3])
  })

  it('a comparação pega uma célula trocada: a mesma matriz com um alcance diferente não bate com a expectativa', () => {
    const trocada = JSON.parse(JSON.stringify(MATRIZ)) as Record<string, Record<string, Record<string, string>>>
    const doProfessor = trocada['professor']?.['aluno_da_turma']
    if (doProfessor === undefined) throw new Error('célula ausente')
    doProfessor['ler'] = 'unidade'
    expect([...celulasDa(trocada)].sort()).not.toEqual([...expectativa].sort())
  })

  it('a rede nunca tem alcance individual: só nunca ou agregado, em toda célula', () => {
    const daRede = Object.values(MATRIZ.rede).flatMap((acoes) => Object.values(acoes) as Alcance[])
    expect(daRede.length).toBeGreaterThan(0)
    for (const alcance of daRede) expect(['nunca', 'agregado']).toContain(alcance)
    for (const individual of ALCANCES_INDIVIDUAIS) expect(daRede).not.toContain(individual)
  })

  it('indicador de professor segue a regra 70, item 8: o próprio para ele, agregado e nominal com auditoria para a coordenação, agregado para a rede', () => {
    expect(MATRIZ.professor.indicador_professor).toEqual({ ler_agregado: 'nunca', ler_nominal: 'proprio' })
    expect(MATRIZ.coordenador.indicador_professor).toEqual({ ler_agregado: 'agregado', ler_nominal: 'nominal_auditado' })
    expect(MATRIZ.rede.indicador_professor).toEqual({ ler_agregado: 'agregado', ler_nominal: 'nunca' })
    expect(MATRIZ.aluno.indicador_professor).toEqual({ ler_agregado: 'nunca', ler_nominal: 'nunca' })
    // A coordenação nunca lê o nominal sem auditoria: nenhuma célula dela dá ao indicador `unidade`, `proprio` ou `turma_vinculada`.
    for (const semAuditoria of ['unidade', 'proprio', 'turma_vinculada']) expect(Object.values(MATRIZ.coordenador.indicador_professor)).not.toContain(semAuditoria)
  })

  it('marcar a introdução como vista é da própria pessoa nos três papéis, e a rede nunca alcança', () => {
    for (const papel of ['coordenador', 'professor', 'aluno'] as const) expect(MATRIZ[papel].eu.concluir_introducao, papel).toBe('proprio')
    expect(MATRIZ.rede.eu.concluir_introducao).toBe('nunca')
  })

  it('o aluno só alcança a si: toda célula dele é proprio ou nunca', () => {
    const doAluno = Object.values(MATRIZ.aluno).flatMap((acoes) => Object.values(acoes) as Alcance[])
    expect(doAluno.length).toBeGreaterThan(0)
    for (const alcance of doAluno) expect(['proprio', 'nunca']).toContain(alcance)
  })

  it('o vínculo é definido pela escola e só confirmado pelo professor (regra 60, item 8a)', () => {
    expect(MATRIZ.professor.vinculo.criar).toBe('nunca')
    expect(MATRIZ.professor.vinculo.encerrar).toBe('nunca')
    expect(MATRIZ.coordenador.vinculo.confirmar).toBe('nunca')
  })

  // I9 da A1 (cenarios.md): cada célula nova com o alcance da seção 4 da Tech Spec. A comparação com a expectativa já
  // pega a célula trocada; este teste diz a regra de cada uma, e as tarefas seguintes da A1 acrescentam as delas.
  it('I9: renomear e excluir disciplina e turma são da coordenação, com `unidade`; professor, aluno e rede, `nunca`', () => {
    for (const recurso of ['disciplina', 'turma'] as const) {
      for (const acao of ['renomear', 'excluir'] as const) {
        expect(alcanceDe('coordenador', recurso, acao), `${recurso}.${acao}`).toBe('unidade')
        for (const papel of ['professor', 'aluno', 'rede'] as const) expect(alcanceDe(papel, recurso, acao), `${papel} ${recurso}.${acao}`).toBe('nunca')
      }
    }
  })

  it('I9: listar, cadastrar, refazer e revogar o convite de professor são da coordenação, com `unidade`; professor, aluno e rede, `nunca`', () => {
    expect(RECURSOS.professor).toEqual(['listar', 'cadastrar', 'refazer_convite', 'revogar_convite'])
    for (const acao of RECURSOS.professor) {
      expect(alcanceDe('coordenador', 'professor', acao), acao).toBe('unidade')
      for (const papel of ['professor', 'aluno', 'rede'] as const) expect(alcanceDe(papel, 'professor', acao), `${papel} professor.${acao}`).toBe('nunca')
    }
  })

  it('I9: a lista de nomes é só da coordenação: a leitura `nominal_auditado`, as escritas e a prévia `unidade`; professor, aluno e rede, `nunca`', () => {
    expect(RECURSOS.lista_nome).toEqual(['ler', 'previa', 'gravar', 'acrescentar', 'retirar'])
    expect(alcanceDe('coordenador', 'lista_nome', 'ler')).toBe('nominal_auditado')
    for (const acao of ['previa', 'gravar', 'acrescentar', 'retirar'] as const) expect(alcanceDe('coordenador', 'lista_nome', acao), acao).toBe('unidade')
    for (const acao of RECURSOS.lista_nome) {
      for (const papel of ['professor', 'aluno', 'rede'] as const) expect(alcanceDe(papel, 'lista_nome', acao), `${papel} lista_nome.${acao}`).toBe('nunca')
    }
  })

  it('I9: o acesso da turma é só do professor, com `turma_vinculada`; coordenação, aluno e rede, `nunca`', () => {
    expect(RECURSOS.acesso_turma).toEqual(['gerar', 'ler', 'revogar'])
    for (const acao of RECURSOS.acesso_turma) {
      expect(alcanceDe('professor', 'acesso_turma', acao), acao).toBe('turma_vinculada')
      for (const papel of ['coordenador', 'aluno', 'rede'] as const) expect(alcanceDe(papel, 'acesso_turma', acao), `${papel} acesso_turma.${acao}`).toBe('nunca')
    }
  })

  it('I9: os pedidos da turma são do professor com `turma_vinculada` e da coordenação, a leitura `nominal_auditado` e a decisão `unidade`; aluno e rede, `nunca`', () => {
    expect(RECURSOS.reivindicacao).toEqual(['ler', 'decidir'])
    for (const acao of RECURSOS.reivindicacao) expect(alcanceDe('professor', 'reivindicacao', acao), acao).toBe('turma_vinculada')
    expect(alcanceDe('coordenador', 'reivindicacao', 'ler')).toBe('nominal_auditado')
    expect(alcanceDe('coordenador', 'reivindicacao', 'decidir')).toBe('unidade')
    for (const acao of RECURSOS.reivindicacao) {
      for (const papel of ['aluno', 'rede'] as const) expect(alcanceDe(papel, 'reivindicacao', acao), `${papel} reivindicacao.${acao}`).toBe('nunca')
    }
  })

  it('I9: `minha_turma` é só do aluno, com `proprio`, e é a única célula nova da A1 aberta a ele; coordenação, professor e rede, `nunca`', () => {
    expect(RECURSOS.minha_turma).toEqual(['ler'])
    expect(alcanceDe('aluno', 'minha_turma', 'ler')).toBe('proprio')
    for (const papel of ['coordenador', 'professor', 'rede'] as const) expect(alcanceDe(papel, 'minha_turma', 'ler'), papel).toBe('nunca')
    const recursosDaA1 = ['disciplina', 'turma', 'lista_nome', 'acesso_turma', 'professor', 'reivindicacao', 'minha_turma'] as const
    const abertasAoAluno = recursosDaA1.flatMap((recurso) =>
      Object.entries(MATRIZ.aluno[recurso])
        .filter(([, alcance]) => alcance !== 'nunca')
        .map(([acao]) => `${recurso}.${acao}`),
    )
    expect(abertasAoAluno).toEqual(['minha_turma.ler'])
  })

  it('F2: as planilhas são só da coordenação, na escola inteira; professor, aluno e rede, `nunca`', () => {
    expect(RECURSOS.importacao_planilha).toEqual(['previa', 'gravar', 'ler'])
    for (const acao of RECURSOS.importacao_planilha) {
      expect(alcanceDe('coordenador', 'importacao_planilha', acao), acao).toBe('unidade')
      for (const papel of ['professor', 'aluno', 'rede'] as const) expect(alcanceDe(papel, 'importacao_planilha', acao), `${papel} importacao_planilha.${acao}`).toBe('nunca')
    }
  })

  it('F2, 5.0: o calendário é da coordenação (a escola inteira) e do professor (só com vínculo confirmado); aluno e rede, `nunca`', () => {
    expect(RECURSOS.calendario).toEqual(['ler'])
    expect(alcanceDe('coordenador', 'calendario', 'ler')).toBe('unidade')
    expect(alcanceDe('professor', 'calendario', 'ler')).toBe('turma_vinculada')
    for (const papel of ['aluno', 'rede'] as const) expect(alcanceDe(papel, 'calendario', 'ler'), papel).toBe('nunca')
  })

  it('F2, 12.0: a grade da turma é da coordenação (a escola inteira) e do professor (só a turma em que tem vínculo confirmado); aluno e rede, `nunca`', () => {
    expect(RECURSOS.grade).toEqual(['ler'])
    expect(alcanceDe('coordenador', 'grade', 'ler')).toBe('unidade')
    expect(alcanceDe('professor', 'grade', 'ler')).toBe('turma_vinculada')
    for (const papel of ['aluno', 'rede'] as const) expect(alcanceDe(papel, 'grade', 'ler'), papel).toBe('nunca')
  })

  // MVP de apresentação (D77; `docs/mvp-rapido.md`, seção 7): uma célula por rota. A comparação com a expectativa pega a
  // célula trocada; estes testes dizem a regra de cada grupo.
  const RECURSOS_DO_MVP = ['material', 'time', 'assistente', 'execucao', 'ferramenta', 'artefato', 'entrega', 'atividade_aplicada', 'minha_atividade', 'correcao', 'desempenho_da_turma', 'tutor', 'sinal', 'uso_do_tutor', 'governanca', 'analista'] as const

  it('MVP: as quarenta e duas rotas têm célula, e a rede não chama nenhuma', () => {
    const acoes = RECURSOS_DO_MVP.flatMap((recurso) => RECURSOS[recurso].map((acao) => [recurso, acao] as const))
    expect(acoes).toHaveLength(42)
    for (const [recurso, acao] of acoes) expect(alcanceDe('rede', recurso, acao), `${recurso}.${acao}`).toBe('nunca')
  })

  it('MVP: só a coordenação envia e exclui material (D75); o professor lê e busca o das disciplinas dele; o aluno, nada', () => {
    expect(RECURSOS.material).toEqual(['enviar', 'listar', 'ler', 'excluir', 'buscar'])
    for (const acao of RECURSOS.material) expect(alcanceDe('coordenador', 'material', acao), acao).toBe('unidade')
    for (const acao of ['enviar', 'excluir'] as const) expect(alcanceDe('professor', 'material', acao), acao).toBe('nunca')
    for (const acao of ['listar', 'ler', 'buscar'] as const) expect(alcanceDe('professor', 'material', acao), acao).toBe('turma_vinculada')
    for (const acao of RECURSOS.material) expect(alcanceDe('aluno', 'material', acao), acao).toBe('nunca')
  })

  it('MVP: a conversa do professor com o Assistente só ele lê; a coordenação nunca (regra 70, item 8)', () => {
    for (const acao of RECURSOS.assistente) {
      expect(alcanceDe('professor', 'assistente', acao), acao).toBe('proprio')
      for (const papel of ['coordenador', 'aluno', 'rede'] as const) expect(alcanceDe(papel, 'assistente', acao), `${papel} ${acao}`).toBe('nunca')
    }
    // A execução responde só a quem a pediu, seja quem for.
    for (const papel of ['coordenador', 'professor', 'aluno'] as const) expect(alcanceDe(papel, 'execucao', 'ler'), papel).toBe('proprio')
  })

  it('MVP: ferramenta, artefato, entrega, atividade aplicada, correção e sinais são do professor da turma, e de mais ninguém', () => {
    for (const recurso of ['ferramenta', 'artefato', 'entrega', 'atividade_aplicada', 'correcao', 'sinal', 'uso_do_tutor'] as const) {
      for (const acao of RECURSOS[recurso]) {
        expect(alcanceDe('professor', recurso, acao), `${recurso}.${acao}`).toBe('turma_vinculada')
        for (const papel of ['coordenador', 'aluno', 'rede'] as const) expect(alcanceDe(papel, recurso, acao), `${papel} ${recurso}.${acao}`).toBe('nunca')
      }
    }
    // A coordenação não aprova entrega nem lote no lugar do professor, e não lê o sinal nomeado (D34).
    expect(MATRIZ.coordenador.entrega).toEqual({ listar: 'nunca', decidir: 'nunca', aprovar_lote: 'nunca' })
  })

  it('MVP: a atividade, o diagnóstico e o Tutor do aluno são só dele; ele nunca lê artefato, que tem o gabarito, nem a correção da turma', () => {
    for (const recurso of ['minha_atividade', 'tutor'] as const) {
      for (const acao of RECURSOS[recurso]) {
        expect(alcanceDe('aluno', recurso, acao), `${recurso}.${acao}`).toBe('proprio')
        for (const papel of ['coordenador', 'professor', 'rede'] as const) expect(alcanceDe(papel, recurso, acao), `${papel} ${recurso}.${acao}`).toBe('nunca')
      }
    }
    const abertasAoAluno = RECURSOS_DO_MVP.flatMap((recurso) =>
      Object.entries(MATRIZ.aluno[recurso])
        .filter(([, alcance]) => alcance !== 'nunca')
        .map(([acao]) => `${recurso}.${acao}`),
    )
    expect(abertasAoAluno).toEqual([
      'execucao.ler',
      'minha_atividade.listar',
      'minha_atividade.ler_prova',
      'minha_atividade.responder',
      'minha_atividade.enviar',
      'minha_atividade.ler_diagnostico',
      'tutor.enviar_mensagem',
      'tutor.ler_conversa',
      'tutor.ler_memoria',
    ])
  })

  it('MVP: o desempenho da turma é do professor dela; a coordenação só lê com finalidade e auditoria (D34, D45)', () => {
    expect(alcanceDe('professor', 'desempenho_da_turma', 'ler')).toBe('turma_vinculada')
    expect(alcanceDe('coordenador', 'desempenho_da_turma', 'ler')).toBe('nominal_auditado')
    expect(alcanceDe('aluno', 'desempenho_da_turma', 'ler')).toBe('nunca')
  })

  it('MVP: governança e Analista são só da coordenação: o resumo e o consumo agregados, o nominal com auditoria, e nada de `unidade` sobre pessoa', () => {
    expect(MATRIZ.coordenador.governanca).toEqual({ ler_resumo: 'agregado', ler_funcoes: 'unidade', suspender_funcao: 'unidade', retomar_funcao: 'unidade', ler_consumo: 'agregado' })
    expect(MATRIZ.coordenador.analista).toEqual({ ler_resumo: 'agregado', gerar: 'unidade', ler_nominal: 'nominal_auditado' })
    for (const recurso of ['governanca', 'analista'] as const) {
      for (const acao of RECURSOS[recurso]) {
        for (const papel of ['professor', 'aluno', 'rede'] as const) expect(alcanceDe(papel, recurso, acao), `${papel} ${recurso}.${acao}`).toBe('nunca')
      }
    }
    // As leituras da coordenação que identificam professor ou aluno nesta fatia passam por auditoria, sem exceção.
    for (const [recurso, acao] of [['desempenho_da_turma', 'ler'], ['analista', 'ler_nominal']] as const) expect(alcanceDe('coordenador', recurso, acao), `${recurso}.${acao}`).toBe('nominal_auditado')
  })

  it('MVP: o uso do Tutor por aluno é visível ao professor da turma, e só a ele (regra 70, item 4; D47)', () => {
    expect(RECURSOS.uso_do_tutor).toEqual(['ler'])
    expect(alcanceDe('professor', 'uso_do_tutor', 'ler')).toBe('turma_vinculada')
    // A coordenação não lê uso nominal de aluno, nem com auditoria: não há célula `nominal_auditado` aqui.
    for (const papel of ['coordenador', 'aluno', 'rede'] as const) expect(alcanceDe(papel, 'uso_do_tutor', 'ler'), papel).toBe('nunca')
  })

  it('MVP: o time é catálogo, lido pelo professor e pela coordenação', () => {
    expect(alcanceDe('professor', 'time', 'ler')).toBe('unidade')
    expect(alcanceDe('coordenador', 'time', 'ler')).toBe('unidade')
    expect(alcanceDe('aluno', 'time', 'ler')).toBe('nunca')
  })

  it('alcanceDe devolve a célula, e nunca para papel, recurso ou ação que a matriz não declara', () => {
    expect(alcanceDe('professor', 'turma', 'ler')).toBe('turma_vinculada')
    expect(alcanceDe('responsavel', 'turma', 'ler')).toBe('nunca')
    expect(alcanceDe('coordenador', 'nota', 'ler')).toBe('nunca')
    expect(alcanceDe('coordenador', 'turma', 'apagar')).toBe('nunca')
    expect(alcanceDe('coordenador', 'toString', 'ler')).toBe('nunca')
    expect(alcanceDe('__proto__', 'turma', 'ler')).toBe('nunca')
    expect(alcanceDe('coordenador', 'turma', 'constructor')).toBe('nunca')
  })
})
