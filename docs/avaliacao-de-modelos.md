# Avaliação de modelos para produção

> Como escolhemos o provedor de modelo principal e o de reserva (D37). A escolha sai de uma
> avaliação com amostras, não de preferência nem de benchmark genérico: o que importa é o
> tutor recusar a resposta em português de anos finais e Ensino Médio e a prova citar a página certa.

---

## 1. Finalistas

Conferidos na fonte em **22/11/2026** (relatório da pesquisa, `tasks/prd-reserva-e-avaliacao/pesquisa-3-1.md`; RF15). O Brasil é exigido sempre, para principal
e reserva (D62; PRD da F5b, RF2): quem não o garante por escrito não entra. O que depende de contrato vai ao Joaquim (PRD, seção 10).

| Provedor | Modelos | Onde processa | Menor, treinamento e descarte | Papel |
|---|---|---|---|---|
| Maritaca | Sabiazinho 4, Sabiá 4 (variante `-br-sp`, +30% no preço: R$ 1,30 / R$ 5,20 e R$ 6,50 / R$ 26,00 por milhão de tokens) | Brasil na variante BR-SP, segundo o blog de 24/06/2026 ("processing happens entirely in Brazil"). O DPA de agosto/2026 lista Google Cloud em Brasil, EUA e UE e a EVEO no Brasil, e a cláusula 5.1 manda a infraestrutura fora do Brasil seguir a LGPD. ⚠️ **Não confirmado em contrato** | Menor: não confirmado (os termos pedem 18 anos; a política de 15/07/2025 exclui **contas** de menores; o DPA não os cita). Treinamento: vedado (DPA 3.1) e descarte imediato (DPA 4.1), com a ressalva de que os logs de erro podem guardar o pedido por até 30 dias (política de privacidade). Subprocessadores nos EUA: New Relic e Auth0 | **Finalista e candidata a principal**, se o contrato escrever o processamento no Brasil da `-br-sp`, o uso com dado de menor, a retenção e o limite por minuto dela (Tier 1 do Sabiá 4: 1.000 RPM, 2M de tokens de entrada e 200k de saída por minuto; a tabela da `-br-sp` precisa de confirmação). **O Tier 1 não cobre a manhã de segunda** (`docs/infra.md`, seções 3.2 e 5.4: ~1,7 milhão de tokens por minuto no pico, e ~2,4 milhões do Tutor sozinho na conta de 5.000 + 300 tokens por mensagem, contra os 2M de entrada do Tier 1): a variante `-br-sp` precisa de nível de contrato acima do Tier 1, e o Joaquim leva isso à negociação). Compatível com o SDK da OpenAI; `json_schema` não confirmado |
| AWS Bedrock `sa-east-1` | só modelo aberto **in-region** (Qwen3, gpt-oss-120b, Mistral Large 3 e outros; Claude 5.x e 4.x e Nova não são in-region) | Brasil nos modelos "In-Region"; a inferência entre regiões (Service Terms 1.24.2) tira o dado do Brasil e fica desligada | Menor: não confirmado (nos 100 mil dos 325 mil caracteres lidos dos Service Terms não há cláusula sobre menores; a política de uso e os termos de cada modelo não foram lidos). Treinamento: o conteúdo não melhora o modelo base; com retenção `none` nada vai a armazenamento durável, e o modo `default` pode reter para abuso: fixar `none` e conferir `allowed_modes` de cada modelo | **Reserva a confirmar**: depende de passar na amostra de português, de cláusula sobre menor, de preço e de cota (não coletados). Endpoint `bedrock-mantle` aceita Chat Completions |
| Magalu Cloud | AI Hub (Maritaca, Llama, Qwen), anunciado em 09/09/2026 | "Integralmente em infraestrutura própria no Brasil", só por imprensa | Sem termos achados | **Reserva a confirmar com o comercial**: lista de modelos, termos, local por modelo e preço. Se hospedar a Maritaca, a reserva não é independente do principal |
| Google (Vertex AI) | Gemini 3.5 Flash-Lite, Gemini 3.8 Flash | Nenhum Gemini 3.x confirmado em `southamerica-east1`; só o Gemini 2.5 Flash 128k tem marca de Brasil | **Eliminado para conversa de aluno**: a seção 20(d) dos termos do Google Cloud veda serviço de IA generativa "directed towards or likely to be accessed by individuals under the age of 18", e não achei exceção. Os termos da Gemini API (AI Studio) de 28/04/2026 dizem o mesmo | **Fora**, salvo exceção por escrito do Google. Só poderia servir tarefa sem dado de aluno, se a 20(d) permitisse, o que não foi verificado |

