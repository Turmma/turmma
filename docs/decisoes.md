# Decisões tomadas

> Texto completo das decisões D1 em diante, com o motivo e as revisões, e, no topo, os conflitos já
> resolvidos. O `CLAUDE.md` tem uma linha por decisão (número e título) e aponta para este arquivo e para
> `docs/decisoes-em-aberto.md`. Nova decisão ou revisão entra aqui e no índice do `CLAUDE.md`, pelo
> `/registrar-decisao`.

## Conflitos já resolvidos

Registrados porque cada um deles já voltou uma vez.

**Login do aluno.** A reivindicação de nome é o *cadastro*. O *login* recorrente é escola +
matrícula + senha, definida pelo aluno no momento da reivindicação. Aluno não tem e-mail no
sistema. Onde a escola tem conta Google ou Microsoft, o login e a importação vêm dela, e
guardamos só o identificador da conta, nunca o e-mail (D48).

**Notificação à família.** O motor de eventos entra agora; a interface do responsável e o
WhatsApp ficam para depois.

**Importação por planilha.** Sobrevive, reduzida: a coordenação sobe lista de nomes por
turma, grade horária e calendário, não cadastro completo de pessoa (D3 revista). Professor
e aluno entram por link.

**Scraper de material.** Permitido, com cinco condições: licença ou parceria com o dono do
conteúdo, autorização escrita da escola registrada no sistema, credencial fornecida pela
escola, conteúdo preso ao tenant dela, e nada que contorne pagamento ou bloqueio técnico de
terceiro. Fonte que proíbe sai, e **o upload não cobre o caso**: apostila de terceiro sem
licença não entra por nenhum caminho (D5 revista). O primeiro caminho implementado é o
upload de material com licença (D22).

**Correção de discursiva e redação.** Voltou em 19/09/2026 e ficou mais restrita: a IA não
corrige, não avalia, não dá nota nem conceito, e **não faz pré-correção nem sugere nota ao
professor** — o que derruba a devolutiva rascunho de discursiva como estava desenhada (D55,
revisão da D46). Rubrica, organização do lote e correção cega continuam. A devolutiva
formativa volta à mesa quando o texto oficial do CNE for publicado e lido com advogado.

**Nome do produto.** Fechado: Turmma (D54). Não é mais "nome provisório". O que continua
aberto é registro no INPI e domínio, e o código segue com `educa`.

**Tutor e aprovação prévia.** O tutor é supervisionado, não aprovado resposta por resposta.
A regra 70, item 3, declara essa exceção (D47).

**Fila de jobs.** A auditoria de 13/09/2026 propôs trocar por fila só no Postgres. Ficou
como está, com entrega pelo menos uma vez e idempotência obrigatória (D49).

**Processo de construção.** A mesma auditoria propôs teto de tamanho por tarefa, assinatura
humana no portão e revisor de simplicidade. Os vetos e o portão de qualidade no processo
ficaram (D23). O commit direto no `main` caiu em 19/09/2026, com a terceira pessoa no código, e em
21/09/2026 o fluxo foi fixado: **o trabalho acontece na `develop`**, `release` e `main` recebem por
merge que o Joaquim gerencia, o Gabriel abre branch própria e integra na `develop`, e a esteira roda
nas três (D23 revista). Em 15/09/2026 o processo foi enxugado onde repetia trabalho, sem tirar revisão:
`test-engineer` primeiro (revisto pela D79: os revisores rodam juntos), caducidade pelo que o revisor audita, portão local com carimbo,
`revisor-geral` no lugar da autorrevisão, `/revisar-spec`, `/corrigir` e `/retro` (D53). Em 08/10/2026
o processo passou a rodar no Maestri (D78): cada spec num andar com a branch `spec/<funcionalidade>`,
que entra na `develop` por pouso; a esteira uma vez por spec, antes do pouso (revista pela D79: em todo push); um comando, `/seguir`;
e a Mesa de revisão chamando os revisores. O hook, os vetos e o portão local não mudaram. **Papel de
agente vem de `.claude/agents/`, nunca de responsabilidade do Maestri:** com ela o agente nasce fora
da raiz e nenhum hook dispara. Em 11/10/2026, com o F3 medido, o processo foi revisto para tempo
(D79): o opencode, testado em duas tarefas, saiu, e as tarefas que não se tocam passaram a correr ao
mesmo tempo, em linhas.

**Nome de peça técnica e mecanismo próprio.** Fechado em 22/10/2026 (D81): a peça técnica tem o nome do framework, em
inglês (`TurmaController`, `ZodValidationPipe`), e o conceito do domínio fica em português, pelo glossário. Mecanismo
próprio só com o motivo escrito. O que já existe com nome em português é renomeado de uma vez na X8, depois da X4
(D81 revista em 24/10/2026); "ferramenta" é domínio e fica.

**Nome dos agentes.** O desenho da call tinha nomes próprios; os docs usam função. Fica a
função (D17).

**Lista de agentes.** Eram sete; em 19/09/2026 viraram seis (D32 revista): o chat do professor
ganhou identidade, o **Assistente de ensino**; o Monitor de turma se dissolveu; e o Planejador
absorveu o Rotina. Em 23/09/2026 viraram **três, um por pessoa da escola** (D32 revista de
novo): Assistente de ensino, Tutor e Analista de desempenho escolar. Corretor, Planejador e
Adaptador viraram **funções do Assistente**, porque cada um tinha uma ferramenta gêmea que
chamava o mesmo caso de uso; a autonomia e a suspensão passaram a ser por função (D9, D60).
"Monitor" não é nome de agente: servia a duas coisas diferentes.

**Medir o professor pela turma.** A estrutura de 19/09/2026 pedia que o Analista analisasse o
professor pelo resultado dos alunos e cada aluno individualmente. Fica dentro da D45 e da D34:
o indicador do professor deriva do desempenho das turmas dele, ele vê primeiro, a coordenação
vê agregado só com dois ou mais professores no recorte e abre o nominal com auditoria. Sem
ranking, sem decisão sobre ele, sem adoção nominal (D64).

**Adaptar sem gerar o PEI.** Voltou duas vezes em 19/09/2026. O plano individual é obrigação da
escola (LBI, art. 28, VII; Decreto 12.686/2025), feito pela equipe dela; o que a lei pune é
recusar matrícula ou recusar adaptação (Lei 7.853, art. 8º; LBI, arts. 4º e 88). Adaptar prova
e atividade a partir do **tipo de adaptação** é o que a lei quer, e não depende de o sistema
gerar o documento. Não geramos o PEI por minimização de dado sensível (D35, D67), a confirmar
com advogado junto da base legal da adaptação (`TODO.md`).

**MVP.** Não existe MVP de venda (D1). Existem duas coisas diferentes: o **MVP de apresentação**
(D71), logo depois do F1, com dado sintético, para demonstrar o fluxo completo; e a **fatia do
piloto**, com escola real em 2027, que só entra depois do F2, do F3 e do portão da primeira
escola real. **Sem seed de escola pronta** (D71 revista em 23/09/2026): a demonstração começa
com a escola criada por nós no painel da operação (A0, D76) e montada pela coordenação na tela,
com nomes inventados. Sintético é o dado, não o caminho. A A2 a A5 saíram numa fatia só, com
processo enxuto (D77), e entraram na `develop` em 05/10/2026 (`13eab64`); o processo completo
voltou para o F2, o F3 e o portão do piloto. A composição de cada spec ficou no PRD da A1 e, da
A2 a A5, no `docs/mvp-rapido.md`; o documento que a coordenação sobe na demonstração é um PDF
original nosso, gerado por `tools/demonstracao/` (D75, D5).

**Pele do produto.** Voltou quatro vezes: a da landing page (rejeitada vendo), a do ChatGPT (P02), a
cópia da Teachy (P31) e, em outubro de 2026, o sistema que o Gabriel desenhou no estilo do Duolingo.
Fica **uma só**, a de outubro, em todas as telas (D80): a técnica é tomada, a marca não (mascote,
cores, ícones e fonte são nossos), e a mecânica de uso compulsivo fica de fora por lei (D59). Onde o
mockup afrouxa uma proteção que o produto já tem, vale o produto. A identidade visual (paleta,
tipografia, ícones, mascote) **não está em aberto**: a D80 a fechou, e texto de skill, de regra ou de
documento que a dê como pendente perde para ela. Desde 30/10/2026 o mockup é referência, não alvo (D80 revista): a pele
é a do produto, e muda por decisão. A onça entrou na tela de entrar na mesma noite como **onça da marca**, sem assinatura
e num lugar fechado, depois com um canto de sala parado, onde ela não dá aula (D80 revista). O laço dela, seja piscar, respirar ou balançar o rabo, já foi vetado duas vezes, e o veto vale
para a onça, não para uma tela: pedir "mais vida" numa tela não o reabre.

**Vigiar a navegação do aluno.** Pedido em 19/09/2026: alertar o professor quando o aluno sai
do sistema para usar outra IA, e medir tempo ocioso. Ficou: saída da aba só durante a prova,
como fato, só para o professor (D70); "concluiu o que foi atribuído" no lugar do tempo ocioso
(D69); e bloquear outras IAs é configuração da escola, com guia nosso no dossiê.

**Escola particular ou rede pública.** As duas, como alvo juntas desde o início, com a rede
em pacote com piso de preço (D20 e D41 revistas).

**Chromebook.** Deixou de ser filtro de mercado: vale qualquer computador da escola. Continua
como referência de máquina fraca para desempenho (D43, regra 50).

**Celular.** O produto não depende do celular em nenhum fluxo, mas toda tela funciona nele
(D51). "Sem dependência de celular" e "responsivo para celular" não se contradizem: o
primeiro é sobre o que o fluxo exige, o segundo sobre onde a tela funciona.

## As decisões

> **D54 a D71 estão ratificadas.** Saíram em 19/09/2026 da leitura das fontes de regulação e
> da estrutura de agentes por papel; o Gabriel ratificou as dele no mesmo dia, e o Joaquim
> ratificou todas em bloco em 23/09/2026. No mesmo dia entraram a D72 a D75, que fecham o que a
> revisão dos mockups pedia antes do PRD da A1, e a D32, a D9, a D60, a D69 e a D71 foram
> revistas. O que ainda depende de parecer (D55, D68, D70) ou de outra decisão (D62 com a D37)
> está dito em cada uma, abaixo.

Cada uma com o motivo, porque decisão sem motivo é decisão que volta.

**D1 — Sistema inteiro, não MVP fatiado.**
A venda acontece em reunião de coordenação e em assembleia de pais, e o que convence é o
fluxo completo. Um pedaço não vende. Construímos por partes, com o sistema completo como
alvo, e não cortamos escopo por conta própria.
Revista em 13/09/2026: o alvo continua sendo o sistema inteiro, mas uma escola piloto
gratuita entra no 1º semestre de 2027 usando o que já estiver pronto, antes do F16. O
portão da primeira escola real (LGPD e infra) vale antes dela, não só no fim. Motivo:
nenhuma escola usou o produto ainda, e construir as 17 fases antes de ver uso real é o
maior risco de construir o que a escola não quer. Piloto gratuito não é vender pedaço.
Revista em 19/09/2026: entra um **MVP de apresentação** logo depois do F1 (D71). O alvo
continua sendo o sistema inteiro; o que muda é que, antes de completar cada fase, construímos
uma fatia fina e real do fluxo de ponta a ponta, com dado sintético, para demonstrar. Motivo:
é a própria razão desta decisão — o que convence é o fluxo completo —, e pela ordem antiga o
fluxo completo só existiria no F15. MVP de apresentação não é MVP de venda: ninguém usa de
verdade antes do F2, do F3 e do portão da primeira escola real.

**D2 — O cliente é a instituição. Não existe cadastro público.**
Sem self-service, sem plano avulso de professor. O dado limpo que faz os agentes
funcionarem vem da escola, não do que o usuário digita.

**D3 — Onboarding por convite, sem cadastro individual.**
Coordenação cria séries e turmas e sobe a lista de nomes. Professor entra por link e escolhe
a disciplina. Aluno entra pelo link da sala, reivindica o próprio nome, e o professor aprova.
Cadastrar novecentos alunos um a um mataria o produto na primeira semana.
Revista em 13/09/2026: a coordenação também importa a grade horária e o calendário escolar
no onboarding, e aloca professor × turma × disciplina (ou a alocação vem da grade
importada); o professor entra por link e **confirma** o vínculo, não escolhe. Um usuário
pode ter vínculo em mais de uma escola. Motivo: disciplina escolhida pelo professor dava
acesso a alunos por autodeclaração (regra 10, item 4), e sem grade o Rotina e o calendário
não têm de onde derivar (regra 60, item 8). Importar não é digitar, então a D24 continua
sem trabalho manual. Onde a escola tem conta Google ou Microsoft, o login e a importação
podem vir de lá (D48).

**D4 — A identidade do aluno passa por aprovação humana.**
Deixar o aluno digitar o nome livremente cria dois "Enzo Martins" e um "Batman". A
reivindicação aprovada resolve isso sem burocracia.

**D5 — Sem integração com sistema de ensino. Pipeline único de ingestão.**
O scraper do material que a escola já paga e o upload manual de PDF desembocam no mesmo
caminho. Se uma fonte mudar de layout, a escola sobe a apostila e continua funcionando no
mesmo dia. Condições legais da ingestão em `docs/regulacao.md` seção 5.
Revista em 13/09/2026: só entra material cuja licença permita o uso: apostila e material
próprios da escola, material do professor, livro licenciado para esse uso, domínio público
e provas oficiais do ENEM. Buscamos parceria com editora e sistema de ensino. Apostila de
terceiro sem licença do dono do direito não entra, por upload ou por scraper. Motivo: a Lei
9.610 (art. 29, IX) exige autorização do autor para incluir a obra em base de dados, a
escola não é dona desse direito, e termos como os do Plurall vedam reproduzir e transferir
o conteúdo. A autorização da escola continua registrada, mas não basta sozinha.

**D6 — Indexação por série, disciplina, capítulo e habilidade da BNCC, com rastreabilidade
até a página.**
Uma questão que o professor confere na página 152 da apostila dele tem valor. Uma questão
genérica é o que ele já consegue de graça.

**D7 — Nota nunca é publicada sem aprovação humana.**
Exigência do CNE, e também a única forma de o professor confiar no sistema. A nota oficial
entra depois do diagnóstico formativo (D46).

**D8 — O tutor do aluno é sempre visível ao professor.**
Modo sala com acompanhamento ao vivo, modo casa com registro e resumo. Exigência do CNE
para classificar o tutor como risco moderado, e o que sustenta a conversa com a família.

