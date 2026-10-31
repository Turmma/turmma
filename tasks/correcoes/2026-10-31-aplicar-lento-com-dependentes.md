# Correção — o move do `aplicar` custa ~105 s por entrada nos 10 projetos, e o mapa 5 projeta 3h33

**Origem:** tarefa 5.0 (X8 `nomes-de-mercado`), medição em `divergencia-5.md` (PEDIDO do Orquestrador).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: nenhum além de test-engineer e revisor-geral. `tools/renomear/` não é `tools/processo/`, mas a correção foi pedida com os dois. -->

## Sintoma

`node tools/renomear/aplicar.ts` com o mapa 5 (110 arquivos, 12 pastas, 2 pacotes) não termina: cada `moverEntrada` leva ~105 s
nos 10 projetos (89,5 s o primeiro, 103,9 s, 106,4 s, 104,9 s para uma pasta de 1 arquivo, 107,9 s para uma pasta de 3), igual
para arquivo e para pasta. Projeção: 122 moves × 105 s ≈ 3h33. O processo foi parado em 2h50 de CPU, e como o `aplicar` só grava no
fim, uma nova corrida custaria as 3h35 inteiras.

## Fora desta correção

`?? tools/renomear/mapas/5.json` (o mapa da 5.0, ainda não commitado). Fica na árvore, fora da revisão e do commit.

## Causa

Falha de desenho do passo 3 (`movimentos.ts`), que a correção `aplicar-lento-no-move` só aliviou. Aquela tirou o `path.relative`
repetido; o que sobrou é o custo do próprio `getEditsForFileRename`: ele precisa do programa de cada projeto, e o programa tem de
ser refeito depois de cada move, porque o move reescreve na árvore os importadores (a versão deles muda) e o serviço de linguagem
reanalisa e resolve de novo os módulos. Os 10 projetos importam `packages/nucleo`, então o programa de cada um carrega os milhares
de arquivos dele. O custo é (projetos) × (arquivos do programa que dependem do que se move), e não o tamanho do que se move:
por isso é igual para um arquivo e para uma pasta de três (≈ 10,5 s por projeto, contra 6,8 s na 3.0, quando o `nucleo` ainda
não tinha acumulado os moves).

Para as edições de import o programa era dispensável: a conta de caminho (`reescreverRelativos`, a mesma do `reaplicar`) já
existia e já fazia o `vi.mock` e o que o serviço não alcança. O único efeito do serviço sem equivalente de conta é o do
`tsconfig` (`files`, `include`, `exclude`, `paths`, e o `include` que ganha a entrada nova quando só a antiga casava): sai da
configuração, e não do programa.

**O que a conta de caminho não faz e o serviço fazia** (fica de fora, escrito aqui para o próximo mapa não descobrir na árvore):

- **Import de pasta pelo `index`.** `from './x'` onde `x/index.ts` é o arquivo que se move sozinho: o serviço resolvia o módulo e
  acompanhava; a conta de caminho só enxerga `./x` como o caminho da pasta. Mover a **pasta** inteira funciona (`destinoDoCaminho`
  trata `alvo === movimento.de`). Mover só o `index.*` deixaria os imports apontando para o lugar antigo, sem recusa. O repositório
  tem 33 imports assim em `apps/web` (`moduleResolution: bundler`), e **nenhum mapa faz esse move hoje** (o 5 não tem `index`).
- **`/// <reference path="…" />`.** O serviço o acompanhava; a conta de caminho só lê especificadores de módulo. O repositório usa
  extensão explícita e nenhum `reference path`.

Os dois ficam no `TODO.md` (seção desta correção): decidir com o Arquiteto entre o `aplicar` recusar o move de `index.*` isolado e
registrar o limite na §5 da Tech Spec. A conta tem a vantagem inversa: acompanha o especificador relativo de arquivo que nenhum
`tsconfig` alcança (`tools/`, fixtures), que o serviço deixava para trás.

## Teste que reproduz

`tools/renomear/projetos.test.ts` › `o move não paga o programa dos projetos (passo 3)`, dois casos (arquivo e pasta): o
`getEditsForFileRename` do serviço dos arquivos de código não é chamado, e os imports (`.ts`, `.js`), o `vi.mock`, o re-export, os
imports do arquivo que se move e o `include` do `tsconfig` acompanham.

