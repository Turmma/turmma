import type { AlunoDaTurma, DesempenhoDaTurmaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import {
  montarLinhas,
  ordemDeNome,
  TEXTO_DE_QUEM_SAIU,
  TEXTO_DOS_ACERTOS_QUE_CARREGAM,
  TEXTO_DOS_ACERTOS_QUE_FALHARAM,
  TEXTO_SEM_CORRECAO_APROVADA,
  TEXTO_SEM_HABILIDADE,
  textoDosAcertos,
  textoPorHabilidade,
  type AlunoRow,
} from './alunos-da-turma'

/**
 * A ordem de nome e a junção dos acertos da aba Alunos (telas do professor, 12.0; RF18, RF21), sem tela e sem rede: a lista de nomes
 * chega em ordem de id, e a tela a reordena; o desempenho chega só de lote aprovado.
 */

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const aluno = (n: number, nome: string): AlunoDaTurma => ({ usuarioId: id(n), nome })
const HABILIDADE = { codigo: 'QUI.EM.04', descricao: 'Estequiometria' }
const desempenhoDe = (n: number, nome: string, acertos: number, total: number, porHabilidade: DesempenhoDaTurmaResponse['alunos'][number]['porHabilidade'] = []) => ({
  alunoId: id(n),
  nome,
  acertos,
  total,
  porHabilidade,
})
const turma = (alunos: DesempenhoDaTurmaResponse['alunos']): DesempenhoDaTurmaResponse => ({ turmaId: id(100), lotesAprovados: 1, porHabilidade: [], alunos })

const nomes = (linhas: readonly AlunoRow[]) => linhas.map((linha) => linha.nome)

describe('a ordem de nome', () => {
  it('a lista chega em ordem de id e sai em ordem de nome, no português do Brasil: "Álvaro" vem com o A, não depois do Z', () => {
    const lidos = [aluno(1, 'Zélia Sintética'), aluno(2, 'Álvaro Sintético'), aluno(3, 'Bruna Sintética'), aluno(4, 'Ana Sintética')]
    expect(nomes(montarLinhas(lidos, undefined, true))).toEqual(['Álvaro Sintético', 'Ana Sintética', 'Bruna Sintética', 'Zélia Sintética'])
  })

  it('dois alunos de mesmo nome ficam em duas linhas, e o id desempata: a ordem não depende de qual a API entregou primeiro', () => {
    const dois = [aluno(9, 'João Sintético'), aluno(2, 'João Sintético')]
    const nasDuasOrdens = [montarLinhas(dois, undefined, true), montarLinhas([...dois].reverse(), undefined, true)]
    for (const linhas of nasDuasOrdens) expect(linhas.map((linha) => linha.usuarioId)).toEqual([id(2), id(9)])
    expect(ordemDeNome({ nome: 'João', usuarioId: id(2) }, { nome: 'João', usuarioId: id(2) })).toBe(0)
  })

  it('a ordem não muda com os números: o aluno com mais acerto não sobe, e o com menos não desce', () => {
    const lidos = [aluno(1, 'Bruno Sintético'), aluno(2, 'Ana Sintética'), aluno(3, 'Caio Sintético')]
    const poucos = turma([desempenhoDe(1, 'Bruno Sintético', 0, 5), desempenhoDe(2, 'Ana Sintética', 1, 5), desempenhoDe(3, 'Caio Sintético', 2, 5)])
    const muitos = turma([desempenhoDe(1, 'Bruno Sintético', 5, 5), desempenhoDe(2, 'Ana Sintética', 3, 5), desempenhoDe(3, 'Caio Sintético', 0, 5)])
    expect(nomes(montarLinhas(lidos, poucos, true))).toEqual(['Ana Sintética', 'Bruno Sintético', 'Caio Sintético'])
    expect(nomes(montarLinhas(lidos, muitos, true))).toEqual(['Ana Sintética', 'Bruno Sintético', 'Caio Sintético'])
  })

  it('tudo o que já foi lido é reordenado junto: o nome da segunda página que vem antes entra no meio da primeira', () => {
    const primeira = [aluno(1, 'Bruno Sintético'), aluno(2, 'Dora Sintética')]
    const segunda = [aluno(3, 'Ana Sintética'), aluno(4, 'Caio Sintético')]
    expect(nomes(montarLinhas([...primeira, ...segunda], undefined, true))).toEqual(['Ana Sintética', 'Bruno Sintético', 'Caio Sintético', 'Dora Sintética'])
  })
})

describe('a junção dos acertos', () => {
  it('os acertos de cada aluno vêm pelo id dele, e não pela posição nem pelo nome: dois "João" não trocam os números', () => {
    const lidos = [aluno(1, 'João Sintético'), aluno(2, 'João Sintético')]
    const linhas = montarLinhas(lidos, turma([desempenhoDe(2, 'João Sintético', 4, 5), desempenhoDe(1, 'João Sintético', 1, 5)]), true)
    expect(linhas.map((linha) => textoDosAcertos(linha, 'lida'))).toEqual(['1 de 5', '4 de 5'])
  })

  it('o aluno sem correção aprovada aparece com "Sem correção aprovada", e não some nem vira "0 de 0"', () => {
    const lidos = [aluno(1, 'Ana Sintética'), aluno(2, 'Bruno Sintético'), aluno(3, 'Caio Sintético')]
    // Ana: total zero, como a API devolve quem ainda não tem lote aprovado. Bruno: nem consta no desempenho. Caio: com acertos.
    const linhas = montarLinhas(lidos, turma([desempenhoDe(1, 'Ana Sintética', 0, 0), desempenhoDe(3, 'Caio Sintético', 0, 2)]), true)
    expect(linhas).toHaveLength(3)
    expect(linhas.map((linha) => textoDosAcertos(linha, 'lida'))).toEqual([TEXTO_SEM_CORRECAO_APROVADA, TEXTO_SEM_CORRECAO_APROVADA, '0 de 2'])
    for (const linha of linhas) expect(textoDosAcertos(linha, 'lida')).not.toBe('0 de 0')
  })

  it('o desempenho da turma sem lote aprovado deixa todos sem correção aprovada, e nenhum desaparece', () => {
    const lidos = [aluno(1, 'Ana Sintética'), aluno(2, 'Bruno Sintético')]
    const linhas = montarLinhas(lidos, { turmaId: id(100), lotesAprovados: 0, porHabilidade: [], alunos: [] }, true)
    expect(linhas.map((linha) => textoDosAcertos(linha, 'lida'))).toEqual([TEXTO_SEM_CORRECAO_APROVADA, TEXTO_SEM_CORRECAO_APROVADA])
  })

  it('enquanto os acertos não chegam, a célula diz que carrega; se falharam, diz que não foram lidos: nenhuma afirma "sem correção"', () => {
    const [linha] = montarLinhas([aluno(1, 'Ana Sintética')], undefined, true)
    expect(linha).toBeDefined()
    if (linha === undefined) return
    expect(textoDosAcertos(linha, 'lendo')).toBe(TEXTO_DOS_ACERTOS_QUE_CARREGAM)
    expect(textoDosAcertos(linha, 'falhou')).toBe(TEXTO_DOS_ACERTOS_QUE_FALHARAM)
  })

  it('o acerto por habilidade diz o código e "x de y"; sem correção aprovada não há habilidade', () => {
    const [com, sem] = montarLinhas(
      [aluno(1, 'Ana Sintética'), aluno(2, 'Bruno Sintético')],
      turma([desempenhoDe(1, 'Ana Sintética', 1, 2, [{ habilidade: HABILIDADE, acertos: 1, total: 2 }])]),
      true,
    )
    expect(com && textoPorHabilidade(com)).toBe('QUI.EM.04: 1 de 2')
    expect(sem && textoPorHabilidade(sem)).toBe(TEXTO_SEM_HABILIDADE)
  })
})

describe('quem saiu da turma (transferido, ou com o acesso desativado)', () => {
  it('o aluno que o desempenho traz e a lista lida até o fim não, aparece com o estado próprio e sem número de acerto', () => {
    const lidos = [aluno(1, 'Ana Sintética')]
    const linhas = montarLinhas(lidos, turma([desempenhoDe(1, 'Ana Sintética', 1, 2), desempenhoDe(7, 'Bia Sintética', 2, 2)]), true)
    expect(nomes(linhas)).toEqual(['Ana Sintética', 'Bia Sintética'])
    const bia = linhas.find((linha) => linha.usuarioId === id(7))
    expect(bia?.situacao).toBe('fora_da_turma')
    expect(bia && textoDosAcertos(bia, 'lida')).toBe(TEXTO_DE_QUEM_SAIU)
    // Mesmo com a leitura dos acertos ainda no ar, quem saiu não ganha "Carregando" nem "Acertos não lidos".
    expect(bia && textoDosAcertos(bia, 'lendo')).toBe(TEXTO_DE_QUEM_SAIU)
    expect(bia?.desempenho).toBeUndefined()
    expect(linhas.find((linha) => linha.usuarioId === id(1))?.situacao).toBe('na_turma')
  })

  it('com páginas por ler, o aluno que ainda não chegou não é dado como fora da turma: ele pode estar na próxima página', () => {
    const lidos = [aluno(1, 'Ana Sintética')]
    const linhas = montarLinhas(lidos, turma([desempenhoDe(1, 'Ana Sintética', 1, 2), desempenhoDe(7, 'Bia Sintética', 2, 2)]), false)
    expect(nomes(linhas)).toEqual(['Ana Sintética'])
  })
})

describe('o vocabulário (D46, D57, D69)', () => {
  it('nenhum texto da aba fala em nota, média, conceito, ranking ou posição', () => {
    const lidos = [aluno(1, 'Ana Sintética'), aluno(2, 'Bruno Sintético')]
    const linhas = montarLinhas(lidos, turma([desempenhoDe(1, 'Ana Sintética', 1, 2, [{ habilidade: HABILIDADE, acertos: 1, total: 2 }]), desempenhoDe(7, 'Bia Sintética', 2, 2)]), true)
    const textos = [
      ...linhas.flatMap((linha) => [textoDosAcertos(linha, 'lida'), textoDosAcertos(linha, 'lendo'), textoDosAcertos(linha, 'falhou'), textoPorHabilidade(linha)]),
      TEXTO_SEM_CORRECAO_APROVADA,
      TEXTO_DE_QUEM_SAIU,
      TEXTO_DOS_ACERTOS_QUE_CARREGAM,
      TEXTO_DOS_ACERTOS_QUE_FALHARAM,
    ]
    for (const texto of textos) expect(texto, texto).not.toMatch(/\bnotas?\b|\bconceitos?\b|pontua|m[ée]dia|ranking|p[óo]dio|posi[çc]/i)
  })
})
