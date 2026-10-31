# Pendências que saíram dos mockups

> **O que o MVP de apresentação entregou** (05/10/2026, `13eab64`; conferido no código). A A2 a A5
> não tiveram PRD nem Tech Spec (D77): onde um item abaixo diz "PRD da A2", "da A3" ou "da A5", o
> prazo passou com a fatia única do `docs/mvp-rapido.md`.
>
> - **Entregues:** P14 e P29 (Seu time em conversa, com filtro por função:
>   `apps/web/src/areas/professor/assistente/Time.tsx`), P15 (Home com "Esperando você" só com pendência:
>   `Home.tsx`), P16 (`apps/web/src/components/ui/ai/Escolha.tsx`), P17 (o menu Ferramenta da caixa
>   de pedido, só com o que existe: `CaixaDoAssistente.tsx`), P19
>   (`apps/web/src/areas/coordenacao/governanca/Agentes.tsx`, com a suspensão por função), P23
>   (`components/ui/ai/schema-form.ts`) e P24 ("só conversar", `resposta: 'so_conversar'`). Na
>   A1, antes: P18, P27 e P30.
> - **Em parte:** P13 (a lista do que a professora gerou, em Ferramentas, sem a grade de
>   miniaturas), P28 (a turma aberta com Visão Geral e Alunos: `professor/Turma.tsx`) e P10 (o
>   aluno vê diagnóstico, e não existe nota: D46).
> - **Não entregues, com o destino:** P06 (uma conversa só por professora, sem Histórico: F7), P11
>   e o resto do P28 (antes do PRD do F6; Recursos e Mural por `descobrir`), P13 e P25 (a grade
>   e a página em duas colunas: F7). Os itens de `descobrir` continuam como estavam.

> Em 19 e 20/09/2026 o Gabriel revisou, em oito rodadas, os mockups da interface inteira. Eles
> estão na pasta **`mockups/`** (como rodar: `mockups/README.md`), que entrou na `develop` em
> 23/09/2026 vinda do branch `mockups/interface`. **A pasta é só para consulta: nada de lá é
> copiado para o `apps/web`** — o que vale é o desenho, que entra no produto pelos itens abaixo. Ele
> decide vendo, e do que ele viu saíram mudanças que **este repositório ainda não conhece**: uma
> revisão da lista de agentes, funcionalidades que não existem em nenhuma fase, e ajustes de
> escopo em fases que existem.
>
> Este documento lista uma a uma, com o que o **produto** precisa para cada coisa funcionar:
> tela, API e domínio, dado, regra, teste, e por onde ela entra no processo. Nada aqui é decisão
> registrada. O que for decisão entra pela skill `registrar-decisao`, com o aceite do Joaquim; o que for
> funcionalidade nova entra por `descobrir`, não por PRD (`CLAUDE.md`, "Decisões em aberto").
>
> **Em 23/09/2026 fecharam os itens que travavam a A1 e a A2** (`docs/decisoes.md`): P01 (D32,
> D9 e D60 revistas), P02, P03 e P31 (D72), P04 (D73) e a regra e as categorias do P22 (D74). No
> mesmo dia a D71 foi revista: **a A1 passou a ser "a escola"** — a coordenação monta a escola, o
> professor entra por convite e o aluno reivindica o nome —, com o núcleo do F2 dentro dela. Por
> isso o convite da turma (P27) e o seletor de escola (P30) são assunto do PRD da A1, não do F2. A
> D75 (material só pela coordenação) responde parte da pergunta do P05 e do P07. Os itens fechados
> continuam aqui, marcados, pelo que ainda pedem de tela, dado e teste.

**Como ler.** Cada item tem um tipo:

| Tipo | O que é | Por onde entra |
|---|---|---|
| **DECISÃO** | contradiz ou afina uma decisão D<n> já registrada | a skill `registrar-decisao`, como revisão da D<n>; Joaquim ratifica |
| **NOVO** | não existe em nenhuma fase do `ROADMAP.md` | `descobrir <tema>`, e só depois vira escopo de fase |
| **AJUSTE** | a fase existe; muda o que ela entrega ou como aparece | entra no PRD da fase (ou da fatia A1 a A5) |
| **FRONT** | só tela, peça ou orçamento de front | Tech Spec da A1 e `docs/interface.md` |

O mockup é front-end puro, com dado sintético em arquivo. **O que ele faz de um jeito que o
produto não pode copiar está no P21**. É por isso que nenhum arquivo de lá entra no `apps/web`:
a tela do produto é escrita de novo, a partir do desenho e deste documento.

## Resumo

Os itens marcados **fechado** viraram decisão em 23/09/2026; os outros continuam como estavam.

| # | Item | Tipo | Mexe em | Precisa fechar antes de |
|---|---|---|---|---|
| P01 | Um agente por pessoa: Assistente, Tutor, Analista | DECISÃO | D32, D9, D60, D71, `agentes.md`, modelo de dados | **fechado** (D32, D9 e D60 revistas) |
| P02 | Pele do produto: ChatGPT em branco, preto e laranja | DECISÃO | `interface.md` seções 8 e 9 | **fechado** (D72) |
| P03 | Padrão de espaço: aba sem título, tela que cabe na janela | FRONT | `interface.md` 6, 9.3 e 11 | **fechado** (D72) |
| P04 | Navegação do professor | DECISÃO | `interface.md` seção 1, D69 | **fechado** (D73) |
| P05 | Projetos | NOVO | modelo de dados, LGPD, D5, F7 | `descobrir` |
| P06 | Histórico real de conversas | AJUSTE | F7, modelo de dados (entidade que falta), LGPD | PRD da A2 |
| P07 | Anexar documento na conversa | NOVO | D5, D55, D62, F4, F7 | `descobrir` |
| P08 | Faltas e a chamada do professor | NOVO | modelo de dados, LGPD, F6 | `descobrir` |
| P09 | Configurações da pessoa | NOVO (casca) | F1, F3, F7, F9, F12, F13 | PRD da A1 (só a casca) |
| P10 | "Nota" do aluno na sala | AJUSTE | D46, F6, F17, regra 70 item 1 | PRD da A3 |
| P11 | A sala de aula, uma carteira por aluno (hoje subaba de Alunos, P28) | DECISÃO + AJUSTE | D69, F6, AIA do diagnóstico | PRD da A3 |
| P12 | Calendário no desenho da Teachy: mês, semana e dia | AJUSTE | F8, regra 10 (duas escolas) | PRD do F8 |
| P13 | Biblioteca no desenho do Google Docs: grade de miniaturas e lista | AJUSTE | F7, modelo de dados (`Artefato` falta), miniatura | PRD da A2 |
| P14 | Time na lateral, thread com filtro por função (a thread virou conversa, P29) | AJUSTE | F11, `interface.md` 1.3 e 11.4 | PRD da A1 |
| P15 | Home sem atalhos, com "Esperando você" | FRONT | `interface.md` 11.2 | PRD da A2 |
| P16 | A pergunta da D18 como cartão de escolha | FRONT | `interface.md` 1.1 e 11.3 | PRD da A2 |
| P17 | Menu de ferramentas com rolagem; ícone ilustrado, refeito três vezes | FRONT | `interface.md` 9.4, 10.2 e 10.4 | PRD da A2 |
| P18 | Menu da pessoa no modelo do ChatGPT | FRONT | `interface.md` 11.1, D59 | PRD da A1 |
| P19 | Coordenação › Agentes por função | AJUSTE | F12, A5 | PRD da A5 |
| P20 | Peças novas do 21st.dev e licenças a conferir | FRONT | `interface.md` 10.1 e 10.2 | antes de o código entrar |
| P21 | O que o mockup faz e o produto não pode copiar | FRONT | regras 10, 20, 40, 50 | sempre |
| P22 | Catálogo de ferramentas: a regra "ferramenta ou chat" e oito ferramentas novas | NOVO + DECISÃO | D67, F7, `interface.md` 1.2, regra 60 item 8, D5, D55, D57, D66 | a regra e as categorias: **fechado** (D74); as oito, `descobrir` |
| P23 | Ferramenta é dado: um motor de formulário, não uma tela por ferramenta | FRONT + arquitetura | D18, F7, Tech Spec da A2, regra 30 | Tech Spec da A2 |
| P24 | "O resto é só pedir": o que o chat faz sem ferramenta | AJUSTE | D18, F7, regra 20 item 12, D68 | PRD da A2 |
| P25 | Página da ferramenta em duas colunas: formulário e "o que sai" | FRONT | `interface.md` 1.2 e 11 | PRD da A2 |
| P26 | Ranking de participação na turma | DECISÃO | `interface.md` 10.2, D57, D59, D66, P08 | `descobrir`; fora do MVP até lá |
| P27 | Convidar alunos: link, WhatsApp e código da turma | AJUSTE | D3, D4, F2, regra 20 item 8, regra 80 item 1 | PRD da A1 (D71 revista) |
| P28 | A turma aberta com nove abas, no modelo da Teachy; Recursos e Mural | DECISÃO + NOVO | D69, D8, D45, D64, regra 70 item 3, F6, F7 | PRD da A3; Recursos e Mural por `descobrir` |
| P29 | Seu time em formato de conversa | AJUSTE | F11, D14, P14 | PRD da A1 |
| P30 | Seletor de escola como espaço de trabalho | FRONT + tenancy | regra 10, P12 | PRD da A1 |
| P31 | Segunda pele: Ferramentas e Turmas copiadas da Teachy | DECISÃO | P02, P03, P17, `interface.md` 9, regra 50 | **fechado** (D72: a pele do P02 em tudo) |

