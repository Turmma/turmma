// @vitest-environment jsdom
import { ErrorCode } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esquecerEspelhosDeOutroDono, gravarEspelho, lerEspelho } from './espelho-da-fila'

/**
 * O espelho da prova em `sessionStorage` (53.0, RF21), **sem a fila e sem a tela da Atividade**: o que ele guarda, o que o
 * esquema estrito aceita, e o que o fim da sessão faz com ele. A limpeza no "Sair", na suspensão e na entrada de outra
 * pessoa tem de valer num carregamento em que a Atividade nunca foi aberta (regra 20): por isso estes casos não importam
 * `fila-de-respostas.ts`, e a sessão é a de verdade. A fila e o espelho juntos são de `areas/aluno/espelho-da-fila.test.ts`.
 */
const ALUNA = '0197a1c0-0000-7000-8000-00000000a001'
const OUTRO_ALUNO = '0197a1c0-0000-7000-8000-00000000a002'
const ATIVIDADE = '0197a1c0-0000-7000-8000-00000000b001'
const OUTRA_ATIVIDADE = '0197a1c0-0000-7000-8000-00000000b002'
const TERCEIRA_ATIVIDADE = '0197a1c0-0000-7000-8000-00000000b003'

const chaveDe = (atividade: string) => `educa.escolhas-pendentes.${atividade}`
const guardado = (atividade: string) => window.sessionStorage.getItem(chaveDe(atividade))

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('o espelho guarda só ids, e só o que o esquema estrito aceita', () => {
  it('guarda a atividade, o dono e, por pendente, a questão, a alternativa e a sequência: nada além', () => {
    gravarEspelho(ALUNA, ATIVIDADE, [
      { questao: 3, alternativa: 1, sequencia: 4 },
      { questao: 5, alternativa: 0, sequencia: 2 },
    ])
    expect(JSON.parse(guardado(ATIVIDADE) ?? 'null')).toEqual({
      dono: ALUNA,
      atividade: ATIVIDADE,
      pendentes: [
        { questao: 3, alternativa: 1, sequencia: 4 },
        { questao: 5, alternativa: 0, sequencia: 2 },
      ],
    })
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([
      { questao: 3, alternativa: 1, sequencia: 4 },
      { questao: 5, alternativa: 0, sequencia: 2 },
    ])
  })

  it('sem pendente nenhuma, a chave sai: o espelho só existe enquanto há o que não foi confirmado', () => {
    gravarEspelho(ALUNA, ATIVIDADE, [{ questao: 1, alternativa: 0, sequencia: 1 }])
    gravarEspelho(ALUNA, ATIVIDADE, [])
    expect(guardado(ATIVIDADE)).toBeNull()
  })

  const BOM = { dono: ALUNA, atividade: ATIVIDADE, pendentes: [{ questao: 1, alternativa: 0, sequencia: 1 }] }
  it.each([
    ['um campo a mais no conjunto (o nome)', { ...BOM, nome: 'Aluna Sintética' }],
    ['um campo a mais na pendente (texto da resposta)', { ...BOM, pendentes: [{ questao: 1, alternativa: 0, sequencia: 1, texto: 'Quatro' }] }],
    ['a questão em texto', { ...BOM, pendentes: [{ questao: '1', alternativa: 0, sequencia: 1 }] }],
    ['a alternativa fora de 0 a 3', { ...BOM, pendentes: [{ questao: 1, alternativa: 7, sequencia: 1 }] }],
    ['o dono que não é um id', { ...BOM, dono: 'Aluna Sintética' }],
    ['a atividade que não é a da chave', { ...BOM, atividade: OUTRA_ATIVIDADE }],
    ['a questão fora de 1 a 20 (zero)', { ...BOM, pendentes: [{ questao: 0, alternativa: 0, sequencia: 1 }] }],
    ['a questão fora de 1 a 20 (vinte e uma)', { ...BOM, pendentes: [{ questao: 21, alternativa: 0, sequencia: 1 }] }],
    ['mais pendentes que questões', { ...BOM, pendentes: Array.from({ length: 21 }, () => ({ questao: 1, alternativa: 0, sequencia: 1 })) }],
  ])('descarta o conjunto inteiro, e apaga a chave: %s', (_caso, conteudo) => {
    window.sessionStorage.setItem(chaveDe(ATIVIDADE), JSON.stringify(conteudo))
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([])
    expect(guardado(ATIVIDADE)).toBeNull()
  })

  it('o JSON quebrado também é descartado', () => {
    window.sessionStorage.setItem(chaveDe(ATIVIDADE), '{"dono":')
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([])
    expect(guardado(ATIVIDADE)).toBeNull()
  })

  it('o que é de outro dono não volta, e sai do armazenamento', () => {
    gravarEspelho(OUTRO_ALUNO, ATIVIDADE, [{ questao: 1, alternativa: 0, sequencia: 1 }])
    expect(lerEspelho(ALUNA, ATIVIDADE)).toEqual([])
    expect(guardado(ATIVIDADE)).toBeNull()
  })

  it('o dono que não é um id não vale nem para quem o escreveu: sai, mesmo que seja o dono da vez', () => {
    window.sessionStorage.setItem(chaveDe(ATIVIDADE), JSON.stringify({ dono: 'Aluna Sintética', atividade: ATIVIDADE, pendentes: [{ questao: 1, alternativa: 0, sequencia: 1 }] }))
    esquecerEspelhosDeOutroDono('Aluna Sintética')
    expect(guardado(ATIVIDADE)).toBeNull()
  })

  it('esquecer o de outro dono apaga as chaves dele e deixa as do dono atual, e o que for ilegível sai também', () => {
    gravarEspelho(ALUNA, ATIVIDADE, [{ questao: 1, alternativa: 0, sequencia: 1 }])
    gravarEspelho(OUTRO_ALUNO, OUTRA_ATIVIDADE, [{ questao: 2, alternativa: 1, sequencia: 3 }])
    window.sessionStorage.setItem(chaveDe(TERCEIRA_ATIVIDADE), 'lixo')
    // Do dono certo, mas com a atividade que não é um id: o esquema estrito não a aceita, e ela sai.
    window.sessionStorage.setItem(chaveDe('nao-e-um-id'), JSON.stringify({ dono: ALUNA, atividade: 'nao-e-um-id', pendentes: [{ questao: 1, alternativa: 0, sequencia: 1 }] }))
    window.sessionStorage.setItem('outra-coisa-da-aba', 'fica')
    esquecerEspelhosDeOutroDono(ALUNA)
    expect(guardado(ATIVIDADE)).not.toBeNull()
    expect(guardado(OUTRA_ATIVIDADE)).toBeNull()
    expect(guardado(TERCEIRA_ATIVIDADE)).toBeNull()
    expect(guardado('nao-e-um-id')).toBeNull()
    expect(window.sessionStorage.getItem('outra-coisa-da-aba')).toBe('fica')
  })
})

