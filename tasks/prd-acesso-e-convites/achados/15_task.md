# Achados das revisões — `tasks/prd-acesso-e-convites/15_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-09 19:11:11 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas: "Eu" no computador e no celular, na escola cheia e na vazia). As duas escolas da vitrine não têm provedor liberado, então a seção "Conta da escola" não aparece em nenhuma foto. Vi só que o "Eu" em volta não quebrou. Os estados da seção foram avaliados pelo código e pelo spec e2e.

Estados: ok
- **Carregando:** `ContaDaEscola.tsx:47-50` não mostra nada até saber a escola e os provedores. Ao clicar, o botão fica ocupado ("Ligando…") e desabilitado (`:96-97`), com um `status` para leitor de tela (`:100`). O botão "Voltar" do navegador o desocupa (`:66-72`). Isso é coberto no e2e "carregando".
- **Vazio:** a escola sem provedor liberado não mostra a seção (`:50`). O "Eu" segue como antes (fotos "vazia" e o caso e2e "escola sem provedor liberado"). Aqui o vazio é a ausência da seção, e o produto só oferece o botão para quem pode usá-lo.
- **Erro:** a leitura dos provedores que falha mostra `ErrorState` com "Tentar de novo" (`:48`). Os resultados da volta do provedor são `conflito`, `recusada` e `provedor`. Todos são `role="alert"`, trazem o próximo passo e não dizem a quem a conta pertence (`messages.ts`).
- **Com dado:** "Conta da escola ligada" aparece num `status` e o botão some (`:88-93`).

Acessibilidade: ok
- A seção é uma `section` com `aria-labelledby`.
- O resultado vai em `status` ou `alert` conforme o caso.
- O botão usa o `Button` do produto, que tem foco global e é nativo, então funciona por teclado.
- O e2e roda `seriousViolations` (axe) com o aviso na tela.
- O aviso usa `text-erro` e a classe `t-apoio`, que vêm dos tokens.

Chromebook fraco: ok
- Não há lista nem imagem. A consulta dos provedores é a mesma `acessoDaEscolaQueryOptions` da entrada na escola, então é cacheada e não duplica trabalho.
- O estado fica no TanStack Query. O `useState` guarda só o estado do clique e o resultado de uma navegação, o que é legítimo.

Celular: ok
- O botão usa `Button` com `min-h-11 min-w-11` (44 px). O contêiner é `flex-wrap min-w-0`, sem largura fixa.
- O e2e "360 px" confere a ausência de rolagem horizontal, o botão de 44 px e o axe, com o aviso na tela. Ele roda nos dois projetos.
- O e2e "1366 × 768" confere que a página cabe sem rolar com a seção e duas tarefas corrigidas. A linha `Rolam` da vitrine veio vazia.
- Nada depende de hover ou de atalho. Nenhum fluxo exige o celular.
- As fotos 360 px mostram o "Eu" sem corte nem rolagem horizontal. O quarto item da lista fica atrás da barra inferior na foto da escola cheia, mas a página rola normalmente. Isso é do estado anterior da casca e não foi alterado por esta tarefa.

Ação oficial protegida: sim, não se aplica. Ligar a conta é ato do próprio aluno, não decide nota nem decisão sobre aluno. O que ele vai fazer está explícito no título, na frase e no rótulo do botão. A ação é auditada na API (`conta_externa.ligada`).

Pele e termos: ok. O texto está todo em português do Brasil, sem termo técnico nem id na tela. O `?ligacao=` é limpo da barra e da navegação (regra 50, item 7), e o e2e confere que nenhum dado do provedor (e-mail, nome, foto) aparece na tela ou no endereço. A seção usa os tokens (`rounded-cartao`, `border-borda`, `bg-superficie`, `t-apoio`, `text-erro`) e o `Button` existente. `docs/interface.md` foi atualizado nos dois pontos.

Bloqueantes: nenhum

Recomendações (não bloqueiam):
1. `apps/web/src/areas/aluno/ContaDaEscola.tsx:47-50`: enquanto os provedores carregam, a seção não ocupa espaço. Com provedor liberado, as linhas Privacidade, Ajustes e as demais descem quando ela aparece, e o toque pode cair no item errado. Reserve a altura da seção (um esqueleto) ou mostre um "Carregando…" discreto.
2. `ContaDaEscola.tsx:80`: com dois provedores e `resultado === 'provedor'`, os dois botões ficam "Tentar de novo" e iguais. Mantenha o nome do provedor, por exemplo "Tentar de novo com o Google".
3. `packages/shared/src/errors/messages.ts`, `conflito` e `recusada`:
   - O `conflito` cobre também o aluno que já tem outra conta ligada (`external-login.service.ts`, comentário ao redor de `:161`). Para ele, "Esta conta já está ligada a outro aluno" não é exato.
   - A `recusada` cobre também a sessão que acabou entre o início e o retorno. Para esse caso, "Esta conta não é da escola" confunde, e o aluno deveria entrar de novo.
   - Considere mensagens separadas ou uma frase que sirva aos dois casos. Os textos vêm de `cenarios.md`, então a mudança passa pela spec.
