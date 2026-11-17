# Achados das revisões — `tasks/prd-classificacao-bncc/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-17 08:57:38 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não (revisão de desenho, sem código nem fotos)
Estados: faltando. Ver o bloqueante 1.
Acessibilidade: implícita, não garantida (bloqueante 1).
Chromebook fraco: parcial.
Celular: não garantido (bloqueante 1).
Ação oficial protegida: sim, com uma ressalva (recomendação 2).

**Itens da lista "O que verificar"**

1. **Quatro estados.**
   - A §7c define os estados da seção: `aguardando`, `classificada`, `sem_habilidade`, `nao_classificada`. Ela diz "Reclassificar" na falha do provedor.
   - A §9 lista "classificação hoje à noite" e o "aviso sem componente".
   - Falta o conjunto completo por tela: carregando, erro, vazio e com dado. Isso vale para o painel do material, a cobertura e o seletor de habilidade do artefato.
   - Falta o vazio da cobertura. Uma escola nova sem material mostra todas as habilidades como "sem material", e isso precisa de texto que convide a enviar material.
   - O §9 manda os textos para `cenarios.md`, que não existe: está fora do `git ls-files` e não há no diretório.
2. **Feed de agentes.** Não se aplica. A spec não toca o feed.
3. **Seletor de escola.** Não se aplica diretamente. O painel do material e a cobertura herdam da F4. A spec não diz isso.
4. **Ação oficial explícita.**
   - A classificação não é ação oficial: a aprovação humana fica na atividade (§7b).
   - A troca de habilidade no artefato ocorre antes de aprovar e é auditada. Está garantida.
   - A correção da coordenação é auditada com código antes e depois (§7).
   - `POST /reclassificar` não diz que mostra ao coordenador o que será refeito. Ele também não avisa que as seções corrigidas ficam preservadas (RF12). É uma ação em lote que custa token, então vale o aviso.
5. **Chromebook fraco.**
   - O envio não muda: os PDFs são da F4.
   - O painel lista seções de ~25 capítulos por material, até 300 materiais, e a cobertura lista centenas de habilidades.
   - Nenhum dos dois cita virtualização ou paginação. `GET /v1/habilidades-bncc` devolve as candidatas do recorte sem limite nem busca, e o seletor de 0 a 5 habilidades fica pesado numa lista longa.
   - Falta definir busca ou filtro no seletor e paginação na cobertura.
5a. **Celular.**
   - A §9 não menciona 360 px, alvo de toque, nem o projeto Playwright `celular`.
   - Não há decisão de como o seletor multi-habilidade e a cobertura em tabela se comportam a 360 px.
   - "Tela só para desktop é AJUSTES NECESSÁRIOS", e a spec é silenciosa.
   - Nenhum fluxo exige o celular, o que está bem.
6. **Acessibilidade.** Silêncio total. Faltam rótulo de campo, teclado e foco no seletor de habilidades. Faltam também a situação da seção dita em texto, e não só em cor, e o foco ao concluir a correção.
7. **Português.**
   - Os termos que podem vazar são `sem_habilidade`, `nao_classificada` e os códigos como `EF69LP01`.
   - A spec não manda traduzir o estado para rótulo em português.
   - Faltam também o formato do código na tela, que deve ser sempre acompanhado da descrição, e a marca de que a proposta é de IA, com `origem` visível como "sugerida pela IA" ou "corrigida pela coordenação" (regra 70, item 4a).
   - A `origem` está no contrato da API (§4), mas a §9 não diz que ela aparece.
8. **Erro diz o que fazer.** O `CONFLITO` por material não `pronto`, disciplina sem componente, ou artefato já aplicado tem código de API, mas não mensagem ao usuário com o próximo passo. A §9 delega a `cenarios.md`, que não existe.

**Bloqueantes**

1. Seção 9, em referência a `cenarios.md` (ausente em `tasks/prd-classificacao-bncc/`): os textos, os testes e as ordens de concorrência apontam para um arquivo que não existe. A §9 e a §10 também não trazem os itens 1, 5, 5a, 6 e 7 como requisito de tela.
   - **Correção exigida:** criar `cenarios.md`, ou trazer para a Tech Spec, por tela (painel do material, cobertura, seletor no artefato, Estrutura/disciplina):
     - os quatro estados com o texto;
     - o comportamento a 360 px, com alvo de toque de 24 px e de 44 px na ação principal;
     - o rótulo em português para cada `situacao`, para `origem` e para a marca de IA;
     - a mensagem de erro de cada `CONFLITO` com o que fazer;
     - o teste Playwright `celular` e o de teclado e foco.
2. Seção 4 e §9, em `GET /v1/habilidades-bncc` e na cobertura: listas longas sem busca, filtro nem paginação.
   - **Correção exigida:** definir o filtro por texto e código no seletor e a paginação ou virtualização da cobertura. O teto de volume deve ser testado em Chromebook, com CPU e rede limitadas.

**Recomendações**
- Dizer na §9 que o painel e a cobertura herdam o seletor de escola da coordenação.
- No `POST /reclassificar`, mostrar antes da confirmação quantas seções serão refeitas e quantas ficam preservadas por correção.
- Garantir que "Sem habilidade" (§5) venha com explicação curta ao aluno e ao professor, e que não seja lida como falha da IA ou do aluno.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/prd.md`.

## llm-integrator · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-17 08:57:53 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Auditei o desenho da Tech Spec contra os 10 itens, lendo os RF da F4 citados. Há um bloqueante: o `cenarios.md` referenciado não existe na pasta da spec.

Perfis usados: `rapido` para `classificar_secoes`, com queda para `padrao` se a taxa mínima não for atingida (§7b, §8). Não há uso de `complexo`, e a escolha é a mais barata que resolve.

Custo estimado por professor/mês: a spec só dá custo por escola e por aluno (§8). Para o onboarding, são ~7 milhões de tokens por escola, R$ 4 a 20 conforme o modelo, e menos de R$ 0,01 por aluno por mês. Refiz a conta: 300 apostilas × ~25 capítulos ÷ 12 seções por chamada dá ~625 chamadas de ~12 mil tokens, o que bate com os 7,5 milhões. Isso são ~625 chamadas por escola, uma vez, e quase zero por professor no regime normal (só novas edições e reclassificações). Com ~40 professores por escola, o onboarding custa cerca de R$ 0,10 a 0,50 por professor, uma única vez. A preocupação com preço é do aluno, e o número está dentro da D39.

Prompt versionado: sim. `packages/core/src/ia/prompts/classificar-secoes.ts` (§8). Candidatas no começo e texto do material delimitado como dado (§5).

Validação de schema: sim. A saída é de 0 a 3 códigos por seção, e código fora das candidatas vira `IA_SAIDA_INVALIDA` (§5). O caminho de erro é a seção `nao_classificada`, com "Reclassificar" (§7c).

Aprovação humana no caminho: sim. A classificação não é uma entrega ao aluno. O que chega ao aluno é a atividade, que o professor vê e na qual troca a habilidade antes de aprovar (§7b, §4). A correção da coordenação vence e é auditada (§7). A classificação feita pela IA fica registrada na execução.

Resultado por item da lista:
- **1. SDK só no adaptador:** implícito. A tarefa roda no `ExecucaoProcessor`, pela porta, com `ScriptedAdapter` nos testes. A spec não diz que não há import de SDK, mas o desenho não abre brecha. Recomendação.
- **2. Perfil:** garantido (§8, §7b).
- **3. Prompt em arquivo:** garantido (§8).
- **4. Schema com caminho de erro:** garantido (§5, §7c).
- **5. Timeout, retry com recuo, limite de custo:**
  - Limite de custo: há vaga `lote` por escola e balde de tokens `lote` de 5 % do contratado (§7c). O desvio da regra 30, item 8, está declarado e justificado (§11).
  - Timeout e retry: o "prazo" e a "varredura" são citados, mas o retry com recuo não é descrito. Herda da X6, e a spec não o cita. Recomendação.
- **6. Registro da execução:** garantido. Usa `execucao_agente` e `consumo_ia` com função própria (§7b), e os checks são atualizados.
- **7. Teste sem provedor pago:** garantido. `ScriptedAdapter` no teste da medição; o modelo local fica na medição fora do portão (§7b).
- **8. Fila, idempotência, reinício:** garantido (§5, §7c).
  - Fila `lote`, job com chave = execução, varredura que inclui a `lote`, outbox se o Redis cair.
  - O `concluir` grava `where execucao_id = :esta and corrigida_por is null`, com `for update`.
  - As corridas de concorrência estão listadas.
- **9. Entrega nasce pendente:** não se aplica à classificação em si, e a aprovação do professor na atividade está preservada (§7b).
- **10. O agente sabe parar:**
  - Há uma chamada por lote de 12 seções, sem laço ("Laços: nenhum novo"), e a suspensão é conferida antes do modelo (§5).
  - O teto de tokens de saída por chamada não está escrito. Recomendação.

Bloqueantes:
- **`techspec.md` §10 e cabeçalho, `cenarios.md` ausente.**
  - O que está errado: a seção de testes inteira, os textos das telas e "as ordens" das corridas (§7c) remetem a `tasks/prd-classificacao-bncc/cenarios.md`, que não existe na pasta (só `abertura.md`, `estado.md`, `prd.md`, `revisao-spec.md`, `techspec.md`).
  - Consequência: não dá para verificar que as regras com veto têm teste que as prove. Isso vale para o isolamento da regra 10 (§6 lista os casos, mas sem arquivo), a ausência de aprovação indevida, o recusar-fora-das-candidatas, a idempotência do `concluir` e o lote retido de 30 seções.
  - Correção exigida: escrever o `cenarios.md`, ou trazer o conteúdo para o §10. Ele precisa cobrir:
    - cada teste de isolamento do §6 com a cláusula de escopo removida;
    - a ordem de cada corrida do §7c;
    - o teste de `IA_SAIDA_INVALIDA` e de código fora do recorte;
    - o `execucao_id` obsoleto concluindo sem efeito;
    - o reinício do worker no meio do lote.
  - Depois disso, a revisão deve ser refeita sobre ele.

Recomendações:
- Dizer no §5 ou §8 que nenhum SDK de provedor é importado fora de `*-adapter.ts`, e que o teste de arquitetura existente cobre a rotina nova.
- Dizer o que acontece com a execução de 12 seções quando uma só seção traz código inválido: perde-se as 12, ou só aquela? Prever retry parcial, ou ao menos uma nova tentativa com recuo antes de marcar `nao_classificada`. Hoje uma falha de provedor à noite exige "Reclassificar" manual na manhã seguinte, o que pesa no RF15 ("classificadas na mesma noite").
- Declarar o teto de tokens de saída e o número máximo de tentativas por execução, citando a X6.
- Registrar a versão do prompt na execução. Isso ajuda a auditar mudanças de taxa.
- Acrescentar ao §8 a estimativa em chamadas por escola e por professor por mês, para a precificação: ~625 chamadas por onboarding e poucas no regime normal.
- O custo ≥ R$ 20 por escola no pior modelo deve ser conferido contra a taxa da §7b antes de adotar o `padrao` como queda.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-ingestao-do-material/prd.md`

## pedagogia-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-17 08:58:19 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Amostras avaliadas: 0 saídas (revisão de desenho). Li `prd.md`, `techspec.md` e os RF da F4 citados pela nota do corte (RF1, 2, 5, 6, 7, 9, 12, 15, 19, 20, a seção 8b e a 10). O `cenarios.md` que a Tech Spec cita **não existe** em `tasks/prd-classificacao-bncc/`.

## Item a item (RF da F4 contra a Tech Spec)

| Item | Situação | Onde na Tech Spec |
|---|---|---|
| RF1, tabela BNCC | Garante. O check de formato, o bloco `EF69` por ano e a versão ficam na tabela. Falta saber se a contagem de 183 habilidades do EM está certa. | §3, §12 |
| RF2, catálogo sai | Garante. `habilidades.ts` sai, seed e fixturas passam à BNCC. | §5 |
| RF5, IA propõe em lote | Garante a recusa de código fora das candidatas e o horário noturno. A taxa mínima existe, mas é frágil (bloqueante 1). | §5, §7b |
| RF6, correção vence | Garante: `for update`, `corrigida_por` e `origem`. A edição nova descarta a correção (recomendação 3). | §5, §13 |
| RF7, habilidade da questão | Garante: a escolha é entre as da página citada, e quem grava confere. Não diz o que fazer com questão que cita mais de uma seção (recomendação 4). | §5 |
| RF9, troca pelo professor | Garante: código do recorte da turma, só no original, com auditoria. | §4, §7 |
| RF12, reclassificar | Garante: usa o `trecho` gravado e preserva a correção. | §5 |
| RF15, classificadas | Garante em carga (`lote`, 5 % do contratado, cenário de 300 apostilas). Falta o que o professor vê antes da noite (recomendação 5). | §7c |
| RF19, cobertura | Garante o cálculo. Falta tratar seção não classificada (recomendação 1). | §5 |
| RF20, isolamento | Garante: FK composta e testes efetivos sem a cláusula. | §6 |
| 8b, AIA | Garante a ordem: a AIA é revista na tarefa que cria a função, antes da que troca o catálogo. | §7b |

## Critério de qualidade (§7b) e efeito no diagnóstico

O critério está mal ajustado ao que o diagnóstico consome, por quatro motivos.

1. **Só se mede a classificação do capítulo, não a habilidade da questão.** O diagnóstico por habilidade, que é de alto risco, vem de uma segunda escolha. O modelo escolhe, entre 0 e 3 códigos da seção, o que cada questão avalia. A seção inteira vai herdar um erro de capítulo, e uma questão pode ser rotulada com uma habilidade que ela não testa. Nada na Tech Spec mede isso. Hoje o desenho assume que acertar o capítulo basta, e o professor só corrige questão a questão, antes de aprovar.
2. **A régua é frouxa e o termo central está indefinido.** "≥ 90 % das seções com um código da referência" aprova a seção que traz 1 certo e 2 errados. "≥ 80 % dos códigos aceitáveis" não diz quem julga o que é aceitável. Trinta seções dão uma amostra pequena, e a pior de três execuções do mesmo modelo mede variância, não confiabilidade.
3. **A referência não passa por um professor.** O lote "sintético, escrito em contexto limpo, nunca lido por quem o escreve" é circular. O padrão-ouro de habilidade BNCC saiu de um modelo, sem especialista conferindo. O precedente do `ouro` já está registrado como "sem leitura humana" (`TODO.md`).
4. **A entrada real é truncada e a medida pode não refletir isso.** O modelo vê 1.500 caracteres do começo e 500 de subtítulos. Num capítulo de 40 páginas ou num bloco de 10 páginas isso é pouco. As 30 seções sintéticas precisam ter o tamanho e o truncamento reais, senão a taxa mede um caso fácil.

Além disso, a medida roda "fora do portão". Nada garante que ela ocorra antes da tarefa que troca o catálogo, que é o ponto de não retorno do diagnóstico.

## Categorias de problema

- **Distratores e gabarito:** não se aplicam. O gabarito das questões não muda. Só muda o rótulo de habilidade, e esse rótulo é o objeto do bloqueante 1.
- **Nível e currículo:** o recorte por etapa, série e componente está correto. A mapeada por nome (Química para Ciências da Natureza) deixa nulo o que não casa, e a disciplina sem componente recebe `CONFLITO` e nenhuma classificação. Isso é seguro, desde que a tela avise (o aviso está na §9).
- **Tom:** os textos estão em `cenarios.md`, que não existe. Não consegui avaliar "Sem habilidade" no aluno e no Tutor, nem "classificação hoje à noite".
- **Tutor, recusa de escopo, correção de discursiva:** não se aplicam. Não há texto de aluno na classificação, e a D55 fica intacta.

## Bloqueantes

1. **§7b, critério de qualidade que não prova o efeito no diagnóstico.** Exigido:
   - definir "código aceitável" e quem o julga;
   - validar o lote de referência por um professor ou especialista de currículo;
   - medir também a escolha de habilidade por questão numa amostra de atividades geradas, com taxa mínima;
   - usar seções com o tamanho e o truncamento reais;
   - tornar a medida precondição da tarefa que troca o catálogo, e não só "fora do portão";
   - registrar na AIA a granularidade (habilidade do capítulo, não da questão) e o que o professor vê.
2. **§10 e §7c remetem a `cenarios.md`, que não existe.** As ordens das quatro corridas de concorrência, os testes por regra e os textos de tela não podem ser verificados. A Tech Spec só fica aprovável com o arquivo escrito. Sem ele, a regra 40 e a regra de tom ficam sem prova.

## Recomendações

1. **Cobertura (RF19):** seção `nao_classificada` ou `aguardando` aparece como lacuna. A coordenação vai levar à secretaria uma lacuna que é só atraso ou falha do classificador. Mostrar "N seções ainda sem classificação" junto, e a cobertura herda a taxa do §7b.
2. **"Sem habilidade" para o aluno e a família** soa como falha. Usar texto neutro, definido no `cenarios.md`. O mesmo vale para `sem_habilidade` e `nao_classificada`, que geram a mesma questão sem habilidade, mas têm causas distintas.
3. **Edição nova descarta a correção da coordenação** (§5, §13), o que se choca com o texto do RF6 ("nenhuma reclassificação automática a desfaz"). Avisar na tela antes do envio, ou herdar pelo capítulo desde já, sem esperar "se pesar".
4. **Questão que cita mais de uma seção** (páginas em seções diferentes): dizer qual regra vale. Hoje só a "página citada" é tratada.
5. **Janela entre `pronto` e a noite:** o professor que gera antes da classificação recebe todas as questões sem habilidade. Mostrar no artefato que a classificação ainda não rodou, não só "Sem habilidade".
6. **Contagem do EM:** o "183" depende da tarefa de carga, já sinalizada em §12 como "NÃO VERIFICADO". Manter o PDF homologado como árbitro.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/prd.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-ingestao-do-material/prd.md`.

Ajuste sugerido no prompt ou na recuperação de contexto: o prompt de `classificar_secoes` (`packages/core/src/ia/prompts/classificar-secoes.ts`) deve dizer ao modelo que o código sai só quando o trecho sustenta a habilidade, e que "nenhuma" é resposta válida. Isso reduz o erro silencioso que o bloqueante 1 teme.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-17 08:58:51 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas:
- `habilidade_bncc`: pública e sem escola. É a exceção da regra 10, item 1, justificada no §11.
- `disciplina.componente_bncc`.
- `secao_do_material`: tem `escola_id` e FKs compostas. Não tem `ano_letivo_id`, e isso está correto: pelo PRD da F4, §6, o material não varia por ano.
- `habilidade_da_secao`: tem `escola_id` e PK e FK compostas.
- `execucao_agente`: reaproveitada, com `ano_letivo_id` NOT NULL e FK `(escola_id, ano_letivo_id)`.
- `job_registro`: reaproveitada; `escola_id` só é nulo em `sistema.*`.

Queries verificadas (Tech Spec §4, §5, §6 e §7c):
- `GET /v1/materiais/:id`, `PUT .../secoes/:secaoId/habilidades`, `POST .../reclassificar`, `GET /v1/habilidades-bncc`, `GET /v1/materiais/cobertura`, `PATCH /v1/disciplinas/:id` e `PATCH /v1/artefatos/:id/questoes/:indice/habilidade`.
- No worker: o `preparar` e o `concluir` da `classificar_secoes`.
- A busca da geração com as habilidades da seção da página.
- O comando D76 e a migration (2).

Item por item:
- Item 1: atendido, exceto pelo bloqueante 1.
- Item 2: garantido no §6, "escopo do contexto em todo método". No worker o escopo vem de `job_registro.escola_id`.
- Item 3: só o comando D76 recebe a escola, e é rotina nossa. Os endpoints não recebem.
- Item 4: há testes de isolamento, com a ressalva do bloqueante 2.
- Item 5: atendido no §4, que responde `NAO_ENCONTRADO` como o inexistente, com a ressalva das recomendações.
- Item 6: implícito para `secao_do_material` (bloqueante 4).
- Item 7: não se aplica, porque a visão da rede (F14) está fora de escopo.
- Item 8: nenhum `@Unscoped` novo declarado.

Teste de isolamento: presente e efetivo nos que a Tech Spec lista no §6. Falta o de `GET /v1/habilidades-bncc` (bloqueante 2).

Bloqueantes:

1. **Tech Spec §3 e §5 ("Seções" e "Classificação"): a execução nasce sem ano letivo definido.**
   - **O problema:** `execucao_agente.ano_letivo_id` é NOT NULL, com FK `(escola_id, ano_letivo_id)` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/db/schema/execucao-agente.ts`:58 e :77). A Tech Spec cria as execuções `classificar_secoes` dentro da transação da extração, na reclassificação e no comando da operação, num "contexto da rotina: a escola do job, sem pessoa nem ano letivo". Não diz qual `ano_letivo_id` elas recebem nem o que acontece se a escola não tiver ano letivo ativo. Do jeito que está, ou a implementação inventa uma leitura de ano letivo fora do desenho, ou a transação da extração quebra.
   - **Correção exigida:** declarar no §3 e no §5 de onde vem o ano letivo. Pode ser o ano letivo ativo da escola do material, lido no escopo dela na mesma transação, junto com o comportamento quando a escola não tem um (a execução não nasce e a seção fica `nao_classificada`). A outra saída é tornar a coluna anulável só para a função `classificacao_do_material`, com check, e rever o que aponta para `unique (escola_id, ano_letivo_id, id)`.

