# Achados das revisões — `tasks/prd-acesso-e-convites/18_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-10 14:43:11 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. Mudam três coisas:
- `auditoria`: o índice parcial `auditoria_por_alvo_idx` passa a ter sete ações, pela `0048_auditoria_por_alvo_email.sql`, e continua começando por `escola_id`.
- `usuario`: muda o `conta_id`, por `update` condicional.
- `conta`: tabela global, achada ou criada pelo `contaDoProfessor`, que tem cerca própria e não muda nesta tarefa.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts:146-153` (`jaEntrou`): filtra por `convite.escolaId = requireEscolaId()`, pelo `usuarioId`, por `tipo = 'professor'` e por `usado_em` preenchido.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts:384-391` (`trocarContaDoProfessor`): o `update` filtra por `usuario.escolaId = requireEscolaId()`, pelo id, pelo papel `professor`, por `desativado_em` não nulo e por conta diferente da atual.
- `dadosDoProfessor`, chamado pelo `professorSobATrava` (código já existente): escola do contexto, junção com `usuario` na mesma escola, papel `professor`. O id de outra escola, de aluno, de coordenador ou inexistente dá `NAO_ENCONTRADO`.
- `refazerSobATrava` e `revogarParaRefazer` são reaproveitados sem mudança.
- Entrada: o corpo é `z.strictObject({ email })`. O teste confirma que `escolaId` ou `contaId` no corpo dão `ENTRADA_INVALIDA`. A escola vem só da sessão e o id é validado pelo `IdPipe`, que aceita só UUID.
- Mensagens de erro: o `CONFLITO` aparece só depois de o escopo passar. O caso E11 (e-mail que já tem conta em outra escola) devolve resposta com a mesma forma e o mesmo `no-store` da conta nova, sem o e-mail nem o id da conta.
- Tomada de conta de outra escola: o aceite só grava senha onde `senha_hash is null`, e o convite copiado que cruza escolas exige prova de posse (`exigeVerificacao`, em `convite.service.ts:68`). Corrigir para um e-mail de outra escola não dá acesso à conta de lá.
- Camada de rede: a célula `professor.corrigir_email` é `nunca` para rede, professor e aluno, e `unidade` só para a coordenação.
- `@Unscoped()`: nenhum novo.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts`:
- O caso "repository" (linhas 469-506) chama `trocarContaDoProfessor` e `jaEntrou` no contexto da escola A com o usuário da escola B e espera `false`. Sem o `escolaId` no `update`, a linha 481 quebra. Sem o `escolaId` no `jaEntrou`, a linha 480 quebra. As duas remoções também estão declaradas como mutação na tarefa.
- O caso "isolamento" (linhas 450-467) testa pela rota e confere que nada foi criado e nada mudou na escola B.

Bloqueantes: nenhum.

Recomendações:
- O "Corrigir o e-mail" com o e-mail de um coordenador da mesma escola cria uma linha de professor na conta dele, porque a unicidade é por escola, conta e papel. Não vaza entre escolas. Vale decidir na 19.0 se isso deve ser `CONFLITO`.
- A `0048` cria o índice em `auditoria` sem `CONCURRENTLY`. Isso é com o `infra-guardian` (regra 80, item 9), não com isolamento.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-10 14:43:12 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A 18.0 grava só em `usuario.conta_id`, `conta`, `convite`, `convite_envio` e `auditoria`, e nenhum arquivo do diff cita `nota` ou `lancadaPor`. Todos com autor humano? Não se aplica, porque não há caminho novo.
Decisão autônoma sobre aluno: ausente. A rota mexe só em professor, e o aluno é recusado (`aluno.professor.corrigir_email = 'nunca'`).
Aprovação registrada: ok. Nenhuma saída de IA passa por este fluxo. A correção é feita pela coordenação e auditada com autor (`usuario.email_corrigido` e `convite.refeito`), e a exceção do tutor (D47) não aparece em lugar nenhum.
Supervisão do tutor: ok, o tutor não é tocado.
Autonomia declarada e visível: sim, sem alteração. Nenhum agente foi criado ou mudado, e `docs/regulacao.md` não foi alterado.

Quanto ao item 9 (D45, regra 70 item 8): a ação nova não forma indicador, ranking nem métrica do professor. É um ato administrativo sobre o acesso dele. O registro não leva e-mail, id de conta, `antes` nem `depois`. No arquivo do professor (D85) ele aparece só com o papel "coordenação", sem o autor, e não aparece no arquivo de outro professor. Isso está provado em `apps/api/test/arquivo-do-titular.int.test.ts`, no caso "D85: usuario.email_corrigido (18.0)…". A conversa do professor com o chat não é alcançada.

Bloqueantes: nenhum.

Recomendações:
- Para a 19.0 (a tela): o estado do convite ("pendente", "vencido", "nunca entrou") é dado de acesso à conta, não de adoção da ferramenta. Ele não deve virar contagem nem destaque de "professor que não usa", nem servir de filtro com esse sentido (D64, regra 70 item 9). Vale escrever a frase da tela sobre a conta e o convite, nunca sobre o uso da IA.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/architecture.test.ts:423`, `usuario.email_corrigido` entrou na lista `COORDENACAO_OPERACAO_E_ROTINA`, e está certo. Para quem ler depois, o comentário do bloco poderia citar a 18.0 ao lado da 10.0, como já faz com as outras ações.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.controller.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/auditoria/acoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/auditoria/acoes-por-alvo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0048_auditoria_por_alvo_email.sql`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/permissao/matriz.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-10 14:43:24 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido

Bloqueantes: nenhum

O que conferi:
- **Escopo.** Não há tela, nem troca de e-mail de quem já entrou, nem escrita em `conta.email`.
- **Ordem dos seis passos da §5.** Foi seguida em `convite-de-professor.service.ts:112-128`.
- **O `update` do passo 4.** Tem as quatro condições, com a escola tirada do contexto.
- **Conta do e-mail novo.** É tratada igual ao `convidarProfessor` (`normalizarEmail` + `contaDoProfessor`).
- **Divergência dos 7 dias contra 72 h.** Está registrada na `techspec.md` §5, passo (5), e no `cenarios.md`, não só no `18_task.md`.
- **Lista por alvo.** A ação entra na lista e o papel sai "coordenação" pelo `else` da leitura por alvo. A migration cria o índice novo antes de apagar o antigo e depois o renomeia, então continua compatível com o código anterior.

Recomendações:
1. **Comentários velhos na leitura por alvo.** O arquivo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/titular/leitura-do-titular.ts:427-429` continua dizendo "lista fechada de seis ações". Diz também que o papel é fixo "nas ações da planilha de alunos", mas agora a `usuario.email_corrigido` também cai no `else 'coordenação'`. A tarefa listava esse arquivo como alterado e ele não foi tocado. Atualizar os dois comentários.
2. **Comentários longos demais.** Os de `corrigirEmailDoProfessor`, `trocarContaDoProfessor` e do controller repetem a §5 quase inteira. Quando a spec mudar, essas cópias ficam velhas, como já aconteceu no item 1. Basta apontar a seção da techspec e deixar só o porquê que não está nela, como o motivo de não haver `catch` no 23505.
3. **Validação duplicada.** A matriz `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` é idêntica à do refazer, e o `if` do passo (1) é mutante equivalente, como a própria tarefa admite. Manter faz sentido porque a 19.0 lê a matriz. Mas o comentário em `packages/shared/src/professores/professores.ts:591-595` poderia dizer que ela tem de ficar igual à do refazer e que um teste de unidade prova isso, para as duas não divergirem sem ninguém notar.
4. **Trava de escrita na migration** (`0048_auditoria_por_alvo_email.sql`). O índice é criado sem `CONCURRENTLY` e trava a escrita na `auditoria` enquanto é construído. Em produção, com a auditoria grande, isso pesa no deploy fora do horário letivo. Fica para o `infra-guardian` decidir se o `0048` precisa de nota no runbook.

