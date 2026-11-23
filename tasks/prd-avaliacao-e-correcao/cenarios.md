# Cenários — Avaliação e correção (prova online)

> Acompanha `techspec.md`. Cada linha diz o teste, a camada e a mutação que o derruba. Os nomes de arquivo são os
> prováveis; a tarefa fixa o caminho. Precedentes: `apps/api/src/atividade/atividade.int.test.ts` (o aluno responde, a
> sequência, o 404 da outra escola, o encerramento com a função suspensa), `apps/api/test/atividade.fixture.ts`
> (`aplicarAtividade`, `responderProva`, `encerrarAtividade`), `apps/api/test/atividade-isolamento.int.test.ts` (vínculo
> encerrado, contexto errado de escola e de ano), `e2e/aluno-atividade.spec.ts` e `e2e/support/atividade-db.ts`. O relógio
> é o do banco, deslocado por `abre_em`/`fecha_em` no passado ou no futuro; nenhum teste dorme. O tique do pulso, o relógio
> da recusa da instância e o sorteio da ordem são
> injetados (o sorteio com sequência fixa).

## 1. Por RF

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF1 | Aluno começa antes de `abre_em` e depois de `fecha_em`: `PROVA_FORA_DA_JANELA`, sem tentativa | integração, `prova-online.int.test.ts` | tirar a conferência da janela |
| RF1 | Duração 40 min, começo a 10 min do `fecha_em`: `limiteEm` = `fecha_em` | unidade, `limite-da-tentativa.test.ts`; integração | `limite_base_em` sem o `min` |
| RF1 | Avaliativa nova sem janela e não avaliativa com janela: `ENTRADA_INVALIDA`; não avaliativa responde sem limite | integração | aceitar avaliativa sem janela |
| RF2 | Mudar janela sem tentativa: grava e audita; com uma tentativa iniciada: `PROVA_JA_COMECOU`, nada muda | integração | tirar o `not exists` da tentativa |
| RF2 | Tempo adicional mudado pela rota `janela`: antes do primeiro começo grava; depois, `PROVA_JA_COMECOU` | integração | aceitar depois do começo |
| RF3 | +25%, +50% e +100% sobre 40 min: 50, 60 e 80; o colega sem tempo adicional, 40 | integração | aplicar o percentual a todos |
| RF3 | Aluno de outra turma, de outra escola ou inexistente no tempo adicional, na extensão ou na segunda chamada: `ENTRADA_INVALIDA`, nada gravado (a mesma resposta nos três) | integração | confiar na FK |
| RF3 | Janela de 50 min, duração 40 e um aluno com +50%: `ENTRADA_INVALIDA` no campo da janela, ao aplicar, ao mudar a janela e na segunda chamada; janela de 60 min passa | integração | tirar a conferência de que cabe |
| RF3 | O contrato de aplicar não tem campo de motivo; chave a mais é `ENTRADA_INVALIDA` | unidade, `packages/shared` | schema sem `.strict()` |
| RF3 | O aluno com +50% lê `duracaoMin = 60` em `prova` e em `minhas-atividades`, e nenhuma resposta dele diz "tempo adicional" nem o percentual | integração; unidade web, `AntesDeComecar.test.tsx` | expor o percentual |
| RF4 | Estender 10 min só para A: A grava depois do limite antigo; B recebe `TEMPO_ESGOTADO` | integração | somar a extensão de aluno a todos |
| RF4 | Estender a turma: todos andam, e o fim efetivo da janela também | unidade e integração | só nas tentativas iniciadas |
| RF4 | Estender com 0 ou 121 minutos: `ENTRADA_INVALIDA`; prova encerrada: `ATIVIDADE_ENCERRADA` | integração | aceitar sem olhar estado e faixa |
| RF4 | A mesma `chave` em outra aplicação é outra extensão (a chave é por aplicação) | integração | chave única por escola |
| RF5 | PUT depois do limite: `TEMPO_ESGOTADO`, sem linha; a leitura diz `envio = 'limite'`; o envio pelo aluno depois do limite também é recusado | integração | comparar com o relógio do cliente; gravar antes de conferir |
| RF5 | Tentativa vencida sem envio entra na correção do encerramento com o que foi salvo | integração | corrigir só com `enviada_em` |
| RF5 | Professor encerra antes do fim com 3 fazendo: a confirmação diz "3 alunos ainda estão fazendo"; as três vão com o salvo | unidade web, `PainelDaAtividade.test.tsx`; integração | confirmar sem contar |
| RF6 | Indisponibilidade de 5 min dentro da prova: o limite anda 5 min; fora dela, não; duas, a segunda dentro do limite já estendido: as duas contam | unidade, `limite-da-tentativa.test.ts` | somar toda; uma passada só |
| RF6 | Lacuna aberta: pulso de 2 min atrás, o limite anda 2 min; de 20 s atrás, não anda | unidade | sem a lacuna aberta; sem o limiar de 30 s |
| RF6 | A mesma indisponibilidade **fechada** de 5 min dentro da prova, em cada chamador: a saída é aceita depois do limite original; `prova` e `tempo` devolvem o `limiteEm` com os 5 min; o Tutor segue travado nesse tempo | integração | aquele chamador sem `limiteDaTentativa` |
| RF6 | Lacuna **aberta** montada à mão (a linha do pulso envelhecida 3 min, o tique da instância parado e o relógio da recusa injetado ainda fresco): o Tutor, que não é rota de prova, segue travado além do limite original; o PUT, a saída, `prova` e `tempo`, chamados nesse estado, contam os 3 min | integração | aquele chamador sem a lacuna aberta |
| RF6 | PUT com uma indisponibilidade de 5 min dentro da tentativa, 2 min depois do limite original: grava | integração | o PUT sem indisponibilidade |
| RF6 | Pulso com lacuna de 40 s grava uma `indisponibilidade`; de 20 s, nenhuma; tabela vazia, nenhuma | integração, `pulso.int.test.ts` | limiar trocado |
| RF6 | Pulso parado 40 min, volta: grava 40 min, e o limite anda 40, igual ao que a lacuna aberta dava antes da volta | idem | teto numa das duas |
| RF6 | Falha forçada depois do `update` do pulso: nada grava, e a lacuna aparece no próximo pulso | idem | `update` e `insert` em commits separados |
| RF6 | Conexão do pulso derrubada (`pg_terminate_backend`): o tique seguinte (injetado) reconecta e grava, sem indisponibilidade | idem | sem reconexão |
| RF6 | Tique falhando e o relógio injetado da instância avançado 31 s: `comecar`, `prova`, `tempo`, PUT, envio e `saidas-da-aba` respondem 503; o resto da API segue; o tique volta e elas aceitam de novo | idem | recusar a API inteira, ou nada; recusa presa |
| RF6 | A API só aceita tráfego depois do primeiro pulso | integração | pulso depois do `listen` |
| RF6 | Fila do cliente: 3 respostas sem rede, a rede volta, as 3 gravam uma vez | unidade web, `fila-de-respostas` (precedente: `espelho-da-fila.test.ts`) | descartar a fila na queda |
| RF6 | Fila pendente com `TEMPO_ESGOTADO`; o professor estende; `tempo` traz o limite novo; a fila reenvia e grava | unidade web | parar a fila no primeiro `TEMPO_ESGOTADO` |
| RF6 | "Sair da prova" com 2 pendentes presas em `TEMPO_ESGOTADO`: a fila relê `tempo`, o limite andou, e grava; o fim do tempo com 2 pendentes mostra "2 respostas não chegaram" | unidade web | fila presa à rota |
| RF6 | A fila de saídas recebe 429 e a de respostas segue gravando | unidade web | uma fila só |
| RF6 | 3 respostas recebem 503 e depois 200: as 3 gravam uma vez; uma saída com 503 volta com a mesma chave; `tempo` com 503 mantém o último limite na tela | unidade web | descartar o item no 5xx |
| RF9 | A `chave` da saída é uuid v4 gerada no cliente; uma v7 é `ENTRADA_INVALIDA` | unidade, `packages/shared` | aceitar qualquer uuid |
| RF6 | Relógio do cliente 10 min adiantado: a tela mostra o tempo do servidor | unidade web, `ProvaEmFoco.test.tsx` | `Date.now()` sem o desvio |
| RF7 | Antes de começar: duração, aviso e "Começar"; nenhuma questão antes do clique | e2e, `aluno-prova.spec.ts` (`chromebook`, `celular`) | mostrar a questão sem "Começar" |
| RF7 | `GET /prova` sem tentativa devolve janela e duração, **sem questões**, e não cria tentativa; só `comecar` cria (U05-15) | integração (troca o caso "abrir a prova cria a tentativa") | GET gravando; questões antes |
| RF7 | Na prova, sem lateral nem Tutor; "Sair da prova" leva a Atividades, e voltar mostra o mesmo relógio | e2e | prova dentro da casca |
| RF8 | Sorteio fixo: dois alunos com ordens diferentes conhecidas; marcar a certa pelo índice original dá acerto nos dois, e o desempenho por habilidade é o mesmo da ordem original | integração | correção pela posição na tela |
| RF8 | Só alternativas embaralhadas: questões na ordem original; sem embaralhar: `ordem` nula | integração | embaralhar o que não foi pedido |
| RF8 | Retomada: a segunda leitura traz a mesma ordem | integração | sortear a cada leitura |
| RF9 | Saída numa avaliativa em andamento soma 1; a mesma chave não soma; chave nova soma; A, B e A: 2 | integração, `saida-da-aba.int.test.ts` | contar sem a tabela de chaves |
| RF9 | Saída em não avaliativa, em tentativa enviada ou vencida: `NAO_ENCONTRADO`, nada muda | integração | somar sem olhar `avaliativa` ou limite |
| RF9 | Saídas na prova 1; a prova 2 começa em 0; nenhuma leitura devolve soma por aluno | integração | somar por aluno |
| RF9 | A mesma tentativa com 0 e com 9 saídas: mesma correção e mesmos destaques; lote com saídas e sem destaque aprova sem abrir ninguém; PUT segue gravando depois de 9 saídas | integração, `correcao.int.test.ts` | saída como destaque ou trava |
| RF9 | O lote da avaliativa traz `saidasDaAba`; o da não avaliativa não; o `apresentado` não leva contagem por aluno, e o registro da validação da avaliativa marca que a coluna foi mostrada (o da não avaliativa, não) | integração | pôr no `apresentado`; não gravar a marca |
| RF9 | Aluno: nunca `saidas`, `tempoAdicional` nem percentual; `limiteEm` só o dele. Coordenação e rede: nenhum dos três de aluno. O acompanhamento não traz `saidas`. Os contratos do aluno pelo mecanismo que o teste já tem | `apps/api/test/contracts.test.ts` | expor no DTO |
| RF9 | As colunas da `saida_da_aba` são exatamente escola, ano, aplicação, aluno e chave, nenhuma com default `uuidv7()` | integração de schema (padrão `mvp-tables.int.test.ts`) | coluna de tempo de qualquer tipo; `id` uuidv7 |
| RF9 | Tela: `visibilitychange` e `blur` seguidos somam 1; com a rede caindo, A, B e reenvio saem em série | unidade web | contar os dois; mandar em paralelo |
| RF9 | Tela Aprovar: a coluna só em avaliativa e sempre com o aviso fixo, também a 360 px | unidade web, `Aprovar.test.tsx` | coluna sem aviso |
| RF10 | Com a original aberta, ou para aluno que enviou: `ENTRADA_INVALIDA`; com artefato que não é objetiva ou versão adaptada não aprovada: as recusas do aplicar | integração, `segunda-chamada.int.test.ts` | não conferir a original; pular as checagens do aplicar |
| RF10 | Convocado vê e começa; não convocado não vê na lista e recebe `NAO_ENCONTRADO` em `comecar`, `prova`, `tempo`, PUT e saídas | integração | lista ou rota sem o filtro |
| RF10 | Com o lote da original **aprovado**, a segunda chamada encerra e corrige num lote próprio; o da original não muda | integração | corrigir no lote da original |
| RF10 | Aluno que começou e venceu sem enviar não é convocável (conta como enviada); segunda chamada de uma segunda chamada: `ENTRADA_INVALIDA` | integração | olhar só `enviada_em`; aceitar encadear |

