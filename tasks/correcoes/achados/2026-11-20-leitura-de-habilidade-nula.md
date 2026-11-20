# Achados das revisões — `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 02:22:23 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A correção só afrouxa os schemas Zod de leitura em `packages/shared`: `questaoObjetivaSchema`, `conteudoDePlanoDeAulaSchema`, `diagnosticoGravadoSchema`, `questaoDoLoteSchema` e `acertoPorHabilidadeSchema`. As colunas `jsonb` continuam em `artefato.conteudo` e `correcao.por_habilidade`, que já tinham `escolaId` e `anoLetivoId`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/atividade/desempenho/desempenho.repository.ts`, em `acertosPorAlunoEHabilidade` e `descricoesDasHabilidades`. Só mudou o tipo do `select` para `string | null`. O filtro continua em `lotesAprovadosDaTurma`, com `requireEscolaId()` e `requireAnoEmCurso()`, e os joins seguem amarrados por `escolaId` e `anoLetivoId`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts`, em `acertosPorRecorte`, `descricoesDasHabilidades` e `acertosDaTurma`. Só mudou o tipo do `select`. O `#lotesAprovados()` e o `#escopo()` continuam lendo a escola e o ano do token.
- Nenhum endpoint, controller ou DTO de entrada novo. Nenhum `escolaId` chega pelo corpo ou pela query. Não há `@Unscoped()` novo.
- Camada rede: a linha `habilidade: null` é só mais um agregado do recorte (série e disciplina) e do nominal da turma, com contagem e sem aluno. Nenhum dado individual ficou ao alcance.
- Os ids continuam UUID. Nenhuma mensagem de erro nova foi criada.

Teste de isolamento: presente e efetivo. A correção não cria módulo, rota nem consulta nova, e os testes de isolamento que já existiam continuam valendo para os mesmos repositories. O caso novo em `analista.int.test.ts` (o que lê o banco) monta uma escola própria (`c`) e exige que `acertosPorRecorte`, `acertosDaTurma` e as chaves de `descricoesDasHabilidades` sejam exatamente as linhas dessa escola. Sem a cláusula de escopo de `#lotesAprovados`, os lotes aprovados das escolas `a` e das outras somariam linhas novas e o `toEqual` cairia.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts:212`: o comentário da interface diz que a ordem deixa a linha `null` por último. Hoje isso só vale porque o Postgres põe NULL por último no `ASC` por padrão. Escrever `nulls last` no `orderBy` deixaria a regra explícita.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-20 02:22:40 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

Tela vista: sim (16 fotos lidas, cheia e vazia, computador e celular). As telas que a correção alterou dependem de id ou de ação e não foram fotografadas. Avaliei essas pelo código e pelos testes, como o prompt avisou.

Estados: ok. A correção não mexe em carregando, vazio nem erro. As fotos mostram o estado vazio de Analista ("Nenhum resumo gerado ainda", com o botão Gerar resumo) e de Criados ("Nada gerado ainda", com o botão Ir para Ferramentas). Os dois convidam a agir. Em Turmas, a escola vazia mostra o cartão com "Em dia".

Acessibilidade:
- O rótulo "Sem habilidade" é texto de verdade, em `ProgressBar`, em `<li>` e em `<span>`, e o leitor de tela o lê.
- A barra segue `aria-hidden` com o número escrito ao lado.
- Nada novo depende de cor, de hover ou de atalho.

Chromebook fraco: sem impacto. A correção só troca texto e chave de lista, sem lista nova, imagem nem custo de CPU.

Celular: sem rolagem horizontal nem texto cortado em 360 px nas fotos.
- Rótulo, `detalhe` e as células da tabela de Aprovar usam `break-words` e `min-w-0`, então o rótulo "Sem habilidade" não estoura.
- Alvos e botões principais não mudaram.
- O rodapé de navegação trunca "FERRAME...", e na foto do Analista ele cobre o texto do "Dado nominal". As duas coisas já existiam e a correção não as toca. Fica como recomendação.

Ação oficial protegida: sim. Aprovar mostra o resumo e a tabela por questão com o rótulo novo. A correção não mexe em confirmação, valor nem aluno. O Analista só mostra a linha "Sem habilidade" e não gera alerta, e nenhum caminho passa a gravar `null`.

Marca de IA: o Analista segue com o selo "IA" (foto da coordenação, computador e celular).

Bloqueantes: nenhum.

Verifiquei o diff de web, uma tela por vez.
- **`Atividade.tsx:322`:** `key` e rótulo caem em "Sem habilidade", sem texto inventado.
- **`Analista.tsx` e `DadoNominal.tsx`:** mostram "Sem habilidade" e omitem o `detalhe`. Não aparece "null" nem código vazio.
- **`ConteudoDoArtefato.tsx`:** a questão sem habilidade mostra só o rótulo, sem o prefixo "Habilidade". O plano com `habilidades: []` mostra o rótulo na seção.
- **`Aprovar.tsx` e `TurmaHoje.tsx`:** barra e coluna da tabela usam o rótulo. `alunos-da-turma.ts:81` lista a linha como "Sem habilidade: N de M".
- **Testes:** cada tela tem teste do caso `null` ao lado do caso com habilidade. A tarefa registra que rodaram vermelhos sem o código de produção.
- **Termo técnico:** não vaza nenhum termo técnico, id ou texto em inglês.

Recomendações:
- A foto `aluno--aluno--*.png` (cheia e vazia) mostra "Página não encontrada", porque `/aluno` não tem rota de tela. O Início do aluno é `/aluno/inicio` (`apps/web/src/paths.ts:160`). É endereço errado da vitrine, não regressão desta correção. O mesmo aparece em `/aluno`, onde um aluno que digite o endereço da área cai num 404 em vez de ser levado ao Início. Vale um redirecionamento, em tarefa à parte.
- Em `coordenacao--coordenacao-analista--celular.png`, o rodapé fixo cobre o parágrafo "Dado nominal" na foto. Pode ser só efeito da captura. Convém conferir se há `padding-bottom` suficiente na página.
- O rodapé trunca "FERRAME..." a 360 px. Vale um rótulo curto, como "Ferram.", ou texto menor.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 02:23:05 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou. A correção só mexe na leitura. `corrigirTentativa` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/atividade/correcao/correcao-de-objetiva.ts`) continua produzindo a `Correcao`, agora com a linha `codigo: null`, e a aprovação do lote e a gravação de nota ficaram como estavam. Os caminhos de escrita existentes não foram tocados. Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente. A linha "Sem habilidade" é só contagem. Não entra em alerta nem em sinal de risco, e não cria nenhuma consequência sobre aprovação, reprovação ou encaminhamento.

