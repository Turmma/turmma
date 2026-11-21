# PRD — Camada de IA

**Status:** aprovado (Joaquim, 20/11/2026)
**Funcionalidade do roadmap:** F5
**Depende de:** F0, X6 (49.0: limite de tokens por minuto e degradação; 50.0: soberania na subida e na chamada)

## 1. Problema

A coordenadora pergunta "quanto de IA a escola usou?", e a Governança diz que o custo "ainda não é medido". A Operação não
sabe se uma escola passa dos R$ 5 por aluno (D39): `custo_micros` é sempre zero. Se o provedor cair às 10h, seis turmas no Tutor
ficam sem resposta, porque não há reserva (D29). E sem a avaliação (D37) não há provedor, preço nem contrato.

## 2. Objetivo

Toda chamada tem custo em reais e cai na reserva quando o principal cai, sem texto de aluno sair do Brasil; Operação e
coordenação veem o consumo contra o orçamento; e o principal e a reserva saem de uma avaliação executada.

## 3. Fora de escopo

- **Provedor fora do Brasil**, mesmo em tarefa sem dado pessoal: a D62 permite, o piloto não usa (Joaquim, 20/11/2026)
- **Cortar o uso ao fim do orçamento** (D40). O único corte segue sendo o do Tutor (D38)
- **Custo por professor ou por aluno** (D45, D64) e **crédito visível** (D40)
- **A chave do Tutor por escola** no painel da Operação (D84): é da F9
- **Cache de prompt e streaming simulado**, salvo se a carga pedir; **`complexo` e `visao` na avaliação** (pouco uso; D83)
- **Custo de infra em reais** (D76, D82) e **assinatura do contrato**, que é do Joaquim antes da primeira escola real

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Operador Turmma | definir valor de IA por aluno e teto de segurança, por rede e por escola; ver por escola chamadas, tokens, reais, custo por aluno, porcentagem e o que a reserva atendeu | ver pessoa, conversa, entrada ou saída de chamada |
| Coordenação | ver a porcentagem do orçamento do mês, a parte de cada função e o pacote do Tutor; receber os avisos de 80% e 100% | ver reais ou tokens; mudar o orçamento |
| Professor e aluno | nada novo: reserva e custo não aparecem | ver custo, crédito, provedor ou modelo |

## 5. Requisitos funcionais

**Reserva e soberania**

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | A produção tem principal e reserva, cada um com o seu contrato no cadastro de suboperadores e a mesma conferência da subida (D62). A reserva que não passa fica fora do caminho, sem derrubar o principal, com alerta à Operação | Reserva sem contrato no Brasil: o worker sobe, nenhuma chamada vai a ela, o alerta dispara |
| RF2 | Cada tarefa só sai para provedor cujo contrato cobre tudo o que ela envia: Brasil quando há texto de aluno, treinamento vedado, as categorias da tarefa | Reserva sem a categoria conversa de aluno e principal fora: o Tutor não chega a ela, a geração de atividade chega |
| RF3 | Principal caído (fora, erro de servidor, prazo) → a chamada vai à reserva no mesmo perfil, dentro do prazo da execução. Principal recusando por limite → espera, modelo menor, reserva (regra 80.4). Nunca erro cru | Principal falso fora: a reserva responde |
| RF4 | O Tutor só cai na reserva se o modelo dela passou nas amostras do Tutor (RF13). Sem isso, indisponível como hoje, com a regra fixa da D36 | Reserva não aprovada para o Tutor e principal fora: o turno termina indisponível sem chamar a reserva |
| RF5 | A linha de consumo guarda o provedor e o modelo que atenderam a chamada; a tentativa que trocou de modelo ou provedor conta cada chamada com o seu custo | A chamada da reserva aparece com o provedor dela na lista de compartilhamento do aluno (LGPD, art. 18, VII) |

**Custo e orçamento**

| # | Requisito | Como se prova |
|---|---|---|
| RF6 | Toda chamada registra o custo em reais pelo preço vigente, de entrada e de saída, do modelo que atendeu. Modelo sem preço não sobe fora do ambiente local. Preço novo vale só para as chamadas seguintes | 3.000 + 250 tokens a um preço fixo gravam o custo exato; depois da troca, a chamada antiga mantém o seu |
| RF7 | A Operação define, por rede e por escola, o valor de IA por aluno por mês (D39, D41) e o teto de segurança (padrão 2× o orçamento); o da escola vale sobre o da rede; cada mudança vai à auditoria | A escola sem valor próprio usa o da rede; a mudança tem registro com o operador |
| RF8 | Orçamento do mês = valor por aluno × alunos ativos (a mesma conta da aba Escolas). Porcentagem = custo do mês civil de São Paulo ÷ orçamento | 100 alunos, R$ 5 por aluno, R$ 400 gastos: 80% |
| RF9 | A 80% e a 100%, alerta à Operação (com runbook) e aviso à coordenação no Painel, uma vez por limiar por mês. Nada é cortado | Ao cruzar 80%, um aviso; a chamada seguinte não gera outro; a 100%, a IA responde |
| RF10 | Acima do teto de segurança, só a fila de lote da escola espera, até o mês virar ou a Operação subir o teto, com alerta. O Tutor e a ferramenta com o professor esperando nunca param por orçamento | Acima do teto, o job de lote é adiado e o turno do Tutor é atendido |

**O que cada um vê**

| # | Requisito | Como se prova |
|---|---|---|
| RF11 | Na aba Uso da Operação, por escola, no dia, no mês e nos meses anteriores, ao lado da infra: chamadas, tokens, reais, custo por aluno ativo contra o valor por aluno, porcentagem e chamadas da reserva, com ordem por custo. Sem pessoa (D76) | Sem campo de pessoa; usuário de escola não alcança a rota |
| RF12 | No Painel e na Governança, a coordenação vê "IA do mês: N% do previsto", a parte de cada função em porcentagem e o pacote do Tutor (D38). A resposta dela não traz reais nem tokens | Teste de contrato sem custo e sem tokens; a tela não escreve "R$" |

