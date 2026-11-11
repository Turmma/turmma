# Tech Spec — [nome da funcionalidade]

**PRD:** `tasks/prd-[func]/prd.md`
**Status:** rascunho | aprovado

## 1. Resumo da abordagem

Como isso será construído, em um parágrafo. Sem repetir os requisitos do PRD.

## 2. Módulos afetados

Para cada endpoint, tabela, job, chamada de IA ou tela, a receita e o exemplo estão na skill `receitas-de-codigo`; o que se afasta
da receita vai à seção 11, com o motivo.

| Módulo | Novo ou alterado | O quê |
|---|---|---|

## 3. Modelo de dados

Tabelas novas e alteradas, com campos e relações. Marque `escolaId` e `anoLetivoId` onde
existem. Se alguma tabela de domínio não tem `escolaId`, justifique — ou corrija.

```
Entidade   campo tipo, campo tipo
```

Migrations necessárias e ordem.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|

## 5. Fluxo

Passo a passo do caminho principal. O que é síncrono, o que vai para fila, o que acontece
quando cada parte falha.

## 6. Isolamento (obrigatório)

Como o escopo de escola e ano letivo é aplicado nesta funcionalidade. Quais testes de
isolamento serão escritos. Referência: `.claude/rules/10-multitenancy.md`.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais tocados | |
| Novos campos (atualizar `docs/lgpd.md`) | |
| O que vai para log | deve ser só id |
| O que entra em auditoria | |
| O que é enviado a provedor externo | |
| Retenção e expurgo | |
| Arquivo do titular | a tabela nova com dado de pessoa entra em qual versão (`packages/core/src/titular/leitura-do-titular.ts`, critério do cabeçalho), e quem mais a lê por ele (a coordenação que pede o arquivo). Na F2b, três guardiões reprovaram a 1ª rodada da revisão da spec por isso |
| Autorização por objeto | como é feita |
| DTO de saída | campos expostos |

Referência: `.claude/rules/20-lgpd-menores.md` e `docs/lgpd.md`.

## 7b. Conformidade CNE (quando há IA no caminho do aluno)

Classificação de risco, onde está a aprovação humana, como o professor supervisiona, qual
o nível de autonomia do agente. Referência: `.claude/rules/70-conformidade-cne.md`.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Está no caminho quente? | login, tutor, sala, prova, fila, IA, nenhum |
| Carga na manhã de segunda | requisições/s, jobs, tokens/min, a partir de `docs/infra.md` seção 3 |
| Fila e prioridade | interativa, normal, lote |
| Limite por escola | concorrência, tamanho, quantidade |
| Rate limit | por usuário e por escola; **por rota nova**: qual contador, se ele recusa ou só rebaixa, e o teste do 429 |
| Corridas de concorrência | **uma linha por trava**: a instrução com todas as condições de estado (o dono ativo, o convite não revogado), o que fica na mesma transação, o que o perdedor recebe, e o cenário em paralelo que a prova; o cenário diz a ordem forçada (quem segura a trava, quem chega depois, com `esperarNaTrava` ou `WriteBlockTrigger`) e a troca que o deixa vermelho (a ordem antiga das travas, a trava tirada, o passo antes de outro): cenário que passa nas duas ordens não prova a trava (na F2b, R1, J16 e G1 caíram na revisão da spec por isso); quando a mesma escrita pode violar duas restrições únicas (a chave de idempotência e a regra de negócio), qual delas decide, e que a resposta ao perdedor não depende da ordem em que o Postgres as confere |
| Índices novos | começando pelo escopo |
| Migration | compatível com o código anterior? |
| Quando cada dependência cai | banco, Redis, provedor de IA, storage: o que o usuário vê |
| Métrica e alerta | o que mede, o que alerta, parágrafo do runbook |
| Cenário de teste de carga | novo ou alterado |

Referência: `.claude/rules/80-infra-e-carga.md` e `docs/infra.md`.

## 8. Uso de IA (quando aplicável)

| Caso de uso | Perfil | Entrada | Saída | Validação | Aprovação humana |
|---|---|---|---|---|---|

Custo estimado por professor/mês ou por aluno/mês. Onde ficam os prompts.

## 9. Frontend

Telas, estados, componentes reaproveitados. Como fica em Chromebook fraco, com throttling de rede e de CPU, e no celular a partir de 360 px, com toque e rede móvel (D51).

Medida, token e estado de uma peça moram num lugar só, o `docs/interface.md`; aqui e no `cenarios.md` cite a seção, sem repetir o número. Na X1 a mesma regra estava na Tech Spec, no `cenarios.md`, no `docs/interface.md` e no `mockup.md`, e cada decisão de tarefa tinha de chegar aos quatro.

**De onde vem cada coisa da tela.** Para cada dado que a tela mostra e cada ação que ela oferece, a rota da §4 que o entrega
e o campo do esquema; a borda do PRD que pede uma ação ("a coordenação corrige o e-mail") tem a rota dela. O que não tem rota
vira item da §4 ou sai da tela, antes da revisão da spec. Na F2c, a confirmação da senha provisória mostrava a matrícula que
nenhuma leitura entregava (12.0: parada do Joaquim e a 17.0 nova), e a borda "E-mail que volta" prometia corrigir um e-mail sem
caminho (maior 1 da validação: as 18.0 e 19.0 novas).

**Altura.** Se a tela tem limite de altura ("a 1366 × 768 a página não rola, só o miolo"), diga qual peça
é dona dela, de preferência a casca (coluna flexível, e a região que rola com `min-h-0`), e que nenhuma
tela calcula a própria altura com `calc(100dvh − N rem)`. Diga também que alvo de toque e altura não
dependem da métrica da fonte: a fonte é a do sistema (D72) e muda entre a esteira, a máquina local e o
Chromebook. Na X2, cada tela tinha a sua constante (17, 13 e 21 rem, mais a faixa de incidente), e isso
custou 3 reprovações, duas correções e dois críticos da validação; o link da Estrutura media 41 px na
esteira e 44 na máquina local.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | |
| Integração | |
| E2E | |
| Isolamento | |

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|

## 12. Premissas não verificadas

`⚠️ NÃO VERIFICADO` — o que não foi confirmado em fonte oficial, e qual interface abstrata
e implementação falsa serão usadas enquanto isso.

## 13. Riscos técnicos

O que pode dar errado e o que fazer se der.
