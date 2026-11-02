---
name: executar-task
description: Procedimento do Implementador — execução de UMA única tarefa
argument-hint: <caminho do N_task.md>
user-invocable: false
---

Você implementa **uma única tarefa**. Não avança para outras. Quem roda isto é o Implementador
(`.claude/agents/implementador.md`), no andar da spec, a pedido do Orquestrador (`/seguir`, D78).

Você provavelmente está começando com contexto limpo, e isso é de propósito: contexto
acumulado de tarefas anteriores faz improvisar. Por isso o passo 1 não é opcional.

Tarefa alvo: `$ARGUMENTS`

## 1. Contexto — pular isto invalida a tarefa

Leia, nesta ordem:

1. O `N_task.md` da tarefa, inteiro
2. O que a seção "Contexto necessário" dele aponta: as seções da `techspec.md`, os requisitos do
   `prd.md`, as regras de `.claude/rules/` (cada uma explica o porquê, e o porquê é o que permite
   decidir os casos que a regra não previu) e o código. A Tech Spec inteira, só quando o documento
   não aponta seção: lê-la toda é começar com a janela cheia
3. O teste que a seção "Como testar" manda copiar, **antes** de escrever o seu: copiar o padrão que
   funciona é o que evita horas de tentativa
4. `docs/glossario.md`, para todo nome novo que a tarefa cria no código, no banco ou na tela
5. A skill `receitas-de-codigo`, quando a tarefa cria endpoint, tabela, job, chamada de IA, tela ou teste de isolamento: ela
   aponta a seção do guia, o exemplo real e as travas

O que é o produto está no `CLAUDE.md`, que já está no seu contexto. O `estado.md` da pasta é o diário
do Orquestrador: não é seu, nem para ler nem para editar.

## 2. Planejar antes de codar

Escreva um plano curto: arquivos a criar ou alterar, interfaces, e a lista de testes que
vão provar a regra.

Se o plano contradisser a Tech Spec, **PARE e envie ao Orquestrador `/seguir DIVERGÊNCIA de Implementador`**,
com `Motivo: desenho`, a seção da Tech Spec e o que o plano pede (o formato está em
`.claude/agents/implementador.md`): quem tria é o Arquiteto. Não decida
arquitetura sozinho: a Tech Spec foi escrita por alguém que olhou o sistema inteiro, e você
está vendo um pedaço.

<critical>Divergência se registra; critério de aceite não se baixa. Baixar a régua é decisão de quem é dono da
tarefa, nunca de quem implementa, e a saída nunca é **editar o documento para acomodar o resultado** (reescrever a
linha de um cenário depois da medição, desligar um limite). O que diverge vai para a seção "Divergências resolvidas
nesta tarefa" do `N_task.md`, com o motivo, e, antes dos revisores, entra na `techspec.md`, no `cenarios.md` e no
documento que a seção 11 aponta, com o texto do código. Editar `.md` não caduca rodada nem carimbo, com uma exceção: o
`docs/runbook.md`, que a guarda `alerta-tem-runbook` lê, conta como código e caduca os dois
(`DOCUMENTO_QUE_UMA_SUITE_LE`, em `tools/processo/caducidade.ts`).</critical>

### Autoconferência antes de codar

O `test-engineer` é quem mais reprova, e cada reprovação custa uma rodada nova. Responda no plano, por escrito, as
doze perguntas da seção "Autoconferência" do `N_task.md`. Documento criado antes de 24/10/2026 pode não a ter: use a
do modelo, `.claude/skills/criar-tasks/task-template.md`. O caso que originou cada pergunta está em
`docs/processo-licoes.md`.

A primeira pergunta tem formato próprio, que o portão lê: cada cláusula do diff ganha um bloco na seção "Mutações".

````
```mutacao
arquivo: apps/api/src/<módulo>/<nome>.repository.ts
teste: apps/api/test/<nome>.int.test.ts › <nome do caso>
  .where(and(
-   eq(tabela.escolaId, escolaId),
    eq(tabela.id, id),
```
````

