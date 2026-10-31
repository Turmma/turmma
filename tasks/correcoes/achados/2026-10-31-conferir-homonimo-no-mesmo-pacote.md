# Achados das revisões — `tasks/correcoes/2026-10-31-conferir-homonimo-no-mesmo-pacote.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 10:56:03 · `tasks/correcoes/2026-10-31-conferir-homonimo-no-mesmo-pacote.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A regra entrou antes, no commit `3d6b9baa`, em Tech Spec §5 e em `casos.md`, nos dois lados: vermelho e verde.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.ts:28`: o limite (2) do comentário do topo ficou desatualizado. Ele ainda diz que uma entrada com `arquivo` em `tools/processo/` "troca o homônimo de qualquer outro arquivo de `tools/`". Com a correção, o homônimo declarado em outro arquivo de `tools/` (sem `origem`) não é mais trocado. Só o que reexporta continua sendo. O texto deve ser reduzido como foi feito no (3). Não bloqueia porque o erro fica do lado do vermelho e não deixa passar diferença.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.ts:159`: o ternário junta as duas regras numa linha só e fica difícil de ler. As duas regras são: sem `origem`, compara o arquivo; com `origem`, olha o pacote ou a reexportação. Um `if (item.origem === undefined) return item.arquivo === candidata.arquivo` antes do `return` atual deixa cada regra numa linha.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.ts:29-31`: as linhas reescritas do comentário passaram da largura das vizinhas. Vale quebrar as linhas de novo.

Conferi a premissa de que `candidata.arquivo` e `item.arquivo` são os dois caminhos do `HEAD`, e ela vale. O `aplicar` renomeia os símbolos antes dos moves (`aplicar.ts:69-75`), e o `acharDeclaracoes` lê `entrada.arquivo` na árvore ainda sem moves (`simbolos.ts:68`). A mutação declarada derruba o caso verde novo.

## test-engineer · 1ª rodada · APROVADO · 2026-10-31 10:56:32 · `tasks/correcoes/2026-10-31-conferir-homonimo-no-mesmo-pacote.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: a entrada `simbolo` com `arquivo` faz o nome declarado nesse arquivo passar ao nome novo.
- Borda: um homônimo declarado em outro arquivo do mesmo pacote, que o `aplicar` não renomeia, continua com o nome antigo e fica verde. É o caso `Linha` de `pecas-da-lista.tsx` na 9.0.
- Borda (vermelho): esse homônimo aparece com o nome novo na árvore e precisa ser acusado.
- Borda: quem reexporta do arquivo da entrada (com `origem`), dentro ou fora do pacote, continua seguindo a entrada.
- Borda: um homônimo em outro pacote continua com o nome antigo, e a entrada sem `arquivo` continua valendo em todo pacote.
- Borda: a entrada de símbolo cujo arquivo também se move na mesma onda.
- Permissão, isolamento entre escolas e concorrência: não se aplicam. É ferramenta de `tools/` e não toca dado de escola nem operação paralela.

Cobertos:
- O verde do homônimo: `o homônimo declarado em outro arquivo do mesmo pacote fica com o nome antigo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.test.ts:336`).
- O vermelho do homônimo: `o homônimo de outro arquivo do mesmo pacote sai com o nome novo da entrada` (`conferir.test.ts:139`). Os dois nomes batem com a seção "Teste que reproduz".
- A reexportação, dentro e fora do pacote, o homônimo de outro pacote e a entrada sem `arquivo`: os testes que já existiam (`:330`, `:342`, `:350`, `:357`, `:370`, `:378`, `:384`), todos verdes.
- Mutação: o bloco declarado volta exatamente a linha mudada no `git diff`. Com o código antigo, o teste citado fica vermelho pelo motivo certo. No `HEAD`, `db.ts` e `outro.ts` exportam `Banco`. A foto de antes passaria os dois para `Database`, enquanto a árvore tem `Database` e `Banco`. Isso dá `saiu`/`entrou` em `packages/shared`. O teste do vermelho também mata essa mutação, porque com o código antigo não sobraria divergência para ele exigir. Não há cláusula nova sem bloco.
- Rodei `npx vitest run tools/renomear/conferir.test.ts`: 58 de 58 passaram. Não há `.skip`, teste comentado nem mock. As asserções são sobre a lista exata de divergências, não só sobre o código ter rodado.

