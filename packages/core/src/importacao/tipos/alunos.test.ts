import { describe, expect, it } from 'vitest'
import type { TurmaDoAno } from '../../estrutura/turma.repository.js'
import type { ImportacaoRepository } from '../importacao.repository.js'
import { DiferencaNaPlanilhaError } from '../erros.js'
import { classificar, tipoAlunos } from './alunos.js'

const ANO = 'ano-2026'
const SEM_USO: ReadonlySet<string> = new Set()

const turma = (id: string, nome: string, chave: string | null, etapa: 'ef_anos_finais' | 'em' = 'ef_anos_finais', serieAno = 8): TurmaDoAno => ({ id, nome, chave, serie: { id: `serie-${id}`, etapa, ano: serieAno } })
const lida = (linha: number, turmaEscrita: string, nome: string, matricula: string) => ({ linha, turma: turmaEscrita, nome, matricula })

describe('classificar (planilha de alunos)', () => {
  it('"8ºA", "8º A", "8A", "8a" e "8º ano A" são a mesma turma: uma turma nova, com o nome da primeira grafia e a série do 8º ano do Fundamental', () => {
    const lidas = ['8ºA', '8º A', '8A', '8a', '8º ano A'].map((escrita, posicao) => lida(posicao + 2, escrita, `Aluno ${String(posicao)}`, `m${String(posicao)}`))

    const { linhas, novas, resumo } = classificar(ANO, lidas, [], SEM_USO)

    expect(linhas.map((l) => l.resultado)).toEqual(['entra', 'entra', 'entra', 'entra', 'entra'])
    expect(novas).toEqual([{ chave: '8a', nome: '8ºA', serie: { etapa: 'ef_anos_finais', ano: 8 } }])
    expect(resumo).toEqual({ entram: 5, ja_existem: 0, turmas_novas: 1 })
  })

  it('o nome da turma nova perde o espaço a mais: "9º   B" é criada como "9º B"', () => {
    const { novas } = classificar(ANO, [lida(2, '9º   B', 'Aluno', 'm1')], [], SEM_USO)

    expect(novas.map((nova) => nova.nome)).toEqual(['9º B'])
  })

  it('a série vem do dígito: 6 a 9 é o Fundamental, 1 a 3 é o Médio; 4, 5 e 0 não têm série e a turma que a escola não tem é erro', () => {
    const lidas = ['6A', '9B', '1C', '3D', '4A', '5B', '0C'].map((escrita, posicao) => lida(posicao + 2, escrita, 'Nome', `m${String(posicao)}`))

    const { linhas, novas } = classificar(ANO, lidas, [], SEM_USO)

    expect(novas.map((nova) => [nova.chave, nova.serie.etapa, nova.serie.ano])).toEqual([
      ['1c', 'em', 1],
      ['3d', 'em', 3],
      ['6a', 'ef_anos_finais', 6],
      ['9b', 'ef_anos_finais', 9],
    ])
    expect(linhas.map((l) => l.erro)).toEqual([undefined, undefined, undefined, undefined, 'turma_invalida', 'turma_invalida', 'turma_invalida'])
  })

  it('a turma da escola com a mesma chave que outra (o que nenhum índice deixa nascer, mas a conta de nome sim) é "turma ambígua" nas duas grafias, e a que tem a chave só dela casa', () => {
    const turmas = [turma('t1', '8A', null), turma('t2', '8º A', null), turma('t3', '8B', '8b'), turma('t4', '9A', '9a'), turma('t5', '9º A', '9a')]

    const { linhas } = classificar(ANO, [lida(2, '8A', 'A', 'm1'), lida(3, '8 a', 'B', 'm2'), lida(4, '8b', 'C', 'm3'), lida(5, '9 A', 'D', 'm4')], turmas, SEM_USO)

    expect(linhas.map((l) => [l.resultado, l.erro, l.destino])).toEqual([
      ['erro', 'turma_ambigua', undefined],
      ['erro', 'turma_ambigua', undefined],
      ['entra', undefined, { tipo: 'existente', turmaId: 't3' }],
      ['erro', 'turma_ambigua', undefined],
    ])
  })

  it('a turma com a chave nula é achada pelo nome quando ele tem o padrão ("8º A" sem chave casa com "8a") e, sem o padrão, só pelo nome sem acento nem caixa', () => {
    const turmas = [turma('t1', '8º A', null), turma('t2', 'Turma Azul', null), turma('t3', 'Turma Ámbar', null)]

    const { linhas, novas } = classificar(ANO, [lida(2, '8A', 'A', 'm1'), lida(3, 'TURMA  azul', 'B', 'm2'), lida(4, 'turma ambar', 'C', 'm3'), lida(5, 'Turma Verde', 'D', 'm4')], turmas, SEM_USO)

    expect(linhas.map((l) => [l.erro, l.destino])).toEqual([
      [undefined, { tipo: 'existente', turmaId: 't1' }],
      [undefined, { tipo: 'existente', turmaId: 't2' }],
      [undefined, { tipo: 'existente', turmaId: 't3' }],
      ['turma_invalida', undefined],
    ])
    expect(novas).toEqual([])
  })

  it('o erro da linha vem na ordem turma, nome, matrícula, forma de documento; a matrícula repetida só aparece na linha que não tem erro antes', () => {
    const lidas = [
      lida(2, '', 'Sem turma', 'm1'),
      lida(3, '8A', '', 'm2'),
      lida(4, '8A', 'x'.repeat(201), 'm3'),
      lida(5, '8A', 'Sem matrícula', ''),
      lida(6, '8A', 'Matrícula longa', 'm'.repeat(41)),
      lida(7, '8A', 'Científica', '1,2345E+11'),
      lida(8, '8A', 'Documento', '123.456.789-09'),
      lida(9, '8A', 'Repetida um', 'igual'),
      lida(10, '8A', 'Repetida dois', 'igual'),
      lida(11, '', 'Repetida e sem turma', 'igual'),
    ]

    const { linhas } = classificar(ANO, lidas, [], SEM_USO)

    expect(linhas.map((l) => l.erro)).toEqual([
      'turma_vazia',
      'sem_nome',
      'nome_invalido',
      'sem_matricula',
      'matricula_invalida',
      'matricula_notacao_cientifica',
      'matricula_parece_documento',
      'matricula_repetida',
      'matricula_repetida',
      'turma_vazia',
    ])
  })

  it('a matrícula em uso é "já existe" e não cria turma: a turma que só ela pedia não nasce', () => {
    const { linhas, novas, resumo } = classificar(ANO, [lida(2, '9C', 'Já cadastrada', 'em-uso'), lida(3, '7D', 'Nova', 'livre')], [], new Set(['em-uso']))

    expect(linhas.map((l) => l.resultado)).toEqual(['ja_existe', 'entra'])
    expect(novas.map((nova) => nova.chave)).toEqual(['7d'])
    expect(resumo).toEqual({ entram: 1, ja_existem: 1, turmas_novas: 1 })
  })

  it('a assinatura muda com o ano, com o resultado de uma linha, com a turma de destino (renomear a turma tocada) e com o erro; a mesma entrada dá a mesma assinatura', () => {
    const lidas = [lida(2, '8A', 'Ana', 'm1'), lida(3, '8A', 'Bia', 'm2')]
    const base = classificar(ANO, lidas, [turma('t1', '8A', '8a')], SEM_USO).assinatura

    expect(classificar(ANO, lidas, [turma('t1', '8A', '8a')], SEM_USO).assinatura).toBe(base)
    expect(classificar('ano-2027', lidas, [turma('t1', '8A', '8a')], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t1', '8A', '8a')], new Set(['m2'])).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t1', '9B', '9b')], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t1', '8A', '8a'), turma('t2', '8º A', null)], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t9', '8A', '8a')], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, [lida(2, '8A', 'Ana', 'm1'), lida(3, '8A', 'Bia', 'm1')], [turma('t1', '8A', '8a')], SEM_USO).assinatura).not.toBe(base)
  })
})

