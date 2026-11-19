// @vitest-environment jsdom
import type { HabilidadeCandidataBncc } from '@educa/shared'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  filterHabilidades,
  linhasDoSeletor,
  MAXIMO_DE_LINHAS_DO_SELETOR,
  SeletorDeHabilidades,
  TEXTO_CARREGANDO_DO_SELETOR,
  TEXTO_ERRO_DO_SELETOR,
  TEXTO_SEM_COMPONENTE_DO_SELETOR,
  TEXTO_SEM_RESULTADO_DO_SELETOR,
} from './SeletorDeHabilidades'

/**
 * O seletor de habilidades (classificacao-bncc, 8.0; `cenarios.md`, "Telas"): de 0 a `maximo` escolhidas, com o sexto bloqueado; o filtro por código e por texto, sem acento nem caixa; os estados de quem lê as candidatas
 * (carregando, erro com "Tentar de novo", sem componente) e o sem resultado; o foco e o Esc. A peça não busca nada: o que ela mostra vem das props.
 */
afterEach(cleanup)

const CANDIDATAS: HabilidadeCandidataBncc[] = [
  { codigo: 'EF06CI01', descricao: 'Classificar como comuns ou diferentes os materiais, a partir de suas propriedades.' },
  { codigo: 'EF06CI02', descricao: 'Identificar evidências de transformações químicas: água, cor e gás.' },
  { codigo: 'EF06CI03', descricao: 'Selecionar métodos de separação de misturas.' },
  { codigo: 'EF06CI04', descricao: 'Associar a produção de medicamentos a nutrientes.' },
  { codigo: 'EF06CI05', descricao: 'Explicar a organização básica das células.' },
  { codigo: 'EF06CI06', descricao: 'Concluir que os sistemas do corpo humano trabalham juntos.' },
  { codigo: 'EF06CI07', descricao: 'Justificar o papel do sistema nervoso.' },
]
const rotuloDoFiltro = /Filtrar por código ou texto/
const caixa = (codigo: string) => screen.getByRole('checkbox', { name: new RegExp(`^${codigo}`) }) as HTMLInputElement

/** A peça com o estado que quem a usa guarda: o que está escolhido. */
function Peca({ inicial = [], maximo = 5, ...resto }: Partial<React.ComponentProps<typeof SeletorDeHabilidades>> & { inicial?: string[] }) {
  const [escolhidos, definir] = useState<string[]>(inicial)
  return (
    <SeletorDeHabilidades
      rotulo="Habilidades do capítulo 3"
      itens={CANDIDATAS}
      carregando={false}
      erro={false}
      aoTentarDeNovo={() => undefined}
      selecionados={escolhidos}
      maximo={maximo}
      aoMudar={definir}
      {...resto}
    />
  )
}

describe('o filtro', () => {
  it('acha pelo código, sem caixa e sem o prefixo inteiro', () => {
    expect(filterHabilidades(CANDIDATAS, 'ef06ci03').map((item) => item.codigo)).toEqual(['EF06CI03'])
    expect(filterHabilidades(CANDIDATAS, '06CI0').map((item) => item.codigo)).toHaveLength(7)
  })

  it('acha pelo texto, sem acento e com todas as palavras, em qualquer ordem', () => {
    expect(filterHabilidades(CANDIDATAS, 'agua').map((item) => item.codigo)).toEqual(['EF06CI02'])
    expect(filterHabilidades(CANDIDATAS, 'misturas separação').map((item) => item.codigo)).toEqual(['EF06CI03'])
    expect(filterHabilidades(CANDIDATAS, 'agua separação')).toEqual([])
    expect(filterHabilidades(CANDIDATAS, '   ').map((item) => item.codigo)).toHaveLength(7)
  })

  it('na tela: digitar por código e por texto reduz a lista, e o que não acha diz "Nenhuma habilidade com esse código ou texto."', async () => {
    const usuario = userEvent.setup()
    render(<Peca />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    await usuario.type(screen.getByRole('searchbox', { name: rotuloDoFiltro }), 'ci05')
    expect(screen.getAllByRole('checkbox').map((marca) => marca.closest('label')?.textContent?.slice(0, 8))).toEqual(['EF06CI05'])
    await usuario.clear(screen.getByRole('searchbox', { name: rotuloDoFiltro }))
    await usuario.type(screen.getByRole('searchbox', { name: rotuloDoFiltro }), 'célula')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(caixa('EF06CI05')).toBeTruthy()
    await usuario.clear(screen.getByRole('searchbox', { name: rotuloDoFiltro }))
    await usuario.type(screen.getByRole('searchbox', { name: rotuloDoFiltro }), 'xyz inexistente')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText(TEXTO_SEM_RESULTADO_DO_SELETOR)).toBeTruthy()
    expect(TEXTO_SEM_RESULTADO_DO_SELETOR).toBe('Nenhuma habilidade com esse código ou texto.')
  })
})

