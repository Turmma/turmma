# Achados das revisões — `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 01:05:22 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica: a mudança fica toda em `tools/processo/`, no tooling do processo; nada em `apps/`, `packages/`, `infra/`, `e2e/` ou `.github/`)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (nada novo a proteger: a decisão do commit é uma função pura no hook, e o censo é só leitura do `gh`)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: não há código novo no caminho quente nem alerta novo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts`, `ultimaComE2eVerde`: quando o e2e fica vermelho por muito tempo, o laço faz um `gh run view --json jobs` por execução, um depois do outro, até as 30 do `--limit '30'` (linha 387). É só lentidão do `--censo` e não bloqueia. Se isso incomodar, a correção é pedir os jobs junto no `gh run list` ou parar depois de N execuções sem e2e verde.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts`, `e2eVerde`: o casamento pelo prefixo `e2e <fatia>/<total> ` depende do nome do job no `ci.yml`. Se o `name` da matriz mudar, todas as execuções passam a cair em "nenhuma execução com o e2e verde", sem nenhum outro aviso. Um teste que leia o `name` do job de e2e direto do `ci.yml` pegaria a divergência.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 01:05:31 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff só mexe no portão de commit, na esteira, nos testes deles e em dois documentos de processo. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nem a governança nem a declaração de agentes foram tocadas.
Bloqueantes: nenhum
Recomendações:
- A mudança reforça a regra 70 em vez de afrouxá-la. Antes, o Orquestrador podia commitar `docs/aia/ouro-retido/` sem documento. Agora esse commit é recusado na sessão do Claude Code, e o caminho de volta passa pela correção com o `conformidade-reviewer`. A mensagem de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts:342` bate com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/guardioes-por-caminho.ts:83`, onde `docs/aia/ouro-retido/` leva o guardião C. Se um dia essa tabela mudar, a mensagem fica desatualizada, porque o nome do revisor está escrito à mão nela. Vale gerar a mensagem a partir da tabela.
- O documento da correção declara um limite: o commit feito por `env -u`, por script ou por `sh -c` não passa pelo `PreToolUse`. Nesse caso, quem segura o conjunto de ouro da AIA é só a esteira (`conferir-entregas`). Isso já valia para as sessões de papel, e não é regressão. Fica registrado para a retro.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 01:05:38 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO

Esta correção só mexe em ferramentas internas: o hook de commit e o censo do e2e. Ela não toca nenhum campo, endpoint, log, arquivo guardado, envio a modelo nem dado de aluno, professor ou família.

Campos pessoais tocados: nenhum. As mudanças estão em `tools/processo/portao.ts`, `tools/processo/esteira.ts`, nos três arquivos de teste, em `.claude/skills/seguir/passos/8-validacao-e-pouso.md` e no §5(e) de `tasks/prd-harness/techspec.md`. Não há migration, schema, DTO nem rota.

Fora da tabela de dados do docs/lgpd.md: nada. Não entra campo pessoal novo.

Autorização por objeto: não se aplica, porque não há rota nova nem alterada.

Logs: limpos. A única saída nova é o topo do relatório do censo (`tools/processo/esteira.ts`, em `topoDoCenso`). Ela traz o nome da branch, o id da execução, o sha curto e o nome dos jobs do CI. Não traz nome, matrícula, resposta, nota, conversa nem prompt.

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum. A chamada nova, `gh run view <id> --json jobs` no `main` do `--censo`, só lê metadados do CI no GitHub. A função `jobsDoGh` guarda apenas `name` e `conclusion` de cada job e descarta o resto do JSON. Nada é enviado.

Seed/fixture: sintético. Os dados novos dos testes são nomes de job do `ci.yml`, execuções com sha fictício (`'d'`, `'a'`) e caminhos como `docs/aia/ouro-retido/x.json` e `tasks/correcoes/2026-09-13-x.md`. Nenhum dado de pessoa.

Sobre a regra 20: a mudança deixa o processo mais protegido. Antes, o Orquestrador conseguia commitar `docs/aia/ouro-retido/` sem nenhum revisor, e o `conformidade-reviewer` só entrava depois, pela esteira. Agora, em toda sessão do Claude Code (`sessaoDoClaudeCode: true` em `bloqueioDoCommit`), esse commit também precisa de tarefa ou correção, com os revisores dela. O terminal do Joaquim continua sendo o único caminho com `Fora do processo:`, como antes. O limite que a correção declara (`env -u`, `sh -c`) segue coberto pelo `conferir-entregas` da esteira.

