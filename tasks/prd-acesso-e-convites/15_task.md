# Tarefa 15.0 — Ligar a conta da escola em "Eu" (API e tela)

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0 e 14.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`, `test-engineer`
**Porte:** grande

## Objetivo

O aluno com sessão liga a conta da escola em "Eu" (`intencao=ligar`) e passa a entrar por ela; uma conta por aluno, e o "ligar" disputa com a provisória pela mesma trava.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Senha provisória", a trava; "Conta da escola do aluno") e 9
- `prd.md` RF14, RF18; `cenarios.md` RF14, RF13 (gerar × ligar), "Telas" (Conta da escola em "Eu")
- `.claude/rules/50`
- `apps/api/src/sessao/external/external-login.service.ts`, `conta-externa.repository.ts`; `apps/web/src/areas/aluno/Eu.tsx`

## Subtarefas

- [x] 15.1 — `intencao=ligar` com sessão de aluno, na trava da linha do usuário
- [x] 15.2 — O botão e os estados em "Eu"
- [x] 15.3 — `docs/interface.md`
- [x] 15.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/sessao/external/external-login.service.ts` | alterado |
| `apps/api/src/sessao/external/conta-externa.repository.ts` | alterado |
| `apps/web/src/areas/aluno/Eu.tsx` | alterado |
| `apps/web/src/areas/aluno/ContaDaEscola.tsx` | novo |
| `docs/interface.md` | alterado |
| `apps/api/test/ligar-conta.int.test.ts` | novo |
| `e2e/conta-da-escola-no-eu.spec.ts` | novo |
| `apps/api/src/sessao/external/cookie-oidc.ts` | alterado (acrescentado na execução: o `ligarAoAluno` do cookie, a primeira divergência) |
| `apps/api/src/sessao/external/external-login.controller.ts` | alterado (acrescentado: a `intencao=ligar` na rota que existe) |
| `packages/shared/src/sessao/externa.ts`, `packages/shared/src/errors/messages.ts`, `packages/shared/src/index.ts`, `packages/shared/src/errors/messages.test.ts` | alterados (acrescentados: os quatro resultados, o parâmetro e as mensagens, que a API e a web leem do mesmo lugar, regra 00 item 6) |
| `apps/web/src/api/escola.ts`, `apps/web/src/areas/aluno/Eu.test.tsx`, `apps/web/src/areas/aluno/ContaDaEscola.test.tsx` | alterados e novo (acrescentados: o endereço do `iniciar`, a lista de chamadas de "Eu" e o unitário da seção) |
| `apps/api/src/sessao/external/external-provider.port.ts`, `apps/api/src/sessao/external/openid-client.adapter.ts`, `infra/oidc-falso/config.json`, `apps/api/test/sessao.fixture.ts` | alterados (acrescentados na ordem de correção da 1ª rodada: a prova da conta de novo no `iniciar` da ligação e o `auth_time` na volta, os dois usuários sintéticos com `auth_time`, e a segunda sessão do mesmo aluno) |
| `packages/core/src/telemetry/metrics.ts`, `infra/grafana/paineis/fundacao.json`, `docs/lgpd.md`, `tasks/prd-acesso-e-convites/techspec.md`, `tasks/prd-acesso-e-convites/cenarios.md`, `TODO.md` | alterados (acrescentados: os rótulos novos de `login.externo`, o cookie no mapa de dados e as três divergências) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| aluno por matrícula liga em "Eu" | integração | passa a entrar pela conta | `ligar-conta.int.test.ts` › "o aluno que entrou por matrícula liga a conta, e passa a entrar por ela" |
| aluno com conta ligada liga outra | integração | recusado | `ligar-conta.int.test.ts` › "o aluno que já tem uma conta ligada tenta ligar outra" |
| `ligar` com sessão de professor | integração | recusado | `ligar-conta.int.test.ts` › "sessão de %s: o `iniciar` responde como o inexistente" (professor e coordenador) |
| conta ligada a outro | integração | `CONFLITO` sem nome nem id | `ligar-conta.int.test.ts` › "a conta ligada a outro aluno: `conflito` sem nome nem id" |
| escola sem ano em curso | integração | liga, como hoje | o primeiro caso da tabela, que confere `ano_letivo` = 0 antes de ligar |
| `conta_externa.ligada` | integração | um registro | o primeiro caso (um registro, do aluno, só com id e provedor) e "ligar a mesma conta duas vezes seguidas" (continua um) |
| [P] gerar × ligar, barreira entre a checagem e a gravação | paralelo | nunca conta ligada e provisória juntas | `ligar-conta.int.test.ts` › "[P] gerar a provisória × ligar a conta": os dois sentidos, cada um um caso, com `WriteBlockTrigger` e `esperarNaTrava` |
| [P] aprovar com a conta C × outro aluno liga C | paralelo | uma liga, a outra `CONFLITO`, nunca 500; perdendo a aprovação, nenhum usuário | `ligar-conta.int.test.ts` › "[P] aprovar o pedido com a conta C × outro aluno liga C em "Eu"": os dois sentidos |
| [P] ligar a mesma conta duas vezes | paralelo | uma | `ligar-conta.int.test.ts` › "[P] a mesma conta, ao mesmo tempo": o mesmo aluno duas vezes (as duas `ligada`) e dois alunos (`ligada` e `conflito`) |
| tela: ligada | e2e | "Conta da escola ligada" | `conta-da-escola-no-eu.spec.ts` › "a volta do provedor: "Conta da escola ligada" em "Eu"…" |
| tela: `CONFLITO` e rede | e2e | os textos de "Telas" | "a conta que é de outro aluno…" (o `CONFLITO`) e "rede: a leitura dos provedores que falha…" (a rede); a queda do provedor e a recusa, no unitário `ContaDaEscola.test.tsx` |
| carregando | e2e | botão ocupado | "carregando: o clique deixa o botão ocupado…" |
| recomeço: o colega no mesmo computador | e2e | nada do anterior | "recomeço: o aluno seguinte no mesmo computador vê o "Eu" dele…" |
| recomeço: resposta atrasada | e2e | não troca o estado | "recomeço: a resposta atrasada da escola do aluno que saiu…" |
| recomeço: erro | e2e | o aviso sai na nova tentativa | "recomeço: o aviso sai quando o aluno tenta de novo…" |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | "360 px: sem rolagem horizontal, com o botão de 44 px…" |
| 1366 × 768 | e2e | cabe sem a página rolar | "1366 × 768: com a seção e duas tarefas corrigidas…" |
| `ligar` pede a prova da conta de novo | integração | `max_age=0` e `prompt` só na ligação; o login comum não os leva | `ligar-conta.int.test.ts` › "o `iniciar` da ligação leva `max_age=0` e o `prompt` do provedor…" |
| a autenticação antiga não liga | integração | `auth_time` de mais de 120 s é `recusada`; o de agora liga | `ligar-conta.int.test.ts` › "o retorno cuja autenticação é antiga…" |
| a sessão que vale é a que o `iniciar` achou | integração | a outra sessão aberta do aluno não serve | `ligar-conta.int.test.ts` › "o aluno com duas sessões…" |
| quem liga é o refresh | integração | um cookie inventado, com sessão de aluno aberta na escola: 404 | `ligar-conta.int.test.ts` › "um cookie inventado numa escola que tem uma sessão de aluno aberta" |
| `ligar` com `token` ou `codigo` | integração | 404 como o inexistente, sem cookie | `ligar-conta.int.test.ts` › "`intencao=ligar` com `token` ou `codigo`…" |
| os provedores não se leem de novo | unitário | a consulta anônima vale por minutos | `ContaDaEscola.test.tsx` › "os provedores da escola não são lidos de novo…" |
| a nova tentativa diz a conta | unitário | com dois provedores, "Tentar de novo com a conta Google" e "…Microsoft" | `ContaDaEscola.test.tsx` › "`provedor` com os dois provedores…" |

