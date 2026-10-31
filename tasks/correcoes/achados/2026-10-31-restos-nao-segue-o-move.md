# Achados das revisões — `tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 23:57:44 · `tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só mexe na ferramenta interna de renomear (`tools/renomear/`), que compara caminhos de arquivo do repositório com os mapas das ondas. Não há migration, schema, DTO, rota nem entidade de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada, porque nenhum campo novo entra.

Autorização por objeto: não se aplica. A ferramenta roda na máquina do desenvolvedor sobre a árvore do repositório e não tem rota nem titular.

Logs: limpos. Nenhum log novo. A única saída é o `trecho` de cada resto, e ela já existia antes desta correção: o docblock de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/restos.ts:24-25` a cobre pela regra 20, item 17 (a árvore só guarda dado sintético e o repositório é público). A correção não aumenta o que se imprime. Ela diminui: os `fica` e as trocas à mão em arquivos movidos deixam de aparecer como resto. O único resto novo é o arquivo que chegou ao caminho antigo depois do move, e ele imprime o mesmo tipo de `trecho` que já saía.

Auditoria: não se aplica. Nenhuma ação desta correção pede auditoria pela regra 20, item 10.

Envio externo: nenhum. Não há chamada a provedor, a rede nem a serviço de fora.

Seed/fixture: sintético. As fixtures novas em `restos.test.ts` e `reaplicar.test.ts` usam só nomes de símbolo (`Banco`, `Fila`), caminhos inventados (`apps/api/src/a.ts`, `docs/guia.md`) e conteúdo de código (`export const a = 'Banco'`). Não há nome, matrícula, nota nem conversa.

Pergunta de fechamento: não se aplica, porque a correção não cria nem move dado de aluno. A resposta que o sistema já dá à secretaria continua a mesma.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapa.ts:161`, a seção nova entrou entre o JSDoc de `validarMapa` ("As recusas que o mapa sozinho dá…") e a função. O comentário ficou solto acima do cabeçalho `// ---- o arquivo depois das ondas seguintes`, e `validarMapa` ficou sem documentação. Basta mover o bloco novo para antes do JSDoc. É organização de código, não é LGPD; deixo para o `revisor-geral` conferir.
- O docblock de `restos.ts:24-25` continua sendo a única barreira de dado pessoal na saída da ferramenta. Se a esteira um dia arquivar essa saída, convém trocar a premissa escrita por uma guarda que rode.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-30 23:58:28 · `tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A §5 já libera "o `fica` … a troca à mão registrada". A correção faz essa liberação continuar valendo depois que uma onda seguinte move o arquivo. O Arquiteto aprovou a saída (b) na triagem, e isso está registrado no documento e no `estado.md` do térreo. A frase nova da §5 ainda não está nesta linha, está na L1 sem commit (ver recomendação 2).

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapa.ts:161`: o bloco novo entrou entre o docblock de `validarMapa` e a função. O comentário "As recusas que o mapa sozinho dá, antes de olhar a árvore…" ficou solto acima do cabeçalho `// ---- o arquivo depois das ondas seguintes`, e `validarMapa` (linha 192) perdeu a documentação. A correção é levar a linha 161 para logo acima da linha 192, ou pôr o bloco novo antes dela.
2. A frase nova da Tech Spec §5 vai no commit da 5.0, na L1. Se o encontro da L2 for para a spec antes desse commit, a `spec/nomes-de-mercado` fica com o comportamento que a frase descreve, mas sem a frase. O Orquestrador precisa confirmar no encontro que a frase entra junto, ou logo depois.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/restos.ts:17-19`: a parte **Liberado** do docblock não diz que o `fica` e a troca à mão acompanham os moves das ondas seguintes. Hoje isso só se descobre lendo `mapa.ts`. Bastaria meia frase com remissão a `arquivoDepoisDasOndas`.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/restos.ts:69`: o nome `noLugarDeHoje` é muito parecido com `ocorrenciasNoLugarDeHoje` de `mapa.ts`, mas a função trabalha sobre uma chave `arquivo\0nome`. Um nome como `chaveDaTrocaAMaoNoLugarDeHoje` deixaria claro o que ela recebe.

Conferi também a premissa de que a onda classifica depois dos próprios moves. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/aplicar.ts`, os moves rodam em `aplicarSimbolosEMovimentos`, antes de `fechar` classificar. Por isso o `slice(indiceDaOnda + 1)` está certo. Os moves também seguem a ordem das entradas, a mesma que a tradução usa.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 23:58:55 · `tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

VEREDITO: REPROVADO

