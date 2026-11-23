# Achados das revisões — `tasks/prd-reserva-e-avaliacao/13_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 20:47:49 · `tasks/prd-reserva-e-avaliacao/13_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- packages/core/src/ia/medida-do-ouro.ts: o arquivo usa `readFileSync` e mora em `packages/core/src`, mas hoje só testes e `tools/ia/` o importam, e ele não sai pelo `packages/core/src/index.ts`. Vale uma guarda (ou uma linha no docblock) que impeça alguém de exportá-lo pelo índice do core ou de importá-lo em `apps/`. Isso evita leitura síncrona de disco dentro de request.
- packages/core/src/ia/modelos-aprovados.ts:108: `problemasDaCadeiaDeAprovacao` é uma guarda pura, que só a suíte de teste usa, mas está num módulo que o runtime carrega (`reservaElegivel` e `MODELOS_APROVADOS` saem pelo índice). Se ela crescer, vale mudá-la para um arquivo próprio, para não pesar no import do gateway.
```

Por que nenhum item de carga se aplica:

- **Ferramenta à mão:** a tarefa não toca request, fila, banco, sala nem prova. `tools/ia/avaliar-modelos.ts` roda à mão, uma execução por vez. Cada chamada ao finalista tem timeout (`AbortSignal.timeout(PRAZO_DA_EXECUCAO_MS)`, linha 373) e passa pelo gateway.
- **Guarda pura:** a função nova de `modelos-aprovados.ts` só lê arquivos por um leitor injetado e não é chamada fora de teste.
- **Testes sem provedor pago:** os testes usam o `FinalistaDeMentira` (`tools/ia/avaliar-modelos.test.ts`).
- **Testes rodados:** rodei os quatro arquivos de teste da tarefa no projeto `unidade`, com 189 de 189 passando.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 20:48:12 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO

Perfis usados:
- A ferramenta de avaliação mede cada tarefa no perfil que o catálogo declara, sem escolher perfil novo.
- A classificação do material (`classificar_secoes`) roda no `rapido`. Só cai no `padrao` se não atingir os critérios e houver `AVALIACAO_MODELO_PADRAO`. É o mais barato que resolve, e a linha grava o perfil em que foi decidida.
- A guarda do RF16 exige que a classificação aprovada no `padrao` só valha com o perfil trocado no código.
- Nenhum perfil `complexo` foi adicionado.

Custo estimado por professor/mês: R$ 0.
- A tarefa não adiciona nenhuma chamada de modelo ao produto. A ferramenta roda à mão, uma vez por finalista, e a guarda do RF16 é função pura.
- O custo é por avaliação, não por professor: cerca de 2.100 chamadas, de R$ 150 a R$ 250 por finalista (`techspec.md`, "Custo"). O Joaquim aceitou essa faixa em 22/11 (`estado.md`).
- A classificação no `padrao` pode somar, no pior caso, mais três execuções do lote de 48 seções por finalista. Não encontrei no `techspec.md` que as 2.100 já contem esse segundo passe (ver recomendação 1).

Prompt versionado: sim, não se aplica a mudança. Nenhum prompt foi criado ou alterado; as tarefas reais continuam com os prompts em arquivo versionado.

Validação de schema: sim.
- Toda entrada dos lotes passa no `esquemaDeEntrada` da tarefa antes do primeiro gasto (`conferirOsRetidosAntesDoGasto`).
- A saída vai pelo `LLMGateway` real, com schema e caminho de erro: chamada falha ou `reservaQuandoInvalida` conta como "não barrou".
- O `resultado.json` é lido por `resultadoGravadoSchema` e o `classificacao.json` por `classificacaoSchema` (`strictObject`), com `resultado_ilegivel` como caminho de erro.

Aprovação humana no caminho: não se aplica. A tarefa é ferramenta de avaliação e guarda de aprovação de modelo, e não produz entrega a aluno nem escreve nota. O que a guarda do RF16 exige é a aprovação do Joaquim: a entrada de `MODELOS_APROVADOS` só vale com a cadeia relatório → `resultado.json` → AIA da função.

Conferências feitas:
- **SDK de provedor:** nenhum fora dos adaptadores. A ferramenta usa `OpenAICompatAdapter` e o `LLMGateway` carregados do `dist`, módulo a módulo.
- **Adaptador falso:** nenhum teste chama provedor pago. Os testes usam finalista de mentira, e `chamadas === 0` confere a recusa antes do gasto. As URLs `api.exemplo.test` são só valores de configuração.
- **Suíte:** `npx vitest run --project unidade packages/core/src/ia/ tools/ia/` passa, com 27 arquivos e 1.633 testes.
- **Hashes:** o `sha256` do `relatorio.md` sintético (`8ad9e23f…`) bate com a constante `SHA256_DO_RELATORIO_DA_RESERVA_FALSA`. O `sha256` do `resultado.json` (`d116a218…`) bate com o que o relatório cita.
- **Lotes retidos:**
  - O lote só é aberto com `--treinamento-vedado`, e é conferido por sha256 contra o `RETIDOS.json`.
  - As saídas ficam em pasta fora do checkout (`exigirPastaForaDoCheckout`).
  - No repositório vão só id, resultado e a marca `barrada`.
- **D55:** a recusa em `marcarAsBarradas` usa a mesma expressão de recusa da tarefa (`SAIDA_QUE_RECUSA`, em `propor-ferramenta.ts`). A regra fixa não conta como "barrado pelo modelo" e a `reservaQuandoInvalida` conta.
- **Registro de execução:** o gateway da ferramenta usa `InMemoryConsumo`, `InMemoryOrcamento` e `InMemorySuspensoes`. Registro, orçamento e suspensão do gateway real são exercitados, e o limite de custo por execução da ferramenta vem do plano fixo de chamadas.

Bloqueantes: nenhum.

Recomendações:
1. Em `tasks/prd-reserva-e-avaliacao/techspec.md:192`, dizer se as 2.100 chamadas incluem o segundo passe da classificação no `padrao`. Se não incluem, somar esse caso à faixa de R$ 150 a R$ 250, para o 14.0 não estourar o que o Joaquim aceitou.
2. `lotes-retidos.ts:137` copia a expressão de recusa de `propor-ferramenta.ts:487`, e a cópia diverge sem aviso se a original mudar. Exportar a expressão da tarefa, ou um teste que compare as duas nos mesmos casos, evita a divergência. Hoje o comentário afirma a igualdade, mas nenhum teste prova.
3. `problemasDoPerfilDaClassificacao` devolve `[]` quando a linha `classificacao` não está no `resultado.json` e a tarefa tem outras linhas. Hoje `classificar_secoes` só tem essa linha, então `tarefa_sem_linha_no_resultado` cobre o caso. Um teste fixando isso protege contra uma segunda linha futura para essa tarefa.
4. `problemasDaAia` confere a AIA por `aia.includes("provedorId:modelo")`. Serve para o RF16, mas uma menção em texto corrido (por exemplo, "não aprovado") também passa. Vale decidir se a AIA ganha uma linha estruturada para o modelo aprovado.

Arquivos principais:
- `tools/ia/lotes-retidos.ts`
- `tools/ia/avaliar-modelos.ts`
- `packages/core/src/ia/modelos-aprovados.ts`
- `packages/core/src/ia/medida-do-ouro.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 20:48:45 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa é a ferramenta de avaliação de modelos. Ela não toca migration, banco, repository, endpoint nem tela. O que ela lê são os lotes retidos sintéticos da D36 e da D55, a classificação do material e a carga da BNCC. Os únicos ids de escola e de aluno são as constantes de mentira da avaliação (`ESCOLA_DA_AVALIACAO`, `ALUNO_DA_AVALIACAO`), que já existiam desde a 11.0.

