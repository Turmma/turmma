# Achados das revisões — `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-31 22:24:03 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A tarefa não cria nem altera migration nem schema. O diff só mexe em `tools/processo/`.

Queries verificadas: nenhuma query de banco. Mudam três pontos, e nenhum deles toca dado de escola:
- `arquivosPreparados` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:127`
- `mergeEmCurso` e `diferencasDoIndice` no mesmo arquivo
- a chamada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/hook-git.ts:58`

Não há repository, endpoint, `escolaId` vindo do cliente, `@Unscoped()` nem leitura da camada rede.

Teste de isolamento: não se aplica, porque não há módulo de domínio novo. Os testes novos da conta do merge, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts:2112-2143`, são efetivos. Um exige o resultado exato `['apps/comum.ts']`, o outro exige que a decisão do portão não cite `apps/outro.ts`, e as duas mutações declaradas os quebram. Confirmei isso lendo o código, sem rodar os testes. Também conferi o ponto que interessa à regra 10: um arquivo de repository tocado pelas duas linhas, ou um conflito resolvido à mão, continua no conjunto e continua cobrando `tenancy-guardian`. A correção não baixa essa cobrança. Só tira o que veio do outro lado sem mudar.

Bloqueantes: nenhum.

Recomendações:
- O PreToolUse era a camada mais estrita e agora cobra igual ao git hook. As duas passam a supor que tudo o que veio pelo `MERGE_HEAD` já foi revisto na linha de onde veio. Isso não vale para a branch onde o Joaquim ou o Orquestrador fizeram commit, porque o hook não julga essas sessões. Se um papel do time fizer merge de uma branch assim, código de repository que ninguém revisou entra sem cobrar `tenancy-guardian`. Esse risco já existia no git hook antes desta tarefa, por isso não bloqueia. Vale registrar na retro se o merge deve cobrar revisão quando a origem não é uma linha do processo.
- Falta um caso de teste com conflito resolvido à mão em arquivo `*.repository.ts`, provando que o portão cobra `tenancy-guardian` por ele. Hoje essa cobrança é coberta só de forma indireta, pelo `apps/comum.ts`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 22:24:05 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só muda a ferramenta do processo (`tools/processo/`). Não há migration, schema, DTO, endpoint, storage nem dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque a tarefa não cria nem muda rota.

Logs: limpos. O diff não acrescenta log. Os `execFileSync` de `mergeEmCurso` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:104`) jogam fora o stderr e não registram nada.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O teste novo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts:2112-2144`) monta um repositório git temporário com `user.email=t@t`, `user.name=t` e arquivos `apps/comum.ts` e `apps/outro.ts` inventados.

Conferi um ponto que toca a regra 20: a mudança diz quando o `privacy-guardian` é cobrado no commit. Com um merge em curso, o `PreToolUse` deixa de cobrar os guardiões pelos arquivos que vieram do outro lado sem mudança. Isso não afrouxa a proteção que já valia:
- O git hook já contava assim antes. A barreira que o commit enfrenta continua a mesma.
- O conflito resolvido à mão e o arquivo que as duas linhas tocaram continuam cobrando os guardiões do caminho nas duas camadas. O teste prova isso: a decisão cita `apps/comum.ts`.
- O que vem do outro lado já passou pelos guardiões quando foi commitado na linha de onde veio.
- As duas camadas agora chamam a mesma função (`arquivosPreparados`). Fica eliminado o risco de duas cópias divergirem e uma delas ficar mais frouxa sem ninguém notar.

Também procurei se alguém ainda importa `arquivosDoIndice`, que saiu de `hook-git.ts`. O nome só aparece em documentos antigos de `tasks/`, nenhum código depende dele.

Bloqueantes: nenhum.

Recomendações:
- Registrar em "Limites declarados" do harness que, num merge, um arquivo só do outro lado é tratado como já revisto. A premissa não se sustenta se o outro lado for uma branch cujos commits não passaram pelo git hook, como um commit do Joaquim ou do Orquestrador fora de papel, ou um `--no-verify`. Não bloqueia, porque o hook já tinha esse comportamento e esta tarefa não o criou.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/hook-git.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 22:24:06 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

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
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:114-117`, a função `diferencasDoIndice` não define `stdio`, e o stderr do `git diff --cached` vaza para o terminal se der erro. A função `conteudoDoHead`, logo acima (`:96`), já usa `stdio: ['ignore', 'pipe', 'ignore']`. Usar o mesmo valor aqui, por consistência.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:104-111`, a função `mergeEmCurso` entende qualquer falha do `git rev-parse` como "sem merge". O efeito é seguro: o portão conta todo o índice contra o HEAD e cobra mais revisores, não menos. Mesmo assim, vale um comentário dizendo que essa direção é a escolhida de propósito.

A mudança fica só em `tools/processo/` e não toca login, tutor, sala, prova, fila, IA, migration nem deploy. Rodei os 5 testes do grupo do merge em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts` e todos passam. Nenhum arquivo do repositório ainda usa `arquivosDoIndice`, a função que saiu do `hook-git.ts`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 22:24:15 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança fica toda em `tools/processo/`: o portão de commit e o git hook do processo. Não toca em `Nota`, schema, job, seed, importação nem webhook. Todos com autor humano? Não se aplica, porque não há caminho novo nem alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok, nenhum fluxo de saída de IA foi tocado.

