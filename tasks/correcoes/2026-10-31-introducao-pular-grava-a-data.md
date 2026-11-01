# Correção — o "Pular" da introdução grava, mas o e2e lê a data nula do banco logo depois do poll da gravação

**Origem:** esteira run 41227149419 (`29885bab`, `e2e/coordenacao-introducao.spec.ts:114` [chromebook]) e run 41213545554 (`539162f`, `e2e/professor-introducao.spec.ts:117` [celular]); verde na 41220920453.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `test-engineer` e `revisor-geral` vieram no PEDIDO do Orquestrador. Os outros quatro são os que `tools/processo/guardioes-por-caminho.ts` exige de todo arquivo de `e2e/`, e a Mesa os acrescentou na devolução. A correção leva 2 arquivos fora de tasks/ e não toca `.github/`, `tools/ci/` nem `tools/processo/`. -->

## Sintoma

Nos casos `"Pular" no passo 1 grava a data, uma vez, e leva ao Painel / a "Início"`, depois de `await expect.poll(() => gravacoes.length).toBe(1)`
a linha seguinte, `expect(await introducaoVistaEmDoUsuario(usuarioId)).not.toBeNull()`, recebe `null`. Intermitente: a mesma linha passou na
execução 41220920453.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**Corrida do teste, não defeito da gravação.** `contarGravacoes` empilha o pedido no evento `request` do Playwright, que dispara quando o
navegador **envia** o POST; o `expect.poll(() => gravacoes.length).toBe(1)` fica verde nesse instante. O `terminar()` de
`use-introducao.ts` manda a mutação e já navega (`ir(..., { replace: true })`), então o `toHaveURL` também não espera o servidor. Em seguida o
teste lê o banco, direto, sem esperar o `UPDATE` de `marcarIntroducaoVista` (uma instrução só, `coalesce(introducao_vista_em, now())`,
`eu.repository.ts:51`) confirmar. Quando o runner está lento a leitura chega antes do commit e vê `null`. O servidor grava de uma vez e
responde a mesma data (`eu.service.ts:48`); a tela não cancela o pedido ao navegar (SPA). Nada na gravação precisa mudar.

De qual tarefa foi: as asserções vieram da **10.0** (professor, `c437c727`) e da **11.0** (coordenação, `eb14f85c`) da spec
"telas do aluno e primeiro acesso"; a X8 só renomeou os arquivos (6.0). O caso do aluno não lê o banco, então não tem a corrida.

## Teste que reproduz

`e2e/coordenacao-introducao.spec.ts › "Pular" no passo 1 grava a data, uma vez, e leva ao Painel; a entrada seguinte não volta` e
`e2e/professor-introducao.spec.ts › "Pular" no passo 1 grava a data, uma vez, e leva a "Início"`. Os dois ganham um `page.route` que segura a
resposta da gravação por 1 s: o pedido sai, a tela segue, e o banco ainda não tem a data. Com a asserção antiga, vermelho sempre (a corrida
da esteira feita à vista); com a espera pelo banco, verde.

## Correção

Nos dois casos, `expect(await introducaoVistaEmDoUsuario(id)).not.toBeNull()` vira
`await expect.poll(() => introducaoVistaEmDoUsuario(id), { timeout: PRAZO_DA_ENTRADA_MS }).not.toBeNull()`: o teste espera o dado que
afirma, em vez de supor que o pedido que saiu já gravou. Se a gravação de fato não acontecesse, o poll estouraria o prazo e o caso falharia.

O atraso de 1 s soma ao caso, e o do professor passava de 15 s no portão (16,9 s no celular, 15,2 s no chromebook). A causa era a entrada
por `entrarPelaApi`, que paga a primeira carga na rede lenta; o caso passa a usar `entrarPelaApiSemMedirAPrimeiraCarga`, como o da coordenação.
O portão da segunda tentativa ficou verde, com a duração dentro do limite.

## Mutações

**Sem mutação:** a correção só altera `e2e/`; nenhum arquivo de `apps/*/src` nem de `packages/*/src` muda.

## Prova

- Vermelho antes: com o atraso e a asserção antiga, os quatro casos (`chromebook` e `celular` dos dois specs) falharam com `Received: null`.
- Verde depois: os mesmos quatro casos, dez repetições cada (`--repeat-each=10`): 40 passaram, 0 falharam.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Filtrar o método no handler da rota (`rota.request().method() === 'POST'`, senão `rota.continue()` sem atraso) | Recusada: `POST /v1/eu/introducao` é a única rota desse endereço (`apps/api/src/sessao/eu/eu.controller.ts:21`, conferido pelo `revisor-geral`), e o `unroute` limita o atraso ao trecho da gravação |
| revisor-geral (1ª), test-engineer (1ª) | `ATRASO_DA_GRAVACAO_MS`, o trecho de `page.route` e `contarGravacoes` estão copiados nos specs de introdução (aluno, professor e coordenação) e podem ir para um helper em `e2e/support/` | `TODO.md`: mexe também no spec do aluno, que está fora desta correção; fazer quando um spec de introdução voltar a ser tocado |
| infra-guardian (1ª) | Teste de clique duplo no "Pular" com a resposta atrasada, para provar uma gravação só | `TODO.md`: é cenário novo, não a corrida desta correção; a data gravada já é única por `coalesce(introducao_vista_em, now())` (`eu.repository.ts:51`) |
| privacy-guardian (1ª) | `entrarPelaApiSemMedirAPrimeiraCarga` não serve a caso de isolamento com segunda pessoa; `introducaoVistaEmDoUsuario` lê por `id` sem `escola_id` | Sem ação: registro para quem copiar o padrão; o ajudante é só de teste e está documentado como tal (`seed.ts:325-328`) |
| conformidade-reviewer (1ª) | Os dois casos continuam provando que "Pular" grava a data e leva ao destino (D59, sair nunca é mais difícil que entrar) | Sem ação: ponto a favor, para a validação |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 20:25:17 | 2026-10-31 20:25:31 | `tenancy-guardian` | 1 | APROVADO | a741c5f9151dfb5fa |
| 2026-10-31 20:25:20 | 2026-10-31 20:25:37 | `infra-guardian` | 1 | APROVADO | a8bcc7d7fb5df0f35 |
| 2026-10-31 20:25:18 | 2026-10-31 20:25:41 | `privacy-guardian` | 1 | APROVADO | a6554d14c99aad28b |
| 2026-10-31 20:25:19 | 2026-10-31 20:25:43 | `conformidade-reviewer` | 1 | APROVADO | aef870e108db343c0 |
| 2026-10-31 20:25:16 | 2026-10-31 20:25:44 | `revisor-geral` | 1 | APROVADO | a566f8e7c57d6d2da |
| 2026-10-31 20:25:15 | 2026-10-31 20:26:23 | `test-engineer` | 1 | APROVADO | aa4ad6a6ceb3f29d3 |
| 2026-10-31 21:53:05 | 2026-10-31 21:53:25 | `test-engineer` | 2 | APROVADO | a562ce95f2f50ce77 |
| 2026-10-31 21:53:15 | 2026-10-31 21:53:35 | `revisor-geral` | 2 | APROVADO | ad789773274452353 |
