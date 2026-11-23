# Estado da execução — reserva-e-avaliacao

## Agora
- **Espero:** L1 e L2 ociosas (nada parte: a 14.0 espera a 9.0); L3 a 9.0 (grande, 1ª tentativa; ESCALADA da Mesa 3 em 23/11 ~00:xx, `test-engineer` reprovou nas rodadas 1 e 2 (ordem `9_task-r2.md`, o bloco de mutação do `.every`), diagnóstico pedido ao `Arquiteto` no checkout da L3, e depois `PEDIDO de retomada` ao Implementador 3 com ele; pedido 22/11 depois do encontro da 7.0, retomada depois da parada, com a carga inteira por refazer; herda da 7.0 o cenário do balde do principal cheio com transbordo). Presa: 14.0 (espera 9.0 e as chaves do Joaquim).
- **Devo ainda:** antes da partida da 14.0, levar ao Joaquim as três perguntas da 13.0 (`TODO.md`, "Da reserva-e-avaliacao, tarefa 13.0"): qual modelo a entrada de `MODELOS_APROVADOS` e a AIA do `padrao` citam, se o segundo modelo tem os mesmos termos de contrato, e o custo do segundo passe frente ao teto de R$ 250. na retro, o item do `tenancy-guardian` da 7.0 (o balde da reserva no item do `TODO.md` sobre a parte por escola do balde); os outros itens da 7.0 já estão no `TODO.md`. Depois do pouso da F5b, a correção da D55 (`achado-d55-recusa-rubrica.md`, decisão do Joaquim 22/11 12:55). A última tarefa (a 14.0) depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10); o gasto da avaliação, aceito, só acontece nela. A `develop` local tem as retros da F4b e da F5a sem push: vão no próximo pouso.
- **Base:** `spec/reserva-e-avaliacao` em `9daf39a7`, no encontro da 13.0 (esteira rodando, execução 45095130134; veredito no próximo encontro)

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 1.0 | `7a4b4e84` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros cinco na 1ª | encontro em `eb3c63ab`; 4 recomendações sem aplicar no `1_task.md`; techspec §5 e `cenarios.md` linha 38 ajustados por 2 divergências |
| 10.0 | `402c6646` | Sonnet | `revisor-geral`, `test-engineer` e `pedagogia-reviewer` na 2ª; os outros quatro na 1ª | encontro em `cde3b286`; DIVERGÊNCIA (ordem) triada pelo `Arquiteto` (itens 6, 7d, 7e, 7f) sem mudar o desenho; 15 itens novos no `TODO.md` |
| 3.0 | `84f9c5ce` | Sonnet | os sete na 2ª | encontro em `459ea284`, verificação da soma passou; sem tela |
| 2.0 | `e6668395` | Sonnet | os sete na 2ª | encontro em `172218e6`, verificação da soma passou; sem tela; caso intermitente de `fila-de-ia.int.test.ts` (prazo do perfil, 3 em 10 no HEAD sem a 2.0) e lacuna "contrato permite serviço usado por menor" no `TODO.md` |
| 11.0 | `6373d9db` | Sonnet | `test-engineer` na 3ª (escalada na 2ª, diagnóstico do `Arquiteto`: regex `semImportDeTipo`); `revisor-geral`, `llm-integrator` e `pedagogia-reviewer` na 2ª; os outros quatro na 1ª | encontro em `2aa1a2f4`, verificação da soma passou; sem tela; DIVERGÊNCIA (ordem, guarda do ponto de entrada) triada como detalhe, techspec §8 e `cenarios.md` §1 no commit |
| 4.0 | `ee23dc4e` | Sonnet | os sete na 2ª | encontro em `82aaf93a`, verificação da soma passou; sem tela; absorveu a 6.1 e a 6.2 (divergência no `4_task.md`); regra 80 item 4 no ramo da queda pendente até a 7.0 |
| 6.0 | `cd317d91` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros cinco na 1ª | encontro em `6ba52a09`, verificação da soma passou; sem tela; sem a 6.1 e a 6.2 (feitas na 4.0); três pontos do balde da reserva empurrados para a 7.0 (`6_task.md`, linhas 109 a 111) |
| 5.0 | `2d07b316` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros cinco na 1ª | encontro em `8213fd22`, verificação da soma passou; sem tela |
| 12.0 | `8e0aa1da` | Sonnet | `revisor-geral` reprovou na 1ª e aprovou na 2ª; os outros cinco aprovaram nas duas | encontro feito, verificação da soma passou; sem tela; 3 itens no `TODO.md` ("Da reserva-e-avaliacao, tarefa 12.0"); o resto das recomendações vai para a 13.0 |
| 13.0 | `ee14f30a` | Sonnet | os sete revisores aprovaram na 2ª rodada | encontro em `9daf39a7`, verificação da soma passou; sem tela; a parada do Joaquim matou o portão e a rodada, refeitos; decisões em `techspec.md` §8, `cenarios.md` e no `13_task.md` |
| 8.0 | `e7ecd449` | Sonnet | `test-engineer` e `revisor-geral` na 2ª; os outros quatro na 1ª | encontro em `598a38e7`, verificação da soma passou; sem tela; o encontro esperou a parada pedida pelo Joaquim (20:50 a 21:4x) |
| 7.0 | `ef3b0650` | Sonnet | os sete revisores aprovaram na 2ª rodada | encontro em `9e09f039`, verificação da soma passou; sem tela; a reserva não espera pela vaga (uma tentativa só), registrado no `7_task.md` e no `cenarios.md`; itens da camada-ia no `TODO.md` |

