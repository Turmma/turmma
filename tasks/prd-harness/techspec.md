# Tech Spec — Harness (X7)

**PRD:** `tasks/prd-harness/prd.md`
**Status:** implementada em 24/10/2026 (aprovada na revisão da spec, rodada 10, `revisao-spec.md`)

Respostas do Joaquim, 23/10/2026: `core.hooksPath` pelo `prepare`; as paradas do §9; o ensaio do RF31 é o item
"(X5, RF31)" do `TODO.md`; e, na revisão da spec, RF2, RF14, RF15, RF16 e a cópia congelada fora. Anexos:
`tabela-de-guardioes.md`, `cenarios.md` (os testes) e `texto.md` (RF20 a RF25).

## 1. Resumo da abordagem

Quatro trilhas. **(1)** Testes de contrato e o `revisoes.ts` partido só por mover. **(2)** O código das
retrospectivas (RF1 a RF11), em linhas. **(3)** O hook novo (RF14 a RF18), um comportamento por tarefa, sobre o §5(a).
**(4)** O texto e o Maestri (RF20 a RF29), por último, e as receitas (RF32, §9). Fecha com o ensaio (RF31).

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `.github/workflows/ci.yml` | alterado | §5(f), RF19, terceira camada (§5a) |
| `tools/processo/esteira.ts` | alterado | RF2 (§5f), leitura por evento (`push` e `workflow_dispatch`), `--censo` (RF9) |
| `tools/processo/linhas.ts` | alterado | RF3 (§5f), `abandonar <n>` (RF6), base de `conferir` (RF10) |
| `tools/processo/mutacoes.ts` | alterado | RF4 (§7c), `--faltando` (RF5), RF17 (§5d) |
| `tools/processo/portao-local.ts` | alterado | RF7, RF8; imprime o `--faltando` e os guardiões |
| `tools/processo/sequencia-do-portao.ts` | novo | RF7, RF8: a função pura que monta a sequência de comandos do portão (suítes, ambiente e dois `stop` dos despachantes e workers). **Onde o `stop` protege:** o do alvo, antes da integração, é redundância do `down --volumes` do `globalSetup` (a integração do alvo já começa do banco limpo, e o código antigo já a rodava assim); o que fica sem outra proteção é a corrida de integração das mutações, que roda sem banco limpo depois de o e2e do alvo (`--manter-ambiente`) deixar o ambiente completo de pé, e por isso a sequência termina num `stop` quando alguma mutação cita teste de integração |
| `tools/ci/etapas-de-guarda.ts`, `tools/ci/dependencias.ts`, `tools/ci/verificar.ts` | alterados e novo | RF8: `GUARDAS_DA_ESTEIRA` e `ETAPAS_DE_GUARDA` são a lista que o `ci:verificar` e o portão leem; `guarda:dependencias` roda as mesmas etapas por `dependencias.ts`, e não um texto redigitado no `package.json` |
| `tools/ci/compose.ts` | alterado | RF7: `servicosDeJob`, os despachantes e workers lidos do `infra/compose.yml` |
| `tools/ci/duracao-do-e2e.ts` | alterado | RF11 |
| `tools/ci/conferir-entregas.ts` | novo | a terceira camada do RF14 (§5a) |
| `tools/processo/revisoes.ts` | partido | `documento-de-revisao.ts`, `caducidade.ts`, `comando-git.ts`, `portao.ts`; o `revisoes.ts` só reexporta, sem importação do `estado.ts` e do `esteira.ts` (RF13); RF18. **Antes da partição** (divergência da 2.0, 23/10/2026): a catraca do X5 (`tools/guardas/catraca.ts`, RF11 do X5) não deixa arquivo novo nascer com supressão, e para o git a partição não é rename. Por isso uma correção, antes da 2.0, baixa a complexidade de `lerSecao` (17), `arquivosDoCommit` (18), `pastaDoCommit` (15) e `portao` (17) a 10 ou menos, no próprio `revisoes.ts`, só extraindo funções auxiliares, sem mudar comportamento, e baixa o `TETO.complexity` do `catraca.test.ts` de 248 para 244. A 2.0 continua só movendo, e cada auxiliar vai para o módulo de quem a chama. A catraca não é afrouxada |
| `tools/processo/guardioes-por-caminho.ts` | novo | RF15, RF16 |
| `tools/processo/hook-git.ts`, `tools/processo/git-hooks/` | novos | `commit-msg` e `pre-push` (RF14) |
| `vitest.config.ts`, `package.json`, `tools/ci/verificar.ts`, `tools/processo/portao.ts`, `tools/processo/sequencia-do-portao.ts`, `tools/processo/portao-local.ts`, `tools/processo/mutacoes.ts` | alterados | RF14 (11.0, divergência registrada em `11_task.md`): o `hook-git.int.test.ts` roda no projeto `processo` do Vitest, sem o `globalSetup` do compose. `npm run test` e `test:processo` o levam; o `ci:verificar` o roda (sem compose, e não na integração); `alvosDoPortao` o põe nos alvos quando `tools/processo/` muda, a sequência do portão o roda por último (`npx vitest run --project processo`), e `tipoDoTeste` o reconhece para as mutações |
| `tools/processo/harness/*.test.ts` | novos | um arquivo por aspecto (RF12, RF20 a RF26, RF30, RF32) |
| `.claude/skills/receitas-de-codigo/SKILL.md` | novo | RF32 (§9): a skill de projeto que aponta as receitas do guia; o `executar-task`, o `criar-techspec/template.md` e o mapa do `CLAUDE.md` apontam para ela ou para o guia |
| `tools/processo/harness/caminhos.ts` | novo, se a extração da 16.0 ficou dentro do teste | RF24, RF32: a extração de caminhos da 16.0, movida sem mudar o que devolve, importada pelos dois testes |
| `docs/guia-do-desenvolvedor.md` | alterado | RF32: uma linha no topo dizendo que a skill aponta para cá e que o teste confere as duas |
| `tools/processo/estado.ts`, `vigia.ts` | alterados | RF20, RF27, RF28 |
| `tools/guardas/regras-ia.mjs` | alterado | a pasta isenta é `packages/nucleo/src/ia/adaptador-*.ts` (RF24) |
| `.claude/settings*.json`, `.claude/hooks/` | alterados | RF29; o início de sessão confere `core.hooksPath` e grava `feita` |
| `package.json` | alterado | `"prepare": "git config core.hooksPath tools/processo/git-hooks"` |
| `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `docs/` | alterados e novos | RF20 a RF25, RF28, o socorro (`texto.md`) |

## 3. Modelo de dados

Nenhuma tabela. Fora do git: `.processo/limpeza.json` (`{ "pedida": ISO, "feita": ISO }`).

## 4. API

Nenhuma rota. Comandos novos em `tools/processo/`: `esteira.ts --censo [branch]`, `linhas.ts abandonar <n>`,
`mutacoes.ts --faltando <documento>`, `hook-git.ts commit-msg <arquivo>` e `pre-push`; e `npm run ci:conferir-entregas`.

## 5. Fluxo

**(a) Uma decisão, duas entradas.** A decisão inteira do `portao` de hoje vira uma função pura em `portao.ts`,
`decidirCommit({ mensagem, arquivos, conteudoDe, raiz, papel })`: a marca, o documento, os obrigatórios (§5b), as pastas
(§5e), o `avaliarPortao` e a conferência das mutações. O `PreToolUse` a chama com a mensagem do comando ou do arquivo (`-F x`, `-Fx`, `--file=x`) e o
conteúdo da árvore, e recusa `Fora do processo:` em qualquer sessão do Claude Code, Orquestrador inclusive: a
linha é só do terminal do Joaquim. Em sessão de papel, nega nos argumentos do git `--no-verify` ou abreviação aceita, `-n` em
`commit` (sozinho ou combinado) e `core.hookspath` em qualquer caixa; e as formas de mexer no ambiente (`VAR=`,
`unset`, `env -u`) com `CLAUDE_CODE_AGENT` ou `GIT_CONFIG_`. `grep` e `printenv` passam. Termo só na mensagem: sugere `-F`. O `commit-msg`:

```sh
[ -n "$CLAUDE_CODE_AGENT" ] || exit 0
exec node "$(git rev-parse --show-toplevel)/tools/processo/hook-git.ts" commit-msg "$1"
```

O `hook-git.ts` recusa papel fora de `PAPEIS_DO_TIME` e a linha `Fora do processo:`. Lê a mensagem do arquivo, os arquivos de
`git diff --cached --name-only --no-renames` (com merge em curso, o que diverge dos dois lados, como hoje) e o conteúdo
do índice (`git show :<arquivo>`). Erro de carga recusa; fora de sessão de papel o script sai antes do node. O
`pre-push` lê as refs da entrada padrão e recusa o push de papel para `develop`, `release` ou `main`. O merge do
encontro, sem papel, passa; o de papel passa pela decisão.

No código (10.0): `decidirCommit(entrada, conferencia)` recebe a conferência das mutações como segundo parâmetro, porque o
`portao.ts` não importa o `mutacoes.ts` (§5d), e a entrada ganha `alterados`, opcional: os arquivos alterados da árvore, que
caducam as rodadas e entram na conferência, enquanto `arquivos` são os que o commit leva e decidem se ele leva código. O
`PreToolUse` lê os alterados do `git status`, mais largo que o commit, como sempre leu; sem `alterados`, valem os
`arquivos`, que é o caso do git hook (a 11.0). O `papel` fica na entrada e é a 14.0 quem o lê (as pastas de processo valem só
em sessão de papel, §5e). O `documentoDoCommit` virou `documentoDaMensagem(mensagem, raiz, arquivos)`, sem a guarda de
`git commit` no texto, porque a mensagem do git hook não a tem. A mensagem do `PreToolUse` é o comando inteiro mais o texto
do arquivo de `-F`, lido da pasta em que o commit roda (`-C`, `cd`); o comando inteiro, e não só o `-m`, porque a mensagem
pode vir de `$(cat <<EOF …)`. O caminho `(mvp: …)` (D77) ficava no `portao`, antes da `decidirCommit`, e saiu na 14.0 (RF18): o commit marcado com ele é código sem tarefa. A `decidirCommit` lê o `papel` para contar como código o que a `ehCodigoParaAEsteira` conta, só em sessão de papel (`arquivosDeCodigo`, em `portao.ts`); a tabela de guardiões do RF16 (`REGRAS_DO_RF16` e `RESTO_DO_PROCESSO`, em `guardioes-por-caminho.ts`) vale para o commit de tarefa ou de correção em qualquer sessão. E a correção que leva código de processo (`ehCodigoParaAEsteira` menos `PASTAS_DE_CODIGO`) exige também o `revisor-geral`, marcado ou não (`obrigatoriosDoCommit`): a tarefa já o tem sempre.
A linha `Fora do processo:` não é da `decidirCommit`: `bloqueioDoForaDoProcesso(comando, doArquivo)` a nega no
`PreToolUse` e o `hook-git.ts` a reaproveita. No arquivo vale a linha que começa pelo termo; no comando, o termo em
qualquer lugar, porque dentro de `-m "…"` não se separa linha de menção; sem distinguir maiúscula, para a esteira (12.0)
não aceitar o que o hook deixou passar. O desvio (`desvioDoHook`) lê o comando por palavras do shell (aspas, `;`, `&&`,
`|`, quebra de linha), vê o git atrás de caminho absoluto, atribuição, `env`, `command`, `exec`, `nohup` e `time`, e pula as
opções do git antes do subcomando (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, `--config-env`, `--attr-source`, `--shallow-file`, `--super-prefix`: as de `handle_options` do `git.c`, que levam o argumento na palavra seguinte; a `--super-prefix` é de git antigo, e o 2.56 não a aceita). `-n` é
`--no-verify` só no `commit`; `export` e `unset` da variável do papel entram junto de `VAR=` e `env -u`. Fica fora, e é
limite declarado: `sh -c`, script, substituição de comando e `xargs`.

Fechado na ordem de correção da rodada 1: a barra invertida fora das aspas (`--no-verif\y`, `commi\t`, antes da quebra de linha) e `$'--no-verify'` saem como no shell, e o alias do git (`-c alias.*`, `--config-env alias.*`, `config alias.*`) é negado, porque é o jeito mais curto de chamar `commit -n` sem dizê-lo. Limites a mais: o octal ou hexadecimal dentro de `$'…'` (`$'\055\055no-verify'`) não é decodificado; um alias que já estava no config de antes não é visto (`git ci -m x`); e aspas duplas em número ímpar dentro de `-m "$(cat <<EOF …)"` desalinham a leitura e dão negação falsa, cuja saída é a mensagem em arquivo (`git commit -F`). O arquivo de `-F` só é lido se for arquivo regular (uma pasta, `/dev/stdin` ou um fifo prenderiam o hook).

**A gramática do leitor é fechada (diagnóstico da 10.0).** O leitor do bash não fica completo, e a lista de limites não
cresce forma a forma. Ele lê exatamente isto, e nada mais. Decodifica: aspas simples; aspas duplas e `$"…"`, com `\"` e `\\`
dentro; `$'…'` com `\'` e `\\` dentro (o resto do escape fica cru); a barra invertida fora das aspas e antes da quebra
de linha; e os pedaços colados numa palavra só, com qualquer um destes no começo, no meio ou no fim (`--no-verif$'y'`,
`-$'n'`). Reconhece, sem decodificar, os separadores `;`, `&`, `|`, parênteses e quebra de linha. A barra antes da quebra
de linha sai também dentro de aspas simples, o que só dá negação a mais. Do git, lê as nove opções antes do subcomando, nas
formas com espaço e com `=` (`--config-env=…`), e nega `alias.*` e `core.hooksPath` nas três formas de gravar
configuração: `-c k=v`, `--config-env k=V` ou `--config-env=k=V`, e `git config k`. **Todo o resto é limite, por
categoria:** expansão de parâmetro (`$X`, `${X}`), de chaves (`{y,}`), de til, glob, substituição de comando e
aritmética, o escape numérico de `$'…'`, e configuração que vem de arquivo (`include.*`, `includeIf.*`, um alias ou
`core.hooksPath` que já estava no config, `HOME` ou `XDG_CONFIG_HOME` trocados). A terceira camada (`verificar`, 12.0)
recusa o commit sem marca venha ele de onde vier. Na revisão, a forma que passa e está dentro da gramática é bug; a que
depende de algo fora dela é limite já escrito aqui, e não volta como bloqueante.

