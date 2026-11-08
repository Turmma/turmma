# Achados das revisões — `tasks/prd-acesso-e-convites/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-07 22:57:08 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `convite`. Esta tarefa não cria tabela nova. A mudança no schema (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/db/schema/convite.ts`) só passa `ESTADOS_DO_ENVIO` para o `@educa/shared` e o reexporta. `convite` já tem `escolaId`. Não precisa de `anoLetivoId`, porque o convite é da escola e não varia por período. Os ids são UUID (`uuidv7()`), e o corpo valida `usuarioIds` com `z.uuid()`.

Queries verificadas:
- `ConviteRepository.professoresParaEnvio` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts:806-832`): a escola vem do contexto (`requireEscolaId()`) e entra no `where` das duas consultas, a de `usuario` e a de `convite`. A `conta` entra só por `usuario.conta_id` de um usuário que já passou pelo filtro da escola.
- `revogarParaRefazer`: já existia e já filtra por `escolaId`.
- `criarConvite` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/convite/convite-da-escola.repository.ts`): o `escolaId` vem de `requireEscolaId()`.
- `travarEscola`: a trava é por escola do contexto.
- `ProfessoresRepository.pagina`: só ganhou a coluna `envio`, com o escopo de antes mantido nas duas consultas.
- Cota: `enviarConvitesDeProfessores` usa como chave o `escolaId` de `requireEscolaId()`, nunca o que vem no pedido.
- Contrato: `enviarConvitesRequestSchema` é `strictObject`, então um `escolaId` no corpo é recusado com `ENTRADA_INVALIDA`, e há teste que cobre isso. Nenhuma query string decide escopo.
- Ids de outra escola e ids inexistentes recebem a mesma resposta (`{ quantidade: 0 }`), e o teste compara as duas.
- Sem rede agregada e sem `@Unscoped()` no diff.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts:274`, os `usuarioIds` da escola B são tratados como inexistentes. Se as duas cláusulas `escolaId` de `professoresParaEnvio` forem tiradas, o professor da B entra, o `revogarParaRefazer` com escopo devolve `CONFLITO` e o teste fica vermelho. A mutação correspondente aparece na task como aplicada e vermelha. Em `:367`, a cota da A esgotada não alcança a B. Se a chave da cota deixar de ser por escola, esse teste também quebra. O caso de `:183` mistura estados com um id de outra escola e confere que o convite da B continua copiado e aberto, sem job.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/rate-limit/cota-por-hora.ts`: o mapa `#seguro`, usado quando o Redis está fora, guarda uma entrada por escola e nunca apaga as antigas, nem as de janela vencida. Com até dez escolas o efeito é pequeno, mas vale limpar as entradas vencidas ao consultar.
- `ConviteRepository.professoresParaEnvio` tem a mesma lógica de "último convite" que `ProfessoresRepository.pagina`, nos dois casos com escopo duplo. Vale extrair uma peça só, para que um conserto de escopo numa não deixe a outra para trás.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 22:57:18 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota`, `lancadaPor`, correção nem nenhuma tabela de avaliação. Os únicos dados gravados são `convite` (canal `email`, envio `na_fila`, token e endereço cifrados), `job_registro` pelo `JobOutbox` e a auditoria `convite.enviado`. Todos com autor humano? Não se aplica a Nota. A escrita da tarefa tem como autora a coordenação da sessão, nunca o job (`apps/api/src/sessao/convite/convite-de-professor.service.ts:884`, `packages/core/src/auditoria/acoes.ts:1025`).
Decisão autônoma sobre aluno: ausente. Nenhuma lógica sobre aluno; a tarefa é só convite de professor.
Aprovação registrada: ok. Nenhuma saída de IA entra neste fluxo: o e-mail sai de um template do worker (tarefas 1.0 e 2.0), sem modelo. Nada exige aprovação pela regra 70 item 3, e a exceção da D47 não aparece em lugar nenhum.
Supervisão do tutor: ok. O tutor não é tocado.
Autonomia declarada e visível: sim. Nenhum agente foi criado nem alterado; a declaração de autonomia existente não muda.

Bloqueantes: nenhum.

O que conferi além dos cinco itens acima:
- **Itens 6, 7 e 8:** a busca no diff e nos três arquivos novos por nota, tutor, LLM, ranking e uso não achou nada que tenha a ver com IA. Nenhuma inferência sobre aluno e nenhum campo de discursiva ou redação.
- **Item 9 (D45, D64):** o campo novo `envio` em `GET /v1/professores` (`packages/shared/src/professores/professores.ts:1258`) diz se o e-mail do convite saiu (`na_fila`, `enviando`, `enviado`, `falhou`, `cancelado`). Não mede o uso da ferramenta, não ordena professores e não alimenta nenhuma decisão sobre eles. A lista nominal com o estado do convite já existia (A1) e continua sendo só da coordenação, pela permissão `refazer_convite`.
- **Auditoria:** `convite.enviado` é `strictObject({ tipo, canal })`, sem nome, e-mail nem token. Responde "quem mandou e quando", e o job não grava auditoria.
- **`docs/regulacao.md`:** não mudou nesta tarefa e não precisava mudar.

Recomendações:
- Na tarefa 4.0 (a tela), mostrar `envio` e o estado do convite só como informação operacional de entrega. Nada de contagem, ordenação ou destaque de "professores que não aceitaram" que vire indicador de adoção nominal (D64, regra 70 item 9). Vale também para o texto da tela.
- Na tarefa 4.0, confirmar que o texto do e-mail e da tela não apresenta o convite em nome de uma pessoa da equipe nem com chamada que induza o uso (D58, D59). O botão de recusar ou sair do convite, se houver, não pode exigir mais passos que o de aceitar.

Arquivos que olhei:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/3_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/auditoria/acoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 22:58:29 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO

Nada nesta tarefa vaza dado pessoal, e nenhum bloqueante foi encontrado. Ficam três recomendações, que não impedem o commit.

**Campos pessoais tocados:** o e-mail de login do professor e da coordenação é lido de `conta.email` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts:151`. Ele só vai para a cifra, e com ele o token, nas colunas `convite.token_cifrado` e `convite.destino_cifrado`. A cifra usa o id da linha como dado autenticado. Também mudaram `convite.canal` e `convite.envio`, e há um contador novo por escola (300 por hora) no Redis de fila. Nenhum dado de aluno é tocado.

