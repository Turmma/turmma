# Tarefa 10.0 — O aluno entra com a provisória e troca a senha (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O login de matrícula com a provisória devolve `{ etapa: 'trocar_senha', bilhete }`; com o bilhete, `/trocas` lista as 10 provisórias anteriores e `trocar-senha` grava a senha do aluno e abre a sessão, uma vez só; falha nenhuma revela se o aluno existe.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Senha provisória", "Auditoria") e 7c; `prd.md` RF13, RF16, RF17; `cenarios.md` RF13, "Corridas", "Limites", "Carga"
- `.claude/rules/20` itens 6 e 9; `.claude/rules/80` itens 1, 6 e 7
- `matricula.service.ts`, `credencial/challenge.ts`, `login-lockout.ts`, `sessao/convite/convite-ticket.ts`

## Subtarefas

- [x] 10.1 — O bilhete (`jose`, `typ` e `aud` próprios, 10 min, escola, aluno, `provisoriaExpiraEm`), só no `Authorization`
- [x] 10.2 — A etapa `trocar_senha` no login de matrícula; o aluno sem `senha_hash` contra o hash fixo
- [x] 10.3 — `trocar-senha` e `/trocas` em `naEscolaSemUsuario` com a escola do bilhete; o `update` condicionado; `.usada`; `no-store`
- [x] 10.4 — O roteiro de carga com a provisória e a conta externa na rajada (`infra/scripts/carga-login.ts`), e o [C] na fase `professores` (`carga-importacao.ts`, `importacao-7h30.js`)
- [x] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/credencial/bilhete-da-troca.ts` | novo |
| `apps/api/src/credencial/bilhete-da-troca.test.ts` | novo |
| `apps/api/src/sessao/login/matricula.service.ts` | alterado |
| `apps/api/src/sessao/login/matricula.controller.ts` | alterado |
| `apps/api/src/credencial/credencial-matricula.repository.ts` | alterado |
| `packages/shared/src/sessao/senha-provisoria.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `infra/scripts/carga-login.ts` | alterado |
| `apps/api/src/credencial/index.ts` | alterado (exporta `BilheteDaTroca` para o teste de integração, que só importa da porta de `credencial/`) |
| `apps/api/test/troca-da-provisoria.int.test.ts` | novo |
| `apps/api/src/sessao/login/troca-da-provisoria.service.ts` | novo (a troca e a lista, fora do `matricula.service.ts` para ele não passar do teto de tamanho) |
| `apps/api/src/credencial/request-origin.ts`, `apps/api/src/credencial/senha/password-verifier.ts`, `apps/api/src/sessao/sessao.module.ts` | alterados (o resultado do login com a etapa, a digitação da provisória, a injeção) |
| `packages/core/src/auditoria/auditoria.repository.ts` | alterado (a leitura das provisórias anteriores) |
| `packages/shared/src/index.ts`, `packages/shared/src/sessao/senha-provisoria.test.ts` | alterado e novo |
| `apps/api/test/architecture.test.ts` | alterado (`senha_provisoria.usada` na lista das ações da própria pessoa) |
| `infra/k6/login-7h30.js`, `infra/test/carga-login.test.ts` | alterados (a rajada com a provisória e a conta externa) |
| `infra/scripts/carga-importacao.ts`, `infra/scripts/conferir-carga-importacao.ts`, `infra/k6/importacao-7h30.js`, `infra/test/carga-importacao.test.ts`, `docs/runbook.md` | alterados (o [C]: a fase `professores` com a rajada ao lado e o redefinir) |
| `tasks/prd-acesso-e-convites/techspec.md`, `tasks/prd-acesso-e-convites/cenarios.md` | alterados (a divergência do [C], a digitação da provisória e o contador) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| login com a provisória | integração | bilhete, não sessão; o bilhete não abre outra rota; a provisória vence em 24 h | `troca-da-provisoria.int.test.ts` › "devolve o bilhete e nenhuma sessão" (sem cookie, sem sessão nem registro de acesso, o bilhete e o token de acesso não se servem); "a provisória vale como a tela a mostra" (hífen, minúsculas, espaços); "a provisória vence em 24 h" (a de 23 h59 entra, a de 24 h01 é a resposta da senha errada); "a senha do aluno vale sozinha" |
| matrícula inexistente, aluno só com conta externa, senha errada | integração | mesma resposta; o sem `senha_hash` passa pelo hash fixo (espião, nunca cronômetro) | `troca-da-provisoria.int.test.ts` › "privacidade: matrícula inexistente, aluno só com a conta da escola e senha errada" (três respostas iguais; o espião de `PasswordHasher.verificar` vê `fixo, fixo, guardado`) |
| [U] o bilhete | unidade | escola, aluno e `provisoriaExpiraEm`, sem hash nem senha; adulterado ou de outra chave, recusado | `bilhete-da-troca.test.ts` › "leva a escola, o aluno e o vencimento da provisória…" e "borda: adulterado, de outra chave, quebrado ou com o conteúdo fora do formato" |
| [U] `typ` e `aud`, um de cada vez | unidade | o `typ` do bilhete com a `aud` do desafio, e o inverso: recusados | `bilhete-da-troca.test.ts` › "permissão: o `typ` do bilhete com a `aud` do desafio, e a `aud` do bilhete com o `typ` do desafio, não valem, um campo de cada vez" |
| [U] desafio de login e bilhete de convite | unidade | não valem como bilhete, e o bilhete não vale como eles nem como token de acesso | `bilhete-da-troca.test.ts` › "permissão: o desafio de login, o bilhete do convite e o token de acesso não servem de bilhete, e o bilhete não serve de nenhum deles"; e, na rota, "devolve o bilhete e nenhuma sessão" |
| bilhete emitido 5 min antes do vencimento, troca 1 min depois (relógio falso) | integração | recusada, senha intacta, nenhum `.usada` | `troca-da-provisoria.int.test.ts` › "borda: bilhete emitido 5 min antes de a provisória vencer, troca 1 min depois…" (o vencimento vai a um minuto atrás pelo banco e o bilhete leva esse vencimento, no lugar do relógio falso: o que decide é o `> clock_timestamp()` do `update`); a idade do bilhete pelo relógio injetado está em `bilhete-da-troca.test.ts` › "borda: vale até 10 min depois de emitido" |
| `/trocas` | integração | data, papel (do `depois`, mesmo com o autor eliminado) e se usada; com 12, as 10 mais recentes | `troca-da-provisoria.int.test.ts` › "lista as geradas antes da de agora…"; "a provisória gerada por professor e usada por outra geração" (autor apagado); "registros de outras ações do aluno não gastam a janela de leitura"; "com 12 anteriores, traz as 10 mais recentes" |
| `/trocas` de outro aluno, bilhete substituído ou vencido, bilhete na query | integração | recusado | "não alcança outro aluno"; "borda: bilhete de uma provisória que outra geração substituiu"; "borda: bilhete emitido 5 min antes…" (a lista também recusa); "permissão: sem o bilhete, com o bilhete só na query, ou com texto que não é bilhete" (o desafio de login, o bilhete do convite e o token de acesso, um a um, estão em `bilhete-da-troca.test.ts`; o token de acesso, também na rota, em "devolve o bilhete e nenhuma sessão"); "a senha nova abaixo do mínimo, ou fora do contrato…" (400 antes do 401, sem gastar tentativa); aluno desativado, eliminação agendada e quem não é aluno: três casos de "borda" |
| isolamento: contexto da A com a credencial do aluno da B | integração | a troca atualiza zero linhas, `/trocas` lê zero | "isolamento › com o contexto da escola A, a credencial e a auditoria do aluno da B…" (os ids e a validade da B, no contexto da A: `trocarProvisoria` false, `paraATroca` indefinido, a lista vazia; no contexto da B as mesmas três alcançam); "o bilhete da escola A com o aluno da B"; "repository: a troca só grava a provisória do bilhete e só enquanto vale"; "a leitura das provisórias anteriores recusa sem escola…" (`requireEscolaId`) |
| matrícula igual em A e B | integração | a provisória da A não abre a da B | "isolamento: a matrícula é a mesma em A e em B…" |
| `senha_provisoria.usada` | integração | autor o aluno, sem senha | "senha_provisoria.usada: um registro, com o aluno por autor e por alvo, sem senha nem hash, e o gerada fica" |
| trocar-senha com falha; a troca | integração | conta no contador de falhas; a troca anula as três colunas, `no-store` | "a troca grava a senha nova, anula as três colunas…" (`no-store`, sessão, a senha nova entra, o bilhete não troca de novo); "contador (regra 80, item 1)…" (cinco falhas na troca seguram a conta e o login; a troca certa zera); "contador por dispositivo…" |
| o hash da senha nova pelo semáforo; o 503 de quem esperou não conta | integração | uma chamada do `HashBulkhead.executar`, com o balde da escola do bilhete; seis 503 e ainda quatro 401 e só a quinta falha segura a conta | `troca-da-provisoria.int.test.ts` › "o hash da senha nova passa pelo semáforo do argon2…"; "o 503 de quem esperou demais pelo semáforo…" |
| o `.usada` na mesma transação da troca | integração | um gatilho recusa o insert em `auditoria`: a troca dá 5xx, a credencial e as sessões ficam como estavam, e a mesma troca vale depois | `troca-da-provisoria.int.test.ts` › "o `.usada` vai na mesma transação da troca…" |
| login com a provisória de aluno com a eliminação agendada | integração | `ACESSO_SUSPENSO`, sem bilhete, sem cookie, sem sessão | `troca-da-provisoria.int.test.ts` › "a eliminação agendada vem antes do bilhete…" |
| o `update` da troca recusa aluno desativado, com eliminação agendada ou que não é aluno | integração | zero linhas no repository, com outro aluno ativo na escola | `troca-da-provisoria.int.test.ts` › "repository: a troca não grava se o aluno foi desativado…" |
| escola sem ano em curso | integração | login, `/trocas` e troca funcionam | "escola sem ano em curso: o login com a provisória, a lista e a troca funcionam…" |
| [P] duas trocas com o mesmo bilhete | paralelo | uma sessão; cai sem a condição da `provisoriaExpiraEm` | "corridas › [P] duas trocas com o mesmo bilhete, as duas já na linha da credencial…" (`WriteBlockTrigger` + `esperarNaTrava`: um 200, um 401, uma sessão, um `.usada`); "duas provisórias com o mesmo vencimento…" |
| [C] job de professores com 300 linhas, rajada de login com provisória e conta externa, e redefinir | carga | zero 503 no login e no redefinir; passo (3) abaixo de 1 s | `infra/test/carga-importacao.test.ts` › "o redefinir dos professores…", "a fase dos professores roda ao lado da rajada de login…", "a fase dos professores sem a rajada de login ao lado reprova…"; `infra/test/carga-login.test.ts` › "a rajada leva a provisória e a conta só da escola…". A execução (`npm run carga:importacao -- --fases professores`) é manual, como a do F1 e a do F2 |

