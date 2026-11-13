# Tarefa 7.0 — A coordenação envia até 20 PDFs de uma vez, com séries e licença

**Funcionalidade:** ingestao-do-material · **Depende de:** 2.0, 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O envio exige séries e, de terceiro, licença vigente, conferidas antes de ler o arquivo e na transação; a tela envia
até 20 PDFs, um por vez.

## Contexto necessário

- `techspec.md` §3, §4, §5 "Envio e edição" (1) e (3), §7c, §9
- `prd.md` RF3, RF14, RF16
- `cenarios.md` "Envio…", "Corridas", "Migração", "Telas"
- `.claude/rules/` 10, 20, 40, 50, 80
- Código: `DialogoDeEnvioDeMaterial.tsx`; `seriesQueryOptions` (`apps/web/src/api/estrutura.ts`); `licencasQueryOptions` (6.0)

## Subtarefas

- [x] 7.1 — Migration: `material_serie` e o índice da §7c; backfill em lotes com todas as séries da escola
- [x] 7.2 — `serieIds` (1 a 7, sem repetir) e `licencaId` na ordem da §5 (1); `material.recusado` com as séries
- [x] 7.3 — Licença reconferida na transação, `for share`; `LICENCA_VENCIDA` na suíte de saídas da 2.0
- [x] 7.4 — `serieId` no `GET /v1/materiais`; `serieIds` e `licencaId` no contrato
- [x] 7.5 — Diálogo em lote: séries; licença vigente, relida ao abrir e no foco (R6); até 20; título editável; `aria-live`
- [x] 7.6 — O 429 com os textos do `cenarios.md`, e a retomada (R6)
- [x] 7.7 — `docs/interface.md`, `docs/modelo-de-dados.md`; o passo 1 do `docs/roteiro-da-demonstracao.md` conferido contra o spec dele
- [x] 7.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0054_*.sql`, `packages/core/src/db/schema/material.ts`, `packages/shared/src/material/material.ts`, `packages/shared/src/privacidade/classificacao.ts` | novo e alterado |
| `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/test/material.int.test.ts`, `apps/api/test/material-envio-orfao.int.test.ts`, `packages/core/src/db/migracao-f4.int.test.ts`, `apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx`, `apps/web/src/areas/coordenacao/material/material-envio.ts`, `apps/web/src/areas/coordenacao/material/material-envio.test.ts`, `apps/web/src/areas/coordenacao/material/Material.test.tsx`, `e2e/material.spec.ts`, `e2e/roteiro-da-demonstracao.spec.ts`, `docs/interface.md`, `docs/modelo-de-dados.md`, `docs/roteiro-da-demonstracao.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| duas séries | I | `GET ?serieId` de cada uma traz o material | `material.int.test.ts` › com duas séries o material aparece no filtro de cada uma e não no de uma terceira; o professor com vínculo confirmado o lê pela série, e o vínculo encerrado não entra |
| sem série; `[]`; `[S1, S1]` | I | `ENTRADA_INVALIDA` | `material.int.test.ts` › sem série, `serieIds` vazio, repetida (também em maiúsculas) ou com oito: `ENTRADA_INVALIDA`, nada lido nem gravado…; `packages/shared/src/material/material.test.ts` › as séries: de 1 a 7, sem repetir… |
| série inexistente; da B | I | `NAO_ENCONTRADO` igual, nada lido nem gravado; auditoria sem o id da B | `material.int.test.ts` › série inexistente e série da escola B: o mesmo `NAO_ENCONTRADO`, nenhum byte lido, nada no storage, em `material` nem em `envio_de_material`, e a auditoria nunca leva o id da B |
| terceiro sem `licencaId` | I | `MATERIAL_SEM_LICENCA` | `material.int.test.ts` › terceiro sem `licencaId`: `MATERIAL_SEM_LICENCA` antes de abrir o arquivo, gravado com o motivo e as séries; `material.test.ts` (shared) › a licença registrada existe só, e sempre, no material de terceiro… |
| licença vencida; inexistente; da B | I | recusa antes de ler, `material.recusado` com séries | `material.int.test.ts` › licença $caso: `LICENCA_VENCIDA` antes de abrir o arquivo (vencida; que só começa no futuro) e › licença inexistente e licença da escola B: o mesmo `NAO_ENCONTRADO`, antes de abrir o arquivo, gravado com o motivo e sem o id da B |
| próprio, sem licença | I | entra | `material.int.test.ts` › responde 201 com o material `processando`… (`licencaId: null`, `serieIds` da escola); › material de terceiro cita a licença registrada… (`licencaId` em material próprio é `ENTRADA_INVALIDA`) |
| vencida na transação; licença que some | I | o storage encurta a vigência, ou a licença some do banco: objeto e linha apagados, recusa auditada como vencida | `material-envio-orfao.int.test.ts` › `LICENCA_VENCIDA` reconferida na transação: a licença encurtada depois da conferência da entrada recusa o envio, o objeto e a linha saem, e a recusa é auditada (7.0); › `LICENCA_VENCIDA` reconferida na transação: a licença que some do banco depois da conferência da entrada recusa o envio como vencida, e nada fica (7.0) |
| [P] envio parado no `for share`; `PATCH` da licença | P | o `PATCH` espera (o gatilho para o envio antes do `insert`, para a FK não ser a trava). Mutação: tirar o `for share` | `material-envio-orfao.int.test.ts` › [P] o envio segura a licença (`for share`) até o commit: o `PATCH` que a encurta espera o envio e não perde para ele, e o material fica com a licença que valia (7.0) |
| `serieId` da B | I | igual a inexistente | `material.int.test.ts` › `GET /v1/materiais?serieId` com a série da B responde como a que não existe: lista vazia, mesmo com material da B nessa série |
| vínculo encerrado em X, aberto em Y | I | `GET ?serieId` só traz Y | `material.int.test.ts` › com duas séries o material aparece no filtro de cada uma… (o vínculo encerrado não entra) |
| backfill | I | todas as séries; escola sem série fica sem | `migracao-f4.int.test.ts` › as séries do material (7.0) › cada material ganha todas as séries da própria escola, e nenhuma de outra; mais de um lote de 5.000…; a escola sem série deixa o material sem linha, e rodar o backfill de novo não duplica nada |
| relógio da vigência | I | o dia vem do relógio injetado, não do do sistema: o último dia vale, e às 0h01 do seguinte não | `material.int.test.ts` › a vigência da licença é conferida pelo relógio injetado, não pelo do sistema: vale no dia dentro do prazo e deixa de valer no seguinte |
| `licenciante` copiado | I | o código grava o da licença | `material.int.test.ts` › o último dia da licença ainda vale, e o material de terceiro sai com o `licenciante` da licença; › a licença citada em maiúsculas vale como a de minúsculas; › material de terceiro cita a licença registrada e copia o licenciante dela |
| sem ano letivo | I | o envio funciona | `material.int.test.ts` › escola sem ano letivo em curso: o envio com séries funciona |
| `contracts.test` | U | professor sem licenciante | `material.int.test.ts` › o licenciante é da coordenação: o professor da disciplina lê o material sem ele, na lista e por id (com `licencaId`); `contracts.test.ts` varre `materialSchema`, que ganhou `licencaId` e `serieIds` |
| 21 arquivos | U | o 21º recusado antes | `material-envio.test.ts` › o 21º arquivo é recusado antes de enviar, e o texto diz quantos ficaram de fora; `Material.test.tsx` › o arquivo que não é PDF é recusado na tela…; o 21º arquivo também fica de fora |
| 20, um inválido, um repetido | U | 18 prontos, uma falha, um "já enviado" | `envio-em-lote.test.ts` › 20 arquivos, um inválido e um repetido…; `Material.test.tsx` › 20 arquivos, um inválido e um repetido: 18 prontos, uma falha e um "já enviado", um por vez… |
| título | U | do nome, editável | `Material.test.tsx` › o título nasce do nome do arquivo e se edita antes de enviar; o título vazio barra o envio e diz qual arquivo; `material-envio.test.ts` › o título é de cada arquivo, com o teto do contrato… |
| 429 no meio | U | pendentes e os dois textos | `Material.test.tsx` › o 429 no meio: os que faltam ficam na lista, a tela diz "12 de 20 enviados" e o botão continua de onde parou; `envio-em-lote.test.ts` › o 429 no meio para o lote…; `material-envio.test.ts` › o 429 diz que os que faltam ficam, e a hora em que continuam |
| retomada | U | no horário ou pelo botão (R6) | `Material.test.tsx` › o 429 com a espera da API: a tela diz a hora e o envio continua sozinho nela (no horário); › o 429 no meio… (pelo botão "Continuar o envio") |
| sete séries com licença registrada | I | o recebimento aceita os 13 campos do multipart e o material sai com as sete séries. Mutação: `MAXIMO_DE_CAMPOS = 10` | `material.int.test.ts` › as sete séries do teto com uma licença registrada: o recebimento aceita os treze campos do pedido e o material sai com as sete |
| licença relida ao abrir | U | o diálogo que reabre dentro dos 30 s do cache lê `/v1/licencas` de novo, e a que venceu some | `Material.test.tsx` › a licença é lida de novo quando o diálogo reabre, dentro do prazo em que a lista ainda estaria fresca: a que venceu nesse meio-tempo não aparece |
| licenças relidas | U | a vencida some (R6) | `Material.test.tsx` › a licença é lida de novo quando a janela volta ao foco: a que venceu some, e a escolha dela sai, dita; › só as licenças vigentes se escolhem… |
| sem licença vigente | U | o texto e o link | `Material.test.tsx` › sem licença vigente: "Registre a licença primeiro", com o link para Licenças |
| a11y | U | `aria-live`, foco, 44 px | `Material.test.tsx` › acessibilidade: a região `aria-live` diz a situação de cada arquivo, os alvos têm 44 px e o foco vai ao resumo no fim; › a região `aria-live` diz quantos arquivos entraram… |
| clique duplo | U | um lote só | `Material.test.tsx` › duplo clique: um lote só, mesmo com dois envios do formulário no mesmo instante |
| recomeço: outra pessoa; o mesmo lote; resposta atrasada; falha aberta | E | nada da anterior sobra | `e2e/material.spec.ts` › segunda pessoa: a coordenação de B entra na aba da de A…; › a falha do envio fica no diálogo, com o que foi digitado; fechar e reabrir começa de um formulário novo; `Material.test.tsx` › a resposta que chega com o diálogo já fechado não fecha o diálogo reaberto… |
| três PDFs, um repetido, 300 no seed, rede e CPU lentas | E | fim a fim | `e2e/material.spec.ts` › o lote de três PDFs, um repetido: dois entram, o repetido é "já enviado", e o título de cada um vem do nome do arquivo e se edita (os dois casos medem sob rede e CPU lentas; o dos 300 é o da linha de baixo) |
| 1366 × 768 | E | `paginaNaoRola` | `e2e/material.spec.ts` › numa escola com 300 materiais o lote cabe em 1366 × 768: a página não rola, o diálogo rola dentro dele, e a lista dos 300 continua atrás |

