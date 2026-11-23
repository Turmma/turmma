# PRD — Avaliação e correção

**Status:** aprovado (Joaquim, 23/11/2026)
**Funcionalidade do roadmap:** F6
**Depende de:** F4, F4b, F5a, F5b (todas `[x]`)

Dividida em 23/11/2026: discursiva e redação são a F6c. Indicadores, destaques e piso da tela projetada: D88.

## 1. Problema

Camila aplica prova de Matemática ao 7ºA no laboratório, e a "prova" do produto é uma atividade sem relógio: sem
começo nem fim, sem tempo a mais para quem tem direito, com a mesma ordem para dois alunos lado a lado, e sem saber quem
saiu da aba. Ela volta ao papel ou ao Google Forms, e o diagnóstico por habilidade fica de fora (regra 60, item 4).

Depois, a turma aberta mostra o acerto, mas não **quem precisa de ajuda e por quê**; gabarito errado do modelo não tem
conserto depois da aprovação; e o aluno que discorda da correção só lê "fale com quem dá a aula".

## 2. Objetivo

Prova online com tempo, ordem por aluno e integridade registrada, sem perder resposta; e, em Turmas, quem precisa de
atenção, com o motivo e caminho de contestação.

## 3. Fora de escopo

- Discursiva, redação e rubrica (F6c); prova no papel (F6b); `Nota`, média e boletim (F17, D46)
- O registro da adaptação por aluno (`AdaptacaoAluno`, D35), que vai para a F9: aqui o professor escolhe o tempo adicional
- Versões A/B fixas: online, o embaralhamento é por aluno
- Medir conexão, tempo parado ou navegação: só a saída da aba conta, e só em prova (D70; regra 70, item 7)
- "Precisa de atenção" para a coordenação; limiares dos sinais do Tutor e do Analista (F9, F12)
- Recursos, Mural, Frequência e Ranking da turma (sem fase)

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Professor | aplicar e configurar a prova, estender tempo, reabrir para quem não fez, corrigir gabarito, responder contestação, ver atenção e ficha do aluno, nas turmas e disciplinas dele | mudar resposta de aluno; registrar motivo de tempo adicional; aprovar sem abrir os destaques |
| Aluno | fazer e retomar a prova, sair dela, ver o resultado aprovado, contestar questão | começar fora do tempo; ver gabarito antes da aprovação; ver colegas |
| Coordenação | o que já tem: suspender a função, ler o nominal com finalidade e auditoria | ver saída da aba, atenção, contestação ou tempo adicional de um aluno |

## 5. Requisitos funcionais

**Prova online**

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | Ao aplicar atividade avaliativa, o professor define a janela (abre e fecha) e, se quiser, a duração. Ela conta do início de cada aluno, no relógio do servidor, e acaba no que vier antes, início mais duração ou fim da janela, somadas as extensões | aluno não começa fora da janela; quem começa 10 min antes do fim tem 10 min |
| RF2 | Antes de alguém começar, o professor muda janela e duração; depois, só estende | mudar com tentativa iniciada é recusado |
| RF3 | Ao aplicar, o professor marca alunos com tempo adicional (+25%, +50% ou +100%), sem motivo | só o marcado tem o limite maior; nenhum campo de motivo |
| RF4 | Durante a prova, o professor estende o tempo de um aluno ou da turma, inclusive além da janela | só o estendido segue respondendo; dois cliques, uma extensão |
| RF5 | Esgotado o limite, a tentativa é enviada com o que foi salvo; resposta que chega depois não entra, e o aluno vê por quê | item gravado depois do limite fica fora da correção |
| RF6 | Resposta salva no servidor a cada item; depois de uma queda, o aluno volta onde parou, com o tempo do servidor. Indisponibilidade do nosso sistema não conta: quem tinha prova em andamento recebe o tempo de volta | queda de rede: nenhuma resposta perdida; API fora simulada: o limite anda o tempo da queda |
| RF7 | A prova abre na **tela de foco**: só a prova e o tempo restante, sem a navegação da área e sem o Tutor. Antes de começar, o aluno lê a duração, que sair da aba é mostrado ao professor e como sair; sair é um clique, e o relógio segue | e2e: sem navegação na prova; o aviso vem antes do primeiro item |
| RF8 | O professor liga "embaralhar questões" e "embaralhar alternativas"; cada aluno tem ordem própria, mantida na retomada; correção, relatório e diagnóstico usam a ordem original | duas ordens, mesma resposta lógica, mesma correção |
| RF9 | Em prova, cada perda de foco da aba conta na tentativa; o professor vê a contagem ao lado do aluno no lote, com o aviso fixo da D88; não é destaque nem trava a aprovação | não existe fora de prova, somada entre provas, nem para a coordenação |
| RF10 | O professor reabre a prova para quem não a enviou (segunda chamada), com janela nova; com o lote já aprovado, as novas tentativas formam um complemento com aprovação própria | aluno fora da lista não começa; o lote aprovado não muda |

**Correção e lote**

| # | Requisito | Como se prova |
|---|---|---|
| RF11 | Destaques do lote pela D88: em branco, fora do histórico (40 pontos), mesma alternativa repetida. Errar o que quase todos acertaram vira "questão que quase todos acertaram" no relatório por questão | aluno que erra só essas não é destacado |
| RF12 | O professor corrige o gabarito de uma questão já corrigida; a turma é recorrigida e o lote volta a "para revisar", com a mudança destacada; o diagnóstico anterior vale até a reaprovação, e o registro anterior fica | nada novo ao aluno antes da reaprovação; dois registros de validação; auditoria |
| RF13 | No resultado aprovado, o aluno contesta uma questão, com motivo de lista fechada e sem texto livre, uma vez por questão, no ano letivo da turma | a segunda é recusada; não há campo de texto do aluno |
| RF14 | O professor vê as contestações na atividade e no lote: aceita (leva ao RF12) ou recusa com justificativa, que o aluno lê. Corrigir o gabarito aceita as abertas da questão | o aluno vê a decisão e a justificativa |

