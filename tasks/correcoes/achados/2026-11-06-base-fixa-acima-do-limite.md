# Achados das revisões — `tasks/correcoes/2026-11-06-base-fixa-acima-do-limite.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 14:45:24 · `tasks/correcoes/2026-11-06-base-fixa-acima-do-limite.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: com o `CLAUDE.md` novo, a base fixa (o `CLAUDE.md` mais as regras 10, 20 e 70) fica abaixo de `LIMITE_DA_BASE_FIXA` (40.000 B), e as contagens mínimas continuam atendidas.
- Reprodução: no HEAD, a mesma medida passa do limite.
- Borda 1: o limite do teste não foi afrouxado.
- Borda 2: as regras 10, 20 e 70, a tabela de decisões e as seis regras ficam intactas.
- Borda 3: nenhum outro teste que lê o `CLAUDE.md` quebra com o texto mais curto.
- Permissão, isolamento e concorrência não se aplicam: a mudança é só de documentação, sem código, dado de escola nem operação concorrente.

Cobertos:
- Reprodução: no HEAD, o `CLAUDE.md` tem 13.502 B. Com as regras (4.905 + 9.157 + 12.442), a soma dá 40.006 B, então o teste estava vermelho pelo motivo certo. Hoje o arquivo tem 13.138 B e o total é 39.642 B. Os números do documento conferem.
- `npx vitest run tools/processo/harness/base-fixa.test.ts`: 30 de 30 verdes, incluindo o teste citado, "o repositório de hoje passa, com a medida de antes gravada e as contagens mínimas" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tools/processo/harness/base-fixa.test.ts:150`).
- O limite não mudou: `LIMITE_DA_BASE_FIXA = 40_000` na linha 19 do mesmo arquivo, e `git diff` não mostra nada em `tools/processo` nem em `.claude/rules`.
- O diff do `CLAUDE.md` só mexe no cabeçalho, na lista de conflitos, no fecho da seção Stack e em duas entradas do mapa dos documentos. A tabela de decisões e as seis regras ficaram como estavam.
- Rodei também os outros testes que leem o `CLAUDE.md` (`tools/processo/harness/receitas.test.ts`, `tools/processo/harness/metadados.test.ts`, `tools/processo/estado.test.ts`): 179 de 179 verdes.
- A seção "Mutações" foi trocada, com razão, por "Sem mutação": a correção não toca `apps/*/src` nem `packages/*/src`, então não entra cláusula nova.

Bloqueantes: nenhum.

Recomendações:
1. A folga é de só 358 B. Cada decisão nova acrescenta cerca de 80 B, então umas quatro decisões bastam para o teste ficar vermelho de novo. Seria bom registrar no `TODO.md` ou na retro uma medida que resolva de vez, por exemplo tirar o índice de decisões da base fixa ou compactá-lo. Assim isso não vira correção recorrente.
2. A lista de "conflitos já resolvidos" perdeu itens que voltam com frequência: Chromebook, celular, fila de jobs, notificação à família, importação por planilha, scraper e nome do produto. Eles viraram "e outros". A informação continua no topo de `docs/decisoes.md`, mas o lembrete na base fixa ficou mais fraco. Se faltar espaço no futuro, vale priorizar esses itens antes de outra prosa.
3. O documento da correção não diz quanto era a folga antes da D87 ("39.9xx"). Pela conta, a D87 levou cerca de 80 B a uma base que já estava em uns 39.926 B. Uma linha registrando essa margem ajudaria a retro a ver a tendência.