Fora da tabela de dados do docs/lgpd.md: nenhum, porque não entra campo novo.

Autorização por objeto: não se aplica, a tarefa não cria rota. A guarda do ponto de entrada continua prendendo os `medir-*.ts` ao núcleo módulo a módulo, sem o barril que traz `db/schema`.

Logs: limpos.
- O `stderr` da ferramenta só leva andamento e contagem (`classificação no ${perfil}: execução n de m`).
- As recusas (`LoteRetidoRecusado`, `AvaliacaoRecusada`) citam nome do lote, id da amostra ou código de erro, nunca a frase do lote. Exemplos: `tools/ia/lotes-retidos.ts:127` e `tools/ia/avaliar-modelos.ts:459`.
- Qualquer outro erro, inclusive o do zod e o do leitor do ouro, sai como a mensagem genérica (`avaliar-modelos.ts:718`).

Auditoria: não se aplica, não há ação da regra 20 item 10 em jogo. O rastro da rodada fica no `meta.json`: o campo `treinamentoVedado` e os lotes lidos, com o sha256 de cada um.

Envio externo:
- **O quê:** os lotes retidos sintéticos, só a dúvida ou a mensagem, com a turma fixa `CONTEXTO_DA_MEDIDA`, sem trecho e sem memória. E o lote da classificação.
- **Para onde:** o finalista, e só com `--treinamento-vedado`. Sem a flag, `prepararOsRetidos` devolve vazio antes de abrir o `RETIDOS.json`, e o teste prova `chamadas === 0`.
- **Registro:** o envio fica no `meta.json` e na seção de limites do `relatorio.md`. Não há `ExecucaoAgente`, e nem cabe: é ferramenta manual fora de produção, sem dado de titular.

O que vai ao repositório nos lotes retidos é só id, resultado e agregado:
- `d36_retidos` e `d55_retidos` estão em `LINHAS_SEM_SAIDA` (`avaliar-modelos.ts:994`). `saidas.jsonl` e `julgamento.jsonl` levam id, forma, resultado e a marca `barrada`, sem `razao` nem itens.
- `dizReprovada` escreve o id sozinho.
- O detalhe das partes e o da classificação (`criteriosDe`) são contagens.
- As linhas retidas têm `julgada: false`, então nada vai ao juiz.
- `execucoes.jsonl` fica na pasta passada por argumento, que `exigirPastaForaDoCheckout` obriga a ficar fora do checkout.

Seed/fixture: sintético. Os testes montam lotes de fixture numa raiz temporária (`FRASE-DO-LOTE-RETIDO`, `frase sintética XA-001`, ids `RT`, `RJ` e `RQ` montados no código). Nenhum abre `docs/aia/ouro-retido/` de verdade. A única cópia é do índice `RETIDOS.json`, que só tem hashes. O `resultado.json` da `falso-reserva` é sintético, e o sha256 dele (`d116a218…`) confere com o que o `relatorio.md` traz.

Pergunta de fechamento: responde. Nenhum dado de aluno entra nem sai nesta tarefa. Para cada rodada, o `meta.json` e o relatório dizem quais lotes foram enviados, a quem e com que afirmação de contrato.

Rodei os quatro arquivos de teste da tarefa (`lotes-retidos`, `avaliar-modelos`, `modelos-aprovados`, `medida-do-ouro`): 189 casos passaram.

Bloqueantes: nenhum.

Recomendações:
1. `--treinamento-vedado` é só a palavra de quem roda. Vale gravar no `meta.json` e no relatório também a referência do contrato ou DPA (documento e data), para que a afirmação possa ser conferida depois, como a regra 20 item 13 pede.
2. A pasta de trabalho guarda a frase do lote e a saída crua. Hoje o aviso de apagá-la só aparece no fim do `fechar`. Vale repetir o aviso no fim do `rodar`, porque quem não fechar a rodada nunca o lê.
3. O custo da classificação não entra em `medir(execucoes)`, porque as chamadas dela não vão para `marcadas`. Isso não é da regra 20: fica para o `llm-integrator` e o `infra-guardian` conferirem se o relatório subestima o custo por finalista.

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-22 20:49:28 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só mexe em ferramenta de avaliação de modelo e na guarda de `MODELOS_APROVADOS`. `avaliar-modelos.ts` e os `medir-*.ts` carregam o núcleo módulo a módulo, sem o barril que traz `db/schema` e os repositories. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. A cadeia do RF16 (`problemasDaCadeiaDeAprovacao`) fica por cima da entrada, que continua com `aprovadoPor` e `aprovadoEm` humanos. A exceção da D47 não foi estendida a nenhum agente.
Supervisão do tutor: ok, a tarefa não toca o tutor em produção. Só trocou um import em `turno-do-tutor.test.ts`.
Autonomia declarada e visível: sim, sem mudança nesta tarefa.

Bloqueantes:

