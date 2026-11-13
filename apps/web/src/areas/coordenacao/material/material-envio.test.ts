import { ErrorCode, MAXIMO_DE_BYTES_DO_MATERIAL, motivoDaRecusaDoMaterial } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../api/client'
import { intervaloDaLista, INTERVALO_DA_LEITURA_DO_MATERIAL_MS } from './api/material'
import { errorText } from '../../../components/error-text'
import {
  aceitarNoLote,
  camposDoEnvio,
  devePartir,
  doMaisNovoAoMaisAntigo,
  errosDoRascunho,
  horaDaEspera,
  licencasQueValem,
  MAXIMO_DE_ARQUIVOS_DO_LOTE,
  motivoDaRecusa,
  OPCOES_DE_LICENCA,
  origemDoMaterial,
  problemaDoArquivo,
  RASCUNHO_VAZIO,
  resumoDoLote,
  rotuloDoBotaoDeEnvio,
  tituloDaRecusa,
  tituloDoNovoItem,
  temErro,
  tamanhoPorExtenso,
  temAssinaturaDePdf,
  TEXTO_DA_RECUSA,
  textoDoEstado,
  textoDoItem,
  textoDoLimiteDeEnvios,
  textoDoLimiteDoLote,
  TEXTOS_DA_FALHA_DO_ENVIO,
  tituloPeloArquivo,
  type ItemDoLote,
  type RascunhoDoEnvio,
} from './material-envio'

const DISCIPLINA = '0190f5a0-0000-7000-8000-000000000001'
const SERIE = '0190f5a0-0000-7000-8000-000000000002'
const LICENCA = '0190f5a0-0000-7000-8000-000000000003'
const PRONTO_PARA_ENVIAR: RascunhoDoEnvio = { titulo: '', disciplinaId: DISCIPLINA, serieIds: [SERIE], titularidade: 'escola', licencaId: '', licenca: 'autoria_da_escola', declaracao: true }
const item = (chave: number, parte: Partial<ItemDoLote> = {}): ItemDoLote => ({ chave, arquivo: new File(['%PDF-1.7'], `cap-${String(chave)}.pdf`), titulo: `Capítulo ${String(chave)}`, situacao: 'pendente', ...parte })
const UM = [item(1)]
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
  it('o formulário vazio diz o que falta em cada campo, e não exige licença registrada de material próprio', () => {
    const erros = errosDoRascunho(RASCUNHO_VAZIO, [])
    expect(erros).toEqual({
      arquivo: 'Escolha o PDF do material.',
      disciplinaId: 'Escolha a disciplina do material.',
      serieIds: 'Marque ao menos uma série: é por ela que o professor e o Tutor acham o material.',
      titularidade: 'Diga de quem é o material.',
      licenca: 'Escolha a licença de uso. Sem licença declarada, o material não entra.',
      titulos: new Map(),
    })
    expect(temErro(erros)).toBe(true)
    expect(camposDoEnvio(RASCUNHO_VAZIO, 'Título')).toBeUndefined()
  })

  it('o pronto para enviar não tem erro, e vira o pedido com as séries, sem licença registrada', () => {
    expect(temErro(errosDoRascunho(PRONTO_PARA_ENVIAR, UM))).toBe(false)
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, serieIds: [SERIE, DISCIPLINA], licencaId: 'sobrou de antes' }, '  Química 2 — Capítulo 7  ')).toEqual({
      titulo: 'Química 2 — Capítulo 7',
      disciplinaId: DISCIPLINA,
      serieIds: [SERIE, DISCIPLINA],
      titularidade: 'escola',
      licenca: 'autoria_da_escola',
      declaracao: true,
    })
  })

  it('material de terceiro exige a licença registrada, e o pedido a leva; dizer que não tem a licença é recusa, e não campo por preencher', () => {
    const deTerceiro: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, titularidade: 'terceiro_com_licenca', licenca: 'licenca_comercial_autorizada' }
    expect(errosDoRascunho(deTerceiro, UM).licencaId).toContain('Escolha a licença registrada')
    expect(camposDoEnvio(deTerceiro, 'Título')).toBeUndefined()
    expect(camposDoEnvio({ ...deTerceiro, licencaId: LICENCA }, 'Título')).toMatchObject({ titularidade: 'terceiro_com_licenca', licencaId: LICENCA })
    const semLicenca = { ...deTerceiro, licenca: 'sem_licenca' as const }
    expect(errosDoRascunho(semLicenca, UM).licencaId).toBeUndefined()
    expect(camposDoEnvio(semLicenca, 'Título')).toMatchObject({ licenca: 'sem_licenca' })
  })

  it('o envio que será recusado segue sem arquivo: a recusa fica registrada e o arquivo não sai do computador', () => {
    const semLicenca: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, licenca: 'sem_licenca' }
    const semDeclaracao: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, declaracao: false }
    expect(temErro(errosDoRascunho(semLicenca, []))).toBe(false)
    expect(temErro(errosDoRascunho(semDeclaracao, []))).toBe(false)
    expect(camposDoEnvio(semLicenca, 'Material sem arquivo')).toMatchObject({ licenca: 'sem_licenca', declaracao: true })
    expect(camposDoEnvio(semDeclaracao, 'Material sem arquivo')).toMatchObject({ licenca: 'autoria_da_escola', declaracao: false })
    // O que vai entrar, sem arquivo, não segue.
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR, []).arquivo).toBe('Escolha o PDF do material.')
  })

  it('o título é de cada arquivo, com o teto do contrato; o que já saiu não é cobrado', () => {
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR, [item(1, { titulo: 'x'.repeat(161) })]).titulos.get(1)).toBe('O título tem no máximo 160 caracteres.')
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR, [item(1, { titulo: '  ' })]).titulos.get(1)).toContain('Dê um título')
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR, [item(1, { titulo: 'x'.repeat(160) })]).titulos.size).toBe(0)
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR, [item(1, { titulo: '', situacao: 'enviado' }), item(2)]).titulos.size).toBe(0)
  })
})

