# TODO fora do código

O que trava o projeto e não se resolve programando. Vários têm prazo externo.

## LGPD e conformidade — prioridade máxima

- [ ] Contrato de tratamento de dados escola↔nós, com advogado (escola controladora)
- [ ] Contrato com provedor de IA vedando treinamento com nosso dado
- [ ] Política de privacidade e termos, com seção de menor de idade
- [ ] Indicar encarregado (DPO) e publicar canal de contato
- [ ] Relatório de impacto (RIPD) — dado de menor, volume alto, IA no fluxo
- [ ] Definir prazos de retenção com uma escola real (varia por rede)
- [ ] O pedido do titular (acesso e portabilidade, F3, `ciclo-de-vida.service.ts`) cobre também a `lista_nome` e a
      `reivindicacao` da A1, para a pergunta de fechamento da regra 20 continuar respondida por código: o pedido se liga
      ao aluno por `lista_nome_id` enquanto a linha da lista existe, e depois do `set null` já não se liga a ninguém
      (`privacy-guardian` na 6.0)
- [x] O expurgo dos pedidos de reivindicação decididos (e dos fechados como `encerrada` na virada do ano), com a retenção
      configurável por escola (regra 20, item 16). Feito no F3, tarefa 5.0: a categoria `reivindicacao_decidida` os apaga
      60 meses (12 a 60) depois da decisão, ou da solicitação no `encerrada`, no `retencao.expurgar-escola` (A1, tarefa 10.0)
- [ ] Escrever e ensaiar o processo de incidente
- [ ] Parecer sobre o ECA Digital (Lei 15.211/2025) para plataforma contratada pela escola,
      com a avaliação de impacto que ele exige. Três perguntas precisam sair dele, nomeadas:
      **(a)** o art. 24 alcança serviço educacional contratado pela escola? Se sim, conta de
      aluno de até 16 anos precisa estar vinculada à de um responsável legal, e o portal da
      família sai da fase posterior (**bloqueia o PRD do F9**, `docs/regulacao.md` 2.2);
      **(b)** como os arts. 17 e 18 (supervisão parental) se modulam pelo art. 39 no nosso
      caso; **(c)** a aferição de idade pela série informada pela escola basta, com o art. 24
      do Decreto 12.880 como fundamento de proporcionalidade? **(d)** ligar a busca do Tutor em
      fontes aprovadas para aluno de até 16 anos, sem conta de responsável vinculada, conta
      como rebaixar a proteção (art. 24, § 5º; D68)? **(e)** a contagem de saídas da aba
      durante avaliação é proporcional, e algo parecido pode existir fora de avaliação (D70)?
- [ ] **Avaliação de Impacto Algorítmico** escrita para cada funcionalidade de alto risco —
      Tutor, correção de objetiva, diagnóstico por habilidade, sinais e alertas, adaptação —
      no roteiro de seis etapas de `docs/conformidade-mec.md` seção 7 (D60). Cada uma antes do
      PRD da sua funcionalidade, não no F16. Ficam em `docs/aia/` (índice no `README.md` de
      lá); o Joaquim escreve o rascunho da etapa 1 e o Gabriel revisa
- [ ] **Dossiê de conformidade** da escola (D61): declaração de propósito com faixas etárias,
      funcionamento em linguagem simples com fluxograma, conformidade LGPD e ECA artigo por
      artigo, RIPD, AIA, relatório de uso legível, material de comunicação com a comunidade
- [ ] **Aviso de privacidade em linguagem de faixa etária**, para aluno de 11 anos (exigido
      pelo art. 16 do ECA Digital e pelas cláusulas sugeridas pelo MEC). Não existe hoje
- [ ] Cláusulas do contrato com a escola que o MEC sugere e que ainda não temos:
      responsabilização por incidente, alerta em tempo real ao supervisor quando conteúdo
      proibido for gerado, teste de segurança antes de atualização
      (`docs/conformidade-mec.md` seção 6)
- [ ] Base legal da conversa do tutor e dos sinais, na particular e na pública (Enunciado
      CD/ANPD 1/2023; teste de balanceamento se for legítimo interesse)
- [ ] Indicadores de professor com advogado: CLT, convenção coletiva de cada sindicato
      (SINPRONORTE lida, sem cláusula sobre IA) e estatuto do servidor na rede pública (D45)
- [ ] Contrato com a escola: responsabilidade civil por resposta errada do tutor e direito
      de regresso
- [ ] Protocolo de risco à vida com a escola: quem notifica o Conselho Tutelar (Lei
      13.819/2019, Lei 15.231/2025) e como o sinal chega a essa pessoa
- [x] ~~Decidir região de hospedagem~~ — Brasil (D28)

- [ ] **A lista de nomes colada pela coordenação** (`privacy-guardian` e `revisor-geral`, 13.0 da A1), antes de qualquer
      dado real, a levar para o `/validar` da A1:
      - [x] ~~CPF sem pontuação passa pela trava da prévia~~ — a lista com mais da metade das matrículas, e pelo menos
        duas, em 11 algarismos com dígito verificador de CPF válido tem essas linhas recusadas pela API; o avulso
        sozinho passa (correção `2026-10-03-trava-de-documento-so-na-tela`)
      - colunas a mais (nascimento, CPF, telefone numa exportação da secretaria) trafegam no corpo da prévia e da
        gravação, sem serem gravadas nem logadas: a tela avisar, ou recortar para nome e matrícula antes de enviar
      - a sessão que vence com a lista colada na tela: hoje o texto e a prévia somem porque a consulta da turma volta a
        pendente (seguro para a pessoa seguinte, e o rascunho de quem volta se perde). Decidir se o rascunho sobrevive
        para a mesma pessoa, e ter um e2e do caso "outra pessoa" (nenhum nome nem matrícula atrás do login por cima)
      - [x] ~~a trava de CPF ou data existe só na tela~~ — a regra foi para o contrato
        (`packages/shared/src/estrutura/documento-na-matricula.ts`), e a API recusa na prévia
        (`matricula_parece_documento`), na gravação da lista e no avulso (`ENTRADA_INVALIDA`) (correção
        `2026-10-03-trava-de-documento-so-na-tela`, G2). A saída para o falso positivo segue no item abaixo, e no
        servidor ela pesa mais
      - a trava de documento não tem saída para falso positivo: a escola cuja matrícula tenha forma de data
        (`2026-02-01`, `1/2/26`) não consegue gravar, nem pela lista nem pelo avulso, e o texto não diz o que fazer; a
        recusa agora é da API, e nenhum cliente contorna. Perguntar o formato da matrícula nas entrevistas do piloto. Junto, o motivo de não
        gravar diz "a segunda coluna" mesmo com uma linha só; "enquanto houver matrícula que pareça CPF ou data de
        nascimento" serve aos dois (`frontend-reviewer`, correção `2026-10-03-trava-de-documento-so-na-tela`)
      - o CPF que o Excel exporta como número perde o zero à esquerda (`012.345.678-90` vira `1234567890`, 10
        algarismos), e `pareceCpfSemPontuacao` não o reconhece: na coluna inteira de CPF a lista já é recusada pelas
        outras linhas, mas, se a coordenação apagar só as marcadas, as de 10 algarismos ficam abaixo da maioria e gravam.
        Completar com zeros à esquerda antes de conferir o dígito, com o falso positivo medido (`test-engineer` da
        correção `2026-10-03-trava-de-documento-so-na-tela`)
      - e2e da coluna com maioria de CPF sem pontuação na tela (`test-engineer` e `frontend-reviewer` da mesma
        correção): hoje provada na integração e na unidade da web; o job de e2e está perto do teto de 45 min, e o caso
        entra quando o e2e da lista for dividido
      - `Cache-Control: no-store` nas respostas nominais da API (`/retro` da A1, registrado no `2_task.md`): a web já
        pede sem cache (`cache: 'no-store'` no `chamarApi`, 13.0); falta o cabeçalho, para qualquer outro cliente
- [ ] **(F3, 18.0) O resumo de "Meus dados" conta só as categorias de prazo configurável** (`privacy-guardian`, 1ª rodada):
      credencial, sessão e registro de acesso com IP (`retencao.ts:91-100`) ficam fora da contagem. Decidir com a 13.0 entre
      dizer na tela que o arquivo traz também esses registros e contá-los na API; depende do que o arquivo realmente contém
      (dono: Joaquim)
- [ ] **(F3, 18.0) Conferir o `EFEITO_DE_BAIXAR` contra o arquivo montado na 13.0** (`privacy-guardian`, 1ª rodada): o texto diz
      "as suas conversas com a IA" aos dois papéis; confirmar que o arquivo do aluno traz a conversa do Tutor dentro da
      retenção. A tela não muda sem essa conferência (dono: Joaquim)
- [ ] **(F3, 18.0) Rever os rótulos mais técnicos do resumo de "Meus dados"** (`frontend-reviewer`, 2ª rodada; diagnóstico do
      Arquiteto): "As chamadas ao modelo de IA que o seu uso gerou" e "Os materiais da escola que você enviou ou excluiu"; e
      "As suas respostas e as correções das suas atividades", cuja contagem é a de atividades começadas
      (`tentativa_atividade`), e não a de respostas. Rever junto da conferência do arquivo da 13.0, no item acima
      (dono: Joaquim)
- [x] **(F3, 13.0) O resumo do arquivo do titular diz "Os pedidos de entrada na turma que você fez ou decidiu"** — *resolvido na correção `2026-10-10-resumo-do-arquivo-do-pedido-de-entrada`: o texto do arquivo é o da tela, e a consulta diz que o pedido recusado antes entra de propósito. O rótulo por papel ficou de fora: o texto com os dois caminhos é verdadeiro para os dois, e um por papel muda a forma de `LeituraDaTabela` (desenho).*
      (`packages/nucleo/src/titular/leitura-do-titular.ts`, `LEITURAS_DO_ARQUIVO.reivindicacao.descricao`), e a consulta do
      aluno traz todo pedido feito no nome dele na lista, inclusive o recusado antes, que pode ser de outra pessoa (a recusa
      devolve o nome a `livre` e o pedido continua na linha: `devolverNome`, `apps/api/src/sala/decisao.repository.ts`). A
      tela da 18.0 diz "feitos com o seu nome ou decididos por você": alinhar o texto do arquivo e o comentário da consulta
      ("o pedido que o aprovou") por `/corrigir`, antes da validação do F3. Ao alinhar, escreva na consulta que o pedido
      recusado antes naquele nome entra de propósito e não identifica outra pessoa (`privacy-guardian`, 3ª rodada).
      Considere um rótulo por papel na tela: o aluno nunca decide um pedido, e "…ou decididos por você" só vale para o
      professor (`frontend-reviewer`, 3ª rodada) (diagnóstico do Arquiteto, 18.0)
      - Sobrou da correção, para a **validação do F3** (`test-engineer` e `privacy-guardian`, 1ª rodada): (a) o mesmo texto da
        `descricao` vive em `leitura-do-titular.ts` e em `apps/web/src/componentes/meus-dados/regras.ts`, cada um com seu teste, e
        nada confere que os dois são iguais: fonte única em `packages/shared` ou teste que confronte os dois, junto da decisão
        de desenho da forma de `LeituraDaTabela`; (b) teste de integração em que o aluno aprovado depois de uma recusa no mesmo
        nome recebe os dois pedidos no arquivo, sem `decidida_por` nem `teve_matricula_errada` (o seed de
        `apps/api/test/pedido-titular.int.test.ts` só tem o pedido aprovado).

## Infra e operação

- [ ] **Migrations 0025, 0026 e 0027 (F3, tarefas 3.0 a 5.0) antes do staging:** o check `job_registro_chave_so_com_escola`
      entrou direto e percorre `job_registro` com a trava `ACCESS EXCLUSIVE` (a fila quente, 7 dias de jobs); os índices
      `(escola_id, <data>)` de `mensagem_tutor`, `sinal_tutor` e `mensagem_agente` (0025), os cinco índices parciais de
      anonimização em `execucao_agente`, `consumo_ia` e `artefato` (0026) e os nove da 0027 (`tentativa_atividade
      (escola_id, aluno_id)`, `(escola_id, material_id)` em `mensagem_tutor` e `sinal_tutor`, e os parciais de
      `reivindicacao`, `material`, `usuario` e `vinculo`, mais `execucao_agente (escola_id, solicitada_por)` e
      `artefato (escola_id, criado_por)`) entraram sem `concurrently`. Com dado
      sintético, cabe; a partir do staging, **toda** migration nova leva cada check em arquivo próprio com `NOT VALID` e
      `VALIDATE`, e índice com `concurrently` fora de transação (Tech Spec do F3, seção 7c). O `migrar` usa o
      `statement_timeout` de 2 s da consulta (`packages/nucleo/src/db/migrar.ts`): com volume real, um `CREATE INDEX` em
      `execucao_agente` ou `consumo_ia` passa disso e derruba o deploy, então o prazo do migrador muda junto.
      Os índices de `execucao_agente` e de `mensagem_tutor` são os que mais pesam, porque as duas tabelas crescem por turno
      do Tutor (`docs/infra.md` 3.6); o prazo é o portão do piloto (`infra-guardian` da 3.0, da 4.0 e da 5.0). A 0028 (tarefa 7.0) soma o check
      `consumo_ia_provedor_so_no_envio_externo` em `consumo_ia`, também sem `NOT VALID`: a partir do staging, ele vai em
      arquivo próprio, com `NOT VALID` e depois `VALIDATE` (`infra-guardian` da 7.0)
      A 0035 (F3, tarefa 14.0) entra na lista: o `sessao_motivo_valido` é recriado sem `NOT VALID` e percorre `sessao` sob
      ACCESS EXCLUSIVE, e o `create unique index` de `pedido_titular_agendado_unico` roda sem `concurrently`; a partir do
      staging, o check vai em arquivo próprio, com `NOT VALID` e depois `VALIDATE`, e o índice com `concurrently`, fora do
      horário letivo e com `lock_timeout`.
- [ ] **Escrita a mais por troca do Tutor (F3, 4.0):** `execucao_agente_a_anonimizar_idx`,
      `execucao_agente_do_tutor_a_anonimizar_idx` e `consumo_ia_aluno_a_anular_idx` recebem quase toda linha recente, e
      cada troca do Tutor passa a atualizar índices a mais nas duas tabelas (`infra-guardian` da 4.0). **A 19.0 mediu o custo
      por linha**, e não o do turno inteiro: a fase do expurgo do `npm run carga` insere 20 mil linhas de Tutor com e sem os
      índices, na mesma transação, e imprime os microssegundos a mais por linha (`medirEscritaDosIndices`, informativo, sem
      limite na Tech Spec). **O turno do Tutor da B entrou na fase** (rodada 1 da 19.0): a rota `POST /v1/tutor/mensagens`, com 30
      alunos sintéticos, 1,5 turno por segundo e o adaptador falso de latência simulada (`IA_LATENCIA_FALSA_MS=300`), com o p95
      do turno durante o trabalho da A até 500 ms acima da base. O que **segue aberto** é o cenário "Tutor em sala"
      (`docs/infra.md` 3.2): a semente da B tem só ano, turma e vínculos, sem sala, atividade nem material, então o turno não
      lê trechos do material, e a medida é a de conclusão da execução, não a do primeiro token. Abrir antes do piloto, com o
      p95 do primeiro token. Junto: a fase `base` não exige um mínimo de turnos **no banco** (só o `count>0` do k6), e uma base
      com 1 ou 2 turnos dá um p95 de pouco valor; entra com critério e teste de unidade próprios (`test-engineer` da 19.0).
- [ ] **(F3, 19.0) Contração do check de `provedor` em release posterior ao F3:** a 0028 só expandiu (coluna `consumo_ia.provedor` e o
      check que a prende ao envio externo, validado na própria migration porque toda linha existente tem `provedor` nulo). A
      exigência de `provedor` em toda linha com `envio_externo` vai numa migration de um release **posterior** ao que leva o código do
      F3, em arquivo próprio: `not envio_externo or provedor is not null or em < '<corte>'`, `NOT VALID` e depois `VALIDATE`. O
      `<corte>` é o instante, tirado do registro do deploy, a partir do qual todas as instâncias rodam o código do F3. **O `VALIDATE`
      se mede no volume do staging**: `consumo_ia` é a tabela que mais cresce depois de `execucao_agente`, e o `migrar` roda com o
      `statement_timeout` de 2 s da consulta (`packages/nucleo/src/db/migrar.ts`), então o prazo do migrador muda junto. Pré-condição
      do rollback, já no runbook ("Voltar o código com eliminação agendada em curso"): com a contração aplicada, voltar o código para
      antes do F3 exige antes o `drop constraint` dela (Tech Spec do F3, seção 3; `infra-guardian` da revisão da spec).
- [ ] **(F3, 19.0) O expurgo de 1 milhão de linhas dura segundos, e a fase mede a B durante eles:** no `npm run carga`, o expurgo e a troca de
      nome da escola A terminam em menos de 15 s com 2 CPUs no Postgres; por isso a fase confere a espera da B **só nos jobs que
      nasceram durante o trabalho da A** (pelo menos 10, e 5 turnos do Tutor, que a escola limita a 120 pedidos de IA por minuto),
      e não nos dois minutos do k6. Se o volume do piloto passar de 10 milhões de linhas por escola, subir `VOLUME_DA_A` em
      `infra/scripts/expurgo-da-carga.ts` e rodar de novo; a fase reprova sozinha com poucas amostras da B. O corte do statement
      é de 1,5 s, abaixo do `statement_timeout`, e o statement cancelado pelo timeout (que não aparece no `max_exec_time`) reprova
      pela leitura do log do Postgres. Ainda desse cenário (`infra-guardian`, `revisor-geral`, `tenancy-guardian` e
      `privacy-guardian` da 19.0): (a) o runbook, em "Rodar o cenário de carga", dizer que o statement mostrado na saída é o
      primeiro lugar a olhar, já que o log cobre a fase inteira; (b) `lerStatements(...).catch(() => undefined)` descarta o erro
      sem imprimir, como já fazia o `prepararMedicaoDeStatements` antes da 19.0: imprimir o motivo; (c) `lerStatements` imprime
      até 160 caracteres do texto normalizado com `track=all` e `formasDosStatementsCancelados` imprime o `STATEMENT:` bruto do
      log: só servem ao projeto `educa-carga`, com dado sintético, e reabrem (filtrar `toplevel`, deixar de fora o que não é
      DML) se algum dia rodarem fora dele.