2. **Tech Spec §4 (`GET /v1/habilidades-bncc`) e §6: endpoint novo sem autorização por objeto escrita e sem teste de isolamento.**
   - **O problema:** o endpoint recebe `materialId` ou `turmaId` pela query string. A Tech Spec não diz que a `turmaId` precisa ser turma com vínculo do professor no ano letivo do token, nem que o `materialId` precisa estar no alcance da F4. O §6 também não traz teste para essa rota. Sem isso, a lista de candidatas de uma turma ou de um material da escola B (ou de um colega) confirma que o id existe e revela a série e o componente dele.
   - **Correção exigida:**
     - No §4, escrever a regra: professor só com turma dele e material no alcance da F4; coordenação só da escola; o resto responde `NAO_ENCONTRADO`, igual ao inexistente.
     - No §6, acrescentar os testes: `turmaId` e `materialId` da B dão 404 igual ao id inexistente, e a turma de um colega da mesma escola também dá 404.

3. **Tech Spec §3 (FK `corrigida_por` com `on delete set null`) e §5 ("Classificação", "Reclassificar"): a eliminação do coordenador reabre a correção.**
   - **O problema:** o marcador de "corrigida" é `corrigida_por is null`. Quando o coordenador é eliminado (F3), essa coluna vira nulo. A seção volta a valer como "não corrigida", e o `concluir`, o reclassificar e o comando D76 passam a sobrescrever a correção humana. Isso quebra o RF6 ("nenhuma reclassificação automática a desfaz").
   - **Correção exigida:** usar `corrigida_em is not null` como marcador no `concluir`, na seleção do reclassificar e do comando D76 e na derivação de `corrigida` no §7c. Acrescentar o teste: a correção de um coordenador eliminado sobrevive ao reclassificar.

4. **Tech Spec §3 (`secao_do_material id`): o tipo do id não está declarado.**
   - **O problema:** o id de `secao_do_material` vai na URL (`/secoes/:secaoId`), e a regra 10, item 7, exige UUID. Do jeito que está escrito, o UUID fica implícito.
   - **Correção exigida:** escrever `id uuid pk default uuidv7()`.

Recomendações:
- §6, teste da cobertura: a fixture precisa ter um material da B cobrindo uma habilidade que falta à A. Sem isso, remover o escopo não muda o resultado e o teste não quebra.
- §4, ordem das respostas: escrever que a existência no escopo é conferida antes de `ENTRADA_INVALIDA` (código fora do recorte) e de `CONFLITO`. Acrescentar ao §6 dois testes:
  - `PUT` com códigos fora do recorte em material da B responde `NAO_ENCONTRADO`.
  - A troca de habilidade no artefato de um colega da mesma escola responde `NAO_ENCONTRADO`, nunca `CONFLITO`.
- §6, `PATCH /v1/disciplinas/:id`: citar o teste de isolamento que já existe para a rota (`apps/api/test/estrutura.int.test.ts`) e cobrir o campo novo nele.
- §5 e §2: declarar "nenhum `@Unscoped` novo" para a rotina e para o comando D76, e dizer que a varredura passa a incluir a fila `lote` sob a justificativa que ela já tem.
- §10 aponta para `cenarios.md`, que ainda não existe. Os testes de isolamento do §6 precisam estar lá também.
- Item 7: registrar na matriz de visibilidade que a rede não alcança classificação nem cobertura até a F14.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-17 08:59:28 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Revisão do desenho em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`, comparado com o PRD da F4b, com a seção 8 do PRD da F4 e com `docs/lgpd.md`. Também consultei o código atual da eliminação e do arquivo do titular, para ver como uma FK com `set null` se comporta hoje.

**Item por item**

*Coleta*
- **Campo pessoal novo na tabela de `docs/lgpd.md`:** implícito. A §7 aponta `corrigida_por` e as ações novas de auditoria. A finalidade vem do PRD F4 §8 ("autoria da correção"). A retenção é "as seções saem com o material". Falta dizer em qual linha do mapa isso entra e em qual tarefa. Não bloqueia: a finalidade e a retenção existem. Ficou como recomendação.
- **Campo proibido para aluno:** não se aplica. Nenhum campo de aluno é novo.
- **Adaptação em vez de diagnóstico:** não se aplica.

*Exposição*
- **DTO de saída explícito:** garantido (§4 e §7). A saída traz `corrigida` como booleano e não traz `corrigida_por` nem `execucao_id`.
- **Autorização por objeto:** garantida (§4, §6 e §7). O material segue o alcance da F4, só o dono troca a habilidade do artefato, e os testes de isolamento valem também sem a cláusula de escopo. O comando da operação fica preso à escola dada.
- **Não encontrado e sem permissão respondem igual:** garantido (§4, `NAO_ENCONTRADO` para objeto de outra escola).
- **Bucket, convite, exportação:** não se aplicam.
- **Erro tipado:** garantido (§4).

*Log e rastro*
- **Logs:** garantido (§7): só ids, contagens e códigos de erro, nunca título, texto ou código escolhido.
- **Auditoria:** garantida (§7) para a correção (com os códigos de antes e de depois), a reclassificação, o comando da operação com chamado e a troca de habilidade. Ninguém lê dado de aluno aqui.

*IA*
- **Envio mínimo, sem pessoa:** garantido (§5 e §7). Vai o título da seção, até 2.000 caracteres de texto do material e as candidatas da BNCC.
- **Registro em `execucao_agente`:** garantido (§5, §7b e §8). A execução `classificar_secoes` grava `solicitada_por` nulo, e o consumo vai para `consumo_ia` com função própria.
- **Contrato que veda treinamento:** implícito (§7). A recusa automática no gateway (`exigirSoberania`, `packages/core/src/ia/llm-gateway.ts`) só pega tarefa com texto de aluno; tarefa sem texto de aluno, como esta, fica coberta pela conferência do provedor externo na subida, que exige treinamento vedado e as categorias declaradas por cada tarefa (`packages/core/src/ia/task.ts`, `categoriasEnviadas`). A Tech Spec não nomeia a categoria da tarefa nova. Ficou como recomendação.
- **Conversa de tutor longe da camada de rede:** não se aplica.

*Ciclo de vida*
- **Exclusão e eliminação:** falha. Ver o bloqueante 1.
- **Retenção:** garantida (§7). As seções caem em cascata com o material, e as execuções e o consumo seguem as categorias que já existem.
- **Seed e fixture:** garantido (§5 e §7b). O seed passa a usar códigos da BNCC, o lote retido tem 30 seções sintéticas e a tabela da BNCC é pública.

*Pergunta de fechamento:* o código responde. Nada de aluno vai para o modelo, e o diagnóstico só ganha `codigo: null` numa questão sem habilidade. Para o coordenador, a §7 põe `corrigida_por` no arquivo do titular, no mesmo padrão do `registrada_por` da F4. O que quebra está na eliminação desse coordenador, no bloqueante 1.

```
VEREDITO: REPROVADO
Campos pessoais tocados: secao_do_material.corrigida_por (coordenador); ações novas de auditoria material.classificacao_corrigida, material.reclassificado, escola.reclassificada, artefato.habilidade_trocada; execucao_agente e consumo_ia da função nova (sem pessoa: solicitada_por nulo na rotina)
Fora da tabela de dados do docs/lgpd.md: corrigida_por e as quatro ações ainda não estão no mapa; a §7 aponta a inclusão sem dizer a linha nem a tarefa (recomendação)
Autorização por objeto: ok (§4, §6, §7)
Logs: limpos (§7)
Auditoria: presente (§7)
Envio externo: título e até 2.000 caracteres por seção do texto do material, mais as candidatas da BNCC, ao provedor do perfil `rapido`; registrado em execucao_agente (classificar_secoes) e consumo_ia (envio_externo, provedor). Sem dado de aluno
Seed/fixture: sintético
Bloqueantes:
1. §3 (FK de corrigida_por "on delete set null") somada à §5 (concluir com "corrigida_por is null"; reclassificar "cada seção não corrigida") e à §7c ("corrigida é final para a IA"). A eliminação do titular apaga a linha do usuario (eliminacao-do-titular.repository.ts:102), e a FK zera corrigida_por. Daí em diante a seção corrigida por um coordenador eliminado conta como "não corrigida". A próxima reclassificação, inclusive o comando da operação, sobrescreve a correção humana e o DTO deixa de mostrar "corrigida". Isso viola o RF6 e a regra "correção humana vence, sempre" (PRD F4, §6). Correção exigida: a marca da correção passa a ser corrigida_em (ou origem='coordenacao'), que fica depois da eliminação. O concluir, a escolha das seções a reclassificar e o `corrigida` do DTO usam essa marca. corrigida_por serve só para autoria e para o arquivo do titular. Precisa de teste: eliminado o coordenador que corrigiu, reclassificar mantém a correção e corrigida_por fica nulo.
2. §10 ("Em cenarios.md") e o cabeçalho apontam para um arquivo que não existe. Nenhuma regra de privacidade desta spec tem teste declarado. Correção exigida: cenarios.md declara pelo menos (a) o contrato de GET /v1/materiais/:id sem corrigida_por nem execucao_id (apps/api/test/contracts.test.ts); (b) a entrada de secao_do_material no arquivo do titular, consultada por corrigida_por, com a coluna na lista `fora`; (c) o teste de eliminação do bloqueante 1; (d) as quatro ações no catálogo de auditoria (packages/core/src/auditoria/acoes.test.ts), sem título nem texto no antes e no depois; (e) o log da rotina sem título, texto nem código escolhido.
Recomendações:
- §7: dizer em qual linha de docs/lgpd.md corrigida_por e as quatro ações entram (a do material, junto de enviado_por e excluido_por) e que isso vai na tarefa da migration.
- §8: declarar na tarefa classificar_secoes `levaTextoLivreDePessoa: false`, `levaTextoDeAluno: false` e a `categoriasEnviadas` do material da escola, para a conferência do provedor externo na subida cobrir a tarefa nova.
- §7: dizer se consumo_ia.entrada e saida guardam o texto do material nesta função (até 12 seções por chamada, 300 apostilas por escola) e acrescentar o caso à linha "Entrada e saída das chamadas de IA" de docs/lgpd.md, que hoje só fala do professor como titular.
- §5: dizer quem fica como solicitada_por na execução nascida do POST /reclassificar da coordenação (nulo, como na rotina, ou o coordenador, e então a anonimização dele por prazo vale).
- §4: em GET /v1/habilidades-bncc?turmaId, para o professor, exigir vínculo dele com a turma, por coerência com o RF9. O dado é público e o risco é baixo.
```

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-17 09:01:00 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5 "Seções" (a edição nova não herda a correção, contra o §6 e o RF6 do PRD da F4, sem aval do Joaquim) e lacunas de desenho em §3, §5 e §7c
Portão local: não se aplica (revisão de spec, sem código)

**Bloqueantes**

1. **§3 e §5 "Classificação": a execução da rotina não tem ano letivo, mas a tabela de execuções exige um.**
   - A Tech Spec diz que a classificação roda "sem pessoa nem ano letivo" e que `classificar_secoes` nasce na extração. Só que `execucao_agente.ano_letivo_id` é `not null`, com FK para o ano letivo (`packages/core/src/db/schema/execucao-agente.ts`, colunas e `execucao_agente_ano_letivo_da_escola_fk`).
   - O §3 não muda a tabela e não diz que ano letivo a linha recebe. O caso que mais importa é o do onboarding, em janeiro, numa escola sem ano letivo em curso, que é quando sobem as 300 apostilas do RF15.
   - Hoje o `ExecucaoProcessor` monta o contexto com o `anoLetivoId` de quem pediu e responde `NAO_ENCONTRADO` quando o ano virou (`apps/api/src/ia/execucao.processor.ts`, `#rodar`). A execução criada em 31/12 e rodada em 01/01 cai nesse caminho, e a Tech Spec não diz o que acontece.
   - **Correção exigida:** decidir no §3 e no §5. Ou `ano_letivo_id` passa a aceitar nulo só para `classificar_secoes`, com check preso à tarefa, expandir e contrair numa tabela que cresce, e o efeito no `unique (escola_id, ano_letivo_id, id)`. Ou a Tech Spec diz qual ano a linha recebe e o que acontece sem ano em curso e na virada. Em qualquer dos dois, entra no §11.

2. **§3, §5 "Correção" e §7c "Estados da seção": a correção humana depende de `corrigida_por`, e esse campo é apagado na eliminação do titular.**
   - O `concluir` grava `where ... corrigida_por is null`, e "`corrigida` é final para a IA" sai do mesmo campo.
   - Mas `corrigida_por` tem `on delete set null`. Quando o coordenador que corrigiu é eliminado, a seção volta a parecer não corrigida, e a próxima reclassificação (RF12, ou o comando da operação) sobrescreve a correção humana. Isso viola o RF6 ("nenhuma reclassificação automática a desfaz") e o §6 do PRD ("sempre").
   - **Correção exigida:** a trava e o `corrigida` do DTO passam a ler `corrigida_em`, que não é anulado (ou `origem = 'coordenacao'`). Entra um caso em `cenarios.md`: coordenador eliminado, depois reclassificar, e a correção fica.

3. **§4 (`situacao`) e §7c "Estados da seção": a seção sem execução não tem estado.**
   - Seção cuja disciplina não tem componente, e as seções criadas pela migration (2), ficam com `execucao_id` nulo. Nenhum dos quatro valores de `situacao` cobre esse caso, e a tabela de estados não diz quem tira a seção dali.
   - Gravar o componente pelo `PATCH /v1/disciplinas/:id` não agenda a classificação. O `POST /reclassificar` responde `CONFLITO` enquanto a disciplina não tem componente. Que a coordenação precise reclassificar depois de gravar o componente está implícito, não escrito.
   - O `criar-techspec` exige, para estado que mais de um processo lê, cada estado com a entrada e a saída. Do jeito que está, o contrato do `packages/shared` fica para a tarefa decidir.
   - **Correção exigida:** um estado a mais no enum (por exemplo `sem_componente` ou `nao_agendada`), com a entrada e a saída na tabela. Dizer também se gravar o componente agenda a classificação ou se a tela manda reclassificar.

4. **§5 "Seções" ("A edição nova não herda a correção da anterior"): diverge do PRD sem aval do Joaquim.**
   - O PRD da F4 diz, no §6, "correção humana vence a da IA, sempre", e no RF6 que nenhuma reclassificação automática a desfaz. Com a edição nova, a IA reclassifica tudo sozinha e as correções somem da busca quando a anterior sai.
   - A decisão não está entre as do Joaquim no topo da Tech Spec, não está no §11 e só aparece como risco no §13.
   - **Correção exigida:** herdar a correção pelo capítulo (mesmo número e título, como o próprio §13 sugere), ou levar a pergunta ao Joaquim e registrar a resposta no §11 e no PRD.

**Item por item da lista**

- **Escopo:** cobertos, cada um em sua seção:
  - RF1 e a carga da tabela BNCC, no §3.
  - RF2 e RF7, no §5 "Geração".
  - RF5, no §5 "Classificação".
  - RF6 e RF12, no §5 "Correção" e "Reclassificar".
  - RF9, no §4.
  - RF15, no §7c.
  - RF19, no §5 "Cobertura".
  - RF20, no §6.
  - O item 4 da abertura (a contração da F4), no §3, migration (3).
  - A AIA, no §7b.
  - O §8b do PRD, no §7b.

  Nada invade outra spec.
- **Regra 00:**
  - Erros tipados no §4: ok.
  - DTO sem `corrigida_por` nem `execucao_id` no §7: ok.
  - Nada demorado em request: ok, porque o comando da operação é CLI (`apps/api/src/ops/command.ts`).
  - Contrato em `packages/shared` no §2: ok.
- **Regra 40:** os testes ficam no `cenarios.md`, que é do `test-engineer`.
- **Regra 50:** não é minha, existe o `frontend-reviewer`.
- **Regra 60:**
  - Ano letivo: a seção não tem, e está certo. Mas a execução tem, e é o bloqueante 1.
  - Vocabulário: "seção" e "componente" não estão em `docs/glossario.md`. Vai nas recomendações.
- **Tamanho:** 2.000 palavras exatas, dentro do teto.

**Recomendações**

- **§3:** a FK `(escola_id, capitulo_id)` precisa de `unique (escola_id, id)` em `capitulo_do_material`, que hoje não existe. Declarar isso na migration (1).
- **§4:** a rota ou o comando da operação ("reclassificar uma escola", D76) não aparece na tabela. Declarar o comando em `ops/`, o formato do chamado e se grava em lotes.
- **§6:** faltam no isolamento o `GET /v1/habilidades-bncc` com material ou turma da B e o `PATCH /v1/disciplinas/:id` com disciplina da B.
- **§7b:** "nunca lido por quem o escreve" deve dizer "por quem escreve o prompt".
- **§7c:**
  - O balde de tokens `lote` é global por `provedor:modelo` (`packages/core/src/ia/token-limiter.ts`), não por escola. Hoje ele aparece na linha "Limite por escola".
  - Dizer como duas escolas em onboarding na mesma noite repartem os 5 %.
- **§5 "Geração":** "o que já está gravado com código antigo fica (não há dado real)" é premissa. Marcar com ⚠️ ou conferir na produção (D82), porque a prova do RF2 é "nenhuma saída traz código fora da tabela".
- **§5:** quando a disciplina troca de componente, as habilidades já gravadas podem sair do recorte. Dizer o que acontece com elas.
- **§9:** o PRD dá ao professor "ver a classificação do material". A Tech Spec a restringe à questão do artefato, citando a D73. Registrar isso no §11.
- **PRD §9 (métricas):** tempo até classificar, capítulos corrigidos e habilidades trocadas não têm onde ser medidas. O §7c só diz "as da X6".
- **Glossário:** incluir "seção do material" e "componente curricular" em `docs/glossario.md`, ou usar "capítulo" e "bloco de páginas" na interface.
- **Contagem de tarefas:** o `criar-techspec` manda contar antes da revisão. A Tech Spec não traz a conta, e a minha estimativa passa de 12: são 5 telas e de 8 a 10 tarefas de backend. Registrar o número e, se passar de 12, levar a pergunta do corte ao Joaquim.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/db/schema/execucao-agente.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/db/schema/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/ia/token-limiter.ts

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-17 09:01:01 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum. A spec não cria, não importa e não semeia `Nota`. A classificação grava só `secao_do_material` e `habilidade_da_secao`, e a troca de habilidade grava o conteúdo do artefato. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. A classificação é sobre o material, não sobre o aluno, e não há promoção, retenção nem encaminhamento.

Aprovação registrada: ok no fluxo principal (§5, §7b, §8, §9). A classificação é nível 1 e só chega ao aluno pela atividade. O professor vê e troca a habilidade antes de aplicar, a troca fica só no original sem aplicação nem versão adaptada (§4), e o diagnóstico ainda passa pelo lote aprovado. Falta deixar explícito o caminho do Tutor (bloqueante 2).

Supervisão do tutor: ok. A spec não muda a supervisão nem a exceção da D47, e nenhum outro agente ganha essa exceção.

Autonomia declarada e visível: sim, com lacuna (§7b). A função `classificacao_do_material` tem autonomia 1, alto risco e suspensão, e aparece em "Como cada IA trabalha" porque a tela lê `FUNCOES`. O nível 1 ("executa e registra") é o certo e bate com "indexar material" em `docs/agentes.md`. A lacuna é o que a suspensão faz com o que a IA já classificou (bloqueante 1).

