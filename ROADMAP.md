# Roadmap — Turmma

## Como ler isto

O alvo é o sistema inteiro, não um MVP fatiado, porque a venda acontece em reunião de
coordenação e em assembleia de pais, e o que convence é o fluxo completo. Um pedaço não
vende.

**Piloto por fatias (D1 revista).** Uma escola piloto gratuita entra no 1º semestre de 2027
usando o que já estiver pronto, antes do F16. O portão da primeira escola real (abaixo) vale
antes dela. Quais funcionalidades formam a fatia do piloto está em aberto em `docs/decisoes-em-aberto.md`.

**MVP de apresentação (D71).** Logo depois do F1 entram cinco specs, A1 a A5: fatias finas e
reais do fluxo completo, numa escola sintética, para começarmos a demonstrar. Não é MVP de
venda e não recebe dado real. Depois dele as fases seguem na ordem de antes, e cada uma
**completa** a fatia que já existir em vez de começar do zero. Concluído em 05/10/2026: a A2 a
A5 numa fatia só, pela D77 (`13eab64`).

**O texto de cada fase diz só o que falta** (reconciliação de 24/10/2026). Cada fase pendente foi conferida
contra o código, e o que o MVP, as X e a X5 já entregaram está em "Já existe". As duas tabelas de empréstimo
(do MVP e das X) saíram, porque estavam desatualizadas. Na mesma conferência, o F8 (`calendario-do-professor`)
entrou no F2, porque depende inteiro da grade; o F10 (`modo-sala-tempo-real`) entrou no F9, porque a
infraestrutura e os sinais já existem e o modo casa nasce com a política por turma do F9; e a fila do F11
e o gateway do F5 passaram para a X6, que já tem o desenho (42.0, 47.0, 49.0 e 50.0).

A ordem abaixo existe por um motivo diferente: reduzir retrabalho. Construir a base
institucional depois dos agentes significaria refazer os agentes, porque eles dependem do
contexto que a base fornece. Não é ordem de lançamento, é ordem de construção.

**Toda tela nasce responsiva** (D51): funciona do computador da escola ao celular, e é
testada nos projetos `chromebook` e `celular`. Nenhuma fase tem "adaptar para celular" como
trabalho posterior.

**Conformidade também não é fase** (revisão de 19/09/2026). Cada funcionalidade de alto risco
nasce com a sua Avaliação de Impacto Algorítmico (D60), e o que a escola exige por documento
é a governança do F12 exportada mais três textos (D61). O que virou requisito novo em cada
fase está em `docs/conformidade-mec.md` seção 11; o que é lei está em `docs/regulacao.md`.

Cada funcionalidade tem um **critério de pronto verificável**. "Pronto" não é "o código
está escrito": é um comportamento que alguém consegue demonstrar.

Três observações que valem mais que a lista:

**F3 (LGPD e titular) não pode ser a última.** Parece burocracia e é o que protege o
negócio. Exportação e eliminação por titular construídas no fim viram migration em quase
todas as tabelas.

**F12 (governança) parece um painel secundário e é a tela que fecha a venda.** É o que
nenhum concorrente entrega e o que responde à exigência do CNE que toda escola tem pela
frente.

**F5 (camada de IA) pode e deve correr em paralelo desde o começo**, porque não depende do
domínio e porque é onde mora a medição de custo que valida a precificação.

<critical>Não inicie uma funcionalidade cujas dependências não estejam concluídas.</critical>

`[ ]` pendente · `[~]` em andamento · `[x]` concluída

---

## F0 — `fundacao-tecnica` [x]
Concluída em 14/09/2026, validada em tasks/prd-fundacao-tecnica/validacao.md.

**Depende de:** nada

Monorepo, Docker Compose (Postgres, Redis de fila e Redis de cache, SeaweedFS), Drizzle, Vitest,
Playwright, esteira de typecheck/lint/test, log estruturado **sem dado pessoal**, erro
tipado. API, realtime e worker como processos separados e sem estado. Filas com prioridade
e limite por escola, com entrega pelo menos uma vez e chave de idempotência obrigatória no
processador (D49). Rate limit por usuário e por escola. Métrica básica. Tudo local: a
produção nasce depois, na VM (D31). Ver `docs/infra.md`.

**Pronto quando:** `docker compose up` sobe tudo, um e2e verde toca API e web, e a esteira
do GitHub fica verde no mesmo commit.

## F1 — `identidade-e-tenancy` [x]
Concluída em 21/09/2026, validada em tasks/prd-identidade-e-tenancy/validacao.md.
**Depende de:** F0

Escola, ano letivo, série (anos finais e Ensino Médio, D43), turma, disciplina, usuário,
papel, vínculo. Vínculo criado pela escola e confirmado pelo professor; vínculo não
confirmado não dá acesso a aluno. Usuário com vínculo em mais de uma escola. JWT com escopo.
Login por e-mail, por matrícula e, como adaptador opcional, pela conta Google ou Microsoft
da escola guardando só o identificador (D48). MFA do coordenador. Escopo no repository.
Matriz de permissão, incluindo indicador de professor (regra 60, item 11). DTO de saída
explícito.

**`responsavel` e o vínculo responsável × aluno nascem aqui, sem interface.** Se o art. 24 do
ECA Digital alcançar serviço contratado pela escola, conta de aluno de até 16 anos precisa
estar vinculada à de um responsável legal — e descobrir isso depois do F9 vira migration em
quase todas as tabelas. O parecer está no `TODO.md`; a estrutura custa pouco agora
(`docs/regulacao.md` 2.2).

**Pronto quando:** teste prova que a escola A não lê, não escreve e não descobre nada da B,
e que um professor com vínculo nas duas não leva dado de uma para a outra.

## MVP de apresentação — A1 a A5 (D71)

> **Ratificado em 23/09/2026** (D71 revista). A direção de cada spec está abaixo; o detalhe
> fecha no PRD dela.
>
> **Concluído em 05/10/2026.** A0, A0b e A1 passaram pelo processo completo, com PRD, Tech Spec e
> `/validar`. A2 a A5 foram feitas como **uma fatia só, com processo enxuto** (D77): contratos
> primeiro, plano e estado em `docs/mvp-rapido.md`, e a branch `mvp/apresentacao` entrou na
> `develop` em 05/10/2026 pelo PR #1 (`13eab64`). O roteiro está em
> `docs/roteiro-da-demonstracao.md`. Daqui em diante o trabalho volta à `develop` com o processo
> completo (D23, D53).

**O roteiro define o escopo.** Uns quinze minutos, com as três áreas e as quatro coisas da D24.
Nada vem pronto: a escola nasce na frente de quem assiste, e tudo o que aparece foi digitado ou
enviado pelo próprio produto, com nomes inventados.

0. **Operação Turmma** cria a rede e a escola no painel e gera o convite da coordenação, que
   copia e manda (A0 e A0b, D76).
1. **Coordenação** aceita o convite, entra com MFA e **monta a escola**: disciplinas, turmas, a
   lista de nomes de cada turma e a alocação dos professores. Sobe o material com a licença
   declarada (D75). O professor recebe o convite e confirma o vínculo; o aluno entra pelo link
   da sala, reivindica o nome, e a professora aprova.
2. **Professora** pede uma atividade ao **Assistente de ensino**; ele pergunta se ela quer a
   ferramenta, abre o cartão, gera com a página citada, salva e exporta em PDF. Ela pede a
   versão adaptada escolhendo o tipo de adaptação, e aprova.
3. **Aluno** responde a atividade e abre o **Tutor**: tenta arrancar a resposta, o Tutor recusa,
   conduz, cita a página e lembra do que ele errou.
4. **Professora** recebe do Tutor que oito travaram no mesmo ponto; o Assistente avisa que
   corrigiu e espera; ela abre os destaques e aprova, com o registro da validação, e vê o
   acerto por habilidade em **Turmas**.
5. **Coordenação** abre a governança: o que a IA gerou e quem aprovou, o que cada função faz
   sozinha, o consumo, e o resumo do **Analista de desempenho escolar**, em agregado.

