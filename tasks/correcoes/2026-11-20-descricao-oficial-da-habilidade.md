# Correção — a descrição da habilidade gravada na questão é a do modelo, sem conferência contra `habilidade_bncc`, e aparece no artefato e no diagnóstico como texto da BNCC

**Origem:** `tasks/prd-classificacao-bncc/validacao.md`, seção 4, achado maior 2 (validação da classificacao-bncc, APROVADA COM RESSALVAS). O Joaquim mandou corrigir em 20/11/2026; o pedido do Orquestrador diz para ler a tabela pelo `BnccRepository` da ressalva 1.
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no pedido do Orquestrador. `revisor-geral` entra porque a correção passa de 5 arquivos fora de `tasks/` (a conferência, os dois repositories do diagnóstico, o `BnccRepository`, os testes). -->

## Sintoma

`problemasDasQuestoes` (`packages/core/src/ia/tasks/gerar-atividade-objetiva.ts`) e `anularHabilidadesForaDaSecao` (`apps/api/src/artefato/conferencia.ts`) comparam só o `codigo` da habilidade. A questão com `EM13CNT203` e a descrição "Calcular quantidades em reações químicas (texto inventado pelo modelo)" passa pela conferência, não é anulada e é gravada assim. Essa descrição aparece na tela do artefato ("Habilidade EM13CNT203: …"), e o diagnóstico a usa como texto da habilidade: `DesempenhoRepository.descricoesDasHabilidades` e `AnalistaRepository.descricoesDasHabilidades` leem `questao -> 'habilidade' ->> 'descricao'` do conteúdo. Em Turmas e no Analista, a escola veria uma paráfrase da IA rotulada como habilidade da BNCC, que é o que o PRD (§1) quer acabar. O **código**, que é o que o diagnóstico conta, está certo.

## Fora desta correção

nada da árvore em curso. Do alcance, o que **fica de fora de propósito** (Mesa 2, rodada 1, item 2, opção b): o **resultado do aluno** (`MinhaAtividadeService.meuDiagnostico`), a **memória do Tutor** (`tutor/turno.command.ts`), o **relatório da correção** (`relatorio-da-correcao.ts`) e o **PDF do artefato** (`pdf-do-artefato.ts`) seguem lendo a descrição do conteúdo gravado: o que os protege é a gravação corrigida (todo artefato novo traz o texto oficial). O artefato anterior à spec traz o código do antigo catálogo (`QUI.EM.*`), que não é texto da BNCC, e antes do pouso não há artefato com código da BNCC e a paráfrase do modelo fora dos ambientes de teste. Reler a tabela nesses quatro leitores é outro trabalho, em `TODO.md`. As sementes do e2e do aluno (`e2e/support/atividade-db.ts`) seguem como estão, porque a tela do aluno lê o conteúdo gravado.

## Causa

A 10.0 passou a conferir o **código** contra a seção da página citada (`anularHabilidadesForaDaSecao`), e a descrição seguiu como o modelo a devolveu: o contrato da tarefa pede `{ codigo, descricao }` e a conferência nunca a comparou com a da tabela que o próprio trecho entregue já carrega (`TrechoComHabilidades.habilidades`, o texto de `habilidade_bncc` cortado por `descricaoParaOModelo`). O diagnóstico (13.0 e anteriores) lia a descrição do conteúdo gravado porque, no catálogo antigo, "o catálogo é nosso, em código"; com a BNCC na tabela, isso passou a ler texto do modelo. A troca da habilidade (RF9) já relia a descrição da tabela, por isso só a gravação e o diagnóstico estavam errados.

## Teste que reproduz