describe('Material: o que falta, campo a campo, e o pedido de cada arquivo', () => {
  it('só parte o que ainda não saiu e o que falhou; o título do que falhou é cobrado de novo', () => {
    expect(devePartir({ situacao: 'pendente' })).toBe(true)
    expect(devePartir({ situacao: 'falhou' })).toBe(true)
    for (const situacao of ['enviando', 'enviado', 'ja_enviado'] as const) expect(devePartir({ situacao })).toBe(false)
    expect(errosDoRascunho(PRONTO_PARA_ENVIAR, [item(1, { titulo: '', situacao: 'falhou' })]).titulos.get(1)).toContain('Dê um título')
  })

  it('o título sem texto, sozinho, já é erro do formulário (e nenhum outro campo precisa errar)', () => {
    const erros = errosDoRascunho(PRONTO_PARA_ENVIAR, [item(1, { titulo: '' })])
    expect(Object.keys(erros)).toEqual(['titulos'])
    expect(temErro(erros)).toBe(true)
  })

  it('cada campo que falta, sozinho, impede o pedido', () => {
    expect(camposDoEnvio(PRONTO_PARA_ENVIAR, 'Título')).toBeDefined()
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, titularidade: '' }, 'Título')).toBeUndefined()
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, licenca: '' }, 'Título')).toBeUndefined()
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, disciplinaId: '' }, 'Título')).toBeUndefined()
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, serieIds: [] }, 'Título')).toBeUndefined()
    expect(camposDoEnvio(PRONTO_PARA_ENVIAR, '   ')).toBeUndefined()
  })

  it('a licença registrada só vai no pedido do material de terceiro que a escolheu; quem diz não ter licença não leva o campo', () => {
    const deTerceiro: RascunhoDoEnvio = { ...PRONTO_PARA_ENVIAR, titularidade: 'terceiro_com_licenca', licenca: 'sem_licenca' }
    expect(camposDoEnvio(deTerceiro, 'Título')).not.toHaveProperty('licencaId')
    expect(camposDoEnvio({ ...deTerceiro, licencaId: LICENCA }, 'Título')).toHaveProperty('licencaId', LICENCA)
    expect(camposDoEnvio({ ...PRONTO_PARA_ENVIAR, licencaId: LICENCA }, 'Título')).not.toHaveProperty('licencaId')
  })
})

