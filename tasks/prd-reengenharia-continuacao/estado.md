# Estado da execução — reengenharia-continuacao

## Agora
- **Espero:** o `RELATÓRIO` do `Implementador` (linha 1, tarefa 12.0, porte pequeno, 1ª tentativa, pedida às 15/11 13:40), do `Implementador 2` (linha 2, correção `2026-11-15-e2e-pedidos-do-titular`, esteira vermelha em `b8280ad`, execução 43736759780, pedida às 15/11 15:35; a 13.0 parte depois dela) e do `Implementador 3` (linha 3, tarefa 1.0, porte grande, 1ª tentativa, pedida às 15/11 12:32).
- **Devo ainda:** as M1 a M4 da retro da F4 ficam no `TODO.md` como correções, sem ordem pedida. Antes de a 5.0 partir, o `Arquiteto` copia para o `5_task.md` as linhas "tarefa 5.0" da tabela "Sem aplicar" do `3_task.md` (alertas.int.test.ts:305, ambiente.test.ts:150, frases de arquitetura.md e infra.md, causa 1 do runbook, casos do privacy-guardian e do conformidade-reviewer). No pedido de pouso, lembrar o Joaquim: `VAGAS_ESCOLA_FERRAMENTA=4` no `.env` da VPS antes do primeiro deploy (o runbook já diz).
- **Base:** `spec/reengenharia-continuacao` em `864a7a93`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| tarefa 3.0 (L2) | `63197b63` | Sonnet | todos aprovaram na 2ª | sem aplicar no documento; 2 linhas no `TODO.md`; pendências da 5.0 ainda fora do `5_task.md` |
| correção `2026-11-15-faltando-termo-a-termo` (F2c retro M1, L1) | `6c5b1a27` | Sonnet | test-engineer, revisor-geral e privacy-guardian na 2ª | divergência triada (detalhe, `LinhaAcrescentada`); recomendações no `TODO.md` |
| correção `2026-11-15-write-sobre-revisoes` (F2c retro M2, L2) | `15ed12a2` | Sonnet | test-engineer e revisor-geral na 2ª | + 3 itens no `TODO.md` (realpath, CRLF, Edit/Bash) |

## Esperando o Joaquim
## 15/11 03:05 — retro da F4, no terminal do `Arquiteto 2`
As propostas M1 a M4 da retro estão na tela dele desde 14/11 15:13; a X6 só gera as tarefas depois do commit da retro.
**Respondida em 15/11 ("aprovo"):** retro em `9970e28b`.
## O que falhou
- 15/11 15:30: esteira vermelha em `b8280ad` (execução 43736759780): dois e2e de `pedidos-do-titular.spec.ts` (209, clique que estoura 90 s; 424, elemento ausente); a anterior, `6bd8f12`, passou. Correção na linha 2 antes da 13.0. O meu primeiro encontro da 3.0 morreu no `timeout 900` que eu pus: nada mudou, e o segundo passou.
## O que decidi sem perguntar
- 15/11: `DIVERGÊNCIA` de desenho na L1 (`faltando-termo-a-termo`, item 1 da r1: `LinhaNova` × mapa 4 e `restos.test.ts`) foi triada pelo `Arquiteto` como detalhe, opção (c): `LinhaAcrescentada` em `mutacoes.ts` e `mutacoes.test.ts`, mapa 4 intocado; X8 techspec §5 anotada. Devolvida ao `Implementador` como retomada.