- `apps/api/src/artefato/conferencia.test.ts` › `anularHabilidadesForaDaSecao`: a questão e o plano que chegam com o código certo e a descrição do modelo saem com a descrição do trecho entregue (vermelho: saem com a do modelo).
- `apps/api/test/geracao-pela-secao.int.test.ts`: a atividade e o plano gerados com descrição inventada gravam a oficial de `habilidade_bncc`.
- `apps/api/src/governanca/analista.int.test.ts` › `a descrição da habilidade no diagnóstico`: o artefato gravado **antes** da correção, com descrição divergente, aparece no diagnóstico com a de `habilidade_bncc` (vermelho: aparece a do conteúdo), no Analista, na leitura da turma, na rota do desempenho e no dado nominal.
- `apps/api/src/governanca/analista.int.test.ts` › `o texto gravado do código que a tabela não tem`: duas escolas gravam `QUI.EM.05` com textos diferentes, e cada uma lê o seu (cai sem o escopo de escola e ano do repository).
- `e2e/analista.spec.ts` e `e2e/support/governanca.ts`: a semente do Analista grava códigos reais (`EM13CNT105` e `EM13CNT103`) com a descrição oficial da carga, e o alerta espera esse texto.
- `apps/api/src/material/habilidades-do-recorte.test.ts`: o texto do diagnóstico vem da tabela, cortado, e o código que a tabela não tem fica com o gravado.
- `packages/core/src/bncc/bncc.repository.int.test.ts`: a leitura por vários códigos, inclusive a lista vazia (`codigos: []` devolve `[]`, o que o caso afirma no próprio repository, e a mutação `return undefined` o derruba).

## Correção

Duas partes, as duas do que a validação pediu:

- **Gravação** (`anularHabilidadesForaDaSecao`, `apps/api/src/artefato/conferencia.ts`): a habilidade que fica (da seção da página citada) é gravada com o `codigo` e a `descricao` **do trecho entregue**, que é o texto de `habilidade_bncc` já no tamanho do contrato (`descricaoParaOModelo`), e não com a que o modelo escreveu. Vale para a questão e para a lista do plano. Não há leitura nova do banco: o trecho já a trouxe, e a troca da habilidade (RF9) já relia a tabela.
- **Diagnóstico** (`DesempenhoRepository.descricoesDasHabilidades` e `AnalistaRepository.descricoesDasHabilidades`): depois de ler os códigos do conteúdo, a descrição vem de `habilidade_bncc` pelo código, lida pelo `BnccRepository` da ressalva 1 (que ganhou o filtro `codigos`; continua um só `@Unscoped`), no tamanho do contrato (`descricoesDoDiagnostico`, em `apps/api/src/material/habilidades-do-recorte.ts`, que não toca o banco). Isso corrige também, em Turmas e no Analista, o artefato **já gravado** com a paráfrase do modelo, que a gravação nova não alcança. O código que a tabela não tem (o do antigo catálogo, `QUI.EM.*`, que era nosso) segue com o texto gravado, o único que existe para ele.
- **Testes:** o fixture `HABILIDADE_DAS_TRES_PRIMEIRAS` e `HABILIDADE_DAS_DUAS_ULTIMAS` (`apps/api/test/atividade.fixture.ts`) usava códigos reais com descrição inventada; passa a trazer o texto oficial da carga `dados-2026.08`, que é o que a gravação grava agora. Registro na Tech Spec, seção 5, "Geração".

## Mutações

--faltando: 0 linhas (12 blocos, 0 motivos)

A gravação: a descrição que fica é a do trecho entregue (a da tabela), e não a do modelo, na questão e no plano.

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão sem habilidade não conta como anulada, e a página sem seção anula a que o modelo pôs
-      if (habilidade === null) return questao
+      if (habilidade === null) { anuladas += 1; return questao }
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão com o código certo e a descrição do modelo sai com a descrição da tabela, a do trecho entregue, e isso não conta como anulada
-      if (oficial !== undefined) return { ...questao, habilidade: { codigo: oficial.codigo, descricao: oficial.descricao } }
+      if (oficial !== undefined) return { ...questao, habilidade: { codigo: oficial.codigo, descricao: habilidade.descricao } }
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › a questão com a habilidade da seção da página que cita fica como está
-      if (oficial !== undefined) return { ...questao, habilidade: { codigo: oficial.codigo, descricao: oficial.descricao } }
+      if (oficial === undefined) return { ...questao, habilidade: { codigo: habilidade.codigo, descricao: habilidade.descricao } }
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › o plano guarda só a união das seções que cita
-    return oficial === undefined ? [] : [{ codigo: oficial.codigo, descricao: oficial.descricao }]
+    return oficial === undefined ? [habilidade] : [{ codigo: oficial.codigo, descricao: oficial.descricao }]
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/conferencia.test.ts › o plano que cita o capítulo 7 com o código certo e a descrição do modelo guarda a da tabela
-    return oficial === undefined ? [] : [{ codigo: oficial.codigo, descricao: oficial.descricao }]
+    return oficial === undefined ? [] : [{ codigo: oficial.codigo, descricao: habilidade.descricao }]
```

O diagnóstico: o texto vem da tabela, cortado no tamanho do contrato; o código que a tabela não tem fica com o gravado; sem código gravado a tabela nem é lida.

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › sem habilidade gravada, a tabela nem é consultada
-  if (gravadas.size === 0) return new Map()
+  if (false) return new Map()
```

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › o código que a tabela não tem, o do antigo catálogo, segue com o texto gravado
-  const descricoes = new Map(gravadas)
+  const descricoes = new Map<string, string>()
```

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › vai cortado no tamanho do contrato, como o que a gravação guarda
-  for (const oficial of oficiais) descricoes.set(oficial.codigo, descricaoParaOModelo(oficial.descricao))
+  for (const oficial of oficiais) descricoes.set(oficial.codigo, oficial.descricao)
```

