# Achados das revisões — `tasks/correcoes/2026-10-29-links-do-runbook.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-29 20:08:17 · `tasks/correcoes/2026-10-29-links-do-runbook.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. Só mudaram a anotação `runbook_url` dos 14 alertas, a constante da guarda e o teste dela. Expressão de alerta, limiar, rótulo e janela ficaram iguais.

Rate limit: ok, a tarefa não mexe nele.

Fila e prioridade: ok, a tarefa não mexe nelas.

Concorrência: protegida. A tarefa não tem caminho de escrita.

Índice e paginação: ok, a tarefa não tem query.

Degradação de IA: não se aplica.

Migration: não se aplica.

Métrica e alerta: ok.
- Os 14 arquivos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/infra/grafana/alertas/` apontam para `https://github.com/Turmma/turmma/blob/main/docs/runbook.md#…`, cada um com a mesma âncora de antes. Nenhum `runbook_url` ficou fora do prefixo novo, e não sobrou `LitzGab` em `infra/`.
- O diff só troca a linha `runbook_url` em cada arquivo.
- Rodei `tools/guardas/alerta-tem-runbook.test.ts`: 10 de 10 passaram. Os dois testes novos fixam o endereço atual por extenso e provam que a guarda reprova os dois endereços antigos (`LitzGab/Educa.ia` e `LitzGab/Turmma.ai`) mesmo com a entrada certa no runbook. Assim o teste deixa de passar com qualquer endereço, como antes.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tools/guardas/alerta-tem-runbook.test.ts:63-66`: o primeiro teste novo confere o prefixo dos alertas com uma regex própria, e a guarda já faz essa conferência pelo `ENDERECO_DO_RUNBOOK`. Basta fixar a constante (`toBe`) e deixar a guarda checar os arquivos. A troca de dono do repositório passaria a mexer num lugar a menos no teste.
- Para a validação: a âncora com acento (`#login-recusado-pelo-semáforo-do-hash`, `#incidente-sem-confirmação-em-24-h`) depende de como o GitHub gera o slug do título. Vale abrir um dos links depois do push para a `main` do repositório novo e confirmar que cai na seção certa. A guarda confere que a entrada existe no runbook, mas não confere o slug que o GitHub gera.

## test-engineer · 1ª rodada · APROVADO · 2026-10-29 20:08:27 · `tasks/correcoes/2026-10-29-links-do-runbook.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** os 14 `runbook_url` de `infra/grafana/alertas/` e a constante `ENDERECO_DO_RUNBOOK` apontam para `https://github.com/Turmma/turmma/blob/main/docs/runbook.md#`. Cada um mantém a sua âncora, e a guarda aceita todos.
- **Borda 1:** um alerta que ainda aponta para `LitzGab/Educa.ia` é reprovado, mesmo com a entrada certa no runbook.
- **Borda 2:** um alerta que aponta para o endereço intermediário `LitzGab/Turmma.ai` também é reprovado.
- **Borda 3:** a constante e os arquivos não podem andar juntos para um endereço errado. Um teste fixa o endereço por extenso, sem importar a constante.
- **Permissão e isolamento:** não se aplicam. A correção não toca dado de escola, endpoint nem dado de pessoa.