describe('classificar, a reimportação pela matrícula (F2, 8.0, RF4)', () => {
  const t1 = turma('t1', '8A', '8a')
  const t2 = turma('t2', '8B', '8b')
  const naLista = (id: string, matricula: string, nome: string, turmaId = 't1', estado: 'livre' | 'reivindicado' = 'livre') => ({ id, turmaId, nome, matricula, estado })
  const aprovado = (usuarioId: string, matricula: string, nome: string, turmaId = 't1') => ({ usuarioId, turmaId, nome, matricula })
  const alunos = (naoAprovados: ReturnType<typeof naLista>[], aprovados: ReturnType<typeof aprovado>[] = []) => ({ naoAprovados, aprovados })
  const emUso = (...matriculas: string[]) => new Set(matriculas)

  it('a mesma matrícula na mesma turma é "já existe" com o mesmo nome e "nome corrigido" com outro, no aprovado e no não aprovado', () => {
    const lidas = [lida(2, '8A', 'Ana Souza', 'm1'), lida(3, '8A', 'Bia Lima', 'm2'), lida(4, '8A', 'Carla Dias Corrigida', 'm3'), lida(5, '8A', 'Davi Rocha Corrigido', 'm4')]
    const achados = alunos([naLista('l1', 'm1', 'Ana Souza'), naLista('l2', 'm2', 'Bia Lima Antiga', 't1', 'reivindicado')], [aprovado('u3', 'm3', 'Carla Dias'), aprovado('u4', 'm4', 'Davi Rocha Corrigido')])

    const { linhas, resumo } = classificar(ANO, lidas, [t1], emUso('m1', 'm2', 'm3', 'm4'), achados)

    expect(linhas.map((l) => [l.resultado, l.alvo?.tipo, l.alvo?.id])).toEqual([
      ['ja_existe', 'lista', 'l1'],
      ['nome_corrigido', 'lista', 'l2'],
      ['nome_corrigido', 'usuario', 'u3'],
      ['ja_existe', 'usuario', 'u4'],
    ])
    expect(resumo).toEqual({ entram: 0, ja_existem: 2, nomes_corrigidos: 2, turmas_novas: 0 })
  })

  it('a matrícula de outra turma é "muda de turma": candidata a transferir com o nome do banco, e sem criar a turma nova que só ela pedia', () => {
    const lidas = [lida(2, '8A', 'Ana Nome Novo', 'm1'), lida(3, '9C', 'Bia', 'm2'), lida(4, '8B', 'Carla', 'm3')]
    const achados = alunos([naLista('l1', 'm1', 'Ana Souza', 't2')], [aprovado('u2', 'm2', 'Bia Lima', 't1')])

    const { linhas, novas, novasDeTransferencia, candidatos, resumo } = classificar(ANO, lidas, [t1, t2], emUso('m1', 'm2'), achados)

    expect(linhas.map((l) => l.resultado)).toEqual(['muda_de_turma', 'muda_de_turma', 'entra'])
    expect(novas).toEqual([])
    // A turma que só a linha "muda de turma" pede só nasce se a coordenação marcar a transferência (planoDe, 9.0).
    expect(novasDeTransferencia).toEqual([{ chave: '9c', nome: '9C', serie: { etapa: 'ef_anos_finais', ano: 9 } }])
    expect(candidatos.filter((c) => c.acao === 'transferir')).toEqual([
      { id: 'l1', acao: 'transferir', rotulo: 'Ana Souza (m1)', turmaId: 't2' },
      { id: 'u2', acao: 'transferir', rotulo: 'Bia Lima (m2)', turmaId: 't1' },
    ])
    // Mudar de turma não corrige o nome junto, nem com a marca: a transferência leva a pessoa, e o nome é outra decisão da coordenação.
    expect(resumo).toEqual({ entram: 1, ja_existem: 0, turmas_novas: 0 })
  })

  it('quem é da turma que a planilha cita e não está nela é candidato a desligar; o de turma que ela não cita, e o que está em outra linha, não', () => {
    const lidas = [lida(2, '8A', 'Ana', 'm1'), lida(3, '8A', 'Carla', 'm3'), lida(4, '8A', 'Gil', 'm7')]
    const achados = alunos([naLista('l1', 'm1', 'Ana'), naLista('l2', 'm2', 'Bia Ausente'), naLista('l9', 'm9', 'Outra Turma', 't2'), naLista('l3', 'm3', 'Carla', 't2')], [aprovado('u5', 'm5', 'Eva Ausente'), aprovado('u6', 'm6', 'Fábio Outra Turma', 't2'), aprovado('u7', 'm7', 'Gil')])

    const { candidatos } = classificar(ANO, lidas, [t1, t2], emUso('m7'), achados)

    expect(candidatos.filter((c) => c.acao === 'desligar').map(({ id, rotulo, turmaId }) => [id, rotulo, turmaId])).toEqual([
      ['l2', 'Bia Ausente (m2)', 't1'],
      ['u5', 'Eva Ausente (m5)', 't1'],
    ])
  })

  it('a turma ambígua ou com erro não oferece os alunos dela como ausentes', () => {
    const { candidatos } = classificar(ANO, [lida(2, '8A', 'Ana', 'm1'), lida(3, '8B', '', 'm2')], [t1, turma('t3', '8º A', null)], emUso(), alunos([naLista('l5', 'm5', 'Ausente')], [aprovado('u6', 'm6', 'Ausente Aprovada')]))

    expect(candidatos).toEqual([])
  })

  it('a assinatura muda com o que a matrícula é no banco: o estado do nome (a reivindicação), o nome, a turma e o aprovado no lugar do nome', () => {
    const lidas = [lida(2, '8A', 'Ana Nova', 'm1')]
    const base = classificar(ANO, lidas, [t1], emUso('m1'), alunos([naLista('l1', 'm1', 'Ana')])).assinatura

    expect(classificar(ANO, lidas, [t1], emUso('m1'), alunos([naLista('l1', 'm1', 'Ana')])).assinatura).toBe(base)
    expect(classificar(ANO, lidas, [t1], emUso('m1'), alunos([naLista('l1', 'm1', 'Ana', 't1', 'reivindicado')])).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [t1], emUso('m1'), alunos([naLista('l1', 'm1', 'Ana Renomeada')])).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [t1], emUso('m1'), alunos([], [aprovado('u1', 'm1', 'Ana')])).assinatura).not.toBe(base)
  })

  it('o aprovado vale mais que o nome da lista para a mesma matrícula, e a matrícula só na credencial (sem linha neste ano) segue "já existe"', () => {
    const { linhas } = classificar(ANO, [lida(2, '8A', 'Ana', 'm1'), lida(3, '8A', 'Bia', 'm2')], [t1], emUso('m1', 'm2'), alunos([naLista('l1', 'm1', 'Ana Antiga')], [aprovado('u1', 'm1', 'Ana')]))

    expect(linhas.map((l) => [l.resultado, l.alvo?.id])).toEqual([
      ['ja_existe', 'u1'],
      ['ja_existe', undefined],
    ])
  })
})

