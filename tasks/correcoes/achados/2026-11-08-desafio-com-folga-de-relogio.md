# Achados das revisões — `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 06:30:15 · `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção só muda a forma de conferir o `iat` dos dois desafios de login (o da escola e o do operador). As claims seguem as mesmas e só levam ids opacos: `conta_id`, `sub`, `jti` e os ids de origem.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo nem migration novos.

Autorização por objeto: ok. Nenhuma rota ou repository novo. Toda recusa nova sai pelo mesmo caminho das outras. `exigirIdadeDoDesafio` lança `DomainException(NAO_AUTENTICADO)` dentro do `try`. O `catch` relança esse erro como está, e é a mesma resposta do desafio vencido, de outra etapa ou com assinatura errada (`apps/api/src/credencial/challenge.ts:103-119`, `apps/api/src/operacao/operador-challenge.ts:82-97`). Quem manda um desafio inválido não descobre qual parte falhou.

Logs: limpos. A correção não acrescenta log nenhum. Os dois que já existiam (`login.desafio_sem_redis`, `operacao.desafio_sem_redis`) não carregam dado.

Auditoria: presente. Conferir a idade do desafio não é ação que a regra 20, item 10, mande auditar.

Envio externo: nenhum.

Seed/fixture: sintético. Os testes usam UUIDs fixos (`CONTA`, `OPERADOR`, `ESCOLA_A`), a chave é de teste e as datas são construídas no próprio teste.

Do ponto de vista da regra 20 a correção não piora nada.
- **Prazo:** o `exp` continua conferido pelo `jose` sem folga. A idade continua limitada aos 5 min e é medida em segundos inteiros (`packages/core/src/identidade/verify-token.ts:55-58`). O `iat` passou a ser exigido (`requiredClaims`).
- **Testes:** dois casos provam que a idade continua barrando. O desafio sem `iat` é recusado, e o emitido há 6 min com `exp` de um dia também.
- **Folga:** são 10 s, e só para o `iat` à frente do relógio. Ela não deixa ninguém entrar sem o desafio: ele continua assinado, de uso único (`jti` consumido no Redis) e com `exp` exato.

Bloqueantes: nenhum.

