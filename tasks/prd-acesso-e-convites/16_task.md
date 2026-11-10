# Tarefa 16.0 — A tela "Conta da escola na sala"

**Funcionalidade:** acesso-e-convites · **Depende de:** 14.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

Na página da sala, o aluno escolhe "Entrar com a conta da escola", prova a conta e envia o pedido do nome sem criar senha; depois da aprovação, entra por ela.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (Conta da escola na sala) e "E2E (RF18)"
- `prd.md` RF14, RF18
- `.claude/rules/50`
- `apps/web/src/pages/TurmaPublica.tsx`

## Subtarefas

- [x] 16.1 — O botão e o retorno do provedor na sala
- [x] 16.2 — Os estados
- [x] 16.3 — `docs/interface.md`
- [x] 16.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passo 10) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 16.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/TurmaPublica.tsx` | alterado |
| `apps/web/src/api/sala.ts` | alterado |
| `docs/interface.md` | alterado |
| `e2e/conta-da-escola-na-sala.spec.ts` | novo |
| `infra/k6/reivindicacao-em-sala.js`, `infra/scripts/carga-sala.ts`, `infra/scripts/conferir-carga-sala.ts`, `infra/compose.carga.yml`, `infra/oidc-falso/config.json`, `infra/test/carga-sala.test.ts` | alterados (ordem de correção, item 2: o cenário de carga ganha o acesso pela conta da escola) |
| `docs/runbook.md`, `docs/lgpd.md` | alterados (ordem de correção, itens 3 e 10) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| reivindicar com o `oidc-falso` → aprovação → entra pela conta | e2e | RF14 de ponta a ponta | `e2e/conta-da-escola-na-sala.spec.ts` › "com a conta provada, o pedido do nome sai sem senha…" (a ida, o pedido sem senha e a conta no banco); "aprovado o pedido de conta, a aprovação tira a conta do pedido e cria o aluno na turma"; "aprovado o pedido de conta, o aluno entra pela conta da escola, sem matrícula nem senha" |
| enviado | e2e | "Pedido enviado. Espere o professor aprovar" | `e2e/conta-da-escola-na-sala.spec.ts` › "com a conta provada, o pedido do nome sai sem senha…" (o foco no título, o texto da espera e nada do pedido na tela); unidade: `TurmaPublica.test.tsx` › "o pedido do nome sai com o token…" |
| cookie vencido (`ENTRADA_INVALIDA`), `REIVINDICACAO_RECUSADA`, rede | e2e | os textos de "Telas" | `e2e/conta-da-escola-na-sala.spec.ts` › "a conta que o servidor não reconhece (cookie vencido ou ausente)…"; "a rede que cai ao abrir a sala pela volta mostra \"Tentar de novo\"…; a recusa do nome segue sem senha…"; unidade: `TurmaPublica.test.tsx` › "o servidor recusa a conta", "com a senha, o `ENTRADA_INVALIDA`…", "a recusa do pedido" |
| domínio não liberado, pela sala | e2e | volta à entrada da escola com o texto de `CONTA_EXTERNA_NAO_LIGADA`, nenhum pedido gravado, a sala não é alcançada | `e2e/conta-da-escola-na-sala.spec.ts` › "domínio não liberado: a recusa volta à entrada da escola com o texto dela…" |
| o caminho guardado | e2e | o token do link sobrevive à ida ao provedor e o pedido sai sem senha; lido e apagado na primeira renderização (o colega na mesma aba não o herda); vencido (relógio falso, 16 min) ou de outro slug: "Comece de novo pelo link ou pelo código da sala", sem chamada | `e2e/conta-da-escola-na-sala.spec.ts` › "o aluno clica no botão, prova a conta no provedor e volta à sala…" (apagado na volta, `localStorage` vazio); "com a conta provada, o pedido do nome sai sem senha, com o token que atravessou a ida…"; "o caminho guardado há 16 minutos venceu…"; "o caminho guardado de outra sala não vale…"; "o botão, ocupado ao clicar…" (o que a tela grava: slug, tipo, token e hora); unidade: `caminho-da-sala.test.ts` (15 min, tamanhos, forma exata) |
| carregando | e2e | "Entrando…" | `e2e/conta-da-escola-na-sala.spec.ts` › "o botão, ocupado ao clicar (\"Entrando…\")…" |
| nada do provedor na tela | e2e | sem e-mail, nome ou foto | `e2e/conta-da-escola-na-sala.spec.ts` › "com a conta provada, o pedido do nome sai sem senha…" (a tela, o armazenamento, o pedido e os endereços da API, para os três dados da aluna no provedor) |
| recomeço: o colega no mesmo computador | e2e | nada do anterior | `e2e/conta-da-escola-na-sala.spec.ts` › "voltar do provedor de novo, na mesma aba…"; "depois do pedido da conta, \"Voltar à lista de nomes\" é o formulário de matrícula e senha…" |
| recomeço: voltar do provedor de novo | e2e | parâmetro fora da barra | `e2e/conta-da-escola-na-sala.spec.ts` › "voltar do provedor de novo, na mesma aba: o parâmetro já saiu da barra, o caminho foi usado uma vez…" |
| recomeço: erro | e2e | o aviso sai na nova tentativa | `e2e/conta-da-escola-na-sala.spec.ts` › "a conta que o servidor não reconhece…; o código novo abre a sala e o aviso sai" |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | `e2e/conta-da-escola-na-sala.spec.ts` › "o botão, ocupado ao clicar…, a 360 px sem rolagem horizontal e com alvo de 44 px" (nos dois projetos); "sem sessionStorage a tela não sai…" |

## Como testar

- Precedente: `e2e/entrar-na-escola.spec.ts` › "aluno sem ligação volta ao endereço da escola orientado a usar a matrícula, e o parâmetro da falha some da barra" (o formulário do `oidc-falso`, linha 53); `e2e/convidar-alunos.spec.ts` (a sala)
- Domínio não liberado: o mesmo caso de `entrar-na-escola.spec.ts` (linha 240), começando pela sala; a sala não trata esse texto (divergência da 16.0, `cenarios.md` "Telas")
- Caminho guardado: `cenarios.md`, "Conta da escola do aluno", o [E] do `sessionStorage`; techspec §9, último parágrafo. O `CONFLITO` não entra na sala
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/conta-da-escola-na-sala.spec.ts`
- Telas: `aluno`, `/e/:slug/turma` (`apps/web/src/paths.ts:193`) › "Entrar com a conta da escola"

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Entrando…" já aparece em `e2e/`? Sim, em `entrar.spec.ts` (a rajada das 7h30) e `tokens.spec.ts`: é o botão da entrada da escola, outra página, que a tarefa não toca; na sala o texto é do spec novo (o `Ligando…` da 15.0 é outro texto).

**O plano.** O caminho da sala (o token do link ou o código digitado) é guardado por `caminho-da-sala.ts` no `sessionStorage` da aba, numa chave só (`educa.caminho-da-sala`: slug, tipo, valor e hora), lido sem apagar, vencido em 15 min e de um slug só (divergência da 16.0, `cenarios.md` "Conta da escola do aluno"). `ContaDaEscolaNaSala.tsx` (novo) é a seção "Tem a conta da escola?" com um botão por provedor liberado: no clique guarda o caminho e navega a `enderecoParaProvarAContaNaSala` (`api/salas.ts`: o `iniciar` com `intencao=reivindicar` e o token ou o código); sem armazenamento, não sai e avisa. `TurmaPublica.tsx` ganha `comecar` (o link no fragmento vence; `?conta=provada` mais o caminho guardado abrem a sala com `conta`; sem o caminho, o campo do código com "Comece de novo pelo link ou pelo código da sala" e a API não é chamada), `tirarAContaDaBarra` e o efeito que apaga fragmento, parâmetro e caminho na primeira renderização, e a etapa leva `conta`: sem campo de senha, o pedido sem `senha`, a confirmação "Conta da escola confirmada…" no lugar do botão, `ENTRADA_INVALIDA` sem senha vira o aviso de recomeço, e "Pedido enviado" com o texto da espera. Testes: unidade (`caminho-da-sala.test.ts`, `TurmaPublica.test.tsx`, `salas.test.ts`) e e2e (`conta-da-escola-na-sala.spec.ts`, 13 casos nos dois projetos). `docs/interface.md` §11.3 e `docs/lgpd.md` (a linha do caminho no `sessionStorage`) na mesma tarefa.

