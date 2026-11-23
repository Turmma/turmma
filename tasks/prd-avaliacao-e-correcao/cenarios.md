# Cenários — Avaliação e correção (prova online)

> Acompanha `techspec.md`. Cada linha diz o teste, a camada e a mutação que o derruba. Os nomes de arquivo são os
> prováveis; a tarefa fixa o caminho. Precedentes: `apps/api/src/atividade/atividade.int.test.ts` (o aluno responde, a
> sequência, o 404 da outra escola), `apps/api/test/atividade.fixture.ts` (`aplicarAtividade`, `responderProva`,
> `encerrarAtividade`), `e2e/aluno-atividade.spec.ts` e `e2e/support/atividade-db.ts`. O relógio dos testes é o do banco,
> deslocado por `abre_em`/`fecha_em` no passado ou no futuro; nenhum teste dorme.

## 1. Por RF

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF1 | Aluno começa antes de `abre_em` e depois de `fecha_em`: `PROVA_FORA_DA_JANELA`, sem tentativa | integração, `prova-online.int.test.ts` | tirar a conferência da janela no `comecar` |
| RF1 | Duração 40 min, começo a 10 min do `fecha_em`: `limiteEm` = `fecha_em` | unidade, `limite-da-tentativa.test.ts`; integração, idem | `limite_base_em` sem o `min` com `fecha_em` |
| RF1 | Avaliativa nova sem janela: `ENTRADA_INVALIDA`; não avaliativa com janela: `ENTRADA_INVALIDA`; não avaliativa responde sem limite, como hoje | integração | aceitar avaliativa sem janela |
| RF2 | Mudar janela sem tentativa: grava e audita; com uma tentativa iniciada: `PROVA_JA_COMECOU`, nada muda | integração | tirar o `not exists` da tentativa |
| RF3 | Aluno com +50% e duração 40: limite em 60 min; o colega sem tempo adicional, em 40; aluno de outra turma no pedido: `ENTRADA_INVALIDA`, nada gravado | integração | aplicar o percentual a todos; aceitar aluno de fora |
| RF3 | O contrato de aplicar não tem campo de motivo; chave a mais é `ENTRADA_INVALIDA` | unidade, `packages/shared` | schema sem `.strict()` |
| RF4 | Estender 10 min só para A: A grava depois do limite antigo; B recebe `TEMPO_ESGOTADO` | integração | somar a extensão de aluno a todos |
| RF4 | Estender a turma: todos andam, e o fim efetivo da janela também | unidade e integração | extensão de turma só nas tentativas iniciadas |
| RF4 | Mesma `chave` duas vezes, ao mesmo tempo: uma linha, um limite | integração | tirar o `unique (escola, chave)` |
| RF4 | Estender prova encerrada: `ATIVIDADE_ENCERRADA` | integração | aceitar extensão sem olhar o estado |
| RF5 | PUT depois do limite: `TEMPO_ESGOTADO`, sem linha; a leitura do aluno diz `envio = 'limite'` | integração | comparar com o relógio do cliente; gravar antes de conferir |
| RF5 | Tentativa vencida sem envio entra na correção do encerramento com o que foi salvo | integração | corrigir só tentativas com `enviada_em` |
| RF5 | Tela: no fim do tempo, "O tempo acabou. Suas respostas salvas foram enviadas." e a questão sai | unidade web, `ProvaEmFoco.test.tsx` | manter a questão na tela |
| RF6 | Indisponibilidade de 5 min dentro da prova: o limite anda 5 min; fora dela, não anda | unidade, `limite-da-tentativa.test.ts` | somar toda indisponibilidade |
| RF6 | Duas indisponibilidades, a segunda dentro do limite já estendido pela primeira: as duas contam (ponto fixo) | idem | uma passada só |
| RF6 | Pulso com lacuna de 40 s grava uma `indisponibilidade`; de 20 s, nenhuma | integração, `pulso.int.test.ts` | limiar trocado; gravar sem comparar |
| RF6 | Fila do cliente: 3 respostas sem rede, a rede volta, as 3 gravam uma vez | unidade web, `fila-de-respostas` (precedente: `espelho-da-fila.test.ts`) | descartar a fila na queda |
| RF6 | `TEMPO_ESGOTADO` com limite que andou na releitura: a fila reenvia e grava | unidade web | parar a fila no primeiro `TEMPO_ESGOTADO` |
| RF7 | Antes de começar: duração, aviso da saída da aba e "Começar"; nenhuma questão na tela antes do clique | e2e, `aluno-prova.spec.ts` (`chromebook` e `celular`) | mostrar a primeira questão sem "Começar" |
| RF7 | Na prova, sem lateral nem link ao Tutor; "Sair da prova" leva a Atividades, e voltar mostra o mesmo relógio | e2e | renderizar a prova dentro da casca |
| RF7 | GET `/prova` não cria tentativa; só `comecar` cria (U05-15) | integração (troca o caso "abrir a prova cria a tentativa") | GET gravando |
| RF8 | Embaralhar ligado: dois alunos com ordens diferentes; marcar a alternativa certa pelo índice original dá acerto nos dois | integração | correção pela posição na tela |
| RF8 | Retomada: a segunda leitura da prova traz a mesma ordem | integração | sortear a cada leitura |
| RF8 | Começar duas vezes ao mesmo tempo: uma tentativa, uma ordem, um `limite_base_em` | integração (corrida a) | recalcular na leitura |
| RF9 | Saída numa avaliativa em andamento soma 1; a mesma chave de novo não soma; chave nova soma | integração, `saida-da-aba.int.test.ts` | tirar o `is distinct from` |
| RF9 | Saída em atividade não avaliativa, em tentativa enviada ou vencida, ou de aluno de outra turma: `NAO_ENCONTRADO`, nada muda | integração | somar sem olhar `avaliativa` ou o limite |
| RF9 | O lote da avaliativa traz `saidasDaAba` por aluno; o da não avaliativa não traz o campo; o `apresentado` gravado na validação não leva contagem por aluno | integração, `correcao.int.test.ts` | pôr a contagem no `apresentado` |
| RF9 | Nenhuma rota da coordenação nem do aluno devolve `saidas` (contrato) | `apps/api/test/contracts.test.ts` | expor no DTO do aluno |
| RF9 | Tela: o `visibilitychange` para `hidden` e o `blur` seguido somam 1, não 2 | unidade web | contar os dois eventos |
| RF10 | Segunda chamada com a original aberta: `ENTRADA_INVALIDA`; para aluno que enviou: `ENTRADA_INVALIDA` | integração, `segunda-chamada.int.test.ts` | não conferir a original |
| RF10 | Convocado vê e começa; colega não convocado recebe `NAO_ENCONTRADO` e não a vê na lista | integração | lista sem o filtro de convocado |
| RF10 | A segunda chamada encerra e corrige num lote próprio; o lote da original não muda | integração | corrigir no lote da original |

