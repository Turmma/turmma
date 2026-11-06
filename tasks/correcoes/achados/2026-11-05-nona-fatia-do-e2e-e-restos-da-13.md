# Achados das revisões — `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-05 23:51:21 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A correção não traz migration nem schema e não cria nem altera tabela.

Queries verificadas: nenhuma. A correção não cria nem altera repository, query ou endpoint. O que muda:
- `ler-planilha.ts`: o tipo local `Linha` passa a `CelulasDaLinha`, nos três usos.
- `ImportarPlanilha.tsx`: o tipo `Escolha` passa a `ArquivoEscolhido`, nos três trechos de renomeio que estão em revisão. Nenhum deles toca chamada à API nem `escolaId`.
- `ci.yml`, `tools/processo/esteira.ts`, `docs/runbook.md` e `README.md`: o e2e passa de oito para nove fatias.
- `apps/worker/src/processors/synthetic.test.ts`: folga na asserção de tempo de parede. A sandbox de CPU não tem estado de tenant.

Teste de isolamento: não se aplica. A correção não cria módulo, tabela, query nem endpoint, e não altera nenhum escopo. O item 5 da regra 10 não é acionado.

Bloqueantes: nenhum.

Recomendações: nenhuma no meu escopo.

Para os outros revisores: os 1773 casos no total em nove fatias, citados no runbook, conferem com 197 × 9.

Arquivos revisados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx (só as linhas de renomeio)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.github/workflows/ci.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/README.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-05 23:51:31 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

A correção não toca dado pessoal. Ela troca o nome de dois tipos locais, acrescenta a nona fatia do e2e e dá folga à asserção de tempo de parede de um teste do worker. Não tem rota, repository, migration, log, auditoria, storage nem chamada de IA nos arquivos em revisão.

Campos pessoais tocados: nenhum. Em `ImportarPlanilha.tsx:79`, `ArquivoEscolhido` é só a interface `Escolha` com outro nome, com os mesmos campos `numero`, `nome` (o nome do arquivo, não de uma pessoa) e `texto`, e nenhum campo novo. Em `ler-planilha.ts:43`, `CelulasDaLinha` é o mesmo `readonly unknown[]` de antes. O conteúdo da planilha continua do jeito que a 13.0 deixou.
Fora da tabela de dados do docs/lgpd.md: nada (não entra campo novo).
Autorização por objeto: não se aplica (nenhuma rota nova ou alterada).
Logs: limpos. Não entra `console` nem `logger` em `ler-planilha.ts`, e as linhas trocadas em `ImportarPlanilha.tsx` só mudam nome de tipo.
Auditoria: não se aplica (nenhuma das ações que a regra 20, item 10, manda auditar).
Envio externo: nenhum. Muda só quantas fatias o e2e roda, e o artefato `traco-do-e2e-<i>` continua um por fatia, como antes. O que vai nele sai do seed sintético, que esta correção não altera.
Seed/fixture: sintético. `e2e/support/seed.ts` está alterado na árvore, mas pela 14.0, fora desta revisão, como diz a seção "Fora desta correção".
Bloqueantes: nenhum.
Recomendações:
- Na rodada da 14.0, o `privacy-guardian` precisa olhar `e2e/support/seed.ts` e `e2e/grade-e-calendario.spec.ts`. É o seed que alimenta os traços das nove fatias publicados como artefato da esteira, e precisa seguir só com nome e matrícula fictícios.

Pergunta de fechamento: esta correção não muda nada no que o sistema guarda sobre um aluno nem em para onde isso é enviado, então a resposta continua a mesma de antes dela.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx (só as linhas 79, 88 e 276)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.github/workflows/ci.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/README.md

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-05 23:51:33 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

**Caminhos de escrita em Nota:** nenhum novo ou alterado. Os sete arquivos desta correção trocam nomes de tipo, contagens de fatias, uma tolerância de teste e texto. Nenhum lida com `Nota`, `Correcao` ou `lancadaPor`. Todos com autor humano? sim, porque esta correção não cria caminho de escrita.

