# Correção — o login com segundo fator da coordenação, em `entrarComoCoordenacaoNaMesmaAba`, oscila sob carga

**Origem:** uso (os 5 portões da 4.0 de `acesso-e-convites`): 1 de 62 casos de `e2e/professores.spec.ts` caiu em cada portão, sempre no login da coordenação.
**Subagentes obrigatórios:** `infra-guardian`
<!-- Dito pelo PEDIDO do Orquestrador. `test-engineer` é de toda correção. A correção altera 2 arquivos fora de `tasks/` (`e2e/support/casca.ts` e `e2e/mfa.spec.ts`) e não toca `.github/`, `tools/ci/` nem `tools/processo/`: não passa do limite do passo 5 de `corrigir`. -->

## Sintoma

Em `e2e/support/casca.ts › entrarComoCoordenacaoNaMesmaAba`, um de três: `mfa/configurar` respondeu sem `segredo` (o `json()` da primeira resposta lida não trazia o campo); o código foi recusado; ou a aba ficou presa em `/mfa`.

## Fora desta correção

`apps/api/src/professores/professores.repository.ts`, `apps/api/src/professores/professores.service.ts`, `apps/api/test/convites-enviar.int.test.ts`, `apps/api/test/professores.int.test.ts`, `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts`, `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx`, `apps/web/src/areas/coordenacao/professores/Professores.test.tsx`, `apps/web/src/areas/coordenacao/professores/Professores.tsx`, `apps/web/src/areas/coordenacao/professores/api/professores.test.ts`, `apps/web/src/areas/coordenacao/professores/api/professores.ts`, `apps/web/src/areas/coordenacao/professores/professores-da-escola.test.ts`, `docs/interface.md`, `docs/roteiro-da-demonstracao.md`, `e2e/professores.spec.ts`, `e2e/support/seed.ts`, `packages/shared/src/professores/professores.test.ts`, `packages/shared/src/professores/professores.ts`, `tasks/prd-acesso-e-convites/4_task.md`, `tasks/prd-acesso-e-convites/cenarios.md`, `tasks/prd-acesso-e-convites/techspec.md`, `apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx`, `apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts`, `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts`, `e2e/professores-envio.spec.ts` (tarefa 4.0 em curso). Mais, das correções desta sessão: `packages/core/`, `apps/api/src/credencial/challenge*`, `apps/api/src/operacao/operador-challenge*`, `apps/api/test/professores.int.test.ts`, `tools/ci/fila-de-carga.test.ts`, `tools/ci/fixtures/usa-a-fila.ts`, `TODO.md` e os documentos de `tasks/correcoes/2026-11-08-*` que não são este. Ficam na árvore, fora da revisão e do commit desta correção.

**Sem mutação:** esta correção altera só `e2e/support/casca.ts` e `e2e/mfa.spec.ts`, código de teste; nenhuma linha de `apps/*/src` nem de `packages/*/src` muda. O código de produto que o portão acha na árvore (`apps/api/src/professores/`, `apps/web/src/areas/coordenacao/professores/`, `packages/shared/src/professores/`) é da tarefa 4.0 em curso, listada acima em "Fora desta correção", e leva o bloco de mutação no documento dela.

## Causa

Não é a API, e não é a 4.0. Foi preciso o segundo portão para ver: a primeira leitura (o Redis de fila lento, como na correção `2026-10-23-agentes-suspensao-intermitente`) estava
**errada**. O log dos serviços do portão não tem nenhuma linha `login.desafio_sem_redis`, e a recusa se repetia, o que a do Redis não faz.

O traço do caso que caiu (`professores.spec.ts:1158`, portão de 08/11, `trace.zip` do `test-results`) mostra, em ordem:

- `POST /v1/sessao/email` → 200, com o desafio `configurar_mfa` de `iat` **05:54:49**;
- `POST /v1/conta/mfa/configurar` → **401**, e o log da `api-1` diz que o pedido chegou às **05:54:47,69**; o botão "Tentar de novo" o repete 0,7 s depois, às 05:54:48,41, e dá o mesmo 401.

