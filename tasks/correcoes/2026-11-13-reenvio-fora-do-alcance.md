# Correção — o reenvio com a mesma chave devolve erro, e não a execução já aceita, quando o material saiu do alcance

**Origem:** achado do `infra-guardian`, 1ª rodada da tarefa 9.0 de `ingestao-do-material` (`tasks/prd-ingestao-do-material/9_task.md`, "Recomendações sem aplicar"; `.processo/ordens/9_task-r1.md` da L1).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os cinco primeiros vieram no PEDIDO do Orquestrador. O `conformidade-reviewer` entra porque a correção altera `tutor.service.ts` (regra 70), como a Mesa apontou na DEVOLUÇÃO. -->

## Sintoma

A professora (ou o aluno) envia uma pergunta ou um pedido de geração, o servidor responde `202` com o `execucaoId`, e a resposta
se perde na rede. A tela reenvia com a **mesma `chaveEnvio`**, como o contrato manda. Se, entre os dois envios, o material saiu do
alcance (o único da série foi excluído ou substituído, ou deixou de ser da série; a licença venceu), o reenvio responde `422
SEM_MATERIAL_DA_SERIE` (ferramenta, chat e Tutor) ou `404 NAO_ENCONTRADO` (o material aberto do Tutor), em vez do `execucaoId` que o
servidor já aceitou. A tela mostra "peça à coordenação o material" para um pedido que existe, gravado, e que o professor ou o aluno
vai ver terminar (ou falhar, pela execução).

## Fora desta correção

Nada: nenhum arquivo da tarefa em curso na árvore.

## Causa

A idempotência da chave mora no `ExecucaoScheduler.agendar`, que só recebe o pedido **depois** das conferências de alcance:

- **Ferramenta** (`ferramentas.service.ts`, `gerar`) e **chat** (`assistente.service.ts`, `enviar`): o `existeMaterialDaSerie` roda
  antes do `agendar`, que é quem reconhece a chave repetida (`gravarPendente` devolve `undefined`, e `daChave` acha a execução).
- **Tutor** (`tutor.service.ts`, `enviar`): a chave já é consultada (`jaAceita`), mas só para o freio e a avaliação (o comentário
  "o reenvio devolve a mesma execução, mesmo que o freio tenha fechado") e para a D36. O `#doMaterial`, que confere o material aberto
  (`NAO_ENCONTRADO`) e o material da série (`SEM_MATERIAL_DA_SERIE`), roda sempre.

O jeito anterior à 9.0 já tinha a mesma falha com o material excluído (`NAO_ENCONTRADO` do material aberto); a 9.0 acrescentou o
`SEM_MATERIAL_DA_SERIE` no mesmo lugar.

## Teste que reproduz

`apps/api/test/leitura-por-serie.int.test.ts`, no grupo novo `o reenvio com a mesma chaveEnvio, depois que o material saiu do alcance`:

- `a ferramenta e o chat devolvem o execucaoId já aceito, sem gravar nem chamar o modelo, depois que o único material da série saiu; a chave nova continua recusada`:
  vermelho antes (`atividade_objetiva: expected 422 to be 202`: o reenvio da chave aceita recebia `SEM_MATERIAL_DA_SERIE`), verde depois;
- `o Tutor devolve a execução já aceita quando o material aberto ou o único material da série saiu, porque a licença venceu; a chave nova é recusada`:
  vermelho antes (`expected 404 to be 202`: o material aberto fora do alcance respondia `NAO_ENCONTRADO`), verde depois;
- dois controles que já passavam e ficam como guarda da correção: `a chave aceita para um pedido não pula a conferência de outro…` (a chave de
  outra ferramenta ou do chat, reaproveitada, continua recusada) e `a chave aceita para uma professora não abre a recusa para outra da mesma
  escola…` (a chave é de quem pediu: a colega da escola, com o mesmo corpo e a mesma chave, recebe `SEM_MATERIAL_DA_SERIE`).

Nos três reenvios o caso confere também que nada foi gravado (execução, consumo, mensagens) e que o adaptador falso não foi chamado, e que a
**chave nova**, com o mesmo corpo, continua recusada: o que passa é a chave que o servidor já aceitou, e não a conferência que sumiu.

- os casos da ordem de correção 1: `atividade_objetiva: o reenvio com a execução ainda pendente…`, `plano_de_aula: …` e `chat: …` (a execução fica parada na transição
  `rodando` pelo gatilho de teste, o material sai, o reenvio devolve o mesmo id, e a execução falha com `MATERIAL_INSUFICIENTE`, `MATERIAL_INSUFICIENTE` e
  `SEM_MATERIAL_DA_SERIE`, sem chamar o modelo e sem consumo; o do chat foi visto vermelho antes da conferência no `entrada`), `o Tutor com a execução ainda pendente
  no reenvio…`, `a chave aceita para um aluno não abre a recusa para outro da mesma turma…` e `a chave aceita na escola A não abre a recusa para a professora da escola B…`.

