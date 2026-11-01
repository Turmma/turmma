# Achados das revisões — `tasks/prd-nomes-de-mercado/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-31 17:10:54 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO
Tela vista: não. A tarefa não muda tela e não há foto nova. Revisei pelo `conferir`, pelo `restos` e pelo diff.
Estados: ok. Carregando, vazio, erro e com dado não mudam. O `conferir` não achou diferença de `JsxText`, de string nem de `data-testid`.
Acessibilidade: sem mudança. O diff de `apps/web/src` só troca nome de componente e de classe utilitária. Os `className`, `aria-label` e `placeholder` ficaram como estavam. Os textos de tela vistos no diff (por exemplo "Você acertou", "Nova turma") não mudaram.
Chromebook fraco: sem mudança de código nem de peso. Só o nome de chunk em `apps/web/chunk-names.ts` e em `tools/ci/tamanho-web.test.ts` acompanha o rename.
Celular: sem mudança de layout nem de classe CSS.
Ação oficial protegida: sim. Nenhum fluxo de aprovar, publicar ou excluir mudou. A trava do avatar (D58, regra 70 item 4a) foi renomeada para `AgentAvatar` e `AIMessage`, sem enfraquecer.

Evidências que rodei:
- `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/9.json` deu "verde. 209581 itens na foto de antes, nenhuma diferença que o mapa não explique". Isso cobre o RF7 e a autoconferência da subtarefa 2 (nenhum `JsxText` muda).
- `node tools/renomear/restos.ts` deu "limpo. 6 mapas, nenhum nome antigo sobrou".
- Diff da onça: só `apps/web/src/components/ui/onca/Onca.tsx`, 2 linhas, no import e no uso de `AIBadge` (de `SeloIA`). Isso bate com a divergência registrada na tarefa (31/10), então o RF5 está respeitado.
- As `excecoesDoConferir` do `9.json` são só as travas lidas como texto: `perigo-cheio.test.ts`, `danger-solid.ts`, `Message.test.tsx` e os nomes de chunk em `tamanho-web.test.ts`. Cada uma cita a linha do `travas.md` que a justifica.
- Os 12 arquivos de `e2e/` mudaram só em comentário. Não achei nenhuma linha de código alterada no diff.

Bloqueantes: nenhum.

Recomendações:
- Os nomes das props (`variante="secundario"`, `familia="ok"`, `rotulo=`) continuam em português dentro de componentes que agora têm nome do shadcn. A tarefa não pede mudar isso, mas vale registrar para a retro da X8.
- Não rodei a esteira nem os blocos de mutação, que são do `test-engineer` e do portão. Pela lista dos arquivos tocados, os blocos de `travas.md` 73, 74, 95, 101, 140 e 168 a 170 estão cobertos.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 17:11:46 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum muda nesta tarefa. A onda mexe só em `apps/web`, `e2e/`, `tools/`, `eslint-suppressions.json` e `tasks/`, e nada em `apps/api`, `packages/core` ou no schema. Os caminhos que já existiam continuam iguais. Todos com autor humano? sim, sem alteração.

Decisão autônoma sobre aluno: ausente. Nenhuma regra mudou, só nomes.