O desafio chegou à API com o `iat` 1,3 a 2 s **à frente do relógio dela**. `verifyChallenge` usa `jwtVerify` com `maxTokenAge` e sem `clockTolerance`: nesse caso o `jose` recusa o `iat` no
futuro, e a recusa é o `NAO_AUTENTICADO` de qualquer desafio inválido, sem dizer qual parte falhou (por desenho). Dois pedidos seguidos dentro do mesmo atraso dão o mesmo 401. A
repetição do passo seguinte, o código da entrada (`/v1/sessao/mfa`, outro desafio), tem a mesma exposição, e é o "preso em /mfa". A API não está errada: o desenho recusa de propósito, e a tela diz o que fazer.

**De onde vem a diferença de relógio eu não achei.** Em repouso os containers e o host concordam (medi `api-1`, `api-2` e o host; sem diferença além do ruído da própria medição), cem pares login/configurar
pela API, quatro trabalhadores, não deram um 401, e só o navegador sob o portão reproduz. O que se vê é que o relógio de parede anda desigual: no traço, 2,6 s entre ações do teste (relógio
dos timers) foram 1,1 s entre os pedidos correspondentes (relógio de parede), e na máquina há registro de relógio da VM adiantado (memória do Joaquim, 05/11). É a suposição que sustenta a correção; a
origem exata fica com o `infra-guardian`.

O defeito da **fixture** é o mesmo nos três passos de `entrarComoCoordenacaoNaMesmaAba`:

- **Configurar:** lia o corpo da primeira resposta de `/v1/conta/mfa/configurar`, qualquer que fosse o status, e o 401 não traz `segredo`. O erro aparecia dois passos adiante
  (`Secret.fromBase32(undefined)`): o "`mfa/configurar` sem segredo" do relato.
- **Ativar:** repetia uma vez, **na hora**, e batia na mesma recusa (a correção de outubro só foi vista contra o Redis).
- **Código da entrada:** clicava em "Entrar" e esperava o Painel por 20 s; a recusa deixava a aba em `/mfa`, sem dizer por quê.

O relógio do **código** não entra, pela leitura de `passoDoCodigo` e `avancarPassoDoMfa` (não medido): o de `+30` s é o do passo seguinte, a janela da API é de um passo para cada lado, e o gravado
na ativação é sempre menor. Uma recusa depois do código gravado (`consumo.consumir` em `#depoisDoCodigoCerto`) não se repete com o mesmo código; não foi vista e fica de fora.

## Teste que reproduz

`e2e/mfa.spec.ts`, dois casos novos ao lado do da ativação (que já existia, e que ficou como estava). Cada um prova **um passo** da fixture, exportado para isso (`pedirOSegredo`, `digitarOCodigoDaEntrada`), e não a entrada inteira, que com a espera passaria de metade do prazo do caso:

- `a configuração com o desafio recusado por um tempo: o passo da entrada do teste espera e pede o segredo de novo, e a tela mostra o que ele devolveu`
- `o código da entrada com o desafio recusado por um tempo: o passo da entrada do teste espera, digita o código de novo e a coordenação entra` (o segundo fator vem pela API; só este passo é pela tela)

A rota (`recusarPorUmTempo`) responde 401 `NAO_AUTENTICADO` a todo pedido no primeiro segundo, medido no relógio **monotônico** a partir do primeiro pedido (o de parede desta máquina recua e avança aos saltos, e medida por ele a recusa durava mais que a espera da fixture, que é de 3 s de parede), e depois deixa passar: é o desafio à frente do relógio da API. Cada caso afirma que houve **dois** pedidos, e por isso uma repetição
na hora, dentro da recusa, daria três. O primeiro afirma também que a tela mostra o segredo que o passo devolveu. (O caso da ativação, que já existia, diz "porque o Redis de fila não respondeu" no nome, do tempo em que se supôs essa causa; a recusa simulada é a mesma resposta, e os dois casos novos dizem só "o desafio recusado por um tempo".)

Vermelhos antes, com a fixture que lê pelo status e repete na hora (a versão intermediária desta correção): as duas mensagens exatas do portão, `A API recusou o segredo do segundo fator 2 vezes seguidas: status 401, 401` e `A API recusou o código da entrada 2 vezes seguidas`. Com a fixture do
HEAD pura, o primeiro dá o `TypeError` do segredo indefinido e o segundo, a espera do Painel esgotada em `/mfa`. Verdes depois, nos dois projetos.

