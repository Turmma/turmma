# Correção — o `PreToolUse` cobra revisores por tudo que o merge trouxe do outro lado; o git hook conta só o que diverge dos dois lados

**Origem:** divergência da Mesa 2 na correção `encontro-9` (`Motivo: portão`): o commit do merge de `spec/nomes-de-mercado` na linha 2 foi bloqueado pelo `PreToolUse`, que cobrou os quatro guardiões de caminho por 192 arquivos de `apps/`, `infra/` e `tools/` vindos da tarefa 8.0, já revista na linha 1.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: `portao.ts` é um dos quatro arquivos do RF16, que pede os quatro guardiões. O `revisor-geral` entra porque a correção toca `tools/processo/`. -->

## Sintoma

Com um merge em curso (`MERGE_HEAD`), o commit de um papel do time passa por duas camadas, e elas contavam os arquivos do commit de jeitos diferentes:

- o git hook (`hook-git.ts`, `arquivosDoIndice`): só o que o índice tem de diferente do HEAD **e** de `MERGE_HEAD`, isto é, o conflito resolvido à mão e o arquivo que as duas linhas tocaram. O que veio do outro lado sem mudar já passou pelos revisores na linha de onde veio;
- o `PreToolUse` (`portao.ts`, `bloqueioDoCommit` › `arquivosDoCommit` com `arquivosPreparados` de `comando-git.ts`): `git diff --cached` contra o HEAD, sem olhar `MERGE_HEAD`. Contava tudo o que veio do outro lado.

No caso real (`encontro-9`, checkout da L2) a conta do git hook dava 5 arquivos, todos em `tasks/`, e a do `PreToolUse` dava 200, e cobrava `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer` e `infra-guardian` por código que a linha 1 já tinha passado por eles.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso.

## Causa

`arquivosPreparados` (`comando-git.ts`) lia o índice contra o HEAD e nada mais; a regra do merge morava só em `hook-git.ts` (`arquivosDoIndice`, `mergeEmCurso` e `diferencasDoIndice`, privadas lá). Eram duas contas para o mesmo commit. Nenhum teste punha as duas lado a lado.

## Teste que reproduz

`tools/processo/revisoes.test.ts`, no grupo "com um merge em curso, a conta é a do git hook: só o que diverge dos dois lados" (merge limpo e por concluir, feito com git de verdade; `apps/outro.ts` só vem do outro lado, `apps/comum.ts` é tocado pelas duas linhas):

- `o arquivo que só veio do outro lado não conta, e o que as duas linhas tocaram conta`: `arquivosPreparados` devolve só `apps/comum.ts`;
- `o portão do PreToolUse cobra só o que as duas linhas tocaram, e não o que veio do outro lado`: a decisão do `PreToolUse` cita `apps/comum.ts` e não cita `apps/outro.ts`;
- `o conflito resolvido à mão num repository segue cobrando o tenancy-guardian no PreToolUse, e o que veio só do outro lado não`: merge com conflito em `*.repository.ts`, resolvido e preparado; a decisão pede `tenancy-guardian` e não cita `apps/outro.ts` (acrescentado na rodada 1, para a promessa da seção "Correção" ter prova também nesta camada).

Vermelho antes: com o `comando-git.ts` do HEAD, os dois falham (`expected [ 'apps/comum.ts', 'apps/outro.ts' ] to deeply equal [ 'apps/comum.ts' ]`, e a decisão cita `apps/outro.ts`). Verde depois. O caso do git hook que já existia (`hook-git.int.test.ts › o merge limpo de outra linha, sem marca, passa`) segue cobrindo a outra camada, que agora usa a mesma função.

## Correção

- `tools/processo/comando-git.ts`: `arquivosPreparados` passa a ser a conta única. Sem merge, o índice contra o HEAD, sem detectar rename (como antes). Com `MERGE_HEAD`, só o que também difere de `MERGE_HEAD`. `mergeEmCurso` vem para cá. **Mudança intencional de comportamento:** a leitura do `git diff --cached` passa a usar `maxBuffer: LIMITE_DE_LEITURA_DO_GIT` (64 MB), e não o padrão do Node (1 MB), como o helper que saiu do `hook-git.ts`; um índice grande (merge de 200 arquivos, ou mais) não estoura mais o buffer. O stderr do git é capturado (`stdio: ['ignore', 'pipe', 'pipe']`) e vai no erro lançado, sem sair no terminal.
- `tools/processo/hook-git.ts`: `arquivosDoIndice`, `mergeEmCurso`, `diferencasDoIndice` e `nomes` saem; o `commit-msg` chama `arquivosPreparados`. As duas camadas passam a contar igual **porque chamam a mesma função**, e não porque duas cópias foram mantidas iguais.
- `portao.ts` não muda: já chamava `arquivosPreparados`.

O que a correção não faz: não baixa a cobrança. O conflito resolvido à mão e o arquivo que as duas linhas tocaram seguem cobrando os guardiões do caminho, no `PreToolUse` e no git hook.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), test-engineer (1ª) | `caducidade.ts` (`diferentesDoOutroLado`, linhas 210-218) é uma segunda cópia da regra do merge, sem `--cached` e sem `LIMITE_DE_LEITURA_DO_GIT`; usar o `mergeEmCurso` de `comando-git.ts` | `TODO.md`. `caducidade.ts` está fora da correção e é um dos quatro arquivos que pedem os quatro guardiões; trocar a conta dela muda o que caduca, não cabe em poucas linhas |
| revisor-geral (1ª) | `mergeEmCurso` exportado sem uso fora do arquivo | `TODO.md`, na mesma linha da anterior: a função é exportada para a `caducidade.ts` passar a usá-la; deixá-la privada agora obrigaria a reexportar depois |
| test-engineer (1ª) | Caso de `git add -A` seguido do commit com merge em curso na camada do `PreToolUse`; esse caminho passa por `arquivosAlterados` em `caducidade.ts:228` | `TODO.md`, junto com a duplicata da `caducidade.ts`: a conta que esse caso exercita é a dela, não a de `arquivosPreparados` |
| revisor-geral (1ª) | Frase na `techspec.md:69` dizendo que o `PreToolUse` conta igual ao git hook | Arquiteto: `techspec.md` é documento dele, e a frase é texto de spec; entra na retro da spec |
| privacy-guardian (1ª), tenancy-guardian (1ª) | Registrar nos "Limites declarados" (`techspec.md:110`) e na retro que um arquivo só do outro lado é tratado como já revisto | Arquiteto, pelo mesmo motivo; a parte que cabe no código (o comentário) está no comentário de `arquivosPreparados` |