Aprovação registrada: ok. A `AIMessage` (antes `MensagemIA`) continua pondo a `ApprovalLine` (antes `LinhaAprovacao`) depois do conteúdo e antes das ações, nas duas variantes. O caso "a aprovação tem lugar fixo" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/Message.test.tsx` passa. Em `approval.ts` e `aprovar.ts` mudaram só nomes de tipo e comentários.

Supervisão do tutor: ok. `apps/web/src/areas/aluno/tutor.ts` e `Tutor.tsx` mudaram só nomes, e nenhum texto de tela mudou. `tutor.test.ts` passa.

Autonomia declarada e visível: sim. Em `textos-da-governanca.ts`, `Agentes.tsx` e `Analista.tsx` mudaram só identificadores e comentários. Os testes da governança passam.

Bloqueantes: nenhum.

O que conferi:
- **`conferir` com o mapa 9:** verde, 209.581 itens e nenhuma diferença que o mapa não explique. Nenhum `JsxText` nem string de produção mudou.
- **As 224 exceções do `conferir` no `9.json`:** todas estão em teste, em fixture ou em caminho de chunk (`chunk-names`, `perigo-cheio`, `danger-solid`, `casca-sem-import`, `estilos`, `estados`, `guardioes`, `tamanho-web`, `Message.test`, `avatar-so-nas-duas-pecas`). Nenhuma é texto que chegue à pessoa, então nada de selo "IA", nota, conceito ou texto de autonomia mudou.
- **A trava da D58 continua recusando:**
  - `Message.test.tsx:90` passou a `/from '\.\/AgentAvatar'/`, e o `Message.tsx` atual importa só `AgentSignature` e `ApprovalLine`.
  - Em `avatar-so-nas-duas-pecas.test.ts`, `QUEM_IMPORTA_O_AVATAR` é `['components/ui/ai/AgentSignature.tsx', 'components/ui/ai/Message.tsx']`.
  - Ainda nesse arquivo, `AVATAR` e `ASSINATURA` apontam para os nomes novos, e o teste continua exigindo que a varredura ache os dois importadores, o que evita que passe vazio.
  - Não rodei os blocos de mutação (não edito arquivo); li as duas listas e elas reprovam as mutações declaradas.
- **Testes rodados:** os do kit de IA, da onça, da governança, da área do aluno, de `professor/atividades` e o `MenuDaPessoa`: 41 arquivos e 585 testes, todos passando.
- **A onça:** o `git diff --stat` da pasta mostra só `Onca.tsx`, com 2 linhas trocadas (o import da assinatura), como a divergência registrada na tarefa prevê. Nada de mockup entrou.
- **Itens 7 e 9 (supervisão e medida do professor):** nenhuma tela, campo ou métrica nova. Ranking de professor, inferência emocional e nota em discursiva ou redação continuam ausentes, porque a onda não acrescenta lógica.

Recomendações:
- Os nomes dos casos de teste da trava da D58 continuam com os nomes antigos, por exemplo `describe('MensagemIA')` em `Message.test.tsx` e `it('o \`AvatarAgente\` só é importado pela \`AssinaturaIA\` e pela \`MensagemIA\`')` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`. O `conferir` não deixa a onda trocar nome de caso, então manter foi certo nesta tarefa. Vale trocar numa onda própria ou na 13.0, para que quem ler a trava da regra 70 item 4a ache o componente pelo nome que ele tem hoje.
- `TextoOptions` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/approval.ts` junta português e inglês num nome só (regra 60 item 1). Não é da regra 70; fica para o `revisor-geral`.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 17:13:01 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: REPROVADO

Cenários exigidos: a 9.0 só troca nomes no kit, sem dado de escola, sem tela e sem operação concorrente. Por isso isolamento, permissão por papel, concorrência e os casos de borda escolares não se aplicam. O que precisa ser provado é:
- os mesmos casos com só o nome mudado (RF7), sem nenhum `JsxText` alterado;
- nada do nome antigo sobrando em código;
- a onça sem outro diff além do import (RF5);
- `Tela` e `Tabela` em prosa, as classes CSS e os `data-testid` intactos;
- a trava D58 do avatar ainda recusando: a `Message` não importa o `AgentAvatar` (forma B), a lista de quem pode importar o avatar não aceita o nome antigo (A), e a galeria não importa o avatar direto (B);
- as travas que leem o caminho do kit como texto (`chunk-names`, `eslint-suppressions`, `guardioes`, `tamanho-web`, `estados`, `casca-sem-import`, `perigo-cheio`, `estilos`, `danger-solid`).

Cobertos:
- Cada linha da tabela tem o seu bloco ou a sua ferramenta. `Message.test.tsx` › "a mensagem não importa o avatar" fica vermelho com o import de `./AgentAvatar` na `Message.tsx`. Em `avatar-so-nas-duas-pecas`, o caso "só é importado pela" fica vermelho com a lista no nome antigo (A), e "as telas e a galeria" com `marca-onca.tsx` importando o avatar (B). Os blocos de `chunk-names`, `estados`, `guardioes`, `perigo-cheio`, `estilos` e `danger-solid` chegam à cláusula. O de `eslint-suppressions` e o de `tamanho-web` passam pelo `restos`.
- Rodei `npx vitest run` em `ui/ai/`, `ui/onca/`, `casca-sem-import`, `perigo-cheio`, `estados` e `chunk-names`: 21 arquivos e 243 casos, todos verdes.
- `git diff --stat` da pasta da onça mostra só `Onca.tsx`, com 2 linhas, como diz a divergência de 31/10.
- Não há `.skip`, teste comentado nem mock. Nenhum teste chama IA.
- A busca dos nomes antigos em `apps/web/src` e `e2e/` só acha títulos de `describe`/`it`/`test`, que a Tech Spec §5 libera, e comentários da pasta da onça, que ficam para a 13.0.

Bloqueantes:
1. `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:137`, com a asserção em `:193`. A amostra `Vizinha.tsx` importa `'../../components/ui/ai/AvatarAgenteDoAluno'`. Ela existia para provar que `importadoresDe` não confunde um arquivo de nome mais longo com o alvo do avatar. Antes, `AvatarAgenteDoAluno` começava com o alvo `components/ui/ai/AvatarAgente`. Com o alvo agora em `components/ui/ai/AgentAvatar`, nada na amostra nem na árvore tem um nome mais longo que comece com o nome novo; conferi com `grep`.
   - Se a comparação de arquivo em `apps/web/src/__fixtures__/importers.ts:41` (`resolvido === alvo || resolvido === \`${alvo}/index\``) virasse `resolvido.startsWith(alvo)`, o caso "não confunde comentário, nome parecido nem pacote" continuaria verde. A trava D58 perdeu essa prova.
   - O rename não pegou a string porque `AvatarAgenteDoAluno` é outro token, e o inventário não a lista em "Não muda, mas parece".
   - Correção exigida: trocar a amostra para `'../../components/ui/ai/AgentAvatarDoAluno'`, por exemplo, para ela voltar a começar com o alvo novo. Junto, um bloco ` ```mutacao ` em `importers.ts:41` (comparação por `startsWith`) contra `avatar-so-nas-duas-pecas.test.ts › não confunde comentário, nome parecido`. Ou então registrar a linha em `inventario-web-e2e.md` "Não muda, mas parece".

Recomendações:
- A tabela de testes (linha 54 do `9_task.md`) diz "vermelho com `MensagemIA`", mas o bloco A usa `AssinaturaIA.tsx`. A `MensagemIA` mora em `Message.tsx`, que não muda de nome. Vale alinhar o texto da linha ao bloco.
- O bloco de `casca-sem-import.test.ts` (`'./ui/ia/AssinaturaIA'`) fica vermelho pela pasta `ia`, que é da 6.0, e não pelo nome do arquivo. O `motivoDeFora` (`casca-sem-import.test.ts:43`) olha só a pasta, então a troca `AssinaturaIA` → `AgentSignature` daquela linha não tem efeito. Não deixa cláusula sem prova, mas o bloco não prova o que a descrição dele diz. O que conta de verdade ali é a lista `ARQUIVOS_DA_CASCA`, que já fica vermelha pelo caso "a lista de arquivos da casca existe", e o `'ui/CountBadge'` de `PECAS_FORA_DA_ENTRADA`, que nenhum bloco muta (só `Alert` e `Toggle` têm bloco).
- Os títulos de `describe`/`it` continuam no nome antigo: `MensagemIA`, `AvatarAgente`, `AssinaturaIA`, `CaixaPedido`, também em `e2e/components-ai.spec.ts:269`. A Tech Spec §5 libera isso, mas fica a nota para a 13.0 ou a retro, porque o título passa a não bater com o componente.
- Comentários da onça ainda citam `AssinaturaIA` e `AvatarAgente`: `CabecaOnca.tsx:218` e `:220`, `CabecaOnca.test.tsx:12` e `:28`, `Onca.test.tsx:30`. São da 13.0, mas os dois `indexOf('**O avatar** (\`AvatarAgente\`)')` leem um documento e vão quebrar quando a 13.0 renomear o README.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-31 17:13:16 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no diff da onça (só no `9_task.md`, sem triagem) e um `Tela` em prosa trocado, quando a própria spec manda que ele fique
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo). Rodei o `restos` ("limpo, 6 mapas") e o `conferir --mapa 9.json` ("verde, nenhuma diferença que o mapa não explique"); os dois passam.

Bloqueantes:

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/areas/navigation.ts:11`: o comentário da convenção de chunk passou de `tela-<area>-<Tela>-*.js` para `tela-<area>-<Page>-*.js`.
   - Ali `<Tela>` é o nome do arquivo da tela, não o componente `Page` do kit. A própria linha continua com `const Tela = lazy(() => import('./Tela'))`.
   - É o caso que o `inventario-web-e2e.md:554`, item (b), escrito nesta tarefa, manda deixar como `fica`. A subtarefa 9.2 ("`Tela` em prosa fica") também manda.
   - Os irmãos ficaram certos: `chunk-names.ts:18`, `areas/{aluno,professor,coordenacao}/routes.tsx:7` e `:35/43/46`.
   - O comentário agora ensina o nome errado do chunk.
   - Correção: voltar para `tela-<area>-<Tela>-*.js`, e acrescentar essa ocorrência a `fica` no `9.json` se for o caso, para o `reaplicar` não trocá-la de novo.

