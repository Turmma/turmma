import { CHAVES_DE_RETENCAO, ErrorCode, ESTADOS_DO_PEDIDO, MINIMO_DE_LETRAS_DO_TERMO, SOLICITANTES_DO_PEDIDO, TIPOS_DE_PEDIDO_DO_TITULAR, type ItemDoPedido, type TitularAchado } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  anuncioDaBusca,
  AVISO_DO_ALUNO_DA_LISTA,
  descricaoDoAchado,
  EFEITO_DA_ELIMINACAO,
  EFEITO_DO_PEDIDO,
  hojeEmSaoPaulo,
  ordenarOsPedidos,
  ROTULO_DA_CATEGORIA_NA_PREVIA,
  ROTULO_DE_QUEM_PEDIU,
  ROTULO_DO_TIPO,
  SITUACAO_DO_PEDIDO,
  termoDaBusca,
  TEXTO_DE_NINGUEM_ACHADO,
  TEXTO_DO_TERMO_CURTO,
  TEXTOS_DA_FALHA_DA_BUSCA,
  TEXTOS_DA_FALHA_DO_REGISTRO,
  textoDasTurmas,
  validarOPedido,
} from './textos-dos-pedidos'

function titular(parcial: Partial<TitularAchado>): TitularAchado {
  return { id: '7a7b1a52-9d5e-4e2c-8d0d-3b1c6a0b7f10', nome: 'Ana Souza', papel: 'aluno', matricula: '2026-0042', turmas: [], disciplinas: [], estado: 'ativo', ...parcial }
}

describe('os textos de cada valor do contrato: nenhum fica sem o seu, e nenhum é a chave crua', () => {
  it('tipo, quem pediu, estado e categoria da prévia têm um texto cada, todos diferentes entre si', () => {
    for (const [chaves, textos] of [
      [TIPOS_DE_PEDIDO_DO_TITULAR, ROTULO_DO_TIPO],
      [SOLICITANTES_DO_PEDIDO, ROTULO_DE_QUEM_PEDIU],
      [CHAVES_DE_RETENCAO, ROTULO_DA_CATEGORIA_NA_PREVIA],
    ] as const) {
      const lidos = chaves.map((chave) => (textos as Readonly<Record<string, string>>)[chave])
      expect(lidos.every((texto) => texto !== undefined && texto !== '')).toBe(true)
      expect(new Set(lidos).size).toBe(chaves.length)
      expect(lidos.some((texto, i) => texto === chaves[i])).toBe(false)
    }
    const situacoes = ESTADOS_DO_PEDIDO.map((estado) => SITUACAO_DO_PEDIDO[estado].texto)
    expect(new Set(situacoes).size).toBe(ESTADOS_DO_PEDIDO.length)
  })

  it('o que espera a coordenação é pendente, o concluído é ok e o arquivo em montagem é informação', () => {
    expect(SITUACAO_DO_PEDIDO.recebido.familia).toBe('pendente')
    expect(SITUACAO_DO_PEDIDO.pronto.familia).toBe('pendente')
    expect(SITUACAO_DO_PEDIDO.agendado.familia).toBe('pendente')
    expect(SITUACAO_DO_PEDIDO.concluido.familia).toBe('ok')
    expect(SITUACAO_DO_PEDIDO.em_preparacao.familia).toBe('info')
  })

  it('cada pedido diz o que registrar faz, e a eliminação diz os 7 dias e que depois não volta', () => {
    for (const tipo of TIPOS_DE_PEDIDO_DO_TITULAR) expect(EFEITO_DO_PEDIDO[tipo].length).toBeGreaterThan(40)
    expect(EFEITO_DO_PEDIDO.eliminacao).toBe(EFEITO_DA_ELIMINACAO)
    expect(EFEITO_DA_ELIMINACAO).toContain('7 dias')
    expect(EFEITO_DA_ELIMINACAO).toContain('não há como desfazer')
  })
})

