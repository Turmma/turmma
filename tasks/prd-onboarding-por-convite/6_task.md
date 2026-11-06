# Tarefa 6.0 — A planilha de professores cadastra a equipe e desliga só o marcado

**Funcionalidade:** onboarding-por-convite · **Depende de:** 3.0, 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Planilha de professores (nome e e-mail, até 300 linhas): o job acha ou cria a conta no (1), cadastra `pendente` pelo
`convidar` da A1 e desliga pelo `desativar` só o marcado. O cadastrado aparece na lista com o convite para copiar.

## Contexto necessário

- `techspec.md` §5 "Planilha" (professor pelo `usuario` da escola, nunca pela `conta`), "O job" (1) e (3), "Gravar"
  ("Professores": quem é candidato), §6 (a cerca do `contaParaConvite`), §4 (o "Copiar link" faz o `convite/refazer`)
- `prd.md` RF6, RF4 (marca), RF16
- `cenarios.md` RF6; "Job e estados"; Corridas
- Código: `packages/core/src/estrutura/cadastro-de-professor.ts`; o motor da 4.0; o `desativar` da 3.0; `apps/api/src/professores/`

## Subtarefas

- [x] 6.1 — Tipo professores: classificação (e-mail repetido, inválido, nome vazio, teto de 300; candidato a desligar: só ausente `ativo` ou `aceito` do `estadoDoProfessor`), sem distinguir conta em outra escola
- [x] 6.2 — Passo (1): contas pelo `contaParaConvite`, transação curta cada, na ordem do e-mail; conta em `FOR SHARE` no (3), com o e-mail conferido; nulo: nova tentativa
- [x] 6.3 — Gravar: `convidar` da A1 com o token descartado; desligar o marcado pelo `desativar`, travando as turmas do `travarContraOGerarDoProfessor` antes dos pedidos; `NAO_ENCONTRADO` dele: `desatualizada`
- [x] 6.4 — Lista de Professores: o cadastrado pelo job aparece `pendente`; "Copiar link" pelo `convite/refazer`
- [x] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/professores.ts` | novo |
| `packages/core/src/importacao/motor.ts`, `index.ts` | alterado |
| `apps/api/src/professores/professores.service.ts`, `professores.repository.ts` | alterado |
| `apps/worker/test/gravar-planilha-professores.int.test.ts`, `apps/api/test/professores.int.test.ts` | novo; alterado |

## Testes que provam a regra

`A` é `apps/api/test/professores.int.test.ts` (o `describe` da planilha de professores); `W` é `apps/worker/test/gravar-planilha-professores.int.test.ts`; `U` é `packages/core/src/importacao/tipos/professores.test.ts`.

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Mesmo e-mail duas vezes: uma pessoa | integração | RF6 |  W › o mesmo e-mail duas vezes, em qualquer caixa, é uma pessoa; U › o mesmo e-mail duas vezes, em qualquer caixa |
| Conta de outra escola cliente ganha o segundo vínculo no aceite pelo link copiado (a F2c reescreve) | integração | RF6 |  A › RF6: o professor de uma conta de outra escola cliente ganha o segundo vínculo no aceite do link copiado |
| A prévia não distingue e-mail com conta na B de e-mail novo | integração | isolamento |  A › RF6, isolamento: a prévia não distingue o e-mail com conta na escola B |
| O `resumo` e a `planilha.gravada` também não distinguem | integração | isolamento |  W › o `resumo` e a `planilha.gravada` de e-mail com conta em outra escola cliente |
| [P] Duas escolas importam o mesmo professor: as duas `concluida`, uma `conta` | [P] | |  W › [P] duas escolas importam o mesmo professor ao mesmo tempo |
| [P] Duas escolas importam os mesmos professores em ordens opostas: as duas `concluida` | [P] | ordem do e-mail |  W › [P] duas escolas importam os mesmos professores em ordens opostas |
| 301 linhas: erro de teto; 300 entram | integração | |  A › 301 linhas: erro de teto na última; U › a 301ª linha é erro de teto |
| E-mail inválido ou nome vazio: erro na linha | integração | borda |  A › e-mail inválido, nome vazio e linha incompleta; U › aponta o primeiro erro de cada linha |
| Ausente na reimportação, sem marca: segue ativo | integração | RF4 |  W › ausente da planilha e sem marca |
| Ausente marcado: desligado pelo `desativar`, vínculos encerrados | integração | RF6 |  W › ausente e marcado |
| Ausente `pendente` marcado: `ENTRADA_INVALIDA`; `aceito` que não entrou: sai `desativado` | integração | RF4 |  A › RF4, candidato: só o ausente ativo é candidato; W › ausente que aceitou o convite; U › só o ausente `ativo` ou `aceito` é candidato |
| [P] Candidato desativado entre o (2) e o (3): `desatualizada`, sem escrita | [P] | |  W › [P] candidato desativado à mão entre o passo (2) e o (3); W › o `desativar` que não alcança o marcado; W › assinatura diferente antes do job |
| Desligado: o (3) trava as turmas de todos os vínculos dele antes dos pedidos (espião) | integração | ordem global |  W › o passo (3) trava as turmas de todos os vínculos dos desligados |
| [P] Duas escolas desligam o mesmo professor: as duas `concluida`, nenhuma requisição no ciclo | [P] | |  W › [P] duas escolas desligam o mesmo professor pela planilha |
| Cadastrado pelo job aparece `pendente` na lista | integração | |  A › o cadastrado pelo job aparece `pendente` na lista; W › o job cadastra cada professor |
| "Copiar link" do cadastrado passa pelo `convite/refazer` | integração | |  A › o cadastrado pelo job aparece `pendente` na lista (o `convite/refazer`) |
| [P] Expurgo de acesso entre o (1) e o (3): a nova tentativa refaz o (1); nenhum convite para conta sem e-mail | [P] | |  W › [P] o expurgo de acesso limpa a conta entre o passo (1) e o (3); W › a conta que o passo (1) achou é travada |
| Escola sem ano em curso: funciona | integração | ano |  A › escola sem ano em curso; W › escola sem ano em curso |
| Marca de um professor da B: `ENTRADA_INVALIDA` | integração | isolamento |  A › RF16, isolamento: a marca de um professor da escola B |
| Professor sobe a planilha: recusado | integração | permissão |  A › permissão: o professor não sobe a planilha de professores |
| [P] Cadastrar, refazer ou revogar o convite da escola em curso: o (3) espera a trava, estoura o `lock_timeout` e volta | [P] | trava do convite da escola |  W › a trava do convite da escola: com ela na mão de outra operação |
| Assinatura diferente antes do job: `desatualizada` no (2), sem chegar ao (3) | integração | |  W › assinatura diferente antes do job |
| Linhas ou marcas guardadas sem a forma do tipo, e motor sem o achar-ou-criar conta: falha definitiva ou de invariante | integração | |  W › falha definitiva: as linhas guardadas sem a forma do tipo; W › o motor sem o achar-ou-criar conta do worker |
| O último convite decide o estado; a conta com o e-mail em maiúsculas casa com a planilha em minúsculas | integração | borda |  W › o último convite decide o estado; W › a conta com o e-mail em maiúsculas |
| O `convidar` da planilha: professor ativo e convite em aberto devolvem `false`; `false` é diferença | integração | |  W › o `convidar` da planilha não muda o professor que já está ativo; W › o `convidar` da planilha recusa o professor que já tem convite em aberto; U › o `convidar` que não tinha o que convidar |

## Como testar

- Duas escolas e a mesma conta: `apps/api/test/convite.int.test.ts › concorrência: a mesma conta nova convidada por A e por B, aceitando os dois ao mesmo tempo com senhas diferentes, …`
- Refazer: `apps/api/test/professores.int.test.ts › E8, vencido e aceito: refazer o vencido vale; …`
- Job: o molde de `apps/worker/test/gravar-planilha.int.test.ts` (da 4.0); barreira entre o (1) e o (3) com `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Espião no SQL: o da 3.0 (`apps/api/test/ciclo-de-vida.int.test.ts`)
- Comando: `npx vitest run --project integracao apps/worker/test/gravar-planilha-professores.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o desligado tem vínculo confirmado, pendente e encerrado.

1. **Mutação de cada cláusula:** 89 blocos na seção "Mutações" (cada um rodado antes, com a saída vermelha de um caso que rodou), e 17 linhas (11 motivos) com o motivo escrito (atalho de lista vazia, guarda de tipo, cláusula que o `usuario.escola_id` ou a FK já garantem, linha que o veredito seguinte repete). Os estados do `estadoDoProfessor` têm bloco (os que entram, os que saem), os termos de cada condição composta têm bloco, exceto os três que o motivo (11) diz equivalentes, e as cópias da mesma regra em outro arquivo (a cerca do `contaDoProfessor` em `camadas.cjs` e a zona do `architecture.test.ts`, um bloco cada) também.
2. **O texto na tela:** a tarefa não tem tela (a lista e o "Copiar link" são os da A1, 3.0; a tela é a 15.0); não se aplica.
3. **O segundo dado:** o desligado tem vínculo confirmado, pendente e encerrado, em três turmas, e há um segundo desligado com outra turma (a trava une as turmas dos dois); a classificação tem um professor em cada um dos seis estados; o "já existe" tem professor ativo, com convite em aberto e com dois convites (o antigo revogado e o novo em aberto, que o `ultimo.set` sem a guarda trocaria); a conta tem o e-mail em caixa alta e a planilha em minúsculas; a escola B tem o professor, a marca e a conta que a A não pode ver; há a escola sem ano e a com ano.
4. **Checagem anterior que responde antes:** a planilha de uma escola sem ano chegava ao `criar` e caía em `requestSessao()` (`NAO_AUTENTICADO`, exige `anoLetivoId`); o `criar` passou a ler `requestIdentity()`, e o caso "escola sem ano" chega até a importação gravada. O professor que sobe a planilha recebe `NAO_ENCONTRADO` pela permissão (o papel não alcança o recurso), e o teste confere a resposta e que nada foi gravado. A marca da escola B chega ao filtro dos candidatos (e não cai antes), porque a planilha de A é válida.
5. **Resultado, não forma do código:** as asserções leem `usuario`, `convite`, `conta`, `vinculo`, `auditoria` e `importacao_planilha`; o espião de SQL é o resultado da ordem de trava (regra do desenho da 3.0), e confere também os ids que a trava de turma recebeu.
6. **Guarda nova:** a cerca do `contaDoProfessor` passa de "só `sessao/`" a "`sessao/` e o arquivo do processor da planilha", nas duas guardas. Fixtures: o controle `processors/gravar-planilha.ts` (passa) e o vizinho `processors/vizinho-do-cadastro.ts` (reprovado); o `pathNot` é do **arquivo**, e não da pasta `processors/`. A cerca sobre arquivo que mudou de lugar reprova pelo teste "real: só o módulo sessao e o processor da planilha importam…" (`toContain` do processor); os dois blocos de `camadas.cjs` provam que tirar o processor do `pathNot` e liberar a pasta toda deixam o teste vermelho.
7. **Comentários:** relidos contra o código. O docblock de `professores.ts` (quem entra, quem pode ser marcado, a classificação pelo `usuario`), o de `tipo.ts` e o do passo (3) do `motor.ts` dizem o que o código faz; o do `gravar-planilha.ts` e o texto de `docs/modelo-de-dados.md` agora dizem que o processor também chama o `contaDoProfessor`.
8. **A divergência cria regra?** Duas: a trava do convite da escola no (3) da planilha de professores e o tipo sem ano. As duas entraram em `techspec.md` §5 e em `cenarios.md` (a corrida da trava do convite) antes dos revisores e têm caso (`a trava do convite da escola`, `escola sem ano em curso`); a resposta do `infra-guardian` é o `lock_timeout` de 1 s que ela herda e a nova tentativa.
9. **Peça que já existe:** `ConviteRepository` (a metade comum subiu para o `core` como `ConviteDaEscolaRepository`, sem cópia), `contaDoProfessor`, `desativar`, `travarContraOGerarDoProfessor` (agora delega ao plural), `estadoDoProfessor`, `lerTabela`, o motor e o `tipo.ts` da 4.0, `AuditoriaRecorder`, `WriteBlockTrigger`/`esperarNaTrava`, `QueueFixtures`, `MedidorDeTeste`.
10. **Corrida:** `Promise.all` nas duas escolas com o mesmo professor, nas ordens opostas e no mesmo desligado (efeito no banco: as duas `concluida`, uma `conta`); a ordem forçada no candidato desativado entre o (2) e o (3), no expurgo da conta entre o (1) e o (3), na limpeza que espera o `FOR SHARE` e na trava do convite da escola na mão de outra operação.
11. **Isolamento e coluna "Caso":** cada linha da tabela tem o caso. O isolamento tem a prévia sem distinguir a conta da B, o `resumo` e a auditoria iguais, a marca da B e o professor da B fora da prévia de A, e cada um tem bloco que o deixa vermelho sem a cláusula.
12. **O que verificar dos guardiões:** `tenancy-guardian` (a escola pelo `usuario`, a conta só pelo `usuario.conta_id` e pelo id do passo (1), a marca da B, a trava por escola), `privacy-guardian` (convite sem token, auditoria sem nome nem e-mail, candidato sem e-mail, resumo sem distinguir a conta em outra escola, `linhas` e `marcas` apagadas em toda troca de estado), `infra-guardian` (tempos do passo (3), ordem global das travas, `40P01` e `55P03` como nova tentativa, até 300 transações curtas no (1), uma por e-mail e na ordem do e-mail). O `achados/` da spec só tem rodadas das tarefas 1.0 a 4.0, sem linha que toque a planilha de professores.

## Fora do escopo desta tarefa

Convite por e-mail e "Enviar" (F2c); a tela de Professores (15.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O passo (3) da planilha de professores pega a trava do convite da escola (`pg_advisory_xact_lock`) logo depois da importação, antes dos anos | O cadastrar, o refazer e o revogar da A1 pegam essa trava antes de ler o estado; sem ela o job decidiria sobre um convite que uma dessas rotas está mudando | `techspec.md` §5 "O job" (a ordem global ganhou a trava); `cenarios.md` RF6 (a corrida da trava do convite, [P]); a seção 11 não muda |
| A planilha de professores é um tipo sem ano (`TipoSemAno`, `anoLetivoId` nulo na `importacao_planilha`), e o `ImportacaoRepository.criar` lê `requestIdentity()` no lugar de `requestSessao()` | A escola sem ano em curso precisa subir a planilha, e a sessão sem ano não tem `anoLetivoId` | `techspec.md` §5 "Planilha"; `cenarios.md` RF6 ("Escola sem ano em curso: funciona"); a seção 11 não muda |
| O `ConviteRepository` da API passa a estender o `ConviteDaEscolaRepository` do `core` (o `usuarioConvidado`, o `criarConvite`, o `travarEscola` e a chave da trava subiram), e o `convidarProfessorDaPlanilha` é novo no `core` | O job do worker não importa código da API; a Tech Spec já previa "o que o worker da 6.0 precisar do convite sobe para o core" | `techspec.md` §6 (parágrafo do `convidar` da A1); a seção 11 não muda |
| O `contaDoProfessor` entra na zona da cerca como o arquivo `apps/worker/src/processors/gravar-planilha.ts` (não a pasta), recebido pelo motor por injeção (`opcoes.acharConta`) | O passo (1) acha ou cria a conta global, e o motor do `core` não pode importar o cadastro | `techspec.md` §6 ("a 6.0 acrescenta o processor do worker à zona, nas duas guardas"); `architecture.test.ts` e `camadas.cjs` |
| O `CicloDeVidaRepository` ganha `travarContraOGerarDosProfessores(ids)` (um comando, em ordem de id), e o singular delega a ele | Duas planilhas com desligados em ordens diferentes não podem se prender (`40P01`) | `techspec.md` §5 "O job" (as turmas "em ordem de id num comando só"); `cenarios.md` RF6 |
| A trava `FOR SHARE` das contas do passo (3) mora no `ContaGlobalRepository` (`travarEConferir`, `@Unscoped`), sai pelo arquivo cercado `cadastro-de-professor.ts` (`travarContasDoProfessor`) e o motor a recebe por injeção (`opcoes.travarContas`), como o `acharConta`; o `ImportacaoRepository` só lê a `conta` pelo `leftJoin` de `usuario.conta_id` da escola (`professoresDaEscola`) | A trava lia a tabela global `conta` sem escopo dentro de `importacao/` (`tenancy-guardian` e `revisor-geral`, rodada 1): a regra 10, item 9 só admite a exceção marcada e cercada | `techspec.md` §6 (a segunda exceção, no mesmo arquivo cercado); `docs/modelo-de-dados.md` (a quinta exceção e a leitura do `professoresDaEscola`); a seção 11 não muda |
| A API de professores (`professores.service.ts`, `professores.repository.ts`) não muda | A lista já mostra o `pendente` e o "Copiar link" já é o `convite/refazer` da A1 (3.0); a tarefa prova os dois com o cadastrado pelo job | `techspec.md` §4; `cenarios.md` RF6 |
| Arquivos além dos "previstos": `erros.ts`, `tipo.ts`, `convite-da-escola.repository.ts`, `convidar-professor-da-planilha.ts`, `ciclo-de-vida.repository.ts`, `importacao.repository.ts`, `calendario.ts` e `calendario.test.ts` (o campo `usaAno` e o ambiente do `aplicar`), `packages/shared/src/importacao/contratos.ts` e `index.ts` (o teto de 300 linhas), `packages/core/src/index.ts`, `apps/worker/src/processors/gravar-planilha.ts`, `apps/worker/test/gravar-planilha.int.test.ts` e `apps/api/test/importacao.int.test.ts` (o caso de tipo que ainda não grava deixa de citar `professores`), `tools/guardas/camadas.cjs`, `camadas.test.ts` e as fixtures de `processors/`, `docs/modelo-de-dados.md` | Cada um é o ponto onde o código novo precisa existir para o tipo sem ano, a cerca e o teto | `techspec.md` §2, §5 e §6; regra 10, item 9; a seção 11 não muda |

## Mutações

--faltando: 17 linhas (89 blocos, 11 motivos)

**Sem bloco (motivo):** (1) `ciclo-de-vida.repository.ts:159`, `importacao.repository.ts:270` e `conta-global.repository.ts:93`, os `if (lista.length === 0) return`: atalho que poupa a consulta vazia; sem ele o `inArray` com lista vazia vira `false` e nada é travado nem lido. (2) `convite-da-escola.repository.ts:67`, `criado === undefined`: o `insert … returning` sempre devolve a linha; é guarda de tipo, a mesma que o `ConviteRepository` já tinha antes de subir para o `core`. (3) `importacao.repository.ts:256`, o `where` do convite por escola e por tipo: os convites lidos são só os dos `usuarioId` desta escola (a chave do mapa), e convite de outra escola ou de outro tipo tem outro usuário; o escopo fica por regra 10 (item 3), sem diferença de resultado. (4) `motor.ts:204` e `:256`, `anoLetivoId === null ? undefined : …`: o `alvoDe` já recusou o tipo de um ano com `anoLetivoId` nulo (o bloco do `usaAno && anoLetivoId === null`); a ramificação só estreita o tipo. (5) `:207`, `:253` e `:259`, `vista`/`plano === undefined`: releem o `linhas` que o (2) acabou de validar, sob o `for update` da importação, que só o job escreve; nenhum caso chega ali (o mesmo motivo da 4.0). E o `:250`, `travarContas === undefined` sob a trava: o passo (1) já recusou a falta das duas funções (o bloco do `|| travar === undefined` tem caso), e esta é a guarda de tipo do mesmo valor. (6) `:238`, `plano === 'encerrado'`: a linha seguinte (`plano.assinatura !== assinatura`) fecha `desatualizada` do mesmo jeito, porque `'encerrado'.assinatura` é `undefined`; a linha existe para o tipo da união, e o bloco do `ano.situacao === 'encerrado'` sob a trava tem caso na API. (7) `professores.ts:68` e `:70`, os `?? ''` de `campos[...]`: o `campos` vem do `lerTabela` com todas as colunas do cabeçalho; o `?? ''` é só o tipo do índice. (8) `:89`, o `email === null ? [] : …`: sem ele a chave `null` entra no mapa e nenhum e-mail lido a acha; o resultado é o mesmo. (9) `:138`, o `email !== null &&`: `emails.has(null)` é `false`, igual. (10) `:181`, `!lido.success` do `travar`: o (1) já recusou a forma do tipo (`emailsDasContas` devolve `undefined`) antes de o (3) existir. (11) Termos de condição composta que não têm bloco, por serem equivalentes hoje: o `erro instanceof DomainException &&` do `desativar` (um erro sem `codigo` não é `NAO_ENCONTRADO` e sobe igual); o `erro.codigo === ErrorCode.CONFLITO` de `convidar-professor-da-planilha.ts:36` (o `criarConvite` só lança `DomainException` com `CONFLITO`; sem o termo, o resultado é o mesmo) e o `doPostgres.constraint === 'convite_pendente_unico'` de `convite-da-escola.repository.ts:64` (o `insert` do convite só viola esse índice, e o `token_hash` aleatório não se repete); o bloco de cada uma tira a condição inteira. E o `.orderBy(asc(usuario.id))` e o `.orderBy(asc(conta.id))` têm o regex do espião (`order by "usuario"."id" asc for no key update`, `order by "conta"."id" asc for share`), e não bloco, porque sem a ordem a consulta é válida e só o SQL registrado a denuncia.

Só o professor revogado volta a entrar: o `desativado` deixa de entrar.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-const ESTADOS_QUE_ENTRAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado', 'desativado'])
+const ESTADOS_QUE_ENTRAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado'])
```

