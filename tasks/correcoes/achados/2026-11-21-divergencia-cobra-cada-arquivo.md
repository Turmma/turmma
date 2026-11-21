# Achados das revisões — `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 01:51:31 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe em ferramenta de processo: o aviso de divergência em `tools/processo/divergencias.ts`, a ligação dele em `tools/processo/portao-local.ts`, o passo 1.3 da skill `revisar-tarefa` e o `TODO.md`. Nenhuma migration, schema, DTO ou rota.

Fora da tabela de dados do docs/lgpd.md: nada, porque nenhum campo pessoal foi criado.

Autorização por objeto: não se aplica, a tarefa não tem endpoint.

Logs: limpos. O aviso vai para o stdout do portão local e mostra até 80 caracteres da primeira célula da seção "Divergências resolvidas nesta tarefa", junto com o caminho do arquivo `.md` que falta. É texto da spec, não dado de aluno, professor ou família.

Auditoria: não se aplica. A tarefa não faz nenhuma das ações que a regra 20, item 10, manda auditar.

Envio externo: nenhum. Os únicos comandos externos são `git cat-file -e` e `git diff -U0 HEAD -- <arquivo>`, rodando na máquina local por `execFileSync` com lista de argumentos, sem shell. Nada vai para provedor de IA nem para outro serviço.

Seed/fixture: sintético. As linhas de `tools/processo/divergencias.test.ts` são do tipo "O limite passa de 5 para 6" e "O nome da função muda", e os arquivos `techspec.md` e `cenarios.md` são criados num repositório git temporário. Não aparece nome, matrícula, nota ou conversa.

Pergunta de fechamento: a tarefa não mexe no arquivo do titular nem na lista de compartilhamento, então o sistema continua respondendo à secretaria como antes.

Bloqueantes: nenhum.