Pergunta de fechamento: a mudança não guarda nem envia nada sobre aluno, então não altera a resposta que o sistema já dá à secretaria.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 20.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/revisoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/.claude/skills/seguir/passos/8-validacao-e-pouso.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/prd-harness/techspec.md

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-21 01:07:14 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: REPROVADO

**Escopo:** respeitado. A correção faz a M3 e a M4 da retro da F4b, como o `TODO.md` as descreve (linhas 2957 a 2965), e não faz nada além delas.

**Aderência à Tech Spec:** divergência em `tasks/prd-harness/techspec.md` §5(f) e em `tasks/prd-harness/cenarios.md` RF9. O §5(e) foi atualizado para a M3. A mudança da M4 ficou só no documento da correção e no código.

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo).

**Bloqueantes:**

1. **`tasks/prd-harness/techspec.md:202-207`.** O §5(f) ainda diz que o `--censo` "acha a última execução verde" e que sai 2 "sem execução verde". O código agora lê a execução terminada mais nova com todas as fatias de e2e verdes, mesmo com o `verificar` vermelho (`ultimaComE2eVerde`, `tools/processo/esteira.ts:287`), e informa o que estava vermelho fora do e2e. A seção "Correção" do documento cita só o §5(e) entre os docs tocados, então a M4 mudou o comportamento sem a Tech Spec saber.
   - **Correção exigida:** reescrever o §5(f). Ele deve dizer qual execução o censo lê: as terminadas, sem a rodando e sem a cancelada, com todos os jobs `e2e <fatia>/<total>` em `success`. Deve citar o `foraDoE2e` no topo do relatório e a mensagem "nenhuma execução com o e2e verde". O documento da correção passa a listar esse trecho em "Docs".

2. **`tasks/prd-harness/cenarios.md:21`.** A linha RF9 traz um cenário que o código já não cumpre: "com uma vermelha mais nova que a verde, o censo lê a verde". Ela também traz "sem execução verde: sai 2". Hoje a vermelha só no `verificar`, com o e2e verde, é justamente a que se lê. O caso novo é `esteira.test.ts`, "a execução vermelha só no verificar, com o e2e todo verde, é a lida".
   - **Correção exigida:** atualizar a linha RF9 com os casos novos:
     - vermelha só fora do e2e: é a lida, e o topo diz o que estava vermelho;
     - vermelha com uma fatia de e2e vermelha: passa para a próxima;
     - job de e2e pulado, cancelado ou ausente: não vale pela fatia;
     - nenhuma execução com o e2e verde: sai 2.

   No parágrafo RF16 (`cenarios.md:108`), acrescentar o caso do Orquestrador: sem papel, pelo `PreToolUse`, `docs/aia/ouro-retido/x.json` é recusado sem marca e aceito com `(correção …)` revisada.

**Recomendações:**

- `tasks/prd-harness/prd.md:55`: o RF9 ainda diz "na última esteira verde da spec". Vale uma nota de revisão que aponte a M4 da F4b, aceita pelo Joaquim.
- `tools/ci/esteira.test.ts:472`: o comentário "o censo só lê a execução verde" ficou desatualizado. O de `.github/workflows/ci.yml:186` ficou como estava por decisão declarada; registre-o no `TODO.md` para não se perder.
- `tools/processo/portao.ts:341-343`: a mensagem extra também sai para um subagente fora do time (`general-purpose`), mas começa com "Na sessão do Orquestrador". Algo como "Fora de papel do time" seria mais preciso.
- `tools/processo/hook-portao.test.ts:198-205`: o `semDesvioNegado` tem um desvio condicional (`if (razao === '') return`) e infere o `-a` por regex sobre o comando. Dois `it.each` separados, com e sem `-a`, cada um com a expectativa exata, deixariam o teste sem ramificação.
- `TODO.md:2957` e `TODO.md:2963`: marcar a M3 e a M4 como feitas no commit da correção, com o slug.

