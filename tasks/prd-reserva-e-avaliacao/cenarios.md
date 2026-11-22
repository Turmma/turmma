# Cenários — Provedor de reserva e avaliação dos modelos

> Acompanha `techspec.md`. Separados dos cenários da F5 (`tasks/prd-camada-ia/cenarios.md`) no corte de 21/11/2026, sem
> mudar cenário: as linhas que a F5a já cumpriu (o custo por chamada, a troca para o modelo menor, a contagem de execuções,
> o preço do principal na subida) ficaram lá. Os números das seções são os da F5.
>
> Cada linha diz o teste, a camada e a mutação que o derruba. Os nomes de arquivo são os
> prováveis; a tarefa fixa o caminho. Nenhum cenário chama provedor pago: principal e provedor de reserva são
> `FakeAdapter`s com `provedorId` distintos, ou um adaptador de teste que falha sob comando (5xx, prazo, conexão).
> `MODELOS_APROVADOS` é injetado no teste.

## 1. Por RF

### Reserva e soberania (RF1 a RF5)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF1 | Reserva sem suboperador vigente: o worker sobe, o principal passa, `ia.provedor_de_reserva.conferido = 0`; com o principal fora, a chamada termina `IA_INDISPONIVEL` sem chamar a reserva | integração, `apps/api/src/ia/reserva-na-subida.int.test.ts` | tirar a conferência da elegibilidade |
| RF1 | Variantes: `pais_fora_do_brasil`, `treinamento_nao_vedado`, suboperador encerrado (contrato vencido) e reinício: fora do caminho, o principal segue | idem | conferir só a existência do suboperador |
| RF1 | Reserva com `pais_fora_do_brasil` aprovada só para `relatorio_da_correcao` (envia `trabalho_do_aluno` sem `levaTextoDeAluno`), e outra só para `gerar_atividade_objetiva`: as duas não elegíveis | `soberania.test.ts` | exigir Brasil só com `levaTextoDeAluno` |
| RF1 | O cadastro corrigido, sem reiniciar (intervalo injetado): a chamada seguinte com o principal fora vai à reserva | idem | conferir uma vez só |
| RF2 | Controle negativo: reserva cobre só `material_da_escola`, aprovada para `gerar_atividade_objetiva` e `turno_do_tutor`: a subida recusa com `categoria_faltando:conversa_do_aluno` | unidade, `packages/core/src/ia/soberania.test.ts` | não exigir categoria |
| RF2 | Controle positivo: reserva cobre só `material_da_escola`, aprovada só para `gerar_atividade_objetiva`: conferida | idem | exigir as categorias de todas as tarefas do catálogo |
| RF2 | Aprovação só para `gerar_atividade_objetiva`, principal **fora**: a geração vai à reserva; o turno do Tutor termina indisponível sem chamar a reserva | unidade, `llm-gateway.test.ts` › "provedor de reserva" | elegibilidade sem o teste da tarefa |
| RF2 | O mesmo com o principal **sem vaga** (balde cheio, sem menor): a geração vai à reserva pelo ramo (1); o Tutor termina `IA_INDISPONIVEL`/`sem_vaga` sem chamar a reserva | idem | conferir a elegibilidade só no ramo da queda |
| RF4 | Tutor aprovado para `(reserva, modelo-x)`; `LLM_RESERVA_MODELO_RAPIDO` trocado para `modelo-y` e principal fora: indisponível, sem chamar a reserva; a regra fixa da D36 responde igual | `llm-gateway.test.ts`, `turno-do-tutor.test.ts` | conferir só o nome da tarefa na aprovação |
| RF4 | O mesmo para `classificar_secoes` | `llm-gateway.test.ts` | idem |
| RF4 | Aprovação para `(outro-provedor, modelo-x)`; reserva com `IA_RESERVA_PROVEDOR_ID` diferente e o mesmo `modelo-x`, principal fora: indisponível, sem chamar a reserva | `llm-gateway.test.ts` | comparar tarefa e modelo sem o `provedorId` |
| RF4 | `MODELOS_APROVADOS`: tarefa fora de `TAREFAS_DE_IA`, entrada sem `relatorio`, `sha256` ou `aprovadoPor`, ou `relatorio` inexistente quebram o teste da constante; a guarda recalcula o sha256 do `relatorio.md` e compara | unidade, `modelos-aprovados.test.ts` | hash qualquer; conferir só a presença do campo |
| RF4 | A função de elegibilidade com `ambiente = producao` recusa a entrada de `falso-reserva` e aceita a de outro provedor; com `local` e `staging`, aceita a do falso | unidade, `modelos-aprovados.test.ts` | aceitar o falso em produção |
| RF4 | A entrada de `falso-reserva` com `sha256` que não bate com o relatório sintético, ou com o relatório ausente, quebra o teste da constante | `modelos-aprovados.test.ts` | isentar a entrada do falso da guarda |
| RF4 | Subida, pela configuração real: `AMBIENTE=producao` com o adaptador falso na reserva, ou com `IA_RESERVA_PROVEDOR_ID=falso-reserva` sobre `openai_compat`, recusa citando a variável (como `MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO`); `IA_RESERVA_PROVEDOR_ID` igual ao `IA_PROVEDOR_ID` recusa em qualquer ambiente, com caso em `AMBIENTE=local` | `packages/core/src/config/llm-config.test.ts` | aceitar a falsa em produção; não comparar os dois ids; comparar só em produção |
| RF4 | A reserva falsa com `IA_RESERVA_PROVEDOR_ID=falso-reserva`: o balde, o rótulo `provedor` da medida e o disjuntor são os dela, diferentes dos do principal falso | `llm-gateway.test.ts` | identidade do falso fixa em `falso` |
| RF3 | Disjuntor do principal aberto: vai à reserva; a saída é a dela; `ia.degradacao{degrau="provedor_de_reserva"}` soma 1 | `llm-gateway.test.ts` | tirar o ramo da queda |
| RF3 | `IA_INDISPONIVEL` de servidor, e de conexão: vai à reserva | idem | tratar só o disjuntor como queda |
| RF3 | `IA_TEMPO_ESGOTADO` com o sinal vivo: vai à reserva; com o sinal **já abortado**: não vai | idem | tirar `!sinal.aborted` (o abortado), tirar o prazo da lista de quedas (o vivo) |
| RF3 | Com modelo menor disponível e reserva elegível, sem vaga no principal: vai ao menor, não à reserva | idem | reserva antes do menor |
| RF3 | O 429 que sobra da repetição: tratado como sem vaga (menor, depois reserva) | idem | tratar o 429 como queda |
| RF3 | Sem vaga no principal: o provedor de reserva usa o balde dele; sem vaga também ali: `IA_INDISPONIVEL`, `sem_vaga` | `llm-gateway.test.ts`, `token-limiter` falso | usar o balde do principal |
| RF3 | A reserva é tentada uma vez: principal fora e reserva fora, uma chamada a ela; no interativo, indisponível; no lote, `JobAdiadoError(provedor)` | `llm-gateway.test.ts`, `fila-de-ia.int.test.ts` | laço de volta ao principal |
| RF3 | No máximo quatro chamadas: principal inválido duas vezes não vai à reserva (saída inválida não é queda); principal com 5xx e reserva inválida duas vezes: três linhas (a estimada do principal e as duas da reserva), termina `IA_SAIDA_INVALIDA` | idem | repetir sem limite |
| RF3 | A saída inválida da reserva repete **na reserva** (a segunda chamada tem o `provedorId` dela) | idem | repetir no principal |
| RF3 | "Provedor de IA fora" com os dois fora: a regra tem rótulo `provedor` e dispara para cada um | `infra/test/alertas.test.ts` | rótulo fixo |
| RF3 | A variante sem reserva do teste do "degrau 3" (`llm-gateway.test.ts`, por volta da linha 995) segue igual à da X6 | idem | — |
| RF5 | Principal com prazo esgotado, reserva atende: a linha do principal tem a estimativa (entrada contada, saída no teto, preço do principal; custo > 0); a da reserva, o uso real e `pelo_provedor_de_reserva = true` | idem | custo zero na linha que caiu |
| RF5 | Chamada pela reserva: o compartilhamento do aluno lista o suboperador da reserva | `apps/api/test/arquivo-do-titular.int.test.ts` | gravar o provedor do principal |
| RF5 | Interrompida pela **varredura** (worker morto, 300 s) de tarefa aprovada para o provedor de reserva configurado, com preços diferentes no principal (1.300/5.200) e na reserva (2.000/8.000): estimada do principal **e** a dele, cada uma com os dois tetos ao seu preço; o compartilhamento do aluno lista as duas | `apps/api/test/arquivo-do-titular.int.test.ts`, `consumo.test.ts` | estimada só no destino do principal |
| RF5 | O mesmo pela **reentrega** do job (o job volta e acha a execução `rodando`, `#aoReentregar`): as duas estimadas; o compartilhamento lista as duas | `apps/api/src/ia/fila-de-ia.int.test.ts`, `arquivo-do-titular.int.test.ts` | estimada da reserva só na varredura |
| RF5 | Aprovação `(tarefa, provedor da reserva, modelo-x)` e a reserva configurada com `modelo-y`: a interrompida grava as duas estimadas mesmo assim (destino superestimado, D14); o compartilhamento lista as duas | `consumo.test.ts`, `arquivo-do-titular.int.test.ts` | comparar também o modelo |
| RF5 | Aprovação para a tarefa com **outro** `provedorId`, e a reserva configurada com o seu: a interrompida grava só a estimada do principal; o compartilhamento lista só o principal | `consumo.test.ts`, `arquivo-do-titular.int.test.ts` | comparar sem o `provedorId` |
| RF5 | Interrompida de tarefa sem aprovação para a reserva: só a do principal | idem | estimada da reserva sempre |

