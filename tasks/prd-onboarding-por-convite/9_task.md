# Tarefa 9.0 — A coordenação transfere o aluno pela planilha, e o pedido pendente se encerra

**Funcionalidade:** onboarding-por-convite · **Depende de:** 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O aluno marcado "muda de turma" tem o vínculo antigo encerrado pelo `encerrar` (que revoga o acesso da turma) e o novo
confirmado no mesmo instante; o trabalho feito fica na turma antiga; o pedido pendente é encerrado pelo
`fechar('encerrada')`, que o `virarSala` passa a usar também.

## Contexto necessário

- `techspec.md` §5 "O job" passo (3) (turmas tocadas: destino, origem e turma de todo marcado; pedidos relidos;
  `fechar('encerrada')` antes de apagar a `lista_nome`), "Gravar" ("transferência")
- `prd.md` RF4 (marca), RF5, RF17; PRD §7 "Transferido com pedido pendente"
- `cenarios.md` RF5 (a transferência); Corridas ("Job contra a decisão do professor", "Reivindicação contra o passo (3)")
- Código: `packages/core/src/estrutura/vinculo.repository.ts` (`encerrar`), `decisao.repository.ts` (`fechar`,
  `travarPendente`); `apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts` (`virarSala`)

## Subtarefas

- [x] 9.1 — Marca "muda de turma": `encerrar` (`realocacao`), vínculo confirmado na nova, `lista_nome` na nova turma
- [x] 9.2 — `fechar('encerrada')`: grava só o estado e anula os segredos, sem `decidida*`; o `virarSala` passa por ele
- [x] 9.3 — Escrita condicional: `lista_nome` com `where estado = :lido`; zero linhas, `encerrar` que devolve `false` ou `vinculo_ativo_unico` violado: `desatualizada`
- [x] 9.4 — Auditoria `aluno.transferido` (origem e destino), `vinculo.criado` e `vinculo.encerrado` com a origem
- [x] 9.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | alterado |
| `packages/core/src/estrutura/decisao.repository.ts`, `vinculo.repository.ts` | alterado |
| `apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts` | alterado |
| `apps/worker/test/transferencia-pela-planilha.int.test.ts`, `apps/api/test/virada-do-ano.int.test.ts` | novo; alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| O transferido alcança a turma nova e não a antiga | integração | caminho feliz (RF5) | `transferencia-pela-planilha.int.test.ts › o transferido alcança a turma nova …` |
| A resposta de atividade continua presa à turma antiga | integração | RF5 | `… › a resposta de atividade do transferido continua presa à turma antiga …` |
| A transferência passa pelo `encerrar`: o acesso da turma antiga é revogado | integração | RF5 | `… › a transferência passa pelo encerramento …` |
| Transferido com pedido pendente: pedido `encerrada`, nome livre na turma nova | integração | borda do PRD | `… › transferido com pedido pendente …` |
| O pedido encerrado fica sem `decididaEm`, `decididaPor` e `decididaComo` | integração | `fechar('encerrada')` | `… › o pedido encerrado pela transferência fica sem …` |
| `virarSala` encerra o pedido pendente sem gravar `decidida*` | integração | a mesma função | `virada-do-ano.int.test.ts › V1: o acesso fica revogado, o pendente vira `encerrada` sem segredo …` (o `fechar` chamado com o ano e `'encerrada'`, e o pedido sem `decidida*`) |
| Sem marca, "muda de turma" não muda nada | integração | RF4 | `… › sem a marca, "muda de turma" não muda nada …` |
| [P] Transferência contra o professor aprovando a mesma linha, uma parte parada: nenhum aprovado fica na turma antiga | [P] | a aprovação vai primeiro (o `DecisaoService` real) | `… › [P] a transferência contra o professor aprovando o mesmo pedido pelo `DecisaoService` …` |
| [P] O mesmo, na outra direção: o job leva o nome à turma nova e o professor da turma antiga aprova depois, com o job parado no (3) | [P] | o pedido `encerrada` antes da decisão: `ja_decidida`, ninguém nasce na turma antiga | `… › [P] o professor aprovando pelo `DecisaoService` com o job parado depois de encerrar o pedido …` |
| [P] O usuário do aluno transferido preso por outra transação: o job espera e conclui | [P] | trava do usuário (ordem global) | `… › [P] o usuário do aluno transferido preso por outra transação …` |
| [P] Reivindicação parada no nome da turma antiga contra o (3): recusada ou `desatualizada`; nunca pendente com o nome em outra turma | [P] | `where estado = :lido` | `… › [P] a reivindicação parada no nome livre …` |
| [P] Vínculo do aluno encerrado à mão entre o (2) e o (3): `desatualizada`, sem vínculo novo | [P] | releitura | `… › [P] o vínculo do aluno encerrado à mão …` |
| [P] Aluno a transferir desativado de verdade (`CicloDeVidaService.desativar`) entre o (2) e o (3): `desatualizada`, sem vínculo novo, lista intacta, os outros marcados intactos | [P] | releitura | `… › [P] o aluno a transferir desativado de verdade …` |
| [P] Aluno levado a outra turma à mão com o job parado na escrita: `desatualizada` | [P] | conferência por contagem do `transferirAprovados` e do `transferirNomes` | `… › [P] o aluno aprovado levado à 8C à mão …` e `[P] o nome livre levado à 8C à mão …` |
| Isolamento dos métodos novos: no contexto da A, o ano e os ids da B não mudam a B | integração | regra 10, item 5 | `… › isolamento dos métodos da transferência …` |
| Marca de um aluno da B: `ENTRADA_INVALIDA` | integração | isolamento | `… › a marca de um aluno de outra escola, ou com a ação trocada …` |
| Auditoria `aluno.transferido` com a origem e o destino | integração | RF17 | `… › a auditoria da transferência …` |
| Auditoria `vinculo.criado` e `vinculo.encerrado` da transferência | integração | RF17 | `… › a auditoria da transferência …` |

