# Achados das revisões — `tasks/correcoes/2026-11-21-inventario-no-portao.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 00:30:31 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe no processo de build. Ela acrescenta uma tabela que liga um caminho ao seu inventário, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.ts`, liga essa tabela ao `alvosDoPortao` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts`, e altera texto no `executar-task` e no `TODO.md`. Não há migration, schema, repository, endpoint, DTO nem tela.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: não se aplica, porque nenhuma rota foi criada ou alterada.
Logs: limpos. Os arquivos novos não emitem log.
Auditoria: não se aplica. Nenhuma ação desta tarefa exige auditoria pela regra 20, item 10.
Envio externo: nenhum.
Seed/fixture: sintético. O teste usa apenas caminhos de arquivo fictícios, como `0066_catalogo.sql` e `apps/api/src/x.ts`, sem nenhum dado de pessoa.
Bloqueantes: nenhum.
Recomendações:
- Para a minha regra, a mudança ajuda. O `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` passa a rodar com toda migration, e ele é a prova citada na regra 20, item 3 (adaptação no lugar de diagnóstico), e na regra 70 (`lancadaPor`, D55, D66). Assim, uma coluna nova que viole essas regras é barrada já no portão da tarefa, e não só na esteira. Se uma tarefa futura criar uma guarda de schema que confira campos proibidos para aluno (e-mail, telefone, CPF, foto, endereço, nascimento), vale incluir uma linha para ela na `INVENTARIOS_DO_PORTAO`.

Rodei o teste novo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.test.ts`) e os 5 casos passaram. Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado, então a resposta continua a mesma de antes.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 00:30:33 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança fica toda em ferramenta de processo (o portão local, a skill `executar-task` e o `TODO.md`). Todos com autor humano? sim, porque não há caminho novo nem alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo de saída de IA foi criado ou alterado.

Supervisão do tutor: ok. Nada do tutor foi tocado.

Autonomia declarada e visível: sim. A declaração dos agentes e a tela da governança não mudaram.

Bloqueantes: nenhum.

O que a tarefa faz: quando o diff toca `packages/core/drizzle/`, o portão passa a rodar `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, mesmo que esse teste não tenha mudado. Quando toca `infra/compose.yml`, roda `tools/ci/compose.int.test.ts`. A lista dos dois casos fica em `tools/processo/inventarios-do-portao.ts`, e a ligação ao portão está em `tools/processo/portao.ts:119-121`. O `mvp-tables.int.test.ts` é o teste que a regra 70 cita para provar os itens 1 (Nota com autor humano), 2a (nenhum campo de nota ou devolutiva de IA em discursiva e redação, a D55) e 7. Com a mudança, toda migration nova passa por ele já no portão da tarefa, e não só na esteira. A regra 70 fica mais protegida, não menos.

Os arquivos `docs/regulacao.md` e `.claude/rules/70-conformidade-cne.md` não mudaram, e nenhum texto novo contradiz a regra. A tarefa não tem tela, então não havia fotos para conferir.

Recomendações:
- Quando outros testes que provam a regra 70 entrarem nessa lista, a escolha deve seguir os mesmos critérios. Um exemplo seria o `apps/api/src/assistente/assistente.int.test.ts`, puxado por mudanças nos prompts ou nas tasks de IA de discursiva e redação. Não exijo nada agora: a tarefa ficou de propósito nos dois casos que quebraram na F4.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-21-inventario-no-portao.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 00:30:33 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A tarefa não cria migration nem schema.

