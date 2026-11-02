# Correção — a guarda do RF8 não recusa `Agendador…` nem as formas do inventário §1 que valem

**Origem:** `validacao.md` de nomes-de-mercado (`tasks/prd-nomes-de-mercado/validacao.md`), seção 4, Crítico 1, opção (a); pedido do Orquestrador.
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
<!-- O PEDIDO do Orquestrador dizia só `test-engineer` e `revisor-geral`; os quatro guardiões entram porque a Mesa conferiu a linha contra os arquivos alterados (`tools/guardas/` e `apps/despachante/`). -->

## Sintoma

`class AgendadorDeX {}` em `apps/api/src/ia/x.ts` passa sem mensagem, e o RF8 (`prd.md:80`) e o "Pronto quando" do `ROADMAP.md`
citam `Agendador…` pelo nome. Passam também `class ProcessadorX`, `class ExecutorDeX`, `class ExecutorDeJobs`, `const METADADO_X`,
`const CHAVE_X` (em `apps/web`) e o arquivo `material-de-teste.ts`, que estão na coluna da esquerda do `inventario.md` §1, a que o próprio
inventário diz que a guarda usa.

## Fora desta correção

Nada: não há tarefa em curso.

## Causa

A 12.0 montou a `FORMAS` e os `SEGMENTOS` com as formas que o rename deixou na árvore, e não com a coluna inteira do §1. Seis formas ficaram
de fora sem registro do porquê (a `guarda.md` só justificava `Pedido…` e `Resposta…`): `Agendador`, `Processador`, `Executor`, `METADADO_`,
`CHAVE_` e o segmento `*-de-teste`. `Consulta<X>` e `Agendamento` também ficaram de fora, mas por colisão, e agora com o motivo escrito.

## Teste que reproduz

`tools/guardas/guardas.test.ts`, describe "guarda de nome de mercado":

- "recusa cada forma … em %s" (fixture `nome-recusado.ts`, com as classes e a constante novas) e a linha nova de `nome-so-na-web.ts` (`CHAVE_`);
- `CASOS`: um por linha nova da `FORMAS` (a mensagem dá `XScheduler`, `XProcessor`, `XExecutor`, `JobProcessor`, `JobExecutor`, `X_KEY`, `X_QUERY_KEY`);
- "cada linha da gramática é exercida por ao menos um caso";
- o arquivo `material-de-teste.ts` e a pasta `material-de-teste/` recusados, com `material.fixture` na mensagem;
- passam: `function AgendadorX`, `Agendadores`, `Processadores`, `METADADOS_X`, `CHAVE_X` fora de `apps/web`, `Agendamento`, `ConsultaX`, `material-de-testes.ts`;
- a exceção nominal `CHAVE_CHEIO_NAS_CLASSES` tem alvo.

Vermelho antes: os casos novos falham com a `FORMAS` de `984cf26f`. Verde depois.

## Correção

`tools/guardas/nomes-de-mercado.mjs`:

| Forma | Casa | Vale em | Nome de mercado |
|---|---|---|---|
| `Agendador` (e `AgendadorDe`) | prefixo | classe | `{X}Scheduler` |
| `Processador` (e `ProcessadorDe`) | exato / prefixo | classe | `JobProcessor` / `{X}Processor` |
| `ExecutorDeJobs` / `ExecutorDe` / `Executor` | exato / prefixo | classe | `JobExecutor` / `{X}Executor` |
| `METADADO_` | prefixo | const | `{X}_KEY` |
| `CHAVE_` | prefixo | const, só em `apps/web/**` | `{X}_QUERY_KEY` |
| segmento `*-de-teste` | arquivo e pasta | todo o escopo | `{x}.fixture` |

O que fica de fora, com o motivo, em `guarda.md` (seção "O que fica fora da lista, e por quê"): `Consulta<X>` (colide com `ConsultaComPrazoDoCliente`,
`ConsultaDoReact` e com "consulta" de domínio; a guarda não distingue o DTO HTTP), `Agendamento` (palavra de domínio) e o `CHAVE_` fora de `apps/web`
(`CHAVE_DA_TRAVA_*`, chave de lock). Colisões que a lista nova achou na árvore: `ProcessadorContado`
(`apps/despachante/test/slots.int.test.ts`) vira `CountingProcessor`, e `CHAVE_CHEIO_NAS_CLASSES` (`apps/web/src/__fixtures__/danger-solid.ts`, a chave
`cheio` de uma regex, e não uma chave de consulta) entra como exceção nominal.

## Mutações

