# PRD — Provedor de reserva e avaliação dos modelos

**Status:** aprovado (Joaquim, 20/11/2026), como parte do PRD da F5 (`tasks/prd-camada-ia/prd.md`); separado dele no corte de
21/11/2026, por escolha do Joaquim, sem mudar requisito. Os números dos RF são os da F5. Revisto na revisão da spec da F5b
(Joaquim, 22/11/2026): RF13, RF14 e `avaliacao.md`. Revisto em 23/11/2026 (Joaquim): rodar a avaliação por finalista, com as chaves e o
gasto, sai da F5b e vira a F5c (`avaliacao-de-modelos`, `ROADMAP.md`), com o modelo real por último; a F5b entrega a ferramenta, as amostras,
as medidas e a guarda do RF16 (D37 revista). RF14, RF15, RF16 e §10 dizem o que fica aqui e o que vai
**Funcionalidade do roadmap:** F5b — `reserva-e-avaliacao`
**Depende de:** F5a (`camada-ia`: o custo por chamada, a linha por chamada com o provedor que atendeu, a coluna
`consumo_ia.pelo_provedor_de_reserva`, o orçamento e o teto do lote); X6 (49.0 e 50.0). As chaves de teste dos finalistas
são da F5c (§10)

## 1. Problema

Se o provedor cair às 10h, seis turmas no Tutor ficam sem resposta, porque não há reserva (D29). E sem a avaliação (D37) não
há provedor, preço nem contrato.

## 2. Objetivo

Toda chamada cai na reserva quando o principal cai, sem texto de aluno sair do Brasil; e a avaliação que escolhe o principal e a
reserva fica pronta para rodar, com amostras, medidas e guardas. Rodá-la é a F5c (23/11/2026).

## 3. Fora de escopo

Os da seção 3 do PRD da F5, salvo o primeiro item (que é esta spec), mais tudo que é da F5a: o custo por chamada, o orçamento, o teto de segurança, os avisos e as
telas da Operação e da coordenação.

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Operador Turmma | ver, na aba Uso (F5a), o que a reserva atendeu por escola; receber os alertas da reserva | ver pessoa, conversa, entrada ou saída de chamada |
| Coordenação | nada novo | ver provedor ou modelo |
| Professor e aluno | nada novo: a reserva não aparece | ver custo, crédito, provedor ou modelo |

## 5. Requisitos funcionais

**Reserva e soberania**

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | A produção tem principal e reserva, cada um com o seu contrato no cadastro de suboperadores e a mesma conferência da subida (D62). A reserva que não passa fica fora do caminho, sem derrubar o principal, com alerta à Operação | Reserva sem contrato no Brasil: o worker sobe, nenhuma chamada vai a ela, o alerta dispara |
| RF2 | Cada tarefa só sai para provedor cujo contrato cobre tudo o que ela envia: Brasil sempre (F5, PRD §3, Joaquim, 20/11/2026), treinamento vedado, as categorias da tarefa | Reserva sem a categoria conversa de aluno e principal fora: o Tutor não chega a ela, a geração de atividade chega |
| RF3 | Principal caído (fora, erro de servidor, prazo) → a chamada vai à reserva no mesmo perfil, dentro do prazo da execução. Principal recusando por limite → espera, modelo menor, reserva (regra 80.4). Nunca erro cru | Principal falso fora: a reserva responde |
| RF4 | O Tutor só cai na reserva se o modelo dela passou nas amostras do Tutor (RF13). Sem isso, indisponível como hoje, com a regra fixa da D36 | Reserva não aprovada para o Tutor e principal fora: o turno termina indisponível sem chamar a reserva |
| RF5, a reserva | A linha de consumo guarda o provedor e o modelo que atenderam a chamada, também quando foi a reserva; a tentativa que trocou de provedor conta cada chamada com o seu custo (a troca de modelo é da F5a) | A chamada da reserva aparece com o provedor dela na lista de compartilhamento do aluno (LGPD, art. 18, VII) |
| RF6, a reserva e a interrompida | O modelo da reserva sem preço não sobe fora do ambiente local; a execução interrompida grava o custo, os dois tetos da tarefa ao preço de cada destino, uma linha por destino (o preço por chamada e o do principal são da F5a; até aqui a interrompida grava sem custo) | `LLM_RESERVA_MODELO` sem preço recusa a subida; a interrompida tem uma linha por destino, cada uma com custo > 0 |

**Avaliação dos modelos (D37)**