Arquivos centrais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0048_auditoria_por_alvo_email.sql`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 14:43:43 · `tasks/prd-acesso-e-convites/18_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0048_auditoria_por_alvo_email.sql:1 cria o índice de novo sem `CONCURRENTLY` sobre a `auditoria`, a tabela que mais cresce. Enquanto o índice é montado, toda gravação de auditoria de todas as escolas fica travada. Isso cabe na exceção da Tech Spec do F3, seção 7c (vale até haver staging ou piloto), e repete o que a 0046 já fazia. Falta citar a 0048 ao lado da 0046 na pendência "antes do staging" em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md:2826. Com volume real, o `statement_timeout` de 2 s do `migrar` pode derrubar o deploy.
- Na tabela "Recomendações sem aplicar" de /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/18_task.md, vale deixar escrito que a rota não ganhou cota própria por decisão da spec (§5: "Sem cota própria, como o cadastro e o refazer"). Ela fica só com o limite global por `sub` e `esc` do `RateLimitGuard`.
```

O que conferi:
- **Rate limit:** a rota passa pelo `RateLimitGuard` global, que conta pelo `sub` e pelo `esc` do token, nunca por IP.
- **Request:** nada demorado dentro dele. A correção não envia e-mail; o envio continua sendo o `convites/enviar`.
- **Concorrência:**
  - Tudo roda sob a trava do convite da escola (`professorSobATrava`), e o `update` é condicional.
  - O e-mail que já é de outro professor da escola cai no `usuario_escola_conta_papel_unico` (23505) e vira `CONFLITO`.
  - A conta do e-mail novo é achada ou criada por `insert ... on conflict do nothing` mais `for no key update`.
  - O envio que está saindo naquele instante não sobrescreve o `cancelado`.
  - Há teste das três corridas: correção × aceite nas duas ordens, duas correções juntas e correção × "Enviar".
- **Índice:**
  - A consulta `jaEntrou` usa o `convite_escola_usuario_idx`.
  - O índice novo começa pela escola, e o `EXPLAIN` que o comprova está nos testes.
  - O código anterior continua coberto pelo índice de sete, porque a lista de seis está dentro dele.
- **Migration:** não tem `ALTER` de coluna, rename de coluna nem `NOT NULL`.
- **Teste:** nenhum chama provedor pago. Rodei `professores-corrigir-email.int.test.ts` e `auditoria-por-alvo.int.test.ts`, e os 24 casos passaram.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 14:43:49 · `tasks/prd-acesso-e-convites/18_task.md`

**VEREDITO: APROVADO**

Não rodei a suíte; o veredito vem da leitura do diff, do teste novo e do código que ele chama.

```
VEREDITO: APROVADO
Campos pessoais tocados: o e-mail de login da conta global (conta.email) e o elo usuario.conta_id do
  professor. A rota só lê o e-mail; a conta antiga não é alterada.