## 1b. Acesso, ano letivo e vínculo

| Cenário | Mutação |
|---|---|
| Escola sem ano em curso: as rotas do aluno, `NAO_ENCONTRADO` (o ano é parte do alcance) e `minhas-atividades` vazia; as do professor, a recusa de hoje no aplicar e `NAO_ENCONTRADO` no `:id` | tirar o `anoLetivoId` do `where` |
| Aluno transferido do 7ºA para o 7ºB com tentativa em andamento em A: em A, `comecar`, `prova`, `tempo`, PUT e saídas são `NAO_ENCONTRADO`; a tentativa fica e entra na correção de A; em `minhas-atividades`, só as de B | aceitar vínculo em qualquer estado |
| Convocado transferido antes da segunda chamada: não começa | o mesmo |
| Professor com vínculo encerrado na turma X e aberto na Y: em X não estende, não muda janela, não lê acompanhamento, não abre segunda chamada | o mesmo |
| Professor da mesma escola sem vínculo na turma, e o da turma em outra disciplina: as quatro ações na prova da colega, `NAO_ENCONTRADO` | só o papel na rota |
| Aluno em `extensoes`, `janela`, `acompanhamento` e `segunda-chamada`; coordenação em `acompanhamento` e `correcao`: recusados pela matriz | ação nova fora da matriz |
| Não convocado e aluno de outra turma, **fora da janela**: `NAO_ENCONTRADO`, nunca `PROVA_FORA_DA_JANELA` | conferir a janela antes do alcance |
| Professor de A em cada rota da B; aluno de A em `comecar` e saídas da B: `NAO_ENCONTRADO` | tirar o `escola_id` |
| Repository novo, inclusive o da `saida_da_aba`, contexto de A ou de outro ano com id de B: vazio | o mesmo, no repository |

