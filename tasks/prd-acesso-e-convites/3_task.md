# Tarefa 3.0 — A coordenação envia os convites por e-mail (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/professores/convites/enviar` refaz o convite de cada pendente ou vencido (todos, ou os selecionados) com canal `email`, enfileira o envio, grava `convite.enviado` com a coordenação como autora, respeita a cota de 300/h por escola, e `GET /v1/professores` mostra o `envio`.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Enviar", "Auditoria") e 7; `prd.md` RF11, RF16, RF17; `cenarios.md` RF11, RF16, "Auditoria"
- `.claude/rules/10` itens 3 e 6; `.claude/rules/80` itens 1 e 7
- `convite-de-professor.service.ts` (`refazerConviteDeProfessor`); `professores.service.ts`

## Subtarefas

- [x] 3.1 — Contrato em `packages/shared` e a rota
- [x] 3.2 — O filtro (pendente e vencido), o refazer em lote e o enfileiramento; "Copiar link" e "Reenviar" cancelam o envio antigo
- [x] 3.3 — A cota de 300/h: limitador novo no Redis de fila, N pontos atômicos, devolvidos no 429 e no rollback; Redis fora, 300 ÷ instâncias em memória
- [x] 3.4 — `convite.enviado`, gravado no pedido
- [x] 3.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/professores/professores.ts` | alterado |
| `apps/api/src/professores/professores.controller.ts` | alterado |
| `apps/api/src/professores/professores.service.ts` | alterado |
| `apps/api/src/professores/professores.repository.ts` | alterado |
| `apps/api/src/sessao/convite/convite-de-professor.service.ts` | alterado |
| `packages/core/src/rate-limit/cota-por-hora.ts` | novo |
| `packages/core/src/index.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `apps/api/test/convites-enviar.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| "Enviar" sem seleção | integração | exclui quem aceitou, inclui o vencido e o da planilha ou da grade | `"Enviar" sem seleção exclui quem aceitou, inclui o vencido e o copiado` (o convite copiado de 2 dias, no caso de "Reenviar", é o da planilha ou da grade) |
| seleção mista (pendente, vencido, revogado, aceito, ativo, desativado) | integração | só pendente e vencido, a contagem diz quantos, nunca 409 | `seleção que mistura pendente, vencido, revogado, aceito, ativo, desativado, um id inexistente e o de outra escola`; `seleção só de quem não espera o convite` (zero, sem gastar cota); `só o papel de professor entra…` (papel e conta limpa); `sem corpo vale {}`; `corpo inválido é ENTRADA_INVALIDA` |
| 2 pontos restantes, seleção de 6 com 2 que entram | integração | passa; um "Enviar" de 1 logo depois dá 429 | `conta o que entra, não a seleção` |
| cota esgotada, relógio falso | integração | 429 com 59 min, passa com 61 | `cota esgotada, relógio falso: 429 com Retry-After aos 59 min, e passa aos 61 min` |
| lote maior que a cota; 40 com 30 restantes | integração | 429 inteiro, nada na fila nem na auditoria; um de 30 depois passa | `lote maior que o que resta: 429 inteiro…` |
| transação desfeita depois do consumo | integração | a cota volta | `transação desfeita depois do consumo: a cota volta inteira` |
| Redis de fila fora | integração | seguro de 300 ÷ instâncias | `Redis de fila fora: vale o seguro em memória, 300 ÷ instâncias…` (e a janela de uma hora lá também); `a API montada com 3 instâncias e o Redis de fila fora…` (a montagem, não só a classe); `o script que o Redis ainda não conhece…` (NOSCRIPT e resposta fora do formato); `o que não é pedido de cota válido é recusado antes de gastar` |
| 40 pendentes, falso na barreira | integração | 40 na fila, resposta antes da barreira | `40 pendentes: os 40 ficam na_fila, a resposta volta sem esperar nenhum envio` (a API não tem o envio na requisição: o provedor é do worker, e a barreira do `FakeEmailSender` é a da 2.0, sem uso aqui) |
| isolamento: cota | integração | a A recebe 429, a B segue | `isolamento: a escola A sem cota recebe 429 e a B segue enviando` |
| isolamento: `usuarioIds` da B | integração | igual a inexistente, nada na fila | `isolamento: os usuarioIds da escola B são tratados como inexistentes…` |
| escola sem ano em curso | integração | funciona | `escola sem ano em curso: funciona` |
| permissão: professor chama "Enviar" | integração | recusado | `permissão: o professor, o aluno e quem não tem sessão não alcançam o "Enviar"` |
| "Copiar link" com envio `na_fila` e `enviando` | integração | `cancelado`, link antigo recusado | `"Copiar link" depois do "Enviar": o envio na_fila termina cancelado… com o envio enviando, o mesmo` |
| "Enviar" ou "Reenviar" sobre convite copiado de 2 dias | integração | id novo, token copiado recusado; `falhou` só 24 h depois do novo `criadoEm` | `"Enviar" e "Reenviar" sobre convite copiado de 2 dias…` (o caso roda o `fecharEnviosParados` do expurgo: com a hora de agora fecha 0, 25 h depois fecha os 2 envios e o `falhou` anula os cifrados) |
| `convite.enviado` | integração | um registro, autora a coordenação, canal, sem nome; nenhum do job | ``convite.enviado`: um registro por convite novo…`; e, no worker, `apps/worker/test/enviar-email.int.test.ts` › `leva a escola e o link…` (depois de um envio `enviado`, zero `convite.enviado` para o convite: o job não é autor) |
| GET depois de 5xx e de 4xx esgotado | integração | `envio = falhou` | `depois de o envio falhar… a lista mostra falhou`; `cada estado do envio aparece no professor…` |
| `contracts.test.ts` | integração | nenhuma saída com cifrado | `apps/api/test/contracts.test.ts` (`cifrado` entre as chaves proibidas) e `packages/shared/src/professores/professores.test.ts` (o contrato) |
| [P] dois lotes de 200 com 300 restantes | paralelo | um passa, o outro 429; cai com conferir e consumir em dois passos | `[P] dois lotes de 200 com 300 restantes, ao mesmo tempo…`; `devolver tira os pontos só na janela em que foram gastos` |
| [P] dois "Enviar", o 1º preso no insert | paralelo | um convite aberto e um e-mail por professor; cai sem o `catch` | `[P] dois "Enviar" ao mesmo tempo, o primeiro parado no insert…` |

## Como testar

- Precedente: `apps/api/test/professores.int.test.ts` › "E8: cadastrar devolve o link uma vez…"; apoio `SessaoFixtures.escolaComSessao('coordenador')` e `equipeComEmail` (`apps/api/test/sessao.fixture.ts`)
- 429 por escola: `apps/api/test/rate-limit.int.test.ts` › "um usuário acima do próprio limite recebe 429, e os outros da mesma escola seguem"
- Auditoria: `apps/api/test/ciclo-de-vida.int.test.ts` › "concorrência: dois cliques em desativar…"; barreira com `WriteBlockTrigger`
- Comando: `npx vitest run --project integracao apps/api/test/convites-enviar.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 3: a seleção precisa misturar estados, senão a cota pela seleção passa. Na 4: o `requireAnoEmCurso` não pode responder antes (escola sem ano).