4. "Conta da escola ligada" vive só na volta do provedor. Quem recarrega a página vê o botão de novo (divergência registrada, e o `TODO.md` tem o item "Eu mostra a conta já ligada"). Fica registrado para a validação.
5. Depois de "ligada", o botão desaparece e o foco que estava nele se perde. Considere mover o foco para o aviso de status.
6. A foto contradiz o código em um ponto: ela não mostra a seção nova, porque a vitrine não libera provedor. Vale o código e o e2e. Quando houver escola com provedor liberado na vitrine, fotografe o estado cheio.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-09 19:11:22 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota`, correção, job de nota, seed nem importação. As únicas escritas novas são em `conta_externa` e na auditoria `conta_externa.ligada`. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. Ligar a conta é um ato do próprio aluno, com sessão. Nenhuma IA decide nada. O resultado `conflito` ou `recusada` só diz ao aluno o que fazer em seguida, e não muda a trajetória dele.

Aprovação registrada: ok. Não há saída de IA nesta tarefa. A ligação grava a auditoria `conta_externa.ligada` com o aluno como autor, na mesma transação (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/external-login.service.ts`). A exceção do tutor (D47) não aparece em lugar nenhum.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, e nada mudou. A tarefa não cria agente nem mexe em autonomia.

Bloqueantes: nenhum.

Os outros itens da lista também passam:
- **Supervisão não é vigilância:** a métrica `login.externo` ganhou três resultados, `ligacao_ligada`, `ligacao_conflito` e `ligacao_recusada`. A contagem é agregada, sem escola e sem motivo mais fino (`packages/core/src/telemetry/metrics.ts:70`). Não mede comportamento e não faz inferência emocional.
- **Discursiva e redação (D55/D46):** nada na tarefa.
- **Medir o professor (D45):** nada na tarefa.
- **Auditoria e `docs/regulacao.md`:** a regulação não mudou. A auditoria responde quem ligou, quando e com qual provedor.
- **Tela:** o prompt não trouxe fotos da tela. Pelo código, `ContaDaEscola.tsx` não mostra nenhuma saída de IA, nota ou conceito. O botão principal é secundário, sem nada que induza uso. O resultado sai da barra de endereço, então o colega que usa o mesmo computador depois não vê o aviso do anterior.

