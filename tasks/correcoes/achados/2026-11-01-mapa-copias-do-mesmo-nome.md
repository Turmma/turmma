# Achados das revisões — `tasks/correcoes/2026-11-01-mapa-copias-do-mesmo-nome.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-01 09:56:53 · `tasks/correcoes/2026-11-01-mapa-copias-do-mesmo-nome.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

**Escopo.** A correção mexe só no `seRepetem`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapa.ts:203-207`, e nos testes de `tools/renomear/`. Não muda o passo 5 (`texto.ts`), o `conferir.ts` nem o `aplicar`, e nada da 11.0 entrou.

**Aderência à Tech Spec.** A regra nova é a mesma da Tech Spec §5, linhas 48-55 (triagem `96bb76a4`):
- Duas entradas de símbolo, cada uma com `arquivo`, no mesmo pacote e com o mesmo `para` passam a ser aceitas.
- Continuam recusadas: `para` diferente no mesmo pacote, entrada sem `arquivo` e tipos diferentes.
- O passo 5 continua contando esse `de` como de mais de uma entrada, e vai à troca à mão. O teste novo de `aplicar.test.ts` prova isso.

O `paraONomeExportado` (`conferir.ts:155`) devolve o `para` da primeira entrada do pacote que encontra. Como as cópias têm o mesmo `para`, o resultado não depende da ordem das entradas, e a justificativa do documento se sustenta.

**Portão local.** O `conferir` respondeu: "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Recomendações:
1. **Mesmo `arquivo` duas vezes.** O documento chama de "acréscimo desta correção à regra da Tech Spec" a recusa de duas entradas com o mesmo `arquivo`. Na verdade, esse caso já era recusado no HEAD e segue a regra "uma por declaração" da Tech Spec, então não é divergência. Mas o texto da §5, lido ao pé da letra ("mesmo pacote e mesmo `para` não se repetem"), também cobriria esse caso. Vale uma oração na §5 dizendo que o mesmo `arquivo` duas vezes segue recusado, para o texto não contradizer o código.
2. **Nomes dos testes.** Os nomes citados em "Teste que reproduz" não batem com os do código:
   - `aplicar.test.ts`: o documento diz "as cópias do mesmo nome com o mesmo para: cada declaração e os usos saem renomeados…"; o teste se chama "cada declaração sai com o para, e os usos dela; o homônimo de outro pacote fica", dentro de um `describe` próprio.
   - `conferir.test.ts`: o documento diz "duas entradas do mesmo nome…"; o teste diz "duas cópias do mesmo nome…".
   
   As mutações citam só `mapa.test.ts`, cujos nomes batem, então o portão não é afetado. Mesmo assim, convém alinhar os nomes para a rastreabilidade.
3. **Cobertura das cópias no `aplicar`.** O teste de `aplicar.test.ts` usa `apps/api` como pacote das cópias, e o caso real é `e2e/`, onde o pacote é a primeira pasta. O `mapa.test.ts` cobre `e2e/`, mas um caso no `aplicar` com arquivos em `e2e/support/` deixaria a prova mais perto do mapa da 11.0.

## test-engineer · 1ª rodada · APROVADO · 2026-11-01 09:57:04 · `tasks/correcoes/2026-11-01-mapa-copias-do-mesmo-nome.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: duas ou três cópias do mesmo `de` no mesmo pacote, cada uma com o seu `arquivo` e com o mesmo `para`. O `validarMapa` não recusa, o `aplicar` renomeia cada declaração e os usos dela, e o `conferir` sai limpo.
- Casos de borda que guardam a regra que fica:
  - o mesmo `para` em pacotes diferentes;
  - `para` diferente no mesmo pacote (recusado);
  - uma das entradas sem `arquivo`, nas duas ordens (recusado);
  - o mesmo `arquivo` declarado duas vezes (recusado);
  - tipos diferentes com o mesmo `de` (recusado).
- Efeito colateral:
  - o homônimo de outro pacote, sem entrada, fica com o nome antigo;
  - o passo 5 não troca o nome entre crases no comentário e manda a linha para a troca à mão.
