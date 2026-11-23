# AIA — Sinais e alertas

> **Funcionalidade:** o que o Tutor avisa ao professor da turma, o "aluno que precisa de atenção"
> em "Turmas" (D69, D73) e o resumo e os alertas do Analista de desempenho escolar para a
> coordenação.
> **Funções cobertas** (`FUNCOES`, em `packages/shared/src/time/funcoes.ts`):
> `sinais_para_o_professor` — agente Tutor, autonomia 2 (executa e avisa), alto risco; e
> `resumo_e_alerta` — agente Analista de desempenho escolar, autonomia 2, alto risco. O "aluno
> que precisa de atenção" em "Turmas" não tem chave em `FUNCOES` (ver 1.7).
> **Estado:** etapa 1 fechada para o MVP em 05/10/2026, com as decisões do Joaquim da seção 1.9;
> revisão do Gabriel pendente; etapas 2 a 6 devidas antes do primeiro aluno real. O texto é do
> Claude (04/10/2026); o Joaquim decidiu os itens listados em 1.9, não leu o texto inteiro.
> **Etapas 2 a 6:** devidas antes do primeiro aluno real (D60, D71). Enquanto o dado for 100%
> sintético, a etapa 1 basta para o MVP de apresentação.
> **Sobre as fontes:** o ato do CNE de 01/09/2026 foi lido só por cobertura de imprensa
> (`docs/regulacao.md`). O que esta AIA atribui a ele vale até a leitura do texto oficial.
> **Pergunta aberta que esta AIA carrega:** acompanhar a saída da aba **fora** de avaliação. Hoje
> não existe (D70). Ver 1.8, item 1.

---

## Etapa 1 — Justificação e escopo

### 1.1 Para que existe, e que problema da escola resolve

**Para o professor.** O Tutor só é permitido porque é supervisionado (D47), e supervisionar
trinta conversas ao mesmo tempo, lendo uma a uma, não é possível numa aula. O sinal resolve isso:
diz ao professor quem travou e onde, quem pediu a resposta pronta e qual dúvida se repetiu, para
ele ir até a carteira certa. Em "Turmas", o mesmo raciocínio vale fora da aula: quem precisa de
atenção, e por qual fato.

**Para a coordenação.** Quem responde pela escola precisa enxergar o que está acontecendo sem
abrir aluno por aluno e sem vigiar professor. O Analista de desempenho escolar entrega um resumo
semanal e um alerta quando algo passa do limiar, sempre em agregado por série e disciplina.

**Resultado esperado:** o professor age mais cedo, sobre um fato; a coordenação vê tendência, não
pessoa; ninguém é decidido por um sinal.

### 1.2 Por que IA, e a alternativa menos invasiva

Há duas alternativas ao sinal, e as duas são piores para o aluno. Sem sinal nenhum, o Tutor
ficaria sem supervisão, o que a regra 70, item 4, proíbe. Com o professor lendo todas as
conversas, a supervisão viraria leitura integral do que cada aluno escreveu. O sinal é a
alternativa **menos** invasiva: mostra o fato que pede ação, e não a conversa.

Dentro do sinal, parte não precisa de modelo. Contar entregas, acertos e tentativas é aritmética.
O modelo se justifica onde é preciso ler o que o aluno escreveu — reconhecer que ele pediu a
resposta pronta, ou que a dúvida de agora é a mesma de antes. Essa classificação carrega texto de
aluno e segue a D62. Qual sinal usa modelo e qual é só conta é assunto da etapa 2.

No Analista, os números são agregação, sem modelo. O modelo escreve o texto do resumo a partir
dos números já agregados.

O que torna a função de alto risco é o efeito: um sinal sobre um aluno nomeado é perfilização
acadêmica individual, e chega perto de inferência comportamental (regra 70, tabela da
classificação).

### 1.3 Quem é afetado

- **O aluno.** É nomeado num sinal para o professor da turma. Um sinal errado ou mal lido muda o
  jeito de o professor olhar para ele.
- **O professor da turma.** Recebe os sinais. É também, em agregado, objeto do que o Analista
  mostra à coordenação, porque o desempenho das turmas dele é o indicador dele (D45).