Os outros itens da lista:
- **Item 6, auditoria:** ok. `execucao_agente.resultado` por `execucao_id` guarda o que a IA gerou. A correção vai para `material.classificacao_corrigida` com os códigos antes e depois, a troca para `artefato.habilidade_trocada`, e a aplicação registra quem aprovou e quando.
- **Item 7, vigilância:** não se aplica. Não há dado de aluno na entrada, e o log leva só ids e contagens (§7).
- **Item 8, D55:** não se aplica. A spec não toca texto de aluno nem nota.
- **Item 9, medir o professor:** sem violação no desenho. Vai uma recomendação sobre a métrica do PRD.

Bloqueantes:

1. **§7b, "suspensível": falta dizer o que a suspensão faz com as classificações que a IA já fez.** A spec diz só que a suspensão é conferida antes do modelo (§5) e que a execução falhada vira `nao_classificada` (§7c). As habilidades com `origem: 'ia'` já gravadas continuam alimentando a habilidade de cada questão gerada e, por ela, o diagnóstico, que é alto risco. Assim, a escola que suspende a função porque o classificador erra não para o efeito dele. A regra 70, item 6a, e o `docs/aia/README.md`, item 5, exigem dizer "o que acontece com o que ele já produziu". **Correção exigida:**
   - decidir e escrever no §5 e no §7b o comportamento durante a suspensão. Por exemplo: a geração ignora as habilidades `origem: 'ia'` e a questão sai "Sem habilidade", enquanto as da coordenação continuam valendo; ou ela as mantém e o painel avisa;
   - dizer o que acontece com "Reclassificar", com o comando da D76 e com o agendamento na extração enquanto a função está suspensa;
   - dizer o que a tela da coordenação mostra nesse estado;
   - prever o teste do caminho escolhido.

2. **§5, "Geração" (e §2, linha do `tutor`): o Tutor fica implícito.** O §5 diz que "a busca devolve, com cada trecho, as habilidades da seção da página". A busca (`TrechoSearch`) é a mesma do turno do Tutor, e o §2 lista o `tutor` em "geração pela seção". O PRD da F4 (§6) e o PRD desta spec (§4, linha do aluno) exigem que a classificação só chegue ao aluno pela atividade aprovada (regra 70, item 3). A spec não diz que a entrada do Tutor fica sem as habilidades da seção. **Correção exigida:**
   - escrever no §5 que o turno do Tutor continua recebendo do trecho só `materialId`, `pagina` e `texto`, e que a habilidade que ele usa vem só da atividade aplicada e do lote aprovado (D66);
   - escrever que o "Sem habilidade" é a única mudança no Tutor;
   - prever o teste: a entrada do Tutor não leva o código da seção.

3. **§10, "Em `cenarios.md`": o arquivo não existe** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`). O §7c (ordens das corridas) e o §9 (textos) também apontam para ele. Hoje nenhuma regra da 70 tem teste desenhado. **Correção exigida:** escrever o `cenarios.md` antes da rodada nova, com pelo menos estes cenários:
   - a correção da coordenação vence a execução em curso, a reclassificação e o comando da operação (RF6, RF12);
   - a habilidade fora da seção citada é recusada na gravação do artefato (RF7);
   - a troca pelo professor depois da aplicação, ou com versão adaptada, dá `CONFLITO` e gera auditoria com autor (RF9);
   - `classificacao_do_material` aparece em `FUNCOES` e na tela de governança com nível e texto, e os checks de `execucao_agente` e `consumo_ia` a aceitam;
   - o comportamento da suspensão (bloqueante 1);
   - o Tutor sem as habilidades da seção (bloqueante 2);
   - a habilidade de capítulo ainda não aplicada não aparece para o aluno.
   
   E os textos do painel do material precisam marcar a habilidade como proposta pela IA ou corrigida pela coordenação (regra 70, item 4a). O contrato já tem `origem`, mas a tela da §9 não diz que o mostra.

Recomendações:
- **§7b:** dar à função o `esperaAprovacao`, que a `DeclaracaoDeFuncao` exige e a spec não traz. Por exemplo: "Nada chega ao aluno pela classificação: a habilidade de cada questão só vale quando o professor confere e aplica a atividade". E trocar "cada capítulo" por "cada capítulo ou bloco de páginas".
- **§7b:** listar o que a revisão da AIA `docs/aia/diagnostico-por-habilidade.md` precisa cobrir:
  - a função nova coberta;
  - a habilidade passa a vir da seção, e não da geração (a seção 1.2 fica desatualizada);
  - a taxa mínima e o lote retido como evidência;
  - o caminho de contestação (correção pela coordenação, troca pelo professor);
  - o procedimento de suspensão do bloqueante 1.
- **PRD da F4, §9 ("habilidades trocadas"):** dizer no §7c que a métrica é contada por escola, material ou tarefa, nunca por professor, e que não vira tela nominal para a coordenação (D45, D64, regra 70, itens 8 e 9).
- **§5, edição nova sem herdar a correção:** o painel avisar que a edição anterior tinha correção da coordenação, para que a regra "a correção humana vence sempre" (PRD da F4, §6) não se perca sem ninguém ver.
- **`docs/regulacao.md` §9 (D65):** prevê atividade "alinhada às habilidades de Computação da BNCC", e a tabela fica sem Computação (§3; PRD da F4, §3). Registrar no `TODO.md` que essas questões saem "Sem habilidade" até a carga de Computação.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-ingestao-do-material/prd.md` (RF, §6 e §8b)
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/shared/src/time/funcoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/tutor/turno.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/docs/aia/diagnostico-por-habilidade.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/docs/aia/README.md`

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-17 09:02:34 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Caminho quente tocado: IA | fila | migration | tutor (a busca ganha o join da seção)
Rate limit: ok
Fila e prioridade: problema
Concorrência: corrida na Tech Spec §4 e §7c, na troca de habilidade da questão do artefato
Índice e paginação: ok
Degradação de IA: ausente
Migration: bloqueante
Métrica e alerta: faltando

**Bloqueantes:**

1. **§5 "Classificação", §7c "Limite por escola" e §7c "Quando cada dependência cai": o job de lote herda a degradação do Tutor.**
   - **O que está errado:** o gateway espera até 8 s (`ESPERA_MAXIMA_DA_VAGA_MS`), desce ao modelo menor e encerra em `IA_INDISPONIVEL`. A IA tem 1 tentativa (`RETENTATIVA_DA_IA`). Balde cheio ou provedor fora à noite viram `falhou` definitivo, e a seção fica "não classificada" até alguém clicar em Reclassificar.
   - **A conta:** o balde `lote` é 5 % de 2,5 milhões, cerca de 125 mil tokens por minuto. Cada job reserva cerca de 13 mil, então cabem uns 9 jobs por minuto. O pool de 4 (2 por réplica, 2 réplicas) puxa de 24 a 48 jobs por minuto com latência de 5 a 10 s. O balde corta em quase toda volta. No cenário de carga (`infra/carga.env` com 1,95 milhão, adaptador falso rápido), a maioria das cerca de 625 execuções de uma escola cai em `IA_INDISPONIVEL`. O RF15 ("classificadas numa noite") fica sem garantia, e ninguém é avisado.
   - **Correção exigida:**
     - Uma degradação própria do lote: balde cheio ou disjuntor aberto devolvem o job à fila com recuo, sem consumo e sem gastar tentativa, até o fim da janela noturna.
     - Falha definitiva só para erro que não é transitório.
     - A conta de vazão do lote (jobs por minuto × tokens ≤ balde) escrita na §7c, com o pool calibrado por ela.
     - Um alerta "classificação atrasada" (execução `classificar_secoes` pendente ou falhada quando a janela letiva abre, por escola), com o parágrafo do runbook.
     - O cenário de carga reprovando com qualquer seção `nao_classificada` às 5h, e medindo a retomada depois de o provedor ficar fora por alguns minutos.

2. **§4 (`PATCH /v1/artefatos/:id/questoes/:indice/habilidade`) e §7c "Corridas de concorrência": a troca faz "busca, verifica, grava" e não está na tabela de corridas.**
   - **O que está errado:** a troca confere "sem aplicação nem versão adaptada" e regrava a questão no conteúdo do artefato. Duas trocas seguidas em questões diferentes do mesmo artefato perdem uma das duas (atualização perdida no jsonb). Troca ao mesmo tempo que aplicar, adaptar ou aprovar deixa a aplicação com a habilidade antiga enquanto o artefato mostra a nova.
   - **Correção exigida:** `for update` no artefato, na mesma transação que confere aplicação, adaptação e entrega e grava a troca, com aplicar e adaptar tomando a mesma trava. A tabela de corridas ganha uma linha para cada par: troca × troca, troca × aplicar, troca × adaptar. Cada linha diz o que o perdedor recebe e tem cenário em paralelo com ordem forçada.

3. **§10 ("Em cenarios.md") e §7c ("Ordens em cenarios.md"): `tasks/prd-classificacao-bncc/cenarios.md` não existe.**
   - **O que está errado:** as corridas declaradas (correção × execução, reclassificar × execução, dois reclassificar, edição nova × execução) não têm ordem forçada, nem a troca que deixa o teste vermelho, nem resposta ao perdedor. Não existe estratégia de testes, nem critério de aprovação do cenário de carga.
   - **Correção exigida:** escrever `cenarios.md`, ou completar a §7c, com uma linha por trava, como pede `.claude/skills/criar-techspec/template.md`:
     - a instrução com todas as condições de estado;
     - o que fica na mesma transação;
     - o que o perdedor recebe;
     - a ordem forçada (`esperarNaTrava` ou `WriteBlockTrigger`);
     - a troca que deixa o teste vermelho.

4. **§3 "Migrations" e §7b ("os checks de `execucao_agente` e `consumo_ia` a recebem"): troca de check em tabela grande sem `NOT VALID`.**
   - **O que está errado:** trocar `execucao_agente_funcao_valida`, `_tarefa_valida`, `_tarefa_da_funcao` e o check de função de `consumo_ia` por drop e add simples varre essas tabelas com `ACCESS EXCLUSIVE`. As duas crescem uma linha por turno do Tutor.
   - **Correção exigida:** migration escrita à mão com `ADD CONSTRAINT ... NOT VALID` e depois `VALIDATE CONSTRAINT` (o padrão da `packages/core/drizzle/0036_eliminacao_do_titular.sql`), declarada na §3. O check novo entra antes de qualquer código gravar a função nova.

5. **§5 "Classificação" ("sem pessoa nem ano letivo"): `execucao_agente.ano_letivo_id` é `NOT NULL`, com FK para `ano_letivo`.**
   - **O que está errado:** a Tech Spec não diz que ano letivo a execução recebe.
     - Se for nulo: falta o `DROP NOT NULL` numa tabela grande, e falta a prova de que o código anterior (varredura, expurgo, leituras) aguenta a linha sem ano durante o deploy.
     - Se for o ano em curso: escola sem ano letivo em curso (onboarding em janeiro, na virada) derruba a transação da extração, e o material inteiro vai a `falhou`.
   - **Correção exigida:** decidir e escrever na §3 e na §5.
     - Se nulo: `DROP NOT NULL` (só metadado) numa migration de expansão, e um teste com a linha sem ano lida pelo código atual.
     - Se o ano em curso: escrever o que acontece sem ano em curso. As seções nascem, a execução é adiada e a extração não falha.

6. **§3, migration (3), a contração da F4: a ordem como está escrita quebra o envio de material de terceiro.**
   - **O que está errado:** hoje o código grava e lê `material.licenciante` (`apps/api/src/material/material.service.ts:111,233,304`, `apps/api/src/material/material.repository.ts:19,42`). O check `material_licenciante_so_de_terceiro` exige o campo preenchido no material de terceiro. A Tech Spec tira os checks "depois do código que não o grava". Só que esse código não pode subir com os checks ainda no banco: todo envio de terceiro viola o check. E tirar a coluna no mesmo deploy em que o código para de lê-la quebra a versão anterior durante o deploy, porque o `select()` do Drizzle lista a coluna.
   - **Correção exigida:** três passos declarados, cada um num deploy:
     - (a) migration que tira os dois checks do `licenciante`;
     - (b) versão do código que nem lê nem grava `material.licenciante`, com a coluna fora do schema Drizzle;
     - (c) `DROP COLUMN`, num deploy posterior ao (b).

**Recomendações:**
- O `preparar` deveria filtrar `execucao_id = :esta and corrigida_por is null` e concluir sem chamar o modelo quando não sobra seção. Hoje a execução que foi substituída, ou cujas seções já foram corrigidas, chama o modelo para nada.
- Reclassificar deveria ser idempotente: seção com execução `pendente` não ganha outra (clique duplo).
- Medir a entrada com o maior recorte (Língua Portuguesa do 6º ao 9º, cerca de 170 habilidades com descrição longa) contra os "~12 mil tokens" e o teto de entrada da tarefa. Se passar, diminuir o lote de seções.
- Declarar o laço e o tamanho do lote do comando da operação (cerca de 625 execuções por escola) e da migration (2), contra o `statement_timeout`.
- Dizer que a extração reentregue (D49) não duplica seções nem execuções, porque a criação depende da passagem de `processando` para `pronto`.
- O código anterior precisa ler, durante o deploy, artefato com `habilidade: null` e com código antigo: schema de leitura tolerante.
- Habilidade fora da seção citada: anular a habilidade da questão em vez de recusar o artefato inteiro.
- `EXPLAIN` da cobertura e do join seção/página na busca do Tutor, dentro do cenário da manhã.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/ia/llm-gateway.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/ia/token-limiter.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/shared/src/system/job-definitions.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/db/schema/execucao-agente.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/db/schema/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/material/material.service.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-17 09:03:12 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Revisei só o desenho, sem código, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`, contra o PRD da F4b e os itens da F4 que a nota do corte manda para cá. Encontrei 7 bloqueantes. Os cenários abaixo são a minha proposta para o `cenarios.md`, que ainda não existe.

Legenda das marcas: I = integração com Postgres real e relógio injetado · U = unidade, ou componente com API falsa · P = chamadas em paralelo com ordem forçada · E = e2e em chromebook e celular, com axe · C = carga, fora da esteira.

**Cenários exigidos**

*RF1 (tabela pública da BNCC) e carga*
- [I] Rodar a carga duas vezes dá a mesma contagem: 183 no EM.
- [I] O `on conflict` atualiza a descrição e nunca apaga um código.
- [I] Toda linha tem `versao` e `localizador`.
- [I] O check recusa `EF03CI03B`, `EF15AR01` e `EM13CNT3010`.
- [I] A carga não traz nada de Computação. O check aceita `EF06CO01`, então quem barra é a carga.
- [U] Recorte das candidatas:
  - `EF69LP01` vale no 6º, no 7º, no 8º e no 9º.
  - `EF67EF` vale no 6º e no 7º; `EF89` vale no 8º e no 9º.
  - `EM13CNT301` vale em Química e em Física.
  - Língua Portuguesa no EM traz `EM13LP` e `EM13LGG`.
  - Arte, Educação Física e Ensino Religioso nos blocos.
- [I] Migration do componente pelo nome:
  - "Química", "QUIMICA" e "química" casam. É a "planilha escrita de três jeitos", aqui nas disciplinas.
  - "Português" casa com Língua Portuguesa.
  - "Projeto de Vida" e "Robótica" ficam nulos.
  - A disciplina da escola B não muda.

*RF2 (o catálogo próprio sai)*
- [U] Um teste por saída, cada um com o `ScriptedAdapter` devolvendo `QUI.EM.05`, que tem de ser recusado: atividade, plano, adaptação, chat do Assistente, Tutor. A Tech Spec só fala de questão e plano; os outros três precisam ser citados pelo nome.
- [I] Todo código do seed existe em `habilidade_bncc`.
- [U] A atividade antiga gravada com `QUI.EM.05` ainda abre em Turmas, sem quebrar.

*Seções (na extração)*
- [I] Material com capítulos: uma seção por capítulo.
- [I] Material sem capítulo, 25 páginas: seções 1–10, 11–20 e 21–25.
- [I] Páginas antes do capítulo 1: sem seção, e a questão que as cita sai sem habilidade.
- [I] 25 seções viram 3 execuções (12, 12 e 1), cada seção com o seu `execucao_id`, e o job vai à fila `lote` com `naoUrgente: true`. Mutação: `naoUrgente: false`.
- [I] Disciplina sem componente: seções criadas, nenhuma execução.
- [P] Ampliar o P da F4 ("dois jobs da mesma edição em `Promise.all`"): seções e execuções criadas uma vez só.
- [I] Migration 2: os materiais `pronto` da A e da B ganham seções, em lotes, rodando duas vezes sem duplicar. O material excluído fica de fora.

*RF5 (a IA propõe as habilidades) e processor*
- [I] Caminho feliz com o `ScriptedAdapter`: cada seção grava `origem: 'ia'`, e `consumo_ia` registra `classificacao_do_material` sem pessoa.
- [I] O pacote do Tutor (D38) não é descontado. Mutação: somar ao pacote.
- [U] Saídas que dão `IA_SAIDA_INVALIDA` e não gravam nada:
  - código fora das candidatas;
  - 4 códigos numa seção;
  - seção inventada, omitida ou repetida;
  - código de outra etapa.
- [U] O prompt marca o texto do material como dado; as candidatas vêm no começo; cortes de 1.500 e 500 caracteres.
- [I] `quemPediu` ausente:
  - num comando que não é `daRotina`, dá `NAO_ENCONTRADO`. Mutação: tirar a conferência de `daRotina`.
  - num comando `daRotina`, roda.
- [I] Função suspensa: nenhuma chamada ao modelo, nenhum `consumo_ia`, seção em `nao_classificada`. A geração continua usando a classificação que já existe.
- [I] Balde `lote` cheio: espera 8 s e termina `IA_INDISPONIVEL`. A ferramenta e o Tutor da B continuam reservando. Mutação: a `lote` sem balde próprio.
- [P] Job executado duas vezes (D49): uma chamada ao modelo, um `consumo_ia`, uma gravação.
- [I] Varredura com relógio:
  - `pendente` criada às 3h segue `pendente` às 10h;
  - `rodando` com o worker morto vira `falhou` dentro do prazo, que ainda não existe (B1).

*RF6 (correção da coordenação)*
- [I] A correção vale na geração seguinte.
- [I] Reclassificar não toca a seção corrigida.
- [I] A auditoria `material.classificacao_corrigida` guarda os códigos antes e depois.
- [I] Corrigir com 0 códigos é final.
- [I] Recusas:
  - 6 códigos, código repetido, sufixo estadual ou código fora do recorte dão `ENTRADA_INVALIDA`;
  - material não `pronto` dá `CONFLITO`;
  - `secaoId` de outro material, material excluído ou material da B dão `NAO_ENCONTRADO`, com a mesma resposta do inexistente.
- [I] O 101º pedido da pessoa e o 301º da escola na hora dão 429 com `Retry-After`.

*RF7 e RF9 (habilidade na questão e troca pelo professor)*
- [I] Questão do capítulo 7 sai com habilidade do 7. Com habilidade do capítulo 3, a conferência recusa. Mutação: tirar a conferência.
- [I] Seção `aguardando` ou `sem_habilidade`: a questão sai com `null` e entra no `por_habilidade` com `codigo: null`. É o material subido às 9h e usado às 10h, antes da classificação da noite.
- [I] Questão que cita duas páginas de seções diferentes: o resultado precisa ser fixado (união ou primeira).
- [I] Troca:
  - o diagnóstico usa a habilidade trocada e `habilidade_da_secao` fica intacta;
  - artefato com aplicação ou versão adaptada dá `CONFLITO`;
  - artefato de outro professor da mesma escola, ou da B, dá `NAO_ENCONTRADO`;
  - código de outra disciplina do mesmo professor na mesma turma (Língua Portuguesa e Arte) é recusado.
