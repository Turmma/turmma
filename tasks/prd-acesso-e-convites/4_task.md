# Tarefa 4.0 — Professores mostra o envio, e o diálogo "Enviar convites"

**Funcionalidade:** acesso-e-convites · **Depende de:** 3.0
**Subagentes obrigatórios:** `frontend-reviewer`, `test-engineer`
**Porte:** pequeno

## Objetivo

Na tela Professores, cada professor mostra o estado do envio em português, o diálogo "Enviar convites" diz quantos recebem e que os links anteriores caducam, "Reenviar" e "Copiar link" avisam o mesmo, e a lista se relê sozinha enquanto há envio.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (linha "Professores, envio") e "E2E (RF18)"
- `prd.md` RF11, RF18 e o caso "E-mail que volta"
- `.claude/rules/50`; `docs/interface.md`, a tela Professores (perto da linha 550): a Parte A dela muda nesta tarefa
- `apps/web/src/areas/coordenacao/professores/Professores.tsx` e `convite-de-professor.ts`

## Subtarefas

- [x] 4.1 — O rótulo de cada um dos cinco estados, com `aria-live="polite"`
- [x] 4.2 — O diálogo "Enviar convites" (contagem, aviso, 429) e o aviso no "Reenviar" e no "Copiar link"
- [x] 4.3 — A releitura de 5 s, só com a aba visível e linha `na_fila`/`enviando`, parando em 5 min
- [x] 4.4 — `docs/interface.md` (Parte A de Professores) e a busca dos textos novos em `e2e/`
- [x] 4.5 — O `docs/roteiro-da-demonstracao.md` (seção 2, passos 6 e 7) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 4.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/professores/Professores.tsx` | alterado |
| `apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx` | novo |
| `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts` | novo |
| `apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts` | novo |
| `apps/web/src/areas/coordenacao/professores/api/professores.ts` | alterado |
| `docs/interface.md` | alterado |
| `e2e/professores-envio.spec.ts` | novo |
| `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx` | alterado |
| `apps/web/src/areas/coordenacao/professores/Professores.test.tsx` | alterado |
| `apps/web/src/areas/coordenacao/professores/api/professores.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/professores/professores-da-escola.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts` | alterado |
| `packages/shared/src/professores/professores.ts` | alterado |
| `packages/shared/src/professores/professores.test.ts` | alterado |
| `apps/api/src/professores/professores.repository.ts` | alterado |
| `apps/api/src/professores/professores.service.ts` | alterado |
| `apps/api/test/convites-enviar.int.test.ts` | alterado |
| `apps/api/test/professores.int.test.ts` | alterado |
| `e2e/support/seed.ts` | alterado |
| `e2e/professores.spec.ts` | alterado |
| `docs/roteiro-da-demonstracao.md` | alterado |
| `tasks/prd-acesso-e-convites/techspec.md` e `cenarios.md` | alterados pelo Arquiteto (a divergência abaixo) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| releitura com aba visível e linha em envio | unidade | a cada 5 s | `envio-do-convite.test.ts` › com a aba visível e a linha em envio, relê a cada 5 s |
| aba oculta, ou nenhuma linha em envio | unidade | zero leituras | `envio-do-convite.test.ts` › com a aba oculta, zero leituras; sem nenhuma linha em envio, zero leituras |
| depois de 5 min (relógio falso) | unidade | para | `envio-do-convite.test.ts` › 5 minutos depois do começo, para de vez |
| e-mail pelo Mailpit | e2e | o professor recebe e aceita | `e2e/professores-envio.spec.ts` › o diálogo diz quantos recebem… o e-mail chega só a quem esperava; o professor abre o link do e-mail, cria a senha e aceita |
| diálogo "Enviar convites" | e2e | quantos recebem, e que os links anteriores caducam | `e2e/professores-envio.spec.ts` › o diálogo diz quantos recebem e que os links anteriores caducam… |
| aviso do "Reenviar" | e2e | o link anterior caduca | `e2e/professores-envio.spec.ts` › o aviso do "Reenviar" e o do "Copiar link" dizem que o link anterior caduca… |
| aviso do "Copiar link" | e2e | o link anterior caduca | `e2e/professores-envio.spec.ts` › o aviso do "Reenviar" e o do "Copiar link" dizem que o link anterior caduca… |
| `na_fila` e `enviando` | e2e | "Enviando" | `e2e/professores-envio.spec.ts` › na_fila e enviando dizem "Enviando"… |
| `enviado` | e2e | "Enviado em 12/11 às 14:05" | `e2e/professores-envio.spec.ts` › na_fila e enviando dizem "Enviando"; enviado diz a hora da escola… |
| `falhou` | e2e | o texto de "Telas", sem culpar o professor | `e2e/professores-envio.spec.ts` › na_fila e enviando dizem "Enviando"; … falhou não culpa o professor… |
| `cancelado` | e2e | vale o estado do convite | `e2e/professores-envio.spec.ts` › …; cancelado e o convite copiado não dizem nada |
| mudança de estado | e2e | `aria-live="polite"` | `e2e/professores-envio.spec.ts` › a mudança de estado vem pela releitura de 5 s, na mesma região `aria-live="polite"`… |
| estados: lista carregando, erro de rede, 429 | e2e | o texto e o foco depois da ação | `e2e/professores-envio.spec.ts` › a lista carregando, o erro de rede e o 429 do envio dizem o texto e o foco… |
| recomeço: 2ª coordenadora na mesma aba | e2e | nada da anterior | `e2e/professores.spec.ts` › segunda pessoa: a coordenação de B entra na aba da de A… (o caso que já fazia a troca de pessoa ganhou a hora do envio de A e a afirmação de que a de B não a vê) |
| recomeço: abrir o diálogo de novo | e2e | contagem atual | `e2e/professores-envio.spec.ts` › abrir o diálogo de novo conta quem espera agora… |
| recomeço: leitura atrasada depois de "Reenviar" (`page.route`) | e2e | não volta o rótulo velho | `e2e/professores-envio.spec.ts` › a leitura atrasada de antes do "Reenviar" não devolve o rótulo velho à linha |
| recomeço: 429 com o diálogo aberto | e2e | o aviso sai na nova tentativa | `e2e/professores-envio.spec.ts` › a lista carregando, o erro de rede e o 429 do envio… a nova tentativa apaga o aviso |
| 360 px | e2e | sem rolagem horizontal; 44 px nas ações principais, 24 px no resto | `e2e/professores-envio.spec.ts` › a 360 px não rola de lado; as ações principais têm 44 px e o resto 24 px… |
| 1366 × 768 | e2e | cabe sem a página rolar (`paginaNaoRola`) | `e2e/professores-envio.spec.ts` › com envio em todas as linhas, a página cabe… |
| `enviadoEm` na lista (divergência abaixo) | integração | a hora do job, só no `enviado`; nula nos outros quatro estados e no copiado; a lista da escola A não traz a hora da B | `apps/api/test/convites-enviar.int.test.ts` › 4.0: `enviadoEm` é a hora que o job gravou… |
| `enviadoEm` no contrato | unidade | ISO ou `null`; texto que não é data não passa | `packages/shared/src/professores/professores.test.ts` › a hora do envio (4.0) é uma data ISO ou `null`… |
| a tela: rótulo, diálogo, "Reenviar", releitura | componente | o rótulo e o `aria-live` de cada linha; a contagem, o 429 e o clique duplo do diálogo; o "Reenviar" do painel; a fiação da releitura | `Professores.test.tsx` › o envio do convite por e-mail (acesso-e-convites, 4.0; RF11) |
| a lista relida para zero pendentes com o diálogo aberto | componente | nenhum pedido sai, o texto diz que ninguém espera, só sobra "Fechar"; com o pedido no ar a tela segue como está | `Professores.test.tsx` › a lista relida para zero pendentes…; com o pedido no ar e a lista relida para zero pendentes… |
| o servidor devolve outra contagem; o 429 ainda na tela e o diálogo aberto de novo | componente | vale a do servidor; o aviso não volta | `Professores.test.tsx` › o diálogo diz 2 professores e o servidor devolve outra contagem…; a cota da hora (429) ainda na tela… |
| a chamada do envio | unidade | a rota, o corpo com e sem lista, `gcTime: 0` e o recarregar | `api/professores.test.ts` › o envio do convite por e-mail (acesso-e-convites, 4.0) |

## Como testar

- Precedente: `e2e/professores.spec.ts:455` › "W14: o resumo antes de enviar, o link uma vez com "Link copiado"…" e o describe "W12 (Professores): a 360 px e só com teclado"
- Apoio: `paginaNaoRola` (`e2e/support/coordenacao.ts:97`), `horizontalOverflow`, `ALVO_DE_TOQUE_PRINCIPAL_PX` e `seriousViolations` (`e2e/support/checks.ts`), `criarEquipeComSenha` (`e2e/support/seed.ts:87`)
- O e-mail chega ao Mailpit (1.0): leia a API dele no e2e; não há precedente no repositório
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professores-envio.spec.ts`; `npx vitest run --project unidade apps/web/src/areas/coordenacao/professores/`
- Telas: `coordenacao`, `/professores` (`apps/web/src/paths.ts:83`); o diálogo por "Enviar convites"

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Enviando" e "Reenviar" já aparecem em `e2e/`? Rode os specs que os contam.

