# Tarefa 5.0 — O link da conta e o "esqueci a senha" (API e worker)

**Funcionalidade:** acesso-e-convites · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/senha/esqueci` responde 202 igual, e a conta ativa recebe um link de 1 h; `POST /v1/senha/redefinir` troca a senha, derruba as sessões e grava `senha.redefinida` em cada escola com usuário ativo da conta.

## Contexto necessário

- `techspec.md` seções 3, 5 ("E-mail", "Esqueci", "Auditoria"), 6 e 11; `prd.md` RF12, RF17; `cenarios.md` RF12, "Limites", "Corridas"
- `.claude/rules/10` itens 1 e 9; `.claude/rules/80` item 1
- `job-outbox.repository.ts:74-78`; `tenant-resolution.repository.ts` (como o `codigo_recuperacao`); `expurgo-de-acesso.repository.ts`

## Subtarefas

- [x] 5.1 — Migration `link_da_conta` e a exceção no `docs/modelo-de-dados.md`
- [x] 5.2 — `SISTEMA_DA_REQUISICAO` no `JobOutboxRepository.inserir`; `sistema.enviar-email-da-conta`, escola nula, no `EnvioRepository`
- [x] 5.3 — `cerca-envio` em `camadas.cjs` e a zona no `architecture.test.ts`, com as fixtures
- [x] 5.4 — As rotas: `rl:ip:senha`, 3/h pelo HMAC do e-mail, piso de 400 ms, link novo cancela o antigo; `senha.redefinida` por escola
- [x] 5.5 — O expurgo de acesso (30 dias; `falhou` de 24 h, `@Unscoped` próprio)
- [x] 5.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0043_link_da_conta.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/link-da-conta.ts` | novo |
| `packages/core/src/queue/job-outbox.repository.ts` | alterado |
| `packages/core/src/email/envio.repository.ts` | alterado |
| `apps/worker/src/processors/enviar-email.ts` | alterado |
| `packages/shared/src/system/job-definitions.ts` | alterado |
| `packages/shared/src/sessao/senha.ts` | novo |
| `apps/api/src/sessao/senha/` | novo |
| `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` | alterado |
| `apps/api/src/sessao/sessao.module.ts` | alterado |
| `packages/core/src/retencao/expurgo-de-acesso.repository.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `tools/guardas/camadas.cjs` | alterado |
| `tools/guardas/camadas.test.ts` | alterado |
| `apps/api/test/architecture.test.ts` | alterado |
| `docs/modelo-de-dados.md` | alterado |
| `apps/api/test/senha-esqueci.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| e-mail com e sem conta | integração | resposta igual, piso de 400 ms; log só com ids | senha-esqueci › "e-mail com conta e e-mail sem conta: a mesma resposta, o mesmo piso de 400 ms, e o log só com ids" e "o piso desconta o trabalho já feito…" |
| link | integração | vence em 1 h, não serve duas vezes, token depois do `#` | senha-esqueci › "o link vale 1 hora, com o token e o endereço cifrados, o banco guarda só o hash do token e o corpo da API nunca o devolve" e "o link vencido, o usado e o substituído dão a mesma resposta…"; o `#` do token no e-mail: `mensagem-do-link-da-conta.test.ts` e enviar-email-da-conta › "leva o link com o token depois do `#`…" |
| redefinir | integração | derruba as sessões; o MFA segue | senha-esqueci › "troca a senha, derruba as sessões da conta em todas as escolas e o MFA segue…" e "o MFA segue exigido…" |
| conta desligada; quarto pedido na hora | integração | 202 sem link; 202 e três envios | senha-esqueci › "conta desligada: 202 sem link; o quarto pedido na hora: 202 e três envios, sem 429" e "o \"esqueci\" de uma conta não cancela o link aberto de outra…" |
| balde `rl:ip:senha` cheio | integração | 202 sem envio, nunca 429; o login do mesmo IP segue | senha-esqueci › "balde rl:ip:senha cheio: 202 sem envio e nunca 429, e o login do mesmo IP segue" e, com o Redis fora, "os baldes do \"esqueci\" caem para o seguro…" |
| token inválido | integração | não ocupa o semáforo do argon2 (espião) | senha-esqueci › "token inválido não ocupa o semáforo do argon2…" e "o token de outra finalidade não serve…" |
| envio do link: 23 h, mais de 24 h, 4xx sempre; `link_da_conta` usado ou vencido | integração | fica; `falhou`, cifrados nulos; sai em 30 dias | enviar-email-da-conta › "4xx em toda tentativa…" e "5xx…"; expurgo-de-acesso › "envio do link da conta parado: com 23 h…" e "borda: nos limites de cada prazo…" |
| job da conta | integração | escola nula, lê pelo id do job, ocupa e solta a `vaga:normal:sistema` ao adiar | enviar-email-da-conta › "o job é de escola nula, lê o link pelo id do job, ocupa a `vaga:normal:sistema`…" e "adiado, o job solta a vaga…"; "reserva alheia vigente: … o ponto gasto volta…" |
| outro `sistema.*` pedido por requisição | integração | recusado, sem `rotinaDoSistema` | senha-esqueci › "outro `sistema.*` pedido por requisição é recusado…" |
| `EMAIL_POR_MINUTO` com os convites enchendo a metade deles | integração | o link sai no minuto; um convite a mais adia | enviar-email-da-conta › "com os convites enchendo a metade deles, o link da conta ainda sai no minuto…" |
| `senha.redefinida`, conta em A e B | integração | um em cada, autor e alvo o usuário dela, nada da B no da A; B desativado: só na A | senha-esqueci › "grava `senha.redefinida` em cada escola…" e "usuário da conta desativado em B: o registro vai só para A" |
| usuário desativado entre o link e o redefinir | integração | link inválido, sem registro, nunca 500 | senha-esqueci › "usuário desativado entre o link e o redefinir…", "o usuário desativado depois da leitura do link…" e "a eliminação agendada numa escola não tira a conta do \"esqueci\"…" |
| `cerca-envio`: vizinho, reexportação, `import()`; sem o alvo | unidade | quem contorna é acusado; sem o alvo, reprova | camadas.test.ts › "%s reprova só o que a fixture marca" (as fixtures `vizinho-do-envio`, `envio-reexporta`, `envio-dinamico`) e a zona no `architecture.test.ts` |
| [P] "esqueci" com o envio antigo na barreira | paralelo | antigo `cancelado`, token recusado, 202 no piso | senha-esqueci › "o envio antigo preso na barreira (`enviando`)…"; enviar-email-da-conta › "[P] cancelado com o job na barreira…" e "cancelado enquanto o servidor responde 4xx…" |
| [P] dois "esqueci", o 1º preso no insert | paralelo | um link aberto, dois 202; cai sem o piso no `catch` | senha-esqueci › "dois "esqueci" ao mesmo tempo, o primeiro preso no insert…" |
| [P] dois "redefinir" | paralelo | um troca; cai sem `usado_em is null` | senha-esqueci › "dois "redefinir" com o mesmo token, o primeiro parado depois de ler o link e o segundo terminando antes: um só troca" |

