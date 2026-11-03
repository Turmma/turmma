# AIA — Correção de objetiva

> **Funcionalidade:** a correção de questões objetivas pelo Assistente de ensino, o registro da
> validação do professor (D56) e a contagem de saídas da aba durante a prova (D70).
> **Função coberta** (`FUNCOES`, em `packages/shared/src/time/funcoes.ts`): `correcao_de_objetiva`
> — agente Assistente de ensino, autonomia 2 (executa e avisa), alto risco. A mesma chave cobre o
> diagnóstico por habilidade, que tem avaliação própria em `docs/aia/diagnostico-por-habilidade.md`.
> A saída da aba não é função de agente e não tem chave em `FUNCOES` (ver 1.7).
> **Estado:** etapa 1 fechada para o MVP em 05/10/2026, com as decisões do Joaquim da seção 1.9;
> revisão do Gabriel pendente; etapas 2 a 6 devidas antes do primeiro aluno real. O texto é do
> Claude (04/10/2026); o Joaquim decidiu os itens listados em 1.9, não leu o texto inteiro.
> **Etapas 2 a 6:** devidas antes do primeiro aluno real (D60, D71). Enquanto o dado for 100%
> sintético, a etapa 1 basta para o MVP de apresentação.
> **Sobre as fontes:** o ato do CNE de 01/09/2026 foi lido só por cobertura de imprensa
> (`docs/regulacao.md`). O que esta AIA atribui a ele vale até a leitura do texto oficial.
> **Alcance deste rascunho:** a avaliação **online objetiva**. O modo papel com foto traz leitura
> de imagem, que não é determinística (regra 40), e reabre esta AIA antes do PRD do F6. Desde a D83 (03/11/2026) o modo
> papel é a F6b, com leitura determinística e sem IA: esta AIA é reaberta antes do PRD dela.

---

## Etapa 1 — Justificação e escopo

### 1.1 Para que existe, e que problema da escola resolve

Corrigir trinta provas objetivas à mão toma do professor um tempo que não ensina ninguém, e o
resultado costuma chegar ao aluno quando a matéria já passou. A função corrige a turma inteira
no fim da atividade, monta o relatório por questão e entrega ao professor um lote para conferir.

A escola tem um segundo problema, mais novo. As diretrizes do CNE classificam correção e
atribuição de nota como alto risco e exigem validação humana **efetiva, prévia, qualificada e
documentada**, dizendo que o professor não pode apenas clicar em "aprovar" (`docs/regulacao.md`,
seção 1.2). A escola precisa conseguir mostrar **como** o professor validou. O registro da
validação (D56) existe para isso.

**Resultado esperado:** o professor gasta o tempo dele nos casos que pedem olho humano, o aluno
recebe o resultado enquanto ainda importa, e a escola tem a prova de que uma pessoa validou.

### 1.2 Por que IA, e a alternativa menos invasiva

Na correção de objetiva, a alternativa menos invasiva **já é a adotada**: a conta é
determinística, por comparação da resposta com o gabarito. Não há modelo decidindo se uma
resposta está certa (`docs/mvp-rapido.md`, seção 4, item 5). O modelo entra só no texto do
relatório.

A função é tratada como alto risco mesmo assim, por dois motivos. O primeiro é a classificação:
ela interfere em avaliação. O segundo é onde o erro de fato pode estar: **o gabarito e a
habilidade de cada questão foram escritos por um modelo**, quando o Assistente de ensino gerou a
atividade. Um gabarito errado corrige errado a turma inteira, com toda a aparência de exatidão.
Por isso o lote destaca o item com padrão de erro suspeito, e por isso a validação do professor
não é formalidade.

A saída da aba (D70) não usa IA: é a contagem de quantas vezes a aba da prova perdeu o foco.

### 1.3 Quem é afetado

- **O aluno.** É dele o resultado, e é ele quem aparece num destaque. O aluno que usa leitor de
  tela, teclado virtual ou outra tecnologia assistiva é o mais exposto a falso positivo na
  contagem de saídas da aba (D70).
- **O professor da turma.** Valida o lote. O registro da validação é dado pessoal **dele**: diz o
  que ele abriu e quando confirmou.
- **A coordenação.** Vê na governança o que a IA gerou e quem aprovou.
- **A família**, na fase posterior, quando o resultado virar nota e comunicação.

### 1.4 O que a função faz (escopo positivo)