### Custo da reserva (RF6) e o alerta da reserva (RF9)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF6 | `AMBIENTE=producao`, `openai_compat`: `LLM_RESERVA_MODELO` sem preço, `LLM_RESERVA_MODELO_<PERFIL>` sem preço: cada um recusa a subida citando a variável (o do principal é da F5a) | `llm-config.test.ts`/`llm-gateway.test.ts` | exigir preço só do principal |
| RF6 | A interrompida grava uma linha por destino, cada uma com os **dois tetos** da tarefa ao preço do seu modelo (preços diferentes nos dois), custo > 0 | `consumo.test.ts` | custo zero na estimada; preço do principal na linha da reserva; entrada contada na interrompida |
| RF9, a reserva | O alerta de `ia.provedor_de_reserva.conferido` dispara com 0 por 10 min, com o parágrafo do runbook | `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | — |
| RF9, a reserva | Worker sem `LLM_RESERVA_BASE_URL` nem `IA_RESERVA_PROVEDOR_ID`: a série `ia.provedor_de_reserva.conferido` não é publicada e o alerta não dispara; com a reserva configurada e recusada, publica 0 e dispara em 10 min | `apps/worker/test/` (a medida da conferência), `infra/test/alertas.test.ts` | série publicada com 0 sem reserva; alerta por `absent()` |

### Avaliação (RF13 a RF16)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF13–16 | A ferramenta recusa rodar sem `AVALIACAO_*`; o relatório grava o sha256 do arquivo de amostras lido; não importa nada de teste; nenhum teste a executa contra rede | unidade, `tools/ia/avaliar-modelos.test.ts` | rodar sem a variável; sha256 de outro arquivo |
| RF13 | `tools/ia/amostras/` não tem amostra que peça correção, nota ou devolutiva de discursiva ou redação (D55) | `tools/guardas/` (guarda nova) | — |

## 5. Carga

A fase `reserva` do `carga.ts`, com `LLM_RESERVA_TOKENS_POR_MINUTO` de `infra/carga.env`. A fase `sala` roda com a
reserva desligada, para continuar comparável à X6.

- **Queda por servidor:** a meio da fase, o principal falso responde 5xx em 100% (`IA_FALHA_FALSA=principal:5xx`), e a
  reserva falsa atende. Passa com zero indisponível para o aluno, o p95 do turno do Tutor até 1 s acima do da fase
  `sala`, e `ia.degradacao{degrau="provedor_de_reserva"}` subindo.
- **Queda por prazo:** `IA_FALHA_FALSA=principal:prazo`. Passa com indisponível só quando o prazo da execução já
se esgotou antes da reserva, sempre `IA_TEMPO_ESGOTADO` tipado e nunca erro cru; o número fica no relatório da fase.
- **Balde cheio no pico:** o balde do principal no limite, e o transbordo vai à reserva sem indisponível.
- **Identidade:** a carga roda com `AMBIENTE=local`, como hoje. A reserva falsa liga com `IA_RESERVA_PROVEDOR_ID=falso-reserva`,
  id diferente do principal, com balde, rótulo e disjuntor próprios, e a entrada sintética dela em `MODELOS_APROVADOS`
  vale fora de produção. `IA_FALHA_FALSA` só tem efeito no `FakeAdapter`.
- **Controle negativo:** a mesma fase com `IA_RESERVA_PROVEDOR_ID=falso-sem-aprovacao` (id sem entrada) reprova pelo
  critério: o worker sobe, a reserva fica não elegível, e há indisponível acima de zero na janela da queda.