## Fora do escopo desta tarefa

A API (3.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `GET /v1/professores` não trazia a hora do envio, e a linha diz "Enviado em 12/11 às 14:05": a lista ganha `enviadoEm` (ISO, nulável, só com `envio = 'enviado'`, na hora do job, e a tela a mostra no fuso da escola) | desenho: triagem do Arquiteto, detalhe que não muda o desenho nem o critério; a 4.0 absorve o schema, o repository, o service e o teste de integração | `techspec.md` §4 (`GET /v1/professores`); `cenarios.md` RF11, cenário [I] |

### Ajustes de teste desta tarefa que não mudam o desenho

- `apps/api/test/convites-enviar.int.test.ts` (casos da 3.0): as asserções que dependiam da ordem das linhas pelo relógio de parede (que nesta máquina recua) passaram a achar cada convite pelo canal, pelo id que já tinha ou pelo estado. É correção de teste instável, fora do objetivo da 4.0, e vai no relato ao Orquestrador. O caso dos dois "Enviar" em paralelo ganhou `toHaveLength(2)` nos convites por e-mail, para um terceiro, em outro estado, não passar pelas buscas por estado.
- `e2e/professores.spec.ts` › "segunda pessoa": o `page.goto` do endereço do professor de A virou `pushState` mais `popstate` (a recarga custava uns 12 s e levava o caso a passar de metade do prazo no portão), e o login de B passou a configurar o segundo fator pela API. A carga a frio de `?professor=<id de outra escola>` continua provada, com `page.goto`, em `e2e/professores.spec.ts` › "o painel do professor › aberto pelo endereço, sem botão que o tenha aberto … o id de outra escola não abre nada nem diz que existe".

## Mutações

--faltando: 0 linhas (68 blocos, 0 motivos). Cada bloco foi aplicado e rodado antes do pedido (o mesmo `conferirMutacoesDoDocumento` do portão, sobre o `comandoDoTeste`): todos ficaram vermelhos num caso que rodou e falhou. Três ajustes saíram da primeira corrida: o nome de caso com parênteses (`(429)`) é lido como expressão regular e não achava caso nenhum; o `if (true)` do repository só cai no caso em que o professor tem dois convites (`depois de o envio falhar`); e o `enviado` sem hora ganhou caso no teste de integração.

Termos que o `--faltando` conta como alcançados por um bloco da mesma linha, e que nenhum teste distingue:

- `api/professores.ts` › `usuarioIds === undefined ? {} : { usuarioIds }` e `aoTerminar === undefined ? {} : {...}`: o ramo `{}` e `{ usuarioIds: undefined }` / `{ onSettled: undefined }` fazem a mesma coisa (o JSON descarta o `undefined`, e o `mutationOptions` não chama um `onSettled` indefinido); o ramo existe por `exactOptionalPropertyTypes`. O bloco troca o ramo `{}` por outro valor (`{ usuarioIds: [] }`) e tira o `onSettled`.
- `Professores.tsx` › `alvo !== undefined` em `aberta?.tipo === 'reenviar' && alvo !== undefined`: estreita o tipo para ler `alvo.nome`, como nas quatro linhas vizinhas (`cadastrar`, `refazer`, `revogar`, `acrescentar`); `aberta` com `reenviar` só nasce do botão do painel, que só existe com o `alvo` à vista. O bloco troca a condição inteira por `false`.
- `Professores.tsx` › `dados !== undefined &&` em `haEnvio`: o bloco `dados!.itens` prova o termo (a tela quebra no carregando).

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › o enviado sem hora
-    enviado: professor.enviadoEm === null ? 'Enviado' : `Enviado em ${horaDoEnvio(professor.enviadoEm)}`,
+    enviado: professor.enviadoEm === undefined ? 'Enviado' : `Enviado em ${horaDoEnvio(professor.enviadoEm)}`,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › cada um dos cinco estados
-    cancelado: '',
+    cancelado: TEXTO_DO_ENVIO_EM_ANDAMENTO,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › cada um dos cinco estados
-    na_fila: TEXTO_DO_ENVIO_EM_ANDAMENTO,
+    na_fila: '',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › cada um dos cinco estados
-    enviando: TEXTO_DO_ENVIO_EM_ANDAMENTO,
+    enviando: '',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › cada um dos cinco estados
-    falhou: TEXTO_DO_ENVIO_QUE_FALHOU,
+    falhou: '',
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › o convite copiado, sem envio
-  return professor.envio === null ? '' : porEstado[professor.envio]
+  return professor.envio === null ? 'Enviando' : porEstado[professor.envio]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › a hora é a da parede da escola
-const HORA_DO_ENVIO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO_DA_ESCOLA })
+const HORA_DO_ENVIO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › a hora é a da parede da escola
-const HORA_DO_ENVIO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO_DA_ESCOLA })
+const HORA_DO_ENVIO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h24', timeZone: FUSO_DA_ESCOLA })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › só espera o convite quem
-  return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[professor.estado] === 'refazer'
+  return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[professor.estado] !== 'refazer'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › a lista do lote tem só quem espera
-  return professores.filter(esperaOConvite)
+  return [...professores]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › é de quem espera o convite e já teve envio
-  return esperaOConvite(professor) && professor.envio !== null
+  return professor.envio !== null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › é de quem espera o convite e já teve envio
-  return esperaOConvite(professor) && professor.envio !== null
+  return esperaOConvite(professor)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › há envio em aberto só com
-  return professores.some((professor) => professor.envio === 'na_fila' || professor.envio === 'enviando')
+  return professores.some((professor) => professor.envio === 'enviando')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › há envio em aberto só com
-  return professores.some((professor) => professor.envio === 'na_fila' || professor.envio === 'enviando')
+  return professores.some((professor) => professor.envio === 'na_fila')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › há envio em aberto só com
-  return professores.some((professor) => professor.envio === 'na_fila' || professor.envio === 'enviando')
+  return professores.every((professor) => professor.envio === 'na_fila' || professor.envio === 'enviando')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › o lote diz quantos recebem
-  return `Enviar o convite por e-mail a ${quantidade === 1 ? '1 professor' : `${String(quantidade)} professores`}. Cada um recebe um e-mail com o link para criar a senha.`
+  return `Enviar o convite por e-mail a ${quantidade === 0 ? '1 professor' : `${String(quantidade)} professores`}. Cada um recebe um e-mail com o link para criar a senha.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › depois de enfileirar
-  if (resposta.quantidade === 0) return 'Nenhum convite entrou na fila: a lista mudou. Confira a situação de cada professor.'
+  if (resposta.quantidade === 99) return 'Nenhum convite entrou na fila: a lista mudou. Confira a situação de cada professor.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › depois de enfileirar
-  const fila = resposta.quantidade === 1 ? '1 convite entrou na fila' : `${String(resposta.quantidade)} convites entraram na fila`
+  const fila = resposta.quantidade === 99 ? '1 convite entrou na fila' : `${String(resposta.quantidade)} convites entraram na fila`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › o 429 da cota diz
-  return errorText(erro, { [ErrorCode.LIMITE_EXCEDIDO]: 'Muitos convites enviados em pouco tempo. Espere alguns minutos e envie de novo.' })
+  return errorText(erro, {})
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › 5 minutos depois do começo
-    if (agora() - inicio >= PRAZO_DA_RELEITURA_MS) {
+    if (agora() - inicio > PRAZO_DA_RELEITURA_MS) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › com a aba oculta, zero leituras
falha: expect(reler).toHaveBeenCalledTimes(0)
-    if (visivel() && haEnvio()) reler()
+    if (haEnvio()) reler()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › sem nenhuma linha em envio, zero leituras
falha: expect(reler).toHaveBeenCalledTimes(0)
-    if (visivel() && haEnvio()) reler()
+    if (visivel()) reler()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts › quem a para
-  return () => clearInterval(temporizador)
+  return () => undefined
```