1. **Dispara** no fim da atividade ou da avaliação, quando o professor a encerra.
2. Corrige cada resposta objetiva comparando com o gabarito.
3. Monta o **lote** da turma: média, distribuição, acerto por habilidade, relatório por questão
   e os **destaques** — prova em branco, resultado muito fora do histórico do aluno, item com
   padrão de erro suspeito.
4. **Nível de autonomia 2: executa e avisa.** A correção é feita sem pedir, e o professor é
   avisado pelo sino e em "O que o Assistente fez". O que **vale** espera o professor: a entrega do lote nasce pendente.
5. O professor abre cada destaque. Só com todos abertos o botão de aprovar o lote libera, com o
   contador dizendo quantos faltam (D33).
6. A aprovação grava o **registro da validação**: o que foi apresentado, quais destaques foram
   abertos, quem confirmou e quando (D56).
7. Só depois da aprovação o resultado chega ao aluno.
8. Quando a nota oficial existir (D46), a função propõe a nota das objetivas, que só passa a
   existir com a validação registrada do professor.
9. **Saída da aba (D70):** durante uma avaliação online, o sistema conta quantas vezes a aba da
   prova perdeu o foco e mostra o número ao professor da turma, como fato, junto dos destaques.
   O aluno é avisado antes de começar.

### 1.5 O que a função não faz (escopo negativo)

Cada item traz o fundamento e o jeito de conferir, por teste automatizado ou por leitura de tela.

**N1. Não cria nota.** Corrigir e aprovar o lote não grava `Nota`. Quando a nota oficial entrar,
ela só existe com autor humano, em todo caminho: interface, job, importação, seed.
Fundamento: regra 70, item 1; D7; D46.
Como se confere: teste em que encerrar a atividade e aprovar o lote deixam a lista de notas
vazia; e, quando `Nota` existir, não há construtor sem autor.