## Correção

Só `e2e/support/casca.ts` e o spec; a API, a web e o compose ficam como estão.

- `pedirOSegredo`: lê a resposta de `configurar` pelo status. Com recusa, espera e clica em "Tentar de novo" (o segredo recusado nunca foi gravado, então não há dois) e lê a seguinte.
- `digitarOCodigoDaEntrada`: depois de "Entrar", espera sair de `/mfa` ou o aviso de recusa; com o aviso, espera e digita o código do passo de agora de novo.
- `ativarOSegundoFator`: passa a esperar também antes de repetir.
- `ESPERAS_ENTRE_TENTATIVAS_MS = [3 s, 5 s]` e `esperarParaRepetir`: até três tentativas por passo, com a espera **pelo `Date.now()`** (o relógio de parede que a API lê), e não por `setTimeout`, que nesta máquina
  pode andar o dobro dele. A terceira recusa falha dizendo os status ou o aviso da tela. `RECUSA_DA_ATIVACAO` passa a `RECUSA_DO_SEGUNDO_FATOR`.

- `entrarPelaTelaComSegundoFator` (o login de quem já tem o segundo fator, feito pela API): o código passa por `digitarOCodigoDaEntrada`, com a mesma espera e as mesmas três tentativas. Termina como antes: fora de `/mfa`, e o chamador confere a tela.
- `entrarComoCoordenacaoPeloConvite`: o segredo vem de `pedirOSegredo` (a leitura pelo status, no lugar do `json()` da primeira resposta) e o código da entrada, de `digitarOCodigoDaEntrada`.

- `mfa.spec.ts`, o caso à mão "configura copiando o segredo…" (25 s sozinho, para um teto de 30 s): sob a disputa de outra linha na máquina (load average de 12 a 23) estourou o teto no portão, e depois, já dividido em três, o primeiro deles ainda passou de metade do prazo (15,5 s no celular, limite 15 s). Dividido em **quatro** casos, sem afrouxar nenhum limite: (1) a configuração pela tela: o segredo em texto, copiado, nada dele no navegador, a tela cabe, passa no axe e o botão de ativar tem 44 px; (2) a ativação pela tela com o código do segredo, os códigos de recuperação vistos uma vez, e **a API aceitando, para a senha da conta, o código do passo seguinte do segredo que a tela mostrou** (o elo entre a tela e a conta); (3) a senha sozinha para na tela do código (atributos do campo, 360 px, axe, alvo de 44 px); (4) o código do aplicativo, do passo seguinte, entra e a coordenação abre no Painel (`entrarPelaTelaComSegundoFator`). Os dois últimos têm o segundo fator configurado pela API, como os outros casos do arquivo.

**O que continua provado:** o segredo é o que a tela mostra; o código é o do aplicativo, conferido pela API de verdade; o Painel é a chegada. Uma recusa que se repete depois de 8 s de espera, ou que
não é a do desafio (um código errado de verdade), segue falhando.