## Como testar

- Guarda: `tools/guardas/camadas.test.ts` › "%s reprova só o que a fixture marca"; fixtures em `tools/guardas/__fixtures__/camadas/`
- Zona: `apps/api/test/architecture.test.ts`, os casos das classes cercadas
- Expurgo: `apps/worker/test/expurgo-de-acesso.int.test.ts` › "borda: nos limites de cada prazo…"
- IP: `apps/api/test/password-attack.int.test.ts`; `ipSorteado` e `doIp` (`apps/api/test/operador-mfa.fixture.ts`)
- Semáforo: sem precedente do espião; o mais próximo, `apps/api/test/login-bulkhead.int.test.ts`
- Comando: `npx vitest run --project integracao apps/api/test/senha-esqueci.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 6: a `cerca-envio` tem uma fixture por forma de contornar. Na 3: conta em duas escolas, senão o registro por escola passa com um só.

**Respostas (plano, antes de codar):**

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco para: o `usado_em is null` do `usarLinkPorHash`, o `catch` do 23505 (o piso sem ele), o `cancelarLinksAbertos` e o `case` que grava `cancelado`, o token conferido antes do argon2, o `encerrarSessoesDaConta`, o registro por escola (um por escola, não só o primeiro), o `usuarios.length === 0`, cada termo de `doIp || doEmail`, o piso de 400 ms, o `SISTEMA_DA_REQUISICAO` na outbox, o `reservarLink` (reserva alheia), o `concluirLink` com a marca da reserva, o `fecharEnviosDeLinkParados` (`enviando` de 24 h) e o `#` do link no e-mail. O que ficou sem bloco está no `--faltando` com a meia linha do motivo.
2. **Texto na tela:** nenhum. A tarefa é só API e worker; as telas são da 6.0.
3. **Segundo dado que torna a cláusula observável:** a conta com usuário ativo em **duas** escolas (um registro em cada, nada da B no da A) e com o da B desativado (só na A); o "esqueci" do mesmo e-mail quatro vezes (o terceiro balde cheio) e dois IPs (o balde é de um só); `enviando` e `na_fila` com 23 h e com mais de 24 h no expurgo; convites enchendo a metade da cota no `EMAIL_POR_MINUTO`.
4. **Checagem anterior que responde antes da regra:** o token inválido responde antes do argon2 e antes de qualquer travamento (o espião do semáforo prova que não ocupou); a conta desligada responde igual ao e-mail sem conta, mas os contadores andam antes de olhar a conta (o teste do quarto pedido usa conta ativa para o balde do e-mail ser o que corta).
5. **A asserção olha o resultado:** o corpo e o tempo da resposta, as linhas de `link_da_conta` (envio, cifrados, `usado_em`), o job em `job_registro`, as linhas de auditoria por escola, as sessões encerradas e o que o login responde depois; o piso é provado pelo relógio falso e pelo espião de `esperar`, nunca por cronômetro.
6. **Guarda nova:** a `cerca-envio` tem uma fixture por forma de contornar (vizinho, reexportação, `import()` dinâmico), o teste que reprova sem o alvo e a zona no `architecture.test.ts` (a varredura por nome); o `ignore` da configuração não esconde o real.
7. **Comentário que afirma o que o código não faz:** os docblocks de `SenhaService`, `reservarLink`, `concluirLink`, `fecharEnviosDeLinkParados` e `usarLinkPorHash` foram relidos contra o código; o do `SISTEMA_DA_REQUISICAO` diz que só o tipo listado nasce de requisição, e o teste "outro `sistema.*`" prova isso.
8. **Divergência:** nenhuma. A verificação do e-mail no redefinir (`emailVerificadoEm`) é da 7.3, que cria a coluna; esta tarefa troca a senha e deixa o MFA como está, como a Tech Spec diz.
9. **Peça que já existe:** `WindowCounter` e `insuranceLimit` (os baldes), `HashBulkhead` e `equipeBucket` (o semáforo), `PasswordHasher`, `ContaGlobalRepository.encerrarSessoesDaConta`, `SecretCipher`, `LimiteDeEmailPorMinuto`, `JobOutbox`, `runInContext` e `AuditoriaRecorder`, e o processor do convite, que virou genérico (`criarEnvios`). Peça nova só a tabela, o `PisoDoEsqueci` e a cerca.
10. **Paralelo:** dois "esqueci" com o primeiro preso no insert, o "esqueci" com o envio antigo `enviando` (a barreira), dois "redefinir" com o mesmo token e dois jobs do mesmo link; todos com a ordem forçada (`WriteBlockTrigger` e `esperarNaTrava`), não `Promise.all` solto.
11. **Isolamento e coluna "Caso":** o link e a conta são globais (sem escola); o isolamento que importa é o registro por escola (nada da B no da A) e o usuário desativado da B; a coluna "Caso" abaixo tem o caso de cada linha.
12. **Guardiões:** `tenancy-guardian` (cada método `@Unscoped` com a justificativa de uma linha e a linha de `link_da_conta` lida só pelo id ou pelo hash), `privacy-guardian` (token e endereço só cifrados e só enquanto o envio espera, log só com `linkId`, nada do endereço na resposta nem no log), `infra-guardian` (202 sem trabalho demorado: o envio vai para a fila `normal`, a vaga do sistema é solta ao adiar, `EMAIL_POR_MINUTO` com a metade reservada, o expurgo em lote) e `test-engineer` (mutações, paralelos, coluna "Caso"). O `achados/indice.md` foi lido: as exigências das tarefas 1.0 a 3.0 sobre cifrados e `criado_em` do envio parado estão atendidas aqui.