```mutacao
arquivo: apps/api/src/professores/professores.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › 4.0: `enviadoEm` é a hora que o job gravou
-      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.envio === 'enviado' ? (lido.enviadoEm?.toISOString() ?? null) : null })),
+      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.enviadoEm?.toISOString() ?? null })),
```

```mutacao
arquivo: apps/api/src/professores/professores.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › 4.0: `enviadoEm` é a hora que o job gravou
-      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.envio === 'enviado' ? (lido.enviadoEm?.toISOString() ?? null) : null })),
+      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.envio === 'enviado' ? null : null })),
```

```mutacao
arquivo: apps/api/src/professores/professores.service.ts
teste: apps/api/test/convites-enviar.int.test.ts › 4.0: `enviadoEm` é a hora que o job gravou
-      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.envio === 'enviado' ? (lido.enviadoEm?.toISOString() ?? null) : null })),
+      itens: pagina.itens.map((lido) => ({ usuarioId: lido.usuarioId, nome: lido.nome, estado: estadoDoProfessor(lido), envio: lido.envio, enviadoEm: lido.envio === 'enviado' ? lido.enviadoEm!.toISOString() : null })),
```

```mutacao
arquivo: apps/api/src/professores/professores.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › 4.0: `enviadoEm` é a hora que o job gravou
-    for (const { usuarioId, envio, enviadoEm, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, { convite: lido, envio, enviadoEm })
+    for (const { usuarioId, envio, enviadoEm, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, { convite: lido, envio, enviadoEm: null })
```

