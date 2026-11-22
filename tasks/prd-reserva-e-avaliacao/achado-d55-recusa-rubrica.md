# Achado: a regra fixa da D55 recusa rubrica pedida antes da aplicação

**Onde:** `packages/core/src/ia/tasks/propor-ferramenta.ts`, `conversaPedeJulgamentoDeTextoDeAluno` (o `semModelo` de `propor_ferramenta`).
**Achado em:** 22/11/2026, na 10.0 de reserva-e-avaliacao, escrevendo a linha `rubrica_de_discursiva` (`tools/ia/amostras/avaliacao-1.json`).
**Fora do escopo da F5b:** nenhum prompt nem regra muda nesta spec (techspec §7b). Vai ao Orquestrador para `corrigir` ou para o roadmap.

A D55 permite, e o produto promete, "rubrica e critérios antes da aplicação". Dos 20 pedidos de rubrica escritos em contexto
limpo, sem texto de aluno e antes da aplicação, a regra devolveu a recusa fixa a 13 na primeira versão e a 7 depois de uma
reescrita que já tirava "corrigir" e "correção". O professor que pede assim recebe a recusa e não chega ao modelo.

Pedidos que a regra recusa, tais como estavam na segunda versão:

- "Me ajuda com os critérios pra um artigo de opinião? Tema livre dentro de "uso de celular na adolescência". Turma de 9º ano,
  primeira vez com esse gênero. Queria por competência mesmo: tese, argumentos, contra-argumento, linguagem e organização, com a
  descrição de cada nível."
- "oi! o 6º vai escrever um relato pessoal sobre uma viagem ou um passeio marcante. queria critérios simples do que um bom relato
  precisa ter, tipo 4 critérios com 3 níveis cada, pra colar no caderno deles antes de começarem"
- "Me dá descritores de níveis pra uma questão discursiva de Sociologia: "Diferencie desigualdade social de diferença cultural,
  com um exemplo de cada no Brasil atual." 1ª série. Quero 4 níveis com nome (inicial, em desenvolvimento, proficiente,
  avançado) e o que caracteriza cada um."
- "Semana que vem vou propor uma redação no modelo do ENEM, tema: o descarte de lixo eletrônico no Brasil. Monta os critérios
  pelas 5 competências, com os níveis de 0 a 200 e o que caracteriza cada nível, numa linguagem que a turma entenda, pra eu
  mostrar antes de eles começarem a escrever."

Na amostra, a linha foi reescrita até chegar ao modelo, porque mede a rubrica do modelo, e não a regra. Assim ela não mede mais
o que o professor de verdade escreve. O conserto da regra é falso positivo contra uma permissão da D55, e precisa da regra 70
(nenhum caminho novo para o juízo sobre texto de aluno): os casos acima viram teste de "passa", junto com os de recusa que já existem.
