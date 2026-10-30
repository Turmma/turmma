# Achados das revisões — `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-30 20:52:18 · `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mexe só em `tools/renomear/conferir.ts`, `tools/renomear/foto.ts`, `tools/renomear/conferir.test.ts` e no documento. Os testes de "vermelho quando" e de "verde quando" seguem os casos que `3d402a86` pôs no `casos.md`.

Aderência à Tech Spec: ok. A regra está na Tech Spec §5 de `spec/nomes-de-mercado` (`3d402a86`): o nome exportado segue a entrada só no pacote do `arquivo` dela e em quem o reexporta desse pacote, e a entrada sem `arquivo` vale em todo pacote. Essa linha (`HEAD` `a79fb973`) ainda não tem o commit; ele chega no próximo encontro. O código cobre também `import { X } from '<pacote>'` seguido de `export { X }`. Isso é reexportação, e é o que fez o `conferir` real ficar verde com os `config.ts`, então não conto como divergência. Mas a Tech Spec só dá `export { X } from` como exemplo (ver recomendação 1).

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo). Rodei também `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/4.json` sobre a árvore atual: verde, 209404 itens, nenhuma diferença.

Bloqueantes: nenhum

Recomendações:
1. `tools/renomear/conferir.ts:22-23` e `:141`: o comentário diz que o nome muda "em quem o reexporta (`export { X } from`)". O código também muda o `export { X }` de um nome importado (`foto.ts:97`). O comentário deveria citar as duas formas. A Tech Spec §5 também, para o caso não depender só do documento da correção.
2. `tools/renomear/conferir.ts:136`: o ramo `relativo` de `reexportaDoPacote` não tem teste que o prove. O único reexport relativo do teste (`packages/shared/src/r3.ts`) fica no próprio pacote da entrada, então passa pela cláusula (b). Mudar a linha para `return false` deixaria todos os testes verdes. Falta um caso de outro pacote, ou de `tools/`, que reexporte por caminho relativo que entra em `packages/shared/`.
3. `tools/renomear/conferir.ts:144`: o parâmetro `arquivoAntes` repete `item.arquivo`, que é o único valor passado a ele (`:161`). Dá para tirar o parâmetro.
4. `tools/renomear/conferir.ts:125`: o `catch` vazio também esconde `package.json` com JSON inválido e erro do próprio `git`, não só a pasta sem `package.json`. Seria melhor engolir só o caso "não existe no HEAD".
5. No documento da correção, a seção "Teste que reproduz" cita o título "quem reexporta do pacote da entrada passa ao nome novo, e a entrada sem arquivo vale em todo pacote". No arquivo são dois testes: "…e quem reexporta o homônimo fica" e "a entrada sem arquivo vale em todo pacote". A seção deveria usar os títulos que estão no arquivo.
6. Limite que sobra, e que a Tech Spec aceita porque compara por pacote: dois exportados com o mesmo nome dentro do pacote da entrada, ou um nome que um arquivo do pacote da entrada importa de outro pacote e repassa, são trocados na foto de antes e o `aplicar` não os troca. Isso dá vermelho falso, nunca verde falso. Vale registrar em `casos.md` se aparecer numa onda.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/foto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 20:53:23 · `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: o homônimo exportado por outro pacote fica com o nome antigo, e o `conferir` sai verde.
- Lado vermelho: o homônimo de outro pacote renomeado por engano aparece como diferença.
- Reexportação `export { X } from` pelo nome do pacote da entrada passa ao nome novo, e a do homônimo fica com o antigo.
- Reexportação pelo `export { X }` de um nome importado: o import do pacote da entrada passa ao nome novo, o do homônimo fica.
- Reexportação por caminho relativo vinda de outro pacote, que entra na pasta da entrada (cláusula (c), "caminho relativo").
- Reexportação com subcaminho (`@educa/shared/x`), que usa o `nomeDoPacoteDe`.
- Entrada sem `arquivo` vale em todo pacote.
- Pasta da entrada sem `package.json` no `HEAD` (`tools/`, ou pacote que nasce na onda).
- O mapa real `4.json` fica verde.
- Permissão, isolamento entre escolas e concorrência não se aplicam: é ferramenta local de linha de comando, sem dado de escola e sem nada que rode duas vezes ao mesmo tempo.

**Cobertos:**
- `conferir.test.ts:131` "o homônimo exportado por outro pacote sai com o nome novo da entrada" (o lado vermelho).
- `:322` "o homônimo exportado por outro pacote fica com o nome antigo".
- `:328` "quem reexporta do pacote da entrada passa ao nome novo, e quem reexporta o homônimo fica".
- `:336` "o export { X } do que o arquivo importou do pacote da entrada também passa ao nome novo, e o do homônimo fica".
- `:343` "a entrada sem arquivo vale em todo pacote".
- As asserções olham o resultado (`divergencias` vazio, ou a lista exata das diferenças). Não há `.skip`, mock nem IA.
- Rodei `npx vitest run tools/renomear/conferir.test.ts`: 53 de 53 passam.
- Rodei `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/4.json`: verde, com 209404 itens na foto de antes. A afirmação do documento se confirma.
- Os blocos 1 a 4 alcançam as cláusulas que citam. O nome de caso parcial nos blocos 2 e 3 funciona porque o portão filtra com `-t`.

**Bloqueantes:**
1. **`tools/renomear/conferir.ts:136`: nenhum teste chega ao ramo relativo** (`if (tipo === 'relativo') return alvo.startsWith(`${pasta}/`)`).
   - A única reexportação relativa dos testes é `packages/shared/src/r3.ts` (`conferir.test.ts:329`). Ela está no mesmo pacote da entrada, então a primeira metade da linha 149 (`pacoteDoArquivo(arquivoAntes) === pasta`) já devolve `true` e a linha 136 nunca roda.
   - Trocar a linha 136 por `return false` deixaria a suíte verde.
   - Correção exigida: um caso com reexportação relativa vinda de fora do pacote. Por exemplo, `tools/r.ts` com `export { Banco } from '../packages/shared/src/db.ts'` passa a `Database`, e `export { Banco } from '../packages/outro/src/o.ts'` fica com `Banco`. Mais um bloco `mutacao` sobre a linha 136 citando esse caso.
2. **`tools/renomear/conferir.ts:147`: cláusula nova sem bloco** (`if (candidata.arquivo === undefined) return true`).
   - O caso "a entrada sem arquivo vale em todo pacote" existe, mas nenhum bloco do documento o liga a essa linha. Pela regra, cláusula nova sem bloco bloqueia por si.
   - Correção exigida: um bloco com `return false` no lugar da linha, citando `› a entrada sem arquivo vale em todo pacote`.
3. **`tools/renomear/conferir.ts:113`: o subcaminho do `nomeDoPacoteDe` não tem teste.** É a parte `.split('/').slice(0, @ ? 2 : 1)`.
   - Nenhum caso reexporta de `@educa/shared/<sub>`. Trocar o corpo por `=> especificador` deixaria a suíte verde. O repositório usa subcaminho (`@educa/shared/armazem-s3`, citado na `:352`).
   - Correção exigida: um caso `export { Banco } from '@educa/shared/db'` fora do pacote que passa a `Database`, e um bloco que tira o `slice`.
4. **O documento `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md` não confere com o que existe.**
   - Linha 23, "Teste que reproduz": cita `quem reexporta do pacote da entrada passa ao nome novo, e a entrada sem arquivo vale em todo pacote`, e esse nome não existe. São dois casos separados, com outros nomes. O caso do `export { X }` de import nem é citado.
   - Linha 31: "Quatro cláusulas novas, uma por teste" não é verdade, porque as linhas 136, 147 e 113 também são cláusulas novas.
   - Linha 61: o parágrafo do `--faltando` diz que só sobra o `foto.ts`. Rodei o `--faltando` e ele lista também `conferir.ts:113`, `:119`, `:121`, `:124`, `:134`, `:136` e `:147`.
   - Correção exigida: citar os quatro casos verdes e o vermelho pelos nomes reais, acertar a contagem de cláusulas e reescrever o parágrafo do `--faltando` com o que sobra de fato, justificando cada linha que fica sem bloco.

**Recomendações:**
- Um caso para a entrada cujo pacote não tem `package.json` no `HEAD` (o `catch` da `conferir.ts:125`). Com isso só a pasta vale, e uma reexportação pelo nome do pacote não deve passar ao nome novo.
- Um caso de `export * as Banco from '@educa/shared'` (`foto.ts:94`) e um de `export { Banco as Outro } from '@educa/shared'`. Esse último mostra que o nome comparado é o exportado, e não o `propertyName`.
- A reexportação em cadeia (`apps/web` reexporta de `apps/api`, que reexporta do core) fica vermelha a mais, nunca verde a mais. Vale registrar no comentário do topo que é limite conhecido.
- `tools/` conta como um pacote só (`pacoteDoArquivo`). Uma entrada com `arquivo` em `tools/processo/` troca o homônimo de qualquer outro arquivo de `tools/`, o que também erra para o vermelho. Vale um caso ou uma linha no comentário.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 21:30:58 · `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
- **`export * as X` tratado como reexportação do símbolo.** O caso de teste está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts:356`, a metade do namespace. Ela grava como verde que `export * as Banco from '@educa/shared'` passe a se chamar `Database`. Só que esse `Banco` é um binding de namespace novo e não o símbolo `class Banco`. O `aplicar`, que renomeia por símbolo, não o tocaria. Com isso:
  - uma onda correta sai vermelha;
  - uma onda que renomeasse o namespace por engano sai verde.

  A regra vem do `foto.ts:94` e do comentário do topo do `conferir.ts:20`, que já estavam na rodada 1. A única coisa nova é o teste que a fixa. O caso é improvável. Vale constar como limite (5) no comentário do topo, ou tirar a `origem` desse ramo e inverter a expectativa do caso.
- **Título da mutação mais curto que o do caso.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md:50` e `:64`, os blocos citam o caso pelo começo do título (`quem reexporta do pacote da entrada passa ao nome novo`). O título inteiro termina em `, e quem reexporta o homônimo fica`. O portão aceitou, mas o título completo evita que um caso novo com o mesmo começo responda pela mutação.
- **Linhas do `--faltando` citadas por número.** A lista nas linhas 127 a 132 do mesmo documento cita `conferir.ts:127/129/132` e `foto.ts:77…110`. Esses números envelhecem na próxima edição. A casa já cita pela asserção em vez da linha (commit `25699b75`); vale fazer o mesmo aqui.

