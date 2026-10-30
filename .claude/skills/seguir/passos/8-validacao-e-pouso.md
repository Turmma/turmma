## 8. Validação, fechamento e pouso

Não há portão completo no fim: a esteira rodou as suítes inteiras a cada push da spec (D79), e a do
último commit de tarefa corre enquanto o Validador trabalha.

**Validar** (`sem-validacao`). Com o quadro dizendo "Todas as tarefas concluídas", faça o commit de
documento "antes da validação" (passo 4). Com `git -C <andar> status --short` vazio, reinicie o `Validador` apontado para o andar e envie o prompt
do passo 2 de `.claude/skills/validar/SKILL.md`. Enquanto ele roda, ninguém usa o ambiente de teste
0, o do andar da spec e do térreo. Ao receber o `RELATÓRIO`, confira que o `validacao.md` existe e que `git status` do andar
mostra só ele.

**Fechar** (`validada`). Siga o passo 3 de `validar/SKILL.md`. O fechamento exige as duas coisas no
mesmo ponto: a validação aprovada sobre o último commit que alterou código, e a esteira verde nele.

```bash
(cd <andar> && node tools/processo/esteira.ts --fechamento)
```

Ainda rodando: espere com o `gh run watch` que a resposta traz, em segundo plano. Vermelha: correção
(`corrigir`) na branch, e o documento dela diz de qual tarefa foi. **Correção depois da validação muda
código que o Validador não viu: valide de novo** (o `Validador` reiniciado, rodada nova no topo do
`validacao.md`), em paralelo com a esteira do commit da correção. A exceção é a correção que só muda `e2e/`, `tasks/` e
o `TODO.md`, sem tirar nem mudar asserção: ela passa pela Mesa e pela esteira, e a próxima rodada do Validador, se houver,
a lê (na X4, as rodadas 5 e 6 validaram de novo um código de produção que não tinha mudado). Sem GitHub (a resposta diz que não
conseguiu ler), o portão completo local vale no lugar: peça ao `Implementador`, reiniciado no andar
da spec, `node tools/processo/portao-local.ts --e2e --infra`, em segundo plano e sem alterar arquivo,
e siga com `node tools/processo/portao-local.ts conferir --completo` respondendo que vale. O merge
da `develop` (abaixo) não pede validação nova, só a esteira.

**O censo do e2e** (RF9). Com a esteira verde no último commit que alterou código, e antes de fechar,
pergunte quantos casos de e2e estão perto do prazo: o runner leva perto do dobro do tempo do portão, e
o caso a mais de dois terços do prazo (20 s de 30 s) é a esteira vermelha de uma spec futura.

```bash
(cd <andar> && node tools/processo/esteira.ts --censo)
```

Sai **0**: nenhum caso passa de dois terços do prazo; siga. Sai **1**: a lista (arquivo, linha, projeto,
segundos e prazo). Separe os casos dos arquivos que a spec alterou (`git -C <andar> diff --name-only develop... -- e2e/`):
para esses, abra uma correção (`corrigir`, passo 10) que encurte ou divida cada caso, com a lista no `PEDIDO`, e valide de
novo como acima. Os outros são dívida da `develop`: uma linha no grupo dela no `TODO.md`, com o número da execução, sem
parada; o que passa de 90% do prazo vai ao topo do grupo (na X4, o Joaquim respondeu isso duas vezes). Sai **2**: não há o que ler (sem execução verde, ou fatia sem
relatório ou com artefato expirado; a saída diz qual e o `gh workflow run` que gera outro): rode de
novo com a esteira nova, e, sem GitHub, registre em "O que falhou" e siga com o portão local.

Tudo verde: `(cd <andar> && node tools/processo/linhas.ts fechar)`, o commit de fechamento (passo 4) e o
pedido de pouso. No commit de fechamento, os achados **menores** do `validacao.md` vão ao `TODO.md`, uma
linha por achado, com dono e data (D79 revista); eles não seguram o pouso. Depois do pouso, desfaça o andar de cada linha (`maestri floor delete "<andar> L<n>"`).

**Pousar** (`aguardando-pouso`). Só com a palavra do Joaquim, e a partir do térreo:

```bash
git fetch origin develop && git status -sb               # a develop local diverge da do GitHub?
git -C <andar> status --short && git status --short      # os dois limpos
maestri floor land "<andar>" --into develop
git push origin develop
gh run watch <id da esteira da develop> --exit-status    # em segundo plano
```

A palavra dele para pousar inclui o push da `develop`. A `develop` local só à frente da do GitHub é
normal: são os commits de decisão e de retrospectiva do Arquiteto, e o push os leva. Se a do GitHub
andou enquanto a spec corria (o Gabriel integra lá): traga-a para o térreo
(`git pull --no-rebase origin develop`), depois para a branch da spec
(`git -C <andar> merge develop`, o único commit seu que leva código), e a esteira do push desse
merge tem de ficar verde antes do pouso. Conflito em qualquer um desses merges, ou no pouso, é parada: diga os arquivos.

**Enquanto existir `tools/renomear/mapas/`** (a spec renomeia por onda, X8), o merge da `develop` na spec pode trazer
nome antigo: arquivo novo, import novo, teste novo escrito com o nome de antes. Esse merge vira uma correção (`corrigir`)
que roda `node tools/renomear/reaplicar.ts` e, quando existirem (são da tarefa 2.0 da X8), `node tools/renomear/conferir.ts` e
`node tools/renomear/restos.ts`; o commit dela diz que veio do merge. Sem a correção, o nome antigo pousa na `develop` junto com a spec.

Esteira da `develop` vermelha depois do pouso: correção em andar próprio (`correcao/<slug>`).
Verde: peça a retrospectiva ao `Arquiteto` e notifique o fim.
