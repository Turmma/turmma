import { ALFABETO_DA_SENHA_PROVISORIA, ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { TEST_AUTHORIZATION, fakeNetwork, setupScreen } from '../../__fixtures__/render-screen'
import { ApiError } from '../client'
import { gerarASenhaProvisoria, lerOAlvoDaSenhaProvisoria, senhaSoletrada, TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA, TEXTO_DO_ALUNO_QUE_SAIU_DA_TURMA, TEXTOS_DA_FALHA_DA_PROVISORIA } from './senha-provisoria'

/**
 * A senha provisória na web (acesso-e-convites, 12.0; RF13): as duas chamadas, que não passam pelo cache de consultas (a tela do diálogo prova que nada fica), o texto de cada falha e a
 * senha soletrada para o leitor de tela.
 */
setupScreen()

const ALUNO = '0197a1c0-0000-7000-8000-000000000001'
const ALVO = { nome: 'Ana Souza', turma: '7º A', matricula: '2026001', entraPelaContaDaEscola: false }

describe('as chamadas', () => {
  it('lê o alvo pelo id do aluno, com a sessão, e devolve só o que o contrato traz', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: ALVO })

    expect(await lerOAlvoDaSenhaProvisoria(ALUNO)).toEqual(ALVO)
    expect(rede.chamadas).toEqual([{ caminho: `/v1/usuarios/${ALUNO}/senha-provisoria`, metodo: 'GET', autorizacao: TEST_AUTHORIZATION }])
  })

  it('o alvo com um campo a mais (hash, validade) não passa: o contrato é estrito', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { ...ALVO, provisoriaExpiraEm: '2026-11-10T00:00:00.000Z' } })

    await expect(lerOAlvoDaSenhaProvisoria(ALUNO)).rejects.toMatchObject({ codigo: ErrorCode.ERRO_INTERNO })
  })

  it('gera pelo POST do mesmo caminho, sem corpo, e devolve a senha em dois grupos com a validade', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { senha: 'ABCD-2345', expiraEm: '2026-11-10T17:05:00.000Z' } })

    expect(await gerarASenhaProvisoria(ALUNO)).toEqual({ senha: 'ABCD-2345', expiraEm: '2026-11-10T17:05:00.000Z' })
    expect(rede.chamadas).toEqual([{ caminho: `/v1/usuarios/${ALUNO}/senha-provisoria`, metodo: 'POST', autorizacao: TEST_AUTHORIZATION }])
  })

  it('a senha fora do alfabeto (com 0, 1, I, L ou O) é recusada: a tela não mostra o que o servidor não sorteia', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { senha: 'AB0D-2345', expiraEm: '2026-11-10T17:05:00.000Z' } })

    await expect(gerarASenhaProvisoria(ALUNO)).rejects.toBeInstanceOf(ApiError)
    expect(ALFABETO_DA_SENHA_PROVISORIA).not.toContain('0')
  })
})

describe('os textos e a senha soletrada', () => {
  it('cada falha tem o texto da tela: conta da escola, aluno que saiu, conflito e limite', () => {
    expect(TEXTOS_DA_FALHA_DA_PROVISORIA).toEqual({
      ENTRA_PELA_CONTA_DA_ESCOLA: 'Este aluno entra pela conta da escola. Não precisa de senha.',
      NAO_ENCONTRADO: 'Este aluno não está mais na turma. A lista foi atualizada.',
      CONFLITO: 'Esta senha acabou de ser gerada. Espere alguns segundos para gerar outra.',
      LIMITE_EXCEDIDO: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    })
    expect(TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA).toBe(TEXTOS_DA_FALHA_DA_PROVISORIA.ENTRA_PELA_CONTA_DA_ESCOLA)
    expect(TEXTO_DO_ALUNO_QUE_SAIU_DA_TURMA).toBe(TEXTOS_DA_FALHA_DA_PROVISORIA.NAO_ENCONTRADO)
  })

  it('a senha soletrada diz caractere a caractere, com a pausa entre os dois grupos', () => {
    expect(senhaSoletrada('ABCD-2345')).toBe('A B C D, 2 3 4 5')
  })
})
