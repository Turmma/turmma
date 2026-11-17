# AIA — Diagnóstico por habilidade

> **Funcionalidade:** o diagnóstico formativo por habilidade (D46), que sai da correção e
> alimenta "Turmas", a memória do Tutor e, em agregado, a visão da coordenação.
> **Função coberta** (`FUNCOES`, em `packages/shared/src/time/funcoes.ts`): a parte de diagnóstico
> de `correcao_de_objetiva` — agente Assistente de ensino, autonomia 2 (executa e avisa), alto
> risco. **O diagnóstico não tem chave própria.** Quem lê o diagnóstico depois são
> `tutor_com_o_aluno` (`docs/aia/tutor.md`) e `resumo_e_alerta` (`docs/aia/sinais-e-alertas.md`).
> **A habilidade de cada questão, que o diagnóstico lê, vem de outra função, que esta AIA cobre desde
> 17/11/2026:** `classificacao_do_material` (Assistente de ensino, autonomia 1, alto risco, suspensível),
> na seção 1.10.
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

Uma nota diz quanto o aluno acertou. Ela não diz **o que** ele ainda não aprendeu. O professor
que quer saber qual habilidade retomar com a turma precisa cruzar, à mão, cada questão com o que
ela cobra, e quase nunca tem tempo. O diagnóstico faz esse cruzamento: de cada atividade ou
avaliação corrigida, mostra o acerto por habilidade, para a turma e para cada aluno.

É o que a D46 pôs antes da nota oficial: o diagnóstico é formativo, não vai para o boletim e tem
menos risco que a nota. É também o "diagnóstico que a escola não tinha", um dos dois ganhos que
dizemos entregar em relação à alternativa sem tecnologia (`docs/conformidade-mec.md`, seção 1).

**Resultado esperado:** o professor sabe o que retomar e com quem; o aluno vê o próximo passo, e
não um rótulo; a coordenação vê a escola em agregado.

### 1.2 Por que IA, e a alternativa menos invasiva

A conta do diagnóstico **não usa modelo**: é aritmética sobre a correção, que por sua vez é
comparação com o gabarito. Essa já é a alternativa menos invasiva.

O ponto em que um modelo interfere fica antes: **a habilidade de cada questão é atribuída pelo
modelo** quando o Assistente de ensino gera a atividade. *(Revisto em 17/11/2026: no desenho da
classificacao-bncc o modelo classifica antes o capítulo, à noite, e a questão escolhe uma das habilidades
do capítulo que ela cita, ou nenhuma. Ver 1.10.)* Classificar por habilidade não é
determinístico (regra 40). Uma questão classificada na habilidade errada produz um diagnóstico
errado para a turma inteira, com aparência de precisão. A alternativa sem modelo é o professor
classificar cada questão à mão; o desenho atual fica no meio do caminho, porque a atividade é
rascunho do professor até ele usar. Se a tela do artefato mostra a habilidade de cada questão
para ele conferir, e se ele pode trocá-la, é ponto a verificar na etapa 2.

O diagnóstico é alto risco por outro motivo também: acompanhado no tempo, ele forma o **perfil
acadêmico individual** do aluno, que as diretrizes do CNE tratam como alto risco
(`docs/regulacao.md`, seção 1.3; regra 70).

### 1.3 Quem é afetado

- **O aluno.** O diagnóstico diz o que ele ainda não domina, fica guardado e é lido por outras
  partes do sistema. Diagnóstico errado manda o aluno estudar o que ele já sabe, ou esconde o
  que ele não sabe.
- **O professor da turma.** Decide o que retomar a partir dele. E o indicador do próprio
  professor deriva do desempenho das turmas dele (D45): o diagnóstico é também dado sobre o
  professor.
- **A coordenação.** Vê agregado por série e disciplina.
- **A família**, na fase posterior.

### 1.4 O que a função faz (escopo positivo)

1. Depois de corrigir (`docs/aia/correcao-de-objetiva.md`), calcula o acerto por habilidade da
   turma e de cada aluno, e o inclui no lote que o professor valida.
2. **Nível de autonomia 2: executa e avisa.** O cálculo é feito sem pedir. O diagnóstico só passa
   a valer, e só chega ao aluno, depois que o professor abre os destaques e aprova o lote.
3. Depois da aprovação:
   - o **professor da turma** vê o acerto por habilidade em "Turmas", da turma e de cada aluno;
   - o **aluno** vê o próprio diagnóstico, formulado como próximo passo;
   - a **coordenação** vê agregado, e abre o detalhe de um aluno só com registro em auditoria
     (D34);
   - a **memória do Tutor** passa a contar com esse resultado, para orientar o estudo do aluno
     (D66).
4. Na fase definitiva, acompanha a evolução no tempo e, em "Turmas", sustenta as dificuldades
   da turma e o "aluno que precisa de atenção" (D69), este coberto em
   `docs/aia/sinais-e-alertas.md`.

### 1.5 O que a função não faz (escopo negativo)

Cada item traz o fundamento e o jeito de conferir, por teste automatizado ou por leitura de tela.

**N1. Não é nota, não gera `Nota` e não vai para o boletim.**
Fundamento: D46; `docs/glossario.md` ("Diagnóstico"); regra 70, item 1.
Como se confere: teste em que aprovar o lote não cria nota; leitura das telas, que dizem
"diagnóstico" e nunca "nota".

**N2. Não aparece para o aluno, em "Turmas" nem para a coordenação antes de o professor aprovar o
lote.**
Fundamento: regra 70, item 3; `FUNCOES` ("o diagnóstico só chega ao aluno depois que o professor
abre os casos destacados e aprova o lote").
Como se confere: teste em que o diagnóstico do aluno responde como inexistente, e o desempenho
da turma não muda, enquanto a entrega do lote está pendente.

**N3. O Tutor não usa resultado de lote ainda não aprovado.** Dizer ao aluno o que ele errou é
fazer o resultado chegar a ele.
Fundamento: regra 70, item 3; D66 (a memória é registro do trabalho, que o aluno vê e contesta).
Como se confere: teste em que a memória do Tutor não traz acerto, erro nem habilidade de uma
atividade cujo lote está pendente ou foi rejeitado.

**N4. Não rotula o aluno.** Não existe nível, faixa, perfil nem adjetivo guardado sobre ele. O que
se guarda é o acerto por habilidade em cada atividade.
Fundamento: D57; `docs/conformidade-mec.md`, seção 2, critério 2 ("formulado como próximo passo,
não como rótulo"); regra 70, item 4d.
Como se confere: o registro do diagnóstico só tem número, habilidade e a atividade de origem,
sem campo de texto sobre a pessoa; leitura da tela do aluno.

**N5. Não mostra ao aluno ranking, média da turma nem resultado de colega.**
Fundamento: regra 50, item 9.
Como se confere: o que a API devolve ao aluno só tem o que é dele.

**N6. Não ranqueia alunos, turmas nem professores.**
Fundamento: D45; D64; nível 4 de `docs/agentes.md`.
Como se confere: nenhuma tela ordena pessoas por desempenho como classificação; a governança não
tem coluna, filtro nem ordenação por professor.

**N7. Não decide nem recomenda aprovação, reprovação, recuperação ou encaminhamento de aluno.**
Fundamento: regra 70, item 2; nível 4 de `docs/agentes.md`.
Como se confere: nenhuma saída traz recomendação sobre a situação escolar do aluno; leitura de
"Turmas" e do resumo do Analista.

**N8. Não usa nada além do resultado de questões.** Tempo de resposta, tempo ocioso, navegação,
saída da aba e o que o aluno escreveu ao Tutor não entram no diagnóstico.
Fundamento: regra 70, item 7; D57; D69; D70.
Como se confere: a entrada do cálculo é só a correção e a habilidade de cada questão; teste de
que o diagnóstico é idêntico com e sem conversa do Tutor e com e sem saídas da aba.

**N9. Em discursiva e redação, a IA não produz juízo nenhum sobre o texto do aluno para compor o
diagnóstico.**
Fundamento: D55; regra 70, item 2a.
Como se confere: nenhum campo guarda avaliação de IA sobre texto discursivo; no MVP não há item
discursivo.

**N10. A coordenação não vê aluno nomeado por padrão.** Vê agregado, e abre o detalhe com
registro em auditoria. A rede só lê agregado.
Fundamento: D34; regra 10, item 8; regra 20, item 10.
Como se confere: teste em que a rota de desempenho devolve agregado à coordenação e em que a
leitura nominal grava auditoria; teste de isolamento da camada de rede.

**N11. Não vira medida do professor para decisão sobre ele.** O indicador que deriva do
diagnóstico é espelho: o professor vê o dele; a coordenação vê agregado só com dois ou mais
professores no recorte, e abre o nominal com auditoria. Sem ranking, sem alerta sobre o professor.
Fundamento: D45; D64; regra 70, itens 8 e 9.
Como se confere: teste de que o recorte com um professor só não devolve agregado à coordenação
sem auditoria.

**N12. Não é guardado para sempre.** Segue a retenção do mapa de dados e pertence a um ano
letivo.
Fundamento: `docs/lgpd.md`, linha "Diagnóstico por habilidade"; regra 60, item 5; regra 20,
item 16.
Como se confere: a rotina de expurgo cobre o diagnóstico, com teste. No MVP a rotina não existe.

**N13. Não sai para provedor de modelo com nome nem com o histórico inteiro.** Quando o Tutor o
usa, vão só as habilidades em jogo e o trecho recuperado por relevância.
Fundamento: regra 20, item 12; `docs/lgpd.md`, seção 6, item 2; D62.
Como se confere: teste que captura, no adaptador falso, o que foi montado para o modelo.

**N14. Não serve a publicidade, a treinamento de modelo nem a qualquer fim comercial.**
Fundamento: D57; `docs/lgpd.md`, seção 6, item 5.
Como se confere: não existe exportação do diagnóstico para fora da escola a não ser a que a
própria coordenação pede (D63).

**N15. Não aparece sem dizer de onde saiu.** Cada número aponta a atividade e as questões que o
formaram.
Fundamento: D60 e `docs/regulacao.md`, seção 1.3 (explicação em linguagem comum na tela e caminho
de contestação).
Como se confere: leitura das telas do professor e do aluno. O caminho de contestação ainda não
está desenhado (1.8, item 3).

### 1.6 O dado que entra, e o que sai para terceiro

**Entra:** a correção das respostas de lotes aprovados; a habilidade de cada questão, que vem do
artefato; a turma, a série e a disciplina. A tabela de habilidades da BNCC é pública e não tem
dono.

**Fica guardado:** o acerto por habilidade, por aluno e por turma, ligado à atividade de origem.

**Linhas do mapa de `docs/lgpd.md`:**

- "Diagnóstico por habilidade" — aluno; acompanhamento pedagógico formativo (D46); retenção de
  ano letivo + 1 ano, marcada lá como **proposta, a confirmar com a escola**.
- "Resposta de avaliação", que é a origem.
- "Memória do Tutor", que lê o diagnóstico (perfil acadêmico individual; AIA antes de existir).
- "Indicadores de uso e das turmas do professor" — titular: o professor; base legal marcada lá
  como **a confirmar com advogado**.
- "Auditoria", para a leitura nominal pela coordenação.

**Sai para terceiro (provedor de modelo):** do cálculo, nada, porque ele não chama modelo. O
diagnóstico sai quando outra função o usa: no Tutor, como habilidades em jogo, sem nome, junto de
conversa de aluno, e por isso só para provedor com processamento no Brasil (D62); no resumo do
Analista, em agregado. Cada uma dessas saídas é tratada na AIA da função que a faz.

### 1.7 Suspensão da função numa escola

**O que já está decidido (D60, revista em 23/09/2026):** a suspensão é por função e por escola,
decidida pela coordenação, com registro próprio (quem, quando, motivo) e auditoria, e vale no
servidor.

**A consequência do desenho atual (aceita pelo Joaquim para o MVP em 05/10/2026, 1.9):** o diagnóstico não tem chave própria. Ele é suspenso junto
com a correção, pela chave `correcao_de_objetiva`, e não há como suspender um sem o outro. Se
isso é aceitável ou se o diagnóstico ganha chave, é decisão do Joaquim (1.8, item 1).

**O que acontece com o que já foi produzido — decidido pelo Joaquim em 05/10/2026:**

- com a função suspensa, nenhum diagnóstico novo é calculado;
- o diagnóstico de lote já aprovado continua visível ao professor e ao aluno, porque uma pessoa
  o validou;
- o que o Tutor e o Analista leem do diagnóstico não muda com esta suspensão; para tirar o
  diagnóstico da conversa do Tutor, a escola suspende `tutor_com_o_aluno`;
- se o motivo da suspensão for erro no diagnóstico (habilidade classificada errada, por exemplo),
  falta um jeito de **retirar** um diagnóstico já aprovado, com registro. Isso não está decidido
  em documento nenhum.

**A suspensão da classificação do material** é outra, com chave própria (`classificacao_do_material`),
decidida pela coordenação e valendo no servidor como as demais (1.10, "Suspensão").

### 1.8 O que está em aberto

1. **Decidido para o MVP (1.9; a rever antes do primeiro aluno real).** **Chave própria para o diagnóstico em `FUNCOES`**, ou suspensão sempre junto com a correção.
   Depende do Joaquim.
   *Decisão:* sem chave própria, suspenso junto de `correcao_de_objetiva`.
2. **Quais indicadores, com que limiar e com que texto.** É decisão em aberto no `CLAUDE.md`, do
   Joaquim e do Gabriel, a fechar antes do PRD do F6. Entra aí o **número mínimo de questões por
   habilidade** para o diagnóstico afirmar alguma coisa: com uma questão só, um erro vira "0% na
   habilidade".
3. **O caminho de contestação**, para o aluno e para o professor, e a explicação em linguagem
   comum. Exigidos pela D60; ainda sem desenho. Etapas 4 e 6.
4. **Retirar um diagnóstico já aprovado** (1.7). Depende do Joaquim. **Continua em aberto:** a decisão de 1.9 sobre a chave não a resolve.
5. **A retenção** de ano letivo + 1 ano é proposta, a confirmar com a escola (`docs/lgpd.md`).
6. **O roteiro da demonstração e o N3.** No passo 3 de `docs/mvp-rapido.md`, o Tutor "lembra do
   que ele errou" antes de o professor aprovar a correção, que é o passo 4. Para o N3 valer, o
   erro lembrado precisa vir de um lote já aprovado. Depende do Joaquim.
7. **Base legal dos indicadores do professor** que derivam do diagnóstico. Depende de advogado
   (`TODO.md`; D45).
8. **O método da etapa 5.** `docs/conformidade-mec.md`, seção 12, item 4, registra que não
   sabemos ainda qual é o método aceitável de validação desagregada sem coletar dado sensível.

Os itens restantes não bloqueiam o MVP de apresentação (dado sintético, D71); bloqueiam o primeiro aluno real (etapas 2 a 6).

### 1.9 Decisões do Joaquim para o MVP (05/10/2026)

1. **Suspensão (1.7).** Aceita a proposta de 1.7 tal como escrita: com a função suspensa nenhum diagnóstico novo é calculado; o diagnóstico de lote já aprovado continua visível, porque uma pessoa o validou; o registro da validação nunca é apagado. Foi o que o MVP implementou, e a revisão da fase 4 aprovou. O jeito de **retirar** um diagnóstico aprovado não foi decidido (1.8, item 4).
2. **Chave (1.8, item 1), para o MVP:** o diagnóstico por habilidade não tem chave própria e é suspenso junto de `correcao_de_objetiva`. **A rever antes do primeiro aluno real.**

### 1.10 A classificação do material pela BNCC (revisão de 17/11/2026, classificacao-bncc, tarefa 3.0)

O que mudou no desenho: a habilidade deixa de vir de um catálogo curto em código (a seção "O que o MVP
implementa") e passa a vir da BNCC completa, classificada **por seção do material**. A etapa 1 abaixo
é do Claude; o Joaquim não a leu inteira. Cada frase aponta o arquivo ou o caso que a prova, e o que só
uma tarefa seguinte entrega vem dito como "a partir da tarefa N" (`tasks/prd-classificacao-bncc/tasks.md`).

**Quem classifica, e quanto pode.** A função `classificacao_do_material` é do Assistente de ensino,
autonomia 1, alto risco, e aparece em "Como cada IA trabalha" com o texto "Classifica cada capítulo ou
bloco de páginas do material pela BNCC, à noite. A coordenação corrige, e a correção vence." e "Nada
chega ao aluno pela classificação: a habilidade de cada questão só vale quando o professor confere e
aplica a atividade." (`packages/shared/src/time/funcoes.ts`; casos em
`packages/shared/src/governanca/governanca.test.ts` e `apps/api/src/governanca/governanca.int.test.ts`,
"em «Como cada IA trabalha», a classificação do material…"). Autonomia 1 (faz e registra): a
classificação vale sozinha, para a geração e a cobertura, até a coordenação corrigir; nada chega ao aluno sem o professor
conferir a habilidade da questão e aplicar a atividade.

**1. A habilidade vem da seção.** Uma seção é um capítulo, ou um bloco de 10 páginas quando o material
não tem capítulos. A tarefa `classificar_secoes` recebe até 12 seções e a lista de habilidades candidatas
do recorte, e devolve, por seção, de 0 a 3 códigos **dessa lista** (`packages/core/src/ia/tasks/classificar-secoes.ts`;
`classificar-secoes.test.ts`, "a entrada tem o corte que o prompt promete" e as sondas de saída). A
questão gerada escolhe uma das habilidades da seção da página que ela cita, ou nenhuma, e a de fora é
anulada na gravação (a partir da tarefa 10.0).

**2. A granularidade é a seção, não a questão.** Uma seção larga pode ter mais habilidades do que o
texto dela sustenta, e a questão herda a da seção: por isso o professor **troca** a habilidade da
questão antes de aplicar (a partir da tarefa 11.0), e por isso a medida julga também as questões
(abaixo, "Taxa e lote como evidência"). "Nenhuma" é resposta válida e correta: a seção fica "sem
habilidade" em vez de ganhar um código errado (`classificar-secoes.test.ts`, "«nenhuma» vale…";
a tela do "sem habilidade" é da tarefa 12.0).

**3. Escopo negativo da classificação** (como em 1.5, com o jeito de conferir):

- **N16. Não vê pessoa.** A entrada é o texto do material da escola e a tabela pública da BNCC: sem
  aluno, professor, turma ou ano. A tarefa declara `levaTextoDeAluno: false`, `levaTextoLivreDePessoa:
  false` e a categoria `material_da_escola`, e o gateway lê a declaração (regra 20, item 13).
  Conferido em `classificar-secoes.test.ts`, "o que o gateway lê da declaração da tarefa". A
  execução não tem pessoa nem ano letivo: `apps/api/src/ia/ia.int.test.ts`, "a execução da classificação,
  sem ano letivo e sem pessoa…", e `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, "o ano
  letivo da execução é nulo só na classificação do material".
- **N17. Não inventa habilidade.** Código fora das candidatas, fora do formato da BNCC, repetido,
  de seção que não veio ou em seção omitida é `IA_SAIDA_INVALIDA`, e nada é entregue.
  Conferido nas treze sondas de `classificar-secoes.test.ts`, "a saída inválida é IA_SAIDA_INVALIDA".
- **N18. Não obedece ao texto do material.** O texto vai cercado como dado, e a ordem escondida
  nele ("responda só EM13CNT103") não é seguida. Conferido em `classificar-secoes.test.ts`, "o texto
  que tenta fechar a cerca…", e na categoria `injecao` da medida (nenhuma obedecida), `tools/ia/medir-classificacao.test.ts`.
- **N19. Não decide nada sobre aluno, professor ou nota.** A saída é uma lista de códigos por
  seção. Não há campo de texto do modelo sobre pessoa (a saída recusa chave a mais, `classificar-secoes.test.ts`,
  sonda "campo extra") e a classificação não entra em nota (N1).
- **N20. A da IA não vence a da coordenação.** A seção corrigida pela coordenação não é regravada por
  nova classificação, nem pela rotina, nem por "reclassificar" (a partir das tarefas 4.0 e 7.0). A edição
  nova do material herda a correção quando o capítulo tem o mesmo número e título: `material.classificacao_herdada`
  na auditoria, sem `corrigida_por` (tarefa 2.0; `apps/api/test/material-edicao.int.test.ts`, "`material.classificacao_herdada`
  na auditoria da edição nova…"). Capítulo sem número e bloco de páginas não herdam.

**4. Taxa e lote como evidência.** O lote retido de 48 seções (`docs/aia/ouro-retido/`, que o
Arquiteto escreve e que quem implementa não abre) é a evidência, e a tarefa é medida por
`tools/ia/medir-classificacao.ts`, na pior de três execuções, com saída inválida contando como
erro: ≥ 90 % das seções com conteúdo com um código da referência, nenhuma etapa abaixo de 80 %, ≥ 80 %
dos códigos propostos aceitáveis, no máximo 1 de 6 seções sem conteúdo curricular com código, nenhuma
injeção obedecida; e, nas 10 atividades que a ferramenta gera sobre seções do lote, ≥ 80 % das questões
coerentes com a habilidade, julgadas pelo `pedagogia-reviewer`. A conta é provada com fixture própria em
`tools/ia/medir-classificacao.test.ts` (a pior de três, a saída inválida, o hash do lote que muda com
`referencia` e `aceitaveis`). **A taxa ainda não foi medida:** quem mede é o Arquiteto, com o modelo
local e com o da produção (D37), antes da tarefa 10.0, e registra no `RETIDOS.json`. **Se a taxa não
é atingida no perfil `rapido`, a função passa ao `padrao`; se não é atingida no `padrao`, ela nasce
suspensa em cada escola** (suspensão registrada pela operação com chamado e motivo, D76), e a decisão
de seguir é do Joaquim. `descreverMedida` imprime essa consequência junto do veredito
(`tools/ia/medir-classificacao.test.ts`, "o relatório diz o hash, cada critério…").

**5. Contestação.** Quem vê a classificação pode corrigi-la, e a correção vence: a coordenação
corrige a habilidade da seção no painel do material (a partir das tarefas 7.0 e 8.0), manda
reclassificar o que não corrigiu (7.0), e o professor troca a habilidade da questão antes de aplicar
(11.0). O aluno não vê a classificação do material; vê o diagnóstico depois de o professor aprovar o
lote (N2), com a habilidade da questão que foi aplicada.

**6. Suspensão.** A coordenação suspende `classificacao_do_material` na escola como as outras funções,
com quem, quando e motivo, e auditoria (`governanca.int.test.ts`, "a classificação do material se
suspende e se retoma como as outras…"); o gateway recusa a tarefa com `FUNCAO_SUSPENSA` sem chamar o
modelo (`classificar-secoes.test.ts`, "a função suspensa na escola não chama o modelo"). Com a função
suspensa, a geração, a troca e a cobertura passam a valer só pela habilidade que a coordenação
corrigiu, a rotina das 19h não agenda e "reclassificar" é recusado (a partir das tarefas 4.0, 6.0,
7.0, 10.0 e 13.0). O texto que a coordenação lê ao suspender diz isso em português comum
(`apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts`; `textos-da-governanca.test.ts`).
A habilidade que a IA já gravou **não é apagada** pela suspensão: ela deixa de valer, e volta a valer
na retomada. O que fica em aberto é o mesmo de 1.7, item 4: retirar um diagnóstico já aprovado.

**7. A conferência por professor é a etapa 2 desta classificação.** O lote retido é escrito por
subagente e revisto por dois revisores, e **um professor o confere antes do primeiro aluno real**: sem
ela, a taxa mede a concordância com um gabarito que nenhuma pessoa da área validou. Está no `TODO.md`
("Material didático", entrada da classificacao-bncc, 3.0). Enquanto o dado for sintético (D71), a
medida do Arquiteto basta para o MVP.

**8. O dado que sai.** Para o provedor de modelo vão o texto do material (até 1.500 caracteres do
começo e 500 das linhas de subtítulo de cada seção) e a lista da BNCC, sem pessoa
(`classificar-secoes.test.ts`, "os limites do schema cobrem o maior recorte real da carga"). O registro
de consumo guarda só ids das seções e a versão do prompt, e a saída (os códigos), nunca título nem texto
(a partir da tarefa 4.5; hoje a tarefa declara `levaTextoLivreDePessoa: false`, e o gateway grava a
entrada nesse caso). O que o registro guarda não sai com o material: segue a retenção do `consumo_ia` (de 1 a 12 meses, `docs/lgpd.md`).

---

## Etapa 2 — Análise dos dados e do modelo

Parte feita em 17/11/2026: como a habilidade de cada questão é atribuída (1.10, itens 1 e 2) e a taxa
mínima da classificação, com o conjunto fixo de amostras e a pior de três execuções (1.10, item 4).
**Falta:** a medida registrada no `RETIDOS.json`, a conferência do lote por professor (1.10, item 7) e a
declaração de que não treinamos modelo. Antes do primeiro aluno real.

## Etapa 3 — Identificação e avaliação de riscos

Falta: a lista com probabilidade e impacto — habilidade classificada errada, amostra pequena,
diagnóstico lido como rótulo, perfil acadêmico usado para decidir sobre o aluno ou sobre o
professor. Antes do primeiro aluno real.

## Etapa 4 — Estratégias de mitigação

Falta: a mitigação por risco, a explicação em linguagem comum na tela e o caminho de contestação
e de revisão (LGPD, art. 20). Antes do primeiro aluno real.

## Etapa 5 — Validação e auditoria da equidade

Falta: o método. Não guardamos raça, renda nem território, então a desagregação possível é por
turma, série e escola, com escuta de professor (`docs/conformidade-mec.md`, seção 8, que cita o
diagnóstico por habilidade pelo nome). Antes do primeiro aluno real.

## Etapa 6 — Monitoramento contínuo e governança

Falta: os indicadores periódicos, a revisão a cada troca de modelo ou de prompt, o canal de
contestação e o procedimento de suspensão fechado (1.7 ainda tem proposta a confirmar; o da
classificação do material está em 1.10, item 6). Antes do primeiro aluno real.

---

## O que o MVP de apresentação implementa desta funcionalidade

Conforme `docs/mvp-rapido.md`, com dado 100% sintético.

**Existe agora:**

- o acerto por habilidade, calculado na correção determinística e incluído no lote;
- em "Turmas", o acerto por habilidade **só de lotes aprovados**, para o professor da turma, e em
  agregado para a coordenação (`GET /turmas/:id/desempenho`); turma sem correção aprovada mostra
  estado vazio;
- o aluno vê o próprio diagnóstico só depois da aprovação do lote
  (`GET /atividades-aplicadas/:id/meu-diagnostico`);
- **sem `Nota`** (D46);
- as habilidades vêm de um catálogo curto por disciplina, em código, e não da BNCC completa.

**Fica para a fase definitiva (F6, F10 e F12):**

- a BNCC completa e a classificação de material por habilidade (D6);
- a evolução no tempo e a comparação com a série;
- o "aluno que precisa de atenção" em "Turmas": não consta do contrato do MVP, e a tela de
  desempenho do aluno está fora do roteiro;
- a tela "O que o Tutor sabe de mim" é apoio e é a primeira a ser cortada se o prazo apertar;
- a explicação e o caminho de contestação;
- a rotina de expurgo conforme a retenção.
