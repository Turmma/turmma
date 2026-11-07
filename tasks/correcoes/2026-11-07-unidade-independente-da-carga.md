# Correção — `npm run test:unidade` cai por "Test timed out" quando a máquina está carregada

**Origem:** portão local da correção `2026-11-07-restos-ve-arquivo-novo` (4 corridas seguidas, logs `portao{,2,3,4}.log`), citado em `tasks/prd-acesso-e-convites/estado.md`, "O que falhou"
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. -->

## Sintoma

A unidade inteira do portão da tarefa cai só por `Test timed out`: 14 a 16 casos por corrida, em conjuntos que mudam (`chunk-names`, `tamanho-web`,
`guardas`, `catraca`, `esteira`, `revisoes`, `conferir`, `restos`; na primeira corrida também componentes jsdom). A carga da máquina foi de 7 a 40 em 12
núcleos durante a corrida, só com o Vitest. Cada um desses casos, rodado sozinho, passa.

## Fora desta correção

Arquivos da tarefa em curso, que ficam na árvore e não entram na revisão nem no commit desta correção:

- `M tools/renomear/arvore.ts`
- `M tools/renomear/restos.test.ts`
- `M tools/renomear/restos.ts`
- `?? tasks/correcoes/2026-11-07-restos-ve-arquivo-novo.md` (a correção do `restos`, retomada depois desta)

## Causa

Não é o `restos`. Medido: `Arvore.carregar` leva 0,3 s com e sem `incluirNaoVersionados` (a árvore tem 4167 arquivos versionados e 1 não versionado), e
`restos(RAIZ)` leva 45 a 52 s com a carga de fundo dos outros andares, e a mudança do `restos` não soma nada a isso. O custo é o de `citacoesNoTexto`,
`trocarCaminhos` e `trocarTrecho` repetidos por entrada do mapa e por linha (perfil em `--cpu-prof`), código que a base já tinha. O caso já declarava 180 s.
Otimizar o `restos` é outro trabalho, e fica fora.

A causa é a carga que a própria suíte cria. O Vitest usa um trabalhador por núcleo menos um (11 em 12 núcleos), e parte da unidade sobe processo e build
de verdade: o build da web (`chunk-names`), o `size-limit` (`tamanho-web`), `npm run lint` (`catraca`), o `playwright --list` (`esteira`), os CLIs de
`tools/` (`guardas`, `conferir`, `restos`) e os 100 hooks de `revisoes`. Cada um usa vários núcleos, a carga chegou a 40, e o caso que leva 1 a 3 s livre
(`chunk-names` 1 a 2,8 s, `tamanho-web` até 1,9 s, `conferir` 7 s o arquivo) passa do padrão de 5 s do Vitest. Os que caem mudam a cada corrida porque
dependem de quais arquivos o Vitest agenda juntos. O prazo próprio que alguns já tinham (60 s, 180 s, 240 s) foi calibrado com a máquina livre e também
estourou (`esteira` 85 a 130 s, `catraca` 322 a 400 s).

Medido depois: com 6 trabalhadores a unidade inteira passou (446 arquivos, 8430 casos) em 240 s, contra 332 a 455 s com 11: a disputa também custava tempo.
A carga ainda sobe a ~23, porque a máquina é compartilhada com os outros andares, e por isso o limite sozinho não basta: com ele, na corrida seguinte, só
um caso de `chunk-names` caiu, no padrão de 5 s.

## Teste que reproduz

`tools/ci/unidade-sob-carga.test.ts` e `tools/testes/limite-de-trabalhadores.test.ts` (novos):

- `limiteDeTrabalhadores`: 4 → 2, 12 → 6, 16 → 8; 5 → 2, 7 → 3; 1 → 1 e 2 → 1 (a esteira tem 2 núcleos, e o Vitest já usava 1 lá).
- `o projeto unidade usa exatamente o limite de trabalhadores da máquina`: vermelho na configuração do HEAD (`expected undefined to be 6`), verde com a correção.
- `projetos que rodam em paralelo no mesmo groupOrder declaram o mesmo maxWorkers…`: o Vitest 5 recusa `unidade` e `processo` com `maxWorkers` diferentes no
  mesmo `sequence.groupOrder`, e o `npm test` (`package.json`, a suíte `test` do portão completo) nem começa. Visto à mão: com o `maxWorkers` só na
  unidade, `vitest run --project unidade --project processo …` sai com `Projects "processo" and "unidade" have different 'maxWorkers'`; com o mesmo
  limite nos dois, os 55 casos rodam.
- `quem sobe processo ou build declara o próprio prazo`: sete `describe` com `{ timeout }` de pelo menos 30 s, e os dois casos que já tinham prazo e o
  subiram (`catraca`, 600 s; `esteira`, 180 s) no prazo que declaram.