Recomendações:
- `tools/processo/divergencias.ts:661-662`: um `.md` com caminho na última célula é resolvido a partir da raiz sem normalizar o caminho. Uma citação como `../x.md` passa direto para o `git cat-file` e o `git diff`. Não vaza nada (é só leitura local e a saída é um booleano), mas normalizar e recusar o que sai da raiz deixaria o aviso mais previsível.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao-local.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/revisar-tarefa/SKILL.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 01:52:09 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É correção de processo, sem `techspec.md` de feature. O que foi feito bate com a entrada "(F4b, retro, M1)" do `TODO.md`: o aviso cobra cada arquivo citado e cobra o diff na linha citada, sai também em `revisores`, e o passo 1.3 do `revisar-tarefa` manda `DEVOLUÇÃO`. Os dois casos do sintoma estão nos testes, e o teste do segundo caso usa `git diff` de verdade.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/revisar-tarefa/SKILL.md:48`. O texto diz que o bloco "começa por `a seção "Divergências resolvidas nesta tarefa" de <documento> ganhou …`", mas o aviso real começa por `Aviso: a seção …` (`tools/processo/divergencias.ts`, no `return` de `avisoDeDivergencia`). Copie o começo exato do aviso, para a Mesa reconhecer o bloco sem precisar interpretar.
- Mesmo arquivo, linhas 47 a 48. O item `nada pendente: … Vá ao passo 4` vem antes do item do aviso de divergência. Quando as duas coisas saem juntas, a ordem dos itens sugere seguir para o passo 4. Diga ali que o aviso de divergência vale mesmo com `nada pendente`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts`, em `trechoTocadoNoDiff`. `existeNoHead` e `git diff` rodam de novo a cada citação, mesmo quando várias citações apontam para o mesmo arquivo. Guardar o resultado por arquivo evita esses processos repetidos. Não muda o resultado.
- A passagem para `DEVOLUÇÃO` obrigatória transforma um aviso que "só informa" em parada. Um caso pode devolver a rodada sem motivo: a divergência cita uma seção da `techspec.md` que outro commit já atualizou antes da tarefa, e então ela não aparece no diff contra o HEAD. Vale a retro acompanhar se isso acontece. Rodei `citacoesDaLinha` nas tarefas da F4b (`tasks/prd-classificacao-bncc/*_task.md`) e a leitura saiu correta em todas as linhas de tabela. As linhas que deram `null` são texto corrido ou citam só seção sem `.md`, e para elas vale o critério antigo.
- Com `citacaoDoAchado`, um `.md` sem caminho que não é da spec (`prd.md`, `glossario.md`) não é cobrado. É o comportamento documentado; fica o registro de que a citação de `prd.md` passa sem cobrança.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao-local.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/revisar-tarefa/SKILL.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md`

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 01:52:16 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** uma linha nova que cita `techspec.md` e `cenarios.md`, com os dois mudados, não gera aviso. Uma linha que cita um arquivo e com esse arquivo mudado também não.
- **Bordas:**
  - a linha cita os dois e só um mudou (os dois sentidos);
  - a linha cita só a `techspec.md` e só o `cenarios.md` mudou, que o critério antigo deixava passar calado;
  - a linha cita o documento da seção 11 (`docs/runbook.md`);
  - `arquivo:linha` com o diff em outro trecho, antes ou depois da linha citada;
  - intervalo `de-ate`;
  - remoção pura dentro do intervalo (`+c,0`);
  - arquivo citado que não está no HEAD;
  - `.md` citado fora da última coluna;
  - `.md` sem caminho que não é da spec, e arquivo que não é `.md`;
  - linha em texto corrido, ou com barras no meio sem ser tabela, ou tabela de duas colunas: vale o "um dos dois";
  - o mesmo arquivo citado com duas linhas diferentes, e o mesmo arquivo repetido sem linha;
  - prefixo `./`;
  - rótulo longo, negrito e marcador de lista;
  - contagem só das linhas pendentes.
- **Ligação:** `portao-local.ts revisores` imprime o aviso depois das linhas dos revisores e não muda o código de saída.
- **Permissão e isolamento:** não se aplicam. É ferramenta de processo que só lê a árvore, sem dado de escola.
- **Concorrência:** não se aplica. É leitura e não grava nada.

**Cobertos:** todos os cenários acima, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts`.
- `citacoesDaLinha` tem 7 casos.
- `avisoDeDivergencia` tem 13. Neles estão os dois casos do sintoma ("a linha que cita os dois, com só um mudado…" e "a linha citada (cenarios.md:140) com o diff em outro trecho…").
- `avisoDaDivergenciaSoNoDocumento` tem 4 casos novos com `git diff` de verdade num repositório temporário: só um mudou; o diff na linha 7, na linha 1 e na linha 3; remoção pura contra linha acrescentada; arquivo fora do HEAD.
- A ligação no portão tem 1 caso.

Rodei `npx vitest run tools/processo/divergencias.test.ts`: 44 de 44 verdes, o mesmo número que o documento declara.