Aprovação registrada: ok.
- A adaptação continua nascendo pendente.
- A conferência de fidelidade recusa a adaptação que tira ou troca a habilidade da questão original (`conferencia.ts`, função `mesmaHabilidade`; e `adaptar-atividade.ts:99`).
- A geração continua sem gravar `null` nem `[]`: `gerar-atividade-objetiva.ts:47` e `gerar-plano-de-aula.ts:122`, ambos com teste em `conteudo.test.ts`.
- A exceção da D47 não foi estendida a nenhum outro agente.

Supervisão do tutor: ok.
- O Tutor recebe a questão sem habilidade, ainda sem gabarito, explicação e citação (`turno.command.ts:82`).
- A memória da D66 ignora a linha `codigo: null` (`turno.command.ts:95`), com teste em `turno.command.test.ts`.
- A checagem de escopo continua funcionando, porque a descrição vazia entra como `''` (`turno-do-tutor.ts:426-429`).
- Nenhum campo novo sobre a pessoa do aluno.

Autonomia declarada e visível: sim, sem mudança. Nas fotos do Analista, no computador e no celular, com a escola cheia e a vazia, o agente aparece com o selo "IA" e a descrição em português comum ("Só avisa a coordenação: nunca contata professor nem família").

Os demais itens:
- **Item 6 (auditoria):** sem mudança. A leitura nominal continua auditada na mesma transação (`analista.service.ts:72`).
- **Item 7 (supervisão não é vigilância):** sem inferência emocional nem medida nova de comportamento.
- **Item 8 (D46/D55, discursiva e redação):** nada novo sugere nota em discursiva ou redação. O que mudou é diagnóstico formativo de objetiva, por contagem.
- **Item 9 (D45, medir o professor):** sem ranking. O dado nominal continua atrás da finalidade registrada.
- **Analista:** a linha sem habilidade é medida mas não vira alerta. A conferência recusa alerta que o modelo escrevesse com `habilidade: null` (`resumo-do-analista.ts:55-57`), com teste em `numeros.test.ts`.
- **`docs/regulacao.md`:** nada nesta correção pede mudança nele.

Rodei cinco arquivos de teste da tutoria, do Analista e da correção (`numeros`, `turno-do-tutor`, `conteudo`, `turno.command`, `correcao-de-objetiva`): 646 casos, todos verdes.

Bloqueantes: nenhum.

Recomendações:
1. O texto gramatical em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/packages/core/src/ia/tasks/relatorio-da-correcao.ts:56` produz "os erros pedem uma revisão rápida de o conteúdo desta questão", e o teste em `numeros.test.ts` confirma essa frase. O certo é "do conteúdo desta questão". O jeito simples é o `assuntoDaQuestao` devolver a frase já com a preposição.
2. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/web/src/areas/professor/turmas/TurmaHoje.tsx:272`, a linha "Sem habilidade" herda a frase "...menos da metade das questões desta habilidade". É bom ter um texto próprio para a linha nula, por exemplo "das questões sem habilidade".
3. As fotos de `/aluno` (`aluno--aluno--computador.png`, `vazia--aluno--aluno--celular.png`) mostram "Página não encontrada": a vitrine fotografa uma rota que não existe para o aluno. Isso não afeta a regra 70, mas deixa a tela do aluno sem foto. Fica para o `frontend-reviewer` e para o roteiro da vitrine.
4. As telas que mudaram de verdade (Aprovar, artefato aberto, resultado do aluno, TurmaHoje, dado nominal) não foram fotografadas. Auditei essas pelo código e pelos testes. Vale incluir na vitrine uma questão e um plano sem habilidade quando a classificacao-bncc (10.0) pousar.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 02:23:20 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo e nenhuma migration. A correção só aceita, na leitura, que a habilidade venha vazia: `habilidade: null` em `questaoObjetivaSchema`, `questaoDoLoteSchema` e `acertoPorHabilidadeSchema`, `habilidades: []` em `conteudoDePlanoDeAulaSchema` e `codigo: null` em `diagnosticoGravadoSchema`. A habilidade da BNCC vem do catálogo e não é dado de pessoa. O diagnóstico do aluno (`correcao.por_habilidade`) continua guardando só contagem, e só ganha uma linha "Sem habilidade" à parte.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha 49 (diagnóstico por habilidade) já cobre o diagnóstico com a mesma finalidade e a mesma retenção.

