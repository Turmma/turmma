# Achados das revisões — `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-14 12:32:05 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. A correção só lê tabelas que já existem: `material`, `licenca_de_material`, `artefato` e `execucao_agente`.

Queries verificadas:
- `ArtefatoRepository.materiaisForaDoUso` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:150`): filtra `material.escolaId = requireEscolaId()`, que vem do contexto autenticado. Os ids não vêm do cliente: saem do `conteudo` do artefato que o `porId` já achou dentro do escopo.
- `proprioOuComLicencaVigente` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts:176`): a subquery da licença filtra `licencaDeMaterial.escolaId = requireEscolaId()`.
- `ExecucaoDaSessaoRepository.daChave` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ia/execucao.repository.ts:121`): filtra por escola, ano em curso e quem pediu. A chave de outra pessoa não conta como reenvio. Mesmo no reenvio, a execução confere o material de novo antes de chamar o modelo.
- `ArtefatoService.adaptar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts`, linhas 151 a 175): primeiro `porId`, que devolve `NAO_ENCONTRADO` se não acha. Só depois vem a conferência do material. Nenhum `escolaId` chega do corpo ou da query.

Teste de isolamento: presente e efetivo.
- O caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts:765` troca, no `jsonb` de `g`, o id do material pelo de um material de `h` que está em uso.
- Se a cláusula `eq(material.escolaId, ...)` sair, a linha de `h` é achada e não está substituída. A adaptação então segue com `202` em vez de `422`, e o teste quebra.
- O teste também confirma antes que a linha de `h` existe e está em uso, para que o caso não passe por acaso.

Vazamento por resposta: um material de outra escola responde `EDICAO_SUBSTITUIDA`, a mesma resposta de um material cuja linha o expurgo apagou. A resposta não confirma que o material existe em outra escola. As mensagens não citam material, escola nem id.

Outros itens:
- Ids: nada novo; continuam UUID.
- Camada de rede: não é tocada.
- `@Unscoped()`: não aparece.

Bloqueantes: nenhum.

Recomendações:
- O teste de isolamento cobre o escopo de `material`, mas não o da subquery de `licenca_de_material` dentro de `proprioOuComLicencaVigente`. Esse filtro já existia antes desta correção e não se exercita aqui. Vale um caso, na suíte do material, com um material de `g` que aponta para uma licença vigente de `h` e precisa ser tratado como sem licença, se houver como montar isso no teste.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-14 12:32:08 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts:156`: `daChave` faz uma leitura a mais a cada pedido, e o agendador provavelmente já busca a mesma chave. O custo é pequeno, porque a busca usa o índice único `execucao_agente_chave_na_escola_unica` (`escola_id`, `chave_envio`). Se o agendador puder dizer se o pedido é reenvio, essa leitura sai.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts:74-79`: a recusa por `LICENCA_VENCIDA` e por `EDICAO_SUBSTITUIDA` não conta em nenhuma métrica. Não está no caminho quente, mas um contador por código ajudaria a ver, na operação, quantas escolas esbarram em licença vencida.

Por que passou:
- **Rate limit:** `this.limite.contar()` continua antes de tudo, e a recusa nova acontece depois dele.
- **Nada demorado no request:** a conferência antes do `202` é uma consulta curta, pela chave primária de `material` mais `escola_id`, com um `exists` em `licenca_de_material`. Não chama o modelo.
- **Concorrência:** o clique duplo e o reenvio caem na chave única. Se a licença vencer entre o `202` e a execução, a conferência de novo na entrada (`artefato.service.ts:174`) recusa antes de chamar o modelo, e o teste prova isso com `chamadasAoModelo` igual a 0.
- **Teste:** os casos novos usam provedor falso, então nenhum chama provedor pago.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-14 12:32:09 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO

Esta correção não toca dado de pessoa. Ela reduz o que vai ao provedor: o trecho de material com licença vencida ou de edição trocada deixa de ser enviado ao modelo pela adaptação.