Código de `tools/` não exige o bloco (RF17 é de `apps/*/src` e `packages/*/src`); este documento declara um bloco por cláusula nova de
`tools/guardas/nomes-de-mercado.mjs`, como a 12.0 fez: cada linha nova da `FORMAS` (menos a que o `consulta…` já cobria na 12.0), o segmento
`*-de-teste`, o `onde` do `CHAVE_` e a exceção nominal.

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma
-  { forma: 'Agendador', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Scheduler'] },
+  { forma: 'AgendadorQueNaoExiste', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Scheduler'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › AgendadorDeExecucao \(classe\) em apps/api/src/x.ts
-  { forma: 'AgendadorDe', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Scheduler'] },
+  { forma: 'AgendadorDeQueNaoExiste', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Scheduler'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › Processador \(classe\) em apps/api/src/x.ts
-  { forma: 'Processador', casa: 'exato', tipos: EM_CLASSE, mercado: ['JobProcessor'] },
+  { forma: 'ProcessadorQueNaoExiste', casa: 'exato', tipos: EM_CLASSE, mercado: ['JobProcessor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › ProcessadorDeX \(classe\) em apps/api/src/x.ts
-  { forma: 'ProcessadorDe', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Processor'] },
+  { forma: 'ProcessadorDeQueNaoExiste', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Processor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma
-  { forma: 'Processador', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Processor'] },
+  { forma: 'ProcessadorQueNaoExiste', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Processor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › ExecutorDeJobs \(classe\) em apps/api/src/x.ts
-  { forma: 'ExecutorDeJobs', casa: 'exato', tipos: EM_CLASSE, mercado: ['JobExecutor'] },
+  { forma: 'ExecutorDeJobsQueNaoExiste', casa: 'exato', tipos: EM_CLASSE, mercado: ['JobExecutor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › ExecutorDeX \(classe\) em apps/api/src/x.ts
-  { forma: 'ExecutorDe', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Executor'] },
+  { forma: 'ExecutorDeQueNaoExiste', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Executor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › ExecutorX \(classe\) em apps/api/src/x.ts
-  { forma: 'Executor', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Executor'] },
+  { forma: 'ExecutorQueNaoExiste', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Executor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma
-  { forma: 'METADADO_', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{X}_KEY'] },
+  { forma: 'METADADO_QueNaoExiste', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{X}_KEY'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › `consulta…` e `CHAVE_…` valem só em apps/web
-  { forma: 'CHAVE_', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{X}_QUERY_KEY'], onde: /^apps\/web\// },
+  { forma: 'CHAVE_', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{X}_QUERY_KEY'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › o arquivo apps/api/test/material-de-teste.ts é recusado, e a mensagem dá material.fixture
-  { padrao: /^(.+)-de-teste$/, mercado: '{x}.fixture' },
+  { padrao: /^(.+)-de-teste-que-nao-existe$/, mercado: '{x}.fixture' },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › a exceção nominal `CHAVE_CHEIO_NAS_CLASSES` passa em
-    nome: 'CHAVE_CHEIO_NAS_CLASSES',
+    nome: 'CHAVE_OUTRA_QUE_NAO_EXISTE',
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | Ao renomear no futuro um arquivo `*-de-teste`, conferir que o nome novo não indica dado real: a regra 20, item 17, é garantida só pela revisão | Sem mudança no código: é conferência da revisão do `privacy-guardian`, que já a faz em toda tarefa que toca fixture; o nome `.fixture` não afirma nada sobre o conteúdo e o texto não pede isso |
| infra-guardian (1ª) | `CHAVE_DA_TRAVA_*` fora de `apps/web` não é apontada pela guarda; conferir à mão se cada trava nova tem número próprio | Recusada: é conferência de carga do `infra-guardian` em revisão, sem texto a mudar. A razão de a guarda não olhar essas constantes já está escrita em `guarda.md` ("`CHAVE_<X>` fora de `apps/web/**`") |
| revisor-geral (1ª) | `inventario.md:20-21`: a frase "A guarda do RF8 usa os prefixos e sufixos da coluna da esquerda" continua sem ressalva; apontar para "O que fica fora da lista" da `guarda.md` | Recusada: `inventario.md` não é arquivo desta correção (nem está entre os alterados) e é a fotografia do rename; a divergência fica registrada na `guarda.md` (a nota do prefixo e a seção "O que fica fora da lista, e por quê"), que o próprio `revisor-geral` confirmou como o lugar da Tech Spec para a gramática. Se o Orquestrador quiser a ressalva também no inventário, é uma linha na próxima tarefa que o toque |
| revisor-geral (1ª) | `guardas.test.ts:564-566`: a meta-checagem casa prefixo com `startsWith`, sem exigir a maiúscula logo depois, então `AgendadorDeExecucao` sozinho já conta como caso da linha `Agendador` | Recusada: o próprio revisor diz que é cobertura e cabe ao `test-engineer`, que aprovou os casos da tabela e só exige os blocos do item 1; o item 2 move a prova de `AgendadorX` para o teste que roda a guarda, que é onde a maiúscula conta |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 11:53:11 | 2026-11-02 11:53:25 | `tenancy-guardian` | 1 | APROVADO | ac89c60438833a6b0 |
| 2026-11-02 11:53:15 | 2026-11-02 11:53:30 | `privacy-guardian` | 2 | APROVADO | a2e615457df579523 |
| 2026-11-02 11:53:20 | 2026-11-02 11:53:31 | `infra-guardian` | 2 | APROVADO | ac45a8b1d871cff3a |
| 2026-11-02 11:53:17 | 2026-11-02 11:53:34 | `conformidade-reviewer` | 1 | APROVADO | a2b5ede0ac095dade |
| 2026-11-02 11:53:09 | 2026-11-02 11:53:46 | `revisor-geral` | 2 | APROVADO | a29790ff2d9e310e4 |
| 2026-11-02 11:53:05 | 2026-11-02 11:54:54 | `test-engineer` | 2 | APROVADO | aeebf4b705dec91f9 |
