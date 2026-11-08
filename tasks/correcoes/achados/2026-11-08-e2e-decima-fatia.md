# Achados das revisões — `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 15:04:37 · `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só muda o número de fatias do e2e, de 9 para 10. Isso fica em quatro lugares: a matriz, o `name` e o `--shard` em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`. O resto é texto em `docs/runbook.md` e `README.md`.

Fora da tabela de dados do docs/lgpd.md: nada. A correção não traz campo novo.

Autorização por objeto: não se aplica. A correção não cria nem altera rota, repository ou query.

Logs: limpos. Não há log novo.

Auditoria: não se aplica. A correção não toca nenhuma ação que exija auditoria.

Envio externo: nenhum envio novo de dado pessoal. A décima fatia publica os mesmos dois artefatos que as outras já publicam: `traco-do-e2e-10`, só quando a fatia falha ou é cancelada, e o relatório JSON do censo. Os dois ficam 7 dias e também sobem em PR, num repositório público. Os comentários do `ci.yml` (linhas 124 a 147) já dizem que isso só é seguro porque todo dado do e2e é sintético (regra 20, item 17). A fatia nova não muda essa condição: os passos de upload, a retenção e o `path` continuam iguais.

Seed/fixture: sintético. A correção não toca seed nem fixture. O spec novo que motivou a fatia, `e2e/esqueci-a-senha.spec.ts`, pertence à tarefa 6.0 e está fora desta revisão.

Bloqueantes: nenhum.

Recomendações:
- Quando o privacy-guardian auditar a 6.0, confirmar que `e2e/esqueci-a-senha.spec.ts` só usa e-mail e nome sintéticos. A partir desta correção ele roda numa fatia cujo traço e cujo censo são públicos quando sobem por PR. Fluxo de "esqueci a senha" lida com e-mail, e um endereço real ali vazaria pelos artefatos.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma de antes, e esta correção não tem como mudá-la.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.github/workflows/ci.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-e2e-decima-fatia.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 15:04:50 · `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção não tem Tech Spec. Ela segue o remédio que `docs/runbook.md` dá em "Esteira vermelha no e2e" e o precedente da nona fatia.
Portão local: carimbo válido. Os portões que passaram foram typecheck, lint, segredo, dependências, unidade e alvo.
Bloqueantes: nenhum
Recomendações:
- **Conta do runbook.** Conferi os números e eles batem. No HEAD, 1762 casos em nove fatias dão 196 por fatia, uns 27 min. Com o spec da 6.0 são 1800 casos: 200 por fatia em nove, uns 28 min; e 180 por fatia em dez, uns 25 min. O novo limite é de 1970 casos, com folga de uns 170.
- **Os quatro lugares do total de fatias.** Todos foram trocados para dez, sem sobra de `/9` no repositório:
  - a matriz em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.github/workflows/ci.yml:103`;
  - o `name` do job em `ci.yml:94`;
  - o `--shard` do passo em `ci.yml:121`;
  - `FATIAS_DO_E2E` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/esteira.ts:161`.
- **Mutações.** Os nomes de teste citados nos quatro blocos existem em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/esteira.test.ts` (linhas 341, 355, 439 e 466). Cada bloco é pego pela asserção certa: o tamanho da matriz contra o `--shard` e o `name`, e `FATIAS_DO_E2E` contra `fatiasDoE2e()`.
- **Texto velho fora desta correção.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md:1695`, item (e), ainda fala em oito fatias e teto de uns 1576 casos. Já estava velho antes desta correção e não bloqueia. Vale atualizar o item ou fechá-lo na próxima passada do Orquestrador, como já anotado no `estado.md` de `onboarding-por-convite`.
- **Avisos que vão para o relatório ao Orquestrador.** O documento já registra os três; repasso para não se perderem:
  - o push exige o escopo `workflow` no token do gh;
  - a proteção de branch troca de `e2e N/9` para `1/10` a `10/10`, configuração fora do repositório;
  - o censo vai responder "incompleto" até a primeira execução verde com dez fatias.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 15:05:05 · `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A correção só mexe na esteira de CI (o e2e passa de nove para dez fatias) e na documentação dela.
Rate limit: ok. A correção não toca limite.
Fila e prioridade: ok. A correção não toca a fila.
Concorrência: protegida. A correção não grava nada. As fatias são jobs independentes, cada uma com o seu compose, o `fail-fast` continua `false` e o artefato continua um por fatia (`traco-do-e2e-<i>`).
Índice e paginação: ok. A correção não traz query.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. O runbook em "Esteira vermelha no e2e" foi atualizado para dez fatias, e a conta confere: 1800 casos em dez fatias dão 180 por fatia, uns 25 min, abaixo dos 27 min (60% do teto). O limite de 197 casos por fatia dá 1970 no total. O teto de 45 min e as constantes de `tools/ci/prazo-do-e2e.ts` não mudaram.
Bloqueantes: nenhum. O total de fatias foi trocado nos quatro lugares onde aparece:
- a matriz em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.github/workflows/ci.yml:103`
- o `name` do job em `ci.yml:94`
- o `--shard` do passo em `ci.yml:121`
- `FATIAS_DO_E2E` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/esteira.ts:161`