Campos pessoais tocados: nenhum. Não há migration nem coluna nova. O código novo `EDICAO_SUBSTITUIDA` e a mensagem dele (`packages/shared/src/errors/messages.ts:25`) são texto fixo, sem dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- `ArtefatoService.adaptar` primeiro busca o artefato com `porId`, no escopo de quem pediu, e devolve `NAO_ENCONTRADO` quando não acha. Só depois confere o material (`apps/api/src/artefato/artefato.service.ts:152-158`). Assim, os dois 422 só aparecem para artefato que a pessoa já alcança, e trocar o id na URL continua dando a mesma resposta do inexistente.
- `materiaisForaDoUso` filtra pela escola do contexto, com `requireEscolaId()` (`apps/api/src/artefato/artefato.repository.ts:264`). O filtro de licença reaproveitado também filtra pela escola (`apps/api/src/material/material.repository.ts:185`).
- Material de outra escola citado no `jsonb` é tratado como se não existisse e recebe a mesma resposta do material que o expurgo apagou (`EDICAO_SUBSTITUIDA`). A resposta não confirma que o material existe em outra escola. Um teste de isolamento prova isso, e ele quebra se a cláusula de escopo sair (`apps/api/src/artefato/artefato.int.test.ts:224-232`).
- O atalho do reenvio (`daChave`) procura a chave só entre as execuções da mesma escola, do ano letivo em curso e da mesma pessoa (`apps/api/src/ia/execucao.repository.ts:121-134`). Ninguém consegue pular a conferência usando a chave de outra pessoa.

Logs: limpos. A tarefa não acrescenta nenhum log. A execução que falha guarda só o código do erro (`erro: 'LICENCA_VENCIDA'`, `resultado: null`).

Auditoria: presente. Nenhuma ação desta tarefa exige auditoria pela regra 20, item 10. A adaptação continua registrada em `ExecucaoAgente`, e a recusa antes do `202` não cria execução, versão nem entrega. O teste confere que as contagens não mudam.

Envio externo: menor que antes. O conteúdo do artefato original, que leva o trecho do material, só vai ao provedor se o material ainda estiver em uso. A conferência roda de novo dentro da execução, antes do envio (`apps/api/src/artefato/artefato.service.ts:173-174`). O teste mostra que, quando a licença vence entre o `202` e a execução, o modelo não é chamado nenhuma vez (`chamadasAoModelo === 0`). Quando há envio, ele continua registrado em `ExecucaoAgente`.

Seed/fixture: sintético. O teste monta escolas com `montarEscolaComAssistente`, usa PDF gerado por `variacaoDoPdf()` e licenças de teste.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/artefato/artefato.service.ts:299` usa `systemClock.agora()` direto em vez do relógio injetado. Não afeta privacidade, mas deixa o "hoje" da recusa fora do controle dos testes. A Tech Spec da 11.0 já usa o `Clock` injetado; vale alinhar.
- Fechamento: a resposta à secretaria sobre o que o sistema guarda e para onde enviou não muda com esta tarefa. Ela continua vindo de `ExecucaoAgente` e do arquivo do titular, e a recusa não deixa registro de pessoa novo.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ia/execucao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/errors/messages.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-14 12:32:11 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não chega a `Nota`, a correção nem a lançamento. Todos com autor humano? Sim, porque nenhum caminho novo foi criado.

Decisão autônoma sobre aluno: ausente. A mudança só recusa uma geração (`LICENCA_VENCIDA` ou `EDICAO_SUBSTITUIDA`) e não decide nada sobre a trajetória de nenhum aluno.

Aprovação registrada: ok. A versão adaptada continua nascendo com entrega pendente, criada na mesma transação da versão (`apps/api/src/artefato/artefato.service.ts`, `aoConcluir`, com `criarDaVersaoAdaptada`). A recusa nova acontece antes disso, nas duas conferências (antes do `202` e na entrada da execução), então não sobra versão nem entrega sem aprovação. Os testes conferem que, na recusa, as contagens de `execucao_agente`, `artefato` e `entrega` ficam iguais, e que o modelo é chamado zero vezes quando a licença vence entre o `202` e a execução (`apps/api/src/artefato/artefato.int.test.ts`, linhas 39 a 72 do diff). A exceção do tutor (D47) não foi estendida a nenhum outro agente.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim, sem mudança. O Assistente de ensino continua gerando a adaptação, e ela continua precisando de aprovação.

Auditoria ("o que a IA gerou, quem aprovou, quando"): sem mudança. Quando a adaptação é recusada, nada foi gerado, e a execução que falha entre o `202` e o modelo fica registrada com `estado: 'falhou'` e `erro: 'LICENCA_VENCIDA'`, sem resultado.

Supervisão não é vigilância, D46/D55 e medir o professor (itens 7, 8 e 9): nada no diff mede comportamento, cria campo de nota em discursiva ou redação, ou cria indicador de professor. Uma recusa por licença vencida não vira contagem por professor.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/artefato/artefato.repository.ts`, no comentário de `materiaisForaDoUso`: o material que a coordenação excluiu (`excluido_em`) não impede a adaptação. Isso é questão de D5 e de licença, não da regra 70, mas vale o `privacy-guardian` ou o Arquiteto confirmar que o material excluído pode continuar indo ao modelo dentro do conteúdo do original.
- `apps/api/src/artefato/artefato.service.ts`, no cálculo de `reenvio`: a checagem olha só se a chave já pertence a uma execução `adaptar_atividade` da mesma pessoa, sem conferir se é o mesmo `artefatoId`. Não abre brecha na regra 70, porque a entrada da execução confere de novo antes do modelo, mas um comentário ou um caso de teste deixaria isso explícito.
- A mensagem de `EDICAO_SUBSTITUIDA` também aparece no caso do isolamento (material de outra escola). Não vaza nada, porque responde o mesmo que o material que o expurgo apagou, mas o texto "Gere a atividade de novo" ficaria mais claro se o Joaquim confirmar que essa é a orientação que ele quer na tela da professora.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/ia/execucao.repository.ts (`daChave`, com escopo de escola, ano e pessoa)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md

