# Correção — o encontro da 4.0 (71738c89) deu conflito em packages/core/src/index.ts com spec/semana-do-professor (3.0)

**Origem:** encontro da linha 2 (`tools/processo/linhas.ts`), tarefa 4.0: o merge de `spec/semana-do-professor` (0cd5dd46, com a 3.0) na branch da linha parou em conflito.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador trouxe test-engineer e revisor-geral. Os quatro guardiões vêm dos caminhos que o merge leva (packages/ e apps/), como o portão lista; a Mesa devolveu o pedido por falta deles, como no encontro-6-onboarding. -->



## Nota

O slug do pedido era `encontro-4`, mas `tasks/correcoes/encontro-4.md` (e `achados/encontro-4.md`) já existe, de outra spec (o encontro da
linha 2 da `telas-da-coordenacao`, resolvido em `3beffaa2`). Reescrever aquele arquivo apagaria a causa e as revisões daquela correção;
por isso este documento e a marca do commit usam `encontro-4-semana`, como `encontro-6-onboarding` e `encontro-6-harness` já fizeram.

## Sintoma

`git merge spec/semana-do-professor` na linha 2 traz a 3.0 (os itens do dia na leitura da semana). Quase tudo junta sozinho; um arquivo não:
`CONFLITO (conteúdo): Conflito de merge em packages/core/src/index.ts`.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa antes do merge.

## Causa

As duas tarefas mexeram nas mesmas duas linhas do barril `core/index.ts`, o export da semana:

- a 4.0 (linha 2) acrescentou `AulaRepository` e `CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA` na linha de valores;
- a 3.0 (spec) acrescentou o tipo `ItemDaSemana` na linha de tipos.

São exports independentes, de peças diferentes, e o git os devolve com marcadores porque ficam nas mesmas linhas. (`core/semana/index.ts`
juntou sozinho e já exporta os dois lados.)

Segunda causa, que o portão achou depois da resolução: `tools/renomear/restos.test.ts:350` ("a árvore não tem resto dos mapas aplicados")
fica vermelho com `apps/api/test/semana-itens.int.test.ts:41 Linha`. É o parâmetro de tipo do `sql` do teste da 3.0, que repete o nome `Linha`
que os mapas 9 e 10 da X8 trocaram (`ListItem`, `ListRow`) e que o `restos` cobra em arquivo novo. O resto **vem da 3.0**, não do merge: rodei o
`restos` numa cópia solta da `spec/semana-do-professor` e deu o mesmo achado. O merge o traz para a linha 2, e o Orquestrador mandou fechá-lo aqui.

## Teste que reproduz

O conflito não tem teste: é a resolução de um conflito de texto num arquivo de exports, sem comportamento novo. O código que veio do merge já
tem os testes da 3.0. A prova é a ausência de marcador, a união dos exports das duas tarefas, a tipagem da raiz, a do `e2e/`, a da `infra/` e a de
cada pacote limpas (`npm run typecheck`), além do portão da tarefa sobre a árvore que o merge deixou.

O resto da 3.0 tem o teste que o pega: `tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados`,
vermelho antes (`apps/api/test/semana-itens.int.test.ts:41 Linha`, rodado no portão) e verde depois (`node tools/renomear/restos.ts`: "limpo. 11 mapas").

## Correção

Mantidos os exports das duas pontas, sem tirar nem renomear nenhum, e os marcadores saíram:

- valores: `AulaRepository, CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA, SemanaRepository`;
- tipos: `AlocacaoDaSemana, AnoDaSemana, EventoDaSemana, ItemDaSemana, RegistroDaSemana, VinculoDaSemana`.

Também fecha o resto da 3.0: em `apps/api/test/semana-itens.int.test.ts:41` o parâmetro de tipo `Linha` do `sql` passou a `Tupla`
(a declaração e os dois usos, na mesma linha). Só o nome do parâmetro mudou; o tipo e o corpo são os mesmos.

O merge se fecha com o commit `(correção encontro-4-semana)`.

## Mutações

**Sem mutação:** a correção só une exports num arquivo de barril e troca o nome de um parâmetro de tipo num teste; não escreve cláusula nova, e o código que veio do merge tem as mutações e os testes da tarefa 3.0.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 22:31:31 | 2026-11-06 22:31:50 | `tenancy-guardian` | 1 | APROVADO | a4c690189a27064f1 |
| 2026-11-06 22:31:34 | 2026-11-06 22:32:00 | `privacy-guardian` | 1 | APROVADO | a4459485afd5b1036 |
| 2026-11-06 22:31:37 | 2026-11-06 22:32:01 | `conformidade-reviewer` | 1 | APROVADO | ae6de16b12999ea99 |
| 2026-11-06 22:31:28 | 2026-11-06 22:32:05 | `revisor-geral` | 1 | APROVADO | abc1cf7e9fcadf13e |
| 2026-11-06 22:31:41 | 2026-11-06 22:33:24 | `infra-guardian` | 1 | APROVADO | aceea4a7b7ee30479 |
| 2026-11-06 22:31:24 | 2026-11-06 22:33:48 | `test-engineer` | 1 | APROVADO | a1dde63d1635eb503 |
