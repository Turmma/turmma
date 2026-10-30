# Interface — design, navegação e telas

> O mapa das telas por papel, o comportamento das peças que aparecem em todo lugar (chat,
> ferramenta, a fila "Esperando você", aprovação) **e o design visual**: direção, cor, tipografia,
> movimento, peças e a casca.
>
> As regras que limitam tudo aqui estão em `.claude/rules/50-frontend.md`: computador fraco
> de escola, responsiva até o celular sem depender dele (D51), quatro estados por tela, ação
> oficial que mostra o que vai acontecer.

Legenda: **decidido** vem de decisão registrada (`docs/decisoes.md`). *Proposta* é ponto de
partida para o PRD da funcionalidade, que pode mudar.

**Como este documento se organiza.** A **Parte A** (seções 1 a 7) é o mapa das telas por
papel. A numeração dela não muda, porque tarefas do F1 já citam as seções 1, 2, 3 e 6. A
**Parte B** (seções 8 a 12) é o design. A pele, a navegação e o padrão de página são os da **D80**
(12/10/2026), que revê a D72, a D73 e a D69: o sistema que o Gabriel desenhou em mockup de 04 a
07/10/2026. Desde 30/10/2026, com a X1 a X4 pousadas, o mockup é referência e não alvo (D80 revista): o que vale é
este documento. O produto chega a ele em quatro specs fora da sequência (`ROADMAP.md`): a **X1**
(`pele-e-casca`) troca a pele e a casca, com os itens e as telas de hoje; a **X2**, a **X3** e a
**X4** recompõem as telas da coordenação, do professor e do aluno. Cada seção diz o que já existe
e o que nasce em qual spec ou fase. O que falta decidir está na seção 7.

| Parte | Seção | O que tem |
|---|---|---|
| A | 1 a 5 | Áreas do professor, do aluno, da coordenação, da rede, da família e da operação |
| A | 6 | O que vale em toda tela |
| A | 7 | Em aberto |
| B | 8 | Direção de design: de onde vem, o que tomamos, o que não tomamos, os princípios e a régua |
| B | 9 | Fundamentos visuais: cor, tipografia, forma, ícones, movimento, marca, a onça, tom, tokens |
| B | 10 | Peças: as nossas, o catálogo da X1, o que é proibido, o orçamento |
| B | 11 | A casca, os tipos de página e as telas-chave |
| B | 12 | As telas do MVP de apresentação (A1 a A5) |

---

# Parte A — Navegação e telas

## 1. Área do professor

**Decidido** (D80, 12/10/2026, que revê a D73 e a D69), a partir do mockup de outubro do Gabriel:
quatro lugares, as conversas embaixo e o sino.

```
┌──────────────────────────┬────────────────────────────────────────────────────┐
│ ◉ Turmma               ⇤ │ Turmas                                   (sino: 3) │
│ [ CA  Colégio Aurora ⇅ ] │                                                    │
│                          │                                                    │
│ ▣ INÍCIO                 │                                                    │
│ ▣ TURMAS                 │           conteúdo do lugar selecionado            │
│ ▣ FERRAMENTAS            │                                                    │
│ ▣ CRIADOS                │                                                    │
│ ──────────────────────── │                                                    │
│ ✎ Nova conversa          │                                                    │
│ Hoje                     │                                                    │
│  Prova de estequiometr…  │                                                    │
│ ──────────────────────── │                                                    │
│ (CS) Camila Souza        │                                                    │
│ ⇥ Sair                   │                                                    │
└──────────────────────────┴────────────────────────────────────────────────────┘
```

O desenho desta casca, com medidas e peças, está na seção 11.1. Cada item abaixo diz o que já
existe e onde nasce o que falta: a **X1** troca a pele e a casca com os itens de hoje, e a **X3**
(`telas-do-professor`) traz os lugares.

- **Seletor de escola no topo**, para quem dá aula em mais de uma escola (regra 50, item 13).
  **Trocar de escola troca o token** para a nova escola ativa e descarta o cache da anterior
  inteiro; nenhuma lista junta turmas de duas escolas (regra 10; P30). Existe desde a A1; a X1 só
  troca a moldura
- **Início** é a caixa de pedido do **Assistente de ensino** (D32 revista), com contexto de turma e
  material. Tudo que existe em Ferramentas pode ser pedido por aqui. Existe desde a A2, com o
  rótulo "Nova conversa": a X1 troca o rótulo, no mesmo endereço, e a X3 recompõe a tela, com a
  saudação e os atalhos das ferramentas que existem
- **Turmas** (D69 revista) é a lista das turmas do professor e, dentro dela, a **turma aberta**, com três
  abas: **Hoje, Atividades e Alunos** (D80). A lista existe desde a A1 e a turma aberta, desde a A3; a X3
  (tarefas 9.0 a 13.0) recompôs as duas, e o que está construído é o da seção 1.7. Na turma aberta a
  professora vê o que o Tutor avisou, as atividades aplicadas e os alunos com os acertos de correção
  aprovada, e gera o acesso dos alunos pelo diálogo "Convidar alunos". O desempenho completo por habilidade
  nasce no F6, os sinais do Tutor em modo sala, no F10, e a comparação da série, no F12. Frequência,
  Ranking, Recursos e Mural não entram: continuam sem fase e sem decisão (seção 7). Na A1 a turma já existe
  para o professor ver os alunos e aprovar quem reivindicou o nome (D4, D71 revista)
- **Ferramentas** é o catálogo em quatro categorias (D74, seção 1.2), com os mesmos fluxos em
  formato de formulário para quem não quer conversar. Existe desde a A2; a X3 recompõe o catálogo
  e o formulário
- **Criados** é o que a professora já gerou, por turma, com o estado de cada coisa, e o documento
  aberto em folha (P13). O lugar existe desde a tarefa 5.0 da X3, com a lista e os filtros de tipo,
  turma e estado no endereço. Desde a 6.0 o documento abre como **folha**: o voltar "Voltar para
  Criados", o título, a linha de dados e as ações no alto; três abas no endereço (`?aba=`) —
  Conteúdo, Versões adaptadas (só com versão) e Na turma (só a atividade objetiva) —; e, no
  Conteúdo, a folha de 760 px sobre a `mesa` (sem mesa e sem borda abaixo de 768 px), com o
  interruptor "Gabarito" e a página de origem de cada questão. A assinatura da IA e a situação
  da versão adaptada ficam acima das abas. "Aplicar à turma" e "Encerrar a atividade" moram em
  Na turma, como atos à parte da aprovação da versão adaptada (regra 70, itens 3 e 6)
- **Conversas**, embaixo dos lugares, lista as conversas do professor, agrupadas por data (hoje,
  ontem, 7 dias, mais antigas), cada uma no próprio endereço. A coordenação nunca vê (regra 70,
  item 8; P06). O MVP tem uma conversa só por professora (decisão 19 de `docs/mvp-rapido.md`); a
  lista nasce com o histórico de conversas, no F7
- **O sino "Esperando você"** fica no canto de cima da área de conteúdo e tomou o lugar de "Seu
  time": o que um agente deixa esperando o professor vira item de uma fila só, e o agente continua
  assinando o que fez (seção 1.3). **"Seu time" saiu da lateral na X3** (tarefa 2.0): o pé da
  lista do sino leva às duas telas que ele tinha, **"O que o Assistente fez"** e **"O que o Tutor
  viu"**, nos mesmos endereços de antes. Elas não são lugar da lateral, e o Tutor continua
  à vista do professor, pelo sino, de qualquer tela (regra 70, item 4)
- **O Calendário deixa de ser lugar** (D73 revista). Quando o F8 existir, ele é a visão **Semana**
  de Turmas: aulas, avaliações, entregas e o que o Assistente concluiu, por escola e turma. Deriva
  da estrutura da escola: o professor não monta nem move aula (regra 60, item 8; P12)
- **Meu uso**, o espelho da D45, sai de Turmas e vai para a **conta do professor** (D69 revista): é
  dele primeiro, o que a coordenação vê dele é agregado, e o nominal só abre com auditoria. A tela
  diz isso em português comum. Nasce no F12; a conta já tem "Meus dados", do F3
- **A introdução** (X4, tarefa 10.0) abre na primeira entrada, em tela de foco: quatro passos, todos
  que se pulam, falados pelo Assistente de ensino (com a função e o selo "IA"): ele prepara e a
  professora aprova; só a resposta do Tutor chega ao aluno sem a aprovação dela; a IA não corrige
  redação nem discursiva; e usar ou não a ferramenta não gera número sobre ela. O último passo traz
  "Onde fica cada coisa", lida da navegação do papel. "Rever a introdução" fica no menu da pessoa,
  depois de "Meus dados"; revendo, nada é gravado e todo passo fecha
- **Lugar sem tela não aparece** (D73, que continua valendo). **Projetos** e **Fixados** só entram
  se o `descobrir` do P05 aceitar

### 1.1 Chat e ferramenta são o mesmo motor (D18)

O professor pode escolher a ferramenta no próprio chat: no menu **Ferramenta** da caixa de
pedido, que lê o mesmo catálogo da página (P17), ou digitando `/` (seção 11.5).

Quando ele **não escolheu** e o pedido corresponde a uma ferramenta, o chat pergunta antes
de gerar:

```
Camila:      monta uma prova de estequiometria pro 2ºB, dez questões

Assistente:  Posso fazer isso com a ferramenta Prova, ou só conversar.
             ┌─────────────────────────────┬─────────────────────────────┐
             │ ▦ Usar a ferramenta Prova   │ ◌ Só conversar              │
             │ Salva na biblioteca, liga   │ Respondo aqui, sem salvar   │
             │ ao 2ºB e cita a página.     │ nada.                       │
             └─────────────────────────────┴─────────────────────────────┘
```

As duas opções têm o mesmo peso, e nenhuma é a "certa" (D59). Depois da escolha, o cartão
encolhe para uma linha (P16).

Com o sim, a ferramenta aparece **como cartão dentro da conversa**, já preenchida com o que
foi entendido (turma 2ºB, tema estequiometria, dez questões). O professor ajusta os campos e
gera. O resultado é o mesmo artefato do formulário: salvo, ligado à turma, no calendário,
com a página de origem.

Com "só conversar", o chat responde normalmente, sem artefato salvo, e continua citando o
material.

Consequências técnicas:

- Cada ferramenta tem **um** contrato de entrada e **um** caso de uso no backend. O chat e o
  formulário chamam o mesmo caso de uso. Não existem dois jeitos de gerar prova
- Detectar a intenção usa perfil `rapido` (regra 30). Gerar a prova usa o perfil da ferramenta
- A pergunta existe para não gastar token gerando o que o professor não pediu
- O detector de intenção distingue o pedido que tem ferramenta, que pergunta antes, do pedido que
  o chat responde direto (D74; P24). Os dois lados entram no conjunto de avaliação do F5 e do F7

**Busca na web** (D68): desligada por padrão. O professor liga por conversa, num controle
dentro da caixa de pedido; a resposta que usa fonte de fora vem rotulada "da web", com o
link, separada de "material da escola, página X". Nada que vem da web entra na base da
escola.

### 1.2 Ferramentas (F7)

**É ferramenta o que entrega um output próprio** — coisa com formato, que fica na biblioteca, sai
em arquivo e pode ser aplicada. **O que o chat já responde** (e-mail, recado, ideia de atividade,
resumo de um texto) **não é ferramenta: é pedido ao Assistente** (D74; P24). A regra decide o que
entra no catálogo daqui para frente. As ferramentas do roteiro, nas quatro categorias:

| Categoria | Ferramentas |
|---|---|
| **Planejar** | Plano de aula e sequência didática |
| **Preparar a aula** | **Apresentação** (roteiro e slides a partir do material) · **Material didático** (resumo, texto de apoio, revisão; fora da primeira entrega) · **Adaptação**, em que o professor escolhe o **tipo de adaptação** e nunca descreve o aluno em texto livre (D35, D67) |
| **Avaliar** | Prova (gabarito, versões) · Atividade e lista · Simulado ENEM a partir do banco público (D21) |
| **Corrigir** | **Correção de objetiva** com diagnóstico por habilidade, que é função do Assistente e nasce da entrega, não de pedido · **Redação e discursiva**: a ferramenta gera **rubrica e critérios** antes da aplicação, organiza o lote e apoia a correção cega, e **a IA não corrige, não avalia, não dá nota nem conceito e não escreve devolutiva** sobre o texto do aluno (D55). Quem escreve a devolutiva é o professor, na tela, com a rubrica ao lado |

O mockup propõe mais oito: planejamento do período, projeto, plano de recuperação, mapa mental,
roteiro de experimento, avaliação diagnóstica, proposta de redação e importar prova (P22). **Elas
não estão no roteiro**: cada uma passa por `descobrir` antes do F7, e a tela mostra só as que
existem.

Toda ferramenta produz um **artefato** que fica na biblioteca, ligado à turma e ao
calendário, e toda saída cita material e página. O artefato **exporta em PDF, PowerPoint
(PPTX) e Excel (XLSX)**, conforme o tipo e o que o professor pedir, além da impressão (D67). De
onde vêm as imagens da apresentação está em aberto.

No código, **a ferramenta é dado**: um contrato por ferramenta em `packages/shared`, e o
formulário derivado dele, em vez de uma tela escrita à mão por ferramenta (P23). Entregue no MVP:
a descrição de campos de cada ferramenta sai de `descricaoDaFerramenta`
(`apps/web/src/areas/professor/ferramentas/ferramentas.ts`), e um motor só a desenha
(`apps/web/src/componentes/ui/ia/motor-formulario.ts` e `MotorFormulario.tsx`).

**A página de Ferramentas** (X3, tarefa 7.0) tem uma seção por categoria que tem ferramenta (hoje Planejar, Preparar a aula e
Avaliar; "Corrigir" não aparece, porque nenhuma ferramenta dela existe) e um cartão por ferramenta: uma `Linha` de 108 px no
mínimo, com o ícone ilustrado de 48 px, o nome, o que ela entrega em até três linhas e, se a coordenação suspendeu a função, o
selo "Suspensa pela coordenação" (a frase da suspensão fica no alto da página). A grade tem 3 colunas a partir de 1280 px, 2 a
partir de 768 e 1 abaixo. Dois avisos no alto **não tiram cartão**: a leitura do time que falhou ("Não foi possível conferir…",
com "Tentar de novo") e a professora sem turma confirmada (leva a Turmas). Sem cartão desligado nem "em breve" no lugar do que
não existe.

### 1.3 Esperando você: o que os agentes deixam para o professor (F11)

- **Dois agentes trabalham para o professor: o Assistente de ensino e o Tutor** (D17, D32 revista).
  Corretor, Planejador e Adaptador deixaram de ser agentes: são **funções do Assistente** —
  correção de objetiva, adaptação, e "seu dia e sua semana", que abre o dia com o que já existe e
  só gera plano quando o professor pede
- **"O que o Assistente fez" abre em tela cheia, pelo pé do sino** ("Seu time" deixou de ser grupo
  da lateral na X3, tarefa 2.0) e junta o que as funções fizeram, com filtro: tudo · esperando
  você · correção · adaptação · seu dia (P14). **"O que o Tutor viu" deixou de ser tela**: o
  endereço do pé do sino leva à aba Hoje da turma (seção 1.7), onde o que o Tutor viu mora desde
  a tarefa 10.0
- **Da X3 em diante, o que espera o professor mora no sino** (D80): uma fila só, em que cada item
  diz o que foi feito e **o que está esperando**: "Correção para revisar", com o título da
  atividade e a turma, e na conversa do Assistente: `Corrigi "Atividade de estequiometria" da
  turma 7ºA. O diagnóstico só chega aos alunos depois que você revisar os destaques e aprovar.` Os
  itens são quatro (correção para revisar, versão adaptada para decidir, pedidos de nome da turma
  e turma para confirmar), sem nome de aluno. O número do sino é o tamanho da fila; sem item, sem
  número. **Nada do que estava em "Seu time" some**
- **O que o Tutor viu no uso da turma** (quem travou e onde, quem pediu resposta pronta, a dúvida
  que se repetiu) **não entra no sino hoje**: ele fica na aba Hoje da turma (seção 1.7), em
  agregado e sem nome, e o sino o recebe no F10, dentro do horário útil da escola (D59)