**O ambiente.** Os trabalhadores do compose `educa-teste-2` (`worker-pdf`, `worker-interativo`, `worker-lote`, `despachante`) estavam de pé
desde a correção anterior e disputavam a extração do PDF com a API do teste: o caso mais antigo do arquivo (`a ferramenta (atividade e plano) e o
chat recusam a turma do 9º…`) caía com `422` já no HEAD, sem esta correção. Parados, as 31 passam. Não é defeito do código.

## Correção

O reenvio da chave que **esta pessoa** já teve aceita, para a **mesma tarefa**, não passa mais pelo filtro de material, e devolve a mesma execução:

- `AssistenteService.enviar` e `FerramentasService.gerar`: antes do `existeMaterialDaSerie`, `ExecucaoDaSessaoRepository.daChave(chaveEnvio)`
  (escopo de escola, ano e pessoa, o mesmo do `agendar`); se a tarefa é a do pedido, o `existeMaterialDaSerie` não roda e o `agendar` devolve a
  execução já gravada. A chave de outra pessoa não é achada e a de outra tarefa não pula nada: seguem com a conferência de antes.
- `TutorService.enviar`: com `jaAceita`, o `#doMaterial` não roda (o `#alcance`, que confere turma, atividade e questão, continua). O material que
  saiu do alcance depois do `202` falha a **execução**, como já fazia (`entrada` o confere de novo, sem trecho, sem consumo e sem modelo).

**O que a execução retomada faz com o material que saiu** (ordem de correção 1, rodada 1; o reenvio de uma execução ainda `pendente` retoma o trabalho):

- **Ferramenta:** o `#preparar` já falha a execução com `MATERIAL_INSUFICIENTE` antes do modelo (a busca de trechos volta vazia). Só faltava o teste.
- **Chat:** o `entrada` buscava trechos, mas não recusava quando voltavam vazios, e o modelo era chamado sem material (visto vermelho: a execução terminava
  `concluida`). O `entrada` agora confere `existeMaterialDaSerie` de novo, como o Tutor, e falha a execução com `SEM_MATERIAL_DA_SERIE`, sem trecho, sem modelo e sem consumo.
  Vale também para o `202` comum com o material saindo antes de a execução rodar, que já tinha a mesma falha.
- **Tutor:** o `entrada` já conferia (`#doMaterial`), como nos casos `[P]`.

O que o reenvio ainda confere: a turma e a disciplina do professor (vínculo), o teto de pedidos por pessoa e por escola, a suspensão da função. O
reenvio de execução já terminada não roda de novo (o `agendar` e o `update` condicional de sempre).

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