## 2. Rotina, pulso e Tutor

| Cenário | Camada e arquivo | Mutação |
|---|---|---|
| Provas vencidas em A e em B; só o job de A roda: a de A encerra, corrige e o lote nasce pendente; a de B segue `aberta`, sem lote e sem auditoria | integração, `apps/worker/test/encerrar-provas.int.test.ts` | tirar o `escola_id` da listagem do job |
| Aluno estendido além do `fecha_em`: não encerra até o limite dele; indisponibilidade dentro da janela: não encerra no `fecha_em` | idem | fim efetivo sem extensão de aluno; sem indisponibilidade |
| Pulso parado há 1 min: a rotina não lista nada; o pulso volta: encerra. Job por escola gravado antes da queda e rodado com o pulso velho: não encerra | idem | rotina ou job sem olhar o pulso |
| Escola dentro do horário letivo: a prova vencida encerra no minuto | idem | `naoUrgente: true` |
| Avaliativa vencida numa escola cujo ano encerrou: a rotina não lista, e o alerta não conta | idem | listar sem o ano em curso |
| `correcao_de_objetiva` suspensa em A: a rotina encerra, as respostas ficam, sem lote nem correção, e não volta a listar | idem | chamar a correção sem a conferência |
| Auditoria `atividade.encerrada_pelo_limite`, uma por aplicação, sem aluno | idem | gravar por tentativa |
| Auditorias `atividade.aplicada` (quantos com tempo adicional), `.tempo_estendido`, `.segunda_chamada_aplicada`, `.janela_alterada`: nenhuma leva `alunoId` com percentual nem minutos por aluno | integração | gravar a lista |
| Expurgo: ano encerrado além do prazo apaga `saida_da_aba`, `tempo_adicional`, `extensao_de_tempo` (a da turma também) e `convocado…`; o ano em curso não perde nada; `indisponibilidade` sai aos 13 meses | integração, `apps/worker/test/expurgo.int.test.ts` | tirar a tabela da lista do expurgo |
| Eliminar o aluno com saídas, tempo adicional, extensão e convocação: as linhas saem | `apps/api/test/ciclo-de-vida.int.test.ts` | FK sem cascade |
| Arquivo do titular: as quatro tabelas pelo `aluno_id`, sem `concedido_por` nem `chave`; o adicional de um aluno não aparece no arquivo do professor | `apps/api/test/arquivo-do-titular.int.test.ts` | ligar por `concedido_por` |
| Alerta do pulso: com a API respondendo e o pulso de 2 min, dispara; com o pulso fresco, não | unidade da regra do alerta | — |
| Memória do Tutor: tempo adicional, saídas e limite não entram | `apps/api/src/tutor/tutor.int.test.ts` | selecionar as colunas novas |
| Tutor: prova de amanhã não trava; na janela trava a turma; depois do fim efetivo, não | idem | trava pela aplicação aberta |
| Aluno estendido além do `fecha_em` segue travado até o limite dele; o colega sem extensão destrava | idem | trava só pelo `fecha_em` e extensões da turma |
| Segunda chamada aberta: trava o convocado, não o colega | idem | trava a turma inteira |
| 31ª chamada de `comecar` e de saídas do mesmo aluno no minuto: 429; outro aluno no mesmo IP passa | integração | balde por IP |