**Avaliação dos modelos (D37)**

| # | Requisito | Como se prova |
|---|---|---|
| RF13 | Amostras sintéticas fixas e versionadas cobrem a seção 3 de `docs/avaliacao-de-modelos.md` e reúnem os lotes retidos que já existem, o da classificação (F4b) e o do risco à vida (D36) | Amostras no repositório, com o sha256 de cada lote no relatório |
| RF14 | Roda à mão, uma vez por finalista, com crédito de teste, fora da esteira (regra 30); a chave fica fora do repositório, as saídas brutas dentro | Guarda de segredo verde; nenhum teste automatizado chama a ferramenta |
| RF15 | Antes do crédito, os eliminatórios contratuais (seção 3.1) são conferidos na fonte e os finalistas, revistos: na pesquisa de 20/11/2026 o Google deve sair (termos do Google Cloud, 20(d), vedam serviço provável de ser acessado por menor; nenhum Gemini atual processa no Brasil), e AWS Bedrock em São Paulo e Magalu Cloud entram a confirmar como reserva. O relatório dá a taxa por amostra contra o limiar, os eliminatórios, latência, tokens, custo e tokens por minuto oferecidos | Seção 1 revista com fonte e data; um relatório por finalista conferido |
| RF16 | Principal e reserva registrados na D37 revista, com os preços e o contratado de tokens por minuto (`docs/infra.md` 5.4). As AIAs das funções com modelo dizem principal, reserva e modelo menor | D37 cita o relatório; `conformidade-reviewer` aprova as AIAs |

## 6. Regras de negócio

- Texto de aluno só em provedor com processamento no Brasil em contrato (D62), também na reserva e na falha; na dúvida, não sai
- O teto de segurança existe contra defeito e abuso, não como cobrança; orçamento é configuração, nunca constante (D41)
- O custo registrado superestima, nunca subestima (D14): a execução interrompida leva o teto da tarefa, com custo
- Nenhum número de consumo forma indicador de professor (D45, D64)
- Função de alto risco abaixo da taxa mínima no modelo escolhido não liga para escola real (D60); a classificação confere primeiro

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Principal fora às 10h com seis turmas no Tutor | Reserva, se aprovada para o Tutor; senão "Tentar de novo" (X6) e a regra fixa da D36 |
| Principal e reserva fora juntos | Indisponível, sem erro cru; "Provedor de IA fora" dispara para os dois |
| Contrato da reserva vence no meio do mês | A Operação encerra o suboperador; no reinício do `worker-ia` a reserva sai do caminho e o principal segue |
| Preço sobe no meio do mês | Chamadas novas no preço novo; o mês soma os dois; o custo antigo não muda |
| Escola sem aluno ativo (montagem, virada do ano letivo) | Sem porcentagem e sem aviso; a Operação vê os reais e "sem aluno ativo" |
| Escola sem valor por aluno, nem na rede | "Sem orçamento definido" na Operação; o consumo segue registrado, sem aviso |
| Aluno que chega em maio ou sai transferido | Entra na conta pelos alunos ativos, com a regra da aba Escolas |
| Virada do mês | A porcentagem recomeça, os avisos voltam a valer, o lote adiado volta à fila |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Provedor que recebeu a chamada, agora principal ou reserva (`consumo_ia.provedor`) | aluno; professor, indireto | dizer por onde o dado passou (art. 18, VII) | a da linha de consumo | sim; a linha passa a citar a reserva |
| Valor por aluno e teto de segurança, com o operador que mudou | nossa equipe | prestação de contas da operação | vigência + 5 anos, como a auditoria da operação | não: entra a linha |

Nenhum campo novo de aluno ou professor; as amostras são sintéticas.

## 8b. Risco regulatório

Não há função de IA nova; muda quem atende. O Tutor e a classificação (alto risco, D60) podem passar a outro modelo, e por
isso **a reserva só atende o Tutor se passou nas mesmas amostras do principal** (recusa de três formas, escopo, D36, D58,
português real). As AIAs registram o modelo de cada função. Supervisão e aprovação humana não mudam (regra 70, itens 3 e 4);
a equidade em português é eliminatória (seção 3.1).

## 9. Métricas

- Custo real por aluno ativo por mês, por escola, contra os R$ 5 da D39, no 1º mês do piloto
- Chamadas atendidas pela reserva, e as indisponíveis com o principal fora
- Zero chamada com texto de aluno em provedor sem contrato no Brasil, conferido na lista de compartilhamento
- A avaliação executada, com amostras e eliminatórios respondidos

## 10. Perguntas em aberto

- **(Tech Spec)** Onde moram os preços e a vigência deles: configuração versionada ou tabela da Operação
- **(Tech Spec)** Como a reserva declara as tarefas para as quais foi aprovada (RF4), e se vale para a classificação
- **(Tech Spec)** Quem é "aluno ativo do mês" quando o número muda: o do dia, o maior ou a média
- **(Tech Spec)** Onde fica o aviso da coordenação sem o sino (F13)
- **(Joaquim)** As chaves de teste dos finalistas para rodar a avaliação (RF14); sem elas a F5 não fecha (D37)
- **(Joaquim, depois da avaliação)** Sem finalista no Brasil que passe no Tutor, a D62 volta à mesa, como ela prevê. Sem segundo
  provedor no Brasil, a reserva é outro modelo da Maritaca: cobre a queda do modelo, não a do provedor