Os dois casos também afirmam que o programa do `servicoDaConfiguracao` de cada projeto não tem arquivo de código
(`getRootFileNames()` vazio): é isso, e não o espião, que prova que o custo não cresce com os dependentes. Mais três casos do que o
serviço de configuração acompanha com esse programa vazio: `files`, `exclude` e o `include` por padrão (a pasta; o arquivo que sai
dela ganha a entrada nova, e o que fica dentro não muda).

Vermelho antes (com `movimentos.ts` e `projetos.ts` do HEAD): os dois falham com `expected "getEditsForFileRename2" to not be called
at all, but actually been called 1 times`. Verde depois (9/9 do arquivo, com os três casos de `tsconfig`).

## Correção

- `projetos.ts`: cada `Projeto` ganha `servicoDaConfiguracao`, o mesmo `tsconfig` e o mesmo host, com a lista de arquivos de código
  vazia. O programa dele é só a biblioteca (analisada uma vez, no registro de documentos), e o `getEditsForFileRename` dele devolve
  as edições do `tsconfig` com a semântica do serviço, sem reescrever essa regra.
- `movimentos.ts`: `moverEntrada` pega do serviço só as edições dos `tsconfig` (um por projeto, cada edição uma vez) e deixa os
  especificadores para `reescreverRelativos(arvore, movimento, false)`, que roda para todo import, `export from`, `require`,
  `import()` e `vi.mock`, e conserva a extensão (`.js`/`.ts`), de modo que a `conservarExtensao` não tem mais o que fazer e saiu.

### Medição (nada gravado na árvore real)

Os 122 moves do mapa 5 em memória, na árvore real da 5.0, 10 projetos abertos: **10,3 s** (antes, ~3h33 projetados). O `aplicar`
inteiro com o mapa 5 (`node tools/renomear/aplicar.ts --mapa … --escopo …`), num clone local fora da árvore real: **14 s** de relógio
até o fim do cálculo. Ele recusa, como tem de recusar um mapa de `ocorrencias: []`, com 646 `ocorrencia-sem-classificacao` e nenhuma
outra recusa (nem `colisao`, nem `fora-do-escopo`): classificar as ocorrências é trabalho da 5.0, que a lentidão impedia de começar.

### Equivalência com o move de hoje

Amostra de 12 entradas do mapa 5 (as 6 do `erro/`, `log/aviso-espacado.ts`, `redis/clientes.ts`, `relogio.ts`, as pastas `erro` e
`fila` e `packages/nucleo`), movidas em memória pelo código antigo e pelo novo, a partir da mesma árvore: comparação do hash do
texto de cada arquivo. Resultado na seção abaixo.

## Resultado das medições

- 12 entradas, código antigo: 1180,9 s (89 a 122 s por entrada). Código novo: 2,6 s.
- Hash do texto dos 3.808 arquivos da árvore depois dos 12 moves: **idêntico** nos dois, arquivo a arquivo e no conjunto de caminhos.
  Os únicos dois que diferem são `tools/renomear/movimentos.ts` e `projetos.ts`, que o código novo editou entre as duas leituras da árvore.
- Os 154 casos de `aplicar`, `reaplicar`, `referencias`, `conferir` e `projetos` (antes dos três novos) passam, com o `tsconfig`, o `vi.mock` e o `.js` cobertos por eles.

## Divergências resolvidas

- **Desenho do passo 3 (Tech Spec §1 e §5).** A spec dizia que o move era do `getEditsForFileRename` por projeto; passou a ser conta de
  caminho para o especificador relativo, com o serviço só para o `tsconfig`. Detalhe que a spec não previu, triado pelo Arquiteto a partir
  da `DIVERGÊNCIA` da Mesa (revisor-geral, 1ª rodada). A `techspec.md` §1 (linha 8) e §5 passo 3 (linhas 51 a 58) já dizem isso, e
  também o limite do import de pasta pelo `index`: acompanha o move da pasta, não o do `index.ts` sozinho; o mapa move a pasta e o
  typecheck do portão pega o que escapar. A `techspec.md` vai neste commit.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) e revisor-geral (1ª) | Remover o parâmetro `soMock` de `reescreverRelativos` (`tools/renomear/especificadores.ts`), o ramo dele e a frase do docblock; corrigir os comentários das linhas 8 e 9 | `especificadores.ts` não é arquivo desta correção, e tirar o parâmetro refaz a mutação 1 ("a mutação 1 teria de ser refeita", test-engineer). Destino: `TODO.md`, correção própria depois da 5.0 |
