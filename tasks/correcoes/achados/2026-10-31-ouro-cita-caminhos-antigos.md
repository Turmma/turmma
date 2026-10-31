# Achados das revisões — `tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 02:26:12 · `tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. A correção só mexe em documentos do ouro, no selo e num anexo da spec. Todos com autor humano? Não se aplica: nenhum caminho foi criado nem mudou.
Decisão autônoma sobre aluno: ausente. O diff não toca esse fluxo.
Aprovação registrada: ok. O diff não toca esse fluxo.
Supervisão do tutor: ok. O diff não toca esse fluxo.
Autonomia declarada e visível: sim, sem mudança neste diff.

**O que conferi, item por item**

1. **Só as citações de caminho mudaram.** O `git diff --numstat` dá 4/4 linhas no `docs/aia/ouro/README.md`, 1/1 no `docs/aia/ouro-retido/README.md`, 1/1 no `docs/aia/ouro-retido/RETIDOS.json` e 1/1 no `docs/aia/ouro/SELO.json`, e mais nada no corpus. Estes arquivos estão idênticos ao HEAD:
   - o `MEDIDAS.json`;
   - os seis lotes do `ouro/`;
   - os quatro `*-retido-*.json`.

   Nenhuma amostra, rótulo, base, medida ou alvo mudou. O sha256 de cada lote retido bate com o registrado no `RETIDOS.json` (`lotes[0..3].sha256`):
   - `riscoAVida-retido-1.json`: 161350ea…
   - `riscoAVida-retido-2.json`: 2cc49455…
   - `saidaQualitativa-retido-1.json`: 41e65ea7…
   - `julgamentoDeTextoDeAluno-retido-1.json`: e196ca24…

2. **O selo confere com a pasta.** O README do HEAD tem o sha256 `a8eae500…`, que é o valor antigo do selo. O README novo tem `e358cc22…`, que é o valor novo. As outras sete entradas do `SELO.json` não mudaram e batem com os arquivos. Rodei `npx vitest run packages/core/src/ia/golden-seal.test.ts packages/core/src/ia/golden.test.ts`: 2 arquivos e 100 testes verdes, e a base do ouro foi reproduzida.

3. **Cada caminho novo existe e é o sucessor do antigo** pelo `tools/renomear/mapas/5.json`, junto com as entradas `packages/nucleo` → `packages/core` (o `packages/nucleo` não existe mais):

   | Arquivo:linha | Caminho novo | Entrada do `5.json` |
   |---|---|---|
   | `docs/aia/ouro/README.md:8` | `packages/core/src/ia/golden-seal.test.ts` | `5.json:203-204` (`selo-do-ouro.test.ts`) |
   | `docs/aia/ouro/README.md:20` | `packages/core/src/ia/__fixtures__/assistente-review-samples.ts` | `5.json:221-222` |
   | `docs/aia/ouro/README.md:126` | `__fixtures__/golden.ts` | `5.json:245-246` |
   | `docs/aia/ouro/README.md:126` | `golden.test.ts` | `5.json:197-198` |
   | `docs/aia/ouro-retido/README.md:25` | `golden.test.ts` | `5.json:197-198` |
   | `docs/aia/ouro-retido/RETIDOS.json:421` | `golden.test.ts` | `5.json:197-198` |

4. **Não sobrou citação de caminho antigo.** Comparei cada trecho entre crases dos quatro arquivos de texto do ouro com as 1057 entradas não `fica` dos mapas 3, 4 e 5, pelo caminho e pelo nome do arquivo. Os únicos acertos são a palavra `ouro` como nome do corpus (`ouro/README.md:1,11,12`, `ouro-retido/README.md:1,7,9`) e os nomes de campo `contexto` e `texto` (`ouro/README.md:35,66,118-122`). Nenhum deles cita arquivo. Os outros caminhos citados não estão em nenhum mapa:
   - `tools/ia/medir-risco-a-vida.ts` (`RETIDOS.json:207`) existe com o mesmo nome; os mapas só trocam símbolos dentro dele;
   - `tools/guardas/ouro-separado.ts` (`ouro/README.md:9`) é um arquivo que a 29.0 ainda vai criar.

5. **O significado da medida independente não muda.** No `RETIDOS.json:421`, só o nome do arquivo mudou. A expressão registrada, `julgaTextoDeAluno(texto, conversaTrazTextoDeAluno(contexto.mensagemDoProfessor ?? '', turnosDoProfessor(a)))`, é a mesma da entrada `saidaQualitativa` da `BARRAS` em `packages/core/src/ia/golden.test.ts:73`. As três funções continuam com o mesmo nome, importadas de `./tasks/propor-ferramenta.js` (`golden.test.ts:26-28`). Ficam intactos o commit `1f770ea`, a data, o recall 0.379, a precisão 0.88 e as 22 barradas. O documento da correção reconhece que o nome `ouro.test.ts` era o de `1f770ea` e que esse histórico fica no git.