1. **Mutação de cada cláusula:** uma por linha de condição do diff, na seção "Mutações" (53 blocos aplicados e rodados antes do pedido, um por termo: o `token` no fragmento e o `conta: false` dele, `voltou`, o caminho ausente e o foco, o `has` do parâmetro, o `!conta` da recarga por código, o ramo `abrindo` de `abrir`, o efeito, o `falhou` e o `conta` da nova tentativa, `PedidoEnviado`, o `nomes.length > 0 &&` da seção da conta e o do bloco da conta confirmada (cada um com o caso da sala sem nome livre, que espera o `ACESSO` antes de conferir a ausência), `senhaDoPedido` e o reenvio com a mesma chave, o `ENTRADA_INVALIDA` com e sem `conta`, o campo de senha, o texto da espera; no botão, o `pageshow` (o `persisted` e o `apagarCaminhoDaSala()` da página restaurada), o `disabled={entrando}`, o `?? []`, a lista vazia, o `guardado`, o aviso, o rótulo ocupado e o por provedor; no endereço, o ramo do código e a codificação; no caminho, cada termo da forma exata e os dois limites).
2. **Texto na tela:** "Tem a conta da escola?", "Entrar com a conta da escola", "Entrando…", "Entrando com a conta da escola…", "Conta da escola confirmada…", "Comece de novo pelo link ou pelo código da sala" e o aviso sem armazenamento só existem na sala, e `grep -rln` em `e2e/` acha só o spec novo (menos o "Entrando…", que `entrar.spec.ts` e `tokens.spec.ts` usam no botão da entrada da escola, e que a tarefa não mexe). O texto que a tarefa tirou de `apps/web/src`: nenhum (o "Pedido enviado" ganhou um ramo, o de hoje não mudou). Os specs que passam pela sala (`turma-publica`, `entrar-na-escola`, `casca`, `roteiro-da-demonstracao`) rodaram isolados: 94 casos verdes.
3. **O segundo dado:** a sala tem **dois** nomes livres e o acesso tem link e código; o caminho guardado de **outro** slug e o de 16 min; dois provedores liberados (um botão cada, com o nome); escola sem provedor; o `?conta=outra`; o fragmento novo com um caminho guardado antigo (o link vence); o mesmo pedido reenviado depois de "sistema cheio" (a mesma chave) e com a matrícula mudada (outra).
4. **Checagem anterior que responde antes:** o `ENTRADA_INVALIDA` de conta e o de senha têm casos separados (com a senha, é erro de campo e a tela do formulário); o caminho vencido ou de outro slug cai antes da chamada à API, e o caso confere que `/v1/salas/abrir` nem é chamada; os casos do aviso de recomeço não passam pelo ramo do `NAO_ENCONTRADO`.
5. **A asserção olha o resultado:** o corpo do pedido (sem `senha`, com `token` ou `codigo`, com a chave), o que o `sessionStorage` e o `localStorage` guardam (chave única e vazio), a barra de endereço, o foco, o banco (um pedido pendente com a conta no lugar do hash e o identificador opaco) e a varredura dos três dados da aluna no provedor na tela, no armazenamento, no pedido e nos endereços da API.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo.
7. **Comentário que afirma o que o código não faz:** conferidos os docblocks de `caminho-da-sala.ts` (gravar no clique, ler sem apagar, apagar no efeito), de `comecar`, de `enderecoParaProvarAContaNaSala` (o token na consulta da navegação e o `Referrer-Policy: no-referrer` da 14.0) e o do spec (o comentário dos 15 s diz o que cada ida ao provedor custa e por que os casos semeiam o caminho).
8. **Divergência que cria regra:** a linha de "Divergências" abaixo está na `techspec.md` §5 (o `educa_conta_provada` e a volta à sala) e §9 (o último parágrafo: o caminho no `sessionStorage`), no `cenarios.md` ("Telas", a linha da sala, e "Conta da escola do aluno", o [E] do caminho) e em `docs/lgpd.md` (a linha "Caminho da sala no navegador"); `grep -n 'sessionStorage\|conta=provada' techspec.md cenarios.md` acha cada termo.
9. **Peça que já existe:** `readFragmentToken`, `clearFragment`, `acessoDaEscolaQueryOptions` (a leitura anônima dos provedores), `Button`, `PasswordInput`, `LoadingState`, `mensagemDaSala`, `enviarComReenvio`; o `Caminho` já era da página, e só mudou de arquivo. Nada copiado.
10. **Operação simultânea:** o clique duplo no botão (o `disabled={entrando}` tem bloco de mutação no unitário, e o e2e clica uma segunda vez, por `dispatchEvent`, com o botão já desabilitado: `idas` igual a 1), o envio do pedido duas vezes (a mesma `chaveEnvio` no reenvio e outra com a matrícula mudada, no unitário), e a volta do provedor lida duas vezes pelo `StrictMode` (a leitura é pura, o efeito apaga).
11. **Isolamento:** a tarefa não toca repository nem rota. O caminho de outra sala não vale (caso de unidade e de e2e), e o pedido da conta vai com o slug da sala; o isolamento do pedido e da conta é da 14.0.
12. **Guardiões:** `frontend-reviewer` (360 px, 44 e 24 px, `inputmode` e rótulos do formulário que já existiam, os quatro estados da seção, o foco, token fora de `localStorage` e da URL da barra, que só leva o `?conta=provada` e sai na primeira renderização), `privacy-guardian` (nada do provedor na tela, na barra, no armazenamento, no pedido e no log; o token da sala no `sessionStorage` e na consulta da navegação ao `iniciar`, declarados em `docs/lgpd.md`; o e-mail, o nome e a foto que o provedor devolve nunca chegam à web), `test-engineer` (a tabela com o caso de cada linha, a mutação de cada termo, o e2e dentro dos 15 s por caso).

## Fora do escopo desta tarefa