| revisor-geral (1ª) | O `aplicar` recusar o move de `index.*` isolado | Muda comportamento e contrato do `aplicar`; o revisor oferece como alternativa a registrar o limite na §5 da Tech Spec. Destino: o Arquiteto decide junto com a `DIVERGÊNCIA` da Tech Spec; nenhum mapa faz esse move hoje. Está também no `TODO.md` |
| test-engineer (2ª) | No caso da pasta (`projetos.test.ts`), repetir `expect(projetos.length).toBeGreaterThan(0)` como no caso do arquivo | O caso usa o mesmo repositório de teste do caso do arquivo, que já tem a asserção; o risco é só de lista vazia futura. Destino: `TODO.md` ou a próxima correção que tocar `projetos.test.ts` |
| test-engineer (2ª), revisor-geral (2ª) | Separar o caso do `include` por padrão (dois moves num `it`) em dois `it` | Só legibilidade do vermelho; os dois moves provam a mesma cláusula. Destino: a próxima correção que tocar `projetos.test.ts` |
| revisor-geral (2ª) | Atualizar o texto do move de `index.*` isolado em três lugares (item do `TODO.md`, parágrafo "Os dois ficam no `TODO.md`" da seção "Causa", 2ª linha desta tabela): o limite já foi registrado na §5 pelo Arquiteto, e só a recusa fica como trabalho futuro | Texto, sem comportamento. Destino: ajuste de texto na retomada da recusa de `index.*` (item do `TODO.md`); não reabre rodada |

## Mutações

`movimentos.ts:28` (`if (arquivo === undefined) continue`) fica sem bloco: é a guarda de tipo de `paraRelativo`, que só devolve
`undefined` para arquivo fora da raiz, e o serviço de configuração só devolve `tsconfig` de dentro dela. Nenhum caso a alcança, e
a linha já existia com o mesmo papel no `edicoesDoServico` anterior.

```mutacao
arquivo: tools/renomear/projetos.ts
teste: tools/renomear/projetos.test.ts › arquivo: os imports, o `.js`, o `vi.mock` e o `include` do tsconfig acompanham, sem pedir edição ao serviço dos arquivos de código
-    servicoDaConfiguracao: ts.createLanguageService(criarHost(arvore, config, lido.options, []), REGISTRO),
+    servicoDaConfiguracao: ts.createLanguageService(criarHost(arvore, config, lido.options, lido.fileNames), REGISTRO),
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/projetos.test.ts › arquivo: os imports, o `.js`, o `vi.mock` e o `include` do tsconfig acompanham, sem pedir edição ao serviço dos arquivos de código
-  reescreverRelativos(arvore, movimento, false)
+  reescreverRelativos(arvore, movimento, true)
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/projetos.test.ts › arquivo: os imports, o `.js`, o `vi.mock` e o `include` do tsconfig acompanham, sem pedir edição ao serviço dos arquivos de código
-    for (const mudanca of projeto.servicoDaConfiguracao.getEditsForFileRename(paraAbsoluto(arvore, de), paraAbsoluto(arvore, para), formatacao, {})) {
+    for (const mudanca of projeto.servico.getEditsForFileRename(paraAbsoluto(arvore, de), paraAbsoluto(arvore, para), formatacao, {})) {
```

```mutacao
arquivo: tools/renomear/movimentos.ts
teste: tools/renomear/projetos.test.ts › pasta: quem importa de dentro dela e o include do tsconfig acompanham, e o que está dentro continua apontando para si
-        if (!doArquivo.has(chave)) doArquivo.set(chave, { inicio: troca.span.start, comprimento: troca.span.length, novo: troca.newText })
+        if (false) doArquivo.set(chave, { inicio: troca.span.start, comprimento: troca.span.length, novo: troca.newText })
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 23:25:29 | 2026-10-30 23:27:09 | `test-engineer` | 1 | REPROVADO | a86e1124c08d794af |
| 2026-10-30 23:25:30 | 2026-10-30 23:27:36 | `revisor-geral` | 1 | REPROVADO | a8588a452991bc386 |
| 2026-10-30 23:33:44 | 2026-10-30 23:34:20 | `test-engineer` | 2 | APROVADO | a62fa14fb665bb385 |
| 2026-10-30 23:33:49 | 2026-10-30 23:34:28 | `revisor-geral` | 2 | APROVADO | a808c994fa568cb80 |
