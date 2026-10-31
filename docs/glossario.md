# Glossário

O vocabulário do domínio escolar brasileiro, que usamos no código, no banco e na interface.

A razão de existir este arquivo: metade dos bugs de domínio nasce de duas pessoas chamando
a mesma coisa por nomes diferentes. Quando um módulo diz `class` e outro diz `turma`,
ninguém percebe que são a mesma coisa até o comportamento divergir em produção.

**Regra prática:** termo novo entra aqui na mesma tarefa em que aparece no código.

---

## Estrutura da escola

**Rede** — Prefeitura, secretaria, grupo educacional ou mantenedora. Camada opcional acima
da escola. Uma escola particular independente é modelada como rede de uma unidade só, para
não existirem dois fluxos diferentes no código.

**Escola** — A unidade. É o tenant: todo dado pertence a uma escola e nunca cruza para
outra.

**Endereço da escola** — O `slug` público da escola (`colegio-horizonte`), único no sistema, em
minúsculas e com hífen. É por ele que o aluno chega à tela de entrada da escola (`/e/:slug`).

**Ano letivo** — O recorte anual. Turma, vínculo e nota pertencem a um ano letivo. Nada no
sistema é perpétuo, porque em janeiro tudo vira.

**Período** — Bimestre, trimestre ou semestre, conforme a escola. Configurável, porque cada
rede faz diferente.

**Série** — Ano escolar dentro do recorte: 6º ao 9º ano do Ensino Fundamental (anos
finais) e 1º, 2º ou 3º ano do Ensino Médio (D43).

**Turma** — O agrupamento concreto de alunos dentro de uma série: 2ºB. Existe dentro de um
ano letivo.

**Disciplina** — A matéria: Química, História.

---

## Pessoas

**Coordenador** — Coordenação ou direção. Decide a compra e administra o sistema na unidade:
cria turmas, sobe listas, convida professores, aprova o que precisa de aprovação
administrativa, e é quem enxerga a governança.

**Professor** — Quem usa mais e quem pode matar o produto. Não paga nada.

**Aluno** — Usa no computador da escola, em sala. Não tem e-mail nem telefone no sistema;
quando entra pela conta da escola, guardamos só o identificador opaco dela (D48).

**Responsável** — Pai, mãe ou responsável legal. Tem conta própria, vinculada ao aluno. É o
canal de contato, porque o aluno não é.

**Vínculo** — A ligação de uma pessoa a turma e disciplina, com papel, dentro de um ano
letivo. É o vínculo que responde "esta turma é dele?". Criado pela escola e confirmado
pelo professor, nunca autodeclarado (D3 revista).

**Matrícula** — O identificador do aluno dentro da escola, e o login dele. Única por escola,
nunca globalmente.

**Lista de nomes** — A lista que a coordenação sobe por turma, antes de os alunos entrarem.
Cada nome tem estado: livre, reivindicado, aprovado.

**Reivindicação** — O ato do aluno de dizer "este nome da lista sou eu", pendente de
aprovação do professor.

**Acesso da turma** — O link da sala e o código da turma, que o professor com vínculo confirmado gera para os alunos
chegarem à lista de nomes e pedirem o próprio nome. Os dois valem juntos, por 1, 7 ou 30 dias, e a turma tem um acesso
só: "Gerar novo" derruba o anterior, também o de outro professor da turma. Aparecem uma vez, quando são gerados.

**Link da sala** — O endereço `/e/<slug>/turma` com o token do acesso no fragmento. É de uso múltiplo: a turma inteira
usa o mesmo, e o que é único é a reivindicação de cada nome.

**Código da turma** — Os oito caracteres do acesso, sem os que se confundem na lousa (0, 1, I, L, O), mostrados em dois
grupos de quatro. O aluno o digita no endereço da sala, no lugar de abrir o link.

**Conta** — A credencial global de quem é da equipe (professor, coordenador): e-mail, senha e segundo fator. Uma
conta tem um usuário em cada escola onde trabalha. Aluno não tem conta.

