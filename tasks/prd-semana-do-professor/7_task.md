# Tarefa 7.0 — O painel da aula e "Preparar esta aula"

**Funcionalidade:** semana-do-professor · **Depende de:** 4.0, 6.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O painel da aula deixa a professora escrever e corrigir o que vai dar; "Preparar esta aula" leva ao Início com a turma.

## Contexto necessário

- `techspec.md` seções 7 e 9; `cenarios.md` T2, T3, T4, T7, T9; `prd.md` RF5, RF8, RF9, RF15
- `docs/interface.md` 1.8 (6.0): medidas e textos; não edite
- `apps/web/src/areas/professor/turmas/PainelDaContestacao.tsx`: o `Sheet` com texto livre, aviso e foco
- `apps/web/src/areas/professor/assistente/memoria-do-professor.ts:43` (`CONTEXTO_ESCOLHIDO`) e `CaixaDoAssistente.tsx:116`
- `apps/web/src/areas/professor/atividades/Aprovar.tsx`: o contador de `text-limits`

## Subtarefas

- [x] 7.1 — `PainelDaAula`: o `Sheet` de `?aula=<vinculoId>.<data>.<HHMM>`, como na seção 9
- [x] 7.2 — A mutação do `PUT`, um envio por vez; os erros da seção 9; rascunho só em memória
- [x] 7.3 — "Preparar esta aula": a turma em `CONTEXTO_ESCOLHIDO` e o Início, sem conversa nova
- [x] 7.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx`, `apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx` | novo |
| `apps/web/src/areas/professor/turmas/semana/Semana.tsx` | alterado |
| `apps/web/src/areas/professor/turmas/api/aulas.ts` | novo |
| `e2e/professor-semana-painel.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| T2: escrever, salvar, reabrir; o selo some; o aviso está no painel | e2e | RF5, RF6 | `e2e/professor-semana-painel.spec.ts` › T2: escrever, salvar, reabrir e achar o texto; o cartão mostra o texto sem recarregar e o selo some; o aviso está no painel |
| depois de salvar, o cartão mostra o texto sem recarregar | e2e | cache | o mesmo T2 (`leituras` fica em 1 depois do salvar); unidade: `PainelDaAula.test.tsx` › manda um PUT com o vínculo, a data, o início e o texto; o cartão mostra o texto sem uma leitura nova |
| "Salvar" com clique duplo manda um `PUT` (contados com `page.on('request')`) | e2e | RF15 | `e2e/professor-semana-painel.spec.ts` › RF15: o clique duplo em "Salvar" manda um PUT só (contado com `page.on('request')`, os dois cliques na mesma tarefa); unidade: `PainelDaAula.test.tsx` › RF15: o clique duplo em "Salvar" manda uma gravação só |
| T3: falha, a frase e o texto guardado | e2e | erro | `e2e/professor-semana-painel.spec.ts` › T3: a falha diz a frase e guarda o texto; salvar de novo tira a frase, e reabrir não a traz de volta |
| T3: `NAO_ENCONTRADO`, a aula saiu da grade e o texto não foi salvo | e2e | erro | `e2e/professor-semana-painel.spec.ts` › T3: `NAO_ENCONTRADO` diz que a aula saiu da grade e que o texto não foi salvo, e o texto fica no campo |
| T4: Início com a turma marcada, conversas iguais antes e depois | e2e | RF8 | `e2e/professor-semana-painel.spec.ts` › T4: abre o Início com a turma marcada; o número de conversas é o mesmo antes e depois |
| "Preparar" não manda o texto a requisição nenhuma | e2e | regra 20 | `e2e/professor-semana-painel.spec.ts` › "Preparar" não manda o texto a requisição nenhuma, nem grava a aula |
| T7: troca de escola com o painel e o rascunho, nada da anterior | e2e | RF9 | `e2e/professor-semana-painel.spec.ts` › T7, RF9: a troca de escola com o painel aberto e o rascunho digitado: o painel fecha e nada da escola anterior fica |
| T7: a saída da conta, o mesmo | e2e | recomeço, segunda pessoa | `e2e/professor-semana-painel.spec.ts` › T7, RF9: a sessão que vence com o painel aberto e o rascunho digitado, e entra outra pessoa: nada da primeira fica |
| T7: o rascunho nunca em `localStorage` nem `sessionStorage` | e2e | regra 50, item 7 | `e2e/professor-semana-painel.spec.ts` › T7: o rascunho nunca está em `localStorage` nem em `sessionStorage`, nem no endereço; unidade: `PainelDaAula.test.tsx` › o texto digitado nunca vai a `localStorage` |
| fechar sem salvar e reabrir: o comportamento escolhido, sem o navegador | e2e | rascunho | `e2e/professor-semana-painel.spec.ts` › fechar sem salvar descarta o rascunho, sem diálogo do navegador: reabrir mostra o texto gravado |
| recomeço: o mesmo `?aula=` colado de novo com o painel aberto | e2e | mesma entrada | `e2e/professor-semana-painel.spec.ts` › recomeço: o mesmo `?aula=` colado de novo com o painel aberto não abre dois, não lê de novo e mantém o endereço |
| recomeço: o `PUT` de A segurado, B aberta, nada de A em B | e2e | resposta atrasada | `e2e/professor-semana-painel.spec.ts` › recomeço: a gravação de A segurada no ar, B aberta: nada de A em B, e o texto de A chega ao cartão dela |
| recomeço: depois do erro, salvar tira a frase; reabrir não a traz | e2e | falha com o painel aberto | `e2e/professor-semana-painel.spec.ts` › T3: a falha diz a frase e guarda o texto; salvar de novo tira a frase, e reabrir não a traz de volta; unidade: `PainelDaAula.test.tsx` › fechar com "Fechar" sem salvar descarta o rascunho: reabrir mostra o texto gravado, e a falha de antes não volta |
| `?aula=` reabre no recarregar; fechar o tira do endereço | e2e | endereço | `e2e/professor-semana-painel.spec.ts` › `?aula=` reabre o painel no recarregar com o texto gravado; fechar tira do endereço |
| `?aula=` que não é aula dela não abre nem diz se existe | e2e | regra 10, item 6 | `e2e/professor-semana-painel.spec.ts` › RF9, regra 10: `?aula=` de aula que não é dela (de outra escola, ou que não existe) não abre painel, não diz se existe e sai do endereço |
| rótulo "O que vou dar" até hoje, "O que foi dado" depois (S14) | unidade | RF5 | `PainelDaAula.test.tsx` › S14: "O que vou dar" na aula de hoje, "O que foi dado" na de ontem |
| contador com `aria-live="polite"`; o 501º caractere não entra | unidade | acessibilidade, limite | `PainelDaAula.test.tsx` › o contador é uma região `aria-live="polite"`, e o 501º caractere não entra; `Textarea.test.tsx` › com `contadorAnunciado` |
| o foco volta ao cartão com Esc e com o botão | e2e | foco | `e2e/professor-semana-painel.spec.ts` › o foco volta ao cartão da aula com Esc e com o botão "Fechar" |
| lateral no `chromebook`, folha de baixo a 360 px sem rolagem (T9) | e2e (`celular`) | D51 | `e2e/professor-semana-painel.spec.ts` › o painel é lateral no computador e folha de baixo a 360 px, sem rolagem de lado |
| "Salvar" e "Preparar" 44 × 44; fechar 24 × 24 | e2e (`celular`) | regra 50, 2a | `e2e/professor-semana-painel.spec.ts` › os alvos: "Salvar" e "Preparar" com 44 × 44, e "Fechar" com 24 × 24 ou mais |
| axe sem violação com o painel aberto | e2e | acessibilidade | `e2e/professor-semana-painel.spec.ts` › axe: sem violação grave com o painel aberto |

