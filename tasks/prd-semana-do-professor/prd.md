# PRD — Semana do professor

**Status:** aprovado (Joaquim, 06/11/2026)
**Funcionalidade do roadmap:** F2b — `semana-do-professor`
**Depende de:** F2 (grade e calendário importados), X3 (Turmas e a turma aberta)

## 1. Problema

Camila dá aula em oito turmas. A grade e o calendário da escola já estão no sistema desde o F2, mas ela não tem onde
ver a própria semana: que aula tem amanhã às 7h30, se quinta é feriado, o que pretendia dar no 2ºB. Ela continua
num caderno, e o que a escola importou não chega à rotina dela. Sem essa semana, o "seu dia e sua semana" (F11)
não tem onde se apoiar.

## 2. Objetivo

A professora abre a Semana e vê as aulas dela, o que aconteceu em cada turma e o que pretendia dar, sem cadastrar
nada, com feriado e recesso já fora e nada de outra escola na tela.

## 3. Fora de escopo

- Criar, mover, trocar ou cancelar aula (regra 60, item 8); visão de mês e de lista
- Juntar as duas escolas de quem dá aula em mais de uma, ou avisar de aula na outra (P12, seção 6)
- Agendar a aplicação de uma atividade para uma aula, ou ligar um material de Criados a ela
- "Não houve aula", frequência, chamada e diário de classe oficial (P08)
- Qualquer leitura do registro da aula pela coordenação, ou contagem de aula preenchida (D64, regra 70, item 8)
- "Começar aula" e o modo sala (F10); o "seu dia e sua semana" do Assistente (F11); a semana do aluno (F9)
- Reposição em sábado ou dia letivo fora da grade; semana de ano `planejado` ou `encerrado`; notificação

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Professor | ver as próprias aulas da escola ativa, semana a semana, no ano em curso; filtrar por turma; escrever "o que vou dar" (e "o que foi dado") das próprias aulas; abrir do dia as atividades e correções da turma | ver aula de outro professor, de outra escola ou de vínculo não confirmado; mexer na grade; ler o registro de outro professor, mesmo o do antecessor na turma |
| Coordenador | importar grade e calendário (F2), que geram a semana | ler o registro de aula; ver quantas aulas um professor preencheu; abrir a Semana de um professor |

## 5. Requisitos funcionais

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | Turmas ganha as abas **Turmas · Semana**, guardadas no endereço. A Semana mostra as aulas da professora na escola ativa, das alocações dos vínculos **confirmados** dela no ano em curso: uma coluna por dia, de segunda a sexta (sábado e domingo só quando a grade tem aula neles), em ordem de horário, com turma, disciplina, horário e sala | e2e: aulas de três turmas no dia e na hora da grade; integração: vínculo pendente, contestado ou encerrado não gera aula |
| RF2 | Semana anterior, seguinte e "Hoje", dentro do período do ano em curso; a semana vai no endereço. Hoje fica destacado, e a aula em andamento, marcada | integração: fora do período do ano não há aula; e2e: a navegação muda semana e endereço |
| RF3 | Em dia de **feriado** ou **recesso**, as aulas não aparecem, e o dia mostra o tipo e a descrição. **Evento** aparece no dia e não tira a aula | integração: feriado numa terça tira a aula; "Conselho de classe" (evento) não tira; recesso de duas semanas esvazia as duas |
| RF4 | Filtro por turma e disciplina, no endereço. O Hoje da turma aberta ganha "Ver a semana desta turma", que abre a Semana filtrada | e2e: o link leva à Semana só com aquela turma |
| RF5 | Abrir uma aula mostra, num painel ao lado (folha de baixo a 360 px), dia, horário, turma, disciplina e sala, e o texto da professora: **"O que vou dar"** até o dia da aula, **"O que foi dado"** depois. Ela escreve e corrige, até 500 caracteres, com o aviso de não escrever nome de aluno | e2e: escrever, salvar, reabrir e achar o texto; integração: 501 caracteres é recusado |
| RF6 | Aula de hoje ou futura sem texto traz o selo neutro **"Falta preencher"**; aula passada sem texto, nenhum selo | unidade: o selo por data e texto; e2e: some ao salvar |
| RF7 | Cada dia mostra, para cada turma e disciplina da professora, o que aconteceu ali naquele dia: atividade aplicada, atividade encerrada, correção que o Assistente concluiu, com o estado de hoje ("para revisar", "aprovada", "rejeitada"). Cada item leva ao lugar dele (o painel da atividade, a revisão da correção). Sem nota, média, acerto nem nome de aluno | integração: atividade aplicada na quarta aparece na quarta da turma e disciplina dela, e não na semana do colega de outra disciplina na mesma turma; e2e: o item abre o painel |
| RF8 | "Preparar esta aula", no painel, abre o Início com a turma escolhida, sem gerar nada e sem escrever o texto da aula | e2e: Início com a turma marcada e nenhuma conversa nova gravada |
| RF9 | Só a escola ativa (P12). Trocar de escola troca a semana inteira, e nada da anterior fica na tela nem no cache, nem o painel aberto | e2e: professora de duas escolas troca e não vê aula da primeira |
| RF10 | Aula, registro e item de outra escola, de outro professor ou de outro ano respondem igual ao inexistente, na leitura e na gravação | integração, isolamento: id de outra escola, de colega da mesma escola e inexistente dão a mesma resposta, e nada é gravado |
| RF11 | Só a professora dona do vínculo da aula lê e grava o texto. Nenhuma rota da coordenação ou da rede devolve o texto ou contagem de aulas preenchidas | integração: a coordenação não alcança o texto; a matriz de permissão não tem célula da coordenação para ele |
| RF12 | Quatro estados: carregando; erro com "Tentar de novo"; vazio que diz por quê ("A coordenação ainda não importou a grade", "Sem aulas nesta semana", "Semana de recesso"); com dado. Sem calendário importado, as aulas aparecem com o aviso de que ele falta. No celular, um dia por vez, em botões, sem rolagem horizontal a 360 px | e2e nos projetos `chromebook` e `celular` |
| RF13 | Reimportar o **calendário** não apaga texto: a aula coberta por feriado novo some e volta com o texto se o feriado sair | integração: texto, feriado importado, feriado retirado, texto de volta |
| RF14 | Reimportar a **grade** respeita o texto: a aula que continua (mesmo vínculo, dia e início) fica com ele; a que muda só o horário, no mesmo vínculo e dia, leva o texto das datas futuras (a escola que passa o turno das 7h30 para as 7h40 não apaga o planejamento); a que sai da grade some das datas futuras junto com o texto delas; e a aula passada com texto continua na semana dela, mesmo fora da grade | integração: os quatro casos, com a reimportação real do F2 |
| RF15 | Gravar duas vezes (clique duplo, duas abas) deixa um registro por aula e data, com o último texto | integração: duas gravações simultâneas, uma linha |