**Arquivos citados:**
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/prd-harness/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/prd-harness/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/prd-harness/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 01:07:15 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **M3, caminho feliz:** quando o Orquestrador commita `tools/` ou `docs/aia/ouro-retido/` sem marca pelo `PreToolUse`, o commit é recusado, e a mensagem diz o caminho (`/corrigir` ou o terminal do Joaquim com `Fora do processo:`).
- **M3, borda 1:** o mesmo commit com `(correção …)` e revisado é aceito. Sem a rodada do `conformidade-reviewer`, o guardião é cobrado.
- **M3, borda 2:** o Orquestrador conta como código exatamente o mesmo que a esteira (`ehCodigoParaAEsteira`), e documento continua passando.
- **M3, permissão:** o papel continua recebendo a mensagem de sempre, sem o trecho do Orquestrador. Fora do `PreToolUse`, ou seja no git hook nativo e no terminal do Joaquim, o commit sem papel continua passando.
- **M3, desvio:** fora de papel, o desvio do git hook continua não sendo negado.
- **M4, caminho feliz:** o censo lê uma execução vermelha só no `verificar`, com o e2e todo verde, e o topo do relatório diz qual execução leu e o que estava vermelho.
- **M4, borda 1:** a execução rodando ou cancelada fica de fora, e nem tem os jobs perguntados.
- **M4, borda 2:** um job de e2e pulado, cancelado, com conclusão `null` ou com falha não vale pela fatia, e a fatia ausente da lista de jobs também não.
- **M4, borda 3:** a execução com o e2e verde mas sem o artefato de uma fatia sai 2, e o vermelho de fora do e2e aparece no topo.
- **M4, borda 4:** sem nenhuma execução com o e2e verde, sai 2.
- **M4, leitura do `gh`:** `jobsDoGh` lê o nome e a conclusão de cada job. `jobsQueNaoPassaram` continua igual.
- **Isolamento:** não se aplica, a tarefa não toca dado de escola.
- **Concorrência:** não se aplica, é um hook e uma CLI de uma chamada só.

**Cobertos:** todos os cenários acima.
- Os cinco casos de M3 citados em "Teste que reproduz" estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/revisoes.test.ts:2285-2333`. Os seis de M4 estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.test.ts:391-468`.
- Conferi os 21 blocos de mutação contra o `git diff`. Toda condição nova tem bloco: `contaOProcesso`, o ternário de `arquivosDeCodigo`, o `return base` do papel, o texto `/corrigir`, o `sessaoDoClaudeCode: true` do `bloqueioDoCommit`, `jobsSemPassar`, `terminou`, os dois termos de `e2eVerde`, o laço de `ultimaComE2eVerde`, o `sem-verde` e o `vermelho fora do e2e` do topo.
- Cada teste citado existe com esse nome, e pelo cenário de cada um a mutação chega à cláusula. Por exemplo, a mutação `terminou → true` faz o teste pedir os jobs das execuções 13 e 14 em vez de 13 e 11, e ele falha.
- Os nomes de job usados nos testes (`e2e N/11 (compose completo e Playwright)` e `verificar (…)`) batem com o `.github/workflows/ci.yml:35` e com o `:136`.
- O terminal do Joaquim fica protegido por um teste que já existia: o caso "o arquivo de tools/ sem marca é recusado pelo commit-msg do papel (RF16), e passa sem papel", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-git.int.test.ts:187`, falharia se o `hook-git.ts` passasse a mandar `sessaoDoClaudeCode`.
- Rodei `esteira.test.ts`, `hook-portao.test.ts` e `revisoes.test.ts`: 436 de 436 passaram. Rodei também `hook-git.int.test.ts`: 52 de 52.
- Não há `.skip`, nem teste comentado, nem mock que esconda a regra. Não há chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/revisoes.test.ts:1938`: o teste de paridade do RF14 agora passa `sessaoDoClaudeCode: true` ao `peloHook`, mas o git hook de verdade (`hook-git.ts:58`) não passa esse campo. A árvore desse teste só tem `apps/` e `docs.md`, então a troca não muda nenhum resultado e só deixa o nome "peloHook" enganoso. O melhor é voltar à entrada sem o campo, que é a do hook real, ou renomear para "pela decisão do PreToolUse".
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts:390-400`: `semDesvioNegado` aceita dois resultados no caso `-anm`, a razão vazia ou o "Commit bloqueado". A cláusula que o teste prova está garantida (o desvio não é negado), mas a asserção condicional não fixa o que deveria acontecer com o commit `-a`. Vale declarar o resultado esperado por caso na tabela `negados`, em vez de usar `if (razao === '') return`.
3. `ultimaComE2eVerde` faz uma chamada `gh run view` por execução terminada até achar uma com o e2e verde. Numa branch com muitas execuções seguidas com o e2e vermelho, isso vira muitas chamadas ao GitHub. Vale anotar o teto, que é o `--limit` da listagem de execuções, ou parar após N tentativas.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 01:26:14 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff só mexe em código e documentos do processo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts` muda o texto da mensagem que recusa o commit. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts` entra a função exportada `prefixoDoJobDeE2e`, que só monta o começo do nome de um job de CI. O resto é teste, `techspec.md`, `cenarios.md`, `TODO.md` e o documento da correção. Não há migration, schema, DTO, rota nem dado de aluno.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nem objeto do produto foi tocado.

Logs: limpos. O relatório do `--censo` escreve o id da execução, o sha e o nome dos jobs vermelhos. Nada disso é dado pessoal.

Auditoria: não se aplica. O diff não tem leitura de dado de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum. O `gh run view --json jobs` só lê do GitHub o nome e a conclusão dos jobs. Nenhum dado de pessoa sai para provedor de IA nem para terceiro.

Seed/fixture: sintético. Os testes novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/esteira.test.ts` usam comandos git e nomes de job inventados. Não há dado de pessoa.

