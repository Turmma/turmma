# PRD — Correção e atenção

**Status:** aprovado (Joaquim, 23/11/2026)
**Funcionalidade do roadmap:** F6d
**Depende de:** F6 (`avaliacao-e-correcao`)

Cortado do PRD da F6 em 23/11/2026, sem mudar requisito: a F6 dava 22 a 24 tarefas, e a prova online ficou nela. Aqui
estão os RF11 a RF20 dela, renumerados de RF1 a RF10. Indicadores, destaques e piso da tela projetada: D88.

## 1. Problema

Depois da correção, a turma aberta mostra o acerto, mas não **quem precisa de ajuda e por quê**. O gabarito escrito
pelo modelo, quando errado, corrige errado a turma inteira, e não tem conserto depois da aprovação. O aluno que discorda
da correção só lê "fale com quem dá a aula". E a aba Hoje, projetada em sala, diz "1 aluno travou", o que identifica o
aluno na frente da turma.

## 2. Objetivo

Em Turmas, o professor vê quem precisa de atenção, com o motivo e com caminho de contestação. O gabarito errado tem
conserto, com nova validação registrada.

## 3. Fora de escopo

- A prova online (F6); discursiva e redação (F6c); prova no papel (F6b); `Nota`, média e boletim (F17, D46)
- "Precisa de atenção" para a coordenação; limiares dos sinais do Tutor e do Analista (F9, F12)
- Recursos, Mural, Frequência e Ranking da turma (sem fase)

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Professor | corrigir gabarito, responder contestação, ver atenção e ficha do aluno, nas turmas e disciplinas dele | mudar resposta de aluno; aprovar sem abrir os destaques |
| Aluno | ver o resultado aprovado, contestar questão | ver colegas; escrever texto livre na contestação |
| Coordenação | o que já tem: suspender a função, ler o nominal com finalidade e auditoria | ver atenção ou contestação de um aluno |

## 5. Requisitos funcionais

**Correção e lote**

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | Destaques do lote pela D88: em branco, fora do histórico (40 pontos), mesma alternativa repetida. Errar o que quase todos acertaram vira "questão que quase todos acertaram" no relatório por questão | aluno que erra só essas não é destacado |
| RF2 | O professor corrige o gabarito de uma questão já corrigida; a turma é recorrigida e o lote volta a "para revisar", com a mudança destacada; o diagnóstico anterior vale até a reaprovação, e o registro anterior fica | nada novo ao aluno antes da reaprovação; dois registros de validação; auditoria |
| RF3 | No resultado aprovado, o aluno contesta uma questão, com motivo de lista fechada e sem texto livre, uma vez por questão, no ano letivo da turma | a segunda é recusada; não há campo de texto do aluno |
| RF4 | O professor vê as contestações na atividade e no lote: aceita (leva ao RF2) ou recusa com justificativa, que o aluno lê. Corrigir o gabarito aceita as abertas da questão | o aluno vê a decisão e a justificativa |

**Turmas**

| # | Requisito | Como se prova |
|---|---|---|
| RF5 | Em Alunos, "Precisam de atenção" lista em ordem de nome quem cumpre a D88, com o motivo escrito ("Abaixo da metade em EF07MA01: 3 de 8, em 2 atividades"; "Não enviou: Prova de frações"), sem cor vermelha, média ou posição | uma questão só da habilidade não basta; quem envia na segunda chamada sai |
| RF6 | O nome abre a **ficha do aluno**: por habilidade, atividade a atividade (a evolução), o que enviou, o motivo de atenção e as contestações, dizendo de onde vem cada número | sem média, colegas nem Tutor; aluno de outra turma é "não encontrado" |
| RF7 | Hoje ganha a evolução da turma por habilidade, atividade a atividade | a API de Hoje não devolve nome de aluno |
| RF8 | Em Hoje, contagem de 1 ou 2 alunos aparece como "menos de 3" (sinais, acerto, atenção humana); o número exato fica no "Ver quem" e em Alunos | 2 alunos que travaram: "menos de 3" |
| RF9 | Turmas considera só as disciplinas do professor na turma e só correção aprovada | atividade de outra disciplina não entra |

**Conformidade**

| # | Requisito | Como se prova |
|---|---|---|
| RF10 | Rascunho das etapas 2 a 6 das AIAs de correção e de diagnóstico, com o que a F6 e esta fase construíram; o que depende de advogado fica marcado | etapas preenchidas ou marcadas; `conformidade-reviewer` |

## 6. Regras de negócio

- Sem `Nota`: aprova-se diagnóstico formativo, corrigido pela conta do gabarito (D46)
- O lote aprovado não muda sem nova validação registrada (D56)
- "Precisa de atenção" sai só de correção aprovada e de entrega (D88), nunca de Tutor, tempo ou saída da aba
- Tudo por escola e ano letivo, em turma e disciplina de vínculo confirmado

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Aluno faltou | "Não enviou", até enviar na segunda chamada (F6) |
| Aluno transferido | A ficha diz "Saiu da turma"; ele sai de "Precisam de atenção" |
| Professor com duas disciplinas na turma | Turmas mostra as duas, nunca a de outro professor |
| Aluno chegou em maio | Atividade aplicada antes dele não vira "Não enviou" |
| Gabarito corrigido com contestações abertas na questão | Viram aceitas; o lote volta a "para revisar" |
| Função de correção suspensa | Corrigir o gabarito não recorrige até a função voltar, como o encerrar de hoje |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Resposta, tentativa e diagnóstico | aluno | correção e diagnóstico | a do mapa | sim |
| Contestação: questão, motivo de lista fechada, decisão e justificativa do professor | aluno; professor como autor | revisão do resultado (LGPD, art. 20) | a do diagnóstico | **não**: entra |
| Gabarito corrigido: questão, alternativa, quem e quando | professor como autor | correção do que a IA escreveu | a do artefato | **não**: entra |

A justificativa é texto do professor ao aluno, sobre a questão; a tela avisa para não escrever sobre a pessoa.

## 8b. Risco regulatório

**Alto** (correção de objetiva e perfil acadêmico individual). O gabarito e a habilidade escritos pela IA são
corrigíveis depois e contestáveis pelo aluno, com nova validação registrada (D33, D56). "Precisa de atenção" é fato
declarado, só para o professor da turma, explicado e contestável (D57, D60, D88). AIAs: RF10.

## 9. Métricas

- Gabaritos corrigidos depois da aprovação e contestações aceitas: medem o gabarito do modelo (etapa 6 da AIA)
- Professores que abrem a ficha do aluno ao menos uma vez por semana

## 10. Perguntas em aberto

1. Gabarito corrigido numa turma: oferecer a correção às outras turmas com a mesma atividade?
2. Os motivos da contestação
3. O limiar da "questão que quase todos acertaram" (o MVP usa 90%)