Conferi as mutações contra o `git diff`:
- Toda condição nova de `divergencias.ts` tem bloco, e as condições com dois termos têm um bloco por termo: `partes === null || partes.length < 3`, `citacao !== null && !citacoes.some`, `!caminho.includes('/') && !daSpec`, os dois lados de `inicio <= ate && fim >= de`, `&&` trocado por `||`, `de !== undefined && !tocou`.
- A linha nova de `portao-local.ts` também tem bloco.
- Os ramos sem bloco são inalcançáveis: o `?? ''` de `partes[partes.length - 1]` com três ou mais células, e o `citacao.ate ?? citacao.de`, porque `ate` sempre vem junto com `de`.
- Nenhum bloco fica vermelho pelo motivo errado. O `partes.length < 3`, sem a guarda do `null`, quebra com TypeError justamente no cenário que a guarda protege, então o cenário chega à cláusula.
- Não há `.skip`, teste comentado nem mock que esconda a regra. Os testes de `avisoDeDivergencia` trocam o diff por uma função injetada, e os de `avisoDaDivergenciaSoNoDocumento` provam a mesma regra com o git real. Nenhum teste toca IA.
- As afirmações de "Teste que reproduz" e de "Correção" no documento têm todas um teste que bate.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/revisar-tarefa/SKILL.md:48`: o passo 1.3 diz que o bloco "começa por `a seção "Divergências resolvidas nesta tarefa" de <documento> ganhou …`". O texto que o código imprime começa por `Aviso: a seção …` (`divergencias.ts`, em `avisoDeDivergencia`). Vale citar o prefixo exato, para a Mesa reconhecer o bloco sem ter de adivinhar.
2. `divergencias.test.ts`, caso "o subcomando revisores imprime o mesmo aviso…": a prova é textual, se o fonte contém a linha e em que posição. Ela segue o padrão do caso do portão que já existia, mas não roda o subcomando. Um caso que rode `portao-local.ts revisores` num repositório temporário provaria de verdade que o aviso sai e que o código de saída não muda.
3. O lookbehind `(?<![\w./-])` e o lookahead `(?![\w])` de `CITACAO_DE_MD` não têm bloco nem caso, por exemplo `cenarios.mdx` ou `x.md5` na última célula. Hoje um `.mdx` citado seria ignorado só por causa do lookahead, e nenhum teste prende isso.
4. Arquivo renomeado (`git mv`) com o nome novo na citação: `existeNoHead` dá falso e o arquivo inteiro vale como tocado em qualquer linha, o que pode calar um `arquivo:linha` que o diff de fato não toca. É raro na spec. Um caso ou uma linha no comentário de `trechoTocadoNoDiff` deixaria isso registrado.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 02:13:41 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO

Esta rodada só cobria o diff desde a 1ª (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.processo/ordens/diff-r1-r2.txt`). A 1ª rodada não exigiu nenhuma correção, então não havia nada a conferir nesse ponto. O diff mexe só em ferramenta de processo e não toca dado de pessoa.

```
VEREDITO: APROVADO
Campos pessoais tocados: nenhum (só tools/processo, a skill revisar-tarefa e o TODO.md)
Fora da tabela de dados do docs/lgpd.md: nenhum
Autorização por objeto: não se aplica (sem rota, sem repository, sem endpoint)
Logs: limpos. O aviso traz o caminho do documento, o rótulo da divergência (primeira célula da tabela, texto do processo) e os arquivos que faltam; nenhum dado de pessoa
Auditoria: não se aplica (nenhuma ação das que a regra 20, item 10, lista)
Envio externo: nenhum
Seed/fixture: sintético (as fixtures de divergencias.test.ts usam caminhos e textos inventados)
Bloqueantes: nenhum
Recomendações: abaixo
```

**A remoção do lookbehind, pela regra 20.** O caminho capturado só serve para três coisas:
- comparar com a lista `alterados`;
- rodar `git cat-file -e HEAD:<arquivo>` (`tools/processo/divergencias.ts:143`);
- rodar `git diff -U0 HEAD -- <arquivo>` (`divergencias.ts:160`).

As duas chamadas ao git usam `execFileSync` com lista de argumentos, sem shell. O caminho sempre vem depois de `HEAD:` ou de `--`, então não pode virar opção do git. Um `etc/x.md` capturado é procurado dentro do repositório: nada fora dele é lido, e a única leitura de arquivo (`divergencias.ts:179`) é a do documento da tarefa. Um `../x.md` faz o `cat-file` falhar, cai em `'novo'` e não chega ao `git diff`. A saída continua sendo só um aviso informativo. Nada vaza e nenhuma permissão muda, então não há bloqueante pela minha regra.

**A mudança de comportamento é real e nenhum teste a prende.** A suíte passa (45 de 45), mas nenhum caso cobre URL, caminho absoluto ou `//`. Pela regra 20 ela é aceitável. Pelo processo, ela abre um falso positivo. Antes, uma URL ou um `/etc/x.md` na coluna "Onde está na spec" não dava nenhuma citação. Agora dá `github.com/x/y/blob/main/docs/a.md` ou `etc/x.md`. Esses caminhos nunca estão em `alterados`, então o aviso diz "falta mudar …". Pelo passo 1.3 do `SKILL.md`, isso faz a Mesa devolver a rodada por uma divergência que já chegou à spec.

O comentário novo em `divergencias.ts:64-67` diz que o lookbehind era redundante. Isso só vale quando o caractere anterior é letra ou número. Para `/` e `:` não vale, e são justamente os três casos que a Mesa mediu.

