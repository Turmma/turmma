# AIA — Adaptação

> **Funcionalidade:** a função de adaptação do Assistente de ensino e a ferramenta Adaptação, que
> propõem a versão adaptada de uma prova ou atividade a partir do **tipo de adaptação**.
> **Função coberta** (`FUNCOES`, em `packages/shared/src/time/funcoes.ts`): `adaptacao` — agente
> Assistente de ensino, autonomia 3 (propõe e espera aprovação), alto risco.
> **Estado:** etapa 1 fechada para o MVP em 05/10/2026, com as decisões do Joaquim da seção 1.9;
> revisão do Gabriel pendente; etapas 2 a 6 devidas antes do primeiro aluno real. O texto é do
> Claude (04/10/2026); o Joaquim decidiu os itens listados em 1.9, não leu o texto inteiro.
> **Etapas 2 a 6:** devidas antes do primeiro aluno real (D60, D71). Enquanto o dado for 100%
> sintético, a etapa 1 basta para o MVP de apresentação.
> **Sobre as fontes:** o ato do CNE de 01/09/2026 foi lido só por cobertura de imprensa
> (`docs/regulacao.md`). O que esta AIA atribui a ele vale até a leitura do texto oficial.

---

## Etapa 1 — Justificação e escopo

### 1.1 Para que existe, e que problema da escola resolve

A escola tem alunos que precisam de prova e atividade em outra forma: letra maior, mais tempo,
enunciado em linguagem direta, resposta escrita no lugar da oral. Decidir quem precisa de quê é
trabalho da equipe da escola, com a família, no plano individual que a lei manda a escola fazer
(LBI, art. 28, VII; Decreto 12.686/2025). O que falta ao professor é tempo para refazer cada prova
em cada forma, e é esse trabalho que a função prepara.

O que a lei pune é recusar a adaptação razoável (LBI, art. 4º, § 1º, e art. 88), não deixar de
usar um software. A função existe para que adaptar deixe de depender de o professor ter uma hora
livre, e para que a escola consiga mostrar, depois, quais atividades foram adaptadas e quem
aprovou cada versão (`docs/regulacao.md`, seção 7.1).

**Resultado esperado:** o professor recebe uma versão adaptada pronta para conferir, em vez de
escrevê-la do zero, e nenhuma versão chega ao aluno sem que ele tenha aprovado.

### 1.2 Por que IA, e a alternativa menos invasiva

A alternativa sem IA é a que existe hoje: o professor adapta à mão. Ela continua disponível, e a
função nunca a impede.

Dos seis tipos da lista fechada, nem todos pedem um modelo de linguagem. **Fonte ampliada** e
**tempo adicional** são mudança de formato e de configuração: dá para aplicá-los sem chamar
modelo nenhum, e essa é a alternativa menos invasiva para os dois. O modelo se justifica onde há
reescrita de texto — **linguagem direta**, **enunciado simplificado**, **leitura de apoio** e
**resposta escrita no lugar da oral** —, porque reescrever um enunciado mantendo o que ele cobra
é trabalho de linguagem. Se a implementação passar os dois primeiros tipos pelo modelo, a etapa 2
precisa dizer por quê.

O dado que tornaria a função perigosa, a condição do aluno, não entra: a função trabalha com o
tipo de adaptação e com o texto da atividade, e isso é escolha de minimização (D35, D67).

### 1.3 Quem é afetado

- **O aluno com adaptação necessária.** É o titular de um dado sensível (LGPD, art. 11), e é
  quem recebe a versão adaptada. Uma adaptação malfeita pode cobrar dele algo diferente do que
  foi cobrado da turma, ou deixar de adaptar o que ele precisava.
- **O professor da turma.** Pede a versão, confere e aprova. A responsabilidade pelo que chega
  ao aluno é dele.
- **A coordenação.** Registra a adaptação necessária de cada aluno, sempre como tipo (D35), e vê
  na governança o que a IA gerou e quem aprovou.
- **Os colegas de turma.** Não podem ficar sabendo, pela tela, quem recebeu versão adaptada
  (regra 50, item 9).
- **A família**, na fase posterior, e a **equipe de inclusão da escola**, que faz o plano
  individual e continua fazendo sem o sistema.