Fora da tabela de dados do docs/lgpd.md: nenhum. A linha "E-mail de login na conta global" já cobre o
  campo, com retenção "enquanto houver usuario ativo ou convite válido". A conta antiga solta pela
  correção cai nessa retenção pela limpeza da madrugada, e o teste prova isso.
Autorização por objeto: ok
Logs: limpos
Auditoria: presente
Envio externo: nenhum. Não há IA. O e-mail sai só pelo "Enviar" que já existia, ao endereço novo.
Seed/fixture: sintético
Bloqueantes: nenhum
Recomendações: abaixo
```

**Autorização por objeto: ok.** O escopo vem do contexto da sessão em todos os passos: `professorSobATrava`, `jaEntrou` (`convite.repository.ts:153`) e `trocarContaDoProfessor` (`convite.repository.ts:168`, com escola, id, papel professor, usuário ainda inativo e conta diferente).
- O teste de troca de id cobre o id da outra escola, o de aluno, o de coordenador, o inexistente e o que não é UUID. Todos respondem o mesmo `NAO_ENCONTRADO`, sem conta criada e sem update (`professores-corrigir-email.int.test.ts:450`).
- O mesmo vale no nível do repository (`:469`).
- Professor e aluno também recebem o `NAO_ENCONTRADO` (`:434`), e a matriz dá `unidade` só à coordenação.

**Coleta e DTO de saída**
- O corpo de entrada é estrito: `escolaId` ou `contaId` a mais viram `ENTRADA_INVALIDA` (`professores.ts:559`).
- A saída passa pelo `conviteDeProfessorResponseSchema.parse`, o mesmo do refazer, com `no-store`.
- A resposta não diz se o e-mail já tinha conta em outra escola: o corpo não leva nem o e-mail nem o id da conta (`:414`).

**Logs**
- A rota não loga nada novo. O filtro global loga só tipo, SQLSTATE e constraint, sem mensagem, `detail` ou parâmetros (`summarize-error.ts`).
- O teste do log confere que não aparecem o e-mail velho, o novo nem o token (`:558`).

**Auditoria**
- `usuario.email_corrigido` tem `antes`, `depois` e `finalidade` nulos, sem e-mail nem `conta_id` (`acoes.ts:322`). Fica junto com o `convite.refeito`, autora a coordenação, e o teste varre a auditoria inteira atrás de e-mail, conta e token (`:521`).
- O ato entra na lista D85, e o índice parcial foi recriado com as sete ações.
- A ação foi incluída na lista de `architecture.test.ts`, de modo que professor e aluno não podem assiná-la.

**Ciclo de vida**
- O envio antigo `na_fila` ou `enviando` termina `cancelado`, com token e destino cifrados apagados, e o link antigo deixa de valer (`:274`).
- O "Enviar" seguinte decifra para o e-mail novo (`:298`).
- A conta antiga sem usuário é esvaziada pela limpeza da madrugada; a que tem usuário ativo em outra escola fica intacta (`:340`).

**Fixtures:** todas sintéticas: endereços `@escola.invalid`, "Professor sintético", hashes sorteados.

**Pergunta de fechamento:** o código responde. O arquivo do professor traz o ato `usuario.email_corrigido` com o papel "coordenação" e sem o autor (`arquivo-do-titular.int.test.ts`, caso D85 novo, e `:544`). O e-mail atual continua na conta, como antes. O endereço errado não é guardado como histórico, o que é minimização e não lacuna.

**Recomendações (nenhuma bloqueia)**
1. Hoje o teste de log cobre o `CONFLITO` do estado `revogado`, mas não o do 23505 (e-mail que já é de outro professor da escola). A proteção já existe no `summarizeError`; vale estender o caso `log novo` (`:558`) a esse caminho para fixá-la.
2. Fica para o `infra-guardian`: `0048_auditoria_por_alvo_email.sql` usa `CREATE INDEX` sem `CONCURRENTLY` numa tabela que cresce com tudo o que a escola faz, e isso trava a escrita na auditoria enquanto o índice é construído. Não afeta a regra 20.
3. A linha do e-mail de login em `docs/lgpd.md` (linha 65) poderia citar a correção como mais um caminho pelo qual a conta antiga fica sem usuário e vai para a limpeza. Isso deixa o mapa de dados completo para quem lê só o documento.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.controller.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0048_auditoria_por_alvo_email.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-10 14:44:42 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Cenários exigidos: as 22 linhas da tabela de testes da 18_task.md e os itens de "Corrigir o e-mail", "Corridas" e "Auditoria (RF17)" do cenarios.md. O e2e [E] é da 19.0. Na conta do agente:
- caminho feliz: professor `pendente` com envio `falhou`, vínculo e aula da grade
- token antigo recusado e token novo aceito
- envio antigo `na_fila` e `enviando` terminando `cancelado`
- "Enviar" depois, com o destino decifrado e 1 ponto da cota
- conta antiga intacta, limpa de madrugada quando ninguém a segura, e não limpa quando há usuário na outra escola
- `vencido` com os 7 dias contados do relógio falso
- os quatro estados fora (`revogado`, `aceito`, `ativo`, `desativado`)
- quem já entrou
- e-mail de outro professor em três estados
- o mesmo e-mail em outra caixa
- E11
- permissão
- isolamento, incluindo o do repository
- entrada inválida
- auditoria
- arquivo do professor, real e plantado
- índice com sete ações
- matriz
- correção × aceite nas duas ordens
- duas correções simultâneas
- correção × "Enviar" nas duas ordens
- log sem e-mail

Cobertos: todos. Cada linha da tabela tem o seu `it` com o nome citado, e o arquivo novo roda verde isolado (22 de 22 em `npx vitest run --project integracao apps/api/test/professores-corrigir-email.int.test.ts`). O que conferi além disso:

- **Mutações contra o `git diff`:** toda cláusula nova com condição tem bloco que a alcança ou motivo escrito:
  - O `jaEntrou` tem bloco para `usadoEm`, `usuarioId` e `escolaId`; o `tipo` é equivalente pelo motivo 2.
  - O `trocarContaDoProfessor` tem bloco para cada um dos cinco termos do `where`.
  - O `if (!trocou)` tem bloco, e as chaves `pendente` e `vencido` da matriz também.
  - O `if` do passo (1) é mutante equivalente pelo motivo 1. Refiz o caminho: o `revogado` cai no `refazerSobATrava`, o `aceito` e o `desativado` no `jaEntrou`, o `ativo` no `desativado_em`.
- **Cada bloco fica vermelho pelo motivo certo.** Por exemplo, sem o `usuario.id` no `where`, o "envio antigo" leva os dois professores à mesma conta e cai no 23505.
- **O que não tem condição também está coberto:**
  - `@RequirePermissao`: o caso "permissão" recebe 201 se a anotação sai.
  - `no-store`: conferido no caminho feliz.
  - `IdPipe`: o `nao-e-uuid` responde `NAO_ENCONTRADO`.
  - Esquema estrito: o caso "entrada".
  - A ação nova na lista por alvo: o arquivo real e o plantado.
- **As asserções são sobre o resultado:** `retrato` da escola antes e depois, `conta_id`, `totalDeContas`, destino e token decifrados, linhas exatas da auditoria e do arquivo. Nada se apoia só no status.
- **Sem `.skip`, sem teste comentado, sem mock:** a API, o Postgres e o Redis são os reais do compose de teste. A tarefa não envolve IA.
- **Concorrência de verdade:** "duas correções" usa `Promise.all` e também `emOrdemNaTrava`, que deixa as duas requisições esperando na trava. Correção × aceite e correção × "Enviar" usam `emOrdemNaTrava` nas duas ordens.
- **Prazo sem depender de carga:** a validade do `vencido` é provada com o relógio deslocado 30 dias.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/test/professores-corrigir-email.int.test.ts:357`: "estados fora" percorre os quatro estados num laço dentro de um só `it`, e o cenarios.md pede "um caso por estado". Com `it.each`, o portão mostraria todos os estados que falharem, e não só o primeiro.
2. `apps/api/test/professores-corrigir-email.int.test.ts:388`: o nome do caso diz que "a conta que o passo (3) criou não fica", mas o e-mail de outro professor já tem conta. O passo (3) só a acha e não cria nada, então `totalDeContas` igual não prova desfazer nada aqui. Quem prova que a transação desfaz a conta criada é o `revogado` de "estados fora" (`contasComEmail(certo)` vazio). Sugiro tirar a afirmação do nome ou apontar para o caso que a prova.
3. `apps/api/test/professores-corrigir-email.int.test.ts:274`: o cenarios.md fala em "zero envios" e em `enviando` com um SMTP falso numa barreira. O teste simula o `enviando` com um `update` e confere `cancelado`, cifrados nulos e link inválido, que é o que a linha da tabela pede. O lado do worker (só grava `enviado` com a própria reserva) já tem teste no `cancelar-envio` e no `convites-enviar.int.test.ts`. Fica registrado para a validação.
4. O cenário "Enviar depois" diz "o corpo capturado pelo falso", e o teste decifra o `destino_cifrado` em vez disso. É o caminho que o "Como testar" da tarefa manda seguir, então o problema é só de texto: alinhar o cenarios.md.
5. `tasks/prd-acesso-e-convites/18_task.md:33`: "Arquivos previstos" lista `leitura-do-titular.ts` como alterado, e ele não mudou, porque lê a constante de `acoes-por-alvo.ts`. Basta corrigir a tabela.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/arquivo-do-titular.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/db/schema/auditoria-por-alvo.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/permissao/matriz.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/18_task.md`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-10 14:56:01 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. A migration 0048 e o schema de `auditoria` não mudaram desde a 1ª rodada.

Queries verificadas: no diff, as mudanças em `ConviteRepository.jaEntrou`, `ConviteRepository.trocarContaDoProfessor`, `corrigirEmailDoProfessor`, `ProfessoresController` (rota `:usuarioId/email`) e na leitura por alvo de `leitura-do-titular.ts` são só de comentário. As consultas, os filtros por escola do contexto e a assinatura dos métodos são os mesmos da rodada aprovada. Nenhum parâmetro de escola entrou vindo do cliente.

Teste de isolamento: presente e efetivo. O que mudou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts`:
- O caso "estados fora" virou `it.each`, com uma escola semeada por estado. A auditoria vazia é conferida em cada um, o que deixa o caso mais forte que o laço antigo, que só a conferia no fim.
- O teste de log ganhou o caminho do 23505 e proíbe no log os e-mails `dono` e `aoLado`.
- O E11 (conta de outra escola) e a limpeza com usuário de outra escola não mudaram.