## Como testar

- Reivindicação: `apps/api/test/salas-reivindicar.int.test.ts › pelo código e pelo link: enviado; o pedido pendente guarda o hash argon2id da senha, …`; decisão: `apps/api/test/decisao.int.test.ts › E18: as escritas da aprovação; …`
- Revogação: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, …`
- `virarSala`: `apps/api/test/virada-do-ano.int.test.ts › caminho feliz: confirmado, pendente, contestado e alunos vão a encerrado por fim_do_ano; …`
- Barreira: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Comando: `npx vitest run --project integracao apps/worker/test/transferencia-pela-planilha.int.test.ts apps/api/test/virada-do-ano.int.test.ts`
- Armadilha: nos [P] com aprovação, só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o aluno com pedido pendente **e** outro aprovado, nas duas turmas.

## Fora do escopo desta tarefa

Desligamento e virada de ano (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A transferência não usa o `encerrar(id)` do `VinculoRepository`: usa `encerrarDosAlunos` (por aluno e turma, num ano dado, com `FOR UPDATE` em ordem de id), que faz a mesma escrita com `realocacao` | O `encerrar` da coordenação alcança só o vínculo de professor do ano em curso e devolve `boolean` por id; a planilha tem o par (aluno, turma) e grava num ano que pode não ser o em curso. O aluno não gera `acesso_turma` (`criado_por` é de professor), então não há acesso a revogar; o "acesso da turma antiga revogado" é o vínculo `encerrado` | `techspec.md` §5 "Gravar" ("transferência"); `cenarios.md` RF5 |
| Ação de auditoria nova `lista.transferida` (entidade `lista_nome`, `depois` com as turmas de origem e destino), além de `aluno.transferido` | O nome ainda não aprovado também muda de turma e a auditoria responde por ele; só o id e as duas turmas, sem nome nem matrícula (regra 20, item 10) | `techspec.md` §5 "Gravar"; `cenarios.md` RF17 |
| `vinculo.criado` aceita `estado: confirmado` e traz `origem`; `vinculo.encerrado` traz `origem` | A transferência cria o vínculo já confirmado, com origem `lista`, e o contrato da ação só previa o `pendente` | `cenarios.md` RF17 |
| A marca vale para a ação do candidato: o gravar confere `acao:id`, não só o id | O id de quem sai da planilha, marcado em `transferir`, não pode transferir nem desligar ninguém; a 8.0 conferia só o id | `techspec.md` §4 (marcas); `cenarios.md` RF4 |
| A planilha cria a turma que só a linha "muda de turma" pede, e só com a marca (`turmas_novas` do resumo conta as duas); `transferidos` entra no resumo só quando maior que zero | Sem marca a linha não grava nada, nem a turma nova; as contagens que não houve não entram | `techspec.md` §5 "Gravar"; `cenarios.md` RF5 |
| `DecisaoRepository.fechar` ganha uma sobrecarga: `fechar({ listaNomeIds } \| { anoLetivoId }, 'encerrada')` devolve os ids fechados; a decisão por id (`aprovada`/`recusada`) segue igual | Um `fechar` só para as duas formas de fechar; o `virarSala` e a planilha passam pelo mesmo código | `techspec.md` §5 "Gravar"; regra 70, item 2 |
| A rota não ganha teste de isolamento próprio: o `ENTRADA_INVALIDA` da marca de outra escola e da ação trocada é provado no motor | A rota só repassa as marcas ao motor (`ImportacaoService.gravar`), que as confere contra os candidatos da prévia do mesmo ano e da mesma escola | `cenarios.md` RF5 |
| Arquivos além dos "previstos": `lista.repository.ts`, `importacao.repository.ts`, `estrutura/index.ts`, `motor.ts`, `tipo.ts`, `acoes.ts`, `alunos.test.ts`, `calendario.test.ts` (a assinatura do `planejar` ganhou as marcas) e `apps/api/test/architecture.test.ts` (a lista fechada das ações sobre `usuario` ganhou `aluno.transferido`, assinada pela coordenação) | A escrita em lote da lista, o `travar` e as marcas passam por eles; o resto é o contrato do tipo | `techspec.md` §5 "O job" |

## Mutações

--faltando: 18 linhas (28 blocos, 4 motivos)

**Sem bloco (motivo):** (1) o filtro `escolaId` do `update` de `encerrarDosAlunos` (`inArray(vinculo.id, …)`): os ids vêm do `select` da mesma função, que já tem o filtro (bloco próprio); (2) o atalho `pares.length === 0` e `transferencias.length === 0` dos repositories: sem ele o `or()` ou o `values` vazio não escreve nada, e o resultado é o mesmo; (3) os ramos de forma, `alvo.tipo === 'lista'` e `'usuario'`, o `typeof alvo !== 'string'` do `fechar`, o `.where` dele e do `encerrarDosAlunos`, e o `?? ''` da auditoria: separam o nome do aluno aprovado e a decisão por id da por ano, e a troca de um pelo outro quebra os casos do caminho feliz e da virada por tipo, não por uma cláusula que só um bloco isolaria; (4) o `planejar` e a classificação (`novasDeTransferencia`, `chavesDaTransferencia`, `lido.success`) repassam o que o bloco da marca e o do resumo já exercitam.

A marca deixa de valer: toda linha "muda de turma" transfere o aluno.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › sem a marca
-  return linhas.flatMap(({ resultado, alvo, destino }) => (resultado === 'muda_de_turma' && alvo !== undefined && destino !== undefined && marcadas.has(alvo.id) ? [{ alvo, destino }] : []))
+  return linhas.flatMap(({ resultado, alvo, destino }) => (resultado === 'muda_de_turma' && alvo !== undefined && destino !== undefined && marcadas.size >= 0 ? [{ alvo, destino }] : []))
```

