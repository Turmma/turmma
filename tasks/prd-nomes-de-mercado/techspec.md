# Tech Spec — Nomes de mercado (X8)

**PRD:** `tasks/prd-nomes-de-mercado/prd.md` · **Inventário:** `inventario.md` e os três anexos
**Status:** rascunho

## 1. Resumo da abordagem

A 1.0 escreve o `tools/renomear/`, que tem dois comandos:

- o `aplicar` lê um mapa e executa o "rename symbol" e o "move file" do serviço de linguagem do TypeScript (os do VS
  Code) em todos os projetos de uma vez;
- o `conferir` compara as strings e os textos de tela de antes e de depois, e é ele que prova o "diff só de nome".

Cada onda escreve o mapa dela a partir do anexo, roda os dois comandos e ajusta à mão as referências por texto (§2).
As duas linhas (decisão do Joaquim, 29/10/2026) vêm depois do core.

## 2. Módulos afetados

| Módulo | O quê |
|---|---|
| `tools/renomear/` (novo) | `aplicar`, `conferir` e os testes deles |
| `tasks/prd-nomes-de-mercado/mapas/<N>.json` (novo) | o mapa da onda: entrada do `aplicar` e documento da tarefa |
| `packages/shared`, `packages/nucleo` → `packages/core`, `apps/*`, `e2e/` | as ondas da §5 |
| `tools/guardas/` | as referências por texto, em cada onda (RF11), e a regra `guardas/nome-de-mercado` na 11.0 (RF8) |
| `tools/processo/`, `tools/testes/`, `tools/ia/`, `tools/ci/`, `tools/demonstracao/` | só as referências por texto e os imports |
| `eslint-suppressions.json`, `eslint.config.mjs`, `knip.json`, `package.json`, `package-lock.json`, `infra/docker/servico.Dockerfile`, `infra/compose.yml`, `infra/test/`, `infra/scripts/`, `.github/workflows/ci.yml` | o caminho e o nome do pacote, na onda que os muda |
| `CLAUDE.md`, `.claude/`, `docs/` vivos | o caminho, na onda que o muda; o nome de símbolo, nas ondas em fila e na 12.0 |

**Referências por texto** são os arquivos que escrevem nome ou caminho de peça como texto (inventário §4 e a seção
"Referências por caminho ou por nome" de cada anexo), e o serviço de linguagem não os vê. O `aplicar` lista onde cada
nome do mapa aparece como palavra inteira fora do TypeScript (`.mjs`, `.cjs`, `.json`, `.yml`, `Dockerfile`, `.md`),
mas não troca sozinho. Quem troca é a onda, que também roda o teste da trava.

## 3 e 4. Modelo de dados e API

Nada muda. A pasta `drizzle/` vai para `packages/core/` com o pacote. O caminho é resolvido a partir do arquivo
(`PASTA_MIGRACOES`), e o drizzle registra a migration aplicada pelo hash. Rota, corpo, código de erro e
evento do WebSocket são strings, e o `conferir` as compara.

## 5. Fluxo

**O mapa** é uma lista de `{ tipo: "simbolo" | "arquivo" | "pasta" | "pacote", de, para, arquivo?, linhaDoAnexo }`. A
linha agrupada do anexo (`A / B`) vira uma entrada por nome. O `aplicar` recusa o mapa inteiro, sem escrever nada,
quando:

- o `de` não existe no arquivo declarado;
- o `para` colide com um nome que já existe no mesmo escopo;
- o `de` se repete;
- a entrada não tem `linhaDoAnexo`.

Peça fora do anexo só entra por adenda aprovada (RF2).

**O `aplicar`:**

1. Carrega um serviço de linguagem por `tsconfig` (a raiz, `e2e/`, `infra/` e cada workspace) e junta, sem repetir,
   os locais de todos. O pacote resolve pela condição `source`, e por isso o rename no `shared` alcança a API e a web
   na mesma passada.
2. Renomeia o símbolo (`findRenameLocations`) e, como palavra inteira, o nome nos comentários. **Nunca toca string.**
3. Move o arquivo e a pasta com `getEditsForFileRename`, que corrige os imports e o `vi.mock`, mais `git mv`. O
   rename só de caixa passa por um nome intermediário.
4. No pacote, troca `name`, `exports` e dependências nos `package.json`, e regenera o lock com
   `npm install --package-lock-only`.
5. Nos documentos vivos (`CLAUDE.md`, `.claude/`, `docs/` menos `decisoes.md`), troca o caminho. Nas ondas em fila,
   troca também o nome de símbolo. O `tasks/` e o `mockups/` não mudam.