## llm-integrator · 1ª rodada · APROVADO · 2026-11-14 12:32:15 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa `adaptarAtividade` segue em `padrao` (`packages/core/src/ia/tasks/adaptar-atividade.ts:66`), que é adequado para reescrever uma atividade estruturada. Não li os arquivos de teste para checar a regra 7 em detalhe, e não rodei a suíte.

Custo estimado por professor/mês: a correção não adiciona chamada de modelo. Ela só remove chamadas, porque a adaptação de atividade com licença vencida ou edição substituída é recusada antes do `202`, ou na entrada da execução, antes do provedor. O custo marginal é de duas consultas simples ao banco por pedido de adaptação. Isso não muda a precificação já estimada para a adaptação.

Prompt versionado: sim, não tocado nesta tarefa.

Validação de schema: sim. A saída continua passando por `conteudoDeAtividadeSchema.safeParse` e `exigirAdaptacaoFiel` (`artefato.service.ts`, `aoConcluir`), com `IA_SAIDA_INVALIDA` como caminho de erro. A entrada da execução também é lida de novo do artefato no alcance, não do corpo do reenvio.

Aprovação humana no caminho: sim. A versão adaptada continua nascendo junto com a entrega `pendente`, na mesma transação. A recusa não grava execução, versão nem entrega, e o teste confere as contagens antes e depois.

Bloqueantes: nenhum.

Pontos conferidos:
- A conferência do material roda em dois pontos. Um é `adaptar` antes do `202`, em `artefato.service.ts:157`, e o outro é `entrada` antes de o texto do material ir ao modelo, em `artefato.service.ts:174`. O teste cobre a licença que vence entre o `202` e a execução: a execução termina `falhou` com `LICENCA_VENCIDA` e `chamadasAoModelo === 0`.
- O reenvio da chave já aceita pula a conferência prévia, mas só quando a chave é da própria pessoa e do ano em curso. `daChave` filtra por `escolaId`, `anoLetivoId` e `solicitadaPor` (`apps/api/src/ia/execucao.repository.ts:121`). O reenvio devolve a execução existente, sem criar outra nem chamar o modelo, então não é desvio de licença.
- `materiaisForaDoUso` aplica `requireEscolaId()` no repository, e o escopo não vem de parâmetro. Id de outra escola conta como "não achado" e cai em `EDICAO_SUBSTITUIDA`, a mesma resposta do expurgo. A cláusula de escopo tem mutação e teste de isolamento próprios, com `g` citando material de `h`.
- Reaproveitar `proprioOuComLicencaVigente` e `diaDeUso` mantém a mesma regra de vigência dos outros leitores de trecho.
- `HTTP_STATUS_BY_CODE`, `ErrorCode`, `MENSAGENS_DE_ERRO`, `docs/mvp-contratos.md` e a Tech Spec (§5 e §11) foram alinhados no mesmo diff.