- [U] O grupo "Sem habilidade" aparece em Turmas, no aluno e no Analista, e não gera sinal sobre o aluno (regra 70, 6a).
[… 198 linhas cortadas]

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-17 09:58:46 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não (revisão de spec, sem foto)
Estados: ok. Painel e Cobertura têm os quatro estados em `cenarios.md`, "Telas". Artefato e Estrutura não os listam; está nas recomendações.
Acessibilidade: ok. `cenarios.md`, "Telas", [E] cobre o seletor com teclado (abre, filtra, fecha, foco devolvido ao botão), axe, e a situação dita em texto e não só em cor.
Chromebook fraco: ok. A lista do seletor é limitada (`techspec.md` §4: até ~200 candidatas, com filtro por código e texto), sem necessidade de virtualização. A cobertura é por série escolhida, o que limita a lista.
Celular: ok. [E] roda nos projetos `chromebook` e `celular`, a 360 px, com alvo de 24 px e 44 px na ação principal. Não há dependência de hover.
Ação oficial protegida: sim. Reclassificar pede confirmação com o que será refeito ("N trechos serão classificados de novo hoje à noite; M corrigidos ficam como estão"). Trocar fica desabilitado depois da aplicação, com o motivo. A correção da coordenação é auditada com o antes e o depois dos códigos.

Conferência dos bloqueantes da rodada 1:
- **Busca no seletor de habilidades:** resolvido. `techspec.md` §9 (Painel e Artefato: "seletor com filtro"; a lista da troca traz primeiro as do capítulo) e `cenarios.md`, "Telas" (filtro por código e texto, de 0 a 5 códigos).
- **Paginação da cobertura:** resolvido. `techspec.md` §4 limita por `serieId` e por componente (área, no EM), e §9 traz a escolha da série. A lista fica pequena e cabe sem paginar.
- **`cenarios.md` com a seção "Telas":** resolvido. Traz os rótulos em português de `situacao` e `origem`, os dois avisos, o texto de "Sem habilidade" e o do `CONFLITO` da troca.

A correção não abriu bloqueante novo.

Bloqueantes: nenhum

Recomendações:
- `cenarios.md`, "Telas": o vazio do Painel ("Nenhum capítulo classificado ainda") diz o que acontece, mas não o próximo passo. Sugestão: "Nenhum capítulo classificado ainda. A classificação roda hoje à noite", ou o aviso do componente quando ele falta.
- `cenarios.md`, "Telas": Artefato e Estrutura não listam carregando, erro e vazio. Acrescentar uma linha em cada. O erro precisa dizer o que fazer, por exemplo "Não foi possível trocar a habilidade. Tente de novo em instantes".
- `cenarios.md`, "Telas": o seletor sem resultado de busca não tem texto ("Nenhuma habilidade com esse código ou texto"). Falta também o texto do erro do `429` (teto por hora), que deve dizer quando tentar de novo.
- `techspec.md` §9: o termo "seção" aparece na descrição de tela. Garantir que a interface mostre "capítulo" ou "páginas X a Y", como pedido no glossário na rodada 1.
- `techspec.md` §10: são 13 tarefas, acima de 12. A pergunta do corte ao Joaquim é do `revisor-geral`, e não bloqueia a minha parte.

## pedagogia-reviewer · 2ª rodada · APROVADO · 2026-11-17 09:59:11 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO

Amostras avaliadas: 0 saídas reais. Esta é uma revisão de spec, então li `techspec.md` (§3 a §13) e `cenarios.md` por inteiro. Também conferi `TODO.md` e `docs/aia/ouro-retido/`.

**Os bloqueantes da rodada 1**

Os meus dois bloqueantes eram a medida pedagógica e o lote retido. Ambos estão resolvidos.

1. **Lote retido sem categorias, sem piso e sem "aceitável" (§7b, "Classificação de texto (a)" e "Taxa mínima"): resolvido.**
   - O lote tem 48 seções em 8 categorias, com contagem fixa. As categorias cobrem capítulo e bloco do EF, capítulo do EM, bloco de páginas, capítulo longo, sem conteúdo curricular, fora do recorte e injeção.
   - O formato do item traz `referencia ⊆ aceitaveis ⊆ candidatas`. O texto vem no tamanho real, de 3 a 40 páginas.
   - A taxa é medida na pior de três execuções, com saída inválida contando como erro. Os pisos são: 90% das seções com um código da referência, nenhuma etapa abaixo de 80%, 80% dos códigos propostos em `aceitaveis`, no máximo 1 de 6 `sem_conteudo_curricular` com código e nenhuma `injecao` obedecida.
   - Quem mede e quando também está dito: o Arquiteto, antes da tarefa que troca o catálogo, com o resultado e o sha256 no `RETIDOS.json`. A saída é explícita se a taxa falhar (`padrao`, ou função suspensa por decisão do Joaquim). O desvio da regra 40, item 4, está no §11.
   - O texto do lote não é escrito por quem escreve o prompt. O lote é feito por subagente em contexto limpo, e quem escreve o prompt usa só um conjunto `dev` próprio.

2. **Habilidade por questão não medida e nenhum professor no circuito (§7b): resolvido.**
   - A ferramenta gera 10 atividades sobre seções do lote e lista questão e habilidade. O `pedagogia-reviewer` julga, e o piso é de 80% coerentes.
   - Um professor real confere o lote retido antes do primeiro aluno real. Isso está no cabeçalho e no §7b. A AIA passa a tratá-lo como etapa 2 (§7b).
   - A decisão do Joaquim de rodar o intervalo com a revisão de vocês (você e o `conformidade-reviewer`) está registrada de forma coerente.

**Textos que o professor e o aluno leem**

Os textos que o professor e o aluno leem em `cenarios.md`, "Telas", estão adequados:
- **Rótulos:** os cinco rótulos de `situacao` estão em português comum, e a marca da IA é "Sugerida pela IA".
- **Aluno e professor:** a mensagem "Esta questão não tem habilidade da BNCC associada." é clara e sem culpa.
- **CONFLITO da troca:** o texto diz o que fazer ("Gere a atividade de novo").
- **Nomes na interface:** "Capítulo N" ou "Páginas X a Y" substitui "seção" (§1), o que atende a recomendação da rodada 1.
- **Cobertura:** mostra as seções ainda sem classificação.

O gabarito do aluno não muda: a habilidade só chega ao aluno por atividade que o professor aplicou, e o Tutor não recebe a habilidade da seção (§5, com teste em `cenarios.md`, "Geração e Tutor").

**A correção abriu outro bloqueante?** Não. Abriu quatro pontos menores, todos recomendações.

Problemas por categoria: nível, distratores, gabarito e tutor não se aplicam a esta spec. No alinhamento curricular, as lacunas são só as recomendações abaixo. O tom dos textos de tela está correto.

Exemplos concretos do que saiu errado: nenhum bloqueante.

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum. Os ajustes abaixo valem para a tarefa do lote.

Bloqueantes: nenhum.

Recomendações:
1. **§7b, lote conferido pelo professor.** O professor confere o lote depois da medida (a medida vem antes da troca do catálogo). Se ele alterar `referencia` ou `aceitaveis`, o sha256 do `RETIDOS.json` muda e a taxa precisa ser medida de novo. Escrever isso na tarefa do lote.
2. **§7b e `TODO.md`.** O item "professor confere o lote" ainda não existe no `TODO.md` (busquei e não achei). A spec o cita ali, então a tarefa do lote deve criá-lo, com dono (Joaquim) e a condição "antes do primeiro aluno real". Ligá-lo a algo que bloqueie a escola piloto, e não só a uma linha de lista.
3. **§7b, categorias sem piso próprio.** `fora_do_recorte`, `capitulo_longo` e `bloco_de_paginas` entram no lote, mas não têm critério de passagem fora das taxas globais. Definir a `referencia` esperada em `fora_do_recorte` (provavelmente vazia ou o código do ano vizinho) e dizer quem decide o "aceitável".
4. **§7b, por questão.** Os 10 artefatos são julgados só pelo `pedagogia-reviewer`. O professor real que confere o lote poderia também julgar uma amostra de questões e habilidades. Isso é a evidência mais próxima do uso real.
5. **Texto da confirmação do reclassificar (`cenarios.md`, "Telas").** "N trechos serão classificados de novo hoje à noite" usa "trechos", enquanto o resto usa "capítulos" ou "páginas X a Y". Unificar a palavra. O rótulo "Classificação hoje à noite" também pode ficar errado quando a janela já fechou e o job foi adiado (§5). Usar "à noite" sem o "hoje".

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md` (§5, §7b)
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-17 09:59:20 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO

Os dois bloqueantes da rodada 1 estão resolvidos, e a correção não abriu bloqueante novo.

**Bloqueante 1 da rodada 1 (a marca da correção dependia de `corrigida_por`): resolvido.**
- §3 (linhas 30 a 32 e 38): a seção ganhou `corrigida_em`, e o texto diz que "a marca da correção é `corrigida_em`, que a eliminação do titular não toca; `corrigida_por` é só autoria". A FK fica `on delete set null ("corrigida_por")`, só nessa coluna, então `escola_id` não é zerado junto.
- §5 (linhas 90, 94 e 103): o `preparar` e o `concluir` filtram por `corrigida_em is null`, e a correção grava `corrigida_em`.
- §7c, "Estados da seção": `corrigida` vence todos os estados.
- `cenarios.md`, "Correção e reclassificação" (linha 60): eliminado o coordenador que corrigiu, `corrigida_por` fica nulo, `corrigida` segue `true` e reclassificar mantém a correção. O teste tem a mutação "a marca em `corrigida_por`". A rotina das 19h (linha 31) tem a mutação de tirar o filtro de `corrigida_em`.

**Bloqueante 2 da rodada 1 (`cenarios.md` não existia): resolvido.** A seção "Dado pessoal" de `cenarios.md` traz os cinco testes exigidos:
- (a) o contrato de `GET /v1/materiais/:id` sem `corrigida_por` nem `execucao_id`, em `apps/api/test/contracts.test.ts` (linha 107);
- (b) `corrigida_por` na lista `fora` do arquivo do titular, achado por ele (linha 108);
- (c) a eliminação do coordenador (linha 60);
- (d) as quatro ações no catálogo da auditoria, em `acoes.test.ts`, sem título nem texto (linha 109);
- (e) o log da rotina e do `concluir` sem título, texto nem código escolhido (linha 110).

**O que conferi nas mudanças desta rodada.** Conferi também o que mudou e afeta a sua regra:
- **`execucao_agente.ano_letivo_id` nulo (§3):** o expurgo anonimiza por `criada_em`, sem olhar o ano (`packages/core/src/retencao/expurgo-da-escola.repository.ts:210`). O arquivo do titular procura a execução pela pessoa que pediu, e só lista `ano_letivo_id`, que pode vir nulo (`packages/core/src/titular/leitura-do-titular.ts:271`). Nenhum dos dois quebra, e há cenário para o código anterior que lê a execução sem ano (`cenarios.md`, linha 42).
- **`consumo_ia` (§7, linha 137):** a entrada guarda só os ids das seções e a versão do prompt, e a saída só os códigos. Assim o texto do material não fica guardado, e a linha "Entrada e saída das chamadas de IA" de `docs/lgpd.md` não precisa crescer. Há cenário para isso (`cenarios.md`, linha 38).
- **`GET /v1/habilidades-bncc` (§4):** a entrada agora é `materialId` ou `artefatoId`, e o artefato só vale para o dono. Material ou artefato da outra escola, ou de um colega, recebe `NAO_ENCONTRADO`, igual ao inexistente (`cenarios.md`, linhas 99 e 100).

```
VEREDITO: APROVADO
Campos pessoais tocados: secao_do_material.corrigida_por (coordenador, só autoria); ações de auditoria material.classificacao_corrigida, material.reclassificado, escola.reclassificada, artefato.habilidade_trocada; execucao_agente e consumo_ia da função classificar_secoes, sem pessoa (solicitada_por nulo, sem ano letivo)
Fora da tabela de dados do docs/lgpd.md: corrigida_por e as quatro ações ainda não estão no mapa; a §7 (linha 133) manda incluir na linha do material, na tarefa da migration. Aceito
Autorização por objeto: ok (§4, ordem das respostas; cenarios.md "Permissão e isolamento", inclusive GET /v1/habilidades-bncc com artefato de colega ou da escola B)
Logs: limpos (§7; cenarios.md linha 110)
Auditoria: presente (§7, as quatro ações; correção com os códigos de antes e de depois; o comando da operação com chamado)
Envio externo: título e até 2.000 caracteres por seção do texto do material, mais as candidatas da BNCC, ao provedor do perfil rapido; registrado em execucao_agente (classificar_secoes) e consumo_ia (envio_externo, provedor); nenhum dado de aluno; a tarefa declara levaTextoDeAluno: false e a categoria do material
Seed/fixture: sintético (seed com códigos da BNCC; lote retido escrito por subagente)
Bloqueantes: nenhum
Recomendações:
- §5 "Seções" (linha 82): a edição nova herda corrigida_por junto com corrigida_em. Com isso, o arquivo do titular atribui ao coordenador a correção de uma seção que ele nunca tocou. Herdar só corrigida_em e as habilidades, com corrigida_por nulo, ou escrever no §5 que a autoria herdada é intencional.
- §5 "Reclassificar": continua sem dizer quem fica como solicitada_por na execução nascida do POST /reclassificar da coordenação. Diga se é nulo, como na rotina e no comando daRotina, ou o coordenador; se for o coordenador, diga de onde vem o ano letivo, que o check só deixa nulo em classificar_secoes. Os dois caminhos já estão cobertos pela anonimização e pela eliminação de hoje; é só para o contrato não ficar a cargo da tarefa.
- §7, Provedor externo: declarar também levaTextoLivreDePessoa: false, ao lado de levaTextoDeAluno: false.
```

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/achados/revisao-spec.md` (os bloqueantes da rodada 1)

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-17 09:59:45 · `tasks/prd-classificacao-bncc/revisao-spec.md`

**VEREDITO: APROVADO** (conformidade, rodada 2 da spec)

Os três bloqueantes da rodada 1 estão resolvidos, e a correção não abriu bloqueante novo da regra 70.

**Bloqueante 1, o que a suspensão faz com o que a IA já classificou: resolvido**
- **O que acontece:** o §5, "Suspensão", diz que a geração, a troca e a cobertura ignoram as habilidades com `origem: 'ia'` e que só a correção da coordenação vale.
- **Os caminhos parados:** "Reclassificar" e o comando da D76 recusam, e a rotina das 19h não agenda. A extração também não agenda, porque o §5, "Seções", só cria execução "com componente e a função ativa".
- **A tela:** o painel recebe `classificacaoSuspensa` (§4), e o aviso está escrito em `cenarios.md`, "Telas".
- **Os testes:** `cenarios.md` cobre o caso em quatro lugares:
  - a geração com a função suspensa ("Geração e Tutor");
  - nenhuma chamada e nenhum consumo ("Classificação no worker");
  - o `FUNCAO_SUSPENSA` do reclassificar ("Correção e reclassificação");
  - a rotina e a extração que não agendam ("Seções e agendamento").
- **A AIA:** a suspensão está na lista do que a revisão da AIA precisa cobrir (§7b).

**Bloqueante 2, o Tutor ficava implícito: resolvido**
- O §5, "Geração", diz que o Tutor não recebe as habilidades da seção: a entrada dele segue com `materialId`, `pagina` e `texto`, e a habilidade só chega pela atividade aplicada.
- O §9 mostra "Sem habilidade" ao aluno.
- O teste, com mutação, está em `cenarios.md`, "Geração e Tutor": "A entrada do Tutor não leva habilidade da seção".

**Bloqueante 3, o `cenarios.md` não existia: resolvido**
Cada cenário que exigi tem onde estar:
- **A correção vence a execução, a reclassificação e a D76:** em "Correção e reclassificação" e nas corridas P1a, P1b e P2.
- **Habilidade fora da seção:** é anulada em vez de recusada, que foi a recomendação do infra. O teste com mutação está em "Geração e Tutor".
- **Troca depois da aplicação ou com versão adaptada:** dá `CONFLITO`, e a troca gera `artefato.habilidade_trocada`, em "Troca pelo professor".
- **A função em `FUNCOES` e na governança:**
  - os testes que já existem percorrem `CHAVES_DE_FUNCAO`: `apps/api/src/governanca/governanca.int.test.ts:270-279` e `packages/shared/src/governanca/governanca.test.ts:88-117`;
  - a função nova entra neles sem teste novo, inclusive na regra do português comum;
  - o check de `consumo_ia` é provado no caminho feliz da classificação.
- **Habilidade ainda não aplicada não aparece ao aluno:** o aluno recebe `NAO_ENCONTRADO` no material e nas habilidades ("Permissão e isolamento").
- **A marca "Sugerida pela IA" ou "Corrigida pela coordenação":** está em "Telas" e no §9 (regra 70, item 4a).

**O lote retido (§7b):** a conferência por um professor antes do primeiro aluno real está escrita, como etapa 2 da AIA e no `TODO.md`, como o Joaquim decidiu.

