# Achados das revisões — `tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-30 12:21:25 · `tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. Só mudaram `aplicar.ts`, `movimentos.ts` e `aplicar.test.ts`, com os três testes que a correção cita no documento. `tools/renomear/mapas/` ficou de fora, como o documento pede.

**Aderência à Tech Spec:** ok. A correção não mexe no desenho do `aplicar` descrito em §5 da `techspec.md` da X8 (passo 1 a 3, `getEditsForFileRename`, `git mv`). Ela repara dois defeitos da tarefa 1.0:
- o símbolo agora é achado na árvore como o rename anterior a deixou, e não mais pela posição guardada antes de qualquer rename;
- o import que terminava em `.js` continua em `.js` depois do move.

**Portão local:** carimbo válido. O `conferir` deu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

**Bloqueantes:** nenhum.

**Recomendações:**
1. `tools/renomear/aplicar.ts:72`: se `acharDeclaracoes` não achar nada na hora do rename, `renomearSimbolo` não troca nada e não recusa. Foi exatamente esse caminho que deixou passar os 40 símbolos. Hoje a conferência inicial (`existencias`) cobre isso, mas uma recusa explícita ali fecha essa classe de defeito. Algo como: "declaração de `de` sumiu depois dos renames anteriores".
2. `tools/renomear/movimentos.ts:53-58`: `conservarExtensao` não trata o import sem extensão. Em `apps/web/src` há 1988 imports relativos sem extensão, contra 0 em `apps/api/src` e em `packages`. O mapa 3 não move nada em `apps/web` (conferido em `.processo/aplicar-3-defeituoso.diff`), mas a primeira onda que mover um arquivo do web vai depender de o serviço manter o import sem extensão. Vale um teste de move com `from './x'` antes dessa onda.
3. `tools/renomear/movimentos.ts:30`: a causa registrada no documento é chamar o serviço com as preferências vazias (`{}`). A correção conserta o resultado depois, em vez de passar a preferência. Isso se justifica porque o repositório mistura imports `.js` e `.ts`, e o teste prova que os dois se mantêm. Mas essa escolha deveria estar escrita em uma linha da seção "Correção" do documento, por causa da D81 (padrão de mercado antes de mecanismo próprio).

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.test.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 12:21:38 · `tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`

**VEREDITO: REPROVADO**

**Cenários exigidos:**
- Caminho feliz: dois símbolos no mesmo arquivo, e o segundo é renomeado depois de o primeiro mudar o tamanho do texto antes dele.
- Caminho feliz: move de arquivo com import `.js` conserva o `.js`.
- Borda: move de pasta com imports `.js` e `.ts` misturados, e cada um fica com a sua extensão.
- Borda: relativo dentro da pasta movida que não muda também não troca a extensão.
- Borda: o primeiro rename encurta o texto, em vez de alongar.
- Borda: o `tsconfig` não passa pela conservação de extensão.
- Borda: `.tsx`, `.mts` e `.cts`, que a correção declara cobrir.
- Permissão, isolamento e concorrência não se aplicam: é ferramenta de linha de comando, rodada uma vez, sem dado de escola nem IA.

**Cobertos:**
- Os três testes citados no documento existem com o nome exato, em `tools/renomear/aplicar.test.ts:60`, `:165` e `:184`. Todos olham a árvore depois do rename, não só se o código rodou.
- `npx vitest run tools/renomear/aplicar.test.ts` deu 39 de 39 verdes.
- Os três blocos de mutação chegam à cláusula pelo motivo certo:
  - **Bloco 1:** com as declarações lidas da árvore original, a posição antiga cai no meio do nome já alongado. Aí `esquemaSeguinte` fica sem troca e a igualdade exata de `dois.ts` quebra.
  - **Bloco 2:** com `if (true)`, o `.js` vira `.ts`.
  - **Bloco 3:** sem o `!antigo.endsWith`, o `./x/b.ts` viraria `.js`.
- Não há `.skip`, mock nem provedor de IA.

**Bloqueantes:**