Recomendações:
1. `artefato.repository.ts`, em `materiaisForaDoUso`: material excluído pela coordenação (`excluido_em`) continua sendo adaptável e seu texto vai ao modelo. A Tech Spec e o próprio doc de correção dizem que isso é intencional ("a decisão é só sobre licença e edição"), e o PRD não o proíbe. Vale o Joaquim confirmar na retro. Se a exclusão significar "a escola não quer mais usar", o comportamento fica inconsistente com o que a geração nova faz.
2. A recusa da edição substituída usa código novo, `EDICAO_SUBSTITUIDA`. É justificado, porque a mensagem de `LICENCA_VENCIDA` seria falsa nesse caso. Convém confirmar que a tela do professor trata o código, ou cai numa mensagem genérica com o texto da API. Vi só os usos em `apps/web` do lado da coordenação.
3. A estimativa por professor/mês da adaptação não está anexada a esta tarefa, mas não é exigida aqui, porque nenhuma chamada nova foi criada. Fica registrado que a estimativa da tarefa original (`adaptar_atividade`, perfil `padrao`) continua valendo.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-14 12:32:29 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `cenarios.md`. A correção mudou a decisão da 9.0 e ajustou a `techspec.md` (§5 e a linha nova na §11), mas o `cenarios.md` ficou com a decisão antiga.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md:135-136`
  - **O que está errado:** o cenário ainda diz "a adaptação parte do artefato que a professora já tem, não lê material e fica fora: ver `techspec.md` §5, 'Como ficou na 9.0'". Agora isso contradiz a Tech Spec e o código. Além disso, nenhum dos três casos novos do `artefato.int.test.ts` está registrado no `cenarios.md`:
    - licença vencida, recusada com `LICENCA_VENCIDA` antes do `202` e de novo na entrada da execução, com o reenvio da chave já aceita devolvendo a mesma execução;
    - edição substituída ou já expurgada, recusada com `EDICAO_SUBSTITUIDA`;
    - isolamento.

    A divergência ficou só no documento da correção e na `techspec.md`.
  - **Correção exigida:**
    - reescrever o parêntese das linhas 135-136 para dizer que a adaptação não busca material, mas confere o que o original cita;
    - acrescentar os três cenários `[I]`, com os códigos e as mutações, na seção "Leitura de página por série (RF7, RF8)" ou junto da linha 122 ("Rascunho que cita material cuja licença venceu"), que hoje só fala da geração nova.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts:76`
  - `diaDeUso(systemClock.agora())` lê o relógio do sistema direto.
  - No resto do projeto, o relógio entra no construtor com `systemClock` como padrão (`trecho-search.ts:60` com `this.relogio`, `analista.service.ts:83`, `aulas.service.ts:22`).
  - Isso cria um segundo jeito de fazer a mesma coisa, e o teste da licença depende de uma data fixa (`vigente_ate = '2026-01-01'`) em vez de controlar o relógio.
  - Sugestão: injetar o `Clock` no `ArtefatoService`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:145-149`
  - O material excluído pela coordenação fica de fora da conferência por escolha declarada. Assim, adaptar um artefato que cita material excluído ainda manda o trecho ao provedor.
  - Vale registrar essa escolha também na §5 da Tech Spec, ou levá-la ao Joaquim, para não reabrir o mesmo achado na próxima validação.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md:59`
  - A linha "--faltando: 6 linhas (9 blocos, 2 motivos)" parece ser saída de ferramenta colada no documento. Conferir se ela deve mesmo ficar no texto.

## test-engineer · 1ª rodada · APROVADO · 2026-11-14 12:33:16 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: com a licença vigente, a atividade de material de terceiro se adapta. A atividade gerada da edição nova também se adapta.
- Borda 1: licença vencida antes do pedido. A resposta é 422 `LICENCA_VENCIDA` e nada é gravado.
- Borda 2: a licença vence entre o 202 e a execução. A execução falha sem chamar o modelo e não grava versão.
- Borda 3: edição substituída. A resposta é 422 `EDICAO_SUBSTITUIDA`. Depois do expurgo da linha, a resposta continua a mesma.
- Borda 4: reenvio da chave já aceita depois que a licença venceu. Volta a mesma execução com 202.
- Permissão: a professora só adapta artefato que alcança. Isso já vinha do `porId` e esta correção não mexe nele.
- Isolamento: o artefato de uma escola cuja citação aponta para material em uso de outra escola não é adaptado.
- Concorrência: o clique duplo em adaptar continua resolvido pela chave de envio já existente. A corrida em que a licença vence com o pedido em curso é o caso da Borda 2.