Recomendações:
1. **Desfazer a ligação é mais longo que ligar (D59, regra 70 item 4b).** O aluno liga a conta com um clique em "Eu", mas só a coordenação desliga (`packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:57`). Não reprovo por isso: a base legal é execução de contrato, não consentimento, e a conta é da escola. Mesmo assim, no estado "Conta da escola ligada", a tela poderia dizer a quem pedir para desligar (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.tsx`, no bloco do `resultado === 'ligada'`). Vale levar à validação ou à retro se o produto quer o desligar pelo próprio aluno.
2. A auditoria `conta_externa.ligada` entra no arquivo do titular do aluno, e isso já é coberto pela regra 20. O `privacy-guardian` deve conferir que ela aparece lá junto com `conta_externa.desligada`. A regra 70 não exige isso.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-09 19:11:59 · `tasks/prd-acesso-e-convites/15_task.md`

**VEREDITO: REPROVADO**

**Campos pessoais tocados:**
- `conta_externa`: provedor, `sub`, `oid` e `tid`. Os campos já existiam; a tarefa abre um caminho novo de gravação, pela tela "Eu".
- Cookie `educa_oidc`: passa a levar `ligarAoAluno`, com o id do usuário e o id da sessão.
- Auditoria `conta_externa.ligada`: guarda só o id do usuário e o provedor.

**Fora da tabela de dados do docs/lgpd.md:** nada. O `educa_oidc` com o aluno e a sessão entrou na tabela (`docs/lgpd.md:84`), com finalidade e retenção de 5 minutos. A `conta_externa` já estava na linha 47, e nenhum e-mail, nome ou foto do provedor é gravado.

**Autorização por objeto:** falha em `GET /v1/sessao/externa/:provedor/iniciar?intencao=ligar` e no retorno dessa rota. A troca de id está bem fechada:
- Quem liga vem do refresh do `educa_sessao` (`SameSite=Strict`), procurado na escola do slug.
- O usuário e a sessão vão no cookie cifrado, e a escola do contexto vem do cookie.
- A trava confere `usuario.escolaId`, e o `iniciar` responde 404 igual para professor, coordenador, outra escola e sessão ausente.

O furo está em outro lugar: qual conta do provedor fica ligada. Detalhe no bloqueante abaixo.

**Logs:** limpos. O diff não acrescenta nenhum log. Os rótulos novos da métrica (`ligacao_*`) não levam escola nem conta.

**Auditoria:** presente. `conta_externa.ligada` fica na mesma transação, com o aluno como autor. A ligação repetida da mesma conta não gera segundo registro.

**Envio externo:** nenhum dado nosso vai ao provedor. A URL do `iniciar` leva só o slug e a intenção, sem token. Nada vai à IA.

**Seed/fixture:** sintético (`*.educa-sintetica.test`, "Aluna Ficticia").

**Bloqueantes:**

1. **A ligação aceita a conta que já está aberta no navegador, e o aluno não consegue ver qual foi.** O problema está em `apps/api/src/sessao/external/openid-client.adapter.ts:69-77`, junto com `external-login.service.ts:218`.
   - **O que está errado:** o `iniciar` do `intencao=ligar` monta a URL do provedor igual à do login, sem `prompt` nem `max_age`. No computador compartilhado da escola, que é o cenário do produto (D43), o Google e a Microsoft fazem login silencioso com a conta que o colega anterior deixou aberta.
   - **Como vira vazamento:** o aluno A clica em "Ligar a conta da escola" e a conta do colega B fica ligada ao usuário de A. A tela mostra "Conta da escola ligada" sem dizer qual conta foi; o sistema só guarda o identificador opaco, e a auditoria guarda só o provedor. Depois disso, B entra por "Entrar com a conta da escola" e cai na conta de A: vê as notas, o "Como estou indo" e o Tutor de outro menor. Quem não pode, consegue.
   - **Diferença para o 14.0:** no fluxo de reivindicação a ligação passa pela aprovação do professor. Aqui não passa por nenhum humano.
   - **Correção exigida:** só no `intencao=ligar`, forçar a reautenticação no provedor. Na prática: `max_age=0`, com a conferência do `auth_time` no `concluir`, e `prompt=login` na Microsoft; no mínimo, `prompt=select_account` nos dois provedores. O login comum não muda. Teste de integração com o `oidc-falso` provando duas coisas: o endereço do `iniciar` com `intencao=ligar` leva esses parâmetros e o endereço do `iniciar` comum não leva; e um retorno sem autenticação recente não liga nada e dá `recusada`. A tarefa também precisa registrar isso como divergência na `techspec.md` §5 e no `cenarios.md` RF14.

**Recomendações:**
- O `conflito` usa o mesmo texto ("Esta conta já está ligada a outro aluno") quando o próprio aluno já tem outra conta ligada. Não vaza dado, mas confunde o aluno. Vale um texto neutro que sirva para os dois casos, como "Esta conta não pode ser ligada a você. Fale com o professor".
- O item do `TODO.md` "Eu mostra a conta já ligada" deveria levar junto mostrar ao aluno qual provedor está ligado e um caminho de desligar (17.0). Hoje quem tem a conta ligada por engano não vê isso em lugar nenhum fora do arquivo do titular.
- No mesmo item, vale a auditoria guardar se a ligação nasceu em "Eu" ou na aprovação. Hoje a ação é a mesma nos dois caminhos e só o autor diferencia.

**Pergunta de fechamento:** o código responde. A `conta_externa` e a auditoria já entram no arquivo do titular (`packages/core/src/titular/compartilhamento.ts:48`), e nada é enviado a terceiros. O que reprova a tarefa é o bloqueante 1, não esta pergunta.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-09 19:12:16 · `tasks/prd-acesso-e-convites/15_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As quatro subtarefas foram feitas. A tarefa não entrou na tela "Conta da escola na sala" (16.0) nem na reivindicação. Os arquivos que não estavam previstos estão listados na tabela da tarefa, cada um com o motivo.

**Aderência à Tech Spec:** ok.
- As três divergências já estão escritas fora do `15_task.md`:
  - `ligarAoAluno` no cookie `educa_oidc`, com nova conferência sob a trava: `techspec.md` §5, `cenarios.md` RF14 e `docs/lgpd.md`.
  - O resultado volta em `/aluno/eu?ligacao=…`: `techspec.md` §5 e a linha de "Telas".
  - "Conta da escola ligada" aparece só na volta do provedor: `cenarios.md` "Telas" e `TODO.md`.
- O conflito sai como redirecionamento `?ligacao=conflito`, sem `ErrorCode.CONFLITO`. Isso está declarado na §5 e não diz a quem a conta pertence.
- A trava `FOR NO KEY UPDATE` na linha do `usuario` é a mesma da senha provisória, como a §5 pede.

**Portão local:** carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Rota anônima limitada por IP.** `apps/web/src/areas/aluno/ContaDaEscola.tsx:44` faz cada aluno com sessão consultar `GET /v1/escolas/:slug/acesso`. Essa rota é `@Public()` e conta no balde por IP da escola (`LIMITE_REQ_IP_ANONIMO_MIN`, 3000 por minuto no `.env.example`). Hoje cabe, mas "Eu" passou a gastar a cota que protege a entrada da escola, e a consulta não tem `staleTime` próprio. Sugiro dar um `staleTime` longo à consulta em "Eu", ou uma leitura autenticada dos provedores. Fica para o `infra-guardian` confirmar.
2. **Método de 20 linhas só para tipar.** `apps/api/src/sessao/external/external-login.service.ts:304` mantém o termo `conta.dominio === undefined ||` só para estreitar o tipo, como a tarefa admite no motivo 4 de "Mutações". Funciona. Um `dominioLiberado` que aceitasse `string | undefined` e devolvesse `false` deixaria a condição mais limpa, mas mudaria um método que já existia.
3. **Rótulo de métrica que nunca é emitido.** Em `external-login.service.ts:299`, o rótulo `ligacao_${resultado}` é tipado sobre `ResultadoDaLigacao`, que inclui `provedor`. `ligacao_provedor` nunca sai, porque a queda passa pelo `#falhaDoProvedor`. Sugiro estreitar o tipo do retorno de `#resultadoDaLigacao` para `Exclude<ResultadoDaLigacao, 'provedor'>`, para o tipo dizer o que o painel recebe.
4. **Visita seguinte a "Eu".** `TODO.md`, item da divergência 3: hoje o botão reaparece na visita seguinte, porque o servidor não diz se há conta ligada. Vale levar o item à validação, porque o aluno pode achar que a ligação não ficou.

Arquivos lidos por completo:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/15_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/external-login.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/conta-externa.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.tsx`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-09 19:12:37 · `tasks/prd-acesso-e-convites/15_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok. A rota `iniciar?intencao=ligar` usa o balde por IP que a rota `@Public` já tinha (`rl:ip`, 3000/min). Não cria bloqueio novo por IP e não tem nada a ser descoberto por força bruta. Ver a recomendação 1.
Fila e prioridade: ok (não se aplica: nada vai para fila; a transação faz só trava, insert e auditoria, sem chamada externa)
Concorrência: protegida. A trava `FOR NO KEY UPDATE` na linha do usuário é a mesma da senha provisória e da aprovação, e a sessão é conferida com a linha já travada. O `onConflictDoNothing` decide pelos índices únicos `conta_externa_usuario_unico` e `conta_externa_identificador_unico`, e a releitura separa `ligada` de `conflito`. Há testes [P] para gerar × ligar (os dois sentidos), aprovar × ligar (os dois sentidos), o mesmo aluno duas vezes e dois alunos na mesma conta.
Índice e paginação: ok. As buscas usam `sessao_refresh_hash_unico`, a chave primária de `sessao` e de `usuario` e os índices únicos de `conta_externa`. Não há listagem.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. `login.externo` ganhou `ligacao_ligada`, `ligacao_conflito` e `ligacao_recusada`, e a descrição de `infra/grafana/paineis/fundacao.json` foi atualizada. A queda do provedor continua contando em `provedor`, com o prazo de 5 s que já existia. Não há alerta novo.
Bloqueantes: nenhum
Recomendações:
1. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/external-login.service.ts:153-161: o `iniciarParaLigar` já sabe quem é o aluno pela sessão, mas só conta no balde anônimo do IP da escola. Um aluno com um script em laço nessa rota gasta o `rl:ip` que a escola inteira divide. Isso já valia para o `iniciar` simples desde a 13.0, então o vetor não é novo. Mesmo assim, depois de achar a sessão, dá para contar também no limite do usuário e da escola (`consumirAutenticada` com `usuarioId` e `escolaId`). Registrar em `TODO.md` para a próxima rodada sobre o login externo.
2. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.tsx:44: toda abertura de "Eu" agora chama `GET /v1/escolas/:slug/acesso`, uma rota anônima que também conta no `rl:ip` da escola. Os provedores liberados quase nunca mudam, e um `staleTime` maior que os 30 s padrão nessa consulta tira chamadas da rajada da manhã.
3. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/conta-externa.repository.ts:141-149: a sessão é lida depois da trava do usuário, mas sem trava própria. A saída do aluno, que não pega a trava do usuário, pode encerrar a sessão entre essa conferência e o insert, e a conta liga do mesmo jeito. Não fura nenhuma regra, porque é ato do próprio aluno e a provisória fica protegida pela trava. Vale uma linha no docblock dizendo que essa corrida é aceita.
```

## test-engineer · 1ª rodada · REPROVADO · 2026-11-09 19:13:07 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: REPROVADO

**Cenários exigidos (15.0):**
- **Caminho feliz:** o aluno que entrou por matrícula liga a conta e passa a entrar por ela, numa escola sem ano em curso.
- **Uma conta por aluno:** ele tenta ligar outra e recebe conflito. A conta de outro aluno dá conflito sem nome nem id. Ligar a mesma conta de novo não cria segundo registro.
- **Recusa:** conta pessoal Google ou Microsoft, domínio não liberado, sessão que acabou entre o `iniciar` e o retorno.
- **Permissão:** sessão de professor ou de coordenador, sem cookie, cookie inventado, sessão encerrada, refresh anterior a uma rotação.
- **Isolamento:** aluno de outra escola no `iniciar`; cookie OIDC com a escola de outra; a mesma conta do provedor em duas escolas.
- **Sessão certa (borda real):** o aluno sai no computador da escola com a ligação em andamento e continua entrado em outro aparelho. Só a sessão em que a ligação nasceu pode valer.
- **Concorrência:** [P] gerar a provisória × ligar, nos dois sentidos; [P] aprovar × ligar, nos dois sentidos; [P] a mesma conta, pelo mesmo aluno e por dois alunos.
- **Provedor:** `error` no retorno e emissor fora do ar.
- **Tela:** ligada, conflito, recusada, provedor, rede, carregando, sem provedor, colega no mesmo computador, resposta atrasada, 360 px e 1366 × 768.

**Cobertos:** cada linha da tabela de testes tem o seu caso, citado pelo nome, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/ligar-conta.int.test.ts`, no unitário `ContaDaEscola.test.tsx` e no e2e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/conta-da-escola-no-eu.spec.ts`.
- As asserções olham o resultado: `conta_externa`, `auditoria`, `sessao`, `credencial_matricula` e o login de verdade depois de ligar.
- Os [P] gerar × ligar e aprovar × ligar são paralelos de verdade, com `WriteBlockTrigger` e `esperarNaTrava`.
- Nenhum `.skip` nem `.only`. Nenhum provedor pago: só o `oidc-falso`.
- Rodei `ContaDaEscola.test.tsx` e `messages.test.ts`: 32 casos, todos verdes.

**Bloqueantes:**

1. **`apps/api/src/sessao/external/conta-externa.repository.ts:56`, o termo `eq(sessao.id, sessaoId)` não tem teste nem bloco.**
   - Nenhum caso falha sem ele. No caso "com a sessão de outro" (`ligar-conta.int.test.ts:418-422`), a sessão do `outroDaA` foi encerrada de propósito, e sem o termo o resultado continua `recusada`.
   - O cenário real que ele protege: o aluno A começa a ligar no computador da escola e sai. O colega B termina o consentimento do provedor com a conta Google dele, e o retorno chega com o cookie OIDC de A. Sem o termo, a trava aceita qualquer sessão aberta de A, por exemplo a do celular em casa. A conta de B fica ligada a A, e B passa a entrar como A.
   - **Correção exigida:** um caso com o aluno de duas sessões, em que a do `iniciar` está encerrada e a outra aberta, e o resultado esperado é `recusada` sem nada ligado. Mais um bloco `mutacao` que tira `eq(sessao.id, sessaoId)` e cita esse caso.

2. **`conta-externa.repository.ts:56`, o termo `eq(sessao.usuarioId, usuarioId)` não tem bloco.**
   - O caso "com a sessão de outro" (`ligar-conta.int.test.ts:421-422`) o pegaria: sem o termo, a sessão aberta do `alunoA` vale e liga a conta ao `outroDaA`. Mas nenhum bloco o declara.
   - **Correção exigida:** um bloco que tira o termo e cita "o cookie do login em andamento com o aluno de uma escola…".

3. **`conta-externa.repository.ts:37`, o `eq(sessao.refreshHash, refreshHash)` do `sessaoDoAluno` não tem bloco.**
   - É a cláusula que diz quem liga. Sem ela, qualquer cookie, até um inventado, acha uma sessão aberta da escola, e alguém liga a conta em nome de outro aluno.
   - O caso "o refresh anterior (de uma rotação)" (`ligar-conta.int.test.ts:353`) ficaria vermelho sem ela. No caso "cookie inventado" (`:315`) a única sessão da escola A está encerrada, e por isso ele não a pega.
   - **Correção exigida:** um bloco que troca `eq(sessao.refreshHash, refreshHash)` por `undefined` e cita "o refresh anterior". O ideal é também um caso com cookie inventado numa escola que tem uma sessão de aluno aberta.

4. **Termos novos sem bloco e sem motivo em "Mutações".** O documento dá motivo só para o `conta.dominio === undefined ||`. A afirmação da Autoconferência, item 1 ("Os dois termos… têm um cada"), não confere: o bloco tira a disjunção inteira.
   - `external-login.service.ts:293`: o termo `conta.provedor === 'microsoft' &&`. Parece mutante equivalente, porque um `hd` do Google nunca é o GUID do tenant pessoal da Microsoft.
   - `conta-externa.repository.ts:53`: o `eq(usuario.escolaId, escolaId)` da trava. Sem ele, a trava alcança o usuário de outra escola, mas o `#estadoDaSessao` com escopo devolve o mesmo `false`.
   - **Correção exigida:** para cada um, um bloco ou o motivo escrito em "Mutações", como foi feito para os outros quatro.

**Recomendações:**
- **`ligar-conta.int.test.ts:560`, "dois alunos ao mesmo tempo":** é um `Promise.all` sem barreira, então nada garante que as duas transações se cruzem. A espera no índice único já está provada nos [P] aprovar × ligar, mas um `WriteBlockTrigger` no `insert` de `conta_externa` tornaria este caso determinístico.
- **`e2e/conta-da-escola-no-eu.spec.ts:169-170`:** o `expect(pedidos).toHaveLength(1)` roda logo depois do `dispatchEvent('click')`. Se houvesse um segundo pedido, a rota poderia ainda não tê-lo registrado. Vale esperar um tique, ou conferir com `expect.poll`.
- **`e2e/conta-da-escola-no-eu.spec.ts:268`:** o `waitForTimeout(300)` é uma espera fixa. Melhor esperar o pedido segurado terminar (o `fulfill`/`catch` resolvido) antes de conferir o botão.
- **Rota `iniciar`:** não há caso para `intencao=ligar` junto com `token` ou `codigo`, que a docblock do controller diz responder como o inexistente. Vale um caso de 404 sem cookie.
- **Regra 80, carga:** o `iniciar` com `intencao=ligar` passa pelo limite por IP da rota anônima. Uma turma inteira ligando a conta ao mesmo tempo, toda do IP da escola, é um cenário a confirmar com o `infra-guardian`, ou a cobrir com um teste.
- **Termos de junção do `#estadoDaSessao`** (`conta-externa.repository.ts:77-78`): são mutantes equivalentes, porque o id do usuário é UUID e a escola é uma só por sessão. Uma linha de motivo deixa isso registrado.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-09 20:00:08 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok (o diff não toca fila; nada demorado entra no request: o `max_age`/`prompt` só muda o endereço, e o `auth_time` é uma comparação em memória antes da transação)
Concorrência: protegida (o [P] "dois alunos na mesma conta" agora cruza as transações de fato, com `WriteBlockTrigger` no `insert` e `esperarNaTrava`, e prova a ordem `ligada`/`conflito` e o autor da linha; a corrida aceita na sessão sem trava está documentada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/conta-externa.repository.ts:138` e não afeta a provisória, que segue serializada pela trava do usuário)
Índice e paginação: ok (nenhuma query nova; o diff só cria uma fixture de teste)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (a recusa por `auth_time` cai no `ligacao_recusada` que já existe; o tipo `ResultadoDoRetornoDaLigacao` mantém a métrica com três rótulos)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/external-login.service.ts:250`: a recusa por `auth_time` antigo entra no mesmo `ligacao_recusada` do domínio não liberado. Se o relógio da VPS ou do provedor sair do lugar, toda ligação passa a ser recusada, e o painel não mostra o motivo. Sugiro um rótulo próprio (por exemplo `ligacao_recusada_autenticacao_antiga`) ou um log com o motivo, sem dado pessoal. Vale também pôr no runbook a checagem de NTP. A folga de 120 s é estreita para relógio desacertado.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.tsx:50`: o `staleTime` de 10 min vale só para "Eu". A `EntrarNaEscola.tsx:41`, que lê a mesma chave `['acesso-da-escola', slug]` pelo mesmo balde por IP, segue com o padrão de 30 s. Se a entrada da escola também pesa na rajada das 7h, vale pôr o prazo dentro de `acessoDaEscolaQueryOptions`.
- Segue no `TODO.md` a recomendação desta auditoria na 1ª rodada (contar o `iniciarParaLigar` no limite por usuário e por escola). Ela não mudou nesta rodada e continua sem bloquear.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-09 20:00:20 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas, `/aluno/eu` no computador e no celular, escola cheia e vazia). A seção "Conta da escola" não aparece nas fotos, porque as escolas da vitrine não têm provedor liberado. Avaliei essa seção pelo código (`ContaDaEscola.tsx`) e pelo spec `e2e/conta-da-escola-no-eu.spec.ts`.
Estados: ok
- Carregando: `ContaDaEscola.tsx:53` não mostra nada até saber a escola e os provedores. Está declarado no docblock e coberto no teste unitário.
- Vazio: sem provedor liberado a seção não existe (`ContaDaEscola.tsx:56`). Na foto vazia, o "Nada corrigido ainda" de "Eu" convida o aluno a agir e não pede desculpa.
- Erro: a falha da leitura dos provedores mostra `ErrorState` com "Tentar de novo" (`ContaDaEscola.tsx:54`). A queda do provedor mostra `alert` com o botão de nova tentativa. `conflito` e `recusada` dizem o próximo passo sem nomear a quem a conta está ligada.
- Com dado: "Conta da escola ligada" aparece em `status` e o botão some.

Acessibilidade: ok.
- A seção tem `aria-labelledby` e usa `role=status` para "ligada" e `role=alert` para os erros.
- Há uma região `sr-only` para o "Ligando…".
- O botão desabilitado e ocupado evita o clique duplo. O e2e agora prova que só um pedido é emitido (`e2e/conta-da-escola-no-eu.spec.ts:159-177`).
- O spec roda `seriousViolations` com axe no teste de 360 px.

Chromebook fraco: ok.
- `staleTime` de 10 minutos em `ContaDaEscola.tsx:50`, com teste. Isso evita uma chamada anônima por aluno a cada abertura de "Eu", o que segue a regra 80, item 1.
- A seção não tem lista longa nem upload.

Celular: ok.
- As fotos de 360 px mostram "Eu" sem rolagem horizontal. O CTA fixo do celular tapa um pedaço da lista de ações, mas isso é do layout de "Eu" e não mudou nesta tarefa.
- O spec de 360 px mede o botão em 44 px e a rolagem horizontal em 0. O de 1366 × 768 verifica que a página cabe sem rolar.
- A lista "Rolam a 1366 × 768" está vazia.
- Os botões ficam num `flex-wrap`, então os rótulos novos ("Tentar de novo com a conta Microsoft") quebram de linha em vez de estourar. Não confirmei a quebra visualmente nem no código do `Button` (a busca por `nowrap` e `min-h` nele não achou nada), porque nenhuma foto mostra o caso com os dois provedores.
- Nada depende de hover nem de atalho, e nenhum fluxo exige o celular.

Ação oficial protegida: sim. Ligar a conta é ato do próprio aluno, sem nota nem decisão sobre aluno, e é auditado como `conta_externa.ligada`. A API agora pede ao provedor a prova da conta de novo, com `max_age=0` e `prompt`, e recusa um `auth_time` com mais de 120 s. Isso protege o computador compartilhado.

Correções da rodada anterior: a 1ª rodada não exigiu nenhuma. Auditei o diff e os ajustes de texto e de cache feitos por recomendação:
- O botão de nova tentativa distingue Google e Microsoft quando há dois provedores. Está no `docs/interface.md`, no `cenarios.md` e no teste.
- `staleTime` de 10 minutos, com teste.
- O e2e deixou de usar `waitForTimeout`.
- Em `conta-externa.repository.ts` entrou só um comentário.
- Os itens que a revisão deixou sem aplicar foram registrados no `TODO.md`.
- Não vi texto técnico, chave de tradução, inglês nem id na tela.

Bloqueantes: nenhum

Recomendações (já no `TODO.md`):
- Reservar a altura da seção enquanto os provedores carregam, para a página não descer quando ela aparece (`ContaDaEscola.tsx:53-56`).
- Fotografar a seção "Conta da escola" quando a vitrine liberar um provedor, inclusive com dois provedores e o aviso `provedor`. O Validador deve conferir a quebra de linha dos rótulos longos a 360 px.
- Mover o foco para o aviso depois de "ligada".
- Mostrar "Conta da escola ligada" também nas visitas seguintes (divergência 3).

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-09 20:00:29 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO

A correção exigida na 1ª rodada foi feita. Rodei os dois casos novos de integração contra o `oidc-falso` (`-t "prova da conta"`) e os dois passaram.

Campos pessoais tocados: nenhum campo novo é gravado. `ContaNoProvedor.autenticadaEm` (a claim `auth_time`) existe só na memória da requisição e não vai ao banco, ao log nem à resposta. Os dois usuários novos do `infra/oidc-falso/config.json` são sintéticos, no domínio `educa-sintetica.test`.

Fora da tabela de dados do docs/lgpd.md: nada. O `educa_oidc` com aluno e sessão já tinha entrado na 1ª rodada.

Autorização por objeto: ok.
- **A correção:** só a ligação (`prende.ligarAoAluno !== undefined`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/external-login.service.ts:181`) manda ao provedor `max_age=0` e o `prompt` dele: `select_account` no Google e `login` na Microsoft (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/openid-client.adapter.ts:86`).
- **O login comum e a reivindicação não mudam.** A reivindicação continua passando pela aprovação do professor.
- **Na volta da ligação:** um `auth_time` de mais de 120 s é `recusada` e não liga nada (`external-login.service.ts`, no começo do `#resultadoDaLigacao`).
- **Os testes:** `ligar-conta.int.test.ts` prova as duas partes. O endereço da ligação leva os parâmetros e o do login comum, nos dois provedores, não leva. A autenticação antiga não liga, e a de agora liga.
- **Casos novos que fecham mais o objeto:** o cookie inventado numa escola com sessão de aluno aberta dá 404, e `ligar` com `token` ou `codigo` também. Quando o aluno tem duas sessões, só vale a que o `iniciar` achou.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente. A `conta_externa.ligada` continua sendo gravada com o aluno como autor. O retorno `recusada` não liga nada e por isso não tem o que auditar.

Envio externo: nada novo sai do sistema. Ao provedor vão só os parâmetros `max_age` e `prompt` na URL de autorização, sem dado do aluno. Não envolve IA.

Seed/fixture: sintético. Isso vale para os dois usuários do `oidc-falso` e para `SessaoFixtures.outraSessaoDoUsuario`.

Divergência registrada: está na `techspec.md` §5, no fim do parágrafo de `intencao=ligar`, no `cenarios.md` RF14 e na `15_task.md` (divergência 4). O limite que sobra também está no `TODO.md`.

Bloqueantes: nenhum.

Recomendações:
1. **Resta um risco, já documentado.** Quando o Google não traz `auth_time`, que é o padrão sem um ajuste no console dele, a proteção é só o `select_account`. No computador da escola, o aluno ainda pode clicar na conta do colega que está na lista. Isso cumpre o mínimo que a ordem de correção pedia, e a exigência da claim já está no `TODO.md`. Na validação da spec, confirmar com a escola piloto que o provedor dela traz `auth_time`, e então trocar a claim ausente por `recusada`.
2. **"Conta da escola ligada" não diz qual conta foi ligada.** Quando entrar o item "Eu mostra a conta já ligada" do `TODO.md`, mostrar o provedor e o domínio da conta (nunca o e-mail) e o caminho para desligar. Assim o aluno percebe uma ligação errada sem depender do professor.
3. **O `auth_time` não tem limite superior.** Hoje um `auth_time` no futuro passa. É só endurecimento, porque o token é assinado e a assinatura é conferida.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-09 20:00:45 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff da 2ª rodada mexe só na ligação da conta da escola em "Eu": `conta_externa`, cookie OIDC, adaptador do provedor, tela `ContaDaEscola` e testes. Não grava em `Nota` e não toca correção. Todos com autor humano? Sim, porque não há caminho.
Decisão autônoma sobre aluno: ausente. A ligação é ato do próprio aluno, e as recusas (`recusada` por `auth_time` antigo, sessão encerrada, domínio) só bloqueiam a ligação. Nada decide aprovação, reprovação ou encaminhamento.
Aprovação registrada: ok. Não há saída de IA nesta tarefa. A auditoria `conta_externa.ligada`, com o aluno por autor, continua como estava na 1ª rodada.
Supervisão do tutor: ok, porque o diff não toca o tutor.
Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi tocado.
Bloqueantes: nenhum.

O que conferi nesta rodada:
- A 1ª rodada não exigiu nenhuma correção, então não havia o que cobrar.
- Itens 7 e 9: o diff não mede comportamento nem uso do aluno ou do professor. `PRAZO_DOS_PROVEDORES_MS` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.tsx` só guarda em cache a lista de provedores da escola. A claim `auth_time` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/openid-client.adapter.ts:118`) é usada só na comparação em memória e não vai ao banco.
- Item 8: nenhum campo, tela ou prompt de nota.
- Item 4b (D59): o novo rótulo "Tentar de novo com a conta Google/Microsoft" não complica a saída nem induz uso.
- `docs/regulacao.md` não mudou nesta rodada.

Recomendações:
- A minha recomendação da 1ª rodada (D59, dizer ao aluno a quem pedir para desligar a conta, ou deixá-lo ver o provedor ligado e desligar) ainda não chegou ao item que deveria levá-la. A tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/15_task.md` diz que a recomendação vai para o item "Eu mostra a conta já ligada", com "acrescentar o provedor ligado e o caminho de desligar". Esse item está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/TODO.md:3283-3285`, e o texto dele não fala em desligar. Sugiro acrescentar o caminho de desligar a esse item, para a recomendação não se perder na validação.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 20:01:02 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO

Escopo: respeitado. O diff da 2ª rodada traz só o que a ordem de correção da 1ª pediu: a prova da conta de novo no `iniciar` da ligação, o `auth_time` na volta, os casos da sessão e do cookie inventado, o `staleTime` dos provedores e o rótulo do "Tentar de novo" com dois provedores. Os arquivos novos (`external-provider.port.ts`, `openid-client.adapter.ts`, `infra/oidc-falso/config.json`, `sessao.fixture.ts`) aparecem em "Arquivos previstos" com o motivo. Nada entra na 16.0.

Aderência à Tech Spec: ok. A divergência 4 (`max_age=0` e `prompt` só no `intencao=ligar`, `auth_time` de mais de 120 s vira `recusada`, a claim ausente não recusa) está registrada em quatro lugares: `techspec.md` §5 "Conta da escola do aluno", `cenarios.md` RF14 e a linha de "Telas", `docs/interface.md` e `TODO.md`, onde ficou o item de exigir a claim.

Portão local: carimbo válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.test.tsx:173` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/web/src/areas/aluno/ContaDaEscola.tsx:11`, os comentários prometem mais do que o código entrega:
  - **O aluno seguinte no mesmo computador:** o teste diz que ele não lê os provedores de novo. Mas `apps/web/src/main.tsx` chama `resetQueries` a cada troca de sessão, então o aluno seguinte refaz a busca de qualquer jeito.
  - **As aberturas de "Eu" de uma manhã:** o código diz que elas não custam uma chamada cada. Mas cada aluno, em cada computador, faz a primeira busca de qualquer jeito.
  - **O prazo de 10 min:** com a seção desmontada, quem manda é o `gcTime` padrão de 5 min. O teste só não vê isso porque falsifica `Date` e deixa o relógio da coleta de lixo real.

  O ganho do `staleTime` vale só para o mesmo aluno, voltando a "Eu" na mesma sessão. Reescrever os dois comentários com esse alcance, ou subir o `gcTime` junto, se o objetivo for de fato 10 min.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/conta-externa.repository.ts:138`: o docblock aceita uma corrida. Se o aluno sair entre a conferência e o `insert`, a conta liga mesmo assim. O motivo dado é razoável (é ato do próprio aluno, e a provisória segue serializada), mas a decisão está só no comentário. Vale uma linha na `techspec.md` §5, junto da trava, para a validação não tomá-la por defeito.

## test-engineer · 2ª rodada · APROVADO · 2026-11-09 20:02:13 · `tasks/prd-acesso-e-convites/15_task.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 2, sobre as quatro correções da 1ª e o diff desde ela):
- **Correção 1:** o aluno com duas sessões, em que a do `iniciar` está encerrada e a outra aberta, dá `recusada` sem nada ligado. Com um bloco que tira `eq(sessao.id, sessaoId)`.
- **Correção 2:** um bloco que tira `eq(sessao.usuarioId, usuarioId)`.
- **Correção 3:** um bloco que troca `eq(sessao.refreshHash, refreshHash)` por `undefined`, e de preferência um caso com cookie inventado numa escola que tem uma sessão de aluno aberta.
- **Correção 4:** um bloco ou um motivo para `conta.provedor === 'microsoft' &&` e para o `eq(usuario.escolaId, escolaId)` da trava.
- **Código novo deste diff:** a prova da conta de novo no `iniciar` da ligação (`max_age` e `prompt`), o `auth_time` na volta, `token` e `codigo` com `intencao=ligar`, o `staleTime` dos provedores, os rótulos de "Tentar de novo" com dois provedores, e a corrida de dois alunos na mesma conta, agora com ordem garantida.