describe('o caminho até a turma tem o nome do lugar de hoje: Escola › Turmas, e não "Estrutura"', () => {
  it('a busca sem ninguém, o aviso do aluno da lista e o efeito do pedido de correção dizem onde fica a turma', () => {
    expect(TEXTO_DE_NINGUEM_ACHADO).toContain('na lista de nomes da turma, em Escola › Turmas.')
    expect(AVISO_DO_ALUNO_DA_LISTA).toContain('abra a turma em Escola › Turmas. Ler a lista')
    expect(EFEITO_DO_PEDIDO.correcao).toContain('se faz pela turma, em Escola › Turmas.')
    for (const texto of [TEXTO_DE_NINGUEM_ACHADO, AVISO_DO_ALUNO_DA_LISTA, EFEITO_DO_PEDIDO.correcao]) expect(texto).not.toContain('Estrutura')
  })
})

describe('termoDaBusca: nenhuma busca sai com menos de 3 letras', () => {
  it('corta o espaço das pontas antes de contar, como a API', () => {
    expect(termoDaBusca('  an ')).toEqual({ ok: false, erro: TEXTO_DO_TERMO_CURTO })
    expect(termoDaBusca('')).toEqual({ ok: false, erro: TEXTO_DO_TERMO_CURTO })
    expect(termoDaBusca('   Ana  ')).toEqual({ ok: true, termo: 'Ana' })
    expect(TEXTO_DO_TERMO_CURTO).toContain(String(MINIMO_DE_LETRAS_DO_TERMO))
  })
})

describe('descricaoDoAchado: o que separa dois homônimos na lista da busca', () => {
  it('do aluno diz a turma e a matrícula; sem turma, diz que não tem neste ano', () => {
    expect(descricaoDoAchado(titular({ turmas: [{ id: 'a', nome: '7º A' }] }))).toBe('Aluno · 7º A · matrícula 2026-0042')
    expect(descricaoDoAchado(titular({ turmas: [] }))).toBe('Aluno · Sem turma neste ano · matrícula 2026-0042')
  })

  it('as disciplinas são do professor: o aluno não as mostra, e o professor sem disciplina não deixa um vazio entre os pontos', () => {
    const aluno = titular({ turmas: [{ id: 'a', nome: '7º A' }], disciplinas: [{ id: 'm', nome: 'Matemática' }] })
    expect(descricaoDoAchado(aluno)).toBe('Aluno · 7º A · matrícula 2026-0042')
    const semDisciplina = titular({ papel: 'professor', matricula: null, turmas: [{ id: 'a', nome: '7º A' }], disciplinas: [] })
    expect(descricaoDoAchado(semDisciplina)).toBe('Professor · 7º A')
  })

  it('do professor diz as disciplinas e as turmas, e nunca matrícula; conta desativada vem dita', () => {
    const professor = titular({
      papel: 'professor',
      matricula: null,
      turmas: [
        { id: 'a', nome: '7º A' },
        { id: 'b', nome: '8º B' },
      ],
      disciplinas: [{ id: 'm', nome: 'Matemática' }],
      estado: 'desativado',
    })
    expect(descricaoDoAchado(professor)).toBe('Professor · Matemática · 7º A, 8º B · conta desativada')
  })
})

describe('anuncioDaBusca: o que o leitor de tela ouve quando a busca termina', () => {
  it('diz nenhuma, uma ou quantas, no singular e no plural', () => {
    expect(anuncioDaBusca(0)).toBe('Nenhuma pessoa encontrada com esse nome.')
    expect(anuncioDaBusca(1)).toMatch(/^1 pessoa encontrada\./)
    expect(anuncioDaBusca(3)).toMatch(/^3 pessoas encontradas\./)
  })
})

describe('textoDasTurmas', () => {
  it('junta as turmas e diz quando não há nenhuma', () => {
    expect(textoDasTurmas(['7º A', '8º B'])).toBe('7º A, 8º B')
    expect(textoDasTurmas([])).toBe('Sem turma neste ano')
  })
})