A API (14.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A sala trata o que a API da 14.0 devolve (opção A da triagem do Arquiteto, `e4bcc16b`): `ENTRADA_INVALIDA` (cookie vencido, ausente ou de outra sala) e o caminho guardado que falta ou venceu viram "Comece de novo pelo link ou pelo código da sala"; `REIVINDICACAO_RECUSADA`, limite, 503 e rede seguem os textos de hoje da sala, com "Tentar de novo"; o domínio não liberado, a conta pessoal, a ligada a desativado e a queda do provedor voltam à entrada da escola (`CONTA_EXTERNA_NAO_LIGADA`), e o `CONFLITO` não chega à sala: nasce na aprovação, na tela do professor | A API da 14.0 devolve a recusa de domínio na volta do provedor, antes de a sala existir, e o `CONFLITO` só existe na aprovação; mudar isso seria mudar a API e a techspec §5 | `techspec.md` §5 ("recusados como sempre") e §9; `cenarios.md` "Telas", linha "Conta da escola na sala"; `tasks/prd-acesso-e-convites/16_task.md`, tabela de testes |
| O caminho da sala (o token do link ou o código digitado) atravessa a ida ao provedor no `sessionStorage` da aba, numa chave só (`educa.caminho-da-sala`: slug, tipo, valor e hora); lido sem apagar (o `StrictMode` lê duas vezes), apagado no efeito da primeira renderização da sala, volte ou não o provedor; usado só com `?conta=provada`, no mesmo slug e em até 15 min; nunca em `localStorage` | O `#` do link nunca volta do provedor, e o pedido sem senha ainda manda `token` ou `codigo` no corpo; o token é o da sala (a turma toda o recebe), não o bilhete da troca do `cenarios.md:133`. A gravação falha (modo privado, bloqueio) e a tela não sai: avisa para usar a matrícula e a senha | `techspec.md` §9 (último parágrafo); `cenarios.md` "Conta da escola do aluno" (o [E] do caminho) e "Telas"; `docs/lgpd.md` (a linha "Caminho da sala no navegador") |
| O arquivo da tabela de "Arquivos previstos" é `apps/web/src/api/sala.ts`, que não existe: o código está em `apps/web/src/api/salas.ts` (`enderecoParaProvarAContaNaSala`) | Erro de nome no documento da tarefa; as outras peças da sala (`abrirSala`, `reivindicarNome`) já moram em `salas.ts` | `16_task.md`, "Arquivos previstos" (o arquivo é o mesmo, com outro nome) |
| Arquivos que a tarefa acrescenta além dos previstos: `ContaDaEscolaNaSala.tsx` e `caminho-da-sala.ts` (a seção e o caminho guardado, para `TurmaPublica.tsx` ficar sob o limite de complexidade da regra de lint), `caminho-da-sala.test.ts`, `TurmaPublica.test.tsx`, `salas.test.ts`, e em `e2e/support/seed.ts` as peças `pedidosDaTurmaNoBanco` e `trocarASenhaPelaContaNoBanco` (o pedido com a conta no lugar do hash, para o caso da aprovação) | O ratchet do lint não deixa a função da tela crescer, e o e2e precisa ler o pedido no banco e semear o pedido de conta sem passar por uma segunda ida ao provedor | `cenarios.md` "Conta da escola do aluno"; `docs/interface.md` §11.3 |
| O cenário de carga da sala entra na tarefa, e não só a tela (itens 2 das duas ordens da Mesa): o acesso por aluno, 1 em 20 pela conta no K1 e no K2, e a fase nova `k2_conta` (a escola da D48, cerca de 85% pela conta, com o aprovado entrando pela conta); o pico do `rl:ip` lido do Redis, com threshold de 80% do teto; e **`LIMITE_REQ_IP_ANONIMO_MIN` sobe de 3.000 para 6.000** (`.env.example`, `docs/infra.md` 5.1, `docs/runbook.md`) | A tela nova põe a leitura dos provedores e a ida ao provedor no balde por IP da escola, e a D48 faz da conta o caminho de todo dia: a previsão do primeiro dia (3.400 por minuto) passa dos 3.000, e o `k2_conta` mediu 3.678. É o desenho que o `docs/infra.md` 5.1 já tinha (limite alto o bastante para uma escola inteira atrás do NAT), aplicado à escola da D48; não muda `apps/api` | `techspec.md` §7c (a linha "A sala com a conta da escola"); `cenarios.md` "Carga"; `docs/infra.md` 5.1 e `docs/runbook.md` (o parágrafo do limite por IP); regra 80, itens 1 e 11 (o `oidc-falso` não é provedor pago); diagnóstico do Arquiteto em `.processo/ordens/diagnostico-16.md` |

## Carga (ordem de correção, itens 2 das rodadas 1 e 2)

O cenário `infra/k6/reivindicacao-em-sala.js` agora tem o acesso por aluno: cada um lê os provedores da escola (a seção "Tem a conta da escola?"), e quem pede pela conta prova a conta no `oidc-falso`, abre a sala de novo e manda o pedido sem senha; **depois de aprovado, entra pela conta**, como a web (`iniciar` sem intenção, `retorno` e `POST /v1/sessao/renovar`, com o mesmo sujeito da prova). Na escola sem Workspace (K1 e K2) é 1 aluno em 20; a fase nova **`k2_conta`** é a escola da D48 (a conta da escola, quando ela existe), com cerca de 85% pela conta (fora quem disputa o nome e quem erra a matrícula). O `respostas_429` é um contador próprio, com threshold zero em todas as fases; a disputa do mesmo nome repete o 503 do semáforo como a página (o `http.batch` não repetia, e dois "disputa sem vencedor" da primeira rodada vieram daí). O script de carga lê o pico do balde anônimo por IP (`rl:ip:<ip>`, sem o `rl:ip:op:` nem o `rl:ip-login:`) no Redis de cache a cada segundo e **reprova acima de 80% do `LIMITE_REQ_IP_ANONIMO_MIN`** que a API da carga recebeu; a conferência no banco exige uma sessão `externo` por aluno ligado. Comando: `npm run carga:sala -- --fases k1|k2|k2_conta`.

| Fase | Alunos | Pela conta | 5xx | 429 | Entraram pela conta | `decidir` p95 | Pico do `rl:ip` por minuto | Veredito |
|---|---|---|---|---|---|---|---|---|
| k1 | 210 | 10 | 0 | 0 | 10 de 10 | 373 ms | 154 de 6.000 (3%) | passou |
| k2 | 2.100 | 99 | 0 | 0 | 99 de 99 | 3.047 ms | 1.557 de 6.000 (26%) | reprovou só no `decidir` p95 (2.000 ms) |
| **k2, máquina calma** (10/11, 11:34, HEAD `5635f9ff`) | 2.100 | 99 | 0 | 0 | 99 de 99 (mais 2.001 pela matrícula: 2.100 no total) | **1.865 ms** (máx. 2.099 ms) | 1.684 de 6.000 (28%) | **passou** (login da outra escola p95 288 ms; 2.100 de 2.100 aprovados) |
| **k2_conta** | 2.100 | 1.782 (85%) | 0 | 0 | 1.782 de 1.782 | 1.700 ms | **3.678 de 6.000 (61%)** | **passou** |

**O teto subiu de 3.000 para 6.000.** A conta certa do balde anônimo (a do Arquiteto, em `.processo/ordens/diagnostico-16.md`): **3 requisições por aluno pela matrícula** (`abrir`, a leitura dos provedores, `reivindicar`; a entrada depois da aprovação, `POST /v1/sessao/matricula`, é rebaixada e vai para o `rl:ip-login`, que não recusa) e **9 pela conta** (`abrir`, provedores, `iniciar`, `retorno`, `abrir` de novo, `reivindicar`, e a entrada depois da aprovação: `iniciar`, `retorno` e `renovar`), mais 1 por código ou matrícula errados. A previsão do primeiro dia da D48 era de cerca de 3.400 por minuto, e o `k2_conta` mediu **3.678** (3.579 na primeira medição, com o medidor de uma página de `SCAN`; refeita em 10/11 com o cursor seguido até `'0'`): com os 3.000 de antes, a escola inteira atrás do NAT levaria `LIMITE_EXCEDIDO` no `abrir`, no `reivindicar` e no `retorno`. Com 6.000, o pico é 61% do teto, abaixo dos 80% (4.800) que o cenário cobra. As contas anteriores deste documento (1.700 por minuto, 4 e 7 por aluno) eram a soma de todas as rotas do k6 e estavam erradas para o balde; saíram dos documentos (`docs/infra.md` 5.1, `docs/runbook.md`, `techspec.md` §7c, `cenarios.md`). Nada em `apps/api` (a saída que mexe no `external-login.controller.ts` é a pergunta em aberto do `TODO.md`, para o Joaquim, antes do piloto), fora o `config.test.ts`, que confere o valor do `.env.example`.

**O `decidir` em lote de 40 do K2 (sem Workspace) passou de 2 s nas rodadas com a máquina dividida, também sem esta tarefa, e não é espera: é CPU negada às APIs de `cpus: 1`.** O K2 do HEAD (os arquivos de `infra/` de antes da 16.0) deu p95 de 2.090 ms; nas rodadas desta tarefa deu 2.088, 2.096 e 3.047, e em 10/11 mais 3.417 ms, com `educa-teste-1` e `educa-teste-2` de pé (throttling do cgroup de 36% a 39% no K2 contra 8% no `k2_conta`, o hash a 42 ms contra os 30 ms da calibração; diagnóstico em `.processo/ordens/diagnostico-k2-decidir.md`). Na 9.0 tinha medido 778 ms, em outra máquina. Não há timeout de cliente Redis, lock nem `statement_timeout` no caminho (o diagnóstico descarta cada um). **Repetido em 10/11 com a máquina calma** (as três linhas paradas, nenhum `educa-teste-N` de pé, pela fila de carga, correção `2026-11-10-k2-calmo`): hash com mediana de 29,7 ms (p90 de 32,2 ms; `@node-rs/argon2`, `m=19456, t=12, p=1`), e o K2 **passou, com `decidir` p95 de 1.865 ms** (máx. 2.099 ms; `k2_conta` na rodada anterior: 1.700 ms). O throttling do cgroup, lido em `cpu.stat` de `educa-carga-api-1-1` e `-2-1` no começo e no fim da rodada: **27,8% e 27,0% dos períodos** (127 s e 130 s de CPU negada em 6,6 min), contra os 36% a 39% de antes. **A conta não fecha em ~10% de throttling:** a máquina calma devolveu a CPU de referência do hash e tirou o K2 de 2 s, mas as duas APIs de uma CPU ainda são limitadas em mais de um quarto do tempo, e a folga do p95 é de 135 ms. É uma rodada só: o K2 passou, com folga de 135 ms no p95 e throttling de 27%.

## Mutações

`--faltando: 0 linhas (78 blocos, 0 motivos).` Os 78 blocos foram aplicados e rodados antes do pedido, com o mesmo `aplicarMutacao` e `comandoDoTeste` do portão (cada um sobre o arquivo de produção, rodando o caso citado no Vitest): todos ficaram vermelhos num caso que rodou e falhou. Todos rodam no unitário (`TurmaPublica.test.tsx`, `caminho-da-sala.test.ts`, `salas.test.ts`, e `infra/test/carga-sala.test.ts` para o cenário de carga: a regra de quem pede pela conta, o veredito do pico do balde, as chaves do balde, a conferência das sessões pela conta e o texto do k6); o e2e prova a jornada com o `oidc-falso`, que o unitário não alcança.

O medidor do balde (`medirOBaldeAnonimo` e a leitura do `SCAN` até o cursor voltar a `'0'`) é I/O contra o Redis da carga e não tem caso unitário: o que decide é a função pura `reduzirLeiturasDoBalde` (sem leitura, `undefined`; com leituras, o maior) e o `julgarFase` (pico não medido ou 0 reprova no `k2_conta`), cobertos pelos blocos abaixo; o laço de leitura só roda na rodada do cenário (`npm run carga:sala`), e o `--faltando` não lê `infra/`, por isso os blocos de `infra/` foram escritos linha a linha da ordem de correção.

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o link novo no fragmento vence a volta
-  if (token !== undefined) return { etapa: { nome: 'abrindo' }, foco: 0, abrir: { caminho: { tipo: 'link', token }, conta: false } }
+  if (token !== undefined) return { etapa: { nome: 'abrindo' }, foco: 0, abrir: { caminho: { tipo: 'link', token }, conta: true } }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o link novo no fragmento vence a volta
-  if (token !== undefined) return { etapa: { nome: 'abrindo' }, foco: 0, abrir: { caminho: { tipo: 'link', token }, conta: false } }
+  if (token === undefined) return { etapa: { nome: 'abrindo' }, foco: 0, abrir: { caminho: { tipo: 'link', token }, conta: false } }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › só o valor
-  if (!voltou) return { etapa: { nome: 'codigo', abrindo: false }, foco: 0, abrir: undefined }
+  if (voltou) return { etapa: { nome: 'codigo', abrindo: false }, foco: 0, abrir: undefined }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o aviso e o foco no código, a API nem é chamada
-  if (caminho === undefined) return { etapa: { nome: 'codigo', aviso: CONTA_PERDIDA, abrindo: false }, foco: 1, abrir: undefined }
+  if (caminho !== undefined) return { etapa: { nome: 'codigo', aviso: CONTA_PERDIDA, abrindo: false }, foco: 1, abrir: undefined }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o aviso e o foco no código, a API nem é chamada
-  if (caminho === undefined) return { etapa: { nome: 'codigo', aviso: CONTA_PERDIDA, abrindo: false }, foco: 1, abrir: undefined }
+  if (caminho === undefined) return { etapa: { nome: 'codigo', aviso: CONTA_PERDIDA, abrindo: false }, foco: 0, abrir: undefined }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › abre pelo token guardado
-  if (!endereco.searchParams.has(PARAMETRO_DA_CONTA_PROVADA)) return
+  if (endereco.searchParams.has(PARAMETRO_DA_CONTA_PROVADA)) return
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a rede que cai ao abrir a sala pelo código guardado
-        else if (caminho.tipo === 'codigo' && !conta) mostrarCodigo(mensagemDaSala(codigo, { caminho: 'codigo', esperaSegundos: esperaDoErro(erro), esgotado: true }))
+        else if (caminho.tipo === 'codigo') mostrarCodigo(mensagemDaSala(codigo, { caminho: 'codigo', esperaSegundos: esperaDoErro(erro), esgotado: true }))
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a rede que cai ao abrir a sala pelo código guardado
-      if (!recarga) definirEtapa(caminho.tipo === 'link' || conta ? { nome: 'abrindo' } : { nome: 'codigo', abrindo: true })
+      if (!recarga) definirEtapa(caminho.tipo === 'link' ? { nome: 'abrindo' } : { nome: 'codigo', abrindo: true })
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a rede que cai ao abrir a sala pelo código guardado
-      if (!recarga) definirEtapa(caminho.tipo === 'link' || conta ? { nome: 'abrindo' } : { nome: 'codigo', abrindo: true })
+      if (recarga) definirEtapa(caminho.tipo === 'link' || conta ? { nome: 'abrindo' } : { nome: 'codigo', abrindo: true })
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › abre pelo token guardado
-    if (comeco.abrir !== undefined) void buscar(comeco.abrir.caminho, ++contador.current, false, comeco.abrir.conta)
+    if (comeco.abrir === undefined) void buscar(comeco.abrir.caminho, ++contador.current, false, comeco.abrir.conta)
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › abre pelo token guardado
-    if (comeco.abrir !== undefined) void buscar(comeco.abrir.caminho, ++contador.current, false, comeco.abrir.conta)
+    if (comeco.abrir !== undefined) void buscar(comeco.abrir.caminho, ++contador.current, false, false)
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a rede que cai ao abrir a sala pelo código guardado
-      {etapa.nome === 'falhou' && <FalhaDoLink caminho={etapa.caminho.tipo} erro={etapa.erro} aoTentarDeNovo={() => void abrir(etapa.caminho, { conta: etapa.conta })} />}
+      {false && <FalhaDoLink caminho={etapa.caminho.tipo} erro={etapa.erro} aoTentarDeNovo={() => void abrir(etapa.caminho, { conta: etapa.conta })} />}
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a rede que cai ao abrir a sala pelo código guardado
-      {etapa.nome === 'falhou' && <FalhaDoLink caminho={etapa.caminho.tipo} erro={etapa.erro} aoTentarDeNovo={() => void abrir(etapa.caminho, { conta: etapa.conta })} />}
+      {etapa.nome === 'falhou' && <FalhaDoLink caminho={etapa.caminho.tipo} erro={etapa.erro} aoTentarDeNovo={() => void abrir(etapa.caminho, { conta: false })} />}
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o pedido do nome sai com o token
-      {etapa.nome === 'enviado' && <PedidoEnviado slug={slug} conta={etapa.conta} aoVoltar={() => void abrir(etapa.caminho)} />}
+      {etapa.nome === 'enviado' && <PedidoEnviado slug={slug} conta={false} aoVoltar={() => void abrir(etapa.caminho)} />}
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › abre pelo token guardado
-      {nomes.length > 0 && !conta && <ContaDaEscolaNaSala slug={slug} caminho={caminho} />}
+      {nomes.length > 0 && <ContaDaEscolaNaSala slug={slug} caminho={caminho} />}
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › abre pelo token guardado
-      {nomes.length > 0 && conta && (
+      {nomes.length > 0 && !conta && (
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › sala sem nome livre
-      {nomes.length > 0 && !conta && <ContaDaEscolaNaSala slug={slug} caminho={caminho} />}
+      {!conta && <ContaDaEscolaNaSala slug={slug} caminho={caminho} />}
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › conta provada com a sala sem nome livre
-      {nomes.length > 0 && conta && (
+      {conta && (
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › sala sem nome livre
-      {nomes.length === 0 ? (
+      {nomes.length !== 0 ? (
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o pedido do nome sai com o token
-    const senhaDoPedido = conta ? undefined : senha
+    const senhaDoPedido = senha
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o pedido da conta reenviado
-    const mesmoPedido = anterior !== undefined && anterior.listaNomeId === nomeEscolhido.id && anterior.matricula === matricula && anterior.senha === senhaDoPedido
+    const mesmoPedido = anterior !== undefined && anterior.listaNomeId === nomeEscolhido.id && anterior.matricula === matricula && anterior.senha === senha
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o pedido da conta reenviado
-      ? anterior
+      ? { ...anterior, chaveEnvio: crypto.randomUUID() }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o pedido do nome sai com o token
-      : { slug, ...noPedido(caminho), listaNomeId: nomeEscolhido.id, matricula, ...(senhaDoPedido === undefined ? {} : { senha: senhaDoPedido }), chaveEnvio: crypto.randomUUID() }
+      : { slug, ...noPedido(caminho), listaNomeId: nomeEscolhido.id, matricula, ...(senha === undefined ? {} : { senha }), chaveEnvio: crypto.randomUUID() }
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › com a senha, o
-    if (conta && codigo === ErrorCode.ENTRADA_INVALIDA) {
+    if (codigo === ErrorCode.ENTRADA_INVALIDA) {
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a recusa do pedido
-    if (conta && codigo === ErrorCode.ENTRADA_INVALIDA) {
+    if (conta) {
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › abre pelo token guardado
-      {!conta && (
+      {(
```

```mutacao
arquivo: apps/web/src/pages/TurmaPublica.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o pedido do nome sai com o token
-          ? 'Espere o professor aprovar. Até lá, entrar com a conta da escola diz que ela não está liberada. Não é erro: depois da aprovação você entra por ela.'
+          ? 'Espere. Até lá, entrar com a conta da escola diz que ela não está liberada. Não é erro: depois da aprovação você entra por ela.'
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o clique pelo link
-      if (!evento.persisted) return
+      if (evento.persisted) return
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o clique pelo link
-      apagarCaminhoDaSala()
+      void 0
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o clique pelo link
-          <Button key={provedor} variante="secundario" disabled={entrando} onClick={() => entrar(provedor)} className="w-full sm:w-auto">
+          <Button key={provedor} variante="secundario" disabled={false} onClick={() => entrar(provedor)} className="w-full sm:w-auto">
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › a leitura dos provedores que falha
-  const provedores = acesso.data?.provedores ?? []
+  const provedores = acesso.data?.provedores ?? ['google']
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › escola sem provedor liberado
-  if (provedores.length === 0) return null
+  if (provedores.length === -1) return null
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › sem sessionStorage a tela não sai
-    if (!guardado) return
+    if (false) return
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o clique pelo link
-      {semArmazenamento && (
+      {(
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o clique pelo link
-            {entrando ? 'Entrando…' : provedores.length === 1 ? 'Entrar com a conta da escola' : `Entrar com a conta ${NOME_DO_PROVEDOR[provedor]} da escola`}
+            {false ? 'Entrando…' : provedores.length === 1 ? 'Entrar com a conta da escola' : `Entrar com a conta ${NOME_DO_PROVEDOR[provedor]} da escola`}
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › escola com um provedor
-            {entrando ? 'Entrando…' : provedores.length === 1 ? 'Entrar com a conta da escola' : `Entrar com a conta ${NOME_DO_PROVEDOR[provedor]} da escola`}
+            {entrando ? 'Entrando…' : provedores.length === 2 ? 'Entrar com a conta da escola' : `Entrar com a conta ${NOME_DO_PROVEDOR[provedor]} da escola`}
```

```mutacao
arquivo: apps/web/src/pages/ContaDaEscolaNaSala.tsx
teste: apps/web/src/pages/TurmaPublica.test.tsx › o clique pelo link
-          {entrando ? 'Entrando com a conta da escola…' : ''}
+          {false ? 'Entrando com a conta da escola…' : ''}
```

```mutacao
arquivo: apps/web/src/api/salas.ts
teste: apps/web/src/api/salas.test.ts › o link leva o token
-  const sala = 'token' in caminho ? `token=${encodeURIComponent(caminho.token)}` : `codigo=${encodeURIComponent(caminho.codigo)}`
+  const sala = 'codigo' in caminho ? `token=${encodeURIComponent(caminho.token)}` : `codigo=${encodeURIComponent(caminho.codigo)}`
```

```mutacao
arquivo: apps/web/src/api/salas.ts
teste: apps/web/src/api/salas.test.ts › o que não é seguro
-  const sala = 'token' in caminho ? `token=${encodeURIComponent(caminho.token)}` : `codigo=${encodeURIComponent(caminho.codigo)}`
+  const sala = 'token' in caminho ? `token=${caminho.token}` : `codigo=${encodeURIComponent(caminho.codigo)}`
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o link volta como token
-    const valor = caminho.tipo === 'link' ? caminho.token : caminho.codigo
+    const valor = caminho.tipo === 'link' ? caminho.token : caminho.token
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o link volta como token
-    const bruto: unknown = texto === null ? undefined : JSON.parse(texto)
+    const bruto: unknown = texto !== null ? undefined : JSON.parse(texto)
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o que o armazenamento tem e não é o caminho
-    return typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : undefined
+    return typeof bruto === 'object' ? (bruto as Record<string, unknown>) : undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o valor tem o tamanho do contrato
-  if (tipo === 'link') return valor.length >= 1 && valor.length <= TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? { tipo, token: valor } : undefined
+  if (tipo === 'link') return valor.length >= 0 && valor.length <= TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? { tipo, token: valor } : undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o valor tem o tamanho do contrato
-  if (tipo === 'link') return valor.length >= 1 && valor.length <= TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? { tipo, token: valor } : undefined
+  if (tipo === 'link') return valor.length >= 1 && valor.length < TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? { tipo, token: valor } : undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o valor tem o tamanho do contrato
-  if (tipo === 'codigo') return valor.length >= 1 && valor.length <= TAMANHO_MAXIMO_CODIGO_DIGITADO ? { tipo, codigo: valor } : undefined
+  if (tipo === 'codigo') return valor.length >= 0 && valor.length <= TAMANHO_MAXIMO_CODIGO_DIGITADO ? { tipo, codigo: valor } : undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o valor tem o tamanho do contrato
-  if (tipo === 'codigo') return valor.length >= 1 && valor.length <= TAMANHO_MAXIMO_CODIGO_DIGITADO ? { tipo, codigo: valor } : undefined
+  if (tipo === 'codigo') return valor.length >= 1 && valor.length < TAMANHO_MAXIMO_CODIGO_DIGITADO ? { tipo, codigo: valor } : undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o que o armazenamento tem e não é o caminho
-  if (guardado === undefined) return undefined
+  if (false) return undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › a forma que não é exata não vale
-  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof valor !== 'string' || typeof em !== 'number') return undefined
+  if (doSlug !== slug || typeof valor !== 'string' || typeof em !== 'number') return undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › o caminho de outra sala não vale
-  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof valor !== 'string' || typeof em !== 'number') return undefined
+  if (Object.keys(resto).length > 0 || typeof valor !== 'string' || typeof em !== 'number') return undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › a forma que não é exata não vale
-  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof valor !== 'string' || typeof em !== 'number') return undefined
+  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof em !== 'number') return undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › a forma que não é exata não vale
-  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof valor !== 'string' || typeof em !== 'number') return undefined
+  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof valor !== 'string') return undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › vale por 15 minutos
-  if (!(idade >= 0 && idade <= VALIDADE_DO_CAMINHO_DA_SALA_MS)) return undefined
+  if (!(idade <= VALIDADE_DO_CAMINHO_DA_SALA_MS)) return undefined
```

```mutacao
arquivo: apps/web/src/pages/caminho-da-sala.ts
teste: apps/web/src/pages/caminho-da-sala.test.ts › vale por 15 minutos
-  if (!(idade >= 0 && idade <= VALIDADE_DO_CAMINHO_DA_SALA_MS)) return undefined
+  if (!(idade >= 0 && idade < VALIDADE_DO_CAMINHO_DA_SALA_MS)) return undefined
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › quem pede pela conta
-  return modo === 'quase_todos' ? ordem !== 2 : chegada % UM_EM_CADA_VIA_CONTA === 9
+  return modo === 'quase_todos' ? ordem !== 3 : chegada % UM_EM_CADA_VIA_CONTA === 9
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › quem pede pela conta
-  return modo === 'quase_todos' ? ordem !== 2 : chegada % UM_EM_CADA_VIA_CONTA === 9
+  return modo === 'quase_todos' ? ordem !== 2 : chegada % UM_EM_CADA_VIA_CONTA === 8
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › quem pede pela conta
-  if (disputa) return false
+  if (false) return false
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico do balde anônimo por IP acima
-  if (pico <= teto * FRACAO_DO_TETO_DO_BALDE) return undefined
+  if (pico < teto * FRACAO_DO_TETO_DO_BALDE) return undefined
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o balde anônimo é o
-  return chaves.filter((chave) => chave.startsWith('rl:ip:') && !chave.startsWith('rl:ip:op:') && !chave.startsWith('rl:ip:senha:'))
+  return chaves.filter((chave) => chave.startsWith('rl:ip:'))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o balde anônimo é o
-  return chaves.filter((chave) => chave.startsWith('rl:ip:') && !chave.startsWith('rl:ip:op:') && !chave.startsWith('rl:ip:senha:'))
+  return chaves.filter((chave) => !chave.startsWith('rl:ip:op:') && !chave.startsWith('rl:ip:senha:'))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico do balde anônimo por IP acima
-  if (!medido && ESCALA[fase].pelaConta === 'quase_todos') reprovacoes.push({ criterio: `${fase}:balde`, detalhe: `${fase}: o pico do balde anônimo por IP não foi medido` })
+  if (false) reprovacoes.push({ criterio: `${fase}:balde`, detalhe: `${fase}: o pico do balde anônimo por IP não foi medido` })
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico do balde anônimo por IP acima
-    else reprovacoes.push(...julgarFase(fase, resumo, picos.get(fase)))
+    else reprovacoes.push(...julgarFase(fase, resumo, undefined))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o `k2_conta` é a escola da D48
-        viaConta: pedePelaConta(escala.pelaConta, alunos.length, ordem, disputa),
+        viaConta: pedePelaConta('um_em_vinte', alunos.length, ordem, disputa),
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o `k2_conta` é a escola da D48
-  k2_conta: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'KC', pelaConta: 'quase_todos', primeiroDia: true },
+  k2_conta: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'KC', pelaConta: 'um_em_vinte', primeiroDia: true },
```

```mutacao
arquivo: infra/scripts/conferir-carga-sala.ts
teste: infra/test/carga-sala.test.ts › todo aluno que pediu pela conta
-  igual('entraramPelaConta', viaConta, 'alunos que entraram pela conta da escola:')
+  igual('entraramPelaConta', 0, 'alunos que entraram pela conta da escola:')
```

```mutacao
arquivo: infra/scripts/conferir-carga-sala.ts
teste: infra/test/carga-sala.test.ts › todo aluno que pediu pela conta
-  if (viaConta > 0 && contagem.entraramPelaConta === 0) reprovacoes.push(`${fase}: nenhum aluno entrou pela conta da escola depois de aprovado`)
+  if (false && contagem.entraramPelaConta === 0) reprovacoes.push(`${fase}: nenhum aluno entrou pela conta da escola depois de aprovado`)
```

```mutacao
arquivo: infra/k6/reivindicacao-em-sala.js
teste: infra/test/carga-sala.test.ts › a conta da escola é a do
-    if (pedido.numeroDaConta !== undefined) entrarPelaConta(pedido.numeroDaConta)
+    if (pedido.numeroDaConta === undefined) entrarPelaConta(pedido.numeroDaConta)
```

```mutacao
arquivo: infra/k6/reivindicacao-em-sala.js
teste: infra/test/carga-sala.test.ts › os thresholds do K1
-      respostas_429: ['count==0'],
+      respostas_429: ['count>=0'],
```

```mutacao
arquivo: infra/k6/reivindicacao-em-sala.js
teste: infra/test/carga-sala.test.ts › a disputa do mesmo nome repete o 503
-  for (let envio = 0; envio < REENVIOS_NO_503 && resposta.status === 503; envio++) {
+  for (let envio = 0; envio < REENVIOS_NO_503 && resposta.status === 502; envio++) {
```

```mutacao
arquivo: infra/k6/reivindicacao-em-sala.js
teste: infra/test/carga-sala.test.ts › a conta da escola é a do
-      ...(redisLento ? {} : { aprovado_entrou: [`count==${alunos - viaConta}`], aprovado_entrou_pela_conta: [`count==${viaConta}`], 'login_erro_final{grupo:aprovado}': ['count==0'] }),
+      ...(redisLento ? {} : { aprovado_entrou: [`count==${alunos - viaConta}`], aprovado_entrou_pela_conta: [`count>=${viaConta}`], 'login_erro_final{grupo:aprovado}': ['count==0'] }),
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o balde anônimo é o
-  return chaves.filter((chave) => chave.startsWith('rl:ip:') && !chave.startsWith('rl:ip:op:') && !chave.startsWith('rl:ip:senha:'))
+  return chaves.filter((chave) => chave.startsWith('rl:ip:') && !chave.startsWith('rl:ip:op:'))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o `k2_conta` é a escola da D48
-  k2_conta: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'KC', pelaConta: 'quase_todos', primeiroDia: true },
+  k2_conta: { turmas: 60, chegadaS: 300, esperaDosProfessoresS: 90, comOutraEscola: true, prefixo: 'KC', pelaConta: 'quase_todos', primeiroDia: false },
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico medido é o maior valor das leituras
-  return leituras.length === 0 ? undefined : leituras.reduce((maior, leitura) => Math.max(maior, leitura))
+  return leituras.length !== 0 ? undefined : leituras.reduce((maior, leitura) => Math.max(maior, leitura))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico medido é o maior valor das leituras
-  return leituras.length === 0 ? undefined : leituras.reduce((maior, leitura) => Math.max(maior, leitura))
+  return leituras.length === 0 ? undefined : leituras.reduce((maior, leitura) => Math.min(maior, leitura))
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico do balde anônimo por IP acima
-  const medido = doBalde !== undefined && doBalde.pico > 0
+  const medido = doBalde !== undefined && doBalde.pico >= 0
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico do balde anônimo por IP acima
-  if (doBalde === undefined) return reprovacoes
+  if (false) return reprovacoes
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: infra/test/carga-sala.test.ts › o pico do balde anônimo por IP acima
-  if (acima !== undefined) reprovacoes.push({ criterio: `${fase}:balde`, detalhe: acima })
+  if (acima === undefined) reprovacoes.push({ criterio: `${fase}:balde`, detalhe: acima })
```

```mutacao
arquivo: infra/k6/reivindicacao-em-sala.js
teste: infra/test/carga-sala.test.ts › os thresholds do K1
-  respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })
+  respostas429.add(resposta.status === 428 ? 1 : 0, { grupo })
```

```mutacao
arquivo: infra/k6/reivindicacao-em-sala.js
teste: infra/test/carga-sala.test.ts › a conta da escola é a do
-  const entrou = renovada.status === 200 && typeof renovada.json('token') === 'string'
+  const entrou = renovada.status === 201 && typeof renovada.json('token') === 'string'
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | A confirmação "Conta da escola confirmada…" usa a cor `pendente` (âmbar), a mesma de "espera"; um tom neutro ou de sucesso diria melhor | `TODO.md`. Troca de cor de uma tela, sem RF que a peça (os tokens passam no contraste, segundo o revisor), e mexer nela refaz as fotos |
| frontend-reviewer (1ª) | A foto `sala-pelo-link--cheia` mostra a onça esmaecida, talvez uma transição pega no meio | Validador: não é código desta tarefa; o Validador fotografa cada requisito com tela |
| frontend-reviewer (1ª) | As fotos usam nomes de seed como "Turma 2ºB 18ca6446" | Recusada: é o dado sintético da vitrine |
| frontend-reviewer (1ª) | O token do link vai na URL do `iniciar` e no `sessionStorage` por até 15 min | Recusada: assunto do `privacy-guardian`, que aprovou; está declarado em `docs/lgpd.md` e a resposta sai com `Referrer-Policy: no-referrer` |
| tenancy-guardian (1ª) | Confirmar que o log de acesso da API e do proxy não grava a query de `/v1/sessao/externa/*/iniciar` | Recusada nesta tarefa: é da 14.0 (a rota é dela) e o `privacy-guardian` aprovou a tarefa sem exigir isso |
| conformidade-reviewer (1ª) | Ligar um provedor na escola da vitrine para a validação ver o botão e o texto de espera | `TODO.md`: ajuste de `tools/vitrine/`, fora desta tarefa. O Orquestrador deve saber antes do `/validar`, porque o Validador fotografa cada requisito com tela e hoje a vitrine não mostra o botão nem a conta confirmada |
| conformidade-reviewer (1ª) | `docs/regulacao.md` não mudou, e não precisava | Sem ação: é constatação, não pedido |
| privacy-guardian (1ª) | Se o aluno larga o login na página do provedor, o caminho fica no `sessionStorage` até a aba fechar | Recusada: o prazo de 15 min já o descarta na leitura, o risco é baixo e está declarado em `docs/lgpd.md` ("vai embora com a aba"); o item 4 cobre o caso do "Voltar" |
| privacy-guardian (1ª) | `pedidosDaTurmaNoBanco` ordena por `id` e o comentário diz "do mais antigo ao mais novo" | Recusada: o `tenancy-guardian` conferiu que o id é `uuidv7`, então a ordem é cronológica |
| revisor-geral (1ª) | A cadeia RF14 do e2e é provada em pedaços: o pedido real, a aprovação semeada, a entrada (também `test-engineer` 1ª) | Retro da F2c: um caso que encadeie os três custa um e2e novo, e o mais lento mede hoje 14,2 s para o limite de 15 s |
| revisor-geral (1ª) | `ContaDaEscolaNaSala.tsx` é componente de seção e mora em `pages/`; conferir o padrão da 15.0 | Recusada: a 15.0 pôs `ContaDaEscola.tsx` em `apps/web/src/areas/aluno/`, ao lado de `Eu.tsx`, que é a tela dela; a sala é página pública e mora em `pages/`, ao lado de `TurmaPublica.tsx` |
| frontend-reviewer (2ª) | A onça sai translúcida na foto do computador (entrada de 240 ms capturada no meio) | `TODO.md`: a vitrine deve esperar a animação; o código da casca não mudou nesta tarefa |
| frontend-reviewer (2ª) | O título da turma aparece com o anel de foco e o sufixo hexadecimal do seed | Recusada: o foco é intencional e o sufixo é do dado sintético da vitrine |
| frontend-reviewer (2ª), conformidade-reviewer (2ª) | A "conta confirmada" e o texto de espera da aprovação não aparecem nas fotos | Validador: ele fotografa cada requisito com tela |
| conformidade-reviewer (2ª) | O provedor ligado na escola da vitrine vale só para as fotos da Mesa: o item de `TODO.md` ("Ligar um provedor na escola da vitrine") segue aberto | O item de `TODO.md` já existe; o Orquestrador precisa saber antes do `/validar` que a vitrine guardada ainda não tem o botão |
| tenancy-guardian (2ª), revisor-geral (2ª) | Liberar o provedor na carga por `PUT /v1/escola/provedores`, e não por `insert` direto em `provedor_escola` (`carga-sala.ts:443`) | `TODO.md`: o insert direto leva o `escolaId` da própria escola e não vaza; é fidelidade da carga, não defeito |
| test-engineer (2ª) | O e2e do clique duplo (`spec.ts:270-273`) espera um único quadro de animação antes de conferir `idas`; usar `expect.poll` | Retro da F2c: a trava `disabled` está provada no unitário pelo bloco de `disabled={entrando}` |
| test-engineer (2ª) | A espera de 50 ms dentro de `act` em `esperarOsProvedores` e no caso da sala sem nome livre | Retro da F2c: funciona porque a rede falsa responde em microtarefas |
| test-engineer (2ª) | O caso da "1 em 20" só pega a retirada do `!disputa` se um índice `% 20 === 9` cair na disputa; asserção direta de que nenhum `viaConta` está entre as posições 7 e 21 | Retro da F2c: o item 1 desta ordem muda a fração (80%), e a asserção só tem sentido depois dela |
| test-engineer (2ª) | O K2 reprovado no p95 do `decidir` não pode ser tomado como verde na validação | `TODO.md` e a seção "Carga" do documento, onde já está; o Orquestrador vê antes de fechar a spec (também `revisor-geral` 2ª e `infra-guardian` 2ª) |
| privacy-guardian (2ª) | Uma linha em `conferir-carga-sala.ts` que prove que nenhuma `conta_externa` da escola de carga guarda e-mail ou `hd` | `TODO.md`: está provado pelos testes de integração da 14.0 |
| privacy-guardian (2ª) | Comentário no k6 de que o `name` fixo das chamadas ao `iniciar` é obrigatório (o token iria para a tag `url` do resumo) | `TODO.md`: comentário; o arquivo é do item 1 e quem o reescreve pode aproveitar, mas não é exigência |
| revisor-geral (2ª) | `ROTA_DO_LOGIN_EXTERNO = ['/v1/sessao', 'externa'].join('/')` (k6:324) e o `[a-z]+` de `conferir-carga-sala.ts:114` escrevem a rota em pedaços para o guarda `tools/renomear/restos` não achar | `TODO.md`: o caminho do projeto é a classificação `fica` em `tools/renomear/mapas/6.json` |
| revisor-geral (2ª) | `docs/infra.md:240` diz "subiu de cerca de 1.300 (tarefa 9.0)", mas os 1.300 vêm do K2 do HEAD medido agora | Coberta pelo item 1, que reescreve esse parágrafo; confira a origem do número ao reescrevê-lo |
| revisor-geral (2ª) | A conta "7 por aluno, 8 com a entrada pela conta" no runbook, na techspec §7c e no `16_task.md` | Coberta pelo item 1 (mesma correção do `infra-guardian`) |
| tenancy-guardian (3ª) | O pico registrado é o maior valor entre todos os IPs; se um dia o k6 rodar com mais de um IP, registrar o pico por IP | Recusada: a carga roda com um IP de origem só (o próprio revisor diz que não faz diferença hoje); quando o cenário ganhar mais de um IP, a tarefa que o fizer registra por IP |
| revisor-geral (3ª) | `16_task.md:92`: a linha de divergência diz "não muda `apps/api`", mas o `config.test.ts` mudou | Recusada: o parágrafo da seção "Carga" do mesmo documento já registra que só o `config.test.ts` mudou em `apps/api`, e a linha da tabela fala de código de produção; o Validador confere os dois no fim da spec |
| privacy-guardian (3ª) | `tasks/prd-apresentacao-escola/techspec.md:234` também diz "~0,2%" com o teto de 3.000 | `TODO.md`: é documento de outra spec, fora da 16.0; o item 12 corrige o número no runbook e em `docs/infra.md`, e o Arquiteto alinha a techspec da apresentação na próxima triagem |
| privacy-guardian (3ª) | As recomendações da 2ª rodada que viraram `TODO.md` (a `conta_externa` sem e-mail ou `hd` na conferência e o comentário do `name` fixo) | Sem ação: o revisor registrou que já estão encaminhadas |
| conformidade-reviewer (3ª) | A pergunta aberta (a entrada pela conta ainda pode receber 429 do limite por IP) e o `decidir` do K2 acima de 2 s no p95 | Sem ação: os dois já estão no `TODO.md` (o primeiro com o Joaquim como dono; o item 10 o complementa) |
| frontend-reviewer (3ª) | Nenhuma nova | Sem ação |
| infra-guardian (4ª) | O pico de 3.579 (em `16_task.md:102`, `docs/runbook.md` e `docs/infra.md` 5.1) foi medido com o medidor antigo, de uma página de `SCAN`; rodar `npm run carga:sala -- --fases k2_conta` com o medidor novo antes da validação e trocar o número se mudar | `TODO.md`, antes da validação da spec (dono: Implementador, na 17.0 ou antes do Validador). O medidor antigo só podia dar número menor que o real, e o zero 429 já prova que ficou abaixo dos 6.000 |
| infra-guardian (4ª), test-engineer (4ª) | `medirOBaldeAnonimo` e o laço do cursor (`valoresDoBaldeAnonimo`) sem caso unitário; extrair a paginação para função que recebe um `scan` falso de duas páginas | `TODO.md`: muda `carga-sala.ts` e caducaria os sete revisores só por uma prova a mais; o `16_task.md` já registra que a leitura é I/O |
| test-engineer (4ª) | O bloco `if (false) return reprovacoes` fica vermelho porque `julgarPicoDoBalde` lança `TypeError`, e não por veredito diferente | Recusada: o bloco fica vermelho, que é o que o portão exige; a nuance fica nesta tabela |
| revisor-geral (4ª), infra-guardian (4ª) | `16_task.md:96` ainda descreve o balde "sem o `rl:ip:op:` nem o `rl:ip-login:`" e falta o `rl:ip:senha:` | `TODO.md` (documentos da spec): frase de documento, sem efeito no código; o Arquiteto alinha na próxima triagem |
| revisor-geral (4ª) | Uma frase no `cenarios.md:258` dizendo que pico 0 reprova no `k2_conta` | `TODO.md`, junto com a linha anterior |
| revisor-geral (4ª) | `cliente.on('error', () => undefined)` cala o erro de conexão do medidor; nas fases que aceitam pico não medido só sai uma linha de texto | `TODO.md`: contador de erros do medidor impresso junto; o `k2_conta` já reprova sem leitura |
| privacy-guardian (4ª) | O comentário de `carga-sala.ts:215-219` põe `rl:ip:senha` no Redis de cache, e a chave mora no Redis de fila; uma linha dizendo que normalmente nem aparece ali | Recusada: o filtro só exclui e está certo; é comentário em arquivo de código, e mexer nele caduca os sete revisores |
| frontend-reviewer (4ª) | A onça sai translúcida na foto do computador | Já está no `TODO.md` (dono: Implementador, `tools/vitrine/`) |
| frontend-reviewer (4ª) | No celular, "Não é a sua turma? Usar outro código" quebra em duas linhas; texto mais curto | `TODO.md`: texto de tela, na próxima tarefa que toca `TurmaPublica.tsx`; funciona como está |
| frontend-reviewer (4ª) | Nenhuma outra: a página com o provedor rola 970 px a 1366 × 768, e o PRD não pede que a tela de entrada caiba | Sem ação, registrado como observação |
| conformidade-reviewer (4ª) | Nenhuma da regra 70 | Sem ação |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 21:22:21 | 2026-11-09 21:23:02 | `frontend-reviewer` | 1 | APROVADO | abb0c692e09ba90c9 |
| 2026-11-09 21:22:37 | 2026-11-09 21:23:09 | `tenancy-guardian` | 1 | APROVADO | ac500876a53f2cf09 |
| 2026-11-09 21:22:40 | 2026-11-09 21:23:12 | `conformidade-reviewer` | 1 | APROVADO | ab7a9166f9361bea2 |
| 2026-11-09 21:22:25 | 2026-11-09 21:23:34 | `privacy-guardian` | 1 | APROVADO | a5bebdab8f505ba9a |
| 2026-11-09 21:22:33 | 2026-11-09 21:24:02 | `revisor-geral` | 1 | APROVADO | a836844a9ce29a05c |
| 2026-11-09 21:22:29 | 2026-11-09 21:24:19 | `test-engineer` | 1 | REPROVADO | a720843b4165fbe5f |
| 2026-11-09 21:22:43 | 2026-11-09 21:24:35 | `infra-guardian` | 1 | REPROVADO | ad6e8bb5179051a59 |
| 2026-11-09 22:26:38 | 2026-11-09 22:27:24 | `frontend-reviewer` | 2 | APROVADO | a493f4dd1756d6a7d |
| 2026-11-09 22:26:55 | 2026-11-09 22:27:41 | `tenancy-guardian` | 2 | APROVADO | ad1499d15c151d7f2 |
| 2026-11-09 22:26:08 | 2026-11-09 22:27:46 | `test-engineer` | 2 | APROVADO | aa7b39d05cad57e3c |
| 2026-11-09 22:27:03 | 2026-11-09 22:27:46 | `conformidade-reviewer` | 2 | APROVADO | a142fcb77fc3d178b |
| 2026-11-09 22:26:47 | 2026-11-09 22:27:51 | `privacy-guardian` | 2 | APROVADO | a772fd57b852a03b8 |
| 2026-11-09 22:26:29 | 2026-11-09 22:28:07 | `revisor-geral` | 2 | APROVADO | a99fdc6c4ebd1db3f |
| 2026-11-09 22:26:20 | 2026-11-09 22:28:27 | `infra-guardian` | 2 | REPROVADO | a9d531ed220b35935 |
| 2026-11-09 23:15:55 | 2026-11-09 23:16:05 | `frontend-reviewer` | 3 | APROVADO | aef1372e62fa64c60 |
| 2026-11-09 23:16:20 | 2026-11-09 23:16:57 | `conformidade-reviewer` | 3 | APROVADO | ab37d216823901d47 |
| 2026-11-09 23:16:12 | 2026-11-09 23:17:07 | `tenancy-guardian` | 3 | APROVADO | a2109dc64d27ca26b |
| 2026-11-09 23:16:04 | 2026-11-09 23:17:47 | `privacy-guardian` | 3 | REPROVADO | a42cc0c3653172a01 |
| 2026-11-09 23:15:38 | 2026-11-09 23:18:13 | `test-engineer` | 3 | REPROVADO | ae2b099c1a5fe4dce |
| 2026-11-09 23:15:47 | 2026-11-09 23:18:36 | `revisor-geral` | 3 | APROVADO | ae1162374dc3d01e3 |
| 2026-11-09 23:15:29 | 2026-11-09 23:20:04 | `infra-guardian` | 3 | REPROVADO | a615a53abfebbf834 |
| 2026-11-10 09:28:21 | 2026-11-10 09:28:47 | `privacy-guardian` | 4 | APROVADO | ab67f10cca8701673 |
| 2026-11-10 09:28:53 | 2026-11-10 09:29:11 | `tenancy-guardian` | 4 | APROVADO | a92d1ff863c6bc436 |
| 2026-11-10 09:28:47 | 2026-11-10 09:29:16 | `revisor-geral` | 4 | APROVADO | abce3895f979301f4 |
| 2026-11-10 09:28:59 | 2026-11-10 09:29:19 | `conformidade-reviewer` | 4 | APROVADO | adf2e4223669ac471 |
| 2026-11-10 09:28:30 | 2026-11-10 09:29:21 | `test-engineer` | 4 | APROVADO | a69d473085f3dd960 |
| 2026-11-10 09:29:07 | 2026-11-10 09:29:27 | `frontend-reviewer` | 4 | APROVADO | ab733f97ffe16ce98 |
| 2026-11-10 09:28:40 | 2026-11-10 09:29:32 | `infra-guardian` | 4 | APROVADO | a1d399da6e1502b81 |
