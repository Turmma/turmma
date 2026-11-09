# Tarefa 14.0 — A conta da escola no pedido do nome (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Na sala, o aluno prova a conta da escola (`intencao=reivindicar`), o pedido do nome guarda a conta no lugar da senha, e aprovar cria o aluno ligado a ela; antes da aprovação, a conta não entra; transferência e virada encerram o pedido sem a conta.

## Contexto necessário

- `techspec.md` seções 3 (`reivindicacao`, o check), 4, 5 ("Conta da escola do aluno") e 7
- `prd.md` RF14, RF16, RF17; `cenarios.md` RF14, "Corridas" (mesma conta, aprovar com conta ligada)
- `.claude/rules/20` item 2; `.claude/rules/10` item 6
- `apps/api/src/sessao/external/` (`external-login.service.ts`, `cookie-oidc.ts`), `apps/api/src/sala/reivindicacao/`, `apps/api/src/sala/decisao/decisao.service.ts`, o `travarPendente` e o `fechar('encerrada')` do F2

## Subtarefas

- [x] 14.1 — Migration `reivindicacao.contaExterna`, o único parcial e o check novo (`not valid` + `validate`)
- [x] 14.2 — `intencao=reivindicar` no `externa/iniciar` (o acesso na `TenantResolutionRepository`) e o cookie `educa_conta_provada`
- [x] 14.3 — O pedido com a conta; aprovar cria o usuário sem senha e a `conta_externa`, com `CONFLITO` que desfaz; `conta_externa.ligada`
- [x] 14.4 — O `fechar('encerrada')` anula a `contaExterna`; `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`; `docs/lgpd.md` (o cookie); o runbook recusa os pedidos de conta na volta de versão
- [x] 14.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0047_reivindicacao_conta.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/reivindicacao.ts` | alterado |
| `apps/api/src/sessao/external/external-login.service.ts` | alterado |
| `apps/api/src/sessao/external/cookie-oidc.ts` | alterado |
| `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` | alterado |
| `apps/api/src/sala/reivindicacao/reivindicacao.service.ts` | alterado |
| `apps/api/src/sala/reivindicacao/reivindicacao.repository.ts` | alterado |
| `apps/api/src/sala/decisao/decisao.service.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `docs/lgpd.md` | alterado |
| `docs/runbook.md` | alterado |
| `apps/api/test/reivindicacao-com-conta.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| domínio não liberado, cookie vencido | integração | recusado | `reivindicacao-com-conta.int.test.ts` › "domínio não liberado e conta pessoal sem domínio: recusados como sempre" e, para o vencido, "o cookie que não vale dá a mesma ENTRADA_INVALIDA"; o vencimento em `cookie-oidc.test.ts` › "volta a conta gravada, até os 15 minutos, e vence um instante depois" |
| isolamento: cookie da sala da A num pedido da B, ou de outro acesso | integração | a resposta do cookie inválido | `reivindicacao-com-conta.int.test.ts` › "o cookie que não vale dá a mesma ENTRADA_INVALIDA, sem pedido" (de outra escola e de outro acesso entre os oito) |
| isolamento: token da sala da B sob o slug da A | integração | recusado já no início | `reivindicacao-com-conta.int.test.ts` › "isolamento: o token e o código da sala da B sob o slug da A" e "o serviço também confere" |
| o cookie | integração | apagado ao gravar; não serve a um segundo | `reivindicacao-com-conta.int.test.ts` › "o pedido pendente guarda a conta" (apagado), "o cookie não serve a um segundo pedido" e "o reenvio com a mesma chave" |
| pedido pendente | integração | o login pela conta é credencial inválida | `reivindicacao-com-conta.int.test.ts` › "pedido pendente: o login pela conta é a credencial inválida" |
| aprovar | integração | liga, o aluno entra pela conta, `contaExterna` nula; recusar também a anula | `reivindicacao-com-conta.int.test.ts` › "aprovar liga, o aluno entra pela conta, e contaExterna fica nula" e "recusar descarta a conta" |
| aprovar com a conta já ligada a outro aluno | integração | `CONFLITO` sem nome nem id, nenhum usuário, pedido pendente | `reivindicacao-com-conta.int.test.ts` › "aprovar com a conta já ligada a outro aluno" |
| o banco | integração | sem e-mail nem foto do provedor, coluna a coluna | `reivindicacao-com-conta.int.test.ts` › "o banco não guarda e-mail, nome nem foto do provedor" |
| ano sem curso | integração | responde como hoje, sem pedido | `reivindicacao-com-conta.int.test.ts` › "ano sem curso" |
| transferência no job e virada do ano | integração | `contaExterna` nula, sem `decididaEm`, `decididaPor` nem `decididaComo` | `reivindicacao-com-conta.int.test.ts` › "a transferência no job (fechar encerrada pelos nomes) e a virada do ano" |
| o check, direto no banco | integração | recusa senha e conta juntas, nenhuma das duas, e decidido com `contaExterna` | `reivindicacao-com-conta.int.test.ts` › "o check direto no banco" e, para as linhas de antes da migration, "o check novo valida as linhas de antes da migration" |
| aluno desligado pela planilha | integração | não entra pela conta ligada | `reivindicacao-com-conta.int.test.ts` › "a conta ligada a aluno ativo entra como sempre" (a do desativado é recusada) |
| o código errado pelo `iniciar` | integração | N códigos errados somam N no contador de código errado da escola, e o certo segue ao provedor | `reivindicacao-com-conta.int.test.ts` › "o código errado pelo início soma no limite de código errado da escola" |
| lote `[ok, conflito, ok]` | integração | o `CONFLITO` para o lote: o primeiro decidido, o terceiro intocado, 409 sem ids | `reivindicacao-com-conta.int.test.ts` › "o lote [ok, conflito, ok]" |
| reenvio sem cookie | integração | responde `enviado` sem pedir a prova de novo; outro nome, sem cookie, é a `ENTRADA_INVALIDA` | `reivindicacao-com-conta.int.test.ts` › "o reenvio sem cookie, depois que o primeiro envio já o apagou" |
| `conta_externa.ligada` | integração | um registro na aprovação | `reivindicacao-com-conta.int.test.ts` › "conta_externa.ligada: um registro na aprovação" |
| [P] mesma conta em dois pedidos | paralelo | o segundo recusado | `reivindicacao-com-conta.int.test.ts` › "[P] mesma conta em dois pedidos ao mesmo tempo" |
| [P] clique duplo em aprovar | paralelo | uma `conta_externa` | `reivindicacao-com-conta.int.test.ts` › "[P] clique duplo em aprovar (professor × coordenação)" |
| o cookie da conta, sem banco | unidade | grava, vence, não serve de outro cookie nem de outra chave | `cookie-oidc.test.ts` › "cookie educa_conta_provada da conta da escola" (7 casos) |

## Como testar

- Precedente: `apps/api/test/salas-reivindicar.int.test.ts` › "o check do pedido: hash, chave e teve_matricula_errada só no pendente…" e "I4: o código e o token vigentes de B com o slug de A não reivindicam nada…"
- OIDC: `apps/api/test/external-login.int.test.ts` › "borda (RF10): a aluna de A com domínio válido e sem ligação é recusada…", contra o `oidc-falso` do compose; cookie em `apps/api/src/sessao/external/cookie-oidc.test.ts`
- Aprovação: `apps/api/test/decisao.int.test.ts` › "E18: as escritas da aprovação…" e, para o [P], "professor × coordenação aprovando o mesmo pedido…"
- Comando: `npx vitest run --project integracao apps/api/test/reivindicacao-com-conta.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 6: o check novo valida as linhas que já existem; teste com uma linha antiga plantada antes da migration.

