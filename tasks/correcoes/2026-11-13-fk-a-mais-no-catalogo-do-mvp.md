# Correção — o teste do catálogo de FKs do MVP não conhece a FK que a licença de material acrescentou a `material`

**Origem:** esteira run 43347186711 em `6b2611b` (`gh run view 43347186711 --log-failed`): o job `integração`.
**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O `tenancy-guardian` veio no PEDIDO do Orquestrador; o `test-engineer` é de toda correção; os outros três vêm do caminho: todo
     arquivo de `packages/`, teste inclusive, pede os quatro (`tools/processo/guardioes-por-caminho.ts`). A correção altera um arquivo
     fora de `tasks/` e não toca `.github/`, `tools/ci/` nem `tools/processo/`: sem `revisor-geral`. -->

## Sintoma

`packages/core/src/db/schema/mvp/mvp-tables.int.test.ts › … › pelo catálogo: toda FK das dezessete tabelas, fora a da
própria escola, começa por `escola_id` dos dois lados, e leva o ano letivo quando as duas pontas têm ano` falha em
`expect(compostas.map((fk) => fk.nome)).toEqual(FKS_COMPOSTAS_DO_MVP)` com `expected [ …(45) ] to deeply equal [ …(44) ]`.
A única diferença do diff é `+ "material_licenca_da_escola_fk"`, entre `material_excluido_por_da_escola_fk` e
`mensagem_agente_disciplina_da_escola_fk`. Os outros 3241 testes da integração passaram.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Falha da **tarefa 5.0** (`62e13520`), vista só na esteira: a migration `0052_licenca_de_material.sql` acrescentou
`material_licenca_da_escola_fk` (`FOREIGN KEY ("escola_id","licenca_id") REFERENCES licenca_de_material("escola_id","id")`,
declarada em `packages/core/src/db/schema/material.ts:70`) à tabela `material`, uma das dezessete do MVP, e o teste lista à
mão, pelo nome, toda FK composta dessas tabelas (`FKS_COMPOSTAS_DO_MVP`) para que a que some ou muda de nome seja olhada.
A lista não foi atualizada. A FK está certa: é composta, começa por `escola_id` dos dois lados (a mesma regra 10 que o teste
confere), e `licenca_de_material` não é uma das dezessete tabelas, então as outras asserções do caso continuam valendo.
Esse arquivo não estava no portão da 5.0 (a tarefa não o alterou), e só a integração inteira da esteira o roda.

## Teste que reproduz

`packages/core/src/db/schema/mvp/mvp-tables.int.test.ts › regra 10: a estrutura impede apontar para objeto de outra escola ›
pelo catálogo: toda FK das dezessete tabelas…`: vermelho antes (o caso já é o que falha, com a lista sem a FK nova), verde
depois da lista com `material_licenca_da_escola_fk`. O vermelho está registrado no run 43347186711 da esteira
(`gh run view 43347186711 --log-failed`: `expected [ …(45) ] to deeply equal [ …(44) ]`, com `+ "material_licenca_da_escola_fk"`),
e foi reproduzido aqui, isolado, com a mesma diferença, antes de a lista mudar.

## Correção

`FKS_COMPOSTAS_DO_MVP` ganha `'material_licenca_da_escola_fk'`, na ordem de nome (entre `material_excluido_por_da_escola_fk`
e `mensagem_agente_disciplina_da_escola_fk`). Nenhum código de produção muda e nenhuma cláusula nova entra: não há bloco de
mutação a escrever (a cláusula da FK é da 5.0, e o teste dela é `packages/core/src/db/migracao-f4.int.test.ts`, que a
recusa com `23503`).

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

**Sem mutação:** a correção só acrescenta um nome à lista de um teste; nenhum arquivo de `apps/*/src` nem de `packages/*/src` (fora teste) muda. A prova de que a lista confere é o próprio caso, que fica vermelho se a FK sair do banco ou mudar de nome.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 01:36:02 | 2026-11-13 01:36:16 | `privacy-guardian` | 1 | APROVADO | a09b39c223cfff39a |
| 2026-11-13 01:36:04 | 2026-11-13 01:36:17 | `infra-guardian` | 1 | APROVADO | a1cf5393e578d85f9 |
| 2026-11-13 01:36:00 | 2026-11-13 01:36:20 | `tenancy-guardian` | 1 | APROVADO | a65619b08aa9edb40 |
| 2026-11-13 01:36:03 | 2026-11-13 01:36:21 | `conformidade-reviewer` | 1 | APROVADO | a3f1287f979575f6e |
| 2026-11-13 01:35:59 | 2026-11-13 01:36:29 | `test-engineer` | 1 | APROVADO | ab49d3beff47a63b3 |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | "Hoje, uma tarefa que cria migration alterando uma das dezessete tabelas do MVP não passa por este teste no portão. Vale fazer o portão de tarefa com migration em `packages/core/drizzle/` incluir `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`." | Não aplicar aqui: muda `tools/processo/` (portão), arquivo que esta correção não toca, e muda comportamento do portão. Destino: retro da spec (`/retro`), como item de mudança no portão da tarefa |
