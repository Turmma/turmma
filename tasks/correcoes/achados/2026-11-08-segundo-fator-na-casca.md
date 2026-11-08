# Achados das revisões — `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 12:07:05 · `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A correção não cria nem altera migration nem schema. Só mexe em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`, além do documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`.

Queries verificadas: nenhuma. Nenhum repository, service, endpoint ou `@Unscoped()` mudou. As chamadas novas em `e2e/mfa.spec.ts` (`POST /v1/sessao/email` e `POST /v1/sessao/mfa`) passam pelos endpoints de login que já existiam, com a credencial da própria conta criada no caso. Nenhuma delas envia `escolaId` no corpo nem na query string. O `page.route` só intercepta `/v1/conta/mfa/configurar` e `/v1/sessao/mfa` para simular a recusa 401 no navegador, e a API não muda.

Teste de isolamento: não se aplica. A correção não traz módulo, query nem endpoint novo. A recusa simulada usa o mesmo `NAO_AUTENTICADO` de qualquer desafio inválido, então não cria diferença entre "não existe" e "sem permissão".

Bloqueantes: nenhum.

Recomendações: nenhuma de isolamento entre escolas. O resto da árvore, que é a tarefa 4.0 em `apps/api/src/professores/`, `e2e/professores.spec.ts`, `e2e/support/seed.ts` e `apps/api/test/convites-enviar.int.test.ts`, ficou fora desta auditoria, como o pedido define. Ele precisa da auditoria de isolamento na rodada da própria 4.0.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 12:07:15 · `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só fixture e spec de e2e do login com segundo fator; nenhuma linha de `apps/*/src`, `packages/*/src`, `infra/` ou compose)
Rate limit: ok (não tocado; a proteção por conta do login segue como estava)
Fila e prioridade: ok (não tocada)
Concorrência: protegida (não se aplica; a correção não grava nada)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código de produto novo)
Bloqueantes: nenhum

O que conferi para as 10h:
- **O defeito em produção já está corrigido, e com teste.** É o desafio recusado com `iat` à frente do relógio de quem confere, que com duas instâncias da API dá 401 no login da coordenação. Foi tratado no commit `649831ca` (correção `2026-11-08-desafio-com-folga-de-relogio`): folga de 10 s em `verifyChallenge` e `verifyOperadorChallenge`, com teste em `apps/api/src/credencial/challenge.test.ts` e `packages/core/src/identidade/verify-token.test.ts`. Esta correção não precisa repetir isso.
- **As repetições ficam só no teste.** As três tentativas com 3 s e 5 s de espera estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts`, e não no cliente web. O produto continua a recusar de propósito e a mostrar "Tentar de novo". Nada aumenta a carga de login sobre a API em produção.
- **A recusa simulada não chama ninguém de fora.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`, ela é uma rota do Playwright (`recusarPorUmTempo`), sem provedor externo nem pago. Os dois casos novos afirmam dois pedidos, o que pega uma regressão para a repetição na hora.

Recomendações:
1. **Sincronia de relógio na produção.** O documento deixa a origem da diferença de relógio com o `infra-guardian`. Na VPS de produção (D82), API, worker e realtime leem o relógio do mesmo host, e a folga de 10 s cobre um erro pequeno. Mesmo assim:
   - registrar no `docs/runbook.md` (ou no `TODO.md`) que o host roda NTP (`chrony` ou `timesyncd`) e como conferir a deriva;
   - quando a infra for para mais de um host, criar um alerta de deriva de relógio.
2. **Métrica interna da recusa do desafio.** A API não diz ao cliente qual parte do desafio falhou, e isso fica assim. Um contador interno por motivo (iat no futuro, expirado, sem a marca do Redis) é outra coisa: ele separaria na hora as duas causas que este documento levou dois portões para distinguir, e não vaza nada para fora.
3. **Nomes dos casos.** Os dois casos novos de `mfa.spec.ts` dizem "porque o Redis de fila não respondeu", mas o que eles simulam é sobretudo o `iat` à frente do relógio. Um nome neutro, como "recusado por um tempo", evita apontar a causa errada a quem ler o caso que caiu.
4. **As repetições escondem uma regressão da folga no e2e.** Com a folga de 10 s já no produto, as repetições por relógio quase não são mais necessárias. Se a folga voltar a quebrar, o e2e passaria em silêncio e só os testes de unidade da `649831ca` pegariam. Vale uma linha no documento dizendo que é esse teste que guarda a folga.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 12:07:16 · `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção muda só código de teste e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`). Não há migration, nem schema, nem DTO, nem rota, e nenhuma linha de `apps/*/src` ou `packages/*/src` muda.

Fora da tabela de dados do docs/lgpd.md: nada. Não entra campo novo.

Autorização por objeto: ok. A correção não cria nem muda rota. A rota simulada (`recusarPorUmTempo`) responde com o mesmo `NAO_AUTENTICADO` de qualquer desafio inválido, sem dizer qual parte falhou. Isso mantém o desenho da regra 6, em que "não encontrado" e "sem permissão" respondem igual.

Logs: limpos. Os arquivos alterados não chamam `console` nem `attach`. Os três `throw new Error` das fixtures levam só a contagem de tentativas, os códigos HTTP e o texto fixo de `mensagemDoSegundoFator('NAO_AUTENTICADO')`. Nenhum deles leva e-mail, nome, segredo ou código.

Auditoria: não se aplica. A correção não tem leitura de dado de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum. Não há IA nem `ExecucaoAgente` nesta correção.

Seed/fixture: sintético. `criarEquipeComSenha` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:87-109`) gera nome "Coordenadora sintética <uuid>", e-mail `@educa.invalid` e senha derivada de UUID. Essa função está fora desta correção e foi só lida.