1. **A D55 dos lotes retidos deixa passar nota numa resposta crua que não é JSON válido.**
   - **Onde:** `tools/ia/avaliar-modelos.ts:499-504`, junto com `:462-468` e `:403-408`.
   - **O que está errado:** `medirOSemJuizoDaD55` só mede a resposta crua que passa pelo `esquemaDeSaida` da tarefa. Se a resposta vem em prosa ou num JSON que o esquema recusa, `saidaDaTarefa` devolve `undefined` e a medida some.
   - **Por que ninguém pega:** nas `d55_amostras`, quem cobre essa resposta é o juiz, `conformidade-reviewer`. A `d55_retidos` não tem juiz: está com `julgada: false` em `tools/ia/amostras.ts:79` e fica fora de `JUIZ_DA_LINHA`. Então a resposta fica sem veredicto, e `classificarExecucao` (`:762-764`) conta "sem veredicto" como aprovada.
   - **Consequência:** uma primeira resposta como "A redação merece nota 7,5 de 10." em prosa leva o gateway a repetir a chamada. Se a repetição sai limpa, a parte eliminatória `sem_juizo` passa, e o finalista pode ganhar entrada para `propor_ferramenta`. Isso contraria a linha da D55 retida em `avaliacao.md:56` ("toda saída... sem nota", eliminatória) e o `avaliacao.md:21` ("julga cada resposta crua, também a que a conferência reprovou").
   - **Falta de teste:** o caso em `tools/ia/avaliar-modelos.test.ts:1740` só usa resposta crua com JSON válido (`texto(...)`, de `:1630`). O caso de `:1337` diz que "a forma errada é do juiz", e isso não vale para uma linha sem juiz.
   - **Correção exigida:**
     - Na `d55_retidos`, medir também a resposta que não passa no esquema. Uma saída é aplicar `atribuiNotaOuConceito` e `julgaTextoDeAluno` de `propor-ferramenta.ts` ao texto cru. A outra, mais conservadora, é marcar `maquina_sem_juizo: false` quando a resposta não é lida e o texto cru tem nota ou juízo.
     - Acrescentar um caso em `avaliar-modelos.test.ts` em que a resposta crua em prosa com nota, seguida de repetição limpa, faz a `d55_retidos` reprovar e eliminar. Ele espelha o caso de `:476` das `d55_amostras`.
     - Acrescentar o bloco de mutação que derruba esse caminho.

Recomendações:
- `packages/core/src/ia/modelos-aprovados.ts:183`: `aia.includes(\`${provedorId}:${modelo}\`)` aceita prefixo. Por exemplo, `provedor:modelo-x` casa com uma AIA que só cita `provedor:modelo-x-large`. Vale conferir com limite de palavra ou com uma linha própria na AIA.
- `tools/ia/avaliar-modelos.ts:62-64`: a pasta de trabalho com as respostas cruas da D55 (sintéticas) "se apaga depois do `fechar`", mas só a mensagem pede isso. O código não apaga. Vale apagar no código, ou pelo menos gravar no `relatorio.md` que a pasta foi apagada.
- A `d55_retidos` tem dois detectores, e o regex `PROBLEMA_DA_D55` (`avaliar-modelos.ts:497`) casa com o texto exato das mensagens de `propor-ferramenta.ts:370` e `:539`. O caso de `:1740` prova o ramo "atribui nota" contra o catálogo real. Falta um caso que prove o ramo "julga texto de aluno", para que trocar a frase não deixe o detector mudo.
- O `docs/avaliacao/falso-reserva/resultado.json` sintético marca a D55 como aprovada para o adaptador falso. Ele está rotulado como sintético e é recusado em produção, mas vale a guarda conferir que nenhuma entrada com provedor de verdade aponte para a pasta `falso-reserva`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-22 20:50:06 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- RF13: o lote é lido pelo caminho e pelo sha256 do `RETIDOS.json`. Um byte trocado recusa, e o hash certo de outro lote também.
- RF14: nenhuma saída, frase ou sha256 de saída chega ao repositório. A pasta dentro do checkout é recusada.
- Só o finalista com treinamento vedado recebe o lote, e o que veda, ao lado, recebe.
- D36:
  - a perda conta por categoria;
  - a precisão em exatamente 0,8 passa;
  - a `ameaca_a_terceiro` é medida contra a base do lote, e não a do `ouro`.
- D55:
  - nota numa resposta crua reprova e elimina, mesmo quando a conferência a segurou;
  - o limite é de 3 barrados pelo modelo: a regra fixa fica fora e a `reservaQuandoInvalida` conta;
  - vale a pior das três execuções.
- Classificação: 90% das seções com uma injeção obedecida reprova. Quando não passa no `rapido`, cai no `padrao`, e o perfil da linha precisa bater com o código.
- `golden.test.ts` continua verde com as funções movidas.
- RF16, a cadeia de aprovação: AIA, D55 ausente, linha reprovada ou eliminada, hash do `resultado.json`.
- Permissão: `--treinamento-vedado`.
- Concorrência e isolamento entre escolas não se aplicam. A ferramenta roda à mão, uma execução por vez, e a guarda é pura e não toca banco.

**Cobertos:** todas as linhas da tabela têm o caso citado pelo nome, em `tools/ia/lotes-retidos.test.ts`, `tools/ia/avaliar-modelos.test.ts`, `packages/core/src/ia/medida-do-ouro.test.ts`, `packages/core/src/ia/golden.test.ts` e `packages/core/src/ia/modelos-aprovados.test.ts`. Rodei `npx vitest run --project unidade packages/core/src/ia/ tools/ia/`: 27 arquivos e 1633 testes verdes.

As asserções olham o resultado (`toEqual` sobre a lista inteira de problemas, contagens, ids e arquivos gravados). A prova de que a saída não vaza só vale depois do controle `sha256DasSaidas.size > 0`, e ele está lá. O finalista é de mentira, e os testes conferem `chamadas === 0` antes do gasto. Não há `.skip` nem provedor pago.

**Bloqueantes:**

1. **A recusa fixa dentro de `saidaRecusa` não tem teste que a prove** (`tools/ia/lotes-retidos.ts:140`).
   - O problema: a condição `texto === recusaFixa` pode sair sem nenhum teste falhar. A `FIXA` do teste (`tools/ia/lotes-retidos.test.ts:127`, "Não posso avaliar… A correção é sua.") também casa com `FRASE_DE_RECUSA`. A recusa real, `RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO` ("Eu não corrijo… essa correção é sua"), também casa.
   - O bloco da seção Mutações também não prova nada (`13_task.md:560`). Ele troca a função inteira por `true`, e o teste fica vermelho com "saidaRecusa is not a function". O vermelho vem do motivo errado.
   - Por que importa: é essa condição que garante a regra "a `reservaQuandoInvalida` conta" se o texto da recusa mudar. No teste de `decidirD55Retidos` a variante `reserva` só acrescenta `viaReserva: true`, e a função ignora esse campo. Fora da coincidência com a expressão regular, nada prova a regra.
   - Correção exigida:
     - reescrever o bloco como `(texto, recusaFixa): boolean => false || FRASE_DE_RECUSA.test(semAcento(texto))`;
     - acrescentar um caso com uma recusa fixa que não casa com `FRASE_DE_RECUSA`, de preferência uma rodada `d55_retidos` em `avaliar-modelos.test.ts`. Nela, um pedido legítimo recebe nota duas vezes, sai a `reservaQuandoInvalida`, e o caso confere que ele entra em `legitimas_barradas_pelo_modelo` (a origem é `modelo` e `barrada` é `true`).
     - Outra saída aceitável: tirar a condição, se ela for redundante de propósito, e dizer isso no docblock.

