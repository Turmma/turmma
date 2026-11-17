# Achados das revisões — `tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 21:37:29 · `tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe na esteira (`.github/workflows/ci.yml`, `tools/ci/*`, `package.json`) e na documentação (`README.md`, `docs/runbook.md`). Não há schema, migration, DTO, rota, log de aplicação nem envio externo.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: não se aplica, porque a tarefa não cria nem altera endpoint.
Logs: limpos. A única mensagem nova é o erro de `fatiaDosArgumentosDoVitest` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/executar.ts:340`). Ela repete o argumento `--shard` que recebeu e não leva dado de pessoa.
Auditoria: não se aplica, porque a tarefa não tem ação que a regra 20 item 10 obrigue a auditar.
Envio externo: nenhum. O job novo `unidade` herda `permissions: contents: read` do workflow e usa `persist-credentials: false`. Ele não lê segredo do repositório nem publica artefato (`upload-artifact` aparece só nos jobs que já existiam). O `${{ matrix.fatia }}` dentro do `run` vem de uma matriz fixa `[1, 2]`, e nada que vem de PR entra no comando.
Seed/fixture: nenhuma fixture nova nem alterada. Os testes novos em `tools/ci/scripts.test.ts` e `tools/ci/esteira.test.ts` só verificam comandos e o YAML.

Pontos de privacidade que a mudança afeta:
- O gitleaks (`guarda:segredo`) e o `npm audit` continuam no `verificar`, dentro de `ETAPAS_DE_GUARDA`, que é a mesma lista que o portão local lê.
- Os testes de unidade que provam a regra 20, como `contracts.test.ts`, `porta-unica.test.ts`, `llm-gateway.test.ts` e as guardas de log, continuam rodando na esteira, agora repartidos em duas fatias do job `unidade`. O teste `a esteira roda todo projeto do Vitest…` (`tools/ci/scripts.test.ts:417` em diante) passou a contar o `unidade.ts` e garante que o projeto `unidade` não ficou fora da esteira.
- O teste `fatia malformada reprova antes de rodar` (`tools/ci/scripts.test.ts:410-414`) garante que uma fatia inválida não faz a esteira pular a suíte em silêncio.
- O portão local da tarefa continua rodando `npm run test:unidade` inteiro.

Bloqueantes: nenhum.

Recomendações:
- A intermitência de `tools/processo/harness/npx-sem-instalar.test.ts`, registrada pelo Implementador, fica com o Orquestrador. Ela não tem relação com a regra 20.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta continua a mesma de antes, por `arquivo-do-titular` e `ExecucaoAgente`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 21:37:44 · `tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Esta correção não depende de nenhuma Tech Spec. Ela faz o que o documento descreve: a unidade sai do `verificar` e passa a rodar em duas fatias com `fail-fast: false`, cada uma com teto de 15 min; a leitura do `--shard` virou uma função só, usada pela infra e pela unidade. Nada além disso foi mexido.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

O que conferi e está em ordem:
- **Ninguém lê o nome antigo do job.** Nada no repositório usa o nome `verificar (… unidade)` nem tem lista de checagens obrigatórias. Ele só aparece numa fixture de execução antiga. O `tools/processo/esteira.ts` só lê as fatias do e2e. Trocar o nome do job não quebra nada.
- **Nenhum job espera pelo `verificar`.** O `.github/workflows/ci.yml` não tem `needs:`, então o job novo `unidade` roda em paralelo com os outros.
- **O arquivo novo está coberto.** O `tools/ci/unidade.ts` cai no `tools/ci/*.ts` do knip, e a suíte de dependências passou no carimbo.
- **A frase alterada do runbook está correta.** Em `docs/runbook.md:1752`, o texto agora diz que o `esteira.test.ts` reprova "no job `unidade`". Ele é teste de unidade e roda numa das fatias, então a frase descreve o que acontece.
- **A troca de nome da função saiu inteira.** `fatiaDosArgumentosDaInfra` não aparece mais em lugar nenhum.