2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/9_task.md:86`: a divergência da onça foi decidida pelo implementador e registrada só no `9_task.md`.
   - O que mudou: `Onca.tsx` ganhou 2 linhas (`AIBadge` de `../ai/AgentSignature`). A própria tarefa reinterpreta o "`git diff --stat` ... vazio" de "Como testar" (linhas 61-62) e o "O diff da onça vazio" da 9.4 (linha 30) como "sem outro diff".
   - Diferente das outras entradas da seção, esta não traz "triagem do Arquiteto". Também não está na `techspec.md`, nem no `casos.md`, que é o arquivo de cenários desta spec.
   - Pior: o `inventario-web-e2e.md:554`, item (d), alterado nesta mesma tarefa, ainda diz "a onça fica com diff vazio, RF5", e isso já não é verdade.
   - A mudança em si é inevitável e pequena. O PRD RF5 e o `tasks.md:90` pedem só o teste da onça sem diff, e isso se cumpre. Mas a decisão precisa passar pela triagem.
   - Correção: levar a divergência ao Arquiteto. A decisão entra na `techspec.md` §5, junto do parágrafo novo sobre o arquivo de componente que acompanha o componente: o import da onça acompanha o símbolo renomeado do kit, e os símbolos e testes da onça não mudam. O `inventario-web-e2e.md:554` (d) e as linhas 30 e 61-62 da tarefa ficam coerentes com isso, e a entrada da linha 86 passa a citar a triagem.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/Message.test.tsx:21,41,95,114`: os títulos de `describe` ainda têm os nomes antigos (`'MensagemPessoa'`, `'MensagemIA'`, `'Pensando'`, `'Conversa'`), enquanto os casos já usam `UserMessage`, `AIMessage`, `ThinkingIndicator` e `Conversation`. Quem lê o relatório do teste procura um componente que não existe mais.