Cenários exigidos (ferramenta de `tools/renomear`, sem dado de escola nem IA, então não entram isolamento, permissão, concorrência nem adaptador falso):
- o `fica` num arquivo que uma onda seguinte moveu (arquivo e pasta)
- o `fica` que é a própria pasta
- dois moves em ondas seguidas (a→b→c)
- a troca à mão registrada num arquivo movido
- vermelho: o arquivo que chegou ao caminho antigo depois do move, tanto pelo `fica` quanto pela troca à mão
- vermelho: o move da própria onda não leva o `fica` dela
- vermelho: o move de uma onda anterior não leva o `fica` de uma onda seguinte
- a mesma tradução no `novas` do `reaplicar`, com o seu limite

Cobertos:
- Os oito casos de `restos.test.ts` (describe `restos: o arquivo que uma onda seguinte moveu`) existem, cada um com o nome citado no documento.
- As asserções conferem a lista exata de restos, com arquivo e linha, e não só que o código rodou.
- Os limites do `restos` usam o caminho antigo de verdade (`apps/api/src/a.ts`, `docs/guia.md`). Com o código do HEAD, eles falhariam com o caminho trocado.
- As 12 mutações alcançam as cláusulas novas de `mapa.ts`, `restos.ts` e `reaplicar.ts`.
- Não há `.skip`, teste comentado nem mock.
- Rodei `npx vitest run tools/renomear/restos.test.ts tools/renomear/reaplicar.test.ts`: 57 passaram.

Bloqueantes:
1. `tools/renomear/reaplicar.test.ts:204-205`: a segunda metade do teste não prova o que o nome diz. O nome é "...e o arquivo que chegou ao caminho antigo é [referência nova]", mas o arquivo que chega é `apps/api/src/c.ts`, que nunca foi o caminho antigo. O caminho antigo é `apps/api/src/a.ts`. Do jeito que está, a asserção só confere que um arquivo sem nenhuma classificação aparece, e isso já era verdade antes da correção. Uma mutação em `reaplicar.ts:85` que liberasse o caminho antigo e o novo juntos (`[...mapas.flatMap((m) => m.ocorrencias), ...ocorrenciasNoLugarDeHoje(mapas)]`) deixaria o teste verde. O `levarOQueFicou` (`reaplicar.ts:53`) não move `a.ts` quando `b.ts` existe, então o cenário real dá para montar.
   Correção exigida: no cenário `chegou`, pôr `'apps/api/src/a.ts': "export const nome = 'Banco'\n"` no lugar de `c.ts` e esperar `['apps/api/src/a.ts:1 cita "Banco": Banco']`.

Recomendações:
- `tools/renomear/mapa.ts:161`: o bloco novo entrou entre a docblock "As recusas que o mapa sozinho dá…" e o `validarMapa`. Com isso o `validarMapa` ficou sem documentação, e o `arquivoDepoisDasOndas` herdou uma docblock que não é dele. O certo é tirar a docblock de onde está e colocá-la de volta logo acima do `validarMapa`.
- `mapa.ts`, na linha do `pasta`: nenhum teste prova o `/` do prefixo `de/`. A mutação `atual.startsWith(entrada.de)` sobreviveria, e com ela um `fica` em `packages/nucleo-x/a.ts` seria levado para `packages/core-x/a.ts`. Vale um caso com uma pasta irmã de prefixo igual.
- `tasks/prd-nomes-de-mercado/casos.md`: faltam três dos casos novos, os limites "o move da própria onda não leva o `fica` dela" e "o move de uma onda anterior não leva o `fica` de uma onda seguinte", e o caso de duas ondas (a→b→c). O documento diz que o `casos.md` recebe "os casos novos".
- O `fica` que é a própria pasta e o arquivo dentro de pasta movida estão no mesmo `it`. Separar deixaria cada mutação apontar para o seu caso, já que o documento lista os dois como itens distintos.
- A mutação 8 (`?? ''` trocado por `as string`) mira código anterior à correção e falha por `TypeError`, não por uma cláusula nova. Não atrapalha, mas não prova nada desta correção.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/reaplicar.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/restos.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapa.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-31 00:06:09 · `tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff mexe só na ferramenta de rename (`tools/renomear/`), nos testes dela e nos documentos do processo. Nenhuma migration, nenhum DTO, nenhum endpoint e nenhum schema foram alterados.

Fora da tabela de dados do docs/lgpd.md: nada, porque não entrou campo pessoal novo.

Autorização por objeto: não se aplica, porque nenhuma rota foi criada ou alterada.

Logs: limpos. Nenhum log novo. A saída do `restos` imprime o `trecho` do resto, e isso não mudou desde a 1ª rodada.

Auditoria: não se aplica, porque nenhuma das ações que a regra 20, item 10, lista foi tocada.

Envio externo: nenhum.

Seed/fixture: sintético. As fixtures novas e as alteradas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/restos.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/reaplicar.test.ts` usam só a string `'Banco'` e caminhos inventados (`packages/nucleo-x/a.ts`, `apps/api/src/t/x/b.ts`, `apps/api/src/a.ts`). Nenhuma tem nome, matrícula ou conteúdo de pessoa.