Rodada 2 (aprovada por todos; as recomendações não entram em ordem):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª), tenancy-guardian (2ª) | No teste novo (`revisoes.test.ts`, "o conflito resolvido à mão num repository …"), o `expect(decisao).not.toMatch(/apps\/outro\.ts/)` não discrimina a correção: com a marca na mensagem, a lista de arquivos da decisão sai de `arquivosAlterados` (`caducidade.ts`), que tem a regra de merge própria. A asserção que prova a correção é a do `tenancy-guardian`; a metade "o que veio só do outro lado não" está provada pelos testes anteriores do grupo | `TODO.md`, junto da linha da duplicata em `caducidade.ts`: a asserção só passa a provar `arquivosPreparados` quando a conta de `caducidade.ts` for a mesma, ou quando `apps/outro.ts` ficar num caminho que peça um revisor que o `REPOSITORY` não pede |
| test-engineer (2ª) | Frase em "Vermelho antes" do documento dizendo que o terceiro teste já ficava verde antes da correção, de propósito: guarda contra a cobrança baixar, não contra a correção ser desfeita | Retro da spec, por esta tabela; é texto de documento. Registro aqui: dos três testes do grupo, os dois primeiros ficam vermelhos com o `comando-git.ts` do HEAD; o terceiro (conflito num repository) já passava antes, de propósito |
| revisor-geral (2ª) | O comentário de `arquivosPreparados` ficou longo e mistura a regra com a explicação de onde ela vale | Recusada: é só legibilidade, e o comentário nesta forma é o que conformidade-reviewer, tenancy-guardian e privacy-guardian pediram na 1ª rodada |
| privacy-guardian (2ª) | Registrar a premissa do merge nos "Limites declarados" (`techspec.md:110`) quando o Arquiteto mexer na spec | Arquiteto, na retro da spec; já está na terceira linha do `TODO.md` desta correção |
| infra-guardian (2ª) | A duplicata em `caducidade.ts` segue sem `LIMITE_DE_LEITURA_DO_GIT`; quando entrar, a troca deve levar o mesmo `maxBuffer` | Já está na primeira linha do `TODO.md` desta correção |
| revisor-geral (2ª) | "Vermelho antes" ainda diz "os dois falham" com três testes listados | Mesmo destino da recomendação do test-engineer sobre "Vermelho antes", acima |

## Mutações

```mutacao
arquivo: tools/processo/comando-git.ts
teste: tools/processo/revisoes.test.ts › o arquivo que só veio do outro lado não conta, e o que as duas linhas tocaram conta
  const doOutroLado = new Set(diferencasDoIndice(raiz, ['MERGE_HEAD']))
-  return doCommit.filter((arquivo) => doOutroLado.has(arquivo))
+  return doCommit
```

```mutacao
arquivo: tools/processo/comando-git.ts
teste: tools/processo/revisoes.test.ts › o arquivo que só veio do outro lado não conta, e o que as duas linhas tocaram conta
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] })
-    return true
+    return false
  } catch {
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 22:23:45 | 2026-10-31 22:24:03 | `tenancy-guardian` | 1 | APROVADO | a3aa5b9238e7a6bff |
| 2026-10-31 22:23:46 | 2026-10-31 22:24:05 | `privacy-guardian` | 1 | APROVADO | a6b2651f7d8104b1c |
| 2026-10-31 22:23:48 | 2026-10-31 22:24:06 | `infra-guardian` | 1 | APROVADO | a79c3312d21313bc4 |
| 2026-10-31 22:23:47 | 2026-10-31 22:24:15 | `conformidade-reviewer` | 1 | APROVADO | a7458928719289bf3 |
| 2026-10-31 22:23:44 | 2026-10-31 22:24:31 | `revisor-geral` | 1 | APROVADO | a65473d150f29c931 |
| 2026-10-31 22:23:42 | 2026-10-31 22:24:59 | `test-engineer` | 1 | APROVADO | ad491fd484505297e |
| 2026-10-31 22:38:51 | 2026-10-31 22:39:09 | `revisor-geral` | 2 | APROVADO | a9373c1506d08eb02 |
| 2026-10-31 22:38:56 | 2026-10-31 22:39:16 | `tenancy-guardian` | 2 | APROVADO | a58197eca104253e8 |
| 2026-10-31 22:39:01 | 2026-10-31 22:39:17 | `privacy-guardian` | 2 | APROVADO | ac9dcdfe217bdf288 |
| 2026-10-31 22:39:05 | 2026-10-31 22:39:17 | `conformidade-reviewer` | 2 | APROVADO | a4f5d9a780a98cba4 |
| 2026-10-31 22:39:10 | 2026-10-31 22:39:24 | `infra-guardian` | 2 | APROVADO | a819d7aec9fd67229 |
| 2026-10-31 22:38:45 | 2026-10-31 22:39:55 | `test-engineer` | 2 | APROVADO | a413dfb855e1a49fb |