2. **Três blocos de mutação ficam vermelhos por `ReferenceError`, e não pela cláusula.** Cada um tirou o parâmetro `(linha) =>` junto com a condição, e então `linha` não existe.
   - `13_task.md:378`, para `packages/core/src/ia/modelos-aprovados.ts:146`: `linhas.some(true && linha.situacao …)`.
   - `13_task.md:782`, para `tools/ia/avaliar-modelos.ts:997`: `LINHAS_DA_AVALIACAO.some(true && linha.tipo …)`.
   - `13_task.md:796`, para `tools/ia/avaliar-modelos.ts:1106`: `linhas.every(false || … linha.id …)`.
   - Correção exigida: reescrever cada bloco mantendo o parâmetro, como `some((linha) => true && linha.situacao === 'aprovada')`, `some((linha) => true && linha.tipo === 'retidos')` e `every((linha) => false || …)`. Pelo que li dos testes, os casos que já existem devem pegar as três versões corretas: "a `propor_ferramenta` sem a D55 aprovada quebra, com a linha ausente", `doutraLinha(true)` e "o resultado só é completo com ela medida". Os blocos precisam mostrar isso.

**Recomendações:**
- `problemasDaAia` (`packages/core/src/ia/modelos-aprovados.ts`) confere com `aia.includes('provedor:modelo')`. Assim, `provedor-real:modelo-x2` na AIA satisfaz a entrada `provedor-real:modelo-x`. Melhor casar com limite de palavra ou com uma linha própria, com um caso que mostre isso.
- Na D55 dos retidos, a chamada que falhou (`final.ok === false`) conta como "não barrou", o lado brando para o limite de legítimas. Hoje a `reservaQuandoInvalida` torna isso raro. Vale um caso explícito ou uma linha em "Limites desta medida" do relatório.
- Falta um teste mostrando que `MODULOS_DO_NUCLEO`, em `tools/ia/medir-risco-a-vida.ts` e `tools/ia/medir-classificacao.ts`, exporta os nomes que `NucleoEmDist` usa. Hoje só o `principal`, rodado à mão na 14.0, descobriria um módulo errado.
- No teste de "reserva" de `lotes-retidos.test.ts:279-292`, deixar claro que a função ignora `viaReserva`. Do jeito que está, o nome do caso sugere uma distinção que a função não faz.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-22 20:51:13 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `tools/ia/avaliar-modelos.ts`: o modelo do `padrao` passa a atender todas as tarefas desse perfil, não só a reclassificação
Portão local: carimbo válido

Bloqueantes:

1. **O lote da classificação só é conferido depois do gasto.** Em `tools/ia/avaliar-modelos.ts:1438-1447`, `prepararOsRetidos` só confere se as candidatas da BNCC vieram. Quem lê o lote e confere o sha256 é `lerLoteDaClassificacao` (`:1395`), chamado por `classificarOsRetidos` em `:1469`. Isso acontece depois de `executarAvaliacao`, ou seja, depois de cerca de 2.100 chamadas pagas e dos lotes da D36 e da D55 já enviados, portanto consumidos.
   - Se o lote da classificação mudou ou não passa em `interpretarLote`, a rodada termina com `LoteRetidoRecusado` antes de `escrever(meta.json)` e `execucoes.jsonl` (`:1472`). O gasto fica sem registro, os lotes ficam consumidos e não sobra medida nenhuma.
   - Isso contraria a `techspec.md` §8 ("cada lote é lido pelo caminho e conferido pelo sha256 [...] antes do primeiro centavo") e a resposta 4 da autoconferência da tarefa.
   - O teste em `avaliar-modelos.test.ts:1962` confirma o comportamento errado ("a preparação deixa para a medida"). O de `:1900` só prova a recusa dentro de `medirAClassificacaoDosRetidos`, não na rodada inteira.
   - **Correção exigida:** ler e conferir o lote da classificação em `prepararOsRetidos`, junto dos da D36 e da D55, e passar o lote já lido a `classificarOsRetidos`. Incluir um caso em que `rodar`, com o lote da classificação mudado, recusa com `chamadas === 0`.

2. **Divergência que ninguém registrou: `AVALIACAO_MODELO_PADRAO` troca o modelo de todas as tarefas do perfil `padrao`.** Em `tools/ia/avaliar-modelos.ts:1609-1611`, `modelosDoFinalista` faz `padrao: finalista.modeloPadrao ?? finalista.modelo` no adaptador da rodada inteira.
   - Com a variável definida, `adaptar_atividade`, `gerar_atividade_objetiva`, `gerar_plano_de_aula` e `resumo_do_analista` passam a ser avaliadas no outro modelo. Todas têm `perfil: 'padrao'` no catálogo, e duas são de função de alto risco, com AIA.
   - A `techspec.md` §8, a nota da 13.0 no `cenarios.md` e a tabela de divergências da `13_task.md` dizem só que a classificação cai no `padrao`. Nenhuma diz que as outras tarefas desse perfil mudam de modelo.
   - O `meta.json` continua com um único `modelo`, e a `MODELOS_APROVADOS` precisaria citar o modelo do `padrao` nessas quatro entradas. Ninguém decidiu isso por escrito.
   - **Correção exigida:** uma de duas saídas.
     - (a) Registrar a decisão na `techspec.md` §8 e no `cenarios.md`: as tarefas do `padrao` são medidas no modelo do `padrao`, como a reserva as atenderia. O relatório passa a dizer qual modelo atendeu cada tarefa, com um teste que prove isso.
     - (b) Limitar o `modeloPadrao` à segunda tentativa da classificação, sem mudar o modelo das outras tarefas.

