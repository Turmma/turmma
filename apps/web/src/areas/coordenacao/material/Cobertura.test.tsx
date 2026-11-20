// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { setupScreen, fakeNetwork, renderScreen, type FakeNetwork, type FakeResponse } from '../../../__fixtures__/render-screen'
import type * as Sessao from '../../../api/sessao'
import Material, { abaDoEndereco } from './Material'
import { quantasSecoesSemClassificacao, textoDasHabilidadesSemMaterial } from './cobertura'

/**
 * Escola › Material › Cobertura (classificacao-bncc, 13.0; RF19; `cenarios.md`, "Telas"): a escolha da série, os quatro estados (carregando, erro com "Tentar de novo", o vazio da escola sem material da série e com dado)
 * e, ao lado de cada componente, quantos capítulos ainda estão sem classificação. A rede é falsa e responde por caminho. O que só o navegador mede (a página que não rola, o celular, a pessoa seguinte com o banco de
 * verdade, a resposta atrasada de uma série) é do e2e `material-cobertura`.
 */
setupScreen()

const ouvintesDeTroca = vi.hoisted(() => new Set<() => void>())
vi.mock('../../../api/sessao', async (importar) => {
  const real = await importar<typeof Sessao>()
  return {
    ...real,
    aoTrocarDeSessao: (ouvinte: () => void) => {
      ouvintesDeTroca.add(ouvinte)
      const cancelar = real.aoTrocarDeSessao(ouvinte)
      return () => {
        ouvintesDeTroca.delete(ouvinte)
        cancelar()
      }
    },
  }
})

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const SERIE_7 = { id: id(7), etapa: 'ef_anos_finais', ano: 7 }
const SERIE_6 = { id: id(6), etapa: 'ef_anos_finais', ano: 6 }
const SERIE_EM = { id: id(21), etapa: 'em', ano: 1 }

const ok = (corpo: unknown): FakeResponse => ({ status: 200, corpo })
const FALHA: FakeResponse = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } } }
const nuncaResponde = () => new Promise<FakeResponse>(() => undefined)

const habilidade = (codigo: string, descricao: string) => ({ codigo, descricao })
const COBERTURA_DO_7 = {
  serieId: SERIE_7.id,
  etapa: 'ef_anos_finais',
  materiaisEmUso: 2,
  classificacaoSuspensa: false,
  grupos: [
    { chave: 'ciencias', total: 16, semMaterial: [habilidade('EF07CI02', 'Diferenciar temperatura, calor e sensação térmica.'), habilidade('EF07CI03', 'Utilizar o conhecimento das formas de propagação do calor.')], secoesSemClassificacao: 3 },
    { chave: 'lingua_portuguesa', total: 108, semMaterial: [], secoesSemClassificacao: 0 },
  ],
}
const COBERTURA_DO_EM = {
  serieId: SERIE_EM.id,
  etapa: 'em',
  materiaisEmUso: 1,
  classificacaoSuspensa: false,
  grupos: [{ chave: 'ciencias_da_natureza', total: 26, semMaterial: [habilidade('EM13CNT101', 'Analisar e representar as transformações e conservações em sistemas.')], secoesSemClassificacao: 1 }],
}

type Resposta = FakeResponse | (() => FakeResponse | Promise<FakeResponse>)

/** As séries e a cobertura de cada uma respondem por caminho; a cobertura por `serieId`. */
function instalar(rede: FakeNetwork, respostas: { series?: Resposta; coberturas?: Record<string, Resposta> } = {}): void {
  const { series = ok({ itens: [SERIE_7, SERIE_EM, SERIE_6] }), coberturas = { [SERIE_7.id]: ok(COBERTURA_DO_7), [SERIE_EM.id]: ok(COBERTURA_DO_EM) } } = respostas
  const dar = (resposta: Resposta | undefined) => (resposta === undefined ? FALHA : typeof resposta === 'function' ? resposta() : resposta)
  rede.responderPor(/\/v1\/series/, () => dar(series))
  rede.responderPor(/\/v1\/materiais\/cobertura/, () => {
    const serieId = new URL(rede.chamadas.at(-1)?.caminho ?? '', 'http://teste').searchParams.get('serieId') ?? ''
    return dar(coberturas[serieId])
  })
}

const pedidosDeCobertura = (rede: FakeNetwork) => rede.chamadas.filter((chamada) => chamada.caminho.includes('/v1/materiais/cobertura')).map((chamada) => chamada.caminho)

function montar(endereco = '/material?aba=cobertura') {
  const [caminho = '/material', busca = ''] = endereco.split('?')
  const localizacao = memoryLocation({ path: caminho, searchPath: busca, record: true })
  renderScreen(
    <Router hook={localizacao.hook} searchHook={localizacao.searchHook}>
      <Material />
    </Router>,
  )
  return localizacao
}

async function escolherASerie(usuario: ReturnType<typeof userEvent.setup>, nome: string): Promise<void> {
  const seletor = await screen.findByRole('combobox', { name: /Série/ })
  await waitFor(() => expect(within(seletor).queryByRole('option', { name: nome })).not.toBeNull())
  await usuario.selectOptions(seletor, nome)
}

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(min-width: 768px)', addEventListener: () => undefined, removeEventListener: () => undefined }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