**Item 9, medir o professor:** as correções e trocas são contadas por escola, nunca por professor (§7c, "Métrica").

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum (a spec grava secao_do_material, habilidade_da_secao e a questão do artefato; Nota não é criada, importada nem semeada) — todos com autor humano? não se aplica
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nível 1 sobre o material; chega ao aluno só pela atividade que o professor confere e aplica; a exceção da D47 não aparece em outro agente; o Tutor não recebe a habilidade da seção, §5 "Geração")
Supervisão do tutor: ok (a spec não toca na supervisão; entrada do Tutor inalterada, com teste e mutação)
Autonomia declarada e visível: sim (classificacao_do_material, nível 1, alto risco, suspensível, fazSozinha e esperaAprovacao no §7b; a tela de governança lê FUNCOES)
Bloqueantes: nenhum
Recomendações:
- cenarios.md, "Correção e reclassificação": somar dois casos com a função suspensa, o comando D76 recusado e a cobertura sem as habilidades com origem 'ia'. Hoje o §5 afirma os dois e só o reclassificar tem teste; o "nenhuma chamada" do worker segura o efeito, mas a recusa na entrada fica sem prova.
- §5, "Suspensão": dizer o que "a troca ignora origem 'ia'" significa na prática (a ordem da lista do seletor, ou a sugestão que o professor vê primeiro). Como está, a frase admite mais de uma leitura.
- §5, "Edição nova": a seção que herda a correção aparece como "Corrigida pela coordenação" numa edição que a coordenação não viu. Registrar a herança na auditoria (por exemplo, `material.classificacao_herdada`, com a seção de origem) ou mostrar no painel "correção herdada da edição anterior".
- §7b, "Taxa mínima": "a função nasce suspensa" precisa do mecanismo. A suspensão hoje é por escola, em suspensao_de_funcao. Dizer se vira uma suspensão gravada para cada escola, com autor e motivo na auditoria, ou uma trava global com teste.
- cenarios.md: nomear o caso da governança, a função nova com nível 1 e os textos, mesmo que os testes de hoje já a cubram ao percorrer CHAVES_DE_FUNCAO. Isso torna o vínculo explícito para quem implementa.
```

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/achados/revisao-spec.md (bloco da minha rodada 1)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/shared/src/time/funcoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/governanca/governanca.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/shared/src/governanca/governanca.test.ts

## llm-integrator · 2ª rodada · AJUSTES NECESSÁRIOS · 2026-11-17 09:59:48 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

O bloqueante da rodada 1, o `cenarios.md` ausente, está resolvido: o arquivo existe e cobre os itens exigidos. A correção abriu um bloqueante novo, na rotina de agendamento. Ele é pequeno, mas custa dinheiro toda noite.

Perfis usados: `rapido` para `classificar_secoes` (§8). Se a taxa mínima falhar no `rapido`, a Tech Spec manda usar `padrao` (§7b). Chamada única por execução, sem laço de agente.

Custo estimado por professor/mês: a Tech Spec estima ~625 chamadas e ~7 milhões de tokens por onboarding de escola, R$ 4 a 20 por escola, menos de R$ 0,01 por aluno por mês (§8). O número está anexado e é aceitável, mas só vale para o `rapido`. A conta por professor/mês só se sustenta se a rotina das 19h não reagendar seção já classificada (bloqueante abaixo).

Prompt versionado: sim (`packages/core/src/ia/prompts/classificar-secoes.ts`, com a versão na execução).

Validação de schema: sim. Saída de 0 a 3 códigos por seção, restrita às candidatas, com `IA_SAIDA_INVALIDA` quando o modelo desobedece. A sonda de saída em `cenarios.md` cobre os casos.

Aprovação humana no caminho: sim. A atividade só chega ao aluno quando o professor aplica. A correção da coordenação vence a da IA. A função é suspensível, com autonomia 1.

Bloqueantes:

1. **Techspec §5, "Agendar" (linha 84-86), contra `cenarios.md`, "Seções e agendamento" (linha 30) e §7c, "Estados da seção" (linha 191).**
   - O que está errado: o §5 manda agendar "seções não corrigidas e sem execução viva". Lida ao pé da letra, a seção `classificada` ou `sem_habilidade` também cai nessa regra, porque a execução dela está `concluida` e não conta como viva. A rotina das 19h reclassificaria todo o material, toda noite, indefinidamente, e o custo estimado de ~625 chamadas por onboarding passaria a se repetir a cada noite.
   - O `cenarios.md` diz que a rotina agenda `nao_agendada` e `nao_classificada` e "não toca `aguardando`". Ele não diz que `classificada` e `sem_habilidade` ficam de fora, e a mutação citada (tirar o filtro de `corrigida_em`) não pega isso.
   - Correção exigida:
     - (a) Reescrever o §5 para "seções com situação `nao_agendada` ou `nao_classificada`", ou seja, sem execução, ou com a última execução `falhou`. A seção com `classificada_em` preenchido nunca é reagendada pela rotina.
     - (b) Acrescentar ao `cenarios.md` o caso "seção `classificada` e `sem_habilidade` não ganham execução nova na rotina", com a mutação "agendar sem `classificada_em is null`".
     - (c) Deixar explícito que só reclassificar, D76, o `PATCH` do componente e o `PATCH` de séries refazem seção já classificada.

Pontos que você pediu para checar, sem bloqueante:

- **Adiamento do job com balde cheio (§5, "Degradação do lote"):** está correto.
  - A execução volta a `pendente`, o job é adiado por `JobAdiadoError` (mecanismo que já existe e que `enviar-email` usa), sem gastar tentativa nem consumo.
  - A janela das 5h o segura até a noite seguinte.
  - O alerta `classificacao-atrasada` e a carga que reprova com seção não classificada às 5h cobrem o atraso.
  - O cenário "Janela" cobre a `pendente` às 10h e a `rodando` morta.
  - O que falta é só o delay do adiamento e a prova de que a varredura não fecha a `pendente`. Ver as recomendações.
- **`preparar` sem modelo (§5):** resolvido, com teste e mutação em `cenarios.md`. A execução conclui sem modelo e sem `consumo_ia` quando nenhuma seção está viva. O `concluir` relê o material `for share` e grava só `where execucao_id = :esta and corrigida_em is null`, e as corridas P1 a P4 provam isso.
- **Taxa (§7b):** resolvida. O lote retido tem categorias, pisos, a pior de três execuções, medida por questão, medida antes da tarefa que troca o catálogo e o desvio da regra 40 declarado no §11. Ficam só ambiguidades, abaixo.

Os demais itens exigidos na rodada 1 estão atendidos, nas seções que você indicou. Cada item abaixo diz onde está resolvido.

- **`ano_letivo_id` nulo:** §3, por `drop not null` com check restrito a `classificar_secoes`.
- **`corrigida_em`:** §3, com teste do coordenador eliminado.
- **`uuidv7` e `unique (escola_id, id)`:** §3.
- **Trava de troca:** §5, com as corridas P6 a P8.
- **`NOT VALID`/`VALIDATE`:** §3.
- **Contração da F4 em três passos:** §3.
- **Edição nova herda a correção:** §5.
- **Suspensão e habilidades `origem: 'ia'`:** §5.
- **O Tutor não recebe as habilidades:** §5, com teste.
- **`GET /v1/habilidades-bncc` com autorização por objeto:** §4 e §6.
- **Estados da seção:** §7c.

Recomendações:

- **Delay do adiamento (§5):** defina o recuo do `JobAdiadoError` com jitter, para centenas de jobs `lote` não girarem a cada poucos segundos com o balde cheio.
- **Varredura de execuções (§7c):** diga em texto como a varredura deixa de fechar a `pendente` adiada, por exemplo contando o prazo do `rodando`. O `cenarios.md` já testa o resultado, mas o §5 e o §7c não dizem o mecanismo.
- **Taxa no `padrao`:** se o `rapido` não bater a taxa, o custo e a vazão mudam, porque o balde é em tokens por minuto. Refaça a estimativa de custo e a de vazão nessa hipótese e registre o resultado no `RETIDOS.json`.
- **Modelo da taxa (§7b):** diga qual modelo precisa atingir o piso, o local ou o candidato da produção, ou ambos. Defina também o denominador de "seções com conteúdo", em que `fora_do_recorte` conta ou não, e como se detecta "injecao obedecida".
- **Vazão (§7c):** declare o número de réplicas e a latência por chamada que sustentam ~10 execuções/min com pool de 1 por réplica. A carga mede, mas a spec deveria fixar o ponto de partida.
- **Paginação da cobertura:** a exigência do frontend na rodada 1 (paginação da cobertura) não aparece. `GET /v1/materiais/cobertura` devolve `semMaterial[]` sem teto.
- **Unicidade da execução:** confirme na tarefa de migration que `execucao_agente` ganha `unique (escola_id, id)`, ou use o alvo `(escola_id, ano_letivo_id, id)` já existente. A FK `(escola_id, execucao_id)` da seção precisa de um alvo, e com `ano_letivo_id` nulo o composto antigo não serve.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-11-17 09:59:51 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

**Tabelas verificadas:**
- `habilidade_bncc`: pública e sem escola, como permite a regra 10, item 1. O desvio está registrado no §11.
- `disciplina.componente_bncc`.
- `capitulo_do_material`: ganhou o `unique (escola_id, id)`.
- `secao_do_material`: `id uuid pk default uuidv7()`, `escola_id`, FKs compostas. Fica sem `ano_letivo_id`, o que está correto, porque o PRD da F4, §6, não dá ano ao material.
- `habilidade_da_secao`: PK e FK compostas com a escola.
- `execucao_agente`: `ano_letivo_id` passa a aceitar nulo, só em `classificar_secoes`, com check. Seguem as FKs que vêm de `artefato`, `mensagem_agente`, `resumo_do_analista` e das outras tabelas. Elas apontam para `unique (escola_id, ano_letivo_id, id)`, e em todas essas o ano é obrigatório. Pela regra do Postgres para FK com nulo (MATCH SIMPLE), nenhuma delas consegue apontar para uma execução sem ano. A seção aponta pela `unique (escola_id, id)`. Também não se abre caminho entre escolas: a FK de `escola_id` para `escola` continua valendo sozinha. O check prende o nulo à tarefa, e o teste "execução sem ano lida pelo código anterior" está em `cenarios.md`, linha 42. A correção não abriu brecha de tenancy.
- `consumo_ia`: já não tinha ano.

**Queries verificadas:**
- As sete rotas do §4.
- O `preparar` e o `concluir` (§5). Eles leem só por escola, como os métodos do `ExecucaoRepository` que não chamam `requireAnoEmCurso`.
- O `quemPediu` ausente, aceito só em comando `daRotina`, com teste e mutação.
- A busca da geração, com o join em `habilidade_da_secao`.
- A cobertura.
- A rotina das 19h, o comando D76 e a migration (2).

**Os quatro bloqueantes da rodada 1:**
1. **Ano letivo da execução: resolvido** (§3, linhas 35 e 38–39; §5, linha 79).
2. **`GET /v1/habilidades-bncc`: resolvido** (§4, linhas 63 e 68). A `turmaId` saiu, e o `artefatoId` só vale para o dono. O teste está em `cenarios.md`, linhas 99–100.
3. **A marca da correção agora é `corrigida_em`: resolvido** (§3, linha 38; §5, linhas 90 e 94). O teste do coordenador eliminado, com mutação, está em `cenarios.md`, linhas 60–61.
4. **Id da seção em UUID: resolvido** (§3, linha 29).

**Teste de isolamento:** presente e efetivo nas rotas que a rodada 1 cobrava. Falta o da entrada nova `serieId`.

**Bloqueantes:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md:64` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md:97-103`. A correção trouxe uma entrada nova vinda do cliente na cobertura, o `serieId` da query string, e nenhum teste prova o escopo dela. O §4, linha 68, diz "série da escola, senão `NAO_ENCONTRADO`", mas o único teste de isolamento da cobertura é o de "material da B" (linha 102). Se alguém tirar a cláusula de escola da leitura da série, esse teste não quebra, e o `serieId` da B devolve 200 com as candidatas daquela série. Isso confirma que o id existe e revela a etapa e o ano da série (regra 10, itens 4 e 6).
  - Correção exigida: acrescentar em "Permissão e isolamento" o cenário "`GET /v1/materiais/cobertura?serieId=<da B>`: `NAO_ENCONTRADO`, igual ao inexistente", com a mutação "tirar `escola_id` da leitura da série".

**Recomendações:**
- `cenarios.md:99`: incluir o professor da A pedindo `GET /v1/habilidades-bncc?materialId=` de material da própria escola, mas de disciplina em que ele não tem vínculo. Deve responder `NAO_ENCONTRADO`, porque é o alcance da F4 aplicado à rota nova.
- `techspec.md:64`: `/v1/materiais/cobertura` precisa ser declarada antes de `:id`, como `resumo` e `busca` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/material/material.controller.ts`. Vale escrever isso na tarefa da cobertura.
- `techspec.md:101`: dizer se a execução do reclassificar pedido pela coordenação grava `solicitada_por` ou fica nula, como a da extração. Do jeito que está, o `daRotina` e o `quemPediu` ausente parecem cobrir só a extração e a rotina.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-17 10:00:20 · `tasks/prd-classificacao-bncc/revisao-spec.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. A spec cobre RF1, RF2, RF5, RF6, RF7, RF9, RF12, RF15, RF19 e RF20, e também o item 4 da abertura. Nada invade outra spec. O tamanho fica no teto que o Joaquim subiu: 2.788 palavras e 13 tarefas.

**Aderência à Tech Spec:** divergência em §5 "Agendar". O texto contradiz a tabela de estados do §7c e o `cenarios.md` (bloqueante abaixo).

**Portão local:** não se aplica. É revisão de spec e não há código.

### Os 4 bloqueantes da rodada 1

1. **Ano letivo da execução: resolvido.** Está no §3 (o ano da execução aceita nulo só em `classificar_secoes`, com check), na migration (1) e no §5 "Classificação". No código, nada quebra com o ano nulo:
   - A FK para o ano letivo ignora o nulo.
   - Os dois `unique` (com e sem o ano) seguem válidos.
   - A FK nova da seção para a execução usa o `unique (escola_id, id)`, que já existe.
   - Sem ano, a leitura da execução já devolve `quemPediu` ausente, e a spec trata esse caso com o comando `daRotina`.
   - O cenário "código anterior lê execução sem ano" está escrito.

   Faltou só a linha no §11 que eu pedi. Isso ficou nas recomendações, porque a lista consolidada de correções não a exigia.
2. **Marca da correção: resolvido.** A marca agora é `corrigida_em` (§3, §5, §7c), e a FK de `corrigida_por` anula só essa coluna. O caso do coordenador eliminado está em `cenarios.md`:60.
3. **Seção sem execução: resolvido.** Ganhou o estado `nao_agendada` (§7c), com entrada e saída. Gravar o componente agenda a classificação (§5 "Agendar"). O rótulo da tela está em `cenarios.md`:133.
4. **Edição nova: resolvido.** A seção herda a correção pelo capítulo de mesmo número e título (§5 "Seções"), o que fica dentro do RF6. Confere com a F4: a extração marca a edição antiga como excluída na mesma transação, então a releitura do material na P4 vale. O cenário tem a mutação em `cenarios.md`:33.

### Bloqueantes novos

**`techspec.md`:84-86, §5 "Agendar": a regra de agendamento classifica de novo, toda noite, o que já está classificado. E o `PATCH` faz esse trabalho em lote dentro da requisição.**
- A regra diz que ganham execução as "seções não corrigidas e sem execução viva". Uma seção `classificada` ou `sem_habilidade` tem execução `concluida`, e o termo "viva" não está definido em lugar nenhum.
- Lido como está, a rotina das 19h agenda de novo todo o material da escola, toda noite. São cerca de 7 milhões de tokens por escola por noite e o balde `lote` ocupado. Também troca as habilidades que o professor já viu.
- Isso contradiz a tabela de estados (`techspec.md`:193: `classificada` só sai por reclassificar ou por correção) e o `cenarios.md`:30-31 (a rotina agenda `nao_agendada` e `nao_classificada`). O cenário só prova que a rotina "não toca `aguardando`". Nenhuma mutação pega a rotina reagendando `classificada`.
- O mesmo parágrafo põe o `PATCH /v1/disciplinas/:id` como agendador. Numa disciplina com centenas de materiais, isso cria milhares de seções e centenas de execuções e jobs na transação da requisição. A regra 00 proíbe trabalho demorado em request, e a linha "Laços" do §7c só fala em lotes para a rotina e para o comando da operação (D76).

**Correção exigida:**
- (a) Separar os dois gatilhos no §5. A rotina das 19h agenda só seção não corrigida sem execução ou com execução `falhou`. Gravar o componente e o `PATCH` de séries reagendam também as classificadas, porque o recorte mudou.
- (b) O `PATCH` só enfileira o job `material.agendar-classificacao` daquela escola e daquela disciplina ou material, e esse job agenda em lotes de 500, como a rotina. Acrescentar isso à linha "Laços" do §7c.
- (c) Em `cenarios.md`, a rotina das 19h não toca seção `classificada` nem `sem_habilidade`. Mutação: o filtro que aceita execução `concluida`.
- (d) Trocar "execução viva" por estados nomeados (`pendente` ou `rodando`).

### Recomendações

- **§11:** registrar o ano nulo da execução como desvio da regra 10, item 2 (e da 60): a classificação é do material, que não tem ano (F4, §6).
- **`cenarios.md`:133:** com a função suspensa, a execução termina com `FUNCAO_SUSPENSA` e a seção mostra "A classificação não terminou. Reclassificar". Só que reclassificar está recusado nesse caso. Com a suspensão ativa, mostrar só o aviso da suspensão.
- **§4:** `GET /v1/materiais/cobertura` convive com `GET /v1/materiais/:id`. Declarar a ordem das rotas, ou que o `:id` recusa o que não é UUID, para "cobertura" não cair no `NAO_ENCONTRADO`.
- **§5 "Classificação":** dizer que o comando `daRotina` não passa pela releitura da execução da sessão, que hoje exige o ano em curso e quem pediu (`apps/api/src/ia/execucao.repository.ts`:263 e 281). Só pular a checagem de `quemPediu` não basta.
- **Glossário:** seguem sem entrada "seção do material" e "componente curricular". A tela também alterna "trechos" e "capítulo" (`cenarios.md`:141-143).

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/db/schema/execucao-agente.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/ia/execucao.repository.ts

```
VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5 "Agendar" (contradiz o §7c e o cenarios.md)
Portão local: não se aplica (revisão de spec)
Bloqueantes: techspec.md:84-86 — a rotina das 19h reagenda toda seção classificada e o PATCH agenda em lote dentro da requisição; separar os dois gatilhos, o PATCH só enfileira o job, cenário com mutação, "execução viva" com estados nomeados
Recomendações: §11 com o ano nulo; rótulo da seção com a função suspensa; ordem das rotas de /materiais; releitura da execução no daRotina; glossário
```

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-17 10:01:36 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: IA | fila | migration | tutor (join da seção na busca)
Rate limit: ok
Fila e prioridade: problema
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ausente (declarada, mas incompleta: janela e modelo menor)
Migration: bloqueante
Métrica e alerta: ok

**Como ficaram os seis bloqueantes da rodada 1**

1. **Degradação do lote: parcial.** O `JobAdiadoError`, a falha só para erro não transitório, a conta de vazão, o alerta `classificacao-atrasada` e o critério de carga estão escritos (§5, "Degradação do lote"; §7c). Sobram os bloqueantes 1 e 2 abaixo.
2. **Troca com `for update` e as corridas: resolvido** (§5, "Troca"; `cenarios.md`, P6 a P8).
3. **`cenarios.md`: resolvido.** As corridas P1 a P8 trazem a trava, o perdedor, a ordem forçada e a mutação.
4. **Checks com `NOT VALID`: resolvido para os checks trocados.** O check novo da coluna nula ainda está ambíguo (bloqueante 3).
5. **`ano_letivo_id`: resolvido** (§3; §7c, "Migration"). A coluna fica nula só em `classificar_secoes`, a virada não afeta a execução e há teste com o código anterior. Nenhum código de produção lê a coluna sem ano. Se o worker antigo pegar o job novo durante o deploy, o job falha com `TIPO_DESCONHECIDO` e a varredura antiga encerra a execução. A seção fica `nao_classificada` e a rotina das 19h a reagenda.
6. **Contração da F4: resolvido** (§3, migration 3). Conferi em `apps/api/src/material/material.repository.ts:42-43`: o código de hoje já grava `licenca_id` junto com `licenciante`. Então a versão anterior passa no check novo `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` mesmo com `NOT VALID`. Tirar os checks de `licenciante` antes do código novo, no mesmo deploy, é compatível, e o `DROP COLUMN` foi para o deploy seguinte.

**Bloqueantes**

1. **`techspec.md:96-98` (§5, "Degradação do lote") e `cenarios.md:52`: o texto diz que "a janela fechada às 5h o segura até a noite seguinte". Isso não existe no código.**
   - Hoje a janela letiva só é aplicada quando o despachante publica (`apps/despachante/src/outbox-relay.ts:160`).
   - O job adiado não volta por ali. `JobExecutor.adiar` (`packages/core/src/jobs/job-executor.ts:438-445`) usa `devolverAoPublicado` e `moveToDelayed`, e o job já está no BullMQ. Quando o recuo vence, o `worker-ia` o consome a qualquer hora, inclusive às 10h.
   - Também não existe janela que feche às 5h. A `JanelaLetiva` da escola é o horário de aula dela (padrão de 7h às 18h).
   - Na prática, com o provedor fora às 4h, os jobs de classificação voltam a chamar o modelo durante a aula, o que viola a regra 80, item 2.
   - **Correção exigida:**
     - O processador de `ia.executar-lote` lê a janela da escola antes de passar a execução de `pendente` para `rodando`. Dentro do horário letivo, ele lança `JobAdiadoError` com `baseMs = proximaAbertura(janela, agora) − agora`, sem modelo, sem consumo e sem transição.
     - O recuo do balde ou do provedor fica limitado da mesma forma.
     - Os "5h" saem do §5 ou viram regra escrita (corte próprio da noite, com a fonte do horário).
     - Cenário novo em `cenarios.md`: job adiado que volta às 7h05 não chama o modelo e fica adiado até a abertura. Mutação: tirar a conferência da janela no processador.

2. **`techspec.md:96` e `techspec.md:176` (§5 e §7c, "Vazão") contra `packages/core/src/ia/llm-gateway.ts:403-446`: "balde `lote` cheio" nunca chega ao processador como balde cheio.**
   - Sem vaga, o gateway espera até 8 s e depois desce ao modelo menor do perfil. `TAREFAS_SEM_MODELO_MENOR` (`llm-gateway.ts:65`) só tem `turno_do_tutor`.
   - O balde do modelo menor é outro, porque a chave é `provedor:modelo` (`llm-gateway.ts:450`). Só depois disso vem `IA_INDISPONIVEL`.
   - A conta da §7c dá cerca de 10 execuções por minuto. O pool é de 2 (1 por réplica, 2 réplicas) e, com 5 a 8 s de latência, puxa de 15 a 24 por minuto. O excedente vai, de forma sistemática, ao modelo menor.
   - Esse modelo não foi medido no lote retido, o que fura o portão da taxa da §7b e contradiz a §5. O pool não foi calibrado pela conta, como a rodada 1 exigia.
   - **Correção exigida:**
     - `classificar_secoes` entra em `TAREFAS_SEM_MODELO_MENOR`, declarado na §8 (ou o modelo menor passa pela medida da §7b, com a mesma taxa).
     - A §7c escreve a vazão do pool (`réplicas × pool × 60 / latência`) contra o balde e diz que o adiamento é o regulador do excedente.
     - Cenário novo: balde `lote` cheio adia o job e nunca chama o modelo menor. Mutação: tirar a tarefa do conjunto.

3. **`techspec.md:48` (§3, migration 1): "`drop not null` (metadado) com o check novo".**
   - O `NOT VALID` e o `VALIDATE` estão escritos só para os checks de função e tarefa que são trocados.
   - O check novo, de ano nulo só em `classificar_secoes`, também entra em `execucao_agente`, que cresce a cada turno do Tutor. Um `ADD CONSTRAINT` simples ali varre a tabela inteira com `ACCESS EXCLUSIVE`.
   - **Correção exigida:** escrever que esse check também entra com `ADD … NOT VALID` e depois `VALIDATE`, como a `0036`, ou que é somado ao check de tarefa que já segue esse padrão.

**Recomendações**

- **Alerta:** `classificacao-atrasada` com "pendente há mais de 24 h" (`techspec.md:184`) avisa só no fim do dia letivo seguinte. Vale disparar também quando a janela da escola abre com execução `classificar_secoes` pendente ou falhada criada na noite anterior.
- **Motivo do adiamento:** declarar o `MotivoDoAdiamento` novo (hoje só existem `limite`, `redis` e `reserva_alheia`) e o `baseMs` de cada caso (balde: `msAteLiberar`; disjuntor: o tempo dele).
- **`IA_INDISPONIVEL` permanente:** a recusa de soberania (`llm-gateway.ts:282-294`) devolve o mesmo código e adiaria para sempre. Pode virar falha definitiva ou contar no alerta.
- **Consumo no adiamento:** "Sem consumo" só vale quando nenhuma tentativa saiu (`gasto.tentativas = 0`). A chamada que saiu e caiu por tempo grava `consumo_ia`, com o envio externo marcado (regra 30, item 4).
- **Vaga `lote` por escola:** é dividida com o expurgo e a eliminação do titular. Vale registrar no runbook que cerca de 65 minutos de classificação atrasam esses jobs da escola.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/jobs/job-executor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/despachante/src/outbox-relay.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/packages/core/src/ia/llm-gateway.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/material/material.repository.ts`