- `e2e/incidentes.spec.ts` está nos arquivos previstos, mas a tarefa não o alterou e ele não tem nome nem caminho do kit em comentário. Tirar dos previstos, ou dizer por que está lá.
- O bloco de mutação de `Message.tsx` acrescenta um `import { AgentAvatar }` que nada usa. Vale para a regex, mas um caso que use o avatar (`<AgentAvatar …/>`) se pareceria mais com a violação real que a D58 proíbe.

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 20:18:51 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO

Cenários exigidos: a 9.0 só troca nomes, então a lista é a da 1ª rodada. Os casos ficam os mesmos e só o nome muda (RF7). Nenhum nome antigo sobra no código. A pasta da onça só muda no import do kit (RF5). `Tela` e `Tabela` em prosa, as classes CSS e os `data-testid` ficam como estavam. A trava D58 do avatar continua recusando, com as formas A e B, e com o reconhecimento do importador que não confunde um nome mais longo com o alvo. As travas que leem o caminho do kit como texto continuam valendo. Isolamento, permissão por papel, concorrência e os casos de borda escolares não se aplicam: a tarefa não toca dado de escola, nem tela, nem operação concorrente.

Cobertos:
- **O bloqueante 1 foi corrigido.**
  - A amostra `Vizinha.tsx` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:137` agora importa `'../../components/ui/ai/AgentAvatarDoAluno'`. Esse caminho resolve para `components/ui/ai/AgentAvatarDoAluno`, que começa com o alvo `components/ui/ai/AgentAvatar`.
  - O caso "não confunde comentário, nome parecido nem pacote com o import" (`:191`, com a asserção em `:193`) usa `importadoresDe(AMOSTRA, AVATAR)`. Por isso ele voltou a provar que a comparação de arquivo é exata.
- **O bloco ```mutacao novo está certo.**
  - A linha `-` é idêntica, caractere por caractere, à linha atual de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/__fixtures__/importers.ts:41`.
  - A linha `+` troca só o ramo de arquivo por `resolvido.startsWith(alvo)`, e o `teste:` é um prefixo do título real do caso.
  - Com a mutação, a `Vizinha.tsx` entra na lista de importadores e a asserção de `:193` falha. É o vermelho pelo motivo certo, porque o cenário chega exatamente à cláusula mutada.
- **A recomendação da 1ª rodada foi atendida.** A linha 54 da tabela agora diz "vermelho com `AssinaturaIA.tsx` na lista", o que bate com o bloco A.
- **Rodei** `npx vitest run --project unidade apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`: 11 casos, todos verdes.
- **O resto do diff não mexe em teste.** Ele trata os bloqueantes do `revisor-geral`: o comentário `<Tela>` em `navigation.ts:11` voltou ao original, e a divergência da onça foi triada na `techspec.md` §5, no `inventario-web-e2e.md:554` (d) e nas linhas 30, 61-62 e 86 da tarefa. Nada disso altera a prova de nenhuma cláusula.
- Não há `.skip`, teste comentado, mock que esconda a regra nem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações: as da 1ª rodada que não foram aplicadas já estão registradas em "Recomendações sem aplicar" do `9_task.md`, com destino. São os títulos de `describe`/`it` com o nome antigo, o bloco de `casca-sem-import`, os comentários da onça e os `indexOf` que leem o README. Não acrescento nenhuma.

## revisor-geral · 2ª rodada · REPROVADO · 2026-10-31 20:19:42 · `tasks/prd-nomes-de-mercado/9_task.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado.