Recomendações:
- `verifyChallenge` e `verifyOperadorChallenge` tiram `agora` de `new Date()` (`challenge.ts:102`, `operador-challenge.ts:81`), enquanto os emissores recebem o `Clock` injetado. Receber o mesmo `Clock` deixaria os testes de borda livres da virada do segundo. Hoje isso é contornado com os 2 s de margem. É assunto de teste, não de privacidade.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/operacao/operador-challenge.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/operacao/operador-challenge.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/index.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 06:30:17 · `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O que conferi para chegar ao veredito:
- **Escopo.** A correção mexe só nos dois verificadores de desafio, na função nova do core, no export, nos três testes e na linha do TODO.md. `verifyToken`, `claimsDeOperador` e `convite-ticket.ts` ficaram de fora, como o documento diz.
- **Comportamento.** O `exp` continua conferido pelo `jose`, sem folga. A idade em segundos inteiros (`floor(agora) - iat <= ttl`) bate com o que o `maxTokenAge` fazia, então o prazo de 5 min fica exato. O `iat` passou a ser obrigatório. Um desafio sem `iat`, ou emitido há 6 min com `exp` longe, é recusado nos dois verificadores.
- **Erro tipado.** O `DomainException` lançado por `exigirIdadeDoDesafio` dentro do `try` sai pelo `throw erro`. A resposta continua `NAO_AUTENTICADO`, a mesma de qualquer desafio inválido, sem dizer o que falhou (regra 10, item 6).
- **Tech Spec.** Nenhuma seção da `techspec.md` descreve o `maxTokenAge` como contrato. A mudança corrige um defeito e não muda a arquitetura.

Recomendações (não bloqueiam):
- **Três cópias da mesma conta.** A conferência da idade com folga existe agora de três jeitos:
  - `iatDoDesafioConfere` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.ts:54`, com a folga de 10 s fixa no código;
  - a conta feita à mão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/convite/convite-ticket.ts:68-69`, com 30 s e o `?? 0`;
  - `exigirIdadeDoDesafio`, repetida igual em `challenge.ts:92` e `operador-challenge.ts:71`, mudando só o TTL.

  Se a função do core recebesse a folga como parâmetro, as três chamadas podiam usá-la. Fica para a retro ou para uma correção pequena.
- **Lugar da função.** `iatDoDesafioConfere` e `FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS` são do desafio de login, mas estão em `verify-token.ts`, que trata do token de acesso. Ao lado de `TIPO_DESAFIO` dá para entender, mas um arquivo próprio do desafio no core ficaria mais fácil de achar.
- **Teste de borda.** O caso `borda: o desafio sem iat, ou com a validade maior que o prazo…` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.test.ts:89` não aparece na seção "Teste que reproduz" do documento da correção. Vale citá-lo lá, porque é ele que prova que a idade continua limitada sem o `maxTokenAge`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 06:30:45 · `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:
- `apps/api/src/credencial/challenge.test.ts:81` e `apps/api/src/operacao/operador-challenge.test.ts:74`: os dois testes conferem a borda exata da folga com o relógio real. Os casos são `emitidoComRelogio(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS)` e `comIat(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS)`, e o `verifyChallenge` e o `verifyOperadorChallenge` leem `new Date()` por dentro. O próprio documento da correção registra que o relógio da máquina de desenvolvimento recua de 0,8 a 1,7 s a cada uns 15 s. Se esse recuo cair entre emitir e conferir, a idade dá -11 ou -12 e o caso que devia passar cai. A chance é pequena, porque a janela é de milissegundos, mas é o mesmo tipo de falha intermitente que as correções `*-sem-relogio` estão tirando. Para fechar isso há dois caminhos. Um é deixar a borda exata só no `verify-token.test.ts`, que já é determinístico, e usar uma folga menos 2 s nos dois testes de API. O outro é injetar o relógio (`Clock`) em `verifyChallenge` e `verifyOperadorChallenge`, ou fixar a hora com `vi.setSystemTime`.
- Duas instâncias com relógios fora já abrem uma pequena janela de reuso do desafio, e a folga não a aumenta. O `jti` consumido no Redis dura `exp - agora` medido no relógio da instância que consumiu (`apps/api/src/credencial/challenge.ts:182`, `apps/api/src/operacao/operador-challenge.ts:134`). Uma instância com o relógio atrás aceita o `exp` por até a diferença dos dois relógios depois de a chave sumir. Vale uma linha em `docs/infra.md` exigindo NTP nas instâncias da API, com um limite de diferença, porque a folga de 10 s parte desse pressuposto.

Conferi o `jose` 6.2.12 em `node_modules/jose/dist/webapi/lib/jwt_claims_set.js`. Sem `maxTokenAge`, ele não confere a idade do `iat`. Com `iat` em `requiredClaims`, ele exige o `iat` como número, e o `exp` continua conferido sem folga, com o `currentDate` passado. O prazo segue exato e o uso único continua com `SET NX` no Redis. Não há estado novo em memória e o custo por request é desprezível. Rodei os três arquivos de teste da correção: 54 casos, todos verdes.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 06:31:11 · `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: um desafio emitido agora é aceito.
- Borda 1: o `iat` está à frente do relógio de quem confere, por outra instância da API ou por um relógio que recua (os 1,3 a 2,6 s medidos). Passa até a folga e é recusado além dela.
- Borda 2: o prazo continua exato. O desafio vencido há 1 s é recusado, e o que ainda tem 10 s de vida passa.
- Borda 3: um desafio emitido há mais de 5 min, mas com `exp` longe, é recusado. Só a idade o barra.
- Permissão: o desafio sem `iat` é recusado, e toda recusa sai como `NAO_AUTENTICADO`, igual à de qualquer desafio inválido.
- Tudo isso vale para os dois verificadores: o da escola (`verifyChallenge`) e o do operador (`verifyOperadorChallenge`).
- Isolamento e concorrência não se aplicam. A correção não toca dado de escola, e o uso único pelo `jti` não mudou.

