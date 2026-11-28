# Tarefa 12.0 — Tela do aluno: "Antes de começar" e a prova em foco

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 3.0, 4.0, 8.0
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`, `tenancy-guardian`
**Porte:** grande

## Objetivo

O aluno lê o aviso, faz a prova em tela de foco com o relógio do servidor, sem perder resposta na queda, e sai com um clique.

## Contexto necessário

- `techspec.md` §4 (`prova`, `tempo`), §5.8, §9 (com o reenvio espalhado), §7c (carga)
- `prd.md` RF5, RF6, RF7; §7
- `cenarios.md` §1 (as linhas da tela de RF5, RF6, RF7 e RF9), §4 (aluno), §4b
- `.claude/rules/50`, `70` item 4b; `docs/interface.md` §2
- `apps/web/src/areas/aluno/fila-de-respostas.ts` e `routes.tsx`; `apps/web/src/paths.ts` (`ALUNO_ROUTES`)

## Subtarefas

- [x] 12.1 — Atividades: "Abre em…", "Fechou"; "Antes de começar" lendo `prova` sem tentativa (duração sem "adicional")
  e "Começar"
- [x] 12.2 — `/aluno/prova/:id` fora da casca: relógio com o desvio, "Salvando…", "Sair da prova" de um clique; o fim
- [x] 12.3 — A fila de respostas no app (§9), com o reenvio espalhado: o `online` deixa de mandar na hora e cada fila sorteia
  de 0 a `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` (5 s, em `respostas.ts`) antes de tentar; "Tentar de novo", o item marcado e
  a sessão que volta continuam na hora; o recuo de `esperaAntesDeTentar` não muda (decisão do Joaquim, 27/11, na 6.0)
- [x] 12.4 — A fila de saídas (§5.8)
- [x] 12.5 — Acessibilidade da §4; os textos de erro e o do "Enviar" com 503
- [x] 12.6 — Roteiro da demonstração e o spec dele; `docs/interface.md` §2
- [x] 12.7 — A prova embaralhada (aviso da 4.0, RF8): com "embaralhar" ligado a prova chega fora da ordem original, e a tela
  - acha a questão por `numero`, não pela posição em `prova.questoes`;
  - manda como `alternativa` do `PUT` o `questao.ordemDasAlternativas[posicao]` (o índice original), nunca a posição da tela;
  - lê pelo índice original o mapa das questões e o diagnóstico depois do envio (`Atividade.tsx`: `prova.questoes.find(item => item.numero === …)?.alternativas`, hoje indexado
    pela posição): o texto de "sua resposta" e o de "a certa" são os do índice original, e o diagnóstico confere com a prova embaralhada;
  - troca o comentário de `Atividade.tsx` ("O índice é a identidade da alternativa no contrato: a ordem delas não muda"), que a 4.0 tornou falso;
  - só usa `ordemDasAlternativas` para mandar o índice original: a ordem de um aluno não aparece a outro
- [x] 12.8 — Testes e `e2e/aluno-prova.spec.ts`

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/areas/aluno/routes.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividades.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividade.tsx` | alterado (a questão por `numero`, o `ordemDasAlternativas[posicao]` no `PUT`, o mapa e o diagnóstico pelo índice original; o comentário do `label`) |
| `apps/web/src/areas/aluno/Atividade.test.tsx` | alterado (a prova embaralhada) |
| `apps/web/src/api/atividades-do-aluno.ts` | alterado (a web tolera o campo a mais da `prova`; ver a 4.0, recomendação do `infra-guardian`) |
| `apps/web/src/api/atividades-do-aluno.test.ts` | novo (o que o contrato conhece continua conferido por inteiro; a prova que ainda não começou) |
| `apps/web/src/areas/aluno/AntesDeComecar.tsx` | novo |
| `apps/web/src/areas/aluno/use-agora.ts` | novo (o relógio do computador, relido a cada 30 s, lido uma vez pela lista de Tarefas) |
| `apps/web/src/areas/aluno/ProvaEmFoco.tsx` | novo |
| `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx` | novo |
| `apps/web/src/areas/aluno/fila-de-respostas.ts` | alterado (o `online` com o sorteio) |
| `apps/web/src/areas/aluno/respostas.ts`, `respostas.test.ts` | alterado (`ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS`; o caso "tentar agora (a rede voltou…)" separa o `online` do botão) |
| `infra/test/carga-prova.test.ts` | alterado (o k6 repete `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` do app) |
| `apps/web/src/areas/aluno/fila-de-saidas.ts` | novo |
| `apps/web/src/areas/aluno/fila-de-saidas.test.ts` | novo |
| `e2e/aluno-prova.spec.ts` | novo |
| `e2e/roteiro-da-demonstracao.spec.ts` | alterado |
| `docs/roteiro-da-demonstracao.md` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Relógio do cliente 10 min adiantado | unidade web | o tempo do servidor | `Date.now()` sem desvio fica vermelho | `apps/web/src/areas/aluno/atividade.test.ts › o tempo que falta sai do limite menos o relógio do servidor`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o computador 10 min adiantado não tira 10 min do aluno` |
| Sem rede; 503 e depois 200 | unidade web | gravam uma vez; a saída volta com a mesma chave; `tempo` mantém o último limite | descartar na queda ou no 5xx | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o 503 do servidor não perde a escolha`; `apps/web/src/areas/aluno/fila-de-saidas.test.ts › A, a queda, B, A de novo`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o relógio chega ao limite e a releitura do tempo falha` |
| A rede volta (`online`) com 3 pendentes, sorteio fixado em 4 s pelo `agendar` e pelo sorteio injetados | unidade web | nada sai antes dos 4 s; aos 4 s, as 3 saem uma por vez; o sorteio fica entre 0 e 5 s; "Tentar de novo" e a escolha nova saem na hora | o `online` chamando o `tryAgora` direto (sai no instante 0) | `apps/web/src/areas/aluno/respostas.test.ts › a rede que volta (`; `apps/web/src/areas/aluno/respostas.test.ts › o sorteio da volta da rede fica entre 0 e 5 s`; `apps/web/src/areas/aluno/respostas.test.ts › o "Tentar de novo", a escolha que o aluno acabou de marcar`; `apps/web/src/areas/aluno/fila-de-saidas.test.ts › a rede que volta espera o sorteio`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a saída que o servidor não recebeu sai na volta da rede` |
| O k6 imita a fila do app | unidade (infra) | `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS`, `PRIMEIRA_ESPERA_DA_FILA_MS`, `MAIOR_ESPERA_DA_FILA_MS`, o jitter e o prazo do PUT iguais em `respostas.ts`/`client.ts` e em `infra/k6/prova-online.js` | trocar um dos lados | `infra/test/carga-prova.test.ts` |
| "Enviar" com 503 | unidade web | o item fica; o texto da §4 | | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova" com 503`; `apps/web/src/areas/aluno/atividade.test.ts › "Enviar" que não saiu diz que as respostas estão guardadas` |
| `TEMPO_ESGOTADO`, extensão, `tempo` com o limite novo | unidade web | a fila reenvia e grava | parar no primeiro | `apps/web/src/areas/aluno/respostas.test.ts › o TEMPO_ESGOTADO que a API devolve`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a extensão chega depois de o servidor recusar por tempo` |
| "Sair" com 2 pendentes | unidade web | a fila segue; o fim mostra "2 respostas não chegaram"; Atividades, "2 respostas ainda não chegaram" até esvaziar | fila presa à rota | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › um clique leva às tarefas, sem confirmação`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › acabou o tempo com 2 respostas que não chegaram`; `apps/web/src/areas/aluno/Atividades.test.tsx › as respostas que o servidor ainda não confirmou` |
| Fila de saídas | unidade web | `visibilitychange`+`blur`: 1; separadas pela volta do foco: 2; A, queda, B, A em série; o 429 não para a de respostas | contar os dois; em paralelo; fila única | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › sair da aba vai ao servidor com uma chave nova`; `apps/web/src/areas/aluno/fila-de-saidas.test.ts › A, a queda, B, A de novo`; `apps/web/src/areas/aluno/fila-de-saidas.test.ts › cada saída leva a chave dela`; `apps/web/src/areas/aluno/fila-de-saidas.test.ts › o 429 espera o recuo` |
| Antes de começar | unidade web | os textos da §4; "60" sem "adicional"; "Abre em…", "Fechou" | o colega lê 40 | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › antes de abrir, diz quando abre`; `apps/web/src/areas/aluno/Atividades.test.tsx › a prova que ainda não abriu diz` |
| Acessibilidade | unidade web | relógio fora de região viva; anúncios a 10, 5 e 1 min; o fim ("O tempo acabou…") `assertive` com o foco e a questão sai; "Salvando…" `polite`; o foco ao entrar e ao voltar | a 11 min, nenhum anúncio | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o leitor de tela só é avisado a 10, 5 e 1 min`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o tempo acabou: a questão sai, o aviso é`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › ao entrar, o foco vai ao enunciado da primeira questão`; `apps/web/src/areas/aluno/Atividades.test.tsx › voltando do "Sair da prova", o foco vai ao link` |
| Estados e erros | unidade web | "Não foi possível abrir a prova. Tente de novo.", "Aguarde um instante." e os outros da §4; nenhum código | | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que não abre diz o que fazer`; `apps/web/src/areas/aluno/atividade.test.ts › abrir a prova que falha diz para tentar de novo`; `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" que falha diz para tentar de novo` |
| `aluno-prova.spec.ts` | e2e `chromebook` e `celular` | antes de começar; sem lateral nem Tutor; rede cai ("Sem conexão…"), três respostas, volta: gravadas uma vez, o mesmo relógio; "Sair" e voltar; axe | descartar a fila na queda | `e2e/aluno-prova.spec.ts › antes de começar diz a duração e o aviso da aba`; `e2e/aluno-prova.spec.ts › "Começar" abre a prova sem lateral nem Tutor`; `e2e/aluno-prova.spec.ts › a rede cai: "Sem conexão"`; `e2e/aluno-prova.spec.ts › "Sair da prova" é um clique`; `e2e/aluno-prova.spec.ts › voltar pela lista abre a mesma prova que já começou` |
| Recomeço | unidade web (tela) | a resposta atrasada da prova anterior não aparece; a fila da primeira pessoa não sai com a sessão da segunda (a divergência abaixo diz por que não é e2e) | a fila que sobrevive à troca da sessão | `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a resposta que não chegou da primeira pessoa não sai com a sessão da segunda`; `e2e/aluno-atividade.spec.ts › o aluno seguinte vê as tarefas dele, e a resposta atrasada do anterior não aparece` |
| 360 px e 1366 × 768 | e2e | faixa de uma linha; `paginaNaoRola`; Começar e Sair da prova com 44 px | | `e2e/aluno-prova.spec.ts › a faixa é de uma linha, "Sair da prova" tem 44 px e a página não rola de lado`; `e2e/aluno-prova.spec.ts › antes de começar diz a duração e o aviso da aba` |
| Roteiro | e2e | o passo do aluno na prova | | `e2e/roteiro-da-demonstracao.spec.ts › do painel da operação à governança, na ordem da reunião` |
| A prova embaralhada: o `PUT` leva o índice original | unidade web | prova com sorteio conhecido, a alternativa certa marcada numa posição de tela diferente da original: o `PUT` leva `ordemDasAlternativas[posicao]`; a questão é achada por `numero`; o mapa e o diagnóstico mostram o texto do índice original em "sua resposta" e "a certa" | mandar a posição da tela (fica vermelho) | `apps/web/src/areas/aluno/Atividade.test.tsx › o aluno que marca pelo texto a alternativa certa manda o índice original`; `apps/web/src/areas/aluno/atividade.test.ts › a alternativa da posição vira o índice original`; `apps/web/src/areas/aluno/atividade.test.ts › acha a questão pelo número original`; `apps/web/src/areas/aluno/atividade.test.ts › o diagnóstico lê o texto e a letra pela posição` |
| Prova embaralhada, de ponta a ponta | e2e `aluno-prova.spec.ts` | uma aplicação com "embaralhar" ligado: o aluno marca pelo texto a alternativa certa, e a resposta gravada é o índice original (o gabarito); o diagnóstico depois do lote aprovado acerta | a tela mandar a posição, e o aluno "errar" a que acertou | `e2e/aluno-prova.spec.ts › a prova embaralhada: o aluno marca pelo texto a alternativa certa`; `e2e/aluno-prova.spec.ts › o diagnóstico da prova embaralhada diz a resposta certa na letra em que o aluno a viu` |

## Como testar

- Fila: `apps/web/src/areas/aluno/espelho-da-fila.test.ts › cada mudança das pendentes vai para o espelho…`
- Tela: `e2e/aluno-atividade.spec.ts › a resposta que falha ao salvar continua marcada…`; relógio com `page.clock`
- `node tools/ci/e2e.ts --manter-ambiente e2e/aluno-prova.spec.ts`
- **Telas:** aluno · `/aluno/atividades` → a prova → "Antes de começar" → "Começar" → `/aluno/prova/:id`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas no fim.

1. **Mutação de cada cláusula:** cada cláusula e cada termo do diff tem bloco em "Mutações" (191) ou o motivo escrito nela; o `node tools/processo/mutacoes.ts --faltando` dá vazio. Os efeitos da tela (o foco ao entrar e ao voltar, o relógio parado, o reenvio quando o limite anda, a releitura do tempo a cada 30 s) e a chave do `online` têm bloco. O que a ferramenta não vê (o `&&` de JSX com operando em linha de baixo, o ternário) foi conferido à mão, bloco a bloco.
2. **O texto novo já está nos e2e?** Procurado em `e2e/` com `grep`: "Antes de começar", "Sair da prova", "Enviar a prova", "Começar" e o texto da porta mudaram o fluxo de `aluno-atividade.spec.ts` e do roteiro; os dois rodaram isolados e passaram (o roteiro, nos dois projetos).
3. **"O que distingue" está no teste:** o relógio 10 min adiantado (dá 20 min no computador e 30 no servidor), a rede que volta com o sorteio em 4 s (e o `tryAgora` direto, que sairia no instante 0), a fila de saídas com A, queda, B, A, e a prova embaralhada com uma ordem em que a posição da tela e o índice original diferem. Cada linha da tabela de testes tem o caso na coluna "Caso".
4. **Checagem anterior que responde antes da regra:** a rota `/aluno/prova/:id` cai em `UUID.test` antes da tela (o caso de rota usa um UUID e um texto); o "Antes de começar" lê `GET …/prova` sem tentativa, e o teste cria a prova que ainda não começou, a em andamento, a enviada e a encerrada, em vez de herdar fixture. O dublê da API devolve o erro tipado (`ApiError` com o `ErrorCode`), não `new Error`.
5. **A asserção olha o resultado:** a gravação e o que o servidor guardou (os `PUT` contados na rede falsa e `respostasNoBanco` no e2e), e o texto que o aluno lê. A ausência (nenhuma questão antes do "Começar", nenhum alerta, nenhum código) vem depois da resposta que poderia trazê-la: `findBy…` do positivo antes do `queryBy…` do negativo; o tempo e os 30 s com relógio falso e `advanceTimersByTimeAsync`.
6. **Guarda nova:** nenhuma. O arquivo novo de fila (`fila-de-saidas.ts`) e a rota entram nas guardas que já existem (`camadas`, a de log sem dado pessoal e a de `verbo-de-mercado`), e o `tsc` e o ESLint passam.
7. **Comentário que afirma o que o código não faz:** relidos os docblocks de `ProvaEmFoco.tsx`, `AntesDeComecar.tsx`, `fila-de-saidas.ts` e `Atividade.tsx` (o comentário da 4.0 sobre o índice, trocado na 12.7); `docs/interface.md` §2 e `docs/roteiro-da-demonstracao.md` dizem só o que os casos acima provam.
8. **Divergência que cria ou muda regra:** três linhas na tabela; nenhuma muda regra de domínio, e as três já estão em `cenarios.md` §4 e `techspec.md` §9 (a palavra do código, `PROVA_FORA_DA_JANELA` e `aoTrocarDeSessao`, procurada nos dois). O `prd.md` não diz o contrário (RF5, RF6, RF7 falam do que a tela mostra, não do texto do erro da porta).
9. **Peça que já existe:** `esperaAntesDeTentar` e `esperaNaVoltaDaRede` (em `respostas.ts`), `codigoDoErro` (`ciclo-de-execucao.ts`), `aoTrocarDeSessao`/`aoAbrirSessao` (`sessao.ts`), `errorMessage`, `ConfirmDialog`, `Page`, `StickyFooter`; a prova em foco reaproveita `Respondendo` de `Atividade.tsx` (com `emProva`), e a fila de saídas segue o desenho da de respostas sem copiar o código dela.
10. **Concorrência e corrida:** a fila de saídas é em série (A, queda, B, A) com a ordem forçada pelo `agendar` injetado e o `send` que falha; a resposta que chega depois do `stop()` tem caso; o `online` com sorteio e o "Tentar de novo" ao mesmo tempo não mandam duas vezes (`cancelarEspera`). Os casos esperam o sinal (a chamada na rede falsa), e os de tempo usam o relógio falso, inclusive a extensão que chega antes do recuo, a saída que sai na volta da rede e os negativos da saída da aba (avançam 5 s falsos, e não esperam 50 ms de verdade).
11. **Isolamento:** a tarefa não cria tabela, repository nem rota, e a tela só lê o que o aluno da sessão já alcança (`GET …/prova` e `…/tempo`, com o escopo do token); o isolamento entre escolas é dos testes da 3.0 e da 4.0. O que a tela faz de seu é não mandar o `alunoId` (a rota o tira do token) e a fila presa à sessão (caso do recomeço). Cada linha da tabela tem o caso, um por coisa que ela diz.
12. **Guardiões:** `privacy-guardian` (nada de dado pessoal no log; a fila de saídas leva só `chave` e o id da prova; o espelho da fila some com a sessão; o texto não conta saída por aluno), `conformidade-reviewer` (D70: o aviso antes do "Começar", a saída só mostrada ao professor, nenhuma consequência automática, nada somado na tela do aluno; D59: "Sair da prova" de um clique, sem sequência nem recompensa), `infra-guardian` (regra 80, item 6: resposta salva a cada escolha, reenvio espalhado em 0–5 s, relógio do servidor, queda não é tempo do aluno) e `frontend-reviewer` (os quatro estados, 360 px e 1366 × 768, alvos de 44 px, foco e região viva). O `achados/indice.md` foi lido nas linhas da 3.0, da 4.0 e da 8.0, que tocam a prova que esta tela lê.

## Fora do escopo desta tarefa

As telas do professor (10.0, 11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| O erro ao carregar o "Antes de começar" (a porta `AbrirAtividade`) diz o texto de erro de sempre da atividade (`errorMessage`), e não "Não foi possível abrir a prova. Tente de novo." Este segue na tela de foco e no "Começar" que falha | A leitura `GET …/prova` é a porta de toda atividade, a com prova online e a comum; dizer "prova" a quem abre uma tarefa que não é prova seria errado, e o `aluno-atividade.spec.ts` (503 na abertura da tarefa) já espera o texto de sempre | `cenarios.md` §4 (último item: "Erro ao carregar a prova…"), e `techspec.md` §9 (item do aluno) |
| O "Abre em…", o "Fechou" e o "Esta prova abre em…" saem da janela lida e do **relógio do computador**; a palavra final é do servidor (`PROVA_FORA_DA_JANELA` no "Começar"), e a tela troca o texto pelo dele e esconde o botão | O aluno não tem o `agora` do servidor antes de a prova começar (o `tempo` só existe com tentativa), e esperar um segundo pedido para escrever uma data não compensa; o desvio do computador, em hora de escola, é de segundos, e o servidor recusa o que a tela deixou passar | `cenarios.md` §4 (linhas "Lista do aluno" e "Antes de começar") e `techspec.md` §9 (item do aluno) |
| "Recomeço" (a resposta atrasada da prova anterior não aparece; a fila da primeira pessoa não sai com a sessão da segunda) fica em teste de tela, e não em e2e novo | A regra mora em `aoTrocarDeSessao`, na fila de respostas que a prova e a atividade compartilham: o teste de tela troca a sessão de verdade e confere que nada da primeira pessoa sai nem aparece, e o e2e `aluno-atividade.spec.ts` ("o aluno seguinte vê as tarefas dele…") já prova no navegador a mesma troca; um e2e novo de dois logins seguidos repetiria isso e pesaria o portão (o caso novo vale 15 s) | `cenarios.md` §4 (item "Testes de unidade web") e §4b (linha de `aluno-prova.spec.ts`) |

## Mutações

--faltando: nenhuma linha nova de produção com condição fica sem bloco ou motivo (`node tools/processo/mutacoes.ts --faltando` confere): 191 blocos e os motivos abaixo.

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os blocos de JSX com operando (`&& (`) removem o elemento inteiro (o corpo todo, com o operando de antes mantido) ou trocam a condição por `{(`; os que o conferidor lista sem casar o termo `(` têm o bloco que tira o elemento e deixa a condição. A linha simples que só tem equivalente no termo (`if (parado) return`, `if (limiteVencido === null) return`, `if (vivo) definirConferido(limiteVencido)`) leva o bloco que a inverte ou a esvazia, e o termo equivalente, o motivo.

**Sem bloco, com o motivo (termo equivalente ou só de tipo):**

- `typeof valor !== 'object'`, `Array.isArray(valor)` (em `soOsCamposDe`) e `typeof raiz !== 'object'` (em `aMesmaProvaSemOCampoAMais`): o que não é objeto (texto, número, lista) sai intacto ou como `{}`, e nos dois casos o contrato o recusa (`RespostaForaDoContrato`): a leitura responde o mesmo com e sem o termo. O termo `valor === null` e o `raiz === null` têm bloco.
- `antes.janela !== null` (em "Antes de começar"): só o tipo. A porta só entrega esta tela com janela (a prova sem janela é a atividade de hoje, e tem caso); o `aberta` e o `<p>` do mesmo operando têm bloco.
- `lida.error instanceof ApiError`, `prova.error instanceof ApiError` e `erro instanceof ApiError`: estreitamento de tipo. O erro que não é da API (a rede) não tem `codigo`, e `undefined === ErrorCode.NAO_ENCONTRADO` (ou `LIMITE_EXCEDIDO`) dá o mesmo falso; o `codigo === …` de cada um tem bloco.
- `typeof estado === 'object'` (em `Atividades`, sobre `history.state`): só estreita o tipo para o `in`; o histórico desta área guarda `null` ou objeto, nunca texto. O `estado !== null` tem bloco (o `in` lança em `null`, a primeira entrada da aba).
- `falta !== undefined` e `limiteLido !== undefined` (em `RelogioDaProva`): `undefined <= 0` é falso, e `venceu` só é verdadeiro com limite lido; só estreitam o tipo.
- `falta === undefined` e `falta <= 0` (em `minutos` e no efeito do aviso): `minutos` só é a chave de dependência do efeito, e sem o termo vira `NaN` ou um número menor que 1; `anuncioDoRelogio` devolve `undefined` nos dois casos, e o efeito sai igual.
- `typeof antes === 'string'` e `typeof limiteEm === 'string'` (em `useReenvioQuandoOLimiteAnda`): `Date.parse(undefined)` e `Date.parse(null)` dão `NaN`, que não é maior que nada; só estreitam o tipo. O `Date.parse(limiteEm) > Date.parse(antes)` tem bloco.
- `enviadaAgora` (em `textoDoFimDaProva`): o envio grava `enviadaEm` no cache na mesma chamada que acende `enviadaAgora` (`onSuccess` de `Respondendo`), e `dados.enviadaEm !== null` já diz o mesmo; o fim "Prova enviada…" sai igual sem o termo (o caso do envio confirma). O `envio === 'aluno'` tem bloco.
- `(envio === null && dados.estado === 'encerrada')` (em `textoDoFimDaProva`): o relógio para quando a prova já tem fim, então `venceuNoRelogio` não fica verdadeiro com a prova lida encerrada; a última linha devolve o mesmo texto. Só difere no instante em que o limite vence na mesma leitura em que a professora encerra, e os dois textos dizem que a prova acabou. O `envio === 'encerramento'` e o `dados.estado === 'aberta'` têm bloco.
- `alcancados.length === 0` (em `anuncioDoRelogio`): `[].every(...)` é verdadeiro, então o termo seguinte já devolve `undefined` com a lista vazia.
- `atividade.janela === null` (em `textoDaJanelaDaLista`): `situacaoDaJanela(null, …)` devolve `'aberta'`, e a função acaba em `undefined`; o termo só estreita o tipo para `janela.abreEm`. O `atividade.situacao !== 'para_fazer'` tem bloco.
- `parada` (em `redeVoltou` da fila de respostas, e em `bombear` e `redeVoltou` da fila de saídas): `stop()` esvazia a fila, e `proximoEnvio(estado) === undefined`, `proxima === undefined` e `fila.length === 0` já fazem a função sair; `registrar`, o `adotar` e a resposta que chega depois do `stop` têm bloco.

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › a alternativa da posição vira o índice original
-  return questao?.ordemDasAlternativas[posicao] ?? posicao
+  return questao?.ordemDasAlternativas[posicao] ?? 0
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › a alternativa da posição vira o índice original
-  const posicao = questao?.ordemDasAlternativas.indexOf(original) ?? -1
+  const posicao = questao?.ordemDasAlternativas.indexOf(original) ?? 0
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › a alternativa da posição vira o índice original
-  return posicao === -1 ? original : posicao
+  return posicao === -1 ? 0 : posicao
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › acha a questão pelo número original
-  return indice === -1 ? numero : indice + 1
+  return indice === -1 ? 0 : indice + 1
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › o diagnóstico lê o texto e a letra pela posição
-  return texto === undefined ? letraDaAlternativa(posicao) : `${letraDaAlternativa(posicao)}. ${texto}`
+  return texto !== undefined ? letraDaAlternativa(posicao) : `${letraDaAlternativa(posicao)}. ${texto}`
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › sem tempo lido ou sem limite
-  if (tempo?.limiteEm === null || tempo === undefined) return undefined
+  if (tempo === undefined) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › sem tempo lido ou sem limite
-  if (tempo?.limiteEm === null || tempo === undefined) return undefined
+  if (tempo?.limiteEm === null) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › o texto é de minutos inteiros
-  if (faltaMs <= 0) return 'O tempo acabou'
+  if (faltaMs < 0) return 'O tempo acabou'
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › o texto é de minutos inteiros
-  if (faltaMs <= 60_000) return 'Falta menos de 1 min'
+  if (faltaMs < 60_000) return 'Falta menos de 1 min'
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › o leitor de tela é avisado a 10, 5 e 1 min
-  if (faltaMs <= 0) return undefined
+  if (faltaMs < 0) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › o leitor de tela é avisado a 10, 5 e 1 min
-  if (alcancados.length === 0 || alcancados.every((limiar) => jaAnunciados.has(limiar))) return undefined
+  if (alcancados.length === 0) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › o leitor de tela é avisado a 10, 5 e 1 min
-  return { limiares: alcancados, texto: minutos === 1 ? 'Falta 1 minuto.' : `Faltam ${String(minutos)} minutos.` }
+  return { limiares: alcancados, texto: minutos === 2 ? 'Falta 1 minuto.' : `Faltam ${String(minutos)} minutos.` }
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › diz quantas respostas não chegaram
-  return quantas === 1 ? '1 resposta não chegou. Chame o professor.' : `${String(quantas)} respostas não chegaram. Chame o professor.`
+  return quantas === 2 ? '1 resposta não chegou. Chame o professor.' : `${String(quantas)} respostas não chegaram. Chame o professor.`
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › diz quantas respostas não chegaram
-  return quantas === 1 ? '1 resposta ainda não chegou' : `${String(quantas)} respostas ainda não chegaram`
+  return quantas === 2 ? '1 resposta ainda não chegou' : `${String(quantas)} respostas ainda não chegaram`
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › abrir a prova que falha diz para tentar de novo
-  return erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDO ? TEXTO_DE_AGUARDE : TEXTO_DE_ERRO_AO_ABRIR_A_PROVA
+  return erro instanceof ApiError ? TEXTO_DE_AGUARDE : TEXTO_DE_ERRO_AO_ABRIR_A_PROVA
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividade.ts
teste: apps/web/src/areas/aluno/atividade.test.ts › "Enviar" que não saiu diz que as respostas estão guardadas
-  return erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDO ? TEXTO_DE_AGUARDE : TEXTO_DO_ENVIO_QUE_NAO_SAIU
+  return erro instanceof ApiError ? TEXTO_DE_AGUARDE : TEXTO_DO_ENVIO_QUE_NAO_SAIU
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › a situação da janela
-  if (janela === null) return 'aberta'
+  if (janela === undefined) return 'aberta'
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › a situação da janela
-  if (agora < Date.parse(janela.abreEm)) return 'antes'
+  if (agora <= Date.parse(janela.abreEm)) return 'antes'
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › a situação da janela
-  return agora >= Date.parse(janela.fechaEm) ? 'depois' : 'aberta'
+  return agora > Date.parse(janela.fechaEm) ? 'depois' : 'aberta'
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › a atividade sem janela não diz nada
-  if (atividade.janela === null || atividade.situacao !== 'para_fazer') return undefined
+  if (atividade.janela === null) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › "Abre em 24/11 às 10:00" antes de abrir
-  if (situacao === 'antes') return `Abre em ${diaEHoraNaEscola(atividade.janela.abreEm)}`
+  if (situacao === 'aberta') return `Abre em ${diaEHoraNaEscola(atividade.janela.abreEm)}`
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › "Abre em 24/11 às 10:00" antes de abrir
-  return situacao === 'depois' ? 'Fechou' : undefined
+  return situacao === 'depois' ? 'Fechou' : 'Fechou'
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › o que o contrato conhece continua conferido por inteiro
-  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return valor
+  if (typeof valor !== 'object' || Array.isArray(valor)) return valor
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › o que o contrato conhece continua conferido por inteiro
-  if (typeof raiz !== 'object' || raiz === null) return raiz
+  if (typeof raiz !== 'object') return raiz
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › o que o contrato conhece continua conferido por inteiro
-...(questoes === undefined ? {} : { questoes: Array.isArray(questoes) ? questoes.map((questao) => soOsCamposDe(questaoDaProvaSchema.shape, questao)) : questoes }),
+...(questoes === undefined ? {} : { questoes: questoes.map((questao) => soOsCamposDe(questaoDaProvaSchema.shape, questao)) }),
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › o que o contrato conhece continua conferido por inteiro
-...(respostas === undefined ? {} : { respostas: Array.isArray(respostas) ? respostas.map((resposta) => soOsCamposDe(respostaSalvaSchema.shape, resposta)) : respostas }),
+...(respostas === undefined ? {} : { respostas: respostas.map((resposta) => soOsCamposDe(respostaSalvaSchema.shape, resposta)) }),
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › a prova que ainda não começou é ProvaNaoComecou
-      if (!lida.comecou) throw new ProvaNaoComecou()
+      if (lida.comecou === undefined) throw new ProvaNaoComecou()
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › a prova que ainda não começou é ProvaNaoComecou
-  return !(erro instanceof ProvaNaoComecou) && shouldRetry(falhas, erro)
+  return shouldRetry(falhas, erro)
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › a prova que ainda não começou é ProvaNaoComecou
-  return !(erro instanceof ProvaNaoComecou) && shouldRetry(falhas, erro)
+  return !(erro instanceof ProvaNaoComecou)
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a prova que ainda não abriu diz
-{janela !== undefined && <span className="block font-medium text-tinta">{janela}</span>}
+{null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a linha de quem não tem resposta na fila
-{naoChegaram > 0 && (
+{true && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › as respostas que o servidor ainda não confirmou
-{naoChegaram > 0 && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › o foco volta ao link uma vez só
-if (volteiDaProva.current || itens.length === 0) return
+if (itens.length === 0) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › voltando do "Sair da prova", o foco vai ao link
-if (volteiDaProva.current || itens.length === 0) return
+if (volteiDaProva.current) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › sem o "voltouDaProva" no histórico
-const id = typeof estado === 'object' && estado !== null && 'voltouDaProva' in estado ? estado.voltouDaProva : undefined
+const id = typeof estado === 'object' && estado !== null ? Object.values(estado)[0] : undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › voltando do "Sair da prova", o foco vai ao link
-for (const linha of document.querySelectorAll<HTMLElement>('[data-atividade-id]')) if (linha.dataset['atividadeId'] === id) linha.querySelector<HTMLElement>('a')?.focus()
+for (const linha of document.querySelectorAll<HTMLElement>('[data-atividade-id]')) if (linha.dataset['atividadeId'] !== id) linha.querySelector<HTMLElement>('a')?.focus()
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › a prova que o servidor diz não estar em andamento
-return codigo === ErrorCode.NAO_ENCONTRADO || codigo === ErrorCode.ENTRADA_INVALIDA
+return codigo === ErrorCode.ENTRADA_INVALIDA
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › a prova que o servidor diz não estar em andamento
-return codigo === ErrorCode.NAO_ENCONTRADO || codigo === ErrorCode.ENTRADA_INVALIDA
+return codigo === ErrorCode.NAO_ENCONTRADO
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › cada saída leva a chave dela
-if (parada || noAr || proxima === undefined) return
+if (parada || proxima === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › com uma saída no ar, nada sai em paralelo
-if (parada || noAr || proxima === undefined) return
+if (parada || noAr) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › a prova que o servidor diz não estar em andamento
-if (recusadaDeVez(codigoDoErro(erro))) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › A, a queda, B, A de novo
-if (cancelarEspera === undefined) bombear()
+bombear()
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › parada, a fila não manda mais nada
-if (parada) return
      fila = [...fila, { chave: novaChave() }]
+fila = [...fila, { chave: novaChave() }]
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › com uma saída no ar, nada sai em paralelo
-if (parada || noAr || fila.length === 0) return
+if (parada || fila.length === 0) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › com uma saída no ar, nada sai em paralelo
-if (parada || noAr || fila.length === 0) return
+if (parada || noAr) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › `visibilitychange` e `blur` seguidos somam 1
-if (fora) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › `visibilitychange` e `blur` seguidos somam 1
-const aoMudarAVisibilidade = (): void => (alvo.documento.visibilityState === 'hidden' ? sair() : voltar())
+const aoMudarAVisibilidade = (): void => (alvo.documento.visibilityState === 'hidden' ? voltar() : sair())
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › a fila das saídas é uma por prova
-if (existente !== undefined) return existente
+if (existente === undefined) return existente
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/respostas.test.ts › o sorteio da volta da rede fica entre 0 e 5 s
-if (parada || proximoEnvio(estado) === undefined) return
+if (parada) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a linha de quem não tem resposta na fila
-return filas.get(atividadeAplicadaId)?.read().pendentes.length ?? 0
+return filas.get(atividadeAplicadaId)?.read().pendentes.length ?? 3
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › parada com uma saída no ar, a falha que chega depois
  (erro: unknown) => {
-if (parada) return
 noAr = false
 if (recusadaDeVez(codigoDoErro(erro))) {
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a rede cai: "Sem conexão", três respostas guardadas
-if (typeof window !== 'undefined') window.addEventListener('online', redeVoltouEmTodas)
+if (typeof window !== 'undefined') window.addEventListener('onlineX', redeVoltouEmTodas)
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a extensão chega depois de o servidor recusar por tempo
-const venceu = falta !== undefined && falta <= 0
+const venceu = falta !== undefined && falta <= 3_600_000
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o computador 10 min adiantado não tira 10 min do aluno
-if (venceu && limiteLido !== undefined) aoVencer(limiteLido)
+if (limiteLido !== undefined) aoVencer(limiteLido)
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o leitor de tela só é avisado a 10, 5 e 1 min
-if (aviso === undefined) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova sem limite
-{falta === undefined ? (tempo === undefined ? 'Lendo o tempo…' : '') : textoDoRelogio(falta)}
+{falta === undefined ? 'Lendo o tempo…' : textoDoRelogio(falta)}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova sem limite
-{falta === undefined ? (tempo === undefined ? 'Lendo o tempo…' : '') : textoDoRelogio(falta)}
+{falta === undefined ? (tempo !== undefined ? 'Lendo o tempo…' : '') : textoDoRelogio(falta)}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a professora encerra com uma resposta na fila
-{naoChegaram > 0 && <p className="break-words text-erro">{textoDasQueNaoChegaram(naoChegaram)}</p>}
+{false && <p className="break-words text-erro">{textoDasQueNaoChegaram(naoChegaram)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o tempo acabou: a questão sai, o aviso é `assertive`
-{naoChegaram > 0 && <p className="break-words text-erro">{textoDasQueNaoChegaram(naoChegaram)}</p>}
+{true && <p className="break-words text-erro">{textoDasQueNaoChegaram(naoChegaram)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a professora encerra com uma resposta na fila
-if (encerradaNoServidor) void cliente.invalidateQueries({ queryKey: provaEmFocoQueryOptions(atividadeAplicadaId).queryKey })
+if (false) void cliente.invalidateQueries({ queryKey: provaEmFocoQueryOptions(atividadeAplicadaId).queryKey })
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a extensão chega depois de o servidor recusar por tempo
-if (typeof antes === 'string' && typeof limiteEm === 'string' && Date.parse(limiteEm) > Date.parse(antes)) fila.tryAgora()
+if (typeof antes === 'string' && typeof limiteEm === 'string' && Date.parse(limiteEm) < Date.parse(antes)) fila.tryAgora()
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › em andamento: aos 29 s nenhuma leitura nova
-refetchInterval: (consulta) => (consulta.state.data?.envio != null && pendentes === 0 ? false : INTERVALO_DO_TEMPO_MS),
+refetchInterval: (consulta) => (pendentes === 0 ? false : INTERVALO_DO_TEMPO_MS),
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › acabada, mas com resposta ainda na fila
-refetchInterval: (consulta) => (consulta.state.data?.envio != null && pendentes === 0 ? false : INTERVALO_DO_TEMPO_MS),
+refetchInterval: (consulta) => (consulta.state.data?.envio != null ? false : INTERVALO_DO_TEMPO_MS),
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › acabada e com a fila vazia, não relê mais
-refetchInterval: (consulta) => (consulta.state.data?.envio != null && pendentes === 0 ? false : INTERVALO_DO_TEMPO_MS),
+refetchInterval: () => INTERVALO_DO_TEMPO_MS,
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova sem limite
-return { lido: tempo.data, venceu: conferido !== null && conferido === tempo.data?.limiteEm, aoVencer: definirLimiteVencido }
+return { lido: tempo.data, venceu: conferido === tempo.data?.limiteEm, aoVencer: definirLimiteVencido }
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a extensão chega depois de o servidor recusar por tempo
-return { lido: tempo.data, venceu: conferido !== null && conferido === tempo.data?.limiteEm, aoVencer: definirLimiteVencido }
+return { lido: tempo.data, venceu: conferido !== null, aoVencer: definirLimiteVencido }
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que já acabou não conta saída nenhuma
-if (!emAndamento) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o servidor diz que o aluno já enviou
-if (enviadaAgora || envio === 'aluno') return TEXTO_DO_FIM_ENVIADA
+if (enviadaAgora) return TEXTO_DO_FIM_ENVIADA
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a professora encerrou
-if (envio === 'encerramento' || (envio === null && dados.estado === 'encerrada')) return TEXTO_DO_FIM_ENCERRADA
+if (envio === null && dados.estado === 'encerrada') return TEXTO_DO_FIM_ENCERRADA
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o tempo acabou depois de a prova ser encerrada
-if (envio === 'encerramento' || (envio === null && dados.estado === 'encerrada')) return TEXTO_DO_FIM_ENCERRADA
+if (envio === 'encerramento' || (dados.estado === 'encerrada')) return TEXTO_DO_FIM_ENCERRADA
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o tempo acabou: a questão sai, o aviso é `assertive`
-if (envio !== null || venceuNoRelogio) return TEXTO_DO_FIM_DO_TEMPO
+if (venceuNoRelogio) return TEXTO_DO_FIM_DO_TEMPO
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o relógio chega ao limite e a releitura do tempo falha
-if (envio !== null || venceuNoRelogio) return TEXTO_DO_FIM_DO_TEMPO
+if (envio !== null) return TEXTO_DO_FIM_DO_TEMPO
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que já vem enviada, mesmo sem o envio no tempo lido
-if (dados.enviadaEm !== null) return TEXTO_DO_FIM_ENVIADA
+if (false) return TEXTO_DO_FIM_ENVIADA
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a rede cai: "Sem conexão", três respostas guardadas
-if (naFila > 0) return 'Salvando…'
+if (naFila < 0) return 'Salvando…'
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a resposta que não chegou da primeira pessoa não sai com a sessão da segunda
-return salvas > 0 ? 'Salvo' : ''
+return 'Salvo'
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a rede cai: "Sem conexão", três respostas guardadas
-return !online || fila.falha === 'passageira'
+return fila.falha === 'passageira'
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o 503 do servidor não perde a escolha
-return !online || fila.falha === 'passageira'
+return !online
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › acabou o tempo com 2 respostas que não chegaram
-const semConexao = textoDoFim === undefined && estaSemConexao(online, estadoDaFila)
+const semConexao = estaSemConexao(online, estadoDaFila)
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a rede cai: "Sem conexão", três respostas guardadas
-const semConexao = textoDoFim === undefined && estaSemConexao(online, estadoDaFila)
+const semConexao = textoDoFim === undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a rede cai: "Sem conexão", três respostas guardadas
-{semConexao && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o tempo acabou: a questão sai, o aviso é `assertive`
-{textoDoFim === undefined ? (
+{textoDoFim !== undefined ? (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o endereço digitado sem a prova ter começado
-if (prova.error instanceof ProvaNaoComecou) return <Redirect to={caminhoDaAtividadeDoAluno(atividadeAplicadaId)} replace />
+if (false) return <Redirect to={caminhoDaAtividadeDoAluno(atividadeAplicadaId)} replace />
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que não abre diz o que fazer
-const naoEncontrada = prova.error instanceof ApiError && prova.error.codigo === ErrorCode.NAO_ENCONTRADO
+const naoEncontrada = prova.error instanceof ApiError
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que a API diz não existir
-const naoEncontrada = prova.error instanceof ApiError && prova.error.codigo === ErrorCode.NAO_ENCONTRADO
+const naoEncontrada = prova.error instanceof ApiError && prova.error.codigo !== ErrorCode.NAO_ENCONTRADO
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Abrindo a prova…"
-{prova.isPending && <LoadingState rotulo="Abrindo a prova…" />}
+{false && <LoadingState rotulo="Abrindo a prova…" />}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que a API diz não existir
-{naoEncontrada && <EmptyState titulo="Esta prova não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
+{false && <EmptyState titulo="Esta prova não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que a API diz não existir
-{prova.isError && !naoEncontrada && (
+{prova.isError && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Abrindo a prova…"
-{prova.isError && !naoEncontrada && (
+{!naoEncontrada && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que não abre diz o que fazer
-{prova.isError && !naoEncontrada && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Abrindo a prova…"
-if (prova.data === undefined) return <ProvaSemDados atividadeAplicadaId={atividadeAplicadaId} prova={prova} aoSair={aoSair} />
+if (false) return <ProvaSemDados atividadeAplicadaId={atividadeAplicadaId} prova={prova} aoSair={aoSair} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o erro ao abrir diz o texto de sempre da atividade
-const naoEncontrada = lida.error instanceof ApiError && lida.error.codigo === ErrorCode.NAO_ENCONTRADO
+const naoEncontrada = lida.error instanceof ApiError
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a atividade que a API diz não existir
-const naoEncontrada = lida.error instanceof ApiError && lida.error.codigo === ErrorCode.NAO_ENCONTRADO
+const naoEncontrada = lida.error instanceof ApiError && lida.error.codigo !== ErrorCode.NAO_ENCONTRADO
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Carregando a atividade…"
-{lida.isPending && <LoadingState rotulo="Carregando a atividade…" />}
+{false && <LoadingState rotulo="Carregando a atividade…" />}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a atividade que a API diz não existir
-{naoEncontrada && <EmptyState titulo="Esta atividade não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
+{false && <EmptyState titulo="Esta atividade não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a atividade que a API diz não existir
-{lida.isError && !naoEncontrada && (
+{lida.isError && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Carregando a atividade…"
-{lida.isError && !naoEncontrada && (
+{!naoEncontrada && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o erro ao abrir diz o texto de sempre da atividade
-{lida.isError && !naoEncontrada && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › só a prova em andamento, com limite, ainda aberta
-return dados.tempo.limiteEm !== null && dados.enviadaEm === null && dados.estado === 'aberta'
+return dados.enviadaEm === null && dados.estado === 'aberta'
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › só a prova em andamento, com limite, ainda aberta
-return dados.tempo.limiteEm !== null && dados.enviadaEm === null && dados.estado === 'aberta'
+return dados.tempo.limiteEm !== null && dados.estado === 'aberta'
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › só a prova em andamento, com limite, ainda aberta
-return dados.tempo.limiteEm !== null && dados.enviadaEm === null && dados.estado === 'aberta'
+return dados.tempo.limiteEm !== null && dados.enviadaEm === null
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Carregando a atividade…"
-if (dados === undefined) return <PortaSemDados lida={lida} />
+if (false) return <PortaSemDados lida={lida} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova sem duração não diz "Esta prova tem…"
-if (!dados.comecou) return dados.janela === null ? <Atividade atividadeAplicadaId={atividadeAplicadaId} /> : <AntesDeComecar antes={dados} />
+if (!dados.comecou) return <AntesDeComecar antes={dados} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-if (!dados.comecou) return dados.janela === null ? <Atividade atividadeAplicadaId={atividadeAplicadaId} /> : <AntesDeComecar antes={dados} />
+if (!dados.comecou) return <Atividade atividadeAplicadaId={atividadeAplicadaId} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › só a prova em andamento, com limite, ainda aberta
-return estaEmProva(dados) ? <Redirect to={caminhoDaProvaDoAluno(atividadeAplicadaId)} replace /> : <Atividade atividadeAplicadaId={atividadeAplicadaId} />
+return <Atividade atividadeAplicadaId={atividadeAplicadaId} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › só a prova em andamento, com limite, ainda aberta
-return estaEmProva(dados) ? <Redirect to={caminhoDaProvaDoAluno(atividadeAplicadaId)} replace /> : <Atividade atividadeAplicadaId={atividadeAplicadaId} />
+return <Redirect to={caminhoDaProvaDoAluno(atividadeAplicadaId)} replace />
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova sem duração não diz "Esta prova tem…"
-{antes.duracaoMin !== null && <p className="text-base text-tinta">{`Esta prova tem ${String(antes.duracaoMin)} minutos, contados a partir de Começar.`}</p>}
+<p className="text-base text-tinta">{`Esta prova tem ${String(antes.duracaoMin)} minutos, contados a partir de Começar.`}</p>
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-{antes.janela !== null && aberta && <p className="text-base text-tinta">{`Ela fecha às ${horaNaEscola(antes.janela.fechaEm)}.`}</p>}
+{false && <p className="text-base text-tinta">{`Ela fecha às ${horaNaEscola(antes.janela.fechaEm)}.`}</p>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › depois de fechar: "Esta prova fechou às HH:MM"
-{antes.janela !== null && aberta && <p className="text-base text-tinta">{`Ela fecha às ${horaNaEscola(antes.janela.fechaEm)}.`}</p>}
+{antes.janela !== null && <p className="text-base text-tinta">{`Ela fecha às ${horaNaEscola(antes.janela.fechaEm)}.`}</p>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-if (erro === null) return {}
+if (false) return {}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a janela que o servidor recusa vale mais que o relógio do computador
-if (codigo === ErrorCode.PROVA_FORA_DA_JANELA) return { aviso: 'Esta prova não está aberta agora.' }
+if (false) return { aviso: 'Esta prova não está aberta agora.' }
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" que falha diz para tentar de novo
-if (codigo === ErrorCode.ATIVIDADE_ENCERRADA) return { aviso: 'Quem dá a aula encerrou esta prova.' }
+if (false) return { aviso: 'Quem dá a aula encerrou esta prova.' }
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" mostra "Abrindo…", desligado
-if (!resposta.comecou) return
+if (false) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" mostra "Abrindo…", desligado
-{comecar.isPending ? 'Abrindo…' : 'Começar'}
+{comecar.isPending ? 'Começar' : 'Começar'}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" mostra "Abrindo…", desligado
-<Button variante="oficial" onClick={() => comecar.mutate()} disabled={comecar.isPending} className="self-start">
+<Button variante="oficial" onClick={() => comecar.mutate()} className="self-start">
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" cria a tentativa uma vez e leva à prova em foco
-navegar(caminhoDaProvaDoAluno(id), { replace: true })
+navegar(caminhoDaProvaDoAluno(id))
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › ao entrar, o foco vai ao enunciado da primeira questão
-if (emProva) enunciado.current?.focus()
+if (false) enunciado.current?.focus()
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
-{prova.avaliativa && !emProva && <Banner>{AVISO_DA_AVALIACAO}</Banner>}
+{!emProva && <Banner>{AVISO_DA_AVALIACAO}</Banner>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova", sem aviso de Tutor nem link de ajuda
-{prova.avaliativa && !emProva && <Banner>{AVISO_DA_AVALIACAO}</Banner>}
+{prova.avaliativa && <Banner>{AVISO_DA_AVALIACAO}</Banner>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
-{prova.avaliativa && !emProva && <Banner>{AVISO_DA_AVALIACAO}</Banner>}
+{<Banner>{AVISO_DA_AVALIACAO}</Banner>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova", sem aviso de Tutor nem link de ajuda
-<div {...(emProva ? {} : { role: 'status' })} data-resposta={marca}
+<div role="status" data-resposta={marca}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
-<div {...(emProva ? {} : { role: 'status' })} data-resposta={marca}
+<div {...(emProva ? { role: 'status' } : {})} data-resposta={marca}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › a atividade avaliativa
-{!prova.avaliativa && !emProva && (
+{!emProva && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › mesmo que a prova viesse como não avaliativa
-{!prova.avaliativa && !emProva && (
+{!prova.avaliativa && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
-{!prova.avaliativa && !emProva && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova", sem aviso de Tutor nem link de ajuda
-{emProva ? `Para sair, use ${TEXTO_DE_SAIR_DA_PROVA}. O tempo continua.` : 'Pode parar quando quiser. O que você respondeu fica guardado, e dá para continuar depois.'}
+{'Pode parar quando quiser. O que você respondeu fica guardado, e dá para continuar depois.'}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
-{emProva ? `Para sair, use ${TEXTO_DE_SAIR_DA_PROVA}. O tempo continua.` : 'Pode parar quando quiser. O que você respondeu fica guardado, e dá para continuar depois.'}
+{`Para sair, use ${TEXTO_DE_SAIR_DA_PROVA}. O tempo continua.`}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › ao entrar, o foco vai ao enunciado da primeira questão
-titulo={emProva ? 'Enviar a prova?' : 'Enviar a atividade?'}
+titulo={'Enviar a atividade?'}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › ao entrar, o foco vai ao enunciado da primeira questão
-{ rotulo: emProva ? 'Prova' : 'Atividade', valor: prova.titulo },
+{ rotulo: 'Atividade', valor: prova.titulo },
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › ao entrar, o foco vai ao enunciado da primeira questão
-rotuloDeConfirmar={emProva ? 'Enviar a prova' : 'Enviar a atividade'}
+rotuloDeConfirmar={'Enviar a atividade'}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova" com 503
-{...(envio.isError ? { falha: emProva ? textoDoEnvioQueFalhou(envio.error) : errorMessage(envio.error) } : {})}
+{...(envio.isError ? { falha: errorMessage(envio.error) } : {})}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › a queda de rede no envio deixa o diálogo aberto
-{...(envio.isError ? { falha: emProva ? textoDoEnvioQueFalhou(envio.error) : errorMessage(envio.error) } : {})}
+{...(envio.isError ? { falha: textoDoEnvioQueFalhou(envio.error) } : {})}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › o aluno que marca pelo texto a alternativa certa manda o índice original
-const numero = questao?.numero ?? posicao
+const numero = posicao
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova", sem aviso de Tutor nem link de ajuda
 <Button variante="oficial" onClick={() => definirConfirmando(true)}>
-{emProva ? 'Enviar a prova' : 'Enviar a atividade'}
+{'Enviar a atividade'}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
 <Button variante="oficial" onClick={() => definirConfirmando(true)}>
-{emProva ? 'Enviar a prova' : 'Enviar a atividade'}
+{'Enviar a prova'}
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › a prova em andamento é tela de foco
-return TELAS_DE_FOCO.includes(caminho) || PROVA_EM_FOCO.test(caminho)
+return TELAS_DE_FOCO.includes(caminho)
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › é verdadeira nas três introduções
-return TELAS_DE_FOCO.includes(caminho) || PROVA_EM_FOCO.test(caminho)
+return PROVA_EM_FOCO.test(caminho)
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › a prova em andamento é tela de foco
-const PROVA_EM_FOCO = new RegExp(`^${AREA_BASE_PATH.aluno}${ALUNO_ROUTES.prova.replace(':atividadeAplicadaId', '[^/]+')}$`)
+const PROVA_EM_FOCO = new RegExp(`^${AREA_BASE_PATH.aluno}${ALUNO_ROUTES.prova.replace(':atividadeAplicadaId', '[^/]+')}`)
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › a prova em andamento é tela de foco
-const PROVA_EM_FOCO = new RegExp(`^${AREA_BASE_PATH.aluno}${ALUNO_ROUTES.prova.replace(':atividadeAplicadaId', '[^/]+')}$`)
+const PROVA_EM_FOCO = new RegExp(`${AREA_BASE_PATH.aluno}${ALUNO_ROUTES.prova.replace(':atividadeAplicadaId', '[^/]+')}$`)
```

```mutacao
arquivo: apps/web/src/areas/aluno/routes.tsx
teste: apps/web/src/areas/aluno/routes.test.tsx › "/aluno/prova/<id>" abre a prova em foco
-{(parametros) => (UUID.test(parametros.atividadeAplicadaId) ? <ProvaEmFoco key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} /> : <NotFoundContent />)}
+{(parametros) => <ProvaEmFoco key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} />}
```

```mutacao
arquivo: apps/web/src/areas/aluno/routes.tsx
teste: apps/web/src/areas/aluno/routes.test.tsx › "/aluno/prova/<id>" abre a prova em foco
-{(parametros) => (UUID.test(parametros.atividadeAplicadaId) ? <ProvaEmFoco key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} /> : <NotFoundContent />)}
+{(parametros) => (UUID.test(parametros.atividadeAplicadaId) ? <NotFoundContent /> : <ProvaEmFoco key={parametros.atividadeAplicadaId} atividadeAplicadaId={parametros.atividadeAplicadaId} />)}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › antes de abrir, diz quando abre
-if (situacao === 'antes') return `Esta prova abre em ${diaEHoraNaEscola(janela.abreEm)}`
+if (false) return `Esta prova abre em ${diaEHoraNaEscola(janela.abreEm)}`
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › depois de fechar: "Esta prova fechou às HH:MM"
-return situacao === 'depois' ? `Esta prova fechou às ${horaNaEscola(janela.fechaEm)}` : undefined
+return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a janela que o servidor recusa vale mais que o relógio do computador
-const codigo = erro instanceof ApiError ? erro.codigo : undefined
+const codigo = undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a janela que o servidor recusa vale mais que o relógio do computador
-const janela = textoDaJanela(antes.janela, agora) ?? recusa.aviso
+const janela = textoDaJanela(antes.janela, agora)
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-{antes.duracaoMin !== null && <p className="text-base text-tinta">{`Esta prova tem ${String(antes.duracaoMin)} minutos, contados a partir de Começar.`}</p>}
+{antes.duracaoMin !== null && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-{antes.janela !== null && aberta && <p className="text-base text-tinta">{`Ela fecha às ${horaNaEscola(antes.janela.fechaEm)}.`}</p>}
+{antes.janela !== null && aberta && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-{janela !== undefined && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › antes de abrir, diz quando abre
-{aberta && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › diz a duração sem a palavra "adicional"
-{recusa.falha !== undefined && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Carregando a atividade…"
-{lida.isPending && <LoadingState rotulo="Carregando a atividade…" />}
+{lida.isPending && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a atividade que a API diz não existir
-{naoEncontrada && <EmptyState titulo="Esta atividade não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
+{naoEncontrada && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o erro ao abrir diz o texto de sempre da atividade
-{lida.isError && !naoEncontrada && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › a atividade avaliativa
-{prova.avaliativa && !emProva && <Banner>{AVISO_DA_AVALIACAO}</Banner>}
+{prova.avaliativa && !emProva && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Enviar a prova", sem aviso de Tutor nem link de ajuda
-<div {...(emProva ? {} : { role: 'status' })} data-resposta={marca} className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-base">
+<div role="status" data-resposta={marca} className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-base">
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › a atividade avaliativa
-{!prova.avaliativa && !emProva && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a prova que ainda não abriu diz
-{janela !== undefined && <span className="block font-medium text-tinta">{janela}</span>}
+{<span className="block font-medium text-tinta">{janela}</span>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a prova que ainda não abriu diz
-{janela !== undefined && <span className="block font-medium text-tinta">{janela}</span>}
+{janela !== undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a linha de quem não tem resposta na fila
-{naoChegaram > 0 && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que o servidor diz já enviada não anuncia o tempo que sobra
-if (falta === undefined || parado) return
+if (falta === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a professora encerra com uma resposta na fila
-{naoChegaram > 0 && <p className="break-words text-erro">{textoDasQueNaoChegaram(naoChegaram)}</p>}
+{naoChegaram > 0 && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que já vem enviada, mesmo sem o envio no tempo lido
-if (envio === 'encerramento' || (envio === null && dados.estado === 'encerrada')) return TEXTO_DO_FIM_ENCERRADA
+if (envio === 'encerramento' || (envio === null)) return TEXTO_DO_FIM_ENCERRADA
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › enquanto o tempo não foi lido a prova segue
-const textoDoFim = textoDoFimDaProva(dados, lido?.envio ?? null, enviadaAgora, venceu)
+const textoDoFim = textoDoFimDaProva(dados, lido?.envio, enviadaAgora, venceu)
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Abrindo a prova…"
-{prova.isPending && <LoadingState rotulo="Abrindo a prova…" />}
+{prova.isPending && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que a API diz não existir
-{naoEncontrada && <EmptyState titulo="Esta prova não está disponível" descricao="Ela pode ser de outra turma, ou o endereço está errado. As tarefas da sua turma estão em Tarefas." />}
+{naoEncontrada && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › carregando: "Abrindo a prova…"
-{prova.isError && !naoEncontrada && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-respostas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a rede cai: "Sem conexão", três respostas guardadas
-if (typeof window !== 'undefined') window.addEventListener('online', redeVoltouEmTodas)
+if (false) window.addEventListener('online', redeVoltouEmTodas)
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › parada com uma saída no ar, a falha que chega depois
 (erro: unknown) => {
-if (parada) return
 noAr = false
 if (recusadaDeVez(codigoDoErro(erro))) {
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/fila-de-saidas.test.ts › parada, a fila não manda mais nada
-if (parada) return
 fila = [...fila, { chave: novaChave() }]
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › antes de abrir, diz quando abre
-{janela !== undefined && (
-<p role="status" className="rounded-controle bg-fundo-suave p-3 font-medium break-words text-tinta">
-{janela}
-</p>
-)}
+{janela !== undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › "Começar" que falha diz para tentar de novo
-{recusa.falha !== undefined && (
-<p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro">
-{recusa.falha}
-</p>
-)}
+{recusa.falha !== undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o erro ao abrir diz o texto de sempre da atividade
-{lida.isError && !naoEncontrada && (
-<div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
-<p role="alert" className="t-apoio text-erro">
-{errorMessage(lida.error)}
-</p>
-<Button className="mt-3" onClick={() => void lida.refetch({ cancelRefetch: false })}>
-Tentar de novo
-</Button>
-</div>
-)}
+{lida.isError && !naoEncontrada && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividade.tsx
teste: apps/web/src/areas/aluno/Atividade.test.tsx › com dado: o título da tarefa
-{!prova.avaliativa && !emProva && (
-<Link to={caminhoDoTutorNaAtividade(provaId, numero)} className={`${SECONDARY_LINK_CLASSES} gap-2`}>
-<MessageCircleQuestion aria-hidden="true" size={18} className="shrink-0" />
-Pedir ajuda ao Tutor nesta questão
-</Link>
-)}
+{!prova.avaliativa && !emProva && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › as respostas que o servidor ainda não confirmou
-{naoChegaram > 0 && (
-<span role="status" className="block font-medium text-erro">
-{textoDasQueAindaNaoChegaram(naoChegaram)}
-</span>
-)}
+{naoChegaram > 0 && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova que não abre diz o que fazer
-{prova.isError && !naoEncontrada && (
-<div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
-<p role="alert" className="t-apoio text-erro">
-{TEXTO_DE_ERRO_AO_ABRIR_A_PROVA}
-</p>
-<Button className="mt-3" onClick={() => void prova.refetch({ cancelRefetch: false })}>
-Tentar de novo
-</Button>
-</div>
-)}
+{prova.isError && !naoEncontrada && null}
```

```mutacao
arquivo: apps/web/src/api/atividades-do-aluno.ts
teste: apps/web/src/api/atividades-do-aluno.test.ts › a prova que ainda não começou é ProvaNaoComecou
-...(tempo === undefined ? {} : { tempo: soOsCamposDe(tempoDaProvaSchema.shape, tempo) }),
+...({ tempo: soOsCamposDe(tempoDaProvaSchema.shape, tempo) }),
```

```mutacao
arquivo: apps/web/src/areas/aluno/AntesDeComecar.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › antes de abrir, diz quando abre
-if (janela === null) return undefined
+if (janela !== null) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › voltando do "Sair da prova", o foco vai ao link
-if (typeof id !== 'string') return
+if (typeof id === 'string') return
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a primeira entrada da aba, com o estado do histórico nulo
-const id = typeof estado === 'object' && estado !== null && 'voltouDaProva' in estado ? estado.voltouDaProva : undefined
+const id = typeof estado === 'object' && 'voltouDaProva' in estado ? estado.voltouDaProva : undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › com o fim já na tela o relógio não bate mais
-if (parado) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o relógio chega ao limite e a releitura do tempo falha
-const limiteLido = tempo?.limiteEm ?? undefined
+const limiteLido = undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a extensão chega depois de o servidor recusar por tempo
-if (limiteEm === undefined) return
+if (limiteEm !== undefined) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o relógio chega ao limite e a releitura do tempo falha
-if (limiteVencido === null) return
+if (limiteVencido !== null) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › o relógio chega ao limite e a releitura do tempo falha
-if (vivo) definirConferido(limiteVencido)
+if (vivo) definirConferido(null)
```

```mutacao
arquivo: apps/web/src/areas/aluno/ProvaEmFoco.tsx
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova sem limite
-return dados.estado === 'aberta' ? undefined : TEXTO_DO_FIM_ENCERRADA
+return dados.estado === 'aberta' ? TEXTO_DO_FIM_ENCERRADA : undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › escreve o dia e a hora na parede da escola
-const valor = (tipo: string): string => partes.find((parte) => parte.type === tipo)?.value ?? ''
+const valor = (tipo: string): string => partes.find((parte) => parte.type !== tipo)?.value ?? ''
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a saída que o servidor não recebeu sai na volta da rede
-if (typeof window !== 'undefined') {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda
falha: toHaveLength(0)
 aoTrocarDeSessao(() => {
-for (const fila of filas.values()) fila.stop()
 filas.clear()
 })
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda
falha: toHaveLength(0)
 aoTrocarDeSessao(() => {
-for (const fila of filas.values()) fila.stop()
-filas.clear()
 })
 aoAbrirSessao(() => {
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda
 aoTrocarDeSessao(() => {
 for (const fila of filas.values()) fila.stop()
-filas.clear()
 })
```

```mutacao
arquivo: apps/web/src/areas/aluno/fila-de-saidas.ts
teste: apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a sessão que volta manda a saída da aba que ficou esperando na hora
 aoAbrirSessao(() => {
-for (const fila of filas.values()) fila.tryAgora()
 })
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › a lista lê o relógio do computador uma vez só
-  const agora = useAgora()
+  const agora = Date.now()
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `frontend-reviewer` 1ª | Usar `tituloEmDuasLinhas` na lista de Tarefas (ordem r1, item 13) | Já está na tabela do documento e no `TODO.md`: o contrato do `ListItem` e o catálogo do `interface.md` reservam o prop ao título fixo e curto; o título da tarefa é dado. O `frontend-reviewer` aceitou na 2ª rodada |
| `tenancy-guardian` 1ª | Teste de outra escola só para `GET …/tempo` | `TODO.md`, para a tarefa de servidor que tocar o endpoint de novo: esta tarefa não altera `apps/api` |
| `frontend-reviewer` 1ª | "Começar" não some quando o relógio do computador diz que a janela não abriu ou já fechou; o servidor recusa por `PROVA_FORA_DA_JANELA` | Recusada: é a divergência 2 da tabela "Divergências resolvidas nesta tarefa" (`cenarios.md` §4 e `techspec.md` §9), com o caso de `ProvaEmFoco.test.tsx` que a prova de propósito |
| `frontend-reviewer` 1ª | "Começar" com a variante `oficial` (grafite), que `button-variants.ts` reserva para decisão oficial; sugere `primario` | `TODO.md`: escolha da pele (D72, D80); muda o botão no guia inteiro, e não só nesta tela |
| `frontend-reviewer` 1ª | "Chame o professor" convive com "quem dá a aula" na tela (`atividade.ts`) | `TODO.md`: mexe em texto de tela que os casos da tabela citam por extenso; decisão de redação do Arquiteto |
| `infra-guardian` 1ª | `refetchOnReconnect: false` em `tempoDaProvaQueryOptions`, ou o tempo também esperar o sorteio de 0 a 5 s | `TODO.md`, com a tarefa de carga (§7c da Tech Spec): muda o tráfego da volta da rede e precisa de medida no k6 |
| `infra-guardian` 1ª; `revisor-geral` 1ª | `staleTime` na query do tempo, ou semear o cache de `provaEmFocoQueryOptions` com o que a porta já leu, para o "Começar" e o voltar à prova em andamento não lerem duas vezes | `TODO.md`, junto com a linha acima: muda o número de chamadas no caminho quente da manhã e precisa ser medido |
| `infra-guardian` 1ª | O k6 (`infra/k6/prova-online.js`) lê o tempo só a cada 30 s, e o app lê também ao montar, depois do "Começar", ao voltar o foco e ao voltar a rede | `TODO.md`: a tarefa de carga |
| `revisor-geral` 1ª | `FUSO_DA_ESCOLA` e `horaNaEscola` (`areas/aluno/atividades.ts`) repetem os de `areas/professor/atividades/prova-online.ts`; descer para `apps/web/src/format.ts` | `TODO.md`: refatoramento que atravessa duas áreas, fora do que a 12.0 toca |
| `revisor-geral` 1ª | "Ela fecha às HH:MM" (`AntesDeComecar.tsx`) não está em `cenarios.md` §4 e não diz o dia quando a janela fecha em outro dia | `TODO.md` (dono: Arquiteto): texto de tela é decisão dele |
| `revisor-geral` 1ª | Quando o "Começar" recebe resposta sem `comecou`, a tela não navega nem diz nada (`AntesDeComecar.tsx`) | `TODO.md`: comportamento novo da tela de erro; a resposta fora do contrato já cai em `RespostaForaDoContrato` |
| `conformidade-reviewer` 1ª | A AIA da F6 deve registrar que o `blur` também conta quando o foco vai à barra do navegador, ao shelf do ChromeOS ou a uma notificação | `TODO.md` e a AIA da F6 (`docs/aia/`): a tarefa não escreve AIA |
| `infra-guardian` 2ª | `aoAbrirSessao` chama `tryAgora` em todas as filas de saída ao mesmo tempo, sem o sorteio de 0 a 5 s do `online` (`fila-de-saidas.ts`) | `TODO.md`, com a tarefa de carga: só pesa se a sessão voltar para a escola toda junta (um deploy que derrube a sessão de todos) |
| `infra-guardian` 2ª | `AntesDeComecar.tsx` tem o próprio `useAgora`, certo porque a tela está sozinha na rota; a próxima tela que montar várias linhas lê o relógio uma vez no componente de cima | Sem ação: o revisor diz que o código está certo; fica o registro |
| `frontend-reviewer` 2ª | Títulos longos cortados a 360 px (a mesma da 1ª) | Já tratada acima (item 13) |
| `revisor-geral` 2ª | O passo 4 do roteiro diz "Bruno (Aluno 2) responde e envia" sem citar o **Começar**; escrever "Bruno começa, responde e envia" | `TODO.md`: texto de documento, a próxima vez que o roteiro for tocado |
| `revisor-geral` 2ª | `montarCenaEmbaralhada` (`e2e/aluno-prova.spec.ts`) refaz a aplicação até 6 vezes; um sorteio determinístico no seed tiraria o laço | `TODO.md`: depende de a API aceitar a ordem no seed; a chance de esgotar as tentativas é desprezível |
| `tenancy-guardian` 2ª | Falta, do lado da lista de Tarefas, um caso que prove que a contagem "N respostas ainda não chegaram" da primeira pessoa não aparece na lista da segunda depois do `sair()` | `TODO.md`: teste de tela de `Atividades`; a fila de saídas e a de respostas já têm o caso do recomeço |
| `privacy-guardian` 2ª | Citar, no comentário de `fila-de-respostas.ts` (a limpeza do `aoTrocarDeSessao`), o caso de teste que a prova, como já se fez na fila de saídas | `TODO.md`: comentário, a próxima vez que o arquivo for tocado |
| `privacy-guardian` 2ª; `test-engineer` 2ª | `ProvaEmFoco.test.tsx` prepara `/\/v1\/sessao\/sair/` e `/\/v1\/sessao$/`; o `sair()` faz `DELETE /v1/sessao`, e o caso passa pelo `catch` e pelo `finally`. Alinhar os dois casos | `TODO.md`: o caso continua válido; é limpeza de teste |
| `test-engineer` 2ª | Folga estreita para a mutação da extensão (`ProvaEmFoco.test.tsx`, o caso de relógio falso com `shouldAdvanceTime`): conferir `expect(puts(rede)).toHaveLength(2)` logo depois do `passar(700)`, ou dar ao `waitFor` um `timeout` de 200 ms | `TODO.md`: o comportamento certo não fica vermelho; só o mutante pode ficar verde em máquina carregada |
| `test-engineer` 2ª | Comentário errado: "o menor recuo … é de 1,1 s", mas `esperaAntesDeTentar(1)` com o sorteio em 0 dá 1,5 s | `TODO.md`: comentário de teste |
| `test-engineer` 2ª | A linha "Recomeço" da tabela de testes só cita o caso da resposta; os dois casos novos de saída aparecem nos blocos de mutação e em nenhuma linha | `TODO.md`: o Validador lê a tabela; acertar quando o documento for tocado de novo |
| `test-engineer` 2ª | O bloco de mutação que remove só o `clear()` não tem a linha `falha:` | `TODO.md`: o bloco funciona; falta dizer qual asserção o pega (a saída da segunda que tem de chegar) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 07:53:54 | 2026-11-28 07:54:40 | `tenancy-guardian` | 1 | APROVADO | acf369528d5ccb963 |
| 2026-11-28 07:53:33 | 2026-11-28 07:55:20 | `privacy-guardian` | 1 | REPROVADO | a82ae45c3f6b7e629 |
| 2026-11-28 07:53:49 | 2026-11-28 07:55:24 | `frontend-reviewer` | 1 | APROVADO | a05a30ac4a412a4d0 |
| 2026-11-28 07:53:38 | 2026-11-28 07:55:54 | `conformidade-reviewer` | 1 | APROVADO | aa1d35458f47be005 |
| 2026-11-28 07:53:43 | 2026-11-28 07:56:19 | `infra-guardian` | 1 | APROVADO | a28e316252661a7e0 |
| 2026-11-28 07:54:05 | 2026-11-28 07:57:01 | `revisor-geral` | 1 | REPROVADO | ab0d67c80cc034db0 |
| 2026-11-28 07:54:00 | 2026-11-28 07:57:34 | `test-engineer` | 1 | REPROVADO | a4bda4aba6f3ca5fb |
| 2026-11-28 08:54:14 | 2026-11-28 08:54:40 | `infra-guardian` | 2 | APROVADO | a8fbb2f7ace65ff68 |
| 2026-11-28 08:54:21 | 2026-11-28 08:54:43 | `frontend-reviewer` | 2 | APROVADO | afc5625906f2b9c20 |
| 2026-11-28 08:54:02 | 2026-11-28 08:54:44 | `revisor-geral` | 2 | APROVADO | ad9bc513eaa40c56e |
| 2026-11-28 08:54:27 | 2026-11-28 08:54:51 | `tenancy-guardian` | 2 | APROVADO | a304bdb475a179cc3 |
| 2026-11-28 08:54:08 | 2026-11-28 08:54:56 | `conformidade-reviewer` | 2 | APROVADO | a383a80d488873a3f |
| 2026-11-28 08:53:42 | 2026-11-28 08:55:12 | `privacy-guardian` | 2 | APROVADO | a90bf5348d786ef3c |
| 2026-11-28 08:53:53 | 2026-11-28 08:56:37 | `test-engineer` | 2 | APROVADO | aff5257315e085876 |
