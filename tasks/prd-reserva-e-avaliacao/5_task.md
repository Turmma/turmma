# Tarefa 5.0 — A chamada da reserva chega ao banco e ao compartilhamento do aluno, e o worker só a chama conferida

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 2.0, 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

No `main-worker` montado de verdade: a linha da chamada da reserva é gravada com o provedor dela e `pelo_provedor_de_reserva`
verdadeira; o compartilhamento do aluno lista os dois suboperadores; e a reserva recusada na conferência (2.0) não recebe
chamada, até ser corrigida sem reiniciar. Fecha a pendência da linha 99 de `docs/lgpd.md` (`TODO.md`).

## Contexto necessário

- `techspec.md` §3, §5 ("A bancada"), §7 (a linha 99)
- `prd.md` RF1, RF5, §8
- `cenarios.md` §1: RF1 (a parte "com o principal fora, a chamada termina `IA_INDISPONIVEL` sem chamar a reserva" e "O cadastro
  corrigido, sem reiniciar…"); RF3 ("A reserva é tentada uma vez…", a parte do lote em `fila-de-ia.int.test.ts`); RF5 ("O mesmo caso
  misto pela bancada do gateway real…")
- `TODO.md`: as linhas "(camada-ia, 2.0, privacy-guardian…) `pelo_provedor_de_reserva` na linha 99…" e "(camada-ia, validação…)
  `docs/mvp-contratos.md:213`"
- Código: `apps/api/src/ia/consumo.repository.ts`, `apps/api/test/fila-de-ia.fixture.ts` (`comModelo` troca o gateway inteiro:
  aqui não serve), `apps/api/src/ia/reserva-na-subida.int.test.ts` (2.0), `packages/core/src/titular/leitura-do-titular.ts`

## Subtarefas

- [x] 5.1 — O `ConsumoRepository` grava `pelo_provedor_de_reserva`
- [x] 5.2 — A bancada de `fila-de-ia.fixture.ts` monta o gateway real com dois `ScriptedAdapter` de envio externo, cada um com
  `provedorId` e suboperador próprios
- [x] 5.3 — `docs/lgpd.md` linha 99 (§7); "enviadas" nos comentários de `consumo.ts`, `consumo-ia.ts` e `leitura-do-titular.ts`;
  "saída de reserva" no `docs/glossario.md`; `docs/mvp-contratos.md:213`; as duas linhas do `TODO.md` marcadas
- [x] 5.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/test/fila-de-ia.fixture.ts` | alterado |
| `apps/api/src/ia/fila-de-ia.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts` | alterado (o `reserva-na-subida.int.test.ts` da lista prevista não foi tocado: a divergência abaixo diz por quê) |
| `packages/core/src/ia/consumo.ts`, `packages/core/src/db/schema/consumo-ia.ts`, `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `docs/lgpd.md`, `docs/glossario.md`, `docs/mvp-contratos.md`, `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| prazo no principal, reserva atende, pela bancada: duas linhas no banco, o `provedor` de cada uma e `pelo_provedor_de_reserva` `false` e `true` | I | a coluna gravada | dois `provedorId` | `fila-de-ia.int.test.ts` › a reserva pela bancada do gateway real › o prazo no principal e a reserva que atende |
| o mesmo caso: o compartilhamento do aluno lista os dois suboperadores | I | LGPD art. 18, VII | dois suboperadores | `fila-de-ia.int.test.ts` › … › o mesmo caso: o compartilhamento do aluno lista os dois suboperadores; `arquivo-do-titular.int.test.ts` › a chamada que saiu para a reserva entra no arquivo do aluno |
| a chamada só pela reserva: o compartilhamento lista só o dela | I | o provedor de cada linha | o principal sem linha | `fila-de-ia.int.test.ts` › … › a chamada só pela reserva |
| reserva recusada na conferência e principal fora: `IA_INDISPONIVEL` sem chamá-la | I | RF1 no roteamento | contador na reserva | `fila-de-ia.int.test.ts` › … › a reserva recusada na conferência e o principal fora (a primeira metade do caso: `[1, 0]` nos contadores) |
| o cadastro corrigido sem reiniciar: a chamada seguinte, com o principal fora, vai à reserva | I | a reconferência | o mesmo worker | o mesmo caso, depois do `update` do cadastro (a `SoberaniaNaSubida` é a mesma instância, `[2, 1]` nos contadores e a linha da reserva) |
| principal e reserva fora no lote: `JobAdiadoError(provedor)`, uma chamada à reserva | I | sem laço | contador de chamadas no principal e na reserva | `fila-de-ia.int.test.ts` › … › principal e reserva fora no lote |
| isolamento: a linha da reserva da escola B fica fora do arquivo do aluno da A | I | regra 10 | duas escolas com a mesma reserva | `arquivo-do-titular.int.test.ts` › isolamento: a linha da reserva da escola B; `fila-de-ia.int.test.ts` › … › isolamento: a reserva que a escola B usou (os dois provam a separação por aluno, e dizem no nome; a tarefa não acrescenta cláusula de escopo) |
| o `ConsumoRepository` grava `pelo_provedor_de_reserva`: verdadeiro onde o destino diz, falso onde não o traz (a estimada da interrompida) | I | o padrão da coluna | os três valores (`true`, `false`, ausente) | `fila-de-ia.int.test.ts` › … › o ConsumoRepository grava pelo_provedor_de_reserva |
| o contador da Operação não sai no arquivo do titular, e o `provedor` das duas linhas sai | I | a coluna fora do arquivo (D85 e `leitura-do-titular.ts`) | uma linha `true` e uma `false` no mesmo aluno | `arquivo-do-titular.int.test.ts` › a chamada que saiu para a reserva entra no arquivo do aluno |

## Como testar

- Compartilhamento: `apps/api/test/arquivo-do-titular.int.test.ts` › "a linha estimada da execução interrompida (sem `aluno_id`, ligada
  pela execução que o aluno pediu) entra no arquivo dele, com o provedor, e a do colega da turma não" e › "D85: isolamento: a linha da escola B…"
- Subida e conferência: `reserva-na-subida.int.test.ts` (2.0); `soberania-na-subida.int.test.ts` › "externo com o cadastro que não cobre…
  corrigido o cadastro, passa a consumir sozinho"
- Lote: `fila-de-ia.int.test.ts` › "o provedor indisponível numa ferramenta, que não é do lote, não adia…" (o par do lote)
- `npx vitest run --project integracao apps/api/test/arquivo-do-titular.int.test.ts apps/api/src/ia/reserva-na-subida.int.test.ts`
- Armadilha: a bancada é o único lugar que monta o gateway (`tools/guardas/executor-so-na-bancada.test.ts`); não monte outro no teste

## Fora do escopo desta tarefa

A interrompida e a contagem da Operação (8.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutações.** A única cláusula de produção que o diff acrescenta é `peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false` no `ConsumoRepository`: dois blocos, tirar a linha (a coluna volta ao padrão e a reserva fica `false`) e `?? false` → `?? true` (a linha que não traz o campo vira `true`). O resto do diff é bancada de teste, comentário e documento: sem cláusula.
2. **Texto na tela.** A tarefa não tem tela.
3. **O que distingue.** O caso da coluna tem as duas linhas na mesma execução, a do principal (`false`) e a da reserva (`true`), com `provedor` diferente; o do repository, os três valores (verdadeiro, falso, ausente); o do compartilhamento, os dois suboperadores semeados com a chave de cada adaptador.
4. **Checagem anterior.** Os casos do Tutor passam por orçamento, soberania do principal e da reserva (declaradas conferidas na bancada, e a conferência real no caso da recusa) antes de chegar ao roteamento; o caso do lote passa pela janela, pela suspensão e pela configuração operacional da escola (linha semeada) e pelo `daRotina` do comando. O dublê lança o erro que o `ResilientAdapter` entrega (`LLMError`), como o `llm-gateway.test.ts` faz.
5. **A asserção olha o resultado.** As linhas lidas do banco, o `provedor` e a coluna de cada uma, o contador de chamadas de cada adaptador e a foto que `Compartilhamento` devolve, não a forma do código.
6. **Guarda nova.** Nenhuma. A bancada segue o único lugar que monta o gateway (`executor-so-na-bancada.test.ts` não cita `LLMGateway`).
7. **Comentários e docs.** `docs/lgpd.md` linha 99, o glossário e `mvp-contratos.md` dizem o que está no código e nos casos acima; os nomes (`IA_RESERVA_PROVEDOR_ID`, `pelo_provedor_de_reserva`, `reservaQuandoInvalida`) vêm da árvore.
8. **Divergência.** Uma, de lugar de teste (tabela abaixo), sem regra nova.
9. **Peça que já existe.** `LLMGateway`, `ScriptedAdapter`, `SoberaniaNaSubida`, `Compartilhamento` e a bancada `FilaDeIa`: importados, nenhum copiado.
10. **Concorrência.** Nenhuma operação simultânea nova.
11. **Isolamento e a coluna "Caso".** O caso de isolamento tem a mesma reserva e um aluno em cada escola, lido no contexto de cada uma. A tarefa não acrescenta cláusula de escopo (a leitura do rastro é a de antes), e a coluna "Caso" da tabela está preenchida, uma por coisa que a linha diz.
12. **Guardiões.** `tenancy` (a linha segue na escola do contexto, sem `@Unscoped`), `privacy` (nenhum campo pessoal novo; a coluna fica fora do arquivo), `conformidade` (o Tutor só vai à reserva aprovada e conferida), `infra` (nenhum balde nem prazo muda aqui) e `llm-integrator` (a linha leva o provedor e a coluna de cada chamada); o `achados/indice.md` da 4.0 não toca o que a 5.0 mexe.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Os casos do roteamento com a bancada (a recusa na conferência, a reconferência sem reiniciar, o lote) e os do compartilhamento do aluno moram em `fila-de-ia.int.test.ts`, que tem a bancada e o processador; `arquivo-do-titular.int.test.ts` ganha o contador fora do arquivo e o isolamento entre escolas | O `cenarios.md` nomeava `reserva-na-subida.int.test.ts` e `soberania.test.ts` para o "cadastro corrigido" e `arquivo-do-titular.int.test.ts` para o compartilhamento "pela bancada": o primeiro não monta o processador (só o `WorkerModule` com endereço de mentira, sem chamada) e o segundo não tem bancada; o que se prova é o mesmo, com o caminho que a tarefa fixa | `cenarios.md` §1, RF1 ("O cadastro corrigido…") e RF5 ("O mesmo caso misto pela bancada…"), com o caminho de cada caso (as duas linhas, que dizem "os nomes de arquivo são os prováveis; a tarefa fixa o caminho") |
| `ConsumoDeIa.peloProvedorDeReserva` continua **opcional** no tipo, e o `ConsumoRepository` grava `?? false`: a 5.0 não torna o campo obrigatório | O `ConsumoDeIa` também é construído fora do gateway (a estimada da interrompida, `consumoEstimadoDaInterrompida`, que é da 8.0): o campo obrigatório quebraria esse construtor sem nenhum ganho para a linha do gateway, que sempre o traz. O caso "ausente" do teste do repository depende dessa escolha | `techspec.md` §5, "O destino por chamada" ("opcional no tipo, e a falta vale `false` … o campo obrigatório é da 5.0": a escolha é da 5.0, e ela fica opcional) e §3 (`pelo_provedor_de_reserva`) |

## Mutações

`--faltando: 0 linhas (2 blocos, 0 motivos)`

```mutacao
arquivo: apps/api/src/ia/consumo.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o prazo no principal e a reserva que atende
      provedor: consumo.provedorId,
-      peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false,
      tentativas: consumo.tentativas,
```

```mutacao
arquivo: apps/api/src/ia/consumo.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o ConsumoRepository grava
-      peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false,
+      peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? true,
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | Se o worker morre durante a chamada à reserva, a linha estimada leva só o `provedor` do principal e a reserva fica fora do compartilhamento, contra o "nunca os subestima" da linha 99; pôr `docs/lgpd.md` linha 99 nos arquivos previstos da 8.0, que passa a dizer "uma estimada por destino" | Tarefa 8.0 (a interrompida é "Fora do escopo desta tarefa" aqui). Destino: linha no `TODO.md` para a 8.0, com `docs/lgpd.md` linha 99 entre os arquivos previstos dela |
| privacy-guardian (1ª), test-engineer (1ª) | Comentários que se contradizem sobre a estimada da interrompida: `packages/core/src/ia/consumo.ts:50` ("leva o provedor da reserva") e `consumo.repository.ts:10-11` ("o provedor do adaptador configurado") | Tarefa 8.0, que muda a interrompida; a linha do `consumo.ts` é de antes desta tarefa. Mesma linha do `TODO.md` |
| conformidade-reviewer (1ª) | Guarda que impeça `aprovadoPor: 'bancada-de-teste'` (`fila-de-ia.fixture.ts:588`) de chegar à produção, "se um dia essa função for exportada para fora de `test/`" | Recusada: o arquivo mora em `apps/api/test/` e a própria recomendação diz que hoje fica só no teste; sem exportação, não há o que guardar |
| conformidade-reviewer (1ª) | Asserção em `mensagem_tutor` (`fila-de-ia.int.test.ts:291`) de que o turno atendido pela reserva aparece igual ao professor da turma, no modo sala e no resumo do modo casa | Não aplicar: a visibilidade ao professor é do Tutor e não muda nesta tarefa, que só grava a coluna e lê o rastro. Destino: linha no `TODO.md`, para a validação da spec ou a tarefa que toca `tutor.int.test.ts` |
| test-engineer (1ª) | Isolamento que pegue a remoção do escopo de escola: o mesmo usuário como aluno em duas escolas, "se o modelo permitir" | Não aplicar: a tarefa não acrescenta cláusula de escopo (a leitura do rastro é a de antes) e o item 3 deixa claro, no nome, o que os casos provam. Destino: `TODO.md`, para quem tocar `alunoTrailStatement` |
| llm-integrator (1ª) | `afterAll` e `afterEach` do bloco apagam `suboperador` por chave e `consumo_ia` por escola: manter o padrão se outro bloco semear suboperador de alcance `todas` | Sem ação: é aprovação com observação, nada a mudar hoje |
| test-engineer (2ª) | `fila-de-ia.int.test.ts:943`: o comentário de `linhasDe` ainda diz "na ordem das chamadas", e a consulta agora ordena por `provedor`; trocar por algo como "ordenadas pelo `provedor`; o teste acha cada linha pelo provedor, não pela posição" | Recusada: é comentário de teste que não muda o que ele prova, e nenhum revisor reprovou nesta rodada (as recomendações só entram em ordem de quem reprovou). Se o Implementador quiser, é a única mudança possível sem caducar os guardiões, mas não é exigida |
| revisor-geral (2ª) | `fila-de-ia.int.test.ts:1097-1109`: `em: base + indice` não serve mais depois que a leitura acha a linha pelo `provedor`; o comentário da linha 1096 sugere que o instante importa; pode voltar a `new Date()` | Recusada: o `em` distinto é inofensivo e o caso passa pelas duas mutações; sem reprovação nesta rodada |
| revisor-geral (2ª) | A contradição entre os comentários de `consumo.ts` e `consumo.repository.ts` sobre a estimada da interrompida segue até a 8.0; a validação precisa conferir que a 8.0 a corrigiu | Já no `TODO.md` (linha da 8.0, da ordem da rodada 1) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 18:54:40 | 2026-11-22 18:55:07 | `conformidade-reviewer` | 1 | APROVADO | aa12166354e2a69d1 |
| 2026-11-22 18:54:36 | 2026-11-22 18:55:12 | `tenancy-guardian` | 1 | APROVADO | af0413f4a900b1a2c |
| 2026-11-22 18:54:42 | 2026-11-22 18:55:19 | `infra-guardian` | 1 | APROVADO | aca69e583c6306308 |
| 2026-11-22 18:54:38 | 2026-11-22 18:55:41 | `privacy-guardian` | 1 | APROVADO | a2f86d19a4fda5f51 |
| 2026-11-22 18:54:48 | 2026-11-22 18:56:10 | `revisor-geral` | 1 | APROVADO | a27baab572d897c7c |
| 2026-11-22 18:54:46 | 2026-11-22 18:57:46 | `test-engineer` | 1 | REPROVADO | af10269ae0c8a0782 |
| 2026-11-22 18:54:44 | 2026-11-22 18:58:11 | `llm-integrator` | 1 | APROVADO | a14dcf52022b2d570 |
| 2026-11-22 19:14:38 | 2026-11-22 19:15:05 | `revisor-geral` | 2 | APROVADO | a544f4fc7707af234 |
| 2026-11-22 19:14:34 | 2026-11-22 19:15:14 | `test-engineer` | 2 | APROVADO | aee30b9bc00d63de1 |
