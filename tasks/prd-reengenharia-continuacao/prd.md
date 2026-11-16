# PRD — Reengenharia, continuação (X6)

**Status:** aprovado (Joaquim, 15/11/2026, no terminal do Arquiteto)
**Funcionalidade do roadmap:** X6
**Depende de:** X5 (concluída), F4 (concluída: levou a 45.0 e a 46.0)

Recorte do Joaquim, 14/11/2026. Os números (42.0…) são os da X5 (`tasks/prd-reengenharia/tasks.md`); o desenho que ela deixou
está em `onda-3a.md` e `onda-3c.md`, e a Tech Spec o confere contra o código de hoje.

## 1. Problema

Às 10h, seis turmas usam o Tutor e uma professora gera uma prova. Hoje o modelo roda **dentro do processo da API**
(`InProcessAgenteExecutor`), e os dois disputam a mesma vaga; um provedor lento, ou que recuse por limite, segura a API, e o
aluno pode ver erro cru. Na rede da escola, uma chamada da web que trava
deixa a tela girando para sempre. Com o Redis fora, a escolha de escola não trata o caso. E a regra de que conversa de aluno
só vai a provedor com processamento no Brasil (D62) depende de alguém configurar certo: nenhum código confere.

## 2. Objetivo

A IA roda fora da API, numa fila em que o Tutor em sala não espera pela ferramenta do professor. Ela degrada sem erro cru
e nunca manda texto de aluno para fora do Brasil, e a web nunca fica presa numa chamada sem fim. É o que o F5, o F11 e o
piloto (D84) esperam desta spec.

## 3. Fora de escopo

- **O provedor de reserva e o roteamento para ele** (D29), o teto por escola em reais e a avaliação de modelos (D37):
  F5. Aqui o gateway só **recusa** a chamada que leva texto de aluno quando o provedor não processa no Brasil
- Thread, limite de passos e de custo por execução, e o Analista disparado por evento: F11
- Tela nova ou mudança de tela além do "Tentar de novo" e da tela de falha descritos aqui
- **O resto da X6, que vai para a fase dona** (decisão do Joaquim): `conformidade/` e o risco à vida e a D55 abaixo do
  alvo para a F9 e a F7; as leituras prontas para a F13, a F12 e a F4b; a cobertura, os subcaminhos e a onda 5 do e2e
  para a F16; o corte de cada tela para a spec que tocar nela; e o OpenAPI para quando houver consumidor fora do `apps/web`
  (D81). A tabela item a item está no `ROADMAP.md`, seção X6, e o `TODO.md` aponta para lá. Já estão feitas a 31.0, a
  45.0, a 46.0 e a 59.0

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Aluno | receber a resposta do Tutor com a escola cheia; ver "Tentar de novo" sem gastar a troca | receber erro cru; ter a conversa enviada para fora do Brasil |
| Professor | usar as ferramentas sem atrasar o Tutor; ver no uso a troca sem resposta, sem o texto | ocupar a vaga do Tutor |
| Coordenação | trocar de escola com o Redis fora, sem perder tentativa | ver dado de outra escola em métrica ou alerta |
| Operador Turmma | receber alerta de fila cheia, provedor fora e tokens perto do teto, com runbook | ver usuário, conversa ou nome em métrica ou alerta (D76) |

## 5. Requisitos funcionais

**A IA no worker (42.0, 47.0)**

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | Toda chamada de modelo (o Tutor, as ferramentas, a proposta de ferramenta, a adaptação e o Analista) roda no worker, por job. Nenhuma requisição da API espera o modelo | O módulo HTTP da API não monta o provedor de IA; um teste exige um job registrado para cada tarefa de IA; o turno do Tutor passa pela fila |
| RF2 | O Tutor e as ferramentas do professor rodam em filas separadas, com vaga por escola em cada uma | Com 4 ferramentas da escola rodando, a 5.ª espera e o Tutor da mesma escola responde; a escola B segue com as vagas dela |
| RF3 | Execução entregue duas vezes, ou com o worker morto, não chama o modelo de novo nem responde em dobro: fica `falhou` com `EXECUCAO_INTERROMPIDA`, a troca não conta, e o consumo estimado fica registrado a mais, nunca a menos (D14, D49) | Teste com o worker morto e com entrega duplicada: uma chamada, uma resposta, uma troca |
| RF4 | No worker, o assunto delicado grava a mensagem fixa e o sinal ao professor mesmo com a execução descartada (D36), e a avaliação que abre depois do pedido faz a troca não contar (X5, RF3) | Os testes de hoje das duas regras passam pela fila; o sinal não duplica na reentrega |
| RF5 | A pergunta do Tutor que espera mais de 20 s na fila termina sem modelo, com "Tentar de novo", sem contar a troca e visível ao professor; o operador recebe alerta com runbook, que separa "uma escola grande" de "falta capacidade" | Relógio falso: a de 21 s termina indisponível, a ferramenta de 21 s roda; alerta e runbook conferidos |
| RF6 | O p95 do turno do Tutor piora no máximo 1 s. Na carga da manhã, com 10 escolas, a espera p95 do Tutor fica abaixo de 2 s, a da ferramenta abaixo de 10 s, e nenhum aluno vê "indisponível" | k6 com o adaptador falso, build anterior e o da tarefa na mesma sessão; números no relatório |

**O gateway (49.0, 50.0)**