describe('Material: o título de cada arquivo e o da recusa', () => {
  const arquivo = new File(['%PDF-1.7'], 'quimica-2_cap-7.pdf')

  it('o novo arquivo nasce com o título do nome, ou com o do "Tentar de novo" quando há', () => {
    expect(tituloDoNovoItem(arquivo, undefined)).toBe('quimica 2 cap 7')
    expect(tituloDoNovoItem(arquivo, '   ')).toBe('quimica 2 cap 7')
    expect(tituloDoNovoItem(arquivo, '')).toBe('quimica 2 cap 7')
    expect(tituloDoNovoItem(arquivo, 'Química 2')).toBe('Química 2')
  })

  it('a recusa entra com o título do arquivo; sem arquivo, ou com título em branco, com o de "sem arquivo"; com vários, com a contagem', () => {
    expect(tituloDaRecusa([])).toBe('Material sem arquivo')
    expect(tituloDaRecusa([{ titulo: '  Química 2  ' }])).toBe('Química 2')
    expect(tituloDaRecusa([{ titulo: '  ' }])).toBe('Material sem arquivo')
    expect(tituloDaRecusa([{ titulo: 'A' }, { titulo: 'B' }])).toBe('Lote de 2 arquivos')
  })
})

describe('Material: o que o botão de enviar diz', () => {
  const base = { emCurso: false, parada: undefined, itens: [item(1), item(2), item(3)], umArquivoSo: false }

  it('em curso, enviando; parado por limite ou por falha, continuar; cancelado, o envio normal', () => {
    expect(rotuloDoBotaoDeEnvio({ ...base, emCurso: true, parada: { tipo: 'limite' } })).toBe('Enviando…')
    expect(rotuloDoBotaoDeEnvio({ ...base, parada: { tipo: 'limite' } })).toBe('Continuar o envio')
    expect(rotuloDoBotaoDeEnvio({ ...base, parada: { tipo: 'indisponivel' } })).toBe('Continuar o envio')
    expect(rotuloDoBotaoDeEnvio({ ...base, parada: { tipo: 'cancelado' } })).toBe('Enviar 3 materiais')
  })

  it('só falhas, tentar de novo; o resto, o envio com a conta dos que vão, no singular quando é um só', () => {
    expect(rotuloDoBotaoDeEnvio({ ...base, itens: [item(1, { situacao: 'falhou' }), item(2, { situacao: 'falhou' })] })).toBe('Tentar de novo os que falharam')
    expect(rotuloDoBotaoDeEnvio({ ...base, itens: [item(1, { situacao: 'falhou' }), item(2)] })).toBe('Enviar 2 materiais')
    expect(rotuloDoBotaoDeEnvio({ ...base, itens: [item(1)] })).toBe('Enviar material')
    expect(rotuloDoBotaoDeEnvio({ ...base, itens: [] })).toBe('Enviar material')
    expect(rotuloDoBotaoDeEnvio({ ...base, itens: [item(1, { situacao: 'enviado' }), item(2)] })).toBe('Enviar material')
  })

  it('o envio que troca um material só diz o singular, mesmo com mais arquivos na mão', () => {
    expect(rotuloDoBotaoDeEnvio({ ...base, umArquivoSo: true })).toBe('Enviar material')
  })
})