## 2. Encerramento sozinho e Tutor

| Cenário | Camada e arquivo | Mutação |
|---|---|---|
| Rotina com uma avaliativa vencida em A e uma corrente em B: grava o job só de A; o job de A encerra, corrige, e o lote nasce pendente | integração, `apps/worker/test/encerrar-provas.int.test.ts` | encerrar pelo `fecha_em` sem as extensões |
| Prova com aluno estendido além do `fecha_em`: não encerra até o limite dele | idem | ignorar extensão de aluno no fim efetivo |
| Job rodando duas vezes: um lote, uma auditoria `atividade.encerrada_pelo_limite` | idem | tirar a trava do `encerrar` |
| Tutor: prova agendada para amanhã não trava; dentro da janela trava a turma; depois do fim efetivo, não trava | integração, `apps/api/src/tutor/tutor.int.test.ts` | trava pela aplicação aberta, sem janela |
| Segunda chamada aberta: trava o convocado, não o colega | idem | trava a turma inteira |

## 3. Corridas

| Corrida | Ordem forçada | Mutação que deixa vermelho |
|---|---|---|
| (a) começar × começar | primeira insere e segura com `WriteBlockTrigger` na tentativa; segunda chega | recalcular `ordem` ou `limite_base_em` na segunda |
| (b) mudar janela × começar | começar segura `for share`; a janela espera e recebe `PROVA_JA_COMECOU` | trocar `for share` por leitura sem trava |
| (c) resposta × encerrar | como hoje (`atividade.int.test.ts`, encerramento) | — |
| (d) estender × estender | mesma chave, duas transações; a segunda cai no 23505 e devolve o estado gravado | tirar o índice único |
| (e) job × professor encerrando | professor segura a trava da aplicação; o job espera e encontra o lote vigente | `encerrar` sem `lock` |
| (f) pulso × pulso | primeira segura `for update`; a segunda lê o `ultimo_em` já novo e não grava lacuna | ler `ultimo_em` sem trava (grava duas) |
| (g) segunda chamada dupla | duas ao mesmo tempo; a segunda cai no índice parcial: `CONFLITO` | tirar o índice |

## 4. Textos e estados de tela

| Tela | Estados e textos |
|---|---|
| Aplicar (prova) | "Abre em", "Fecha em", "Duração (minutos)", "Embaralhar questões", "Embaralhar alternativas", "Tempo adicional" (+25%, +50%, +100%); resumo: "7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo adicional". Sem campo de motivo |
| Acompanhar | quatro estados; "Não começou", "Fazendo · termina às 10:42", "Enviou", "Tempo esgotado"; "Estender", "Mudar janela" (só antes do primeiro início), "Segunda chamada" (só encerrada) |
| Estender | "Mais quantos minutos?" (1 a 120); para um aluno ou "a turma toda"; o efeito antes de confirmar |
| Antes de começar | "Esta prova tem 40 minutos, contados a partir de Começar." "Se você sair desta aba, isso aparece para o professor. Nada acontece com a sua prova." "Para sair, use Sair da prova. O tempo continua." |
| Prova | relógio "Faltam 12 min"; "Salvo" / "Salvando…"; "Sair da prova"; fim: "O tempo acabou. Suas respostas salvas foram enviadas." |
| Aprovar | coluna "Saiu da aba"; aviso fixo (D88): "Conta as vezes em que a aba da prova perdeu o foco. Leitor de tela, teclado virtual e avisos do sistema também contam. Não é prova de nada." |
