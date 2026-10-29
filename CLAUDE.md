# Turmma — contexto e decisões

> **Antes deste arquivo, leia `docs/visao-produto.md`.** Ele explica o que estamos
> construindo e para quem. Este aqui lista o que já foi decidido (o texto e o porquê estão em
> `docs/decisoes.md`), para não rediscutirmos a mesma coisa toda semana.
>
> **O produto se chama Turmma** (D54). A marca, a paleta e a landing page existem em
> `turmma.com`; o registro no INPI e o do domínio seguem pendentes (`TODO.md`). O
> repositório, os pacotes, o banco, o compose e os comandos continuam `educa`: a renomeação
> técnica é trabalho próprio e não vale o risco no meio do F1.
> Repositório: https://github.com/Turmma/turmma (na organização `Turmma` desde 29/10/2026; é **público**. O antigo,
> `LitzGab/Turmma.ai`, não recebe mais push)

---

## Em uma frase

Um assistente com agentes de IA supervisionados para a escola: o professor tem chat e
ferramentas que produzem a partir do material que a escola pode usar, o aluno usa IA em
sala com o professor vendo, a coordenação organiza a escola e acompanha o uso de IA e o
desempenho de alunos e professores, e a família acompanha. A IA prepara o trabalho e avisa;
a escola aprova (D44).

## O recorte

**Anos finais do Ensino Fundamental (6º ao 9º) e Ensino Médio**, em **escolas particulares
e redes públicas**, começando por Joinville (D43, D20). Em sala, o aluno usa **qualquer
computador da escola** (Chromebook, notebook, laboratório). **Web-first e responsivo**: a
Lei 15.100/2025 tirou o aparelho pessoal da sala, então nada no produto pode depender do
telefone do aluno; mas toda tela funciona também no celular, para o aluno fora da escola e
para professor e coordenação em qualquer lugar (D51).

## Quem constrói

**Joaquim** implementa, com o Claude executando as tarefas do processo SDD e o Joaquim
revisando. **Gabriel** cuida de marca, landing page, benchmark e comercial. Mercado, preço
e concorrência estão em `docs/negocio.md`.

## Quem é quem

| Papel | Usa | Paga | O que precisa |
|---|---|---|---|
| Coordenação | sim | decide a compra | governança de IA e de ensino, alertas, auditoria |
| Professor | sim | não | tempo, e confiança de que nada entra no boletim sem ele |
| Aluno | sim | não | uma IA que ensina em vez de entregar a resposta |
| Família | fase posterior | sim, via mensalidade | nota, entrega, alerta |
| Prefeitura | não diretamente | contrato | governança de rede e resposta pronta sobre LGPD |

A regra que orienta as prioridades: **professor e aluno precisam gostar e usar; coordenação
e família precisam confiar.** Se o professor não gostar, a escola não renova. Se a família
não confiar, a escola não compra.

---

## Decisões tomadas

Uma linha por decisão: número e título. O texto completo, com o motivo e as revisões, está em
`docs/decisoes.md`. **Leia a decisão lá antes de citá-la, de discuti-la de novo ou de implementar
algo que dependa dela.** Nova decisão ou revisão entra lá e aqui, pela skill `registrar-decisao`.