## 3. Corridas

| Corrida | Ordem forçada | Mutação que deixa vermelho |
|---|---|---|
| (a) começar × começar | a primeira insere e segura com `WriteBlockTrigger` na tentativa; a segunda chega | recalcular `ordem` ou `limite_base_em` na segunda |
| (b) mudar janela × começar | começar segura `for share`; a janela espera e recebe `PROVA_JA_COMECOU` | leitura sem trava |
| (c) resposta × encerrar e resposta × job | o teste de hoje (`atividade.int.test.ts`, encerramento) roda também com `encerrarPeloLimite` | — |
| (d) estender × estender | a primeira insere e segura com `WriteBlockTrigger` na extensão; a segunda, mesma chave, cai no 23505 e devolve o gravado | tirar o índice único |
| (e) job × professor encerrando | o professor segura a trava da aplicação; o job espera e encontra o lote vigente | `encerrar` sem `lock` |
| (f) job × job | duas execuções do job por escola, a primeira segura com `WriteBlockTrigger` na entrega: um lote, uma auditoria; e o cron duplicado do mesmo minuto grava um job por escola | tirar a trava; tirar a chave do minuto |
| (g) pulso × pulso | pulso de partida com 40 s; a primeira segura `for update`; a segunda lê o `ultimo_em` novo e não grava lacuna | ler sem trava (grava duas) |
| (h) segunda chamada dupla | a primeira insere e segura com `WriteBlockTrigger` na aplicação; a segunda cai no índice parcial: `CONFLITO` | tirar o índice |
| (i) saída × saída | a saída não trava a tentativa antes do `insert`; a primeira lê a contagem e segura com `WriteBlockTrigger` no insert da `saida_da_aba`; a segunda, outra chave, grava; a primeira solta: 2. Mesma chave na mesma ordem: 1 | `saidas = lido + 1`; tirar o índice único |
| (j) estender × rotina | a extensão segura o `for share` com `WriteBlockTrigger` em `extensao_de_tempo`; a rotina chega e espera o `for update`; a extensão confirma; a rotina relê o fim e **não encerra** | conferir o fim antes da trava (encerra) |
| (k) mudar janela × janela | PATCH parcial: a primeira manda só a janela, encurtada para 50 min, e é segurada com `WriteBlockTrigger`; a segunda manda só `tempoAdicional` (+50% sobre 40 min); ela espera o `for update`, relê a janela de 50 e recebe `ENTRADA_INVALIDA` | sem trava (as duas gravam e a combinação não cabe) |
| (l) pulso × rotina | a prova vencida só sem o minuto de queda; o pulso volta depois desse 1 min e é segurado entre o `update` e o `insert` (`WriteBlockTrigger` na indisponibilidade); a rotina roda: vê o pulso velho (a linha travada) e não encerra | `update` e `insert` em commits separados |