**Respostas (plano, antes de codar):**

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco para cada cláusula do diff (a trava da escola, o filtro por estado e por papel, o `email !== null`, a seleção, o zero que não gasta cota, a cota pelo que entra e não pela seleção, a chave da cota por escola, a recusa 429, a devolução no rollback, o `enfileirar`, o `convite.enviado`, a cifra no convite novo, o "último convite" de cada professor, o `envio` na lista, o `.default({})` do corpo, a chave no `config.ts`, e cada termo do `CotaPorHora`: o inteiro positivo, o script Lua, o NOSCRIPT, o seguro em memória, a janela). O que não ganhou bloco tem a meia linha do motivo.
2. **Texto na tela:** nenhum. A tarefa não tem tela (a 4.0 é a tela); só `apps/web` ganhou `envio: null` em duas fixtures tipadas, e o schema tem `.default(null)`, então os mocks sem `envio` dos e2e seguem valendo.
3. **Segundo dado que torna a cláusula observável:** a seleção mista tem os seis estados (pendente, vencido, revogado, aceito, ativo, desativado), um id inexistente e um de outra escola; o 2-pontos-restantes tem seis na seleção e dois que entram (a cota pela seleção passaria com 6 e quebraria com 2); o papel tem um coordenador com convite de professor aberto; o `email !== null` tem uma conta limpa; o "último convite" tem professor com dois convites (o copiado e o do e-mail).
4. **Checagem anterior que responde antes da regra:** a rota não passa por `requireAnoEmCurso` (teste "escola sem ano em curso", com `ano_letivo` contado em zero antes do pedido). O professor chamando recebe 404 do guard de permissão antes de tudo, e o teste confere que nada mudou no banco.
5. **A asserção olha o resultado:** as linhas do banco (canal, envio, cifrados, aberto, `criado_em`), o job em `job_registro`, a auditoria, a lista e o que o link antigo responde em `/v1/convites/consultar`; o token cifrado é decifrado como o worker o faz e abre o convite. Nenhuma olha texto de arquivo.
6. **Guarda nova:** nenhuma regra de lint, teste estrutural ou trava de pasta foi criada; a `contracts.test.ts` ganhou `'cifrado'` na lista proibida das saídas.
7. **Comentário que afirma o que o código não faz:** os docblocks de `enviarConvitesDeProfessores`, `CotaPorHora` e `criarConvite` foram relidos contra o código; "só pendente e vencido entram" é a matriz `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO` (a mesma do "Copiar link"), e "os pontos voltam só na janela em que foram gastos" é o `devolver` com a janela, coberto por teste.
8. **Divergência:** nenhuma. A tarefa segue a Tech Spec, seção 5 ("Enviar").
9. **Peça que já existe:** `refazerSobATrava` (reaproveitada, ganhou só o `cifrarParaEnvio`), `ConviteRepository.travarEscola`, `estadoDoProfessor` e a matriz de refazer, `JobOutbox`, `SecretCipher`, `insuranceLimit` (o seguro de `300 ÷ instâncias`, a mesma conta do limite de requisições), `retryAfterSeconds`, `loadEmailConfig` (a derivação da chave virou `derivarChaveDoToken`, compartilhada com a API) e o `ESTADOS_DO_ENVIO`, que subiu do `core` para o `shared` (com reexportação). Peça nova só a `CotaPorHora`: nenhuma existente gasta N pontos de uma vez por hora.
10. **Paralelo:** dois lotes de 200 com 300 restantes contra o Redis real (`Promise.all`; um passa, o outro é recusado) e dois "Enviar" com o primeiro parado no insert pelo `WriteBlockTrigger`, o segundo na trava da escola (`esperarNaTravaDaEscola`), com a direção forçada (o primeiro entra primeiro).
11. **Isolamento e coluna "Caso":** o isolamento tem todos os ids da B lidos no contexto da A (os `usuarioIds`) e a cota da A esgotada com a B enviando; a coluna "Caso" abaixo tem o caso de cada linha.
12. **Guardiões:** `tenancy-guardian` (escopo no `professoresParaEnvio`, o `escolaId` da cota vem do contexto, id da B igual a inexistente), `privacy-guardian` (token e endereço só cifrados e só enquanto o envio espera, nada em log nem em auditoria, o job só leva o id), `infra-guardian` (nada demorado na requisição: a resposta volta com os convites `na_fila`; cota por escola, Redis fora, `EMAIL_TOKEN_KEY` na API e no compose) e `test-engineer` (mutações, paralelos, coluna "Caso"). O `achados/indice.md` das tarefas 1.0 e 2.0 foi lido: as exigências sobre cifrados e `criado_em` do envio parado estão atendidas aqui.

