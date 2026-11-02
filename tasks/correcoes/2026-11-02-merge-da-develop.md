# Correção — a `develop` (5eb334c2) traz nome antigo para a spec: merge, reaplicar, conferir e restos

**Origem:** `tasks/prd-nomes-de-mercado/validacao.md` (rodada 3, seção 6, "Merge da `develop` antes do pouso"); Tech Spec, §5, parágrafo "O `reaplicar`".
**Subagentes obrigatórios:** `test-engineer`, `frontend-reviewer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O `frontend-reviewer` veio no PEDIDO do Orquestrador; os outros cinco guardiões são os que o portão local calculou pelos caminhos da árvore do merge (a Mesa confere). O `test-engineer` é de toda correção. -->

## Sintoma

A `origin/develop` tem 12 commits que a spec não trouxe (`d5303ef1..5eb334c2`, a onça da marca e o cenário dela na tela de entrar), com 17
arquivos de `apps/web/src/componentes/` (a spec já os moveu para `components/`) e `e2e/casca-publica.spec.ts`, escritos com os nomes
antigos. O `restos` e a guarda da validação não viam esse código: no pouso, a `develop` receberia a spec com nome antigo de volta.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

O merge da `develop` antes do pouso (`passos/8-validacao-e-pouso.md`) traz código escrito antes do rename. O git acompanhou a pasta que mudou de
nome (`componentes/` → `components/`) e pôs os 7 arquivos novos (a onça e as duas `CascaPublica.sem-*.test.tsx`) no lugar novo, mas o conteúdo veio com o nome antigo, e 8 arquivos deram
conflito de conteúdo onde a spec e a `develop` tocaram o mesmo trecho.

## Teste que reproduz

Não há teste de unidade novo: a correção aplica ferramenta que já tem os seus (`tools/renomear/reaplicar.test.ts`, `restos.test.ts`). A prova é o
`restos` da Tech Spec, vermelho antes e verde depois:

- **Antes** (merge resolvido, `reaplicar` rodado uma vez, depois das primeiras trocas à mão): `restos: 20 nomes antigos sobraram (11 mapas)`.
  17 linhas em `apps/web/chunk-names.test.ts` (o caminho `/repo/apps/web/src/componentes/…` e `Botao.tsx` nos casos novos da onça),
  2 em `avatar-so-nas-duas-pecas.test.ts` (`semComentarios`) e 1 em `ui/onca/Onca.tsx` (`import { SeloIA } from '../ia/AssinaturaIA'`).
- **Depois:** `restos: limpo. 11 mapas, nenhum nome antigo sobrou.` e `reaplicar` de novo sem nada novo além de uma linha de título de `it`
  (que o `restos` libera).

## Correção

1. `git merge origin/develop` sem commitar. Conflitos de conteúdo resolvidos em 8 arquivos: `CLAUDE.md`, `docs/interface.md`,
   `apps/web/chunk-names.ts`, `apps/web/src/components/CascaPublica.tsx`, `…/ui/ai/avatar-so-nas-duas-pecas.test.ts`, `…/ui/onca/Onca.tsx`,
   `apps/web/src/estilos.test.ts` e `e2e/casca-publica.spec.ts`. Em cada trecho, vale o texto da `develop` (a mudança dela) com o nome da spec.
   O `chunk-names.ts` fica com a lista da spec mais as três peças novas da onça que a `develop` acrescentou (`ui/onca/CenaDaOnca`,
   `ui/onca/DesenhoDaOnca` e `ui/onca/OncaDaMarca`).
2. `node tools/renomear/reaplicar.ts`: trocou `Marca` por `Logo` na `CascaPublica.tsx` e os apoios de teste
   (`semIdsDoDesenho` → `stripSvgIds`, `codigoSemComentarioNemTexto` → `codeWithoutCommentsOrText`) em `OncaDaMarca.test.tsx`.
3. **Troca à mão** (o `reaplicar` só alcança o arquivo que importa o nome antigo; estes já importavam o novo ou o trecho veio da `develop`):
   - `avatar-so-nas-duas-pecas.test.ts`: `importadoresDe` → `importersOf`, `semComentarios` → `stripComments`, `componentes/` → `components/`,
     `ui/ia/AvatarAgente` → `ui/ai/AgentAvatar`, `ui/ia/AssinaturaIA` → `ui/ai/AgentSignature`, `galeria/` → `gallery/` e
     `galeria/secoes/` → `gallery/sections/` nas constantes de caminho, e o exemplo de código `{ Marca } from './ui/Marca'` → `{ Logo } from './ui/Logo'`
     (as duas amostras do caso novo sobre o `import()` tardio);
   - `estilos.test.ts`: `componentes/CodigoQr.tsx` → `components/QrCode.tsx` e o `components/ui/onca/CenaDaOnca.tsx` que a `develop` acrescentou;
   - `e2e/casca-publica.spec.ts`: `larguraExcedente` → `horizontalOverflow` e `violacoesGraves` → `seriousViolations` (três usos que a `develop` escreveu);
   - `apps/web/chunk-names.test.ts`: `componentes` → `components` nos caminhos e `Botao.tsx` → `Button.tsx` nos casos novos (o título de `it`
     `componentes/ui/ia/…` fica, como no HEAD);
   - `ui/onca/Onca.tsx`: `import { SeloIA } from '../ia/AssinaturaIA'` → `import { AIBadge } from '../ai/AgentSignature'`, igual ao que a 9.0 fez.
4. O texto dos `it`/`describe` que a `develop` escreveu não muda (RF7). Nos dois arquivos, o título que o HEAD da spec já tinha com o caminho antigo
   (`componentes/ui/onca/…` no `avatar-so-nas-duas-pecas.test.ts`, `componentes/ui/ia/…` no `chunk-names.test.ts`) fica como está.
5. **Comentários** (rodada 1 da Mesa): o caminho `ia/avatar-so-nas-duas-pecas.test.ts` que os comentários de `Onca.tsx`, `OncaDaMarca.tsx`,
   `CenaDaOnca.tsx` e `CascaPublica.test.tsx` citam passa a `ai/…`, trocando só o caminho. `TODO.md`: a linha da `onca-na-entrada` que citava
   `nome-dos-chunks.ts` passa a `chunk-names.ts`.

**O que fica com o nome em português, e por quê.** `CenaDaOnca`, `DesenhoDaOnca`, `OncaDaMarca` (os arquivos, os componentes e os
tipos que eles exportam: `Pose`, `PoseDaIntroducao`, `TamanhoDaOnca`, `TamanhoDaOncaDaMarca`, `DonoDoAceno`, `PropsDaOncaDaMarca`,
`PropsDoDesenho`, `ConfigDaPose`, `DesenhoDoRabo`/`DesenhoDaPata`/`DesenhoDoBalao`…) moram em `components/ui/onca/`, e a onça fica fora do rename inteira:
PRD §3 ("A onça também fica, porque é a marca"), RF5 ("menos a onça") e o `inventario-web-e2e.md:541` ("a mascote: `componentes/ui/onca/` inteira").
Não é nome novo fora da isenção, por isso não mandei `DIVERGÊNCIA`. Na `CascaPublica` (a casca fica), `PropsDaOnca`, `SemOnca` e `SEM_ONCA` são locais
do arquivo, do tipo `PropsDo…` de peça fora do kit (`inventario-web-e2e.md:554`); os ajudantes locais dos testes (`oncaDoPainel`,
`importacoesEstaticasDaPasta`…) são como o `arquivosDaWeb` que já estava lá. Se o Joaquim ler a isenção de outro jeito, é adenda e rename à parte.

**O `conferir`.** Roda contra o `HEAD` da spec, e o merge ainda não é commit: ele lista os 1101 itens que a `develop` acrescentou (casos,
strings, nomes exportados), sem relação com o rename. Não é prova de nada aqui. A prova do rename é o `restos` limpo, o `tsc` (web e e2e), o eslint com a guarda
`nome-de-mercado` e os 12 arquivos de teste da web tocados (172 casos) verdes, isolados. O `e2e/casca-publica.spec.ts` só foi conferido por `tsc` e eslint antes do
portão; a prova dele é o portão (o alvo `e2e/casca-publica.spec.ts`, 30 casos verdes) e a esteira do push, e o diff dele contra a `develop` é só de nome.

## Mutações

**Sem mutação:** esta correção não acrescenta cláusula. O código de produto novo no diff (`CascaPublica.tsx`, `CenaDaOnca.tsx`, `DesenhoDaOnca.tsx`,
`OncaDaMarca.tsx`, `movimento-da-onca.ts`) é o da `develop`, cuja prova são os blocos `mutacao` de
`tasks/correcoes/2026-10-30-onca-na-entrada.md`, `…-cenario-da-onca.md` e `…-tela-de-entrar.md` (que vêm no merge); o que esta correção faz é troca de nome.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | os comentários de `ui/Comemoracao.tsx:19` e `ui/ai/AgentAvatar.tsx:52` com `ia/avatar-so-nas-duas-pecas.test.ts` (já estavam assim no HEAD da spec) | `TODO.md`: arquivos que esta correção não toca e que o merge não trouxe. O Implementador acrescenta a linha |
| conformidade-reviewer (1ª) | anotar na retro que o título de `it` e o código passaram a usar nomes diferentes para a mesma peça (`AvatarAgente`/`AssinaturaIA`) | retro da spec; o RF7 manda manter o título |
| revisor-geral (1ª) | registrar na Tech Spec §5 (parágrafo "O `reaplicar`") que o `conferir` não fica verde com o merge ainda sem commit, e qual prova vale | retro da spec e decisão do Arquiteto: a Tech Spec não é arquivo desta correção |
| frontend-reviewer (1ª) | quebra de "e-" / "mail" a 1366 px na mensagem do segundo fator (`e‑mail` ou `text-wrap: pretty`) | `TODO.md`, na tela de entrar: é CSS da tela que veio da `develop`, e o RF7 diz que o diff desta correção é só de nome. O Implementador acrescenta a linha |
| frontend-reviewer (1ª) | título "Segundo fator" mais claro ("Confirmação de entrada") | recusada: texto de tela que vem da `develop`, e o RF7 fecha o diff em nome ("Nenhuma string de fora muda"); o próprio revisor diz que não é achado |
| frontend-reviewer (1ª) | conferir no pouso que o `restos` está limpo e os 12 arquivos de teste da web passam | recusada: já provado nesta rodada, `restos: limpo` e 141 + 31 casos verdes pelo `test-engineer` |
| infra-guardian (1ª) | contar na telemetria do front a falha de carga do pedaço da onça (`.catch(() => SEM_ONCA)`) | `TODO.md`: a telemetria do front não existe ainda. O Implementador acrescenta a linha |
| infra-guardian (1ª) | citar o teto do primeiro carregamento da entrada em `docs/infra.md` seção 3 | `TODO.md`: `docs/infra.md` não é arquivo desta correção. O Implementador acrescenta a linha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 19:25:12 | 2026-11-02 19:25:20 | `tenancy-guardian` | 1 | APROVADO | a2e3a65c24a7212a9 |
| 2026-11-02 19:25:00 | 2026-11-02 19:25:29 | `frontend-reviewer` | 1 | APROVADO | aedd6202dc2a04988 |
| 2026-11-02 19:25:17 | 2026-11-02 19:25:38 | `privacy-guardian` | 1 | APROVADO | a7232b6848372f2fe |
| 2026-11-02 19:25:27 | 2026-11-02 19:25:43 | `infra-guardian` | 1 | APROVADO | a0b9d7be4b37c36b1 |
| 2026-11-02 19:25:22 | 2026-11-02 19:26:14 | `conformidade-reviewer` | 1 | APROVADO | aac2a172e26f94160 |
| 2026-11-02 19:24:53 | 2026-11-02 19:26:58 | `test-engineer` | 1 | APROVADO | a255fd5de2cc5f38c |
| 2026-11-02 19:25:07 | 2026-11-02 19:28:03 | `revisor-geral` | 1 | APROVADO | a9b2eadc99124bc44 |
| 2026-11-02 19:36:00 | 2026-11-02 19:36:28 | `test-engineer` | 2 | APROVADO | a23b8b069990b2913 |
| 2026-11-02 19:36:10 | 2026-11-02 19:36:37 | `revisor-geral` | 2 | APROVADO | a01d395697b05ee66 |
