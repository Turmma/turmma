# Achados das revisões — `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 03:19:47 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica (a mudança está só no hook local do processo, em `tools/processo/`, fora da API e do worker)
Fila e prioridade: ok (nenhum job novo e nenhuma fila tocada)
Concorrência: protegida (nada mudou. A escrita em `achados/` continua no mesmo `writeFileSync` de `registrar`. A limpeza é uma função pura chamada antes da gravação.)
Índice e paginação: ok (não se aplica: sem query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: nada no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `tools/processo/documento-de-revisao.ts:320-321`: `DO_ANDAR` e `DA_RAIZ_DO_REPOSITORIO` usam um quantificador preguiçoso a partir de cada `/`. O custo cresce com o comprimento de cada trecho sem espaço, o que basta no hook local. Se a função for reaproveitada em código de request, ela precisa de um teto de tamanho na entrada.
- O caso de uma raiz com caractere especial de regex não precisa de teste: `replaceAll` com string não interpreta regex. Falta só um comentário em `semCaminhoDaMaquina` dizendo que a troca é literal, para que ninguém a converta em `RegExp` depois.

Rodei os dois testes novos em `tools/processo/revisoes.test.ts` e os dois passaram. O único lugar que chama `achadoDaRodada` é `registrar`, que agora passa a `raiz` (linha 527).

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 03:20:46 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: um caminho absoluto do checkout do hook dentro de um bloco de `achados/` vira o caminho do repositório.
- Borda: raiz com barra no fim.
- Borda: a raiz sozinha vira `.`.
- Borda: o prefixo de outro andar, com ou sem pasta do repositório depois.
- Borda: o prefixo do térreo até uma pasta do repositório.
- Borda: o prefixo do térreo até um arquivo da raiz (`CLAUDE.md`, `TODO.md`, `README.md`, `ROADMAP.md`, `package.json`).
- Borda: um caminho relativo com `tasks/` no meio não é partido.
- Borda: uma URL não é partida.
- Borda: um caminho absoluto de fora do repositório sem raiz fica como está.
- Borda: o andar da spec e o andar da linha têm um nome que é prefixo do outro (`…/floors/educaia--speccamada-ia` e `…/floors/educaia--speccamada-ia--l1`).
- Fiação: `registrar` passa a `raiz` adiante.
- Permissão, isolamento de escola e concorrência não se aplicam: é ferramenta do processo, sem dado de escola e sem operação concorrente.

**Cobertos:** rodei `npx vitest run tools/processo/revisoes.test.ts -t "caminho da máquina|raiz do hook"` e os dois testes passam. As nove mutações do documento correspondem a cláusulas reais do `git diff`. Estão cobertos:
- raiz do hook, com e sem barra no fim;
- raiz sozinha virando `.`;
- outro andar, com e sem pasta depois;
- térreo até `tools/`;
- relativo com `tasks/` no meio;
- URL (as mutações que tiram `\w` e `:` da regra de antes da barra são pegas);
- sem raiz, nada sai;
- fiação em `registrar`.

As asserções são sobre o texto gravado no arquivo, e não sobre o código ter rodado. Não há `.skip`, nem mock, nem provedor de IA.

**Bloqueantes:**

1. **Andar com nome que é prefixo de outro sai estragado** (`tools/processo/documento-de-revisao.ts:326`).
   - O defeito: `replaceAll(base, '.')` troca a raiz também quando ela é só o começo do nome de outro andar.
   - Prova: rodei `npx tsx -e`, sem alterar arquivo. Com `raiz = …/floors/educaia--speccamada-ia`, o texto `…apps/api/x.ts:3` sai como `.--l1/apps/api/x.ts:3`.
   - Por que importa: andar de spec e andar de linha convivem e têm nomes prefixados um pelo outro, como nesta própria spec. A primeira troca deixa o caminho estragado, e o `DO_ANDAR` já não o reconhece.
   - Correção exigida: só trocar a raiz quando ela não for seguida de caractere de nome (por exemplo, um regex com a raiz escapada e `(?![\w.-])`). Somar ao teste "o bloco guardado em achados/…" um caso com esse par de andares, que espere `apps/api/x.ts:3`, e um bloco de mutação que prove a nova cláusula.

2. **O ramo "arquivo da raiz" do térreo não tem teste** (`tools/processo/documento-de-revisao.ts:320`).
   - O defeito: a alternativa `(?:CLAUDE|TODO|README|ROADMAP)\.md\b|package\.json\b` é a parte (3) da seção Correção, escrita no documento. Nenhum caso passa por ela.
   - Por que o teste não pega: o `TODO.md:10` de `revisoes.test.ts` (perto da linha 1321) vem da `raiz` do hook, e quem o limpa é o `replaceAll` da linha 326, não esse ramo. O único caminho de térreo do teste é `${doTerreo}/tools/…` (perto da linha 1319).
   - Consequência: tirar a alternativa inteira deixa os testes verdes, e a seção Mutações não tem bloco para ela.
   - É um caso comum: o revisor cita `/home/<usuário>CLAUDE.md` do térreo.
   - Pela sonda, o comportamento atual está certo (`CLAUDE.md:10` vira `CLAUDE.md:10`). Falta só a prova.
   - Correção exigida: somar ao teste `${doTerreo}/CLAUDE.md:N` e `${doTerreo}/package.json`, esperar `CLAUDE.md:N` e `package.json`, e acrescentar o bloco de mutação que tira essa alternativa.

**Recomendações:**
- Da lista de pastas em `REPOSITORIO`, só `tools` é provada pelo térreo. `apps`, `packages`, `infra`, `e2e`, `docs`, `.claude`, `.github` e `.processo` podem sair da lista sem quebrar nada. Um ou dois casos a mais de térreo (`packages/`, `.claude/`) já cobririam a lista.
- Da regra de antes da barra, só `\w`, `:` e (de forma implícita, pela URL) `/` são provados. Para `.`, `~` e `-`, um caso como `../packages/core/src/tasks/x.ts` provaria o ponto.
- A regra de antes da barra em `DO_ANDAR` (linha 321) não tem mutação nenhuma. Isso é aceitável, porque `.maestri/floors` relativo é raro, mas fica registrado.
- O que já foi gravado com caminho da máquina continua publicado (`grep -rl /home/ tasks/*/achados`). O documento declara que limpar isso é outra tarefa; vale conferir se a entrada correspondente existe no `TODO.md`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-21 03:20:58 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

VEREDITO: REPROVADO

Escopo: incompleto

Aderência à Tech Spec: ok. A correção não cita seção da Tech Spec e não declara divergência.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

1. **O índice, que também é commitado, continua levando o caminho da máquina.** Está em `tools/processo/documento-de-revisao.ts:536`, com a causa em `:367` e `:370`.
   - O `registrar` ainda grava a célula de `achados/indice.md` com `resumoDoAchado(mensagemFinal)`, sobre a mensagem crua. Essa limpeza passa só pelo `ATE_A_RAIZ`, cuja lista de pastas não tem `.claude`, `.github`, `.processo` nem `package.json`. Ela também não tira o andar quando depois dele não vem pasta do repositório, nem a raiz do hook.
   - Rodei `resumoDoAchado` sobre dois casos, e o caminho sai inteiro nos dois. `` `.github/workflows/ci.yml:93` `` volta igual. `` `node_modules/a.js:3` `` também.
   - O histórico confirma: `tasks/correcoes/achados/indice.md` tem 20 linhas com `/home/` e `tasks/prd-harness/achados/indice.md` tem 18, com `package.json:65` e `/.github/workflows/ci.yml:93-94`.
   - O documento diz "Só o resumo do índice (`limpar`, `ATE_A_RAIZ`) o tirava" (linha 11) e "O índice já tirava o prefixo (`limpar`), e não mudou" (linha 36). As duas frases são falsas. A causa registrada está errada, e o vazamento que a correção quer fechar continua saindo pelo mesmo hook, na mesma pasta pública.
   - **Correção exigida:** a célula do índice passa pela mesma limpeza do bloco, a `semCaminhoDaMaquina` com a `raiz` aplicada à mensagem antes do `resumoDoAchado`. Também vale um `limpar` que use `DO_ANDAR` e `DA_RAIZ_DO_REPOSITORIO` no lugar do `ATE_A_RAIZ`. Fica assim um jeito só de tirar o prefixo.
   - Precisa de um caso em `revisoes.test.ts` que leia a linha nova de `achados/indice.md` e não ache `/home/` nem `.maestri`, com o bloco `mutacao` dele. Corrija também as linhas 11 e 36 do documento.

2. **A troca da raiz parte o caminho de outro andar cujo nome começa igual.** Está em `tools/processo/documento-de-revisao.ts:326`.
   - O `replaceAll(base, '.')` não confere o que vem depois da raiz. Com a raiz `…/floors/educaia--l1`, o texto `` `…apps/x.ts` `` vira `` `.0/apps/x.ts` ``. Rodei e confirmei.
   - O caso real é o andar da spec, `educaia--speccamada-ia`, que é prefixo dos andares das linhas (`educaia--speccamada-ia--l1`). Um achado gravado no andar da spec que cite o checkout de uma linha fica como `.--l1/apps/…`, uma referência que não leva a arquivo nenhum.
   - **Correção exigida:** a troca de `base` sozinha por `.` só vale quando o caractere seguinte não continua o caminho (fim, espaço, crase, aspas, parêntese, `:`). O caso entra no teste "a raiz do hook com barra no fim…", ou num novo, com o bloco `mutacao` dele.

Recomendações:
- `DA_RAIZ_DO_REPOSITORIO` também tira o começo de rota HTTP que tenha um segmento igual ao nome de uma pasta do repositório. `semCaminhoDaMaquina('GET docs/x e a rota tasks/1')` devolve `GET docs/x e a rota tasks/1`. Vale pelo menos registrar isso em "O que fica de fora", ou exigir que a base termine num checkout conhecido.
- O mesmo regex corta qualquer caminho na primeira pasta com nome do repositório. `.claude/projects/…` vira `.claude/projects/…`, que parece caminho do repositório e não é. Não vaza nada, mas engana quem lê.
- A entrada do `TODO.md` "(F4b, retro, M5)" (linha 2976) segue `[ ]`. A correção da M3 e da M4 marcou "*Feita na correção …*" no mesmo commit. Faça igual aqui, e corrija na mesma entrada o arquivo citado: `tools/processo/revisoes.ts` não existe, o código está em `documento-de-revisao.ts`.
- Para a validação: o histórico já gravado continua com milhares de ocorrências, e o documento declara isso fora do escopo. O repositório é público, então a tarefa de limpar o histórico precisa de dono e de entrada no `TODO.md`, e hoje não tem nenhuma das duas.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 03:22:49 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum dado de aluno, responsável ou professor. A mudança só mexe no texto dos revisores gravado em `tasks/*/achados/`. O único dado pessoal envolvido é o nome de usuário da máquina do desenvolvedor dentro dos caminhos absolutos, e a correção existe justamente para tirá-lo do repositório, que é público.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não cria campo, tabela nem migration.

Autorização por objeto: não se aplica. A tarefa não toca rota, endpoint nem repository.

Logs: limpos. A tarefa não acrescenta nenhum log.

Auditoria: não se aplica. A tarefa não toca leitura de aluno, exportação, nota, permissão nem aprovação de IA.

Envio externo: nenhum. O que muda é o que vai para o git público, e agora vai menos: o prefixo da máquina sai antes de o bloco ser gravado.

Seed/fixture: sintético. O teste usa os caminhos inventados `/home/joaquim/Documentos/...`, `/srv/x/y` e um `raiz` temporário. Nenhum dado real.

Bloqueantes: nenhum.

O que conferi:
- **O vazamento está fechado.** `registrar` (linha 527 de `tools/processo/documento-de-revisao.ts`) é o único ponto que grava o texto do revisor, e agora passa a `raiz` para `achadoDaRodada`. Lá, `semCaminhoDaMaquina` limpa o texto antes de gravar o bloco.
- **O resto do que se grava não leva o texto da mensagem.** O índice já era limpo por `limpar` e `ATE_A_RAIZ`. A tabela de revisões do documento (`acrescentarRevisao`) guarda só revisor, horários, veredito e id do agente.
- **Testes.** Os dois testes novos passam, e a pasta `tools/processo/` inteira também (27 arquivos, 1723 testes).
- **Limites do que fica.** Caminho relativo com `tasks/` no meio, URL e caminho relativo comum continuam intactos, como o teste afirma.

Recomendações (não bloqueiam):
1. **A memória do Claude ainda vaza o usuário.** Um caminho como `/home/<usuário>/.claude/projects/-home-<usuário>-Documents-git-Educa-ia/memory/...` perde só o prefixo e vira `.claude/projects/-home-<usuário>-...`, com o nome do usuário ainda dentro, no nome da pasta escrito com hífens. Testei isso direto. Vale tratar o padrão `-home-<x>-` ou cortar `.claude/projects/<pasta>/` inteiro.
2. **Caminhos fora do repositório ficam inteiros.** O `/tmp/claude-<uid>/-home-<usuário>-.../scratchpad/...` fica de propósito, como a tarefa declara, e leva o usuário na mesma forma com hífens. O `~/Documents/git/Educa-ia/...` também fica e expõe a estrutura de pastas, sem o usuário. Vale registrar os dois no `TODO.md` junto com a limpeza do histórico.
3. **O histórico continua público.** Os milhares de caminhos com `/home/` já gravados em `tasks/*/achados/` estão no repositório. Enquanto a limpeza não acontece, a exposição do nome de usuário e da estrutura do Maestri continua. A tarefa dessa limpeza merece prioridade e não só um registro.

Arquivos auditados:
- `tools/processo/documento-de-revisao.ts`
- `tools/processo/revisoes.test.ts`
- `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 03:38:27 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É correção de processo e não cita seção da techspec. O documento da correção registra a troca da raiz restrita ao fim do nome, a limpeza do índice e a saída do `ATE_A_RAIZ`.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As duas correções da 1ª rodada estão feitas:

1. **Índice sem o caminho da máquina.** Em `tools/processo/documento-de-revisao.ts:539`, `registrar` passa a mensagem por `semCaminhoDaMaquina(mensagemFinal, raiz)` antes do `resumoDoAchado`.
   - `limpar` (linha 373) usa `DO_ANDAR` e `DA_RAIZ_DO_REPOSITORIO`. O `ATE_A_RAIZ` saiu, e agora há um jeito só de tirar o prefixo.
   - O caso que lê a linha nova de `achados/indice.md` e não acha `/home/`, `.maestri` nem a raiz está em `tools/processo/revisoes.test.ts`, com o bloco `mutacao` dele.
   - Há também o caso do `resumoDoAchado` sem raiz, que é o caminho usado por `separar-achados.ts:89`, com duas mutações.
   - As linhas 11 e 36 do documento foram reescritas.
2. **A raiz não parte mais o nome de outro andar.** A troca da raiz sozinha por `.` agora só vale com `(?![\w.-])` depois, e a raiz entra escapada.
   - O teste cobre os três casos: `--l1`, `l1`/`l10` e `a+b` contra `aab`.
   - Cada um tem mutação, inclusive a que apaga o escape.

As recomendações que a Mesa mandou aplicar estão feitas:
- A rota HTTP com segmento igual ao de uma pasta do repositório está registrada em "O que fica de fora".
- A entrada M5 do `TODO.md` está marcada como feita e cita `documento-de-revisao.ts`.
- A entrada nova do `TODO.md` para o histórico já gravado tem dono.

Recomendações:
- A raiz seguida de ponto, como no fim de uma frase ("a raiz é `/home/<usuário>/Documents/git/Educa-ia`."), não é trocada, porque a exclusão `(?![\w.-])` também barra o ponto final. No checkout do térreo, que não está em `.maestri/floors`, nenhuma outra limpeza pega esse caso e o caminho fica inteiro no achado. O andar escapa porque `DO_ANDAR` o pega, mas leva o ponto junto. Uma exclusão como `(?![\w-]|\.\w)` resolve. O caso é raro e não bloqueia.
- O comentário "Metade dos revisores cita…", logo acima de `limpar` (`documento-de-revisao.ts:369-370`), ficou solto antes do comentário do negrito. Vale juntar os dois num só bloco acima da função.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 03:39:03 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

VEREDITO: APROVADO

Esta tarefa não mexe em nenhum dado de aluno. Ela muda só o hook local do processo, que tira o caminho da máquina (e com ele o nome do usuário) dos achados gravados num repositório público.

Campos pessoais tocados: nenhum dado de titular (aluno, responsável ou professor). O que a tarefa protege é o nome de usuário da máquina do desenvolvedor dentro dos caminhos que vão para `tasks/*/achados/`.
Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo nem migration.
Autorização por objeto: não se aplica. Não há rota nem endpoint.
Logs: limpos.
Auditoria: não se aplica. Nenhuma ação desta tarefa pede auditoria pela regra 20.
Envio externo: nenhum.
Seed/fixture: sintético. Os testes usam caminhos inventados (`/home/joaquim/Documents/...`, `/home/u/...`, `/srv/...`) e uma raiz temporária.
Bloqueantes: nenhum.

O que conferi na rodada nova:
- **A correção que o revisor-geral pediu na 1ª rodada foi feita.** O índice agora passa pela mesma limpeza do bloco. Em `tools/processo/documento-de-revisao.ts:539`, `registrar` passa a mensagem por `semCaminhoDaMaquina(mensagemFinal, raiz)` antes do `resumoDoAchado`. A função `limpar` deixou o `ATE_A_RAIZ` e usa `DO_ANDAR` e `DA_RAIZ_DO_REPOSITORIO`, então `separar-achados.ts`, que chama o resumo sem raiz, também sai limpo. O teste "o índice de achados também não leva o caminho da máquina" prova isso com raiz real, outro andar e `.claude`. O bloco de mutação dele aponta a falha `not.toContain(raiz)`.
- **A raiz que é prefixo do nome de outro andar** agora só vira `.` onde o nome acaba (`(?![\w.-])`). Ela é escapada antes de virar regex. Há um caso com `--l1`, um com `l10` e um com `a+b`, e cada um tem a sua mutação.
- **No que o hook gravou nesta rodada**, as 4 linhas novas de `tasks/correcoes/achados/indice.md` estão sem caminho da máquina. A única ocorrência de `/home/` nelas é o marcador `/home/<usuário>/` que o privacy-guardian citou no achado. O bloco `achados/2026-11-21-achado-com-caminho-relativo.md` também não tem caminho real; o `/home/joaquim/...` que aparece lá é o caminho inventado do teste, citado pelo privacy-guardian.
- **Rodei `tools/processo/revisoes.test.ts`: 341 passaram.**

Recomendações:
1. **O índice ainda guarda caminhos reais de antes desta tarefa.** Em `tasks/correcoes/achados/indice.md` aparecem nas linhas 32, 46, 194 e 341, por exemplo, com o nome de usuário `/home/joaquimdp/...`. Isso está registrado no `TODO.md`, na entrada "O histórico e o que o prefixo não alcança", e por isso não bloqueia. Como o repositório é público e essa exposição já aconteceu, vale dar prioridade ao script de limpeza e decidir sobre reescrever o histórico do git.
2. **Pedir aos revisores que citem caminho relativo**, como o próprio `TODO.md` sugere. A limpeza não pega `.claude/projects/-home-<usuário>-…`, `/tmp/claude-<uid>/…` nem `~/…`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 03:39:39 · `tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md`

**VEREDITO: APROVADO**

As duas correções exigidas foram feitas, e cada cláusula nova tem um bloco de mutação que a prova. Rodei `tools/processo/revisoes.test.ts` (341 passaram) e `tools/processo/separar-achados.test.ts` (6 passaram). Também confirmei que este segundo arquivo continua verde, porque o `limpar` mudou e ele usa o resumo.

**Cenários exigidos nesta rodada**
1. A raiz do hook que é prefixo do nome de outro andar (`…--speccamada-ia` e `…--speccamada-ia--l1`) não estraga o caminho.
2. O ramo "arquivo da raiz" do térreo (`CLAUDE.md` e `package.json`).
3. Casos de térreo com `packages/` e `.claude/`.
4. O ponto ou `~` antes da barra (`../packages/…`).
5. O índice `achados/indice.md` passa pela mesma limpeza do bloco: no hook, com a raiz, e no `resumoDoAchado` sem raiz, que é como o `separar-achados.ts` o chama.

**Cobertos**
1. O teste "a raiz do hook que é prefixo do nome de outro andar não o parte" espera `apps/api/x.ts:3 e apps/api/y.ts:4 e .`. Ele traz também o par `l1`/`l10` e o escape de `a+b`.
   - O bloco que tira o `(?![\w.-])` deixa o texto como `.--l1/…`, e o teste fica vermelho pelo motivo certo.
   - O bloco que tira o `escaparParaRegex` dá `. e /srv/a+b`, diferente do esperado.
2. O teste do bloco agora cobre `${doTerreo}/CLAUDE.md:7` e `${doTerreo}/package.json`.
   - No bloco que tira `(?:CLAUDE|…)\.md`, o `toContain` sozinho não pegaria a mutação, porque o texto esperado continua dentro do que sobra. Quem a derruba é o `not.toContain('/home/')` da linha 1333.
   - No de `package.json`, o próprio `toContain` da linha 1347 falha.
3. Há uma linha de térreo para cada pasta e arquivo da raiz, cada uma com o seu bloco. Ganharam bloco as pastas `apps` e `.claude`, além do `CLAUDE.md` e do `package.json`, e o `.` e o `~` do lookbehind também.
4. `../packages/core/src/tasks/x.ts` e `~/packages/…` ficam inteiros. Com o `.` ou o `~` fora do lookbehind, o texto vira `..tasks/x.ts`, e o teste fica vermelho.
5. O índice tem dois testes:
   - "o índice de achados também não leva o caminho da máquina" passa pelo hook de verdade (`rodada`). Tirar o `semCaminhoDaMaquina` do `registrar` derruba o `not.toContain(raiz)`.
   - "o resumo do índice tira…" tem um bloco para cada `replace` do `limpar`, o do `DO_ANDAR` e o do `DA_RAIZ_DO_REPOSITORIO`. Os dois ficam vermelhos.

**Bloqueantes:** nenhum.

**Recomendações**
1. **O `.` do lookahead não tem teste e faz a raiz escapar no fim de frase.** Fica em `tools/processo/documento-de-revisao.ts:330`.
   - Trocar `(?![\w.-])` por `(?![\w-])` não deixaria nenhum teste vermelho, porque o `--l1` e o `l10` já são cobertos pelo `-` e pelo `\w`.
   - O efeito é que a raiz sozinha seguida de ponto (`o cwd é /home/u/Documents/git/Educa-ia.`) fica inteira. No andar, o `DO_ANDAR` a remove depois. No térreo, ou em checkout fora do Maestri, ela vaza.
   - Pesei como recomendação e não como bloqueante, porque o `.` veio da minha própria sugestão na 1ª rodada e porque o vazamento só acontece no térreo.
   - Sugestão: um lookahead que aceite ponto seguido de espaço ou de fim de texto (por exemplo `(?![\w-]|\.[\w-])`), mais um caso como `semCaminhoDaMaquina('cwd /srv/x/y.', '/srv/x/y')`, que deve dar `cwd ..`, e um bloco de mutação para ele.
2. A entrada nova do `TODO.md` ("O histórico e o que o prefixo não alcança") registra bem o que ficou de fora. Vale somar a ela a rota HTTP com segmento igual ao de uma pasta do repositório (`docs/x`), que hoje só aparece na seção "Correção" do documento.

Arquivos auditados:
- tools/processo/documento-de-revisao.ts
- tools/processo/revisoes.test.ts
- tasks/correcoes/2026-11-21-achado-com-caminho-relativo.md
- TODO.md