| # | Requisito | Como se prova |
|---|---|---|
| RF7 | Toda chamada de modelo passa por um limite de tokens por minuto, abaixo do contratado e somado entre as réplicas; o trabalho que não é do Tutor nem da ferramenta usa até metade dele. A ferramenta tem teto próprio, abaixo do do Tutor. Perto do teto, o pedido espera até 8 s, depois vai ao modelo menor do mesmo perfil (não no Tutor, até ele passar pela medida da D36) e só então termina indisponível, sem contar a troca e nunca com erro cru (regra 80.4) | Relógio falso, um teste por degrau; réplicas somam; Redis fora: cada uma segura a sua parte |
| RF8 | A IA mede duração, erro, disjuntor aberto, degrau e uso do teto, sem usuário nem escola; "Provedor de IA fora" e "Tokens acima de 80 %" alertam, com runbook | Cada degrau muda a sua métrica; teste de alertas e guarda do runbook |
| RF9 | O worker de IA (`main-worker`) não consome fila com provedor externo cujo suboperador vigente não tenha processamento no Brasil, treinamento vedado e a categoria "conversa do aluno" (D62). O adaptador falso e o modelo local consomem; com o banco fora, o worker não consome fila. A prontidão da API não depende da D62: a API não monta provedor, e travá-la tiraria login, prova e sala do ar por um cadastro da IA (regra 80; Joaquim, 16/11, na 8.0) | Um teste de subida por caso; com a D62 não conferida, a API responde pronta e o worker não consome |
| RF10 | A chamada que leva texto de aluno é recusada pelo gateway, antes de qualquer envio, se o provedor não declara processamento no Brasil. Toda tarefa de IA declara se leva texto de aluno | Marca ligada e provedor sem a declaração: nenhum envio, erro tipado; tarefa sem a declaração não compila |

**A web e o Redis (52.0, 54.0, 56.0)**

| # | Requisito | Como se prova |
|---|---|---|
| RF11 | Toda chamada da web à API tem prazo (leitura 20 s, PDF 30 s, envio de arquivo 180 s, resposta de prova 10 s). Quando o prazo estoura, a tela mostra "Tentar de novo"; quando quem chamou cancela, não aparece erro. Uma resposta de prova pendurada não trava as outras (regra 80.6) | Cliente com relógio falso; lint barra `fetch` fora do cliente; prova com um envio pendurado |
| RF12 | Quando uma tela quebra fora de uma área, aparece a tela de falha com o caminho de volta, e não a página branca | Teste com um componente que lança na raiz |
| RF13 | Com o Redis fora, o segundo fator e a escolha de escola respondem "indisponível, tente de novo", com o tempo de espera, e não gastam tentativa. A web espera esse tempo uma vez | Teste com o Redis fora nas duas rotas; teste da web com o `Retry-After` |

**Transversal**

| # | Requisito | Como se prova |
|---|---|---|
| RF14 | A suíte fica verde, e os e2e obrigatórios da regra 40 e as invariantes das regras 10, 20 e 70 continuam provados. `docs/infra.md`, `docs/arquitetura.md`, o guia do desenvolvedor e a AIA do Tutor dizem onde a IA roda agora | Esteira verde no último commit; leitura do Validador |

## 6. Regras de negócio

- O que a escola vê só muda no RF5, no RF11 ao RF13 e no degrau do RF7. A conformidade é a mesma, agora no worker
- O job de IA leva só o id da execução. A escola vem do registro do job, e o repository aplica o escopo (regra 10)
- A conferência do assunto delicado roda antes da fila, sem modelo (D36): a mensagem fixa nunca espera vaga
- O Tutor desligado (D84), suspenso (D9) ou fora da política da turma (D19) não cria job
- Nenhum teste chama provedor pago (regra 80.11)

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Às 10h, seis turmas usam o Tutor e a professora gera uma prova de 50 s | O Tutor responde dentro da meta; a prova espera a vaga de ferramenta, não a do Tutor |
| Uma escola de 900 alunos enche as vagas dela | Só ela espera, e o alerta diz "uma escola grande" |
| O professor abre a avaliação com a dúvida de um aluno na fila | A resposta não sai e a troca não conta; "quero sumir" ainda recebe o CVV e o sinal |
| A rede da escola trava no meio da prova | A resposta pendurada estoura em 10 s e volta para a fila de reenvio; as outras questões seguem |
| O Redis cai às 7h30 enquanto a coordenação troca de escola | "Tente de novo" com o tempo de espera, sem gastar tentativa |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Job de IA em `job_registro` (só o id da execução) | aluno, professor, pelos ids | rodar a IA fora da API e provar que rodou | a da linha de hoje: 7 dias concluído, 30 falhou | sim, linha do `job_registro`; a linha passa a citar os tipos `ia.*` |
| Consumo estimado da execução interrompida (`consumo_ia`) | aluno, nas funções do Tutor | freio diário e custo (D14, D38) | a da linha de hoje | sim |

Nenhum campo novo. A conversa continua só em `mensagem_tutor`; as métricas de IA não levam usuário, e só a da espera estourada leva a escola, como contagem.

## 8b. Risco regulatório

O Tutor é alto risco (CNE). A supervisão não muda: o professor vê o uso como hoje (D8, D47). A D62 passa a ser conferida
pelo código, e a D36 continua no worker. A AIA do Tutor
(`docs/aia/tutor.md`) diz onde ele roda e registra como limitação o turno que termina sem modelo (espera, teto, D62), em que
só a regra da D36 vale. O `conformidade-reviewer` revisa as tarefas do RF1 ao RF5, do RF7 e do RF10.

## 9. Métricas

Chamadas de modelo no processo HTTP da API: zero. As do RF6. Erro cru de IA ao aluno nos testes de falha: zero.

## 10. Perguntas em aberto

- O teto real de tokens e o modelo menor de cada perfil dependem da D37
- "1 ferramenta por minuto por escola" é premissa sem fonte (`onda-3a.md`): a carga da manhã a mede
- O uso por menor nos termos do provedor (regra 20, item 13) segue pendência da D37