## Fora do escopo desta tarefa

As telas (6.0); a verificação do e-mail (7.0).

## Divergências resolvidas nesta tarefa

nenhuma.

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 24 linhas (38 blocos, 16 motivos). Cada bloco foi aplicado e rodado pelo portão da tarefa (`conferirMutacoesDoDocumento`): todos ficaram vermelhos num caso que rodou e falhou.

Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho.

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › dois "redefinir" com o mesmo token
      .update(linkDaConta)
      .set({ usadoEm: sql`now()` })
-      .where(and(eq(linkDaConta.tokenHash, tokenHash), eq(linkDaConta.finalidade, finalidade), isNull(linkDaConta.usadoEm), gt(linkDaConta.expiraEm, sql`now()`)))
+      .where(and(eq(linkDaConta.tokenHash, tokenHash), eq(linkDaConta.finalidade, finalidade), gt(linkDaConta.expiraEm, sql`now()`)))
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › dois "esqueci" ao mesmo tempo, o primeiro preso no insert
-      if (!linkJaAberto(erro)) throw erro
+      throw erro
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o link vencido, o usado e o substituído
-        await resolucao.cancelarLinksAbertos(contaId, 'redefinir')
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o envio antigo preso na barreira
-        envio: sql`case when ${linkDaConta.envio} in ('na_fila', 'enviando') then 'cancelado' else ${linkDaConta.envio} end`,
+        envio: sql`${linkDaConta.envio}`,
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › token inválido não ocupa o semáforo do argon2
-    if (valido === undefined) throw linkInvalido()
+    if (valido === undefined) await semaforo.executar(equipeBucket(ip), () => hash.gerar(pedido.senha))
+    if (valido === undefined) throw linkInvalido()
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › troca a senha, derruba as sessões
-      await new ContaGlobalRepository(tx).encerrarSessoesDaConta(valido.contaId, 'senha_redefinida')
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › grava `senha.redefinida` em cada escola
-      for (const ativo of usuarios) if (!porEscola.has(ativo.escolaId)) porEscola.set(ativo.escolaId, ativo.usuarioId)
+      for (const ativo of usuarios) if (porEscola.size === 0) porEscola.set(ativo.escolaId, ativo.usuarioId)
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o usuário desativado depois da leitura do link
-      if (usuarios.length === 0) throw linkInvalido()
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › conta desligada: 202 sem link
-    if (doIp || doEmail) return
+    if (doIp) return
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › balde rl:ip:senha cheio
-    if (doIp || doEmail) return
+    if (doEmail) return
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › e-mail com conta e e-mail sem conta
-    if (falta > 0) await this.#esperar(falta)
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › outro `sistema.*` pedido por requisição
-    const daRequisicao = SISTEMA_DA_REQUISICAO.some((tipo) => tipo === linha.tipo)
+    const daRequisicao = linha.tipo.startsWith(PREFIXO_TIPO_SISTEMA)
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › cancelado com o job na barreira
      .set({ envio: desfecho, tokenCifrado: null, destinoCifrado: null, envioReservadoEm: null })
