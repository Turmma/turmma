# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-10-13 08:36:46 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec seção 9 ("Peças novas") e seção 5 ("Rever"), tarefa 9.5, 10.3 e 11.3: a `BemVindo` não tem estados definidos. |
| 2026-10-13 08:37:12 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec, seções 6 e 10: a regra de que cada um só grava a própria data fica sem prova. Os quatro testes da seção 6 e o "repetida, em paralelo, por papel" da… |
| 2026-10-13 08:38:25 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec, seção 7c ("Carga na manhã de segunda" e "Métrica, alerta, teste de carga"), e seção 9 ("Início"). A spec trata a requisição nova do Início como leve… |
| 2026-10-13 08:38:42 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §7b, PRD RF14 e tarefa 9.1: o aviso promete uma coisa e o sistema faz outra, e o teste da RF14 prende o texto errado. |
| 2026-10-13 08:38:59 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | B1. Tech Spec §9 ("Peças novas"), PRD RF19 e tarefa 5.1: a onça das poses pode ter expressão. |
| 2026-10-13 08:40:02 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Tarefa 1.0, Tech Spec §6 e §10: falta o caso da escola sem ano letivo em curso. |
| 2026-10-13 08:48:42 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | Com zero tarefas, o Início não oferece rota até o Tutor, porque a conversa é sempre atrelada a uma atividade (`EscolhaDaAtividade`, `Tutor.tsx:147`). Isso é o… |
| 2026-10-13 08:49:52 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | O PRD promete mais do que a saída escolhida entrega. |
| 2026-10-13 08:49:57 | `conformidade-reviewer` | 2ª | APROVADO | `revisao-spec` | Tarefa 6.0: pôr o texto da `Comemoracao` ("Atividade entregue.", "Quem dá a aula vê a correção antes de você.") no mesmo teste de falas da regra 70, item 4a.… |
| 2026-10-13 08:50:26 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §3 ("Primeira saída") e §12b item 1; tarefa 1.0, subtarefa 1.2 e caso "duas escolas" ("devolve a data e a grava na linha de B"). |
| 2026-10-13 08:50:36 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §7b, PRD RF14 e tarefa 9.1 (frase "A escola escolhe por quanto tempo guarda: de 6 a 24 meses.", e a linha "texto do aviso" da tabela de testes da… |
| 2026-10-13 08:50:58 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §7c ("Métrica, alerta, teste de carga"), §10 ("Carga") e tarefa 3.1 (`tasks/prd-telas-do-aluno-e-primeiro-acesso/3_task.md`): o cenário novo não… |
| 2026-10-13 08:55:39 | `test-engineer` | 3ª | APROVADO | `revisao-spec` | `tasks.md:10` não acompanhou a correção. A subtarefa 1.2 ainda diz "copia a emprestada para a própria linha", que é o contrário da Tech Spec §3 ("nunca grava o… |
| 2026-10-13 08:55:39 | `privacy-guardian` | 3ª | APROVADO | `revisao-spec` | `tasks.md`, item 1.2, contradiz a Tech Spec. Diz que o GET "copia a emprestada para a própria linha", que é justamente o desenho recusado na rodada 2. O teste… |
| 2026-10-13 08:55:43 | `tenancy-guardian` | 3ª | REPROVADO | `revisao-spec` | `tasks.md` 1.2 e Tech Spec §7c ("Carga na manhã de segunda"). |
| 2026-10-13 08:56:23 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | O limite de p95 que deveria valer na rajada não existe. Afeta a Tech Spec §7c ("Métrica, alerta, teste de carga"), a §10 ("Carga") e a subtarefa 3.1 de… |
| 2026-10-13 08:58:13 | `tenancy-guardian` | 4ª | APROVADO | `revisao-spec` | Sobrou uma recomendação da rodada 3 sobre o método da leitura entre escolas, e a `1_task.md` 1.2 agora se contradiz por dentro: |
| 2026-10-13 08:58:20 | `infra-guardian` | 4ª | APROVADO | `revisao-spec` | Limite por rota. O p95 da rajada mistura, por conta, três `GET /v1/sistema/contexto` com um `/v1/eu` e um `minhas-atividades`. Uma `minhas-atividades` lenta em… |
| 2026-10-16 08:36:43 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | `ResolucaoDeTenantRepository` passa a ter mais um método `@SemEscopo`. O total já passava de três antes desta tarefa, e cada um tem justificativa e teste.… |
| 2026-10-16 08:37:10 | `infra-guardian` | 1ª | APROVADO | `1_task` | `tasks/prd-telas-do-aluno-e-primeiro-acesso/techspec.md:150`: falta um ponto final antes de "A gravação do `GET /v1/eu`". A frase nova está colada na anterior. |
| 2026-10-16 08:37:21 | `privacy-guardian` | 1ª | APROVADO | `1_task` | Em `packages/nucleo/src/titular/leitura-do-titular.ts:94`, a versão `coordenacao` tira a data também do aluno, e a D64 só pede isso para o professor. Essa… |
| 2026-10-16 08:38:35 | `revisor-geral` | 1ª | REPROVADO | `1_task` | Log novo que a Tech Spec não prevê. Em `apps/api/src/sessao/eu.service.ts:20`, o `#avisar` chama `this.#logger.warn('eu.introducao_nao_gravada')`, e… |
| 2026-10-16 08:38:45 | `test-engineer` | 1ª | REPROVADO | `1_task` | `apps/api/src/sessao/eu.service.ts:38`: a cláusula `emprestada !== null` em `if (propria === null && emprestada !== null)` não tem bloco de mutação. É a… |
| 2026-10-16 08:46:53 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | Antes, na versão da coordenação, a coluna `introducao_vista_em` nem aparecia na linha do professor. Agora ela aparece com valor nulo. Não vaza dado, mas mostra… |
| 2026-10-16 08:47:08 | `infra-guardian` | 2ª | APROVADO | `1_task` | A nova mutação em `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md` grava em todo GET sem data, mesmo sem data vinda de outra escola. Ela é o que impede… |
| 2026-10-16 08:47:14 | `privacy-guardian` | 2ª | REPROVADO | `1_task` | `docs/lgpd.md:103`, coluna de retenção, diz: "vai no arquivo do titular, exceto na versão `coordenacao` (a data do professor não vai à coordenação, D64)". Lida… |
| 2026-10-16 08:47:35 | `revisor-geral` | 2ª | REPROVADO | `1_task` | O mapa de dados ficou contradizendo o código depois da correção 2. Em `docs/lgpd.md:103`, a coluna de retenção da linha "Introdução vista" diz: "vai no arquivo… |
| 2026-10-16 08:48:02 | `test-engineer` | 2ª | APROVADO | `1_task` | da 1ª rodada, conferidas: |
| 2026-10-16 08:54:10 | `privacy-guardian` | 3ª | APROVADO | `1_task` | Em `leitura-do-titular.ts:95`, a condição do `case` está escrita como "papel = aluno", quando a D64 só exclui o professor. Hoje isso não muda nada, porque a… |
| 2026-10-16 08:54:16 | `revisor-geral` | 3ª | APROVADO | `1_task` | Continua aberta a recomendação da 2ª rodada sobre o titular de papel `coordenacao`. O `case` em `leitura-do-titular.ts:95` também tira dele a data na versão… |
