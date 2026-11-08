# Achados das revisões — `tasks/correcoes/2026-11-08-rota-de-envio-no-teste-de-convite.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 03:26:14 · `tasks/correcoes/2026-11-08-rota-de-envio-no-teste-de-convite.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só muda a lista esperada e um comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/convite.int.test.ts`. Nenhum schema, DTO, rota ou código de `src` foi alterado.
Fora da tabela de dados do docs/lgpd.md: nada novo.
Autorização por objeto: ok. A rota que entrou na lista é `POST /v1/professores/convites/enviar`, e ela é da tarefa 3.0. Conferi no código o que o comentário novo afirma:
- a lista de professores vem do contexto da sessão (`professoresParaEnvio` em `apps/api/src/sessao/convite/convite-de-professor.service.ts:147`);
- o `usuarioIds` do corpo só restringe essa lista;
- o convite anterior é refeito por `refazerSobATrava` (linha 159), que o revoga;
- o envio fica registrado como `convite.enviado` com canal `email` (linha 161).

O teste continua comparando a lista inteira com igualdade exata. Uma rota nova com "convite" no caminho ainda derruba o caso. A segunda parte do teste (`POST /v1/convites` e `/criar` respondem 404 ao coordenador) não mudou.
Logs: limpos. O diff não acrescenta log.
Auditoria: presente. Não é exigida por esta correção, e a rota envolvida já grava `convite.enviado`.
Envio externo: nenhum por esta correção.
Seed/fixture: sintético. A correção não toca fixture.
Bloqueantes: nenhum.
Recomendações:
- O portão da tarefa 3.0 não rodou `convite.int.test.ts` porque o arquivo não estava entre os alterados. Vale levar à retro que uma tarefa que cria rota com "convite" no caminho deveria rodar esse teste no próprio portão, e não deixar a falha só para a esteira.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 03:26:17 · `tasks/correcoes/2026-11-08-rota-de-envio-no-teste-de-convite.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- A mudança está só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/convite.int.test.ts`. Ela põe `POST /v1/professores/convites/enviar` na lista e mantém a comparação exata, então uma rota nova com "convite" no caminho continua derrubando o caso. A rota vai no lugar certo da ordenação, depois das que têm `:usuarioId`, porque `:` vem antes de `c`. Não executei o teste; a afirmação de que ele fica verde depois vem do arquivo da correção, não de uma execução minha.
- O que a correção diz da rota bate com o código. `enviarConvitesDeProfessores` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite-de-professor.service.ts:139`) não manda e-mail dentro do request: põe cada envio na fila pelo outbox, na mesma transação (linha 160), e passa pela cota da escola com `Retry-After`. Isso foi auditado na tarefa 3.0 e não muda aqui.
- Para a retro: um teste de integração que lista as rotas do Express só roda na esteira. Vale fazer o portão da tarefa rodar `convite.int.test.ts` sempre que ela acrescentar rota com "convite" no caminho, para a falha da 3.0 não chegar de novo à esteira.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 03:26:19 · `tasks/correcoes/2026-11-08-rota-de-envio-no-teste-de-convite.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só mexe na lista fixa de rotas de um teste de convite. Não há `Nota`, job, seed, importação nem webhook de nota. Todos com autor humano? Não se aplica (nada escreve em `Nota`).
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Não há saída de IA nesta correção. A rota que entrou na lista, `POST /v1/professores/convites/enviar`, não usa modelo. Ela refaz o convite de professor com canal e-mail e grava `convite.enviado` na auditoria, com a coordenação como autora (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/convite/convite-de-professor.service.ts:139-172`).
Supervisão do tutor: ok, porque a correção não toca o tutor.
Autonomia declarada e visível: sim. A correção não altera agente, nível nem tela de governança.
Bloqueantes: nenhum.
Recomendações: nenhuma da regra 70.

Os itens 7 a 9 também não se aplicam: a correção não traz métrica de aluno nem de professor, nem nota proposta em discursiva ou redação, nem tela.

Conferi o que a correção diz sobre a rota contra o código:
- **Rota e permissão:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/professores/professores.controller.ts:47-54` exige a mesma permissão do refazer (`professor`, `refazer_convite`).
- **Quem recebe:** o serviço lê os professores da escola da sessão e passa pela mesma matriz do refazer. Só professores `pendente` ou `vencido`, com convite de origem e e-mail na conta, recebem convite novo; o anterior é revogado. Um `usuarioIds` de outra escola ou que não existe é ignorado. A escola e a autora vêm da sessão, nunca do corpo do pedido.
- **A prova não afrouxou:** o teste continua comparando a lista exata (`apps/api/test/convite.int.test.ts:574-585`). Uma rota nova com "convite" no caminho ainda derruba o caso, e a parte que confere o 404 para o coordenador ficou como estava.
- **Teste citado no comentário:** `apps/api/test/convites-enviar.int.test.ts` existe.

Não rodei o teste.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 03:26:20 · `tasks/correcoes/2026-11-08-rota-de-envio-no-teste-de-convite.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. A correção altera só `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/convite.int.test.ts`.

Queries verificadas: o teste novo não traz query nenhuma. Conferi a rota que entrou na lista, `POST /v1/professores/convites/enviar`, contra o que a 3.0 já fez:
- **Escopo:** em `apps/api/src/sessao/convite/convite.repository.ts:148-170`, `professoresParaEnvio` tira o `escolaId` do contexto (`requireEscolaId()`). As duas consultas, em `usuario` e em `convite`, filtram por `escolaId`. O `usuarioIds` que vem do corpo só restringe dentro dessa escola e nunca decide qual escola ler.
- **Permissão:** o controller, em `apps/api/src/professores/professores.controller.ts:47-53`, exige a permissão `professor/refazer_convite` e devolve só a contagem.
- **O que a rota faz:** ela refaz convites que já existem e não cria convite para pessoa nova. É a mesma classe de `.../convite/refazer`, que já estava na lista.

Teste de isolamento: presente e efetivo.
- **Teste do envio:** fica em `apps/api/test/convites-enviar.int.test.ts:289`. A coordenação da escola A manda `usuarioIds` da escola B, eles são tratados como inexistentes e nada da B vai para a fila. Sem o `eq(usuario.escolaId, escolaId)`, os professores da B voltariam e o teste quebraria.
- **Teste corrigido:** em `convite.int.test.ts:574-585` a asserção continua sendo igualdade exata da lista. Uma rota nova com "convite" no caminho ainda derruba o caso. A parte que espera 404 em `POST /v1/convites` e `/criar` para o coordenador não mudou.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/convite.int.test.ts:573`: o comentário diz que o professor "vem da lista da escola, nunca do corpo", mas o corpo traz `usuarioIds` para restringir. Uma redação mais precisa seria: "o corpo só restringe dentro da escola da sessão; id de outra escola ou desconhecido é ignorado (`convites-enviar.int.test.ts`, isolamento)".

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 03:26:52 · `tasks/correcoes/2026-11-08-rota-de-envio-no-teste-de-convite.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: a lista exata das rotas com "convite" no caminho aceita a rota `POST /v1/professores/convites/enviar`, que existe hoje.
- O teste não pode afrouxar: uma rota nova com "convite" no caminho, se ninguém a puser na lista, continua derrubando o caso.
- A lista não pode sair vazia por mudança de versão do Express.
- Permissão: o coordenador recebe 404 em `POST /v1/convites` e `/v1/convites/criar`.
- A rota nova não pode criar convite para pessoa nova, que é o motivo de ela ser aceita na lista. Isso pede três provas: o filtro de quem espera o convite, o id desconhecido ou de outra escola ignorado, e o isolamento entre escolas.

Cobertos:
- Lista exata e a falha com rota nova fora dela: a asserção em `apps/api/test/convite.int.test.ts:574-585` continua sendo `toEqual` sobre a lista com `sort()`. Só ganhou um item, e ele está na posição certa da ordenação.
- Lista não vazia: o `expect(rotas).toContain('GET /saude')` da linha 567 continua.
- 404 ao coordenador: as linhas 587-591 não mudaram.
- A rota só refaz convite. Conferi o que o comentário novo diz contra o código e contra `apps/api/test/convites-enviar.int.test.ts`:
  - filtro de quem espera o convite, só `pendente` e `vencido`: casos das linhas 172, 198 e 218;
  - só o papel de professor entra, e conta sem endereço não entra: caso da linha 239;
  - os `usuarioIds` de outra escola são tratados como inexistentes: caso da linha 289;
  - quem não é coordenação não alcança a rota: caso da linha 275.
- A rota está declarada em `apps/api/src/professores/professores.controller.ts:47`. O serviço `enviarConvitesDeProfessores` está em `apps/api/src/sessao/convite/convite-de-professor.service.ts:139` e faz o que o documento descreve.
- Rodei `npx vitest run apps/api/test/convite.int.test.ts` a partir da raiz: 16 de 16 verdes. Rodado de dentro de `apps/api`, o arquivo falha ao resolver o pacote `@educa/core`, o que é só o lugar de onde se roda, não defeito da correção.
- "Sem mutação" está bem justificado: o diff só toca o arquivo de teste e o documento da correção. Nada em `apps/*/src` nem em `packages/*/src` muda.
- Não há `.skip`, teste comentado nem mock. Nenhum provedor de IA entra no teste. Concorrência não se aplica a esta correção: a rota já tem caso de corrida de verdade em `convites-enviar.int.test.ts:625`, com os dois "Enviar" em paralelo.
- Nenhum outro teste lista as rotas com "convite" de forma exata. Procurei por `convite/refazer` nos testes: os outros arquivos que citam a rota a usam, não a listam.

Bloqueantes: nenhum.

Recomendações:
1. Para a retro, o processo: a causa foi uma lista de rotas que só um teste de integração confere, e a tarefa que acrescentou a rota (a 3.0) não alterou esse arquivo, então o portão dela não o rodou. Duas saídas possíveis:
   - levar a lista das rotas com "convite" para um teste de unidade, que o portão roda sempre;
   - ou fazer o portão rodar também `convite.int.test.ts` quando um controller ganha uma rota com "convite" no caminho.
2. O comentário em `apps/api/test/convite.int.test.ts:573` diz "o professor vem da lista da escola, nunca do corpo". O corpo pode trazer `usuarioIds`, que só restringem a lista. Fica mais exato assim: "o corpo só restringe, e o id que a lista da escola não traz é ignorado".
