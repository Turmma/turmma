# Achados das revisões — `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-09 13:51:36 · `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. Nenhuma migration nem schema mudou. A árvore tem só `apps/api/src/sessao/external/cookie-oidc.test.ts` (11 linhas incluídas, 3 removidas) e o documento da correção.

Queries verificadas: nenhuma. Nenhum repository, query, endpoint ou `@Unscoped()` foi tocado. Nenhum endpoint passou a receber `escolaId` do cliente.

Teste de isolamento: não se aplica. A tarefa só muda um teste de integridade do cookie `educa_conta_provada`, que não tem escopo de escola. O caso novo continua efetivo: ele decodifica o valor, inverte um bit de cada byte (IV, etiqueta e texto) em 50 cookies e exige `undefined`. Se a verificação do AES-GCM for tirada mentalmente, o teste quebra. Também confere antes que o cookie original sem alteração ainda é lido (`toEqual(CONTA)`), então ele não passaria só porque a leitura sempre falha. Os casos de outra chave, valor ausente, vazio e sem sentido continuam iguais.

Bloqueantes: nenhum.

Recomendações:
- Não rodei o teste: `pnpm` não está no PATH deste shell. A estabilidade (17 de 17 verdes, dez vezes seguidas) vem do documento da correção, e a esteira deve confirmar.
- O laço agora faz 50 × 275 leituras em vez de 367. Se o tempo do arquivo crescer de forma visível, menos cookies (10 a 20) bastam para não depender de qual IV saiu, mas isso não bloqueia.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-09 13:51:39 · `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

VEREDITO: APROVADO

Escopo: respeitado. Só o caso `byte alterado, outra chave, valor ausente, vazio ou sem sentido não valem` do `educa_conta_provada` mudou, como o documento pede. Nenhum código de produção mudou, e o restante do caso continua igual.

Aderência à Tech Spec: ok. A correção alinha o caso da 14.0 ao que o cookie promete e ao caso vizinho do `educa_oidc` (`cookie-oidc.test.ts:50-57`), que inverte um bit por byte decodificado da mesma forma. O documento explica bem a causa: o último caractere do base64url leva bits de enchimento, e por isso a troca `A` → `B` às vezes devolve os mesmos bytes. Nada diverge da arquitetura.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- A variável do laço se chama `cookie` em `apps/api/src/sessao/external/cookie-oidc.test.ts:122` e esconde a função `cookie()` do mesmo arquivo (linha 23). Hoje não quebra nada, porque o bloco do `educa_conta_provada` só chama `daConta()`. Ainda assim, um nome como `amostra` ou `vez` evita confusão e evita erro em edição futura.
- O `valor` da linha 118 agora só serve à asserção de outra chave (linha 131). Gerá-lo junto dela deixaria o caso mais fácil de ler.
- O caso vizinho do `educa_oidc` testa um único cookie, e o problema do enchimento não o afeta, porque ele já altera bytes e não caracteres. Não precisa mudar. Só registro que os dois casos agora diferem no número de cookies (1 e 50) sem motivo escrito para o `educa_oidc`.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/cookie-oidc.test.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-09 13:51:40 · `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/cookie-oidc.test.ts`, a variável `valor`, criada antes do laço, agora só serve ao caso `OUTRA_CHAVE`. Vale levá-la para junto desse caso ou usar o primeiro cookie do laço, para não parecer que ela ainda alimenta o teste de byte alterado.

A mudança é só no teste. Nenhum arquivo de produção mudou e nenhum provedor pago é chamado. O laço passa por 50 cookies de 275 bytes, cerca de 13.750 decifrações. Rodei o arquivo localmente: 17 de 17 testes passaram, e os testes em si levaram uma fração dos 2,4 s da execução, então o custo na esteira é desprezível.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-09 13:51:47 · `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

VEREDITO: APROVADO

A mudança mexe só em um teste. Nenhum código de produção muda, nenhum dado pessoal novo é coletado ou exposto, e o teste reforçado continua provando que o cookie `educa_conta_provada` está protegido contra adulteração.

Campos pessoais tocados: nenhum. O teste continua lendo e gravando o objeto `CONTA` (`escolaId`, `acessoId`, `provedor`, `tenant`, `sujeito`), sem campo novo. `sujeito` é o identificador opaco da conta da escola que a D48 permite guardar.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque não há rota nova nem alterada. A integridade do cookie continua testada, agora com mais força: um bit invertido em cada byte (IV, etiqueta e texto cifrado), em 50 cookies com IV aleatório, e todos precisam dar `undefined`. A conferência de que o cookie sem alteração ainda decifra para `CONTA` também está lá (linha 124), então o teste não passa à toa. Os casos de outra chave, valor ausente, vazio e sem sentido continuam iguais.

Logs: limpos. A mensagem de falha da asserção (`cookie N, byte M`) leva só índices. O arquivo de produção `cookie-oidc.ts` não tem `logger` nem `console`.

Auditoria: não se aplica, porque nenhuma ação desta tarefa a exige.

Envio externo: nenhum.

Seed/fixture: sintético. `CONTA` usa UUIDs de padrão fabricado (`0199a0b0-0000-7000-8000-…`, `aaaaaaaa-…`, `0a0a0a0a-…`), e as chaves vêm de `randomBytes`.

Bloqueantes: nenhum.