## Como testar

- `e2e/professor-turmas.spec.ts › o complemento da contestação nunca vai ao endereço…` e `› a contestação abre num painel…`
- Resposta segurada: `e2e/acesso-da-turma.spec.ts:924`; troca de escola: `e2e/escola-e-vinculos.spec.ts:141`
- Início com a turma: `e2e/professor-inicio.spec.ts › com dado: o Assistente se apresenta e a caixa tem a turma…`
- Dados: `e2e/support/professor/semana.ts` (6.0), sem editá-lo
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana-painel.spec.ts`
- Telas: `professora`, `/professor/turmas?ver=semana&aula=<…>`, aberto e com erro

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: o clique duplo e a resposta atrasada com a ordem forçada.

## Fora do escopo desta tarefa

Grade (6.0), itens (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

**Sem bloco, com o motivo.** (1) **`PainelDaAula.tsx:55`**, o `lida === undefined ? lida : …` do atualizador de `setQueriesData`: o TanStack passa
`undefined` à consulta da semana que ainda não tem dado, e a guarda devolve o que veio; nenhum caso tem uma segunda semana em voo na hora da gravação, e sem
ela é erro de tipo, não de comportamento. (2) Nas linhas que **têm** bloco, as cláusulas que o bloco não troca existem só para o tipo: o `pedida === undefined`
de `Semana.tsx:137` (sem `pedida` não há `aula`, que sai antes), o `=== undefined` do `vinculoId`, da `data` e da `hora` de `semana.ts:182` (o `length !== 3`
do bloco já garante os três, e o `noUncheckedIndexedAccess` pede a guarda) e o `?? focos.titulo.current` de `Semana.tsx:293` (o cartão da aula está na página
sempre que há painel, porque a aula vem da mesma resposta que desenha os cartões; o `??` é do `null` do `querySelector`).

--faltando: 1 linhas (0 blocos, 1 motivos)

Sem o texto gravado como base, reabrir o painel mostraria o campo vazio e não o texto salvo.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › descarta o rascunho
-  const valor = escrito ?? aula.texto ?? ''
+  const valor = escrito ?? ''
```

