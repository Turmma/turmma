# Estado da execução — nomes-de-mercado

## Agora
- **Espero:** o `RELATÓRIO` da linha 1 (Implementador), tarefa 2.0 (porte grande), 1ª tentativa, partida às 05:03 de 30/10
- **Devo ainda:** (1) pousar a correção `2026-10-29-links-do-runbook` (`d5303ef1`, esteira verde, **espera a palavra do Joaquim**) e trazer a `develop` para a `spec/nomes-de-mercado`: **a 4.0 depende dela** (Tech Spec §5); (2) quando a 5.0 fechar, pedir ao Arquiteto a correção do ouro, de que a 13.0 depende (`travas.md`, "O ouro"); (3) paralelo autorizado: 7.0 com 9.0 e 10.0; 8.0 com 9.0, 10.0 e 11.0; 7.0 e 11.0 não juntas; (4) no fechamento, linhas no `TODO.md`: abrir um `runbook_url` com âncora acentuada depois que o runbook estiver na `main` de `Turmma/turmma` (infra-guardian), e a troca da marca na string `folder: Educa.ia alertas` (`tools/guardas/alerta-tem-runbook.test.ts:14`; fora do inventário pelo RF7, string); (5) pedir ao Arquiteto, ao fechar o U12-10, trocar "13 regras" por 14 em `tasks/prd-reengenharia/diagnostico/U12.md:110`
- **Base:** `spec/nomes-de-mercado` em `06ce92c4`

## Concluídas
- correção `2026-10-30-introducao-da-coordenacao-no-celular` (esteira vermelha em `95234fd`): `ad085a79`, encontro em `06ce92c4` às 05:03 de 30/10. Causa: a `CascaDaEscola` fechava a gaveta quando o `/v1/eu` chegava depois do toque no menu. O Implementador ficou 38 min num laço de `pgrep` que não terminava, destravado pela vigia
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 1.0 | `da6e5462` | Sonnet 5.5 | 2 | 80 mutações vermelhas; rename sem `providePrefixAndSuffixTextForRename` (divergência registrada); `tools/renomear/ast.ts` na CITAM_O_PROTOTIPO; 2 itens no `TODO.md` |

## Esperando o Joaquim
- 29/10: perguntas do PRD, da revisão da spec e das adendas do inventário, no terminal do Arquiteto — **respondidas** (PRD e inventário em `6ea5721b`, Tech Spec `0f9ccff6`, revisão da spec até `5f830f0a`, tarefas `95234fd5`)
- 29/10: pouso da correção `2026-10-29-links-do-runbook` (esteira verde em `d5303ef`, execução 40947197289) — aberta

## O que falhou
- 30/10: esteira vermelha em `95234fd` (só documento de tarefas), execução 40988277250: e2e 6/8, `coordenacao-introducao.spec.ts:201` [celular], elemento não encontrado; a develop estava verde. Correção `2026-10-30-introducao-da-coordenacao-no-celular` na linha 1, antes da 2.0

## O que decidi sem perguntar