Supervisão do tutor: ok, nada do tutor foi tocado.

Autonomia declarada e visível: sim, sem mudança na declaração nem na tela de governança.

Bloqueantes: nenhum.

Por que isso não afeta a regra 70 (o `conformidade-reviewer` continua sendo cobrado quando deve):
- A correção junta numa função só, `arquivosPreparados` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:127`), a conta que o `PreToolUse` e o git hook fazem dos arquivos de um commit. Durante um merge, deixam de contar só os arquivos que vieram do outro lado sem mudança, e esses já passaram pelos revisores na linha de origem. O git hook já fazia essa conta antes; o `PreToolUse` era o único que cobrava a mais.
- O conflito resolvido à mão e o arquivo que as duas linhas tocaram continuam cobrando os guardiões do caminho, o `conformidade-reviewer` entre eles, nas duas camadas. O teste `revisoes.test.ts › o portão do PreToolUse não cobra o que veio do outro lado` confirma que `apps/comum.ts` ainda é cobrado.
- Com `git add -A`/`.` ou `commit -a`, `arquivosDoCommit` (`comando-git.ts:18`) junta também a lista `alterados`. Isso só pode aumentar a cobrança, nunca diminuir.
- Rodei os testes do grupo "merge em curso" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts`: 5 passaram. Confirmei por busca no código que nada mais chama a função `arquivosDoIndice`, que foi removida.

Recomendações:
- A correção depende de uma premissa: o que vem por `MERGE_HEAD` já foi revisto na linha de origem. Ela vale para as linhas e a spec do Maestri. Mas um merge de uma branch que nunca passou pelo processo também passaria sem cobrar o `conformidade-reviewer` pelo código de nota, tutor ou governança que trouxesse. O bloqueio desse caso fica em outro lugar, a conferência de `linhas.ts:634` antes de entrar na base. Vale citar essa dependência no comentário de `arquivosPreparados` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:120-126`), para ninguém ler a função como suficiente sozinha.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 22:24:31 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. A correção mexe só nos três arquivos que o documento cita e não toca o `portao.ts`, como ele diz.

**Aderência à Tech Spec:** ok. A `tasks/prd-harness/techspec.md:69` já mandava o git hook contar, num merge, só o que difere dos dois lados. A §5(a) pede uma decisão com duas entradas. Fazer o `PreToolUse` usar a mesma função cumpre isso e não abre divergência.

**Portão local:** carimbo válido. Cobre typecheck, lint, segredo, dependências, unidade e alvo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Nome do teste diz o contrário do que ele prova.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts:2137`, o nome diz que o merge "passa sem marca". A asserção espera o contrário: a decisão bloqueia e cita `apps/comum.ts`. Sugestão de nome: "o portão do PreToolUse cobra só o que as duas linhas tocaram, e não o que veio do outro lado".
2. **A regra do merge ainda tem uma segunda cópia.** A detecção de `MERGE_HEAD` e o diff contra ele também estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/caducidade.ts:210-218` (`diferentesDoOutroLado`). Essa função usa `git diff` contra a árvore, sem `--cached` e sem `LIMITE_DE_LEITURA_DO_GIT`. A correção juntou duas contas e deixou essa de fora. O certo é a `caducidade.ts` usar o `mergeEmCurso` exportado de `comando-git.ts`, se a ordem dos imports permitir. Se não der, anotar para a retro.
3. **`mergeEmCurso` exportado sem uso fora do arquivo.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:104`, ninguém de fora importa a função. Ou fica privada, ou passa a ser usada no item 2.
4. **Erro do git perde o detalhe.** O `diferencasDoIndice` novo (`comando-git.ts:114`) não passa `stdio`, e o stderr do git sai direto no terminal. O helper `git` do `hook-git.ts` capturava esse stderr (`'pipe'`). Ninguém fica sem proteção, mas quando o git falha a mensagem fica mais pobre.
5. **Tech Spec não diz a conta do `PreToolUse`.** A `techspec.md:69` descreve o merge só para o git hook. Vale uma frase dizendo que o `PreToolUse` conta igual, pela mesma `arquivosPreparados`. É uma mudança de texto, sem efeito no código.