**Cobertos** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tools/guardas/alerta-tem-runbook.test.ts`):
- **Caminho feliz:** `o endereço do runbook é o do repositório atual, na organização Turmma` (linhas 62 a 67). Ele compara a constante com o literal e confere com uma regex fixa o `runbook_url` de cada regra dos 14 arquivos. O teste que já existia (linha 43) também passa a exigir o prefixo novo nos 14 arquivos, porque roda `problemasDeRunbook` sobre o repositório.
- **Bordas 1 e 2:** `reprova: runbook_url com o endereço antigo do repositório, mesmo com a entrada certa no runbook` (linhas 69 a 74). Ele cobre os dois endereços antigos e confere a mensagem exata, e não só que algo falhou.
- **Borda 3:** coberta pela comparação com o literal e pela regex sem constante, as duas no teste da linha 62.
- **Mutação declarada:** o bloco do documento volta a constante para o endereço antigo. O teste citado fica vermelho por asserção, porque `toBe` compara com o literal; não há erro de carga. Com a mesma mutação, o teste das linhas 69 a 74 também ficaria vermelho, porque o endereço `Educa.ia` passaria a ser aceito.
- **Diff contra as mutações:** o diff só troca o valor de uma constante e o prefixo de 14 linhas de dado YAML. Não há cláusula nova com condição, e a constante tem o seu bloco. As 14 linhas de YAML são cobertas pela regex e pela linha 43.
- **Sem `.skip`, teste comentado ou mock.** A correção não toca IA nem tem concorrência.
- **Teste rodado:** `npx vitest run tools/guardas/alerta-tem-runbook.test.ts` deu 10 de 10 verdes.
- **Busca do endereço antigo:** `git grep LitzGab` fora de `tasks/` só encontra o que o documento deixa de propósito: `CLAUDE.md:12`, `docs/mvp-rapido.md:23`, as amostras de `tools/processo/__fixtures__/esteira/` e o próprio teste.

**Bloqueantes:** nenhum.

**Recomendações:**
- **Regex duplicada.** A regex da linha 65 repete o literal da linha 63. Se o repositório mudar de novo, os dois lugares precisam mudar juntos. Uma `const ENDERECO_ESPERADO` local no teste, sem importar da guarda, resolveria e manteria a independência da constante.
- **Nome antigo no ajudante.** O ajudante `arquivoDeRegra` (linha 14) ainda gera `folder: Educa.ia alertas`. É só amostra de teste e não afeta a regra; vale ajustar quando a renomeação técnica chegar (X8).

## revisor-geral · 1ª rodada · APROVADO · 2026-10-29 20:08:29 · `tasks/correcoes/2026-10-29-links-do-runbook.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mudou só o que o documento pede: o prefixo em `ENDERECO_DO_RUNBOOK` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tools/guardas/alerta-tem-runbook.ts:16`), o `runbook_url` dos 14 arquivos de `infra/grafana/alertas/` com a âncora de cada um igual, e dois testes novos. Fora dos lugares que o documento deixa de propósito, não sobrou nenhum `LitzGab` nem `Educa.ia/blob` no repositório. Conferi um por um os lugares deixados: `CLAUDE.md:12`, `docs/mvp-rapido.md:23`, as amostras de `tools/processo/__fixtures__/esteira/` e os registros em `tasks/`. A justificativa de cada um se sustenta.

Aderência à Tech Spec: ok. É correção e não tem seção da Tech Spec. O endereço novo bate com o repositório que o `CLAUDE.md` declara (`Turmma/turmma`).

Portão local: carimbo válido. O `conferir` diz que o portão vale para o código atual e lista typecheck, lint, segredo, dependencias, unidade e alvo. A mutação declarada devolve a constante ao endereço antigo, e o teste citado, que fixa o endereço por extenso, falha com ela.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tools/guardas/alerta-tem-runbook.test.ts:64-66`: o laço sobre os arquivos do repositório repete o que o primeiro caso já cobre, porque `problemasDeRunbook` exige o prefixo de `ENDERECO_DO_RUNBOOK`, e a linha 63 já fixa essa constante por extenso. Bastava a linha 63, e o caso ficaria mais curto.
- O nome de pasta `folder: Educa.ia alertas`, no texto montado em `tools/guardas/alerta-tem-runbook.test.ts:14`, e o diagnóstico em `tasks/prd-reengenharia/diagnostico/U12.md:110`, que fala em "13 regras" quando são 14, ficam como estão. Não são link. Se o U12-10 for marcado como resolvido, vale anotar lá esta correção.