## Como testar

- Envio: `apps/api/test/material.int.test.ts` › "na mesma escola é `CONFLITO`…"; `vi.spyOn(PdfExtractor, 'extrair')` para "nada lido"
- Trava: `WriteBlockTrigger`, `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Tela: `Material.test.tsx` › "o envio com licença…" (l.533), › "sem licença o diálogo diz 'Envio recusado'…" (l.674)
- 429: `apps/api/test/rate-limit.int.test.ts` (l.228)
- Comandos: `npx vitest run --project integracao apps/api/test/material.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/material` › `text=Enviar material` (vazio, lote no meio, 429, sem licença)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano.

## Fora do escopo desta tarefa

Edição (8.0), leitura (9.0), `PATCH` (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A recusa pela licença registrada grava dois motivos novos em `material.recusado`: `licenca_vencida` (vencida ou que só começa depois) e `licenca_inexistente` (a que não existe e a da escola B, sem distinção) | A spec diz "gravado com o motivo" sem nomear os dois. Um motivo só para a inexistente e a da B mantém a regra 10, item 6: a auditoria também não confirma que o id existe em outra escola. Os dois ficam em `MOTIVOS_DA_RECUSA_PELA_LICENCA_REGISTRADA`, ao lado dos de `MOTIVOS_DA_RECUSA_DO_MATERIAL` (`sem_licenca`, `sem_declaracao`, que o terceiro sem `licencaId` mantém) | `techspec.md` §5 "Envio e edição" (1): a frase dos motivos; `cenarios.md` "Envio, séries e licença no envio": o `[I]` do terceiro sem `licencaId` |
| O recebimento do multipart aceita até 17 campos (`MAXIMO_DE_CAMPOS = 6 + 7 séries + 4`), e não os 10 de antes | `serieIds` chega como o campo repetido, até 7 vezes (RF3): com o limite antigo o envio de 7 séries sairia como `ENTRADA_INVALIDA` do próprio recebimento, antes de o contrato rodar | `techspec.md` §7c, linha "Limite por escola" (o teto de campos) |
| O [E] "três PDFs com um repetido… com 300 materiais no seed, sob throttling" é dois casos: o lote de três PDFs, e o diálogo do lote numa escola com 300 materiais em 1366 × 768 | Os dois juntos passavam de 15 s, o teto do caso alterado no portão (`tools/ci/duracao-do-e2e.ts`); o `test.slow()` de um caso novo não conta. O que cada caso prova continua inteiro | `cenarios.md` "Telas": o último `[E]` |

Fora da lista de arquivos previstos, entraram o `use-lote-de-material.ts` (o estado e o laço do lote, fora do desenho), o `PartesDoEnvioDeMaterial.tsx` (as peças do diálogo), o `envio-em-lote.ts` (o laço de envio, sem React), o `use-lote-de-material.test.ts` e o `envio-em-lote.test.ts`: o diálogo em um arquivo só tinha complexidade 54 e 180 linhas por função, que o lint recusa (complexidade 10, 80 linhas por função), e a divisão separa o que é regra (testável sem React) do que é tela. Também `material.module.ts`, `licenca.repository.ts` e `material-upload.ts` (API), `acoes.ts` e `acoes.test.ts` (a ação de auditoria ganha as séries), `error-code.ts`, `messages.ts` e `domain.exception.ts` (o código `LICENCA_VENCIDA`, o texto dele e o status 422), e `tools/guardas/tabelas-do-nucleo.mjs` (a tabela `material_serie` entra na lista das do núcleo), e `tools/guardas/catraca.test.ts` (o `TETO` da catraca baixa de 240 para 238 em `complexity` e de 60 para 59 em `max-lines-per-function`: o diálogo e o `material-envio.ts` saíram da linha de base de `eslint-suppressions.json`, que só encolhe), e `apps/api/test/write-block-trigger.ts` (o gatilho ganha `momento: 'before'`: o do [P] para o envio antes do `insert` do material, porque com o gatilho depois do `insert` a FK do material já travava a licença em `for key share` e o `PATCH` esperava mesmo sem o `for share` do envio).

## Mutações

--faltando: 7 linhas (186 blocos, 7 motivos)

Um bloco por cláusula do que a tarefa acrescenta, na ordem dos arquivos: a API (o escopo da licença e da série no repository, o `for share`, a conferência na entrada e na transação, o `licenciante` copiado da licença, o `serieId` do filtro), o contrato (`serieIds` de texto único vira lista, a licença registrada só no terceiro), a tela em `material-envio.ts` (cada termo do que falta no formulário e do pedido de cada arquivo, o título de cada arquivo e o da recusa, o texto de cada situação, o rótulo do botão), o laço do lote (`envio-em-lote.ts`: cada parada, o repetido, o cancelado), o estado do lote (`use-lote-de-material.ts`: o fim da rodada, o anúncio de cada arquivo, a licença que sumiu, o teto do "Tentar de novo", a seleção vazia, a trava do clique duplo, o foco no primeiro erro) e as peças do diálogo (o rótulo de "Fechar" e "Cancelar", cada trava do formulário, o aviso da declaração, as séries em ordem e em cada estado, as licenças em cada estado, a cor de cada situação). Os dois que o `fimDaRodada` e o `anuncioDoItem` têm são de `use-lote-de-material.test.ts`, e os de `material-envio.ts` que o botão e o título usam são de `material-envio.test.ts`: são funções sem React, e a prova é o valor de volta. As sete linhas que o `--faltando` lista têm motivo: (1) e (2) `?.valor ?? ''` do `aoMudar` da titularidade e da licença de uso (`DialogoDeEnvioDeMaterial.tsx`): o valor vem da própria lista de opções, e só o marcador "Escolha…" não casa e volta a `''`; o `?? ''` existe para o tipo, e trocar o `''` por outro valor é o marcador escolher algo que o formulário já recusa por `titularidade === ''` e `licenca === ''` (as duas têm bloco); (3) `if (campo === null) return` do efeito do `cancel` (`PartesDoEnvioDeMaterial.tsx`): a `ref` já aponta o `input` quando o efeito roda, e a guarda é do tipo; (4) as classes de cor da moldura da área de soltar (`sobre`, `comErro`) e (5) o ícone vazio ou com arquivo: são desenho (borda e glifo), que o `jsdom` não mede e que a vitrine mostra, e o que importa para o leitor de tela, o `aria-describedby` do erro, tem bloco; (6) `arquivos === null ? [] : [...arquivos]` de `receberArquivos`, e (7) `if (campos === undefined) return` de `recusar`: `evento.target.files` de um `input type=file` nunca é nulo no navegador, e o formulário já passou por `temErro`, que barra o pedido sem os campos que `camposDoEnvio` confere.

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/material.int.test.ts
 .select({ licenciante: licencaDeMaterial.licenciante, vigenteDesde: licencaDeMaterial.vigenteDesde, vigenteAte: licencaDeMaterial.vigenteAte })
 .from(licencaDeMaterial)
-.where(and(eq(licencaDeMaterial.escolaId, requireEscolaId()), eq(licencaDeMaterial.id, id)))
+.where(and(eq(licencaDeMaterial.id, id)))
```