A `decidirCommit` não é pura no sentido estrito: lê o disco da `raiz` para o que o processo guarda (`.processo/`, a pasta `tasks/`, a existência do documento de correção) e para a caducidade (`alteracoesDeCodigo`), que compara os bytes e a hora dos arquivos de código com o carimbo e por isso não passa por `conteudoDe`, que devolve texto. O conteúdo do documento da tarefa vem de `conteudoDe`. Na 11.0, o git hook lê o disco para a caducidade, que no commit comum é igual ao índice.

**Limites declarados (RF14).** A máquina não barra `env -u CLAUDE_CODE_AGENT` ou `--no-verify` dentro de script (que
fura também o `pre-push`), `commit-tree`, `update-ref`, `rebase`, `cherry-pick`, `am`, `revert`, `-F -`, nem o Edit em
`git-hooks/` ou `.git/config`, nem `git commit --amend` (proibido pelo protocolo, item 5: o índice não muda e o HEAD é o
commit refeito, então a marca some sem o `commit-msg` ver código). A terceira camada é o job `verificar`, em push de `spec/**` e `correcao/**` (não na
`develop`), com `fetch-depth: 0`: `ci:conferir-entregas` olha commit a commit de `origin/develop..HEAD`, com a
classificação da `decidirCommit` (código de produto mais a lista do §5e), o merge por `--remerge-diff`. Commit de
código passa com `(tarefa N.0)` ou `(correção <slug>)` e a linha `Revisões:`, ou com `Fora do processo: <motivo>`;
senão sai 1 com o hash. Intervalo vazio sai 0. A esteira não sabe quem escreveu a linha: papel que escapou do hook
ou Orquestrador, por script, passam. Andar anterior à X7 fica sem hook nativo até o merge da `develop`, e nada o avisa: o `contexto-inicial.sh` que roda ali é o antigo, e o
`core.hooksPath` que o `prepare` grava fica na config comum, que todos os worktrees compartilham (o valor está "certo" e a pasta não existe). O aviso vale
onde o `contexto-inicial.sh` da X7 já está e o `core.hooksPath` falta ou aponta outro lugar.

