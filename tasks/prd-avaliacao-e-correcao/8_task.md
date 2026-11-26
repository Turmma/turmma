# Tarefa 8.0 — Saída da aba registrada sem contar duas vezes, e mostrada só no lote

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer`, `test-engineer`, `revisor-geral`, `infra-guardian`
**Porte:** grande

## Objetivo

Cada saída da aba numa prova em andamento conta uma vez na tentativa, e o professor a vê só no lote, na coluna "Saiu da
aba", sempre com o aviso fixo; não é destaque, não trava a aprovação, não soma entre provas.

## Contexto necessário

- `techspec.md` §3 (`saida_da_aba`), §4 (`saidas-da-aba`, `correcao`), §5.8, §7, §7b
- `prd.md` RF9; §7 (leitor de tela)
- `cenarios.md` §1 RF9 (todas), §3 (i), §4 (Aprovar, com o aviso aprovado pelo Joaquim)
- D70 e D88 (`docs/decisoes.md`); `docs/interface.md` §1.4 e §1.6
- `apps/api/src/atividade/correcao/` e `apps/web/src/areas/professor/atividades/Aprovar.tsx`

## Subtarefas

- [x] 8.1 — `POST …/saidas-da-aba`: alcance, prova avaliativa em andamento; `insert … on conflict do nothing` na
  `saida_da_aba` e soma em `saidas_da_aba` só quando a chave é nova; a saída não trava a tentativa antes do `insert`;
  chave só v4 (a rota usa o schema da 1.0); balde de 30/min; a guarda de pulso
- [x] 8.2 — `GET …/correcao` com `saidasDaAba` por aluno só em avaliativa; a validação marca que a coluna foi mostrada,
  sem a contagem no `apresentado`
- [x] 8.3 — Aprovar: a coluna e o aviso fixo (texto de `cenarios.md` §4), também no cartão a 360 px
- [x] 8.4 — `docs/interface.md` §1.6 (a saída não é destaque; a coluna no lote) e §1.4
- [x] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts` | novo |
| `apps/api/src/atividade/correcao/correcao.service.ts` | alterado |
| `apps/api/src/atividade/correcao/correcao.repository.ts` | alterado |
| `apps/api/src/atividade/saida-da-aba.int.test.ts` | novo |
| `apps/web/src/areas/professor/atividades/Aprovar.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/Aprovar.test.tsx` | alterado |
| `docs/interface.md` | alterado |
| `apps/web/src/areas/professor/atividades/aprovar.ts` e `aprovar.test.ts` | alterado (o texto do aviso, `hasSaidaDaAba`, `textoDasSaidas`, o tipo da linha) |
| `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` e `minha-atividade.repository.ts` | alterado (`registrarSaida`; `avaliativa` na leitura) |
| `apps/api/src/atividade/correcao/lote.ts` e `lote.test.ts` | alterado (a marca `saidaDaAbaMostrada`) |
| `packages/core/src/rate-limit/{keys,rate-limiter,rate-limit.guard}.ts`, `saida-da-aba-rate-limit.decorator.ts` (novo) e `packages/core/src/index.ts` | alterado (o balde `rl:saida-da-aba`, a guarda e o decorador) |
| `packages/shared/src/atividade/{correcao,prova}.ts` e `packages/shared/src/index.ts` | alterado (`saidaDaAbaMostrada` no `apresentado`; o teto de 30 por minuto) |
| `apps/api/test/atividade.fixture.ts` e `apps/api/test/contracts.test.ts` | alterado (a rota no ajudante; o contrato) |
| `tasks/prd-avaliacao-e-correcao/techspec.md` | alterado (§7 e §7c, as duas divergências) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Saída nova; a mesma chave; A, B e A | integração | 1; 1; 2 | a chave antiga volta | `saida-da-aba.int.test.ts › a saída nova soma 1; a mesma chave de novo…` |
| Não avaliativa; enviada; vencida | integração | `NAO_ENCONTRADO`, nada muda | três estados | `› a não avaliativa, a que o aluno ainda não começou, a enviada, a vencida…` |
| Chave v7 na rota | integração | `ENTRADA_INVALIDA` | a v4 passa | `› a chave é uuid v4: a v7 e o campo a mais…` |
| Prova 2 começa em 0 | integração | nada somado por aluno | saídas na prova 1 | `› a prova 2 começa em 0…`; `› o lote de uma prova traz só as saídas daquela prova…` |
| 0 e 9 saídas | integração | mesma correção e destaques; o lote aprova sem abrir ninguém; o PUT grava | a tentativa sem outro destaque | `› a mesma tentativa com 0 e com 9 saídas tem a mesma correção…` |
| Saída depois do limite original, com indisponibilidade fechada de 5 min; com lacuna aberta de 3 min; pulso parado 31 s | integração | soma; soma; 503 | sem indisponibilidade, `NAO_ENCONTRADO`; a 29 s aceita | `› a saída depois do limite original conta com a indisponibilidade…`; `saída da aba com o pulso parado › a 29 s a saída é aceita; a 31 s é 503…` |
| `saidasDaAba` no lote | integração | na avaliativa; ausente na não avaliativa | | `› o lote da avaliativa traz saidasDaAba por aluno…` |
| A validação | integração | marca a coluna mostrada; sem contagem no `apresentado` | a não avaliativa não marca | `› a validação da avaliativa guarda que a coluna foi mostrada…`; `lote.test.ts › a marca de que a coluna…` |
| Contrato | unidade | nenhuma rota do aluno, da coordenação nem da rede traz `saidas` | a `correcao` do professor traz | `contracts.test.ts › avaliacao-e-correcao 8.0…`; `› a coordenação e o aluno não leem o lote…` |
| Corrida (i) | integração | 2 com chaves diferentes; 1 com a mesma | `WriteBlockTrigger` no `insert` | `› (i) saída × saída`, os dois casos |
| 31ª saída no minuto | integração | 429; outro aluno no mesmo IP passa | a 30ª passa | `› a 31ª saída do minuto é 429…` |
| Aluno de A na B; transferido; repository da `saida_da_aba` no contexto da A com ids da B, com o ano da B na escola da A, e com um ano que não é de ninguém e a aplicação da A | integração | `NAO_ENCONTRADO` e a contagem da B segue 0; vazio | a tentativa da B em andamento | `› o aluno de outra turma e o de outra escola…`; `› o aluno transferido…`; `› no repository: o id certo com o contexto errado` |
| Coluna no Aprovar | unidade web | só em avaliativa; o aviso da §4 pela frase inteira (`getByText` exato), acima da tabela; a contagem também no cartão | coluna sem o aviso fica vermelha | `Aprovar.test.tsx › Revisar a correção: a coluna "Saiu da aba"…` (7 casos); `aprovar.test.ts › a coluna "Saiu da aba"…` |
| Estados do Aprovar | unidade web | carregando, erro, com dado, como hoje | | `Aprovar.test.tsx › Revisar a correção: os estados` (sem mudança, verde) |