**Fica de fora, de propósito:**
- Os casos de `mfa.spec.ts` que andam o fluxo à mão (`setUpMfa`, "cinco códigos errados…" e o "ativa com o código do segredo…" que ficou da divisão, que ainda anda a configuração e a ativação pela tela), que têm o mesmo risco de ficar em `/mfa` e foram vistos oscilar uma vez cada nas rodadas de verificação desta correção. Provam a tela passo a passo, e repetir por baixo deles esconderia o que provam.
- A espera do Painel depois do login (`esperarPainel`, 20 s): sob 8 trabalhadores o pacote do Painel chega depois disso. É lentidão, e não recusa; o prazo do caso é de quem o escreve.
- O Redis de fila do compose (`appendfsync`) e o prazo de 2 s: `infra/`.
- A folga de relógio do desafio (`verifyChallenge` e o irmão do operador) é da correção `2026-11-08-desafio-com-folga-de-relogio`, que a trata em produto, com teste e mutação próprios. **Quem guarda a folga são os testes de unidade daquela correção (`649831ca`), e não este e2e**: as repetições e a espera da fixture daqui absorvem a recusa, e uma regressão da folga passaria em silêncio por eles. O caso (2) de `mfa.spec.ts` faz uma chamada direta à API, sem nova tentativa (a prova de que a API aceita o código do passo seguinte), e conta com essa folga já commitada.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | `digitarOCodigoDaEntrada` trata qualquer saída de `/mfa` como "entrou", inclusive a volta a `/entrar` (`CONTA_SEGURADA`, `NAO_ENCONTRADO`); esperar sair de `/mfa` para rota diferente de `/entrar` | Recusada nesta correção: muda a lógica de uma fixture que nove specs usam e pediria nova prova com 8 trabalhadores; os chamadores conferem o Painel e o erro aparece lá, só com mensagem menos clara. Retro da spec (dono: Arquiteto), se o erro confundir alguém |
| infra-guardian (1ª) | Registrar no `docs/runbook.md` que o host roda NTP e como conferir a deriva; alerta de deriva de relógio quando a infra for para mais de um host | `TODO.md`: já está na entrada "NTP nas instâncias da API, com um limite de diferença, em `docs/infra.md`" (correção `2026-11-08-desafio-com-folga-de-relogio`); nada a acrescentar |
| infra-guardian (1ª) | Contador interno, por motivo, da recusa do desafio (`iat` no futuro, expirado, sem a marca do Redis) | Retro da spec (dono: Arquiteto): é código de produto (`apps/api`), fora de uma correção que só toca fixture e spec |
| privacy-guardian (1ª) | Se o corpo de erro da API ganhar outro campo, conferir em `apps/api/test/error.int.test.ts` que `RECUSA_DA_API` segue igual ao corpo real, sem stack | Sem ação: condição que não existe hoje; quem mudar o corpo de erro passa pela revisão do `privacy-guardian` nessa tarefa |

## Estabilidade

Com 4 trabalhadores e a máquina disputada:
- os cinco casos de recusa de `mfa.spec.ts` (ativação, configuração e código da entrada), nos dois projetos: 90 de 90 (15 repetições) depois do ajuste da recusa simulada ao relógio monotônico (antes, 1 de 36 e 1 de 84 contaram três pedidos em vez de dois);
- os casos que vieram da divisão do caso à mão (em três, antes do último corte em quatro), com 8 trabalhadores e load average de 10 a 23 (outra linha na máquina), 2 repetições nos dois projetos: 7,6 a 8,4 s, 12,0 a 13,3 s e 14,5 a 15,4 s (sozinhos, 6 a 7, 11 a 12 e 11 a 12 s), todos verdes;
- o `mfa.spec.ts` inteiro, 6 repetições: 83 de 84 (o que caiu foi o caso da recusa de 2 s, ajustado em seguida); o caso à mão de antes da divisão ("configura copiando o segredo…") levou 24 a 26 s nas 12 vezes, dentro dos 30 s dele; ele deixou de existir no corte final, abaixo.

- os quatro casos do corte final, com 8 trabalhadores e a máquina disputada pela outra linha, 6 repetições nos dois projetos, com o `mfa.spec.ts` inteiro: 119 de 120, os quatro casos verdes; o que caiu foi `código de recuperação entra sem o aplicativo` (celular, 30,3 s, à espera do Painel), que a correção não toca e que é o caso da "lentidão, e não recusa" de "Fica de fora"; as durações com a carga oscilam de 9 a 34 s. **Cada caso, sozinho** (2 trabalhadores, na fila de carga, chromebook e celular): (1) a configuração, 6,5 e 7,1 s; (2) a ativação com a conferência da API, 10,3 e 11,0 s; (3) a senha sozinha para na tela do código, 5,7 e 6,9 s; (4) o código do aplicativo entra, 11,2 e 11,8 s; todos abaixo da metade do prazo de 30 s (15 s) que o portão cobra. O último portão (84 casos de e2e verdes e carimbo) rodou sobre esta divisão final de quatro casos, antes dos dois renomeios da rodada 1, que só mudam o título (o corte tira da primeira metade o que o portão cobrava: a cópia do segredo, o armazenamento e a primeira checagem de axe).

