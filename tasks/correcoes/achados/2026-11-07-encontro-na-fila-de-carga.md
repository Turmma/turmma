# Achados das revisões — `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 14:33:38 · `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. A mudança é só no ferramental do processo de desenvolvimento (`tools/processo/linhas.ts`). Nenhuma rota, fila de produção, chamada de IA, migration ou deploy foi alterada.

Rate limit: não se aplica

Fila e prioridade: ok. O `encontro` agora entra na fila de carga da máquina, como o portão e o e2e já faziam.

Concorrência: protegida. As travas são sempre tomadas na mesma ordem: primeiro a fila de carga, depois a trava do quadro. Nenhum dono da fila (`portao-local.ts`, `tools/ci/e2e.ts`) pega a trava do quadro, então as duas travas não se bloqueiam uma à outra. O teste novo prova duas coisas enquanto o `encontro` espera a fila: ele não segura a trava do quadro (`flock -n` na trava do quadro devolve 0) e o prazo da verificação ainda não começou a correr (a espera de 2,2 s é maior que o prazo injetado de 1,5 s).

Índice e paginação: não se aplica

Degradação de IA: não se aplica

Migration: não se aplica

Métrica e alerta: não se aplica

Bloqueantes: nenhum. Rodei os 3 casos tocados em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.test.ts` com `-t "fila de carga|prazo da"`, e os 3 passaram em 2,95 s. Nenhum teste chama provedor pago.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.ts:898`: a espera na fila não tem limite de tempo. Se o e2e de outra linha demorar muito, o `encontro` só imprime "⏳ fila de carga" e espera sem fim. Vale escrever no comentário que isso é de propósito, como no portão, ou dar um teto à espera com uma mensagem que diga o que fazer.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.ts:45-56`: os prazos de 8 e 12 min saíram de uma única medição em 07/11, com carga média de 27. Vale registrar na retro o tempo real das próximas verificações, para confirmar a folga ou voltar a apertar o prazo.
- O processo relançado sob a fila continua segurando a fila enquanto espera a trava do quadro, que pode levar até 15 min. Hoje isso só atrasa o portão de outra linha e não trava nada, mas vale uma linha no comentário de ordem das travas (`linhas.ts:896-897`) dizendo que essa ordem (fila, depois quadro) não pode inverter.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-07 14:34:07 · `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no prazo da verificação. A retro da F2b aceitou 9 min (M1), e a correção pôs 8 min sem dizer por quê.
Portão local: carimbo válido

Bloqueantes:
- **`tools/processo/linhas.ts:55`**: está escrito `PRAZO_DA_VERIFICACAO_MS = 8 * 60 * 1000`. A M1 da retro da F2b diz outra coisa. Ela está em `tasks/prd-semana-do-professor/retro.md:155-163` e em `TODO.md:2803-2806`, e o Joaquim a aceitou em 07/11 ("aprovei a retro"). A M1 manda 3 para 9 min, e não 8. O motivo dela é que "com 540 s, a verificação da `e2e-conflito-do-gerar` passou com carga 25". A M1 também pede a mesma mudança desta correção: o prazo com `npm ci` de 6 para 12 min, o comentário do porquê e o caso de `linhas.test.ts` que fixa os padrões.
  - O documento da correção (`tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`) não cita a M1. Ele escolhe 8 min a partir de uma única medida, 480 s em 07/11. É uma divergência decidida em silêncio contra o que a pessoa aceitou.
  - O item `(F2b, retro, M1)` continua aberto no `TODO.md`. Do jeito que está, alguém vai abrir outra correção depois só para trocar 8 por 9, e esse é o trabalho repetido que a M1 queria acabar.
  - **Correção exigida, uma das duas:**
    - Seguir a M1: 9 min em `linhas.ts:55`, e ajustar no teste o caso dos padrões (`linhas.test.ts:1413-1414`), os textos "480 s" (`:1098`, `:1126`, `:1197`) e o bloco de mutação do documento.
    - Ou manter 8 min, registrar no documento da correção por que fica abaixo da M1 aceita e levar a escolha ao Orquestrador para a palavra do Joaquim.
  - Nos dois casos, o item M1 do `TODO.md:2803` precisa sair como feito por esta correção, para não ficar uma segunda correção pendente sobre o mesmo prazo.