Linha que começa com `-` sai, com `+` entra, e com espaço é contexto: fica, e serve para o trecho existir uma vez só
no arquivo. Cláusula que só vale no celular (o ramo de toque, o menu de baixo) acrescenta ao cabeçalho a linha
`projeto: celular`; ela só vale para teste de e2e, e sem ela o caso roda no `chromebook`, onde essa cláusula não é
alcançada. O portão da tarefa aplica cada bloco, roda o teste citado, exige vermelho e restaura
(`tools/processo/mutacoes.ts`). O vermelho tem de vir de um caso que falhou: trecho que deixa o arquivo com erro de sintaxe, ou
o módulo sem carregar, é recusado como erro de carga. Troque-o por código válido.

Antes de pedir a rodada, rode `node tools/processo/mutacoes.ts --faltando <documento>`: cada linha que ele lista ganha bloco
em "Mutações", ou a meia linha do motivo. Na X4, a 4.0 e a 6.0 reprovaram por linha que ele já apontava. E cada linha da
tabela de testes ganha o caso na coluna "Caso" (pergunta 11); documento sem a coluna leva a lista "linha → caso" no plano.

## 3. Implementar

- Uma subtarefa por vez, marcando `[ ]` → `[x]` conforme avança
- Teste junto com o código, nunca depois. Teste escrito depois testa o que o código faz,
  não o que ele deveria fazer
- Sem `any`, sem `TODO` deixado para trás, sem teste comentado
- Vocabulário do glossário no código e no banco
- Descobriu que a Tech Spec está errada: PARE e envie `/seguir DIVERGÊNCIA de Implementador`, com
  `Motivo: desenho`. Não improvise.

## 4. Portão da tarefa

<critical>O portão não é ferramenta de depuração. Enquanto um teste seu não passa, rode SÓ ele,
quantas vezes precisar; o portão roda uma vez, com os testes da tarefa já verdes: ele leva uns 30 minutos,
e cada tentativa de acertar um e2e por ele soma isso.</critical>

### Enquanto implementa: o teste isolado

```bash
npx vitest run --project unidade <arquivo.test.ts>
npx vitest run --project integracao <arquivo.int.test.ts>      # sobe o compose de teste
node tools/ci/e2e.ts --manter-ambiente e2e/<arquivo>.spec.ts                               # constrói a web, sobe o ambiente e roda só esse arquivo (entra na fila de carga sozinho)
flock /tmp/educa-carga.lock npx playwright test e2e/<arquivo>.spec.ts                      # de novo, com o ambiente de pé e só o spec alterado
```

**A fila de carga é do comando.** Cada linha tem o seu ambiente, mas a máquina é uma só: o e2e de duas
linhas ao mesmo tempo estoura os 30 s. O `portao-local.ts` e o `tools/ci/e2e.ts`
tomam o `flock /tmp/educa-carga.lock` sozinhos (`tools/ci/fila-de-carga.ts`): quem chega espera a vez e
avisa que está esperando, e você não digita `flock` neles. Só o `npx playwright test` direto, que não
passa por eles, continua com `flock /tmp/educa-carga.lock` na frente. **Nunca escreva laço de espera
com `pgrep`**: o padrão casa com a linha de comando do próprio laço, e o laço não sai.

**O portão mede os casos de e2e que a tarefa alterou.** Caso de e2e cujas linhas o diff tocou e que passa de **metade do prazo** dele na máquina
deixa o portão vermelho, antes das mutações e sem carimbo: o runner da esteira leva perto do dobro e o prazo é 30 s, o que dá **15 s**.
O caso que já declarava `test.slow()` (90 s) ou
`test.setTimeout(n)` no HEAD é medido contra a metade desse prazo, também quando muda de arquivo; o prazo que você põe agora **não conta**
(`test.slow()` num caso novo, ou num que o HEAD tinha sem prazo, mede 15 s do mesmo jeito), e só `test.slow()` e `test.setTimeout(n)`
de corpo de caso são lidos. O caso lento que você não tocou não conta, e a mensagem diz arquivo, linha, projeto, segundos e limite. Olhe a duração que o `list` do Playwright já imprime no e2e isolado, e encurte antes do portão (semeie o dado
pela API em vez de pela tela, tire a espera que não prova nada) ou divida o caso. Dois avisos: o relatório só é lido quando a corrida passa,
então e2e vermelho reprova o portão pela falha e não diz quais casos estavam lentos; e um caso perto do limite oscila de uma corrida para
outra, por isso confira o isolado com folga (uns 12 s para o de 15 s), e não no limite.

