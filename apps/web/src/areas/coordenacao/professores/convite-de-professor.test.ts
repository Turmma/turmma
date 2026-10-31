import { ErrorCode, ESTADOS_DO_PROFESSOR, MENSAGENS_DE_ERRO, type EstadoDoProfessor } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../../../api/client'
import { TEXTO_DO_EMAIL_INVALIDO, TEXTO_DO_NOME_INVALIDO } from '../../../components/pedido-de-convite'
import {
  acoesDoConviteDeProfessor,
  falhaDoCadastroDeProfessor,
  falhaDoRefazerConviteDeProfessor,
  FAMILIA_DO_ESTADO_DO_PROFESSOR,
  pedidoDeProfessor,
  temHomonimo,
  TEXTO_DA_VALIDADE_DO_CONVITE,
  TEXTO_DO_ESTADO_DO_PROFESSOR,
  TEXTOS_DO_CONVITE_QUE_MUDOU,
  type AcaoDoConviteDeProfessor,
} from './convite-de-professor'

/**
 * As ações da linha do professor pela matriz da Tech Spec da A1, seção 4, escrita aqui por extenso: uma célula trocada na
 * matriz de `@educa/shared`, ou um estado novo sem linha, deixa vermelho.
 */
const ESPERADO: Readonly<Record<EstadoDoProfessor, readonly AcaoDoConviteDeProfessor[]>> = {
  pendente: ['refazer', 'revogar'],
  vencido: ['refazer', 'revogar'],
  revogado: [],
  aceito: [],
  ativo: [],
  desativado: [],
}

