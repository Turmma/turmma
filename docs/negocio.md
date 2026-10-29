# Negócio — mercado, preço, concorrência e venda

> Este documento guarda o contexto comercial que orienta prioridade de produto. **Não é
> leitura obrigatória para implementar uma tarefa.** É leitura obrigatória para escrever PRD
> de funcionalidade que mexe com preço, consumo de IA, governança ou demonstração, e para
> `descobrir` quando a decisão tem custo.
>
> Fonte: o mapa do projeto, a call de 12/09/2026 entre Gabriel e Joaquim, o benchmark de
> concorrentes e as decisões até 13/09/2026. Os números de mercado são do levantamento
> feito nessa data e não foram reconferidos desde então.

---

## 1. De onde veio a ideia

Empresas que vendem **agentes por função**, que agem como funcionários digitais (vendas,
atendimento, marketing, RH, operações), validaram o modelo: um sistema com vários agentes,
cada um executando uma função. Na call o exemplo foi uma startup de Florianópolis com cerca
de R$ 50 milhões captados.

A nossa versão é o mesmo modelo aplicado a um nicho: **um time de agentes para a escola**.
Na descrição do Joaquim na call: "como se o professor tivesse um estagiário produtivo".

Os três essenciais definidos na call:

1. Conexão com o material de estudo que a escola já usa
2. Gerar valor para professor, aluno, família e coordenação
3. Gerar segurança para pais e professores: IA restrita ao assunto escolar, professor no
   comando

## 2. Os problemas que resolvemos

1. Uso indevido de IA pelo aluno: cola, "pegar a resposta sem pensar"
2. Falta de controle do professor sobre o uso de IA pelo aluno
3. Falta de governança da escola sobre a qualidade do ensino
4. Tempo do professor consumido por planejamento, montagem e correção
5. Família sem visibilidade do que acontece na escola

## 3. Quem compra, quem usa, quem paga

| Papel | Usa | Paga | O que ganha |
|---|---|---|---|
| Coordenação / direção | sim | decide a compra | governança de quem usa IA, como e com que resultado; alertas |
| Professor | sim | não | tempo |
| Aluno | sim | não | tutor que ensina, restrito ao conteúdo escolar |
| Família | fase posterior | sim, via mensalidade (particular) | nota, entrega, alerta |
| Prefeitura / rede | não diretamente | sim, por contrato | governança de rede e IA supervisionada |

A regra de ouro da call: **professor e aluno precisam gostar e usar; família e direção
precisam confiar; quem paga é a família (particular) ou a prefeitura (pública).**

Uma observação da call que vale para a venda: em escola particular, compra desse porte
costuma passar por apresentação em assembleia de pais. Se a família não se interessar, não
tem venda. É por isso que o portal da família, mesmo em fase posterior, tem o motor de
eventos construído agora (D11).

## 4. Preço e cobrança

**Escola particular: por aluno por mês, com faixas de pacote (D50).** Valores são hipótese,
validados no piloto:

| Pacote | O que inclui | Hipótese por aluno/mês |
|---|---|---|
| Base | assistente do professor, organização da escola, desempenho e governança | R$ 12 a R$ 18 |
| Completo | o base mais o tutor do aluno | R$ 25 a R$ 30 |

A referência original era **R$ 30 por aluno por mês**, repassado à família na mensalidade:
cerca de 3% de uma mensalidade de R$ 1.000. Ela foi para faixas porque R$ 30 numa escola de
330 alunos dá uns R$ 550 por professor por mês, contra R$ 39,90 da Teachy e o Gemini grátis
no Classroom (seção 6).

O argumento para a assembleia, como saiu na call, vale para o pacote completo: "R$ 30 a mais
é o que o seu filho gasta num dia de cantina. Com isso ele tem um tutor que só fala do
conteúdo da escola, em vez de usar ferramentas que tiram o foco dele."