**Usuário** — A pessoa numa escola, com um papel ali (coordenador, professor ou aluno). É o `sub` do token: a mesma
professora em duas escolas é um usuário em cada uma, com a mesma conta.

**Papel** — O que a pessoa é naquela escola: coordenador, professor ou aluno. A rede também é papel na matriz de
permissão, sem usuário no F1.

**Sessão** — O acesso aberto de um usuário numa escola, gravado no banco, com prazo absoluto e inatividade. Toda
requisição confere a sessão: encerrada ou com o usuário desativado, o acesso acaba na requisição seguinte.

**Matriz de permissão** — A tabela única de papel × recurso × ação que diz quem chama cada rota, com o alcance:
nunca, próprio, turma vinculada, unidade, agregado ou nominal com auditoria (`packages/shared`, `MATRIZ`).

**Alcance** — Até onde uma célula da matriz de permissão chega: o que é da própria pessoa, as turmas com vínculo, a
escola inteira, só números somados, ou a pessoa identificada com registro em auditoria.

**Convite** — Link com token único, validade e uso único. Existe em dois tipos: convite de
professor e link de sala.

---

## Aulas e material

**Grade horária** — A tabela de tempos de aula da escola.

**Tempo de aula** — Um slot: segunda, 3º tempo, 09h20 às 10h10.

**Alocação** — Turma, disciplina e professor em um tempo de aula. É o que gera o calendário
do professor.

**Aula** — A instância concreta de uma alocação numa data, onde o professor registra o que
deu.

**Fonte de material** — De onde o conteúdo vem: um adaptador de scraper ou upload manual.
Toda fonte tem autorização escrita da escola registrada e declara a titularidade do
material; material de terceiro só entra com licença do dono (D5 revista).

**Licença de material** — A permissão do dono do conteúdo (editora, sistema de ensino) para
usar o material na base da escola. A autorização da escola sozinha não basta.

**Material** — Apostila, livro ou documento ingerido, com versão.

**Trecho indexado** — O pedaço de material que a busca recupera, com a página de origem.
É o que permite citar "capítulo 7, página 152".

**Habilidade BNCC** — O código curricular usado para classificar material e questão. Tabela
pública, sem dono.

**Banco público** — Questões sem dono, visíveis a todas as escolas, vindas das provas
oficiais do ENEM publicadas pelo INEP. Nunca se mistura com material de escola.

---

## Avaliação

**Avaliação** — Prova, trabalho ou atividade avaliativa. Sempre tem um modo.

**Modo** — Como a avaliação é aplicada e corrigida. Cinco valores: online objetiva, online
discursiva, papel com foto, trabalho de entrega, presencial. O professor escolhe por
avaliação.

**Item** — Uma questão dentro de uma avaliação, com pontuação e ordem.

**Aplicação** — A instância de uma avaliação para um aluno específico.

**Resposta** — O que o aluno respondeu em um item.

**Correção** — A pontuação de uma resposta, com feedback. Pode vir de correção automática,
de IA ou do professor. **É aqui que a IA escreve — e só em item objetivo.** Em discursiva e
redação a correção é sempre do professor: a IA não corrige, não pontua e não escreve
devolutiva sobre o texto do aluno, nem como rascunho (D55).

**Diagnóstico** — O resultado formativo por habilidade de uma atividade ou avaliação.
Existe antes da nota oficial e não vai para o boletim (D46).

**Devolutiva** — O comentário formativo sobre a resposta do aluno, o que ele acertou e o que
precisa rever. Não é nota.

**Nota** — O valor oficial, que vai para o boletim. Só existe com autor humano. **A IA nunca
escreve aqui.**

**Folha de resposta** — A folha impressa, com código que identifica aluno e avaliação sem
depender de reconhecimento de nome.

---

## IA e agentes

**Agente** — Um especialista de IA com thread própria, nome e escopo, que atende uma pessoa da
escola. Prepara o trabalho quando o evento acontece e avisa; o que vale passa por aprovação ou
supervisão (D44). Não é um botão nem um prompt salvo. O nome é a função, e são três (D32
revista em 23/09/2026): Assistente de ensino, Tutor e Analista de desempenho escolar e, na fase
posterior, Mensageiro da família.