Um bloco por termo das duas linhas novas de cada serviço (a comparação com a tarefa, nas duas formas em que ela erra, e o `!reenvio &&`) um para o ramo do Tutor, e dois para a conferência nova no `entrada` do chat (o `if` inteiro e a negação).

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › a ferramenta e o chat devolvem o execucaoId já aceito, sem gravar nem chamar o modelo, depois que o único material da série saiu; a chave nova continua recusada
-    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa === proporFerramenta.nome
+    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa !== proporFerramenta.nome
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › a chave aceita para um pedido não pula a conferência de outro: reaproveitada em outra ferramenta ou no chat, continua com SEM_MATERIAL_DA_SERIE
-    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa === proporFerramenta.nome
+    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa !== undefined
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › a ferramenta e o chat devolvem o execucaoId já aceito, sem gravar nem chamar o modelo, depois que o único material da série saiu; a chave nova continua recusada
-    if (!reenvio && !(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
+    if (!(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › a ferramenta e o chat devolvem o execucaoId já aceito, sem gravar nem chamar o modelo, depois que o único material da série saiu; a chave nova continua recusada
-    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(chaveEnvio))?.tarefa === tarefa
+    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(chaveEnvio))?.tarefa !== tarefa
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › a chave aceita para um pedido não pula a conferência de outro: reaproveitada em outra ferramenta ou no chat, continua com SEM_MATERIAL_DA_SERIE
-    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(chaveEnvio))?.tarefa === tarefa
+    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(chaveEnvio))?.tarefa !== undefined
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › a ferramenta e o chat devolvem o execucaoId já aceito, sem gravar nem chamar o modelo, depois que o único material da série saiu; a chave nova continua recusada
-    if (!reenvio && !(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId: parametros.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
+    if (!(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId: parametros.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › o Tutor devolve a execução já aceita quando o material aberto ou o único material da série saiu, porque a licença venceu; a chave nova é recusada
-    const alcance = jaAceita === undefined ? await this.#doMaterial(daTurma, pedido) : daTurma
+    const alcance = await this.#doMaterial(daTurma, pedido)
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › chat: o reenvio com a execução ainda pendente, depois que o material saiu, devolve o mesmo id e a execução falha pelo material sem chamar o modelo
-        if (!(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId: pergunta.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/test/leitura-por-serie.int.test.ts › chat: o reenvio com a execução ainda pendente, depois que o material saiu, devolve o mesmo id e a execução falha pelo material sem chamar o modelo
-        if (!(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId: pergunta.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
+        if (await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId: pergunta.disciplinaId })) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
```


## Recomendações sem aplicar

A tabela da ordem da rodada 1 (`.processo/ordens/2026-11-13-reenvio-fora-do-alcance-r1.md`) e a da rodada 2 (`…-r2.md`), como vieram. A recomendação da 2ª rodada de mover os dois blocos de mutação do chat para "Mutações" foi aplicada, com o carimbo ainda válido.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª, rec. 1) e revisor-geral (1ª, rec. 2) | O `entrada` do chat não confere material da série: se o material sai entre o `202` e a execução, o modelo é chamado sem trecho. Já existia antes desta correção | É o mesmo defeito do item 1. Se o teste do item 1 pedir a conferência no `entrada` do chat, entra aqui; se o Implementador atender o item 1 pelo outro caminho, o `entrada` do chat vira correção própria, registrada no `TODO.md` |
| revisor-geral (1ª, rec. 1) | Registrar na Tech Spec (`techspec.md`, 112-114 e 117-123) e em `cenarios.md` (seção "Leitura de página por série") que o reenvio da chave já aceita pula o filtro, com o cenário e o controle da chave nova | Documento da spec, do Arquiteto: `TODO.md`, e o Orquestrador repassa ao Arquiteto |
| revisor-geral (1ª, rec. 3) e infra-guardian (1ª, rec. 2) | A mesma consulta da chave aceita aparece em `ferramentas.service.ts` e `assistente.service.ts`; extrair um método do `ExecucaoDaSessaoRepository` (`jaAceita(chaveEnvio, tarefa)`), o que juntaria também as duas leituras | Toca `execucao.repository.ts`, que a correção não toca, e muda as linhas das mutações já provadas: `TODO.md`, para a tarefa que mexer no repository |
| revisor-geral (1ª, rec. 4) | Uma leitura a mais por pedido em `execucao_agente` | Sem ação: o `infra-guardian` conferiu a leitura pontual pelo índice único e aprovou |
| privacy-guardian (1ª, rec. 2) | O `daChave` antecipado lê fora da transação do `agendar` | Sem ação: era recado para o `infra-guardian`, que conferiu a concorrência e aprovou ("sem corrida nova") |
| test-engineer (1ª, rec. 3) e infra-guardian (1ª, rec. 3) | Os trabalhadores do compose `educa-teste-2` disputam a extração do PDF com a API do teste; isolar o teste desses workers (outra fila ou outro prefixo no Redis) | Fora do código desta correção: `TODO.md` |
| revisor-geral (2ª, rec. 1) e test-engineer (2ª, rec. 1) | Os dois blocos de mutação do chat estão dentro de "## Revisões", depois da tabela; o hook acrescenta as linhas no fim do arquivo e a tabela fica partida em volta dos blocos. Passá-los para "## Mutações", depois do bloco do Tutor | Só documento, e não caduca revisor. O Implementador pode mover os dois blocos antes do commit, desde que `node tools/processo/mutacoes.ts --faltando <documento>` continue em 0 e o carimbo continue válido; se o carimbo caducar, deixa como está e a tabela partida fica. As duas leituras (`lerRevisoes` e `mutacoes.ts`) já acham os blocos e a contagem não quebra |
| test-engineer (2ª, rec. 2) | O comentário de `reenviandoComAExecucaoPendente` e o texto do documento (linhas 48 e 67) dizem que o reenvio retoma a execução; no teste ela já está em curso no executor (`executor.ts:116`), e quem roda o `entrada` é a execução original. A retomada da execução `pendente` sem executor não é exercitada | Não bloqueia: o `entrada` dos três serviços lê tudo pelo que foi gravado com a chave, e o código que roda é o mesmo. `TODO.md`: o caso com a linha `pendente` sem executor em curso, ou o ajuste do comentário e do texto, para a tarefa que mexer neste arquivo de teste |
| test-engineer (2ª, rec. 3) | Falta um caso explícito do chat sem reenvio (o `202` comum, com o material saindo antes de a execução rodar) | `TODO.md`: o mesmo código já o cobre pelo caso do reenvio; o caso com o nome do cenário vai com a tarefa que mexer neste arquivo de teste |
| test-engineer (2ª, rec. 4) | Dois reenvios da mesma chave em paralelo, depois que o material saiu | Fora do alcance: a idempotência é do `agendar` e já existia antes desta correção. `TODO.md` |
| revisor-geral (2ª, rec. 2) | Nenhuma mutação amarra os casos de `atividade_objetiva` e `plano_de_aula` a uma linha de produção (o `#preparar` já falhava com `MATERIAL_INSUFICIENTE`); um nunca foi visto vermelho | O documento declara que o comportamento já existia ("só faltava o teste"). `TODO.md`: uma mutação no `#preparar` de `ferramentas.service.ts`, na tarefa que mexer nele |
| infra-guardian (2ª, rec. 1) | O `entrada` do chat agora faz duas consultas seguidas ao material da série (`existeMaterialDaSerie` e `trechos.buscar`); juntar se o p95 do chat subir | Sem ação agora: custo desprezível, e é pedido de medição. `TODO.md` |
| infra-guardian (2ª, rec. 2) | Manter juntos os dois testes de isolamento novos (colega da turma e escola B) se o arquivo for dividido | Sem ação: é recado para uma divisão futura do arquivo |
| privacy-guardian (2ª, rec. 1) | O comentário em `assistente.service.ts:114-115` repete o que o documento explica; encurtar para uma linha | Sem ação: é gosto de redação, não defeito. O comentário diz por que a conferência existe e que a falha é da execução (RF8); a conferência em si é o que a Tech Spec pede (`techspec.md:120`: "a conferência depois do `202` repete o mesmo filtro") |
| tenancy-guardian (2ª, rec. 1) | No caso da escola B o material da A também é apagado; deixá-lo presente mostraria que a recusa vem da série da B | Melhoria de teste, não bloqueia: `TODO.md`, na tarefa que mexer neste arquivo de teste |
| conformidade-reviewer (2ª, rec. 1) | O Tutor falha com `NAO_ENCONTRADO` e o chat com `SEM_MATERIAL_DA_SERIE`; conferir se a tela do aluno e a do professor mostram mensagem compreensível quando a execução `falhou` depois de um `202` | Fica para a validação da spec, que fotografa cada requisito com tela. O `revisor-geral` viu que o erro chega à tela do professor pelo campo `erro` da execução (`conversa.ts:39`), que já existia |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-14 01:34:42 | 2026-11-14 01:35:12 | `tenancy-guardian` | 1 | APROVADO | ae38570715d860884 |
| 2026-11-14 01:34:45 | 2026-11-14 01:35:13 | `conformidade-reviewer` | 1 | APROVADO | a27a8172d25b51b0d |
| 2026-11-14 01:34:43 | 2026-11-14 01:35:18 | `privacy-guardian` | 1 | APROVADO | ad66e59fd26831ce5 |
| 2026-11-14 01:34:40 | 2026-11-14 01:35:31 | `infra-guardian` | 1 | APROVADO | a84afff257dbed92c |
| 2026-11-14 01:34:38 | 2026-11-14 01:35:59 | `revisor-geral` | 1 | APROVADO | a3886122437f03fbb |
| 2026-11-14 01:34:37 | 2026-11-14 01:36:35 | `test-engineer` | 1 | REPROVADO | a9f9904e8c026fc4f |

| 2026-11-14 01:48:54 | 2026-11-14 01:49:13 | `infra-guardian` | 2 | APROVADO | a680759fd1d66a254 |
| 2026-11-14 01:49:04 | 2026-11-14 01:49:25 | `privacy-guardian` | 2 | APROVADO | a71e462b9ea6692bc |
| 2026-11-14 01:48:59 | 2026-11-14 01:49:27 | `tenancy-guardian` | 2 | APROVADO | a6161ade1ab0b6c56 |
| 2026-11-14 01:49:09 | 2026-11-14 01:49:30 | `conformidade-reviewer` | 2 | APROVADO | a0d6bb6b288d5ea67 |
| 2026-11-14 01:48:49 | 2026-11-14 01:49:44 | `revisor-geral` | 2 | APROVADO | aa0733ee3afefb134 |
| 2026-11-14 01:48:44 | 2026-11-14 01:51:41 | `test-engineer` | 2 | APROVADO | ac90bccefb73058df |