Queries verificadas: nenhuma. Não há repository, query nem endpoint no diff. Só mudam ferramentas do processo e documentação:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md`

Teste de isolamento: não se aplica. A tarefa não toca dado de escola, então não precisa de teste de isolamento novo. Ela reforça o isolamento de forma indireta. Agora, qualquer arquivo alterado em `packages/core/drizzle/` faz o portão rodar `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`. Esse teste confere `escola_id` e as FKs que começam por `escola_id` (linha 39). Antes, o portão da tarefa não o rodava quando só a migration mudava. Os 5 casos de `tools/processo/inventarios-do-portao.test.ts` passaram quando rodei aqui.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.ts:15`: um arquivo alterado em `packages/core/src/db/schema/` sem migration não puxa o inventário das tabelas. O teste exige que `schema/mvp/tabela.ts` fique fora. Vale registrar para a retro se mudança de schema sem migration deve puxar o mesmo inventário, já que é ali que o `escolaId` é declarado.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md:239-242`: o texto cita `tools/ci/compose.int.test.ts` duas vezes, uma como "automático" e outra como "à mão". Fica mais claro dizer que ele é automático só para `infra/compose.yml`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 00:30:36 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Uma correção não tem Tech Spec, então o documento da correção é a referência, e a implementação faz o que ele descreve. O item M2 do `TODO.md` mandava pôr a tabela em `tools/processo/sequencia-do-portao.ts`, mas ela foi para um módulo novo chamado de `alvosDoPortao`. O documento da correção diz isso, e o lugar é o certo: `sequencia-do-portao.ts` cuida da ordem dos comandos, e quem decide quais testes rodam é `alvosDoPortao`. Não bloqueia.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts:106-115`: o comentário de `alvosDoPortao` ainda diz que os alvos são "tirados do que está alterado na árvore". Agora entram também os inventários do que o diff toca. Falta uma frase no próprio comentário, e não só na linha 120, para o próximo leitor não achar que a função ainda olha só o diff.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md:3016`: o item marcado como feito ainda começa por `tools/processo/sequencia-do-portao.ts`, onde a tabela não está. O destino real está na nota do "feito", mas o texto seguinte ainda engana. Vale riscar ou trocar o nome do arquivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md:242`: o trecho "`tools/ci/compose.int.test.ts` (serviços, fora o `infra/compose.yml`)" não diz qual outro arquivo de compose continua sendo à mão. Dizer o caso concreto (ou tirar a menção) evita que alguém leia que o compose ainda precisa ser lembrado sempre.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 00:31:14 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

```
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
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md:242 — "`tools/ci/compose.int.test.ts` (serviços, fora o `infra/compose.yml`)" pode confundir: o inventário de serviços só confere o `infra/compose.yml`. Vale escrever qual outro arquivo ainda obriga a rodar esse teste à mão, ou tirar o item da lista.
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md:3016 — a entrada fechada ainda cita `tools/processo/sequencia-do-portao.ts`, mas o código foi para `tools/processo/inventarios-do-portao.ts`. A nota "feito" já diz isso. Ajustar o texto ou deixar como histórico.
```