```mutacao
arquivo: apps/api/src/professores/professores.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › depois de o envio falhar
-    for (const { usuarioId, envio, enviadoEm, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, { convite: lido, envio, enviadoEm })
+    for (const { usuarioId, envio, enviadoEm, ...lido } of convites) if (true) ultimo.set(usuarioId, { convite: lido, envio, enviadoEm })
```

```mutacao
arquivo: apps/api/src/professores/professores.repository.ts
teste: apps/api/test/convites-enviar.int.test.ts › 4.0: `enviadoEm` é a hora que o job gravou
-      return { usuarioId, nome, desativadoEm, agora, ultimoConvite: doUltimo?.convite, envio: doUltimo?.envio ?? null, enviadoEm: doUltimo?.enviadoEm ?? null }
+      return { usuarioId, nome, desativadoEm, agora, ultimoConvite: doUltimo?.convite, envio: doUltimo?.envio ?? null, enviadoEm: null }
```

```mutacao
arquivo: apps/api/src/professores/professores.repository.ts
teste: apps/api/test/professores.int.test.ts › E8: cadastrar devolve o link uma vez
-      return { usuarioId, nome, desativadoEm, agora, ultimoConvite: doUltimo?.convite, envio: doUltimo?.envio ?? null, enviadoEm: doUltimo?.enviadoEm ?? null }
+      return { usuarioId, nome, desativadoEm, agora, ultimoConvite: doUltimo?.convite, envio: doUltimo?.envio ?? 'falhou', enviadoEm: doUltimo?.enviadoEm ?? null }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/api/professores.ts
teste: apps/web/src/areas/coordenacao/professores/api/professores.test.ts › vai à rota do envio
-  return authedRequest(`${CAMINHO_DOS_PROFESSORES}/convites/enviar`, enviarConvitesResponseSchema, {
+  return authedRequest(`${CAMINHO_DOS_PROFESSORES}/convites/enviar-todos`, enviarConvitesResponseSchema, {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/api/professores.ts
teste: apps/web/src/areas/coordenacao/professores/api/professores.test.ts › vai à rota do envio
-    corpo: usuarioIds === undefined ? {} : { usuarioIds },
+    corpo: usuarioIds === undefined ? { usuarioIds: [] } : { usuarioIds },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › "Enviar convites" diz quantos recebem
-  const feito = pedido.isSuccess ? textoDoEnvioFeito(pedido.data) : undefined
+  const feito = undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a cota da hora
-        {pedido.isError && <ErrorAlert texto={falhaDoEnvioDeConvites(pedido.error)} />}
+        {false && <ErrorAlert texto={falhaDoEnvioDeConvites(pedido.error)} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › "Enviar convites" diz quantos recebem
falha: queryByRole('button', { name: 'Enviar convites' })).toBeNull()
-          {etapa === 'pergunta' && (
+          {true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › com o pedido no ar
-              {pedido.isPending ? rotuloEmAndamento : rotuloDaAcao}
+              {rotuloDaAcao}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › "Enviar convites" diz quantos recebem
-            {etapa === 'pergunta' ? 'Cancelar' : 'Fechar'}
+            {'Cancelar'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › com o pedido no ar
-          {pedido.isPending ? rotuloEmAndamento : ''}
+          {''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › sem nenhuma linha em envio
-  const haEnvio = dados !== undefined && haEnvioEmAberto(dados.itens)
+  const haEnvio = dados !== undefined && true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › sem nenhuma linha em envio
-  const haEnvio = dados !== undefined && haEnvioEmAberto(dados.itens)
+  const haEnvio = haEnvioEmAberto(dados!.itens)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › sem nenhuma linha em envio
-    if (!haEnvio) return undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a aba oculta não conta como visível
-      visivel: () => document.visibilityState === 'visible',
+      visivel: () => true,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › cada releitura lê a lista de novo
-      reler: () => void cliente.refetchQueries({ queryKey: professoresQueryOptions.queryKey, exact: true }, { cancelRefetch: false }),
+      reler: () => void cliente.refetchQueries({ queryKey: professoresQueryOptions.queryKey, exact: true }, { cancelRefetch: true }),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › acompanha a lista de agora
-      haEnvio: () => haEnvioAgora.current,
+      haEnvio: () => true,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › recomeça a releitura, mesmo com a lista
-  }, [cliente, haEnvio, rodadaDoEnvio])
+  }, [cliente, haEnvio])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › cada linha tem a região
-          <span aria-live="polite" className={`mt-1 t-apoio break-words empty:mt-0 ${professor.envio === 'falhou' ? 'text-erro' : 'text-sutil'}`}>
+          <span aria-live="polite" className={`mt-1 t-apoio break-words empty:mt-0 ${professor.envio === 'falhou' ? 'text-sutil' : 'text-sutil'}`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › sem ninguém esperando o convite
-              {quemEspera.length > 0 && (
+              {true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › sem ninguém esperando o convite
-  const quemEspera = dados === undefined ? [] : professoresQueEsperamOConvite(dados.itens)
+  const quemEspera = false ? [] : professoresQueEsperamOConvite(dados.itens)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › manda os ids de quem espera
-      {aberta?.tipo === 'enviar' && (
+      {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › abre o diálogo com o nome
-      {aberta?.tipo === 'reenviar' && alvo !== undefined && (
+      {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o painel de quem espera o convite e já teve envio
-            {reenviar && (
+            {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o painel de quem espera o convite e já teve envio
falha: queryByRole('button', { name: 'Reenviar' })).toBeNull()
-            {reenviar && (
+            {true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o painel de quem espera o convite e já teve envio
-          {envio !== '' && <p className={`break-words ${professor.envio === 'falhou' ? 'text-erro' : 'text-apoio'}`}>{envio}</p>}
+          {true && <p className={`break-words ${professor.envio === 'falhou' ? 'text-erro' : 'text-apoio'}`}>{envio}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o painel de quem espera o convite e já teve envio
-          {envio !== '' && <p className={`break-words ${professor.envio === 'falhou' ? 'text-erro' : 'text-apoio'}`}>{envio}</p>}
+          {envio !== '' && <p className={`break-words ${professor.envio === 'falhou' ? 'text-apoio' : 'text-apoio'}`}>{envio}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/api/professores.ts
teste: apps/web/src/areas/coordenacao/professores/api/professores.test.ts › o pedido sai do cache
    mutationFn: () => enviarConvites(usuarioIds),
    gcTime: 0,
-   ...(aoTerminar === undefined ? {} : { onSettled: aoTerminar }),
+   ...(aoTerminar === undefined ? {} : {}),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › cada linha tem a região
falha: .not.toContain('hidden')
-          <span aria-live="polite" className={`mt-1 t-apoio break-words empty:mt-0 ${professor.envio === 'falhou' ? 'text-erro' : 'text-sutil'}`}>
+          <span aria-live="polite" className={`mt-1 t-apoio break-words empty:hidden ${professor.envio === 'falhou' ? 'text-erro' : 'text-sutil'}`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a lista relida para zero pendentes
-          semDestinatario={quemEspera.length === 0}
+          semDestinatario={false}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a lista relida para zero pendentes
-  return semDestinatario && !pedidoNoAr ? 'sem_destinatario' : 'pergunta'
+  return 'pergunta'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › com o pedido no ar e a lista relida para zero
-  return semDestinatario && !pedidoNoAr ? 'sem_destinatario' : 'pergunta'
+  return semDestinatario ? 'sem_destinatario' : 'pergunta'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a lista relida para zero pendentes
-          {etapa === 'pergunta' && (
+          {feito === undefined && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a lista relida para zero pendentes
-            {etapa === 'pergunta' ? 'Cancelar' : 'Fechar'}
+            {feito === undefined ? 'Cancelar' : 'Fechar'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › com o pedido no ar o botão desliga
-            <Button onClick={() => enviar(undefined)} disabled={pedido.isPending}>
+            <Button onClick={() => enviar(undefined)}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › "Enviar convites" diz quantos recebem
-    definirRodadaDoEnvio((rodada) => rodada + 1)
-    return recarregar()
+    definirRodadaDoEnvio((rodada) => rodada + 1)
+    return Promise.resolve()
```

