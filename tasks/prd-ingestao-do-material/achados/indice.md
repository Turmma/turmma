# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-11 10:19:30 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Seção 7c, seção 9 e RF14 (limite de envio sem tratamento na tela). |
| 2026-11-11 10:20:21 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Seção 5, "Busca", ordem em relação à D36. A spec manda checar `existeMaterialDaSerie(disciplinaId, serieId)` "antes de chamar o modelo" e devolver ao Tutor "a… |
| 2026-11-11 10:20:33 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | techspec.md seção 6 ("`serieIds` de B;") e seção 4 (POST /v1/materiais): o caso de isolamento da série não tem resultado esperado, e a Tech Spec não diz como… |
| 2026-11-11 10:20:35 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | A licença não tem retenção, classificação nem saída na eliminação. (§3, `licenca_de_material`; §7, "Retenção e expurgo") |
| 2026-11-11 10:23:15 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | techspec §5 "Envio" e §7c "Quando cada dependência cai": o PDF fica órfão para sempre se o commit falha. |
| 2026-11-11 10:23:39 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | O envio deixa PDF órfão no storage, e nenhum teste pega isso (seção 5, "Envio"; seção 7c). |
| 2026-11-11 10:24:05 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | §5 "Busca" e §6, RF7, RF8 e RF17: o filtro por série e por licença vigente só cobre a busca por texto. O desenho põe os dois filtros em… |
| 2026-11-11 10:32:44 | `frontend-reviewer` | 2ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Seção 9 e `cenarios.md` "Telas" (texto do 429). |
| 2026-11-11 10:33:52 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5 "Envio e edição", passos (1) e (3), e `cenarios.md` "Isolamento". |
| 2026-11-11 10:34:13 | `conformidade-reviewer` | 2ª | REPROVADO | `revisao-spec` | Seção 5, "Leitura de página", e seção 7b. O filtro de série, de licença e de substituição em `materialDaTurma` passa na frente da D36. |
| 2026-11-11 10:35:14 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | §3 "Retenção" (problema novo): a licença sai "contada do mais tardio entre vigente_ate e a exclusão do último |
| 2026-11-11 10:35:57 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5 "Envio e edição" (4) e §7, linha "Retenção e expurgo": prazo do órfão de 48 h contra os 25 h do PRD, sem registro. |
| 2026-11-11 10:36:15 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | TS §5 Envio (4), §7 "Retenção e expurgo" e §11, contra o RF13 e o PRD §8: a queda entre o envio ao storage e o commit fica sem prova, e o prazo diverge do PRD. |
| 2026-11-11 10:36:41 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | techspec §5 "Envio e edição", passo 4; §2 (`infra/`, `compose`); §12: a expiração do bucket é premissa não verificada, sem dono e sem teste. O caminho do… |
| 2026-11-11 10:41:36 | `frontend-reviewer` | 3ª | APROVADO | `revisao-spec` | , sem bloqueio: |
| 2026-11-11 10:42:03 | `conformidade-reviewer` | 3ª | APROVADO | `revisao-spec` | TS §5, "Leitura de página": dizer que a conferência depois do `202` (`entrada`, linha 206 de `tutor.service.ts`) também aplica o filtro novo. Se o material… |
| 2026-11-11 10:42:14 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | da rodada 2, conferidos |
| 2026-11-11 10:43:06 | `privacy-guardian` | 3ª | REPROVADO | `revisao-spec` | techspec.md:83 (§5 "Envio e edição", passo 4) e cenarios.md:26 (problema novo da correção do órfão): |
| 2026-11-11 10:43:35 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | techspec.md:83 (§5, passo 4) e cenarios.md:19-26: a spec não define a ordem entre apagar o objeto e apagar a linha de `envio_de_material`, e o cenário do 503… |
| 2026-11-11 10:43:45 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | TS §5 Envio (4) e cenarios "Envio" l.26: o `catch` pode deixar o PDF órfão para sempre. |
| 2026-11-11 10:44:38 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | TS §5 "Envio e edição" (4), e `cenarios.md` "Envio", linha 26: a ordem entre apagar o objeto e apagar a linha de `envio_de_material` não está definida, e o… |
| 2026-11-11 10:47:27 | `privacy-guardian` | 4ª | APROVADO | `revisao-spec` | TS §5, passo 4 (techspec.md:83): quando o guardarBytes não terminou com sucesso (prazo estourado ou conexão |
| 2026-11-11 10:47:29 | `infra-guardian` | 4ª | REPROVADO | `revisao-spec` | techspec.md:83-84 (§5, passo 4) e cenarios.md:26-30: depois de uma falha no próprio `guardarBytes`, o `catch` ainda apaga a linha, e o PUT atrasado deixa o… |
| 2026-11-11 10:47:43 | `test-engineer` | 4ª | APROVADO | `revisao-spec` | Varredura contra commit, intercalados (TS §5 (4), cenarios.md:31-32). O cenário só cobre a varredura que termina inteira antes da transação. Pode haver outra… |
| 2026-11-11 10:49:01 | `revisor-geral` | 4ª | REPROVADO | `revisao-spec` | TS §5 "Extração", linhas 90 e 91: a regra nova de objeto ausente só poupa o material excluído. Na entrega repetida, um material `pronto` pode virar `falhou`. |
| 2026-11-11 10:51:39 | `revisor-geral` | 5ª | APROVADO | `revisao-spec` | TS §5 "Extração", linha 87. O texto da transição traz só `estado` e `excluido_em`. A §6 já obriga o escopo, mas a regra 10 fica mais visível com `where… |
| 2026-11-11 10:51:59 | `infra-guardian` | 5ª | REPROVADO | `revisao-spec` | techspec.md:91-92 (TS §5 Extração) e TS §3 "Migrations" (techspec.md:48-51): o código novo grava `falha = 'arquivo_ausente'`, e o código anterior não consegue… |
| 2026-11-11 10:54:27 | `infra-guardian` | 6ª | APROVADO | `revisao-spec` | cenarios.md:157-158, o [I] da volta do código. |
| 2026-11-11 11:02:35 | `test-engineer` | 5ª | SEM VEREDITO | `revisao-spec` | As tabelas de "Testes que provam a regra" das 12 tarefas estão abaixo. Usei as legendas do `cenarios.md` (I, U, E, P, C). "Mutação" diz o que se tira para o… |
| 2026-11-11 13:37:30 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | A tarefa não lista o `conformidade-reviewer` entre os subagentes obrigatórios, e isso está certo: não há nota, correção, tutor, autonomia nem indicador de… |
| 2026-11-11 13:37:41 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | O índice `material_objeto_a_apagar_idx` (`packages/core/src/db/schema/material.ts`, migration 0049) não começa por `escola_id`. Ele serve à varredura entre… |
| 2026-11-11 13:38:10 | `privacy-guardian` | 1ª | APROVADO | `1_task` | O teste não prova "sem versionamento". `packages/core/src/titular/s3-file-storage.int.test.ts:53` diz que o objeto não tem versão. Só que o `GetObject` depois… |
| 2026-11-11 13:39:42 | `infra-guardian` | 1ª | APROVADO | `1_task` | `packages/core/drizzle/0049_material_extracao_no_worker.sql:10-15`: o `NOT VALID` seguido de `VALIDATE` não alivia trava nenhuma. O `migrate.ts` aplica todas… |
| 2026-11-11 13:40:15 | `revisor-geral` | 1ª | REPROVADO | `1_task` | O `processando` sem job vivo fica preso para sempre. A tarefa tira a varredura de `processando` parado da API e registra em dois lugares que "a varredura da… |
| 2026-11-11 13:41:05 | `test-engineer` | 1ª | REPROVADO | `1_task` | `apps/api/test/material.int.test.ts:769`: "excluir um material `processando` apaga o objeto e registra; o job que chega depois não grava nada". |
| 2026-11-11 14:36:26 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | O teste dos `UPDATE` da migration, em `apps/worker/test/extrair-pdf.int.test.ts:399` e `:406`, acrescenta ao SQL o filtro `"escola_id" = $1` antes de executar.… |
| 2026-11-11 14:36:27 | `conformidade-reviewer` | 2ª | APROVADO | `1_task` | Mantém-se a da 1ª rodada: quando a 4.0 ligar os trechos extraídos ao Assistente ou ao Tutor, chamar o `conformidade-reviewer`. O ponto a conferir é que o texto… |
| 2026-11-11 14:37:17 | `privacy-guardian` | 2ª | REPROVADO | `1_task` | `docs/lgpd.md:101`: a retenção do PDF diz o contrário do novo desenho. |
| 2026-11-11 14:37:43 | `revisor-geral` | 2ª | APROVADO | `1_task` | O desligamento não espera o processador terminar. Em `apps/worker/src/composition.ts:243-253`, `interromper()` aborta o sinal, grava a falha do job, e logo… |
| 2026-11-11 14:37:45 | `infra-guardian` | 2ª | APROVADO | `1_task` | A janela do deploy cria material `processando` que fica preso. O `migrar` roda com a API anterior ainda no ar. Um envio que caia entre o `UPDATE` da… |
| 2026-11-11 14:38:43 | `test-engineer` | 2ª | APROVADO | `1_task` | `apps/api/test/material.int.test.ts:115`, caso do teto na corrida. Ele não garante que a recusa chegue à transação. A conferência da entrada… |
| 2026-11-11 15:00:01 | `revisor-geral` | 3ª | APROVADO | `1_task` | Retenção na Tech Spec. Em `tasks/prd-ingestao-do-material/techspec.md:123`, a linha diz "PDF: até a extração, ou 25 h no órfão", que ficou mais curta que o… |
| 2026-11-11 15:00:12 | `test-engineer` | 3ª | APROVADO | `1_task` | `material.int.test.ts:800` usa `expect.arrayContaining`, que não recusa uma chave a mais no aviso de log. Isso já está no `TODO.md`. Repito porque a nova frase… |
| 2026-11-11 15:00:12 | `privacy-guardian` | 3ª | APROVADO | `1_task` | "Ou nunca rodou", na linha 101 de `docs/lgpd.md`. A frase vem da redação que eu mesmo sugeri na 2ª rodada, mas não descreve bem esse caso. Um job que nunca… |
| 2026-11-12 15:56:24 | `conformidade-reviewer` | 1ª | APROVADO | `3_task` | Hoje nenhum tipo `ia.*` existe em `JOB_DEFINITIONS`, então a recusa por prefixo é uma proteção para quando eles existirem. Vale um comentário em… |
| 2026-11-12 15:56:27 | `tenancy-guardian` | 1ª | APROVADO | `3_task` | `apps/api/test/ops-jobs.int.test.ts:242`: o nome "job de outra escola com o id certo" engana. O caso usa um job `aguardando` da B, e o operador age em qualquer… |
| 2026-11-12 15:56:53 | `privacy-guardian` | 1ª | APROVADO | `3_task` | A linha do `job_registro` em `docs/lgpd.md:115` ainda diz que a linha "sai pelo `sistema.expurgar-jobs`". Vale acrescentar dois casos. O `ops:descartar-job`… |
| 2026-11-12 15:57:46 | `infra-guardian` | 1ª | REPROVADO | `3_task` | infra/scripts/ensaio-alertas.ts:590 (e :547, :650) — O ensaio grava o job `material.extrair-pdf` "sem o worker-pdf de pé", mas nunca para o `worker-pdf`.… |
| 2026-11-12 15:58:11 | `revisor-geral` | 1ª | REPROVADO | `3_task` | A divergência não chegou ao `cenarios.md`. |
| 2026-11-12 15:58:52 | `test-engineer` | 1ª | REPROVADO | `3_task` | O `ensaio:alertas` não para o `worker-pdf`. O `alertas.int.test.ts` só passa porque o serviço já está parado por outro motivo. |
| 2026-11-12 19:34:29 | `privacy-guardian` | 2ª | APROVADO | `3_task` | Quando `reabrirFalho` reinicia o `criado_em`, a data em que o job foi criado se perde, e só a auditoria `job.reprocessado` fica como rastro… |
| 2026-11-12 19:34:39 | `conformidade-reviewer` | 2ª | APROVADO | `3_task` | `docs/runbook.md:131-132`: o aviso para conferir o convite antes de reprocessar `email.enviar-convite` está bom. Se no futuro aparecer um job de mensagem à… |
| 2026-11-12 19:34:42 | `infra-guardian` | 2ª | APROVADO | `3_task` | A parada do `worker-pdf` (`ensaio-alertas.ts:591`) só é provada pelo estouro do prazo do ensaio (mutação sem bloco, descrita em `3_task.md`). Depois do `stop`,… |
| 2026-11-12 19:35:05 | `revisor-geral` | 2ª | APROVADO | `3_task` | `tasks/prd-ingestao-do-material/3_task.md`, "Sem bloco, com o motivo": a parada do `worker-pdf` no ensaio ficou sem mutação que caia por asserção. Quando ela… |
| 2026-11-12 19:35:37 | `test-engineer` | 2ª | APROVADO | `3_task` | A parada do `worker-pdf` só tem prova lenta. `ensaio-alertas.ts:591` não tem bloco de mutação, e o motivo registrado procede: sem a parada, o teste falha pelo… |