Recomendações:
- **Comentário velho em `tools/ci/fila-de-carga.ts:5-6`**: ele ainda diz que só o `portao-local.ts` e o `tools/ci/e2e.ts` chamam `garantirFilaDeCarga()`. Agora o `linhas.ts encontro` também chama. Vale incluir o encontro na lista.
- **Teste novo que depende de tempo (`linhas.test.ts:1381-1411`)**: o caso espera 2,2 s com o prazo de 1,5 s. Com a máquina carregada, o encontro sem a fila pode não terminar dentro desses 2,2 s. Aí o `jaSaiu()` continua `false` e a mutação da chamada sobrevive por acaso. A prova mais forte de que o encontro está parado na fila é a verificação não ter rodado: o arquivo-sinal `chegou` não existe e a trava do quadro está livre. Esse caso pode ser registrado para o `test-engineer`.
- **Fila antes de conferir os argumentos (`linhas.ts:898`)**: `encontro` com argumento inválido também espera a fila antes de recusar. A validação dos argumentos podia vir antes da fila. É um custo pequeno.

Pelo funcionamento, a mudança está certa. O encontro pega a fila antes da trava do quadro e só depois começa a contar o prazo. Todos os encontros pegam a fila e depois a trava, nessa ordem, e nenhum comando que segura a trava espera a fila, então não há impasse. O prazo da trava (15 min) continua maior que 12 min mais os 5 s até o SIGKILL. A reprovação vem só da divergência com a M1 e do item que ficou aberto no `TODO.md`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-07 14:34:37 · `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

VEREDITO: APROVADO

**Cenários exigidos**
- **Caminho feliz:** a fila está ocupada, o encontro espera, a fila é liberada e o encontro termina com a spec avançada.
- **Borda 1:** a verificação não pode nascer vencida, porque o prazo só corre depois da fila. Para provar isso, o prazo injetado (1,5 s) é menor que a espera (2,2 s).
- **Borda 2:** quem espera a fila não segura a trava do quadro, e as outras linhas não ficam paradas.
- **Borda 3:** o encontro rodado dentro de um `flock` digitado, como o texto antigo das skills manda, não trava de novo.
- **Borda 4:** com `CI=true` não há fila.
- **Os prazos novos:** 8 min, 12 min com `npm ci`, e a trava de 15 min acima disso mais o SIGKILL.
- **Concorrência:** o encontro e o portão de outra linha rodando ao mesmo tempo, com dois processos de verdade.
- **Permissão e isolamento entre escolas:** não se aplicam. É ferramenta de processo e não toca dado de escola.

**Cobertos**
- **"o encontro espera a vez na fila de carga, sem segurar o quadro, e o prazo da verificação só corre depois dela"** (`tools/processo/linhas.test.ts`, perto da linha 1381). Cobre o caminho feliz, a borda 1 e a borda 2, com processos reais: um `flock` como dono da fila e o CLI como processo filho.
  - A conferência da trava do quadro com `flock -n` vale, porque a trava é mesmo um `flock` (`linhas.ts:394`).
  - A asserção final `toContain('fila de carga')` derruba a mutação 1 em qualquer carga da máquina.
- **Bordas 3 e 4:** já estão provadas em `tools/ci/fila-de-carga.test.ts`, nos casos "quem já veio dentro de um `flock` digitado…" e "na esteira (CI=true)…". A função `garantirFilaDeCarga` não mudou.
- **Prazos:**
  - "o prazo da verificação é de 8 min, ou 12 com o npm ci…"
  - "o prazo da trava é o de 15 min…"
  - "lock alterado pela spec… 12 min… 8"
  - os textos de 480 s e 720 s nos casos do RF3
- **Mutações contra o `git diff`:** são três cláusulas novas, e as três têm bloco.
  - a chamada no CLI (bloco 1)
  - as três constantes (blocos 2, 3 e 4)
  - o `import` sozinho não tem comportamento
- **Os casos rodam verdes.** Rodei os 4 casos: verdes em 3,3 s, dentro do `timeout: 30_000` do describe.
- **Proibidos:** não há `.skip`, teste comentado nem mock da fila. A fila é um `flock` real, com um arquivo próprio passado em `EDUCA_FILA_DE_CARGA`.
- **Helper `rodar`:** o `CI=true` nos outros casos não esconde regra nenhuma. Esses casos provam o quadro e não a fila, e assim não dependem da fila real que o portão segura.

**Bloqueantes:** nenhum.

**Recomendações**
1. **A linha `falha:` do bloco 1 depende da carga da máquina** (`tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md:53`).
   - Com a máquina carregada, o encontro mutado pode levar mais de 2,2 s.
   - Nesse caso o primeiro vermelho cai em `existsSync(chegou)` ou no `flock -n` do quadro, e não em `jaSaiu()`. O `mutacoes.ts` recusaria a mutação com o motivo "vermelho em outra asserção" (`mutacoes.ts:335`), embora o caso caia pela razão certa.
   - O portão já provou a mutação. O risco aparece só se o portão for rodado de novo sob carga, que é justamente o cenário desta correção.
   - Correção sugerida: tirar a linha `falha:` do bloco 1 (ela é opcional), ou apontá-la para uma asserção que caia em qualquer velocidade.
2. **O prazo de 1,5 s injetado no teste** cobre só o `: > chegou` dentro do `rodarEmGrupo` (`linhas.ts:730`). Na prática não falha, mas com carga 27 o `spawn` de `sh` com grupo próprio tem pouca folga. Subir para 2 s mantém a prova, porque continua menor que a espera, e a espera pode ir para 3 s.
3. **Operacional, para o `infra-guardian` e o `revisor-geral`:** o encontro agora soma a espera da fila (o portão inteiro de outra linha) com até 8 ou 12 min de verificação. Isso pode passar do teto de 10 min de um comando Bash em primeiro plano do Orquestrador. Vale uma linha no `6-tarefa.md`, ou no aviso do próprio comando, dizendo para rodá-lo em segundo plano ou com o timeout máximo.
4. **Faltou dizer no documento** que o caso "o encontro dentro de um `flock` digitado" já está coberto pelo `fila-de-carga.test.ts`, já que o `6-tarefa.md` continua sem a frase da fila.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.ts` (lido para conferir a função, não mudou)

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 14:42:50 · `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (é ferramenta de processo de desenvolvimento, `tools/processo/linhas.ts` e `tools/ci/fila-de-carga.ts`, e não roda em produção)
Rate limit: não se aplica
Fila e prioridade: ok. O comentário em `tools/processo/linhas.ts:897-899` agora registra a recomendação da 1ª rodada: a espera na fila não tem limite, de propósito, e a ordem fila → quadro não pode inverter. O topo de `tools/ci/fila-de-carga.ts` também passa a listar o encontro entre quem chama a fila.
Concorrência: protegida. A ordem fila → quadro continua igual. `PRAZO_DA_TRAVA_MS` (15 min) segue maior que o prazo com `npm ci` (12 min) somado aos 5 s até o SIGKILL, e o teste em `tools/processo/linhas.test.ts:1416` ainda confere isso.
Índice e paginação: não se aplica
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: não se aplica
Bloqueantes: nenhum. A 1ª rodada não exigiu correções. O diff desde ela traz quatro coisas, todas coerentes entre si:
- `PRAZO_DA_VERIFICACAO_MS` passou de 8 para 9 min em `tools/processo/linhas.ts:56`, e o comentário diz o motivo.
- Os testes em `tools/processo/linhas.test.ts` acompanham a mudança: as mensagens passam de 480 para 540 s e o caso dos padrões passa a 9 × 60_000.
- No caso da fila, o prazo injetado (2 s) continua menor que a espera (3 s), então o teste ainda prova que o relógio não corre enquanto o encontro espera a fila.
- Os blocos de mutação da tarefa foram atualizados para a constante nova.
Recomendações:
- O item novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`, parte (b), já registra que a espera da fila somada aos 9 ou 12 min de verificação pode passar do teto de 10 min de um comando Bash em primeiro plano. Ele deve ser tratado antes de a próxima linha rodar o `encontro` com a máquina carregada: rodar em segundo plano ou fazer o próprio comando avisar.
- A mutação que tira a chamada da fila ficou sem `falha:` fixa, porque o teste pode quebrar em qualquer uma de três asserções. Isso é aceitável. Se o hook de mutação passar a exigir o campo, use a asserção sobre a trava do quadro (`flock -n`), que é a de mais intenção.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 14:42:51 · `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção segue a M1 da retro da F2b, que o Joaquim aceitou em 07/11 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-semana-do-professor/retro.md:155-163`), e agora a cita.
Portão local: carimbo válido ("portão local válido para o código atual", com typecheck, lint, segredo, dependencias, unidade e alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita pela opção (a):
- O prazo da verificação passou para 9 min em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.ts:56`, e o comentário traz o porquê pedido pela M1: três linhas dividem 12 núcleos, e com 540 s a verificação passou na carga 25.
- No teste, os três textos "480 s" viraram "540 s" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.test.ts:1098`, `:1126` e `:1197`). O caso dos padrões, em `:1413-1414`, agora pede 9 min, e o bloco de mutação do documento acompanha.
- Não sobrou nenhum "480" nem "8 min" em `linhas.ts`, `linhas.test.ts` ou `fila-de-carga.ts`.
- O item `(F2b, retro, M1)` do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md` está marcado como feito por esta correção.
- O bloco de mutação da chamada da fila não traz mais `falha:`. O campo é opcional em `tools/processo/mutacoes.ts:33`, e o documento explica por quê: a falha cai em uma de três asserções, conforme a velocidade da máquina.

As quatro recomendações que a ordem mandou aplicar estão no diff:
- O comentário do topo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.ts` agora lista o encontro entre quem chama a fila.
- O teste do encontro na fila ganhou folga: prazo injetado de 2 s contra espera de 3 s.
- Os comentários da chamada em `linhas.ts:899-901` explicam a espera sem limite e por que a ordem fila e depois quadro não pode inverter. Conferi com `pegarTrava` (`linhas.ts:414` e `:535`) e a explicação bate com o código.
- O documento ganhou a nota sobre o `6-tarefa.md`, apontando o caso que cobre a mesma borda em `tools/ci/fila-de-carga.test.ts`.

