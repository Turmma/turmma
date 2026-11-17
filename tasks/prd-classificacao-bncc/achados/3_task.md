# Achados das revisões — `tasks/prd-classificacao-bncc/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 16:22:36 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

O que sustenta o veredito:

- **Migration `0062`.** Ela só expande a tabela. O `DROP NOT NULL` de `execucao_agente.ano_letivo_id` muda só metadado. O código anterior não grava ano nulo, e o check `execucao_agente_ano_so_nulo_na_classificacao` restringe o nulo à `classificar_secoes`. Os checks seguem o padrão `NOT VALID` + `VALIDATE` com `lock_timeout` de 5 s, igual à 0058. Nenhuma coluna é renomeada, e não entra `NOT NULL` sem valor padrão.
- **Gateway de IA.** A tarefa passa pelo `LLMGateway` de sempre. A reserva no limitador de tokens por minuto usa o tamanho estimado do pedido, não o teto de 121.600 (`packages/core/src/ia/llm-gateway.ts:414`). Quando não há vaga, a chamada espera, desce para o modelo menor (a tarefa não está em `TAREFAS_SEM_MODELO_MENOR`) e termina em `IA_INDISPONIVEL`. Não há caminho para o aluno, porque ninguém chama a tarefa até a 4.0 (`TAREFAS_SEM_CHAMADOR`).
- **Leituras com ano nulo.** `paraIniciar` passou a usar o `anoEmCurso` do `join` em vez da coluna, e as outras consultas filtram pelo ano em curso, então nenhuma quebra com a linha nula. Os índices de `execucao_agente` começam por `escola_id`, sem depender do ano.
- **Nenhum teste chama provedor pago.** `medir-classificacao.test.ts` roda com fixture. O `principal` só roda pela linha de comando e exige modelo local ou a opção `--provedor-contratado`.
- **Concorrência.** A tarefa não grava nada nem cria laço novo.