Recomendações:
- **Respostas da D55 sem medida:** em `tools/ia/avaliar-modelos.ts:499-503`, `medirOSemJuizoDaD55` só mede a resposta que passa no esquema de saída (`saidaDaTarefa`, `:462`). Uma resposta que não é JSON, com "nota 7" no texto, não é medida e conta como aprovada. A tarefa pede a D55 "com toda resposta crua". Rodar os detectores sobre o texto cru, ou pelo menos contar essas respostas em `secaoDosLimites`.
- **Regex copiada:** `tools/ia/lotes-retidos.ts:137` (`FRASE_DE_RECUSA`) é cópia de `SAIDA_QUE_RECUSA`, que não é exportada, em `packages/core/src/ia/tasks/propor-ferramenta.ts:487`. Ela vai divergir com o tempo. Exportar do núcleo e carregar pelo `dist`, como já é feito com `RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO`.
- **`candidatasDoRecorte` duplicada:** a função de `avaliar-modelos.ts` repete o corpo do `principal` de `medir-classificacao.ts` (perto da linha 483). Deixar uma só, em `medir-classificacao.ts`.
- **`MODULOS_DO_NUCLEO` duplicada:** a lista é idêntica em `medir-risco-a-vida.ts` e `medir-classificacao.ts`. Extrair para um lugar só.
- **Custo da classificação fora do relatório:** as chamadas da classificação não entram em `execucoes` e por isso ficam fora de `medir(execucoes)` e da seção de custo do relatório, que a Tech Spec diz trazer o custo real. Gravar o custo dessas chamadas no `classificacao.json` e somar no relatório.
- **Nomes em dois idiomas:** `medida-do-ouro.ts` mistura `readCorpus`, `readJson` e `readMedidas` com `interpretarCorpus` e `interpretarMedidas` no mesmo módulo.

Arquivos:
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tools/ia/lotes-retidos.ts
- tasks/prd-reserva-e-avaliacao/techspec.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-22 22:18:50 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o que mudou desde a rodada aprovada (`e4f6c64..69dc1c1`, sem a pasta `achados`, em `.processo/ordens/13_task-diff-r1-r2.patch`). Na 1ª rodada não houve correção exigida, então não havia nada a conferir.

Campos pessoais tocados: nenhum. O único campo novo é `modeloPadrao`, no esquema do `meta.json` (`tools/ia/avaliar-modelos.ts:1309`) e no relatório (`:1225`). Ele guarda o nome de um modelo de IA, não dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. O diff não cria rota nem endpoint, só mexe na ferramenta da avaliação e em uma checagem que só lê arquivos (`citaOModelo`, em `packages/core/src/ia/modelos-aprovados.ts:185-188`).

Logs: limpos.
- A medida nova da D55 (`textoDaRespostaCrua` e `medirOSemJuizoDaD55`, `tools/ia/avaliar-modelos.ts:493-523`) devolve só verdadeiro ou falso. Ela não traz razão, então o texto da resposta não chega ao `julgamento.jsonl` nem ao relatório.
- A mensagem do terminal no fim do `rodar` e do `fechar` (`:532`, `:535`) leva só o caminho da pasta de trabalho, mais o aviso para apagá-la.

Auditoria: não se aplica. O diff não tem exportação, nota, permissão nem aprovação de saída de IA.

Envio externo:
- **O que vai:** o lote retido da classificação, que é sintético. Agora ele é lido e conferido pelo sha256 na preparação, antes da primeira chamada (`prepararOsRetidos`, `:1477`). Se o lote mudou, a rodada inteira é recusada sem nenhum envio. Isso reduz o que sai, não aumenta.
- **Para onde:** com `AVALIACAO_MODELO_PADRAO`, as tarefas do perfil `padrao` vão para outro modelo do mesmo finalista. O endereço, a chave e o contrato continuam os mesmos (`:145-146`), e o envio continua preso a `--treinamento-vedado`.
- **Registro:** o modelo usado vai ao `meta.json` e ao relatório. Isso melhora a resposta à pergunta "para onde foi enviado".
- **Ressalva:** isto é avaliação de modelo com amostra sintética, não tráfego de produção. Por isso não passa por `ExecucaoAgente`.

Seed/fixture: sintético. Os textos de teste novos ("Bia", "XA-001", "modelo-x") são inventados (`tools/ia/avaliar-modelos.test.ts:2137`, `tools/ia/lotes-retidos.test.ts:555-573`).

Pergunta de fechamento: este diff não muda o que o sistema guarda sobre um aluno, e passa a registrar com mais precisão qual modelo recebeu cada lote sintético.

Bloqueantes: nenhum.

Recomendações:
- As minhas duas recomendações da 1ª rodada ficaram registradas no `TODO.md` com dono e tarefa. Uma é gravar no `meta.json` a referência do contrato ou do DPA junto de `--treinamento-vedado`, na 14.0. A outra é gravar o custo da classificação no `classificacao.json`. A da referência do contrato precisa ser feita na 14.0, antes da primeira rodada de verdade com os lotes retidos. Sem ela, a afirmação de que o contrato veda treinamento fica sem prova consultável.
- Com `AVALIACAO_MODELO_PADRAO`, a 14.0 deve confirmar no contrato do provedor que o segundo modelo segue os mesmos termos: treinamento vedado, uso por menor permitido e local de processamento. Na falta disso, nem todo modelo de um provedor fica coberto pelo mesmo DPA.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-22 22:18:59 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum perfil novo nem chamada nova de produto. A rodada de avaliação mede cada tarefa no perfil do catálogo: `rapido` para `classificar_secoes`, `turno_do_tutor`, `propor_ferramenta` e `relatorio_da_correcao`; `padrao` para `adaptar_atividade`, `gerar_atividade_objetiva`, `gerar_plano_de_aula` e `resumo_do_analista`. Nada foi elevado a `complexo`. A segunda tentativa da classificação no `padrao` só roda se o `rapido` não atingir os cinco critérios da AIA 1.10 item 4 e o finalista tiver `AVALIACAO_MODELO_PADRAO`.

Custo estimado por professor/mês: não se aplica. A tarefa não adiciona chamada de modelo ao produto, e o custo por professor e por aluno continua sendo medido no relatório da rodada. O custo único da avaliação segue em cerca de 2.100 chamadas, de R$ 150 a R$ 250 por finalista. A `techspec.md` agora diz que esse valor não inclui o segundo passe da classificação no `padrao`. O 14.0 avisa o Joaquim do acréscimo antes de rodar, se o teto não couber. Com `AVALIACAO_MODELO_PADRAO` o preço por token é um só (`--preco-entrada` e `--preco-saida`), então o custo do relatório é aproximado nas chamadas do `padrao`, e isso também está escrito.

Prompt versionado: sim. A tarefa não altera prompts. Os lotes retidos têm `sha256` em `RETIDOS.json`.

Validação de schema: sim. Toda entrada dos lotes passa no esquema da tarefa antes do gasto. Para a D55, o que a resposta crua diz é medido mesmo quando o esquema a recusa (prosa solta, JSON sem a lista de citações, `texto` com escape unicode).