O pedido pendente do nome transferido deixa de ser encerrado.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › transferido com pedido pendente
-  await gravacao.encerrarPedidosDosNomes(nomes.filter(({ estadoLido }) => estadoLido === 'reivindicado').map(({ id }) => id))
+  await gravacao.encerrarPedidosDosNomes([])
```

A diferença no nome (a linha não mudou) deixa de fechar a importação `desatualizada`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a reivindicação parada no nome livre
-  if ((await gravacao.transferirNomes(anoLetivoId, nomes)) !== nomes.length) throw new DiferencaNaPlanilhaError()
+  await gravacao.transferirNomes(anoLetivoId, nomes)
```

O vínculo encerrado à mão deixa de fechar a importação `desatualizada`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › o vínculo do aluno encerrado à mão entre
-  if (encerrados.length !== alunos.length) throw new DiferencaNaPlanilhaError()
+  if (encerrados.length > alunos.length) throw new DiferencaNaPlanilhaError()
```

O vínculo antigo é encerrado por outro motivo que a `realocacao`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a transferência passa pelo encerramento
-  const encerrados = await gravacao.encerrarVinculosDosAlunos(anoLetivoId, alunos.map(({ usuarioId, turmaLidaId }) => ({ usuarioId, turmaId: turmaLidaId })), 'realocacao')
+  const encerrados = await gravacao.encerrarVinculosDosAlunos(anoLetivoId, alunos.map(({ usuarioId, turmaLidaId }) => ({ usuarioId, turmaId: turmaLidaId })), 'fim_do_ano')
```

