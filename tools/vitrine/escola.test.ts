import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Secret, TOTP } from 'otpauth'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { acessosDa, CONTA_DO_PROVEDOR_SINTETICO, codigoDoPasso, comPassoGasto, DOMINIO_DO_PROVEDOR_SINTETICO, gravarVitrine, lerVitrine, passoDeAgora, proximoPasso, resumo, type Acessos, type Vitrine } from './escola.ts'

const MEIO_MINUTO = 30_000
// Um instante no meio de um passo, para o teste não depender de onde o relógio cai.
const AGORA = 60_000_000 * MEIO_MINUTO + 12_000
const PASSO = 60_000_000

describe('o próximo código do segundo fator da vitrine', () => {
  it('é o do passo de agora quando o último usado ficou para trás', () => {
    expect(passoDeAgora(AGORA)).toBe(PASSO)
    expect(proximoPasso(AGORA, PASSO - 5)).toEqual({ passo: PASSO, esperarSegundos: 0 })
  })

  it('nunca repete o passo que a ativação ou a entrada anterior já gastou', () => {
    // A API só aceita passo maior que o guardado: o mesmo código duas vezes é recusado.
    expect(proximoPasso(AGORA, PASSO)).toEqual({ passo: PASSO + 1, esperarSegundos: 0 })
  })

  it('manda esperar quando o passo que sobra ainda não cabe na janela de um passo à frente', () => {
    // Dois códigos já gastos no mesmo meio minuto: o terceiro é o de dois passos à frente, que a API só aceita quando
    // o relógio entrar no passo seguinte, daqui a 18 s.
    expect(proximoPasso(AGORA, PASSO + 1)).toEqual({ passo: PASSO + 2, esperarSegundos: 18 })
  })
})

describe('o código de um passo', () => {
  const segredo = new Secret({ size: 20 }).base32

  it('é o que o aplicativo autenticador mostraria naquele passo, e não em outro', () => {
    const codigo = codigoDoPasso(segredo, PASSO)
    const aplicativo = new TOTP({ secret: Secret.fromBase32(segredo) })
    expect(aplicativo.validate({ token: codigo, timestamp: PASSO * MEIO_MINUTO, window: 0 })).toBe(0)
    expect(aplicativo.validate({ token: codigo, timestamp: (PASSO + 3) * MEIO_MINUTO, window: 1 })).toBeNull()
  })
})