describe('Material: o lote de até 20 PDFs (RF14)', () => {
  it('o 21º arquivo é recusado antes de enviar, e o texto diz quantos ficaram de fora', () => {
    expect(MAXIMO_DE_ARQUIVOS_DO_LOTE).toBe(20)
    expect(aceitarNoLote(0, 20)).toEqual({ aceitos: 20, excedente: 0 })
    expect(aceitarNoLote(0, 21)).toEqual({ aceitos: 20, excedente: 1 })
    expect(aceitarNoLote(18, 5)).toEqual({ aceitos: 2, excedente: 3 })
    expect(aceitarNoLote(20, 1)).toEqual({ aceitos: 0, excedente: 1 })
    expect(aceitarNoLote(0, 3, 1)).toEqual({ aceitos: 1, excedente: 2 })
    expect(textoDoLimiteDoLote(1)).toBe('Um lote tem até 20 PDFs. O último arquivo não entrou: envie o resto num segundo lote.')
    expect(textoDoLimiteDoLote(3)).toBe('Um lote tem até 20 PDFs. Os 3 últimos arquivos não entraram: envie o resto num segundo lote.')
  })

  it('o resumo conta o enviado e o já enviado, sobre o total do lote', () => {
    const itens = [item(1, { situacao: 'enviado' }), item(2, { situacao: 'ja_enviado' }), item(3, { situacao: 'falhou' }), item(4)]
    expect(resumoDoLote(itens)).toBe('2 de 4 enviados')
    expect(resumoDoLote([item(1, { situacao: 'enviado' })])).toBe('1 de 1 enviado')
  })

  it('cada situação tem o texto dela, e a falha traz o próprio', () => {
    expect(textoDoItem({ situacao: 'pendente' })).toBe('Na fila')
    expect(textoDoItem({ situacao: 'enviando' })).toBe('Enviando…')
    expect(textoDoItem({ situacao: 'enviado' })).toBe('Enviado. A leitura das páginas começa agora.')
    expect(textoDoItem({ situacao: 'ja_enviado' })).toBe('Já enviado nesta escola')
    expect(textoDoItem({ situacao: 'falhou', texto: 'O arquivo não abre.' })).toBe('O arquivo não abre.')
  })

  it('o 429 diz que os que faltam ficam, e a hora em que continuam', () => {
    const agora = new Date('2026-11-13T15:00:00Z')
    expect(horaDaEspera(90 * 60, agora)).toBe('13:30')
    expect(textoDoLimiteDeEnvios(90 * 60, agora)).toBe('Muitos envios por agora. Os que faltam ficam aqui e continuam às 13:30.')
    expect(textoDoLimiteDeEnvios(undefined, agora)).toContain('Continuar o envio')
  })

  it('só as licenças que valem hoje se escolhem: a vencida e a que ainda não começou ficam de fora', () => {
    const licencas = [{ situacao: 'vigente' }, { situacao: 'vence_em_30_dias' }, { situacao: 'vencida' }, { situacao: 'futura' }] as const
    expect(licencasQueValem(licencas).map((licenca) => licenca.situacao)).toEqual(['vigente', 'vence_em_30_dias'])
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
    expect(errorText(new ApiError(ErrorCode.CONFLITO), TEXTOS_DA_FALHA_DO_ENVIO)).toBe('Este arquivo já foi enviado nesta escola. Procure o material na lista abaixo.')
    expect(errorText(new ApiError(ErrorCode.ENTRADA_INVALIDA), TEXTOS_DA_FALHA_DO_ENVIO)).toContain('20 MB')
    expect(errorText(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), TEXTOS_DA_FALHA_DO_ENVIO)).toBe('O envio não foi concluído. Tente de novo em instantes.')
    expect(errorText(new ApiError(ErrorCode.LICENCA_VENCIDA), TEXTOS_DA_FALHA_DO_ENVIO)).toContain('Atualize a vigência em Licenças')
  })
})
