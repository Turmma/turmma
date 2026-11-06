---
name: vigia
description: A rotina de 30 minutos do Orquestrador — olha o estado e os terminais do time e só age se alguém está preso, sumiu ou espera resposta
disable-model-invocation: true
---

Você é o **Orquestrador**, e esta é a vigia. A rotina `Vigia do processo` manda `/vigia` a cada 30 minutos. O filtro que
diz se há o que olhar (`tools/processo/vigia.ts`, D79) já foi o `--pre-run` da rotina, mas no Maestri do Windows o
`--pre-run` não roda (05/11/2026): por isso ele é o seu primeiro passo, e não o da rotina.

**1. O filtro.** No térreo, com o andar ativo (`maestri floor list`, se você não o tem):

```bash
node tools/processo/vigia.ts; (cd <andar> && node tools/processo/linhas.ts | grep '^Partem agora')
```

Se os dois não imprimem nada, alguém do time trabalha dentro do prazo, a limpeza está em dia e nenhuma linha ociosa
tem tarefa que parte: responda "Time trabalhando." e encerre, sem ler mais nada. O filtro conta como trabalho o
portão em segundo plano (`· 1 shell ·` no rodapé), e acorda você quando alguém trabalha há duas horas sem você olhar.

**2. O olhar.** Senão, leia a seção "Agora" do `tasks/prd-<func>/estado.md` do andar, rode o quadro inteiro
(`(cd <andar> && node tools/processo/linhas.ts)`) e `maestri check` em **todos** os terminais da fase, antes de
concluir qualquer coisa. Não releia o que não mudou.

| O que os terminais mostram | O que você faz |
|---|---|
| o filtro acordou por "a limpeza pedida … não aconteceu" (`.processo/limpeza.json`: `pedida` há mais de 10 minutos sem `feita`) | a rotina pulou a limpeza porque você estava ocupado: grave o "Agora" e refaça o comando do `/seguir` (passo 9) no fim do turno, que grava uma `pedida` nova |
| alguém trabalhando, dentro do prazo | nada; responda em uma linha. `Implementador` parado com a `Mesa` dele trabalhando, ou com o portão em segundo plano, é o normal: ele espera a rodada ou o aviso de fim |
| todos parados no prompt, e você espera um relatório há mais de uma vigia | um `PEDIDO de estado` a quem deve o relatório. Não é pedido de trabalho: ele só responde onde está |
| um `Implementador` trabalhando, mas a tarefa pequena passou de 2 horas, ou a grande de 4, sem a primeira rodada de revisão | um `PEDIDO de estado`. Se a resposta mostra tentativa repetida no mesmo teste, ou o portão usado para depurar, peça o diagnóstico ao `Arquiteto` e reinicie o Implementador com `PEDIDO de retomada`, apontando o diagnóstico. Registre no `estado.md` |
| uma pergunta, um menu ou um erro na tela | resolva se for mecânico (`maestri ask --raw`); se for decisão, é parada |
| o terminal sumiu, o processo morreu, ou ele voltou com sessão nova (o Maestri ou o WSL reiniciou) e o "Agora" diz que ele tinha trabalho | recrie ou reinicie e envie `PEDIDO de retomada`: o trabalho está na árvore |
| o Docker não responde (`docker info` falha) | abra-o daqui, sem chamar o Joaquim: `powershell.exe -NoProfile -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"` |
| o "Agora" espera o Joaquim por algo que não é uma das paradas do passo 7: a máquina, o ambiente, um teste que cai sem mudança de código | não é parada. Destrave agora, pela "Máquina não é parada" do passo 7 |
| o `Arquiteto` esperando o Joaquim, ou uma parada do passo 7 aberta | a tarefa que não depende dela segue (passo 7, "A parada segura só o que depende dela"). Se nada segue, a vigia devia estar desligada: desligue-a (`maestri routine disable "Vigia do processo"`) e responda em uma linha |
| "Agora" diz que a construção começa numa hora que já passou, e o Joaquim não escreveu nada no seu terminal nem no do `Arquiteto` | comece a primeira tarefa (`/seguir`, passo 6) |
| linha ociosa, com o quadro dizendo que há tarefa que parte | a partida dela (`/seguir`, passo 6) |

**3. Nunca repita.** Se esta vigia acha a mesma situação da anterior, com todos parados, a resposta de antes não
destravou nada, e repeti-la também não vai destravar. Em 05/11/2026 a vigia escreveu dez vezes "espero o reinício do
WSL", e o time ficou cinco horas parado por um teste que se consertava em minutos. Antes de responder, faça as três
perguntas, nesta ordem:

1. O bloqueio ainda vale? Meça de novo, não confie no "Agora".
2. Há caminho que não passe pelo Joaquim? Consertar daqui, mudar o teste que depende da máquina, contornar.
3. Há tarefa ou correção, em qualquer linha, que não dependa do bloqueio?

O primeiro "sim" é o que você faz agora. Com os três em "não", é parada de verdade: registre pelo passo 7 e desligue
a vigia, para não escrever a mesma coisa de novo.

Nunca interrompa agente que está trabalhando, e nunca edite arquivo que ele está editando.

Para o que a tabela não diz, o procedimento é o do `/seguir`: o comando de cada terminal e o reinício estão no
passo 3 (`.claude/skills/seguir/passos/3-time-e-andar.md`), o que fazer com cada resposta, no passo 6
(`passos/6-tarefa.md`), e a parada, no passo 7 (`passos/7-paradas.md`). Se esse texto não está no seu contexto
(sessão nova, ou compactada desde o último `/seguir`), leia o arquivo antes de agir; não aja de memória.
