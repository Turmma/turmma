# Correção — o teste dos restos cai por três nomes antigos da 16.0 em `carga-importacao.ts` e no seu teste

**Origem:** portão local da correção `escopo-de-escola-da-grade` (`.processo/portao-escopo-grade.log`, suíte `unidade`); pedido do Orquestrador em 06/11/2026.
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `privacy-guardian`, `infra-guardian`
<!-- `revisor-geral` e `test-engineer` vieram no PEDIDO do Orquestrador. `privacy-guardian` e `infra-guardian` entram por caminho: os 3 arquivos da correção
     estão em `infra/`, que `tools/processo/guardioes-por-caminho.ts` liga aos dois; a Mesa conferiu a linha contra os arquivos. A correção leva 3 arquivos fora de
     tasks/, abaixo do limite de 5, e não toca `.github/`, `tools/ci/` nem `tools/processo/`. -->

## Sintoma

`tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados` vermelho, 1 de 8287:

```
infra/scripts/carga-importacao.ts:11 chamarApi
infra/scripts/carga-importacao.ts:351 SessaoSintetica
infra/scripts/carga-importacao.ts:376 chamarApi
infra/scripts/carga-importacao.ts:452 SessaoSintetica
infra/scripts/carga-importacao.ts:454 chamarApi
infra/scripts/carga-importacao.ts:455 chamarApi
infra/scripts/carga-importacao.ts:463 chamarApi
infra/test/carga-importacao.test.ts:317 semComentarios
infra/test/carga-importacao.test.ts:318 semComentarios
```

## Fora desta correção

Os arquivos da correção `escopo-de-escola-da-grade`, que ficam na árvore e não entram na revisão nem no commit:

```
apps/api/test/grade.int.test.ts
tasks/correcoes/2026-11-06-escopo-de-escola-da-grade.md
```

## Causa

A 16.0 criou `infra/scripts/carga-importacao.ts` e `infra/test/carga-importacao.test.ts` depois que os mapas da X8 foram aplicados, e
reaproveitou três nomes que os mapas trocam: `chamarApi` (mapa 10, `apiRequest` na web), `SessaoSintetica` (mapa 7, `SyntheticSession` na api) e
`semComentarios` (mapa 10, `stripComments`). Os mapas liberam um nome só por par (arquivo, nome) classificado `fica`; o `chamarApi` de
`infra/scripts/carga-sala.ts` está classificado, mas o arquivo novo não está em mapa nenhum, e por isso o import dele (`import { chamarApi } ...
from './carga-sala.ts'`) e os usos contam como resto. O nome é do export de `carga-sala.ts`, então renomeá-lo ali é o único jeito de o import
novo não o citar.

## Teste que reproduz

O próprio `tools/renomear/restos.test.ts › restos na árvore › a árvore não tem resto dos mapas aplicados`: vermelho antes (os 9 restos acima, em
06/11/2026), verde depois (rodado isolado: 1 passou, 42 ignorados). Nenhum teste novo: a regra é a que ele já afirma.

## Correção

Só renomeia, sem mudar comportamento, com nomes que nenhum mapa tem como `de`:

- `infra/scripts/carga-sala.ts`: o export `chamarApi` passa a `callApi` (a declaração e os três usos internos). Quem o importa é só `carga-importacao.ts`;
  nenhum teste nem documento vivo cita o nome.
- `infra/scripts/carga-importacao.ts`: o import e os quatro usos de `chamarApi` passam a `callApi`; a `interface SessaoSintetica` (local, não exportada) passa a
  `LoadSession`, com os dois usos.
- `infra/test/carga-importacao.test.ts`: o ajudante local `semComentarios` passa a `stripComments`, com os dois usos.

A classificação `fica` de `carga-sala.ts › chamarApi` no mapa 10 deixa de ter o que liberar; o mapa é registro de uma onda aplicada e não se edita aqui.
`carga-importacao.test.ts` e `carga-sala.test.ts` seguem verdes (55 de 55) e `tsc -p infra/tsconfig.json` passa.

## Mutações

--faltando: 0 linhas (3 blocos, 0 motivos)

Cada bloco devolve um dos nomes antigos num **uso** (o `restos` não olha a declaração, só os usos: devolver só a declaração deixa o teste verde), e o teste dos restos tem de ficar vermelho nele. O `callApi` de `carga-sala.ts` não tem bloco próprio: o `chamarApi` que o mapa 10 classifica `fica` ali é liberado naquele arquivo, e quem o prova é o import em `carga-importacao.ts`.

```mutacao
arquivo: infra/scripts/carga-importacao.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
falha: toEqual([])
-import { callApi, importarDaApi, type ModulosDaApi } from './carga-sala.ts'
+import { chamarApi, importarDaApi, type ModulosDaApi } from './carga-sala.ts'
```

```mutacao
arquivo: infra/scripts/carga-importacao.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
falha: toEqual([])
-  readonly coordenacoes: readonly LoadSession[]
+  readonly coordenacoes: readonly SessaoSintetica[]
```

```mutacao
arquivo: infra/test/carga-importacao.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
falha: toEqual([])
-    expect(stripComments(script)).not.toMatch(/openai|anthropic|gemini|maritaca|googleapis|api\.groq|oidc|\/v1\/tutor|\/v1\/assistente|\/v1\/ia\//i)
+    expect(semComentarios(script)).not.toMatch(/openai|anthropic|gemini|maritaca|googleapis|api\.groq|oidc|\/v1\/tutor|\/v1\/assistente|\/v1\/ia\//i)
```

## Recomendações sem aplicar

Os quatro revisores aprovaram na 1ª rodada, sem ordem de correção (`.processo/ordens/2026-11-06-restos-da-carga-da-16-r1.md`). Sem aplicar:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `TODO.md:154` cita `chamarApi`; é o da web (13.0), não o de `carga-sala.ts` | Recusada: o `TODO.md` está certo, é só um aviso para não confundir os dois numa troca futura |
| revisor-geral (1ª) | Os blocos de mutação citam o teste sem o `describe` "restos na árvore" | Recusada: o portão rodou as 3 mutações e todas ficaram vermelhas; o `test-engineer` confirmou |
| test-engineer (1ª) | O `restos.test.ts` poderia acusar entrada `fica` que não casa com nada na árvore (a de `carga-sala.ts › chamarApi`, mapa 10, `10.json:2437`, fica sem o que liberar) | Retro da X8: muda `tools/renomear`, fora dos arquivos desta correção |
| infra-guardian (1ª) | `apps/web/src/api/client.test.ts:81` ainda tem `describe('chamarApi', …)`, que o `restos` não aponta | Retro da X8: conferir se o mapa 10 devia pegar o texto de `describe`; fora desta correção |
| privacy-guardian (1ª) | Nenhuma; `semComentarios` em `tools/processo/caducidade.ts` e `tools/ci/duracao-do-e2e.test.ts` é outro símbolo | Recusada: não é defeito, e quem acusaria é o `restos.test.ts` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 06:00:14 | 2026-11-06 06:00:32 | `revisor-geral` | 1 | APROVADO | aabfb1cace0bf9993 |
| 2026-11-06 06:00:17 | 2026-11-06 06:00:32 | `privacy-guardian` | 1 | APROVADO | aafa1de525d985706 |
| 2026-11-06 06:00:18 | 2026-11-06 06:00:41 | `infra-guardian` | 1 | APROVADO | a617ff0e97ad047d3 |
| 2026-11-06 06:00:15 | 2026-11-06 06:01:37 | `test-engineer` | 1 | APROVADO | a9bc798b28abde91d |