6. Escreve o relatório: os arquivos tocados, as referências por texto e o que não achou.

Ele só grava depois de calcular tudo. Antes do commit, `git checkout .` desfaz a onda; depois, `git revert`.

**O `conferir`** tira uma foto do AST de `apps/`, `packages/` e `e2e/` antes da onda e outra depois. A foto tem:

- o multiconjunto das strings literais, das partes fixas de template e dos `JsxText`. O especificador de módulo
  (`import`, `export … from`, `import()`, `vi.mock`, `vi.importActual`) não entra, nem a string que fica igual à de
  antes depois de aplicado o mapa de caminhos (o `ARQUIVO_DO_SANDBOX` e o `vaga.lua`);
- os casos de teste por arquivo, com o caminho normalizado pelo mapa;
- a contagem de exportações por pacote.

Qualquer diferença deixa o `conferir` vermelho. A exceção, quando houver, mora no mapa (`excecoesDoConferir`), com o
motivo.

**As ondas:**

| Tarefa | Onda | Linha |
|---|---|---|
| 1.0 | `tools/renomear/` | fila |
| 2.0 | shared: schemas, DTOs, erros e as pastas `erros/` e `sistema/` | fila |
| 3.0 | core, símbolos: IA, fila e outbox, erros, banco, contexto, guards e decorators, limite, telemetria, storage | fila |
| 4.0 | core: arquivos, pastas e o pacote `@educa/core` | fila |
| 5.0 | arquivos e pastas de todos os apps e do e2e | fila |
| 6.0 | api, símbolos | back |
| 7.0 | worker, despachante, realtime e as peças de apoio de teste do back | back |
| 8.0 | kit visual, símbolos | web |
| 9.0 | web fora do kit: cliente, consultas, chaves, providers, roteamento, utilitários | web |
| 10.0 | e2e, símbolos | web |
| 11.0 | guarda `guardas/nome-de-mercado` | fila, depois das linhas |
| 12.0 | documentos: o guia (com a §9 reescrita), a arquitetura, a interface, os READMEs e o que restar em `.claude/` | fila, por último |

**Por que os arquivos dos apps vêm antes das linhas.** Todo rename de arquivo mexe no `eslint-suppressions.json`
(132 caminhos dos apps), no `eslint.config.mjs` e no `knip.json`. Com isso feito na 5.0, as linhas só renomeiam
símbolo e não tocam documento, e o `linhas.ts` confere que os "Arquivos previstos" das duas não se cruzam. Se uma
linha precisar de uma referência por texto que a outra também prevê, é divergência.

**A guarda (11.0)** é uma regra do plugin `guardas` (`tools/guardas/regras-nome.mjs`), e não `no-restricted-syntax`: o
bloco de config que vem depois sobrescreveria o `no-restricted-syntax`, e a regra do plugin não se desliga por
comentário. Ela lê:

- o nome de classe, interface, tipo, enum, função, variável exportada e decorator, e cada pasta de
  `context.filename`;
- os prefixos e sufixos da coluna da esquerda do inventário §1, mais os do kit (`Botao`, `Cartao`, `Dialogo`, `Abas`,
  `Tabela`), cada um com o nome de mercado na mensagem.

**Essa é a gramática, e o resto é limite declarado:** método, variável local, propriedade e string não são lidos, e
`Pedido…` e `Resposta…` ficam fora porque colidem com o domínio. A esteira verde na 11.0, com o repositório inteiro
passando pela regra, prova que não sobrou nome antigo.

## 6. Isolamento (obrigatório)

Nenhuma consulta muda. O risco é uma trava da regra 10 continuar verde sem checar nada:

| Trava | Lê pelo nome | Onda | Prova |
|---|---|---|---|
| `escopo-dos-repositories.ts`, `repositories-com-escopo.test.ts` | `SemEscopo`, `exigirEscolaDoContexto`, `contextoAtual`, `Banco` | 3.0 | repository de fixture sem `requireEscolaId()` e sem `@Unscoped`: vermelho |
| `regras-tenant.mjs` | `Banco` | 3.0 | o caso de fixture com o tipo novo: vermelho |
| `camadas.cjs` | `packages/nucleo`, `ciclo-de-vida`, `conta-global` | 4.0 | violação de camada no caminho novo: vermelha |
| `guardioes-por-caminho.ts`, `portao.ts` | `packages/nucleo`, `SemEscopo` | 3.0 e 4.0 | commit em `packages/core/src/` exige os quatro guardiões; `@Unscoped` novo chama o `tenancy-guardian` |
| `apps/api/test/arquitetura.test.ts` | 15 caminhos de `nucleo/src` | 4.0 e 5.0 | falha com um caminho inexistente |

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos tocados, novos e `docs/lgpd.md` | nenhum |
| Log, auditoria, provedor externo, retenção | iguais: evento de log, ação auditada e `IA_ADAPTADOR` são strings, e o `conferir` os compara |
| Autorização por objeto | igual: `@Permite` → `@RequirePermissao`, e a matriz é a mesma |
| DTO de saída | as chaves do schema não mudam, só o nome do tipo |