**Função do agente** — O que um agente faz, com o nível de autonomia e o selo de alto risco
declarados um a um (D9 e D60 revistas). A escola suspende uma função sem desligar o agente.
Lista em `docs/agentes.md`.

**Assistente de ensino** — O agente do professor: a identidade do chat da Home e a cara das
ferramentas. Trabalha pelas funções de conversa e ferramentas, seu dia e sua semana, correção de
objetiva e adaptação. Não é "Monitor": essa palavra não nomeia agente nenhum.

**Seu dia e sua semana** — A função do Assistente de ensino que abre o dia e a semana do
professor com o que já existe, sem gerar conteúdo; plano de aula só sob pedido. Antes era o
agente Planejador, que tinha absorvido o Rotina.

**Correção de objetiva** — A função do Assistente de ensino que corrige objetivas e monta o
diagnóstico por habilidade; a entrega espera o professor. Antes era o agente Corretor.

**Adaptação (função)** — A função do Assistente de ensino que propõe a versão adaptada de prova,
atividade ou material a partir do tipo de adaptação registrado; espera o professor aprovar.
Antes era o agente Adaptador. A ferramenta de mesmo nome é o pedido feito pelo professor (D67).

**Analista de desempenho escolar** — O agente da coordenação: resumo semanal e alertas em
agregado, como hipótese. Antes, "Analista da coordenação".

**Ferramenta** — Um fluxo guiado que produz um artefato: prova, atividade, material didático,
apresentação, plano de aula, adaptação, simulado, rubrica de redação. Funciona como formulário ou como cartão dentro do chat, com
o mesmo motor nos dois.

**Artefato** — O que uma ferramenta produz e salva na biblioteca, ligado à turma e ao
calendário, citando material e página. Exporta em PDF, PowerPoint e Excel (D67).

**Feed de agentes** — "O que o Assistente fez", que o professor abre pelo pé do sino: o Assistente é uma thread, com as
entregas dele. O Tutor não tem thread: o pé do sino ("O que o Tutor viu") leva à aba Hoje da turma, onde ele fala em soma, sem
nome, e onde o painel "O que o Tutor viu" mostra por aluno. Nunca aparece vazia para professor com turma.

**Entrega** — O que um agente produziu e que aguarda decisão humana. Nasce pendente.

**Nível de autonomia** — O que o agente pode fazer sozinho: executa e registra, executa e
avisa, propõe e espera aprovação, ou nunca faz. Ver `docs/agentes.md`.

**Perfil de IA** — A classe de tarefa que define qual modelo será usado: rápido, padrão,
complexo ou visão.

**Orçamento de IA** — O limite de consumo por aluno, turma e escola, com aviso antes do
corte. Configuração por escola e por rede, nunca visível ao aluno como crédito.

**Adaptação necessária** — O que precisa mudar numa prova ou atividade para um aluno:
linguagem direta, resposta escrita no lugar da oral, fonte ampliada, tempo extra, enunciado
simplificado. Registrada pela coordenação, sempre como tipo de adaptação. Nunca o diagnóstico,
nunca texto livre sobre o aluno (D35, D67).

**Pacote do tutor** — As trocas com o tutor disponíveis para uma turma no mês, somadas entre
os alunos, com freio diário por aluno.

**Início (do aluno)** — O primeiro dos três lugares do aluno e a tela em que ele abre (`/aluno/inicio`): a faixa de
supervisão, presa e sem botão de fechar, e a escolha da atividade em que quer ajuda do Tutor. O Tutor deixou de ser um
lugar da lateral; o endereço `/aluno/tutor` continua abrindo a mesma escolha, dentro do Início. Não confundir com a
página "Início" da raiz (`/`), que não tem conteúdo próprio e leva cada papel à tela em que abre (o aluno, a este
Início).