**N2. Não mostra nada ao aluno antes de o professor aprovar o lote:** nem acerto, nem gabarito,
nem a explicação da alternativa correta.
Fundamento: regra 70, item 3; o contrato do artefato (a explicação "nunca chega ao aluno antes da
aprovação").
Como se confere: teste em que a prova do aluno vem sem gabarito, e em que o diagnóstico dele
responde como inexistente enquanto a entrega do lote está pendente.

**N3. Não deixa aprovar o lote com destaque fechado.**
Fundamento: D33; D56; `docs/regulacao.md`, seção 1.2.
Como se confere: teste em que aprovar o lote com um destaque não aberto falha; leitura da tela:
botão inativo, com o contador dizendo por quê. **O banco garante, por fora da API:** o lote só
fica aprovado com o registro da validação na mesma transação, e o registro só entra se toda
correção do lote com destaque estiver aberta e constar do que foi apresentado (gatilhos das
migrations 0022 e 0023, com teste). O que o banco não garante é que o `apresentado` seja igual ao
que a tela mostrou: isso é do serviço, com teste.

**N4. Não se aprova sozinha**, nem por tempo decorrido, nem por job, nem por reexecução.
Fundamento: regra 70, itens 1 e 3; D56.
Como se confere: nenhum caminho do código aprova sem usuário autenticado; a restrição do banco
exige quem decidiu em toda entrega aprovada; teste de que rodar a correção duas vezes não aprova
nem duplica o lote (D49).

**N5. Em discursiva e redação não faz nada sobre o texto do aluno:** não corrige, não avalia, não
dá nota nem conceito, não escreve devolutiva, não pré-corrige, não sugere nota e não calcula
grau de confiança. Nelas a função só organiza o lote, confere a entrega e prepara a correção
cega.
Fundamento: D55; regra 70, item 2a.
Como se confere: nenhum campo, nem interno, nem rascunho, nem log, guarda nota, conceito,
pontuação ou comentário de IA sobre texto discursivo; teste de que item discursivo não é enviado
ao modelo. No MVP, não existe item discursivo.

**N6. Não decide aprovação, reprovação, recuperação nem encaminhamento de aluno**, nem como
sugestão aplicada sozinha.
Fundamento: regra 70, item 2; nível 4 de `docs/agentes.md`.
Como se confere: nenhuma saída da função traz recomendação sobre o aluno; leitura da tela do lote.

**N7. Destaque não é acusação.** "Muito fora do histórico" e "padrão de erro suspeito" descrevem
um fato para o professor abrir. A função não rotula o aluno, não fala em cola e não aplica
consequência.
Fundamento: D57 (sem perfil comportamental); regra 70, item 2.
Como se confere: leitura do texto de cada destaque na tela; não há campo que guarde rótulo sobre
o aluno.

**N8. Não conta saída da aba fora de avaliação.** Aluno fazendo atividade não avaliativa ou
estudando com o Tutor não tem a navegação acompanhada.
Fundamento: D70; regra 70, item 7.
Como se confere: teste em que o registro de saída é recusado quando a atividade não é avaliativa
ou não está em andamento.

**N9. Não sabe nem tenta saber para onde o aluno foi.** Não captura tela, endereço, teclado,
câmera nem microfone.
Fundamento: D70 ("uma página web não enxerga isso"); D57 (sem biometria).
Como se confere: o que o navegador envia é só o evento de perda de foco; leitura do contrato da
rota e teste do que é gravado.

**N10. A saída da aba não tem consequência automática:** não encerra a prova, não desconta, não
altera a correção, não bloqueia o aluno e não muda a ordem do lote.
Fundamento: D70.
Como se confere: teste em que o resultado da correção é idêntico com zero e com muitas saídas.

**N11. A contagem de saídas fica presa àquela avaliação.** Nunca é somada por aluno, não vira
histórico, indicador nem atributo dele.
Fundamento: D70; `docs/lgpd.md`, linha "Saída da aba durante avaliação".
Como se confere: não existe consulta que agregue saídas por aluno entre avaliações, nem campo no
aluno; o registro da validação guarda só que o destaque foi apresentado e aberto.

**N12. Só o professor da turma vê a contagem.** Coordenação, rede, família e colegas não veem.
Fundamento: D70; `docs/interface.md` ("não aparece para a coordenação").
Como se confere: teste de autorização por objeto na rota do lote; nenhuma tela da coordenação
mostra o número.

**N13. Não conta saída sem o aluno ter sido avisado antes de começar.**
Fundamento: D70.
Como se confere: leitura da tela de início da prova; teste de ponta a ponta em que o aviso
aparece antes da primeira questão.

**N14. Não mede tempo ocioso do aluno.**
Fundamento: regra 70, item 7; D69.
Como se confere: não há campo nem evento de inatividade no contrato da prova.

**N15. Não mostra ao aluno ranking, média da turma nem resultado de colega.**
Fundamento: regra 50, item 9.
Como se confere: o que a API devolve ao aluno só tem o que é dele.

**N16. Não transforma o registro da validação em medida do professor.** Não existe ranking de
quem aprova mais rápido, lista de quem abriu menos destaques, nem coluna, filtro ou ordenação por
professor na governança.
Fundamento: D45; D64; regra 70, itens 8 e 9.
Como se confere: leitura da tela de governança; a consulta "o que a IA gerou e quem aprovou" não
ordena nem agrupa por professor.

**N17. Não envia ao provedor de modelo nome, matrícula nem resposta ligada a um aluno.**
Fundamento: regra 20, item 12; `docs/lgpd.md`, seção 6, itens 2 e 3.
Como se confere: teste que captura, no adaptador falso, o que foi montado para o texto do
relatório.

**N18. Não entrega resultado individual à camada de rede.** A rede só lê agregado.
Fundamento: regra 10, item 8.
Como se confere: teste de isolamento da camada de rede.

### 1.6 O dado que entra, e o que sai para terceiro

**Entra:** as respostas dos alunos; o gabarito e a habilidade de cada questão, que vêm do
artefato; o histórico de resultados do aluno, para o destaque "muito fora do histórico"; e, na
fase definitiva, a contagem de saídas da aba.

**Fica guardado:** a correção de cada resposta, o lote, quais destaques foram abertos e o
registro da validação.

**Linhas do mapa de `docs/lgpd.md`:**

- "Resposta de avaliação" — aluno; correção e devolutiva; ano letivo + 1 ano.
- "Registro da validação humana de correção" — titular: o **professor**; provar a validação
  exigida pelo CNE (D56); vigência + 5 anos, como a auditoria.
- "Saída da aba durante avaliação" — aluno; integridade da avaliação; base legal marcada lá como
  **a confirmar com advogado**; segue a retenção da resposta.
- "Diagnóstico por habilidade", que é a fonte do histórico usado no destaque.

**O que o mapa ainda não tem:** não há linha própria para a **correção** (o acerto ou erro de
cada resposta) nem para o **lote** e os destaques. A linha "Resposta de avaliação" fala em
correção na finalidade, mas não descreve o dado. Se a implementação guardar a correção em tabela
própria, a linha entra no mapa na mesma tarefa (regra 20, item 1).

**Sai para terceiro (provedor de modelo):** da conta, nada, porque ela não chama modelo. Do
relatório por questão, `docs/mvp-rapido.md` não diz o que é enviado. O requisito desta AIA é que
vá só o **agregado por questão** (quantos marcaram cada alternativa), sem nome, sem identificador
e sem resposta ligada a um aluno. Com isso não há dado pessoal no envio, e a D62, que trata de
conversa e de texto escrito por aluno, não é acionada. A confirmar pelo Joaquim (item 5 de 1.8).

### 1.7 Suspensão da função numa escola

**O que já está decidido (D60, revista em 23/09/2026):** a suspensão é por função e por escola.
A coordenação suspende `correcao_de_objetiva` sem desligar a conversa do professor. A suspensão
vale no servidor: função suspensa recusa executar, e entrega de função suspensa não nasce. Fica
um registro próprio, com quem suspendeu, quando e o motivo, e com auditoria.

**Duas consequências do desenho atual, aceitas pelo Joaquim para o MVP em 05/10/2026 (1.9; a rever antes do primeiro aluno real):**

- a chave `correcao_de_objetiva` cobre também o diagnóstico por habilidade. Suspender a correção
  suspende o diagnóstico, e não há como suspender só um dos dois;
- a saída da aba não é função de agente e não tem chave. Suspender a correção **não** a desliga,
  e a D70 não diz se a escola pode desligá-la por configuração.

**O que acontece com o que a função já produziu — decidido pelo Joaquim em 05/10/2026:**

- com a função suspensa, encerrar a atividade não dispara a correção; as respostas continuam
  guardadas e o professor corrige do jeito dele;
- lote pendente continua pendente e não pode ser aprovado enquanto durar a suspensão; pode ser
  rejeitado;
- lote já aprovado continua valendo, e o aluno continua vendo o resultado, porque uma pessoa o
  validou;
- o registro da validação nunca é apagado pela suspensão.

### 1.8 O que está em aberto

1. **O que é, exatamente, "validação qualificada e documentada".** Depende do texto oficial do
   ato do CNE, depois da homologação, lido com advogado (`docs/regulacao.md`, seção 11, item 1).
   O desenho da D56 é a nossa leitura da cobertura de imprensa.
2. **Base legal e proporcionalidade da contagem de saídas da aba.** Depende de advogado
   (`TODO.md`, pergunta (e) do parecer do ECA Digital; `docs/regulacao.md`, seção 11, item 11).
3. **Falso positivo da saída da aba em quem usa tecnologia assistiva.** Leitor de tela, teclado
   virtual e notificação do sistema também tiram o foco da aba, e o erro cai justamente no aluno
   com adaptação registrada (D70). A mitigação fica para as etapas 3 e 4: o texto que o professor
   lê ao lado do número, e se a contagem aparece para aluno com adaptação registrada. Depende do
   Joaquim e do Gabriel, com o `conformidade-reviewer`. *A decisão de 1.9 sobre a chave não resolve
   este item:* continua aberto, e sem poder desligar a contagem por escola o risco permanece.
4. **O limiar de "muito fora do histórico" e o critério de "padrão de erro suspeito".** Fazem
   parte da decisão em aberto dos indicadores (`CLAUDE.md`, "Decisões em aberto"), do Joaquim e
   do Gabriel, antes do PRD do F6.
5. **O que vai ao modelo para escrever o relatório.** Ver 1.6. Depende do Joaquim.
6. **Um destaque que a D56 cita e que a D55 proíbe.** O texto da D56 lista "discursiva com baixa
   confiança" entre os casos destacados. Pela D55 a IA não produz nada sobre texto discursivo,
   nem grau de confiança. Esta AIA segue a D55 e a lista de `docs/agentes.md` (prova em branco,
   resultado longe do histórico, item com padrão de erro suspeito). O texto da D56 precisa de
   correção. Depende do Joaquim.
7. **Decidido para o MVP (1.9; a rever antes do primeiro aluno real).** **Se o diagnóstico ganha chave própria em `FUNCOES`,** e se a saída da aba pode ser desligada
   por escola (1.7). Depende do Joaquim.
   *Decisão:* o diagnóstico fica sem chave própria, suspenso junto de `correcao_de_objetiva`; e a
   saída da aba (D70) fica sem chave em `FUNCOES` e sem desligar por escola.

Os itens restantes não bloqueiam o MVP de apresentação (dado sintético, D71); bloqueiam o primeiro aluno real (etapas 2 a 6).

### 1.9 Decisões do Joaquim para o MVP (05/10/2026)

1. **Suspensão (1.7).** Aceita a proposta de 1.7 tal como escrita: com a função suspensa, encerrar a atividade não dispara a correção e o professor corrige do jeito dele; lote pendente fica pendente e não pode ser aprovado durante a suspensão, só rejeitado; lote já aprovado continua valendo; o registro da validação nunca é apagado. Foi o que o MVP implementou, e a revisão da fase 4 aprovou.
2. **Chaves (1.7 e 1.8, item 7), para o MVP:** (a) o diagnóstico por habilidade não tem chave própria e é suspenso junto de `correcao_de_objetiva`; (b) a saída da aba (D70) não tem chave em `FUNCOES` e a escola não a desliga por configuração. Os dois pontos ficam **a rever antes do primeiro aluno real**.

---

## Etapa 2 — Análise dos dados e do modelo

Falta: a origem e a qualidade do gabarito e da habilidade gerados pelo modelo, a taxa de acerto
mínima do gabarito num conjunto fixo de amostras (regra 40), e a declaração de que não treinamos
modelo. Antes do primeiro aluno real.

## Etapa 3 — Identificação e avaliação de riscos

Falta: a lista com probabilidade e impacto — gabarito errado, validação por clique reflexo,
destaque lido como acusação, falso positivo da saída da aba, registro da validação usado contra o
professor. Antes do primeiro aluno real.

## Etapa 4 — Estratégias de mitigação

Falta: a mitigação por risco, a explicação em linguagem comum para o aluno e para o professor, e
o caminho de contestação do resultado e da contagem de saídas. Antes do primeiro aluno real.

## Etapa 5 — Validação e auditoria da equidade

Falta: o método. Não guardamos raça, renda nem território, então a desagregação possível é por
turma, série e escola, com escuta de professor (`docs/conformidade-mec.md`, seção 8). Aqui entra
medir se o destaque e a saída da aba caem mais sobre aluno com adaptação registrada. Antes do
primeiro aluno real.

## Etapa 6 — Monitoramento contínuo e governança

Falta: os indicadores periódicos (quantos lotes rejeitados, quantos gabaritos corrigidos pelo
professor), a revisão a cada troca de modelo ou de prompt, e o procedimento de suspensão fechado
(1.7 ainda tem proposta a confirmar). Antes do primeiro aluno real.

---

## O que o MVP de apresentação implementa desta funcionalidade

Conforme `docs/mvp-rapido.md`, com dado 100% sintético.

**Existe agora:**

- correção **determinística**, por comparação com o gabarito, quando o professor encerra a
  atividade; a IA entra no texto do relatório, não na conta;
- o lote com média, distribuição, acerto por habilidade, relatório por questão e os destaques
  (em branco, muito fora do histórico, padrão de erro);
- a abertura de cada destaque fica registrada, e aprovar o lote só libera com todos abertos;
- o **registro da validação**: o que foi apresentado, o que foi aberto, quem confirmou e quando;
- **sem `Nota`** (D46): o que se aprova é diagnóstico formativo;
- o aluno responde uma questão por vez, com a resposta salva a cada item, recebe a prova sem
  gabarito e só vê o resultado depois da aprovação;
- a coordenação suspende e retoma a função na governança, e a suspensão vale no servidor.

**Fica para a fase definitiva (F6, F11 e F17):**

- **a contagem de saídas da aba durante a prova (D70): não está no MVP.** Não há rota para ela
  no contrato, e a tela de prova online está fora do roteiro;
- item discursivo, organização do lote de discursiva e correção cega (D55): o MVP não tem
  discursiva;
- o modo papel com foto e os demais modos de avaliação;
- a nota oficial, o boletim e a proposta de nota das objetivas;
- a prova online resiliente, com relógio no servidor e retomada após queda (D27);
- a fila de jobs: no MVP a execução roda no processo da API, como dívida declarada (D77).
