# Achados das revisões — `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 11:35:16 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica
Fila e prioridade: não se aplica
Concorrência: não se aplica
Índice e paginação: não se aplica
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: não se aplica
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:395`: `textosDe` roda um `git show HEAD:<arquivo>` e lê o arquivo de novo a cada caso tocado, mesmo quando vários casos são do mesmo arquivo. Guardar o resultado por arquivo num `Map` deixa o portão local mais rápido quando a onda toca muitos casos. O efeito na carga é zero, porque o código só roda no portão local (`tools/processo/portao-local.ts:18`) e não em API, worker, despachante ou realtime.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:401`: quando o `git show` falha, o `catch` esconde o motivo. Isso está certo, porque o caso continua na régua. Ainda assim, uma linha no stderr ajudaria a entender um portão reprovado sem motivo aparente.

A mudança mexe só na régua de duração do e2e, que o portão local usa (`portao-local.ts`), e mantém o critério "cobra mais, nunca menos". Não toca rota, fila, gateway de IA, schema nem estado em memória das instâncias. Os 56 testes de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts` passaram, e nenhum chama provedor pago.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 11:35:17 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: APROVADO

A correção mexe só na ferramenta de CI que mede quanto tempo cada caso de e2e leva. Ela passa a não contar como alterado o caso em que só um comentário mudou. Não toca dado de pessoa, rota, log, armazenamento, exportação nem envio externo.

Campos pessoais tocados: nenhum. A função nova, `casosSoComComentarioAlterado` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts`, lê só o texto dos specs de e2e, da árvore e de `git show HEAD:<arquivo>`, e compara título e corpo sem comentário. O que ela guarda é título de caso e corpo de código, nada de pessoa.
Fora da tabela de dados do docs/lgpd.md: nada, porque não há campo novo.
Autorização por objeto: não se aplica. Não há rota, endpoint nem consulta ao banco.
Logs: limpos. A função nova não grava log nem escreve na saída. O stderr do `git show` é descartado (`stdio: ['ignore', 'pipe', 'ignore']`). A mensagem de reprovação, que já existia, cita só caminho do spec, linha, projeto e duração.
Auditoria: não se aplica. Nenhuma das ações que a regra 20, item 10, exige está envolvida.
Envio externo: nenhum. O `git` é chamado localmente com `execFileSync` e lista de argumentos, sem shell. Nada sai da máquina.
Seed/fixture: sintético. Os testes novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts` montam um repositório temporário com casos chamados `primeiro`, `segundo` e `terceiro`, um relatório com durações inventadas e o comentário `// nota antiga`. Não há nome, matrícula nem conteúdo de aluno.
Bloqueantes: nenhum.
Recomendações:
- Isto não é da minha regra, fica para o `infra-guardian` ou o `revisor-geral`. `textosDe(medido.arquivo)` roda um `git show` e relê o arquivo uma vez por caso tocado, mesmo quando vários casos estão no mesmo arquivo. Guardar o resultado por arquivo evita o trabalho repetido.

Pergunta de fechamento: a correção não muda nada do que o sistema guarda sobre um aluno nem de para onde isso é enviado.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 11:36:07 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A §13 da `techspec.md`, mudada em `e3cc1519`, descreve a mesma regra que o código aplica: corpo sem comentário (`casosDoSpec`) igual ao do HEAD, no mesmo arquivo e com o mesmo título. Esta spec não tem `cenarios.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
1. **Hook de topo do arquivo pode tirar um caso da régua.** O problema está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:414` e vem do recorte do `corpo` em `casosDoSpec`.
   - O `casosAlterados` atribui a um caso as linhas que vão do `test(` dele até antes do `test(` seguinte.
   - O `corpo` termina antes, no `FIM_DE_CASO` (`test.beforeEach`, `test.use`, `test.describe`...).
   - Logo, uma mudança de **código** nesse trecho final, por exemplo um `test.beforeEach` de topo depois do caso, marca o caso como tocado. Mas o corpo continua igual, e o caso sai da régua.
   - Um hook de topo vale para todos os casos do arquivo, inclusive o anterior, que pode ter ficado mais lento. A regra "cobra mais, nunca menos", escrita no documento, não vale nesse ponto.
   - É raro e não bloqueia, mas fica como risco registrado para a retro. Duas saídas: comparar o trecho inteiro que o `casosAlterados` atribui ao caso, ou manter na régua todo caso cujo intervalo tocado passa do fim do `corpo`.