- [ ] **(F3, 19.0) `incidentes.avisados` do `ops:privacidade` herda o teto da lista da coordenação:** o comando conta pelo
      `IncidenteDaEscolaRepository.daEscola`, que limita a `LIMITE_DA_LISTA_DE_INCIDENTES`; uma escola com mais incidentes que o
      teto vê um número menor que o real. Trocar por um `count(*)` no leitor (que é da tarefa da coordenação) quando a primeira
      escola chegar perto do teto; o teto está declarado no comentário de `apps/api/src/ops/privacidade.ts` (`privacy-guardian` e
      `tenancy-guardian` da 19.0)
- [ ] **Alerta de duas noites do expurgo (F3, 3.0):** a noite conta "de ontem para trás", então o alerta dispara à
      meia-noite local (umas 17 h depois de a segunda noite parcial ser conhecida) e segue ligado o dia em que uma noite
      completa roda; numa escola a oeste de São Paulo (Acre, o disparo da 1h cai às 23h locais), uma execução que passa da
      meia-noite divide as categorias entre dois dias e pode dar falso alerta. Avaliar contar a noite pela chave do job (a
      data local do disparo) antes da primeira escola fora do fuso de São Paulo; e trocar a medição de uma consulta por
      escola por uma agrupada quando passar de centenas de escolas (`infra-guardian` e `revisor-geral` da 3.0)
- [ ] **Categoria que falha toda noite segura as seguintes (F3, 3.0):** a linha `false` do lote que falha vira a
      categoria pendente, e a noite seguinte (e cada nova tentativa da fila) começa por ela; se o erro se repete ali, as
      categorias que vêm depois deixam de rodar. O alerta de duas noites dispara, e o runbook cobre (causa 3). Separar a
      linha de falha da de interrupção pela janela (só a interrupção define a pendente), ou seguir para as outras
      categorias antes de subir o erro. Desde a 5.0, a falha pode vir de uma pessoa só em `pessoa_desativada`, e então as
      outras categorias deixam de rodar toda noite. Tratar a separação entre linha de falha e linha de interrupção junto com
      isso, antes do piloto, e não depois (`infra-guardian` da 3.0, 2ª rodada e da 5.0, 3ª rodada, e `revisor-geral` da 5.0)
- [ ] **Ordem das travas entre convidar e eliminar (F3, 5.0):** o `convidar` (`apps/api/src/sessao/convite.service.ts`) trava a conta antes do usuário, e o `CicloDeVidaService` trava o usuário antes da conta. Se a coordenação convida de volta, pelo mesmo e-mail, quem o expurgo está eliminando no mesmo instante, sai deadlock (40P01): nada se corrompe, o expurgo grava `false` e tenta de novo, e o convite é refeito. Alinhar a ordem, ou responder `INDISPONIVEL_TENTE_DE_NOVO` no 40P01 (`infra-guardian` e `test-engineer` da 5.0)
- [ ] **Tempo do lote de 100 pessoas (F3, 5.0):** o «tempo do lote» da 5.0 mediu só a cascata do `trabalho_do_aluno`. Medir o lote de `pessoa_desativada` inteiro (a escolha mais as 100 eliminações, uma transação cada) contra a janela letiva e o `statement_timeout`, com volume de Tutor na escola, antes do piloto (`infra-guardian` da 5.0)
- [ ] **Medição do expurgo depois de o catálogo crescer (F3, 5.0):** `apps/worker/src/medicao-do-expurgo.ts` conta as noites contra o `CATEGORIAS_DO_EXPURGO` atual, que passou de 7 para 12. Num ambiente com noites gravadas com 7, as duas noites anteriores ao deploy contam como incompletas e `expurgo.noites_incompletas` fica em 2 por cerca de um dia e meio. Sem efeito hoje (não há staging); pôr um parágrafo no runbook quando houver (`revisor-geral` da 5.0)
- [ ] **`NAO_ENCONTRADO` do `ops:incidente` sem a posição da seção (F3, 9.0):** o comando responde `NAO_ENCONTRADO: escola não encontrada`
      e não diz qual das escolas do arquivo falhou; num incidente de dezenas de escolas, o operador procura à mão. Citar a posição
      (`a seção N`) muda a saída fixa que `apps/api/test/incidente.int.test.ts` afirma (contrato do comando); fazer quando houver
      operador reclamando.
- [ ] **Encerramento da medição do incidente sem teste (F3, 9.0):** `await medicaoDoIncidente?.encerrar()` em
      `apps/worker/src/montagem.ts` não tem teste próprio (a classe tem; a montagem não): o intervalo de 5 min não é injetável por
      `montarWorker`. Provar exige tornar o intervalo opção da montagem, que é mudança de contrato do worker.
- [x] **Troca de nome da eliminação e o incidente (F3, 15.0):** *resolvido na 15.0: `incidente` e `incidente_escola` ficam fora, com o motivo em `COLUNAS_DA_TROCA_DE_NOME` e em `docs/lgpd.md`.* conferir que `incidente` e `incidente_escola` não precisam entrar
      na troca de nome da eliminação do 8º dia: o registro não guarda texto sobre pessoa, e a regra "nenhum dado de titular" é
      disciplina de quem escreve (runbook, "Ao registrar o incidente"). Se a 15.0 enumerar as colunas de texto livre, a lista
      deve dizer por que estas ficam de fora.
- [ ] **(F3, 15.0) A coordenação como titular:** `pedido_titular.papel_titular` segue `aluno` ou `professor`, e a única coordenadora
      de uma escola que quer a própria eliminação não tem tela nem pedido: a operação a atende pelo ciclo de vida, com o apelido do
      operador. Se virar pedido real, a migration amplia o check, e a prévia dela segue a regra do professor, sem contagem de uso
      (`conformidade-reviewer`, 1ª rodada da 11.0). Decidido na 15.0 como "fora do F3"; reabrir com o primeiro caso.
- [ ] **(F3, 15.0) VALIDATE do check do autor `rotina` em arquivo próprio antes do staging:** a 0036 grava `NOT VALID` e `VALIDATE` no
      mesmo arquivo (o `migrar` roda numa transação), e a `auditoria` é a tabela que mais cresce. A partir do staging, o `VALIDATE`
      de `auditoria_rotina_so_nas_acoes` vai em migration própria, fora do horário letivo, junto dos índices `concurrently`
      pendentes (Tech Spec do F3, seção 7c).
- [ ] **(F3, 15.0) Dois homônimos eliminados no mesmo minuto:** cada job lê o outro como ainda ativo e os dois ficam `homonimo = true`,
      sem troca. É o lado seguro; se aparecer caso real, a troca roda depois do primeiro (a lista de homônimos relida na etapa 3).
- [ ] **(F3, 15.0) `eliminar` com `NAO_ENCONTRADO` falha o job em vez de concluir:** a pessoa que sai por outro caminho entre a leitura
      e a trava faz a tentativa falhar uma vez (a etapa 3 desfaz), e a seguinte conclui. Raro, e sem efeito além de uma linha de
      `job.tentativa_falhou`; só tratar se o alerta de 48 h aparecer por isso.
- [ ] **(F3, 15.0) Mutações da 15.0 que ficam equivalentes sob a trava:** o `where estado = 'agendado'` do `concluir` do repositório da
      eliminação e a conferência do mesmo `agendado` em `travarVencido` já são garantidos pelo `FOR UPDATE`; ficam como segunda camada
      (a primeira é provada no isolamento por método, `eliminar-titular.int.test.ts`).
- [ ] **(F3, 15.0) `entidadeId` de `titular.nome_trocado` na leitura da coordenação:** a entrada de auditoria da troca guarda o id da
      execução e do consumo do aluno eliminado. Quando a consulta da auditoria for aberta à coordenação, ou o dossiê (D61) a exportar,
      esconder o `entidadeId` dessa ação ou agregá-la por pedido. Hoje nenhuma rota expõe a auditoria (`conformidade-reviewer`, 15.0, 1ª rodada).
      Na mesma consulta (F12), `titular.nome_trocado` também **não deve dizer qual professor escreveu o nome** que foi trocado
      (`conformidade-reviewer` da revisão da spec, recomendação que a 19.0 registra aqui).
- [ ] **(F3, 15.0) O check do autor `rotina` não exige `autor_usuario_id` em `entrega.decidida` e `lote.aprovado`:** o teste "outro
      operador assina qualquer ação" pede revisão se o check ampliar; o gatilho `entrega_decidida_por_da_equipe` já protege a decisão
      real. Muda o contrato da 0036 (`conformidade-reviewer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Autoria da conclusão em `docs/lgpd.md` e na tela do pedido (16.0):** quando a coordenadora que registrou foi
      desativada, `concluido_por` é dela e a auditoria diz `rotina`. A tela mostra o autor da auditoria, e não `concluido_por`; dizer
      isso em `docs/lgpd.md` na 16.0 (`conformidade-reviewer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) A entrega `pendente` continua `pendente` depois do job:** sem teste que o fixe; pede fixture de entrega e de artefato
      `pendente`. O job não decide entrega (regra 70, item 3) (`conformidade-reviewer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Erro tipado no `pedido de eliminação não concluído sob a trava`:** é `new Error` (regra 00, item 9). Invariante
      inalcançável sob a trava; tipar com `FalhaDeJob` muda a política de repetição do job e pede decisão (`revisor-geral`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) `origem: 'periodo'` na foto do professor eliminado:** o teste do professor não afirma o valor; depende de o cenário
      ter suboperador vigente para o período dele. O valor é provado em `compartilhamento.int.test.ts` (`privacy-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 16.0) Leitura de `GET pedidos/:id` depois do job, fim a fim pela API:** `titular: null`, `nomeTrocado` e o provedor na
      foto. É a 16.0 que lê esse DTO na tela (`test-engineer` e `privacy-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Texto de ano `encerrado` na troca de nome:** a troca não filtra por ano (é por escola), mas nenhum teste mostra uma
      linha de ano encerrado trocada; pede fixture de ano encerrado (`test-engineer`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Cursor da troca de nome guardado por coluna no pedido:** a noite seguinte a uma interrupção recomeça da primeira
      faixa e só altera o que sobrou. Se a escola tiver tanto texto que a noite não alcança o fim, a coluna nova no pedido guarda o
      cursor (muda o modelo de dados; a causa 3 do runbook cobre o sintoma) (`infra-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) Ordem de trava pedido → usuário contra o job de arquivo da 13.0:** travar todos os pedidos do titular logo depois
      de `travarVencido` evitaria uma inversão de ordem com o job do arquivo. Sem deadlock medido, e a fila repete (D49); muda a ordem
      de trava de `concluirOutrosAbertos` (`infra-guardian`, 15.0, 1ª rodada).