```mutacao
arquivo: apps/api/src/material/licenca.repository.ts
teste: apps/api/test/material-envio-orfao.int.test.ts
-const [linha] = await (travar ? consulta.for('share') : consulta)
+const [linha] = await consulta
```

```mutacao
arquivo: apps/api/src/material/material.module.ts
teste: apps/api/test/material.int.test.ts
-new MaterialService({ banco, armazem, enfileirador: new JobOutbox(new JobOutboxRepository(banco)), logger: opcoes.logger, ...(opcoes.relogioDasLicencas === undefined ? {} : { relogio: opcoes.relogioDasLicencas }) }),
+new MaterialService({ banco, armazem, enfileirador: new JobOutbox(new JobOutboxRepository(banco)), logger: opcoes.logger,  }),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts
-.where(and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
+.where(and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, materialSerie.serieId))),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts
-.where(and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
+.where(and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.serieId, serieId))),
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts
-.where(and(eq(serie.escolaId, requireEscolaId()), inArray(serie.id, [...serieIds])))
+.where(and(inArray(serie.id, [...serieIds])))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts
-serieId === undefined ? undefined : this.#comASerie(serieId),
+undefined,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-return situacao === 'vigente' || situacao === 'vence_em_30_dias'
+return situacao === 'vigente'
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-return diaDeUso((this.dependencias.relogio ?? systemClock).agora())
+return diaDeUso(systemClock.agora())
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-if (registrada === undefined) {
+if (false) {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-if (!licencaValeEm(this.#hoje(), registrada)) {
+if (false) {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-if ((await new MaterialRepository(banco).seriesDaEscola(serieIds)).length !== serieIds.length) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if ((await new MaterialRepository(banco).seriesDaEscola(serieIds)).length === -1) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-if (licencaId !== undefined) await this.#exigirLicencaVigente(pedido, disciplinaId, serieIds, licencaId)
+if (false) await this.#exigirLicencaVigente(pedido, disciplinaId, serieIds, licencaId)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts
-const vigente = licencaId === undefined ? undefined : await new LicencaRepository(tx).paraUso(licencaId, true)
+const vigente = licencaId === undefined ? undefined : await new LicencaRepository(tx).paraUso(licencaId, false)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-if (licencaId !== undefined && (vigente === undefined || !licencaValeEm(this.#hoje(), vigente))) throw new LicencaDeixouDeValerNoEnvio()
+if (true && (vigente === undefined || !licencaValeEm(this.#hoje(), vigente))) throw new LicencaDeixouDeValerNoEnvio()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts
-if (licencaId !== undefined && (vigente === undefined || !licencaValeEm(this.#hoje(), vigente))) throw new LicencaDeixouDeValerNoEnvio()
+if (licencaId !== undefined && (false || !licencaValeEm(this.#hoje(), vigente))) throw new LicencaDeixouDeValerNoEnvio()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts
-if (licencaId !== undefined && (vigente === undefined || !licencaValeEm(this.#hoje(), vigente))) throw new LicencaDeixouDeValerNoEnvio()
+if (licencaId !== undefined && (vigente === undefined || false)) throw new LicencaDeixouDeValerNoEnvio()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-licenciante: vigente?.licenciante ?? null,
+licenciante: null,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts
-licencaId: licencaId ?? null,
+licencaId: null,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts
-if (erro instanceof LicencaDeixouDeValerNoEnvio) {
+if (false) {
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts
-(valor) => (typeof valor === 'string' ? [valor] : valor),
+(valor) => valor,
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts
-.refine((pedido) => pedido.licencaId === undefined || pedido.titularidade === 'terceiro_com_licenca', { path: ['licencaId'], message: 'licença registrada só com material de terceiro' })
+.refine((pedido) => pedido.titularidade === 'terceiro_com_licenca', { path: ['licencaId'], message: 'licença registrada só com material de terceiro' })
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts
-.refine((pedido) => pedido.licencaId === undefined || pedido.titularidade === 'terceiro_com_licenca', { path: ['licencaId'], message: 'licença registrada só com material de terceiro' })
+.refine((pedido) => false || pedido.titularidade === 'terceiro_com_licenca', { path: ['licencaId'], message: 'licença registrada só com material de terceiro' })
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts
-if (pedido.titularidade === 'terceiro_com_licenca' && pedido.licencaId === undefined) return 'sem_licenca'
+if (pedido.licencaId === undefined) return 'sem_licenca'
```

