## 6. O ciclo de uma tarefa

Quem diz o que cada linha faz é o quadro, não você. O par de uma linha é `Implementador` e `Mesa` (a linha 1) ou
`Implementador <n>` e `Mesa <n>` (2 e 3), e o papel vem de `.claude/agents/`, nunca de responsabilidade
do Maestri:

| Terminal | Comando (`--command`) |
|---|---|
| Implementador | `claude --dangerously-skip-permissions --agent implementador --model sonnet --effort high` |
| Mesa | `claude --dangerously-skip-permissions --agent mesa-de-revisao --effort high` |

1. **Quadro.** `(cd <andar> && node tools/processo/linhas.ts)` mostra cada linha, o que **parte
   agora** e se cabe abrir outra. Abra a que ele pedir (abaixo; na primeira tarefa, a 1) e rode de
   novo. "NENHUMA TAREFA LIBERADA": pare e reporte. Sem nada a partir, encerre o turno: o relatório
   de quem corre o acorda.

   **Abrir a linha `<n>`** (o teto é 3):

   ```bash
   git -C <andar> branch spec/<func>--l<n> spec/<func>
   maestri floor create "<id> <funcionalidade> L<n>" --branch spec/<func>--l<n> --existing-branch
   maestri floor list                                   # anote o caminho do checkout da linha
   (cd <andar> && node tools/processo/linhas.ts abrir <n> <checkout da linha>)
   # as três linhas abaixo: só nas linhas 2 e 3, e só na primeira vez
   maestri recruit "Implementador <n>" --dir "<checkout da linha>" --command "<comando da tabela>"
   maestri recruit "Mesa <n>" --dir "<checkout da linha>" --command "<comando da tabela>"
   maestri connect "Implementador <n>" "Mesa <n>"
   ```

   No andar da spec ninguém implementa: o `Arquiteto` vê a tarefa em curso no checkout da linha dela.
2. **Partida**, para cada linha que parte: `(cd <andar> && node tools/processo/linhas.ts partida <n> <N>)`.
   Ela recusa a tarefa que não corre junto com as em curso.
3. **Porte e diário.** O Implementador roda em Sonnet em toda tarefa. O porte do documento
   (`**Porte:**`; sem a linha, o inferido que o `estado.ts` mostra) diz quanto ela deve levar, que é
   o que a vigia usa. No `estado.md` do andar, a seção "Agora" tem três linhas, **Espero** (o relatório
   de cada linha e em que tentativa a tarefa está), **Devo ainda** (o que ficou combinado e não está
   feito) e **Base** (`spec/<func>` em `<hash>`); em "Concluídas", a tarefa que acabou de se encontrar.
4. **Sessões novas.** Reinicie o par da linha, apontado para o **checkout da linha**.

   ```bash
   maestri recruit --replace "<Implementador [n]>" --command "<comando da tabela>" --dir "<checkout da linha>"
   maestri recruit --replace "<Mesa [n]>" --command "<comando da tabela>" --dir "<checkout da linha>"
   maestri check "<Implementador [n]>" ; maestri check "<Mesa [n]>"
   ```

   **Confira o cabeçalho de cada um**: o modelo esperado, o `@papel` e o caminho do checkout da
   linha, sem `.maestri/roles` (fora da raiz nenhum hook dispara). Não bate: reinicie. Depois:
   `maestri floor status "tarefa N.0" --progress <feitas>/<total> --floor "<andar>"`.
