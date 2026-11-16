# Correção — o resumo do material empurra o "Enviar material" quando chega, e o toque no celular cai ao lado do botão

**Origem:** esteira run 43944321899 em `afd3ebec`: job e2e 6/11, `[celular] e2e/a2-assistente.spec.ts:174` (passou no `chromebook`).
**Subagentes obrigatórios:** `frontend-reviewer`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `frontend-reviewer`, `test-engineer` e `revisor-geral` vieram no PEDIDO do Orquestrador; os quatro últimos vêm do caminho: todo arquivo de `apps/` e de `e2e/` pede os quatro (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

`e2e/support/professor-flow.ts:53`, em `montarEscolaEEntrar`: `expect(page.getByRole('dialog', { name: 'Enviar material' })).toBeVisible()` falha em 5 s com
"element(s) not found", logo depois do `tap()` em "Enviar material" (`professor-flow.ts:51`). No traço (`traco-do-e2e-6`), a página termina na aba Material, sem diálogo, e o botão
ainda lá.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**A tela**, e só no celular. O "Resumo do material" fica **acima** da lista e do "Enviar material" (o vazio da escola nova). Enquanto ele carrega, mostra "Carregando o resumo…", uma linha;
quando chega, mostra "Ainda não há material para resumir. Quando a escola enviar o primeiro PDF, os números aparecem aqui.", que em 360 px quebra em três linhas. O botão desce 40 px
(medido: `y` 580 → 620 no `celular`; 508 → 508 no `chromebook`, onde o texto cabe numa linha, por isso só o celular cai).

No traço da esteira, o `tap()` calculou o ponto em `y = 602` (o botão ia de 580 a 624) às 586107 ms, "performing tap action" começou às 586145 ms e terminou às 586217 ms; a resposta de
`/v1/materiais/resumo` (pedido às 585532 ms, 617 ms de duração) chegou às 586149 ms, dentro dessa janela de 72 ms. O botão passou a ocupar 620–664, e o toque, em 602, caiu acima dele. O Playwright
não repete: o `tap()` terminou, e a falha só aparece no `expect` do diálogo, 5 s depois. A CPU ×4 do perfil alarga a janela (o `/v1/materiais/resumo` demorou 2,4 s a sair depois de a tela montar), e é por isso
que a esteira pega e a máquina de desenvolvimento quase nunca.

Não é só do teste: a coordenadora no celular, numa rede lenta, perde o toque do mesmo jeito. O texto longo do vazio do resumo repetia o convite que a lista logo abaixo já faz ("Envie o primeiro PDF da
escola…").

## Teste que reproduz

`e2e/material-resumo.spec.ts › o "Enviar material" não sai do lugar quando o resumo termina de carregar: o toque que já saiu não cai ao lado dele`: segura a resposta do resumo
(`page.route`), mede o `y` do botão, solta a resposta e exige o mesmo `y`.

- Vermelho (`node tools/ci/e2e.ts --manter-ambiente e2e/material-resumo.spec.ts`, sem a correção): `[celular]` cai em `expect(...y).toBe(antes?.y)` com `Expected: 580`, `Received: 620`; o `chromebook` passa (11 passed, 1 failed).
- Verde (o mesmo comando, com `e2e/a2-assistente.spec.ts` também, com a correção): 18 passed (1,2 min), nos dois projetos, inclusive `a2-assistente.spec.ts:174` no `celular`, o caso da esteira.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
teste: e2e/material-resumo.spec.ts › o "Enviar material" não sai do lugar quando o resumo termina de carregar: o toque que já saiu não cai ao lado dele
projeto: celular
-        <p className="t-apoio rounded-cartao border-2 border-borda bg-superficie p-4 text-apoio">Ainda não há material para resumir.</p>
+        <p className="t-apoio rounded-cartao border-2 border-borda bg-superficie p-4 text-apoio">Ainda não há material para resumir. Quando a escola enviar o primeiro PDF, os números aparecem aqui.</p>
```

## Correção

`apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx`: o vazio do resumo é só "Ainda não há material para resumir.", uma linha como o "Carregando o resumo…" que ele substitui, e o convite a enviar o
primeiro PDF continua no vazio da lista, logo abaixo. O texto que sai não é citado por nenhum teste (`ResumoDoMaterial.test.tsx` e `material-resumo.spec.ts` procuram só a primeira frase).
`e2e/material-resumo.spec.ts`: o caso novo acima.

Fica de fora: na escola com material, a tabela do resumo, ao chegar, também tem altura diferente da do "Carregando…" e desloca o que vem abaixo, o botão inclusive. Não é o fluxo que a esteira pegou (escola nova, sem
material), e reservar uma altura que varia com o número de linhas é outro desenho (por exemplo, o resumo depois da lista); fica como recomendação, sem aplicar.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª), revisor-geral (1ª), test-engineer (1ª), infra-guardian (1ª) | Na escola com material, a tabela do resumo, ao chegar, tem altura diferente da do "Carregando o resumo…" e ainda empurra o "Enviar material" no celular; pôr o resumo depois da lista, ou reservar a altura | `TODO.md`: uma linha, escrita no commit desta correção. É outro desenho (muda a ordem da tela), e o documento já a deixa fora em "Fica de fora". O caso novo de e2e serve de modelo (segurar o resumo com material, medir, soltar) |
| test-engineer (1ª) | O erro da releitura (`ErroDoResumo`, `ResumoDoMaterial.tsx`) também empurra o botão | Mesma linha do `TODO.md` acima: é o mesmo mecanismo, e a mesma solução (resumo depois da lista) o resolve |
| frontend-reviewer (1ª), infra-guardian (1ª) | O teste compara o `y` com `toBe` exato; tolerância de 1 px | Recusada: as duas medidas são da mesma página, no mesmo viewport, sem zoom nem troca de fonte entre elas; o subpixel só variaria de uma execução para outra, e não dentro dela. O defeito é de 40 px, e a igualdade exata é a asserção mais estrita sem custo |
| frontend-reviewer (1ª), revisor-geral (1ª) | Encurtar o comentário de `ResumoDoMaterial.tsx:74` | Recusada: é o único aviso, no código, de que o texto do vazio precisa caber numa linha, e explica um porquê que o nome do teste não diz. Os dois revisores o chamam de válido. Aplicar custaria uma rodada nova do `revisor-geral` só por estilo |
| revisor-geral (1ª) | Comentário perto de `ResumoDoMaterial.test.tsx` avisando do limite de comprimento do texto | Recusada: o limite já é guardado pelo caso novo de e2e, que falha se o texto crescer; um segundo aviso é outro lugar a manter, em arquivo de teste que a correção não toca (caducaria o `test-engineer`) |
| test-engineer (1ª) | Tocar o botão logo depois de `segurada.abrir()` e exigir o diálogo | Recusada: opcional pelo próprio revisor, e a posição igual já prova a regra. O gesto real é o `a2-assistente.spec.ts:174`, que está verde no documento |
| frontend-reviewer (1ª), privacy-guardian (1ª) | A foto da "escola cheia" em `/coordenacao/material` sai sem material, igual à vazia | Sem ação desta correção: é da vitrine (`tools/vitrine/`), não do código revisado. Fica para a retro |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 18:51:28 | 2026-11-16 18:51:43 | `frontend-reviewer` | 1 | APROVADO | a3c3d899e4d10ec34 |
| 2026-11-16 18:51:36 | 2026-11-16 18:51:44 | `tenancy-guardian` | 1 | APROVADO | ad33166b2337b248c |
| 2026-11-16 18:51:42 | 2026-11-16 18:51:57 | `conformidade-reviewer` | 1 | APROVADO | a4408512464493318 |
| 2026-11-16 18:51:44 | 2026-11-16 18:51:58 | `infra-guardian` | 1 | APROVADO | a90e4eb944b96e07a |
| 2026-11-16 18:51:39 | 2026-11-16 18:51:58 | `privacy-guardian` | 1 | APROVADO | a27be83165e964908 |
| 2026-11-16 18:51:33 | 2026-11-16 18:52:00 | `revisor-geral` | 1 | APROVADO | af8fe9845d2e79ec1 |
| 2026-11-16 18:51:31 | 2026-11-16 18:52:17 | `test-engineer` | 1 | APROVADO | a4d3180be888b8da0 |