⚠️ **Repasse na mensalidade tem calendário.** Pela Lei 9.870/1999, até onde se sabe, a
anuidade é fixada e divulgada antes da matrícula, e a lei não exige assembleia de pais. Se
isso se confirmar, o preço de 2027 já está sendo fixado agora, e o primeiro repasse realista
é em 2028. Confirmar com advogado antes de usar em material de venda.

**Rede pública: pacote de rede com piso de preço (D41).** Em torno de R$ 10 por aluno por
mês, ou um pacote com menos tutor que caiba no preço. A R$ 5, IA (R$ 1,50) mais infra (R$ 2)
mais imposto dão uns R$ 4,15 e não sobra para suporte nem licitação. Referência de pregão:
Letrus, R$ 68 a R$ 110 por aluno por ano no Ensino Médio (proposta a Goiás, 2023), ou R$ 5,70
a R$ 9,20 por mês.

**Cobrança (D40):** a escola paga por aluno, com uso normal incluso. Não existe crédito
visível para professor ou aluno. Escola que passa do teto de forma recorrente renegocia o
contrato. A ideia de crédito avulso da call foi descartada: cria a conversa "acabou o
crédito" no meio do bimestre.

**Como os R$ 30 do pacote completo se dividem (tetos, não medidas):**

| Parte | Teto por aluno/mês | Decisão |
|---|---|---|
| IA (tutor, ferramentas, agentes) | R$ 5 | D39 |
| Infra (servidor, banco, storage) | R$ 2 | D30 |
| Suporte, imposto e margem | ~R$ 23 | — |

O teto de IA do pacote base está em aberto (D39). O custo estimado do tutor por modelo está
em `docs/avaliacao-de-modelos.md`.

**Conta de uma escola (estimativa de 13/09/2026, premissas da análise daquela data):**

| Item | Pacote completo, 330 alunos a R$ 30 |
|---|---|
| Receita | R$ 9.900 por mês |
| Imposto, IA (~R$ 4 por aluno), comissão, suporte, onboarding amortizado, infra marginal | ~R$ 4.440 |
| Contribuição | ~R$ 5.460 por mês |

Com custo fixo de uns R$ 30,5 mil por mês (dois sócios, infra fixa em São Paulo, contador,
jurídico, encarregado de dados), o ponto de equilíbrio fica em ~6 escolas a R$ 30, e sobe
para 10 a 15 com as faixas (D50). O custo de IA estoura R$ 5 em 2027 se o preço do Gemini
Flash dobrar e o câmbio subir; o tutor é o componente dominante.

**Referência histórica da call:** R$ 250 por professor + R$ 100 por aluno. Descartada em
favor do preço por aluno.

**Âncoras do benchmark:**

- Ferramentas de professor saem por R$ 1 a R$ 7 por aluno por mês quando normalizadas para
  a escola
- Sistemas de ensino levam R$ 50 a R$ 135 por aluno por mês, mas incluem material e são
  pagos pela família
- **R$ 30 fica na faixa vazia entre os dois**
- Teto psicológico para "IA do professor": R$ 39,90 por mês (Teachy)

**Custo de IA:** modelo caro só para tarefa complexa (apresentação, HTML bonito, análise);
modelo barato para planejar, montar e corrigir. O tutor do aluno gasta muito mais que a
geração de prova. A planilha de custo por aluno é o que valida ou derruba os R$ 30, e ela é
alimentada pela estimativa que o `llm-integrator` cobra em cada Tech Spec.

## 5. Mercado em números

Censo Escolar 2025 e outras fontes, conforme o levantamento de 13/09/2026:

- 46,0 milhões de matrículas na educação básica, 178,8 mil escolas, 2,41 milhões de
  docentes, 94,5% das escolas com internet
- Rede privada: 9,25 milhões de alunos em 41,7 mil escolas. Anos finais privados: 1,95
  milhão. Ensino Médio privado: 1,03 milhão (número a reconferir no INEP)
