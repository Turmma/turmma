# Inventário — adenda 3 (X8)

Anexo do `inventario.md`. **Status:** proposta, aguarda a aprovação do Joaquim (RF2). Nada daqui é renomeado antes dela.

**De onde vem.** A revisão da 10.0, rodada 1 (`frontend-reviewer`; ordem r1, item 4), achou quatro nomes da web que seguem
regras que o §1 e o §2 do inventário já aprovaram, mas que nenhum anexo lista. A guarda do RF8 não os recusa (`chamar` e
`CHAVE_` não estão na gramática dela), e por isso a adenda 2, que saiu dessa gramática, também não os pegou:

- `chamarComSessaoDeOperador` é o par do operador do `chamarComSessao` da escola, que vira `authedRequest` (decisão 24),
  e o tipo das opções dele já muda pela adenda 2 (`OpcoesComSessaoDeOperador` → `OperadorSessaoOptions`). O nome novo
  é o misto, com o domínio na frente, como `OperadorTokenIssuer`;
- as três `CHAVE_` são chaves do TanStack Query (`['acesso-da-turma']`, `['pedidos-da-turma']` e a contagem), e o §1 manda
  `CHAVE_<X>` → `<X>_QUERY_KEY`. O §15 do anexo da web listou só as exportadas; estas são do módulo.

O valor das chaves não muda (`conferir`). Nenhum nome novo colide no arquivo de cada uma.

| Nome atual | Nome novo | Tipo | Caminho |
|---|---|---|---|
| `chamarComSessaoDeOperador` | `operadorAuthedRequest` | função | `apps/web/src/operacao/api/sessao.ts` |
| `CHAVE_DO_ACESSO` | `ACESSO_QUERY_KEY` | query key | `apps/web/src/areas/professor/turmas/api/acesso.ts` |
| `CHAVE_DOS_PEDIDOS` | `PEDIDOS_QUERY_KEY` | query key | `apps/web/src/api/pedidos.ts` |
| `CHAVE_DA_CONTAGEM_DE_PEDIDOS` | `CONTAGEM_DE_PEDIDOS_QUERY_KEY` | query key | `apps/web/src/api/pedidos.ts` |

**Onde entra.** No mapa da 10.0 (`tools/renomear/mapas/10.json`), com `linhaDoAnexo` apontando para esta tabela. Os
arquivos já estão nos previstos da 10.0 (`apps/web/src/`); o comentário de `operacao/textos.ts` que cita a função o passo
5 troca sozinho.

**Se for recusada,** os quatro ficam, com uma linha em "Não muda, mas parece" de `inventario-web-e2e.md`, e a web
termina a X8 com `OperadorSessaoOptions` ao lado de `chamarComSessaoDeOperador`, e três `CHAVE_` entre as
`_QUERY_KEY`.
