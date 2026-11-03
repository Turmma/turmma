# Revisão de spec — onboarding-por-convite

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`, `revisor-geral`

## Rodada 1 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 11 |
| `tenancy-guardian` | REPROVADO | 3 |
| `privacy-guardian` | REPROVADO | 6 |
| `infra-guardian` | REPROVADO | 4 |
| `frontend-reviewer` | AJUSTES NECESSÁRIOS | 1 |
| `revisor-geral` | REPROVADO | 6 |

### Correções exigidas na Tech Spec
- §2 e §5: o que sobe de `apps/api` para `packages/core` para o worker gravar (cifra, `encerrar` que revoga o acesso, criação de turma, série, disciplina e professor, leituras da lista); encerrar pela grade e pela transferência passa pelo `encerrar` (`revisor-geral`)
- §5, §6 e §11: repository do worker para a conta global e `link_da_conta`, com o `@Unscoped` de cada método, na exceção do `docs/modelo-de-dados.md` e nas zonas do `architecture.test.ts` (`tenancy-guardian`)
- §5: o cookie da conta provada leva escola e acesso da turma, é cifrado (AES-GCM, como o `educa_oidc`), `HttpOnly`, caminho restrito, apagado ao gravar o pedido, com linha no `docs/lgpd.md`; pedido em outra escola ou acesso é recusado igual (`tenancy-guardian`, `privacy-guardian`)
- §4 e §6: o ano de destino da importação resolvido no servidor (em curso, ou o planejado por filtro validado), nunca do corpo; FK composta `(escolaId, anoLetivoId)` nas tabelas novas; ano encerrado entre gravar e o job (`tenancy-guardian`, `test-engineer`, `revisor-geral`)
- §5 e §7c: o job trava a linha com `select … for update` e sai se não estiver `na_fila`; toda troca de estado com `where estado = 'na_fila'`; tabela de estados de `importacao_planilha` e do envio (`infra-guardian`, `revisor-geral`)
- §5 e §7c: o bilhete da provisória leva a referência da provisória e a troca é um `update … where provisoria_hash = … and provisoria_expira_em > now()`; com o uso auditado (`senha_provisoria.usada`) e o risco na §13 (`infra-guardian`, `privacy-guardian`)
- §3: `convite.canal not null default 'copiado'`; substituição do check `reivindicacao_segredo_so_pendente` em `not valid` + `validate`; ação das FKs novas na eliminação; `erro` como código de lista fechada; `tokenCifrado` nulo também em `falhou`, `cancelado` e na revogação (`infra-guardian`, `privacy-guardian`)
- §7c: prévia e gravar com p95 de até 2 s em 3.000 linhas, medido no cenário de carga (regra 00, item 4) (`infra-guardian`)
- §5: login por matrícula responde igual para aluno só com conta externa; a provisória para esse aluno é recusada a quem gera, que já é autorizado (`privacy-guardian`)
- §7: DTO de cada saída nova (grade sem e-mail, calendário, importação, estado do envio) (`privacy-guardian`)
- §5: desligamento do nome não aprovado (apaga a `lista_nome`, encerra o pedido, auditoria sem nome); matrícula repetida na planilha; virada de ano (o aluno aprovado do ano anterior volta à turma nova sem nova reivindicação) (`revisor-geral`, `test-engineer`)
- §4: o destino das rotas da lista da A1 e dos testes da A1 que mudam de regra (`revisor-geral`, `test-engineer`)
- §3 e §11: a que a `Aula` da F2b se prende, com a reimportação mantendo o id da alocação por (vínculo, dia, início); modelo de dados e glossário (`revisor-geral`)
- PRD: a posse do e-mail, escolhida pelo Joaquim nas perguntas da Tech Spec, entra como caso de borda (`revisor-geral`)
- §10: e2e também em `celular` (`frontend-reviewer`); a matriz de cenários por cláusula, os de ano letivo, vínculo encerrado e aberto, as corridas que faltam e o XLSX real vão para `cenarios.md` (`test-engineer`)

### Recomendações
- Reaproveitar `GET /v1/sessao/externa/:provedor/iniciar` e `convite/refazer`; chave própria para o token cifrado, com o id como dado autenticado
- Balde de IP próprio para o "esqueci"; token validado antes do argon2; taxa global de e-mail; prévias simultâneas por escola
- Índices de expurgo; contrato das planilhas em `packages/shared`, de onde saem os modelos do RF1
- Textos dos códigos de erro na tela, estados vazios com "Baixar modelo", acessibilidade da prévia e da grade, confirmação com nome e turma antes de gerar a provisória
- `desativar` revoga o convite aberto e cancela o link na fila; colunas cifradas fora do arquivo do titular

## Rodada 2 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 13 |
| `tenancy-guardian` | REPROVADO | 1 |
| `privacy-guardian` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 2 |
| `frontend-reviewer` | APROVADO | 0 |
| `revisor-geral` | REPROVADO | 2 |

Os bloqueantes da rodada 1 foram dados como resolvidos, exceto a correção 1 (o que sobe para o core), feita pela metade.

### Correções exigidas na Tech Spec
- §1, §2, §6 e §11: o cadastro do professor está em `sessao/convite` e alcança a conta global pelo `contaParaConvite`; ele sobe para o core como exceção cercada, e sobem também o `travarPendente` e o `fechar` da decisão (`revisor-geral`)
- §5: o nome corrigido de aluno aprovado vai para o `usuario.nome`, achado pela `credencial_matricula`, e não para a `lista_nome` (`revisor-geral`)
- §5 e §7c: o job do link da conta é `sistema.*` com escola nula, separado do job do convite, que leva a escola do convite no registro (`tenancy-guardian`)
- §5: a tela de troca mostra ao aluno as trocas anteriores por provisória; `senha_provisoria.gerada` e `.usada` entram no arquivo do titular, com o aluno como autor de `.usada` (`privacy-guardian`, opção (a), que não muda o PRD)
- §5: a importação `na_fila` sai em `falhou` na falha definitiva e na última tentativa, e o expurgo fecha a parada há mais de 1 h (`infra-guardian`, `test-engineer`)
- §5 e §7c: o e-mail de verificação do aceite tem teto por conta, que rebaixa, e reaproveita o link aberto (`infra-guardian`)
- §3: `turma.chave` com único parcial no ano, para a corrida da turma criada à mão contra a do job (`test-engineer`)
- §5: e-mail lido com `for update skip locked` e `enviado` com `where envio = 'na_fila'`; o vínculo do ano planejado só se confirma com o ano em curso (`test-engineer`, `infra-guardian`)
- §11: "E-mail que volta" do PRD, só a recusa na entrega SMTP, como desvio (`test-engineer`)
- `cenarios.md`: limites (prévia, prévias simultâneas, `rl:ip:senha`, `EMAIL_POR_MINUTO`, trocar-senha), ano sem curso em `importacoes/:id` e `externa/iniciar`, RF6 (teto e desligamento), RF7 (novo, sem professor, envio seguinte), RF10 (diferença), RF14 (banco sem e-mail nem foto, ligar em "Eu"), homônimos, redefinir que verifica, envio parado há 24 h, as corridas que faltavam (`test-engineer`)

### Recomendações
- Ordem das travas do job (importação, ano em `FOR SHARE`, turmas, pedidos), `for update nowait` no gravar, cenário [C] do job contra o gerar acesso; índice `(escolaId, anoLetivoId)` em `alocacao`; prévias simultâneas no Redis contando o gravar; teto do `rl:ip:senha`, que rebaixa (`infra-guardian`)
- Escritas do expurgo declaradas; único da reivindicação por `(escolaId, provedor, tenant, sujeito)`; aluno de outra turma recebe 404 antes de `SEM_SENHA`; grade e calendário do coordenador aceitam o filtro do planejado; `turmaId` da lista conferido no ano (`tenancy-guardian`)
- Hash fixo para o aluno sem senha; bilhete cifrado; linha da provisória no `docs/lgpd.md` com a `.usada`; `resumo` só com contagens; "id no provedor" fora do PRD §8; risco do `VERIFICACAO_PENDENTE` na §13 (`privacy-guardian`)
- PRD: RF16 alinhado ao ano planejado, RF18 também em `celular`, a posse do e-mail registrada no status; casos da A1 em `convite.int.test.ts` que mudam; "Copiar link" do professor do job pelo `convite/refazer`; tarefa dona do `docs/modelo-de-dados.md` e do glossário (`revisor-geral`, `frontend-reviewer`)
- Estado de carregando e falha com "Tentar de novo"; conta da escola e verificar no e2e a 360 px; alvo de 24 px (`frontend-reviewer`)

## Rodada 3 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 3 |
| `tenancy-guardian` | REPROVADO | 1 |
| `privacy-guardian` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 2 |
| `frontend-reviewer` | APROVADO | 0 |
| `revisor-geral` | REPROVADO | 1 |

Os bloqueantes da rodada 2 foram dados como resolvidos; os desta rodada nasceram das correções dela.

### Correções exigidas na Tech Spec
- §6: a cerca do `ContaGlobalRepository` é o **arquivo** do cadastro do professor, nas duas guardas (`architecture.test.ts` e `cerca-conta-global` de `tools/guardas/camadas.cjs`), com fixture que reprova o vizinho (`tenancy-guardian`)
- §5: provisória responde `SEM_SENHA` para todo aluno com conta da escola ligada, como no PRD §7 (`privacy-guardian`)
- §5 e `docs/lgpd.md`: o prazo real da importação parada (1 h pelo gravar; o expurgo da 1h, pior caso de cerca de 25 h), com cenário de fronteira; o job é uma transação só, com cenário de falha no segundo lote; corrida do nome corrigido contra a aprovação (`update … where estado <> 'aprovado'`, zero linhas: `desatualizada`) (`test-engineer`)
- §3 e §5: `turma.chave` recalculada na renomeação, `CONFLITO` no único; o link de verificar é novo a cada envio, como no "esqueci", e o teto de 3/h decide (`infra-guardian`)
- §3 e §5: `fechar('encerrada')` grava só o estado e anula os quatro segredos, sem `decidida*`, e o `virarSala` passa por ele; o check por extenso, com `contaExterna` (`revisor-geral`)

### Recomendações
- Expurgo da importação e do convite pelo `retencao.expurgar-escola`, do link pelo `sistema.expurgar-acesso`, com `skip locked`; a trava do e-mail dura o envio, com `idle_in_transaction_session_timeout`; o adiamento da taxa não gasta tentativa; contador de prévias com prazo de validade (`infra-guardian`)
- `convidar` da A1 no job (professor `pendente`); `contaParaConvite` na ordem do e-mail; invariante do `travarPendente`; `usuario.nome_corrigido`; os quatro `@Unscoped` na §11 (`revisor-geral`, `tenancy-guardian`)
- Leitura do titular por alvo; papel de quem gerou no `depois`; `/trocas` confere o bilhete; `BILHETE_KEY`; linhas do `docs/lgpd.md` da grade, da provisória e do evento do calendário (`privacy-guardian`)
- Estados da lista de trocas, datas em português, bilhete vencido (`frontend-reviewer`); tabelas de limites e de auditoria testadas linha a linha, e as corridas que faltavam (`test-engineer`)

## Rodada 4 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 3 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 2 |
| `revisor-geral` | APROVADO | 0 |

O `frontend-reviewer` aprovou na rodada 3 e não voltou: esta rodada não mudou tela.

### Correções exigidas na Tech Spec
- §5 "E-mail": nada de segurar a linha durante o SMTP, porque o `statement_timeout` de 2 s corta quem espera. Reserva `enviando` com prazo; a revogação, o `desativar` e o link novo gravam `cancelado` na hora (`infra-guardian`)
- §5 "O job": três passos. Contas em transações curtas antes; classificação sem trava; fase final curta com `lock_timeout`, que trava as turmas tocadas e os pedidos pendentes delas. Cenário [C] com critério de aprovação (`infra-guardian`, `test-engineer`)
- `cenarios.md`: a ordem inversa da corrida do nome corrigido; a revogação durante o envio coerente com os estados finais; [P] da renomeação contra o job (`test-engineer`)
- §5 e `cenarios.md`: a provisória vencida é anulada pelo `retencao.expurgar-escola`, com cenário de 23 h e 25 h, como o `docs/lgpd.md` promete (`privacy-guardian`)

### Recomendações
- `link_da_conta` na API pelo `TenantResolutionRepository`; `importacao_planilha` final como alvo do expurgo de acesso; `nova` descartado pelo cadastro; turma da B não casa com a planilha da A (`tenancy-guardian`, `revisor-geral`)
- §1 com o ciclo de vida; `virarSala` e `fechar` com as mesmas colunas; códigos `SEM_SENHA` e `VERIFICACAO_PENDENTE` em `packages/shared` (`revisor-geral`)
- Falha injetada em toda tentativa; o check testado direto no banco; o envio do link antigo vira `cancelado`; `turma.criada` e a "volta" na auditoria (`test-engineer`)
- Gerar confere a conta ligada antes de apagar; o envio parado do link no `docs/lgpd.md`; evento do calendário `sem_pessoa`; classificar as quatro tabelas novas (fica para as tarefas) (`privacy-guardian`)
- Dois aceites com verificação; `EMAIL_POR_MINUTO` antes da reserva; runbook do retorno recalcula a `chave` (`infra-guardian`)

## Rodada 5 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 5 |
| `privacy-guardian` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 2 |

Os bloqueantes da rodada 4 foram dados como resolvidos; os desta nasceram dos três passos do job e da reserva do e-mail.

### Correções exigidas na Tech Spec
- §5 "O job", passo (3): turmas em `FOR NO KEY UPDATE`, que deixa passar o `FOR KEY SHARE` da FK do vínculo da decisão (o "sem ciclo" estava errado); contas em `FOR SHARE` com o e-mail conferido; pedidos relidos sob a trava; o (3) relê o que o (2) usou, e a escrita na `lista_nome` leva `where estado = :lido`; diferença ou único violado: `desatualizada` (`infra-guardian`, `test-engineer`)
- §5 "E-mail": 4xx ou queda devolvem a linha a `na_fila`; reserva alheia vigente adia; `enviado` só com a minha reserva (`test-engineer`, `infra-guardian`)
- `docs/lgpd.md`: cifrados e prazo de 24 h também em `enviando`; a provisória vencida sai pelo `retencao.expurgar-escola`, não no login (`privacy-guardian`)
- `cenarios.md`: renomeação, desativação e pedido novo entre o (2) e o (3); expurgo entre o (1) e o (3); trava esgotada; reivindicação contra o (3); decisão contra o (3) sem `40P01`; desativar e link novo durante o envio; falha transitória com a linha `enviando` (`test-engineer`, `infra-guardian`)

### Recomendações
- Metade da taxa de e-mail reservada ao link da conta; métrica e alerta do passo (3); espera crescente na nova tentativa; índice da provisória vencida (`infra-guardian`)
- Check no banco para os cifrados; a conta sem usuário que sobra do passo (1) perde o e-mail na madrugada (`privacy-guardian`)
- Só o estado final nos [P] que dependem do `lock_timeout`; piso do "esqueci" por relógio falso; [P] determinístico do passo (3) contra o gerar acesso e o `virarSala` (`test-engineer`)

## Rodada 6 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 3 |
| `privacy-guardian` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 1 |

### Correções exigidas na Tech Spec
- §5 "O job", passo (3): ordem global de travas (importação, ano, usuários, contas, turmas por id num comando, pedidos), seguida também pelo `desativar` e pelo `eliminar`; "turmas tocadas" definidas (`infra-guardian`)
- §5 "O job", passo (3): relê o estado de toda linha em que o (2) se baseou, vínculo incluído; `encerrar` que devolve `false` e `vinculo_ativo_unico` violado levam a `desatualizada`; `fechar('encerrada')` antes de apagar a `lista_nome` (`test-engineer`, `infra-guardian`)
- `docs/lgpd.md`: pior caso da provisória é cerca de 48 h depois de gerada; as 24 h do envio contam do `criadoEm` (por isso "Enviar" refaz o convite numa linha nova) (`privacy-guardian`)
- `cenarios.md`: vínculos mudados entre o (2) e o (3); 4xx até o fim; metade da taxa reservada ao link da conta; job contra o `desativar` e o `eliminar` sem `40P01` (`test-engineer`, `infra-guardian`)

### Recomendações
- `statement_timeout` no passo (3); [C] com o login e o redefinir de professores; barreira no job duplicado; piso do perdedor do "esqueci"; professor desativado entre o (2) e o (3) (`infra-guardian`, `test-engineer`)
- Anular os cifrados do link no vencimento; releitura das contas no `cadastro-de-professor.ts`; índices dos expurgos novos (fica para as tarefas) (`privacy-guardian`, `infra-guardian`)

## Rodada 7 — 03/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `privacy-guardian` | APROVADO | 0 |
| `infra-guardian` | APROVADO | 0 |
| `test-engineer` | REPROVADO | 2 |

### Correções exigidas (aplicadas, à espera da rodada 8 do `test-engineer`)
- `cenarios.md`, RF11: "Enviar" e "Reenviar" criam convite de id novo; o token copiado antes é recusado; as 24 h contam do novo `criadoEm`; o diálogo do "Enviar" avisa que os links copiados deixam de valer; "só o último link gerado é aceito" no lugar de "o link copiado continua aceito" (`test-engineer`)
- `cenarios.md`, RF3: matrícula lançada à mão entre o (2) e o (3) leva a `desatualizada`, nunca `falhou` (`test-engineer`)

### Recomendações
- Aplicadas: "em ordem de id" nas travas de turma (§2 e §5); espião no SQL da ordem global; métrica que distingue a segunda execução; link da conta conferido por `envio` e cifrados; "solta a vaga" com asserção; troca e `desativar` anulam as três colunas da provisória; turmas do professor desligado em qualquer estado; [P] de duas escolas desligando o mesmo professor (`test-engineer`, `privacy-guardian`, `infra-guardian`)
- Para a rodada 8 ou as tarefas: se o `desativar` trava o ano em `FOR SHARE` contra o `virarAno` e o `virarSala`, e o `eliminar` sem ano no contexto; teto da transação inteira do passo (3) (`transaction_timeout` ou corte por tempo, virando nova tentativa) (`infra-guardian`)
- Para as tarefas: `docs/lgpd.md`, "Acesso da turma", passa a dizer que a desativação revoga; frase no PRD RF11 sobre os links copiados (é texto de tela, o critério não muda) (`privacy-guardian`, `test-engineer`)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 12:22:46 | 2026-11-03 12:23:23 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a8e42653e7347ab0b |
| 2026-11-03 12:22:39 | 2026-11-03 12:25:41 | `tenancy-guardian` | 1 | REPROVADO | a4969616ba021249c |
| 2026-11-03 12:22:43 | 2026-11-03 12:26:40 | `infra-guardian` | 1 | REPROVADO | a4b4e64e9139518d4 |
| 2026-11-03 12:22:37 | 2026-11-03 12:26:44 | `test-engineer` | 1 | REPROVADO | a55d5095a9d02c4b6 |
| 2026-11-03 12:22:41 | 2026-11-03 12:27:25 | `privacy-guardian` | 1 | REPROVADO | a058b425131fd70dd |
| 2026-11-03 12:22:48 | 2026-11-03 12:27:49 | `revisor-geral` | 1 | REPROVADO | acaae2932e5a23860 |
| 2026-11-03 12:34:03 | 2026-11-03 12:34:18 | `frontend-reviewer` | 2 | APROVADO | a98715330c910c142 |
| 2026-11-03 12:33:50 | 2026-11-03 12:36:10 | `tenancy-guardian` | 2 | REPROVADO | af42a538d4e590ebf |
| 2026-11-03 12:33:45 | 2026-11-03 12:36:36 | `test-engineer` | 2 | REPROVADO | ac443267187d23a65 |
| 2026-11-03 12:33:55 | 2026-11-03 12:36:50 | `privacy-guardian` | 2 | REPROVADO | a74135910d2f7623a |
| 2026-11-03 12:33:59 | 2026-11-03 12:37:26 | `infra-guardian` | 2 | REPROVADO | a19455e257f196630 |
| 2026-11-03 12:34:08 | 2026-11-03 12:37:58 | `revisor-geral` | 2 | REPROVADO | a487b8abe4bd9e7aa |
| 2026-11-03 12:46:59 | 2026-11-03 12:47:21 | `frontend-reviewer` | 3 | APROVADO | af83f3508f0e49a3e |
| 2026-11-03 12:46:23 | 2026-11-03 12:48:08 | `tenancy-guardian` | 3 | REPROVADO | ac5493288225d9174 |
| 2026-11-03 12:46:38 | 2026-11-03 12:49:15 | `privacy-guardian` | 3 | REPROVADO | a92ddd2509ee0c4ef |
| 2026-11-03 12:46:30 | 2026-11-03 12:49:34 | `test-engineer` | 3 | REPROVADO | a575fa07cb4bf920f |
| 2026-11-03 12:46:53 | 2026-11-03 12:49:55 | `revisor-geral` | 3 | REPROVADO | a4c41e20c8b652952 |
| 2026-11-03 12:46:45 | 2026-11-03 12:50:01 | `infra-guardian` | 3 | REPROVADO | a405746c903d8a966 |
| 2026-11-03 12:54:34 | 2026-11-03 12:57:12 | `test-engineer` | 4 | REPROVADO | ac2270618fbb295b0 |
| 2026-11-03 12:54:17 | 2026-11-03 12:57:12 | `tenancy-guardian` | 4 | APROVADO | a0c96e21618968718 |
| 2026-11-03 12:54:25 | 2026-11-03 12:57:17 | `privacy-guardian` | 4 | REPROVADO | acac1b9c5a115ee8f |
| 2026-11-03 12:54:42 | 2026-11-03 12:57:45 | `infra-guardian` | 4 | REPROVADO | a95f23a6f2ec93811 |
| 2026-11-03 12:54:50 | 2026-11-03 12:57:52 | `revisor-geral` | 4 | APROVADO | aee6b7b0373953d5b |
| 2026-11-03 13:01:37 | 2026-11-03 13:04:12 | `privacy-guardian` | 5 | REPROVADO | a2e00577ee7ebf233 |
| 2026-11-03 13:01:30 | 2026-11-03 13:05:01 | `test-engineer` | 5 | REPROVADO | aef3a071f5df67427 |
| 2026-11-03 13:01:22 | 2026-11-03 13:05:45 | `infra-guardian` | 5 | REPROVADO | af63b8697288a0b0d |
| 2026-11-03 13:08:04 | 2026-11-03 13:09:56 | `privacy-guardian` | 6 | REPROVADO | a6833001560b6e782 |
| 2026-11-03 13:07:56 | 2026-11-03 13:10:58 | `test-engineer` | 6 | REPROVADO | ad07a45f2a023c561 |
| 2026-11-03 13:07:47 | 2026-11-03 13:12:46 | `infra-guardian` | 6 | REPROVADO | a8a6e16e1d0c6c8be |
| 2026-11-03 13:14:25 | 2026-11-03 13:15:50 | `privacy-guardian` | 7 | APROVADO | ad9d77a7cac89a105 |
| 2026-11-03 13:14:19 | 2026-11-03 13:16:29 | `test-engineer` | 7 | REPROVADO | a78ad3658d2b37531 |
| 2026-11-03 13:14:10 | 2026-11-03 13:17:50 | `infra-guardian` | 7 | APROVADO | a78373edfe4b14995 |