Bloqueantes: nenhum.

Recomendações:
1. A correção passou a depender de `item.arquivo` e `candidata.arquivo` serem os dois caminhos do `HEAD`. Antes, com a comparação por pacote, isso era indiferente.
   - O código está certo. O `aplicar` renomeia os símbolos antes de mover os arquivos (`tools/renomear/aplicar.ts:69-75`). E `aplicarMapaAFoto` passa a `paraONomeExportado` o item original, não o já movido (`tools/renomear/conferir.ts:171`).
   - Falta um teste que prenda isso: uma entrada `simbolo` com `arquivo: 'packages/shared/src/db.ts'` e uma entrada `arquivo` que move esse mesmo `db.ts` na mesma onda, esperando verde.
   - É o caso real da 9.0, em que `components/ui/Linha.tsx` vira `ListItem`. Hoje ele só foi provado à mão, no checkout da L2. Se alguém trocar `item` por `{ ...item, arquivo }` na linha 171, nenhum teste fica vermelho, e o mapa 9 volta a acusar.
2. Para documentar o limite (3) que sobra, um teste do lado vermelho ajudaria: outro arquivo do pacote da entrada reexporta o homônimo (`export { Banco } from './outro.ts'`). Assim o limite deixa de existir só no comentário.
3. O comentário do topo de `conferir.ts`, na linha 29, passou da largura das linhas vizinhas. É só de texto.

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 11:17:13 · `tasks/correcoes/2026-10-31-conferir-homonimo-no-mesmo-pacote.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada (homônimo declarado em outro arquivo do mesmo pacote fica com o nome antigo; o lado vermelho do mesmo caso; a entrada sem `arquivo` continua valendo em todo pacote; reexportação do pacote da entrada continua seguindo), mais a recomendação nº 1 que a ordem mandou aplicar: entrada `simbolo` cujo `arquivo` a mesma onda move, para prender que o `item.arquivo` comparado é o do HEAD.

Cobertos:
- **Recomendação nº 1, feita.** O teste está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.test.ts:342-349` e se chama "a entrada vale para o arquivo que o `arquivo` dela nomeia no HEAD, mesmo quando a onda o move". Ele falharia sem a regra. Com a mutação documentada, que passa `{ ...item, arquivo }` (o caminho de depois) para `paraONomeExportado`, o `database.ts` deixa de ser igual a `db.ts`, o `Banco` fica na foto de antes e não casa com o `Database` de depois. O `outro.ts`, que tem `Banco` dos dois lados, faz o vermelho cair exatamente no par que importa.
- **Segundo bloco de mutação.** Está no documento da tarefa (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-conferir-homonimo-no-mesmo-pacote.md:41-46`). A linha `-` é idêntica, recuo incluído, a `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.ts:173`, e o bloco cita o teste pelo nome.
- **Primeiro bloco, depois da quebra do `return`.** A cláusula nova agora é uma linha só (`conferir.ts:160`), igual à linha `-` do primeiro bloco. A mutação continua aplicável e continua chegando à cláusula.
- **Seção "Teste que reproduz".** Cita os três testes pelo nome, e cada um existe.
- **Comentário do topo.** O limite (2) foi reescrito como "troca o nome que qualquer outro arquivo de `tools/` reexporta", e isso confere com o código: o item sem `origem` agora exige o mesmo arquivo, e só o item com `origem` segue pelo pacote. O limite (3) foi reduzido ao que realmente sobra.
- **Execução.** `npx vitest run tools/renomear/conferir.test.ts` deu 59 de 59 verdes, sem `.skip`, sem mock e sem provedor de IA.
- **Concorrência.** Não se aplica: é ferramenta local de conferência, sem operação que possa rodar duas vezes ao mesmo tempo.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. A nº 2 da 1ª rodada (o lado vermelho do limite 3) continua fora, como a ordem decidiu, e não há fato novo que a reabra.