---

## A. Decisões a revisar

### P01 — Um agente por pessoa da escola · DECISÃO · fechado em 23/09/2026

**O que mudou.** A D32 (revista em 19/09) tem seis agentes, quatro deles do professor:
Assistente de ensino, Corretor, Planejador e Adaptador. No mockup o Gabriel achou que "alguns não
fazem sentido", e o motivo está no próprio `docs/agentes.md`: Corretor, Adaptador e Planejador
têm cada um uma **ferramenta gêmea** que "chama o mesmo caso de uso" — muda só quem dispara e
onde o resultado aparece. Ficou: **professor → Assistente de ensino**, **aluno → Tutor**,
**coordenação → Analista de desempenho escolar**, família (depois) → Mensageiro. O que eram
agentes viram **funções do Assistente**: conversa e ferramentas, correção de objetiva, adaptação,
"seu dia e sua semana". A professora continua vendo o **Tutor** como segunda voz, porque é ela
quem supervisiona o agente dos alunos (D8, D47). O risco comercial foi levantado ("time de
agentes" é a frase da marca e o concorrente vende "assistente sob comando"); o Gabriel respondeu
que não vê impacto. A apresentação passa a ser "um agente para cada pessoa da escola".

**O que o produto precisa.**

- **Decisões.** Revisão da **D32** (seis → três, mais o Mensageiro). Revisão da **D9**: a autonomia
  deixa de ser um rótulo por agente e passa a ser declarada **por função** ("corrigir objetiva: faz
  e avisa; diagnóstico ao aluno: espera você"). Revisão da **D60**: a suspensão passa a ser **por
  função numa escola** — desligar a correção automática sem desligar o chat. A AIA não muda: a
  regra 70, item 6a, já pede por funcionalidade. A **D17** continua (nome de função). A **D44**
  muda só a frase de apresentação. A **D71** cita Planejador e Corretor pelo nome no roteiro
- **Modelo de dados.** Hoje `Agente` tem `autonomia (1..4)`. Precisa de `FuncaoAgente → agente*,
  chave*, nome*, autonomia*, altoRisco*, ativo`; `Entrega` e `ExecucaoAgente` ganham `funcao*`; e a
  suspensão vira registro próprio (`escola*, funcao*, suspensaPor*, em*, motivo`), com auditoria
- **Runtime (F11).** A thread do Assistente passa a misturar correção, adaptação e aviso do dia:
  `MensagemAgente` e `Entrega` precisam da função para o filtro da tela (P14). Não-lidos continuam
  por thread. O critério de pronto do F11 muda de "um agente pode ser suspenso numa escola" para
  "uma **função** pode ser suspensa numa escola sem desligar o chat"
- **Docs a propagar.** `docs/agentes.md` (tabela dos agentes e a seção "Agente e ferramenta não
  são a mesma coisa", que vira "função que dispara sozinha × ferramenta que espera pedido"),
  `ROADMAP.md` (A1 a A5, F11, F12 e a tabela "O que cada fase empresta"), `docs/interface.md`
  (1.3, 9.7, 11.4, 12), `docs/aia/README.md` (conferir que o índice é por funcionalidade),
  `TODO.md` ("avatar dos seis agentes" vira três), `CLAUDE.md` ("Lista de agentes" em conflitos
  resolvidos). A landing page lista os agentes e fica fora deste repositório
- **Teste.** A autonomia é lida do código por função e aparece igual na tela da coordenação; a
  suspensão de uma função não afeta as outras; entrega de função suspensa não nasce

**Dono:** Gabriel decidiu a direção; Joaquim ratifica. **Antes do PRD da A1**, que tem o runtime
mínimo de agente e a casca com o time.

**Fechado em 23/09/2026:** o Joaquim ratificou, e a D32, a D9 e a D60 foram revistas. Com a D71
revista, o runtime mínimo de agente passou da A1 para o começo da A2.

### P02 — A pele do produto é a do ChatGPT, em branco, preto e laranja · DECISÃO · fechado em 23/09/2026

**O que mudou.** A Parte B do `docs/interface.md` (seções 8 e 9) descreve a pele da landing page:
papel, creme, azul-noite, Fustat nos títulos, rótulo em caixa-alta. O Gabriel viu e rejeitou
("bizarramente feio"). Ficou o sistema de design do ChatGPT, com **três cores e mais nenhuma**:
branco, preto e o laranja da pinta `#E8732E`; fonte do sistema (a Fustat fica só no logotipo);
botão em pílula; item de menu de 36 px com canto de 10; caixa de pedido com canto de 28 e sombra
suave; rótulo de grupo cinza, sem caixa-alta. Verde e vermelho só em estado. O laranja aparece
pouco: a pinta, o enviar, o contador e o que espera a pessoa. Os valores medidos estão em
`mockups/src/index.css`, com os **nomes** dos tokens da seção 9.9 preservados.

**O que o produto precisa.** Reescrever 8.1 a 8.4 e 9.1, 9.2, 9.3 e 9.9; registrar como **D72**.
Consequência boa para a regra 50: sem fonte web além do logotipo, o primeiro carregamento fica
menor. Dois achados que voltam para o doc: na Fustat, `tabular-nums` alarga ponto e vírgula
("3 . 412"), então número de painel fica proporcional; e grade CSS sem `minmax(0,1fr)` estoura a
360 px quando a linha tem texto que não quebra. O manual da marca continua valendo para a landing
page; a linha do `TODO.md` que fala em azul-noite e creme descreve a marca, não o produto.

**Dono:** Gabriel (já decidiu). **Antes do PRD da A1.**

**Fechado em 23/09/2026:** registrado como **D72**, junto com o P03 e o P31 — uma pele só, esta, em
todas as telas. As seções 8 e 9 do `docs/interface.md` foram reescritas. Uma troca em relação ao
mockup: a `borda-campo` passa de `#D9D9D9` (1,4:1) para `#8F8F8F` (3,2:1), porque campo de
formulário precisa de 3:1 de contraste.

### P03 — Padrão de espaço: aba sem título, tela que cabe na janela · FRONT · fechado em 23/09/2026

**O que mudou.** O Gabriel reprovou "aproveitamento horrível de espaço" e "toda aba com título e
descrição". O padrão está em `mockups/src/components/turmma/tela.tsx`:

- aba de navegação **não tem título nem descrição** — a lateral já diz onde a pessoa está. Só
  tela de **objeto** mostra nome: uma prova aberta, o formulário de uma ferramenta, o modo sala
- margem de 16 px no celular e 24 px a partir de 768; topo de 16 a 20 px; 16 px entre blocos,
  12 px entre cartões de uma grade, 16 px dentro do cartão
- **uma barra de 36 px no topo** com os controles da página (abas, filtros, busca)
- largura fluida até 1480 px em grade e tabela, 1040 em formulário, 760 em leitura e conversa
  (a 9.3 de hoje diz 1180)
- **tela de trabalho ocupa a altura da janela e rola por dentro** (Calendário, Minhas turmas,
  thread do time); linha de grade tem sempre a mesma altura, com ou sem conteúdo

**O que o produto precisa.** O `<h1>` continua existindo, só para leitor de tela, e cada rota
precisa do próprio `document.title` (regra 50, item 11). **Atenção ao Chromebook de 1366 × 768**:
o Gabriel revisou numa janela de uns 780 px de altura útil; no Chromebook sobra menos. O e2e do
projeto `chromebook` precisa provar que as onze horas do calendário e as fileiras da sala
continuam legíveis — se não couber, a grade rola por dentro em vez de espremer.

**Dono:** Joaquim, na Tech Spec da A1.

**Fechado em 23/09/2026:** entrou na **D72** e nas seções 6 e 9.3 do `docs/interface.md`. A prova
no Chromebook continua sendo da Tech Spec da A1.

### P04 — Navegação do professor · DECISÃO · fechado em 23/09/2026

**O que mudou.** A seção 1 do `docs/interface.md` está marcada **decidido** (desenho da call):
Home, Ferramentas, Calendário, Seu time, Meu painel, Histórico. No mockup ficou:

```
Nova conversa · Projetos · Ferramentas · Calendário · Minhas turmas
Seu time ▾      Assistente · Tutor          (cada um abre a própria thread, em tela cheia)
Fixados ▾       os projetos que a professora fixou
Histórico ▾     as conversas de verdade, por data (Hoje · Ontem · 7 dias anteriores · mês)
```

"Seu time" deixou de ser uma página com lista de threads e virou grupo da lateral (P14).
"Meu painel" virou **"Minhas turmas"**, com as abas "Sala" e "Meu uso" — a D69 dizia o contrário
("Minhas turmas" é aba do "Meu painel"), então é revisão do **nome** na D69. "Favoritas" entrou
e saiu no mesmo dia: não existe.

**O que o produto precisa.** Atualizar a seção 1 e a 11.1 **sem renumerar a Parte A** — tarefas
do F1 já citam as seções 1, 2, 3 e 6. Rotas novas: `/professor/conversa/:id`,
`/professor/projetos`, `/professor/projetos/:id`, `/professor/time/:agente`. Lateral recolhida
mostra só ícone e avatar, com um ponto no agente que tem pendência (o mockup tinha um defeito:
o rótulo sobrava cortado). Projetos (P05) só aparece no menu quando existir.

**Dono:** Gabriel decidiu; Joaquim ratifica. **Antes do PRD da A1.**

**Fechado em 23/09/2026:** registrado como **D73**, com o nome da oitava rodada (P28): o item é
**Turmas**, com "Meu uso" dentro, e "Meu painel" deixa de existir. Cada item do menu só aparece
quando a fase dele existir. As abas da turma aberta continuam em aberto até o PRD da A3.

---

## B. Funcionalidades que não existem em nenhuma fase

### P05 — Projetos, como no Claude e no ChatGPT · NOVO

**O que é.** Uma pasta do professor que junta **conversas, arquivos e instruções** que valem só
ali. Item do menu logo abaixo de "Nova conversa"; os fixados aparecem na lateral. A tela do
projeto tem duas colunas: à esquerda o **trabalho** (começar conversa e as conversas do projeto),
à direita o **contexto** — o que o Assistente já sabe em toda conversa dali: a turma, as
instruções e os arquivos. No mockup funciona criar, fixar, conversar dentro e editar instruções.

**O que o produto precisa.**

- **Domínio e API.** Módulo `projeto` (controller, service, repository, dto). O projeto é **do
  professor**: autorização por objeto, e para qualquer outra pessoa, inclusive a coordenação, a
  resposta é a mesma de "não encontrado" (regra 10, item 6; regra 70, item 8 — ele contém
  conversa e instrução do professor)
- **Dado.** `Projeto* → escola*, anoLetivo?, dono* (usuario), nome*, resumo?, turma?,
  instrucoes?, fixado, arquivadoEm?`; a conversa ganha `projeto?` (P06). A decidir: projeto sem
  turma (a "Feira de ciências") tem ano letivo? E o que acontece na virada do ano (regra 60,
  item 5)
- **Arquivo de projeto é material.** Só entra com titularidade e licença declaradas (D5), preso
  à escola (regra 10): professor de duas escolas não leva arquivo de uma para a outra. O modelo já
  prevê `FonteMaterial.titularidade = professor`, mas hoje exige `autorizacaoDoc` e
  `autorizadoPor` da escola. **Pergunta para o `descobrir`:** o professor sobe material próprio
  sem a coordenação autorizar fonte por fonte? A mesma pergunta vale para o anexo (P07).
  **23/09/2026:** para a base de material da escola, a D75 respondeu que não — ela só recebe o que
  a coordenação sobe. Se o arquivo de projeto fica fora dessa base, é pergunta do `descobrir`
- **IA.** Instruções e arquivos entram no contexto de toda conversa do projeto: recuperação por
  trecho, nunca o arquivo inteiro; limite de tamanho nas instruções; tudo pela porta, com perfil e
  orçamento (regra 30, D14). **Instrução é texto livre do professor**: pode conter nome de aluno,
  e isso iria para o provedor. A tela diz "não é lugar para escrever sobre alunos" (D35, D66), mas
  aviso não é garantia — precisa de mascaramento dos nomes da turma antes do envio (regra 20,
  item 12). O mesmo risco já existe no chat do F7; resolver uma vez, para os dois
- **LGPD.** Linha nova na tabela de `docs/lgpd.md` (projeto: nome, instruções, arquivos), com
  finalidade, base e retenção; entra na exportação do professor (D63) e na eliminação; e o que
  acontece no fim do vínculo (regra 20, item 18)
- **Teste.** Isolamento entre escolas; coordenação não alcança projeto; mover conversa entre
  projetos; apagar projeto não apaga o artefato que já está na biblioteca (a decidir)

**Onde entra.** Não existe fase. `descobrir projetos`; provavelmente estende o F7, depois do MVP
de apresentação. Se for aparecer na demonstração, a fatia honesta é: criar, fixar e conversar
dentro, **sem arquivos**. **Dono:** Gabriel e Joaquim.

### P06 — Histórico real de conversas · AJUSTE (F7)

**O que mudou.** O histórico da lateral era uma lista fixa. Agora é o de verdade: a conversa
nasce quando a professora envia o pedido (na Home ou dentro de um projeto), ganha **título a
partir do pedido**, aparece agrupada por data, abre pelo próprio endereço, e cada linha permite
renomear, mover para um projeto e apagar. Conversa que mora num projeto aparece no projeto, não
no histórico geral (como no ChatGPT — confirmar).

**O que o produto precisa.**

- **Falta a entidade.** O `docs/modelo-de-dados.md` tem `ThreadAgente` e `MensagemAgente` (uma
  thread por agente), mas **não tem a conversa do professor com o chat**, que são muitas. Precisa
  de `ConversaProfessor* → escola*, usuario*, titulo*, projeto?, turma?, ferramenta?, criadaEm*,
  atualizadaEm*, apagadaEm?` e `MensagemConversa* → conversa*, autor (professor | assistente),
  conteudo*, fontes[], artefato?, anexos?, criadaEm*`
- **Título sem IA.** Primeira frase do pedido, cortada em 44 letras: custo zero e resposta
  imediata. Se um dia usar modelo, é perfil `rapido` e conta no consumo da escola
- **Listagem.** Paginada, com índice começando por `escolaId, usuarioId, atualizadaEm` (regra 80,
  item 8); o agrupamento por data é do cliente
- **Privacidade.** A coordenação nunca vê (regra 70, item 8): teste de autorização por objeto
  devolvendo "não encontrado". Conteúdo nunca em log (regra 20, item 9)
- **LGPD.** A linha "Conversa do professor com o chat" da tabela está com **"12 meses
  (proposta)"**: fechar. Apagar pelo professor é exclusão lógica mais expurgo na rotina do F3;
  "Apagar o histórico" aparece nas Configurações (P09); entra na exportação (D63)
- **Front.** Estado de servidor no TanStack Query; **nada de conversa em `localStorage`**, e o
  título não vai na URL (regra 50, itens 3 e 7). O mockup guarda no navegador só para o Gabriel
  recarregar e ver (P21)
- **Fora por enquanto:** busca no histórico

**Onde entra.** O F7 já lista "Histórico": vira requisito detalhado do PRD. Na **A2** entra a
fatia mínima — a conversa da demonstração aparece no histórico e reabre. **Dono:** Joaquim.

### P07 — Anexar documento na conversa · NOVO

**O que é.** O clipe na caixa de pedido abre a área de soltar arquivo (PDF, Word, PowerPoint,
Excel, CSV, PNG, JPG; o mockup propõe 20 MB), o diálogo pergunta **"De quem é este material?"**
(é meu · é da escola · de terceiro, com licença), e o arquivo aparece no campo como folhinha. O
anexo vale só para aquela conversa e **não entra na base de material da escola**.

**O que o produto precisa.**

- **D5.** "Apostila de terceiro sem licença não entra por nenhum caminho" — o anexo é um caminho.
  A declaração da professora basta, ou a coordenação precisa ter autorizado? É a mesma pergunta
  do P05. A D75 (23/09/2026) fechou a base da escola: só a coordenação sobe. O anexo, que vive só
  na conversa, continua sendo a pergunta deste item
- **O risco maior: o anexo abre a porta para a correção de discursiva por IA.** A professora
  anexa as redações da turma e pede "corrige". A **D55** e a regra 70, item 2a, proíbem até o
  rascunho. Precisa de recusa testada no servidor, não só de aviso na tela; e texto de aluno só
  pode ir a provedor com processamento no Brasil (**D62**). O diálogo deveria dizer "não anexe
  trabalho de aluno"
- **Arquitetura.** Bucket privado com URL assinada de validade curta (regra 20, item 7); preso à
  escola e à conversa; retenção igual à da conversa; extração pela mesma esteira do F4, em fila e
  fora do request, com limite de tamanho e de quantidade por vez (regra 80, itens 2 e 3);
  verificação de tipo real do arquivo; imagem usa o perfil `visao`
- **Custo.** Conta no orçamento de IA da escola (D14, D39)

**Onde entra.** `descobrir anexo-na-conversa`. Proposta: fora do MVP de apresentação.
**Dono:** Gabriel e Joaquim.

### P08 — Faltas · NOVO

**O que é.** O Gabriel pediu, na sala de "Minhas turmas", ver **faltas** por aluno. **Falta não
existe** em nenhuma fase do `ROADMAP.md`, nem no modelo de dados, nem na tabela de `docs/lgpd.md`.
No mockup o número é inventado.

**O que precisa ser decidido.** De onde vem: (a) a chamada é feita aqui, pelo professor, no modo
sala ou no calendário — módulo novo, `Presenca → escola*, anoLetivo*, aula*, aluno*, presente,
registradaPor*`; (b) é importada do sistema de gestão da escola, por adaptador; (c) não existe.
Frequência é registro oficial da escola (a LDB exige 75% de presença): virar a fonte oficial da
chamada pesa em disponibilidade e auditoria. **Recomendação de partida: ler o que a escola já
tem, não ser o sistema oficial.** É pergunta para as entrevistas com escolas.

**Oitava rodada (20/09).** A turma aberta ganhou a aba **Frequência**: grade de alunos × aulas, um
clique alterna presente e falta, e "Salvar chamada". Ou seja, o mockup desenhou a opção (a), contra
a recomendação acima. O desenho não decide a origem. E o ranking de participação (P26) usa a
presença, então também depende deste item.

**Até decidir,** a lente "Faltas", a aba Frequência e a presença no ranking não entram na A3 nem no
F6. **Dono:** Gabriel e Joaquim.

### P09 — Configurações da pessoa · NOVO (só a casca)

**O que é.** Um diálogo no modelo do ChatGPT: seções à esquerda, com busca; linhas de "rótulo ·
controle" à direita. O que entra saiu das decisões, não de uma lista genérica:

| Seção | O que tem | De que fase depende |
|---|---|---|
| Geral | tamanho do texto, idioma, escola e turma que já vêm escolhidas | A1 |
| Notificações | o que avisa e por onde. **O horário é fixo**: só no horário útil da escola (D59) | F13 |
| Assistente | instruções para o Assistente, padrões das ferramentas, "preparar a semana" por turma (D32). Busca na web **não** tem chave aqui: liga por conversa (D68) | F7, F11 |
| Tutor nas turmas | o que é da escola aparece só para leitura (`foraDaSala`, D19); o professor liga `PoliticaTutor.busca` por turma e com prazo, se a escola liberou (D68); trava em avaliação sempre ligada | F9 |
| Perfil e vínculos | o vínculo é criado pela escola e o professor só confirma (regra 60, item 8a) | F1, F2 |
| Privacidade e dados | conversas só dele; quem abriu o dado nominal (D45); pedir revisão de indicador (LGPD, art. 20); exportar tudo (D63); apagar o histórico | F3, F12 |
| Segurança e acesso | conta Google ou Microsoft da escola (D48) ou senha; duas etapas; aparelhos conectados e "sair de todos" | F1 |
| Como a IA funciona aqui | o que cada agente faz sozinho; processamento no Brasil (D62); canal de denúncia (D61) | F12 |

De propósito **não existe** plano, faturamento, crédito nem consumo: o cliente é a escola, e o
professor não vê consumo (D2, D40). As seções são filtradas por papel.

**O que o produto precisa.** `PreferenciaUsuario` (por usuário e, quando couber, por escola) e a
linha dela na tabela da LGPD. **"Aparelhos conectados" e "sair de todos" pedem registro de sessão
no servidor**, que o F1 não descreve: conferir com o Joaquim antes de prometer. Duas etapas para
professor é opcional; o F1 só prevê para a coordenação. As instruções para o Assistente são texto
livre, com o mesmo risco do P05. O mockup chegou a mostrar "Escuro (em breve)"; a seção 7 do
`docs/interface.md` diz **modo escuro: fora**, e o mockup foi corrigido.

**Onde entra.** A **casca** (menu da pessoa com "Sair" e "Como a IA funciona aqui") é da A1; cada
seção nasce com a fase dela. **Dono:** Joaquim.

---

## C. Ajustes de escopo em fase que já existe

### P10 — "Nota" do aluno na sala · AJUSTE (D46, F6, F17)

O Gabriel pediu "ver as notas na matéria dele", e o mockup mostra uma média de 0 a 10 por aluno.
A **D46** diz: primeiro o diagnóstico formativo, depois a nota oficial; a **A3 não tem `Nota`**,
e a regra 70, item 1, só admite nota com autor humano. Então: **no F6 e na A3 a lente mostra
acerto (%)**, que sai do diagnóstico aprovado; **no F17 ela passa a mostrar a nota** que o
professor lançou. Uma média calculada pelo sistema não se chama "nota" em lugar nenhum antes do
F17. **Dono:** Joaquim, no PRD da A3.

### P11 — "Minhas turmas" vira a sala de aula · DECISÃO + AJUSTE (D69, F6)

**O que mudou.** A D69 descreve a aba com desempenho, dificuldades, evolução e alunos que
precisam de atenção — visão **da turma**. O Gabriel rejeitou: "para o professor não importa a
média da turma, importa cada aluno". Ficou a **sala**: um palco com exatamente uma carteira por
aluno da turma, em ordem de chamada; uma **lente** (acerto, entregas, dificuldades; faltas quando
existir); um **filtro** que "acende" quem responde a uma pergunta ("quem travou em reagente
limitante?"); busca por nome; "Esconder", que tira números e cores para quando a tela está
projetada; e a **ficha do aluno** ao clicar. A evolução e o "conteúdo com mais erro" da turma
saíram da tela do professor; o agregado continua existindo para a coordenação e o Analista.

**O que o produto precisa.**

- **Decisão.** Revisão do **conteúdo** da D69 (a estrutura de abas continua). Os **limiares** de
  cor são a decisão em aberto "indicadores de turma e aluno" do `CLAUDE.md`, que fecha antes do
  PRD do F6. Ponto de partida do mockup: acerto abaixo de 50% é atenção, de 50 a 75% é meio, 75% ou
  mais vai bem; entregas: três ou menos de cinco é atenção
- **Dado.** Acerto **por aluno e por habilidade** (o F6 já entrega o diagnóstico por habilidade);
  entregas por aluno ("concluiu o que foi atribuído", D69); a ordem de chamada — o modelo não tem
  número de chamada: ou entra `numeroChamada?` no vínculo do aluno, ou a ordem é a alfabética
- **Conformidade.** Perfil acadêmico individual é **alto risco** no CNE: a AIA do diagnóstico
  (D60) precisa cobrir esta tela; a ficha diz de onde vem cada número e tem caminho de
  contestação (o aluno contesta o que o sistema sabe do trabalho dele, D66). **Dificuldade é de
  conteúdo** — habilidade da BNCC, com a página do material — nunca de atenção, concentração ou
  comportamento (D57, D66, regra 70 item 7). No áudio o Gabriel pode ter dito "dificuldade de
  concentração": isso o produto não mostra
- **Autorização.** O professor só abre aluno de turma dele; trocar o id da turma ou do aluno na
  URL devolve "não encontrado" (regra 20, item 5). Aluno com nome só para o professor da turma
  (D34). As "perguntas prontas" são filtro determinístico: **não há IA**, não há custo, não há AIA
  extra
- **Teste.** A sala tem exatamente o número de alunos com vínculo confirmado na turma; "Esconder"
  tira valor e cor; aluno sem diagnóstico aparece sem número, não com zero

**Sétima e oitava rodadas (20/09).** Ao ver o painel da Teachy o Gabriel voltou atrás no "sem
métricas da turma": a sala deixou de ser a tela inteira de "Minhas turmas" e virou a subaba **Sala**
dentro de **Alunos**, na turma aberta com nove abas (P28). Tudo o que está acima continua valendo
para a sala; a estrutura da tela passou para o P28.

**Onde entra.** A3 (fatia com uma turma e a lente de acerto) e F6. **Dono:** Joaquim; os
limiares, Gabriel e Joaquim.

### P12 — Calendário no desenho da Teachy · AJUSTE (F8)

**O que mudou.** O Gabriel escolheu um template do 21st.dev (`vaib215/event-manager`): mês,
semana, dia e lista, busca e filtros por turma e por tipo. Do template **saíram "novo evento" e o
arrastar**: a grade vem da escola, e o professor não monta nem move aula (regra 60, item 8; o F8
fecha com "vê o que precisa fazer sem cadastrar nada"). Clicar numa aula abre só **"O que vou
dar"**, que é o `Aula.conteudo` do modelo. Feriado e conselho de classe entram como
`EventoCalendario`.

**Sétima rodada (20/09).** O calendário foi redesenhado no modelo da Teachy. O mês mostra uma linha
por evento; a semana tem uma coluna por dia com as aulas em cartões empilhados, **sem grade de
horas**, e "A preencher" onde falta o conteúdo; o dia tem os mesmos cartões e o painel "Falta
preencher". **A visão Lista saiu.** Criar e mover aula continuam proibidos.

**Em aberto, e é de tenancy.** O mockup mostra **as aulas das duas escolas da professora no mesmo
calendário**. A regra 10 diz que o token carrega **a escola ativa** e que o seletor do topo
filtra tudo. Juntar duas escolas numa tela pede duas consultas, cada uma no seu escopo, somadas
no cliente — ou o calendário mostra só a escola ativa, com um aviso de que há aula na outra.
**Recomendação: só a escola ativa.** Decidir no PRD do F8, com o `tenancy-guardian`.

**Front.** O calendário é rota carregada sob demanda (10.4); o template foi reescrito sem
`date-fns` e sem `uuid`. **Onde entra:** F8, fora do MVP. **Dono:** Joaquim.

### P13 — Biblioteca no desenho do Google Docs · AJUSTE (F7)

**O que mudou (duas vezes).** Primeiro deixou de ser lista e virou estante com pastas por tipo. Em
20/09 o Gabriel achou confuso ("difícil de se organizar") e pediu o desenho do Google Docs: **grade de
miniaturas da página**, com o nome, o tipo, a turma e a data embaixo, e o menu de três pontos (abrir,
exportar, mover para um projeto, fazer uma cópia, apagar). Uma linha de controles: busca, filtro por
tipo, filtro por turma, ordem (mais recentes ou de A a Z) e a troca entre **grade e lista**. As pastas
saíram: quem organiza é o Projeto (P05). O estado só aparece quando pede ação ("Rascunho", "Espera
você").

**O que o produto precisa.**
- **Dado.** O `docs/modelo-de-dados.md` **não tem a entidade do artefato**, e o F7 fala em "artefato
  salvo e ligado à turma". Precisa de `Artefato* → escola*, anoLetivo*, autor*, turma?, ferramenta*
  (tipo), titulo*, conteudo (estruturado), fontes[] (material e página), origem (conversa |
  ferramenta), projeto?, adaptadaDe?, estado, criadoEm*, modificadoEm*`
- **Miniatura.** No mockup é desenho por tipo com o título de verdade. No produto há duas saídas: (a)
  manter o desenho por tipo, montado no cliente a partir de `ferramenta` e `titulo`, sem custo; (b)
  imagem da primeira página, gerada no servidor quando o artefato é salvo — mais fiel, mas é fila,
  armazenamento por escola e mais um dado a apagar na eliminação (D63). **Recomendação: (a) no MVP.**
  Se for (b), a imagem não pode ter nome de aluno (versão adaptada e lote de correção ficam no desenho).
  **Sétima rodada:** o Gabriel chamou o esqueleto de barrinhas de "capas falsas"; o mockup desenha o
  **começo do texto de verdade**, minúsculo. Isso cabe na saída (a): o cliente desenha as primeiras
  linhas a partir do `conteudo` que a listagem já devolve (um resumo curto, não o documento inteiro),
  sem imagem e sem fila
- **API.** Listagem paginada com filtro por tipo, turma e texto, e ordem por `modificadoEm` ou título;
  índice por escola e autor. "Fazer uma cópia" e "mover para um projeto" são escrita com auditoria
  comum; "apagar" é exclusão lógica, com o prazo da política de retenção
- **Teste.** Isolamento (artefato de outra escola e de outro professor não aparece, nem pela busca);
  apagar some da grade e da busca

**Onde entra:** A2 (o que a demonstração gera aparece na grade) e F7. **Dono:** Joaquim.

### P14 — O time na lateral, e a thread com filtro por função · AJUSTE (F11)

Cada agente é uma linha da lateral, com avatar e contador; clicar abre a thread em **tela
cheia** — a coluna do meio com a lista de threads saiu. A thread é uma linha do tempo por dia: o
que espera a pessoa tem ponto laranja e destaque. Na do Assistente, filtros: tudo · esperando
você · correção · adaptação · seu dia (P01). Endereço antigo (`/time/corretor`) abre o Assistente
já filtrado. **O que o produto precisa:** um contador leve por agente (pendentes mais não-lidos,
definir a conta), atualizado por evento ou na navegação, sem martelar a API (regra 80); a regra
50, item 6, continua — o feed não aparece vazio, e quem garante isso agora é a função "seu dia".
**Sétima rodada:** a thread virou conversa, com balões e caixa de resposta. O que isso pede está no
P29. **Onde entra:** A2 (casca, com Seu time; D72 revista) e F11. **Dono:** Joaquim.

### P15 — Home sem atalhos, com "Esperando você" · FRONT

Saíram os atalhos em pílula abaixo da caixa de pedido (a 11.2 os descreve): as ferramentas já
estão no menu da caixa. No lugar ficam as **entregas que esperam a professora**, em cartões, com
o ícone da função, o que foi feito e a ação. A linha do dia virou atalho para o calendário. O
atalho digitando `/` (1.1) não foi desenhado e não mudou. **Onde entra:** A2.

### P16 — A pergunta da D18 como cartão de escolha · FRONT

"Quer usar a ferramenta?" deixou de ser um cartão largo com dois botões vazios: é uma frase do
Assistente e um cartão estreito com **duas opções do mesmo peso** — ícone, título, uma frase —,
que encolhe para uma linha depois da escolha. Nenhuma das duas é a "certa" (D59). **Onde
entra:** A2; atualizar 1.1 e 11.3.

### P17 — Menu de ferramentas com rolagem, e ícone ilustrado · FRONT

O menu da caixa de pedido crescia até sair da tela: virou um **retângulo de tamanho fixo** (320
px por até 292 px) com rolagem por dentro, que encolhe ou vira para cima se a janela for baixa —
`shadcn/scroll-area` sobre `shadcn/popover`. O menu lê o **mesmo catálogo** da página (P23); fica de
fora só a Correção de objetiva, que não nasce de pedido.

Na página de Ferramentas, o ícone de cada ferramenta é **ilustração** em SVG (referência do Gabriel:
os da Teachy). A primeira versão, em traço preto, foi reprovada em 20/09 ("não estão legais"); a
segunda é desenho **com volume e sem contorno** — papel com dobra, laranja e preto em degradê, sombra
própria —, e cada ícone mora num **ladrilho na cor da categoria** (pêssego, cinza, preto, laranja). A
9.4 diz "ícone é lucide": a ilustração é exceção só para o cartão e a página da ferramenta; em tamanho
pequeno continua lucide. São 17 SVGs feitos à mão, sem biblioteca e sem imagem: cerca de 25 kB de
fonte, que entram na rota de Ferramentas, **fora do primeiro carregamento** (10.4). Cuidado de
Chromebook: o desenho usa `filter: drop-shadow` em SVG, que o Chrome 109 aceita, mas pesa em grade
longa — medir no aparelho de referência antes de fechar.

**Refeito mais duas vezes (20/09).** Na sétima rodada: minimalista, um objeto por ícone, cinzas e preto
com um acento laranja, ladrilho neutro único. Na oitava, no estilo da Teachy: **chapado, sem contorno,
sem sombra e sem ladrilho**, laranja no lugar do azul deles e **um ou dois acentos fora da paleta**
(verde-água, amarelo, rosa, roxo, azul). O `drop-shadow` saiu, o que resolve o cuidado de Chromebook. Os
acentos batem na P02, que diz "três cores e mais nenhuma": ver P31. **Onde entra:** A2.

### P18 — Menu da pessoa no modelo do ChatGPT · FRONT

O nome em cima, depois "Personalizar o Assistente" e "Configurações", depois "Como a IA funciona
aqui", "Ajuda" e "Sair". **Sair continua a um clique e do mesmo tamanho dos outros** (D59).
**Onde entra:** A1.

### P19 — Coordenação › Agentes, por função · AJUSTE (F12, A5)

Consequência do P01: o cartão do Assistente lista as **funções**, cada uma com a autonomia em
português comum, o selo de alto risco, o resumo da AIA e o botão de **suspender só aquela
função**. No registro da governança, a linha passa a dizer "Assistente · correção de objetiva".
**Onde entra:** A5 e F12.

---

### P22 — Catálogo de ferramentas: a regra "ferramenta ou chat", e oito ferramentas novas · NOVO + DECISÃO · a regra, fechada em 23/09/2026

**O que mudou.** Em 20/09 o Gabriel deu a regra para decidir o que é ferramenta: **é ferramenta a ação
específica que entrega um output próprio** — coisa com formato, que fica na biblioteca, sai em arquivo
e pode ser aplicada (um plano completo, uma apresentação, um mapa mental). **Não é ferramenta o que o
chat já responde** (e-mail, ideia de atividade, resumo de um texto, pergunta sobre um PDF): isso é
pedido ao Assistente (P24). Com a regra, o mercado de "60 ferramentas" vira **17**, em quatro
categorias:

| Categoria | Ferramentas | Situação |
|---|---|---|
| **Planejar** | Plano de aula (uma aula ou sequência didática) | no roteiro (F7) |
| | **Planejamento do período** · **Projeto** · **Plano de recuperação** | **novas** |
| **Preparar a aula** | Apresentação · Material didático · Adaptação | no roteiro (D67) |
| | **Mapa mental** · **Roteiro de experimento** | **novas** |
| **Avaliar** | Prova · Atividade e lista · Simulado ENEM | no roteiro (A2, D21) |
| | **Avaliação diagnóstica** · **Proposta de redação** · **Importar prova** | **novas** |
| **Corrigir** | Correção de objetiva · Redação e discursiva | no roteiro (A3, D55) |

Ficaram de fora, por regra que já existe: corretor de redação (D55), PEI (D67), relatório sobre aluno
e qualquer campo que descreva aluno (D35, D57, D66), folhinhas de educação infantil (regra 70), e o
que depende de gerar áudio ou imagem (sem decisão; a origem das imagens da apresentação já está em
aberto na D67).

**O que é decisão.** (1) A **regra** em si, que vale registrar como D nova: ela é o critério para
aceitar ou recusar pedido de ferramenta daqui para frente, e evita o catálogo inchar. (2) A **lista
do F7**, fixada pela D67, que ganha oito nomes: é revisão de escopo de fase. (3) As **quatro
categorias** e seus nomes, que aparecem na tela e na busca.

**O que cada ferramenta nova exige do produto** (todas: um contrato de entrada e um caso de uso, D18;
perfil de modelo na regra 30; fonte citada com página; teste de regra de negócio e de isolamento):

| Ferramenta | O que ela tem de próprio | Cuidado |
|---|---|---|
| **Planejamento do período** | escreve "o que vou dar" em cada aula que **já existe** no calendário; respeita feriado e avaliação marcada | **depende do F8** (calendário). A professora **não monta grade de horário** (regra 60, item 8): a ferramenta só preenche conteúdo. Salvar no calendário é ação dela, depois de revisar; sem isso, nada é escrito |
| **Projeto** | etapas com data, papéis, entregas parciais e rubrica do produto | as datas vêm do calendário (F8); a rubrica nasce antes da aplicação (D55) |
| **Plano de recuperação** | parte do **diagnóstico da turma por habilidade** (F6) | é plano da **turma e da habilidade**: nenhum campo em que caiba descrever um aluno (D57, D66), e o teste prova isso. A chave "avisar o Tutor" é o contexto estruturado do professor (D66): é do F5, e sem o F5 a chave não aparece |
| **Mapa mental** | saída **visual**, não texto | formato novo: a D67 fala em PDF, PPTX e XLSX. O mapa sai em PDF; o desenho é montagem determinística a partir de uma estrutura (nós e ramos) que o modelo devolve — o modelo **não** desenha. Cada ramo cita a página |
| **Roteiro de experimento** | materiais, passo a passo, **segurança e descarte**, perguntas do relatório | a seção de segurança é **obrigatória no contrato de saída** e o teste recusa roteiro sem ela. Experimento com risco (fogo, ácido, vidraria) exige a marcação "laboratório" ou "demonstração do professor". Passa pelo `pedagogia-reviewer` |
| **Avaliação diagnóstica** | cada questão mira um pré-requisito; o resultado sai por habilidade | é a Prova com outro fim: reaproveita o caso de uso. Discursiva curta é corrigida pelo professor (D55). Não gera nota (D46) |
| **Proposta de redação** | tema, comando, textos motivadores e **rubrica por competência** | texto motivador só do material licenciado ou de fonte aberta, com a referência (D5); nunca da web sem rótulo (D68). A correção continua sendo do professor (D55) |
| **Importar prova** | PDF ou Word vira prova editável, questão a questão | é **ingestão** (F4): declaração de origem obrigatória (D5), prova de sistema de ensino sem licença é recusada; o arquivo original guarda com a escola; se a prova tiver nome ou resposta de aluno, não entra (regra 20). Imagem dentro da questão precisa vir inteira: é o caso difícil do parser |

**Onde entra.** A regra e as categorias: a skill `registrar-decisao`, antes do PRD da A2 (o catálogo aparece na
demonstração). As oito novas: `descobrir ferramentas-novas`, uma a uma, e só então entram no F7 — **nenhuma
entra no MVP de apresentação sem decisão**; na A2 a tela pode mostrar só as que existem. **Dono:**
Gabriel decide o catálogo; Joaquim ratifica e estima.

**Fechado em 23/09/2026, em parte:** a regra e as quatro categorias viraram a **D74**. As oito
ferramentas novas continuam em `descobrir`, uma a uma, antes do F7.

### P23 — Ferramenta é dado: um motor de formulário, não uma tela por ferramenta · FRONT + arquitetura

**O que mudou.** No mockup a ferramenta passou a ser uma **entrada de catálogo** (`id`, nome,
categoria, texto do cartão, promessa, formatos de saída, fonte, campos, o que vem no resultado), e uma
tela só desenha qualquer uma. A página, o menu da caixa de pedido e o cartão da conversa leem do mesmo
lugar. Tipos de campo: turma, material, texto, texto longo, chips com padrão, cartões de opção (com a
consequência na frase), chave, contadores, habilidades (BNCC ou diagnóstico da turma), arquivo e aviso.

**O que o produto precisa.**
- **Um contrato por ferramenta, em `packages/shared`**: o schema Zod da entrada é a fonte; o formulário
  é derivado dele mais um descritor de apresentação (rótulo, exemplo, ordem, padrão). É o que a D18 já
  pede ("um contrato de entrada e um caso de uso"), agora sem tela escrita à mão
- **O descritor mora no código, não no banco**: ferramenta nova é entrega versionada, com teste e AIA
  quando couber — não cadastro feito por alguém em produção
- **Padrões vêm do servidor**, não do catálogo: a turma, o material permitido àquela turma (D5), a
  duração da aula (calendário) e as habilidades do capítulo. O mockup fixa tudo em arquivo
- **Validação nos dois lados** com o mesmo schema; o back nunca confia no formulário (regra 10)
- **Orçamento:** o motor entra na rota de Ferramentas, fora do primeiro carregamento (10.4)
- **Exceções assumidas:** Prova, Adaptação e Redação e discursiva têm tela própria, porque o fluxo não
  é "preencher e gerar" (versões, lista fechada de tipos, três passos com correção cega)

**Onde entra:** Tech Spec da A2. **Dono:** Joaquim.

### P24 — "O resto é só pedir": o que o chat faz sem ferramenta · AJUSTE (F7)

**O que mudou.** A página de Ferramentas termina num painel que diz o que **não** é ferramenta e leva
à conversa com o pedido já escrito: ideias de atividade, exemplos do dia a dia, questões sobre um
texto ou PDF, resumir e reescrever um texto, perguntas por nível, explicar uma habilidade da BNCC,
tabela de dados, recado para as famílias, responder e-mail, ideias para evento, dúvida de conteúdo. A
busca da página também responde: quem procura "e-mail" vê "isto não é ferramenta: é só pedir".

**O que o produto precisa.**
- **Nada de contrato novo**: é a conversa comum, sem artefato. O que muda é o **detector de intenção**
  da D18: ele precisa distinguir "pedido que tem ferramenta" (pergunta antes de usar) de "pedido que o
  chat responde" (responde direto). Entra no conjunto de avaliação do F5/F7, com casos dos dois lados
- **Salvar da conversa para a biblioteca**: a promessa da tela ("o que você quiser guardar, salva de
  lá") exige a ação "salvar como material" numa resposta do chat — vira `Artefato` com origem
  `conversa` (P13). Sem isso, a frase sai da tela
- **Recado e e-mail** levam nome de aluno e de família no texto da professora: o mascaramento antes do
  provedor (regra 20, item 12) cobre este caminho, e o teste usa exatamente um pedido de recado
- **Questões sobre texto, PDF ou vídeo** dependem de anexo (P07) e, no vídeo, da web ligada (D68):
  enquanto P07 não for decidido, esses três itens saem do painel

**Onde entra:** PRD da A2 (o painel) e F7 (salvar da conversa). **Dono:** Joaquim.

### P25 — Página da ferramenta em duas colunas · FRONT

À esquerda o formulário; à direita, fixo, **o que vem no resultado** (lista), **em que formato sai**,
**de onde vem o conteúdo** (material da escola com a página, banco público do ENEM, o arquivo enviado),
o aviso "espera você aprovar" quando a saída nasce pendente, e o mesmo pedido em forma de frase, com
"pedir na conversa" — que abre a Home com o texto e a ferramenta já escolhidos. Regras de desenho do
formulário: turma e material primeiro e já preenchidos; a professora digita um campo; escolha fechada
é chip com o padrão marcado; o opcional diz "opcional"; o exemplo do campo é um pedido-modelo. Acima
do botão: "A IA pode errar. Você revisa antes de usar, e nada vai para a turma sem você."
No celular a coluna da direita desce para baixo do formulário. **Onde entra:** A2.

## D. Peças e cuidados de front

### P20 — Peças novas do 21st.dev, e licença a conferir · FRONT

O protocolo da 10.1 pede `autor/slug` e a licença lida na página da peça, antes de o código
entrar. Destas rodadas:

| Peça | Onde é usada | Situação |
|---|---|---|
| `shadcn/scroll-area` (803) | menu de ferramentas | origem shadcn/ui, MIT; pede `@radix-ui/react-scroll-area` |
| `vaib215/event-manager` (9127) | Calendário | **licença a conferir**; reescrita: sem criar, sem arrastar, sem `date-fns` e `uuid`, semana começando na segunda (o original calculava a semana errado) |
| "file-upload" | anexar documento | **autor e licença a identificar** (o Gabriel colou o código). Saíram `border-beam` — feixe azul em laço, fora da paleta e da regra de movimento — e `@hugeicons`, trocado por lucide |
| "file-card-collections" | anexo na conversa e arquivos de Projetos (a Biblioteca passou a usar a miniatura da página, que é nossa) | **autor e licença a identificar**. A etiqueta do formato saiu das dez cores para preto, cinza e laranja |
| "folder" | pastas de Projetos (saiu da Biblioteca em 20/09) | **autor e licença a identificar**. Cor por variável; o movimento é só `transform` |
| `theshanelevine/approval-card` (23595) | pergunta da D18 | só o **desenho**; o código é nosso |
| `felipemenezes098/comment-thread-3` (19073) | linha do tempo do time | só o desenho |
| `sean0205/statistics-card-7` e `line-charts-1` | "Meu uso" | só o desenho; o gráfico é SVG à mão, porque `recharts` estoura os 150 kB |
| `leaderboard-*` | Ranking de participação (P26) | **proibida pela 10.2** do `docs/interface.md`; autor e licença a identificar se o P26 for aceito |
| HextaUI `messaging-conversation` e `messaging-people-list` | Seu time em conversa (P29) | **licença a conferir** (o Gabriel colou o código) |
| Quicksand e Inter (fontes) | Ferramentas e Turmas (P31) | licença OFL, pode redistribuir; o que pesa é o orçamento: são duas fontes a mais no primeiro carregamento (regra 50) |

**Dono:** Gabriel identifica as peças coladas (as três primeiras, `leaderboard-*` e as da HextaUI);
Joaquim confere as licenças.

### P21 — O que o mockup faz e o produto não pode copiar · FRONT

- **Conversa e projeto no `localStorage`.** No produto é estado de servidor, no TanStack Query, e
  nada sensível vai para `localStorage` nem para a URL (regra 50, itens 3 e 7)
- **Dado em arquivo**, sem escopo de escola. No produto, todo acesso passa pelo repository, com
  escopo tirado do token (regra 10), e a resposta é DTO explícito (regra 20, item 4)
- **Falta dos quatro estados** (regra 50, item 5). Projetos, Biblioteca e Histórico têm o vazio; a
  sala, o calendário e as Configurações não têm carregando nem erro
- **Opacidade em cor** (`bg-white/10`) vira `color-mix()`, que o Chrome 109 do Chromebook não
  garante: já está na seção 7 do `docs/interface.md`
- **Id gerado com `Math.random`**; no produto é UUID do servidor (regra 10, item 7)
- **Sem teste nenhum.** No produto cada item acima nasce com o teste de regra de negócio e o de
  isolamento (regra 40)

---

## E. Da sétima e da oitava rodada (20/09/2026)

Na sétima rodada a Teachy virou o modelo. Na oitava, o Gabriel pediu uma cópia fiel dela em Ferramentas
e em Turmas ("um ctrl c e ctrl v"). As medidas foram tiradas da Teachy real. Os itens abaixo são o que
essas duas rodadas trouxeram de novo; o que elas mudaram nos itens anteriores está anotado em cada um
(P08, P11, P12, P13, P14, P17, P20).

### P26 — Ranking de participação na turma · DECISÃO

**O que é.** A aba **Ranking** da turma aberta tem um pódio com três alunos e a turma inteira em lista,
com as peças `leaderboard-*` que o Gabriel colou. Pontua **presença na aula (+10)** e **atividade
entregue (+20)**; nota e dificuldade não contam. No empate, fica na frente quem entregou mais cedo. Há
um período (bimestre e outros), "Esconder nomes" para quando a tela está projetada, e a frase "Só você
vê este ranking. O aluno vê apenas os próprios pontos". O Gabriel pediu um ranking "comportamental".
O mockup trocou a palavra por "participação" e só pontua fato registrado.

**Com o que bate.**
- O `docs/interface.md` 10.2 **proíbe pelo nome** placar, pódio e as peças `leaderboard-*` (D59 e
  Decreto 12.880, arts. 9º e 10: recompensa por uso)
- **Pontuação social** e perfil comportamental classificatório são risco excessivo no CNE (D57, regra
  70). Ordenar alunos por presença e entrega chega perto disso, mesmo sem nota
- A regra 50, item 9, não se aplica ao professor: ela proíbe dado de colega na tela **do aluno**. Mas
  "o aluno vê os próprios pontos" já é pontuação exposta ao aluno. E, com a tela projetada e o botão
  de esconder desligado, a sala inteira vê o pódio
- A presença depende do P08, que não tem origem de dado

**A alternativa que entrega o mesmo objetivo.** O professor quer saber quem não está participando.
As abas Atividades e Frequência já mostram, sem ordenar ninguém: quem não entregou e quem faltou,
em ordem de chamada.

**Onde entra.** `descobrir ranking-de-participacao`, com o Joaquim e com a AIA dos sinais (D60). Até
lá fica fora do MVP de apresentação e do F6. **Dono:** Gabriel e Joaquim.

### P27 — Convidar alunos: link, WhatsApp e código da turma · AJUSTE (D3, F2)

**O que é.** O "Adicionar alunos" da Teachy. É um diálogo aberto pelo "Convidar alunos" da lista de
turmas e pelo "Adicionar" da aba Alunos. Tem o **link da sala** com botão de copiar, um **botão do
WhatsApp** (o único verde de marca no sistema), o **código da turma**, a **validade** com "Gerar novos"
e os **pedidos para entrar**: quem reivindicou um nome da lista da turma, com aprovar e recusar. O
aluno não digita nada sobre si (D3, D4).

**O que o produto precisa.**
- **Token.** A regra 20, item 8, pede token único, com expiração, uso único e revogação. O link da
  sala é de uso múltiplo por natureza (a turma inteira usa o mesmo). O que fica único é a
  **reivindicação**: cada nome da lista só é reivindicado uma vez (restrição única no banco, regra 80
  item 7). "Gerar novos" revoga o link e o código anteriores na hora
- **Código curto é adivinhável.** Precisa de tentativa limitada por escola e por turma, nunca só por IP
  (regra 80, item 1), e de expiração curta
- **WhatsApp.** É só um link de compartilhar (`wa.me` com o texto): não há integração, API nem dado
  enviado à Meta além do texto. O texto leva o nome da escola e o link, **nunca nome de aluno**
- **Teste.** Link vencido ou revogado não abre; dois alunos reivindicando o mesmo nome no mesmo
  segundo (regra 40); o pedido de uma turma não aparece para o professor de outra

**Onde entra.** PRD da A1, que passou a ter o núcleo do F2 (D71 revista, 23/09/2026): é lá que o
aluno entra no sistema. O F2 completa depois o que ficou de fora (grade, calendário, Classroom,
reset de senha). **Dono:** Joaquim.

### P28 — A turma aberta com nove abas, no modelo da Teachy · DECISÃO + NOVO

**O que mudou.** "Minhas turmas" virou **Turmas**. A lista traz cartões só com disciplina, nome e a
barra de desempenho com o percentual dentro, mais "Meu uso", "Filtrar" e "Convidar alunos" (não há
"Criar turma": a turma vem da coordenação, D3). A turma aberta tem **nove abas**, e o conteúdo rola
como documento:

| Aba | O que tem | Situação |
|---|---|---|
| Visão Geral | três métricas e as quatro perguntas empilhadas | revisão do conteúdo da D69 (o painel volta, depois do P11) |
| Atividades | tabela das atividades e o detalhe de quem fez | F6, F7 |
| Recursos | enviar à turma o que está na Biblioteca, e parar de compartilhar | **NOVO** |
| Mural | o professor publica para a turma, com anexo da Biblioteca | **NOVO** |
| Alunos | tabela da turma, a subaba **Sala** (P11) e o "Adicionar" (P27) | F6, F2 |
| Notas | acerto por atividade e média | P10: acerto até o F17, nota depois |
| Uso de IA | percentual de alunos que usam o Tutor, evolução, dúvidas que se repetiram, onde travaram por habilidade | F9, D8 |
| Frequência | chamada do dia | P08 |
| Ranking | pódio de participação | P26 |

"Meu uso", na lista de turmas, é o **espelho do professor** (D45): o que ele mais usou, quem abriu o
dado dele com nome e o pedido de revisão de um indicador. Está de acordo com a D45 e a D64, desde que
continue sendo só dele.

**O que pesa.**
- **Recursos** é a entrega de artefato ao aluno. Enviar **é** a aprovação da regra 70, item 3: o
  registro precisa de autor e data, e a saída de IA que nunca foi aprovada não pode aparecer na lista
  de envio. Pede uma entidade de envio (artefato × turma ou grupo, quem enviou, quando, e se foi
  retirado) e a tela do aluno que recebe. Não existe em fase nenhuma
- **Mural** é comunicação do professor com a turma. Pede retenção, exclusão e o lugar na tabela da
  LGPD. O primeiro desenho não tem comentário de aluno; se tiver, vira moderação e dado de aluno.
  Aviso de post novo só no horário útil da escola (D59). Não existe em fase nenhuma
- **Uso de IA** mostra o uso do Tutor pelos alunos da turma, e isso cabe na D8. A tela já diz que o
  Tutor "não mede tempo parado, não lê humor e não acompanha a navegação" (regra 70, item 7). Nunca
  vira indicador do professor (D64)
- **Visão Geral** traz de volta métricas da turma, que o P11 tinha tirado. Os limiares são os
  mesmos do P11

**Onde entra.** A estrutura e as abas que já têm fase: PRD da A3 e do F6. **Recursos** e **Mural**:
`descobrir` de cada um, fora do MVP até lá. **Dono:** Joaquim; Recursos e Mural, Gabriel e Joaquim.

### P29 — Seu time em formato de conversa · AJUSTE (F11)

**O que mudou.** A thread de cada agente virou conversa, sobre a peça `messaging-conversation` da
HextaUI. O agente fala em balão à esquerda e a professora responde à direita, com anexos e ações
embaixo do balão. A faixa "Esperando você" fica presa no alto e a caixa de resposta, no pé. Na
lateral, "Seu time" segue a `messaging-people-list`: avatar com ponto de estado, última mensagem e
não lidas.

**O que o produto precisa.**
- **Responder ao agente é um pedido novo.** A resposta da professora é mensagem com autor humano na
  thread. Se ela pede algo ("refaz com menos questões"), é chamada de modelo: passa pela porta, com
  perfil e orçamento (regra 30, D14), e a thread e o chat do P06 passam a ser a mesma conversa ou
  duas coisas com fronteira clara. Decidir qual no PRD do F11
- **Ação dentro do balão** ("aprovar", "abrir a prova") é a mesma aprovação registrada de sempre
  (regra 70, item 3): o balão só chama o caso de uso, não é um atalho em volta dele
- **Ponto de estado e não lidas** não podem virar pressão de uso (D59). "Online" num agente não diz
  nada. O ponto mostra só "tem algo esperando você"

**Onde entra.** A2 (casca, com Seu time; D72 revista) e F11. **Dono:** Joaquim.

### P30 — Seletor de escola como espaço de trabalho · FRONT + tenancy

**O que mudou.** O seletor de escola ficou no modelo de seletor de espaço de trabalho: sigla, rede,
turno, número de turmas e a marca de escolhido. O seletor de turma da caixa de pedido mostra o código
num ladrilho e **agrupa as turmas por escola**. No mockup, trocar de escola muda o rótulo e o menu de
turma, mas o time e a Home continuam na primeira escola.

**O que o produto precisa.** Trocar de escola é **trocar o token** para a nova escola ativa (regra
10) e descartar o cache da anterior inteiro, não só o rótulo. Então o seletor de turma **não pode
listar turmas de duas escolas** na mesma lista, pela mesma razão do calendário (P12). Mostra as da
escola ativa; escolher a turma de outra escola troca a escola antes. **Teste:** depois da troca,
nenhuma tela mostra dado da escola anterior.

**Onde entra.** A1, que é a casca. **Dono:** Joaquim, com o `tenancy-guardian`.

### P31 — Segunda pele: Ferramentas e Turmas copiadas da Teachy · DECISÃO · fechado em 23/09/2026

**O que mudou.** Nessas duas áreas o desenho da Teachy ganha do nosso. A página tem título (contra
o P03), rola como documento (contra o "cabe na janela"), o botão tem canto de 8 px (contra a pílula
do P02), as fontes são **Quicksand** nos títulos e **Inter** no corpo (contra a fonte do sistema), e os
ícones são coloridos com acentos fora da paleta (contra "três cores e mais nenhuma"). A troca de cores
foi: o azul da Teachy virou o nosso laranja, e as bordas e os fundos ficaram neutros. A pele mora em
`mockups/src/components/turmma/teachy.tsx`. No resto do sistema continua a pele do P02.

**O que precisa ser decidido.** O produto tem **uma** pele. Ou a da Teachy se estende a tudo, e a D72
(P02) nasce assim; ou Ferramentas e Turmas voltam para a do P02, ficando só o layout. Duas peles
dobram o trabalho da A1 e da A2. As duas fontes a mais pesam no orçamento de carregamento do
Chromebook (regra 50).

**Cuidado.** A Teachy é concorrente direta. Copiar fielmente layout e medidas de concorrente pode ser
lido como concorrência desleal (trade dress). O que ajuda: as cores, os ícones, os textos e a marca
são nossos. **Conferir com o advogado antes do material de venda.**

**Onde entra.** Antes do PRD da A1, junto do P02 (vira a D72). **Dono:** Gabriel decide; Joaquim
estima.

**Fechado em 23/09/2026 (D72):** uma pele só, a do P02. Da Teachy fica só a **estrutura** — o
catálogo em categorias e a turma aberta com abas —, sem Quicksand e Inter, sem o canto de 8 px, sem
as medidas tiradas da tela deles e sem os acentos fora da paleta. Isso tira a pergunta de trade
dress do caminho. O Gabriel precisa ser avisado: a oitava rodada pedia o contrário.

---

## F. O que trava o quê

1. **Antes do PRD da A1:** P01, P02, P03, P04 e P31 — **fechados em 23/09/2026** (D32, D9 e D60
   revistas; D72; D73). O avatar é de **três** agentes, e o Gabriel entrega o desenho antes da
   Tech Spec da A2 (D72 revista em 25/09/2026). A A1 passou a ser "a escola" (D71 revista): entram no PRD dela o P27 (convite da
   turma) e o P30 (seletor de escola); P18 entra na Tech Spec da A1, na parte da casca; P14 e P29, com Seu time, na A2
2. **Antes do PRD da A2:** P06 (fatia mínima), P13, P15, P16, P17, P23, P24, P25. A **regra** do P22 (o que é
   ferramenta) já é a D74
3. **Antes do PRD da A3:** P10, P11, P28 (a estrutura da turma aberta) e os limiares dos indicadores
4. **Antes do PRD da A5:** P19
5. **Só depois de `descobrir`:** P05, P07, P08, P26, Recursos e Mural (P28) e as **oito ferramentas
   novas** do P22. Nada disso entra no
   MVP de apresentação sem decisão; o Planejamento do período e o Projeto ainda dependem do F8, e o
   Plano de recuperação, do F6
6. **Com a fase de cada um:** P09 (seção por seção) e P12 (F8)
7. **Antes de qualquer código vindo do 21st.dev:** P20