**Recomendações:**
1. Em `tools/processo/divergencias.ts:68`, voltar com um lookbehind para `/` e `:`, por exemplo `(?<![\w/:])`, ou recusar no `citacaoDoAchado` o caminho que começa por `/` ou por um domínio. Acrescentar um caso em `divergencias.test.ts` com a URL do GitHub, `/etc/x.md` e `foo//x.md` dando `null`. Se a decisão for manter o comportamento novo, então um teste que o fixe e o comentário corrigido. Dono sugerido: quem fizer a correção, ou o Arquiteto na retro da F5, junto da linha do `../x.md` já registrada no `TODO.md`.
2. Sigo sem objeção às duas linhas novas do `TODO.md` nem à troca de `Aviso:` por `Atenção:`. A asserção `startsWith` em `divergencias.test.ts:135` prende o prefixo que o `SKILL.md` passo 1.3 procura.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-21 02:13:41 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts:60`. Tirar o lookbehind `(?<![\w./-])` de `CITACAO_DE_MD` mudou o comportamento, e nenhum teste segura essa mudança.
  - **O que o comentário diz.** As linhas 56-59 dizem que o lookbehind sobrava "porque a captura gulosa já começa no começo do nome". Isso vale para `\w`, `.` e `-`: a varredura global já começa no início da sequência. Não vale para a `/` antes do nome, porque a `/` não pode abrir a captura, que então começa logo depois dela.
  - **O que muda na prática.** Medi as duas versões sobre a mesma entrada:
    - `https://github.com/x/y/blob/main/docs/a.md` passou de `[]` para `github.com/x/y/blob/main/docs/a.md`;
    - `/home/u/repo/docs/runbook.md` passou de `[]` para `home/u/repo/docs/runbook.md`.

    O nome resolvido tem `/`, então `citacaoDoAchado` o aceita como arquivo da raiz. Esse arquivo nunca aparece entre os alterados, e `oQueFalta` cobra "falta mudar github.com/…/a.md".
  - **Por que isso é bug.** Pelo passo 1.3 do `revisar-tarefa`, esse aviso impede a rodada de começar e vira `DEVOLUÇÃO`, mesmo com `nada pendente`. Basta um link para `.md` ou um caminho absoluto na coluna "Onde está na spec". O aviso nunca se resolve: a única saída é apagar a referência da célula.
  - **Correção exigida.** Três coisas:
    - devolver um lookbehind que recuse a `/` (e o `:` do esquema) antes do nome, por exemplo o `(?<![\w./-])` de antes;
    - acrescentar em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts` o caso "URL e caminho absoluto na última célula não são citação". Esse caso deve cair quando o lookbehind sai, e precisa de um bloco `mutacao` correspondente no documento;
    - reescrever o comentário das linhas 56-59 para dizer o que o lookbehind de fato faz.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts:151-155`: o comentário sobre o arquivo renomeado (`git mv`) admite que o `arquivo:linha` não é cobrado nesse caso. Vale uma linha no `TODO.md`, junto às duas da seção nova, para a limitação não ficar só no fonte.
- As outras mudanças desta rodada não trazem problema:
  - **SKILL.md, passo 1.3:** a exceção a `nada pendente` está certa, porque o `portao-local.ts` (linhas 101-105) imprime o aviso também depois de `nada pendente:`.
  - **`Atenção:` no lugar de `Aviso:`:** a troca está presa pelo `startsWith`.
  - **`TODO.md`:** as duas linhas seguem o destino que o documento registra.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-21 02:15:14 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: REPROVADO

**Cenários exigidos (rodada 2, só o diff r1-r2 e o que ele afeta):**
- O `.md` com letra ou número colado depois (`cenarios.mdx`, `x.md5`) não é citação, e o `.md` de verdade na mesma célula continua citado.
- O aviso começa por `Atenção:`, e o `revisar-tarefa` reconhece esse começo.
- O bloco do aviso vale mesmo quando o comando diz `nada pendente` (SKILL, passo 1.3).
- A retirada do lookbehind de `CITACAO_DE_MD` não muda o que é citação, ou, se muda, um teste prende o comportamento escolhido.
- As recomendações da 1ª rodada estão no `TODO.md` com dono.

