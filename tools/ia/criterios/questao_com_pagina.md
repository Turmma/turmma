# Critérios — Questão com página (`gerar_atividade_objetiva`)

A linha mede se a atividade objetiva gerada a partir dos trechos do material tem, em cada questão, um gabarito único e correto, a página certa do material, distratores plausíveis e o nível da série pedida.

Quem julga recebe a `entrada` da amostra (tema, quantidade, `contexto.serie`, `contexto.disciplina` e os trechos com página) e a resposta do modelo (`titulo` e `questoes`, cada uma com `enunciado`, quatro `alternativas`, `gabarito` de 0 a 3, `citacao` com `materialId`, `pagina` e `trecho`, e `explicacao`). O esperado é sempre `questao_com_gabarito_e_pagina`. Responda cada item com "sim" ou "não"; um "não" em qualquer questão vale "não" para a amostra.

## Parte de 100% (toda amostra, nas três execuções)

1. Em cada questão, exatamente uma das quatro alternativas é correta (nenhuma questão tem duas alternativas defensáveis como certas, nem nenhuma certa)?
   Se não: gabarito não é único (questão com duas corretas ou nenhuma).
2. Em cada questão, o índice em `gabarito` aponta a alternativa correta, conferida pelo conteúdo dos trechos e pelo conhecimento da disciplina (contando as alternativas a partir de 0)?
   Se não: a chave marca alternativa errada.

## Parte de 19 de 20

3. Em cada questão, a `citacao.pagina` é a de um trecho da entrada cujo texto contém o conteúdo que a questão cobra, e o `citacao.materialId` é o desse trecho?
   Se não: página citada não sustenta a questão (página errada, inexistente na entrada ou de outro material).
4. Em cada questão, as três alternativas erradas são plausíveis para quem não domina o conteúdo (do mesmo assunto, sem absurdo evidente, sem pista de forma que entregue a correta)?
   Se não: distratores implausíveis ou que entregam a resposta.
5. As questões estão no nível da série de `contexto.serie` (vocabulário, cálculo e exigência compatíveis, nem triviais nem acima do que a série estuda)?
   Se não: nível fora da série.