**Cobertos:**
- `apps/api/src/credencial/challenge.test.ts`, "folga de relógio: …": 3 s à frente e a folga passam, a folga + 2 s não passa, o vencido não passa, o de 10 s de vida passa.
- `challenge.test.ts`, "borda: o desafio sem iat, ou com a validade maior que o prazo…": sem `iat`, e 6 min de idade com `exp` de um dia, ambos recusados.
- `apps/api/src/operacao/operador-challenge.test.ts`, "folga de relógio: …": os mesmos casos, mais o sem `iat` e o mais velho que o prazo com `exp` longe.
- `packages/core/src/identidade/verify-token.test.ts`, `iatDoDesafioConfere`: as bordas exatas em segundos inteiros (o de agora, o do prazo atrás, o da folga à frente, um segundo além da folga, um além do prazo, e o `undefined`).
- Rodei os três arquivos pela raiz e passaram os três, com 54 casos.
- Conferi os seis blocos de mutação contra o diff. Cada condição nova tem um bloco que a derruba pelo motivo certo:
  - Voltar ao `maxTokenAge` cai no caso de 3 s à frente.
  - Tirar o `throw` cai no caso da folga + 2 s.
  - Trocar a folga por `>= 0` e tirar o `<= ttl` caem nos testes da função pura.