O acréscimo em `tasks/prd-nomes-de-mercado/casos.md:67-74` está fora do corpus e não toca a regra 70. Ele bate com a linha 140 da correção `2026-10-30-conferir-homonimo-de-outro-pacote`.

Bloqueantes: nenhum.

Recomendações:
- `docs/aia/ouro/README.md:9`: o `tools/guardas/ouro-separado.ts` é nome em português de um arquivo que ainda não existe. Quando a 29.0 criá-lo depois da X8, vale decidir o nome final e corrigir esta citação junto, para ela não virar resto quando o `restos` passar a olhar o ouro (`mapas/13.json`).
- `docs/aia/ouro/README.md:8`: "hoje no `packages/core/…`" é um caminho absoluto, enquanto as linhas 126 e o `ouro-retido/README.md:25` citam só `golden.test.ts`. Não muda o sentido. Se quiser uniformizar, use o caminho completo nas três.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro/SELO.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro-retido/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro-retido/RETIDOS.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/casos.md

## test-engineer · 1ª rodada · APROVADO · 2026-10-31 02:26:41 · `tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md`

**VEREDITO: APROVADO**

A correção não muda código, e os três pontos que você pediu para conferir se confirmam. Não encontrei bloqueante.

**Cenários exigidos:**
- **Caminho feliz:** as cinco citações trocadas e o selo regravado, com os dois testes do ouro verdes.
- **Reprodução:** com o README novo e o `SELO.json` do HEAD, o teste do selo fica vermelho.
- **Borda 1:** sobrar uma citação antiga no ouro.
- **Borda 2:** um teste que lê as citações trocadas ou o `casos.md` e quebraria.
- **Borda 3:** os dois limites novos do `conferir` deixarem passar uma diferença (errar para o verde).
- **Permissão e isolamento:** não se aplicam. Não há dado de escola, e quem pode alterar o ouro é assunto do `conformidade-reviewer`.

**Cobertos:**

1. **"Teste que reproduz" é verdadeiro.**
   - `npx vitest run packages/core/src/ia/golden-seal.test.ts packages/core/src/ia/golden.test.ts` passou: 2 arquivos, 100 casos.
   - O sha256 do README atual é `e358cc22…63aed`, igual ao `SELO.json` novo. O README do HEAD dá `a8eae500…e0e2a`, igual ao selo do HEAD. Os outros sete arquivos conferem com o selo, a começar pelo `MEDIDAS.json` (`8a45e9d6…`).
   - Não troquei o selo para ver o vermelho, porque a regra é não alterar arquivo. Pela leitura de `packages/core/src/ia/golden-seal.test.ts`, com o selo do HEAD ficam vermelhos o caso da linha 52 (`README.md: o conteúdo mudou desde o selo`) e os casos das linhas 66, 72, 79 e 85, que copiam a pasta real e esperam uma lista exata de problemas. O caso da linha 91 continua verde: ele mexe no próprio README da cópia e espera um problema só. Dá os "5 de 6" que o documento diz.

2. **Os dois limites do `casos.md` (linhas 67 a 74) estão certos e erram para o vermelho.**
   - **`export * as X from` (linha 69):** `tools/renomear/foto.ts:94` guarda o namespace `X` com a origem dele. `tools/renomear/conferir.ts:153-160` (`paraONomeExportado`, via `reexportaDoPacote`) troca `X` para o nome novo quando ele coincide com o `de` de uma entrada do pacote. O `aplicar` renomeia por símbolo e não toca o namespace. A foto de antes fica com o nome novo e a árvore com `X`, então o `conferir` fica vermelho. Só passaria a verde se alguém trocasse o nome à mão, e aí a troca é a mesma que o mapa explica.
   - **Import por padrão repassado (linha 71):** `foto.ts:81` registra o nome local do import por padrão. `foto.ts:97` dá ao `export { Banco }` a origem desse import, e `conferir.ts:158` troca o nome. O `aplicar` não renomeia nome local de import por padrão. Também fica vermelho.
   - Nenhum dos dois está entre os quatro limites do comentário do topo de `conferir.ts` (linhas 27 a 32). O (3) fala de um arquivo *de dentro* do pacote da entrada que repassa um nome de outro pacote, que é outra situação. Então "além dos quatro" está correto, e a origem citada bate com `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md:140` e `:146`.

3. **Nenhum teste lê as citações trocadas.**
   - `packages/core/src/ia/__fixtures__/golden.ts` e `golden.test.ts` leem só os lotes, o `MEDIDAS.json` e `tasks/prd-reengenharia/tasks.md`.
   - O README e o `SELO.json` só entram no hash do selo.
   - `docs/aia/ouro-retido/` aparece em `tools/` só como prefixo de caminho (`guardioes-por-caminho.ts:83`, `portao.ts:412`). Os testes de `tools/renomear/restos.test.ts` e `aplicar.test.ts` montam repositórios sintéticos e não leem os arquivos reais.
   - O `casos.md` só aparece num comentário de `tools/renomear/referencias.test.ts:7`.
   - Uma busca por `nucleo`, `ouro.test`, `ouro.ts`, `selo-do-ouro` e `amostras-do-assistente` nas duas pastas do ouro só acha a palavra "nucleo" numa frase de biologia (`docs/aia/ouro-retido/saidaQualitativa-retido-1.json:617`). Não é citação de caminho.
   - As linhas da tabela do documento (8, 20, 126, 25 e 421) batem com o diff.
   - `**Sem mutação:**` está certo: nenhum arquivo de `apps/*/src`, `packages/*/src` nem `tools/` muda.

