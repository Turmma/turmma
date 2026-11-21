# Cenários — Camada de IA

> Acompanha `techspec.md`. Cada linha diz o teste, a camada e o que o derruba. Os nomes de arquivo são os prováveis;
> a tarefa fixa o caminho. Nenhum cenário chama provedor pago: o principal e a reserva são `FakeAdapter`s com
> `provedorId` distintos, ou um adaptador de teste que falha sob comando.

## 1. Por RF

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF1 | Reserva sem suboperador vigente: o worker sobe, a conferência do principal passa, `ia.reserva.conferida = 0`, e uma chamada com o principal fora termina `IA_INDISPONIVEL` sem chamar a reserva | integração, `apps/api/src/ia/reserva-na-subida.int.test.ts` | tirar o `elegivel()` da reserva no gateway |
| RF1 | A conferência da reserva passa depois de o cadastro ser corrigido, sem reiniciar, e a chamada seguinte com o principal fora vai à reserva | idem | conferir uma vez só |
| RF2 | Reserva conferida para `material_da_escola` só, com `IA_RESERVA_TAREFAS=gerar_atividade_objetiva,turno_do_tutor`: a subida da reserva recusa (`categoria_faltando:conversa_do_aluno`) | unidade, `packages/core/src/ia/soberania.test.ts` | exigir só as categorias do principal |
| RF2 | Lista `gerar_atividade_objetiva`, principal fora: a geração vai à reserva; o turno do Tutor termina indisponível, sem chamar a reserva | unidade, `llm-gateway.test.ts` › "reserva" | trocar o teste de pertença à lista por `true` |
| RF3 | Disjuntor do principal aberto: a chamada vai à reserva e a saída é a da reserva | `llm-gateway.test.ts` | tirar o ramo da queda |
| RF3 | Principal com `IA_TEMPO_ESGOTADO` e o sinal da execução **já abortado**: não chama a reserva | idem | tirar `!sinal.aborted` |
| RF3 | Sem vaga no principal (balde cheio) e sem modelo menor: reserva no balde `reserva:modelo` e chama; sem vaga também ali: `IA_INDISPONIVEL`, `sem_vaga` | `llm-gateway.test.ts`, `token-limiter` falso | usar o balde do principal para a reserva |
| RF3 | A saída inválida da reserva repete **na reserva** (a segunda chamada tem o `provedorId` dela) | idem | repetir no principal |
| RF4 | `turno_do_tutor` fora da lista e principal fora: indisponível; a regra fixa da D36 responde igual com os dois fora | `llm-gateway.test.ts`, `turno-do-tutor.test.ts` | — (é o RF2 para o Tutor; fica como caso próprio porque é o risco maior) |
| RF5 | Primeira saída inválida no principal e a segunda válida: duas linhas, a primeira `falhou`/`IA_SAIDA_INVALIDA`, cada uma com os seus tokens e custo; `entrada` e `saida` só na segunda | integração, `apps/api/src/ia/ia.int.test.ts` | gravar uma linha por execução |
| RF5 | Chamada pela reserva: `provedor = IA_RESERVA_PROVEDOR_ID`, `pela_reserva = true`; o compartilhamento do aluno lista o suboperador da reserva | `apps/api/test/arquivo-do-titular.int.test.ts` (caso novo) | gravar o provedor do principal |
| RF5 | Governança com uma execução de duas linhas: `execucoes = 1` | `governanca.int.test.ts` | `count(*)` |
| RF6 | 3.000 + 250 tokens, preço 1.300 e 5.200 micros por mil: custo = `ceil(3.000 × 1.300 / 1.000 + 250 × 5.200 / 1.000)` = 5.200 | unidade, `consumo.test.ts` | `round` no lugar de `ceil` (caso com fração) |
| RF6 | `AMBIENTE=producao`, `openai_compat` e modelo sem preço: a subida recusa citando a variável | `llm-config.test.ts`/`llm-gateway.test.ts` | exigir preço só do menor |
| RF6 | A linha da interrompida leva o custo do teto da tarefa | `consumo.test.ts` | custo zero na estimada |
| RF7 | Escola sem valor, rede com R$ 5: orçamento pela rede, `origemDoValor = rede`; escola com R$ 3: vale 3 | unidade, `orcamento-de-ia.test.ts`; integração, `painel-escrita.int.test.ts` | inverter a precedência |
| RF7 | `PUT` grava `escola.orcamento_ia_alterado` com `antes`, `depois` e o operador; a mesma `chaveEnvio` não audita de novo | `painel-escrita.int.test.ts` | auditar fora da transação |
| RF8 | 100 alunos ativos, R$ 5, R$ 400 no mês civil de São Paulo: 80%; a chamada de 23h30 do dia 31 em UTC-3 conta no mês certo | `orcamento-de-ia.test.ts`, `orcamento-do-mes.repository.int.test.ts` | somar pelo mês em UTC |
| RF8 | Aluno com vínculo encerrado não conta; o que chegou hoje conta | `orcamento-do-mes.repository.int.test.ts` | tirar o filtro de vínculo encerrado |
| RF9 | A medida publica 0,79 → 0,81 → 1,02; os alertas de 80% e 100% têm a expressão e o parágrafo do runbook | `apps/worker/test/orcamento-gauge.int.test.ts`, `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | — |
| RF9 | Acima de 100%, o turno do Tutor e a ferramenta (`interativa`, `ferramenta`, `normal`) são atendidos | `orcamento-teto.int.test.ts` | conferir o teto em toda fila |
| RF10 | Acima de 200%, a execução de lote volta a `pendente` com `JobAdiadoError(orcamento)`, sem tentativa; abaixo, segue | integração, `apps/api/src/ia/orcamento-teto.int.test.ts` | `>=` trocado por `>` (caso no limite exato) |
| RF10 | Escola `sem_orcamento` ou `sem_aluno_ativo`: o lote nunca é adiado pelo teto | idem | tratar orçamento zero como teto zero |
| RF11 | `GET /v1/operacao/uso-ia` sem campo de pessoa (contrato estrito), ordem por custo, `pelaReserva` somado | `painel-leitura.int.test.ts`, `apps/api/test/contracts.test.ts` | — |
| RF12 | A resposta da coordenação não tem `tokens*` nem `custoMicros` (o schema estrito recusa); `parte` soma 100 (± arredondamento) | `governanca.int.test.ts`, `packages/shared/src/governanca/governanca.test.ts` | devolver `custoMicros` |
| RF13–16 | A ferramenta recusa rodar sem `AVALIACAO_*`; grava o sha256 das amostras; não importa nada de teste; nenhum teste a executa contra rede | unidade, `tools/ia/avaliar-modelos.test.ts` | — |

## 2. Isolamento

- **A soma do mês:** a escola A com R$ 100 e a B com R$ 900, no mesmo mês. A porcentagem de A conta só os R$ 100. Com o
  `eq(consumoIa.escolaId, …)` tirado do repository, ela passa a contar B e o teste fica vermelho
- **O teto:** a escola B acima do teto e a A abaixo. O lote de A segue e o de B é adiado
- **A Operação:** a sessão de coordenação em `GET /v1/operacao/uso-ia`, em `PUT …/escolas/:id/orcamento-ia` e em
  `PUT …/redes/:id/orcamento-ia` recebe 404, com o mesmo corpo do id inexistente (`operacao-isolamento.int.test.ts`)
- **A coordenação:** a de A, em `GET /v1/governanca/consumo`, vê a porcentagem de A com o consumo de B semeado

## 3. Corrida

| Trava | Ordem forçada | O que se espera | O que a deixa vermelha |
|---|---|---|---|
| Dois `PUT` do orçamento da mesma escola, com chaves diferentes | o primeiro segura a linha (`WriteBlockTrigger`); o segundo chega e espera | vale o segundo, há duas auditorias, nenhum 500 | tirar o `on conflict (escola_id) do update`: o segundo cai com 23505 |
| O mesmo `PUT` duas vezes (mesma `chaveEnvio`) | em paralelo, `esperarNaTrava` na primeira | uma auditoria, a mesma resposta | tirar a conferência da chave |

## 4. Telas

Textos a fixar em `docs/interface.md` 5 na tarefa da tela. Os da coordenação seguem a D40: nada é cortado, e sem
"crédito".

- **Coordenação, Painel e Governança:**
  - `definido`: "IA do mês: 62% do previsto."
  - aviso de 80: "A escola já usou 80% do previsto para a IA neste mês. Nada é cortado."
  - aviso de 100: "A escola passou do previsto para a IA neste mês. Nada é cortado, e a equipe Turmma vai conversar
    com vocês se isso se repetir."
  - `sem_orcamento`: "O previsto de IA da escola ainda não foi definido."
  - `sem_aluno_ativo`: "A porcentagem aparece quando a escola tiver aluno ativo."
- **Governança, por função:** "Assistente de ensino: 41% do que a IA trabalhou no mês · 128 execuções". Sem token e
  sem R$
- **Operação, Uso:**
  - o grupo "IA" tem o título "IA (hoje, até agora, e mês)";
  - célula sem orçamento: "sem orçamento definido";
  - escola sem aluno: "sem aluno ativo";
  - "Ver meses" abre a lista dos 12 meses anteriores.
- **Operação, diálogo "Orçamento de IA":**
  - "Valor por aluno por mês (R$)", "Teto de segurança (% do orçamento)", e a caixa "Usar o valor da rede";
  - "Vale hoje: R$ 5,00 por aluno, da rede.";
  - o resultado: "Orçamento salvo."; o 429 diz em quantos minutos tentar de novo;
  - valor fora do intervalo: "Use um valor entre R$ 0,01 e R$ 100,00." / "Use de 100% a 1000%."

Estados de toda tela: carregando, vazio, erro com "Tentar de novo", com dado. Fotos nos projetos `chromebook` e
`celular`. O e2e de cada tela fica em `e2e/operacao-uso.spec.ts`, `e2e/operacao-escolas.spec.ts`,
`e2e/painel-da-coordenacao.spec.ts` e `e2e/governanca.spec.ts` (casos novos).

## 5. Carga

A fase `reserva` do `carga.ts`: a meio da fase, o principal falso começa a falhar 100% (`IA_FALHA_FALSA=principal`) e
a reserva falsa atende.

- **Passa quando:** o p95 do turno do Tutor fica até 1 s acima do da fase `sala`; nenhum aluno recebe erro além dos
  das 5 primeiras chamadas antes de o disjuntor abrir em cada réplica; e `ia.degradacao{degrau="reserva"}` sobe.
- **Controle negativo:** a mesma fase com `IA_RESERVA_TAREFAS` vazia reprova.