Correções exigidas na rodada anterior: nenhuma. A recomendação de tenancy da 1ª rodada (e-mail de coordenador da mesma escola) está registrada no `TODO.md`, com a 19.0 como dona, e na tabela de recomendações de `18_task.md`.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts:386`: o parêntese do título está errado. Ele diz que "a conta criada que a transação desfaz é a do `revogado` de 'estados fora'". No `revogado` o passo (1) recusa antes do passo (3), então nenhuma conta é criada, e o caso prova que nenhuma conta nasce antes de o escopo passar, não o desfazer da transação. No caminho do 23505 a conta do `dono` já existe, então também não há conta criada para desfazer. Trocar o texto do título. O desfazer de uma conta recém-criada segue sem caso próprio.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts:146`: o comentário reconhece que nenhum teste compara `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` com `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO`. Um teste de unidade com `toEqual` entre as duas é barato e tira a dependência da disciplina.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-10 14:56:10 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A rota de coordenação já foi auditada na 1ª rodada. Este diff só mexe em comentários, num teste de integração, no `TODO.md` e nos documentos da tarefa.
Rate limit: ok. A rota fica no limite global por `sub` e `esc` do `RateLimitGuard`, como a Tech Spec define na seção 5. Não há limite por IP.
Fila e prioridade: ok. Nada novo entra na fila e nada demorado entra no request.
Concorrência: protegida. O diff não toca o `update` condicional de `trocarContaDoProfessor` nem a trava do convite. Ganhou uma prova no teste de log: o 23505 do `usuario_escola_conta_papel_unico` agora é exercitado e responde 409.
Índice e paginação: ok. Não há query nova. O `TODO.md` "antes do staging" agora cita a 0046 e a 0048 para o `CREATE INDEX` sem `CONCURRENTLY` em `auditoria`, que era a recomendação da 1ª rodada.
Degradação de IA: não se aplica
Migration: compatível. A 0048 não mudou nesta rodada.
Métrica e alerta: ok. Não há código novo no caminho quente nem alerta novo.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts:386`: o nome do caso diz que "a conta criada que a transação desfaz é a do `revogado` de 'estados fora'". Isso descreve outro caso, e o `revogado` de "estados fora" para antes do passo (3), então nenhuma conta chega a ser criada ali. O que esta asserção prova é o rollback da conta criada no passo (3) quando o 23505 estoura: o `totalDeContas()` fica igual ao de antes. Vale reescrever o nome para dizer isso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts:146`: o comentário admite que nenhum teste compara `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` com `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO`. Um teste de unidade de uma linha (`toEqual`) troca a promessa por uma guarda. Fica para quem mexer em uma das duas.
- A ligação do e-mail de um coordenador da mesma escola como professor segue registrada no `TODO.md`, com a 19.0 como dona. Não é questão de carga e não vaza entre escolas.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-10 14:56:31 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa nem neste diff. A 18.0 só faz o "Corrigir o e-mail" do professor, que troca o `conta_id` do `usuario`, refaz o convite e grava a auditoria. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA passa por este fluxo. A exceção do tutor (D47) não é usada.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado ou alterado.
Bloqueantes: nenhum