**Regras da fatia** (D71): dado 100% sintético; código do produto, não protótipo — mesmas
regras 00 a 80 e mesmo processo na A0, na A0b e na A1, e na A2 a A5 o processo enxuto da D77,
que não muda as regras 10, 20, 30, 40 e 70; regra 70 inteira; fora tudo que não aparece no roteiro. **Sem
seed de escola pronta**: a escola é criada por nós no painel da operação (A0) e montada pela coordenação
na tela; os fixtures ficam dentro dos testes. Os quatro afrouxamentos estão aceitos e valem só
enquanto o dado for sintético: AIA com a etapa 1 antes do PRD da fatia, provedor de modelo
qualquer pela porta, cenário de carga sem crescer, e a conta de professor reaproveitada entre
escolas sem prova de posse do e-mail (D71 revista em 25/09/2026). A apresentação roda na nossa máquina; o
staging nasce quando alguém de fora precisar usar sozinho (D31).

Os agentes são os três da D32 revista — Assistente de ensino, Tutor e Analista de desempenho
escolar —, e a pele é uma só, a da D72, com a navegação da D73.

## A0 — `apresentacao-operacao` [x]
Concluída em 24/09/2026, validada em tasks/prd-apresentacao-operacao/validacao.md.
**Depende de:** F1

A identidade do operador Turmma (D76), e a pele da D72 no `apps/web` inteiro. Conta de operador
separada das escolas, criada por comando, com convite, senha e segundo fator obrigatório; sessão
própria de até 8 h, que termina com 30 min parada; nenhuma credencial de escola alcança rota da
operação, e nenhuma de operador alcança rota de escola. Registro de acesso da operação (Marco
Civil) e auditoria da operação para o que muda permissão. As telas do F1 passam aos tokens da D72.

**Pronto quando:** o operador aceita o convite, cria a senha, configura o segundo fator e entra na
casca da operação; teste prova, nos dois sentidos, que credencial de uma área responde na outra
igual a rota inexistente; toda entrada e toda mudança de operador ficam registradas; e o `apps/web`
inteiro está na pele da D72 com o e2e do F1 verde.

## A0b — `apresentacao-painel` [x]
Concluída em 25/09/2026, validada em tasks/prd-apresentacao-painel/validacao.md.
**Depende de:** A0

O painel da operação (D76). Cria rede e escola; gera, revoga e refaz o convite da primeira
coordenação; lista as escolas com estado e contagens (turmas, alunos e professores ativos); e
mostra o uso de infra por escola no dia e no mês, medido desde o F0 (D30). O consumo de IA por
escola entra na mesma tela com a A2. Nada de dado de pessoa da escola (D10), e a leitura entre
escolas é a exceção declarada da regra 10, item 9.

**Pronto quando:** o operador cria rede e escola e copia o convite da coordenação, que abre e ativa
a conta dela; a lista mostra a escola nova com as contagens e o uso do dia; teste prova que nenhuma
resposta do painel traz nome, e-mail, matrícula ou conteúdo de pessoa da escola; e toda ação fica
na auditoria da escola com o operador.

## A1 — `apresentacao-escola` [x]
Concluída em 04/10/2026, validada em tasks/prd-apresentacao-escola/validacao.md.
**Depende de:** A0b

A escola montada pela coordenação, com o núcleo do F2 em fatia fina. Casca da web com a marca
(D72: tokens e logotipo de `mockups/`) e a navegação dos três papéis
(D73), com o seletor de escola que troca o token (P30). A **coordenação** cria disciplinas e
turmas na tela, sobe a lista de nomes de cada turma (colada ou em planilha simples, D3 revista)
e aloca professor × turma × disciplina. O **professor** entra pelo convite e confirma o vínculo
(regra 60, item 8a). O **aluno** entra pelo link da sala, reivindica o nome da lista, define a
senha, e **o professor aprova** (D4). Convite com validade, revogação e reivindicação única
(regra 20, item 8; regra 80, item 7; P27). A escola em si nasce no painel da operação (A0), que
também gera o convite da coordenação (D2, D76).

**Pronto quando:** a partir de uma escola vazia, a coordenação monta duas turmas com lista de
nomes e professor alocado sem ninguém ser cadastrado individualmente; o professor confirma o
vínculo pelo convite; os alunos reivindicam os nomes e o professor aprova; dois alunos
reivindicando o mesmo nome no mesmo segundo não geram duplicidade nem erro cru; cada papel vê a
própria navegação com a marca; e o teste de isolamento do F1 continua verde com as tabelas
novas.