-      .where(and(eq(linkDaConta.id, linkId), eq(linkDaConta.envio, 'enviando'), eq(linkDaConta.envioReservadoEm, reserva)))
+      .where(and(eq(linkDaConta.id, linkId)))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › reserva alheia vigente
    const [atual] = await this.banco.select({ envio: linkDaConta.envio, reservadoEm: linkDaConta.envioReservadoEm }).from(linkDaConta).where(eq(linkDaConta.id, linkId))
    if (atual === undefined) return { resultado: 'inexistente' }
-    if (atual.envio === 'enviando' && atual.reservadoEm !== null) return { resultado: 'reserva_alheia', ate: new Date(atual.reservadoEm.getTime() + MINUTOS_DA_RESERVA_DO_ENVIO * 60_000) }
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › envio do link da conta parado
-        where envio in ('na_fila', 'enviando')
+        where envio in ('na_fila')
```

```mutacao
arquivo: packages/core/src/email/mensagem-do-link-da-conta.ts
teste: packages/core/src/email/mensagem-do-link-da-conta.test.ts
-  const link = `${urlDaWeb}${CAMINHO_POR_FINALIDADE[finalidade]}#${token}`
+  const link = `${urlDaWeb}${CAMINHO_POR_FINALIDADE[finalidade]}?token=${token}`
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › troca a senha, derruba as sessões
-    await this.banco.update(conta).set({ senhaHash }).where(eq(conta.id, contaId))
+    await this.banco.update(conta).set({ senhaHash })
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › e-mail com conta e e-mail sem conta
-    if (achada === undefined) return
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › conta desligada: 202 sem link
-    if ((await resolucao.usuariosAtivosDaConta(achada.id, { comSuspensos: true })).length === 0) return
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › com os convites enchendo a metade deles
-    if (consumo.resultado === 'sem_vaga') adiar(id, tentativa, consumo.msBeforeNext, 'limite')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › reserva alheia vigente
-    if (reservado.resultado === 'reserva_alheia') adiar(id, tentativa, Math.max(0, reservado.ate.getTime() - relogio.agora().getTime()), 'reserva_alheia')
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › 5xx
-    if (tipo === 'permanente' || tentativa >= destino.tentativas) return gravarFalha(id, tentativa, reserva, tipo)
+    if (tentativa >= destino.tentativas) return gravarFalha(id, tentativa, reserva, tipo)
```

```mutacao
arquivo: apps/worker/src/processors/enviar-email.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › 4xx em toda tentativa
-    if (tipo === 'permanente' || tentativa >= destino.tentativas) return gravarFalha(id, tentativa, reserva, tipo)
+    if (tipo === 'permanente') return gravarFalha(id, tentativa, reserva, tipo)
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o "esqueci" de uma conta não cancela o link aberto de outra
-      .where(and(eq(linkDaConta.contaId, contaId), eq(linkDaConta.finalidade, finalidade), isNull(linkDaConta.usadoEm)))
+      .where(and(eq(linkDaConta.finalidade, finalidade), isNull(linkDaConta.usadoEm)))
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o token de outra finalidade não serve
-      .where(and(eq(linkDaConta.contaId, contaId), eq(linkDaConta.finalidade, finalidade), isNull(linkDaConta.usadoEm)))
+      .where(and(eq(linkDaConta.contaId, contaId), isNull(linkDaConta.usadoEm)))
```

```mutacao
arquivo: apps/api/src/sessao/tenant/tenant-resolution.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o token de outra finalidade não serve
          eq(linkDaConta.tokenHash, tokenHash),