### 1.4 O que a função faz (escopo positivo)

1. Recebe uma atividade já existente (um artefato do professor) e um ou mais **tipos de
   adaptação** de uma lista fechada: fonte ampliada, tempo adicional, linguagem direta, enunciado
   simplificado, resposta escrita no lugar da oral e leitura de apoio. Com tempo adicional,
   recebe também o percentual, de 10% a 100% sobre o tempo da turma.
2. Prepara a versão adaptada no mesmo formato da atividade original, com a página do material da
   escola citada em cada questão (D6). A versão registra quais tipos foram aplicados, e mais
   nada sobre o aluno.
3. **Nível de autonomia 3: propõe e espera aprovação.** A versão nasce como entrega pendente. O
   professor da turma aprova, ou rejeita com justificativa. A aprovação grava quem decidiu e
   quando.
4. Só uma versão aprovada pode ser aplicada.
5. **Dispara** quando o professor pede, pela ferramenta Adaptação ou pela conversa com o
   Assistente de ensino. Na fase definitiva, dispara também quando uma avaliação ou atividade é
   criada para uma turma que tem aluno com adaptação registrada, e alcança material didático
   quando o professor pedir (`docs/agentes.md`).

### 1.5 O que a função não faz (escopo negativo)

Cada item traz o fundamento e o jeito de conferir, por teste automatizado ou por leitura de tela.

**N1. Não recebe, não guarda e não mostra diagnóstico, laudo, CID nem nome de condição.**
Fundamento: D35; LGPD, art. 11; regra 20, item 3.
Como se confere: o esquema da adaptação (`adaptacaoAplicadaSchema`) é estrito e só tem `tipos` e
`tempoExtraPercentual`; um teste envia campo a mais e espera recusa.

