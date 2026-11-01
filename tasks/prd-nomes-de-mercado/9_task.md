# Tarefa 9.0 — Onda do kit visual, símbolos (linha web)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os componentes do kit (`apps/web/src/components/ui/`, menos a onça) passam ao nome do shadcn, do Radix e do AI
Elements: `Button`, `Card`, `Dialog`, `Sheet`, `AIMessage`, `AgentAvatar`, `PromptInput`. Nenhuma tela muda. A trava
de que o avatar só entra pelas duas peças assinadas continua recusando.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5, §9 e §10
- `prd.md` RF5 e RF7
- `inventario-web-e2e.md` §1 a §5, mais "Não muda, mas parece". As linhas de `inventario-adenda-2.md` com caminho no
  kit
- `inventario.md` §1, a linha "kit visual"
- `travas.md`, as linhas com 9.0 na coluna "Onda"
- `.claude/rules/50-frontend.md` e `.claude/rules/70-conformidade-cne.md`, item 4a (D58)

## Subtarefas

- [x] 9.1 — O mapa `tools/renomear/mapas/9.json`, com `"linha": true`
- [x] 9.2 — O `aplicar` e a classificação. `Tela` e `Tabela` em prosa, as classes CSS e os `data-testid` ficam
- [x] 9.3 — As travas: a regex `/from '\.\/AvatarAgente'/` de `Mensagem.test.tsx` passa a `AgentAvatar`, e
  `MensagemIA` passa a `AIMessage` em `avatar-so-nas-duas-pecas.test.ts`
- [x] 9.4 — O `conferir` e o `restos`. O diff da onça só no import do kit em `Onca.tsx` (Tech Spec §5). A busca dos nomes antigos em `apps/web/src` e `e2e/`
- [x] 9.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/` | alterado |
| `apps/web/chunk-names.ts`, `apps/web/chunk-names.test.ts` | alterado (o caminho do kit em texto; `travas.md:101`) |
| `eslint-suppressions.json` | alterado (as chaves dos arquivos do kit que acompanham o componente; `travas.md:95`) |
| `e2e/casca-no-celular.spec.ts`, `e2e/casca-publica.spec.ts`, `e2e/components-brand-icons.spec.ts`, `e2e/components-fields.spec.ts`, `e2e/components-overlays.spec.ts`, `e2e/components-states.spec.ts`, `e2e/components-surfaces.spec.ts`, `e2e/material.spec.ts`, `e2e/support/avatar.ts`, `e2e/support/coordenacao.ts`, `e2e/titulo-da-tela.spec.ts`, `e2e/tokens.spec.ts` | alterado (só comentário: nome ou caminho do kit) |
| `tools/processo/harness/guardioes.test.ts`, `tools/ci/tamanho-web.test.ts` | alterado (caminho e chunk do kit em texto) |
| `tools/renomear/mapas/9.json`, `tools/renomear/mapas/9.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7); nenhum `JsxText` muda | |
| `restos` | ferramenta | nada sobra em código | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| teste de fidelidade da onça | diff | verde, sem diff (RF5) | |
| `Tela` e `Tabela` em prosa, classe CSS e `data-testid` | `conferir` | intactos | |
| `Mensagem.test.tsx`, B | mutação | a mensagem que importa `AgentAvatar` sem a assinatura: vermelho (D58) | |
| `avatar-so-nas-duas-pecas`, A | mutação | vermelho com `AssinaturaIA.tsx` na lista de quem importa o avatar | |
| `avatar-so-nas-duas-pecas`, B | mutação | vermelho com o nome novo proibido | |

## Como testar

- O teste de componente leva `// @vitest-environment jsdom` na primeira linha:
  `npx vitest run --project unidade apps/web/src/components/ui/ai/`.
- A onça: `npx vitest run --project unidade apps/web/src/components/ui/onca/`, e
  `git diff --stat -- apps/web/src/components/ui/onca/` só com `Onca.tsx`, 2 linhas (o import do kit; Tech Spec §5).
