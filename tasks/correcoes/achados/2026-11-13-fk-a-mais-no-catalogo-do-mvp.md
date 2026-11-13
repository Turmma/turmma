# Achados das revisões — `tasks/correcoes/2026-11-13-fk-a-mais-no-catalogo-do-mvp.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## test-engineer · 1ª rodada · APROVADO · 2026-11-13 01:36:29 · `tasks/correcoes/2026-11-13-fk-a-mais-no-catalogo-do-mvp.md`

VEREDITO: APROVADO

**Cenários exigidos** (é uma correção de teste, então valem estes, e não os de caso de borda de uma tarefa):
- O caso do catálogo fica vermelho antes da correção e verde depois.
- A FK nova continua sendo conferida pela regra 10: composta e começando por `escola_id` dos dois lados.
- O caso falha se a FK sumir do banco ou mudar de nome.
- A regra da própria FK já tem um teste, que é da tarefa 5.0.

**Cobertos:**
- **Vermelho antes:** a esteira (run 43347186711) mostra o caso falhando no `toEqual(FKS_COMPOSTAS_DO_MVP)`, com 45 FKs contra 44. A única diferença é `material_licenca_da_escola_fk`. É o motivo certo, porque a lista não tinha o nome.
- **Verde depois:** rodei `npx vitest run packages/core/src/db/schema/mvp/mvp-tables.int.test.ts -t "pelo catálogo"` e os dois casos passaram.
- **Ordem da lista:** o diff põe o nome entre `material_excluido_por_da_escola_fk` e `mensagem_agente_disciplina_da_escola_fk`. A query ordena por `c.conname` e a comparação é por `toEqual` na ordem exata, então a posição está certa.
- **Regra 10:** o caso em `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:463` confere pelo `pg_constraint` que toda FK composta começa por `escola_id` dos dois lados. A FK nova, declarada em `packages/core/drizzle/0052_licenca_de_material.sql:30` como `("escola_id","licenca_id") → licenca_de_material("escola_id","id")`, passa por essa checagem sem nada mudar. Se ela sair do banco ou trocar de nome, a lista exata volta a falhar.
- **Teste da regra da FK:** fica com a 5.0. Em `packages/core/src/db/migracao-f4.int.test.ts:244`, um insert com licença de outra escola é recusado com `23503` e `constraint: 'material_licenca_da_escola_fk'`.
- **Mutações:** nenhum arquivo de `apps/*/src` nem de `packages/*/src` muda, fora o próprio teste. Nenhuma cláusula nova entra, então "0 blocos" está correto.
- **`.skip`, `.only`, `.todo` e mocks:** não há nenhum no arquivo, e nenhum mock esconde a regra (o teste lê o catálogo real do Postgres). Não há IA nem operação concorrente envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Pela retro:** a causa no documento diz que este arquivo só roda na integração inteira da esteira. Hoje, uma tarefa que cria migration alterando uma das dezessete tabelas do MVP não passa por este teste no portão. Vale fazer o portão de tarefa com migration em `packages/core/drizzle/` incluir `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`. Assim a próxima FK nova aparece na tarefa, e não só na esteira.
2. A seção "Teste que reproduz" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-fk-a-mais-no-catalogo-do-mvp.md` pode citar o run 43347186711 como prova do vermelho, como a seção "Origem" já faz. Assim quem lê não precisa refazer a reprodução.