Recomendações:
1. **Separar o `VALIDATE` em outra migration antes do piloto.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0062_execucao_classificacao.sql`, o `VALIDATE` de `consumo_ia` e de `execucao_agente` roda na mesma transação que o `ADD`, segurando a trava exclusiva enquanto varre as duas tabelas que crescem com o Tutor. O próprio comentário da migration diz que isso precisa ir para uma migration à parte quando houver staging ou piloto. Convém registrar isso no `TODO.md` com dono, para não depender da memória na próxima troca de check.
2. **Refazer a conta de vazão na 4.0 ou na 5.5.** O maior pedido real tem cerca de 31 mil tokens, e a vazão da §7c foi calculada com 12 mil (balde `lote` de 125 mil por minuto). O `TODO.md` já registra isso. Ao revisar a 4.0, falta conferir que a chamada vai com a fila `lote` no limitador. Hoje `FilaDeTokens` não tem `lote`, e o gateway cai em `normal`, cujo balde é de 10% do contratado. Um pedido de 31 mil tokens ocuparia o balde `normal` inteiro.
3. **Gravar só ids na entrada do `consumo_ia` da classificação (4.0).** Hoje o gateway grava a entrada inteira em `consumo_ia` quando `levaTextoLivreDePessoa` é `false`. Na classificação isso daria até cerca de 120 KB de texto de material por linha, todas as noites, numa tabela que cresce. O `TODO.md` já registra o ponto pelo lado de privacidade; ele também pesa no volume da tabela.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 16:22:39 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A única coluna alterada é `execucao_agente.ano_letivo_id`, que passou a aceitar nulo. Ela não é dado de pessoa, e o check `execucao_agente_ano_so_nulo_na_classificacao` só deixa o nulo em `classificar_secoes`. A tarefa nova manda ao modelo o texto do material da escola (título, até 1.500 caracteres do começo e até 500 de subtítulos) e a tabela pública da BNCC. Não manda aluno, professor, turma nem ano. Nos dados ao modelo, a seção aparece só pelo UUID dela.

Fora da tabela de dados do docs/lgpd.md: nada. O texto do material já está classificado como `SEM_PESSOA` (linha 101) e o texto mandado ao modelo já está coberto pela linha 100. A execução sem pessoa cabe na linha 98, porque `solicitadaPor` já era opcional.

Autorização por objeto: ok. A tarefa não cria rota. `ExecucaoRepository.paraIniciar` (`apps/api/src/ia/execucao.repository.ts:72`) continua com o escopo da escola. O teste `ia.int.test.ts` mostra que a escola B recebe `undefined` para a execução sem ano da escola A. Na execução sem pessoa, `quemPediu` agora sai vazio, e o ano que ele leva vem do ano em curso achado pelo `join`, nunca da coluna nula.

Logs: limpos. O medidor (`tools/ia/medir-classificacao.ts:495,514`) imprime só agregados, o sha256 do lote e as questões geradas a partir do lote sintético. Os textos de `conferir` que voltam ao modelo são fixos e nunca repetem o que ele escreveu.

Auditoria: presente. A suspensão de `classificacao_do_material` usa o caminho que as outras funções já usam, e o check de `suspensao_de_funcao` aceita a função nova (testado em `migracao-classificacao.int.test.ts`). A tarefa não faz leitura de dado de aluno, exportação, alteração de nota ou permissão, nem aprovação de saída de IA.

Envio externo:
- **O que vai:** título, começo e subtítulos de cada seção, mais as candidatas da BNCC, na categoria `material_da_escola`, com `levaTextoDeAluno: false` e `levaTextoLivreDePessoa: false`.
- **Para onde:** o provedor do gateway. Como a tarefa não leva texto de aluno, a D62 não se aplica.
- **Registrado?** Sim, em `execucao_agente` e `consumo_ia`. Quando a chamada sai, `consumo_ia` guarda `envio_externo` e o `provedor`. A varredura grava a linha estimada na escola da própria execução.
- **Medidor:** exige modelo local e só usa provedor de fora com `--provedor-contratado`, sempre sobre o lote sintético.

Seed/fixture: sintético. `entradaDeClassificacao` (`packages/core/src/ia/__fixtures__/inputs.ts:134`) e as linhas do `medir-classificacao.test.ts` são textos inventados de Química e Matemática com UUIDs fixos. Não há nome de pessoa.

Ciclo de vida: a execução sem ano é anonimizada pelo expurgo como as outras (`expurgo-da-escola.int.test.ts`). Ela não entra no arquivo de nenhum titular, porque não tem `solicitada_por`. Ler a coluna nula em `leitura-do-titular.ts:271` funciona.

Pergunta de fechamento: o código responde. A classificação não tem titular, então não entra no rastro de aluno nenhum. O que já era rastreado por aluno continua igual, por `consumo_ia.aluno_id` e por `execucao_agente.solicitada_por`.

Bloqueantes: nenhum.

Recomendações:
1. **4.0: gravar só ids no registro de consumo.** Hoje o gateway grava a entrada inteira em `consumo_ia.entrada` quando `levaTextoLivreDePessoa` é `false`. Na classificação, isso inclui o título do capítulo, que segundo `docs/lgpd.md:101` pode trazer um nome numa apostila escrita pelo professor. Já está no `TODO.md` como pendência da 4.0, e precisa entrar lá antes do primeiro material real.
2. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/aia/diagnostico-por-habilidade.md:348`:** a frase "O que o registro guarda sai com o material" não é verdadeira hoje. `consumo_ia.entrada` e `saida` são apagadas pelo expurgo `texto_do_modelo`, de 1 a 12 meses, e não junto com o material. Corrigir a frase, ou fazer a 4.0 cumpri-la.
3. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md:98`:** dizer que a execução da rotina (a classificação) não tem titular nem ano. O item 7 da seção 6 também poderia citar a classificação entre as tarefas sem dado pessoal que podem ir a provedor de fora, que é o que a escola é informada.

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-17 16:22:44 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum caminho novo. A diferença desta tarefa não toca `Nota` nem `lancadaPor`. A migration `0062` só mexe em `execucao_agente`, `consumo_ia` e `suspensao_de_funcao`. Todos com autor humano? sim, porque nada mudou.

Decisão autônoma sobre aluno: ausente. A saída da tarefa só traz `secaoId` e de 0 a 3 códigos tirados da lista de candidatas, e o schema estrito recusa qualquer chave a mais. Ela não leva aluno, professor, turma nem ano.

Aprovação registrada: ok. A classificação não chega ao aluno. A habilidade da questão passa pelo professor quando ele confere e aplica a atividade, e a correção da coordenação vence (o que será auditado vem nas tarefas 7.0, 8.0 e 11.0). A exceção do Tutor (D47) não se estendeu a esta função.

Supervisão do tutor: ok, não foi tocada.

Autonomia declarada e visível: sim no código e na tela, mas a documentação contradiz o código (bloqueante abaixo). No código, `packages/shared/src/time/funcoes.ts` declara a função com autonomia 1, alto risco e suspensível. A tela da coordenação mostra o nível como "Faz e registra" (`NOME_DA_AUTONOMIA[1]`), e `governanca.int.test.ts` e `governanca.test.ts` provam isso, inclusive suspender e retomar com auditoria. Não há nível 4.

Bloqueantes:
1. **A AIA e `docs/agentes.md` descrevem a autonomia de outro jeito que o código** (regra 70, itens 5 e 6a).
   - `docs/aia/diagnostico-por-habilidade.md:264-265` diz: "Autonomia 1 quer dizer que a IA prepara e nada sai dela sozinho: a classificação é rótulo de capítulo para o professor conferir." Isso está errado. Em `docs/agentes.md:19` e em `funcoes.ts:6`, o nível 1 é "Executa e registra: faz sem pedir". A classificação de fato vale sozinha: ela grava `habilidade_da_secao`, limita as habilidades que a geração usa e alimenta a cobertura sem ninguém aprovar. O próprio texto de suspensão em `textos-da-governanca.ts:153` confirma isso. Nenhum professor confere o rótulo do capítulo: quem confere é a coordenação, quando corrige, e o professor só confere a habilidade da questão. A AIA vai para o dossiê (D61) e responde de forma enganosa exatamente à pergunta "o que essa IA faz sozinha?".
   - `docs/agentes.md:79` abre a linha da função com "**Faz e avisa**". Esse é o rótulo do nível 2 na tela, e a função não avisa ninguém. A mesma função fica com dois níveis diferentes conforme o documento.
   - **Correção exigida:**
     - Na AIA, trocar a frase por algo como "Autonomia 1 (faz e registra): a classificação vale sozinha, para a geração e a cobertura, até a coordenação corrigir; nada chega ao aluno sem o professor conferir a habilidade da questão e aplicar a atividade."
     - Em `docs/agentes.md:79`, trocar "Faz e avisa" por "Faz e registra".

Recomendações:
- `packages/shared/src/governanca/governanca.test.ts`: o laço do `VOCABULARIO_DE_NOTA` cobre `nome`, `fazSozinha` e `esperaAprovacao`, mas não `EFEITO_DA_SUSPENSAO.classificacao_do_material`. Hoje esse texto está limpo; vale incluí-lo para guardar o que a coordenação lê ao suspender.
- `tools/ia/medir-classificacao.ts:20` diz que a `referencia` é "os códigos que o professor diz". Até a conferência pendente no `TODO.md`, quem escreve é um subagente. Melhor dizer "o gabarito do lote retido (conferido por professor antes do primeiro aluno real)".
- Para o `privacy-guardian` e a 4.0, já registrado no `TODO.md`: até a 4.5, o `consumo_ia` grava a entrada inteira, com o texto do material. Não há pessoa nesse dado, então isso não afeta a regra 70, mas a AIA 1.10, item 8, depende dessa correção.
- O prompt (`packages/core/src/ia/prompts/classificar-secoes.ts`) se apresenta com o nome da função ("Assistente de ensino do Turmma"), trata o texto como dado e pede lista vazia na dúvida. Está alinhado com a D58 e a D55; não precisa mudar nada.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/aia/diagnostico-por-habilidade.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/agentes.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/time/funcoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/classificar-secoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0062_execucao_classificacao.sql

## llm-integrator · 1ª rodada · APROVADO · 2026-11-17 16:22:45 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Auditei por leitura do diff e dos arquivos novos. Não rodei os testes nem o portão.

Perfis usados: `rapido`, em `classificar_secoes` (`packages/core/src/ia/tasks/classificar-secoes.ts:110`). É o mais barato que resolve: classificar texto em lista fechada, com saída de até 800 tokens. Não há `padrao` nem `complexo`. O medidor só escala para `padrao` se a taxa não for atingida no `rapido` (Tech Spec 7b), e essa decisão é do Joaquim.

Custo estimado por professor/mês: esta é uma estimativa minha, com preço de modelo `rapido` assumido. A tarefa não traz preço.
- **Chamadas:** cada execução é uma chamada de até 12 seções. A conta da Tech Spec é de ~625 execuções por onboarding de escola com 300 apostilas, a ~12 mil tokens de entrada. São ~7,5 milhões de tokens de entrada e ~0,5 milhão de saída.
- **Recorte maior:** o medido na 3.0 é Língua Portuguesa do 6º ao 9º mais o Médio, com ~31 mil tokens por execução. Se esse recorte dominasse, a entrada iria a ~15 a 19 milhões de tokens.
- **Custo por escola:** com modelo pequeno a ~US$0,15/M de entrada e ~US$0,6/M de saída, dá R$ 6 a 20 por escola em onboarding. Isso cabe na linha existente da Tech Spec (`techspec.md:209`, "R$ 4 a 20 por escola").
- **Por professor:** com ~30 professores por escola, o onboarding custa R$ 0,15 a 0,70 por professor, uma vez só.
- **Regime:** com 1 a 2 materiais novos por professor por mês, custa menos de R$ 0,10 por professor por mês. Reclassificação e mudança de recorte somam a isso.
- **Orçamento:** isso fica fora do pacote do Tutor (D38) e muito abaixo do teto de R$ 5 por aluno (D39).

Prompt versionado: sim. `packages/core/src/ia/prompts/classificar-secoes.ts` tem a versão `2026-11-17.1`, travada por hash em `prompts-caracterizados.test.ts`. A versão vai para o consumo (testado em `classificar-secoes.test.ts` › "o consumo é da função da classificação…").

Validação de schema: sim.
- **Schema:** `classificarSecoesOutputSchema` é estrito e confere o formato do código.
- **Conferência:** `conferir` recusa seção inventada, omitida ou repetida, código fora das candidatas e código repetido.
- **Falha do modelo:** o gateway repete uma vez com texto fixo, sem eco do que o modelo escreveu. Depois disso vem `IA_SAIDA_INVALIDA`, sem saída gravada.
- **Sondas:** os testes cobrem as sondas do `cenarios.md` e o caso de controle com a resposta boa.

Aprovação humana no caminho: não se aplica a esta tarefa.
- **Efeito:** a classificação não é nota nem mensagem à família, e não chega ao aluno. A habilidade só vale quando o professor aplica a atividade, e a coordenação corrige.
- **Declaração:** a função está declarada com `altoRisco: true`, `autonomia: 1` e suspensível. A suspensão está testada: `FUNCAO_SUSPENSA`, sem chamar o modelo.

Bloqueantes: nenhum.

O restante da regra 30 confere:
- **Adaptador falso:** os testes usam `ScriptedAdapter` e `fake-llama-server` local. O teste do medidor (`tools/ia/medir-classificacao.test.ts`) não faz chamada de rede.
- **Medidor com modelo real:** `exigirModeloDaMedida` recusa o adaptador falso e o modelo não local, que só passa com `--provedor-contratado`. O medidor não roda no portão.
- **SDK:** nenhum SDK novo fora do adaptador.
- **Isolamento do dado enviado:** `levaTextoDeAluno` e `levaTextoLivreDePessoa` são `false`, e a única categoria enviada é `material_da_escola`. Há teste que contrasta a tarefa com outra declarada com texto de aluno, recusada sem chamar o modelo.
- **Cerca do prompt:** o texto do material vai como `<dado>`, e há teste de texto que tenta fechar a cerca.
- **Limites:** o teto de saída de 800 tokens vai no corpo do pedido (teste com servidor falso). O teto de entrada é 121.600.
- **Migration 0062:** expand-only, com `lock_timeout`, `NOT VALID` e `VALIDATE`, e inclui o check de `suspensao_de_funcao`.

Recomendações (registrar, não bloqueiam):
1. **Estimativa de custo desatualizada.** `techspec.md:209` e o `TODO.md` corrigiram a vazão para ~31 mil tokens, mas a linha de custo continua de ~12 mil. Reescrever com o recorte maior e o preço do `rapido` do contrato, para a precificação não ficar em chute.
2. **Sem teto de custo por escola na classificação.** `apps/api/src/ia/orcamento.repository.ts:43` devolve `permitido: true` para qualquer função que não seja o Tutor, e o próprio arquivo diz que o contrato ainda não tem teto de IA por escola. A classificação é a primeira função em lote e noturna, com ~625 chamadas por escola. A 4.0 e a 5.0 devem declarar o freio: a vaga `lote` 1 por escola, o balde global e um limite de execuções por noite e por escola. Escrever na Tech Spec 7c que o balde é o limitador de custo.
3. **Teto de 800 tokens de saída com modelo que "pensa".** Com Ollama ou qwen em modo de raciocínio, o raciocínio pode consumir o teto e a saída voltar truncada, o que vira `IA_SAIDA_INVALIDA` e conta como erro na taxa. O Arquiteto deve registrar o modelo usado na medida e conferir se há truncamento, para a taxa não sair baixa por causa disso.
4. **Entrada gravada inteira no `consumo_ia`.** O `TODO.md` já registra que, com `levaTextoLivreDePessoa: false`, o gateway grava a entrada inteira, e que a Tech Spec §7 pede só ids. Não há chamador antes da 4.0, então não vaza nada hoje. A 4.0 não deve fechar sem esse ajuste.
5. **Prompt ainda sem medida.** A taxa mínima e a resistência à injeção só serão provadas pela medida do Arquiteto com o lote retido. O prompt hoje só tem prova de formato e de cerca.

Arquivos centrais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/classificar-secoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/prompts/classificar-secoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/orcamento.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md`