## Como testar

- API: `apps/api/test/external-login.int.test.ts` › "caminho feliz (RF9): a professora de A entra a primeira vez e fica ligada…"; corrida com `WriteBlockTrigger`
- Tela: `e2e/entrar-na-escola.spec.ts` › "aluno com a conta ligada entra pelo botão, e nada do provedor (e-mail, nome ou foto) aparece na tela" (o `oidc-falso`, linha 53); `e2e/aluno-eu.spec.ts` › "o aluno seguinte no mesmo computador vê o Eu dele…" e "a página com duas tarefas corrigidas… cabe em 1366 × 768 sem rolar"
- Comando: `npx vitest run --project integracao apps/api/test/ligar-conta.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/conta-da-escola-no-eu.spec.ts`
- Telas: `aluno`, `/eu` › "Ligar a conta da escola"

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: o [P] gerar × ligar só prova a trava se as duas chamadas lerem antes de gravar.

**O plano.** `ContaExternalRepository` ganha `sessaoDoAluno` (o `iniciar` acha o aluno pelo refresh) e `travarAlunoDaSessao` (a trava `FOR NO KEY UPDATE` da linha do usuário e, com ela travada, a conferência de que a sessão vale). O `ExternalLoginService` ganha `iniciarParaLigar` e o ramo `ligarAoAluno` do retorno (transação: trava, `ligar` com `onConflictDoNothing`, relê para separar "a mesma conta" de "conta de outro", auditoria `conta_externa.ligada` com o aluno por autor). O `CookieOidc` leva `ligarAoAluno` (usuário e sessão). O controller aceita `intencao=ligar`. O contrato de `packages/shared` ganha os quatro resultados, o parâmetro `ligacao` e as mensagens. A web ganha `ContaDaEscola` em "Eu". Testes: integração (`ligar-conta.int.test.ts`, 24 casos), unidade (`ContaDaEscola.test.tsx`, `messages.test.ts`, `Eu.test.tsx`) e e2e (`conta-da-escola-no-eu.spec.ts`, 10 casos nos dois projetos).

