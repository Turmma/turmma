---
name: receitas-de-codigo
description: Aponta a receita do guia para escrever um endpoint, uma tabela, um job, uma chamada de IA, uma tela ou o teste de isolamento, com o exemplo real e as travas que pegam o erro
user-invocable: false
---

A receita mora em `docs/guia-do-desenvolvedor.md` (§5 as receitas, §7 as travas). Esta skill só aponta, sem copiar o guia.

Leia a seção do guia **antes de escrever**. Copie o exemplo e troque os nomes.

| Seção | Exemplo | Travas |
|---|---|---|
| 5.1 Um endpoint novo | `apps/api/src/estrutura/` | Boot da API; Lint de entrada; Lint `guardas/erro-tipado`; `dependency-cruiser`; Teste dos repositories |
| 5.2 Uma tabela nova | `packages/core/src/db/schema/disciplina.ts` | `architecture.test.ts`; Lint de tabela; Teste dos repositories |
| 5.3 Um job novo | `apps/worker/src/processors/` | Lint `guardas/log-sem-dado-pessoal` e `log-sem-conteudo-montado`; Lint `guardas/erro-tipado`; `dependency-cruiser` |
| 5.4 Chamar a IA | `apps/api/src/artefato/ferramentas.service.ts` | Lint `guardas/sdk-de-ia-so-no-adaptador`; Lint `guardas/log-sem-dado-pessoal` e `log-sem-conteudo-montado`; `dependency-cruiser` |
| 5.5 Uma tela nova | `apps/web/src/api/estrutura.ts` | Lint do kit; Teste de tokens; `size-limit`; Teste do tamanho de pasta |
| 5.6 O teste de isolamento | `apps/api/test/estrutura-isolamento.int.test.ts` | Lint `guardas/teste-sem-desligar`; Teste dos repositories; `architecture.test.ts` |

O que se afasta da receita vai à seção 11 da Tech Spec com o motivo (D81).

Quem muda o exemplo no guia muda a linha desta tabela no mesmo commit: a esteira confere o exemplo contra a linha `Exemplo:` da seção.
