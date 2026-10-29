# Tech Spec — Nomes de mercado (X8)

**PRD:** `prd.md` · **Inventário:** `inventario.md` e anexos · **Travas:** `travas.md`
**Status:** rascunho, rodada 2 da revisão da spec

## 1. Resumo da abordagem

O `tools/renomear/` tem quatro comandos. O `aplicar` roda o "rename symbol" e o "move file" do serviço de linguagem
do TypeScript, um por `tsconfig` (o ts-morph tem um projeto só). O `conferir` prova o "só nome", o `restos` prova que
nada sobrou, e o `reaplicar` serve ao merge. Cada onda escreve o mapa a partir do anexo, roda os comandos e troca à
mão as travas (`travas.md`). Depois das ondas em fila, o back e a web correm em duas linhas (Joaquim, 29/10/2026).

## 2. Módulos afetados

| Módulo | O quê |
|---|---|
| `tools/renomear/`, `tools/guardas/filtros-casam.test.ts` (novos) | os comandos e a trava contra filtro vazio |
| `mapas/<N>.json` e `<N>.relatorio.md` (novos, um por onda) | o mapa e o relatório |
| `packages/`, `apps/`, `e2e/` | as ondas |
| `tools/`, `infra/`, configs da raiz, `.github/` | só as travas e os imports |
| `CLAUDE.md`, `.claude/`, `docs/` vivos | o caminho na onda que o muda; o nome nas ondas em fila e na 13.0 |

## 3 e 4. Modelo de dados e API

Nada muda. A `drizzle/` vai para `packages/core/` com o pacote. O caminho é resolvido a partir do arquivo
(`PASTA_MIGRACOES`), e o drizzle registra a migration pelo hash. Rota, corpo, código de erro e evento de WebSocket são
strings, e o `conferir` os compara.

## 5. Fluxo

**O mapa** tem entradas `{ tipo: simbolo|arquivo|pasta|pacote, de, para, arquivo?, linhaDoAnexo, alias? }` e duas
listas:

- `ocorrencias`: cada referência por texto, classificada como `fica` (string de fora, com a linha de "Não muda, mas
  parece") ou `trava` (com a linha do `travas.md`);
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
6. Lista cada `de` (símbolo, trecho de caminho, pacote) que aparece como palavra inteira em string, template, regex,
   JSON, YAML, `.mjs`, `.cjs` e `Dockerfile`, em `apps/`, `packages/`, `e2e/`, `tools/` e `infra/`. A ocorrência que
   não está classificada no mapa deixa o relatório vermelho.
7. Grava o `<N>.relatorio.md`.

Ele só grava depois de calcular tudo; a onda se desfaz com `git reset --hard` e `git clean -fd` antes do commit, e
com `git revert` depois.

**O `conferir`** tira uma foto de `apps/`, `packages/`, `e2e/`, `tools/guardas/` e `tools/processo/` antes da onda e
outra depois. A foto tem: as strings, as partes fixas de template, os literais de regex, os `JsxText`, as chaves de
objeto literal, os nomes exportados por pacote, os especificadores de módulo e os casos de teste por arquivo. Antes de
comparar, o `conferir` aplica o mapa à foto de antes: o especificador, o caminho dos casos e o nome exportado. Depois
disso, qualquer diferença fora de `excecoesDoConferir` deixa o `conferir` vermelho.

**O `restos`** busca cada `de` de todos os mapas aplicados, como palavra inteira, no código e nos documentos vivos. Liberados: o `fica`, o
texto de `describe`/`it`/`test` e o que o passo 5 deixa fora. Roda em cada onda e na 13.0 (RF3, RF6, RF9 e RF10).

**O `reaplicar`.** O merge da `develop` que traz nome antigo vira uma correção (`/corrigir`), com revisão. A correção
roda `reaplicar`, que aplica os mapas feitos só às ocorrências novas: o `de` que não existe mais não é erro. Depois
roda `conferir` e `restos`. A correção `links-do-runbook` entra antes da 4.0.

**A trava contra filtro vazio** (2.0, antes de qualquer rename): todo glob e caminho de `configuracaoDasGuardas`,
`EXCECOES_DAS_GUARDAS`, `PASTA_DOS_ADAPTADORES`, `ESCOPO_DO_ERRO_TIPADO`, `camadas.cjs` e `guardioes-por-caminho.ts`
casa com ao menos um arquivo.

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

Os arquivos dos apps vêm antes das linhas porque todo rename de arquivo mexe no `eslint-suppressions.json`, no
`eslint.config.mjs` e no `knip.json`. As linhas só renomeiam símbolo, sem tocar documento; o `--escopo` e o
`linhas.ts` as separam. Trava de `tools/` nas duas linhas é divergência.

**A guarda (12.0)** é a regra `guardas/nome-de-mercado`, em `tools/guardas/regras-nome.mjs`. A lista dela fica em
`tools/guardas/nomes-de-mercado.mjs`. Ela entra em `REGRAS_DAS_GUARDAS` (segunda passada,
`allowInlineConfig: false`), vale só em `apps/**`, `packages/**` e `e2e/**`, e não é a `naming-convention`, que não dá o
nome de mercado na mensagem nem lê arquivo e pasta.

**A gramática.** Cada entrada da lista tem três partes:

- a forma: nome exato (os do kit: `Botao`, `Cartao`, `Dialogo`, `Abas`, `Tabela`, `Tela`), prefixo ou sufixo;
- os tipos de declaração em que vale (`Linha…` e `Opcoes…` só em interface e tipo; `Erro…`, `Filtro…`, `Guarda…`,
  `Adaptador…` e `…EmMemoria` só em classe);
- o nome de mercado, que vai na mensagem.

A pasta e o arquivo são comparados por segmento (`fila`, `limite`, `adaptador-*`). **O resto é limite declarado:** a
regra não lê método, variável local, propriedade nem string. `Pedido…` e `Resposta…` ficam fora da lista, porque
colidem com o domínio, e `fila/` também, porque "fila" é domínio na web. Com a lista assim, `DialogoDeAlocacao`,
`CartaoDoAgente`, `ErroDaOperacao` e `LinhaDoMaterial` passam.

## 6. Isolamento (obrigatório)

Nenhuma consulta muda. As travas estão em `travas.md`, "Regra 10"; o `conferir` prova que nenhum teste de isolamento
entra ou sai.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos e `docs/lgpd.md` | nada muda |
| Log | evento igual. O campo `tipo` muda junto com o `this.name` (adenda 1), e nenhum alerta nem o runbook o leem |
| Auditoria, provedor externo, retenção | iguais, porque a ação auditada e o `IA_ADAPTADOR` são strings |
| Autorização por objeto e DTO de saída | iguais: a mesma matriz, e as chaves do schema ficam |

As travas das regras 20 e 30 estão em `travas.md` (`PASTA_DOS_ADAPTADORES` passa a `packages/core/src/ia/*-adapter.ts`).

## 7b. Conformidade CNE

O rename passa pela IA do Tutor e do Assistente sem mudar comportamento: prompt e ação auditada são strings
(`conferir`). As travas da regra 70 estão em `travas.md`, seção "Regra 70". O
ouro sai por correção do Arquiteto depois da 5.0.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente | tocado só no nome (guards, vaga por escola, outbox, gateway de IA); fila, chave Redis, Lua e limites iguais |
| Migration | nenhuma. O `db:gerar` roda na 4.0 e na 5.0 sem gerar migration, e o `_journal` não muda |
| Imagem e deploy | o Dockerfile copia `packages/core`; `ops/` fica (adenda 1). Prova: a esteira constrói as imagens, e o `docker compose config` de produção sai igual |
| Arquivo lido em execução, carga e ensaio | `travas.md`, "Regra 80" |
| Linha | onda de linha só é verde depois da esteira da spec (o `ci.yml` não roda `infra` nem e2e em `spec/**--l*`) |

## 9. Frontend

Nenhuma tela muda (§5, `conferir`).

## 10. Testes

| Camada | O que será testado |
|---|---|
| `aplicar` | o símbolo do `shared` nos dois projetos que o usam, com o comentário composto, e a string igual ao nome intacta; "com" como preposição num comentário e "Banco público" num `.md`, intactos; a forma curta com a chave mantida; o move com o import relativo, o de pacote e o `vi.mock`; o rename só de caixa; cada um dos seis casos de recusa; a ocorrência não classificada deixando o relatório vermelho |
| `reaplicar` | o `de` já renomeado: não é erro; a ocorrência nova: renomeada |
| `conferir` | vermelho com uma string, uma regex, um `JsxText` ou uma chave de objeto mudados, com um caso a menos e com um especificador fora do mapa; verde com o especificador renomeado e com a exceção declarada |
| `restos` | o nome antigo no código: vermelho; no `describe`, em `fica` e em `docs/decisoes.md`: verde |
| Filtro vazio | um glob que não casa nada: vermelho |
| Guarda (12.0) | um caso recusado por tipo de declaração (classe, interface, tipo, enum, função, variável exportada, decorator), por arquivo e por pasta; `Botao` exato recusado; `TurmaController`, `EliminacaoDoTitular`, `PedidoDoTitular`, `CorrecaoService`, `ValidacaoDoLote`, `DialogoDeAlocacao` e `CartaoDoAgente` passam; `eslint-disable` sobre a regra não desliga; `tools/` fora |
| Travas | as provas de `travas.md`, na onda de cada uma |
| Suítes de hoje | verdes antes da 1.0 e em cada onda |

**Mutação.** A 1.0, a 2.0 e a 12.0 levam o bloco de mutação. As ondas levam "Sem mutação: rename, sem condição nova"
(X7, RF17).

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Onde está registrado |
|---|---|---|---|
| 10, 20, 30, 70, 80 | `travas.md`, a trava contra filtro vazio e o `conferir` | nenhum | — |
| 40 | o `conferir` prova o mesmo conjunto de casos; a ferramenta e a guarda têm teste que quebra sem a regra | nenhum | — |
| RF7 ("só nome") | — | **Os três scripts de `infra/scripts/` passam a tirar os tipos de `typeof import(<fonte>)`.** Único diff de não-nome: o typecheck pega a chave que ficar para trás | aqui e em `travas.md` |
| `criar-tasks` ("até três guardiões") | — | **As ondas 3.0 a 11.0 marcam os quatro guardiões** (X7, RF15). O revisor confere o mapa, o relatório, o `conferir`, o `restos` e as travas, não as linhas trocadas | aqui e em cada `N_task.md` |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: que o `findRenameLocations` (TypeScript 6.0.3) alcança outro projeto pela condição `source`. Se
  não alcançar, o `getReferencesAtPosition` entra projeto a projeto. A 1.0 prova com dois projetos
- ⚠️ NÃO VERIFICADO: que o `npm install --package-lock-only` não muda versão. A 5.0 confere que o diff do lock é só o
  nome e o caminho

## 13. Riscos técnicos

- **A régua de duração do e2e** cobra caso só renomeado: a onda o marca "só rename", e correção só se a duração cresceu
