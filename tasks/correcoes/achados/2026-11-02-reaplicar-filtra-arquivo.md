# Achados das revisões — `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 00:43:50 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: APROVADO

A correção só mexe na ferramenta de renomeação, que roda no repositório e não toca dado de pessoa. Rodei `reaplicar.test.ts` e `restos.test.ts`: 70 de 70 testes passaram.

Campos pessoais tocados: nenhum. A mudança fica em `tools/renomear/`, em um `fica` novo no `tools/renomear/mapas/13.json` (o serviço `migrar` citado no `README.md`) e no `tasks/prd-nomes-de-mercado/casos.md`. Não há migration, schema, DTO, endpoint nem storage.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhum campo novo.

Autorização por objeto: não se aplica, a correção não cria nem altera rota.

Logs: limpos. Os arquivos alterados (`registradas.ts`, `sintaxe.ts`, `texto.ts`, `reaplicar.ts`) não têm `console` nem `logger`. A única saída continua sendo a que já existia no `reaplicar`: arquivo, linha, nome antigo e o trecho de código ou documento do repositório. Não sai dado de aluno.

Auditoria: não se aplica, a ferramenta não faz nenhuma das ações que a regra 20, item 10, manda auditar.

Envio externo: nenhum.

Seed/fixture: sintético. Os testes novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.test.ts` só usam nomes de símbolo e de arquivo (`portao`, `Banco`, `AdaptadorFalso`, `Fila`, `example.com`). Não aparece nome, matrícula, nota nem conversa.

Bloqueantes: nenhum.

Recomendações:
- Na regra 20, a correção ajuda. O incidente de origem trocou o `portao` de `tools/processo/hook-revisoes.ts` e derrubou o hook do Bash, que é por onde as revisões dos guardiões são cobradas. Com o filtro por `arquivo` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/sintaxe.ts`, esse homônimo não é mais trocado. Também deixa de ser trocado o nome que uma onda classificou `fica`, o que protege nomes de guarda e de teste de privacidade que por acaso coincidam com algum `de`.
- O `ehDocumentoVivo` agora vale para os README de todas as pastas (em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/texto.ts`), então o passo 5 passa a reescrever os README de `packages/` e `apps/`. Para a próxima onda: sempre que um nome citado no `docs/lgpd.md` ou num README mudar (campo, tabela, guarda), confirmar que o mapa de dados continua apontando para o nome que existe no código. Hoje esse alinhamento só é garantido pela revisão.
- O limite que a própria correção declara (crase aberta numa linha e fechada na seguinte, num comentário) pode, numa onda futura, deixar ou trocar errado uma referência a guarda ou teste de privacidade. O `restos` e o `tsc` acusam esse caso. Vale levar o assunto à retro, como o documento já propõe.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-02 00:45:26 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a entrada com `arquivo` troca o nome no arquivo dela e em quem importa o nome de lá. Isso vale pelo caminho relativo, pelo barrel do pacote e pelo nome do pacote, inclusive o nome antigo que uma onda seguinte trocou.
- **Borda: homônimo de outra pasta.** `portao` de `tools/processo/` contra o de `e2e/`.
- **Borda: homônimo no mesmo pacote.** Declarado em outro arquivo, e quem o importa.
- **Borda: arquivo que importa outro nome da entrada e tem um homônimo local.**
- **Borda: o próprio arquivo da entrada com o nome antigo,** trazido pelo merge.
- **`fica` e troca à mão:** no identificador, no comentário de código e na linha do documento.
- **Palavra comum que é pedaço de outro nome entre crases,** contra o membro de chamada que muda.
- **Caminho sem extensão** contra outro arquivo de mesma base.
- **README fora de `docs/`,** e o protótipo continuando de fora.
- **Idempotência:** rodar duas vezes não muda nada.

Isolamento entre escolas, permissão e concorrência não se aplicam: é ferramenta de renomeação, sem dado de escola nem operação concorrente.

**Cobertos:**
- Os 10 testes que a seção "Teste que reproduz" cita existem com o nome citado: 9 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.test.ts` e o do README em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.test.ts`. Rodei os dois arquivos: 70 de 70 verdes.
- Os 8 blocos de mutação acertam a cláusula certa, e cada cenário chega a ela. O bloco 3 (de/para na cadeia de nomes do pacote) fica vermelho porque o import `@educa/nucleo` sai do alcance, que é o motivo certo.
- As asserções comparam o conteúdo final dos arquivos, e não só que o código rodou.
- Não há `.skip`, teste comentado, mock nem chamada a provedor de IA.
- "Duas vezes: a segunda não muda nada" continua de pé.
- Pelo RF17, código de `tools/` não exige bloco de mutação, então a falta de bloco não é bloqueante por si.

**Bloqueantes:**

1. **`tools/renomear/sintaxe.ts:144-157` (`trazONome`, usado na linha 166): o caminho negativo não tem teste.** Troquei mentalmente o corpo por `return true`, e nenhum teste falha. Nenhum cenário tem um arquivo que importa *outro* nome do módulo da entrada e usa um homônimo local ou de outro módulo. Esse é justamente o caso comum na árvore real: um arquivo de `apps/api` com `import { X } from '@educa/shared'` e um `Banco` próprio. Sem a cláusula, ele entra no alcance e o homônimo é trocado, que é a mesma classe de erro do incidente do `portao`.
   - **Correção exigida:** um teste com, por exemplo, `apps/api/src/misto.ts` contendo `import { FakeAdapter } from '@educa/shared'` e `import { Banco } from './local.ts'`. Asserção: o `Banco` fica. Mais um bloco de mutação `trazONome → true`.

2. **`tools/renomear/sintaxe.ts:174` (`alcance.arquivos.has(caminho)`): o arquivo da própria entrada não tem teste.** Em nenhum teste novo o arquivo declarante tem o nome antigo: o `db.ts` do `aposOMerge` já declara `Database`. Sem esse termo, o uso do nome antigo que o merge da `develop` leve ao próprio arquivo da entrada deixa de ser trocado, e nenhum teste fica vermelho.
   - **Correção exigida:** um teste em que o merge traz `export const padrao = new Banco()` dentro de `packages/shared/src/db.ts`, com a asserção de que vira `Database`. Mais um bloco que remove o termo.

3. **`tools/renomear/texto.ts:172` (`semOsQueFicam` em `trocarNosComentarios`): o `fica` e a troca à mão no comentário de código não têm teste.** O `casos.md:60` declara "no comentário e no documento", e a seção "Correção" do documento diz "por linha e por comentário". Os testes `o que a onda classificou fica…` e `a troca à mão que o relatório da onda registrou…` só exercitam o documento (linha 198). Remover o `semOsQueFicam` da linha 172, ou passar `undefined` no lugar de `ficaEm` ali, não deixa teste nenhum vermelho.
   - **Correção exigida:** um caso com um comentário que tem o nome entre crases num arquivo com `fica` com `trecho` (e outro com troca à mão registrada no relatório), mais um comentário vizinho que muda. Mais o bloco de mutação.

**Recomendações:**
- **`casos.md:64`:** "a árvore real… sai do `reaplicar` sem nenhuma mudança" é uma conferência manual, não um caso com teste. O próprio documento diz "além do teste". Vale marcar como conferência, para não parecer cláusula coberta.
- **`sintaxe.ts:73`:** o `fica` de identificador com `trecho` (a linha certa do arquivo) não é exercitado. A ocorrência `fica` do teste não tem `trecho`. Um teste com duas linhas no mesmo arquivo, uma que fica e outra que muda, prova isso.
- **`sintaxe.ts:128`:** o barrel por `index.ts` e o especificador `.js` resolvido para `.ts` não têm caso.
- **`texto.ts:146-158`:** `semOsQueFicam` tira a entrada da unidade inteira. Num JSDoc de várias linhas, uma ocorrência `fica` segura todas as outras do mesmo nome no comentário. O documento deveria declarar esse limite, ou o código deveria ir por ocorrência.
- **`ehDocumentoVivo`:** falta um teste que garanta que o `mockups/README.md` continua fora. Ele existe na árvore, e a regra nova do README só o deixa de fora pelo `foraDoPasso5`.
- **`restos.test.ts`:** convém confirmar se a segunda metade do teste novo (`tools/Fila-local.ts` e `example.com` não são resto) estava vermelha antes. Se já passava, é só uma guarda, e o documento deveria dizer isso como fez no outro caso.

## test-engineer · 2ª rodada · APROVADO · 2026-11-02 10:53:27 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: APROVADO

Cenários exigidos (para esta rodada, as três correções da 1ª):
1. Um arquivo que importa outro nome do módulo da entrada e tem um homônimo local fica fora do alcance (`trazONome`, caminho negativo).
2. O arquivo da própria entrada entra no alcance mesmo sem importar nada (`alcance.arquivos.has(caminho)`).
3. O `fica` e a troca à mão valem também no comentário de código, e um comentário vizinho continua mudando (`semOsQueFicam` em `trocarNosComentarios`).

Cobertos (rodei `npx vitest run tools/renomear/reaplicar.test.ts`: 31 de 31 passam):
1. `o arquivo que importa outro nome do módulo da entrada e tem um homônimo local fica…`. Esse teste chega à cláusula. O `misto.ts` importa `FakeAdapter` de `@educa/shared`, que é o pacote da entrada. Com `trazONome → true` (bloco 9), esse import põe o arquivo no alcance. O `new Banco()` então vira `Database`, porque `textoDoUso` devolve `entrada.para` para um uso que não é declaração local. A comparação exata do `misto.ts` fica vermelha pelo motivo certo. O import de `./local.ts` não interfere: o `apps/api` está fora de `alcance.pastas`, então ele não aponta para a entrada.
2. `o arquivo da própria entrada, com o nome antigo que o merge trouxe, muda mesmo sem importar nada`. Sem o termo (bloco 10), o `db.ts` não tem import nenhum, então `importaDoAlcance` dá falso e o `new Banco()` fica. O passo 5 só troca em comentário e documento, então não esconde a falha. A asserção do texto inteiro fica vermelha.
3. `o que a onda classificou fica não se troca no comentário de código…` e `a troca à mão que o relatório registrou fica no comentário de código…`. Os blocos 11 e 12 passam `undefined` no lugar de `ficaEm` na linha 172 de `texto.ts`. O `Banco` da primeira linha passa então a ser trocado nos dois testes, e a asserção exata falha. Os dois testes também conferem que o comentário vizinho muda.

Seção "Mutações" contra o diff: os quatro blocos novos (9 a 12) correspondem às três cláusulas cobradas, e cada um cita o teste que o prova. Nenhum código de produção mudou desde a 1ª rodada, então não há cláusula nova sem bloco. Não há `.skip`, teste comentado nem mock que esconda a regra: os testes usam um repositório git de verdade, montado por `montarRepositorio`. Não há IA nem concorrência nesta correção.

Bloqueantes: nenhum.

Recomendações:
- A troca à mão ignora a linha. Em `tools/renomear/reaplicar.ts:97`, o `deixaNoTexto` usa `registradas.has(`${arquivo}\u0000${de}`)` e não lê a coluna "Linhas" do relatório. Assim, um segundo comentário com o mesmo `Banco` no `d.ts` também ficaria. O teste do comentário vizinho troca outro nome (`AdaptadorFalso`), por isso não prova nem desmente esse alcance por arquivo. Vale registrá-lo como limite declarado em "Recomendações sem aplicar", ao lado do item do JSDoc de várias linhas, ou levá-lo para a retro.
- Os blocos 11 e 12 aplicam a mesma mutação e diferem só no teste citado. Isso é aceitável, mas um bloco 12 que tirasse só o `registradas.has(...)` da linha 97 de `reaplicar.ts` provaria a troca à mão no comentário pela cláusula própria dela.
- No `casos.md`, a conferência da árvore real está marcada como "manual, sem teste". É honesto e não bloqueia. Fica para a validação confirmar o número (0 arquivos mudados) no relatório.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/sintaxe.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/texto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-02 10:56:47 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: há divergência na §5 (passo 5, `reaplicar` e regra do mapa de onda feita). A correção registrou a mudança no próprio documento e no `casos.md`, mas não na `techspec.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

**O que eu mesmo conferi:**
- `restos` na árvore atual: limpo, 11 mapas.
- `reaplicar` rodado numa cópia da árvore com o diff da correção no índice: 0 arquivos mudados, como o documento afirma. A cópia foi apagada no fim.

**Bloqueantes:**

1. `tasks/prd-nomes-de-mercado/techspec.md` não foi alterada. A correção muda o que a §5 define, e isso aparece só no `2026-11-02-reaplicar-filtra-arquivo.md` e no `casos.md`. O próprio `corrigir` diz que a Tech Spec é a referência do desenho. São cinco pontos:
   - **Documento vivo** (`techspec.md:74`). A Tech Spec diz que documento vivo é "`CLAUDE.md`, `.claude/`, `docs/`". `tools/renomear/texto.ts:25` passou a incluir o `README.md` de qualquer pasta. Isso vale para o `aplicar` e para o `restos`, não só para o `reaplicar`.
   - **Palavra comum entre crases** (`techspec.md:77-79`). A Tech Spec diz que o passo 5 troca do mesmo jeito e que a onda desfaz à mão e registra `fica`. `texto.ts:64-70` (`ehPedacoDeOutroNome`) e `texto.ts:33-34` (`regexDeCaminho` com `semOutraExtensao`) agora pulam o pedaço de outro nome. O pulo vale também para o `aplicar` e para o `restos`, que usa `trocarTrecho`.
     - A regra de `texto.ts:68` é mais larga que o "fim de domínio" que o documento declara. Qualquer `` `x.Palavra` `` sem `(` entre crases, inclusive `{@link Modulo.membro}`, deixa de ser trocado. Também não vai para a troca à mão, e o `restos` não acusa: o nome antigo fica sem aviso.
     - Isso precisa entrar na §5 como limite declarado, ou a regra precisa ser estreitada ao domínio.
   - **O `reaplicar`** (`techspec.md:128-130`). O parágrafo não diz nada do alcance por `arquivo` (`sintaxe.ts:113`, `sintaxe.ts:173`), do respeito ao `fica` (`sintaxe.ts:67`) nem da troca à mão registrada no passo 5 (`reaplicar.ts:92-96`). O limite declarado no cabeçalho de `sintaxe.ts:19-24` também fica de fora: quem importa o nome por outro pacote que o reexporta não entra no rename.
   - **Parágrafo desatualizado** (`techspec.md:189-193`). Ele ainda afirma que a `renomearPelaSintaxe` troca na árvore inteira, sem o filtro. Precisa dizer que a correção `2026-11-02-reaplicar-filtra-arquivo` resolveu isso.
   - **Mapa de onda feita** (`techspec.md:125`). A Tech Spec diz "O mapa e o relatório de onda feita não se reescrevem". A correção acrescenta uma ocorrência `fica` (`migrar`, `README.md`) ao `tools/renomear/mapas/13.json:424-430`, mapa da 13.0, que já tem commit. Nenhuma correção anterior reescreveu mapa de onda: a `adenda-5` criou mapa próprio.

   **Correção exigida:** registrar os cinco pontos na `techspec.md`, §5, com a referência à correção. Para o mapa da 13.0, há dois caminhos: declarar na Tech Spec a exceção ao "não se reescrevem", com o motivo (o `README.md` só entrou no `restos` agora), ou classificar o `migrar` fora do `13.json`. Se a forma de registrar a mudança na Tech Spec não couber numa correção, pare e envie `/seguir DIVERGÊNCIA de Implementador`, com `Motivo: desenho`, como o `corrigir` manda.

**Recomendações:**
- `tools/renomear/restos.ts:8`: o `export { trocaAMaoRegistrada } from './registradas.ts'` está entre os imports e existe só para o `restos.test.ts:8`. Melhor o teste importar de `registradas.ts` e a reexportação sair.
- `tools/renomear/sintaxe.ts:120-121`: há duas linhas em branco seguidas.
- `tools/renomear/sintaxe.ts:71`: `usosNoTexto` refaz o `texto.split('\n')` para cada identificador encontrado. Bastaria partir as linhas uma vez por arquivo.
- `tools/renomear/registradas.ts:5-8`: o comentário de bloco solto no topo duplica o que o JSDoc de `trocaAMaoRegistrada` já diz. Pode virar só o JSDoc da função.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/texto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/sintaxe.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/13.json`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-02 11:11:39 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff mexe só na ferramenta de renomear (`tools/renomear/`), na Tech Spec, no `casos.md` e no documento da correção. Não toca schema, migration, DTO, endpoint, storage nem envio a provedor.

Fora da tabela de dados do docs/lgpd.md: nada. Não entrou campo pessoal novo.

Autorização por objeto: não se aplica, porque não há rota nem consulta nova.

Logs: limpos. Não há `console.` nem `logger.` em `sintaxe.ts`, `registradas.ts` ou `restos.ts`.

Auditoria: não se aplica. Nenhuma ação desta correção está entre as que a regra 20 item 10 exige auditar.

Envio externo: nenhum.

Seed/fixture: sintético. Os 4 testes novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.test.ts` usam só nome de símbolo (`Banco`, `Database`, `FakeAdapter`, `AdaptadorFalso`), caminho inventado e texto de comentário. Não há nenhum dado de pessoa.

Bloqueantes: nenhum.

O que conferi neste diff, em relação à 1ª rodada:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/sintaxe.ts:70`, o arquivo agora é partido em linhas uma vez só, em `usosNoTexto`. O comportamento é o mesmo e não há efeito sobre privacidade. Também saiu uma linha em branco duplicada. Conferi que o arquivo em disco bate com o diff.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts`, saiu a reexportação de `trocaAMaoRegistrada`. O teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.test.ts:8` agora importa direto de `registradas.ts`. Isso só reorganiza o código.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/registradas.ts`, os dois comentários repetidos viraram um só.
- Na `techspec.md`, a §5 passa a registrar o que a correção mudou, com os limites e a exceção do `13.json`. É só texto de processo, sem nenhuma referência a campo de pessoa.
- No documento da correção, as minhas duas recomendações da 1ª rodada aparecem na tabela "Recomendações sem aplicar", com o destino de cada uma.

Correções exigidas na rodada anterior: nenhuma. Não havia o que verificar.

Recomendações: nenhuma nova. As duas da 1ª rodada continuam valendo para a retro, como já estão na tabela do documento da correção:
- Quando o nome de um campo, tabela ou guarda citado no `docs/lgpd.md` mudar, conferir se o mapa de dados continua apontando para o nome que existe no código. Hoje só a revisão garante isso.
- Uma crase aberta numa linha e fechada na seguinte pode fazer o `reaplicar` deixar ou trocar errado uma referência a guarda ou teste de privacidade. Já está registrado como limite declarado.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-02 11:11:53 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As cinco correções da 1ª rodada estão na `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md`, cada uma com a referência à correção:
1. **Documento vivo:** o passo 5 da §5 agora conta o `README.md` de qualquer pasta como documento vivo.
2. **Palavra comum que é pedaço de outro nome:** está registrada para o `aplicar`, o `restos` e o `reaplicar`. O limite declarado descreve o que o código faz: qualquer `` `x.Palavra` `` sem `(` depois fica sem troca e sem aviso do `restos`. A regra está em `texto.ts:64-70`, aplicada em `texto.ts:111`.
3. **O `reaplicar`:** o parágrafo ganhou o alcance por `arquivo`, o `fica` e a troca à mão registrada (por arquivo e nome, não por linha). Ganhou também o limite de quem importa o nome por outro pacote que o reexporta, e o do `fica` dentro de um JSDoc de várias linhas.
4. **Parágrafo da 13.0:** passou ao pretérito e diz que esta correção resolveu o problema.
5. **Mapa da 13.0:** a exceção ao "não se reescrevem" para o `13.json` está declarada, com o motivo: o `README.md` só entrou no `restos` nesta correção.

Os quatro ajustes que recomendei também foram feitos e não mudam o comportamento: a reexportação saiu do `restos.ts`, o texto é partido em linhas uma vez só, a linha em branco dupla saiu e o comentário duplicado foi juntado ao JSDoc. A mutação 12 agora aponta para o `deixaNoTexto` de `reaplicar.ts`, e o teste citado cobre esse ponto.

Recomendações:
- Na `techspec.md`, o passo 5 lista como exceção do `README.md` o do protótipo, o do ouro e os de `tasks/`. O `foraDoPasso5` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/texto.ts:20`) tira também `tools/renomear/` e `.claude/worktrees/`. Vale completar a lista ou remeter a esse ponto do código.
- O `casos.md` (seção `reaplicar (1.0)`) não registra o limite declarado: o membro citado sem chamada (`` `Modulo.membro` ``, `{@link Modulo.membro}`) fica sem troca e sem aviso. Um caso que fixe esse comportamento ajuda quem conferir à mão na próxima onda.

## test-engineer · 3ª rodada · APROVADO · 2026-11-02 11:12:20 · `tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 2ª rodada, que já estava aprovada. Nesta rodada conferi só o diff `ccc316a0 → 8ded557c` e o que ele afeta.
- O que a onda marcou como `fica` não é trocado, nem no identificador nem na linha do documento.
- A troca à mão registrada no relatório também fica, no documento e no comentário de código.
- O filtro por `arquivo` continua valendo, com o homônimo de outra pasta, o barrel e o pacote já renomeado.
- A palavra comum que é pedaço de outro nome continua sem troca.
- O `README.md` de qualquer pasta conta como documento vivo.

Cobertos:
- **`tools/renomear/sintaxe.ts:70-74`**: `usosNoTexto` agora parte o arquivo em linhas uma vez só (`linhas`). Quando não há `ficaEm`, `linhas` fica vazio, mas nunca é lido, porque o `ficaEm?.()` para antes. O comportamento é o mesmo de antes.
  - O bloco 4 de "Mutações" (linhas 110-113 do documento) foi atualizado para o texto novo da linha 74. Ele continua tirando a cláusula `ficaEm` e aponta para o teste "o que a onda classificou fica não se troca…".
  - A linha em branco dupla saiu, sem efeito no comportamento.
- **Bloco 12** (linhas 166-169), agora em `tools/renomear/reaplicar.ts:97`: tira o `registradas.has(...)` de `deixaNoTexto`. A linha existe como está escrita no bloco.
  - Antes, o bloco 12 era cópia exata do bloco 11 (`texto.ts`, `semOsQueFicam(undefined, …)`). Agora prova uma cláusula própria, pelo teste do comentário de código.
  - O bloco 5 ataca a mesma linha pelo teste do documento.
  - A cláusula de `texto.ts` continua com o bloco 11. Nenhuma cláusula ficou sem bloco.
- **Reexportação de `trocaAMaoRegistrada`**: saiu do `restos.ts`, e `tools/renomear/restos.test.ts:8` importa de `registradas.ts`. Nenhum outro arquivo importava pelo `restos.ts`; `reaplicar.ts:8` já importava de `registradas.ts`.
- **`registradas.ts`**: o comentário solto foi juntado ao JSDoc. É só texto.
- **Testes**: `npx vitest run tools/renomear/reaplicar.test.ts tools/renomear/restos.test.ts` passou, 2 arquivos e 74 testes.
- **Documento**: a tabela "Recomendações sem aplicar" registra com destino as recomendações do `test-engineer` (2ª rodada) e do `privacy-guardian` (1ª rodada). A techspec §5 registra:
  - os limites declarados: a regra é pela forma, não pelo sentido; a troca à mão vale por arquivo e nome, não por linha; o `fica` vale por comentário, não dentro de um JSDoc de várias linhas;
  - a exceção do `13.json` ao "o mapa de onda feita não se reescreve", com o motivo.

Bloqueantes: nenhum.

Recomendações:
- A tabela "Revisões" ainda não tem a 3ª rodada do `test-engineer` nem a 2ª do `revisor-geral`. Isso fica para quem fecha a correção.
- As recomendações da 2ª rodada continuam valendo: a troca à mão por arquivo e nome, sem olhar a linha, vai para a retro. O Validador precisa confirmar que a árvore real dá 0 arquivos mudados.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/sintaxe.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/reaplicar.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/registradas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-reaplicar-filtra-arquivo.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/techspec.md
