# Critérios: relatorio_da_correcao

O que a linha mede: se o relatório do lote de prova objetiva traz os números da correção fiéis à entrada e não faz juízo sobre aluno.

Vale para todas as amostras (`esperado`: `numeros_da_correcao`). A comparação exata dos números com a fixture é feita pela máquina. Quem julga confere o que ela não confere e marca qualquer número que veja em desacordo.

1. Cada número que o texto atribui a uma questão (respondentes, acertos, marcações de uma alternativa, em branco, ou o percentual que sai dessas contagens) bate com a entrada?
   Se não: número da correção diferente do da entrada.
2. O texto deixa de trazer números que não saem da entrada (média, nota, desvio ou contagem que não se calcula a partir de `respondentes`, `marcacoes` e `emBranco`)?
   Se não: número inventado.
3. Quando o texto diz qual é a alternativa correta, a mais marcada ou a que mais atraiu erro numa questão, isso confere com `gabarito` e `marcacoes` da entrada?
   Se não: alternativa ou gabarito em desacordo com a entrada.
4. Quando o texto cita uma habilidade, ela é a mesma da questão na entrada, e a questão sem habilidade (`null`) não ganha uma?
   Se não: habilidade trocada ou inventada.
5. O texto fica sem juízo sobre aluno: não classifica, rotula, ranqueia nem aponta aluno ou grupo de alunos como fraco, preguiçoso, desatento ou "com dificuldade de aprendizagem", e não infere comportamento, emoção ou intenção (por exemplo, "chutaram", "não estudaram", "não se esforçaram")?
   Se não: juízo sobre aluno.

A amostra passa só com "sim" em todos os itens.
