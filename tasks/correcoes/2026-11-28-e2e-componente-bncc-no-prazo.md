# Correção — o caso "segunda pessoa" do componente da BNCC estoura os 30 s na esteira (`estrutura.spec.ts:1143`)

**Origem:** esteira run 46121452308 de `spec/avaliacao-e-correcao`, job `e2e 8/11`: `e2e/estrutura.spec.ts:1143` [celular], 30 s esgotados em `support/casca.ts:408` (`digitarOCodigoDaEntrada`, na segunda entrada, `estrutura.spec.ts:1160`); o caso já levava 29,1 s.
**Subagentes obrigatórios:** `tenancy-guardian`, `revisor-geral`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `tenancy-guardian` e `revisor-geral` vieram no PEDIDO do Orquestrador; os outros três, `portao-local.ts revisores` apontou pelo caminho: todo arquivo de `e2e/` pede os quatro guardiões (`tools/processo/guardioes-por-caminho.ts`), e o teste é de coordenação, com tenant e dado de pessoa. test-engineer é obrigatório em toda correção, marcado ou não. -->

## Sintoma

O caso `segunda pessoa: a coordenação de B não vê o componente que a de A definiu, nem a disciplina dela` (`e2e/estrutura.spec.ts:1143`) esgotou os 30 s no projeto `celular`, dentro da espera do código da segunda entrada de B, e antes disso já levava 29,1 s. Os outros 195 casos da fatia passaram (`gh run view 46121452308 --log-failed`).

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso.

## Causa

**Tempo, e o tempo vai para o que antecede o assunto do caso.** O caso prova que a coordenação de B, entrando na mesma aba em que a de A estava, não vê o componente nem a disciplina de A. Para chegar lá, B pagava **duas entradas pela tela** e a configuração do segundo fator pela tela, tudo sob a CPU ×4 do perfil: `entrarComoCoordenacaoNaMesmaAba` faz senha (argon2), "Configurar o segundo fator", código de ativação, "Ir para a entrada", senha de novo (argon2) e o código. É a mesma causa e a mesma receita do `configurarSegundoFatorPelaApi` que `e2e/support/mfa.ts` já documenta ("a tela de configuração custa uns 8 s de um prazo de 30 s").

Medi no e2e isolado da máquina (`node tools/ci/e2e.ts --manter-ambiente e2e/estrutura.spec.ts`, antes de mexer): **14,1 s (chromebook) e 13,3 s (celular)**. A esteira mediu 29,1 s no celular: o runner leva perto do dobro da máquina, e o caso ficava a um sopro do prazo de 30 s. Foi nesta rodada (run 46121452308) que a espera do código da segunda entrada (`casca.ts:408`) estourou; qualquer corrida mais lenta derrubava o caso, e o que o derrubava era o tempo, não a regra.

A falha vem da tarefa 1.0 de `classificacao-bncc` (`fb384b1b`), que criou o caso.

## Teste que reproduz

Prazo de runner não é determinístico; a evidência é a medida, no mesmo ambiente, antes e depois, e a estabilidade com os 2 trabalhadores da esteira. `e2e/estrutura.spec.ts:1143`, e2e isolado (`--repeat-each 5 --workers 2`, os dois projetos):

| Projeto | Antes | Depois (5 execuções) |
|---|---|---|
| chromebook | 14,1 s | 8,4 a 8,6 s |
| celular | 13,3 s | 9,1 a 10,6 s |

**10 de 10 verdes.** No celular, o dobro do runner dá uns 19 a 21 s dos 30 s, em vez dos 29 s da esteira.

## Correção

Só `e2e/estrutura.spec.ts` muda (o caso `:1143` e dois imports); o produto não, e nenhuma asserção saiu nem mudou.

- A configuração do segundo fator de B passa a ser **pela API** (`configurarSegundoFatorPelaApi(request, deB)`, de `e2e/support/mfa.ts`), no contexto de requisição à parte, que não entrega cookie à aba, depois de A terminar e antes do "Sair".
- A **entrada de B continua pela tela, na mesma aba e sem recarregar** (`entrarPelaTelaComSegundoFator`, de `casca.ts`): senha e código. É ela que mantém na aba o cache de A, que é o que o caso prova (regra 10, item 5; regra 20, item 5; é o que o comentário de `abrirPelaApiSemMedirAPrimeiraCarga` manda não trocar). As quatro asserções finais (nenhuma disciplina de A na lista de B, `body` sem o nome de A nem "Geografia") ficam onde estavam.
- O código de B é o do passo seguinte ao da ativação, como na entrada de sempre (`PASSO_SEGUINTE_SEGUNDOS`): a ativação pela API usa o passo de agora, e a entrada pela tela, o seguinte.
- Fica de fora de propósito: dividir o caso. Os dois lados dele são a mesma prova (A deixa o dado, B entra na mesma aba), e separá-los tiraria a aba compartilhada.