As três coisas pedidas para esta rodada estão feitas:
- o comentário das duas formas de reexportação, em `conferir.ts:19-23` e `:140`;
- o parâmetro `arquivoAntes` removido, em `conferir.ts:153` e `:170`;
- os quatro limites conhecidos no comentário do topo, em `conferir.ts:25-30`. Os quatro erram para o lado do vermelho, como o comentário afirma.

Os três casos novos, nas linhas 343, 356 e 364 do teste, batem com os nomes listados no documento. Os doze blocos de mutação citam linhas que existem no código atual. Os quatro arquivos são os mesmos da árvore `89258ae8` registrada em `.processo/ordens/rodadas.md`.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 21:31:50 · `tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: o nome exportado segue a entrada no pacote do `arquivo` dela.
- O homônimo exportado por outro pacote fica com o nome antigo. É o vermelho que reproduz o sintoma, e tem também o par verde.
- Quem reexporta do pacote da entrada passa ao nome novo, nas três formas: pelo nome do pacote, pelo caminho relativo e pelo subcaminho (`@educa/shared/db`).
- O `export { X }` de um nome importado do pacote da entrada passa ao nome novo.
- `export * as X from` e `export { X as Y } from`, onde o nome que vale é o exportado.
- A entrada cujo pacote não tem `package.json` no `HEAD` só vale na pasta.
- A entrada sem `arquivo` vale em todo pacote.
- Cada cláusula nova tem um bloco, ou uma justificativa escrita para ficar sem.

Permissão e isolamento não se aplicam: a correção é na ferramenta do rename, sem dado de escola.

Cobertos (em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts`; `npx vitest run` deu 56 de 56 verdes):
- Correção 1, feita. O caso `o caminho relativo e o subcaminho do pacote, vindos de fora dele, também seguem a entrada` (linha 343) tem uma reexportação relativa de fora do pacote, `apps/api/src/rel.ts`, que passa a `Database`, e o homônimo relativo, `apps/web/src/rel.ts`, que fica `Banco`. Com `return false` na `conferir.ts:144`, o grupo `apps/api` fica com `Banco` na foto de antes contra `Database` na árvore, e o teste fica vermelho. A mutação inversa também falharia, pelo `apps/web`.
- Correção 2, feita. O bloco com `return false` na `conferir.ts:156` cita `a entrada sem arquivo vale em todo pacote`.
- Correção 3, feita. O mesmo caso tem `tools/sub.ts` com `@educa/shared/db`. Sem o `slice` em `nomeDoPacoteDe` (`conferir.ts:121`), o grupo `tools` diverge.
- Correção 4, feita:
  - "Teste que reproduz" cita os oito casos pelos nomes reais, e todos existem (linhas 131 e 322 a 370).
  - A contagem confere: são doze blocos.
  - Rodei o `--faltando`, e ele lista para `tools/renomear/` exatamente as linhas que o documento justifica: `conferir.ts:127`, `:129` e `:132`, e `foto.ts:77`, `79`, `81`, `83`, `84`, `93`, `98`, `104`, `105`, `107`, `108`, `110` e `135`.