**Cobertos:** todos os itens acima. Os três testes de "Teste que reproduz" existem com o nome citado, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts`, no describe "a adaptação de artefato cujo material saiu de uso". Rodei `npx vitest run apps/api/src/artefato/artefato.int.test.ts` na raiz do worktree: 33 de 33 passaram.

Na primeira vez rodei de dentro de `apps/api` e dois testes falharam com 500. O motivo é que dali o vitest não carrega o `vitest.config.ts` da raiz, que liga a condição `source`. Sem ela, os pacotes `@educa/core` e `@educa/shared` vêm do `dist` desatualizado, onde o código `EDICAO_SUBSTITUIDA` ainda não existe. O problema era a pasta de onde rodei, não o código.

O que conferi:
- **Mutações:** as cláusulas novas do `git diff` batem com os 9 blocos. Os testes chegam a cada cláusula pelo motivo certo:
  - Sem o escopo da escola, a linha de `h` seria achada e a adaptação seguiria.
  - Sem a conferência na entrada da execução, o modelo seria chamado e o erro seria outro, então o `erro: 'LICENCA_VENCIDA'` com `chamadasAoModelo = 0` pega a falta.
  - A mutação para `'nenhuma'` quebra o reenvio, que passaria a responder 422 em vez de 202.
  - As duas cláusulas que ficaram sem bloco têm motivo aceitável: a guarda da lista vazia e o `coalesce`, que só acerta o tipo.
- **Asserções:** todas olham o resultado (status, código de erro, contagem de execução, artefato e entrega antes e depois, `chamadasAoModelo`). Nenhuma confere só que o código rodou.
- **Sem `.skip`.** O provedor é falso (`comProvedor`), nenhum teste chama provedor pago, e a regra testada não está escondida em mock.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Não há teste para `EDICAO_SUBSTITUIDA` na entrada da execução, quando a edição é trocada entre o 202 e a execução. A função é a mesma do caso da licença, e a mutação da linha já foi provada por ele. Vale um caso curto para fixar o código de erro nesse caminho.
2. Não há caso com dois materiais citados, um em uso e outro fora. Ele fixaria o `some` (`artefato.repository.ts:135`) contra uma troca por `every`.
3. Quando a mesma citação tem as duas falhas (edição substituída e licença vencida), sai `LICENCA_VENCIDA` (`artefato.service.ts:170` vem antes de `:171`). A mensagem manda atualizar a vigência em Licenças, o que não resolve a edição trocada. Além disso, a mensagem foi escrita para a coordenação, e aqui quem a recebe é a professora. O texto de `LICENCA_VENCIDA` nesta rota merece revisão.
4. `exigirMaterialEmUso` usa `systemClock` direto (`artefato.service.ts:169`), e não um `Clock` injetado. Por isso a virada do dia em São Paulo (licença com `vigente_ate` igual a hoje) não pode ser testada nesta rota. Ela continua coberta pelo filtro da 9.0.
5. O doc da correção diz para rodar o teste com `npx vitest run <arquivo>`. Vale dizer que é a partir da raiz: dentro de `apps/api` o resultado é um falso vermelho.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-14 12:43:48 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção que pedi na 1ª rodada foi feita:
- **Parêntese reescrito:** o trecho em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md:136-138` agora diz que a adaptação não busca material, mas confere o que o original cita. Já não contradiz a `techspec.md` §5 nem o `materiaisForaDoUso`.
- **Três cenários `[I]` registrados:** estão nas linhas 123-125, junto do "Rascunho que cita material cuja licença venceu". Cobrem a licença vencida, a edição substituída ou já expurgada e o isolamento, cada um com o código e a mutação.
- **Dois casos novos, também registrados:** a edição trocada entre o `202` e a execução, e os dois materiais citados com só um vencido (`some`, não `every`).

Os dois testes novos de `artefato.int.test.ts:779-823` provam o que dizem:
- Se o `some` virar `every` em `artefato.repository.ts:156`, a adaptação volta `202` e o teste dos dois materiais quebra.
- Se a conferência da entrada da execução sair, o modelo é chamado e o teste da edição trocada quebra.