## 4. Textos, estados e acessibilidade

| Tela | Estados e textos |
|---|---|
| Aplicar (prova) | "Abre em", "Fecha em", "Duração (minutos)", "Embaralhar questões", "Embaralhar alternativas", "Tempo adicional" (+25%, +50%, +100%), cada campo com rótulo e erro (`FormField`); tempo que não cabe: "O tempo adicional não cabe na janela: com 40 min e +50%, a janela precisa de 60 min." Resumo: "7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo adicional". Sem campo de motivo |
| Acompanhar | carregando; erro com "Tentar de novo"; "Não começou", "Fazendo · termina às 10:42", "Enviou", "Tempo esgotado" (texto, não só cor); horário no fuso da escola; dois alunos de mesmo nome distinguidos pelo segundo nome ou matrícula, como em Alunos |
| Estender | "Mais quantos minutos?" (1 a 120); um aluno ou "a turma toda"; antes de confirmar: "Ana termina às 10:52 em vez de 10:42" |
| Mudar janela | resumo da janela nova e "Ninguém começou ainda"; com alguém começado, o botão não aparece |
| Segunda chamada | os alunos convocados por nome, janela, duração e tempo adicional, antes de confirmar |
| Encerrar | "3 alunos ainda estão fazendo. As respostas salvas deles vão para a correção." |
| Lista do aluno | "Abre em 24/11 às 10:00" (não abre); "Fechou" (passou); segunda chamada só para o convocado; sem prova: o vazio de hoje |
| Antes de começar | "Esta prova tem 40 minutos, contados a partir de Começar." "Se você sair desta aba, isso aparece para o professor. Nada acontece com a sua prova." "Para sair, use Sair da prova. O tempo continua." Fora da janela: "Esta prova abre em 24/11 às 10:00" ou "Esta prova fechou às 11:40" |
| Prova | carregando; relógio "Faltam 12 min"; "Salvo" e "Salvando…" (região `polite`); sem rede: "Sem conexão. Suas respostas ficam guardadas e seguem quando a rede voltar. O tempo continua."; "Sair da prova"; fim: "O tempo acabou. Suas respostas salvas foram enviadas." e, com fila pendente, "2 respostas não chegaram. Chame o professor."; "Enviar" com 503: "Não deu para enviar agora. Suas respostas estão guardadas; tente de novo em instantes. O tempo da queda volta para você."; 429: "Aguarde um instante." Nenhum código aparece na tela |
| Aprovar | coluna "Saiu da aba"; aviso fixo (D88): "Conta as vezes em que a aba da prova perdeu o foco. Leitor de tela, teclado virtual e avisos do sistema também contam. Sozinho, não indica cola." |