describe('validarOPedido: os três campos contra o contrato, antes de a confirmação abrir', () => {
  const hoje = '2026-10-10'

  it('aceita o pedido inteiro, inclusive chegado hoje', () => {
    expect(validarOPedido({ tipo: 'eliminacao', solicitante: 'responsavel_legal', chegouEm: hoje }, hoje)).toEqual({
      ok: true,
      registro: { tipo: 'eliminacao', solicitante: 'responsavel_legal', chegouEm: hoje },
    })
  })

  it('diz o texto de cada campo que falta, e só dele', () => {
    const vazio = validarOPedido({ tipo: '', solicitante: '', chegouEm: '' }, hoje)
    expect(vazio.ok).toBe(false)
    if (!vazio.ok) expect(Object.keys(vazio.erros).sort()).toEqual(['chegouEm', 'solicitante', 'tipo'])
    const soTipo = validarOPedido({ tipo: 'invalido', solicitante: 'titular', chegouEm: hoje }, hoje)
    expect(soTipo.ok).toBe(false)
    if (!soTipo.ok) expect(Object.keys(soTipo.erros)).toEqual(['tipo'])
    const soQuemPediu = validarOPedido({ tipo: 'acesso', solicitante: '', chegouEm: hoje }, hoje)
    expect(soQuemPediu.ok).toBe(false)
    if (!soQuemPediu.ok) expect(Object.keys(soQuemPediu.erros)).toEqual(['solicitante'])
    const soODia = validarOPedido({ tipo: 'acesso', solicitante: 'titular', chegouEm: '' }, hoje)
    expect(soODia.ok).toBe(false)
    if (!soODia.ok) expect(Object.keys(soODia.erros)).toEqual(['chegouEm'])
  })

  it('recusa a chegada depois de hoje, como a API, e o dia que não existe', () => {
    const futuro = validarOPedido({ tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-10-11' }, hoje)
    expect(futuro.ok).toBe(false)
    const inexistente = validarOPedido({ tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-02-31' }, hoje)
    expect(inexistente.ok).toBe(false)
    const formato = validarOPedido({ tipo: 'acesso', solicitante: 'titular', chegouEm: '10/10/2026' }, hoje)
    expect(formato.ok).toBe(false)
    const mesQueNaoExiste = validarOPedido({ tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-13-01' }, hoje)
    expect(mesQueNaoExiste.ok).toBe(false)
  })

  it('aceita a chegada no passado, que é o pedido que chegou por escrito dias atrás', () => {
    expect(validarOPedido({ tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-09-01' }, hoje).ok).toBe(true)
  })
})

describe('hojeEmSaoPaulo: o dia por onde a API recusa o futuro', () => {
  // O dia de São Paulo não pode depender do fuso do computador de quem roda o teste: com o computador em São Paulo, a
  // função sem o `timeZone` passaria igual. O fuso é forçado para um que nunca é o de São Paulo.
  beforeEach(() => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('à 1h de UTC ainda é o dia anterior em São Paulo; às 4h de UTC já é o dia, com o computador em outro fuso', () => {
    // Sem esta linha o teste poderia passar sem o fuso ter mudado: Tóquio está 540 minutos à frente de UTC.
    expect(new Date('2026-10-10T01:00:00Z').getTimezoneOffset()).toBe(-540)
    expect(hojeEmSaoPaulo(new Date('2026-10-10T01:00:00Z'))).toBe('2026-10-09')
    expect(hojeEmSaoPaulo(new Date('2026-10-10T04:00:00Z'))).toBe('2026-10-10')
  })
})

describe('ordenarOsPedidos: a chegada mais recente primeiro, e o id no empate', () => {
  const item = (id: string, chegouEm: string): ItemDoPedido => ({ id, tipo: 'acesso', solicitante: 'titular', chegouEm, estado: 'recebido', titular: null })

  it('ordena por chegada decrescente, desempata por id e não muda a lista que recebeu', () => {
    const entrada = [item('b', '2026-10-01'), item('a', '2026-10-05'), item('c', '2026-10-05')]
    expect(ordenarOsPedidos(entrada).map(({ id }) => id)).toEqual(['a', 'c', 'b'])
    expect(entrada.map(({ id }) => id)).toEqual(['b', 'a', 'c'])
  })
})

describe('os textos de falha: dizem o que fazer, e o de queda diz que repetir não duplica', () => {
  it('o limite da busca manda esperar um minuto', () => {
    expect(TEXTOS_DA_FALHA_DA_BUSCA[ErrorCode.LIMITE_EXCEDIDO]).toContain('Aguarde um minuto')
  })

  it('a indisponibilidade do registro diz que o pedido não será registrado duas vezes', () => {
    expect(TEXTOS_DA_FALHA_DO_REGISTRO[ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]).toContain('não será registrado duas vezes')
    expect(TEXTOS_DA_FALHA_DO_REGISTRO[ErrorCode.ENTRADA_INVALIDA]).toContain('registre o pedido de novo')
  })
})