**Autorização por objeto:** ok. Nenhuma rota, repository nem guarda de acesso mudou. Os SQL de `desempenho.repository.ts` e `analista.repository.ts` mudaram só o tipo de `codigo` e `descricao` para `string | null`, com o mesmo `where` de escopo. O `tenancy-guardian` já aprovou a rodada 1.

**Logs:** limpos. Nenhum log, `console` ou `logger` foi acrescentado no diff.

**Auditoria:** presente. O dado nominal da coordenação (`analista.service.ts:66` e `DadoNominal.tsx`) continua gravando a auditoria na mesma transação, e esse caminho não mudou. A linha "Sem habilidade" aparece também ali, sem trazer nome nem nada novo.

**Envio externo:**
- **Tutor** (`turno.command.ts`, `turno-do-tutor.ts`): a questão sem habilidade vai ao modelo com `habilidade: null`, ou seja, com menos dado que antes. A memória do aluno (D66) ignora a linha `null`.
- **Analista** (`analista.command.ts`): a linha `null` entra nos agregados por série e disciplina, sem aluno e sem professor, e não gera alerta (`resumo-do-analista.ts`).
- **Relatório da correção** (`relatorio-da-correcao.ts`): é por questão e agregado.
- **Registro:** os três envios seguem pelo mesmo caminho da porta e de `ExecucaoAgente`, que não mudou.

**Seed/fixture:** sintético. Os testes novos usam "Professora Sintética", "Ana Beatriz" e "Camila Duarte" com ids gerados, e o `__fixtures__/inputs.ts` só ganhou uma guarda de tipo.

**Fotos:** nenhuma mostra dado de pessoa além do que já aparecia:
- `coordenacao--coordenacao-analista--computador.png` mostra só o texto agregado e o botão do dado nominal.
- `professora--professor-turmas--computador.png` e `professora--professor-criados--celular.png` não trazem aluno.
- `aluno--aluno--computador.png` mostra "Página não encontrada". Isso não tem a ver com a regra 20; fica para o `frontend-reviewer` e para a vitrine.

As telas que a mudança afeta e que não foram fotografadas (artefato aberto, Aprovar, resultado do aluno, TurmaHoje, dado nominal) conferi pelo código. Cada uma só troca código e descrição por "Sem habilidade" quando a habilidade é `null`, sem trazer nome, matrícula ou conteúdo novo para nenhum papel.

**Pergunta de fechamento:** responde. O diagnóstico com `codigo: null` fica na mesma tabela `correcao`, entra no arquivo do titular e sai na eliminação pelo mesmo caminho de antes. Os envios continuam registrados em `ExecucaoAgente`.

**Bloqueantes:** nenhum.

**Recomendações:**
- `docs/lgpd.md:49`: acrescentar a linha "sem habilidade" (`codigo: null`) à descrição do diagnóstico, que hoje diz "o acerto por código de habilidade". É coerência de documentação; o dado não muda de classe.
- Quando a classificacao-bncc (10.0) começar a gravar `null`, conferir que o Analista agregado não abre a linha "Sem habilidade" por turma num recorte abaixo do grupo mínimo. Hoje o grupo mínimo vale por recorte e a linha herda essa proteção, mas vale um teste quando houver dado real com `null`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 02:23:25 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO
Caminho quente tocado: prova | tutor | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok

A correção não cria endpoint, query, job, migration nem limitador. Ela não mexe na gravação da prova e não guarda nada em memória. As três queries de `jsonb_to_recordset` (desempenho e Analista) continuam com o mesmo `from`, os mesmos joins, o mesmo `where` e o mesmo `group by`. Nelas só mudou o tipo de `codigo`, que passou a aceitar `null`. Do lado do Tutor e da correção de objetiva, as mudanças estão em funções puras que rodam em memória e não chamam nada externo. Nenhum teste novo chama provedor pago.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/packages/core/src/ia/openai-compat-adapter.ts:40`: o JSON Schema enviado ao modelo é gerado a partir de `esquemaDeSaida`. Com os schemas afrouxados, `gerar-atividade-objetiva`, `adaptar-atividade` e `gerar-plano-de-aula` agora mostram ao provedor que `habilidade` pode ser `null` e que `habilidades` pode vir vazia. O `conferir` recusa os dois casos, então nada errado é gravado. O custo é que cada recusa provoca uma nova chamada de reparo, com tokens a mais e latência numa ferramenta em que o professor está esperando. Até a 10.0 produzir `null` de propósito, há dois caminhos:
  - usar nas tarefas de geração um esquema de saída que siga exigindo a habilidade, deixando o schema afrouxado só para a leitura;
  - ou acompanhar a taxa de reparo dessas três tarefas depois do deploy.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts:212` e `:298`: o comentário promete que a linha `null` fica por último, mas isso só acontece porque o Postgres põe `NULL` no fim de um `ORDER BY` ascendente por padrão. Vale escrever `nulls last` explícito. Como `porHabilidade` é cortado por `slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE)` logo depois, a ordem decide o que entra e o que fica de fora.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-20 02:24:00 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção faz só o que a §7c, linha "Migration", da techspec da classificacao-bncc pede: os cinco schemas aceitam `habilidade: null`, `habilidades: []` e `codigo: null`, e todos os leitores listados tratam a linha sem habilidade. A geração continua recusando os três formatos, e há teste disso (`gerar-atividade-objetiva.ts:47`, `gerar-plano-de-aula.ts:122`). A explicação ao lado do "Sem habilidade" (techspec §9) não foi feita, e está certo assim: ela é da 12.0, que a `10_task.md` da spec já registra como fora do escopo.