**Tarefas** — O segundo lugar do aluno (`/aluno/atividades`, o endereço de sempre): o que o professor atribuiu à turma,
com o estado de cada uma em texto. Era "Atividades"; o termo `atividade` continua nos dados, na API e dentro da tarefa
aberta, e **tarefa** é o nome na navegação e no título da lista (X4).

**Eu** — O terceiro lugar do aluno (`/aluno/eu`): a turma, a série e a escola dele e as linhas Privacidade ("Meus dados") e
Sair. Tomou o lugar de "Minha turma", cujo endereço leva até ele. Só do próprio aluno, sem colega (regra 50, item 9).

**Tela de foco** — A tela em que a casca some a lateral e as barras e deixa só o conteúdo, o "Sair" e o relógio de
inatividade. Os endereços estão em `ehTelaDeFoco` (`apps/web/src/paths.ts`): hoje, a introdução de cada papel
(`/<área>/bem-vindo`).

**Introdução** — Os passos que cada papel vê na primeira entrada (`components/introducao/Introducao.tsx`): a onça
acenando ou apontando, a fala como título, o conteúdo e os botões "Continuar" e "Pular", iguais. Aviso não se pula na
primeira vez; revendo, todo passo tem "Fechar". Os textos de cada papel são das tarefas 9.0 a 11.0.

**Balão** — A caixa da fala da onça numa introdução; a fala é o título (`h1`) da tela.

**Comemoração** — A onça de corpo inteiro dando um salto, uma vez, depois do envio confirmado de uma tarefa; parada com
"reduzir movimento", sem som e sem número (`components/ui/Comemoracao.tsx`, D59).

**Pose (da onça)** — Uma das três formas do corpo da onça: acenando, apontando e comemorando (`components/ui/onca/Onca.tsx`).
O rosto é o neutro da cabeça em todas, e só o corpo muda. "Acolhendo" não existe.

**Tutor** — O agente que conversa com o aluno. Conduz por perguntas e não entrega a
resposta. É o mesmo agente que avisa o professor, na thread dele, o que viu no uso da turma.

**Memória do Tutor** — O que o Tutor sabe do aluno ao longo do ano: tudo que ele fez no sistema
— atividades, trabalhos, avaliações, práticas e sessões —, com resultado por habilidade,
evolução e o que o professor pediu para reforçar. É registro do trabalho, que o aluno vê e
contesta. Nunca texto sobre o jeito do aluno (D66).

**Fontes aprovadas** — A lista de sites em que o Tutor pode pesquisar para o aluno quando a
escola liberou e o professor ligou a busca para a turma. Lista padrão nossa, por faixa etária,
que a escola ajusta. Web aberta não entra (D68).

**Política de tutor** — A regra da turma sobre o que o tutor pode responder: bloqueado,
socrático ou livre. Definida pelo professor, aplicada no servidor.

**Modo sala** — Aula em andamento, com o professor acompanhando a turma ao vivo.

**Modo casa** — Uso fora da aula, com registro e resumo para o professor, sem tempo real.
Só existe na turma em que a escola ligou o acesso fora da sala. Desligado por padrão.

**Sinal** — O que o professor vê do uso do tutor: quem travou, quem pediu resposta pronta,
qual dúvida se repetiu, quem concluiu o que foi atribuído. É uso e dificuldade, não
comportamento: tempo ocioso e navegação do aluno não são sinal (D69).

**Saída da aba** — Durante uma avaliação online, o fato de a aba da prova ter perdido o foco,
contado por avaliação e mostrado só ao professor. Não diz para onde o aluno foi, não tem
consequência automática, não existe fora de avaliação e não vira histórico do aluno (D70).

**Turmas** — O item do menu do professor em que ele vê as turmas dele: desempenho,
dificuldades e alunos que precisam de atenção, e "Meu uso", o espelho dele (D45). Antes era a aba
"Minhas turmas" de "Meu painel", que deixou de existir (D73). No MVP de apresentação a turma
aberta tem Visão Geral e Alunos; as outras abas fecham antes do PRD do F6. O F6 a completa (D69).

