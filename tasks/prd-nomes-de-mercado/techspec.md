# Tech Spec — Nomes de mercado (X8)

**PRD:** `prd.md` · **Inventário:** `inventario.md` e anexos (adenda 2 em `inventario-adenda-2.md`) · **Travas:** `travas.md` · **Guarda:** `guarda.md` · **Casos:** `casos.md`
**Status:** aprovada na revisão da spec (rodada 9, 30/10/2026)

## 1. Resumo da abordagem

O `tools/renomear/` tem quatro comandos: `aplicar` (o "rename symbol" do serviço de linguagem do TypeScript, um por
`tsconfig`, e o move por conta de caminho, com o serviço só para o `tsconfig`), `conferir` (o "só nome"), `restos` (nada sobrou) e
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

No símbolo, o `de` repetido é o mesmo `de` no mesmo pacote (`apps/<x>`, `packages/<x>`; fora disso, a primeira pasta). Dois
homônimos com destinos diferentes, cada um num pacote, entram com `arquivo` nas duas entradas (o `OpcoesDaMontagem` do worker
e o do despachante, `inventario-back.md:316` e `:321`): o `aplicar` acha a declaração pelo `arquivo`, e o `conferir` segue
cada entrada só no pacote dela. Repete, e recusa, se uma das entradas não tem `arquivo` (ela vale em todo pacote) ou se os
dois `arquivo` caem no mesmo pacote, onde o `conferir` não separa o nome reexportado. Arquivo, pasta e pacote seguem pelo `de`
sozinho (triagem da divergência da 8.0, 31/10/2026).

**O `aplicar`, passo a passo:**

1. Abre um serviço de linguagem por `tsconfig` (a raiz, `e2e/`, `infra/` e cada workspace) e junta os locais sem
   repetir. O pacote resolve pela condição `source`.
2. Renomeia o símbolo (`findRenameLocations` com `providePrefixAndSuffixTextForRename: false`, que é o que atravessa o
   `export { x } from` e o import: com a opção ligada o serviço pára no re-export e deixa `apps/api` e `apps/web` com o nome
   antigo, o que a 1.0 mediu), e a ferramenta refaz a forma curta: `{ esquemaTurma }` vira `{ esquemaTurma: turmaSchema }`,
   com a chave intacta, e o `import { x as y }` troca só o lado certo.
3. Move o arquivo e a pasta (`git mv`). O especificador relativo de `import`, `export ... from`, `require`, `import()` e
   `vi.mock` é conta de caminho (`reescreverRelativos`, a mesma do `reaplicar`), que não resolve módulo e conserva a extensão
   que o import já tinha. O `getEditsForFileRename` fica só para o `tsconfig` (`files`, `include`, `exclude`, `paths`), num
   serviço por projeto sem arquivo de código: com o programa dos 10 projetos, cada move custava ~105 s (mapa 5, 3h33
   projetadas); pela conta, os 12 moves da amostra deram o mesmo texto nos 3.808 arquivos (correção
   `2026-10-31-aplicar-lento-com-dependentes`, 30/10/2026). Limite: o import da pasta pelo `index` (`'./estado'`)
   acompanha o move da pasta, não o do `index.ts` sozinho; o mapa move a pasta, e o typecheck do portão pega o que
   escapar. O rename só de caixa passa por um nome intermediário.
4. No pacote, troca o `name`, os `exports` e as dependências, e roda `npm install --package-lock-only`.
5. Em comentário e em documento vivo (`CLAUDE.md`, `.claude/`, `docs/`), troca sozinho só o identificador composto
   (`AdaptadorFalso`, `exigirEscolaDoContexto`), o que está entre crases e o que está em `{@link}`, e o caminho. A
   palavra comum (`com`, `Banco`, `Tela`, `Contador`, `Despachante`, `Fila`, `migrar`) vai para a lista de troca à mão
   do relatório. A palavra comum entre crases que nomeia outra coisa (o serviço `migrar` do compose, a `migrar` de
   `separar-achados.ts`) o passo 5 troca do mesmo jeito: a onda desfaz à mão e registra a ocorrência como `fica`, com o
   motivo, e o arquivo entra nos "Arquivos previstos" mesmo sem diff no fim. Ficam fora `docs/decisoes.md`, `docs/aia/ouro/`, `docs/aia/ouro-retido/`, `tasks/` e `mockups/`. As
   linhas não tocam documento.