Aderência à Tech Spec: ok. A linha sem habilidade nunca é somada a um código e fica por último em todas as leituras:
- **Desempenho:** a ordem é feita no service (`desempenho.service.ts:68`).
- **Analista e dado nominal:** o `order by habilidade.codigo` do Postgres já põe o nulo no fim.
- **Tutor:** a memória do Tutor ignora essa linha (D66).
- **Analista, alertas:** a linha aparece, mas não gera alerta.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **O modelo passou a ver que pode responder sem habilidade.** O JSON Schema que vai ao modelo sai do mesmo zod que valida a resposta (`packages/core/src/ia/openai-compat-adapter.ts:40`). Com os schemas afrouxados, o schema enviado a `gerar_atividade_objetiva`, `gerar_plano_de_aula` e `adaptar_atividade` agora diz que `habilidade` aceita `null` e que `habilidades` pode vir vazia. Nada é gravado errado, porque a conferência recusa os dois. Mas, se o modelo escolher `null`, a chamada volta para correção e gasta tokens (D14) até a 10.0 pousar. O prompt ainda diz "UMA das habilidades recebidas", o que diminui o risco. Vale registrar na retro ou no `TODO.md` da classificacao-bncc, ou usar um schema de saída mais estreito na geração.
2. **Linha sem habilidade pode sumir quando há muitas habilidades.** Ela vem por último e o corte por `MAXIMO_DE_HABILIDADES_*` é feito depois da ordenação (`analista.command.ts:104`, `analista.service.ts:67`, `desempenho.service.ts:68`). Num recorte com mais habilidades que o limite, é ela que cai. Aceitável, mas a 12.0 deve saber disso.
3. **Ramo que nunca é alcançado.** Em `resumo-do-analista.ts:65`, `codigoDoAlerta ?? ''` não tem efeito: com o código `undefined`, a função já retornou antes, na linha 57. Dá para usar o código sem o fallback.
4. **Foto do aluno não mostra a tela do aluno.** As duas fotos de `/aluno` (`aluno--aluno--celular.png` e as demais) mostram "Página não encontrada", porque `/aluno` não é rota: o "Início" fica em `ALUNO_ROUTES.inicio`, em `apps/web/src/areas/aluno/routes.tsx:41`. Não é defeito desta correção, mas a vitrine deveria fotografar o endereço do Início.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/packages/core/src/ia/openai-compat-adapter.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/packages/core/src/ia/tasks/resumo-do-analista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md` (§7c, linha 198)

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 02:25:43 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** uma prova com questões sem habilidade misturadas às com código abre para o aluno, é corrigida, entra no lote e é aprovada. O diagnóstico ganha a linha `codigo: null` à parte, que chega ao desempenho, ao Analista, ao dado nominal, ao Tutor, ao PDF, à conferência da adaptação e às seis telas.
- **Formato de hoje intacto:** a questão com habilidade, o plano com habilidades e o diagnóstico com código continuam passando. A chave ausente e o `codigo: ''` continuam recusados.
- **Bordas:**
  - a atividade inteira sem habilidade;
  - duas questões sem habilidade, que somam entre si e nunca com a linha de um código;
  - a linha `null` na ordem declarada, inclusive quando a questão sem habilidade é a primeira;
  - a adaptação que dá habilidade a quem não tinha ou tira de quem tinha;
  - a geração que ainda tenta gravar `null` ou `[]`;
  - a memória do Tutor (D66) sem a linha `null`;
  - o Analista sem alerta para a linha `null`;
  - a descrição `null` que o SQL de `jsonb` devolve.
- **Permissão:** o dado nominal lido pela coordenação com finalidade, pelo caminho que já existe.
- **Isolamento:** nenhuma query nova, só tipos. Os testes de integração usam escola própria.
- **Concorrência:** não se aplica, porque a correção só mexe na leitura.

**Cobertos:** todos os itens acima têm teste, menos a ordem da linha `null` quando a questão sem habilidade vem antes (bloqueante 6). Rodei os testes e passaram:
- 10 arquivos de unidade (shared, core e API): 732 casos verdes;
- 6 arquivos da web: 138 casos verdes;
- `analista.int.test.ts` inteiro: 22 casos verdes;
- `correcao.int.test.ts`, rodado com filtro: o caso novo de ponta a ponta passou.

Nenhum `.skip`. A IA roda com adaptador falso. Os espiões do `analista.int.test.ts` substituem só o repository, e a regra fica no command e no service. Além disso, há o caso com o SQL real.

**Bloqueantes:**

1. **`apps/api/src/artefato/pdf-do-artefato.ts:225`**: o `questao.habilidade?.codigo ?? ROTULO_SEM_HABILIDADE` da linha do gabarito não tem bloco. O bloco que existe é só o da linha 238, do plano. **Correção:** acrescentar um bloco que tira o `?? ROTULO_SEM_HABILIDADE`, com o teste `pdf-do-artefato.test.ts › a questão sem habilidade sai com o rótulo`. Ele fica vermelho, porque o PDF passa a dizer "1. B — undefined".

2. **`apps/web/src/areas/professor/turmas/alunos-da-turma.ts:81`**: o `item.habilidade?.codigo ?? ROTULO_SEM_HABILIDADE` não tem bloco. **Correção:** um bloco que tira o `?? ROTULO_SEM_HABILIDADE`, com o teste `alunos-da-turma.test.ts › a questão sem habilidade`. O texto esperado vira "undefined: 1 de 2".

3. **`apps/web/src/areas/coordenacao/governanca/Analista.tsx:189` e `DadoNominal.tsx:186`**: o documento justifica essas linhas como mutante equivalente, e a justificativa está errada. A mutação natural troca `medida.habilidade === null` por `false`. Isso faz ler `.codigo` de `null`, o render quebra e os dois testes "a questão sem habilidade" e "o dado nominal da turma" ficam vermelhos. É o mesmo motivo dos blocos `habilidade!.codigo` que o próprio documento aceitou nas outras telas. **Correção:** um bloco para cada arquivo, e tirar os dois do parágrafo de motivos.

4. **`packages/core/src/ia/tasks/turno-do-tutor.ts:349`**: o `entrada.questao?.habilidade?.codigo` em `lembrancaDoTrabalho` é uma proteção nova contra `null`, sem bloco. Voltando para `entrada.questao?.habilidade.codigo`, o turno quebra e o teste `turno-do-tutor.test.ts › a questão sem habilidade não derruba o turno` fica vermelho. **Correção:** acrescentar esse bloco.

5. **`packages/core/src/ia/tasks/relatorio-da-correcao.ts:70`**: o ramo "A maioria acertou… revisão rápida de ${assuntoDaQuestao(questao)}" não tem bloco. Só a linha 69 tem. Voltando a `“${questao.habilidade.descricao}”`, o teste `numeros.test.ts › manda retomar o conteúdo da questão` fica vermelho na asserção de `questoes[0]`. **Correção:** acrescentar esse bloco.

6. **A seção "Correção" do documento (linha 37) diz que a linha `null` vem "por último na ordem" em cada leitor, e isso é falso em dois deles.**
   - No lote (`apps/api/src/atividade/correcao/lote.ts:30-33` e `68-71`), a linha segue a ordem em que a questão aparece na atividade, e o nome do teste em `lote.test.ts` diz exatamente isso.
   - No diagnóstico da aluna (`minha-atividade.service.ts:149-152`), a ordem é a do diagnóstico gravado, que também é a da atividade (`correcao-de-objetiva.ts:34-40`).
   - Só o desempenho e o Analista põem a linha `null` por último. Em todos os testes as questões sem habilidade são as últimas, então nenhum deles distingue as duas regras.
   - **Correção:** escolher uma das duas.
     - Reescrever a frase: no lote e no diagnóstico do aluno, a ordem é a da atividade; no desempenho e no Analista, a linha `null` vem por último. Nesse caso, um teste com a questão 1 sem habilidade prova a ordem do lote e a do diagnóstico.
     - Ou levar a linha `null` para o fim em `corrigirTentativa` e `resumoDoLote`, com o mesmo teste.

**Recomendações:**
- O prompt do Analista (`packages/core/src/ia/prompts/resumo-do-analista.ts`) não diz que a linha `habilidade: null` não vira alerta. Um modelo real pode gerar esse alerta, que a conferência recusa e só custa gasto e nova tentativa. Fica para o `llm-integrator`.
- Os cortes `MAXIMO_DE_HABILIDADES_NO_DESEMPENHO` e `MAXIMO_DE_HABILIDADES_POR_RECORTE` descartam a linha `null` quando o recorte já tem o máximo de habilidades. Não há teste que fixe esse comportamento no limite.
- No teste `turno-do-tutor.test.ts › não derruba o turno`, a habilidade com mais erros é a mesma da questão. Por isso ele não distingue "achou pela questão" de "caiu na de mais erros", e uma memória com outra habilidade na frente tornaria o caso mais claro.
- `analista.int.test.ts` rodado com `-t "habilidade"` falha na linha 208, porque o caso depende do estado criado pelos casos anteriores. Isso já existia antes desta correção, e o arquivo inteiro passa.
- No teste do `TurmaHoje`, vale afirmar também que a barra sem habilidade não ganha código, como já faz o teste do dado nominal.

Documento da tarefa: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-20 02:44:29 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei o diff desde a 1ª (`.processo/ordens/diff-codigo-r2.patch`, 185 linhas), o diff do documento da correção e as fotos da vitrine. A 1ª rodada não exigiu nenhuma correção, então não havia o que conferir de pendência.

- **Caminhos de escrita em Nota:** nenhum caminho novo e nenhum alterado. O diff não toca `Nota`, aprovação de lote nem `lancadaPor`. Todos com autor humano? sim, pelo que já foi auditado na 1ª rodada.
- **Decisão autônoma sobre aluno:** ausente.
- **Aprovação registrada:** ok. O diff não mexe em fluxo de aprovação.
- **Supervisão do tutor:** ok. A única mudança no Tutor é no teste (`packages/core/src/ia/tasks/turno-do-tutor.test.ts`). Ele prova que, na questão sem habilidade, a memória cai na habilidade de mais erros, e que a resposta continua terminando em pergunta. É trabalho do aluno e não fala da pessoa, como a D66 pede.
- **Autonomia declarada e visível:** sim, sem alteração. Na foto `coordenacao--coordenacao-analista--computador.png` e na versão de celular, o cartão do Analista diz em português comum o que ele faz, com o selo IA.
- **Bloqueantes:** nenhum.

**O que conferi nesta rodada:**
- **Ordem do Analista** (`apps/api/src/governanca/analista.repository.ts:212` e `:299`): o `nulls last` só muda a ordem. A linha "Sem habilidade" continua agregada e só de lote aprovado.
- **Alerta do Analista** (`packages/core/src/ia/tasks/resumo-do-analista.ts:65`): a retirada do `?? ''` é segura. Quando `codigoDoAlerta` é `undefined`, a função já saiu antes, na linha 57. A linha `null` continua sem gerar alerta.
- **Frase própria no TurmaHoje** (`apps/web/src/areas/professor/turmas/TurmaHoje.tsx:274-275`): ela conta alunos abaixo da metade, sem nome e só de atividade aprovada. É dificuldade de aprendizagem, não vigilância (item 7). Fica só na aba da turma, ao professor dela (D34).
- **Relatório da correção** (`packages/core/src/ia/tasks/relatorio-da-correcao.ts:56-59` e `:72-73`): a mudança é só de preposição. O relatório é da objetiva e não propõe nota nem conceito. Discursiva e redação (D46/D55) não são tocadas.
- **Testes novos** (ordem no lote e no diagnóstico): só reforçam a leitura.
- **Professor** (item 9): nenhuma métrica, nenhum ranking.

**Fotos:** as oito situações são estado vazio ou lista. Nenhuma mostra nota, conceito ou sugestão de nota. O selo IA aparece no Analista, no Tutor (`aluno--aluno-inicio--computador.png`) e no Assistente (`vazia--professora--professor-criados--celular.png`). O aluno é avisado de que o professor acompanha o Tutor. Nada induz uso, e "Sair" está à vista. As telas que dependem do dado novo não foram fotografadas, como a própria ordem já diz, e eu as avaliei pelo diff e pelos testes.

**Recomendações:**
- Em `coordenacao--coordenacao-analista--celular.png`, o botão "Abrir dado nominal de uma turma" aparece abaixo da barra de navegação fixa, e a frase sobre auditoria fica cortada por ela. A auditoria continua existindo, mas o aviso de que a abertura fica registrada aparece truncado no celular. Isso é visual: cabe ao `frontend-reviewer` conferir.
- Nenhuma outra.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-20 02:44:56 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO
Tela vista: sim (24 fotos lidas: Analista, Turmas, Criados e Início do aluno, no computador e no celular, escola cheia e vazia; a Mesa listou 16 fotos novas e li também as 8 de `/aluno`, de antes). Não vi as telas que o dado novo muda (TurmaHoje aberta, Aprovar, artefato, resultado do aluno, dado nominal do Analista), por dependerem de id ou de ação. Essas avaliei pelo código e pelos testes.
Estados: ok. Em `TurmaHoje.tsx:250-262`, o erro tem `ErrorState` com "Tentar de novo". O caso de tudo ter caído tem texto próprio. Com `lotesAprovados === 0` o vazio explica o que falta e convida a aprovar uma correção. Com dado, aparecem as barras. O carregando já existia e esta rodada não o tocou.
Acessibilidade: sem mudança nesta rodada. A barra da linha sem habilidade usa o mesmo `ProgressBar`, com rótulo e texto "3 de 6" (`TurmaHoje.tsx:266-271`). Nas fotos, o foco e o contraste seguem o padrão do sistema.
Chromebook fraco: sem impacto. A rodada só trocou frase, ordem do SQL (`nulls last`) e testes.
Celular: sem rolagem horizontal e sem texto cortado em nenhuma das fotos de 360 px. Os botões principais ("Abrir a turma", "Gerar resumo", "Ir para ferramentas", "Ver todas as tarefas") têm 44 px ou mais. Não encontrei nada que dependa de hover.
Ação oficial protegida: sim. A rodada não mexe em aprovar nota, e `Aprovar.tsx` não está no diff desta rodada.

Correção exigida da rodada anterior: nenhuma, e nenhuma ficou pendente. A única mudança de tela é a frase da linha sem habilidade em `TurmaHoje.tsx:48-49` e `TurmaHoje.tsx:271-273`. Ela agora diz "menos da metade das questões sem habilidade nas atividades aprovadas" e deixa de herdar "desta habilidade". O texto está em português correto, sem termo técnico, e o teste em `TurmaHoje.test.tsx:644-651` cobre a frase e a ausência de código na barra.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/areas/professor/turmas/TurmaHoje.tsx:49`: o auxiliar `questoesDaHabilidade` devolve "questões sem habilidade" quando a habilidade é nula. O nome contradiz o caso. `questoesDoNumero` ou `textoDasQuestoes` seria mais fiel.
- `apps/api/src/governanca/analista.repository.ts:212` e `:299`: o SQL põe a linha sem habilidade por último (`nulls last`). O resumo do lote e o diagnóstico da correção a põem na ordem da atividade (`correcao-de-objetiva.test.ts:60-67`, `lote.test.ts:42-50`). A diferença é intencional e coerente, porque o Analista agrega por código. Vale uma linha de comentário dizendo isso.
- Nas fotos de celular, o rótulo "FERRAMENTAS" aparece cortado como "FERRAME…" na barra inferior, em 360 px. Esse componente não faz parte desta correção. Fica para a validação ou para o TODO.
- Na foto do Analista no celular, a captura de página inteira mostra a barra inferior fixa por cima do texto "Dado nominal". Parece efeito da captura e não defeito da tela, e a tela não mudou nesta tarefa.