- **A coordenação.** Recebe o resumo e os alertas.
- **A orientação educacional ou a direção.** Precisam receber o sinal "precisa de atenção humana"
  quando há risco à vida (`docs/regulacao.md`, seção 7).
- **A família.** Não é contatada por esta função.

### 1.4 O que a função faz (escopo positivo)

**Sinais do Tutor para o professor (`sinais_para_o_professor`).**

1. Por evento, e em resumo diário, o Tutor avisa o professor da turma, na thread dele em "Seu
   time": quem travou e onde, quem errou muito, quem pediu a resposta pronta, qual a principal
   dificuldade, qual dúvida se repetiu e quem concluiu o que foi atribuído (`docs/agentes.md`;
   `docs/glossario.md`, "Sinal").
2. O sinal **"precisa de atenção humana"** (D36) avisa que um aluno escreveu, de forma explícita,
   algo pessoal e delicado. Chega **sem o conteúdo**.
3. **Nível de autonomia 2: executa e avisa.** O sinal não espera aprovação, porque não decide
   nada: é aviso para uma pessoa olhar.
4. O aluno aparece nomeado **só para o professor da turma** (D34).
5. Todo sinal sai de **fato declarado** — entrega, desempenho, o que o aluno escreveu — e diz de
   que fato saiu (D57).

**"Aluno que precisa de atenção", em "Turmas".**

6. Sai de acerto por habilidade, de entrega e de onde o aluno travou, com a explicação na tela e
   caminho de contestação, e aparece nomeado só para o professor da turma (D69).

**Resumo e alerta do Analista (`resumo_e_alerta`).**

7. Toda segunda de manhã, e por evento que passa do limiar, monta o resumo e o alerta da
   coordenação **em agregado por série e disciplina**: média fora da curva, habilidade em queda,
   consumo de IA alto, alunos em risco. **Nível de autonomia 2.**
8. O alerta é **hipótese com contexto**, nunca veredito.
9. O detalhe por turma, professor ou aluno só abre com registro em auditoria (D34, D45). O
   recorte com um professor só conta como nominal (D45 revista).
10. Só avisa a coordenação. Nunca contata professor nem família.

Toda notificação sai dentro do horário útil da escola (D59).

### 1.5 O que a função não faz (escopo negativo)

Cada item traz o fundamento e o jeito de conferir, por teste automatizado ou por leitura de tela.

#### O que nenhum sinal ou alerta é

**N1. Não infere emoção, humor, atenção, comportamento nem personalidade.** Não existe sinal de
"desmotivado", "distraído", "ansioso" ou parecido.
Fundamento: D57; ECA Digital, art. 26; Decreto 12.880, art. 10; regra 70, item 7.
Como se confere: a lista de tipos de sinal é fechada; teste que recusa tipo fora dela; leitura
dos textos da aba Hoje da turma e do painel "O que o Tutor viu".

**N2. Não guarda texto sobre a pessoa.** O sinal traz o tipo e o fato de origem (a questão, a
habilidade, a atividade), não uma frase sobre o aluno.
Fundamento: D66; D57; regra 70, item 4d.
Como se confere: leitura do esquema da tabela de sinais; nenhum campo é texto livre sobre o
aluno.

**N3. Não mede tempo ocioso e não acompanha a navegação do aluno.** Não existe aviso de "aluno
usando outra IA" nem de "aluno parado".
Fundamento: regra 70, item 7; D69; D70.
Como se confere: não há evento de inatividade nem de foco de aba no contrato do Tutor; nenhum
tipo de sinal fala de tempo ou de navegação.

**N4. Não acompanha saída da aba fora de avaliação.** Durante a avaliação, a contagem é da
correção (`docs/aia/correcao-de-objetiva.md`) e não é sinal do Tutor.
Fundamento: D70; regra 70, item 7.
Como se confere: teste em que o registro de saída é recusado fora de avaliação em andamento.

**N5. Não soma sinais em pontuação do aluno** e não ordena alunos por quantidade de sinais como
classificação.
Fundamento: D57 (pontuação social; pontuar pessoa por comportamento); nível 4 de
`docs/agentes.md`.
Como se confere: não existe campo nem consulta de pontuação por aluno; leitura de "Turmas" e do
painel "O que o Tutor viu".