| # | Requisito | Como se prova |
|---|---|---|
| RF13 | Amostras sintéticas fixas e versionadas cobrem a tabela de `avaliacao.md`, nesta pasta (Joaquim, 22/11/2026; revê a seção 3 de `docs/avaliacao-de-modelos.md`): cada linha ligada a uma tarefa real, com o seu limiar e o número de execuções; reúnem os lotes retidos que já existem, o da classificação (F4b), os do risco à vida (D36) e os dois da D55. Tarefa abaixo do limiar não recebe entrada em `MODELOS_APROVADOS`; abaixo de uma linha eliminatória, o modelo sai da avaliação | Amostras no repositório, com o sha256 de cada lote no relatório; nenhuma tarefa de `TAREFAS_DE_IA` sem linha |
| RF14 | Roda à mão, uma vez por finalista, com crédito de teste, fora da esteira (regra 30); a chave fica fora do repositório, as saídas brutas dentro, **salvo as dos lotes retidos e as da D55**, das quais o repositório guarda só o id, o resultado e o agregado (na D55, também a forma do pedido) (o sha256 delas fica fora); a parte dos lotes retidos lê `docs/aia/ouro-retido/` sem copiar, e quem a roda é o Arquiteto (Joaquim, 22/11/2026). A F5b entrega a ferramenta assim; rodar por finalista é da F5c (Joaquim, 23/11/2026) | Guarda de segredo verde; nenhum teste automatizado chama a ferramenta; nenhuma saída de lote retido no repositório |
| RF15 | Antes do crédito, os eliminatórios contratuais (seção 3.1) são conferidos na fonte e os finalistas, revistos: na pesquisa de 20/11/2026 o Google deve sair (termos do Google Cloud, 20(d), vedam serviço provável de ser acessado por menor; nenhum Gemini atual processa no Brasil), e AWS Bedrock em São Paulo e Magalu Cloud entram a confirmar como reserva. O relatório dá a taxa por amostra contra o limiar, os eliminatórios, latência, tokens, custo e tokens por minuto oferecidos | Seção 1 revista com fonte e data; o relatório da ferramenta traz esses campos, provado com o modelo falso. O relatório de cada finalista, conferido, é da F5c |
| RF16 | Toda entrada de `MODELOS_APROVADOS` se liga ao relatório que a aprovou e, na função de alto risco, à AIA que cita o `provedorId:modelo`. Registrar principal e reserva na D37 revista, com os preços e o contratado de tokens por minuto (`docs/infra.md` 5.4), e as AIAs com principal, reserva e modelo menor, é da F5c (Joaquim, 23/11/2026) | A guarda do RF16 (`cenarios.md` §1) recusa a entrada sem relatório, com linha reprovada ou fora da AIA |

## 6. Regras de negócio

- Texto de aluno só em provedor com processamento no Brasil em contrato (D62), também na reserva e na falha; na dúvida, não sai
- O custo registrado superestima, nunca subestima (D14): a execução interrompida leva o teto da tarefa, com custo, em cada
  destino possível
- Função de alto risco abaixo da taxa mínima no modelo escolhido não liga para escola real (D60); a classificação confere primeiro

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Principal fora às 10h com seis turmas no Tutor | Reserva, se aprovada para o Tutor; senão "Tentar de novo" (X6) e a regra fixa da D36 |
| Principal e reserva fora juntos | Indisponível, sem erro cru; "Provedor de IA fora" dispara para os dois |
| Contrato da reserva vence no meio do mês | A Operação encerra o suboperador; no reinício do `worker-ia` a reserva sai do caminho e o principal segue |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Provedor que recebeu a chamada, agora principal ou reserva (`consumo_ia.provedor`, `consumo_ia.pelo_provedor_de_reserva`) | aluno; professor, indireto | dizer por onde o dado passou (art. 18, VII) | a da linha de consumo | sim; a linha 99 passa a citar a reserva |

Nenhum campo novo de aluno ou professor; as amostras são sintéticas.

## 8b. Risco regulatório

Não há função de IA nova; muda quem atende. O Tutor e a classificação (alto risco, D60) podem passar a outro modelo, e por
isso **a reserva só atende o Tutor se passou nas mesmas amostras do principal** (recusa de três formas, escopo, D36, D58,
português real). As AIAs registram o modelo de cada função. Supervisão e aprovação humana não mudam (regra 70, itens 3 e 4);
a equidade em português e a recusa da D55 são eliminatórias (`avaliacao.md`): abaixo delas o modelo não é principal nem
reserva.

## 9. Métricas

- Chamadas atendidas pela reserva, e as indisponíveis com o principal fora
- Zero chamada com texto de aluno em provedor sem contrato no Brasil, conferido na lista de compartilhamento
- A avaliação pronta para rodar, com amostras e eliminatórios respondidos (a execução, na F5c)

## 10. Perguntas em aberto

- ~~**(Joaquim)** As chaves de teste dos finalistas para rodar a avaliação (RF14)~~ **Respondida em 23/11/2026:** a avaliação
  executada sai da F5b e vira a F5c, depois das specs da fatia do piloto e antes do portão da primeira escola real; as chaves
  chegam lá. As duas perguntas abaixo seguem para a F5c
- **(Joaquim, depois da avaliação)** Sem finalista no Brasil que passe no Tutor, a D62 volta à mesa, como ela prevê. Sem segundo
  provedor no Brasil, a reserva é outro modelo da Maritaca: cobre a queda do modelo, não a do provedor
- **(Joaquim, depois da avaliação)** Os lotes retidos do risco à vida estão fora do alvo com o modelo local; finalista que não
  chega ao alvo não liga o Tutor como principal

As perguntas de Tech Spec da F5 (como a reserva declara as tarefas aprovadas, e se vale para a classificação) estão
respondidas na `techspec.md` desta pasta, §5.