-          eq(linkDaConta.finalidade, finalidade),
          isNull(linkDaConta.usadoEm),
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.repository.ts
teste: apps/api/test/senha-esqueci.int.test.ts › outro `sistema.*` pedido por requisição
-      .values({ ...linha, escolaId: doSistema ? null : (contexto?.escolaId ?? null), requisicaoId: contexto?.requisicaoId ?? null })
+      .values({ ...linha, escolaId: contexto?.escolaId ?? null, requisicaoId: contexto?.requisicaoId ?? null })
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › cancelado enquanto o servidor responde 4xx
      .update(linkDaConta)
      .set({ envio: 'na_fila', envioReservadoEm: null })
-      .where(and(eq(linkDaConta.id, linkId), eq(linkDaConta.envio, 'enviando'), eq(linkDaConta.envioReservadoEm, reserva)))
+      .where(and(eq(linkDaConta.id, linkId)))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › o desfecho é da reserva
      .set({ envio: desfecho, tokenCifrado: null, destinoCifrado: null, envioReservadoEm: null })
-      .where(and(eq(linkDaConta.id, linkId), eq(linkDaConta.envio, 'enviando'), eq(linkDaConta.envioReservadoEm, reserva)))
+      .where(and(eq(linkDaConta.id, linkId), eq(linkDaConta.envio, 'enviando')))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › o desfecho é da reserva
      .update(linkDaConta)
      .set({ envio: 'na_fila', envioReservadoEm: null })
-      .where(and(eq(linkDaConta.id, linkId), eq(linkDaConta.envio, 'enviando'), eq(linkDaConta.envioReservadoEm, reserva)))
+      .where(and(eq(linkDaConta.id, linkId), eq(linkDaConta.envio, 'enviando')))
```

```mutacao
arquivo: packages/core/src/email/envio.repository.ts
teste: apps/worker/test/enviar-email-da-conta.int.test.ts › reserva alheia vigente
      where id = ${linkId}
-        and (envio = 'na_fila' or (envio = 'enviando' and envio_reservado_em <= now() - make_interval(mins => ${MINUTOS_DA_RESERVA_DO_ENVIO})))
+        and envio = 'na_fila'
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › envio do link da conta parado
        where envio in ('na_fila', 'enviando')
