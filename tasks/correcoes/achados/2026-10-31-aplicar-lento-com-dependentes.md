# Achados das revisões — `tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 23:27:09 · `tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md`

VEREDITO: REPROVADO

Cenários exigidos (é uma correção de ferramenta interna, sem dado de escola, então não há caso de isolamento nem de permissão):
- Caminho feliz, arquivo: o move não chama o `getEditsForFileRename` do serviço dos arquivos de código, e os imports `.ts` e `.js`, o `vi.mock`, o re-export, os imports do próprio arquivo movido e o `include` do `tsconfig` acompanham.
- Caminho feliz, pasta: os mesmos efeitos, e o que está dentro da pasta continua apontando para si.
- Borda: um arquivo sem relação com o move fica intocado.
- Borda: com dois `tsconfig`, cada edição entra uma vez só.
- Regressão da causa: o serviço da configuração não pode carregar o programa dos projetos. É disso que a correção trata.
- Concorrência: não se aplica. É uma CLI de um processo só, sem operação paralela.

Cobertos:
- `projetos.test.ts` › `arquivo: os imports, o .js, o vi.mock e o include do tsconfig acompanham, sem pedir edição ao serviço dos arquivos de código`. Também cobre o arquivo sem relação (`sem-relacao.ts` fica igual).
- `projetos.test.ts` › `pasta: quem importa de dentro dela e o include do tsconfig acompanham, e o que está dentro continua apontando para si`.
- `aplicar.test.ts:270` › `dois tsconfig: cada um é editado uma vez, e o import que três projetos enxergam também` cobre a deduplicação, que já existia antes desta correção.
- Os três blocos de mutação citam testes que existem, pelo nome exato, e cada um chega à sua cláusula:
  - `false`→`true`: o import `.ts` não é reescrito.
  - `servicoDaConfiguracao`→`servico`: o espião é chamado.
  - `if (false)`: o `include` não muda.
- A dispensa da linha 28 de `movimentos.ts` está justificada no documento.
- `npx vitest run tools/renomear/projetos.test.ts tools/renomear/aplicar.test.ts`: 47 de 47 passaram, sem `.skip`, sem teste comentado e sem provedor de IA.

Bloqueantes:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts:116`
   - **O que está errado:** a correção inteira depende de passar `[]` como lista de arquivos do `servicoDaConfiguracao`, e essa cláusula nova não tem bloco nem teste que a prove. Se `[]` voltar a ser `lido.fileNames`, todos os testes continuam verdes:
     - o caso novo só espiona `projeto.servico`;
     - o caso `o move de um arquivo calcula o caminho de cada arquivo uma vez só` também não pega, porque a memória do `paraRelativo` é por árvore (`RELATIVOS`, `projetos.ts:33`), não por serviço.
   
     Nessa troca o move volta aos ~105 s por entrada, e o teste chamado "o move não paga o programa dos projetos" continua passando sem provar o que o nome diz.
   - **Correção exigida:**
     - No teste novo (`projetos.test.ts`, dentro de `mover` ou dos dois `it`), afirmar que o programa do `servicoDaConfiguracao` de cada projeto não tem nenhum arquivo da árvore. Por exemplo: `getProgram()?.getRootFileNames()` vazio, ou nenhum `getSourceFiles()` com `paraRelativo` definido fora de `node_modules`.
     - Acrescentar ao documento o bloco ` ```mutacao ` com `-    servicoDaConfiguracao: ts.createLanguageService(criarHost(arvore, config, lido.options, []), REGISTRO),` e `+    servicoDaConfiguracao: ts.createLanguageService(criarHost(arvore, config, lido.options, lido.fileNames), REGISTRO),`, citando esse caso.

