# Achados das revisões — `tasks/prd-nomes-de-mercado/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-01 20:43:44 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica: a tarefa não cria rota nem login)
Fila e prioridade: ok (não se aplica: não cria job nem fila)
Concorrência: protegida (não se aplica: não há gravação de estado nem operação que possa rodar duas vezes)
Índice e paginação: ok (não se aplica: não há query nem tabela)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: o código só roda no lint e na CI, nunca na API, no worker nem na web)
Bloqueantes: nenhum
Recomendações:
- `tools/guardas/regras-nome.mjs:58` (`excecoesSemAlvo`): o regex é montado direto de `nome`, sem escapar. Hoje os nomes são identificadores e isso não quebra nada. Se uma exceção nominal futura trouxer `$` ou outro caractere especial de regex, a checagem de "alvo sumiu" pode dar falso positivo ou falso negativo. Vale escapar o nome antes de montar o regex.

A mudança fica toda em `tools/guardas/`, `tools/renomear/` e `tasks/`: uma regra ESLint (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-nome.mjs`), a lista dela (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/nomes-de-mercado.mjs`), a ligação em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/index.mjs`, mais fixtures e testes. Nada disso chega a `apps/` ou `packages/` em tempo de execução. A regra percorre só o topo de cada arquivo, uma vez, e não pesa na CI. Os testes rodam o ESLint sobre fixtures e não chamam provedor pago.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-01 20:43:48 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa 12.0 só mexe em ferramenta de desenvolvimento: a regra de lint `guardas/nome-de-mercado`, a lista de nomes técnicos que ela recusa, as fixtures, os testes e a isenção da busca por texto do passo 6 em `tools/renomear/referencias.ts`. Não há migration, schema, DTO, rota, repository, storage, convite, exportação nem chamada a modelo.

Fora da tabela de dados do docs/lgpd.md: nenhum. Não entra campo novo.

Autorização por objeto: não se aplica. A tarefa não cria nem altera endpoint.

Logs: limpos. `tools/guardas/regras-nome.mjs` não loga nada. A única saída é o `context.report` do ESLint, com nome de identificador de código, nome de arquivo e nome de pasta. A regra entra na segunda passada, a que roda com `allowInlineConfig: false`, ao lado de `log-sem-dado-pessoal` e `log-sem-conteudo-montado`. Nada no diff tira essas duas do escopo nem da passada em que estão: `REGRAS_DE_LOG` e `REGRAS_EM_TODO_ARQUIVO` seguem como estavam.

Auditoria: não se aplica. Nenhuma das ações da regra 20, item 10, é tocada.

Envio externo: nenhum. Nada sai para provedor de IA nem para terceiro, e por isso não há registro em `ExecucaoAgente` a conferir.

Seed/fixture: sintético. As sete fixtures novas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/` (`nome-recusado.ts`, `nome-que-passa.ts`, `nome-so-na-web.ts`, `nome-so-em-ia-tasks.ts`, `nome-de-cor.ts`, `nome-desligado.ts`, `nome-sem-marca.ts`) só trazem identificadores de código (`AdaptadorX`, `Botao`, `esquemaX`, `TurmaController`) e literais triviais (`1`, `'dark'`). Não há nome de pessoa, matrícula, e-mail, CPF nem conteúdo de aluno. Os casos novos de `guardas.test.ts` e `referencias.test.ts` também usam só caminhos e símbolos sintéticos.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta continua a mesma de antes, com o arquivo do titular e o pedido do titular cobertos pelos testes já existentes da regra 20, item 19.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/referencias.ts`: a isenção nova em `SEM_VARREDURA` vale para o arquivo `tools/guardas/guardas.test.ts` inteiro. Esse arquivo também guarda os casos das guardas de log (`log-sem-dado-pessoal`). Hoje isso não afeta a regra 20, porque o passo 6 só procura nome antigo do rename. Mas se outro dia alguém reaproveitar `SEM_VARREDURA` para uma busca de dado pessoal, a isenção passa a ter outro efeito. Vale registrar no comentário que ela serve só ao rename.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-01 20:45:07 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As subtarefas 12.1 a 12.5 foram feitas e nenhuma peça foi renomeada. A mudança em `tools/renomear/referencias.ts` (`SEM_VARREDURA`) cai fora dos arquivos previstos, mas é a divergência que o Arquiteto triou. Ela está registrada na tarefa, em `techspec.md` §5 passo 6 e em `casos.md` › restos, e tem os três casos que a provam em `referencias.test.ts`.

Aderência à Tech Spec: ok. A regra entra em `REGRAS_DAS_GUARDAS`, roda na passada com `allowInlineConfig: false` e vale só em `apps/**`, `packages/**` e `e2e/**`. A gramática, o limite declarado, a exceção nominal e os casos de `guarda.md` estão cobertos. As outras duas divergências também ficaram registradas: as 11 declarações foram renomeadas pela correção `165b7ca8`, sem exceção nova na guarda, e o `ESCOPO_DO_NOME` virou glob literal, o que é só detalhe de implementação.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **`guarda.md` ainda diz `ia/tarefas/`** (`tasks/prd-nomes-de-mercado/guarda.md:26`, `:54`, `:63`). A regra usa `ia/tasks/` (`tools/guardas/nomes-de-mercado.mjs:59-60`), que é a consequência certa do rename da pasta na 5.0, já previsto no `inventario.md:96`. O próprio "Como testar" da tarefa já fala em `ia/tasks`. Por isso não é divergência do implementador, mas o anexo da Tech Spec ficou desatualizado. Vale corrigir as três linhas para que a próxima leitura não pareça divergência.
2. **`excecoesSemAlvo` não confere se o nome é declarado** (`tools/guardas/regras-nome.mjs:49`). O `\b${nome}\b` só confere que o nome aparece no arquivo. Se a declaração de `esquemaDeCor` sair e um comentário continuar citando o nome, o teste "a exceção nominal tem alvo" segue verde. O comentário da função e o da lista prometem "declara". Ou o comentário passa a dizer "cita", ou a conferência passa a procurar a declaração.
3. **O caminho depende do `cwd` da raiz** (`tools/guardas/regras-nome.mjs:110`). O `relative(context.cwd, ...)` serve ao `npm run lint` da raiz, que é o único script de lint hoje. Mas um ESLint de editor com `workingDirectory` em `apps/web` produziria o caminho `src/...`. Com ele, o `consulta…` (`/^apps\/web\//`) e as pastas `fila/` e `limite/` (`startsWith('packages/')`) deixariam de valer sem nenhum aviso. Vale registrar isso no limite declarado da regra.
4. **`TIPOS` é exportado e ninguém de fora o usa** (`tools/guardas/nomes-de-mercado.mjs:13`). Pode virar `const`.
5. **Import fora da ordem**: em `tools/guardas/guardas.test.ts:9`, o `ESCOPO_DO_NOME` entrou no meio dos `REGRAS_DE_*`. É detalhe de leitura.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-nome.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/nomes-de-mercado.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/index.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/referencias.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/guarda.md`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-01 20:45:53 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: `class AdaptadorX` é recusada e a mensagem diz `XAdapter`.
- Casos de borda do domínio:
  - um nome técnico que colide com palavra do domínio (`fila/` e `limite/` nos apps, `consulta…` fora da web, `Pedido…`);
  - a mesma forma num tipo de declaração em que a linha não vale;
  - prefixo sem maiúscula depois (`Erros`, `Linhas`);
  - declaração dentro de função;
  - a exceção nominal fora do arquivo dela, e a exceção cujo alvo sumiu.
- Permissão (quem não pode, não consegue): quem tenta contornar é acusado. Vale para `eslint-disable-next-line`, `export default`, `abstract` e `declare`.
- Escopo: `tools/` e `infra/` ficam fora.
- A árvore inteira passa (RF8).
- Isolamento entre escolas e concorrência não se aplicam: é uma regra de lint e não toca dado de escola.

**Cobertos:** todas as linhas de "Testes que provam a regra" da tarefa e todos os itens de "Recusados", "Passam" e "mensagem e alcance" de `guarda.md` têm caso em `tools/guardas/guardas.test.ts`. Os casos estão no describe `guarda de nome de mercado`: fixtures `nome-recusado.ts`, `nome-que-passa.ts`, `nome-so-na-web.ts`, `nome-so-em-ia-tasks.ts`, `nome-de-cor.ts` e `nome-desligado.ts`, mais os it.each de arquivo, de pasta e de `tools/`. O filtro vazio é provado pelo `ESCOPO_DO_NOME` mínimo de 3 e pelo `configuracaoDasGuardas` de 16 em `filtros-casam.test.ts`. A isenção do passo 6 tem três casos em `referencias.test.ts`.

Os três arquivos rodaram verdes: 362 testes. Não há `.skip`, mock nem provedor de IA. Toda asserção é sobre o resultado: lista de violações por linha, texto da mensagem e nível da regra por caminho.

**Bloqueantes** (cada um é uma cláusula nova sem bloco de mutação e sem justificativa em "Sem bloco, de propósito"):

1. **`tools/guardas/regras-nome.mjs:67`**: o `.filter((item) => item.id.type === 'Identifier')` em `VariableDeclaration`.
   - O que está errado: sem o filtro, um `const { medidor } = …` de topo leva `nome` indefinido ao `startsWith` e a regra quebra. A árvore tem esse caso: `apps/api/src/main.ts:18` e `apps/web/src/areas/aluno/introducao/aviso-de-privacidade.ts:15`. Nenhuma fixture tem desestruturação de topo, e nenhum bloco tira o filtro.
   - Correção: uma linha `export const { a } = …` e outra `const [b] = …` em `__fixtures__/nome-que-passa.ts`, mais um bloco que tire o filtro, apontando para `a mesma forma no tipo em que a linha não vale passa`.

2. **`tools/guardas/regras-nome.mjs:75`**: o `no.declaration ? … : []`.
   - O que está errado: sem o ternário, `export { AdaptadorSemExport, … }` (linha 49 de `nome-recusado.ts`) chega como `declaracoesDe(null)` e quebra. O bloco do `ExportDefaultDeclaration` mexe na mesma linha, mas não nessa cláusula.
   - Correção: um bloco que troque por `declaracoesDe(no.declaration)`, apontando para `recusa cada forma, no tipo de declaração em que a linha vale`.

3. **`tools/guardas/index.mjs:48`**: a linha `'apps/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'` de `ESCOPO_DO_NOME`.
   - O que está errado: as linhas de `packages/**` e de `e2e/**` têm bloco, e a de `apps/**` não.
   - Correção: um bloco que tire essa linha, apontando para `fica entre as que a passada sem comentários roda, só em apps, packages e e2e`. O `toEqual(['apps','packages','e2e'])` e o nível 2 em `apps/api/src/x/x.service.ts` ficam vermelhos.

**Recomendações:**
- `guarda.md` pede, entre os Recusados, "um `x-em-memoria.ts` em `apps/`". O it.each de arquivo só traz `packages/core/src/repositorio-em-memoria.ts`. Falta um caso `apps/api/src/x-em-memoria.ts`.
- Dois jeitos de declarar no topo que a regra não lê e que `guarda.md` não declara como limite:
  - a desestruturação de topo: `export const { esquemaX } = …` passa;
  - o `declare function lerConfiguracao(): void` (`TSDeclareFunction`).

  Vale escrever os dois no limite declarado, ou cobri-los.
- `export default function lerConfiguracao` não tem caso próprio. O ramo é o mesmo do `export default class`, então não bloqueia.
- O `techspec.md` §5 passo 6 afirma que o identificador e o comentário de `guardas.test.ts` e de `nomes-de-mercado.mjs` "continuam na régua do `restos`". Nenhum teste é citado para essa afirmação. Além disso, isentar o `guardas.test.ts` inteiro, que testa todas as outras guardas, é uma isenção larga: o Arquiteto já fez a triagem, mas fica o registro para a retro.
- O caso `cada linha da gramática é exercida…` refaz o `casa` por conta própria, sem a exigência da maiúscula. Hoje não engana, mas pode passar a divergir de `restoDoNome`.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-nome.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/index.mjs`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/nome-que-passa.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/12_task.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-01 20:55:39 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff da rodada 2 só mexe em ferramenta interna de lint (a guarda de nome de mercado), em fixtures da guarda, nos testes dela e na documentação da tarefa. Não há migration, schema, repository, endpoint, DTO nem tela.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhum campo novo.

Autorização por objeto: não se aplica. Nenhuma rota foi criada ou alterada.

Logs: limpos. As mudanças em `regras-nome.mjs` e `nomes-de-mercado.mjs` são a função `escapar`, comentários e a retirada do `export` de `TIPOS`. Nenhuma delas registra nada em log.

Auditoria: não se aplica. Nenhuma ação que a regra 20, item 10, exige foi tocada.

Envio externo: nenhum. Não há chamada a provedor de IA nem a serviço terceiro.

Seed/fixture: sintético. As linhas novas de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/nome-que-passa.ts` (`medidorX`, `esquemaDaLista`, `lerConfiguracaoDeclarada`) são identificadores de código, sem dado de pessoa. Os textos de teste novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/guardas.test.ts` (`esquema.DeCor`, `esquemaXDeCor`, `apps/api/src/x-em-memoria.ts`) também são sintéticos.

Bloqueantes: nenhum.

Recomendações: nenhuma da minha regra. Uma observação sem efeito na regra 20: com o escape novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-nome.mjs`, o nome da exceção deixa de ser lido como expressão regular. Um nome com caractere especial passa a ser procurado literalmente, o que deixa a checagem da exceção mais estrita, não mais frouxa.

Pergunta de fechamento: esta tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma da rodada aprovada.

Correções exigidas na rodada anterior: nenhuma, então não havia nada a conferir.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-01 20:56:52 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Nesta rodada olhei só o diff da r2 e o que ele afeta. Os três bloqueantes da ordem `12_task-r1.md`, levantados pelo `test-engineer`, foram corrigidos:
- **Filtro da desestruturação:** a fixture `nome-que-passa.ts` ganhou `export const { medidorX }` e `export const [esquemaDaLista]`, e há um bloco de mutação que tira o filtro. Se o filtro sair, a regra quebra no caso `a mesma forma no tipo em que a linha não vale passa`.
- **Ternário do `export { … }`:** ganhou bloco próprio, ligado ao caso `recusa cada forma…`.
- **Linha `apps/**` de `ESCOPO_DO_NOME`:** ganhou bloco próprio. A asserção `['apps', 'packages', 'e2e']` derruba a mutação.

O escape do nome da exceção também está certo:
- O caso `esquema.DeCor` contra `esquemaXDeCor` derruba os dois blocos, o que tira `escapar(...)` e o que tira o `.` da classe de caracteres.
- `TIPOS` deixou de ser exportado e nenhum outro arquivo o importava.
- O caso `export default function lerConfiguracao` entrou.

Os limites novos (desestruturação de topo, assinatura sem corpo e o `cwd` na raiz do repositório) estão descritos em `guarda.md`, que a `techspec.md` (linhas 3 e 183) aponta como anexo da guarda. Não houve divergência em silêncio. A troca de `ia/tarefas/` por `ia/tasks/` em `guarda.md` acompanha o código.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/12_task.md`, tabela "Recomendações sem aplicar": a segunda linha tem destino `TODO.md`, mas o `TODO.md` não foi alterado. O template (`.claude/skills/criar-tasks/task-template.md:168-169`) diz que esse destino "é a linha já escrita no `TODO.md`, no commit da tarefa, e não promessa". A linha precisa estar escrita antes do commit. A 11.0 deixou passar a mesma coisa, então o precedente não justifica.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/regras-nome.mjs:10-14`: o cabeçalho ficou com uma linha bem mais longa que as outras, a que termina em "O escopo (`apps/**`, …) está em". Vale quebrar na mesma largura do resto do bloco.

## test-engineer · 2ª rodada · APROVADO · 2026-11-01 20:56:53 · `tasks/prd-nomes-de-mercado/12_task.md`

VEREDITO: APROVADO

Cenários exigidos: as três correções da 1ª rodada. A primeira é a desestruturação de topo, que não pode quebrar a regra (o filtro de `Identifier`). A segunda é o `export { … }` sem declaração, que não pode quebrar a regra (o ternário de `no.declaration`). A terceira é `apps/**` dentro de `ESCOPO_DO_NOME`. Somam-se as cláusulas novas desta rodada: o escape do nome da exceção nominal e a nova regra da exceção, que agora "cita o nome" em vez de "declara". As recomendações que foram aplicadas também entram: o caso `apps/api/src/x-em-memoria.ts`, `export default function lerConfiguracao` e o limite declarado em `guarda.md`.

Cobertos:
- **Correção 1:** as linhas 56 e 57 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/__fixtures__/nome-que-passa.ts` são `export const { medidorX }` e `export const [esquemaDaLista]`. O bloco novo tira o filtro e aponta para `a mesma forma no tipo em que a linha não vale passa`. Sem o filtro, `item.id.name` chega indefinido e o `startsWith` ou o `endsWith` de `restoDoNome` lança erro dentro do caso. O vermelho vem do caso, não da carga, então chega à cláusula.
- **Correção 2:** o bloco novo troca o ternário por `declaracoesDe(no.declaration)` e aponta para `recusa cada forma…`. A linha 49 de `nome-recusado.ts` é `export { AdaptadorSemExport, … }`, o que leva a `null.type`. O vermelho é o motivo certo.
- **Correção 3:** o bloco novo tira a linha `apps/**` e aponta para `fica entre as que a passada sem comentários roda…`. Duas coisas ficam vermelhas: a asserção `['apps','packages','e2e']` (`guardas.test.ts:494`) e o nível 2 em `apps/...` (`:497-498`), porque `index.mjs:172` usa `files: ESCOPO_DO_NOME`. O vermelho é o motivo certo.
- **Escape:** há dois blocos, um tirando a chamada a `escapar` e outro tirando o `.` da classe de caracteres. Os dois apontam para `o nome da exceção é escapado` (`guardas.test.ts:683-687`). Com `esquema.DeCor` contra `esquemaXDeCor`, a regex sem escape casa, a exceção deixa de ser acusada e o `toEqual([comPonto])` falha. Os dois blocos antigos da conferência de alvo foram atualizados para o texto com `escapar(nome)`.
- **`x-em-memoria.ts` em `apps/`** está no `it.each` dos arquivos recusados, e **`export default function lerConfiguracao`** está no laço de `quem contorna é acusado`.
- **`TIPOS` deixou de ser exportado.** Não há outro consumidor dele, e o `grep` confirma.
- **O que rodei:**
  - `npx vitest run tools/guardas/guardas.test.ts -t "nome de mercado"`: 86 casos passaram, nenhum vermelho.
  - `mutacoes.ts --faltando`: só sobra `regras-nome.mjs:86` (`partes.pop() ?? ''`). Essa linha está declarada como "Sem bloco, de propósito", com o motivo escrito.
- **Concorrência e IA:** não se aplicam, porque é uma regra de lint pura, sem dado de escola e sem provedor de IA.
- **Supressões:** não há `.skip`, teste comentado nem mock que esconda a regra.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/12_task.md:378`: o título da seção de mutações ainda diz "a que não declara o nome passam". O teste e o comentário passaram a dizer "cita o nome". Convém alinhar o texto.
- O teste de escape só prova o `.`. Um segundo caso com `(` ou `+` mostraria que a classe de caracteres inteira importa, e não só o ponto. É cobertura extra.
- A fixture usa `esquemaDaLista` na desestruturação de lista. Hoje o `medidorX` já faz o caso quebrar antes de o `esquemaDaLista` ser lido, então a linha só vale como documentação do limite. Isso não muda o veredito.
- As duas recomendações da 1ª rodada que não foram aplicadas estão registradas na tabela "Recomendações sem aplicar", com destino (retro da X8 e `TODO.md`). Concordo com o encaminhamento.