A linha do aprovado deixa de acompanhar o aluno à turma nova.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › o transferido alcança a turma nova
-      update lista_nome as l set turma_id = v.turma_id
+      update lista_nome as l set turma_id = l.turma_id
       from (values ${valores}) as v(usuario_id, turma_lida_id, turma_id)
```

A escrita do nome deixa de conferir o estado lido: a reivindicação que tomou o nome é atropelada.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a reivindicação parada no nome livre
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
+      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.turma_id = v.turma_lida_id
```

O nome transferido deixa de voltar `livre`.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › transferido com pedido pendente
-      update lista_nome as l set turma_id = v.turma_id, estado = 'livre'
+      update lista_nome as l set turma_id = v.turma_id
```

O pedido encerrado passa a conservar o que foi decidido antes: o encerramento alcança pedido que não está pendente.

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › o pedido encerrado pela transferência
-            eq(reivindicacao.estado, 'pendente'),
+            inArray(reivindicacao.estado, ['pendente', 'recusada']),
             'anoLetivoId' in alvo ? eq(reivindicacao.anoLetivoId, alvo.anoLetivoId) : inArray(reivindicacao.listaNomeId, [...alvo.listaNomeIds]),
```

O vínculo novo nasce com outra origem que a `lista`.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a transferência passa pelo encerramento
-      .values(alunos.map(({ usuarioId, turmaId }) => ({ escolaId, anoLetivoId, usuarioId, turmaId, disciplinaId: null, papel: 'aluno' as const, estado: 'confirmado' as const, origem: 'lista' as const, criadoPor, decididoEm: sql`now()` })))
+      .values(alunos.map(({ usuarioId, turmaId }) => ({ escolaId, anoLetivoId, usuarioId, turmaId, disciplinaId: null, papel: 'aluno' as const, estado: 'confirmado' as const, origem: 'coordenacao' as const, criadoPor, decididoEm: sql`now()` })))
```

O vínculo novo nasce pendente, sem a decisão da coordenação.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › o transferido alcança a turma nova
-      .values(alunos.map(({ usuarioId, turmaId }) => ({ escolaId, anoLetivoId, usuarioId, turmaId, disciplinaId: null, papel: 'aluno' as const, estado: 'confirmado' as const, origem: 'lista' as const, criadoPor, decididoEm: sql`now()` })))
+      .values(alunos.map(({ usuarioId, turmaId }) => ({ escolaId, anoLetivoId, usuarioId, turmaId, disciplinaId: null, papel: 'aluno' as const, estado: 'pendente' as const, origem: 'lista' as const, criadoPor, decididoEm: sql`now()` })))
```

A marca vale para qualquer ação: o id marcado em `transferir` passa pela checagem do gravar mesmo sendo candidato de outra ação.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a marca de um aluno de outra escola
-    const candidatos = new Set(previa.candidatos.map((candidato) => `${candidato.acao}:${candidato.id}`))
+    const candidatos = new Set(previa.candidatos.flatMap((candidato) => [`transferir:${candidato.id}`, `desligar:${candidato.id}`, `encerrar:${candidato.id}`]))
```

Só a última leva do lote conta: 501 transferidos saem `desatualizada`.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › mais transferidos do que cabem num lote
-    for (let inicio = 0; inicio < transferencias.length; inicio += TAMANHO_DO_LOTE) movidos += await lista.transferirAprovados(anoLetivoId, transferencias.slice(inicio, inicio + TAMANHO_DO_LOTE))
+    for (let inicio = 0; inicio < transferencias.length; inicio += TAMANHO_DO_LOTE) movidos = await lista.transferirAprovados(anoLetivoId, transferencias.slice(inicio, inicio + TAMANHO_DO_LOTE))
```