**Aderência à Tech Spec:** ok. O parágrafo novo da `techspec.md` §5 e o item (d) do `inventario-web-e2e.md:554` saíram como a triagem pediu.

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo).

**As duas correções da rodada 1**
1. Feita. `apps/web/src/areas/navigation.ts:11` voltou a `tela-<area>-<Tela>-*.js`. O `9.json` já tem `Tela` como `fica` para esse arquivo, então o `reaplicar` não troca de novo.
2. Feita. Conferi pela triagem (`.processo/ordens/9_task-r1-triagem.md`):
   - as cinco trocas do `9_task.md` estão nas linhas 30, 44, 54, 62 e 86;
   - o parágrafo da §5 entrou na `techspec.md`;
   - o item (d) do inventário mudou;
   - o `git diff --stat` da pasta `apps/web/src/components/ui/onca/` mostra só `Onca.tsx`, com 2 linhas.

**Bloqueantes**

1. `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:137`: a correção que o `test-engineer` exigiu deixou o `conferir` vermelho. A amostra `Vizinha.tsx` passou de `AvatarAgenteDoAluno` para `AgentAvatarDoAluno`, e o `tools/renomear/mapas/9.json` não ganhou exceção para essa string. Rodei `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/9.json`:
   ```
   conferir: VERMELHO. 2 diferenças que o mapa não explica:
   - saiu string em apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts: "import { AvatarDoAluno } from '../../components/ui/ai/AvatarAgenteDoAluno'\nimport { Outra } from '../../components/oncas/Outra'"
   - entrou string em ...: "import { AvatarDoAluno } from '../../components/ui/ai/AgentAvatarDoAluno'\n..."
   ```
   Com isso, a subtarefa 9.4 e as linhas 48 e 52 da tabela de testes (o `conferir` verde, RF7) deixaram de valer. Na rodada 1 o `conferir` passava. O carimbo não pega isso porque não roda o `conferir`.

   Correção exigida: acrescentar ao `excecoesDoConferir` do `9.json` uma entrada para esse arquivo.
   - `texto`: a string exata, porque o `conferir.ts:204` compara com `===`.
   - `motivo`: citar a ordem do `test-engineer` da rodada 1 (a amostra que precisa começar com o alvo novo) ou `travas.md:74`, como as entradas vizinhas.
   - Depois, rodar o `conferir` de novo até dar verde.

   Se a mudança fizer o mapa precisar de linha nova no `travas.md` ou no inventário, essa linha entra junto.

