# Tech Spec — Nomes de mercado (X8)

**PRD:** `prd.md` · **Inventário:** `inventario.md` e anexos (adenda 2 em `inventario-adenda-2.md`) · **Travas:** `travas.md` · **Guarda:** `guarda.md` · **Casos:** `casos.md`
**Status:** rascunho, rodada 5 da revisão da spec

## 1. Resumo da abordagem

O `tools/renomear/` tem quatro comandos: `aplicar` (o "rename symbol" e o "move file" do serviço de linguagem do
TypeScript, um por `tsconfig`; o ts-morph tem um projeto só), `conferir` (o "só nome"), `restos` (nada sobrou) e
`reaplicar` (o merge). Cada onda escreve o mapa do anexo, roda os comandos e troca à mão as travas. Depois das ondas
em fila, back e web correm em duas linhas (Joaquim, 29/10/2026).

## 2. Módulos afetados

| Módulo | O quê |
|---|---|
| `tools/renomear/`, `tools/guardas/filtros-casam.test.ts` (novos) | os comandos e a trava contra filtro vazio |
| `mapas/<N>.json` e `<N>.relatorio.md` (novos, um por onda) | o mapa e o relatório |
| `packages/`, `apps/`, `e2e/` | as ondas |
| `tools/`, `infra/`, configs da raiz, `.github/` | só as travas e os imports |
| `CLAUDE.md`, `.claude/`, `docs/` vivos | o caminho na onda que o muda; o nome nas ondas em fila e na 13.0 |

## 3 e 4. Modelo de dados e API

Nada muda. A `drizzle/` vai com o pacote; o caminho sai do arquivo (`PASTA_MIGRACOES`), e a migration é registrada
pelo hash. Rota, corpo, código de erro e evento de WebSocket são strings (`conferir`).

## 5. Fluxo

**O mapa** tem entradas `{ tipo: simbolo|arquivo|pasta|pacote, de, para, arquivo?, linhaDoAnexo, alias?, comum? }`
e duas listas. `comum` é calculado, não declarado: é o `de` de uma palavra só, sem maiúscula interna nem `_` (`com`,
`Banco`, `Tela`, `Fila`, `migrar`).