6. Lista as referências por texto (string, template, regex, JSON, YAML, `.mjs`, `.cjs`, `*.Dockerfile`) em `apps/`,
   `packages/`, `e2e/`, `tools/`, `infra/`, `.github/` e em todo arquivo versionado da raiz. O pacote é buscado
   inteiro (`@educa/nucleo`). O símbolo, como identificador, distinguindo maiúscula de minúscula. O `arquivo` e a
   `pasta`, pelo trecho de pasta-mãe e nome, com e sem extensão (`packages/nucleo`, `componentes/ui`,
   `credencial/hash-de-senha`); o nome solto (`'./fila/x'`, `'hash-de-senha.js'`) é limite coberto pelo `travas.md`,
   e o import relativo é do passo 3. Em regex e `String.raw`, busca na forma sem escape, sem exigir borda depois de `\b`, e pega o
   prefixo da gramática em `startsWith`/`endsWith`. O símbolo `comum` só é listado quando o literal inteiro é ele,
   quando vem seguido de `(`, precedido de `@` ou `\b`, ou é segmento de caminho ou de acesso a membro; em prosa, URL
   (o literal com `://`) e e-mail (`\S+@\S+\.\S+`), não. A regex com alternância que parte o nome também é
   limite do `travas.md`. Ocorrência não classificada deixa o relatório vermelho.
7. Grava o `<N>.relatorio.md`.

Só grava depois de calcular tudo; a onda se desfaz com `git reset --hard` e `git clean -fd`, ou `git revert`.

**O `conferir`** roda nas ondas 3.0 a 11.0 e 13.0. Tira uma foto de `apps/`, `packages/`, `e2e/`, `infra/test/`, `infra/scripts/` e `tools/` (menos `tools/renomear/`) antes da onda e
outra depois. A foto tem: as strings, as partes fixas de template, os literais de regex, os `JsxText`, as chaves de
objeto literal, os nomes exportados por pacote, os especificadores de módulo e os casos de teste por arquivo. Antes de
comparar, o `conferir` aplica o mapa à foto de antes: o especificador, o caminho dos casos e o nome exportado. O nome
exportado segue a entrada `simbolo` só no pacote do `arquivo` dela e em quem o reexporta desse pacote (`export { X } from`);
o homônimo exportado por outro pacote fica com o nome (a `migrar` de `tools/processo/separar-achados.ts` não é a do core), e
a entrada sem `arquivo` vale em todo pacote. Dentro do pacote da entrada, o nome declarado ali mesmo (sem origem de
reexportação) só segue a entrada no próprio `arquivo` dela: o homônimo declarado em outro arquivo do mesmo pacote fica com o
nome, como o `aplicar` o deixa (o `Linha` de `areas/coordenacao/comum/pecas-da-lista.tsx` não é o do kit; triagem da 2ª
divergência da 9.0, 31/10/2026). Depois
disso, qualquer diferença fora de `excecoesDoConferir` deixa o `conferir` vermelho.

**O `restos`** busca cada `de` de todos os mapas aplicados no escopo do passo 6 e nos documentos vivos, com a forma
de busca do passo 6 no código e a do passo 5 em comentário e documento (a palavra comum solta não conta). Liberados:
o `fica`, a chave mantida pelo passo 2, o `describe`/`it`/`test`, a troca à mão registrada e o que o passo 5 deixa
fora. O `arquivo` de um `fica` e o da troca à mão registrada são os da árvore logo depois da onda que os
classificou: antes de comparar, o `restos` (e a lista de não classificadas do `reaplicar`) leva cada um pelos movimentos
`arquivo` e `pasta` das ondas seguintes, na ordem das ondas. O mapa e o relatório de onda feita não se reescrevem. O mapa de linha (`"linha": true`) não olha documento até a 13.0 criar o `mapas/13.json`, que tira também a
isenção do ouro; o `reaplicar` leva então os mapas de linha aos documentos (RF3, RF6, RF9, RF10).

**O `reaplicar`.** O merge da `develop` que traz nome antigo vira uma correção (`/corrigir`), com revisão. A correção
roda `reaplicar`, que aplica os mapas feitos só às ocorrências novas: o `de` que não existe mais não é erro. Depois
roda `conferir` e `restos`. A correção `links-do-runbook` entra antes da 4.0.