Só o desativado volta a entrar: o `revogado` deixa de entrar.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-const ESTADOS_QUE_ENTRAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado', 'desativado'])
+const ESTADOS_QUE_ENTRAM: ReadonlySet<EstadoDoProfessor> = new Set(['desativado'])
```

O e-mail de quem não está na escola deixa de entrar.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-const entra = existente === undefined || ESTADOS_QUE_ENTRAM.has(existente.estado)
+const entra = existente !== undefined && ESTADOS_QUE_ENTRAM.has(existente.estado)
```

O professor chamado de volta (`revogado`, `desativado`) deixa de entrar.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-const entra = existente === undefined || ESTADOS_QUE_ENTRAM.has(existente.estado)
+const entra = existente === undefined
```

Quem não entra entra do mesmo jeito na lista dos cadastrados.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-if (entra) entram.push(lido)
+entram.push(lido)
```

Os cadastrados saem na ordem da planilha, e não na do e-mail.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-return { entram: [...entram].sort((a, b) => (a.email < b.email ? -1 : 1)), jaExistem: lidos.length - entram.length, candidatos, assinatura }
+return { entram: [...entram], jaExistem: lidos.length - entram.length, candidatos, assinatura }
```

`jaExistem` conta todas as linhas.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o e-mail sem professor, ou de professor
-return { entram: [...entram].sort((a, b) => (a.email < b.email ? -1 : 1)), jaExistem: lidos.length - entram.length, candidatos, assinatura }
+return { entram: [...entram].sort((a, b) => (a.email < b.email ? -1 : 1)), jaExistem: lidos.length, candidatos, assinatura }
```