**Bloqueantes:** nenhum.

**Recomendações:**
- `tasks/prd-nomes-de-mercado/casos.md:69`: o primeiro limite não diz a condição que o segundo diz na linha 71, de que o namespace `X` coincide com o `de` de uma entrada. Também vale dizer que o caminho relativo que entra no pacote cai no mesmo caso.
- `tasks/prd-nomes-de-mercado/casos.md:71`: o import de namespace repassado (`import * as Banco from '…'; export { Banco }`, `foto.ts:84`) tem o mesmo comportamento e também erra para o vermelho. Pode entrar junto com o import por padrão.
- `tools/renomear/conferir.ts:22-23`: o comentário do topo apresenta o `export * as X from` como forma que a entrada segue, e o limite novo mostra que essa é justamente a forma que o `aplicar` não acompanha. Quando a próxima correção mexer em `conferir.ts`, o comentário deve citar o limite. Nesta não dá, porque `tools/` está fora do pedido.
- `docs/aia/ouro-retido/RETIDOS.json:421`: o `como` registra uma medida feita em `1f770ea`, quando o arquivo ainda se chamava `ouro.test.ts`, e a troca reescreve esse registro. O documento justifica a escolha. Se reescrever registro histórico é aceitável cabe ao `conformidade-reviewer`, que também revisa esta correção.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 02:29:57 · `tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**O que conferi**
- **Pedido:** a correção cumpre o que `tasks/prd-nomes-de-mercado/travas.md:76-79` pede. Ela vem depois da 5.0, é do Arquiteto, troca as citações nos três arquivos do ouro e regrava o selo. O `conformidade-reviewer` aprovou.
- **"Quem altera":** o documento está de acordo com `docs/aia/ouro/README.md:2-6`. Marca o `conformidade-reviewer`, nenhum arquivo de `apps/*/src`, `packages/*/src` nem `tools/` muda, e o `revisor-geral` aparece porque o ouro está em `PASTAS_DE_PROCESSO` (`tools/processo/portao.ts:406-412`).
- **Selo:** o `sha256sum` do README novo dá `e358cc22…63aed`, o mesmo valor do `SELO.json`. As outras sete entradas não mudaram.
- **Restos:** busquei `nucleo`, `ouro.test`, `ouro.ts`, `selo-do-ouro` e `amostras-do-assistente` nos quatro arquivos de texto do ouro e não achei nada.
- **Documento da correção:** a tabela do Sintoma (linhas 8, 20, 126, 25 e 421) bate com o diff. A Causa também está certa: `tools/renomear/restos.ts:21-22,43` só deixa de isentar o ouro quando existir `mapas/13.json`.
- **`casos.md`:** os dois limites novos (`tasks/prd-nomes-de-mercado/casos.md:67-75`) vêm das recomendações que ficaram sem aplicar em `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md` (revisor-geral 2ª (1), test-engineer 2ª (4)), e esse documento já mandava registrá-los ali. Nenhum dos dois repete os quatro limites do topo de `tools/renomear/conferir.ts:27-32`.

**Recomendações**
1. `tasks/prd-nomes-de-mercado/casos.md:67-75`: essa parte não estava no pedido da `travas.md`. Ela entra "de passagem" no commit que altera o ouro, que o README descreve como "um commit só de `docs/`". O documento declara o acréscimo, é só texto e fecha uma pendência que já tinha destino escrito, e por isso não bloqueia. Da próxima vez, convém fazer em commit próprio, para o commit do ouro ficar só com o ouro.
2. `docs/aia/ouro/README.md:7-8`: a frase "O selo nasce na tarefa 1.0 da X5, hoje no `packages/core/…`" ficou sem verbo na segunda parte. Fica mais claro assim: "nasce na tarefa 1.0 da X5 e hoje está em `packages/core/src/ia/golden-seal.test.ts`". As duas linhas também passaram da largura do resto do arquivo. Só vale mexer se o README for alterado por outro motivo, porque cada mudança pede selo novo.
3. `tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md`, seção "Fora desta correção": "a árvore da linha 2 estava limpa" depende de saber que "linha" quer dizer a linha paralela do D79. "a árvore do andar `l2` estava limpa antes da correção" se lê sem esse contexto.
4. O `git diff --cached` veio vazio: todas as mudanças estão na árvore, nenhuma no índice, ao contrário do que o pedido dizia. Revisei sobre a árvore. Confira o índice antes do commit.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/correcoes/2026-10-31-ouro-cita-caminhos-antigos.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro/SELO.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro-retido/README.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/docs/aia/ouro-retido/RETIDOS.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/casos.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/travas.md
