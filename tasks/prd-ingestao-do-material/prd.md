# PRD — Ingestão do material

**Status:** aprovado
**Funcionalidade do roadmap:** F4
**Depende de:** F1 (concluída); absorve a 45.0 e a 46.0 da X6 (PDF no worker; listar, reprocessar e descartar job)

> **Corte de 11/11/2026 (Joaquim), sem mudar requisito:** RF1, RF2, RF5, RF6, RF9, RF12, RF19, a habilidade no RF7, o
> "classificadas" do RF15, a classificação no RF20, a seção 8b e as perguntas da BNCC na 10 são da F4b
> (`tasks/prd-classificacao-bncc/prd.md`).

## 1. Problema

O material entra só "por disciplina": quando Camila pede uma revisão para o 2ºB, a busca mistura o 1º e o 3º ano, e
a habilidade da questão sai de um catálogo nosso (`QUI.EM.05`), não da BNCC. Renata não consegue mostrar à secretaria
que o que a IA gera segue o currículo. No primeiro dia ela tem 300 PDFs para subir, um por vez; a edição nova não tem
como entrar sem perder o que foi gerado; a licença da editora vence sem aviso; e nada mostra o que entrou, o que
falhou e que habilidades da série estão sem material.

## 2. Objetivo

O material da escola entra em lote, classificado por série, capítulo e habilidade da BNCC, com edição e licença
controladas, e toda geração usa essa classificação e cita a página da edição que usou.

## 3. Fora de escopo

- Adaptador de scraper e qualquer fonte que não seja upload de PDF (D22)
- OCR de PDF escaneado: o envio sem texto continua recusado, com "envie a versão com texto"
- Guardar o PDF depois da extração: o arquivo é apagado em todo caminho (45.0); reextrair é enviar de novo
- Habilidade criada por nós, sufixo de currículo estadual (`EF03CI03B`, `…PE`) e a BNCC Computação
- Organização do currículo por bimestre, que é da rede e da escola
- Banco do ENEM (F7), exportação do material (F12), anexo na conversa (P07) e visão da rede (F14)

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Coordenador | registrar licença; enviar material, até 20 por vez; declarar série; ver e corrigir a classificação; enviar edição nova; pedir reclassificação; excluir; ver o painel e a cobertura | enviar material de terceiro sem licença vigente; classificar com habilidade fora da tabela BNCC |
| Professor | ler o material das disciplinas em que tem vínculo, com a classificação; trocar a habilidade de uma questão no artefato dele, antes de aprovar | enviar material; mudar a classificação da base; ver o painel |
| Aluno | receber do Tutor só material da série e da disciplina da turma | ver lista de material, classificação ou licença |
| Operação Turmma (D76) | listar, reprocessar e descartar job que falhou; reclassificar uma escola por comando, com chamado e auditoria | ler texto do material; reprocessar ou descartar job de IA ou de titular |

## 5. Requisitos funcionais

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | A tabela pública da BNCC traz código e descrição oficiais dos anos finais (6º ao 9º, por componente e ano, com os blocos `EF67`, `EF69` e `EF89` valendo para cada ano do bloco) e do Ensino Médio (por área, sem ano; Língua Portuguesa com as suas). Sem dono, igual para todas as escolas, com a fonte de cada registro | `EF69LP01` vale no 7º ano; `EM13CNT301`, em Química e Física; sufixo estadual recusado |
| RF2 | O catálogo próprio sai: atividade, plano, adaptação, chat do Assistente, Tutor e o acerto por habilidade em Turmas passam a usar só o código BNCC | nenhuma saída traz código fora da tabela; o seed usa BNCC |
| RF3 | No envio, a coordenação declara uma ou mais séries da escola para o material; sem série o envio é recusado | sem série, recusado; com duas, aparece nas duas |
| RF4 | Cada página recebe o capítulo (número e título) lido do sumário ou dos títulos do PDF; material sem capítulo fica "sem capítulo", sem falhar | amostra fixa, na taxa mínima declarada; PDF sem capítulo fica pronto |
| RF5 | A IA propõe as habilidades BNCC de cada capítulo, em lote e fora do horário letivo, só entre as da etapa, série e componente (ou área, no EM) do material | amostra fixa, taxa mínima declarada; código fora do recorte recusado |
| RF6 | A coordenação vê a classificação por capítulo e corrige série e habilidades; a correção vale para a próxima geração, fica na auditoria com autor, e nenhuma reclassificação automática a desfaz | a geração seguinte usa a corrigida; reclassificar a mantém |
| RF7 | A geração (atividade, plano, adaptação, chat do Assistente e Tutor) busca só material da série e da disciplina da turma, e a habilidade de cada questão é uma das do capítulo citado | o 9º ano não recebe material só do 6º; questão do capítulo 7 tem habilidade dele |
| RF8 | Sem material pronto da série e da disciplina, a ferramenta diz isso e não gera; o Tutor diz que não há material da turma | mensagem com o que fazer, sem chamar o modelo |
| RF9 | O professor troca a habilidade de uma questão no artefato dele, antes de aprovar, por outra da tabela da etapa e componente; a base não muda | o diagnóstico usa a trocada; a base fica intacta |
| RF10 | A coordenação envia uma edição nova sobre um material; a anterior continua na busca até a nova ficar pronta, e só então sai; se a nova falhar, a anterior continua | a busca devolve a anterior, depois só a nova; com falha, a anterior |
| RF11 | O artefato gerado antes da troca continua citando a edição que usou, com título, edição, página e trecho; geração nova só cita a edição atual | o antigo mostra a edição antiga; o novo não a cita |
| RF12 | A coordenação pede a reclassificação de um material, a partir do texto já guardado, sem reenviar | conclui sem arquivo e preserva a correção |
| RF13 | A extração roda no worker, e o PDF é apagado depois dela em todo caminho (sucesso, falha, exclusão; queda, em até 25 h). A operação lista, reprocessa e descarta job que falhou, com chamado e auditoria, como desenham a 45.0 e a 46.0 (`tasks/prd-reengenharia/onda-3b.md`) | os casos da tabela "Falha" da onda 3b |
| RF14 | A coordenação envia até 20 PDFs de uma vez, com a mesma disciplina, séries, titularidade e licença; cada um vira um material, com o título tirado do nome do arquivo e editável; o repetido entra uma vez; o que falha não derruba os outros | 20 com um inválido e um repetido: 18 prontos, uma falha, um aviso |
| RF15 | 300 apostilas enviadas no onboarding ficam prontas e classificadas numa noite (19h às 5h), sem atrasar o Tutor nem a ferramenta de outra escola | carga com o maior PDF do seed |
| RF16 | A coordenação registra a licença uma vez: licenciante, o que cobre, início e fim da validade (fim opcional) e a referência do documento, sem anexar o contrato; material de terceiro só entra apontando uma licença vigente | terceiro sem licença vigente: recusado antes de abrir o arquivo |
| RF17 | Licença vencida tira da busca, no dia seguinte ao fim, os materiais que ela cobre; os artefatos já gerados mantêm a citação; o sino avisa 30 dias antes e no vencimento; atualizar a validade devolve os materiais à busca sem reenviar | relógio falso: avisos, saída e volta nos dias certos |
| RF18 | No topo da aba Material, a coordenação vê quantos materiais estão prontos, processando e com falha, e quantos envios foram recusados por licença nos últimos 30 dias, por disciplina e série | a contagem bate com o estado e com a auditoria |
| RF19 | A coordenação vê a cobertura: por série e disciplina (área, no EM), as habilidades BNCC sem nenhum material pronto | excluído o único material de uma habilidade, ela aparece |
| RF20 | Classificação, licença, edição e painel de uma escola nunca aparecem para outra | isolamento por endpoint e repository, efetivo sem o escopo |