A escolha de deixar o material excluído fora da conferência foi declarada na `techspec.md` §5, no `cenarios.md` e no documento da correção, e vai ao Joaquim. Não é divergência em silêncio.

Recomendações:
- `tasks/prd-ingestao-do-material/cenarios.md:137`: diz "como nos três cenários da adaptação abaixo", mas os cenários estão acima, na seção de licenças (linhas 123-125). Trocar por "acima, em Licenças" ou citar o nome da correção.
- `tasks/prd-ingestao-do-material/cenarios.md:126`: a linha do material excluído não tem `[I]` nem `[U]`, então fica como comportamento sem teste. Se a escolha se mantiver depois da resposta do Joaquim, falta um caso que adapte um artefato que cita material excluído, para ela não mudar sem ninguém perceber.
- `apps/api/src/artefato/artefato.service.ts:155`: o comentário do `reenvio` ficou longo, com três frases numa linha. A parte da chave não ligada ao `artefatoId` cabe em uma frase só.

## test-engineer · 2ª rodada · APROVADO · 2026-11-14 12:44:39 · `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 2, sobre o diff r1→r2):
- A recomendação 1 da rodada anterior: a edição trocada entre o `202` e a execução falha com `EDICAO_SUBSTITUIDA` na entrada da execução, antes do modelo.
- A recomendação 2: dois materiais citados, um em uso e outro com a licença vencida, e a adaptação é recusada (o `some` vale).
- Os cenários do `cenarios.md` ligados aos testes que os cobrem.

Cobertos:
- **"edição trocada entre o 202 e a execução"** (`apps/api/src/artefato/artefato.int.test.ts:779`). O `antesDeRodar` do `comProvedor` (`:84`) segura o trabalho inteiro, com a `entrada` junto. Por isso a edição nova entra antes da conferência da entrada (`artefato.service.ts:174`). Sem essa conferência, o provedor seria chamado e devolveria `{}`. A execução falharia com `IA_SAIDA_INVALIDA` e o teste ficaria vermelho em `erro: 'EDICAO_SUBSTITUIDA'` e em `chamadasAoModelo === 0`. É o motivo certo. O teste confere o resultado: estado, erro, `resultado: null`, zero chamadas e nenhuma versão nova.
- **"dois materiais citados, um em uso e outro com a licença vencida"** (`:801`). Com a mutação `some` → `every` em `artefato.repository.ts:156`, o material próprio em uso deixa `licencaVencida` falso e `substituido` também falso. A rota devolveria `202` e o teste ficaria vermelho pelo motivo certo. A troca do `materialId` por índice também se protege sozinha: se a atividade tivesse uma questão só, o terceiro não seria citado e o teste já ficaria vermelho sem mutação. As contagens de execução, artefato e entrega antes e depois provam que a recusa não grava nada.
- Os dois blocos novos da seção "Mutações" (11 no total) citam esses testes pelo nome. A mudança de código desde a rodada anterior é só o comentário do `reenvio` (`artefato.service.ts:155`), então não há cláusula nova sem bloco.
- Os três cenários `[I]` novos do `cenarios.md` (linhas 178 a 180) apontam para testes que existem no `describe` da adaptação (`:680`).
- Rodei `npx vitest run apps/api/src/artefato/artefato.int.test.ts`: 35 de 35 verdes, o mesmo número que o documento da correção declara. Não há `.skip`, teste comentado nem mock da regra. O provedor é falso, sem chamada paga.

Bloqueantes: nenhum.

Recomendações:
1. `tasks/prd-ingestao-do-material/cenarios.md:181` registra que o material excluído pela coordenação continua adaptável. A linha não tem marcador de camada e nenhum teste a fixa. Se alguém puser `excluido_em is null` em `materiaisForaDoUso`, nada fica vermelho. Quando o Joaquim responder à pergunta que está em "Recomendações sem aplicar", a resposta deve virar um caso `[I]` com mutação, seja qual for.
2. Continua sem teste a ordem entre os dois códigos: com licença vencida e edição substituída ao mesmo tempo, sai `LICENCA_VENCIDA`. Já está na tabela de recomendações levadas ao Joaquim. Se a ordem for confirmada, vale um caso que a fixe.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md`
