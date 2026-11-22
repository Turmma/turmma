# Estado da execução — reserva-e-avaliacao

## Agora
- **Espero:** L1 a 1.0 (grande, 1ª tentativa, partida 22/11 12:19); L2 a 10.0 (parada em DIVERGÊNCIA de desenho, 22/11 12:20: 10.1 e 10.2 pedem subagente em contexto limpo, que o Implementador não tem; triagem pedida ao `Arquiteto`, reiniciado na L2; partida 22/11 12:19). Sem objeção até 12:11; na caixa do `Arquiteto` havia "aprovo, não cortar" digitado e não enviado, que não conta: a pergunta do corte segue aberta.
- **Devo ainda:** a última tarefa (a 13.0 da F5) depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10); o gasto da avaliação, aceito, só acontece nela. A `develop` local tem as retros da F4b e da F5a sem push: vão no próximo pouso.
- **Base:** `spec/reserva-e-avaliacao` em `8fd6b2ad`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|

## Esperando o Joaquim
## 22/11 11:41 — F5b, o tamanho da spec, no meu terminal
Decisão: 14 tarefas, acima do teto de 12: uma spec só ou cortar em reserva (1.0 a 9.0) e avaliação (10.0 a 14.0).
Contexto: `tasks.md`, "Corte possível"; o `RELATÓRIO` do `Arquiteto` das 11:41.
Opções: uma spec só | cortar. Recomendo (do `Arquiteto` e meu): uma spec só. A reserva não atende nada em produção até a 14.0 gravar `MODELOS_APROVADOS`, as duas metades correm em paralelo, e a F5b só fecha com a avaliação (D37).
Segue sem depender: a 1.0 e a 10.0, que estão nas duas opções.
## 22/11 ~10:1x — F5b, revisão da spec, no terminal do `Arquiteto`
Decisão: quatro perguntas da avaliação dos modelos (D55, Rigor, Cobertura, Lotes), que mudam o RF13 e o RF14 ou fixam limiar; a 1ª vem do veto do `conformidade-reviewer` (a avaliação não mede se o modelo recusa corrigir texto de aluno). Os achados da reserva já estão corrigidos na Tech Spec e no `cenarios.md`.
**Respondida em 22/11 (antes das 10:48):** as quatro decisões entraram no RF13, no RF14 e no anexo `avaliacao.md` (`319cb0a1`). Aviso do `Arquiteto`: a avaliação passou a ~2.100 chamadas, R$ 150 a R$ 250 por finalista (estimativa), acima dos R$ 80 a R$ 130 aceitos na pergunta; levado ao Joaquim às 10:48. **Aceito em 22/11 11:08** ("ta bom, pode seguir"); o gasto só acontece na 5.0, com as chaves dele.
## 22/11 10:01 — retro da F5a, no terminal do `Arquiteto 2`
Decisão: as confirmações M1 a M4 da retro (`tasks/prd-camada-ia/retro.md`, térreo, sem commit). Responde-se "aprovo" ou os números recusados, no terminal do `Arquiteto 2`.
**Respondida às 11:18: "aprovo".** Retro `06b192d5` na `develop`; M3 e M4 por correção (`TODO.md`, "Da retrospectiva da F5a"), a M4 quando houver linha ociosa.
## O que falhou
- 22/11 09:4x, pouso da F5a: o `maestri floor land` não respondeu (timeout de 10 s, duas vezes, `develop` intacta). Pousado com `git merge --ff-only spec/camada-ia` no térreo e push (`56779010`). O `floor delete` dos quatro andares deu timeout ou "malformed floorLifecycleVerdictResult frame", mas apagou; as branches locais `spec/camada-ia` e `--l3` saíram com `git branch -d`. Para a retro da F5a.
## O que decidi sem perguntar
- 22/11 12:19: o Maestri do Windows não lê as pastas do WSL ("not a git repository", "couldn't look through everything"), o mesmo do `land` das 09:4x. Os checkouts das linhas 1 e 2 saíram por `git worktree add`, sem andar no Maestri (o `linhas.ts` só precisa do checkout); os pares reiniciaram com o conserto das pastas velhas vazias (`speccamada-ia--l1` e `--l2`). Depois do pouso, `git worktree remove` em vez de `floor delete`.
- 22/11 09:49: abri a F5b e a retro da F5a com a esteira da `develop` ainda rodando, porque o Joaquim mandou seguir ("pode seguir com a F5b e a retro"). Vermelha, a correção vai para um andar próprio, e a F5b não tem código até as tarefas.