Rodei `tools/ci/esteira.test.ts` com a árvore da 6.0: 21 de 21 verdes. Não sobrou nenhum `/9` nem "nove fatias" sem trocar no código nem no README. O único "nove fatias" que resta está em `docs/runbook.md:1176`, e é o histórico da troca.

Recomendações:
- No relatório ao Orquestrador, levar os três avisos que a correção já registra. O push exige o escopo `workflow` no token do gh. A proteção de branch precisa passar de `e2e N/9` para `1/10` a `10/10`, e isso é feito fora do repositório. O censo vai responder "incompleto" até a primeira esteira verde com dez fatias.
- Rever a conta das fatias quando a suíte chegar perto de 1970 casos: com a décima, a folga é de uns 170 casos.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 15:05:39 · `tasks/correcoes/2026-11-08-e2e-decima-fatia.md`

VEREDITO: APROVADO

Cenários exigidos: esta correção mexe só na esteira. Ela não toca dado de escola, permissão, IA nem operação que possa acontecer duas vezes ao mesmo tempo, então não se aplicam os casos de borda do domínio escolar, de isolamento ou de concorrência. O que a correção precisa provar:
- A suíte com a 6.0 (1800 casos) cabe no teto em cada fatia.
- A matriz, o `name` do job, o `--shard` e `FATIAS_DO_E2E` dizem o mesmo total.
- Nenhum dos quatro lugares pode voltar a 9 sem que um teste fique vermelho.

Cobertos:
- **Teto por fatia:** `tools/ci/esteira.test.ts › o teto do e2e cobre a suíte que existe, fatia a fatia e com folga` passou. Rodei o arquivo e deu 21 de 21 verdes com o spec da 6.0 na árvore. A conta do documento confere: 180 casos por fatia em dez dá uns 25 min, e 197 × 10 = 1970, cerca de 170 acima de 1800.
- **Os quatro lugares, um bloco de mutação cada, todos com teste que lê o valor:**
  - Matriz: o teste do teto (`tools/ci/esteira.test.ts:466`) recalcula as fatias com `fatiasDoE2e().length` e falha em `toBeLessThanOrEqual`, que é o motivo certo. Os testes das linhas 341, 355 e 439 também falhariam, porque comparam os outros lugares com o tamanho da matriz.
  - `--shard`: `tools/ci/esteira.test.ts:347`, dentro de "tem os jobs verificar, integracao, infra e e2e", monta o argumento esperado com o tamanho da matriz.
  - `name` do job: `tools/ci/esteira.test.ts:360`, dentro de "o e2e roda em fatias que não se cancelam".
  - `FATIAS_DO_E2E`: `tools/ci/esteira.test.ts:450` compara a lista com a matriz.
- **Censo:** `tools/processo/esteira.test.ts`, o outro arquivo que importa `FATIAS_DO_E2E`, deu 35 de 35 verdes com o 10 acrescentado.
- **Restos de "nove":** procurei `/9` e "nove fatias" em docs, tools, apps e no workflow. A única ocorrência é a frase histórica do runbook (linha 1176), que está certa onde está.
- **O que não há:** nenhum `.skip`, nenhum mock, nenhum provedor de IA. O documento não acrescenta teste novo, e isso se justifica: o teste do teto é a regra, e a correção muda o que ele lê.

Bloqueantes: nenhum.

Recomendações:
- O bloco de mutação da matriz (`tasks/correcoes/2026-11-08-e2e-decima-fatia.md:56-62`) só fica vermelho no teste do teto com o `e2e/esqueci-a-senha.spec.ts` da 6.0 na árvore. Se a correção for commitada sozinha, o HEAD tem 1762 casos: voltar a matriz para 9 dá 196 por fatia, uns 27 min, no limite e não acima dele. Nesse caso o teste citado não fica vermelho por esse motivo. A cláusula continua protegida, porque os testes das linhas 341, 355 e 439 pegam a divergência com o `/10`. Vale uma frase no documento dizendo que o vermelho por `toBeLessThanOrEqual` depende da 6.0 estar na árvore, para a validação e a retro não estranharem se refizerem a mutação em outro estado.
- Os três avisos ao Orquestrador já estão na seção Correção do documento e devem chegar ao relatório:
  - O push precisa do escopo `workflow` no token do gh.
  - Se a proteção de branch exige `e2e N/9` como verificação obrigatória, a lista tem de trocar para `1/10` a `10/10`, fora do repositório.
  - Depois do merge, o censo responde "incompleto" até a primeira execução verde com dez fatias.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.github/workflows/ci.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/processo/esteira.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/esteira.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-e2e-decima-fatia.md