1. **Mutação de cada cláusula:** uma por linha de condição do diff, na seção "Mutações" (blocos rodados por mim antes do pedido, com o mesmo `aplicarMutacao` e `comandoDoTeste` do portão). Cada termo de `linha !== undefined && linha.papel === 'aluno' && sessaoAindaVale(linha)` tem o seu (professor, sessão encerrada, cookie inventado); a trava tem o seu (`usuario.id` tirado do `where`: a ligação não espera mais a geração) e o `sessaoAindaVale` sob a trava também; a escola da sessão tem o do aluno de outra escola. O termo da conta pessoal da Microsoft (`conta.dominio === TENANT_DE_CONTA_PESSOAL_MICROSOFT`), o `dominioLiberado` e as duas pontas do `relida?.usuarioId === aluno.usuarioId ? 'ligada' : 'conflito'` têm um bloco cada; os termos que são mutante equivalente (`conta.dominio === undefined ||`, `conta.provedor === 'microsoft' &&`, `conta.autenticadaEm !== undefined &&`, o `eq(usuario.escolaId, escolaId)` da trava e o `eq(usuario.escolaId, sessao.escolaId)` da junção do `#estadoDaSessao`) têm o motivo escrito, e não um bloco. Os três termos da sessão têm o seu: `sessao.refreshHash` (o refresh anterior), `sessao.id` (o aluno com duas sessões) e `sessao.usuarioId` (a sessão de outro aluno); a prova da conta de novo (`max_age`, `prompt`, a passagem ao `iniciar` e o `auth_time`) e o `staleTime` também. Na tela, cada condição do JSX tem o dela. Sobram três linhas que a ferramenta lista sem bloco, e cada uma tem o motivo em "Mutações", mais os motivos dos termos equivalentes. Três guardas que nenhum teste alcançava saíram do código em vez de ganhar motivo: o `if (travado === undefined) return false` (sem a linha de usuário, a leitura da sessão devolve o mesmo `false`), o `|| refresh === ''` (o hash do vazio não acha sessão) e o `ligando || slug === undefined` do clique (o botão desabilitado não dispara `onClick`, e `slug` já está estreitado).
2. **Texto na tela:** os textos novos ("Conta da escola", "Ligar a conta da escola", "Ligar a conta Google da escola", "Ligando…", "Conta da escola ligada", e as três recusas) só aparecem na seção nova, que só existe para a escola com provedor liberado; `grep -rln 'Conta da escola' e2e/` acha só o spec novo. O texto que a tarefa tirou de `apps/web/src`: nenhum. Os specs de jornada que passam por "Eu" (`aluno-eu`, `aluno-fluxo`, `casca`, `escola-montada`, `roteiro-da-demonstracao`) rodam isolados antes do portão, e o `Eu.test.tsx` mudou a lista de chamadas de rede.
3. **O segundo dado:** o cookie de uma escola num endereço de outra tem sessão aberta nas duas; o aluno de outra escola ligado à mesma conta do provedor liga na dele (isolamento da conta); o `usuarioId` de um aluno com a `sessaoId` de outro, e a escola do cookie trocada, são casos à parte; a escola liberou **dois** domínios (o do segundo `iniciar` não é o da conta), e a que liberou o tenant pessoal da Microsoft prova o termo do tenant.
4. **Checagem anterior que responde antes:** o `iniciar` do ligar confere provedor ligado, escola do slug e sessão de aluno **antes** de ir ao provedor, e cada caso olha o 404 **e** a ausência de `Set-Cookie`; no retorno, o domínio (recusa barata, sem trava) vem antes da trava, e os casos de `recusada` por sessão têm o domínio liberado, para a recusa nunca ser a do domínio. O [P] gerar × ligar usa escola com ano em curso e a coordenação (`sala.montar()`); o caso sem ano em curso é o do caminho feliz.
5. **A asserção olha o resultado:** `conta_externa` e `auditoria` lidas do banco (três campos e o autor), a sessão por `sessao`, a senha por `credencial_matricula`, e a entrada pela conta é o login de verdade depois da ligação. Na tela, o texto do alerta e do status, o estado do botão e a barra de endereço limpa.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo.
7. **Comentário que afirma o que o código não faz:** conferidos o docblock de `travarAlunoDaSessao` (a escola do contexto, o cookie com o aluno de uma escola e a escola de outra "não acha linha"), o de `#ligarAoAluno` e o do `ContaDaEscola` (a lista de estados). O comentário do `e2e` sobre os 15 s diz o que a medida custou (a ida ao provedor pela API do navegador).
8. **Divergência que cria regra:** as quatro linhas de "Divergências" estão na `techspec.md` §5 ("Conta da escola do aluno", a frase de `intencao=ligar`), no `cenarios.md` (a lista de RF14 e a linha de "Telas") e em `docs/lgpd.md` (o `educa_oidc` leva o aluno e a sessão); `grep -n 'ligarAoAluno\|ligacao=\|max_age' techspec.md cenarios.md` acha cada termo. A rota `iniciar` com `intencao=ligar` não é anônima: sem sessão de aluno responde 404, e o que grava é um cookie cifrado no navegador; nada no servidor antes do retorno.
9. **Peça que já existe:** `ContaExternalRepository.ligar` e `ligacao`, `sessaoAindaVale` (a mesma conferência da guarda e da renovação), `hashDoRefresh`, `lerCookie`, `naEscolaSemUsuario`, `redirecionar`, `acessoDaEscolaQueryOptions` e o `Button`; nada copiado. A trava é a mesma `FOR NO KEY UPDATE` da provisória e da aprovação.
10. **Operação simultânea:** [P] gerar × ligar nos dois sentidos (a barreira `WriteBlockTrigger` no `update` da credencial e no `insert` da conta, e `esperarNaTrava` conta o processo que espera a trava do usuário), [P] o mesmo aluno duas vezes, [P] dois alunos na mesma conta (com o `WriteBlockTrigger` no `insert` da conta e `esperarNaTrava`: o segundo `insert` espera atrás do primeiro, e o resultado é `ligada` e `conflito`, nessa ordem), [P] aprovar × ligar nos dois sentidos. Na tela, a resposta do `iniciar` segurada (`page.route`) em três casos, e o botão ocupado lido no instante do clique.
11. **Isolamento:** o cookie com a escola de outra e o `iniciar` com o aluno de outra escola (404 igual) caem nos blocos da escola da sessão e do `where` do usuário; todo id do caso de isolamento é de uma escola e o contexto é de outra. A coluna "Caso" da tabela de testes aponta o caso de cada linha, e a linha com "e" tem um caso para cada parte.
12. **Guardiões:** tenancy (o `iniciar` só acha sessão de aluno **da escola do slug**; o retorno põe a escola do cookie cifrado no contexto e a trava só alcança o usuário dela), privacy (nenhum dado do provedor chega ao banco, ao log nem à resposta: o caso feliz varre três tabelas e o log; o `educa_oidc` com aluno e sessão entrou no mapa de `docs/lgpd.md`; a URL do `iniciar` leva só o slug e a intenção, **nada de token**, e por isso a recomendação da 14.0 sobre token na URL não se aplica a esta rota), infra (a trava é a mesma e curta; a transação só faz a trava, o `insert` e a auditoria, sem chamada externa; a métrica `login.externo` ganhou `ligacao_ligada`, `ligacao_conflito` e `ligacao_recusada`, e a descrição dela e a do painel foram atualizadas), frontend (os quatro estados, 360 px, 44 px, teclado e a barra limpa), conformidade (a ligação não decide nota nem aluno; é ato do próprio aluno, com auditoria). `achados/indice.md` lido: nenhuma linha toca a tela nem o `ligar`; a recomendação do privacy-guardian e do tenancy-guardian da 14.0 (2ª) sobre o token na URL é a da linha acima.

## Fora do escopo desta tarefa