2. **`git show` repetido.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:397-404`, o `textosDe` roda `git show HEAD:<arquivo>` e `casosDoSpec` uma vez por caso tocado, não uma vez por arquivo. Numa onda de rename que toca muitos casos do mesmo spec, isso repete o mesmo trabalho. Basta guardar o resultado por arquivo num `Map`, como o `casosAlterados` já faz com as alterações.
3. **Regra 40 sem a exceção nova.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/.claude/rules/40-testes.md:124-126`, o texto ainda diz "o caso de e2e cujas linhas o diff tocou, e só ele". A exceção do caso em que só mudou comentário está no comentário do topo do módulo e na Tech Spec, mas não na regra que o portão cita. Vale uma frase lá na retro, para quem lê a regra não estranhar o caso que passou.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 11:36:56 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: a troca só de um comentário dentro do caso lento não o conta como alterado, e a régua passa.
- Borda 1: o comentário muda junto com uma linha de código do caso, e a régua reprova.
- Borda 2: o comentário muda junto com o título, o título novo não tem par no HEAD, e a régua reprova.
- Borda 3: título de modelo (`${}`), que `casosDoSpec` pula. O caso continua na régua.
- Borda 4: título repetido só na árvore, e título repetido só no HEAD. Nos dois o caso continua na régua.
- Borda 5: arquivo novo, sem `HEAD:<arquivo>`. O caso continua na régua.
- Borda 6: caso de primeiro nível, fora de qualquer `describe`. O título medido é igual ao título do spec.
- Borda 7: código mudado nas linhas que a régua atribui ao caso, mas fora do corpo que `casosDoSpec` lê. Isso inclui gancho, `test.use` e abertura de `describe` entre o `})` do caso e o `test(` seguinte.
- Permissão, isolamento entre escolas e concorrência não se aplicam: a mudança é ferramenta de portão em `tools/ci/`, sem dado de escola e sem operação concorrente.

**Cobertos:**
- O caminho feliz e as bordas 1 a 4 têm teste, citado pelo nome no documento, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts:485-523`. Cada teste afirma o resultado: `null`, ou o motivo com arquivo, linha, projeto e segundos.
- Conferi as seis mutações declaradas contra o diff. Cada uma deixa vermelho o teste que cita, e pelo motivo certo, porque o cenário chega à cláusula.
- A borda 5 fica coberta pelo teste que já existia, `arquivo de e2e novo, ainda fora do git, tem todos os casos alterados`: sem o `catch`, `motivoDaDuracaoDoE2e` lança um erro e esse teste fica vermelho.
- Não há `.skip` nem mock. Rodei a suíte: 56 de 56 verdes.

**Bloqueantes:**

1. **Código mudado no trecho do caso é aceito como "só comentário" (a régua deixa passar mais do que antes).** O problema está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:414`, junto com as linhas 244 e 277-278.
   - `casosAlterados` (linhas 180-181) atribui ao caso todas as linhas do `test(` dele até a linha antes do `test(` seguinte.
   - Já o `corpo` que `casosDoSpec` compara é cortado no primeiro `FIM_DE_CASO` (`test.beforeEach`, `afterEach`, `beforeAll`, `afterAll`, `describe`, `use`).
   - Resultado: uma mudança de código num gancho, num `test.use` ou na abertura de um `describe` entre o `})` do `segundo` e o `test('terceiro'` toca uma linha do trecho do `segundo`. O corpo do `segundo` continua igual ao do HEAD, e o caso sai da régua.
   - Antes desta correção o caso era medido. Agora a régua não mede nenhum caso, embora um `beforeEach` do arquivo atrase todos os casos do escopo dele.
   - Isso contraria a regra que o próprio documento escreve, "Cobra mais, nunca menos", e não há teste para esse cenário.
   - **Correção exigida:**
     - Comparar, sem comentário, o trecho inteiro que `casosAlterados` atribui ao caso, do início dele até o próximo `INICIO_DE_CASO`. A alternativa é exigir que o texto depois do corte também seja igual ao do HEAD.
     - Acrescentar um teste: um `test.beforeEach(async () => { await x() })` entre o `segundo` e o `terceiro`, já commitado. Na árvore, trocar `x` por `y`, com e sem a troca da nota. A régua tem de reprovar o `segundo` a 19 s.
     - Acrescentar o bloco `mutacao` correspondente.