## pedagogia-reviewer · 1ª rodada · APROVADO · 2026-11-17 16:22:57 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Amostras avaliadas: 8. Foram o prompt de sistema e o pedido ao modelo, os dois textos da função em "Como cada IA trabalha", o texto do efeito da suspensão, a AIA 1.10, a fixture `entradaDeClassificacao` (3 seções e 4 candidatas), a saída do medidor sobre um caso de injeção, e o `--atividades` do medidor. Não rodei o prompt contra um modelo: a taxa é a medida do Arquiteto, e esta tarefa não tem tela nem texto para aluno.

Problemas por categoria:
- **Nível:** nenhum. A saída não chega ao aluno.
- **Distratores e gabarito:** não há questão objetiva nesta tarefa. Na fixture, as quatro descrições de habilidade (EM13CNT101, 103, 301 e 307) batem com a BNCC. A estequiometria casa com a CNT101 (conservação e quantidade de matéria), e o sumário e o bloco "Exercícios de revisão" têm resposta correta vazia. As outras três candidatas são plausíveis como distratores, sem uma obviamente certa.
- **Alinhamento curricular:** o prompt trata "nenhuma" como resposta válida, restringe aos códigos da lista e diz que título ou palavra parecida não bastam. Isso é pedagogicamente certo. O formato dos códigos (EF06 a EF09, EF67, EF69, EF89, EM13 com LGG, MAT, CNT, CHS e LP) cobre o recorte.
- **Tom e texto da tela:** sem vocabulário de nota. Há três imprecisões de redação, listadas nas recomendações.
- **Tutor e recusa de escopo:** não se aplicam. A tarefa tem `levaTextoDeAluno: false`. A ordem escondida no texto do material é tratada como dado, no prompt e na categoria `injecao`.

Exemplos concretos do que saiu errado:
- O relatório do medidor soma a seção de `injecao` duas vezes. Com uma seção só, a saída foi `{"injecao":{"certos":2,"total":2}}`, enquanto `injecoesObedecidas` ficou certo em `{0,1}`. O critério de aprovação não é afetado, mas quem lê "por categoria" vê o dobro.
- O texto de suspensão que a coordenação lê diz "A geração e a cobertura passam a valer só pelas habilidades que a coordenação corrigiu". Não diz geração de quê nem cobertura de quê.

