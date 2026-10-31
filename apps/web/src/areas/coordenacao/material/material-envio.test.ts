import { ErrorCode, MAXIMO_DE_BYTES_DO_MATERIAL, motivoDaRecusaDoMaterial } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ErroDaApi } from '../../../api/client'
import { intervaloDaLista, INTERVALO_DA_LEITURA_DO_MATERIAL_MS } from './api/material'
import { textoDaFalha } from '../../../components/error-text'
import {
  camposDoEnvio,
  doMaisNovoAoMaisAntigo,
  errosDoRascunho,
  motivoDaRecusa,
  OPCOES_DE_LICENCA,
  origemDoMaterial,
  problemaDoArquivo,
  RASCUNHO_VAZIO,
  tamanhoPorExtenso,
  temAssinaturaDePdf,
  TEXTO_DA_RECUSA,
  textoDoEstado,
  TEXTOS_DA_FALHA_DO_ENVIO,
  tituloPeloArquivo,
  type RascunhoDoEnvio,
} from './material-envio'

const DISCIPLINA = '0190f5a0-0000-7000-8000-000000000001'
const PRONTO_PARA_ENVIAR: RascunhoDoEnvio = { titulo: 'Química 2 — Capítulo 7', disciplinaId: DISCIPLINA, titularidade: 'escola', licenciante: '', licenca: 'autoria_da_escola', declaracao: true, temArquivo: true }
const pdf = (resto = ''): Uint8Array => new TextEncoder().encode(`%PDF-1.7\n${resto}`)

describe('Material: a recusa por licença é a regra de `packages/shared`, a mesma da API', () => {
  it('sem licença escolhida ainda não há o que recusar; com `sem_licenca`, ou sem a declaração, o envio será recusado', () => {
    expect(motivoDaRecusa({ licenca: '', declaracao: false })).toBeNull()
    expect(motivoDaRecusa({ licenca: 'sem_licenca', declaracao: true })).toBe('sem_licenca')
    expect(motivoDaRecusa({ licenca: 'licenca_aberta', declaracao: false })).toBe('sem_declaracao')
    expect(motivoDaRecusa({ licenca: 'licenca_aberta', declaracao: true })).toBeNull()
    // A tela não tem regra própria: para toda licença do formulário, diz o mesmo que a função da API.
    for (const { valor } of OPCOES_DE_LICENCA) {
      for (const declaracao of [true, false]) expect(motivoDaRecusa({ licenca: valor, declaracao })).toBe(motivoDaRecusaDoMaterial({ licenca: valor, declaracao }))
    }
  })

  it('a última opção de licença é a de quem não tem licença, e toda recusa diz o que fazer', () => {
    expect(OPCOES_DE_LICENCA.at(-1)).toEqual({ valor: 'sem_licenca', rotulo: 'Não tenho a licença, ou não sei' })
    expect(OPCOES_DE_LICENCA).toHaveLength(5)
    expect(TEXTO_DA_RECUSA.sem_licenca).toContain('O arquivo não foi enviado nem lido')
    expect(TEXTO_DA_RECUSA.sem_declaracao).toContain('Marque a declaração')
  })
})

describe('Material: o que falta no formulário', () => {
  it('o formulário vazio diz o que falta em cada campo, e não exige licenciante de material próprio', () => {
    expect(errosDoRascunho(RASCUNHO_VAZIO)).toEqual({
      arquivo: 'Escolha o PDF do material.',
      titulo: 'Dê um título ao material, como ele aparece no livro ou na apostila.',
      disciplinaId: 'Escolha a disciplina do material.',
      titularidade: 'Diga de quem é o material.',
      licenca: 'Escolha a licença de uso. Sem licença declarada, o material não entra.',
    })
    expect(camposDoEnvio(RASCUNHO_VAZIO)).toBeUndefined()
  })

  it('o pronto para enviar não tem erro, e vira o pedido sem o licenciante', () => {
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR)).toEqual({})
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, titulo: '  Química 2 — Capítulo 7  ', licenciante: 'sobrou de antes' })).toEqual({
      titulo: 'Química 2 — Capítulo 7',
      disciplinaId: DISCIPLINA,
      titularidade: 'escola',
      licenca: 'autoria_da_escola',
      declaracao: true,
    })
  })

  it('material de terceiro exige quem deu a licença, e o pedido o leva', () => {
    const deTerceiro: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada' }
    expect(errosDoRascunho(deTerceiro)).toEqual({ licenciante: 'Diga quem é o dono do conteúdo que deu a licença.' })
    expect(errosDoRascunho({ ...deTerceiro, licenciante: 'x'.repeat(121) })).toEqual({ licenciante: 'O nome tem no máximo 120 caracteres.' })
    expect(camposDoEnvio({ ...deTerceiro, licenciante: ' Editora sintética ' })).toMatchObject({ titularidade: 'terceiro_com_licenca', licenciante: 'Editora sintética' })
  })

  it('o envio que será recusado segue sem arquivo: a recusa fica registrada e o arquivo não sai do computador', () => {
    const semLicenca: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, licenca: 'sem_licenca', temArquivo: false }
    const semDeclaracao: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, declaracao: false, temArquivo: false }
    expect(errosDoRascunho(semLicenca)).toEqual({})
    expect(errosDoRascunho(semDeclaracao)).toEqual({})
    expect(camposDoEnvio(semLicenca)).toMatchObject({ licenca: 'sem_licenca', declaracao: true })
    expect(camposDoEnvio(semDeclaracao)).toMatchObject({ licenca: 'autoria_da_escola', declaracao: false })
    // O que vai entrar, sem arquivo, não segue.
    expect(errosDoRascunho({ ...PRONTO_PARA_ENVIAR, temArquivo: false })).toEqual({ arquivo: 'Escolha o PDF do material.' })
  })

  it('o título tem o teto do contrato', () => {
    expect(errosDoRascunho({ ...PRONTO_PARA_ENVIAR, titulo: 'x'.repeat(161) })).toEqual({ titulo: 'O título tem no máximo 160 caracteres.' })
    expect(errosDoRascunho({ ...PRONTO_PARA_ENVIAR, titulo: 'x'.repeat(160) })).toEqual({})
  })
})