Outros pontos de exposição que conferi:
- O segredo TOTP continua fora do armazenamento e da URL. O caso dividido mantém as asserções `guardado.url not.toContain(segredo)` e, depois da ativação, `body not.toContainText(segredo)`.
- A asserção nova de `pedirOSegredo` exige que o segredo apareça na tela de configuração, que é onde ele deve aparecer. Isso não é vazamento.
- O caso novo (2) usa `page.context().request` contra a API real com credencial sintética. A prova do elo entre a tela e a conta ficou mais forte, sem abrir nenhum caminho novo.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma de antes, por `arquivo-do-titular` e `pedido-titular`.

Bloqueantes: nenhum.

Recomendações:
- O nome de dois casos novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts` diz "porque o Redis de fila não respondeu". A causa vista no portão foi o `iat` do desafio à frente do relógio da API. O próprio documento da correção admite isso na linha 54. Um nome neutro, como "recusado por um tempo", evita induzir a próxima leitura ao erro. É questão de texto, não de privacidade.
- `RECUSA_DA_API` (`mfa.spec.ts:14`) usa um `requisicaoId` fixo e sintético. Está certo assim. Se um dia o corpo de erro passar a ter outro campo, vale conferir em `apps/api/test/error.int.test.ts` que a simulação continua igual ao corpo real, sem stack.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 12:07:16 · `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A correção não cria, não altera e não exercita nenhum caminho de escrita em `Nota`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok, porque a correção não toca nenhuma saída de IA nem nenhum fluxo de aprovação.
Supervisão do tutor: ok, porque a correção não toca o tutor.
Autonomia declarada e visível: sim, sem mudança. A correção não toca governança nem a declaração de agentes.
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70.

**O que auditei.** Revisei só os dois arquivos de código da correção e o documento dela.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/casca.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/mfa.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

Os arquivos da 4.0 e das outras correções ficaram fora, como pede o documento.

**O que muda.** Tudo é código de teste e cuida só do segundo fator no login da coordenação.
- **`casca.ts`:** ganhou `pedirOSegredo`, que lê a resposta de `configurar` pelo status. Ganhou também `digitarOCodigoDaEntrada` e `esperarParaRepetir`, com 3 e 5 s medidos no relógio de parede. `ativarOSegundoFator` passa a esperar antes de repetir.
- **`mfa.spec.ts`:** o caso feito à mão virou quatro. Entraram dois casos de recusa temporária, simulada por `page.route`.

Nada em `apps/*/src`, `packages/*/src` ou `docs/regulacao.md` muda nesta correção.

**Os nove pontos de verificação:**
1. **Nota com autor humano:** nenhum caminho novo de escrita em `Nota`. O `seed.ts` alterado na árvore é da 4.0 e está fora desta revisão.
2. **Decisão sobre o aluno:** a correção não implementa nem sugere aprovação, reprovação ou encaminhamento.
3. e 6. **Aprovação registrada e auditoria:** sem saída de IA nova e sem fluxo de aprovação alterado.
4. e 7. **Tutor e vigilância:** sem tutor, sem inferência emocional e sem medir comportamento. A recusa simulada conta pedidos HTTP no próprio teste, não o uso de uma pessoa.
5. **Autonomia declarada:** sem mudança.
8. **Discursiva e redação:** nada toca essas modalidades.
9. **Professor:** nenhuma métrica, ranking ou visão sobre o professor. O que muda é o login da coordenação com segundo fator, e nenhuma tela de governança, de indicador ou de conversa do professor.