As duas recomendações que ficaram de fora têm item próprio no `TODO.md`.

Recomendações:
- O item novo do `TODO.md` traz o aviso (b): agora o encontro soma a espera na fila com até 9 ou 12 min de verificação, e pode passar dos 10 min que um comando Bash do Orquestrador tem em primeiro plano. Na prática isso vai acontecer na próxima vez que duas linhas rodarem juntas. Vale fazer essa correção logo em seguida, e não deixar na fila do `TODO.md`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 14:43:16 · `tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`

VEREDITO: APROVADO

Cenários exigidos:
1. Com a fila de carga ocupada por outra linha, o encontro espera. Enquanto espera, não começa a verificação, não segura a trava do quadro e o prazo não corre.
2. A fila é liberada e o encontro termina com a spec avançada.
3. O prazo da verificação é de 9 min, e de 12 min com `npm ci`.
4. O prazo da trava (15 min) fica acima do prazo com `npm ci` somado ao SIGKILL.
5. O comando que já roda dentro de um `flock` digitado não espera pelo lugar que já tem.
6. A ordem fila e depois quadro não se inverte.

Cobertos:
- 1 e 2: `tools/processo/linhas.test.ts:1381`, "o encontro espera a vez na fila de carga, sem segurar o quadro, e o prazo da verificação só corre depois dela". Agora o prazo injetado é de 2 s e a espera é de 3 s. Como o prazo é menor que a espera, o caso continua mostrando que o relógio não corre na fila. A espera maior deixa a mutação menos sujeita a escapar quando a máquina está lenta.
- 3 e 4: `tools/processo/linhas.test.ts:1413` fixa `[9 * 60_000, 12 * 60_000, 5_000]` e a desigualdade com `PRAZO_DA_TRAVA_MS`. O caso de `tools/processo/linhas.test.ts:1421` fixa os 15 min da trava.
- Os blocos de mutação do documento acompanham a constante nova: o bloco sai de `9 * 60 * 1000` e vai a `3 * 60 * 1000`, e cita o teste pelo nome novo.
- As três asserções "com prazo de 540 s" (`tools/processo/linhas.test.ts:1098`, `:1126`, `:1197`) seguem a constante.
- 5: coberto em `tools/ci/fila-de-carga.test.ts`, no caso "herda o lugar, e não espera por ele", como o documento agora cita.
- 6: garantido pelo comentário em `tools/processo/linhas.ts:899-901` e pela própria asserção do `flock -n` sobre a trava do quadro durante a espera (`tools/processo/linhas.test.ts:1402`). Se a ordem se invertesse, essa asserção ficaria vermelha.
- Rodei `npx vitest run tools/processo/linhas.test.ts -t "prazo"`: 8 casos passaram, entre eles o caso da fila e os dois de prazo.
- Não sobrou nenhuma referência a "480 s" nem a 8 min em `tools/processo`. As que aparecem em `tools/ci/duracao-do-e2e*` não têm relação com esta correção.

As três recomendações da 1ª rodada foram feitas:
- O bloco de mutação da fila saiu sem `falha:`. O motivo está escrito na linha 32 do documento: o vermelho pode cair em qualquer uma das três asserções, e todas são a razão certa.
- O prazo injetado passou a 2 s e a espera a 3 s.
- O documento agora diz que a borda do `flock` digitado está coberta em `tools/ci/fila-de-carga.test.ts`.

Bloqueantes: nenhum.

Recomendações:
- Os 3 s de espera no caso da fila ainda dependem do relógio de parede. Numa máquina muito carregada, o processo do encontro com a mutação aplicada pode não ter chegado à verificação em 3 s, e então a mutação passaria sem ficar vermelha. Não bloqueia, porque o portão já provou a mutação. Se um dia ela escapar, o conserto é o teste esperar até o processo anunciar "fila de carga" na saída, e só então medir.
- Os dois ajustes de CLI que o `TODO.md` registrou (validar os argumentos antes da fila, e a espera somada que pode passar do teto de 10 min do Bash) estão anotados para correção própria. Não fazem parte desta.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-encontro-na-fila-de-carga.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/linhas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`