| D | Decisão |
|---|---|
| D1 | Sistema inteiro como alvo, com MVP de apresentação (D71) e piloto gratuito em 2027 |
| D2 | O cliente é a instituição: sem cadastro público |
| D3 | Onboarding por convite, sem cadastro individual |
| D4 | A identidade do aluno passa por aprovação humana |
| D5 | Pipeline único de ingestão, só com licença que permite o uso |
| D6 | Indexação pela BNCC, com rastreio até a página |
| D7 | Nota nunca é publicada sem aprovação humana |
| D8 | O tutor é sempre visível ao professor |
| D9 | Autonomia do agente declarada e visível, por função |
| D10 | A escola é controladora dos dados; nós somos operadores |
| D11 | WhatsApp e portal da família depois; o motor de eventos agora |
| D12 | Backend e frontend separados, multi-tenant, sem trava de fornecedor |
| D13 | IA por porta e adaptador, com Ollama local no desenvolvimento |
| D14 | Orçamento de tokens por aluno e por escola, medido desde a primeira chamada |
| D15 | Construção do zero |
| D16 | A stack está ratificada |
| D17 | Agentes têm nome de função, não nome próprio |
| D18 | Chat e ferramentas são o mesmo motor |
| D19 | Tutor fora da sala: configuração da escola por turma, desligada por padrão |
| D20 | Escola particular e rede pública, alvo juntas |
| D21 | Banco público de questões do ENEM, no F7 |
| D22 | A ingestão começa pelo upload de PDF licenciado |
| D23 | O trabalho acontece na `develop`; `release` e `main` por merge |
| D24 | Quatro coisas que a coordenação vê na primeira semana |
| D25 | Infra do primeiro ano para até dez escolas |
| D26 | Banco, Redis e storage na VM no início, gerenciados na migração |
| D27 | 99,5% de disponibilidade no horário letivo |
| D28 | Hospedagem em região Brasil |
| D29 | Modelo em produção por API, com contrato e reserva |
| D30 | Infra custa até R$ 2 por aluno por mês |
| D31 | Produção na VM própria, com deploy automático pela `main` |
| D32 | Três agentes: Assistente de ensino, Tutor e Analista de desempenho escolar |
| D33 | Nota de objetiva aprovada em lote, com os fora da curva abertos antes |
| D34 | Aluno em risco nomeado só ao professor da turma |
| D35 | A coordenação registra a adaptação, nunca o diagnóstico |
| D36 | Assunto pessoal delicado no tutor vai para um humano |
| D37 | O provedor de modelo sai de avaliação com amostras sintéticas |
| D38 | Tutor com pacote mensal por turma e freio diário por aluno |
| D39 | IA custa até R$ 5 por aluno por mês na escola particular |
| D40 | A escola paga por aluno, sem crédito visível |
| D41 | Rede pública: pacote de rede com piso de preço |
| D42 | O provedor de nuvem é escolhido na migração, AWS como candidata |
| D43 | Recorte: 6º ao 9º ano e Ensino Médio, em qualquer computador da escola |
| D44 | Assistente com agentes supervisionados |
| D45 | O professor é medido em espelho, sem ranking |
| D46 | Primeiro o diagnóstico formativo, depois a nota oficial |
| D47 | O tutor é supervisionado, não aprovado resposta por resposta |
| D48 | Login pela conta da escola, ou por matrícula |
| D49 | Fila de jobs com entrega ao menos uma vez e idempotência |
| D50 | Preço por aluno com faixas de pacote |
| D51 | Toda tela responsiva e usável no celular |
| D52 | Integração da infra fora do portão de toda tarefa, na esteira |
| D53 | Processo enxugado onde repetia trabalho |
| D54 | O produto se chama Turmma |
| D55 | Discursiva e redação: a IA não corrige, não dá nota nem sugere nota, e não pré-corrige |
| D56 | Na objetiva, a validação humana é registrada |
| D57 | Usos vedados, escritos e testados |
| D58 | Agentes com identidade de função, sem se passar por pessoa |
| D59 | Nada induz uso excessivo; sair nunca é mais difícil que entrar |
| D60 | Avaliação de Impacto Algorítmico por funcionalidade de alto risco |
| D61 | O dossiê de conformidade é entregável de produto |
| D62 | Conversa de aluno só em provedor com processamento no Brasil |
| D63 | O que a escola e o professor produzem é deles, em formato aberto |
| D64 | Recusar a ferramenta não gera indicador |
| D65 | Letramento em IA por três portas pequenas |
| D66 | A memória do Tutor é o trabalho do aluno, nunca a pessoa |
| D67 | Ferramentas de apresentação e material didático, com exportação aberta |
| D68 | Busca na web por ativação do professor |
| D69 | "Turmas" na navegação do professor, desde o F6 |
| D70 | Sair da aba é fato mostrado ao professor, só durante a prova |
| D71 | MVP de apresentação depois do F1, com dado sintético |
| D72 | A pele do produto é uma só em todas as telas |
| D73 | Cada item da navegação só aparece com a fase dele |
| D74 | É ferramenta o que entrega um output próprio |
| D75 | O material da escola entra pela coordenação |
| D76 | Painel de operação da equipe Turmma |
| D77 | O MVP de apresentação (A2 a A5) é uma fatia só, com processo enxuto |
| D78 | O processo roda no Maestri: um andar por spec, um comando |
| D79 | O processo é revisto para tempo |
| D80 | A pele é o sistema Turmma do mockup de outubro |
| D81 | Padrão de mercado antes de mecanismo próprio |

## Conflitos já resolvidos e decisões em aberto

**Conflitos já resolvidos** (login do aluno, notificação à família, importação por planilha, scraper,
discursiva e redação, nome do produto, tutor e aprovação, fila de jobs, processo de construção, nome de
peça técnica, nome e lista de agentes, medir o professor, adaptar sem gerar o PEI, MVP, pele, vigiar a
navegação, escola particular ou rede pública, Chromebook, celular): no topo de `docs/decisoes.md`.
Cada um já voltou uma vez; leia antes de reabrir o assunto.

**Decisões em aberto:** `docs/decisoes-em-aberto.md`, cada uma com dono e momento. Para fechar uma,
peça ao Orquestrador (`/seguir`).

---

## Stack