describe('o resumo da vitrine', () => {
  const cheia: Acessos = {
    escola: { id: 'e1', nome: 'Colégio sintético', slug: 'vitrine-abc' },
    coordenacao: { nome: 'Coordenadora sintética', email: 'coordenador-abc@educa.invalid', senha: 'senha-da-coordenacao', segredo: 'JBSWY3DPEHPK3PXP', ultimoPasso: PASSO },
    professora: { nome: 'Professora Sintética Helena', email: 'professor-abc@educa.invalid', senha: 'senha-da-professora', turma: '2ºB', disciplina: 'Química' },
    aluno: { nome: 'Aluno Sintético Caio', matricula: '12345678', senha: 'senha-do-aluno', turma: '2ºB' },
    provedor: { dominio: DOMINIO_DO_PROVEDOR_SINTETICO },
    sala: { turma: '2ºB', codigo: 'K7M2QX', token: 'token-sintetico-da-sala' },
  }
  const vazia: Acessos = {
    escola: { id: 'e2', nome: 'Colégio sintético vazio', slug: 'vitrine-vazia-xyz' },
    coordenacao: { nome: 'Coordenadora da vazia', email: 'coordenador-xyz@educa.invalid', senha: 'senha-da-coordenacao-vazia', segredo: 'KRSXG5CTMVRXEZLU', ultimoPasso: PASSO - 9 },
    professora: { nome: 'Professora Sintética Rosa', email: 'professor-xyz@educa.invalid', senha: 'senha-da-professora-vazia', turma: '2ºA', disciplina: 'Química' },
    aluno: { nome: 'Aluno Sintético Téo', matricula: '87654321', senha: 'senha-do-aluno-vazio', turma: '2ºA' },
    provedor: { dominio: DOMINIO_DO_PROVEDOR_SINTETICO },
  }
  const vitrine: Vitrine = { ...cheia, montadaEm: '2026-10-09T16:00:00.000Z', url: 'http://127.0.0.1:28090', vazia }

  it('dá a cada papel a entrada dele: a equipe pelo e-mail, o aluno pelo endereço da escola e a matrícula', () => {
    const texto = resumo(vitrine)
    expect(texto).toContain('entrada: http://127.0.0.1:28090/entrar\n    e-mail: coordenador-abc@educa.invalid\n    senha: senha-da-coordenacao')
    expect(texto).toContain('entrada: http://127.0.0.1:28090/entrar\n    e-mail: professor-abc@educa.invalid\n    senha: senha-da-professora')
    expect(texto).toContain('entrada: http://127.0.0.1:28090/e/vitrine-abc\n    matrícula: 12345678\n    senha: senha-do-aluno')
  })

  it('traz também a escola vazia, com o endereço e os logins dela, e não os da cheia', () => {
    const texto = resumo(vitrine)
    expect(texto).toContain('entrada: http://127.0.0.1:28090/e/vitrine-vazia-xyz\n    matrícula: 87654321\n    senha: senha-do-aluno-vazio')
    expect(texto).toContain('vitrine.ts codigo --vazia')
  })

  it('o resumo diz onde está o botão da conta da escola, sem prometer o provedor, e só a escola com sala mostra a sala', () => {
    const texto = resumo(vitrine)
    const [daCheia = '', daVazia = ''] = texto.split('Escola vazia')
    expect(daCheia).toContain(`Conta da escola — Google, domínio ${DOMINIO_DO_PROVEDOR_SINTETICO}`)
    expect(daCheia).toContain('botão "Entrar com a conta Google da escola": http://127.0.0.1:28090/e/vitrine-abc')
    expect(daCheia).toContain(`(assunto ${CONTA_DO_PROVEDOR_SINTETICO}), que o \`foto\` ainda não alcança`)
    expect(daCheia).toContain('Sala da turma 2ºB (nomes livres: aqui o botão se chama "Entrar com a conta da escola")')
    expect(daCheia).toContain('endereço: http://127.0.0.1:28090/e/vitrine-abc/turma\n    código: K7M2QX')
    expect(daCheia).toContain('link: http://127.0.0.1:28090/e/vitrine-abc/turma#token-sintetico-da-sala')
    // A escola vazia também libera o provedor, mas não tem nome livre: sem sala, não há o que prometer.
    expect(daVazia).toContain(`Conta da escola — Google, domínio ${DOMINIO_DO_PROVEDOR_SINTETICO}`)
    expect(daVazia).toContain('botão "Entrar com a conta Google da escola": http://127.0.0.1:28090/e/vitrine-vazia-xyz')
    expect(daVazia).not.toContain('Sala da turma')
  })

  it('não escreve o segredo do segundo fator: manda pedir o código ao comando', () => {
    const texto = resumo(vitrine)
    expect(texto).not.toContain('JBSWY3DPEHPK3PXP')
    expect(texto).not.toContain('KRSXG5CTMVRXEZLU')
    expect(texto).toContain('vitrine.ts codigo ')
  })

  it('sem segundo fator ativado, não manda pedir um código que não existe', () => {
    const semFator = { ...vitrine, coordenacao: { ...cheia.coordenacao, segredo: null }, vazia: { ...vazia, coordenacao: { ...vazia.coordenacao, segredo: null } } }
    const texto = resumo(semFator)
    expect(texto).not.toContain('vitrine.ts codigo')
    expect(texto).toContain('a tela pede no primeiro acesso')
  })

  it('o passo gasto fica na escola em que a coordenação entrou, e a outra não muda', () => {
    expect(acessosDa(vitrine, true)).toBe(vazia)
    expect(acessosDa(vitrine, false).escola.id).toBe('e1')
    const naVazia = comPassoGasto(vitrine, true, PASSO + 4)
    expect(naVazia.vazia.coordenacao.ultimoPasso).toBe(PASSO + 4)
    expect(naVazia.coordenacao.ultimoPasso).toBe(PASSO)
    const naCheia = comPassoGasto(vitrine, false, PASSO + 4)
    expect(naCheia.coordenacao.ultimoPasso).toBe(PASSO + 4)
    expect(naCheia.vazia.coordenacao.ultimoPasso).toBe(PASSO - 9)
  })
})