A reivindicação (14.0, 16.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Quem liga é achado no `iniciar`, pelo `educa_sessao`, e vai no cookie `educa_oidc` (`ligarAoAluno`: usuário e sessão); o retorno confere de novo, sob a trava, que a sessão vale | O `educa_sessao` é `SameSite=Strict` e não vai na navegação que volta do Google; a sessão pode acabar entre o início e o retorno (a provisória a encerra) | `techspec.md` §5 "Conta da escola do aluno" (a frase de `intencao=ligar`); `cenarios.md` RF14 ("A volta do "ligar"…"); `docs/lgpd.md` (o `educa_oidc` com aluno e sessão) |
| O resultado volta no endereço de "Eu" (`/aluno/eu?ligacao=ligada\|conflito\|recusada\|provedor`), com os textos de `recusada` e de `provedor`, que a tabela de "Telas" não escreve | A volta é uma navegação do navegador; a tela mostra o resultado e o tira da barra (regra 50, item 7). O `conflito` e a rede seguem os textos da tabela | `techspec.md` §5; `cenarios.md` RF14 e a linha "Conta da escola em "Eu"" de "Telas" |
| "Conta da escola ligada" aparece na volta do provedor, não é lida do servidor: numa visita seguinte o botão reaparece (ligar a mesma conta de novo é `ligada`, sem segundo registro) | O `/v1/eu` não diz se há conta ligada, e acrescentá-lo muda o contrato de "Eu" e o arquivo do titular, que a tarefa não prevê | `cenarios.md` linha "Conta da escola em "Eu"" de "Telas"; `TODO.md` (o item "Eu mostra a conta já ligada") |
| A ligação em "Eu" pede a prova da conta de novo (`max_age=0` e `prompt`: `select_account` no Google, `login` na Microsoft, só no `intencao=ligar`), e o `auth_time` de mais de 120 s, quando o provedor o traz, é `recusada`; a claim ausente não recusa | O computador compartilhado deixa a conta do colega aberta no provedor, e a ligação não passa por professor: sem a prova, o aluno A ligaria a conta de B ao próprio usuário, e B entraria como A. O `auth_time` não é exigido porque o Google só o traz com um ajuste do console dele, e a Microsoft o traz como opcional (exigi-lo deixaria a ligação sem funcionar onde ele não vem) | `techspec.md` §5 "Conta da escola do aluno" (o fim do parágrafo de `intencao=ligar`); `cenarios.md` RF14 (o item da prova da conta de novo) e a linha "Conta da escola em "Eu"" de "Telas" (os dois rótulos do "Tentar de novo"); `TODO.md` (o item de exigir o `auth_time`) |

## Mutações

`--faltando: 3 linhas (60 blocos, 8 motivos).` Os 60 blocos foram aplicados e rodados antes do pedido (os 43 da primeira entrega, menos dois do `rotulo` que ganhou ramos, mais os 19 da ordem de correção da 1ª rodada), com o mesmo `aplicarMutacao` e `comandoDoTeste` do portão: todos ficaram vermelhos num caso que rodou e falhou. Os blocos de tela e de mensagem rodam no unitário (`ContaDaEscola.test.tsx`, `messages.test.ts`), e os da API, no `ligar-conta.int.test.ts` (o do `acessoDaSalaId`, no `reivindicacao-com-conta.int.test.ts`). Os blocos de negação (`falha:`) caem na linha do `expect` que o cabeçalho cita.

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` responde como o inexistente
-    return linha !== undefined && linha.papel === 'aluno' && sessaoAindaVale(linha) ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
+    return linha !== undefined && sessaoAindaVale(linha) ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › sem o cookie de renovação, com um cookie inventado
-    return linha !== undefined && linha.papel === 'aluno' && sessaoAindaVale(linha) ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
+    return linha !== undefined && linha.papel === 'aluno' ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › sem o cookie de renovação, com um cookie inventado
-    return linha !== undefined && linha.papel === 'aluno' && sessaoAindaVale(linha) ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
+    return linha.papel === 'aluno' && sessaoAindaVale(linha) ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › a geração chega primeiro e encerra a sessão
-      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
+      .where(and(eq(usuario.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › a geração chega primeiro e encerra a sessão
-    return linha !== undefined && sessaoAindaVale(linha)
+    return linha !== undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › o cookie do login em andamento com o aluno de uma escola
-    return linha !== undefined && sessaoAindaVale(linha)
+    return sessaoAindaVale(linha)
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › sem o cookie de renovação, com um cookie inventado
-      .where(and(eq(sessao.escolaId, requireEscolaId()), condicao))
+      .where(condicao)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.controller.ts
teste: apps/api/test/ligar-conta.int.test.ts › o aluno que entrou por matrícula liga a conta
-    if (consulta.intencao === 'ligar') return redirecionar(resposta, await this.login.iniciarParaLigar(provedor, consulta.slug, requisicao.headers.cookie))
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › caminho feliz, pelo link e pelo código
-    return this.#aoProvedor(provedor, slug, escolaId, sala === undefined ? {} : { acessoDaSalaId: sala.acessoId })
+    return this.#aoProvedor(provedor, slug, escolaId, {})
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › a escola que não existe, o provedor desconhecido
   async iniciarParaLigar(provedor: ProvedorExterno, slug: string, cabecalhoCookie: string | undefined): Promise<Redirect> {
-    if (!this.ligados.includes(provedor)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › a escola que não existe, o provedor desconhecido
     const escolaId = await this.dependencias.resolucao.escolaPorSlug(slug)
-    if (escolaId === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
     const refresh = lerCookie(cabecalhoCookie, SESSAO_COOKIE)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › sem o cookie de renovação, com um cookie inventado
       refresh === undefined
-        ? undefined
+        ? null
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › sem o cookie de renovação, com um cookie inventado
     const aluno =
-      refresh === undefined
+      false
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › sem o cookie de renovação, com um cookie inventado
         : await naEscolaSemUsuario({ escolaId }, () => new ContaExternalRepository(this.dependencias.banco).sessaoDoAluno(hashDoRefresh(refresh)))
-    if (aluno === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o emissor que não responde no `iniciar`
-      return { endereco: prende.ligarAoAluno === undefined ? enderecoDaFalha(slug, 'provedor') : enderecoDaLigacao('provedor'), cookies: [] }
+      return { endereco: enderecoDaFalha(slug, 'provedor'), cookies: [] }
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o aluno que entrou por matrícula liga a conta
-      if (emAndamento.ligarAoAluno !== undefined) return this.#ligarAoAluno(emAndamento.escolaId, emAndamento.ligarAoAluno, contaNoProvedor, apagar)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › `error` no retorno
-    return { endereco: emAndamento?.ligarAoAluno === undefined ? enderecoDaFalha(emAndamento?.slug, 'provedor') : enderecoDaLigacao('provedor'), cookies: [apagar] }
+    return { endereco: enderecoDaFalha(emAndamento?.slug, 'provedor'), cookies: [apagar] }
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › a conta pessoal da Microsoft
   async #resultadoDaLigacao(escolaId: string, aluno: NonNullable<LoginExternoEmAndamento['ligarAoAluno']>, conta: ContaNoProvedor): Promise<ResultadoDoRetornoDaLigacao> {
-    if (conta.dominio === undefined || (conta.provedor === 'microsoft' && conta.dominio === TENANT_DE_CONTA_PESSOAL_MICROSOFT)) return 'recusada'
+    if (conta.dominio === undefined) return 'recusada'
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › domínio que a escola não liberou
-    if (!(await new ContaExternalRepository(this.dependencias.banco).dominioLiberado(conta.provedor, conta.dominio))) return 'recusada'
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › a sessão que acabou entre o `iniciar` e o retorno
-        if (!(await repositorio.travarAlunoDaSessao(aluno.usuarioId, aluno.sessaoId))) return 'recusada'
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o aluno que entrou por matrícula liga a conta
-        if (ligacaoId !== undefined) {
+        if (false) {
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › a conta ligada a outro aluno
-        return relida?.usuarioId === aluno.usuarioId ? 'ligada' : 'conflito'
+        return 'ligada'
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › ligar a mesma conta duas vezes seguidas
-        return relida?.usuarioId === aluno.usuarioId ? 'ligada' : 'conflito'
+        return 'conflito'
```

```mutacao
arquivo: packages/shared/src/errors/messages.ts
teste: packages/shared/src/errors/messages.test.ts › cada resultado da ligação em "Eu"
-  if (valor === 'ligada') return MENSAGENS_DA_LIGACAO.ligada
```

```mutacao
arquivo: packages/shared/src/errors/messages.ts
teste: packages/shared/src/errors/messages.test.ts › cada resultado da ligação em "Eu"
-  if (valor === 'conflito') return MENSAGENS_DA_LIGACAO.conflito
```

```mutacao
arquivo: packages/shared/src/errors/messages.ts
teste: packages/shared/src/errors/messages.test.ts › cada resultado da ligação em "Eu"
-  if (valor === 'recusada') return MENSAGENS_DA_LIGACAO.recusada
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › com um provedor: o título
-  if (valor === null) return undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › o aviso da queda do provedor
-  return RESULTADOS_DA_LIGACAO.find((resultado) => resultado === valor) ?? 'provedor'
+  return RESULTADOS_DA_LIGACAO.find((resultado) => resultado === valor) ?? undefined
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › com um provedor: o título
falha: expect(historico).not.toHaveBeenCalled()
   useEffect(() => {
-    if (resultado === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › carregando: nada até saber a escola
-  const acesso = useQuery({ ...acessoDaEscolaQueryOptions(slug ?? ''), enabled: slug !== undefined, staleTime: PRAZO_DOS_PROVEDORES_MS })
+  const acesso = useQuery({ ...acessoDaEscolaQueryOptions(slug ?? ''), enabled: true, staleTime: PRAZO_DOS_PROVEDORES_MS })
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › o clique: o botão fica ocupado
-      if (evento.persisted) definirLigando(false)
+      definirLigando(false)
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › a leitura dos provedores que falha
-  if (acesso.isError) return <ErrorState erro={acesso.error} tentando={acesso.isFetching} aoTentarDeNovo={() => void acesso.refetch({ cancelRefetch: false })} />
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › com um provedor: o título
-  const provedores = acesso.data?.provedores ?? []
+  const provedores = acesso.data?.provedores
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › sem provedor liberado pela escola
falha: expect(screen.queryByText(TITULO)).toBeNull()
-  if (provedores.length === 0) return null
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › com um provedor: o título
falha: expect(screen.queryByRole('alert')).toBeNull()
-      {resultado !== undefined && (
+      {true && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › `ligada`
-        <p role={resultado === 'ligada' ? 'status' : 'alert'} className={resultado === 'ligada' ? 'font-medium' : 't-apoio text-erro'}>
+        <p role="alert" className={resultado === 'ligada' ? 'font-medium' : 't-apoio text-erro'}>
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › `ligada`
falha: expect(status.className).not.toContain('text-erro')
-        <p role={resultado === 'ligada' ? 'status' : 'alert'} className={resultado === 'ligada' ? 'font-medium' : 't-apoio text-erro'}>
+        <p role={resultado === 'ligada' ? 'status' : 'alert'} className="t-apoio text-erro">
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › o aviso num alerta que diz o próximo passo
-        <p role={resultado === 'ligada' ? 'status' : 'alert'} className={resultado === 'ligada' ? 'font-medium' : 't-apoio text-erro'}>
+        <p role={resultado === 'ligada' ? 'status' : 'alert'} className="font-medium">
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › `ligada`
falha: expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
-      {resultado !== 'ligada' && (
+      {true && (
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › o clique: o botão fica ocupado
-              {ligando ? 'Ligando…' : rotulo(provedor)}
+              {rotulo(provedor)}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › o clique: o botão fica ocupado
-            {ligando ? 'Ligando a conta da escola…' : ''}
+            {''}
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › o aviso da queda do provedor
-    const deNovo = resultado === 'provedor'
+    const deNovo = false
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › com os dois provedores: um botão para cada
-    if (provedores.length === 1) return deNovo ? 'Tentar de novo' : 'Ligar a conta da escola'
+    if (true) return deNovo ? 'Tentar de novo' : 'Ligar a conta da escola'
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › `provedor` com os dois provedores
-    return deNovo ? `Tentar de novo com a conta ${NOME_DO_PROVEDOR[provedor]}` : `Ligar a conta ${NOME_DO_PROVEDOR[provedor]} da escola`
+    return false ? `Tentar de novo com a conta ${NOME_DO_PROVEDOR[provedor]}` : `Ligar a conta ${NOME_DO_PROVEDOR[provedor]} da escola`
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › os provedores da escola não são lidos de novo
-  const acesso = useQuery({ ...acessoDaEscolaQueryOptions(slug ?? ''), enabled: slug !== undefined, staleTime: PRAZO_DOS_PROVEDORES_MS })
+  const acesso = useQuery({ ...acessoDaEscolaQueryOptions(slug ?? ''), enabled: slug !== undefined })
```

```mutacao
arquivo: apps/web/src/areas/aluno/ContaDaEscola.tsx
teste: apps/web/src/areas/aluno/ContaDaEscola.test.tsx › os provedores da escola não são lidos de novo
-export const PRAZO_DOS_PROVEDORES_MS = 10 * 60_000
+export const PRAZO_DOS_PROVEDORES_MS = 60_000
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › o aluno com duas sessões
-    const [linha] = await this.#estadoDaSessao(and(eq(sessao.id, sessaoId), eq(sessao.usuarioId, usuarioId)))
+    const [linha] = await this.#estadoDaSessao(and(eq(sessao.usuarioId, usuarioId)))
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › o cookie do login em andamento com o aluno de uma escola
-    const [linha] = await this.#estadoDaSessao(and(eq(sessao.id, sessaoId), eq(sessao.usuarioId, usuarioId)))
+    const [linha] = await this.#estadoDaSessao(and(eq(sessao.id, sessaoId)))
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › o refresh anterior
-    const [linha] = await this.#estadoDaSessao(eq(sessao.refreshHash, refreshHash))
+    const [linha] = await this.#estadoDaSessao(undefined)
```

```mutacao
arquivo: apps/api/src/sessao/external/openid-client.adapter.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
-          ...(reautenticar ? { max_age: '0', prompt: PROMPT_DA_LIGACAO[provedor] } : {}),
+          ...(reautenticar ? { prompt: PROMPT_DA_LIGACAO[provedor] } : {}),
```

```mutacao
arquivo: apps/api/src/sessao/external/openid-client.adapter.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
-          ...(reautenticar ? { max_age: '0', prompt: PROMPT_DA_LIGACAO[provedor] } : {}),
+          ...(reautenticar ? { max_age: '0' } : {}),
```

```mutacao
arquivo: apps/api/src/sessao/external/openid-client.adapter.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
falha: expect([parametros.has('max_age'), parametros.has('prompt')], provedor).toEqual([false, false])
-          ...(reautenticar ? { max_age: '0', prompt: PROMPT_DA_LIGACAO[provedor] } : {}),
+          ...{ max_age: '0', prompt: PROMPT_DA_LIGACAO[provedor] },
```

```mutacao
arquivo: apps/api/src/sessao/external/openid-client.adapter.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
-  google: 'select_account',
+  google: 'consent',
```

```mutacao
arquivo: apps/api/src/sessao/external/openid-client.adapter.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
-  microsoft: 'login',
+  microsoft: 'select_account',
```

```mutacao
arquivo: apps/api/src/sessao/external/openid-client.adapter.ts
teste: apps/api/test/ligar-conta.int.test.ts › o retorno cuja autenticação é antiga
-    const autenticadaEm = typeof claims['auth_time'] === 'number' ? claims['auth_time'] : undefined
+    const autenticadaEm = undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
-      const inicio = await this.dependencias.provedor.iniciar(provedor, prende.ligarAoAluno !== undefined)
+      const inicio = await this.dependencias.provedor.iniciar(provedor, false)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o `iniciar` da ligação leva `max_age=0`
falha: expect([parametros.has('max_age'), parametros.has('prompt')], provedor).toEqual([false, false])
-      const inicio = await this.dependencias.provedor.iniciar(provedor, prende.ligarAoAluno !== undefined)
+      const inicio = await this.dependencias.provedor.iniciar(provedor, true)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o retorno cuja autenticação é antiga
-    if (conta.autenticadaEm !== undefined && conta.autenticadaEm < Date.now() / 1_000 - IDADE_MAXIMA_DA_AUTENTICACAO_S) return 'recusada'
+    if (false) return 'recusada'
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/ligar-conta.int.test.ts › o retorno cuja autenticação é antiga
-    if (conta.autenticadaEm !== undefined && conta.autenticadaEm < Date.now() / 1_000 - IDADE_MAXIMA_DA_AUTENTICACAO_S) return 'recusada'
+    if (conta.autenticadaEm !== undefined && conta.autenticadaEm > Date.now() / 1_000 - IDADE_MAXIMA_DA_AUTENTICACAO_S) return 'recusada'
```

```mutacao
arquivo: apps/api/src/sessao/external/conta-externa.repository.ts
teste: apps/api/test/ligar-conta.int.test.ts › a geração chega primeiro e encerra a sessão
-      .innerJoin(usuario, and(eq(usuario.escolaId, sessao.escolaId), eq(usuario.id, sessao.usuarioId)))
+      .innerJoin(usuario, eq(usuario.escolaId, sessao.escolaId))
```

Três linhas novas com condição ficam sem bloco, e cinco termos de condições que um bloco já alcança ficam sem o seu, por oito motivos:

1. `external-login.service.ts` `if (parametros.has('error')) return this.#falhaDoProvedor(emAndamento, apagar)`: tirada a linha, o `concluir` recebe a consulta com o `error` e a biblioteca a recusa como `ExternalProviderError`, que cai no mesmo `#falhaDoProvedor`: mesmo destino, mesmo cookie apagado, mesma métrica. Rodei sem a linha e o caso "`error` no retorno" ficou verde. A linha só poupa a ida ao provedor.
2. `external-login.service.ts` `currentContext()?.requisicaoId ?? randomUUID()`: o retorno roda dentro de `naEscolaSemUsuario`, que já pôs o `requisicaoId` no contexto, e o `?? randomUUID()` é o idioma que o repositório usa para quem chama fora de contexto (`convite.service.ts`, `escola.ts`, `escola-sem-usuario.ts`). O id gerado vai para a linha da auditoria, e nenhum teste conhece o valor que o contexto escolheu; trocar um por outro dá um UUID do mesmo jeito.
3. `ContaDaEscola.tsx` `if (slug === undefined) return null`: tirada a linha, a consulta dos provedores continua desligada (`enabled: slug !== undefined`), `provedores` fica `[]` e a linha seguinte devolve o mesmo `null`; a linha existe para o TypeScript estreitar `slug` no resto da função. Rodei sem a linha e os casos do unitário ficaram verdes.
4. `external-login.service.ts` `conta.dominio === undefined ||`, o primeiro termo da condição do `#resultadoDaLigacao` (a linha tem o bloco do termo da conta pessoal da Microsoft): tirado o termo, a conta pessoal do Google (sem `hd`) chega ao `dominioLiberado(provedor, undefined)`, o Drizzle compara com `NULL`, não acha linha e devolve o mesmo `recusada`. Rodei sem o termo e o caso "conta pessoal, sem domínio" ficou verde; o termo é o estreitamento de tipo que o `dominioLiberado(…, string)` pede, o mesmo da linha do `#decidir`, que é de antes da tarefa.
5. `external-login.service.ts` `conta.provedor === 'microsoft' &&`, no `#resultadoDaLigacao`: tirado o termo, a conta do Google com `hd` igual ao GUID do tenant pessoal da Microsoft passaria a ser `recusada`; o `hd` do Google é um domínio de e-mail e nunca é esse GUID, e o `oidc-falso` nem sabe emitir um. É a mesma condição do `#decidir`, que é de antes da tarefa e tem o bloco da Microsoft.
6. `external-login.service.ts` `conta.autenticadaEm !== undefined &&`, na recusa da autenticação antiga: tirado o termo, `undefined < número` é `false` em JavaScript e a linha segue sem recusar; o termo é o estreitamento de tipo que a comparação pede, e o bloco de `if (false)` e o de `>` provam o resto da linha.
7. `conta-externa.repository.ts` `eq(usuario.escolaId, escolaId)`, no `where` da trava: tirado o termo, a trava alcança o usuário de qualquer escola pelo id, mas o `#estadoDaSessao`, com o escopo da escola do contexto, devolve o mesmo `false` para a sessão de outra escola, e o aluno do cookie é sempre o da escola dele (o cookie é cifrado). Rodei sem o termo e os casos ficaram verdes; o bloco do `usuario.id` do mesmo `where` tem o dele.
8. `conta-externa.repository.ts` `eq(usuario.escolaId, sessao.escolaId)`, na junção do `#estadoDaSessao`: a `sessao` tem a chave estrangeira composta `(escola_id, usuario_id)`, e o `usuario.id` do outro termo já a prende ao usuário da própria sessão; tirado o termo da escola, a junção traz a mesma linha. Rodei sem o termo (unidade e integração do repository e do `ligar-conta`) e ficaram verdes. O `usuario.id` da mesma junção tem o bloco dele: sem ele a junção traz outro usuário da escola, e os casos [P] caem.

## Recomendações sem aplicar

1ª e 2ª rodadas (as 11 primeiras linhas são da 1ª; as 12 últimas, da 2ª).

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | Reservar a altura da seção (esqueleto ou "Carregando…") enquanto os provedores carregam, para a página não descer | `TODO.md`. O caso "carregando: nada até saber a escola" (`ContaDaEscola.test.tsx`, bloco da Mutações) fixa o contrário, e mudar a decisão pede a spec |
| frontend-reviewer (1ª), privacy-guardian (1ª) | Texto de `conflito` e de `recusada` que sirva ao aluno que já tem outra conta e à sessão que acabou | `TODO.md`. Os textos são os de `cenarios.md` RF14, "Telas"; mudá-los passa pela spec (o frontend-reviewer diz o mesmo) |
| frontend-reviewer (1ª) | Mover o foco para o aviso depois de "ligada" | `TODO.md`. Muda comportamento da tela e pede teste de foco; fica para a validação |
| frontend-reviewer (1ª) | "Conta da escola ligada" só na volta do provedor | Já é a divergência 3 desta tarefa e o item "Eu mostra a conta já ligada" do `TODO.md` (linha 3283); a validação confere |
| frontend-reviewer (1ª) | Fotografar a seção quando a vitrine tiver provedor liberado | `TODO.md`, junto dos itens da vitrine. O Validador fotografa a seção no fim da spec (a vitrine não libera provedor hoje) |
| conformidade-reviewer (1ª), privacy-guardian (1ª) | Dizer ao aluno a quem pedir para desligar, ou deixá-lo ver o provedor ligado e desligar (D59) | Item "Eu mostra a conta já ligada" do `TODO.md` (linha 3283): acrescentar o provedor ligado e o caminho de desligar. Decisão de produto, 17.0 ou a validação |
| conformidade-reviewer (1ª) | Conferir que `conta_externa.ligada` aparece no arquivo do titular | Já conferido pelo `privacy-guardian` (`packages/core/src/titular/compartilhamento.ts:48`); nada a fazer |
| privacy-guardian (1ª) | Guardar na auditoria se a ligação nasceu em "Eu" ou na aprovação | `TODO.md`, junto do item da linha 3283. Muda o dado da auditoria, e a tarefa não prevê |
| revisor-geral (1ª) | `dominioLiberado` aceitar `string \| undefined` e tirar o termo só de tipo | Recusada: mexe em método que existia antes da tarefa, e o motivo 4 de "Mutações" já explica o termo |
| revisor-geral (1ª) | Levar "visita seguinte a Eu" à validação | Já registrado na divergência 3 e no `TODO.md` (linha 3283) |
| infra-guardian (1ª) | Contar o `iniciarParaLigar` também no limite do usuário e da escola | `TODO.md`, na próxima rodada sobre o login externo. Muda o limite, e o vetor vale para o `iniciar` simples desde a 13.0 |
| test-engineer (1ª) | Cenário de carga: a turma inteira ligando ao mesmo tempo pelo IP da escola | Sem ação: o `infra-guardian` aprovou o rate limit desta rota ("ok") e a recomendação 6 desta ordem tira chamadas da rajada |
| infra-guardian (2ª) | A recusa por `auth_time` antigo entra no mesmo `ligacao_recusada` do domínio: um rótulo próprio ou um log com o motivo, e a checagem de NTP no runbook (folga de 120 s) | `TODO.md`. Rótulo novo de métrica pede o painel e o runbook, e a tarefa não prevê |
| infra-guardian (2ª) | Pôr o `staleTime` dentro de `acessoDaEscolaQueryOptions`, para `EntrarNaEscola.tsx` também usar | `TODO.md`. Muda a tela de entrada, fora do escopo desta tarefa |
| infra-guardian (2ª) | Contar o `iniciarParaLigar` no limite por usuário e por escola | Já no `TODO.md` (1ª rodada); nada a acrescentar |
| privacy-guardian (2ª) | Quando o Google não traz `auth_time`, a proteção é só o `select_account`; exigir a claim | Já no `TODO.md` ("Exigir o `auth_time` na ligação da conta em "Eu""). O Validador confirma com a escola piloto que o provedor a traz |
| privacy-guardian (2ª) | "Conta da escola ligada" mostrar o provedor e o domínio (nunca o e-mail) e o caminho para desligar | Item "Eu mostra a conta já ligada" do `TODO.md` (linha 3283), com a tabela "Recomendações sem aplicar" do documento |
| privacy-guardian (2ª) | O `auth_time` não tem limite superior: um valor no futuro passa | `TODO.md`, junto do item de exigir o `auth_time`. Endurecimento; o token é assinado |
| conformidade-reviewer (2ª) | O item "Eu mostra a conta já ligada" do `TODO.md` não fala em desligar (D59) | O destino já está na tabela "Recomendações sem aplicar" do documento, que o Validador lê; a frase no `TODO.md` entra quando o item for tratado |
| revisor-geral (2ª) | Os comentários do `staleTime` (`ContaDaEscola.tsx:11`, `ContaDaEscola.test.tsx:173`) prometem mais do que o código entrega: o ganho vale só para o mesmo aluno voltando a "Eu" na mesma sessão; o `gcTime` padrão é de 5 min | `TODO.md`. Só comentário, sem efeito no comportamento |
| revisor-geral (2ª) | Registrar na `techspec.md` §5, junto da trava, que a corrida da sessão que acaba depois da conferência é aceita | `TODO.md`. Hoje a decisão está no docblock de `travarAlunoDaSessao`, que o Validador lê |
| test-engineer (2ª) | O caso de `ligar-conta.int.test.ts:387` só mata a mutação de `sessao.id` pela ordem física das linhas (`.limit(1)` sem `ORDER BY`): criar uma sessão aberta do mesmo aluno antes da do `iniciar` | `TODO.md`. O código correto passa sempre; só a prova da mutação oscila |
| test-engineer (2ª) | A janela de 120 s não está provada (as amostras são 1970 e o ano 2100): um unitário de `#resultadoDaLigacao` com relógio falso, 119 s e 121 s, e decidir se `auth_time` no futuro é recusado | `TODO.md`, junto do item de exigir o `auth_time` |
| test-engineer (2ª) | A linha da tabela "a autenticação antiga não liga" diz "mais de 120 s", e o caso prova "muito antigo" | `TODO.md`, junto do item anterior |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 19:10:23 | 2026-11-09 19:11:09 | `tenancy-guardian` | 1 | APROVADO | a02b938eae6aba719 |
| 2026-11-09 19:10:34 | 2026-11-09 19:11:11 | `frontend-reviewer` | 1 | APROVADO | a7e840065fe3a34d8 |
| 2026-11-09 19:10:42 | 2026-11-09 19:11:22 | `conformidade-reviewer` | 1 | APROVADO | a8733db483d4ecd48 |
| 2026-11-09 19:10:26 | 2026-11-09 19:11:59 | `privacy-guardian` | 1 | REPROVADO | ada9ae468f3da4a4e |
| 2026-11-09 19:10:40 | 2026-11-09 19:12:16 | `revisor-geral` | 1 | APROVADO | ae1dffcbc070556f9 |
| 2026-11-09 19:10:29 | 2026-11-09 19:12:37 | `infra-guardian` | 1 | APROVADO | affdf520761bd72b5 |
| 2026-11-09 19:10:37 | 2026-11-09 19:13:07 | `test-engineer` | 1 | REPROVADO | a9390eb58f9b157ee |
| 2026-11-09 19:59:28 | 2026-11-09 19:59:53 | `tenancy-guardian` | 2 | APROVADO | a5d9847b2d37672a6 |
| 2026-11-09 19:59:43 | 2026-11-09 20:00:08 | `infra-guardian` | 2 | APROVADO | a15fb395b6fe19f8b |
| 2026-11-09 19:59:53 | 2026-11-09 20:00:20 | `frontend-reviewer` | 2 | APROVADO | a676aefea8e09fbca |
| 2026-11-09 19:59:37 | 2026-11-09 20:00:29 | `privacy-guardian` | 2 | APROVADO | a8ccf01a29b1bbf3a |
| 2026-11-09 20:00:18 | 2026-11-09 20:00:45 | `conformidade-reviewer` | 2 | APROVADO | a1f8969ad95590399 |
| 2026-11-09 20:00:11 | 2026-11-09 20:01:02 | `revisor-geral` | 2 | APROVADO | a19897f1b491a28be |
| 2026-11-09 20:00:05 | 2026-11-09 20:02:13 | `test-engineer` | 2 | APROVADO | a75dc27572f065a44 |