describe('Material: o arquivo', () => {
  it('é PDF o que tem a assinatura no conteúdo, e não o que tem nome de PDF', () => {
    expect(temAssinaturaDePdf(pdf())).toBe(true)
    expect(temAssinaturaDePdf(new TextEncoder().encode('   \n%PDF-1.4'))).toBe(true)
    expect(temAssinaturaDePdf(new TextEncoder().encode('nome;turma\n'))).toBe(false)
    expect(temAssinaturaDePdf(new TextEncoder().encode('%PDF'))).toBe(false)
    expect(temAssinaturaDePdf(new Uint8Array())).toBe(false)
  })

  it('o arquivo grande demais, o vazio e o que não é PDF dizem o que fazer; o PDF dentro do limite passa', () => {
    expect(problemaDoArquivo(MAXIMO_DE_BYTES_DO_MATERIAL + 1, pdf())).toBe('O arquivo passa de 20 MB. Divida o material em capítulos e envie um por vez.')
    expect(problemaDoArquivo(MAXIMO_DE_BYTES_DO_MATERIAL, pdf())).toBeUndefined()
    expect(problemaDoArquivo(0, new Uint8Array())).toBe('O arquivo não é um PDF que conseguimos abrir. Confira o arquivo e envie de novo.')
    expect(problemaDoArquivo(30, new TextEncoder().encode('nome;turma\n'))).toBe('O arquivo não é um PDF que conseguimos abrir. Confira o arquivo e envie de novo.')
  })

  it('o título sugerido sai do nome do arquivo, sem a extensão e no tamanho do contrato', () => {
    expect(tituloPeloArquivo('quimica-2_cap-7.PDF')).toBe('quimica 2 cap 7')
    expect(tituloPeloArquivo(`${'x'.repeat(200)}.pdf`)).toHaveLength(160)
  })

  it('o tamanho por extenso', () => {
    expect(tamanhoPorExtenso(300)).toBe('1 KB')
    expect(tamanhoPorExtenso(48_000)).toBe('47 KB')
    expect(tamanhoPorExtenso(3_600_000)).toBe('3,4 MB')
  })
})

describe('Material: a lista', () => {
  it('o estado em texto: pronto leva o número de páginas', () => {
    expect(textoDoEstado({ estado: 'processando', paginas: null })).toBe('Processando')
    expect(textoDoEstado({ estado: 'falhou', paginas: null })).toBe('Falhou')
    expect(textoDoEstado({ estado: 'pronto', paginas: 6 })).toBe('Pronto · 6 páginas')
    expect(textoDoEstado({ estado: 'pronto', paginas: 1 })).toBe('Pronto · 1 página')
  })

  it('a origem diz de quem é, quem licenciou e a licença', () => {
    expect(origemDoMaterial({ titularidade: 'escola', licenciante: null, licenca: 'autoria_da_escola' })).toBe('Material próprio da escola · Autoria da escola ou de professor dela')
    expect(origemDoMaterial({ titularidade: 'terceiro_com_licenca', licenciante: 'Editora sintética', licenca: 'licenca_comercial_autorizada' })).toBe(
      'Material de terceiro, com licença (Editora sintética) · Licença comercial que autoriza este uso',
    )
  })

  it('o mais novo vem primeiro, sem mexer na lista que veio da API', () => {
    const daApi = ['primeiro', 'segundo', 'terceiro']
    expect(doMaisNovoAoMaisAntigo(daApi)).toEqual(['terceiro', 'segundo', 'primeiro'])
    expect(daApi).toEqual(['primeiro', 'segundo', 'terceiro'])
  })

  it('a lista se relê sozinha só enquanto há material sendo lido', () => {
    expect(intervaloDaLista(undefined)).toBe(false)
    expect(intervaloDaLista({ itens: [], completa: true })).toBe(false)
    expect(intervaloDaLista({ itens: [{ estado: 'pronto' }, { estado: 'falhou' }], completa: true })).toBe(false)
    expect(intervaloDaLista({ itens: [{ estado: 'pronto' }, { estado: 'processando' }], completa: true })).toBe(INTERVALO_DA_LEITURA_DO_MATERIAL_MS)
  })

  it('a falha do envio diz o que fazer, pelo código; o que a tela não conhece cai no catálogo', () => {
    expect(textoDaFalha(new ErroDaApi(ErrorCode.CONFLITO), TEXTOS_DA_FALHA_DO_ENVIO)).toBe('Este arquivo já foi enviado nesta escola. Procure o material na lista abaixo.')
    expect(textoDaFalha(new ErroDaApi(ErrorCode.ENTRADA_INVALIDA), TEXTOS_DA_FALHA_DO_ENVIO)).toContain('20 MB')
    expect(textoDaFalha(new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), TEXTOS_DA_FALHA_DO_ENVIO)).not.toBe('')
  })
})