1. **`tools/renomear/movimentos.ts:60`: o desvio do `tsconfig` é cláusula nova sem bloco e sem teste.**
   - `mutacoes.ts --faltando` lista essa linha (`[?:]`). O documento afirma o comportamento ("`tsconfig` não passa por ela"), mas nada o prova.
   - Trocar a linha por `conservarExtensao(antigo, novo)` direto não deixa nenhum teste vermelho. O caso "dois tsconfig" (`aplicar.test.ts:238`) passa só caminhos `.ts` e de pasta, e com eles a função já devolve o texto do serviço sem mudar nada. Então o desvio não muda nada em entrada real.
   - **Correção exigida:** apagar o desvio, para que `textoNovo` seja só `conservarExtensao`. Ou escrever o caso em que ele muda o resultado, por exemplo um `include`/`files` de `tsconfig` cujo texto antigo termine em `.js`, com um bloco ` ```mutacao ` que o derrube.

2. **`tools/renomear/movimentos.ts:47` e `:54`: as extensões `.tsx`, `.mts` e `.cts` não têm teste, e a de `.tsx` está errada.**
   - O `--faltando` lista a linha 54 (`[?? regex]`). Os testes só exercitam `.ts`→`.js`. A seção "Correção" promete `.jsx`, `.mjs` e `.cjs`, e nenhum caso prova isso.
   - O mapa `'.tsx': '.jsx'` erra o TypeScript. Com `jsx: react-jsx`, o `.tsx` vira `.js`, e o import de `C.tsx` se escreve `./C.js`.
   - Se um `.tsx` importado como `./C.js` for movido, `antigo` não termina em `.jsx`. A função devolve `./C.tsx`, e volta o mesmo defeito que esta correção conserta, sem recusa.
   - **Correção exigida:** escolher uma de duas.
     - Reduzir o mapa ao que o repositório usa. Hoje há 2795 imports `.js` (nenhum em `apps/web`), e os 9 `.mjs` apontam para arquivos `.mjs` de verdade. O mapa ficaria `.ts`→`.js`, e `.mts`→`.mjs` e `.cts`→`.cjs` se forem mantidos.
     - Ou corrigir `.tsx`→`.js` e escrever um caso por extensão mantida, com bloco de mutação que derrube o regex ou a entrada do mapa.

**Recomendações:**
- Acrescentar ao teste de `aplicar.test.ts:60` uma variante em que o primeiro rename **encurta** o texto (nome longo para curto). O mapa 3 tinha os dois sentidos, e o documento cita os dois ("encurta ou alonga"). Hoje só o alongamento é exercitado.
- Cobrir também `export *`, `import('./x.js')` dinâmico e `vi.mock('./x.js')` num move com `.js`. O `vi.mock` passa por `reescreverRelativos` (`especificadores.ts:99-107`), que preserva a extensão pela leitura do código, mas nenhum caso com `.js` prova isso.
- A linha 38 aparece no `--faltando` só porque mudou o valor gravado. A condição já existia antes, e isso não pede bloco.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 12:29:00 · `tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O documento da correção agora registra a escolha da 1ª rodada do `test-engineer`: o mapa de extensões ficou reduzido ao par `.ts`/`.js` e o desvio do `tsconfig` saiu. Registra também por que a correção é feita depois do serviço, e não com a preferência `importModuleSpecifierEnding` (D81). A justificativa se sustenta: o repositório tem imports em `.js` e em `.ts`, e uma preferência única para o projeto inteiro estragaria um dos dois. O teste "move de pasta: o import que termina em .js continua em .js e o que termina em .ts continua em .ts" prova isso.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo, para o código atual).

Bloqueantes: nenhum.

O que conferi no diff:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts:51-53`: `conservarExtensao` agora só troca `.ts` por `.js` quando o import antigo terminava em `.js`. Isso resolve o mapeamento errado de `.tsx` para `.jsx` que o `test-engineer` apontou, porque esse caso deixou de existir. Não sobrou `COMO_JAVASCRIPT` nem `textoNovo` (o `textoNovo` que aparece em `simbolos.ts` é outra função).
- Tirar o desvio do `tsconfig` não muda nada: nenhum `include` ou `files` de `tsconfig*.json` no repositório termina em `.js`, então a condição nunca troca o texto desses arquivos. A linha 20 continua em uso por `vale` (linha 24), então não virou código morto.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.test.ts`: há dois testes novos. Um testa o sentido contrário do caso dos dois símbolos, quando o primeiro rename encurta o texto antes do segundo. O outro testa `export *`, `import()` dinâmico e `vi.mock` com `.js`. O documento diz com clareza que os dois são cobertura extra e não falhavam antes da correção.
- As mutações 2 e 3 foram reescritas para a linha nova e continuam mirando a condição certa: tirar a troca toda, e tirar a checagem `antigo.endsWith('.js')`.
- `aplicar.ts` não mudou desde a rodada aprovada.