Quem está `pendente` passa a ser candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o ausente `ativo` ou `aceito` é candidato
-const ESTADOS_QUE_SAEM: ReadonlySet<EstadoDoProfessor> = new Set(['ativo', 'aceito'])
+const ESTADOS_QUE_SAEM: ReadonlySet<EstadoDoProfessor> = new Set(['ativo', 'aceito', 'pendente'])
```

O ausente `aceito` deixa de ser candidato.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › ausente que aceitou o convite
-const ESTADOS_QUE_SAEM: ReadonlySet<EstadoDoProfessor> = new Set(['ativo', 'aceito'])
+const ESTADOS_QUE_SAEM: ReadonlySet<EstadoDoProfessor> = new Set(['ativo'])
```

O candidato deixa de pedir o estado: todo ausente é candidato.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › só o ausente `ativo` ou `aceito` é candidato
-const candidatos = daEscola.filter((professor) => !casados.has(professor.usuarioId) && ESTADOS_QUE_SAEM.has(professor.estado))
+const candidatos = daEscola.filter((professor) => !casados.has(professor.usuarioId))
```

O professor que a planilha traz continua candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o professor presente na planilha não é candidato
-const candidatos = daEscola.filter((professor) => !casados.has(professor.usuarioId) && ESTADOS_QUE_SAEM.has(professor.estado))
+const candidatos = daEscola.filter((professor) => ESTADOS_QUE_SAEM.has(professor.estado))
```

