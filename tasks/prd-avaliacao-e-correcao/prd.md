# PRD — Avaliação e correção

**Status:** aprovado (Joaquim, 23/11/2026)
**Funcionalidade do roadmap:** F6
**Depende de:** F4, F4b, F5a, F5b (todas `[x]`)

Dividida em 23/11/2026: discursiva e redação são a F6c. Cortada na Tech Spec, no mesmo dia: os RF11 a RF20 (lote,
gabarito, contestação, Turmas e AIAs) são a F6d, `tasks/prd-correcao-e-atencao/prd.md`, sem mudar requisito.

## 1. Problema

Camila aplica prova de Matemática ao 7ºA no laboratório, e a "prova" do produto é uma atividade sem relógio: sem
começo nem fim, sem tempo a mais para quem tem direito, com a mesma ordem para dois alunos lado a lado, e sem saber quem
saiu da aba. Ela volta ao papel ou ao Google Forms, e o diagnóstico por habilidade fica de fora (regra 60, item 4).

## 2. Objetivo

Prova online com tempo, ordem por aluno e integridade registrada, sem perder resposta.

## 3. Fora de escopo

- Discursiva, redação e rubrica (F6c); prova no papel (F6b); `Nota`, média e boletim (F17, D46)
- O registro da adaptação por aluno (`AdaptacaoAluno`, D35), que vai para a F9: aqui o professor escolhe o tempo adicional
- Versões A/B fixas: online, o embaralhamento é por aluno
- Medir conexão, tempo parado ou navegação: só a saída da aba conta, e só em prova (D70; regra 70, item 7)
- Destaques, gabarito corrigido, contestação, Turmas e AIAs (F6d)

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Professor | aplicar e configurar a prova, estender tempo, reabrir para quem não fez, ver a saída da aba no lote, nas turmas e disciplinas dele | mudar resposta de aluno; registrar motivo de tempo adicional |
| Aluno | fazer e retomar a prova, sair dela | começar fora do tempo; ver gabarito antes da aprovação; ver colegas |
| Coordenação | o que já tem: suspender a função | ver saída da aba ou tempo adicional de um aluno |

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

## 6. Regras de negócio

- Sem `Nota`: aprova-se diagnóstico formativo, corrigido pela conta do gabarito (D46)
- O relógio é o do servidor; o cliente só mostra
- Tempo adicional e extensão são atos do professor, com autor e hora, sem motivo, presos àquela prova
- A saída da aba fica presa à tentativa, só em prova, só para o professor da turma (D70)
- Embaralhar muda só a ordem que o aluno vê
- Prova aberta trava o Tutor da turma (já existe)
- Tudo por escola e ano letivo, em turma e disciplina de vínculo confirmado

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Aluno faltou | Fica sem tentativa até a segunda chamada (RF10) |
| Feriado no dia | O professor muda a janela antes de alguém começar (RF2) |
| Rede da escola cai | Respostas salvas ficam; o relógio segue, e o professor estende a quem pedir |
| Aluno com leitor de tela | A saída conta, com o aviso fixo; nada acontece com a prova |
| Aluno transferido com a prova aberta | A tentativa fica na turma de origem; ele não continua |
| Professor encerra antes do fim, com alunos fazendo | A confirmação diz quantos; as tentativas vão com o que foi salvo |
| Função de correção suspensa com prova aberta | A prova segue; ao encerrar não há correção (como hoje) |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Resposta, tentativa e diagnóstico | aluno | correção e diagnóstico | a do mapa | sim |
| Contagem de saída da aba, por tentativa | aluno | integridade da prova, só o professor vê | a da tentativa | sim |
| Início, limite, tempo adicional e extensão da tentativa, com quem concedeu | aluno; professor como autor | fazer valer o tempo da prova | a da tentativa | **não**: entra |
| Ordem embaralhada da tentativa | aluno | mostrar a mesma ordem na retomada | a da tentativa | **não**: entra |

## 8b. Risco regulatório

**Alto** (correção de objetiva). A correção é determinística; o que a IA escreveu (gabarito e habilidade) passa pelo
professor ao aplicar. O lote só libera com os destaques abertos e o registro da validação (D33, D56), como hoje. A saída
da aba é fato sem consequência (D70). As etapas 2 a 6 das AIAs estão na F6d.

## 9. Métricas

- Provas com duração por mês, por escola, nunca por professor (D64); respostas perdidas por queda: zero

## 10. Perguntas em aberto

1. ~~Tempo devolvido (RF6)~~: respondida na Tech Spec, §5 (pulso da API; a queda parcial é a rede da escola, e o professor estende)
2. O texto do aviso fixo da saída da aba (proposta em `cenarios.md` §4)
3. ~~A tela de foco no celular~~: respondida na Tech Spec, §9 (faixa de uma linha no topo)