const importarSessao = () => import('./sessao')

describe('o fim da sessão e o espelho, sem a tela da Atividade (a sessão é a de verdade)', () => {
  type ModuloDeSessao = Awaited<ReturnType<typeof importarSessao>>
  let sessao: ModuloDeSessao
  let respostas: { status: number; corpo?: unknown }[] = []

  const DAQUI_A_MUITO = '2099-01-01T00:00:00.000Z'
  const entrada = { status: 200, corpo: { etapa: 'pronta', token: 'token-1', expiraEm: DAQUI_A_MUITO } }
  const envelope = (codigo: string) => ({ erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } })

  /** O espelho de três atividades da aluna, e uma chave que não é do espelho. */
  function deixarEspelhos(): void {
    for (const atividade of [ATIVIDADE, OUTRA_ATIVIDADE, TERCEIRA_ATIVIDADE]) gravarEspelho(ALUNA, atividade, [{ questao: 1, alternativa: 2, sequencia: 3 }])
    window.sessionStorage.setItem('outra-coisa-da-aba', 'fica')
  }
  const espelhosQueFicaram = () => [ATIVIDADE, OUTRA_ATIVIDADE, TERCEIRA_ATIVIDADE].filter((atividade) => guardado(atividade) !== null)

  beforeEach(async () => {
    respostas = []
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const resposta = respostas.shift()
        if (resposta === undefined) throw new Error('chamada sem resposta preparada')
        return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), { status: resposta.status })
      }),
    )
    // O módulo do espelho carrega depois da sessão nova: é ele que registra o gancho, como a casca o carrega na aba.
    sessao = await importarSessao()
    await import('./espelho-da-fila')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('o "Sair" apaga o espelho de todas as atividades, e só o dele; entrar, antes, não apagou nada', async () => {
    deixarEspelhos()
    respostas.push(entrada)
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    expect(espelhosQueFicaram()).toHaveLength(3)

    respostas.push({ status: 204 })
    await sessao.sair()
    expect(sessao.estadoDaSessao()).toBe('anonima')
    expect(espelhosQueFicaram()).toEqual([])
    expect(window.sessionStorage.getItem('outra-coisa-da-aba')).toBe('fica')
  })

  it('o "Sair" que a API não confirma apaga do mesmo jeito: a aba esquece a sessão de qualquer jeito', async () => {
    deixarEspelhos()
    respostas.push(entrada)
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    respostas.push({ status: 500, corpo: envelope(ErrorCode.ERRO_INTERNO) })
    await sessao.sair()
    expect(espelhosQueFicaram()).toEqual([])
  })

  it('a sessão suspensa apaga: quem tem a eliminação agendada não volta', async () => {
    deixarEspelhos()
    respostas.push({ status: 403, corpo: envelope(ErrorCode.ACESSO_SUSPENSO) })
    await sessao.abrirSessaoPeloCookie()
    expect(sessao.estadoDaSessao()).toBe('suspensa')
    expect(espelhosQueFicaram()).toEqual([])
  })

  it('a sessão vencida por inatividade não apaga: o mesmo aluno volta e as escolhas ainda saem', async () => {
    deixarEspelhos()
    respostas.push(entrada)
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    respostas.push({ status: 204 })
    await sessao.encerrarPorInatividade()
    expect(sessao.estadoDaSessao()).toBe('vencida')
    expect(espelhosQueFicaram()).toHaveLength(3)
  })

  it('o F5 com a sessão vencida: a aba nova abre anônima sem trocar de sessão, e o espelho fica para o mesmo aluno entrar', async () => {
    deixarEspelhos()
    respostas.push({ status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) })
    await sessao.abrirSessaoPeloCookie()
    expect(sessao.estadoDaSessao()).toBe('anonima')
    expect(espelhosQueFicaram()).toHaveLength(3)

    // O mesmo aluno entra: nada foi apagado, e só a casca apagaria o de outro.
    respostas.push(entrada)
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    expect(espelhosQueFicaram()).toHaveLength(3)
  })
})