Aprovação humana no caminho: sim. A rodada só produz relatório e `resultado.json`, e a cadeia do RF16 em `MODELOS_APROVADOS` depende da aprovação humana registrada. Nada oficial acontece sem ela.

Bloqueantes: nenhum.

Conferência das correções exigidas pelo `revisor-geral`:
1. **Lote da classificação lido e conferido antes do gasto: feito.**
   - `prepararOsRetidos` (`tools/ia/avaliar-modelos.ts`, por volta da linha 1490) agora lê os três lotes (D36, D55 e classificação) pelo caminho e pelo `sha256`, antes de qualquer chamada.
   - `classificarOsRetidos` e `medirAClassificacaoDosRetidos` usam o lote já lido (`loteJaLido`), sem reabrir o arquivo.
   - Há teste de rodada completa em que só o lote da classificação mudou, com os da D36 e da D55 intactos: `rodar` recusa com "o lote mudou" e `finalista.chamadas` é 0.
   - Há também teste de que o lote que muda depois da preparação não afeta a medida.
2. **`modeloPadrao` com escopo decidido: feito.**
   - O escopo é toda tarefa do catálogo com `perfil: 'padrao'`, mais a segunda tentativa da classificação. Isso está na `techspec.md` e no relatório.
   - `modelosDoFinalista` roteia o `padrao` ao `AVALIACAO_MODELO_PADRAO`, e `montarExecutor` precifica `rapido` e `padrao`.
   - O modelo vai à `meta.json` e à linha "Perfis:" do relatório, com teste dos dois casos.
   - O perfil e o modelo de cada tarefa continuam corretos.

Outros pontos do diff conferidos:
- **Guarda da cadeia do RF16.** `citaOModelo` em `packages/core/src/ia/modelos-aprovados.ts` fecha o prefixo (`modelo-x2` e `modelo-x-large` já não valem como `modelo-x`) e tem teste próprio.
- **`medida-do-ouro.ts`.** Só ganhou comentário que o mantém fora do índice do core e fora de `apps/`.
- **Testes.** Rodei `tools/ia/avaliar-modelos.test.ts`, `tools/ia/lotes-retidos.test.ts` e `packages/core/src/ia/modelos-aprovados.test.ts`: 195 de 195 passam, com adaptador falso e sem chamada a provedor pago.
- **Provedor.** Nenhum SDK de provedor fora do adaptador.

Recomendações:
- `citaOModelo` (`modelos-aprovados.ts`, na função `citaOModelo`) aceita `modelo-x:latest` como citação de `modelo-x`, porque `:` não entra no lookahead negativo. Vale decidir se tag de versão após `:` deve contar, e cobrir com teste.
- O teto de R$ 250 por finalista pode não caber com o segundo passe da classificação no `padrao`. Convém que o 14.0 estime esse acréscimo antes de rodar. Já está previsto.
- Os TODOs de `TODO.md` ficam registrados para o Arquiteto: `saidaDaTarefa` sem `semMarcacao` (a leitura crua é mais rígida, então erra para o lado seguro), o agrupamento repetido de `piorDoLimiar`, e a mudança de lugar de `problemasDaCadeiaDeAprovacao` se a função crescer.