**Decisão autônoma sobre aluno:** ausente. A correção não toca promoção, retenção, encaminhamento nem sugestão aplicada sozinha.

**Aprovação registrada:** ok. Nenhum agente nem fluxo de saída de IA mudou, e a exceção da D47 não aparece fora do tutor.

**Supervisão do tutor:** ok. O tutor não foi tocado.

**Autonomia declarada e visível:** sim. A declaração dos agentes e a tela de governança não mudaram.

**Bloqueantes:** nenhum.

O que conferi, arquivo por arquivo:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`: só três trocas de nome entram nesta correção: `interface Escolha` virou `ArquivoEscolhido` (linha 79), e os usos nas linhas 88 e 276 acompanham. A importação de alunos continua sem nota, conceito ou saída de IA. `PreviaDaEscolha` é nome de componente e não está no mapa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ler-planilha.ts`: `type Linha` virou `CelulasDaLinha`, com os três usos. O comportamento não muda.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts`: o job sintético só queima CPU, sem IA, aluno ou nota. A folga de 0,8 vale só para o tempo de relógio. A asserção de CPU continua exigindo os 300 ms inteiros.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.github/workflows/ci.yml`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/processo/esteira.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/README.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md`: só passam o e2e de oito para nove fatias. Nada disso toca a regra 70, e `docs/regulacao.md` não foi alterado.
- O documento da correção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`) não propõe nota em discursiva ou redação nem métrica sobre professor (itens 8 e 9), e não traz telas para conferir.