describe('classificar, a lista de uma turma (A1, 8.0): a turma dada e os erros do texto', () => {
  const t1 = turma('t1', 'Turma 1a2b3c', null)
  const daLista = (linha: number, nome: string, matricula: string, turmaId = 't1') => ({ linha, turma: '', turmaId, nome, matricula })

  it('a linha vai para a turma dada, sem coluna de turma; a turma que a escola não tem mais é erro `turma_invalida`', () => {
    const { linhas } = classificar(ANO, [daLista(1, 'Ana', 'm1'), daLista(2, 'Bia', 'm2', 'sumiu')], [t1], SEM_USO)

    expect(linhas.map((l) => [l.resultado, l.erro, l.destino])).toEqual([
      ['entra', undefined, { tipo: 'existente', turmaId: 't1' }],
      ['erro', 'turma_invalida', undefined],
    ])
  })

  it('sem nome, nome longo ou com caractere de controle, sem matrícula, matrícula longa ou com controle: o erro da linha, na ordem', () => {
    const lidas = [
      daLista(1, '', '101'),
      daLista(2, 'a'.repeat(201), '102'),
      daLista(3, 'Ana\u0007', '103'),
      daLista(4, 'Bruno', ''),
      daLista(5, 'Carla', 'm'.repeat(41)),
      daLista(6, 'Davi', 'm\u0001'),
      daLista(7, 'a'.repeat(200), 'm'.repeat(40)),
      daLista(8, '', ''),
    ]

    const { linhas } = classificar(ANO, lidas, [t1], SEM_USO)

    expect(linhas.map((l) => l.erro)).toEqual(['sem_nome', 'nome_invalido', 'nome_invalido', 'sem_matricula', 'matricula_invalida', 'matricula_invalida', undefined, 'sem_nome'])
  })

  it('a matrícula repetida no texto aponta todas as linhas dela, e a linha com outro erro conta na repetição e mostra o dela', () => {
    const { linhas } = classificar(ANO, [daLista(1, 'Ana', '101'), daLista(2, 'Bruno', '102'), daLista(3, 'Carla', '101'), daLista(4, '', '102')], [t1], SEM_USO)

    expect(linhas.map((l) => l.erro)).toEqual(['matricula_repetida', 'matricula_repetida', 'matricula_repetida', 'sem_nome'])
  })

  it('G2: a matrícula com forma de documento é erro da linha, antes da repetição; o CPF sem pontuação só pela maioria', () => {
    const erros = (...pares: Array<[string, string]>) => classificar(ANO, pares.map(([nome, matricula], posicao) => daLista(posicao + 1, nome, matricula)), [t1], SEM_USO).linhas.map((l) => l.erro)

    expect(erros(['Ana', '123.456.789-09'], ['Bia', '01/02/2012'], ['Caio', '01/02/2012'], ['', '2012-02-01'], ['Davi', '104'])).toEqual([
      'matricula_parece_documento',
      'matricula_parece_documento',
      'matricula_parece_documento',
      'sem_nome',
      undefined,
    ])
    expect(erros(['Ana', '12345678909'], ['Bia', '52998224725'], ['Caio', '103'])).toEqual(['matricula_parece_documento', 'matricula_parece_documento', undefined])
    expect(erros(['Ana', '12345678909'], ['Bia', '102'], ['Caio', '103'])).toEqual([undefined, undefined, undefined])
  })
})