**Indicador do professor** — Medida de uso e do desempenho das turmas de um professor.
Visível primeiro a ele; a coordenação vê agregado, só quando há dois ou mais professores no
recorte, e abre o nominal com auditoria. Nunca é
nota do professor nem base de decisão sobre ele (D45).

**Pacote** — A faixa contratada pela escola: base (assistente do professor, organização,
desempenho e governança) ou completo (com tutor). Não confundir com pacote do tutor (D50).

---

## Outros

**Biblioteca** — O acervo do professor: provas, planos e materiais que ele produziu.

**Evento** — O fato registrado no sistema: nota aprovada, tarefa não entregue, aluno
travado. É o que alimenta notificação e painel.

**Auditoria** — O registro consultável de quem fez o quê: leitura de dado de aluno,
exportação, alteração de nota, aprovação de saída de IA. Diferente de log.

**Operador Turmma** — A pessoa da nossa equipe que cria rede, escola e o primeiro coordenador,
pelo painel da operação (A0, D76) ou pelos comandos `ops:*`, sempre com o próprio identificador
gravado na auditoria. Tem conta própria, separada das escolas, e vê uso e custo por escola, mas não
lê dado de pessoa da escola nem entra como usuário dela (D2, D10). Não confundir com "operador" da
LGPD, que é a empresa.

**Titular** — A pessoa a quem o dado pessoal se refere, no vocabulário da LGPD. Quase sempre
um menor de idade, aqui.

---

## Conformidade

**ECA Digital** — A Lei 15.211/2025, que protege criança e adolescente em ambiente digital,
em vigor desde 17/03/2026, regulamentada pelo Decreto 12.880/2026. Recai sobre nós
diretamente, como fornecedor, independente de a escola ser a controladora do dado.

**RIPD** — Relatório de Impacto à Proteção de Dados Pessoais, da LGPD, exigido também pelo
art. 16 do ECA Digital. Descreve o tratamento e avalia o risco.

**AIA** — Avaliação de Impacto Algorítmico. Mais ampla que o RIPD: além do risco de
tratamento de dado, olha viés, equidade e impacto pedagógico da decisão automatizada. Seis
etapas, uma por funcionalidade de alto risco (D60, `docs/conformidade-mec.md` seção 7).

**Alto risco** — Na classificação do CNE, o uso de IA que interfere em avaliação, decisão
acadêmica ou dado sensível. Aqui: correção de objetiva, diagnóstico por habilidade, sinais do
tutor, alertas sobre aluno e adaptação. Exige validação humana qualificada e documentada.

**Validação qualificada e documentada** — A exigência do CNE para correção com apoio de IA: o
professor precisa ver o que está validando, e o sistema precisa guardar o que mostrou, o que
ele abriu e quem confirmou (D56). Um clique em "aprovar" não satisfaz.

**Dossiê de conformidade** — O conjunto de documentos que a escola exige do desenvolvedor:
declaração de propósito e faixas etárias, funcionamento em linguagem simples, conformidade com
LGPD e ECA Digital, RIPD, AIA, relatório de uso legível e material de comunicação com a
comunidade (D61).

**Child Rights by Design** — Marco da 5Rights Foundation (2023), com onze princípios, que o
MEC adapta como checklist de contratação de tecnologia educacional
(`docs/conformidade-mec.md` seção 4).

**Descarregamento cognitivo** — O efeito de o aluno delegar o raciocínio à IA e não aprender.
É o risco que o tutor socrático e a reflexão obrigatória existem para evitar, e que o MEC
manda a escola prevenir.

**Letramento em IA** — Aprender **sobre** IA, não só **com** IA: como funciona, quais os
limites e riscos, como avaliar criticamente o que ela produz. Exigência curricular do CNE,
articulada à Educação Digital e Midiática (Resolução CNE/CEB 2/2025) e atendida por nós em
três pontos pequenos (D65).

**Sandbox regulatório** — Ambiente controlado de testagem, iniciado por chamamento público,
que o MEC recomenda às redes para experimentar IA com segurança jurídica. É o formato natural
do nosso piloto na rede pública (`docs/conformidade-mec.md` seção 10).