**Recomendações:** nenhuma nova. As da rodada 1 estão na tabela "Recomendações sem aplicar" do `9_task.md`.

**Arquivos citados**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapas/9.json`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/conferir.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/9_task.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-31 21:47:04 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO

Esta é a terceira rodada. Auditei só o diff desde a primeira, que foi aprovada sem correção exigida (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/.processo/ordens/9_task-r3-diff-desde-r1.patch`, 169 linhas). Também conferi a lista de arquivos alterados em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/.processo/ordens/9_task-r3-status.txt`. Ela continua sendo só a troca de nomes do kit de componentes, sem arquivo fora do que a primeira rodada já viu.

O diff tem quatro partes:
- `apps/web/src/areas/navigation.ts:11`: só comentário, `<Page>` passa a `<Tela>`.
- `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:137`: uma amostra de teste com texto de import (`AgentAvatarDoAluno`). É nome de componente, não é dado de pessoa.
- `tools/renomear/mapas/9.json`: duas exceções novas do `conferir`, com caminhos e nomes de componente.
- `tasks/prd-nomes-de-mercado/{9_task.md,techspec.md,inventario-web-e2e.md}`: só documento, sobre o import do kit em `Onca.tsx`, a mutação de `importers.ts` e as recomendações.

Campos pessoais tocados: nenhum.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. Não há rota, repository nem query no diff.
Logs: limpos. Não há `logger` nem `console` nos arquivos alterados.
Auditoria: não se aplica. O diff não tem leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.
Envio externo: nenhum.
Seed/fixture: sintético. A amostra nova `Vizinha.tsx` é texto de import inventado, sem dado de pessoa.
Bloqueantes: nenhum.
Recomendações: nenhuma nova. As da primeira rodada continuam registradas em `tasks/prd-nomes-de-mercado/9_task.md`, seção "Recomendações sem aplicar".

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre aluno nem para onde isso é enviado. A resposta à secretaria continua sendo a dos módulos de titular e auditoria, que esta tarefa não altera.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-10-31 21:47:05 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO
Tela vista: não. A tarefa só renomeia, e o prompt traz "Fotos da tela: indisponíveis". Não tentei fotografar: o diff da rodada 3 não toca nenhuma tela. A revisão foi pelo diff e pelo código.
Estados: ok. Nada muda em carregando, vazio, erro ou com dado.
Acessibilidade: sem alteração. A mudança na onça troca só o nome do componente (`SeloIA` para `AIBadge`), no import e no JSX. A marca de que é IA continua na legenda da onça, e o selo continua sendo o mesmo.
Chromebook fraco: sem impacto. O diff é comentário, uma amostra de teste, exceções do `conferir` e documentos.
Celular: sem impacto, nenhum layout mudou.
Ação oficial protegida: sim, não mexido.
Bloqueantes: nenhum.
- O diff da 1ª rodada para esta tem 169 linhas.
- `apps/web/src/areas/navigation.ts` mudou só num comentário (`<Page>` virou `<Tela>`).
- `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts` mudou numa amostra de teste (`AvatarAgenteDoAluno` virou `AgentAvatarDoAluno`).
- `tools/renomear/mapas/9.json` ganhou duas exceções para essa amostra.
- Os documentos da tarefa registram agora que a onça tem diff só em `Onca.tsx`, 2 linhas, o import do kit (Tech Spec §5). Conferi com `git diff --stat`: são mesmo 2 linhas e mais nada na pasta.
- O bloco de mutação novo prova a amostra `Vizinha.tsx`.

Recomendações:
- As recomendações da 1ª rodada que ficaram sem aplicar estão registradas na tabela da tarefa. As do front são os nomes das props em português e os títulos de `describe`/`it` com o nome antigo. Seguem para a retro da X8 ou a 13.0.
- A tela será vista na validação, já que não há foto nova.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-31 21:47:10 · `tasks/prd-nomes-de-mercado/9_task.md`

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum alterado nesta rodada (o diff desde a 1ª não toca schema, repository, job, seed, importação nem webhook) — todos com autor humano? sim (sem mudança desde a 1ª rodada aprovada)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo de aprovação, entrega ou artefato mudou)
Supervisão do tutor: ok (nada do tutor mudou)
Autonomia declarada e visível: sim (governança e declaração de autonomia não mudaram)
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 1ª rodada (títulos de describe/it da trava da D58 ainda no nome antigo; TextoOptions misturando português e inglês) seguem registradas em 9_task.md, "Recomendações sem aplicar", com destino na 13.0 e na retro da X8.
```

