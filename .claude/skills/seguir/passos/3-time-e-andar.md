## 3. O time fixo e o andar

### O time

Quatro terminais **permanentes, no térreo**, ao lado do seu. Eles não são criados nem dispensados
por spec: o Joaquim os vê sempre no mesmo lugar. O que muda a cada tarefa ou fase é a **sessão**
dentro do terminal, reiniciada já apontada para o checkout do andar.

| Terminal | Papel | Comando (`--command`) |
|---|---|---|
| `Arquiteto` | spec, divergência, decisão, retro | `claude --dangerously-skip-permissions --agent arquiteto --effort high` |
| `Implementador` | uma tarefa ou correção | `claude --dangerously-skip-permissions --agent implementador --model sonnet --effort high` |
| `Mesa` | rodadas de revisão | `claude --dangerously-skip-permissions --agent mesa-de-revisao --effort high` |
| `Validador` | validação | `claude --dangerously-skip-permissions --agent validador --effort high` |
| `Arquiteto 2` | a retro, ao lado do PRD da spec seguinte (D86, passo 8) | o do `Arquiteto` |

O `Arquiteto 2` é o quinto: recrutado no térreo na primeira retro que corre ao lado de uma spec, fica no lugar dele,
parado entre uma retro e a próxima.

O papel vem de `.claude/agents/`, **nunca de responsabilidade do Maestri** (`protocolo.md`, item 1). O que o time é, os
revisores, o hook do commit e a lista das skills estão em `.claude/skills/seguir/time.md`: leia-o ao montar o time.

Terminal que falta no `maestri list` (primeira vez, ou alguém o fechou). **Na primeira vez, crie o
andar antes** (abaixo) e recrute os quatro apontados para o checkout dele, cada um com o comando da
tabela:

```bash
maestri recruit "<Terminal>" --dir "<checkout>" --command "<comando da tabela>"
maestri connect "Implementador" "Mesa"      # uma vez; o Validador não se liga a ninguém além de você
```

**Reiniciar a sessão** no mesmo terminal, que mantém a caixa, a posição e as ligações:

```bash
maestri recruit --command "<comando da tabela>" --replace "<Terminal>" --dir "<checkout>"
maestri check "<Terminal>"
```

**Confira o cabeçalho depois de todo reinício**: o modelo esperado, o `@papel` e o caminho do
checkout certo, sem `.maestri/roles`. Terminal apontado para o lugar errado editaria o checkout
errado; fora da raiz, nenhum hook dispara. Se o cabeçalho não bate, reinicie de novo.

Quando reiniciar: o `Implementador` e a `Mesa`, a cada tarefa e a cada correção ; o `Arquiteto` e o `Arquiteto 2`, a cada pedido; o `Validador`, **sempre** antes
de validar ou revalidar, porque ele precisa chegar sem nada da rodada anterior. Terminal que não é
da fase fica parado, e não gasta nada.

**Uma spec ou uma correção avulsa por vez.**

### O andar

**Um andar por spec** (D78): nome `<id> <funcionalidade>` (`F3 lgpd-e-titular`), branch
`spec/<funcionalidade>`. O andar é só o checkout isolado: não tem terminais próprios. Se não existe:

```bash
git status -sb                 # o térreo precisa estar na develop e limpo; se não está, pare e pergunte
git fetch origin develop       # a develop do GitHub andou? traga-a antes de abrir o andar (passo 8, "Pousar")
maestri floor create "<id> <funcionalidade>" --branch spec/<funcionalidade>
maestri floor list            # anote o caminho do checkout
cd <caminho> && rm -f .processo/portao.json .processo/conteudo.json && npm ci
```

Os dois últimos comandos não são opcionais: o Maestri copia o térreo com as dependências quebradas
(sem o `npm ci`, de um minuto, nada roda) e com o carimbo do portão de lá.

Depois, a abertura (passo 4): marque a funcionalidade `[~]` no `ROADMAP.md` do andar, escreva o
`estado.md` e faça o commit de abertura.

### As linhas

A construção corre em **linhas** (D79): cada uma é um andar com a branch `spec/<func>--l<n>`, o
ambiente de teste `n` e um par de terminais. A linha 1 usa o `Implementador` e a `Mesa`; as linhas 2
e 3, `Implementador <n>` e `Mesa <n>`, recrutados e ligados entre si como acima na primeira vez, e
que ficam. Quantas abrir quem diz é o quadro (passo 6): sem tarefa autorizada em paralelo no
`tasks.md`, é só a 1. O teto é 3, o de ambientes de teste da máquina.

```bash
git -C <andar> branch spec/<func>--l<n> spec/<func>
maestri floor create "<id> <funcionalidade> L<n>" --branch spec/<func>--l<n> --existing-branch
maestri floor list                                   # anote o caminho do checkout da linha
(cd <andar> && node tools/processo/linhas.ts abrir <n> <checkout da linha>)   # ambiente de teste, carimbo e npm ci
```

No andar da spec ninguém implementa: nele trabalham o `Arquiteto`, o `Validador` e você. Quem
precisa ver uma tarefa em curso (o `Arquiteto`, no diagnóstico e na triagem) é apontado para o
checkout da linha dela.
