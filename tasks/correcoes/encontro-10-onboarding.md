# Correção — o encontro da linha 1 (tarefa 10.0, 163d13e6) deu conflito em quatro arquivos de `importacao/` com a 11.0 da spec

**Origem:** (slug `encontro-10-onboarding`: o `encontro-10` do pedido já era a correção de 19/10 da spec telas-do-professor) encontro da linha 1 (`tools/processo/linhas.ts`), tarefa 10.0: o merge de `spec/onboarding-por-convite` na branch da linha parou em conflito, e a esteira da spec ficou vermelha em `tools/renomear/restos.test.ts`.
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador; os outros três são os que `portao-local.ts revisores` exige pelos caminhos de `apps/` e `packages/` que o merge traz (a Mesa devolveu o pedido por isso). O revisor-geral entra porque o merge traz mais de 5 arquivos fora de `tasks/`. -->

## Sintoma

`git merge spec/onboarding-por-convite` na linha 1 traz a tarefa 11.0 (`ad64177b`, a grade como alocação e vínculos pendentes). Quatro arquivos de
`packages/core/src/importacao/` não juntam sozinhos: `importacao.repository.ts`, `motor.ts`, `tipo.ts` e `tipos/alunos.ts`.

A esteira da spec está vermelha em `tools/renomear/restos.test.ts`: `packages/core/src/importacao/tipos/grade.test.ts` (linhas 29, 43 e 338) usa o
símbolo `Banco`, que está no mapa de nomes (`Banco` → `Database`) e a guarda lê como resto do mapa.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa antes do merge.

## Causa

As duas tarefas mexeram nos mesmos pontos do motor de importação, cada uma por um lado:

- **`tipo.ts` e `motor.ts` (assinatura de `travar`).** A 10.0 passou a dar ao `travar` a transação do passo (3) (`tx`), para a planilha de alunos
  travar os anos dos vínculos de quem vai desligar. A 11.0 deu ao mesmo `travar` o `passo3` (`{ contas, travarContas }`) e ao `planejar` as `contas`,
  para a grade travar as contas dos professores novos. As duas trocaram o 5º parâmetro.
- **`importacao.repository.ts`.** Linha de `import`: a 10.0 ampliou os tipos importados de `lista.repository` (`AlunoDaVirada`, `RetiradaDeNome`); a 11.0 acrescentou o `DisciplinaRepository`.
- **`tipos/alunos.ts`.** A 10.0 acrescentou `desligar` e `voltar` e abriu o `aplicar` com `{ tx, ciclo }`; a 11.0 tirou o laço de criação de turmas do
  `aplicar` e o fez função exportada, `criarTurmasNovas`, que a grade também usa.
- **`grade.test.ts` e `Banco`.** A 11.0 nomeou `Banco` o tipo dos dados falsos do teste, e o mapa de nomes da X8 (`Banco` → `Database`) só vê o
  símbolo quando o arquivo chega à árvore da linha que o renomeou: a 11.0 saiu antes de a esteira da spec o juntar.

## Teste que reproduz

Não se aplica ao conflito, que é de texto. A prova é a árvore sem marcador, tipada e verde: o portão da tarefa roda os testes dos dois lados
(`alunos`, `grade`, o motor e as integrações do worker da 10.0 e da 11.0), e o `restos.test.ts` fica verde sem o símbolo `Banco` em `grade.test.ts`.

## Correção

- `tipo.ts`: o `travar` fica `travar?(repositorio, ano, guardado, marcas, passo3, tx)`, com os dois parâmetros; `planejar` fica como a 11.0 (com `contas?`).
- `motor.ts`: o ramo dos tipos de um ano chama `tipo.travar?.(…, { contas, travarContas }, tx)` e `tipo.planejar(…, contas)`.
- `tipos/alunos.ts`: `travar(repositorio, ano, guardado, marcas, _passo3, tx)`; ficam `desligamentosDe`, `desligar`, `voltasDe` e `voltar` da 10.0 e
  `criarTurmasNovas` da 11.0, e o `aplicar` (`{ tx, ciclo }`) chama `criarTurmasNovas` no lugar do laço.
- `importacao.repository.ts`: os dois `import` juntos (`DisciplinaRepository` e os tipos da 10.0).
- `grade.test.ts`: o tipo `Banco` vira `Dados` (só a palavra, nas linhas 20, 29, 43 e 338), e as quatro chamadas de `tipoGrade.travar` passam a `tx` (`TX`, uma
  transação falsa que a grade não usa).

## Sem mutação