## Esperando o Joaquim
## 22/11 12:52 — a regra fixa da D55 recusa rubrica legítima, no meu terminal
Decisão: abrir um `/corrigir` depois da F5b para a regra fixa da D55 não recusar rubrica de antes da aplicação (13 de 20 pedidos naturais recusados).
Contexto: `tasks/prd-reserva-e-avaliacao/achado-d55-recusa-rubrica.md` (vai no commit da 10.0); o `TODO.md` já tem "D55 abaixo do alvo" (F7, da X6).
Opções: corrigir depois da F5b | deixar para a F7. Recomendo (do `Arquiteto`): corrigir depois da F5b. Não segura nada agora.
**Respondida em 22/11 12:55: "corrige a D55 depois da F5b".** Depois do pouso da F5b, `/corrigir` a partir do achado.
## 22/11 11:41 — F5b, o tamanho da spec, no meu terminal
Decisão: 14 tarefas, acima do teto de 12: uma spec só ou cortar em reserva (1.0 a 9.0) e avaliação (10.0 a 14.0).
Contexto: `tasks.md`, "Corte possível"; o `RELATÓRIO` do `Arquiteto` das 11:41.
Opções: uma spec só | cortar. Recomendo (do `Arquiteto` e meu): uma spec só. A reserva não atende nada em produção até a 14.0 gravar `MODELOS_APROVADOS`, as duas metades correm em paralelo, e a F5b só fecha com a avaliação (D37).
Segue sem depender: a 1.0 e a 10.0, que estão nas duas opções.
**Respondida em 22/11 12:55: "não cortar".** Uma spec só, com 14 tarefas.
## 22/11 ~10:1x — F5b, revisão da spec, no terminal do `Arquiteto`
Decisão: quatro perguntas da avaliação dos modelos (D55, Rigor, Cobertura, Lotes), que mudam o RF13 e o RF14 ou fixam limiar; a 1ª vem do veto do `conformidade-reviewer` (a avaliação não mede se o modelo recusa corrigir texto de aluno). Os achados da reserva já estão corrigidos na Tech Spec e no `cenarios.md`.
**Respondida em 22/11 (antes das 10:48):** as quatro decisões entraram no RF13, no RF14 e no anexo `avaliacao.md` (`319cb0a1`). Aviso do `Arquiteto`: a avaliação passou a ~2.100 chamadas, R$ 150 a R$ 250 por finalista (estimativa), acima dos R$ 80 a R$ 130 aceitos na pergunta; levado ao Joaquim às 10:48. **Aceito em 22/11 11:08** ("ta bom, pode seguir"); o gasto só acontece na 5.0, com as chaves dele.
## 22/11 10:01 — retro da F5a, no terminal do `Arquiteto 2`
Decisão: as confirmações M1 a M4 da retro (`tasks/prd-camada-ia/retro.md`, térreo, sem commit). Responde-se "aprovo" ou os números recusados, no terminal do `Arquiteto 2`.
**Respondida às 11:18: "aprovo".** Retro `06b192d5` na `develop`; M3 e M4 por correção (`TODO.md`, "Da retrospectiva da F5a"), a M4 quando houver linha ociosa.
## O que falhou
- 22/11 ~22:xx, tarefa 13.0: o Implementador 2 imprimiu no terminal o `contexto.mensagemDoProfessor` de uma amostra de `saidaQualitativa-retido-1.json` (lote retido). Nada gravado, commitado nem enviado; o risco é contaminar o lote retido. Para a retro: inspecionar lote retido só pelas chaves, nunca pelo conteúdo.
- 22/11 09:4x, pouso da F5a: o `maestri floor land` não respondeu (timeout de 10 s, duas vezes, `develop` intacta). Pousado com `git merge --ff-only spec/camada-ia` no térreo e push (`56779010`). O `floor delete` dos quatro andares deu timeout ou "malformed floorLifecycleVerdictResult frame", mas apagou; as branches locais `spec/camada-ia` e `--l3` saíram com `git branch -d`. Para a retro da F5a.
## O que decidi sem perguntar
- 22/11 12:19: o Maestri do Windows não lê as pastas do WSL ("not a git repository", "couldn't look through everything"), o mesmo do `land` das 09:4x. Os checkouts das linhas 1 e 2 saíram por `git worktree add`, sem andar no Maestri (o `linhas.ts` só precisa do checkout); os pares reiniciaram com o conserto das pastas velhas vazias (`speccamada-ia--l1` e `--l2`). Depois do pouso, `git worktree remove` em vez de `floor delete`.
- 22/11 09:49: abri a F5b e a retro da F5a com a esteira da `develop` ainda rodando, porque o Joaquim mandou seguir ("pode seguir com a F5b e a retro"). Vermelha, a correção vai para um andar próprio, e a F5b não tem código até as tarefas.