describe('o plano da reimportação: a escrita condicional que muda menos linhas que o pedido é diferença (F2, 8.0, RF4)', () => {
  const t1 = turma('t1', '8A', '8a')
  const guardado = [
    { linha: 2, turma: '8A', nome: 'Ana Corrigida', matricula: 'm1' },
    { linha: 3, turma: '8A', nome: 'Bia Corrigida', matricula: 'm2' },
  ]

  /** O repository só com o que o `planejar` lê: as turmas, as matrículas em uso e o que a escola já tem de aluno. */
  const leitura = (comAprovado: boolean) =>
    ({
      turmasDoAno: () => Promise.resolve([t1]),
      matriculasEmUso: () => Promise.resolve(new Set(['m1', 'm2'])),
      alunosParaReimportar: () =>
        Promise.resolve({
          naoAprovados: comAprovado ? [] : [{ id: 'l1', turmaId: 't1', nome: 'Ana', matricula: 'm1', estado: 'livre' as const }],
          aprovados: comAprovado ? [{ usuarioId: 'u2', turmaId: 't1', nome: 'Bia', matricula: 'm2' }] : [],
        }),
    }) as unknown as ImportacaoRepository

  /** A gravação que diz ter mudado `mudadasNaLista` linhas da lista e `mudadosAlunos` alunos. */
  const gravacaoQueMuda = (mudadasNaLista: number, mudadosAlunos: number) =>
    ({ corrigirNomesNaLista: () => Promise.resolve(mudadasNaLista), corrigirNomesDosAlunos: () => Promise.resolve(mudadosAlunos), seriesDaEscola: () => Promise.resolve([]), inserirNomes: () => Promise.resolve(), encerrarPedidosDosNomes: () => Promise.resolve(), transferirNomes: () => Promise.resolve(0), encerrarVinculosDosAlunos: () => Promise.resolve([]), criarVinculosDosAlunos: () => Promise.resolve([]), transferirAprovados: () => Promise.resolve(0) }) as unknown as ImportacaoRepository

  async function aplicar(comAprovado: boolean, mudadasNaLista: number, mudadosAlunos: number) {
    const plano = await tipoAlunos.planejar?.(leitura(comAprovado), { id: ANO } as never, guardado, { transferir: [], desligar: [], encerrar: [] })
    if (plano === undefined) throw new Error('sem plano')
    await plano.aplicar(gravacaoQueMuda(mudadasNaLista, mudadosAlunos), { tx: {} as never, ciclo: {} as never })
  }

  it('o nome do não aprovado que a escrita não achou mais como a planilha leu (zero linhas mudadas) é `DiferencaNaPlanilhaError`, e não correção parcial', async () => {
    await expect(aplicar(false, 0, 0)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
  })

  it('o nome do aprovado que a escrita não achou mais como a planilha leu (desativado, ou com o nome trocado) é `DiferencaNaPlanilhaError`', async () => {
    await expect(aplicar(true, 0, 0)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
  })
})