Recomendações:
1. As duas recomendações da minha 1ª rodada estão com destino `TODO.md` na tabela "Recomendações sem aplicar", mas o `TODO.md` não aparece entre os arquivos alterados. Elas são a recusa explícita quando `acharDeclaracoes` não acha nada e o import sem extensão em `apps/web`. Se o processo não leva essas linhas ao `TODO.md` sozinho no pouso, convém escrevê-las agora, antes do commit. A do `apps/web` é a que mais importa: a primeira onda que mover arquivo do web vai cair nela sem aviso.
2. `movimentos.ts:52` usa `-'.ts'.length` como número mágico disfarçado. `-3`, ou uma constante `EXTENSAO_TS`, leria igual. É detalhe e não bloqueia.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 12:29:26 · `tasks/correcoes/2026-10-30-aplicar-perde-simbolos-e-troca-js-por-ts.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Símbolos (passos 1 e 2):
  - dois símbolos no mesmo arquivo quando o primeiro rename alonga o texto antes do segundo;
  - o mesmo quando o primeiro encurta o texto.
- Move de arquivo com import `.js`: o import muda de pasta e o `.js` fica.
- Move de pasta com imports `.js` e `.ts` misturados: cada import conserva a extensão que tinha, inclusive o relativo de dentro da pasta que não muda.
- Move com `.js` em `export *`, `import()` dinâmico e `vi.mock`.
- O `include` e o `files` do `tsconfig` não são afetados, agora que passam pela `conservarExtensao`.
- Correções exigidas na rodada 1:
  - o desvio do `tsconfig` sai, ou ganha caso e bloco;
  - o mapa de extensões fica reduzido, ou ganha um caso e um bloco por extensão.

**Cobertos:**
- **Correção 1, feita.** O `textoNovo` e o desvio do `tsconfig` saíram (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts:38`). Conferi o argumento do documento: `git grep` não acha nenhum `tsconfig*.json` com entrada terminando em `.js`, `.mjs`, `.cjs` ou `.jsx`. Então o texto antigo nunca termina em `.js` e a função o devolve como veio.
- **Correção 2, feita.** O mapa `COMO_JAVASCRIPT` e o regex saíram. Sobrou só o par `.ts`/`.js` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts:52`). O `.tsx` e o import sem extensão ficaram fora e estão registrados para o `TODO.md` na tabela de recomendações do documento.
- **Os três blocos de mutação alcançam a regra.**
  - O bloco 1 recarrega a árvore original e é derrubado pelos dois casos de dois símbolos.
  - O bloco 2 (`return novo`) é derrubado pelo `./y/a.js`, que viraria `./y/a.ts`.
  - O bloco 3 tira o `antigo.endsWith('.js')`. Ele é derrubado pelo `./y/b.ts`, que viraria `.js`, nas linhas 192 e 194 de `aplicar.test.ts`. Fica vermelho pelo motivo certo.
- **As duas recomendações da rodada 1 viraram testes.** Os dois conferem o texto exato. O documento os lista à parte, honestamente, como cobertura que não era vermelha antes.
- **Resultado:** `npx vitest run tools/renomear/aplicar.test.ts` passou 41 de 41. Não há `.skip`, teste comentado nem mock, e não há IA nem concorrência neste escopo.

**Bloqueantes:** nenhum.

**Recomendações:**
- A condição `novo.endsWith('.ts')` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/movimentos.ts:52` não tem bloco que a derrube sozinha. Hoje, tirá-la não muda nenhum resultado que o repositório produz:
  - um arquivo `.js` de verdade daria `./a.js` com ou sem ela;
  - o único caso que mudaria é um `.tsx` importado como `.js`, e o próprio documento diz que esses imports não existem hoje (nenhum `.js` em `apps/web`).

  Se ela for tirada nesse caso, o resultado sai corrompido (`./C..js`). Vale um caso com `.tsx` importado como `.js` quando a primeira onda mover arquivo do `apps/web`, junto com o item do import sem extensão que já vai para o `TODO.md`.
- Não há caso de move que passe por um `tsconfig` com `include` ou `files`. Agora que o `tsconfig` passa pela `conservarExtensao`, um caso assim travaria a premissa de que nada termina em `.js` ali. Não bloqueia, porque `git grep` mostra que a premissa vale para o repositório de hoje.
