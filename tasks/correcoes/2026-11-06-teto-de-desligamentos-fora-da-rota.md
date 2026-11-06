# Correção — o teto de 100 desligamentos da 16.0 não vale fora da rota: o `gravar` do motor enfileira o que o job fecha `falhou`, e o caso de 501 desligamentos ficou vermelho

**Origem:** `validacao.md` de `onboarding-por-convite` (REPROVADA, 06/11/2026): o crítico 1 (`apps/worker/test/desligamento-pela-planilha.int.test.ts:452`) e o menor de `packages/core/src/importacao/motor.ts:95`; pedido do Orquestrador em 06/11/2026.
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `privacy-guardian`, `tenancy-guardian`, `conformidade-reviewer`
<!-- `test-engineer`, `infra-guardian` e `privacy-guardian` vieram no PEDIDO do Orquestrador. `tenancy-guardian` e `conformidade-reviewer` entram por caminho: a correção altera arquivos de `apps/` e `packages/`, e `tools/processo/guardioes-por-caminho.ts` pede os quatro guardiões (PADRAO) para eles; a Mesa conferiu a linha contra os arquivos. A correção toca `packages/core/src/importacao/motor.ts` e um teste de `apps/worker/test/`: 2 arquivos fora de `tasks/`, sem `.github/`, `tools/ci/` nem `tools/processo/`, e por isso sem `revisor-geral` (passo 5 de `corrigir`). A Mesa confere a linha contra os arquivos. -->

## Sintoma

O caso "mais nomes do que cabem num lote (500): 501 nomes livres ausentes saem da lista …" está vermelho desde a 16.0 (`JobFailureError: DADOS_INVALIDOS`, `apps/worker/src/processors/gravar-planilha.ts:70`; determinístico, também isolado). Ele marca 501 em `desligar` chamando o `MotorDePlanilha` direto, sem o pipe da rota. O portão da 16.0 não rodou o arquivo (a 16.0 não o alterou), e a esteira, que o rodaria, não rodou (o push da spec está parado no escopo `workflow` do token).

## Fora desta correção

Nada: a árvore estava limpa ao começar. O crítico 2 da validação (o escopo de escola de `GradeRepository.aulasDaTurma` sem teste efetivo) **não** vem neste pedido e fica para a correção dele.

## Causa

A 16.0 pôs o teto de 100 em `marcasDaPlanilhaSchema.desligar` (`packages/shared/src/importacao/contratos.ts`, `MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR`). Quem aplica o schema é o pipe da rota. O `MotorDePlanilha.gravar` recebe `pedido.marcas` já tipado e **não o passa pelo schema**: confere só que cada marca é um candidato da prévia, grava as marcas como vieram em `importacao_planilha.marcas` e enfileira o job. O job as relê com `lerMarcas` (`motor.ts`), que usa o mesmo schema, recusa as 501 e fecha a importação `falhou` com `DADOS_INVALIDOS`. Quem chama o motor sem a rota (o teste do crítico 1, ou um chamador futuro) enfileira uma importação que nasce condenada, em vez de receber `ENTRADA_INVALIDA` na hora.

Mapeei os outros casos que marcam mais de 100 por fora da rota, procurando toda marca de `desligar` e toda carga em lote nos testes de `apps/` e `packages/`: só o do crítico 1 passa de 100 em `desligar`. Os outros casos de 501 (`gravar-planilha-alunos.int.test.ts` "nomes corrigidos", `desligamento-pela-planilha.int.test.ts` "501 alunos do ano anterior voltam") não marcam ninguém para desligar (a virada e a correção de nome não levam marca), e a grade de 1.200 linhas e a transferência em lote usam `encerrar` e `transferir`, que não têm teto. O `desligar` de professores (`gravar-planilha-professores.int.test.ts`) marca poucos.

## Teste que reproduz

`apps/worker/test/desligamento-pela-planilha.int.test.ts › o nome não aprovado marcado "fora da planilha" › um a mais que o teto (101), marcado pelo motor sem a rota: ENTRADA_INVALIDA na hora, sem importação na fila, em vez de uma importação que o job fecha falhou`: o motor recebe 101 marcas de nomes livres ausentes (todas candidatas da prévia, então só o teto as recusa) e tem de responder `ENTRADA_INVALIDA` sem deixar linha em `importacao_planilha`. Vermelho antes (`AssertionError: expected 'gravou' to be 'ENTRADA_INVALIDA'`, linha 485, 1 de 2 casos novos; o do teto de 100 passa), verde depois.

## Correção

**Motor.** `packages/core/src/importacao/motor.ts`, `gravar`: antes de refazer a prévia, `pedido.marcas` passa por `marcasDaPlanilhaSchema.safeParse`; marca que não tem a forma (hoje, mais de 100 em `desligar`) é `ENTRADA_INVALIDA`, o mesmo que a rota responde. As marcas gravadas são as que o schema devolveu. O teto passa a valer no motor, que é quem enfileira, e não só no pipe.

