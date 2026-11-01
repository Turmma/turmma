import { atividadeSintetica, versaoAdaptada } from './support/assistente.ts'
import { abrirNavegacao, gaveta, irPelaNavegacao, lateral, naGaveta, SIGN_IN_TIMEOUT_MS, secoes } from './support/casca.ts'
import { entrar, irPara, SCREEN_TIMEOUT_MS, recarregar } from './support/professor/scenario.ts'
import { abrirEntregasDoAssistente } from './support/professor/entregas.ts'
import { sinoDe } from './support/professor/sino.ts'
import { abrirSinaisDoTutor } from './support/professor/tutor.ts'
import { seriousViolations } from './support/checks.ts'
import { expect, test } from './support/profiles.ts'

/**
 * A navegação do professor (A2, pacote W; telas do professor, 2.0): os três lugares na ordem da D80, nenhum grupo "Seu time", o
 * sino e as duas telas do time pelo pé dele. Separado de `professor-assistente.spec.ts` pela 2.5, um spec por tela.
 */

test.describe('a navegação do professor na A2 (D73)', () => {
  // O título é o de antes da D80, quando a lateral tinha o grupo "Seu time": a separação dos specs (telas do professor, 2.0) move o
  // caso sem mudá-lo (Tech Spec, seção 10). O que o caso prova hoje: os três lugares na ordem da D80, nenhum grupo de agentes na
  // lateral, o número do sino e as duas telas do time, que abrem pelo pé dele e não são lugar de nenhum item.
  test('a lateral tem Início, Ferramentas e Turmas, e "Seu time" com o Assistente e o que espera a professora, e o Tutor sem contador; Calendário e Histórico não aparecem', async ({ page, hasTouch }) => {
    // Entrada, troca de tela e recarga com a CPU ×4 e a rede lenta do perfil: o teste percorre vários estados da mesma tela.
    test.slow()
    const { api, turmaId, disciplinaId } = await entrar(page, hasTouch)
    const origem = atividadeSintetica(turmaId, disciplinaId)
    api.entregas = [versaoAdaptada(origem).entrega, versaoAdaptada(origem).entrega, versaoAdaptada(origem, 'aprovada').entrega]
    await recarregar(page)
    await irPelaNavegacao(page, 'Início', hasTouch)
    await expect(page).toHaveURL(/\/professor\/nova-conversa$/)
    await expect(page).toHaveTitle('Início · Turmma', { timeout: SCREEN_TIMEOUT_MS })
    await expect(page.getByText(/Seu time/)).toHaveCount(0)

    // `Seções` está à vista sem abrir a gaveta (a barra de baixo, no celular): os três lugares, na ordem da D80.
    await expect(secoes(page).getByRole('link')).toHaveText(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    await abrirNavegacao(page, hasTouch)
    // "Seu time" saiu da lateral: nenhum grupo de agentes, e nem o Assistente nem o Tutor são item dela.
    await expect(lateral(page).getByRole('navigation', { name: 'Seu time' })).toHaveCount(0)
    await expect(lateral(page).getByRole('link', { name: /Assistente de ensino|^Tutor$/ })).toHaveCount(0)
    for (const fora of ['Calendário', 'Histórico']) await expect(lateral(page).getByText(fora, { exact: true })).toHaveCount(0)
    // X1 (12.0): nenhum avatar da onça na casca (A80). O Início tem o do Assistente, no `main` (telas do professor, 3.1): a
    // casca é tudo o que está fora dele.
    await expect(lateral(page).locator('[data-agente]:not(main *)')).toHaveCount(0)
    expect(await seriousViolations(page)).toEqual([])
    if (naGaveta(page)) {
      await page.keyboard.press('Escape')
      await expect(gaveta(page)).toBeHidden()
    }
    // O que espera a professora mora no sino: as duas pendentes contam, e não a que ela já aprovou.
    await expect(sinoDe(page)).toHaveAccessibleName('Esperando você, 2', { timeout: SIGN_IN_TIMEOUT_MS })

    // O Assistente abre pelo pé do sino, e a tela dele não acende nenhum item da lateral.
    await abrirEntregasDoAssistente(page, hasTouch)
    await expect(page).toHaveURL(/\/professor\/time\/assistente$/)
    await expect(page).toHaveTitle('Assistente de ensino · Turmma', { timeout: SCREEN_TIMEOUT_MS })
    await expect(secoes(page).locator('[aria-current="page"]')).toHaveCount(0)
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    // O Tutor, também pelo pé do sino.
    await abrirSinaisDoTutor(page, hasTouch)
    await expect(page).toHaveURL(/\/professor\/turmas\/[0-9a-f-]{36}\?aba=hoje$/)
    await expect(page).toHaveTitle(/^Turma .+ · Turmma$/, { timeout: SCREEN_TIMEOUT_MS })
    // O Tutor mora na turma (aba Hoje): é "Turmas" que a lateral acende, e nenhum outro item.
    await expect(secoes(page).locator('[aria-current="page"]')).toHaveText('Turmas')
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
    // Turmas e Ferramentas, os outros dois lugares, também não dizem "Seu time".
    for (const rotulo of ['Turmas', 'Ferramentas']) {
      await irPelaNavegacao(page, rotulo, hasTouch)
      await expect(page).toHaveTitle(`${rotulo} · Turmma`, { timeout: SCREEN_TIMEOUT_MS })
      await expect(secoes(page).getByRole('link', { name: rotulo })).toHaveAttribute('aria-current', 'page')
      await expect(page.getByText(/Seu time/)).toHaveCount(0)
    }
    // Dentro da conversa, "Início" continua selecionado (o documento aberto acende "Criados": `areas/navigation.test.ts`).
    await irPara(page, '/professor/conversa')
    await expect(secoes(page).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText(/Seu time/)).toHaveCount(0)
  })
})