```mutacao
arquivo: apps/api/src/material/habilidades-do-recorte.ts
teste: apps/api/src/material/habilidades-do-recorte.test.ts › é o da tabela, pelos códigos gravados, e vence o que o conteúdo da questão guardava
-  for (const oficial of oficiais) descricoes.set(oficial.codigo, descricaoParaOModelo(oficial.descricao))
+  for (const oficial of oficiais.slice(0, 0)) descricoes.set(oficial.codigo, descricaoParaOModelo(oficial.descricao))
```

Os dois repositories do diagnóstico leem a descrição da tabela, e não a do conteúdo.

```mutacao
arquivo: apps/api/src/atividade/desempenho/desempenho.repository.ts
teste: apps/api/src/governanca/analista.int.test.ts › é a de `habilidade_bncc`, pelo código, mesmo que o artefato gravado traga a do modelo: no Analista, na leitura da turma, na rota do desempenho e no dado nominal
-    return descricoesDoDiagnostico(new BnccRepository(this.banco), descricoes)
+    return descricoes
```

```mutacao
arquivo: apps/api/src/governanca/analista.repository.ts
teste: apps/api/src/governanca/analista.int.test.ts › é a de `habilidade_bncc`, pelo código, mesmo que o artefato gravado traga a do modelo: no Analista, na leitura da turma, na rota do desempenho e no dado nominal
-    return descricoesDoDiagnostico(new BnccRepository(this.banco), descricoes)
+    return descricoes
```

A leitura por vários códigos do `BnccRepository`.

```mutacao
arquivo: packages/core/src/bncc/bncc.repository.ts
teste: packages/core/src/bncc/bncc.repository.int.test.ts › por vários códigos: só os pedidos, na ordem do código, e o que a tabela não tem fica de fora
-  if ('codigos' in filtro) return inArray(habilidadeBncc.codigo, [...filtro.codigos])
+  if ('codigos' in filtro) return undefined
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 19:19:56 | 2026-11-20 19:20:18 | `infra-guardian` | 1 | APROVADO | ac5f6630688938920 |
| 2026-11-20 19:19:51 | 2026-11-20 19:20:18 | `privacy-guardian` | 1 | APROVADO | a42088ff68839b089 |
| 2026-11-20 19:19:49 | 2026-11-20 19:20:20 | `tenancy-guardian` | 1 | APROVADO | a0dbdf0b7a21538b6 |
| 2026-11-20 19:19:59 | 2026-11-20 19:20:23 | `llm-integrator` | 1 | APROVADO | a60aed8f128838a1a |
| 2026-11-20 19:19:54 | 2026-11-20 19:20:28 | `conformidade-reviewer` | 1 | APROVADO | a7f6f3bd0958f53e4 |
| 2026-11-20 19:20:01 | 2026-11-20 19:23:42 | `test-engineer` | 1 | REPROVADO | abfa3d323af695c80 |
| 2026-11-20 19:20:04 | 2026-11-20 19:23:50 | `revisor-geral` | 1 | REPROVADO | acab36bec955ab75d |
| 2026-11-20 19:38:12 | 2026-11-20 19:39:05 | `test-engineer` | 2 | APROVADO | a9ab4cd489751ba47 |
| 2026-11-20 19:38:24 | 2026-11-20 19:39:34 | `revisor-geral` | 2 | APROVADO | a66084704d3b4211a |