O código que decide a frase: só `NAO_ENCONTRADO` é "a aula saiu da grade".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › diz que a aula saiu da grade
-  const saiuDaGrade = gravar.error instanceof ApiError && gravar.error.codigo === ErrorCode.NAO_ENCONTRADO
+  const saiuDaGrade = gravar.error instanceof ApiError && gravar.error.codigo !== ErrorCode.NAO_ENCONTRADO
```

Sem a trava, o clique duplo manda duas gravações (RF15).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › RF15: o clique duplo
-    if (gravando.current) return
+    
```

Enquanto grava, o botão diz "Salvando…".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › RF15: o clique duplo
-            {gravar.isPending ? 'Salvando…' : 'Salvar'}
+            {'Salvar'}
```

A sala só aparece quando há sala.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › o painel diz o dia
-          {aula.sala !== null && <p className="min-w-0 break-words text-apoio">Sala {aula.sala}</p>}
+          {aula.sala === null && <p className="min-w-0 break-words text-apoio">Sala {aula.sala}</p>}
```

E a aula sem sala não diz "Sala" com nada depois.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › a aula sem sala
falha: queryByText(/^Sala/)
-          {aula.sala !== null && <p className="min-w-0 break-words text-apoio">Sala {aula.sala}</p>}
+          {true && <p className="min-w-0 break-words text-apoio">Sala {aula.sala}</p>}
```

"Fora da grade" só na aula que saiu da grade.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › fora da grade que ficou sem texto
-          {aula.foraDaGrade && (
+          {!aula.foraDaGrade && (
```

