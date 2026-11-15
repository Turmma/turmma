# Achados das revisões — `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 12:33:51 · `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Todos com autor humano? Não se aplica, porque nenhum caminho é criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi alterado.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nem a declaração nem a tela de governança foram tocadas.
Bloqueantes: nenhum
Recomendações:
- O gancho só vigia o `Write`. Um `Edit` que apague a seção, ou um `Bash` com `>`, ainda pode tirar do documento a linha de veredito do `conformidade-reviewer`. A tarefa declara esse limite em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-15-write-sobre-revisoes.md`. Para a regra 70 isso só pesa no registro do processo, não na auditoria do produto. Fica para a retro, e quem decide é o `revisor-geral`.

Por que a regra 70 não é afetada:
- A tarefa só mexe em ferramentas do processo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/documento-de-revisao.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-revisoes.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-portao.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.claude/settings.json`, além de marcar o item no `TODO.md`.
- Nenhum arquivo em `apps/` ou `packages/` mudou, e `docs/regulacao.md` também não. O diff não traz nada sobre `Nota`, correção, tutor, agentes, governança, indicador de professor ou discursiva e redação.
- A mudança protege a tabela "Revisões" dos documentos em `tasks/`. É ali que fica registrado o veredito dos revisores com veto, entre eles o `conformidade-reviewer`. Como o `Write` deixa de apagar essas rodadas, a mudança ajuda a guardar o rastro do processo.
- O `hook-revisoes.ts` busca `decidirEscrita` em `revisoes.ts`, e esse arquivo repassa tudo de `documento-de-revisao.ts` (linha 11). Conferi que essa ligação existe; não rodei os testes.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 12:33:56 · `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção de processo, sem seção da techspec. Ela faz o que o item "(F2c, retro, M2)" do `TODO.md` pede: um gancho `PreToolUse` só para o `Write`, o modo `escrita` em `hook-revisoes.ts`, saída 2 com "Edit", e testes para os dois lados e para arquivo novo. Os limites ficam declarados no documento: `Edit` e `Bash` com `>` passam sem o gancho, e o `protocolo.md` não muda por causa do orçamento do RF26.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/documento-de-revisao.ts:138-141`: `linhasDaTabelaDeRevisoes` pega toda linha que começa por `|` depois de `\n## Revisões\n`. Hoje isso está certo, porque a seção é a última do arquivo. Se um dia vier outra tabela depois dela, o gancho passa a exigir também as linhas dessa tabela. Vale anotar isso no comentário da função, ou parar a leitura no próximo título `## `.
- O mesmo arquivo, linhas 162-171: `decidirEscrita` não tem teste de unidade direto em `revisoes.test.ts`. Hoje só se prova pelo spawn do comando. Um teste direto deixaria a falha mais fácil de localizar. Não bloqueia.
- O comando do `Write` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.claude/settings.json` (`|| { [ "$?" = 2 ] && exit 2; ... }`) trata a saída 2 de um jeito, e o comando do `Bash` logo acima não. A diferença é legítima, porque o portão recusa por JSON e a escrita recusa pela saída 2. Uma linha no cabeçalho de `hook-revisoes.ts` explicando isso evitaria que alguém "uniformize" os dois comandos depois.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 12:33:57 · `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica: a mudança fica só no hook local do processo, sem rota nem request)
Fila e prioridade: ok (não se aplica: nenhum job, nenhuma fila)
Concorrência: protegida (o modo `escrita` só lê o documento e decide. Não grava nada, então não há o padrão "busca, verifica, grava")
Índice e paginação: ok (não se aplica: nenhuma query, nenhuma tabela)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: o código roda só na sessão do Claude Code, fora do caminho quente de produção)
Bloqueantes: nenhum
Recomendações:
- O limite que a tarefa já declara fica registrado para a retro. O `Edit` que apaga a tabela e o `Bash` com `>` sobre `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/` continuam sem guarda. Se a seção voltar a sumir por esses caminhos, convém pôr o mesmo `recusaDeEscritaSobreRevisoes` no matcher `Edit` (comparando `old_string` e `new_string`).

