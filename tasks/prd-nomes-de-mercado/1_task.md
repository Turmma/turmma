# Tarefa 1.0 — O `aplicar` renomeia uma onda pelo mapa, e o `reaplicar` leva o merge ao nome novo

**Funcionalidade:** nomes-de-mercado · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

O `aplicar.ts` renomeia a onda pelo mapa e grava o relatório; o mapa errado é recusado sem tocar a árvore. O
`reaplicar.ts` leva ao nome novo o que o merge da `develop` traz.

## Contexto necessário

- `techspec.md` §5 e §12
- `casos.md`, "`aplicar`" e "`reaplicar`"
- `prd.md` RF7 e §7
- `tools/guardas/escopo-dos-repositories.ts`: a API do `typescript` no repositório
- `tools/processo/linhas.ts`, `lerArquivosPrevistos`: lê o `--escopo`; hoje não lê `apps/` nem `package.json`

## Subtarefas

- [ ] 1.1 — O mapa, o `comum` calculado, as seis recusas e a gravação só depois de calcular tudo
- [ ] 1.2 — Os passos 1 a 5; o mapa com `"linha": true` não toca documento
- [ ] 1.3 — O passo 6 e o `<N>.relatorio.md`
- [ ] 1.4 — O `reaplicar`, sobre todos os mapas; com `mapas/13.json`, os de linha valem também nos documentos
- [ ] 1.5 — O `reaplicar` no merge da `develop` (`8-validacao-e-pouso.md`, enquanto existir `tools/renomear/mapas/`),
  com o termo em `seguir.test.ts`
- [ ] 1.6 — Fixture real: um `esquema…` do `shared` e quem o importa, copiados da árvore, e um mapa do anexo
- [ ] 1.7 — `lerArquivosPrevistos` passa a ler a pasta de primeiro nível e o arquivo da raiz
- [ ] 1.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/renomear/` | novo |
| `.claude/skills/seguir/passos/8-validacao-e-pouso.md`, `tools/processo/harness/seguir.test.ts` | alterado |
| `tools/processo/linhas.ts`, `tools/processo/linhas.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| símbolo do `shared` em dois projetos | unidade | renomeia nos dois (§12); o comentário composto muda, a string fica | |
| dois `tsconfig` | unidade | editado uma vez | |
| `{ esquemaTurma }` | unidade | a chave fica | |
| move de arquivo | unidade | o import relativo, o de pacote e o `vi.mock` mudam | |
| move de pasta | unidade | o passo 3 vale para pasta | |
| rename só de caixa | unidade | passa pelo nome intermediário | |
| pacote no mapa | unidade | `name`, `exports`, dependências e lock mudam | |
| palavra comum em comentário | unidade | fica, e vai para a troca à mão | |
| documento vivo | unidade | composto, crases, `{@link}` e caminho: um caso cada | |
| decisões, ouro, `tasks/`, `mockups/` | unidade | intactos | |
| mapa de linha | unidade | nenhum documento tocado | |
| as seis recusas | unidade | um caso por recusa | |
| colisão com `alias` | unidade | aceita, com o alias no import | |
| recusa | unidade | a árvore sai byte a byte igual | |
| "Listados" de `casos.md` | unidade | um caso por forma, mais `*.Dockerfile` e `.cjs` | |
| "Não listados" de `casos.md` | unidade | um caso por forma | |
| `reaplicar`, `de` já renomeado | unidade | não é erro | |
| `reaplicar`, ocorrência nova | unidade | renomeada | |
| `reaplicar` com dois mapas | unidade | aplica os dois | |
| `reaplicar` com `13.json` | unidade | o mapa de linha passa a valer nos documentos | |
| `reaplicar` duas vezes | unidade | a segunda não muda nada | |
| `aplicar` duas vezes | unidade | a segunda é recusada | |
| quem contorna é acusado | unidade | a ocorrência sem classificação em string, regex, JSON, YAML e `-w`: um caso cada | |
| o alvo não existe | unidade | `arquivo` inexistente recusado; `reaplicar` sem mapa falha alto | |
| o passo do `/seguir` | unidade | `8-validacao-e-pouso.md` cita `reaplicar` | |
| `apps/` e `package.json` nos previstos | unidade | lidos; a prosa, não | |

## Como testar

- Repositório temporário: copie `andares()` de `tools/processo/linhas.test.ts` (`mkdtempSync`, `git init`), com a
  fixture da 1.6 e um `tsconfig` por projeto.
- `ts.createLanguageService` com um `LanguageServiceHost` sobre ele.
- Comando: `npx vitest run --project unidade tools/renomear/`.
- A recusa se prova pelo efeito: `git status --porcelain` vazio.

## Autoconferência

As 12 perguntas do modelo, no plano; na 1, cada recusa e cada regra do passo 6 é cláusula.

## Fora do escopo desta tarefa

O `conferir`, o `restos` e o filtro vazio (2.0).

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por cláusula do §5 e por regra do passo 6, e um para o leitor novo do `--escopo`.

## Recomendações sem aplicar
