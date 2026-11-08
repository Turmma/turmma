# Tarefa 7.0 — Posse do e-mail: verificar antes de a conta cruzar escolas (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O aceite por e-mail grava `emailVerificadoEm`; a conta com senha e sem verificação que aceita convite copiado de outra escola (o do painel também) recebe `VERIFICACAO_PENDENTE` e um link de verificar, e `POST /v1/conta/verificar` libera o aceite.

## Contexto necessário

- `techspec.md` seções 3 (`conta.emailVerificadoEm`), 5 ("Posse do e-mail", "Auditoria") e 13
- `prd.md` RF12, RF17 e o caso de borda "Conta de link copiado"; `cenarios.md` "Posse do e-mail" e "A1 e F2 que mudam de regra"
- `.claude/rules/20` item 8; `.claude/rules/80` item 7
- `apps/api/src/sessao/convite/convite.service.ts:91` (`aceitar`) e o aceite do painel em `apps/api/src/operacao/`

## Subtarefas

- [x] 7.1 — Migration `conta.emailVerificadoEm`
- [x] 7.2 — O aceite: verifica pelo canal `email`; `VERIFICACAO_PENDENTE` e o link (24 h, 3/h por conta) no copiado de outra escola
- [x] 7.3 — `POST /v1/conta/verificar`; o redefinir também verifica; `conta.email_verificado` por escola
- [x] 7.4 — Os casos da A1 (`convite.int.test.ts:320`, `:377`, `:447`) e o do RF6 do F2 (`professores.int.test.ts:900`) com a regra nova, e o nome do caso trocado
- [x] 7.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0044_email_verificado.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/conta.ts` | alterado |
| `apps/api/src/sessao/convite/convite.service.ts` | alterado |
| `apps/api/src/sessao/convite/convite.repository.ts` | alterado |
| `apps/api/src/sessao/senha/senha.service.ts` | alterado |
| `apps/api/src/sessao/senha/conta.controller.ts` | novo |
| `packages/shared/src/sessao/convite.ts` | alterado |
| `packages/shared/src/sessao/senha.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `apps/api/test/convite.int.test.ts` | alterado |
| `apps/api/test/professores.int.test.ts` | alterado |
| `apps/api/test/posse-do-email.int.test.ts` | novo |
| `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` (+ `.test.ts` e `.int.test.ts`) | alterado: a posse e o cruzamento lidos com o convite; `posseDaConta`, `marcarEmailVerificado`, `emailDaConta`, `segurarContaParaLink` (o `convite.repository.ts` previsto não muda: a conta é global e o desvio da regra 10 mora aqui) |
| `apps/api/src/sessao/sessao.module.ts` | alterado: o `ContaController` e o `SenhaService` no `ConviteService` |
| `packages/core/src/error/domain.exception.ts`, `packages/shared/src/errors/error-code.ts`, `messages.ts`, `packages/shared/src/index.ts` | alterados: `VERIFICACAO_PENDENTE` (409) e o corpo do verificar |
| `packages/core/src/ciclo-de-vida/conta-global.repository.ts`, `packages/core/src/titular/leitura-do-titular.ts`, `packages/core/src/index.ts` | alterados: a conta limpa zera a posse; o campo no arquivo do titular; o tipo `CanalDeConvite` |
| `apps/api/test/ativacao.fixture.ts`, `apps/api/test/ciclo-de-vida.int.test.ts`, `apps/api/test/architecture.test.ts` | alterados: contas dos fixtures já verificadas; a limpeza zera a posse; as listas fixas |
| `e2e/support/seed.ts`, `tools/vitrine/escola.ts` | alterados: a conta de equipe (`criarEquipeComSenha`, `criarPessoaNaEscola`) e a professora da vitrine nascem com `email_verificado_em = now()` |
| `e2e/convite.spec.ts`, `e2e/entrar-convite-revogado.spec.ts` | alterados: o comentário da 7.0 no topo; os casos seguem pelo aceite (o portão os roda por estarem na árvore) |
| `docs/modelo-de-dados.md`, `techspec.md` §5, `cenarios.md` | alterados: o campo, "outra escola", a corrida do aceite |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| aceite pelo e-mail | integração | grava `emailVerificadoEm` | `posse-do-email` › o aceite pelo e-mail grava … |
| aceite pelo link copiado | integração | não grava | › o aceite pelo link copiado não grava a posse … |
| conta não verificada, convite copiado de outra escola | integração | `VERIFICACAO_PENDENTE` e link de verificar | › conta com senha e sem posse … |
| o mesmo pelo painel | integração | `VERIFICACAO_PENDENTE` | › o mesmo convite do painel da operação … |
| depois de verificar | integração | o aceite segue | › depois de verificar, o aceite segue … |
| senha definida pelo link de uma escola | integração | não abre o convite de outra | › a senha definida pelo link de uma escola não abre … e › os dois aceites da conta nova convidada por A e por B … |
| quarto aceite na hora | integração | `VERIFICACAO_PENDENTE` e três envios, cada link invalida o anterior | › o quarto aceite na hora … e › o teto de 3 por hora é por conta … |
| envio do link antigo `na_fila` | integração | `cancelado`, cifrados nulos, não sai | › o quarto aceite na hora … (o `na_fila` vira `cancelado`, sem cifrados) |
| conta nova pelo convite copiado | integração | aceita sem verificação | › o aceite pelo link copiado não grava a posse … |
| redefinir pelo "esqueci" | integração | grava `emailVerificadoEm` | › redefinir pelo link do "esqueci" grava … e › depois de redefinir, a conta que cruza escolas … |
| token do verificar | integração | depois do `#` | `packages/core/src/email/mensagem-do-link-da-conta.test.ts` (5.0: o link do e-mail leva o token depois do `#`) e, na API, › o token vai no corpo, nunca na query … |
| job da conta nascido no aceite | integração | escola nula no job | › conta com senha e sem posse … (job de sistema sem escola) |
| `conta.email_verificado` pelo verificar, conta nas escolas A e B | integração | um por escola; com a B desativada, só na A | › `conta.email_verificado` pelo verificar: um por escola … e › com o usuário da B desativado … |
| conta da A aceita por e-mail convite da B | integração | o registro sai só na B | › o aceite pelo e-mail grava … |
| usuário desativado entre o link e o verificar | integração | link inválido, sem registro | › o usuário desativado entre o link e o verificar, sem convite válido à espera … (antes da leitura) e › o usuário desativado depois da leitura do link … (dentro da transação, a trava força a ordem) |
| `convite.int.test.ts:320`, `:377`, `:447` | integração | o copiado passa a exigir o e-mail verificado | `convite.int.test.ts`: as contas de B (`coordenadoraDeB`, `professoraDeB`) nascem verificadas; a corrida da mesma conta nova, A e B, reescrita para `VERIFICACAO_PENDENTE` |
| `e2e/convite.spec.ts` (`:211`, `:229`, `:355`) e `e2e/entrar-convite-revogado.spec.ts` (`:20`, `:59`) | e2e | a conta de equipe do `e2e/support/seed.ts` (e a da `tools/vitrine/escola.ts`) nasce com o e-mail verificado, e o convite copiado de outra escola segue pelo aceite, sem `VERIFICACAO_PENDENTE` | `convite.spec.ts` › o professor que já tem conta em outra escola aceita sem senha nova, e o login com a senha dele abre a escolha entre as duas · › quem já tem conta em outra escola vai para a entrada, sem campo de senha nova, e o login ativa a escola do convite · › recomeço, resposta atrasada: o aceite do link anterior que responde depois de outro link chegar à aba não entra… ; `entrar-convite-revogado.spec.ts` › a senha certa com o convite revogado depois do aceite mostra o texto de convite inválido, sem falar da senha · › com segundo fator: o código certo com o convite revogado leva à entrada com o texto de convite inválido… |
| RF6 do F2 (segundo vínculo) | integração | exige o verificado, com a regra no nome | `professores.int.test.ts`: o caso do RF6 renomeado "… com o e-mail verificado (7.0) …" |
| [P] dois aceites que pedem verificação: o 1º preso no insert do link | paralelo | os dois `VERIFICACAO_PENDENTE`, um link aberto, nada da outra escola; cai sem o `catch` | › [P] dois aceites que pedem verificação, o primeiro preso no insert … |
| professor desativado na A, convite copiado da B já emitido (conta com senha, sem posse) | integração | recebe o link; o verificar grava a posse sem registro; o aceite segue | › o professor desativado na A com o convite copiado da B já emitido … |
| `contaEmUso`: ativo, convite válido, usado, revogado, vencido, nada | integração | só serve o ativo e o que espera convite válido | `tenant-resolution.repository.int.test.ts` › contaEmUso … |
| teto de 3 por hora com o Redis de fila fora | integração | cai para o seguro em memória (3 ÷ 4 = 1), nunca 500 | › com o Redis de fila fora, o teto de 3 por hora cai para o seguro … |
| [P] verificar com o envio antigo preso na barreira | paralelo | antigo `cancelado` e recusado em `/conta/verificar` | › o link antigo semeado em `enviando` … (sequencial) e › [P] o link antigo preso na barreira do envio e o aceite parado depois de cancelá-lo … (o `verificar` espera a conta; sem a trava de conta no pedido do link, o par trava em 40P01) |

