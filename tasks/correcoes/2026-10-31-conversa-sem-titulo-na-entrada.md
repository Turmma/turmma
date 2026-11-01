# Correção — a recarga do e2e espera o título para sempre quando o Postgres da esteira não responde por 4 s e a renovação da sessão devolve 500

**Origem:** esteira run 41231551903 em `84c0c37d` (`gh run view 41231551903 --log-failed`), job `e2e 4/8`: `e2e/professor-conversa.spec.ts:171` (`[chromebook]`), `toBeAttached` do `h1` do `main` estourou os 20 s (`PRAZO_DA_ENTRADA_MS`) em `recarregar` (`e2e/support/professor/scenario.ts:93`). 188 passaram.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador marcou `test-engineer` e `revisor-geral`; a Mesa conferiu a linha contra os arquivos alterados (todo arquivo de `e2e/` pede os outros quatro, `tools/processo/guardioes-por-caminho.ts`), e a linha segue a dela. A correção altera 6 arquivos fora de `tasks/`, o que também chama o `revisor-geral`. -->

## Sintoma

Depois do `page.reload()` do caso "os quatro estados da conversa…", a tela não chegou ao `main` com título. O instantâneo do traço
(`traco-do-e2e-4`, `error-context.md`) mostra só `alert: Não foi possível concluir agora. Tente de novo em instantes.`, o botão
`Tentar de novo` e um `status`: é a tela da sessão `indisponivel` (`apps/web/src/routes.tsx`, `EstadoErro`), fora do `main`.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**Não é a 8.0, nem outra onda: é a esteira.** A 8.0 (`2e27657f`) só renomeou símbolos de `apps/api|worker|despachante|realtime` (a maior parte em teste), um
comentário do `infra/compose.yml` e mapas de `tools/renomear`. Desde a última esteira verde da branch (`0f96e64b`), `apps/web`, `e2e/` (fora do arquivo
desta correção), `packages/` e `apps/api/src/sessao/` (fora de 6 testes) não mudaram.

O traço tem `POST /v1/sessao/renovar` (a leitura da sessão pelo cookie, que toda recarga faz) devolvendo **500 `ERRO_INTERNO` depois de 4 021 ms**; o log da
API tem, no mesmo instante, `http.erro 500` com a pilha em `NodePgSession.transaction` › `RefreshService.renovar`, e 2,5 s antes um
`uso.contador_indisponivel` de outra requisição. 4 s é exatamente o `query_timeout` do cliente do pool (`timeoutConsultaMs` 2 s + `timeoutConexaoMs` 2 s,
`packages/core/src/db/pool.ts`): o Postgres não respondeu no prazo, o servidor nem chegou ao `statement_timeout` de 2 s (que daria 57014, `TEMPO_ESGOTADO`), e
o erro do cliente não é do Postgres (`mapPostgresError` devolve `undefined`) e sai como `ERRO_INTERNO`. A web trata qualquer 5xx da renovação como
sessão `indisponivel`, **de propósito** (`api/sessao.ts`: "ninguém é mandado para o login por causa de uma queda"), e mostra "Tentar de novo". A API e a web
fizeram o que o desenho manda; o stall é do runner, que roda o compose inteiro e o Chromebook com CPU ×4 na mesma máquina (o mesmo tipo de parada da
correção `2026-10-23-agentes-suspensao-intermitente`, onde o disco ocupado fez o Redis de fila passar de 2 s). A esteira anterior da branch (41227149419) também
teve 1 falha em 188, em outro caso (`coordenacao-introducao.spec.ts:102`): a mesma exposição, não o mesmo caso.