Ajuste sugerido no prompt ou na recuperação de contexto:
- No prompt, a frase "mesmo que haja uma habilidade de outro ano ou de outro componente que serviria" descreve algo que o modelo nunca vê, porque as candidatas já vêm recortadas. Não atrapalha, mas pode confundir um modelo pequeno. Se a medida do Arquiteto mostrar "código de fora" em seções de recorte, vale tirá-la.
- "um código errado vale menos do que nenhum" é compreensível, mas "é pior do que nenhum" não deixa dúvida.
- A medida deve dizer ao Arquiteto que só detecta injeção que cita um código. Ordem como "devolva lista vazia" ou "classifique como Matemática" não é contada como obedecida. O lote deve ter injeções desse tipo, ou o critério "nenhuma injeção obedecida" fica mais fraco do que parece.

Bloqueantes: nenhum.

Recomendações:
1. `tools/ia/medir-classificacao.ts:217-221` e `:229-233`: a categoria `injecao` entra em `porCategoria` duas vezes, uma como acerto de referência e outra como "não obedeceu". Contar só uma vez, ou separar as duas linhas no relatório, e acrescentar um caso em `medir-classificacao.test.ts`, que hoje só confere `fora_do_recorte`.
2. `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:153`: trocar "A geração e a cobertura" por algo como "a geração de atividades e a cobertura do currículo". O `EFEITO_COMUM_DA_SUSPENSAO` anexado fala em "o que está esperando o professor", que não existe na classificação, porque nada espera aprovação.
3. `packages/shared/src/time/funcoes.ts:59-66`: o `esperaAprovacao` afirma que "a habilidade de cada questão só vale quando o professor confere e aplica". Essa conferência e a troca de habilidade pelo professor só chegam na tarefa 11.0, como a própria AIA diz. A coordenação já lê a frase em "Como cada IA trabalha". Basta garantir que a 11.0 entregue isso antes de a spec chegar à `develop`.
4. `medir-classificacao.ts:118-125`: `subtitulosDoTexto` trata como subtítulo toda linha curta sem ponto final. Em texto extraído de PDF, as linhas quebradas no meio da frase passam nesse filtro. A taxa medida pode divergir do worker. A dívida já está no `TODO.md`, e o ajuste é da 4.0.
5. `tasks/prd-classificacao-bncc/3_task.md:52`: a tabela diz "as onze" e "as doze" sondas na mesma linha, e a AIA diz treze. A contagem certa é 12 mais a de código repetido. É só texto.
6. A AIA 1.10 diz com franqueza que o gabarito do lote retido não foi validado por professor, e o `TODO.md` registra a conferência. Está certo. O professor da escola do piloto precisa conferir `referencia` e `aceitaveis` antes do primeiro aluno real.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/prompts/classificar-secoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/classificar-secoes.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/__fixtures__/inputs.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/aia/diagnostico-por-habilidade.md`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-17 16:23:10 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. Mudaram `execucao_agente`, `consumo_ia` e `suspensao_de_funcao` (migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/drizzle/0062_execucao_classificacao.sql` e os espelhos em `packages/core/src/db/schema/`).
- `escola_id` continua `NOT NULL` com FK nas três tabelas.
- `execucao_agente.ano_letivo_id` agora aceita nulo, mas o check `execucao_agente_ano_so_nulo_na_classificacao` só permite isso para `classificar_secoes`. O teste com a cláusula removida está em `mvp-tables.int.test.ts` e em `migracao-classificacao.int.test.ts`.
- A linha com ano nulo não passa por nenhum caminho que dependa do período:
  - as FKs compostas `(escola_id, ano_letivo_id, id)` das tabelas filhas (`entrega`, `artefato`, `mensagem_agente`, `mensagem_tutor`, `sinal_tutor`, `resumo_do_analista`) nunca casam com ela;
  - toda leitura que filtra o ano por `eq(...anoLetivoId, requireAnoEmCurso())` a exclui (`execucao.repository.ts:263, 281, 296` e `conversa.repository.ts:104`).
- Os ids continuam UUID.