## test-engineer · 2ª rodada · APROVADO · 2026-10-29 20:13:28 · `tasks/correcoes/2026-10-29-links-do-runbook.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: cada um dos 14 alertas do repositório aponta para `https://github.com/Turmma/turmma/blob/main/docs/runbook.md#<entrada>`, e a entrada existe no runbook.
- Borda: o primeiro endereço antigo (`LitzGab/Educa.ia`) é reprovado, mesmo quando a entrada certa existe no runbook.
- Borda: o endereço do meio (`LitzGab/Turmma.ai`) é reprovado do mesmo jeito.
- Borda: a constante fica presa ao texto completo do endereço novo, e não só ao próprio valor dela.
- Permissão e isolamento: não se aplicam. É endereço de link na infra, sem dado de escola nem papel.

**Cobertos:**
- O que mudou nesta rodada é só a retirada do laço da linha 65, que era a minha recomendação da 1ª rodada. Nada se perdeu com isso:
  - `alerta-tem-runbook.test.ts:63` prende `ENDERECO_DO_RUNBOOK` ao texto completo do endereço novo.
  - `alerta-tem-runbook.test.ts:43` exige `problemasDeRunbook(arquivos, runbookDoRepositorio)` vazio sobre os 14 arquivos reais. Pela guarda, `alerta-tem-runbook.ts:91`, isso cobra `startsWith(ENDERECO_DO_RUNBOOK)` de cada `runbook_url`.
  - Juntas, as duas linhas cobram dos 14 arquivos o prefixo da organização Turmma, que era o que o laço retirado verificava.
  - Se um YAML voltar ao endereço antigo, a linha 43 fica vermelha. Se a constante voltar, fica vermelha a linha 63, que é a mutação declarada.
- `alerta-tem-runbook.test.ts:66-71` prova a reprovação dos dois endereços antigos, com a mensagem exata.
- A mutação declarada continua alcançando a cláusula alterada, a constante. Nenhum `.skip`, nenhum teste comentado, nenhum mock.
- Rodei `npx vitest run tools/guardas/alerta-tem-runbook.test.ts` e os 10 testes passaram.

**Bloqueantes:** nenhum.

**Recomendações:**
- A da 1ª rodada (a regex repetia o literal da linha 63) foi resolvida pela retirada do laço.
- O ajudante `arquivoDeRegra` ainda grava `folder: Educa.ia alertas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tools/guardas/alerta-tem-runbook.test.ts:14`). Continua anotado para a X8, como está na tabela "Recomendações sem aplicar".

## revisor-geral · 2ª rodada · APROVADO · 2026-10-29 20:13:30 · `tasks/correcoes/2026-10-29-links-do-runbook.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (é uma correção, sem seção de Tech Spec própria. A troca do endereço nos 14 alertas e na guarda fica dentro do que o documento pede.)
Portão local: carimbo válido. O `conferir` passou com typecheck, lint, segredo, dependências, unidade e alvo.
Bloqueantes: nenhum

Nesta rodada só saiu o laço do teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tools/guardas/alerta-tem-runbook.test.ts:62`, e nada se perdeu com isso. A guarda ainda reprova qualquer `runbook_url` que não comece com o endereço novo (`tools/guardas/alerta-tem-runbook.ts:91`). O primeiro teste (`alerta-tem-runbook.test.ts:45`) exige que os 14 alertas do repositório não tenham problema nenhum. O teste da linha 66 cobre os dois endereços antigos. Nenhum arquivo em `infra/grafana/alertas/` ainda traz `LitzGab`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-29-links-do-runbook/tasks/correcoes/2026-10-29-links-do-runbook.md:70` diz que a recomendação do `infra-guardian` vai para o `TODO.md`: abrir, depois do push, um link com âncora acentuada. O `TODO.md` não está entre os arquivos alterados. Falta incluir a linha nesta correção, ou deixar escrito quem a inclui no pouso. Se ninguém fizer, ela some.