A intermitência em si não reproduz de forma determinística (depende da carga dos outros andares). Substitui o vermelho: a unidade inteira, 4 vezes seguidas
sem a correção (portões da correção do `restos`: 14, 16, 14 e 15 casos vermelhos), contra as corridas com a correção (447 arquivos verdes, 192 s no portão).

## Correção

- `tools/testes/limite-de-trabalhadores.ts` (novo): `limiteDeTrabalhadores(nucleos)` = metade dos núcleos, nunca menos de 1. 12 núcleos → 6; a esteira (2
  núcleos) → 1, o mesmo que o Vitest já dava lá, sem ficar mais lenta.
- `vitest.config.ts`: os projetos `unidade` e `processo` usam esse limite (iguais, porque o Vitest 5 recusa `maxWorkers` diferentes no mesmo
  `sequence.groupOrder`). `integracao` e `infra` seguem em um trabalhador (`fileParallelism: false`).
- Prazo próprio de 60 s, no `describe`, nos que sobem build ou processo: `chunk-names` (o build de verdade da web), `tamanho-web`, `guardas` (três
  `describe`), `conferir` (a linha de comando) e `revisoes` (achados separados por documento), cada um com o comentário do que sobe. Os 60 s são um prazo de
  travamento, não de velocidade. As asserções não mudam.
- Os prazos que já existiam e estouraram sob carga sobem: `catraca` (`npm run lint`) de 240 s para 600 s, e `esteira` (o teto do e2e) de 60 s para 180 s.
- Fica de fora, por ser da outra correção: `restos.test.ts` (`restos: a linha de comando`, 5 s). A correção `2026-11-07-restos-ve-arquivo-novo` põe `{ timeout:
  60_000 }` nesse `describe` e inclui o par em `QUEM_SOBE_PROCESSO`.
- O resto da unidade segue no padrão de 5 s: unidade lenta de verdade tem de aparecer.

## Mutações

--faltando: 1 linha (7 blocos, 0 motivos)

A linha que o `--faltando` lista (`tools/renomear/arvore.ts:43`) é da correção do `restos`, que está na árvore e fora desta.

Sem o `Math.max`, o limite de 1 núcleo vira 0:

```mutacao
arquivo: tools/testes/limite-de-trabalhadores.ts
teste: tools/testes/limite-de-trabalhadores.test.ts › nunca zera: 1 núcleo → 1 e 2 núcleos → 1, que é o que o Vitest já usava na esteira
 export function limiteDeTrabalhadores(nucleos: number): number {
-  return Math.max(1, Math.floor(nucleos / 2))
+  return Math.floor(nucleos / 2)
```

Sem o `maxWorkers`, o projeto unidade volta ao padrão do Vitest (um trabalhador por núcleo menos um):

```mutacao
arquivo: vitest.config.ts
teste: tools/ci/unidade-sob-carga.test.ts › o projeto unidade usa exatamente o limite de trabalhadores da máquina
          // `tools/ci/unidade-sob-carga.test.ts` prova o limite.
-          maxWorkers: LIMITE_DE_TRABALHADORES,
```

Com um trabalhador por núcleo, o limite não limita:

```mutacao
arquivo: vitest.config.ts
teste: tools/ci/unidade-sob-carga.test.ts › o projeto unidade usa exatamente o limite de trabalhadores da máquina
          // `tools/ci/unidade-sob-carga.test.ts` prova o limite.
-          maxWorkers: LIMITE_DE_TRABALHADORES,
+          maxWorkers: availableParallelism(),
```

Sem o limite no projeto `processo`, ele e a unidade ficam com `maxWorkers` diferentes no mesmo `groupOrder`, e o `npm test` nem começa:

```mutacao
arquivo: vitest.config.ts
teste: tools/ci/unidade-sob-carga.test.ts › projetos que rodam em paralelo no mesmo groupOrder declaram o mesmo maxWorkers: o Vitest 5 recusa o contrário e o `npm test` nem começa
          // O mesmo limite da unidade: cada caso sobe `git` e `node`, e os dois projetos rodam juntos no `npm test`.
-          maxWorkers: LIMITE_DE_TRABALHADORES,
```

Sem o prazo próprio no `describe` do build da web:

```mutacao
arquivo: apps/web/chunk-names.test.ts
teste: tools/ci/unidade-sob-carga.test.ts › apps/web/chunk-names.test.ts › o build de verdade da web
falha: not.toBeNull()
-describe('o build de verdade da web', { timeout: 60_000 }, () => {
+describe('o build de verdade da web', () => {
```

Com o prazo do `npm run lint` de volta a 240 s:

```mutacao
arquivo: tools/guardas/catraca.test.ts
teste: tools/ci/unidade-sob-carga.test.ts › tools/guardas/catraca.test.ts › npm run lint está verde com a linha de base
    expect(resultado.status, resultado.stdout + resultado.stderr).toBe(0)
-  }, 600_000)
+  }, 240_000)
```