## Como testar

- Precedente: `apps/api/test/professores.int.test.ts` › "E10: o aceite na escola B com a conta que já tem usuário em A não cria conta e cria o usuário de B…"; `ActivationScenario` (`apps/api/test/ativacao.fixture.ts`: `convidar`, `aceito`)
- Corrida: `apps/api/test/convite.int.test.ts:302` › "concorrência (regra 80, item 7): dois aceites em paralelo com o mesmo token…"
- Comando: `npx vitest run --project integracao apps/api/test/posse-do-email.int.test.ts apps/api/test/convite.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: o aceite pode cair no "convite inválido" antes da verificação; confira que o cenário chega nela.

**Respostas (plano, antes de codar):**

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco para: cada termo de `exigeVerificacao` (`canal === 'copiado'`, `contaTemSenha`, `!emailVerificado`, `cruzaEscolas`), o `if` que pede o link, o critério "a conta serve" (`contaEmUso`: o `false` do `finalidade === 'verificar'`, o `ternário` com o convite, cada termo do convite válido) e a guarda do `verificar` com ele, o `<>` do "cruza escolas", o `!== null` da posse (no convite e no recheck), o recheck dentro da transação (o `if` interno, o `!senhaDefinida`, o `throw`), o `catch` que traduz a perda da corrida, o `canal === 'email'` e o `marcarEmailVerificado` do aceite, o `is null` do `marcarEmailVerificado` (uma passagem só), o teto de 3/h e a contagem, os 24 h, o `cancelarLinksAbertos`, o `segurarContaParaLink` (a ordem de travas), cada guarda do `verificar` (link inválido, `usado`, `usuarios.length`), o `if (marcar…)` do verificar e do redefinir, o registro por escola, a limpeza da conta, o 204, o `no-store`, o `.strict()` e o 409. O que ficou sem bloco está no `--faltando` com o motivo (o `posse !== undefined` e o `email === undefined` não têm cenário que os alcance: a conta do convite existe; o `usado.contaId !== valido.contaId` é a defesa de um hash que é único).
2. **Texto na tela:** nenhum. A tarefa é só API; a tela "Verificar" e o aviso são da 8.0. `grep -rln 'VERIFICACAO_PENDENTE' e2e/ apps/web/src` não acha nada.
3. **Segundo dado que torna a cláusula observável:** a conta com usuário em **duas** escolas (senão o "cruza escolas" passa com um só), a conta com a B desativada (só a A recebe o registro), a conta já verificada e a não verificada com o mesmo convite, a conta sem senha convidada por A **e** por B (a senha só vem do primeiro aceite), duas contas no teto de 3/h, o link antigo em `na_fila` e em `enviando`, o usuário desativado na A com e sem convite válido da B (a conta serve ou não), e o convite em cada estado (válido, usado, revogado, vencido).
4. **Checagem anterior que responde antes da regra:** o `conviteValidoPorHash` responde "convite inválido" antes da verificação; todo cenário parte de um convite válido, copiado e de conta que cruza (o `contaQueCruza`), e o teste confere que o convite continua sem uso (a verificação respondeu, não o "inválido"). O corpo vazio e o token com chave a mais caem no Zod antes do serviço: o caso do token confere os dois 400 e que a query é ignorada.
5. **A asserção olha o resultado:** o status e o `code` da resposta, as linhas de `link_da_conta` (envio, cifrados, `usado_em`, validade em segundos), o job em `job_registro` (escola nula), as linhas de auditoria por escola e `conta.email_verificado_em` no banco; nenhum teste olha texto de arquivo.
6. **Guarda nova:** nenhuma (nem regra de lint, nem teste estrutural). As listas fixas de `architecture.test.ts` e do teste do repository ganharam os nomes novos.
7. **Comentário que afirma o que o código não faz:** relidos contra o código o docblock de `aceitar` ("outra escola" = qualquer `usuario` em escola diferente da do convite, em qualquer estado), o do `exigeVerificacao`, o de `segurarContaParaLink` (a ordem conta → link, igual ao redefinir e ao verificar) e o do `conta.emailVerificadoEm`; a Tech Spec §5 e o `cenarios.md` dizem o mesmo.
8. **Divergência:** uma, na tabela abaixo. A Tech Spec dizia "outra escola" sem dizer em que estado; o convite cria o `usuario` inativo, então o cruzamento conta o usuário em qualquer estado. O recheck na transação (a corrida da conta convidada por duas escolas) e o pedido do link fora da transação do aceite foram escritos na Tech Spec §5 e no `cenarios.md` antes da primeira rodada.
9. **Peça que já existe:** `#abrirLink`, `WindowCounter`, `SecretCipher`, `JobOutbox` e o processor genérico do e-mail da conta (5.0), `travarContaParaRedefinir`, `usarLinkPorHash`, `usuariosAtivosDaConta`, `AuditoriaRecorder`, `linkJaAberto` e `WriteBlockTrigger`. Peça nova: a coluna, a ação de auditoria, `pedirVerificacao`/`verificar`, os quatro métodos do repository e o controller.
10. **Paralelo:** dois aceites que pedem verificação com o primeiro preso no insert do link; os dois aceites da conta convidada por duas escolas (o da B preso no uso do convite, o da A confirma antes); dois `verificar` com o mesmo token (o primeiro preso depois de gastar o link, o segundo espera a conta); o `verificar` do link antigo contra o aceite parado no insert do novo (ordem forçada pela barreira, e é o que pega o deadlock de conta e link).
11. **Isolamento e coluna "Caso":** o registro `conta.email_verificado` sai só na escola certa (nunca na da outra), a resposta não traz id de escola nem de usuário, e a conta é global (sem escola); a coluna "Caso" acima tem o caso de cada linha.
12. **Guardiões:** `tenancy-guardian` (os quatro métodos novos com `@Unscoped` e a justificativa de uma linha; o registro por escola), `privacy-guardian` (o campo no mapa de dados e no arquivo do titular, nada do e-mail nem do token na resposta ou no log, token só no corpo), `infra-guardian` (3/h por conta, 24 h, ordem de travas conta → link, a corrida resolvida no banco com o 23505, 202 sem trabalho demorado: o envio vai à fila) e `test-engineer` (mutações, paralelos, coluna "Caso").