Bloqueantes: nenhum. A 1ª rodada não exigiu correções, então não havia nada a conferir.

Recomendações:
- Nenhuma desta rodada sobre a regra 20.
- Uma que já está registrada continua pertinente. O comentário em `.github/workflows/ci.yml:186` ficou desatualizado, e o documento decidiu não tocá-lo agora porque mexer em `.github/` caducaria todos os revisores por um comentário. Ele já está anotado no `TODO.md` para entrar na próxima tarefa que mexer no `ci.yml`. Quando entrar, essa tarefa precisa passar pelo `privacy-guardian`, por causa dos artefatos publicados num repositório público.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma de antes desta tarefa.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 01:26:16 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As duas correções exigidas na 1ª rodada foram feitas:

1. **`techspec.md` §5(f), correção 1.** O texto agora diz qual execução o censo lê, como a 1ª rodada pediu:
   - entram as terminadas, verdes ou vermelhas; a rodando e a cancelada ficam de fora;
   - vale a que tem o job `e2e <fatia>/<total> (…)` de toda fatia em `success`, e job pulado, cancelado ou ausente não vale pela fatia;
   - a execução é lida mesmo com outro job vermelho;
   - a saída 2 diz "nenhuma execução com o e2e verde";
   - o topo traz o `foraDoE2e`.

   O documento da correção lista o §5(f) em "Docs".

2. **`cenarios.md`, correção 2.**
   - A linha RF9 traz os quatro casos novos e não tem mais o cenário velho da "vermelha mais nova que a verde".
   - O parágrafo RF16 traz o caso do Orquestrador pelo `PreToolUse`: `docs/aia/ouro-retido/x.json` é recusado sem marca e aceito com `(correção …)` revisada. Ele separa esse caso do terminal do Joaquim e do git hook nativo, que não contam o código de processo.

As seis recomendações que a Mesa mandou aplicar também foram feitas:
- **Comentário do `tools/ci/esteira.test.ts`:** corrigido.
- **Nome do job de e2e:** `prefixoDoJobDeE2e` agora é exportado, e um teste liga o `name` do job `e2e` do `ci.yml` a ele. A mutação `e2e-` que acompanha esse teste o derruba.
- **Mensagem de recusa em `portao.ts`:** diz "Fora de papel do time (o Orquestrador, por exemplo)", e a mutação foi atualizada.
- **Teste de paridade do RF14 em `revisoes.test.ts`:** o `peloHook` não passa mais `sessaoDoClaudeCode`, como o `hook-git.ts:58` de verdade. O teste continua com sentido porque `apps/` conta como código nas duas entradas.
- **`hook-portao.test.ts`:** o `semDesvioNegado` com desvio condicional saiu. O caso do `-a` virou entrada própria (`levaOTools`), com resultado exato sem papel e com `general-purpose`.
- **`TODO.md`:** a M3 e a M4 estão marcadas como feitas. As recomendações não aplicadas estão no `TODO.md` e na tabela do documento.