**O portão roda também o e2e que cita um texto que a sua tarefa tirou da web.** Texto removido de `apps/web/src` (um título, um
rótulo, um aviso, um `data-testid`) que algum `e2e/*.spec.ts` ainda cita, sem diferenciar maiúscula, põe esse spec nos alvos, mesmo
que você não o tenha alterado; o portão escreve `▶ e2e/<arquivo> entra nos alvos: cita "<texto>"`. Rode esse spec isolado antes do
portão e **atualize o texto no e2e**: o spec entra para rodar, e o caso lento que já estava lá não é cobrado de você (a duração só vale
para o caso que o diff tocou). Limites: o portão não acha (i) o spec que cita só um **pedaço** do texto removido (tirar "Governança da
escola" não puxa o spec que procura `/governança/i`), (ii) o texto de JSX que continua na linha de baixo começando em minúscula, nem o
template que atravessa linhas, e (iii) o texto citado só num ajudante de `e2e/support/`, que não puxa os specs que o importam. Ao
contrário, o texto só conta como tirado quando **nenhum** `apps/web/src/**/*.{ts,tsx}` (menos os `.test`) ainda o tem: o que sai de um arquivo e
continua em outro não puxa spec; o
spec que o procurava justamente na tela trocada cai na esteira. Troca de texto da tela: procure você mesmo, com `grep -rn` em `e2e/`, o pedaço que o e2e usa.

**Mudou a estrutura de uma tela** (tirou um título, um cartão, um item da navegação, ou levou um texto para outro elemento)? Rode
isolados, antes do portão, os specs de jornada que passam por ela: `e2e/casca.spec.ts`, `e2e/escola-montada.spec.ts`,
`e2e/aluno-fluxo.spec.ts` (aluno) e `e2e/roteiro-da-demonstracao.spec.ts`. Eles procuram por papel e lugar
(`getByRole('heading', { name })`, a lista de navegações), não por texto removido, e o portão não os puxa: na X4, os três
caíram só na esteira (o W12 pela 2.0, o Tutor pausado pela 3.0, o W1 pela correção do Eu).

Mudou código da web ou da API depois de subir o ambiente do e2e: repita o comando do
`tools/ci/e2e.ts`, que reconstrói. Comando que passa de dois minutos roda em segundo plano
(`run_in_background`), e você espera a notificação do fim; não use `sleep`.

### Tarefa com tela: olhe a tela antes do portão

Com o e2e da tarefa verde e o ambiente de pé, veja o que você fez. O teste prova que a tela funciona;
só olhando se vê texto cortado, bloco desalinhado, barra de abas que quebra, tela vazia em branco e
celular espremido. Entregar tela sem ter olhado é entregar pela metade: a Mesa fotografa as mesmas
telas, e o que você não viu volta como ordem de correção, com um ciclo a mais.

```bash
node tools/vitrine/vitrine.ts mostrar || node tools/vitrine/vitrine.ts montar   # as escolas sintéticas, cheia e vazia
node tools/vitrine/vitrine.ts foto <coordenacao|professora|aluno> <endereço da tela>… [--clicar 'text=<aba ou botão>']
node tools/vitrine/vitrine.ts foto <papel> <endereço da tela>… --vazia           # a mesma tela, sem dado nenhum
```

O endereço é o da área mais o da tela (`/coordenacao/…`, `/professor/…`, `/aluno/…`). O comando faz a
entrada sozinho, abre cada endereço e grava a página inteira em `.processo/vitrine/`, no computador
(1366 px) e no celular (360 px); página comprida sai em pedaços, e o que foi clicado entra no nome do
arquivo. Leia **cada** arquivo com a ferramenta de leitura, como imagem, e corrija antes do portão o
que o `frontend-reviewer` reprovaria (a lista está em `.claude/agents/frontend-reviewer.md`, "É
bloqueante o que se vê e se mede"). O comando termina com as **telas cuja página rola a 1366 × 768**
(a altura medida passa de 768 px): se o PRD diz que só o miolo rola, tela nessa lista é defeito seu, e
você a vê antes da Mesa.

A foto mostra o que o último `tools/ci/e2e.ts` construiu: mudou a web depois dele, reconstrua antes de
fotografar. A vitrine usa o banco de teste: não fotografe com teste rodando. Se a foto falhar, siga e
diga o erro na linha "Telas vistas" do relatório; não é motivo de `STATUS: FALHA`.

**Duas tentativas seguidas no mesmo teste sem entender a causa: pare de tentar.** Leia o erro
inteiro, um teste vizinho que já passa e o helper que ele usa (`e2e/support/`,
`apps/api/test/`). Se a terceira também falhar, não insista: envie o relatório do passo 7 com
`STATUS: FALHA`, dizendo o teste, o erro e o que você já tentou. Quem retoma recebe isso como contexto
e, na segunda falha, um diagnóstico do Arquiteto com o ponto exato.

### Com os testes da tarefa verdes: o portão, uma vez

```bash
node tools/processo/portao-local.ts --tarefa tasks/prd-<funcionalidade>/<N>_task.md
```

Ele roda os tipos, o lint, as duas guardas da esteira que não são teste (segredo commitado e
dependência com falha grave), a **unidade inteira**, os testes de integração, de e2e e de infra **que
a árvore alterou** e, por fim, **as mutações do documento** (cerca de dois minutos, mais o tempo desses
testes), e grava o carimbo em `.processo/portao.json`. Mexeu na seção "Mutações" depois dele, o
carimbo deixa de valer para ela.

Plano do Postgres (`EXPLAIN`) colado no documento da tarefa pode reprovar a guarda de segredo: ela lê
`Key: <valor>` como chave. As linhas `Sort Key`, `Group Key` e parecidas com nome de coluna já têm
exceção no `.gitleaks.toml`; outra linha que reprove sem ser segredo é `DIVERGÊNCIA`, com
`Motivo: portão`, e não se resolve apagando o plano. Para incluir um teste que você não alterou mas a tarefa pode ter quebrado
(o do módulo que usa o que você mexeu), passe o arquivo:
`node tools/processo/portao-local.ts --tarefa apps/api/test/<outro>.int.test.ts`.

**Lista fechada.** Alguns testes enumeram tudo o que existe de um tipo, e ficam vermelhos quando a
tarefa cria mais um: as rotas de um módulo, as métricas com `escola_id`, os arquivos que podem tocar
uma tabela, as ações de auditoria, as permissões. Eles não estão entre os alvos, porque você não
alterou o arquivo deles. Se a tarefa criou rota, métrica, permissão, ação de auditoria, tabela, ou
arquivo que lê tabela de outro módulo, procure quem enumera os vizinhos que já existiam, atualize a
lista nesta tarefa e passe o arquivo ao portão:

```bash
grep -rln "<um vizinho que já existia: a rota irmã, a métrica irmã, o arquivo irmão>" --include='*.test.ts' apps packages infra e2e
```

Se entrar na lista parece contrariar a regra que o teste cita, não atualize: é `DIVERGÊNCIA`, com
`Motivo: desenho`. Os que costumam ficar vermelhos: `apps/api/test/retencao.int.test.ts`,
`apps/api/src/assistente/assistente.int.test.ts` e `infra/test/metricas.int.test.ts`.

O e2e inteiro e a suíte de infra inteira **não** rodam no portão da tarefa. Rodam na esteira do
GitHub, que o push do seu commit dispara e ninguém espera (D79): o que a tarefa quebrar fora dos alvos
aparece ali uma tarefa depois, e volta como correção. A consequência é sua: antes do commit, a regra
da tarefa só é provada pelos testes que estão entre os alvos.

Spec de e2e criado ou alterado roda também repetido, com os trabalhadores da esteira, sobre o
ambiente de pé: `flock /tmp/educa-carga.lock npx playwright test <specs da tarefa> --repeat-each 3 --workers 2`
(o `npx playwright test` direto: o `tools/ci/e2e.ts` ainda não repassa essas opções e roda a suíte inteira). A máquina roda o
e2e com 6 trabalhadores e a esteira com 2: uma ordem de entrega que só a máquina lenta produz passa em portão local.

**O hook bloqueia o commit sem carimbo mais novo que a última alteração.** Mexeu em qualquer arquivo
depois do portão, rode de novo: agora custa minutos.

Falhou algum, conserte. Não prossiga com teste vermelho, não desabilite teste, não use `.skip`.
Teste vermelho é informação. Se o que falha está **fora** dos arquivos da tarefa (um teste de outro
módulo, a auditoria de dependências), não conserte aqui: envie `/seguir DIVERGÊNCIA de Implementador`,
com `Motivo: portão`, e encerre o turno.

Enquanto um teste de integração ou de e2e roda, nada mais usa o banco de teste: nem outro agente, nem
outro comando seu em paralelo.

## 5. Revisão

<critical>A tarefa não fecha sem os revisores obrigatórios. Não é recomendação: o hook
`tools/processo/hook-revisoes.ts` registra cada rodada na seção "Revisões" do `N_task.md` e
BLOQUEIA o commit enquanto algum revisor obrigatório não tiver uma rodada que valha para o
código atual, com APROVADO nos que têm veto.</critical>

Obrigatórios são os marcados no `N_task.md` **mais `test-engineer` e `revisor-geral`, que toda
tarefa tem**, marcados ou não.

**Quem chama os revisores é a Mesa de revisão, não você**
(`.claude/skills/revisar-tarefa/SKILL.md`). Ela monta o prompt de cada um a partir da árvore, chama
na ordem certa e devolve o resultado. Quem implementa não escreve o prompt de quem o revisa (D78).

Com o portão local verde, peça a rodada e **encerre o turno**
(`.claude/skills/seguir/protocolo.md`, item 2). O nome da Mesa veio no pedido do Orquestrador:

```
PEDIDO de Implementador
Tarefa: tasks/prd-<funcionalidade>/<N>_task.md
Rodada: primeira | nova, depois da ordem <arquivo>
Orquestrador: <o nome que veio no pedido dele>
```

### O que volta

- **`RELATÓRIO` com "APROVADO por todos":** a aprovação é final. Se a linha "Sem aplicar" aponta um
  arquivo, copie a tabela dele para "Recomendações sem aplicar" do `N_task.md`, como está, e siga
  para o passo 6. Quem decide o que se aplica e o destino do resto é a Mesa, não você.
- **`ORDEM DE CORREÇÃO` só com recomendações:** os revisores aprovaram, e a Mesa escolheu as
  recomendações baratas a aplicar. Aplique como qualquer ordem, rode o portão da tarefa e peça rodada
  nova: ela chama só quem caducou.
- **`ORDEM DE CORREÇÃO` com bloqueantes** (e, quase sempre, recomendações junto): abra o arquivo que
  ela aponta (`.processo/ordens/…`) e atenda **item por item**. Cada item traz o arquivo, o trecho como
  está hoje e o que o revisor exigiu, com as palavras dele; o código e o teste da correção são seus.
  Não amplie e não refatore o que a ordem não cita. Cláusula que entra por causa da ordem ganha o seu
  bloco em "Mutações", como qualquer outra. Depois rode o portão local e peça rodada nova.
- **`DEVOLUÇÃO`:** a rodada não começou. Faça o que a mensagem pede (quase sempre, rodar o portão com
  as suítes que ela cita) e peça a rodada de novo.
- **Item que não dá para aplicar** (não se aplica ao código, contradiz outro item, ou só se atende
  baixando um critério de aceite): não improvise. Envie `/seguir DIVERGÊNCIA de Implementador`, com
  `Motivo: ordem`, e encerre o turno.

### Caducidade

Mexeu em código depois de uma aprovação, a aprovação caducou, e o hook diz de quem na hora do
commit. A caducidade segue o que o revisor audita: mudança **só em arquivo de teste** (`*.test.ts`,
`*.spec.ts`, `test/`, `e2e/`, `__fixtures__/`) caduca só `test-engineer` e `revisor-geral`; mudança
**só em comentário** de `.ts`/`.tsx` caduca só o `revisor-geral`, salvo comentário com diretiva
(`MARCAS_DE_DIRETIVA`, em `tools/processo/caducidade.ts`); qualquer outra caduca todos. O carimbo não
tem exceção: mudou qualquer coisa, o portão da tarefa roda de novo. Por isso, na correção pedida pelo
`test-engineer`, mexa só no teste sempre que a ordem permitir.

**Não edite a seção "Revisões" nem nada dentro de `achados/`.** Quem escreve é o hook.

## 6. Conferência final

Antes do commit, com todos os revisores terminados:

```bash
node tools/processo/portao-local.ts conferir tasks/prd-<funcionalidade>/<N>_task.md
```

Carimbo inválido: rode o portão local de novo. Se ele mexer em código (formatação, snapshot),
volte ao passo 5 e peça à Mesa a rodada de quem o hook apontar.

## 7. Conclusão

Só depois de tudo verde e de a Mesa responder "APROVADO por todos":

- Marque a tarefa `[x]` em `tasks.md`, e leve o `tasks.md` no commit
- **Faça o commit da tarefa na branch do seu checkout** (a da linha, `spec/<funcionalidade>--l<n>`,
  D79). Stage apenas os arquivos desta tarefa, incluindo o `N_task.md` com a seção "Revisões", a
  `techspec.md` e o `cenarios.md` quando uma
  divergência os mudou, e, se o hook os escreveu, `achados/<N>_task.md` e `achados/indice.md`, nunca
  `git add -A`.
  O `achados/indice.md` é da pasta, não da tarefa: se outro trabalho registrou rodada enquanto esta
  corria, a linha dele vem junto. **Leve assim.** O arquivo é só acrescentado, então a linha extra
  entra um commit mais cedo e nada se perde; tirá-la à mão perderia o registro dela.
  Veio um `achados-revisoes.md` de volta num merge (branch aberta antes de 22/09/2026)? Rode
  `node tools/processo/separar-achados.ts` antes do commit: ele separa e acumula, sem apagar o que
  já está em `achados/`. Ele mexe em mais coisa que a sua tarefa, e o stage acompanha: prepare a
  **deleção** do `achados-revisoes.md` e a pasta `achados/` **inteira**, não só o arquivo da tarefa
  — sem isso o commit vai sem a deleção e sem os blocos dos outros documentos.
  Mensagem no padrão `<Verbo> <o quê> (tarefa N.0)`, por exemplo
  `Implementa reivindicação de nome pelo link da sala (tarefa 4.0)`, com a linha
  `Revisões: <revisor> <veredito> (<n>ª rodada), ...` no corpo. Um commit por tarefa, nunca
  `--amend` em commit existente, nunca `--no-verify`.
  **A mensagem vai num arquivo, por `git commit -F <arquivo>`.** O hook procura `Revisões:` no começo de uma
  linha, e vários `-m` a deixam no meio do comando. Escreva a mensagem antes (na pasta de rascunho da sessão, ou
  em `.processo/`) e passe o caminho: o arquivo existe antes do comando do commit (`protocolo.md`, item 4).
  Antes do commit, `git diff --cached --name-only` confere com a lista dos arquivos da tarefa (um
  `git add` que falha num caminho errado não prepara nada daquele comando). Depois do commit e antes
  do push, `git show --stat HEAD` e `git status --short`: nada da tarefa pode ter ficado de fora. Se
  ficou e o commit ainda não foi enviado, `git reset --soft HEAD~1`, prepare de novo e refaça
- **Commit bloqueado pelo hook:** a mensagem diz qual revisor falta, reprovou ou caducou.
  Resolva o que ela aponta, pedindo à Mesa a rodada que falta. Não contorne: o hook também bloqueia
  commit que leva código de `apps/`, `packages/`, `infra/` ou `e2e/` sem `(tarefa N.0)` nem
  `(correção <slug>)`
- **Faça o push logo depois do commit**, para a branch do seu checkout: `git push -u origin HEAD`. Nunca
  para a `develop`: quem pousa é o Joaquim.
  O push dispara a esteira, e você não espera por ela: quem lê o veredito é o Orquestrador, ao fechar
  a tarefa seguinte (D79)
- Envie o relatório ao Orquestrador (`.claude/skills/seguir/protocolo.md`, item 2), começando por
  `/seguir RELATÓRIO de <seu nome>`, e encerre o turno:

```
/seguir RELATÓRIO de <seu nome>
Tarefa: tasks/prd-<funcionalidade>/<N>_task.md
STATUS: SUCESSO | FALHA
Modelo: <o seu, como aparece no cabeçalho do terminal>
Commit e push: <hash> em spec/<funcionalidade>
Revisões: <a mesma linha do commit, com todas as rodadas de cada revisor obrigatório>
Telas vistas: sim, por mim e pela Mesa (<quantas fotos>) | não (<o erro>) | a tarefa não tem tela
Motivo da falha: <se houver, com o arquivo a abrir>
```

`STATUS: FALHA` é para quando você não consegue concluir e não é caso de `DIVERGÊNCIA`: diga o que
ficou feito, o que falta e o arquivo a abrir. O trabalho fica na árvore, sem descartar nada.

Sem dump de código. Sem histórico de raciocínio. Quem lê o relatório é o Orquestrador, e ele só
precisa saber se pode seguir. O que foi implementado, os testes e o portão ele confere nos
arquivos.