## 6. Regras de negócio

- **A semana deriva da estrutura da escola** (regra 60, item 8; D3 revista): a aula é uma alocação do F2 numa data do
  ano em curso fora de feriado e recesso. A professora preenche o conteúdo e não toca na grade
- **P12, decidida pelo Joaquim em 06/11/2026:** só a escola ativa, sem aviso de aula na outra. O seletor já diz que a
  outra existe, e o aviso exigiria ler a grade de uma escola com o token da outra (regra 10, item 3; P30)
- Só vínculo **confirmado** gera aula (regra 60, item 8a)
- **O registro da aula é da professora** (D63): só ela lê e grava, e nenhum número sai dele sobre ela (D45, D64,
  regra 70, itens 8 e 9). "Falta preencher" lembra, não cobra (D59)
- O registro pertence à escola e ao ano letivo da aula (regra 10, itens 1 e 2)
- Duas disciplinas na mesma turma são aulas distintas, e o que a Semana liga a cada uma é só daquela disciplina
- "Hoje" e "agora" são os do fuso da escola

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Feriado no dia da prova | A aula sai do dia; a atividade aplicada naquele dia continua nele (RF7), porque aconteceu |
| Professor que dá duas disciplinas na mesma turma | Duas aulas, cada uma com o próprio texto; o filtro separa |
| Aula dupla (duas alocações seguidas do mesmo vínculo no dia) | Duas aulas, cada uma com o próprio texto |
| Professor que saiu em março (vínculo encerrado) | As aulas saem da Semana dele, e ele não alcança mais o registro (regra 20, item 18) |
| Professor substituto na mesma turma e disciplina | Vê as aulas do vínculo dele; não lê o registro do antecessor |
| Turma sem professor alocado | Não aparece na Semana de ninguém |
| Virada de ano letivo | A semana que atravessa o fim do ano mostra só os dias dele; com o ano novo em curso, a Semana é a dele, e o registro do anterior não aparece |
| Texto com nome de aluno | O aviso pede para não escrever; o texto nunca vai a log nem a auditoria (regra 20, item 9) |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Aula da grade (turma, disciplina, professor pelo vínculo, dia, horário, sala) | professor | derivar a semana dele | a da alocação | sim ("Aula da grade") |
| Registro da aula (até 500 caracteres, por aula e data) | professor | ela planejar e lembrar o que deu; na F11, o "seu dia e sua semana", para ela | o do vínculo, no prazo de `vinculo_encerrado` | **não: entra nesta fase**, com o arquivo do titular (regra 20, item 19) e a exportação aberta (D63) |
| Evento do calendário | — | dia sem aula | a do calendário | sim |

## 8b. Risco regulatório

Não há IA no caminho do aluno nem decisão sobre ele. "Preparar esta aula" só abre o Início; o que o Assistente gerar
segue o caminho que já existe (regra 70, item 3). A Semana não mede o professor: nada dela chega à coordenação
(regra 70, itens 8 e 9). Nada a classificar.

## 9. Métricas

- Na escola piloto, a professora acha a aula de amanhã e o que pretendia dar sem ajuda (observação, não telemetria
  por pessoa)
- Nenhum chamado de "minha aula não aparece" que não seja grade importada errada
- A leitura da Semana dentro do orçamento da regra 80 às 7h de segunda, com a escola inteira abrindo junto

## 10. Perguntas em aberto

Para a Tech Spec:

- Como a `Aula` existe (calculada na leitura e gravada só com texto, ou gerada para o ano), e como o registro passado
  sobrevive à saída da alocação, que hoje é em cascata (RF14)
- Como o texto acompanha a mudança de horário no mesmo vínculo e dia, com aula dupla (RF14)
- A rota da semana, por professor no contexto do token, sem virar leitura por professor para a coordenação
- De onde vêm os itens do dia (RF7) sem consulta por turma, e o índice que começa pelo escopo (regra 80, item 8)
- A linha nova do `docs/lgpd.md`, o arquivo do titular e a célula `próprio` da matriz de permissão