Ninguém é dado como casado com a planilha.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o professor presente na planilha não é candidato
-if (existente !== undefined) casados.add(existente.usuarioId)
```

A assinatura não distingue "entra" de "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › a assinatura não depende da ordem
-vistos.push([lido.email, entra ? 'entra' : 'ja_existe', existente?.usuarioId ?? null])
+vistos.push([lido.email, 'entra', existente?.usuarioId ?? null])
```

A assinatura depende da ordem das linhas da planilha.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › a assinatura não depende da ordem
-.update(JSON.stringify({ planilha: [...vistos].sort(([a], [b]) => (a < b ? -1 : 1)), candidatos: candidatos.map((candidato) => candidato.usuarioId).sort() }))
+.update(JSON.stringify({ planilha: [...vistos], candidatos: candidatos.map((candidato) => candidato.usuarioId).sort() }))
```

A assinatura não leva os candidatos.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › a assinatura não depende da ordem
-.update(JSON.stringify({ planilha: [...vistos].sort(([a], [b]) => (a < b ? -1 : 1)), candidatos: candidatos.map((candidato) => candidato.usuarioId).sort() }))
+.update(JSON.stringify({ planilha: [...vistos].sort(([a], [b]) => (a < b ? -1 : 1)) }))
```

O resumo do job conta zero desligados.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o resumo do job conta quem entra
-return { entram: entram.length, ja_existem: jaExistem, ...(marcas === undefined ? {} : { desligados: marcas.desligar.length }) }
+return { entram: entram.length, ja_existem: jaExistem, ...(marcas === undefined ? {} : { desligados: 0 }) }
```

A prévia também conta os desligados.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › lê nome e e-mail, guarda
-return { entram: entram.length, ja_existem: jaExistem, ...(marcas === undefined ? {} : { desligados: marcas.desligar.length }) }
+return { entram: entram.length, ja_existem: jaExistem, desligados: marcas?.desligar.length ?? 0 }
```

