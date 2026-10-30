# Tarefa 12.0 — A guarda `guardas/nome-de-mercado` recusa nome técnico em português em código novo

**Funcionalidade:** nomes-de-mercado · **Depende de:** 8.0 e 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Uma declaração nova como `class AdaptadorX` é recusada pelo lint, e a mensagem dá o nome de mercado (`XAdapter`).
O nome de domínio passa (`TurmaController`, `EliminacaoDoTitular`), e a árvore inteira, depois das ondas, passa sem
nenhum erro.

## Contexto necessário

- `guarda.md`, inteiro: onde a regra vive, a gramática, o limite declarado, a exceção nominal e os casos
- `techspec.md` §5, "A guarda (12.0)", e §10
- `prd.md` RF8
- `tools/guardas/index.mjs`: `REGRAS_DAS_GUARDAS` e `configuracaoDasGuardas`
- `tools/guardas/regras-erro.mjs`: uma regra própria com mensagem, para seguir o formato

## Subtarefas

- [ ] 12.1 — A lista `tools/guardas/nomes-de-mercado.mjs`: a forma, os tipos de declaração e o nome de mercado de cada
  linha da gramática, mais a exceção nominal com o motivo
- [ ] 12.2 — A regra `tools/guardas/regras-nome.mjs`, só na declaração de topo, com a letra maiúscula depois do
  prefixo, e o segmento de arquivo e de pasta
- [ ] 12.3 — A ligação em `index.mjs`: em `REGRAS_DAS_GUARDAS`, só em `apps/**`, `packages/**` e `e2e/**`, e rodada sem
  comentários
- [ ] 12.4 — O mínimo de `configuracaoDasGuardas` em `tools/guardas/filtros-casam.test.ts`, atualizado com a regra nova
- [ ] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/guardas/regras-nome.mjs`, `tools/guardas/nomes-de-mercado.mjs` | novo |
| `tools/guardas/index.mjs`, `tools/guardas/guardas.test.ts`, `tools/guardas/filtros-casam.test.ts` | alterado |
| `tools/guardas/__fixtures__/` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada "Recusado" de `guarda.md` | guarda | um caso por forma, no tipo de declaração em que a linha vale | |
| cada "Passam" de `guarda.md` | guarda | um caso por forma, com `Erros`, `Linhas` e a lista "O que passa" | |
| a mensagem | guarda | a de `class AdaptadorX` contém `XAdapter` | |
| `tools/` | guarda | fica fora | |
| a árvore depois da 11.0 | guarda | nenhum erro (RF8) | |
| filtro vazio | trava | o mínimo de `configuracaoDasGuardas` com a regra nova | |
| quem contorna é acusado: `eslint-disable-next-line` | guarda | não desliga a regra | |
| quem contorna é acusado: `export default class AdaptadorX` | guarda | recusado | |
| quem contorna é acusado: `abstract class AdaptadorX` | guarda | recusado | |
| a guarda reprova quando o alvo não existe | guarda | a exceção nominal com caminho inexistente fica vermelha | |

## Como testar

- O formato: `tools/guardas/guardas.test.ts › guarda de erro tipado`. A fixture em `tools/guardas/__fixtures__/` traz
  `reprova: guardas/nome-de-mercado` na linha. O caso roda `lintar(eslintDasGuardas, fixture, caminhoSimulado)` e
  compara com `marcasDeViolacao(fixture)`.
- O caminho simulado decide o escopo: `apps/web/src/x.ts` para `consulta`, `packages/core/src/ia/tasks/x.ts` para
  `EntradaDo…`, e `tools/x.ts` para o caso de fora.
- O comentário não desliga: copie `guardas.test.ts › guarda desligada por comentário`.
- A árvore inteira: `guardas.test.ts › o repositório de hoje não tem violação…`, na guarda de erro.
- Comando: `npx vitest run --project unidade tools/guardas/guardas.test.ts tools/guardas/filtros-casam.test.ts`.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6, há uma fixture por forma de escrever a mesma declaração. Na 3, o caso que
passa tem o mesmo nome que é recusado em outro tipo de declaração.

## Fora do escopo desta tarefa

Renomear qualquer peça. Se a árvore não passar, o nome que sobrou é divergência da onda dele, e não exceção nova.

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por linha da gramática, e um para cada uma destas cláusulas:
- a letra maiúscula depois do prefixo;
- só a declaração de topo;
- o escopo de `apps/web` e o de `ia/tarefas`;
- as pastas só em `packages/`;
- a exceção nominal;
- a mensagem;
- o `allowInlineConfig`;
- a exclusão de `tools/`.

## Recomendações sem aplicar