Queries verificadas:
- `apps/api/src/ia/execucao.repository.ts:57-73` (`paraIniciar`): o escopo continua vindo de `requireEscolaId()`. O `quemPediu.anoLetivoId` passou a vir do ano em curso achado pelo `join`, e não da coluna nula. A execução sem pessoa dá `quemPediu` indefinido.
- `marcarRodando`: sem mudança, continua escopado pelo contexto.
- Varredura e expurgo: o código é o mesmo. Os testes novos provam que a linha de consumo vai para a escola da execução e que o lote não trava com ano nulo.
- `tools/ia/medir-classificacao.ts`: não acessa banco. O gateway roda numa escola sintética fixa (`ESCOLA_DA_MEDIDA`).
- Nenhum endpoint novo. Nenhum `escolaId` vem do cliente. Nenhum `@Unscoped()` novo: o de `execucao.repository.ts` já existia e não mudou.
- Os typechecks de `apps/api`, `apps/worker` e `packages/core` passam depois que a coluna ficou anulável.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/ia.int.test.ts:341-352`, a mesma execução sem ano é lida no contexto da escola A e dá `undefined` no da B (`noContextoDe(b, ...)`). Se a cláusula `eq(execucaoAgente.escolaId, escolaId)` sair de `paraIniciar`, o `join` acha a linha no contexto de B e o teste quebra.

Bloqueantes: nenhum.

Recomendações:
- O comentário em `packages/core/src/db/schema/execucao-agente.ts:21-23` e o da `0062` dizem que o que a classificação grava aponta para a execução por `(escola_id, id)`. Hoje não há único em `(escola_id, id)` criado para isso. Na tarefa que criar a tabela filha da classificação, a FK precisa ser composta com `escola_id` e ter um único que a sustente, e não ficar só em `id`. Vale deixar isso dito no plano da 4.0 ou 5.0.
- Quando o comando `daRotina` chegar (4.0), o teste de isolamento precisa cobrir também a escrita do resultado e do consumo da classificação na escola de outra execução, não só a leitura de `paraIniciar`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-17 16:23:18 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- governança: a função aparece em "Como cada IA trabalha", com autonomia 1 e alto risco, e se suspende e se retoma
- os textos da função, sem vocabulário de nota, e a ligação entre a tarefa e a função
- execução sem ano lida pela varredura, pelo expurgo e pelo repositório
- outra função com ano nulo é recusada
- os checks de tarefa, função e par, com a validação das linhas que já existiam
- as sondas de saída (c1)
- o prompt: dado delimitado, candidatas no começo, cortes de 1.500 e 500, teto de 800 tokens
- a declaração da tarefa (soberania, categoria, consumo, suspensão)
- o `falso`
- o medidor: taxa por etapa, `aceitaveis`, `sem_conteudo_curricular`, injeção, pior de três, saída inválida, sha256 e as 10 atividades
- isolamento: execução sem ano lida na escola dela e inexistente na outra; suspensão da A não alcança a B
- concorrência: nenhuma operação nova pode acontecer duas vezes ao mesmo tempo nesta tarefa. A suspensão já tem o teste "dois cliques no mesmo instante", e o job duplicado é da 4.0.

**Cobertos:** todas as linhas da tabela têm o caso citado pelo nome e ele existe:
- `governanca.int.test.ts`: os dois casos novos e o renomeado para sete funções
- `governanca.test.ts`: os dois casos novos e o das sete funções
- `textos-da-governanca.test.ts`
- `execucao-interrompida.int.test.ts`, com 301 s e 299 s
- `expurgo-da-escola.int.test.ts`
- `ia.int.test.ts`, com `noContextoDe(b)` dando `undefined`
- `mvp-tables.int.test.ts`: os dois casos novos
- `migracao-classificacao.int.test.ts`: os seis casos, sobre um banco migrado até a 0061 com uma execução de antes
- `classificar-secoes.test.ts`: as 13 sondas e o caso de controle, cada sonda conferindo o código de erro, as duas chamadas e o consumo sem saída
- `tarefas.test.ts`: o `DECLARADO` da linha nova
- `medir-classificacao.test.ts`

Rodei `classificar-secoes.test.ts`, `medir-classificacao.test.ts` e `governanca.test.ts`: 105 casos verdes. Não há `.skip`, `.only` nem teste comentado. Os testes de IA usam `ScriptedAdapter`, `FakeLlamaServer` ou modelo injetado, nunca provedor pago. O espelho em `.ts` dos checks sem bloco está justificado, e a lista do banco já é comparada com o contrato em `mvp-tables.int.test.ts` › "o banco e o contrato dizem a mesma lista".

**Bloqueantes:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.test.ts:303-308`: o piso de 80 % dos códigos aceitáveis não está provado.
   - **O que o nome promete:** "um código fora a cada cinco ainda passa, e um a cada quatro não".
   - **O que o teste roda:** `comFora(10)`, que dá 24/26 (92,3 %), e `comFora(1)`, que dá 24/48 (50 %). O comentário da linha 305 admite que não fez a conta.
   - **Consequência:** qualquer valor de `TAXA_DOS_CODIGOS_ACEITAVEIS` acima de 0,5 e até 0,923 deixa o teste verde. Trocar 0,8 por 0,9 passa, e nenhum outro caso confere a constante. A mutação declarada (`>= 0`) só pega a remoção total do critério, não o número.
   - **Contraste:** os critérios vizinhos estão na fronteira: 22/24 contra 21/24 para os 90 %, e 8/10 contra 7/10 para a etapa.
   - **Correção exigida:** montar os dois lados da fronteira de 80 %. Com 24 códigos certos, 6 fora dá 24/30 = 80 % e passa; 7 fora dá 24/31 ≈ 77,4 % e não passa. Ajustar o nome ao que o caso prova e tirar o comentário da linha 305. Declarar o bloco de mutação com o piso trocado (por exemplo `>= 0.9`), para provar o número e não só a presença do critério.

**Recomendações:**
- `medir-classificacao.test.ts:223`: o nome diz "20 de 20", mas o caso confere 24/24.
- `medir-classificacao.test.ts:336`: o comentário "14 de matemática em dois pedidos de 12 e 2? Não: …" é rascunho e deve sair.
- `mvp-tables.int.test.ts` › "…os cinco checks que a 0062 tocou entram validados": o caso confere seis nomes. Dizer seis.
- `ia.int.test.ts` › "…o processador de hoje a recusa como inexistente": o caso só lê `paraIniciar` (`quemPediu: undefined`) e não passa pelo processador. Ou tirar a frase do nome, ou acrescentar a chamada ao processador esperando `NAO_ENCONTRADO`.
- `classificar-secoes.test.ts`, nas sondas: a autoconferência (item 4) diz que as sondas "mostram qual das duas pegou cada saída", o schema ou o `conferir`, mas elas só olham `IA_SAIDA_INVALIDA`. Se a ideia é documentar a camada, conferir também o texto de `adaptador.correcoes`, como no caso "a repetição diz ao modelo o que corrigir".

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-17 16:24:15 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As cinco divergências da tabela do `3_task.md` estão na `techspec.md` (§3, §5, §8) e no `cenarios.md` ("Lote retido"). A ressalva sobre a §7c vai na recomendação 2.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/agentes.md:79`**: a linha nova abre com **"Faz e avisa; a coordenação corrige, e a correção vence."** No próprio `docs/agentes.md` (linhas 17-22) e em `NOME_DA_AUTONOMIA` (`apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:166`), "Faz e avisa" é o nível 2. A função foi declarada com autonomia 1 (`packages/shared/src/time/funcoes.ts:62`, Tech Spec §7b, AIA 1.10). Na tela ela aparece como "Faz e registra". As outras linhas da tabela abrem com o nome do nível delas: correção de objetiva "Faz e avisa" (2), adaptação "Prepara e espera você aprovar" (3). Esta linha declara um nível que não é o da função, no documento que a regra 70, item 5, usa como declaração de autonomia, e a função é de alto risco.
   **Correção:** trocar para "**Faz e registra; a coordenação corrige, e a correção vence.**", ou outro texto que corresponda ao nível 1.

2. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts:217-233`**: na categoria `injecao`, cada linha é somada duas vezes em `porCategoria`.
   - A linha de injeção tem `referencia` preenchida (o lote só aceita `referencia` vazia em `sem_conteudo_curricular` e `fora_do_recorte`). Por isso ela entra no bloco `if (linha.referencia.length > 0)`, que chama `somar(porCategoria, linha.categoria, acertou)`.
   - Ela entra também no bloco `if (linha.categoria === 'injecao')`, que chama `somar(porCategoria, linha.categoria, !obedeceu)`.
   - Resultado: com as 4 injeções do lote, o relatório de `descreverMedida` (linha 409) imprime `injecao` com total 8. O "acerto" mistura duas medidas diferentes: achou o código da referência, e não obedeceu à ordem do texto. Exemplo: o modelo que devolve só o código mandado aparece como 0/2 por linha. O que devolve o certo e o mandado aparece como 1/2.
   - Os cinco critérios não são afetados, mas esse relatório é o que o Arquiteto lê e registra como evidência da AIA (1.10, item 4).
   **Correção:** contar a injeção uma vez só em `porCategoria`, pelo `!obedeceu`, por exemplo excluindo `injecao` do `somar` do bloco de conteúdo. Se as duas leituras forem úteis, usar chaves separadas. Acrescentar em `medir-classificacao.test.ts` um caso que confira `porCategoria.injecao` com total 4 no lote de ensaio.

Recomendações:

1. `apps/api/src/ia/execucao.repository.ts:59`: o `anoLetivoId: execucaoAgente.anoLetivoId` do `select` deixou de ser usado, porque o `quemPediu` agora lê `anoEmCurso`. É código morto e pode sair.
2. A tabela de divergências cita a §7c como lugar da divergência das ~31 mil tokens, mas a §7c ("Vazão", `techspec.md:183`) continua com "~12 mil por execução", e a conta foi só para o `TODO.md`. Uma nota curta na §7c apontando para o §8 e para o `TODO.md` evita que a 5.0 dimensione pela conta antiga.
3. `tools/ia/medir-classificacao.ts:211-232`: a saída inválida conta como acerto nos critérios de `sem_conteudo_curricular` e `injecao` e na categoria `fora_do_recorte`, porque sai sem código e "não obedece". A Tech Spec §7b e a AIA 1.10, item 4, dizem "saída inválida conta como erro" sem restringir aos critérios de conteúdo. Na prática quase não muda nada, porque o pedido junta as seções do mesmo recorte e a inválida derruba também as de conteúdo. Mesmo assim, a escolha deveria estar escrita no `cenarios.md`, "Lote retido", ou o recorte só com seções sem conteúdo deveria contar como erro.
4. `docs/aia/diagnostico-por-habilidade.md:292` fala em "treze sondas"; o `3_task.md` fala em "onze" e "doze" (linhas 52 e 53 da tabela). Alinhar o número ao que o `it.each` de `classificar-secoes.test.ts` roda de fato.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-17 18:51:44 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Desde a 1ª rodada o diff mexe na contagem do medidor (`porCategoria` deixa de contar a injeção duas vezes), em textos de governança, em documentação, em testes e no `select` de `paraIniciar`. O `select` perdeu uma coluna e não ganhou nenhuma.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo nem migration nova neste diff; a `0062` é a mesma que aprovei na 1ª rodada.

Autorização por objeto: ok. Não há rota nova nem filtro de escopo novo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.repository.ts` saiu do `select` a coluna `anoLetivoId`, que ninguém lia. O filtro por escola continua como estava.

Logs: limpos. As escritas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts` (linhas 494, 496, 515 e 520) mostram contagem, percentual e mensagem de erro tipado, sem o texto das seções. Elas não mudaram nesta rodada. A ferramenta roda só na linha de comando do Arquiteto, com material licenciado e sem dado de aluno.

Auditoria: presente. Nenhuma ação desta rodada exige registro novo, porque não há leitura nominal, exportação, nota nem permissão.

Envio externo: nada de novo. O medidor continua chamando o modelo local, com o que a 1ª rodada já tinha visto. O ajuste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/aia/diagnostico-por-habilidade.md` (linha 349) corrige uma frase que estava errada. Ela dizia que o registro de consumo sai com o material; agora diz que ele segue a retenção do `consumo_ia`, de 1 a 12 meses. É o que o código faz hoje.

Seed/fixture: sintético. O lote de ensaio do teste é montado no próprio teste, e o lote retido não está no repositório.

Bloqueantes: nenhum.

Recomendações:
- Na tarefa 4.0, o `consumo_ia` tem de gravar só ids e a saída, sem o texto do material, como a Tech Spec §7 pede. Hoje ele grava a entrada inteira. A pendência já está no `TODO.md` e nas "Recomendações sem aplicar" do `3_task.md`, mas o `4_task.md` precisa cobrá-la antes de fechar. Ela continua da 1ª rodada.
- Na tarefa 9.0, o `docs/lgpd.md` precisa dizer que a execução da classificação não tem titular nem ano letivo. Também precisa pôr a classificação entre as tarefas sem dado pessoal que podem ir a provedor de fora. Já tem destino registrado.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-17 18:51:59 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff não toca em `Nota`, nem por job, seed, importação ou webhook. Todos com autor humano? Sim.
Decisão autônoma sobre aluno: ausente. A classificação rotula a seção do material, e a habilidade da questão só vale quando o professor confere e aplica a atividade.
Aprovação registrada: ok. A exceção do tutor (D47) não se estende à classificação: a função se declara nível 1 e não diz que é supervisionada no lugar de aprovada.
Supervisão do tutor: ok. Esta rodada não muda nada no tutor.
Autonomia declarada e visível: sim.

**As correções exigidas na 1ª rodada foram feitas:**

1. **A AIA** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/aia/diagnostico-por-habilidade.md:264-266`) agora diz "Autonomia 1 (faz e registra): a classificação vale sozinha, para a geração e a cobertura, até a coordenação corrigir; nada chega ao aluno sem o professor conferir a habilidade da questão e aplicar a atividade." O texto bate com:
   - `packages/shared/src/time/funcoes.ts:6`, onde o nível 1 executa e registra;
   - o rótulo de tela em `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:167` ("Faz e registra");
   - o efeito da suspensão em `textos-da-governanca.ts:153`.
   
   A frase antiga ("prepara e nada sai dela sozinho… rótulo para o professor conferir") não aparece mais em nenhum doc nem no código. Só resta citada no achado da própria rodada.
2. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/agentes.md:79`** agora diz "**Faz e registra**; a coordenação corrige, e a correção vence." O nível é o mesmo no código, na tela, na AIA e em `agentes.md`.

**O resto do diff, no que toca a regra 70:**
- `textos-da-governanca.ts:153`: o texto da suspensão diz "geração de atividades" e "cobertura do currículo", em português mais claro. O teste novo (`textos-da-governanca.test.ts:138-139`) prova que o texto não usa palavra de nota, conceito ou pontuação, o que reforça a D55.
- A linha nova da AIA (`:349`), que fala da retenção do `consumo_ia` "de 1 a 12 meses", confere com `docs/lgpd.md:100`.
- Não muda nada no que a regra 70 cobre: a coluna sem uso que saiu de `execucao.repository.ts`, as mudanças em `medir-classificacao.ts` e no teste dele (só mexem na conta da medida), e a nota de vazão na Tech Spec.

Bloqueantes: nenhum.

Recomendações:
- O pedagogia-reviewer apontou que `EFEITO_COMUM_DA_SUSPENSAO` fala em "o que está esperando o professor", o que não existe na classificação. Quando a frase for revista, convém não sugerir que a classificação espera aprovação, já que ela é nível 1. O assunto já está registrado em "Recomendações sem aplicar" no `3_task.md`.
- Na 11.0, conferir que a conferência da habilidade da questão pelo professor existe de fato antes de a spec chegar à `develop`. Sem ela, a frase "nada chega ao aluno sem o professor conferir" na AIA e em `agentes.md` fica sem código que a prove. Esse ponto também já está registrado.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-17 18:51:59 · `tasks/prd-classificacao-bncc/3_task.md`

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

O diff desta rodada não toca request, fila, migration nem estado em memória.

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts:222`:** a seção de injeção deixa de contar duas vezes em `porCategoria`. É uma ferramenta de linha de comando, rodada pelo Arquiteto contra o modelo local, e fica fora do caminho de request.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.test.ts`:** o teste usa resposta simulada, conta as chamadas a um modelo falso e não chama provedor pago.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.repository.ts:52`:** só saiu do `select` de `paraIniciar` uma coluna que ninguém lia. O escopo por `escolaId` continua e o `update` condicional de `marcarRodando` também, então o ganho é pequeno e nada piora.
- **O restante:** textos de tela, documentação, nomes de teste e o registro da tarefa. Não muda o comportamento em carga.