## test-engineer · 1ª rodada · APROVADO · 2026-10-31 22:24:59 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: durante um merge, um arquivo que só veio do outro lado e chega sem mudança fica fora da conta, no `PreToolUse` e também no git hook.
- Borda 1: um arquivo que as duas linhas tocaram continua na conta. Essa é a cobrança que a correção diz manter.
- Borda 2: um conflito resolvido à mão continua cobrando os guardiões do caminho.
- Borda 3: sem merge em curso, a conta é a mesma de antes (o índice contra o HEAD, sem detectar rename).
- Permissão: um papel do time que faz commit sem marca continua bloqueado pelo que diverge dos dois lados.
- Isolamento: não se aplica, porque a correção não toca dado de escola.
- Concorrência: não se aplica. A função só lê o estado do git, e nada nela pode acontecer duas vezes ao mesmo tempo.

Cobertos:
- **Caminho feliz e borda 1**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts:2112-2144`. O merge é feito com git de verdade e fica por concluir. O teste "o arquivo que só veio do outro lado não conta, e o que as duas linhas tocaram conta" confere a lista inteira com `toEqual(['apps/comum.ts'])`.
- **A camada do `PreToolUse`**, pelo teste "o portão do PreToolUse não cobra o que veio do outro lado". A decisão tem de citar `apps/comum.ts` e não pode citar `apps/outro.ts`. Isso também cobre o caso de permissão: o papel `implementador` continua bloqueado por `comum.ts`.
- **A camada do git hook e o conflito à mão**, pelos testes que já existiam em `tools/processo/hook-git.int.test.ts:469` e `:479`. Agora eles passam pela mesma função, porque `hook-git.ts:58` chama `arquivosPreparados`.
- **Sem merge**, pelo teste anterior em `revisoes.test.ts:2109` e pelo resto de RF15.
- **Mutações:** a tarefa adiciona duas cláusulas novas em `comando-git.ts`, o `filter` contra `MERGE_HEAD` e o retorno de `mergeEmCurso`, e cada uma tem o seu bloco. As duas apontam para um teste que confere a lista exata, então o vermelho vem da cláusula, e não de erro de carga. Em `hook-git.ts` a tarefa só remove código e troca a chamada, sem cláusula nova.
- **Os testes rodam:** rodei `npx vitest run tools/processo/revisoes.test.ts tools/processo/hook-git.int.test.ts` e os 384 passaram. Não há `.skip`, teste comentado, mock da regra nem chamada a provedor de IA.
- Não sobrou referência a `arquivosDoIndice`, `nomes` nem ao `mergeEmCurso` antigo.

Bloqueantes: nenhum.

Recomendações:
1. **Conflito à mão no `PreToolUse`:** essa camada não tem teste próprio para o conflito resolvido à mão. Hoje a cobertura vem do teste do hook, porque as duas camadas chamam a mesma função. Um terceiro caso em `revisoes.test.ts`, com conflito resolvido por papel e a decisão citando o arquivo, protegeria a camada se alguém voltar a separar as contas.
2. **Merge com `git add`:** também não há caso de `git add -A && git commit` com merge em curso na camada do `PreToolUse`. Esse caminho passa por `arquivosAlterados`, em `tools/processo/caducidade.ts:228`, que já considera o merge pelo `diferentesDoOutroLado`. Mesmo assim, é o comando que o papel mais usa para fechar um merge.
3. **Leitura do outro lado duplicada:** `caducidade.ts` tem a sua própria leitura do outro lado (`diferentesDoOutroLado`, da árvore de trabalho contra `MERGE_HEAD`), ao lado da nova `diferencasDoIndice` em `comando-git.ts`. A pergunta é a mesma, e a correção partiu justamente do problema de manter duas contas. Vale registrar na retro se as duas cabem numa função só.
4. **Mudança fora do documento:** `arquivosPreparados` passou a usar `maxBuffer: LIMITE_DE_LEITURA_DO_GIT`, e antes usava o limite padrão. A seção "Correção" do documento só menciona isso de passagem; uma linha a mais deixa claro que a mudança é intencional.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 22:39:09 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A frase da `techspec.md:69` e o registro nos "Limites declarados" (`techspec.md:110`) ficaram para o Arquiteto. Isso está registrado em `TODO.md` e na tabela "Recomendações sem aplicar" do documento. É texto da spec, não uma mudança de arquitetura decidida sem avisar.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As três recomendações que fiz na rodada 1 foram aplicadas:
- **Nome do teste do PreToolUse:** o novo nome descreve a regra que o teste prova.
- **Mensagem de erro do git:** `diferencasDoIndice`, em `tools/processo/comando-git.ts:122-131`, agora guarda a mensagem de erro do git (`stdio: ['ignore', 'pipe', 'pipe']`) junto com o `maxBuffer` maior. A mudança está declarada como intencional em "Correção".
- **Pendências registradas:** a segunda cópia da regra do merge em `caducidade.ts`, o `mergeEmCurso` sem uso fora do arquivo e o caso do `git add -A` estão no `TODO.md` com destino e motivo. Deixar `caducidade.ts` fora desta correção é justificado: ela pede os quatro guardiões do RF16.

O teste novo, em `tools/processo/revisoes.test.ts:2145-2167`, prova a regra. O merge tem um conflito de verdade num `*.repository.ts`, resolvido e preparado. A decisão pede `tenancy-guardian` e não cita `apps/outro.ts`. Se a conta contra o `MERGE_HEAD` for retirada, a segunda asserção falha. Se a cobrança do conflito for retirada, a primeira falha.

Recomendações:
- `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`: a seção "Teste que reproduz" agora lista três testes, mas o parágrafo "Vermelho antes" ainda diz "os dois falham". Ele precisa dizer se o terceiro também falha com o `comando-git.ts` do HEAD. Pela asserção sobre `apps/outro.ts`, falharia.
- `tools/processo/comando-git.ts:136-145`: o comentário de `arquivosPreparados` ficou longo e mistura a regra com a explicação de onde ela vale. A frase "Por isso a função não basta sozinha…" ficaria melhor perto da premissa, numa linha curta. Isso é só legibilidade.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-31 22:39:16 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff não traz migration nem schema.

Queries verificadas: nenhuma query de domínio. O diff mexe só em ferramenta de processo: `diferencasDoIndice`, `mergeEmCurso` e `arquivosPreparados` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts`, além de comentários e documentação. Para o isolamento, o que importa é que a cobrança do `tenancy-guardian` sobre `*.repository.ts` continua igual. O conflito resolvido à mão num repository segue cobrando o guardião na camada do `PreToolUse`. Se o `rev-parse` do `MERGE_HEAD` falhar, a função trata como "sem merge" e passa a cobrar mais revisores, nunca menos.

