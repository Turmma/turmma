# Correção — a tela da lista da turma não lê o contrato novo da 8.0, e o e2e que monta a escola por ela cai; a integração estoura os 20 minutos da esteira

**Origem:** esteira run 41775656221 (em `2c56009`, depois da 8.0): e2e 3/8, 4/8, 7/8 e 8/8 vermelhos; integração cancelada.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `frontend-reviewer`, `infra-guardian`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. -->

## Sintoma

- `e2e/escola-montada.spec.ts:63` (W1), `e2e/estrutura.spec.ts:758` (W12), `e2e/roteiro-da-demonstracao.spec.ts:110` e os três casos de
  `e2e/lista-da-turma.spec.ts` (62, 214, 519), nos projetos `chromebook` e `celular`: depois de "Ver a prévia", a região "Prévia" nunca
  aparece (`element(s) not found`, 20 s). A tela mostra "Não foi possível concluir agora".
- Job `integração`: `cancelled` aos 19 min 50 s, no passo `npm run ci:integracao`, com todos os arquivos que tinham terminado verdes.

## Fora desta correção

nada

## Causa

**e2e.** A 8.0 trocou as rotas `POST /v1/turmas/:id/lista/previa` e `/lista` para o contrato da importação (prévia sem nome nem
matrícula, com `contagens` e `candidatos`; gravação com 202 e `{ id }`, que se acompanha em `GET /v1/importacoes/:id`). A tela da A1
(`ListaDaTurma.tsx`, via `api/lista.ts`) segue lendo o contrato antigo (`previaDaListaResponseSchema`, `gravacaoDaListaResponseSchema`): a
resposta nova não passa no esquema, o cliente a trata como erro de contrato e a prévia não chega. A hipótese do pedido está confirmada.
O documento da 8.0 (`8_task.md`, linha da tabela de riscos) previu isso só para `lista-da-turma.spec.ts`; o W1, o W12 e o roteiro também
sobem a lista **por essa tela** para montar a escola, e caíram junto.

**Integração.** Prazo, não defeito. O `timeout-minutes: 20` do job tem um comentário velho ("a suíte local leva uns 5 min"). Na esteira
ela leva de 15 a 20 min e vem crescendo com cada tarefa: as últimas execuções da branch foram de 16, 19, 18, 15 e 20 min (a 41766641101
passou aos 19 min 57 s, a 41750641694, da 5.0, foi cancelada aos 20 min 03 s, e a 41775656221 aos 19 min 50 s). No log cancelado
terminaram 135 dos 148 arquivos de integração, todos verdes; os mais longos são os de sempre (`rate-limit` 141 s, `password-attack` 97 s,
`sessao-guard` 55 s, `job-execution` 53 s).

## Teste que reproduz

`apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`: a prévia e a gravação lidas no contrato novo, pela rede falsa. Vermelho antes
(o esquema antigo recusa a resposta nova), verde depois. O e2e do pedido, isolado, é a prova de ponta a ponta (passo 4).

## Correção

`apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts` (novo) e `api/lista.ts`: a prévia e a gravação da lista da turma passam a ler o contrato da
importação, e a ponte o reescreve no formato que a tela da A1 ainda entende. A prévia nova não traz nome nem matrícula; a ponte os tira do texto enviado
pelo número da linha, com a mesma leitura do `lista-reader.ts` da API (separador, aspas, cabeçalho). Os resultados da prévia: `entra` e `ja_existe` passam
como são; `muda_de_turma` (sem a marca da coordenação, que a tela da A1 não tem, nada é gravado) vira o erro `matricula_em_uso`, que a tela já diz; `nome_corrigido`
**grava** (a API corrige o nome sempre, `alunos.ts:410`) e a tela da A1 não sabe mostrar isso, então a ponte o trata como falha de contrato (`ERRO_INTERNO`), como
`fora_da_planilha` e `turma_ambigua`, em vez de dizer "nada muda". Os códigos de erro da planilha ganham o equivalente da lista. A gravação, que agora responde 202, espera a
importação concluir em `GET /v1/importacoes/:id` e devolve as contagens do resumo: os nomes corrigidos contam entre os gravados, e a conta tem de fechar com as linhas de
aluno do texto (entram + corrigidos + já existem + transferidos); se não fecha, uma linha ficou de fora (a matrícula passou a ser de outra turma depois da prévia) e é
`CONFLITO`, a prévia a refazer, e não "0 nomes gravados". A tela (`ListaDaTurma.tsx`, `falhaDaGravacao`) diz que **aquela linha** não foi gravada e aponta a lista de nomes da turma, que o `onError` relê, porque o job pode ter gravado as linhas `entra`; nunca "nada foi gravado" (o texto é verdadeiro na gravação parcial, na que não gravou nada e na prévia `desatualizada`). Quem prova a frase é `ListaDaTurma.test.tsx`; `api/lista.test.ts` prova só o código. `desatualizada` é `CONFLITO`, `falhou` é erro, e a fila que não anda no prazo é `INDISPONIVEL_TENTE_DE_NOVO`.
A espera entre as leituras começa em 1 s (`INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS`) e cresce 1,5 vez até 3 s, por até 60 s: umas 22 leituras, e não 120 (o limite por usuário é
120 por minuto, regra 80, item 1); o `LIMITE_EXCEDIDO` numa leitura conta como "ainda na fila" e nunca chega à tela. O estado lido é `Pick<Importacao, 'estado' | 'resumo'>`
de `@educa/shared`. A ponte e `api/lista.ts` saem na 13.0 (`TODO.md`).