## test-engineer · 2ª rodada · REPROVADO · 2026-11-17 10:02:22 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Revisei a Tech Spec refeita (`git diff 4674fb5a`), o `cenarios.md` novo, o PRD da F4b e os RF da F4 que ele aponta. O meu texto da rodada 1 ficou cortado no arquivo de achados ("198 linhas cortadas"). Por isso conferi os B1 a B7 pelo resumo de `revisao-spec.md`, "Rodada 1". A Tech Spec tem 2.788 palavras, para um teto de 2.800, e 13 tarefas.

**Cenários exigidos:** os da rodada 1, um bloco por RF (RF1, 2, 5, 6, 7, 9, 12, 15, 19, 20); o isolamento efetivo; as corridas com ordem forçada e mutação; as telas com os quatro estados e os textos; e a privacidade. Entram também os casos de borda da casa:
- dois professores de disciplinas diferentes na mesma turma;
- planilha com a disciplina escrita de três jeitos;
- virada do ano;
- material de manhã usado antes da noite;
- job executado duas vezes;
- escola barulhenta ao lado.

**Cobertos (o que a correção resolveu):**
- **B1, os estados:** resolvido. A tabela da §7c tem `nao_agendada`, com saída. O prazo da `rodando` morta é 300 s, e o componente gravado depois volta a agendar.
- **B2, o `concluir` relê o material:** resolvido em parte. A releitura tem o P4, com mutação. Falta a trava (bloqueante 3).
- **B3, o `preparar` só com seções vivas:** resolvido. Tem cenário com mutação (`cenarios.md:47`), e o P3 cobre o reclassificar idempotente.
- **B4, o recorte que muda depois:** resolvido em parte. A geração lê pelo recorte atual (`cenarios.md:77`), mas o reagendamento ficou errado (bloqueante 1).
- **B5, `GET /v1/habilidades-bncc`:** resolvido, com objeto no alcance e teste de isolamento (`cenarios.md:99`).
- **B6, a troca com `for update`:** resolvido, com P6, P7 e P8.
- **B7, o lote retido:** resolvido. Tem as categorias somando 48, os pisos de `sem_conteudo_curricular` e `injecao`, a definição de `aceitaveis`, quem mede e quando, a medida por questão e a conferência por professor no `TODO.md`. O desvio da regra 40 está na §11.
- **Outros pontos resolvidos:**
  - privacidade: contrato, arquivo do titular, eliminação do coordenador com mutação, catálogo da auditoria e log;
  - rótulos de `situacao` e de `origem`;
  - 360 px, teclado e foco, axe;
  - nenhum provedor pago: `ScriptedAdapter` e adaptador falso em todos os testes.

**Bloqueantes:**

1. **A §5, "Agendar" (`techspec.md:84-86`), agenda de novo o que já foi classificado e não reclassifica o que mudou de recorte.** O texto diz "seções não corrigidas e sem execução viva". Uma seção `classificada` ou `sem_habilidade` tem execução `concluida`, que não está viva, então a rotina das 19h a manda à IA toda noite. Já o `PATCH` de séries ou de componente precisa do contrário: refazer a classificada. E a execução `rodando` com as candidatas antigas precisa perder, senão grava `EF06…` e a seção nunca mais volta à IA. `cenarios.md:30-32` não prova nenhum dos dois casos.
   - **Correção na spec:** separar na §5. A rotina pega a seção sem execução ou com execução `falhou`. O `PATCH` segue a regra do reclassificar: sem execução `pendente`, e a `rodando` conclui sem efeito.
   - **Correção nos cenários:**
     - a rotina não toca `classificada` nem `sem_habilidade` (mutação: o filtro só por "sem execução viva");
     - uma seção classificada com `EF06…`, depois do `PATCH` para o 9º, ganha execução nova com as candidatas do 9º;
     - um `PATCH` durante uma `rodando` faz a antiga concluir sem efeito (mutação: o `PATCH` com a regra da rotina).

2. **Agendar duas vezes ao mesmo tempo não tem corrida (`cenarios.md:117-129`).** A rotina das 19h entregue duas vezes (D49), ou a rotina junto com o `PATCH` do componente, cria duas execuções por seção e paga o modelo duas vezes.
   - **Correção:** a §5 diz como o banco resolve. Pode ser `update … where execucao_id is not distinct from :lida`, ou `for update` na seção.
   - **Cenário novo, P9:** duas rotinas em `Promise.all`, e depois rotina × `PATCH`, dão uma execução por seção. Mutação: tirar a condição.

3. **A trava do material no `concluir` e o material excluído no `preparar` não têm teste.** O P4 (`cenarios.md:125`) solta a execução depois que a extração já confirmou. Ele prova a releitura, não o `for share` de `techspec.md:93`. E o `preparar` diz "material `pronto` e não excluído" (`techspec.md:90`), mas o cenário de `cenarios.md:47` só cobre "todas corrigidas, ou de outra execução".
   - **Correção:**
     - P4b: o `concluir` parado depois do `select … for share`, e a exclusão ou a edição nova esperando (mutação: tirar o `for share`). A alternativa é tirar a trava da spec.
     - No cenário de `cenarios.md:47`, o caso do material excluído entre o agendar e o `preparar`.

4. **O limite por escola e o pool da `lote` não têm teste (`techspec.md:175`, `:177`).** Hoje `FILAS_DA_IA` é `['interativa', 'ferramenta', 'normal']` (`apps/api/src/ia/worker-de-ia.ts:34`), e nada prova que o `worker-ia` passa a consumir a `lote` do executor `api`. Nada prova também que a vaga de 1 por escola impede que as 625 execuções da A segurem a B. É a regra 80, item 3, e o PRD da F4, §6.
   - **Correção (I):** duas execuções da A e uma da B na fila. A segunda da A espera, e a da B roda. O caminho feliz passa pelo worker real. Mutações: a `lote` sem limite por escola; `FILAS_DA_IA` sem a `lote`.

5. **Cláusulas novas sem cenário:**
   - o alerta `classificacao-atrasada` (`techspec.md:184`), sem o teste no molde de `infra/test/alerta-do-pdf-parado.int.test.ts`;
   - o teto da troca, 100/h e 300/h (`techspec.md:71`): `cenarios.md:65` só cobre o `PUT` e o reclassificar;
   - na suspensão, a cobertura ignora `origem: 'ia'` e o D76 recusa (`techspec.md:105-106`): só a geração e o reclassificar têm cenário;
   - o plano com `habilidades` igual à união das seções citadas (`techspec.md:110`);
   - o check "`ano_letivo_id` nulo só em `classificar_secoes`" (`techspec.md:35`): falta o caso de outra função com ano nulo recusada (mutação: sem o check);
   - o laço de 500 seções por transação, até o sinal, na rotina e no D76 (`techspec.md:179`);
   - o provedor fora com `IA_INDISPONIVEL`, que também adia (`techspec.md:96`): só o balde cheio e o disjuntor têm cenário (`cenarios.md:50`).

6. **As telas sem os quatro estados e sem as mensagens (correção 1 da rodada 1).**
   - Artefato (`cenarios.md:147`) e Estrutura (`:148`) não têm carregando nem erro.
   - O seletor de habilidades não tem carregando, erro nem vazio.
   - A §4 não diz o que `GET /v1/habilidades-bncc` e a troca respondem quando a disciplina não tem componente (Projeto de Vida, Robótica, o caso comum).
   - O `CONFLITO` do `PUT` com material não `pronto` não tem mensagem.
   - **Correção:** definir isso na §4 e escrever o cenário e o texto de cada estado.

**Recomendações:**
- **P6 e P8:** fixar um só resultado por ordem, no lugar do "ou". No P8, com a adaptação segurando o artefato, a troca recebe `CONFLITO`. Pôr também a ordem inversa do P6.
- **`IA_SAIDA_INVALIDA` sem teto:** hoje volta à IA toda noite, sem fim, com custo diário e o alerta disparando sempre. Um limite de noites ajudaria.
- **Vazão:** com a vaga 1 por escola, uma escola só anda no ritmo da latência. Os ~65 min supõem ~6 s por execução; a carga vai mostrar.
- **Carga:** dizer em que tarefa ela roda e quem a roda antes do pouso.
- **Cenários por tarefa:** marcar cada bloco com o número da tarefa (são 13), para a validação casar um teste com cada linha.
- **Permissão:**
  - professor com `materialId` de disciplina que não é dele no `habilidades-bncc`;
  - `serieId` da B na cobertura;
  - coordenação tentando o `PATCH` da troca.
- **Analista:** o grupo "Sem habilidade" não gera sinal sobre o aluno (regra 70, item 6a).
- **Virada:** a turma do ano novo usa a classificação feita no ano anterior.
- **Métricas:** a do tempo do envio à classificação sem teste, e a "cobertura por série no primeiro mês" do PRD, §9.
- **Questão que cita duas seções:** fixar a regra.
- **Paginação da cobertura:** era correção do `frontend-reviewer` e não aparece na §4. Ele confere.
- **Palavras:** a spec está a 12 do teto. A maior parte das correções vai no `cenarios.md`; a divisão da §5 precisa ser compensada em outra seção.

[… 4 linhas cortadas]

## llm-integrator · 3ª rodada · AJUSTES NECESSÁRIOS · 2026-11-17 10:05:30 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: `rapido` (`classificar_secoes`). Nenhum perfil novo.
Custo estimado por professor/mês: não se aplica ao professor. A classificação roda por escola e por material, não por professor. São cerca de 625 chamadas no onboarding de uma escola de 300 apostilas, a R$ 4 a 20 por escola (§8). A escola paga isso uma vez, fora do pacote do Tutor (D38). Reclassificar, mudança de recorte e as noites de nova tentativa somam chamadas, mas a estimativa não as cobre.
Prompt versionado: sim (`packages/core/src/ia/prompts/classificar-secoes.ts`, versão na execução).
Validação de schema: sim (candidatas e formato; fora disso vira `IA_SAIDA_INVALIDA`).
Aprovação humana no caminho: sim. A habilidade de cada questão só vale quando o professor confere e aplica a atividade, e a correção da coordenação vence.

**Meu bloqueante da rodada 2: resolvido.** O §5 "Agendar" separa os gatilhos. A rotina das 19h pega só a seção "sem execução, ou com a última `falhou`", e `classificada` e `sem_habilidade` nunca entram. A mudança de recorte só enfileira o job e refaz também as classificadas. Os estados do §7c estão nomeados. O P9 (`where execucao_id is not distinct from :lido`) cobre o agendar duas vezes e a rotina contra o `PATCH`, e a mutação prevista é tirar a condição. A conferência da janela letiva no processador, o `TAREFAS_SEM_MODELO_MENOR` com jitter e a vazão contra o balde estão no §5, no §7c e em `cenarios.md`.

Bloqueantes:
- **techspec.md §5 "Degradação do lote" (linha 105), §7c "Estados da seção" (linha 194) e cenarios.md linha 33.** O teto de "três noites seguidas" não tem onde viver nem como ser verificado.
  - A seção guarda só o `execucao_id` mais recente, e o reagendar o troca (P9). O histórico de falhas se perde, e o §3 não traz contador nem coluna de tentativas.
  - A rotina não tem como saber que é a quarta noite. Ou ela reagenda a `falhou` para sempre, que é o laço de custo que o teto devia impedir, ou o teto não existe no código.
  - O cenário "reagendada por três noites e não na quarta" não pode ser escrito como teste. Sem estado para contar, não há mutação que o quebre.
  - Há um agravante. `FUNCAO_SUSPENSA` e `EXECUCAO_INTERROMPIDA` também terminam `falhou` e entram na mesma contagem. Uma função suspensa por três noites esgotaria o teto de todas as seções, e elas ficariam paradas depois da retomada, contra o que o §5 diz ("Retomada: a rotina das 19h agenda").
  - Correção exigida:
    1. Escrever no §3 o estado que conta as noites, por exemplo `tentativas_de_classificacao smallint` em `secao_do_material`, ou um campo na execução com a cadeia, mais a migration dele.
    2. Dizer que o `concluir` com sucesso e o reclassificar zeram o contador.
    3. Dizer que só `IA_SAIDA_INVALIDA` incrementa. Falha por suspensão ou por interrupção não conta, ou então a retomada zera.
    4. Nomear o estado depois do teto no §7c, por exemplo `nao_classificada` com teto, para o painel e o alerta `classificacao-atrasada` tratarem a seção. Sem isso o alerta dispara toda noite para a mesma seção.
    5. Ajustar o cenário da linha 33 com a mutação "tirar o teto" e os casos de suspensão e interrupção.

Recomendações:
- §5 "Agendar" e §7c. Dizer o que acontece com a seção cuja última execução concluiu sem efeito, por exemplo porque o material saiu de `pronto` entre o agendar e o `preparar`. Ela não está nem `aguardando` nem `nao_classificada`, e o filtro da rotina ("sem execução, ou última `falhou`") não a pega. Basta incluí-la em `nao_agendada`.
- O alerta `classificacao-atrasada` (§7c) deve excluir a seção que atingiu o teto, ou abrir outro alerta com runbook para ela.
- §5 "Classificação". Dizer que o jitter também vale quando o adiamento vem da conferência da janela, para as seções não voltarem todas no mesmo segundo ao fechar a janela. Hoje o texto só cita jitter no adiamento por provedor.

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-17 10:05:55 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO

**Bloqueante da rodada 2: resolvido.** O cenário está em `cenarios.md`, "Permissão e isolamento", linhas 124 e 125: `GET /v1/materiais/cobertura?serieId=<da B>` precisa devolver `NAO_ENCONTRADO`, igual ao id inexistente, com a mutação "tirar `escola_id` da leitura da série". O teste é efetivo. Sem a cláusula, a série da B é encontrada e a rota devolve 200 com as candidatas dela, então o teste quebra. A ordem da Tech Spec, §4, linhas 67 e 68, sustenta esse resultado: primeiro confere se a série é da escola, e só depois valida a entrada. A cobertura da A com material da B continua coberta na linha 127.

**O que a correção mudou, conferido:**
- **§4, linha 71, rota declarada antes de `:id`:** `/cobertura` não cai mais em `GET /v1/materiais/:id`.
- **§4, linhas 70 e 71, disciplina sem componente:** a resposta `semComponente` só vem depois da conferência de alcance da linha 67. Assim, material ou artefato da B continua dando `NAO_ENCONTRADO` antes de revelar se a disciplina tem componente. Os testes estão em `cenarios.md`, linhas 107, 108, 122 e 123.
- **§5, linhas 84 a 89, "Agendar":** o job roda por escola e lê a escola de `job_registro.escola_id` (§6, linha 131). O `PATCH` só enfileira o job e não recebe escola do cliente. O `update … is not distinct from :lido` grava `execucao_id`, e a FK composta `(escola_id, execucao_id)` do §3, linha 31, impede que uma seção da B aponte para uma execução da A.
- **§5, linha 108, reclassificar com `solicitada_por` nulo:** não abre caminho entre escolas. A autoria fica na auditoria `material.reclassificado`.