## Fora do escopo desta tarefa

A tela (4.0); o envio pelo worker (1.0, 2.0).

## Divergências resolvidas nesta tarefa

nenhuma.

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 1 linha (49 blocos, 1 motivo). Cada bloco foi aplicado e rodado antes do pedido (o mesmo `conferirMutacoes` do portão, sobre o `comandoDoTeste`): todos ficaram vermelhos num caso que rodou e falhou.

Motivo da linha sem bloco:

- `packages/core/src/convite/convite-da-escola.repository.ts:75` (`id === undefined`): `select uuidv7()` devolve sempre uma linha; o ramo só estreita o tipo para `noUncheckedIndexedAccess` e não tem como ser alcançado com o banco de pé.

Termos de linhas que o `--faltando` conta como alcançadas por um bloco da mesma linha, e que nenhum teste distingue (cada um com a razão):

- `convite-de-professor.service.ts` › `dados.ultimoConvite !== undefined`: as duas primeiras condições da linha já garantem o convite (`pendente` e `vencido`, os únicos estados que a matriz manda refazer, só existem com um último convite); o termo estreita o tipo para ler `ultimoConvite.id`.
- `convite.repository.ts` › `if (professores.length === 0) return []`: só poupa a segunda consulta; com a lista vazia, o `inArray` do Drizzle 0.45 devolve nenhum convite e o resultado é o mesmo.
- `convite.repository.ts` › o `escolaId` do `usuario` e o do `convite` em `professoresParaEnvio`: cada um sozinho é coberto pelo outro (sem o do `usuario`, o professor da B vem, mas os convites dele não, e ele cai em "ativo"; sem o do `convite`, os ids já são da escola). O bloco "`usuarioIds` da escola B" tira os dois ao mesmo tempo, e o teste fica vermelho.
- `convite.service.ts` › o ramo `{ cifrarParaEnvio }` contra `{}`: `{ cifrarParaEnvio: undefined }` e `{}` fazem a mesma coisa no `criarConvite`; o ramo existe por `exactOptionalPropertyTypes`. O bloco tira o ramo inteiro.
- `cota-por-hora.ts` › `!Array.isArray(resposta)`: sem ele, `resposta.length` num valor que não é lista dá `undefined !== 3` e cai na mesma recusa; só uma string de três letras passaria, e o `map` dela cai no `catch` do seguro. O termo do tamanho tem bloco.
- `cota-por-hora.ts` › `!(erro instanceof Error)` em `executar`: um valor lançado que não é `Error` não tem `message`, e o `startsWith` lança `TypeError`, que o `consumir` também trata como Redis fora (seguro). O termo do `NOSCRIPT` e o `throw` inteiro têm bloco.

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › dois "Enviar" ao mesmo tempo
       const convites = new ConviteRepository(tx)