O defeito é do teste, e é o de sempre nessa família: `recarregar` espera o título **sem olhar o que a tela mostra**. A tela já diz o que fazer ("Tentar de
novo"), uma repetição resolve (a transação desfez, o cookie não foi rotacionado), e a espera cega gasta os 20 s para um erro que não diz nada ("element(s) not
found"). Três cópias do mesmo `recarregar` têm a exposição: `scenario.ts` (professor, 13 usos) e as locais de `aluno-tutor.spec.ts` e `aluno-atividade.spec.ts`.

## Teste que reproduz

- `e2e/professor-conversa.spec.ts` › o caso "os quatro estados da conversa…" (`:171`, o que falhou na esteira): antes da recarga final, a rota
  `POST /v1/sessao/renovar` responde 500 `ERRO_INTERNO` na primeira vez e deixa passar depois, que é o que a API faz com o Postgres sem responder; o caso exige duas renovações e a
  tela da conversa. Não dá para travar o Postgres num e2e que roda em paralelo com os outros casos, e por isso a recusa é a da API, na rede. **Vermelho antes da
  correção** (com o `recarregar` antigo): `toBeAttached` do título estoura os 20 s em `scenario.ts:93`, nos projetos `chromebook` (44,3 s) e `celular` (46,0 s), o mesmo ponto do
  sintoma. Ficou no caso que já existia, e não num caso novo, porque o `reload` da SPA no perfil lento custa uns 9 s e um caso novo passa dos 15 s que o portão cobra
  (`test.slow()` posto agora não conta); o `:171` já declarava `test.slow()` no HEAD.
- `e2e/recarga-da-sessao.spec.ts` (novo, páginas estáticas, sem login nem recarga): a espera clica em "Tentar de novo" uma vez e chega ao título; recusada de novo, falha com
  "A API recusou a renovação da sessão 2 vezes seguidas depois da recarga" e o aviso que a tela mostrava; e o "Tentar de novo" de dentro do `main` não é clicado (o filtro
  `:not(main *)`; sem ele o caso fica vermelho, conferido apagando-o).

## Correção

Só o e2e; a API e a web ficam como estão (o 500 do cliente sem resposta e o "Tentar de novo" da web são o desenho, e `packages/core` e `apps/web` não entram).

- `e2e/support/casca.ts`: `esperarATelaDepoisDaRecarga(page)` (o botão é `tentarDeNovo`, e o texto do erro lê só o `alert` de fora do `main`) espera o título do `main` **ou** o botão "Tentar de novo" fora do `main` (a tela da sessão
  `indisponivel`; o de dentro do `main` é de uma tela, e não da sessão, e não conta). Com o botão e sem título, clica uma vez, como a pessoa faria, até
  `TENTATIVAS_DA_RECARGA` (2). A segunda recusa lança um erro que diz o que a tela mostrava, em vez de esperar o título até os 20 s. Repetir é seguro: a
  consulta que estourou desfez a transação, o cookie não girou, e a renovação seguinte é a de sempre.
- `e2e/support/professor/scenario.ts` e as cópias locais de `e2e/aluno-tutor.spec.ts` e `e2e/aluno-atividade.spec.ts`: o `recarregar` passa a chamá-la.
  As 17 chamadas ficam como estavam.
- `e2e/professor-conversa.spec.ts`: a recusa do `renovar` antes da recarga final do `:171`. `e2e/recarga-da-sessao.spec.ts`: a lógica da espera (clique e segunda recusa), em página estática.
- Fica de fora, de propósito: o `query_timeout` do pool e o mapa de erro da API. Um cliente sem resposta do Postgres sai como `ERRO_INTERNO`, e não como 503
  `INDISPONIVEL_TENTE_DE_NOVO`; a web trata os dois do mesmo jeito (sessão `indisponivel`), então mudar isso não consertaria este caso e é
  desenho de `packages/core` (`infra-guardian`), não correção do e2e. Registrado aqui para o Orquestrador decidir se vira tarefa.

## Estabilidade

Defeito de ambiente, sem vermelho determinístico: o vermelho é a recusa feita na rede (acima). Com a correção, o `:171` passa nos dois projetos, o spec novo passa, e os dois specs de
aluno que ganharam a função (`aluno-tutor`, `aluno-atividade`) passaram na corrida anterior à mudança do teste (a função não mudou depois).

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 22:19:39 | 2026-10-31 22:19:50 | `tenancy-guardian` | 1 | APROVADO | a9e4dbcdeaad225bc |
| 2026-10-31 22:19:42 | 2026-10-31 22:20:03 | `conformidade-reviewer` | 1 | APROVADO | a975faba408d9dc20 |
| 2026-10-31 22:19:40 | 2026-10-31 22:20:04 | `privacy-guardian` | 1 | APROVADO | ab347ae07028ba8fc |
| 2026-10-31 22:19:43 | 2026-10-31 22:20:05 | `infra-guardian` | 1 | APROVADO | a6a11ad1ef520d355 |
| 2026-10-31 22:19:38 | 2026-10-31 22:20:26 | `revisor-geral` | 1 | APROVADO | a9b4fcff687eb8536 |
| 2026-10-31 22:19:36 | 2026-10-31 22:21:24 | `test-engineer` | 1 | REPROVADO | a412226b9d4989600 |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), revisor-geral (1ª), conformidade-reviewer (1ª), privacy-guardian (1ª) | O cliente do pool sem resposta do Postgres no `query_timeout` sai como 500 `ERRO_INTERNO` e não como 503 `INDISPONIVEL_TENTE_DE_NOVO` (`packages/core/src/db/pool.ts`, `mapPostgresError`); privacy-guardian pede conferir, se virar tarefa, que o log `http.erro` não leve parâmetro de consulta com dado de pessoa | Já registrada na seção "Fica de fora" da Correção. É desenho de `packages/core` (`infra-guardian`), fora do escopo e dos arquivos desta correção. Destino: o Orquestrador decide se vira tarefa; a conferência do log vai junto |
| infra-guardian (1ª) | Anotar no Playwright (`test.info().annotations`) quando a segunda tentativa de `esperarATelaDepoisDaRecarga` foi usada, para a esteira mostrar a frequência | Acrescenta comportamento observável que pede teste e desenho próprios (quem lê a anotação); não é barata. Destino: `TODO.md` |
| revisor-geral (1ª) | O caso `:171` testa duas coisas (conversa suspensa e recarga com renovação recusada) | Sem mudança: "Teste que reproduz" explica que um caso novo no perfil lento passa dos 15 s que o portão cobra, e a mensagem da asserção aponta a parte certa. Recusada, com o motivo |
| 2026-10-31 22:33:28 | 2026-10-31 22:33:56 | `revisor-geral` | 2 | APROVADO | a32032ad7c5cca1cb |
| 2026-10-31 22:33:23 | 2026-10-31 22:34:24 | `test-engineer` | 2 | APROVADO | ac34ac54befd7a212 |
| test-engineer (2ª) | O filtro novo `.and(page.locator(':not(main *)'))` sobre o `alert` de `esperarATelaDepoisDaRecarga` não tem caso que o prove: apagado, os três casos seguem verdes (no caso `:33` o único `alert` já está fora do `main`); efeito só no texto do erro de diagnóstico | Não bloqueia, e a mudança só vale para o texto do erro. Destino: `TODO.md` |
| test-engineer (2ª) | Subir os 300 ms do `setTimeout` do caso novo de `recarga-da-sessao.spec.ts` para uns 1000 ms, para dar folga à detecção da mutação | Afeta só a detecção do vermelho sem o filtro, não o verde; o `test-engineer` verificou que o caso fica vermelho de um de dois jeitos. Destino: `TODO.md` |
| revisor-geral (2ª) | A espera dos 300 ms não é fixa: se a página demorar além dos 20 s, o caso falha pelo título e não pelo clique | Sem ação: o próprio revisor diz que é seguro e que "só fica a nota" |
| revisor-geral (2ª) | `id="denovo"` da página estática de `recarga-da-sessao.spec.ts:16` ainda usa o nome antigo | Recusada: cosmético, é outro símbolo (um id de HTML de teste, não o `tentarDeNovo` de `casca.ts`) e a ordem 1 já o excluía |
