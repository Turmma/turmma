# Tarefa 12.0 — A guarda `guardas/nome-de-mercado` recusa nome técnico em português em código novo

**Funcionalidade:** nomes-de-mercado · **Depende de:** 8.0 e 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Uma declaração nova como `class AdaptadorX` é recusada pelo lint, e a mensagem dá o nome de mercado (`XAdapter`).
O nome de domínio passa (`TurmaController`, `EliminacaoDoTitular`), e a árvore inteira, depois das ondas, passa sem
nenhum erro.

## Contexto necessário

- `guarda.md`, inteiro: onde a regra vive, a gramática, o limite declarado, a exceção nominal e os casos
- `techspec.md` §5, "A guarda (12.0)", e §10
- `prd.md` RF8
- `tools/guardas/index.mjs`: `REGRAS_DAS_GUARDAS` e `configuracaoDasGuardas`
- `tools/guardas/regras-erro.mjs`: uma regra própria com mensagem, para seguir o formato

## Subtarefas

- [x] 12.1 — A lista `tools/guardas/nomes-de-mercado.mjs`: a forma, os tipos de declaração e o nome de mercado de cada
  linha da gramática, mais a exceção nominal com o motivo
- [x] 12.2 — A regra `tools/guardas/regras-nome.mjs`, só na declaração de topo, com a letra maiúscula depois do
  prefixo, e o segmento de arquivo e de pasta
- [x] 12.3 — A ligação em `index.mjs`: em `REGRAS_DAS_GUARDAS`, só em `apps/**`, `packages/**` e `e2e/**`, e rodada sem
  comentários