**Backend** NestJS + TypeScript, Postgres, Drizzle, BullMQ + Redis, JWT próprio, storage
S3-compatível. **Frontend** React + Vite + TypeScript, TanStack Query, Tailwind, web-first
e responsivo, do computador fraco de escola (Chromebook como referência) ao celular (D51). **Tempo real** WebSocket para o modo sala. **IA** interface `LLMProvider`
com adaptadores Ollama e OpenAI-compatível. **Testes** Vitest e Playwright. **Infra**
Docker Compose.

O critério que guiou tudo isso: nada pode impedir que o sistema inteiro suba em um servidor
no Brasil, se um contrato exigir.

---

## As seis regras que não se negociam

1. **Vazamento entre escolas encerra a empresa.** Escopo de tenant no repository, sempre.
   Regra 10.
2. **Dado de menor é o ativo mais perigoso do sistema.** Leia `docs/lgpd.md` antes de tocar
   em qualquer campo de pessoa. Regra 20.
3. **Nada que a IA produz vira nota, mensagem à família ou decisão sobre aluno sem aprovação
   humana registrada.** É lei. Regra 70. E em discursiva e redação a IA não chega nem a
   propor: não corrige, não avalia, não pré-corrige (D55).
4. **Nenhum módulo chama provedor de IA direto.** Sempre pela porta, sempre com perfil e
   orçamento. Regra 30.
5. **Teste prova regra de negócio.** "Retornou 200" não é teste. Regra 40.
6. **O horário de aula é sagrado.** Dimensione para a manhã de segunda, limite por usuário
   e por escola (nunca só por IP), e nenhuma resposta de prova se perde. Regra 80.

---

## Mapa dos documentos

**Para entender o produto:** `docs/visao-produto.md`, `docs/fluxos.md`, `docs/glossario.md`
**Para entender a interface:** `docs/interface.md`
**Para ver a interface desenhada:** o mockup de outubro, em `mockups/` (cópia de `Prototipo_Turmma`,
branch `mockups/interface`, commit `a95568d`, trazida em 16/10/2026; D80). A versão de setembro, anterior
à pele nova, está no histórico do git e em `mockups/.antes-da-remodelagem/`. **Nada de mockup é copiado
para o `apps/web`** nem para os `packages/`, com uma exceção: o traço da onça, copiado para
`apps/web/src/componentes/ui/onca/` e guardado por teste contra o original (D80, revista em 28/10/2026)
**Para saber o que a revisão dos mockups mudou e ainda não virou decisão:**
`docs/pendencias-dos-mockups.md` (31 itens, com o que cada um pede de tela, API, dado, regra e teste)
**Para entender o negócio:** `docs/negocio.md` (mercado, preço, concorrência). Não é leitura
obrigatória para implementar
**Para não quebrar a lei:** `docs/lgpd.md`, `docs/regulacao.md`
**Para responder ao que a escola pergunta na compra:** `docs/conformidade-mec.md` (os dois
documentos do MEC virados em requisito, o dossiê de conformidade e a AIA)
**Para escrever a AIA de uma funcionalidade de alto risco:** `docs/aia/` (índice e o que toda
AIA precisa ter; uma por funcionalidade, antes do PRD dela)
**Para escrever código no padrão da casa:** `docs/guia-do-desenvolvedor.md` (receitas e travas)
**Para construir:** `docs/arquitetura.md`, `docs/modelo-de-dados.md`, `docs/agentes.md`,
`docs/ingestao.md`
**Para não cair no horário de aula:** `docs/infra.md`, `docs/runbook.md`
**Para escolher modelo e medir custo de IA:** `docs/avaliacao-de-modelos.md`
**Para saber o que já foi decidido, por extenso:** `docs/decisoes.md` (com os conflitos já resolvidos
no topo); o que está em aberto, em `docs/decisoes-em-aberto.md`
**Para saber como cada skill de terceiros conflita com as regras:** `docs/skills-de-terceiros.md`
**Para trabalhar:** `README.md`, `ROADMAP.md`, `TODO.md`, `.claude/rules/` e `.claude/skills/`

Só as regras 10, 20 e 70 estão sempre no contexto. As regras 00, 30, 40, 50, 60 e 80 carregam sozinhas só
quando se lê arquivo do caminho delas (`paths:` no topo de cada uma). Quem escreve PRD, Tech Spec ou
tarefa lê explicitamente a 00, a 40, a 60 e a 80, e a 30 e a 50 quando há IA ou tela.

---

## Skills

O comando é um só, **`/seguir`** (D78). O time (Orquestrador e quatro papéis), os revisores, o hook de
commit e a lista das skills estão em `.claude/skills/seguir/time.md`; como os agentes conversam, em
`.claude/skills/seguir/protocolo.md`.

<critical>As skills de terceiros (`skills-lock.json`) são referência técnica genérica. Quando conflitam
com `.claude/rules/` ou com uma decisão (`docs/decisoes.md`), a regra e a decisão vencem. Os conflitos
conhecidos, um por skill, estão em `docs/skills-de-terceiros.md`.</critical>