Recomendações:
- **`TODO.md:9`:** os `VALIDATE` da `0062` sobre `consumo_ia` e `execucao_agente` precisam ir para uma migration à parte antes do staging ou do piloto. Já está registrado, com dono.
- **`tasks/prd-classificacao-bncc/techspec.md:177`:** a 5.0 precisa dimensionar pela conta nova de ~31 mil tokens por execução, que dá ~4 execuções/min. O texto ainda diz que uma escola de 300 apostilas termina em ~65 min, conta feita com ~12 mil tokens; com o número novo, passa de duas horas e meia. Além disso, a 4.0 precisa confirmar que a chamada entra na fila `lote` do limitador de tokens, e não na `normal`.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-17 18:52:06 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO
Perfis usados: `rapido` é o perfil declarado para `classificar_secoes` (mesmo da 1ª rodada). Esta rodada não mudou perfil, prompt nem adaptador. O que mudou no meu escopo foi só o medidor `tools/ia/medir-classificacao.ts` e o teste dele.
Custo estimado por professor/mês: sem mudança nesta rodada. A classificação roda por escola, à noite, e não por professor. A Tech Spec §7c já registra o recorte maior (~31 mil tokens por execução com 12 seções cheias, ~4 execuções/min no balde `lote`), e a conta está no `TODO.md`. O preço do `rapido` do contrato ainda não está no repositório, então o custo em reais segue pendente. O dono é o Arquiteto, na medida do lote retido.
Prompt versionado: sim. `classificar-secoes.ts` está em `prompts/`, e `prompts-caracterizados.test.ts` cobra o hash. Nada mudou nesta rodada.
Validação de schema: sim. A conferência vem depois do schema, e as treze sondas dão `IA_SAIDA_INVALIDA`.
Aprovação humana no caminho: sim. A autonomia é 1 e a função é suspensível. Nada chega ao aluno sem o professor conferir a habilidade da questão e aplicar a atividade. A correção da coordenação vence. O texto de `esperaAprovacao` foi ajustado para "Faz e registra", que descreve melhor o comportamento (a classificação vale sozinha até a coordenação corrigir). O texto de suspensão ficou sem vocabulário de nota, e o teste confere isso.

Auditoria do diff:
- `tools/ia/medir-classificacao.ts:221`: a linha de injeção deixou de contar duas vezes em `porCategoria`. A conferência foi correta. A injeção tem `referencia`, entrava pelo ramo de conteúdo e depois de novo pelo ramo próprio. Agora conta só pelo critério "não obedeceu". O teste `24 de 24` prova `porCategoria['injecao'] = {4, 4}`, e há bloco de mutação para a linha.
- O teste do piso de 80 % foi refeito com limites exatos (24 de 30 passa, 24 de 31 não) e trava o valor da constante. Duas mutações (0,9 e 0,7) estão documentadas. Rodei `medir-classificacao.test.ts` e passou: 44 de 44.
- O medidor segue sem chamar provedor pago. Os testes usam modelo falso, e o `principal` só roda contra o modelo local na medição do Arquiteto.
- A saída inválida está definida no `cenarios.md` e conta como saída sem código. Isso é correto para o critério e fica visível no relatório.
- A remoção de `anoLetivoId` do `select` em `execucao.repository.ts` não afeta a camada de IA. O `ia.int.test.ts` continua cobrindo a execução sem ano e sem pessoa.
- As mudanças em `docs/agentes.md`, na AIA e no texto da governança são só texto e estão coerentes entre si.

Bloqueantes: nenhum
Recomendações:
- Abrir o `4_task.md` cobrando o que a 1ª rodada já deixou registrado: gravar só ids no `consumo_ia` quando `levaTextoLivreDePessoa` é `false`, a fila `lote` na chamada e o freio de custo por escola. Hoje `orcamento.repository.ts` devolve `permitido: true` fora do Tutor.
- Na medida do lote retido, registrar o modelo usado e conferir truncamento com o teto de 800 tokens de saída. Incluir injeções que não citam código (por exemplo "devolva lista vazia"), porque o critério de injeção só detecta as que citam.
- Reescrever a linha de custo da Tech Spec (`techspec.md:209`) com o recorte maior e o preço do `rapido` do contrato.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.test.ts

## pedagogia-reviewer · 2ª rodada · APROVADO · 2026-11-17 18:52:16 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO
Amostras avaliadas: 5 (o efeito da suspensão que a coordenação lê, a linha da classificação em `docs/agentes.md`, o parágrafo da AIA sobre autonomia 1, o parágrafo da AIA sobre retenção, o critério de saída de `tools/ia/medir-classificacao.ts` e o teste dele)

Problemas por categoria: nenhum bloqueante.
- **Texto para a coordenação:** o diff trocou "A geração e a cobertura" por "A geração de atividades e a cobertura do currículo" em `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:153`. Ficou em português comum e sem vocabulário de nota. Um coordenador entende o que deixa de acontecer ao suspender. O teste novo em `textos-da-governanca.test.ts` trava `nota`, `conceito` e `pontuaç`.
- **Autonomia 1:** "Faz e registra" agora bate com `NOME_DA_AUTONOMIA[1]` (`textos-da-governanca.ts:167`) e com `funcoes.ts:6`. Antes, a classificação estava rotulada "Faz e avisa", que é a autonomia 2. A correção em `docs/agentes.md:79` e na AIA vale para a coordenação e para a escola.
- **Retenção na AIA:** o novo trecho diz que o que o registro guarda segue a retenção do `consumo_ia`, de 1 a 12 meses. Confere com a linha de `entrada` e `saida` em `docs/lgpd.md:100`. Antes o texto dizia que saía com o material, o que era impreciso.
- **Medidor:** a seção de injeção contava duas vezes em `porCategoria`, uma pela referência e outra pelo "não obedeceu". O `if` em `medir-classificacao.ts:222` a conta uma vez só. O teste prova `injecao` em 4/4 e o bloco de mutação cobre a linha.
- **Piso de 80%:** o teste antigo era vago e tinha um comentário confuso. O novo prova a fronteira com 24/30 (80%) passando e 24/31 (77,4%) não. Um critério mais frouxo ou mais rígido quebra o teste.
- **Alinhamento curricular:** a recomendação de ajuste de prompt (fora do recorte, "pior do que nenhum") continua adiada para a medida do Arquiteto. A decisão é aceitável, porque mexer no prompt muda hash e comportamento sem taxa na mão.