describe('a conta do provedor sintético da vitrine', () => {
  it('é uma conta que o `oidc-falso` conhece, e do domínio que a vitrine libera', () => {
    const config = JSON.parse(readFileSync(join(raizRepositorio, 'infra/oidc-falso/config.json'), 'utf8')) as {
      tokenCallbacks: { issuerId: string; requestMappings: { match: string; claims: { hd?: string } }[] }[]
    }
    const conta = config.tokenCallbacks.find((emissor) => emissor.issuerId === 'google')?.requestMappings.find((mapa) => mapa.match === CONTA_DO_PROVEDOR_SINTETICO)
    expect(conta, 'a conta não está no config do oidc-falso').toBeDefined()
    expect(conta?.claims.hd).toBe(DOMINIO_DO_PROVEDOR_SINTETICO)
  })
})

describe('a vitrine guardada no arquivo', () => {
  const escola = (provedor: boolean) => ({
    escola: { id: 'e1', nome: 'Colégio sintético', slug: 'vitrine-abc' },
    coordenacao: { nome: 'Coordenadora', email: 'coordenador-abc@educa.invalid', senha: 's', segredo: null, ultimoPasso: 0 },
    professora: { nome: 'Professora', email: 'professor-abc@educa.invalid', senha: 's', turma: '2ºB', disciplina: 'Química' },
    aluno: { nome: 'Aluno', matricula: '12345678', senha: 's', turma: '2ºB' },
    ...(provedor ? { provedor: { dominio: DOMINIO_DO_PROVEDOR_SINTETICO } } : {}),
  })

  function comArquivo(vitrine: unknown, conferir: (raiz: string) => void): void {
    const raiz = mkdtempSync(join(tmpdir(), 'vitrine-'))
    try {
      gravarVitrine(vitrine as Vitrine, raiz)
      conferir(raiz)
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  }

  it('lê a vitrine que já tem o provedor nas duas escolas', () => {
    const vitrine = { ...escola(true), montadaEm: '2026-11-10T12:00:00.000Z', url: 'http://127.0.0.1:28090', vazia: escola(true) }
    comArquivo(vitrine, (raiz) => expect(lerVitrine(raiz)?.vazia.provedor.dominio).toBe(DOMINIO_DO_PROVEDOR_SINTETICO))
  })

  it('trata como não montada a vitrine de antes do provedor, que não mostraria o botão da conta: o agente monta de novo', () => {
    const antiga = { ...escola(false), montadaEm: '2026-11-09T12:00:00.000Z', url: 'http://127.0.0.1:28090', vazia: escola(false) }
    comArquivo(antiga, (raiz) => expect(lerVitrine(raiz)).toBeNull())
    const meia = { ...escola(true), montadaEm: '2026-11-10T12:00:00.000Z', url: 'http://127.0.0.1:28090', vazia: escola(false) }
    comArquivo(meia, (raiz) => expect(lerVitrine(raiz)).toBeNull())
  })

  it('sem arquivo, não há vitrine', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'vitrine-'))
    try {
      expect(lerVitrine(raiz)).toBeNull()
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  })
})