**Recomendações (não bloqueiam):**
- No runbook, o trecho da nona fatia diz "195 por fatia só com o commitado". Como 1562 ÷ 8 dá 195,25, o Playwright põe 196 casos nas primeiras fatias, uns 27 min, e a conclusão "no limite" continua valendo. Vale arredondar para cima, como foi feito nas outras fatias. Isso é texto de infraestrutura, fora da minha regra.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-05 23:51:35 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066` diz "195 por fatia só com o commitado". O Playwright reparte 1562 casos em oito fatias e a primeira leva 196 (1562 / 8 = 195,25). A conclusão continua certa: dá uns 27 min, ainda no limite de 197 casos. Só o número está um a menos. Vale trocar por 196, para a próxima pessoa que refizer a conta.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts:8-16`: o comentário de `FOLGA_DA_PAREDE` repete quase toda a seção "Causa" do documento. Duas linhas bastariam, uma para a razão entre CPU e parede vir do hipervisor e outra para o que os 80% ainda separam (espera de verdade e fila), com o resto apontando para a correção. O número também diverge: o comentário diz 275 ms e o documento mede 276.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md:1657` ainda descreve o teto de oito fatias (cerca de 1576 casos, uns 190 de margem). O texto é de registro e não está errado na data dele. Se o item continuar aberto para o Joaquim, cabe uma linha dizendo que agora são nove fatias, com teto de 1773.

O que conferi:
- **Renomeios:** `Escolha` virou `ArquivoEscolhido` nos três pontos de `ImportarPlanilha.tsx` (linhas 79, 88 e 276), e `Linha` virou `CelulasDaLinha` nos quatro de `ler-planilha.ts`. Nenhum dos dois nomes novos está nos mapas 9 e 13. O "Linha" que sobra em `ImportarPlanilha.tsx:494` é texto da interface, não identificador. O que sobra em `ler-planilha.ts:10` está num comentário.
- **Nona fatia:** a matriz, o `name` do job e o `--shard` em `ci.yml`, mais o `FATIAS_DO_E2E` em `esteira.ts`, passaram juntos de 8 para 9. Não sobrou `/8` em código, runbook nem README. As contas batem: 1580 / 9 dá 176 casos por fatia, e 197 × 9 dá o teto de 1773. Nada mais do job mudou (teto de 45 min, `fail-fast` e artefato do traço).
- **Job sintético:** a asserção de CPU do processo (`>= 300`) não mudou. As mutações 5 e 6 encaixam no código de `synthetic.ts:61-66` e na linha 108. Com 320 de exigência, o caso da fila ainda separa as duas situações: em paralelo daria perto de 200, com a fila de verdade fica perto de 367 nesta VM. Nenhuma linha de produção mudou.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-05 23:52:07 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A correção mexe na esteira (fatias do e2e), em teste do worker, em documentação e no renomeio de dois tipos locais na web. Nenhuma linha de produção muda no caminho de requisição, na fila ou na IA.
Rate limit: ok (não foi tocado)
Fila e prioridade: ok (não foi tocada). A sandbox sintética não mudou; só a asserção de parede do teste ficou mais folgada.
Concorrência: protegida (não foi tocada)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. O runbook "Esteira vermelha no e2e" foi atualizado junto com a matriz.
Bloqueantes: nenhum

O que conferi:
- **Total de fatias.** Está trocado para 9 nos quatro lugares: a matriz, o `name` do job e o `--shard` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.github/workflows/ci.yml` (linhas 94, 103 e 121), e `FATIAS_DO_E2E` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/processo/esteira.ts:161`. O teto de 45 min e as constantes de `prazo-do-e2e.ts` não mudaram, que é o remédio que o runbook manda.
- **Restos.** Nos dois arquivos de importação não sobra uso de `Escolha` nem de `Linha`. Os dois "Linha" que ainda aparecem são texto, um em comentário (`ler-planilha.ts:10`) e outro em JSX (`ImportarPlanilha.tsx:494`), e não são identificador.
- **Teste sintético.** A asserção de CPU do processo (`>= 300`) continua exata. As duas de parede caem para 240 e 320 e ainda separam espera de verdade de laço que não espera, e fila de execução em paralelo (o paralelo daria uns 200). O bloco de mutação do `threadsMaximo` sustenta isso.
- **Testes.** Rodei `tools/ci/esteira.test.ts`, `tools/renomear/restos.test.ts` e `apps/worker/src/processors/synthetic.test.ts` nesta árvore: 78 de 78 verdes. Nenhum chama provedor pago.

Recomendações:
- O item (e) em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md:1657` ainda diz "com oito fatias de e2e … o teto é de cerca de 1576 casos". O certo agora é nove fatias, cerca de 1773, com uns 190 de margem. A correção da oitava fatia (índice de achados, linha 607) deixou o mesmo resto.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066`, "195 por fatia só com o commitado" deveria ser 196. O Playwright arredonda para cima: 1562 casos em 8 fatias dão fatias de 196 e 195, e o que pesa é a maior. A conclusão "no limite" continua valendo (uns 27 min).
- Os avisos que o documento leva ao Orquestrador continuam valendo:
  - Se a proteção de branch exige `e2e N/8` como verificação obrigatória, a lista precisa passar para `1/9` a `9/9` no GitHub. Isso fica fora do repositório.
  - Até a primeira execução verde com nove fatias, o censo vai responder "incompleto", porque falta o artefato da fatia 9.

## test-engineer · 1ª rodada · APROVADO · 2026-11-05 23:52:59 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção mexe em tipos, na esteira e num teste. Não toca dado de escola, endpoint nem permissão, então os casos de isolamento, de permissão e de borda do domínio escolar não se aplicam. O que precisa ficar provado:
1. Um nome antigo dos mapas da X8 que volte a `ler-planilha.ts` ou a `ImportarPlanilha.tsx` deixa o teste dos restos vermelho.
2. Com oito fatias, a suíte de 1580 casos passa do teto, e o teste do teto cai.
3. Cada um dos quatro lugares em que o total de fatias está escrito (a matriz, o `--shard`, o `name` do job e `FATIAS_DO_E2E`) é conferido contra o tamanho da matriz.
4. Mesmo com a folga de 80%, a asserção de parede do job sintético ainda separa a fila (dois pedidos esperando a vez) da execução em paralelo.
5. A parede ainda prova que a thread espera a queima de fato.
6. A asserção de CPU do processo continua exata.
7. A concorrência é testada com chamadas paralelas de verdade.

**Cobertos:**
- 1: blocos 1 e 2 (`restos.test.ts`, com `falha: toEqual([])`).
- 2: bloco 3 (`esteira.test.ts`, "o teto do e2e cobre a suíte que existe").
- 3: blocos 4, 5 e 6. As asserções em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tools/ci/esteira.test.ts:347`, `:360` e `:450` montam o `/n` e a lista a partir de `fatiasDoE2e()`, então cada bloco cai no ponto certo.
- 4: bloco 7. Com `cpuMs / 2`, a fila termina perto de 200 ms de parede, abaixo dos 320 exigidos, e cai em `Math.max(...terminos)`.
- 5: bloco 8 cai, mas pela asserção de CPU, que vem antes. O documento diz isso abertamente, e o bloco 7 prova a mesma coisa no terceiro caso.
- 6: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts:45` continua `>= 300`, sem folga.
- 7: `synthetic.test.ts:67` dispara quatro chamadas a `queimar` em paralelo com `Promise.all`, não em sequência.

Rodei uma vez cada um e todos passaram: `synthetic.test.ts` 14 de 14, `restos.test.ts` 43 de 43, `esteira.test.ts` 21 de 21.

A folga de 0,8 não faz o teste depender de máquina folgada. As duas asserções de parede são limites mínimos, e carga na máquina só aumenta o tempo de parede, então elas ficam mais fáceis de cumprir, não mais difíceis. O código de produção mudou só em renomeios (`Escolha` → `ArquivoEscolhido`, `Linha` → `CelulasDaLinha`) e em números de fatia. Não há cláusula nova sem bloco, nenhum `.skip` e nenhum mock que esconda a regra.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066` está "195 por fatia só com o commitado". O Playwright reparte 1562 casos em 196, 196, 195 e seguintes, e a fatia 1 leva 196: uns 26,9 min, a um caso do limite de 197. O número a escrever é 196, como na esteira, que mostra 198 para os 1580 de hoje.
2. O comentário de `synthetic.test.ts:74-75` diz que "em paralelo total acabaria perto de 200". Isso só vale num runner com quatro núcleos ou mais; com dois, quatro threads também passariam de 320. Quem prova o teto de duas threads de fato é `maximoVisto` (`:72`), e não a parede. Vale dizer isso no comentário, para ninguém tirar o `maximoVisto` achando que a parede o cobre.
3. A linha 46 de `synthetic.test.ts` fica sem mutação que a isole, e o documento registra isso. Se ela for a única coisa que pega uma queima repartida entre várias threads (CPU certa e parede curta), um comentário no teste dizendo isso evita que alguém a apague como redundante.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 00:03:42 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

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
Recomendações: nenhuma nova. A da 1ª rodada sobre `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md:1657` (oito fatias, cerca de 1576 casos, quando já são nove fatias e cerca de 1773) continua na tabela "Recomendações sem aplicar" do documento da correção, com destino definido.

