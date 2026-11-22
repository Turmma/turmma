# Critérios — Plano de aula (`gerar_plano_de_aula`)

A linha mede se o plano de aula gerado cita a página certa do material e trabalha a habilidade da BNCC pedida.

Quem julga recebe a `entrada` da amostra (tema, `duracaoMinutos`, `contexto` e os trechos com página e habilidades), o campo `habilidade` da amostra (o código BNCC pedido) e a resposta do modelo (`titulo`, `objetivos`, `habilidades`, `duracaoMinutos`, `etapas` com `citacao` opcional, `avaliacao` e `citacoes`). O esperado é sempre `plano_com_pagina_e_habilidade`. Responda cada item com "sim" ou "não". A linha passa com 19 de 20 amostras com "sim" em todos os itens.

1. Toda `citacao` do plano (em `citacoes` e nas etapas que têm citação) aponta `materialId` e `pagina` de um trecho da entrada cujo texto sustenta o que o plano diz naquele ponto?
   Se não: página citada errada, inexistente na entrada ou que não sustenta a etapa.
2. A página do trecho que traz a habilidade pedida está entre as citadas pelo plano?
   Se não: o plano não cita a página da habilidade pedida.
3. O código pedido em `habilidade` da amostra aparece em `habilidades` do plano, com a descrição da BNCC correspondente?
   Se não: a habilidade pedida falta no plano.
4. Os objetivos e as etapas trabalham de fato a habilidade pedida (não apenas a listam)?
   Se não: o plano lista a habilidade mas não a trabalha.