5. **Peça**, ao Implementador da linha:

   ```
   PEDIDO de <seu nome>
   Tarefa: tasks/prd-<func>/<N>_task.md
   Mesa de revisão: <a Mesa da linha> · Orquestrador: <seu nome>
   Ao terminar, envie a <seu nome>: /seguir RELATÓRIO de <o Implementador da linha> …
   Observação: <só se houver: achado de execução anterior, decisão do Arquiteto>
   ```

   Tarefa retomada (o quadro já a mostra na linha, sem partida nova): a primeira linha é
   `PEDIDO de retomada`, e a observação diz o ponto ("o `test-engineer` reprovou na 1ª rodada; a ordem
   está em `.processo/ordens/…`").

   Depois, um `maestri check`, uma vez: o pedido tem de aparecer enviado, com ele trabalhando. Texto parado
   na caixa: envie o Enter (`maestri ask "<terminal>" --raw "\n"`).
6. **Limpe o seu contexto e encerre o turno.** Com o pedido da última partida enviado e conferido,
   tudo o que você sabia já está no `estado.md` e no quadro. A rotina `Limpa o Orquestrador` digita o
   `/clear` e pula o disparo se o seu terminal estiver ocupado. O comando é o **último do turno**, num
   Bash comum; depois você encerra o turno em uma linha:

   ```bash
   d="$(git rev-parse --git-common-dir)/../.processo" && mkdir -p "$d" && date -u +'{"pedida":"%FT%TZ"}' >"$d/limpeza.json"; nohup setsid sh -c 'sleep 25; maestri routine run "Limpa o Orquestrador"' >/dev/null 2>&1 &
   ```

   Não limpe em `PEDIDO de retomada` nem em
   correção no meio de uma tarefa, nem com um pedido por conferir, nem no turno em que você pergunta
   ao Joaquim.

### O que pode chegar

- **`RELATÓRIO` com `STATUS: SUCESSO`**, da linha `<n>`. Rode o encontro, que confere e junta:
  `(cd <andar> && node tools/processo/linhas.ts encontro <n>)`. Ele confere a marca e a linha
  `Revisões:` dos commits novos com código e a árvore limpa, traz a spec para a linha, **verifica
  a soma** (tipagem e lint), avança a spec e faz o push. Pela saída:
  - **feito:** rode `(cd <andar> && node tools/processo/esteira.ts)`. O push dispara
    a esteira sobre a soma das linhas, e ninguém espera por ela (D79): aqui você lê o
    veredito dos pushes anteriores. `VERMELHA`: correção (`corrigir`) numa linha ociosa, com
    `partida <n> correcao:<slug>`, **antes** de qualquer partida de tarefa, e o documento dela diz
    de qual tarefa foi. Volte ao item 1;
  - **`RECUSADO`** (código 1): é falha, mesmo com o relatório dizendo sucesso. Diga ao Implementador
    da linha o que a saída diz, num `PEDIDO de retomada`; se ele não resolver, trate como
    `STATUS: FALHA`;
  - **`O PUSH FALHOU`** (código 3): `git -C <andar> push origin spec/<func>`;
  - **`CONFLITO`** (código 4): duas linhas mexeram no mesmo arquivo, e nada mudou;
  - **`VERIFICAÇÃO RECUSADA`** (código 5): a soma da linha com a spec não passa na tipagem ou no
    lint, passou do prazo ou o encontro foi interrompido. A saída diz que a linha **voltou** ao
    commit de antes do merge e que a spec não andou nem houve push; se ela disser "A LINHA NÃO
    VOLTOU", o `git reset --hard <commit>` que ela dá vem antes de qualquer outro comando.

  `CONFLITO` e `VERIFICAÇÃO RECUSADA` pedem a mesma coisa: é correção na própria linha (passo 10),
  com o slug que a saída dá. O Implementador da linha traz a spec (`git merge spec/<func>`), resolve
  ou conserta o que quebrou, passa o portão e a Mesa, e fecha o merge com o commit da correção.
  Depois, o encontro de novo. Registre em "O que falhou".
- **Resposta a um `PEDIDO de estado`.** Não chega como mensagem: lê-se na saída do `maestri ask` ou no `maestri check`. Só registre; não é relatório de conclusão.
- **`RELATÓRIO` com `STATUS: FALHA`.** Defeito fora da tarefa: correção antes de retomar (abaixo).
  Senão, a cada falha o Implementador volta com **mais contexto**:
  - *primeira falha:* reinicie-o e envie um `PEDIDO de retomada` com o teste, o erro e o que já foi tentado;
  - *segunda falha:* peça o **diagnóstico** (abaixo), apontando os dois relatórios;
  - *terceira falha:* parada (passo 7).
- **`ESCALADA` da Mesa** (duas reprovações seguidas do mesmo revisor): o Implementador já tentou duas
  vezes a partir da ordem. Antes da terceira, peça o **diagnóstico**, apontando a ordem e os achados.
  Registre no `estado.md`.
- **O diagnóstico:** reinicie o `Arquiteto` no andar e peça a seção "Diagnóstico" de
  `.claude/agents/arquiteto.md`. Com a resposta, um `PEDIDO de retomada` ao Implementador apontando
  `.processo/ordens/diagnostico-<N>.md` (e a ordem da Mesa, na escalada).
- **`BLOQUEIO` da Mesa** (três). Parada (passo 7).
- **Linha presa** (tarefa replanejada, papel morto): `(cd <andar> && node tools/processo/linhas.ts abandonar <n>)` solta a
  linha, e a tarefa volta a pendente; a branch e o checkout ficam, e a próxima partida exige a árvore limpa e nenhum commit que
  a spec não tenha. Abertura que morreu: o comando tira a linha do quadro, e você reabre com `abrir`.
- **`DIVERGÊNCIA`**, com a linha `Motivo:`:
  - `desenho` ou `ordem`: reinicie o `Arquiteto` no checkout da linha da tarefa (sem linhas, no andar;
    edição sem commit no andar recusa o encontro de outra linha) e envie um `PEDIDO` de triagem com o
    documento e a seção. A resposta dele volta ao Implementador como observação de um
    `PEDIDO de retomada`, ou vira parada, se ele devolver `BLOQUEIO`;
  - `portão`: o portão local falha por algo fora dos arquivos da tarefa. É correção (`corrigir`) na
    mesma linha, pelo Implementador dela reiniciado, **antes** de retomar a tarefa. O trabalho da
    tarefa fica na árvore, e por isso o `PEDIDO` da correção (passo 10) leva a linha
    `Arquivos da tarefa em curso: <a saída de git status --short de agora>`: a Mesa os deixa fora da
    revisão, e o commit da correção leva só os arquivos dela. Ela não tem encontro próprio: o
    commit fica na linha e segue com o da tarefa. Registre em "O que decidi sem perguntar". Vale também
    quando a causa é a máquina (relógio, Docker, lentidão): o remédio é o teste não depender dela, e
    não esperar o Joaquim (passo 7, "Máquina não é parada").

**Não mande uma linha esperar a outra com
laço de `pgrep`**: ele casa com a própria linha de comando e não sai. O andar da spec e o térreo dividem o ambiente 0: um por vez.