`e2e/lista-da-turma.spec.ts`, o caso da lista paginada (214): o teto que ele confere passa do antigo (202 linhas, 64 KB) para o arquivo acima de 512 KB; as 3.000 linhas ficam
de fora (colar 3.002 linhas no campo leva uns 27 s na tela, e a prova delas está em `lista-reader.test.ts` e em `importacao.int.test.ts`, no `TODO.md`). Com isso o caso chega às provas da
gravação recusada e do servidor fora do ar, que ele escondia. Para os dois casos que o diff toca caberem na metade do prazo (2ª triagem do Arquiteto):
o trecho do caso que era próprio (o cabeçalho que o leitor não reconhece, a coluna que parece CPF, o título com vírgula, a prévia que chega com o foco no campo ou num botão) mora no **fim do caso 62**
(`o arquivo do Excel…`, título igual, porque é por ele que o prazo de 90 s do HEAD é achado), onde a coordenadora, a turma e a lista já estão na tela; o 214 perde o trecho `'/'` → Painel → Voltar
(já provado em `apps/web/src/pages/Inicio.test.tsx` › `a coordenação que já viu a introdução abre no Painel (/coordenacao/painel), e a raiz não fica no histórico`) e abre a turma pelo endereço (`irPara`), e não pela
Estrutura (abrir pela linha dela está provado nos outros casos do arquivo e em `e2e/estrutura.spec.ts`). O título do 214 fica igual. O caso do erro da leitura da lista (543) não é tocado.

`ListaDaTurma.test.tsx`: o caso "gravar a lista leva o foco…" passa a responder no contrato novo (prévia da planilha, 202 e a importação concluída). Um `it.each` novo (parcial, nada e prévia que envelheceu) confere o texto inteiro do `CONFLITO`, a lista de nomes relida, a prévia que sai com o "Gravar lista" e o campo que mantém o texto. `e2e/lista-da-turma.spec.ts` (caso da lista paginada) confere o mesmo texto no caso de uma linha.

`.github/workflows/ci.yml`: `timeout-minutes` do job `integração` de 20 para 30, e o comentário velho ("uns 5 min") corrigido.

### Provado em e2e, isolado (`node tools/ci/e2e.ts --manter-ambiente`, chromebook e celular)

`escola-montada.spec.ts` W1, `estrutura.spec.ts` W12, `roteiro-da-demonstracao.spec.ts` e `lista-da-turma.spec.ts` (62, 214, 543, 596, 659): verdes nos dois projetos. Tempos de cada caso sozinho (`--workers=1`): o 62, 32,0 s no celular e 29,8 s no chromebook; o 214, 43,3 s no celular
(43,3, 43,7 e 43,1 s em três repetições) e 38,6 s no chromebook; o prazo dos dois é 90 s, e a metade é 45 s.

### A integração, em uma frase