Recomendações (não bloqueiam):
1. **O limite de 7 min por fatia só existe em texto.** Ele aparece no comentário de `.github/workflows/ci.yml:59-61` e em `docs/runbook.md:1785`, mas nenhum teste ou anotação avisa quando a fatia se aproxima dele. O e2e tem os dois avisos de 60%. Sem algo parecido, a próxima vez que a unidade crescer vai aparecer de novo como job cancelado. Fica para a retro decidir se vale uma anotação "unidade perto do teto", no molde da que o `tools/ci/e2e.ts` deixa no resumo.
2. **O mesmo controle aparece duas vezes.** O nome do job ter `/2` igual ao tamanho da matriz é conferido em `tools/ci/esteira.test.ts:385`. O teste dos jobs (`:352`) confere o `--shard` do passo, mas não o `name`. Dá para juntar as duas checagens num lugar só, ou estender a do nome à infra e ao e2e, para as três suítes em fatias terem a mesma guarda.
3. **Teste intermitente sem dono.** As duas falhas do `tools/processo/harness/npx-sem-instalar.test.ts` na fatia 1 estão registradas na tabela de recomendações do documento. Agora que a unidade roda dividida, uma falha intermitente nesse teste deixa uma fatia da esteira vermelha. Vale o Orquestrador abrir a correção dele logo, em vez de esperar a esteira pegar.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.github/workflows/ci.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/unidade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/executar.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/verificar.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/scripts.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 21:37:50 · `tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança é só na esteira de CI (`.github/workflows/ci.yml`, `tools/ci/`), e nada dela roda em produção às 10h.
Rate limit: ok. Esta tarefa não mexe em limite.
Fila e prioridade: ok. Esta tarefa não mexe em fila.
Concorrência: protegida. As duas fatias da matriz são independentes, com `fail-fast: false`, e o Vitest reparte os arquivos sem repetir nenhum.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Não há código novo no caminho quente nem alerta novo. O runbook ganhou a seção "Esteira vermelha no `verificar` ou na unidade".
Bloqueantes: nenhum.
Recomendações:
- Proteção de branch no GitHub: o job `verificar` trocou de nome, de "…, dependências, unidade" para "…, dependências, git hook". Se a `develop`, a `release` ou a `main` exigem esse check pelo nome antigo, o merge fica esperando um check que nunca chega. Também vale exigir `unidade 1/2` e `unidade 2/2`. Isso é configuração do repositório e não aparece no código; dá para conferir com `gh api repos/Turmma/turmma/branches/develop/protection`.
- O limite de "7 min de teste numa fatia" está escrito no comentário do `ci.yml` e no `docs/runbook.md`, mas nenhum teste o mede. O e2e já tem a anotação "e2e perto do teto". Uma anotação parecida na unidade daria aviso antes do próximo cancelamento por prazo.
- Ficou registrada na tarefa uma intermitência em `tools/processo/harness/npx-sem-instalar.test.ts`: a saída do `npx` veio vazia numa corrida da fatia 1. Isso agora pode deixar uma fatia da unidade vermelha na esteira e precisa de correção própria se voltar a aparecer.

Rodei `tools/ci/esteira.test.ts` e `tools/ci/scripts.test.ts` no projeto `unidade`: 50 testes, todos passaram.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.github/workflows/ci.yml`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/unidade.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/executar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/verificar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/infra.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/compose.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/esteira.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/scripts.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 21:38:04 · `tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** com `--shard=2/2`, o `ci:unidade` passa a fatia ao Vitest (`npm run test:unidade -- --shard=2/2`) e sai verde.
- **Sem fatia:** na máquina de quem desenvolve, roda a unidade inteira com `npm run test:unidade`.
- **Fatia malformada:** recusada antes de rodar qualquer coisa. Vale para índice acima do total (`3/2`), índice zero (`0/2`), `${{ matrix.fatia }}` sem expandir e duas fatias ao mesmo tempo.
- **Unidade vermelha:** o script não pode virar verde.
- **`verificar` sem a unidade:** o job fica sem `test:unidade` e continua vermelho quando lint, gitleaks, audit, knip ou `test:processo` falham.
- **Workflow:** existe o job `unidade`. A matriz tem mais de uma fatia, `fail-fast` é false, e o total no `name` e no `--shard` é igual ao tamanho da matriz.
- **Tetos:** `verificar` e `unidade` ficam com até 15 min cada, sem subir o número.
- **Cobertura:** todo projeto do Vitest continua sendo rodado por algum script da esteira, agora com `unidade.ts` na lista.
- **Não se aplicam:** isolamento entre escolas e permissão, porque não há dado de escola nem rota. Concorrência também não: as fatias são jobs independentes, e o `fail-fast: false` está provado.

**Cobertos:**
- `tools/ci/scripts.test.ts`:
  - `› ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar` cobre fatia, sem fatia, vermelho e os quatro formatos malformados. Para os malformados, confere também que nada foi chamado.
  - `› ci:verificar roda tipos, lint, as guardas da lista e o git hook …` usa a lista exata de chamadas e confere de forma explícita que não há `test:unidade`.
  - O `it.each` do vermelho do `ci:verificar` agora inclui `test:processo`.
  - `› a esteira roda todo projeto do Vitest …` agora inclui `unidade.ts`.
  - `› ci:infra leva a fatia …` continua cobrindo a infra, que passou a usar `fatiaDosArgumentosDoVitest`.
- `tools/ci/esteira.test.ts`:
  - `› tem os jobs verificar, unidade, integracao, infra e e2e …` exige o comando `npm run ci:unidade -- --shard=${{ matrix.fatia }}/<tamanho da matriz>`.
  - `› a unidade roda em fatias que não se cancelam …` cobre mais de uma fatia, `fail-fast` false, o total no nome e os tetos de 1 a 15 min.
- **Mutações:** `--faltando` dá 0. Os seis blocos cobrem toda condição nova de `executar.ts` e `unidade.ts`: o `return null` sem argumentos, os dois argumentos, `fatia === null` e os limites `< 1` e `> total`, e o `--shard` sempre presente. Cada bloco cita uma asserção que de fato o pega. O `ci.yml` não é código e fica coberto pelos testes de forma do workflow.
- Rodei `npx vitest run tools/ci/scripts.test.ts tools/ci/esteira.test.ts` e deu 2 arquivos e 50 testes verdes.
- Não há `.skip`, teste comentado nem mock que esconda a regra: o `rodarScript` roda o script de verdade e só troca o `npm` e o `docker` que ele chama. Nenhum teste chama provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O comentário do `ci.yml` (job `verificar`) e o documento da correção dão estimativas de tempo: "uns 5 min" para o `verificar` sem a unidade e "200 a 290 s" por fatia. Vale conferir os números na primeira execução da esteira e trocar a estimativa pela medida no documento ou no runbook.
2. O sinal de "passando dos 7 min de teste numa fatia, acrescente fatia" só existe em comentário e no runbook. Para o e2e há guarda automática (60% do teto em `esteira.test.ts` e a anotação "e2e perto do teto"); para a unidade, não. Uma anotação no resumo da execução quando a fatia da unidade passar do limiar daria o aviso antes do cancelamento, em vez de depois.
3. A intermitência de `tools/processo/harness/npx-sem-instalar.test.ts` (saída do `npx` vazia numa corrida da fatia 1) já está registrada para o Orquestrador. Com a unidade repartida, ela pode aparecer na esteira com mais frequência, porque a ordem e a companhia dos arquivos mudam, e merece uma correção própria se voltar.

**Arquivos auditados:**
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/unidade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/executar.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/scripts.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ci/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.github/workflows/ci.yml