**D9 — Todo agente tem nível de autonomia declarado e visível.**
A coordenação precisa poder responder "o que essa IA faz sozinha?" apontando para uma tela.
Ver `docs/agentes.md`.
Revista em 23/09/2026: a autonomia é declarada **por função** do agente, não por agente
("corrigir objetiva: faz e avisa, a nota espera você"; "adaptar: prepara e espera você
aprovar"), com o selo de alto risco quando a função tem AIA (D60), e aparece assim na tela da
coordenação. Motivo: com a D32 revista, o Assistente de ensino faz coisas de risco muito
diferente, e um rótulo único por agente esconderia justamente a que o CNE classifica como alto
risco.

**D10 — A escola é controladora dos dados; nós somos operadores.**
Padrão B2B, com o consentimento coberto por contrato. Ver `docs/lgpd.md`.

**D11 — WhatsApp e portal da família ficam para depois, mas o motor de eventos entra agora.**
O motor é o que alimenta o painel da coordenação de qualquer forma. Adiar só a interface
significa que a fase seguinte pluga sem refazer nada. A aprovação da API oficial do WhatsApp
tem prazo próprio de semanas, então começa cedo mesmo sem ser usada já.

**D12 — Backend e frontend separados, multi-tenant por escola, nada travado em fornecedor.**
Hospedagem indefinida e possível exigência de dado em território nacional. Tudo em
container.

**D13 — IA por porta e adaptador, com Ollama local no desenvolvimento.**
Teste infinito a custo zero, e trocar de provedor vira variável de ambiente.

**D14 — Orçamento de tokens por aluno e por escola é requisito, não otimização.**
O alvo é R$ 30 por aluno por mês e o tutor consome muito mais que a geração de prova. Sem
medir desde a primeira chamada, a margem some sem aviso.

**D15 — Construção do zero, sem reaproveitar produto anterior.**

**D16 — A stack está ratificada.**
A que está em "Stack", abaixo. Sem ela fixa o F0 não começa, e cada PRD reabriria a
discussão. As skills técnicas instaladas em `.claude/skills/` seguem esta stack.

**D17 — Agentes têm nome de função, não nome próprio.**
Corretor, Planejador, Rotina, Monitor de turma, Tutor, Mensageiro da família. Os nomes do
Excalidraw (Pipo, Waz, Maky) saem. A coordenação precisa explicar em reunião de pais o que
cada IA faz, e "o Corretor" se explica sozinho, "o Pipo" não. Numa escola, um nome sóbrio
também passa mais confiança.
Revista em 19/09/2026: a regra do nome de função continua; a lista de nomes passa a ser a da
D32 revista (Assistente de ensino, Tutor, Corretor, Planejador, Adaptador e Analista de
desempenho escolar).
Revista em 23/09/2026: a lista passa a ser a da D32 revista no mesmo dia — **Assistente de
ensino, Tutor e Analista de desempenho escolar**, mais o Mensageiro da família depois. As
funções do Assistente também têm nome de função: correção de objetiva, adaptação, "seu dia e
sua semana".

**D18 — Chat e ferramentas são o mesmo motor. O chat abre a ferramenta dentro da conversa.**
O professor pode escolher a ferramenta no próprio chat. Se ele não escolheu e o pedido
corresponde a uma ferramenta ("monta uma prova do 2ºB"), o chat **pergunta** se quer usar a
ferramenta de prova antes de gerar qualquer coisa. Com o sim, a ferramenta aparece como
cartão dentro da conversa, já preenchida com o que foi entendido, e o professor ajusta e
salva. O artefato sai igual ao do formulário: salvo, ligado à turma, com a página citada.
Um motor só evita duas implementações que divergem, e perguntar antes evita gastar token
gerando o que o professor não pediu. Ver `docs/interface.md`.

**D19 — O tutor fora da sala é configuração da escola, por turma, desligada por padrão.**
Quando ligado vale o modo casa, com registro e resumo para o professor. O custo de token e a
disposição da escola para supervisionar variam, e quem controla o dado decide (D10).

**D20 — A rede pública faz parte do sistema alvo.**
A venda começa pela escola particular, mas prefeitura e governança de rede (F14) ficam no
roadmap, e as regras que falam de rede continuam valendo. Os contatos com rede pública
existem e o sistema completo precisa atender os dois compradores (D1).
Revista em 13/09/2026: particular e pública são alvo juntas desde o início, e não mais "a
venda começa pela particular". A pública entra com pacote de rede e piso de preço (D41).
Motivo: os contatos com rede existem, e com os anos finais no recorte (D43) a prefeitura
passa a ter o que comprar, já que o Ensino Médio público é estadual.

**D21 — O banco público de questões vem das provas oficiais do ENEM (INEP) e entra no F7.**
Serve ao simulado ENEM com correção imediata. É banco sem dono, separado do material de
qualquer escola. Vestibulares ficam de fora até que a licença de cada um seja verificada.

**D22 — A ingestão começa pelo upload de PDF. Adaptador de scraper só com escola real.**
Ainda não sabemos quais sistemas de ensino as escolas-alvo usam, então escrever adaptador
agora é apostar no fornecedor errado. O pipeline nasce com a porta de fonte (D5), o upload
é a primeira implementação, e cada adaptador entra quando uma escola com fonte definida e
autorização escrita existir.
Revista em 13/09/2026: upload e adaptador só recebem material com licença para esse uso
(D5 revista). Adaptador de sistema de ensino depende também de licença ou parceria com o
dono do conteúdo, não só da autorização da escola.

**D23 — Commit direto no `main`, um commit por tarefa.**
Enquanto são duas pessoas, branch e PR custam mais do que protegem. O portão de qualidade
fica no processo (`/executar-review` e os vetos), não no merge. Reabrir quando entrar uma
terceira pessoa no código.
Revista em 15/09/2026: o portão continua no processo, mas a autorrevisão do
`/executar-review` foi substituída pelo agente `revisor-geral`, e código só entra por tarefa ou
por `/corrigir` (D53).
Revista em 19/09/2026: a terceira pessoa entrou no código, que era a condição para reabrir, e
o Joaquim mandou desconsiderar a regra do commit direto. Quando o F1 fechar, o `main` deixa de
receber trabalho direto e nascem os branches **`release`** e **`develop`**; todo trabalho,
código e documentação, passa a ser feito em branch próprio. O ponto de partida é um só: o
branch de documentação entra no `main` quando o Joaquim avisar, o `main` vai para o `release`,
e o `release` para o `develop`. Motivo: com três pessoas, commit direto no `main` arrisca
conflito e código sem um segundo par de olhos, e o MVP de apresentação (D71) pede duas frentes
andando ao mesmo tempo. Os vetos dos revisores e o portão local continuam valendo dentro do
branch.

**Fixado em 21/09/2026, pelo Joaquim:** o trabalho acontece **direto na `develop`** — código e
docs —, sem branch por tarefa. `release` e `main` recebem por merge, e o Joaquim gerencia esse
caminho. O Gabriel abre branch própria, para não mexer no que está em andamento, e integra na
`develop`. A esteira roda nas três branches (`develop`, `release`, `main`), e é na `develop` que
ela vale como portão do dia a dia: o `/executar-task`, o `/corrigir`, o `/validar`, o
`/revisar-spec`, o `/retro` e a regra 40 passaram a apontar para lá. De onde sai o staging fica com
a D31, quando o staging existir.

Revista em 08/10/2026 pela D78: o trabalho de uma spec deixa a `develop` e passa a acontecer num andar
do Maestri, na branch `spec/<funcionalidade>`, que só entra na `develop` por pouso, com a palavra do
Joaquim; a esteira roda uma vez por spec, na branch, antes do pouso (revisto pela D79: em todo push). Decisão, retrospectiva e
documento que não é de spec continuam na `develop`. O merge para `release` e `main` não muda.

Revista em 23/10/2026, na X7 (`harness`), pelo Joaquim no terminal do Arquiteto: a esteira roda também
no `pull_request` para a `develop`, e a branch do Gabriel passa a ser testada antes do merge, e não
depois. O pouso do Orquestrador continua merge direto, com a esteira da spec já lida (U10-13).

**D24 — Na primeira semana, a coordenação precisa ver quatro coisas funcionando.**
A escola inteira cadastrada sem trabalho manual, o painel de governança de IA com 100% das
notas aprovadas por humano, professores gerando prova e plano a partir da apostila com a
página citada, e alunos usando o tutor em sala com os sinais chegando ao professor. É o
critério de sucesso do piloto e o roteiro da demonstração (F15). Por isso nenhuma dessas
quatro pode ficar para a fase posterior.
Revista em 13/09/2026: enquanto a nota oficial não existir (D46), a governança mostra o
que a IA gerou e quem aprovou nas entregas que chegam ao aluno, e a nota entra nessa conta
quando entrar no sistema. O material citado é o que tem licença (D5 revista). Continua
como critério da demonstração e da venda; quais das quatro o piloto por fatias (D1
revista) precisa ter no primeiro dia está em aberto.

**D25 — A infra do primeiro ano é desenhada para até dez escolas, e a arquitetura para
crescer até uma rede.**
Uns 4.000 alunos, com pico de ~1.600 simultâneos na manhã. Cada escola entra com centenas de
usuários de uma vez, e o uso se concentra no horário de aula. API, realtime e worker ficam
separados e sem estado desde o início, para uma rede municipal (D20) ser questão de mais
instâncias, não de refazer. Modelo de carga em `docs/infra.md`.

**D26 — Banco, Redis e storage rodam na VM própria no início e viram serviços gerenciados na migração para a AWS.**
Quem opera é o Joaquim, sozinho e sem plantão. Manter Postgres com replicação e backup na
mão não cabe nisso. Continuam sendo padrões abertos (Postgres, Redis, S3), então a regra 00
e o `docker compose up` seguem valendo.
Revista em 24/10/2026, pelo Joaquim (a decisão de 14/10/2026, registrada agora): no início, banco, Redis e
storage rodam em contêiner na VM de produção própria (F18), e passam a gerenciados quando a produção migrar
para a AWS (D42). O que o serviço gerenciado dava de graça vira obrigação do F18: backup diário fora da VM,
snapshot antes de deploy, restauração executada de verdade e alerta de backup vencido. O portão da primeira
escola real vale igual. Motivo, nas palavras do Joaquim: "quero rodar a produção na minha máquina em casa porque tem PC potente no início, depois a migração para AWS": custo de hospedagem perto de zero no primeiro ano, numa máquina que aguenta a carga das primeiras escolas, e o compose de sempre, que sobe o sistema inteiro num servidor (o critério da stack), torna a migração uma troca de endereço e de serviço gerenciado, não uma reescrita.

**D27 — Meta de 99,5% de disponibilidade no horário letivo, com prova resiliente.**
Resposta de prova salva por item, relógio no servidor e retomada após queda. Deploy em
produção só fora do horário letivo. Cair no meio da prova custa a confiança do professor;
alta disponibilidade em várias zonas custaria mais do que uma pessoa consegue operar.

**D28 — Hospedagem em região Brasil. O provedor ainda está em aberto.**
Atende LGPD e a exigência provável da rede pública. Fixar a região agora evita escolher
serviço que só existe fora do país.

**D29 — Modelo de IA em produção vem de API de provedor, com contrato e provedor de reserva.
No pico, fila curta e depois modelo menor.**
GPU própria fica ociosa à noite e é operação pesada para uma pessoa. O contrato veda
treinamento com nosso dado (regra 20) e garante limite de tokens por minuto para o pico do
tutor (~1,5 milhão por minuto em dez escolas, estimativa de `docs/infra.md`). Quando o limite
aperta, o aluno espera alguns segundos com aviso, depois é atendido por um modelo menor do
mesmo perfil. Nunca vê erro cru.

**D30 — Infra custa até R$ 2 por aluno por mês, sem contar IA.**
Uns 7% do preço alvo. É medido por escola desde o F0, junto com o custo de IA (D14).
Revista em 13/09/2026: o uso já nasce marcado por escola no F0; o custo do ambiente passa a
ser medido quando o staging existir (D31).

**D31 — Produção na VM própria, com deploy automático pela `main`; homologação opcional.**
Staging recebe todo commit do `main`, roda e2e e teste de carga, e só tem seed sintético.
Com commit direto no `main` (D23), é o staging que segura o erro antes de chegar à escola.
Revista em 13/09/2026: o F0 e a validação inicial são 100% locais, sem ambiente remoto e
sem gasto; até o staging existir, o portão é a esteira do GitHub (tipos, lint, testes e
e2e). O staging é criado antes da primeira demonstração a alguém de fora ou do piloto, o
que vier primeiro. Validar local não exige máquina ligada nem custo, e o que só um ambiente
remoto prova (URL pública, check externo, custo do ambiente) não tem valor antes de haver
quem veja.
Revista em 24/10/2026, pelo Joaquim: o staging dá lugar à VM de produção própria (F18). O merge na `main`,
com a esteira verde, sobe sozinho na VM, e só fora do horário letivo (D27, regra 80): dentro dele, o deploy
espera a janela. Uma VM de homologação é opcional e pode nem existir; até lá, o portão continua sendo a
esteira, e a demonstração externa e o piloto partem da VM, com dado sintético enquanto o portão da primeira
escola real não abre (regra 20). Os itens marcados "antes do staging" no `TODO.md` passam a valer antes da
produção na VM. Motivo, nas palavras do Joaquim: "quero rodar a produção na minha máquina em casa porque tem PC potente no início, depois a migração para AWS": custo de hospedagem perto de zero no primeiro ano, numa máquina que aguenta a carga das primeiras escolas, e o compose de sempre, que sobe o sistema inteiro num servidor (o critério da stack), torna a migração uma troca de endereço e de serviço gerenciado, não uma reescrita.

**D32 — Os agentes são sete, mais o Mensageiro da família na fase posterior.**
Rotina, Corretor, Planejador, Monitor de turma, Tutor, Adaptador e Analista da coordenação.
O Rotina trabalha sozinho porque só organiza o que já existe; o Planejador trabalha sob
pedido, porque plano que ninguém pediu é token jogado fora. O Analista existe porque quem
compra é a coordenação, e ela precisa do próprio "funcionário". O Adaptador existe porque
inclusão é o tema mais anunciado do mercado e é trabalho que o professor raramente tem tempo
de fazer. Nível e gatilho de cada um em `docs/agentes.md`.
Revista em 19/09/2026 *(ratificada pelo Joaquim em 23/09/2026, e superada pela revisão de 23/09/2026 logo abaixo)*: os
agentes passam a ser **seis**, um por
necessidade de cada papel — **Assistente de ensino, Tutor, Corretor, Planejador, Adaptador e
Analista de desempenho escolar** —, mais o Mensageiro da família na fase posterior. O que
mudou: (1) o chat do professor ganha identidade de agente, o **Assistente de ensino**, que é a
cara das ferramentas (D18); (2) o **Monitor de turma se dissolve**: o que o aluno mostra no
uso do Tutor — travou, errou muito, pediu resposta pronta, principal dificuldade — chega ao
professor pela thread do próprio **Tutor**, as entregas pendentes vão para o Planejador, e a
queda por habilidade aparece em "Minhas turmas" (D69); (3) o **Planejador absorve o Rotina**,
mantendo os dois gatilhos: abre o dia e a semana com o que já existe, sem gerar conteúdo, e
gera plano só sob pedido; (4) o Analista da coordenação passa a se chamar **Analista de
desempenho escolar**. Motivo: a estrutura fechada pelo Gabriel com o time em 19/09/2026 pede
uma voz por assunto para cada papel; "Monitor" servia a duas coisas diferentes (o assistente
do professor e o agente que olhava a turma); e Rotina e Planejador eram, para o professor, a
mesma conversa sobre o que vem pela frente. O custo continua protegido: abrir o dia não chama
modelo para gerar conteúdo, e plano que ninguém pediu continua não sendo gerado. O aluno segue
nomeado só para o professor da turma (D34) e a notificação só sai no horário útil da escola
(D59).
Revista em 23/09/2026 *(decidida pelo Gabriel em 20/09/2026, vista em mockup; ratificada pelo
Joaquim)*: **um agente para cada pessoa da escola**. O professor tem o **Assistente de
ensino**, o aluno tem o **Tutor**, a coordenação tem o **Analista de desempenho escolar**, e a
família terá o Mensageiro na fase posterior. Corretor, Planejador e Adaptador deixam de ser
agentes e viram **funções do Assistente de ensino**: **correção de objetiva** (corrige, monta
o diagnóstico e espera o professor), **adaptação** (aplica o tipo de adaptação registrado e
espera aprovação, D35 e D67) e **seu dia e sua semana** (organiza o que já existe, sem gerar
conteúdo; plano só sob pedido). O professor continua vendo o Tutor em "Seu time", como segunda
voz, porque é ele quem supervisiona o agente dos alunos (D8, D47). Motivo: cada um dos três
tinha uma ferramenta gêmea que chamava o mesmo caso de uso — mudava só quem disparava e onde o
resultado aparecia —, e o risco que o CNE classifica é da funcionalidade, não da persona. A
autonomia passa a ser declarada por função (D9) e a suspensão também (D60). A apresentação
passa a ser "um agente para cada pessoa da escola", e a frase da D44 continua valendo.

**D33 — Nota de objetiva é aprovada em lote, com os casos fora da curva abertos antes.**
Aprovar aluno por aluno vira clique reflexo e esvazia a supervisão que a lei exige. O lote
com resumo mantém o humano olhando o que importa.

**D34 — Aluno em risco chega nomeado só ao professor da turma. A coordenação vê agregado.**
Abrir o detalhe como coordenação é possível e fica em auditoria. É o menor caminho de dado
de menor que ainda faz alguém agir.

**D35 — A coordenação registra a adaptação necessária do aluno, nunca o diagnóstico.**
É dado sensível (art. 11). "Fonte ampliada, tempo +50%" basta para o Adaptador trabalhar, e
um vazamento desse campo é muito menos grave que o de um laudo.

**D36 — Assunto pessoal delicado no tutor é encaminhado a um humano.**
O tutor não aconselha: responde com mensagem fixa, orienta procurar professor ou orientação
e, com menção a risco à vida, o CVV (188). O professor recebe o sinal "precisa de atenção
humana" sem o conteúdo por padrão. O gatilho é o que o aluno escreveu, nunca inferência de
estado emocional. Só recusar o assunto deixaria um aluno em risco sem ninguém saber.

**D37 — O provedor de modelo sai de uma avaliação com amostras sintéticas.**
Finalistas: Maritaca (Sabiazinho 4 e Sabiá 4, variante processada no Brasil) e Google
(Gemini Flash-Lite e Flash). Principal e reserva são escolhidos pelo resultado, antes de a
F5 ficar pronta. Benchmark genérico não mede o que importa aqui: recusar a resposta em
português de Ensino Médio e citar a página certa. Critérios em `docs/avaliacao-de-modelos.md`.

**D38 — O tutor tem pacote mensal por turma, com freio diário por aluno.**
Pacote de 300 trocas por aluno por mês, somado na turma: o aluno que precisa mais na véspera
da prova usa o saldo dos colegas que usaram menos. Freio de 60 trocas por dia por aluno
contra abuso. Professor e coordenação veem o consumo. Limite individual rígido cortaria
justamente quem mais precisa; sem teto, uma turma consumiria o mês da escola.

**D39 — IA custa até R$ 5 por aluno por mês na escola particular.**
Soma tutor, ferramentas do professor e agentes. Com infra de R$ 2 (D30), sobram uns R$ 23
dos R$ 30 para suporte, imposto e margem. Na prática, modelo pequeno no tutor e médio na
geração de prova e na correção de discursiva.
Revista em 13/09/2026: o teto de R$ 5 vale para o pacote completo, com tutor (D50). O teto
do pacote base fica em aberto até a planilha de custo por pacote. Correção de discursiva
não propõe nota por enquanto (D46), então sai da conta como nota e fica como devolutiva.

**D40 — A escola paga por aluno, com uso normal incluso. Não há crédito visível.**
Professor e aluno nunca veem "acabou o crédito". O orçamento é interno (D14, D38). Se uma
escola passar do teto de forma recorrente, renegocia o contrato, não o uso no meio do
bimestre. Previsível para a escola e fácil de explicar em assembleia de pais.
Revista em 13/09/2026: o preço por aluno passa a ter faixas de pacote (D50). A regra de não
existir crédito visível continua igual.

**D41 — Na rede pública, o orçamento de IA é derivado do preço do contrato.**
O sistema é o mesmo, mas a rede paga R$ 5 a R$ 10 por aluno, então o orçamento de IA dela é
configurado menor (ordem de R$ 1,50 por aluno): modelo pequeno no tutor e pacote menor por
turma. O preço define o orçamento, e não o contrário. Por isso o orçamento é configuração
por escola e por rede, nunca constante no código.
Revista em 13/09/2026: a rede entra com **pacote de rede com piso de preço**, em torno de
R$ 10 por aluno por mês, ou com um pacote com menos tutor que caiba no preço. Motivo: a
R$ 5, IA (R$ 1,50) mais infra (R$ 2) mais imposto dão uns R$ 4,15 e não sobra para suporte
nem licitação. Perder licitação só por preço é aceito. O orçamento continua sendo
configuração por rede.

**D42 — O provedor de nuvem é escolhido na migração para fora da VM, com a AWS São Paulo como candidata.**
Nada de produção é necessário antes do staging. Critérios: região São Paulo, Postgres
gerenciado com pgvector e backup contínuo, Redis gerenciado configurável sem expulsão de
chave, storage S3-compatível, custo dentro de R$ 2 por aluno (D30), preço em real ou
crédito para startup. Comparar AWS São Paulo, Google São Paulo, Azure Brazil South e Magalu
Cloud. Revista em 13/09/2026: saiu da Tech Spec do F0, porque o F0 passou a ser só local
(D31). A comparação já feita fica como ponto de partida (AWS São Paulo como candidata;
Azure eliminada por não ter API S3, Magalu por não ter Redis gerenciado), e opção sem custo
entra na comparação.
Revista em 24/10/2026, pelo Joaquim: a produção começa na VM própria, numa máquina AM5 com Proxmox em casa,
com só a borda exposta pelo túnel da Cloudflare com Access (F18); a escolha de provedor vai para a migração,
com os mesmos critérios e a AWS São Paulo como candidata. A máquina fica no Brasil, então a D28 continua.
Motivo, nas palavras do Joaquim: "quero rodar a produção na minha máquina em casa porque tem PC potente no início, depois a migração para AWS": custo de hospedagem perto de zero no primeiro ano, numa máquina que aguenta a carga das primeiras escolas, e o compose de sempre, que sobe o sistema inteiro num servidor (o critério da stack), torna a migração uma troca de endereço e de serviço gerenciado, não uma reescrita.

**D43 — O recorte é anos finais e Ensino Médio, em qualquer computador da escola.**
Do 6º ao 9º ano e do 1º ao 3º do Ensino Médio, em escola particular e rede pública, com o
aluno usando Chromebook, notebook ou laboratório da escola, nunca aparelho pessoal. O
Chromebook deixa de ser filtro de mercado e continua como referência de máquina fraca para
desempenho (regra 50). Motivo: só o Ensino Médio privado dá uns R$ 371 milhões por ano a
R$ 30, contra ~R$ 1 bilhão com os anos finais; e o Ensino Médio público é estadual,
enquanto os anos finais são divididos entre município e estado, então sem eles a prefeitura
(D20) não tem o que comprar. Educação infantil e anos
iniciais continuam fora (regra 70). Aluno de 11 a 14 anos pede cuidado extra no tutor e
atrai o ECA Digital (Lei 15.211/2025).

**D44 — O produto se apresenta como assistente com agentes supervisionados.**
"Um time de IA que prepara o trabalho e avisa, e a escola aprova." Os agentes continuam
(D32), mas "agente, não assistente" e "trabalha sozinho" saem da visão e da venda. Motivo:
quase tudo que a IA faz passa por aprovação ou supervisão humana por exigência do CNE, e
vender autonomia para a coordenação contradiz o argumento de conformidade, que é o que
fecha a venda.

**D45 — O professor é medido em espelho: ele vê o próprio dado, a coordenação vê o
agregado.**
O professor vê o próprio painel de uso e de desempenho das turmas dele. A coordenação vê
por série e disciplina e abre o nominal só com registro em auditoria, como a D34 faz com o
aluno. Sem ranking de professor, e nenhuma métrica alimenta decisão sobre o professor
(avaliação funcional, sanção, dispensa). Motivo: se o professor sente que está sendo
vigiado, ele não usa, e "se o professor não gostar, a escola não renova". Métrica que forma
perfil profissional atrai o art. 20 da LGPD, a convenção coletiva na particular e o
estatuto do servidor na pública. Os indicadores do professor entram no mapa de dados de
`docs/lgpd.md` antes de qualquer migration.
Revista em 19/09/2026 *(ratificada pelo Joaquim em 23/09/2026; indicadores com advogado, `TODO.md`)*: o
indicador do professor deriva do desempenho das turmas dele — dificuldade, acertos e evolução
por habilidade —, continua em espelho e continua sem alimentar decisão sobre ele. Entra a
**regra do grupo mínimo**: a coordenação só vê agregado de um recorte (série × disciplina)
quando há **dois ou mais professores** nele. Com um só, o agregado é nominal na prática, e vale
a regra do nominal: o professor vê primeiro, e a coordenação abre com registro em auditoria.
Motivo: em escola de 300 alunos, "2º ano × Química" é uma professora, e chamar isso de
agregado seria cumprir a D45 só no papel.

**D46 — Primeiro o diagnóstico formativo, depois a nota oficial.**
No início a IA entrega devolutiva e diagnóstico por habilidade em atividade e avaliação,
sem gerar `Nota`. Nota oficial, boletim, aprovação em lote (D33) e exportação para o
sistema de gestão da escola entram depois. Em discursiva e redação a IA não propõe nota
enquanto o texto final das diretrizes do CNE não for publicado e lido. Motivo: segundo a
imprensa de 01/09/2026, o CNE vetou até a sugestão de nota em discursiva e redação; o
diagnóstico formativo tem menos risco legal, não mexe no boletim e é o que alimenta a
medição de desempenho de aluno e professor. A regra de que nota só existe com autor humano
continua valendo quando a nota entrar (D7).

**D47 — O tutor é supervisionado, não aprovado resposta por resposta.**
A resposta do tutor ao aluno não passa por aprovação prévia: ela é supervisionada, com
sinais ao vivo para o professor, registro, resumo, política da turma e escopo aplicados no
servidor. A aprovação prévia registrada continua valendo para tudo o mais que a IA entrega
ao aluno: material, atividade, devolutiva e adaptação. Motivo: o tutor responde em tempo
real, e aprovação prévia de cada resposta o tornaria impossível; o CNE classifica tutor
como risco moderado desde que supervisionado. A regra 70, item 3, passa a declarar essa
exceção por escrito.

**D48 — O login usa a conta da escola quando ela existe, e matrícula quando não existe.**
Aluno e professor entram com a conta Google ou Microsoft da escola, e turmas e vínculos
podem ser importados do Classroom como adaptador opcional. Do aluno guardamos só o
identificador da conta, nunca e-mail nem foto (regra 20). Escola + matrícula + senha, com
reivindicação de nome (D3, D4), continua para quem não tem conta, como boa parte da rede
pública. Motivo: menos senha esquecida e menos reset pela coordenação, e grade e vínculo
chegam prontos. Adaptador opcional mantém a regra 00, item 7.

**D49 — A fila de jobs fica como está, com entrega "pelo menos uma vez" e idempotência
obrigatória.**
O desenho do F0 (job no Postgres, despachante, BullMQ, vaga por escola e reconciliação) é
mantido. A promessa passa a ser entrega pelo menos uma vez, não "executado uma única vez":
todo processador de job recebe chave de idempotência e precisa tolerar reexecução. O teste
intermitente de `pool.int.test.ts` é corrigido. Motivo: o desenho já está construído e
testado contra queda de Redis e justiça entre escolas, e corrigir os pontos custa menos que
refazer as tarefas 7 a 9. A auditoria de 13/09/2026 achou quatro caminhos em que um job
roda duas vezes, e no F5 isso seria chamada de IA paga em dobro. A complexidade para uma
pessoa operar é aceita.

**D50 — O preço por aluno tem faixas de pacote.**
Na escola particular, preço por aluno por mês com um pacote base (assistente do professor
e gestão, hipótese de R$ 12 a R$ 18) e um completo com tutor (hipótese de R$ 25 a R$ 30).
Os valores são validados no piloto. Motivo: R$ 30 para uma escola de 330 alunos dá uns R$
550 por professor por mês, contra R$ 39,90 da Teachy e o Gemini grátis no Classroom; a
faixa base deixa a escola começar menor. O ponto de equilíbrio sobe para 10 a 15 escolas.

**D51 — Toda tela nasce responsiva e usável no celular, para todos os papéis.**
A web é uma só e funciona do computador fraco da escola ao celular: layout que se adapta a
partir de 360 px de largura, toque em vez de mouse, rede móvel lenta, nada que só funcione
com hover ou teclado físico. Vale para aluno, professor, coordenação e, depois, família.
Continua proibido **depender** do celular: nenhum fluxo exige o telefone (login, código,
foto), e em sala vale o computador da escola e a política dela (Lei 15.100). Não há app
nativo. Motivo: o aluno usa o tutor fora da escola quando a escola liga o modo casa (D19),
professor e coordenação abrem o sistema fora do colégio, e o portal da família será usado
quase só no celular; adaptar cada tela depois custaria refazer o frontend inteiro.

**D52 — Os testes de integração da infra saem do portão de toda tarefa e ficam na esteira.**
Os `*.int.test.ts` de `infra/` (borda, métricas, alertas, jobs no compose inteiro) formam o
projeto `infra` do Vitest, fora do `npm run test`. O portão da tarefa roda
`npm run test:infra` só quando ela mexe em infra (regra 40); a esteira roda os três
projetos em todo push no `main`, com um job `infra` próprio. Motivo: esses testes esperam o
relógio real (o `for:` de 5 min do alerta, a sonda da borda, a exportação de métricas) e
somam uns 16 min dos ~21 da integração; no F1 em diante, toda tarefa pagaria isso sem tocar
em infra. A esteira continua segurando o erro antes do staging (D31).

**D53 — O processo de construção é enxugado onde repetia trabalho, sem tirar revisão.**
Na tarefa, o `test-engineer` revisa primeiro e sozinho, e os outros revisores entram em paralelo
depois que ele aprova (revisto pela D79: todos rodam juntos). A aprovação caduca pelo que o revisor audita: mudança só em arquivo de teste
caduca só `test-engineer` e `revisor-geral`. A rodada nova recebe o diff desde a anterior e as
correções exigidas. O portão local grava um carimbo que o hook exige antes do commit, e o
`revisor-geral` o confere em vez de rodar tudo de novo. A autorrevisão do `/executar-review` vira o
agente `revisor-geral`, em contexto limpo e com veto. Revisores ficam sem ferramenta de edição e
separam bloqueante de recomendação: só bloqueante reprova. A Tech Spec passa por `/revisar-spec`
antes de virar tarefa. Código só entra no `main` por tarefa ou por `/corrigir`, e o hook bloqueia o
resto. O hook guarda o que os revisores exigiram em `achados/<documento>.md`, com resumo de uma
linha por rodada em `achados/indice.md`, que o `/retro` usa depois do `/validar` para mudar
templates, agentes e regras (a separação por documento e o índice entraram em 22/09/2026, na
correção `2026-09-22-achado-de-revisao-nao-cabe-na-janela`: o arquivo único da pasta chegou a 646 KB
e o passo que manda lê-lo antes de cada tarefa não cabia na janela). O texto completo das decisões sai do
`CLAUDE.md` para este arquivo, as regras 30 e 50 passam a carregar por caminho, e PRD, Tech Spec e
`N_task.md` têm o tamanho medido. Motivo: a avaliação do processo de 15/09/2026 achou 119 rodadas de
revisor no F0 e na 1.0 do F1, com 31 reprovações, 16 delas do `test-engineer`; a 1.0 teve 16
execuções de revisor, com `tenancy-guardian` e `infra-guardian` aprovando as quatro vezes; o portão
rodava três vezes na mesma árvore; três commits de correção entraram sem revisor; e a Tech Spec do F1
saiu com 5.393 palavras para um teto de 2.000. Os vetos, o commit direto no `main` (D23) e a esteira
como portão (D31) continuam.

Revista em 23/10/2026, na X7 (`harness`), pelo Joaquim no terminal do Arquiteto: (1) em sessão de papel
do time, commit que altera `tools/`, `.github/`, `.claude/settings*.json`, `.claude/hooks/`,
`docs/aia/ouro*/`, `package.json`, `compose.yaml`, `.env.example` ou uma configuração que decide o portão (lint, vitest, Playwright,
`tsconfig`, knip, gitleaks, tamanho) passa a exigir tarefa ou correção, `revisor-geral`, `test-engineer`,
o guardião da regra que a guarda ou o corpus protege, e carimbo, como o código de produto; skill, papel
e regra continuam documento. (2) A trava do commit ganha uma segunda camada, o git hook nativo
(`commit-msg`, que é o que recebe a mensagem com a marca da tarefa, e `pre-push`), instalado por
`core.hooksPath` pelo `prepare`; o hook do Claude Code fica como a mensagem na frente, e o commit do
Joaquim fora de sessão de papel continua livre. O que a máquina não barra (tirar o papel do ambiente,
`--no-verify` dentro de script, `commit-tree`, `rebase`) fica escrito, e a esteira recusa, em `spec/**`
e `correcao/**`, o commit com código sem marca nem linha `Revisões:`; o código do Joaquim nessas branches leva a
linha `Fora do processo: <motivo>`, que o hook recusa vinda de sessão de papel. (3) O histórico de `achados/` continua no git. Motivo: o diagnóstico do
harness (U11-3, U11-5) mostrou que `/usr/bin/git commit`, `env … git commit` e `sh -c '…'` passam sem
revisão, e que o código que impõe as regras (as guardas e o próprio hook) entrava sem revisor; o
`achados/` é o rastro de auditoria do processo, e a retrospectiva lê dele depois do pouso (U11-15).

---

> **D54 a D65 — propostas de 19/09/2026, ratificadas.** Saíram da leitura das fontes
> primárias de regulação e dos dois documentos do MEC (`docs/regulacao.md`,
> `docs/conformidade-mec.md`), no branch `docs/direcionamento-regulatorio`, e estão escritas no
> formato de decisão para poderem ser implementadas sem reinterpretação. O Gabriel ratificou as
> que dependiam dele em 19/09/2026, e o Joaquim ratificou todas em bloco em 23/09/2026. O que
> ainda depende de parecer ou de outra decisão está dito em cada uma.

**D54 — O nome do produto é Turmma.** *(ratificada pelo Gabriel em 19/09/2026)*
A marca está pronta: manual, logo, paleta (caramelo #E8732E, azul-noite #16233E, creme
#FFF3E2, papel #FDFBF7) e landing page em `turmma.com`. Documentação, material de venda e
interface passam a dizer Turmma. O repositório, os pacotes, o banco, o compose e os comandos
continuam `educa` até uma renomeação técnica própria, que não vale o risco agora: renomear
pacote e projeto compose no meio do F1 custa mais do que ganha. Motivo: "nome provisório" nos
docs mantinha viva uma discussão já resolvida fora do repositório, e o material de venda e a
primeira tela real precisam de um nome. INPI e registro de domínio continuam pendentes
(`TODO.md`), e é o único risco que sobra: se o INPI negar, a troca é de marca, não de código.

**D55 — Em discursiva e redação, a IA não corrige, não avalia, não dá nota, não atribui
conceito nem mérito, e não faz pré-correção nem sugere nota ao professor.** *(ratificada pelo
Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026; depende do parecer sobre o texto oficial)*
Revisão da D46, que dizia "sem nota proposta, só devolutiva". A cobertura do ato do CNE de
01/09/2026 é explícita: a IA não pode ser usada para corrigir, avaliar, dar nota, conceito ou
mérito em redação e questão dissertativa, **nem para pré-corrigir, nem para apresentar ao
professor uma sugestão de nota**. Isso alcança a "devolutiva rascunho de discursiva" do F6 e
a ferramenta de redação por competência do F7 como estavam desenhadas. O que continua
permitido: gerar rubrica e critérios antes da aplicação (são sobre a atividade, não sobre o
texto do aluno), organizar o lote, conferir entrega e anonimizar para correção cega.
Consequência técnica: nenhum campo, nem interno, nem rascunho, nem log, guarda nota, conceito
ou pontuação sugerida pela IA para discursiva ou redação. Motivo: é a proibição mais dura do
ato e a mais fácil de violar sem perceber, porque "só um rascunho para o professor" é
exatamente o que o texto chama de pré-correção. A devolutiva formativa em discursiva volta a
ser discutida quando o texto oficial for publicado e lido com advogado (`TODO.md`); até lá o
produto não a entrega. Custo aceito: perdemos uma funcionalidade que a Teachy e a Geekie
anunciam — e ganhamos o argumento de que elas estão do lado errado da norma.

**D56 — Na objetiva, a validação humana é registrada: o sistema guarda o que foi mostrado, o
que foi aberto e quem confirmou.** *(ratificada pelo Joaquim em 23/09/2026)*
Complementa a D33, que fica de pé. O ato do CNE classifica correção de objetiva como alto
risco e exige validação humana "efetiva, prévia, qualificada e documentada", dizendo que o
professor não pode apenas clicar em "aprovar". Então a aprovação em lote passa a gravar o
registro da validação: a distribuição apresentada, quais casos destacados foram abertos
(discursiva com baixa confiança, nota distante do histórico do aluno, prova em branco), quem
confirmou e quando. O botão do lote continua travado até os destacados serem abertos. Motivo:
"documentada" não é satisfeito por um booleano `aprovado`; a escola precisa poder mostrar à
fiscalização *como* o humano validou. E é o mesmo registro que alimenta a governança do F12.

**D57 — Usos vedados, escritos e testados: sem inferência de emoção, sem perfil comportamental
ou psicológico, sem pontuação social, sem biometria, e nenhum dado educacional para
publicidade ou fim comercial.** *(ratificada pelo Joaquim em 23/09/2026)*
Estava implícito na regra 70, item 7, como ausência de funcionalidade. Passa a ser proibição
escrita, com teste, porque agora tem três fundamentos independentes: o ato do CNE classifica
essas práticas como risco excessivo ou incompatível; o ECA Digital veda perfilamento e análise
emocional para publicidade (art. 22) e criação de perfil comportamental de menor (art. 26); e
o Decreto 12.880 veda inferência emocional como prática manipulativa (art. 10, II). O sinal de
aluno em risco continua existindo, derivado de fato declarado — entrega, desempenho, o que o
aluno escreveu de forma explícita —, nunca de leitura de estado emocional, e sempre com
explicação e caminho de contestação (D60). Motivo: é a fronteira que, atravessada uma vez,
tira o produto da categoria "supervisão" e o põe na de "vigilância", que é o que a família
recusa e a ANPD multa.

**D58 — Os agentes continuam agentes: identidade de função, sem se passar por pessoa.** *(ratificada
pelo Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026)*
O agente mantém nome, avatar, thread e jeito próprio — o time de IA é o produto (D32, D44), e
o nome é o da função (D17). A transparência que o art. 11, I, do Decreto 12.880/2026 exige
("caráter sintético e automatizado" da interação) é cumprida pelo que o produto já é de ponta
a ponta: a escola contrata um time de IA, a família ouve isso na assembleia, a área do aluno
se chama "Seu time", o agente se apresenta pela função e **toda saída de IA é rotulada como
tal**, com a fonte. Nenhum aluno tem como achar que o Tutor é a professora dele.

O que fica proibido é estreito e não custa produto: dizer que é humano quando o aluno
pergunta; usar nome de pessoa que sugira uma pessoa real; simular vínculo afetivo ou
dependência ("senti sua falta", "não me deixe agora"); e qualquer manipulação de
comportamento, que é o inciso II do mesmo artigo. Perguntado sobre si, o agente explica o que
é, como funciona e que pode errar (D65).

Motivo: o decreto pede que a criança não seja **enganada**, não que o produto seja sem graça.
Persona que esconde ser IA é o problema que a norma mira — produto de companhia artificial,
não tutor escolar. Agente que diz o que é e o que faz é a solução, e é justamente o que torna
a supervisão explicável em reunião de pais: "o Assistente corrigiu, a professora aprovou". A
versão anterior desta decisão, de 19/09/2026, exigia um aviso não desligável no início de cada
sessão e proibia persona; foi revertida no mesmo dia, a pedido do Gabriel, porque descaracteriza
o conceito central do produto e não decorre do texto do decreto. Nada impede que a escola, no
material dela, explique que são agentes de IA — isso já está no dossiê (D61).

**D59 — Nada no produto induz uso excessivo, e nenhum caminho de saída é mais difícil que o de
entrada.** *(ratificada pelo Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026)*
Do art. 9º do Decreto 12.880 (uso excessivo, problemático ou compulsivo) e do art. 10 (práticas
manipulativas), com o art. 8º, IV, e o art. 17, § 4º, II, do ECA Digital. Proibido: recompensa
por tempo de uso, sequência de dias, conteúdo que se inicia sozinho, rolagem infinita,
notificação fora do horário útil da escola, e ocultar ponto de parada. Obrigatório: o teto
diário do tutor (D38) é mostrado ao aluno como salvaguarda, não como punição; e revogar
consentimento, sair, ou mudar configuração de privacidade tem caminho tão curto quanto o de
aceitar. Motivo: o caminho fácil de engajamento em produto para adolescente é exatamente o que
a lei chama de manipulativo, e o princípio 8 do MEC manda a escola **rejeitar** plataforma com
design persuasivo. Isso vira item de checklist do `frontend-reviewer`, não recomendação.

**D60 — Avaliação de Impacto Algorítmico por funcionalidade de alto risco, no roteiro de seis
etapas do MEC, antes de a funcionalidade existir.** *(ratificada pelo Joaquim em 23/09/2026)*
Alto risco aqui é: Tutor, correção de objetiva, diagnóstico por habilidade, sinais do tutor e
alertas sobre aluno, e adaptação por necessidade específica. Cada um tem uma AIA escrita,
versionada no repositório, com as seis etapas do Referencial do MEC: justificação e escopo
(inclusive o escopo negativo, o que a ferramenta não deve fazer), análise dos dados e do modelo,
identificação e avaliação de riscos, estratégias de mitigação, validação e auditoria da equidade,
e monitoramento contínuo com procedimento de suspensão. O RIPD do `TODO.md` continua, e a AIA é
a camada que o RIPD não cobre: viés, equidade e impacto pedagógico. A AIA é revista a cada troca
de modelo ou mudança relevante de prompt. Motivo: o ECA Digital já obriga gerenciamento de risco
e relatório de impacto (art. 8º, I, e art. 16), a AIA é o formato que o MEC espera ver, e é
documento que a escola vai pedir (`docs/conformidade-mec.md` seção 5). Fazer depois é reescrever
o PRD com outro nome.
Revista em 19/09/2026: as AIAs ficam versionadas em `docs/aia/`, um arquivo por avaliação. O
Joaquim escreve o rascunho da etapa 1 (justificação e escopo, com o escopo negativo) e o
Gabriel revisa. A lista acompanha a D32 revista e está em `docs/aia/README.md`.
Revista em 23/09/2026: com a D32 revista, o procedimento de suspensão é **por função numa
escola** — a coordenação desliga a correção automática sem desligar o chat do professor —, com
registro próprio e auditoria. A AIA continua por funcionalidade, que já era o recorte da regra
70, item 6a.

**D61 — O dossiê de conformidade é entregável de produto, não material de marketing.** *(ratificada
pelo Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026)*
A escola compra por checklist (os quatro critérios do MEC) e exige documento do desenvolvedor.
Entregamos, versionado no repositório e gerado por escola: declaração de propósito com as faixas
etárias para as quais o produto foi projetado; documentação do funcionamento em linguagem
simples, com fluxograma do algoritmo, do uso de dados e do modelo pedagógico; relatório de
conformidade com LGPD e ECA Digital, artigo por artigo; RIPD e AIA; relatório de uso legível por
não especialista (que é a tela de governança do F12 exportada); e material de apoio para a escola
comunicar a adoção a professores e famílias. Junto entram duas peças de produto: **canal de
notificação de violação** acessível a aluno, professor, coordenação e família, com retirada de
conteúdo e direito de recurso informando se a análise foi humana ou automatizada (ECA arts. 28 a
30, Decreto art. 41); e o material da **consulta prévia à comunidade escolar**, que o MEC pede
pelo princípio da gestão democrática. Motivo: 78% das escolas não têm política de IA e agora têm
prazo para se adequar; quem entrega o documento pronto entra na reunião como parceiro. E é o
mesmo trabalho da tela que já íamos construir.

**D62 — Conversa de aluno só em provedor de modelo com processamento no Brasil.** *(ratificada pelo Joaquim em 23/09/2026;
o provedor fecha com a D37, e o afrouxamento 2 da D71 vale enquanto o dado for sintético)*
Roteamento por soberania, não por custo: o que carrega conversa de aluno — Tutor, sinais,
qualquer prompt com texto escrito por menor de idade — vai para provedor com processamento em
território nacional, escrito em contrato. Tarefa sem dado pessoal, como gerar questão a partir de
trecho de material ou resumir conteúdo público, pode usar provedor fora, com as cláusulas-padrão
da ANPD e informação à escola. Na prática isso favorece a Maritaca (Sabiá) como principal do
Tutor e deixa o Gemini como reserva e como modelo de tarefa sem dado pessoal, e passa a ser
critério da avaliação de modelos (D37) com peso maior que preço. Motivo: o capítulo de soberania
do Referencial do MEC trata dado educacional de menor fora do país como risco de Estado, citando
o Cloud Act, e a rede pública vai perguntar isso na primeira reunião. É também a única vantagem
competitiva que nenhum concorrente estrangeiro pode copiar. Custo aceito: se o modelo brasileiro
for pior no tutor, perdemos qualidade onde ela mais aparece — por isso a avaliação da D37 decide
com amostra real, e o resultado pode derrubar esta decisão.

**D63 — O que a escola e o professor produzem é deles, e sai em formato aberto a qualquer
momento.** *(ratificada pelo Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026)*
Material ingerido, artefato gerado, histórico de uso e dado de desempenho são exportáveis em
formato aberto pela própria coordenação, a qualquer momento, sem pedir a nós, e integralmente no
fim do contrato. Nada do que o professor produz vira nosso: sem reaproveitamento entre escolas,
sem treinamento de modelo, sem licença nossa sobre a produção docente. Motivo: o documento da SEB
lista "perda da propriedade intelectual da produção docente" e dependência de fornecedor como
riscos de contratação, e pergunta em checklist se o recurso permite baixar dado e histórico em
formato aberto. Era a pergunta que respondíamos pior. Além disso, exportação fácil é o que torna
o piloto reversível, e reversibilidade é requisito do princípio 10 do MEC.

**D64 — Recusar a ferramenta não gera indicador: não existe medição nominal de adoção por
professor.** *(ratificada pelo Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026)*
Afina a D45. O MEC exige que a rede garanta que nenhum professor seja penalizado por optar por
não usar uma ferramenta, e que a autonomia didático-pedagógica seja preservada. Então não existe,
em nenhuma tela: ranking de uso por professor, alerta de "professor que não usa", lista nominal de
adoção, nem meta de uso por professor. Adoção é agregada por série e disciplina, e é métrica
nossa de produto, não instrumento de cobrança da coordenação. O painel do professor continua
sendo dele primeiro (D45). Motivo: "se o professor não gostar, a escola não renova" é a regra que
orienta prioridade, e medir adoção nominal é o jeito mais rápido de transformar o produto em
instrumento de cobrança — além de atrair art. 20 da LGPD, convenção coletiva e estatuto do
servidor.

**D65 — Letramento em IA entra por três portas pequenas, e não vira fase de roadmap.** *(ratificada
pelo Gabriel em 19/09/2026 e pelo Joaquim em 23/09/2026)*
As diretrizes do CNE exigem ensino sobre IA progressivo e transversal, e o MEC exige que a
adoção de recurso com IA venha acompanhada de ensino crítico sobre a tecnologia. Não vendemos
currículo. O que entra: (1) o Tutor, perguntado sobre si, explica o que é, como funciona, o que
não sabe e que pode errar, em linguagem da faixa etária — que é a transparência do art. 11, I, do
Decreto 12.880 sendo útil; (2) o Assistente de ensino gera, sob pedido do professor, atividade alinhada às
12 aprendizagens do documento da SEB e às habilidades de Computação da BNCC, como qualquer outro
conteúdo; (3) o material de comunicação e formação do dossiê (D61) cobre o lado dos adultos.
Motivo: é exigência da norma que atendemos com três itens pequenos, e transformá-la em módulo de
currículo seria escopo novo sem comprador. Se uma rede pedir currículo de IA, isso é conversa de
produto, não de conformidade.

---

> **D66 a D70 — propostas de 19/09/2026, ratificadas.** Saíram da estrutura de agentes por
> papel que o Gabriel fechou com o time (aluno, professor, coordenação), conferida contra as
> decisões e as regras, no branch `docs/estrutura-de-agentes`. No mesmo passo foram revistas a
> D17, a D23, a D32, a D45 e a D60. O Gabriel decidiu, e o Joaquim ratificou em bloco em
> 23/09/2026. A lista de agentes que elas citam foi revista no mesmo dia (D32): onde o texto diz
> Corretor, Planejador ou Adaptador, leia a função correspondente do Assistente de ensino.

**D66 — O Tutor tem memória de tudo que o aluno fez no sistema, feita do registro do trabalho
e nunca de texto sobre a pessoa, e recebe contexto estruturado do professor.** *(ratificada pelo Joaquim em 23/09/2026)*
O Tutor acompanha o aluno ao longo do ano, e a memória é **obrigatória**. Ela cobre **toda a
trajetória do aluno no sistema** — todas as atividades, trabalhos, avaliações, práticas e
sessões com o Tutor, com o que foi feito, o resultado por habilidade e a evolução no tempo —, e
não um retrato pontual de onde ele travou na última vez. É feita do que o sistema registra
sobre **o trabalho**: o que foi feito e quando, o resultado, a devolutiva que o professor
escreveu, e o resumo de cada sessão com o Tutor em formato fixo (assunto, habilidade,
exercício, onde travou, como terminou) — o mesmo registro e resumo que o professor já vê (D8).
O que não existe é texto sobre **a pessoa**: jeito, humor, atenção, comportamento ou rótulo,
escrito por modelo ou por gente (D57). A cada conversa o Tutor busca na memória o que importa
para aquela dúvida; o histórico inteiro não vai no prompt, por minimização (regra 20, item 12)
e por custo (D14). Em discursiva e redação a memória guarda que o trabalho foi feito e a
devolutiva que o professor escreveu; o Tutor não avalia o texto (D55). A memória segue a
retenção de cada dado que a compõe (`docs/lgpd.md`). O professor alimenta o Tutor
de duas formas, as duas estruturadas: **por turma** (o que está sendo dado, a lista ativa, o
foco da semana) e **por aluno** (as habilidades a reforçar, escolhidas da lista; sem texto
livre sobre a pessoa). O Tutor também lê a **adaptação registrada** do aluno (D35) para ajustar
a forma — frases mais curtas, passos menores, resposta compatível com leitor de tela —, nunca
o que é cobrado. Motivo: tutor que não lembra onde o aluno travou ontem é um chat genérico, e é
a memória que permite direcionar de forma individual; mas perfil acadêmico individual é alto
risco no CNE, e texto livre sobre menor vira prontuário (regra 20, item 3). Registro do
trabalho é auditável, explicável ao aluno e contestável; opinião sobre a pessoa não é. Consequências: entra na
AIA do Tutor (D60), com explicação em linguagem comum e caminho de contestação; o que for campo
novo entra no mapa de dados de `docs/lgpd.md` antes de qualquer migration; e a adaptação viaja
para o modelo como tipo de adaptação, sem nome e sem motivo (regra 20, item 12), só em provedor
com processamento no Brasil (D62).

**D67 — O professor ganha as ferramentas de apresentação e de material didático, e o artefato
sai no formato que ele pedir.** *(ratificada pelo Joaquim em 23/09/2026)*
Entram no F7: **apresentação** (roteiro e slides a partir do material, com a página citada) e
**material didático** (resumo, texto de apoio, revisão), este fora da primeira entrega. O
artefato exporta em **PDF, PowerPoint (PPTX) e Excel (XLSX)**, conforme o tipo e o pedido do
professor, além da impressão. A ferramenta de adaptação passa a se chamar só **Adaptação**, e a
entrada dela é a **escolha do tipo de adaptação** (linguagem direta, fonte ampliada, tempo
extra, compatível com leitor de tela…), nunca texto livre descrevendo o aluno. A adaptação, função do Assistente de ensino (D32
revista), faz uma coisa simples: adapta prova e atividade — e material didático, quando o professor pedir —
para o aluno surdo, para o que não fala, para quem precisa de enunciado mais fácil, sem o
sistema saber nem guardar a condição (D35). Não geramos o documento formal de PEI, que descreve
o aluno e é da equipe da escola. **Isso não deixa a escola irregular**: o plano individual
(estudo de caso e Plano de AEE; LBI, art. 28, VII; Decreto 12.686/2025) é obrigação da escola,
feito pela equipe pedagógica com a família, do jeito que ela já faz hoje; o que a lei pune é
recusar matrícula ou **recusar adaptação** (Lei 7.853/1989, art. 8º, I; LBI, art. 4º, § 1º, e
art. 88), e adaptar é justamente o que a ferramenta faz. O fluxo fica coerente: o plano da
escola define as adaptações, a coordenação registra só as adaptações (D35), e a função de
adaptação as aplica. Não gerar o PEI é escolha nossa de minimização de dado sensível de menor, não proibição
legal; pode ser revista com advogado se uma escola pedir. Motivo: o professor entrega em formatos diferentes conforme a
escola e a aula, e ferramenta que só exporta num formato devolve o professor ao copiar e colar;
PDF, PPTX e XLSX são padrões ISO abertos, o que mantém a D63. Na adaptação, o risco nunca esteve
no nome da ferramenta, e sim no campo de texto livre onde alguém escreve o diagnóstico.
**Continua em aberto:** de onde vêm as imagens da apresentação (licença, D5).

**D68 — Busca na web existe por ativação do professor: para ele no Assistente de ensino, e para
o aluno no Tutor, só em fontes aprovadas.** *(ratificada pelo Joaquim em 23/09/2026; com pergunta nova
ao parecer do ECA Digital)*
Por padrão, tudo nasce do material da escola. O professor pode ligar a busca em dois lugares.
**No Assistente de ensino**, por conversa, para ele próprio. **No Tutor**, para a turma
pesquisar além do material didático, com estas condições: (1) a busca do aluno só alcança uma
**lista de fontes aprovadas** — órgãos públicos, IBGE, INEP, universidades, museus,
enciclopédias —, com lista padrão nossa, por faixa etária, que a escola ajusta; web aberta não;
(2) **duas chaves**: a coordenação libera o recurso na escola, desligado por padrão como o modo
casa (D19), e o professor ativa por turma, com prazo; em avaliação em andamento fica sempre
desligada; (3) o Tutor **continua socrático**: traz a fonte, pede para comparar duas, pergunta
de volta, e não escreve o trabalho — é letramento em pesquisa, junto da D65; (4) o **assunto
continua sendo o da turma**: muda de onde vem a informação, não sobre o que o Tutor fala; (5) a
**consulta é escrita pelo modelo**, sem o texto nem o identificador do aluno, porque o buscador
é terceiro fora do País (D62), e ele entra no registro de suboperadores; (6) o professor vê o
que foi pesquisado e quais fontes foram abertas, e a resposta vem rotulada "da web", com o
link, separada de "material da escola, página X"; (7) há teto de buscas por aluno por dia,
dentro do pacote do Tutor (D38, D39); (8) começa **só no modo sala**. Motivo: pesquisar além da
apostila é parte de estudar, e o aluno que não pode fazer isso no Turmma faz no ChatGPT, sem
ninguém vendo. As condições não são preferência nossa: o ECA Digital exige a configuração mais
protetiva por padrão (arts. 3º e 7º) e conteúdo compatível com a faixa etária (art. 8º) — temos
aluno de 11 anos —, e o Decreto 12.880 exige salvaguardas ao desenvolvimento (art. 11, IV).
Lista de fontes aprovadas é o que torna a busca defensável. Consequências: entra na AIA do
Tutor; o teste adversário do Tutor passa a cobrir **página da web com instrução escondida**, e
vem do F16 para o F9; e o parecer do ECA Digital ganha uma pergunta: ligar a busca para aluno de
até 16 anos sem conta de responsável vinculada conta como rebaixar a proteção (art. 24, § 5º)?

**D69 — "Minhas turmas" é aba do "Meu painel" do professor, e nasce no F6.** *(ratificada pelo Joaquim em 23/09/2026)*
A análise da turma — desempenho, principais dificuldades, evolução, conteúdo com mais erro,
alunos que precisam de atenção — não é item novo de menu: é a aba **Minhas turmas** de "Meu
painel", ao lado de **Meu uso**. Nasce no F6, com o diagnóstico por habilidade e o relatório
por questão; ganha os sinais do Tutor no F10 e a comparação com a série no F12. Motivo: o menu
do professor veio fechado do desenho da call, e esperar o F12 para o professor enxergar a
própria turma deixaria o diagnóstico do F6 sem tela. "Aluno que precisa de atenção" sai de fato
declarado — acerto por habilidade, entrega, onde travou —, com a explicação na tela e caminho
de contestação (D57, D60), e aparece nomeado só para o professor da turma (D34). **Continua em
aberto** a lista de indicadores, os limiares e o texto dos alertas (`CLAUDE.md`). Ponto de
partida do Gabriel: percentual de erro e acerto, e o sinal **"concluiu o que foi atribuído"**,
para o professor liberar a próxima lista. Medir tempo ocioso do aluno não entra: é medir
atenção e comportamento (regra 70, item 7), e o mesmo objetivo sai do fato "concluiu".
Revista em 23/09/2026 (D73): "Meu painel" deixa de existir. "Minhas turmas" vira o item
**Turmas** da navegação do professor, com a lista das turmas dele e o **Meu uso** (o espelho da
D45) ali dentro. O que a turma aberta mostra — as abas desenhadas no mockup — fecha no PRD da
A3 (`docs/pendencias-dos-mockups.md`, P11 e P28). Continua nascendo no F6, com uma fatia na A3.
Revista em 12/10/2026 pela D80: a turma aberta tem três abas, **Hoje, Atividades e Alunos**, e o
**Meu uso** sai de Turmas e vai para a conta do professor. Frequência, Ranking, Recursos e Mural não
entram: continuam sem fase e sem decisão (`CLAUDE.md`, decisões em aberto).

**D70 — Sair da aba durante a prova é fato mostrado ao professor, e só durante a avaliação.**
*(ratificada pelo Joaquim em 23/09/2026; AIA e `conformidade-reviewer` antes de existir)*
Em prova e atividade avaliativa online, o sistema registra quando a aba da avaliação perde o
foco e mostra ao professor como fato: "saiu da aba da prova 3 vezes". **Só notifica o
professor.** Não tenta saber para onde o aluno foi — uma página web não enxerga isso —, não tem
consequência automática sobre a prova nem sobre a nota, o aluno é **avisado antes** de começar,
e o registro fica preso àquela avaliação, junto do registro da validação (D56), nunca como
atributo ou histórico do aluno. **Fora de avaliação não existe**: aluno estudando com o Tutor
não tem a navegação acompanhada, porque aí deixa de ser integridade da prova e vira a janela
sobre o comportamento que a regra 70, item 7, proíbe. Esse caso fica como pergunta para a AIA
de sinais e para o parecer, não como funcionalidade. Motivo: o professor precisa saber quando a
prova online pode ter sido feita com outra aba aberta, e esse é um fato simples e verificável;
o mesmo mecanismo ligado o tempo todo é vigilância, que a família recusa e a ANPD multa (D57).
Risco a escrever na AIA: leitor de tela, teclado virtual e notificação do sistema também tiram
o foco da aba, e o falso positivo cai justamente no aluno com adaptação registrada — por isso é
fato para o professor olhar, nunca evidência automática. Bloquear outras IAs no computador da
escola é configuração do Google Admin ou do filtro da rede: entregamos o guia no dossiê (D61).

**D71 — Depois do F1 vem um MVP de apresentação: fatias finas e reais do fluxo completo, com
dado sintético.** *(direção dada pelo Gabriel e pelo time em 19/09/2026; ratificada pelo Joaquim
em 23/09/2026, com a composição revista abaixo, e o detalhe de cada spec fecha no PRD dela)*
Em vez de seguir F2, F3, F4… até o F15 para só então ter o que mostrar, a próxima construção
depois do F1 é o MVP de apresentação: o mínimo que demonstra as três áreas — aluno, professor e
coordenação, com os seis agentes da D32 revista — e as quatro coisas da D24, numa escola
sintética. São cinco specs, A1 a A5 (`ROADMAP.md`): **base** (casca com a marca, camada de IA
mínima, runtime mínimo de agente, seed), **professor** (ingestão mínima, Assistente de ensino,
atividade, plano de aula, Adaptação, Planejador), **atividade e correção** (aluno responde,
Corretor, diagnóstico, aprovação com registro, "Minhas turmas"), **tutor e sinais** (Tutor
socrático com memória, thread do Tutor para o professor) e **coordenação** (governança de IA,
agentes e autonomia, Analista de desempenho escolar, roteiro). Depois dele o roadmap continua
na ordem de antes, e cada fase **completa** a fatia que já existe em vez de começar do zero.
Regras da fatia: (1) dado 100% sintético — nenhum aluno, professor ou escola real, e o portão
da primeira escola real continua intocado; (2) é código do produto, não protótipo: mesma
arquitetura, mesmas regras 00 a 80, mesmo processo (PRD, Tech Spec, tarefas, revisores) — fatia
fina não é atalho; (3) a regra 70 vale inteira: entrega nasce pendente, nada de discursiva
corrigida por IA, saída de IA rotulada; (4) fica de fora tudo que não aparece no roteiro.
Três afrouxamentos, que valem **só enquanto o dado for sintético** e precisam do aceite do
Joaquim: a AIA entra com a etapa 1 (escopo e escopo negativo) antes do PRD da fatia, e as seis
etapas antes do primeiro aluno real (D60); o provedor de modelo é o que tivermos pela porta,
porque não há texto de aluno real, e a D62 volta a valer antes de aluno real; e o cenário de
carga não cresce com as fatias, cresce quando a fase for completada (regra 80). Motivo:
precisamos começar a demonstrar, e a D1 já dizia que o que convence é o fluxo completo. O risco
que o roadmap apontava — refazer os agentes por construí-los antes da base — é menor agora: F0
e F1 já são a base, e a fatia nasce sobre ela, no desenho final. Custo aceito: F2 e F3 atrasam,
e nenhuma escola real entra antes deles e do portão. A apresentação roda primeiro na nossa
máquina (`docker compose up` e seed); o staging nasce quando alguém de fora precisar usar
sozinho (D31, D42).
Revista em 23/09/2026, pelo Joaquim: os **três afrouxamentos estão aceitos**, e a composição
muda no começo. A **A1 passa a ser a escola** (`apresentacao-escola`): a casca com a marca, a
coordenação montando a escola na tela — disciplinas, turmas, lista de nomes por turma e
alocação professor × turma × disciplina —, o professor entrando por convite e confirmando o
vínculo, e o aluno reivindicando o nome com a aprovação do professor. É o núcleo do F2, fino.
A escola em si é criada por nós, pelo `ops:escola`, e a coordenação recebe o convite pelo
`ops:convite-coordenador`, que já existem desde o F1 (D2). **Não existe seed com escola
pronta**: o que a demonstração mostra entra pelo próprio produto, digitado por nós, e continua
100% sintético — nomes inventados, nenhuma pessoa real (regra 20, item 17). A camada de IA
mínima e o runtime de agente passam para o começo da A2, junto da ingestão, que é feita pela
coordenação (D75). Grade horária e calendário ficam para o F2 e o F8, e o "seu dia" do
Assistente sai do roteiro até lá. Os agentes do roteiro são os três da D32 revista. Motivo: a
primeira das quatro coisas da D24 é a escola cadastrada sem trabalho manual, e um seed com a
escola montada escondia exatamente isso; é também a primeira coisa que uma escola real vai
fazer, então é a que precisa estar de pé desde já. Os fixtures de teste continuam existindo,
dentro dos testes: o que sai é a escola pronta na demonstração.
Revista de novo em 23/09/2026 (D76): antes da A1 entra a **A0**, o painel da operação, e a
escola passa a nascer nele em vez de no `ops:escola`, que continua existindo.
Revista em 25/09/2026, pelo Joaquim, na revisão da spec da A1: um **quarto afrouxamento**, que vale só enquanto o
dado for sintético. A conta de professor é global e, na A1, nasce por um link que a coordenação da escola copia, sem
prova de posse do e-mail, e é reaproveitada quando outra escola convida o mesmo e-mail (RF7 da A1). Ficam tolerados
dois comportamentos: (a) o aceite do convite responde diferente para e-mail com e sem conta Turmma, e quem tem o link
descobre se a pessoa trabalha em outra escola cliente; (b) a senha de uma conta global é definida por quem tem o link
de uma escola e vale no convite de outra. Antes da primeira escola real, a prova de posse do e-mail fecha os dois,
como item do portão (`ROADMAP.md`). Motivo: a prova exige envio de e-mail pelo sistema, que o PRD da A1 deixou fora,
e com dado sintético ninguém real fica exposto.
Revista em 04/10/2026, pelo Joaquim (D77): só para a A2 a A5, e só enquanto o dado for sintético, a regra (2) deixa de
pedir o mesmo processo. As quatro specs viram uma fatia só, com processo enxuto; o que muda, o que não muda e quando o
processo completo volta estão na D77. A A1 foi feita pelo processo completo.

**D72 — A pele do produto é o sistema do ChatGPT, em branco, preto e laranja, e é uma só.**
*(decidida pelo Joaquim em 23/09/2026, entre a pele do P02, que o Gabriel escolheu em
19/09/2026, e a cópia da Teachy da oitava rodada, P31; o Gabriel é avisado)*
Três cores e mais nenhuma: branco, preto (`#0D0D0D`) e o laranja da pinta (`#E8732E`); verde e
vermelho só em estado. Fonte do sistema, com a Fustat só no logotipo. Botão em pílula, item de
menu de 36 px com canto de 10, caixa de pedido com canto de 28 e sombra suave, rótulo de grupo
cinza sem caixa-alta, e o laranja aparecendo pouco: a pinta, o enviar, o contador e o que
espera a pessoa. Vale em **todas** as telas: Ferramentas e Turmas mantêm a estrutura que o
Gabriel desenhou na oitava rodada (o catálogo, a turma aberta), mas sem Quicksand e Inter, sem
o canto de 8 px, sem as medidas tiradas da Teachy e com os ícones de ferramenta dentro da
paleta. Junto vem o **padrão de espaço** do P03: aba de navegação sem título nem descrição (o
`<h1>` existe só para leitor de tela, e cada rota tem o próprio `document.title`), margem de 16
px no celular e 24 px a partir de 768, uma barra de 36 px com os controles da página, largura
de até 1480 px em grade e tabela, 1040 em formulário e 760 em leitura e conversa, e tela de
trabalho que cabe na janela e rola por dentro. Os nomes dos tokens da seção 9.9 do
`docs/interface.md` ficam; os valores e os SVGs do logotipo vêm de `mockups/` (`src/index.css`
e `public/marca/`), que são da marca e não código de terceiro. Os avatares dos três agentes o
Gabriel entrega antes da Tech Spec da A2. A pele da landing page — papel, creme, azul-noite —
continua sendo da landing page. Motivo: o Gabriel rejeitou a pele da landing vendo o produto;
duas peles dobram o trabalho da A1 e da A2; sem fonte web além do logotipo, o primeiro
carregamento fica menor no Chromebook (regra 50); e copiar fonte, medida e canto de um
concorrente direto abre o risco de concorrência desleal (trade dress) sem ganho que o
compense.
Revista em 25/09/2026, pelo Joaquim: os avatares dos três agentes e "Seu time" passam da A1 para a
A2, onde os agentes nascem, e a casca da A1 não reserva o lugar. Motivo: na A1 não existe agente, e
pela D73 item de fase que não existe não aparece; manter o prazo na A1 travava a Tech Spec dela sem
nada a mostrar na demonstração.
Revista em 12/10/2026 pela D80: a pele passa a ser o sistema Turmma do mockup de outubro (cor por
família, borda de 2 px com degrau, ícone ilustrado, a onça, modo escuro), e toda tela da lateral
ganha título visível. Continua valendo que a pele é **uma só** em todas as telas, que a fonte é a do
sistema, que o laranja é o da pinta e que a decisão oficial tem um botão que não se parece com os
outros. As medidas tiradas do ChatGPT (pílula, canto de 28, item de 36) saem.

**D73 — A navegação do professor é a do mockup: a caixa de pedido em primeiro lugar, o time e o
histórico na lateral.** *(decidida pelo Gabriel em 20/09/2026, vista em mockup; ratificada pelo
Joaquim em 23/09/2026)*
Revisa a seção 1 do `docs/interface.md`, que estava marcada como decidida pelo desenho da call,
sem renumerar a Parte A. A lateral do professor tem **Nova conversa · Ferramentas · Calendário ·
Turmas**, e dois grupos: **Seu time** (Assistente de ensino e Tutor, cada um abrindo a própria
conversa em tela cheia) e **Histórico** (as conversas de verdade, por data). Cada item só
aparece quando a fase dele existir: Calendário nasce no F8, e Projetos e Fixados só entram se o
P05 for aprovado. "Meu painel" deixa de existir, e "Minhas turmas" vira **Turmas**, com o **Meu
uso** dentro (revisão do nome na D69). O menu da pessoa segue o P18, com "Sair" a um clique e do
mesmo tamanho dos outros (D59). Motivo: o professor abre o produto para pedir alguma coisa, e a
navegação da call punha na frente páginas que ele raramente abre; o Gabriel reprovou o desenho
antigo vendo, e o novo tem menos itens e nenhum que exista sem fase.
Revista em 12/10/2026 pela D80: a lateral do professor passa a **Início · Turmas · Ferramentas ·
Criados**, com as Conversas embaixo; "Seu time" sai da lateral e vira "Esperando você", no sino; o
Calendário deixa de ser lugar e, quando o F8 existir, é a visão Semana de Turmas. Continua valendo que
lugar sem tela não aparece.

**D74 — É ferramenta o que entrega um output próprio; o resto é pedido ao Assistente.**
*(decidida pelo Gabriel em 20/09/2026; ratificada pelo Joaquim em 23/09/2026)*
Ferramenta é a ação específica que entrega uma coisa com formato, que fica na biblioteca, sai em
arquivo e pode ser aplicada — um plano completo, uma apresentação, uma prova. O que o chat já
responde — e-mail, ideia de atividade, resumo de um texto, pergunta sobre um conteúdo — não é
ferramenta: é pedido ao Assistente de ensino, sem contrato próprio (D18). As ferramentas se
organizam em quatro categorias, com estes nomes na tela e na busca: **Planejar**, **Preparar a
aula**, **Avaliar** e **Corrigir**. As oito ferramentas novas que o mockup propôs (planejamento
do período, projeto, plano de recuperação, mapa mental, roteiro de experimento, avaliação
diagnóstica, proposta de redação e importar prova) **não** entram por esta decisão: cada uma
passa por `/descobrir` antes do F7, e na A2 a tela mostra só as que existem. Motivo: sem um
critério, cada pedido vira ferramenta, e o catálogo incha como os de "60 ferramentas" do mercado;
com ele, recusar um pedido de ferramenta tem resposta escrita, e o detector de intenção da D18
ganha os dois lados que precisa distinguir.

**D75 — O material da escola entra pela coordenação.** *(decidida pelo Joaquim em 23/09/2026)*
A base de material da escola é montada só pela coordenação: ela cria as disciplinas e sobe os
documentos, com a titularidade e a licença declaradas (D5, D22). Professor e aluno não sobem
material para a base. A titularidade continua sendo declarada (material da escola, do professor
autor, de terceiro com licença, de domínio aberto): quem sobe é a coordenação, de quem é o
material é a titularidade que ela declara. O anexo numa conversa (P07) é outra coisa, vale só
naquela conversa, e continua em aberto. Motivo: a licença é da escola, que é a controladora
(D10); com uma porta só de entrada, a D5 é conferida num lugar só, por quem responde por ela; e
é o fluxo que a escola já tem, em que a coordenação distribui o material.

**D76 — A equipe Turmma tem um painel de operação: cria rede e escola, convida a coordenação e
acompanha uso e custo por escola, sem ver dado de pessoa.** *(decidida pelo Joaquim em
23/09/2026)*
Quem entra é só o **operador Turmma**, com conta separada das contas de escola: a primeira nasce
por comando, porque alguém precisa existir antes da tela, e o segundo fator é obrigatório. O
painel cria rede e escola; gera, revoga e refaz o convite da primeira coordenação; lista as
escolas com o estado e com contagens — turmas, alunos e professores ativos —; e mostra o uso de
infra de cada escola no dia e no mês, que já é medido desde o F0 (D30). Com a A2, a mesma tela
passa a mostrar o consumo de IA por escola, em tokens e em reais estimados pelo preço de cada
perfil, contra o teto por aluno (D39); o custo de infra em reais espera o provedor de hospedagem
(D42). O painel **não vê** nome, matrícula, nota, conversa nem material de ninguém: a escola é a
controladora do dado (D10), e nenhuma ação do operador devolve dado de pessoa (RF1 do F1). A
leitura entre escolas é a exceção da regra 10, item 9: um módulo só, com a justificativa escrita
em cada consulta sem escopo, e teste provando que usuário de escola não alcança o painel e que o
painel não devolve dado de pessoa. Toda ação do operador vai para a auditoria com o identificador
dele. Os comandos `ops:*` continuam existindo, e a D2 continua valendo: não é cadastro público.
Motivo: a validação do MVP começa com a escola nascendo numa tela, e as metas de custo (D30,
D39) só se conferem olhando escola por escola; comando no terminal com o token num arquivo não
serve à equipe inteira. Fica numa spec própria, a A0, antes da A1, porque é outra superfície de
segurança, com revisores próprios, e a A1 já estava no teto do PRD. Na revisão da spec, no mesmo
dia, a A0 foi dividida em duas: a **A0**, identidade do operador e a pele da D72, e a **A0b**, o
painel.

**D77 — O MVP de apresentação (A2 a A5) é uma fatia só, com processo enxuto.** *(decidida pelo
Joaquim em 04/10/2026)*
Revisa a D71 ("mesmas regras e mesmo processo"), a D23 e a D53 **apenas para esta fatia**, e só
enquanto o dado for sintético. O que muda: (1) a A2 a A5 viram **uma fatia**, com os contratos
primeiro — tabelas, schemas de API e `MATRIZ` numa migration só —, em vez de cinco PRDs, Tech
Specs e listas de tarefas; o plano é o `docs/mvp-rapido.md`. (2) O commit de código leva o
marcador `(mvp: <resumo>)`, com o portão local (`node tools/processo/portao-local.ts`) a cada
commit. (3) A esteira, que só roda sozinha em `develop`, `release` e `main`, é disparada à mão na
branch, com `gh workflow run esteira --ref mvp/apresentacao`, no fim de cada fase, e não por
commit. (4) Os revisores com veto — `tenancy-guardian`, `privacy-guardian` e
`conformidade-reviewer` — passam uma vez por fase, e o `test-engineer` entra nas fases de nota,
correção e Tutor. (5) A execução de IA roda no processo da API, atrás de uma interface, com
consulta a cada segundo, em vez de job do worker: dívida declarada, marcada `TODO(fila)`. O que
**não** muda: as regras 10, 20, 30, 40 e 70; o teste de isolamento por módulo; o teste de que
nada chega ao aluno sem aprovação registrada; e a D55, a D56, a D47, a D57, a D58 e a D66.
Motivo: a A1 levou cerca de sete dias, a esteira leva cerca de 30 a 40 min por commit, e o
roteiro de demonstração precisa estar de pé em 06/10/2026. Revisão: o processo completo volta
antes da primeira escola real — F2, F3 e o portão do piloto.

Revista em 23/10/2026, na X7 (`harness`), pelo Joaquim no terminal do Arquiteto: o caminho `(mvp: …)` sai
do hook. Uma fatia sintética nova, se vier, roda no processo de hoje: as linhas da D79 já dão a
velocidade que o processo enxuto buscava, e o caminho, sem branch `mvp/` desde 05/10/2026, era código que
ninguém exercitava (U11-10).

**D78 — O processo roda no Maestri: um andar por spec, um comando, e modelo por papel.** *(decidida
pelo Joaquim em 08/10/2026)*
Revisa a D23 (onde o trabalho acontece e quando a esteira roda) e a D53 (quem chama os revisores e
quais comandos existem). O que muda: (1) **cada spec roda num andar do Maestri**, com a branch
`spec/<funcionalidade>`, do PRD à validação, e só entra na `develop` por pouso, com a palavra do
Joaquim; correção avulsa vai em `correcao/<slug>`. (2) **A esteira roda uma vez por spec** (revisto pela D79: em todo push), na
branch, antes do pouso, e de novo na `develop` depois dele; por tarefa valem o portão local
carimbado e os revisores (regra 40 atualizada). (3) **Um comando, `/seguir`**: o Orquestrador
calcula a fase por `tools/processo/estado.ts` e conduz até a próxima parada; os outros comandos
viram procedimento interno dos agentes. (4) **Um time fixo de cinco terminais, no térreo**: o Orquestrador, que é o terminal Maestro e segue
o `/seguir`, e quatro papéis definidos em `.claude/agents/` e iniciados com `claude --agent`. Os
terminais não são criados nem dispensados por spec, para o Joaquim ver sempre as mesmas caixas: o
que muda a cada tarefa ou fase é a sessão, reiniciada já apontada para o checkout do andar.
Orquestrador, Arquiteto e Validador em Opus 5.5; Implementador em Haiku 5.5 (esforço xhigh) nas
tarefas de porte pequeno e em Sonnet 5.5 nas de porte grande; Mesa de revisão em Sonnet 5.5. O porte
é marcado pelo Arquiteto no `N_task.md`. (5) **Quem
chama os revisores é a Mesa de revisão**, que monta o prompt pela árvore e traduz cada reprovação em
ordem de correção exata (arquivo, função, trecho, o que mudar), para o Haiku aplicar sem interpretar.
Os revisores continuam subagentes, porque a rodada só é registrada pelo fim do subagente, e os seis
com veto rodam em Opus, como teste a medir na retrospectiva. (6) **Autonomia:** falha técnica vira
correção e a execução segue. O Orquestrador para em seis decisões — aprovação de PRD, Tech Spec e
lista de tarefas; mudança de desenho ou de critério de aceite; ressalva da validação; propostas da
retrospectiva; decisão de produto; pouso — e num limite: duas reprovações seguidas do mesmo revisor
sobem a tarefa para o Sonnet, e três param. Push na branch do andar é livre; notificação, só em
parada e no fim da spec. (7) Uma spec ou uma correção por vez: o time é um só, e o compose de teste é um só na máquina.
Trabalho em paralelo fica para uma segunda fase. (8) O Gabriel usa o mesmo time: por isso os papéis ficam versionados no
repositório, e não em configuração do Maestri.
O que **não** muda: as regras 10, 20, 30 e 70; o hook que bloqueia o commit sem revisão válida e sem
carimbo, que passou a avaliar o commit na árvore em que ele acontece (`git -C <andar>`), e não na
da sessão, a recusar o comando que faz outra coisa antes do commit, e a bloquear o push de agente do
time na `develop`, na `release` e no `main`; um agente novo por tarefa; a validação em contexto limpo; a retrospectiva só propõe.
Motivo: o Joaquim digitava treze comandos e era o relógio do processo; o subagente de tarefa morria
junto com a sessão principal (a 2.0 e a 3.0 do F3); a esteira por commit custava de 20 a 40 minutos
de espera por tarefa; e o implementador, em Opus, era 63% do consumo do plano. A prova técnica de
08/10/2026 fixou duas coisas: agente criado com *responsabilidade* do Maestri nasce fora da raiz do
repositório e nenhum hook dispara, por isso o papel vem de `.claude/agents/`; e o Maestri copia o
andar sem as pastas `dist`, por isso todo andar novo roda `npm ci`.
Revisão: os modelos do Implementador e dos revisores se decidem pelos números da retrospectiva do F3
(rodadas e reprovações por modelo); a esteira uma vez por spec (revista pela D79: em todo push) volta à mesa na primeira vez em que
uma falha no fim custar mais do que as esperas que ela poupou, e antes da primeira escola real.

Revista em 09/10/2026, pelo Joaquim, com os números da primeira noite (tarefas 5.0 e 6.0 do F3): o
portão local inteiro levou de 30 a 40 minutos por execução e foi de 70% a quase 100% do tempo de
cada tarefa, enquanto a rodada de revisão levou de um a quatro minutos; a 6.0 foi escrita em 6
minutos e passou cinco horas rodando o portão inteiro a cada tentativa de acertar um teste. O que
muda: (a) **na tarefa e na correção roda o portão da tarefa** — tipos, lint, a unidade inteira e só
os testes de integração, de e2e e de infra que a árvore alterou —, e **o portão completo roda uma vez
por spec**, antes da validação, seguido da esteira; teste que não passa se roda isolado, nunca pelo
portão. (b) O `test-engineer` continua sozinho e primeiro (revisto pela D79: todos rodam juntos), porque muta arquivo e usa o banco de teste
enquanto revisa, mas **os outros revisores rodam logo depois dele mesmo quando ele reprova**, para
cada rodada sair com todos os achados. (c) **Uma ordem de correção só**, com os bloqueantes e as
recomendações baratas juntos; não há mais ciclo só para aplicar recomendação depois de tudo aprovado.
Tarefas em paralelo foram avaliadas e ficaram de fora: o gargalo era o portão, que é um só na máquina,
e o ganho estimado com dois ambientes de teste (de 1,1 a 1,4 vez) é menor que o de encurtar o portão.
O preço aceito: o que uma tarefa quebra fora dos testes que alterou só aparece no fim da spec.
(d) **As duas guardas da esteira que não são teste entram em todo portão local**: o gitleaks (segredo
commitado) e o `npm audit`. Levam segundos, e sem elas a surpresa ficava para a esteira do pouso: em
09/10/2026 o gitleaks já reprovava a branch do F3, por uma linha `Sort Key:` de um plano do Postgres
colado no documento da 5.0, que ganhou exceção no `.gitleaks.toml`.
Revisão: se o portão completo do fim do F3 trouxer falha que custe mais para achar do que o tempo
poupado, entra um portão completo de conferência a cada quatro ou cinco tarefas.

Revista de novo em 09/10/2026, pelo Joaquim: **o Implementador roda em Sonnet 5.5 em toda tarefa**, e o
Haiku sai. Na 6.0 do F3 o Haiku escreveu a tela em 6 minutos e passou mais de cinco horas ajustando um
teste por tentativa; a 7.0, em Sonnet e já com o portão da tarefa e o contexto de teste no documento,
fechou em 30 minutos. O porte da tarefa deixa de escolher modelo e passa a dizer só quanto ela deve
levar. Em vez de trocar de modelo, quem trava recebe mais contexto: o relatório do que tentou e, na
segunda falha ou na segunda reprovação seguida, o diagnóstico do Arquiteto. Revisão: o Haiku volta às
tarefas pequenas se a retrospectiva mostrar que, com o contexto de teste, ele não custa mais portões.

Revista pela terceira vez em 09/10/2026, pelo Joaquim: **tela se revisa vendo, e quem revisa responde
pela entrega.** `tools/vitrine/` monta duas escolas sintéticas no ambiente de teste, uma cheia e uma
vazia, com um login de cada papel, e fotografa a página nos dois tamanhos de toda tela. Em tarefa com
tela: o Implementador olha antes do portão; a Mesa fotografa as telas da tarefa uma vez e entrega as
fotos a **todos** os revisores da rodada, cada um pela regra dele; o `frontend-reviewer` começa pela
foto e tem uma lista do que é bloqueante por ser visível e mensurável; e, no fim da spec, o Validador
fotografa cada RF com tela, e RF com tela sem foto lida é no máximo parcial. Não é seed do produto nem
da demonstração (D71): as escolas moram só no banco de teste e somem quando o portão o recria. A foto
sai do Chromium do Playwright, sem janela, porque a foto da página do canvas do Maestri só funciona com
a janela dele visível, e o processo roda sem ninguém olhando. Motivo: o e2e prova que a tela funciona,
não que ela está bem resolvida; no primeiro ensaio a foto achou, na tela da 8.0 do F3, uma barra de
abas quebrada em 360 px que a revisão pelo código tinha aprovado. A próxima spec é um refatoramento
visual. O `frontend-reviewer` continua sem veto no hook: o que segura a tarefa é a Mesa, que trata o
bloqueante dele como o de qualquer revisor. Revisão: dar a ele o veto no hook se a retrospectiva
mostrar tela reprovada indo para o commit.

Revista pela quarta vez em 09/10/2026, pelo Joaquim: **o Implementador sai do Claude Code e roda no
opencode, com o MiMo-V2.6-Pro**, pela assinatura OpenCode Go. O objetivo é fazer o plano do Claude
durar mais. A medição das primeiras 18 horas do processo no Maestri, ponderada por preço, deu:
Implementador 31% do consumo, revisores em Opus 27%, Orquestrador 24%, Arquiteto 10% e Mesa 8%. O
Implementador é o maior papel e o único que sai inteiro sem enfraquecer o portão: tudo o que ele
escreve passa pelos revisores antes do commit, e os revisores, a Mesa, o Arquiteto, o Validador e o
Orquestrador continuam no Claude. O que entra no repositório: `.opencode/opencode.jsonc` (o modelo e o
agente com que a sessão nasce), `.opencode/agents/implementador.md` (o papel) e
`.opencode/plugins/portao-de-revisoes.ts`, que faz no opencode o que o hook PreToolUse faz no Claude
Code: entrega cada `git commit` e cada `git push` ao mesmo `tools/processo/hook-revisoes.ts` e veta a
ferramenta com o motivo. `.claude/agents/implementador.md` fica como **reserva**, com o mesmo texto
(um teste reprova a diferença): se o opencode não subir, o Orquestrador volta ao Sonnet com um
comando. A prova técnica de 09/10/2026 fixou quatro coisas do opencode 2.0.26: a TUI não tem `--agent`
nem `--model`, e o `model` do arquivo do agente não escolhe o modelo da sessão, por isso os dois vêm
da configuração do projeto e toda sessão do opencode neste repositório nasce como Implementador; ele
não lê o `CLAUDE.md` nem `.claude/rules/`, por isso o papel manda ler; ele lê `.claude/skills/`; e o
erro lançado no gancho `execute.before` cancela a ferramenta e chega ao modelo com o texto. O preço
aceito: pelo Artificial Analysis o MiMo empata com o Sonnet 5.5 em inteligência (46 contra 47), mas
gera a 42 tokens por segundo contra 105 e escreve 2,7 vezes mais, então a tarefa demora mais; e cada
rodada de revisão a mais custa cerca de US$ 5 em Opus, contra US$ 7 a 19 que uma tarefa custava de
Implementador. O Joaquim decidiu trocar direto, sem piloto. O que **não** muda: o hook, os vetos, o
portão da tarefa, a Mesa chamando os revisores e as seis paradas. Revisão: na retrospectiva do F3,
pelas rodadas por tarefa e pelo tempo por tarefa do MiMo contra o Sonnet; se as rodadas subirem, o
papel volta à reserva. Não medido ainda: o teto de uso da assinatura.

Revista pela quinta vez em 09/10/2026: **o Implementador volta ao Sonnet, e o opencode fica como modo
econômico, que o Joaquim liga.** O Joaquim pediu a medição da troca, com o tempo por tarefa, e deixou a
decisão com o Claude caso ela viesse ruim. Duas tarefas do F3 rodaram no MiMo, as duas de porte grande
e com seis revisores. A 11.0 (2.444 linhas de código) levou 3 h 47 min, pediu a primeira rodada aos
2 h 43 min, teve quatro reprovações na primeira rodada e fechou na terceira; a 12.0 (808 linhas) levou
3 h 08 min, pediu a primeira rodada aos 2 h 25 min, teve três reprovações na primeira e fechou na
segunda. Em Sonnet, a 9.0 (2.414 linhas) levou 57 minutos e a 10.0 (1.134 linhas), 93 minutos. O
consumo do Claude por tarefa, ponderado por preço, não caiu: 35,2 e 26,9 no MiMo, contra 36,0 e 27,7
em Sonnet. O que a troca alcança caiu, como previsto (Implementador, Mesa e Orquestrador somados
foram de 24,2 e 18,6 para 10,9 e 10,7), mas revisores e Arquiteto subiram de 11,8 e 9,1 para 24,3 e
16,3, porque as duas tarefas tinham mais revisores e cada uma pediu o Arquiteto uma vez, e a vigia do
Orquestrador custou o dobro por durar o triplo. Lida a favor do MiMo, a economia é de uns 25% do Claude
por tarefa, em troca de duas horas a mais em cada uma: só compensa se o que limita o trabalho for o
teto semanal do plano, e não o relógio. O processo em si funcionou nas duas: o pedido chegou, a trava do
commit segurou, nenhuma queda para o Sonnet, e a assinatura não acusou limite (US$ 1,18 e 1,05 no
contador do opencode). Por isso nada sai do repositório: `.opencode/` e o teste continuam, e o
`/seguir` usa o opencode enquanto o `estado.md` trouxer `**Implementador:** opencode` em "Agora".
Sobra para a retrospectiva do F3: os revisores com veto em Opus e a vigia do Orquestrador são hoje a
maior parte do consumo de uma tarefa, e é neles que está o corte que não custa tempo.

Revista pela sexta vez em 10/10/2026, a pedido do Joaquim: **o contexto de cada agente passa a ter
teto, e a vigia deixa de recarregar o `/seguir`.** Nenhum modelo e nenhum revisor mudou. A medição,
de 09/10 às 9h a 10/10 à 1h30, ponderada por preço: Implementador 108, Orquestrador 104, revisores 97,
Arquiteto 38, Mesa 23. Três desperdícios, cada um com a sua correção.
(1) **Nenhuma sessão compactava**, porque a janela de compactação do Claude Code vinha em 1 milhão de
tokens. O Implementador da 13.0 chegou a 948 mil em 282 chamadas e custou 42, e 77% do que o
Implementador gasta é reler o próprio contexto a cada chamada. Agora `autoCompactWindow` é 400 mil, em
`.claude/settings.json`, para todo o time. Simulado sobre as mesmas sessões: Implementador −30%, com
uma compactação em tarefa grande e três na 13.0; Orquestrador −46%; Mesa e Arquiteto iguais, porque
não chegam lá. Com 300 mil o Implementador ganharia mais seis pontos, ao preço do triplo de
compactações, e a Mesa e o Arquiteto passariam a compactar sem ganho. O que protege o trabalho depois
da compactação é o hook de início de sessão, que diz a cada papel o que reler (a tarefa e a ordem, a
seção "Revisões", o `/seguir` e o `estado.md`).
(2) **A vigia recarregava o `/seguir` inteiro a cada 30 minutos**: 24 vezes em doze horas, 71% do que
entrou no contexto do Orquestrador, que foi de 87 mil a 509 mil tokens com cada turno custando o triplo
do começo. A vigia ganhou skill própria e curta (`/vigia`). A medição mostrou também que as mensagens
`/seguir RELATÓRIO` dos agentes chegam coladas e nunca executaram a skill: quem devolve o procedimento
à sessão limpa ou compactada do Orquestrador passa a ser o mesmo hook.
(3) **Os revisores gravavam o cache pelo preço de uma hora** (o dobro do normal), herança de quando o
executor era subagente e esperava o portão. Hoje subagente é só revisor: 78 execuções, o maior
intervalo entre duas chamadas foi de 66 segundos, a primeira chamada lê do cache 3 mil dos 38 mil
tokens com que começa, e 70% do custo deles é essa escrita. `subagentPromptCacheTtl` volta a `5m`:
−26% nos revisores. O que o papel de terminal grava continua em uma hora, porque ele espera a rodada.
Somado, a estimativa é de uns 28% a menos de consumo do Claude no processo, sem mexer em tempo nem em
portão. Provado num diretório de rascunho, com o Haiku: a janela do projeto vale para sessão com
`--agent`, o agente compactou quatro vezes no meio de uma tarefa e a terminou certa, o aviso do hook
chegou a ele, e o subagente gravou em cinco minutos. **Sem prova:** a qualidade de uma tarefa real do
Implementador depois de compactar, e a edição da rotina pelo Orquestrador. A retrospectiva do F3
compara as tarefas antes e depois, por reprovações na primeira rodada. A base fixa (`CLAUDE.md` e
regras, 31 mil tokens em toda sessão e em todo revisor) ficou como está: é um terço do custo de cada
revisão, e enxugá-la é decisão de conteúdo, não de configuração.

Revista pela sétima vez em 10/10/2026, por proposta do Joaquim: **o Orquestrador limpa o próprio
contexto a cada tarefa.** O time já recomeçava a sessão a cada tarefa; ele era o único que carregava a
funcionalidade inteira na conversa. Medido nas duas sessões dele no F3 (08 a 10/10): 82% do que ele
custou foi reler a conversa a cada chamada (76 de 92, ponderado por preço), com o contexto saindo de 85
mil tokens e passando de 500 mil. O teto de 400 mil da revisão anterior não pegou nele: a sessão era
anterior à configuração e chegou a 548 mil. Simulado sobre as mesmas sessões: o teto sozinho daria uns
35% a menos, e a limpeza por tarefa, uns 50%. A limpeza também é melhor que a compactação pelo que ele
relê: o arquivo como está, e não um resumo da conversa. Como funciona: depois de pedir uma tarefa nova,
o portão completo ou a validação, e com o "Agora" do `estado.md` em dia, ele solta um processo que
espera o turno acabar e dispara a rotina `Limpa o Orquestrador`, que digita `/clear` no terminal dele.
Na sessão limpa, o hook de início de sessão manda reler o `/seguir`, o protocolo e as seções "Agora" e
"Esperando o Joaquim" do diário, e não mais o arquivo inteiro, que no F3 passou de 37 mil caracteres;
"Agora" ganhou a linha "Devo ainda". Provado no F3, às 02:10 de 10/10: a rotina disparada de dentro do
turno é pulada, porque o Maestri não dispara em terminal ocupado; disparada 25 segundos depois, por um
processo solto, limpou a sessão; e `/clear` enviado por outro terminal ligado a ele também limpa.
Nenhum modelo, revisor ou portão mudou. **Sem prova ainda:** uma tarefa inteira conduzida da sessão
limpa, do relatório ao pedido seguinte. Revisão: na retrospectiva do F3, pelo custo do Orquestrador por
tarefa antes e depois, e por qualquer coisa que ele tenha deixado de fazer por não estar no "Agora".
Ficou para a mesma retrospectiva, com o número que decide cada uma: o Orquestrador em Sonnet, a vigia
que só acorda o modelo quando há algo preso, e um teto de tamanho por tarefa (as três do F3 com
documento acima de 200 linhas foram as três com quatro rodadas ou escalada).

Revista pela oitava vez em 10/10/2026, a pedido do Joaquim, que perguntou por que o processo demora
depois de ficar mais barato. Medido na 14.0 e na 15.0 do F3, as duas primeiras com a revisão anterior:
o Orquestrador custou de 2,3 a 4,2 por tarefa (antes, de 7,5 a 11), sem deixar de fazer nada; o
Implementador, 16,6 e 22,6, contra 44,5 na 13.0; e as tarefas levaram 70 e 105 minutos. O tempo vai em
três lugares: a fila é uma só; nenhuma das quinze primeiras tarefas passou de primeira na revisão, o
que custa de 25 a 45 minutos em cada uma; e a linha inteira espera o Joaquim em toda parada. Duas
mudanças:

**A parada segura só o que depende dela.** A pergunta da tela "Login suspenso", aberta às 06:10, ficou
3 h 10 sem resposta, mais do que as duas tarefas da madrugada somadas, e a 16.0, que não mudava em
nenhuma das três opções, esperou junto. Agora, com uma parada de aprovação de tarefas, de desenho ou de
produto aberta, o Orquestrador confere se a tarefa da vez depende dela; se não depende, a tarefa segue,
com a pergunta aberta e o andar marcado como bloqueado. As seis paradas continuam do Joaquim: ninguém
escolhe por ele, e nada que dependa da resposta é adiantado. Com tarefa correndo, ninguém escreve
documento no andar: o Arquiteto guarda a resposta e aplica depois do commit da tarefa. Validação,
retrospectiva, pouso, conflito de merge e os dois limites continuam parando tudo.

**O Implementador confere três coisas antes de pedir a primeira rodada:** cada linha de "Mutações"
vista vermelha na árvore atual (a 15.0 escalou por linha preenchida sem rodar), cada cláusula do diff
com a sua linha (em onze das quinze tarefas o `test-engineer` reprovou por regra sem teste que falhe
sem ela), e as listas fechadas. Estas são testes que enumeram rotas, métricas ou arquivos, e que o
portão da tarefa não roda: a 11.0, a 13.0, a 14.0 e a 15.0 deixaram três vermelhas, que só apareceram
quando as suítes inteiras rodaram com o andar parado, e viraram uma correção antes da 16.0. O
procedimento ganhou a busca pelo vizinho que já existia, para achar quem enumera.

**Avaliado e não feito: duas tarefas ao mesmo tempo.** É o maior ganho de tempo (a 16.0 e a 18.0 não
dependem uma da outra), mas o ambiente de teste é um só por máquina (`educa-teste`, com portas fixas e
banco limpo a cada portão), e duas suítes juntas se destroem. Pede um segundo ambiente de teste por
checkout, um segundo andar e a regra de como as duas branches se encontram: trabalho próprio, antes da
próxima spec, e não no meio desta. **Sem prova ainda:** uma parada aberta com tarefa correndo, e uma
tarefa que passe de primeira. Revisão: na retrospectiva do F3, pelas rodadas e pelo tempo da 16.0 à
20.0 contra a 11.0 à 15.0.

**D79 — O processo é revisto para tempo: a esteira em todo push, o portão prova as mutações, os
revisores rodam juntos, e dois avisos no lugar de duas paradas.** *(decidida em 11/10/2026, com a
aprovação antecipada do Joaquim: ao mandar executar o redesenho do processo, depois da retrospectiva
do F3, ele escreveu "aprovo tudo")*
Revisa a D78. Motivo, pelos números do F3 (`tasks/prd-lgpd-e-titular/retro.md`): 55 horas de relógio
para 16 tarefas e 9 correções; mediana de 99 minutos por tarefa; uma tarefa em vinte sem reprovação;
4 h 52 do último commit de tarefa à validação aprovada, metade delas no portão completo, que rodou
duas vezes; e três listas fechadas vermelhas por até quatro tarefas sem ninguém ver. Na 18.0, de tela,
110 dos 188 minutos foram Playwright. O que muda: (1) **A esteira roda em todo push** de `spec/**` e
de `correcao/**`, e ninguém espera por ela: o Orquestrador lê o veredito ao fechar a tarefa seguinte
(`tools/processo/esteira.ts`), e vermelho vira correção antes de a linha andar. O portão completo
local deixa de ser etapa do fim da spec; a validação começa logo depois do último commit, em paralelo
com a esteira dele, e o fechamento exige as duas no último commit que alterou código. Sem GitHub, o
portão completo local vale no lugar. (2) **O portão da tarefa prova as mutações**: a seção "Mutações"
do documento vira bloco que máquina lê, e o portão aplica cada um, roda o teste citado, exige vermelho
e restaura (`tools/processo/mutacoes.ts`); o carimbo guarda a impressão dos blocos, e o commit é
bloqueado se eles mudaram depois. Saem as conferências em texto da oitava revisão da D78, que não
mexeram no número (59% de reprovação na primeira rodada, antes e depois). O lint passa a recusar
`.skip`, `.only` e parecidos em teste. (3) **Os revisores rodam juntos**, com o `test-engineer` entre
eles: ele não muta mais arquivo. A ordem de correção da Mesa leva o achado com as palavras do revisor
e o ponto exato, e não dita regra, texto de tela nem código: três das cinco escaladas do F3 nasceram
de ordem que ditou sem conferir. (4) **Tarefa e spec menores**: uma tarefa entrega um comportamento e
marca até três guardiões com veto; a spec mira doze tarefas; e o Implementador lê da Tech Spec e do
PRD o que o documento da tarefa aponta. (5) **Dois avisos no lugar de duas paradas**: a Tech Spec
pronta e a lista de tarefas. O Arquiteto mostra e segue, e a construção começa 30 minutos depois da
lista, sem objeção. O PRD, a mudança de desenho, a ressalva da validação, as propostas da
retrospectiva, a decisão de produto, o pouso e os dois limites continuam parada. (6) **Spec fora da
sequência** entra como item `X<n>` do `ROADMAP.md`, escrito pelo Arquiteto antes do PRD, na posição
que diz a ordem dela. (7) **Sai o modo econômico** (o opencode com o MiMo-V2.6-Pro): duas tarefas
medidas, o dobro do tempo, o mesmo consumo do Claude, e um papel mantido em dobro. O que **não** muda:
as seis regras, o veto das regras 10, 20 e 70, o hook do commit, o dado sintético, e o que é do
Joaquim (nota, pouso, push e decisão de produto). **Avaliado e não feito:** duas tarefas da mesma spec
em paralelo, que é a mudança de maior risco para a orquestração e só uma spec prova; a vigia com
`--pre-run`, que poupa custo e não tempo; e modelo menor para o Orquestrador e para os revisores, que
a retrospectiva mediu e não sustentou. **Sem prova ainda:** quantas tarefas passam de primeira com o
portão novo, e o efeito do teto de tarefa, que só uma spec inteira mede. Revisão: na retrospectiva da
próxima spec, com as mesmas medidas da retrospectiva do F3.
**Revista em 11/10/2026, no mesmo dia, a pedido do Joaquim** (sobre as tarefas em paralelo: "não
precisa ser só 2 tasks, podem ser mais"; e depois: "aplique o que vai melhorar o projeto"). Entram dois
dos três itens avaliados e não feitos. (8) **A construção corre por linhas.** Cada linha é um andar com
a branch `spec/<func>--l<n>`, o ambiente de teste `n` e um par de Implementador e Mesa; a linha 1 usa o
par de sempre. O teto é três, o de ambientes de teste da máquina. Quem autoriza duas tarefas juntas é o
Arquiteto, na coluna "Pode correr em paralelo com" do `tasks.md`; `tools/processo/linhas.ts` confere
pelos "Arquivos previstos" das duas, que passam a levar caminho de verdade, e nunca põe juntas duas
tarefas com migration, schema ou contrato compartilhado. Sem autorização, corre uma tarefa por vez, na
linha 1. O Orquestrador não escolhe nem confere de memória: o quadro diz quem parte (`partida`), e o
`encontro` de cada tarefa exige a marca e a linha `Revisões:` em todo commit novo com código, traz a
branch da spec para a linha, avança a da spec e faz o push, que dispara a esteira sobre a soma. Conflito
de código para o encontro e vira correção na própria linha, e o hook cobra dela só o que divergiu dos
dois lados (`arquivosAlterados`, com merge em curso): o que veio igual da outra linha já passou por
revisão lá. No andar da spec ninguém implementa. `achados/indice.md` se junta por união
(`.gitattributes`). A imagem que o compose de teste constrói leva a etiqueta do ambiente
(`.processo/compose-de-teste-N.yml`, gerado por `tools/ci/compose.ts`): provado com um e2e verde no
ambiente 1, em 68 segundos, sobre imagens `educa-*:teste-1`. (9) **A vigia só acorda o Orquestrador
quando há o que olhar**: a rotina roda antes `tools/processo/vigia.ts`, que não imprime nada com alguém
do time trabalhando há menos de duas horas, e na dúvida acorda. O veto, o hook, o portão da tarefa e as
paradas não mudam. **Sem prova ainda:** os comandos do Maestri para o andar e o par de uma linha a
mais, o e2e de três linhas ao mesmo tempo nesta máquina, o consumo por hora do plano com mais de um par,
quanto tempo de spec as linhas tiram, e se o comando vazio da rotina de fato não acorda o modelo. Para
desfazer sem mexer em código: não autorizar paralelo no `tasks.md`.
Revista em 23/10/2026, na X7 (`harness`), pelo Joaquim no terminal do Arquiteto: (1) o commit exige a
rodada de cada guardião com veto que o caminho alterado pede, por uma tabela no código do hook, somada à
marcação da tarefa: código em `apps/`, `packages/`, `e2e/` e `tools/guardas/` pede os quatro, e o que pede menos é
exceção escrita com motivo (a tabela fina por pasta não convergiu em duas rodadas de revisão); o teto de três
guardiões vale para o que o Arquiteto marca. (2) Tarefa ou correção
que altera código de produção (`apps/*/src`, `packages/*/src`) sem nenhum bloco de mutação e sem a linha
"Sem mutação: <motivo>" não recebe carimbo, e o portão lista antes da Mesa as condições novas que nenhum
bloco alcança. Motivo: sem o rótulo certo, os guardiões de tenant e de privacidade sumiam sem erro
(U11-4), e zero mutações passava o portão (U11-8); a cláusula sem mutação foi a reprovação que mais
voltou, 10 vezes na X5, sem mudar com quatro specs de texto. (3) Mais dois avisos no lugar de parada, na
lista da D78: a proposta da retrospectiva que muda só skill, papel ou modelo de documento (o Arquiteto mostra
e aplica depois de 30 minutos sem objeção; código de processo, regra, decisão, a lista de um guardião com
veto e as skills que decidem a marcação de guardião continuam parada), e a
ressalva menor da validação, que vai para o `TODO.md` com dono e não segura o pouso (crítica e maior
continuam parada, e achado das regras 10, 20 e 70 nunca é menor). Motivo: nas últimas retrospectivas o Joaquim escolheu sempre o que o Arquiteto
recomendou, e a parada só custou espera.
Revista em 24/10/2026, na retrospectiva da X7, pelo Joaquim no terminal do Arquiteto ("tudo o recomendado"): o grupo
de confirmação da retrospectiva passa a ter, além da lista "O que verificar" de um guardião com veto, o resto do arquivo
de cada revisor com veto, o `mesa-de-revisao.md` e a seção 6 do `validador.md`. Motivo: uma proposta que mudasse quem
aprova ou como se classifica um achado cairia no aviso de 30 minutos, e o veto não pode mudar sem a palavra do Joaquim
(17.0 da X7, `conformidade-reviewer`).

**D80 — A pele do produto é o sistema Turmma do mockup de outubro: cor por família, borda de 2 px
com degrau sólido, ícone ilustrado, a onça como mascote, modo escuro, e até quatro lugares por
papel.** *(decidida em 12/10/2026, com a delegação do Joaquim: ao pedir as specs que deixam o produto
igual ao mockup novo do Gabriel, ele escreveu "você pode tomar todas as decisões para o projeto, eu
Joaquim permito"; o Gabriel desenhou e escolheu a pele nas rodadas 10 a 14, de 04 a 07/10/2026)*
Revisa a D72 (a pele e o padrão de espaço), a D73 (a navegação do professor) e a D69 (onde mora o
Meu uso), e fecha três decisões em aberto: os avatares dos agentes, as abas da turma aberta e o modo
escuro. O mockup é o de `Prototipo_Turmma`, branch `mockups/interface`, commit `a95568d`; os números
de decisão citados nos comentários dele (D61, D70, D78 a D80) **não** são os deste documento.
(1) **A pele.** Branco no chão, dez famílias de cor (laranja, azul, verde, amarelo, vermelho, roxo,
turquesa, anil, lima e rosa), cada uma com face, degrau, claro, borda e texto; borda de 2 px e degrau
sólido de 4 px no lugar de linha fina e sombra borrada; canto de 12 px no botão e de 16 no cartão;
fonte do sistema em peso 500 no corpo e 700 no resto, com rótulo de ação em caixa-alta; foco em anel
azul de 3 px. O **laranja** é a ação de criar e pedir, com texto escuro em cima; o **grafite** é a
decisão oficial (aprovar, confirmar), que continua sem se parecer com nenhum outro botão (regra 50,
item 8); o **azul** é seleção e link. Um botão cheio por tela. Os valores estão no bloco da seção 9.9
do `docs/interface.md`, que o teste da web lê.
(2) **Modo escuro**, nos tons do mockup: Sistema, Claro ou Escuro, escolha guardada no navegador. Nenhuma
tela escreve cor por tema: quem usa token muda sozinho.
(3) **A onça é a mascote e o avatar dos três agentes** (o anel do Assistente em azul, o do Tutor em
laranja, o do Analista em anil), sempre com o nome da função e o selo "IA" à vista no mesmo bloco. É
um animal desenhado, com o traço do mockup de outubro: o avatar tem uma expressão neutra só, e a onça
de corpo inteiro tem o rosto da pose, o do mockup, que só a pose escolhe, nunca quem usa. Não tem nome
próprio nem traço de pessoa, não fala por conta própria, não diz que sente, não reage à presença, à
ausência, ao acerto nem ao tempo de uso de ninguém, e não simula vínculo (D58; Decreto 12.880, arts. 10
e 11). O círculo com o ícone da função sai. Pose, lugar e movimento novos da onça só entram com
parecer do `conformidade-reviewer`, na spec ou na correção que os trouxer.
(4) **Ícone ilustrado** nos lugares da navegação, nas matérias, nos tipos da fila e nas ferramentas,
desenhado por nós; o resto continua `lucide-react`.
(5) **Até quatro lugares por papel**, iguais na lateral e na barra de baixo do celular. Aluno: Início
(a conversa com o Tutor), Tarefas, Eu e Avisar um adulto. Professor: Início (a caixa de pedido),
Turmas, Ferramentas e Criados, com as Conversas embaixo. Coordenação: Painel, Analista, Escola e
Registros. Operação: uma tela, com barra de topo. Rede: Painel, Analista e Escolas, quando o F14
existir. "Seu time" sai da lateral: o que um agente deixa esperando vira item de **"Esperando você"**,
no sino do professor e da coordenação, e o agente continua assinando o que fez. O **Meu uso** sai de
Turmas e vai para a conta do professor. A turma aberta tem três abas: **Hoje, Atividades e Alunos**.
Continua valendo o que a D73 fixou: lugar sem tela não aparece.
(6) **Padrão de página.** Toda tela da lateral tem título visível, menos a conversa (revê o P03); até
três abas, nunca uma dentro da outra; linha inteira clicável; o detalhe abre num painel ao lado, de
480 px, e como folha de baixo no celular; quatro tipos de página, com as larguras da seção 9.3 do
`docs/interface.md`.
(7) **O que do mockup não entra, de propósito.** Regra vence desenho. (a) Mecânica de uso compulsivo:
sequência de dias, pontos por tempo, vidas, ranking, pódio, notificação insistente e recompensa
variável (D59, D57). A comemoração aparece uma vez, só na entrega de uma tarefa, nunca em nota nem em
tempo de uso, e some com `prefers-reduced-motion`. (b) Onde o mockup afrouxa uma proteção que o
produto já tem, vale o produto: "Sair" sempre à vista (D59); a faixa de que o professor acompanha o
Tutor continua presa (D8); a caixa do Tutor nunca some, para o assunto delicado receber a mensagem
fixa (D36); a entrada da escola responde igual para matrícula errada e pedido pendente; o convite não
mostra e-mail; o segundo fator mostra o segredo em texto (regra 50, item 2); não existe busca pública
de escola; borda de campo e de caixa de marcar com contraste de 3:1; e toda tela tem carregando e
erro (regra 50, item 5). (c) O que depende de dado ou de fase que não existe fica na fase dele:
frequência, faltas, nota do diário oficial, APOIA e os painéis que os leem; o Analista em conversa; os
avisos e o encaminhamento; Auditoria, Exportar e Dossiê; a área da rede; a prova em tela de foco; a
conversa livre com histórico; e as ferramentas que o catálogo ainda não tem.
(8) **Como entra:** quatro specs fora da sequência, antes do F2 — X1 `pele-e-casca`, X2
`telas-da-coordenacao`, X3 `telas-do-professor` e X4 `telas-do-aluno-e-primeiro-acesso` —, cada uma
com o processo completo. Nenhuma muda regra de negócio nem contrato da API além do que a X4 declara.
Motivo: o Gabriel reprovou a décima rodada vendo ("extremamente confuso: muita informação, muita aba,
muita coisa"; "muito texto, pouco contraste e cara de site") e escolheu este sistema; o Joaquim pediu
o produto igual ao mockup, com foco no visual e sem perder o que já foi construído; e fazer a pele
antes do F2 evita desenhar duas vezes as telas que o F2, o F6, o F7, o F9 e o F12 ainda vão abrir.
O preço: a D72 dizia que copiar medida de concorrente abre risco de concorrência desleal. Aqui o que
se toma é a técnica (ilustração chapada, botão com degrau), e não a marca de ninguém: a mascote, as
cores, os ícones e a fonte são nossos, e o verde não é a cor principal. O parecer sobre isso entra
junto do registro no INPI (`TODO.md`). O mockup de outubro mora num repositório privado do Gabriel;
a pasta `mockups/` daqui continua na versão de setembro até os dois decidirem trazê-lo.
*Em 16/10/2026 o Joaquim decidiu trazê-lo* ("sobre o mockup pode trazer para o projeto aqui", junto da
palavra de que cada spec finalizada pousa e vai para o GitHub): a pasta `mockups/` passou à versão de
outubro, cópia fiel de `a95568d`, com a mesma cerca da de setembro (fora do build, do lint e dos testes
da raiz, não é workspace, e nada dela entra no `apps/web` nem nos `packages/`). Ficaram de fora o
`node_modules` e nada mais; três linhas que o gitleaks lia como chave foram reescritas sem mudar a tela
(`mockups/README.md`). A licença do 21st.dev (P20) não trava a cópia: o mockup de outubro não cola peça
nova do catálogo (as que ele usa já estão na pasta pública desde 23/09/2026, e o botão com degrau só cita
as referências), e a conferência continua valendo antes de qualquer peça entrar no código (`TODO.md`).
*Revista em 28/10/2026* pela palavra do Joaquim, que subiu o sistema e pediu a onça igual à do mockup
("pegue exatamente o que tem no mockup e utilize ele", "tem que ser pra todos"; e, às escolhas que lhe
foram propostas, "faça o melhor e você escolhe"), na correção `2026-10-28-onca-do-mockup`. Mudaram duas
coisas. O item 3 dizia "uma expressão neutra só" para a onça inteira: o avatar continua neutro, e a onça
de corpo inteiro passa a ter o rosto da pose, o do mockup (acenando, apontando, comemorando e pensando),
com o parecer do `conformidade-reviewer` dado na correção; o piscar e o laço dos três pontos, que ele
vetou, e as poses `acolhendo` e `dormindo` continuam fora. E o traço da onça é **copiado** do mockup para
`apps/web/src/componentes/ui/onca/`: é a única exceção à cerca de que nada do mockup entra no `apps/web`
nem nos `packages/`. O mockup continua sem ser importado, e um teste guarda os valores do original
(`fidelidade-ao-mockup.test.tsx`). Motivo: redesenhada à mão na X1 e na X4, a onça saiu outra, e quem
abria o produto não via a mascote que o Gabriel escolheu; só a cópia fiel, presa por teste ao original,
garante o desenho dele em todo lugar e nos três papéis.
*Revista em 30/10/2026* pela palavra do Joaquim, com a X1 a X4 e a onça pousadas: **o mockup de outubro deixa de ser o
alvo e vira referência** ("para aquele momento a gente ia seguir o mockup […] dai o mockup vira so alguma referencia […]
so vamos utilizar o mockup caso tenha alguma referencias e vamos corrigir"). Daqui em diante o critério de certo de uma
tela é o `docs/interface.md` e as decisões; o mockup é consultado quando ajudar, e diferença em relação a ele não é
defeito, motivo de reprovação nem pendência. A pele que ele trouxe (itens 1 a 6) continua sendo a do produto e muda como
qualquer decisão. A pasta `mockups/` fica no repositório, com a mesma cerca. A onça continua a que está no produto, e o
teste que a guarda passa a proteger o traço do produto, e não "o do mockup": mudá-la pede decisão do Joaquim e o parecer
do `conformidade-reviewer` do item 3, com os valores do teste atualizados na mesma correção. Não mudam o item 3 (o que a
onça não faz: D58, D59, Decreto 12.880), o item 7 e a cerca de que nada do mockup é copiado para o `apps/web` nem para os
`packages/` (a onça, já copiada, segue sendo a única exceção, e nenhuma nova se abre). Motivo: o mockup serviu para a
virada da pele (X1 a X4 e a onça), que terminou; daqui em diante o produto muda pelas próprias decisões e pelo
`docs/interface.md`, e o mockup só é consultado quando ajudar.
*Revista de novo em 30/10/2026, à noite*, por **delegação do Joaquim**, que confere pela foto no pouso da correção que a
trouxer. Ele achou a tela de entrar "morta" e pediu a onça ali, "para alegrar"; ao sair do computador, deixou no terminal do
Orquestrador, às 19:30: "a pinta se quiser pode remover mas quero alguma coisa que alegre mais… pense e depois faça… vai fazendo
tudo". Muda o item 3, que dizia que a onça vai **sempre** com o nome da função e o selo "IA": passa a haver duas onças, com
fronteira escrita. A **onça-agente** continua como estava, sempre assinada e só em região que guarda produção do agente que
assina. A **onça da marca** é nova, com lugar fechado: o painel da casca pública, em todas as telas dela (entrada da equipe e
do aluno, convite, segundo fator e turma pública), igual para todo papel. Não tem nome, legenda, selo, fala nem texto atribuído,
é `aria-hidden` e nunca aparece em área de papel nem em região de agente. Ela vem na pose `acenando`, no lugar da pinta grande
apagada, que sai do painel. De 1024 px para cima tem 160 px, centrada no painel, e **entra e acena uma vez** ao abrir a página,
com o movimento que já existe, para depois ficar parada; o movimento some com `prefers-reduced-motion`. No celular, onde o painel
vira uma faixa só com a marca, ela tem 88 px, **parada**, sobre `fundo`, acima do formulário. O painel ganha um fundo quente
(`laranja-claro`, com a borda em `laranja-borda`), feito só com tokens que já existem. Se a foto do tema claro não mostrar os pés
da onça, que são do mesmo creme, o painel volta a `papel`, sem cor nova e sem mexer na onça. Não entra texto novo, e os textos da
casca continuam os mesmos (RF20 da X1). Ela fica fora do primeiro carregamento: a casca a importa de forma tardia, com a caixa
reservada, e o teto de 150 kB não sobe. Ficam vetados, também nesta tela: a onça assinada por um agente na entrada, onde nenhum
agente produziu nada e o selo perderia o sentido; e todo laço, seja respirar, piscar ou balançar o rabo (D59; Decreto 12.880,
arts. 9º e 10). O veto ao laço vale para a onça, não para uma tela. Pareceres: do `conformidade-reviewer` (onça da marca sem
assinatura passa com estas condições, a assinada pelo Tutor e o laço não passam) e do `frontend-reviewer` (fundo, tamanho,
posição e import tardio). Motivo: a entrada é a primeira tela de todo mundo, e a mascote que a escola escolheu não aparecia nela.
Na entrada ainda não há saída de IA, e a D58 pede rótulo na saída de IA, não na marca: uma onça sem fala, sem nome e presa ao
painel não se passa por agente nem por pessoa. A fronteira escrita, guardada por teste, impede que a exceção se espalhe.
Na foto, o painel ficou em `papel`: os pés da onça sumiam no `laranja-claro`, como a revisão previa.
*Revista de novo em 30/10/2026, às 21:45*, também por **delegação do Joaquim**, que confere pela foto no pouso da correção
que a trouxer. Ao ver a onça sozinha no painel, ele disse ao Orquestrador: "tem que deixar um pouco melhor, botar algum elemento,
tipo local pra ele, sei lá". A onça da marca ganha um **cenário**: um canto de sala de aula, com uma lousa ao lado dela, uma
pilha de três livros onde ela pisa, um vaso com planta e um lápis deitado no chão. O desenho é chapado, sem contorno e sem degradê,
como o da onça. De 1024 px para cima a onça passa de 160 para 240 px, com o mesmo desenho, a mesma pose e o mesmo movimento, e o
cenário tem até 432 × 300 px, centrado no painel, com 40 px de respiro dos lados. No celular nada muda: a onça de 88 px fica sem
cenário. O cenário faz parte da onça da marca e herda a fronteira dela: mora só no painel da casca pública, nunca em área de
papel nem junto da onça-agente, e não tem texto, glifo, nome nem rótulo acessível. **A onça da marca não ensina**: fica de
frente para quem chega, ao lado da lousa e nunca diante dela, e não segura, não aponta nem olha para a lousa. Ficam vetados
giz, ponteiro ou lápis na pata, óculos, capelo, roupa ou crachá, mesa de professor e a pose `apontando`. Na lousa só entram
triângulo, círculo e linha ondulada em giz. Letra, algarismo, sinal de conta, certo ou X, estrela e qualquer marca que lembre
nota ou prêmio ficam de fora. Os livros não repetem o trio de cores dos agentes (laranja, azul e anil) nem cor de estado, e
nenhum leva nome ou ícone de matéria. As cores são só de tokens que já existem e não invertem entre os temas. O cenário é
**parado** desde o primeiro quadro: nada balança, se desenha sozinho, reage ao cursor ou ao que se digita (nem a mascote que
cobre os olhos na senha, comum em telas de entrada). O único movimento continua sendo o da onça, entrar e acenar uma vez (D59).
O cenário vai no mesmo import tardio da onça, sem texto novo, e o primeiro carregamento continua ≤ 150 kB. Pareceres: do
`conformidade-reviewer` (passa com estas condições; o "2+2" na lousa e a onça dando aula não passam) e do `frontend-reviewer`
(tokens, tamanho, altura mínima do painel e peso). Motivo: a onça sozinha no meio de um painel vazio ainda deixava a entrada
fria; um lugar para ela diz, sem nenhuma palavra, que o produto é da escola. A fronteira e os vetos impedem que esse lugar a
transforme em professora ou em agente.

**D81 — Padrão de mercado antes de mecanismo próprio: a peça técnica tem o nome do framework, o
conceito do domínio fica em português, e a X5 é recortada para pousar.** *(decidida em 22/10/2026 pelo
Joaquim, no terminal "Claude Code #2": "faça o melhor para o meu produto, preciso terminar isso, fica
muito parado porque me pergunta as coisas, não quero, só quero que siga em frente; e quero padrões de
mercado, então o cara já entra com padrões: se ele usa Spring Boot, já sabe mais ou menos como faz";
o recorte está em `.processo/reengenharia/RECORTE.md`, copiado para `tasks/prd-reengenharia/RECORTE.md`)*
(1) **O princípio.** Quando o NestJS, o React, o TanStack Query, o Drizzle, o BullMQ ou o ESLint têm um
jeito documentado de fazer, usamos esse jeito, com o nome que a documentação usa. Mecanismo próprio só
entra com o motivo escrito: a regra que ele protege e por que o padrão não serve. O teste: **um dev que
leu a documentação oficial reconhece isto sem ajuda?** (2) **O idioma.** A peça técnica tem o nome do
framework, em inglês: `Controller`, `Service`, `Repository`, `Module`, `Pipe`, `Guard`, `Interceptor`,
`Dto`, `Job`, `Queue`, os hooks `use…` (como já são `TurmaController`, `TurmaService` e
`turma.repository.ts`). O conceito do domínio fica em português, pelo glossário (regra 60): `turma`,
`nota`, `matricula`, `anoLetivo`, `reivindicacao`, `escolaId`. Mecanismo técnico nosso e novo leva o
nome do padrão que implementa (`ZodValidationPipe`, e não `PipeDeEntrada`). **Não se renomeia em massa o
que já existe**: o nome técnico em português (`Enfileirador`, `ContadorEmJanela`) só muda quando a
tarefa já mexe nele, e o guia do desenvolvedor (`docs/guia-do-desenvolvedor.md`) dá o equivalente de
mercado ao lado (`Enfileirador` = transactional outbox; `ContadorEmJanela` = rate limiter por janela de
tempo, no Redis). (3) **O que muda no desenho da X5** (`tasks/prd-reengenharia/DIAGNOSTICO.md`, T1, T2, T18 e
T11): a entrada HTTP passa a ser validada pelo `ZodValidationPipe` da documentação do NestJS ("Pipes",
*Object schema validation*), no parâmetro, com um `IdPipe` no molde do `ParseUUIDPipe` que responde
`NAO_ENCONTRADO` (regra 10.6) e normaliza para minúsculas, e a trava é o `no-restricted-syntax` do
ESLint, sem conferência no boot e sem lista de pendentes (revê a P2 da R32); o registro de rotas próprio
com o OpenAPI derivado (T2) e a documentação gerada do metadado (T18) saem da X5, e o contrato continua
sendo o `packages/shared` em zod; o OpenAPI entra pelo `@nestjs/swagger` quando houver consumidor fora
do `apps/web` (revê a P3); mover as políticas para `conformidade/` (T11) sai da X5, porque a regra já
está protegida pelo teste e pelo `ouro`. Ficam, porque já são padrão: `dependency-cruiser`, as regras
core do ESLint com supressões nativas, `cockatiel`, `knip`, Dockerfile multi-stage com `target` e as
definições de job tipadas por zod (o `Job<Dados>` da documentação do BullMQ). A pasta segue o `nest g
resource`: uma por recurso, partida por assunto quando passa de ~20 arquivos de produção; na web, o
*feature folder* (bulletproof-react), com o kit visual em `componentes/ui/`. (4) **Como entra:** a X5
fica com 32 tarefas, na ordem de prioridade do recorte (onda 0, tenant, prova, entrada, jobs,
resiliência, pastas, camadas e lint, higiene e o guia do desenvolvedor), e o resto vai para a **X6
`reengenharia-continuacao`**, registrado no `ROADMAP.md`, que não segura a X4 nem o F2. Sexta, 23/10, às
22h nenhuma tarefa nova parte; tarefa que passa de 4 horas ou bate duas vezes no limite das três
reprovações vai para a X6 com o diagnóstico do Arquiteto. Até o pouso da X5, nenhuma parada chama o
Joaquim: o Arquiteto decide com a recomendação dele e registra em `tasks/prd-reengenharia/DECISOES.md`; o pouso
na `develop`, com push, está autorizado com a validação aprovada e a esteira verde. As decisões D1 a
D80, as regras 10, 20, 30, 40 e 70, os revisores com veto, o portão da tarefa e a esteira não mudam.
Motivo: a X5 tinha 94 tarefas e, no ritmo de 21 e 22/10, acabaria em dezembro, com a X4 congelada e o
piloto esperando; a linha de base mostrou um sistema saudável (97,9 % de linhas cobertas na API, 1,96 %
de duplicação, nenhuma violação de camada), e a reengenharia trava por máquina o que hoje depende de
disciplina. E mecanismo próprio é framework nosso para manter: o dev que chega sabe NestJS, não o
`@Corpo`. O `nestjs-zod` ficou de fora porque a versão 5.5 declara `@nestjs/common` e `@nestjs/swagger`
só até `^11`, e o projeto usa o 12; entrar com `--legacy-peer-deps` não é padrão de mercado. Revista em 24/10/2026, pelo Joaquim:
o nome técnico antigo em português deixa de esperar a tarefa que mexe nele e é renomeado de uma vez na
**X8 `nomes-de-mercado`**, depois da X4 e antes do F2, a partir de um inventário completo que ele aprova
antes do rename. "Ferramenta" fica em português, porque é conceito de domínio (glossário, D74), não tool
de LLM: o modelo não escolhe nem chama nada, quem roda a tarefa é o servidor. `Tool` fica reservado para
function calling, quando existir. Banco, rota HTTP, código de erro e texto de tela não mudam. Motivo, nas
palavras dele: "tools já entendo que é a tool que o agente pode usar via MCP… coisa de software podia ser
inglês como geralmente é chamado"; o rename gradual deixa a base em dois idiomas por tempo indefinido, e
quem vem do mercado lê a peça traduzida como mecanismo próprio.