- [ ] **(F3, 15.0) `#examinar` da troca de nome converte o `jsonb` inteiro a cada faixa:** `octet_length(campo::text)` relê e converte as até 1.000 linhas, e a faixa cortada pelo orçamento relê o mesmo bloco várias vezes. Medido em 574 ms para 1.000 linhas de ~1 MB, dentro dos 2 s; rever com volume real no piloto (`pg_column_size`, ou `limit` menor depois de uma faixa cortada) (`infra-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0) Migration 0036 fora do horário letivo e com `lock_timeout`:** `auditoria` cresce com o aluno, e o `VALIDATE` do check do autor `rotina` a varre sob trava. Fecha junto do item da 0031, logo abaixo (`infra-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0) Consulta pronta na causa 6 do runbook da eliminação:** deixar escrita a consulta que devolve só `id` e `octet_length` da maior linha por tabela da escola, para quem opera não montar a query na hora e selecionar a coluna de texto (`privacy-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0 → 16.0) Registrador desativado entre a leitura e a faixa, na etapa 2 da eliminação:** a faixa falha e a tentativa seguinte assina como `rotina`; sem teste próprio. Entra com a 16.0, quando a tela mostrar o autor (`privacy-guardian`, 15.0, 2ª rodada).
- [ ] **(F3, 15.0) Linha de ~4,9 MB do teste da guarda de bytes da troca de nome:** o teste `a linha sozinha acima do orçamento da faixa…` roda o regex numa faixa só contra o `statement_timeout` de 2 s (margem medida de cerca de dez vezes). Se ficar instável na esteira da spec, baixar a linha para pouco acima de 4 MB (`test-engineer` e `revisor-geral`, 15.0, 3ª rodada).
- [ ] **Migration 0031 fora do horário letivo (F3, 9.0):** `incidente_escola` tem FK para `usuario` e para `escola`, e o `migrar`
      roda numa transação. Antes do staging, aplicar fora do horário letivo e com `lock_timeout`, junto dos índices
      `concurrently` pendentes das migrations 0025 a 0027 (Tech Spec do F3, seção 7c).
- [ ] **Casos de borda do `citaOutraEscola` (F3, 9.0):** `apps/api/src/ops/incidente.test.ts` não fixa três casos em que o
      comportamento de hoje é o lado seguro (recusa): duas escolas do arquivo com o mesmo nome; "Escola Alfa" contra "Alfa Norte"
      num texto "Escola Alfa Norte"; o nome da própria com a fronteira quebrada ("Colégio Ametista Nortex"). Escrever os testes
      quando a função mudar.
- [ ] **(F3, 10.0) Faixa quando a leitura do aviso de incidente falha:** hoje, se `GET /v1/privacidade/incidentes` falha, a
      coordenação não vê aviso nem faixa (a aba Incidentes tem o erro com "Tentar de novo"). Mostrar uma faixa discreta, "Não foi
      possível conferir os avisos de incidente. Abra Privacidade › Incidentes", muda o comportamento da tela e o texto fica a
      decidir com o Gabriel (`frontend-reviewer` da 10.0).
- [ ] **(F3, 10.0) e2e da troca de escola com o aviso pendente na segunda:** a Tech Spec §9 e o comentário de
      `AvisoDeIncidente.tsx` dizem que a troca de escola desfaz o adiamento. O caso pede duas escolas e o segundo fator de novo, mais
      de um minuto de relógio, como `e2e/privacidade.spec.ts › a troca de escola não mostra a retenção…`; o reset do cache na troca
      já é provado ali, com a retenção (`test-engineer` e `revisor-geral` da 10.0).
- [ ] **(F3, 10.0) e2e do professor com incidente pendente na escola:** sem aviso, sem faixa e sem a leitura da lista. Hoje é
      estrutural (a área só monta para a coordenação, e a API recusa pelo papel: `apps/api/test/incidente.int.test.ts`, 9.0); passa
      a valer se alguém mover o aviso para a `CascaDaEscola` (`test-engineer` da 10.0).
- [ ] **(F3, 10.0) "Ficam registrados quem confirmou e quando" sem tela do "quem":** o texto de `TEXTO_DO_QUE_CONFIRMAR_FAZ` promete
      um "quem" que a coordenação não lê em tela nenhuma. Dizer onde ele aparece quando a tela de auditoria da escola existir
      (`privacy-guardian` da 10.0).
- [ ] **(F3, 10.0) Semente de incidente da vitrine:** a foto da tela de incidentes semeia o aviso por SQL solto. Se virar script em
      `tools/vitrine/`, manter texto inventado, sem dado de pessoa (`privacy-guardian` da 10.0).
- [ ] **Prazo do `registro_de_decisao` (F3, 5.0):** `packages/shared/src/privacidade/retencao.ts` (`PRAZOS_FIXOS.registro_de_decisao`) promete à escola «enquanto durar o contrato com a escola, e mais 5 anos», mas o `expurgo_execucao` apaga o registro 5 anos depois de `em`, com o contrato valendo. O registro não tem dado de pessoa (só contagens e ids), então o risco é baixo. Decidir (Joaquim): alinhar o texto ao que o código faz, ou dar ao registro do expurgo uma linha própria em `PRAZOS_FIXOS` (`privacy-guardian` da 5.0)
- [ ] **Thread do Assistente apagada pelo expurgo no instante do envio (F3, 3.0):** a thread vazia e vencida que o expurgo
      apaga enquanto o professor manda a primeira mensagem faz o envio falhar pela FK. Conferir que ele vê um erro tipado e
      que pode reenviar, e não um 500 (`infra-guardian` da 3.0). A seleção da thread vazia filtra `(escola_id, criada_em)`
      pelo índice único da thread, sem índice próprio: rever se a tabela crescer (`revisor-geral` da 3.0)

- [ ] `lista_nome`: índice parcial `(escola_id, usuario_id) where usuario_id is not null`, para a busca da eliminação do
      aluno aprovado (`CicloDeVidaRepository.apagarDaListaDeNomes`) e a FK do `usuario_id` no `delete` do usuário; hoje as
      duas percorrem a lista da escola pelo prefixo de `lista_nome_turma_idx`. Na próxima migration de `lista_nome`
      (`infra-guardian` da 10.0 da A1)
- [ ] Expurgo do `acesso_turma` e do `convite`: `order by least(...)` sem índice; se o "Gerar novo" virar rotina diária por
      turma, um índice de expressão pelo prazo (`infra-guardian` da 10.0 da A1)
- [ ] Encerrar o ano segura, durante a virada, a sala da escola inteira (reivindicação, decisão, lista e acesso esperam o
      `FOR SHARE` do ano): uma linha no runbook e o aviso na tela de Estrutura (13.0) de não encerrar em horário de aula, e a
      duração da virada num log só com contagens (`infra-guardian` da 10.0 da A1)
- [ ] **Índice da lista de professores**: `GET /v1/professores` (A1, 3.0) pagina `usuario` pelo índice `(escola_id, id)` e
      descarta quem não é `professor`: cada página pode ler todos os usuários da escola, alunos inclusive. Barato hoje
      (rota rara, só da coordenação, escola de mil usuários). Com escolas maiores, um índice parcial `(escola_id, id) where
      papel = 'professor'`, conferido com `EXPLAIN` sobre o seed de uma escola grande (`infra-guardian` da 3.0)
- [ ] **Eliminar escola apaga também o resto de uso dela**: a pasta vazia `escolas/<id>/` (o SeaweedFS só a tira da listagem
      com o `DeleteObject` da própria pasta) e os contadores `uso:*:<id>:*` do Redis de fila. Hoje a consolidação pula e conta
      essa escola toda noite como `escola_inexistente` (correção `2026-09-25-consolidacao-para-na-escola-inexistente`), e o
      sinal fica misturado com o caso que o runbook manda investigar (banco errado, restauração pela metade). Desde a correção
      `2026-09-25-acabamento-da-a0b`, se todas as escolas encontradas numa noite forem eliminadas (uma noite sem requisição
      de escola nenhuma basta), o resto de uso também derruba o job (`uso.nenhuma_escola_no_banco`). Vai na spec da
      eliminação (`privacy-guardian` e `infra-guardian` da correção)
- [ ] Alerta para muitos `login.externo{resultado="provedor"}` (erro, prazo ou discovery do Google ou da Microsoft), com linha no runbook: hoje a métrica existe, mas nada avisa quando o login pela conta da escola começa a falhar em massa (revisão da 13.0)
- [ ] Login pela Microsoft: passar a exigir a claim `xms_edov` (e-mail de domínio verificado) para ligar professor pelo e-mail. Hoje o e-mail vale como verificado porque o tenant já foi conferido, como a Tech Spec define; com a claim, um administrador do tenant da escola não consegue pôr o e-mail de outra professora num usuário e ligá-lo à conta dela (revisão da 13.0)

- [ ] **Reescrever o passo de `docs/runbook.md:276`, que é impossível de seguir.** Ele manda "olhe a
      borda (`docker compose logs --since 10m borda`)" para descobrir de onde vem uma varredura de
      endereço de escola — mas o log da borda não tem, e **por desenho não pode ter**, IP nem URL de
      requisição (regra 20, item 9; `infra/Caddyfile` exclui `http.log.access`, `http.log.error`,
      `reverse_proxy` e `admin.api`). Quem opera chega num beco. O conserto é dizer onde a informação
      está de verdade (o registro de acesso da aplicação, `docs/lgpd.md:76`), **nunca** religar log de
      requisição na borda. Achado pelo `infra-guardian` na correção
      `2026-09-22-log-da-borda-afogado-pela-sonda-do-proprio-container`

- [ ] **`infra/scripts/ensaio-alertas.ts:404` recria `api-1` e `api-2` com `--force-recreate`**, e as duas
      publicam porta (`infra/compose.yml:197,211`). É a mesma classe da corrida de porta corrigida em
      22/09/2026 (`tasks/correcoes/2026-09-22-corrida-de-porta-na-observabilidade.md`), e o que segura o
      item é só isto: **não há vermelho medido** ali. Nenhuma atenuante de desenho o distingue — o
      `up --force-recreate` do ensaio sobe o novo sem esperar o anterior soltar a porta, exatamente como
      o que foi consertado. Se aparecer, o conserto é o mesmo `recriarDoZero` de
      `tools/testes/compose.ts`, com um invólucro para a assinatura do ensaio, que leva a sobreposição
      de ambiente na frente (`(...argumentos) => composeCom(sobreposicao, ...argumentos)`). Apontado
      pelo `test-engineer` na correção

- [ ] **Recontar o número de linhas do docstring de `tools/ci/compose.ts`** quando a correção do
      `--tail` for aberta. Ele diz que os cinco logs de terceiro truncados somam 149.322 linhas; com o
      ruído do `admin.api` fora, cai para algo em torno de 115 mil — mas isso é **subtração, não
      medição**, e o `infra-guardian` exigiu recontagem numa execução real antes de mexer na régua

- [ ] Pôr `--timestamps` no despejo de log de `infra/scripts/carga.ts:304` e
      `infra/scripts/carga-login.ts:444`, que ainda usam `logs --no-color --tail 100`. É o mesmo
      defeito da correção `2026-09-21-log-da-falha-sem-carimbo-de-hora`, que consertou só os dois
      scripts da esteira; o padrão certo já existia no despejo de
      `aguardarSaudavel` (`tools/testes/compose.ts`). Sem carimbo
      uniforme, o log de um ensaio de carga não cruza com o instante do que falhou

- [ ] **Job `infra` da esteira perto do teto, sem guarda.** Leva de 29 a 30 min desde `3aeec3b` (tarefa 9.0 da A1),
      contra 22 a 23 min antes (30 min na execução 37001095812, do commit `241ba1c`); o teto é de 45 min e nenhuma
      guarda liga o tamanho da suíte a ele, como a de `tools/ci/esteira.test.ts` passou a fazer com o e2e. E os
      comentários que dizem quanto ele leva venceram: "uns 11 min" e "uns 16 min" em `.github/workflows/ci.yml:54-55`,
      e "uns 16 min" em `vitest.config.ts:7`, `README.md:60` e `.claude/rules/40-testes.md:102`. Na mesma correção, a
      frase do `docs/runbook.md` ("Esteira vermelha no e2e") que diz que a guarda do teto "reprova no portão local":
      está certa e incompleta, porque o teste é de unidade e reprova também no job `verificar` (`test-engineer` e
      `infra-guardian` da correção `2026-10-02-teto-do-e2e-na-esteira`). Destino: correção própria por `/corrigir`,
      antes da próxima tarefa que acrescentar teste com espera de relógio em `infra/**/*.int.test.ts`

- [ ] **`npm ci` das imagens na esteira sem nova tentativa.** Em 12/10/2026 o job `e2e 3/4` caiu duas vezes na
      construção das imagens, antes de qualquer teste, com `npm error code ECONNRESET` e `network aborted`: na
      execução 38261610727, 1ª tentativa (`4956a51`; imagem `despachante`, `npm ci --omit=dev`), e na 38279991501,
      1ª tentativa (`bbae49e`; imagem `worker-lote`, `npm ci --ignore-scripts`). A segunda passou na 2ª tentativa sem
      mudança de código. Os nove `RUN npm ci` de `infra/docker/*.Dockerfile` (linhas 12 e 30 de `api`, `worker`,
      `realtime` e `despachante`; linha 15 de `web`) rodam uma vez só, e a esteira constrói as imagens do zero em cada
      job que sobe o compose (`up --build`, `tools/ci/prazo-do-e2e.ts:143`): uma queda de rede do registro derruba o
      job e custa uma reexecução à mão, com a esteira vermelha no meio. Saídas, a medir numa correção por `/corrigir`
      (`infra-guardian`): `fetch-retries` e `fetch-retry-maxtimeout` do npm maiores nesses `RUN`; cache do npm no
      BuildKit (`--mount=type=cache`), com cache de camada na esteira; ou nova tentativa da construção em quem a
      chama. Nenhuma pode esconder falha que não é de rede: a nova tentativa vale só para erro de rede, com teto, e
      deixa a linha no log. O `npm ci` dos próprios jobs (`.github/workflows/ci.yml:34,50,67,97`) tem o mesmo risco,
      e `tools/ci/esteira.test.ts:130` fixa os comandos de cada job

**Ao ligar HTTPS na borda do staging, as quatro coisas abaixo são da mesma tarefa.** Estão separadas
porque item único vira execução parcial. Motivo e medição de cada uma em
`tasks/correcoes/2026-09-22-log-da-borda-afogado-pela-sonda-do-proprio-container.md`, seção "O que fica
para o staging".

- [ ] Acrescentar **`http.stdlib`** ao `exclude` do `log default` em `infra/Caddyfile`. É o único vetor
      restante de endereço de cliente no log da borda, e ele vai **dentro do `msg`**
      (`"http: TLS handshake error from <ip>:<porta>"`), sem chave — cego às negativas por nome **e** à
      negativa por forma. Em HTTP/1 sem TLS não dispara (medido); com TLS, dispara. E no staging o log
      do Docker vai para o Alloy e o Grafana Cloud (`notas-staging.md:53,55`), o que torna a linha dado
      retido e pesquisável. **Não** excluir o logger pai `http` no lugar dele: a exclusão por prefixo
      não arrasta filho (medido com `admin`/`admin.api`), e excluir `http` seria pior
- [ ] **Converter** a negativa por forma de `infra/test/borda.int.test.ts` em asserção **positiva**
      sobre os campos que o log de acesso passa a guardar. Apagá-la reabre a família de cinco
      armadilhas que a correção fechou
- [ ] Somar **`user_id`** e **`resp_headers`** à lista de chaves proibidas nesse momento. A âncora atual
      (`"(remote_ip|...)":`) não pega `resp_headers`, porque exige que o grupo comece logo depois da aspa
- [ ] Trocar o guarda de texto de `tools/ci/borda.test.ts` por um `toEqual` sobre `logging.logs` do
      `caddy adapt`, que é imune à formatação do arquivo (espaço, tabulação, coluna 0, CRLF, bloco
      aninhado) e mostra a configuração **efetiva** — inclusive o `health_checker` que o próprio Caddy
      acrescenta ao `exclude`. Roda em `test:infra`, não no portão rápido: custa o binário do Caddy

- [ ] Escolher provedor de hospedagem em região Brasil, com Postgres + pgvector, Redis e
      storage S3 gerenciados (D26, D28), quando for criar o staging (D31, D42). O Redis do staging
      precisa ser gerenciado **na mesma região**: com o corte de 100 ms do cliente do login, o
      staging passou a ser o único ensaio desse corte fora de produção (`infra-guardian`)
- [ ] **Bloqueio de IP na borda contra ataque ao código da turma** (A1): na A1 não existe, e a resposta é revogar os
      acessos da escola (`docs/runbook.md`, "Código da turma errado em massa numa escola"). Entra com o staging e o
      provedor (D42), com finalidade e prazo de remoção no `docs/lgpd.md` antes do primeiro uso, na regra do provedor
      e nunca em arquivo versionado (o repositório é público), sem ler as chaves `rl:ip` à mão (`privacy-guardian`)
- [ ] **Valores que o staging e a produção não herdam do `.env.example`**, e que fazem o boot falhar
      de propósito se forem copiados. Hoje são três, e a lista é executável em `apps/api/src/config.test.ts`
      ("o .env.example não sobe em produção"), que falha quando outra variável entra na mesma classe:
      `LOGIN_REDIS_PRAZO_MS` (no máximo 100; o exemplo tem 2000, que só vale em `local`) e os dois
      emissores do login pela conta da escola, `LOGIN_EXTERNO_GOOGLE_EMISSOR` e
      `LOGIN_EXTERNO_MICROSOFT_EMISSOR`, que apontam para o `oidc-falso` em http e precisam de https.
      Em produção soma a quarta, `ROTAS_SINTETICAS`, que o exemplo deixa ligada.
      **A lista é do que o boot recusa, e é a parte fácil.** A perigosa é o que ele *aceita*:
      `IDENTIDADE_CHAVE_ASSINATURA`, `LOGIN_CHAVE_CONTADOR`, `IDENTIDADE_CHAVE_CIFRA_V1` e os segredos
      do login externo têm 32+ caracteres e sobem em produção sem reclamar, sintéticos como estão. A
      lista de criação do staging precisa das duas metades (`test-engineer`).
      E, sob pressão, a saída errada é baixar o `AMBIENTE` para `local`, que destravaria junto
      `LOGIN_PROTECAO_DESLIGADA` e `ROTAS_SINTETICAS`: escrever isso na lista antes de alguém
      precisar dela (`infra-guardian`)
- [ ] Tirar `MONTAGEM_DE_TESTE.prazoDoRedisDeLoginMs`, que ficou quase redundante com
      `LOGIN_REDIS_PRAZO_MS`: os dois valem 2 s no compose de teste, e por isso a precedência do `??`
      em `sessao.module.ts` não tem teste que a prove. São sete arquivos de teste, mecânicos — era
      limpeza fora do escopo da correção de 22/09 (`test-engineer`, rodadas 3 e 4)
- [ ] Contrato com provedor de modelo: **garante processamento no Brasil para conversa de
      aluno** (D62), veda treinamento, permite serviço usado por menor,
      limite de tokens por minuto compatível com o pico (~1,5 mi/min em 10 escolas pela
      estimativa do `docs/infra.md`; a análise de 13/09/2026 chegou a ~2,8 mi com premissa
      mais realista), e região de processamento (D29)
- [ ] Provedor de modelo de reserva configurado e testado
- [ ] Antes da primeira escola real: alerta para rotina do sistema que parou de rodar
      (`sistema.consolidar-uso`, `sistema.expurgar-jobs`, `sistema.expurgar-acesso` da 17.0), por exemplo métrica com o horário do
      último sucesso e regra `time() - x > 26h`, com entrada no `docs/runbook.md` (pendência da 11.0
      registrada na 13.0; dono: Joaquim). Precisa pegar também a rotina que roda e falha: a consolidação falha com
      `uso.nenhuma_escola_no_banco` quando o worker aponta para o banco errado (correção `2026-09-25-acabamento-da-a0b`),
      e hoje isso só aparece em `job_registro`
- [ ] Rodar a avaliação de `docs/avaliacao-de-modelos.md` com Maritaca e Gemini (D37)
- [ ] Perguntar à Maritaca, por escrito, se o contrato cobre dado de aluno menor de idade e
      se garante processamento só no Brasil (o DPA de agosto/2026 lista Brasil, EUA e UE)
- [ ] Verificar os termos do Vertex AI para serviço usado por menor e se processa em São
      Paulo (a Gemini API do AI Studio veda esse uso)
- [ ] Com contador: tributo sobre IA faturada do exterior contra faturamento local, e regime
      tributário (Simples com fator R, Lucro Presumido, CBS de 2027)
- [ ] Levantar a região de processamento dos provedores e se a rede pública aceita
      transferência internacional de dado minimizado
- [ ] Escolher ferramenta de observabilidade e de alerta no celular (região Brasil ou
      hospedada por nós)
- [ ] Levantar com a escola piloto: horário letivo real, banda da rede, se há proxy ou
      filtro de conteúdo que bloqueie WebSocket
- [ ] Antes do piloto: canal e texto para avisar as escolas de incidente
      (`docs/runbook.md:198`, pendência da validação do F0)
- [ ] Validar a FK de `escola_id` das tabelas do F0, numa migration de deploy fora do horário
      letivo (regra 80, item 9). A migration 0006 acrescentou as três restrições `NOT VALID`:
      elas já barram escrita nova, mas as linhas anteriores ao F1 nunca foram conferidas.
      Antes de rodar, esta consulta precisa dar zero em cada tabela:

      ```sql
      select 'job_registro' as tabela, count(*) from job_registro j
        where j.escola_id is not null and not exists (select 1 from escola e where e.id = j.escola_id)
      union all select 'configuracao_operacional_escola', count(*) from configuracao_operacional_escola c
        where not exists (select 1 from escola e where e.id = c.escola_id)
      union all select 'uso_infra_diario', count(*) from uso_infra_diario u
        where not exists (select 1 from escola e where e.id = u.escola_id);
      ```

      Com zero, a migration é `ALTER TABLE <tabela> VALIDATE CONSTRAINT <nome>_escola_id_escola_id_fk`
      nas três, uma por vez (dono: Joaquim)

- [x] **A página pública da sala só com a 7.0 junto** (A1, tarefa 5.0; `infra-guardian` e `privacy-guardian`). Feito na
      7.0: o contador de código errado por escola com a espera de 1 s, o de matrícula errada por nome e o de hash sem pedido
      por turma (`apps/api/src/sala/limites-da-sala.ts`). O alerta e o comando de revogar ficam na 9.0. Até a
      7.0, a busca pelo código em `salas/abrir` só tem o `rl:ip` anônimo, e quem sabe o slug de uma escola pode tentar
      códigos de vários IPs para listar os nomes livres. Nenhum staging exposto nem dado real sem o contador de código
      errado por escola e a espera de 1 s da 7.0 (dono: Joaquim, no portão do staging). O mesmo vale para
      `salas/reivindicar` (6.0): até o contador por nome da 7.0, quem tem um código válido pode tentar matrículas num
      nome livre, e cada tentativa só custa um hash, segurado pelo `rl:ip` e pela vez da escola no semáforo
      (`infra-guardian` e `privacy-guardian` na 6.0)
- [ ] **`rl:ip:sala` próprio** (Tech Spec da A1, 7c; `infra-guardian` na 5.0): `salas/abrir` divide o `rl:ip` anônimo
      com as outras rotas anônimas, e a folga (cerca de 1.300/min contra 3.000/min) vale para uma escola. Gatilho: rede
      com várias escolas atrás do mesmo IP de saída, ou o F2, o que vier antes (dono: Joaquim)
- [ ] **Prender o `AcessoDaSala` ao `sala` no teste de arquitetura** (`privacy-guardian` na 5.0): ele sai do
      `SessaoModule` global, e só o `SalaModule` deve injetá-lo, porque abre contexto de escola sem usuário. A 5.0
      exigia o `arquitetura.test.ts` sem mudar; a asserção entra na próxima tarefa que tocar o teste, e prende também o
      `anoLetivoId` de `naEscolaSemUsuario` a `sessao/acesso-da-sala.ts`, o único caminho que põe o ano no contexto sem
      usuário (`privacy-guardian`, 2ª rodada) (dono: Joaquim)
- [ ] **Alinhar os pacotes `@nestjs/*` na mesma versão** (`infra-guardian` na correção
      `2026-10-06-audit-proxy-addr-e-multer`): o `@nestjs/platform-express` subiu para 12.1.2 para fechar o aviso do
      `multer`, e `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-socket.io` e `@nestjs/websockets` ficaram em
      12.0.1. Funciona porque o que a 12.1.2 importa de `@nestjs/common/internal` existe na 12.0.1, mas esse módulo é
      interno do Nest, e um `npm update` de um lado só pode quebrar sem aviso de peer. Daqui em diante os pacotes do Nest
      sobem juntos; o alinhamento entra na próxima tarefa que tocar dependência (dono: Joaquim)
- [ ] **(F3, 18.0) A releitura de 10 s de "Meus dados" não tem teto de tentativas** (`frontend-reviewer`, 1ª rodada): o relógio é
      o `agendarRelitura` da 16.0, compartilhado com a tela da coordenação; teto ou espaçamento crescente é decisão dos dois
      usos, pela regra 80 (dono: Joaquim)
- [ ] **(F3, 20.0) `INTERVALO_DA_ATIVIDADE_MIN` copiado em dois specs de e2e** (`test-engineer` e `revisor-geral`, 1ª rodada):
      `e2e/acesso-suspenso.spec.ts` e `e2e/inatividade.spec.ts` repetem o 5 min do relógio de inatividade, que vive em
      `apps/web/src/sessao/inatividade.ts` (importa React e `api/sessao`, e não carrega no Node do Playwright). Vale quando a
      constante for para `packages/shared` (dono: Joaquim)
- [ ] **(F3, 20.0) Teste de `deveTentarDeNovo` com `ACESSO_SUSPENSO`** (`infra-guardian`, 1ª rodada): a garantia de "nenhuma nova
      tentativa" depende só da lista fechada de códigos de `apps/web/src/api/cliente-de-consultas.ts`; um teste dela, com
      `ACESSO_SUSPENSO`, a prende. O arquivo não é da 20.0: a tarefa que o tocar cobre (dono: Joaquim)
- [ ] **(F3, 20.0) Componente comum para `SemDesafio` e `AcessoSuspenso`** (`revisor-geral` e `frontend-reviewer`, 1ª rodada): o
      link "Ir para a entrada" e o aviso com o token `pendente` se repetem nas duas telas; um componente comum, ou um
      token/variante "aviso", vale quando houver uma terceira tela igual (dono: Joaquim)
- [ ] **(F3, correção da ordem da lista de pedidos) `ne(titularId)` sem teste que o distinga da exclusão pela conta**
      (`test-engineer`, `privacy-guardian`, `tenancy-guardian` e `revisor-geral`, 1ª rodada): em
      `apps/api/src/privacidade/pedidos.repository.ts`, `listar`, a cláusula `ne(pedidoTitular.titularId, deQuemPediu.usuarioId)`
      apagada deixa tudo verde, porque a exclusão pela conta cobre o mesmo caso; só se distinguem quando quem lê não tem
      `conta_id`, e `escolaComPessoas` não semeia isso. Falta um caso de integração com quem lê sem conta, para a cláusula não
      sair por engano. A cláusula é da 11.0 e não é do diff da correção. Momento: validação do F3 (dono: Joaquim)
- [ ] **(F3, correção da ordem da lista de pedidos) Índice `(escola_id, chegou_em, id)` em `pedido_titular`**
      (`infra-guardian`, 1ª rodada): a página de pedidos ordena por `(chegou_em desc, id)` sem índice próprio, sobre os pedidos
      de uma escola (dezenas por ano). Se o volume de rede pública mostrar custo, é migration de expansão só com o índice.
      Gatilho: `EXPLAIN` com dado sintético no volume de rede pública (dono: Joaquim)
- [ ] **(F3, validação, rodada 2, m1) Pedido registrado depois do encerramento do ano, por tipo:** em
      `apps/api/test/pedido-titular.int.test.ts:1061` o caso registra só um pedido de compartilhamento, e o e2e, um de
      correção. Nenhum teste registra eliminação, acesso ou portabilidade com o ano `encerrado`; o `Validador` conferiu os
      três à mão pela API. Acrescentar uma eliminação e um acesso ao caso, na próxima correção ou tarefa que mexer nos
      Pedidos (dono: Joaquim)
- [ ] **(F3, validação, rodada 2, m2) "Sem turma neste ano" quando não há ano em curso:**
      `apps/web/src/areas/coordenacao/privacidade/textos-dos-pedidos.ts:58`. "Sem turma" basta. Na próxima correção ou
      tarefa que mexer nos Pedidos (dono: Joaquim)
- [ ] **(F3, validação, m3 a m6) Telas da Privacidade:** com destino desde a D80: m3 e m5 na X2 (`telas-da-coordenacao`), m6 na X1 (tarefa 11.0, título visível em toda tela); m4 pede campo no DTO e continua sem spec.
      (m3) a lista de pedidos não mostra o prazo nem destaca o vencido
      (`apps/web/src/areas/coordenacao/privacidade/Pedidos.tsx:84`): a correção vencida há 5 dias aparece só como
      "Recebido"; (m4) o DTO do pedido não leva `eliminarEm` (`packages/shared/src/privacidade/titular.ts`), e o detalhe diz
      "7 dias depois do registro" sem dizer o dia; (m5) "Baixar a versão da escola" aparece também com o titular de conta
      ativa, e aí sempre falha, com o texto certo (`AcoesDoPedido.tsx:279`); (m6) na área do professor, "Meus dados" não tem
      título à vista (`apps/web/src/componentes/meus-dados/MeusDados.tsx:189-191`). Fotos e detalhe em
      `tasks/prd-lgpd-e-titular/validacao.md`, seção 4 das duas rodadas (dono: Joaquim)
- [ ] **(F3, validação, m7) `IA_LATENCIA_FALSA_MS` obrigatória sem aviso no `README.md`:** `infra/compose.yml:211` exige a
      variável, e quem sobe o compose pela primeira vez não é avisado. Uma linha no `README.md` (dono: Joaquim)
- [ ] **(F3, validação, m8) A vitrine não semeia nada da Privacidade:** `tools/vitrine/escola.ts` monta a escola sem pedido,
      incidente nem empresa, e o `Validador` semeou à mão, nas duas rodadas, para fotografar as telas. Junta-se à semente de
      incidente da 10.0, acima: texto inventado, sem dado de pessoa (dono: Joaquim)
- [x] ~~(F3, fechamento) "Critério de conclusão" com as caixas em branco em documentos de tarefa~~ — resolvido na
      retrospectiva do F3 (11/10/2026): eram oito documentos, não três, e a seção saiu do modelo de tarefa
      (`tasks/prd-lgpd-e-titular/retro.md`, proposta 5). Os documentos antigos ficam como estão
- [ ] **(F3, fechamento) Comentários que falam em "grupo Conformidade":** `apps/web/src/areas/navegacao.ts:38` e
      `apps/web/src/caminhos.ts:80` descrevem um grupo que a lateral não tem (a decisão dos grupos está em "Marca e
      interface", abaixo, até o PRD do F12). Acertar o comentário na próxima tarefa ou correção que abrir esses arquivos
      (dono: Joaquim)

## Processo e dívida do F0

- [x] **(F3, retro, M1) O portão da tarefa confere as mutações:** feito em 11/10/2026 (D79,
      `tools/processo/mutacoes.ts`). Medido no térreo: três mutações, uma delas de integração, somaram 15 s ao portão.
      Falta a prova numa tarefa inteira: quantas reprovações do `test-engineer` ele evita
- [x] **(F3, retro, M2) Fuso nos testes:** feito em 12/10/2026
      (`tasks/correcoes/2026-10-12-fuso-nos-testes.md`). A unidade roda em `TZ=Asia/Tokyo` (`vitest.config.ts`); o
      vermelho de `textos-do-pedido.test.ts` era do teste (13 h e 18 h de UTC são o mesmo dia só em São Paulo); o
      Postgres do compose declara `timezone=America/Sao_Paulo` na linha de comando (`POSTGRES_FUSO`, no `.env.example`),
      e `tools/testes/fuso.test.ts` e `fuso.int.test.ts` provam a unidade e o banco vivo. Ficam de fora, de propósito:
      o fuso da **integração** (herda o do computador; fixar um longe de -03 ali é um lote vermelho que ninguém mediu),
      o do `compose.carga.yml` (troca o `command` inteiro) e o dia que a web mostra, que é o do navegador
      (`formatarDiaDoInstante`) e, se virar o de São Paulo, é decisão de produto. **Falta, no staging (D42):** o Postgres
      gerenciado (D26) costuma vir em UTC; declarar nele `timezone=America/Sao_Paulo`, para o banco que a escola usa seguir o
      mesmo dia do banco em que o teste roda. Sem isso, o `check` de `pedido_titular.chegou_em` (`0032_pedido_titular.sql`)
      aceita, entre 21 h e meia-noite, um dia de São Paulo à frente (a API recusa antes: `privacidade.service.ts`), e
      um `current_date` ou `::date` que entre sem fuso declarado muda de dia na produção sem o teste ver (dono: Joaquim)
- [x] **(F3, retro, M4) Condição de tela provada sem navegador:** feito em 12/10/2026
      (`tasks/correcoes/2026-10-12-teste-de-componente.md`). `jsdom` e `testing-library` entram como dependência de
      desenvolvimento do `@educa/web`, e o projeto `unidade` passa a incluir `*.test.tsx`: o portão da tarefa, a esteira
      e as mutações já o alcançam. O arquivo pede o ambiente na primeira linha (`// @vitest-environment jsdom`), e a
      unidade da API e dos pacotes continua no Node. O auxiliar `apps/web/src/__fixtures__/tela.tsx` dá a rede falsa, a
      sessão aberta e o cliente de consultas da aba; o primeiro caso é o de `ListaDePedidos.test.tsx` (estados, rótulo e
      o que cada papel vê, em 1 s). **Falta, por outra mão:** a linha "estados da tela" do modelo de tarefa
      (`.claude/skills/criar-tasks/`) passar a pedir teste de componente para a condição e e2e para o fluxo; e o `jsdom`
      não faz layout, então "texto cortado" e "celular espremido" continuam sendo da vitrine e do e2e. Da revisão da
      correção, **para quem pegar o resto**:
      - quando a linha "estados da tela" mudar, ela deve citar `apps/web/src/__fixtures__/tela.tsx`, para não nascer um
        segundo auxiliar, e conferir se o `jsdom` 30 já cobre o `showModal` do `DialogoDeDecisao` (hoje o diálogo fica
        no e2e);
      - a primeira tarefa que alterar a `ListaDePedidos` ou o `DialogoDeDecisao` leva os casos que a correção deixou:
        dois alunos com o mesmo nome (a marcação é por id), releitura que falha com a lista na tela ou lida e vazia, o
        limite de 40 marcados, "há mais pedidos" e o anúncio dos pedidos novos na região viva;
      - o `engines` da raiz (`>=22.18.0 <23`) fica abaixo do piso do `jsdom` 30.1.1 (`^22.22.2`): subir o piso para
        22.22.2 junto de quem tocar o `package.json` da raiz; esteira e `.nvmrc` (22.23.2) passam (dono: Joaquim)
- [ ] **(correção 2026-10-12-codigo-cru-no-nome-sintetico) Fechar a guarda do código cru de erro no e2e** (`revisor-geral`,
      `test-engineer` e `frontend-reviewer`, 1ª e 2ª rodadas; `tasks/correcoes/2026-10-12-codigo-cru-no-nome-sintetico.md`):
      `codigoCru` (`e2e/__fixtures__/verificacoes.ts`) trata como nome sintético qualquer `503` com vizinho hexadecimal, e
      por isso não vê o código cru colado a minúscula de `a` a `f` ou a dígito. Duas pontas soltas, na mesma mão:
      - **a trava contra a substring:** um teste de unidade ou regra de lint que reprove `not.toContainText('<três
        dígitos>')` em `e2e/`, com exceção de `guardas.spec.ts`, para o próximo spec não voltar a procurar o código como
        substring. Dentro dela: restringir o parâmetro de `codigoCru` a `` `${number}` `` ou validar `/^\d{3}$/` (hoje o
        `codigo` entra na `RegExp` sem escape), e a docstring citar os cinco códigos em uso (`404`, `409`, `429`, `500`,
        `503`) ou dizer "código HTTP de três dígitos";
      - **a expressão presa ao formato:** a exceção valer só para o código dentro de uma sequência de oito hexadecimais, e
        não para qualquer vizinho hexadecimal. Refaz as cinco mutações e o contrato do helper; só vale se aparecer um botão
        ou aviso em minúscula de `a` a `f` logo depois de um erro (gatilho do `/retro`).
- [x] **(D79) Imagens do compose de teste com nome fixo:** feito em 11/10/2026, sem tocar em `infra/`: fora do
      ambiente 0, `tools/ci/compose.ts` gera `.processo/compose-de-teste-N.yml`, que dá a cada imagem construída a
      etiqueta `teste-N`. Provado com um e2e no ambiente 1 (68 s, verde, sobre `educa-api:teste-1`)
- [ ] **(D79) Linhas: prova numa spec.** As tarefas autorizadas em paralelo correm em linhas
      (`tools/processo/linhas.ts`, `/seguir`, passos 3 e 6), com teto de três. Provado em repositório de teste: partida,
      encontro, conflito e conserto. Sem prova: os comandos do Maestri para o andar e o par de uma linha a mais, três
      e2e ao mesmo tempo nesta máquina, o consumo por hora do plano, e quanto tempo de spec as linhas tiram. Medir na
      retrospectiva da próxima spec (dono: Joaquim)
- [ ] **(F3, retro, M3) A pré-execução da vigia não enxerga o time, e a rotina voltou ao `/vigia`:** o
      `tools/processo/vigia.ts` (11/10/2026) foi ligado como `--pre-run` da rotina e acordou o Orquestrador em todo
      disparo. A rotina roda a pré-execução sem as variáveis `MAESTRI_*` do terminal (relato do Orquestrador,
      12/10/2026). Conferido no mesmo dia: sem `MAESTRI_SOCKET`, o `maestri list` responde "only available inside
      Maestri terminals"; `nomesDoTime` não acha terminal nenhum, e `decidir` devolve "nenhum terminal do time ligado"
      (`vigia.ts:39`), que imprime `/vigia`. Se o comando falhar, o `catch` da linha 64 imprime o mesmo. Nesse caminho,
      cada disparo ainda regrava `.processo/vigia.json` vazio (linha 63), e o relógio das duas horas se perde. A rotina
      voltou ao comando `/vigia`, sem `--pre-run`, que é a saída que o passo 9 do `/seguir` dá para a prova que falha;
      o passo 9 e `.claude/skills/vigia/SKILL.md` ainda descrevem a pré-execução. Falta: achar como a pré-execução
      recebe o ambiente de um terminal (o soquete e o id gravados em arquivo pelo Orquestrador, ou opção do
      `maestri routine`), provar com alguém trabalhando que a saída vazia não acorda o modelo, e só então religar e
      acertar os dois textos. Até lá, toda vigia acorda o Orquestrador: no F3, 96 de 100 foram "nada a fazer"
      (dono: Joaquim)
- [ ] **(F3, retro) 26 `@SemEscopo` em `resolucao-de-tenant.repository.ts`:** o `tenancy-guardian` apontou na 14.0
      que o número passa do sinal da regra 10, item 9. Declarar a exceção na regra ou partir o módulo é decisão de
      desenho sobre a regra 10, e não se resolve por retrospectiva: entra na Tech Spec da próxima spec que tocar sessão
      (dono: Joaquim)
- [ ] **(F3, retro) Recomendações de código e de teste que as tarefas deixaram "para o /retro":** a retrospectiva não
      altera código. A lista, com a tarefa de cada uma, está em `tasks/prd-lgpd-e-titular/retro.md`, "Pendências fora
      das propostas": sete reforços de teste (8.0, 9.0, 15.0, 18.0, 19.0, `e13311f`, `9d2887f`). Cada uma entra na
      próxima tarefa ou correção que abrir o arquivo. O lint que recusa `.skip` e `.only` entrou em 11/10/2026
      (guarda `teste-sem-desligar`) (dono: Joaquim)
- [ ] **Quando o F1 fechar: criar `release` e `develop`** (D23 revista). Ordem combinada: o
      branch de documentação entra no `main` quando o Joaquim avisar, depois `main` → `release`
      e `release` → `develop`. Atenção: o `docs/direcionamento-regulatorio` já conflita com a
      tarefa 17.0 em `docs/lgpd.md`, e o conflito precisa ser resolvido nesse merge
- [ ] **Ajustar o processo à D23 revista** (dono: Joaquim): a esteira do GitHub só roda no push
      do `main` (`.github/workflows`), e precisa rodar em `develop`, `release` e nos PRs; o hook
      de commit, o `/executar-task`, o `/corrigir` e a regra 40 ainda descrevem commit direto no
      `main` e esteira verde antes da tarefa seguinte; definir de qual branch sai o staging
- [x] ~~MVP de apresentação (D71): aceitar ou recusar os três afrouxamentos~~ — aceitos em
      23/09/2026 (D71 revista)
- [x] ~~**AIAs do MVP:** escrever a etapa 1 das AIAs de correção, diagnóstico, Tutor e sinais antes
      dos PRDs da A3, da A4 e da A5 (`docs/aia/`). A A1 e a A2 não têm função de alto risco além
      da adaptação, cuja etapa 1 entra antes do PRD da A2~~ — as cinco etapas 1 estão em `docs/aia/`
      (`d23179a`), fechadas para o MVP com as decisões do Joaquim de 05/10/2026 (`16183f4`); a A2 a A5
      não tiveram PRD (D77)
- [ ] **AIAs depois do MVP:** a revisão do Gabriel das cinco etapas 1 e as etapas 2 a 6 de cada uma,
      antes do primeiro aluno real (D60, D71; `docs/aia/README.md`)
- [x] ~~Ratificar ou recusar as D55 a D71~~ — ratificadas em bloco pelo Joaquim em 23/09/2026,
      com as revisões da D1, D17, D23, D32, D45 e D60
- [ ] **Avisar o Gabriel do que foi decidido em 23/09/2026:** a pele é uma só, a do ChatGPT, e
      Ferramentas e Turmas deixam a pele da Teachy (D72); três agentes (D32 revista); a A1 é a
      escola montada pela coordenação, sem seed (D71 revista); o material entra pela coordenação
      (D75). O mockup pode seguir com a pele da Teachy como estudo, mas o produto não

Pendências herdadas da validação do F0 (`tasks/prd-fundacao-tecnica/validacao.md`, seção 6
das rodadas 1 e 2). Os itens que valem para funcionalidade futura ficam lá e são lidos pelo
`/criar-techspec` dela.

- [x] ~~Conferência da esteira com `headSha` igual ao `origin/main` e só `success`~~ —
      passo 7 de `executar-task`, com regra para `cancelled`, execução não registrada e
      commit sem push (menor 1 da rodada 2)
- [x] ~~`npm ci` quando o lock é mais novo que o `node_modules`~~ — passo 4 de
      `executar-task` e portão do `validador` (menor 4 da rodada 2)
- [ ] Hook que recusa commit `(tarefa N.0)` quando a última execução da esteira no
      `origin/main` não for `success`, como o hook das revisões, com saída clara sem `gh`
      (menor 3 da rodada 2)
- [ ] `tasks/prd-fundacao-tecnica/prd.md:94`: trocar a borda para "a próxima tarefa não
      commita antes de a esteira do commit anterior ficar verde" (menor 2 da rodada 2)
- [ ] `docs/infra.md:211`: apontar a janela do lote não urgente para a Tech Spec do F0,
      seção 5, passo 2, com o padrão segunda a sexta, 7h às 18h, configurável por escola
      (menor 5 da rodada 2)
- [ ] Decidir os achados da auditoria da 16.0 fora do escopo: renovação da vaga durante o
      recuo, devolução do ponto no limitador, despachante serial (`16_task.md`)
- [ ] Descobrir por que o controle negativo do cenário de carga parou de reprovar. Em
      16/09/2026, em duas execuções seguidas, `npm run carga:controle-negativo` **não reprovou**:
      sem a vaga por escola, a espera da escola B ficou em 84 ms e 125 ms, contra o limiar de
      base + 500 ms. Em 14/09/2026 ele reprovava, com a B em p95 2,53 s contra 507 ms
      (`tasks/prd-fundacao-tecnica/15_task.md`, validação da 15.0). Não é a máquina ter ficado
      folgada por acaso: entre as duas medições entrou o commit `364049c`
      (`UV_THREADPOOL_SIZE=16` e `dns_opt` em api, realtime, despachante e worker), e na mesma
      comparação a espera dos interativos da própria A caiu de p95 10,3 s para 6,1 s — a vazão
      do worker subiu. A validação do F0 registra o mesmo na rodada dela
      (`tasks/prd-fundacao-tecnica/validacao.md`, RF18: controle negativo com `espera_b`
      p95 2,63 s), ou seja, são vinte vezes mais que agora. A pergunta a responder primeiro não
      é qual limiar mexer, e sim **por que a carga da escola A deixou de saturar o worker** — se
      ela não satura mais, o `npm run carga` verde também prova menos do que diz. Primeiro passo:
      repetir o cenário com o `UV_THREADPOOL_SIZE` de antes, para confirmar ou descartar essa
      causa; só depois decidir se o que muda é o cenário, o limiar ou a CPU de
      `infra/compose.carga.yml`. Enquanto isso, o controle negativo não está controlando nada.
      A regra 80, item 3, continua provada por `apps/despachante/test/vagas.int.test.ts`
      (controle negativo da vaga e "A sem vaga não atrasa B"), que roda no portão (dono: Joaquim)
- [x] ~~Teste intermitente da borda ("API não depende do resto")~~ — não era o teste: nome de
      serviço parado esgotava as 4 threads do libuv e a conexão ao Postgres esperava 15 s. Corrigido
      com `UV_THREADPOOL_SIZE=16` e resolvedor de 1 s (`docs/infra.md`, "Threads e DNS")
- [ ] Guarda de `npm audit` provada com fixture real de dependência vulnerável, e não só com
      o `npm` imitado (`tools/ci/scripts.test.ts:75`)
- [x] ~~`redis-fora.int.test.ts:97` com `start` sem `aguardarSaudavel`~~ — corrigido em 21/09/2026
      (`tasks/correcoes/2026-09-21-redis-fora-mede-a-subida-do-container.md`), e a guarda de lint
      `guardas/esperar-servico-do-compose` impede a próxima ocorrência da classe
- [ ] Medir uma vez a recuperação do despachante depois do `healthy` em `redis-fora.int.test.ts` e
      registrar o número, para o poll de 60 s passar a ser dimensionado em vez de herdado
      (`test-engineer`, três rodadas da correção de 21/09)
- [ ] **Esteira instável: tratar como desenho, não como três bugs soltos.** Em 20/09/2026, depois de
      nove execuções verdes seguidas, três testes **diferentes** falharam em três execuções, cada um
      passando na seguinte sem mudança nenhuma (reconciliação do despachante, e2e do `celular`,
      `infra/test/borda.int.test.ts` com 503 seguido de 400 em cascata), e um quarto vermelho
      intermitente aconteceu no portão local. Diagnóstico do `infra-guardian`: o job do e2e sobe o
      compose **inteiro** (~18 contêineres, incluindo `observabilidade`, sem limite de CPU em
      `infra/compose.yml`) no mesmo runner onde o Playwright roda com CPU ×4 e, no `celular`, 600 ms
      de RTT; `workers` não está fixado em `playwright.config.ts` e `retries: 0`. Nesse arranjo o
      orçamento de tempo não tem folga e contenção do runner vira vermelho que não reproduz na
      máquina. O que decidir: fixar `workers` na esteira, não subir `observabilidade` no job do e2e,
      e escolher entre folga de `expect` no perfil `celular` ou retentativa com o flake **registrado**
      (nunca mascarado). É tarefa, não correção — vale `/criar-tasks`. É o achado mais valioso da
      validação do F1. **Um dos vermelhos do `celular` já tem causa achada e corrigida**: o cliente
      Redis do login cortava em 100 ms e recusava o desafio no runner carregado
      (`tasks/correcoes/2026-09-22-corte-de-100-ms-do-redis-recusa-o-desafio-no-e2e.md`). Isso não
      fecha o item — a contenção do runner continua —, mas tira um caso da lista e mostra o padrão:
      prazo de produção medido num runner que não é produção
- [ ] **Intermitente com causa fechada, pronto para `/corrigir`: o "cookie alterado" de
      `apps/api/test/sessao-externa.int.test.ts:433` às vezes não altera nada.** A linha é
      `` `${valor.slice(0, -2)}${valor.endsWith('A') ? 'B' : 'A'}${valor.slice(-1)}` ``: a condição
      olha o **último** caractere e a troca escreve no **penúltimo**. Com o penúltimo já `A` e o
      último diferente de `A`, o cookie "alterado" sai idêntico ao original, o retorno é aceito e a
      asserção da linha 443 recebe `/` em vez de `/?falha=provedor`. Em base64url é ~1 em 64
      execuções. Visto em 22/09/2026 no portão local (o cookie do log terminava em `Aq`); passa 4 de
      4 isolado. O conserto é olhar o caractere que se troca — e vale conferir se a mesma inversão
      existe em outros "altera um caractere" da suíte
- [x] ~~`infra/test/borda.int.test.ts` — "handshake por polling": 503 seguido de 400 em cascata~~ —
      a causa não era ordem entre casos: o teste mandava 20 POSTs em paralelo no mesmo `sid`, e o
      engine.io recusa POST sobreposto
      (`tasks/correcoes/2026-09-23-borda-manda-polling-sobreposto.md`)
- [ ] Depois da correção `2026-09-23-porta-do-teste-na-faixa-efemera`: uma linha no cabeçalho de
      `infra/teste.env` e `infra/carga.env` dizendo que porta nova fica entre 23000 e 29999; o teste
      de ambiente conferir também o piso de 1024 e que teste e carga não repetem porta
      (`infra-guardian`); e, no `/retro`, reabrir a correção
      `2026-09-22-corrida-de-porta-na-observabilidade`, cujo 59100 também estava na faixa efêmera
      (`test-engineer`)
- [ ] Guarda de `video`/`screenshot` no mesmo laço de `tools/ci/esteira.test.ts` que já resolve
      `trace` e `outputDir` por projeto. Hoje os dois estão em `off` por padrão e não há furo, mas
      `video: 'on'` reabriria a evasão que a correção de 20/09 fechou, e a linha do runbook não cobre
      porque vídeo **é** saída do Playwright (`privacy-guardian`)
- [ ] **Primeira da fila** (`privacy-guardian`): guarda sobre `ARQUIVOS_AMBIENTE_TESTE` e a ausência
      de `process.env` em `tools/ci/compose.ts`. O runbook agora afirma **por escrito** que o artefato
      público do e2e é inofensivo porque o ambiente de teste sai só de `.env.example` e
      `infra/teste.env`, versionados. Afirmação de segurança em documento sem teste que a sustente é a
      mesma forma de furo que a correção de 20/09 fechou no `trace`
- [ ] `docs/lgpd.md` seção 4 — linha de furo conhecido: artefato de esteira em repositório público
      (traço do e2e, conteúdo sintético, 7 dias), para a próxima publicação de artefato encontrar a
      decisão escrita onde se procura (`privacy-guardian`)
- [ ] Logs dos serviços dentro de `test-results/` antes da publicação, para o artefato ter a ponta do
      servidor da linha de tempo (`infra-guardian`). **Atenção:** log de serviço não tem a garantia de
      sinteticidade que o traço do Playwright tem por construção, e o repositório é público — fazer
      isso muda a classe do que se publica e exige decidir de novo com o `privacy-guardian`
- [ ] **Defeito do hook de revisões:** `tools/processo/revisoes.ts:342` decide caducidade por
      `statSync(...).mtimeMs`, não por conteúdo. Revisor que faz teste de mutação (mutar e restaurar)
      move o `mtime` sem mudar uma linha, e **invalida a própria rodada ao fazer o trabalho que se
      espera dele** — custou duas rodadas na correção de 20/09. Comparar hash de conteúdo
      (`git hash-object`) encerra a classe
- [x] ~~**Defeito do hook de revisões:** rodada registrada na tabela do documento sem bloco de
      achado~~ — fechado na correção `2026-09-22-achado-de-revisao-nao-cabe-na-janela`. A causa era o
      regex que decidia guardar a rodada aprovada: exigia `Recomendações:` com dois pontos, e
      `## Recomendações (não bloqueiam)` seguido dos itens não casava. Agora quem decide é
      `exigenciaDaRodada`, que lê as sete formas que os revisores usam
- [x] ~~**Defeito do carimbo do portão local**, nas duas metades~~ — corrigido em 22/09/2026
      (`tasks/correcoes/2026-09-22-hook-do-commit-ignora-o-instantaneo-de-conteudo.md`): o instantâneo
      do portão passou a ser gravado com o conteúdo do **início** da corrida, e o portão recusa o
      carimbo se algo mudou enquanto ele rodava; e `avaliarPortao` passou a receber os instantâneos,
      com `documento` e `instantaneos` obrigatórios na assinatura, para esquecer o repasse não compilar
- [ ] **Duas sessões na mesma árvore não passam pelo portão.** O portão é de árvore inteira e o
      carimbo é um arquivo só (`.processo/portao.json`). Em 21/09, com duas sessões abertas: um
      portão saiu vermelho em 5 testes de integração que passavam sozinhos (disputa de container),
      e um `git reset --hard HEAD` de uma sessão apagou o trabalho não commitado da outra. Decidir o
      combinado — uma sessão por vez, ou worktree separada por sessão
- [x] ~~Guarda de lint para `start`/`up` sem `aguardarSaudavel`~~ — feita na retrospectiva do F1
      (`guardas/esperar-servico-do-compose`), com fixture e teste. Vale só em teste, deixa passar
      `up --wait`, e ao ser ligada apontou a última ocorrência aberta do repositório
- [ ] `aguardarSaudavel` depende do healthcheck de `interval: 2s` (`infra/compose.yml:44`), então o
      portão de saúde tende a chegar depois de o cliente já ter reconectado. Se algum teste precisar
      medir a latência de reconexão de fato, o ponto de partida honesto é o `ready` do cliente, não o
      healthcheck (`infra-guardian`, 20/09/2026)

Pendências de processo da retrospectiva da A1 (`tasks/prd-apresentacao-escola/retro.md`, "Decisão"). São mudanças em
código de `tools/processo/`, que pedem teste e revisão, por isso não entraram com o texto das skills.

- [ ] **Portão local sem o `dist` dos pacotes** (proposta 5 da retro da A1). A esteira começa do clone, sem
      `packages/*/dist`, e um dist velho na máquina deixou passar o vermelho da 17.0. O portão
      (`tools/processo/portao-local.ts`) remove `packages/*/dist` antes do `test` e de novo antes do `e2e` (um `ops:*`
      rodado pelo `test` reconstrói o dist), com o teste que roda o portão como processo
      (`tools/processo/revisoes.test.ts`): com um `packages/shared/dist` plantado, o e2e não o vê. Antes, verificar que
      o vitest e o typecheck não dependem do dist. Até lá, a guarda de `tools/ci/playwright.test.ts` (correção
      `e2e-sem-dist-do-shared`) fecha o caminho que causou o vermelho. Destino: correção própria
- [ ] **O hook cobra o `revisor-geral` na correção grande** (proposta 12 da retro da A1). O `/corrigir` já diz que ele é
      obrigatório com mais de 5 arquivos fora de `tasks/` ou com `.github/`, `tools/ci/` ou `tools/processo/`; falta o
      hook (`revisoresObrigatorios`, em `tools/processo/revisoes.ts`) exigir isso sem depender de a linha "Subagentes
      obrigatórios" do documento o listar. Destino: correção própria
- [ ] **Stashes antigos no `git stash`, para o Joaquim decidir** (dono: Joaquim). Continuam lá o "tarefa 1.0 A0
      aprovada, aguardando esteira", de 23/09, e o "resto do pop abortado do stash de 18/09". Conferir se o conteúdo já
      está em algum commit antes de qualquer `drop`. Ninguém descarta sem ele

Pendências de código da A0b que a retrospectiva deixou (`tasks/prd-apresentacao-painel/retro.md`, "Pendências de
código"), com o destino de cada uma. As pequenas foram fechadas na correção `2026-09-25-acabamento-da-a0b`.

- [ ] **Defeito, `/corrigir` próprio: o `desfazer` do contador de tentativas pode descontar do lugar errado**
      (`apps/api/src/sessao/contador-de-tentativas.ts`, `ContadorDeTentativas.desfazer`; `infra-guardian` da 4.0 da A0b).
      Ele desfaz no seguro em memória e, com o Redis `ready`, também no Redis, sem saber onde a tentativa foi contada. Se a
      reserva caiu no seguro (Redis fora naquela hora) e o Redis voltou antes do `desfazer`, o `SCRIPT_DESFAZER` tira do
      Redis uma falha que ele nunca contou, e libera uma falha real: é o lado que a regra do contador proíbe (errar só para
      o lado de segurar). O docblock hoje aceita o caso. Só acontece depois de senha ou código certos e com o Redis
      voltando no meio da tentativa. Correção: a `Reserva` liberada guarda onde foi contada (`redis` ou `seguro`), e o
      `desfazer` age só lá, com teste que reserva no seguro, liga o Redis com uma falha de antes e confere que ela continua
- [ ] Aceite do convite de operador e `renovar` em paralelo, e aceite e segundo fator em paralelo, sem teste de
      concorrência próprio; o rebaixamento do `convite/aceitar` com o Redis de cache fora só é provado pelo C36, com
      limitador falso (`test-engineer` da 9.0 da A0b). Destino: próxima tarefa que tocar
      `apps/api/src/operacao/convite-operador.service.ts` ou `sessao.service.ts` da operação
- [ ] Página e `total` do painel em duas consultas paralelas, com fotografias diferentes do banco: uma escola criada entre
      as duas deixa o total fora da página (`apps/api/src/operacao/painel.repository.ts`, `TOTAL_DE_ESCOLAS` e
      `escolasDaPagina`; 5.0 da A0b). Ler o total na própria consulta da página, com `count(*) over ()` antes do `limit`,
      também tira uma conexão. Destino: próxima tarefa que tocar `painel.repository.ts`
- [ ] `apps/web/src/operacao/paginas/Uso.tsx`: o `VazioDoUso` (`:114`) repete o `EstadoVazio`; e o número longo com
      `wrap-anywhere` (`:75`, `:101`) pode quebrar no meio entre 640 e ~760 px (`revisor-geral` e `frontend-reviewer` da
      8.0). Destino: próxima tarefa em `Uso.tsx` (a A2 deveria trazer o consumo de IA para esta tela e não trouxe: ver
      "Consumo de IA no painel da operação", no fim)
- [x] ~~`apps/web/src/rotas.tsx:53`: o `componentWillUnmount` da fronteira de erro não tem teste (`test-engineer` da
      10.0)~~ — feito na 11.0 da A1: a fronteira saiu para `apps/web/src/componentes/FronteiraDaArea.tsx`, o título da
      falha passou para o gancho `useTituloDaAba` da tela da falha, e o W5 de `e2e/areas.spec.ts` prova que sair dela pelo
      "Sair" devolve a aba ao título de antes
- [ ] `apps/web/src/operacao/paginas/Convite.tsx`: o `hashchange` não zera `aceitando`, e o botão do link novo fica
      desligado ("Salvando…") enquanto o aceite do link anterior está no ar, sem dizer por quê; o descarte do desafio só é
      seguro por isso, e a dependência precisa de um comentário junto ao `aoMudarOFragmento` (`revisor-geral` e
      `test-engineer` da 10.0). Destino: próxima tarefa em `Convite.tsx`
- [ ] `apps/api/test/arquitetura.test.ts`, `comandosDaMigration`: tira o comentário `--` antes do texto entre aspas, e um
      literal como `DEFAULT '--'` corta a linha e faz `tabelasSemEscola` ler errado o resto da migration. Hoje não existe
      esse caso (`revisor-geral` da 10.0). Destino: próxima tarefa que tocar esse teste, ou a primeira migration com `--`
      dentro de texto
- [ ] O anúncio atrasado "Escola X criada." (`role="status"` de `apps/web/src/operacao/paginas/Escolas.tsx:228`) fica fora
      do `<dialog>` modal reaberto, inerte para o leitor de tela: quem o usa pode não saber que o pedido cancelado criou a
      escola e repetir. No Nova rede nada segura o duplicado (`frontend-reviewer` da correção `7d495d0`). Destino: próxima
      tarefa que tocar `Escolas.tsx`
- [ ] `apps/api/src/operacao/painel.service.ts:62` (`naEscola`): o mesmo caminho morto que a correção
      `2026-09-25-acabamento-da-a0b` tirou do segundo fator, `contextoAtual() ?? { requisicaoId: randomUUID() }`. Aqui a
      linha é escrita depois da gravação, então a falha fechada vai no começo do caso de uso, não no log. O mesmo vale para
      `refazerConviteDaCoordenacao` (`apps/api/src/sessao/convite.service.ts`), que só o painel chama; no gerar e no
      revogar o fallback é vivo, porque os comandos `ops:*` rodam sem requisição (`tenancy-guardian` da correção). Destino:
      próxima tarefa que tocar `painel.service.ts` ou `convite.service.ts`
- [ ] Contador `banco.conexao_descartada{causa}`, separando erro de consulta e erro da conexão: hoje o descarte não
      aparece em métrica nenhuma, só a queda das conexões em uso, e o failover do Postgres gerenciado precisa ser sinal
      próprio (`infra-guardian` da correção `577d185`). Destino: antes do staging (D31)
- [ ] Professores com o mesmo nome na tela Professores da coordenação (A1, 14.0): a lista traz só usuário, nome e estado
      (sem e-mail, para não dizer se a conta do e-mail existia, E11), e duas pessoas de mesmo nome dão duas linhas e dois
      "Refazer o convite de …" iguais; o link refeito de uma pode ir para a outra. A tela avisa o nome repetido no resumo
      do cadastro, sem impedir. O desempate de verdade é o e-mail na linha, que muda o contrato da 3.0
      (`esquemaProfessorDaEscola`) e o E11 (`test-engineer` e `frontend-reviewer` da 14.0). A consequência, pela matriz
      de estados (leitura do `privacy-guardian`, não reproduzida): quem recebe o link errado define a senha da conta da
      outra pessoa; a linha vira `aceito`, que não tem refazer nem revogar, e recadastrar o e-mail dá `CONFLITO`; a pessoa
      certa fica sem caminho até o reset de senha (F2). É o mesmo risco da conta global da Tech Spec da A1, seção 13,
      tolerado enquanto o dado for sintético. Posição do `privacy-guardian` para a decisão: o e-mail na linha é aceitável
      (está na tabela de dados, e foi a coordenação que o digitou), com três condições — só nas linhas com convite em
      aberto (`pendente`, `vencido`); decidir se a origem é o e-mail global da conta ou o que a escola digitou (campo
      novo, com linha própria no `docs/lgpd.md`); e o E11 passar a provar que o e-mail aparece igual nos dois casos.
      Destino: junto da prova de posse do e-mail do "Portão da primeira escola real" (`ROADMAP.md`)
- [ ] A trava do pedido no ar e o alerta com foco existem duas vezes na web: `useEnvioUnico` e `AlertaDaFalha`, em
      `apps/web/src/componentes/dialogos.tsx` (A1, 13.0; vieram para `componentes/` na 15.0, e o `useEnvioUnico` passou a
      receber as opções da mutação, com que o acesso da turma já o usa), e o `noAr` de
      `apps/web/src/componentes/DialogoDoConvite.tsx` com o `Falha` de `componentes/copia-unica.tsx` (da A0b). O diálogo
      do convite passar a usar o `useEnvioUnico`, e o `Falha` e o `AlertaDaFalha` virarem um só, deixa um jeito só
      (`revisor-geral` da 14.0).
      Não é troca de nome: o `Falha` leva o foco de novo a cada erro, e o `AlertaDaFalha`, só quando o texto muda, e a
      trava do diálogo está sob o e2e da A0b e as mutações da 14.0. Na mesma correção: o mapa
      `TEXTOS_DO_CONVITE_QUE_MUDOU` de `areas/coordenacao/convite-de-professor.ts` difere por uma letra do texto
      `TEXTO_DO_CONVITE_QUE_MUDOU` que o arquivo importa; dar ao mapa um nome que diga o que ele é (`revisor-geral` da
      14.0, 2ª rodada). E `linkDoConvite` e `copiarLink` (`componentes/link-do-convite.ts`) já montam também o link da
      sala e copiam o convite inteiro do WhatsApp: `linkComToken` e `copiarTexto`, ou equivalente (`revisor-geral` da
      15.0); e `codigoEmDoisGrupos` (`areas/professor/acesso-da-turma.ts`) é só outro nome de `exibirCodigoDaTurma`. Destino: correção própria
- [ ] Acesso da turma (A1, 15.0): o gerar espera a releitura da seção antes de mostrar o link e o código
      (`apps/web/src/api/acesso.ts`, `onSettled`). Numa rede que engasga, o diálogo fica em "Gerando…" com o acesso já
      gerado no servidor. O `frontend-reviewer` sugere mostrar o acesso assim que o `POST` responde e recarregar a seção
      por trás; pede resolver junto o foco de quem fecha antes da releitura (o "Gerar acesso" do vazio some) e a seção
      que afirma "Sem acesso ativo" nesse intervalo. Decidido no `/validar` da A1 (04/10/2026): não segura a A1, porque o
      acesso já fica gerado no servidor e a demonstração usa dado sintético. Destino: correção de acabamento antes da
      primeira demonstração externa
- [ ] Testes do fim do vínculo (N2 e N3 da validação da A1, rodada 2): em `apps/api/test/acesso-fim-do-vinculo.int.test.ts`,
      falta o caso do professor com vínculo em duas escolas, em que a eliminação na escola A não pode revogar o acesso que
      ele gerou na B, pelo caminho da eliminação (`tenancy-guardian`); e o teste da trava do vínculo pendente termina em
      `await eliminando` sem conferir que o vínculo saiu e que não ficou acesso vigente (`test-engineer`). Destino: a
      próxima tarefa que tocar o arquivo, ou o F2
- [x] Encerrar o vínculo do professor não revoga o acesso da turma que ele gerou (A1, 4.0; achado do `privacy-guardian`
      na 15.0; G1 da validação da A1). Resolvido pela correção `2026-10-03-acesso-sobrevive-ao-vinculo`
      (`tasks/correcoes/2026-10-03-acesso-sobrevive-ao-vinculo.md`): o fim do último vínculo confirmado dele na turma
      (encerrar ou eliminação) revoga, na mesma transação e com auditoria, o acesso vigente que ele gerou
- [ ] A desativação do professor (`CicloDeVidaService.desativar`, 17.0) não encerra os vínculos dele nem revoga o acesso
      da turma que ele gerou: ele deixa de entrar, mas o link e o código que já tem continuam abrindo a sala até vencerem.
      Fechar junto com a tela de estrutura do F2 (que chama a desativação): ou a desativação encerra os vínculos pelo
      mesmo caminho do encerrar (e a revogação vem junto), ou revoga o acesso dele com a mesma trava da turma. Ficou fora
      da correção `2026-10-03-acesso-sobrevive-ao-vinculo`, que cobre o fim do vínculo. Junto, a janela que o
      `infra-guardian` registrou na eliminação: a coordenação cria um vínculo novo do mesmo professor numa turma ainda não
      travada, e ele confirma e gera antes do `delete` dos vínculos (improvável; fecha quando a trava passar a ser no
      usuário). E o `40P01` que ainda sai `ERRO_INTERNO` (`mapear-erro-postgres.ts`): `CONFLITO` ou uma nova tentativa,
      numa correção geral. Destino: F2, antes do portão da primeira escola real
- [ ] `Referrer-Policy` na borda (`no-referrer` ou `same-origin`): a aba do `wa.me` que o botão do WhatsApp abre recebe
      a origem da web como referência (`privacy-guardian` da 15.0). Não é dado pessoal; fecha com os cabeçalhos de
      segurança da borda, com o `infra-guardian`
- [ ] O formato do token opaco de 43 caracteres base64url está em dois lugares: `esquemaTokenDeLink`
      (`packages/shared/src/sessao/token.ts`: convite da coordenação, link da sala e, desde a 14.0 da A1, o convite de
      professor) e o `FORMATO_DO_REFRESH` (`apps/api/src/sessao/renovacao.service.ts` e
      `apps/api/src/operacao/sessao.service.ts`). Unificar os dois da API no mesmo formato (`revisor-geral` da 4.0 da A1).
      A 14.0 fez a parte do convite de professor; o refresh é da API de sessão, fora de uma tarefa de tela. Destino:
      correção própria

## Regulação educacional

- [ ] Acompanhar a homologação pelo MEC e a publicação das diretrizes do CNE; ler o texto
      oficial e revisar a regra 70, principalmente correção de discursiva e redação (D46, D55)
      e a classificação dos sinais do tutor. **É o que decide se a devolutiva formativa de
      discursiva volta a existir no produto**
- [ ] Acompanhar a **regulamentação da ANPD sobre o art. 11 do Decreto 12.880/2026** (IA
      conversacional com criança e adolescente): pode trazer requisito técnico novo para o
      Tutor (D58, D59)
- [ ] Ler e destrinchar em requisito: **Guia de Classificação Indicativa do MJ (out/2025),
      capítulo Interatividade** — o MEC manda o desenvolvedor segui-lo; **Resolução CNE/CEB
      2/2025** (Educação Digital e Midiática); **Children & AI Design Code** (5Rights, 2025)
- [ ] Verificar se Santa Catarina tem lei estadual sobre aparelhos na escola além da Lei
      15.100
- [ ] Transformar a conformidade em material de venda: "já estamos dentro do prazo de 12 meses"
- [ ] Confirmar exigências de registro escolar da rede alvo

## Material didático

- [x] ~~**O documento que a coordenação sobe na demonstração** (D75): nosso ou de domínio
      público, com a licença declarada, de uma disciplina que renda boa demonstração. Não é
      material pré-carregado: não há seed de escola nem de material (D71 revista). Antes do PRD
      da A2 (D5)~~ — feito no MVP: "Química 2, cap. 7 — Estequiometria", texto original da equipe
      Turmma, em `tools/demonstracao/quimica-2-cap-7-estequiometria.pdf`, gerado por
      `tools/demonstracao/gerar-material.ts`; a licença declarada na tela está no passo 1 de
      `docs/roteiro-da-demonstracao.md`

- [ ] Modelo de autorização escrita da escola para cada fonte de material
- [ ] Parecer sobre direito autoral da ingestão (Lei 9.610, art. 29, IX; termos de Arco/SAS,
      Positivo, Bernoulli e Somos), incluindo apostila impressa escaneada (D5 revista)
- [ ] Buscar parceria ou licença com editora ou sistema de ensino para uso do material na
      base da escola
- [ ] Levantar quais sistemas de ensino as escolas alvo usam e se elas têm material próprio
      ou PDF licenciado (decide o primeiro material do piloto e o primeiro adaptador, D22)
- [x] ~~Decidir: adaptador por fonte ou extração genérica~~ — upload primeiro, adaptador por
      fonte quando houver escola real (D22)
- [ ] Conjunto fixo de amostras para medir qualidade da extração e da classificação BNCC
- [ ] Baixar e organizar as provas oficiais do ENEM do INEP para o banco público (D21)
- [ ] Verificar licença de uso das provas de vestibular antes de incluir qualquer uma

## Produto

- [x] ~~Fechar o que da revisão dos mockups trava o PRD da A1~~ — em 23/09/2026: um agente por
      pessoa (D32, D9 e D60 revistas), a pele e o padrão de espaço (D72), a navegação do professor
      (D73). Continuam em `docs/pendencias-dos-mockups.md` os que pedem `/descobrir` antes de
      qualquer PRD: **projetos**, **anexo na conversa** (abre a porta para correção de discursiva
      por IA: D55) e **faltas** (não existe no roadmap nem na tabela da LGPD)
- [ ] **Catálogo de ferramentas (P22 a P25).** A regra e as quatro categorias estão na D74. Falta
      passar por `/descobrir` as oito ferramentas que a D67 não lista (planejamento do período,
      projeto, plano de recuperação, mapa mental, roteiro de experimento, avaliação diagnóstica,
      proposta de redação, importar prova), uma a uma, antes de entrarem no F7. A ferramenta como
      dado (P23) entrou no MVP: um motor de formulário só, em
      `apps/web/src/componentes/ia/motor-formulario.ts` e `MotorFormulario.tsx`
- [ ] **Sétima e oitava rodadas dos mockups (P26 a P31).** A pele ficou uma só (D72), e como a do
      produto não copia a Teachy, a consulta ao advogado sobre cópia fiel (P31) só volta se alguém
      propuser copiar de novo. O seletor de escola que troca o token (P30) e o convite por link,
      WhatsApp e código (P27) entraram na A1. Antes do PRD do F6: as abas da turma aberta além de
      Visão Geral e Alunos, as duas que o MVP entregou (P28). Por `/descobrir`: **ranking de participação**
      (P26, bate na 10.2 do `docs/interface.md` e na D57), **Recursos** e **Mural** (P28)
- [x] A1 (antes era o F2): o vínculo de aluno criado pela lista de nomes precisa nascer com `decidido_em` preenchido. A lista de alunos do ano encerrado (10.0) só traz quem chegou confirmado ao fim do ano, e hoje só a fixture de teste grava esse campo: sem ele, o aluno some do histórico da turma — feito na tarefa 8.0 da A1 (`VinculoRepository.criarAlunoConfirmado`, E19)

- [x] ~~Fechar a lista de agentes e o nível de autonomia de cada um~~ — D32 a D36; lista
      revista em 19/09/2026 para seis agentes e em 23/09/2026 para três, um por pessoa da escola,
      com a autonomia por função (D32, D9)
- [ ] Validar com advogado a base legal para guardar a adaptação necessária do aluno (D35),
      agora lida também pelo Tutor para ajustar a forma da conversa (D66)
- [ ] **Lista padrão de fontes aprovadas** da busca do Tutor, por faixa etária (anos finais e
      Ensino Médio), com critério escrito de entrada e de saída; e escolher o provedor de busca,
      que entra como suboperador (D68). Antes do PRD do F9
- [ ] Decidir de onde vêm as imagens da ferramenta de apresentação, e com que licença (D67, D5).
      Antes do PRD do F7
- [ ] Fechar os indicadores de turma e aluno de Turmas **antes do PRD do F6** (D69, D73), junto
      com os limiares provisórios que o MVP mostra (sinais do Tutor, destaques da correção, 60% do
      alerta do Analista; Estado de `docs/mvp-rapido.md`).
      Ponto de partida: percentual de erro e acerto por habilidade, e "concluiu o que foi
      atribuído". Tempo ocioso e navegação não entram
- [ ] **Guia para a TI da escola** bloquear outras IAs no computador do aluno (Google Admin,
      filtro da rede). É a resposta ao pedido de "avisar quando o aluno usa outra IA", que o
      produto não faz (D70). Entra no dossiê (D61)
- [ ] Texto da mensagem fixa de acolhimento do tutor, revisado por uma orientadora
      educacional de verdade (D36)
- [ ] **O encaminhamento do assunto delicado (D36) gasta uma das 60 trocas do dia (D38)?** Em 12/10/2026 o Joaquim
      ficou com **"gasta, por ora"**; a resposta definitiva segue aberta. O que o código faz (`develop` em `bbae49e`,
      verificação do Arquiteto):
      - **com o freio esgotado, o texto que casa com os gatilhos é encaminhado e recebe o 188:**
        `apps/api/src/tutor/tutor.service.ts:164` vem antes do orçamento (175-176), e o `#encaminhar` (318) não
        consulta o freio. Provado em `apps/api/src/tutor/tutor.int.test.ts:322` e, na tela, em
        `e2e/aluno-tutor.spec.ts:316` (API simulada)
      - **o que os gatilhos não pegam, no limite, não chega ao modelo** (`tutor.service.ts:175-176`): o aluno vê
        "Por hoje acabou", sem o 188, sem a indicação de um adulto e sem sinal ao professor
        (`apps/web/src/areas/aluno/tutor.ts:65-70`). Vale igual com avaliação aberta, pacote esgotado e função
        suspensa. Decidir junto se o aviso de pausa ganha uma linha fixa apontando para um adulto e para o 188
      - **o encaminhamento conta:** a pergunta entra com `autor = 'aluno'` e a execução `concluida`
        (`tutor.service.ts:335-340`), e as quatro contas leem essa linha sem olhar o tipo do turno: o freio e o
        pacote do mês (`apps/api/src/ia/orcamento.repository.ts:63`), o "Hoje: N de 60" do aluno
        (`apps/api/src/tutor/tutor.repository.ts:390`) e as duas do professor
        (`apps/api/src/tutor/supervisao.repository.ts:278` e `:298`). Na 59ª troca, o encaminhamento ocupa a 60ª; no
        limite, a conta passa de 60 e a tela a prende em "60 de 60"; cada um tira uma troca do pacote da turma
      - **contar não limita nada:** o encaminhamento passa na frente do freio e custa zero token; o laço segue sem
        teto próprio (item "Assunto delicado sem teto de IA", abaixo)
      - **a conta está fixada em teste desde 12/10/2026** (correção `2026-10-12-encaminhamento-gasta-troca`,
        `c6e8511`): o grupo "o encaminhamento gasta uma troca, por ora" de `apps/api/src/tutor/tutor.int.test.ts`
        (1 depois do encaminhamento; na 59ª troca ele ocupa a 60ª; no limite, 61 de 60, com o estado `limite`), e
        `e2e/aluno-fluxo.spec.ts` passou a esperar `Hoje: 1 de 60 perguntas`, sem a corrida com a releitura da
        conversa. Se a resposta virar "não gasta", esses casos mudam junto
      - **o que os revisores da correção deixaram** (tabela "Recomendações sem aplicar" de
        `tasks/correcoes/2026-10-12-encaminhamento-gasta-troca.md`): o 61 de 60 confirma o laço sem teto do item
        "Assunto delicado sem teto de IA"; o aluno que relata algo pessoal na 59ª troca perde a última dúvida comum
        do dia, que pesa para "não gasta"; falta um caso que afirme a conta no pacote do mês (`porMes`), para a
        primeira tarefa que alterar o arquivo com o pacote; e falta um caso com duas chamadas em paralelo e a mesma
        chave no encaminhamento, provando que a troca conta uma vez só (pode achar defeito de produção, que seria
        `/corrigir` próprio)
      - **se a resposta virar "não gasta":** as quatro consultas mudam juntas, pelo `tipo` da resposta do turno, como
        `turnosParaATarefa` já filtra (`tutor.repository.ts:349`); é código do Tutor (`infra-guardian` e
        `conformidade-reviewer`) e muda o número que o professor vê (D8)
      (dono: Joaquim)
- [x] ~~Definir teto de uso do tutor por aluno e orçamento de tokens~~ — D38, D39, D41
- [x] ~~Decidir o modelo de cobrança~~ — por aluno, uso incluso, sem crédito (D40)
- [x] ~~Decidir se o aluno acessa de casa desde o início~~ — escola decide por turma (D19)
- [x] ~~Definir o que o coordenador precisa ver na primeira semana~~ — as quatro coisas do D24

## Marca e interface

- [ ] **O script do tema em linha entra por hash quando o F16 servir política de segurança de conteúdo** (X1,
      tarefa 2.0): o `apps/web/index.html` tem um `<script>` em linha, sem `type="module"`, que escreve o `data-tema`
      no `<html>` antes do primeiro quadro (`educa.aparencia`; `src/tema.ts` repete a conta). Hoje o `Caddyfile`
      não serve nenhuma política (`Content-Security-Policy`), e o script roda. Com uma política de `script-src` sem
      `'unsafe-inline'`, o script precisa do hash `sha256` dele em `script-src`, calculado no build, e o teste de
      `tema.test.ts` (que extrai o script do arquivo) é o que garante que o hash e o arquivo continuam o mesmo. Sem
      o hash o tema volta a ser aplicado só depois do React, e a página pisca no escuro (RF3). Ao servir a política,
      conferir que o hash em `script-src` não abre caminho para `'unsafe-inline'`. E, junto, pôr no `docs/lgpd.md` uma
      linha que diga que o navegador guarda só preferência de aparelho (`educa.aparencia` e `educa.lateral-recolhida`),
      sem identificador, e que aponte para `docs/interface.md` seção 6: não é dado pessoal, e a tabela de dados não
      ganha linha
- [x] ~~Identidade visual (paleta, tipografia, logo)~~ — existe e está fora deste repositório:
      manual da marca Turmma, com caramelo `#E8732E`, azul-noite `#16233E`, creme `#FFF3E2` e
      papel `#FDFBF7` (D54). É a pele da landing page; a do produto é a da D72
- [x] ~~Landing page~~ — existe em `turmma.com` (fora deste repositório)
- [x] ~~Trazer a paleta, a tipografia e o logo para o repositório~~ — já estão em `mockups/`
      (`src/index.css` e `public/marca/`), e a A1 leva de lá para o `apps/web` (D72)
- [x] ~~O avatar de cada um dos três agentes~~ — decidido na D80 (12/10/2026): a cabeça da onça, com o anel na cor
      do agente, sempre com o nome da função e o selo "IA". Entra na X1 (`pele-e-casca`, tarefa 8.0)
- [x] ~~Grupos da lateral da coordenação (F3, validação, M2)~~ — decidido na D80 (12/10/2026): quatro lugares (Painel,
      Analista, Escola e Registros), com Privacidade dentro de Registros. Entra na X2 (`telas-da-coordenacao`)
- [ ] Identificar no 21st.dev o autor e a licença das peças que o Gabriel colou direto no
      mockup (área de soltar arquivo, miniatura de arquivo, pasta animada, `leaderboard-*` e as duas
      da HextaUI) e conferir a do calendário `vaib215/event-manager`, antes de qualquer uma entrar no
      código (P20)
- [ ] **Foco durante o pedido e ao trocar de tela** (`frontend-reviewer`, 13.0 da A1): o botão que fica `disabled` enquanto
      o pedido está no ar perde o foco para o `body` (medido em "Alocar", "Ver a prévia", "Ver mais nomes" e "Abrir o ano
      letivo"; vale para o `Botao` e o secundário de todas as telas, também as da operação), e abrir uma tela pela lateral
      ou por link não leva o foco ao `<h1>`. A 12.0 resolveu o primeiro no `SeletorDeEscola` com `aria-disabled`; falta o
      padrão no `Botao`, com o estilo do desligado, e o foco na troca de rota, na casca. E o erro de campo do `Campo` não
      tem região viva: quando o foco já está no campo com erro (Enter com o foco nele), o leitor de tela pode não ler.
      Na lista colada da Estrutura (`ListaDaTurma.tsx`), o alerta que volta porque o texto voltou ao recusado é
      `role="alert"` e é lido de novo (`AlertaSemFoco`), a rever em teste com leitor de tela (3ª rodada da 13.0)
- [ ] **Encerrar alocação pela tela** (`frontend-reviewer`, 13.0 da A1): a API tem `POST /v1/vinculos/:id/encerrar` e
      nenhuma tela o usa. O professor alocado na turma errada não se desfaz pela Estrutura, o vínculo `contestado` não
      oferece ação, e a turma com alocação não se exclui. Decisão de produto (o que a coordenação pode desfazer, e com
      que aviso ao professor), a levar para o `/validar` da A1
- [ ] **Listas da Estrutura sem virtualização** (`frontend-reviewer`, 13.0 da A1): turmas, disciplinas e alocações rendem
      até 1.000 cartões. Cabe numa escola do recorte (dezenas); rever se a alocação de uma escola passar de algumas
      centenas (regra 50, item 1). Junto: a Alocação lê até 1.000 vínculos e 1.000 professores e, acima disso, corta sem
      o aviso que turmas e disciplinas têm (`revisor-geral`)
- [ ] **O chip "da web" da conversa com IA** (`frontend-reviewer`, 10.0 da X1): a variante de borda tracejada não é
      desenhada porque nenhuma citação vem da web hoje (D68 nasce com a busca, no F9, desligada por padrão). Quando a
      busca entrar, o `ChipFonte` ganha a variante, com o link e o `Citacao` que o contrato passar a ter
      (`docs/interface.md` 10.2)
- [ ] **Texto de exemplo do `Campo` de linha única truncado a 360 px** (`frontend-reviewer`, 10.0 da X1): o placeholder
      "Tema" do `MotorFormulario` é cortado no `celular`; o `Campo` não mede o exemplo como a `CaixaPedido` faz. Peça
      de `componentes/`, fora da 10.0; rever no `/retro` da X1
- [ ] **A demonstração `data-tabela-estreita` da galeria mostra a tabela em modo largo** (`frontend-reviewer`, 10.0 da
      X1): a 280 px (`apps/web/src/galeria/secoes/superficies.tsx`) corta "AGENTE E FUNÇÃO". Peça de outra tarefa
- [ ] **`violacoesDasSecoes` repete o `violacoesGraves`** (`test-engineer`, 10.0 da X1): `e2e/pecas-ia.spec.ts` tem um
      axe por seções que repete a lógica do helper de `e2e/__fixtures__/verificacoes.ts`; o helper passaria a aceitar a
      lista de seções. O helper é de outros specs e ficou fora da 10.0
- [ ] **`CLASSES_DA_OPCAO` da `Escolha` repete a cor do secundário** (`revisor-geral`, 10.0 da X1): a face, a borda e o
      desligado são os de `botao-secundario.ts` (`COR_DO_SECUNDARIO`, `DESLIGADO`). Exportar de lá e compor evita a
      cópia que diverge; o arquivo é de todo `Botao` e ficou fora da 10.0
- [ ] **A caixa desligada do Tutor, quando entrar numa tela** (`conformidade-reviewer`, 10.0 da X1): conferir que o
      texto do campo desligado não pede ao aluno que espere ou volte (regra 70, item 4b). Hoje só existe na galeria
- [ ] **A caixa desligada no tema escuro não se distingue pelo fundo** (`frontend-reviewer`, 10.0 da X1): `fundo-suave`
      e `campo` têm o mesmo valor no escuro (`apps/web/src/estilos.css`), e o campo desligado da `CaixaPedido` só se
      diferencia pelo texto `apoio`. Dar um sinal que não dependa do fundo; o `Campo` desligado tem o mesmo par de tokens
      (`docs/interface.md` 10.2). Muda peça que a 6.0 revestiu: levar ao `/retro` da X1
- [ ] **Teste do desfazer da `CaixaPedido`** (`test-engineer` e `revisor-geral`, 10.0 da X1): em
      `CaixaPedido.test.tsx › apagar o pedido não escreve no campo`, o teste redefine `value` por cima do rastreador do
      React, então a regra de verdade é a do Ctrl+Z do e2e (`e2e/pecas-ia.spec.ts`); dizer isso num comentário, e trocar
      o `toBeLessThanOrEqual(1)` por `escritas` igual a `['']`
- [ ] **Classes do campo e do espelho da `CaixaPedido` escritas duas vezes** (`revisor-geral`, 10.0 da X1): letra e
      respiro do `textarea` e do espelho repetem as mesmas classes; uma constante única. Hoje o teste "o espelho é só para
      medir" segura a igualdade
- [ ] **`TITULO_DA_NOVA_CONVERSA` guarda `'Início · Turmma'`** (`privacy-guardian`, 12.0 da X1): o nome da constante
      (`e2e/__fixtures__/casca.ts`) é o do rótulo antigo. Renomear (para `TITULO_DO_INICIO`) quando os specs que a usam
      forem mexidos de novo; ela é lida por specs fora da 12.0
- [ ] **Comentários "Nova conversa" em specs fora da 12.0** (`test-engineer`, 12.0 da X1): `e2e/inatividade.spec.ts:50`,
      `convite.spec.ts:187`, `entrar.spec.ts:44`, `escola-e-vinculos.spec.ts:57` e `:146`, `operacao.spec.ts:327`,
      `professores.spec.ts:507`, `professor-assistente.spec.ts:68` e `__fixtures__/fluxo-do-professor.ts:34`. Trocar por
      "Início" quando cada arquivo for mexido (mexer só no comentário caduca a revisão de spec que não é da 12.0)
- [ ] **O trilho da coordenação não tem folga a 600 px** (`frontend-reviewer`, 12.0 da X1): a 1366 × 600 o "Sair" passa em
      `toBeInViewport({ ratio: 1 })` por pouco, e o trilho não rola (a dica `absolute` seria cortada). Um oitavo lugar na
      coordenação derruba o "Sair" da janela; reabre com o oitavo lugar, ou com a barra de baixo da 13.0 mexendo no trilho
- [ ] **A lateral da coordenação a 1366 × 768 corta "PRIVACIDADE" pela metade** (`frontend-reviewer`, 13.0 da X1): o pé de
      240 px toma a altura (`CascaDaEscola.tsx`, a lateral aberta e o pé). É da 12.0 e muda o desenho da lateral; entra na
      X2 (`telas-da-coordenacao`), que reduz os lugares da coordenação a quatro
- [ ] **Celular deitado (~640 × 360): a barra de topo e a de baixo tomam 124 px dos 360 px** (`frontend-reviewer`, 13.0 da
      X1). Pede um projeto de paisagem que não existe; abrir quando houver (D51)
- [ ] **A escola na barra de topo é texto: o professor com duas escolas troca abrindo a gaveta, um toque a mais**
      (`frontend-reviewer`, 13.0 da X1). Segue `docs/interface.md` 11.1 e a regra 50, item 13; muda desenho, e entra na X3
      (`telas-do-professor`)
- [ ] **A barra de topo `sticky top-0` de 56 px não tem `scroll-padding-top`** (`revisor-geral`, 13.0 da X1): no
      Shift+Tab o foco que o navegador rola para cima para atrás dela, o mesmo problema que a barra de baixo tinha embaixo
      (resolvido na 13.0, com `scroll-padding-bottom`). Existia antes da 13.0 e muda comportamento: correção própria
      (`/corrigir`), com e2e a 360 px que leve o foco por Shift+Tab ao meio de uma tela comprida

## Comercial

- [ ] Planilha de custo de IA por aluno/mês **por pacote** → validar a margem das faixas
      (D50) e fixar o teto de IA do pacote base (D39)
- [ ] Entrevistas com 6 a 8 escolas de Joinville (coordenação e professores, particular e
      pública): como medem o professor hoje e o que ele aceitaria, onde está a grade, que
      material usam e com que licença, se têm Google Workspace ou Microsoft, qual sistema de
      gestão, quem pagaria, quanto e quando
- [ ] Escola piloto gratuita para o 1º semestre de 2027, com carta de intenção (D1 revista;
      contatos existem, nada decidido com base neles)
- [ ] Confirmar com advogado o calendário de repasse na mensalidade (Lei 9.870/1999) antes de
      prometer preço para 2027
- [ ] Levantar o número de alunos da rede pública no recorte (anos finais municipais e
      estaduais, Ensino Médio estadual) e o preço praticado em pregão
- [ ] Roteiro de demonstração para coordenador e para assembleia de pais, com o checklist do
      MEC respondido na mão (`docs/conformidade-mec.md` seção 2)
- [ ] **Evidência independente de eficácia pedagógica**: desenhar com a escola piloto uma
      medição simples e pré-registrada (tempo de preparação e correção do professor antes e
      depois; desempenho por habilidade com e sem uso), com alguém de fora assinando o
      desenho. O MEC pede pesquisa **não financiada pelo desenvolvedor**, e sem isso o
      primeiro critério de avaliação de qualquer secretaria fica em branco
- [ ] **Material de formação do professor**, exigido pelo princípio 4 e pelo critério 3 do
      MEC. Não temos nada, e é a isca comercial mais barata que existe
- [ ] Perguntar à secretaria de Joinville se existe ou pode existir **chamamento público para
      sandbox regulatório** — é o formato natural do piloto gratuito de 2027 e não passa por
      licitação (`docs/conformidade-mec.md` seção 10)
- [ ] Aproveitar setembro como pico de compra para o ano seguinte (em 2026, para
      entrevistas e piloto; venda com repasse, realisticamente, para 2028)

## Marca

- [x] ~~Nome definitivo~~ — **Turmma** (D54)
- [ ] Busca e depósito no INPI da marca Turmma, e registro do domínio `turmma.com` (e do
      `@turmma.ai`). É o único risco que sobra do nome: se o INPI negar, a troca é de marca,
      não de código
- [ ] **(D80) Parecer sobre a pele nova, junto do INPI:** a pele toma a técnica visual do Duolingo (ilustração chapada,
      botão com degrau), com mascote, cores, ícones e fonte nossos. Confirmar com advogado que não há risco de
      concorrência desleal (a D72 recusou a cópia da Teachy por isso), antes do material de venda (Gabriel e Joaquim)
- [ ] **(D80) A onça como avatar de agente conversacional para menor:** levar ao advogado, com o parecer do ECA
      Digital (Decreto 12.880, arts. 10 e 11). As condições que a spec fixa estão na D80, item 3; as poses e a
      comemoração da X4 dependem do mesmo parecer (Joaquim)
- [ ] **(D80) Trazer o mockup de outubro para `mockups/`:** ele mora no repositório privado `Prototipo_Turmma`, do
      Gabriel, e a pasta `mockups/` daqui é a versão de setembro. Este repositório é público: decidir se entra, e
      conferir antes a licença das peças coladas do 21st.dev (P20) (Gabriel e Joaquim)
- [ ] **(D80, revisão das specs X2 a X4) O que os guardiões mandaram para fora das specs:** (a) a tela Material relê a
      cada 1,5 s enquanto houver material `processando`, e a ingestão pode esperar horas na fila de lote: rever o
      intervalo (`api/material.ts`; `infra-guardian`, X2); (b) `orcamento.consultar` e `usoDeHoje` contam as trocas do
      dia duas vezes na mesma requisição de `GET /v1/tutor/conversa` (`infra-guardian`, X4); (c) uma contagem agregada
      de pedidos de nome por professor, na API, tiraria do sino do professor as até 12 leituras por turma
      (`infra-guardian` e `privacy-guardian`, X3); (d) o texto "Aprovado por gente", na governança, soa estranho: a
      X2 recompõe a tela (`frontend-reviewer`, tarefa 1.0 da X1); (e) o staging precisa servir `/assets/*` com cache
      longo e o `index.html` sem cache, porque o script do tema mora nele (`infra-guardian`, X1)
- [ ] **(D80) Decisões que tomei por delegação nas specs X2 a X4, para o Joaquim rever:** estão na seção 12 da Tech
      Spec de cada uma (12b na X4). As que mudam o desenho do mockup: a onça fora do vazio do sino (X2); o aviso de
      atenção humana em Hoje sem nome, com "Ver quem", e o "Acesso gerado" em tela inteira (X3); o Início do aluno
      sem "Hoje: N de 60" e sem os avisos de pausa, a introdução "uma vez só" com ressalva, o texto do aviso de
      privacidade e a onça de rosto neutro, com comemoração só na entrega (X4)

## Fase posterior

- [ ] Iniciar aprovação da API oficial do WhatsApp (prazo de semanas — comece antes de precisar)
- [ ] Portal da família sobre o motor de eventos

## Antes da primeira escola real, vindo da revisão da fase 1 do MVP de apresentação (04/10/2026)

O MVP de apresentação corre com dado sintético (D71, D77). Os revisores apontaram o que precisa existir antes de
qualquer dado real:

- [ ] **(F3, 13.0) `STORAGE_URL_PUBLICA` no staging e na produção:** a URL assinada do arquivo do titular leva o host na assinatura,
      e o compose local aponta para `127.0.0.1:${STORAGE_PORTA_HOST}`. Quando o staging for criado (D42), a variável tem de ser o
      endereço `https` do storage gerenciado que o navegador alcança, e a API não deve subir com `AMBIENTE=staging` ou `producao`
      sem ela (hoje cai no endereço interno, que não abre fora da rede). Entra junto da escolha do provedor de hospedagem.
- [ ] **(F3, 13.0) Índices `auditoria_escola_autor_idx`, `consumo_ia_execucao_idx`, `resposta_atividade_aluno_idx`,
      `registro_acesso_usuario_idx` e `correcao_destaque_aberto_por_idx` com `concurrently` antes do staging:** as
      migrations 0033 e 0034 os criam sem `concurrently`, como a Tech Spec do F3, seção 7c, aceita enquanto não há staging nem piloto.
      `auditoria` é a tabela que mais cresce: a partir do staging, o índice novo vai em arquivo próprio, fora de transação (junto dos
      pendentes das migrations 0025 a 0027).
- [ ] **(F3, 13.0) Limite de downloads da versão da escola (`privacy-guardian`, rodada 6 da revisão da spec):** a coordenação pode
      pedir a URL de 5 minutos quantas vezes quiser; cada pedido é auditado com autor e finalidade, e a versão só existe enquanto o
      titular está sem conta ativa. Um teto por versão e por dia não está nos requisitos (RF12) e ficou fora; se o Joaquim o quiser,
      entra com `LIMITE_DE_DOWNLOADS_DA_VERSAO_DA_ESCOLA` e erro tipado.
- [x] **(F3, 13.0) Pedido de acesso `em_preparacao` de titular que foi eliminado (F3, 15.0):** *resolvido na 15.0: a eliminação conclui os outros pedidos abertos do titular na mesma transação, cada um com `pedido.concluido`.* o job termina sem efeito quando o
      titular já não existe na escola (log `titular.arquivo_sem_titular`), e o pedido segue `em_preparacao` até a coordenação
      concluí-lo, e dispara o alerta de 2 h enquanto isso. A 15.0, que conclui o pedido de eliminação, decide se conclui os de acesso
      abertos do mesmo titular na mesma transação (o autor `rotina` já vale para `pedido.concluido`).
- [ ] **(F3, 13.0) Pedido `em_preparacao` cujo job `falhou` não volta sozinho:** o BullMQ esgota as tentativas e o job fica
      `falhou`; o runbook manda concluir o pedido e registrar outro. Um reenfileiramento pela rotina da noite (os `em_preparacao` com
      mais de 2 h, uma vez, com chave de idempotência) tiraria o passo manual; fica para depois da primeira escola real, com o número
      de casos que aparecerem.
- [ ] **(F3, 13.0) Corrida entre o expurgo do arquivo e o job repetido:** o expurgo apaga o objeto, o job repetido o regrava e faz o `on conflict do update` na mesma linha, e o expurgo apaga a linha: o objeto fica órfão no storage, com dado do titular, sem ninguém que o varra. Rara (job repetido depois de pronto, na noite do 8º dia), mas é dado de menor fora do prazo. Saídas: `apagarLinhas` só apaga se `expira_em`/`apagado_em` ainda forem os lidos, ou o expurgo trava a linha (`for update skip locked`) antes de apagar o objeto (`infra-guardian`, 1ª rodada da 13.0).
- [ ] **(F3, 13.0) Índices que faltam por turma:** `entrega (decidida_por)`, `atividade_aplicada (aplicada_por)` e `validacao_do_lote (confirmada_por)` são lidos pelo arquivo do professor e não têm índice; crescem por turma, não por aluno. Avaliar com volume real, junto dos três da migration 0034 (`infra-guardian`, 1ª rodada da 13.0).
- [ ] **(F3, 13.0) `apagarArquivosDoTitular` repete o mesmo objeto que falhou em cada lote e soma `naoApagados` mais de uma vez para ele:** guardar os ids que falharam e tirá-los da leitura seguinte do lote (`infra-guardian`).
- [ ] **(F3, 13.0) Um cliente S3 só entre o núcleo e o worker:** `criarClienteS3` (worker) e `criarClienteDoArmazem` (núcleo) são duas fábricas; o `worker-lote` abre dois clientes. Juntar na do núcleo, com os prazos por configuração (`revisor-geral`).
- [ ] **(F3, 13.0) O prazo de requisição do medidor de storage só avisa:** `criarClienteS3` (`apps/worker/src/storage/medidor-de-storage.ts`) passa `requestTimeout` ao handler do SDK sem `throwOnRequestTimeout: true`, e nessa versão do handler (`@smithy/node-http-handler` 4.x) o prazo estourado vira só um aviso: o storage que aceita a conexão e não responde segura a medição sem limite. `criarClienteDoArmazem` foi corrigido na 13.0; este fecha junto do item acima, quando as duas fábricas virarem uma (diagnóstico do Arquiteto, 2ª rodada da 13.0).
- [ ] **(F3, 13.0) Índice redundante em `pedido_titular`:** `pedido_titular_da_escola_unico (escola_id, id)` repete o `pedido_titular_escola_id_idx`; contrair o segundo numa migration futura (`revisor-geral`).
- [ ] **(F3, 13.0) Testes do arquivo que prometem mais do que afirmam, e três provas que faltam (`test-engineer`):** (i) o teste de conteúdo não prende o SQL à declaração (as chaves de cada linha do JSON contidas em `LEITURAS_DO_ARQUIVO[t].colunas`); (ii) "B não lista A" usa outra pessoa em B, e não o mesmo professor logado em B (`sessaoDaMesmaConta`); (iii) virada de ano letivo: um registro de ano anterior tem de aparecer no arquivo, e hoje um filtro por `ano_letivo_id` nas leituras passaria; (iv-bis) o `POST pedidos/:id/arquivo` no pedido sobre a própria pessoa da coordenação (usuário desativado com a mesma `conta_id` de quem chama) cai no `#pedidoAlvo`, e nenhum teste prova isso nesta rota; (iv) os títulos "com ou sem segundo fator" (token só) e "cada arquivo uma vez" (não conta as chamadas de `apagar`) prometem mais do que afirmam.
- [ ] **(F3, 13.0) Duas perguntas de alcance do arquivo para a Tech Spec antes da 18.0 (`privacy-guardian`, `conformidade-reviewer`):** (i) a versão completa do professor com conta ativa traz `consumo_ia.entrada/saida` e `mensagem_agente.conteudo` também de turmas cujo vínculo já terminou (regra 20, item 18): é texto que ele escreveu, mas o prompt do Analista pode levar ids e desempenho de alunos que ele já não alcança; (ii) `artefato.titulo` entra na versão da escola do professor sem conta ativa: se o título vier do tema que ele escreveu ao Assistente, é um pedaço da conversa dele chegando à coordenação (regra 70, item 8); hoje está coberto pela exceção "registro de uso (execuções, consumo sem texto e artefatos)" do PRD, seção 6.
- [ ] **Ressalvas da 14.0 (F3, `test-engineer`, `infra-guardian`, `revisor-geral`, 1ª rodada):** (i) `temAcessoSuspenso`: os filtros `isNull(desativadoEm)` e `ne(papel, 'aluno')` não têm teste que os derrube (hoje inalcançáveis); (ii) o `Cache-Control: no-store` e o corpo vazio do `cancelar` não são afirmados; (iii) os [P] de `eliminacao-agendada.int.test.ts` (dois `cancelar`, duas chaves, cancelar e registrar) usam `Promise.all` sem forçar o entrelaçamento: segurar a primeira transação com `GatilhoDeParada` e `esperarNaTrava`, como `retencao.int.test.ts`; (iv) falta o [P] da eliminação com a **mesma** chave de envio nas duas chamadas: o `ON CONFLICT` só arbitra `(escola_id, chave_envio)` e o único parcial `pedido_titular_agendado_unico` é outro índice, então numa janela curta o reenvio pode receber `PEDIDO_EM_ESTADO_INVALIDO` em vez do mesmo pedido (a tela 16.0 sorteia a chave por diálogo); (v) o ramo suspenso do login por e-mail não grava a falha no registro de acesso (`gravarFalhaDeLoginPorEmail`), e os da matrícula e da conta externa gravam: alinhar, com teste do registro de escola nula; (vi) em `login.service.ts`, a consulta `temAcessoSuspenso` roda fora do `.catch` que chama `contador.desfazer`: se o banco falhar ali a reserva fica contada como senha errada; (vii) a renovação recusada por eliminação agendada entra na métrica como `recusada`: separar `suspensa` em `RESULTADOS_DA_RENOVACAO`; (viii) a sessão que um agendamento anterior, já cancelado, encerrou com `motivo = 'eliminacao_agendada'` volta a receber `ACESSO_SUSPENSO`, e não o 401, se a pessoa for agendada de novo dentro das 12 h e da inatividade: comparar `encerradaEm` da sessão com o `eliminacaoAgendadaEm` atual e cobrir com teste (cancelar, agendar de novo, usar o cookie antigo); risco pequeno, o cookie é da própria pessoa, da mesma escola; (ix) o teste da inatividade da renovação usa `now() - 1 day` e deve provar a fronteira (logo depois de "inatividade do papel + tolerância"), como `avaliar-sessao.test.ts` faz para a guarda; (x) no teste do aluno transferido, comparar também o `setCookie` da renovação com o do desconhecido, e dizer em comentário que é cenário de comportamento (passa por duas defesas: o motivo `desativacao` e `desativadoEm` em `sessaoAindaVale`), e não a prova de uma cláusula.
- [x] **Acesso e portabilidade do titular cobrindo as tabelas da fase 3.** *Resolvido: o arquivo (13.0, `LEITURAS_DO_ARQUIVO`) lê cada uma, e a eliminação (15.0) as alcança pelas FKs (`mensagem_tutor`, `sinal_tutor` e `tentativa_atividade` em cascata, `consumo_ia` com o aluno nulo); teste em `apps/worker/test/expurgo-da-escola.int.test.ts` (desativado com trabalho, conversa e consumo) e em `eliminar-titular.int.test.ts`.* A rota do pedido do titular (F3,
  `ciclo-de-vida.service.ts`) precisa alcançar, por aluno: `mensagem_tutor`, `sinal_tutor`, `resposta_atividade`,
  `tentativa_atividade`, `correcao`, `validacao_do_lote` (o aluno do destaque, pelo id) e `consumo_ia` com
  `envio_externo` (o que foi a provedor externo e quando), para a pergunta de fechamento da regra 20 continuar
  respondida por código (`privacy-guardian`, revisão da fase 3).
- [ ] **Trava da D62 em código.** A marca "leva texto de aluno" da camada de IA não tem consumidor: texto de aluno com
  envio externo e sem contrato que vede treinamento e garanta processamento no Brasil precisa ser recusado
  (`privacy-guardian`).
- [x] **Expurgo** de `consumo_ia` (`entrada` e `saida`), de `execucao_agente` e das conversas, no prazo do mapa de
  `docs/lgpd.md`, configurável por escola. Feito no F3: as conversas e os sinais saem (tarefa 3.0), a execução, o texto
  do modelo, o aluno do consumo e a autoria do artefato perdem a pessoa (tarefa 4.0), e o trabalho do aluno, a
  reivindicação decidida, o material excluído, o vínculo encerrado e a pessoa desativada saem (tarefa 5.0), pelo
  `retencao.expurgar-escola`.
- [ ] **Função nova pedida pelo aluno e o expurgo:** o lote `execucao_agente_do_tutor` filtra por
  `funcao = 'tutor_com_o_aluno'`, a única que o aluno pede hoje (`FUNCOES_COM_ORCAMENTO_POR_ALUNO`). Pôr um teste que leia
  essa lista e confira que cada função tem alvo e índice de anonimização, antes de existir a segunda (`privacy-guardian`
  da F3, tarefa 4.0)
- [ ] **Reenvio da chave de uma execução já anonimizada:** a API devolve `NAO_ENCONTRADO` (a releitura filtra por
  `solicitada_por`, que ficou nulo), e nenhum teste de integração prova que não é 500 nem execução nova. Pôr o teste,
  no Assistente e no Tutor, quando o fluxo for revisto para a escola real (`llm-integrator` da F3, tarefa 4.0)
- [ ] **Aviso no campo de tema** das ferramentas, para não escrever nome nem condição de aluno, e busca textual nos
  campos livres no procedimento de eliminação do titular.
- [ ] **Recusa do Tutor medida.** Conjunto fixo de amostras com taxa mínima declarada, rodado contra o modelo de
  produção (regra 40). A regra determinística cobre o que está no arquivo de amostras; o resto fica com o modelo, e
  para aluno real isso não basta sem medição (`conformidade-reviewer`).
- [ ] **Teto de IA por escola e custo.** Não há coluna de teto nem tabela de preço: `IA_ORCAMENTO_ESGOTADO` nunca
  dispara e `custo_micros` fica em zero (D14, D39).
- [ ] **Galeria das peças fora do build** de staging e de produção.
- [ ] **Execução de IA e extração de PDF por fila**, no lugar do processo da API (`TODO(fila)`, D49).
- [ ] **Recusa da D55 no Assistente, estrutural.** A regra por lista de palavras pegou 6 de 47 frases novas escritas
  pelo `conformidade-reviewer` na segunda passada da fase 3 (04/10/2026): foi ajustada às amostras. Para a demonstração
  ela foi aceita; antes de dado real: texto colado na mensagem atual não vai ao modelo, ou é recusado quando não é
  material do próprio professor; a conferência da saída recusa número de 0 a 10 ou letra de A a E depois de "sugiro",
  "colocaria", "iria de", "fecharia em", "classificaria", e "considero" ou "avaliação:" seguido de insuficiente,
  regular ou satisfatório; a entrada cobre a trajetória do aluno ("reprovo", "recuperação", "conselho de classe",
  "encaminho"); e um terceiro arquivo de amostras, escrito por outra pessoa, com a taxa medida e declarada abaixo de 1.
  Falso positivo conhecido: "critérios para avaliar redação antes de aplicar" é recusado.
- [ ] **Assunto delicado sem teto de IA.** Agora passa na frente de todo limite (D36). Falta um teto próprio, alto, ou a
  deduplicação do sinal `atencao_humana`, para um laço de mensagens não encher a lista do professor; e confirmar que o
  limite geral de requisições por escola, o da borda, não chega antes do 188 às 10h.
- [ ] **Servidor do e2e sem compressão nem cache.** O `vite preview` manda o JS cru e sem cache, e o teste
  `e2e/areas.spec.ts:163` roda a 28,5 de 30 s no perfil celular, gastando o tempo em recarregamentos. Servir o build do
  e2e comprimido e com cache, como a produção, é mudança de infra (contêiner `web` e borda), com `test:infra`.
- [ ] **Ensaio de alertas intermitente** na esteira: a regra "Login recusado pelo semáforo do hash" ficou em `pending`
  até o prazo numa execução da `mvp/apresentacao` e passou na reexecução. Se voltar, entra por `/corrigir`.
- [x] ~~**E2e intermitente "segunda pessoa"** (`e2e/areas.spec.ts:381`, chromebook e celular): na esteira `37302975647` a
  coordenação entrou na aba do professor e "Turmas" mostrou o estado vazio ("A coordenação ainda não alocou você") em vez
  da turma da professora, e passou na reexecução, sem mudança de código. Voltou no projeto `celular` na esteira
  `37324214757` da `develop` (`e98a21b`, merge do PR #2, que só mudou `.md`), com o mesmo estado vazio no lugar da
  turma; o job e2e 3/4 foi reexecutado. É o quarto e2e intermitente da `mvp/apresentacao` em
  torno da página inicial do professor e da troca de escola (os outros são "W4: os estados de Turmas" e os dois da troca
  de escola no celular): vale um `/corrigir` que olhe os quatro juntos antes de a esteira da `develop` voltar a
  ser por commit.~~ — corrigido em `tasks/correcoes/2026-10-05-segunda-pessoa-cache-dos-vinculos.md`. Falhou também na
  reexecução e no chromebook da `37330163372`. A causa era a alocação criada depois de a Nova conversa já ter lido os
  vínculos, que ficavam 30 s no cache: o teste agora aloca antes de entrar (20 de 20 depois). O W4 (10 de 10) e a troca
  de escola (80 de 80) ficaram estáveis sem mudança; os dois da troca de escola já tinham sido corrigidos no `ad7c3f0`.
- [ ] **E2e "W4: os estados de Turmas" sem causa conhecida** (`e2e/areas.spec.ts:315`). Declarado intermitente no plano
  do MVP (`docs/mvp-rapido.md`, seção 8, item 3), e o item acima era o único que o acompanhava. Não reproduziu em 10
  execuções em 05/10/2026, e o código dele não tem a corrida do "segunda pessoa": aloca depois de entrar, mas relê pelo
  "Tentar de novo". Se voltar, entra por `/corrigir` com a execução da esteira em que falhou.
- [ ] **Alocação nova demora até 30 s para aparecer em "Turmas"** (`test-engineer` da correção
  `2026-10-05-segunda-pessoa-cache-dos-vinculos`). Não é requisito hoje, mas o vazio da Nova conversa manda a professora
  a "Turmas" ("Ir para Turmas", `apps/web/src/areas/professor/Home.tsx`), que monta com a lista que a Nova conversa já
  leu (`staleTime` de 30 s em `apps/web/src/api/cliente-de-consultas.ts`) e mostra "A coordenação ainda não alocou você";
  e esse vazio não tem como reler (`Turmas.tsx`), só trocando de aba ou abrindo a tela de novo. Se mudar (por exemplo,
  `refetchOnMount: 'always'` só na consulta de "Turmas"), o e2e que prova é "alocação feita com a Nova conversa aberta
  aparece em Turmas sem recarregar". Decisão de produto: Joaquim.

## O que o MVP fez diferente de uma decisão ou regra (05/10/2026, na propagação da D77)

Achados ao conferir o código depois do merge (`13eab64`). Não estão resolvidos: cada um pede decisão do Joaquim.

- [ ] **Consumo de IA no painel da operação.** A D76 e o "Pronto quando" da A2 no `ROADMAP.md` dizem que, com a A2, o
  painel da operação mostra o consumo de IA por escola, em tokens e em reais contra o teto por aluno. Não entrou: a API da
  operação (`apps/api/src/operacao/`) não lê `consumo_ia`, e `apps/web/src/operacao/paginas/Uso.tsx` ainda diz que o
  consumo "entra com a A2". A coordenação vê o consumo na Governança; a operação, não. Falta decidir em que fase entra.
- [ ] **Tutor sem política por turma (D19).** A D19 manda o Tutor fora da sala ser configuração da escola por turma,
  **desligada por padrão**. No MVP o Tutor fica ligado para todo aluno com turma, a qualquer hora: o estado `fora` existe
  no contrato e nunca é devolvido (`apps/api/src/tutor/tutor.service.ts`, `conversa`; decisão 27 de
  `docs/mvp-rapido.md`). Com dado sintético não expõe ninguém; antes de aluno real, a D19 precisa valer.
- [ ] **O aluno não vê nem contesta o que o Tutor sabe (D66; regra 70, item 4d).** A rota `GET /v1/tutor/memoria`
  existe, mas não há tela, e não há caminho de contestação (decisão 27 de `docs/mvp-rapido.md`). Antes de aluno real.
- [ ] **`GET /v1/eu`: a falha da gravação da data da introdução é engolida sem classe nem log** (telas do aluno, tarefa 1.0).
  O `catch` de `#gravarSemEmprestar` (`apps/api/src/sessao/eu.service.ts`) só conta em `eu.introducao_falha`. Registrar a
  classe do erro exige log novo (só a classe, sem dado de pessoa) e filtro do que é falha do banco. Fazer quando o contador subir.