Recomendações:
- Não consegui rodar o teste aqui: não há `pnpm` no PATH nem `vitest` instalado em `apps/api/node_modules` neste worktree. Os números de estabilidade e das 2000 amostras citados no documento não foram conferidos por mim; quem confere isso é o `test-engineer` ou a esteira.
- O diagnóstico do documento está correto: no base64url, os 2 bits de enchimento do último caractere são ignorados pelo decodificador, então trocar o caractere não muda os bytes e o AES-GCM decifra. Isso não é falha do cookie, e o teste novo testa exatamente o que o cookie garante, que é a recusa de qualquer byte alterado. Se quiser, vale mudar o nome da variável de laço `cookie`, que encobre a função `cookie()` declarada no topo do arquivo. É só legibilidade.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/cookie-oidc.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-09 13:52:04 · `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

VEREDITO: APROVADO

**Cenários exigidos** (a correção só muda o teste; o cookie não muda):
- Caminho feliz: o cookie gravado é lido de volta, e a conta volta igual.
- Mudar qualquer byte decodificado, seja no IV, na etiqueta ou no texto cifrado, faz o cookie não valer, em qualquer cookie gerado, qualquer que seja o IV.
- O caso da causa: o último caractere do base64url carrega 2 bits de enchimento. Isso deixa de pesar, porque o teste altera bytes e não caracteres.
- Cookie cifrado com outra chave, valor ausente, vazio ou sem sentido: continua não valendo.
- Isolamento e permissão: não muda nada nesta correção. O cookie de uma instalação não abre o de outra (linha 131), e o `educa_oidc` não vale como `educa_conta_provada` (caso da linha 143, que já existia).
- Concorrência: não se aplica. É uma função pura, sem estado compartilhado.

**Cobertos:**
- Linha 124: o cookie sem alteração tem de voltar igual a `CONTA`. É o controle positivo, e ele impede o teste de passar à toa se `ler` passasse a devolver `undefined` para tudo.
- Linhas 125 a 129: um bit invertido em cada um dos 275 bytes, em 50 cookies com IV novo, e cada leitura tem de dar `undefined`. É o mesmo método do caso vizinho do `educa_oidc` (linhas 50 a 57).
- Linhas 131 e 132: outra chave e valores inválidos, sem mudança.

**O teste falharia se a regra fosse removida?** Sim. Sem a conferência da etiqueta do AES-GCM, inverter um bit da própria etiqueta deixaria o cookie decifrar e devolver `CONTA`, e o `toBeUndefined` ficaria vermelho. Se a produção ignorasse algum byte (um prefixo que ninguém confere, por exemplo), o caso já estaria vermelho hoje. O resultado não depende mais da sorte: uma etiqueta forjada passa com probabilidade de 2^-128, e a armadilha do enchimento não existe mais, porque o base64url é refeito a partir dos bytes alterados.

**A conta do documento confere:** 367 × 6 = 2202 bits, ou seja, 275 bytes e 2 bits de enchimento. O último caractere só pode ser um dos 16 com os 2 bits de baixo zerados (`A E I M Q U Y c g k o s w 0 4 8`), e quando ele é `A` a troca por `B` só muda o enchimento. O resto do caso não mudou.

**Lista de checagem:**
- Não há `.skip`, teste comentado nem mock.
- Não há IA envolvida.
- Mutação: nenhum arquivo de produção mudou, então o "0 linhas" da seção "Mutações" é correto.
- O documento não tem tabela de testes; o caso é citado pelo nome em "Teste que reproduz".
- Rodei `npx vitest run apps/api/src/sessao/external/cookie-oidc.test.ts` uma vez: 17 de 17 verdes, em 2,17 s. O laço novo custa pouco, cerca de 13.750 leituras.
- `eslint.config.mjs` não tem `no-shadow`, então o nome do laço não quebra o lint.

**Bloqueantes:** nenhum.

**Recomendações** (não bloqueiam):
1. Em `cookie-oidc.test.ts:122`, a variável do laço se chama `cookie` e esconde a função `cookie()` do módulo (linha 23). Hoje não quebra, porque o laço não chama a função, mas um nome como `amostra` evita confusão numa edição futura.
2. O caso vizinho do `educa_oidc` (linhas 50 a 57) usa um cookie só e não tem o controle positivo. Ele não sofre do problema do enchimento, porque já altera bytes, mas ganharia a mesma conferência de que o cookie original volta igual antes do laço. Fica para a retro, fora desta correção.
3. Os números "106 em 2000" e "nenhum com o laço novo" vêm de um arquivo temporário que foi apagado e não podem ser conferidos. Ficam como registro histórico; o raciocínio do documento basta para sustentar a correção.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/cookie-oidc.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 13:58:08 · `tasks/correcoes/2026-11-09-byte-alterado-do-cookie-oidc.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Só o arquivo de teste mudou e nenhum código de produção foi tocado.
Portão local: carimbo válido. O `conferir` passou com typecheck, lint, segredo, dependências, unidade e alvo.
Bloqueantes: nenhum.
Recomendações: nenhuma nova.

As duas recomendações da 1ª rodada estão feitas, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/external/cookie-oidc.test.ts`:

- **Nome da variável do laço:** passou a se chamar `amostra`, então a função `cookie()` não fica mais escondida. A mensagem da asserção usa o nome novo.
- **Posição de `valor`:** agora é gerado depois do laço, logo antes da asserção de outra chave. É um cookie novo e válido, então essa asserção e a dos valores ausentes continuam testando o que testavam antes.

O resto da troca não mudou e continua certo. O teste altera um bit de cada byte decodificado e não um caractere do texto em base64url, faz 50 amostras com IV novo em cada uma e confere a ida e volta antes de cada amostra.
