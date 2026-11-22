# Estado da execução — reserva-e-avaliacao

## Agora
- **Espero:** o `RELATÓRIO` do `Arquiteto` com a lista de tarefas (fase `sem-tarefas`, pedida em 22/11 11:21). Com ela, aviso e a construção começa 30 min depois (passo 7).
- **Devo ainda:** a última tarefa (a 13.0 da F5) depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10); o gasto da avaliação, aceito, só acontece nela. A `develop` local tem as retros da F4b e da F5a sem push: vão no próximo pouso.
- **Base:** `spec/reserva-e-avaliacao` em `75631d3f` (merge da `develop` com a retro da F5a, `06b192d5`)

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|

## Esperando o Joaquim
## 22/11 ~10:1x — F5b, revisão da spec, no terminal do `Arquiteto`
Decisão: quatro perguntas da avaliação dos modelos (D55, Rigor, Cobertura, Lotes), que mudam o RF13 e o RF14 ou fixam limiar; a 1ª vem do veto do `conformidade-reviewer` (a avaliação não mede se o modelo recusa corrigir texto de aluno). Os achados da reserva já estão corrigidos na Tech Spec e no `cenarios.md`.
**Respondida em 22/11 (antes das 10:48):** as quatro decisões entraram no RF13, no RF14 e no anexo `avaliacao.md` (`319cb0a1`). Aviso do `Arquiteto`: a avaliação passou a ~2.100 chamadas, R$ 150 a R$ 250 por finalista (estimativa), acima dos R$ 80 a R$ 130 aceitos na pergunta; levado ao Joaquim às 10:48. **Aceito em 22/11 11:08** ("ta bom, pode seguir"); o gasto só acontece na 5.0, com as chaves dele.
## 22/11 10:01 — retro da F5a, no terminal do `Arquiteto 2`
Decisão: as confirmações M1 a M4 da retro (`tasks/prd-camada-ia/retro.md`, térreo, sem commit). Responde-se "aprovo" ou os números recusados, no terminal do `Arquiteto 2`.
**Respondida às 11:18: "aprovo".** Retro `06b192d5` na `develop`; M3 e M4 por correção (`TODO.md`, "Da retrospectiva da F5a"), a M4 quando houver linha ociosa.
## O que falhou
- 22/11 09:4x, pouso da F5a: o `maestri floor land` não respondeu (timeout de 10 s, duas vezes, `develop` intacta). Pousado com `git merge --ff-only spec/camada-ia` no térreo e push (`56779010`). O `floor delete` dos quatro andares deu timeout ou "malformed floorLifecycleVerdictResult frame", mas apagou; as branches locais `spec/camada-ia` e `--l3` saíram com `git branch -d`. Para a retro da F5a.
## O que decidi sem perguntar
- 22/11 09:49: abri a F5b e a retro da F5a com a esteira da `develop` ainda rodando, porque o Joaquim mandou seguir ("pode seguir com a F5b e a retro"). Vermelha, a correção vai para um andar próprio, e a F5b não tem código até as tarefas.
