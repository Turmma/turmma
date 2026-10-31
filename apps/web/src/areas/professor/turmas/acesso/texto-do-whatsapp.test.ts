import { describe, expect, it } from 'vitest'
import { caminhoDaSala } from '../../../../paths'
import { linkDoConvite } from '../../../../components/link-do-convite'
import { abrirWhatsApp, enderecoDoWhatsApp, textoDoWhatsApp, type ConviteDaTurma, type JanelaQueAbre } from './texto-do-whatsapp'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const LINK = `https://turmma.test/e/colegio-horizonte/turma#${TOKEN}`

describe('E16: o texto do WhatsApp', () => {
  it('traz o nome da escola e o link, e nada do que a tela tem a mais: nem nome de aluno, nem matrícula, nem a turma (sentinela)', () => {
    // O que a tela do professor tem à mão quando monta o texto: a função só lê a escola e o link.
    const tudoQueATelaTem = {
      escolaNome: 'Colégio Horizonte',
      link: LINK,
      turmaNome: 'SENTINELA-TURMA 7ºA',
      nomes: ['SENTINELA-ALUNO Ana Souza', 'SENTINELA-ALUNO Bruno Lima'],
      matriculas: ['SENTINELA-MATRICULA 2026001'],
      codigo: 'SENTINELA-CODIGO',
    }
    const convite: ConviteDaTurma = tudoQueATelaTem
    const texto = textoDoWhatsApp(convite)
    expect(texto).toBe(`Colégio Horizonte no Turmma.\nAbra o link, escolha o seu nome na lista da turma, informe a sua matrícula e crie a sua senha:\n${LINK}`)
    expect(texto).toContain('Colégio Horizonte')
    expect(texto).toContain(LINK)
    expect(texto).not.toContain('SENTINELA')
    expect(enderecoDoWhatsApp(texto)).not.toContain('SENTINELA')
  })

  it('o endereço é o wa.me com o texto inteiro na consulta, e o texto volta igual de lá, com o # do link e o acento da escola', () => {
    const texto = textoDoWhatsApp({ escolaNome: 'Escola Municipal São João & Cia', link: LINK })
    const endereco = new URL(enderecoDoWhatsApp(texto))
    expect(endereco.origin).toBe('https://wa.me')
    expect(endereco.pathname).toBe('/')
    expect([...endereco.searchParams.keys()]).toEqual(['text'])
    expect(endereco.searchParams.get('text')).toBe(texto)
    // O fragmento do link da sala vai dentro do texto, e não vira o fragmento do endereço do WhatsApp.
    expect(endereco.hash).toBe('')
  })

  it('o link da sala é o endereço da escola com /turma e o token no fragmento, nunca no caminho nem na consulta', () => {
    expect(caminhoDaSala('colegio-horizonte')).toBe('/e/colegio-horizonte/turma')
    const link = new URL(linkDoConvite('https://turmma.test', caminhoDaSala('colegio-horizonte'), TOKEN))
    expect(link.href).toBe(LINK)
    expect(link.pathname).not.toContain(TOKEN)
    expect(link.search).toBe('')
    expect(link.hash).toBe(`#${TOKEN}`)
  })
})

describe('abrir o WhatsApp', () => {
  it('abre o wa.me numa aba nova, com o texto, e a aba nova fica sem a referência desta', () => {
    const abertas: { endereco: string; alvo: string }[] = []
    const novaAba = { opener: 'a tela do professor' as unknown }
    const janela: JanelaQueAbre = {
      open(endereco, alvo) {
        abertas.push({ endereco, alvo })
        return novaAba
      },
    }
    expect(abrirWhatsApp('o convite', janela)).toBe(true)
    expect(abertas).toEqual([{ endereco: 'https://wa.me/?text=o%20convite', alvo: '_blank' }])
    expect(novaAba.opener).toBeNull()
  })

  it('sem o WhatsApp (o navegador não abriu a aba nova), diz que não abriu, e quem chama copia o texto', () => {
    const janela: JanelaQueAbre = { open: () => null }
    expect(abrirWhatsApp('o convite', janela)).toBe(false)
  })
})