**N2. Não tem campo de texto livre sobre o aluno, e não aceita tipo fora da lista fechada.**
Fundamento: D67 ("o risco nunca esteve no nome da ferramenta, e sim no campo de texto livre onde
alguém escreve o diagnóstico").
Como se confere: leitura do formulário da ferramenta, que só tem a escolha dos tipos e o
percentual; teste que envia tipo inexistente e espera recusa.

**N3. Não envia ao provedor de modelo nome, matrícula, identificador de aluno nem motivo da
adaptação.**
Fundamento: regra 20, item 12; `docs/lgpd.md`, seção 6, itens 2 e 3; D66.
Como se confere: teste que captura, no adaptador falso, o que foi montado para o modelo e
verifica que só há o texto da atividade e os tipos.

**N4. Não entrega nada ao aluno sem aprovação registrada do professor da turma.**
Fundamento: regra 70, item 3; D47 (a exceção da resposta do Tutor não se estende a esta função).
Como se confere: teste em que aplicar uma versão adaptada com a entrega pendente ou rejeitada
falha; e a restrição do banco em que entrega aprovada exige quem decidiu.

**N5. Não se aprova sozinha**, nem por tempo decorrido, nem por job, nem por importação.
Fundamento: regra 70, item 3; `docs/agentes.md` ("toda entrega de agente nasce pendente").
Como se confere: não existe caminho no código que mude a entrega para aprovada sem usuário
autenticado; teste que percorre os caminhos de criação e espera sempre "pendente".

**N6. Não descobre, não deduz e não sugere que um aluno precisa de adaptação.** O tipo só entra
por escolha de uma pessoa: a coordenação, quando registra, ou o professor, quando pede.
Fundamento: D35 (quem registra é a coordenação); D57 (sem perfil comportamental ou psicológico);
`docs/regulacao.md`, seção 7.1 (o plano é da equipe da escola).
Como se confere: nenhuma tela e nenhuma saída de agente propõe tipo de adaptação para um aluno a
partir de desempenho, de conversa ou de sinal; leitura das telas de Turmas, "O que o Assistente fez" e "O que o Tutor viu".

**N7. Não gera o PEI, o plano de atendimento educacional especializado, o estudo de caso nem
qualquer documento que descreva o aluno.**
Fundamento: D67; `docs/regulacao.md`, seção 7.1.
Como se confere: a lista de ferramentas (`FERRAMENTAS`) não tem essa saída, e o formato do
artefato não tem campo para descrever pessoa.

**N8. Não decide que um aluno fará a versão adaptada, e não a aplica sozinha.**
Fundamento: regra 70, item 2; nível 4 de `docs/agentes.md` (decisão sobre o aluno é humana).
Como se confere: aplicar é ação do professor, em rota própria; teste de que a geração da versão
não cria aplicação.

**N9. Não produz questão sem página citada do material da escola.**
Fundamento: D6; o contrato do artefato recusa conteúdo sem citação.
Como se confere: teste que valida a saída do modelo contra o esquema e recusa questão sem
citação.

**N10. Não corrige, não avalia e não comenta a resposta que o aluno der à versão adaptada quando
ela for discursiva ou de redação.**
Fundamento: D55; regra 70, item 2a.
Como se confere: é o mesmo teste da correção (`docs/aia/correcao-de-objetiva.md`, N5); trocar a
forma da resposta não muda quem corrige.

**N11. Não deixa colega, família de outro aluno nem rede saber quem tem adaptação.** O professor
da turma e a coordenação veem, e o acesso fica em auditoria.
Fundamento: D35 (`docs/agentes.md`: "o professor da turma vê; todo acesso fica em auditoria");
regra 50, item 9; regra 10, item 8.
Como se confere: teste de que nenhuma resposta da API ao aluno traz adaptação de outra pessoa, e
de que a camada de rede só recebe agregado.

**N12. Não usa o tipo de adaptação para outro fim:** não forma perfil, não alimenta indicador,
não serve a publicidade nem a treinamento de modelo.
Fundamento: D57; `docs/lgpd.md`, seção 6, item 5; regra 20 (não inventamos finalidade nova).
Como se confere: a única leitura do tipo de adaptação fora desta função é a do Tutor, para
ajustar a forma da conversa (D66), coberta em `docs/aia/tutor.md`.

### 1.6 O dado que entra, e o que sai para terceiro

**Entra:** o texto da atividade original, que vem do material da escola e não é dado de pessoa;
os tipos de adaptação escolhidos; o percentual de tempo, quando houver; a turma e a disciplina,
para o escopo.

**Fica guardado:** a versão adaptada (artefato), a entrega com quem decidiu, quando e, na
rejeição, a justificativa; o registro da execução do agente e o consumo.

**Linha do mapa de `docs/lgpd.md`:** "Adaptação pedagógica necessária", sempre como tipo de
adaptação. É dado sensível (art. 11), com base legal marcada lá como **a confirmar com
advogado**, e retenção enquanto houver vínculo, revista a cada ano letivo. A aprovação entra na
linha "Auditoria" (aprovação de saída de IA), e o pedido feito pela conversa, na linha "Conversa
do professor com o chat".

**O que o mapa ainda não tem:** não há linha própria para a entrega decidida — quem aprovou ou
rejeitou, quando, e o texto da justificativa. A justificativa é texto escrito pelo professor, e
é dado pessoal dele. Se a implementação guardar esse texto, a linha precisa entrar no mapa na
mesma tarefa (regra 20, item 1).

**Sai para terceiro (provedor de modelo):** o texto da atividade e os tipos de adaptação. Nunca
o nome, o identificador nem o motivo (N3). Não há conversa de aluno nesta função, então a D62,
pelo texto dela, não a alcança: tarefa sem dado pessoal pode usar provedor fora do País, com as
cláusulas-padrão da ANPD e informação à escola. Ver o item 3 de 1.8.

### 1.7 Suspensão da função numa escola

**O que já está decidido (D60, revista em 23/09/2026):** a suspensão é por função e por escola.
A coordenação suspende `adaptacao` sem desligar a conversa do professor, a correção de objetiva
nem o Tutor. A suspensão vale no servidor: função suspensa recusa executar, e entrega de função
suspensa não nasce. Fica um registro próprio, com quem suspendeu, quando e o motivo, e com
auditoria. A coordenação retoma pelo mesmo caminho.

**O que acontece com o que a função já produziu — decidido pelo Joaquim em 05/10/2026 (1.9):**

- pedido novo de adaptação é recusado, com mensagem que diz que a função está suspensa na escola;
- entrega pendente continua pendente e não pode ser aprovada enquanto durar a suspensão; pode
  ser rejeitada;
- versão já aprovada continua valendo, porque uma pessoa a aprovou;
- a tela de suspensão avisa que **a obrigação de adaptar continua sendo da escola**: suspender a
  função devolve o trabalho ao professor, não dispensa a adaptação.

### 1.8 O que está em aberto

1. **Base legal para guardar a adaptação necessária do aluno**, agora lida também pelo Tutor.
   Depende de advogado (`TODO.md`; `docs/lgpd.md`, seção 2).
2. **Não gerar o PEI é escolha de minimização, não proibição legal.** A confirmar com advogado,
   junto do item 1 (D67; `docs/regulacao.md`, seção 7.1).
3. **Para qual provedor esta função manda o texto.** A D66 diz que, no Tutor, o tipo de adaptação
   só viaja para provedor com processamento no Brasil. Para a função de adaptação não há decisão
   escrita. Depende do Joaquim, junto da escolha do provedor (D37).
4. **Decidido para o MVP (1.9).** **A versão adaptada pode mudar o que é cobrado?** A D66 diz, sobre o Tutor, que a adaptação
   muda a forma e nunca o que é cobrado. Para esta função não há frase equivalente, e "enunciado
   simplificado" pode mudar a dificuldade. Falta decidir se a versão adaptada mantém, em cada
   questão, a mesma habilidade, a mesma página e o mesmo gabarito da original. Depende do
   Joaquim, com revisão pedagógica; pesa na equidade (etapa 5) e no diagnóstico por habilidade.
   *Decisão:* mantém, em cada questão, a mesma habilidade, a mesma página citada e o mesmo gabarito
   da original. A adaptação muda a forma, nunca o que é cobrado (mesmo espírito da D66). A
   conferência já existe no código (1.9). A revisão pedagógica que o item pedia e a medição na
   etapa 5 continuam devidas antes do primeiro aluno real.
5. **A lista de tipos não é a mesma em todo lugar.** O contrato (`TIPOS_DE_ADAPTACAO`) tem seis
   tipos; a D67 cita "compatível com leitor de tela", que não está entre eles; "leitura de apoio"
   está no contrato e não é descrita em nenhum documento; e o mockup lista outros (enunciado
   direto, apoio visual, menos itens por página). Depende do Joaquim e do Gabriel.
6. **Decidido para o MVP (1.9; a rever antes do primeiro aluno real).** **A justificativa da rejeição é texto livre.** É o mesmo risco que a D67 tirou do formulário:
   o professor pode escrever ali a condição do aluno. Falta decidir se o campo vira lista de
   motivos, se fica texto com aviso, ou se fica como está. Depende do Joaquim.
   *Decisão:* continua texto livre, com aviso na tela ao lado do campo. O risco residual, o
   professor escrever ali a condição do aluno, fica registrado como aceito para o MVP.
7. **Como a versão adaptada chega só ao aluno que precisa dela.** No contrato do MVP a atividade
   é aplicada à turma, e não está escrito como a versão adaptada é destinada a um aluno nem onde
   esse vínculo fica guardado. É esse vínculo que liga o dado sensível à pessoa. Depende do
   Joaquim.
8. **O tipo de adaptação em log.** A regra 20, item 9, lista o que nunca vai para log e não cita
   o tipo de adaptação pelo nome. Esta AIA propõe tratá-lo do mesmo jeito quando estiver ao lado
   de um identificador de aluno. A confirmar pelo Joaquim.

Os itens restantes não bloqueiam o MVP de apresentação (dado sintético, D71); bloqueiam o primeiro aluno real (etapas 2 a 6).

### 1.9 Decisões do Joaquim para o MVP (05/10/2026)

1. **Suspensão (1.7).** Aceita a proposta de 1.7 tal como escrita: pedido novo é recusado; entrega pendente fica pendente e não pode ser aprovada durante a suspensão, só rejeitada; versão já aprovada continua valendo; o registro da validação nunca é apagado. Foi o que o MVP implementou, e a revisão da fase 4 aprovou.
2. **A versão adaptada não muda o que é cobrado (1.8, item 4).** Em cada questão, mantém a mesma habilidade, a mesma página citada e o mesmo gabarito da original. Já é conferido no código: `exigirAdaptacaoFiel`, em `apps/api/src/artefato/conferencia.ts`, chamado por `apps/api/src/artefato/artefato.service.ts` ao gravar a versão. Ele exige o mesmo número e a mesma ordem de questões, o mesmo gabarito, o mesmo número de alternativas, a mesma habilidade (código e descrição) e a mesma citação (material, página e trecho), e que a `adaptacao` gravada seja exatamente a pedida (tipos e percentual de tempo). Fora disso lança `IA_SAIDA_INVALIDA`, e nem a versão nem a entrega nascem. O teste está em `apps/api/src/artefato/conferencia.test.ts`.
3. **Justificativa da rejeição (1.8, item 6).** Continua texto livre, com aviso na tela. O aviso é `AVISO_DA_JUSTIFICATIVA`, definido em `apps/web/src/areas/professor/artefatos/entregas.ts` e mostrado como dica do campo "Por que você está rejeitando?" em `apps/web/src/areas/professor/assistente/Time.tsx`. O texto real é: "Diga o que está errado na versão, para o Assistente refazer. Não escreva nome de aluno nem o motivo da adaptação." O risco residual (o professor escrever a condição do aluno mesmo assim) fica **aceito para o MVP e a rever antes do primeiro aluno real**.

---

## Etapa 2 — Análise dos dados e do modelo

Falta: qual modelo faz a reescrita, a declaração de que não treinamos modelo, e como a qualidade
da reescrita é medida com amostras fixas (regra 40). Antes do primeiro aluno real.

## Etapa 3 — Identificação e avaliação de riscos

Falta: a lista de riscos com probabilidade e impacto — versão que muda o que é cobrado, versão
que não adapta de fato, exposição de quem tem adaptação, condição escrita em campo de texto.
Antes do primeiro aluno real.

## Etapa 4 — Estratégias de mitigação

Falta: a mitigação por risco, a explicação em linguagem comum para o aluno e para o professor, e
o caminho de contestação da versão adaptada. Antes do primeiro aluno real.

## Etapa 5 — Validação e auditoria da equidade

Falta: o método. Não guardamos raça, renda nem território, então a desagregação possível é por
turma, série e escola, com escuta de professor (`docs/conformidade-mec.md`, seção 8). Aqui pesa
também comparar o resultado de quem fez a versão adaptada com o da turma. Antes do primeiro
aluno real.

## Etapa 6 — Monitoramento contínuo e governança

Falta: os indicadores periódicos, a revisão a cada troca de modelo ou de prompt, e o procedimento
de suspensão fechado (1.7 ainda tem proposta a confirmar). Antes do primeiro aluno real.

---

## O que o MVP de apresentação implementa desta funcionalidade

Conforme `docs/mvp-rapido.md`, com dado 100% sintético.

**Existe agora:**

- o professor pede a versão adaptada de uma atividade escolhendo os tipos, sem campo de texto
  livre (`POST /artefatos/:id/adaptar`, com `tipos` e `tempoExtraPercentual`);
- a versão nasce como entrega **pendente**; o professor da turma aprova ou rejeita, e rejeitar
  exige justificativa;
- aplicar uma versão adaptada exige a entrega aprovada;
- a versão adaptada cita a página, como toda atividade, e exporta em PDF;
- a coordenação suspende e retoma a função `adaptacao` na governança, e a suspensão vale no
  servidor;
- o conteúdo da demonstração sai do adaptador falso, determinístico; o modelo local só entra no
  ensaio final.

**Fica para a fase definitiva (F7 e F11):**

- o registro da adaptação necessária por aluno, feito pela coordenação (a tela "Adaptações" da
  coordenação está fora do roteiro);
- o disparo automático quando se cria avaliação para turma com adaptação registrada;
- a adaptação de material didático, e a exportação em PPTX e XLSX;
- a leitura do tipo de adaptação pelo Tutor (D66): não consta do contrato do MVP;
- a fila de jobs: no MVP a execução roda no processo da API, como dívida declarada (D77).