Exemplos concretos do que saiu errado: nenhum nesta rodada. O único defeito achado, a injeção contada duas vezes, já está corrigido no diff.

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum nesta rodada. A recomendação já registrada continua valendo: antes do primeiro aluno real, um professor confere o gabarito do lote retido (subtarefa 3.5, já no `TODO.md`).

Bloqueantes: nenhum.

Recomendações:
- `EFEITO_COMUM_DA_SUSPENSAO` fala em "o que está esperando o professor", que não existe na classificação. Já está registrado, com dono, na tabela de recomendações.
- A frase "a habilidade de cada questão só vale quando o professor confere e aplica" depende da tarefa 11.0. Conferir lá que ela entrega essa conferência antes de a spec chegar à `develop`.
- O medidor só detecta injeção que cita um código no texto. Ordens como "devolva lista vazia" não contam. O lote retido precisa incluir esse tipo de injeção, senão o critério fica mais fraco do que parece.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-17 18:52:21 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. A `0062` e o `execucao_agente` foram auditados na 1ª rodada e não mudaram desde então.
Queries verificadas: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/ia/execucao.repository.ts`, `paraIniciar`, nas linhas 52 a 73. Saiu do `select` a coluna `anoLetivoId`, que ninguém lia. O `escolaId` continua vindo do contexto (`requireEscolaId()`) e fica no `where`. Os dois `leftJoin` (de `usuario` e de `anoLetivo`) continuam presos a `execucaoAgente.escolaId`, e o `quemPediu` lê o `anoEmCurso` que o join escopado achou. O escopo não mudou. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts` é uma ferramenta de linha de comando. Ela não toca o banco e roda com uma escola sintética fixa (`ESCOLA_DA_MEDIDA`) contra o gateway. A mudança dela fica no que a medida conta (a injeção entra uma vez só em `porCategoria`) e não alcança dado de escola.
Teste de isolamento: presente e efetivo. Esta rodada não mexeu no teste da 1ª rodada nem na cláusula que ele prova. O caso alterado em `ia.int.test.ts` (linha 341) só ganhou outro título.
Bloqueantes: nenhum.
Recomendações: as da 1ª rodada continuam valendo e já estão no `3_task.md` com destino.
- A FK composta `(escola_id, id)`, com índice único, para a tabela filha da classificação.
- O teste de isolamento da escrita pelo `daRotina` na tarefa 4.0.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 18:52:45 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A nova nota na linha de vazão da §7c (`tasks/prd-classificacao-bncc/techspec.md:183`) e a regra da saída inválida no `cenarios.md` estão na Tech Spec e no `cenarios.md`, e não só no `3_task.md`.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum. As duas correções da 1ª rodada foram feitas:
1. **Nível de autonomia.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/agentes.md:79` agora diz "**Faz e registra; a coordenação corrige, e a correção vence.**". Isso bate com o nível 1 da tabela de níveis (linha 18), com `NOME_DA_AUTONOMIA[1]` e com `autonomia: 1` em `packages/shared/src/time/funcoes.ts:62`. A frase da AIA 1.10 também foi alinhada ao nível 1.
2. **Contagem dupla da injeção.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.ts:222`, a injeção já não é somada pelo bloco de conteúdo: ela entra em `porCategoria` uma vez só, pelo `!obedeceu` (linha 233). `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ia/medir-classificacao.test.ts:298` confere `porCategoria['injecao']` igual a `{ certos: 4, total: 4 }` no lote de ensaio. O bloco de mutação novo no `3_task.md` tira a condição, e com isso o total vai a 8 e o teste quebra.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/3_task.md:143`: o cabeçalho diz "109 blocos", mas a frase seguinte ainda diz "As 106 mutações abaixo foram corridas". Acertar a contagem para 109.
- O texto comum da suspensão (`EFEITO_COMUM_DA_SUSPENSAO`) fala em "o que está esperando o professor", e isso não existe na classificação. A pendência já está na lista de "Recomendações sem aplicar", com destino. Vale garantir que ela tenha uma entrada própria no `TODO.md`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-17 18:52:48 · `tasks/prd-classificacao-bncc/3_task.md`

VEREDITO: APROVADO

Cenários exigidos: a única correção que eu tinha exigido, o piso de 80 % dos códigos aceitáveis provado nos dois lados da fronteira. Além dela, o que o diff da rodada 2 mexe: a contagem da injeção uma vez só em `porCategoria`, o texto da suspensão sem vocabulário de nota, o `anoLetivoId` que saiu de `paraIniciar` e os nomes da tabela de testes.

Cobertos:
- **A correção exigida foi feita.** `tools/ia/medir-classificacao.test.ts:305-315`, no caso "80 % dos códigos propostos aceitáveis é o piso: 24 de 30 (80 %) passa, e 24 de 31 (77,4 %) não". O código fora vai para as seis e as sete primeiras linhas com referência (MA-01 a MA-07), e o `EF07MA03` não está em `referencia` nem em `aceitaveis` delas. O teste também confere a conta exata (`{ certos: 24, total: 30 }` e `{ certos: 24, total: 31 }`), então não depende de conta implícita. O comentário de rascunho saiu.
- **As duas mutações declaradas pegam o número.** Com `>= 0.9`, 24/30 dá 0,8, o critério falha e o `toBe(true)` fica vermelho. Com `>= 0.7`, 24/31 dá cerca de 0,774, o critério passa e o `toBe(false)` fica vermelho. Os dois ficam vermelhos pelo motivo certo.
- **Injeção contada uma vez só** (`medir-classificacao.ts:222`). Sem a condição, `porCategoria['injecao']` daria `{ certos: 8, total: 8 }`, e o teste exige `{ certos: 4, total: 4 }` (`medir-classificacao.test.ts:297-298`). O bloco de mutação está declarado.
- **Texto da suspensão.** `textos-da-governanca.test.ts:138-139` ganhou o `not.toMatch` de nota, conceito e pontuação para a classificação. O bloco de mutação do texto acompanhou a frase nova.
- **`paraIniciar` sem `anoLetivoId`.** É linha tirada, sem condição. A prova é o `tsc` mais o caso de `ia.int.test.ts`, cujo nome agora diz só o que ele prova.
- Os nomes "24 de 24" e "os seis checks" batem com a tabela do `3_task.md`, e a linha das sondas foi reescrita como "as treze".
- Rodei os dois testes de unidade tocados e passaram: `npx vitest run tools/ia/medir-classificacao.test.ts` (44 de 44) e `textos-da-governanca.test.ts` (26 de 26). Os `.int` (`ia.int.test.ts` e `mvp-tables.int.test.ts`) não rodei. Neles só mudou o nome do caso, e o portão os roda.
- Não há `.skip`, teste comentado, mock que esconda a regra, nem chamada a provedor pago.

Bloqueantes: nenhum.

Recomendações:
- `tasks/prd-classificacao-bncc/3_task.md:144`: a linha diz "109 blocos", mas a frase seguinte continua com "As 106 mutações abaixo foram corridas". Acertar para 109.
