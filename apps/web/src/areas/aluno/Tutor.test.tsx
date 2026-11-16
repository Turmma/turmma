// @vitest-environment jsdom
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork } from '../../__fixtures__/render-screen'
import Tutor from './Tutor'
import { TEXTO_DA_FALHA_DO_TUTOR } from './tutor'

/**
 * A pergunta do Tutor que esperou mais de 20 s na fila e foi cortada (reengenharia-continuacao, 7.0; `techspec.md` §5, linha `pendente`): a execução termina `falhou IA_INDISPONIVEL`, e a
 * tela mostra o que houve e "Tentar de novo", sem o código nem o erro cru. O corte só pega execução `pendente`, e por isso não traz junto a mensagem fixa da D36.
 *
 * O caso "D36 junto" é outro, e existe por outro caminho: o modelo classificou o assunto como delicado, a mensagem fixa com o 188 foi gravada, e a execução terminou `falhou`
 * (`EXECUCAO_INTERROMPIDA`, pela varredura; `cenarios.md` §2). A mensagem fixa **fica acima** do "Tentar de novo": quem escreveu sobre algo grave lê o 188 antes de ler "tente de novo".
 * A rede é falsa; a tela, o ciclo da execução e o cliente de consultas são os de verdade. O tamanho, o toque e a acessibilidade nas duas larguras são do e2e (`e2e/aluno-tutor.spec.ts`).
 */
setupScreen()

const ATIVIDADE = '0197a1c0-0000-7000-8000-0000000000a1'
const EXECUCAO = '0197a1c0-0000-7000-8000-0000000000e1'
const PERGUNTA = 'como acho a massa molar?'
/** Nenhum gatilho da regra por palavras a reconhece: só o modelo a classifica como assunto delicado. */
const PERGUNTA_DELICADA = 'lá em casa as coisas estão bem complicadas'
const FIXA = [
  'Obrigado por me contar. Isso é importante, e eu sou uma inteligência artificial: não sou quem pode ajudar você nisso.',
  'Procure hoje seu professor ou a orientação educacional da escola. Eles podem ajudar de verdade.',
  'Se você estiver em perigo ou pensando em se machucar, ligue 188 (CVV). A ligação é gratuita e funciona a qualquer hora.',
].join('\n\n')

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (consulta: string) => ({ matches: false, media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  // O `jsdom` não rola elemento nenhum, e a conversa pede para ir até o fim.
  Element.prototype.scrollIntoView = () => undefined
})

interface Mensagem {
  readonly id: string
  readonly criadaEm: string
  readonly autor: 'aluno' | 'tutor'
  readonly tipo: 'texto' | 'assunto_delicado'
  readonly texto: string
}

const mensagem = (autor: Mensagem['autor'], tipo: Mensagem['tipo'], texto: string): Mensagem => ({ id: randomUUID(), criadaEm: new Date().toISOString(), autor, tipo, texto })

/** A API do Tutor, com a execução que terminou `falhou`: a pergunta entra na conversa ao ser aceita. Sem `comAFixa`, o corte da espera (`IA_INDISPONIVEL`); com ela, o modelo classificou o assunto, a mensagem fixa da D36 foi gravada e a varredura encerrou a execução (`EXECUCAO_INTERROMPIDA`). */
function montar({ comAFixa }: { comAFixa: boolean }): FakeNetwork {
  const rede = fakeNetwork()
  const mensagens: Mensagem[] = []
  rede.responderPor('/v1/minhas-atividades', { status: 200, corpo: { itens: [] } })
  rede.responderPor('/v1/tutor/conversa', () => ({ status: 200, corpo: { estado: 'ligado', uso: { hoje: 12, limiteDoDia: 60 }, avaliacaoAberta: null, mensagens } }))
  rede.responderPor('/v1/tutor/mensagens', () => {
    mensagens.push(mensagem('aluno', 'texto', comAFixa ? PERGUNTA_DELICADA : PERGUNTA))
    if (comAFixa) mensagens.push(mensagem('tutor', 'assunto_delicado', FIXA))
    return { status: 202, corpo: { execucaoId: EXECUCAO } }
  })
  rede.responderPor(`/v1/execucoes/${EXECUCAO}`, { status: 200, corpo: { id: EXECUCAO, tarefa: 'turno_do_tutor', estado: 'falhou', resultado: null, erro: comAFixa ? ErrorCode.EXECUCAO_INTERROMPIDA : ErrorCode.IA_INDISPONIVEL } })
  return rede
}

async function perguntar(texto: string): Promise<void> {
  const usuario = userEvent.setup()
  const localizacao = memoryLocation({ path: `/aluno/tutor/${ATIVIDADE}` })
  renderScreen(
    <Router hook={localizacao.hook}>
      <Tutor atividadeAplicadaId={ATIVIDADE} />
    </Router>,
  )
  await usuario.type(await screen.findByRole('textbox'), texto)
  await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('a pergunta do Tutor cortada na espera (7.0)', () => {
  it('cortada: a execução `falhou IA_INDISPONIVEL` deixa a pergunta na conversa com o texto calmo e "Tentar de novo", sem o código nem a mensagem crua do catálogo', async () => {
    montar({ comAFixa: false })
    await perguntar(PERGUNTA)

    const botao = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 5_000 })
    const falha = botao.closest('[data-falha-do-tutor]')
    expect(falha?.getAttribute('data-falha-do-tutor')).toBe('tentar')
    expect(falha?.textContent).toContain(TEXTO_DA_FALHA_DO_TUTOR)
    expect(screen.getByText(PERGUNTA)).toBeTruthy()
    for (const cru of [ErrorCode.IA_INDISPONIVEL, MENSAGENS_DE_ERRO.IA_INDISPONIVEL, '503']) expect(document.body.textContent).not.toContain(cru)
    // Sem a mensagem fixa, não há encaminhamento na conversa: o 188 não aparece onde ninguém o pediu.
    expect(document.body.textContent).not.toContain('188')
  })

  it('D36 junto: a mensagem fixa com o 188 está na conversa (a execução `falhou EXECUCAO_INTERROMPIDA`) e vem **acima** do "Tentar de novo"', async () => {
    montar({ comAFixa: true })
    await perguntar(PERGUNTA_DELICADA)

    const botao = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 5_000 })
    const lista = screen.getByRole('log', { name: 'Conversa com o Tutor' })
    const fixa = await within(lista).findByText(/Procure hoje seu professor/)
    expect(within(lista).getByRole('link', { name: /188/ })).toBeTruthy()
    // A ordem no documento é a que o leitor de tela anuncia e a que o olho lê: a fixa primeiro, o botão depois.
    expect(fixa.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // As duas estão dentro da mesma conversa, e a pergunta continua antes da fixa.
    expect(lista.contains(botao)).toBe(true)
    const pergunta = within(lista).getByText(PERGUNTA_DELICADA)
    expect(pergunta.compareDocumentPosition(fixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1))
  })
})