Prazo, não defeito: sobem para 30 min; se a suíte voltar a passar de uns 25, o certo é dividi-la em fatias como o e2e (é do Arquiteto, `TODO.md`).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), test-engineer (1ª), privacy-guardian (1ª) | Extrair o leitor de texto para `packages/shared`, ou um teste que rode as mesmas amostras na ponte e no `lista-reader.ts` da API | Não aplicada: cria pacote compartilhado ou teste entre `apps/web` e `apps/api`, e a ponte sai na 13.0. Destino: o aviso do item 6 no `TODO.md` |
| infra-guardian (1ª), revisor-geral (1ª) | `AbortSignal` no polling, para parar quando a pessoa sai da tela | Não aplicada: muda a assinatura da ponte e o chamador na tela. A ponte sai na 13.0 e a tela nova mostra o estado da importação (item 6) |
| infra-guardian (1ª) | Prazo do cliente (60 s) menor que o do job (300 s) | Destino: `TODO.md`, item 6 (13.0) |
| infra-guardian (1ª) | Gatilho de dividir a suíte de integração se passar de uns 25 min | Já está no `TODO.md` |
| frontend-reviewer (1ª), conformidade-reviewer (1ª), revisor-geral (1ª), test-engineer (1ª) | Trocar "Até 200 nomes por vez" e "não passa de 200 nomes" | Não aplicada: muda texto de tela que o e2e confere, e a 13.0 troca a tela pelo `ImportarPlanilha` (`13_task.md`). Destino: `TODO.md`, item 6 |
| frontend-reviewer (1ª) | "Choose File / No file chosen" em inglês na vitrine | Recusada: o campo do arquivo não é tocado por esta correção, e a vitrine roda o navegador em inglês; a 13.0 troca a tela |
| revisor-geral (1ª) | Acrescentar `ponte-da-lista.ts` e `api/lista.test.ts` aos arquivos previstos do `13_task.md` | Não aplicada: o `13_task.md` é do Arquiteto. Destino: o Orquestrador pede ao Arquiteto na próxima edição de tarefas; o `TODO.md` (item 6) já lista o que apagar |
| test-engineer (1ª) | Texto próprio para o `CONFLITO` do POST com outra importação na fila | Não aplicada: muda texto de tela e comportamento da ponte. Destino: `TODO.md`, item 6 (13.0) |
| privacy-guardian (1ª), conformidade-reviewer (1ª) | Conferir o `rotulo` dos `candidatos` e pedir a auditoria da regra 70 ao apagar a ponte | Destino: `TODO.md`, item 6 (13.0) |
| frontend-reviewer (2ª), test-engineer (2ª), revisor-geral (2ª) | Texto próprio para a prévia com `nome_corrigido`, e teste de tela do texto que aparece | Não aplicada: muda texto de tela e comportamento da ponte. Destino: `TODO.md`, item `Da 13.0` |
| infra-guardian (2ª) | Usar o `Retry-After` do 429 como piso da espera | Não aplicada: muda comportamento da ponte, que sai na 13.0. Destino: `TODO.md`, item `Da 13.0` |
| infra-guardian (2ª) | `AbortSignal` no polling | Não aplicada: muda a assinatura da ponte e o chamador na tela. Destino: `TODO.md`, item `Da 13.0` |
| tenancy-guardian (2ª) | Pedir a auditoria de tenancy ao apagar a ponte | Destino: `TODO.md`, item `Da 13.0` |
| privacy-guardian (2ª) | Garantir que o Arquiteto inclua `ponte-da-lista.ts` no `13_task.md` | Não aplicada: o `13_task.md` é do Arquiteto. Destino: o Orquestrador pede ao Arquiteto na próxima edição de tarefas; `TODO.md`, item `Da 13.0` |
| test-engineer (2ª) | O caso da lista paginada em 43,3 s no celular, a 4% da metade do prazo | Destino: `TODO.md`, item `Da 13.0` (a 13.0 reescreve o caso) |
| frontend-reviewer (2ª), conformidade-reviewer (2ª), privacy-guardian (2ª), revisor-geral (2ª) | "Até 200 nomes por vez", leitor duplicado, "Choose File" em inglês | Já têm destino na 13.0 pela 1ª ordem (`TODO.md`); a linha do "Choose File" está recusada na tabela acima |
| conformidade-reviewer (2ª) | Auditoria da regra 70 ao apagar a ponte | Já está no `TODO.md` |
| revisor-geral (3ª), frontend-reviewer (3ª), test-engineer (3ª), conformidade-reviewer (3ª) | "essa linha", no singular, no texto do `CONFLITO` (`ListaDaTurma.tsx`): com mais de uma linha de fora a frase fica imprecisa; a tela nova diz quantas entraram e quantas ficaram de fora | Não aplicada: muda texto de tela que o e2e e o `it.each` conferem, e a 13.0 troca a tela. Destino: `TODO.md`, item `Da 13.0` |
| revisor-geral (3ª), test-engineer (3ª) | A prévia `desatualizada` e o `CONFLITO` do POST com outra importação na fila usam o texto de "matrícula em outra turma", e a causa real pode ser outra (alguém mexeu na lista); separar "a lista mudou desde a prévia" de "uma matrícula passou a outra turma" | Não aplicada: muda texto e comportamento da ponte, que sai na 13.0. Destino: `TODO.md`, item `Da 13.0` |
| frontend-reviewer (3ª) | "Choose File / No file chosen" em inglês; trocar o campo por um botão "Escolher arquivo" | Recusada na 1ª ordem (campo não tocado, a vitrine roda o navegador em inglês); a 13.0 troca a tela |
| frontend-reviewer (3ª), test-engineer (3ª), conformidade-reviewer (3ª), tenancy-guardian (3ª), privacy-guardian (3ª) | "Até 200 nomes por vez", caso da lista paginada a 43,3 s, auditoria de tenancy e da regra 70 ao apagar a ponte, `ponte-da-lista.ts` e `api/lista.test.ts` no `13_task.md` | Já estão no `TODO.md`, item `Da 13.0` |

