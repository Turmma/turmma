// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeNetwork, renderScreen, setupScreen } from '../../../__fixtures__/render-screen'
import type * as ApiDaImportacao from './api/importacao'
import { rotasDaPlanilha } from './api/importacao'
import { ImportarPlanilha, type PlanilhaConfig } from './ImportarPlanilha'

/**
 * A fila lenta (regra 80): a gravação que passa do prazo de aviso segue sendo acompanhada, e a tela diz que está demorando. O relógio e
 * a espera do acompanhamento são do teste: `agora` anda quando o caso manda, e cada espera entre leituras fica parada até o caso a
 * soltar. Nada depende do tempo de verdade, e o resto da peça é o de verdade. Arquivo à parte porque o `vi.mock` vale para o arquivo
 * inteiro.
 */
const relogio = vi.hoisted(() => ({ agora: 0, esperas: [] as (() => void)[] }))

vi.mock('./api/importacao', async (importarOriginal) => {
  const original = await importarOriginal<typeof ApiDaImportacao>()
  return {
    ...original,
    acompanharImportacao: (ler: Parameters<typeof original.acompanharImportacao>[0], opcoes: Parameters<typeof original.acompanharImportacao>[1]) =>
      original.acompanharImportacao(ler, {
        ...opcoes,
        agora: () => relogio.agora,
        esperar: () =>
          new Promise<void>((soltar) => {
            relogio.esperas.push(soltar)
          }),
      }),
  }
})

setupScreen()
afterEach(() => {
  cleanup()
  relogio.agora = 0
  relogio.esperas.length = 0
})

const CONFIGURACAO: PlanilhaConfig = {
  rotas: rotasDaPlanilha('alunos'),
  cabecalhos: ['turma', 'nome', 'matricula'],
  nomeDoModelo: 'modelo-alunos.csv',
  instrucao: 'Uma linha por aluno.',
  vazio: { titulo: 'Nenhuma planilha escolhida', descricao: 'Baixe o modelo e escolha o arquivo.' },
  rotuloDoGravar: 'Gravar planilha',
}
const IMPORTACAO = '0197a1c0-0000-7000-8000-000000000900'
const DA_FILA = { id: IMPORTACAO, tipo: 'alunos', estado: 'na_fila', resumo: null, erro: null, criadoEm: '2026-11-04T10:00:00-03:00', concluidaEm: null }

const PREVIA = { status: 200, corpo: { linhas: [{ linha: 2, resultado: 'entra' }], contagens: { entram: 1 }, candidatos: [] } }

async function escolherEGravar(usuario: ReturnType<typeof userEvent.setup>): Promise<void> {
  await usuario.upload(screen.getByLabelText('Arquivo da planilha (Excel ou CSV)'), new File(['turma;nome;matricula\n8º A;Ana;1\n'], 'alunos.csv', { type: 'text/csv' }))
  await usuario.click(await screen.findByRole('button', { name: 'Gravar planilha' }))
}

/** Solta a próxima espera entre leituras, depois de ela estar parada. */
async function soltarAProximaEspera(): Promise<void> {
  await waitFor(() => expect(relogio.esperas).toHaveLength(1))
  relogio.esperas.shift()?.()
}

describe('a fila lenta: a tela diz que está demorando e não desiste', () => {
  it('depois do prazo avisa que a gravação continua; ao concluir, o aviso sai e o resultado chega', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', PREVIA)
    rede.responderPor('/v1/importacoes/alunos', { status: 202, corpo: { id: IMPORTACAO } })
    let leituras = 0
    rede.responderPor(`/v1/importacoes/${IMPORTACAO}`, () => {
      leituras += 1
      return leituras < 3 ? { status: 200, corpo: DA_FILA } : { status: 200, corpo: { ...DA_FILA, estado: 'concluida', resumo: { entram: 1 }, concluidaEm: '2026-11-04T10:05:00-03:00' } }
    })
    renderScreen(<ImportarPlanilha configuracao={CONFIGURACAO} />)
    await escolherEGravar(usuario)

    await screen.findByText(/Gravando a planilha\./)
    // Na primeira espera o relógio ainda está no começo: sem o aviso.
    await waitFor(() => expect(relogio.esperas).toHaveLength(1))
    expect(screen.queryByText(/A fila está mais cheia que o normal/)).toBeNull()
    // Passou o prazo de 60 s: a próxima leitura ainda na fila é a que avisa.
    relogio.agora = 61_000
    await soltarAProximaEspera()
    await screen.findByText(/A fila está mais cheia que o normal/)
    await soltarAProximaEspera()
    await screen.findByRole('heading', { name: 'Planilha gravada' })
    expect(screen.queryByText(/A fila está mais cheia que o normal/)).toBeNull()
    expect(leituras).toBe(3)
  })

  it('sair da tela cancela a leitura: depois de desmontar, nenhuma leitura nova da importação sai', async () => {
    const usuario = userEvent.setup()
    const rede = fakeNetwork()
    rede.responderPor('/v1/importacoes/alunos/previa', PREVIA)
    rede.responderPor('/v1/importacoes/alunos', { status: 202, corpo: { id: IMPORTACAO } })
    rede.responderPor(`/v1/importacoes/${IMPORTACAO}`, { status: 200, corpo: DA_FILA })
    const { unmount } = renderScreen(<ImportarPlanilha configuracao={CONFIGURACAO} />)
    await escolherEGravar(usuario)
    await waitFor(() => expect(relogio.esperas).toHaveLength(1))
    const leiturasAntes = rede.chamadas.filter(({ caminho }) => caminho === `/v1/importacoes/${IMPORTACAO}`).length
    expect(leiturasAntes).toBe(1)

    unmount()
    // A espera termina depois de a tela sair: a leitura seguinte não pode existir.
    relogio.esperas.shift()?.()
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(rede.chamadas.filter(({ caminho }) => caminho === `/v1/importacoes/${IMPORTACAO}`)).toHaveLength(leiturasAntes)
  })
})