**N6. Não decide nada e não tem consequência automática.** Um sinal não bloqueia o Tutor para o
aluno, não muda a atividade, não gera encaminhamento e não entra em nota.
Fundamento: regra 70, item 2; D34 ("sinal para um humano olhar, nunca decisão sobre o aluno").
Como se confere: nenhuma rotina lê sinal para alterar estado do aluno; teste em que o Tutor e as
atividades do aluno funcionam igual com e sem sinais.

**N7. Não aparece sem dizer de que fato saiu.**
Fundamento: D57; D60; D69 (explicação na tela e caminho de contestação).
Como se confere: leitura de tela: cada sinal e cada alerta cita o fato de origem. O caminho de
contestação ainda não está desenhado (1.8, item 6).

**N8. Não notifica fora do horário útil da escola.**
Fundamento: D59; Decreto 12.880, art. 9º.
Como se confere: teste em que sinal gerado fora do horário não dispara notificação.

**N9. Não serve a publicidade, a treinamento de modelo nem a qualquer fim comercial.**
Fundamento: D57; `docs/lgpd.md`, seção 6, item 5.
Como se confere: nenhum envio de sinal para fora da escola.

#### Quem vê o quê

**N10. Não mostra aluno nomeado a quem não é o professor da turma.** A coordenação vê agregado e
abre o detalhe só com registro em auditoria. A rede só lê agregado.
Fundamento: D34; regra 10, item 8; regra 20, item 10.
Como se confere: teste de autorização por objeto na rota de sinais; teste em que a leitura
nominal pela coordenação grava auditoria; teste de isolamento da rede.