- [x] 12.4 — O mínimo de `configuracaoDasGuardas` em `tools/guardas/filtros-casam.test.ts`, atualizado com a regra nova
- [x] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/guardas/regras-nome.mjs`, `tools/guardas/nomes-de-mercado.mjs` | novo |
| `tools/guardas/index.mjs`, `tools/guardas/guardas.test.ts`, `tools/guardas/filtros-casam.test.ts` | alterado |
| `tools/guardas/__fixtures__/` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada "Recusado" de `guarda.md` | guarda | um caso por forma, no tipo de declaração em que a linha vale | |
| cada "Passam" de `guarda.md` | guarda | um caso por forma, com `Erros`, `Linhas` e a lista "O que passa" | |
| a mensagem | guarda | a de `class AdaptadorX` contém `XAdapter` | |
| `tools/` | guarda | fica fora | |
| a árvore depois da 11.0 | guarda | nenhum erro (RF8) | |
| filtro vazio | trava | o mínimo de `configuracaoDasGuardas` com a regra nova | |
| quem contorna é acusado: `eslint-disable-next-line` | guarda | não desliga a regra | |
| quem contorna é acusado: `export default class AdaptadorX` | guarda | recusado | |
| quem contorna é acusado: `abstract class AdaptadorX` | guarda | recusado | |
| a guarda reprova quando o alvo não existe | guarda | a exceção nominal com caminho inexistente fica vermelha | |

## Como testar

- O formato: `tools/guardas/guardas.test.ts › guarda de erro tipado`. A fixture em `tools/guardas/__fixtures__/` traz
  `reprova: guardas/nome-de-mercado` na linha. O caso roda `lintar(eslintDasGuardas, fixture, caminhoSimulado)` e
  compara com `marcasDeViolacao(fixture)`.
- O caminho simulado decide o escopo: `apps/web/src/x.ts` para `consulta`, `packages/core/src/ia/tasks/x.ts` para
  `EntradaDo…`, e `tools/x.ts` para o caso de fora.
- O comentário não desliga: copie `guardas.test.ts › guarda desligada por comentário`.
- A árvore inteira: `guardas.test.ts › o repositório de hoje não tem violação…`, na guarda de erro.
- Comando: `npx vitest run --project unidade tools/guardas/guardas.test.ts tools/guardas/filtros-casam.test.ts`.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6, há uma fixture por forma de escrever a mesma declaração. Na 3, o caso que
passa tem o mesmo nome que é recusado em outro tipo de declaração.

## Fora do escopo desta tarefa

Renomear qualquer peça. Se a árvore não passar, o nome que sobrou é divergência da onda dele, e não exceção nova.

## Divergências resolvidas nesta tarefa

- **A guarda acusou 11 declarações de topo na árvore** (portão, 01/11). A 12.0 não mudou e não ganhou exceção: as 11 foram renomeadas pela
  correção `2026-11-01-adenda-5` (`165b7ca8`, adenda 5 do inventário, aprovada pelo Joaquim), e a árvore passa.
- **`ESCOPO_DO_NOME` em template** (`apps/**/*.${EXTENSOES_DE_CODIGO}`): o `tools/processo/harness/caminhos.test.ts` lê o literal como pasta
  e acusava 3 caminhos que não existem. O escopo passou a ser o literal expandido em `tools/guardas/index.mjs`; o harness não mudou.
- **O `restos` acusava 34 nomes antigos na lista e nos casos da guarda** (portão, 01/11). A lista (`nomes-de-mercado.mjs`) e os casos
  (`guardas.test.ts`) citam `Botao`, `lerConfiguracao` e `packages/core/src/fila/` por obrigação (RF8). Triagem do Arquiteto: detalhe não
  previsto, caminho 1 estreito. Os dois arquivos entram em `SEM_VARREDURA` (`tools/renomear/referencias.ts`), pelo nome e com o motivo; o
  resto de `tools/guardas/` segue varrido. Já escrito em `techspec.md` §5 passo 6 ("Não varre") e em `casos.md` › restos. `restos.ts` e os
  mapas feitos não mudaram.

## Mutações

Um bloco por linha da gramática, e um para cada uma destas cláusulas:
- a letra maiúscula depois do prefixo;
- só a declaração de topo;
- o escopo de `apps/web` e o de `ia/tarefas`;
- as pastas só em `packages/`;
- a exceção nominal;
- a mensagem;
- o `allowInlineConfig`;
- a exclusão de `tools/`.


**Uma linha da gramática (`guarda.md`): sem ela, a forma que a fixture recusa passa, e o caso de `recusa cada forma` fica vermelho. Um bloco por linha.**


```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  ['Botao', 'Button'],
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-const EM_QUALQUER_DECLARACAO = TIPOS
+const EM_QUALQUER_DECLARACAO = ['classe']
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Adaptador', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Adapter'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Guarda', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Guard'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Filtro', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Filter'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Interceptor', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Interceptor'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Emissor', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Issuer'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Armazem', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}FileStorage'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Medicao', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Gauge'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Bancada', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Fixtures'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Erro', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Exception', '{X}Error'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Falha', casa: 'prefixo', tipos: EM_CLASSE, mercado: ['{X}Exception', '{X}Error'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'EmMemoria', casa: 'sufixo', tipos: ['classe', 'interface', 'tipo'], mercado: ['InMemory{X}'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Linha', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Row'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Opcoes', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Options'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Dependencias', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Dependencies'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'Configuracao', casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Config'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'esquema', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{x}Schema'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'lerConfiguracao', casa: 'exato', tipos: EM_CONST_E_FUNCAO, mercado: ['loadConfig'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  { forma: 'lerConfiguracao', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['load{X}Config'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › vale só em apps/web
-  { forma: 'consulta', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{x}QueryOptions'], onde: /^apps\/web\// },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › valem só em ia/tasks
-  ...['EntradaDe', 'EntradaDo'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Input'], onde: /(?:^|\/)ia\/tasks\// })),
+  ...['EntradaDe'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Input'], onde: /(?:^|\/)ia\/tasks\// })),
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › valem só em ia/tasks
-  ...['SaidaDe', 'SaidaDo'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Output'], onde: /(?:^|\/)ia\/tasks\// })),
+  ...['SaidaDe'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Output'], onde: /(?:^|\/)ia\/tasks\// })),
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › o arquivo apps/api/src/adaptador-x.ts
-  { padrao: /^adaptador-(.+)/, mercado: '{x}-adapter' },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › o arquivo apps/web/src/guarda-rota.tsx
-  { padrao: /^guarda-(.+)/, mercado: '{x}.guard' },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › o arquivo packages/core/src/repositorio-em-memoria.ts
-  { padrao: /^(.+)-em-memoria$/, mercado: 'in-memory-{x}' },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › a pasta de packages/core/src/fila/y.ts
-  { pasta: 'fila', mercado: 'queue' },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › a pasta de packages/core/src/limite/y.ts
-  { pasta: 'limite', mercado: 'rate-limit' },
```


**A letra maiúscula depois do prefixo: sem ela, `Erros`, `Linhas` e `Filtros` são acusados.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › passam: o prefixo só casa com a letra maiúscula depois
-  if (casa === 'prefixo') return nome.startsWith(forma) && MAIUSCULA.test(nome.slice(forma.length)) ? nome.slice(forma.length) : null
+  if (casa === 'prefixo') return nome.startsWith(forma) ? nome.slice(forma.length) : null
```


**Só a declaração de topo: com um visitor que também lê a classe dentro de função, `ErroX` declarada dentro dela é acusada.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › declarada dentro de função, método e propriedade não é lida
-    return {
+    return {
+      ClassDeclaration(no) {
+        const sugestoes = no.id === null ? null : sugestoesDoNome(no.id.name, 'classe', caminho)
+        if (sugestoes !== null) context.report({ node: no, messageId: 'declaracao', data: { nome: no.id.name, sugestoes: sugestoes.join(' ') } })
+      },
       Program(programa) {
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › export default class
-  if (no.type === 'ExportNamedDeclaration' || no.type === 'ExportDefaultDeclaration') return no.declaration ? declaracoesDe(no.declaration) : []
+  if (no.type === 'ExportNamedDeclaration') return no.declaration ? declaracoesDe(no.declaration) : []
```


**O tipo de declaração em que a linha vale: sem a conferência, a mesma forma no tipo errado é acusada.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a mesma forma no tipo em que a linha não vale passa
-    if (!linha.tipos.includes(tipo) || (linha.onde !== undefined && !linha.onde.test(caminho))) continue
+    if ((linha.onde !== undefined && !linha.onde.test(caminho))) continue
```


**O casamento exato e o sufixo: o exato não vira prefixo, e o sufixo sozinho (`EmMemoria`) não casa.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a mesma forma no tipo em que a linha não vale passa
-  if (casa === 'exato') return nome === forma ? '' : null
+  if (casa === 'exato') return nome.startsWith(forma) ? '' : null
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a mesma forma no tipo em que a linha não vale passa
-  return nome.length > forma.length && nome.endsWith(forma) ? nome.slice(0, -forma.length) : null
+  return nome.length >= forma.length && nome.endsWith(forma) ? nome.slice(0, -forma.length) : null
```


**O escopo de `apps/web` (o `consulta…`) e o de `ia/tasks` (o `EntradaDe…`): sem o limite, a forma passa a valer no código inteiro.**


```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › vale só em apps/web
-  { forma: 'consulta', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{x}QueryOptions'], onde: /^apps\/web\// },
+  { forma: 'consulta', casa: 'prefixo', tipos: EM_CONST_E_FUNCAO, mercado: ['{x}QueryOptions'] },
```

```mutacao
arquivo: tools/guardas/nomes-de-mercado.mjs
teste: tools/guardas/guardas.test.ts › valem só em ia/tasks
-  ...['EntradaDe', 'EntradaDo'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Input'], onde: /(?:^|\/)ia\/tasks\// })),
+  ...['EntradaDe', 'EntradaDo'].map((forma) => ({ forma, casa: 'prefixo', tipos: EM_INTERFACE_E_TIPO, mercado: ['{X}Input'] })),
```


**As pastas `fila/` e `limite/` só em `packages/`: sem o limite, a pasta de app é acusada.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › o caminho apps/api/src/fila/y.ts passa
-          const sugestao = sugestaoDoSegmento(pasta) ?? PASTAS_SO_EM_PACKAGES.find((item) => item.pasta === pasta && caminho.startsWith('packages/'))?.mercado
+          const sugestao = sugestaoDoSegmento(pasta) ?? PASTAS_SO_EM_PACKAGES.find((item) => item.pasta === pasta)?.mercado
```


**O segmento de arquivo é o que vem antes do primeiro ponto: com a extensão, a sugestão sai errada.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › o arquivo packages/core/src/ia/adaptador-ollama.test.ts
-  return { pastas: partes, arquivo: arquivo.split('.')[0] ?? arquivo }
+  return { pastas: partes, arquivo: arquivo }
```


**A exceção nominal: sem ela `esquemaDeCor` é acusado em `e2e/aparencia.spec.ts`; sem o arquivo na conta, passa em qualquer lugar; sem a conferência de alvo, a que não existe e a que não cita o nome passam.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › passa em e2e/aparencia.spec.ts e reprova em qualquer outro arquivo
-  return EXCECOES_NOMINAIS.some((excecao) => excecao.arquivo === caminho && excecao.nome === nome)
+  return false
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › passa em e2e/aparencia.spec.ts e reprova em qualquer outro arquivo
-  return EXCECOES_NOMINAIS.some((excecao) => excecao.arquivo === caminho && excecao.nome === nome)
+  return EXCECOES_NOMINAIS.some((excecao) => excecao.nome === nome)
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a guarda reprova quando o alvo da exceção não existe
-  return excecoes.filter(({ arquivo, nome }) => !existe(arquivo) || !new RegExp(`\\b${escapar(nome)}\\b`).test(ler(arquivo)))
+  return excecoes.filter(({ arquivo, nome }) => !new RegExp(`\\b${escapar(nome)}\\b`).test(ler(arquivo)))
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a guarda reprova quando o alvo da exceção não existe
-  return excecoes.filter(({ arquivo, nome }) => !existe(arquivo) || !new RegExp(`\\b${escapar(nome)}\\b`).test(ler(arquivo)))
+  return excecoes.filter(({ arquivo, nome }) => !existe(arquivo))
```


**A mensagem: sem o nome sugerido nela, `class AdaptadorX` não diz `XAdapter`.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a mensagem de
-        '`{{nome}}` é nome técnico em português. Use o de mercado, o que a documentação do framework usa: {{sugestoes}}. O domínio fica em português e o sufixo técnico vai em inglês (`TurmaController`); regra 60 e D81.',
+        '`{{nome}}` é nome técnico em português. O domínio fica em português e o sufixo técnico vai em inglês (`TurmaController`); regra 60 e D81.',
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a mensagem de
-  return modelo.replaceAll('{X}', resto).replaceAll('{x}', minuscula(resto))
+  return modelo.replaceAll('{x}', minuscula(resto))
```


**A ligação: na segunda passada (`REGRAS_DAS_GUARDAS`), sem comentários (`allowInlineConfig`), só em `apps/**`, `packages/**` e `e2e/**`, e `tools/` fora.**


```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › a passada sem comentários reprova a classe
-  ...REGRAS_DE_NOME,
```

```mutacao
arquivo: tools/guardas/eslint-das-guardas.ts
teste: tools/guardas/guardas.test.ts › a passada sem comentários reprova a classe
-    allowInlineConfig: false,
+    allowInlineConfig: true,
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › fica entre as que a passada sem comentários roda, só em apps, packages e e2e
-  'e2e/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › fica entre as que a passada sem comentários roda, só em apps, packages e e2e
-  'packages/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › tools/ e infra/ ficam fora
-  'e2e/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
+  'e2e/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
+  'tools/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
 ]
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › fica entre as que a passada sem comentários roda, só em apps, packages e e2e
-  {
-    files: ESCOPO_DO_NOME,
-    rules: Object.fromEntries(REGRAS_DE_NOME.map((regra) => [regra, 'error'])),
-  },
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/filtros-casam.test.ts › configuracaoDasGuardas: cada item
-  {
-    files: ESCOPO_DO_NOME,
-    rules: Object.fromEntries(REGRAS_DE_NOME.map((regra) => [regra, 'error'])),
-  },
```


**A árvore inteira: uma classe com nome técnico em português que sobra em `apps/api` derruba o caso da árvore.**


```mutacao
arquivo: apps/api/src/main.ts
teste: tools/guardas/guardas.test.ts › a árvore depois da 11.0 passa sem nenhum erro
-import 'reflect-metadata'
+import 'reflect-metadata'
+export class AdaptadorMutado {}
```


**As linhas que o `--faltando` apontou na `regras-nome.mjs`: a maiúscula, o casamento, cada tipo de declaração que a regra lê, o `id` nulo da declaração anônima, o segmento de arquivo e de pasta e a exceção nominal.**


```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › passam: o prefixo só casa com a letra maiúscula depois
-const MAIUSCULA = /^[A-Z]/
+const MAIUSCULA = /^[a-zA-Z]/
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    if (resto !== null) return linha.mercado.map((modelo) => sugerir(modelo, resto))
+    if (resto !== null) continue
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    case 'ClassDeclaration':
+    case 'ClassDeclarationX':
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    case 'TSInterfaceDeclaration':
+    case 'TSInterfaceDeclarationX':
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    case 'TSTypeAliasDeclaration':
+    case 'TSTypeAliasDeclarationX':
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    case 'TSEnumDeclaration':
+    case 'TSEnumDeclarationX':
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    case 'FunctionDeclaration':
+    case 'FunctionDeclarationX':
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-    case 'VariableDeclaration':
+    case 'VariableDeclarationX':
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a declaração anônima
-      return no.id === null ? [] : [['classe', no.id.name]]
+      return [['classe', no.id.name]]
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a declaração anônima
-      return no.id === null ? [] : [['funcao', no.id.name]]
+      return [['funcao', no.id.name]]
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › o arquivo apps/api/src/adaptador-x.ts
-    if (achado?.[1] !== undefined) return sugerir(mercado, achado[1])
+    if (false) return sugerir(mercado, achado[1])
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a pasta recusada e o arquivo recusado no mesmo caminho
-        'A pasta `{{nome}}/` tem nome técnico em português. Use o de mercado: `{{sugestao}}/`. O domínio fica em português e o sufixo técnico vai em inglês; regra 60 e D81.',
+        'A pasta `{{nome}}/` tem nome técnico em português. O domínio fica em português e o sufixo técnico vai em inglês; regra 60 e D81.',
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a pasta de apps/api/src/adaptador-x/y.ts
-          if (sugestao) context.report({ loc: inicio, messageId: 'pasta', data: { nome: pasta, sugestao } })
+          if (!sugestao) context.report({ loc: inicio, messageId: 'pasta', data: { nome: pasta, sugestao } })
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › o arquivo apps/api/src/adaptador-x.ts
-        if (sugestaoDoArquivo) context.report({ loc: inicio, messageId: 'arquivo', data: { nome: arquivo, sugestao: sugestaoDoArquivo } })
+        if (!sugestaoDoArquivo) context.report({ loc: inicio, messageId: 'arquivo', data: { nome: arquivo, sugestao: sugestaoDoArquivo } })
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › passa em e2e/aparencia.spec.ts e reprova em qualquer outro arquivo
-            if (sugestoes === null || temExcecaoNominal(nome, caminho)) continue
+            if (sugestoes === null) continue
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-            if (sugestoes === null || temExcecaoNominal(nome, caminho)) continue
+            if (temExcecaoNominal(nome, caminho)) continue
```

**A isenção do passo 6: sem os dois arquivos em `SEM_VARREDURA`, a lista e os casos da guarda são varridos; sem ser pelo nome, o outro arquivo de `tools/guardas/` deixa de ser listado.**

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'Botao' na lista da guarda do RF8, tools/guardas/nomes-de-mercado.mjs
-const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json', 'tools/guardas/nomes-de-mercado.mjs', 'tools/guardas/guardas.test.ts']
+const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json', 'tools/guardas/guardas.test.ts']
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'Botao' nos casos da guarda do RF8, tools/guardas/guardas.test.ts
-const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json', 'tools/guardas/nomes-de-mercado.mjs', 'tools/guardas/guardas.test.ts']
+const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json', 'tools/guardas/nomes-de-mercado.mjs']
```

```mutacao
arquivo: tools/renomear/referencias.ts
teste: tools/renomear/referencias.test.ts › 'Botao' em outro arquivo de tools/guardas/, que segue varrido
-const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json', 'tools/guardas/nomes-de-mercado.mjs', 'tools/guardas/guardas.test.ts']
+const SEM_VARREDURA = ['tools/renomear/', 'package-lock.json', 'tools/guardas/']
```

**Da ordem de correção da rodada 1: o filtro da desestruturação, o ternário do `export { … }`, a linha de `apps/**` e o escape do nome da exceção.**

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › a mesma forma no tipo em que a linha não vale passa
-      return no.declarations.filter((item) => item.id.type === 'Identifier').map((item) => ['const', item.id.name])
+      return no.declarations.map((item) => ['const', item.id.name])
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › recusa cada forma, no tipo de declaração em que a linha vale
-  if (no.type === 'ExportNamedDeclaration' || no.type === 'ExportDefaultDeclaration') return no.declaration ? declaracoesDe(no.declaration) : []
+  if (no.type === 'ExportNamedDeclaration' || no.type === 'ExportDefaultDeclaration') return declaracoesDe(no.declaration)
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › fica entre as que a passada sem comentários roda, só em apps, packages e e2e
 export const ESCOPO_DO_NOME = [
-  'apps/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
   'packages/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › o nome da exceção é escapado
-  return excecoes.filter(({ arquivo, nome }) => !existe(arquivo) || !new RegExp(`\\b${escapar(nome)}\\b`).test(ler(arquivo)))
+  return excecoes.filter(({ arquivo, nome }) => !existe(arquivo) || !new RegExp(`\\b${nome}\\b`).test(ler(arquivo)))
```

```mutacao
arquivo: tools/guardas/regras-nome.mjs
teste: tools/guardas/guardas.test.ts › o nome da exceção é escapado
-const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
+const escapar = (texto) => texto.replace(/[*+?^${}()|[\]\\]/g, '\\$&')
```

**Sem bloco, de propósito:** a linha `const arquivo = partes.pop() ?? ''` de `regras-nome.mjs`. O `split` de um caminho devolve ao menos um item, então o `?? ''` só aquieta o tipo, e nenhum teste distingue a troca.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | O `techspec.md` §5 passo 6 afirma que o identificador e o comentário de `guardas.test.ts` e de `nomes-de-mercado.mjs` "continuam na régua do `restos`", sem teste citado; e a isenção do `guardas.test.ts` inteiro é larga | Retrospectiva da X8. A triagem é do Arquiteto e já está escrita em `techspec.md` §5 passo 6 e em `casos.md` › restos; o revisor mesmo diz que fica "o registro para a retro". Não toca arquivo desta tarefa |
| test-engineer (1ª) | O caso `cada linha da gramática é exercida…` refaz o `casa` por conta própria, sem a exigência da maiúscula; pode divergir de `restoDoNome` | `TODO.md`: usar a função da regra no caso exige exportar `restoDoNome`, que muda a superfície de `regras-nome.mjs`. O revisor diz que "hoje não engana" |
| privacy-guardian (1ª) | Registrar, no comentário de `SEM_VARREDURA` (`tools/renomear/referencias.ts`), que a isenção serve só ao rename | `TODO.md`, linha de `tools/guardas/` da tarefa 12.0 (item a). O revisor mesmo diz que "hoje isso não afeta a regra 20" |
| test-engineer (2ª) | O título da seção de mutações da exceção nominal ainda dizia "a que não declara o nome"; o teste e o comentário dizem "cita o nome" | Aplicada ao copiar a tabela: a frase do documento agora diz "cita" |
| test-engineer (2ª) | O teste de escape só prova o `.`; um segundo caso com `(` ou `+` mostraria que a classe de caracteres inteira importa | `TODO.md`, linha de `tools/guardas/` da tarefa 12.0 (item b). Cobertura extra |
| test-engineer (2ª) | Na fixture, `esquemaDaLista` só vale como documentação do limite, porque `medidorX` já quebra o caso antes | Recusada: o revisor diz que "não muda o veredito", e a linha documenta o limite ao lado de `declare function`. Sem efeito em regra de negócio |
| revisor-geral (2ª) | O cabeçalho de `regras-nome.mjs` (linhas 10 a 14) ficou com uma linha bem mais longa que as outras | `TODO.md`, linha de `tools/guardas/` da tarefa 12.0 (item c). Só largura de comentário |
| revisor-geral (2ª) | A segunda linha desta tabela tem destino `TODO.md` e o `TODO.md` não tinha a linha | Obrigação do commit: a linha de `tools/guardas/` da tarefa 12.0 está escrita no `TODO.md` neste commit |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-01 20:43:18 | 2026-11-01 20:43:37 | `tenancy-guardian` | 1 | APROVADO | a1bf60fdc9681b09b |
| 2026-11-01 20:43:25 | 2026-11-01 20:43:44 | `infra-guardian` | 1 | APROVADO | a7616fd8a4ee980db |
| 2026-11-01 20:43:20 | 2026-11-01 20:43:48 | `privacy-guardian` | 1 | APROVADO | a1a8b602edf82df8b |
| 2026-11-01 20:43:22 | 2026-11-01 20:43:57 | `conformidade-reviewer` | 1 | APROVADO | a44c83d50cd3342e4 |
| 2026-11-01 20:43:29 | 2026-11-01 20:45:07 | `revisor-geral` | 1 | APROVADO | a197ddd1c1c3d101d |
| 2026-11-01 20:43:27 | 2026-11-01 20:45:53 | `test-engineer` | 1 | REPROVADO | a80316aa9944a3cc1 |
| 2026-11-01 20:55:20 | 2026-11-01 20:55:30 | `tenancy-guardian` | 2 | APROVADO | a96721876b1563d05 |
| 2026-11-01 20:55:24 | 2026-11-01 20:55:39 | `privacy-guardian` | 2 | APROVADO | aa3da6cd2ae819778 |
| 2026-11-01 20:55:28 | 2026-11-01 20:55:46 | `conformidade-reviewer` | 2 | APROVADO | a2e6ac088a15dcc03 |
| 2026-11-01 20:55:32 | 2026-11-01 20:55:58 | `infra-guardian` | 2 | APROVADO | ae8e52e6cd36efb4a |
| 2026-11-01 20:55:43 | 2026-11-01 20:56:52 | `revisor-geral` | 2 | APROVADO | a426bddae0aa5b775 |
| 2026-11-01 20:55:39 | 2026-11-01 20:56:53 | `test-engineer` | 2 | APROVADO | ab559770e5668fc99 |