**A trava contra filtro vazio** (2.0): cada glob, caminho e `path` em regex de
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

Na linha back, o rename de símbolo da api alcança quem o chama fora de `apps/api/` (o `main.ts` que chama
`AppModule.forRoot`), o comentário que o cita em `packages/core/` ou na web, e o homônimo com o mesmo destino em outro
app. Esses arquivos entram nomeados nos previstos da onda, desde que não estejam nos da tarefa da outra linha. O
comentário de uma linha só, com duas linhas sem mudança até o que a outra tarefa renomeia, também entra. Fora disso, é
divergência (triagem da 7.0, 31/10/2026).

Os arquivos dos apps vêm antes das linhas porque o rename de arquivo mexe na configuração da raiz. As linhas só renomeiam símbolo, separadas pelo `--escopo` e pelo `linhas.ts`;
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
| Linha | só é verde depois da esteira da spec (o `ci.yml` não roda `infra` nem e2e em `spec/**--l*`) |

## 9. Frontend

Nenhuma tela muda (`conferir`).

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
ou a trava contra filtro vazio. Nenhum caso entra (RF7). A onda sem trava leva "Sem mutação: rename, sem condição nova".

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Onde está registrado |
|---|---|---|---|
| 10, 20, 30, 70, 80 | `travas.md`, a trava contra filtro vazio e o `conferir` | nenhum | — |
| 40 | o `conferir` prova os mesmos casos; ferramenta e guarda têm teste que quebra sem a regra | nenhum | — |
| RF7 ("só nome") | Os três scripts de `infra/scripts/` mantêm o `import type` da fonte e o tipo literal, com o nome trocado: o nome exportado que ficar para trás deixa o `tsc -p infra/tsconfig.json` vermelho; a chave do tipo literal e o caminho do `dist` são texto, e o `restos` os pega (`travas.md`, regra 80) | nenhum. O `typeof import(<fonte>)` previsto antes saiu na 5.0 (divergência de 31/10/2026): o lint o proíbe (`consistent-type-imports`, `eslint.config.mjs:54`) e a guarda `tabela-so-no-repository` reprova `import('@educa/core')` em `infra/scripts/`; a exceção nas duas guardas custaria mais que a checagem da chave, que o `restos` já faz | aqui e em `travas.md` |
| `criar-tasks` ("até três guardiões") | — | **As ondas 3.0 a 11.0 marcam os quatro guardiões** (X7, RF15), e a 2.0 e a 12.0 pelo caminho `tools/guardas/`; o revisor confere mapa, relatório, `conferir`, `restos` e travas | aqui e em cada `N_task.md` |

## 12. Premissas não verificadas

- ✅ VERIFICADO na 1.0: que o `findRenameLocations` (TypeScript 6.0.3) alcança outro projeto pela condição `source`, sem a opção `providePrefixAndSuffixTextForRename` (caso "símbolo do shared em dois projetos" de `tools/renomear/aplicar.test.ts`);
- ⚠️ NÃO VERIFICADO: que o `npm install --package-lock-only` não muda versão. A 5.0 confere o diff do lock

## 13. Riscos técnicos

- **A régua de duração do e2e** cobra caso só renomeado: a onda o marca "só rename"; corrige-se só o que cresceu.
  A onda não encurta nem divide caso de e2e: isso muda o caso, e o `conferir` cobra os mesmos casos (RF7). O caso
  em que a onda só trocou comentário não é alterado para a régua: a correção `duracao-do-e2e-so-comentario`
  (`tools/ci/duracao-do-e2e.ts`, `motivoDaDuracaoDoE2e`) tira de `casosAlterados` o caso cujo trecho sem comentário
  (`casosDoSpec`: do título ao próximo `test(`, o mesmo que `casosAlterados` atribui ao caso, com o gancho que vier
  depois dele; no último caso, até o fim do arquivo) é igual ao do HEAD, no mesmo arquivo e com o mesmo título, único
  dos dois lados. O caso com identificador renomeado no código, ou com um gancho mudado no trecho dele, continua
  medido (divergência de portão da 9.0, `e2e/tokens.spec.ts:215`, 31/10/2026)