**Fora da tabela de dados do docs/lgpd.md:** nenhum.
- O envio por e-mail, com os cifrados e a retenção deles, está em `docs/lgpd.md:77`.
- O provedor de e-mail está em `docs/lgpd.md:78`.
- O contador "convites enviados por escola (300 por hora)" está em `docs/lgpd.md:89`.
- Os dois cifrados estão em `COLUNAS_FORA_DO_ARQUIVO` (`packages/shared/src/privacidade/classificacao.ts:162-163`).

**Autorização por objeto:** ok.
- A rota exige `professor.refazer_convite`. Só a coordenação tem essa permissão, com escopo `unidade`; rede, professor e aluno ficam em `nunca`.
- Os `usuarioIds` passam pelo filtro `usuario.escolaId` do contexto, e os convites por `convite.escolaId`.
- Testei a troca de id: um id da escola B devolve `{quantidade: 0}`, a mesma resposta de um id que não existe. Nada vai para a fila, nada é auditado e a cota não é gasta. O teste "isolamento: os `usuarioIds` da escola B…" prova isso.
- A chave da cota usa a escola que vem do contexto, nunca do corpo.
- O professor e o aluno recebem 404 `NAO_ENCONTRADO`, como quem não existe.

**Exposição:**
- O DTO de saída é explícito: `{ quantidade }`, e na lista `envio` é só o enum do estado.
- O link não sai pela resposta do "Enviar".
- A palavra `cifrado` entrou nas chaves proibidas de `apps/api/test/contracts.test.ts:15`.
- O 429 sai como `LIMITE_EXCEDIDO` com `Retry-After`, sem dado no corpo.

**Logs:** limpos. A única linha nova é `convites.cota_no_seguro_em_memoria` (`apps/api/src/professores/professores.module.ts:38`), sem escola e sem pessoa, e no máximo uma a cada 30 s.