**Sem mutação:** a correção só junta o que as duas tarefas já escreveram e testaram (a 10.0 e a 11.0 passaram cada uma pelo portão e pela Mesa, com os blocos
`mutacao` dos documentos delas); nenhuma cláusula é nova: a resolução escolhe os dois lados e acrescenta o parâmetro `tx` ao `travar` da grade, que o ignora.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª), tenancy-guardian (1ª), infra-guardian (1ª) | `packages/core/src/importacao/tipos/grade.ts:518`: declarar `_tx` no `travar` da grade, para ficar simétrico com o `_passo3` de `tipos/alunos.ts` | Recusada: `grade.ts` chega do lado da 11.0 e esta correção não o altera (não está na seção "Correção"); mudar uma assinatura de código de produção já revisado, só para legibilidade, é fora do escopo de uma junção e recaduca os seis revisores. Pode virar limpeza própria da 11.0 se o Joaquim quiser |
| test-engineer (2ª) | `tipo.ts:89`: trocar os parâmetros `passo3` e `tx` de `travar` por um objeto de opções `{ passo3, tx }` | Retro da spec onboarding-por-convite (o próprio revisor diz "isso é para a retro, não para esta correção"): muda o contrato do `travar` |
| tenancy-guardian (1ª) | Rodar `gravar-planilha-grade.int.test.ts` e `desligamento-pela-planilha.int.test.ts` juntos na árvore do merge | Não é mudança de código. O pedido do Implementador diz que as integrações do worker de planilha (6 arquivos, 148 casos) passaram na árvore do merge; o portão da tarefa cobre o resto |
| conformidade-reviewer (1ª) | Não rodou testes nem tipos; a prova fica com o portão | Não é mudança: o carimbo do portão já vale para o código atual |
| revisor-geral (2ª), test-engineer (3ª) | `packages/core/src/importacao/tipos/grade.test.ts`: as variáveis locais `const banco = {…}` (linhas 154, 165, 202, 222, 240, 265, 282, 333 e 356) seguem com o nome antigo | Recusada: o pedido da rodada 1 era só as assinaturas, o nome ainda lê bem ("o que já está no banco") e a recomendação de quem aprova entra em ordem uma vez por documento. Limpeza própria da 11.0, se o Joaquim quiser |
| test-engineer (3ª) | Rodar os testes de `packages/core` a partir da raiz do repositório: de dentro do pacote o vitest lê `packages/shared/dist/` desatualizado, e o `grade.test.ts` falha em 6 casos sem defeito no código | Retro da spec onboarding-por-convite (nota para o Arquiteto): é armadilha do ambiente, não mudança desta correção |
| test-engineer (1ª, neste caminho) | Teste de unidade do `planejarSobTrava` com um tipo falso, conferindo que o `travar` recebe o `passo3` e a mesma `tx` (hoje só a integração de desligamento prova a 6ª posição) | Retro da spec onboarding-por-convite, junto com o objeto de opções do `travar`: é teste novo (pede bloco em "Mutações") e a correção é "Sem mutação"; a posição já é provada por `apps/worker/test/desligamento-pela-planilha.int.test.ts` e pelo tipo (`tsc` falha com parâmetro fora de lugar) |
| revisor-geral (1ª, neste caminho) | `packages/core/src/importacao/tipo.ts:81`: o JSDoc do `travar` tem uma linha muito longa que destoa das vizinhas | Recusada: a linha vem do lado da 10.0, já revisado, e é só forma; reescrever recaduca o `revisor-geral`. Limpeza própria da 10.0/11.0 se o Joaquim quiser |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 10:02:24 | 2026-11-04 10:02:59 | `conformidade-reviewer` | 1 | APROVADO | af68c3a5cea8cd4f2 |
| 2026-11-04 10:02:10 | 2026-11-04 10:03:01 | `revisor-geral` | 1 | APROVADO | aec7d25e673c5047a |
| 2026-11-04 10:02:17 | 2026-11-04 10:03:04 | `tenancy-guardian` | 1 | APROVADO | a7adea45fa6b5ee4a |
| 2026-11-04 10:02:21 | 2026-11-04 10:03:44 | `privacy-guardian` | 1 | APROVADO | a9be62f397cf2202f |
| 2026-11-04 10:02:28 | 2026-11-04 10:04:20 | `infra-guardian` | 1 | APROVADO | a16869ddb79136593 |
| 2026-11-04 10:02:13 | 2026-11-04 10:07:21 | `test-engineer` | 1 | APROVADO | a2d483879c5f46884 |