**N11. Não mostra a conversa do aluno junto do sinal.**
Fundamento: regra 70, item 7 (supervisão não é vigilância); `docs/fluxos.md` ("o professor vê uso
e dificuldade, não uma janela sobre o comportamento do aluno").
Como se confere: leitura da aba Hoje da turma e do painel "O que o Tutor viu": o sinal aparece sem trecho de conversa.

**N12. O sinal "precisa de atenção humana" não leva o conteúdo.** O acesso ao conteúdo, por quem
precisa notificar, é caminho próprio e auditado.
Fundamento: D36; `docs/regulacao.md`, seção 7.
Como se confere: teste em que o sinal devolvido ao professor não tem o texto do aluno.

**N13. O aluno não vê sinal de colega.**
Fundamento: regra 50, item 9.
Como se confere: o que a API devolve ao aluno só tem o que é dele.

#### O que o Analista não faz

**N14. Não contata professor nem família.**
Fundamento: `FUNCOES` (`resumo_e_alerta`); `docs/agentes.md`; regra 70 (comunicação com a
família só com aprovação humana).
Como se confere: o Analista não tem rota de envio a ninguém além da coordenação.

**N15. Não ranqueia professores e não dá veredito sobre professor.** Não recomenda avaliação
funcional, sanção nem dispensa, nem como sugestão.
Fundamento: D45; regra 70, item 8; nível 4 de `docs/agentes.md`.
Como se confere: leitura do resumo e dos alertas; nenhuma coluna, filtro ou ordenação por
professor na governança.

**N16. Não mostra à coordenação agregado de recorte com um professor só.** Com um professor, o
agregado é nominal: o professor vê primeiro, e a coordenação abre com auditoria.
Fundamento: D45, revista em 19/09/2026.
Como se confere: teste em que o recorte de série e disciplina com um professor não é devolvido
como agregado.

**N17. Não mede adoção nominal.** Não existe alerta de "professor que não usa", lista de uso por
professor nem meta de uso.
Fundamento: D64; regra 70, item 9.
Como se confere: leitura das telas da coordenação; adoção só aparece agregada por série e
disciplina.

**N18. Não lê a conversa do professor com o Assistente de ensino.**
Fundamento: regra 70, item 8.
Como se confere: teste de que só o próprio professor lê a thread dele.

**N19. Não decide nem recomenda aprovação, reprovação ou encaminhamento de aluno.** "Alunos em
risco" é contagem em agregado, para alguém olhar.
Fundamento: regra 70, item 2; D34.
Como se confere: leitura do texto dos alertas.

#### Para onde o dado vai

**N20. Não manda texto de aluno a provedor sem processamento no Brasil.** A classificação de
sinais carrega o que o aluno escreveu.
Fundamento: D62; `docs/lgpd.md`, seção 6, item 7. **Exceção vigente:** enquanto o dado for 100%
sintético, vale o afrouxamento 2 da D71.
Como se confere: na fase definitiva, teste de roteamento; no MVP, não se aplica.

**N21. Não envia nome nem matrícula ao provedor de modelo.**
Fundamento: regra 20, item 12.
Como se confere: teste que captura, no adaptador falso, o que foi montado para o modelo, na
classificação do sinal e no texto do resumo.

**N22. Não guarda sinal para sempre.**
Fundamento: `docs/lgpd.md`, linhas "Sinais de uso de IA" e "Sinal 'precisa de atenção humana'":
12 meses.
Como se confere: a rotina de expurgo cobre os sinais, com teste. No MVP a rotina não existe.

### 1.6 O dado que entra, e o que sai para terceiro

**Entra:** a conversa do aluno com o Tutor; as respostas, a correção e o diagnóstico de lotes
aprovados; as entregas; o consumo de IA.

**Fica guardado:** os sinais, o resumo do Analista e a auditoria das leituras nominais.

**Linhas do mapa de `docs/lgpd.md`:**

- "Sinais de uso de IA" — aluno; supervisão docente; legítimo interesse da escola; 12 meses.
- "Sinal 'precisa de atenção humana' (sem conteúdo)" — aluno; proteção do titular, melhor
  interesse (art. 14); 12 meses.
- "Conversa com o tutor" e "Diagnóstico por habilidade", que são as fontes.
- "Indicadores de uso e das turmas do professor" — titular: o professor; base legal **a confirmar
  com advogado**.
- "Auditoria", para toda leitura nominal pela coordenação.

**O que o mapa ainda não tem:**

- não há linha para o **resumo e o alerta do Analista**. Se forem sempre agregados, não
  identificam ninguém; mas o alerta de "alunos em risco" numa turma pequena pode identificar, e a
  linha precisa existir se o resumo guardar qualquer coisa abaixo do agregado;
- não há linha para o **"aluno que precisa de atenção" em "Turmas"**. Se for só leitura do
  diagnóstico e dos sinais, não é dado novo; se o sistema guardar a marcação, é dado novo e entra
  no mapa antes da migration (regra 20, item 1).

**Sai para terceiro (provedor de modelo):** na classificação do sinal, o trecho do que o aluno
escreveu, sem nome, só para provedor com processamento no Brasil (D62). No resumo do Analista,
os números já agregados. O provedor ainda não está escolhido (D37).

### 1.7 Suspensão da função numa escola

**O que já está decidido (D60, revista em 23/09/2026):** a suspensão é por função e por escola,
decidida pela coordenação, com registro próprio (quem, quando, motivo) e auditoria, e vale no
servidor: função suspensa recusa executar. São duas chaves, suspensas uma sem a outra:
`sinais_para_o_professor` e `resumo_e_alerta`.

**Três pontos que o desenho atual deixava sem resposta. Só o 2 foi decidido pelo Joaquim em 05/10/2026 (1.9); o 1 e o 3 continuam abertos:**

1. **(Aberto.)** **Tutor ligado com os sinais suspensos.** A D47 sustenta o Tutor sem aprovação prévia porque
   ele é supervisionado "com sinais ao vivo para o professor, registro, resumo". Com
   `sinais_para_o_professor` suspensa e `tutor_com_o_aluno` ligada, sobram o registro e a
   conversa visível. Falta decidir se isso ainda conta como supervisão, ou se suspender os sinais
   exige suspender o Tutor.
2. **(Decidido para o MVP, 1.9; a rever antes do primeiro aluno real.)** **O sinal "precisa de atenção humana".** O texto de `sinais_para_o_professor` em `FUNCOES` não
   o cita, e ele é salvaguarda do aluno (D36), não aviso pedagógico. Falta decidir se a suspensão
   dos sinais o desliga. O Joaquim decidiu que **não desliga**: suspender `sinais_para_o_professor` não desliga o sinal de atenção humana (D36).
3. **(Aberto.)** **"Aluno que precisa de atenção", em "Turmas".** Não tem chave em `FUNCOES`. Hoje nenhuma
   suspensão o alcança.

**O que acontece com o que a função já produziu — decidido pelo Joaquim em 05/10/2026 (1.9):**

- com a função suspensa, nenhum sinal novo e nenhum resumo novo são gerados;
- os sinais e os resumos já gerados continuam visíveis a quem já os via, e seguem a retenção;
- a auditoria das leituras nominais nunca é apagada pela suspensão.

### 1.8 O que está em aberto

1. **Acompanhar a saída da aba fora de avaliação, com o aluno estudando em sala.** Hoje não
   existe: bate na regra 70, item 7, porque deixa de ser integridade da prova e vira janela sobre
   o comportamento (D70). É pergunta para o parecer (`TODO.md`, pergunta (e); `docs/regulacao.md`,
   seção 11, item 11). Depende do Joaquim e do Gabriel, com advogado. **Sem parecer, continua não
   existindo**, e esta AIA não a autoriza. O pedido de "avisar quando o aluno usa outra IA" é
   recusado pela mesma regra.
2. **Quais sinais, com que limiar e com que texto.** É a decisão em aberto dos indicadores
   (`CLAUDE.md`), do Joaquim e do Gabriel: os de turma e aluno antes do PRD do F6, os de professor
   antes do PRD do F12. Ponto de partida: percentual de erro e acerto por habilidade e o sinal
   "concluiu o que foi atribuído". *Decidido na D88 (23/11/2026)* para "aluno que precisa de atenção" em Turmas e para o
   piso de 3 na tela projetada; os limiares dos sinais do Tutor seguem em aberto (F9).
3. **A lista de tipos de sinal não é a mesma em todo lugar.** `docs/agentes.md` lista travou,
   errou muito, pediu resposta pronta, principal dificuldade e dúvida repetida; o glossário
   acrescenta "concluiu o que foi atribuído"; `docs/modelo-de-dados.md` traz `fora_de_escopo`; o
   contrato do MVP tem quatro. Falta fechar a lista. Sobre **`fora_de_escopo`**: avisar o
   professor de que um aluno perguntou algo fora da matéria fica perto de acompanhar
   comportamento, e precisa de decisão própria. Depende do Joaquim e do Gabriel, com o
   `conformidade-reviewer`.
4. **O campo `detalhe` do sinal**, em `docs/modelo-de-dados.md`. Para o N2 valer, ele precisa ser
   referência a questão, habilidade ou atividade, e não texto livre. Depende do Joaquim.
5. **Grupo mínimo para agregado de alunos.** A D45 fixa o mínimo de dois professores no recorte;
   nenhuma decisão fixa um mínimo de alunos para o agregado que a coordenação vê. Depende do
   Joaquim.
6. **Explicação em linguagem comum e caminho de contestação**, para o aluno e para o professor
   (D60; LGPD, art. 20). Sem desenho ainda; etapas 4 e 6.
7. **Base legal dos sinais**, na escola particular e na rede pública, e **dos indicadores de
   professor**. Dependem de advogado (`TODO.md`; `docs/regulacao.md`, seção 11, item 8).
8. **Protocolo de risco à vida:** como o sinal "precisa de atenção humana" chega a quem notifica
   o Conselho Tutelar. Depende da escola, de advogado e de orientação educacional; a detalhar no
   PRD do F9.
9. **Os três pontos da suspensão** (1.7). **Parcialmente decidido (1.9):** o ponto 2 (atenção humana), para o MVP e a rever antes do primeiro aluno real. Os pontos 1 (Tutor ligado sem os sinais, e se isso ainda é supervisão, D47) e 3 (sem chave para "aluno que precisa de atenção" em "Turmas") continuam abertos, dependem do Joaquim, e valem como pergunta para o primeiro aluno real.

Os itens restantes não bloqueiam o MVP de apresentação (dado sintético, D71); bloqueiam o primeiro aluno real (etapas 2 a 6).

### 1.9 Decisões do Joaquim para o MVP (05/10/2026)

1. **Suspensão (1.7), o que a função já produziu.** Aceita a proposta de 1.7 tal como escrita: com a função suspensa nenhum sinal novo e nenhum resumo novo são gerados; os já gerados continuam visíveis a quem já os via e seguem a retenção; a auditoria das leituras nominais nunca é apagada. Foi o que o MVP implementou, e a revisão da fase 4 aprovou.
2. **Atenção humana (1.7, ponto 2).** Suspender `sinais_para_o_professor` **não** desliga o sinal "precisa de atenção humana" (D36). A rever antes do primeiro aluno real.
3. **Não decidido, com franqueza:** os pontos 1 e 3 de 1.7 (Tutor ligado com os sinais suspensos; "aluno que precisa de atenção" em "Turmas" sem chave) seguem abertos. A decisão do Joaquim sobre chaves tratou do diagnóstico e da saída da aba, não destes.

---

## Etapa 2 — Análise dos dados e do modelo

Falta: qual sinal é conta e qual usa modelo, a taxa de acerto mínima da classificação em amostras
fixas (regra 40), e a declaração de que não treinamos modelo. Antes do primeiro aluno real.

## Etapa 3 — Identificação e avaliação de riscos

Falta: a lista com probabilidade e impacto — sinal falso, sinal lido como rótulo, aluno
identificável num agregado pequeno, alerta lido como veredito sobre professor, falha em gerar o
sinal de atenção humana. Antes do primeiro aluno real.

## Etapa 4 — Estratégias de mitigação

Falta: a mitigação por risco, o texto de cada sinal e alerta em linguagem comum, e o caminho de
contestação e de revisão. Antes do primeiro aluno real.

## Etapa 5 — Validação e auditoria da equidade

Falta: o método. Não guardamos raça, renda nem território, então a desagregação possível é por
turma, série e escola, com escuta de professor (`docs/conformidade-mec.md`, seção 8, que cita os
sinais do Tutor pelo nome). Aqui entra medir se o sinal cai mais sobre quem escreve em registro
informal ou sobre quem tem adaptação registrada. Antes do primeiro aluno real.

## Etapa 6 — Monitoramento contínuo e governança

Falta: os indicadores periódicos, a revisão a cada troca de modelo ou de prompt, o canal de
contestação e o procedimento de suspensão fechado (1.7 tem três pontos sem resposta). Antes do
primeiro aluno real.

---

## O que o MVP de apresentação implementa desta funcionalidade

Conforme `docs/mvp-rapido.md`, com dado 100% sintético.

**Existe agora:**

- quatro tipos de sinal para o professor da turma (`GET /sinais?turmaId=`): `travou`,
  `resposta_pronta`, `duvida_repetida` e `atencao_humana`, esta **sem o conteúdo**;
- os sinais aparecem na aba Hoje da turma, na voz do Tutor, em soma e sem nome, e por aluno no painel "O que o Tutor viu", sem conversa de aluno;
- o resumo do Analista para a coordenação, em agregado, com grupo mínimo de dois professores no
  recorte (D45), gerado a pedido (`POST /analista/gerar`);
- o detalhe nominal só por botão próprio, com aviso e registro em auditoria
  (`GET /analista/nominal`);
- a governança sem coluna, filtro nem ordenação por professor;
- a coordenação suspende e retoma cada uma das duas funções, e a suspensão vale no servidor;
- o texto do resumo sai do adaptador falso, determinístico; o modelo local só entra no ensaio
  final.

**Fica para a fase definitiva (F6, F10 e F12):**

- **qualquer contagem de saída da aba: não está no MVP**, nem durante a prova (D70), nem fora
  dela, onde não existe por decisão;
- o "aluno que precisa de atenção" em "Turmas": não consta do contrato do MVP;
- os sinais "errou muito", "principal dificuldade" e "concluiu o que foi atribuído", e o resumo
  diário do Tutor: não constam do contrato do MVP;
- o resumo automático de segunda de manhã e o alerta por limiar: os limiares estão em aberto;
- o tempo real: no MVP a aba Hoje relê os sinais a cada 15 s, sem WebSocket; o uso por aluno do painel "O que o Tutor viu" é lido uma vez, ao abrir;
- o caminho auditado para a orientação ou a direção em caso de risco à vida;
- o roteamento por soberania (D62), afrouxado enquanto o dado for sintético (D71);
- a explicação e o caminho de contestação, e a rotina de expurgo dos sinais.
