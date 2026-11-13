import { situacaoDaLicenca, type AnoLetivo, type IncidenteDaEscola, type Licenca, type Material, type ProfessorDaEscola, type Turma, type VinculoDaCoordenacao } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { montarFila, TIPOS_DA_FILA, turmasSemProfessor, type EntradaDaFila, type LeituraDaFila } from './fila-da-coordenacao'

/**
 * A conta da fila "Esperando você" (telas da coordenação, 1.0; RF4 e RF7): cada tipo, os casos de borda da escola e o que a
 * fila nunca diz. Pura: nenhum teste aqui precisa de tela nem de rede. Os dados são inventados.
 */

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const lida = <Dado>(dado: Dado, completa = true): LeituraDaFila<Dado> => ({ estado: 'lida', dado, completa })

const ANO: AnoLetivo = { id: id(1), ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', situacao: 'em_curso' }
const turma = (n: number, nome: string): Turma => ({ id: id(100 + n), anoLetivoId: ANO.id, nome, turno: null, serie: { id: id(200), etapa: 'ef_anos_finais', ano: 7 } })
const T1 = turma(1, '7º A')
const T2 = turma(2, '7º B')
const T3 = turma(3, '8º A')

const professor = (n: number, nome: string, estado: ProfessorDaEscola['estado'] = 'ativo'): ProfessorDaEscola => ({ usuarioId: id(300 + n), nome, estado, envio: null, enviadoEm: null })
const CAMILA = professor(1, 'Camila Sintética')
const PAULO = professor(2, 'Paulo Sintético')

function vinculo(n: number, quem: ProfessorDaEscola, daTurma: Turma, estado: VinculoDaCoordenacao['estado'], disciplina = 'Química'): VinculoDaCoordenacao {
  return {
    id: id(400 + n),
    usuarioId: quem.usuarioId,
    papel: 'professor',
    turma: { id: daTurma.id, nome: daTurma.nome },
    disciplina: { id: id(500), nome: disciplina },
    estado,
  }
}

const incidente = (n: number, confirmadoEm: string | null): IncidenteDaEscola => ({
  id: id(600 + n),
  conhecidoEm: '2026-10-01T10:00:00.000Z',
  circunstancias: 'texto',
  categorias: ['cadastro'],
  titularesEstimados: 3,
  risco: 'baixo',
  contencao: 'texto',
  correcao: 'texto',
  avisadoEm: '2026-10-01T12:00:00.000Z',
  confirmadoEm,
})

const material = (n: number, estado: Material['estado']): Material => ({
  id: id(700 + n),
  titulo: `Apostila ${String(n)}`,
  disciplinaId: id(500),
  titularidade: 'escola',
  licenciante: null,
  licencaId: null,
  serieIds: [],
  licenca: 'autoria_da_escola',
  estado,
  falha: estado === 'falhou' ? 'sem_texto' : null,
  paginas: null,
  trechos: 0,
  enviadoEm: '2026-10-01T12:00:00.000Z',
})

/** `AAAA-MM-DD` mais `dias`, por calendário, sem fuso: o dia do fim de cada licença dos casos, contado a partir de "hoje". */
function maisDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

const HOJE = '2026-11-14'

/**
 * Uma licença que termina `diasParaOFim` dias depois de hoje (negativo: já terminou), com a `situacao` que a API daria **para o dia de hoje**:
 * é a função de `packages/shared`, a mesma da API, e não um texto escrito à mão, que faria o caso passar por qualquer valor.
 */
const licenca = (n: number, diasParaOFim: number | null, materiais: number): Licenca => {
  const vigenteAte = diasParaOFim === null ? null : maisDias(HOJE, diasParaOFim)
  return {
    id: id(800 + n),
    licenciante: 'Editora Sintética',
    cobertura: 'Coleção de Química',
    referencia: 'Contrato 123',
    vigenteDesde: '2026-01-01',
    vigenteAte,
    situacao: situacaoDaLicenca(HOJE, '2026-01-01', vigenteAte),
    materiais,
    registradaEm: '2026-01-01T12:00:00.000Z',
    alteradaEm: '2026-01-01T12:00:00.000Z',
  }
}

/** Tudo lido e sem nada esperando, com o ano em curso; o caso muda o que importa. */
function entrada(sobre: Partial<EntradaDaFila> = {}): EntradaDaFila {
  return {
    anos: lida([ANO]),
    incidentes: lida([]),
    professores: lida([CAMILA, PAULO]),
    materiais: lida([]),
    licencas: lida([]),
    turmas: lida([T1, T2]),
    vinculos: lida([vinculo(1, CAMILA, T1, 'confirmado'), vinculo(2, PAULO, T2, 'confirmado')]),
    ...sobre,
  }
}

describe('montarFila: a conta, tipo a tipo', () => {
  it('os seis tipos viram item, com o endereço certo; vínculo pendente e material processando não viram', () => {
    const fila = montarFila(
      entrada({
        incidentes: lida([incidente(1, null), incidente(2, '2026-10-02T10:00:00.000Z')]),
        professores: lida([CAMILA, professor(2, 'Paulo Sintético', 'vencido'), professor(3, 'Rita Sintética', 'pendente')]),
        materiais: lida([material(1, 'falhou'), material(2, 'processando'), material(3, 'pronto')]),
        licencas: lida([licenca(1, 10, 2), licenca(2, 90, 5)]),
        turmas: lida([T1, T2, T3]),
        vinculos: lida([vinculo(1, CAMILA, T1, 'contestado'), vinculo(2, CAMILA, T2, 'pendente')]),
      }),
    )
    expect(fila.situacao).toBe('pronta')
    expect(fila.itens.map(({ tipo, para, urgente }) => ({ tipo, para, urgente }))).toEqual([
      { tipo: 'incidente', para: '/privacidade/incidentes', urgente: true },
      { tipo: 'contestacao', para: `/professores?professor=${CAMILA.usuarioId}`, urgente: false },
      { tipo: 'convite-vencido', para: `/professores?professor=${id(302)}`, urgente: false },
      { tipo: 'material-falhou', para: `/material?material=${id(701)}`, urgente: false },
      { tipo: 'licenca-vencendo', para: '/material?aba=licencas', urgente: false },
      { tipo: 'turmas-sem-professor', para: '/estrutura?situacao=sem-professor', urgente: false },
    ])
    const vencido = fila.itens.find((item) => item.tipo === 'convite-vencido')
    expect(vencido?.titulo).toBe('Refazer o convite de Paulo Sintético')
    // T1 (só contestada) e T3 (sem vínculo) estão sem professor; T2 tem um pendente.
    expect(fila.itens.find((item) => item.tipo === 'turmas-sem-professor')?.contador).toEqual({ n: 2, oQueConta: 'turmas sem professor' })
  })

  it('o tipo é sempre um dos seis, e só as turmas sem professor levam contador', () => {
    const fila = montarFila(
      entrada({
        incidentes: lida([incidente(1, null)]),
        professores: lida([CAMILA, professor(2, 'Paulo Sintético', 'vencido')]),
        materiais: lida([material(1, 'falhou')]),
        licencas: lida([licenca(1, 5, 1)]),
        turmas: lida([T1, T2, T3]),
        vinculos: lida([vinculo(1, CAMILA, T1, 'contestado')]),
      }),
    )
    expect(fila.itens.length).toBeGreaterThan(0)
    for (const item of fila.itens) {
      expect(TIPOS_DA_FILA).toContain(item.tipo)
      expect('contador' in item).toBe(item.tipo === 'turmas-sem-professor')
    }
  })

  it('nada do que o professor faz entra na fila: dois professores de pendências diferentes dão só os fatos, sem número por professor', () => {
    const fila = montarFila(
      entrada({
        professores: lida([CAMILA, PAULO]),
        vinculos: lida([vinculo(1, CAMILA, T1, 'contestado'), vinculo(2, CAMILA, T2, 'contestado'), vinculo(3, PAULO, T1, 'contestado', 'Física'), vinculo(4, CAMILA, T1, 'contestado', 'Física')]),
      }),
    )
    // Um item por vínculo contestado: quatro vínculos são quatro itens, nenhum com contador. Camila na mesma turma em duas
    // disciplinas (T1, Química e Física) dá dois itens, com `id` diferentes: o `id` é o do vínculo, não o do par professor e turma.
    const contestacoes = fila.itens.filter((item) => item.tipo === 'contestacao')
    expect(contestacoes).toHaveLength(4)
    const deCamilaEmT1 = contestacoes.filter((item) => item.para.endsWith(CAMILA.usuarioId) && item.detalhe.startsWith('7º A'))
    expect(deCamilaEmT1).toHaveLength(2)
    expect(new Set(deCamilaEmT1.map((item) => item.id)).size).toBe(deCamilaEmT1.length)
    expect(contestacoes.every((item) => !('contador' in item))).toBe(true)
    // O `id` é único, também para a mesma contestação duas vezes e para homônimos.
    expect(new Set(fila.itens.map((item) => item.id)).size).toBe(fila.itens.length)
    expect(JSON.stringify(fila.itens)).not.toMatch(/\d+ (contestaç|pendência|vínculo)/)
  })

  it('homônimos têm itens distintos: o nome é o mesmo e o id, não', () => {
    const rita1 = professor(4, 'Rita Sintética', 'vencido')
    const rita2 = professor(5, 'Rita Sintética', 'vencido')
    const fila = montarFila(entrada({ professores: lida([rita1, rita2]) }))
    const ids = fila.itens.filter((item) => item.tipo === 'convite-vencido').map((item) => item.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('revogar o convite tira o item: o professor deixa de estar vencido', () => {
    const antes = montarFila(entrada({ professores: lida([professor(2, 'Paulo Sintético', 'vencido')]) }))
    const depois = montarFila(entrada({ professores: lida([professor(2, 'Paulo Sintético', 'revogado')]) }))
    expect(antes.itens.some((item) => item.tipo === 'convite-vencido')).toBe(true)
    expect(depois.itens.some((item) => item.tipo === 'convite-vencido')).toBe(false)
  })

  it('só o vínculo de professor contestado é item: o de aluno, mesmo contestado, não', () => {
    const deAluno: VinculoDaCoordenacao = { ...vinculo(1, CAMILA, T1, 'contestado'), papel: 'aluno' }
    expect(montarFila(entrada({ vinculos: lida([deAluno]) })).itens.some((item) => item.tipo === 'contestacao')).toBe(false)
  })

  it('o incidente confirmado não é item', () => {
    expect(montarFila(entrada({ incidentes: lida([incidente(1, '2026-10-02T10:00:00.000Z')]) })).itens).toEqual([])
  })
})

describe('montarFila: os casos de borda', () => {
  it('duas disciplinas na mesma turma: a turma sem professor conta uma vez', () => {
    const semProfessor = turmasSemProfessor([T1, T2], [vinculo(1, CAMILA, T2, 'contestado', 'Química'), vinculo(2, PAULO, T2, 'contestado', 'Física')])
    expect(semProfessor.map((t) => t.id)).toEqual([T1.id, T2.id])
    const fila = montarFila(entrada({ turmas: lida([T1]), vinculos: lida([vinculo(1, CAMILA, T1, 'encerrado', 'Química'), vinculo(2, PAULO, T1, 'encerrado', 'Física')]) }))
    expect(fila.itens.find((item) => item.tipo === 'turmas-sem-professor')?.contador?.n).toBe(1)
  })

  it('uma turma sem professor diz no singular, e duas no plural', () => {
    const uma = montarFila(entrada({ turmas: lida([T3]), vinculos: lida([]) })).itens.find((item) => item.tipo === 'turmas-sem-professor')
    expect(uma?.titulo).toBe('Uma turma sem professor')
    expect(uma?.contador).toEqual({ n: 1, oQueConta: 'turma sem professor' })
    const duas = montarFila(entrada({ turmas: lida([T2, T3]), vinculos: lida([]) })).itens.find((item) => item.tipo === 'turmas-sem-professor')
    expect(duas?.titulo).toBe('Turmas sem professor')
    expect(duas?.contador).toEqual({ n: 2, oQueConta: 'turmas sem professor' })
  })

  it('turma só com vínculo contestado está sem professor', () => {
    const fila = montarFila(entrada({ turmas: lida([T1]), vinculos: lida([vinculo(1, CAMILA, T1, 'contestado')]) }))
    expect(fila.itens.map((item) => item.tipo)).toEqual(['contestacao', 'turmas-sem-professor'])
  })

  it('sem ano em curso (nem turmas nem vínculos se leem): nenhum item de turma, a fila está pronta', () => {
    const planejado: AnoLetivo = { ...ANO, situacao: 'planejado' }
    for (const anos of [[], [planejado], [{ ...ANO, situacao: 'encerrado' as const }]]) {
      const fila = montarFila(entrada({ anos: lida(anos), turmas: { estado: 'nao-se-aplica' }, vinculos: { estado: 'nao-se-aplica' } }))
      expect(fila.situacao).toBe('pronta')
      expect(fila.itens).toEqual([])
    }
  })

  it('vínculo encerrado: ao lado de um confirmado não deixa a turma sem professor; sozinho, deixa', () => {
    expect(turmasSemProfessor([T1], [vinculo(1, CAMILA, T1, 'encerrado'), vinculo(2, PAULO, T1, 'confirmado')])).toEqual([])
    expect(turmasSemProfessor([T1], [vinculo(1, CAMILA, T1, 'encerrado')])).toEqual([T1])
  })

  it('contestado e depois encerrado: não há item de contestação', () => {
    const fila = montarFila(entrada({ turmas: lida([T1]), vinculos: lida([vinculo(1, CAMILA, T1, 'encerrado')]) }))
    expect(fila.itens.some((item) => item.tipo === 'contestacao')).toBe(false)
  })

  it('vínculo de aluno não é professor da turma', () => {
    const deAluno: VinculoDaCoordenacao = { ...vinculo(1, CAMILA, T1, 'confirmado'), papel: 'aluno' }
    expect(turmasSemProfessor([T1], [deAluno])).toEqual([T1])
  })

  it('a contagem do sino é a do filtro "Sem professor": o item usa a mesma função', () => {
    const turmas = [T1, T2, T3]
    const vinculos = [vinculo(1, CAMILA, T1, 'confirmado')]
    const fila = montarFila(entrada({ turmas: lida(turmas), vinculos: lida(vinculos) }))
    expect(fila.itens.find((item) => item.tipo === 'turmas-sem-professor')?.contador?.n).toBe(turmasSemProfessor(turmas, vinculos).length)
  })
})

describe('montarFila: a leitura que não veio inteira', () => {
  it('lista truncada em qualquer das leituras: parcial, e o resto aparece', () => {
    const base = { incidentes: lida([incidente(1, null)]) }
    const casos: Partial<EntradaDaFila>[] = [
      { anos: lida([ANO], false) },
      { professores: lida([CAMILA], false) },
      { materiais: lida([], false) },
      { licencas: lida([], false) },
      { turmas: lida([T1], false) },
      { vinculos: lida([], false) },
    ]
    for (const caso of casos) {
      const fila = montarFila(entrada({ ...base, ...caso }))
      expect(fila.situacao).toBe('parcial')
      expect(fila.itens.some((item) => item.tipo === 'incidente')).toBe(true)
    }
  })

  it('turmas ou vínculos truncados, cada um sozinho, suprimem "turmas sem professor"', () => {
    const vazias = [T1, T2, T3]
    expect(montarFila(entrada({ turmas: lida(vazias, false), vinculos: lida([]) })).itens.some((item) => item.tipo === 'turmas-sem-professor')).toBe(false)
    expect(montarFila(entrada({ turmas: lida(vazias), vinculos: lida([], false) })).itens.some((item) => item.tipo === 'turmas-sem-professor')).toBe(false)
    expect(montarFila(entrada({ turmas: lida(vazias), vinculos: lida([]) })).itens.some((item) => item.tipo === 'turmas-sem-professor')).toBe(true)
  })

  it('a falha de uma leitura: parcial com a falha, e os itens das outras', () => {
    const falha = new Error('caiu')
    const fila = montarFila(entrada({ incidentes: lida([incidente(1, null)]), materiais: { estado: 'erro', erro: falha } }))
    expect(fila.situacao).toBe('parcial')
    expect(fila.erro).toBe(falha)
    expect(fila.itens).toHaveLength(1)
  })

  it('a falha da leitura dos anos: nenhum item de turma, parcial', () => {
    const fila = montarFila(entrada({ anos: { estado: 'erro', erro: new Error('x') }, turmas: { estado: 'nao-se-aplica' }, vinculos: { estado: 'nao-se-aplica' } }))
    expect(fila.situacao).toBe('parcial')
    expect(fila.itens.some((item) => item.tipo === 'turmas-sem-professor')).toBe(false)
  })

  it('nada lido: erro; alguma leitura em curso: carregando', () => {
    const falha: LeituraDaFila<never> = { estado: 'erro', erro: new Error('x') }
    const tudoFalhou = montarFila({ anos: falha, incidentes: falha, professores: falha, materiais: falha, licencas: falha, turmas: { estado: 'nao-se-aplica' }, vinculos: { estado: 'nao-se-aplica' } })
    expect(tudoFalhou.situacao).toBe('erro')
    expect(montarFila(entrada({ materiais: { estado: 'carregando' } })).situacao).toBe('carregando')
  })
})

describe('montarFila: a licença de material (RF17)', () => {
  const itensDeLicenca = (licencas: readonly Licenca[]) => montarFila(entrada({ licencas: lida(licencas) })).itens.filter((item) => item.tipo === 'licenca-vencendo')

  it('a 31 dias do fim: sem aviso', () => {
    expect(itensDeLicenca([licenca(1, 31, 3)])).toEqual([])
  })

  it('a 30 dias do fim: avisa, com o dia e o mês do fim', () => {
    const [item, ...resto] = itensDeLicenca([licenca(1, 30, 3)])
    expect(resto).toEqual([])
    expect(item?.titulo).toBe('Uma licença de material vence em 14/12')
    expect(item?.para).toBe('/material?aba=licencas')
  })

  it('no último dia (0): ainda avisa que vence, com o dia de hoje', () => {
    expect(itensDeLicenca([licenca(1, 0, 3)]).map((item) => item.titulo)).toEqual(['Uma licença de material vence em 14/11'])
  })

  it('um dia depois do fim (+1) e com material: avisa que venceu e que os materiais saíram da busca', () => {
    const itens = itensDeLicenca([licenca(1, -1, 3)])
    expect(itens.map((item) => item.titulo)).toEqual(['Uma licença de material venceu; os materiais dela saíram da busca'])
    expect(itens.map((item) => item.para)).toEqual(['/material?aba=licencas'])
  })

  it('vencida sem material: não avisa, porque nada depende dela', () => {
    expect(itensDeLicenca([licenca(1, -1, 0)])).toEqual([])
  })

  it('a que vence sem material avisa, a sem fim e a que ainda não começou não', () => {
    const futura: Licenca = { ...licenca(3, 100, 2), vigenteDesde: '2026-12-01', situacao: 'futura' }
    expect(itensDeLicenca([licenca(1, 10, 0)])).toHaveLength(1)
    expect(itensDeLicenca([licenca(2, null, 4), futura])).toEqual([])
  })

  it('um item por licença, com ids distintos, e o texto não leva licenciante nem número', () => {
    // Duas de cada tipo: o id é o da licença, e não o do tipo.
    const itens = itensDeLicenca([licenca(1, 10, 3), licenca(2, 20, 1), licenca(3, -4, 7), licenca(4, -9, 2)])
    expect(new Set(itens.map((item) => item.id)).size).toBe(4)
    for (const item of itens) {
      expect(`${item.titulo} ${item.detalhe}`).not.toMatch(/Editora Sintética|Coleção|Contrato/)
      expect(item.contador).toBeUndefined()
      expect(item.tituloInteiro).toBe(true)
      expect(`${item.titulo} ${item.detalhe}`).not.toMatch(/\d+ (materiais|material)/)
    }
  })

  it('o aviso sai quando a vigência muda: a mesma licença, com o fim adiado, não é item', () => {
    expect(itensDeLicenca([licenca(1, 10, 3)])).toHaveLength(1)
    expect(itensDeLicenca([licenca(1, 200, 3)])).toEqual([])
  })
})