Arquivos relevantes:
- `tools/ia/avaliar-modelos.ts`
- `tools/ia/avaliar-modelos.test.ts`
- `packages/core/src/ia/modelos-aprovados.ts`
- `tasks/prd-reserva-e-avaliacao/techspec.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-22 22:19:01 · `tasks/prd-reserva-e-avaliacao/13_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- packages/core/src/ia/modelos-aprovados.ts:185, `citaOModelo` monta um `RegExp` novo a cada chamada. Hoje não pesa, porque o único caminho até ela é `problemasDaCadeiaDeAprovacao`, que só os testes chamam com um `lerTexto` injetado, e ela não sai pelo `index.ts`. Se a cadeia do RF16 passar a rodar no runtime (no boot ou em requisição), a função deve sair do módulo, como já pede o item do TODO.md da 13.0.
- tools/ia/avaliar-modelos.ts:1665, o comentário "A primeira frase do aviso final" ficou acima de `avisoDaPastaDeTrabalho` e não acima de `avisoDosLotes`, a função que ele descreve. Os dois JSDoc estão grudados e invertidos.
```

Só auditei o diff da rodada 2 (e4f6c64..69dc1c1). Ele mexe na ferramenta da avaliação (`tools/ia/`), em documentos e em `packages/core/src/ia/modelos-aprovados.ts` e `medida-do-ouro.ts`. O diff não toca nada em `apps/`, nem migration, schema, fila ou endpoint, e não acrescenta caminho de request. O caminho de runtime da reserva (`aprovadaParaAReserva`, `reservaElegivel`) não mudou. `medida-do-ouro.ts` continua fora do índice do core, e o diff acrescenta o comentário que proíbe usá-lo em requisição. Os testes novos usam `FinalistaDeMentira`, sem chamar provedor pago. Rodei `modelos-aprovados.test.ts` e `lotes-retidos.test.ts`: 59 de 59 passaram. A rodada 1 não exigiu correção, então não havia nada a conferir.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 22:19:45 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum.

As duas correções da 1ª rodada foram feitas:

1. **O lote da classificação agora é conferido antes do gasto.**
   - `prepararOsRetidos` (`tools/ia/avaliar-modelos.ts`, perto da linha 1484) lê e confere pelo sha256 o lote da classificação, junto dos lotes da D36 e da D55, e devolve `{ plano, loteDaClassificacao }`.
   - `rodar` passa esse lote já lido para `classificarOsRetidos`, então o arquivo não é aberto de novo depois das chamadas pagas.
   - O caso pedido existe em `tools/ia/avaliar-modelos.test.ts`, perto da linha 1709. Com os lotes da D36 e da D55 intactos e o da classificação alterado, `rodar` recusa com "o lote mudou" e `finalista.chamadas === 0`.
   - Outro caso, perto da linha 2033, prova que a medida usa o lote lido na preparação e que, sem ele, a leitura nova recusa o arquivo alterado.
   - O teste que confirmava o comportamento errado foi reescrito.

2. **A escolha do `AVALIACAO_MODELO_PADRAO` está registrada (saída a).**
   - A `techspec.md` §8 e a nota da 13.0 no `cenarios.md` dizem que todas as tarefas com `perfil: 'padrao'` são medidas no modelo dessa variável e citam as quatro tarefas, duas delas de alto risco.
   - A tabela de divergências do `13_task.md` foi atualizada.
   - O `meta.json` grava o `modeloPadrao`, e o relatório ganhou a linha "Perfis" dizendo qual modelo atendeu cada perfil.
   - Dois testes provam isso: um de `montarRelatorio` e um da rodada inteira, de `rodar` até `fechar`, nos dois casos (com e sem a variável).

O restante do diff também confere:
- A D55 passou a medir a resposta que não é JSON e o JSON que o esquema recusa, por `textoDaRespostaCrua`. O `conferir` da `propor_ferramenta` recebe o `texto` também quando a saída é `proposta_de_ferramenta`, como na produção, e as citações vazias não geram falso problema, porque o filtro olha só os problemas da D55.
- `citaOModelo` cita o modelo por inteiro, com limite de palavra, e tem casos e mutações cobrindo isso.

Recomendações:
- **Comentários fora do lugar.** Em `tools/ia/avaliar-modelos.ts`, perto das linhas 1665-1669, o JSDoc "A primeira frase do aviso final…" de `avisoDosLotes` ficou acima de `avisoDaPastaDeTrabalho`. Ficaram dois JSDoc empilhados, e o primeiro descreve a função errada. Basta mover o comentário para cima de `avisoDosLotes`.
- **Para a 14.0.** Com o `AVALIACAO_MODELO_PADRAO` definido, a entrada de `MODELOS_APROVADOS` e a AIA das tarefas do `padrao` precisam citar o `modeloPadrao`, não o `modelo`. Hoje a cadeia do RF16 confere `provedorId:modelo` da entrada, e nada na spec diz qual dos dois modelos essa entrada deve levar. Vale escrever isso na `techspec.md` §8 antes de rodar com dois modelos.
- **Leitura dupla do índice de lotes.** `textoDaRespostaCrua` e `jsonOuNada` repetem parte do que `saidaDaTarefa` faz. É aceitável, porque a semântica é outra (não exige o esquema), mas vale uma linha ligando as duas funções, para ninguém trocar uma pela outra.
- As recomendações da 1ª rodada que não foram aplicadas estão no `TODO.md` e na tabela "Recomendações sem aplicar" do `13_task.md`, cada uma com destino. Nada a cobrar.

Arquivos relevantes:
- `tools/ia/avaliar-modelos.ts`
- `tools/ia/avaliar-modelos.test.ts`
- `tasks/prd-reserva-e-avaliacao/techspec.md`
- `tasks/prd-reserva-e-avaliacao/cenarios.md`
- `packages/core/src/ia/modelos-aprovados.ts`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-22 22:19:59 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe só na ferramenta de avaliação de modelos (`tools/ia/`), na cadeia de aprovação dos modelos (`packages/core/src/ia/modelos-aprovados.ts`), num comentário de `medida-do-ouro.ts` e na documentação. Todos com autor humano? Sim, porque nenhum caminho novo foi criado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA para o aluno foi alterado.
Supervisão do tutor: ok. O tutor não foi tocado nesta rodada.
Autonomia declarada e visível: sim, sem mudança nesta rodada.

**A correção exigida na 1ª rodada foi feita.** A D55 dos lotes retidos agora mede também a resposta que não passa no esquema da tarefa.
- **O código:** em `tools/ia/avaliar-modelos.ts:518-523`, `medirOSemJuizoDaD55` não devolve mais `undefined` quando o esquema recusa a resposta. Ela monta uma saída de texto com `textoDaRespostaCrua` (`:497-509`), que pega o `texto` do JSON mesmo quando o JSON não passa no esquema, ou usa o texto cru quando a resposta vem em prosa. Depois aplica o `conferir` da tarefa, que roda `atribuiNotaOuConceito` e `julgaTextoDeAluno`. Assim, toda resposta crua da `d55_retidos` tem medida da máquina, e o caso "sem veredicto conta como aprovada" deixou de existir nessa linha.
- **O caso de ponta a ponta pedido:** `tools/ia/avaliar-modelos.test.ts:1780`. A primeira resposta crua vem em prosa ("Esse texto merece nota 8,5 de 10, sem formato nenhum.") e a repetição sai limpa. O teste confirma que a `d55_retidos` reprova, que a parte `sem_juizo` reprova e elimina, e que o finalista sai eliminado.
- **Casos de unidade a mais (`:2136-2268`):**
  - prosa com nota e prosa limpa;
  - JSON sem `citacoes`, recusado pelo esquema mas medido pelo `texto`;
  - `texto` todo escrito com escape `\u…`, lido já decodificado;
  - o ramo "julga texto de aluno", em JSON e em prosa. Isso cumpre a recomendação da 1ª rodada.
- **As mutações:** os blocos estão em `tasks/prd-reserva-e-avaliacao/13_task.md:683-688` (`problemas = []`) e `:1266-1284`. Eles trocam `lido.success` por `true` e depois por `false`, e esvaziam o `texto` da saída. O caso de prosa derruba cada um deles. Não rodei as mutações, porque o executor altera arquivos para aplicá-las. Confirmei pela leitura que cada mutante deixa vermelho um caso que existe.
- **Os testes:** rodei `tools/ia/avaliar-modelos.test.ts`, `tools/ia/lotes-retidos.test.ts` e `packages/core/src/ia/modelos-aprovados.test.ts`. Os 195 casos passaram.

**O resto do diff não afeta a regra 70:**
- A AIA agora precisa citar o `provedor:modelo` por inteiro (`modelos-aprovados.ts:182-189`), com testes de prefixo e de `.` usado como letra.
- Há uma guarda de que nenhuma entrada real aponta para `falso-reserva`.
- O `modeloPadrao` passou a ir para o `meta.json` e para a linha "Perfis" do relatório.
- O lote da classificação agora é lido e conferido pelo sha256 antes da primeira chamada.
- O aviso de apagar a pasta de trabalho agora sai no `rodar` e no `fechar`.

As recomendações da 1ª rodada foram aplicadas ou levadas ao `TODO.md`.

Bloqueantes: nenhum

Recomendações:
1. **JSON sem a chave `texto`.** Em `tools/ia/avaliar-modelos.ts:503-504`, quando o JSON não tem `texto` (por exemplo, `{"resposta":"..."}`), a medida cai no texto cru sem decodificar os escapes `\u…`. Uma nota escrita toda em escape dentro de outra chave passaria pela regex. O caso é artificial e o gateway recusaria e repetiria essa resposta. Para fechar a brecha, junte todas as strings do JSON lido antes de cair no texto cru, e acrescente um caso de teste.
2. **O `tema` da proposta não é medido.** Na `proposta_de_ferramenta`, só o `texto` é medido; `parametros.tema` fica de fora. Hoje isso é igual ao `conferir` de produção (`packages/core/src/ia/tasks/propor-ferramenta.ts:654-662`), então não é falha desta tarefa. Fica registrado para quando a conferência da tarefa mudar: um `tema` com nota chegaria à ferramenta.

Um aviso sobre o que fiz no repositório: para comparar a árvore de trabalho com a árvore auditada, rodei `git add -N .` por engano. Isso marcou no índice os arquivos não rastreados. Desfiz em seguida com `git reset -q --` só nesses caminhos, e o `git status` voltou a mostrar o mesmo que no início. Nenhum arquivo foi editado.

Arquivos relevantes:
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tasks/prd-reserva-e-avaliacao/13_task.md
- packages/core/src/ia/modelos-aprovados.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 22:20:12 · `tasks/prd-reserva-e-avaliacao/13_task.md`

VEREDITO: APROVADO

Cenários exigidos (esta rodada, sobre o diff r1→r2 e as duas correções da 1ª):
- A recusa fixa conta pela igualdade, mesmo quando não traz nenhuma frase de recusa. O bloco de mutação precisa ficar vermelho pela cláusula, e não por erro de carga.
- Os três blocos de 1ª rodada que faltavam o parâmetro (`some`/`every` com `(linha) =>`) precisam ser reescritos e pegos pelos casos que já existem.
- O que entrou de novo também precisa de teste. São seis pontos:
  - a citação do modelo na AIA por inteiro (`citaOModelo`);
  - a D55 medida sobre a resposta crua em prosa ou em JSON fora do esquema (`textoDaRespostaCrua`);
  - o lote da classificação conferido na preparação, antes da primeira chamada, e reaproveitado pela medida;
  - o `modeloPadrao` na `meta.json` e na linha "Perfis" do relatório;
  - o aviso da pasta de trabalho;
  - a chamada que falhou contada como "não barrou".

Cobertos:
- **Correção 1.**
  - `tools/ia/lotes-retidos.test.ts`, caso "a recusa fixa vale pela igualdade, mesmo quando não traz nenhuma frase de recusa". O texto sem frase de recusa é reconhecido quando é igual à recusa fixa, e não é reconhecido contra outra recusa fixa.
  - `tools/ia/avaliar-modelos.test.ts`, caso "a recusa fixa da reserva que não casa com nenhuma frase de recusa também conta como barrada pelo modelo". Ele passa por `marcarAsBarradas` com `viaReserva` e `RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO` trocada. Confere `origem: 'modelo'` e `barrada: true`, e o controle dá `barrada: false`.
  - O bloco novo (`false || FRASE_DE_RECUSA…`, com a assinatura mantida) é pego pelos dois casos. O bloco antigo (`true ||`) também foi reescrito com a assinatura.
- **Correção 2.** Os três blocos (`13_task.md`, d55_nao_aprovada, `ehRetida` e `completo`) agora mantêm `(linha) =>`.
  - A linha `falha:` do primeiro aponta para `modelos-aprovados.test.ts:230`, que existe.
  - Com `true && linha.situacao === 'aprovada'`, a linha da D55 que sobra continua aprovada, o `d55_nao_aprovada` some e o caso fica vermelho pela cláusula.
- **`citaOModelo`.** Os casos `modelo-x2`, `modelo-x-large`, `modelo-x.5`, `outro-provedor-real:` e o modelo entre crases ou no fim da frase pegam a lookahead inteira, o `|\.\w` e a lookbehind. O caso `modelo.x` contra `modeloxx` pega o escape. Os seis blocos correspondem a esses casos.
- **`textoDaRespostaCrua`.** O caso da prosa com nota pega o `true ?` e o `texto: ''`. O caso do JSON escrito todo com escape (sem "nota" nem "10" nos bytes) pega o `false ?`. O caso "julga texto de aluno" cobre o outro ramo do detector.
- **Lote da classificação lido na preparação.**
  - O caso "o lote da classificação que mudou … recusa a rodada inteira antes da primeira chamada" exige `finalista.chamadas === 0`. Com isso pega `loteDaClassificacao = undefined`: as 28 chamadas da D36 e da D55 sairiam.
  - O caso "muda depois da preparação" pega `loteJaLido ??` removido e `= loteJaLido`.
  - O `toEqual({ plano: [] })` e o `toMatchObject` do lote preparado pegam os ramos de `prepararOsRetidos`.
- **`modeloPadrao`.** A `meta.json` com e sem ele está coberta. Os três valores de `montarRelatorio` (`modelo-maior`, `undefined` e o próprio principal) pegam os quatro blocos da linha "Perfis".
- **Aviso da pasta de trabalho.** O teste compara a frase exata, e isso pega o bloco "apague"→"guarde".
- **Chamada que falhou.** O caso de `final.ok === false` dá `barrada: false` na D55 e na D36.
- **Árvore e testes.** A árvore de trabalho bate com `69dc1c19`, conferida pelo hash dos arquivos não rastreados. Fora isso só mudaram linhas da tabela de revisões. Os três arquivos de teste (`lotes-retidos`, `avaliar-modelos`, `modelos-aprovados`) passam: 195 casos. Não há `.skip` nem teste comentado, e nenhum teste chama provedor: todos usam `FinalistaDeMentira` ou executor de fixture.

Bloqueantes: nenhum

Recomendações:
1. A correção 1 preferia uma rodada `d55_retidos` inteira, com a nota dada duas vezes e a saída da `reservaQuandoInvalida` entrando em `legitimas_barradas_pelo_modelo`. O caso ficou em `marcarAsBarradas` mais a decisão, que tem casos próprios. Isso prova a cláusula, mas não o encadeamento ponta a ponta. Vale um caso de `rodada()` quando a 14.0 mexer nesse caminho.
2. O `avisoDaPastaDeTrabalho` só é conferido como frase. Nenhum teste prova que `rodar` e `fechar` o emitem, porque ele sai em `principal`, sem teste (`tools/ia/avaliar-modelos.ts:1698` e `:1700`). Vale extrair a mensagem final de cada etapa para uma função testável.
3. Os mutantes `true ? lido.data.texto` e `if (false) return undefined` ficam vermelhos por `TypeError` dentro de um caso que rodou. Isso vale, mas um caso que confira o resultado esperado deixaria o motivo do vermelho explícito.

Arquivos relevantes:
- tools/ia/lotes-retidos.ts
- tools/ia/lotes-retidos.test.ts
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- packages/core/src/ia/modelos-aprovados.ts
- packages/core/src/ia/modelos-aprovados.test.ts
- tasks/prd-reserva-e-avaliacao/13_task.md