Esta rodada conferiu só o diff entre a árvore 38e609aa e a c26bf0cf. Os arquivos de `achados/`, escritos pelo hook, ficaram de fora, como pede a ordem.

- **`apps/web/src/areas/navigation.ts:11`**: muda só o texto de um comentário (`<Page>` passa a `<Tela>`). Não altera o que a tela mostra nem a regra 70.
- **`apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:137`**: a amostra `Vizinha.tsx` passa a importar `AgentAvatarDoAluno`, um nome mais longo que começa com o nome novo do avatar. Com isso o teste ainda prova a regra da D58 (item 4a): o avatar só entra pelas duas peças assinadas como IA, e um nome parecido não é confundido com ele. O teste da linha 193 continua exigindo que `Vizinha.tsx` não conte como importador do avatar. Rodei o arquivo e os 11 testes passaram.
- **`tools/renomear/mapas/9.json`**: entram duas exceções do `conferir` para essa amostra. É configuração da ferramenta de rename, sem efeito no produto.
- **Documentos** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/9_task.md`, `techspec.md`, `inventario-web-e2e.md`): registram que a pasta da onça muda só no import do kit em `Onca.tsx` (`AIBadge` de `../ai/AgentSignature`). Esse import é o que mostra o selo de IA na onça, e ele acompanha o nome novo do componente. A saída de IA continua marcada como IA.

A 1ª rodada não exigiu nenhuma correção, então não havia o que conferir nesse ponto.

## revisor-geral · 3ª rodada · APROVADO · 2026-10-31 21:47:27 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` do portão diz "válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