A turma que só a linha "muda de turma" pedia nasce mesmo sem a marca.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › sem a marca
-  const turmasACriar = [...classificacao.novas, ...classificacao.novasDeTransferencia.filter(({ chave }) => chavesDaTransferencia.has(chave))]
+  const turmasACriar = [...classificacao.novas, ...classificacao.novasDeTransferencia]
```

O resumo traz `transferidos: 0` quando ninguém foi marcado.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › sem a marca
-  const resumo = { ...classificacao.resumo, turmas_novas: turmasACriar.length, ...(transferencias.length > 0 ? { transferidos: transferencias.length } : {}) }
+  const resumo = { ...classificacao.resumo, turmas_novas: turmasACriar.length, transferidos: transferencias.length }
```

A auditoria do aluno transferido troca a origem pelo destino.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a auditoria da transferência
-  for (const { usuarioId, turmaLidaId, turmaId } of alunos) await registro.gravar(tx, 'aluno.transferido', { entidadeId: usuarioId, depois: { turmaOrigemId: turmaLidaId, turmaDestinoId: turmaId } })
+  for (const { usuarioId, turmaLidaId, turmaId } of alunos) await registro.gravar(tx, 'aluno.transferido', { entidadeId: usuarioId, depois: { turmaOrigemId: turmaId, turmaDestinoId: turmaLidaId } })
```

A auditoria do vínculo encerrado deixa de dizer a origem.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a auditoria da transferência
-  for (const { id, estadoAntes } of encerrados) await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'lista' } })
+  for (const { id, estadoAntes } of encerrados) await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao' } })
```

A virada do ano deixa de passar pelo `fechar('encerrada')` e fecha pedido nenhum.

```mutacao
arquivo: apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts
teste: apps/api/test/virada-do-ano.int.test.ts › V1: o acesso fica revogado
-    const encerrados = await new DecisaoRepository(this.banco).fechar({ anoLetivoId }, 'encerrada')
+    const encerrados = await new DecisaoRepository(this.banco).fechar({ listaNomeIds: [] }, 'encerrada')
```

A origem de cada marcado deixa de ser travada: a decisão em sala da turma antiga não espera o passo (3).

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a transferência contra o professor aprovando
-    const tocadas = [...new Set([...turmasTocadas(lido.data, turmas), ...transferidos.map(({ alvo }) => alvo.turmaId)])].sort()
+    const tocadas = [...new Set([...turmasTocadas(lido.data, turmas)])].sort()
```

O usuário do aluno transferido deixa de ser travado antes do `encerrar`.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › o usuário do aluno transferido preso
-      ...transferidos.flatMap(({ alvo }) => (alvo.tipo === 'usuario' ? [alvo.id] : [])),
```