-      await convites.travarEscola()
       const lidos = await convites.professoresParaEnvio(pedido.usuarioIds === undefined ? undefined : [...new Set(pedido.usuarioIds)])
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › os `usuarioIds` da escola B
-const lidos = await convites.professoresParaEnvio(pedido.usuarioIds === undefined ? undefined : [...new Set(pedido.usuarioIds)])
+const lidos = await convites.professoresParaEnvio(undefined)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › sem corpo vale
-const lidos = await convites.professoresParaEnvio(pedido.usuarioIds === undefined ? undefined : [...new Set(pedido.usuarioIds)])
+const lidos = await convites.professoresParaEnvio([...new Set(pedido.usuarioIds)])
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › seleção que mistura pendente
-return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[estadoDoProfessor(dados)] === 'refazer' && dados.ultimoConvite !== undefined && email !== null ? { email, origemId: dados.ultimoConvite.id } : undefined
+return dados.ultimoConvite !== undefined && email !== null ? { email, origemId: dados.ultimoConvite.id } : undefined
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › só o papel de professor entra
-return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[estadoDoProfessor(dados)] === 'refazer' && dados.ultimoConvite !== undefined && email !== null ? { email, origemId: dados.ultimoConvite.id } : undefined
+return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[estadoDoProfessor(dados)] === 'refazer' && dados.ultimoConvite !== undefined ? { email, origemId: dados.ultimoConvite.id } : undefined
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › seleção só de quem não espera
-if (entram.length === 0) return { quantidade: 0 }
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › conta o que entra, não a seleção
-const consumo = await envio.cota.consumir(escolaId, entram.length)
+const consumo = await envio.cota.consumir(escolaId, lidos.length)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › lote maior que o que resta
-const consumo = await envio.cota.consumir(escolaId, entram.length)
+const consumo = await envio.cota.consumir(escolaId, 1)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › isolamento: a escola A sem cota
-const consumo = await envio.cota.consumir(escolaId, entram.length)
+const consumo = await envio.cota.consumir('todas-as-escolas', entram.length)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › lote maior que o que resta
-if (consumo.resultado === 'recusado') throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, retryAfterSeconds(consumo.msAteLiberar))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › transação desfeita depois do consumo
-if (gasto !== undefined) await envio.cota.devolver(gasto)
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › "Enviar" sem seleção exclui
-await envio.fila.enfileirar(tx, TIPO_ENVIAR_CONVITE, { conviteId: refeito.conviteId })
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › `convite.enviado`: um registro
-await registro.gravar(tx, 'convite.enviado', { entidadeId: refeito.conviteId, depois: { tipo: 'professor', canal: 'email' } })
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › os `usuarioIds` da escola B
-.where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), usuarioIds === undefined ? undefined : inArray(usuario.id, [...usuarioIds])))
+.where(and(eq(usuario.papel, 'professor'), usuarioIds === undefined ? undefined : inArray(usuario.id, [...usuarioIds])))
 .orderBy(asc(usuario.id))
 if (professores.length === 0) return []
 const convites = await this.banco
  .select({ usuarioId: convite.usuarioId, id: convite.id, expiraEm: convite.expiraEm, usadoEm: convite.usadoEm, revogadoEm: convite.revogadoEm })
 .from(convite)
 .where(
 and(
-eq(convite.escolaId, escolaId),
 eq(convite.tipo, 'professor'),
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › só o papel de professor entra
-.where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), usuarioIds === undefined ? undefined : inArray(usuario.id, [...usuarioIds])))
+.where(and(eq(usuario.escolaId, escolaId), usuarioIds === undefined ? undefined : inArray(usuario.id, [...usuarioIds])))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › os `usuarioIds` da escola B
-.where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), usuarioIds === undefined ? undefined : inArray(usuario.id, [...usuarioIds])))
+.where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), undefined))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › sobre convite copiado de 2 dias
-for (const { usuarioId, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, lido)
+for (const { usuarioId, ...lido } of convites) ultimo.set(usuarioId, lido)
```

```mutacao
arquivo: apps/api/src/professores/professores.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › depois de o envio falhar
-for (const { usuarioId, envio, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, { convite: lido, envio })
+for (const { usuarioId, envio, ...lido } of convites) ultimo.set(usuarioId, { convite: lido, envio })
```

```mutacao
arquivo: apps/api/src/professores/professores.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › cada estado do envio aparece
-return { usuarioId, nome, desativadoEm, agora, ultimoConvite: doUltimo?.convite, envio: doUltimo?.envio ?? null }
+return { usuarioId, nome, desativadoEm, agora, ultimoConvite: doUltimo?.convite, envio: null }
```

```mutacao
arquivo: apps/api/src/professores/professores.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › cada estado do envio aparece
-itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio })),
+itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: null })),
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › "Enviar" sem seleção exclui
-const conviteId = await convites.criarConvite({ tipo, tokenHash: hashDoToken(token), usuarioId, expiraEm, ...(cifrarParaEnvio === undefined ? {} : { cifrarParaEnvio }) })
+const conviteId = await convites.criarConvite({ tipo, tokenHash: hashDoToken(token), usuarioId, expiraEm,  })
```

```mutacao
arquivo: packages/core/src/convite/convite-da-escola.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › "Enviar" sem seleção exclui
-if (dados.cifrarParaEnvio === undefined) {
+if (true) {
```

```mutacao
arquivo: apps/api/src/professores/professores.controller.ts
teste: apps/api/test/convites-enviar.int.test.ts › sem corpo vale
-enviarConvites(@Body(new ZodValidationPipe(enviarConvitesRequestSchema.default({}))) pedido: EnviarConvitesRequest): Promise<EnviarConvitesResponse> {
+enviarConvites(@Body(new ZodValidationPipe(enviarConvitesRequestSchema)) pedido: EnviarConvitesRequest): Promise<EnviarConvitesResponse> {
```

```mutacao
arquivo: apps/api/src/config.ts
teste: apps/api/src/config.test.ts › e-mail do convite
-if ('erro' in api || 'erro' in banco || 'erro' in identidade || 'erro' in login || 'erro' in loginExterno || 'erro' in sala || 'erro' in drenagem || 'erro' in limite || 'erro' in telemetria || 'erro' in ia || 'erro' in armazem || 'erro' in chaveDoEmail) {
+if ('erro' in api || 'erro' in banco || 'erro' in identidade || 'erro' in login || 'erro' in loginExterno || 'erro' in sala || 'erro' in drenagem || 'erro' in limite || 'erro' in telemetria || 'erro' in ia || 'erro' in armazem ) {
```

```mutacao
arquivo: apps/api/src/config.ts
teste: apps/api/src/config.test.ts › e-mail do convite
-const erros = [api, banco, identidade, login, loginExterno, sala, drenagem, limite, telemetria, ia, armazem, chaveDoEmail].flatMap((leitura) => ('erro' in leitura ? [leitura.erro] : []))
+const erros = [api, banco, identidade, login, loginExterno, sala, drenagem, limite, telemetria, ia, armazem].flatMap((leitura) => ('erro' in leitura ? [leitura.erro] : []))
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o que não é pedido de cota válido
falha: new CotaPorHora(redis, { porHora, instancias: 1 })
-if (!Number.isInteger(opcoes.porHora) || opcoes.porHora < 1) throw new InvariantException('a cota por hora precisa ser um inteiro positivo')
+if (opcoes.porHora < 1) throw new InvariantException('a cota por hora precisa ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o que não é pedido de cota válido
falha: new CotaPorHora(redis, { porHora, instancias: 1 })
-if (!Number.isInteger(opcoes.porHora) || opcoes.porHora < 1) throw new InvariantException('a cota por hora precisa ser um inteiro positivo')
+if (!Number.isInteger(opcoes.porHora)) throw new InvariantException('a cota por hora precisa ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o que não é pedido de cota válido
falha: new CotaPorHora(redis, { porHora: 10, instancias })
-if (!Number.isInteger(opcoes.instancias) || opcoes.instancias < 1) throw new InvariantException('as instâncias da cota por hora precisam ser um inteiro positivo')
+if (opcoes.instancias < 1) throw new InvariantException('as instâncias da cota por hora precisam ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o que não é pedido de cota válido
falha: new CotaPorHora(redis, { porHora: 10, instancias })
-if (!Number.isInteger(opcoes.instancias) || opcoes.instancias < 1) throw new InvariantException('as instâncias da cota por hora precisam ser um inteiro positivo')
+if (!Number.isInteger(opcoes.instancias)) throw new InvariantException('as instâncias da cota por hora precisam ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o que não é pedido de cota válido
falha: rejects.toBeInstanceOf(InvariantException)
-if (!Number.isInteger(pontos) || pontos < 1) throw new InvariantException('pontos da cota precisam ser um inteiro positivo')
+if (pontos < 1) throw new InvariantException('pontos da cota precisam ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o que não é pedido de cota válido
falha: rejects.toBeInstanceOf(InvariantException)
-if (!Number.isInteger(pontos) || pontos < 1) throw new InvariantException('pontos da cota precisam ser um inteiro positivo')
+if (!Number.isInteger(pontos)) throw new InvariantException('pontos da cota precisam ser um inteiro positivo')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o script que o Redis ainda não conhece
falha: rejects.toBeInstanceOf(InvariantException)
-if (!Array.isArray(resposta) || resposta.length !== 3) throw new InvariantException('o script da cota por hora devolveu resposta inesperada')
+if (!Array.isArray(resposta)) throw new InvariantException('o script da cota por hora devolveu resposta inesperada')
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › dois lotes de 200 com 300
-return concedido === 1 ? { resultado: 'concedido', gasto: { dono, pontos, janela, origem: 'redis' } } : { resultado: 'recusado', msAteLiberar }
+return true ? { resultado: 'concedido', gasto: { dono, pontos, janela, origem: 'redis' } } : { resultado: 'recusado', msAteLiberar }
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o script que o Redis ainda não conhece
falha: rejects.toBeInstanceOf(InvariantException)
-if (erro instanceof InvariantException) throw erro
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › Redis de fila fora
-if (gasto.origem === 'memoria') return this.devolverAoSeguro(gasto)
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › cota esgotada, relógio falso
-return this.opcoes.relogio === undefined ? -1 : this.opcoes.relogio.agora().getTime()
+return -1
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › Redis de fila fora
-return this.opcoes.relogio === undefined ? Date.now() : this.opcoes.relogio.agora().getTime()
+return Date.now()
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › Redis de fila fora
-if (estado === undefined || agora - estado.inicio >= MS_DA_JANELA_DA_COTA) {
+if (estado === undefined || false) {
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › Redis de fila fora
-if (estado.usados + pontos > teto) return { resultado: 'recusado', msAteLiberar: estado.inicio + MS_DA_JANELA_DA_COTA - agora }
+if (estado.usados > teto) return { resultado: 'recusado', msAteLiberar: estado.inicio + MS_DA_JANELA_DA_COTA - agora }
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › Redis de fila fora
falha: toBe(false)
-if (estado === undefined || estado.inicio !== gasto.janela) return false
+if (estado === undefined) return false
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o script que o Redis ainda não conhece
-if (!(erro instanceof Error) || !erro.message.startsWith('NOSCRIPT')) throw erro
+throw erro
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › o script que o Redis ainda não conhece
-if (!(erro instanceof Error) || !erro.message.startsWith('NOSCRIPT')) throw erro
+if (!(erro instanceof Error)) throw erro
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › dois lotes de 200 com 300
-if usados + pontos > teto then
+if usados > teto then
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › cota esgotada, relógio falso
-if inicio < 0 or agora - inicio >= ${MS_DA_JANELA_DA_COTA} then
+if inicio < 0 or false and agora - inicio >= ${MS_DA_JANELA_DA_COTA} then
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › devolver tira os pontos
falha: toBe(false)
-if inicio ~= janela then
+if false then
```

```mutacao
arquivo: packages/core/src/rate-limit/cota-por-hora.ts
teste: apps/api/test/convites-enviar.int.test.ts › dois lotes de 200 com 300
-if agora < 0 then
+if false then
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › "Enviar" sem seleção exclui
-destinoCifrado: envio.cifra.cifrar(Buffer.from(email, 'utf8'), conviteId).cifrado,
+destinoCifrado: envio.cifra.cifrar(Buffer.from(token, 'utf8'), conviteId).cifrado,
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/test/convites-enviar.int.test.ts › a API montada com 3 instâncias
-ProfessoresModule.forRoot({ chaveDoToken: config.email.chaveDoToken, instancias: config.limite.instancias, relogio: opcoes.relogioDosConvites }),
+ProfessoresModule.forRoot({ chaveDoToken: config.email.chaveDoToken, instancias: 1, relogio: opcoes.relogioDosConvites }),
```

```mutacao
arquivo: apps/api/src/professores/professores.module.ts
teste: apps/api/test/convites-enviar.int.test.ts › a API montada com 3 instâncias
-return new CotaPorHora(cliente, { porHora: CONVITES_POR_HORA_POR_ESCOLA, instancias, relogio, aoUsarOSeguro: avisar })
+return new CotaPorHora(cliente, { porHora: CONVITES_POR_HORA_POR_ESCOLA, instancias: 1, relogio, aoUsarOSeguro: avisar })
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª); privacy-guardian (1ª, item 3) | `cota-por-hora.ts`: o mapa `#seguro` nunca apaga as entradas de janela vencida; limpar ao consultar | `TODO.md`. A entrada é o id da escola e dois números, até dez escolas (D25), e a limpeza não muda nada que um teste veja: a cláusula não teria mutação vermelha, que a ordem exige de toda cláusula nova |
| tenancy-guardian (1ª) | `professoresParaEnvio` repete a lógica de "último convite" de `ProfessoresRepository.pagina`; extrair uma peça só | `TODO.md`. Refatoração que mexe em duas consultas com escopo duplo, fora de poucas linhas |
| privacy-guardian (1ª, item 1) | Arquivo do titular (D85): levar `convite.enviado` na lista por alvo e citar o provedor de e-mail na lista de compartilhamento | Tarefa 11.0 (`11_task.md`, o arquivo do titular) |
| privacy-guardian (1ª, item 2); test-engineer (1ª) | Capturar o log da API nos caminhos do 429, da transação desfeita e do seguro em memória; teste do aviso `convites.cota_no_seguro_em_memoria` | `TODO.md`. A linha nova não traz escola nem pessoa, e a regra 20 item 9 já tem a checagem `guardas/log-sem-dado-pessoal` |
| revisor-geral (1ª, item 2) | `envio` com `.default(null)` no contrato aceita a falta do campo; deixar obrigatório | Tarefa 4.0 (`4_task.md`), que ajusta os mocks de e2e da tela. Mudar o contrato agora mexe em `packages/shared` e em fixtures de `apps/web` |
| revisor-geral (1ª, item 4); infra-guardian (1ª, item 2) | A cota é consumida no Redis dentro da transação, com a trava da escola presa; consumir antes de abrir a transação ou prazo curto para o `EVALSHA` | `TODO.md`. Muda a ordem do consumo e do rollback da cota, comportamento provado pelos casos de devolução |
| infra-guardian (1ª, item 1) | Cerca de 6 idas ao banco por convite, até 1.800 numa transação com o lote de 300; medir contra os 2 s e gravar em lote | `TODO.md`. Medição e insert em lote, fora de poucas linhas; o caso de 40 professores (docs/infra.md 3.5) é o que a tarefa prova |
| infra-guardian (1ª, item 3) | Clique duplo no "Enviar" gasta a cota em dobro; chave de idempotência ou desabilitar o botão | Tarefa 4.0 (o botão desabilitado); a idempotência no pedido em `TODO.md` |
| infra-guardian (1ª, item 4) | Contador `convites_cota_total{resultado=…}` | `TODO.md` |
| infra-guardian (1ª, item 5) | Índice parcial `(escola_id) where papel = 'professor'` em `usuario` | `TODO.md`. Migration nova; a varredura de cerca de 1.000 linhas é a que a A1 já fazia |
| conformidade-reviewer (1ª, item 1) | Na tela, `envio` e estado do convite só como informação de entrega, sem contagem, ordem ou destaque de quem não aceitou (D64) | Tarefa 4.0 (`4_task.md`) |
| conformidade-reviewer (1ª, item 2) | Texto do e-mail e da tela sem apresentar o convite em nome de uma pessoa nem com chamada que induza o uso (D58, D59) | Tarefa 4.0 (`4_task.md`) |
| test-engineer (1ª) | Teste [P] de "Enviar" e "Copiar link" ao mesmo tempo | `TODO.md`. Caso paralelo novo, fora de poucas linhas |
| privacy-guardian (2ª); infra-guardian (2ª) | No caso das 3 instâncias com o Redis de fila fora, conferir as chaves de todas as linhas do aviso `convites.cota_no_seguro_em_memoria`, e não só a primeira; conferir também que `escolaId` e `usuarioId` são UUIDs | `TODO.md`. Reforço de um teste que já prova as chaves exatas da primeira linha; a linha do aviso é limitada a uma a cada 30 s e só leva os ids do contexto |
| infra-guardian (2ª) | No mesmo caso, os 101 professores são semeados um por vez; semear em lote para a suíte não ficar lenta | `TODO.md`. Custo de tempo da suíte, sem efeito na regra provada |
| infra-guardian (2ª) | `convite-de-professor.service.ts`: o `.filter` que tira o `undefined` depende da dedução do TypeScript; declarar o tipo guarda (`(p): p is {...} => p !== undefined`) | `TODO.md`. O `typecheck` do portão passou e o tipo hoje sai certo; é proteção contra troca de compilador |
| revisor-geral (2ª) | `convite-de-professor.service.ts`: o parâmetro de `.filter((pedido) => …)` esconde o `pedido` de fora e dá nome errado ao item; trocar o nome | `TODO.md`. Nome de variável, sem efeito no comportamento |
| revisor-geral (2ª) | `quemEsperaOConvitePorEmail`: o ternário de três condições numa linha; retornos antecipados | `TODO.md`. Legibilidade; a extração do predicado já atendeu a recomendação da 1ª rodada |
| test-engineer (2ª) | Em `apps/worker/test/enviar-email.int.test.ts`, tirar o filtro `entidade_id = $2` e contar `convite.enviado` só por `escola_id`, para pegar um job que grave a ação com outro `entidadeId` | `TODO.md`. Endurece uma ausência já provada para o id do convite; a escola do caso é nova a cada vez |
| test-engineer (2ª) | Declarar em "Mutações" um bloco para o endereço de outro professor do lote (`email` do vizinho em `entram`) | `TODO.md`. O teste de `destinoDoEnvio` já fica vermelho com essa troca porque os dois endereços sorteados são distintos; falta só o bloco que o portão prova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 23:23:07 | 2026-11-07 23:23:37 | `tenancy-guardian` | 2 | APROVADO | ab3a54f11807d856f |
| 2026-11-07 23:23:14 | 2026-11-07 23:23:47 | `privacy-guardian` | 2 | APROVADO | afeb7268bdfc83bae |
| 2026-11-07 23:23:42 | 2026-11-07 23:24:03 | `conformidade-reviewer` | 2 | APROVADO | ac9f706510be94dca |
| 2026-11-07 23:23:18 | 2026-11-07 23:24:05 | `infra-guardian` | 2 | APROVADO | a3c0e51065fbac04c |
| 2026-11-07 23:23:34 | 2026-11-07 23:24:10 | `revisor-geral` | 2 | APROVADO | a6fd3ea16df0e4259 |
| 2026-11-07 23:23:27 | 2026-11-07 23:24:39 | `test-engineer` | 2 | APROVADO | a0e163bac108f41f0 |