Esta rodada cobriu só o diff de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-18-r1-para-r2.patch`, porque a rodada anterior aprovou sem correção exigida.

- **Comentários encurtados.** Em `professores.controller.ts`, `convite-de-professor.service.ts`, `convite.repository.ts` e `professores.ts`, os comentários agora remetem à Tech Spec, seção 5. Nada muda no comportamento e nada toca nota, IA, aluno ou indicador de professor.
- **Comentário em `leitura-do-titular.ts`.** Passa de "seis" para "sete" ações, e o papel da coordenação fica fixo para `usuario.email_corrigido`. O titular continua vendo o ato sem o autor (D85). Não é métrica sobre o professor.
- **`architecture.test.ts`.** `usuario.email_corrigido` foi justificada no comentário como ação que só a coordenação assina. A lista em si não mudou desde a rodada 1.
- **`professores-corrigir-email.int.test.ts`.** O laço virou `it.each`, e o teste de log ganhou o caso do 23505, também sem e-mail no log. Não envolve regra 70.
- **`TODO.md` e `18_task.md`.** A recomendação que fiz na rodada 1 está registrada: a tela da 19.0 não pode virar contagem nem destaque de "professor que não usa" (D64, regra 70, item 9), e o destino dela é a tarefa 19.0.
- **`cenarios.md`.** Só mudou a redação de um cenário de envio.

Itens 7 e 9 (vigilância e medição do professor): o diff não cria rastro de uso, ranking nem indicador sobre o professor. A auditoria da correção é ato administrativo da coordenação sobre a conta, sem ligação com o uso da IA.

Recomendações:
- **Na 19.0, a mesma de antes.** A tela do "Corrigir o e-mail" fala de conta e convite. Ela não mostra estado de uso da IA nem lista professores "que não entraram" como indicador de adoção. Hoje a recomendação só está registrada na tabela da tarefa e precisa entrar no texto da 19.0.
- **Na 19.0, o coordenador da mesma escola.** O item do `TODO.md` sobre o e-mail de um coordenador ganhar uma linha de professor é assunto de identidade e tenancy, não de regra 70. Se for resolvido na 19.0, a resposta deve continuar sem revelar quem é dono do e-mail (E11).

## revisor-geral · 2ª rodada · APROVADO · 2026-11-10 14:56:37 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Os comentários encurtados no controller, no service e no repository apontam para a seção 5 da `techspec.md`, "Corrigir o e-mail" (linha 145), e não mudam comportamento. O cenário "Enviar depois" do `cenarios.md` agora descreve o que o teste faz.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum.

As dez recomendações da ordem `.processo/ordens/18_task-r1.md` foram aplicadas:
- Os comentários de seis para sete ações e do papel fixo da coordenação.
- O comentário da matriz já não afirma um teste que não existe. Confirmei por grep que nenhum teste compara as duas matrizes.
- O `architecture.test.ts` agora cita a 18.0.
- O caso "estados fora" virou `it.each` e continua conferindo a auditoria vazia.
- O nome do caso "e-mail de outro professor" foi trocado.
- O caso "log novo" agora cobre o 23505, com `dono` e `aoLado`.
- O `cenarios.md` foi alinhado.
- O `TODO.md` cita a 0048 e registra o item do coordenador, com a 19.0 como dona.
- A tabela "Recomendações sem aplicar" foi preenchida.

Recomendações:
1. O novo nome do caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts:386` diz que "a conta criada que a transação desfaz é a do `revogado` de 'estados fora'". Com o código como está, o `revogado` para no passo (1), pela matriz, e não chega a criar conta; o próprio motivo 1 das Mutações do `18_task.md`, linha 95, diz isso. O `contasComEmail(certo)` vazio só prova que a transação desfaz a conta sob o mutante sem o `if`. Hoje nenhum caminho real cria conta e depois a desfaz. Convém tirar a afirmação do nome em vez de apontar para outro caso.
2. O documento da tarefa ficou contraditório com o nome novo do caso. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/18_task.md:51`, a coluna do que o teste prova ainda diz "conta desfeita". Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/18_task.md:98`, o motivo 4 ainda diz que o caso "e-mail de outro professor da escola" prova "a conta desfeita pela rota". As duas linhas devem dizer só "`CONFLITO`, nada gravado, sem conta nova".

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 14:56:46 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada, que foi aprovada: caminho feliz, token, envio antigo, "Enviar" depois, conta antiga, `vencido`, estados fora, quem já entrou, e-mail de outro professor, mesmo e-mail, E11, permissão, isolamento, entrada, auditoria, arquivo do professor, índice, matriz, as corridas (correção × aceite, duas correções, correção × "Enviar") e log novo. Nesta rodada conferi o diff da r1 para a r2 e o que ele toca.