- 68% das escolas privadas de Ensino Médio têm computador portátil para aluno (Censo 2025,
  tabela E6; é disponibilidade, não um por aluno)
- Redes municipais: 23,1 milhões de alunos em 5.570 municípios
- Joinville: mensalidade média de R$ 1.042,90, faixa de R$ 580 a R$ 2.242. Santa Catarina:
  332.822 matrículas privadas

**Mercado por recorte, a R$ 30 por aluno por mês (R$ 360 por ano):**

| Recorte | Alunos | Por ano |
|---|---|---|
| Ensino Médio privado | 1,03 mi | R$ 371 milhões |
| **Anos finais e Ensino Médio privados (recorte atual, D43)** | ~2,98 mi | **~R$ 1,07 bilhão** |
| Rede privada inteira | 9,25 mi | R$ 3,33 bilhões |

O número de R$ 3,3 bilhões que aparecia aqui usava a rede privada inteira, incluindo
educação infantil e anos iniciais, que estão fora do produto (regra 70). Com as faixas de
preço (D50) o valor por aluno é menor, então esses números são teto. Na rede pública, o
recorte é a parte municipal e estadual dos anos finais mais o Ensino Médio estadual; os
23,1 milhões municipais incluem infantil e anos iniciais, que ficam fora, e o número do
recorte ainda não foi levantado. Meta do primeiro ano (D25, 4.000
alunos): R$ 1,44 milhão por ano, ~0,1% do recorte atual.
- 79% dos professores e 84% dos alunos já usaram IA (Fundação Itaú, 2025). Professores
  brasileiros lideram a OCDE em uso de IA (56% contra 36%, TALIS 2024). Só 19% dos alunos
  receberam orientação
- Só 22% das escolas têm guia de uso de IA (Cetic, TIC Educação 2025)
- Edtech Brasil: US$ 6,0 bilhões (2025) para US$ 15,6 bilhões (2034); K-12 é 42%. Só 4,2%
  das edtechs vendem para governo

## 6. Concorrência

Benchmark completo, com 17 dossiês e radar de 16 emergentes:
https://educa-ia-benchmark.vercel.app

**Atualização de 13/09/2026 (pesquisa com fonte e data):**

- **Google.** Gemini no Classroom sem custo em todas as edições do Workspace for Education,
  com mais de 30 ferramentas de professor (06/2025). Notebooks do NotebookLM e Gems
  atribuídos pelo professor a partir do material da turma (09/2025). Marcação de
  habilidades por currículo, incluindo o Brasil, e resumo de progresso (01/2026). Gemini
  no Classroom para aluno de qualquer idade, ligado por padrão, com o material da turma
  (10/08/2026). Simulado ENEM grátis no Gemini (20/08/2026). É concorrente grátis dentro do
  mesmo ambiente e também canal: a API do Classroom permite importar turmas (D48)
- **Sistemas de ensino.** Plurall IA (Somos) gera plano e prova por capítulo do livro; o
  livro digital do Plurall só é lido na plataforma, sem baixar. Geekie One (Arco) corrige
  dissertativa com IA; a Arco tem parceria com a OpenAI. Bernoulli lançou o Co-crIA com a
  Teachy (03/2026) para ~15 mil professores. Poliedro lançou o Cosmos. FTD comprou a
  Estuda.com e dá IA grátis para professor de rede pública. Material preso na plataforma e
  com IA própria: a licença do conteúdo é o gargalo (D5)
- **Teachy** já tem tutor de IA com conversa monitorada pelo professor, correção automática
  de dissertativa e painel de engajamento de professores, a R$ 39,90 por professor por mês.
  "Tutor supervisionado" deixou de ser diferencial sozinho
- **Gestão e desempenho com IA:** Plurall (painel de gestão), SAE Digital (relatórios por
  aluno, turma e disciplina), Geekie One, EducrIA (painéis por habilidade e planos de ação),
  IA Educa Brasil, EducaPRO, QiProf. Os concorrentes falam em "engajamento" e "adoção" de
  professor, não em "desempenho"