## Mutações

--faltando: 2 linhas (37 blocos, 2 motivos)

**Sem bloco (motivo):** (1) o `?? []` de `primeira?.campos.map(normalizado) ?? []` (`ponte-da-lista.ts`, linha 67): com o texto sem nenhuma linha lida, os dois caminhos acabam em mapa vazio, e a mutação não muda nada que se veja; (2) o `lida.erro === undefined ? undefined : …` (linha 112): o esquema da prévia (`linhaDaPreviaDaPlanilhaSchema`, o `refine` de `resultado === 'erro'`) já recusa o erro sem código antes de a ponte ver a linha, então o ramo só satisfaz o tipo.

A prévia deixa de ser pedida à rota da lista da turma.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/api/lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › devolve o nome e a matrícula de cada linha pelo número dela no texto, e as contagens pelas linhas
-  const resposta = await authedRequest(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, previaDaPlanilhaResponseSchema, { metodo: 'POST', corpo: { texto } })
+  const resposta = await authedRequest(`/v1/turmas/${encodeURIComponent(turmaId)}/lista/prévia`, previaDaPlanilhaResponseSchema, { metodo: 'POST', corpo: { texto } })
```

O texto sem separador deixa de ser uma coluna só.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela
-  if (separador === undefined) return [linha]
+  if (separador === undefined) return []
```