Rodada nova, conferência:
- A 1ª rodada não exigiu nenhuma correção, então não havia nada a cobrar.
- Minha recomendação da 1ª rodada foi registrada no `TODO.md`, com a condição e o autor, e também na tabela "Recomendações sem aplicar" do documento da correção. A referência `restos.ts:24-25` continua certa. O docblock ganhou meia frase na linha 18, mas a mudança foi dentro da própria linha e não deslocou as seguintes. As linhas 24 e 25 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/restos.ts` seguem sendo o parágrafo "Dado pessoal", sem alteração.
- `mapa.ts` só mudou o docblock de `validarMapa` de lugar, para cima da função certa. `restos.ts` só renomeou a função local `noLugarDeHoje` para `chaveDaTrocaAMaoNoLugarDeHoje`. Nenhuma das duas mudanças altera o que a ferramenta lê ou imprime.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. A da 1ª rodada continua no `TODO.md` e só vira trabalho se a esteira passar a arquivar a saída do `restos`.

Pergunta de fechamento: esta correção não muda nada do que o sistema guarda sobre um aluno nem de para onde isso vai. A resposta continua a mesma de antes desta tarefa.

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 00:06:26 · `tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`

VEREDITO: APROVADO

Cenários exigidos: o `fica` de uma onda num arquivo que uma onda seguinte moveu, num arquivo dentro de uma pasta movida, e quando o `fica` é a própria pasta movida. A troca à mão registrada num arquivo movido. Duas ondas que movem o mesmo arquivo (a→b→c). A pasta irmã com o mesmo prefixo, que o move não leva. O arquivo que chegou ao caminho antigo, que não pode ficar liberado, tanto para o `fica` quanto para a troca à mão. O move da própria onda não leva o `fica` dela. O move de uma onda anterior não leva o `fica` de uma onda seguinte. O mesmo comportamento no `novas` do `reaplicar`.

Cobertos: todos os cenários acima. A correção exigida na 1ª rodada foi feita.

- **A correção da 1ª rodada** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/reaplicar.test.ts:204-205`): o cenário `chegou` agora tem `apps/api/src/a.ts` e `apps/api/src/b.ts`. Como `b.ts` já existe, o `levarOQueFicou` (`reaplicar.ts:53`) não move `a.ts`, e a asserção espera `['apps/api/src/a.ts:1 cita "Banco": Banco']`. Se a linha `reaplicar.ts:85` voltasse a liberar o caminho antigo junto com o novo, `a.ts` ficaria classificado e `novas` sairia `[]`: o teste fica vermelho pelo motivo certo.
- **Os três testes separados em `restos.test.ts:225-247`**: conferi cada mutação nova contra o `estaClassificada` (`referencias.ts:187`).
  - Com o `.replace(/\/$/, '')`, o `fica` vira `apps/api/src/t`, sem a barra final. Ele deixa de casar como pasta (`endsWith('/')` falso) e não é igual ao arquivo, então sobra resto: vermelho no caso da própria pasta.
  - Com o `startsWith(entrada.de)` sem a barra, `packages/nucleo-x/a.ts` vira `packages/core-x/a.ts` e deixa de casar: vermelho no caso da pasta irmã.
  - O `else if (false)` e o `para` sem o resto do caminho deixam vermelho o caso do arquivo dentro da pasta.
- **A mutação trocada do `restos.ts`**: com `mapas.length` no lugar de `indice`, a troca à mão não acompanha o move, `docs/novo.md` sai sem registro e o caso de `restos.test.ts:258` fica vermelho.
- **O documento confere com o código**: o bloco `restos: o arquivo que uma onda seguinte moveu` tem dez casos, como o documento diz. Os nomes citados nos blocos `mutacao` batem com os `it`. Os casos novos do `casos.md` (Vermelho e Verde) têm cada um o seu teste.
- **Execução**: rodei `restos.test.ts` e `reaplicar.test.ts`. Os dois arquivos passaram, com 59 casos verdes, sem `.skip`, sem mock e sem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As duas da 1ª rodada que ficaram sem aplicar, a do privacy-guardian (anotada no `TODO.md`) e a do revisor-geral (que fica com o Orquestrador), estão escritas com destino em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/correcoes/2026-10-31-restos-nao-segue-o-move.md`.