describe('a aba é o endereço', () => {
  it('`?aba=cobertura` abre a Cobertura; qualquer outro valor abre Materiais, como antes', () => {
    expect(abaDoEndereco('aba=cobertura')).toBe('cobertura')
    expect(abaDoEndereco('aba=licencas')).toBe('licencas')
    expect(abaDoEndereco('aba=outra')).toBe('materiais')
    expect(abaDoEndereco('')).toBe('materiais')
  })

  it('a aba "Cobertura" existe ao lado de Materiais e Licenças, e trocar de aba troca só o parâmetro', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    const localizacao = montar('/material')
    await usuario.click(await screen.findByRole('tab', { name: 'Cobertura' }))
    expect(localizacao.history?.at(-1)).toContain('aba=cobertura')
    expect(await screen.findByRole('heading', { name: 'Cobertura da BNCC por série' })).toBeTruthy()

    await usuario.click(screen.getByRole('tab', { name: 'Licenças' }))
    expect(localizacao.history?.at(-1)).toContain('aba=licencas')
    expect(await screen.findByRole('region', { name: 'Licenças de material' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Cobertura da BNCC por série' })).toBeNull()

    await usuario.click(screen.getByRole('tab', { name: 'Materiais' }))
    expect(localizacao.history?.at(-1)).not.toContain('aba=')
    expect(screen.queryByRole('region', { name: 'Licenças de material' })).toBeNull()
  })
})

describe('a escolha da série', () => {
  it('lista as séries da escola, o Fundamental antes do Médio e o ano em ordem, e não escolhe nenhuma sozinha', async () => {
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    const seletor = await screen.findByRole('combobox', { name: /Série/ })
    await waitFor(() => expect(within(seletor).getAllByRole('option').length).toBeGreaterThan(1))

    expect(within(seletor).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Escolha a série', '6º ano do Ensino Fundamental', '7º ano do Ensino Fundamental', '1º ano do Ensino Médio'])
    expect((seletor as HTMLSelectElement).value).toBe('')
    expect(screen.getByText('Escolha uma série para ver as habilidades que ainda não têm material.')).toBeTruthy()
    expect(pedidosDeCobertura(rede)).toEqual([])
  })

  it('escolher a série lê a cobertura dela, e trocar de série lê a da nova, sem mostrar a da anterior', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    instalar(rede)
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')
    expect(await screen.findByRole('region', { name: 'Componente: Ciências' })).toBeTruthy()

    await escolherASerie(usuario, '1º ano do Ensino Médio')

    expect(await screen.findByRole('region', { name: 'Área: Ciências da Natureza' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Componente: Ciências' })).toBeNull()
    expect(pedidosDeCobertura(rede).map((caminho) => caminho.split('serieId=')[1])).toEqual([SERIE_7.id, SERIE_EM.id])
  })

  it('as séries carregando: a leitura no ar, sem seletor e sem dizer que a escola não tem série', async () => {
    instalar(fakeNetwork(), { series: nuncaResponde })
    montar()
    expect(await screen.findByText('Carregando as séries…')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText('Nenhuma série ainda')).toBeNull()
  })

  it('as séries com erro: a mensagem curta e "Tentar de novo", que lê as séries de novo, sem afirmar que a escola não tem série', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { series: () => (falhar ? FALHA : ok({ itens: [SERIE_7, SERIE_EM, SERIE_6] })) })
    montar()
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhuma série ainda')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()

    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('combobox', { name: /Série/ })).toBeTruthy()
  })

  it('a escola sem série diz que falta cadastrá-la, sem seletor', async () => {
    instalar(fakeNetwork(), { series: ok({ itens: [] }) })
    montar()
    expect(await screen.findByText('Nenhuma série ainda')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('a pessoa seguinte do mesmo computador começa sem série escolhida', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')
    await screen.findByRole('region', { name: 'Componente: Ciências' })

    act(() => ouvintesDeTroca.forEach((ouvinte) => ouvinte()))

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Componente: Ciências' })).toBeNull())
    expect((screen.getByRole('combobox', { name: /Série/ }) as HTMLSelectElement).value).toBe('')
    expect(screen.getByText('Escolha uma série para ver as habilidades que ainda não têm material.')).toBeTruthy()
  })
})

describe('os quatro estados da tela', () => {
  it('carregando: a cobertura no ar, sem grupo e sem dizer que não há material', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { coberturas: { [SERIE_7.id]: nuncaResponde } })
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')

    expect(await screen.findByText('Carregando a cobertura…')).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Componente/ })).toBeNull()
    expect(screen.queryByText('Nenhum material desta série ainda')).toBeNull()
  })

  it('erro: a mensagem curta e "Tentar de novo", que lê a cobertura de novo; a falha não afirma que não há material', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    let falhar = true
    instalar(rede, { coberturas: { [SERIE_7.id]: () => (falhar ? FALHA : ok(COBERTURA_DO_7)) } })
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhum material desta série ainda')).toBeNull()
    expect(screen.queryByRole('region', { name: /Componente/ })).toBeNull()

    falhar = false
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await screen.findByRole('region', { name: 'Componente: Ciências' })
    expect(pedidosDeCobertura(rede)).toHaveLength(2)
  })

  it('vazio: a série sem material convida a enviar, e não lista habilidade', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { coberturas: { [SERIE_7.id]: ok({ ...COBERTURA_DO_7, materiaisEmUso: 0 }) } })
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')

    expect(await screen.findByText('Nenhum material desta série ainda')).toBeTruthy()
    expect(screen.getByText(/Envie material desta série para ver a cobertura/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Componente/ })).toBeNull()
  })

  it('com dado: por componente, as habilidades sem material com código e descrição, e os capítulos sem classificação ao lado', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork())
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')

    const ciencias = within(await screen.findByRole('region', { name: 'Componente: Ciências' }))
    expect(screen.getByText(/por componente \(por área, no Ensino Médio\)\. Os capítulos são classificados pela IA, e a coordenação corrige a classificação em Material\./)).toBeTruthy()
    expect(ciencias.getByText('2 de 16 habilidades sem material')).toBeTruthy()
    expect(ciencias.getByText('3 capítulos ainda sem classificação')).toBeTruthy()
    expect(ciencias.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['EF07CI02Diferenciar temperatura, calor e sensação térmica.', 'EF07CI03Utilizar o conhecimento das formas de propagação do calor.'])
    const portugues = within(screen.getByRole('region', { name: 'Componente: Língua Portuguesa' }))
    expect(portugues.getByText('Todas as 108 habilidades têm material')).toBeTruthy()
    expect(portugues.queryByRole('listitem')).toBeNull()
    expect(portugues.queryByRole('list')).toBeNull()
    expect(portugues.queryByText(/sem classificação/)).toBeNull()
    // O grupo sem pendência e sem habilidade em falta tem uma linha só (a do total); o outro, a do total e a dos capítulos.
    expect(screen.getByRole('region', { name: 'Componente: Língua Portuguesa' }).querySelectorAll('p')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Componente: Ciências' }).querySelectorAll('p')).toHaveLength(2)
    expect(screen.queryByText(/suspensa/)).toBeNull()
    expect(screen.getByText(/Enquanto houver capítulos sem classificação/)).toBeTruthy()
    // A tela só lê: nenhum botão de classificar, corrigir ou reclassificar.
    expect(screen.queryByRole('button', { name: /Corrigir|Reclassificar|Classificar/ })).toBeNull()
  })

  it('sem capítulo pendente em nenhum grupo, o aviso de que a lista pode estar incompleta não aparece', async () => {
    const usuario = userEvent.setup()
    const semPendencia = { ...COBERTURA_DO_7, grupos: COBERTURA_DO_7.grupos.map((grupo) => ({ ...grupo, secoesSemClassificacao: 0 })) }
    instalar(fakeNetwork(), { coberturas: { [SERIE_7.id]: ok(semPendencia) } })
    montar()
    await escolherASerie(usuario, '7º ano do Ensino Fundamental')

    await screen.findByRole('region', { name: 'Componente: Ciências' })
    expect(screen.queryByText(/Enquanto houver capítulos sem classificação/)).toBeNull()
    expect(screen.queryByText(/ainda sem classificação/)).toBeNull()
  })

  it('no Médio o grupo é a área, e a função suspensa avisa que valem só as habilidades corrigidas', async () => {
    const usuario = userEvent.setup()
    instalar(fakeNetwork(), { coberturas: { [SERIE_EM.id]: ok({ ...COBERTURA_DO_EM, classificacaoSuspensa: true }) } })
    montar()
    await escolherASerie(usuario, '1º ano do Ensino Médio')

    const area = within(await screen.findByRole('region', { name: 'Área: Ciências da Natureza' }))
    expect(area.getByText('1 capítulo ainda sem classificação')).toBeTruthy()
    expect(screen.getByText('A classificação pela IA está suspensa na escola. Valem só as habilidades corrigidas pela coordenação.')).toBeTruthy()
  })
})

describe('os textos', () => {
  it('as habilidades sem material, no singular e no plural, e os capítulos sem classificação', () => {
    expect(textoDasHabilidadesSemMaterial(0, 12)).toBe('Todas as 12 habilidades têm material')
    expect(textoDasHabilidadesSemMaterial(0, 1)).toBe('A habilidade da série tem material')
    expect(textoDasHabilidadesSemMaterial(1, 1)).toBe('1 de 1 habilidade sem material')
    expect(textoDasHabilidadesSemMaterial(3, 12)).toBe('3 de 12 habilidades sem material')
    expect(quantasSecoesSemClassificacao(0)).toBeNull()
    expect(quantasSecoesSemClassificacao(1)).toBe('1 capítulo ainda sem classificação')
    expect(quantasSecoesSemClassificacao(2)).toBe('2 capítulos ainda sem classificação')
  })
})
