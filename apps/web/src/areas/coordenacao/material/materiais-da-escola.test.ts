import type { Material } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { linhasDosMateriais, materialDoEndereco, nomeDaLicenca, rascunhoDoMaterialQueFalhou, textoDaSituacaoDaRecusa, textoDaSituacaoDoMaterial, type RecusaDeEnvio } from './materiais-da-escola'

/**
 * As regras da aba Material que não dependem do React (telas da coordenação, 8.0; RF15): a ordem da tabela, o texto da situação, o
 * material que o endereço abre e o que o "Tentar de novo" devolve ao formulário.
 */

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const material = (n: number, parte: Partial<Material> = {}): Material => ({
  id: id(n),
  titulo: `Material ${String(n)}`,
  disciplinaId: id(900),
  titularidade: 'escola',
  licenciante: null,
  licencaId: null,
  edicao: null,
  substitui: null,
  serieIds: [id(800)],
  licenca: 'autoria_da_escola',
  estado: 'pronto',
  falha: null,
  paginas: 6,
  trechos: 6,
  enviadoEm: '2026-10-04T12:00:00.000Z',
  ...parte,
})
const recusa = (chave: number): RecusaDeEnvio => ({ chave, titulo: `Recusa ${String(chave)}`, disciplinaId: id(900), licenca: 'sem_licenca', motivo: 'sem_licenca' })

const nomesDe = (linhas: ReturnType<typeof linhasDosMateriais>) => linhas.map((linha) => (linha.tipo === 'material' ? linha.material.titulo : linha.recusa.titulo))

describe('a ordem da tabela: o que falhou primeiro, depois o mais novo', () => {
  it('a API lista na ordem de envio: o que não carregou sobe, e o resto vem do mais novo ao mais antigo', () => {
    const itens = [material(1), material(2, { estado: 'falhou', falha: 'sem_texto', paginas: null }), material(3, { estado: 'processando', paginas: null }), material(4)]
    expect(nomesDe(linhasDosMateriais(itens, []))).toEqual(['Material 2', 'Material 4', 'Material 3', 'Material 1'])
  })

  it('entre dois que não carregaram, o mais novo vem antes', () => {
    const itens = [material(1, { estado: 'falhou', falha: 'sem_texto' }), material(2), material(3, { estado: 'falhou', falha: 'extracao_falhou' })]
    expect(nomesDe(linhasDosMateriais(itens, []))).toEqual(['Material 3', 'Material 1', 'Material 2'])
  })

  it('o envio recusado é falha e vem na frente de tudo, o mais novo primeiro', () => {
    const itens = [material(1, { estado: 'falhou', falha: 'sem_texto' }), material(2)]
    expect(nomesDe(linhasDosMateriais(itens, [recusa(2), recusa(1)]))).toEqual(['Recusa 2', 'Recusa 1', 'Material 1', 'Material 2'])
  })

  it('sem material e com uma recusa, a tabela tem só a recusa', () => {
    expect(linhasDosMateriais([], [recusa(1)])).toEqual([{ tipo: 'recusa', recusa: recusa(1) }])
  })
})

describe('o que a situação diz', () => {
  it('o material que falhou diz "Não carregou"; o que lê, "Processando"; o pronto, com as páginas', () => {
    expect(textoDaSituacaoDoMaterial({ estado: 'falhou', paginas: null })).toBe('Não carregou')
    expect(textoDaSituacaoDoMaterial({ estado: 'processando', paginas: null })).toBe('Processando')
    expect(textoDaSituacaoDoMaterial({ estado: 'pronto', paginas: 12 })).toBe('Pronto · 12 páginas')
    expect(textoDaSituacaoDoMaterial({ estado: 'pronto', paginas: 1 })).toBe('Pronto · 1 página')
  })

  it('o envio recusado diz o motivo, curto', () => {
    expect(textoDaSituacaoDaRecusa({ motivo: 'sem_licenca' })).toBe('Envio recusado · sem licença')
    expect(textoDaSituacaoDaRecusa({ motivo: 'sem_declaracao' })).toBe('Envio recusado · sem declaração')
  })
})

describe('o material que o endereço abre', () => {
  const itens = [material(1), material(2)]

  it('acha o material pelo id, só na lista que a escola tem', () => {
    expect(materialDoEndereco(`?material=${id(2)}`, itens)?.titulo).toBe('Material 2')
    expect(materialDoEndereco(`material=${id(1)}&outro=1`, itens)?.titulo).toBe('Material 1')
  })

  it('o id de outra escola, o valor sem sentido e a falta do parâmetro não abrem nada', () => {
    expect(materialDoEndereco(`?material=${id(77)}`, itens)).toBeUndefined()
    expect(materialDoEndereco('?material=', itens)).toBeUndefined()
    expect(materialDoEndereco('?professor=' + id(1), itens)).toBeUndefined()
    expect(materialDoEndereco('', itens)).toBeUndefined()
  })
})

describe('o que o "Tentar de novo" devolve ao formulário', () => {
  it('o que o material declarava, com as séries e a licença registrada, sem o arquivo e sem a declaração marcada', () => {
    const falhou = material(5, { estado: 'falhou', falha: 'sem_texto', titularidade: 'terceiro_com_licenca', licenciante: 'Editora Sintética', licencaId: id(33), serieIds: [id(801), id(802)], licenca: 'licenca_comercial_autorizada' })
    expect(rascunhoDoMaterialQueFalhou(falhou)).toEqual({
      titulo: 'Material 5',
      disciplinaId: id(900),
      serieIds: [id(801), id(802)],
      titularidade: 'terceiro_com_licenca',
      licencaId: id(33),
      licenca: 'licenca_comercial_autorizada',
      declaracao: false,
    })
  })

  it('sem licença registrada, o campo volta vazio', () => {
    expect(rascunhoDoMaterialQueFalhou(material(6)).licencaId).toBe('')
  })
})

describe('o nome da licença na coluna', () => {
  it('é o mesmo para o material e para o envio recusado: a licença declarada, e a que recusa também', () => {
    expect(nomeDaLicenca('autoria_da_escola')).toBe('Autoria da escola ou de professor dela')
    expect(nomeDaLicenca('licenca_comercial_autorizada')).toBe('Licença comercial que autoriza este uso')
    expect(nomeDaLicenca('sem_licenca')).toBe('Não tenho a licença, ou não sei')
  })
})