Arquivos principais: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 02:45:15 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A seção "Correção" agora diz em que ordem cada leitor põe a linha sem habilidade. No lote e no diagnóstico ela segue a ordem da atividade. No desempenho e no Analista ela vem por último. O código faz isso: `orderBy(sql\`habilidade.codigo nulls last\`)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts:212` e `:299`. Os testes novos de ordem estão em `lote.test.ts:42-50` e `correcao-de-objetiva.test.ts:60-67`.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Correções exigidas na rodada anterior: nenhuma. A minha recomendação foi feita: o `?? ''` de `chave` saiu de `packages/core/src/ia/tasks/resumo-do-analista.ts:65`.

Bloqueantes: nenhum

Recomendações:
- `apps/web/src/areas/professor/turmas/TurmaHoje.tsx:49`: o parâmetro `questoesDaHabilidade(habilidade: object | null)` aceita qualquer objeto. Use o tipo da habilidade que já existe em `packages/shared`, para a assinatura dizer o que recebe.
- `apps/web/src/areas/professor/turmas/TurmaHoje.tsx:274-275`: a frase da linha sem habilidade só tem teste no caso com alunos abaixo da metade (`TurmaHoje.test.tsx:648`). O caso "Nenhum aluno acertou menos da metade das questões sem habilidade" não tem asserção. É cobertura extra; a decisão é do `test-engineer`.
- `relatorio-da-correcao.ts:56-59`: `retomarDaQuestao` e `revisaoDaQuestao` repetem o mesmo ternário e só mudam a preposição. Pode ficar assim, mas uma função só que devolva o assunto, com a preposição montada por quem chama, evita que os dois textos se separem com o tempo.
- O documento da correção, seção "Mutações": o cabeçalho diz "1 linha (51 blocos, 1 motivo)" e "A que o comando ainda lista é a de baixo", no singular. A lista de motivos tem dois itens: o laço dos repositories de desempenho e Analista, e o guarda do `turno.command.ts`. Acerte o texto com a saída do comando.