- **A autonomia é mostrada por função**, em português comum ("corrigir objetiva: faz e avisa;
  diagnóstico ao aluno: espera você"), e a coordenação suspende uma função sem desligar o chat
  (D9 e D60 revistas)
- **O professor com turma nunca abre o produto e encontra só um chat vazio** (regra 50, item 6).
  Com grade (F2, F8), "seu dia" abre o dia com as aulas e as avaliações; antes dela, a primeira
  tela mostra o que já existe na turma e um convite para pedir
- **Abrir um item** leva à tela dele ou abre o detalhe no painel ao lado. A ação de dentro chama o
  mesmo caso de uso da aprovação registrada (regra 70, item 3): não é atalho em volta dela.
  Responder a um agente é pedido novo, pela porta, com perfil e orçamento (regra 30, D14; P29)

### 1.4 Aprovar nota

A ação que não pode virar clique reflexo (regra 50, item 8; regra 70). Entra quando a nota
oficial entrar (D46); até lá, o professor aprova devolutiva e diagnóstico com as mesmas
regras de mostrar antes de confirmar. Em discursiva, a nota e a devolutiva são escritas pelo
professor, sem valor nem texto sugerido pela IA (D55).

- Aprovação individual mostra **aluno, avaliação e valor** antes de confirmar
- Aprovação em lote mostra o resumo e **destaca os casos fora da curva** no topo: nota muito
  distante da média do aluno, prova em branco, item com padrão de erro suspeito
- Rejeitar pede justificativa
- O botão de aprovar o lote fica desabilitado enquanto os destacados não forem abertos (D33)
- A tela **grava o registro da validação**: o que foi apresentado, quais destaques foram
  abertos, quem confirmou e quando (D56). É esse registro que prova, para a escola e para a
  fiscalização, que houve validação qualificada — e não um clique

O desenho da tela, com a cor própria da ação oficial, está na seção 11.5.

### 1.5 Modo sala (F10)

- Mostra **sinal, não conversa**: quem travou, quem pediu resposta pronta, dúvida que se
  repetiu (regra 50, item 10)
- Abrir a conversa de um aluno é ação explícita e fica em auditoria. **Essa ação não existe na fatia atual**: a aba
  Hoje da turma mostra sinal, sem abrir conversa (seção 1.7), e o F10 é quem a reabre (regra 70, item 7)
- Sem inferência de estado emocional (regra 70, item 7)
- Com a busca do Tutor ligada, o professor vê o que a turma pesquisou e quais fontes foram
  abertas (D68)

### 1.6 Prova online: saída da aba (D70)

- Antes de começar, o aluno lê que sair da aba da prova é mostrado ao professor
- O professor vê o fato ("saiu da aba 3 vezes"), junto dos outros destaques do lote. Nada
  acontece sozinho com a prova nem com a nota
- Não existe fora de avaliação, não vira histórico do aluno e não aparece para a coordenação

### 1.7 Turmas e a turma aberta (X3, tarefas 9.0 a 13.0)

**A lista** (`/professor/turmas`). O `h1` "Turmas" é visível. Os quatro estados: carregando; erro com "Tentar de
novo"; vazio ("A coordenação ainda não alocou você", que diz que quem aloca é a coordenação); e com dado, em
dois grupos:

- **"Confirme suas turmas"**, no alto: uma faixa para cada vínculo que espera a decisão da professora, só o
  pendente, com o texto "Confirme sua turma · 7ºA · Matemática" e dois botões, "Confirmar" (`oficial`) e
  "Contestar" (`secundario`). O vínculo contestado espera a coordenação e sai da faixa. Só uma decisão corre
  por vez, e dois cliques mandam uma só. A professora só confirma: o vínculo é definido pela escola (regra 60,
  item 8a)
- **"Suas turmas"**: a grade de cartões, em 3 colunas a partir de 1024 px, 2 a partir de 640 e 1 abaixo. Um
  cartão por turma **e disciplina** (quem dá duas disciplinas na mesma turma tem dois, e decide cada um à
  parte), com o ladrilho na cor da disciplina, o nome ("7ºA · Matemática") e o estado do vínculo **em texto**
  ("Confirmado por você", "Contestado por você"…). O cartão do vínculo confirmado traz o selo do que espera e
  "Abrir a turma"; o contestado e o encerrado não abrem a turma, e o pendente ainda está na faixa de cima.
  A série não entra no cartão: o vínculo não a traz
- **O selo** diz "3 esperando você" (correções para revisar, versões adaptadas para decidir e pedidos de nome da
  turma), "Em dia", "Lendo o que espera…" (enquanto o sino ainda lê a turma) ou "Não lida". Vem das mesmas leituras do sino, nenhuma a mais. A turma que o sino não leu (a leitura
  falhou, foi recusada, veio truncada ou passou das 12 primeiras) diz "Não lida", nunca "Em dia"; a lida pela
  metade diz "3 ou mais"
- **Contestar** abre num painel ao lado (folha de baixo a 360 px): o motivo em lista fechada, o complemento em
  texto livre com o aviso de não escrever nome de aluno (regra 20) e, antes de enviar, o efeito escrito: a
  coordenação vê, e a turma não abre até ser corrigida. O que a professora está escrevendo mora na página, e a
  releitura da lista não o apaga
- **Depois de confirmar**, o aviso "Turma 7ºA confirmada", com "Gerar o acesso", leva à aba Alunos com o
  diálogo "Convidar alunos" aberto

**A turma aberta** (`/professor/turmas/:turmaId`). Só abre a turma de vínculo confirmado no ano em curso. A de
outro professor, a de outra escola, a pendente e a que não existe respondem a mesma frase ("Esta turma não
está disponível para você agora…"), sem "Tentar de novo" (regra 10, item 6). Se o vínculo acaba com a tela
aberta, a página inteira sai, com um aviso só, assim que a releitura da turma, dos pedidos (Alunos) ou dos
sinais (Hoje, a cada 15 s) deixa de achá-la, e com ela saem os nomes e o link que estivessem na tela (regra 20,
item 18). Só o "não encontrado" tira a página: a releitura que cai por rede ou servidor, com o dado na tela,
não tira.

O topo é o "Voltar para Turmas", o `h1` "Turma 7ºA" com a série embaixo e as três abas, guardadas no endereço
(`?aba=hoje`, `atividades` ou `alunos`). Sem aba, ou com valor que não é de nenhuma (o `visao-geral` de antes),
abre em Hoje; trocar de aba usa `replace`, sem passo no histórico. **A página não rola, rola o painel da aba**
(RF22): do `md` para cima o topo e as abas ficam parados, e só o painel da aba ativa rola por dentro, na altura
que sobra da janela; abaixo de 768 px a página rola inteira. Cada aba é um pedaço baixado só quando se abre, e
a que sai da tela leva consigo as leituras dela. Só valor de lista fechada vai ao endereço (a aba, o painel
aberto, o pedido do diálogo), nunca nome de aluno, token nem código (regra 20, item 9).

**Hoje** é a aba que a professora projeta em sala, e por isso nada nela diz o nome de um aluno: sinal, não
conversa (regra 50, item 10; D34).

- No alto, quando o Tutor mandou aluno procurar um adulto (D36), o aviso "3 alunos precisam de um adulto" (ou
  "Um aluno precisa de um adulto"), com "Aviso mais recente: <hora>", o que fazer e o botão "Ver quem".
  **Sem nome e sem o que foi dito.** O aviso que chega aos 15 s entra sem piscar, sem som e sem mover o foco
  (`aria-live="polite"`; D59)
- **"Sinais da turma"**: a soma, em falas do Tutor ("8 alunos travaram na questão 3"), sem nome de ninguém. Sem
  sinal, o vazio diz o que o Tutor avisa e quando (regra 50, item 6). Os sinais são relidos a cada 15 s, só com
  a aba à vista (não há WebSocket nesta fatia)
- **"O que o Tutor faz sozinho, e o que você vê aqui"**, recolhido: as funções do Tutor, cada uma com o que faz
  sozinha e o que fica com a professora, o selo de suspensa pela coordenação, o bloco "Quando o Tutor avisa
  você" (travou, pediu a resposta pronta, repetiu a dúvida) e a frase de que a conversa de um aluno não abre
  ali
- **"Acerto por habilidade"**: só de correção aprovada, em barras neutras (nenhuma fica vermelha) com o número
  em texto ("12 de 20") e quantos alunos acertaram menos da metade da habilidade (limiar provisório: decisão em
  aberto). Sem correção aprovada, o vazio tracejado diz que o acerto aparece depois de a professora aprovar.
  Sem média, nota nem ranking (D46, D69)
- **O nome chega por ação explícita**: "Ver quem" e "Ver o uso do Tutor por aluno" abrem o painel "O que o
  Tutor viu" (`?ver=tutor`), com a atenção humana (nome e hora, sem o que foi dito), os "Sinais por aluno" e o
  "Uso do Tutor pela turma" (as trocas do mês contra o pacote e, por aluno, as trocas de hoje, a última troca e
  em que ele estava), **em ordem de nome** e nunca por recência. A leitura nominal do uso só existe com o painel
  aberto e sai da memória com ele. **Nenhuma linha, botão ou link leva à conversa de um aluno**
- O endereço antigo do Tutor (`/professor/time/tutor`) leva a Hoje, quando há uma só turma confirmada, ou a
  Turmas

**Atividades** lista as atividades aplicadas à turma, uma linha por atividade, a mais nova primeiro: o ícone da
ferramenta, o título, a situação ("N de M enviaram") e o selo do estado em texto. Os estados são Aberta,
Correção para revisar, Correção aprovada, Correção rejeitada e Sem correção (ninguém abriu a atividade, ou a
coordenação suspendeu a função). Atividade é só objetiva (D55). Com mais de oito linhas, o filtro "Todas ·
Abertas · Para revisar · Encerradas", que é da aba e não vai ao endereço. A ação da aba, "Aplicar uma
atividade", leva a Criados já filtrado pela turma e pelo tipo; sem atividade, o convite mora no vazio, um só.

- A linha abre o **painel ao lado** (`?atividade=<id>`; folha de baixo a 360 px) com o selo, a situação, a
  turma, quando foi aplicada e encerrada, a frase do que fazer e as ações: "Abrir a atividade", "Revisar a
  correção" (ou "Ver a correção", se já decidida), "Corrigir de novo" (só quando a atividade encerrou sem
  correção que valha) e "Encerrar a atividade" (só na aberta, com a confirmação que diz o que acontece). O id
  de outra turma ou inexistente não abre painel, e a lista segue (regra 10, item 6)
- **Aprovar não é daqui**: é a tela de revisar, onde cada destaque se abre (seção 11.5). A aba não diz nota,
  média, conceito nem pontuação, e nada ordena por acerto

**Alunos**, de cima para baixo:

- **"Acesso dos alunos"**, um resumo ("Sem acesso ativo", ou "Acesso ativo" com "Vale até 26/10, 10h") e o botão
  "Convidar alunos", que abre o diálogo abaixo
- **"Pedidos de nome"**: cada pedido com o nome, a hora e, se houve, a marca da tentativa com matrícula errada;
  a lista se atualiza sozinha a cada 15 s, com a aba à vista; a professora marca até 40 e aprova (`oficial`) ou
  recusa (`perigo`) depois de revisar a turma, os nomes e o efeito, e cada pedido termina com o resultado em
  texto. Não existe "aprovar todos" (D4)
- **"Por aluno"**: os nomes da turma em ordem de nome (dois alunos de mesmo nome são duas linhas), lidos de cem
  em cem, com "Ver mais", e as colunas "Acertos" ("12 de 20") e "Por habilidade", só de correção aprovada. O
  aluno sem correção aprovada diz "Sem correção aprovada", e não "0 de 0"; quem saiu da turma (transferido, ou
  com o acesso desativado) diz "Saiu da turma", sem número. A falha dos acertos não tira os nomes. A lista não
  fica no cache nem em armazenamento do navegador
- **Não há** ordem por acerto, situação do aluno, média, busca por nome, selo de Adaptação por aluno nem
  "Abrir a conversa" (D35, D64, D69)

**Convidar alunos** é o acesso (gerar, gerar novo, revogar) num diálogo de 520 px, aberto pelo botão da aba
Alunos ou por `?convidar=1`; fechar tira o parâmetro (`replace`). Os passos trocam o conteúdo, e nunca há
diálogo dentro de diálogo:

- sem acesso, **"Gerar acesso"**: a validade (1, 7 ou 30 dias, com 7 já escolhidos) e o que acontece
- depois de gerar, **"Acesso gerado" em tela inteira**, porque é o passo que se projeta: o código da turma em
  dois grupos, grande; o link da sala; "Copiar link", "Compartilhar pelo WhatsApp" (o texto leva só o nome da
  escola e o link) e "Fechar". Fechar sem ter copiado pergunta antes, pelo botão e pelo Esc. **O link e o código
  aparecem uma vez** (regra 20, item 8): a leitura do acesso não os devolve, e abrir o diálogo de novo mostra só
  a validade
- com acesso vigente, até quando vale, "Gerar novo acesso" e "Revogar o acesso", cada um com a pergunta que diz
  o que acontece

O envio é único (dois cliques mandam um pedido só), e a sessão que vence com o diálogo aberto leva embora o
link e o código. O endereço nunca leva token, link nem código.

---

## 2. Área do aluno (F9)

Computador da escola em sala; fora da sala, também o celular, quando a escola liga o modo
casa (D19, D51). Nenhum fluxo exige o celular. Login pela conta Google ou Microsoft da
escola, quando existe, ou por escola + matrícula + senha (D48). A mesma área serve do 6º ano
ao 3º do Ensino Médio; a linguagem do tutor e os textos precisam funcionar para um aluno de
11 anos (D43).

**Decidido** (D80): quatro lugares, iguais na lateral e na barra de baixo do celular. Desde a tarefa
2.0 da **X4** (`telas-do-aluno-e-primeiro-acesso`) são três: **Início, Tarefas e Eu**, e o aluno abre
no Início (`/aluno/inicio`). "Avisar um adulto" é o quarto e fica com o F9 (D73): lugar sem tela não
aparece. Os endereços de antes continuam abrindo: `/aluno/tutor` e a conversa dentro de uma tarefa
acendem Início, `/aluno/atividades` é Tarefas, `/aluno/privacidade` acende Eu, e `/aluno/minha-turma`
leva a `/aluno/eu`, sem ficar no histórico. O rodapé fixo da lateral do aluno saiu: "Privacidade" é
uma linha de Eu, e o "Sair" fica à vista na casca em todo lugar e também é uma linha de Eu (D59).

- **Início** é onde o aluno abre (X4, tarefa 3.0): a saudação do Tutor, com a função e o selo "IA",
  a faixa de supervisão, presa, e até três tarefas "Para fazer", cada uma com "Pedir ajuda ao Tutor",
  que leva à conversa daquela tarefa. O Início não mostra o uso do dia, que fica na tela do Tutor
  (regra 80: a leitura do uso iria para a rajada de login), e a avaliação aberta é avisada antes de o
  aluno abrir a tarefa, sem tirar o caminho até o Tutor (D36). A conversa é com o **Tutor**, restrito
  ao conteúdo da turma, citando a página do material. Travado durante avaliação em andamento. Se apresenta pela função, como os outros
  agentes do time (D17, D58); **nunca afirma ser uma pessoa** e, perguntado sobre si, explica o que
  é, como funciona e que pode errar, em linguagem da faixa etária (D65)
- **Pesquisa em fontes aprovadas**, quando a escola liberou e o professor ligou para a turma
  (D68): o Tutor traz a fonte, pede para comparar, pergunta de volta, e não escreve o trabalho.
  A tela diz de onde veio cada informação, e que a pesquisa é vista pelo professor
- **Quanto ainda dá para usar hoje**, do pacote do tutor (D38), mostrado como salvaguarda e
  não como punição, com o ponto de parada visível (D59)
- **O aviso, visível e permanente, de que o professor acompanha o uso do Tutor** (D8). A faixa
  continua presa no alto da conversa e não fecha, mesmo onde o mockup a soltou (D80, item 7)
- **A caixa de escrever nunca some**, nem depois de um assunto delicado: é por ela que a mensagem
  fixa chega, com o caminho para um adulto (D36; D80, item 7)
- **Tarefas** são as atividades e as provas atribuídas pelo professor, em Para fazer, Entregues e
  Corrigidas, e a tarefa aberta, no endereço de Atividades (X4). O desenho das duas está na 11.5
- **Eu** é **"Como estou indo"**, só do próprio aluno: uma linha por tarefa de correção aprovada,
  com "N de M certas" e as habilidades a rever; as linhas **Privacidade** ("Meus dados", do F3),
  **Ajustes** (aparência e tamanho da letra), **Rever a introdução** e **Sair**; e, com o F9, **o que o Tutor lembra**: tudo que o aluno já fez no sistema —
  atividades, trabalhos, avaliações e sessões (D66) —, que ele consegue ver e contestar. Toma o
  lugar de "Minha turma"
- **Avisar um adulto** é o caminho para avisar sobre algo errado no sistema: o canal de notificação
  do ECA Digital, art. 28 (D61). **Só aparece quando o canal existir** (F9; D73)
- **"Sair" fica sempre à vista**, a um clique e do tamanho dos vizinhos (D59). O mockup tirou o
  menu do aluno; o produto não tira a saída (D80, item 7)
- **Aviso de privacidade em linguagem de faixa etária**: na introdução do aluno, uma vez, com
  "Rever a introdução" (X4), e sempre ao alcance, em Eu

Proibido na tela do aluno: ranking, média da turma que permita deduzir nota de colega, lista
de quem entregou (regra 50, item 9). Proibido também, por lei (Decreto 12.880, arts. 9º e 10;
D59): recompensa por tempo de uso, sequência de dias, pontos, vidas, pódio, recompensa variável,
conteúdo que começa sozinho, rolagem infinita, notificação fora do horário útil, esconder o ponto
de parada, e qualquer caminho de sair, revogar ou ajustar privacidade que seja mais longo que o de
aceitar. Nada disso vem junto com a pele (D80, item 7; seção 10.3).

Fora da sala, o tutor só aparece se a escola ligou o modo casa para aquela turma (D19).
Desligado, a tela explica que o tutor funciona em sala, sem parecer erro.

O que continua valendo do desenho da área, e o que ela **não** herda do professor, está na seção
11.5.

---

## 3. Área da coordenação

**Decidido** (D80): quatro lugares, **Painel · Analista · Escola · Registros**, e o sino. Eles
chegaram com a **X2** (`telas-da-coordenacao`): a lateral não é mais a lista plana de sete itens
(Governança, Agentes, Analista, Estrutura, Professores, Material e Privacidade) que a X1 deixou.
Cada tela dos sete continua no endereço de antes; o que mudou foi o lugar que a acende. O que cada
lugar recebe:

**Painel** é onde a coordenação abre, e a tela que fecha a venda. Recebe os números da Governança
de hoje (A5), que o F12 completa:

- o que espera a coordenação, e o que falta para terminar de montar a escola
- uso de IA por série e disciplina; por professor só com abertura auditada (D45). **Sem
  ranking, sem lista nominal de adoção e sem alerta de professor que não usa** (D64)
- o que a IA gerou e quem aprovou, com o número; notas aprovadas por humano quando a nota
  oficial existir (D46)
- desempenho por série, turma e habilidade
- alertas em agregado, como hipótese com contexto: média fora da curva, habilidade em
  queda, aluno em risco. Nada de ranking de professor
- consumo de IA do mês contra o orçamento

**Analista** é o **Analista de desempenho escolar**: resumo de segunda de manhã e alertas na hora,
em agregado; recorte com um professor só conta como nominal (D32 e D45 revistas). Hoje existe o
resumo (A5); a X2 o põe na página de conversa, sem perguntas livres.

**Escola** tem três abas, **Turmas, Professores e Material**, que recebem os itens Estrutura,
Professores e Material de hoje. Grade horária e calendário entram pelo menu de Escola, com o F2.

- **Estrutura**: séries, turmas, listas de nomes, grade horária e calendário importados,
  alocação de professor × turma × disciplina, convites de professor e conexão opcional com
  Google ou Microsoft (F1, F2; D3 revista, D48). É a primeira coisa que a coordenação faz, e
  precisa ser rápida (D24). A escola em si é criada por nós, no painel da operação (A0b, D76) ou
  pelo `ops:escola`, e a coordenação chega por convite (D2). Na A1 entra a parte fina: disciplinas e turmas criadas na tela, lista de nomes
  por turma, alocação e convite ao professor; grade horária e calendário vêm com o F2 (D71
  revista). Na A1 o cadastro e o convite do professor têm tela própria, **Professores**, item da lateral ao lado de
  Estrutura (tarefa 14.0; Tech Spec da A1, seção 9): cadastrar com nome e e-mail, copiar o link que aparece uma vez,
  refazer e revogar. O roteiro da Estrutura e o vazio da Alocação levam a ela. Dentro da turma aberta, embaixo da lista
  de nomes, a coordenação também decide os **pedidos de nome** (tarefa 16.0), com a mesma peça do professor: a lista só é
  lida no clique em "Atualizar", porque cada consulta fica na auditoria em nome dela, e a tela diz isso. Os alunos já
  aprovados aparecem na lista de nomes como uma contagem, sem o nome
- **Material**: **só a coordenação sobe material para a base da escola**; professor e aluno não
  sobem (D75). Fontes com titularidade e licença, upload, estado da ingestão com o que entrou,
  o que falhou, o que está pendente e o que foi recusado por falta de licença (F4,
  D5 revista)

**Registros** tem três abas, **IA, Pedidos e Privacidade**, que recebem a tabela da Governança, o
item Agentes e o item Privacidade de hoje.

- **IA**: o que a IA gerou e quem aprovou, na tabela que hoje está na Governança (regra 70, item
  6). Ao lado, **"Como cada IA trabalha"**: os três agentes e **as funções de cada um**, com o que
  cada função faz sozinha e o que espera aprovação, em português comum (D9 revista). É a tela para
  apontar quando alguém pergunta "o que essa IA faz sozinha?". Cada função de alto risco mostra o
  **resumo da avaliação de impacto**, o que ela **não** faz e o botão de **suspender só aquela
  função**, sem desligar o resto (D60 revista; P19)
- **Pedidos** e **Privacidade** recebem as quatro abas de "Seus dados e a lei", do F3: os pedidos
  dos titulares numa, e retenção, empresas e incidentes na outra. O que cada uma faz não muda, e é
  o que o item seguinte descreve
- **Privacidade** ("Seus dados e a lei", F3): as abas ficam no endereço, e a coordenação registra e acompanha os **pedidos dos
  titulares** (tarefa 16.0; RF10, RF14 e RF16), lê por quanto tempo a escola guarda cada dado, de onde vem cada prazo e os
  prazos que não mudam (tarefa 6.0; RF20), e quais empresas recebem dado dela, vigentes e passadas, com o que cada uma faz, o
  que recebe, onde processa e o que o contrato diz sobre treinar IA com o dado (tarefa 8.0; RF7), e os incidentes de
  segurança que a afetaram, com todos os campos e a confirmação do recebimento (tarefa 10.0; RF9). **Pedidos** é a aba que
  abre, porque é o que a coordenação faz ali; as outras três seguem. Nenhuma aparece antes da tela dela (D73). **Pedidos**:
  a lista, a mais recente primeiro, com pessoa, turma, pedido, quem pediu, chegada e situação em texto ("Titular eliminado" e
  "Não consta" quando a pessoa já saiu); "Registrar pedido" abre a busca por nome (Enter ou botão, a partir de 3 letras,
  resultado anunciado por `aria-live`, 429 em texto), em que cada pessoa se escolhe pela turma e pela matrícula, e depois a
  confirmação, com a prévia do que a escola guarda e o aviso de homônimo; a eliminação vai em `perigo`, com os 7 dias e o que
  a escola guarda fora do sistema. Uma faixa fixa diz que o aluno que nunca reivindicou o nome está na lista da turma. O
  nome da pessoa abre o **detalhe do pedido** (tarefa 17.0; RF12, RF13, RF13b, RF14 e RF16), uma página do pedido (não um
  diálogo), com o título da aba sem nome: o pedido e a situação em texto, o **prazo** da declaração completa (15 dias da
  chegada: "Faltam N dias, até DD/MM", e o vencido diz há quantos dias, com o ícone), as **empresas** por onde passou dado da
  pessoa e as ações que valem para o tipo e o estado: **Concluir**, **Cancelar eliminação** (o diálogo diz que o acesso volta;
  o botão que fecha é "Manter a eliminação"), **Corrigir nome** (nome atual e novo antes de confirmar, com o aviso do nome
  anterior) e **Baixar a versão da escola** (`oficial`, com a finalidade escolhida da lista, o que o arquivo traz, que fica
  registrado e que se entrega e se apaga do computador). O arquivo em preparação se atualiza a cada 10 s e para com a aba
  escondida. Retenção e empresas são só leitura: o ajuste de prazo e o cadastro da empresa são da operação,
  por comando. **O aviso de incidente** aparece ao entrar, em diálogo, para a
  coordenação da escola afetada; "Ver depois" deixa uma faixa fixa, sem botão de fechar, até a confirmação, e o "Sair" nunca fica
  fora de alcance (D59)

**O sino "Esperando você"** da coordenação (X2, RF4 a RF7) lista cinco tipos, e só eles: incidente
sem confirmação, professor que contestou a turma, convite vencido, material que falhou e turmas sem
professor. Cada item leva à tela que resolve e sai quando o estado muda; sem item, o vazio diz "Tudo
em dia". Nenhum item conta por professor (o único número é o das turmas sem professor), e o que só
se lê com leitura auditada (lista de nomes, pedidos de nome, pedidos do titular) não entra (regra 20,
item 10; D45, D64). O sino não pisca, não soa e não relê por tempo.

**A introdução** (X4, tarefa 11.0) abre na primeira entrada, em tela de foco, falada pelo Analista
de desempenho escolar: quatro passos ("Eu ajudo a ler os números de <nome da escola>."; a escola em números
agregados, com professor só em grupo de dois ou mais, D45; dado com nome só abre com motivo, e fica
registrado; e o que a IA nunca faz, com "Onde fica cada coisa"). O último leva ao Painel. O aviso de
incidente aparece por cima dela: "Ver depois" o fecha e a introdução continua. "Rever a introdução"
é a única linha do menu da pessoa da coordenação.

**Fica na fase de cada um, e não aparece antes dela** (D73; D80, item 7): Adaptações, o Dossiê
(Conformidade), os Avisos (Denúncias), Exportar, Auditoria e Configurações da escola.

- **Adaptações**: registro da adaptação necessária por aluno, nunca diagnóstico (D35)
- **Conformidade**: o dossiê da escola em um lugar — declaração de propósito e faixas etárias,
  como o sistema funciona em linguagem simples, conformidade com LGPD e ECA Digital, relatório
  de uso exportável, e o material para conversar com professores e famílias (D61). É a tela
  que a coordenação abre na reunião, e a que responde ao checklist do MEC
- **Denúncias**: o canal de notificação de violação, com o que foi apontado, o que foi feito e
  o recurso, dizendo se a análise foi humana ou automatizada (D61)
- **Exportar**: dado, artefato e histórico de uso em formato aberto, a qualquer momento, sem
  depender de nós (D63)
- **Auditoria**: para qualquer item, o que a IA gerou, quem aprovou e quando
- **Configurações da escola**: política de tutor, modo casa por turma (D19), busca do Tutor em
  fontes aprovadas — liberar na escola e ajustar a lista de fontes (D68) —, retenção

MFA obrigatório para coordenação (F1).

Como os lugares aparecem na lateral está na seção 11.1, e o que continua valendo do desenho da
Governança, na 11.5.

---

## 4. Área da rede (F14)

Consolidado por escola, comparativo e adoção. **Nunca** dado individual de aluno, nunca
conversa de tutor (regra 10, item 8). Os lugares, quando o F14 existir, são Painel, Analista e
Escolas (D80).

## 5. Área da família

Fase posterior (D11). Nota, entrega e alerta, alimentados pelo motor de eventos do F13.

## 5a. Painel da operação Turmma (A0, D76)

Não é área da escola: é a nossa. Só o operador Turmma entra, com conta própria e segundo fator
obrigatório, e nenhuma pessoa de escola alcança estas telas.

**Uma tela só, sem lateral** (D80): uma barra de topo, com a marca, "Operação Turmma" e a conta do
operador com "Sair", e duas abas, **Escolas** e **Uso**. Uma linha fixa diz que a operação não vê
dado de aluno nem de professor. A X1 (15.0) trocou a faixa preta do topo pela barra clara, e a X2
põe as duas abas na página.

- **Aba Escolas**: a lista de redes e escolas, com o estado da primeira coordenação e contagens de
  turmas, alunos e professores ativos do ano em curso. Só número, nunca nome. Os estados são sete, e
  a tela os diz em texto, sem o identificador: sem convite, convite enviado e ainda não aberto,
  vencido, revogado, aceito sem o primeiro acesso, sem coordenação ativa, e ativa. Os textos exatos,
  e os das mensagens de cada ação, estão no cenário W10 da A0b
  (`tasks/prd-apresentacao-painel/cenarios.md`); as ações de cada estado saem da matriz da seção 5
  da Tech Spec da A0b
- **Nova rede** e **nova escola**: nome, tipo de rede e o endereço da escola
- **Convite da coordenação**: cadastrar a primeira coordenadora, copiar o link, revogar e refazer
- **Aba Uso**: por escola, no dia e no mês — o uso de infra desde já (D30), o consumo de IA
  contra o teto por aluno (D39), que a D76 previa com a A2 e o MVP não trouxe (`TODO.md`)

A pele é a mesma do produto (D80), e a barra com "Operação Turmma" é a marca de que ali é a operação,
para ninguém confundir com a tela de uma escola. As medidas estão na seção 11.4.

---

## 6. Em toda tela

- Quatro estados: carregando, vazio, erro, com dado. **Vazio é convite para agir**
- Português do Brasil, data e número no formato local
- Erro diz o que fazer: "não foi possível salvar, tente de novo em instantes"
- Navegação por teclado, foco visível, contraste, rótulo em campo
- Lista longa virtualizada. Nada que assuma máquina boa
- **Toda saída de IA é rotulada como tal**, com a fonte e a página quando vem do material, e
  com quem aprovou quando já passou por aprovação (o selo está descrito na seção 11.5)
- **Sem padrão manipulativo** (D59): nenhuma urgência fabricada, nenhum botão que esconde a
  ação menos lucrativa para nós, e o caminho de recusar do mesmo tamanho do de aceitar
- **Responsiva desde a primeira versão** (D51): do computador da escola ao celular, a
  partir de 360 px. Abaixo de 768 px os lugares ficam numa barra de baixo e o resto, numa gaveta
  (11.1); a conversa, a fila e as ferramentas cabem numa coluna. Toque em vez de hover,
  alvo de toque de 44 px na ação principal. Nenhum fluxo exige o celular
- **Padrão de página** (D80, item 6, que revê o P03): **toda tela aberta por um lugar da lateral
  tem título visível**, que é o `<h1>`, e título próprio na aba do navegador (regra 50, item 11). A
  conversa é a exceção: o `<h1>` dela existe só para leitor de tela. **Até três abas**, nunca uma
  dentro da outra. **Linha inteira clicável**, sem "Ver" repetido. O detalhe abre num **painel ao
  lado, de 480 px**, e como folha de baixo no celular. **Um botão cheio por tela.** As medidas
  estão na 9.3 e os tipos de página, na 11.2
- **Tela de trabalho cabe na janela** e rola por dentro. No Chromebook de 1366 × 768 sobra pouca
  altura: o e2e do projeto `chromebook` prova que a tela continua legível, e, se não couber, ela
  rola por dentro em vez de espremer
- **Claro e escuro** (D80, item 2): a pessoa escolhe entre Sistema, Claro e Escuro, em qualquer
  área. A escolha fica no navegador, sem identificador, e vale antes de a primeira tela desenhar.
  Nenhuma tela escreve cor por tema: quem usa token muda sozinho (9.1 e 9.10)
- **O que o navegador guarda é lista fechada** (regra 50, item 7; Tech Spec da X1, seção 7; telas do aluno, 8.0): três chaves de
  `localStorage`, `educa.aparencia` (`claro` ou `escuro`; Sistema **apaga** a chave), `educa.lateral-recolhida` (`sim`;
  aberta apaga a chave) e `educa.letra` (`grande` ou `maior`; Padrão **apaga** a chave). Nenhuma chave nem valor leva pessoa, escola, papel
  nem identificador, e nada vai para o `sessionStorage`. A aparência e a letra são do aparelho: ficam para a próxima pessoa do
  mesmo computador, e mais nada fica. **Só a escolha grava**: montar a peça, abrir "Ajustes" e entrar na área não escrevem nada.
  Chave nova é decisão, com a regra 20 junto, e os e2e de `aparencia.spec.ts` (duas pessoas no mesmo navegador) e de
  `tamanho-da-letra.spec.ts` a reprovam
- **O tamanho da letra é do aluno** (RF11 das telas do aluno): Padrão, Grande ou Maior, em Eu › Ajustes, valendo só na área
  `/aluno`. O script em linha do `index.html` lê a chave e, se o caminho é o do aluno, escreve `data-letra` no `<html>` antes do
  primeiro quadro; o `font-size` do `<html>` passa a 112,5% (18 px) ou 125% (20 px). **Toda medida de texto é em `rem`**,
  também as classes `t-*` da 9.2 (a tabela diz px, que é o que o `rem` vale nos 16 px de fábrica): medida de texto escrita em
  px não acompanha a letra. Os pontos de quebra seguem os 16 px do navegador, e por isso o celular continua celular com a
  letra Maior; com ela, nada rola de lado a 360 px (se rolar, conserta-se a tela, e não o tamanho)
  O `rem` vale para **todas** as áreas, e não só para o aluno: no Padrão 1 rem são 16 px e nada muda, mas quem configurou o
  navegador do Chromebook gerenciado com letra acima de 16 px passa a ver também o texto do professor e da coordenação maior.
  É intencional (acessibilidade, regra 50, item 11), e não bug a desfazer

## 7. Em aberto

- **A D80 (12/10/2026) fechou** a pele, a navegação dos quatro papéis, o padrão de página, os
  avatares dos agentes, as abas da turma aberta e o modo escuro. As seções 1 a 6 e a Parte B já
  descrevem a versão decidida. O registro item por item da revisão de setembro continua em
  `docs/pendencias-dos-mockups.md`
- **Parecer de trade dress.** A pele toma uma técnica conhecida (ilustração chapada, botão com
  degrau, mascote). A marca, a mascote, as cores, os ícones e a fonte são nossos, e o verde não é a
  cor principal; ainda assim o parecer entra junto do registro no INPI (D80; `TODO.md`)
- **O mockup de outubro está em `mockups/`** desde 16/10/2026 (cópia de `Prototipo_Turmma` em
  `a95568d`, D80), **como referência**: desde 30/10/2026 ele não é o alvo (D80 revista). A fonte de valores é esta
  Parte B; o mockup é para consultar quando ajudar, e diferença em relação a ele não é defeito nem pendência. Nada de lá é copiado para o `apps/web`, **com uma exceção**: a onça
  (o traço, as poses e o movimento que ficaram, 9.7), que o Joaquim mandou trazer fiel ao mockup (correção
  `2026-10-28-onca-do-mockup`). O desenho foi copiado para `componentes/ui/onca/`, o mockup continua sem ser importado, e um teste
  guarda os valores do original
- **A comemoração na entrega e a onça "acolhendo"** dependiam do parecer do `conformidade-reviewer`,
  na X4: a primeira por encostar em recompensa (D59), a segunda por pôr expressão de preocupação no
  lugar onde o Tutor encaminha um assunto delicado (D58; regra 70, item 4a). **Parecer dado na tarefa
  5.0 da X4 (25/10/2026) para as poses acenando e apontando e para a comemoração**, com as condições:
  um salto só, e só depois do envio confirmado nesta tela; sem número, sem som e sem depender de
  acerto, resultado ou tempo de uso; parada quando a pessoa pede menos movimento; não volta ao
  recarregar (RF8; a 7.0 prova, com `Atividade.tsx`). A "acolhendo"
  **continua sem parecer** e não entra (D80, item 3)
- **Duas camadas do mockup ficam fora**, porque o LEIAME dele não as descreve e ninguém as decidiu:
  a "15ª rodada" da conversa (voto, refazer e editar em toda resposta, anexo na caixa), que mexe no
  registro que o professor supervisiona e cria dado novo de menor; e os painéis de gestão, que
  pintam "melhoraram" de verde e "pioraram" de vermelho, contra a regra de cor por categoria (9.1)
- **O rótulo em caixa-alta de 15 px na lateral**, medido na fonte do ChromeOS: se cortar, desce a
  14 px (Tech Spec da X1, seção 12)
- **O script do tema diante de uma política de segurança de conteúdo**: quando o F16 trouxer uma,
  ele entra por hash (`TODO.md`)
- **O ícone do navegador** (`turmma-icone.svg`) ainda tem o fundo azul-noite da pele da landing
  page. A landing page ainda lista os agentes antigos: alinhar junto (Gabriel)
- **Continua em aberto, da revisão de setembro:** Projetos (P05), anexo na conversa (P07), faltas e
  Frequência (P08), ranking de participação (P26, que bate na 10.3), Recursos e Mural (P28) e as
  oito ferramentas novas do catálogo (P22)
- **Indicadores da turma aberta e do Meu uso**: quais, limiar e texto do alerta (decisão em aberto
  no `CLAUDE.md`; o ponto de partida está no P11)
- Imagens da ferramenta de apresentação (D67)

---

# Parte B — Design

## 8. Direção de design

### 8.1 De onde vem

**Decidido** (D80, 12/10/2026). O Gabriel viu o produto na pele de setembro e reprovou: "muita
informação, muita aba, muita coisa"; "muito texto, pouco contraste e cara de site". De 04 a
07/10/2026 ele redesenhou tudo em mockup: a décima rodada deu a estrutura, a 11ª deu a pele, a 12ª
e a 13ª, as peças, e a 14ª, os tipos de página e o modo escuro.

| Fonte | O que ela dá | O que ela não dá |
|---|---|---|
| **O mockup de outubro** (`Prototipo_Turmma`, commit `a95568d`; inventário em `tasks/prd-pele-e-casca/mockup.md`) | Deu os valores de cor, as medidas, o desenho das peças, a casca e os tipos de página da X1 a X4; desde 30/10/2026 é só referência (D80 revista) | Código. Ele não fala com servidor, usa bibliotecas que o produto não tem (10.1) e afrouxa proteções que o produto cumpre (8.3) |
| **Duolingo** | A **técnica**: ilustração chapada, borda grossa com degrau sólido, cor por família, mascote, contraste alto | A marca, a mascote, o verde, a fonte e as mecânicas de uso (8.3) |
| **A marca** (`apps/web/public/marca/`) | A pinta, o logotipo, o laranja `#E8732E` e a onça | A pele da landing page, que continua só lá |
| **O produto que já existe** | As regras, os quatro estados, os textos, os nomes acessíveis e o e2e que prova cada regra | — |

**Regra vence desenho** (D80, item 7): onde o mockup e uma proteção do produto discordam, vale o
produto. E, desde 30/10/2026, este documento vence o mockup (D80 revista).

### 8.2 O que tomamos

Borda de 2 px e degrau sólido no lugar de linha fina e sombra borrada: a pista de que algo se
aperta aparece até na tela lavada de um Chromebook de entrada, e não custa quadro. Cor por família,
que diz **categoria** e nunca julgamento. Ícone ilustrado e a onça da marca. Letra maior e mais
pesada. Modo escuro. E até quatro lugares por papel, com uma fila só para o que espera a pessoa.

### 8.3 O que não tomamos

- **Do Duolingo, nada além da técnica.** A mascote, as cores, os ícones e a fonte são nossos, e o
  verde não é a cor principal. Copiar marca ou medida de outro produto abre risco de concorrência
  desleal (trade dress): o parecer está na seção 7
- **As mecânicas de uso compulsivo**: sequência de dias, pontos por tempo, vidas, ranking, pódio,
  notificação insistente e recompensa variável (D59, D57; Decreto 12.880, arts. 9º e 10; 10.3)
- **O que o mockup afrouxa** (D80, item 7): "Sair" fora de alcance, a faixa de supervisão do Tutor
  solta, a caixa do Tutor sumindo depois do assunto delicado, a entrada da escola respondendo
  diferente para matrícula errada e pedido pendente, e-mail no convite, segundo fator só em QR,
  busca pública de escola, e tela sem carregando e sem erro
- **O que reprova contraste ou custa quadro**: borda de campo clara, foco só pela cor da borda e
  texto em `apagado` (9.1); hover com `filter`, largura animada e `zoom` na página (9.5)
- **As bibliotecas do mockup**: as peças são nossas (10.1)
- **`oklch()` e `color-mix()`**, que não existem no Chrome 109 do laboratório, e **emoji** na
  moldura, que renderiza diferente em cada sistema
- **Da pele de setembro**: o botão em pílula, o canto de 28 px, o item de menu de 36 px e a aba sem
  título. Fica o que a D72 revista manteve: uma pele só, a fonte do sistema, o laranja da pinta e
  um botão de decisão oficial que não se parece com nenhum outro

### 8.4 Os seis princípios

1. **Uma tela, uma pergunta.** A professora tem quarenta minutos e uma xícara de café na mão
   (regra 50). O Início é uma caixa de pedido; cada outra tela tem um título e uma ação principal
2. **Laranja cria e pede, grafite decide, azul seleciona.** O **laranja** é a ação de criar e
   pedir, com texto escuro em cima. O **grafite** fica reservado para a decisão oficial: aprovar,
   publicar, confirmar. O botão de aprovar não se parece com nenhum outro, nos dois temas, e isso é
   de propósito: é o que combate o clique reflexo (regra 50, item 8). O **azul** é o selecionado,
   o link e o foco
3. **A IA sempre assina.** Toda saída de IA leva o avatar do agente, o nome da função, o selo
   "IA", a fonte com página e, depois de aprovada, quem aprovou (regra 70; D58)
4. **Calmo por lei.** Nada pisca para chamar de volta, nada comemora tempo de uso, nada começa
   sozinho (D59). A pele é viva na cor e no desenho, não no apelo
5. **Leve por contrato.** O alvo é o Chromebook de entrada em rede de escola: nenhuma fonte web,
   nenhuma biblioteca de animação, só `transform` e `opacity` animam, e o que pesa carrega só na
   tela que usa (10.4)
6. **Uma pele só**, em todas as telas e nos dois temas (D72 revista). Tela nova usa peça do
   catálogo (10.2) e token da 9.10: não se escreve cor, medida nem peça solta

### 8.5 A régua

A régua do mockup (R1 a R12), ajustada ao que o produto já decidiu. Vale para toda tela.

| # | Regra |
|---|---|
| R1 | No máximo **quatro lugares** por papel, iguais na lateral e na barra de baixo. Ação não é lugar |
| R2 | **Dois níveis**: lugar, tela e detalhe. O detalhe abre ao lado (480 px) ou como folha de baixo. Só o objeto grande vira página, com voltar |
| R3 | No máximo **três abas**, nunca uma dentro da outra. Jeito de ver é `Segmentado`. Um filtro visível por tela |
| R4 | **Um botão cheio** por tela: laranja para criar e pedir, grafite para decidir. O raro vai para "Mais opções" |
| R5 | **Linha inteira clicável**, com chevron. Nada de "Ver" repetido |
| R6 | **Título sim, descrição não** (revê o P03). A explicação fica onde a dúvida nasce, em uma linha |
| R7 | **Texto curto**: rótulo de uma ou duas palavras, botão com verbo e objeto, frase para o aluno com até doze palavras |
| R8 | **Fila vazia é uma linha** ("Tudo em dia"). Tela vazia continua sendo convite para agir (regra 50, item 5) |
| R9 | **Contador só onde há ação**: o sino e, no aluno, Tarefas e Avisar. Nada conta tempo, sequência ou novidade |
| R10 | **Cabe na janela**: a 1366 × 768 a tela de trabalho não rola a página; a 360 px nada rola de lado |
| R11 | **Voltar é previsível**: "‹ origem" no alto, painel que fecha com X e Esc, o endereço guardando aba e painel, e trocar de aba sem empilhar histórico |
| R12 | **Nada na tela existe para demonstrar.** O dado sintético entra pelo produto (D71), e as peças com todos os estados moram na galeria |

---

## 9. Fundamentos visuais

### 9.1 Cor

**Branco no chão, dez famílias de cor e três papéis fixos** (D80, item 1): laranja cria e pede,
grafite decide, azul seleciona. Os valores são os do `index.css` do mockup, salvo os desvios
listados adiante. Tudo em **hex**, nos **dois temas**. O contraste (WCAG 2.1) foi calculado para
este documento sobre estes valores, e o teste da X1 refaz a conta pela tabela de pares.

**Neutros** (claro e escuro; nas medidas, a primeira é a do claro):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `fundo` | `#FFFFFF` | `#131F24` | O chão e a face de tudo o que é "branco": cartão, botão secundário, diálogo, menu, lateral |
| `fundo-suave` | `#F7F7F7` | `#202F36` | Hover de linha e de peça branca, selo neutro, campo desligado |
| `campo` | `#FFFFFF` | `#202F36` | Fundo de campo de texto e da caixa de pedido |
| `mesa` | `#F7F7F7` | `#0E181C` | O fundo atrás da folha do documento (X3) |
| `borda` | `#E5E5E5` | `#37464F` | A borda de 2 px e o degrau de peça branca. Decorativa (1,3:1 e 1,7:1): nunca é a única pista de um controle |
| `borda-forte` | `#D7D7D7` | `#52656D` | Hover da borda de peça branca |
| `borda-campo` | `#8F8F8F` | `#6B7F88` | Borda de campo, de caixa de marcar e de interruptor desligado (3,2:1; no escuro, 4,0:1 no chão e 3,3:1 contra o campo) |
| `apagado` | `#AFAFAF` | `#52656D` | Chevron e série tracejada. **Não é cor de texto** (2,2:1 e 2,8:1) |
| `tinta` | `#0D0D0D` | `#F1F7FB` | Texto principal (19,4:1 e 15,6:1) |
| `apoio` | `#424242` | `#DCE6EC` | Texto de apoio (10,0:1 e 13,3:1) |
| `sutil` | `#5D5D5D` | `#8FA3AD` | Segunda linha, rótulo, exemplo de campo (6,6:1 e 6,4:1). É o piso: nada de texto mais claro |
| `sobre-cor` | `#0D0D0D` | `#131F24` | Texto e glifo em cima de face colorida. Escuro nos dois temas |
| `grafite` · `grafite-degrau` | `#333333` · `#0D0D0D` | `#F1F7FB` · `#8FA3AD` | A face e o degrau do botão oficial. Invertem no escuro |
| `sobre-grafite` | `#FFFFFF` | `#131F24` | Texto em cima do oficial (12,6:1 e 15,6:1) |
| `icone-papel` · `icone-linha` | `#EFEFEF` · `#D7D7D7` | `#37464F` · `#52656D` | O papel dos ícones ilustrados e as linhas dele |
| `veu` | `#00000059` | `#00000099` | O véu atrás do diálogo e do painel ao lado: preto a 35% e a 60%, em hex de oito dígitos. No `::backdrop` o valor vai escrito por extenso, porque antes do Chrome 122 ele não herda variável |
| `onca-chao` | `#AFAFAF4D` | `#00000059` | A sombra do chão sob a onça de corpo inteiro (9.7): cinza a 30% no claro e preto a 35% no escuro, em hex de oito dígitos. É do cenário, não da onça: as nove cores dela são fixas |
| `foco` | `#146EAA` | `#60B9F4` | O anel de foco, de 3 px (5,5:1 no chão claro; 7,8:1 no escuro) |
| `white` · `black` | `#FFFFFF` · `#000000` | os mesmos | Não mudam com o tema. Não servem de face nem de texto de peça |

**As dez famílias**, cada uma com cinco tons: **face** (o preenchimento), **degrau** (sob o que se
aperta), **claro** (fundo de selo e de selecionado), **borda** (a do claro) e **texto** (para
escrever no chão e no claro). A medida traz o `texto` no chão, o `texto` no `claro` e o `sobre-cor`
na face. No claro:

| Família | face | degrau | claro | borda | texto | Medida | Uso |
|---|---|---|---|---|---|---|---|
| `laranja` | `#E8732E` | `#BA5C25` | `#FDEBDD` | `#F5C0A1` | `#A85220` | 5,4 · 4,7 · 6,4 | A marca e a ação de criar e pedir. Nunca em matéria |
| `azul` | `#1C9BEF` | `#167CBF` | `#DFF1FD` | `#99D2F8` | `#146EAA` | 5,5 · 4,7 · 6,5 | Selecionado, link e foco · Assistente de ensino · Matemática |
| `verde` | `#2FBF5B` | `#269949` | `#E2F6E8` | `#A1E2B5` | `#1F7C3B` | 5,2 · 4,6 · 8,1 | Certo, aprovado, feito · Ciências, Biologia |
| `amarelo` | `#FFC31F` | `#E0A000` | `#FFF7E0` | `#FFE49A` | `#8C6B11` | 5,0 · 4,6 · 12,1 | Esperando você · História, Filosofia |
| `vermelho` | `#F2545B` | `#C24349` | `#FDE7E8` | `#F9B2B5` | `#B84045` | 5,4 · 4,6 · 5,7 | Problema, prazo, perigo · Língua Inglesa |
| `roxo` | `#A56EF5` | `#8458C4` | `#F2EBFE` | `#D6BEFA` | `#7D54BA` | 5,5 · 4,7 · 5,7 | Cuidado com pessoa · Língua Portuguesa |
| `turquesa` | `#1DBFAE` | `#17998B` | `#DFF6F4` | `#99E2DB` | `#137A6F` | 5,2 · 4,6 · 8,4 | Turma · Química |
| `anil` | `#6A85F7` | `#556AC6` | `#EAEEFE` | `#BCC8FB` | `#5165BC` | 5,3 · 4,6 · 5,8 | Analista de desempenho escolar · Física |
| `lima` | `#9ACD2E` | `#7FB01C` | `#F1F8E2` | `#D2E8A1` | `#59771B` | 5,1 · 4,7 · 10,3 | Geografia, Sociologia |
| `rosa` | `#F57CB5` | `#C46391` | `#FEEDF5` | `#FAC4DE` | `#A25277` | 5,2 · 4,7 · 7,8 | Arte, Educação Física |

No escuro, em que o degrau não muda:

| Família | face | degrau | claro | borda | texto | Medida |
|---|---|---|---|---|---|---|
| `laranja` | `#EB8447` | `#BA5C25` | `#352C26` | `#734528` | `#EF9D6D` | 7,8 · 6,3 · 6,3 |
| `azul` | `#37A7F1` | `#167CBF` | `#143344` | `#17577F` | `#60B9F4` | 7,8 · 6,1 · 6,4 |
| `verde` | `#48C76F` | `#269949` | `#17392D` | `#20673D` | `#6DD28C` | 9,0 · 6,8 · 7,7 |
| `amarelo` | `#FFC31F` | `#E0A000` | `#393923` | `#7D6922` | `#FFD562` | 12,0 · 8,4 · 10,5 |
| `vermelho` | `#F4696F` | `#C24349` | `#37272D` | `#77373D` | `#F6878C` | 7,0 · 5,9 · 5,7 |
| `roxo` | `#B07FF6` | `#8458C4` | `#2A2C45` | `#554382` | `#C09AF8` | 7,4 · 6,0 · 5,8 |
| `turquesa` | `#38C7B8` | `#17998B` | `#15393A` | `#186762` | `#61D2C6` | 9,2 · 6,9 · 8,0 |
| `anil` | `#7C94F8` | `#556AC6` | `#212F46` | `#3A4D83` | `#97AAF9` | 7,6 · 6,0 · 6,0 |
| `lima` | `#9ACD2E` | `#7FB01C` | `#293B26` | `#506D28` | `#B8DC6D` | 10,8 · 7,7 · 8,9 |
| `rosa` | `#F68CBE` | `#C46391` | `#372E3B` | `#794965` | `#F8A3CB` | 8,9 · 6,9 · 7,5 |

**Nenhuma face aceita texto branco**: em cima dela o texto é `sobre-cor`. E a face não é cor de
texto: o laranja no chão claro dá 3,0:1, e para isso existe o `laranja-texto`.

**Cor é categoria, nunca julgamento.** Nenhuma barra, número ou gráfico fica verde porque subiu e
vermelho porque caiu, e a barra de acerto é neutra.

- **Matérias:** Matemática azul · Língua Portuguesa roxo · Ciências e Biologia verde · Química
  turquesa · Física anil · História e Filosofia amarelo · Geografia e Sociologia lima · Língua
  Inglesa vermelho · Arte e Educação Física rosa. O laranja nunca vai em matéria. A disciplina que a escola
  cadastra com outro nome (Robótica) cai na reserva: `anil` com um livro aberto (`areas/aluno/materia.ts`)
- **Agentes:** Tutor laranja · Assistente de ensino azul · Analista anil (9.7)
- **Tipos da fila** (X2 e X3): cada tipo de item tem a família dele, fixa
  (`tasks/prd-pele-e-casca/mockup.md`, seção 1.2)

**Os nomes de antes da D80 ficam**, porque as telas não mudam uma classe na X1. Peça nova usa o
nome novo.

| Token | Claro | Escuro | O que é agora |
|---|---|---|---|
| `superficie` · `lateral` | `#FFFFFF` | `#131F24` | Apelidos de `fundo`. A lateral era `#F9F9F9` |
| `linha` | `#E5E5E5` | `#37464F` | Apelido de `borda` (era `#E8E8E8`) |
| `realce` | `#ECECEC` | `#202F36` | O selecionado das telas de antes. Na pele nova é `azul-claro`, `azul-borda` e `azul-texto` |
| `realce-suave` · `creme` | `#F4F4F4` | `#202F36` | Hover e balão de quem escreve. Peça nova usa `fundo-suave` |
| `papel` | `#F4F3F0` | `#202F36` | Só o painel da casca pública (11.3) |
| `inativo` | `#8F8F8F` | `#52656D` | Só controle desligado das telas de antes |
| `caramelo` | `#E8732E` | `#EB8447` | Apelido de `laranja` |
| `caramelo-claro` · `caramelo-fundo` | `#EE8747` · `#D4651F` | `#EF9D6D` · `#D4651F` | Hover e pressionado da face laranja. No escuro o pressionado não é o `#BA5C25` do mockup: é face com texto em cima, e precisa de 4,5:1 |
| `caramelo-texto` | `#B4520F` | `#EF9D6D` | Laranja como texto (5,1:1 e 7,8:1). Peça nova usa `laranja-texto` |
| `caramelo-noite` | `#F2A25B` | `#F2A25B` | Sem uso: o foco é um só (10.1). Sobre a `noite` do escuro o anel é o `sobre-grafite`, e não ele |
| `noite` · `noite-alto` · `noite-baixo` | `#0D0D0D` · `#2F2F2F` · `#000000` | `#F1F7FB` · `#DCE6EC` · `#FFFFFF` | O preto de antes, que inverte. O oficial passa a `grafite`, com `noite-alto` no hover |
| `pendente-cx` · `pendente` | `#FDF0E8` · `#8A3E0C` | `#352C26` · `#EF9D6D` | "Esperando você" (6,8:1 e 6,3:1) |
| `ok-cx` · `ok` | `#E9F5EE` · `#0B6B47` | `#17392D` · `#6DD28C` | Aprovado, conferido, salvo (5,8:1 e 6,8:1) |
| `erro-cx` · `erro` | `#FDECEC` · `#B42318` | `#37272D` · `#F6878C` | Erro, recusa (5,8:1 e 5,9:1) |
| `info-cx` · `info` | `#F4F4F4` · `#0D0D0D` | `#202F36` · `#F1F7FB` | Aviso permanente (17,7:1 e 12,8:1). Cinza: aviso não é alarme |
| `ia-cx` · `ia` | `#F0F0F0` · `#424242` | `#202F36` · `#DCE6EC` | O selo "IA" e o chip de fonte (8,8:1 e 10,9:1). Neutro: o selo informa, não chama |

**Onde o produto se afasta do mockup, de propósito** (D80, item 7; Tech Spec da X1, seção 9):

1. **`borda-campo` continua `#8F8F8F`** no claro, e é `#6B7F88` no escuro, valor escolhido aqui
   entre os dois cinzas vizinhos do mockup. O mockup usa a `borda` comum, que dá 1,3:1 e 1,7:1 e
   reprova o 3:1 de componente
2. **`apagado` nunca é texto.** Peça desligada é face `borda` com texto `apoio`
3. **Texto sobre face colorida é `sobre-cor`; sobre o oficial, `sobre-grafite`.** O mockup escreve
   `white` nos dois e conta com ele virar escuro no tema escuro
4. **`white` e `black` não mudam com o tema.** Por isso `bg-white` e `text-white` saem das telas
   na X1: no escuro, `white` sobre `noite` daria 1,1:1, e `tinta` sobre `caramelo`, 2,5:1
5. **O campo em foco leva o anel**, e não só a borda em `azul-borda`, que dá 1,6:1 (10.1)
6. **Campo inválido tem borda em `vermelho-texto`** (5,4:1), e não em `vermelho-borda` (1,7:1)
7. **O hover troca a cor da face** por outro token, sem `filter` (9.5)
8. **Não entram** os tokens mortos do mockup: `rank-*`, `marca-cx*`, a rampa `neutral`, a ponte
   com o shadcn, `capa*` e as fontes `font-teachy*`

Estado nunca é só cor: selo, aviso e item selecionado levam texto ou ícone (regra 50, item 11).

#### Pares de contraste

Cada par de texto e fundo que a pele usa, com o mínimo que ele cumpre **nos dois temas**: 4,5 para
texto, 3 para a borda que é a única pista de um controle. O teste de contraste da X1 lê esta
tabela e os dois blocos da 9.10. Par novo entra aqui na mesma tarefa que o usa.

| par | texto | fundo | mínimo |
|---|---|---|---|
| tinta, chão | `tinta` | `fundo` | 4,5 |
| tinta, fundo suave | `tinta` | `fundo-suave` | 4,5 |
| tinta, campo | `tinta` | `campo` | 4,5 |
| apoio, chão | `apoio` | `fundo` | 4,5 |
| apoio, fundo suave | `apoio` | `fundo-suave` | 4,5 |
| apoio, campo | `apoio` | `campo` | 4,5 |
| sutil, chão | `sutil` | `fundo` | 4,5 |
| sutil, fundo suave | `sutil` | `fundo-suave` | 4,5 |
| sutil, campo | `sutil` | `campo` | 4,5 |
| link, aba ativa e botão discreto | `azul-texto` | `fundo` | 4,5 |
| o mesmo, no hover | `azul-texto` | `fundo-suave` | 4,5 |
| botão perigo e erro de campo | `vermelho-texto` | `fundo` | 4,5 |
| botão perigo, no hover | `vermelho-texto` | `fundo-suave` | 4,5 |
| laranja, selo e selecionado | `laranja-texto` | `laranja-claro` | 4,5 |
| azul, selo e selecionado | `azul-texto` | `azul-claro` | 4,5 |
| apoio, linha selecionada | `apoio` | `azul-claro` | 4,5 |
| sutil, linha selecionada | `sutil` | `azul-claro` | 4,5 |
| laranja, texto no chão | `laranja-texto` | `fundo` | 4,5 |
| laranja, texto no fundo suave | `laranja-texto` | `fundo-suave` | 4,5 |
| verde, texto no chão | `verde-texto` | `fundo` | 4,5 |
| verde, texto no fundo suave | `verde-texto` | `fundo-suave` | 4,5 |
| amarelo, texto no chão | `amarelo-texto` | `fundo` | 4,5 |
| amarelo, texto no fundo suave | `amarelo-texto` | `fundo-suave` | 4,5 |
| roxo, texto no chão | `roxo-texto` | `fundo` | 4,5 |
| roxo, texto no fundo suave | `roxo-texto` | `fundo-suave` | 4,5 |
| turquesa, texto no chão | `turquesa-texto` | `fundo` | 4,5 |
| turquesa, texto no fundo suave | `turquesa-texto` | `fundo-suave` | 4,5 |
| anil, texto no chão | `anil-texto` | `fundo` | 4,5 |
| anil, texto no fundo suave | `anil-texto` | `fundo-suave` | 4,5 |
| lima, texto no chão | `lima-texto` | `fundo` | 4,5 |
| lima, texto no fundo suave | `lima-texto` | `fundo-suave` | 4,5 |
| rosa, texto no chão | `rosa-texto` | `fundo` | 4,5 |
| rosa, texto no fundo suave | `rosa-texto` | `fundo-suave` | 4,5 |
| verde, selo e selecionado | `verde-texto` | `verde-claro` | 4,5 |
| amarelo, selo e selecionado | `amarelo-texto` | `amarelo-claro` | 4,5 |
| vermelho, selo e selecionado | `vermelho-texto` | `vermelho-claro` | 4,5 |
| roxo, selo e selecionado | `roxo-texto` | `roxo-claro` | 4,5 |
| turquesa, selo e selecionado | `turquesa-texto` | `turquesa-claro` | 4,5 |
| anil, selo e selecionado | `anil-texto` | `anil-claro` | 4,5 |
| lima, selo e selecionado | `lima-texto` | `lima-claro` | 4,5 |
| rosa, selo e selecionado | `rosa-texto` | `rosa-claro` | 4,5 |
| laranja, sobre a face | `sobre-cor` | `laranja` | 4,5 |
| azul, sobre a face | `sobre-cor` | `azul` | 4,5 |
| verde, sobre a face | `sobre-cor` | `verde` | 4,5 |
| amarelo, sobre a face | `sobre-cor` | `amarelo` | 4,5 |
| vermelho, sobre a face | `sobre-cor` | `vermelho` | 4,5 |
| roxo, sobre a face | `sobre-cor` | `roxo` | 4,5 |
| turquesa, sobre a face | `sobre-cor` | `turquesa` | 4,5 |
| anil, sobre a face | `sobre-cor` | `anil` | 4,5 |
| lima, sobre a face | `sobre-cor` | `lima` | 4,5 |
| rosa, sobre a face | `sobre-cor` | `rosa` | 4,5 |
| aviso de informação, corpo | `tinta` | `azul-claro` | 4,5 |
| aviso de atenção, corpo | `tinta` | `amarelo-claro` | 4,5 |
| aviso de erro, corpo | `tinta` | `vermelho-claro` | 4,5 |
| aviso de certo, corpo | `tinta` | `verde-claro` | 4,5 |
| botão primário, hover | `sobre-cor` | `caramelo-claro` | 4,5 |
| botão oficial | `sobre-grafite` | `grafite` | 4,5 |
| botão oficial, hover | `sobre-grafite` | `noite-alto` | 4,5 |
| estado pendente | `pendente` | `pendente-cx` | 4,5 |
| estado ok | `ok` | `ok-cx` | 4,5 |
| estado erro | `erro` | `erro-cx` | 4,5 |
| estado info | `info` | `info-cx` | 4,5 |
| selo de IA | `ia` | `ia-cx` | 4,5 |
| erro como texto | `erro` | `fundo` | 4,5 |
| laranja como texto | `caramelo-texto` | `fundo` | 4,5 |
| tinta, realce | `tinta` | `realce` | 4,5 |
| sutil, realce | `sutil` | `realce` | 4,5 |
| tinta, realce suave | `tinta` | `realce-suave` | 4,5 |
| sutil, realce suave | `sutil` | `realce-suave` | 4,5 |
| balão de quem escreve | `tinta` | `fundo-suave` | 4,5 |
| tinta, painel da entrada | `tinta` | `papel` | 4,5 |
| sutil, painel da entrada | `sutil` | `papel` | 4,5 |
| borda de campo, chão | `borda-campo` | `fundo` | 3 |
| borda de campo, campo | `borda-campo` | `campo` | 3 |
| interruptor ligado | `azul-degrau` | `fundo` | 3 |
| anel de foco, chão | `foco` | `fundo` | 3 |
| anel de foco, fundo suave | `foco` | `fundo-suave` | 3 |
| anel de foco, selecionado | `foco` | `azul-claro` | 3 |
| botão primário | `sobre-cor` | `caramelo` | 4,5 |
| botão primário pressionado | `sobre-cor` | `caramelo-fundo` | 4,5 |
| botão oficial de antes | `sobre-grafite` | `noite` | 4,5 |
| botão oficial de antes, apertado | `sobre-grafite` | `noite-baixo` | 4,5 |
| texto selecionado | `tinta` | `laranja-borda` | 4,5 |
| aprovado, texto no chão | `ok` | `fundo` | 4,5 |
| pendente, texto no chão | `pendente` | `fundo` | 4,5 |
| perigo cheio de antes | `sobre-grafite` | `erro` | 4,5 |
| desligado da D80 | `apoio` | `borda` | 4,5 |
| desligado de antes | `tinta` | `inativo` | 4,5 |

O anel de foco tem token próprio, `foco`, com o valor do `azul-texto`. O desligado da D80 é a face `borda`
com texto `apoio`: com `sutil` ele não chega a 4,5:1 no escuro. Os pares "de antes" são os das telas que
ainda não foram recompostas, e saem da tabela com a última delas.

### 9.2 Tipografia

**A fonte do sistema**: `ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial,
sans-serif`. No Chromebook ela cai na fonte do ChromeOS, sem baixar nada. O logotipo vem em curvas:
**o produto não serve nenhuma fonte** (regra 50). **Dois pesos**: 500 no corpo e 700 no resto; onde
a fonte do sistema não tem o 500, o navegador usa o regular.

| Classe | Tamanho / altura | Peso | Caixa | Onde |
|---|---|---|---|---|
| `t-titulo` | 24 / 30 px | 700 | −0,01em | O `h1` de toda tela |
| `t-secao` | 20 / 26 px | 700 | | Título de seção, de diálogo e de painel ao lado |
| `t-balao` | 20 / 26 px | 500 | | A fala no balão da introdução (X4) |
| `t-cartao` | 17 / 22 px | 700 | | Título de cartão, de linha e de aviso |
| `t-corpo` | 17 / 25 px | 500 | | Corpo: conversa, formulário, texto do aluno |
| `t-apoio` | 15 / 20 px | 500 | | Segunda linha e dica, em `sutil` |
| `t-rotulo` | 15 / 18 px | 700 | caixa-alta, 0,04em | Rótulo de botão, de lugar da lateral e de aba |
| `t-selo` | 13 / 16 px | 700 | caixa-alta, 0,04em | Selo, cabeçalho de tabela, título de grupo, o "voltar" |
| `t-numero` | 28 / 32 px | 700 | `tabular-nums` | Número de painel |
| `t-numero-g` | 36 / 40 px | 700 | `tabular-nums` | Número em destaque |

- **O piso é 14 px.** 13 px só em `t-selo`; 12 px só no rótulo da barra de baixo do celular. A
  etiqueta de 11 px do mockup não entra
- **A caixa-alta é do CSS**: o texto vai escrito normal, para o leitor de tela
- Na área do aluno o corpo nunca desce de 16 px (o leitor tem 11 anos, D43). Coluna de leitura de
  até 72 caracteres
- As telas ainda não recompostas ficam com os tamanhos de hoje até a spec da área; o título delas
  já é `t-titulo` (11.2)

### 9.3 Forma, espaço e elevação

- **Borda de 2 px** em toda peça, em `borda`. É ela, e não uma sombra, que separa a peça do chão
- **Canto:** 8 px em selo e célula · 12 px em botão, campo, opção, aviso e lugar da lateral (10 px
  em item de menu) · 16 px em cartão, tabela, diálogo, menu e caixa de pedido · 20 px no alto da
  folha de baixo · círculo em botão só de ícone, avatar e contador
- **O degrau** é a marca de que a peça se aperta: uma faixa sólida embaixo dela. No toque a peça
  desce e a faixa encolhe; o espaço fica reservado, e nada em volta se mexe. Peça de leitura não
  tem degrau, e peça desligada perde o dela. É uma classe só, `degrau`, para `<button>` e `<a>`:
  sombra sólida de `--altura-degrau` na cor `--lado`, margem de baixo igual e `translateY` no
  apertado. A cor vem de seis classes fixas (`degrau-laranja`, `degrau-grafite`, `degrau-borda`,
  `degrau-vermelho`, `degrau-vermelho-borda` e `degrau-azul`): cada uma é o token `<família>-degrau`, menos
  `degrau-borda` (a `borda`) e `degrau-vermelho-borda` (a `vermelho-borda`, do `perigo`, que tem a borda da família).
  O botão só de ícone põe `--altura-degrau` em 3 px, e o resto fica em 4

| Peça | Face | Degrau | Desce |
|---|---|---|---|
| Botão `principal` · `compacto` | 44 · 36 px (o `compacto`, 44 abaixo de 768) | 4 | 4 |
| Botão só de ícone, `Toque` | 40 px (o botão, também 44 e 48) | 3 | 3 |
| Cartão clicável, `Opcao` (no mínimo 64 px), seletor de escola (48 px) | livre | 4 | 2 |

- **Elevação: nenhuma sombra com desfoque.** O que flutua tem a borda de 2 px e um degrau sólido
  de 4 px em `borda` (`shadow-flutua`), sobre o `veu` quando é modal
- **Margem da página:** 16 px no celular e 32 px a partir de 768 px. Do topo ao cabeçalho, 24 px;
  do cabeçalho ao corpo, 16 px; fim do corpo, 32 px
- **Vãos**, na grade de 4 px: 16 px entre blocos e entre cartões · 16 px dentro do cartão (20 px a
  partir de 768 px) · 8 px entre os lugares da lateral · 12 px do título de seção ao bloco · 24 px
  entre as mensagens da conversa
- **Largura.** Toda página fica numa **moldura de 1200 px**, e a coluna começa na borda esquerda
  dela, para o título não pular ao trocar de lugar. São quatro tipos de página (11.2):

| Tipo de página | Coluna | Na `Tela` |
|---|---|---|
| Conversa | 768 px | `conversa` (era 760) |
| Leitura | 880 px | `leitura`, nova |
| Painel | 1200 px, a moldura inteira | `grade` (era 1480) |
| Documento | 1080 px, com a folha de 760 px | nasce na X3 |

  A largura `formulario`, de 1040 px, continua nas telas de formulário de hoje
- **A tela de trabalho ocupa a altura da janela e rola por dentro**; no celular a página inteira
  rola, e o rodapé de ação fica preso embaixo
- **Grade CSS com `minmax(0, 1fr)`**, nunca `1fr` sozinho: com texto que não quebra, a coluna
  estoura a 360 px (P02)
- **Altura de controle:** alvo de 44 px em toda ação principal e em tudo no celular (regra 50,
  item 2a); o botão `compacto` é de barra e de linha, no computador
- **Fora:** sombra borrada, vidro fosco (`backdrop-filter`), degradê, brilho de borda, fundo em
  canvas, WebGL ou shader. Custam quadro no Chromebook e não dizem nada

### 9.4 Ícones

Dois conjuntos, e nenhum outro.

**Ilustrados, desenhados por nós** (D80, item 4), onde o ícone identifica um lugar ou uma
categoria. SVG de 48 × 48, chapado, de duas a três cores, sem contorno, sem degradê e sem sombra.
A cor dominante é a face da família, lida do token, e o papel e as linhas são `icone-papel` e
`icone-linha`: nenhum hex dentro do ícone, e por isso ele acompanha o tema. De 24 a 48 px. São 48:

| Grupo | Ícones (família) | Nasce |
|---|---|---|
| Lugares (12) | início (laranja), tarefas (azul), eu (verde), avisar (roxo), turmas (turquesa), agenda (vermelho), criados (amarelo), escola (azul), ia (anil), registros (amarelo), rede (anil), painel (anil) | X1: início, turmas e tarefas, que ilustra Atividades. Os outros, com o lugar de cada um |
| Ações (1) | os quatro quadradinhos, que ilustram Ferramentas | X1 |
| Fila (13) | um por tipo de item, na família do tipo | Com o sino (X2 e X3) |
| Tarefas (3) · Matérias (13) | prova, lista e leitura, e uma por matéria, na família dela | Com a tela que os mostra (X3 e X4) |
| Métricas (6) | alunos, tutor, aprovado, acerto, pacote, corrigidas | Com o painel que mostra o número (X2) |

Os quatro da X1 se chamam `inicio`, `turmas`, `tarefas` (que ilustra Atividades) e `ferramentas` (os
quatro quadradinhos, que o mockup chama `mais`). O visto de `tarefas` é feito de dois retângulos de
ponta redonda, para toda forma pintar por `fill-*`. O `Icone` tem cinco tamanhos: 24, 28, 32, 40 e 48.

Lugar que a D80 não ilustrou (o Eu do aluno, que tomou o lugar de Minha turma) usa o ícone do
`lucide` num `Ladrilho`, até a spec da área. Os ícones de lugar moram na entrada e somam até
4 kB em brotli; acima disso saem dela para um `.svg` gerado pelo build, importado por URL, com hash
no nome e teto próprio no `.size-limit.json` (`lugares-*.svg`, 6 kB em brotli). Nunca um arquivo de
`public/`, que não tem hash nem entra em medição. Medido na X1: os quatro ícones pesam 484 bytes em
brotli, no HTML renderizado.

**`lucide-react`** no resto, importado ícone a ícone: traço de 2,5 px; 16 px em selo, 18 px em item
de menu, 20 px em botão.

- **Na navegação, ícone sempre com rótulo.** No trilho, o lugar tem nome acessível e dica
- Botão só de ícone leva `aria-label`, e a dica não é o único jeito de descobrir o que ele faz
- Logo de terceiro (Google e Microsoft na entrada) vem em SVG, na regra de marca de cada um

### 9.5 Movimento

| Token | Duração | Curva | Para |
|---|---|---|---|
| `t-toque` | 100 ms | linear | A peça com degrau descendo e voltando |
| `t-estado` | 150 ms | `curva-estado` | A bolinha do interruptor, o chevron da linha no hover |
| `t-gesto` | 260 ms | `curva-estado` | Abrir menu, diálogo e painel ao lado |
| `t-entrada` | 420 ms | `curva-entrada` | Mensagem nova na conversa, passo da introdução |

1. **Só `transform` e `opacity` animam.** Cor, borda e sombra trocam na hora, e o teste do CSS
   servido confere as propriedades animadas (RF8 da X1)
2. **Só CSS.** Nenhuma biblioteca de animação entra, nem `tw-animate-css`: a abertura do menu, do
   diálogo e do painel ao lado é regra nossa
3. **Nenhum laço.** Nada na tela se mexe sozinho, nem para mostrar trabalho acontecendo: os três
   pontos de "pensando" e o esqueleto de carregamento são parados, e o CSS servido não tem `infinite`
   (D59)
4. **Do mockup não entram**: o hover com `filter: brightness()`, que repinta a face; a largura da
   lateral animada, que recalcula a página (ela recolhe seca); a transição de linhas de grade na
   caixa de pedido; o `zoom` na página; e a onça piscando por temporizador
5. **Texto da IA chega em fluxo, sem efeito por letra.** Enquanto chega, o enviar vira "Parar"
6. **`prefers-reduced-motion`** desliga tudo o que desloca, por uma regra global: sobra só a troca
   de opacidade
7. **A comemoração** aparece uma vez, só na **entrega** de uma tarefa, nunca em nota, em acerto ou
   em tempo de uso, e some com `prefers-reduced-motion` (D80, item 7; D59). Nasceu na X4, com o
   parecer do `conformidade-reviewer` (seção 7). O salto é o da onça, `onca-comemorar` (500 ms,
   `ease-out`; 9.7), e não um token desta tabela. A barra de progresso não anima: o preenchimento
   é desenho parado
8. **Área do aluno:** sem número subindo, sem selo de conquista, sem nada que premie ficar (D59)

### 9.6 A marca na interface

- **A pinta e "Turmma"** no topo da lateral, com 24 px de altura; no trilho, só a pinta de 36 px, e
  na barra de topo do celular, de 28 px. O logotipo é SVG em curvas e é link para a página inicial
  do papel ("Turmma, página inicial")
- A pinta é laranja, e **não gira, não estica e não troca de cor** fora das versões do manual. Não
  vira indicador de carregamento
- **A turma se reconhece pela cor da matéria**, no selo e no ladrilho, e não por um avatar próprio:
  a proposta de uma pinta por turma sai
- Nenhuma tela tem textura de fundo. A pinta grande e apagada do painel da casca pública saiu em 30/10/2026: o lugar
  passou para a onça da marca (9.7, 11.3; D80 revista)

### 9.7 A onça e o avatar dos agentes

**Decidido** (D80, item 3). A onça da marca é a mascote do produto e o avatar dos três agentes. É
um **animal desenhado**, em três formas, sem contorno e sem degradê. As cores dela são fixas nos
dois temas: pelagem `#E8732E`, sombra `#D75F18`, realce `#ED935D`, creme `#FDEBDD`, roseta
`#7A3412`, pupila `#16233E`, olho `#FFFFFF`, nariz `#E5838C` e língua `#FF9FB0`.

**O traço é o do mockup de outubro, copiado e não importado** (correção `2026-10-28-onca-do-mockup`): o corpo e a
cabeça numa forma só, as orelhas com miolo, a máscara clara de dois círculos, os olhos com pupila recortada e brilho, o
focinho com o nariz arredondado, as cinco rosetas (a pinta da marca girada, declarada uma vez por desenho), o rabo com anéis e a
pata com o punho. Um teste guarda as impressões do traço e reprova a cópia que se afastar dele
(`componentes/ui/onca/fidelidade-ao-mockup.test.tsx`). Desde 30/10/2026 ele guarda a onça do produto, e não "a do
mockup": mudá-la pede decisão do Joaquim e o parecer do `conformidade-reviewer`, com os valores do teste atualizados na
mesma correção (D80 revista).

**O rosto da onça de corpo inteiro muda com a pose, e só com ela**: acenando (olhos de frente, boca aberta), apontando (olhar de
lado, sorriso), comemorando (olhos felizes, boca bem aberta) e pensando (olhar para cima e de lado, boca de lado). O rosto da
**cabeça do avatar** é um só, o neutro — olhos de frente e a boca em "w" —, em todos os tamanhos. A expressão nasce da pose
que a tela escolhe, nunca de quem usa.

**O movimento é pouco, e nada fica em laço** (parecer do `conformidade-reviewer` na correção `2026-10-28-onca-do-mockup`; D59;
regra 70, item 4b). Vem do `Onca.css`, copiado do mockup, e são três, cada um **uma vez**: **entrar** na tela (240 ms), **acenar**
(a pata, na primeira vez desde que a página abriu, e só enquanto a pose é `acenando`: a marca de que já acenou fica na
memória da página, e não no navegador, de modo que recarregar acena de novo e quem entra depois no mesmo computador não
herda nada) e o **salto da comemoração** (500 ms; é o único salto da
`Comemoracao`, que não põe outro por cima). Os três **param com `prefers-reduced-motion`**, e o avatar nunca se mexe. **Não
entram**, por veto: a onça piscando por temporizador, e o laço dos três pontos do `pensando`, que ficam **parados**. A sombra do
chão sob a onça de corpo inteiro é do cenário, o token `onca-chao` (9.10), e não uma das cores dela. As **duas linhas curtas ao lado
da pata que acena** são traço parado, na cor da sombra (correção `2026-10-28-onca-do-mockup-v3`). O mockup tem ainda `acolhendo` e
`dormindo`, a cabeça feliz do avatar e as pintas que voam: nada disso entra (D80, item 3).

**O avatar** (`AvatarAgente`) é a cabeça da onça num círculo `fundo`, com anel de 2 px na cor do
agente: **Tutor `laranja`, Assistente de ensino `azul`, Analista de desempenho escolar `anil`**. O
círculo com o ícone da função sai das telas. O avatar é `aria-hidden` e **só aparece com o nome da
função e o selo "IA" visíveis no mesmo bloco**. Isso é garantido por estrutura, e não por
combinado: só a `AssinaturaIA` o desenha (o balão de `MensagemIA` a usa como cabeçalho, e a tela
Agentes a usa com o nome da função em `h2`), e um teste reprova outro arquivo que importe o avatar
ou qualquer coisa da pasta da onça. O bloco é o `data-assinatura`, e o teste confere que cada
`data-agente` tem, nele, o nome da função em texto visível e um `data-selo-ia`. O cartão de cada
agente na tela Agentes leva `data-cartao-do-agente`, e não `data-agente`, que é só do avatar.
A casca da escola não desenha a onça nem o avatar do agente, e a lateral não leva mais
agentes (o grupo "Seu time" saiu na X3). As funções do Assistente não têm avatar próprio, e aparecem pelo nome ("Assistente · correção de objetiva").
Tamanhos: 24 px na linha da mensagem, 32 na assinatura, 40 e 48 no cabeçalho.

O avatar é **um desenho só por agente, com uma expressão neutra, parado**. As props são o agente e
o tamanho. Não tem pose, "pensando", temporizador nem animação, e não muda com quem usa: nem com a
presença, nem com a ausência, nem com acerto, erro, tempo de uso ou assunto da conversa.

**A onça de corpo inteiro não aparece na X1.** Cada pose e cada lugar entram na spec ou na correção que os usa, com parecer
próprio do `conformidade-reviewer`, e nenhuma pisca, acena em laço ou reage a quem usa.

**O critério da assinatura (correção `2026-10-28-onca-do-mockup-v3`).** A onça de corpo inteiro vai sempre assinada pela função e com o
selo "IA", e por isso **só entra numa região que guarda produção daquele agente**: o vazio da lista do que o Assistente gera, por exemplo.
Não entra onde a IA não produziu o que a tela mostra (um roteiro fixo da escola, a resposta de acesso "não está disponível", a região das
correções aprovadas pelo professor), nem para dar estado a um agente: a pose `pensando` não simula processamento onde nada processa, e a
`dormindo` (cansaço, sono) não reage ao teto de uso de ninguém (D58, D59; regra 70, itens 4a e 4b). Lugar novo entra na lista fechada de
`avatar-so-nas-duas-pecas.test.ts`, com parecer.

| Pose | Onde | Nasce |
|---|---|---|
| Apontando | O vazio "Nada gerado ainda" de Criados, assinado pelo Assistente de ensino, parado e de 120 px | correção `2026-10-28-onca-do-mockup-v3`, com parecer |
| Dormindo | — | não entra: o vazio "Tudo em dia" do sino segue sem mascote, e a pausa do Tutor segue com ícone (D80, item 3) |
| Acenando · apontando · pensando | Os passos da introdução (pensando: o passo da letra, com os três pontos parados) | X4, tarefa 5.0, com parecer dado; `pensando` e o movimento (entrar e acenar, uma vez), na correção `2026-10-28-onca-do-mockup`, com parecer |
| Comemorando | A entrega de uma tarefa (9.5, regra 7) | X4, tarefa 5.0, com parecer dado, nas condições da Parte B, item "A comemoração na entrega e a onça acolhendo" |
| Acolhendo (expressão de preocupação) | — | não entra (D80, item 3) |
| Acenando, **da marca** | O painel da casca pública (11.3): de 1024 px para cima, 160 px, centrada, entra e acena uma vez; no celular, 88 px e parada, acima do formulário. Sem legenda | a correção da onça na entrada, com parecer (D80 revista em 30/10/2026, à noite) |

O que a onça **nunca** é, em nenhuma spec (D58; Decreto 12.880, art. 11; regra 70, item 4a):

- **Nunca tem nome próprio.** Quem assina é a função: "Tutor", "Assistente de ensino"
- **Nunca tem traço de pessoa**: sem roupa, sem mão humana, sem rosto de gente, sem foto
- **Nunca fala de afeto nem de si**: não diz que sente, que sentiu falta, que ficou triste ou
  orgulhosa. Nenhum texto é atribuído à onça, e "onça" nunca é o nome acessível de um agente. A
  fala ao lado dela é a do agente, na primeira pessoa da função (9.8)
- **Nunca é agressiva**, e **nunca fica "online"**: ponto ao lado do avatar só diz que há algo
  esperando a pessoa (D59)

**A onça da marca (D80 revista em 30/10/2026, à noite).** Há duas onças, com fronteira escrita. A **onça-agente** é a de
toda a seção: sempre assinada e só onde a região guarda produção do agente. A **onça da marca** mora só no painel da casca
pública (11.3), em todas as telas dela e igual para todo papel. É uma peça própria, que desenha a onça sem `figcaption`, sem
nome, sem selo e sem texto acessível, e é `aria-hidden`. A `Onca` continua exigindo `agente`, e a onça da marca nunca entra em
área de papel nem em região de agente. A pose é sempre `acenando`. O movimento é o que já existe (entrar e acenar uma vez, que
somem com `prefers-reduced-motion`), e nenhum laço entra, também aqui. Nenhum texto fica ao lado dela. A lista fechada de
`avatar-so-nas-duas-pecas.test.ts` a nomeia, e um teste prova que a figura dela não tem texto acessível nem `figcaption`.
O atributo dela é `data-onca-da-marca`, e não `data-onca`, que é da onça assinada: nenhuma conta de "onça de agente" a conta.
**O aceno da marca é dela**: a memória de "já acenou" é separada da da onça-agente. A entrada leva à introdução do papel sem
recarregar a página, e a onça da introdução ainda acena depois da da entrada, mesmo a 360 px, onde a de 160 px, escondida só pelo
CSS, também é montada. Se o pedaço da onça não carregar, a casca fica sem ela, com as caixas no lugar, e o formulário continua.

A onça fica fora do primeiro carregamento (10.4), e o caminho da pinta, que as rosetas repetem, é
declarado uma vez, e não copiado em cada avatar.

### 9.8 Tom da interface

- **Frase curta, verbo na frente, sem ponto de exclamação e sem "Ops".** "Salvo em Criados."
  "Não foi possível salvar. Tente de novo em instantes."
- **O agente fala na primeira pessoa da função** e diz o que fez e o que espera: `Corrigi
  "Atividade de estequiometria" da turma 7ºA. O diagnóstico só chega aos alunos depois que você revisar os
  destaques e aprovar.` Nunca simula afeto ("senti sua falta") nem
  pressa ("só hoje") (D58, D59)
- **Botão diz o que acontece**, com o objeto: "Aprovar 32 correções", não "Confirmar"; "Exportar
  em PDF", não "OK"
- **Vazio convida:** "Nenhuma prova ainda. Peça uma ao Assistente de ensino ou abra a ferramenta
  Prova." (regra 50, item 5)
- **Aluno:** palavra de 11 anos, frase de até doze palavras, sem jargão, sem ironia. "O Tutor é um
  programa de computador. Ele pode errar. Seu professor vê como você usa."
- **Número, data e hora** no formato local; autonomia de agente em português comum ("faz e
  avisa", "prepara e espera você"), nunca "nível 2"

### 9.9 Os tokens, como entram no código

Os tokens moram na **9.10**: os dois blocos de lá são o `estilos.css`, e os testes de token leem aquela
seção. Aqui fica a regra que vale para toda classe de cor.

**Modificador de opacidade em cor não entra** (`bg-tinta/80`, `text-apoio/50`). Conferido no
Tailwind 4.3.3 do repositório: ele vira `color-mix()` nos dois ramos que o Tailwind gera, e
`color-mix()` só existe a partir do Chrome 111. No Chrome 109 do laboratório a declaração é
descartada: o hover não muda, e o fundo escurecido do diálogo simplesmente não aparece.

No lugar dele, troca-se por token em hex (os hovers já têm o deles) ou pelo `veu`, em hex de oito
dígitos, no fundo de diálogo. `estilos.test.ts` reprova a classe com modificador, o build para quando sobra
`color-mix(` ou `oklch(` no CSS (`rebaixar-cor.ts`), e o e2e reprova as duas no CSS servido.

### 9.10 Os tokens da D80

Os dois blocos abaixo são o `estilos.css` da X1. A tarefa 1.0 os copia para o código, e a partir
dela `estilos.test.ts` e `e2e/tokens.spec.ts` leem **esta** seção: nome ou valor diferente entre o
documento e o CSS reprova.

O primeiro é o tema claro: os 33 nomes de hoje, com valor novo onde a D80 mudou (`lateral`,
`linha`, `radius-caixa` e as duas sombras), mais os nomes novos. `static` faz o Tailwind emitir
todas as variáveis, e não só as que alguma classe usa: as peças leem a cor da família por
variável. `veu` e `onca-chao` são as únicas cores fora do hex de seis dígitos: são hex de oito, com a transparência no fim.

```css
@theme static {
  --color-*: initial;
  --color-white: #ffffff;
  --color-black: #000000;

  /* chão e estrutura */
  --color-fundo: #ffffff;
  --color-fundo-suave: #f7f7f7;
  --color-campo: #ffffff;
  --color-mesa: #f7f7f7;
  --color-borda: #e5e5e5;
  --color-borda-forte: #d7d7d7;
  --color-borda-campo: #8f8f8f;
  --color-apagado: #afafaf;
  --color-icone-papel: #efefef;
  --color-icone-linha: #d7d7d7;
  --color-foco: #146eaa;
  --color-veu: #00000059;
  --color-onca-chao: #afafaf4d;
  /* texto */
  --color-tinta: #0d0d0d;
  --color-apoio: #424242;
  --color-sutil: #5d5d5d;
  --color-sobre-cor: #0d0d0d;
  /* a decisão oficial */
  --color-grafite: #333333;
  --color-grafite-degrau: #0d0d0d;
  --color-sobre-grafite: #ffffff;
  /* as dez famílias: face, degrau, claro, borda e texto */
  --color-laranja: #e8732e;
  --color-laranja-degrau: #ba5c25;
  --color-laranja-claro: #fdebdd;
  --color-laranja-borda: #f5c0a1;
  --color-laranja-texto: #a85220;
  --color-azul: #1c9bef;
  --color-azul-degrau: #167cbf;
  --color-azul-claro: #dff1fd;
  --color-azul-borda: #99d2f8;
  --color-azul-texto: #146eaa;
  --color-verde: #2fbf5b;
  --color-verde-degrau: #269949;
  --color-verde-claro: #e2f6e8;
  --color-verde-borda: #a1e2b5;
  --color-verde-texto: #1f7c3b;
  --color-amarelo: #ffc31f;
  --color-amarelo-degrau: #e0a000;
  --color-amarelo-claro: #fff7e0;
  --color-amarelo-borda: #ffe49a;
  --color-amarelo-texto: #8c6b11;
  --color-vermelho: #f2545b;
  --color-vermelho-degrau: #c24349;
  --color-vermelho-claro: #fde7e8;
  --color-vermelho-borda: #f9b2b5;
  --color-vermelho-texto: #b84045;
  --color-roxo: #a56ef5;
  --color-roxo-degrau: #8458c4;
  --color-roxo-claro: #f2ebfe;
  --color-roxo-borda: #d6befa;
  --color-roxo-texto: #7d54ba;
  --color-turquesa: #1dbfae;
  --color-turquesa-degrau: #17998b;
  --color-turquesa-claro: #dff6f4;
  --color-turquesa-borda: #99e2db;
  --color-turquesa-texto: #137a6f;
  --color-anil: #6a85f7;
  --color-anil-degrau: #556ac6;
  --color-anil-claro: #eaeefe;
  --color-anil-borda: #bcc8fb;
  --color-anil-texto: #5165bc;
  --color-lima: #9acd2e;
  --color-lima-degrau: #7fb01c;
  --color-lima-claro: #f1f8e2;
  --color-lima-borda: #d2e8a1;
  --color-lima-texto: #59771b;
  --color-rosa: #f57cb5;
  --color-rosa-degrau: #c46391;
  --color-rosa-claro: #feedf5;
  --color-rosa-borda: #fac4de;
  --color-rosa-texto: #a25277;
  /* os nomes de antes da D80, que as telas ainda usam (9.1) */
  --color-superficie: #ffffff;
  --color-lateral: #ffffff;
  --color-linha: #e5e5e5;
  --color-realce: #ececec;
  --color-realce-suave: #f4f4f4;
  --color-creme: #f4f4f4;
  --color-papel: #f4f3f0;
  --color-inativo: #8f8f8f;
  --color-caramelo: #e8732e;
  --color-caramelo-claro: #ee8747;
  --color-caramelo-fundo: #d4651f;
  --color-caramelo-texto: #b4520f;
  --color-caramelo-noite: #f2a25b;
  --color-noite: #0d0d0d;
  --color-noite-alto: #2f2f2f;
  --color-noite-baixo: #000000;
  /* estado: fundo e texto */
  --color-pendente-cx: #fdf0e8;
  --color-pendente: #8a3e0c;
  --color-ok-cx: #e9f5ee;
  --color-ok: #0b6b47;
  --color-erro-cx: #fdecec;
  --color-erro: #b42318;
  --color-info-cx: #f4f4f4;
  --color-info: #0d0d0d;
  --color-ia-cx: #f0f0f0;
  --color-ia: #424242;

  --font-corpo: ui-sans-serif, -apple-system, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-titulo: ui-sans-serif, -apple-system, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif;

  --radius-selo: 8px;
  --radius-linha: 10px;
  --radius-controle: 12px;
  --radius-botao: 12px;
  --radius-cartao: 16px;
  --radius-caixa: 16px;

  /* nenhuma sombra com desfoque: anel de 2 px e degrau sólido de 4 px */
  --shadow-caixa: 0 0 0 2px var(--color-borda);
  --shadow-flutua: 0 0 0 2px var(--color-borda), 0 4px 0 0 var(--color-borda);

  --t-toque: 100ms;
  --t-estado: 150ms;
  --t-gesto: 260ms;
  --t-entrada: 420ms;
  --curva-estado: cubic-bezier(0.2, 0, 0, 1);
  --curva-entrada: cubic-bezier(0.22, 1, 0.36, 1);
}
```

O segundo é o tema escuro: os mesmos nomes de cor, menos `white` e `black`. Fica **fora de
camada**, para vencer o `@layer theme` do Tailwind, e vale quando o `<html>` leva
`data-tema="escuro"` (11.1). As sombras leem `--color-borda` e mudam junto. A variante `dark:`
continua sem uso: nenhuma tela escreve cor por tema.

```css
:root[data-tema='escuro'] {
  color-scheme: dark;
  --color-white: #ffffff;
  --color-black: #000000;
  /* chão e estrutura */
  --color-fundo: #131f24;
  --color-fundo-suave: #202f36;
  --color-campo: #202f36;
  --color-mesa: #0e181c;
  --color-borda: #37464f;
  --color-borda-forte: #52656d;
  --color-borda-campo: #6b7f88;
  --color-apagado: #52656d;
  --color-icone-papel: #37464f;
  --color-icone-linha: #52656d;
  --color-foco: #60b9f4;
  --color-veu: #00000099;
  --color-onca-chao: #00000059;
  /* texto */
  --color-tinta: #f1f7fb;
  --color-apoio: #dce6ec;
  --color-sutil: #8fa3ad;
  --color-sobre-cor: #131f24;
  /* a decisão oficial */
  --color-grafite: #f1f7fb;
  --color-grafite-degrau: #8fa3ad;
  --color-sobre-grafite: #131f24;
  /* as dez famílias: face, degrau, claro, borda e texto */
  --color-laranja: #eb8447;
  --color-laranja-degrau: #ba5c25;
  --color-laranja-claro: #352c26;
  --color-laranja-borda: #734528;
  --color-laranja-texto: #ef9d6d;
  --color-azul: #37a7f1;
  --color-azul-degrau: #167cbf;
  --color-azul-claro: #143344;
  --color-azul-borda: #17577f;
  --color-azul-texto: #60b9f4;
  --color-verde: #48c76f;
  --color-verde-degrau: #269949;
  --color-verde-claro: #17392d;
  --color-verde-borda: #20673d;
  --color-verde-texto: #6dd28c;
  --color-amarelo: #ffc31f;
  --color-amarelo-degrau: #e0a000;
  --color-amarelo-claro: #393923;
  --color-amarelo-borda: #7d6922;
  --color-amarelo-texto: #ffd562;
  --color-vermelho: #f4696f;
  --color-vermelho-degrau: #c24349;
  --color-vermelho-claro: #37272d;
  --color-vermelho-borda: #77373d;
  --color-vermelho-texto: #f6878c;
  --color-roxo: #b07ff6;
  --color-roxo-degrau: #8458c4;
  --color-roxo-claro: #2a2c45;
  --color-roxo-borda: #554382;
  --color-roxo-texto: #c09af8;
  --color-turquesa: #38c7b8;
  --color-turquesa-degrau: #17998b;
  --color-turquesa-claro: #15393a;
  --color-turquesa-borda: #186762;
  --color-turquesa-texto: #61d2c6;
  --color-anil: #7c94f8;
  --color-anil-degrau: #556ac6;
  --color-anil-claro: #212f46;
  --color-anil-borda: #3a4d83;
  --color-anil-texto: #97aaf9;
  --color-lima: #9acd2e;
  --color-lima-degrau: #7fb01c;
  --color-lima-claro: #293b26;
  --color-lima-borda: #506d28;
  --color-lima-texto: #b8dc6d;
  --color-rosa: #f68cbe;
  --color-rosa-degrau: #c46391;
  --color-rosa-claro: #372e3b;
  --color-rosa-borda: #794965;
  --color-rosa-texto: #f8a3cb;
  /* os nomes de antes da D80, que as telas ainda usam (9.1) */
  --color-superficie: #131f24;
  --color-lateral: #131f24;
  --color-linha: #37464f;
  --color-realce: #202f36;
  --color-realce-suave: #202f36;
  --color-creme: #202f36;
  --color-papel: #202f36;
  --color-inativo: #52656d;
  --color-caramelo: #eb8447;
  --color-caramelo-claro: #ef9d6d;
  --color-caramelo-fundo: #d4651f;
  --color-caramelo-texto: #ef9d6d;
  --color-caramelo-noite: #f2a25b;
  --color-noite: #f1f7fb;
  --color-noite-alto: #dce6ec;
  --color-noite-baixo: #ffffff;
  /* estado: fundo e texto */
  --color-pendente-cx: #352c26;
  --color-pendente: #ef9d6d;
  --color-ok-cx: #17392d;
  --color-ok: #6dd28c;
  --color-erro-cx: #37272d;
  --color-erro: #f6878c;
  --color-info-cx: #202f36;
  --color-info: #f1f7fb;
  --color-ia-cx: #202f36;
  --color-ia: #dce6ec;
}
```

---

## 10. Peças

### 10.1 As peças são nossas

**O produto não usa Radix, shadcn nem catálogo de terceiro** (revê a direção de setembro, que
mandava vestir peças do 21st.dev). As dependências da web continuam sendo React, TanStack Query,
`wouter`, `lucide-react` e `qrcode-generator`: não entram `@radix-ui/*`,
`class-variance-authority`, `clsx`, `tailwind-merge` nem `tw-animate-css`. O mockup usa todas, e
por isso é referência de desenho, não de código. O primeiro carregamento tem teto (10.4), o
laboratório tem Chrome 109, e o produto já tem diálogo, menu e abas feitos à mão, com teste de
teclado.

1. **Teclado, foco e ARIA são nossos.** Cada peça declara o padrão que segue, e o teste o percorre:
   diálogo modal (foco preso, Esc, foco devolvido a quem abriu), menu, abas, grupo de rádio,
   interruptor e campo nativo. O que o mockup deixou de fora (Home e End, o `tabpanel`, o papel de
   grade na tabela) a peça do produto tem
2. **Um anel de foco só**: contorno de 3 px em `foco`, com 2 px de afastamento, em tudo o que
   recebe foco pelo teclado, nos dois temas. No campo de texto o afastamento é zero; na linha de
   tabela e no item da barra de baixo (que encosta no pé e nas laterais da janela) o anel vai por dentro. Nenhuma peça apaga o contorno sem passá-lo à moldura, nem depende de `:has()` para
   mostrá-lo: onde a moldura é maior que o campo (a opção de marcar, o formulário da ferramenta e a caixa de conversa do
   Tutor e do Assistente), o anel é da moldura, por `focus-within`, colado à borda, e o campo de dentro não desenha o seu
   (correção `2026-10-29-contorno-do-campo-de-conversa`). A única exceção é a face `noite` no escuro, onde ela é clara e o `foco` dá 1,99:1: ali o
   anel é o `sobre-grafite`, o texto da própria face (e volta ao `foco` dentro de peça com chão próprio)
3. **Os quatro estados** (regra 50, item 5). O mockup não fala com servidor e não desenha
   carregando nem erro: valem os três de `componentes/estado/`, e botão que dispara pedido não
   aceita o segundo clique
4. **Teste de componente por peça** (jsdom e testing-library): estados, nome acessível e teclado.
   E a **galeria** (`/galeria`) mostra cada peça com todos os estados, nos dois temas, e passa pelo
   axe nos projetos `chromebook` e `celular`
5. **Só token.** Nenhuma cor fora da 9.10, nenhum modificador de opacidade, nenhuma variante `dark:`
6. **Nada só no hover** (regra 50, item 2a): o que aparece ao passar o mouse aparece também no foco
   e fica sempre à vista no toque
7. **Peça revestida não muda de props.** A X1 troca o desenho por dentro, e a tela que a usa não é
   tocada: é o que deixa a pele entrar por baixo das telas

### 10.2 O catálogo das peças da X1

**R** é peça que já existe e é revestida, sem mudar props; **N** é peça nova, uma por arquivo, com
teste de componente. As medidas vêm do inventário do mockup; "(produto)" marca um desvio da 9.1.

**Ação**

| Peça | Desenho | Estados e teclado |
|---|---|---|
| `Botao` (R) | Canto 12, rótulo em `t-rotulo` numa linha, glifo de 20 px à esquerda. `principal`: face de 44 px. `compacto`: face de 36 px (44 abaixo de 768), letra de 14 | Hover troca a face; apertado desce o degrau, também no toque; desligado sem degrau, face `borda`, texto `apoio` |
| `Toque` (N) | Pílula com face de 40 px (44 abaixo de 768), borda 2, 15 px em 700. Escolhido em `azul-claro`, `azul-borda`, `azul-texto` | `aria-pressed`. É filtro e sugestão, não aba |
| `Menu` (R) | Caixa flutuante de canto 16, borda 2 e degrau 4 (a `shadow-flutua`), com a largura do `flutuante.ts`: 320 px, ou a janela menos as duas margens (produto: o mínimo de 224 px do mockup não entra, o menu de ferramenta e o de turma precisam dos 320). Item de 44 px, canto 10, 15 px em 500, glifo de 18 em `sutil` | Realçado em `fundo-suave`, perigoso em `vermelho-texto`. Desligado em `sutil`, sem realce, com `aria-disabled` (produto: a cor sozinha não o diria). Teclado de `teclado-do-menu.ts`; o Esc fecha só o menu, também dentro de um `Dialogo` ou do `PainelLado` |

Os seis desenhos do botão, e nenhum outro (RF5 da X1):

| Variante | Face | Degrau | Texto | Hover | Para |
|---|---|---|---|---|---|
| `primario` | `laranja` | `laranja-degrau` | `sobre-cor` | `caramelo-claro` | **A** ação de criar e pedir. No máximo um por tela |
| `oficial` | `grafite` | `grafite-degrau` | `sobre-grafite` | `noite-alto` | **Só decisão oficial**: aprovar, publicar, confirmar |
| `secundario` | `fundo`, borda `borda` | `borda` | `apoio` | `fundo-suave` | A alternativa, e as duas opções de uma escolha de peso igual |
| `discreto` | transparente | não tem | `azul-texto` | `fundo-suave` | Ação de linha, de barra, de cartão |
| `perigo` | `fundo`, borda `vermelho-borda` | `vermelho-borda` | `vermelho-texto` | `fundo-suave` | Recusar, excluir, revogar |
| `perigo` cheio | `vermelho` | `vermelho-degrau` | `sobre-cor` | não muda | Só o botão que confirma, dentro do diálogo |

A face e o degrau do `oficial` não são os de nenhuma outra variante, nos dois temas, e um teste
prova isso (RF6 da X1).

**Conter e listar**

| Peça | Desenho | Estados e teclado |
|---|---|---|
| `Cartao` (R) | Canto 16, borda 2, face `fundo`, 16 px por dentro (20 a partir de 768). De leitura, sem degrau. A cor de família vai no ladrilho e no selo de dentro, nunca no fundo inteiro | Clicável: degrau, hover `fundo-suave`. Selecionado: `azul-claro` com `azul-borda` |
| `Linha` (N) | A linha inteira clicável: mínimo de 64 px. Título em `t-cartao`, numa linha com reticências (o `title` guarda o texto inteiro; o título fixo e curto, que não pode sair cortado a 360 px, pede `tituloEmDuasLinhas` e quebra em até duas); embaixo, `t-apoio`; no fim, chevron de 20 em `apagado`, decoração. O fio de 2 px entre uma linha e a de cima é de quem junta as linhas, com `divide-y-2 divide-borda` na moldura (produto): a linha sozinha não sabe se é a primeira | Link, botão ou só leitura (sem foco e sem chevron). Hover `fundo-suave`; o anel de foco por dentro (−3 px) |
| `Tabela` (R) | Moldura de canto 16. Cabeçalho de 44 px em `t-selo`; linha de 64 px, 15 px em 500. Abaixo de 768 px cada linha vira um cartão | Linha ativa em `azul-claro`. Linha que abre: inteira, por Enter e espaço. Não ordena |
| `Abas` (R) | Linha de 44 px (produto: as abas de página do mockup, que levam o número; a de 48 px é a do mockup solta) sobre um fio de 2 px. Rótulo em `t-rotulo`, `sutil`; a ativa em `azul-texto`, com sublinhado de 3 px em `azul`. **Até três** | Teclado de `teclado-das-abas.ts`; `aria-selected` e `aria-controls` |
| `Tela` (R) | A moldura de toda tela, com o título e as larguras (11.2) | — |
| Os três de `estado/` (R) | Caixa de 2 px, título em `t-secao` e uma ação. O vazio tracejado (`borda-campo`) centraliza; o vazio de lista continua à esquerda (produto: ele mora dentro de lista e de cartão, e a tela é que recompõe). A onça só entra quando a tela a passa em `ilustracao` (9.7); a peça não a importa | Carregando é texto parado em `status`, sem pulso; o erro tem `alert` só na mensagem, e o botão e o "Tentando de novo…" ficam fora dele |

**Marcar e informar**

| Peça | Desenho | Estados e teclado |
|---|---|---|
| `Ladrilho` (N) | Quadrado de canto 12, fundo no `claro` da família, ícone a 72% do lado, com o `texto` da família como cor do `lucide` (`currentColor`). Seis tamanhos: 32, 36 (a caixa do ícone na lateral), 40, 44, 48 e 56 px | `role="img"` com rótulo; sem ele, `aria-hidden` |
| `Estado`, o selo (R) | 24 px de altura, canto 8, `t-selo`, glifo de 16. Neutro: `fundo-suave` com `apoio`. De família: `claro` com `texto`. As famílias de hoje (`pendente`, `ok`, `erro`, `info`) continuam | Sempre com texto ou glifo |
| `Contador` (N) | Pílula na face da família, texto `sobre-cor` em 700, tabular, de 24 px (produto: um tamanho só) | O que ele conta é texto escondido depois do número (produto: não `role="img"`, para a aba e a linha lerem o mesmo texto). Sem item, não aparece, e não pisca |
| `Aviso` (N) | Canto 12, borda 2 na `borda` da família, fundo `claro`, sem degrau. Glifo num círculo de 28, uma forma por tom. Título em `t-cartao`; corpo em 15 / 21 px, `tinta`. Informação azul, atenção amarelo, erro vermelho, certo verde | `role="alert"` só no erro, e só no texto dele (a ação fica fora). Os outros três tons não têm papel vivo (produto: o `status` do mockup em texto parado é ruído). Não fecha |
| `Faixa` (R) | O aviso permanente, que não fecha (D8), na família `info` | `role="note"`. Não tem botão |
| `BarraRotulada` (R) | Trilho em `ia-cx` (produto), de 12 px e ponta redonda, com o enchimento em `sutil`: a mesma cor nos dois, vazia ou cheia. O texto ("2 de 8") vai fora. Só mede o que tem fim | Só desenho, `aria-hidden` (produto): o valor está escrito ao lado, e `role="progressbar"` o diria duas vezes. Barra de acerto é neutra |
| `NumeroPainel` (R) | O valor em `t-numero`, o rótulo em `t-selo`, `sutil` | Sem variação "boa" ou "ruim" em cor |
| As de `componentes/ui/ia/` (R) | O avatar da 9.7; o nome da função em 15 px e 700; o selo "IA" neutro; o chip de página, pílula de 28 px com borda de 2 px e sem degrau (corre dentro da linha de texto); o chip "da web", com a borda tracejada, que **nasce com a busca na web (F9, D68)**: hoje nenhuma citação vem da web, e a peça não desenha o que não tem dado; a linha de quem aprovou, em `ok`. As duas opções da `Escolha` são uma constante só: borda de 2 px e degrau `borda`, nenhuma na face do primário nem na do oficial. A `CaixaPedido` mede o texto de exemplo, quando vazia, num espelho fora do campo (o campo em uso nunca é escrito, e o desfazer do navegador fica inteiro), para ele aparecer inteiro a 360 px. O "Tentar de novo" do `AvisoFila` é `secundario`: é uma tentativa dentro da conversa, que não decide nada e convive com o primário da caixa de pedido; o `EstadoErro` de página, que é a única ação da tela, usa o primário laranja | O chip abre por clique e por teclado |

**Formulário**

| Peça | Desenho | Estados e teclado |
|---|---|---|
| `Campo`, `CampoDeSenha`, `CampoLongo`, `Selecao` (R) | 48 px (o longo, no mínimo 96), canto 12, borda 2 em `borda-campo` (produto), fundo `campo`, 17 px em 500. Rótulo de 15 px em 700; dica em `t-apoio` | Foco: o anel, colado à borda (produto). Inválido: borda e mensagem em `vermelho-texto`, com ícone ao lado do texto; a mensagem é descrição do campo (`aria-describedby`), sem `role="alert"` (produto: o aviso do envio já é uma região própria, e o campo o lê ao receber o foco). Desligado: `fundo-suave` com texto `apoio` |
| `Busca` (N) | 44 px, letra de 16, lupa de 20 à esquerda | O rótulo é só para leitor de tela |
| `Opcao` (N) | Um `<label>` com o `<input>` de verdade: degrau, canto 12, mínimo de 64 px. Texto em `t-cartao`; à direita, um círculo de 24 com o visto. Marcada em `azul-claro`, `azul-borda`, `azul-texto`. Desligada: `borda`, `fundo-suave`, texto `apoio` (4,5:1), sem degrau; o círculo, marcado ou não, sem cor de ação (o visto fica, em `apoio`) | Teclado nativo. Quem usa põe o `fieldset` e a `legend` |
| `Interruptor` (N) | Trilho de 52 × 32 px, com alvo de toque de 44 px de altura abaixo de 768. Desligado: `borda`, com borda `borda-campo` (produto). Ligado: `azul`, com borda `azul-degrau`. Bolinha de 24 em `fundo` (produto). Fora de uso: `fundo-suave` com borda `borda` e bolinha `borda-campo`, sem opacidade (produto); a posição da bolinha continua dizendo o estado | `role="switch"`. Muda na hora |
| `Segmentado` (N) | Grupo de 44 px, borda 2, canto 12. A opção ativa em `azul-claro`, `azul-borda`, `azul-texto`. Até quatro; com quatro rótulos longos, `emDuasColunasNoCelular` põe as opções duas por linha abaixo de 768 px (o filtro "Estado" de Registros › IA). Troca o jeito de ver; não é aba | `radiogroup`, com as setas, Home e End |
| `Aparencia` (N) | O `Segmentado` Sistema · Claro · Escuro, em "Sua conta" | Só a escolha explícita grava; voltar a Sistema apaga a chave. Sem armazenamento, vale o sistema, calado |
| `TamanhoDaLetra` (N) | `componentes/ajustes/TamanhoDaLetra` (numa pasta própria: `componentes/` já está no teto de 25 arquivos de produção). Três `Opcao` de rádio (Padrão · Grande · Maior) num `fieldset` "Tamanho da letra", e a prévia "Assim fica a minha letra." no tamanho de agora. Em Eu › Ajustes, com a `Aparencia` | Setas trocam a escolha, uma parada de Tab. Só a escolha grava; Padrão apaga a chave. Sem armazenamento, vale na sessão, calado |

**Sobrepor**

| Peça | Desenho | Estados e teclado |
|---|---|---|
| `Dialogo` (R) | Sobre o `veu`. Caixa centrada de até 520 px, canto 16, borda 2 e degrau 4 (o anel e o degrau são a `shadow-flutua`). Título em `t-secao`, **sem altura mínima de 64 px** (produto: o diálogo de um campo e dois botões precisa caber nos 640 px de um celular baixo, A72). Miolo com 24 px (20 abaixo de 640), e a caixa rola por dentro; rodapé com os botões à direita. **Sem "X" no cabeçalho** (produto: ele seria o primeiro controle do Tab, e todo diálogo já tem "Cancelar" ou "Fechar") | O `veu` vale para todo `<dialog>` modal, e por isso a gaveta da casca (13.0) já o herda a partir da 7.0: não é decisão dela. Ao abrir, o foco vai ao primeiro campo ou ao primeiro botão do rodapé; na confirmação, ao texto. O Tab e o Shift+Tab não saem da caixa; o Esc fecha; ao fechar, o foco volta a quem abriu, ou ao `focoDeReserva` quando esse saiu da página |
| `DialogoDeConfirmacao`, `dialogos.tsx` (R) | A caixa do `Dialogo` (produto: 520 px, e não os 460 do mockup: uma largura só para todo diálogo). **Dois botões do mesmo tamanho**, em duas colunas iguais a partir de 640 px e empilhados abaixo, com o `secundario` primeiro (à esquerda, ou em cima) e o que confirma depois, em `oficial` ou em `perigo` cheio. O `perigo` cheio só vive dentro de uma confirmação, e a lista é fechada: a `DialogoDeConfirmacao`, a `ConfirmacaoDePerigo` de `dialogos.tsx` e o `DialogoDeDecisao` dos pedidos de nome, mais a definição do botão e a galeria, que mostra o desenho. `componentes/perigo-cheio.test.ts` a guarda: um uso novo reprova. A `ConfirmacaoDePerigo` mantém os botões à direita, com a largura do rótulo e a mesma altura (produto) | O que vai acontecer está escrito antes dos botões (regra 50, item 8). O foco começa no texto, e nenhum botão o recebe ao abrir |
| `LoginPorCima` (R) | O diálogo da sessão vencida, na mesma caixa e com os campos da pele (borda 2 em `borda-campo`, fundo `campo`). O véu dele é o forte, preto a 75% nos dois temas, e não o `veu` (produto: a tela de quem saiu tem de sumir) | Funciona com outro diálogo aberto por baixo |
| `PainelLado` (N) | A partir de 768 px, entra pela direita com 480 px e a altura da janela. Abaixo, folha de baixo de até 88% da altura, com canto de 20 em cima e a área segura do aparelho no pé. Cabeçalho de 64 px, com o título em `t-secao` e o "Fechar" de 44 px; rodapé opcional com os botões à direita. Não anima largura nem altura | Diálogo modal: o Tab não sai, e o foco entra no miolo, e não no "Fechar" (produto: quem abre quer ler). Fecha com o "Fechar" e com o Esc, e só com eles: o toque fora não fecha (produto: apagaria o que foi digitado). Ao fechar, o foco volta a quem abriu, ou ao `focoDeReserva` |

O que o mockup tem e a X1 não traz nasce com a tela que usa (X2 a X4).

### 10.3 O que é proibido

Não é questão de gosto: cada linha bate em regra ou em lei. Vale para peça nossa, para o que o
mockup desenhou e para o que qualquer catálogo oferecer.

| O que não entra | Por quê |
|---|---|
| Sequência de dias, pontos, vidas, placar, pódio, tabela de classificação, recompensa variável | D59 e Decreto 12.880, arts. 9º e 10; regra 50, item 9 (ranking de aluno); D64 (ranking de professor); D80, item 7 |
| Comemoração de nota, de acerto ou de tempo de uso | D59. A única comemoração é a da entrega, uma vez (9.5) |
| Contagem regressiva, "só hoje", adesivo de novidade, notificação insistente | D59: urgência fabricada |
| Seletor de humor ou de emoção, histórico de comportamento | Regra 70, item 7, e D57: o produto não infere nem registra estado emocional |
| Avatar de IA com rosto de gente, foto ou nome de gente; mascote com nome próprio ou que diz que sente; "orbe" que pulsa como presença viva. A cabeça da onça é animal, e entra (9.7) | D58 e Decreto 12.880, art. 11: o agente não se passa por pessoa nem simula vínculo (9.7) |
| Verde para "melhorou" e vermelho para "piorou" | Cor é categoria, nunca julgamento (9.1) |
| Letreiro correndo, rolagem infinita, carrossel que anda sozinho | D59: conteúdo que começa sozinho |
| Fundo de shader, globo 3D, brilho de borda animado, vidro fosco, sombra borrada | Regra 50, item 1: custa quadro no Chromebook |
| Peça de catálogo de terceiro, segunda biblioteca de ícones, biblioteca de animação | 10.1 |

### 10.4 Orçamento

O limite é **150 kB de JS (brotli) no primeiro carregamento**: a entrada e os pedaços que ela
importa estaticamente, medidos no build de verdade (`apps/web/nome-dos-chunks.test.ts`). Hoje são
perto de 127 kB, e o teto **não sobe** com a pele (RF22 da X1).

| Pedaço | O que carrega | Quando |
|---|---|---|
| Entrada | React, TanStack Query, roteador, as páginas públicas, a casca, o tema e os ícones de lugar (até 4 kB em brotli, somados) | Sempre |
| Área do papel | As rotas da área e as telas dela, cada tela num pedaço de até 30 kB | Depois da guarda de papel |
| Peças | As peças novas, as de `componentes/ui/ia/` e a onça (o teto do pedaço sobe de 26 para até 40 kB) | Na primeira tela que usa |
| Galeria | Todas as peças, nos dois temas | Só com a variável do build ligada |

- **A casca mora na entrada**, e por isso não importa de forma estática peça de fora dela: nem a onça, nem peça de
  `componentes/ui/ia/`. A única exceção é a onça da marca da casca pública (9.7, 11.3), que entra por import tardio
  (`React.lazy`), com a caixa reservada e um `fallback` vazio, e cai no pedaço Peças que já existe, sem pedaço novo nem
  teto maior
- **A área de um papel não baixa ícone nem peça de outro**
- **Nenhuma fonte.** Nenhuma imagem decorativa acima de 30 KB; ilustração é SVG

---

## 11. A casca e os tipos de página

### 11.1 A casca da escola

Uma só para coordenação, professor e aluno. A lateral do professor, como fica na X3 (tarefa 2.0; o lugar Criados entrou com a tela dele, na 5.0):

```
┌──────────────────────────┬────────────────────────────────────────────────────┐
│ ◉ Turmma               ⇤ │ Turmas                   (o título, que é o h1)    │
│ [ CA  Colégio Aurora ⇅ ] │                                                    │
│                          │                                                    │
│ ▣ INÍCIO                 │   conteúdo, na coluna do tipo de página (9.3),     │
│ ▣ TURMAS                 │   dentro da moldura de 1200 px                     │
│ ▣ FERRAMENTAS            │                                                    │
│ ▣ CRIADOS                │                                                    │
│ ──────────────────────── │                                                    │
│ (CS) Camila Souza        │                                                    │
│ ⇥ Sair                   │                                                    │
└──────────────────────────┴────────────────────────────────────────────────────┘
  lateral · 256 px · `fundo`, borda de 2 px       conteúdo · `fundo`
```

- **A lateral** tem 256 px, face `fundo` e borda direita de 2 px. No topo, a marca e o botão de
  recolher; embaixo, o **seletor de escola**, para quem tem mais de uma (regra 50, item 13; P30):
  um cartão com degrau, com a escola, a rede e o papel. Sigla e turno não existem no modelo, e o
  número de turmas seria dado da outra escola (Tech Spec da A1, seção 11)
- **Os lugares** são links de 52 px, canto 12 e borda 2: o ícone ilustrado de 32 px numa caixa de
  36, e o rótulo em `t-rotulo`. **Aceso** tem borda `azul-borda`, fundo `azul-claro`, texto
  `azul-texto` e `aria-current`; apagado tem texto `sutil`, e `fundo-suave` com `tinta` no hover
- **O trilho** tem 88 px e só os ícones, cada um com nome acessível e dica. A lateral recolhe para
  ele por escolha, que o navegador lembra, e **não anima a largura**
- **O pé** tem a pessoa (as iniciais, o nome e o papel), os links dela, a `Aparencia` e o **Sair**,
  que fica à vista no pé da lateral, no trilho e na barra de topo do celular, a um clique e do
  tamanho dos vizinhos (D59; RF15 da X1)
- **O tema** é escrito no `<html>` (`data-tema`) por um script em linha, antes de o CSS pintar. No
  navegador ficam só três chaves, `educa.aparencia`, `educa.lateral-recolhida` e `educa.letra`, sem identificador
  (regra 50, item 7)

**Responsivo** (D51), com uma navegação por vez na página:

| Largura | Casca |
|---|---|
| ≥ 1024 px (o Chromebook de 1366 × 768 cai aqui) | Lateral aberta de 256 px; recolhe para o trilho por escolha |
| 768 a 1023 px | O trilho de 88 px |
| < 768 px, a partir de 360 px | Barra de topo de 56 px, com a pinta, a escola, o botão do menu e o **Sair**. Papel com até quatro itens tem a **barra de baixo**, fixa, de 68 px mais a área segura; o resto (escola, conta) abre na gaveta. Com mais de quatro, os itens continuam na gaveta. Nada rola de lado |

Na barra de baixo cada lugar é uma coluna: o ícone de 28 px numa pílula de 48 × 36, e o rótulo de
12 px em 700, caixa-alta. O ícone do `lucide` não tem versão ilustrada: ele entra no ladrilho da
família dele, e os 28 px são o miolo desse ladrilho (a peça de 32 px). Nome comprido corta com
reticências. Na conversa, em qualquer largura, a caixa de pedido fica presa embaixo e a lista rola
por trás. Enquanto a barra de baixo existe, a página reserva o lugar dela (`--barra-baixo`): o último
botão da tela termina acima da barra, o foco do teclado nunca para atrás dela, e a barra presa
(`BarraPresa`) de uma tela sobe para ficar logo acima.

**O que cada papel vê.** Na X1 os itens eram os de antes da pele, na ordem e nos endereços de antes
(RF16 e RF18); os lugares da D80 chegam com a spec da área, e a coordenação já os tem desde a X2.
Lugar sem tela não aparece (D73).

| Papel | Na X1 | Os lugares da D80 | Chegam na |
|---|---|---|---|
| Professor | Início (era "Nova conversa") · Ferramentas · Turmas, e o grupo "Seu time" | Início · Turmas · Ferramentas · Criados, as Conversas embaixo e o sino. Na tarefa 2.0 a lateral ficou com Início · Turmas · Ferramentas, e "Seu time" saiu; Criados chegou com a tela dele (5.0), e a lateral e a barra de baixo ficaram com os quatro | X3 |
| Aluno | Tutor · Atividades · Minha turma, e Privacidade no rodapé | Início · Tarefas · Eu · Avisar um adulto (este, com o F9). Início, Tarefas e Eu entraram na tarefa 2.0, e o rodapé do aluno ficou vazio | X4 |
| Coordenação | Governança · Agentes · Analista · Estrutura · Professores · Material · Privacidade. Eram sete, na gaveta do celular, e só valeram até a X2 | Painel · Analista · Escola · Registros, e o sino. São quatro: cabem na barra de baixo do celular | X2 (entregue) |
| Rede | — | Painel · Analista · Escolas | F14 |

A coordenação abre no Painel (X2); Governança é a aba IA de Registros. O aluno abre no Início (X4),
tenha ou não o Tutor ligado para a turma: o Início só avisa, e o aviso do limite do dia e da função
suspensa fica na tela do Tutor.

**O sino** (X2 e X3) fica no canto de cima à direita da área de conteúdo, e na barra de topo no
celular. O contador é laranja, e é o único número da casca do professor e da coordenação. A lista
abre num painel de 400 px ancorado no sino, e como `PainelLado` no celular. **No pé da lista do
professor** ficam duas linhas que não são pendência e não entram no número: "O que o Assistente
fez" e "O que o Tutor viu" (grupo "Acompanhar a IA"). Elas aparecem com a lista em dia, carregando,
lida em parte ou com erro, e ir a uma delas fecha a lista, como a qualquer item.

**O pé da lateral, em duas peças (F3, tarefa 18.0).** A lista de seções não leva "Meus dados", e o lugar dele é diferente por
papel: no **aluno**, o item **Privacidade** é o do rodapé fixo (acima do menu da pessoa, num bloco `nav` de nome "Rodapé", com o
mesmo tamanho e o mesmo foco dos itens), e abre a tela do aluno com a seção **Meus dados** dentro dela; no **professor**, é o
link **Meus dados** do **menu da pessoa** (um bloco `nav` de nome "Sua conta", com o link antes do "Sair", sem menu para abrir:
o nome, o papel e o "Sair" já ficavam à vista, P18). A coordenação não tem nenhum dos dois, porque ela não é titular de
pedido: o que ela faz é registrá-los, em Privacidade (seção 3). Na gaveta a 360 px o rodapé do aluno aparece com a gaveta aberta, sem rolar, e os dois links têm alvo de 44 px. O item do rodapé e o link do menu ficam selecionados no endereço deles, e nenhuma seção
fica selecionada ali.

Na X4 o aluno passa a achar a Privacidade dentro de Eu, com as mesmas regras.

**Os nomes acessíveis não mudam**: o e2e navega por eles (Tech Spec da X1, seção 9). São as
navegações "Seções", "Rodapé" e "Sua conta" ("Seu time" saiu na X3, tarefa 2.0); o diálogo "Menu"; os botões "Abrir o
menu", "Fechar o menu", "Recolher a lateral", "Abrir a lateral" e "Sair"; o seletor que começa por
"Escola: "; e o link "Turmma, página inicial". Um rótulo muda: "Nova conversa" vira "Início", no
mesmo endereço.

### 11.2 Os tipos de página e o cabeçalho

Quatro tipos, quatro larguras (9.3) e um cabeçalho. Na X1 toda tela continua na `Tela`, que passa a
mostrar o título e ganha as larguras novas; a composição de cada tipo chega com a spec da área.

| Tipo | Para | Como é |
|---|---|---|
| **Conversa** | O Início e a conversa com cada agente | Barra de 64 px (56 no celular). Vazia: a saudação, a caixa e as sugestões juntas, a 40% da altura. Com mensagens: coluna de 768 px, vão de 24, a caixa presa embaixo |
| **Leitura** | Lista, formulário curto, a conta, um pedido aberto | Coluna de 880 px |
| **Painel** | O Painel, Turmas, Escola, Registros, a operação | A moldura inteira, em grade de 12 colunas com vão de 16; seção solta com título em `t-secao` |
| **Documento** | O que a professora gerou, aberto (X3) | Cabeçalho na coluna de 1080 px; embaixo, a `mesa` de ponta a ponta, com a folha de 760 px e o sumário, só a partir de 1200 px de janela |

**O cabeçalho** de toda tela aberta por um lugar da lateral:

- **O título é o `h1`, visível, em `t-titulo`**, numa linha de no mínimo 64 px, e cada tela tem o
  título dela na aba do navegador (RF12 da X1). Na conversa o `h1` existe só para leitor de tela.
  O texto do `h1` das telas de hoje não muda, e a página continua com um `<main>` só
- **À direita**, a ação da tela (no máximo uma cheia) e o menu "Mais opções"
- **Tela de objeto tem o voltar** numa linha própria, de 28 px, em cima do título: "‹ origem", em
  `t-selo`, `sutil`
- **As abas** ficam embaixo do título, com 44 px; o endereço guarda a aba, e trocar de aba não
  empilha histórico

**A turma aberta** (X3, seção 1.7) é uma página de painel com o cabeçalho de objeto: o voltar ("Voltar para
Turmas"), o `h1` "Turma 7ºA" com a série embaixo e as três abas no endereço (`?aba=`), sem ação no alto. Do `md`
para cima **a página não rola**: o topo e as abas ficam parados, e só o painel da aba ativa rola por dentro, na
altura da janela menos onde ele começa (a mesma conta do documento aberto, medida em `useTopoDoPainel`);
abaixo de 768 px a página rola inteira (RF22).

Fora da casca ficam as **telas de foco**, cada uma na fase dela: a introdução (X4), a prova (F6) e
a aula ao vivo (F10). Topo de 64 px com o sair, o miolo rolando por dentro e o rodapé preso.

### 11.3 A casca pública

A entrada, o convite, a reivindicação de nome e a verificação em duas etapas, no tema do sistema.

- **A partir de 1024 px a tela se divide**: à esquerda, o painel em `papel`, com a borda de 2 px em `borda`, a marca no
  topo e a onça da marca (9.7) de 160 px no centro, na pose `acenando`, que entra e acena uma vez; à direita, o cartão do
  formulário. **Abaixo disso, empilha**: a faixa de topo fica só com a marca, e a onça da marca, de 88 px e parada, vai
  sobre `fundo`, acima do formulário. A pinta grande e apagada saiu (D80 revista em 30/10/2026, à noite). **O painel
  ficou em `papel`, e não em `laranja-claro`**: a foto do tema claro (30/10/2026) mostrou que os pés da onça, de creme
  `#FDEBDD`, somem sobre o `laranja-claro`, que é o mesmo `#FDEBDD`, e o painel voltou a `papel` como a decisão previa, sem
  cor nova e sem mexer na onça. O painel não tem altura mínima: a onça de 160 px, no centro, cabe abaixo da marca em qualquer
  janela de computador
- **O formulário.** Aluno: "Entrar com a conta da escola" (Google ou Microsoft, quando a escola
  tem) ou escola, matrícula e senha (D48). Professor e coordenação: o que o F1 definiu, com o
  segundo fator da coordenação. Não existe "Cadastre-se" (D2), nem busca pública de escola. Um
  `primario` só: "Entrar"
- **Textos, ordem de campo e mensagens não mudam** (RF20 da X1), e as proteções ficam: a entrada
  responde igual para matrícula errada e pedido pendente, o convite não mostra e-mail, e o segundo
  fator mostra o segredo em texto, além do QR (D80, item 7; regra 50, item 2)

### 11.4 A operação

Uma tela só, sem lateral (seção 5a).

- **Barra de topo** de 72 px (56 no celular, contando a borda), face `fundo`, borda de baixo de 2:
  a pinta e "Operação Turmma" em 17 px e 700 (sem o fio vertical do mockup: o nome já traz a marca);
  à direita, a `Aparencia`, o nome do operador e o **Sair**, à vista. Abaixo dela, a navegação
  "Operação" (Escolas e Uso), com o item da tela em `azul-texto`, sublinhado e `aria-current`. Troca a
  faixa preta de antes (X1, 15.0)
- **O corpo** é uma página de painel, com o título "Operação", a linha fixa de que a operação não vê
  dado de aluno nem de professor, e as abas **Escolas** e **Uso** (X2)

### 11.5 Telas-chave, até a spec da área

As seções 11.2 a 11.8 da versão de setembro desenhavam estas telas na pele antiga. O desenho sai; o
que segue é o que continua verdade, até a spec da área recompor a tela. Código e teste que citam o
número antigo acham aqui o assunto.

**Início do professor** (era 11.2; X3). O grupo fica a um terço da altura livre (uma coluna
`1fr · auto · 2fr`). Em cima o Assistente se apresenta: o avatar da onça (40 px), o nome da função
e o selo "IA", e embaixo dele a saudação pela hora, com o primeiro nome, e "O que vamos preparar
hoje?". Depois vêm a caixa de pedido, com a **turma** como contexto e o enviar `primario`; os
**atalhos de ferramenta**, um botão secundário de 44 px com o ícone ilustrado para cada ferramenta
que existe (o catálogo da página, P17) e o link "Ferramentas"; e a frase "O Assistente é uma IA e
pode errar · Nada chega à turma sem você aprovar", sem link. O atalho é a escolha explícita da
ferramenta (D18): abre o cartão na conversa com a turma e, como tema, o que está na caixa, e a
Adaptação abre sem ler a caixa (D35). O pedido escrito e enviado vai ao Assistente, que pergunta
antes. **Web** (D68), o anexo (P07) e a linha do dia (F2, F8) continuam fora. **O que espera a
professora não está no Início: está no sino.** O menu **Ferramenta** fica na caixa da conversa.

**A conversa, o selo de IA e os cartões** (era 11.3; X3).

- **Quem escreve** fica à direita, em balão. **A IA não tem balão**: texto na largura da coluna, e
  em cima a **assinatura** — o avatar do agente, o nome da função e o selo "IA"
- **O selo de IA** (seção 6) é um conjunto só, igual em todo o produto: "IA" ao lado do nome do
  agente; o **chip de fonte** "p. 142" dentro do texto, que abre material, página e trecho; e,
  depois da aprovação, a linha **"Aprovado por Camila Souza · 19/09, 10h42"**. Fonte de fora leva o
  chip **"da web"** com o link, de desenho diferente do chip de página (D68)
- **A pergunta da D18** é uma frase do Assistente e um cartão com **duas opções do mesmo peso**,
  que encolhe para uma linha depois da escolha (P16). Nenhuma das duas é a "certa" (D59)
- **O cartão de ferramenta** é o formulário da própria ferramenta dentro da conversa: mesmos
  campos, mesmo contrato (seção 1.1). "Gerar" é `primario`. Na **Adaptação** o cartão tem a lista
  de **tipos de adaptação** e nenhum campo de texto livre (D35, D67)
- **As ações da resposta ficam sempre visíveis.** Enquanto o texto chega, enviar vira **Parar**.
  Fila cheia ou provedor lento vira aviso dentro da conversa, nunca erro cru (regra 80, item 4)

**Turmas e a turma aberta** (X3, tarefas 9.0 a 13.0; o comportamento está na seção 1.7). As peças:

- **A faixa "Confirme sua turma"** é um bloco de borda de 2 px na família `amarelo`, com o ladrilho da disciplina, o
  texto e os dois botões ("Confirmar" `oficial`, "Contestar" `secundario`); no celular o texto e os botões
  empilham. Os **cartões de "Suas turmas"** são de borda de 2 px em `superficie`, com o ladrilho, o nome, o
  estado em texto e o selo ("N esperando você" em `pendente`, "Em dia" em `ok`, "Não lida" em `info`)
- **Hoje** é uma coluna só, sem grade: o aviso de atenção humana em `pendente` (ícone e texto), os sinais como
  falas do Tutor, o bloco recolhido "O que o Tutor faz sozinho…", as barras neutras do acerto por habilidade.
  O painel "O que o Tutor viu" é o `PainelLado` (480 px à direita; folha de baixo a 360 px)
- **Atividades** é uma lista de `Linha`, separadas por borda de 2 px, com o ícone da ferramenta à esquerda e o
  selo do estado à direita; o filtro é o `Segmentado`, em duas colunas no celular; o painel da atividade é o
  `PainelLado`, com as ações no rodapé
- **Alunos** empilha o resumo do acesso, a lista de pedidos e a `Tabela` "Acertos por aluno" (nome, acertos e
  por habilidade), sem coluna que ordene por acerto
- **"Convidar alunos"** é o `Dialogo` de 520 px. O passo "Acesso gerado" usa a variante `inteira` (a janela
  toda, no `fundo` do tema, para que nada da turma fique legível atrás do código projetado)
- **Em nenhuma aba** há nota, média, ranking, ordem por acerto, tempo parado nem a conversa de um aluno
  (regra 50, itens 9 e 10; D64, D69)

**O que o Assistente fez e o que o Tutor viu** (era "Seu time", 11.4; pelo pé do sino desde a X3, tarefa 2.0; os
títulos das telas, no `h1`, são "Assistente de ensino" e "Tutor"). Cada agente abre a própria conversa em tela cheia, e a entrega
é um cartão com o que foi feito, o que está esperando e o estado em selo. O que o Tutor viu
mostra **sinal, não conversa de aluno** (regra 50, item 10) e mora na aba Hoje da turma, e não numa
tela de agente: o nome do aluno aparece só para o professor da turma (D34), por ação dela, num
painel ao lado, e **nada na tela abre a conversa de um aluno**. A seção 1.7 descreve a aba e a
seção 1.3, a fila.

**Aprovar** (era 11.5; X3, com a ação oficial em grafite).

- **A tela abre com uma faixa de três números** (correções, destaques abertos e acerto médio em
  questões) e **três abas no endereço**: Destaques, Outras (em ordem de nome, nunca de acerto) e
  Resumo (distribuição, acerto por habilidade e por questão). O destaque aberto aparece num painel
  ao lado, que no celular é a folha de baixo (X3, tarefa 14.0)
- **O botão de aprovar é o único `oficial` da tela**, mora numa barra presa embaixo, **fora das
  abas** (está nas três), e fica desligado até o último destaque ser aberto — com o **contador ao
  lado dizendo por quê** (D33)
- Destaque fechado é `pendente`; aberto vira `ok`, com a hora. É a interface mostrando o que o
  **registro da validação** vai guardar (D56)
- Confirmar abre diálogo com **o que vai acontecer**: avaliação, turma, quantas correções, e que
  o diagnóstico chega aos alunos. Depois, a tela mostra "Validação registrada · Camila Souza ·
  19/09, 10h42"
- **Rejeitar** é `perigo` e pede justificativa
- Em discursiva esta tela não tem valor nem texto sugerido pela IA: só a rubrica ao lado e o
  campo do professor (D55)
- No MVP (A3) o que se aprova é **diagnóstico**, não nota (D46). O desenho é o mesmo

**Área do aluno** (era 11.6; recomposta na X4). A mesma casca, mais calma:

- **Início** (X4, 3.0): a saudação ("Oi, <nome>.") com a assinatura do Tutor, a faixa de supervisão e "Para fazer", até três
  tarefas, sem número de uso. A partir de 768 px a tarefa vira linha, com "Pedir ajuda ao Tutor" ao lado do título; abaixo,
  cartão. O título abre a tarefa e o "Pedir ajuda" abre a conversa dela: são dois links, nenhum dentro do outro. O Início
  cabe em 1366 × 768 com três tarefas (RF20 da X4)
- **Tarefas** (X4, 4.0): Para fazer, Entregues e Corrigidas, sem número no título dos grupos (a lista é paginada, e o
  número seria só o das já carregadas); cada tarefa é uma linha com o ladrilho na cor e no ícone da matéria, e a matéria
  desconhecida vai em `anil`, com um livro aberto
- **A tarefa aberta** (X4, 6.0 e correção `2026-10-25-tarefa-aberta-cabe-em-1366`): uma questão por vez, com as
  alternativas em rádio grande, "Anterior" e "Próxima" e o mapa de quais já têm resposta. Cada escolha vai ao servidor na
  hora, e "Resposta salva" só aparece com a confirmação dele (regra 80, item 6). "Pedir ajuda ao Tutor nesta questão" fica
  no cartão da questão. A partir de 768 px, "Enviar a atividade", o ponto de parada e "Anterior" e "Próxima" ficam numa
  linha só, sem barra presa; no celular a barra fica presa embaixo. Corrigida, ela mostra o diagnóstico (acertos por
  habilidade e questão por questão, em contagem, sem nota, sem percentual e sem comparação), com a assinatura da função
  que corrigiu e quem aprovou; a partir de 1024 px em duas colunas, com "Questão por questão" rolando por dentro. A
  comemoração, uma vez, no envio confirmado (9.5, regra 7)
- **Eu** (X4, 2.0, 7.0 e 8.0): a turma, a série e a escola na linha de apoio do título, sem cartão; os avisos de
  carregando, erro e "sem turma" logo abaixo dele; "Como estou indo" e as quatro linhas da conta (Privacidade, Ajustes,
  Rever a introdução, Sair) em duas colunas e em grade 2 × 2 a partir de 1024 px, numa coluna abaixo. As linhas existem
  em todo estado: o "Sair" nunca depende da leitura da turma (D59). "Ajustes" abre um diálogo com a aparência e o tamanho
  da letra, que só grava ao escolher. Cabe em 1366 × 768 com duas tarefas corrigidas
- **Faixa fixa no alto do Início e do Tutor**: "Quem dá a aula acompanha como você usa o Tutor." Não fecha (D8)
- **A caixa de pedido é só texto e enviar.** Sem seletor, sem anexo, sem texto de exemplo que
  troca sozinho, e sem atalho. A conversa é a de uma tarefa atribuída pelo professor: o caminho
  até ela é o "Pedir ajuda ao Tutor" do Início e da tarefa aberta
- **Na tela do Tutor, e não no Início, "Hoje: 12 de 60 perguntas"** em texto, com barra fina em cor neutra (12b da X4). Não fica vermelha, não
  pisca; no fim, diz com calma que por hoje acabou e que amanhã volta (D38, D59)
- **Privacidade** é uma linha de Eu (o rodapé da lateral do aluno saiu na X4), e a **seção "Meus dados"** abre dentro dela (F3, tarefa 18.0; RF12 e RF20). A tela
  é a mesma do professor (menu da pessoa), com o mesmo texto, escrito para quem está no 6º ano: **os pedidos da própria pessoa na
  escola ativa**, o mais recente primeiro, cada um com o que é ("Cópia dos seus dados"), o dia em que chegou à escola, o selo em
  texto e uma explicação; e **"O que a escola guarda de você"**, a contagem de registros por categoria, com o nome de cada categoria dito a quem é
  titular, na segunda pessoa (e não o do catálogo de retenção da coordenação, que diz a regra de guarda), sem o conteúdo (que
  vem no arquivo). A pessoa **não pede** nada ali: o pedido é da escola (D10), e o
  vazio é o convite a pedir à coordenação. Os estados do arquivo: **em preparação** ("Estamos preparando o seu arquivo. Volte
  em alguns minutos."; a tela se relê a cada 10 s com a aba à vista e anuncia quando fica pronto), **pronto para baixar**
  (com "o arquivo fica disponível até DD/MM/AAAA, HH:MM") e **arquivo apagado** (passou dos 7 dias: diz para pedir de novo à
  coordenação). "Baixar meus dados" é `secundario`, e a decisão fica no diálogo: o que o arquivo traz, o formato aberto (JSON), o
  **aviso do computador compartilhado** ("Se este computador é da escola, apague o arquivo dele depois de usar e saia da sua
  conta") e que o download fica registrado na escola; **Cancelar** tem o mesmo peso de **Baixar o arquivo**, e o arquivo sai
  como `meus-dados-AAAA-MM-DD.json`. Nada do arquivo aparece na tela: ele sai como arquivo, pela URL assinada de 5 minutos.
  Troca de escola ou de pessoa não deixa nada da anterior (a resposta não fica guardada fora da tela)
- **Tutor travado em avaliação**, ou desligado fora da sala, é tela que explica, com ícone e uma
  frase. Não parece erro (D19)
- A assinatura do Tutor é a mesma dos outros agentes: avatar, "Tutor", selo "IA". Perguntado, ele
  diz o que é (D58, D65)
- **Não existe nesta área:** saudação animada, número subindo, selo de conquista, qualquer lista
  de colegas (regra 50, item 9; 9.5, regra 8)

**Coordenação: Governança** (era 11.7; X2, no Painel e em Registros).

- Os números em `t-numero`, com rótulo em cima. Sem gráfico onde um número basta
- A tabela é a consulta da regra 70, item 6. "Aprovado por" em `ok`, "Esperando" em `pendente`
- **Nenhuma coluna, filtro ou ordenação por professor** (D45, D64). Abrir o nominal é botão
  `oficial` à parte, com diálogo dizendo que fica em auditoria
- **Agentes** (a página "Como cada IA trabalha", X2, 11.0) mostra **uma IA por vez**, escolhida no
  seletor "Qual IA" e guardada no endereço (`?ia=`): o avatar, o nome e **as funções** dela, cada uma
  com o que *faz sozinha* e o que *espera aprovação*, a autonomia em português comum, o selo de alto
  risco e o botão de **suspender só aquela função**; o que a IA *nunca faz* fica embaixo, igual para
  as três. O resumo da AIA na tela é do F12 (D9 e D60 revistas; P19)

**Entrada** (era 11.8): está na 11.3.

---

## 12. As telas do MVP de apresentação (A1 a A5)

As telas deste roteiro mudam de pele na X1 e de estrutura nas X2 a X4 (D80). A coluna "Desenho"
cita as seções 11.2 a 11.8 da versão de setembro: o que delas continua valendo está na 11.5.

O roteiro do `ROADMAP.md` (D71 revista), passo a passo, com a tela e onde ela está desenhada. A
Parte B vale desde a D72 e a D73 (23/09/2026). **Não existe seed com escola pronta**: tudo que a
demonstração mostra entra pelo próprio produto, com dado inventado (D71 revista).

**Entregue.** A A0, a A0b e a A1 pelo processo completo; a A2 a A5 numa fatia só, pela D77, que
entrou na `develop` em 05/10/2026 (`13eab64`). O passo a passo que se apresenta, com os dados
sintéticos, está em `docs/roteiro-da-demonstracao.md`; o que ficou de fora de cada spec está no
`ROADMAP.md`.

| Passo do roteiro | Tela | Desenho | Spec |
|---|---|---|---|
| Nós criamos a escola e convidamos a coordenação, no painel da operação | Painel da operação (5a) | — | A0b |
| 1. A coordenação aceita o convite, entra com MFA e monta a escola: disciplinas, turmas, lista de nomes por turma, alocação e convite ao professor | Entrada e Estrutura | 11.8, 3, 11.1 | A1 |
| 1. O professor aceita o convite e confirma o vínculo; o aluno reivindica o nome pelo convite da turma, e o professor aprova | Entrada, Turmas e o convite da turma (P27) | 11.8, 1 | A1 |
| 1. A coordenação sobe o material com licença (D75) | Material | 3 | A2 |
| 2. Professora pede uma atividade; o chat pergunta; abre o cartão; gera com página citada; exporta | Home e conversa | 11.2, 11.3 | A2 |
| 2. Pede a versão adaptada escolhendo o tipo, e aprova | Cartão de Adaptação e cartão de entrega | 11.3, 11.4 | A2 |
| 3. Aluno responde a atividade e abre o Tutor, que recusa, conduz e cita | Área do aluno | 11.6 | A3, A4 |
| 4. Professora recebe do Tutor que oito travaram; o Assistente avisa que corrigiu e espera | O que o Assistente fez e o que o Tutor viu, pelo pé do sino (era "Seu time") | 11.4 | A3, A4 |
| 4. Abre os destaques e aprova, com o registro da validação | Aprovar | 11.5 | A3 |
| 4. Vê o acerto por habilidade | Turmas › a turma aberta, com **Hoje, Atividades e Alunos** (X3; na A3 eram Visão Geral e Alunos) | 1.7, 10.2 | A3, X3 |
| 5. Coordenação abre a governança, os agentes com as funções, e o resumo do Analista | Governança e Agentes | 11.7 | A5 |

Fora do MVP, com o lugar reservado no desenho: grade horária e "seu dia" (F2, F8), Calendário,
Buscar, anexo e busca na web na caixa de pedido, gráfico de série, modo sala, prova online,
Conformidade, Denúncias, Exportar.