- Permissão, isolamento entre escolas e concorrência não se aplicam. É ferramenta de `tools/`, sem dado de escola e sem operação concorrente.

Cobertos:
- `tools/renomear/mapa.test.ts` tem os seis casos acima, cada um com asserção sobre o código de recusa devolvido.
- `tools/renomear/aplicar.test.ts:554-581`: o grupo "as cópias do mesmo nome com o mesmo para" confere o conteúdo final de cada arquivo (as declarações, os usos e o homônimo de `apps/web` intacto). Confere também a linha exata do relatório da troca à mão.
- `tools/renomear/conferir.test.ts:330-336`: duas cópias de `Banco` → `Database` em `packages/shared` dão `divergencias` vazia.
- O vermelho antes da correção procede. Com o `seRepetem` do HEAD, o `aplicar` e o `conferir` chamam `validarMapa` (`aplicar.ts:119`, `conferir.ts:234-235`) e caem em `de-repetido` / `mapa inválido`.
- Mutações contra o diff: cada cláusula nova tem um bloco que chega a ela.
  - O bloco 1 volta a regra antiga e o caso das cópias fica vermelho.
  - O bloco 2 tira `a.para !== b.para` e o caso do `para` diferente fica vermelho.
  - O bloco 3 tira `a.arquivo === b.arquivo` e o caso do mesmo arquivo fica vermelho.
  - A linha `pacoteDoArquivo(...) !== ... return false` é a regra anterior reescrita. Ela continua guardada pelos casos de homônimos com `para` diferente em pacotes diferentes, já existentes em `aplicar.test.ts`.
- Rodei `npx vitest run` nos três arquivos: 116 casos verdes. Não há `.skip`, teste comentado nem mock da regra, e nenhum teste usa IA.

Bloqueantes: nenhum.

Recomendações:
1. Três nomes citados no documento (`tasks/correcoes/2026-11-01-mapa-copias-do-mesmo-nome.md:34-37`) não batem com o nome real do teste. Quem procurar pelo texto do documento não acha o caso:
   - linha 34: o documento diz "cada declaração e os usos saem renomeados, e o homônimo de outro pacote fica"; o teste em `aplicar.test.ts:565` se chama "cada declaração sai com o para, e os usos dela; o homônimo de outro pacote fica";
   - linha 35: o documento diz "não é trocado e vai à troca à mão"; o teste em `aplicar.test.ts:574` diz "não é trocado, e vai à troca à mão", com vírgula;
   - linha 37: o documento diz "duas entradas do mesmo nome no mesmo pacote com o mesmo para"; o teste em `conferir.test.ts:330` diz "duas cópias do mesmo nome no mesmo pacote, com o mesmo para".

   Vale alinhar o documento aos nomes reais. Os nomes dos blocos de mutação batem exatamente.