No código (12.0): `tools/ci/conferir-entregas.ts` (`npm run ci:conferir-entregas`) lê `git rev-list origin/develop..HEAD` e, de cada commit, os
arquivos de `git show --remerge-diff --no-renames --format= --name-only -z` (nome inteiro, o rename conta os dois lados, e o merge só pelo que
resolveu, inclusive o conflito resolvido ficando com um lado). A classificação é `ehCodigoParaAEsteira`, em `portao.ts`: `PASTAS_DE_CODIGO` mais a
lista do §5(e) (`PASTAS_DE_PROCESSO`, `ARQUIVOS_DE_PROCESSO` pelo nome inteiro, e `PADROES_DE_PROCESSO` para `.claude/settings*.json` e `tsconfig*.json`
da raiz). A lista nasce aqui e não na 14.0, porque a esteira a conta em todo commit, sem saber quem o fez; a 14.0 a importa para a `decidirCommit`, só
em sessão de papel. A marca é lida no **título**, com as regexps que o hook e o `linhas.ts` já usavam (`MARCA_DE_CORRECAO` e `MARCA_DE_TAREFA`, movidas para
o `comando-git.ts`), e a linha `Revisões:` tem de ter texto, no corpo. `Fora do processo:` usa a regexp do hook (`LINHA_FORA_DO_PROCESSO`, qualquer
caixa) e vale com motivo depois dos dois pontos, em qualquer linha da mensagem (a mensagem do `commit-tree` chega sem a limpeza do `git commit`). Sai 0, 1 com o
hash inteiro de cada commit que não confere (todos de uma vez) e **2 sem a `origin/develop`**: o intervalo seria vazio e sairia 0, e quem não pôde conferir não
passa. No `ci.yml`, o passo vem depois do `npm ci` e antes de `ci:verificar`, com `if: startsWith(github.ref, 'refs/heads/spec/') || startsWith(github.ref, 'refs/heads/correcao/')`
(sem expressão entre chaves, e o teste da esteira a avalia ref a ref): roda também na execução manual dessas branches, e não no pull request, onde a ref é a do merge.