**Auditoria:** presente. `convite.enviado` é gravado no pedido, na mesma transação, com a coordenação como autora (`convite-de-professor.service.ts:155`). O `depois` é estrito, só com `tipo` e `canal`, sem nome, e-mail ou token (`packages/core/src/auditoria/acoes.ts`). O teste confere o autor, os campos e que nenhum nome ou endereço sintético aparece. Esta tarefa não tem leitura de dado de aluno nem exportação.

**Envio externo:** nenhum pela API.
- O job `email.enviar-convite` leva só `{ conviteId }` (`convite-de-professor.service.ts:154`).
- O endereço e o token vão cifrados ao worker, que os entrega ao provedor de e-mail. Esse caminho é das tarefas 1.0 e 2.0, já auditadas.
- O rastro fica na própria linha (`canal`, `envio`, `enviadoEm`) e em `convite.enviado`.
- Não há IA, então `ExecucaoAgente` não se aplica.

**Ciclo de vida:**
- O "Copiar link" e o "Reenviar" cancelam o envio aberto e apagam os cifrados pelo `CANCELAR_O_ENVIO_DO_CONVITE`.
- Conferi todos os caminhos que revogam um convite: refazer, revogar e desativar usam esse mesmo `CANCELAR_O_ENVIO_DO_CONVITE`.
- O expurgo de 24 h conta do `criado_em` novo, e o teste confere isso.
- Na ida, o envio passa pela cifra, e na volta, se a transação se desfaz, a cota é devolvida.

**Seed/fixture:** sintético: `@escola.invalid`, "Professor sintético" e uma chave de 32 caracteres que é só de desenvolvimento.

**Pergunta de fechamento:** a tarefa não toca dado de aluno. Para o professor, o que foi enviado e quando fica na linha do convite e em `convite.enviado`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Na tarefa 11.0 (D85, arquivo do titular), a tabela `convite` não entra no arquivo. Hoje o arquivo do professor não diz que o endereço dele foi ao provedor de e-mail. Vale a lista por alvo levar `convite.enviado` (ação, data e o papel "coordenação", sem o autor). Também vale a lista de compartilhamento citar o provedor de e-mail depois que ele entrar em `suboperador`, antes do portão da primeira escola real.
2. Em `apps/api/test/convites-enviar.int.test.ts`, capturar o log da API nos caminhos do 429, da transação desfeita e do seguro em memória, e afirmar que nenhum endereço, token ou nome aparece. Hoje só a auditoria é conferida contra dado pessoal.
3. `packages/core/src/rate-limit/cota-por-hora.ts`: o mapa do seguro em memória nunca apaga as entradas de janelas vencidas. Não vaza nada, porque guarda só o id da escola e números, mas a limpeza deixa o ponto mais claro. O `tenancy-guardian` já registrou o mesmo achado.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 22:58:45 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