Rodei `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-portao.test.ts` e os 61 casos passaram. Nenhum teste chama provedor pago.

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 12:34:40 · `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** um `Write` sobre um documento de `tasks/` que já tem "Revisões" passa quando o conteúdo novo traz a tabela inteira, mesmo com o texto em volta mudado.
- **Bordas:** conteúdo novo sem a seção (o sintoma da TODO); sem a 1ª rodada (o caso da 3.0); com uma rodada alterada; com a tabela acima do título; caminho absoluto, relativo, com `./` e com `..`; arquivo novo; arquivo que existe sem a seção; arquivo fora de `tasks/` (também `tasks-antigas/` e o `tasks/` de outra raiz); `Write` sem `content`; entrada sem `file_path`.
- **Falha:** a leitura do documento falha (EISDIR) e o `Write` é recusado. O hook que não carrega também recusa, e uma recusa de verdade não leva junto a mensagem de conserto.
- **Permissão:** com e sem `CLAUDE_CODE_AGENT`, o resultado é o mesmo. O hook não depende do papel, e o caso prova isso.
- **Isolamento entre escolas:** não se aplica, porque nada aqui toca dado de escola. O equivalente aqui é a outra raiz com `tasks/`, e ela está coberta.
- **Concorrência:** não se aplica. O hook só lê, e cada chamada é independente.

**Cobertos:** todos, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-portao.test.ts`, no `describe` "o Write não reescreve documento que já tem a seção "Revisões"". São 13 casos, um para cada item da lista "Casos" do documento, e cada um roda o comando lido do `.claude/settings.json` com `sh -c`. Rodei `npx vitest run tools/processo/hook-portao.test.ts` e passaram 61 de 61.

Conferi as mutações contra o `git diff`, cláusula por cláusula. Cada cláusula nova tem o seu bloco:
- **Em `documento-de-revisao.ts`:** o filtro `|`, o `Set` de depois, o `!depois.has`, o `faltam.length === 0`, o `typeof alvo`, o `startsWith('tasks/')`, o `existsSync` e o `typeof conteudo`.
- **Em `hook-revisoes.ts`:** o `modo === 'escrita'`, o `exit(2)`, o `catch` e o `if (motivo)`.
- **Em `.claude/settings.json`:** o matcher `Write` e o `[ "$?" = 2 ] && exit 2`.

Cada bloco deixa o teste vermelho pelo motivo certo, porque o cenário chega à cláusula. Três exemplos:
- Tirar o `existsSync` faz o arquivo novo cair no ENOENT, que vira recusa, e o caso espera 0.
- Trocar o `typeof conteudo` faz o `TypeError` cair no `catch`, e a asserção `'não traz 4 de 4 linhas'` pega a diferença.
- Tirar o `[ "$?" = 2 ]` faz a recusa trazer "não carregou", e o `not.toContain` pega.

Não há `.skip`, nem teste comentado, nem mock: o teste roda o hook de verdade, sobre uma cópia de `tools/processo/`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Caminho com link simbólico: `decidirEscrita` (`tools/processo/documento-de-revisao.ts`, perto da linha 163) compara caminhos com `resolve`/`relative`, que não seguem link simbólico. Se o `CLAUDE_PROJECT_DIR` chegar por um link e o `file_path` vier pelo caminho real, ou o contrário, o `relativo` começa por `../` e o `Write` passa sem proteção. Normalizar os dois lados com `realpathSync` (quando o caminho existe) e acrescentar um caso com raiz por link simbólico.
2. Arquivo com CRLF: `linhasDaTabelaDeRevisoes` procura `\n## Revisões\n`. Num documento com fim de linha CRLF a seção não é achada e o `Write` passa. Ou se registra isso no "Limite declarado", ou se aceita `\r?\n`, com um caso de teste.
3. O caso "com a tabela acima do título" só confere `status === 2`. Vale conferir também `stderr` contendo `'não traz 4 de 4 linhas'`, para ele não ficar verde por uma recusa de outra origem, como a falha do hook.
4. O caso "o caminho absoluto e o relativo à raiz valem igual" repete à mão o `spawnSync` em vez de usar `escrever`. Juntar os dois evita que se separem.
5. O limite declarado (`Edit` que apaga a seção, e `Bash` com `>`) deveria ir para a retro ou a TODO como um item próprio, para não ficar só neste documento.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-15-write-sobre-revisoes.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/documento-de-revisao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-revisoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-portao.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.claude/settings.json`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 12:46:10 · `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (é uma correção de processo, sem seção na Tech Spec; o comportamento do gancho não mudou nesta rodada)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo, para o código atual)
Bloqueantes: nenhum