## 6. Regras de negócio

- O material e a classificação são da escola e não variam por ano letivo, nem a série (a turma é que é do ano)
- Correção humana da classificação vence a da IA, sempre
- Toda saída cita material, edição e página (D6)
- A classificação só chega ao aluno pela atividade que o professor aprova (regra 70, item 3)
- Ingestão e classificação são lote, com limite por escola (regra 80, itens 2 e 3)

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Uma apostila serve ao 1º e ao 2º ano | Declarada com as duas séries; aparece para as duas |
| Língua Portuguesa com habilidade `EF69LP` | Vale do 6º ao 9º; a cobertura a conta em cada ano |
| Química no Ensino Médio | Habilidades de Ciências da Natureza (`EM13CNT`); o capítulo aparece junto, como o tema mais fino |
| Material sem numeração de capítulo | "Sem capítulo"; a IA classifica por bloco de páginas |
| Apostila em duas colunas, fórmula quebrada | Extração como hoje; a página continua citável |
| Edição nova enviada enquanto a anterior ainda processa | Recusada até a anterior terminar, com o motivo |
| Licença vence com atividade em rascunho citando o material | O rascunho mantém a citação; geração nova não usa o material |
| Coordenação corrige enquanto a reclassificação roda | A correção vence |

## 8. Dado pessoal envolvido

| Dado | Titular | Finalidade | Retenção | Já está em `docs/lgpd.md`? |
|---|---|---|---|---|
| Licenciante (pode ser pessoa), agora no registro da licença | licenciante | registrar a licença (D5) | enquanto a licença ou um material dela existir, depois o `material_excluido` | sim, na linha do material; **muda de lugar** |
| Quem registrou e alterou a licença, quem corrigiu a classificação, quem enviou a edição | coordenador | autoria da declaração e da correção | na auditoria, com o prazo dela | **não**: incluir as ações novas na linha da auditoria |
| PDF temporário, até a extração | (material, sem pessoa) | extrair o texto | até a extração, ou 25 h no órfão | **não**: a 45.0 já previa a linha |

Na classificação, o texto do material vai ao modelo: sem dado de aluno, e só a provedor que veda treinamento (regra 20, item 13).

## 8b. Risco regulatório

A classificação alimenta o **diagnóstico por habilidade**, de alto risco (regra 70, item 6a): a habilidade da questão
deixa de ser escolhida pelo modelo na geração e vem do capítulo citado, corrigível pela coordenação e, na questão, pelo
professor. A AIA
`docs/aia/diagnostico-por-habilidade.md` é revista nesta fase, antes da tarefa que troca o catálogo. A aprovação humana
continua na atividade, que o professor aprova antes de aplicar.

## 9. Métricas

Tempo do envio ao material classificado. Capítulos corrigidos e habilidades trocadas (alto: classificador fraco).
Cobertura por série no primeiro mês.

## 10. Perguntas em aberto

- Trecho menor que a página: a Tech Spec decide
- A taxa mínima e a amostra fixa da detecção de capítulo e da classificação BNCC: Tech Spec, com o `test-engineer`
- A fonte da tabela: o `bncc-dados` (CC BY 4.0), conferido por amostra contra o PDF do MEC, ou a planilha oficial
- Se o texto da BNCC é ato oficial fora do direito autoral (Lei 9.610, art. 8º, IV): a confirmar com advogado
- A revisão da BNCC no CNE: a tabela guarda a versão
- Se a licença de terceiro precisa cobrir o envio ao provedor de IA: a confirmar com advogado (`docs/regulacao.md` seção 5)