**O caso de 501.** O lote de 500 da retirada de nomes (`TAMANHO_DO_LOTE`, `importacao.repository.ts`) só se alcançava por um gravar com mais de 500 `desligar`, e o teto de 100 o tornou inalcançável pelo desligamento: o caso não pode mais provar mais de um lote de retirada. Ele é reescrito para o que ainda vale, o teto de um gravar (100 nomes livres ausentes saem, sem `desatualizada`, com 100 linhas de `lista_nome.retirado`), e ganha o irmão que reproduz o defeito (101 pelo motor, `ENTRADA_INVALIDA`). O laço em lotes de `retirarNomes` continua no repository, e a prova de que ele corre em mais de um lote **deixa de existir pelo desligamento**: fica dito aqui, e a prova de lote dos outros dois laços (nomes corrigidos e voltas, 501 cada) segue nos casos deles.

## Mutações

--faltando: 1 linhas (0 blocos, 1 motivos)

(O comando listava 2 linhas: a do `if` ganhou o bloco abaixo, e a do `??` fica com o motivo que vem depois do bloco.)

Um bloco, para a cláusula nova: tirar a leitura das marcas pelo schema devolve o `gravar` de antes, e o caso de 101 cai na asserção de `ENTRADA_INVALIDA` (o motor responde `gravou`), a primeira do caso.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › um a mais que o teto
falha: expect(resposta).toBe(ErrorCode.ENTRADA_INVALIDA)
-    const lidas = marcasDaPlanilhaSchema.safeParse(pedido.marcas)
-    if (!lidas.success) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
-    const marcas = lidas.data
+    const marcas = pedido.marcas
     const { ano, previa } = await this.preparar(tipo, pedido, daLista)
```

**Sem bloco (motivo):** o `ano?.id ?? null` do `criar` (`motor.ts:110`) não é cláusula desta correção: a linha só trocou `pedido.marcas` por `marcas`, e a condição é a de antes (o tipo sem ano grava `anoLetivoId` nulo), provada pelos casos de `gravar-planilha-professores.int.test.ts`.

## Recomendações sem aplicar

Os cinco revisores aprovaram na 1ª rodada, sem bloqueante. A recomendação barata (quebrar o comentário de uma linha só acima de `const lidas`, em `motor.ts`) foi aplicada (`.processo/ordens/2026-11-06-teto-de-desligamentos-fora-da-rota-r1.md`). Sem aplicar:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª), infra-guardian (1ª), privacy-guardian (1ª), tenancy-guardian (1ª), conformidade-reviewer (1ª) | O laço em lotes de `ImportacaoRepository.retirarNomes` (`importacao.repository.ts`, `TAMANHO_DO_LOTE`) ficou sem prova de mais de um lote: provar direto no repository com 501 retiradas, ou reduzir o laço a um lote ligado a `MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR` | `TODO.md`, uma entrada (o Implementador acrescenta): é arquivo e teste que esta correção não toca, e a segunda saída muda o repository. O documento já registra a perda da prova |
| test-engineer (1ª) | Mutação mais estreita sem bloco: manter a leitura pelo schema mas gravar `pedido.marcas` em vez de `lidas.data` | Recusada: com entrada já tipada as duas formas são equivalentes, e o revisor diz que só se diferenciariam se o schema completasse valor por padrão, o que o `strictObject` de UUIDs não faz. Nenhum RF trata do assunto |
| test-engineer (1ª) | Uma linha no guia do desenvolvedor: teste de integração do worker se roda pela config da raiz, e não de dentro de `apps/worker` (usa o `dist` velho do `@educa/core`) | `TODO.md` (o Implementador acrescenta, apontando `docs/guia-do-desenvolvedor.md`): é documento que a correção não toca |
| privacy-guardian (1ª) | A linha `--faltando: 1 linhas (0 blocos, 1 motivos)` no início de "Mutações" parece saída da ferramenta colada no texto: tirar ou explicar | Recusada: o parágrafo logo abaixo dela já a explica (o comando listava 2 linhas, uma ganhou bloco e a outra ficou com o motivo), e a linha é a saída que o documento confere |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 06:31:01 | 2026-11-06 06:31:15 | `tenancy-guardian` | 1 | APROVADO | ac54498b31b39856e |
| 2026-11-06 06:31:00 | 2026-11-06 06:31:15 | `privacy-guardian` | 1 | APROVADO | ad2e7dd2ba98d577d |
| 2026-11-06 06:31:02 | 2026-11-06 06:31:16 | `conformidade-reviewer` | 1 | APROVADO | a95b6ab35012eb0a3 |
| 2026-11-06 06:30:59 | 2026-11-06 06:31:41 | `infra-guardian` | 1 | APROVADO | acbbb7a3ca1f29726 |
| 2026-11-06 06:30:58 | 2026-11-06 06:32:51 | `test-engineer` | 1 | APROVADO | a5af855c836e1804e |