2. **Uma condição nova sem teste e sem bloco de mutação:** o `medido.titulo === c.titulo ||` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:410`.
   - O `relatorioDe` (linhas 37-64 do teste) sempre põe o `describe` 'material da coordenação' na frente do título. Assim a igualdade exata nunca é verdadeira em nenhum teste: apagada essa condição, a suíte inteira continua verde.
   - Essa condição é a que vale para um caso de primeiro nível, fora de qualquer `describe`. O bloco 3 do documento só prova a outra condição da mesma linha, o `endsWith`.
   - **Correção exigida:**
     - Acrescentar um teste com um relatório em que o caso fica direto na suíte do arquivo, sem `describe`, e só o comentário muda. O resultado esperado é `null`.
     - Acrescentar o bloco `mutacao` que apaga `medido.titulo === c.titulo ||`.

**Recomendações:**
- A docstring de `relatorioComOSegundo` (`duracao-do-e2e.test.ts:453`) fala em "linhas 2, 7 e 13". No repositório com a nota, o `terceiro` está na linha 14. Os testes não quebram por isso, porque o que conta é o intervalo do `segundo`, mas o texto engana quem ler. Vale corrigir o número, ou derivar a linha do arquivo.
- O teste do título de modelo (`${}`) não tem bloco de mutação. Hoje ele só fica vermelho porque `daArvore.titulo` lança um erro quando a guarda `daArvore === undefined` sai. Vale dizer no documento qual guarda ele protege.
- O nome `casosSoComComentarioAlterado` promete mais do que a função confere enquanto o bloqueante 1 não for corrigido: ela compara o corpo, e não as linhas que o diff tocou.

## revisor-geral · 2ª rodada · REPROVADO · 2026-10-31 11:44:52 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado.

**Aderência à Tech Spec:** diverge na §13 (`tasks/prd-nomes-de-mercado/techspec.md:208-209`). A correção mudou o critério da exceção e só o documento da correção registra a mudança.

**Portão local:** o carimbo vale para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:**
- **A Tech Spec ainda descreve o critério antigo.**
  - **Onde:** `tasks/prd-nomes-de-mercado/techspec.md:208-209`.
  - **O que está errado:** a §13 diz que a correção tira da régua "o caso cujo corpo sem comentário (`casosDoSpec`) é igual ao do HEAD". O código agora compara outra coisa, o `trecho` (`tools/ci/duracao-do-e2e.ts:240`, campo novo em `:263-268` e `:293`). O `trecho` vai do título ao próximo `test(` e inclui o gancho depois do caso (`test.beforeEach`, `test.use`), que o `corpo` corta em `FIM_DE_CASO`.
  - **Por que importa:** a régua passou a tirar menos casos do que a §13 promete. Um caso em que só o comentário mudou e o `beforeEach` seguinte também mudou continua medido. O teste novo `um gancho entre o caso lento e o seguinte muda` exige exatamente esse comportamento.
  - **Onde a mudança ficou registrada:** só em `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md:32`. A regra trata divergência que existe só no documento da tarefa como bloqueante, mesmo quando a mudança é a certa. A troca para o `trecho` é a certa: corrige o furo que o `test-engineer` achou e que a minha recomendação 1 da rodada anterior também apontava.
  - **Correção exigida:** trocar na §13 "corpo sem comentário (`casosDoSpec`)" por "trecho sem comentário (`casosDoSpec`: do título ao próximo `test(`, o mesmo que `casosAlterados` atribui ao caso, com o gancho que vier depois dele)". Fazer isso na mesma correção. Nenhum outro documento da spec cita a exceção (o `estado.md` só a menciona no histórico).

**O que mudou nesta rodada e está ok:**
- **Igualdade exata do título:** o teste do caso fora de qualquer `describe` e a mutação dele (que tira o `medido.titulo === c.titulo`) cobrem essa parte do filtro.
- **Gancho:** a mutação que volta de `trecho` para `corpo` derruba o teste novo do gancho.
- **`git show` uma vez por arquivo:** a minha recomendação 2 foi aplicada, e o comportamento não mudou.
- **Recomendações recusadas ou enviadas para a retro:** a tabela do documento diz o destino de cada uma e o motivo.

**Recomendações:**
- `tools/ci/duracao-do-e2e.test.ts:159`: a variável `so` quer dizer "só o gancho mudou". Um nome como `soOGancho` deixa o teste legível sem precisar do título.
- `tools/ci/duracao-do-e2e.ts:177`: a linha do comentário do topo passou da largura das vizinhas. Quebrá-la como as outras.

## test-engineer · 2ª rodada · REPROVADO · 2026-10-31 11:44:56 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: só o comentário do caso lento muda, e a régua passa.
- Comentário e código do caso mudam: reprova.
- Título trocado: reprova.
- Caso de primeiro nível, sem `describe`, com só o comentário trocado: `null`.
- Um gancho (`test.beforeEach`) entre o caso lento e o seguinte muda, com e sem a troca da nota: reprova o `segundo` a 19 s.
- Título de modelo (`${}`): fica na régua.
- Título repetido só na árvore ou só no HEAD: fica na régua.
- Arquivo novo: tudo alterado.
- O par do caso se acha **no mesmo arquivo**: um caso de outro spec com o mesmo título não serve de par.

Os cenários de isolamento entre escolas e de concorrência não se aplicam: a ferramenta é de CI e não toca dado de escola nem tem operação paralela.

**Cobertos (a suíte passou, 58 de 58):**
- **Correção exigida 1, feita.** A comparação agora é do `trecho`, de `corpo.trim()` até o próximo `test(` (`tools/ci/duracao-do-e2e.ts:293`, `:421`). O teste está em `tools/ci/duracao-do-e2e.test.ts:525-533`. Conferi as linhas: o gancho vai da 14 à 16 e o `terceiro` fica na 17. O relatório mede o `terceiro` na 17, então a troca da linha 15 cai no intervalo do `segundo`. A mutação `trecho` para `corpo` deixa a primeira asserção vermelha, porque o `corpo` corta o gancho em `FIM_DE_CASO`. O bloco chega à cláusula.
- **Correção exigida 2, feita.** O teste está em `tools/ci/duracao-do-e2e.test.ts:495-511` e confere que o título medido é `segundo`, sem `›`. O arquivo do relatório passa pelo mesmo `caminhoDoSpec`, então o caso é tocado de fato. Com a mutação, que tira o `medido.titulo === c.titulo ||`, o caso fica sem par e reprova a 19 s. O bloco chega à cláusula.
- Os blocos antigos foram reindentados e batem com o código atual. O documento agora diz qual guarda o teste do título de modelo protege. O `--faltando` não aponta nada.

**Bloqueantes:**
1. **`tools/ci/duracao-do-e2e.ts:413-415`: cláusula nova da rodada 2 sem teste e sem bloco de mutação.**
   - **O que mudou:** a reorganização "um arquivo por vez" trocou `textosDe(medido.arquivo)`, que já era do mesmo arquivo por construção, por `casos.filter((outro) => outro.arquivo === arquivo)`.
   - **O que essa condição garante:** a parte "no mesmo arquivo" da regra, escrita no documento e no comentário do topo.
   - **O que acontece sem ela:** cada caso tocado é comparado com os textos de todos os specs. Imagine o `segundo` do `a.spec.ts` com código mudado e um `segundo` do `b.spec.ts` com só o comentário mudado. O laço do `b.spec.ts` acha `trecho` igual e põe na lista o caso do `a.spec.ts`, que sai da régua. A régua passa a cobrar menos.
   - **Por que nenhum teste pega:** todos os testes do bloco "no repositório" usam um único spec, então essa mutação sobrevive. O `--faltando` não a aponta porque a condição está dentro de um `filter`, e não num `if`.
   - **Correção exigida:**
     - Acrescentar um teste com dois specs já commitados, cada um com um `segundo` medido a 19 s. No `a.spec.ts`, mudar uma linha de código do `segundo`. No `b.spec.ts`, mudar só o comentário. O resultado tem de conter `e2e/a.spec.ts:<linha> (...) levou 19,0 s` e não pode conter `e2e/b.spec.ts`.
     - Acrescentar o bloco `mutacao` que troca `casos.filter((outro) => outro.arquivo === arquivo)` por `casos`, citando esse teste.

**Recomendações:**
- **Docstring errada em `tools/ci/duracao-do-e2e.test.ts:453-456`.** A docstring de `relatorioComOSegundo` diz que o `terceiro` fica "na 15 quando um gancho entra antes dele", mas o teste passa 17, e 17 é o valor certo. Com 15, a linha 15 iria para o `terceiro` e o teste ficaria vermelho pelo motivo errado. Corrigir o texto para 17, ou para "a linha do `test('terceiro'` depois do gancho".
- **Trecho do último caso.** O `trecho` do último caso vai até o fim do arquivo e inclui o fechamento do `describe` e o que vier depois. Isso só faz cobrar mais, nunca menos. Vale uma frase no JSDoc de `CasoDoSpec.trecho`, como `prazosDosRetitulados` já faz para o `corpo`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md

## test-engineer · 3ª rodada · APROVADO · 2026-10-31 11:55:09 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: APROVADO

Cenários exigidos (os mesmos da 2ª rodada, mais a correção pedida): só o comentário do caso lento muda e o caso sai da régua · caso de primeiro nível, fora de `describe` · o código do caso muda junto com o comentário e o caso continua medido · um gancho depois do caso muda · título de modelo `${}` · título repetido só na árvore ou só no HEAD · e, nesta rodada, dois specs com o mesmo título, em que o comentário de um não tira da régua o caso do outro.

Cobertos:
- **A correção 1 foi feita.** O teste `dois specs com o mesmo título: o comentário de um não tira da régua o caso do outro, que mudou código` está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.test.ts:90-111` do patch. Os dois specs estão commitados, e cada um tem um `segundo` medido a 19 s. No `material.spec.ts` mudou o código (`await c()` virou `await d()`). No `outro.spec.ts` mudou só o comentário. O teste exige que o resultado contenha `e2e/material.spec.ts:7 (celular) levou 19,0 s` e que não contenha `e2e/outro.spec.ts`.
- **O bloco de mutação está no documento da correção.** Ele troca `casos.filter((outro) => outro.arquivo === arquivo)` por `casos` e cita esse teste pelo nome. O texto do bloco bate com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/ci/duracao-do-e2e.ts:418`, com a mesma indentação.
- **A mutação deixa o teste vermelho pelo motivo certo.** Segui o código com a mutação aplicada. Quando o laço chega ao `outro.spec.ts`, o `segundo` do `material.spec.ts` acha o par pelo título nos textos do `outro`. O trecho do `outro` é igual ao do HEAD, então o caso do `material` entra em `iguais` e sai da régua. O `toContain` da linha 109 falha nesse ponto: o cenário chega à cláusula. Com a guarda no lugar, o `material` fica na régua e o `outro` sai. Isso prova as duas metades da regra.
- **A linha nova na tabela de testes do documento** cita o teste pelo nome e diz qual guarda ele prova.
- **As duas recomendações da 2ª rodada foram aplicadas.** A docstring de `relatorioComOSegundo` agora diz linha 17 e explica as linhas 14 a 17 do gancho. O JSDoc de `CasoDoSpec.trecho` diz como fica o último caso: o trecho vai até o fim do arquivo, e mexer ali põe o caso de volta na régua, o que só cobra mais.
- **A Tech Spec §13** troca "corpo sem comentário" por "trecho sem comentário", como o revisor-geral exigiu, e o texto bate com o código. O `techspec.md` também traz um parágrafo novo na linha back, da triagem da 7.0. Ele veio com o checkout da branch `spec/nomes-de-mercado` e não toca esta regra nem os testes.
- **O resto do diff** no `.ts` é só o comentário do topo quebrado em linhas mais curtas e não muda comportamento.
- `npx vitest run tools/ci/duracao-do-e2e.test.ts`: 59 de 59 passaram. Não há `.skip`, teste comentado nem mock. O teste usa um git real num diretório temporário e não chama IA nem rede. Concorrência não se aplica.

Bloqueantes: nenhum.

Recomendações:
- A linha 99 do patch, no teste novo, troca o comentário com `doOutro.replace('// nota antiga', ...)` e repete à mão o que o `trocarANota` faz. Se o `trocarANota` passasse a aceitar o caminho do spec, o texto da nota ficaria num lugar só. É só organização e não bloqueia.

## revisor-geral · 3ª rodada · APROVADO · 2026-10-31 11:55:09 · `tasks/correcoes/2026-10-31-duracao-do-e2e-so-comentario.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

A única correção exigida na rodada anterior foi feita. A §13 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/prd-nomes-de-mercado/techspec.md` agora descreve o critério que o código usa. A régua compara o trecho sem comentário: vai do título ao próximo `test(`, com o gancho que vier depois do caso, e no último caso vai até o fim do arquivo. A §13 diz também que o título precisa ser único dos dois lados, o que bate com as guardas `outrosDaArvore` e `outrosDoHead` em `tools/ci/duracao-do-e2e.ts:420-423`.

Também conferi a mudança que o test-engineer pediu. O filtro `casos.filter((outro) => outro.arquivo === arquivo)` está em `tools/ci/duracao-do-e2e.ts:418`, com o mesmo texto que o bloco de mutação do documento da correção usa. O teste "dois specs com o mesmo título" faz o que diz: só o `material.spec.ts` mudou código, então só ele aparece no motivo, e o `outro.spec.ts` fica fora.

A Tech Spec que vai no commit não tem um parágrafo que já está na branch da spec: o da triagem da 8.0, que veio em `ec5f9541`. Isso não apaga nada. O ponto em comum das duas branches (`33ed3a4f`) não tem esse parágrafo, e o merge de volta o mantém. A parte da triagem da 7.0 e a §13 são iguais nos dois lados (a §13 entrou na branch da spec em `eb368452`), então não há conflito.

Recomendações:
- O comentário de `CasoDoSpec` em `tools/ci/duracao-do-e2e.ts:259` ainda descreve só o `corpo` ("o corpo sem o título"). Vale citar ali também o `trecho`, que é o que a exceção compara.
