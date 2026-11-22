# Pesquisa de eliminatórios contratuais: provedor principal e reserva (consulta em 22/11/2026)

> Relatório da subtarefa 10.1 (`domain-researcher`, chamado pelo Arquiteto, techspec §7b). Lacunas que ficam: cotas e preço do
> Bedrock não coletados; a lista in-region de `sa-east-1` lida em parte; Magalu Cloud só por imprensa; `json_schema` da Maritaca
> não confirmado. O que depende de contrato vai ao Joaquim (PRD §10).

Nenhum arquivo foi editado. Li `docs/avaliacao-de-modelos.md` §1 e §3.1 e o RF15 do PRD. Tudo abaixo vem das páginas dos fornecedores, citadas entre aspas.

## Maritaca AI (Sabiazinho 4 e Sabiá 4, `-br-sp`)

| Eliminatório | Resposta | Trecho | URL | Data |
|---|---|---|---|---|
| 1. Processamento no Brasil | Não confirmado em contrato | Blog: as versões `br-sp` "guarantee that processing happens entirely in Brazil". DPA, Anexo III: Google Cloud em "Brazil, United States and European Union", EVEO em "Brazil". Cláusula 5.1: infraestrutura fora do Brasil segue as regras de transferência da LGPD | [blog](https://www.maritaca.ai/en/blog/inferencia-no-brasil/), [DPA](https://www.maritaca.ai/en/dpa) | 24/06/2026, ago/2026 |
| 2. Menor permitido | Não confirmado | Termos: "You confirm that You are at least 18 years old". Privacidade: "accounts identified as belonging to minors are removed". O DPA não menciona menores | [termos](https://www.maritaca.ai/en/terms), [privacidade](https://www.maritaca.ai/en/privacy) | termos sem data, 15/07/2025 |
| 3. Treinamento vedado e descarte | Passa, com ressalva | DPA 3.1: dado de API "is never used for training, re-training, fine-tuning". DPA 4.1: "discarded immediately after the Output is generated". Ressalva da privacidade: logs de erro "may keep request content for up to thirty days" | [DPA](https://www.maritaca.ai/en/dpa), [privacidade](https://www.maritaca.ai/en/privacy) | ago/2026, 15/07/2025 |
| 4. Documentação para AIA | Parcial | Há o relatório técnico do Sabiá-4 (arXiv 2603.10213, fev/2026). Não vi cartão de modelo por versão | [arXiv](https://arxiv.org/pdf/2603.10213) | 2026 |
| API OpenAI-compatível | Passa em parte | "Maritaca's API is compatible with the OpenAI SDK". `response_format`/`json_schema`: não confirmado | [api](https://www.maritaca.ai/en/api) | sem data |
| Limite por minuto | Passa | Sabiá 4: Tier 1 com 1.000 RPM, 2M TPM de entrada e 200k de saída. Tier 5 com 10.000 RPM, 20M e 2M. O Sabiazinho sobe mais (30.000 RPM, 100M TPM de entrada no Tier 5). A página diz que as variantes `-br-sp` têm limites iguais, mas a tabela muda a cada tier | [rate-limits](https://docs.maritaca.ai/pt/rate-limits) | sem data |
| Preço por milhão de tokens (entrada / saída) | Confirmado | Sabiazinho 4 BR-SP: R$ 1,30 / R$ 5,20. Sabiá 4 BR-SP: R$ 6,50 / R$ 26,00. Cache de entrada a 25% do preço | [preços](https://docs.maritaca.ai/pt/precos) | sem data |

Lacunas da Maritaca:
- **Retenção:** a "retenção imediata" do DPA conflita com os 30 dias de log de erro da política de privacidade. Peça a cláusula escrita.
- **Subprocessadores:** New Relic e Auth0 são dos EUA (DPA, Anexo III).
- **Limite por minuto da `-br-sp`:** peça confirmação por escrito.
- **Menor e `-br-sp`:** a "variante no Brasil" só vale como garantia se a cláusula constar do contrato, e o uso com dado de menor também precisa estar escrito.

## AWS Bedrock, `sa-east-1`

| Eliminatório | Resposta | Trecho | URL | Data |
|---|---|---|---|---|
| 1. Brasil | Passa só nos modelos "In-Region" | As linhas `sa-east-1` com "supported" em In-Region são: Claude 3 Haiku, Mistral Large e Mistral Large 3, Mixtral, Qwen3 (32B, Next 80B, VL 235B), gpt-oss-120b, DeepSeek V3.2, Gemma 3, Kimi K2.5 e outros. Claude Opus/Sonnet 5.x e 4.x, Haiku 5.5 e 4.5: "not-supported" in-region, só Global. Nova: sem linha `sa-east-1`. Service Terms 1.24.2: serviços podem usar "cross-region inference". Não li a definição de "In-Region" nem a cláusula escrita | [regiões](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html), [Service Terms](https://aws.amazon.com/service-terms/) | Service Terms: 19/11/2026 |
| 2. Menor permitido | Não confirmado | Li cerca de 100 mil dos 325 mil caracteres dos Service Terms e não achei cláusula sobre menores. Não li a Política de Uso Aceitável da AWS nem os termos de modelos de terceiros | [Service Terms](https://aws.amazon.com/service-terms/) | 19/11/2026 |
| 3. Treinamento e descarte | Passa, com ressalva | FAQ: "your content is not used to improve the base models and is not shared with any model providers". Retenção: no modo `none`, "No request or response data is written to durable storage". No modo `default`: "AWS may retain the data for safety and abuse-prevention purposes". É preciso fixar `none` por região e conferir `allowed_modes` de cada modelo | [FAQ](https://aws.amazon.com/bedrock/faqs/), [retenção](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html) | sem data |
| 4. Documentação para AIA | Não confirmado | A documentação da AWS é do serviço. O cartão de modelo de cada modelo aberto é do autor dele | n/a | n/a |
| API OpenAI-compatível | Parcial | O endpoint `bedrock-mantle` aceita a Chat Completions API (página de retenção). Não li a página de structured output | [retenção](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html) | sem data |
| Limite por minuto e preço | Não consultado | Não coletei cotas nem preços do Bedrock | n/a | n/a |

A lista de modelos é parcial: o último trecho da página (29 mil caracteres) e o gpt-oss-20b não foram lidos.

## Magalu Cloud

| Eliminatório | Resposta | Trecho | URL | Data |
|---|---|---|---|---|
| 1. Brasil | Não confirmado em contrato | Notícia: modelos "executados integralmente em infraestrutura própria no Brasil" (MGC AI Hub, com Maritaca, Llama e família Qwen) | [Convergência Digital](https://convergenciadigital.com.br/?p=55400) | 09/09/2026 |
| 2. Menor permitido | Não confirmado | Sem termos achados | n/a | n/a |
| 3. Treinamento e descarte | Não confirmado | Sem termos achados | n/a | n/a |
| 4. Documentação para AIA | Não confirmado | Sem documentação achada | n/a | n/a |
| API, limite por minuto e preço | Não confirmado | Só há "economia de 30% a 75%", sem valores. "OpenAI Compatible API" aparece apenas num post antigo sobre nós de inferência | [Hugging Face](https://discuss.huggingface.co/t/free-test-inference-node-in-magalu-cloud/154718) | sem data |

Os resultados são só imprensa. Não achei a documentação oficial de IA da Magalu Cloud, e `magalucloud.com` não resolveu. Faltam lista de modelos, termos, local de processamento por modelo e preço, a pedir ao comercial.

## Google Cloud (Vertex AI)

| Eliminatório | Resposta | Trecho | URL | Data |
|---|---|---|---|---|
| 1. Brasil | Parcial | Só a linha Gemini 2.5 Flash 128k tem marca de Brasil. Nenhum Gemini 3.x confirmado em `southamerica-east1` | [residência de dados](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency) | sem data |
| 2. Menor permitido | Não passa | Seção 20(d): "Customer will not, and will not allow End Users to, use a Generative AI Service as part of a website, Customer Application, or other online service that is directed towards or is likely to be accessed by individuals under the age of 18." | [Service Terms](https://cloud.google.com/terms/service-terms) | sem data na página |
| 3 e 4 | Não avaliados | Eliminado no item 2 | n/a | n/a |

Não achei exceção à 20(d) no trecho que li.

## Recomendação para a §1

- **Maritaca BR-SP:** finalista e candidata a principal, se contrato e termos escreverem processamento no Brasil, uso por menor, retenção e limite por minuto da `-br-sp`.
- **AWS Bedrock `sa-east-1`:** reserva a confirmar, com modelo aberto in-region (Qwen3, gpt-oss-120b, Mistral Large 3). Depende de passar a amostra de português, de cláusula sobre menor e de preço e cota.
- **Magalu Cloud:** reserva a confirmar com o comercial. Se hospedar a Maritaca, a reserva não seria independente do principal.
- **Google Vertex AI:** sai para conversa de aluno, porque a 20(d) veda serviço provável de ser acessado por menor de 18. Pode ficar só em tarefa sem dado de aluno, se a 20(d) permitir; isso não foi verificado.

## Premissas da Tech Spec §12

1. **Maritaca BR-SP no padrão OpenAI-compatível:** compatível com o SDK da OpenAI, sem data. `json_schema` e `function calling` não foram confirmados na documentação. O limite é de 1.000 RPM com 2M TPM de entrada e 200k de saída no Tier 1 do Sabiá 4, e sobe com o valor pago em crédito (Tier 2 em R$ 100). A tabela da `-br-sp` precisa de confirmação.
2. **AWS Bedrock `sa-east-1`:** não oferece modelo Claude 5.x ou 4.x in-region, nem Nova. Há modelos abertos in-region. Inferência entre regiões tiraria o dado do Brasil e deve ficar desligada. O modo de retenção `none` precisa ser fixado.
3. **Magalu Cloud:** o AI Hub foi anunciado em 09/09/2026 com Maritaca, Llama e Qwen, mas não há documentação oficial, termos nem preço verificados.
4. **Seção 20(d) do Google:** veda serviço de IA generativa "likely to be accessed by individuals under the age of 18". O Vertex AI não serve para o aluno de 11 a 17 anos, a menos que o Google confirme exceção por escrito.


Sources:
- [Maritaca: inferência no Brasil](https://www.maritaca.ai/en/blog/inferencia-no-brasil/)
- [Maritaca: DPA](https://www.maritaca.ai/en/dpa)
- [Maritaca: política de privacidade](https://www.maritaca.ai/en/privacy)
- [Maritaca: termos](https://www.maritaca.ai/en/terms)
- [Maritaca: página da API](https://www.maritaca.ai/en/api)
- [Maritaca: preços](https://docs.maritaca.ai/pt/precos)
- [Maritaca: limites de taxa](https://docs.maritaca.ai/pt/rate-limits)
- [Maritaca: relatório técnico do Sabiá-4](https://arxiv.org/pdf/2603.10213)
- [AWS: disponibilidade de modelos por região](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)
- [AWS: retenção de dados no Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)
- [AWS: FAQ do Bedrock](https://aws.amazon.com/bedrock/faqs/)
- [AWS: Service Terms](https://aws.amazon.com/service-terms/)
- [Google Cloud: Service Specific Terms](https://cloud.google.com/terms/service-terms)
- [Google Cloud: residência de dados do Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency)
- [Convergência Digital: Magalu Cloud](https://convergenciadigital.com.br/?p=55400)
- [Hugging Face: nós de inferência da Magalu Cloud](https://discuss.huggingface.co/t/free-test-inference-node-in-magalu-cloud/154718)