A correção exigida na rodada 2 foi feita.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapas/9.json:3962-3971` ganhou duas exceções para `avatar-so-nas-duas-pecas.test.ts`: uma com a string velha (`AvatarAgenteDoAluno`) e uma com a nova (`AgentAvatarDoAluno`). Cada uma tem o `texto` exato e um `motivo` que cita a ordem 9_task-r1 e `travas.md:74`.
- Pedi uma entrada e vieram duas. A diferença é justificada: o diagnóstico do Arquiteto mostra que o `conferir` conta a string que muda duas vezes, a que saiu e a que entrou, e as entradas vizinhas do mesmo arquivo já vêm em pares. A ordem da rodada 2 estava errada nesse ponto, não a correção.
- A string nova bate com a amostra em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:137`.
- Rodei `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/9.json` e deu verde: "209581 itens na foto de antes, nenhuma diferença que o mapa não explique". Com isso voltam a valer a subtarefa 9.4 e as linhas 48 e 52 da tabela de testes (RF7). O JSON é válido.
- Fora isso, o diff mexe só no `9_task.md`, com as duas linhas da rodada 2 na tabela de revisões. Não toca código de produto.

Recomendações:
- Para a retro da X8: o portão de tarefa de onda de rename não roda o `conferir`. Foi isso que fez esta tarefa voltar duas vezes. O portão da onda deveria rodá-lo, ou toda ordem de correção de onda deveria pedir "rode o `conferir`" no "Depois de aplicar". A proposta é a mesma do diagnóstico, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/.processo/ordens/diagnostico-9.md`.
- As duas entradas novas têm o mesmo `motivo`. Para quem ler o mapa depois, seria mais claro escrever "string de antes" e "string de depois", como deixam ver os pares vizinhos.

## test-engineer · 3ª rodada · APROVADO · 2026-10-31 21:47:37 · `tasks/prd-nomes-de-mercado/9_task.md`

VEREDITO: APROVADO

Cenários exigidos: o `conferir` verde (só nomes mudam, nenhum `JsxText` muda, RF7). O `restos` sem nada sobrando em código. A onça intacta (RF5). `Tela` e `Tabela` em prosa, as classes CSS e os `data-testid` sem mudança. As travas da D58: `Message.test.tsx` na forma B e `avatar-so-nas-duas-pecas` nas formas A e B. A amostra `Vizinha.tsx`, com um nome mais longo que começa com o nome do avatar, que veio da ordem da rodada 1. Nesta rodada só audito o que mudou desde a 2ª: duas exceções novas no `9.json` e duas linhas na tabela de revisões, que o hook escreve.

Cobertos:
- **As duas exceções novas** (`tools/renomear/mapas/9.json`, perto da linha 3962) valem só para `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`. Cada uma é a string exata, porque o `conferir.ts:204` compara com `===`: a da amostra `Vizinha.tsx` de antes, com `AvatarAgenteDoAluno`, e a de agora, com `AgentAvatarDoAluno`. O motivo cita a ordem `9_task-r1` e `travas.md:74`. Essa é a correção que a ordem `9_task-r2` pediu.
- **Escopo das exceções**: por serem de um arquivo só e de texto exato, não escondem nenhuma outra diferença. A string tirada da conferência é dado de amostra do teste, não cláusula de regra. A amostra continua provando a armadilha do prefixo, porque `AgentAvatarDoAluno` começa com o alvo novo `components/ui/ai/AgentAvatar`.
- **O `conferir` rodou agora**: `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/9.json` deu "verde. 209581 itens na foto de antes, nenhuma diferença que o mapa não explique". A subtarefa 9.4 e as linhas 48 e 52 da tabela de testes voltam a valer.
- **Teste do avatar rodado agora**: `npx vitest run --project unidade apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts` passou, 11 de 11. O caso que pede `Vizinha.tsx` fora dos importadores está em `avatar-so-nas-duas-pecas.test.ts:193`.
- **Bloco de mutação de `importers.ts`**: está no documento, na seção Mutações, apontando para o caso "não confunde comentário, nome parecido". Ele não mudou desde a rodada aprovada.

Bloqueantes: nenhum.

Recomendações:
- O carimbo do portão não roda o `conferir`. Por isso a rodada 2 só pegou a diferença na revisão. Fica para a retro da X8 decidir se o `conferir` da onda entra no portão local.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapas/9.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/9_task.md