O que conferi:
- **Escopo:** as cinco subtarefas estão feitas. A tela não entrou: o `apps/web` só ganhou `envio: null` em três fixtures tipadas.
- **Arquivos fora da tabela "Arquivos previstos":** são `config.ts`, `app.module.ts`, `professores.module.ts`, `email-config.ts`, `compose.yml` e o schema do convite. Dão suporte ao que a seção 1 da Tech Spec já manda ("a API grava token e endereço cifrados"), por isso não contei como invasão de escopo nem como divergência.
- **Seção 5 da Tech Spec ("Enviar"):** a cota de 300/h fica no Redis de fila (o `REDIS_LOGIN_CLIENT` é desse Redis) e consome N pontos num script atômico. A janela é de uma hora e o lote recusado sai inteiro. Os pontos voltam no rollback, só na janela em que foram gastos. Com o Redis fora vale o seguro em memória, pelo `insuranceLimit`, com 300 ÷ instâncias.
- **Auditoria:** `convite.enviado` é gravado no pedido, com a coordenação como autora e sem nome nem e-mail.
- **Peça nova:** a `CotaPorHora` tem motivo. O `WindowCounter` só soma um e não devolve pontos.
- **Regra 00:** o controller não tem regra de negócio, e o contrato estrito está em `packages/shared`. A recusa sai tipada (`LIMITE_EXCEDIDO` com `Retry-After`) e o envio não acontece na requisição.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts:141`: o filtro do lote está numa linha só, com a matriz, o `ultimoConvite` e o `email !== null`. Vale extrair um predicado com nome, como `esperaOConvitePorEmail(lido)`, para a regra "só pendente e vencido, com endereço" ficar legível.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts:142`: o `.default(null)` no `envio` faz o contrato da resposta aceitar a falta do campo. Se a API um dia parar de mandar o `envio`, o `parse` do service não acusa. Uma opção é deixar o campo obrigatório no contrato e ajustar os mocks dos e2e na 4.0.
3. O caso "Enviar e Reenviar sobre convite copiado de 2 dias" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts:536`) não roda o `retencao.expurgar-escola`, como pede o `cenarios.md` (RF11). Ele só confere que o `criado_em` novo é de menos de 60 s. Mesmo assim, a linha 56 da tabela da tarefa afirma "`falhou` só 24 h depois do novo `criadoEm`". A cobertura é do `test-engineer`; fica o registro para a validação.
4. O consumo da cota acontece dentro da transação, com a trava da escola presa. É uma chamada ao Redis com o lock seguro. Hoje está curto e certo, mas se o prazo do cliente Redis de fila aumentar, esse tempo passa a ser tempo de trava.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 22:58:52 · `tasks/prd-acesso-e-convites/3_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
1. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts:147 — o laço faz cerca de 6 idas ao banco por convite: revogar, uuidv7, insert, convite.refeito, outbox e convite.enviado. Com o teto de 300, são perto de 1.800 idas numa transação só, presa à trava da escola (pg_advisory_xact_lock, linha 138) e a uma das 10 conexões do pool. O aceite de convite da mesma escola espera essa trava sob o statement_timeout de 2 s. O caso de 40 professores, o da docs/infra.md 3.5, é curto. Falta medir o lote de 300 contra os 2 s. Se passar perto, gravar em lote: um insert multi-linha de convite, de auditoria e de outbox.
2. A mesma linha 144: a cota é consumida no Redis dentro da transação. Com o Redis lento, mas sem recusar conexão, o pedido segura a trava e a conexão por até LOGIN_REDIS_PRAZO_MS (2 s) antes de cair no seguro em memória. Considerar ler o estado e consumir a cota antes de abrir a transação de escrita, ou um prazo próprio e curto para o EVALSHA da cota.
3. Clique duplo no "Enviar": a trava e o índice convite_pendente_unico garantem um convite aberto e um envio vivo por professor, e o teste [P] prova isso. Mas o segundo pedido refaz todo mundo de novo e gasta a cota em dobro, porque o convite de e-mail na_fila conta como pendente. Avaliar uma chave de idempotência no pedido, ou ignorar o professor cujo último convite é de e-mail, na_fila e de poucos segundos atrás. Também vale desabilitar o botão na 4.0.
4. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/rate-limit/cota-por-hora.ts:116 — o uso do seguro em memória só gera log, limitado a uma linha a cada 30 s. Um contador (por exemplo convites_cota_total{resultado=concedido|recusado|seguro}) deixaria ver o 429 da cota e o Redis fora no painel sem precisar ler log. Não é caminho da manhã de segunda, por isso não bloqueia.
5. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite.repository.ts — o professoresParaEnvio filtra usuario por escola_id e papel = 'professor' pelo índice (escola_id, id). Isso varre todos os usuários da escola, alunos inclusive (cerca de 1.000 linhas). A lista da 3.0 da A1 já fazia o mesmo e está dentro do aceitável. Se a tabela crescer, um índice parcial (escola_id) where papel = 'professor', como o usuario_coordenador_ativo_idx, resolve.
```

## test-engineer · 1ª rodada · REPROVADO · 2026-11-07 23:00:11 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** "Enviar" sem seleção, com pendente e vencido, cria o convite novo `email`/`na_fila` com token e endereço cifrados, um job na fila normal e um `convite.enviado`.
- **Bordas:**
  - seleção mista (os seis estados, um id inexistente, um de outra escola), nunca 409;
  - só quem não espera o convite: zero, sem gastar cota;
  - papel errado e conta limpa;
  - sem corpo e corpo inválido;
  - escola sem ano em curso;
  - convite copiado há 2 dias ("Enviar" e "Reenviar");
  - "Copiar link" depois do "Enviar", com o envio `na_fila` e `enviando`;
  - lista com cada `envio`, inclusive `falhou`.
- **Cota:**
  - conta o que entra, não a seleção;
  - 59 e 61 minutos com relógio falso;
  - lote maior que o que resta;
  - rollback devolve os pontos;
  - Redis de fila fora;
  - NOSCRIPT;
  - entrada inválida.
- **Permissão:** professor, aluno e quem não tem sessão.
- **Isolamento:** `usuarioIds` da B e cota da A esgotada com a B seguindo.
- **Concorrência:** dois lotes de 200 com 300 restantes e dois "Enviar" com o primeiro parado no insert.
- **Auditoria:** um registro, a coordenação como autora, e nenhum registro do job.

**Cobertos:** todos os acima, menos os dois bloqueantes. Rodei `npx vitest run --project integracao apps/api/test/convites-enviar.int.test.ts` e os 26 casos passam.

Conferi a seção "Mutações" contra o `git diff`. Toda cláusula nova com condição tem bloco, e as justificativas dos termos sem bloco se sustentam:
- O `escolaId` do `usuario` e o do `convite` em `professoresParaEnvio` não se distinguem um sem o outro, por causa da FK composta do convite. O bloco que tira os dois fica vermelho.
- O `id === undefined` do `uuidv7()` não é alcançável com o banco de pé.

Os dois testes paralelos são concorrência de verdade, e não chamadas em sequência:
- `Promise.all` no script Lua: um "conferir e depois gastar" em dois comandos deixaria os dois passarem.
- `WriteBlockTrigger` mais `esperarNaTravaDaEscola`: sem a trava da escola, o segundo pedido recebe `CONFLITO`.

Não há `.skip`, teste comentado nem provedor pago.

**Bloqueantes:**

1. **O endereço cifrado nunca é conferido.** O token pode ir para o professor errado.
   - **Onde:** `apps/api/test/convites-enviar.int.test.ts:174-177`, contra `apps/api/src/sessao/convite/convite-de-professor.service.ts:151`.
   - **O que está errado:** o teste só olha `destino: true`, isto é, `destino_cifrado is not null`. Só o token é decifrado. O comentário da linha 176 diz "o endereço é o da conta", mas nada confere isso.
   - **Mutações que passariam verdes:**
     - `destinoCifrado: cifrar(Buffer.from(token, 'utf8'), conviteId)`;
     - o e-mail de outro professor do lote, por exemplo um índice deslocado no `entram`;
     - o e-mail da coordenação.
   - **O risco:** o link de um professor chega à caixa de outra pessoa, que toma a conta dele. É vazamento e é a regra 20, item 8.
   - **Correção:** no caso "Enviar" sem seleção, que já tem dois professores com e-mails sorteados diferentes, decifrar `destino_cifrado` com o id da linha, como o `tokenDoEnvio` faz, e exigir que seja igual a `professor.email` de cada um.

2. **"Nenhum `convite.enviado` do job" não tem teste.**
   - **Onde:** a linha 57 da tabela de testes do documento ("um registro, autora a coordenação, canal, sem nome; nenhum do job") e o `cenarios.md`, RF11: "`convite.enviado` continua um registro só depois de o job rodar".
   - **O que está errado:** o caso citado, `` `convite.enviado`: um registro por convite novo… `` (`apps/api/test/convites-enviar.int.test.ts:493-506`), não roda o job. `apps/worker/test/enviar-email.int.test.ts` não olha a auditoria. Se o processor do worker passar a gravar `convite.enviado`, nada fica vermelho. O item vem depois de um ponto e vírgula e conta sozinho.
   - **Correção (uma das duas):**
     - no teste do worker, depois de um envio `enviado`, exigir zero `convite.enviado` para aquele convite;
     - ou, num teste que rode o "Enviar" e depois o processor de `email.enviar-convite`, exigir que continue exatamente um registro.

**Recomendações:**
- **`instancias` sem teste na montagem.** O seguro de `300 ÷ instâncias` está provado na classe `CotaPorHora`, mas não na montagem. Trocar `instancias: config.limite.instancias` por `1` em `apps/api/src/app.module.ts:100` ou `apps/api/src/professores/professores.module.ts:39` não deixa nada vermelho. O `cenarios.md` fala em "número de instâncias na configuração injetada no teste". Vale um caso que suba a API com `limite.instancias = 3` e o Redis de fila fora, pegue a `CotaPorHora` dela e exija 100 concedido e o 101º recusado.
- **Convite copiado de 2 dias.** O caso prova o `criado_em` novo de forma indireta (`criado_ha_s < 60`), apoiado no teste do expurgo da 1.0. Rodar `retencao.expurgar-escola` logo depois e com mais de 24 h, como pede o `cenarios.md`, fecharia o cenário de ponta a ponta.
- **"Reenviar" sobre o convite copiado.** No teste, o "Reenviar" roda sobre o convite de e-mail recém-criado, não sobre um copiado de 2 dias. O caminho é o mesmo, mas o cenário diz "o mesmo com Reenviar".
- **SQL morta no teste.** `apps/api/test/convites-enviar.int.test.ts:598-601`: a variável `cifrados` só serve para `and ${cifrados.length > 0}`, que é sempre `true`. Pode sair.
- **Relógio compartilhado.** O `relogio` é um só no arquivo e fica +61 min depois do caso das 59/61 min, então os casos seguintes dependem da ordem. Melhor voltar o deslocamento no fim do caso.
- **Título sem asserção.** O título do caso dos 40 pendentes diz "a API não toca no provedor", mas nada no caso confere isso. A garantia vem só da estrutura (a API não tem o envio). Uma guarda de importação garantiria que a API não importa o envio de e-mail, ou o trecho pode sair do título.
- **Log do seguro sem teste.** O aviso limitado `convites.cota_no_seguro_em_memoria`, em `professores.module.ts:38`, não tem teste.
- **"Enviar" e "Copiar link" ao mesmo tempo.** O docblock de `enviarConvitesDeProfessores` promete que os dois se resolvem na ordem, pela trava da escola. Um teste paralelo [P] desse par complementaria o de dois "Enviar".

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/app.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/3_task.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 23:23:47 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO

Esta rodada auditou só o diff desde a 1ª rodada aprovada. Antes conferi que o checkout bate com a árvore auditada (`bf9c1e48`): os arquivos rastreados e os três arquivos novos são iguais a ela. A rodada anterior não exigiu nenhuma correção, então não havia correção a conferir.

Campos pessoais tocados: nenhum campo novo. O diff só passa pelo endereço do professor (`destino_cifrado`), que já existia: um teste novo o decifra e confirma que é o da conta daquele professor (`apps/api/test/convites-enviar.int.test.ts:163-168` e `:193`).

Fora da tabela de dados do docs/lgpd.md: nada novo.

Autorização por objeto: ok, sem mudança. A extração de `quemEsperaOConvitePorEmail` (`apps/api/src/sessao/convite/convite-de-professor.service.ts:118-124`) dá o mesmo resultado que o `flatMap` de antes. Ela continua usando só o que `professoresParaEnvio` lê dentro da transação, com escopo e trava da escola. Nada do corpo do pedido define escopo.

Logs: limpos.
- A linha `convites.cota_no_seguro_em_memoria` (`apps/api/src/professores/professores.module.ts:38`) não leva campo próprio. Ela recebe só o contexto da requisição (`requisicaoId`, `escolaId`, `usuarioId`) do logger (`packages/core/src/log/logger.ts:179-181`).
- O caso novo (`apps/api/test/convites-enviar.int.test.ts:451-478`) fixa as chaves exatas da linha: `escolaId, level, msg, origem, requisicaoId, servico, time, usuarioId`. Não aparece nome, endereço, lote nem contagem.
- O runbook antes dizia "sem escola nem pessoa", o que estava errado. Agora diz "só com os ids da requisição" (`docs/runbook.md:700`), que é o que o código faz. Log com id é o que a regra 20, item 9, pede.

Auditoria: presente. O teste novo do worker (`apps/worker/test/enviar-email.int.test.ts:136-138`) prova que o job não grava `convite.enviado`. Quem fica registrada como autora é a coordenação, no pedido feito pela API, como já estava aprovado na 1ª rodada.

Envio externo: sem mudança. O e-mail sai pelo worker com o endereço cifrado pelo id da linha, e não há envio a provedor de IA nesta tarefa.

Ciclo de vida: o caso reescrito (`apps/api/test/convites-enviar.int.test.ts:609-622`) prova duas coisas:
- As 24 h de um envio parado contam do `criado_em` do convite novo, não do convite copiado de 2 dias atrás.
- Quando o expurgo fecha o envio como `falhou`, ele apaga o token e o endereço cifrados (`cifrado: false, destino: false`). Assim o endereço não fica guardado além do prazo.

Seed/fixture: sintético. Os nomes são "Professor Sintético do Enviar/Reenviar" e os endereços terminam em `@escola.invalid`.

Bloqueantes: nenhum.

Recomendações:
- Em `apps/api/test/convites-enviar.int.test.ts:477`, o teste confere as chaves só da primeira linha do aviso (`linhasDoAviso[0]`). Conferir todas as linhas guardaria melhor contra uma chamada futura que passe dado no aviso.
- No mesmo caso, conferir também que os valores de `escolaId` e `usuarioId` são UUIDs. Isso fecha a porta para alguém pôr outro dado nessas chaves pelo contexto.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.module.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/log/logger.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 23:24:05 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts`, caso das "3 instâncias com o Redis de fila fora": os 101 professores são semeados um por vez, o que deixa a suíte lenta. Um insert em lote resolveria. O caso também confere só a primeira linha do aviso. Vale conferir todas as linhas que trazem `convites.cota_no_seguro_em_memoria`, porque hoje um campo novo entraria sem ser visto a partir da segunda linha.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts:36`: o filtro depende de o TypeScript 6 deduzir sozinho que `undefined` saiu da lista. Escrever o filtro com o tipo declarado (`(p): p is {...} => p !== undefined`) deixa isso explícito e protege contra uma troca de versão do compilador.

O que foi conferido nesta rodada:
- **Filtro do lote:** a regra de quem recebe o convite virou uma função própria e faz o mesmo de antes. Ela continua rodando com a escola travada e antes de gastar a cota, então a corrida e a cota não mudaram.
- **Teste novo da cota sem Redis:** ele prova o limite por escola no seguro em memória (300 ÷ 3 instâncias = 100). O lote de 101 é recusado inteiro, o de 100 passa e o 101º sozinho volta 429. Esse teste não existia na rodada 1.
- **Linha de aviso no log:** só leva os ids da requisição. A frase nova do `docs/runbook.md` agora bate com isso.
- **Teste do worker:** prova que o job não grava `convite.enviado` na auditoria.
- **Typecheck:** passou sem erro no projeto `apps/api` (`tsc --noEmit`). Não rodei os testes de integração.
- **Correções exigidas da rodada 1:** não havia.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 23:24:10 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O diff desta rodada só refatora código e reforça testes. A regra de quem entra no lote não mudou: a matriz `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO`, mais um convite de origem, mais um e-mail na conta. A árvore atual é a mesma que foi auditada (`bf9c1e48`). Comparei também os três arquivos não rastreados, e são idênticos.

O que conferi no diff:
- **Testes da API:** os casos novos de `convites-enviar.int.test.ts` testam regra de negócio. O endereço cifrado é decifrado e comparado com o e-mail do professor. O seguro em memória vale 300 ÷ 3 com o Redis de fila fora: o lote de 101 é recusado, o de 100 passa e o 101º sozinho é recusado. O aviso de log só leva ids. As 24 h do envio parado contam do `criado_em` novo, com o expurgo preso à escola por `runInContext`.
- **Relógio dos testes:** `afterEach(() => relogio.restaurar())` tira a dependência entre casos.
- **Teste do worker:** agora prova que o job não grava `convite.enviado`, o que bate com a autoria da coordenação descrita na Tech Spec.
- **Runbook:** a frase nova ("só com os ids da requisição") está de acordo com as chaves que o teste confere.
- **Código morto:** a variável `cifrados`, que não fazia nada, saiu.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-de-professor.service.ts:148`: o parâmetro do `.filter((pedido) => ...)` esconde o `pedido: EnviarConvitesRequest` da função de fora (linha 139). Ele também dá nome errado ao item, que é um professor que entra no lote e não um pedido. Basta trocar por `(entra) => entra !== undefined` ou `(item) => ...`.
- Mesmo arquivo, linha 119: o ternário de três condições numa linha só é difícil de ler. Retornos antecipados (`if (... !== 'refazer') return undefined`) deixariam a regra mais clara.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 23:24:39 · `tasks/prd-acesso-e-convites/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- O "Enviar" grava no convite novo o endereço da conta daquele professor.
- O job de envio não grava `convite.enviado`.
- Nos casos novos: o seguro em memória com 3 instâncias montado pela API, e o copiado de 2 dias, nos dois casos com o relógio restaurado a cada caso.

**Cobertos:**
1. **Correção 1, feita.** `destinoDoEnvio` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts:164`) decifra `destino_cifrado` com o id da linha, como o worker faz. A linha 192 exige `toBe(professor.email)` para o pendente e para o vencido, que têm endereços sorteados diferentes (`semear`, linha 110). As três mutações que passavam verdes agora ficam vermelhas:
   - cifrar o token no lugar do endereço: tem bloco declarado (linha 455 do documento);
   - o endereço de outro professor do lote: o teste quebra porque os dois endereços são distintos;
   - o endereço da coordenação: também quebra.