Cobertos:
- **Correção 1:** feita. O caso novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/ligar-conta.int.test.ts:387`. Ele confere `recusada`, nenhuma ligação e uma sessão ainda aberta. O bloco cita o caso.
- **Correção 2:** feita. O caso de `:438` agora tem as duas escolas liberando `DOMINIO_A`. Assim o `comSessaoDeOutro` (`:459`) chega à trava, e sem o termo a sessão aberta do `alunoA` ligaria a conta ao `outroDaA`. O bloco cita o caso.
- **Correção 3:** feita. O bloco com `undefined` cita "o refresh anterior" (`:353`): depois da renovação, a sessão aberta do aluno seria achada. Há também o caso novo do cookie inventado com sessão aberta na escola (`:362`), que compara com o `302` do cookie certo.
- **Correção 4:** feita. Os motivos 5 a 8 estão em "Mutações", e conferem com o código:
  - `undefined < n` dá `false`.
  - O `#estadoDaSessao`, com o escopo do contexto, devolve o mesmo `false`.
  - A chave estrangeira composta `(escola_id, usuario_id)` torna redundante o termo de escola na junção.
  - O `usuario.id` da junção ganhou um bloco próprio.
- **`max_age` e `prompt`:** têm um bloco para cada parte: o `max_age`, o `prompt`, cada valor de `PROMPT_DA_LIGACAO`, o argumento `false` e o argumento `true`. Os blocos de negação caem no `expect` do login comum.
- **`auth_time`:** os blocos `if (false)`, `>` e `autenticadaEm = undefined` caem no caso "autenticação antiga". O caso confere `RECUSADA` e não `provedor`, e por isso a recusa vem da cláusula, não da biblioteca.
- **Corrida de dois alunos na mesma conta:** está determinística. O `WriteBlockTrigger` é um gatilho *after insert*: a linha já está no índice único quando a primeira escrita para. O `esperarNaTrava` confirma que a segunda escrita espera atrás dela. O resultado é `[LIGADA, CONFLITO]` nessa ordem, com a ligação do `um`.
- **Tela:** o `staleTime` tem dois blocos, um que o tira e outro que o reduz a 60 s, contra os 5 min do caso. Os três ramos do `rotulo` têm um bloco cada.
- **Tabela de testes:** as sete linhas novas da tabela de `15_task.md` citam, pelo nome, casos que existem.
- **Execução nesta rodada:** `ligar-conta.int.test.ts` passou (29 de 29) e `ContaDaEscola.test.tsx` passou (14 de 14). Não há `.skip`, nem mock que esconda a regra, nem provedor pago (é o `oidc-falso`).