## Como testar

- Bilhete: `apps/api/src/sessao/convite/convite-ticket.test.ts:33` › "permissão: o desafio e o token de acesso não servem de bilhete, e o bilhete não serve de desafio nem de token de acesso"
- Login: `apps/api/test/sessao-matricula.int.test.ts` › "privacidade (regra 20, item 6): slug inexistente, slug fora do formato, matrícula inexistente…" e "isolamento (RF7, RF15): a matrícula 1234 existe em A e em B…"
- Relógio: o inline de `apps/api/test/arquivo-do-titular.int.test.ts:71`, ou `Clock` (`packages/core/src/clock.ts`)
- Carga: `infra/test/carga-login.test.ts`
- Comando: `npx vitest run --project integracao apps/api/test/troca-da-provisoria.int.test.ts`; `npx vitest run --project unidade apps/api/src/credencial/bilhete-da-troca.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: troque a escola do contexto, não só o id; a recusa tem de vir do repository.

**Respostas (plano, antes de codar):**

1. **Mutação de cada cláusula:** a seção "Mutações" tem bloco para o formato do vencimento, a idade e o `catch` do bilhete e o `safeParse` dos claims; a digitação da provisória (os três passos da normalização) e os quatro schemas do contrato (mínimo e máximo da senha nova, os `strict`, o teto das anteriores, o bilhete do login); no repository, o `if` do aluno que não existe, o `senhaHash === null` (a senha vale sozinha), as duas ramas do `pelaProvisoria`, o `case when` vigente, os quatro termos do `where` de `paraATroca`, o `suspenso` e o `undefined`, e os quatro termos do `update` de `trocarProvisoria` (a escola, o aluno, a igualdade com o bilhete, a vigência, e os dois juntos para o [P]); no login, a chave `conhecido`, a normalização nos dois sentidos e o `if` da etapa; no service da troca, o `aluno === undefined`, os dois termos do `vale`, a reserva, o `seguradaPorMs`, o `senhaHash === undefined`, o `update` que devolve zero linhas, o `zerar`, o `.usada`, os três termos da lista, o `dados === undefined` e o `esperaSeFalharMs`; no controller o `HttpCode`, os dois `no-store` e o `Set-Cookie`; e na leitura da auditoria a escola, o aluno, o filtro por ação, a ordem, o `limit`, o `slice`, os dois termos do "usada" e o papel fora do formato. As linhas sem bloco estão no fim da seção, com o motivo.
2. **Texto na tela:** nenhum. A tarefa é só API; a tela da troca é a 13.0 (e a web ainda lê o login de matrícula com o esquema antigo até ela).
3. **Segundo dado que torna a cláusula observável:** dois alunos na mesma escola (o `usuarioId` de `paraATroca` e a lista), dois alunos com o mesmo vencimento gravado por SQL (o `usuarioId` do `update`), a provisória substituída e a vencida lidas direto no repository (a igualdade e a vigência do `update`, que o service barra antes), uma credencial de matrícula de professor (o papel), o aluno desativado com a provisória ainda de pé, o aluno com senha e provisória vigente juntas, 70 registros de outra ação mais novos que as gerações (a janela de 60), um uso anterior à geração (o `>=`), um registro com papel fora do formato, e o aluno que já entrou naquele navegador (o contador `conhecido`).
4. **Checagem anterior que responde antes da regra:** o bilhete é conferido antes do banco, e o `paraATroca` antes do semáforo e da contagem; por isso a igualdade e a vigência do `update` só se provam no repository, e o hash que não se gasta com bilhete que não vale, com o espião em `PasswordHasher.gerar`. No isolamento troquei a escola do contexto e mantive os ids e a validade da B, e o controle (a mesma chamada no contexto da B acha) fecha o teste.
5. **A asserção olha o resultado:** a credencial no banco (as três colunas, o `argon2.verify` da senha nova), as sessões abertas, as linhas de `auditoria`, o `Set-Cookie`, o `no-store`, o status e o código das respostas; o espião do hash mede chamadas, nunca tempo. Nenhum teste lê texto de arquivo, fora os da carga (que lêem o k6, como os do F1 e F2).
6. **Guarda nova:** nenhuma. A lista fechada que a ação nova entra (`architecture.test.ts`, as ações sobre `usuario`) ganhou `senha_provisoria.usada`, e o teste de rotas do k6 ganhou `trocar-senha` e `redefinir`.
7. **Comentário que afirma o que o código não faz:** relidos os docblocks do `TrocaDaProvisoria`, do `BilheteDaTroca`, de `paraATroca`/`trocarProvisoria`, de `provisoriasAnterioresDoAluno` e do `TrocaDaProvisoriaController` contra o código e a Tech Spec §5; o `pelaProvisoria` perdeu um termo que não mudava resultado (o `case` já devolve `null` na vencida) e o comentário o diz.
8. **Divergência:** três, na tabela abaixo (a digitação da provisória, a leitura sem o índice da 11.1, e o [C] na fase `professores`).
9. **Peça que já existe:** `ChallengeIssuer`/`iatDoDesafioConfere` (a idade do bilhete), `naEscolaSemUsuario`, `LoginLockout` e a chave do contador (extraída do `LoginPorMatricula` para as duas rotas), `HashBulkhead`, `PasswordHasher`, `ConclusaoDeLogin.entrarComoAluno`, `AuditoriaRecorder`, `WriteBlockTrigger` e `esperarNaTrava`, `semearContas`, `iniciarARajada`, `hashDoToken`. Peça nova: o bilhete, o service da troca, as três rotas, a ação `senha_provisoria.usada`, a leitura das anteriores.
10. **Paralelo:** duas trocas com o mesmo bilhete, as duas já no `update` da credencial (a primeira parada no gatilho, a segunda esperando a linha): um 200 e um 401, uma sessão, um `.usada`, e a senha gravada é a da que ganhou.
11. **Isolamento e coluna "Caso":** a escola A lê, grava e lista com os ids e a validade da B e não alcança nada; o bilhete assinado com a escola trocada responde como aluno inexistente; a coluna "Caso" acima tem o caso de cada linha.
12. **Guardiões:** `tenancy-guardian` (escopo no repository, 404/401 iguais, bilhete com a escola de outro), `privacy-guardian` (o bilhete sem hash, matrícula nem nome; `.usada` sem senha; nada em log; `/trocas` só com o papel), `infra-guardian` (o hash pelo semáforo, o 503 que não conta, o `update` como trava, o contador compartilhado, a leitura de auditoria sem o índice da 11.1, o [C]) e `test-engineer` (mutações, paralelo, coluna "Caso").

## Fora do escopo desta tarefa

A tela (13.0); o arquivo do titular (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O [C] da rajada (o login do aluno com a provisória, a troca e a conta externa) roda na fase `professores` de `carga-importacao.ts`/`importacao-7h30.js`, com a rajada do F1 ao lado (`iniciarARajada`) e o cenário `redefinir`, cujo `link_da_conta` se semeia pelo banco com a senha da carga | Detalhe não previsto, triado pelo Arquiteto como "amplie o escopo": o [C] não cabia só no `carga-login`, porque a redefinição precisa de um link semeado e a importação é a fase que já tem professores em carga | `techspec.md` §7c, linha "Onde roda o [C]"; `cenarios.md` "Carga" (já registrados pelo Arquiteto; esta tarefa os leva no commit) |
| A provisória se digita como a tela a mostra: o login tira o hífen e os espaços e põe em maiúsculas antes de comparar (`normalizarSenhaProvisoria`), e só quando o hash que confere é o da provisória; a senha comum vai como veio | A tela mostra a senha de 24 h em grupos com hífen (a 9.0), e o aluno a digita da folha do professor: sem isso ela falha por maiúscula ou espaço, e a falha conta no contador da conta | `techspec.md` §5 "Senha provisória" (digitação normalizada); `cenarios.md` RF13 (F2c) |
| `trocar-senha` conta no mesmo contador de falhas da conta que o login (chave `escola\|matrícula`, com a chave `conhecido` do dispositivo); a troca certa o zera; o `senha_provisoria.usada` é gravado na mesma transação da troca | A Tech Spec diz que a troca conta nas falhas, mas não diz em qual chave: uma chave própria deixaria o atacante com bilhete roubado tentar a troca fora do limite do login (regra 80, item 1) | `techspec.md` §5 "Senha provisória"; `cenarios.md` RF13 (o [I] do contador na troca) |
| `/trocas` lê a auditoria do aluno (60 registros no máximo, pelo índice da escola) até a 11.1 criar o índice parcial por alvo; a lista traz `geradaEm`, `papel` e `usada`, sem o autor (D85) | O índice por alvo é da 11.1 (a migration do arquivo do titular); a leitura é pequena (um aluno, o limite de 60 e o de 10 devolvidos) e a 10.0 não altera schema | `techspec.md` §5 "Senha provisória" (nota do índice); tarefa 11.1 |
| A prova de "troca 5 min antes" da validade se faz com a expiração gravada no banco e o bilhete forjado com a mesma chave, não esperando o relógio | O teste de integração não espera minutos; o relógio da `update` é o do banco (`clock_timestamp()`), e o `recuar`/`vencer` movem a coluna, o que prova a mesma condição | `cenarios.md` RF13 (o [P] da troca contra o vencimento) |
| A §5 da Tech Spec passa a dizer o que o código faz: `/trocas` lista as 10 provisórias **anteriores** à usada, o `update` compara com `clock_timestamp()` e confere no próprio `update` o aluno ativo (`exists`: papel, desativação, eliminação agendada) | Pedido da rodada 1 (revisor-geral, tenancy-guardian e infra-guardian): o texto dizia "mais recentes" e `now()`, e a conferência do aluno só existia no `paraATroca`, antes do hash | `techspec.md` §5 "Senha provisória" |


## Mutações

--faltando: 2 linhas (82 blocos, 4 motivos). Cada bloco foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos num caso que rodou e falhou, e o `falha:` de cada negativa caiu na linha dela.

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › borda: adulterado, de outra chave
falha: provisoria_expira_em: '2026-11-09T10:00:00.123Z'
-export const FORMATO_DA_VALIDADE_DA_PROVISORIA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/
+export const FORMATO_DA_VALIDADE_DA_PROVISORIA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › borda: vale até 10 min depois de emitido
falha: aos(-300).verificar(bilhete)
-      if (!iatDoDesafioConfere(verificado.payload.iat, agora, VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS)) return undefined
       claims = verificado.payload
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › borda: adulterado, de outra chave
falha: corpoAdulterado}.${assinatura}
     } catch (erro) {
-      if (erro instanceof errors.JOSEError) return undefined
       throw erro
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › borda: adulterado, de outra chave
falha: provisoria_expira_em: '2026-11-09T10:00:00.123Z'
     const resultado = claimsSchema.safeParse(claims)
-    if (!resultado.success) return undefined
     return {
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a digitação vale como a tela mostra
-  return digitada.replace(/[\s-]/g, '').toUpperCase()
+  return digitada.replace(/[\s]/g, '').toUpperCase()
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a digitação vale como a tela mostra
-  return digitada.replace(/[\s-]/g, '').toUpperCase()
+  return digitada.replace(/[-]/g, '').toUpperCase()
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a digitação vale como a tela mostra
-  return digitada.replace(/[\s-]/g, '').toUpperCase()
+  return digitada.replace(/[\s-]/g, '')
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a senha nova tem o mínimo de 12
falha: senha: 'a'.repeat(11) }).success).toBe(false)
-export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA) }).strict()
+export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().max(TAMANHO_MAXIMO_SENHA) }).strict()
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a senha nova tem o mínimo de 12
falha: senha: 'a'.repeat(1025) }).success).toBe(false)
-export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA) }).strict()
+export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA) }).strict()
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a senha nova tem o mínimo de 12
falha: escolaId: 'x' }).success).toBe(false)
-export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA) }).strict()
+export const trocarSenhaProvisoriaRequestSchema = z.object({ senha: z.string().min(TAMANHO_MINIMO_SENHA_NOVA).max(TAMANHO_MAXIMO_SENHA) })
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › o login de matrícula devolve a sessão pronta ou o bilhete
falha: token: 't' }).success).toBe(false)
-  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().min(1).max(TAMANHO_MAXIMO_BILHETE_DA_TROCA) }).strict(),
+  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().min(1).max(TAMANHO_MAXIMO_BILHETE_DA_TROCA) }),
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › o login de matrícula devolve a sessão pronta ou o bilhete
falha: bilhete: '' }).success).toBe(false)
-  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().min(1).max(TAMANHO_MAXIMO_BILHETE_DA_TROCA) }).strict(),
+  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().max(TAMANHO_MAXIMO_BILHETE_DA_TROCA) }).strict(),
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › o login de matrícula devolve a sessão pronta ou o bilhete
falha: 'x'.repeat(1025) }).success).toBe(false)
-  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().min(1).max(TAMANHO_MAXIMO_BILHETE_DA_TROCA) }).strict(),
+  z.object({ etapa: z.literal(ETAPA_TROCAR_SENHA), bilhete: z.string().min(1) }).strict(),
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a lista das anteriores traz no máximo dez
falha: MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA + 1)).success).toBe(false)
       .array(z.object({ geradaEm: z.iso.datetime(), papel: z.enum(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA), usada: z.boolean() }).strict())
-      .max(MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA),
+      ,
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › a lista das anteriores traz no máximo dez
falha: { ...item, aluno: 'x' }] }).success).toBe(false)
-      .array(z.object({ geradaEm: z.iso.datetime(), papel: z.enum(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA), usada: z.boolean() }).strict())
+      .array(z.object({ geradaEm: z.iso.datetime(), papel: z.enum(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA), usada: z.boolean() }))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › privacidade: matrícula inexistente
falha: expect(inexistente.status).toBe(401)
       .limit(1)
-    if (linha === undefined) return undefined
     // A senha do aluno vale sozinha; a provisória só confere quando ele não tem senha (gerar a apagou), e só enquanto vale (a vencida já veio `null` do `case`).
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a senha do aluno vale sozinha
-    const pelaProvisoria = linha.senhaHash === null
+    const pelaProvisoria = true
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › devolve o bilhete e nenhuma sessão
-      senhaHash: pelaProvisoria ? linha.provisoriaHash : linha.senhaHash,
+      senhaHash: linha.senhaHash,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a senha do aluno vale sozinha
-      provisoriaExpiraEm: pelaProvisoria ? linha.provisoriaExpiraEm : null,
+      provisoriaExpiraEm: linha.provisoriaExpiraEm,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a provisória vence em 24 h
falha: expect(semRequisicao(semHifen)).toEqual(semRequisicao(errada))
-        provisoriaHash: sql<string | null>`case when ${PROVISORIA_VIGENTE} then ${credencialMatricula.provisoriaHash} end`,
+        provisoriaHash: credencialMatricula.provisoriaHash,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › com o contexto da escola A
falha: paraATroca(doB.usuarioId, dadosDoB.provisoriaExpiraEm))).toBeUndefined()
-     .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
+      .where(and(eq(credencialMatricula.usuarioId, usuarioId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › não alcança outro aluno
-     .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
+      .where(and(eq(credencialMatricula.escolaId, escolaId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a credencial de matrícula de quem não é aluno
falha: expect((await trocas(bilhete)).status).toBe(401)
-     .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
+      .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId), isNull(usuario.desativadoEm)))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › o aluno desativado depois do login
falha: expect((await trocas(bilhete)).status).toBe(401)
-     .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
+      .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId), eq(usuario.papel, 'aluno')))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a eliminação do aluno agendada
falha: expect(gerarHash).not.toHaveBeenCalled()
-   return linha === undefined ? undefined : { matricula: linha.matricula, provisoriaVale: linha.provisoriaVale, suspenso: linha.eliminacaoAgendadaEm !== null }
+    return linha === undefined ? undefined : { matricula: linha.matricula, provisoriaVale: linha.provisoriaVale, suspenso: false }
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › com o contexto da escola A
falha: paraATroca(doB.usuarioId, dadosDoB.provisoriaExpiraEm))).toBeUndefined()
-   return linha === undefined ? undefined : { matricula: linha.matricula, provisoriaVale: linha.provisoriaVale, suspenso: linha.eliminacaoAgendadaEm !== null }
+    return { matricula: linha?.matricula ?? '', provisoriaVale: linha?.provisoriaVale ?? false, suspenso: linha?.eliminacaoAgendadaEm !== null }
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › com o contexto da escola A
falha: trocarProvisoria(doB.usuarioId
      .where(
         and(
-          eq(credencialMatricula.escolaId, requireEscolaId()),
           eq(credencialMatricula.usuarioId, usuarioId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › duas provisórias com o mesmo vencimento
           eq(credencialMatricula.escolaId, requireEscolaId()),
-          eq(credencialMatricula.usuarioId, usuarioId),
           sql`${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca só grava a provisória do bilhete
falha: expect(await noRepository(velha)).toBe(false)
           eq(credencialMatricula.usuarioId, usuarioId),
-          sql`${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz`,
           PROVISORIA_VIGENTE,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca só grava a provisória do bilhete
falha: expect(await noRepository(await vencer(aluno.usuarioId))).toBe(false)
           sql`${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz`,
-          PROVISORIA_VIGENTE,
          // O aluno ainda é aluno ativo e sem eliminação agendada no instante da gravação: fecha a janela entre o `paraATroca` e o `update` (regra 10, item 4).
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › duas trocas com o mesmo bilhete
falha: .toEqual([200, 401])
           eq(credencialMatricula.usuarioId, usuarioId),
-          sql`${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz`,
-          PROVISORIA_VIGENTE,
          // O aluno ainda é aluno ativo e sem eliminação agendada no instante da gravação: fecha a janela entre o `paraATroca` e o `update` (regra 10, item 4).
```

```mutacao
arquivo: apps/api/src/credencial/senha/password-verifier.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a provisória vale como a tela a mostra
falha: expect(r.corpo['etapa'], digitada).toBe('trocar_senha')
-      const senha = tentativa.senhaParaConferir?.(tentativa.senha, credencial) ?? tentativa.senha
+      const senha = tentativa.senha
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › contador por dispositivo
falha: expect(r.status, JSON.stringify(r.corpo)).toBe(200)
-  return { chave: contador.chaveDe(identificador, conhecido ? 'conhecido' : 'outro'), identificador, conhecido }
+  return { chave: contador.chaveDe(identificador, 'outro'), identificador, conhecido }
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a provisória vale como a tela a mostra
falha: expect(r.corpo['etapa'], digitada).toBe('trocar_senha')
-        senhaParaConferir: (senha, credencial) => (credencial?.provisoriaExpiraEm == null ? senha : normalizarSenhaProvisoria(senha)),
+        senhaParaConferir: (senha) => senha,
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a troca grava a senha nova
-        senhaParaConferir: (senha, credencial) => (credencial?.provisoriaExpiraEm == null ? senha : normalizarSenhaProvisoria(senha)),
+        senhaParaConferir: (senha) => normalizarSenhaProvisoria(senha),
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › devolve o bilhete e nenhuma sessão
-      if (credencial.provisoriaExpiraEm !== null) {
+      if (credencial.provisoriaExpiraEm === 'nunca') {
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › o bilhete da escola A com o aluno da B
falha: expect((await trocar(cruzado)).status).toBe(401)
-      if (aluno === undefined) throw credencialInvalida()
       const { chave, identificador } = chaveDaTentativa(this.dependencias, escolaId, aluno.matricula, origem)
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › bilhete de uma provisória que outra geração substituiu
falha: expect(gerarHash).not.toHaveBeenCalled()
-      const vale = aluno.provisoriaVale && !aluno.suspenso
+      const vale = !aluno.suspenso
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a eliminação do aluno agendada
falha: expect(gerarHash).not.toHaveBeenCalled()
-      const vale = aluno.provisoriaVale && !aluno.suspenso
+      const vale = aluno.provisoriaVale
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › contador por dispositivo
falha: expect((await trocar(atual)).status).toBe(429)
         const reserva = await contador.reservar(chave)
-        if (!reserva.liberada) return { seguradaPorMs: reserva.esperaMs }
         return { reserva, senhaHash: vale ? await hash.gerar(senhaNova) : undefined }
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › bilhete de uma provisória que outra geração substituiu
falha: expect(gerarHash).not.toHaveBeenCalled()
-        return { reserva, senhaHash: vale ? await hash.gerar(senhaNova) : undefined }
+        return { reserva, senhaHash: await hash.gerar(senhaNova) }
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › contador por dispositivo
falha: expect((await trocar(atual)).status).toBe(429)
       })
-      if ('seguradaPorMs' in tentativa) throw contaSegurada(tentativa.seguradaPorMs)
       if (tentativa.senhaHash === undefined) throw falhou(tentativa.reserva)
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a eliminação do aluno agendada
falha: expect(gravar).not.toHaveBeenCalled()
       if ('seguradaPorMs' in tentativa) throw contaSegurada(tentativa.seguradaPorMs)
-      if (tentativa.senhaHash === undefined) throw falhou(tentativa.reserva)
       const senhaHash = tentativa.senhaHash
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › duas trocas com o mesmo bilhete
falha: .toEqual([200, 401])
-          if (!(await new CredencialMatriculaRepository(tx).trocarProvisoria(usuarioId, provisoriaExpiraEm, senhaHash))) return false
+          await new CredencialMatriculaRepository(tx).trocarProvisoria(usuarioId, provisoriaExpiraEm, senhaHash)
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › duas trocas com o mesmo bilhete
falha: .toEqual([200, 401])
-      if (!trocou) throw falhou(tentativa.reserva)
       await contador.zerar(chave)
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a troca com falha conta no contador
falha: senha errada ${String(vez + 1)}
       if (!trocou) throw falhou(tentativa.reserva)
-      await contador.zerar(chave)
       return conclusao.entrarComoAluno({ usuarioId, escolaId }, identificador, origem)
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › senha_provisoria.usada: um registro
-          await registro.gravar(tx, 'senha_provisoria.usada', { entidadeId: usuarioId })
           return true
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › o bilhete da escola A com o aluno da B
falha: expect((await trocas(cruzado)).status).toBe(401)
-      if (aluno === undefined || !aluno.provisoriaVale || aluno.suspenso) throw credencialInvalida()
+      if (!aluno.provisoriaVale || aluno.suspenso) throw credencialInvalida()
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › bilhete de uma provisória que outra geração substituiu
falha: expect((await trocas(velho)).status).toBe(401)
-      if (aluno === undefined || !aluno.provisoriaVale || aluno.suspenso) throw credencialInvalida()
+      if (aluno === undefined || aluno.suspenso) throw credencialInvalida()
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a eliminação do aluno agendada
falha: expect((await trocas(bilhete)).status).toBe(401)
-      if (aluno === undefined || !aluno.provisoriaVale || aluno.suspenso) throw credencialInvalida()
+      if (aluno === undefined || !aluno.provisoriaVale) throw credencialInvalida()
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › devolve o bilhete e nenhuma sessão
falha: expect((await trocar(comSessao.token)).status).toBe(401)
-    if (dados === undefined) throw credencialInvalida()
     return dados
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a troca com falha conta no contador
falha: expect(quinta.status).toBe(429)
-  return reserva.esperaSeFalharMs > 0 ? contaSegurada(reserva.esperaSeFalharMs) : credencialInvalida()
+  return credencialInvalida()
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.controller.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a troca grava a senha nova
   @Post('trocar-senha')
-  @HttpCode(HttpStatus.OK)
   @Header('Cache-Control', 'no-store')
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.controller.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a troca grava a senha nova
falha: expect(r.cabecalhos.get('cache-control')).toBe('no-store')
   @Post('trocar-senha')
   @HttpCode(HttpStatus.OK)
-  @Header('Cache-Control', 'no-store')
   async trocar(
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.controller.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a troca grava a senha nova
falha: expect(r.setCookie.some((linha) => linha.startsWith('educa_sessao='))).toBe(true)
-    resposta.setHeader('Set-Cookie', [...cookies])
     return loginResponseSchema.parse(corpoDaResposta)
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.controller.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › lista as geradas antes da de agora
falha: expect(r.cabecalhos.get('cache-control')).toBe('no-store')
   @Get('trocas')
-  @Header('Cache-Control', 'no-store')
   trocas(
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a leitura das provisórias anteriores recusa sem escola
falha: rejects.toBeInstanceOf(InvariantException)
-    const escolaId = requireEscolaId()
+    const escolaId = currentContext()?.escolaId ?? ''
     const registros = await this.banco
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › com o contexto da escola A
falha: provisoriasAnterioresDoAluno(doB.usuarioId))).toEqual([])
-     .where(and(eq(auditoria.escolaId, escolaId), eq(auditoria.entidadeId, alunoId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
+      .where(and(eq(auditoria.entidadeId, alunoId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › não alcança outro aluno
-     .where(and(eq(auditoria.escolaId, escolaId), eq(auditoria.entidadeId, alunoId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
+      .where(and(eq(auditoria.escolaId, escolaId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › registros de outras ações do aluno não gastam a janela
-     .where(and(eq(auditoria.escolaId, escolaId), eq(auditoria.entidadeId, alunoId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
+      .where(and(eq(auditoria.escolaId, escolaId), eq(auditoria.entidadeId, alunoId)))
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › lista as geradas antes da de agora
       .where(and(eq(auditoria.escolaId, escolaId), eq(auditoria.entidadeId, alunoId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
-      .orderBy(desc(auditoria.em), desc(auditoria.id))
+      .orderBy(auditoria.em, auditoria.id)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › lista as geradas antes da de agora
-      .limit(REGISTROS_LIDOS_POR_ALUNO)
+      .limit(1)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › lista as geradas antes da de agora
-    return geracoes.slice(1, 1 + MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA).map((geracao, indice) => {
+    return geracoes.slice(0, 1 + MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA).map((geracao, indice) => {
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › com 12 anteriores
falha: expect(r.status, JSON.stringify(r.corpo)).toBe(200)
-    return geracoes.slice(1, 1 + MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA).map((geracao, indice) => {
+    return geracoes.slice(1).map((geracao, indice) => {
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a provisória gerada por professor e usada por outra geração
-      const usada = usos.some((uso) => uso.em >= geracao.em && (seguinte === undefined || uso.em < seguinte.em))
+      const usada = usos.some((uso) => seguinte === undefined || uso.em < seguinte.em)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a provisória gerada por professor e usada por outra geração
-      const usada = usos.some((uso) => uso.em >= geracao.em && (seguinte === undefined || uso.em < seguinte.em))
+      const usada = usos.some((uso) => uso.em >= geracao.em)
```

```mutacao
arquivo: packages/core/src/auditoria/auditoria.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a leitura das provisórias anteriores recusa sem escola
falha: motivo: 'dados_fora_do_schema'
-  if (conhecido === undefined) throw new AuditoriaRejectedError('dados_fora_do_schema')
   return conhecido
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › o hash da senha nova passa pelo semáforo do argon2
falha: expect(espiao).toHaveBeenCalledTimes(1)
-    const { banco, hash, semaforo, contador, conclusao } = this.dependencias
+    const { banco, hash, contador, conclusao } = this.dependencias
+    const semaforo = { executar: <T>(_balde: unknown, tarefa: () => Promise<T>) => tarefa() }
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › o 503 de quem esperou demais pelo semáforo
falha: 'depois do 503').toBe(401)
-      const tentativa = await semaforo.executar(escolaBucket(escolaId), async (): Promise<{ readonly seguradaPorMs: number } | { readonly reserva: ReservaLiberada; readonly senhaHash: string | undefined }> => {
-        const reserva = await contador.reservar(chave)
+      const antes = await contador.reservar(chave)
+      const tentativa = await semaforo.executar(escolaBucket(escolaId), async (): Promise<{ readonly seguradaPorMs: number } | { readonly reserva: ReservaLiberada; readonly senhaHash: string | undefined }> => {
+        const reserva = antes
```

```mutacao
arquivo: apps/api/src/sessao/login/troca-da-provisoria.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › o `.usada` vai na mesma transação da troca
falha: expect(await credencialDe(aluno.usuarioId)).toEqual(antes)
-        banco.transaction(async (tx) => {
-          if (!(await new CredencialMatriculaRepository(tx).trocarProvisoria(usuarioId, provisoriaExpiraEm, senhaHash))) return false
-          await registro.gravar(tx, 'senha_provisoria.usada', { entidadeId: usuarioId })
-          return true
-        }),
+        banco.transaction(async (tx) => new CredencialMatriculaRepository(tx).trocarProvisoria(usuarioId, provisoriaExpiraEm, senhaHash)).then(async (gravou) => {
+          if (gravou) await registro.gravar(banco, 'senha_provisoria.usada', { entidadeId: usuarioId })
+          return gravou
+        }),
```

```mutacao
arquivo: apps/api/src/sessao/login/matricula.service.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › a eliminação agendada vem antes do bilhete
falha: expect(r.corpo.erro?.codigo).toBe(ErrorCode.ACESSO_SUSPENSO)
-      if (credencial.suspenso) {
+      if (credencial.suspenso && credencial.provisoriaExpiraEm === null) {
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › borda: bilhete de uma provisória que outra geração substituiu
falha: expect(gerarHash).not.toHaveBeenCalled()
-        provisoriaVale: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz and ${PROVISORIA_VIGENTE}, false)`,
+        provisoriaVale: sql<boolean>`coalesce(${PROVISORIA_VIGENTE}, false)`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › borda: bilhete emitido 5 min antes de a provisória vencer
falha: expect((await trocas(bilhete)).status).toBe(401)
-        provisoriaVale: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz and ${PROVISORIA_VIGENTE}, false)`,
+        provisoriaVale: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} = ${doBilhete}::timestamptz, false)`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca só grava a provisória do bilhete
falha: expect(await noRepository(velha)).toBe(false)
-    return gravadas.length === 1
+    return true
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca não grava se o aluno foi desativado
falha: 'desativado').toBe(false)
                   eq(usuario.escolaId, credencialMatricula.escolaId),
-                  eq(usuario.id, credencialMatricula.usuarioId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca não grava se o aluno foi desativado
falha: 'não é aluno').toBe(false)
                   eq(usuario.id, credencialMatricula.usuarioId),
-                  eq(usuario.papel, 'aluno'),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca não grava se o aluno foi desativado
falha: 'desativado').toBe(false)
                   eq(usuario.id, credencialMatricula.usuarioId),
                   eq(usuario.papel, 'aluno'),
-                  isNull(usuario.desativadoEm),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/troca-da-provisoria.int.test.ts › repository: a troca não grava se o aluno foi desativado
falha: 'eliminação agendada').toBe(false)
                  eq(usuario.id, credencialMatricula.usuarioId),
                   eq(usuario.papel, 'aluno'),
                   isNull(usuario.desativadoEm),
-                  isNull(usuario.eliminacaoAgendadaEm),
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › permissão: o `typ` do bilhete
falha: assinar({ typ: TIPO_DESAFIO }))).toBeUndefined()
         algorithms: ['HS256'],
-        typ: TIPO_DO_BILHETE_DA_TROCA,
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › permissão: o `typ` do bilhete
falha: assinar({ aud: CHALLENGE_AUDIENCE }))).toBeUndefined()
         issuer: EMISSOR_TOKEN,
-        audience: AUDIENCIA_DO_BILHETE_DA_TROCA,
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › permissão: assinado por nós mas de outro emissor
falha: assinar({ iss: 'outro-emissor' }))).toBeUndefined()
         typ: TIPO_DO_BILHETE_DA_TROCA,
-        issuer: EMISSOR_TOKEN,
```

```mutacao
arquivo: apps/api/src/credencial/bilhete-da-troca.ts
teste: apps/api/src/credencial/bilhete-da-troca.test.ts › permissão: assinado por nós mas de outro emissor
falha: assinar({ semExp: true }))).toBeUndefined()
         audience: AUDIENCIA_DO_BILHETE_DA_TROCA,
-        requiredClaims: ['exp', 'iat'],
```

Linhas novas sem bloco, com o motivo de cada uma:

- `troca-da-provisoria.service.ts`, `currentContext()?.requisicaoId ?? randomUUID()`: o `??` só cobre a chamada fora de uma requisição HTTP (o contexto sempre existe na rota); o `randomUUID()` fecha o tipo e não há caminho de produção que o alcance. É a mesma forma dos serviços irmãos.
- `sessao.module.ts`, `opcoes.medidor ?? globalMeter()`: o padrão de produção do medidor, repetido da fábrica vizinha (`LoginPorMatricula` já o tinha); o teste passa o medidor e a falta dele só deixa a métrica no medidor global. A métrica em si tem teste (`metricas.int.test.ts`).
- `credencial-matricula.repository.ts`, `eq(usuario.escolaId, credencialMatricula.escolaId)` no `exists` do `update` da troca: redundante com a FK composta de `credencial_matricula` para `usuario` (a escola e o id andam juntos); tirá-lo não muda nenhum resultado. Fica pela regra 10, item 3, e pelo índice. O que decide (o aluno, o papel, a desativação e a eliminação agendada) tem bloco.
- `auditoria.repository.ts`, `seguinte === undefined ||` do `usada`: com o `slice(1, …)` o índice do `map` nunca é -1 (`geracoes[indice]` sempre existe); a guarda fecha o tipo (`noUncheckedIndexedAccess`) e não tem caminho que a alcance.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Conferir na 11.1 que o plano de `provisoriasAnterioresDoAluno` passa a usar o índice parcial por alvo | Tarefa 11.1 (`11_task.md`: "Migration do índice parcial `auditoria (escolaId, entidadeId, em)` nas seis ações"). O `infra-guardian` pede o mesmo na auditoria dela |
| infra-guardian (1ª) | `/trocas` lê a auditoria inteira da escola até a 11.1 entrar (300 mil linhas, 76 ms): condição de pouso; o `EXPLAIN` da consulta tem de mostrar o índice parcial, com o filtro por ação contido no predicado | Tarefa 11.1, que cria o índice; o Validador confere o `EXPLAIN` no pouso. O desvio já está na Tech Spec §5 e em "Divergências resolvidas" |
| infra-guardian (1ª) | A rajada `infra/k6/login-7h30.js` não chama `GET /v1/sessao/matricula/trocas` | `TODO.md`, seção "Infra e operação": incluir `/trocas` no fluxo da provisória do k6 quando a 13.0 ligar a tela (a 13.0 não trata de carga) |
| infra-guardian (1ª) | `trocar-senha` e `/trocas` contam no balde anônimo por IP (`rl:ip`, 3.000 por minuto); avaliar contar também por `usuario_id` do bilhete ou dar o tratamento do login (só rebaixa) | `TODO.md`, seção "Infra e operação". O revisor diz que não é regressão: a página de acesso já sofre o mesmo e o `trocar-senha` conta no contador da conta |
| privacy-guardian (1ª) | `senha_provisoria.gerada` fica fora do arquivo do titular até a leitura por alvo; a 11.0 precisa de um caso que mostre `.gerada` e `.usada` no arquivo do aluno | Tarefa 11.0/11.2 (`11_task.md`: "cada uma das seis ações … no arquivo do alvo"); `lgpd.md` linha 81 já promete o item |
| privacy-guardian (1ª) | `/trocas` pode ser lida várias vezes nos 10 min do bilhete; lembrar do limite por usuário da rota quando a 13.0 ligar a tela | `TODO.md`, na mesma entrada do balde por IP acima (a 13.0 não trata de limite) |
| revisor-geral (1ª) | `troca-da-provisoria.service.ts` repete à mão a reserva dentro do semáforo, o `contaSegurada` e o `falhou` do `PasswordVerifier`; propõe um ajudante comum | `TODO.md`, seção "Processo e dívida do F0": refator que mexe em duas rotas de login já com testes verdes, fora do que é barato. Hoje está correto, segundo o revisor |
| test-engineer (1ª) | Corrida de verdade entre gerar e trocar, com barreira entre `paraATroca` e o `update` | `TODO.md`, seção "Infra e operação". O `cenarios.md` linha 140 pede "Bilhete de provisória já substituída: recusado", e isso está provado em sequência no repository e no service (item 2 acima reforça os blocos); a corrida seria prova a mais |
| conformidade-reviewer (1ª) | `/trocas` mostra ao aluno o papel de quem gerou; se um dia a coordenação puder ver por professor quantas provisórias cada um gerou, passa pelo item 8 da regra 70 e pela D64 | Sem ação: nada disso existe hoje (D85 sem o autor); fica como aviso para a spec que criar essa tela |
| conformidade-reviewer (1ª) | O seed de carga escreve direto em `credencial_matricula` e `conta_externa`, sem repository | Sem ação: dado sintético, fora da regra 70, e a palavra é dos guardiões de tenancy e privacidade, que aprovaram |
| tenancy-guardian (2ª) | Prender a escola do `exists` de `trocarProvisoria` também a `requireEscolaId()`, em vez de só à coluna da linha externa | `TODO.md`: não muda resultado (a linha externa já está presa à escola); a Mesa não a aplica porque mexe no repository depois de seis aprovações |
| tenancy-guardian, infra-guardian (2ª, repetida da 1ª) | Na 11.1, conferir que `provisoriasAnterioresDoAluno` usa o índice parcial por alvo; no pouso, `EXPLAIN` | Tarefa 11.1 (cria o índice) |
| privacy-guardian (2ª, repetida da 1ª) | Na 11.0/11.2, caso que mostre `.gerada` e `.usada` no arquivo do titular (`docs/lgpd.md:81`) | Tarefa 11.0/11.2 |
| privacy-guardian, infra-guardian (2ª, repetida da 1ª) | Limite por usuário em `trocar-senha` e `/trocas` (hoje só `rl:ip`), e `GET /v1/sessao/matricula/trocas` na rajada de `infra/k6/login-7h30.js` | Tarefa 13.0, quando ligar a tela; já está no `TODO.md` |
| conformidade-reviewer (2ª, repetida da 1ª) | Se uma tela mostrar à coordenação, por professor, quantas provisórias cada um gerou, passa pela regra 70 item 8 e pela D64 | Aviso para a 13.0 e telas seguintes; hoje nada disso existe |
| revisor-geral (2ª) | `10_task.md:112-113`: linha em branco sobrando antes de "## Mutações"; dizer que o `cenarios.md` não precisou mudar | Recusada: texto de documento, sem efeito; o Implementador pode ajustar no commit se quiser |
| revisor-geral (2ª) | Comentário no teste do gatilho dizendo de onde vem o `escolaId` posto no `create trigger` | Recusada: o id vem da fixture, risco nulo (o revisor o diz) |
| test-engineer (2ª) | `troca-da-provisoria.int.test.ts:361`: trocar `toBeGreaterThanOrEqual(500)` por 500 com código tipado e sem stack | `TODO.md`: reforço de teste; mexer em teste agora caduca `test-engineer` e `revisor-geral` |
| test-engineer (2ª) | `create trigger` em `auditoria` pega trava na tabela compartilhada; isolar o teste num arquivo próprio se oscilar na esteira | `TODO.md`: só se aparecer oscilação |
| test-engineer (2ª) | Corrida de verdade entre gerar e trocar | Já registrada no `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 15:48:47 | 2026-11-08 15:49:31 | `tenancy-guardian` | 1 | APROVADO | a770a9bec6455d0a1 |
| 2026-11-08 15:49:05 | 2026-11-08 15:49:33 | `conformidade-reviewer` | 1 | APROVADO | a8e26707fd742bfbd |
| 2026-11-08 15:49:02 | 2026-11-08 15:50:18 | `revisor-geral` | 1 | APROVADO | a75226d02f89be1a7 |
| 2026-11-08 15:48:50 | 2026-11-08 15:51:08 | `privacy-guardian` | 1 | APROVADO | a489751155c31b39f |
| 2026-11-08 15:48:54 | 2026-11-08 15:51:30 | `infra-guardian` | 1 | APROVADO | a8b11cd77820716bd |
| 2026-11-08 15:48:58 | 2026-11-08 15:52:37 | `test-engineer` | 1 | REPROVADO | ab4e0ec9d66be3f09 |
| 2026-11-08 17:52:01 | 2026-11-08 17:52:34 | `tenancy-guardian` | 2 | APROVADO | a4eb787c443bb2f2c |
| 2026-11-08 17:52:06 | 2026-11-08 17:52:35 | `privacy-guardian` | 2 | APROVADO | a173c98488565d508 |
| 2026-11-08 17:52:11 | 2026-11-08 17:52:36 | `infra-guardian` | 2 | APROVADO | af2d021ef50df85ac |
| 2026-11-08 17:52:34 | 2026-11-08 17:53:03 | `conformidade-reviewer` | 2 | APROVADO | aabe478081e41c23c |
| 2026-11-08 17:52:28 | 2026-11-08 17:53:04 | `revisor-geral` | 2 | APROVADO | ad2e8ac6c15f67167 |
| 2026-11-08 17:52:23 | 2026-11-08 17:54:26 | `test-engineer` | 2 | APROVADO | a3c9c9264de3ef38e |