**(b) Quem é obrigatório (RF15).** `obrigatorios = união(marcados, guardioesDoCaminho(arquivos, conteudoDe))`. Código
em `apps/`, `packages/`, `e2e/`, `tools/guardas/` e `tools/testes/` pede os quatro, e a citação de uma regra soma o
guardião dela; as exceções, com motivo, e as regras de casamento estão
em `tabela-de-guardioes.md` (decisão do Joaquim na rodada 2). O teto de três da D79 vale para a marcação.
O portão imprime a lista unida.
No código (13.0): `tools/processo/guardioes-por-caminho.ts` não importa módulo nenhum e exporta `guardioesDoCaminho(arquivos, conteudoDe)`, com
`conteudoDe(arquivo, onde: 'head' | 'indice')`. Só é código aqui o arquivo que casa uma entrada: as cinco pastas do padrão e as exceções do código
(`infra/` é uma delas, com `infra-guardian` e `privacy-guardian`); documento e o resto de `tools/` não pedem ninguém, nem citando a regra, até a 14.0 somar as
linhas do RF16. O padrão devolve os quatro sem ler o arquivo; só a exceção lê o texto, nos dois lados, para o sufixo, o `@SemEscopo(` e a citação (`regra\s+10`,
`20`, `70` e `80` sem outro dígito depois, e `lgpd`, sem diferença de maiúscula; e as decisões do item M6 da retro (D45, D47, D55 a D59 e D64),
com o D maiúsculo e sem letra, dígito, `_` ou `#` colado antes, nem letra, dígito ou `_` colado depois, que somam o `conformidade-reviewer` como a
regra 70). A `decidirCommit` une os marcados e os de toda tarefa com os do caminho
dos **arquivos que o commit leva** (`entrada.arquivos`), e não dos alterados da árvore: o guardião do que fica fora do commit é cobrado no commit que o levar
(`obrigatoriosDoCommit`, em `portao.ts`). O `conteudoDe` do `PreToolUse` lê o disco como índice e o HEAD pelo git (`conteudoDoHead`, em `comando-git.ts`); o do git
hook lê o índice e o HEAD pelo git. O `portao-local.ts` imprime `Revisores obrigatórios: …` (`linhaDosObrigatorios`) na primeira linha do subcomando `revisores`, que
cobra essa mesma lista, e com `▶` no início do portão da tarefa, a partir dos arquivos alterados da árvore.

**(c) O hook sem cópia congelada.** Julga o hook da árvore. Tarefa que mexe em `tools/processo/` roda o
`hook-portao.test.ts` com o comando do `settings.json`. Se ele quebrar, o papel conserta pelo Edit, que não passa
pelo hook, ou o Joaquim roda no terminal dele o socorro de `docs/processo-sem-maestri.md`
(`git -C <checkout> checkout origin/develop -- tools/processo .claude/settings.json`), que perde o não commitado e
não apaga os arquivos novos da branch; o conserto, ele commita fora de sessão de papel.

