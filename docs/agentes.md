# Agentes

## O que é um agente aqui

Um especialista de IA com **thread própria**, nome, avatar e escopo, que atende **uma pessoa da
escola**. Ele trabalha por **funções**, e cada função tem o seu **nível de autonomia declarado**.
Prepara o trabalho quando o evento acontece e avisa. Não é um botão, não é um prompt salvo.

A diferença que o benchmark mostrou: todos os concorrentes vendem "assistente sob
comando". Os nossos agentes preparam e avisam, e tudo que vale passa por aprovação ou
supervisão da escola. O produto se apresenta como **assistente com agentes supervisionados**
(D44), não como "IA que trabalha sozinha": a coordenação compra conformidade, e autonomia
vendida como promessa contradiz isso.

## Níveis de autonomia

| Nível | O agente… | Exemplos |
|---|---|---|
| **1 — Executa e registra** | Faz sem pedir, deixa rastro | Indexar material novo, gerar rascunho de prova, resumir dúvidas do dia |
| **2 — Executa e avisa** | Faz e notifica quem precisa saber | Corrigir objetivas (a correção espera o professor), sinalizar aluno travado, lembrar entregas |
| **3 — Propõe e espera aprovação** | Prepara tudo e aguarda um humano | Publicar nota, mensagem à família, adaptar prova de um aluno, plano de recuperação |
| **4 — Nunca faz** | Fora do escopo, por lei ou por escolha | Decidir aprovação ou reprovação, vigilância emocional, assunto fora da escola |

**O nível é propriedade da função, declarada em código e visível ao coordenador** (D9, revista
em 23/09/2026). Não é configuração escondida, e não é um rótulo por agente: o mesmo Assistente
de ensino corrige objetiva e avisa, mas espera o professor para entregar uma prova adaptada. A
escola precisa poder responder "o que essa IA faz sozinha?" em uma tela, função por função.

## Regra estrutural

> O agente faz, o humano aprova antes de valer — sempre que houver **nota**, **comunicação
> com a família** ou **decisão sobre o aluno**.

Isso vem do CNE (`docs/regulacao.md`), não da nossa preferência. Tecnicamente: toda
`Entrega` de agente nasce `pendente`, e nada oficial acontece antes de `aprovadaPor`.

**A única exceção é a resposta do Tutor** (D47, regra 70 item 3): ela acontece em tempo real
e é supervisionada, não aprovada uma a uma. Nenhum outro agente, nem outra função, herda essa
exceção.

**Nenhum agente produz dado para decidir sobre o professor** (D45, regra 70 item 8). O que
um agente mostra sobre as turmas de um professor chega primeiro a ele, e à coordenação só
em agregado.

## Nome

**O nome do agente é a função** (D17). Sem nome próprio: a coordenação precisa explicar em
reunião de pais o que cada IA faz, e "o Tutor" se explica sozinho. A função segue a mesma regra:
"correção de objetiva" diz o que faz. Os nomes do desenho da call (Pipo, Waz, Maky) não são
usados. "Monitor" também não: servia a duas coisas diferentes.

## Os agentes (D32, revista em 23/09/2026)

**Um agente para cada pessoa da escola**: o professor tem o **Assistente de ensino**, o aluno tem
o **Tutor**, a coordenação tem o **Analista de desempenho escolar**, e a família, na fase
posterior, o **Mensageiro**. O professor vê também o Tutor, na aba Hoje da turma (o pé do sino, "O que o Tutor viu", leva até ela), porque é ele quem
supervisiona o agente dos seus alunos (D8, D47).

O que eram agentes do professor — Corretor, Planejador e Adaptador — viraram **funções do
Assistente de ensino**. Cada um tinha uma ferramenta gêmea que chamava o mesmo caso de uso; o que
mudava era só quem disparava. E o risco que o CNE classifica é o da funcionalidade, não o da
persona: por isso a autonomia (D9) e a suspensão (D60) são declaradas por função.

| Agente | Para quem | O que é |
|---|---|---|
| **Assistente de ensino** | professor | A identidade do chat da Home e a cara das ferramentas (D18). Trabalha pelas funções da tabela abaixo, sempre a partir do material da escola e com a página citada |
| **Tutor** | aluno, e o professor da turma | O tutor do aluno, socrático e supervisionado. Para o professor, avisa o que viu no uso, na aba Hoje da turma, com o painel "O que o Tutor viu" por aluno |
| **Analista de desempenho escolar** | coordenação | O resumo semanal e o alerta da coordenação, sempre em agregado |
| **Mensageiro da família** | professor, coordenação | A comunicação com a família. **Fase posterior** |

### As funções, e o que cada uma faz sozinha

| Agente · função | Dispara | O que faz sozinha | Alto risco (D60) |
|---|---|---|---|
| **Assistente · conversa e ferramentas** | o professor conversa ou abre uma ferramenta | **Faz e registra.** Atividade, material, apresentação, plano, prova: tudo que sai é rascunho do professor até ele usar. Com a busca na web ligada pelo professor naquela conversa, traz fonte de fora rotulada como "da web" (D68) | não |
| **Assistente · seu dia e sua semana** | todo dia letivo, de manhã; e "preparar a semana", ligado pelo professor para uma turma | **Organiza o que já existe, sem gerar conteúdo.** Abre o dia e a semana com aulas, avaliações, pendências e entregas em atraso que já estão na grade e nas avaliações: é barato, e é o que garante que o feed nunca apareça vazio. **Plano de aula e sequência didática, só sob pedido**; plano que ninguém pediu não é gerado. Depende da grade (F2) e do calendário (F8) | não |
| **Assistente · correção de objetiva** | fim da atividade ou da avaliação | **Faz e avisa; a nota espera você.** Corrige objetivas, monta o diagnóstico por habilidade e o relatório por questão, e a entrega nasce pendente. **Em discursiva e redação não faz nada sobre o texto do aluno**: nem correção, nem nota, nem conceito, nem devolutiva rascunho, nem pré-correção para o professor ver (D55). Nelas organiza o lote, confere a entrega e prepara a correção cega. Quando a nota oficial existir, propõe a nota das objetivas, que só passa a existir com a validação registrada do professor (D56) | **sim**: correção de objetiva e diagnóstico por habilidade |
| **Assistente · adaptação** | avaliação ou atividade criada para turma com aluno que tem adaptação registrada; material didático, quando o professor pede | **Prepara e espera você aprovar.** Propõe a versão adaptada da prova ou da atividade — linguagem direta para o aluno surdo, resposta escrita no lugar da oral, fonte ampliada, tempo extra, enunciado mais fácil. Recebe o **tipo de adaptação**, nunca a condição do aluno nem texto livre sobre ele (D35, D67). O aluno só recebe depois da aprovação | **sim** |
| **Assistente · classificação do material** | à noite, fora do horário letivo, para o material que ficou pronto (a rotina chega nas tarefas 4.0 e 5.0 da classificacao-bncc) | **Faz e registra; a coordenação corrige, e a correção vence.** Classifica cada capítulo ou bloco de páginas do material pela BNCC, só entre as habilidades candidatas do recorte da disciplina, e "nenhuma" vale. Nada chega ao aluno por ela: a habilidade de cada questão só vale quando o professor confere e aplica a atividade. A coordenação a suspende por escola. Detalhe na AIA, `docs/aia/diagnostico-por-habilidade.md`, seção 1.10 | **sim** |
| **Tutor · com o aluno** | o aluno pergunta | **Responde em tempo real, supervisionado, sem aprovação prévia por resposta** (D47). Detalhe abaixo | **sim** |
| **Tutor · sinais para o professor** | por evento, e em resumo diário | **Avisa o professor da turma**, na aba Hoje da turma, na voz dele, em soma e sem nome, e por aluno no painel "O que o Tutor viu", dentro da aba: quem travou e onde, quem errou muito, quem pediu resposta pronta, qual a principal dificuldade, qual dúvida se repetiu. Aluno nomeado só para o professor da turma (D34) | **sim**: sinais e alertas sobre aluno |
| **Analista · resumo e alerta** | toda segunda de manhã, e por evento que passa do limiar | **Faz e avisa, em agregado.** Detalhe abaixo | **sim**: alertas sobre aluno (na AIA de sinais e alertas) |
| **Mensageiro · comunicação à família** | evento | **Prepara e envia só depois da aprovação.** Fase posterior | — |

**O Tutor, com o aluno**, conduz por perguntas, nunca entrega resposta pronta e cita a página.
Lembra de **tudo que o aluno fez no sistema** — atividades, trabalhos, avaliações, práticas e
sessões, com resultado e evolução —, pelo registro do trabalho e nunca por texto sobre a pessoa,
usa o contexto que o professor informou e ajusta a forma à adaptação registrada (D66). Com a
busca ligada pelo professor, pesquisa além do material só em fontes aprovadas, continuando
socrático (D68). Tem identidade de agente (D17, D58): o que é vedado é **se passar por pessoa** —
afirmar ser humano quando o aluno pergunta, ou simular vínculo afetivo e dependência (Decreto
12.880, art. 11, I e II). Perguntado sobre si, explica o que é, como funciona e que pode errar
(D65). **Alto risco** no CNE: AIA antes de existir, explicação em linguagem comum na tela e
caminho de contestação (D60). O sinal para o professor deriva de fato declarado — entrega,
desempenho, o que o aluno escreveu —, nunca de inferência de emoção, atenção ou comportamento
(D57).

**O Analista de desempenho escolar** faz o resumo semanal e o alerta na hora, **em agregado** por
série e disciplina: média fora da curva, habilidade em queda, consumo de IA alto, alunos em
risco. O desempenho de cada professor é o das turmas dele, em espelho: ele vê primeiro, e o
recorte com um professor só conta como nominal (D45 revista). O detalhe por turma, professor ou
aluno só abre com auditoria (D45, D34). Alerta é hipótese com contexto, nunca veredito sobre o
professor. Só avisa: nunca contata professor nem família.

**O que isso pede do modelo de dados** (P01 de `docs/pendencias-dos-mockups.md`): a função vira
entidade própria, `FuncaoAgente → agente*, chave*, nome*, autonomia*, altoRisco*, ativo`;
`Entrega` e `ExecucaoAgente` ganham `funcao*`, que também serve de filtro na thread do
Assistente; e a suspensão vira registro próprio (`escola*, funcao*, suspensaPor*, em*, motivo`),
com auditoria. **Entregue na migration 0022 e em `docs/mvp-contratos.md`**, com a função como
catálogo em código (`FUNCOES`, `packages/shared/src/time/funcoes.ts`) em vez de tabela, e a
suspensão na tabela `suspensao_de_funcao` (`docs/modelo-de-dados.md`).

### Detalhes que já estão decididos

**Aprovação de nota de objetiva é em lote, e a validação fica registrada** (D33, D56), quando
a nota oficial entrar (D46). Um confirmar para a turma, depois de ver média, distribuição e os
casos destacados: nota muito longe do histórico do aluno, prova em branco, item com padrão de
erro suspeito. Os destacados precisam ser abertos antes de o botão de aprovar o lote liberar, e
o sistema guarda **o que foi apresentado, o que foi aberto, quem confirmou e quando** — porque
o CNE exige validação humana "efetiva, prévia, qualificada e documentada" e diz, com essas
palavras, que o professor não pode apenas clicar em aprovar. Aluno por aluno viraria clique
reflexo, que é justamente o que a regra 50 quer evitar; lote sem registro não prova nada.

**Aluno em risco chega nomeado só ao professor da turma** (D34). A coordenação vê o
agregado ("1ºC tem 5 alunos com três entregas faltando") e abre o detalhe só com registro
em auditoria. É sinal para um humano olhar, nunca decisão sobre o aluno (regra 70).

**A adaptação é registrada pela coordenação, e só a adaptação** (D35). "Fonte ampliada,
tempo +50%", nunca diagnóstico, laudo ou CID. O professor da turma vê; todo acesso fica em
auditoria. É dado sensível de menor (`docs/lgpd.md`).

**Assunto pessoal delicado no tutor** (D36). O Tutor não aconselha. Responde com mensagem
fixa, revisada pela escola, que acolhe e orienta a procurar o professor ou a orientação
educacional e, se houver menção a risco à vida, o CVV (188). Gera o sinal "precisa de
atenção humana" para o professor da turma, **sem mostrar o conteúdo por padrão**. O gatilho
é o que o aluno escreveu explicitamente, nunca inferência de humor ou estado emocional. O
texto da mensagem e a lista de gatilhos passam pelo `conformidade-reviewer` e pelo
`pedagogia-reviewer` antes de existir. A escola tem obrigação de notificar o Conselho
Tutelar em caso de automutilação ou tentativa de suicídio (Lei 13.819/2019, ampliada pela
Lei 15.231/2025): o sinal precisa chegar também a quem notifica (orientação ou direção), com
acesso ao conteúdo auditado. A detalhar no PRD do F9 (`docs/regulacao.md` seção 7).

**A memória do Tutor cobre a trajetória inteira, e é sobre o trabalho, não sobre a pessoa**
(D66). Não é um retrato pontual: o Tutor alcança todas as atividades, trabalhos, avaliações,
práticas e sessões do aluno no sistema, com o resultado por habilidade, a devolutiva que o
professor escreveu e o resumo de cada sessão em formato fixo (assunto, habilidade, exercício,
onde travou, como terminou). A cada conversa ele busca o que importa para aquela dúvida, em vez
de carregar tudo. Soma a isso o que o professor informou de forma estruturada: por turma, o que está
sendo dado, a lista ativa e o foco da semana; por aluno, as habilidades a reforçar. Não existe
texto sobre o jeito, o humor, a atenção ou o comportamento do aluno, escrito por modelo ou por
professor. Em discursiva e redação, a memória guarda a devolutiva do professor; o Tutor não
avalia o texto (D55). A adaptação registrada muda a forma da conversa, nunca o que é cobrado.

**Busca na web só por ativação do professor** (D68). No Assistente de ensino, por conversa,
para o próprio professor. No Tutor, para a turma, com duas chaves (a coordenação libera na
escola, o professor ativa por turma e com prazo), só em **fontes aprovadas**, só no modo sala,
sempre desligada em avaliação, com teto diário, e com a consulta escrita pelo modelo sem texto
nem identificador do aluno. O Tutor continua socrático: traz a fonte e pergunta, não escreve o
trabalho. O professor vê o que foi pesquisado e as fontes abertas.

**Sair da aba da prova é fato, não veredito** (D70). Só durante avaliação, só para o professor,
com o aluno avisado antes, sem consequência automática e sem histórico por aluno. Fora de
avaliação nenhum agente acompanha a navegação do aluno.

### O que nenhum agente faz (nível 4)

- Decidir aprovação, reprovação ou encaminhamento de aluno, nem como sugestão aplicada sozinha
- Publicar nota ou falar com a família sem aprovação humana registrada
- Inferir emoção, humor, atenção ou comportamento, ou ranquear alunos por isso
- Medir tempo ocioso do aluno, ou acompanhar a navegação dele fora de uma avaliação (D69, D70)
- Guardar texto, escrito por modelo ou por pessoa, sobre o jeito, o humor ou o comportamento de
  um aluno. A memória é sobre o trabalho dele, não sobre ele (D66)
- Buscar na web aberta para o aluno, ou fora das fontes aprovadas pela escola (D68)
- Criar perfil comportamental ou psicológico de aluno, ainda que só como rótulo interno, e
  pontuar pessoa por comportamento (D57; ECA Digital art. 26; Decreto 12.880 art. 10)
- Ranquear professores, medir adoção nominal por professor ou recomendar qualquer decisão
  sobre um professor (D45, D64)
- **Corrigir, avaliar, dar nota ou conceito, pré-corrigir ou sugerir nota em redação e
  discursiva** (D55)
- Falar de assunto fora do conteúdo escolar da turma
- Usar dado educacional para publicidade ou qualquer fim comercial (D57)

### Antes de uma função de alto risco existir

Alto risco é o que a tabela das funções marca: o Tutor com o aluno, os sinais do Tutor e os
alertas do Analista, a correção de objetiva com o diagnóstico por habilidade, e a adaptação. As AIAs ficam em
`docs/aia/`, uma por funcionalidade. Nenhuma dessas funções entra em PRD sem a **Avaliação de
Impacto Algorítmico** das seis etapas de `docs/conformidade-mec.md` seção 7 (D60), que inclui o
**escopo negativo** (o que aquela função não deve fazer) e o **procedimento de suspensão**: como
desligar **a função** numa escola, quem decide e o que acontece com o que ela já produziu. A
suspensão é por função (D60, revista em 23/09/2026): a escola desliga a correção automática sem
desligar o chat do professor. A AIA é revista quando o modelo ou o prompt principal mudam.

## Função que dispara sozinha × ferramenta que espera pedido

A **ferramenta** espera o professor pedir e produz um artefato na hora, pelo formulário ou pela
conversa com o Assistente de ensino (D18). É ferramenta o que entrega um output próprio; o que o
chat já responde é só pedido (D74). A **função que dispara sozinha** trabalha sem pedido, por
evento ou horário, e avisa na thread do agente. As duas podem usar o mesmo caso de uso por
baixo: a correção de objetiva que dispara no fim da atividade e a ferramenta de correção chamam
a mesma correção. O que muda é quem dispara e onde o resultado aparece.

## Requisitos de runtime

- Roda em fila, nunca dentro de request
- Idempotente e capaz de sobreviver a reinício do worker: a fila entrega **pelo menos uma
  vez**, então o processador recebe chave de idempotência e tolera reexecução sem duplicar
  aviso nem chamada de IA paga (D49)
- Limite de passos e de custo por execução — agente que não sabe parar queima a margem
- Registro completo: gatilho, entrada, saída, modelo, tokens, custo, duração, estado
- Estados: `executado`, `aguardando aprovação`, `aprovado`, `rejeitado`
- Notificação roteada para quem precisa saber, no canal disponível na fase atual, **dentro do
  horário útil da escola**: notificação fora de hora e recompensa por tempo de uso contam como
  incentivo a uso excessivo, vedado pelo art. 9º do Decreto 12.880/2026 (D59)
