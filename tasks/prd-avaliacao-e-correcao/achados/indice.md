# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-23 12:59:54 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Dado sem rota (§9 contra §4). "Antes de começar" mostra "Esta prova tem 40 minutos". O aluno com +50% deve ver 60, e a §9 não diz de onde esse valor vem. |
| 2026-11-23 13:01:09 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §5, passo 2 (Começar), e cenarios.md §1 RF10. A ordem escrita confere a janela antes do convocado: "fora da janela, `PROVA_FORA_DA_JANELA`; não… |
| 2026-11-23 13:02:14 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Nenhuma rota nova tem cenário na escola sem ano letivo em curso, nem na virada (cenarios.md §1 e §2; Tech Spec §5.6 e §6). |
| 2026-11-23 13:02:15 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | O tempo adicional por aluno é adaptação, e adaptação é dado sensível (art. 11). O desenho o trata como dado comum. |
| 2026-11-23 13:02:37 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Saída da aba ao vivo, sem o aviso fixo. Tech Spec §4 (`GET …/acompanhamento`: "saídas (nome só aqui)") e §7 (DTO do acompanhamento). |
| 2026-11-23 13:02:50 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | §5, passos 6 e 7, e §7c "Dependência cai": a rotina encerra a prova durante a queda da API. A indisponibilidade só é gravada "no primeiro pulso de volta". Com… |
| 2026-11-23 13:09:02 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | `cenarios.md` §4 não tem texto de erro de carregamento para "Antes de começar" e para a prova. Também falta o erro ao tocar em Começar que não seja fora da… |
| 2026-11-23 13:09:16 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | A tabela nova da correção não tem `ano_letivo_id` e rompe o padrão da tentativa. |
| 2026-11-23 13:10:15 | `conformidade-reviewer` | 2ª | REPROVADO | `revisao-spec` | tasks/prd-avaliacao-e-correcao/techspec.md:35 (§3, `saida_da_aba ... chave* uuid, em*`) e docs/lgpd.md:58. |
| 2026-11-23 13:10:21 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | da rodada 1 |
| 2026-11-23 13:10:43 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5.4 e §10, contra `cenarios.md` §1 RF6 e §2: só dois dos chamadores de `limiteDaTentativa` têm cenário com indisponibilidade. |
| 2026-11-23 13:12:02 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Na rodada anterior, o texto dizia "cron `* * * * *`, urgente". Agora diz só "fila `lote`". |
| 2026-11-23 13:14:35 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | Techspec §3, linha 36: escrever as colunas da FK, `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) → tentativa_atividade_uma_por_aluno`, e não só… |
| 2026-11-23 13:15:12 | `privacy-guardian` | 3ª | REPROVADO | `revisao-spec` | techspec §3, item "Ids uuidv7" (linha 40) e bloco da saida_da_aba (linhas 35-36); |
| 2026-11-23 13:15:20 | `conformidade-reviewer` | 3ª | APROVADO | `revisao-spec` | techspec §4 (linha 68) e cenarios §1 RF9: a spec não diz de que versão é a `chave` da saída. Um UUID v7 traz o milissegundo de cada saída e refaria a linha do… |
| 2026-11-23 13:16:49 | `infra-guardian` | 3ª | APROVADO | `revisao-spec` | techspec §5.4 e §5.6, ordem de leitura: `limiteDaTentativa` deve ler o pulso e as indisponibilidades numa consulta só, com uma única visão do banco. Na… |
| 2026-11-23 13:17:11 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | `cenarios.md` §1, linhas 34 e 36 (item 1 não resolvido, e a correção abriu um buraco). |
| 2026-11-23 13:19:18 | `privacy-guardian` | 4ª | APROVADO | `revisao-spec` | v4 provada só na unidade (`cenarios.md` linha 49): o teste roda em `packages/shared`. Se a rota não usar o schema compartilhado, uma v7 passa e nenhum teste… |
| 2026-11-23 13:20:17 | `test-engineer` | 4ª | APROVADO | `revisao-spec` | Tech Spec §5.7 contra a §13 e o `cenarios.md` linha 42. A §5.7 diz que a instância recusa "as rotas do aluno (503)". A §13 diz "rotas de prova". A linha 42… |
| 2026-11-23 16:22:13 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | `atividade-aplicada.repository.ts`, `saveTempoAdicional` e `trocarTempoAdicional`: o banco só garante que o aluno é da mesma escola. Que ele é da turma depende… |
| 2026-11-23 16:22:19 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | `packages/shared/src/atividade/correcao.ts:116`: `destaqueSchema` herda `saidasDaAba` de `correcaoDoAlunoSchema`, então a contagem também vai aparecer na linha… |
| 2026-11-23 16:22:39 | `infra-guardian` | 1ª | APROVADO | `1_task` | `packages/core/drizzle/0068_prova_online.sql:4`: o cabeçalho diz que o `VALIDATE` lê a tabela "com trava que não bloqueia a escrita". Não é verdade aqui. O… |
| 2026-11-23 16:23:17 | `revisor-geral` | 1ª | APROVADO | `1_task` | PATCH numa atividade sem prova. Em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts:105-138`, o `PATCH …/:id/janela` com `{… |
| 2026-11-23 16:23:27 | `test-engineer` | 1ª | REPROVADO | `1_task` | A trava das duas corridas não tem bloco de mutação, e nenhum bloco usa os casos (b) e (k). |
| 2026-11-23 16:24:13 | `privacy-guardian` | 1ª | REPROVADO | `1_task` | `packages/core/src/titular/leitura-do-titular.ts:327` |
| 2026-11-23 16:58:50 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | O teste novo da versão da coordenação (`arquivo-do-titular.int.test.ts:1337`) não tem linha de `tempo_adicional` de outra escola para o mesmo titular. Hoje o… |
| 2026-11-23 16:58:55 | `infra-guardian` | 2ª | APROVADO | `1_task` | A 1ª rodada não exigiu correção. O que mudou desde então não mexe no comportamento: |
| 2026-11-23 16:59:04 | `privacy-guardian` | 2ª | APROVADO | `1_task` | O caso novo prova que `concedido_por` não sai na versão `coordenacao`. Na versão `completa` do aluno isso só está provado pelo `not.toContain(professor.id)` de… |
| 2026-11-23 16:59:26 | `conformidade-reviewer` | 2ª | APROVADO | `1_task` | Quando a 8.0 passar a preencher `saidasDaAba` na correção, o teste da recomendação da 1ª rodada precisa provar três coisas: não cria destaque, não altera… |
| 2026-11-23 17:00:15 | `revisor-geral` | 2ª | REPROVADO | `1_task` | A versão `coordenacao` do arquivo do titular leva o tempo adicional e a contagem de saídas da aba. O PRD e a Tech Spec dizem que a coordenação não vê nenhum… |
| 2026-11-23 17:00:20 | `test-engineer` | 2ª | APROVADO | `1_task` | O vermelho dos blocos (a) e (b) depende do texto da consulta (`%for update%` no `pg_stat_activity`) e de esperar os 15 s do `aguardar`. Fica mais robusto se o… |
| 2026-11-23 20:12:30 | `revisor-geral` | 3ª | APROVADO | `1_task` | `tasks/prd-avaliacao-e-correcao/cenarios.md:63` (RF9) diz "Coordenação e rede: nenhum dos três de aluno". Isso vale para os contratos da API e continua certo.… |
| 2026-11-23 20:12:38 | `test-engineer` | 3ª | APROVADO | `1_task` | A linha "Arquivo do titular" da tabela de testes da tarefa (`tasks/prd-avaliacao-e-correcao/1_task.md:60`) ainda não cita pelo nome os dois casos da versão… |
| 2026-11-23 21:54:23 | `tenancy-guardian` | 1ª | APROVADO | `10_task` | O mock de `mudarJanela` em `e2e/support/assistente.ts` só confere se o id existe e se alguém começou. Não confere se a atividade é avaliativa, se está aberta… |
| 2026-11-23 21:54:47 | `privacy-guardian` | 1ª | APROVADO | `10_task` | Minimização: hoje, marcar "É avaliativa" já busca todos os nomes da turma, mesmo quando ninguém terá tempo adicional (`AplicacaoDoArtefato.tsx:810`, chamado… |
| 2026-11-23 21:54:48 | `frontend-reviewer` | 1ª | APROVADO | `10_task` | `AplicacaoDoArtefato.tsx:135-139`: o rótulo de cada select é só o nome do aluno ("Ana Souza"). Dois alunos com o mesmo nome só se distinguem pela ordem de id,… |
| 2026-11-23 21:54:55 | `conformidade-reviewer` | 1ª | APROVADO | `10_task` | `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx:104` diz ao professor que o tempo adicional "fica registrado com o seu nome". O service grava… |
| 2026-11-23 21:55:18 | `infra-guardian` | 1ª | APROVADO | `10_task` | Durante o deploy, uma aba do professor aberta com o pacote antigo do web manda avaliativa sem janela e recebe `ENTRADA_INVALIDA` com o texto genérico. Como o… |
| 2026-11-23 21:56:06 | `revisor-geral` | 1ª | APROVADO | `10_task` | `tasks/prd-avaliacao-e-correcao/10_task.md:56`: a linha "Estados" cita o caso `e2e/professor-aplicacao.spec.ts › a lista do tempo adicional diz que carrega…`,… |
| 2026-11-23 21:56:30 | `test-engineer` | 1ª | REPROVADO | `10_task` | `e2e/professor-turma-atividades.spec.ts:152`, o caso "com alguém começado, o painel diz a prova e não oferece mudar a janela". Duas linhas da tabela de testes… |
| 2026-11-23 22:23:58 | `privacy-guardian` | 2ª | APROVADO | `10_task` | As da 1ª rodada estão registradas no `TODO.md` com dono: a lista de nomes carregada só ao abrir "Marcar tempo adicional", e a frase do `docs/lgpd.md:60` sobre… |
| 2026-11-23 22:24:29 | `frontend-reviewer` | 2ª | APROVADO | `10_task` | A janela da prova usa `datetime-local`, e nas fotos o campo aparece como `mm/dd/yyyy, --:-- --`. É o idioma do navegador da vitrine, e o controle nativo segue… |
| 2026-11-23 22:24:40 | `revisor-geral` | 2ª | APROVADO | `10_task` | `e2e/support/assistente.ts:169`: o import aponta direto para `packages/shared/src/atividade/atividade-aplicada.ts`, e o resto do arquivo importa de… |
| 2026-11-23 22:24:45 | `conformidade-reviewer` | 2ª | APROVADO | `10_task` | Fica a da 1ª rodada, já registrada no `TODO.md`: escrever na AIA da correção de objetiva (ou em `docs/regulacao.md`) que "Aplicar" conta como a aprovação da… |
| 2026-11-23 22:24:48 | `test-engineer` | 2ª | APROVADO | `10_task` | `10_task.md:80` (item 7): o texto ainda diz que o pedido único do `MudarJanela` é "provado pelo `dblClick` do componente". Agora são dois cliques dentro do… |
| 2026-11-23 22:24:57 | `infra-guardian` | 2ª | APROVADO | `10_task` | `e2e/support/assistente.ts:179-186`: o mock agora responde na mesma ordem da API de verdade (`ATIVIDADE_ENCERRADA`, depois `PROVA_JA_COMECOU`, depois… |
| 2026-11-23 21:37:32 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | 503 igual para todos sem teste que o prove. Em `apps/api/src/atividade/pulso/pulso.int.test.ts:318`, acrescentar ao caso do `+31 s` uma chamada com id de… |
| 2026-11-23 21:37:38 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | Para o `infra-guardian` e a regra 80, não para a regra 70: a recusa é decidida em cada instância, mas a lacuna só é gravada a partir do pulso global no banco.… |
| 2026-11-23 21:37:46 | `privacy-guardian` | 1ª | APROVADO | `2_task` | `packages/core/src/retencao/expurgo-de-acesso.repository.ts:38`: o comentário de `RETENCAO_INDISPONIBILIDADE_MESES` cita `docs/lgpd.md` como fonte do prazo,… |
| 2026-11-23 21:38:46 | `revisor-geral` | 1ª | APROVADO | `2_task` | Texto da Tech Spec, §5.7 (`tasks/prd-avaliacao-e-correcao/techspec.md:103`): ainda diz "recusa as rotas do aluno (503)". A rodada 4 do `revisao-spec.md` mandou… |
| 2026-11-23 21:38:54 | `infra-guardian` | 1ª | APROVADO | `2_task` | `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts:21`: o 503 sai sem `Retry-After`. O `hash-bulkhead.ts` e o `challenge.ts` já mandam `Retry-After` com… |
| 2026-11-23 21:40:27 | `test-engineer` | 1ª | REPROVADO | `2_task` | O bloco do `for update` fica vermelho pelo motivo errado. |
| 2026-11-23 22:06:20 | `revisor-geral` | 2ª | APROVADO | `2_task` | No caso novo "`encerrar` devolve a conexão retida" (`apps/api/src/atividade/pulso/pulso.int.test.ts:164`), o pool criado não entra em `pools`. Se o caso… |
| 2026-11-23 22:07:15 | `test-engineer` | 2ª | APROVADO | `2_task` | `pulso.int.test.ts:165`: o pool do caso de `encerrar` não entra em `pools`. Com a mutação aplicada, ninguém o encerra depois do vermelho e a conexão fica… |
| 2026-11-24 00:17:50 | `tenancy-guardian` | 1ª | APROVADO | `5_task` | `apps/api/src/atividade/extensao.int.test.ts:532`: o caso "nos repositories" testa o id da A com contexto trocado, mas não o contrário (contexto da A com uma… |
| 2026-11-24 00:17:54 | `conformidade-reviewer` | 1ª | APROVADO | `5_task` | Para a tela da 11.0. O acompanhamento é relido a cada 15 s. A tela deve continuar mostrando só a situação e o "termina às". Não deve acrescentar tempo desde a… |
| 2026-11-24 00:18:17 | `privacy-guardian` | 1ª | APROVADO | `5_task` | `packages/core/src/titular/leitura-do-titular.ts:345` filtra por `aluno_id = titular`, então a extensão dada à turma toda (aluno nulo) não aparece no arquivo… |
| 2026-11-24 00:18:55 | `revisor-geral` | 1ª | REPROVADO | `5_task` | `tasks/prd-avaliacao-e-correcao/cenarios.md`, §1, linhas 27 a 30 (bloco RF4). A tabela "Divergências resolvidas" do `5_task.md`, linha 94, declara a segunda… |
| 2026-11-24 00:19:00 | `infra-guardian` | 1ª | APROVADO | `5_task` | `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts:177`: a mesma `chave` com outro conteúdo (outro aluno ou outros minutos) devolve em… |
| 2026-11-24 00:22:36 | `test-engineer` | 1ª | REPROVADO | `5_task` | Uma mutação aponta para um caso que não olha o que ela muda. O bloco que tira `\|\| linha.nome === null` (`apps/api/src/atividade/atividade-aplicada/acompanhame… |
| 2026-11-24 01:39:09 | `revisor-geral` | 2ª | APROVADO | `5_task` | A `techspec.md` §4 (linha 74) ganhou duas frases novas que nenhuma linha do `cenarios.md` nomeia: |
| 2026-11-24 01:41:46 | `test-engineer` | 2ª | APROVADO | `5_task` | O caso `› dois alunos com o mesmo nome` (`extensao.int.test.ts:124-137`) não prova o desempate `asc(vinculo.usuarioId)` (`acompanhamento.repository.ts:107`). |
