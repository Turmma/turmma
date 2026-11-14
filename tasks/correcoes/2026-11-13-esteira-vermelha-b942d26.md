# Correção — esteira vermelha em b942d26: um teste que ficou com o teto antigo e dois e2e que dependem do que não semearam nem esperaram

**Origem:** esteira run 43534741262 (`gh run view 43534741262 --log-failed`), no commit `b942d266` (tarefa 9.0 de `ingestao-do-material`).
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `privacy-guardian`, `tenancy-guardian`, `conformidade-reviewer`
<!-- `infra-guardian` e `privacy-guardian` vieram no PEDIDO do Orquestrador; `test-engineer` é obrigatório em toda correção. `tenancy-guardian` e `conformidade-reviewer` entram porque os arquivos alterados
     (`apps/api/test/`, `e2e/`) pedem os quatro guardiões do PADRAO (`tools/processo/guardioes-por-caminho.ts`), como a Mesa apontou na DEVOLUÇÃO. -->

## Sintoma

Três casos vermelhos na mesma execução:

- integração: `apps/api/test/material-envio-orfao.int.test.ts` › "`LIMITE_EXCEDIDO` reconferido sob a trava: o objeto e a linha saem" recebeu `201` onde esperava `429` (linha 214).
- e2e (shard 10/11, projeto `celular`): `e2e/operacao-escolas.spec.ts:595`, "recomeço: reabrir o diálogo sorteia outro id…", `expect(lista.length).toBeGreaterThan(0)` recebeu 0 (linha 628). O retrato da página no traço mostra "Nenhuma escola ainda. Comece criando a rede.".
- e2e (shard 11/11, projeto `celular`): `e2e/tamanho-da-letra.spec.ts:110`, `toHaveURL(/\/entrar$/)` recebeu `/aluno/bem-vindo` (linha 63, `sairPelaLinha`), com "Test timeout of 30000ms exceeded".

## Fora desta correção

Nada: a árvore estava limpa (o PEDIDO diz "nenhum").

## Causa

A falha é da **tarefa 9.0** (`63a5de5a`) nos três casos, mas por três causas diferentes.

1. **Teto antigo escrito em número.** A 9.0 subiu `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA` de 3 para 300 (Tech Spec §7c) e
   trocou os testes que importam a constante, mas o caso de `material-envio-orfao.int.test.ts:205` enche o teto com o
   literal `3`. Com 3 linhas `processando` e o teto em 300, a conferência sob a trava não recusa, e o envio volta `201`. Não é
   intermitente: o caso falha sempre desde a 9.0. Os outros usos de `materiaisJaEnviados` já passam a constante.
   Ao trocar o `3` pela constante, as 300 linhas, se nascessem "agora" como as de antes, passariam também o teto de **100 por
   pessoa** na janela de uma hora, e o `429` sairia por esse teto, não pelo de processamento (o `LIMITE_EXCEDIDO` é o mesmo código). Por isso
   as linhas nascem enviadas há duas horas, fora da janela, como nos outros casos que enchem o teto (`material.int.test.ts:1030`).

2. **`operacao-escolas.spec.ts:595` lê uma lista que o caso não semeou.** O cabeçalho do arquivo diz que a lista é "de todas as
   escolas do banco de teste, que guarda as das outras suítes", e todo caso que lê a lista a semeia com `novoPainel(...)` ou a troca
   pela resposta que ele mesmo monta. Este é o único que não semeia: o `POST` de criar rede é abortado de propósito, e a lista que o
   caso "vê" é a que outro caso deixou no banco. Na esteira, cada job começa com o banco vazio (regra 40): no `celular` do shard 10 o caso rodou
   sem nenhuma escola criada ainda, a tela carregou **vazia** (não carregando: o retrato do traço mostra "Nenhuma escola ainda. Comece criando a rede.")
   e a asserção da linha 628 caiu. Na máquina de desenvolvimento o banco acumula escolas de outras execuções e o caso nunca caiu.

3. **`tamanho-da-letra.spec.ts:110` toca no "Sair" antes de a tela de Eu assentar.** Em Eu, a linha "Sair" fica logo abaixo de
   "Rever a introdução" (`Eu.tsx`), e acima delas está o aviso da turma: "Carregando a sua turma…" enquanto `GET /v1/minha-turma` não
   responde, e a mensagem de "sem turma no ano" quando ele devolve 404, que é o caso do aluno do teste (criado sem turma). As duas têm
   altura diferente. No traço da esteira, o `tap` em "Sair" começa em 11,75 s e o `404` de `minha-turma` (iniciado em 11,29 s, 622 ms
   de resposta) chega em ~11,9 s: a lista desce sob o dedo e o toque cai na linha de cima, "Rever a introdução", que leva a
   `/aluno/bem-vindo` (o retrato final é o "Passo 1 de 4" da introdução). O `expect` do `/entrar` espera então os 18 s que sobram dos 30 s
   do caso e cai. O teste supôs que a tela de Eu já estava parada quando o diálogo fechou; a consulta da turma só termina quando a
   máquina deixa.

## Teste que reproduz

1. `apps/api/test/material-envio-orfao.int.test.ts › o envio de material não deixa PDF para trás › \`LIMITE_EXCEDIDO\` reconferido sob a trava: o objeto e a linha saem`:
   o próprio caso. Vermelho antes, rodado isolado (`201` no lugar de `429`, igual ao da esteira); verde depois, com o arquivo inteiro (16 casos).