```mutacao
arquivo: packages/shared/src/professores/professores.ts
teste: packages/shared/src/professores/professores.test.ts › a hora do envio
-  enviadoEm: z.iso.datetime().nullable().default(null),
+  enviadoEm: z.string().nullable().default(null),
```

```mutacao
arquivo: packages/shared/src/professores/professores.ts
teste: packages/shared/src/professores/professores.test.ts › a hora do envio
-  enviadoEm: z.iso.datetime().nullable().default(null),
+  enviadoEm: z.iso.datetime().nullable(),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a lista relida para zero pendentes
-  if (etapa === 'sem_destinatario') return <p className="break-words text-tinta">{TEXTO_SEM_QUEM_ESPERE_O_CONVITE}</p>
+  if (false) return <p className="break-words text-tinta">{TEXTO_SEM_QUEM_ESPERE_O_CONVITE}</p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o diálogo diz 2 professores e o servidor devolve outra contagem
-  if (feito !== undefined) return <p className="break-words text-tinta">{feito}</p>
+  if (feito === undefined) return <p className="break-words text-tinta">{feito}</p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › "Enviar convites" diz quantos recebem
falha: queryByRole('button', { name: 'Enviar convites' })).toBeNull()
-  if (feito !== undefined) return 'feito'
+  if (feito !== undefined) return 'pergunta'
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | O `eq(convite.escolaId, escolaId)` em `professores.repository.ts:45` não tem teste próprio: é defesa em profundidade, e nenhum teste quebra se só essa cláusula sair. | `TODO.md`. Exige montar convite de outra escola apontando para o `usuario_id` de um professor da A, e o revisor mesmo diz "se o banco aceitar essa combinação"; não cabe em poucas linhas sem essa conferência. |
| tenancy-guardian (1ª) | `definirOEnvioDoConvite` (`e2e/support/seed.ts`) atualiza só por `usuario_id`, sem a escola. | `TODO.md`. É ajudante de teste, não roda em produção; filtrar por escola muda a assinatura e os chamadores. |
| frontend-reviewer (1ª) | Foto do diálogo e dos estados de envio no celular (alinhamento do rótulo `items-start` com o selo), que a vitrine não mostra. | `TODO.md`: a vitrine não monta professor esperando convite (nenhum dos dois colégios sintéticos tem um). A tela com envio fica para o Validador fotografar com um professor pendente. |
| privacy-guardian (1ª) | O arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts`) não lê a tabela `convite`; vem da 3.0. Ligar ao pedido do titular, ou escrever em `docs/lgpd.md` por que o convite fica de fora. | `TODO.md`, e a Mesa avisa o Orquestrador no relato: é da 3.0, em arquivo que a 4.0 não toca, e é assunto da regra 20 (item 19) que cabe ao Arquiteto decidir. |
| privacy-guardian (1ª), revisor-geral (1ª) | `FUSO_DA_ESCOLA` é a terceira cópia de `'America/Sao_Paulo'` no `apps/web` (`envio-do-convite.ts:11`; as outras em `semana.ts:12` e `textos-dos-pedidos.ts:203`); o ideal é uma constante única em `packages/shared`, e a premissa de que a tela não lê o fuso por escola. | `TODO.md`. Mexe em arquivos fora da tarefa (`semana.ts`, `textos-dos-pedidos.ts`) e em `packages/shared`. |
| infra-guardian (1ª) | A releitura usa `lerPaginas` e lê a lista inteira (até 10 páginas de 100): escola com mais de 100 professores e duas abas chega perto de 120 por minuto por usuário. | `TODO.md`: releitura só de quem está em envio, ou intervalo que cresça com as páginas, para a rede pública grande. Muda o contrato da releitura. |
| revisor-geral (1ª) | Com `dados.completa === false`, a contagem e os ids do lote cobrem só quem foi carregado, e o diálogo não avisa. | `TODO.md`. Muda comportamento da tela (um aviso novo, com texto novo) e só acontece acima de 1000 professores, o teto de 10 páginas de 100. |
| test-engineer (1ª) | O e2e "o professor abre o link do e-mail, cria a senha e aceita" para no aviso de `/entrar`; poderia conferir na lista da coordenação que o professor saiu de "pendente". | `TODO.md`. Muda o desfecho de um e2e que o portão já provou verde, com uma segunda sessão da coordenação dentro do caso; não é mudança de poucas linhas. |
| test-engineer (1ª) | A releitura em tempo real do primeiro e2e (`e2e/professores-envio.spec.ts:164`) espera a entrega do worker mais a releitura de 5 s no relógio de parede, perto da metade do prazo; instalar `page.clock` e usar `runFor` tira a margem. | `TODO.md`. O portão mede a duração do caso e o deixou passar; trocar o relógio de um caso que depende do worker real é mudança de desenho do teste, e o ganho ainda precisa ser medido. |
| revisor-geral (2ª) | O texto novo "Ninguém espera o convite agora: a lista mudou. Confira a situação de cada professor." é visto pela pessoa e não está em `cenarios.md` (RF11) nem em `docs/interface.md`; registrá-lo lá, junto do "Nenhum convite entrou na fila". | `TODO.md`. É documento, e quem confere texto de tela contra o PRD é o Validador. |
| revisor-geral (2ª) | Em `TextoDaEtapa` (`DialogoDeEnviarConvites.tsx`), o segundo ramo testa `feito !== undefined` em vez de `etapa === 'feito'`; usar a etapa nos três ramos deixa uma só fonte de verdade. | `TODO.md`. Acabamento de código sem mudança de comportamento, e a rodada que aplicasse caducaria os sete revisores por isso. |
| revisor-geral (2ª) | O comentário novo em `e2e/professores-envio.spec.ts` (linhas 416-417) descreve o `clock.install()`; melhor dizer só o que garante a prova. | `TODO.md`. É comentário, e o texto atual não é falso. |
| frontend-reviewer (2ª) | Um comentário de uma linha em `DialogoDeEnviarConvites.tsx` dizendo que a etapa `sem_destinatario` não alcança o "Reenviar", que não recebe `semDestinatario`. | `TODO.md`. É comentário, e o comportamento está certo. |
| frontend-reviewer (2ª), conformidade-reviewer (2ª) | Foto da vitrine com um professor esperando convite, para o botão, o diálogo e os textos de envio aparecerem a 360 px e a 1366 px. | Mesmo destino da linha igual da 1ª rodada: a vitrine não monta professor esperando convite (`TODO.md`), e o Validador fotografa o diálogo com um professor pendente. Nenhum dos 7 revisores viu o diálogo em foto. |
| test-engineer (2ª) | `semDisplayNone` (`Professores.test.tsx:105`) confere o texto da classe e não o estilo calculado: pega a volta do `empty:hidden`, mas não um `display: none` por outra classe. | Sem ação: o revisor diz que no jsdom não há jeito barato. Fica para o Validador conferir na tela real. |
| test-engineer (2ª) | O bloco que cita "o diálogo diz 2 professores…" fica vermelho já na primeira asserção; um `falha: findByText(/^1 convite entrou na fila/)` deixaria o motivo explícito. | `TODO.md`. O bloco prova a cláusula; é só o texto do motivo. |
| test-engineer (2ª) | O caso do 429 "ainda na tela" não tem bloco próprio. | Sem ação: o revisor mesmo diz que está certo, porque o diff não traz cláusula nova para ele. |
| infra-guardian (2ª) | Se o envio falhar e a lista for relida para zero pendentes, o diálogo mostra o texto "ninguém espera" e o aviso de erro antigo juntos; esconder o `ErrorAlert` nesse estado. | `TODO.md`. Muda o comportamento da tela, e o revisor diz que não bloqueia: nenhum pedido sai e não há efeito na carga. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 12:43:27 | 2026-11-08 12:43:56 | `tenancy-guardian` | 1 | APROVADO | a5b4da3fbebbe5d9e |
| 2026-11-08 12:43:17 | 2026-11-08 12:44:02 | `frontend-reviewer` | 1 | APROVADO | a12e37cfc4435011a |
| 2026-11-08 12:43:34 | 2026-11-08 12:44:05 | `conformidade-reviewer` | 1 | APROVADO | a9d6fefbb1ad3b62e |
| 2026-11-08 12:43:31 | 2026-11-08 12:44:18 | `privacy-guardian` | 1 | APROVADO | a7792776db6901b92 |
| 2026-11-08 12:43:37 | 2026-11-08 12:44:31 | `infra-guardian` | 1 | APROVADO | ade3e09bc3b9e1c9e |
| 2026-11-08 12:43:24 | 2026-11-08 12:45:15 | `revisor-geral` | 1 | REPROVADO | af54b2c93c3783d28 |
| 2026-11-08 12:43:20 | 2026-11-08 12:46:32 | `test-engineer` | 1 | REPROVADO | a705229b20e1286f2 |
| 2026-11-08 13:11:46 | 2026-11-08 13:12:17 | `revisor-geral` | 2 | APROVADO | a247399e26163ff1d |
| 2026-11-08 13:12:12 | 2026-11-08 13:12:20 | `tenancy-guardian` | 2 | APROVADO | a2aef8231a06b8510 |
| 2026-11-08 13:12:03 | 2026-11-08 13:12:23 | `frontend-reviewer` | 2 | APROVADO | a61cc1d4147d60512 |
| 2026-11-08 13:12:18 | 2026-11-08 13:12:39 | `privacy-guardian` | 2 | APROVADO | a3bf7c9052316b793 |
| 2026-11-08 13:11:54 | 2026-11-08 13:12:45 | `test-engineer` | 2 | APROVADO | ae3765e5a79caea4d |
| 2026-11-08 13:12:26 | 2026-11-08 13:12:45 | `conformidade-reviewer` | 2 | APROVADO | a2b00997763084532 |
| 2026-11-08 13:12:35 | 2026-11-08 13:12:46 | `infra-guardian` | 2 | APROVADO | a7a1e48b782ac4e3f |