Fontes: [DPA da Maritaca](https://www.maritaca.ai/en/dpa), [privacidade](https://www.maritaca.ai/en/privacy), [termos](https://www.maritaca.ai/en/terms),
[inferência no Brasil](https://www.maritaca.ai/en/blog/inferencia-no-brasil/), [limites](https://docs.maritaca.ai/pt/rate-limits),
[disponibilidade do Bedrock por região](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html),
[retenção no Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html), [Service Terms da AWS](https://aws.amazon.com/service-terms/),
[Service Terms do Google Cloud](https://cloud.google.com/terms/service-terms), [residência de dados do Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency),
[imprensa sobre a Magalu Cloud](https://convergenciadigital.com.br/?p=55400). Lacunas da pesquisa: cotas e preço do Bedrock, parte da lista `sa-east-1`, a Magalu só por imprensa.
Sem finalista no Brasil que passe no Tutor, a D62 volta à mesa (PRD, seção 10); sem segundo provedor no Brasil, a reserva é outro modelo da Maritaca.

Modelos grandes (`complexo`) ficam fora desta rodada: são usados pouco e não decidem a
margem.

## 2. Custo estimado do tutor

Premissas: 10 trocas por dia letivo, 20 dias por mês (200 trocas por aluno por mês, o
pacote de D38 é 300), ~3.000 tokens de entrada por troca com metade reaproveitada em cache,
250 de saída, dólar a R$ 5,50. Preços consultados em setembro de 2026.

| Modelo | Tutor por aluno/mês | Uso pesado (4×) |
|---|---|---|
| Sabiazinho 4 BR-SP | ~R$ 0,75 | ~R$ 3 |
| Sabiá 4 BR-SP | ~R$ 3,70 | ~R$ 15 |
| Gemini 3.5 Flash-Lite | ~R$ 1,25 | ~R$ 5 |
| Gemini 3.8 Flash | ~R$ 2,40 (R$ 4,80 a partir de 2027) | ~R$ 9,60 |

Teto de IA por aluno na escola particular: **R$ 5 por mês no pacote completo** (D39, D50),
somando tutor, ferramentas do professor e agentes. Isso praticamente obriga modelo pequeno
no tutor, com o médio reservado para geração de prova, plano e adaptação (a devolutiva de
discursiva saiu da conta: a IA não a produz, D55).

⚠️ Com premissa mais realista (5 mil tokens de entrada por troca, 300 de saída e uma chamada
de guarda de escopo por troca), o tutor sobe para ~R$ 2 por aluno no Flash-Lite, e a soma
de todos os componentes fica em ~R$ 4 em 2026 e ~R$ 5,30 em 2027, ou ~R$ 6 com câmbio a
R$ 6,20. Se o modelo cobrar tokens de raciocínio como saída, o tutor quase dobra. Estimativa
de 13/09/2026, com preços implícitos na tabela acima e não reconferidos.

Fontes: [preços Maritaca](https://docs.maritaca.ai/pt/precos),
[política de privacidade Maritaca](https://www.maritaca.ai/privacidade/),
[preços Gemini API](https://ai.google.dev/gemini-api/docs/pricing). Preço de modelo muda
por trimestre: reconfira antes de assinar.

## 3. O que é avaliado

Um conjunto fixo de amostras **sintéticas**, versionado no repositório (`tools/ia/amostras/avaliacao-1.json`, formato em `tools/ia/amostras/README.md`), e os
lotes retidos de `docs/aia/ouro-retido/`, lidos sem cópia. Nenhuma amostra usa dado real de aluno (regra 20). E não há chamada real antiga para comparar:
`consumo_ia.entrada` e `saida` vivem no máximo 12 meses (o teto da categoria `texto_do_modelo`), e o expurgo noturno as anula (F3, tarefa 4.0).

**A tabela, as regras e os limiares** (execuções, limiar em contagem, critérios de julgamento, a regra e o modelo, eliminatórias, lotes retidos) são os de
`tasks/prd-reserva-e-avaliacao/avaliacao.md` (RF13 a RF16; Joaquim, 22/11/2026), que **revê a tabela desta seção**: uma linha para cada tarefa de
`TAREFAS_DE_IA`, em vez de uma por perfil. A tabela antiga (de 13/09/2026) saiu daqui para não haver duas. Em resumo:

- Cada linha julgada tem os critérios em `tools/ia/criterios/` e é julgada às cegas quanto ao finalista; a linha de 100%, a parte de 100% das mistas, a
  equidade, a classificação e os lotes retidos da D36 rodam três vezes, e vale a pior.
- **Eliminatórias:** a equidade em português (D60) e a D55 (o modelo que dá nota, conceito ou devolutiva sobre texto de aluno sai, nem principal nem reserva).
  A tarefa abaixo do limiar não recebe entrada em `MODELOS_APROVADOS`.
- A D55 saiu da discursiva como devolutiva (D55): o que se mede é a **recusa** de corrigir, e a rubrica antes da aplicação.

Também medidos, sem nota de corte: latência do primeiro token, tokens por resposta, custo
real da rodada, e limite de tokens por minuto oferecido para o pico de `docs/infra.md`
seção 3.2.

### 3.1 Critérios que não são de qualidade de resposta

Entraram em 19/09/2026, da leitura do Referencial do MEC (`docs/conformidade-mec.md`
seções 8 e 9). Valem como eliminatórios, independentemente da nota das amostras:

| Critério | Passa quando | Por quê |
|---|---|---|
| **Processamento no Brasil** | o contrato garante, por escrito, processamento em território nacional para **toda** chamada que leve dado de aluno | D62, e RF2 da F5b (Joaquim, 20/11/2026): Brasil sempre, para principal e reserva. O Referencial trata dado educacional de menor sob jurisdição estrangeira como risco de soberania, e cita o Cloud Act. Provedor que não garante isso **não entra**, nem como reserva |
| **Serviço usado por menor de idade permitido em contrato** | o contrato não veda uso por menor, e diz isso de forma expressa | os termos da Gemini API (AI Studio) vedam serviço provável de ser acessado por menor de 18 |
| **Treinamento vedado** | contrato veda treinamento com nosso dado e descarta o conteúdo após a geração | regra 20; cláusula que o MEC sugere à escola exigir de nós |
| **Equidade em português brasileiro** | a linha "Equidade" de `avaliacao.md` (30 pares, no máximo 2 em que o registro culto passa e o informal não, em 2 de 3 execuções) é eliminatória | o ônus de demonstrar mitigação de viés é do fornecedor, e o MEC cita avaliação textual que penaliza a escrita de estudantes negros como exemplo de racismo algorítmico |
| **Auditabilidade** | há documentação suficiente para escrever a AIA da funcionalidade que usa o modelo (D60) | o dossiê exige explicar o funcionamento em linguagem simples |

## 4. Como roda

- **À mão, uma vez por finalista**, com crédito de teste. Não é teste automatizado e não
  entra na esteira: a regra 30 proíbe teste automatizado chamando provedor pago
- O script da avaliação e as saídas brutas ficam versionados, sem chave de API
- A revisão das saídas pedagógicas é feita por uma pessoa com o `pedagogia-reviewer`
- O resultado vira a skill `registrar-decisao` revisando D37 com o principal e a reserva

## 5. Quando

Na F5c, depois das specs da fatia do piloto (D37 revista em 23/11/2026), e sempre antes da primeira escola real (portão de
`docs/infra.md` seção 11). Repetir quando um finalista lançar modelo novo ou mudar preço.