```mutacao
arquivo: packages/shared/src/material/material.ts
teste: packages/shared/src/material/material.test.ts
-if (pedido.titularidade === 'terceiro_com_licenca' && pedido.licencaId === undefined) return 'sem_licenca'
+if (pedido.titularidade === 'terceiro_com_licenca' && false) return 'sem_licenca'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-const quantos = excedente === 1 ? 'O último arquivo não entrou' : `Os ${String(excedente)} últimos arquivos não entraram`
+const quantos = excedente !== 1 ? 'O último arquivo não entrou' : `Os ${String(excedente)} últimos arquivos não entraram`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return item.situacao === 'pendente' || item.situacao === 'falhou'
+return false || item.situacao === 'falhou'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return item.situacao === 'pendente' || item.situacao === 'falhou'
+return item.situacao === 'pendente' || false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (aparado === '') return 'Dê um título ao material, como ele aparece no livro ou na apostila.'
+if (false) return 'Dê um título ao material, como ele aparece no livro ou na apostila.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (aparado.length > TAMANHO_MAXIMO_TITULO_DO_MATERIAL) return `O título tem no máximo ${String(TAMANHO_MAXIMO_TITULO_DO_MATERIAL)} caracteres.`
+if (false) return `O título tem no máximo ${String(TAMANHO_MAXIMO_TITULO_DO_MATERIAL)} caracteres.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licenca !== SEM_LICENCA && rascunho.licencaId === ''
+return true && rascunho.licenca !== SEM_LICENCA && rascunho.licencaId === ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licenca !== SEM_LICENCA && rascunho.licencaId === ''
+return rascunho.titularidade === 'terceiro_com_licenca' && true && rascunho.licencaId === ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licenca !== SEM_LICENCA && rascunho.licencaId === ''
+return rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licenca !== SEM_LICENCA && true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (erro !== undefined) titulos.set(item.chave, erro)
+if (false) titulos.set(item.chave, erro)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (!itens.some(devePartir) && motivoDaRecusa(rascunho) === null) erros.arquivo = 'Escolha o PDF do material.'
+if (true && motivoDaRecusa(rascunho) === null) erros.arquivo = 'Escolha o PDF do material.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (!itens.some(devePartir) && motivoDaRecusa(rascunho) === null) erros.arquivo = 'Escolha o PDF do material.'
+if (!itens.some(devePartir) && true) erros.arquivo = 'Escolha o PDF do material.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (rascunho.serieIds.length === 0) erros.serieIds = 'Marque ao menos uma série: é por ela que o professor e o Tutor acham o material.'
+if (false) erros.serieIds = 'Marque ao menos uma série: é por ela que o professor e o Tutor acham o material.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (faltaALicencaRegistrada(rascunho)) erros.licencaId = 'Escolha a licença registrada do material. É ela que diz de quem é o conteúdo e até quando a escola pode usá-lo.'
+if (false) erros.licencaId = 'Escolha a licença registrada do material. É ela que diz de quem é o conteúdo e até quando a escola pode usá-lo.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return erros.titulos.size > 0 || CAMPOS_DO_ENVIO.some((campo) => campo !== 'titulo' && erros[campo] !== undefined)
+return false || CAMPOS_DO_ENVIO.some((campo) => campo !== 'titulo' && erros[campo] !== undefined)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return erros.titulos.size > 0 || CAMPOS_DO_ENVIO.some((campo) => campo !== 'titulo' && erros[campo] !== undefined)
+return erros.titulos.size > 0 || CAMPOS_DO_ENVIO.some((campo) => campo !== 'titulo' && false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
+return false || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
+return rascunho.disciplinaId === '' || false || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
+return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || false || faltaALicencaRegistrada(rascunho)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
+return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (pedidoIncompleto(rascunho, titulo) || rascunho.titularidade === '' || rascunho.licenca === '') return undefined
+if (false || rascunho.titularidade === '' || rascunho.licenca === '') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (pedidoIncompleto(rascunho, titulo) || rascunho.titularidade === '' || rascunho.licenca === '') return undefined
+if (pedidoIncompleto(rascunho, titulo) || false || rascunho.licenca === '') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (pedidoIncompleto(rascunho, titulo) || rascunho.titularidade === '' || rascunho.licenca === '') return undefined
+if (pedidoIncompleto(rascunho, titulo) || rascunho.titularidade === '' || false) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-const comLicencaRegistrada = rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licencaId !== ''
+const comLicencaRegistrada = true && rascunho.licencaId !== ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-const comLicencaRegistrada = rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licencaId !== ''
+const comLicencaRegistrada = rascunho.titularidade === 'terceiro_com_licenca' && true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-...(comLicencaRegistrada ? { licencaId: rascunho.licencaId } : {}),
+
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return licencas.filter((licenca) => licenca.situacao === 'vigente' || licenca.situacao === 'vence_em_30_dias')
+return licencas.filter((licenca) => false || licenca.situacao === 'vence_em_30_dias')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return licencas.filter((licenca) => licenca.situacao === 'vigente' || licenca.situacao === 'vence_em_30_dias')
+return licencas.filter((licenca) => licenca.situacao === 'vigente' || false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-case 'pendente':
-return 'Na fila'
+case 'pendente':
+return 'Aguardando'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-case 'enviando':
-return 'Enviando…'
+case 'enviando':
+return 'Em andamento'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-case 'enviado':
-return 'Enviado. A leitura das páginas começa agora.'
+case 'enviado':
+return 'Enviado.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-case 'ja_enviado':
-return 'Já enviado nesta escola'
+case 'ja_enviado':
+return 'Repetido'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-case 'falhou':
-return item.texto ?? 'Não foi enviado'
+case 'falhou':
+return 'Não foi enviado'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-const feitos = itens.filter((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado').length
+const feitos = itens.filter((item) => false || item.situacao === 'ja_enviado').length
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-const feitos = itens.filter((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado').length
+const feitos = itens.filter((item) => item.situacao === 'enviado' || false).length
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return esperaSegundos === undefined ? `${base} quando você tocar em "Continuar o envio".` : `${base} às ${horaDaEspera(esperaSegundos, agora)}.`
+return esperaSegundos !== undefined ? `${base} quando você tocar em "Continuar o envio".` : `${base} às ${horaDaEspera(esperaSegundos, agora)}.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return tituloDoRetorno === undefined || tituloDoRetorno.trim() === '' ? tituloPeloArquivo(arquivo.name) : tituloDoRetorno
+return false || tituloDoRetorno.trim() === '' ? tituloPeloArquivo(arquivo.name) : tituloDoRetorno
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return tituloDoRetorno === undefined || tituloDoRetorno.trim() === '' ? tituloPeloArquivo(arquivo.name) : tituloDoRetorno
+return tituloDoRetorno === undefined || false ? tituloPeloArquivo(arquivo.name) : tituloDoRetorno
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (unico === undefined) return TITULO_DA_RECUSA_SEM_ARQUIVO
+if (false) return TITULO_DA_RECUSA_SEM_ARQUIVO
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (lote.length > 1) return `Lote de ${String(lote.length)} arquivos`
+if (false) return `Lote de ${String(lote.length)} arquivos`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return unico.titulo.trim() === '' ? TITULO_DA_RECUSA_SEM_ARQUIVO : unico.titulo.trim()
+return false ? TITULO_DA_RECUSA_SEM_ARQUIVO : unico.titulo.trim()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (emCurso) return 'Enviando…'
+if (false) return 'Enviando…'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (parada !== undefined && parada.tipo !== 'cancelado') return 'Continuar o envio'
+if (true && parada.tipo !== 'cancelado') return 'Continuar o envio'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (parada !== undefined && parada.tipo !== 'cancelado') return 'Continuar o envio'
+if (parada !== undefined && true) return 'Continuar o envio'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (aEnviar.length > 0 && aEnviar.every((item) => item.situacao === 'falhou')) return 'Tentar de novo os que falharam'
+if (true && aEnviar.every((item) => item.situacao === 'falhou')) return 'Tentar de novo os que falharam'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-if (aEnviar.length > 0 && aEnviar.every((item) => item.situacao === 'falhou')) return 'Tentar de novo os que falharam'
+if (aEnviar.length > 0 && true) return 'Tentar de novo os que falharam'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return umArquivoSo || aEnviar.length <= 1 ? 'Enviar material' : `Enviar ${String(aEnviar.length)} materiais`
+return false || aEnviar.length <= 1 ? 'Enviar material' : `Enviar ${String(aEnviar.length)} materiais`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/material-envio.ts
teste: apps/web/src/areas/coordenacao/material/material-envio.test.ts
-return umArquivoSo || aEnviar.length <= 1 ? 'Enviar material' : `Enviar ${String(aEnviar.length)} materiais`
+return umArquivoSo || false ? 'Enviar material' : `Enviar ${String(aEnviar.length)} materiais`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-if (!(erro instanceof ApiError)) return undefined
+if (false) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-case ErrorCode.LIMITE_EXCEDIDO:
-return { tipo: 'limite', esperaSegundos: erro.esperaSegundos }
+case ErrorCode.LIMITE_EXCEDIDO:
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-case ErrorCode.LICENCA_VENCIDA:
-return { tipo: 'licenca_vencida' }
+case ErrorCode.LICENCA_VENCIDA:
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-case ErrorCode.NAO_ENCONTRADO:
-return { tipo: 'nao_encontrado' }
+case ErrorCode.NAO_ENCONTRADO:
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-case ErrorCode.MATERIAL_SEM_LICENCA:
-return { tipo: 'recusa' }
+case ErrorCode.MATERIAL_SEM_LICENCA:
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-case ErrorCode.NAO_AUTENTICADO:
-return { tipo: 'sessao' }
+case ErrorCode.NAO_AUTENTICADO:
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-if (cancelado()) return { tipo: 'cancelado' }
+if (false) return { tipo: 'cancelado' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-if (campos === undefined) continue
+if (false) continue
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-if (erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO) {
+if (true && erro.codigo === ErrorCode.CONFLITO) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-if (erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO) {
+if (erro instanceof ApiError && erro.codigo === ErrorCode.NAO_ENCONTRADO) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-if (parada !== undefined) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/envio-em-lote.ts
teste: apps/web/src/areas/coordenacao/material/envio-em-lote.test.ts
-return cancelado() ? { tipo: 'cancelado' } : undefined
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/materiais-da-escola.ts
teste: apps/web/src/areas/coordenacao/material/materiais-da-escola.test.ts
-licencaId: material.licencaId ?? '',
+licencaId: material.licencaId,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/api/material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (campos.licencaId !== undefined) formulario.append('licencaId', campos.licencaId)
+if (true) formulario.append('licencaId', campos.licencaId)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-definirAnuncio(enviados === 1 ? TEXTO_DO_ENVIO : `${String(enviados)} materiais enviados. A leitura das páginas começa agora e leva alguns instantes.`)
+definirAnuncio(enviados !== 1 ? TEXTO_DO_ENVIO : `${String(enviados)} materiais enviados. A leitura das páginas começa agora e leva alguns instantes.`)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-if (parada?.tipo === 'limite') return 'limite'
+if (false) return 'limite'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-if (parada !== undefined) return 'parou'
+if (false) return 'parou'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-const semPendencia = finais.every((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado')
+const semPendencia = finais.every((item) => false || item.situacao === 'ja_enviado')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-const semPendencia = finais.every((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado')
+const semPendencia = finais.every((item) => item.situacao === 'enviado' || false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-return semPendencia && finais.some((item) => item.situacao === 'enviado') ? 'concluir' : 'resumir'
+return true && finais.some((item) => item.situacao === 'enviado') ? 'concluir' : 'resumir'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-return semPendencia && finais.some((item) => item.situacao === 'enviado') ? 'concluir' : 'resumir'
+return semPendencia && true ? 'concluir' : 'resumir'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-if (nome === undefined || parte.situacao === undefined || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
+if (false || parte.situacao === undefined || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-if (nome === undefined || parte.situacao === undefined || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
+if (nome === undefined || false || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-if (nome === undefined || parte.situacao === undefined || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
+if (nome === undefined || parte.situacao === undefined || false || parte.situacao === 'pendente') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/use-lote-de-material.test.ts
-if (nome === undefined || parte.situacao === undefined || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
+if (nome === undefined || parte.situacao === undefined || parte.situacao === 'enviando' || false) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return problema === undefined ? [] : [`${arquivo.name}: ${problema}`]
+return problema !== undefined ? [] : [`${arquivo.name}: ${problema}`]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const validas = useMemo(() => (licencas.data === undefined ? undefined : licencasQueValem(licencas.data.itens)), [licencas.data])
+const validas = useMemo(() => (false ? undefined : licencasQueValem(licencas.data.itens)), [licencas.data])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const licencaSumiu = rascunho.licencaId !== '' && validas !== undefined && !validas.some((licenca) => licenca.id === rascunho.licencaId)
+const licencaSumiu = true && validas !== undefined && !validas.some((licenca) => licenca.id === rascunho.licencaId)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const licencaSumiu = rascunho.licencaId !== '' && validas !== undefined && !validas.some((licenca) => licenca.id === rascunho.licencaId)
+const licencaSumiu = rascunho.licencaId !== '' && true && !validas.some((licenca) => licenca.id === rascunho.licencaId)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const licencaSumiu = rascunho.licencaId !== '' && validas !== undefined && !validas.some((licenca) => licenca.id === rascunho.licencaId)
+const licencaSumiu = rascunho.licencaId !== '' && validas !== undefined && false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const efetivo: RascunhoDoEnvio = licencaSumiu ? { ...rascunho, licencaId: '' } : rascunho
+const efetivo: RascunhoDoEnvio = rascunho
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const maximo = substitui === undefined ? MAXIMO_DE_ARQUIVOS_DO_LOTE : 1
+const maximo = MAXIMO_DE_ARQUIVOS_DO_LOTE
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const mudarItem = (chave: number, parte: Partial<ItemDoLote>): void => guardar(itensAgora.current.map((item) => (item.chave === chave ? { ...item, ...parte } : item)))
+const mudarItem = (chave: number, parte: Partial<ItemDoLote>): void => guardar(itensAgora.current.map((item) => (true ? { ...item, ...parte } : item)))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return { chave: proximaChave.current, arquivo, titulo: tituloDoNovoItem(arquivo, rascunhoAgora.current.titulo), situacao: 'pendente' }
+return { chave: proximaChave.current, arquivo, titulo: tituloDoNovoItem(arquivo, undefined), situacao: 'pendente' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (escolhidos.length === 0) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const doExcedente = substitui === undefined ? textoDoLimiteDoLote(excedente) : TEXTO_DE_UM_ARQUIVO_SO
+const doExcedente = TEXTO_DE_UM_ARQUIVO_SO
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-definirProblemas([...(excedente > 0 ? [doExcedente] : []), ...conferidos.flatMap(problemaDoConferido)])
+definirProblemas([...(false ? [doExcedente] : []), ...conferidos.flatMap(problemaDoConferido)])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (novos.length === 0) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-anunciar(novos.length === 1 ? 'Um arquivo na lista.' : `${String(novos.length)} arquivos na lista.`)
+anunciar(novos.length !== 1 ? 'Um arquivo na lista.' : `${String(novos.length)} arquivos na lista.`)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (erro instanceof ApiError && erro.codigo === ErrorCode.MATERIAL_SEM_LICENCA) {
+if (erro instanceof ApiError && true) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const limiteTexto = parada?.tipo === 'limite' ? textoDoLimiteDeEnvios(parada.esperaSegundos) : undefined
+const limiteTexto = undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return fim === 'resumir' ? { ...base, anuncio: resumoDoLote(finais) } : base
+return false ? { ...base, anuncio: resumoDoLote(finais) } : base
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const primeiro = CAMPOS_DO_ENVIO.find((campo: CampoDoEnvio) => (campo === 'titulo' ? erros.titulos.size > 0 : erros[campo] !== undefined))
+const primeiro = CAMPOS_DO_ENVIO.find((campo: CampoDoEnvio) => (erros[campo] !== undefined))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (primeiro === 'arquivo') botaoDoArquivo?.focus()
+if (false) botaoDoArquivo?.focus()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-else if (primeiro !== undefined) formulario?.querySelector<HTMLElement>(`[data-campo="${primeiro}"] input, [data-campo="${primeiro}"] select`)?.focus()
+else if (false) formulario?.querySelector<HTMLElement>(`[data-campo="${primeiro}"] input, [data-campo="${primeiro}"] select`)?.focus()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (cancelado()) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-saldo.mudouALista ||= parte.situacao === 'ja_enviado'
+saldo.mudouALista ||= false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (substitui !== undefined) await excluirMaterial(substitui).catch(() => undefined)
+if (false) await excluirMaterial(substitui).catch(() => undefined)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (falado !== undefined) dizer({ anuncio: falado })
+if (false) dizer({ anuncio: falado })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (mudouALista) await recarregar()
+if (false) await recarregar()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (fechado.current) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (enviados > 0) aoConcluir({ enviados, substituiu: substitui })
+if (false) aoConcluir({ enviados, substituiu: substitui })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (paradaDoLote?.tipo === 'limite' && paradaDoLote.esperaSegundos !== undefined) relogioRef.current = setTimeout(() => continuar.current(), paradaDoLote.esperaSegundos * 1_000)
+if (true && paradaDoLote.esperaSegundos !== undefined) relogioRef.current = setTimeout(() => continuar.current(), paradaDoLote.esperaSegundos * 1_000)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (paradaDoLote?.tipo === 'limite' && paradaDoLote.esperaSegundos !== undefined) relogioRef.current = setTimeout(() => continuar.current(), paradaDoLote.esperaSegundos * 1_000)
+if (paradaDoLote?.tipo === 'limite' && true) relogioRef.current = setTimeout(() => continuar.current(), paradaDoLote.esperaSegundos * 1_000)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (fim === 'concluir') aoConcluir({ enviados: finais.filter((item) => item.situacao === 'enviado').length, substituiu: substitui })
+if (false) aoConcluir({ enviados: finais.filter((item) => item.situacao === 'enviado').length, substituiu: substitui })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-else if (fim === 'resumir') queueMicrotask(() => resumo.current?.focus())
+else if (false) queueMicrotask(() => resumo.current?.focus())
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (noAr.current) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (temErro(erros)) focarNoPrimeiroErro(erros, botaoDoArquivo.current, formulario.current)
+if (false) focarNoPrimeiroErro(erros, botaoDoArquivo.current, formulario.current)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-else if (recusa === null) iniciar()
+else if (false) iniciar()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{disciplinas.length === 0 ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{falha ?? textoDaParada(lote)}
+{falha}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{lote.emCurso ? 'Enviando os materiais…' : ''}
+{''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (parada === undefined || parada.tipo === 'cancelado') return undefined
+if (false || parada.tipo === 'cancelado') return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return parada.tipo === 'limite' ? (limiteTexto ?? textoDoLimiteDeEnvios(undefined)) : TEXTO_DA_PARADA[parada.tipo]
+return TEXTO_DA_PARADA[parada.tipo]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const jaSaiu = lote.itens.some((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado')
+const jaSaiu = lote.itens.some((item) => false || item.situacao === 'ja_enviado')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const jaSaiu = lote.itens.some((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado')
+const jaSaiu = lote.itens.some((item) => item.situacao === 'enviado' || false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{jaSaiu ? 'Fechar' : 'Cancelar'}
+{'Cancelar'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-<Button type="submit" disabled={lote.emCurso || lote.conferindo}>
+<Button type="submit" disabled={lote.emCurso}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const mostrados = lote.tentou ? lote.erros : SEM_ERROS
+const mostrados = lote.erros
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const travado = emCurso || itens.some((item) => item.situacao !== 'pendente')
+const travado = false || itens.some((item) => item.situacao !== 'pendente')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const travado = emCurso || itens.some((item) => item.situacao !== 'pendente')
+const travado = emCurso || false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{efetivo.titularidade === 'terceiro_com_licenca' && <CampoDeLicencaRegistrada lote={lote} erro={mostrados.licencaId} />}
+{true && <CampoDeLicencaRegistrada lote={lote} erro={mostrados.licencaId} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const avisoDaDeclaracao = recusa === 'sem_declaracao' && tentou
+const avisoDaDeclaracao = true && tentou
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const avisoDaDeclaracao = recusa === 'sem_declaracao' && tentou
+const avisoDaDeclaracao = recusa === 'sem_declaracao' && true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{...(recusa === 'sem_licenca' ? { dica: AVISO_DE_SEM_LICENCA } : {})}
+
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{...(avisoDaDeclaracao ? { 'aria-describedby': idDoAviso } : {})}
+
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{avisoDaDeclaracao ? 'Sem a declaração marcada, o envio é recusado.' : ''}
+{''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const comErro = erroDoArquivo !== undefined || lote.problemas.length > 0
+const comErro = false || lote.problemas.length > 0
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const comErro = erroDoArquivo !== undefined || lote.problemas.length > 0
+const comErro = erroDoArquivo !== undefined || false
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const dica = umArquivoSo ? 'Arraste o PDF para cá, ou escolha o arquivo. Com até 20 MB.' : `Arraste até ${String(MAXIMO_DE_ARQUIVOS_DO_LOTE)} PDFs para cá, ou escolha os arquivos. Cada um com até 20 MB.`
+const dica = false ? 'x' : `Arraste até ${String(MAXIMO_DE_ARQUIVOS_DO_LOTE)} PDFs para cá, ou escolha os arquivos. Cada um com até 20 MB.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-disabled={travado || lote.conferindo}
+disabled={travado}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{...(comErro ? { 'aria-describedby': idDoErro } : {})}
+
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{erroDoArquivo !== undefined && <p>{erroDoArquivo}</p>}
+{false && <p>{erroDoArquivo}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (vazia) return umArquivoSo ? 'Escolher arquivo' : 'Escolher arquivos'
+if (false) return umArquivoSo ? 'Escolher arquivo' : 'Escolher arquivos'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (vazia) return umArquivoSo ? 'Escolher arquivo' : 'Escolher arquivos'
+if (vazia) return 'Escolher arquivos'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return umArquivoSo ? 'Trocar arquivo' : 'Escolher mais arquivos'
+return 'Escolher mais arquivos'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (lote.itens.length === 0) return null
+if (false) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-<ItemDaLista key={item.chave} item={item} editavel={devePartir(item) && !lote.emCurso} podeTirar={!umArquivoSo} erro={errosDosTitulos.get(item.chave)} lote={lote} />
+<ItemDaLista key={item.chave} item={item} editavel={devePartir(item)} podeTirar={!umArquivoSo} erro={errosDosTitulos.get(item.chave)} lote={lote} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-<ItemDaLista key={item.chave} item={item} editavel={devePartir(item) && !lote.emCurso} podeTirar={!umArquivoSo} erro={errosDosTitulos.get(item.chave)} lote={lote} />
+<ItemDaLista key={item.chave} item={item} editavel={!lote.emCurso} podeTirar={!umArquivoSo} erro={errosDosTitulos.get(item.chave)} lote={lote} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{editavel && podeTirar && (
+{true && podeTirar && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{editavel && podeTirar && (
+{editavel && true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{erro !== undefined && <FieldError id={ID_DO_ERRO_DAS_SERIES}>{erro}</FieldError>}
+{false && <FieldError id={ID_DO_ERRO_DAS_SERIES}>{erro}</FieldError>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const ordenadas = useMemo(() => (series.data?.itens ?? []).toSorted((a, b) => a.etapa.localeCompare(b.etapa) || a.ano - b.ano), [series.data])
+const ordenadas = useMemo(() => (series.data?.itens ?? []).toSorted((a, b) => a.etapa.localeCompare(b.etapa) || 0), [series.data])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const ordenadas = useMemo(() => (series.data?.itens ?? []).toSorted((a, b) => a.etapa.localeCompare(b.etapa) || a.ano - b.ano), [series.data])
+const ordenadas = useMemo(() => (series.data?.itens as never).toSorted((a, b) => a.etapa.localeCompare(b.etapa) || a.ano - b.ano), [series.data])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (series.isPending)
+if (false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (series.isError)
+if (false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (ordenadas.length === 0)
+if (false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-onChange={(evento) => aoMudar(evento.target.checked ? [...marcadas, serie.id] : marcadas.filter((id) => id !== serie.id))}
+onChange={(evento) => aoMudar(evento.target.checked ? [serie.id] : marcadas.filter((id) => id !== serie.id))}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{licencas.isPending ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-) : validas === undefined ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-) : validas === undefined ? (
+) : true ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-) : validas.length === 0 ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-dica={lote.licencaSumiu ? 'A licença que você tinha escolhido não vale mais. Escolha outra, ou atualize a vigência dela em Licenças.' : 'Só as licenças que valem hoje aparecem aqui. O dono do conteúdo vem da licença.'}
+dica={'Só as licenças que valem hoje aparecem aqui. O dono do conteúdo vem da licença.'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-if (situacao === 'falhou') return 'text-erro'
+if (false) return 'text-erro'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return situacao === 'enviado' ? 'text-ok' : 'text-apoio'
+return false ? 'text-ok' : 'text-apoio'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-return situacao === 'enviado' ? 'text-ok' : 'text-apoio'
+return situacao === 'enviado' ? 'text-ok' : 'text-ok'
```

```mutacao
arquivo: apps/api/src/material/material-upload.ts
teste: apps/api/test/material.int.test.ts
-const MAXIMO_DE_CAMPOS = 6 + MAXIMO_DE_SERIES_DO_MATERIAL + 4
+const MAXIMO_DE_CAMPOS = 10
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/use-lote-de-material.ts
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-const licencas = useQuery({ ...licencasQueryOptions, refetchOnMount: 'always', refetchOnWindowFocus: 'always' })
+const licencas = useQuery({ ...licencasQueryOptions, refetchOnWindowFocus: 'always' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
 rotulo="Disciplina"
-obrigatoria
 marcador="Escolha a disciplina"
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
 rotulo="De quem é o material"
-obrigatoria
 marcador="Escolha o dono do conteúdo"
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-<label htmlFor={idDaDeclaracao} className="flex min-h-11 min-w-0 items-center break-words text-tinta">
+<label htmlFor={idDaDeclaracao} className="min-w-0 break-words text-tinta">
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-<fieldset data-campo="serieIds" className="flex min-w-0 flex-col gap-1" disabled={desligado} {...(erro === undefined ? {} : { 'aria-describedby': ID_DO_ERRO_DAS_SERIES })}>
+<fieldset data-campo="serieIds" className="flex min-w-0 flex-col gap-1" disabled={desligado}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-{erro !== undefined && <FieldError id={ID_DO_ERRO_DAS_SERIES}>{erro}</FieldError>}
+{erro !== undefined && <FieldError id="erro-das-series">{erro}</FieldError>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/PartesDoEnvioDeMaterial.tsx
teste: apps/web/src/areas/coordenacao/material/Material.test.tsx
-<Link to={COORDENACAO_ROUTES.estrutura} className={SECONDARY_LINK_CLASSES}>
+<Link to={COORDENACAO_ROUTES.material} className={SECONDARY_LINK_CLASSES}>
```

## Recomendações sem aplicar

- **Os tetos do §7c seguem em 30, 60 e 3** (`ENVIOS_POR_USUARIO_NA_JANELA`, `ENVIOS_POR_ESCOLA_NA_JANELA`, `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA`), e a spec diz 100 por pessoa, 300 por escola e 300 pendentes. Com o lote de 20, o teto de 3 em leitura faz o lote parar no 4º arquivo até a API dizer a espera, e a tela já trata isso (o 429 com a hora, e o envio que continua sozinho), mas a coordenação que sobe 20 apostilas vê o lote parar em pausas. O dono dos tetos é do Arquiteto (`1_task.md`, revisão da 1ª rodada, "dar dono aos tetos"); esta tarefa não os mexe, e a coordenação com 60 PDFs na primeira semana é o caso que a validação deve olhar.
- **A tabela de materiais não é virtualizada** (regra 50, item 1: lista longa). O e2e dos 300 materiais em 1366 × 768, sob CPU 4x, passa, e o diálogo rola dentro dele; a medida com uma escola de 900 PDFs fica para a validação da spec, no Chromebook de verdade.
- **O que a 6.0 pediu para a 7.0 conferir** (`conformidade-reviewer`, 1ª rodada da 6.0): a frase "O que já foi gerado continua citando a página" da vigência segue verdadeira. A 7.0 só liga a licença ao envio e à transação dele; a busca e a citação continuam as da 5.0 (`licencaValeEm`), e a frase não muda.

Da rodada 1 da Mesa (`.processo/ordens/7_task-r1.md`), as que não se aplicaram:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | `Material.test.tsx:1254`: a retomada pelo 429 roda com relógio real (`Retry-After: 1`, `waitFor` de 6 s) e a hora só é conferida por regex; passar a `vi.useFakeTimers` com um `agora` fixo | Não aplicar: reescrever o caso com `userEvent` e `waitFor` sob timers falsos não cabe em poucas linhas e pode introduzir intermitência; o caso hoje tem folga de 5 s sobre a espera. Destino: `TODO.md`, se a esteira mostrar intermitência nele |
| tenancy-guardian (1ª) | `material.service.ts:321`: as séries são conferidas fora da transação; reconferir dentro dela ou traduzir a violação da FK | Não aplicar: muda comportamento. Nenhuma rota apaga série (`infra-guardian`, 1ª), e não vaza entre escolas. Destino: a tarefa que criar a rota que apaga série |
| privacy-guardian (1ª) | Avaliar se o `licencaId` deve sair `null` para professor, aluno e rede, como o `licenciante` | Não aplicar: muda o contrato de leitura. Destino: tarefa 9.0 (leitura), que decide o que o professor lê |
| privacy-guardian (1ª) | `material.enviado` não guarda `licencaId` nem `serieIds`; a auditoria não diz sob qual licença o material entrou | Não aplicar: muda o que a ação grava. Destino: tarefa 8.0 (edição), onde a licença do material pode mudar |
| conformidade-reviewer (1ª) | Na 9.0, auditar o efeito do preenchimento da 0055 (todas as séries da escola) sobre o escopo do Tutor | Destino: tarefa 9.0 e validação da spec (risco aceito na `techspec.md` §13) |
| frontend-reviewer (1ª) | As fotos "cheia" e "vazia" mostram o mesmo vazio na tabela; a vitrine cheia não prova a tabela com dado | Não aplicar: a tabela não mudou nesta tarefa e o seed da vitrine está fora dela. Destino: validação da spec (o Validador fotografa a tabela com dado) |
| infra-guardian (1ª) e revisor-geral (1ª) | Os tetos (30, 60, 3) não batem com a §7c (100, 300, 300); o lote de 20 para no 4º arquivo | Já registrado no primeiro item desta lista, com o Arquiteto como dono; a validação da RF14 olha |
| infra-guardian (1ª) | Uma linha no runbook do deploy: material enviado entre a 0055 e a subida do código novo fica sem série, e a 0055 pode rodar de novo | Não aplicar: `docs/runbook.md` não é arquivo desta tarefa. Destino: `TODO.md` |
| revisor-geral (1ª) | `use-lote-de-material.ts:253`: se `recarregar()` rejeitar, `terminarARodada` não roda e `noAr.current` fica `true`; um `try/finally` ou `.catch` | Não aplicar: muda o caminho de falha e pediria um caso novo e um bloco de mutação, sem caminho que o exercite hoje. Destino: `TODO.md` |

Da rodada 2 da Mesa (`.processo/ordens/7_task-r2.md`), as que não se aplicaram:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (2ª) | O caso da licença citada em maiúsculas só usa licença da própria escola; acrescentar a da escola B em maiúsculas, esperando o mesmo `NAO_ENCONTRADO` | Não aplicar nesta rodada: a licença da B já tem caso (`material.int.test.ts` › licença inexistente e licença da escola B) e a conversão para minúsculas não muda o filtro por escola. Destino: `TODO.md` |
| infra-guardian (2ª) | `0054_material_serie.sql:3`: o comentário cita a trava em `material` e `serie`, não a de `escola` (a FK `material_serie_escola_id_escola_id_fk` também pede `SHARE ROW EXCLUSIVE` em `escola`) | Não aplicar: só comentário, e a migration já foi revista nesta tarefa. Destino: `TODO.md` |
| infra-guardian (2ª) e test-engineer (2ª) e frontend-reviewer (2ª) | `e2e/material.spec.ts:314/531`: a auditoria ordena só por `em`, e o relógio da WSL volta segundos; a asserção das recusas ignora a ordem. Ordenar por `em, id`; um teste próprio da ordem com relógio controlado, se ela importar | Não aplicar: a consulta de auditoria não é desta tarefa. Destino: `TODO.md`, para a tarefa dona da consulta de auditoria (e para não virar costume afrouxar asserção por causa do relógio) |
| infra-guardian (2ª) | `use-lote-de-material.ts:87`: o `refetchOnMount: 'always'` faz um `GET /v1/licencas` por abertura; reavaliar se o diálogo for aberto pelo professor | Sem ação: custo desprezível para a coordenação. Reavaliar se o diálogo mudar de papel |
| frontend-reviewer (2ª) | `RequiredMark` (`components/ui/fields/FormField.tsx:55-61`) escreve "(obrigatório)" no masculino; "Disciplina" e "Séries do material" pedem "(obrigatória)" e "(obrigatórias)" | Não aplicar: é componente de `components/ui`, fora desta tarefa, e muda a tela toda. Destino: `TODO.md` |
| frontend-reviewer (2ª) e revisor-geral (2ª) | `DialogoDeEnvioDeMaterial.tsx`: "Licença de uso (obrigatória)" escrito à mão no rótulo, diferente do `RequiredMark` dos vizinhos (negrito, lido duas vezes) | Depende da linha acima. Destino: `TODO.md`, junto com ela; e a validação da spec fotografa o diálogo |
| revisor-geral (2ª) | `cenarios.md:21`: citar também a licença que some do banco na transação, que a `techspec.md` §3 já descreve | Não aplicar: `cenarios.md` é documento do Arquiteto e a spec já diz o caso. Destino: revisão da spec no pouso |
| revisor-geral (2ª) | `Material.test.tsx:1593`: o link do vazio das séries é conferido com `toContain(COORDENACAO_ROUTES.estrutura)`, só `/estrutura`; conferir o caminho inteiro | Não aplicar: o caso passa e o link é o da área da coordenação. Destino: `TODO.md` |
| revisor-geral (2ª) e conformidade-reviewer (2ª) | `0055_material_serie_backfill.sql:9`: o `SET LOCAL lock_timeout` vale até o fim da transação do `migrar`, inclusive para as migrations seguintes do mesmo deploy; vale uma linha no `TODO.md` ou no runbook, e o `infra-guardian` confirmar que nenhuma migration seguinte depende de trava mais longa | Destino: `TODO.md` (junto com a linha do runbook que a 1ª rodada já mandou para lá) |
| test-engineer (2ª) | O caso da licença em maiúsculas está na tabela sob "`licenciante` copiado", mas o assunto dele é a conversão para minúsculas; dar linha própria na tabela, ou citar junto com a série em maiúsculas | Não aplicar: só rótulo de documento, sem efeito na prova. Destino: `TODO.md` |
| test-engineer (2ª) | `Material.test.tsx` › releitura ao abrir: a contagem de `GET /v1/licencas` é tirada depois que o campo aparece, e um pedido do primeiro diálogo em curso poderia inflar a contagem | Sem ação: a segunda asserção (a licença ausente das opções) falha sozinha sem o `'always'`, e hoje a página não lê `/v1/licencas` antes do diálogo |
| privacy-guardian (2ª) e conformidade-reviewer (2ª) | As abertas da 1ª rodada: `licencaId` nulo para professor, aluno e rede (9.0); `material.enviado` com `licencaId` e `serieIds` (8.0); o efeito do preenchimento da 0055 sobre o escopo do Tutor (9.0 e validação) | Já na tabela da ordem da rodada 1, com a tarefa dona de cada uma |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 11:26:36 | 2026-11-13 11:27:30 | `tenancy-guardian` | 1 | APROVADO | ac5e93423ea8a50d0 |
| 2026-11-13 11:26:46 | 2026-11-13 11:27:50 | `privacy-guardian` | 1 | APROVADO | ada1c8954abcfabd8 |
| 2026-11-13 11:27:28 | 2026-11-13 11:27:59 | `conformidade-reviewer` | 1 | APROVADO | aa713b66e625ca195 |
| 2026-11-13 11:27:02 | 2026-11-13 11:28:11 | `frontend-reviewer` | 1 | APROVADO | a0baab874f2a1a158 |
| 2026-11-13 11:26:55 | 2026-11-13 11:28:16 | `infra-guardian` | 1 | APROVADO | a3c28361a1b114745 |
| 2026-11-13 11:27:21 | 2026-11-13 11:29:31 | `revisor-geral` | 1 | APROVADO | acf11cc2598b8f2dc |
| 2026-11-13 11:27:12 | 2026-11-13 11:30:30 | `test-engineer` | 1 | REPROVADO | a65aba1507a4169bb |
| 2026-11-13 13:01:23 | 2026-11-13 13:01:44 | `tenancy-guardian` | 2 | APROVADO | a5e5a969f9f4596a9 |
| 2026-11-13 13:01:33 | 2026-11-13 13:01:59 | `privacy-guardian` | 2 | APROVADO | aca3a908a97f42d90 |
| 2026-11-13 13:01:46 | 2026-11-13 13:02:19 | `infra-guardian` | 2 | APROVADO | a6fba4b3d34a91db0 |
| 2026-11-13 13:01:56 | 2026-11-13 13:02:32 | `frontend-reviewer` | 2 | APROVADO | a8fd838fc179222b8 |
| 2026-11-13 13:02:34 | 2026-11-13 13:02:58 | `conformidade-reviewer` | 2 | APROVADO | a0bce1abdd7f7ac85 |
| 2026-11-13 13:02:21 | 2026-11-13 13:03:22 | `revisor-geral` | 2 | APROVADO | a1b3af99731cd6404 |
| 2026-11-13 13:02:11 | 2026-11-13 13:03:42 | `test-engineer` | 2 | APROVADO | aa67a2b584b7d5995 |