A aspa deixa de abrir um campo.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo
-    if (entreAspas) {
+    if (entreAspas && false) {
```

A aspa que fecha o campo passa a fazer parte dele.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo
-      if (caractere !== ASPAS) atual += caractere
+      if (true) atual += caractere
```

A aspa dobrada dentro das aspas deixa de ser uma aspa.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo
-      else if (linha[posicao + 1] === ASPAS) {
+      else if (false && linha[posicao + 1] === ASPAS) {
```

A aspa no meio do campo passa a abrir aspas.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo
-    } else if (caractere === ASPAS && atual.trim() === '') {
+    } else if (caractere === ASPAS) {
```

O separador deixa de separar.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › devolve o nome e a matrícula de cada linha pelo número dela no texto, e as contagens pelas linhas
-    } else if (caractere === separador) {
+    } else if (caractere === separador && false) {
```

O cabeçalho com acento deixa de ser reconhecido.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo
-const normalizado = (campo: string): string => campo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
+const normalizado = (campo: string): string => campo.normalize('NFD').toLowerCase().trim()
```

A quebra de linha só com CR deixa de contar.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela
-  const fisicas = texto.split(/\r\n|\r|\n/)
+  const fisicas = texto.split(/\r\n|\n/)
```

O título sem separador antes da lista desmonta as colunas.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela
-    if (separador !== undefined) break
+    if (separador === undefined) break
```

"Nome e matrícula" numa coluna só passa a ser cabeçalho de duas.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela
-  const nome = lidos.findIndex((campo, posicao) => posicao !== matricula && campo.includes('nome'))
+  const nome = lidos.findIndex((campo) => campo.includes('nome'))
```

Cabeçalho só com o nome passa a valer.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela
-  const comCabecalho = matricula !== -1 && nome !== -1
+  const comCabecalho = matricula !== -1 || nome !== -1
```

A ordem das colunas deixa de vir do cabeçalho.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê o separador, as aspas e o cabeçalho como a API, para a linha cair no nome certo
-  const colunas = comCabecalho ? { nome, matricula } : { nome: 0, matricula: 1 }
+  const colunas = { nome: 0, matricula: 1 }
```

O campo que falta deixa de ser vazio.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o texto fora do comum cai nas mesmas colunas que a API lê: sem separador, só com CR, com título antes e com cabeçalho que não é o dela
-  const porLinha = new Map(lidas.map(({ linha, campos }) => [linha, { nome: campos[colunas.nome] ?? '', matricula: campos[colunas.matricula] ?? '' }]))
+  const porLinha = new Map(lidas.map(({ linha, campos }) => [linha, { nome: campos[colunas.nome] ?? '', matricula: campos[colunas.matricula] ?? 'x' }]))
```

A linha que o texto não tem ganha um nome inventado.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a matrícula que muda de turma sem a marca vira o erro "em uso", e o "já existe" segue sendo só o que nada muda
-    const { nome, matricula } = doTexto.get(lida.linha) ?? { nome: '', matricula: '' }
+    const { nome, matricula } = doTexto.get(lida.linha) ?? { nome: 'x', matricula: '' }
```

O erro deixa de ser reescrito no código da lista.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › cada código de erro da planilha de alunos que a lista alcança vira o equivalente dela
-    if (lida.resultado === 'erro') {
+    if (false && lida.resultado === 'erro') {
```

O código que a lista não alcança vira outro código, calado.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › um código ou resultado que a lista da turma não alcança é falha de contrato, e não texto trocado
-      if (erro === undefined) throw new ApiError(ErrorCode.ERRO_INTERNO)
+      if (erro === undefined) return { linha: lida.linha, nome, matricula, resultado: 'erro', erro: 'sem_nome' }
```

O resultado que a lista não alcança vira "entra", calado.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › um código ou resultado que a lista da turma não alcança é falha de contrato, e não texto trocado
-    if (resultado === undefined) throw new ApiError(ErrorCode.ERRO_INTERNO)
+    if (resultado === undefined) return { linha: lida.linha, nome, matricula, resultado: 'entra' }
```

Contagem que falta no resumo deixa de valer zero.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o resumo sem contagem vale zero, e o cabeçalho não é aluno
-  const { entram = 0, nomes_corrigidos: corrigidos = 0, ja_existem: jaExistentes = 0, transferidos = 0 } = resumo ?? {}
+  const { entram = 7, nomes_corrigidos: corrigidos = 0, ja_existem: jaExistentes = 7, transferidos = 0 } = resumo ?? {}
```

A linha de aluno que a gravação deixou de fora deixa de ser conflito.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a linha que a gravação deixou de fora é CONFLITO, com parte da lista gravada ou sem nada gravado: o texto que a tela diz está em ListaDaTurma.test.tsx
-  if (entram + corrigidos + jaExistentes + transferidos < alunos) throw new ApiError(ErrorCode.CONFLITO)
+  if (entram + corrigidos + jaExistentes + transferidos < 0) throw new ApiError(ErrorCode.CONFLITO)
```

A transferência deixa de contar entre as linhas atendidas.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o nome corrigido conta entre os gravados, e a transferência entre as linhas atendidas
-  if (entram + corrigidos + jaExistentes + transferidos < alunos) throw new ApiError(ErrorCode.CONFLITO)
+  if (entram + corrigidos + jaExistentes < alunos) throw new ApiError(ErrorCode.CONFLITO)
```

O nome corrigido deixa de contar entre os gravados.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o nome corrigido conta entre os gravados, e a transferência entre as linhas atendidas
-  return { gravados: entram + corrigidos, jaExistentes }
+  return { gravados: entram, jaExistentes }
```

O cabeçalho passa a contar como aluno.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o resumo sem contagem vale zero, e o cabeçalho não é aluno
-  return { porLinha, alunos: comCabecalho ? lidas.length - 1 : lidas.length }
+  return { porLinha, alunos: lidas.length }
```

A importação concluída deixa de devolver as contagens.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › manda o texto, espera a importação concluir e devolve as contagens do resumo
-  if (lida.estado === 'concluida') return contagemDaGravacao(lida.resumo, alunos)
+  if (lida.estado === 'concluidaX') return contagemDaGravacao(lida.resumo, alunos)
```

A muda de turma volta a ser "já existe", calada.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a matrícula que muda de turma sem a marca vira o erro "em uso", e o "já existe" segue sendo só o que nada muda
-    if (lida.resultado === 'muda_de_turma') return { linha: lida.linha, nome, matricula, resultado: 'erro', erro: 'matricula_em_uso' }
+    if (lida.resultado === 'muda_de_turma') return { linha: lida.linha, nome, matricula, resultado: 'ja_existe' }
```

O nome corrigido volta a ser "já existe", calado.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o nome corrigido grava, e a tela da lista não sabe dizer isso: é falha de contrato, e não "já existe, nada muda"
-  ja_existe: 'ja_existe',
+  ja_existe: 'ja_existe',
+  nome_corrigido: 'ja_existe',
```

A espera entre as leituras deixa de crescer.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › lê a importação com a espera que cresce: no prazo inteiro são poucas leituras, bem abaixo do limite por usuário
-    espera = Math.min(espera * 1.5, esperaMaximaMs)
+    espera = Math.min(espera * 1, esperaMaximaMs)
```

O limite por usuário numa leitura passa à tela.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › o limite por usuário numa leitura não chega à tela: a ponte espera e, passado o prazo, é indisponibilidade
-    if (erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return ESTADO_NA_FILA
+    if (erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDOX) return ESTADO_NA_FILA
```

A prévia que envelheceu deixa de ser conflito.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a prévia que envelheceu é CONFLITO, e a tela a descarta
-  if (lida.estado === 'desatualizada') throw new ApiError(ErrorCode.CONFLITO)
+  if (lida.estado === 'desatualizadaX') throw new ApiError(ErrorCode.CONFLITO)
```

A importação que falhou deixa de ser erro.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a importação que falhou é falha de servidor, e a prévia fica para tentar de novo
-  if (lida.estado === 'falhou') throw new ApiError(ErrorCode.ERRO_INTERNO)
+  if (lida.estado === 'falhouX') throw new ApiError(ErrorCode.ERRO_INTERNO)
```

A espera deixa de ter prazo.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › desiste depois do prazo, sem esperar para sempre
-    if (Date.now() >= limite) throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
+    if (Date.now() >= limite + 1e9) throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
```

A importação concluída deixa de devolver as contagens e a espera segue.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › manda o texto, espera a importação concluir e devolve as contagens do resumo
-    if (gravacao !== undefined) return gravacao
+    if (gravacao !== undefined && false) return gravacao
```

A tela volta a dizer que nada foi gravado.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a gravação que deixou linha de fora diz que essa linha não foi gravada e aponta a lista, que mostra o que entrou: parcial, nada e prévia que envelheceu
-        [ErrorCode.CONFLITO]: 'Uma das matrículas passou a ser usada em outra turma ou por um aluno depois da prévia, e essa linha não foi gravada. A lista de nomes da turma mostra o que entrou: veja a prévia de novo.',
+        [ErrorCode.CONFLITO]: 'Uma das matrículas passou a ser usada em outra turma ou por um aluno depois da prévia. Nada foi gravado: veja a prévia de novo.',
```

A lista de nomes deixa de ser relida quando a gravação falha, e a que entrou não aparece.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a gravação que deixou linha de fora diz que essa linha não foi gravada e aponta a lista, que mostra o que entrou: parcial, nada e prévia que envelheceu
-      void recarregarNomes()
+      void 0
```

A prévia recusada deixa de sair, e o "Gravar lista" fica.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a gravação que deixou linha de fora diz que essa linha não foi gravada e aponta a lista, que mostra o que entrou: parcial, nada e prévia que envelheceu
falha: queryByRole('button', { name: 'Gravar lista' })).toBeNull()
-      if (listChanged(erro, [ErrorCode.CONFLITO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.NAO_ENCONTRADO])) definirPrevia(undefined)
+      if (listChanged(erro, [ErrorCode.CONFLITO, ErrorCode.ENTRADA_INVALIDA, ErrorCode.NAO_ENCONTRADO])) void 0
```

A primeira espera cai de 1 s para 500 ms.

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a primeira espera é de 1 s e a seguinte, de 1,5 s
-export const ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS = INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS
+export const ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS = 500
```

A espera cresce 2 vezes, e não 1,5. (O teto, `Math.min(…, esperaMaximaMs)`, não é pego aqui: quem o pega é o caso vizinho, que conta as leituras no prazo inteiro.)

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › a primeira espera é de 1 s e a seguinte, de 1,5 s
-    espera = Math.min(espera * 1.5, esperaMaximaMs)
+    espera = Math.min(espera * 2, esperaMaximaMs)
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 03:36:44 | 2026-11-04 03:37:05 | `tenancy-guardian` | 1 | APROVADO | a0968fe1d987fe2c6 |
| 2026-11-04 03:36:37 | 2026-11-04 03:37:16 | `frontend-reviewer` | 1 | APROVADO | a576d536d7486acd0 |
| 2026-11-04 03:36:52 | 2026-11-04 03:37:27 | `conformidade-reviewer` | 1 | APROVADO | af13c64eddf401032 |
| 2026-11-04 03:36:48 | 2026-11-04 03:37:40 | `privacy-guardian` | 1 | APROVADO | a265fb703d5e0d6bd |
| 2026-11-04 03:36:33 | 2026-11-04 03:38:06 | `revisor-geral` | 1 | REPROVADO | ac97c94419f4febf7 |
| 2026-11-04 03:36:41 | 2026-11-04 03:38:25 | `infra-guardian` | 1 | REPROVADO | a089c555d370656f9 |
| 2026-11-04 03:36:29 | 2026-11-04 03:39:48 | `test-engineer` | 1 | REPROVADO | a29a8a068870a4318 |
| 2026-11-04 04:38:07 | 2026-11-04 04:38:36 | `tenancy-guardian` | 2 | APROVADO | a4d2049e5ee8147d0 |
| 2026-11-04 04:38:01 | 2026-11-04 04:38:53 | `frontend-reviewer` | 2 | APROVADO | a567271c9aae71be4 |
| 2026-11-04 04:37:54 | 2026-11-04 04:38:56 | `infra-guardian` | 2 | APROVADO | a235cbe4e6e40c826 |
| 2026-11-04 04:38:14 | 2026-11-04 04:39:06 | `privacy-guardian` | 2 | APROVADO | ab3c3fd9a5b0980e3 |
| 2026-11-04 04:38:20 | 2026-11-04 04:39:10 | `conformidade-reviewer` | 2 | APROVADO | a249b4af6ccb09be5 |
| 2026-11-04 04:37:43 | 2026-11-04 04:39:33 | `revisor-geral` | 2 | APROVADO | ab5adf2454e48a46e |
| 2026-11-04 04:37:33 | 2026-11-04 04:39:38 | `test-engineer` | 2 | REPROVADO | a8cdab71381295ae5 |
| 2026-11-04 04:57:39 | 2026-11-04 04:58:10 | `revisor-geral` | 3 | APROVADO | a0b83088f7eb41c89 |
| 2026-11-04 04:57:57 | 2026-11-04 04:58:11 | `infra-guardian` | 3 | APROVADO | a71ed6fe0812e80fc |
| 2026-11-04 04:57:49 | 2026-11-04 04:58:15 | `frontend-reviewer` | 3 | APROVADO | a56eda14fb1b6630b |
| 2026-11-04 04:58:03 | 2026-11-04 04:58:22 | `tenancy-guardian` | 3 | APROVADO | a6910df1f6d8db633 |
| 2026-11-04 04:58:10 | 2026-11-04 04:58:28 | `privacy-guardian` | 3 | APROVADO | a3798fd665109fa89 |
| 2026-11-04 04:57:29 | 2026-11-04 04:58:30 | `test-engineer` | 3 | APROVADO | a845435eeb69e8048 |
| 2026-11-04 04:58:16 | 2026-11-04 04:58:32 | `conformidade-reviewer` | 3 | APROVADO | a2829cd25467937b7 |