describe('o convite do professor na tela Professores (A1, 14.0)', () => {
  it('cada estado oferece só o que a matriz permite: refazer e revogar no convite em aberto, e nada no resto', () => {
    for (const estado of ESTADOS_DO_PROFESSOR) expect(acoesDoConviteDeProfessor(estado), estado).toEqual(ESPERADO[estado])
  })

  it('W4: cada estado tem o seu texto, e o que não tem ação diz o próximo passo sem pedir o que a lista não mostra', () => {
    expect(TEXTO_DO_ESTADO_DO_PROFESSOR).toEqual({
      pendente: 'Convite em aberto, ainda não aceito.',
      vencido: 'Convite vencido. Refaça o convite para gerar um link novo.',
      revogado: 'Convite revogado. Para convidar de novo, cadastre o mesmo e-mail.',
      aceito: 'Convite aceito.',
      ativo: 'Ativo.',
      desativado: 'Desativado. Para convidar de novo, cadastre o mesmo e-mail.',
    })
    // O `aceito` não diz se a pessoa já entrou: separar os dois casos diria se o e-mail tinha conta em outra escola (E11).
    expect(TEXTO_DO_ESTADO_DO_PROFESSOR.aceito).not.toMatch(/entr|conta|senha/i)
  })

  it('cada estado tem a família do selo: o que espera é pendente, o vencido é erro, quem entrou é ok, e o revogado e o desativado são info', () => {
    expect(FAMILIA_DO_ESTADO_DO_PROFESSOR).toEqual({ pendente: 'pendente', vencido: 'erro', revogado: 'info', aceito: 'ok', ativo: 'ok', desativado: 'info' })
  })

  it('o prazo dito é o do convite do professor, em dias', () => {
    expect(TEXTO_DA_VALIDADE_DO_CONVITE).toBe('O convite vale 7 dias e entra uma vez só.')
  })

  it('o pedido sai pelo contrato estrito da API: o nome sem os espaços das pontas e o e-mail em minúsculas', () => {
    expect(pedidoDeProfessor({ nome: '  Professora Sintética ', email: ' Prof.Sintetica@Escola.INVALID ' })).toEqual({
      ok: true,
      pedido: { nome: 'Professora Sintética', email: 'prof.sintetica@escola.invalid' },
    })
  })

  it('e-mail sem @, sem domínio ou vazio volta com o texto do campo; o nome vazio ou longo demais, com o dele; os dois de uma vez', () => {
    for (const email of ['', 'professor', 'professor@', '@escola.invalid', 'professor@escola']) {
      expect(pedidoDeProfessor({ nome: 'Professor', email }), email).toEqual({ ok: false, erros: { email: TEXTO_DO_EMAIL_INVALIDO } })
    }
    expect(pedidoDeProfessor({ nome: 'x'.repeat(201), email: 'professor@escola.invalid' })).toEqual({ ok: false, erros: { nome: TEXTO_DO_NOME_INVALIDO } })
    expect(pedidoDeProfessor({ nome: '  ', email: 'x' })).toEqual({ ok: false, erros: { nome: TEXTO_DO_NOME_INVALIDO, email: TEXTO_DO_EMAIL_INVALIDO } })
  })

  it('o nome que já está na lista é reconhecido sem contar maiúscula, acento nem espaço sobrando; outro nome, não', () => {
    const lista = [{ nome: 'José Silva' }, { nome: 'Ana Souza' }]
    expect(temHomonimo(lista, 'José Silva')).toBe(true)
    expect(temHomonimo(lista, '  jose silva ')).toBe(true)
    expect(temHomonimo(lista, 'JOSÉ SILVA')).toBe(true)
    // O espaço dobrado no meio, de um lado ou do outro, não faz dois nomes.
    expect(temHomonimo(lista, 'José  Silva')).toBe(true)
    expect(temHomonimo([{ nome: 'Ana   Souza' }], 'Ana Souza')).toBe(true)
    // O sobrenome a mais é o que distingue os dois, e é o que o aviso pede.
    expect(temHomonimo(lista, 'José Silva Neto')).toBe(false)
    expect(temHomonimo(lista, 'José')).toBe(false)
    expect(temHomonimo([], 'José Silva')).toBe(false)
  })

  it('o CONFLITO do cadastro é do e-mail digitado: diz o que fazer, sem dizer de quem é, e deixa a pessoa voltar e corrigir', () => {
    const falha = falhaDoCadastroDeProfessor(new ErroDaApi(ErrorCode.CONFLITO))
    expect(falha).toEqual({
      texto: 'Este e-mail já é de um professor desta escola, ativo ou com o convite em aberto. Confira o e-mail; para um link novo, use Refazer na lista.',
      listaMudou: false,
    })
    // O resto é o texto do catálogo, e o mesmo botão tenta de novo.
    expect(falhaDoCadastroDeProfessor(new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toEqual({ texto: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, listaMudou: false })
    expect(falhaDoCadastroDeProfessor(new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO, 7))).toEqual({ texto: MENSAGENS_DE_ERRO.LIMITE_EXCEDIDO, listaMudou: false })
  })

  it('o CONFLITO e o NAO_ENCONTRADO do refazer dizem que o convite mudou e que a lista foi atualizada; o resto deixa tentar de novo', () => {
    expect(falhaDoRefazerConviteDeProfessor(new ErroDaApi(ErrorCode.CONFLITO))).toEqual({ texto: 'O convite mudou. A lista foi atualizada.', listaMudou: true })
    expect(falhaDoRefazerConviteDeProfessor(new ErroDaApi(ErrorCode.NAO_ENCONTRADO))).toEqual({ texto: 'Esse convite já não vale. A lista foi atualizada.', listaMudou: true })
    expect(falhaDoRefazerConviteDeProfessor(new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toEqual({ texto: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO, listaMudou: false })
    // O que não veio da API (um erro de código nosso) nunca diz que a lista mudou.
    expect(falhaDoRefazerConviteDeProfessor(new Error('CONFLITO'))).toEqual({ texto: MENSAGENS_DE_ERRO.ERRO_INTERNO, listaMudou: false })
    // O revogar usa os mesmos dois textos, pela confirmação de perigo.
    expect(TEXTOS_DO_CONVITE_QUE_MUDOU).toEqual({ CONFLITO: 'O convite mudou. A lista foi atualizada.', NAO_ENCONTRADO: 'Esse convite já não vale. A lista foi atualizada.' })
  })

  it('nenhum texto de falha mostra o código do erro', () => {
    for (const codigo of Object.values(ErrorCode)) {
      for (const falha of [falhaDoCadastroDeProfessor(new ErroDaApi(codigo)), falhaDoRefazerConviteDeProfessor(new ErroDaApi(codigo))]) expect(falha.texto, codigo).not.toContain(codigo)
    }
  })
})
