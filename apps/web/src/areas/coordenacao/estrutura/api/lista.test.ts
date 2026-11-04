// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fakeNetwork, setupScreen } from '../../../../__fixtures__/render-screen'
import { PRAZO_DA_IMPORTACAO_MS } from '../ponte-da-lista'
import { gravarLista, previaDaLista } from './lista'

/**
 * A prévia e a gravação da lista da turma na web, contra o contrato novo da API (F2, 8.0): a prévia sem nome nem matrícula, a gravação
 * com 202 e o acompanhamento em `GET /v1/importacoes/:id`. A tela da A1 ainda lê o formato antigo até a 13.0 (que a troca pelo
 * `ImportarPlanilha` e apaga este arquivo): o cliente faz a ponte, e o que se prova aqui é a ponte. A rede é falsa.
 */
setupScreen()

const TURMA = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f5'
const IMPORTACAO = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f6'
const previa = (linhas: readonly object[], contagens: Record<string, number> = {}) => ({ status: 200, corpo: { linhas, contagens, candidatos: [] } })
const importacao = (estado: string, extra: Record<string, unknown> = {}) => ({
  status: 200,
  corpo: { id: IMPORTACAO, tipo: 'alunos', estado, resumo: null, erro: null, criadoEm: '2026-11-04T10:00:00-03:00', concluidaEm: null, ...extra },
})

describe('a prévia da lista, lida no contrato da importação', () => {
  it('devolve o nome e a matrícula de cada linha pelo número dela no texto, e as contagens pelas linhas', async () => {
    const rede = fakeNetwork()
    rede.responder(previa([{ linha: 2, resultado: 'entra' }, { linha: 3, resultado: 'ja_existe' }, { linha: 5, resultado: 'erro', erro: 'sem_matricula' }]))

    const resposta = await previaDaLista(TURMA, 'Nome;Matrícula\nAna Sintética;1001\nBia Sintética;1002\n\nCaio Sintético')

    expect(resposta.linhas).toEqual([
      { linha: 2, nome: 'Ana Sintética', matricula: '1001', resultado: 'entra' },
      { linha: 3, nome: 'Bia Sintética', matricula: '1002', resultado: 'ja_existe' },
      { linha: 5, nome: 'Caio Sintético', matricula: '', resultado: 'erro', erro: 'sem_matricula' },
    ])
    expect([resposta.entram, resposta.jaExistem, resposta.comErro]).toEqual([1, 1, 1])
    expect(rede.chamadas.map(({ caminho, metodo }) => `${metodo} ${caminho}`)).toEqual([`POST /v1/turmas/${TURMA}/lista/previa`])
  })

  it('lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo', async () => {
    const rede = fakeNetwork()
    rede.responder(previa([2, 3, 4, 5].map((linha) => ({ linha, resultado: 'entra' }))))

    const { linhas } = await previaDaLista(TURMA, 'Matrícula\tNome\r\n2001\t"Dias, Ana"\r\n2002\tBia\r\n2003\t"Cruz ""Lu"" Reis"\r\n2004\tLu "Bi" Dias')

    expect(linhas.map(({ nome, matricula }) => [nome, matricula])).toEqual([
      ['Dias, Ana', '2001'],
      ['Bia', '2002'],
      ['Cruz "Lu" Reis', '2003'],
      ['Lu "Bi" Dias', '2004'],
    ])
  })

  it('o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela', async () => {
    const colunas = async (texto: string, linhas: readonly number[]) => {
      fakeNetwork().responder(previa(linhas.map((linha) => ({ linha, resultado: 'entra' }))))
      return (await previaDaLista(TURMA, texto)).linhas.map(({ nome, matricula }) => [nome, matricula])
    }

    expect(await colunas('Ana\nBia', [1, 2])).toEqual([['Ana', ''], ['Bia', '']])
    expect(await colunas('Ana;1\rBia;2', [1, 2])).toEqual([['Ana', '1'], ['Bia', '2']])
    expect(await colunas('Turma 8A\nAna;1\nBia;2', [2, 3])).toEqual([['Ana', '1'], ['Bia', '2']])
    // "Nome e matrícula" numa coluna só não é cabeçalho de duas; "Nome;Idade" não tem matrícula: nos dois a primeira linha é de aluno.
    expect(await colunas('Nome e matrícula\nAna', [1, 2])).toEqual([['Nome e matrícula', ''], ['Ana', '']])
    expect(await colunas('Nome;Idade\nAna;1', [1, 2])).toEqual([['Nome', 'Idade'], ['Ana', '1']])
  })

  it('a matrícula que muda de turma sem a marca vira o erro "em uso", e o "já existe" segue sendo só o que nada muda', async () => {
    const rede = fakeNetwork()
    rede.responder(previa([{ linha: 1, resultado: 'muda_de_turma' }, { linha: 2, resultado: 'ja_existe' }, { linha: 9, resultado: 'entra' }]))

    const resposta = await previaDaLista(TURMA, 'Ana;1\nBia;2')

    expect(resposta.linhas.map(({ resultado, erro }) => [resultado, erro])).toEqual([['erro', 'matricula_em_uso'], ['ja_existe', undefined], ['entra', undefined]])
    expect([resposta.entram, resposta.jaExistem, resposta.comErro]).toEqual([1, 1, 1])
    // A linha que o texto não tem (a API só devolve as do texto) sai sem nome nem matrícula, e não com o de outra.
    expect(resposta.linhas[2]).toMatchObject({ nome: '', matricula: '' })
  })

  it('o nome corrigido grava, e a tela da lista não sabe dizer isso: é falha de contrato, e não "já existe, nada muda"', async () => {
    const rede = fakeNetwork()
    rede.responder(previa([{ linha: 1, resultado: 'nome_corrigido' }]))

    await expect(previaDaLista(TURMA, 'Ana Maria;1')).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })

  it('cada código de erro da planilha de alunos que a lista alcança vira o equivalente dela', async () => {
    const equivalentes: Record<string, string> = {
      linha_incompleta: 'sem_matricula',
      sem_nome: 'sem_nome',
      nome_invalido: 'nome_invalido',
      sem_matricula: 'sem_matricula',
      matricula_invalida: 'matricula_invalida',
      matricula_notacao_cientifica: 'matricula_invalida',
      matricula_parece_documento: 'matricula_parece_documento',
      matricula_repetida: 'matricula_repetida',
    }
    const codigos = Object.keys(equivalentes)
    const rede = fakeNetwork()
    rede.responder(previa(codigos.map((erro, posicao) => ({ linha: posicao + 1, resultado: 'erro', erro }))))

    const { linhas } = await previaDaLista(TURMA, codigos.map((codigo) => `Aluno ${codigo};1`).join('\n'))

    expect(linhas.map(({ erro }) => erro)).toEqual(codigos.map((codigo) => equivalentes[codigo]))
  })

  it('um código ou resultado que a lista da turma não alcança é falha de contrato, e não texto trocado', async () => {
    const rede = fakeNetwork()
    rede.responder(previa([{ linha: 1, resultado: 'erro', erro: 'turma_ambigua' }]))
    rede.responder(previa([{ linha: 1, resultado: 'fora_da_planilha' }]))

    await expect(previaDaLista(TURMA, 'Ana;1')).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
    await expect(previaDaLista(TURMA, 'Ana;1')).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })
})

