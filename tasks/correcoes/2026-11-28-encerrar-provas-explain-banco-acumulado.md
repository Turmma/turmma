# Correção — o `EXPLAIN` da rotina que encerra a prova vencida conta as linhas descartadas de todas as tabelas e falha no banco acumulado

**Origem:** validacao.md de `avaliacao-e-correcao` (rodada 1, 28/11/2026, seção 4, Críticos): `apps/worker/test/encerrar-provas.int.test.ts:961`, mesma classe de `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`.
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `tenancy-guardian`, `revisor-geral`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os guardiões vieram no PEDIDO do Orquestrador (`infra-guardian`, `tenancy-guardian`, `revisor-geral`); o `test-engineer` é de toda correção; `privacy-guardian` e `conformidade-reviewer` vieram do `portao-local.ts revisores`, que lista quem o caminho pede. -->
**Sem mutação:** só teste (`apps/worker/test/encerrar-provas.int.test.ts`); nenhum arquivo de `apps/*/src` nem de `packages/*/src` muda.

## Sintoma

`npx vitest run --project integracao apps/worker/test/encerrar-provas.int.test.ts -t "a escolha das escolas com prova vencida"`, sobre um banco de teste que tem um ano letivo `encerrado` e um `planejado`, cai em:

```
AssertionError: expected 2 to be less than or equal to 1
 ❯ apps/worker/test/encerrar-provas.int.test.ts:961:46
```

Com o banco só de anos `em_curso` (o deste andar, antes da mudança) o mesmo caso passa, e é por isso que depende do que as outras execuções deixaram.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

O somatório `removidasNoFiltro` (linha 36) soma o `Rows Removed by Filter` de **todos** os nós do plano. A consulta global das escolas com prova vencida junta `ano_letivo` com `situacao = 'em_curso'`, e o `Seq Scan on ano_letivo` descarta os anos que não estão em curso: o `encerrado` que o próprio arquivo deixa no caso de ":836" (encerra o ano da escola A e abre outro) e o `planejado` de outras suítes. Esse descarte não tem relação com o índice da prova aberta, que é o que o caso mede (o `toContain` do índice passa). O código de produção não tem defeito; o teste planejava a conta pelo plano inteiro, e o número dependia dos anos que o banco acumulou. É falha da **6.0** (o teste nasceu lá), vista na validação.

Reproduzido neste andar: o banco de teste só tinha anos `em_curso` (955) e o caso passava; ao plantar um ano `planejado` e um `encerrado` (o que o banco do validador tinha), o mesmo caso caiu em `expected 2 to be less than or equal to 1`, na linha 961.

## Teste que reproduz

`apps/worker/test/encerrar-provas.int.test.ts › a rotina que encerra a prova vencida › os índices da rotina (EXPLAIN, §7c) › a escolha das escolas com prova vencida e a lista de uma escola descem pelo índice da prova aberta, sem varrer as encerradas` — o próprio caso, que fica vermelho com os dois anos fora de curso e a soma antiga, e verde depois.

Agora ele **planta** os dois anos (passo "Correção"), e por isso a falha não depende mais do banco: com o filtro por tabela desfeito de propósito (a soma antiga), num banco que só tem `em_curso` além desses dois anos, o caso cai em `expected 2 to be less than or equal to 1` (`:976`); com o filtro, passa.

Não é intermitência de ambiente: é determinístico, e a evidência é o vermelho acima, não repetição. Conferido também o que o pedido manda: o **arquivo inteiro rodado duas vezes seguidas no mesmo banco**, a 2ª sem `EDUCA_BANCO_NOVO`: 38 de 38 nas duas, e o caso isolado duas vezes sobre o acumulado, verde.

## Correção

Só o teste. Nenhum código de produção, nenhuma migration, nenhum índice.

