## O que verificar

1. Toda tabela nova de domínio tem `escolaId`. Tabela que varia por período tem
   `anoLetivoId`.
2. Todo repository aplica escopo a partir do token, não de parâmetro do cliente.
3. Nenhum endpoint aceita `escolaId` vindo do corpo ou da query string para decidir o que
   ler. Se aceita, é escalada de privilégio.
4. Existe teste de isolamento novo e ele realmente falharia sem o escopo. Verifique
   removendo mentalmente a cláusula: o teste quebra?
5. Listagem, busca por id e mensagem de erro não revelam existência de dado de outra escola.
6. Id é UUID.
7. Consulta agregada da camada rede não alcança dado individual.
8. `@Unscoped()` aparece só onde há justificativa escrita.