Não havia fotos da tela no pedido, então não houve conferência visual.

Fora da regra 70, um registro para o `test-engineer`. Os nomes dos dois casos novos citam o "Redis de fila", mas a causa que o documento demonstra é o `iat` do desafio à frente do relógio da API. O próprio documento reconhece a diferença. Não é bloqueante e não é desta revisão.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 12:08:26 · `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

VEREDITO: APROVADO

Cenários exigidos:
1. Caminho feliz. A entrada da coordenação com segundo fator continua chegando ao Painel, e o segredo usado é o que a tela mostrou.
2. Borda: a configuração recebe um 401 por um tempo e a fixture tem de ler a resposta pelo status, esperar e pedir de novo.
3. Borda: o código da entrada é recusado por um tempo e a fixture tem de esperar e digitar o código de novo.
4. Borda: a ativação é recusada uma vez. Esse caso já existia e agora a fixture espera antes de repetir.
5. Falha certa: se a recusa continua depois das esperas, a fixture falha dizendo o que recebeu, em vez de esperar o Painel até o fim do prazo.
6. Divisão do caso feito à mão: os quatro casos novos não podem perder nenhuma prova do original. Precisam continuar provados o segredo em texto, a cópia, nada no armazenamento do navegador, os códigos de recuperação vistos uma vez, a tela do código (`autocomplete`, `inputmode`, 360 px, axe, 44 px) e a chegada ao Painel.
7. Permissão, isolamento e concorrência não se aplicam: a correção muda só a fixture e o spec, sem código de produto. Por isso não há mutação, e o motivo está escrito no documento da correção.

Cobertos:
- **Item 2:** `e2e/mfa.spec.ts:201`. A rota recusa no relógio monotônico (`recusarPorUmTempo`), o caso afirma `pedidos() === 2` e confere que a tela mostra o segredo devolvido.
  - Sem a correção, a fixture do HEAD lê o corpo do 401 e dá `segredo` indefinido. O `toContainText(undefined)` e o `TypeError` deixam o caso vermelho sem depender de sorte.
  - Uma repetição sem espera cai dentro do 1 s de recusa e leva a três pedidos, ou à falha "recusou 3 vezes".
- **Item 3:** `e2e/mfa.spec.ts:215`, com o mesmo molde, mais a URL do Painel e `pedidos() === 2`.
- **Item 4:** `e2e/mfa.spec.ts:180`, sem mudança de asserção.
- **Item 5:** os `throw` de `pedirOSegredo`, `digitarOCodigoDaEntrada` e `ativarOSegundoFator` em `e2e/support/casca.ts`.
- **Item 6:** `e2e/mfa.spec.ts:42`, `:70`, `:117` e `:130`.
  - O elo entre a tela e a conta, que antes era a entrada pela tela com o segredo copiado, agora é a chamada à API com o código do passo seguinte em `:107-113`. O caso `:130` prova a entrada pela tela, com o segundo fator configurado pela API. Nada se perdeu.
- Conferi as duas telas, `apps/web/src/pages/Mfa.tsx:44` e `apps/web/src/pages/ConfigurarMfa.tsx:104`. As duas limpam o aviso ao enviar, então o `poll` e o `.or()` da fixture não leem o aviso da tentativa anterior.
- Os nove arquivos que usam `entrarPelaTelaComSegundoFator` e `entrarComoCoordenacaoPeloConvite` esperam todos sucesso. Nenhum depende de a recusa ficar na tela, que agora seria repetida.
- Não há `.skip`, `.only`, teste comentado, mock da coisa testada, nem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações:
1. **Texto do documento que ficou velho.** Em `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md:78`, o caso "configura copiando o segredo…" aparece em "Fica de fora". Na linha 88, a frase "que a correção não toca" fala do mesmo caso. Esse caso não existe mais: a linha 72 conta que ele foi dividido em quatro. Vale atualizar as duas linhas para a validação e a retro não lerem uma contradição.
2. **Duração dos quatro casos.** A linha 90 do mesmo documento diz que as durações "oscilam de 9 a 34 s". Isso é ambíguo diante do prazo de 30 s e da metade dele, 15 s, que o portão cobra. Falta dizer quanto cada um dos quatro casos levou rodando sozinho, e se o último portão já rodou sobre a divisão final. O que o item 7 da seção "Portão" registra é a divisão em três.
3. **Nomes dos casos.** Os casos `e2e/mfa.spec.ts:201` e `:215` dizem "porque o Redis de fila não respondeu", mas a causa que eles simulam é o desafio emitido com o horário à frente do relógio da API. O documento reconhece isso. Um nome com "o desafio recusado por um tempo" evitaria a leitura errada.
4. **Saída que parece sucesso.** Em `e2e/support/casca.ts`, `digitarOCodigoDaEntrada` trata qualquer saída de `/mfa` como "entrou". Isso inclui a volta a `/entrar` quando a API gasta o desafio, depois de cinco erros (`CONTA_SEGURADA`) ou com o convite revogado (`NAO_ENCONTRADO`). Os chamadores conferem o Painel e o erro aparece lá, mas com uma mensagem menos clara. Uma alternativa é esperar sair de `/mfa` para uma rota diferente de `/entrar`.
5. **Ponto que fica de fora.** A chamada direta à API em `e2e/mfa.spec.ts:109-113` não tem nova tentativa e depende da folga de relógio já commitada em `649831ca`, que é o certo para um caso que prova a API. Vale uma linha no documento dizendo que esse ponto conta com a correção da folga.

Não rodei os testes de ponta a ponta: eles precisam dos serviços do compose e pesam na máquina. O portão da correção já os rodou, segundo o documento.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 12:23:06 · `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`

VEREDITO: APROVADO

**Cenários exigidos** (iguais aos da 1ª rodada, aprovada):
- (a) A configuração recusada por um tempo: o passo espera e pede o segredo de novo, com dois pedidos e não três, e a tela mostra o segredo devolvido.
- (b) O código da entrada recusado por um tempo: o passo espera, digita de novo e a coordenação entra, com dois pedidos.
- (c) A ativação recusada uma vez, caso que já existia.
- (d) A divisão em quatro do caso que andava a configuração e a ativação à mão, cada um abaixo da metade do prazo.

**Cobertos:**
- (a) `e2e/mfa.spec.ts:201`
- (b) `e2e/mfa.spec.ts:215`
- (c) `e2e/mfa.spec.ts:180`
- (d) `e2e/mfa.spec.ts:42`, `:70`, `:117` e `:130`

**O que foi conferido nesta rodada:**
- **O diff só mexe em títulos.** Em `e2e/mfa.spec.ts`, mudaram apenas os títulos de dois `test(`. Corpo, asserções e rota simulada (`recusarPorUmTempo`) ficaram iguais. O que a 1ª rodada aprovou continua valendo, e `e2e/support/casca.ts` não mudou.
- **O documento cita os testes pelo nome certo.** Os nomes que ele dá aos dois casos (linhas 50 e 51 de `tasks/correcoes/2026-11-08-segundo-fator-na-casca.md`) batem letra por letra com os títulos em `mfa.spec.ts:201` e `:215`. Procurei os títulos antigos em `e2e/`, `tasks/`, `docs/` e `tools/` e nenhum ficou para trás.
- **Nada no spec está pulado.** Não há `.skip`, `.only` nem `fixme` em `e2e/mfa.spec.ts`.
- **As recomendações da 1ª rodada foram aplicadas ou registradas.** A nota sobre o caso da ativação, que ainda tem "Redis" no nome, explica a diferença sem esconder nada. A minha recomendação 4 (a saída de `/mfa` em `digitarOCodigoDaEntrada`) está na tabela "Recomendações sem aplicar", com motivo e dono (retro da spec, Arquiteto). Isso basta, porque era recomendação e não bloqueante.
- **Mutações não se aplicam aqui.** A correção não cria cláusula de produto: mexe só na fixture e no spec. A folga de relógio continua guardada pelos testes de unidade de `649831ca`, como o documento agora diz.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em "Estabilidade", o documento diz que o último portão rodou antes dos dois renomeios. O portão desta rodada roda sobre a árvore atual e confirma isso sozinho; basta não citar aquela medida como prova do estado final.
2. A recomendação 4 da 1ª rodada (`digitarOCodigoDaEntrada`) segue registrada para a retro, sem mudança.