- `ocorrencias`: cada referência por texto, classificada como `fica` (string de fora, com a linha de "Não muda, mas
  parece") ou `trava` (com a linha do `travas.md`; a trava achada depois entra no mapa e ganha linha no anexo);
- `excecoesDoConferir`: cada string que muda de propósito (as travas e o `this.name` dos erros, pela adenda 1), com o
  motivo.

O `aplicar` recusa o mapa inteiro, sem gravar, se: o `de` não existe no arquivo; o `para` colide no escopo de algum
arquivo que importa o nome, sem `alias`; o `de` se repete; falta `linhaDoAnexo`; a edição cai fora do `--escopo` (os
"Arquivos previstos"); ou sobra ocorrência sem classificação.

**O `aplicar`, passo a passo:**

1. Abre um serviço de linguagem por `tsconfig` (a raiz, `e2e/`, `infra/` e cada workspace) e junta os locais sem
   repetir. O pacote resolve pela condição `source`.
2. Renomeia o símbolo (`findRenameLocations`, com `providePrefixAndSuffixTextForRename`), e a forma curta
   `{ esquemaTurma }` vira `{ esquemaTurma: turmaSchema }`, com a chave intacta.
3. Move o arquivo e a pasta (`getEditsForFileRename` e `git mv`). O rename só de caixa passa por um nome intermediário.
4. No pacote, troca o `name`, os `exports` e as dependências, e roda `npm install --package-lock-only`.
5. Em comentário e em documento vivo (`CLAUDE.md`, `.claude/`, `docs/`), troca sozinho só o identificador composto
   (`AdaptadorFalso`, `exigirEscolaDoContexto`), o que está entre crases e o que está em `{@link}`, e o caminho. A
   palavra comum (`com`, `Banco`, `Tela`, `Contador`, `Despachante`, `Fila`, `migrar`) vai para a lista de troca à mão
   do relatório. Ficam fora `docs/decisoes.md`, `docs/aia/ouro/`, `docs/aia/ouro-retido/`, `tasks/` e `mockups/`. As
   linhas não tocam documento.
6. Lista as referências por texto (string, template, regex, JSON, YAML, `.mjs`, `.cjs`, `*.Dockerfile`) em `apps/`,
   `packages/`, `e2e/`, `tools/`, `infra/`, `.github/` e em todo arquivo versionado da raiz. Busca o símbolo como identificador, e o caminho e o pacote como trecho inteiro, também sem a
   extensão (`packages/nucleo`, `componentes/ui/`, `hash-de-senha`), nunca segmento solto. Em regex e `String.raw`,
   busca na forma sem escape, sem exigir borda depois de `\b`, e pega o prefixo da gramática em
   `startsWith`/`endsWith`. A palavra `comum` só é listada quando o literal inteiro é ela, quando vem seguida de `(`,
   precedida de `@` ou `\b`, ou é segmento de caminho ou de acesso a membro (isso vale para o
   símbolo de uma palavra; a entrada `arquivo` e a `pasta` são sempre trecho inteiro); em prosa, URL (o literal com `://`) e e-mail
   (`\S+@\S+\.\S+`), não. A regex com alternância que parte o nome é limite declarado, coberto pelo
   `travas.md`. Ocorrência não classificada deixa o relatório vermelho.
7. Grava o `<N>.relatorio.md`.

Só grava depois de calcular tudo; a onda se desfaz com `git reset --hard` e `git clean -fd`, ou `git revert` depois
do commit.

**O `conferir`** roda nas ondas 3.0 a 11.0 e 13.0. Tira uma foto de `apps/`, `packages/`, `e2e/`, `infra/test/`, `infra/scripts/` e `tools/` (menos `tools/renomear/`) antes da onda e
outra depois. A foto tem: as strings, as partes fixas de template, os literais de regex, os `JsxText`, as chaves de
objeto literal, os nomes exportados por pacote, os especificadores de módulo e os casos de teste por arquivo. Antes de
comparar, o `conferir` aplica o mapa à foto de antes: o especificador, o caminho dos casos e o nome exportado. Depois
disso, qualquer diferença fora de `excecoesDoConferir` deixa o `conferir` vermelho.

**O `restos`** busca cada `de` de todos os mapas aplicados no escopo do passo 6 e nos documentos vivos, com a forma
de busca do passo 6 no código e a do passo 5 em comentário e documento (a palavra comum solta não conta). Liberados:
o `fica`, a chave mantida pelo passo 2, o `describe`/`it`/`test`, a troca à mão registrada e o que o passo 5 deixa
fora. Nas linhas, não olha documento. Roda em cada onda; na 13.0, também sem a isenção do ouro (RF3, RF6, RF9, RF10).

**O `reaplicar`.** O merge da `develop` que traz nome antigo vira uma correção (`/corrigir`), com revisão. A correção
roda `reaplicar`, que aplica os mapas feitos só às ocorrências novas: o `de` que não existe mais não é erro. Depois
roda `conferir` e `restos`. A correção `links-do-runbook` entra antes da 4.0.

**A trava contra filtro vazio** (2.0, antes de qualquer rename): cada glob, caminho e `path` em regex de
`configuracaoDasGuardas`, `EXCECOES_DAS_GUARDAS`, `PASTA_DOS_ADAPTADORES`, `ESCOPO_DO_ERRO_TIPADO`, `camadas.cjs`,
`guardioes-por-caminho.ts`, dos `files`/`ignores` do `eslint.config.mjs` (lido da configuração exportada), dos
workspaces, entries, `project` e `ignore` do `knip.json` e do `paths:` das regras casa com ao menos um arquivo, item a item, e cada fonte
rende um mínimo de itens. A base é o `git ls-files`: o item que nomeia `__fixtures__/` ou `mockups/` confere contra
ela inteira, e os demais contra ela sem essas pastas e sem `dist/`. Saída não versionada (`node_modules`, `dist`,
`playwright-report`, `test-results`, `.claude/worktrees`) é exceção nominal, com o motivo.

**As ondas:**

| Tarefa | Onda | Linha |
|---|---|---|
| 1.0 | `aplicar` e `reaplicar` | fila |
| 2.0 | `conferir`, `restos` e a trava contra filtro vazio | fila |
| 3.0 | shared: schemas, DTOs, erros e as pastas `erros/` e `sistema/` | fila |
| 4.0 | core, símbolos | fila |
| 5.0 | core, arquivos e pastas, e o pacote `@educa/core` | fila |
| 6.0 | arquivos e pastas de todos os apps e do e2e | fila |
| 7.0 | api, símbolos | back |
| 8.0 | worker, despachante, realtime e o apoio de teste do back | back |
| 9.0 | kit visual, símbolos | web |
| 10.0 | web fora do kit | web |
| 11.0 | e2e, símbolos | web |
| 12.0 | a guarda `guardas/nome-de-mercado` | fila |
| 13.0 | documentos: o guia, com a §9 reescrita; a arquitetura; a interface; os README; o que sobrar em `.claude/` | fila |

As linhas da adenda 2 entram na onda do caminho delas.

Os arquivos dos apps vêm antes das linhas porque o rename de arquivo mexe no `eslint-suppressions.json`, no
`eslint.config.mjs` e no `knip.json`. As linhas só renomeiam símbolo, separadas pelo `--escopo` e pelo `linhas.ts`;
trava de `tools/` nas duas é divergência.

**A guarda (12.0)** é a regra `guardas/nome-de-mercado`, em `REGRAS_DAS_GUARDAS`, só em `apps/`, `packages/` e
`e2e/`. A gramática (forma, tipos de declaração em que vale, nome de mercado na mensagem), o limite declarado e os
casos estão em `guarda.md`. Com o inventário e as duas adendas aplicados, a árvore inteira passa.

## 6. Isolamento (obrigatório)

Nenhuma consulta muda. Travas: `travas.md`, "Regra 10"; o `conferir` prova que nenhum teste de isolamento sai.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos e `docs/lgpd.md` | nada muda |
| Log | evento igual. O campo `tipo` muda junto com o `this.name` (adenda 1), e nenhum alerta nem o runbook o leem (passo 6 sobre `infra/`) |
| Auditoria, provedor externo, retenção | iguais, porque a ação auditada e o `IA_ADAPTADOR` são strings |
| Autorização por objeto e DTO de saída | iguais: a mesma matriz, e as chaves do schema ficam |

Travas: `travas.md`, regras 20 e 30.

## 7b. Conformidade CNE

Prompt e ação auditada são strings (`conferir`). Travas: `travas.md`, "Regra 70". O ouro sai por correção do
Arquiteto depois da 5.0.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente | só no nome; fila, chave Redis, Lua e limites iguais |
| Migration | nenhuma. O `db:gerar` roda na 4.0 e na 5.0 sem gerar migration, e o `_journal` não muda |
| Imagem e deploy | o Dockerfile copia `packages/core`; `ops/` fica (adenda 1). Prova: a esteira constrói as imagens, e o `docker compose config` de produção sai igual |
| Arquivo lido em execução, carga e ensaio | `travas.md`, "Regra 80" |
| Linha | onda de linha só é verde depois da esteira da spec (o `ci.yml` não roda `infra` nem e2e em `spec/**--l*`) |

## 9. Frontend

Nenhuma tela muda (§5, `conferir`).

## 10. Testes

| Camada | O que será testado |
|---|---|
| `aplicar`, `reaplicar`, `conferir`, `restos` e filtro vazio | os casos de `casos.md`, um por cláusula do §5 |
| Guarda (12.0) | os casos de `guarda.md` |
| Travas | as provas de `travas.md`, na onda de cada uma |
| Suítes de hoje | verdes antes da 1.0 e a cada onda |

**Mutação.** A 1.0, a 2.0 e a 12.0 levam o bloco de mutação. Toda onda que troca trava leva um bloco por trava, numa
de três formas (`travas.md` diz qual): **A**, a mutação devolve a trava ao nome antigo, e um caso que já existe,
renomeado, fica vermelho; **B**, na trava negativa (`not.toContain`), a mutação põe o nome novo proibido no código sob
teste, e o caso existente fica vermelho; **C**, onde nenhum caso alcança, ficam vermelhos o `restos`, o `tsc`, o build
ou a trava contra filtro vazio. Nenhum caso entra (RF7). A onda sem trava leva "Sem mutação: rename, sem condição nova"
(X7, RF17).

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Onde está registrado |
|---|---|---|---|
| 10, 20, 30, 70, 80 | `travas.md`, a trava contra filtro vazio e o `conferir` | nenhum | — |
| 40 | o `conferir` prova os mesmos casos; ferramenta e guarda têm teste que quebra sem a regra | nenhum | — |
| RF7 ("só nome") | — | **Os três scripts de `infra/scripts/` passam a tirar os tipos de `typeof import(<fonte>)`.** Único diff de não-nome: o typecheck pega a chave que ficar para trás | aqui e em `travas.md` |
| `criar-tasks` ("até três guardiões") | — | **As ondas 3.0 a 11.0 marcam os quatro guardiões** (X7, RF15); o revisor confere mapa, relatório, `conferir`, `restos` e travas | aqui e em cada `N_task.md` |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: que o `findRenameLocations` (TypeScript 6.0.3) alcança outro projeto pela condição `source`;
  senão, `getReferencesAtPosition` projeto a projeto. A 1.0 prova com dois projetos
- ⚠️ NÃO VERIFICADO: que o `npm install --package-lock-only` não muda versão. A 5.0 confere o diff do lock

## 13. Riscos técnicos

- **A régua de duração do e2e** cobra caso só renomeado: a onda o marca "só rename", e correção só se a duração cresceu