Recomendações:
- `tasks/prd-harness/techspec.md:196-197`: a frase "mesmo com outro job vermelho, o `verificar` por exemplo, que o `gh run view --json jobs` diz" ficou truncada. Ficaria mais claro assim: "e o que estava vermelho vem do `gh run view --json jobs`".
- O comentário "última execução verde" em `.github/workflows/ci.yml:186` e a nota no RF9 de `tasks/prd-harness/prd.md:55` estão no `TODO.md`. Precisam ser tratados na próxima correção que mexer no `ci.yml` e na revisão do PRD pelo Arquiteto.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/prd-harness/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/prd-harness/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/revisoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/TODO.md

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 01:26:35 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- Minha recomendação da 1ª rodada foi aplicada. Agora existe `prefixoDoJobDeE2e` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.ts:254`, e o teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/esteira.test.ts:483` confere o `name` do job `e2e` do `ci.yml` (`e2e ${{ matrix.fatia }}/11 (…)`) contra o prefixo, para cada fatia da matriz. O documento da correção tem uma mutação para isso (`e2e-` no lugar de `e2e `). Rodei `tools/ci/esteira.test.ts`, `tools/processo/esteira.test.ts` e `tools/processo/hook-portao.test.ts`: 125 testes passaram.
- O custo de até 30 chamadas `gh run view --json jobs` por `--censo` com o e2e vermelho continua registrado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/TODO.md`. Esse código é ferramenta de processo, fora do caminho da escola, e não bloqueia.

O diff desta rodada só toca ferramenta de processo e documento: `portao.ts`, `esteira.ts`, testes, TODO, techspec e cenarios. Nenhum arquivo de produto, request, fila, IA ou migration foi tocado.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-21 01:27:01 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff só mexe em ferramenta de processo (`tools/processo/`, `tools/ci/`) e em documentos de processo. Nenhum caminho novo grava em `Nota`. Todos com autor humano? sim, nada mudou.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não toca nenhum fluxo de saída de IA.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim, sem mudança.

Bloqueantes: nenhum

**O que foi auditado nesta rodada.** Olhei só o diff de `b775ef47` a `9e3df366` e o que ele afeta. O que pesa para a minha regra é o caminho que protege o ouro retido da AIA, `docs/aia/ouro-retido/`, revisado pelo `conformidade-reviewer` (regra 70, 6a).

- **A mensagem de recusa** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts:342`): mudou só o começo, de "Na sessão do Orquestrador" para "Fora de papel do time (o Orquestrador, por exemplo)". Ela continua dizendo que `docs/aia/ouro-retido/` leva o `conformidade-reviewer`, e isso bate com `tools/processo/guardioes-por-caminho.ts:83`. O texto novo é mais exato, porque o `general-purpose` também recebe a mensagem.
- **A proteção continua testada.** O caso `revisoes.test.ts:2296` está lá: o commit do Orquestrador só com `docs/aia/ouro-retido/x.json` é recusado, e o mesmo com `(correção …)` revisada é aceito. A falta do `conformidade-reviewer` também segue recusada (`revisoes.test.ts:2301` e `:2357`).
- **Teste de paridade** (`revisoes.test.ts:1939`): o `peloHook` voltou a não receber `sessaoDoClaudeCode`, que é como o git hook roda de verdade. Isso não abre caminho novo para o ouro.
- **Commit com `-a` fora de papel** (`hook-portao.test.ts:298`): ganhou caso próprio com resultado exato. O commit é recusado como código sem marca, com e sem `general-purpose`. Antes o teste tinha um ramo `if (razao === '') return` que deixava o caso passar sem conferir nada; agora não tem.
- Rodei os quatro arquivos de teste afetados contra a árvore de trabalho, que é igual a `9e3df366` em `tools/`: 461 testes passaram.