- A galeria (`apps/web/src/gallery/`) usa o kit: o `aplicar` a alcança pelo `tsconfig` da web.
- Telas: nenhuma muda. O `frontend-reviewer` confere pelo `conferir`, porque não há foto nova.
- Ao fechar, a linha não espera a esteira (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: nenhum texto de tela entra nem sai. Se o `conferir` acusar um `JsxText`,
pare.

## Fora do escopo desta tarefa

A web fora do kit (10.0), a onça e os documentos (13.0, com o `README` do kit).

## Divergências resolvidas nesta tarefa

O arquivo de componente do kit acompanha o componente na 9.0 (a 6.0 moveu só as linhas arquivo e pasta): previstos ganham chunk-names, eslint-suppressions.json, 13 arquivos de e2e só de comentário e 2 travas de tools/, nenhum nos previstos da 7.0 e da 8.0; Tech Spec §5, travas.md (95, 101 e duas linhas no fim) e inventario-web-e2e.md:553 (a fixture kit-importa-api fica) — triagem do Arquiteto, 31/10.

31/10 — portão vermelho na duração de e2e/tokens.spec.ts:215 (só comentário): a onda não mexe no caso; a correção duracao-do-e2e-so-comentario tira da régua o caso de trecho sem comentário igual ao do HEAD (Tech Spec §13).

31/10 — o encontro com a spec (a 7.0 e as duas correções do `conferir` e da duração) soma ao `travas.md` as linhas da 7.0; as citações de linha das Mutações abaixo (guardioes, tamanho-web e estados) passam a 168, 169 e 170, onde o bloco "Achadas na 9.0" ficou, depois do "Achadas na 7.0".

31/10 — O conferir acusava os dois Linha de apps/web (o do kit e o de coordenacao/comum, que é da 10.0): limite (3) da ferramenta, consertado na correção 2026-10-31-conferir-homonimo-no-mesmo-pacote; a onda não mudou. Tech Spec §5 e casos.md (conferir) — triagem do Arquiteto, 31/10. Com a ferramenta nova o conferir mostrou quatro strings de `perigo-cheio.test.ts` (as duas de `<Botao …>` e as duas de `<Button …>`) sem exceção no mapa, e o restos mostrou o comentário de `tools/ci/duracao-do-e2e.test.ts:482`, que cita a troca `Campo` → `FormField`: as quatro entraram em `excecoesDoConferir` e o comentário em `fica` (inventario-web-e2e.md:554, item e), tudo no `9.json`.

31/10 — A onça: `Onca.tsx` importa `SeloIA` de `../ai/AssinaturaIA`, que a onda renomeia (`AIBadge`, `AgentSignature`). O import acompanha o nome (duas linhas, só o especificador e o nome importado); sem isso a onça não compila. O resto da pasta não muda, o teste de fidelidade e os três irmãos passam sem alteração (RF5, tasks.md:90), e o `git diff --stat` da pasta mostra só `Onca.tsx`, 2 linhas. Tech Spec §5 e inventario-web-e2e.md:554 (d) — triagem do Arquiteto, 31/10.

31/10 — portão vermelho de novo na duração de e2e/tokens.spec.ts:215: o semComentarios não entendia regex literal; a correção duracao-do-e2e-regex-literal o troca pelo parser do TypeScript (Tech Spec §13). O `e2e/tokens.spec.ts` continua só com a troca de comentário.

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`.

O `--faltando` lista 247 linhas de produção com condição, em 73 arquivos de `apps/web/src/`: são linhas que já existiam e que o rename só reescreveu (`<StatusBadge`, `<Banner`, `<ApprovalLine`, `<UserMessage`, `<Select`, `<OptionCard`, `<StatCard`, `<ProgressBar` e afins). O rename não acrescenta condição (o `conferir` prova que só o nome mudou), e as travas da onda têm os blocos abaixo.

**`Message.test.tsx`** (linha 73, forma B). A mensagem que importa o `AgentAvatar` põe o avatar sem o nome da função e sem o selo "IA" (D58). O nome novo é o que a regex proíbe.

```mutacao
arquivo: apps/web/src/components/ui/ai/Message.tsx
teste: apps/web/src/components/ui/ai/Message.test.tsx › a mensagem não importa o avatar
-import { AgentSignature } from './AgentSignature'
+import { AgentSignature } from './AgentSignature'
+import { AgentAvatar } from './AgentAvatar'
```

**`avatar-so-nas-duas-pecas.test.ts`** (linha 74, formas A e B). Com a `AgentSignature` no nome antigo, a lista de quem pode importar o avatar não a tem e a varredura a acusa (A). Uma peça da galeria que importa o avatar direto é acusada pelo caso das telas e da galeria (B).

```mutacao
arquivo: apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts
teste: apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts › só é importado pela
-const QUEM_IMPORTA_O_AVATAR = ['components/ui/ai/AgentSignature.tsx', 'components/ui/ai/Message.tsx']
+const QUEM_IMPORTA_O_AVATAR = ['components/ui/ai/AssinaturaIA.tsx', 'components/ui/ai/Message.tsx']
```

```mutacao
arquivo: apps/web/src/gallery/sections/marca-onca.tsx
teste: apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts › as telas e a galeria que mostram a onça
-import { AgentSignature, type TamanhoDoAvatar } from '../../components/ui/ai/AgentSignature'
+import { AgentSignature, type TamanhoDoAvatar } from '../../components/ui/ai/AgentSignature'
+import { AgentAvatar } from '../../components/ui/ai/AgentAvatar'
```

**`chunk-names.ts`** (linha 101, forma A). Com a peça no nome antigo, a lista fechada não tem a peça nova e o caso das peças de estado fica vermelho.

```mutacao
arquivo: apps/web/chunk-names.ts
teste: apps/web/chunk-names.test.ts › as peças novas de estado
-'ui/Alert',
+'ui/Aviso',
```

```mutacao
arquivo: apps/web/chunk-names.ts
teste: apps/web/chunk-names.test.ts › as peças novas de estado
-'ui/Toggle',
+'ui/Toque',
```

**`eslint-suppressions.json`** (linha 95, forma C). O lint é a trava e não é caso de Vitest (como na 5.0); o nome antigo na chave de um arquivo movido é resto do mapa, e o `restos` o acusa.

```mutacao
arquivo: eslint-suppressions.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-"apps/web/src/components/ui/ai/PromptInput.tsx": {
+"apps/web/src/components/ui/ai/CaixaPedido.tsx": {
```

**`guardioes.test.ts`** (linha 168, forma A). Com o arquivo de exemplo da exceção no nome antigo, o caso que confere que ele existe fica vermelho.

```mutacao
arquivo: tools/processo/harness/guardioes.test.ts
teste: tools/processo/harness/guardioes.test.ts › cada exceção casa ao menos um arquivo versionado
-{ prefixo: 'apps/web/src/components/ui/', arquivo: 'apps/web/src/components/ui/Tabs.tsx', guardioes: [C, I] },
+{ prefixo: 'apps/web/src/components/ui/', arquivo: 'apps/web/src/components/ui/Abas.tsx', guardioes: [C, I] },
```

```mutacao
arquivo: tools/processo/harness/guardioes.test.ts
teste: tools/processo/harness/guardioes.test.ts › cada exceção casa ao menos um arquivo versionado
-{ prefixo: 'apps/web/src/components/ui/ai/', arquivo: 'apps/web/src/components/ui/ai/AgentSignature.tsx', guardioes: [P, C, I] },
+{ prefixo: 'apps/web/src/components/ui/ai/', arquivo: 'apps/web/src/components/ui/ai/AssinaturaIA.tsx', guardioes: [P, C, I] },
```

**`tamanho-web.test.ts`** (linha 169, forma C). O chunk de mentira só precisa casar `pecas-*.js`; o nome antigo nele é resto do mapa.

```mutacao
arquivo: tools/ci/tamanho-web.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const sozinho = sizeLimit(buildDeMentira({ ...BUILD_PEQUENO, 'pecas-PromptInput.js': jsComBrotliDe(41_000) }))
+const sozinho = sizeLimit(buildDeMentira({ ...BUILD_PEQUENO, 'pecas-CaixaPedido.js': jsComBrotliDe(41_000) }))
```

**`estados.test.tsx`** (linha 170, forma A). Com a peça no nome antigo, a lista de `chunk-names.ts` não a tem e o caso das peças novas fica vermelho.

```mutacao
arquivo: apps/web/src/components/states/estados.test.tsx
teste: apps/web/src/components/states/estados.test.tsx › a lista fechada tem as três peças novas
-for (const nova of ['ui/Alert', 'ui/CountBadge', 'ui/Toggle']) expect(PECAS_FORA_DA_ENTRADA as readonly string[], nova).toContain(nova)
+for (const nova of ['ui/Aviso', 'ui/CountBadge', 'ui/Toggle']) expect(PECAS_FORA_DA_ENTRADA as readonly string[], nova).toContain(nova)
```

**`casca-sem-import.test.ts`, `perigo-cheio.test.ts`, `estilos.test.ts` e `danger-solid.ts`** (linha 140, forma A e C). Com o caminho do kit no nome antigo, o detector não acha a pasta `ai/` (casca), a lista fechada cita um arquivo que não existe (perigo cheio), a varredura não acha o arquivo (estilos) e a regex do fixture não vê a tag nova (danger-solid).

```mutacao
arquivo: apps/web/src/components/casca-sem-import.test.ts
teste: apps/web/src/components/casca-sem-import.test.ts › o detector reprova a peça e a pasta por caminho relativo
-expect(motivoDeFora('./ui/ai/AgentSignature')).toBe('pasta fora da entrada')
+expect(motivoDeFora('./ui/ia/AssinaturaIA')).toBe('pasta fora da entrada')
```

```mutacao
arquivo: apps/web/src/components/perigo-cheio.test.ts
teste: apps/web/src/components/perigo-cheio.test.ts › os arquivos que o escrevem são os da lista fechada
-'components/ui/Button.tsx': 'o tipo da prop `cheio`, que só existe em `variante="perigo"`',
+'components/ui/Botao.tsx': 'o tipo da prop `cheio`, que só existe em `variante="perigo"`',
```

```mutacao
arquivo: apps/web/src/estilos.test.ts
teste: apps/web/src/estilos.test.ts › nenhum arquivo da web pede cor fora do @theme
-expect(nomes, 'a varredura não está achando os arquivos da web').toContain('components/ui/Button.tsx')
+expect(nomes, 'a varredura não está achando os arquivos da web').toContain('components/ui/Botao.tsx')
```

```mutacao
arquivo: apps/web/src/__fixtures__/danger-solid.ts
teste: apps/web/src/components/perigo-cheio.test.ts › reconhece a prop do botão
-const PROP_CHEIO_NO_BOTAO = /<Button\b(?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\bcheio\b/
+const PROP_CHEIO_NO_BOTAO = /<Botao\b(?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\bcheio\b/
```

```mutacao
arquivo: apps/web/src/__fixtures__/danger-solid.ts
teste: apps/web/src/components/perigo-cheio.test.ts › reconhece a prop do botão
-const CHAVE_CHEIO_NAS_CLASSES = /\bbuttonVariants\(\s*\{[^}]*\bcheio\b/
+const CHAVE_CHEIO_NAS_CLASSES = /\bclassesDoBotao\(\s*\{[^}]*\bcheio\b/
```

**`importers.ts`** (ordem da rodada 1, item 1). Com a comparação de arquivo por prefixo, `importadoresDe` confunde o avatar com um arquivo de nome mais longo que começa com ele (a amostra `Vizinha.tsx` importa `AgentAvatarDoAluno`) e o caso deixa de ser verde.

```mutacao
arquivo: apps/web/src/__fixtures__/importers.ts
teste: apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts › não confunde comentário, nome parecido
-        .some((resolvido) => (ehPasta ? resolvido === alvo.slice(0, -1) || resolvido.startsWith(alvo) : resolvido === alvo || resolvido === `${alvo}/index`)),
+        .some((resolvido) => (ehPasta ? resolvido === alvo.slice(0, -1) || resolvido.startsWith(alvo) : resolvido.startsWith(alvo))),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | Os nomes das props (`variante="secundario"`, `familia="ok"`, `rotulo=`) continuam em português em componentes com nome do shadcn | Retro da X8: a tarefa não pede a troca (a 9.0 é "só nome" do componente; RF7) |
| conformidade-reviewer (1ª) | Os títulos de `describe`/`it` da trava da D58 (`describe('MensagemIA')` em `Message.test.tsx`, o `it` de `avatar-so-nas-duas-pecas.test.ts`) ficam com o nome antigo | Recusada nesta tarefa: Tech Spec §5 (o `restos` libera "o `describe`/`it`/`test`") e o `conferir` não deixa trocar título de caso. Destino: onda própria ou 13.0, e retro da X8 |
| conformidade-reviewer (1ª) | `TextoOptions` em `components/ui/ai/approval.ts` junta português e inglês (regra 60 item 1) | O `revisor-geral`, que audita a regra 60, não o exigiu. Retro da X8 |
| test-engineer (1ª) | O bloco de `casca-sem-import.test.ts` (`'./ui/ia/AssinaturaIA'`) fica vermelho pela pasta `ia` e não pelo nome do arquivo; `'ui/CountBadge'` não tem bloco | Não deixa cláusula sem prova (o próprio revisor); a prova está nos casos `a lista de arquivos da casca existe` e `estados`. Retro da X8 |
| test-engineer (1ª) | Títulos de `describe`/`it` no nome antigo (também `e2e/components-ai.spec.ts:269`) | Mesmo destino da linha dos títulos acima (Tech Spec §5): onda própria ou 13.0 |
| test-engineer (1ª) | Comentários da onça citam `AssinaturaIA` e `AvatarAgente` (`CabecaOnca.tsx:218` e `:220`, `CabecaOnca.test.tsx:12` e `:28`, `Onca.test.tsx:30`), e dois `indexOf` leem o README | 13.0: a onça e o `README` do kit são "Fora do escopo desta tarefa" |
| revisor-geral (1ª) | Os títulos de `describe` de `Message.test.tsx` (linhas 21, 41, 95, 114) ficam com o nome antigo | Mesmo destino dos títulos acima (Tech Spec §5) |
| revisor-geral (1ª) | O bloco de mutação de `Message.tsx` acrescenta um `import { AgentAvatar }` sem uso | A trava lê o import por regex (`/from '\.\/AgentAvatar'/`), e o bloco já a deixa vermelha; mudar o bloco refaz a prova do portão sem ganho. Recusada |
| revisor-geral (3ª), test-engineer (3ª) | O portão da tarefa não roda o `conferir`; foi o que fez a tarefa voltar duas vezes | Retro da X8: decidir se o `conferir` da onda entra no portão local, ou se a ordem de correção de onda pede "rode o `conferir`" em "Depois de aplicar" |
| revisor-geral (3ª) | As duas entradas novas de `excecoesDoConferir` (`9.json:3962-3971`) têm o mesmo `motivo`; seria mais claro dizer "string de antes" e "string de depois" | Não aplicada: ninguém reprovou nesta rodada, e mexer no `9.json` caducaria a rodada dos sete. Retro da X8 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 17:09:37 | 2026-10-31 17:10:28 | `tenancy-guardian` | 1 | APROVADO | a3f4ad8e119dad60f |
| 2026-10-31 17:09:43 | 2026-10-31 17:10:54 | `frontend-reviewer` | 1 | APROVADO | a4abf4a15d0fcc404 |
| 2026-10-31 17:09:39 | 2026-10-31 17:11:07 | `privacy-guardian` | 1 | APROVADO | a689fa42aa04f0606 |
| 2026-10-31 17:09:41 | 2026-10-31 17:11:25 | `infra-guardian` | 1 | APROVADO | a7ab47ac121d2b03d |
| 2026-10-31 17:09:40 | 2026-10-31 17:11:46 | `conformidade-reviewer` | 1 | APROVADO | aa26cc1c0c6b32f05 |
| 2026-10-31 17:09:44 | 2026-10-31 17:13:01 | `test-engineer` | 1 | REPROVADO | a9afeb9c952f2944a |
| 2026-10-31 17:09:45 | 2026-10-31 17:13:16 | `revisor-geral` | 1 | REPROVADO | af7575a099c3109fc |
| 2026-10-31 20:18:18 | 2026-10-31 20:18:51 | `test-engineer` | 2 | APROVADO | a41d59d342e863558 |
| 2026-10-31 20:18:24 | 2026-10-31 20:19:42 | `revisor-geral` | 2 | REPROVADO | a09c03fe5a65cdf37 |
| 2026-10-31 21:46:41 | 2026-10-31 21:46:54 | `tenancy-guardian` | 2 | APROVADO | a33963a6a8ecb02f2 |
| 2026-10-31 21:46:50 | 2026-10-31 21:47:03 | `infra-guardian` | 2 | APROVADO | a405cecbf8091ba04 |
| 2026-10-31 21:46:44 | 2026-10-31 21:47:04 | `privacy-guardian` | 2 | APROVADO | a841095989a9df31b |
| 2026-10-31 21:46:53 | 2026-10-31 21:47:05 | `frontend-reviewer` | 2 | APROVADO | a50efa797f1572de1 |
| 2026-10-31 21:46:47 | 2026-10-31 21:47:10 | `conformidade-reviewer` | 2 | APROVADO | a6d33612cfe63ed5b |
| 2026-10-31 21:47:01 | 2026-10-31 21:47:27 | `revisor-geral` | 3 | APROVADO | a9320834f7f6bbfe5 |
| 2026-10-31 21:46:56 | 2026-10-31 21:47:37 | `test-engineer` | 3 | APROVADO | a0e56b32239185699 |