A guarda de log (`regras-log.mjs`: `resumirErro`, `LoggerDoNest`) e a do SDK de IA (`regras-ia.mjs`:
`PASTA_DOS_ADAPTADORES`, porque os arquivos viram `*-adapter.ts`) mudam na 3.0 e na 4.0. Cada uma ganha um caso de
fixture com o nome novo, que a deixa vermelha.

## 7b. Conformidade CNE

Sem IA no caminho do aluno. As travas da regra 70 são testes de integração, e valem as da §10.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente, fila, limite e rate limit | fora do caminho quente: o código de execução e as strings de fila e de chave Redis são os mesmos |
| Migration | nenhuma |
| Imagem e deploy | o `servico.Dockerfile` copia `packages/core`, o serviço do compose não muda, e a VM sobe pela `main` (D31). Prova: a esteira constrói as imagens, e o `docker compose config` de produção sai igual |
| Métrica e alerta | iguais |

## 9. Frontend

Nenhuma tela muda (§5, `conferir`). O `nome-dos-chunks.ts` muda na 5.0, com o teste dele.

## 10. Testes

| Camada | O que será testado |
|---|---|
| `tools/renomear/` | o símbolo do `shared` renomeado nos dois projetos que o usam, com o comentário, e a string igual ao nome intacta; o move de arquivo corrige o import relativo, o de pacote e o `vi.mock`; o rename só de caixa; o mapa recusado em cada uma das quatro condições; o `conferir` vermelho com uma string mudada, um caso a menos, um `JsxText` mudado e um import fora do mapa; o `conferir` verde com o especificador renomeado e com a exceção declarada |
| Guarda (11.0) | `class AdaptadorX` recusada, com `XAdapter` na mensagem; `ConsumoEmMemoria`, `guarda-x.ts` e a pasta `fila/` recusados; `TurmaController`, `EliminacaoDoTitular` e `PedidoDoTitular` passam |
| Travas (RF11) | os casos da §6 e da §7, na onda que as muda |
| Integração, e2e, isolamento | as suítes de hoje, inteiras, em cada onda |

**Mutação.** As ondas levam "Sem mutação: rename, sem condição nova" (X7, RF17). A 1.0 e a 11.0 levam o bloco de
mutação.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Onde está registrado |
|---|---|---|---|
| 10, 20, 70 | §6, §7 e §7b | nenhum | — |
| 40 | o `conferir` prova o mesmo conjunto de casos; a ferramenta e a guarda têm teste que quebra sem a regra | nenhum | — |
| 60.1 e D81 | inventário §1 e o padrão do TypeScript | nenhum | — |
| `criar-tasks` ("até três guardiões") | — | **As ondas 2.0 a 10.0 marcam os quatro guardiões**, porque tocam `apps/` ou `packages/` (X7, RF15), e o rename não se corta por comportamento. O revisor revisa o mapa, o relatório do `aplicar`, a saída do `conferir`, as travas e as referências por texto, e não as linhas trocadas pela ferramenta | aqui e em cada `N_task.md` |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: que o `findRenameLocations` (TypeScript 6.0.3) alcança o uso em outro projeto pela condição
  `source`. Se não alcançar, a junção dos locais passa a vir do `getReferencesAtPosition`, projeto a projeto. A 1.0
  prova com o caso de dois projetos
- ⚠️ NÃO VERIFICADO: que o `npm install --package-lock-only` regenera o lock sem mudar versão. A 4.0 confere que o diff
  do lock é só o nome e o caminho

## 13. Riscos técnicos

- **A develop anda.** O merge traz nome antigo. O Orquestrador roda o `aplicar` com os mapas já feitos sobre o que
  entrou, e a guarda acusa o resto. A correção `links-do-runbook` mexe em `tools/guardas/` e entra antes da 3.0
- **Uma troca errada some no diff grande.** O `conferir` pega a string, o compilador pega o símbolo órfão, e o revisor
  olha as referências por texto
