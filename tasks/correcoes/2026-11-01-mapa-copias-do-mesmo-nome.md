# Correção — o `validarMapa` recusa `de-repetido` duas entradas de símbolo no mesmo pacote mesmo com o mesmo `para`

**Origem:** divergência da 11.0 (`Motivo: desenho`), triagem do Arquiteto em `96bb76a4` (Tech Spec §5, parágrafo do `de` repetido).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. O `revisor-geral` entra porque a correção mexe em `tools/` e a Tech Spec o pede; não toca `apps/`, `packages/`, `infra/` nem `e2e/`. -->

## Sintoma

O `portao` do e2e tem 3 declarações exportadas em `e2e/support/` (`assistente.ts`, `pedidos-do-titular.ts`, `professor/sino.ts`) e uma cópia local em
cerca de 20 specs, todas → `gate` (`inventario-web-e2e.md:384`). A entrada sem `arquivo` renomearia também o `portao` de
`tools/processo/portao.ts`; com `arquivo`, uma entrada por declaração é o certo, mas `validarMapa` (`tools/renomear/mapa.ts`, `seRepetem`)
recusa `de-repetido` duas entradas de símbolo com `arquivo` no mesmo pacote (`e2e`), mesmo com o mesmo `para`. O mapa da 11.0 não passa.

## Fora desta correção

Nada: o pedido veio com "Arquivos da tarefa em curso: nenhum".

## Causa

`seRepetem` só deixava passar duas entradas de símbolo com `arquivo` em pacotes diferentes, porque foi escrita para os homônimos com destinos
diferentes (8.0). No mesmo pacote, o `conferir` não separa o nome reexportado, e a regra recusava sempre. Com o **mesmo `para`**, não há o que
separar: o `aplicar` acha cada declaração pelo `arquivo` dela, e `paraONomeExportado` (`conferir.ts`) acha uma entrada pelo `arquivo` e devolve o mesmo
`para` por qualquer uma.

## Teste que reproduz

- `tools/renomear/mapa.test.ts` (novo, unidade), `describe('validarMapa: o de repetido')`:
  - `duas cópias do mesmo nome, com arquivo no mesmo pacote e o mesmo para, não se repetem` (vermelho antes: devolve `de-repetido`);
  - `o mesmo para em pacotes diferentes segue sem se repetir`;
  - `para diferente no mesmo pacote: segue recusado`;
  - `uma das entradas sem arquivo: segue recusado, nas duas ordens`;
  - `o mesmo arquivo declarado duas vezes: segue recusado` (a linha duplicada, não uma cópia);
  - `tipos diferentes com o mesmo de: segue recusado`.
- `tools/renomear/aplicar.test.ts`, `describe('as cópias do mesmo nome com o mesmo para (o portao do e2e, Tech Spec §5)')`, com as cópias em
  `e2e/support/` (o pacote do `e2e` é a primeira pasta, e o `mundo()` ganha só o `e2e/tsconfig.json`, como no monorepo):
  - `cada declaração sai com o para, e os usos dela; o homônimo de outro pacote fica`;
  - `o passo 5: o comentário com o nome entre crases não é trocado, e vai à troca à mão`.
- `tools/renomear/conferir.test.ts`, `describe('o nome exportado segue a entrada só no pacote do arquivo dela e em quem reexporta dele')`:
  - `duas cópias do mesmo nome no mesmo pacote, com o mesmo para: os dois exportados renomeados saem limpos`;
  - `duas cópias do mesmo nome com o mesmo para: a reexportação de cada uma, no mesmo pacote, sai limpa` (o ramo `item.origem !== undefined` de
    `paraONomeExportado`: com o mesmo `para`, a entrada que decide é indiferente).

Vermelho antes, com o `mapa.ts` do HEAD: o caso de `mapa.test.ts` das cópias devolve `['de-repetido']` onde se espera `[]`; o das cópias em
`aplicar.test.ts` (o passo 5) e o de `conferir.test.ts` caem em `mapa inválido` / `de-repetido` pela mesma recusa. Verde depois: `tools/renomear/` inteira (220 casos). A reexportação no mesmo pacote (a ordem da rodada 1) só fixa o que a Causa afirma, e não
tem mutação própria: não acrescenta cláusula ao código.
Os demais casos de `mapa.test.ts` (outro pacote, `para` diferente, sem `arquivo`, mesmo `arquivo`, tipos diferentes) já eram verdes antes e guardam a
regra que fica; `para diferente` e `mesmo arquivo` têm, cada um, a sua mutação abaixo.

## Correção

`seRepetem` (`tools/renomear/mapa.ts`): duas entradas de símbolo, cada uma com `arquivo`, no mesmo pacote, com **arquivos diferentes** e o **mesmo `para`**
não se repetem. Tudo o mais continua como estava (entrada sem `arquivo`, tipos diferentes, `para` diferente no mesmo pacote). O mesmo `arquivo` duas vezes
segue recusado: é a mesma declaração em duas linhas, e não uma cópia (acréscimo desta correção à regra da Tech Spec, que diz "uma por declaração").
O passo 5 (`texto.ts`) já conta o `de` com mais de uma entrada como repetido, mesmo com um `para` só: não muda, e o teste só o prova.

## Mutações

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/mapa.test.ts › duas cópias do mesmo nome, com arquivo no mesmo pacote e o mesmo para, não se repetem
  if (a.tipo !== 'simbolo' || b.tipo !== 'simbolo' || a.arquivo === undefined || b.arquivo === undefined) return true
-  if (pacoteDoArquivo(a.arquivo) !== pacoteDoArquivo(b.arquivo)) return false
-  return a.arquivo === b.arquivo || a.para !== b.para
+  return pacoteDoArquivo(a.arquivo) === pacoteDoArquivo(b.arquivo)
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/mapa.test.ts › para diferente no mesmo pacote: segue recusado
  if (pacoteDoArquivo(a.arquivo) !== pacoteDoArquivo(b.arquivo)) return false
-  return a.arquivo === b.arquivo || a.para !== b.para
+  return a.arquivo === b.arquivo
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/mapa.test.ts › o mesmo arquivo declarado duas vezes: segue recusado
  if (pacoteDoArquivo(a.arquivo) !== pacoteDoArquivo(b.arquivo)) return false
-  return a.arquivo === b.arquivo || a.para !== b.para
+  return a.para !== b.para
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-01 09:56:25 | 2026-11-01 09:56:53 | `revisor-geral` | 1 | APROVADO | a5d3b671d739b5357 |
| 2026-11-01 09:56:23 | 2026-11-01 09:57:04 | `test-engineer` | 1 | APROVADO | a8d4bddc64a32b5ac |
| 2026-11-01 10:02:50 | 2026-11-01 10:03:07 | `revisor-geral` | 2 | APROVADO | afde5dad962fda0d8 |
| 2026-11-01 10:02:44 | 2026-11-01 10:03:13 | `test-engineer` | 2 | APROVADO | ac4cb54aabdd4783a |
