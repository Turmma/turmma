# Correção — `tools/renomear/restos.test.ts` falha por um genérico `Linha` que a 9.0 deixou num teste de integração

**Origem:** teste vermelho na árvore, depois da 9.0 (`1686c3e4`).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. -->

## Sintoma

`tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados` falha:
`apps/worker/test/transferencia-pela-planilha.int.test.ts:93 Linha`.

## Fora desta correção

`.github/workflows/ci.yml`, `TODO.md`, `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx`,
`apps/web/src/areas/coordenacao/estrutura/api/lista.ts`, `apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`,
`apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts` e `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`
(a correção `e2e-contrato-da-lista-8`, que segue na árvore, sem commit). Não entram na revisão nem no commit desta.

## Causa

`Linha` é símbolo do mapa de nomes (renomeado para `ListItem`/`ListRow` nas ondas 9 e 10). A 9.0 escreveu, em
`transferencia-pela-planilha.int.test.ts:93`, o parâmetro de tipo `<Linha extends object>` do ajudante `consulta`. Um genérico local
não é o símbolo do mapa, mas o `restos` o lê como resto do que o mapa já trocou.

## Teste que reproduz

`tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados`: vermelho antes (a lista de restos traz
`apps/worker/test/transferencia-pela-planilha.int.test.ts:93 Linha`), verde depois.

## Correção

Só o nome do parâmetro de tipo, na linha 93: `Linha` → `Registro` (três ocorrências, na mesma linha). Nenhum comportamento muda.

**Sem mutação:** renomeação de um parâmetro de tipo num teste, sem cláusula nova a provar (o código de produto que o portão vê na árvore é da correção `e2e-contrato-da-lista-8`, listada em "Fora desta correção", e tem os blocos no documento dela).

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 03:21:40 | 2026-11-04 03:22:22 | `revisor-geral` | 1 | APROVADO | accafd625efa2ffae |
| 2026-11-04 03:21:38 | 2026-11-04 03:22:32 | `test-engineer` | 1 | APROVADO | a054d4e16a173838a |
| 2026-11-04 03:23:43 | 2026-11-04 03:23:50 | `tenancy-guardian` | 1 | APROVADO | a294ed84ebee1333e |
| 2026-11-04 03:23:49 | 2026-11-04 03:23:57 | `infra-guardian` | 1 | APROVADO | adc1dc861dc2e394d |
| 2026-11-04 03:23:45 | 2026-11-04 03:23:58 | `privacy-guardian` | 1 | APROVADO | a1220aaec817bd2b4 |
| 2026-11-04 03:23:47 | 2026-11-04 03:24:01 | `conformidade-reviewer` | 1 | APROVADO | a2bf27a14eab5c39e |