Teste de isolamento: presente e efetivo. Rodei o grupo do merge de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts` e os 6 testes passaram. O `it` novo ("o conflito resolvido à mão num repository segue cobrando o tenancy-guardian no PreToolUse...") quebraria se o filtro do merge passasse a tirar o arquivo em conflito, porque a asserção `- tenancy-guardian: nenhuma rodada registrada` deixaria de bater. A recomendação de cobrir essa camada, que deixei na 1ª rodada, foi aplicada. A premissa ficou escrita no comentário de `arquivosPreparados`, junto com o que a cobre (`conferirEntrega` e a esteira). O registro nos "Limites declarados" ficou para o Arquiteto e está no `TODO.md`, como o pedido descreve.

Bloqueantes: nenhum.

Recomendações:
- No `it` novo, o `expect(decisao).not.toMatch(/apps\/outro\.ts/)` pode não provar nada. O commit leva a marca `MARCA`, e com ela a decisão talvez nunca liste arquivo sem marca, de modo que `apps/outro.ts` não apareceria mesmo sem o filtro do merge. Não conferi isso rodando o teste com o filtro retirado. A asserção que prova a regra é a do `tenancy-guardian`, e a exclusão do `apps/outro.ts` já é provada pelo `it` anterior, sem marca. Vale confirmar e trocar a asserção por uma que dependa do filtro, ou anotar que ela é só complementar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-31 22:39:17 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica toda nas ferramentas do processo (`tools/processo/`), que contam quais arquivos o commit leva. Não há migration, DTO, rota, storage, envio para IA nem dado de aluno ou professor.

Fora da tabela de dados do docs/lgpd.md: nada. Não entra campo pessoal novo.

Autorização por objeto: ok. Não há rota nova. O que esta mudança garante é que a cobrança dos guardiões continua: o caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts` (linhas 2144-2166) mostra que um conflito resolvido à mão num repository, durante um merge, ainda exige o `tenancy-guardian` no `PreToolUse`. Ou seja, a mudança não abre caminho para código de escopo entrar sem revisão.