O nome fica com os espaços do meio.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › lê nome e e-mail, guarda
-const nome = texto.replace(/\s+/g, ' ').trim()
+const nome = texto.trim()
```

O nome vazio passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-if (nome === '') return { erro: 'nome_vazio' }
```

O nome de mais de 200 caracteres passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-return nome.length > TAMANHO_MAXIMO_NOME_DIGITADO || /\p{Cc}/u.test(nome) ? { erro: 'nome_invalido' } : { nome }
+return /\p{Cc}/u.test(nome) ? { erro: 'nome_invalido' } : { nome }
```

O nome com caractere de controle passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-return nome.length > TAMANHO_MAXIMO_NOME_DIGITADO || /\p{Cc}/u.test(nome) ? { erro: 'nome_invalido' } : { nome }
+return nome.length > TAMANHO_MAXIMO_NOME_DIGITADO ? { erro: 'nome_invalido' } : { nome }
```

A linha de nome inválido segue para o e-mail.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-if ('erro' in nome) return nome.erro
```

O e-mail sem forma de e-mail passa.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-return email.success ? { nome: nome.nome, email: email.data } : 'email_invalido'
+return { nome: nome.nome, email: String(campos['email']).toLowerCase() }
```

A 301ª linha deixa de ser erro de teto (o teto é de 301).

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › a 301ª linha é erro de teto
-lido: posicao >= MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES ? ('acima_do_teto' as const) : campos === null ? ('linha_incompleta' as const) : lerLinha(campos),
+lido: posicao > MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES ? ('acima_do_teto' as const) : campos === null ? ('linha_incompleta' as const) : lerLinha(campos),
```

Não há teto de linhas.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › a 301ª linha é erro de teto
-lido: posicao >= MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES ? ('acima_do_teto' as const) : campos === null ? ('linha_incompleta' as const) : lerLinha(campos),
+lido: campos === null ? ('linha_incompleta' as const) : lerLinha(campos),
```

A linha com colunas a menos é lida como linha vazia.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-lido: posicao >= MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES ? ('acima_do_teto' as const) : campos === null ? ('linha_incompleta' as const) : lerLinha(campos),
+lido: posicao >= MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES ? ('acima_do_teto' as const) : lerLinha(campos ?? {}),
```

O e-mail repetido nunca é achado.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o mesmo e-mail duas vezes, em qualquer caixa
-if (vistos.has(lido.email)) repetidas.add(linha)
+if (false) repetidas.add(linha)
```

O e-mail lido não entra nos vistos.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o mesmo e-mail duas vezes, em qualquer caixa
-vistos.add(lido.email)
```

A linha com erro entra na classificação como se fosse professor.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-if (typeof lido === 'string') continue
```

A linha com erro responde como linha boa.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › aponta o primeiro erro de cada linha
-if (typeof lido === 'string') return { linha, resultado: 'erro', erro: lido }
```

A linha do e-mail repetido responde como a primeira.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o mesmo e-mail duas vezes, em qualquer caixa
-if (repetidas.has(linha)) return { linha, resultado: 'ja_existe', aviso: 'email_repetido' }
```

A linha do e-mail repetido não leva o aviso.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o mesmo e-mail duas vezes, em qualquer caixa
-if (repetidas.has(linha)) return { linha, resultado: 'ja_existe', aviso: 'email_repetido' }
+if (repetidas.has(linha)) return { linha, resultado: 'ja_existe' }
```

Toda linha boa responde "entra".

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o professor da escola é "já existe"
-return { linha, resultado: entram.has(lido.email) ? 'entra' : 'ja_existe' }
+return { linha, resultado: 'entra' }
```

O candidato leva o e-mail no rótulo.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › o professor da escola é "já existe"
-const candidatos: CandidatoDaMarca[] = classificacao.candidatos.map((candidato) => ({ id: candidato.usuarioId, acao: 'desligar', rotulo: candidato.nome }))
+const candidatos: CandidatoDaMarca[] = classificacao.candidatos.map((candidato) => ({ id: candidato.usuarioId, acao: 'desligar', rotulo: candidato.email ?? candidato.nome }))
```

Os e-mails do passo (1) saem fora de ordem.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › os e-mails do passo
-return lido.success ? lido.data.map((professor) => professor.email).sort() : undefined
+return lido.success ? lido.data.map((professor) => professor.email) : undefined
```

O que foi guardado sem a forma do tipo vira lista de e-mails.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › os e-mails do passo
-return lido.success ? lido.data.map((professor) => professor.email).sort() : undefined
+return (lido.data ?? []).map((professor) => professor.email).sort()
```

O que foi guardado sem a forma do tipo vira plano.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › os e-mails do passo
-return lido.success ? planejarContra(lido.data, await repositorio.professoresDaEscola(), marcas, contas) : undefined
+return planejarContra(lido.data ?? [], await repositorio.professoresDaEscola(), marcas, contas)
```

O passo (3) não pega a trava do convite da escola.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-await new ConviteDaEscolaRepository(tx).travarEscola()
```

O passo (3) não trava os anos dos vínculos dos desligados.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-for (const usuarioId of [...marcas.desligar].sort()) await ciclo.travarAnosDosVinculos(usuarioId, true)
```

O passo (3) não trava os usuários.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-await repositorio.travarUsuarios(usuariosDoPassoTres(lido.data, await repositorio.professoresDaEscola(), marcas))
```

Os desligados não entram entre os usuários travados.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-return [...new Set([...casados, ...marcas.desligar])].sort()
+return [...new Set([...casados])].sort()
```

A conta que perdeu o e-mail não pede nova tentativa.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o expurgo de acesso limpa a conta
-if (!(await travarContas(contas))) throw new ContaDaPlanilhaPerdidaError()
+await travarContas(contas)
```

O passo (3) não trava as turmas dos desligados.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-await ciclo.travarContraOGerarDosProfessores([...marcas.desligar].sort())
```

A conta que o passo (1) não trouxe segue para o convite.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › sem a conta do e-mail
-if (contaId === undefined) throw new ContaDaPlanilhaPerdidaError()
```

O convite que não pôde ser criado é ignorado.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › não tinha o que convidar
-if (!(await convidarProfessorDaPlanilha(tx, { contaId, nome: professor.nome }))) throw new DiferencaNaPlanilhaError()
+await convidarProfessorDaPlanilha(tx, { contaId, nome: professor.nome })
```