## Mutações

`--faltando: 0 linhas (0 blocos, 0 motivos)`

Correção só de teste, sem linha nova de produção: `node tools/processo/mutacoes.ts --faltando` não lista nada. O bloco abaixo prova que a entrada de B pela tela continua valendo o que vale: com o segredo errado, o código da segunda entrada é recusado e o caso cai antes das asserções de isolamento.

**Onde está a prova do isolamento:** nenhuma asserção do caso mudou, e a prova de que a coordenação de B não alcança o dado de A veio com a tarefa 1.0 de `classificacao-bncc` (`tasks/prd-classificacao-bncc/1_task.md`): a linha "`PATCH` da B no contexto da A" da tabela de testes e os blocos de mutação de `apps/api/test/estrutura.int.test.ts › isolamento: a coordenação da A não alcança a disciplina da B` (tirar o `escolaId` do `where` de `disciplina.repository.ts` e o `NAO_ENCONTRADO` de `disciplina.service.ts`). O caso de e2e daqui é o que mostra o mesmo na aba (a linha "recomeço: segunda pessoa" da mesma tabela).

```mutacao
arquivo: e2e/estrutura.spec.ts
teste: e2e/estrutura.spec.ts › segunda pessoa: a coordenação de B não vê o componente que a de A definiu, nem a disciplina dela
-    await entrarPelaTelaComSegundoFator(page, deB, segredoDeB, hasTouch)
+    await entrarPelaTelaComSegundoFator(page, deB, 'JBSWY3DPEHPK3PXP', hasTouch)
     await esperarPainel(page)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | "Uma mutação que troque `deB` por `deA` na linha 1165 mostraria que as asserções de isolamento ficam vermelhas quando a segunda pessoa é da mesma escola. É cobertura extra, não bloqueia." | Recusada: nenhuma asserção de isolamento mudou nesta correção, e o `test-engineer` (1ª) a deu por suficiente porque "o isolamento foi provado quando o caso nasceu"; a seção "Mutações" aponta esse bloco. Nenhum RF pede mutação nova para correção só de tempo. |
| revisor-geral (2ª) | "No comentário novo, em `e2e/estrutura.spec.ts:1156`, o parêntese "(a ordem não depende da sessão de A)" é curto demais. Quem chegar sem o contexto da 1ª rodada não entende de que ordem se trata. Uma redação mais clara seria: "configurar antes ou depois de A sair dá no mesmo, porque o contexto da API não passa cookie à aba"." | Recusada: o revisor aprovou e não reprovou nesta rodada, e a recomendação sobre este comentário já foi aplicada uma vez (ordem r1); redação do comentário, sem efeito no teste nem no contrato. |
| test-engineer (1ª) | "O outro caso de duas pessoas no mesmo arquivo (`estrutura.spec.ts:891` e `:922`) continua com `entrarComoCoordenacaoNaMesmaAba` nas duas entradas. Ele paga a mesma configuração pela tela, duas vezes. Vale medir esse caso no celular e, se estiver perto do prazo, aplicar a mesma receita." | `TODO.md`: mexe em outro caso, e medir pede e2e isolado; fica fora do escopo desta correção. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.
| 2026-11-28 09:21:42 | 2026-11-28 09:22:02 | `conformidade-reviewer` | 1 | APROVADO | afc38b68540ef4229 |
| 2026-11-28 09:21:39 | 2026-11-28 09:22:06 | `tenancy-guardian` | 1 | APROVADO | a5dba3af96c1c30fb |
| 2026-11-28 09:21:41 | 2026-11-28 09:22:06 | `privacy-guardian` | 1 | APROVADO | a2c6cfd35b7df0606 |
| 2026-11-28 09:21:42 | 2026-11-28 09:22:10 | `infra-guardian` | 1 | APROVADO | ae7763540edeeac03 |
| 2026-11-28 09:21:40 | 2026-11-28 09:22:13 | `revisor-geral` | 1 | APROVADO | ae6108e84349d1ae4 |
| 2026-11-28 09:21:43 | 2026-11-28 09:22:39 | `test-engineer` | 1 | APROVADO | af1f90973d392c996 |
| 2026-11-28 09:40:36 | 2026-11-28 09:40:59 | `revisor-geral` | 2 | APROVADO | aca7e15a8e49b0852 |