**Turmas**

| # | Requisito | Como se prova |
|---|---|---|
| RF15 | Em Alunos, "Precisam de atenção" lista em ordem de nome quem cumpre a D88, com o motivo escrito ("Abaixo da metade em EF07MA01: 3 de 8, em 2 atividades"; "Não enviou: Prova de frações"), sem cor vermelha, média ou posição | uma questão só da habilidade não basta; quem envia na segunda chamada sai |
| RF16 | O nome abre a **ficha do aluno**: por habilidade, atividade a atividade (a evolução), o que enviou, o motivo de atenção e as contestações, dizendo de onde vem cada número | sem média, colegas nem Tutor; aluno de outra turma é "não encontrado" |
| RF17 | Hoje ganha a evolução da turma por habilidade, atividade a atividade | a API de Hoje não devolve nome de aluno |
| RF18 | Em Hoje, contagem de 1 ou 2 alunos aparece como "menos de 3" (sinais, acerto, atenção humana); o número exato fica no "Ver quem" e em Alunos | 2 alunos que travaram: "menos de 3" |
| RF19 | Turmas considera só as disciplinas do professor na turma e só correção aprovada | atividade de outra disciplina não entra |

**Conformidade**

| # | Requisito | Como se prova |
|---|---|---|
| RF20 | Rascunho das etapas 2 a 6 das AIAs de correção e de diagnóstico, com o que esta fase construiu; o que depende de advogado fica marcado | etapas preenchidas ou marcadas; `conformidade-reviewer` |

## 6. Regras de negócio

- Sem `Nota`: aprova-se diagnóstico formativo, corrigido pela conta do gabarito (D46)
- O relógio é o do servidor; o cliente só mostra
- Tempo adicional e extensão são atos do professor, com autor e hora, sem motivo, presos àquela prova
- A saída da aba fica presa à tentativa, só em prova, só para o professor da turma (D70)
- Embaralhar muda só a ordem que o aluno vê
- O lote aprovado não muda sem nova validação registrada (D56)
- "Precisa de atenção" sai só de correção aprovada e de entrega (D88), nunca de Tutor, tempo ou saída da aba
- Prova aberta trava o Tutor da turma (já existe)
- Tudo por escola e ano letivo, em turma e disciplina de vínculo confirmado

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Aluno faltou | "Não enviou", até enviar na segunda chamada (RF10) |
| Feriado no dia | O professor muda a janela antes de alguém começar (RF2) |
| Rede da escola cai | Respostas salvas ficam; o relógio segue, e o professor estende a quem pedir |
| Aluno com leitor de tela | A saída conta, com o aviso fixo; nada acontece com a prova |
| Aluno transferido com a prova aberta | A tentativa fica na turma de origem; ele não continua; a ficha diz "Saiu da turma" |
| Professor encerra antes do fim, com alunos fazendo | A confirmação diz quantos; as tentativas vão com o que foi salvo |
| Função de correção suspensa com prova aberta | A prova segue; ao encerrar não há correção (como hoje) |
| Professor com duas disciplinas na turma | Turmas mostra as duas, nunca a de outro professor |
| Aluno chegou em maio | Atividade aplicada antes dele não vira "Não enviou" |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Resposta, tentativa e diagnóstico | aluno | correção e diagnóstico | a do mapa | sim |
| Contagem de saída da aba, por tentativa | aluno | integridade da prova, só o professor vê | a da tentativa | sim |
| Início, limite, tempo adicional e extensão da tentativa, com quem concedeu | aluno; professor como autor | fazer valer o tempo da prova | a da tentativa | **não**: entra |
| Ordem embaralhada da tentativa | aluno | mostrar a mesma ordem na retomada | a da tentativa | **não**: entra |
| Contestação: questão, motivo de lista fechada, decisão e justificativa do professor | aluno; professor como autor | revisão do resultado (LGPD, art. 20) | a do diagnóstico | **não**: entra |

A justificativa é texto do professor ao aluno, sobre a questão; a tela avisa para não escrever sobre a pessoa.

## 8b. Risco regulatório

**Alto** (correção de objetiva e perfil acadêmico individual). A correção é determinística; o que a IA escreveu
(gabarito e habilidade) passa pelo professor ao aplicar, é corrigível depois e contestável pelo aluno. O lote só libera
com os destaques abertos e o registro da validação (D33, D56). "Precisa de atenção" é fato declarado, só para o
professor da turma, explicado e contestável (D57, D60, D88). A saída da aba não tem consequência (D70). AIAs: RF20.

## 9. Métricas

- Provas com duração por professor por mês; respostas perdidas por queda: zero
- Gabaritos corrigidos depois da aprovação e contestações aceitas: medem o gabarito do modelo (etapa 6 da AIA)
- Professores que abrem a ficha do aluno ao menos uma vez por semana

## 10. Perguntas em aberto

1. Tempo devolvido (RF6): como medir a indisponibilidade, e a queda parcial
2. Gabarito corrigido numa turma: oferecer a correção às outras turmas com a mesma atividade?
3. Os motivos da contestação e o texto do aviso fixo da saída da aba
4. O limiar da "questão que quase todos acertaram" (o MVP usa 90%)
5. A tela de foco no celular (D51), com relógio e "sair" sem cobrir a questão