Recomendações (nenhuma bloqueia):
- O parâmetro `soMock` de `reescreverRelativos` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/especificadores.ts:123`) ficou morto: os dois chamadores passam `false` (`movimentos.ts:47`, `reaplicar.ts:64`). Dois comentários ficaram desatualizados: o da linha 121 ("deixa os `import` para o serviço de linguagem") e o das linhas 8 e 9 ("O TypeScript atualiza os imports"). Vale tirar o parâmetro numa correção à parte; a mutação 1 teria de ser refeita.
- O documento diz que o serviço de configuração cobre `files`, `include`, `exclude`, `paths` e "o `include` que ganha a entrada nova quando só a antiga casava". Só o `include` com caminho explícito tem teste com o programa vazio. Um caso para `exclude`, um para `files` e um para o `include` por padrão (por exemplo `include: ['src/x']`, movendo o arquivo para fora) mostrariam que nada disso dependia dos arquivos do programa.
- O que o serviço fazia e a conta de caminho não faz, e que a amostra de 12 entradas não necessariamente exercitou:
  - import de pasta via `index` (`'./x'` com `x/index.ts` movido);
  - `/// <reference path>`.
  
  Hoje o repositório usa extensão explícita, mas um caso que registre isso, ou uma linha na seção "Causa" dizendo que fica de fora, evita surpresa no próximo mapa.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-30 23:27:36 · `tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: há uma divergência no passo 3 do `aplicar` (`techspec.md` §1 e §5, passo 3)
Portão local: carimbo válido

Bloqueantes:

1. A correção mudou o desenho do passo 3, mas a Tech Spec continua descrevendo o desenho antigo.
   - **Onde:** `tasks/prd-nomes-de-mercado/techspec.md:8` e `tasks/prd-nomes-de-mercado/techspec.md:51`.
   - **O que a Tech Spec diz:** a §1 diz que o `aplicar` é "o 'move file' do serviço de linguagem". A §5, passo 3, diz que o arquivo e a pasta se movem por `getEditsForFileRename` e `git mv`. A regra acertada na 1.0 era que o especificador relativo vinha do serviço e o `tsconfig` sempre (`tasks/prd-nomes-de-mercado/1_task.md:245`).
   - **O que o código faz agora:** em `tools/renomear/movimentos.ts:23-47`, o especificador relativo virou conta de caminho, por `reescreverRelativos(arvore, movimento, false)`. O serviço só edita o `tsconfig`, num programa sem nenhum arquivo de código (`servicoDaConfiguracao`, em `tools/renomear/projetos.ts:116`).
   - **Por que é bloqueante:** o próprio documento da correção chama o problema de "falha de desenho do passo 3". A divergência de origem diz, sobre as três saídas possíveis, "decisão do Arquiteto, não minha" (`divergencia-5.md`). A saída escolhida, a 2, aparece só no documento da correção. Nenhum commit do Arquiteto atualizou a `techspec.md`, e o `estado.md` não registra a decisão. Pela regra deste revisor, divergência registrada só no documento da tarefa é bloqueante, mesmo quando o caminho escolhido é melhor. Ele é melhor: a medição deu hash idêntico nos 3.808 arquivos e o tempo caiu de 1180,9 s para 2,6 s.
   - **Correção exigida:** o Arquiteto registra a decisão e reescreve o passo 3 da §5 e a frase da §1 com o desenho novo. Os imports, o `vi.mock` e o `require` passam a ser conta de caminho, que não usa a resolução de módulo. O `getEditsForFileRename` fica só para o `tsconfig` (`files`, `include`, `exclude`, `paths`). O `casos.md:14` descreve só o resultado e não precisa mudar.

Recomendações:

- **Import de pasta, só pelo `index.ts`:** a conta de caminho não acompanha esse caso, e o serviço de linguagem acompanhava. Em `apps/web` (`moduleResolution: bundler`) há 33 imports desse tipo, como `../../componentes/estado`, que leva a `componentes/estado/index.ts`. Mover a pasta inteira funciona (`destinoDoCaminho`, com `alvo === movimento.de`). Mover sozinho o arquivo `estado/index.ts` deixaria esses imports apontando para o lugar antigo, sem recusa. Hoje nenhum mapa faz isso. Vale registrar o limite na §5 junto com o bloqueante 1, ou fazer o `aplicar` recusar o move de `index.*` isolado.
- **Item vencido no `TODO.md:2391-2395`:** ele cita a `conservarExtensao`, que saiu. Precisa ser reescrito para o mecanismo novo. O que continua aberto: um caso de move com import sem extensão e um com `.tsx` importado como `./C.js`, para a primeira onda que mover arquivo de `apps/web`.
- **Código morto em `tools/renomear/especificadores.ts:119-129`:** o parâmetro `soMock` de `reescreverRelativos` não tem mais quem o chame com `true`; os dois usos, em `movimentos.ts:47` e `reaplicar.ts:64`, passam `false`. O docblock ainda diz que "`soMock` deixa os `import` para o serviço de linguagem". Remover o parâmetro, o ramo dele e a frase.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/especificadores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/TODO.md
- /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specnomes-de-mercado--l1/9f51d085-3a90-4aee-a33c-236dda6ec424/scratchpad/divergencia-5.md

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 23:34:20 · `tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: mover um arquivo e mover uma pasta. Nos dois, os imports (`.ts` e `.js`), o `vi.mock`, o re-export, os imports de dentro do que se move e o `include` do `tsconfig` acompanham.
- Custo que não cresce com os dependentes: o move não chama o `getEditsForFileRename` do serviço dos arquivos de código, e o programa do `servicoDaConfiguracao` não tem nenhum arquivo da árvore.
- Bordas do `tsconfig`: `files`, `exclude` e o `include` por padrão (a pasta). Neste último, o arquivo que sai da pasta ganha entrada nova, e o que fica dentro não muda.
- O que a conta de caminho não acompanha (import de pasta pelo `index`, `/// <reference path>`): está escrito no documento, na Tech Spec §5 e no `TODO.md`.
- Permissão e isolamento: não se aplicam. É ferramenta de repositório, não toca dado de escola.
- Concorrência: não se aplica. A ferramenta roda em processo único sobre a árvore em memória.

