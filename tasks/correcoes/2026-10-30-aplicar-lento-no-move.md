# Correção — o move de arquivo do `aplicar` custa ~220–280 s por projeto e por arquivo, e o mapa da 3.0 projeta 12–15 h

**Origem:** tarefa 3.0 (X8 `nomes-de-mercado`), medição em `divergencia-3.0.md` (PEDIDO do Orquestrador).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: nenhum além de test-engineer e revisor-geral. -->

## Sintoma

`node tools/renomear/aplicar.ts` com o mapa 3 (458 símbolos, 15 arquivos, 2 pastas) não termina: os símbolos levam ~7 min, e o
primeiro `moverEntrada` fica em `getEditsForFileRename` por 220–280 s em cada um dos 10 projetos (`apps/api` 279,9 s,
`apps/despachante` 217,2 s). A corrida inteira passou de 124 min a 100% de CPU sem terminar; a projeção é 12–15 h.

## Fora desta correção

`?? tools/renomear/mapas/` (o `3.json` da tarefa 3.0, ainda não commitado). Fica na árvore, fora da revisão e do commit.

## Causa

Falha da tarefa 1.0 (`projetos.ts`, passo 1 do `aplicar`), vista só quando o mapa 3 trouxe 17 arquivos e pastas para mover.

Não é o TypeScript nem o desenho do passo 3. Perfil de CPU (`--cpu-prof`) de um único `getEditsForFileRename` em
`apps/despachante` (2699 arquivos no programa, 214 s): `paraRelativo` (`projetos.ts:25`) e o `path.relative`/`path.resolve` que ele
chama somam 182 s (85%); quem o chama é `getScriptVersion` (`projetos.ts:69`), pedido por `isProgramUptoDate` do TypeScript.
O `getEditsForFileRename` chama `getProgram()` muitas vezes por dentro (via `getSourceFile`), e cada `getProgram()` confere a
versão dos ~2700 arquivos do programa, e cada conferência recalculava o caminho relativo do mesmo arquivo. O custo era
(chamadas de `getProgram`) × (arquivos) × (`path.relative`), por projeto, e se repete nos 10 projetos e nos 19 movimentos.

Fora o `paraRelativo`, o resto do passo 3 é barato: o mesmo `getEditsForFileRename` cai para 6,8 s depois da correção.

Sobre pular o projeto que não alcança o arquivo: não é preciso, e não foi feito. Com o custo no lugar, o move inteiro nos 10
projetos leva 92 s, e pular um projeto poderia deixar de fora o `exclude`/`files` de um `tsconfig` que cita o caminho sem
alcançar o arquivo, que é o que o `updateTsconfigFiles` do serviço edita. O desenho do passo 3 (um serviço por projeto, cada
edição uma vez) fica como está.

## Teste que reproduz

`tools/renomear/projetos.test.ts` › `o custo do serviço de linguagem (passo 3)`, dois casos:

- `o programa que não mudou não recalcula o caminho de nenhum arquivo, por mais vezes que o serviço o peça`: 30 `getProgram()`
  por projeto, sem mudança, e nenhum `path.relative` novo;
- `o move de um arquivo calcula o caminho de cada arquivo uma vez só`: `moverEntrada` com 40 importadores, e nenhum
  `path.relative` repetido para o mesmo arquivo (o contador é um `vi.mock` de `node:path`).

Vermelho antes (com `projetos.ts` do HEAD): os dois falham, com o `path.relative` repetido para os mesmos arquivos da biblioteca
do TypeScript e do repositório. Verde depois. Mais dois casos de `paraRelativo` (dentro da raiz, fora dela, não absoluto, e a
memória vale por árvore).

## Correção

`projetos.ts`: `paraRelativo` lembra a resposta por árvore (`WeakMap<Arvore, Map<string, string | undefined>>`). A resposta só
depende da raiz e do texto do caminho, por isso lembrar não muda nenhum resultado; o cálculo antigo foi para `calcularRelativo`,
intacto. Medido, no mesmo projeto: 214 s → 6,8 s. O move de um arquivo nos 10 projetos: 92 s; 19 movimentos ≈ 30 min, mais ~7 min
dos símbolos, contra 12–15 h projetadas.

**O portão e o `3.json`.** `tools/renomear/restos.test.ts` › `a árvore não tem resto dos mapas aplicados` lê `tools/renomear/mapas/`
e fica vermelho com o `3.json` da 3.0 na árvore, porque a onda ainda não foi aplicada (32/32 verde sem ele, a mesma falha com
ele, hash `fcd52324`). Não é desta correção. O portão desta correção rodou com o `3.json` guardado fora da árvore e devolvido ao
fim, com o mesmo hash; o arquivo não entra na revisão nem no commit. O portão da 3.0 só passa depois que o `aplicar` correr com
o mapa.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | `projetos.test.ts:68`: a asserção "nenhum `path.relative` repetido" vale para a ferramenta toda; filtrar pelos pedidos que saem da raiz da árvore | Recusada. O caso prova o que a correção declara (o move não repete o cálculo do mesmo arquivo) e a mutação `if (false) return …` o deixa vermelho hoje. Filtrar muda a asserção que as mutações do documento provaram; o risco que o revisor aponta é um vermelho falso futuro, que aparece na hora, no `movimentos.ts` |
| test-engineer (1ª) | o `Map` de cada árvore cresce sem limite | Recusada. O próprio revisor registra que não é problema: a ferramenta roda uma vez por onda, com cerca de 2.700 arquivos, e o `WeakMap` solta a memória com a árvore |

## Mutações

```mutacao
arquivo: tools/renomear/projetos.ts
teste: tools/renomear/projetos.test.ts › o move de um arquivo calcula o caminho de cada arquivo uma vez só
-  if (lembrados.has(absoluto)) return lembrados.get(absoluto)
+  if (false) return lembrados.get(absoluto)
```

```mutacao
arquivo: tools/renomear/projetos.ts
teste: tools/renomear/projetos.test.ts › o programa que não mudou não recalcula o caminho de nenhum arquivo, por mais vezes que o serviço o peça
-  if (lembrados === undefined) {
+  if (true) {
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 10:08:42 | 2026-10-30 10:09:16 | `revisor-geral` | 1 | APROVADO | a04d23160a893a670 |
| 2026-10-30 10:08:41 | 2026-10-30 10:09:21 | `test-engineer` | 1 | APROVADO | abd0ea089119b4bc7 |
| 2026-10-30 10:14:31 | 2026-10-30 10:14:50 | `revisor-geral` | 2 | APROVADO | af461a97f9df84839 |
| 2026-10-30 10:14:26 | 2026-10-30 10:14:55 | `test-engineer` | 2 | APROVADO | adaf2eadabd53fb38 |