**(d) O RF17.** A fonte é o diff da árvore contra a base, não o documento. É produção o arquivo de `apps/*/src/**` ou
`packages/*/src/**` que não é teste nem `.d.ts`. Com produção alterada, o portão falha sem bloco ` ```mutacao ` no
documento e sem a linha `**Sem mutação:** <motivo>` (motivo vazio recusado). O documento é achado pela marca da tarefa,
não por conter bloco, e a mesma exigência vale na `decidirCommit`: carimbo de outro portão não passa. O `--faltando`
olha as linhas acrescentadas com `if`, `&&`, `||`, `??`, `? :` de valor, `case`, `.where(` ou expressão regular, fora
de teste; trata como alcançada a linha cujo texto um bloco do mesmo arquivo cita; e só imprime.
No código (9.0): a base é o `HEAD` (`git status` para a produção alterada, `git diff -U0 HEAD` e os arquivos novos para
o `--faltando`); a marca da tarefa é a alteração do documento na árvore, e o portão acha o único documento de tarefa ou
de correção alterado (`documentoDaTarefa`; com mais de um e sem o `.md` na linha de comando, nenhum, e a produção
alterada fica vermelha pedindo o documento). A exigência (`exigenciaDeMutacao`, em `mutacoes.ts`) chega ao commit pela
conferência que o hook já recebe, `avaliarMutacoes`, que agora recebe também os arquivos alterados da árvore; o
`avaliarPortao` não a leva porque `portao.ts` não importa `mutacoes.ts` (o `ConferenciaDoDocumento` existe para isso).
O carimbo ganha o campo `documento` (o que o portão da tarefa achou): sem bloco, a linha `Sem mutação` não deixa rastro
no carimbo, e é o campo que prova que o portão foi o deste documento. A linha é alcançada quando algum bloco do mesmo
arquivo cita o texto em qualquer linha do trecho, inclusive a de contexto (o `.where(and(` do exemplo do `executar-task`).
Produção só apagada fica fora: o `arquivosAlterados` pula o arquivo com estado `D`, e a tarefa que só remove código de
produto não é cobrada (não há linha nova a provar). A linha `Sem mutação` dentro de um bloco cercado conta, e quem copia
o exemplo do guia para o documento a libera por engano; o motivo é o que o revisor lê. O caminho do `.md` pedido ao
portão é normalizado para relativo à raiz antes de ir ao carimbo.

**(e) O RF16.** `PASTAS_DE_CODIGO` vale para toda sessão. Em sessão de papel e em toda sessão do Claude Code, o Orquestrador inclusive (o `PreToolUse` passa
`sessaoDoClaudeCode` à `decidirCommit`; correção `2026-11-21-commit-de-processo-fora-de-tarefa`), somam-se `tools/`, `.github/`,
`.claude/settings*.json`, `.claude/hooks/`, `docs/aia/ouro/`, `docs/aia/ouro-retido/`, `package.json`, `compose.yaml`, `.env.example`,
`eslint.config.mjs`, `eslint-suppressions.json`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`,
`knip.json`, `.gitleaks.toml` e `.size-limit.json`. Os guardiões de cada um estão na tabela. Skill, papel,
regra, AIA e o resto de `docs/` continuam documento.

**(f) Esteira, censo e encontro.**
- **`concurrency`:** em `spec/**` e `correcao/**` (evento `push`), o grupo é a ref, com `cancel-in-progress: true`. No
  `pull_request`, é `pr-<número>`, também com `cancel-in-progress: true`: o push novo no PR substitui a execução dele. Em
  `develop`, `release`, `main` e `workflow_dispatch` (inclusive numa branch de spec), é o `run_id`, com `cancel-in-progress`
  falso: nunca cancela nem enfileira. As duas expressões leem só `github.event_name`, `github.ref`, `github.run_id` e
  `github.event.pull_request.number`, e o teste as avalia ref a ref com essa lista fechada. Sem `pull_request_target`
  nem segredo, com `permissions: contents: read`
- **Veredito (RF2):** `cancelada` é o que o GitHub diz; `superada` não é estado guardado. A cancelada com execução mais
  nova na mesma branch, de evento `push` (`criadaEm` estritamente maior: o empate não supera), é descartada, e a execução
  que vale para o commit é a mais nova das que sobram; a cancelada sem sucessora é vermelha e cita o job (o `timeout-minutes`
  inclusive). O `gh run list` roda uma vez por evento do veredito, `push` e `workflow_dispatch` (a execução manual é o que
  o relatório manda disparar quando o push não gerou execução, e sem ela o fechamento da spec ficaria preso em "nenhuma
  execução"); o `pull_request` fica de fora, e só o `push` supera. O veredito sai da mais nova cujo código é o do HEAD;
  commit só de documento vale pelo de código, como hoje
- **Censo (RF9):** o `ci.yml` sobe só o reporter JSON de cada fatia, sem trace nem anexo, também no verde, por 7 dias.
  No código (4.0): o passo do `npm run ci:e2e` liga o repórter com `EDUCA_RELATORIO_DO_E2E: censo-do-e2e.json` (a única `env`
  do YAML, e o teste de "sem segredo nem ambiente" a aceita só ali), e o passo seguinte publica `censo-do-e2e-<fatia>` com
  `path: censo-do-e2e.json`, `if: success() || failure()` (o cancelado por prazo não termina o relatório) e
  `overwrite: true` (reexecutar a fatia vermelha que passa publica o mesmo nome). O `--censo` acha a execução **terminada mais nova
  com o e2e verde** (`ultimaComE2eVerde`, M4 da retro da F4b, correção `2026-11-21-commit-de-processo-fora-de-tarefa`): entram a verde e a
  vermelha, ficam de fora a rodando e a cancelada, e vale a que tem o job `e2e <fatia>/<total> (…)` de **toda** fatia de `FATIAS_DO_E2E` em
  `success` (job pulado, cancelado ou ausente não vale pela fatia), mesmo com outro job vermelho, o `verificar` por exemplo, que o
  `gh run view --json jobs` diz. Ele lê os artefatos das fatias (`gh api …/artifacts`, `gh run download --name`) e lista o caso com
  `duracaoMs * 3 > prazoMs * 2`, **lendo o prazo do próprio relatório** (`casosMedidos`: o `timeout` que o Playwright
  deu ao caso, com `slow` e `setTimeout` aplicados), e não o do fonte (`prazosDosCasos`, que é do HEAD e não do commit
  da execução). Sai 0 sem caso na lista, 1 com a lista, e 2 quando não há o que ler: "nenhuma execução com o e2e verde", fatia sem
  artefato ou de artefato expirado (o texto diz quais, em separado), e nenhuma fatia é lida então, porque lista de uma
  parte da suíte passaria pela suíte inteira. O topo do relatório diz qual execução leu e o que estava vermelho fora do e2e
  (`foraDoE2e`: `leu a execução <id> (<sha>), com o e2e verde; vermelho fora do e2e: <jobs>.`)
- **Retitulado (RF11):** sem o título no HEAD, vale o caso cujo corpo sem o título é idêntico; corpo mudado, ou dois
  corpos iguais, não herdam prazo. No código (4.0): o corpo é o texto do caso sem comentário, até o próximo `test(` ou
  `test.describe`; o título novo herda só se o HEAD tinha **um** caso com aquele corpo e a árvore (`git ls-files
  --cached --others --exclude-standard -- e2e/`, só `*.spec.ts` que ainda existe) tem **um** só: o corpo copiado para um
  caso novo, com o título velho ainda lá, não herda
- **Quadro (RF3, RF6):** `abrir`, `partida`, `abandonar` e `encontro` pegam o mesmo `flock`, no `.processo/` da raiz
  do andar, relêem o quadro e gravam só a própria linha; quem espera tem prazo de 7 min e sai com "encontro em curso";
  o `abrir` grava a linha ocupada e só então solta a trava para o `npm ci`; depois, pega a trava de novo e a grava livre,
  ou, se o `npm ci` falhou, tira a linha do quadro e manda abrir de novo; se essa espera passa do prazo, a linha fica
  ocupada e a saída manda `abandonar <n>` e abrir de novo. No código (5.0): a trava é um `flock` que um processo do
  próprio comando segura (`flock -w <prazo> -E 99 <arquivo> sh -c 'echo travado; cat'`; solta ao fechar a entrada dele e
  morre com o comando, sem arquivo para limpar), e por isso `abrir`, `partida`, `abandonar`, `encontro` e `fechar` (que
  também muda o quadro) devolvem `Promise<Resultado>`. A linha em abertura é `abrindo: true`, com `base` (a branch da
  spec); `abandonar` a tira do quadro, e a que tem trabalho fica livre, com a branch e o checkout como estão. O ponto de
  injeção do encontro é `Opcoes.comandoSobATrava` (`EDUCA_ENCONTRO_SOB_A_TRAVA`: `sh -c` no checkout da linha, com a
  trava, antes do merge; saída diferente de 0 recusa sem mudar nada) e a 6.0 o põe depois do merge. O `conferir` compara
  com a `base` do quadro (sem ela, com a `spec` do quadro); no andar da própria spec, ou sem quadro, com a `develop`
- **Encontro (RF3):** tipagem e lint no checkout da linha, depois do `merge --no-edit` da spec e antes do `--ff-only`,
  com prazo de 3 min, ou 6 com `npm ci` quando o lock mudou, em grupo de processo próprio. No vermelho ou no prazo, nesta ordem: o
  grupo morre como o da mutação (§7c), a linha volta ao commit de antes do merge, a trava é solta; a spec não anda, sem push, linha ocupada, código de saída próprio, e a saída diz que a correção refaz o merge. No código (6.0): a verificação é
  `Opcoes.comandoSobATrava` (`EDUCA_ENCONTRO_SOB_A_TRAVA`), no lugar de `npm run typecheck && npm run lint`, e roda
  **depois** do merge (o ponto de injeção da 5.0, que ficava antes, passou para cá). Se o `package-lock.json` difere entre o
  commit de antes do merge e o de agora, o comando vira `(npm ci) && (verificação)`, com o `npm ci` de
  `Opcoes.comandoDeInstalacao`, e o prazo único passa de 3 para 6 min (`prazoDaVerificacao`, `prazoDaVerificacaoMs`,
  `EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS`; só o teste os troca). O comando roda por `sh -c` em grupo de processo próprio
  (`detached`: o pgid é o do `sh`), com a saída no erro do encontro. Quando ele acaba (passou, vermelho ou prazo), e
  também quando o encontro recebe SIGINT, SIGTERM ou SIGHUP (que valem como vermelho), o grupo inteiro morre: SIGTERM e,
  `esperaAteSigkillMs` depois (5 s; `EDUCA_ENCONTRO_ESPERA_ATE_SIGKILL_MS`), SIGKILL, e o encontro espera o grupo sumir antes de
  tocar na árvore. Só então vem o `git reset --hard <commit de antes do merge>` e a trava se solta (ao devolver o
  `Resultado`). Saída 5 (`CODIGO_DA_VERIFICACAO`), que não toca o quadro: a linha segue com a tarefa. Se o reset falha, a
  saída diz “A LINHA NÃO VOLTOU” com o comando para desfazer. Verde ou vermelho, a saída diz o comando que rodou, e por
  isso a verificação trocada pelo ambiente não passa calada. O prazo de 7 min de quem espera a trava ficou como estava
  (já passa de 6 min mais os 5 s do SIGKILL). `linhas.ts` tem a sua `sinalAoGrupo` e a sua `matarGrupo`, e não importa as
  do `mutacoes.ts`: aquele arquivo roda copiado fora da pasta e só pode importar `node:`

**(g) A limpeza (RF27).** O `nohup` grava `pedida`. O início de sessão com `source: clear`, sem `CLAUDE_CODE_AGENT`, no
térreo, grava `feita`. A vigia acorda o Orquestrador quando a `pedida` passa de 10 minutos sem `feita` depois dela.

**(h) A mensagem colada (RF29).** Hook `UserPromptSubmit` (`.claude/hooks/aviso-de-sessao.sh`), só em sessão sem
`CLAUDE_CODE_AGENT`. Olha o `/seguir ` no começo da entrada, depois de espaço ou quebra de linha e do embrulho opcional
`<pasted_content id="…">` que o terminal põe no que se cola (`/^\s*(?:<pasted_content id="[\w-]+">\s*)?\/seguir /`); o
`/seguir` no meio do texto não dispara, e `prompt` que não é texto também não. Devolve o contexto "leia
`.claude/skills/seguir/SKILL.md` e siga com esta entrada". Não grava o texto (correção
`tasks/correcoes/2026-10-24-aviso-mensagem-colada.md`).

## 6. Isolamento

Nenhum dado de escola.

## 7. Dado pessoal

Nenhum campo. O log do hook leva caminho e revisor; achado cita `arquivo:linha`, nunca o valor.

## 7b. Conformidade CNE

Sem IA; o RF15 e o RF16 cobram o `conformidade-reviewer`.

## 7c. Carga e falha

Fora do caminho quente.

| Falha | O que acontece |
|---|---|
| O hook nativo não carrega | commit de papel recusado; o Joaquim passa (§5a) |
| `core.hooksPath` ausente | o início de sessão avisa |
| Hook quebrado | socorro (§5c) |
| `gh` fora | `esteira.ts` sai 2 |
| Mutação travada | corrida limpa medida, teto de 10 min; a mutada tem o maior entre 3 × a medida, o `testTimeout` do projeto (ou o do caso) e 60 s, até 10 min. Grupo de processo próprio, SIGTERM e, 5 s depois, SIGKILL; o bloco fica `recusada`, o arquivo volta e o `flock` é solto |
| Lint vermelho ou prazo estourado no encontro | §5(f) |

## 9. Frontend, skills, regras e papéis

Sem tela. O texto (RF20 a RF25) está em `texto.md`: cada skill de terceiro (sai a `frontend-design`; cinco ficam com o
conflito na primeira linha depois do frontmatter), o destino de cada seção do `CLAUDE.md` (base fixa até 40.000 B), os
`paths:` da 00, 40, 60 e 80 (a 10, a 20 e a 70 sempre carregadas, sem perder item), as contradições com o
lugar que fica, o `/seguir` partido em `passos/` e as paradas que viram aviso (D79 revista). Sai a `status`; o
`separar-achados.ts` espera o ok do Gabriel.

**O `/seguir` partido (17.0, 24/10/2026).** `passos/` tem `3-time-e-andar.md`, `4-documentos.md`, `6-tarefa.md`, `7-paradas.md`,
`8-validacao-e-pouso.md`, `9-vigia-e-contexto.md`, `10-avulsos.md` e `estado-md.md`; o número do arquivo é o do passo, e o primeiro título do
arquivo repete o número, de modo que "passo N" em qualquer skill continua apontando o lugar certo. O orçamento é de **24.000 B**
(decimal, como os 41 KB de hoje, que são 41.050 B), no teste `tools/processo/harness/seguir.test.ts`: 24.000 passa e 24.001 é vermelho; a
medida de depois é 23.932 B (6.843 do `SKILL.md`, 7.857 do protocolo e 9.232 do `passos/6-tarefa.md`), com 68 B de folga: o próximo acréscimo num dos três precisa tirar texto de outro lugar deles, ou o teste fica vermelho. O passo 6 traz as quatro coisas da
página (a limpeza, a abertura de linha, o reinício do par com `recruit --replace` e as saídas do encontro, a de código 5 incluída) e o
`Agora` do `estado.md` em uma linha por campo. O censo do e2e (RF9) é do passo 8, depois do `esteira.ts --fechamento`. A **ressalva menor**
(D79 revista) é assim: o Validador só dá "APROVADA COM RESSALVAS" quando há achado maior, e o menor vai à seção 6 do relatório; o
Orquestrador o leva ao `TODO.md` no fechamento. Se mesmo assim o veredito vier com ressalvas e **todas** forem menores e fora das regras 10,
20 e 70, ele escreve o aceite com "aceitas por Orquestrador (aviso da D79)", que é o que o `estado.ts` lê. Os commits `Fora do processo:`
com código da spec saem na seção 6 do relatório (`validador.md`, seção 5, e `validar/SKILL.md`, passo 3).

**Um fato num lugar só (18.0, 24/10/2026).** Cada contradição do `texto.md` ficou onde está dito abaixo; nos outros lugares a frase
saiu ou aponta para lá. Esteira "uma vez por spec" × "em todo push": a D79, com `(revista pela D79)` nas D53 e D78 do
`docs/decisoes.md`, e o `corrigir` diz que a esteira roda em todo push e que o Orquestrador lê o veredito. "`test-engineer`
primeiro" × revisores juntos: o passo 2 do `revisar-tarefa`. `vigia`: a tabela dela ("a tabela acima é tudo o que a vigia faz"),
com o arquivo de cada passo do `/seguir`. `/corrigir`, `/retro`, `/validar` e as outras como comando × `user-invocable: false`:
`/seguir` é o único comando, e o resto é nome de skill, sem a barra, nos papéis, nas skills, no `CLAUDE.md`, no `ROADMAP.md` e em
seis documentos de `docs/`. Identidade visual "em aberto" × D80: a D80, com uma frase no conflito "Pele do produto" do topo do
`docs/decisoes.md`, e a `descobrir` sem o exemplo. Pasta de adaptadores: já na 16.0. **Tabela natureza → guardião**: a tabela por
natureza fica **uma só**, em `criar-tasks/SKILL.md` ("Subagentes obrigatórios por natureza da tarefa", que ganhou "indicador de
professor" na linha da `conformidade-reviewer`); o `revisar-spec` e o `revisar-tarefa` apontam para ela, e o que o caminho pede
fica em `guardioes-por-caminho.ts`, descrito em `tabela-de-guardioes.md`. "O arquivo existe antes do commit": o protocolo (item 4)
e a recusa do hook; o `executar-task` e o `corrigir` apontam para lá. A mensagem do commit vai num arquivo, por
`git commit -F <arquivo>` (18.4a), porque o hook procura `Revisões:` no começo de uma linha e vários `-m` a deixam no meio do
comando. Regra 80, item 5: nota datada de 24/10/2026 (a sessão é lida do Postgres; a N2 da X5 decide, com dois limites: p95 de
`sessao.leitura.duracao` até 50 ms e espera do pool até 100 ms), sem mudar a linha `Checagem:`. `docs/aia/ouro/README.md`: já
manda `(correção <slug>)` com o `conformidade-reviewer` (14.0).

**Os blocos repetidos entre revisores (18.3).** A seção "Severidade e rodada nova" é igual nos seis revisores com veto
(`REPROVADO só com…`) e, em outra família, igual nos três sem veto (`AJUSTES NECESSÁRIOS só com…`); o que era só do `revisor-geral`
(invadir escopo, divergir da spec em silêncio, carimbo, "o bloqueante do `test-engineer` não é seu") foi para a seção
`## O que é bloqueante só para você`. O bloco "Quando o prompt traz fotos da tela" tem três parágrafos nos quatro que o têm
(`privacy-guardian`, `conformidade-reviewer`, `revisor-geral`, `pedagogia-reviewer`): o começo e o fim são iguais, e o do meio
é do papel. A lista "O que verificar" e o formato da resposta dos quatro guardiões com veto não mudam: a gravação de
24/10/2026 está em `tools/processo/harness/__fixtures__/revisores-antes/` e o `revisores.test.ts` compara byte a byte. Os
`frontend-reviewer`, `pedagogia-reviewer` e `llm-integrator` mudaram só a frase "para a validação e a retro".

**O `executar-task` sem diário (18.4).** Os 26 casos datados foram para `docs/processo-licoes.md` (data, origem, o que
aconteceu, onde a regra ficou); a autoconferência virou 12 perguntas numeradas na seção `## Autoconferência` do
`task-template.md`; o arquivo tem 342 linhas, com limite de 499 no `revisores.test.ts`.

**Skills, papéis e metadados (19.0, 24/10/2026).** A auditoria das 26 skills (as 14 do processo e as 12 de terceiros, antes de
saírem duas) é a seção 2 do `docs/processo-licoes.md`; as lições do `executar-task` são a seção 1, e o `revisores.test.ts` só lê
lição dali (a tabela da seção 2 não tem data). Saem a `frontend-design` (pasta e `skills-lock.json`) e a `status` (pasta, a lista do
`seguir/time.md` e o comentário do `estado.ts`). **Onde a citação da `status` se procura:** `.claude/agents/*.md`, `.claude/rules/*.md`,
`.claude/settings.json`, todo `.md` das skills nossas (as que não estão no `skills-lock.json`), `.claude/hooks/*`, o `CLAUDE.md` e os `.ts` de
`tools/processo/` que não são teste (o `estado.ts` a citava); a forma procurada é `` `status` `` entre crases, `/status` e `skills/status`.
Ficam fora a skill de terceiros, que pode falar de `status` de uma API, e o `docs/`, porque a auditoria das skills e o
`docs/skills-de-terceiros.md` falam da skill que saiu; o `grep` da subtarefa 19.3 sobre o resto da árvore é feito à mão, nesta tarefa. As cinco de terceiros levam o conflito na linha imediatamente depois do frontmatter,
igual ao `docs/skills-de-terceiros.md`; linha em branco antes dela já é vermelho. Cada papel do time ganha `## Critério de saída`
com os itens `- **Terminou quando:**` e `- **Entrega:**`. O teste é `tools/processo/harness/metadados.test.ts`. **`tools` no papel
(RF30):** os quatro papéis do time (`arquiteto`, `implementador`, `mesa-de-revisao`, `validador`) não declaram `tools`, porque
herdam as ferramentas do terminal que os inicia (`claude --agent <papel>`), e uma lista fechada neles tiraria do terminal o MCP e as
ferramentas adiadas; por isso só os papéis de revisão, que são subagentes, precisam de `tools`, e o do time precisa de `name`, `model`
e do critério de saída. **Dois defeitos que o teste achou no repositório de hoje e a tarefa corrigiu:** a `description` do
`test-engineer` não era YAML válido (`sempre: na criação`; agora entre aspas), e o `paths:` da regra 30 tinha `**/agentes/**`, que não casa
com pasta nenhuma (saiu; nenhuma outra regra mudou o que carrega).

**Receitas (RF32, decisão do Joaquim, 23/10/2026).** A receita mora no `docs/guia-do-desenvolvedor.md` (§5 as receitas,
§7 as travas); a skill `.claude/skills/receitas-de-codigo/SKILL.md` só aponta. Frontmatter com `name` e uma `description`
que contém as palavras dos seis assuntos (`endpoint`, `tabela`, `job`, `IA`, `tela`, `isolamento`), que é como o
Claude Code a carrega pelo assunto. O arquivo inteiro, frontmatter inclusive, até 60 linhas e 6.000 B, sem código (nem cerca ` ``` ` ou `~~~`, nem bloco
recuado de quatro espaços), é uma tabela com uma linha por `### 5.x` do guia: o número da seção; o exemplo, um caminho a
partir da raiz que está na linha que contém `Exemplo:` naquela seção; e as travas que pegam a receita, cada uma com o texto exato da
célula da coluna "Trava" da tabela da §7, crases inclusive, separadas por `;`. Fora da tabela, três frases: ler a seção antes de escrever; o que se afasta da receita
vai à seção 11 da Tech Spec com o motivo (D81); e quem muda o exemplo no guia muda a linha da skill no mesmo commit (a conferência do
exemplo é o que garante esta). A
seção `## 1. Contexto` do `executar-task` e o §2 do `criar-techspec/template.md` citam a skill; o mapa do `CLAUDE.md` cita o guia, e o
topo do guia cita a skill.

**O que conta como caminho, no `receitas.test.ts`:** dos tokens que a extração da 16.0 devolve (entre crases, entre aspas
ou com `./`), sem mudar o que ela devolve nem o que a 16.0 confere (ela devolve o token cru, com `<...>`, `*` e a `/` final, e
cada teste filtra o seu), só o que começa por uma destas pastas: `apps/`,
`packages/`, `tools/`, `e2e/`, `infra/`, `docs/`, `.claude/`.
O resto não é conferido: fragmento relativo (`componentes/dialogos.tsx`, `turma.ts`), nome de regra de lint
(`guardas/log-sem-dado-pessoal`), rota (`/v1/disciplinas`), glob sem pasta (`*.controller.ts`), `<modulo>.module.ts`.
Caminho com placeholder `<...>` confere a pasta antes dele; com `*`, casa ao menos um arquivo; o resto existe.
`tools/processo/harness/receitas.test.ts` confere os caminhos da skill e das §5, §6 e §7 do guia, que toda `### 5.x`
tem linha e toda linha aponta seção que existe, com exemplo e ao menos uma trava, e o texto presente nos quatro
apontamentos. Os casos estão no `cenarios.md`, RF32.

## 10. Testes

Os cenários, dos dois lados, estão em `cenarios.md`. Toda regra nova tem bloco de mutação. O `hook-git.int.test.ts`
roda sem o `globalSetup` do compose, e o portão o inclui quando `tools/processo/` muda: é o projeto `processo` do Vitest
(`vitest.config.ts`), com `testTimeout` de 60 s porque cada caso faz commit e push de verdade. Entra no `npm run test` e no
`ci:verificar`, e não no `ci:integracao`, que sobe o compose. Cada checagem do harness tem
amostra quebrada e contagem mínima. Os rótulos vêm das constantes do hook e do `estado.ts`.

## 11. Conformidade com as regras

Sem desvio. A 10, a 20 e a 70 seguem sempre carregadas e cobradas pelo caminho; a 00, a 40, a 60 e a 80 ganham
`paths:`, com o RF17 na 40.

**O critério do RF20 é de bytes, e não de linhas (15.0, 23/10/2026).** O PRD diz "`CLAUDE.md` com até ~150 linhas", e o
teste prova a base fixa (`CLAUDE.md` mais as regras sem `paths:`) em até 40.000 B. O `CLAUDE.md` ficou com 227 linhas,
porque só a lista de D1 a D81, uma linha por decisão, ocupa 83. A medida de depois: 12.920 B no `CLAUDE.md` e 34.326 B de
base fixa (antes, 36.351 B e 75.218 B). O "~150" do PRD fica como estimativa; o vermelho é o do `cenarios.md` C, RF20.

**A checagem de cada item das regras (16.0, 23/10/2026).** Cada item numerado das nove regras termina numa linha
`Checagem:`, com o teste (o caminho), a guarda (`guardas/<nome>`) ou o revisor (o nome do arquivo de `.claude/agents/`), ou com a
frase "só a revisão garante" (e o revisor entre parênteses). `tools/processo/harness/checagens.test.ts` prova que cada
um existe. A regra 40 não tinha item numerado, e ganhou a seção "As regras e a checagem de cada uma", com sete. As checagens
custaram 5,2 KB: a base fixa passou de 34.326 B para 39.535 B, ainda abaixo dos 40.000 B do RF20. A extração dos caminhos ficou
exportada de `caminhos.test.ts` (`extrairCaminhos`, `ehCaminho`, `problemaDoCaminho`), e a 21.0 a move para `caminhos.ts` sem
mudar o que devolve. Os caminhos conferidos hoje são 181, e não os 121 que a especificação contou: as checagens das regras
acrescentaram os testes que elas citam. O teste não prova que a checagem escolhida prova o item; isso é da revisão.

## 12. Premissas não verificadas

- ✅ VERIFICADO pela 1.0 (`1_task.md`, "Prova da premissa", 23/10/2026): o `CLAUDE_CODE_AGENT` chega ao Bash do papel
  e dos subagentes, nunca vazio, mas **no subagente o valor é o papel do terminal que o chamou**, e não o nome do
  subagente: o `revisor-geral` chamado pela Mesa vê `mesa-de-revisao`. Por isso a 11.0 e o hook nativo (§5a) perguntam
  só se o valor está em `PAPEIS_DO_TIME`, e **nada** pode supor `CLAUDE_CODE_AGENT=revisor-geral` (nem outro nome de
  revisor) para saber quem está rodando. O Orquestrador, sem `--agent`, não tem a variável, e o hook não age nele.
  O que a 1.0 deixou sem medir, o subagente de outro papel, o Arquiteto mediu no mesmo dia: o subagente que ele chama vê
  `arquiteto`. A regra vale para todo papel que chama subagente
- ✅ VERIFICADO pela 15.0 (`15_task.md`, "Divergências", 23/10/2026): o subagente (`general-purpose`, chamado por uma
  sessão `claude -p`) que lê `apps/api/src/main.ts` recebe a regra 00 como bloco automático de instruções, em mensagem
  própria **depois** do resultado do `Read`; antes de ler, e depois de ler só o `README.md`, não a tem. Os revisores
  não precisam mandar ler as quatro regras, e a saída do §9 não se aplica
- ⚠️ VERIFICADO EM PARTE pela 20.0 (`20_task.md`, "Divergências", 24/10/2026), numa sessão real (`claude -p`) com hooks que
  gravam a entrada: o `UserPromptSubmit` recebe o JSON com o texto em `prompt`, literal, e o que o hook escreve no stdout
  chega ao modelo como contexto; o `SessionStart` recebe o JSON com `source` (visto `startup`). O texto *colado* não chega
  como foi digitado: as transcrições do Orquestrador (`~/.claude/projects/-home-joaquimdp-Documentos-git-Educa-ia/*.jsonl`)
  gravam a mensagem `/seguir` colada embrulhada, `<pasted_content id="…">`, quebra de linha (às vezes com linha em branco, e
  às vezes com quebra antes do embrulho) e só então o `/seguir `. A expressão do hook (§5h, correção
  `tasks/correcoes/2026-10-24-aviso-mensagem-colada.md`) casa com as 331 mensagens `/seguir` coladas que a validação mediu
  em 24/10/2026 e com nenhuma das 35 coladas que não são `/seguir` (`validacao.md`, rodada 2, RF29). **Não provado**, porque
  pede sessão interativa: que o `prompt` do `UserPromptSubmit` traz o texto como a transcrição o grava (o hook aceita a forma
  pura e a embrulhada, e dispara nas duas), e que `/clear` entrega `source: clear`. Os dois hooks agem sobre o que o JSON diz;
  se algum não valer, o RF29 e a `feita` do RF27 não disparam, a `pedida` sem `feita` faz a vigia acordar o Orquestrador, e o
  aviso de início de sessão (`contexto-inicial.sh`, que já lê `clear` e `compact`) continua sendo a rede. O Joaquim vê isso
  na primeira mensagem `/seguir` colada no térreo depois do pouso (o aviso chega) e no primeiro `/clear` do Orquestrador
  (`.processo/limpeza.json` ganha a `feita`)

## 13. Riscos técnicos

- Um `exit 2` errado trava o time: defesa no `hook-portao.test.ts`, no Edit e no socorro (§5c)
- Os quatro guardiões custam mais: rodam juntos, e a X4 mede
- Texto curto perde instrução: nada sai sem destino (RF22)
