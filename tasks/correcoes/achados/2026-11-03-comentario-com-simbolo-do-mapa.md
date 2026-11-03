# Achados das revisões — `tasks/correcoes/2026-11-03-comentario-com-simbolo-do-mapa.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-03 20:07:17 · `tasks/correcoes/2026-11-03-comentario-com-simbolo-do-mapa.md`

```
VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A correção não cria nem altera migration ou schema.
Queries verificadas: nenhuma. Nenhum repository, query ou endpoint mudou. O diff de /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/migracao-f2.int.test.ts tem 1 linha a mais e 1 a menos, e só no comentário do cabeçalho (linha 14).
Teste de isolamento: não se aplica. Não há escopo de tenant novo nem alterado para provar, e o teste de migração do F2 continua com o mesmo código.
Bloqueantes: nenhum
Recomendações:
- O mesmo arquivo ainda tem `migrar` dentro de duas strings: 'migrar-f2-teste' na linha 21 e 'educa-migrar-f2-' na linha 36. O restos.test.ts só acusou a linha 12, então pelo visto o detector não pega essas formas com hífen. Vale confirmar que o teste fica verde com o arquivo inteiro, não só com a linha 12.
```

## test-engineer · 1ª rodada · APROVADO · 2026-11-03 20:07:50 · `tasks/correcoes/2026-11-03-comentario-com-simbolo-do-mapa.md`

VEREDITO: APROVADO

Cenários exigidos: a correção muda uma palavra num comentário de teste (`packages/core/src/db/migracao-f2.int.test.ts:14`, "do serviço `migrar`" passou a "do serviço de migração"). O cenário que conta é este: `tools/renomear/restos.test.ts` › "a árvore não tem resto dos mapas aplicados" falha antes da troca e passa depois. Não há regra de negócio, permissão, isolamento entre escolas nem concorrência em jogo, então os cenários de domínio não se aplicam.

Cobertos:
- **Vermelho antes.** O `git diff` mostra que a linha antiga tinha `` `migrar` ``, e essa palavra está no mapa de nomes (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/renomear/mapa.ts:73`). Isso bate com o sintoma registrado no documento (`migracao-f2.int.test.ts:12 migrar`).
- **Verde depois.** Rodei `npx vitest run tools/renomear/restos.test.ts` e passaram 43 de 43 casos. O texto novo não traz outra palavra do mapa.
- **Mutações.** O único arquivo de código no diff é um `*.int.test.ts`, que fica fora do RF17 (`apps/*/src` e `packages/*/src` sem contar teste). Ainda assim o documento traz `**Sem mutação:**` com o motivo escrito, o que basta. Nenhuma cláusula nova ficou sem bloco.
- **Tabela de testes.** O documento cita um teste pelo nome completo, "Teste que reproduz", e ele existe e está verde.
- **Nada desligado.** O diff não tem `.skip`, teste comentado, mock nem chamada a provedor de IA.
- **Escopo.** O documento deixa fora da revisão e do commit os arquivos da tarefa 4.0 que ainda estão em curso, como o pedido determina.

Bloqueantes: nenhum.

Recomendações:
- A causa registrada diz que `restos.test.ts` só entrou no portão na 4.0, e por isso a falha da 2.0 passou batida. Vale levar à retro se esse teste deve rodar no portão de toda tarefa que altera comentário ou texto em `packages/` e `apps/`, para pegar o resto do mapa na própria tarefa que o escreveu.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/db/migracao-f2.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-03-comentario-com-simbolo-do-mapa.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/renomear/restos.test.ts`