## A2 — `apresentacao-professor` [x]
Concluída em 05/10/2026 na fatia única da D77 (merge da `mvp/apresentacao` pelo PR #1), sem PRD nem `/validar`:
o critério foi a seção 6 de `docs/mvp-rapido.md`, e o estado está na seção Estado dele.
Da direção abaixo não entraram: o consumo de IA no painel da operação, em tokens e em reais (D76; o `custo_micros` fica
em zero, `TODO.md`); um adaptador Ollama separado (o OpenAI-compatível atende o Ollama pelo `/v1`); e o processador na
fila do worker (a execução roda no processo da API, `TODO(fila)`, D77). Os avatares são o círculo com o ícone da
função (`apps/web/src/components/ui/ai/AvatarAgente.tsx`).
**Depende de:** A1

Camada de IA mínima: porta `LLMProvider`, adaptadores Ollama, OpenAI-compatível e falso,
perfis, registro de consumo por escola, validação de schema. Runtime mínimo de agente: thread
por agente, função declarada com a autonomia dela (D9), entrega que nasce pendente, execução
registrada, processador idempotente (D49). Ingestão mínima **pela coordenação** (D75): upload de
PDF com titularidade e licença declaradas, extração, trechos com página, busca; sem licença,
recusa antes de extrair (D5). Home com o **Assistente de ensino**, com contexto de turma e
material, que pergunta antes de abrir a ferramenta (D18) e distingue ferramenta de pedido
(D74). Ferramentas: atividade e prova objetiva, plano de aula, e **Adaptação** por tipo, sem
texto livre sobre o aluno (D67). Artefato salvo, ligado à turma, com a página citada,
exportável em PDF. A casca ganha **Seu time**, com os avatares dos três agentes (D72 revista).

**Pronto quando:** uma chamada de IA passa pela porta e aparece no consumo da escola e no painel
da operação, em tokens e em reais estimados contra o teto por aluno (D39, D76); o
material que a coordenação subiu com licença vira trechos com página, e o sem licença é
recusado; a professora gera o mesmo artefato pelo chat e pelo formulário, com a página citada;
a Adaptação não tem campo em que caiba um diagnóstico, e a versão adaptada nasce pendente.

## A3 — `apresentacao-atividade-e-correcao` [x]
Concluída em 05/10/2026 na fatia única da D77 (merge da `mvp/apresentacao` pelo PR #1), sem PRD nem `/validar`:
o critério foi a seção 6 de `docs/mvp-rapido.md`, e o estado está na seção Estado dele.
A turma aberta ficou com Visão Geral e Alunos; as outras abas (P11, P28) fecham antes do PRD do F6. Não há relatório
em texto da correção nesta fatia.
**Depende de:** A2 · **pode correr em paralelo com A4**

O aluno responde a atividade objetiva no navegador. A **função de correção do Assistente**
corrige, monta o diagnóstico por habilidade e o relatório por questão, e a entrega espera o
professor. Aprovação com os destaques abertos e o **registro da validação** (D33, D56). Sem
`Nota`: é diagnóstico formativo (D46). **Turmas** com o acerto por habilidade (D69, D73); as
abas da turma aberta fecham neste PRD (P11, P28).

**Pronto quando:** o diagnóstico só chega ao aluno depois de aprovado; o lote não libera sem os
destaques abertos, e o registro mostra o que foi apresentado e aberto; a correção roda duas
vezes sem duplicar aviso nem chamada de IA; e nada é gerado por IA sobre resposta discursiva.

## A4 — `apresentacao-tutor-e-sinais` [x]
Concluída em 05/10/2026 na fatia única da D77 (merge da `mvp/apresentacao` pelo PR #1), sem PRD nem `/validar`:
o critério foi a seção 6 de `docs/mvp-rapido.md`, e o estado está na seção Estado dele.
Não entraram a tela do que o Tutor sabe, com a contestação do aluno (D66; a rota `GET /v1/tutor/memoria` existe), nem a
política do Tutor por turma (D19): o Tutor fica ligado para todo aluno com turma (`TODO.md`).
**Depende de:** A2 · **pode correr em paralelo com A3**

**Tutor** socrático restrito ao material da turma, citando a página, com identidade de agente
(D58), mensagem fixa para assunto delicado (D36) e trava durante atividade avaliativa. Memória
lendo o que o aluno já fez no sistema, sem texto sobre a pessoa (D66). Sinais — travou, pediu
resposta pronta, dúvida que se repetiu — chegando à **conversa do Tutor** em "Seu time", para
o professor da turma (D32 revista, D34).

**Pronto quando:** três tentativas diferentes de arrancar a resposta pronta falham no teste; o
Tutor diz o que é quando o aluno pergunta se é uma pessoa; o sinal chega ao professor certo e a
nenhum outro; e nenhum campo guarda texto livre sobre o aluno.

## A5 — `apresentacao-coordenacao` [x]
Concluída em 05/10/2026 na fatia única da D77 (merge da `mvp/apresentacao` pelo PR #1), sem PRD nem `/validar`:
o critério foi a seção 6 de `docs/mvp-rapido.md`, e o estado está na seção Estado dele.
O resumo do Analista é gerado a pedido da coordenação (`POST /v1/analista/gerar`), não toda semana.
**Depende de:** A3, A4

**Governança**: o que a IA gerou e quem aprovou, com o número; cada agente e cada função, o que
faz sozinho e o que espera aprovação, em português comum, com a suspensão por função (D9, D60,
P19); consumo de IA da escola. **Analista de desempenho escolar** com o resumo semanal em
agregado, alerta como hipótese e a regra do grupo mínimo; o nominal só abre com auditoria (D45
revista, D34). O histórico que o feed precisa nasce do próprio roteiro, não de seed, e o
**roteiro de demonstração** fica escrito.

**Pronto quando:** as quatro coisas da D24 aparecem no roteiro, de ponta a ponta, começando de
uma escola vazia; e teste prova que a coordenação não vê indicador nominal de professor sem
deixar auditoria, nem adoção nominal em lugar nenhum.

## X5 — `reengenharia` [x]
Concluída em 23/10/2026, validada em tasks/prd-reengenharia/validacao.md.
**Depende de:** X3 · **vem antes da X4**, que fica congelada até ela pousar

A reengenharia completa do sistema construído com IA, pedida pelo Joaquim em 20/10/2026: o código,
a arquitetura, a estrutura de pastas, os contratos, os testes, a resiliência, as skills, os agentes,
as regras, a orquestração e a documentação, para que o sistema seja legível por humanos sem depender
da IA que o criou, cresça com pouco código, escale em usuários, escolas e equipe sem reescrita, exija
pouca manutenção, com regra verificada por máquina e não por memória, e seja resiliente, com a falha
contida, visível e recuperável. A liberdade é **reorganizar dentro da stack**: refatorar, apagar
código morto comprovado, mover pastas (o plano de 26/09 entra aqui), tornar contratos explícitos e
transformar regra em trava por ferramenta. A stack (D16) e as decisões D1 a D80 não mudam, e trocar
peça de stack vira proposta para depois. As etapas 1 a 6 da missão rodaram numa pasta temporária, na
branch da spec, apagada no fechamento com o que importa em `tasks/prd-reengenharia/` (a tag `reengenharia/temporario`
guarda o resto); cada onda vira tarefas da X5, com o Implementador, a Mesa, os revisores com veto, a
esteira e um pouso. Para nos quatro ⛔ (a entrevista, a linha de base, a arquitetura-alvo e a etapa
de skills, agentes e regras), no pouso e em tudo que é irreversível; no resto segue com a
recomendação e a registra em `tasks/prd-reengenharia/DECISOES.md`. Nada em `.claude/` nem em `tools/processo/` muda antes
das ondas da Etapa 9, salvo o que destrave a própria missão. A missão e as respostas da Etapa 0
estão em `tasks/prd-reengenharia/MISSAO.md` e `RESPOSTAS.md` (onde divergem, vale a segunda).

**Recortada em 22/10/2026 (D81).** A lista tinha 94 tarefas e, no ritmo de 21 e 22/10, acabaria em dezembro. Ficam 32,
na ordem do recorte (`tasks/prd-reengenharia/RECORTE.md`): os defeitos de conformidade da onda 0, o tenant travado por máquina, a
prova que não perde resposta, a entrada pelo `ZodValidationPipe` do NestJS, os jobs tipados, a resiliência (prazo, falha
final, provedor), as pastas do projeto inteiro, as camadas e o lint, a higiene e o guia do desenvolvedor. O resto vai para
a X6. Sexta, 23/10, às 22h nenhuma tarefa nova parte; a meta é o pouso no sábado, 24/10, às 8h. Até o pouso, nenhuma
parada chama o Joaquim: o Arquiteto decide e registra em `tasks/prd-reengenharia/DECISOES.md`, e o pouso com push está autorizado com a
validação aprovada e a esteira verde. A Etapa 9 ⛔ (o harness) foi para a X6: o processo não muda no meio da corrida.
Em 23/10/2026 ela saiu da X6 e virou a X7, antes da X4.

**Pronto quando:** comparado com a linha de base, a tipagem, o lint, as guardas, a unidade, a integração, o e2e e o infra
rodam verdes, com os resultados reais registrados; os defeitos de conformidade da onda 0 estão fechados, com o `ouro` no
alvo; todo repository prova o escopo de tenant ou declara a exceção, e os três da IA tiram a escola do contexto; na prova,
resposta atrasada não sobrescreve a mais nova e a escolha pendente sobrevive ao F5; toda rota valida a entrada pelo
`ZodValidationPipe` e o lint reprova o controller que não valida; todo job tem definição tipada, recusada ao enfileirar e
no worker; job estourado, falha final e provedor fora têm cada um o teste que simula a falha; as pastas seguem uma
convenção só, travada por teste; o que entrou de camadas, catraca, dependências e erro tipado está travado por
ferramenta; o guia do desenvolvedor existe e o `docs/arquitetura.md` diz o que existe; os e2e obrigatórios da regra 40 e
as invariantes das regras 10 e 70 continuam provados; a pasta temporária da missão foi apagada com o que importa migrado; e o
relatório final diz o que foi feito, o que foi medido e o que foi para a X6, sem número que não foi coletado.

## X7 — `harness` [x]
Concluída em 24/10/2026, validada em tasks/prd-harness/validacao.md.
**Depende de:** X5 · **vem antes da X4**, que espera ela pousar; parte depois da correção do `e2e/casca.spec.ts:67`

O `.claude`, as skills e o fluxo do Maestri revistos para o sistema continuar sendo feito com IA sem voltar ao estado
anterior, pedido pelo Joaquim em 23/10/2026. É a Etapa 9 ⛔ da missão da X5 (a 92.0; `tasks/prd-reengenharia/MISSAO.md`,
9.1 a 9.5), que sai da X6. As **skills**, de processo e técnicas, auditadas por objetivo, escopo, conflito, redundância e
desatualização, com os padrões que a X5 fixou (contratos primeiro, resiliência, código morto seguro, testes, pastas,
critério de pronto). Os **papéis** de `.claude/agents/`, cada um com responsabilidade única, critério de saída e entrega
verificável, sem papel novo que não atenda responsabilidade distinta. As **regras** e o `CLAUDE.md`, curtos e
verificáveis, cada regra apontando a checagem que a garante; o que repete `docs/decisoes.md` ou uma skill é medido e
migrado, nunca descartado em silêncio (a P9 da X5 mediu 74.140 B de base fixa, 24,6 KB dela em tabela que repete
`docs/decisoes.md`). O **fluxo do Maestri** (distribuição, mensagens, revisão, validação, estado, vigia), o hook e a esteira
simplificados em mudanças pequenas e verificáveis, sem redesenho. Entram também:

- **a correção de processo das retrospectivas**, que está no `TODO.md`: a P4 e as M1 a M7 da X5
  (`tasks/prd-reengenharia/retro.md`) e as M1 a M3 da X3 (`tasks/prd-telas-do-professor/retro.md`), com teste e revisão;
- **as perguntas "Para a Etapa 9"** da §5 de `tasks/prd-reengenharia/DIAGNOSTICO.md`: o git hook nativo como segunda
  camada; o guardião exigido pelo caminho alterado, e não só pela marcação do Arquiteto (muda a D79); revisão obrigatória
  em `tools/guardas/`, `tools/processo/` e `.claude/` (muda a D53); a tarefa de código sem teste alterado nem mutação
  barrada no portão (regra 40); o fim do caminho `(mvp:)` do hook (D77); o histórico de `achados/` fora do git depois do
  pouso; e a esteira em `pull_request` para a `develop` (D23). A ordem segura de mexer no hook está em
  `.reengenharia/diagnostico/U11.md` §7, na tag `reengenharia/temporario`. Cada uma é do Joaquim, e a que muda decisão vira
  revisão dela. **Respondidas em 23/10/2026**, no terminal do Arquiteto: todas sim, menos o `achados/`, que fica no git
  (revisões da D23, D53, D77 e D79; `tasks/prd-harness/prd.md`).

**Pronto quando:** cada skill, papel, regra, hook e rotina está no lugar e no formato que o Claude Code e o Maestri
**descobrem e executam**, provado por uso e não pela existência do arquivo: a skill é listada e carrega, o papel sobe com
`claude --agent` e o modelo certo, o hook dispara e bloqueia o commit que deve bloquear, a regra carrega pelo `paths:`
dela; os metadados estão corretos e nada se contradiz entre `CLAUDE.md`, regras, skills, papéis e `docs/decisoes.md`; toda
regra aponta a checagem que a garante; a P4 e as M1 a M7 da X5 e as M1 a M3 da X3 estão feitas, cada uma com o teste que
a prova; cada pergunta "Para a Etapa 9" tem resposta do Joaquim, aplicada ou registrada; e a base fixa que toda sessão
carrega está medida antes e depois.

## X8 — `nomes-de-mercado` [~]
**Depende de:** X4 · **parte depois que a X4 pousar e vem antes do F2**

A D81 aplicada ao código que já existe (revista em 24/10/2026, a pedido do Joaquim). Primeiro, um inventário completo
das peças técnicas com nome em português em `apps/` e `packages/` (adaptadores, executor, agendador, repositórios em
memória, fila, limitador, erros, utilitários), com o nome de mercado de cada uma; o Joaquim aprova o inventário (⛔)
antes de qualquer rename. Depois, o rename mecânico, em ondas por pacote. O conceito de domínio fica em português, pelo
glossário: turma, nota, ferramenta, artefato, entrega, função, autonomia, orçamento e os nomes dos agentes. "Ferramenta"
não vira `Tool`: no nosso código o modelo não chama função, e `Tool` fica para quando houver function calling. **Não
mudam:** tabela e coluna do banco, rota HTTP, código de erro, texto de tela e `tools/processo/`.

**Pronto quando:** nenhuma peça do inventário aprovado tem nome em português; uma guarda recusa, em código novo, os
prefixos e sufixos técnicos em português do inventário (`Adaptador…`, `…EmMemoria`, `Agendador…`); a tipagem, o lint, as
guardas, a unidade, a integração e o e2e rodam verdes antes e depois, com o diff só de nome; e o guia do desenvolvedor
(§9), o `docs/arquitetura.md` e o README da camada de IA (`packages/nucleo/src/ia/README.md`) usam os nomes novos.

## A pele nova — X1 a X4 (D80)

> **Decidido em 12/10/2026** (D80). O Gabriel redesenhou o produto inteiro em mockup, de 04 a
> 07/10/2026, e o Joaquim pediu o produto igual a ele, com foco no visual e sem perder o que já foi
> construído. São quatro specs fora da sequência, que vêm **antes do F2**, cada uma com o processo
> completo e pouso próprio. O mockup de referência é o de `Prototipo_Turmma` (branch
> `mockups/interface`, commit `a95568d`); nada de lá é copiado para o `apps/web`, menos o traço da onça
> (D80, revista em 28/10/2026).

**O que as quatro têm em comum.** Nenhuma muda regra de negócio, permissão nem contrato da API, fora
o que a X4 declara. Toda tela continua com os quatro estados, com o e2e que já prova a regra dela e
com o que a lei pede e o mockup afrouxou (D80, item 7). O que o mockup mostra e depende de dado ou de
fase que não existe **não é construído aqui**: fica na fase dele, que encolhe (o "Já existe" de cada fase diz o que chegou pronto).

## X1 — `pele-e-casca` [x]
Concluída em 16/10/2026, validada em tasks/prd-pele-e-casca/validacao.md.
**Depende de:** F3

A pele e a casca do produto inteiro. Os tokens novos, no claro e no escuro, com a escolha de
aparência; a tipografia, o degrau e o movimento; as peças de base revestidas (botão, campo, cartão,
selo, aviso, diálogo, abas, tabela) e as novas (linha clicável, ladrilho, segmentado, toque,
interruptor, progresso, painel ao lado, número grande, estado vazio com a onça); a onça e os ícones
ilustrados; a galeria com tudo, nos dois temas; os tipos de página com título visível; a casca nova da
escola (lateral branca com os lugares, trilho, barra de topo e barra de baixo no celular, menu da
pessoa com "Sair" à vista), a pública e a da operação. As telas continuam com a estrutura, os itens e
os endereços de hoje: mudam de pele pelas peças e pelos tokens, e os lugares de cada papel são
reagrupados na spec da área.

**Pronto quando:** toda tela do `apps/web` aparece na pele nova, no claro e no escuro, sem cor fora
dos tokens, sem `oklch(` nem `color-mix(` no CSS servido e com o contraste de cada par de texto
conferido por teste; a pessoa escolhe a aparência e a escolha vale na próxima visita, sem a tela
piscar; cada papel navega pela lateral nova e, no celular, pela barra de baixo quando os itens cabem
nela; nenhum endereço muda; "Sair" está a um clique em toda tela; o primeiro carregamento continua
dentro do teto; e o e2e inteiro que existia continua verde, nos projetos `chromebook` e `celular`.

## X2 — `telas-da-coordenacao` [x]
Concluída em 17/10/2026, validada em tasks/prd-telas-da-coordenacao/validacao.md.
**Depende de:** X1

As telas da coordenação e da operação, recompostas como no mockup, com o que o produto já sabe.
**Painel**: o que espera a coordenação e os números que o produto mede (o que a IA gerou e quem
aprovou, o consumo, o que falta para terminar a escola). **Analista**: o resumo de hoje, na página
de conversa, sem perguntas livres. **Escola**: Turmas, Professores e Material como abas, a lista em
tabela com linha clicável, a alocação no painel do professor e a lista da turma. **Registros**: IA
(com "Como cada IA trabalha" ao lado) e os pedidos dos titulares, com retenção, empresas e incidentes
a um clique. O **sino** com "Esperando você" da coordenação. A **operação** numa página com Escolas e
Uso. Frequência, nota do diário, APOIA, Analista em conversa, Avisos, Auditoria, Exportar, Dossiê e
Configurações da escola ficam nas fases deles.

**Pronto quando:** a coordenação faz, pelos quatro lugares e pelo sino, tudo o que faz hoje pelos
sete itens, sem nenhum caminho mais longo que o de hoje; nenhuma tela mostra indicador nominal de
professor nem contagem de grupo pequeno que o servidor já não mostrasse (D45, D64); cada tela cabe em
1366 × 768 sem rolar a página e funciona a 360 px; e o e2e da A0b, da A1, da A5 e do F3 continua
provando as mesmas regras.

## X3 — `telas-do-professor` [x]
Concluída em 19/10/2026, validada em tasks/prd-telas-do-professor/validacao.md.
**Depende de:** X1 · **pode correr em paralelo com X2**

As telas do professor, recompostas como no mockup. **Início**: a saudação com a onça, a caixa de
pedido e os atalhos das ferramentas que existem. **Conversa** e cartão da ferramenta na pele nova.
**Ferramentas**: o catálogo por categoria (D74) e o formulário com a folha "Como vai sair".
**Criados**: o que a professora já gerou, por turma, com o estado, e o documento aberto em folha.
**Turmas**: os cartões e "Confirme sua turma"; a turma aberta em **Hoje, Atividades e Alunos**, com o
acesso da turma e os pedidos de nome num diálogo. **Aprovar** na pele nova, com a ação oficial em
grafite. O **sino** com "Esperando você" do professor, que recebe o que hoje mora em "Seu time"
(entregas esperando e sinais do Tutor). A aula ao vivo, a visão Semana, o histórico de conversas e as
ferramentas novas ficam nas fases deles.

**Pronto quando:** a professora faz, pelos quatro lugares e pelo sino, tudo o que faz hoje; nada do
que estava em "Seu time" some, e o lote continua sem liberar com destaque fechado (D33, D56); a tela
do professor não ganha ranking, tempo ocioso nem texto livre sobre aluno; cada tela cabe em 1366 ×
768 e funciona a 360 px; e o e2e da A1 à A4 continua provando as mesmas regras.

## X4 — `telas-do-aluno-e-primeiro-acesso` [x]
Concluída em 26/10/2026, validada em tasks/prd-telas-do-aluno-e-primeiro-acesso/validacao.md.
**Depende de:** X1 · **pode correr em paralelo com X2 e X3**

As telas do aluno, e a primeira vez de cada papel. **Início**: o Tutor com a onça, a faixa de que o
professor acompanha e as tarefas em que ele ajuda. **Tarefas**: Para fazer, Entregues e Corrigidas,
e a tarefa aberta. **Eu**: como estou indo, por assunto, do que o professor já aprovou, e a porta
para Privacidade ("Meus dados", do F3) e para os ajustes de aparência e de tamanho de letra. E a
**introdução** de aluno, professor e coordenação: o que a IA é e que pode errar, quem vê o quê, e o
tamanho da letra, uma vez por pessoa, com "Rever a introdução". É a única das quatro que grava dado
novo: a data em que a pessoa viu a introdução. A introdução da operação e a da rede não entram.

**Pronto quando:** o aluno faz, pelos lugares novos, tudo o que faz hoje, com "Sair" à vista e a
faixa de supervisão presa; nenhuma tela do aluno mostra dado de colega, sequência de dias, pontos ou
ranking (D59; regra 50, item 9); a introdução aparece uma vez por pessoa, pode ser pulada onde não
é aviso obrigatório e pode ser revista; o aviso de privacidade está em linguagem de 11 anos; e o e2e
do aluno e das páginas públicas continua provando as mesmas regras.

## F2 — `onboarding-por-convite` [ ]
**Depende de:** F1

Conferido contra o código em 24/10/2026. **Já existe** (A1): séries, turmas e disciplinas na tela; a lista de nomes por turma, colada ou em CSV,
até 200 linhas; a alocação professor × turma × disciplina feita à mão; o convite do professor com validade, uso
único e revogação; o link da sala, com a reivindicação aprovada pelo professor; e o teste dos 35 alunos
reivindicando no mesmo minuto sem duplicidade nem erro cru.

**Falta:** importar **grade horária e calendário**, que passam a definir a alocação (D3 revista), e o lugar
"Grade e calendário" no menu de Escola, que não existe (hoje são Turmas, Professores e Material); a escola
inteira em escala, com alunos e professores em lote e planilha suja; o reset de senha do aluno pelo
coordenador; a entrada do aluno pela conta da escola (o login Google e Microsoft existe, mas aluno sem ligação
não entra; D48); e o Classroom como adaptador opcional, no fim. **Entra aqui o que era o F8**: a visão
**Semana** em Turmas, com a rotina por escola e turma ligada a avaliações, entregas e ao que os agentes
concluíram.

**Pronto quando:** uma escola inteira entra sem ninguém ser cadastrado individualmente, professor incluído;
a grade e o calendário importados geram a alocação; o coordenador redefine a senha de um aluno, com
auditoria; e o professor abre a semana e vê o que precisa fazer sem cadastrar nada.

## X6 — `reengenharia-continuacao` [ ]
**Depende de:** X5 · **não segura a X4 nem o F2**

É a dona da fila de IA do F11 (42.0 e 47.0) e do gateway do F5 (49.0 e 50.0): as duas fases esperam essas partes
dela, e não as refazem.

O que a X5 deixou de fora no recorte de 22/10/2026 (D81), registrado para não se perder. As tarefas guardam o número da
X5, e a lista está em "Saíram para a X6" de `tasks/prd-reengenharia/tasks.md`, com o desenho nos `onda-<n>.md` (revisto
pela D81 onde ela diz). Entra também o que a regra do corte da X5 deixar fora. Cada parte entra no momento dela:

- **Antes do portão do piloto:** a IA e o PDF no worker (42.0, 45.0 a 47.0, 49.0, 50.0), o prazo do cliente com "Tentar
  de novo" (52.0) e o Redis fora sem gastar tentativa (54.0)
- **Junto da X4 ou do F2:** a onda 4, de tela (55.0 a 80.0): a rede de teste da web, a cobertura por pasta e o corte das
  telas grandes
- **O resto:** o OpenAPI, pelo `@nestjs/swagger` 12, quando houver consumidor fora do `apps/web` (no lugar do registro de
  rotas próprio, 21.0 a 23.0); a web tolerante ao campo extra (20.0); as políticas em `conformidade/`, com a mutação por
  padrão e a trava do `ouro` (26.0 a 29.0); os subcaminhos e as leituras prontas da onda 2 (30.0 a 32.0, 37.0 a 41.0); a
  onda 5 (81.0 a 89.0, 91.0). A Etapa 9 ⛔ (92.0), com as perguntas "Para a Etapa 9" do
  `tasks/prd-reengenharia/DIAGNOSTICO.md`, saiu daqui em 23/10/2026 e é a X7 (`harness`)

**Pronto quando:** cada parte cumpre o critério do RF dela no PRD da X5 (`tasks/prd-reengenharia/prd.md`, §5 e §11),
com o processo completo; o OpenAPI só entra com o consumidor que o pede.

## F3 — `lgpd-e-titular` [x]
Concluída em 11/10/2026, validada em tasks/prd-lgpd-e-titular/validacao.md.
**Depende de:** F1 · **pode correr em paralelo com F4 e F5**

Três fatias, no recorte de 05/10/2026 (PRD, `tasks/prd-lgpd-e-titular/prd.md`):

- **Retenção e expurgo.** Cada escola tem um prazo por categoria do mapa de `docs/lgpd.md`, que a
  operação ajusta por comando, dentro de piso e teto; a coordenação lê os prazos em linguagem
  comum; e uma rotina noturna apaga, por escola, o que venceu, fora do horário letivo. O registro
  de acesso (6 meses, Marco Civil) e a auditoria têm prazo fixo
- **Suboperadores e incidente.** A operação registra por comando as empresas que recebem dado e
  os incidentes; a coordenação vê os da escola dela e confirma o recebimento do aviso
- **Pedido do titular.** A coordenação registra e conduz o pedido de acesso, portabilidade,
  compartilhamento, correção e eliminação de aluno ou professor. O arquivo sai em formato aberto
  para o próprio titular, em "Meus dados", e a eliminação vem 7 dias depois, cancelável até lá.
  Cada passo fica na auditoria da escola

Seed sintético. **Saíram no recorte, cada um com a fase dele:** a exportação da escola em
formato aberto (D63) foi para o F12; o canal de notificação de violação (D61), para o F9 e o
F12; e o registro da validação humana como entidade geral (D56), para o F6. O que depende de
parecer (ECA Digital, arts. 17, 18 e 24, e o que a escola guarda mesmo com a eliminação) não
mudou nada aqui e segue em aberto (PRD, seção 10).

**Pronto quando:** um pedido de acesso e um de eliminação são atendidos pela coordenação, sem
nós, com rastro: o arquivo sai em formato aberto para o titular, e a eliminação apaga no 8º dia
tudo que o mapa não manda guardar; todo dado pessoal sai no prazo da escola, por rotina noturna
que não toca outra escola nem o horário de aula, com a classificação de toda tabela conferida
por teste; a escola vê a retenção, os suboperadores e os incidentes que a afetaram, e confirma o
recebimento; e nada do que a coordenação vê separa o professor que usou a IA do que não usou
(D64), nem a conversa do professor chega a ela. Ver `docs/lgpd.md` seção 7.

> Esta funcionalidade parece burocracia e é a que protege o negócio. Não empurre para o fim.

## F4 — `ingestao-do-material` [ ]
**Depende de:** F1

Conferido contra o código em 24/10/2026. **Já existe** (A1): upload de PDF pela coordenação, com titularidade e licença declaradas (D5
revista, D75); recusa sem licença antes da extração; extração em fila; trecho por página, com rastreio até a
página citada; e busca textual. O "Pronto quando" original está cumprido.

**Falta:** classificar o material por série, capítulo e habilidade BNCC (hoje só por disciplina), para a
geração usar; trecho menor que a página, se a busca pedir; versionamento e reprocessamento, que exigem guardar
o arquivo (hoje ele não é guardado: rever com `docs/mvp-rapido.md` seção 4 e com o mapa de `docs/lgpd.md`);
autorização da escola por fonte; e o painel agregado do estado da ingestão. A extração no worker é da X6
(45.0 e 46.0). A porta de fonte com adaptador de scraper sai daqui: só entra com escola real, fonte definida e
licença do dono do conteúdo (D22), depois do portão.

**Pronto quando:** o material é classificado por série e habilidade BNCC e a geração usa isso; um material
trocado por versão nova é reprocessado, e o artefato antigo continua apontando a página da versão que citou;
e a coordenação vê num painel o estado de toda a ingestão da escola.

## F5 — `camada-ia` [ ]
**Depende de:** F0 · **paralelo com F1–F4**; o gateway vem da X6

Conferido contra o código em 24/10/2026. **Já existe** (A2, X5): a porta `LLMProvider`; o adaptador OpenAI-compatível, que atende o Ollama e o
`llama-server` pelo `/v1` (não haverá adaptador Ollama próprio), e o falso; os perfis; a validação de schema,
com uma repetição; o prazo por perfil com disjuntor; o consumo em tokens por escola, na governança; a troca de
provedor por variável de ambiente; e o pacote do Tutor por turma, com freio diário (D38).

**Vem da X6:** o gateway com limite de tokens por minuto e a degradação para modelo menor (49.0), a prioridade
da IA pelas filas, com o Tutor em sala na frente do lote (47.0), e a subida que recusa provedor sem
processamento no Brasil (50.0).

**Falta aqui:** o roteamento por soberania em cada chamada (a tarefa já declara `levaTextoDeAluno`, e ninguém lê
a marca), com o teste de que texto de aluno não sai para provedor fora do Brasil (D62); o provedor de reserva
(D29); o teto por escola e o custo em reais (o `custo_micros` fica sempre em zero); o consumo de IA no painel da
operação (D76); a avaliação de modelos de `docs/avaliacao-de-modelos.md` executada, com os critérios
eliminatórios da seção 3.1 e o principal e a reserva registrados (D37); e, se o teste de carga pedir, cache e
streaming simulado no adaptador falso.

**Pronto quando:** com o limite estourado, o pedido interativo espera e degrada em vez de falhar (com a X6);
teste prova que prompt com texto de aluno não sai para provedor fora do Brasil; a escola tem teto e custo em
reais; e a avaliação de modelos foi executada, com principal e reserva registrados (D37, D62).

## F6 — `avaliacao-e-correcao` [ ]
**Depende de:** F4, F5

Conferido contra o código em 24/10/2026. **Já existe** (A3, X3, X5): atividade objetiva a partir do material, com página citada; gabarito que
nunca vai ao aluno; aplicação e encerramento, com a flag `avaliativa` travando o Tutor; correção pela conta do
gabarito; diagnóstico por habilidade; relatório por questão; aprovação em lote com os destaques abertos antes
e o registro da validação (`validacao_do_lote`, D56); resposta salva por item, sem a atrasada sobrescrever a
mais nova; retomada após queda; e **Turmas**, com as abas Hoje, Atividades e Alunos e o acerto por habilidade
(D69, D73).

**Falta:** a **prova online de verdade**: duração e prazo no relógio do servidor, extensão pelo professor,
tela de foco, versões (A/B, embaralhamento) e a saída da aba mostrada só ao professor, com o aluno avisado e
sem consequência automática (D70); a **discursiva e a redação**: rubrica e critérios antes da aplicação,
organização do lote e correção cega, **sem a IA corrigir, avaliar, dar nota, conceito ou devolutiva, nem como
rascunho para o professor** (D55); em Turmas, a evolução no tempo e os alunos que precisam de atenção, com os
indicadores de turma e aluno fechados antes do PRD, e as abas que faltam (P11 e P28 de
`docs/pendencias-dos-mockups.md`); e as etapas 2 a 6 das AIA da correção e do diagnóstico (D60). A nota
oficial e o boletim ficam no F17.

**Pronto quando:** uma queda de rede no meio de uma prova com tempo não perde resposta nem tempo do aluno;
teste prova que a contagem de saídas da aba não existe fora de avaliação nem somada por aluno; a discursiva
tem rubrica, lote e correção cega, e **nenhum campo do sistema guarda nota, conceito ou devolutiva de
discursiva gerada por IA**; e o professor vê em Turmas quem precisa de atenção, pelo indicador decidido.

## F7 — `chat-e-ferramentas-professor` [ ]
**Depende de:** F6

Conferido contra o código em 24/10/2026. **Já existe** (A2, X3): Início em chat com o **Assistente de ensino**, com contexto de turma e
material; um motor só para chat e formulário, em que o chat propõe a ferramenta e pergunta antes (D18);
atividade objetiva (é a "prova" do MVP); plano de aula, com duração fixa em 50 minutos; **Adaptação** por
tipo fixo, sem campo em que caiba diagnóstico e sem PEI (D67); artefato salvo e ligado à turma; PDF; Criados,
com filtro por tipo, turma e estado; e o catálogo nas quatro categorias (D74).

**Falta:** as ferramentas lista, sequência didática, **material didático**, **apresentação**, simulado ENEM
com o banco público de questões das provas oficiais do INEP (D21), **rubrica por competência para redação e
discursiva — sem correção, sem nota e sem devolutiva gerada por IA** (D55), e a atividade de letramento em IA,
alinhada às 12 aprendizagens do MEC e às habilidades de Computação da BNCC (D65); a prova como tipo próprio, se
o F6 pedir; a duração do plano como campo; a Adaptação oferecida também pela conversa; **PPTX e XLSX** (D67);
**busca na web ligada pelo professor, por conversa**, com a fonte rotulada (D68); o histórico de conversas em
lista; e a biblioteca além de Criados. Navegação em `docs/interface.md`.

**Pronto quando:** cada ferramenta nova funciona pelo chat e pelo formulário, com o chat perguntando antes; o
artefato sai nos três formatos; a busca só roda ligada pelo professor e rotula a fonte; e a Adaptação continua
sem campo em que caiba um diagnóstico.

## F9 — `ambiente-do-aluno` [ ]
**Depende de:** F6 · a busca em fontes aprovadas espera a busca na web do F7

Conferido contra o código em 24/10/2026. **Já existe** (A4, X4): o Tutor socrático, com a conferência que descarta a resposta pronta; o escopo
da turma, com teste de isolamento; a trava durante avaliação; a identidade de IA, que nunca se passa por pessoa
(D58); nenhum mecanismo de uso excessivo (D59); a memória do trabalho do aluno, só de lote aprovado (D66); a
mensagem fixa com o 188 e o sinal de atenção humana ao professor da turma; os três testes que tentam arrancar
a resposta pronta; os sinais do Tutor (quem travou, quem pediu resposta pronta, dúvida que se repetiu) na aba
Hoje da turma, relidos a cada 15 s; e o tempo real (`apps/realtime`), com adaptador Redis provado em duas
instâncias. A X4 entrega a casca do aluno, o aviso de privacidade em linguagem de 11 anos e o "Como estou
indo" por tarefa.

**Falta:** a política por turma e o acesso fora da sala, desligado por padrão (D19), com o **modo casa**
registrando e resumindo para o professor; a tela do que o Tutor sabe, com contestação, e o contexto
estruturado do professor e o tipo de adaptação entrando na memória (D66); o desempenho próprio por assunto;
a **busca em fontes aprovadas**, com as duas chaves, só em sala e continuando socrático (D68); "Avisar um
adulto" (D61), a entrada do aluno no canal de notificação de violação, que fecha no F12; o encaminhamento de
assunto delicado a quem notifica o Conselho Tutelar, com o acesso ao conteúdo auditado (D36,
`docs/regulacao.md` seção 7); o filtro de conteúdo inadequado; a linguagem do 6º ano ao Ensino Médio provada
por teste (D43); e as etapas 2 a 6 das AIA do Tutor e dos sinais (D60). **Entra aqui o que era o F10**: o
canal por turma no tempo real, a API publicando o sinal nele, a aba Hoje e o sino trocando a releitura pelo
envio, e o que a turma pesquisou. Onde o sinal aparece — na conversa do Tutor (D32 revista) ou na aba Hoje,
como a X3 fez — se decide antes do PRD.

Herdado do F1: **a leitura do próprio histórico pelo aluno** (turmas de anos encerrados) ficou
para cá. No F1 ela seria só a lista de turmas passadas, sem nota nem entrega, e o valor aparece
junto do desempenho próprio. Hoje o aluno tem `turma.ler`, `turma.listar`, `aluno_da_turma.ler`
e `vinculo.ler_proprios` em `nunca` na `MATRIZ`, e `?anoLetivoId` com token de aluno é 404: a
tarefa que abrir isso muda a célula, cria rota e DTO próprios, e traz o teste que quebra sem a
cláusula de `usuario_id` do contexto (validação do F1, 20/09/2026).

**Pronto quando:** "pesquisa e resume para mim" também falha no teste; uma página da web com instrução
escondida não muda o comportamento do Tutor; a busca é recusada no servidor sem as duas chaves; nenhum campo
guarda texto livre sobre o aluno; o modo casa só existe na turma em que a escola ligou; a AIA do Tutor está
completa; o encaminhamento de risco à vida chega a quem notifica, com o acesso ao conteúdo auditado; e o
professor acompanha a turma ao vivo sem ler conversa, com o sinal chegando pelo tempo real, em duas
instâncias, só ao professor certo.

## F11 — `agentes` [ ]
**Depende de:** F7, F9 e a fila da X6

Conferido contra o código em 24/10/2026. **Já existe** (A2 a A5): os três agentes da D32 revista; a função com autonomia declarada e visível
(D9); a entrega pendente, com o portão de aprovação; a execução registrada e idempotente pela chave de envio;
a suspensão por função numa escola sem desligar o resto; a correção de objetiva e a Adaptação. Os três
"Pronto quando" originais estão cumpridos, fora de fila.

**Vem da X6:** o runtime na fila do worker, com entrega ao menos uma vez (42.0 e 47.0, D49).

**Falta aqui:** thread para o Tutor e para o Analista, e os não-lidos; o limite de passos e de custo por
execução; "seu dia e sua semana" do Assistente, que lê a grade do F2; o Analista disparado por evento; e as
etapas 2 a 6 das AIA de cada função de alto risco, com a revisão do Gabriel e o procedimento de suspensão
(D60). O encaminhamento de assunto delicado (D36) fecha no F9.

**Pronto quando:** uma execução que passa do limite de passos ou de custo para e avisa, sem gastar mais; o
Assistente abre o dia e a semana do professor a partir da grade; e o Analista roda por evento sem duplicar
aviso nem chamada de IA.

## F12 — `governanca-do-coordenador` [ ]
**Depende de:** F6, F9, F11

Conferido contra o código em 24/10/2026. **Já existe** (A5, X2): a governança com a autonomia de cada função, suspender e retomar; o consumo em
tokens; o resumo do **Analista de desempenho escolar** a pedido, com o alerta de habilidade com acerto baixo;
a regra dos dois professores no recorte e o nominal só com finalidade e auditoria (D45 revista), com os testes
de que a coordenação não vê nominal sem deixar auditoria nem adoção nominal em lugar nenhum (D64); e o Painel,
os Registros e "Como cada IA trabalha".

**Falta:** a tela de **Auditoria**, que responde "o que a IA gerou e quem aprovou" (o backend grava, e nenhuma
rota lê); o uso de IA por série e disciplina; a comparação da turma com a série; os outros alertas, formulados
como hipótese (média fora da curva, habilidade em queda, aluno em risco, D34), com indicadores, limiares e
texto decididos antes do PRD; o **painel do professor** com o próprio uso; o resumo semanal do Analista; o
resumo da AIA em cada função de alto risco (D60); **Conformidade** (o dossiê da escola num lugar: propósito,
faixas etárias, funcionamento em linguagem simples, LGPD e ECA artigo por artigo, relatório de uso exportável,
material de comunicação); **Denúncias**, com o canal de notificação de violação, retirada de conteúdo e
recurso, dizendo se a análise foi humana ou automatizada (D61, ECA arts. 28 a 30), cuja entrada do aluno nasce
no F9; e **Exportar** dado, artefato e histórico de uso em formato aberto, feito pela própria coordenação, com
o fim de contrato e o expurgo da auditoria (D63). **Sem ranking, sem lista nominal de adoção e sem alerta de
professor que não usa** (D64).

**Pronto quando:** a escola responde "o que a IA faz aqui e quem aprovou" em uma tela e **imprime o dossiê que
a secretaria pede** a partir dela; a coordenação exporta tudo em formato aberto sem depender de nós; uma
notificação de violação percorre o caminho até a resposta, com recurso; e os testes de nominal com auditoria e
de adoção nunca nominal continuam passando nas telas novas.

> É o que nenhum concorrente entrega. Não trate como painel secundário.

## F13 — `eventos-e-notificacoes` [ ]
**Depende de:** F6, F11

Conferido contra o código em 24/10/2026. Nada do motor existe. O sino do professor e o da coordenação (X2, X3) são calculados das filas
pendentes, e passam a ler o evento gravado.

Motor de eventos (nota aprovada, tarefa não entregue, aluno travado) e notificação interna para professor e
coordenador. A família e o WhatsApp consomem isto depois, sem refazer nada.

**Pronto quando:** eventos são emitidos e roteados, com canal plugável, e o sino lê deles.

## F14 — `governanca-de-rede` [ ]
**Depende de:** F12

Conferido contra o código em 24/10/2026. **Já existe:** a tabela `rede` e o papel de rede na `MATRIZ`, sem usuário nem rota.

**Falta:** consolidado por escola, comparativo, adoção agregada e exportação. **Nunca dado individual de aluno
ou de professor, nunca conversa.**

**Pronto quando:** teste de rota, e não só da matriz, prova que a rede não alcança nota individual nem conversa
de tutor.

## F15 — `demonstracao` [ ]
**Depende de:** F12, F13, F17

Conferido contra o código em 24/10/2026. **Já existe** (A5): o roteiro com as quatro coisas da D24 (`docs/roteiro-da-demonstracao.md`), rodando
no e2e; o material de exemplo com licença (`npm run demonstracao:material`); e um comando que sobe o ambiente
vazio.

**Falta:** o seed **sintético** de uma escola completa, que um comando sobe: turmas dos anos finais e do Ensino
Médio, professores, alunos fictícios, grade e calendário, um bimestre de atividades com diagnóstico e notas, e
o feed de agentes com atividade recente. Pode nascer de `tools/vitrine/` e das fixtures do e2e, apontando para
o banco da demonstração. Onde ela roda (na VM, num espaço de escola fictícia, ou noutro ambiente) se decide no
PRD.

**Pronto quando:** um comando sobe a demonstração povoada, as quatro coisas da D24 aparecem nela, e o feed
nunca aparece vazio.

## F17 — `nota-oficial-e-boletim` [ ]
**Depende de:** F6, F11, F13

Conferido contra o código em 24/10/2026. **Já existe** (A3): o lote com os destaques abertos antes de aprovar e o registro da validação
(`validacao_do_lote`), que a nota reaproveita; e o teste de que não existem as tabelas `nota` e `boletim`, que
este F troca pela regra 70.

**Falta:** a `Nota` com autor humano obrigatório; a nota oficial das objetivas proposta pela correção do
Assistente e aprovada em lote com destaques (D33); a nota das discursivas dada pelo professor, sem valor
sugerido (D46, D55); o boletim; o evento "nota aprovada" no motor do F13; e a exportação das notas aprovadas
no formato de importação do sistema de gestão da escola. Revisita a regra 70 com o texto final do CNE
publicado.

**Pronto quando:** nenhum caminho grava `Nota` sem autor humano, o lote não libera sem abrir os destaques, e
as notas aprovadas saem num arquivo que o sistema de gestão importa.

## F18 — `producao-na-vm` [ ]
**Depende de:** F0 (concluída). Corre em paralelo com F2 a F5

A produção do Turmma passa a rodar em **VM própria** (máquina AM5 com Proxmox, operada pelo
Joaquim, em casa), em vez de nascer no provedor da D42, e migra para a AWS depois — decisão de
14/10/2026, registrada em 24/10/2026 como revisão da **D26, D31 e D42** (homologação opcional, pode nem existir).
Três fatias: **1.** a VM de produção — compose de sempre, só a borda exposta pelo túnel da
Cloudflare com Access, deploy e rollback ensaiados, dado sintético enquanto o portão não
abre (regra 20); **2.** backup diário fora da VM, snapshot antes de deploy e restauração
executada de verdade; **3.** o **painel de recursos** no Grafana (`infra/grafana`), com CPU,
memória e disco por VM e por contêiner, alertas (disco 80%, memória 90%, CPU 85% no horário
letivo, backup vencido) com runbook e aviso no celular. **PRD ainda não criado** — entra
quando a fase começar.

**O deploy é automático** (pedido do Joaquim em 24/10/2026): o merge na `main`, com a esteira verde, sobe
sozinho na VM, sem ninguém digitar nada. Fora do horário letivo, sai na hora; dentro dele, espera a janela
(D27, regra 80). Troca uma API de cada vez, com migration que expande e depois contrai, e volta sozinho para
a versão anterior se o `/saude` não responder.

**Pronto quando:** um merge na `main` chega à VM sem passo manual, e um merge em horário letivo
espera a janela; a VM sobe sozinha depois de um desligamento e `/saude` responde em até
5 min; o deploy troca uma API de cada vez e o rollback volta em 2 min; uma restauração de
backup foi executada em VM nova e cronometrada; e o painel de recursos mostra as três VMs
com alerta ensaiado chegando ao celular.

## F16 — `hardening-e-conformidade` [ ]
**Depende de:** F15, F17, F18

Conferido contra o código em 24/10/2026. **Já existe** (F0, F3, A1, X5): a guarda de log sem dado pessoal, no lint e no redact do logger; os
cenários de k6 de login das 7h30, reivindicação em sala e justiça entre escolas; 14 alertas, com a guarda de
runbook e o ensaio; o incidente com alerta e e2e; e as suítes de isolamento por módulo.

**Falta:** o teste de carga "manhã de segunda" combinado (com o Tutor em 60 turmas no ritmo de `docs/infra.md`
seção 3.2, a prova com queda de rede e a ingestão em volume); a varredura de autorização por objeto em todas
as rotas; o backup criptografado com restauração executada de verdade; o RIPD; o processo de incidente
ensaiado e registrado; as entradas do runbook ainda "a preencher"; a **AIA de cada funcionalidade de alto
risco** revista e assinada (D60); o **dossiê de conformidade** fechado (D61); e o **teste adversário do
tutor** — tentativa de desativar salvaguarda, de arrancar conteúdo inadequado e de sair do escopo. O teste de
página da web com instrução escondida não espera até aqui: nasce no F9, junto da busca (D68). Deploy e
rollback ensaiados vêm do F18.

**Pronto quando:** a restauração foi executada de verdade, o RIPD e as AIA existem assinados, o dossiê está
pronto para entregar a uma escola, e o teste de carga de `docs/infra.md` seção 10 passa no ambiente que
substitui o staging.

## Portão da primeira escola real

Independente de onde o roadmap estiver, **nenhum dado real de escola entra em produção**
antes de cumprir a lista de `docs/infra.md` seção 11: teste de carga, restauração de backup
executada, alertas com runbook, deploy e rollback ensaiados, contrato com provedor de
modelo com limite compatível com o pico, que permita serviço usado por menor, vede treinamento
e garanta **processamento no Brasil para conversa de aluno** (D62), e os itens de LGPD do F3 e
do `TODO.md`. Somam-se: **RIPD**, **AIA das funcionalidades de alto risco** que o piloto usar,
**aviso de privacidade em linguagem de faixa etária**, **canal de notificação** funcionando, e
o **parecer sobre o art. 24 do ECA Digital** — se a leitura ampla prevalecer, aluno de até 16
anos só entra com conta de responsável vinculada (`docs/regulacao.md` 2.2). Soma-se também a **prova de posse do
e-mail** antes de uma conta de professor cruzar escolas (D71 revista em 25/09/2026), com o teste de que
`convites/consultar` e `/aceitar` respondem igual para e-mail com e sem conta, e de que a senha definida pelo link de
uma escola não abre a conta no convite de outra. O piloto do 1º semestre de 2027
vem antes do F16 (D1 revista), então esses itens são puxados para antes dele.

A **VM de produção** do F18 (deploy automático pela `main`, check externo, backup fora da VM) existe antes
da primeira demonstração a alguém de fora ou do piloto, o que vier primeiro, e faz o papel que era do
staging (D31 revista). O provedor de nuvem é escolhido na migração (D42).

---

## Fase posterior (decidida, fora do alvo atual)

- `portal-da-familia` — interface do responsável sobre o motor de F13
- `canal-whatsapp` — depende de aprovação da Meta, com prazo próprio
- Educação infantil e anos iniciais — reavaliar a regra 70 antes (o recorte atual é anos
  finais e Ensino Médio, D43)

## Paralelismo

- O MVP de apresentação (A1 a A5) veio logo depois do F1 e está concluído: a A2 a A5 correram
  numa fatia só, na branch `mvp/apresentacao`, com os pacotes em paralelo (D77), e entraram na
  `develop` em 05/10/2026 (`13eab64`). F2 e F3 são as primeiras depois dele, de volta à
  `develop` com o processo completo (D23, D53), e o F2 completa o que a A1 começou
- F5 corre desde o início, independente do domínio; a fatia mínima dela nasceu na A2
- F3 corre em paralelo com F4 e F5, e **não pode ser a última**
- F13 pode correr junto de F12; a fila do F11 e o gateway do F5 chegam pela X6
- F17 (nota oficial) corre depois de F6, F11 e F13, em paralelo com F12 e F14, e antes do F15
- O teste de carga começa no F0 com um cenário mínimo e cresce a cada funcionalidade do
  caminho quente (F2, F5, F6, F9), em vez de nascer inteiro no F16
- F18 (`producao-na-vm`) corre em paralelo com F2 a F5, não depende de nenhuma delas e é o
  que substitui o staging (D31 revista)