- **Medir professor tem reação sindical.** O Sinpro/RS se opõe a câmera em sala como
  monitoramento do professor. Desenho aceito no mercado: o dado individual fica com o
  próprio professor, e a gestão vê o agregado (D45)
- **Ciclo de venda** para escola particular: típico de 6 meses, com 4 a 5 reuniões, até 1,5
  ano em escola premium

**O que o mercado mostrava no benchmark original:**

- **Ninguém vende agente autônomo.** Toda IA é assistente sob comando, acoplada a material
  didático (Somos/Plurall, Arco, Geekie), banco de questões (Estuda, Super Professor) ou
  agenda (Layers)
- **A família é o stakeholder ausente.** Só o Khanmigo tem portal do responsável de verdade,
  e só nos EUA
- **WhatsApp não é canal pedagógico** de nenhum player
- **Consolidação em grupos de material:** Arco comprou Eduqo, Geekie, ClassApp e isaac;
  Cogna comprou Redação Nota 1000; FTD comprou Estuda.com. Neutralidade vira argumento
- **Governança de IA:** todos citam, só a Profy tem fluxo de aprovação humana, e ninguém
  entrega painel de governança de IA para a coordenação
- **Teachy é o concorrente a acompanhar:** R$ 48 milhões captados, 43 anúncios ativos,
  único que fala com professor e diretor ao mesmo tempo, comprou a Nero.AI para
  personalização
- **Internacionais não vêm:** nenhum vende em real nem tem canal no Brasil. Gemini grátis no
  Classroom e Khanmigo grátis para professor tornam "gerar plano de aula" commodity

**O que aprender de cada um:**

| Player | Lição |
|---|---|
| Teachy | velocidade de produto; cargo no título do anúncio |
| Profy | aprovação humana pela coordenação do que a IA gerou |
| SchoolAI | "Mission Control": professor vendo o aluno usar IA ao vivo, alertas roteados |
| Khanmigo | tutor socrático que não dá resposta; portal do responsável com histórico |
| Letrus | estudo controlado de impacto abre secretaria; preço público em pregão (R$ 85–130/aluno/ano) |
| Estuda.com | prova adaptada por IA como caso de venda; inclusão é o tema mais anunciado |
| Layers | neutralidade e integração fazem dela a camada onde os outros plugam |

**Consequência para o produto:** plano de aula, prova, simulado ENEM e tutor básico não
diferenciam, porque já são commodity ou grátis. O que diferencia é o que está em
`docs/visao-produto.md` seção 3: governança de IA pronta para o CNE, agentes supervisionados
que preparam e avisam, loop fechado até a família, desempenho medido sem vigilância, e
neutralidade em relação ao material.

### 6.1 A regulação virou eixo competitivo (19/09/2026)

Leitura das fontes primárias em `docs/regulacao.md` e `docs/conformidade-mec.md`. Três
movimentos de mercado saem daí:

**Metade do que o concorrente anuncia hoje ficou do lado errado da norma.** O ato do CNE de
01/09/2026 proíbe a IA de corrigir, avaliar, dar nota ou conceito em redação e questão
dissertativa — **inclusive como pré-correção ou sugestão apresentada ao professor**. Geekie One
(Arco) anuncia correção de dissertativa com IA; a Teachy anuncia correção automática de
dissertativa. Quem comprou isso em 2026 tem doze meses da homologação para se adequar, e quem
vende tem de reconstruir a funcionalidade. Nós perdemos a mesma funcionalidade (D55) — a
diferença é que perdemos antes de vendê-la, o que vira argumento em vez de passivo. O material
de venda diz isso sem citar nome: "nenhuma linha do nosso produto corrige redação, porque a
norma não permite; se a sua escola usa algo que corrige, vale conferir a data da adequação".

**A escola passou a comprar por checklist.** O documento da SEB dá ao gestor quatro blocos de
perguntas, a lista de documentos a exigir do fornecedor e as cláusulas de contrato. Isso muda o
material de venda: não é folheto de funcionalidade, é **dossiê** (D61) — declaração de propósito
com faixas etárias, funcionamento em linguagem simples, conformidade LGPD e ECA artigo por
artigo, RIPD, avaliação de impacto algorítmico, relatório de uso legível e material para a
escola conversar com professores e famílias. Nenhum concorrente brasileiro publica isso hoje.

**Soberania é a vantagem que o estrangeiro não copia.** O capítulo 10.3 do Referencial trata
dado educacional de criança fora do país como risco de Estado, cita o Cloud Act e recomenda
compra pública que fortaleça solução nacional. Produto brasileiro, dado no Brasil (D28) e
**conversa de aluno em modelo processado no Brasil** (D62) é resposta pronta a uma exigência
que Google e Khanmigo não têm como dar. Vale mais na rede pública, e vale também na
particular quando o jurídico da mantenedora entra na conversa.

**O que a conformidade custa.** Honestamente: perdemos a correção de discursiva e de redação
(D55), que era uma das ferramentas mais pedidas; ganhamos trabalho de documento (D61) e de
avaliação de impacto (D60); e possivelmente antecipamos o vínculo com o responsável, se o
art. 24 do ECA Digital nos alcançar (`docs/regulacao.md` 2.2). Em troca: somos vendáveis a
uma escola que está com prazo correndo e sem saber o que fazer, e sem risco de sanção da ANPD
em cima de dado de menor.

## 7. Posicionamento e mídia

- Termos sem anunciante B2B hoje: **"agentes de IA"**, **"WhatsApp"**, **"plano de aula
  com IA"**, **"correção de prova com IA para escola"**
- Promessas dominantes dos concorrentes: tempo do professor, inclusão/PEI, dado para o
  gestor, matrícula 2027
- Táticas replicáveis: cargo no título ("PARA COORDENADORES"), isca ("guia de uso de IA da
  sua escola"), webinar com data, ondas de 20–30 variações de criativo no mesmo dia
- **Setembro é o pico de compra para o ano seguinte**
- Conformidade com o CNE vira material de venda: as escolas têm **doze meses contados da
  homologação do MEC** para se adequar, e 78% delas não têm política de IA nenhuma
- A isca mais barata que temos é o que a escola precisa e não sabe escrever: **a política de
  uso de IA da escola**, o material de consulta a professores e famílias, e o checklist do MEC
  respondido. Sai do dossiê (D61), não de esforço novo
- Termos de posicionamento que ninguém ocupa e que agora têm lastro: "conforme ao CNE",
  "dado no Brasil", "modelo processado no Brasil", "nenhuma nota sem professor"

## 8. Como a venda acontece

Educação é mercado de **relacionamento e política**, não de prospecção fria. O plano da
call: visitas semanais a prefeituras e escolas, apresentação em reunião de coordenação e em
assembleia de pais, escolas técnicas.

- Existem contatos possíveis (SENAI, prefeitura de Joinville). **Nenhum é certo e nenhuma
  decisão de produto é tomada com base neles**
- **Sandbox regulatório** é um caminho de entrada na rede pública que não passa por
  licitação: o Referencial do MEC recomenda às redes usar ambiente controlado de testagem,
  iniciado por chamamento público, para experimentar IA com segurança jurídica. Perguntar à
  secretaria de Joinville se existe ou pode existir chamamento nesse formato, e escrever a
  proposta do piloto na linguagem do princípio 10 do MEC: piloto declarado, com métrica,
  cronograma e reversibilidade (`docs/conformidade-mec.md` seção 10)
- **A pergunta que hoje não temos como responder** é a de evidência: o MEC pede eficácia
  pedagógica demonstrada por pesquisa **não financiada pelo desenvolvedor**, e a Letrus
  mostrou que estudo de impacto abre porta de secretaria. Desenhar com a escola piloto uma
  medição simples e pré-registrada — tempo de preparação e correção do professor, antes e
  depois; desempenho por habilidade com e sem uso — com alguém de fora assinando o desenho
- O argumento "sistema feito por alunos do SENAI" foi levantado para a apresentação no SENAI
- Investimento é considerado viável a partir de uma primeira venda, por relacionamentos do
  Gabriel. Isso não muda prioridade de produto
- **O que convence é o fluxo completo funcionando** (D1). Por isso a demonstração (F15) tem
  seed sintético de uma escola inteira e o feed de agentes nunca aparece vazio
- **Uma escola piloto gratuita entra no 1º semestre de 2027** usando o que estiver pronto
  (D1 revista). Antes dela, entrevistas com escolas de Joinville (`TODO.md`). Com ciclo de
  6 a 18 meses e o calendário da mensalidade, a primeira receita realista é em 2028

O que a coordenação precisa ver na primeira semana para renovar está em D24.

## 9. Frentes de definição

| # | Definição | Responsável | Estado em 13/09/2026 |
|---|---|---|---|
| 1 | Posicionamento de marca e landing page | Gabriel | em andamento |
| 2 | Mapa do sistema e telas | Joaquim | `docs/interface.md` |
| 3 | Fluxos-chave detalhados | Joaquim + Gabriel | `docs/fluxos.md` |
| 4 | Lista de agentes e nível de autonomia | juntos | decidido (D17, D32) |
| 5 | Stack e arquitetura | Joaquim | ratificada (D16) |
| 6 | Modelo de dados e orçamento de IA por aluno | Joaquim | `docs/modelo-de-dados.md`; orçamento decidido (D38, D39, D41) |
| 9 | Valores das faixas de preço e teto de IA do pacote base | juntos | em aberto (D50) |
| 10 | Entrevistas com escolas e escola piloto | juntos | em aberto; piloto no 1º semestre de 2027 (D1) |
| 7 | Nome, INPI e domínio | Gabriel | **nome fechado: Turmma** (D54); INPI e domínio em aberto |
| 11 | Dossiê de conformidade e checklist do MEC respondido | Gabriel e Joaquim | novo, 19/09/2026 (D61) |
| 12 | Evidência independente de eficácia pedagógica, desenhada com o piloto | juntos | em aberto (`docs/conformidade-mec.md` 12) |
| 8 | WhatsApp e portal da família | juntos | fase posterior |

## 10. Referências

- Repositório: https://github.com/Turmma/turmma
- Benchmark de concorrentes: https://educa-ia-benchmark.vercel.app
- Diretrizes do CNE sobre IA (cobertura Porvir): https://porvir.org/cne-diretrizes-inteligencia-artificial-escola-universidade/
- Diretrizes do CNE (cobertura G1, 01/09/2026): https://g1.globo.com/educacao/noticia/2026/09/01/cne-para-uso-de-ia-em-escolas-e-universidades.ghtml
- Referencial do MEC para uso e desenvolvimento responsáveis de IA na educação: https://www.gov.br/mec/pt-br/referencial-de-ia-na-educacao
- IA na Educação Básica (MEC/SEB + UNESCO): https://www.gov.br/mec/pt-br/escolas-conectadas/arquivos/ia-basica.pdf
- ECA Digital (Lei 15.211/2025): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
- Decreto 12.880/2026, que regulamenta o ECA Digital: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm
- Censo Escolar 2025 (INEP): https://download.inep.gov.br/publicacoes/institucionais/estatisticas_e_indicadores/notas_estatisticas_censo_escolar_da_educacao_basica_2025.pdf
- Fundação Itaú, adoção de IA: https://www.fundacaoitau.org.br/noticias/educacao/84-dos-alunos-e-79-dos-professores-ja-utilizaram-ferramentas-de-ia-diz-estudo
- Cetic, TIC Educação 2025: https://cetic.br/media/pdf/analises/20260804094932_pt_br_tic_educacao_2025_coletiva_de_imprensa.pdf