O que foi pedido na 1ª rodada está feito:
- **1ª recomendação, aplicada.** O comentário de `linhasDaTabelaDeRevisoes`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/documento-de-revisao.ts:134-138`, agora diz que a seção "Revisões" precisa ser a última do arquivo. Se outra tabela vier depois dela, o gancho do `Write` passa a exigir essa tabela também.
- **3ª recomendação, aplicada.** O cabeçalho de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-revisoes.ts:6-7` explica por que o `portao` e a `escrita` recusam de jeitos diferentes. O `portao` responde em JSON com saída 0; a `escrita` sai com 2 e escreve a frase no stderr. O comentário pede que ninguém uniformize os dois.
- **2ª recomendação, recusada com motivo** na tabela "Recomendações sem aplicar" (linha 52 do documento). O motivo vale: os casos do `describe` do Write já testam `decidirEscrita` pelo comando que o Claude Code roda, e `revisoes.test.ts` não é arquivo desta correção.
- **Os dois ajustes do test-engineer** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-portao.test.ts` entraram:
  - Os dois casos agora conferem a mensagem do stderr, além da saída 2. Assim o teste falha se a recusa vier por outro motivo, como o hook não carregar.
  - O caso dos caminhos absoluto e relativo passou a usar o helper `escrever`, e o caminho absoluto é montado a partir da raiz de cada cópia.
- **Os três itens que foram para o `TODO.md`** (link simbólico, CRLF, `Edit` e `Bash` com `>`) estão lá, marcados com a correção, nas linhas 2895, 2897 e 2899. Cada um também aparece na tabela do documento.

Recomendações:
- O helper `escrever` agora aceita `string | undefined | ((raiz: string) => string)` como alvo. Funciona, mas o caso que precisa do caminho absoluto ficaria mais legível passando um sinal de "absoluto" ou a raiz. Não bloqueia.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 12:46:23 · `tasks/correcoes/2026-11-15-write-sobre-revisoes.md`

VEREDITO: APROVADO

**Cenários exigidos.** As duas recomendações que a Mesa mandou aplicar, e o encaminhamento das outras.
- **3ª recomendação:** no caso em que a tabela fica acima do título, o teste passa a conferir o motivo da recusa no stderr, e não só a saída 2.
- **4ª recomendação:** o caso do caminho absoluto passa a usar `escrever`, nos quatro formatos de caminho, cada um com o motivo da recusa conferido.
- **As outras três recomendações** (link simbólico, CRLF, e o `Edit`/`Bash` que passa fora do gancho): ir para o TODO.md e para a tabela "Recomendações sem aplicar".

**Cobertos.**
- **3ª, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/processo/hook-portao.test.ts:303`.** O teste confere `não traz 4 de 4 linhas`. A frase sai de `documento-de-revisao.ts:152`, e o número certo para esse caso é mesmo 4 de 4: com a tabela acima do título, a seção nova não tem nenhuma linha de tabela. Antes, uma saída 2 por outro motivo, como o hook que não carrega, também passaria. Agora o teste só passa se a recusa vier da regra.
- **4ª, em `hook-portao.test.ts:306-313`.** O caminho absoluto passa como função de `raiz`, e `escrever` aceita isso na linha 244 e o resolve na linha 257. Os quatro alvos são o relativo, o absoluto, o com `./` e o com `..`. Cada um roda numa cópia nova pelo comando real do settings.json e confere a saída 2 e o motivo no stderr. A segunda forma de chamar o comando, que tinha sido duplicada à mão, sumiu.
- **Os comentários novos** em `documento-de-revisao.ts:136-137` (a seção "Revisões" precisa ser a última do arquivo) e em `hook-revisoes.ts:6-7` (o `portao` e a `escrita` recusam de jeitos diferentes) só documentam. Não mudam comportamento.
- **TODO.md, linhas 2895, 2897 e 2899:** os três itens estão lá, marcados com o nome da correção.
- **O teste roda verde:** `npx vitest run tools/processo/hook-portao.test.ts` dá 61 de 61. A árvore de trabalho é a mesma do `8713d54` nos arquivos de `tools`, `.claude` e no TODO.md.
- Nenhum `.skip`, nenhum mock novo e nenhuma chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:** nenhuma nova. As de link simbólico, CRLF e `Edit`/`Bash` continuam abertas no TODO.md, como a Mesa decidiu.