As fotos não mostram nada desta rodada: o diff só mexe na frase da aba Hoje da turma aberta, que não foi fotografada. Avaliei pelo código e pelo teste em `TurmaHoje.test.tsx:647-651`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-20 02:45:39 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A rodada 2 só mudou texto de relatório, uma frase da aba Hoje, uma chave de deduplicação no validador do Analista, o `orderBy` de duas leituras já existentes e testes. Não há rota, fila, chamada de modelo nem migration nova.
Rate limit: ok. Nada mudou aqui.
Fila e prioridade: ok. Nada mudou aqui.
Concorrência: protegida. Não há escrita nova.
Índice e paginação: ok. As duas queries de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts` (linhas 212 e 299) só mudaram a ordenação. Filtro, agrupamento e escopo continuam iguais. O `nulls last` explícito mantém o que o Postgres já faz por padrão em ordem crescente. Agora fica escrito que, acima de `MAXIMO_DE_HABILIDADES_POR_RECORTE` (60), a linha sem habilidade é a primeira a sair do corte (`analista.command.ts:104`, `analista.service.ts:68`). Era essa a correção que eu tinha exigido, e ela foi feita.
Degradação de IA: não se aplica. `resumo-do-analista.ts:65` só tirou o `?? ''`. A essa altura `codigoDoAlerta` já não pode ser `undefined`, porque o retorno antecipado da linha 57 cobre esse caso. O comportamento não muda.
Migration: não se aplica.
Métrica e alerta: ok. Não entrou código novo no caminho quente.
Bloqueantes: nenhum.
Recomendações:
- O JSON Schema que vai ao modelo ainda não aceita `habilidade: null`. Continua pendente, com destino já registrado na classificacao-bncc (10.0) e no `TODO.md`. Fica anotado para a validação, para conferir que o item não se perde.
- Falta um teste no `analista.int.test.ts` para um recorte com mais de 60 habilidades e uma linha sem habilidade. Ele provaria que, no corte, é a linha sem habilidade que sai e não uma habilidade com código. Hoje o teste da linha 297 só usa linhas com código.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 02:45:55 · `tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md`

VEREDITO: APROVADO

**Cenários exigidos:** as seis correções da 1ª rodada, mais as mudanças desta rodada que vieram de recomendação:
- `nulls last` no Analista
- as duas preposições do relatório
- a frase própria do TurmaHoje
- a retirada do `?? ''` em `resumo-do-analista.ts`
- os dois reforços de teste, no Tutor e no TurmaHoje

**Cobertos:**
1. **`pdf-do-artefato.ts:225`.** O bloco novo tira o `?? ROTULO_SEM_HABILIDADE`. O teste em `pdf-do-artefato.test.ts:202` espera `1. B — Sem habilidade` na linha do gabarito, então o mutante, que escreve `undefined`, fica vermelho pelo motivo certo.
2. **`alunos-da-turma.ts:81`.** Tem bloco, e `alunos-da-turma.test.ts:109` espera o texto exato `… · Sem habilidade: 1 de 2`.
3. **`Analista.tsx` e `DadoNominal.tsx`.** Cada arquivo tem o seu bloco e os dois saíram do parágrafo de motivos. O mutante lê `.codigo` de `null` e quebra a tela, que é justamente o defeito que esta correção conserta.
4. **`turno-do-tutor.ts`, `codigoDaQuestao`.** Tem bloco. O teste ficou mais forte: a memória tem a habilidade de mais erros (5) diferente da habilidade da questão (3). Ele prova a escolha pela questão quando ela tem habilidade, e a queda para a habilidade de mais erros quando não tem.
5. **`relatorio-da-correcao.ts`.** Há blocos para `retomarDaQuestao`, para `revisaoDaQuestao` e para os dois ramos do texto, já sobre o texto corrigido. O teste em `numeros.test.ts` espera "revisão rápida do conteúdo desta questão." e "vale retomar o conteúdo desta questão.".
6. **A frase sobre a ordem na seção "Correção".** Foi reescrita e agora diz a ordem de cada leitor. Há dois testes novos com a questão 1 sem habilidade:
   - `correcao-de-objetiva.test.ts`, "a linha sem habilidade segue a ordem da atividade…"
   - `lote.test.ts`, "segue a ordem da atividade, e não vai para o fim…"
   
   O "por último" do Analista é provado no banco por `analista.int.test.ts:351`. No desempenho, ele já tinha blocos do `desempenho.service.ts`.
7. **TurmaHoje.** `questoesDaHabilidade` tem bloco, ligado à asserção nova de "questões sem habilidade". O ramo do zero também tem bloco, ligado ao teste "com lote aprovado" (`TurmaHoje.test.tsx:631`).
8. **`--faltando`.** Lista só `turno.command.ts:96`, e ela tem motivo de mutante equivalente aceitável: a linha seguinte já descartaria a linha `null`, e o bloco que ignora a linha `null` prova o comportamento.
9. **Testes rodados.** Os 5 arquivos de teste mexidos nesta rodada estão verdes (657 testes).

**Bloqueantes:** nenhum.

**Recomendações:**
- **`analista.repository.ts:212` e `:299`:** `nulls last` com ordem ascendente já é o padrão do Postgres. A mudança só deixa a intenção escrita, e um mutante que o retirasse seria equivalente. A frase da seção "Correção" poderia dizer isso, para não parecer uma cláusula que ficou sem bloco.
- **`TurmaHoje.test.tsx`, asserção nova:** `getByText('Sem habilidade').closest('div')` pode pegar só o envoltório do rótulo, e não a barra inteira. Nesse caso, o "sem código na barra" passa por pouco alcance. Vale buscar o item da barra pelo papel ou por um `data-testid` do item.
- **Contagem dos motivos:** o cabeçalho da seção "Mutações" diz "1 motivo", mas a lista de motivos tem dois itens. O do laço dos repositories cobre linhas que o `--faltando` não lista. Ajustar o texto evita confusão na validação.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/tasks/correcoes/2026-11-20-leitura-de-habilidade-nula.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/api/src/governanca/analista.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-20-leitura-de-habilidade-nula/apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx
