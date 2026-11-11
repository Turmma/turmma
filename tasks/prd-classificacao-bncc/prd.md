# PRD — Classificação do material pela BNCC

**Status:** aprovado (11/11/2026, Joaquim), como parte do PRD da F4 (`tasks/prd-ingestao-do-material/prd.md`); separado
dele no corte de 11/11/2026, por escolha do Joaquim, sem mudar requisito. Os números dos RF são os da F4
**Funcionalidade do roadmap:** F4b — `classificacao-bncc`
**Depende de:** F4 (`ingestao-do-material`: a série do material, o capítulo lido do PDF, a extração no worker)

## 1. Problema

A habilidade de cada questão sai de um catálogo nosso (`QUI.EM.05`), escolhido pelo modelo na hora de gerar, e não da
BNCC. A coordenação não consegue mostrar à secretaria que o que a IA gera segue o currículo, o diagnóstico por
habilidade fala uma língua que ninguém fora do Turmma reconhece, e ninguém sabe que habilidades da série estão sem
material.

## 2. Objetivo

Cada capítulo do material é classificado por habilidade da BNCC, corrigível pela escola, e toda geração e todo
diagnóstico usam esse código.

## 3. Fora de escopo

Os da seção 3 do PRD da F4, mais tudo que é da F4: série, capítulo, edição, licença, envio em lote e o painel do estado.

## 4. Papéis envolvidos

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Coordenador | ver e corrigir a classificação por capítulo; pedir reclassificação; ver a cobertura | classificar com habilidade fora da tabela BNCC |
| Professor | ver a classificação do material das disciplinas dele; trocar a habilidade de uma questão no artefato dele, antes de aprovar | mudar a classificação da base; ver a cobertura |
| Aluno | — (recebe a habilidade só pela atividade aprovada) | ver classificação |
| Operação Turmma (D76) | reclassificar uma escola por comando, com chamado e auditoria | ler texto do material |

## 5. Requisitos funcionais

Os da F4, com o número de lá: **RF1** (tabela pública da BNCC), **RF2** (o catálogo próprio sai), **RF5** (a IA propõe as
habilidades de cada capítulo, em lote), **RF6** (a coordenação corrige; a correção humana vence), **RF7, a habilidade**
(a da questão é uma das do capítulo citado), **RF9** (o professor troca a habilidade da questão), **RF12**
(reclassificar sem reenviar), **RF15, "classificadas"** (as 300 apostilas classificadas na mesma noite) e **RF19** (a
cobertura). O texto e a prova de cada um estão na seção 5 do PRD da F4. **RF20** vale aqui para a classificação e a
cobertura.

## 6. Regras de negócio, 7. Casos de borda, 8. Dado pessoal, 8b. Risco regulatório, 9. Métricas

As das seções 6 a 9 do PRD da F4 que falam de classificação, habilidade, BNCC e cobertura. A seção 8b inteira é desta
spec: a AIA `docs/aia/diagnostico-por-habilidade.md` é revista antes da tarefa que troca o catálogo. A classificação é
uma função nova do Assistente de ensino, visível em "Como cada IA trabalha" e suspensível (regra 70, item 5; D9).

## 10. Perguntas em aberto

As da BNCC na seção 10 do PRD da F4 (fonte da tabela, art. 8º, IV, revisão da BNCC, licença e uso com IA, taxa mínima da
classificação), mais: a IA no worker para a classificação, sem o resto da 47.0 da X6 (pergunta da Tech Spec desta spec).