2. O caso `tipos diferentes com o mesmo de: segue recusado` (`mapa.test.ts:40`) existe, mas não aparece na lista "Teste que reproduz". Só a linha 41 do documento o menciona. Vale acrescentá-lo à lista.
3. Cobertura extra opcional: um caso em `conferir.test.ts` com uma reexportação (`export { X } from`) dentro do mesmo pacote das duas cópias. Esse é o ramo `item.origem !== undefined` de `paraONomeExportado` (`conferir.ts:161`), em que a primeira entrada achada decide. O mesmo `para` torna a escolha indiferente, e hoje nenhum teste fixa isso.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-01 10:03:07 · `tasks/correcoes/2026-11-01-mapa-copias-do-mesmo-nome.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum
Recomendações:
- A recomendação 1 da 1ª rodada continua aberta: falta uma oração na §5 da Tech Spec sobre as cópias do mesmo nome com o mesmo `para`. Ela não bloqueia, porque a decisão já está registrada na triagem (`96bb76a4`). Mas o Orquestrador precisa levá-la ao Arquiteto antes do pouso, para que a Tech Spec não fique só no documento da correção.

Nesta rodada li só o diff desde a minha aprovação, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/mapa-copias-diff-r2.patch`, e o que ele afeta. As recomendações da 1ª rodada foram aplicadas:
- **As cópias em `e2e/support/`:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.test.ts`, entre as linhas 554 e 586, o grupo passou a usar `e2e/support/assistente.ts`, `e2e/support/professor/sino.ts` e `e2e/local.spec.ts`. O `e2e/tsconfig.json` está lá sem `package.json`. Isso bate com `pacoteDoArquivo`, que toma a primeira pasta fora de `apps/` e `packages/` (`mapa.ts:192-195`). As três declarações e o uso em `e2e/aluno.spec.ts` têm asserção exata, e o homônimo em `apps/web/src/portao.ts` também. O relatório do passo 5 continua preso a uma linha só.
- **O caso novo de reexportação:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts`, a partir da linha 338, `r1` e `r2` reexportam cada uma das duas cópias, todas dentro de `packages/shared`. O caso cobre o ramo `item.origem !== undefined` de `paraONomeExportado` e usa a mesma `ENTRADA` do `describe`.
- **O documento da correção:** os nomes de teste batem com os `describe` e os `it` reais. O caso "tipos diferentes" entrou na lista, a contagem passou para 220, e o documento diz que a reexportação não tem mutação própria. A seção "Revisões" foi escrita pelo hook.

`mapa.ts` não mudou nesta rodada; o patch não o toca.

## test-engineer · 2ª rodada · APROVADO · 2026-11-01 10:03:13 · `tasks/correcoes/2026-11-01-mapa-copias-do-mesmo-nome.md`

VEREDITO: APROVADO

Cenários exigidos (os mesmos da 1ª rodada, mais as três recomendações que ela deixou):
- Caminho feliz: duas cópias do mesmo nome, com arquivo no mesmo pacote e o mesmo `para`, não se repetem no `validarMapa`.
- Bordas: o mesmo `para` em pacotes diferentes; `para` diferente no mesmo pacote; uma entrada sem arquivo, nas duas ordens; o mesmo arquivo declarado duas vezes; tipos diferentes com o mesmo `de`.
- Ponta a ponta no `aplicar`: cada declaração sai com o `para`, junto com os usos; o homônimo de outro pacote fica; o comentário com o nome entre crases vai para a lista de troca à mão.
- No `conferir`: as duas cópias renomeadas saem limpas, e a reexportação de cada cópia, no mesmo pacote, também sai limpa.
- Isolamento entre escolas e permissão não se aplicam: é ferramenta de `tools/` e não toca dado de escola.

Cobertos:
- O documento lista seis casos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapa.test.ts` (linhas 17 a 40), e cada um tem o seu `it` com o mesmo nome. O caso "tipos diferentes" agora está na lista.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/aplicar.test.ts` (linhas 554 a 586), as cópias passaram para `e2e/support/`, com `e2e/tsconfig.json` e sem `package.json`, como no monorepo. Entrou uma terceira cópia numa subpasta (`e2e/support/professor/sino.ts`). As asserções comparam o texto inteiro de cada arquivo depois da troca, conferem que o homônimo de `apps/web` ficou igual e que a lista de troca à mão tem exatamente uma linha. Elas testam o resultado, e não só que o código rodou.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts` (linhas 338 a 350), o caso novo da reexportação passa pelo ramo `item.origem !== undefined` e exige que não haja nenhuma divergência.
- Os nomes no documento batem com os nomes nos testes, linha por linha.
- Rodei os três arquivos: 117 de 117 passaram.
- `mapa.ts` não mudou desde a rodada aprovada, e os três blocos de mutação continuam no documento (linhas 58, 67 e 75).
- Não há `.skip`, teste comentado nem mock da regra. Não há IA nem concorrência em jogo.

Bloqueantes: nenhum.

Recomendações:
- O caso novo da reexportação não tem mutação própria, e o documento já diz isso. Ele protege `conferir.ts`, que esta correção não alterou, então não bloqueia. Se `paraONomeExportado` mudar um dia, vale um bloco de mutação nesse ramo.
