# Estado da execução — classificacao-bncc

## Agora
- **Espero:** o `RELATÓRIO` do `Implementador` (linha 1) da tarefa 2.0 (porte grande), 1ª tentativa, pedida em 17/11. A L1 está em `…/educaia--specclassificacao-bncc--l1`, sem andar no Maestri (o `floor create` recusou; worktree feito pelo git).
- **Devo ainda:** quando a 3.0 pousar, pedir ao `Arquiteto` a medida do lote retido (ele escreve e mede entre a 3.0 e a 10.0); a 10.0 só parte com ela, e taxa fora do padrão é decisão do Joaquim. No fechamento, marcar `[x]` o item "(F4, retro, M3)" do `TODO.md`. Push da `develop` (retro da X6, `46ea2309`) no próximo pouso. O `recruit --replace` do Maestri procura a pasta apagada da L1 da X6: `mkdir` dela antes e `rmdir` depois.
- **Base:** `spec/classificacao-bncc` em `c4dddef8`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| correção `2026-11-17-integracao-recusa-workers-de-pe` (M3 da F4, P da retro da X6, L1) | `e1670fbe` | Sonnet | test-engineer na 2ª; os outros cinco na 1ª | módulos novos `tools/testes/workers-de-pe.ts` e o `globalSetup` que recusa; 12 mutações; 2 linhas no `TODO.md`; o item (F4, retro, M3) fica `[ ]` até o fechamento; encontro em `95812d4e` |
| 1.0 | `fb384b1b` | Sonnet | test-engineer na 2ª (e2e do PATCH segurado com troca de disciplina); os outros seis na 1ª | divergência de portão no meio (compose órfão da X6, derrubado); 42 mutações; 8 fotos; recomendações sem aplicar foram ao `TODO.md`; encontro em `c4dddef8`, esteira verde em `95812d4` |

## Esperando o Joaquim
## 17/11 08:55 — retro da X6, no terminal do `Arquiteto 2`
Decisão: as propostas de confirmação M1 a M7 e o P (fazer a M3 da F4 antes das tarefas da F4b; a M4 da F4 com a M7). Os avisos 1 a 4 aplicam às 09:25 sem objeção.
Arquivo: `tasks/prd-reengenharia-continuacao/retro.md` (térreo, sem commit). Responde-se "aprovo" ou os números recusados, no terminal do `Arquiteto 2`.
**Respondida em 17/11 09:54: "aprovo".** Retro em `46ea2309`.
## 17/11 — perguntas da Tech Spec da F4b, no terminal do `Arquiteto`
IA no worker, questão sem classificação, componente, horário. O `Arquiteto` avisa o Joaquim.

## 17/11 — revisão da spec da F4b, no terminal do `Arquiteto`
Decisão: o tamanho (uma spec, teto maior, ou F4c) e quem confere o lote de referência.
**Respondida em 17/11: uma spec só, com teto de 2.800 palavras e 13 tarefas; um professor confere o lote retido antes do primeiro aluno real.**

## O que falhou
## O que decidi sem perguntar
- 17/11: DIVERGÊNCIA (portão) do Implementador na 1.0: workers de pé em `educa-teste-1` eram órfãos da reengenharia-continuacao (pousada, checkout apagado). Não é defeito de código, então sem `corrigir`: derrubei `educa-teste`, `-1`, `-2` e `-3` e mandei retomar.