## Fora do escopo desta tarefa

A tela "Verificar" e o aviso no aceite (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O link de verificar vale também para a conta cujo único usuário espera um convite válido (o professor que saiu da A com o convite da B já emitido); sem usuário ativo nem convite válido, é link inválido | A limpeza da conta já mantém a conta enquanto o convite vale; sem isso a pessoa receberia um link que nunca funciona e o laço de 3 e-mails por hora (reprovação do `revisor-geral`, 1ª rodada) | `techspec.md` §5 "Posse do e-mail" (último período); `cenarios.md` "Posse do e-mail" (professor desativado na A) e "Auditoria e dado" |
| "Outra escola" é qualquer `usuario` da conta em escola diferente da do convite, em qualquer estado; e o aceite que perde a corrida da senha refaz a conta dentro da transação | O convite cria o `usuario` inativo: contar só o ativo deixaria a conta convidada por A e por B abrir a B com a senha da A | `techspec.md` §5 "Posse do e-mail"; `cenarios.md` "Posse do e-mail" (conta nova convidada por A e B em paralelo) |

## Mutações

Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho.

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o aceite pelo e-mail grava
-  convite.canal === 'copiado' && convite.contaTemSenha && !convite.emailVerificado && convite.cruzaEscolas
+  convite.contaTemSenha && !convite.emailVerificado && convite.cruzaEscolas
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › a senha definida pelo link de uma escola não abre
-  convite.canal === 'copiado' && convite.contaTemSenha && !convite.emailVerificado && convite.cruzaEscolas
+  convite.canal === 'copiado' && !convite.emailVerificado && convite.cruzaEscolas
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › a conta que já tinha a posse provada
-  convite.canal === 'copiado' && convite.contaTemSenha && !convite.emailVerificado && convite.cruzaEscolas
+  convite.canal === 'copiado' && convite.contaTemSenha && convite.cruzaEscolas
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › a conta com senha que só tem usuário na própria escola
-  convite.canal === 'copiado' && convite.contaTemSenha && !convite.emailVerificado && convite.cruzaEscolas
+  convite.canal === 'copiado' && convite.contaTemSenha && !convite.emailVerificado
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › conta com senha e sem posse
-    if (exigeVerificacao(valido)) return this.#pedirVerificacao(valido.contaId)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › os dois aceites da conta nova convidada por A e por B
-          if (posse !== undefined && exigeVerificacao({ canal: valido.canal, contaTemSenha: true, ...posse })) throw new PosseNaoProvada()
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › os dois aceites da conta nova convidada por A e por B
-        if (senhaHash !== undefined && !senhaDefinida) {
+        if (senhaHash !== undefined) {
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › os dois aceites da conta nova convidada por A e por B
-      if (erro instanceof PosseNaoProvada) return 'posse_pendente' as const
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › os dois aceites da conta nova convidada por A e por B
-    if (aceite === 'posse_pendente') return this.#pedirVerificacao(valido.contaId)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o aceite pelo link copiado não grava a posse
-          if (valido.canal === 'email' && (await resolucaoNaTransacao.marcarEmailVerificado(valido.contaId))) await registro.gravar(tx, 'conta.email_verificado', { entidadeId: usado.usuarioId })
+          if (await resolucaoNaTransacao.marcarEmailVerificado(valido.contaId)) await registro.gravar(tx, 'conta.email_verificado', { entidadeId: usado.usuarioId })
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o aceite pelo e-mail grava
-          if (valido.canal === 'email' && (await resolucaoNaTransacao.marcarEmailVerificado(valido.contaId))) await registro.gravar(tx, 'conta.email_verificado', { entidadeId: usado.usuarioId })
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o quarto aceite na hora
-    if (await this.#contar('porHora', PREFIXO_DA_VERIFICACAO_POR_CONTA, contaId, LIMITE_DA_VERIFICACAO_POR_CONTA_HORA)) return
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o teto de 3 por hora é por conta
-export const LIMITE_DA_VERIFICACAO_POR_CONTA_HORA = 3
+export const LIMITE_DA_VERIFICACAO_POR_CONTA_HORA = 4
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › conta com senha e sem posse
-export const VALIDADE_DO_LINK_DE_VERIFICAR_MS = 24 * 60 * 60 * 1000
+export const VALIDADE_DO_LINK_DE_VERIFICAR_MS = 60 * 60 * 1000
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o quarto aceite na hora
-        await resolucao.cancelarLinksAbertos(contaId, finalidade)
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o link antigo preso na barreira do envio e o aceite parado depois de cancelá-lo
-        await resolucao.segurarContaParaLink(contaId)
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o token vencido, o de redefinir e o inexistente
 const valido = await resolucao.linkValidoPorHash(tokenHash, 'verificar')
-    if (valido === undefined) throw linkInvalido()
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › dois verificar com o mesmo token
 const usado = await naTransacao.usarLinkPorHash(tokenHash, 'verificar')
-      if (usado === undefined || usado.contaId !== valido.contaId) throw linkInvalido()
+      if (usado!.contaId !== valido.contaId) throw linkInvalido()
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o usuário desativado e o convite revogado depois da leitura do link
-      if (usuarios.length === 0 && !(await naTransacao.contaEmUso(valido.contaId))) throw linkInvalido()
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › o professor desativado na A com o convite copiado da B já emitido
-      if (usuarios.length === 0 && !(await naTransacao.contaEmUso(valido.contaId))) throw linkInvalido()
+      if (usuarios.length === 0) throw linkInvalido()
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/posse-do-email.int.test.ts › o professor desativado na A com o convite copiado da B já emitido
-          this.#contaEmUso(conta.id, finalidade === 'verificar'),
+          this.#contaEmUso(conta.id, false),
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › contaEmUso
-    const serve = comConvite ? sql`(${usuario.desativadoEm} is null or ${esperaConvite})` : sql`${usuario.desativadoEm} is null`
+    const serve = sql`${usuario.desativadoEm} is null`
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › contaEmUso
-and ${convite.usadoEm} is null and
+and
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › contaEmUso
-and ${convite.revogadoEm} is null and
+and
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › contaEmUso
-and ${convite.expiraEm} > now())`
+and true)`
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › pelo verificar: um por escola
 if (usuarios.length === 0 && !(await naTransacao.contaEmUso(valido.contaId))) throw linkInvalido()
-      if (await naTransacao.marcarEmailVerificado(valido.contaId)) await this.#auditarPorEscola(tx, requisicaoId, usuarios, 'conta.email_verificado')
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › a conta já verificada que abre um link de verificar
 if (usuarios.length === 0 && !(await naTransacao.contaEmUso(valido.contaId))) throw linkInvalido()
-      if (await naTransacao.marcarEmailVerificado(valido.contaId)) await this.#auditarPorEscola(tx, requisicaoId, usuarios, 'conta.email_verificado')
+      await naTransacao.marcarEmailVerificado(valido.contaId)
+      await this.#auditarPorEscola(tx, requisicaoId, usuarios, 'conta.email_verificado')
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › redefinir pelo link do
-      if (await naTransacao.marcarEmailVerificado(valido.contaId)) await this.#auditarPorEscola(tx, requisicaoId, usuarios, 'conta.email_verificado')
 })
 this.#logger.log('senha.redefinida')
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/posse-do-email.int.test.ts › pelo verificar: um por escola
-    for (const ativo of usuarios) if (!porEscola.has(ativo.escolaId)) porEscola.set(ativo.escolaId, ativo.usuarioId)
+    for (const ativo of usuarios) if (porEscola.size === 0) porEscola.set(ativo.escolaId, ativo.usuarioId)
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/posse-do-email.int.test.ts › a conta com senha que só tem usuário na própria escola
-    return sql<boolean>`exists (select 1 from usuario as outro where outro.conta_id = ${contaId} and outro.escola_id <> ${escolaDoConvite})`
+    return sql<boolean>`exists (select 1 from usuario as outro where outro.conta_id = ${contaId} and outro.escola_id = ${escolaDoConvite})`
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/posse-do-email.int.test.ts › o segundo aceite por e-mail de uma conta já verificada
-      .where(and(eq(conta.id, contaId), isNull(conta.emailVerificadoEm)))
+      .where(eq(conta.id, contaId))
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/posse-do-email.int.test.ts › a conta que já tinha a posse provada
 contaTemSenha: linha.senhaHash !== null,
-          emailVerificado: linha.emailVerificadoEm !== null,
+          emailVerificado: linha.emailVerificadoEm === null,
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/posse-do-email.int.test.ts › os dois aceites da conta nova convidada por A e por B
-    return linha === undefined ? undefined : { emailVerificado: linha.emailVerificadoEm !== null, cruzaEscolas: linha.cruzaEscolas }
+    return linha === undefined ? undefined : { emailVerificado: linha.emailVerificadoEm === null, cruzaEscolas: linha.cruzaEscolas }
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › isolamento: a professora desativada em A, com usuário ativo em B
-      .set({ email: null, emailVerificadoEm: null, senhaHash: null, mfaSegredoCifrado: null, mfaChaveVersao: null, mfaAtivadoEm: null, mfaUltimoPasso: null })
+      .set({ email: null, senhaHash: null, mfaSegredoCifrado: null, mfaChaveVersao: null, mfaAtivadoEm: null, mfaUltimoPasso: null })
```

```mutacao
arquivo: apps/api/src/sessao/senha/conta.controller.ts
teste: apps/api/test/posse-do-email.int.test.ts › depois de verificar, o aceite segue
-  @HttpCode(HttpStatus.NO_CONTENT)
```

```mutacao
arquivo: apps/api/src/sessao/senha/conta.controller.ts
teste: apps/api/test/posse-do-email.int.test.ts › o token vai no corpo, nunca na query
-  @Header('Cache-Control', 'no-store')
```

```mutacao
arquivo: packages/shared/src/sessao/senha.ts
teste: apps/api/test/posse-do-email.int.test.ts › o token vai no corpo, nunca na query
-export const verificarContaRequestSchema = z.object({ token: z.string().min(1).max(TAMANHO_MAXIMO_TOKEN_DE_CONVITE) }).strict()
+export const verificarContaRequestSchema = z.object({ token: z.string().min(1).max(TAMANHO_MAXIMO_TOKEN_DE_CONVITE) })
```

```mutacao
arquivo: packages/core/src/error/domain.exception.ts
teste: apps/api/test/posse-do-email.int.test.ts › conta com senha e sem posse
-  VERIFICACAO_PENDENTE: 409,
+  VERIFICACAO_PENDENTE: 400,
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › duas contas no banco
 .from(conta)
-      .where(eq(conta.id, contaId))
 .limit(1)
 return linha === undefined ? undefined : { emailVerificado: linha.emailVerificadoEm !== null, cruzaEscolas: linha.cruzaEscolas }
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/src/sessao/tenant/tenant-resolution.repository.int.test.ts › duas contas no banco
-    const [linha] = await this.banco.select({ email: conta.email }).from(conta).where(eq(conta.id, contaId)).limit(1)
+    const [linha] = await this.banco.select({ email: conta.email }).from(conta).limit(1)
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/posse-do-email.int.test.ts › o link antigo preso na barreira do envio e o aceite parado depois de cancelá-lo
-    await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.id, contaId)).for('key share')
+    await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.id, contaId))
```

O que o `--faltando` ainda lista, sem bloco, e por quê: `if (email === undefined) return` (o pedido só chega com o `contaId` de um convite que existe, e a conta com convite tem e-mail; a conta limpa não tem convite que a segure), `travarContaParaRedefinir(...) === undefined` no `verificar` (a conta do link existe, a FK a segura) `currentContext()?.requisicaoId ?? randomUUID()` (o mesmo reserva do `redefinir`, aprovado na 5.0), o `? undefined` do `conviteValidoPorHash` (a linha que já existia, agora com mais colunas) o `.where(...)` e o `?? false` do `contaEmUso` (o sim ou não é calculado com o `contaId` do argumento; sem a linha da conta o resultado é o mesmo `false`) e o `?? undefined` do `emailDaConta` (só estreita o tipo do e-mail nulo; o caso da conta inexistente já o cobre). Fora da lista do `--faltando`, porque a linha já tem bloco (o `false`): a mutação `finalidade === 'verificar'` → `true` em `linkValidoPorHash` sobrevive, e de propósito. No redefinir, a conta que só espera convite passaria pela leitura do link, mas a guarda `usuarios.length === 0` dentro da transação (`senha.service.ts`, `redefinir`) devolve o mesmo 404 de link inválido; o custo é o argon2 rodar antes de recusar, sem mudar a resposta nem o banco.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `convite.service.ts:119`: a resposta do aceite muda conforme o estado da conta; "vale registrar o caso na AIA ou no `docs/lgpd.md` como exposição aceita, ou responder igual nos dois casos numa spec futura" | `TODO.md`, com a nota "a aceitação da exposição é do Joaquim" (o texto da Tech Spec foi corrigido na rodada 1). Registrar exposição aceita em `docs/lgpd.md` ou AIA é decisão, não correção |
| tenancy-guardian (1ª) | O `TenantResolutionRepository` passa de 35 `@Unscoped`; separar o que é da conta global num repository próprio, nos moldes do `ContaGlobalRepository` | Retro da funcionalidade, como o revisor sugeriu. Mexe em repository e em lista fixa fora do que a tarefa toca |
| revisor-geral (1ª) | `senha.service.ts:239`: `travarContaParaRedefinir` com nome neutro (`travarConta`) ou método próprio | Retro, junto com a linha acima. O método é usado também por `apps/api/src/sessao/mfa/redefinicao-de-mfa.ts` (linhas 37 e 75) e por duas listas de `tenant-resolution.repository.test.ts`, que a tarefa não toca |
| infra-guardian (1ª) | Contador próprio do `VERIFICACAO_PENDENTE` e do teto de 3/h | `TODO.md`. É métrica nova, código novo, e a métrica HTTP genérica já cobre a rota |
| infra-guardian (1ª) | Uma linha no runbook ou na tela da 8.0 apontando o "esqueci a senha" quando o link não chega | Tarefa 8.0 (a tela do aceite), com a linha do runbook junto |
| test-engineer (1ª) | O bloco de `if (valido === undefined) throw linkInvalido()` fica vermelho por TypeError (500); um caso que distinga "500" de "404" | Recusada: o portão exige o vermelho de um caso que rodou e falhou, e recusa só o erro de carga (`tools/processo/mutacoes.ts`, regra 40, seção "O portão"). O TypeError acontece dentro do caso que rodou |
| revisor-geral (2ª) | O critério de "a conta serve" está escrito duas vezes (`conta-global.repository.ts:64-71`, `limparContaSemUso`, e `#contaEmUso`); extrair um só predicado no `core` | Retro da funcionalidade. Mexe em `ContaGlobalRepository`, fora do que a tarefa toca, e a limpeza tem os testes da A1 |
| tenancy-guardian (2ª) | Comentário, ou bloco no `--faltando`, dizendo que `convite.escolaId = usuario.escolaId` em `#contaEmUso` é defesa redundante da FK composta | `TODO.md` |
| privacy-guardian (2ª) | O texto de `leitura-do-titular.ts` diz que o fato chega pelo registro `conta.email_verificado`, que não existe no caminho novo (verificar sem usuário ativo); corrigir o texto para "quando a conta tem usuário ativo", ou gravar o registro na escola do convite à espera | Retro, como o próprio revisor indicou. Gravar o registro mudaria a regra da §5 "Auditoria" |
| privacy-guardian (2ª) | `techspec.md` §13 admite o que a coordenação da escola do link sabe pelo `VERIFICACAO_PENDENTE`; o `tenancy-guardian` deveria confirmar que o risco aceito vale para a regra 10, ou registrá-lo como decisão | `TODO.md`, na mesma linha da recomendação da rodada 1 (registro da exposição aceita): a aceitação é do Joaquim, via Orquestrador |
| infra-guardian (2ª) | O caso do Redis fora depende de o Redis ficar travado por 15 s; na esteira, observar se falha de forma intermitente | Sem ação do Implementador. O Orquestrador lê a esteira: se o caso falhar intermitente, vira correção |
| revisor-geral (3ª) | Os números de linha dos e2e aparecem em `7_task.md` e em `cenarios.md`; qualquer edição no topo dos `.spec.ts` os desalinha de novo, e o nome do caso basta como referência | `TODO.md`. O revisor aprovou, e os números estão certos hoje |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 05:43:53 | 2026-11-08 05:44:17 | `conformidade-reviewer` | 1 | APROVADO | aa27f0b77de2d2b5c |
| 2026-11-08 05:43:34 | 2026-11-08 05:44:53 | `tenancy-guardian` | 1 | APROVADO | a67d6dbbd28c48338 |
| 2026-11-08 05:43:38 | 2026-11-08 05:45:21 | `privacy-guardian` | 1 | APROVADO | a4c3661165afa04f1 |
| 2026-11-08 05:43:42 | 2026-11-08 05:45:59 | `infra-guardian` | 1 | APROVADO | ac0a60169cab28861 |
| 2026-11-08 05:43:50 | 2026-11-08 05:46:30 | `revisor-geral` | 1 | REPROVADO | af7318fbe3666407d |
| 2026-11-08 05:43:46 | 2026-11-08 05:48:26 | `test-engineer` | 1 | REPROVADO | ac74de6e401b9cd34 |
| 2026-11-08 06:47:54 | 2026-11-08 06:48:34 | `revisor-geral` | 2 | APROVADO | a1cfa4fa879b0bb42 |
| 2026-11-08 06:48:32 | 2026-11-08 06:48:51 | `conformidade-reviewer` | 2 | APROVADO | ae22d9ec2d04c2054 |
| 2026-11-08 06:48:11 | 2026-11-08 06:48:56 | `tenancy-guardian` | 2 | APROVADO | a6311c715c3ddcf11 |
| 2026-11-08 06:48:19 | 2026-11-08 06:49:07 | `privacy-guardian` | 2 | APROVADO | a5cd9e0874685c096 |
| 2026-11-08 06:48:27 | 2026-11-08 06:49:12 | `infra-guardian` | 2 | APROVADO | a774099d650adf0bd |
| 2026-11-08 06:48:03 | 2026-11-08 06:50:18 | `test-engineer` | 2 | REPROVADO | a67bca02fb0611a56 |
| 2026-11-08 07:15:19 | 2026-11-08 07:15:42 | `test-engineer` | 3 | APROVADO | a62341dcb41933b78 |
| 2026-11-08 07:15:27 | 2026-11-08 07:15:55 | `revisor-geral` | 3 | APROVADO | a8457bfe59441cfd1 |