O professor é cadastrado com o e-mail no lugar do nome.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › convida cada um que entra
-if (!(await convidarProfessorDaPlanilha(tx, { contaId, nome: professor.nome }))) throw new DiferencaNaPlanilhaError()
+if (!(await convidarProfessorDaPlanilha(tx, { contaId, nome: professor.email }))) throw new DiferencaNaPlanilhaError()
```

Os desligados saem na ordem em que vieram.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › desliga os marcados em ordem de id
-for (const usuarioId of [...marcas.desligar].sort()) {
+for (const usuarioId of marcas.desligar) {
```

O `desativar` roda fora da transação do passo (3).

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › ausente e marcado
-await ciclo.desativar(usuarioId, {}, tx)
+await ciclo.desativar(usuarioId, {})
```

O `NAO_ENCONTRADO` do `desativar` sobe como falha.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › desliga os marcados em ordem de id
-if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) throw new DiferencaNaPlanilhaError()
```

Todo erro de domínio do `desativar` vira diferença.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: packages/core/src/importacao/tipos/professores.test.ts › sobe como está
-if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) throw new DiferencaNaPlanilhaError()
+if (erro instanceof DomainException) throw new DiferencaNaPlanilhaError()
```

O professor ativo é convidado assim mesmo.

```mutacao
arquivo: packages/core/src/convite/convidar-professor-da-planilha.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › não muda o professor que já está ativo
-if (usuarioId === undefined) return false
```

O convite em aberto derruba o cadastro em vez de ser recusado.

```mutacao
arquivo: packages/core/src/convite/convidar-professor-da-planilha.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › recusa o professor que já tem convite em aberto
-if (erro instanceof DomainException && erro.codigo === ErrorCode.CONFLITO) return false
```

O convite vale 7 horas.

```mutacao
arquivo: packages/core/src/convite/convidar-professor-da-planilha.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o job cadastra cada professor
-const expiraEm = new Date(systemClock.agora().getTime() + VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor * 60 * 60 * 1_000)
+const expiraEm = new Date(systemClock.agora().getTime() + VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor * 60 * 1_000)
```

Todo convite da planilha leva o mesmo token.

```mutacao
arquivo: packages/core/src/convite/convidar-professor-da-planilha.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o job cadastra cada professor
-const tokenHash = createHash('sha256').update(randomBytes(BYTES_DO_TOKEN_DESCARTADO).toString('base64url')).digest('hex')
+const tokenHash = createHash('sha256').update('fixo').digest('hex')
```

O cadastro do professor não é auditado.

```mutacao
arquivo: packages/core/src/convite/convidar-professor-da-planilha.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o job cadastra cada professor
-await registro.gravar(tx, 'professor.cadastrado', { entidadeId: usuarioId })
```

O convite criado não é auditado.

```mutacao
arquivo: packages/core/src/convite/convidar-professor-da-planilha.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o job cadastra cada professor
-await registro.gravar(tx, 'convite.criado', { entidadeId: conviteId, depois: { tipo: 'professor', usuarioId, expiraEm: expiraEm.toISOString() } })
```

O índice único do convite em aberto sobe como erro de banco.

```mutacao
arquivo: packages/core/src/convite/convite-da-escola.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › recusa o professor que já tem convite em aberto
-if (doPostgres?.code === '23505' && doPostgres.constraint === 'convite_pendente_unico') throw new DomainException(ErrorCode.CONFLITO)
```

O professor da escola passa a ser lido sem o papel: a coordenação entra.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/professores.int.test.ts › só o ausente ativo é candidato
-.where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor')))
+.where(eq(usuario.escolaId, escolaId))
```

O professor de qualquer escola é lido.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/api/test/professores.int.test.ts › a marca de um professor da escola B
-.where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor')))
+.where(eq(usuario.papel, 'professor'))
```

O convite mais antigo decide o estado.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o último convite decide o estado
-for (const { usuarioId, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, lido)
+for (const { usuarioId, ...lido } of convites) ultimo.set(usuarioId, lido)
```

O e-mail da conta não é posto em minúsculas.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › a conta com o e-mail em maiúsculas
-email: email?.toLowerCase() ?? null,
+email: email ?? null,
```

O `FOR NO KEY UPDATE` dos usuários vira leitura.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-.orderBy(asc(usuario.id))
-.for('no key update')
+.orderBy(asc(usuario.id))
```

A conta não é travada em `FOR SHARE`.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-.orderBy(asc(conta.id))
-.for('share')
+.orderBy(asc(conta.id))
```

As contas são travadas sem o filtro dos ids do job.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › a conta que o passo
-.where(inArray(conta.id, [...esperado.keys()]))
+.where(sql`true`)
```

O e-mail da conta não é conferido.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o expurgo de acesso limpa a conta
-return travadas.length === esperado.size && travadas.every((travada) => travada.email?.toLowerCase() === esperado.get(travada.id))
+return travadas.length === esperado.size
```

A conta com o e-mail em maiúsculas é dada como perdida.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/conta-global.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › a conta com o e-mail em maiúsculas
-return travadas.length === esperado.size && travadas.every((travada) => travada.email?.toLowerCase() === esperado.get(travada.id))
+return travadas.length === esperado.size && travadas.every((travada) => travada.email === esperado.get(travada.id))
```

As turmas travadas são só as do primeiro professor.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › trava as turmas de todos os vínculos dos desligados
-inArray(vinculo.usuarioId, [...usuarioIds]),
+inArray(vinculo.usuarioId, [usuarioIds[0] ?? '']),
```

A importação de professores grava um ano que não existe.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/professores.int.test.ts › escola sem ano em curso
-const id = await importacoes.criar({ tipo, anoLetivoId: ano?.id ?? null, linhas: previa.guardado, marcas: pedido.marcas, assinatura: previa.assinatura })
+const id = await importacoes.criar({ tipo, anoLetivoId: ano === undefined ? randomUUID() : ano.id, linhas: previa.guardado, marcas: pedido.marcas, assinatura: previa.assinatura })
```