-          and criado_em < ${agora.toISOString()}::timestamptz - make_interval(hours => ${HORAS_DO_ENVIO_DE_CONVITE_NA_FILA})
        order by criado_em
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo
-      where coalesce(usado_em, expira_em) < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_LINK_DA_CONTA_DIAS})
+      where expira_em < ${agora.toISOString()}::timestamptz - make_interval(days => ${RETENCAO_LINK_DA_CONTA_DIAS})
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › o piso desconta o trabalho já feito
-    if (falta > 0) await this.#esperar(falta)
+    await this.#esperar(PISO_DO_ESQUECI_MS)
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › os baldes do "esqueci" caem para o seguro
-    return valor > (doSeguro ? insuranceLimit(limite, this.dependencias.instancias) : limite)
+    return valor > limite
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › a eliminação agendada numa escola não tira a conta do "esqueci"
-    if ((await resolucao.usuariosAtivosDaConta(achada.id, { comSuspensos: true })).length === 0) return
+    if ((await resolucao.usuariosAtivosDaConta(achada.id)).length === 0) return
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › a eliminação agendada numa escola não tira a conta do "esqueci"
-      const usuarios = await naTransacao.usuariosAtivosDaConta(valido.contaId, { comSuspensos: true })
+      const usuarios = await naTransacao.usuariosAtivosDaConta(valido.contaId)
```

```mutacao
arquivo: apps/api/src/sessao/senha/senha.service.ts
teste: apps/api/test/senha-esqueci.int.test.ts › e-mail com conta e e-mail sem conta
-      this.dependencias.logger.info({ evento: 'senha.link_na_fila', linkId })
+      this.dependencias.logger.info({ evento: 'senha.link_na_fila' })
```

`--faltando` depois dos blocos: as linhas que sobram e o motivo de cada grupo.

- Valores padrão de produção e opção só de teste: `senha.service.ts` `relogio ?? systemClock`, `esperar ?? esperarDeVerdade`, `currentContext()?.requisicaoId ?? randomUUID()`; `app.module.ts` e `sessao.module.ts` (`pisoDoEsqueci` só entra quando o teste o dá; `logger ?? createLogger(…)` é o logger de produção quando o `main.ts` não passa um). Nenhum teste os distingue: o contrário é o relógio falso que os testes injetam.
- Estreitamento de tipo, sem ramo alcançável com o banco de pé: `id === undefined` do `uuidv7()` e `resultado.rowCount ?? 0`.
- Saídas do job que já têm caso, mas não bloco: `if (reservado === undefined) return` (job adiado ou link encerrado; os casos "o job repetido depois de `enviado`" e "reserva alheia vigente" o percorrem) e `reservado !== undefined` do `reservarLink` (o caminho feliz de todos os casos do worker).
- Defesa repetida dentro da transação, com a mesma resposta (404): os termos `gt(expira_em)`, `isNotNull(conta.email)` e `exists (usuário ativo)` de `linkValidoPorHash` repetem o que `usarLinkPorHash` e a contagem de `usuariosAtivosDaConta` conferem com a conta travada; tirar um deles não muda o que o cliente vê. O `usado.contaId !== valido.contaId` e o `travarContaParaRedefinir === undefined` são a mesma defesa, para o link trocado entre a leitura e a transação, e só uma corrida entre a leitura e a transação os alcança (o caso "desativado depois da leitura" cobre o `usuarios.length === 0`).
- `job-outbox.repository.ts:84` (`doSistema && !daRequisicao && (rotinaDoSistema !== true || escolaId !== undefined)`): o `!daRequisicao` e a escola nula do job têm blocos (12 e o do `escolaId`); os termos `contexto?.rotinaDoSistema !== true` e `contexto.escolaId !== undefined` são da regra de antes desta tarefa, e o caso "outro `sistema.*` pedido por requisição" os percorre nas duas formas (sem escola e com escola no contexto). Sem bloco por termo.
- `TENTATIVAS_DO_ENVIO_DO_LINK_DA_CONTA` no lugar de `TENTATIVAS_DO_ENVIO_DE_EMAIL` (`enviar-email.ts`, `tentativas` do destino): hoje as duas definições têm a mesma `RETENTATIVA_DE_HOJE` (5), e nenhum caso distingue; a mudança é a leitura da definição de cada tipo, e o valor só diverge quando alguém mudar uma das duas.
- `usarLinkPorHash` sem a `finalidade`: `linkValidoPorHash` já recusa o token de outra finalidade antes do argon2 (bloco acima), e a transação repete a condição para a corrida entre a leitura e o uso; sem corrida, a resposta é a mesma.
- Redis fora no job (`enviar-email.ts:168`, `consumo === undefined` → `adiar(…, 'redis')`): o processor é o mesmo do convite, e `enviar-email-adiamento.int.test.ts` (o "Redis fora") o percorre para o convite; o link da conta não tem caso próprio.
- `cancelarLinksAbertos` sem o `isNull(usado_em)`: o link já usado não está `na_fila` nem `enviando` e o `case` o deixa como está; só o `usado_em` ganharia a hora do cancelamento, e ninguém lê esse campo além do prazo de 30 dias.
- `linkJaAberto` sem o nome da restrição: a outra violação única da tabela é o `token_hash`, de 256 bits aleatórios, que não colide.
- O termo `eq(linkDaConta.envio, 'enviando')` de `concluirLink` e `devolverLink`, sozinho: é mutação equivalente. O check
  `link_da_conta_reserva_so_enviando` (`envio_reservado_em is null or envio = 'enviando'`) garante que uma linha com marca
  está `enviando`, então a marca já recusa sozinha toda linha fora de `enviando`. Os blocos que tiram os dois termos juntos
  provam o par contra o cancelamento.
- `link_da_conta_aberto_unico` no schema: é DDL da migration, fora do que o `mutacoes.ts` aplica; o caso "dois esqueci, o primeiro preso no insert" o exige (sem o índice os dois links abririam).
- Rótulos de log do worker (`gravou ? 'gravado' : 'reserva_perdida'`, `resultadoGravado`) e `erro instanceof EmailSendError ? … : 'transitoria'`: o desfecho gravado no banco tem bloco (13, 16 e os dois do `falhou`); o rótulo só muda o texto do log, que o caso "cancelado com o job na barreira" lê.
- `email === undefined ? {} : …` em `composition.ts`: o worker sem SMTP não registra os dois e-mails juntos. O `composition.test.ts` prova que, com SMTP, o tipo novo está registrado na `normal`; o ramo sem SMTP é o de antes da tarefa (`pecasDoEmail` devolve `undefined`, linha 70 do mesmo teste).
- `mensagem-do-link-da-conta.ts:24` (`finalidade === 'verificar'`): o texto de `verificar` é da 7.0; o caso do worker "o link de `verificar` leva o caminho e a validade dele" o prova.
- `expurgar-acesso.ts:52` (`doLote < lote`): a saída do laço quando o lote não enche, a mesma forma do laço dos demais alvos. O caso de lote cheio do link não tem teste próprio: o fechamento do `enviando` e do `na_fila` (o que a tarefa acrescenta) tem o bloco 15.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | O piso de 400 ms não cobre o erro: falha de banco ou de cifra em `#abrirLink` responde 500 só para a conta existente; engolir a falha depois do piso e devolver 202 | `TODO.md`. Muda comportamento e contrato do 202; precisa de decisão de produto sobre engolir erro de infraestrutura. Hoje o 500 só aparece com o banco ou a cifra fora do ar, e não por causa do e-mail digitado |
| tenancy-guardian (1ª) | Três `@Unscoped` novos no `EnvioRepository`; separar os métodos do link numa classe própria (`EnvioDoLinkRepository`) | Retro da funcionalidade. A Tech Spec seção 6 previu o desenho, e a `cerca-envio` limita quem importa a classe; é o sinal do item 9 da regra 10, registrado, não defeito |
| tenancy-guardian (1ª) | `ExpurgoDeAcessoRepository` passa de dois para três `@Unscoped` | Só o registro do sinal, como o próprio revisor diz: os três são rotina nossa e têm justificativa |
| revisor-geral (1ª) | O texto do e-mail de `verificar` já foi escrito aqui, e é da 7.0 | Tarefa 7.0: ela confere o texto contra o `cenarios.md`. O `Record` sobre `FinalidadeDoLinkDaConta` obriga o ramo e a 7.0 não lista esse arquivo |
| revisor-geral (1ª) | `senha.service.ts` importa `tokenNovo` de `../convite/convite.service.js`; mover para `credencial/token-hash.js` | `TODO.md`. Mexe em `convite.service.ts` e em módulo que a tarefa não toca |
| infra-guardian (1ª) e revisor-geral (1ª) | Rótulo `classe` (`convite` ou `conta`) em `email_por_resultado` e `email_adiado`, para o alerta `educa-email-falhou` separar o link da conta | `TODO.md`, junto da 7.0. Muda a série da métrica e o alerta; a descrição "do convite" é corrigida no item 17 |
| infra-guardian (1ª) | Contador `senha.esqueci.descartado{motivo: ip|email}` para o balde cheio | `TODO.md`. É métrica nova; o runbook já manda deduzir do log `senha.link_na_fila` rarefeito |
| infra-guardian (1ª) | `ADD CONSTRAINT sessao_motivo_valido CHECK` sem `NOT VALID` trava a `sessao` | Recusada, com o motivo do próprio revisor: as migrations 0013 e 0035 fizeram o mesmo, a `sessao` guarda 30 dias e o deploy é fora do horário letivo. Vale na próxima vez que o check crescer |
| infra-guardian (1ª) | `fecharEnviosDeLinkParados` filtra por `envio` e `criado_em` sem índice | Recusada: a tabela é só da equipe e guarda 30 dias; revisitar se a 7.0 aumentar o volume |
| test-engineer (1ª) | Redis fora no job do link da conta, sem caso | Recusada: o processor é o mesmo do convite, e `enviar-email-adiamento.int.test.ts` o percorre. O motivo já está no `--faltando` |
| tenancy-guardian (2ª) | O teste do worker importa `TenantResolutionRepository` de `apps/api/src`; conferir se `tools/guardas/camadas.cjs` aceita a dependência só em teste | Recusada: o `revisor-geral` (2ª) confirmou que o projeto já faz isso em outros testes do worker (`queue.fixture.ts`, `enviar-email.int.test.ts`), e o portão (que roda as camadas) está verde |
| tenancy-guardian (2ª) | Uma linha no caso da eliminação agendada conferindo que o login por e-mail na escola da eliminação segue dando `ACESSO_SUSPENSO` | `TODO.md`. O comentário do caso diz que o login tem caso próprio; quem confere é a validação da funcionalidade |
| privacy-guardian (2ª) e revisor-geral (2ª) | `senha.redefinida` ainda sai pelo `Logger` do Nest, sem id, e o serviço usa dois loggers; passar para o logger JSON e remover o `#logger` | `TODO.md`. Não vaza dado; muda o formato de um evento já provado pelo teste do log |
| privacy-guardian (2ª) | A eliminação agendada recebe `senha.redefinida` depois do agendamento; confirmar na tarefa da eliminação que o registro é tratado quando ela se cumpre (D85) | `TODO.md`, para a tarefa que mexer na eliminação |
| revisor-geral (2ª) | `comSuspensos: true` no "esqueci" e no "redefinir" não aparece na `techspec.md` nem no `cenarios.md`; registrar lá | Validação da funcionalidade (Validador cruza com a Tech Spec) e Arquiteto, se ela confirmar a escolha. O comportamento é o da 1ª rodada, aprovado por privacy-guardian e tenancy-guardian |
| revisor-geral (2ª) | O espião de `WindowCounter.prototype.somar` do caso "o piso desconta o trabalho já feito" supõe duas chamadas por pedido | `TODO.md`. Só quebra se um terceiro contador entrar no "esqueci"; hoje o caso tem bloco vermelho |
| conformidade-reviewer (2ª) | Um teste que falhe quando `SISTEMA_DA_REQUISICAO` ganhar um segundo tipo, em vez de só o comentário | Retro da funcionalidade |
| infra-guardian (2ª) | Rótulo `classe` em `email_por_resultado` e contador `senha.esqueci.descartado` | Já em `TODO.md`, junto da 7.0 (ordem da rodada 1) |
| test-engineer (3ª) | No caso novo "o desfecho é da reserva…", os dois `throw new Error(...)` de guarda (linhas 291 e 295 de `enviar-email-da-conta.int.test.ts`) poderiam virar `expect(primeira.resultado).toBe('reservado')`, com o `if` só para estreitar o tipo | Recusada: estilo, sem mudar o que o caso prova; o `throw` falha o caso do mesmo jeito. Recomendação de revisor que aprovou, fora da primeira ordem do documento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 01:25:21 | 2026-11-08 01:25:52 | `conformidade-reviewer` | 1 | APROVADO | a5b3329f9a8212a59 |
| 2026-11-08 01:24:57 | 2026-11-08 01:26:37 | `privacy-guardian` | 1 | APROVADO | ac62b3a4379d5fb3b |
| 2026-11-08 01:24:51 | 2026-11-08 01:26:38 | `tenancy-guardian` | 1 | APROVADO | a8a07cf2a0d752abc |
| 2026-11-08 01:25:14 | 2026-11-08 01:27:31 | `revisor-geral` | 1 | APROVADO | a769a109c2f8c5948 |
| 2026-11-08 01:25:04 | 2026-11-08 01:27:47 | `infra-guardian` | 1 | APROVADO | a5e727d197dde405b |
| 2026-11-08 01:25:10 | 2026-11-08 01:30:10 | `test-engineer` | 1 | REPROVADO | a2f7a68619bf218b2 |
| 2026-11-08 02:42:06 | 2026-11-08 02:42:32 | `tenancy-guardian` | 2 | APROVADO | ade22247a2aa86d37 |
| 2026-11-08 02:42:16 | 2026-11-08 02:43:04 | `privacy-guardian` | 2 | APROVADO | aad6cd6c12ea8da17 |
| 2026-11-08 02:42:43 | 2026-11-08 02:43:07 | `conformidade-reviewer` | 2 | APROVADO | a4ff6dd479067784c |
| 2026-11-08 02:42:33 | 2026-11-08 02:43:24 | `revisor-geral` | 2 | APROVADO | a7c9c8213ffc38728 |
| 2026-11-08 02:42:26 | 2026-11-08 02:43:53 | `infra-guardian` | 2 | APROVADO | a0de9b2633a5df1d7 |
| 2026-11-08 02:42:57 | 2026-11-08 02:45:21 | `test-engineer` | 2 | REPROVADO | a1457a39f4813c3f8 |
| 2026-11-08 03:10:17 | 2026-11-08 03:10:37 | `revisor-geral` | 3 | APROVADO | ae7915b5be4679468 |
| 2026-11-08 03:10:07 | 2026-11-08 03:11:06 | `test-engineer` | 3 | APROVADO | aab946f3882594ee1 |