A mudança fica toda nas ferramentas do processo: o portão local (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.ts`) e a documentação dele. Nada entra no request, na fila, no gateway de IA, no banco ou no deploy. Por isso os itens de 1 a 10 estão marcados como ok ou "não se aplica": o código não mexe nesses pontos.

Os 5 testes novos e os 1654 testes de `tools/processo/` passam. Nenhum deles chama provedor pago.

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 00:31:39 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** uma migration em `packages/core/drizzle/` puxa `mvp-tables.int.test.ts`, e `infra/compose.yml` puxa `tools/ci/compose.int.test.ts`. Os dois entram em `alvos.integracao`, mesmo sem nenhum teste alterado.
- **Borda 1:** o diário e os snapshots (`meta/_journal.json`, `meta/*_snapshot.json`) também contam como toque. Não é só o `.sql`.
- **Borda 2:** `infra/compose.carga.yml` e outros `.yml` de `infra/` não puxam o inventário do compose.
- **Borda 3:** quando o próprio inventário também mudou, ele não roda duas vezes.
- **Borda 4:** um diff que não toca nada inventariado não ganha alvo.
- **Borda 5:** cada inventário da tabela existe na árvore e nenhum se repete, para a linha não apodrecer quando o arquivo for renomeado.
- **Permissão e isolamento:** não se aplicam. É ferramenta do processo e não toca dado de escola nem de pessoa.
- **Concorrência:** não se aplica. É uma função pura sobre uma lista de caminhos.

**Cobertos:** todos, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/inventarios-do-portao.test.ts`.
- O caminho feliz e a borda 3 estão no caso "o inventário entra nos alvos de integração, uma vez…", nas linhas 23 a 31.
- A borda 1 está nas linhas 12 a 16.
- A borda 2 está nas linhas 18 a 21.
- A borda 4 está nas linhas 33 a 35.
- A borda 5 está nas linhas 37 a 44.

As asserções comparam o resultado inteiro com `toEqual` (integracao, e2e, infra e processo). Não conferem só que o código rodou.

O que conferi:
- **As cinco mutações chegam à cláusula pelo motivo certo** (conferi lendo o código e o teste, sem mutar):
  - `startsWith('infra/compose')`: o caso do `compose.carga.yml` passa a receber o inventário e cai.
  - `endsWith('.sql')`: o diário e o snapshot passam a dar `[]` e o caso cai.
  - Tirar o filtro: o caso "quem não toca…" recebe os dois inventários e cai.
  - Tirar o `inventariosDosAlterados` do `alvosDoPortao`: a integração fica vazia e o caso do sintoma cai.
  - Tirar o `Set`: o inventário aparece duas vezes e a linha 30 cai.
- **`--faltando`:** o comando diz que nenhuma linha nova com condição ficou sem bloco. Bate com o que o documento declara.
- **Testes rodados:** o teste novo passou (5 casos). Os outros dois que usam `alvosDoPortao`, `tools/processo/revisoes.test.ts` e `tools/ci/e2e-que-cita-literal.test.ts`, também passaram (356 casos).
- **O inventário roda de verdade:** `tools/ci/compose.int.test.ts` é do projeto `integracao` do `vitest.config.ts`, porque só infra e processo ficam de fora. A sequência roda os alvos com `--project integracao`.
- **Nada desligado nem escondido:** não há `.skip`, teste comentado nem mock. Não há IA envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Outros arquivos que o inventário do compose lê ainda ficam de fora.** `tools/ci/compose.int.test.ts` lê também o `.env.example` (linha 34) e os estágios `FROM … AS` dos Dockerfiles (linha 60). Mexer num deles não puxa o inventário. A correção cumpre o que o item do `TODO.md` pedia, mas o documento diz "Fora desta correção: nada". Vale escrever esse resto lá, ou abrir um item novo no `TODO.md` para a próxima linha da tabela.
2. **Texto da skill.** No `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md`, "serviços, fora o `infra/compose.yml`" ficaria mais claro como "o que o compose.int lê além do `infra/compose.yml`: Dockerfile e `.env.example`".
3. **Linha `falha:` nas mutações.** Os blocos 2, 4 e 5 não trazem a linha `falha:`. Não é exigida, mas ajuda quem lê o vermelho.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 00:39:45 · `tasks/correcoes/2026-11-21-inventario-no-portao.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (é uma correção de processo e não tem seção de Tech Spec. O plano citava `sequencia-do-portao.ts`, mas a tabela ficou em `inventarios-do-portao.ts`. Essa diferença agora está escrita na entrada fechada do `TODO.md`.)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Os três itens que a Mesa mandou aplicar foram atendidos, e nenhum muda o comportamento.
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts:108-109`: a mudança fica só no comentário de `alvosDoPortao`, que agora cita `INVENTARIOS_DO_PORTAO`, a migration e o `infra/compose.yml`. O código não mudou.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md:3016`: a entrada fechada passa a citar o arquivo real e diz por que o nome difere do plano. A entrada aberta logo abaixo guarda o resto: (a) o `.env.example` e os Dockerfiles, e (b) o schema sem migration, para a retro decidir. Ela bate com "Recomendações sem aplicar".
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/.claude/skills/executar-task/SKILL.md:241-243`: o texto antigo dizia "serviços, fora o `infra/compose.yml`". Agora diz o que o `compose.int.test.ts` lê além do compose: o `.env.example` e os estágios `FROM … AS` dos Dockerfiles. Ficou correto.

As linhas que o diff cita no `tools/ci/compose.int.test.ts` batem com o arquivo:
- Linha 34: `docker compose --env-file .env.example -f infra/compose.yml config`, que lê o `.env.example`.
- Linha 60: a regex `^FROM \S+ AS <target>$` aplicada ao Dockerfile de cada serviço, que lê os estágios.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-21-inventario-no-portao.md:44`: "O item 3 acima" não aponta para nada no documento, que não tem lista numerada antes da tabela. Fala do item 3 da Mesa, que é o texto do `executar-task`. Basta escrever "o texto do `executar-task` ('Quem usa o que mudou')" no lugar.
