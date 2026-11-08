# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-07 10:39:12 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §9 e `cenarios.md`: os quatro estados e o texto de erro com próximo passo não estão definidos para esqueci, redefinir, verificar, conta da escola… |
| 2026-11-07 10:41:29 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Cenários do `desativar` que não chegam à cláusula (cenarios.md, RF11, as duas linhas citadas acima; Tech Spec §2 "`ciclo-de-vida/`" e §5 "A revogação, o… |
| 2026-11-07 10:41:42 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | §5 "Senha provisória" e §7 "Retenção e eliminação"; `cenarios.md`, "Auditoria e dado". A D85 (`docs/decisoes.md:1637-1638`, de 06/11, posterior à aprovação… |
| 2026-11-07 10:41:57 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec, seções 5 ("E-mail", "Esqueci", "Posse do e-mail") e 6: o job de sistema nasce de uma requisição HTTP, e o código atual recusa isso. |
| 2026-11-07 10:42:10 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Gerar a senha provisória duas vezes ao mesmo tempo não tem trava (techspec.md §5 "Senha provisória"; tabela "Corridas" do cenarios.md). |
| 2026-11-07 10:43:07 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | A D85 foi atribuída a esta spec e não está na Tech Spec nem nos cenários. A D85 foi decidida em 06/11, depois desta Tech Spec. Ela diz que o código entra pela… |
| 2026-11-07 10:48:00 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | Em "Gerar provisória", o erro 429 diz só "o limite". Escreva o texto, por exemplo "Muitas tentativas. Espere alguns minutos e tente de novo". |
| 2026-11-07 10:49:34 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §4 e §7c; `cenarios.md`, "Limites", linha "Convites", e "Corridas". A spec agora recusa inteiro o lote acima da cota de 300/h, mas não diz como a… |
| 2026-11-07 10:49:47 | `revisor-geral` | 2ª | APROVADO | `revisao-spec` | §5, "Arquivo do titular". A spec não diz de onde vem o papel nas quatro ações da F2. Elas não guardam papel no `depois`, e o autor delas é sempre a coordenação… |
| 2026-11-07 10:49:49 | `tenancy-guardian` | 2ª | APROVADO | `revisao-spec` | §5, "Auditoria" (contexto por escola na rota anônima). O `AuditoriaRecorder` tira a escola e o autor do contexto, e o `naEscolaSemUsuario` não põe usuário,… |
| 2026-11-07 10:49:58 | `privacy-guardian` | 2ª | APROVADO | `revisao-spec` | que vocês adotaram, todas presentes: |
| 2026-11-07 10:50:30 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | A confirmação da provisória não separa homônimos de verdade (cenarios.md, "E2E (RF18)", caso dos homônimos, e "Telas", linha "Gerar provisória"). |
| 2026-11-07 10:54:24 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | . |
| 2026-11-07 10:54:37 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | A saída de "adiar sem gastar tentativa" não diz o que acontece com a vaga da escola nem com o estado do job. Está na Tech Spec §2 (linha `job-executor.ts`) e… |
| 2026-11-07 10:56:12 | `infra-guardian` | 4ª | APROVADO | `revisao-spec` | Tech Spec §5 "E-mail": o job consome o ponto do `EMAIL_POR_MINUTO` antes de reservar a linha. Se a linha tem reserva alheia vigente, ou já está `enviado` ou… |
| 2026-11-07 10:56:21 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | A variação aleatória da espera não tem cenário que a prove. Fica em `cenarios.md`, "RF11", no [I] "Job adiado: … a espera é o `msBeforeNext` (ou o prazo da… |
| 2026-11-07 10:57:37 | `test-engineer` | 5ª | APROVADO | `revisao-spec` | Fixar o teto no limite no [I] "Ponto ... volta" (cenarios.md, RF11). Usar `EMAIL_POR_MINUTO` igual a 1 (ou com o minuto já cheio menos um) no teste. Assim "a… |
| 2026-11-07 15:09:28 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | `packages/core/src/email/envio.repository.ts:40` e `packages/core/src/retencao/expurgo-da-escola.repository.ts:487` usam SQL cru com o escopo escrito à mão.… |
| 2026-11-07 15:09:30 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | Quando a tarefa 3.0 ligar a rota "Enviar", vale reauditar a regra 70 se a tela de convites mostrar qualquer coisa além do estado do envio. Exemplos: contagem… |
| 2026-11-07 15:10:40 | `infra-guardian` | 1ª | APROVADO | `1_task` | O corte de 10 s não para o envio de verdade. |
| 2026-11-07 15:11:15 | `privacy-guardian` | 1ª | APROVADO | `1_task` | Os cifrados fora do arquivo do titular. A `techspec.md` §7 diz "cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`", mas `convite.token_cifrado` e… |
| 2026-11-07 15:11:30 | `revisor-geral` | 1ª | REPROVADO | `1_task` | `packages/shared/src/privacidade/classificacao.ts:149`. A tarefa ignorou um item da Tech Spec que já estava lá antes dela. |
| 2026-11-07 15:12:21 | `test-engineer` | 1ª | APROVADO | `1_task` | Corrida direta na reserva. Em `apps/worker/test/enviar-email.int.test.ts:291`, o caso `[P] duas execuções` sobrepõe as execuções, mas a reserva da primeira já… |
| 2026-11-07 19:44:36 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | `apps/api/src/sessao/convite/convite-ticket.ts`: o `verificado.payload.iat ?? 0` nunca usa o `0`, porque `requiredClaims` já exige `iat`. Se um dia o… |
| 2026-11-07 19:45:11 | `revisor-geral` | 2ª | APROVADO | `1_task` | `challenge.ts` e `operador-challenge.ts`: os dois usam o mesmo `maxTokenAge` sem folga. O documento menciona isso como "ressalva do relatório", mas não está no… |
| 2026-11-07 19:45:15 | `privacy-guardian` | 2ª | APROVADO | `1_task` | Registrar na retro, ou no `TODO.md`, uma falha que a estabilização revelou e que mexe com a regra 18. A ativação por convite compara duas horas do relógio do… |
| 2026-11-07 19:45:24 | `infra-guardian` | 2ª | APROVADO | `1_task` | Desafio do login. `apps/api/src/credencial/challenge.ts` e `operador-challenge.ts` usam o mesmo `maxTokenAge` sem folga, no caminho quente do login com segundo… |
| 2026-11-07 19:45:51 | `test-engineer` | 2ª | APROVADO | `1_task` | Tabela "Testes que provam a regra" do `1_task.md`. Os três casos novos aparecem só nos blocos de mutação, não na tabela: |
| 2026-11-07 21:16:20 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | `apps/worker/test/enviar-email-adiamento.int.test.ts:309` e `312-323`: no caso "o convite que é de outra escola", o teste só confere que o ponto volta. Vale… |
| 2026-11-07 21:16:28 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | O texto de impacto no `docs/runbook.md` diz que "o professor não recebe o convite". Ele está bem como descrição operacional. Se esse diagnóstico um dia virar… |
| 2026-11-07 21:16:52 | `privacy-guardian` | 1ª | APROVADO | `2_task` | Pôr no `docs/lgpd.md` uma linha curta sobre o contador global `EMAIL_POR_MINUTO`, ao lado dos "Contadores do acesso" (linha 89). Seria para deixar escrito que… |
| 2026-11-07 21:17:22 | `revisor-geral` | 1ª | APROVADO | `2_task` | Alerta de adiamento longo: a `techspec.md` §7c diz que o adiamento longo cai no "alerta de idade da fila". Esse alerta só existe para a fila `interativa`… |
| 2026-11-07 21:18:51 | `infra-guardian` | 1ª | APROVADO | `2_task` | Falta alerta para adiamento longo na fila normal. Em tasks/prd-acesso-e-convites/techspec.md:168 diz "adiamento longo: o alerta de idade da fila". Esse alerta… |
| 2026-11-07 21:19:21 | `test-engineer` | 1ª | REPROVADO | `2_task` | `packages/core/src/email/limite-por-minuto.ts:48-51`: o caminho de produção do relógio, o `TIME` do Redis, não tem teste nem bloco de mutação. |
| 2026-11-07 21:40:02 | `infra-guardian` | 2ª | APROVADO | `2_task` | A recomendação da rodada 1 sobre o runbook foi atendida. O "Primeiro olhar" em `docs/runbook.md` (linhas 677-681) agora olha as últimas 25 h, porque o convite… |
| 2026-11-07 21:40:16 | `tenancy-guardian` | 2ª | APROVADO | `2_task` | `apps/worker/test/enviar-email-adiamento.int.test.ts:57-62`: a asserção nova de log só confere que o endereço não aparece. O comentário dela também promete que… |
| 2026-11-07 21:40:19 | `conformidade-reviewer` | 2ª | APROVADO | `2_task` | Mantenho a da rodada 1, já registrada na tarefa: se um dia a falha de convite virar lista ou painel com o nome do destinatário, essa tela precisa ser revista… |
| 2026-11-07 21:40:19 | `privacy-guardian` | 2ª | APROVADO | `2_task` | `apps/worker/test/enviar-email-adiamento.int.test.ts:199`: o comentário diz "nunca o endereço nem o token", mas a verificação só cobre o endereço. Ou o teto do… |
| 2026-11-07 21:40:33 | `test-engineer` | 2ª | APROVADO | `2_task` | O caso do relógio do Redis confere a janela e o `msBeforeNext` por faixa, e não pela igualdade exata que a correção pediu. Ele já derruba as duas mutações, e… |
| 2026-11-07 21:40:43 | `revisor-geral` | 2ª | APROVADO | `2_task` | As sete linhas prometidas no `TODO.md` não existem ainda. A tabela "Recomendações sem aplicar" de `tasks/prd-acesso-e-convites/2_task.md` manda sete itens para… |
| 2026-11-07 22:57:08 | `tenancy-guardian` | 1ª | APROVADO | `3_task` | `packages/core/src/rate-limit/cota-por-hora.ts`: o mapa `#seguro`, usado quando o Redis está fora, guarda uma entrada por escola e nunca apaga as antigas, nem… |
| 2026-11-07 22:57:18 | `conformidade-reviewer` | 1ª | APROVADO | `3_task` | Na tarefa 4.0 (a tela), mostrar `envio` e o estado do convite só como informação operacional de entrega. Nada de contagem, ordenação ou destaque de… |
| 2026-11-07 22:58:29 | `privacy-guardian` | 1ª | APROVADO | `3_task` | Na tarefa 11.0 (D85, arquivo do titular), a tabela `convite` não entra no arquivo. Hoje o arquivo do professor não diz que o endereço dele foi ao provedor de… |
| 2026-11-07 22:58:45 | `revisor-geral` | 1ª | APROVADO | `3_task` | `apps/api/src/sessao/convite/convite-de-professor.service.ts:141`: o filtro do lote está numa linha só, com a matriz, o `ultimoConvite` e o `email !== null`.… |
| 2026-11-07 22:58:52 | `infra-guardian` | 1ª | APROVADO | `3_task` | apps/api/src/sessao/convite/convite-de-professor.service.ts:147 — o laço faz cerca de 6 idas ao banco por convite: revogar, uuidv7, insert, convite.refeito,… |
| 2026-11-07 23:00:11 | `test-engineer` | 1ª | REPROVADO | `3_task` | O endereço cifrado nunca é conferido. O token pode ir para o professor errado. |
| 2026-11-07 23:23:47 | `privacy-guardian` | 2ª | APROVADO | `3_task` | Em `apps/api/test/convites-enviar.int.test.ts:477`, o teste confere as chaves só da primeira linha do aviso (`linhasDoAviso[0]`). Conferir todas as linhas… |
| 2026-11-07 23:24:05 | `infra-guardian` | 2ª | APROVADO | `3_task` | `apps/api/test/convites-enviar.int.test.ts`, caso das "3 instâncias com o Redis de fila fora": os 101 professores são semeados um por vez, o que deixa a suíte… |
| 2026-11-07 23:24:10 | `revisor-geral` | 2ª | APROVADO | `3_task` | `apps/api/src/sessao/convite/convite-de-professor.service.ts:148`: o parâmetro do `.filter((pedido) => ...)` esconde o `pedido: EnviarConvitesRequest` da… |
| 2026-11-07 23:24:39 | `test-engineer` | 2ª | APROVADO | `3_task` | Em `apps/worker/test/enviar-email.int.test.ts:137`, tirar o filtro `entidade_id = $2` e contar `convite.enviado` só por `escola_id`. A escola é nova no caso, e… |
| 2026-11-08 12:43:56 | `tenancy-guardian` | 1ª | APROVADO | `4_task` | O `eq(convite.escolaId, escolaId)` em `professores.repository.ts:45` não tem teste próprio. Ele é uma defesa em profundidade, porque o `inArray` já está… |
| 2026-11-08 12:44:02 | `frontend-reviewer` | 1ª | APROVADO | `4_task` | `apps/web/src/areas/coordenacao/professores/Professores.tsx`, o `<span aria-live="polite" className="… empty:hidden …">` da coluna Situação. A região fica… |
| 2026-11-08 12:44:18 | `privacy-guardian` | 1ª | APROVADO | `4_task` | O arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts`) não lê a tabela `convite`, então não traz o envio do convite do professor (canal,… |
| 2026-11-08 12:44:31 | `infra-guardian` | 1ª | APROVADO | `4_task` | `apps/web/src/areas/coordenacao/professores/Professores.tsx`: cada releitura usa o `lerPaginas` e lê a lista inteira, até 10 páginas de 100. Uma escola com… |
| 2026-11-08 12:45:15 | `revisor-geral` | 1ª | REPROVADO | `4_task` | O diálogo "Enviar convites" pode mandar uma lista vazia. Em `apps/web/src/areas/coordenacao/professores/Professores.tsx:368` e `:400-406`, o `quemEspera` é… |
| 2026-11-08 12:46:32 | `test-engineer` | 1ª | REPROVADO | `4_task` | `packages/shared/src/professores/professores.ts:562` (`enviadoEm: z.iso.datetime().nullable().default(null)`) é uma cláusula nova sem bloco na seção "Mutações". |
| 2026-11-08 13:12:17 | `revisor-geral` | 2ª | APROVADO | `4_task` | O texto novo "Ninguém espera o convite agora: a lista mudou. Confira a situação de cada professor." é visto pela pessoa e não está em `cenarios.md` (RF11) nem… |
| 2026-11-08 13:12:23 | `frontend-reviewer` | 2ª | APROVADO | `4_task` | Rodada 1 aprovada sem correções exigidas, e o diff desta rodada só endurece o que já passou. `TEXTO_SEM_QUEM_ESPERE_O_CONVITE` está em português claro e diz o… |
| 2026-11-08 13:12:45 | `test-engineer` | 2ª | APROVADO | `4_task` | O `semDisplayNone` (`Professores.test.tsx:105`) confere o texto da classe (`not.toContain('hidden')`), e não o estilo calculado. Ele pega a volta do… |
| 2026-11-08 13:12:45 | `conformidade-reviewer` | 2ª | APROVADO | `4_task` | O texto novo "Ninguém espera o convite agora: a lista mudou. Confira a situação de cada professor." (`envio-do-convite.ts:64`) é bom. Seria útil ter uma foto… |
| 2026-11-08 13:12:46 | `infra-guardian` | 2ª | APROVADO | `4_task` | `apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx:82`: se o envio falhar e depois a lista for relida para zero pendentes, o diálogo… |