Tabelas verificadas: `habilidade_bncc` (pública, desvio registrado no §11), `disciplina.componente_bncc`, `capitulo_do_material`, `secao_do_material`, `habilidade_da_secao`, `execucao_agente` (ano nulo só em `classificar_secoes`, com check). Nenhuma mudou de forma nesta rodada.
Queries verificadas: leitura da série na cobertura; `GET /v1/habilidades-bncc` com `semComponente`; job `material.agendar-classificacao` (rotina das 19h e o job enfileirado pelo `PATCH`) com o `update … is not distinct from`; reclassificar com `solicitada_por` nulo.
Teste de isolamento: presente e efetivo
Bloqueantes: nenhum
Recomendações:
- `cenarios.md:30`: o teste da rotina das 19h só tem a escola A. Falta um cenário com uma seção `nao_agendada` da B: o job da A agenda só as da A e não toca a da B. A mutação é "tirar `escola_id` do select do agendar". Hoje a FK composta transformaria esse erro numa falha do job a cada noite, sem vazar dado, mas nenhum teste mostraria isso.
- `techspec.md:92` e `techspec.md:108`: a execução do reclassificar pedida pela coordenação agora nasce sem `solicitada_por`. A Tech Spec precisa dizer que o comando dela é `daRotina`. Sem isso, o cenário de `cenarios.md:48` (sem `quemPediu` fora de `daRotina` dá `NAO_ENCONTRADO`) recusaria o próprio reclassificar.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`

## revisor-geral · 3ª rodada · REPROVADO · 2026-11-17 10:06:13 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §5 "Agendar" e "Degradação do lote" (o teto de noites não tem dado nem regra)
Portão local: não se aplica. É revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", que é o esperado nesta fase.

**O bloqueante da rodada 2 está resolvido.**
- **Gatilhos separados (§5 "Agendar", linhas 84 a 89).** A rotina das 19h pega só a seção sem execução ou com a última execução `falhou`, e nunca a `classificada` nem a `sem_habilidade`. A mudança de recorte refaz também a seção classificada.
- **O `PATCH` só enfileira o job.** O job agenda em lotes de 500, como manda o §7c "Laços".
- **Estados com nome.** `nao_agendada` e `nao_classificada` aparecem na tabela de estados do §7c.
- **Corrida P9.** Usa `where execucao_id is not distinct from :lido` e está em `cenarios.md`.
- **Janela letiva.** É conferida no processador e o "5h" saiu.
- **`TAREFAS_SEM_MODELO_MENOR`.** A classificação entrou na lista.
- **Ano nulo.** Está no §11 como desvio da regra 10, item 2, e o check usa `NOT VALID` com `VALIDATE` (§3).
- **Testes.** Os cenários de "Seções e agendamento" cobrem os dois gatilhos e trazem as mutações certas.

**Bloqueantes:**
- **`techspec.md` §5 "Agendar" (linha 86), §5 "Degradação do lote" (linhas 104–105), §3 (linhas 28–31) e §7c "Estados" (linha 194).**
  - **O que está errado.** A correção abriu um furo na própria parada do laço. O §5 promete que "a rotina reagenda até três noites seguidas, e depois a seção espera o reclassificar". O cenário cobra isso ("reagendada por três noites e não na quarta"). Mas nada diz como a rotina sabe quantas noites já foram.
  - **Por que a conta não sai de nenhum lugar.** A seção guarda só o `execucao_id` da última execução. No §3 não há coluna de contagem. Contar pelo histórico de `execucao_agente` também não serve: uma execução cobre 12 seções, e o expurgo anonimiza a `entrada` para `{ tarefa }`.
  - **Consequência.** Pela letra da linha 86 ("com a última `falhou`"), a seção que sempre dá `IA_SAIDA_INVALIDA` volta ao modelo todas as noites, sem fim, e gasta dinheiro a cada noite. É a mesma classe de defeito do bloqueante da rodada 2, agora na seção que falhou. O Implementador vai inventar a coluna e a regra em silêncio.
  - **Falta também dizer quais erros contam.** `EXECUCAO_INTERROMPIDA` vem de deploy ou de worker morto. `FUNCAO_SUSPENSA` vem da execução `pendente` que já existia quando a função foi suspensa. Contar esses dois trava seções sem culpa delas, e elas ficam esperando o reclassificar manual.
  - **Correção exigida, em seis pontos.**
    1. Criar no §3 uma coluna na seção, por exemplo `falhas_seguidas smallint not null default 0`.
    2. Dizer no §5 quem incrementa: o `falhou` da execução que é dona da seção, pelo `execucao_id`.
    3. Dizer quem zera: o `concluir`, o reclassificar, o D76 e a mudança de recorte.
    4. Trocar o filtro da rotina por "última `falhou` e `falhas_seguidas < 3`".
    5. Dizer se `EXECUCAO_INTERROMPIDA` e `FUNCAO_SUSPENSA` contam.
    6. Ajustar o §7c "Estados" e o cenário. Mutação: tirar o `< 3`, e a seção vai à quarta noite.

**Recomendações:**
- **`PATCH` do componente para nulo (§5 "Agendar", gatilho (b)).** O §5 não diz o que acontece com as seções `classificada` de habilidades `origem: 'ia'` do componente antigo. Não dá para refazer sem candidatas. Escrever que elas passam a `nao_agendada`, com `execucao_id` nulo, e que o `GET /:id` filtra as habilidades pelo recorte atual. Falta também um cenário para isso.
- **Gatilho (b) e seção `aguardando` (§5).** Dizer se o (b) troca também a execução da seção `aguardando` em execução `pendente`. Se o `preparar` já lê as candidatas pelo recorte atual, isso basta e evita duas execuções.
- **Dois `PATCH` seguidos (§5 "Agendar").** Hoje cada `PATCH` refaz as seções inteiras. Uma chave de job por material ou disciplina, que deduplique enquanto o job está na fila, evita isso.
- **§4.** Citar que o `PATCH` de séries do material, que é da F4, passa a enfileirar `material.agendar-classificacao`. Hoje só o `PATCH /v1/disciplinas/:id` aparece na tabela.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-17 10:07:14 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila | IA | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: faltando
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes:
- `tasks/prd-classificacao-bncc/techspec.md:104-105` (§5, "Degradação do lote") e `techspec.md:194` (§7c, estados), com o teste em `tasks/prd-classificacao-bncc/cenarios.md:33`. A correção criou a regra "a rotina reagenda até três noites seguidas, e depois a seção espera o reclassificar", mas nenhum lugar guarda essa contagem. Em `secao_do_material` (§3, `techspec.md:28-31`) só existe `execucao_id`, que aponta para a última execução. `execucao_agente` não aponta de volta para a seção; o id dela só aparece no `jsonb` da `entrada`. Com isso, a rotina das 19h tem dois caminhos, ambos ruins:
  - não consegue contar, e reagenda a seção com `IA_SAIDA_INVALIDA` toda noite, sem fim, pagando o modelo a cada vez e ocupando o balde `lote`;
  - conta varrendo `execucao_agente` pelo `jsonb`, tabela que cresce com o uso de todas as escolas, sem índice que comece pelo escopo.

  Correção exigida: pôr no §3 uma coluna em `secao_do_material` (por exemplo `falhas_seguidas smallint not null default 0`). O `concluir` com `falhou` soma 1 na mesma transação, filtrando por `execucao_id = :esta`. O `concluir` que dá certo, o reclassificar e a mudança de recorte zeram a coluna. O filtro da rotina passa a ser `falhas_seguidas < 3`, coberto pelo índice parcial do §7c. Nos cenários, a mutação "sem o teto": a quarta noite chama o modelo.

Recomendações:
- §5 "Agendar" (`techspec.md:84-89`): dizer qual é a `chaveIdempotencia` do `material.agendar-classificacao`. O outbox descarta um segundo job com a mesma chave enquanto o primeiro não terminou (`packages/core/src/queue/job-outbox.ts:40-43`). Se a chave for só o material ou a disciplina, um segundo `PATCH` feito enquanto o primeiro job roda à noite é descartado, e uma execução que já concluiu fica com as candidatas do recorte antigo. Pôr na chave a versão do recorte (por exemplo o id da auditoria do `PATCH`).
- §5 "Agendar": declarar se o job de agendar é `naoUrgente`. Se for, o despachante o segura durante a janela e o `PATCH` das 10h não ocupa a vaga `lote` da escola, que é dividida com expurgo e eliminação. Declarar também se o `PATCH` só enfileira quando o recorte de fato mudou.
- §5 "Classificação": o adiamento pela janela precisa de motivo próprio em `MotivoDoAdiamento` (`packages/core/src/jobs/job-adiado.error.ts:2`), separado de `provedor`, para a métrica de adiamento não misturar janela com provedor fora.
- §7c "Alerta": num onboarding grande, o excedente planejado ("o resto, na noite seguinte") dispara `classificacao-atrasada` toda manhã. O runbook precisa separar esse atraso esperado de uma falha real, ou o alerta precisa contar só a execução que passou da primeira noite.
- §8 (`techspec.md:200`): a estimativa de ~12 mil tokens por execução parece baixa para as candidatas de Língua Portuguesa do 6º ao 9º. A conta de vazão do §7c depende dela. A spec já manda medir na tarefa; a conta do §7c deve ser refeita com o valor medido.

Situação dos bloqueantes da rodada 2:
1. **Janela: resolvido.** No §5 "Classificação" (`techspec.md:92-93`), o processador confere a janela antes de passar a `rodando` e adia até o fim dela. No §5 "Degradação", o adiamento que cai dentro da janela fica segurado por essa conferência. O "5h" saiu: a carga agora reprova pela abertura da janela. A varredura deixa a `pendente` com job vivo em paz, e o cenário "Janela" (`cenarios.md:66-68`) testa isso, com mutação.
2. **Modelo menor: resolvido.** No §5 "Degradação do lote" (`techspec.md:100-103`), `classificar_secoes` entra em `TAREFAS_SEM_MODELO_MENOR`; balde cheio, disjuntor aberto e provedor fora levam a `JobAdiadoError` sem gastar tentativa. A vazão está escrita contra o balde no §7c (`techspec.md:176`), e o cenário em `cenarios.md:61-64` tem as três mutações.
3. **Check do ano: resolvido.** No §3 "Migrations" (`techspec.md:46-49`), o check entra com `NOT VALID` e depois `VALIDATE`, no mesmo desenho da `packages/core/drizzle/0036_eliminacao_do_titular.sql`.

Agendamento separado: a rotina e a mudança de recorte ficaram em gatilhos distintos. O `PATCH` só enfileira o job; o P9 protege agendar × agendar com `is not distinct from :lido`; e os laços rodam em lotes de 500. Fora a contagem das três noites (bloqueante acima) e a chave do job (recomendação), não abriu outro problema.

## test-engineer · 3ª rodada · REPROVADO · 2026-11-17 10:07:34 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos (rodada 2, as minhas seis correções):
1. Separar os dois gatilhos do agendar: a rotina não reagenda o que já foi classificado, e a mudança de recorte refaz o que foi classificado.
2. Agendar contra agendar dá uma execução por seção (P9).
3. P4b com o `for share`, e o material excluído no `preparar`.
4. Limite por escola e `FILAS_DA_IA` com a fila `lote`.
5. Cláusulas que estavam sem cenário: alerta, teto da troca, suspensão na cobertura e no D76, plano, check do ano, laço, provedor fora, `serieId` da escola B.
6. Estados e textos das telas, `CONFLITO` do `PUT`, disciplina sem componente no seletor e na troca.

Cobertos:
1. Resolvido. A techspec §5 "Agendar" tem os gatilhos (a) e (b), com estados nomeados. Em `cenarios.md`, "Seções e agendamento", a rotina das 19h tem duas mutações (tirar o filtro de `corrigida_em`, aceitar execução `concluida`). A mudança de recorte tem a mutação "o `PATCH` com a regra da rotina" e a prova de que o `PATCH` só enfileira o job. A execução `rodando` durante o `PATCH` tem cenário.
2. Resolvido. A linha P9 da tabela "Corridas" tem a condição `is not distinct from :lido`, a ordem forçada e a mutação (duas execuções, dois modelos).
3. Resolvido. O `preparar` cobre o material excluído entre o agendar e o `preparar`, com mutação, e a P4b existe. Há um problema de texto na P4b, abaixo nas recomendações.
4. Resolvido. A §7c diz a vaga e a `FILAS_DA_IA`. "Classificação no worker" testa pelo worker real, com duas mutações.
5. Resolvido, item por item: "Alerta e métrica"; o teto 101º e 301º; suspensão na geração, na cobertura e no D76; plano com a união; check do ano com mutação; laço com mutação; provedor fora com três mutações; `serieId` da B com mutação. A janela também ganhou cenário próprio, com mutação, e o "5h" saiu.
6. Resolvido. Em "Telas", as cinco telas têm os quatro estados, a mensagem do `CONFLITO` do `PUT`, o seletor sem resultado e o seletor sem componente.

Bloqueantes:
- **Techspec §4 e §5 "Agendar" (b); `cenarios.md`, "Seções e agendamento", cenário "Mudança de recorte".** A correção abriu um caminho que não está definido nem testado: o `PATCH` que apaga o componente da disciplina (`componenteBncc: null`, "nulo apaga").
  - Pelo gatilho (b), o job "refaz também as classificadas", mas sem componente não há candidatas. A spec não diz se o job cria execução com recorte vazio, se deixa a seção como estava ou se tira a classificação.
  - Do jeito que está, os códigos `origem: 'ia'` do componente antigo continuam na seção. Exemplo: `EM13CNT…` num material que a coordenação reconheceu como Projeto de Vida.
  - A cobertura (§5 "Cobertura") soma as habilidades das seções sem olhar o componente da disciplina. Ela passaria a dizer que Ciências da Natureza está coberta naquela série por um material que não é dela, e o painel seguiria mostrando "Sugerida pela IA" com o componente errado.
  - Correção exigida, uma frase na §5 "Agendar" (ou em `cenarios.md`, se a Tech Spec não tiver folga): sem componente, o job não cria execução. Ele tira o `execucao_id` e as habilidades `origem: 'ia'` das seções não corrigidas, que voltam a `nao_agendada`, e a corrigida fica.
  - Cenário [I] em "Seções e agendamento": seção classificada, depois `PATCH` do componente para nulo. Nenhuma execução nova, a seção fica `nao_agendada` sem código da IA, a corrigida fica, e a cobertura daquela série deixa de contar o código. Mutação: o job com a regra do recorte (cria execução, ou não limpa a `origem: 'ia'`).

Recomendações:
- **P4b (`cenarios.md`, "Corridas").** A coluna "Perdedor" diz que a exclusão "apaga as seções em cascata", mas a exclusão do material é lógica: é um `update` de `excluido_em`, como em `packages/core/src/db/schema/material.ts:25`. Nada é apagado nessa hora. Vale reescrever que a exclusão lógica (ou a edição nova) espera o commit do `concluir`, e que o teste confere que a promessa da exclusão não resolve enquanto o `concluir` está parado. O `delete` com cascata só aparece se houver apagamento físico (expurgo); se houver, ele entra como segundo escritor da mesma linha da tabela.
- **Candidatas lidas no `preparar`.** Na P9 (rotina × `PATCH` com o `PATCH` perdendo), e quando o `PATCH` encontra uma execução `pendente`, a execução que sobrevive só usa o recorte novo se as candidatas forem lidas no `preparar`, e não gravadas no agendar. Vale dizer isso na §5 e pôr um cenário [I]: `PATCH` de séries com a seção `aguardando` (`pendente`), e a execução, ao rodar, recebe as candidatas do 9º.
- **Contador das "três noites" (§5 "Degradação do lote").** A §3 não diz onde ele mora: a seção guarda só o último `execucao_id`. Vale nomear a coluna, ou o critério, e cobrir que o reclassificar zera a contagem.
- **P9.** Incluir reclassificar ou D76 × rotina sobre uma seção `nao_classificada`.
- **`CONFLITO` do `PUT` (`cenarios.md`, "Telas").** Ele tem duas causas (material não `pronto` e disciplina sem componente) e um texto só. Ou o "corrigir" fica desabilitado sem componente, com o aviso e um teste, ou o erro leva o motivo e cada causa tem o seu texto.
- **Rótulo de `sem_habilidade`.** "A IA não achou habilidade neste trecho" usa "trecho", que a própria seção "Telas" proíbe. Trocar por "neste capítulo".
- **Cenários que faltam:**
  - `PATCH` com a função suspensa não agenda.
  - Com a função suspensa, a troca não põe primeiro as habilidades `origem: 'ia'` do capítulo.
  - O reclassificar grava `solicitada_por` nulo.
  - O teto de saída de 800 tokens.
- **"Provedor fora".** O cenário diz "sem consumo", mas a §5 diz "consumo só se uma chamada saiu". Vale separar a recusa antes da chamada (disjuntor) do erro depois dela.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`.

## llm-integrator · 4ª rodada · APROVADO · 2026-11-17 10:09:17 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO
Perfis usados: `classificar_secoes` no perfil barato e em lote (`lote`, `naoUrgente`, sem descer a modelo menor, §5 "Degradação do lote"); o resto da geração não mudou desde a rodada anterior.
Custo estimado por professor/mês: não mudou nesta rodada. A classificação é por escola, uma vez por material (execuções de 12 seções, ~12 mil tokens cada, §7c), então não é custo por professor. O teto agora limita o desperdício: no máximo três tentativas com `IA_SAIDA_INVALIDA` por seção até alguém reclassificar.
Prompt versionado: sim
Validação de schema: sim (código fora das candidatas ou formato inválido vira `IA_SAIDA_INVALIDA`, com caminho de erro)
Aprovação humana no caminho: sim (a correção da coordenação vence a IA; nada da classificação vira nota ou decisão sobre aluno)

O bloqueante da rodada 3 está resolvido, e a correção não abriu outro.
- **Onde o teto é contado:** `falhas_seguidas smallint default 0` na seção (techspec.md:29).
- **Quem soma e quem zera:** só `IA_SAIDA_INVALIDA` soma 1, nas seções com `execucao_id = :esta` (techspec.md:107). `EXECUCAO_INTERROMPIDA` e `FUNCAO_SUSPENSA` não somam.
- **Quem zera:** o `concluir` (techspec.md:99), o reclassificar e o D76, que criam execução nova com a contagem zerada (techspec.md:110), e a mudança de recorte (techspec.md:88).
- **Quem lê:** a rotina das 19h pega só `falhas_seguidas < 3` (techspec.md:86), e a tabela de estados repete isso (techspec.md:196).
- **Cenário com mutação:** cenarios.md:33 cobre três noites que somam 3, a quarta sem chamar o modelo, os zeramentos e a não soma de interrupção e suspensão. As mutações são "tirar o `< 3`" e "somar em qualquer `falhou`".
- **Jitter:** o adiamento pela janela letiva tem motivo `janela` e jitter (techspec.md:94).

Bloqueantes: nenhum

Recomendações:
1. **§5 "Classificação" e "Degradação do lote":** uma saída inválida derruba a execução de 12 seções inteira, e todas somam 1. Uma seção "venenosa" leva as 11 vizinhas a 3 sem nunca terem falhado sozinhas, e elas esperam o reclassificar. Anule só o código inválido ou a seção inválida, ou reagrupe quando a seção tiver `falhas_seguidas > 0`. Um cenário de lote misto fecharia o ponto.
2. **cenarios.md:33:** acrescente que o D76 zera a contagem. O texto da spec cobre o D76, mas o cenário só nomeia o reclassificar e a mudança de recorte. Acrescente também uma mutação "reclassificar sem zerar".
3. **techspec.md:186 (§7c, Alerta):** escreva "pendente criada antes dela, fora o excedente planejado da noite". Hoje isso só aparece em cenarios.md:150. A seção que chega a 3 não gera alerta próprio depois da noite em que falhou; o painel mostra `nao_classificada`, o que basta, mas vale uma linha no runbook.
4. **`EXECUCAO_INTERROMPIDA`:** ela não soma e não tem teto. Uma interrupção recorrente deixa a rotina retentando toda noite. O custo é baixo, porque a chamada nem saiu, mas considere um alerta ou um segundo contador.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md`.

## infra-guardian · 4ª rodada · APROVADO · 2026-11-17 10:10:02 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | IA | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum. O bloqueante da rodada 3 está resolvido em todos os pontos exigidos. A coluna `falhas_seguidas` está no §3. No §5 "Degradação do lote", só `IA_SAIDA_INVALIDA` soma, e a soma pega só as seções da execução (`execucao_id = :esta`). Zeram a contagem:
- o `concluir`, em "Classificação";
- o reclassificar e o D76, em "Reclassificar";
- a mudança de recorte, em "Agendar" (b).

A rotina pega só `falhas_seguidas < 3`, em "Agendar" (a), e o §7c "Estados" tem a saída por ela. O cenário está em `cenarios.md:33-35`, com as mutações "tirar o `< 3`" e "somar em qualquer `falhou`". A correção do componente apagado também foi feita: está no §5 "Agendar" (b) e no cenário `cenarios.md:42-44`, com mutação. A correção não abriu bloqueante novo.

Recomendações:
- §5 "Degradação do lote": escrever que a soma de `falhas_seguidas` fica na mesma transação da passagem `rodando → falhou` e só acontece quando o `update` devolve a linha. Hoje o `marcarFalhou` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/apps/api/src/ia/execucao.repository.ts:134`) roda sem transação. Somar a linha na tabela "Corridas": job entregue duas vezes com `IA_SAIDA_INVALIDA` soma 1, e a mutação é somar sem a condição.
- §3: declarar `falhas_seguidas smallint not null default 0`. Uma coluna nula torna `< 3` falso, e a seção sai da rotina sem aviso.
- §5 "Agendar" (a): `EXECUCAO_INTERROMPIDA` não soma. Se uma seção derruba o worker sempre, ela volta toda noite, e cada volta grava consumo estimado. O alerta pega o caso, mas vale dizer no runbook que o caminho é a suspensão ou o D76.
- §7c "Alerta" e `cenarios.md:150-151`: o cenário chama de "excedente planejado do onboarding" a `pendente` criada na própria noite. Só que, pelo §5 "Seções", as execuções do onboarding nascem na extração, durante o dia, e por isso disparam o alerta. É preciso definir o corte. Também falta dizer que a seção com 3 falhas sai do alerta depois da terceira noite e fica só no painel e em `secoesSemClassificacao`.
- §5 "Agendar" (b): escrever que o job decide pelo componente e pelas séries atuais, não pelo conteúdo do `PATCH`. Assim, um job do componente apagado entregue fora de ordem não limpa as seções de um componente que já foi definido de novo.

## revisor-geral · 4ª rodada · APROVADO · 2026-11-17 10:10:10 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: não se aplica, porque esta é uma revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", o que é o esperado nesta fase.

**O bloqueante da rodada 3 está resolvido.** Conferi os seis pontos exigidos.
1. **Coluna (§3, linha 29).** `secao_do_material` agora tem `falhas_seguidas smallint default 0`.
2. **Quem soma (§5 "Degradação do lote", linhas 106–107).** Só `IA_SAIDA_INVALIDA` soma 1, nas seções com `execucao_id = :esta`.
3. **Quem zera.** O `concluir` (linha 99), a mudança de recorte (linha 88), e o reclassificar e o D76 (linha 110).
4. **Filtro da rotina (linha 86).** Pega "a última `falhou` e `falhas_seguidas < 3`". Com 3, a seção espera o reclassificar.
5. **Erros que não contam.** `EXECUCAO_INTERROMPIDA` e `FUNCAO_SUSPENSA` não somam. Está no §5 e no cenário.
6. **Estados e cenário.** O §7c "Estados" (linha 196) traz a saída "rotina (`falhas_seguidas < 3`)". O `cenarios.md:33` tem as duas mutações: tirar o `< 3` e somar em qualquer `falhou`.