Esta rodada conferiu só o diff desde a aprovação anterior. Não havia correção exigida.

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts`:** mudaram só comentários. `FOLGA_DA_PAREDE` continua 0.8, a asserção de CPU continua exata, e o `maximoVisto` e as duas asserções de parede estão como estavam. O novo comentário do caso da fila está certo: com dois núcleos, quatro threads também passariam de 320 ms de parede. Por isso quem prova o teto de duas threads é o `maximoVisto`, e não a parede.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066`:** a conta fecha. 1562 casos em oito fatias dão 196 por fatia (arredondando 195,25 para cima). As outras contas do parágrafo também batem: 1580 em oito dão 198, e 1580 em nove dão 176.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`:** só ganhou a tabela de recomendações sem aplicar e a seção de revisões. Não tem efeito em carga.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 00:03:49 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a rodada 2 só muda comentários, o runbook e o próprio documento da correção; nenhuma asserção e nenhuma linha de produção mudaram)
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

O que conferi no diff desde a rodada aprovada:
- **Runbook.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066` agora diz 196, e a conta fecha: 1562 casos em 8 fatias dão 195,25, que arredonda para 196 por fatia. Os outros números do parágrafo também fecham (1580 em 8 dá 198; em 9 dá 176; 197 × 9 = 1773).
- **Teste do job sintético.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts`, o comentário encurtado de `FOLGA_DA_PAREDE` aponta para as medidas no documento da correção, e elas estão lá (linha 59: os 9% de diferença entre o tempo de CPU e o de parede, e os 276 ms de parede). A nota da linha 44 está certa: `process.cpuUsage` soma todas as threads, então só a asserção de parede pega a queima repartida entre várias threads. O comentário novo do caso da fila também está certo: quem prova o teto de duas threads é o `maximoVisto`.
- **Documento da correção.** A tabela "Recomendações sem aplicar" diz para onde vai cada item e por quê. O item do `TODO.md` fica fora porque não é arquivo desta correção, e o do seed do e2e vai para a rodada da 14.0. A seção "Revisões" foi preenchida pelo hook.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md:75` ainda diz que "o caso do meio continua provando a fila: em paralelo as quatro queimas acabariam perto de 200 ms". O comentário novo do teste diz o contrário: com poucos núcleos, até quatro threads passariam de 320 ms. Vale alinhar o texto do documento, dizendo que a parede prova a espera da fila e que o `maximoVisto` prova o teto de duas threads, para o registro não contradizer o teste.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 00:03:51 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a 1ª (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/2026-11-05-nona-fatia-diff-r2.diff`) e o que ele afeta. A 1ª rodada não exigiu nenhuma correção, então não havia correção para conferir. As quatro recomendações que o documento dá como aplicadas estão no diff: o runbook passou de 195 para 196, o comentário de `FOLGA_DA_PAREDE` foi encurtado, há uma nota antes da asserção de parede do primeiro caso e o comentário do caso da fila foi reescrito.

Campos pessoais tocados: nenhum. O diff só muda comentários de teste, uma contagem no runbook e o próprio documento da correção, com a tabela de recomendações e a de revisões.
Fora da tabela de dados do docs/lgpd.md: nenhum
Autorização por objeto: ok. O diff não traz rota, repository nem DTO.
Logs: limpos. Não há log novo, e os comentários novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts` falam só de CPU, de parede e de threads, sem dado de pessoa.
Auditoria: não se aplica. O diff não traz nenhuma ação que exija auditoria.
Envio externo: nenhum
Seed/fixture: sintético. O diff não toca seed nem fixture. As tabelas novas do documento da correção trazem só nomes de revisor, ids de agente e caminhos de arquivo.
Bloqueantes: nenhum
Recomendações:
- Fica de pé, para a rodada da 14.0, a recomendação que fiz na 1ª e que o documento já registrou: conferir que `e2e/support/seed.ts` e `e2e/grade-e-calendario.spec.ts` usam só nome e matrícula fictícios, porque o seed alimenta as nove fatias.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 00:03:57 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. A rodada 2 só muda comentários de teste, uma linha do runbook e o próprio documento da correção. Todos com autor humano? sim (nenhum caminho foi criado nem alterado).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (o diff não toca saída de IA nem fluxo de entrega)
Supervisão do tutor: ok (o diff não toca o tutor)
Autonomia declarada e visível: sim (sem mudança; o diff não toca governança nem agentes)
Bloqueantes: nenhum
Recomendações: nenhuma nova

O que conferi nesta rodada:

- **Correções exigidas na 1ª rodada:** nenhuma. Não há o que cobrar.
- **Diff desde a rodada aprovada** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/2026-11-05-nona-fatia-diff-r2.diff`):
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts`: só comentários mudaram. `FOLGA_DA_PAREDE` continua 0,8 e as asserções das linhas 45 e 76 são as mesmas da 1ª rodada. O teste é da sandbox de CPU do job sintético, sem Nota, IA, tutor nem dado de aluno.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066`: troca "195" por "196" na contagem de casos por fatia do e2e. É texto de infra, fora da regra 70.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`: ganhou a tabela "Recomendações sem aplicar" e a seção "Revisões" preenchida. Nenhuma das duas recomendações que ficaram sem aplicar toca a regra 70: uma é a contagem no `TODO.md`, a outra é o seed sintético do e2e, que fica para a rodada da 14.0 com o `privacy-guardian`.
- Confirmei que o diff está aplicado na árvore de trabalho. Os outros arquivos da correção (`.github/workflows/ci.yml`, `README.md`, `tools/processo/esteira.ts` e os renomeios em `ImportarPlanilha.tsx` e `ler-planilha.ts`) não mudaram desde a 1ª rodada, então não os auditei de novo.

Não houve fotos da tela neste prompt, então não conferi nada visualmente.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 00:04:11 · `tasks/correcoes/2026-11-05-nona-fatia-do-e2e-e-restos-da-13.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada, que não mudaram:
- a sandbox queima de verdade os `cpuMs` pedidos, medidos em CPU do processo e em tempo de parede;
- a fila respeita o teto de threads (quatro pedidos em duas threads);
- `cpuMs` zero não ocupa thread;
- o event loop continua girando durante a queima;
- as nove fatias do e2e e a conta do runbook.

**Cobertos:** todos, pelos mesmos testes da 1ª rodada. Nesta rodada conferi só o diff desde a aprovação (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/2026-11-05-nona-fatia-diff-r2.diff`):
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/src/processors/synthetic.test.ts`:** mudaram só comentários. Nenhuma asserção mudou desde a 1ª rodada: a de CPU segue exata (`>= 300`), e as de parede seguem em `300 * FOLGA_DA_PAREDE` e `2 * 200 * FOLGA_DA_PAREDE`. Os comentários novos estão certos:
  - A nota da parede do primeiro caso confere. Com `process.cpuUsage` somando o processo inteiro, uma queima repartida entre N threads daria a CPU certa e parede de uns 300/N, e só a asserção de parede pega isso.
  - O comentário do caso da fila diz que é o `maximoVisto` que prova o teto de duas threads. É o que eu tinha recomendado, e protege contra alguém tirar essa asserção achando que a de parede basta.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/runbook.md:1066`:** o 196 está certo, porque 1562 casos em 8 fatias dão 195,25, arredondados para cima. Os números vizinhos também conferem: 1580/8 dá 198 e 1580/9 dá 176.
- **Documento da correção:** as recomendações que ficaram sem aplicar estão registradas, cada uma com o seu destino. A seção de revisões foi preenchida pelo hook.
- Rodei `npx vitest run apps/worker/src/processors/synthetic.test.ts` a partir da raiz e passaram 14 de 14. Rodado de dentro de `apps/worker`, o arquivo não chega a carregar porque o pacote `@educa/shared` não resolve. Isso é só a forma de rodar, não um defeito da correção.

**Bloqueantes:** nenhum. Não há `.skip`, teste comentado, mock que esconda a regra, nem asserção afrouxada desde a rodada aprovada.

**Recomendações:** nenhuma nova. As duas que ficaram sem aplicar estão registradas com destino no documento da correção:
- a linha `TODO.md:1657`, que ainda fala em oito fatias e cerca de 1576 casos;
- o olhar do `privacy-guardian` sobre `e2e/support/seed.ts` e `e2e/grade-e-calendario.spec.ts` na rodada da 14.0.