2. `e2e/tamanho-da-letra.spec.ts › o "Sair" da linha espera a turma assentar…` (caso novo): segura a resposta de `GET /v1/minha-turma`, pede a saída pela linha e confere, por evento, que a página não vai a `/entrar` (`waitForURL` com 800 ms, que
   tem de esgotar o prazo) e continua em `/aluno/eu`; solta a resposta e a saída vale. Sem a espera do `sairPelaLinha` (a linha que a correção acrescenta, tirada à mão), o caso fica
   **vermelho** (o `waitForURL(/\/entrar$/)` resolve e o `rejects.toThrow()` cai, `celular`; repetido na ordem da rodada 1); com ela, verde.
3. `e2e/operacao-escolas.spec.ts:595` ("recomeço: reabrir o diálogo…"): **sem vermelho local determinístico**: o banco do e2e da máquina já tem escolas de outras execuções, e o que fez o caso cair
   na esteira foi o banco vazio daquele shard. A evidência que substitui o vermelho é o retrato do traço da esteira ("Nenhuma escola ainda") e a causa acima; a prova da estabilidade, abaixo.

## Correção

- `material-envio-orfao.int.test.ts`: o caso enche o teto com `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA` (importado do service), não com `3`, e confere as mesmas 300 linhas no fim. As linhas
  nascem enviadas há duas horas (`enviadoHaMs`), para o `429` ser o do teto de processamento e não o de 100 por pessoa na janela (o service hoje confere o de processamento primeiro; as linhas fora da janela seguram a prova se a ordem mudar). O caso confere também o `Retry-After`
  (maior que zero e menor que a janela de uma hora): os dois tetos devolvem o mesmo código e só a espera os distingue, a do processamento é a de uma extração.
- `tamanho-da-letra.spec.ts`: `sairPelaLinha` espera o "Carregando…" de Eu sumir (`getByText(/^Carregando/)` com contagem 0, o padrão de `aluno-eu.spec.ts`) antes do toque; mais o caso novo, que prova esse ajudante e não uma regra da tela Eu (o comentário do caso diz isso).
- `operacao-escolas.spec.ts`: o caso semeia o painel (`novoPainel('nenhum')`, como o RF23 e o 14.4 do mesmo arquivo) e espera a lista não vazia antes de lê-la. Nenhuma asserção do caso foi afrouxada.

Nenhum código de produção mudou: só teste e e2e.

**Sem mutação:** a correção não altera arquivo de `apps/*/src` nem de `packages/*/src`.

**Estabilidade (correção de teste intermitente).** Os três casos de e2e (o novo, o `tamanho-da-letra:110` e o `operacao-escolas:595`) rodados com `--repeat-each 10 --workers 2`, nos dois projetos:
60 passaram, 0 falharam (6,8 min). O caso novo leva 13,5 s no máximo, abaixo dos 15 s do portão.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `material-envio-orfao.int.test.ts:207-208`: gravar as 300 linhas em lote no fixture, se o caso ficar perto do tempo do portão | Condicional, e o fixture `materiaisJaEnviados` é compartilhado por outros arquivos: fora desta correção. Se o portão da tarefa apontar o caso perto da metade do prazo, vira correção própria |
| test-engineer (1ª) | `operacao-escolas.spec.ts:631-632`: a leitura e a asserção depois do `expect.poll` repetem a verificação, podem ser enxugadas | Recusada: a correção afirma que nenhuma asserção do caso foi afrouxada, e `toBeGreaterThan(0)` é a original do caso. O ganho é só de estilo |
| test-engineer (1ª) | O vermelho de `operacao-escolas:595` não foi reproduzido na máquina; sairia rodando o caso sem o `novoPainel` sobre banco limpo (`EDUCA_BANCO_NOVO=1`) | Não é exigência do revisor: é evidência para a validação. Fica como está em "Teste que reproduz", item 3 |
| privacy-guardian (1ª), conformidade-reviewer (1ª) | Só repetem que a janela de 800 ms é decisão do `test-engineer` | Coberta pelo item 3 |
| test-engineer (2ª) | `e2e/tamanho-da-letra.spec.ts:92`: trocar `.rejects.toThrow()` por `.rejects.toThrow(/Timeout 800ms/)`, como em `e2e/guardas.spec.ts:215`, para passar só pelo prazo esgotado | Não aplicada: recomendação de revisor que aprovou na 2ª rodada (as recomendações entram em ordem uma vez por documento, na 1ª); o caso só prova um ajudante do e2e e o erro que passaria sem o motivo não derruba a esteira. Destino: retro da correção |
| test-engineer (2ª) | `e2e/tamanho-da-letra.spec.ts:92`: a prova de "não aconteceu" ainda depende de janela de 800 ms; contar `framenavigated` até o `soltar()` seria mais firme | Retro da correção (o próprio revisor a registrou "para a retro"); não bloqueia, o caso testa um ajudante do e2e |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 23:00:52 | 2026-11-13 23:01:05 | `tenancy-guardian` | 1 | APROVADO | ab2711d2ddefe5d6c |
| 2026-11-13 23:00:50 | 2026-11-13 23:01:08 | `infra-guardian` | 1 | APROVADO | a2a637be233a283ef |
| 2026-11-13 23:00:53 | 2026-11-13 23:01:08 | `conformidade-reviewer` | 1 | APROVADO | ae66a7ac218a7c899 |
| 2026-11-13 23:00:51 | 2026-11-13 23:01:09 | `privacy-guardian` | 1 | APROVADO | a4472ab70135cd73d |
| 2026-11-13 23:00:49 | 2026-11-13 23:02:15 | `test-engineer` | 1 | APROVADO | a7b9cc394e1cfdd52 |
| 2026-11-13 23:15:18 | 2026-11-13 23:15:55 | `test-engineer` | 2 | APROVADO | ad90d938674a49b16 |