Com 8 trabalhadores (`--workers=8`), na fila de carga:
- `professores.spec.ts` e `professores-envio.spec.ts`, 2 repetições: 124 de 124; 3 repetições, depois dos ajudantes de convite e de `entrarPelaTelaComSegundoFator`: 186 de 186;
- os oito specs que usam esses dois ajudantes (`areas`, `analista`, `coordenacao-introducao`, `material`, `grade-e-calendario`, `privacidade`, `governanca`, `importar-alunos`) mais `mfa.spec.ts`, uma vez: 201 de 202. O que caiu foi `areas.spec.ts:260` (`page.goto` passou de 30 s com 8 trabalhadores), que não usa login com segundo fator.

## Portão

O portão de uma correção roda sobre a árvore inteira, e os arquivos da 4.0 (`professores.spec.ts` entre eles) entram nos alvos. Oito rodadas de `portao-local.ts --tarefa` nas três correções que vieram antes desta (folga, professores-int, fila) e neste documento mostraram, uma por vez:

1. A fixture intermediária (repetição na hora) deixou cair os dois casos de `professores.spec.ts` que esta correção resolve; foi o que mostrou que a causa não era o Redis.
2. Unidade e tipos verdes, e a integração caiu em dois casos de `professores.int.test.ts` (relógio que recua), tratados em `2026-11-08-professores-int-sem-relogio`.
3. A unidade caiu em `tools/ci/fila-de-carga.test.ts` (sobreposição medida em `Date.now()`), tratada em `2026-11-08-fila-de-carga-sem-relogio`.
4. A duração do e2e: o caso `professores.spec.ts:1069` (da 4.0) levou 48 s contra 45 s. Encurtado na árvore (o segundo fator de B pela API e o endereço pelo histórico do roteador), sem commit.
5. `professores.spec.ts:745` caiu por lentidão do login sob carga, o que levou a tratar também `entrarPelaTelaComSegundoFator` e `entrarComoCoordenacaoPeloConvite` (acima) e a provar os specs com 8 trabalhadores antes do portão seguinte.
6. As mutações da folga, recusadas por nome de caso que o filtro `-t` do Vitest (uma expressão regular) não casava: corrigidas na correção da folga.
7. `mfa.spec.ts:42` (celular) levou 15,5 s contra 15,0 s, no portão da fila: o primeiro dos três casos da divisão (a divisão em três). Dividido de novo em dois, na árvore, ficando quatro casos (acima), e o portão seguinte já rodou sobre os quatro.
8. `professores.spec.ts:257` (W4, chromebook, 22,7 s) caiu uma vez em "Carregando os professores…" não visível em 20 s. Não reproduziu em 16 repetições só dele nem em 128 do arquivo inteiro com 8 trabalhadores, e passou no portão seguinte; o contexto do erro se perdeu (apaguei `test-results` ao rodar de novo). O diff da 4.0 não toca o ramo `professores.isPending` nem as opções da consulta.

O carimbo desta correção é o do portão da própria árvore; o commit leva só `e2e/support/casca.ts`, `e2e/mfa.spec.ts` e este documento.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 12:06:50 | 2026-11-08 12:07:05 | `tenancy-guardian` | 1 | APROVADO | a7baf2ed2dcdda7aa |
| 2026-11-08 12:06:43 | 2026-11-08 12:07:15 | `infra-guardian` | 1 | APROVADO | a8b43886af008bd0e |
| 2026-11-08 12:06:55 | 2026-11-08 12:07:16 | `privacy-guardian` | 1 | APROVADO | a1f54328d81328908 |
| 2026-11-08 12:06:59 | 2026-11-08 12:07:16 | `conformidade-reviewer` | 1 | APROVADO | a5dd54769ff556b84 |
| 2026-11-08 12:06:48 | 2026-11-08 12:08:26 | `test-engineer` | 1 | APROVADO | a7cfa3a17068b281c |
| 2026-11-08 12:22:42 | 2026-11-08 12:23:06 | `test-engineer` | 2 | APROVADO | a772f3d07b9f74cd9 |