Logs: limpos. `diferencasDoIndice` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:122-131`) agora guarda a mensagem de erro do git e a coloca no erro lançado. O `hook-git.ts:100` mostra esse motivo no terminal. Essa mensagem só traz caminhos de arquivo e referências do git, nunca conteúdo de arquivo ou dado de pessoa.

Auditoria: não se aplica. A mudança não lê dado de aluno, não exporta, não altera nota nem permissão, e não aprova saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. A fixture nova usa `user.email=t@t`, `user.name=t` e conteúdos como `export const a = N`.

Bloqueantes: nenhum.

Minha recomendação da rodada 1 foi aplicada em parte e o encaminhamento serve:
- A parte do código está feita: o comentário de `arquivosPreparados` (`comando-git.ts:139-144`) agora diz que um arquivo vindo só do outro lado do merge é tratado como já revisto. Diz também quando isso não vale: commit do Joaquim ou do Orquestrador, ou `--no-verify` fora de papel. E aponta o que cobre esses casos: `conferirEntrega` e a esteira.
- O registro nos "Limites declarados" da `techspec.md` ficou para o Arquiteto. Está na tabela "Recomendações sem aplicar" e no `TODO.md`. Cabe a ele, porque a `techspec.md` é documento dele.

Também conferi o comentário novo em `mergeEmCurso` (`comando-git.ts:103-107`): se o git falha, o sistema age como se não houvesse merge, conta tudo o que o commit leva e cobra mais revisores, nunca menos. Para a regra 20, esse é o lado seguro.

Recomendações:
- Quando o Arquiteto mexer na `techspec.md`, registrar a mesma premissa nos "Limites declarados" (`techspec.md:110`). Já está no `TODO.md`, então só fica anotado aqui.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-31 22:39:24 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica: o código é ferramenta do processo de commit e não roda na API, no worker nem no web)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica: nenhum estado compartilhado em produção. O novo teste monta o próprio repositório git temporário)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica)
Bloqueantes: nenhum
Recomendações:
- As duas recomendações que fiz na 1ª rodada foram aplicadas e conferi as duas. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts`, o `diferencasDoIndice` agora tem `stdio: ['ignore', 'pipe', 'pipe']`, com `maxBuffer: LIMITE_DE_LEITURA_DO_GIT` mantido. O `mergeEmCurso` ganhou o comentário que explica que a falha conta como "sem merge" de propósito, por ser a direção segura: o portão passa a cobrar mais revisores, nunca menos.
- O novo `it` de conflito resolvido à mão num repository, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts`, usa git de verdade num repositório temporário e não chama provedor pago. Rodei o grupo "merge em curso": 6 de 6 passam.
- A duplicata da regra do merge em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/caducidade.ts` (`diferentesDoOutroLado`) segue sem `LIMITE_DE_LEITURA_DO_GIT`. Um merge com índice grande ainda pode estourar o buffer padrão do Node (1 MB) nesse caminho. Já está registrada no `TODO.md`, e quando entrar, a troca deve levar o mesmo `maxBuffer`.

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 22:39:55 · `tasks/correcoes/2026-10-31-portao-conta-o-merge-como-o-git-hook.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 2, só o que mudou):
- Um conflito resolvido à mão num repository, durante um merge em curso, continua cobrando o `tenancy-guardian` na camada do PreToolUse.
- O arquivo que veio só do outro lado continua fora da conta do PreToolUse.
- A mudança do `stdio` em `diferencasDoIndice` não muda o que a função conta.
- As duas mutações do documento continuam alcançando o código atual.

Cobertos:
- **Pedido da rodada 1 (conflito resolvido à mão no PreToolUse):** está feito. O teste fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/revisoes.test.ts:2145-2167`. Ele monta um conflito de verdade em `REPOSITORY`, confere com `toThrow` que o merge parou no conflito, resolve com conteúdo diferente dos dois lados e prepara o arquivo. Depois exige `- tenancy-guardian: nenhuma rodada registrada`. Esse teste falharia se `arquivosPreparados` deixasse de fora o arquivo resolvido no merge, porque nenhum outro arquivo do commit pede o guardião.
- **Teste renomeado (`:2137`):** a asserção não mudou e continua discriminando. No commit sem marca, o bloqueio lista os arquivos de código, e `apps/outro.ts` apareceria nele.
- **Mutações:** os dois blocos (`:54-70` do documento) ainda batem com o texto de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/processo/comando-git.ts:110-111` e `:149-150`. Os comentários novos não tocam as linhas de contexto.
- **`stdio`:** com `['ignore','pipe','pipe']` e `encoding: 'utf8'`, o `execFileSync` continua devolvendo o stdout como string. Só o stderr passa a ir junto no erro. Não há cláusula nova que peça bloco de mutação.
- **Execução:** `npx vitest run tools/processo/revisoes.test.ts -t "merge em curso"` deu 6 passed e 0 falhas.
- **Proibições:** não há `.skip`, teste comentado ou mock. Usa git de verdade e nenhum provedor de IA. Não há operação concorrente nesta correção.

Bloqueantes: nenhum.

Recomendações:
1. **`revisoes.test.ts:2166`:** o `expect(decisao).not.toMatch(/apps\/outro\.ts/)` do teste novo não discrimina a correção. Com a marca na mensagem, `decidirCommit` só cita nome de arquivo nos bloqueios que vêm das alterações, e essa lista sai de `arquivosAlterados`, em `caducidade.ts`. Essa função tem a sua própria regra de merge e já tira `apps/outro.ts` de qualquer jeito. Por isso, se `mergeEmCurso` voltar `false`, essa asserção continua verde. Ela prova a regra da `caducidade.ts`, e não a de `arquivosPreparados`. A metade "o que veio só do outro lado não" do nome continua provada pelos testes de `:2132` e `:2137`. Para essa asserção valer contra a correção, é preciso ou dizer no comentário do teste que ela cobre a `caducidade.ts`, ou pôr `apps/outro.ts` num caminho que peça um revisor que o `REPOSITORY` não pede. Isso cabe junto da linha do TODO.md sobre a duplicata em `caducidade.ts`.
2. **Documento, linha 31 ("Vermelho antes: ... os dois falham"):** ela está certa, mas não diz que o terceiro teste já ficava verde antes da correção, e que isso é de propósito: ele guarda contra a cobrança baixar, não contra a correção ser desfeita. Uma frase evita que a validação leia "três testes, dois vermelhos" como uma falha.