Cobertos:
- **Item 4, "estados fora":** virou `it.each`, com um caso por estado. Cada caso cria a própria escola, então a verificação de que não houve auditoria (`auditoriaDe(escolaId, …)`) continua valendo para cada estado e não se mistura entre eles. As quatro asserções sobre o que não pode ser gravado continuam lá (retrato, `contasComEmail`, `contaDe`, auditoria).
- **Item 5:** o nome do caso "e-mail de outro professor" já não afirma que desfaz uma conta criada, e aponta o `revogado` de "estados fora" como o caso que prova isso. O conteúdo do teste não mudou.
- **Item 6, "log novo":** agora passa pelo caminho do erro 23505. O `aoLado` está `pendente` e nunca entrou, então passa pelos passos 1 a 3; o passo 3 acha a conta do `dono`, e a troca de conta bate no `usuario_escola_conta_papel_unico`. O teste verifica o 409 e que os e-mails do `dono` e do `aoLado` não aparecem no log. Isso fixa a regra 20, item 9, no caminho em que o banco devolve a constraint.
- **Itens 1, 2, 3, 7, 8, 9 e 10:** só mudaram comentários e documentos. Nenhuma condição de código mudou, então nenhum bloco de mutação novo é exigido. O comentário da matriz agora diz que nenhum teste compara as duas matrizes, como a ordem pedia, e não afirma um teste que não existe.
- Rodei `npx vitest run --project integracao apps/api/test/professores-corrigir-email.int.test.ts`: os 25 casos passaram. Não há `.skip`, teste comentado nem mock da regra.