- `removidasNoFiltro(no, tabela)` passa a somar só os nós cujo `Relation Name` é a tabela que o caso mede (`NoDoPlano` ganha `'Relation Name'`). As quatro chamadas do bloco dizem a tabela: `atividade_aplicada` (a consulta global e a da escola), `extensao_de_tempo` e `indisponibilidade`. O limite de `<= 1` e o `toContain` do índice ficam como estavam: a prova não afrouxa, só deixa de contar o que o caso não mede. Um nó que não fosse da tabela passaria vazio, mas o `toContain` do índice da própria tabela, logo acima, exige que o nó exista.
- O `beforeAll` do bloco planta, na escola A, um ano `planejado` (2099) e um `encerrado` (2098) e roda `analyze ano_letivo`, e o `afterAll` apaga os dois pelos ids que o `insert` devolveu. É o que faz o caso exercitar a conta nos três ambientes (banco novo, acumulado, esteira) em vez de só no que já tinha anos fora de curso.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| (autor) | `apps/despachante/test/janela.int.test.ts:279` e `apps/despachante/test/slots.int.test.ts:554` somam `Rows Removed by Filter` de todos os nós, como o caso corrigido aqui | Não estão no pedido, e passam hoje: o pedido cita só `encerrar-provas`. Mesma classe; se um plano deles ganhar junção com tabela que cresce, repetem. Destino: `TODO.md` (gravado, com a observação do test-engineer da linha abaixo) |
| test-engineer (1ª) | Em plano com Nested Loop, `Rows Removed by Filter` do lado interno é média por iteração; a conta passaria a ser `Rows Removed by Filter * Actual Loops` se a consulta global ganhar junção que ponha `atividade_aplicada` do lado interno | Pré-existente, e o plano medido hoje não tem esse formato. Destino: a entrada do `TODO.md` do despachante, como observação |
| privacy-guardian (1ª) | O `beforeAll` grava 2099 e 2098, e a chave `ano_letivo_escola_ano_unico` faria a execução seguinte falhar se uma morrer antes do `afterAll`; apagar antes de gravar ou `on conflict do nothing` | Recusada: a escola A nasce nova a cada execução (`montarEscolaComAssistente`, `encerrar-provas.int.test.ts:126`), então a chave única não colide com execução anterior. Tenancy, infra e revisor-geral conferiram o mesmo |
| infra-guardian (1ª) | Se o arquivo quebrar entre o `insert` e o `afterAll`, os dois anos ficam no banco, ligados a escola descartável | Sem ação: o próprio infra-guardian diz que "não quebra a execução seguinte" |
| test-engineer (1ª) | Comentário em `:36-41` sobre por que o filtro não volta à soma de todos os nós | Já está no JSDoc de `removidasNoFiltro`; coberto pelo item 1 da ordem (o comentário do `beforeAll` virou uma linha que aponta para ele) |
| revisor-geral (2ª) | O JSDoc de `removidasNoFiltro` ficou com três linhas longas e mistura o que a função faz com o porquê de o `beforeAll` plantar os anos; encurtar a segunda frase para "o `beforeAll` dos índices planta os anos que provam isso no banco novo" | Recusada: só texto, de revisor que aprovou, e na rodada 1 o mesmo revisor pediu que o porquê ficasse num lugar só, o JSDoc, o que foi feito. Mexer de novo no comentário caducaria o revisor-geral outra vez, sem mudar comportamento nem prova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 10:40:16 | 2026-11-28 10:40:38 | `conformidade-reviewer` | 1 | APROVADO | aeaa9387db91467be |
| 2026-11-28 10:40:15 | 2026-11-28 10:40:42 | `privacy-guardian` | 1 | APROVADO | ac89cdd250e9db4ab |
| 2026-11-28 10:40:13 | 2026-11-28 10:40:50 | `tenancy-guardian` | 1 | APROVADO | a6f0b5e86e1a5acdd |
| 2026-11-28 10:40:14 | 2026-11-28 10:40:55 | `revisor-geral` | 1 | APROVADO | a308aa54869494957 |
| 2026-11-28 10:40:12 | 2026-11-28 10:41:11 | `infra-guardian` | 1 | APROVADO | a073f798b14b1bcac |
| 2026-11-28 10:40:12 | 2026-11-28 10:41:23 | `test-engineer` | 1 | APROVADO | ac20c11f1018514b8 |
| 2026-11-28 11:06:41 | 2026-11-28 11:06:53 | `revisor-geral` | 2 | APROVADO | a7a40733c9dbeb70b |