Com o prazo do teto do e2e de volta a 60 s:

```mutacao
arquivo: tools/ci/esteira.test.ts
teste: tools/ci/unidade-sob-carga.test.ts › tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe
    expect(somados).toBe(total)
-  }, 180_000)
+  }, 60_000)
```

## Recomendações sem aplicar
| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª), test-engineer (2ª) | O número de núcleos da esteira pode não ser 2: `runs-on: ubuntu-24.04` em repositório público costuma ter 4 vCPU, e o 2 só aparece num comentário de `.github/workflows/ci.yml:59`. Se forem 4, o limite dá 2 contra os 3 do Vitest, e o texto de `tools/testes/limite-de-trabalhadores.ts:6` e das linhas 58-59 do documento fica errado | `TODO.md`: conferir com `availableParallelism()` no log de uma corrida da esteira e corrigir os dois textos se for o caso. Não quebra nada; a esteira só fica um pouco mais lenta |
| revisor-geral (2ª) | O comentário dos "três `describe` com prazo próprio" está só no primeiro, em `tools/guardas/guardas.test.ts:65`; os de 743 e 916 não o têm | `TODO.md`: uma linha curta nos outros dois `describe`; só comentário |
| test-engineer (2ª) | Só um dos sete prazos de `describe` tem bloco de mutação próprio (os outros seis têm o caso no `it.each`, sem bloco) | Recusada: o `it.each` é o mesmo caso para os sete, e o bloco do `chunk-names` prova que ele fica vermelho quando o prazo some (test-engineer, 1ª rodada: "a mutação 3 vale por todos") |
| infra-guardian (2ª) | O caso do mesmo `maxWorkers` por `groupOrder` deixa de fora quem tem `fileParallelism: false` (`integracao` e `infra`); anotar no comentário que esses projetos não podem declarar `maxWorkers` | Recusada: o filtro é o mesmo do Vitest, que manda projeto sem paralelismo para a fila sequencial antes de comparar (`node_modules/vitest/dist/chunks/index.B89dZ0-N.js:11832-11841`, conferido pelo test-engineer na 2ª rodada: "o filtro … é mais estrito que isso, e está correto") |
| infra-guardian (2ª) | O caso dos prazos de `catraca` e `esteira` lê o fonte com regex que depende do recuo de dois espaços | Recusada: o revisor a considera aceitável como trava de texto; se o formato mudar, o caso falha alto e nomeia o arquivo |
| revisor-geral (2ª) | A correção do `restos` também precisa incluir o par em `QUEM_SOBE_PROCESSO` | Destino: correção `2026-11-07-restos-ve-arquivo-novo`, que também põe `{ timeout: 60_000 }` em `restos: a linha de comando`, como "Correção" deste documento já registra |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 12:34:04 | 2026-11-07 12:34:14 | `tenancy-guardian` | 1 | APROVADO | ab83805fd459f8898 |
| 2026-11-07 12:34:06 | 2026-11-07 12:34:19 | `privacy-guardian` | 1 | APROVADO | aa6178710569a5142 |
| 2026-11-07 12:34:08 | 2026-11-07 12:34:27 | `conformidade-reviewer` | 1 | APROVADO | a5f569c0ca56d60ea |
| 2026-11-07 12:33:57 | 2026-11-07 12:34:36 | `revisor-geral` | 1 | APROVADO | a0871138e9e29b114 |
| 2026-11-07 12:34:02 | 2026-11-07 12:34:38 | `infra-guardian` | 1 | APROVADO | ac58d37a7f69926cc |
| 2026-11-07 12:33:59 | 2026-11-07 12:35:58 | `test-engineer` | 1 | REPROVADO | a57215b6b556641c4 |
| 2026-11-07 12:52:27 | 2026-11-07 12:52:35 | `tenancy-guardian` | 2 | APROVADO | aca341ba7bafc0b5b |
| 2026-11-07 12:52:23 | 2026-11-07 12:52:43 | `infra-guardian` | 2 | APROVADO | aa0dd80dd2cd751d1 |
| 2026-11-07 12:52:33 | 2026-11-07 12:52:44 | `privacy-guardian` | 2 | APROVADO | a2bb9d90e72e37834 |
| 2026-11-07 12:52:08 | 2026-11-07 12:52:45 | `revisor-geral` | 2 | APROVADO | a5308e1b257277b58 |
| 2026-11-07 12:52:38 | 2026-11-07 12:52:49 | `conformidade-reviewer` | 2 | APROVADO | aa9427935eaf5cc36 |
| 2026-11-07 12:52:17 | 2026-11-07 12:53:34 | `test-engineer` | 2 | APROVADO | abf6e77a298c66230 |