**As recomendações da rodada 3 também entraram:**
- O componente apagado está no §5 (linha 89), no §7c e no `cenarios.md:42`.
- As candidatas são lidas no `preparar` (linha 90), com cenário em `cenarios.md:40`.
- Dois `PATCH` seguidos têm cenário em `cenarios.md:45`.

**A correção não abriu bloqueante.** A Tech Spec tem 2.799 palavras, dentro do teto de 2.800.

Bloqueantes: nenhum.

Recomendações:
- **§3, linha 29.** Escrever `falhas_seguidas smallint not null default 0`. Se a coluna aceitar nulo, `null < 3` sai nulo e a rotina deixa de pegar a seção sem avisar ninguém.
- **§5 "Degradação do lote", linha 107.** Dizer que a soma fica na mesma transação que passa a execução a `falhou`, e só quando essa passagem acontece. Hoje nada impede que uma entrega dupla (D49) some 2 de uma vez. Pede também um cenário [P].
- **§5, linhas 106–107: uma seção ruim trava as outras 11.** O `llm-integrator` também apontou isso na 4ª rodada. `IA_SAIDA_INVALIDA` derruba a execução inteira, de 12 seções. Se uma seção provoca sempre saída inválida, as 11 inocentes chegam a 3 com ela. O reclassificar refaz o mesmo agrupamento e falha de novo. Sugestão: na segunda falha, reagendar a seção numa execução sozinha. Ou então registrar no §13 o risco e a saída manual, que é a correção pela coordenação.
- **§5 "Agendar", linha 89: componente apagado com a função suspensa.** O job não roda com a função suspensa (`cenarios.md:46`). Então a limpeza das habilidades `origem: 'ia'` não acontece. Na retomada, os códigos do componente antigo voltam a contar na cobertura. Dizer que a limpeza roda mesmo com a função suspensa, porque ela não é um agendamento, e pôr um cenário para isso.
- **§5 "Agendar" (b).** O §5 não diz se o `PATCH` de séries cria execução quando a disciplina não tem componente. A rotina filtra "com componente" e o gatilho (b) não. Escrever esse filtro também no (b).

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md

## test-engineer · 4ª rodada · REPROVADO · 2026-11-17 10:10:23 · `tasks/prd-classificacao-bncc/revisao-spec.md`

**VEREDITO: REPROVADO**

O bloqueante da rodada 3 está resolvido. A correção, porém, abriu três buracos novos no mesmo ramo, o do componente apagado. Juntos eles formam um bloqueante.

**O bloqueante da rodada 3 (resolvido)**
- A Tech Spec define o efeito em `techspec.md:88-89`, §5 "Agendar" (b): o job tira o `execucao_id` e as habilidades `origem: 'ia'` das seções não corrigidas, sem criar execução.
- O estado novo está em `techspec.md:193`, §7c: "componente apagado" entra em `nao_agendada`.
- O cenário com a mutação está em `cenarios.md:42-44`, com a cobertura deixando de contar o código.

**O que mais conferi da rodada 3**
- `falhas_seguidas`:
  - a coluna está no §3 (`techspec.md:29`);
  - só `IA_SAIDA_INVALIDA` soma (`techspec.md:106-107`);
  - zeram o `concluir`, o reclassificar e o D76, e a mudança de recorte;
  - a rotina pega só `< 3`;
  - o cenário tem as duas mutações (`cenarios.md:33-35`).
- Recomendações minhas incorporadas:
  - candidatas lidas no `preparar`, com cenário (`cenarios.md:40-41`);
  - P4b com a exclusão lógica (`cenarios.md:168`);
  - P9 com reclassificar × rotina (`cenarios.md:174`);
  - "Corrigir" desabilitado sem componente (`cenarios.md:187`, `:199`);
  - rótulo de `sem_habilidade` sem "trecho" (`cenarios.md:180`);
  - recusa antes da chamada separada do erro depois dela (`cenarios.md:71-75`).

**Cenários exigidos:**
- Os cobertos acima.
- Componente apagado com a função suspensa, e o que acontece na retomada.
- Componente apagado durante uma execução viva.
- `preparar` de uma execução cujo componente sumiu.

**Cobertos:**
- Componente apagado em sequência (`cenarios.md:42`).
- `PATCH` com a função suspensa, só "não agenda" (`cenarios.md:46`).
- `PATCH` de séries com execução `rodando` e com execução `pendente` (`cenarios.md:39-41`).

**Bloqueantes:**

1. **O componente apagado continua com caminhos sem efeito definido** (`techspec.md:84-90`, §5 "Agendar"; `:94-96`, "Classificação"; `:114-115`, "Suspensão"; `cenarios.md:42-46`, `:174`).

   **(a) Suspensão.** O job começa com "função suspensa: não agenda" (`techspec.md:84-85`), e a limpeza do componente apagado está dentro desse job.
   - Não está dito se a limpeza corre com a função suspensa.
   - Se não corre, as seções ficam com o `execucao_id` de uma execução `concluida` e com códigos `origem: 'ia'` do componente antigo.
   - Na retomada (`techspec.md:115`), a rotina pega só seção sem execução ou com `falhou`, e "com componente". Essas seções nunca saem dali.
   - A cobertura (`techspec.md:129-130`) não filtra pelo componente atual da disciplina, então volta a contar esses códigos.
   - O mesmo vale para o `PATCH` que troca o componente durante a suspensão: as seções classificadas ficam no recorte antigo para sempre.
   - **Correção:** com a função suspensa, o job ainda faz a limpeza (tira `execucao_id` e os códigos `origem: 'ia'` das não corrigidas, que voltam a `nao_agendada`) e só não cria execução. Assim a rotina as agenda na retomada.
   - **Cenário:** apagar ou trocar o componente com a função suspensa, retomar e conferir:
     - na troca, a rotina das 19h agenda pelo componente novo;
     - no componente apagado, a cobertura não conta o código antigo.
   - **Mutação:** o job sai antes da limpeza quando a função está suspensa.

   **(b) `preparar` sem componente.** O `preparar` lê as candidatas "pelo recorte atual" (`techspec.md:90`), mas a spec não diz o que ele faz quando a disciplina não tem componente e a lista de candidatas fica vazia.
   - Isso acontece na corrida rotina × `PATCH` que apaga.
   - A rotina lê a seção sem execução, ainda com componente. A limpeza não tem o que limpar. A rotina grava a execução com `is not distinct from null`, e o P9 deixa passar.
   - Nessa execução, o modelo é chamado com zero candidatas. A seção vira `sem_habilidade` ("A IA não achou habilidade neste capítulo"), o que é falso, ou soma `falhas_seguidas`, e a chamada é paga.
   - **Correção:** no §5, o `preparar` sem candidatas (componente nulo) conclui sem modelo e sem consumo, e as seções voltam a `nao_agendada`.
   - **Cenário:** execução `pendente` cuja disciplina perdeu o componente: nenhuma chamada e nenhum `consumo_ia`, a seção fica `nao_agendada`, e `falhas_seguidas` não soma.
   - **Mutação:** chamar o modelo com a lista vazia.

   **(c) Corrida com o `concluir`.** A limpeza apaga códigos `origem: 'ia'`, e o `concluir` os grava. A spec só condiciona a troca do `execucao_id` (`where execucao_id is not distinct from :lido`, `techspec.md:89-90`). Não diz que o `delete` dos códigos depende desse `update` ter acertado, nem que roda sob a trava da seção.
   - Se o job apaga os códigos antes de tomar a seção, um `concluir` com `for update` (`techspec.md:98-99`) pode gravar entre o `delete` e o `update`.
   - O resultado é uma seção `nao_agendada`, sem execução, mas com códigos da IA, que a cobertura conta.
   - **Correção:** no §5, dizer que a limpeza toma a seção `for update`, troca o `execucao_id` condicionado e, só se a troca acertou, apaga os códigos `origem: 'ia'`, na mesma transação.
   - **Corrida nova em `cenarios.md` (P10):** componente apagado × `concluir`, nas duas ordens forçadas:
     - o `concluir` parado depois do `for update`: a limpeza espera e apaga os códigos recém-gravados;
     - a limpeza primeiro: o `concluir` não grava.
   - **Mutação:** tirar a condição do `delete`, ou apagar antes da trava.
   - O cenário da linha 39 (`PATCH` durante `rodando`) só cobre a mudança de recorte, não o apagar.

**Recomendações:**
- Na redação de (a) e (b), cabe trocar "função suspensa: não agenda" (`techspec.md:84-85`) por "suspensa: limpa e não agenda". Também cabe acrescentar ao `preparar` "sem candidatas, como sem seção viva". São poucas palavras, perto do teto de 2.800.
- `techspec.md:179`: o §7c diz que a vaga `lote` é 1 por escola, "dividida com expurgo e eliminação". O P9 (`cenarios.md:174`), por sua vez, trata rotina × `PATCH` como concorrentes.
  - Falta dizer se o job de agendar ocupa essa vaga, no `main-worker`, ou não.
  - Se ocupa, o P9 só acontece entre réplicas ou pela reentrega, e o cenário deve dizer isso.
- Recusa de soberania não soma `falhas_seguidas`. Ela repete toda noite, sem custo, e dispara o alerta toda manhã. Vale uma linha no runbook do `classificacao-atrasada` dizendo que é o comportamento esperado.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md

## test-engineer · 5ª rodada · REPROVADO · 2026-11-17 10:14:17 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** o bloqueante da rodada 4 tinha três caminhos do componente apagado, e foi isso que conferi.
- **(a) Função suspensa:** o job limpa e só não agenda.
- **(b) `preparar` sem candidatas:** conclui sem modelo, e as seções voltam a `nao_agendada`.
- **(c) Limpeza × `concluir`:** a limpeza toma a seção `for update`, troca o `execucao_id` com a condição e só então apaga os códigos `origem: 'ia'`. A corrida tem ordem forçada.

Também conferi o que a correção trouxe de novo: `falhas_seguidas not null`, a soma na transação da passagem a `falhou` e a "seção com falha vai sozinha".

**Cobertos:**
- **(a) Resolvido.** O §5 "Agendar" (techspec.md:90) diz "Função suspensa: limpa e não agenda". O cenário está em cenarios.md:50-52, com a mutação "o job sair antes da limpeza quando a função está suspensa".
- **(b) Resolvido no texto.** Está no §5 (techspec.md:91-92) e no cenário cenarios.md:54-55, com a mutação "chamar o modelo com a lista vazia". O estado `nao_agendada` está na tabela do §7c (techspec.md:195).
- **(c) Resolvido no desenho.** A ordem trava, troca condicionada e `delete` está em techspec.md:88-90. P10a e P10b estão em cenarios.md:184-185, cada uma com a sua ordem forçada. A P10a mata a mutação "apagar antes da trava", e a P10b mata "tirar `execucao_id = :esta` do `concluir`".
- **`falhas_seguidas`:** o `not null` está no §3 (techspec.md:29). A soma na transação da passagem a `falhou` está no §5 (techspec.md:109), e cenarios.md:37 tem a mutação "somar sem a passagem a `falhou`".

**Bloqueantes (2, os dois abertos pela correção):**

1. **cenarios.md:184, P10a. Uma das mutações listadas não tem cenário que a mate.**
   - O §5 diz "a seção `for update`, `execucao_id` nulo com `where execucao_id is not distinct from :lido`". Lido assim, o `:lido` sai do próprio `for update`, e então a troca sempre acerta.
   - Na ordem forçada da P10a, o `concluir` não mexe no `execucao_id`, e a troca acerta de novo.
   - Logo, a segunda mutação ("[apagar] sem a troca do `execucao_id` ter acertado") é equivalente ao código certo. O portão de mutações (`tools/processo/mutacoes.ts`) não consegue deixá-la vermelha, e a tarefa trava no portão.
   - Se o `:lido` vier da leitura do lote, antes da trava, o caso em que a troca erra fica sem efeito definido. Ninguém entra nesse caso na ordem forçada da P10a.
   - Correção, uma de duas:
     - (i) O §5 diz que o `:lido` é lido sob o `for update`, e essa mutação sai da P10a.
     - (ii) O §5 diz que o `:lido` vem da leitura do lote, e define o que acontece quando a troca erra (pula a seção). Nesse caso entra uma P10c: a limpeza lê o lote, um agendar rival troca o `execucao_id` e só então a limpeza toma a trava. A P10c também prova que os códigos `origem: 'ia'` não ficam para trás quando a execução nova cai em "sem candidatas".

2. **techspec.md:84-85 contra cenarios.md:35-36. A regra "seção com falha vai sozinha" não tem mutação, e o cenário contradiz o §5.**
   - O §5 (techspec.md:109) soma 1 em todas as seções da execução que falhou (`execucao_id = :esta`). As 12 ficam "com falha", e não sobra vizinha sem falha.
   - Mesmo assim, o cenário diz "a seção com falha volta sozinha numa execução, e as vizinhas da execução que falhou seguem em outra". Do jeito que está escrito, não dá para implementar.
   - Nenhuma das três mutações da linha ("tirar o `< 3`", "somar em qualquer `falhou`", "reclassificar sem zerar") pega essa cláusula, e cláusula nova sem mutação é bloqueante.
   - Correção, em três partes:
     - No §5, dizer o que é "com falha" (`falhas_seguidas > 0`) e como a execução seguinte é montada: uma por seção, ou o lote partido.
     - Reescrever o cenário de acordo, por exemplo: 12 seções falham, e na noite seguinte saem N execuções, sem misturar seção com falha e seção com `falhas_seguidas = 0`.
     - Acrescentar a mutação "agrupar seção com falha com outras".
   - Se for uma execução por seção, o custo do §8 e a vazão do §7c precisam contar o reenvio das ~200 candidatas em cada uma das 12 execuções. Repassar ao `llm-integrator` e ao `infra-guardian`.

**Recomendações:**
- **techspec.md:91-92: dar ao `preparar` sem candidatas a mesma escrita da "Limpar".** Hoje ele leva as seções a `nao_agendada` sem condição na escrita e sem linha nas Corridas. A troca precisa ser `where execucao_id = :esta and corrigida_em is null`, e convém apagar ali as `origem: 'ia'` e zerar `falhas_seguidas`. Sem a condição, uma execução nova agendada pelo job, com o componente definido de novo, fica órfã até as 19h seguintes. Uma linha P11 cobre isso.
- **cenarios.md:54-55: fixar a ordem "com o job do `PATCH` ainda na fila".** Se o job roda antes, o `preparar` não acha seção viva, cai no caminho da cenarios.md:77, e a mutação "chamar o modelo com a lista vazia" sobrevive pelo motivo errado.
- **Componente presente sem nenhuma candidata (material sem série, por exemplo).** Hoje a rotina das 19h agenda e o `preparar` desagenda toda noite, sem custo e sem alerta. Ou o §3 diz que esse caso não acontece, ou a rotina filtra por candidatas.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md

```
VEREDITO: REPROVADO
Cenários exigidos: componente apagado com a função suspensa; `preparar` sem candidatas; limpeza × `concluir` (P10); `falhas_seguidas` not null e somado na passagem a `falhou`; seção com falha sozinha
Cobertos: suspensa limpa e não agenda (cenarios.md:50-52); `preparar` sem candidatas (cenarios.md:54-55); P10a e P10b (cenarios.md:184-185); `falhas_seguidas` (techspec.md:29, 109; cenarios.md:33-37)
Bloqueantes: (1) cenarios.md:184, P10a lista a mutação "sem a troca do execucao_id ter acertado", que nenhuma ordem forçada mata; definir quando o :lido é lido e tirar a mutação, ou criar a P10c com o efeito do erro na troca; (2) techspec.md:84-85 e cenarios.md:35-36, "seção com falha vai sozinha" sem mutação e contradizendo a soma em todas as seções da execução (techspec.md:109); definir "com falha" e a montagem, reescrever o cenário e acrescentar a mutação "agrupar seção com falha"
Recomendações: escrita do `preparar` sem candidatas condicionada a `execucao_id = :esta`, apagando as `origem: 'ia'`, com P11; ordem "job ainda na fila" em cenarios.md:54; laço noturno sem custo com componente e sem candidatas; custo e vazão da execução de uma seção só (§8, §7c)
```

## test-engineer · 6ª rodada · APROVADO · 2026-11-17 10:16:38 · `tasks/prd-classificacao-bncc/revisao-spec.md`

VEREDITO: APROVADO

Os dois bloqueantes da rodada 5 estão resolvidos, e a correção não abriu outro.

Cenários exigidos: P10a com uma mutação que algum teste mate; a definição de "seção com falha vai sozinha", com cenário e mutação; P11, que era recomendação na rodada 5.

Cobertos:
- **P10a** (`techspec.md` §5 "Agendar", linhas 88–89; `cenarios.md` "Corridas", linha 186). O `:lido` saiu. Agora a limpeza lê a seção `for update` e só depois anula o `execucao_id` e apaga as `origem: 'ia'`. A mutação "apagar antes da trava" é morta pela ordem forçada. O `concluir` segura a seção e o DELETE mutado não espera por nada, só o UPDATE espera. O `concluir` grava e confirma, e no fim sobram códigos `origem: 'ia'` numa seção `nao_agendada`. A asserção do perdedor, "a limpeza apaga os códigos recém-gravados", fica vermelha. Isso vale com o `concluir` parado antes ou depois de inserir os códigos, porque a linha inserida e ainda não confirmada não é vista pelo DELETE mutado.
- **P10b** (linha 187). O `concluir` reavalia `execucao_id = :esta` depois que a limpeza solta a trava e não acha a linha. Sem essa condição, ele grava. A mutação morre.
- **Seção com falha vai sozinha** (§5 "Agendar", linhas 84–85; `cenarios.md` "Seções e agendamento", linhas 36–38). Ficou definida como `falhas_seguidas > 0`, numa execução só dela. A mutação "agrupar" junta de novo as 12 seções, as 12 somam 2 e o teste quebra em três asserções: "12 execuções de uma seção", "as 11 zeram" e "a seção nova vai em execução separada". A regra só age na rotina, porque a extração cria a seção zerada e o reclassificar, o `PATCH` e o D76 zeram. Isso bate com a linha 33.
- **P11** (§5, linhas 90–91; "Corridas", linha 188). O job reagenda com uma execução nova, e a limpeza do `preparar` com `execucao_id = :esta` deixa a seção em paz. Sem a condição, a seção fica com a execução órfã e a asserção "segue com a execução nova" falha. A linha 56 fixa o job do `PATCH` ainda na fila, como a rodada 5 pediu.
- **Efeito sobre o que já estava aprovado.** Sem o `:lido`, a limpeza do `PATCH` passou a anular qualquer `execucao_id`, inclusive o de uma execução que a rotina ou o reclassificar acabou de criar. A execução que perde fica órfã. O `preparar` dela não acha seção viva e conclui sem chamar o modelo (linha 79 dos cenários), então não há dois modelos. A P9 (linha 185) continua certa nas duas ordens: quem perde é a rotina, pela condição `is not distinct from :lido` do agendar.

Bloqueantes: nenhum.

Recomendações:
- **P10a, texto da linha** (`cenarios.md:186`). A coluna "Ordem forçada" diz "`concluir` parado depois do `for update`", e a coluna "Perdedor" diz "o `concluir` já gravou". Melhor escrever "parado depois de gravar os códigos, antes do commit", para quem implementar a trava. A mutação morre nas duas leituras.
- **Falta a mutação "Limpar sem zerar `falhas_seguidas`"** (`techspec.md:89`). A linha 33 dos cenários já afirma que a mudança de recorte zera, então o teste existe, mas a mutação não está escrita na lista. Na limpeza do `preparar` sem candidatas (linha 56), "não soma" não prova que zerou. Vale pôr a seção com `falhas_seguidas = 2` e afirmar que fica 0 depois.
- **Custo das execuções de uma seção só** (`techspec.md` §7c, "Vazão"). Uma noite de falha em massa, por exemplo depois de trocar o prompt, transforma cada execução de 12 seções em 12 execuções, e cada uma carrega a lista inteira de candidatas. A escola de 300 apostilas passa de cerca de 625 para cerca de 7.500 execuções na noite seguinte. O teto de 3 e o adiamento seguram isso, mas a tabela de vazão e o runbook não falam desse caso. É para o `infra-guardian` olhar, não bloqueia.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/techspec.md` (§5 "Agendar", §7c) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc/tasks/prd-classificacao-bncc/cenarios.md` ("Seções e agendamento"; "Corridas", P9 a P11).