Recomendações:
- Os itens da rodada 1 já estão no `TODO.md` e na tabela "Recomendações sem aplicar" do documento da correção. Falta um deles: gerar a mensagem de recusa a partir de `guardioes-por-caminho.ts`, em vez de escrever o revisor à mão. Hoje mensagem e tabela concordam.
- Fica para a retro o limite já declarado no documento da correção: commit por `env -u`, script ou `sh -c` não passa pelo `PreToolUse`. Para o ouro retido, só a esteira (`conferir-entregas`) segura esse caso.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/portao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/revisoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 01:27:28 · `tasks/correcoes/2026-11-21-commit-de-processo-fora-de-tarefa.md`

VEREDITO: APROVADO

**Cenários exigidos (2ª rodada, só o diff b775ef47..9e3df366 e o que ele afeta):**
- O teste de paridade do RF14 usa de novo a entrada do git hook de verdade.
- O caso do `-a` fora de papel tem resultado exato, sem ramo.
- Um teste liga o nome do job de e2e do `ci.yml` ao prefixo que `e2eVerde` procura, e uma mutação o prova.
- A mensagem de recusa fora de papel mudou e o teste dela continua valendo.
- A techspec §5(f) e as entradas RF9 e RF16 do cenarios.md descrevem o comportamento novo.

**Cobertos:**
- **`peloHook`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/revisoes.test.ts:1938`): voltou a ser `decidirCommit` sem `sessaoDoClaudeCode`, que é a entrada do git hook nativo.
  - A paridade continua valendo porque a árvore desse `describe` só tem `apps/`, que é código em toda sessão.
  - A diferença que se quer entre as duas entradas para `tools/` sem papel já tem teste próprio: `revisoes.test.ts:2270` (git hook passa) e `:2285`/`:2296` (`PreToolUse` recusa).
- **`semDesvioNegado` saiu** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/hook-portao.test.ts:155-195`):
  - Os `negados` sem `levaOTools` agora exigem `status` 0 e `stdout` vazio, sem papel e com `general-purpose`. É mais estrito que antes, que aceitava razão vazia ou a do `-a` para todos.
  - O `-anm` ganhou dois casos de resultado exato: `deny`, a razão começa por "Commit bloqueado: ele leva código (tools/" e não contém "Comando bloqueado". Os casos de papel do time continuam rodando a tabela inteira com o motivo do desvio.
- **Nome do job contra o prefixo** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/ci/esteira.test.ts:483-487`):
  - Troca `${{ matrix.fatia }}` por cada fatia da matriz e exige que o nome comece por `prefixoDoJobDeE2e(fatia)`.
  - Falha se o `ci.yml` mudar o formato do nome ou o total (hoje `/11`, que tem de bater com `FATIAS_DO_E2E.length`).
  - O bloco de mutação novo (`e2e-` no lugar de `e2e `) chega a essa cláusula. O nome citado no bloco é o começo do nome real, e o `-t` do vitest acha o caso por trecho.
- **Mensagem do `portao.ts:342`**: a asserção de `revisoes.test.ts:2290-2293` (`/corrigir`, "commit no terminal dele, com `Fora do processo:`") vale para o texto novo. Os dois blocos de mutação foram atualizados para o texto novo.
- **Documentos**: techspec §5(f) e cenarios.md RF9 e RF16 atualizados. Os casos novos do RF9 (vermelha com fatia de e2e vermelha, rodando e cancelada de fora, job pulado, cancelado ou ausente) têm teste nomeado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l3/tools/processo/esteira.test.ts:386`, `:413` e `:434`.
- **Execução**: `npx vitest run` dos quatro arquivos dá 461 casos verdes. Não há `.skip` nem provedor de IA. Concorrência não se aplica.

**Bloqueantes:** nenhum.

**Recomendações:**
- A seção de testes do documento da correção (linha 46) descreve os dois casos novos do `hook-portao.test.ts` sem citar o nome deles. Citar "sem papel, passa calado: $etiqueta" e "sem papel (%s), o desvio com -a não é negado como desvio…" ajuda a validação a ligar cada linha ao seu teste.
- O texto novo "Fora de papel do time (o Orquestrador, por exemplo)" não é conferido por nenhum teste. Hoje só se conferem `/corrigir` e "Fora do processo:". É texto, e não bloqueia.