describe('a gravação da lista, que responde 202 e se acompanha', () => {
  it('manda o texto, espera a importação concluir e devolve as contagens do resumo', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('na_fila'))
    rede.responder(importacao('concluida', { resumo: { entram: 2, ja_existem: 1 }, concluidaEm: '2026-11-04T10:00:02-03:00' }))

    const gravacao = await gravarLista(TURMA, 'Ana;1\nBia;2\nCaio;3', { esperaMs: 0 })

    expect(gravacao).toEqual({ gravados: 2, jaExistentes: 1 })
    expect(rede.chamadas.map(({ caminho, metodo }) => `${metodo} ${caminho}`)).toEqual([
      `POST /v1/turmas/${TURMA}/lista`,
      `GET /v1/importacoes/${IMPORTACAO}`,
      `GET /v1/importacoes/${IMPORTACAO}`,
    ])
  })

  it('o resumo sem contagem vale zero, e o cabeçalho não é aluno', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('concluida', { resumo: {}, concluidaEm: '2026-11-04T10:00:02-03:00' }))

    expect(await gravarLista(TURMA, 'Nome;Matrícula', { esperaMs: 0 })).toEqual({ gravados: 0, jaExistentes: 0 })
  })

  it('o nome corrigido conta entre os gravados, e a transferência entre as linhas atendidas', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('concluida', { resumo: { entram: 1, nomes_corrigidos: 1, ja_existem: 1, transferidos: 1 }, concluidaEm: '2026-11-04T10:00:02-03:00' }))

    expect(await gravarLista(TURMA, 'Nome;Matrícula\nAna;1\nBia;2\nCaio;3\nDani;4', { esperaMs: 0 })).toEqual({ gravados: 2, jaExistentes: 1 })
  })

  it('a linha que a gravação deixou de fora é CONFLITO, com parte da lista gravada ou sem nada gravado: o texto que a tela diz está em ListaDaTurma.test.tsx', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('concluida', { resumo: { entram: 1 }, concluidaEm: '2026-11-04T10:00:02-03:00' }))
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('concluida', { resumo: null, concluidaEm: '2026-11-04T10:00:02-03:00' }))

    await expect(gravarLista(TURMA, 'Ana;1\nBia;2', { esperaMs: 0 })).rejects.toMatchObject({ codigo: 'CONFLITO' })
    await expect(gravarLista(TURMA, 'Ana;1', { esperaMs: 0 })).rejects.toMatchObject({ codigo: 'CONFLITO' })
  })

  it('a prévia que envelheceu é CONFLITO, e a tela a descarta', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('desatualizada'))

    await expect(gravarLista(TURMA, 'Ana;1', { esperaMs: 0 })).rejects.toMatchObject({ codigo: 'CONFLITO' })
  })

  it('a importação que falhou é falha de servidor, e a prévia fica para tentar de novo', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder(importacao('falhou', { erro: 'erro_interno', concluidaEm: '2026-11-04T10:00:02-03:00' }))

    await expect(gravarLista(TURMA, 'Ana;1', { esperaMs: 0 })).rejects.toMatchObject({ codigo: 'ERRO_INTERNO' })
  })

  it('lê a importação com a espera que cresce: no prazo inteiro são poucas leituras, bem abaixo do limite por usuário', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responderPor(`/v1/importacoes/${IMPORTACAO}`, importacao('na_fila'))
    vi.useFakeTimers()
    try {
      const resultado = expect(gravarLista(TURMA, 'Ana;1')).rejects.toMatchObject({ codigo: 'INDISPONIVEL_TENTE_DE_NOVO' })
      await vi.advanceTimersByTimeAsync(PRAZO_DA_IMPORTACAO_MS + 5_000)
      await resultado
    } finally {
      vi.useRealTimers()
    }

    const leituras = rede.chamadas.filter(({ metodo }) => metodo === 'GET').length
    // O limite por usuário é de 120 por minuto, dividido com tudo o mais que a pessoa faz: a gravação não passa de um quarto dele.
    expect(leituras).toBeGreaterThan(10)
    expect(leituras).toBeLessThanOrEqual(30)
  })

  it('a primeira espera é de 1 s e a seguinte, de 1,5 s', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responderPor(`/v1/importacoes/${IMPORTACAO}`, importacao('na_fila'))
    const gets = () => rede.chamadas.filter(({ metodo }) => metodo === 'GET').length
    vi.useFakeTimers()
    try {
      // Sem `esperaMs`: o padrão é o que se prova. O teto da espera (`Math.min`) é pego pelo caso vizinho, que conta as leituras no prazo inteiro.
      const resultado = expect(gravarLista(TURMA, 'Ana;1')).rejects.toMatchObject({ codigo: 'INDISPONIVEL_TENTE_DE_NOVO' })
      await vi.advanceTimersByTimeAsync(0)
      expect(gets()).toBe(1)
      await vi.advanceTimersByTimeAsync(999)
      expect(gets()).toBe(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(gets()).toBe(2)
      await vi.advanceTimersByTimeAsync(1_499)
      expect(gets()).toBe(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(gets()).toBe(3)
      await vi.advanceTimersByTimeAsync(PRAZO_DA_IMPORTACAO_MS)
      await resultado
    } finally {
      vi.useRealTimers()
    }
  })

  it('o limite por usuário numa leitura não chega à tela: a ponte espera e, passado o prazo, é indisponibilidade', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responderPor(`/v1/importacoes/${IMPORTACAO}`, { status: 429 })
    vi.useFakeTimers()
    try {
      const resultado = expect(gravarLista(TURMA, 'Ana;1', { esperaMs: 100, prazoMs: 1_000 })).rejects.toMatchObject({ codigo: 'INDISPONIVEL_TENTE_DE_NOVO' })
      await vi.advanceTimersByTimeAsync(5_000)
      await resultado
    } finally {
      vi.useRealTimers()
    }
  })

  it('o limite por usuário numa leitura, e depois a importação concluída: a gravação conclui', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responder({ status: 429 })
    rede.responder(importacao('concluida', { resumo: { entram: 1 }, concluidaEm: '2026-11-04T10:00:02-03:00' }))

    expect(await gravarLista(TURMA, 'Ana;1', { esperaMs: 0 })).toEqual({ gravados: 1, jaExistentes: 0 })
  })

  it('desiste depois do prazo, sem esperar para sempre', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 202, corpo: { id: IMPORTACAO } })
    rede.responderPor(`/v1/importacoes/${IMPORTACAO}`, importacao('na_fila'))
    vi.useFakeTimers()
    try {
      const resultado = expect(gravarLista(TURMA, 'Ana;1', { esperaMs: 100, prazoMs: 1_000 })).rejects.toMatchObject({ codigo: 'INDISPONIVEL_TENTE_DE_NOVO' })
      await vi.advanceTimersByTimeAsync(2_000)
      await resultado
    } finally {
      vi.useRealTimers()
    }
  })
})