**Cobertos:**
- `cenarios.mdx` e `x.md5`: o caso `o .md com letra ou número colado depois (cenarios.mdx, x.md5) não é citação` cobre. O bloco de mutação que tira o `(?![\w])` o deixa vermelho pelo motivo certo, porque `cenarios.mdx` passa a dar a citação `cenarios.md`.
- `Atenção:`: a asserção `startsWith(...)` em `com linha nova e a spec parada, avisa…` prende o começo do aviso. O `tools/renomear/restos.test.ts` passa (48/48).
- `nada pendente` com o aviso junto: a SKILL.md, no passo 1.3, está coerente com a ordem de saída do `portao-local.ts revisores` (linhas dos revisores primeiro, aviso depois).
- As duas linhas do `TODO.md` têm origem, revisor, rodada e dono.
- `tools/processo/divergencias.test.ts`: 45/45 verdes. Nada de `.skip`, mock ou provedor.

**Bloqueantes:**

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts:56-60`**: a retirada do lookbehind `(?<![\w./-])` muda o comportamento sem teste nenhum, e o comentário novo afirma algo falso.
   - **O comentário.** Ele diz que "a captura gulosa já começa no começo do nome, e o que viria antes é do próprio nome". Isso não vale para o que fica fora da classe `[\w.-]`: `:`, `/` no começo, `<`, `>`, `*`. A medida da Mesa mostra três entradas que mudaram de resultado.
   - **O que regrediu.** Uma URL na coluna "Onde está na spec" (`` `https://github.com/x/y/blob/main/docs/a.md` ``) antes era ignorada. Agora vira a citação `github.com/x/y/blob/main/docs/a.md` (linha 92: tem `/`, então vale como caminho da raiz). Esse arquivo nunca estará entre os alterados, então a linha 119 sempre acrescenta "falta mudar github.com/…". Pelo passo 1.3 da SKILL, isso é `DEVOLUÇÃO` em toda rodada, sem conserto possível a não ser reescrever a célula.
   - **Também regrediu, pelo mesmo motivo.** Um placeholder ou glob como `` `<spec>/cenarios.md` `` ou `` `tasks/prd-*/techspec.md` `` agora captura só `cenarios.md` ou `techspec.md`. Isso passa a ser `daSpec`, e a cobrança cai no arquivo da spec do documento, que é o alvo errado. Antes a linha era ignorada.
   - **O que melhorou.** `/docs/runbook.md` antes passava sem cobrança (falso negativo) e agora é cobrado certo.
   - **Por que bloqueia.** A mudança é mista, nenhum dos dois comportamentos está preso por teste, e a seção "Correção" do documento não a descreve. Respondendo à Mesa: hoje nenhum teste prende essa mudança. Ela só é aceitável se for escolhida e provada.
   - **Correção exigida, uma das duas:**
     - **(a)** Repor o lookbehind e acrescentar o caso "a URL não é citação" (`citacoesDaLinha(linha('`https://github.com/x/y/blob/main/docs/a.md`'), DOC)` dá `null`), com um bloco ` ```mutacao ` que tire o lookbehind e deixe esse caso vermelho.
     - **(b)** Manter sem lookbehind, mas recusar de forma explícita a URL (o que vem depois de `://`) com o mesmo caso e um bloco de mutação para a cláusula nova. Nesse caso também falta um caso para `/docs/runbook.md` dar `docs/runbook.md`.
   - **Nos dois caminhos:** corrigir o comentário das linhas 56-59 e dizer em "Correção" o que é citação quando a célula traz URL ou caminho com barra no começo.

**Recomendações:**
- Os placeholders e globs (`<spec>/cenarios.md`, `prd-*/techspec.md`) merecem um caso próprio, porque a cobrança cai no arquivo da spec errada. No caminho (a) eles voltam a ser ignorados e o caso só prende isso. No (b), decidir se recusa.
- O comentário novo de `trechoTocadoNoDiff` (arquivo renomeado vale como tocado em qualquer linha) registra uma limitação real. Pode ir junto com as do `TODO.md` para a retro da F5, se quiserem acompanhá-la.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-21 02:28:28 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (correção de processo, sem seção da techspec citada)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As três correções que exigi na 2ª rodada foram feitas:
- **Lookbehind:** o `(?<![\w./-])` voltou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts:62`. Rodei o regex com e sem ele, sem tocar em arquivo nenhum. Com ele, URL, caminho absoluto, `foo//x.md`, `<spec>/cenarios.md` e `prd-*/techspec.md` não dão nenhuma citação. Sem ele, os cinco dão citação falsa, por exemplo `github.com/x/y/blob/main/docs/a.md` e `home/u/repo/docs/runbook.md`. `docs/runbook.md:140-150` e `cenarios.md:12` continuam iguais nos dois casos.
- **Caso novo:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts:96`. Como `citacoesDaLinha` devolve `null` quando não acha nada (linha 87), o `toBeNull()` cai quando o lookbehind sai. Ele também prova que o nome de verdade ao lado de uma URL continua sendo citado. O bloco de mutação correspondente está no documento da tarefa, e os dois blocos antigos de `CITACAO_DE_MD` foram reescritos sobre o regex atual, então ainda batem com o fonte.
- **Comentário:** as linhas 56-61 agora explicam o que o lookbehind faz de fato. A captura não pode começar numa `/`, e sem o lookbehind ela recomeçaria logo depois da barra.

A recomendação da 2ª rodada também foi aplicada: o `TODO.md` ganhou a linha sobre o arquivo renomeado em `trechoTocadoNoDiff`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md:32`: o trecho novo entrou no meio de uma frase. Ela termina em "e `cenarios.mdx` e `x.md5` também (o lookahead) com a linha ou o intervalo (`arquivo:140`, …", e esse "com a linha ou o intervalo" ainda se refere a "cada `.md` citado", lá no começo. Vale mover o trecho sobre URL e lookahead para depois de "`arquivo:140-150`)."

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-21 02:28:39 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica toda na ferramenta de processo: é um regex que lê os nomes de `.md` citados numa coluna de tabela da spec.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: não se aplica, porque não há rota nem endpoint.
Logs: limpos. `tools/processo/divergencias.ts` não tem logger nem console; o aviso que ele gera traz só caminho de arquivo e número de linha.
Auditoria: não se aplica, porque nenhuma ação desta tarefa exige auditoria.
Envio externo: nenhum. A ferramenta só lê o repositório local e o `git diff`.
Seed/fixture: sintético. O caso novo usa `github.com/x/y`, `/home/u/repo` e `<spec>`; não há dado de pessoa.

Conferi a rodada 3.
- O lookbehind `(?<![\w./-])` voltou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts:62`, e o comentário acima dele explica o motivo. Isso cumpre a recomendação da 2ª rodada.
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts:96` cobre a URL do GitHub, o caminho absoluto, `foo//x.md`, o placeholder e o glob, todos dando `null`, e mais o nome válido ao lado da URL. Era o pedido da 2ª rodada.
- `divergencias.test.ts` roda com 46 de 46 passando.
- Apliquei a mutação nova declarada no documento: tirei o lookbehind e o caso "URL, caminho absoluto" ficou vermelho. Depois restaurei o arquivo e conferi com `cmp` que ficou idêntico; não ficou nada alterado.
- Os dois blocos de mutação antigos de `CITACAO_DE_MD` foram reescritos sobre o regex atual, e o contador diz 40 blocos, o que bate.
- A linha nova do `TODO.md` é pendência de processo e não traz dado pessoal.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`, na seção "Correção", a frase do lookbehind foi colada no meio da frase anterior e o texto ficou truncado: "...e `cenarios.mdx` e `x.md5` também (o lookahead) com a linha ou o intervalo (`arquivo:140`,...". É preciso mover o trecho "com a linha ou o intervalo..." de volta para junto de "cada `.md` citado", ou fechar a frase antes de começar a lista do que não é citação. É só texto e não bloqueia.
- A recomendação de normalizar `../x.md` continua registrada no `TODO.md`, como já estava na 1ª rodada; não mudou nada aqui.

## test-engineer · 3ª rodada · APROVADO · 2026-11-21 02:28:56 · `tasks/correcoes/2026-11-21-divergencia-cobra-cada-arquivo.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Correção exigida na 2ª rodada (bloqueante 1, caminho a):
  - o lookbehind `(?<![\w./-])` volta a `CITACAO_DE_MD`;
  - um caso prova que a URL não é citação;
  - um bloco `mutacao` tira o lookbehind e deixa esse caso vermelho;
  - o comentário de `divergencias.ts:56-59` foi corrigido;
  - a seção "Correção" agora diz o que acontece com URL e com caminho que começa por barra.
- Duas recomendações da 2ª, a aplicar: um caso próprio para placeholder e glob na última célula, e uma linha no `TODO.md` para o arquivo renomeado.
- O que a mudança afeta: o lookbehind não pode cortar as citações legítimas que os casos já cobrem (`./docs/runbook.md`, `techspec.md`, `cenarios.md:140`, `arquivo:140-150`, vários `.md` separados por `;`), e os blocos de mutação antigos de `CITACAO_DE_MD` precisam bater com o regex atual.

**Cobertos:**
- **Lookbehind de volta**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.ts:62`. Conferi cada entrada do caso novo contra o regex:
  - Na URL (`https://github.com/...`), "https" não forma `[\w.-]+\/` por causa do `:`. Toda posição depois de `//` vem precedida de `/` ou de caractere de nome, então dá `null`.
  - Em `/home/u/...`, `foo//x.md`, `<spec>/cenarios.md` e `prd-*/techspec.md`, o único começo possível vem logo depois de uma `/`, e dá `null`.
  - Em URL seguida de `; docs/runbook.md`, só `docs/runbook.md` é citado. Isso prova que o lookbehind não engole a citação legítima ao lado.
- **Caso novo**: "URL, caminho absoluto, // , placeholder e glob na última célula não são citação", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/divergencias.test.ts:96`. Não tem `.skip` e as asserções são sobre o resultado.
- **Bloco novo em "Mutações"**: está no documento da tarefa, linhas 54-59. Sem o lookbehind, a primeira asserção passa a dar `github.com/x/y/blob/main/docs/a.md` em vez de `null`. O vermelho vem da cláusula certa, porque o cenário chega a ela.
- **Blocos antigos de `CITACAO_DE_MD`** (lookahead, linhas 61-66; intervalo, linhas 75-80): foram reescritos sobre o regex com o lookbehind, e o lado `-` de cada um bate com o fonte atual.
- **Comentário das linhas 56-61**: agora diz o certo. A captura não começa numa `/`, e sem o lookbehind ela recomeçaria logo depois dela.
- **Seção "Correção"**: lista como ignorados URL, caminho absoluto, `foo//x.md`, placeholder e glob. Diz também que `/docs/runbook.md` não é cobrado. Isso decide de forma explícita o falso negativo que a 2ª rodada apontou, como o caminho (a) previa.
- **`TODO.md`**: a linha do `trechoTocadoNoDiff` com o arquivo renomeado está lá, com dono e motivo.
- **Resultado**: `npx vitest run tools/processo/divergencias.test.ts` dá 46 de 46 verdes.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A frase da seção "Correção" (linha 32 do documento da tarefa) ficou emendada. "com a linha ou o intervalo (`arquivo:140`, ...)" agora vem logo depois de "(o lookahead)" e parece falar do lookahead, quando completa "cada `.md` citado". Basta mover a frase das exclusões para depois de "`arquivo:140-150`)."
2. O bloco de mutação só prova o `/` do lookbehind (tira a cláusula inteira). Não achei entrada em que `\w`, `.` ou `-` antes do nome mudem o resultado, porque a varredura da esquerda já começa no começo do nome. Ou se registra no comentário que esses três são só defesa, ou eles saem.
3. O caminho absoluto ser ignorado repõe o falso negativo `/docs/runbook.md`, que a 2ª rodada registrou. Está documentado e é o que o caminho (a) aceitava. Fica para a retro, se aparecer citação da spec com barra no começo.