- O "sem bloco" do `iat === undefined` está bem justificado. Sem a guarda a conta dá `NaN` e a função devolve `false` do mesmo jeito, então a mutação seria equivalente. Vale o mesmo para tirar `'iat'` sozinho de `requiredClaims`, que não tem bloco próprio mas está dentro do bloco 1.
- Não há `.skip`, mock nem provedor de IA. Não sobra nenhum `maxTokenAge` sem folga: o `convite-ticket.ts` já tinha a sua.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O tamanho da folga não está preso por nenhum teste.** Todas as asserções usam a própria `FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS`. Se alguém subir a constante para 300, tudo continua verde, e o documento defende 10 s em vez de 30. Basta um caso com literal, por exemplo `iatDoDesafioConfere(iat + 30, …)` igual a `false`, ou `expect(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS).toBe(10)` (`verify-token.test.ts:133`).
2. **Os dois casos de "além da folga" dependem do relógio real.** Estão em `challenge.test.ts:81` e `operador-challenge.test.ts:76`. `verifyChallenge` e `verifyOperadorChallenge` leem `new Date()` e não aceitam relógio injetado. A margem é de pouco mais de 1 s entre emitir e conferir: se o event loop travar mais que isso entre os dois `await`, o caso da folga + 2 s passa a ser aceito e o teste fica vermelho. É improvável, porque são operações de menos de 1 ms. Mesmo assim o padrão da casa é relógio falso: receber um `Clock` opcional nos dois verificadores deixaria o teste determinístico.
3. **Texto.** O "Sintoma" diz "1,3 a 2 s à frente", e a "Correção" e o comentário de `verify-token.ts` dizem "2,6 s medidos". Vale alinhar os números ou explicar de onde sai o 2,6.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/index.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/operacao/operador-challenge.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/operacao/operador-challenge.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 07:44:33 · `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido. O `conferir` passou sobre o código atual (typecheck, lint, segredo, dependencias, unidade, alvo).
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.test.ts:79` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/operacao/operador-challenge.test.ts:76`: os dois testes de API agora aceitam a folga menos 2 s e recusam a folga mais 2 s. Por isso, nenhum deles quebraria se a folga fosse 9 s ou 11 s. Hoje essa borda só é provada em `verify-token.test.ts`, de propósito e com o motivo escrito no comentário. A lacuna fecha de verdade quando os verificadores receberem o `Clock` injetado, item que já está no TODO.md com dono.

Nesta rodada conferi:
- **Recomendações aplicadas:**
  - o tamanho da folga ficou preso a um valor literal (10 aceito, 30 recusado), com um bloco de mutação que troca a folga por 300 e cai em `toBe(10)`;
  - a borda exata saiu dos testes que leem o relógio real;
  - o texto "2,6 s" virou "até 2 s" no comentário de `verify-token.ts` e no documento, o que bate com o sintoma medido de 1,3 a 2 s;
  - o caso sem `iat` e com validade longa entrou na lista do "Teste que reproduz".
- **Recomendações sem aplicar:** as quatro estão na tabela do documento, com o motivo, e chegaram ao TODO.md com dono:
  - o `Clock` injetado nos verificadores;
  - as três cópias da conta de idade e o lugar da função, numa entrada só;
  - o NTP em `docs/infra.md`, com o Arquiteto.

  Nenhuma delas é defeito desta correção, e adiar é aceitável, porque cada uma muda assinatura exportada ou toca arquivo fora da correção.
- **Diff:** nenhum outro arquivo de produção da correção mudou desde a rodada 1, e o diff não invade a tarefa 4.0 nem as outras correções da árvore.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 07:44:39 · `tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`

VEREDITO: APROVADO

Cenários exigidos (os mesmos da rodada 1, conferidos só no que o diff mudou):
- Caminho feliz: um `iat` 3 s à frente de quem confere passa, no desafio da escola e no do operador.
- Borda exata da folga: 10 s à frente passa e 11 s é recusado. Agora isso se prova só em `iatDoDesafioConfere`, que recebe o instante e não lê o relógio.
- Tamanho da folga com valor literal (novo): a constante vale 10, 10 s passa e 30 s é recusado. Assim, subir a folga deixa o teste vermelho, mesmo nos testes que usam a constante.
- Além da folga com relógio real: a folga mais 2 s é recusada.
- O prazo continua exato: vencido há 1 s é recusado, e com 10 s de vida passa.
- Desafio sem `iat`, ou com validade maior que o prazo, é recusado.
- Permissão: o desafio de uma porta ou etapa não vale em outra (não mudou nesta rodada).

Cobertos:
- `packages/core/src/identidade/verify-token.test.ts`:
  - › `a folga é de 10 s, e não mais: 30 s à frente já é recusado` (linhas 144-148), que é o caso novo.
  - Os dois casos de borda de `iatDoDesafioConfere` (138-142 e 150-154).
- `apps/api/src/credencial/challenge.test.ts`:
  - › `folga de relógio: …` (75), agora com a folga menos 2 s.
  - › `borda: o desafio sem iat, ou com a validade maior que o prazo do desafio, é recusado` (89), agora citado no documento.
- `apps/api/src/operacao/operador-challenge.test.ts` › `folga de relógio: …` (71), também com a folga menos 2 s.
- O bloco de mutação novo (`FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS = 300`) cai no `toBe(10)`. Esse caso rodou e falhou, então é vermelho pelo motivo certo.
- Rodei os três arquivos: 3 arquivos e 55 testes verdes, sem `.skip`, `.only` ou teste comentado.
- Desde o diff da rodada 2 o código não mudou. A única diferença contra `673ded79` é o documento da correção, que está fora do git (`??`).

Bloqueantes: nenhum.

Recomendações:
- Os dois verificadores (`verifyChallenge` e `verifyOperadorChallenge`) ainda leem `new Date()` por dentro. Os casos "folga + 2 s" e "folga − 2 s" dos testes de API dependem de o relógio real não recuar mais de 1 s entre emitir e conferir. O risco é baixo e já está no `TODO.md`, entrada da correção: o certo é o verificador receber o `Clock`, como os emissores já recebem. Fica para a validação e a retro.
- Tenho três observações menores, que não bloqueiam:
  - Ficaram para depois, todas no `TODO.md`: as três cópias da conta de idade com folga, o lugar da função e a linha sobre NTP em `docs/infra.md`. Os destinos e donos estão corretos.
  - O texto passou a dizer "até 2 s" no lugar de "2,6 s", e está coerente nos três lugares: comentário de `verify-token.ts`, teste e documento.
  - O motivo escrito no "Sem bloco" do `if (iat === undefined)` (mutante equivalente) continua de pé.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/identidade/verify-token.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/challenge.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/operacao/operador-challenge.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-desafio-com-folga-de-relogio.md`
