# PRD — Camada de IA

**Status:** aprovado (Joaquim, 20/11/2026). No corte de 21/11/2026 (Joaquim), a reserva e a avaliação foram para a F5b
(`tasks/prd-reserva-e-avaliacao/prd.md`), sem mudar requisito; os números dos RF continuam os da F5
**Funcionalidade do roadmap:** F5a
**Depende de:** F0, X6 (49.0: limite de tokens por minuto e degradação; 50.0: soberania na subida e na chamada)

## 1. Problema

A coordenadora pergunta "quanto de IA a escola usou?", e a Governança diz que o custo "ainda não é medido". A Operação não
sabe se uma escola passa dos R$ 5 por aluno (D39): `custo_micros` é sempre zero. Se o provedor cair às 10h, seis turmas no Tutor
ficam sem resposta, porque não há reserva (D29), e sem a avaliação (D37) não há provedor, preço nem contrato: essas duas
são da F5b.

## 2. Objetivo

Toda chamada tem custo em reais, e Operação e coordenação veem o consumo contra o orçamento.

## 3. Fora de escopo

- **O provedor de reserva e a avaliação dos modelos** (RF1 a RF4, a parte da reserva do RF5 e do RF6, RF13 a RF16): F5b,
  `tasks/prd-reserva-e-avaliacao/prd.md`
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

**Custo por chamada**

RF1 a RF4 (a reserva e a soberania dela) foram para a F5b.

| # | Requisito | Como se prova |
|---|---|---|
| RF5 | A linha de consumo guarda o provedor e o modelo que atenderam a chamada; a tentativa que trocou de modelo conta cada chamada com o seu custo. A parte da reserva (o provedor dela na lista de compartilhamento do aluno) é da F5b | Troca para o modelo menor: duas linhas, cada uma com o seu modelo e o seu preço; a saída inválida repetida: duas linhas |

**Custo e orçamento**

| # | Requisito | Como se prova |
|---|---|---|
| RF6 | Toda chamada registra o custo em reais pelo preço vigente, de entrada e de saída, do modelo que atendeu. Modelo do principal sem preço não sobe fora do ambiente local (o da reserva é da F5b). Preço novo vale só para as chamadas seguintes | 3.000 + 250 tokens a um preço fixo gravam o custo exato; depois da troca, a chamada antiga mantém o seu |
| RF7 | A Operação define, por rede e por escola, o valor de IA por aluno por mês (D39, D41) e o teto de segurança (padrão 2× o orçamento); o da escola vale sobre o da rede; cada mudança vai à auditoria | A escola sem valor próprio usa o da rede; a mudança tem registro com o operador |
| RF8 | Orçamento do mês = valor por aluno × alunos ativos (a mesma conta da aba Escolas). Porcentagem = custo do mês civil de São Paulo ÷ orçamento | 100 alunos, R$ 5 por aluno, R$ 400 gastos: 80% |
| RF9 | A 80% e a 100%, alerta à Operação (com runbook) e aviso à coordenação no Painel, uma vez por limiar por mês. Nada é cortado | Ao cruzar 80%, um aviso; a chamada seguinte não gera outro; a 100%, a IA responde |
| RF10 | Acima do teto de segurança, só a fila de lote da escola espera, até o mês virar ou a Operação subir o teto, com alerta. O Tutor e a ferramenta com o professor esperando nunca param por orçamento | Acima do teto, o job de lote é adiado e o turno do Tutor é atendido |

**O que cada um vê**

| # | Requisito | Como se prova |
|---|---|---|
| RF11 | Na aba Uso da Operação, por escola, no dia, no mês e nos meses anteriores, ao lado da infra: chamadas, tokens, reais, custo por aluno ativo contra o valor por aluno, porcentagem e chamadas da reserva (zero até a F5b), com ordem por custo. Sem pessoa (D76) | Sem campo de pessoa; usuário de escola não alcança a rota |
| RF12 | No Painel e na Governança, a coordenação vê "IA do mês: N% do previsto", a parte de cada função em porcentagem e o pacote do Tutor (D38). A resposta dela não traz reais nem tokens | Teste de contrato sem custo e sem tokens; a tela não escreve "R$" |

RF13 a RF16 (a avaliação dos modelos, D37) foram para a F5b.

## 6. Regras de negócio

- Texto de aluno só em provedor com processamento no Brasil em contrato (D62), como a X6 deixou; na reserva, F5b
- O teto de segurança existe contra defeito e abuso, não como cobrança; orçamento é configuração, nunca constante (D41)
- O custo registrado superestima, nunca subestima (D14): a chamada que caiu depois do envio leva a saída no teto, com custo.
  O custo da execução interrompida (o teto da tarefa, em cada destino) é da F5b
- Nenhum número de consumo forma indicador de professor (D45, D64)

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Preço sobe no meio do mês | Chamadas novas no preço novo; o mês soma os dois; o custo antigo não muda |
| Escola sem aluno ativo (montagem, virada do ano letivo) | Sem porcentagem e sem aviso; a Operação vê os reais e "sem aluno ativo" |
| Escola sem valor por aluno, nem na rede | "Sem orçamento definido" na Operação; o consumo segue registrado, sem aviso |
| Aluno que chega em maio ou sai transferido | Entra na conta pelos alunos ativos, com a regra da aba Escolas |
| Virada do mês | A porcentagem recomeça, os avisos voltam a valer, o lote adiado volta à fila |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Valor por aluno e teto de segurança, com o operador que mudou | nossa equipe | prestação de contas da operação | vigência + 5 anos, como a auditoria da operação | não: entra a linha |

Nenhum campo novo de aluno ou professor. O provedor que recebeu a chamada, já existente, passa a ter uma linha por chamada;
a reserva nele é da F5b.

## 8b. Risco regulatório

Não há função de IA nova, e o modelo que atende não muda: a reserva e a avaliação, que mudam quem atende, são da F5b. O
orçamento avisa e não corta (D40); só o lote espera acima do teto, e o Tutor e a ferramenta com o professor esperando nunca
param por orçamento. Nenhum número de consumo forma indicador de professor (D45, D64).

## 9. Métricas

- Custo real por aluno ativo por mês, por escola, contra os R$ 5 da D39, no 1º mês do piloto
- Chamadas atendidas pela reserva, a zero chamada com texto de aluno fora do Brasil e a avaliação executada: F5b

## 10. Perguntas em aberto

- **(Tech Spec)** Onde moram os preços e a vigência deles: configuração versionada ou tabela da Operação
- **(Tech Spec)** Quem é "aluno ativo do mês" quando o número muda: o do dia, o maior ou a média
- **(Tech Spec)** Onde fica o aviso da coordenação sem o sino (F13)
- As perguntas de Tech Spec estão respondidas na `techspec.md`; as da reserva, na da F5b
- As duas do Joaquim (as chaves de teste dos finalistas; sem finalista no Brasil para o Tutor) foram para a F5b, §10