2. **Correção 2, feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email.int.test.ts:137-138`, depois de um envio que termina `enviado`, o teste exige zero `convite.enviado` para o convite. A semente entra direto no banco, sem a API, e a escola é nova a cada caso. Um job que gravasse a ação com o id do convite deixaria o teste vermelho. A linha da tabela no documento (linha 57) cita esse teste pelo nome. Não cabe bloco de mutação: é uma ausência, e o diff não mexe no código do worker.
3. **Recomendações da 1ª rodada, aplicadas.**
   - **3 instâncias montadas pela API:** com o Redis de fila fora, o lote de 101 é recusado inteiro, o de 100 passa e o 101º sozinho é recusado. A linha do aviso só leva ids. Tem dois blocos novos, um no `app.module.ts` e outro no `professores.module.ts`.
   - **Copiado de 2 dias:** "Enviar" e "Reenviar" foram separados. `fecharEnviosParados` devolve 0 agora e 2 depois de 25 h. Contar as 24 h a partir do `criado_em` antigo fecharia os envios na hora e daria vermelho.
   - **SQL morta:** o `and ${cifrados.length > 0}` saiu.
   - **Relógio:** o `afterEach` chama `restaurar()`.
   - **Título dos 40 pendentes:** corrigido.
4. **Refatoração do filtro.** `quemEsperaOConvitePorEmail` mantém a mesma condição, e os blocos do documento (linhas 142 a 150) já usam a linha nova.
5. **Execução.** Os testes rodaram da raiz do repositório e ficaram verdes: `convites-enviar.int.test.ts` com 27 casos e `enviar-email.int.test.ts` com 25. Não há `.skip`, não há mock sobre a regra e nenhum teste chama provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email.int.test.ts:137`, tirar o filtro `entidade_id = $2` e contar `convite.enviado` só por `escola_id`. A escola é nova no caso, e assim um job que gravasse a ação com outro `entidadeId` (o do usuário, por exemplo) também ficaria vermelho.
- Declarar no documento um bloco para o endereço de outro professor do lote, por exemplo trocando `email` pelo do vizinho em `entram`. Hoje o teste já pega essa troca porque os endereços são distintos, mas o portão não a prova.