Bloqueantes: nenhum.

Recomendações:
- `tasks/prd-acesso-e-convites/18_task.md:49`: a coluna "Caso" ainda cita "estados fora: `revogado`, `aceito`, `ativo` e `desativado`…". Com o `it.each`, os nomes ficaram "estados fora: `<estado>` responde CONFLITO…", então a citação literal não casa mais com nenhum dos quatro. Basta escrever "estados fora: `%s` responde CONFLITO… (it.each, quatro estados)".
- `tasks/prd-acesso-e-convites/18_task.md:51`: o "O que prova" ainda diz "conta desfeita", mas o nome do teste agora diz que quem prova isso é o `revogado` de "estados fora". Basta trocar por "sem conta nova" e apontar para a linha 49.
- `tasks/prd-acesso-e-convites/18_task.md:98`: o motivo 4 diz que o caso "e-mail de outro professor da escola" prova "a conta desfeita". É o mesmo ajuste de texto: aqui o teste prova que não nasce conta nova.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-10 14:57:07 · `tasks/prd-acesso-e-convites/18_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Na 1ª não houve correção exigida, então auditei só o diff da r1 para a r2 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-18-r1-para-r2.patch`). Ele traz comentários, dois testes de integração reescritos, o `TODO.md`, o `cenarios.md` e o documento da tarefa. Nenhuma linha de código que roda mudou.