O ano no corpo da planilha de professores é aceito.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/professores.int.test.ts › escola sem ano em curso
-if (pedido.anoLetivoId !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

A planilha de professores é tratada como a de um ano.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/professores.int.test.ts › escola sem ano em curso
-if (!doTipo.usaAno) {
+if (false) {
```

A diferença do `desativar` vira falha em vez de `desatualizada`.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o `desativar` que não alcança o marcado
-if (erro instanceof DiferencaNaPlanilhaError || postgresErrorIn(erro)?.code === SQLSTATE_UNICO_VIOLADO) return desatualizar(repositorio, importacaoId)
+if (postgresErrorIn(erro)?.code === SQLSTATE_UNICO_VIOLADO) return desatualizar(repositorio, importacaoId)
```

A importação sem ano é dada como ilegível.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › escola sem ano em curso
-if (doTipo === undefined || (doTipo.usaAno && anoLetivoId === null)) throw new ImportacaoIlegivelError()
+if (doTipo === undefined || anoLetivoId === null) throw new ImportacaoIlegivelError()
```

Marcas sem a forma do tipo são aceitas.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › falha definitiva: as linhas guardadas
-if (!lidas.success) throw new ImportacaoIlegivelError()
```

O passo (1) não confere o que foi guardado.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › falha definitiva: as linhas guardadas
-if (emails === undefined) throw new ImportacaoIlegivelError()
```

O passo (1) segue sem a função do worker.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o motor sem o achar-ou-criar conta do worker
-if (achar === undefined || travar === undefined) throw new InvariantException('a planilha de professores precisa do achar-ou-criar conta e da trava das contas do worker')
```

O passo (1) segue sem a trava das contas do worker.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o motor sem o achar-ou-criar conta do worker
-if (achar === undefined || travar === undefined) throw new InvariantException('a planilha de professores precisa do achar-ou-criar conta e da trava das contas do worker')
+if (achar === undefined) throw new InvariantException('a planilha de professores precisa do achar-ou-criar conta e da trava das contas do worker')
```

A assinatura diferente no passo (2) segue para o (3).

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › assinatura diferente antes do job
-if (!(await passo2(repositorio, alvo, lida.linhas, contas))) return desatualizar(repositorio, importacaoId)
+await passo2(repositorio, alvo, lida.linhas, contas)
```

A escrita roda sem a coordenação como autora.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › ausente e marcado
-await comAutora(autor, () => plano.aplicar(gravacao, { tx, ciclo: new CicloDeVidaService(banco) }))
+await plano.aplicar(gravacao, { tx, ciclo: new CicloDeVidaService(banco) })
```

A auditoria do `desativar` perde a autora.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › ausente e marcado
-return runInContext({ ...contexto, requisicaoId: contexto?.requisicaoId ?? randomUUID(), usuarioId: autor }, acao)
+return runInContext({ ...contexto, requisicaoId: contexto?.requisicaoId ?? randomUUID() }, acao)
```

A cerca da conta do professor deixa de liberar o processor da planilha.

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › real: zero violações
-from: { path: TODO_O_CODIGO, pathNot: [SESSAO, PROCESSOR_DA_PLANILHA, TESTE] },
+from: { path: TODO_O_CODIGO, pathNot: [SESSAO, TESTE] },
```

A cerca da conta do professor libera todo o worker.

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › a guarda de camadas reprova na fixture exatamente
-const PROCESSOR_DA_PLANILHA = String.raw`^apps/worker/src/processors/gravar-planilha\.ts$`
+const PROCESSOR_DA_PLANILHA = String.raw`^apps/worker/src/processors/`
```

O calendário passa pelo passo (1) das contas dos professores.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o job conclui
-if (tipo.usaAno) return new Map()
```

O tipo de um ano é tratado como o de professores no passo (2).

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o job conclui
-if (tipo.usaAno) {
+if (false) {
```

O tipo de um ano é tratado como o de professores sob a trava.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o job conclui
-if (!tipo.usaAno) {
+if (true) {
```

O ano encerrado antes do job segue para o passo (3).

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › ano encerrado antes do job
-if (ano === undefined || ano.situacao === 'encerrado') return false
+if (ano === undefined) return false
```

O ano encerrado sob a trava não é visto.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/importacao.int.test.ts › do ano em andamento, o job vê o ano já encerrado
-if (ano === undefined || ano.situacao === 'encerrado') return 'encerrado'
+if (ano === undefined) return 'encerrado'
```

O passo (3) não espera a operação do convite da escola em curso.

```mutacao
arquivo: packages/core/src/importacao/tipos/professores.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › a trava do convite da escola: com ela na mão
-await new ConviteDaEscolaRepository(tx).travarEscola()
```

A trava dos usuários alcança o professor de outra escola.

```mutacao
arquivo: packages/core/src/importacao/importacao.repository.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › isolamento: a marca de um professor da escola B
-.where(and(eq(usuario.escolaId, requireEscolaId()), inArray(usuario.id, [...ids])))
+.where(inArray(usuario.id, [...ids]))
```

A cerca do `contaDoProfessor` deixa de liberar o processor da planilha no teste de arquitetura.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › nenhum código de produção fora da zona
-zona: ['apps/api/src/sessao/', 'apps/worker/src/processors/gravar-planilha.ts', 'packages/core/src/estrutura/cadastro-de-professor.ts'] },
+zona: ['apps/api/src/sessao/', 'packages/core/src/estrutura/cadastro-de-professor.ts'] },
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | O `desativar` do job passa `{}` como autoria; marca de origem na auditoria (`professores.ts`, o `aplicar`) | `TODO.md`: depende de a `AutoriaDoCicloDeVida` aceitar uma marca de origem, o que muda o contrato do ciclo de vida (tarefa 3.0, fora desta) |
| infra-guardian (1ª) | `aplicar` grava um professor por vez (~1.200 idas ao banco com 300 linhas) e nenhum teste mede a planilha cheia | Tarefa 16.0: o cenário de carga `importacao-7h30.js` inclui o job de professores e é onde a duração do passo (3) com 300 linhas se mede; se a medida passar de 1 s, vira correção com lote |
| infra-guardian (1ª) | Conta do desligado travada em `FOR UPDATE` depois das turmas, fora da ordem global (`motor.ts`) | `TODO.md`: muda a ordem de trava do `desativar` da 3.0; o revisor não achou ciclo possível |
| infra-guardian (1ª) | Anos travados um por vez (`professores.ts`, o `travar`) | `TODO.md`: sem conflito hoje (trava compartilhada); uniformidade |
| infra-guardian (1ª) | `acharConta` ausente lança `InvariantException`, que o processor repete (`motor.ts`) | `TODO.md`: o tratamento do erro é do processor da 4.0; muda comportamento |
| infra-guardian (1ª) | `travar` e `planejar` leem `professoresDaEscola()` duas vezes | `TODO.md`: otimização que muda a forma do `travar`, sem efeito de resultado |
| revisor-geral (1ª) | O convite do professor tem dois corpos (`convidar-professor-da-planilha.ts` e os serviços da API) | `TODO.md`: o corpo único toca `convite-de-professor.service.ts` e `convite.service.ts`, fora desta tarefa; `techspec.md` §6 trata a subida ao `core`, e o que fica é a cópia do corpo |
| revisor-geral (1ª) | `contagens.ja_existem` não conta a linha de e-mail repetido | Tarefa 15.0, que mostra a contagem na tela; hoje muda o `resumo`, que é contrato com o teste de unidade |
| test-engineer (1ª) | Job do tipo professores rodando duas vezes ao mesmo tempo (D49) sem caso próprio | Recusada: a corrida genérica da 4.0 e a das duas escolas no passo (1) cobrem o mesmo mecanismo (`FOR UPDATE` da importação) |
| test-engineer (1ª) | Planilha de professores em escola com ano em curso só passa pelo motor, não pela rota | Tarefa 15.0, cujo e2e sobe a planilha numa escola com ano |
| test-engineer (1ª) | O teste de unidade faz mock de `convidarProfessorDaPlanilha` | Recusada: o caso `W` do worker prova a função real |
| test-engineer (1ª) | Os casos de `W` dependem de soltar a trava em menos de 1 s | Vigiar na esteira; sem mudança de código |
| infra-guardian (2ª) | O motor sem `travarContas` lança `InvariantException`, que a fila repete até esgotar as tentativas (`motor.ts`, o passo (1)) | `TODO.md`: junto com a linha do `acharConta` da 1ª rodada; quando o processor da 4.0 tratar o erro, os dois saem juntos para terminal |
| infra-guardian (2ª), tenancy-guardian (2ª) | O docblock da `ContaGlobalRepository` (`conta-global.repository.ts:12-24`) diz "qualquer outra aqui é mudança de spec" e lista só `sessao`, `ciclo-de-vida` e `cadastro-de-professor.ts` como importadores; citar a 6.0 como a mudança de spec da quinta exceção e dizer que o processor alcança a classe por `travarContasDoProfessor` | `TODO.md`: texto de comentário, sem efeito de comportamento |
| tenancy-guardian (2ª), privacy-guardian (2ª) | A `ContaGlobalRepository` tem cinco métodos `@Unscoped`; a regra 10, item 9 chama de sinal de desenho errado já na terceira | `TODO.md` e retro da funcionalidade: revisar o desenho da conta global (um repository por finalidade) antes de entrar uma sexta |
| revisor-geral (2ª) | O comentário de cabeçalho de `ciclo-de-vida.repository.test.ts:8-11` diz "as mesmas três exceções", e o teste afirma cinco métodos | `TODO.md`: texto de comentário |
| revisor-geral (2ª) | `docs/modelo-de-dados.md:111`: a frase das "quatro primeiras" e da "quinta" ficou longa e emendada | `TODO.md`: texto de documento |
| revisor-geral (2ª) | `planejarSobTrava` repete a guarda `travarContas === undefined` do passo (1) | Recusada: o motivo (5) do documento já a declara guarda de tipo; passar a função estreitada muda a assinatura do passo |
| conformidade-reviewer (2ª) | Um teste unitário que afirme que quem pode ser desligado sai só de `ESTADOS_QUE_SAEM` e da ausência na planilha, para fixar a D64 | `TODO.md`: a garantia hoje é o comentário de `professores.ts` e o código não lê métrica; teste de guarda, sem mudar comportamento |
| privacy-guardian (2ª) | A frase nova de `docs/lgpd.md:65` promete a limpeza da conta que nasceu sem usuário, e nenhum teste a prova (`expurgo-de-acesso.int.test.ts` só semeia conta com usuário desativado); caso com `conta` sem nenhum `usuario`, limpa pelo `limparLoteDeContasSemUso` | `TODO.md`: teste do expurgo, que é de outra tarefa (limpeza da conta, F1 17.0) |
| privacy-guardian (2ª) | A mesma frase cita só o job que termina `desatualizada`; o que termina `falhou` depois do passo (1) também deixa a conta sem usuário | `TODO.md`: texto de documento |
| test-engineer (2ª) | O caso "o motor sem o achar-ou-criar conta do worker" tem comentário que diz "e nenhuma conta nasce" sem asserção | `TODO.md`: acrescentar a contagem ou tirar a frase do comentário |
| test-engineer (2ª) | Os três casos novos (mesmo nome, `desativado` com e-mail, `desativado` com a conta limpa) não estão na tabela nem num bloco de mutação | `TODO.md`: uma linha na tabela de "Testes que provam a regra" ou citá-los no bloco do `ESTADOS_QUE_ENTRAM` |
| test-engineer (2ª) | O nome do caso de isolamento ("o job não espera a trava dele") promete mais que o caso prova: só a linha do `usuario` da B é travada, e não `travarAnosDosVinculos` nem `travarContraOGerarDosProfessores` | `TODO.md`: o `segurador` poderia travar também uma turma da B |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 21:35:34 | 2026-11-03 21:36:07 | `conformidade-reviewer` | 1 | APROVADO | a31db96946261c90a |
| 2026-11-03 21:35:17 | 2026-11-03 21:37:54 | `tenancy-guardian` | 1 | REPROVADO | a7ec5b0a668240b2c |
| 2026-11-03 21:35:20 | 2026-11-03 21:38:33 | `privacy-guardian` | 1 | APROVADO | ae9f8773a9311044f |
| 2026-11-03 21:35:31 | 2026-11-03 21:38:34 | `revisor-geral` | 1 | REPROVADO | a299ebea4e76bc4b7 |
| 2026-11-03 21:35:24 | 2026-11-03 21:38:37 | `infra-guardian` | 1 | APROVADO | a9b3b4fc689276ad0 |
| 2026-11-03 21:35:27 | 2026-11-03 21:39:41 | `test-engineer` | 1 | APROVADO | a2f27ff34d59ebed7 |
| 2026-11-03 22:06:58 | 2026-11-03 22:07:26 | `infra-guardian` | 2 | APROVADO | aa94f62a24fb7adf5 |
| 2026-11-03 22:06:45 | 2026-11-03 22:07:31 | `revisor-geral` | 2 | APROVADO | a1faed9debdcb358b |
| 2026-11-03 22:07:11 | 2026-11-03 22:07:37 | `conformidade-reviewer` | 2 | APROVADO | aa4cc3492250376c4 |
| 2026-11-03 22:06:34 | 2026-11-03 22:07:40 | `tenancy-guardian` | 2 | APROVADO | a3270a0f839954385 |
| 2026-11-03 22:06:51 | 2026-11-03 22:08:28 | `privacy-guardian` | 2 | APROVADO | acb2361622f1d993a |
| 2026-11-03 22:07:04 | 2026-11-03 22:09:00 | `test-engineer` | 2 | APROVADO | a690065f106c38e65 |