## Como testar

- Lote: `apps/api/src/atividade/correcao/correcao.int.test.ts`; aprovar com `aprovarOLote` (`apps/api/test/atividade.fixture.ts`)
- Tela: `apps/web/src/areas/professor/atividades/Aprovar.test.tsx › carregando, com o título e o caminho de volta…`
- Corrida: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- `npx vitest run --project integracao apps/api/src/atividade/saida-da-aba.int.test.ts`
- **Telas:** professora · `/professor/aprovar/:atividadeAplicadaId` · o lote de uma prova avaliativa com saídas

## Autoconferência

1. **Mutação de cada cláusula:** a seção "Mutações" tem os blocos de cada termo do `where` da tentativa (escola, ano, aplicação e aluno), do `where` do `update` da soma, da chave que já existe, do `on conflict`, da soma de 1, de cada termo das duas condições do service e da linha do limite, da fiação do controller (a guarda do pulso, o balde e o schema do corpo; a permissão vai com motivo), da guarda do balde (a rota marcada e a recusa), do teto nos dois lados, do prefixo e da chave do balde, dos dois termos da junção da tentativa no lote, das duas pontas de cada ternário (`comSaidas` no service, `saidaDaAbaMostrada` no lote, e, na tela, a coluna e a linha de cada destaque), do `?? null` e, na tela, de cada termo dos dois avisos. As cópias da mesma regra (o `comSaidas` do service e o `hasSaidaDaAba` da tela) têm bloco cada uma.
2. **O texto na tela:** `grep -rln 'Saiu da aba' e2e/` não acha nada, e nenhum spec conta células, colunas ou alertas da correção; os specs que passam pelo Aprovar (`professor-aprovar.spec.ts` e vizinhos) usam atividade sem prova, que não ganha a coluna nem o aviso.
3. **O segundo dado de cada cláusula:** a Ana com tentativa nas duas provas (o `where` da aplicação, a junção do lote), o colega que não começou (o aluno), no repository, o aluno e a aplicação da B com o contexto da escola A (a escola trocada), com o ano da B na escola da A (só o termo da escola separa) e com um ano que não é de ninguém (o ano trocado, no caso da Ana, com a aplicação dela), o aluno novo em cada caso do balde (o IP e o usuário), a não avaliativa ao lado da avaliativa (a marca, a coluna, o aviso), o lote só com destaques e o lote só com outras (o aviso só com lista).
4. **A checagem anterior que responde antes:** o pulso é posto fresco antes de cada caso, e o segundo bloco do arquivo, o do pulso parado, injeta o relógio e restaura a indisponibilidade que a 31 s cria. O caso do estado (não avaliativa, enviada, vencida) usa o aluno da turma com tentativa, que passa pelo alcance antes de chegar à linha; o do professor e da coordenação vem depois da prova de outra escola, que já cai no alcance, e por isso usa a prova da A.
5. **A asserção olha o resultado:** a contagem lida do banco (`contagem()`), o código e o status da resposta, as chaves de `Object.keys` da correção e do `apresentado`; a ausência (`not.toMatch(/saida/i)`) vem sempre depois de uma leitura que traria o campo (a `correcao` do professor, na mesma cena, o traz). A tela lê pela frase inteira do aviso (`getByText` exato), e a ordem acima da tabela vem de `compareDocumentPosition`.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** os docblocks do `registrarSaida` ("a aplicação não é travada") e do `registrar` ("a soma é do banco") têm os casos da corrida (i); o do `correcaoDoAluno` ("só no lote da avaliativa", "nunca somada entre provas") tem o caso da Ana nas duas provas e o da não avaliativa; o do controller diz que o 503 vale para a saída (o caso do pulso parado) e o balde de 30 (o caso do balde). `docs/interface.md` §1.4 e §1.6 dizem o que a tela faz (o caso da coluna e do aviso, e o de "não vira destaque").
8. **Divergências:** uma, a forma da marca na validação, abaixo; a `techspec.md` §7 e §7c já dizem o mesmo. O `prd.md` (RF9) e o `cenarios.md` (§1 e §4) não dizem o contrário.
9. **Latência medida:** a rota nova é uma gravação curta, de dois comandos numa transação, com o balde por usuário; a medida da prova online (`prova-online.js`, 6.5) é a que dimensiona o caminho quente, e a rota segue a `comecar` e a `responder` (mesma guarda de pulso e mesmo balde por usuário).
10. **Peça que já existe:** `limiteDaTentativaDoAluno` e `venceu` (a 2.0), `RotasDeProvaGuard`, `ComecarProvaRateLimit` como modelo do decorador e do balde, `WriteBlockTrigger` e `esperarNaTrava`, `aprovarOLote`, `Table` e `Alert` da tela. Peça nova: o `SaidaDaAbaRepository`, o balde e a coluna.
11. **A operação em duas chamadas ao mesmo tempo:** a corrida (i), nos dois sentidos: chaves diferentes (as duas somam, a primeira parada no `insert` pelo `WriteBlockTrigger`) e a mesma chave (a segunda espera na chave única e não soma). A soma é `saidas_da_aba + 1` no banco.
12. **O isolamento quebra sem a cláusula:** o aluno da B com o id da A e o da A com o id da B, o ano trocado, o aluno sem tentativa e a outra aplicação do mesmo aluno, cada um no caso do repository.
13. **Os guardiões:** `tenancy-guardian` (o escopo no repository, o `NAO_ENCONTRADO` igual para tudo), `privacy-guardian` (a contagem só no lote do professor da turma, fora do `apresentado`, sem lista de instantes, sem log com aluno), `conformidade-reviewer` (D70: fato, sem consequência, aviso fixo, nunca somado entre provas; não destaca nem trava a aprovação) e `frontend-reviewer` (a coluna e o aviso a 360 px, os quatro estados).