Campos pessoais tocados: nenhum novo nesta rodada. O e-mail de login na conta global já tinha sido auditado na 1ª, e a linha dele em `docs/lgpd.md` cita a correção.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok, sem mudança. O escopo e o estado continuam sob a trava, antes de qualquer conta nascer. Os comentários novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts` e de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts` agora só apontam para a Tech Spec, seção 5, sem mudar a regra.
Logs: limpos. A rodada deixou o teste de log mais forte, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts:557-570`. Ele agora cobre também o 409 que vem do 23505 do `usuario_escola_conta_papel_unico` e confere que nenhum dos cinco e-mails nem o token aparece no log. Essa era a saída de erro que ainda não tinha teste próprio.
Auditoria: presente. `usuario.email_corrigido` continua sem e-mail, sem id de conta e sem `antes` ou `depois`. O comentário do `architecture.test.ts` agora explica por que a ação está entre as que só a coordenação assina. O comentário de `leitura-do-titular.ts` passou a dizer sete ações e que o papel é fixo, "coordenação", sem o autor (D85).
Envio externo: nenhum, não há IA nesta tarefa.
Seed/fixture: sintético. Os e-mails dos testes são sorteados em `@escola.invalid`.
Bloqueantes: nenhum.

Rodei `npx vitest run --project integracao apps/api/test/professores-corrigir-email.int.test.ts` pela raiz e os 25 testes passaram, inclusive os quatro casos do `it.each` e o caso novo do log. Antes rodei o mesmo arquivo de dentro de `apps/api`, e ali 22 dos 25 falharam com 404 ou estouro de tempo. Isso não é regressão: fora do projeto `integracao` o ambiente de teste não sobe.

Recomendações:
- O título do teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/professores-corrigir-email.int.test.ts:386` confunde. Ali o e-mail já tem conta, então o passo (3) não cria nenhuma, e o teste prova só que o total de contas não muda. A frase entre parênteses fala de outro teste. Basta dizer "sem gravar nada e sem conta nova".
- O caso do e-mail de um coordenador da mesma escola já está no `TODO.md`, com dono a 19.0. Do lado da privacidade, a resposta tem de continuar sem confirmar que aquele e-mail é de alguém da escola. Hoje o comportamento não revela isso, e se a 19.0 decidir por `CONFLITO`, o mesmo cuidado vale.
- Comparar `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` com `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO` num teste de unidade, como o próprio comentário reconhece, e trocar o "tem de ficar igual" por uma prova.