Bloqueantes: nenhum.

Recomendações:
1. **O caso de `:387` só mata a mutação de `sessao.id` pela ordem física das linhas.** O `#estadoDaSessao` (`conta-externa.repository.ts:173`) usa `.limit(1)` sem `ORDER BY`. O mutante só é pego se o Postgres devolver primeiro a sessão aberta, e hoje isso acontece porque o encerramento não é HOT (há índice em `coalesce(encerrada_em, …)`) e a versão nova da linha vai para depois. Na borda de página, com `fillfactor = 70`, a versão nova pode ficar antes da outra sessão, e então o mutante sobrevive. O código correto passa sempre; só a prova da mutação é que oscila. Um jeito de deixá-la estável é criar uma sessão aberta do mesmo aluno **antes** da sessão do `iniciar`.
2. **A janela de 120 s não está provada.** As amostras usam `auth_time: 1` (1970) e `auth_time: 4102444800` (ano 2100). Trocar `IDADE_MAXIMA_DA_AUTENTICACAO_S` para um dia deixaria os dois casos verdes, embora seja exatamente a sessão que o colega deixou aberta de manhã. Isso pede um unitário de `#resultadoDaLigacao` (ou de uma função pura extraída dele) com relógio falso, testando 119 s e 121 s. Hoje um `auth_time` no futuro também é aceito, e vale decidir se ele deve ser recusado.
3. **A linha da tabela "a autenticação antiga não liga" promete mais do que o caso mostra.** Ela diz "mais de 120 s", mas o caso prova "muito antigo". Ajuste o texto ou o teste, conforme o item 2.