- **Acessibilidade da prova:** o relógio não fica em região viva; um anúncio `polite` a 10, 5 e 1 min; "O tempo acabou…"
  anunciado (`assertive`) e com o foco; ao entrar, o foco no título da primeira questão; ao voltar de "Sair", no título
  da prova em Atividades. Teste em `ProvaEmFoco.test.tsx` e axe no e2e.
- **360 px:** Aplicar com a lista de tempo adicional em lista de uma coluna; Acompanhar em cartões por aluno (nome,
  situação, "Estender"); Aprovar com "Saiu da aba" dentro do cartão do aluno. Sem rolagem horizontal; alvos de 24 px, e
  de 44 px em Começar, Sair da prova, Estender e Confirmar. E2E `celular` das três (`professor-prova.spec.ts`).
- Testes de unidade web: o resumo de Aplicar, o efeito antes de confirmar em Estender, os estados do Acompanhar.
- Erro ao carregar a prova, o "Antes de começar" ou ao tocar em Começar (5xx, rede): "Não foi possível abrir a prova.
  Tente de novo." com "Tentar de novo". Em Atividades, depois de "Sair" com fila pendente: "2 respostas ainda não
  chegaram", até a fila esvaziar. Segunda chamada a 360 px: convocados em lista de uma coluna.

## 4b. E2E

| Teste | O que afirma | Mutação |
|---|---|---|
| `aluno-prova.spec.ts` (`chromebook`, `celular`) | antes de começar e a tela de foco; a rede cai no meio ("Sem conexão…"), três respostas, a rede volta: as três gravadas uma vez no banco, e o mesmo relógio; axe | descartar a fila na queda |
| `professor-prova.spec.ts` (`chromebook`, `celular`) | o professor aplica com janela e tempo adicional, acompanha, estende; o aluno faz e sai da aba uma vez; o professor encerra pelo botão; aprova o lote, com "1" na coluna "Saiu da aba" e o aviso; axe | coluna sem o aviso; contagem errada |

## 5. Carga

`infra/k6/prova-online.js`, junto da `FASE=sala`: 10 escolas, 6 turmas cada, 35 alunos × 20 itens, com `tempo` a cada
30 s e a rede de 10% dos alunos caindo 1 min. No meio da prova, todas as instâncias da API fora por 90 s.

Passa quando: p95 do PUT de resposta abaixo de 500 ms; respostas enviadas pelo cliente = linhas gravadas; a queda anda o
limite dos alunos em prova em 90 s e nenhuma prova é encerrada durante ela. Controle negativo: com o PUT atrasado
artificialmente em 600 ms, o cenário reprova.