- Os blocos novos que chequei à mão ficam vermelhos pelo motivo certo:
  - `origem === undefined` passando a `true`: o `Banco` de `packages/outro` vira `Database`.
  - Tirar o `candidata.de !== item.valor`: todo exportado vira `Database`.
  - `categoria === 'caso'`: o `Banco` de `packages/shared` deixa de ser trocado.
  - `?? 'sem-entrada'`: todo exportado sem entrada muda de nome.
  - O namespace sem origem: o `Banco` de `apps/api/src/ns.ts` fica com o nome antigo.
- As recomendações da rodada 1 foram aplicadas: o caso sem `package.json` (linha 364), o `export * as` e o alias (linha 356), e os quatro limites conhecidos no comentário do topo do `conferir.ts`.
- Não há `.skip`, teste comentado nem mock: o repositório de teste é de verdade, e a correção não envolve IA.

Bloqueantes: nenhum.

Recomendações:
1. O bloco da `conferir.ts:156` fica vermelho por um TypeError (`pacoteDoArquivo(undefined)`, `.split` de `undefined`), e não pela divergência que a asserção espera. O portão aceita, porque o caso rodou e falhou, e foi o bloco que eu exigi na rodada 1. Mas ele prova que a linha é necessária, não que a regra "vale em todo pacote" vale. A asserção do caso cobre a regra (`packages/outro` também passa a `Database`), então não bloqueia.
2. A justificativa da `conferir.ts:127` diz que o caso `a entrada sem arquivo vale em todo pacote` atravessa a linha. Atravessa mesmo: tirar a segunda metade do `||` deixaria esse caso vermelho pelo mesmo TypeError. Então dava para escrever um bloco em vez de justificar a ausência dele.
3. A justificativa da `conferir.ts:132` diz que a linha está "provado em `a entrada num pacote sem package.json no HEAD…`". Esse caso passa pelo `catch` e não pelo `typeof nome === 'string'`. A linha é defesa sem teste, e o texto deveria dizer isso sem citar o caso como prova.
4. A justificativa das `foto.ts:81` e `84` tem o motivo torto. O nome local de um `import X from` ou `import * as X` é livre e pode coincidir com o `de` de uma entrada. Num `import Banco from '@educa/shared'; export { Banco }`, a foto de antes troca o nome e o `aplicar` não. O erro é para o lado do vermelho, como os outros limites, mas vale entrar como (5) no comentário do topo, em vez do argumento sobre `default`.
5. A justificativa das `foto.ts:93`, `98` e `135` diz que elas estão "provadas pelas mutações…", mas essas mutações estão nas linhas 94 e 97. As três linhas estão cobertas pelos casos (sem a `origem`, os casos de reexportação ficariam vermelhos), e não por bloco. Vale escrever assim.

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/foto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-conferir-homonimo-de-outro-pacote.md`