A frase de falha só aparece depois de uma falha: reaberto, o painel não a traz.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › descarta o rascunho
falha: queryByRole('alert')
-        {gravar.isError && (
+        {true && (
```

A frase da aula que saiu da grade é a de `NAO_ENCONTRADO`.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › diz que a aula saiu da grade
-            {saiuDaGrade ? FRASE_DA_AULA_QUE_SAIU : FRASE_DA_FALHA_AO_SALVAR}
+            {FRASE_DA_FALHA_AO_SALVAR}
```

Só o `?aula=` pedido por quem tem a aula abre o painel: sem o `pedida`, a tela quebra no `acharAula`.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › o clique no cartão abre o painel
-  const aula = pedida === undefined || dados === undefined ? undefined : acharAula(dados.dias, pedida)
+  const aula = dados === undefined ? undefined : acharAula(dados.dias, pedida)
```

E antes da leitura não há aula para achar.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › aberto pelo endereço, sem cartão
-  const aula = pedida === undefined || dados === undefined ? undefined : acharAula(dados.dias, pedida)
+  const aula = pedida === undefined ? undefined : acharAula(dados.dias, pedida)
```

O `?aula=` que é de uma aula achada não sai do endereço: sem o `aula === undefined`, o painel abriria e fecharia no mesmo instante.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › o clique no cartão abre o painel
-  const semDono = new URLSearchParams(busca).has('aula') && dados !== undefined && aula === undefined
+  const semDono = new URLSearchParams(busca).has('aula') && dados !== undefined
```

Antes de a semana ser lida não se sabe de quem é a aula: o endereço não é limpo.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › aberto pelo endereço, sem cartão
-  const semDono = new URLSearchParams(busca).has('aula') && dados !== undefined && aula === undefined
+  const semDono = new URLSearchParams(busca).has('aula') && aula === undefined
```


Sem `?aula=` o endereço não é mexido.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › o endereço não é reescrito
falha: not.toHaveBeenCalled()
-  const semDono = new URLSearchParams(busca).has('aula') && dados !== undefined && aula === undefined
+  const semDono = dados !== undefined && aula === undefined
```

O `?aula=` que não é aula dela sai do endereço.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › não é aula da semana lida
-    if (semDono) navegar(enderecoSemAula(caminho, busca), { replace: true })
+    if (false) navegar(enderecoSemAula(caminho, busca), { replace: true })
```

Sem aula achada, não há painel: sem a segunda cláusula o painel abriria sem aula.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › não é aula da semana lida
-  if (pedida === undefined || aula === undefined) return undefined
+  if (pedida === undefined) return undefined
```

A aula que saiu da grade pede a semana de novo ao fechar.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › diz que a aula saiu da grade
-    if (atualizar) void cliente.invalidateQueries({ queryKey: SEMANA_QUERY_KEY })
+    if (false) void cliente.invalidateQueries({ queryKey: SEMANA_QUERY_KEY })
```

Sem painel não se desenha o painel.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › o clique no cartão abre o painel
-      {painel !== undefined && dados !== undefined && (
+      {dados !== undefined && (
```

O foco volta ao cartão da aula, também quando o painel abriu pelo endereço.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx › aberto pelo endereço, sem cartão
-          focoDeReserva={() => (document.querySelector<HTMLElement>(`[data-aula="${painel.chave}"]`) ?? focos.titulo.current)?.focus()}
+          focoDeReserva={() => focos.titulo.current?.focus()}
```

Sem o `?? ''`, a semana sem `?aula=` quebra.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › lê o vínculo, a data e o início
falha: aulaDoEndereco('ver=semana')
-  const partes = (new URLSearchParams(busca).get('aula') ?? '').split('.')
+  const partes = (new URLSearchParams(busca).get('aula')).split('.')
```

O `?aula=` com pedaço a mais não é aula.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › lê o vínculo, a data e o início
falha: 0730.x
-  if (partes.length !== 3 || vinculoId === undefined || data === undefined || hora === undefined) return undefined
+  if (vinculoId === undefined || data === undefined || hora === undefined) return undefined
```

Vínculo que não é UUID não é aula.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › lê o vínculo, a data e o início
falha: aula=1837
-  if (!UUID.test(vinculoId) || !ehDataValida(data) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
+  if (!ehDataValida(data) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
```

Data que não existe não é aula.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › lê o vínculo, a data e o início
falha: 2026-02-30
-  if (!UUID.test(vinculoId) || !ehDataValida(data) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
+  if (!UUID.test(vinculoId) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
```

Hora que não existe não é aula.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › lê o vínculo, a data e o início
falha: .2561
-  if (!UUID.test(vinculoId) || !ehDataValida(data) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
+  if (!UUID.test(vinculoId) || !ehDataValida(data)) return undefined
```

A hora 24 não existe.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › lê o vínculo, a data e o início
falha: .2400
-  if (!UUID.test(vinculoId) || !ehDataValida(data) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
+  if (!UUID.test(vinculoId) || !ehDataValida(data) || !/^([01]\d|2[0-4])[0-5]\d$/.test(hora)) return undefined
```

A aula é a do dia pedido.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › acha pela data
falha: data: '2026-11-12'
-  return dias.find((dia) => dia.data === pedida.data)?.aulas.find((aula) => aula.vinculoId === pedida.vinculoId && aula.inicio === pedida.inicio)
+  return dias.flatMap((dia) => dia.aulas).find((aula) => aula.vinculoId === pedida.vinculoId && aula.inicio === pedida.inicio)
```

E é a do vínculo pedido: a de outro vínculo, no mesmo horário, não abre.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › acha pela data
falha: 000000000999
-  return dias.find((dia) => dia.data === pedida.data)?.aulas.find((aula) => aula.vinculoId === pedida.vinculoId && aula.inicio === pedida.inicio)
+  return dias.find((dia) => dia.data === pedida.data)?.aulas.find((aula) => aula.inicio === pedida.inicio)
```

E é a do início pedido: a aula dupla não confunde as duas.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › acha pela data
falha: ?.fim).toBe('09:10')
-  return dias.find((dia) => dia.data === pedida.data)?.aulas.find((aula) => aula.vinculoId === pedida.vinculoId && aula.inicio === pedida.inicio)
+  return dias.find((dia) => dia.data === pedida.data)?.aulas.find((aula) => aula.vinculoId === pedida.vinculoId)
```

O texto gravado só entra no dia da gravação.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o texto gravado entra só na aula da gravação
falha: nova.dias[1]?.aulas[0]?.texto
-    if (dia.data !== gravado.data) return dia
+    
```

E só no vínculo da gravação: a outra disciplina no mesmo horário não ganha o texto.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o texto gravado entra só na aula da gravação
-      if (aula.vinculoId !== gravado.vinculoId || aula.inicio !== gravado.inicio) return [aula]
+      if (aula.inicio !== gravado.inicio) return [aula]
```

E só no início da gravação: a aula dupla guarda o texto de cada uma.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o texto gravado entra só na aula da gravação
-      if (aula.vinculoId !== gravado.vinculoId || aula.inicio !== gravado.inicio) return [aula]
+      if (aula.vinculoId !== gravado.vinculoId) return [aula]
```

O texto apagado só tira a aula que saiu da grade: a da grade fica, sem texto.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › apagar o texto
-      return gravado.texto === null && aula.foraDaGrade ? [] : [{ ...aula, texto: gravado.texto }]
+      return gravado.texto === null ? [] : [{ ...aula, texto: gravado.texto }]
```

E a que saiu da grade só some se ficou sem texto: com texto novo, ela fica.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a aula fora da grade que ganha texto fica
-      return gravado.texto === null && aula.foraDaGrade ? [] : [{ ...aula, texto: gravado.texto }]
+      return aula.foraDaGrade ? [] : [{ ...aula, texto: gravado.texto }]
```

O contador anunciado é região `aria-live` polida.

```mutacao
arquivo: apps/web/src/components/ui/fields/Textarea.tsx
teste: apps/web/src/components/ui/fields/Textarea.test.tsx › com `contadorAnunciado`
-        <p id={idDoContador} {...(contadorAnunciado ? { 'aria-live': 'polite' as const } : {})} className="ml-auto shrink-0 text-sm text-sutil tabular-nums">
+        <p id={idDoContador} className="ml-auto shrink-0 text-sm text-sutil tabular-nums">
```

E o contador comum, não: a região viva é de quem pede.

```mutacao
arquivo: apps/web/src/components/ui/fields/Textarea.tsx
teste: apps/web/src/components/ui/fields/Textarea.test.tsx › é lido ao chegar no campo
falha: getAttribute('aria-live')).toBeNull
-        <p id={idDoContador} {...(contadorAnunciado ? { 'aria-live': 'polite' as const } : {})} className="ml-auto shrink-0 text-sm text-sutil tabular-nums">
+        <p id={idDoContador} aria-live="polite" className="ml-auto shrink-0 text-sm text-sutil tabular-nums">
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | Quando a vitrine tiver grade, fotografar `/professor/turmas?ver=semana&aula=<…>` e conferir que o painel não mostra rótulo de IA | Validador: fotografa cada requisito com tela no fim da spec; esta rodada não teve fotos (a vitrine não tem grade importada) |
| conformidade-reviewer (1ª) | Quem auditar a 4.0 confirma que o texto da aula não chega à coordenação de forma nominal nem entra em indicador de professor (regra 70, item 8) | Validador, na conferência do RF do backend; não está no diff da 7.0 |
| infra-guardian (1ª) | `Semana.tsx`, `fechar`: invalidar só a chave da semana aberta, em vez de `SEMANA_QUERY_KEY` inteira | `TODO.md`: muda o que é relido; hoje só a semana na tela é relida e o caso (`NAO_ENCONTRADO`) é raro |
| frontend-reviewer (1ª) | 1. "Preparar esta aula" descarta o rascunho não salvo, e a dica só fala de "Fechar sem salvar" | Decisão de produto: o texto da dica é de `docs/interface.md` 1.8, e a Tech Spec diz que Preparar não grava. Vai ao Arquiteto na retro |
| frontend-reviewer (1ª) | 2. Esc ou "Fechar" durante "Salvando…" fecha o painel, e o erro de uma falha tardia some com ele | Comportamento escolhido pela Tech Spec; registrado para a retro |
| frontend-reviewer (1ª) | 3. `Semana.tsx:133-136`: a semana relida sem a aula fecha o painel sozinho, com o rascunho dentro e sem frase | `TODO.md`: muda comportamento (o refetch ao voltar à janela); precisa de decisão do Arquiteto sobre manter o painel aberto |
| frontend-reviewer (1ª) | 4. `PainelDaAula.tsx:86`: o "Salvar" desligado durante a gravação pode deixar o foco no botão desligado | Validador: conferir com leitor de tela, como o revisor pede |
| revisor-geral (1ª) | Aula fora da grade apagada pelo painel: o cartão some e o `focoDeReserva` não acha o `[data-aula]`; o foco "provavelmente" cai no `body` | `TODO.md`: o revisor não confirmou o defeito; confirmar no navegador na validação e, se for real, corrigir com caso próprio |
| revisor-geral (1ª) | `Textarea` ganhou `contadorAnunciado`: ver se a galeria e a linha 10.2 do `docs/interface.md` precisam citá-la | Arquiteto: o `docs/interface.md` não se edita nesta tarefa (Contexto necessário) |
| revisor-geral (1ª), test-engineer (1ª) | A linha `--faltando: 1 linhas (0 blocos, 1 motivos)` na seção "Mutações" parece sobra da ferramenta | Recusada: é a convenção da casa, a mesma linha está em 30 documentos de tarefa (`grep -rn "^--faltando:" tasks`), e o texto traz o motivo da linha sem bloco |
| test-engineer (1ª) | T3 de `NAO_ENCONTRADO`: tirar a aula da grade no banco com o painel aberto, em vez de `page.route` | `TODO.md`: o `NAO_ENCONTRADO` do servidor está provado em `apps/api/test/aulas.int.test.ts` (G1, R4 e J14), e o sumiço do cartão está provado na unidade; o ponta a ponta é ganho, não lacuna de RF |
| test-engineer (2ª) | `PainelDaAula.test.tsx:358`: `expect(CONTEXTO_ESCOLHIDO.ler()).not.toContain('Fra')` nunca falha, porque a linha 352 já exige o valor exato de `valorDoContexto(...)` | Não aplicada: a asserção só repete a de cima e não custa nada; `TODO.md`, junto dos menores desta tarefa |
| test-engineer (2ª), privacy-guardian (2ª) | `PainelDaAula.test.tsx:359`: `{ ...localStorage, ...sessionStorage }` lê o armazenamento de forma indireta; ler com `Object.keys` e `getItem` em cada área | Não aplicada: só legibilidade, e o teste prova o que deve; `TODO.md`, junto dos menores desta tarefa |
| test-engineer (2ª) | Sem bloco ` ```mutacao ` para a comparação de `vinculoId` em `semana.ts:227` (`comTextoGravado`), que o caso novo de `semana.test.ts:298` prova | Não aplicada: a cláusula não é nova nesta rodada, e a prova do caso foi conferida à mão pelo `test-engineer` e pelo `tenancy-guardian`; `TODO.md` |
| revisor-geral (2ª) | O comentário de `preparar` (`PainelDaAula.tsx:64-66`) está longo e fala do futuro (F11); a orientação cabe melhor em `docs/lgpd.md` ou no `TODO.md` | Não aplicada: o `privacy-guardian` pediu esse comentário na 1ª rodada, e `docs/lgpd.md` não se edita nesta tarefa; no `TODO.md`, ao lado do item da F11 |
| frontend-reviewer (2ª), conformidade-reviewer (2ª) | Fotografar o painel (1366 e 360 px), o "Salvar" desligado com leitor de tela e o foco quando o cartão some | Já na tabela da rodada 1: Validador |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 00:31:28 | 2026-11-07 00:31:53 | `conformidade-reviewer` | 1 | APROVADO | a7d4a4ee6431b51a1 |
| 2026-11-07 00:31:30 | 2026-11-07 00:31:57 | `infra-guardian` | 1 | APROVADO | aaaab1490c2fa1a24 |
| 2026-11-07 00:31:19 | 2026-11-07 00:32:03 | `privacy-guardian` | 1 | APROVADO | a8cff4c7125443f22 |
| 2026-11-07 00:31:16 | 2026-11-07 00:32:03 | `frontend-reviewer` | 1 | APROVADO | a33318e4ef1a82518 |
| 2026-11-07 00:31:25 | 2026-11-07 00:32:07 | `tenancy-guardian` | 1 | APROVADO | a017b63febb7046f5 |
| 2026-11-07 00:31:23 | 2026-11-07 00:32:48 | `revisor-geral` | 1 | APROVADO | ae96c09c0bbb6a9af |
| 2026-11-07 00:31:21 | 2026-11-07 00:33:29 | `test-engineer` | 1 | APROVADO | a0596b8acfb1216df |
| 2026-11-07 00:53:44 | 2026-11-07 00:54:05 | `frontend-reviewer` | 2 | APROVADO | aceec13af345486fb |
| 2026-11-07 00:53:51 | 2026-11-07 00:54:15 | `privacy-guardian` | 2 | APROVADO | aebbcc30e44f6d98c |
| 2026-11-07 00:54:15 | 2026-11-07 00:54:33 | `tenancy-guardian` | 2 | APROVADO | afb80954637af24d1 |
| 2026-11-07 00:54:21 | 2026-11-07 00:54:39 | `conformidade-reviewer` | 2 | APROVADO | ab88742f57f9fb4f6 |
| 2026-11-07 00:54:26 | 2026-11-07 00:54:43 | `infra-guardian` | 2 | APROVADO | a111e1740f50a1813 |
| 2026-11-07 00:54:00 | 2026-11-07 00:54:43 | `test-engineer` | 2 | APROVADO | a81f9a5f2ffeffaf5 |
| 2026-11-07 00:54:08 | 2026-11-07 00:54:49 | `revisor-geral` | 2 | APROVADO | a8f542863a1d47bcf |