describe('a lista e o teto', () => {
  it('cada linha traz o código junto da descrição, e o contador diz quantas há escolhidas', () => {
    render(<Peca inicial={['EF06CI02']} />)
    const linha = caixa('EF06CI02').closest('label')
    expect(linha?.textContent).toBe('EF06CI02 Identificar evidências de transformações químicas: água, cor e gás.')
    expect(screen.getByRole('status').textContent).toBe('1 de 5 escolhidas')
    // Até 50 linhas, nada a dizer sobre corte.
    expect(screen.queryByText(/Mostrando/)).toBeNull()
  })

  it('de 0 a 5: com cinco escolhidas, a sexta caixa fica bloqueada e o contador diz como seguir; tirar uma a libera', async () => {
    const usuario = userEvent.setup()
    render(<Peca />)
    for (const codigo of ['EF06CI01', 'EF06CI02', 'EF06CI03', 'EF06CI04']) await usuario.click(caixa(codigo))
    expect(caixa('EF06CI05').disabled).toBe(false)
    await usuario.click(caixa('EF06CI05'))
    expect(screen.getByRole('status').textContent).toBe('5 de 5 escolhidas. Tire uma para escolher outra.')
    expect(caixa('EF06CI06').disabled).toBe(true)
    expect(caixa('EF06CI07').disabled).toBe(true)
    // As escolhidas continuam ligadas e se desmarcam.
    expect(caixa('EF06CI01').disabled).toBe(false)
    await usuario.click(caixa('EF06CI01'))
    expect(caixa('EF06CI06').disabled).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('4 de 5 escolhidas')
  })

  it('zero é uma escolha válida: tudo desmarcado, o contador diz "0 de 5" e nada fica bloqueado', () => {
    render(<Peca />)
    expect(screen.getByRole('status').textContent).toBe('0 de 5 escolhidas')
    expect(screen.getAllByRole('checkbox').every((marca) => !(marca as HTMLInputElement).disabled)).toBe(true)
  })

  it('o teto é o que quem usa a peça diz: com `maximo` 1 (a troca da questão), a segunda caixa bloqueia', async () => {
    const usuario = userEvent.setup()
    render(<Peca maximo={1} />)
    await usuario.click(caixa('EF06CI03'))
    expect(caixa('EF06CI04').disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('1 de 1 escolhidas. Tire uma para escolher outra.')
  })

  it('o que a pessoa escolheu fica à vista no alto, mesmo quando o filtro não o acha, e não se repete entre as achadas', () => {
    const { linhas } = linhasDoSeletor({ itens: CANDIDATAS, filtro: 'célula', selecionados: ['EF06CI07'] })
    expect(linhas.map((item) => item.codigo)).toEqual(['EF06CI07', 'EF06CI05'])
    const semFiltro = linhasDoSeletor({ itens: CANDIDATAS, filtro: '', selecionados: ['EF06CI04'] })
    expect(semFiltro.linhas.map((item) => item.codigo)).toEqual(['EF06CI04', 'EF06CI01', 'EF06CI02', 'EF06CI03', 'EF06CI05', 'EF06CI06', 'EF06CI07'])
    expect(semFiltro.total).toBe(CANDIDATAS.length)
  })

  it('a lista mostra até 50 linhas e diz quantas há, para o computador fraco não desenhar as 300', () => {
    const muitas: HabilidadeCandidataBncc[] = Array.from({ length: 120 }, (_, n) => ({ codigo: `EF06CI${String(n).padStart(2, '0')}`, descricao: `Habilidade ${String(n)}` }))
    const { linhas, total } = linhasDoSeletor({ itens: muitas, filtro: '', selecionados: [] })
    expect(linhas).toHaveLength(MAXIMO_DE_LINHAS_DO_SELETOR)
    expect(total).toBe(120)
    render(<Peca itens={muitas} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(50)
    expect(screen.getByText(/Mostrando 50 de 120\./)).toBeTruthy()
  })
})

describe('os estados de quem lê as candidatas', () => {
  it('carregando: o filtro está lá, e a lista diz que carrega, sem contador nem "sem resultado"', () => {
    render(<Peca itens={undefined} carregando />)
    expect(screen.getByText(TEXTO_CARREGANDO_DO_SELETOR)).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: rotuloDoFiltro })).toBeTruthy()
    expect(screen.queryByText(TEXTO_SEM_RESULTADO_DO_SELETOR)).toBeNull()
    expect(screen.queryByText(/escolhidas/)).toBeNull()
  })

  it('erro: diz que não leu e "Tentar de novo" lê de novo', async () => {
    const usuario = userEvent.setup()
    const tentar = vi.fn()
    render(<Peca itens={undefined} erro aoTentarDeNovo={tentar} />)
    expect(screen.getByRole('alert').textContent).toBe(TEXTO_ERRO_DO_SELETOR)
    expect(screen.queryByText(TEXTO_SEM_RESULTADO_DO_SELETOR)).toBeNull()
    await usuario.click(screen.getByRole('button', { name: /Tentar de novo/ }))
    expect(tentar).toHaveBeenCalledTimes(1)
  })

  it('a leitura que cai com a lista de antes ainda na mão diz o erro, e não a lista velha', () => {
    render(<Peca erro />)
    expect(screen.getByRole('alert').textContent).toBe(TEXTO_ERRO_DO_SELETOR)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('sem lista, sem leitura no ar e sem erro: não desenha lista nenhuma e diz que não leu', () => {
    render(<Peca itens={undefined} />)
    expect(screen.getByRole('alert').textContent).toBe(TEXTO_ERRO_DO_SELETOR)
  })

  it('sem componente: diz o que acontece com a questão e não oferece filtro nem lista', () => {
    render(<Peca itens={[]} semComponente />)
    expect(screen.getByText(TEXTO_SEM_COMPONENTE_DO_SELETOR)).toBeTruthy()
    expect(TEXTO_SEM_COMPONENTE_DO_SELETOR).toBe('Esta disciplina não tem componente da BNCC. A questão fica sem habilidade.')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('a lista de candidatas vazia (o recorte não tem nenhuma) diz que não há resultado, e não fica em branco', () => {
    render(<Peca itens={[]} />)
    expect(screen.getByText(TEXTO_SEM_RESULTADO_DO_SELETOR)).toBeTruthy()
  })
})

describe('o foco e o Esc', () => {
  it('o foco entra no filtro quando a peça abre; sem filtro (sem componente), entra na própria peça', () => {
    const { unmount } = render(<Peca />)
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: rotuloDoFiltro }))
    unmount()
    render(<Peca itens={[]} semComponente />)
    expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Habilidades do capítulo 3' }))
  })

  it('o Esc fecha a peça e não sobe ao painel; sem quem a feche, o Esc não é dela', () => {
    const fechar = vi.fn()
    const noPainel = vi.fn()
    render(
      <div onKeyDown={noPainel}>
        <Peca aoFechar={fechar} />
      </div>,
    )
    fireEvent.keyDown(screen.getByRole('searchbox', { name: rotuloDoFiltro }), { key: 'Escape' })
    expect(fechar).toHaveBeenCalledTimes(1)
    expect(noPainel).not.toHaveBeenCalled()
    // Outra tecla não fecha, e sobe ao painel como sempre.
    fireEvent.keyDown(screen.getByRole('searchbox', { name: rotuloDoFiltro }), { key: 'a' })
    expect(fechar).toHaveBeenCalledTimes(1)
    expect(noPainel).toHaveBeenCalledTimes(1)
    noPainel.mockClear()
    cleanup()
    render(
      <div onKeyDown={noPainel}>
        <Peca />
      </div>,
    )
    fireEvent.keyDown(screen.getByRole('searchbox', { name: rotuloDoFiltro }), { key: 'Escape' })
    expect(noPainel).toHaveBeenCalledTimes(1)
  })
})