## Fora do escopo desta tarefa

O envio pela tela de foco (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| A forma da marca na validação: `apresentado.saidaDaAbaMostrada: true`, só na avaliativa | A Tech Spec dizia só "a validação guarda que a coluna foi mostrada"; sem nome e forma não há esquema zod que a valide nem teste que a distinga da contagem | `techspec.md` §7 (a frase de "A contagem de saídas fica só no lote"), `loteApresentadoSchema` em `packages/shared/src/atividade/correcao.ts` |
| O balde da saída tem prefixo próprio (`rl:saida-da-aba`), como o do `comecar` | A Tech Spec dizia "30/min por usuário"; faltava dizer que o balde não é o do `comecar` (o aluno que sai muito não pode ficar sem começar a prova) | `techspec.md` §7c, linha "Rate limit" |

## Mutações

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os casos de `saida-da-aba.int.test.ts` rodam sobre o banco compartilhado, com o pulso fresco posto antes de cada um (o segundo bloco do arquivo injeta o relógio do pulso e devolve a indisponibilidade ao que era). O código novo é o `SaidaDaAbaRepository`, o `registrarSaida` do service, a rota, o balde (guarda, limitador e teto), a leitura da contagem no lote (`correcao.repository.ts`, `correcao.service.ts`, `lote.ts`) e a coluna e o aviso da tela.

--faltando: 0 linhas (43 blocos, 3 motivos). As linhas com um só termo (`token === undefined`, `venceu(…)`) estão em um bloco do mesmo arquivo, como contexto ou como a linha que sai. O termo da escola do repository tem bloco (rodada 1, item 3): o caso do repository usa a escola da A com o ano da B, e só ele separa a gravação. A condição do ternário que põe a contagem na linha de cada destaque (`Aprovar.tsx`, prop `abaixo`) tem os dois blocos (rodada 1, item 1), que o `--faltando` não vê dentro de um template string.

**Sem bloco, com o motivo (cláusula equivalente ou coberta por outra peça):**

- `eq(tentativaAtividade.escolaId, correcao.escolaId)` e `eq(tentativaAtividade.anoLetivoId, correcao.anoLetivoId)` (junção do lote): a tentativa e a correção da mesma aplicação e do mesmo aluno são, por FK composta, da mesma escola e do mesmo ano; a aplicação e o aluno do `on` seguem com bloco, e o escopo que decide é o do `where` da correção, anterior a esta tarefa.
- `@RequirePermissao('minha_atividade', 'registrar_saida')` do controller (não é condição, mas a linha protege): sem ela a API não sobe (`PermissaoBootCheck`), e trocar a ação por outra dá o mesmo resultado nos casos, porque o alcance do repository já devolve `NAO_ENCONTRADO` a quem não é o aluno da tentativa; o que prova a permissão é a matriz (`packages/shared/src/permissao/matriz.test.ts`, `registrar_saida` só do aluno, `proprio`), e o caso do professor e da coordenação segue no teste de alcance.
- `!anonima` e `token === undefined` na guarda do balde da saída: a rota exige sessão, o decorador só está nela, e o token já foi lido pela guarda de sessão; as duas condições repetem as do balde do `comecar`, e tirar uma delas não muda o que a rota responde. Ficam pela simetria com o balde vizinho.

<!-- repository: o `where` do select da tentativa -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › só grava para a tentativa do aluno da sessão
-.where(daTentativa),
```

<!-- repository: o `where` do update da soma -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › só grava para a tentativa do aluno da sessão
 .set({ saidasDaAba: sql`${tentativaAtividade.saidasDaAba} + 1` })
-.where(daTentativa)
```

<!-- repository: a chave que já existe não soma -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a saída nova soma 1; a mesma chave de novo não soma
-if (nova.length === 0) return false
```

<!-- repository: o ano da tentativa -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › só grava para a tentativa do aluno da sessão
-eq(tentativaAtividade.anoLetivoId, anoLetivoId),
```

<!-- repository: a aplicação da tentativa -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › só grava para a tentativa do aluno da sessão
-eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
```

<!-- repository: o aluno da sessão -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › só grava para a tentativa do aluno da sessão
-eq(tentativaAtividade.alunoId, alunoId),
```

<!-- repository: a soma é de 1 -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a saída nova soma 1; a mesma chave de novo não soma
-.set({ saidasDaAba: sql`${tentativaAtividade.saidasDaAba} + 1` })
+.set({ saidasDaAba: sql`${tentativaAtividade.saidasDaAba} + 2` })
```

<!-- repository: `on conflict do nothing` -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a saída nova soma 1; a mesma chave de novo não soma
-.onConflictDoNothing()
```

<!-- service: o alcance (a aplicação que o aluno não alcança) -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › o aluno de outra turma e o de outra escola
-if (atividade === undefined || !atividade.avaliativa || atividade.estado !== 'aberta') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (!atividade.avaliativa || atividade.estado !== 'aberta') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

<!-- service: a prova que não é avaliativa -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a não avaliativa, a que o aluno ainda não começou
-if (atividade === undefined || !atividade.avaliativa || atividade.estado !== 'aberta') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (atividade === undefined || atividade.estado !== 'aberta') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

<!-- service: a aplicação que não está aberta -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a não avaliativa, a que o aluno ainda não começou
-if (atividade === undefined || !atividade.avaliativa || atividade.estado !== 'aberta') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (atividade === undefined || !atividade.avaliativa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

<!-- service: o aluno que não começou -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a não avaliativa, a que o aluno ainda não começou
-if (tentativa === undefined || tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

<!-- service: a tentativa já enviada -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a não avaliativa, a que o aluno ainda não começou
-if (tentativa === undefined || tentativa.enviadaEm !== null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (tentativa === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

<!-- service: a tentativa vencida -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a saída depois do limite original
-if (venceu(await limiteDaTentativaDoAluno(tx, id, tentativa), tentativa.agora)) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

<!-- controller: a guarda do pulso -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 29 s a saída é aceita; a 31 s é 503
 @Post('atividades-aplicadas/:id/saidas-da-aba')
-@UseGuards(RotasDeProvaGuard)
```

<!-- controller: o balde da saída -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
-@SaidaDaAbaRateLimit()
```

<!-- controller: o schema do corpo (a chave v4) -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a chave é uuid v4
-saidaDaAba(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(registrarSaidaDaAbaRequestSchema)) { chave }: RegistrarSaidaDaAbaRequest): Promise<void> {
+saidaDaAba(@Param('id', IdPipe) atividadeAplicadaId: string, @Body() { chave }: RegistrarSaidaDaAbaRequest): Promise<void> {
```

<!-- guarda: só a rota marcada gasta o balde da saída -->
```mutacao
arquivo: packages/core/src/rate-limit/rate-limit.guard.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
-if (!anonima && this.reflector.getAllAndOverride<boolean | undefined>(SAIDA_DA_ABA_RATE_LIMIT_KEY, alvos) === true) {
+if (!anonima) {
```

<!-- guarda: a recusa do balde (o `token` é contexto: sempre existe depois da guarda de sessão) -->
```mutacao
arquivo: packages/core/src/rate-limit/rate-limit.guard.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
 if (token === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
 const daSaida = await this.limitador.consumeDaSaidaDaAba(token.usuarioId)
-if (!daSaida.aceita) {
+if (false) {
```

<!-- limitador: o teto, uma a menos -->
```mutacao
arquivo: packages/core/src/rate-limit/rate-limiter.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
-this.#saidaDaAba = createLimite(cliente, PREFIXO_LIMITE_SAIDA_DA_ABA, LIMITE_DA_SAIDA_DA_ABA_POR_MINUTO, config.instancias)
+this.#saidaDaAba = createLimite(cliente, PREFIXO_LIMITE_SAIDA_DA_ABA, LIMITE_DA_SAIDA_DA_ABA_POR_MINUTO - 1, config.instancias)
```

<!-- limitador: o teto, uma a mais -->
```mutacao
arquivo: packages/core/src/rate-limit/rate-limiter.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
-this.#saidaDaAba = createLimite(cliente, PREFIXO_LIMITE_SAIDA_DA_ABA, LIMITE_DA_SAIDA_DA_ABA_POR_MINUTO, config.instancias)
+this.#saidaDaAba = createLimite(cliente, PREFIXO_LIMITE_SAIDA_DA_ABA, LIMITE_DA_SAIDA_DA_ABA_POR_MINUTO + 1, config.instancias)
```

<!-- limitador: o balde próprio, e não o do `comecar` -->
```mutacao
arquivo: packages/core/src/rate-limit/rate-limiter.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
-this.#saidaDaAba = createLimite(cliente, PREFIXO_LIMITE_SAIDA_DA_ABA, LIMITE_DA_SAIDA_DA_ABA_POR_MINUTO, config.instancias)
+this.#saidaDaAba = createLimite(cliente, PREFIXO_LIMITE_COMECAR_PROVA, LIMITE_DA_SAIDA_DA_ABA_POR_MINUTO, config.instancias)
```

<!-- limitador: a chave é o usuário, e não uma comum -->
```mutacao
arquivo: packages/core/src/rate-limit/rate-limiter.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a 31ª saída do minuto é 429
-return this.#consumeUmaChave(this.#saidaDaAba, usuarioId)
+return this.#consumeUmaChave(this.#saidaDaAba, 'todos')
```

<!-- correcao.repository: a aplicação na junção da tentativa -->
```mutacao
arquivo: apps/api/src/atividade/correcao/correcao.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › o lote de uma prova traz só as saídas daquela prova
-eq(tentativaAtividade.atividadeAplicadaId, correcao.atividadeAplicadaId),
```

<!-- correcao.repository: o aluno na junção da tentativa -->
```mutacao
arquivo: apps/api/src/atividade/correcao/correcao.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › o lote de uma prova traz só as saídas daquela prova
-eq(tentativaAtividade.alunoId, correcao.alunoId),
```

<!-- correcao.service: a saída só na avaliativa (sempre) -->
```mutacao
arquivo: apps/api/src/atividade/correcao/correcao.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › o lote da avaliativa traz `saidasDaAba` por aluno
-...(comSaidas ? { saidasDaAba: lida.saidasDaAba } : {}),
+...(true ? { saidasDaAba: lida.saidasDaAba } : {}),
```

<!-- correcao.service: a saída só na avaliativa (nunca) -->
```mutacao
arquivo: apps/api/src/atividade/correcao/correcao.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › o lote da avaliativa traz `saidasDaAba` por aluno
-...(comSaidas ? { saidasDaAba: lida.saidasDaAba } : {}),
+...(false ? { saidasDaAba: lida.saidasDaAba } : {}),
```

<!-- correcao.service: o destaque sem abertura é `null` -->
```mutacao
arquivo: apps/api/src/atividade/correcao/correcao.service.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › o lote da avaliativa traz `saidasDaAba` por aluno
-const destaqueParaATela = (lida: CorrecaoLida, comSaidas: boolean) => ({ ...correcaoDoAluno(lida, comSaidas), motivos: lida.destaques, abertoEm: lida.destaqueAbertoEm?.toISOString() ?? null })
+const destaqueParaATela = (lida: CorrecaoLida, comSaidas: boolean) => ({ ...correcaoDoAluno(lida, comSaidas), motivos: lida.destaques, abertoEm: lida.destaqueAbertoEm?.toISOString() ?? undefined })
```

<!-- lote: a marca da coluna só na avaliativa (sempre) -->
```mutacao
arquivo: apps/api/src/atividade/correcao/lote.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a validação da avaliativa guarda que a coluna foi mostrada
-...(dados.saidaDaAbaMostrada === true ? { saidaDaAbaMostrada: true as const } : {}),
+...(true ? { saidaDaAbaMostrada: true as const } : {}),
```

<!-- lote: a marca da coluna só na avaliativa (nunca) -->
```mutacao
arquivo: apps/api/src/atividade/correcao/lote.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › a validação da avaliativa guarda que a coluna foi mostrada
-...(dados.saidaDaAbaMostrada === true ? { saidaDaAbaMostrada: true as const } : {}),
+...(false ? { saidaDaAbaMostrada: true as const } : {}),
```

<!-- aprovar.ts: a contagem sem campo é 0 -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/aprovar.ts
teste: apps/web/src/areas/professor/atividades/aprovar.test.ts › a contagem sai como número
-return String(aluno.saidasDaAba ?? 0)
+return String(aluno.saidasDaAba ?? 1)
```

<!-- aprovar.ts: o lote tem a coluna só quando a API mandou a contagem -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/aprovar.ts
teste: apps/web/src/areas/professor/atividades/aprovar.test.ts › só o lote em que a API devolveu
-return [...correcao.destaques, ...correcao.outras].some((aluno) => aluno.saidasDaAba !== undefined)
+return [...correcao.destaques, ...correcao.outras].some((aluno) => aluno.saidasDaAba === undefined)
```

<!-- Aprovar.tsx: o aviso nos destaques, só na avaliativa -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › a atividade sem prova não tem a coluna nem o aviso
-{comSaidas && destaques.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
+{destaques.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
```

<!-- Aprovar.tsx: o aviso nos destaques, só com lista -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › o aviso só vem com lista abaixo dele
-{comSaidas && destaques.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
+{comSaidas && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
```

<!-- Aprovar.tsx: o aviso nos destaques existe -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › na aba Destaques, a contagem vem na linha
-{comSaidas && destaques.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
+{comSaidas && destaques.length > 0 && null}
```

<!-- Aprovar.tsx: o aviso nas outras, só na avaliativa -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › a atividade sem prova não tem a coluna nem o aviso
-{comSaidas && outras.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
+{outras.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
```

<!-- Aprovar.tsx: o aviso nas outras, só com lista -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › só com destaques, a aba Outras, vazia, não mostra o aviso
-{comSaidas && outras.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
+{comSaidas && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
```

<!-- Aprovar.tsx: o aviso nas outras existe -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › na avaliativa, a tabela das outras ganha a coluna
-{comSaidas && outras.length > 0 && <Alert tom="info">{AVISO_DA_SAIDA_DA_ABA}</Alert>}
+{comSaidas && outras.length > 0 && null}
```

<!-- Aprovar.tsx: a coluna só na avaliativa (sempre) -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › a atividade sem prova não tem a coluna nem o aviso
-...(comSaidas ? [{ chave: 'saidas', titulo: ROTULO_DA_SAIDA_DA_ABA, celula: (aluno: CorrecaoDeAluno) => textoDasSaidas(aluno), alinhamento: 'fim' as const }] : []),
+...(true ? [{ chave: 'saidas', titulo: ROTULO_DA_SAIDA_DA_ABA, celula: (aluno: CorrecaoDeAluno) => textoDasSaidas(aluno), alinhamento: 'fim' as const }] : []),
```

<!-- Aprovar.tsx: a coluna só na avaliativa (nunca) -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › na avaliativa, a tabela das outras ganha a coluna
-...(comSaidas ? [{ chave: 'saidas', titulo: ROTULO_DA_SAIDA_DA_ABA, celula: (aluno: CorrecaoDeAluno) => textoDasSaidas(aluno), alinhamento: 'fim' as const }] : []),
+...(false ? [{ chave: 'saidas', titulo: ROTULO_DA_SAIDA_DA_ABA, celula: (aluno: CorrecaoDeAluno) => textoDasSaidas(aluno), alinhamento: 'fim' as const }] : []),
```

<!-- Aprovar.tsx: a saída na linha do destaque, só na avaliativa (sempre) -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › a atividade sem prova não tem a coluna nem o aviso
-abaixo={`${motivosDoDestaque(destaque)} · ${acertosDoAluno(destaque)}${comSaidas ? ` · ${ROTULO_DA_SAIDA_DA_ABA}: ${textoDasSaidas(destaque)}` : ''}`}
+abaixo={`${motivosDoDestaque(destaque)} · ${acertosDoAluno(destaque)}${true ? ` · ${ROTULO_DA_SAIDA_DA_ABA}: ${textoDasSaidas(destaque)}` : ''}`}
```

<!-- Aprovar.tsx: a saída na linha do destaque, só na avaliativa (nunca) -->
```mutacao
arquivo: apps/web/src/areas/professor/atividades/Aprovar.tsx
teste: apps/web/src/areas/professor/atividades/Aprovar.test.tsx › na aba Destaques, a contagem vem na linha
-abaixo={`${motivosDoDestaque(destaque)} · ${acertosDoAluno(destaque)}${comSaidas ? ` · ${ROTULO_DA_SAIDA_DA_ABA}: ${textoDasSaidas(destaque)}` : ''}`}
+abaixo={`${motivosDoDestaque(destaque)} · ${acertosDoAluno(destaque)}${false ? ` · ${ROTULO_DA_SAIDA_DA_ABA}: ${textoDasSaidas(destaque)}` : ''}`}
```

<!-- repository: a escola da tentativa -->
```mutacao
arquivo: apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
teste: apps/api/src/atividade/saida-da-aba.int.test.ts › só grava para a tentativa do aluno da sessão
-eq(tentativaAtividade.escolaId, escolaId),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian 1ª | Rodar `saida-da-aba.int.test.ts` com a infra de pé antes do pouso | É o portão da tarefa (`node tools/processo/portao-local.ts --tarefa`), que o Implementador já roda; nada a aplicar |
| privacy-guardian 1ª (3) | Confirmar a 360 px que o cartão com a contagem nunca aparece sem o aviso | Já garantido por `comSaidas && destaques.length > 0` e testado; a foto fica para a validação |
| privacy-guardian 1ª (2), revisor-geral 1ª (2), infra-guardian 1ª (3) | A marca `saidaDaAbaMostrada` faz o lote de avaliativa lido antes do deploy pedir nova leitura (`CONFLITO` uma vez) | `TODO.md`: uma linha nas notas de deploy da F6; passageiro, e hoje não há lote de avaliativa em produção |
| frontend-reviewer 1ª (1) | Spec e2e só no `celular` para o lote avaliativo com saídas (rolagem horizontal, alvo de 44 px) | Validação, ou a tarefa 12.0, que traz o e2e da prova; a 8.0 não alterou nenhum spec |
| frontend-reviewer 1ª (2) | Foto do lote avaliativo, escola cheia e vazia | Validação (o Validador fotografa cada requisito com tela); a vitrine ainda não monta esse lote |
| conformidade-reviewer 1ª (4) | Separar "Saiu da aba: N" dos motivos na linha do destaque | Validação, com a foto: o `frontend-reviewer` viu a linha e não a apontou; o `cenarios.md` §4 não define o separador |
| revisor-geral 1ª (4) | Campo explícito no contrato do lote em vez de `hasSaidaDaAba` pela presença | A tarefa futura que precisar saber se a prova é avaliativa em outra tela; muda contrato |
| infra-guardian 1ª (1) | `prova-online.js` (6.5) ainda não inclui a saída da aba (10% dos alunos saindo de 1 a 3 vezes) | Tarefa 6.5, que é a medida da prova online; o item 9 da autoconferência já remete a ela |
| conformidade-reviewer 1ª (1) | A AIA de correção de objetiva ficou desatualizada em três pontos (§1.4 item 9, linha 338, N11) | Subtarefa 6.4, que já tem a §1.4/9 como destino e deve levar também a linha 338 e o N11 |
| conformidade-reviewer 1ª (3) | O e2e da 12.0 precisa provar que o aviso ao aluno aparece antes da primeira questão | Tarefa 12.0 (subtarefas 12.1 e 12.4) |
| test-engineer 1ª | O caso do aluno não convocado (RF10) na rota de saídas | A tarefa que trouxer a convocação na `minha-atividade` |
| infra-guardian 1ª (2), test-engineer 1ª | A janela entre a saída e o envio: a saída lida antes do envio pode somar 1 depois que o `enviar` grava (a Mesa aplicou só o ajuste do docblock; `isNull(enviadaEm)` no `where` mudaria comportamento) | Validação (`registrarSaida` documenta a janela) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-26 17:36:36 | 2026-11-26 17:37:32 | `tenancy-guardian` | 1 | APROVADO | ab12e96e3d28d0d92 |
| 2026-11-26 17:36:49 | 2026-11-26 17:37:32 | `frontend-reviewer` | 1 | APROVADO | a2eb00c1597e0a364 |
| 2026-11-26 17:36:40 | 2026-11-26 17:37:55 | `privacy-guardian` | 1 | APROVADO | a6bfab988d6662cdc |
| 2026-11-26 17:36:57 | 2026-11-26 17:38:40 | `revisor-geral` | 1 | APROVADO | a785cdbdcc2e2b727 |
| 2026-11-26 17:37:01 | 2026-11-26 17:38:42 | `infra-guardian` | 1 | APROVADO | a62ec2f2e1f732048 |
| 2026-11-26 17:36:44 | 2026-11-26 17:38:47 | `conformidade-reviewer` | 1 | APROVADO | a73a65f9165d053a8 |
| 2026-11-26 17:36:53 | 2026-11-26 17:39:28 | `test-engineer` | 1 | REPROVADO | a25ef6f732bdbbb8a |
| 2026-11-26 17:57:29 | 2026-11-26 17:57:54 | `tenancy-guardian` | 2 | APROVADO | a4ecc63482863126b |
| 2026-11-26 17:57:38 | 2026-11-26 17:58:00 | `privacy-guardian` | 2 | APROVADO | abb0ad2bbbd0497ae |
| 2026-11-26 17:57:56 | 2026-11-26 17:58:03 | `frontend-reviewer` | 2 | APROVADO | aeca7d8e9c7b17e54 |
| 2026-11-26 17:57:47 | 2026-11-26 17:58:12 | `conformidade-reviewer` | 2 | APROVADO | afc2f41cf8b88b48d |
| 2026-11-26 17:58:16 | 2026-11-26 17:58:42 | `revisor-geral` | 2 | APROVADO | a1dcfc50fe7e65762 |
| 2026-11-26 17:58:23 | 2026-11-26 17:58:45 | `infra-guardian` | 2 | APROVADO | a56716fd4b0bf59b2 |
| 2026-11-26 17:58:06 | 2026-11-26 17:59:11 | `test-engineer` | 2 | APROVADO | acd61ef3a3796913d |