**Cobertos:**
- **Correção exigida 1, feita.** Os dois casos chamam `arquivosDoProgramaDaConfiguracao(projetos)` e exigem que a lista seja vazia (`toEqual([])`), em `tools/renomear/projetos.test.ts:198` e `:210`. O caso de arquivo também exige que `projetos.length` seja maior que zero, então a lista vazia não passa por falta de projetos.
- **A mutação nova derruba o teste pelo motivo certo.** O documento ganhou o bloco que troca `[]` por `lido.fileNames`, com o nome do teste igual ao título do `it`. Com essa troca, o `getScriptFileNames` do host (`projetos.ts:86-91`) devolve os arquivos que existem na árvore, o `getRootFileNames()` deixa de ser vazio e a asserção da linha 198 fica vermelha. O vermelho vem da asserção, não de erro de carga.
- **Recomendações da Mesa, aplicadas.** Há três casos novos, `files`, `exclude` e `include` por padrão (`projetos.test.ts:221-239`), cada um com asserção sobre o `tsconfig` inteiro depois do move. Os limites do `index` e do `reference path` estão escritos na seção "Causa".
- **`soMock` e a recusa do move de `index.*` isolado** estão em "Recomendações sem aplicar", com motivo e destino, e as duas no `TODO.md`.
- **Execução.** `npx vitest run tools/renomear/projetos.test.ts` passou 9 de 9, e o documento diz 9/9.
- Não há `.skip`, teste comentado nem chamada a provedor de IA. Os espiões só observam o `getEditsForFileRename`, não trocam a regra testada.

**Bloqueantes:** nenhum.

**Recomendações:**
- No caso da pasta (`projetos.test.ts:210`), repetir `expect(projetos.length).toBeGreaterThan(0)`, como no caso do arquivo. Hoje o caso depende do mesmo repositório de teste para não passar com zero projetos.
- O caso do `include` por padrão (`projetos.test.ts:233-239`) cobre dois moves num `it` só. Separar em dois `it` deixaria o motivo do vermelho legível no nome do teste.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/projetos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 23:34:28 · `tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md`:
- **§1 (linhas 8 e 9):** já descreve o move por conta de caminho, com o serviço de linguagem só para o `tsconfig`.
- **§5, passo 3 (linhas 51 a 58):** já tem o desenho novo. A conta de caminho cobre `import`, `export ... from`, `require`, `import()` e `vi.mock`, como manda `especificadores.ts:7`. O `getEditsForFileRename` ficou só para `files`, `include`, `exclude` e `paths`, e o limite do import de pasta pelo `index` está escrito.
- **Resto da pasta:** o desenho antigo não aparece mais na Tech Spec nem nos outros documentos de `tasks/prd-nomes-de-mercado/`. Sobram só menções históricas, em `estado.md` e `achados/revisao-spec.md`.
- **`cenarios.md`:** esse PRD não tem um, e o `casos.md` descreve só o resultado.

As duas recomendações que a Mesa mandou aplicar estão feitas:
- O limite do `index` está registrado na §5 e na seção "Causa" do documento.
- O item vencido do `TODO.md` sobre a `conservarExtensao` foi reescrito.

As duas que ficaram sem aplicar (tirar o `soMock` e recusar o move de `index.*` isolado) têm destino no `TODO.md` e na tabela de recomendações sem aplicar.

O que mudou no código desde a 1ª rodada está certo:
- Os três casos novos de `tsconfig` (`files`, `exclude` e o `include` por padrão) estão em `projetos.test.ts`.
- Há uma asserção de que o programa do `servicoDaConfiguracao` não tem arquivo nenhum.
- A mutação nova (`lido.fileNames` no lugar de `[]`) é derrubada por essa asserção.

Recomendações:
- O texto sobre o move de `index.*` isolado ficou desatualizado em três lugares. A seção "Divergências resolvidas" diz que o Arquiteto já decidiu: o limite vai para a §5, o mapa move a pasta e o typecheck pega o que escapar. Mesmo assim, ainda pedem "decidir com o Arquiteto entre recusar e registrar o limite na §5":
  - o novo item do `TODO.md` sobre o `index.*` isolado;
  - o parágrafo da seção "Causa" que começa em "Os dois ficam no `TODO.md`" (`tasks/correcoes/2026-10-31-aplicar-lento-com-dependentes.md`);
  - a 2ª linha da tabela "Recomendações sem aplicar".

  Como o registro já foi feito, sobra só a recusa como trabalho futuro, e é assim que os três deveriam dizer.
- Em `projetos.test.ts`, o caso do `include` por padrão faz dois moves num caso só, e um pode esconder a falha do outro. Separar em dois casos deixa o vermelho mais fácil de ler.