1. **Mutação de cada cláusula:** uma por linha de condição do diff, na seção "Mutações" (28 blocos, rodados por mim antes do pedido com o mesmo `comandoDoTeste` do portão; os 28 ficaram vermelhos num caso que rodou e falhou, o #13 só depois de eu criar o caso do cookie cifrado pela nossa chave e fora do formato). Os três termos de `provada === undefined || escolaId || acessoId` têm um bloco cada; o `refine` do `iniciar` tem dois (o ramo da intenção e o do sem intenção); a trava `senhaHash !== null` do teto de hashes e a escolha `senha === undefined` têm os seus. Sobram 6 linhas que a ferramenta lista sem bloco, e cada uma tem o motivo em "Mutações".
2. **Texto na tela:** a tarefa não tem tela nem texto novo de interface; só `grep` de literal em `e2e/` não se aplica.
3. **O segundo dado:** o cookie da sala da A num pedido da B tem acesso e escola **diferentes** (os dois termos caem em blocos separados); o `provedorLiberado` tem escola com e sem o provedor; a conta já ligada a **outro** aluno e a ligada a aluno **desativado** são cenários à parte.
4. **Checagem anterior que responde antes:** o `salas/reivindicar` confere a conta **antes** de qualquer contador (por isso o cookie inválido não gasta o limite do nome) e o caso do cookie inválido olha `ENTRADA_INVALIDA` **e** o nome ainda livre; o `iniciar` com token da B sob o slug da A cai no `escolaId` do acesso antes de ir ao provedor, e o caso confere o 404, sem `Location` e sem cookie (o `oidc-falso` nem recebe a ida porque a resposta é o inexistente).
5. **A asserção olha o resultado:** pedido guardado → leio a linha do banco (`conta_externa` com os três campos, `senha_hash` nulo), não o texto do código; o isolamento planta o pedido/acesso da B direto no banco, com o mesmo `provedor/sujeito`.
6. **Guarda nova:** não há regra de lint nem teste estrutural novo. O check do banco tem o caso "direto no banco" (senha e conta juntas, nenhuma, decidido com conta) e o das linhas de antes da migration (a definição do check no banco aplicada a linhas no formato antigo).
7. **Comentário que afirma o que o código não faz:** conferidos o do `ReivindicacaoService`, do `DecisaoService.#ligarConta`, do `travarPendente`, do cookie e da migration; o da migration sobre o rollback agora diz "encerra, sem decisão", como o runbook.
8. **Divergência que cria regra:** a porta `SALA_PARA_A_CONTA` e o `acessoDaSalaId` no cookie OIDC entram na tabela de testes (isolamento do slug e `o serviço também confere`); `grep -n 'SALA_PARA_A_CONTA\|acessoDaSalaId\|conta=provada\|ENTRADA_INVALIDA' techspec.md` acha cada termo na §5 (linhas 133 a 142), e `grep -n 'ENTRADA_INVALIDA' cenarios.md` na linha 161. A rota `iniciar` é sem sessão: quem chama sem autenticação só consegue um 302 ao provedor (ou o inexistente) e a gravação de um cookie cifrado no próprio navegador; o `Set-Cookie` do pedido não grava nada no servidor; o código errado do `salas/abrir` conta no limite por escola que já existe.
9. **Peça que já existe:** `AcessoDaSala`, `ContaExternalRepository.ligar`, o `CookieOidc` (as funções `cifrar`/`decifrar` foram tiradas dele e reaproveitadas), `lerCookie`, o limite de código errado; nada copiado.
10. **Operação simultânea:** [P] mesma conta em dois pedidos (o índice único parcial, 23505 vira recusa, nunca 5xx) e [P] clique duplo em aprovar (professor × coordenação, `travarPendente` com `for update`), com `Promise.all` e conferência pelo efeito (uma `conta_externa`, um usuário, um registro `conta_externa.ligada`).
11. **Isolamento:** o do `iniciar` (token e código da B sob o slug da A, ambos), o do cookie (outra escola, outro acesso) e o do `serviço também confere` (escola do acesso diferente da do slug); sem a cláusula `sala.escolaId !== escolaId`, o #20 fica vermelho. Todo `Caso` da tabela aponta o teste e cada linha com "e" tem um caso por parte.
12. **Guardiões:** tenancy (escopo da escola/ano no `AcessoDaSala`, cookie sem escola vinda do cliente, `travarPendente` no alcance), privacy (a conta só opaca, sem e-mail nem foto, no `COLUNAS_FORA_DO_ARQUIVO`, `docs/lgpd.md` com o cookie e a coluna, cookie sem nada legível, sem log), infra (migration só expande, `not valid` + `validate`, índice parcial; runbook de volta de versão; semáforo do hash fora do caminho da conta; rótulos `conta_provada` e `conta_invalida` nos contadores que já existem, e as descrições no `metrics.ts` e no painel foram atualizadas). `achados/indice.md` lido: a linha 31 (o privacy-guardian da 1.0 já pedia `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`, que fiz) é a única que toca a tarefa; as de recomendação das 4.0 e 5.0 são de outras telas e rotas.

## Fora do escopo desta tarefa

O "ligar" em "Eu" (15.0); as telas (15.0 e 16.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O acesso da sala não é resolvido no `externa/iniciar` pela `TenantResolutionRepository` (arquivo previsto, que **não** foi alterado): o `sessao` não importa o `sala`, e a resolução do link/código com o limite de código errado já existe no `AcessoDaSala`. Entra a porta `SALA_PARA_A_CONTA` (interface no `sessao`, implementada no `sala`) e o `acessoDaSalaId` no cookie OIDC | o `sessao` ficaria dependendo do `sala` (camadas) e duplicaria o limite de código errado | `techspec.md` §5, "Conta da escola do aluno" (linhas 133 a 136: `SALA_PARA_A_CONTA`, `AcessoDaSala`, `acessoDaSalaId`) |
| O retorno do login volta a `/e/:slug/turma?conta=provada` e o `iniciar` recusa `intencao` de outro valor, e token ou código sem `intencao`, como o inexistente | a tela (15.0) precisa saber que a conta foi provada, e a rota é sem sessão: não pode haver forma de provar sem a intenção | `techspec.md` §5, "Conta da escola do aluno" (linhas 133 e 138: `conta=provada`, "responde como o inexistente"); `cenarios.md` RF14 (linha 161) |
| O cookie que não vale dá `ENTRADA_INVALIDA` (o mesmo código para ausente, vencido, adulterado, de outra escola e de outro acesso) e o `senha` do corpo de `salas/reivindicar` passa a opcional em `packages/shared`; `senha` presente: o cookie não é lido nem apagado | o contrato precisava aceitar o pedido sem senha, e a resposta igual para todos os cookies que não valem é a regra 10, item 6 | `techspec.md` §5, linhas 139 a 142 (`o contrato a torna opcional`, `ENTRADA_INVALIDA`); `cenarios.md` linha 161 |
| O runbook de volta de versão **encerra, sem decisão**, os pedidos de conta pendentes e devolve o nome à lista, em vez de "recusar" | recusar gravaria `decididaPor`/`decididaEm` sem decisão de ninguém, e o check do banco só aceita o encerrado sem eles | `techspec.md` §3, linha 47 ("o runbook encerra, sem decisão, os pedidos de conta pendentes e devolve o nome à lista") |
| Arquivos além dos previstos: `packages/shared` (`salas.ts`, `externa.ts`, `classificacao.ts`, `index.ts`), `packages/core` (`decisao.repository.ts`, `index.ts`, o snapshot `0047_snapshot.json`), `salas.controller.ts`, `external-login.controller.ts`, `sessao.module.ts`, `sala.module.ts`, `credencial-matricula.repository.ts` (aceita `senhaHash` nulo), `metrics.ts` e `fundacao.json` (descrições dos rótulos novos) | o contrato, o repository da decisão e os módulos são onde a spec já mandava mexer ("o `travarPendente` e o `fechar('encerrada')` do F2"); não há comportamento novo além do escrito | `techspec.md` §2 (módulos afetados) e §5, linhas 133 a 142 |

## Mutações

Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho. `INT` é `apps/api/test/reivindicacao-com-conta.int.test.ts` e `COOKIE` é `apps/api/src/sessao/external/cookie-oidc.test.ts`.

```mutacao
arquivo: apps/api/src/sala/decisao/decisao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › aprovar com a conta já ligada a outro aluno
-    if (ligacaoId === undefined) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/sala/decisao/decisao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › aprovar liga, o aluno entra pela conta
-        if (pedido.contaExterna !== null) await this.#ligarConta(tx, aluno.id, pedido.contaExterna)
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o cookie que não vale dá a mesma ENTRADA_INVALIDA
-  if (provada === undefined || provada.escolaId !== escolaId || provada.acessoId !== acessoId) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+  if (provada === undefined || provada.acessoId !== acessoId) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o cookie que não vale dá a mesma ENTRADA_INVALIDA
-  if (provada === undefined || provada.escolaId !== escolaId || provada.acessoId !== acessoId) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+  if (provada === undefined || provada.escolaId !== escolaId) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o cookie que não vale dá a mesma ENTRADA_INVALIDA
-  if (provada === undefined || provada.escolaId !== escolaId || provada.acessoId !== acessoId) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+  if (provada !== undefined && (provada.escolaId !== escolaId || provada.acessoId !== acessoId)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o pedido pendente guarda a conta
-    if (senha === undefined) return null
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o pedido pendente guarda a conta
-        const contaExterna = senha === undefined ? contaDoPedido(provada, escolaId, acessoId) : null
+        const contaExterna = null
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › com senha no corpo o cookie da conta não é lido
-        const contaExterna = senha === undefined ? contaDoPedido(provada, escolaId, acessoId) : null
+        const contaExterna = contaDoPedido(provada, escolaId, acessoId)
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o pedido de conta recusado
-          if (senhaHash !== null) await limites.hashSemPedido(turmaId)
+          await limites.hashSemPedido(turmaId)
```

```mutacao
arquivo: apps/api/src/sala/salas/salas.controller.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › com senha no corpo o cookie da conta não é lido
-    if (pedido.senha !== undefined) return this.reivindicacoes.reivindicar(pedido)
```

```mutacao
arquivo: apps/api/src/sessao/external/cookie-oidc.ts
teste: apps/api/src/sessao/external/cookie-oidc.test.ts › byte alterado, outra chave, valor ausente
-  if (valor === undefined || valor === '') return undefined
+  if (valor === '') return undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/cookie-oidc.ts
teste: apps/api/src/sessao/external/cookie-oidc.test.ts › chave que não tem 256 bits
-    if (chave.length !== 32) throw new InvariantException('a chave do cookie da conta provada precisa de 256 bits')
```

```mutacao
arquivo: apps/api/src/sessao/external/cookie-oidc.ts
teste: apps/api/src/sessao/external/cookie-oidc.test.ts › cifrado pela nossa chave mas fora do formato
-    if (!lido.success) return undefined
-    const { emitidoEm, ...conta } = lido.data
+    const { emitidoEm, ...conta } = lido.data!
```

```mutacao
arquivo: apps/api/src/sessao/external/cookie-oidc.ts
teste: apps/api/src/sessao/external/cookie-oidc.test.ts › volta a conta gravada, até os 15 minutos
-    if (idade > VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS * 1_000 || idade < -TOLERANCIA_DE_RELOGIO_MS) return undefined
+    if (idade < -TOLERANCIA_DE_RELOGIO_MS) return undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/cookie-oidc.ts
teste: apps/api/src/sessao/external/cookie-oidc.test.ts › emitido no futuro além da tolerância
-    if (idade > VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS * 1_000 || idade < -TOLERANCIA_DE_RELOGIO_MS) return undefined
+    if (idade > VALIDADE_DO_COOKIE_CONTA_PROVADA_SEGUNDOS * 1_000) return undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.controller.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › isolamento: o token e o código da sala da B
-  .refine((consulta) => (consulta.intencao === 'reivindicar' ? (consulta.token === undefined) !== (consulta.codigo === undefined) : consulta.token === undefined && consulta.codigo === undefined))
+  .refine((consulta) => (consulta.intencao === 'reivindicar' ? true : consulta.token === undefined && consulta.codigo === undefined))
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.controller.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › isolamento: o token e o código da sala da B
-  .refine((consulta) => (consulta.intencao === 'reivindicar' ? (consulta.token === undefined) !== (consulta.codigo === undefined) : consulta.token === undefined && consulta.codigo === undefined))
+  .refine((consulta) => (consulta.intencao === 'reivindicar' ? (consulta.token === undefined) !== (consulta.codigo === undefined) : true))
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.controller.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › ano sem curso
-    if (consulta.intencao === undefined) return redirecionar(resposta, await this.login.iniciar(provedor, consulta.slug))
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.controller.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › caminho feliz, pelo link e pelo código
-    const entrada = token !== undefined ? { slug, token } : codigo !== undefined ? { slug, codigo } : undefined
+    const entrada = codigo !== undefined ? { slug, codigo } : undefined
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o serviço também confere
-    if (escolaId === undefined || (sala !== undefined && sala.escolaId !== escolaId)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (escolaId === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › caminho feliz, pelo link e pelo código
-        ...(sala === undefined ? {} : { acessoDaSalaId: sala.acessoId }),
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › caminho feliz, pelo link e pelo código
-      if (decisao.tipo === 'provada') {
+      if (decisao.tipo === 'provada' && false) {
```

```mutacao
arquivo: apps/api/src/sessao/external/external-login.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o professor da escola, com a conta e o e-mail certos
-    if (acessoDaSalaId !== undefined) return { tipo: 'provada', conta: { escolaId, acessoId: acessoDaSalaId, ...chave } }
```

```mutacao
arquivo: apps/api/src/sessao/sessao.module.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o cookie que não vale dá a mesma ENTRADA_INVALIDA
-        { provide: CookieContaProvada, useFactory: () => new CookieContaProvada(opcoes.loginExterno.chaveDoCookie ?? new Uint8Array(randomBytes(32)), opcoes.identidade.ambiente) },
+        { provide: CookieContaProvada, useFactory: () => new CookieContaProvada(new Uint8Array(randomBytes(32)), opcoes.identidade.ambiente) },
```

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › aprovar liga, o aluno entra pela conta
-    if (senhaHash === null && contaExterna !== null) return { turmaId, listaNomeId, senhaHash: null, contaExterna }
```

```mutacao
arquivo: packages/core/src/estrutura/decisao.repository.ts
teste: apps/api/test/decisao.int.test.ts › E18: as escritas da aprovação
-    if (senhaHash !== null && contaExterna === null) return { turmaId, listaNomeId, senhaHash, contaExterna: null }
```

```mutacao
arquivo: apps/api/src/sala/sala.module.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o código errado pelo início soma no limite de código errado da escola
-          useFactory: (acessoDaSala: AcessoDaSala, limites: SalaRateLimits) => new SalaDoLoginPelaSala(acessoDaSala, config.chaveCodigo, limites),
+          useFactory: (acessoDaSala: AcessoDaSala, limites: SalaRateLimits) => new SalaDoLoginPelaSala(acessoDaSala, config.chaveCodigo, { antesDaBusca: async () => {}, codigoErrado: async () => {} }),
```

```mutacao
arquivo: apps/api/src/sala/reivindicacao/reivindicacao.service.ts
teste: apps/api/test/reivindicacao-com-conta.int.test.ts › o reenvio sem cookie, depois que o primeiro envio já o apagou
         const pedidos = new ReivindicacaoRepository(banco)
-        if (await pedidos.chaveGravada(turmaId, chaveEnvio)) return 'reenvio'
```

`--faltando: 6 linhas (28 blocos, 4 motivos).` Os 28 blocos foram aplicados e rodados antes do pedido, todos vermelhos num caso que rodou e falhou. Seis linhas novas com condição ficam sem bloco, por quatro motivos:

1. `cookie-oidc.ts` `if (bytes.length <= BYTES_DO_IV + BYTES_DA_ETIQUETA) return undefined`: tirada a linha, o `createDecipheriv` com o IV curto lança dentro do `try` logo abaixo e o `catch` devolve o mesmo `undefined`; rodei sem a linha e os 17 casos do cookie ficaram verdes. É defesa em profundidade, sem comportamento que o teste alcance.
2. `cookie-oidc.ts` `if (conteudo === undefined) return undefined` (as duas, `CookieOidc.ler` e `CookieContaProvada.ler`): tiradas, o `safeParse(undefined)` falha no esquema e devolve o mesmo `undefined`. Mesmo resultado, caminho mais curto.
3. `external-login.controller.ts` `if (entrada === undefined) throw NAO_ENCONTRADO`: o `refine` do esquema já recusa a consulta sem token nem código quando há `intencao`, e o #17 prova o `refine`; a linha é o estreitamento de tipo que o TypeScript exige, e nenhuma requisição chega a ela.
4. `decisao.repository.ts` `if (listaNomeId === null) throw InvariantException` e `reivindicacao.ts:84` `.where(...)` do índice: a primeira é a invariante do `reivindicacao_pendente_com_nome`, que já é checada pelo banco e é de antes da tarefa (só mudou de posição ao reescrever o retorno do `travarPendente`). O `.where` do schema só **descreve** o índice para o drizzle-kit; quem roda é o SQL da migration 0047, e o banco do teste já a aplicou, então tirar o `.where` do schema não muda nenhum teste; o índice parcial é provado em [P] mesma conta em dois pedidos (o 23505 só do pendente) e no caso do banco (a conta pode voltar a pedir depois de recusada).

**Sem mutação (a migration):** `0047_reivindicacao_conta.sql` não é código de `apps/*/src` ou `packages/*/src`; o check novo e o índice são provados no banco pelos casos "o check direto no banco", "o check novo valida as linhas de antes da migration" e "[P] mesma conta em dois pedidos".

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), infra-guardian (1ª) | Conferir o provedor ligado e liberado antes do `sala.achar` no `externa/iniciar` (`external-login.controller.ts:68`), para código errado sob escola sem o provedor não gastar o limite | `TODO.md`. Muda a ordem de duas checagens e a assinatura do `iniciar`; não vaza dado, só gasta tentativa do limite por escola |
| infra-guardian (1ª) | O `CONFLITO` interrompe o lote de aprovação (`decisao.service.ts:118`): devolver um resultado por id, ou recusar já no pedido a conta que já está ligada | Tarefa 16.0 (a tela de aprovação), a decidir com o Arquiteto: a Tech Spec manda `CONFLITO`, e mudar o lote muda contrato. O item 8 da ordem fixa o comportamento de hoje em teste |
| infra-guardian (1ª) | Cenário de carga com pedidos sem senha e o `oidc-falso` em `infra/k6/reivindicacao-em-sala.js` | `TODO.md`. O infra-guardian registra que a Tech Spec não pede cenário de carga para o caminho da conta, e ele é mais leve que o do hash |
| revisor-geral (1ª) | O barril `apps/api/src/sessao/index.ts` exporta `ExternalLoginService` só para o `api.app.get(...)` do teste | `TODO.md`. Mexe em teste e em API de módulo, fora do que a tarefa pede |
| test-engineer (1ª) | O cookie reaproveitado depois da aprovação abre outro pedido (o `reivindicar` não confere se a conta já está ligada na escola) | `TODO.md`, com as duas saídas do test-engineer (recusar no pedido, ou restringir o texto do `cenarios.md`). Muda comportamento ou texto de spec, e a decisão é do Arquiteto, antes da 15.0 |
| test-engineer (1ª) | A transferência provada pelo job da planilha, e não por `DecisaoRepository.fechar` direto | `TODO.md`. O check do banco já prova a anulação; trocar o caminho do teste é refatoração |
| privacy-guardian (1ª) | O professor com domínio liberado e sem ligação, entrando com `intencao=reivindicar`, vira "conta provada" e pode pedir um nome | `TODO.md`. A aprovação humana segura o caso, e "o professor da escola, com a conta e o e-mail certos" já está nos testes. Falta só a nota na spec |
| conformidade-reviewer (1ª) | O SQL de volta de versão do runbook não grava auditoria por pedido encerrado | `TODO.md`. O privacy-guardian avaliou o procedimento e aprovou sem exigir. Encerrar não é decidir sobre o aluno (regra 70 item 2) |
| tenancy-guardian (2ª), privacy-guardian (2ª) | O token ou código na query do GET `iniciar` fica no histórico do navegador do computador da escola: avaliar na 15.0 se a tela pode manter o token fora da URL (POST de formulário que redireciona) | `TODO.md`, para a 15.0 (a tela). Hoje está escrito em `docs/lgpd.md` |
| infra-guardian (2ª), revisor-geral (2ª) | Separar o `VALIDATE` e o índice da 0047 em passo próprio (índice `CONCURRENTLY`) quando a `reivindicacao` crescer | `TODO.md`, com o gatilho: o tamanho da tabela |
| infra-guardian (2ª), conformidade-reviewer (2ª) | O `CONFLITO` deixa o lote decidido pela metade e o 409 não diz quais ids passaram: a tela da 16.0 precisa reler os pedidos e mostrar o estado real | Tarefa 16.0, junto da decisão do contrato do lote (já na tabela da 1ª rodada) |
| test-engineer (2ª) | `reivindicacao-com-conta.int.test.ts:282`: para o código certo conferir também que o `Location` aponta para o authorize do `oidc-falso` | `TODO.md`. É teste que já passa e prova o essencial; só fecha a frase do nome do caso |
| test-engineer (2ª) | `reivindicacao-com-conta.int.test.ts:277`: excluir `a.codigo` do laço dos códigos errados, para o caso ser determinístico | `TODO.md`. Chance desprezível de colidir |
| test-engineer (2ª) | Comentário no caso do lote dizendo que a ordem dos ids faz parte do contrato | Tarefa 16.0, com o contrato do lote |
| revisor-geral (2ª) | Item no `TODO.md` para o passo próprio do `VALIDATE` e do índice, com o gatilho | Mesmo item da linha do infra-guardian acima |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 22:55:08 | 2026-11-08 22:55:43 | `conformidade-reviewer` | 1 | APROVADO | a6b7b7f3f6b261fbd |
| 2026-11-08 22:54:47 | 2026-11-08 22:55:52 | `tenancy-guardian` | 1 | APROVADO | a44bec230c39ff2e1 |
| 2026-11-08 22:54:51 | 2026-11-08 22:56:47 | `privacy-guardian` | 1 | APROVADO | a18322cbc97849c3c |
| 2026-11-08 22:54:55 | 2026-11-08 22:57:01 | `infra-guardian` | 1 | APROVADO | a49ac671c4e1d5045 |
| 2026-11-08 22:55:04 | 2026-11-08 22:57:26 | `revisor-geral` | 1 | REPROVADO | a1c78fbb49c68f685 |
| 2026-11-08 22:55:01 | 2026-11-08 22:59:15 | `test-engineer` | 1 | REPROVADO | ad84ba65848a0e9cb |
| 2026-11-08 23:22:30 | 2026-11-08 23:22:56 | `tenancy-guardian` | 2 | APROVADO | a7fb44f1c9f3cdd2f |
| 2026-11-08 23:22:42 | 2026-11-08 23:23:08 | `infra-guardian` | 2 | APROVADO | ad0e56ca062b638a3 |
| 2026-11-08 23:22:50 | 2026-11-08 23:23:14 | `conformidade-reviewer` | 2 | APROVADO | ae6e55f38833caaa8 |
| 2026-11-08 23:22:36 | 2026-11-08 23:23:26 | `privacy-guardian` | 2 | APROVADO | acbee375758acc146 |
| 2026-11-08 23:23:06 | 2026-11-08 23:23:28 | `revisor-geral` | 2 | APROVADO | a36578cdab0d99c4e |
| 2026-11-08 23:22:59 | 2026-11-08 23:23:53 | `test-engineer` | 2 | APROVADO | ad2b42352a9b45e0f |
