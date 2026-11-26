# Correção — o ajudante do e2e que responde a questão recebe 404 porque a tentativa deixou de nascer na leitura da prova

**Origem:** esteira run 45331593419 em `56ffc73` (`gh run view 45331593419 --log-failed`): `professor-semana-itens`, `a3-a4-professor`, `classificacao-bncc` e `roteiro-da-demonstracao` caem em `e2e/support/aluno-api.ts:32` com `resposta da questão 1`, esperado 200, recebido 404.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `conformidade-reviewer`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`
<!-- Os quatro primeiros vieram no PEDIDO do Orquestrador. `tenancy-guardian` e `privacy-guardian` entraram pelo caminho que
     `portao-local.ts revisores` pede (o ajudante fala com as rotas de prova do aluno), não por escolha de quem corrige. -->

## Sintoma

O aluno do e2e, que faz a parte dele pela API (`responderPelaApi`), abre a atividade com `GET /v1/atividades-aplicadas/:id/prova` (200) e
em seguida grava a primeira resposta com `PUT .../respostas/1`, que devolve 404. Quatro specs de e2e caem pelo mesmo ajudante.

## Fora desta correção

Nada: a árvore estava limpa ("Arquivos da tarefa em curso: nenhum").

## Causa

Falha da **tarefa 3.0** (`2177c7ba`), vista só na esteira: `GET .../prova` deixou de gravar. Quem cria a tentativa passou a ser
`POST .../atividades-aplicadas/:id/comecar`, e sem tentativa o `PUT` das respostas não acha onde gravar e responde 404 (regra 6: não
confirma nada). A 3.0 atualizou a simulação da tela (`e2e/support/aluno.ts`, que ganhou a rota `comecar`), mas não o ajudante que fala
com a API de verdade (`e2e/support/aluno-api.ts`), cuja leitura da prova era, até ali, o que abria a tentativa.

## Teste que reproduz

Os quatro specs de e2e acima, que são quem usa o ajudante: `e2e/professor-semana-itens.spec.ts` rodado isolado, vermelho antes
(`resposta da questão 1`, esperado 200, recebido 404) e verde depois. Não há teste menor que prove o ajudante: ele só existe para
falar com a API de ponta a ponta.

## Correção

`e2e/support/aluno-api.ts`: `responderPelaApi` começa a atividade com `POST /v1/atividades-aplicadas/:id/comecar` (pedido de corpo vazio, responde 200 com a prova) no
lugar do `GET .../prova`, e só então grava as respostas. É o contrato novo da 3.0, sem mudar nada em `apps/` nem em `packages/`.
Rodados isolados (`node tools/ci/e2e.ts --manter-ambiente`) os quatro specs: `professor-semana-itens`, `a3-a4-professor`,
`classificacao-bncc` e `roteiro-da-demonstracao`, 30 casos verdes (3,0 min); antes da mudança, `professor-semana-itens` isolado dava
8 falhas com o 404.

**Sem mutação:** a correção só altera `e2e/support/aluno-api.ts`, ajudante de teste; nenhum arquivo de `apps/*/src` nem de `packages/*/src`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | O ajudante conferir o corpo devolvido pelo `comecar` (por exemplo `comecou: true`) | Recusada: acrescenta asserção ao ajudante, que só precisa da tentativa criada, e pede rodar o e2e de novo. O formato do que `comecar` devolve ao aluno já tem teste de contrato em `apps/api/test/contracts.test.ts:332` |
| test-engineer (1ª) | Registrar no comentário que `sequencia` pode virar obrigatória | Recusada: o schema declara `sequencia` opcional por cliente antigo e tem teste (`packages/shared/src/atividade/atividade.test.ts:96`); se mudar, esse teste cai antes do e2e |
| test-engineer (1ª) | Para a retro: a 3.0 trocou o contrato de uma rota e atualizou só a simulação (`e2e/support/aluno.ts`), não o ajudante que fala com a API (`e2e/support/*-api.ts`); conferência no portão da tarefa pegaria antes | Retro da spec (Arquiteto): pauta de mudança no portão. Nada a fazer aqui |
| privacy-guardian (1ª) | O teste de contrato da rota `comecar` fica com a API; esta correção não diz nada sobre ele | Nada a aplicar: o próprio revisor diz que não precisa |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-26 16:19:06 | 2026-11-26 16:19:21 | `tenancy-guardian` | 1 | APROVADO | a077a0f40c54ab0b3 |
| 2026-11-26 16:19:05 | 2026-11-26 16:19:23 | `infra-guardian` | 1 | APROVADO | ac2781fc1ffd97acc |
| 2026-11-26 16:19:03 | 2026-11-26 16:19:24 | `revisor-geral` | 1 | APROVADO | a817b3643803e52a2 |
| 2026-11-26 16:19:04 | 2026-11-26 16:19:27 | `conformidade-reviewer` | 1 | APROVADO | a3a30f2fbd7639897 |
| 2026-11-26 16:19:07 | 2026-11-26 16:19:28 | `privacy-guardian` | 1 | APROVADO | a111232b95ac9fe23 |
| 2026-11-26 16:19:02 | 2026-11-26 16:19:50 | `test-engineer` | 1 | APROVADO | ae98503a531dad2b4 |
| 2026-11-26 16:27:08 | 2026-11-26 16:27:35 | `revisor-geral` | 2 | APROVADO | adf45de9132b33540 |