A checagem das marcas deixa de recusar a marca que não é de candidato nenhum.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › a marca de um aluno de outra escola
-    if (marcadas.some((marca) => !candidatos.has(marca))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+    if (marcadas.length < 0) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

O encerramento por ano deixa de olhar o ano: fecha só os pedidos dos nomes dados (nenhum).

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/api/test/virada-do-ano.int.test.ts › V1: o acesso fica revogado
-            'anoLetivoId' in alvo ? eq(reivindicacao.anoLetivoId, alvo.anoLetivoId) : inArray(reivindicacao.listaNomeId, [...alvo.listaNomeIds]),
+            'anoLetivoId' in alvo ? inArray(reivindicacao.listaNomeId, []) : inArray(reivindicacao.listaNomeId, [...alvo.listaNomeIds]),
```

A conferência por contagem do aprovado deixa de fechar a importação `desatualizada`: a linha levada à 8C à mão fica na 8C e o vínculo vai à 8B.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › o aluno aprovado levado à 8C à mão
-  if ((await gravacao.transferirAprovados(anoLetivoId, alunos)) !== alunos.length) throw new DiferencaNaPlanilhaError()
+  await gravacao.transferirAprovados(anoLetivoId, alunos)
```

O encerramento dos pedidos deixa de olhar a escola do contexto: a virada da A fecha o pedido da B.

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/api/test/virada-do-ano.int.test.ts › isolamento: num contexto de A
         .where(
           and(
-            eq(reivindicacao.escolaId, requireEscolaId()),
             eq(reivindicacao.estado, 'pendente'),
             'anoLetivoId' in alvo ? eq(reivindicacao.anoLetivoId, alvo.anoLetivoId) : inArray(reivindicacao.listaNomeId, [...alvo.listaNomeIds]),
```

O encerramento dos vínculos dos alunos deixa de olhar a escola do contexto.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › isolamento dos métodos da transferência
     const doPar = and(
-      eq(vinculo.escolaId, escolaId),
       eq(vinculo.anoLetivoId, anoLetivoId),
```

A transferência do nome deixa de olhar a escola do contexto.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › isolamento dos métodos da transferência
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
+      where l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
```

A transferência da linha do aprovado deixa de olhar a escola do contexto.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › isolamento dos métodos da transferência
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.usuario_id = v.usuario_id and l.estado = 'aprovado' and l.turma_id = v.turma_lida_id
+      where l.ano_letivo_id = ${anoLetivoId} and l.usuario_id = v.usuario_id and l.estado = 'aprovado' and l.turma_id = v.turma_lida_id
```

O encerramento dos pedidos pelos nomes deixa de olhar a escola: a A fecha o pedido da B pelo id do nome.

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/worker/test/transferencia-pela-planilha.int.test.ts › isolamento dos métodos da transferência
         .where(
           and(
-            eq(reivindicacao.escolaId, requireEscolaId()),
             eq(reivindicacao.estado, 'pendente'),
             'anoLetivoId' in alvo ? eq(reivindicacao.anoLetivoId, alvo.anoLetivoId) : inArray(reivindicacao.listaNomeId, [...alvo.listaNomeIds]),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | Item do `TODO.md` (candidatos a `transferir` chegam à tela desmarcados, sem "marcar todos" já marcado): conferir a tela | Tarefa 13.0, que entrega a tela; o item já está no `TODO.md` |
| conformidade-reviewer (1ª) | Provar que sessão de tutor aberta na turma antiga deixa de ser alcançável pelo aluno transferido, e que registro e resumo continuam visíveis ao professor da turma antiga | Tarefa 10.0 ou 13.0 (a que tocar vínculo e acesso depois); fora do que a 9.0 grava (nenhum arquivo do tutor é tocado) |
| tenancy-guardian (1ª) | `fechar({ listaNomeIds }, 'encerrada')` sem `anoLetivoId` no `where` | Muda a assinatura do `fechar` (contrato), e o `listaNomeIds` já vem de leitura filtrada pelo ano; destino `TODO.md`, para a 10.0, que chama o `fechar` pelos mesmos nomes |
| privacy-guardian (1ª) | `lista.transferida` com `entidade: 'lista_nome'` não entra no arquivo do titular do usuário que aprovar o nome depois | Pergunta para a retrospectiva da spec (`lista.nome_corrigido` já se comporta assim; não é furo novo) |
| privacy-guardian (1ª) | Caso de isolamento pela rota `/v1/importacoes/alunos/previa` com token da A | `TODO.md`, item já aberto, a fazer antes do pouso da spec |
| infra-guardian (1ª) | Auditoria em linha por linha no passo (3), com as turmas travadas | Tarefa 16.0 (`importacao-7h30.js`, passo (3) abaixo de 1 s); gravar em lote só se a medida passar |
| infra-guardian (1ª) | `EXPLAIN` do `or()` com 500 pares em `vinculo_usuario_idx` | Tarefa 16.0, no cenário de carga |
| infra-guardian (1ª) | O caso dos 501 transferidos não mede a duração do passo (3) | Tarefa 16.0 |
| revisor-geral (1ª) | `encerrarDosAlunos` repete o padrão de `CicloDeVidaRepository.encerrarVinculosDaPessoa` | Avaliar unificar na retrospectiva da spec; refatoração de dois repositories fora do escopo da 9.0 |
| revisor-geral (1ª) | Sobrecarga do `fechar` (decidir e encerrar num método só) | Muda a API do repository, com `virarSala` e a planilha no meio; `TODO.md` |
| revisor-geral (1ª) | `?? ''` no `vinculo.criado` (`alunos.ts:382`) esconde uma invariante | Muda o modo de falha (erro explícito no lugar de falha de schema), que é comportamento; `TODO.md` |
| test-engineer (1ª) | Duas tentativas do mesmo job de transferência em paralelo (D49) | `TODO.md`; teste novo com a barreira, fora das poucas linhas |
| test-engineer (1ª) | O bloco "a origem de cada marcado deixa de ser travada" fica vermelho pelo tempo esgotado do `esperarNaTrava`, não pelo estado final | Só registro: a escrita condicional dá o mesmo desfecho sem a trava; nada a mudar |
| revisor-geral (2ª) | `9_task.md` linhas 9, 23, 25 e 45 (Objetivo, subtarefas 9.1 e 9.3, linha da tabela de testes) ainda dizem que a transferência passa pelo `encerrar` e revoga o acesso; a divergência da própria tarefa diz `encerrarDosAlunos`, sem acesso a revogar | `TODO.md`: ajuste de texto do documento da tarefa; a tabela "Divergências resolvidas" do mesmo documento e o `cenarios.md` (linhas 65 e 66) já dizem o que vale |
| revisor-geral (2ª) | `techspec.md:99` fala no "`encerrar` que devolve `false`"; na transferência a diferença vem da contagem do `encerrarDosAlunos` | `TODO.md`: ajuste de texto da Tech Spec, a levar na retrospectiva da spec |
| revisor-geral (2ª) | `transferencia-pela-planilha.int.test.ts:38` importa `DecisaoService` de `apps/api`, o que acopla worker e api | `TODO.md`: se o `DecisaoService` subir para `packages/core`, o import vai junto |
| revisor-geral (2ª) | `:246` e `:266`: `rollback` no `finally` roda depois de um `commit` que deu certo; inofensivo (`.catch`), mas o Postgres avisa a cada execução | `TODO.md`: polimento de teste, sem efeito no resultado |
| test-engineer (2ª) | `:448`: asserção explícita de que a 8A não tem vínculo novo, e comentário de que o `Promise.all` garante "zero `40P01`" | `TODO.md`: reforço de teste que já passa; o estado final já é conferido pelo caso |
| test-engineer (2ª) | `:582`: comentário de que a mutação do `doPar` só é pega pela contagem devolvida, para ninguém tirar a asserção `vinculos: 0` | `TODO.md`: comentário de teste |
| test-engineer (2ª) | Os dois blocos da cláusula `eq(reivindicacao.escolaId, …)` (por ano e por `listaNomeIds`) poderiam dizer que são a mesma linha vista por dois caminhos | `TODO.md`: texto dos blocos de "Mutações" |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 02:27:01 | 2026-11-04 02:27:48 | `conformidade-reviewer` | 1 | APROVADO | a649b62ef282104b3 |
| 2026-11-04 02:26:49 | 2026-11-04 02:27:58 | `tenancy-guardian` | 1 | APROVADO | adddee646421fcfd7 |
| 2026-11-04 02:26:52 | 2026-11-04 02:28:02 | `privacy-guardian` | 1 | APROVADO | ab45ee9c188777a07 |
| 2026-11-04 02:26:54 | 2026-11-04 02:28:43 | `infra-guardian` | 1 | APROVADO | a18a8c52652b34ce5 |
| 2026-11-04 02:26:59 | 2026-11-04 02:29:01 | `revisor-geral` | 1 | REPROVADO | aff9621ae1ae3993b |
| 2026-11-04 02:26:57 | 2026-11-04 02:31:20 | `test-engineer` | 1 | REPROVADO | ada74f726105a4871 |
| 2026-11-04 02:43:41 | 2026-11-04 02:44:11 | `revisor-geral` | 2 | APROVADO | aaa498a4680f7ce15 |
| 2026-11-04 02:43:52 | 2026-11-04 02:45:22 | `test-engineer` | 2 | APROVADO | ae6ed9d92988f0d6b |
