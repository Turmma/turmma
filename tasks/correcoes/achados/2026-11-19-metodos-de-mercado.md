# Achados das revisões — `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-19 15:58:52 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

Escopo: respeitado. O documento pede o rename do verbo técnico, a guarda `guardas/verbo-de-mercado`, as listas que nomeiam método e a documentação, e foi isso que veio. Verifiquei que os dados não mudaram. Os literais de produção que mudaram são todos chave de `Pick<…>`. Código de permissão, evento de log (`senha_provisoria.gerada`), tipo de job e rota continuam iguais. Nenhuma chave de schema Zod em `packages/shared` foi trocada, e não há migration. Os `delete` de disciplina e de turma são exclusão física de verdade, e a exclusão lógica do material virou `softDelete`.

Aderência à Tech Spec: ok. Esta correção não tem spec. A revisão da D81 está em `docs/decisoes.md` (no topo e na D81), e o guia, a skill `receitas-de-codigo` e a regra 30 acompanharam.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **Comentário que ficou com o nome antigo.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/test/architecture.test.ts:900` o texto diz "o `criar` e o `createConvite`". Deve dizer `create`; a expressão logo abaixo já procura `.create(`.
2. **`readBytes` contradiz a convenção que a própria correção documenta.** O guia (§9) diz que leitura que pode não achar é `find`. Mas `readBytes` devolve `Promise<Uint8Array | undefined>`, e o próprio teste diz que "do objeto que não existe devolve `undefined`". O nome aparece em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/titular/file-storage.ts:48`, na linha 102 do mesmo arquivo e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/titular/s3-file-storage.ts:89`. Ou o nome passa a `findBytes`, ou o guia registra a exceção. O mesmo vale para os parsers `readData`, `readDia` e `readHorario`, que devolvem `null`.
3. **Furos pequenos na guarda.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/regras-metodo.mjs`, a regra não lê propriedade abstrata com tipo de função (`abstract lerX: () => void`, nó `TSAbstractPropertyDefinition`) nem `declare function lerX()` (`TSDeclareFunction`). Basta incluir os dois nós e marcá-los em `verbo-recusado.ts`.
4. **O arquivo novo da guarda usa o verbo que ela recusa.** `regras-metodo.mjs:33-34` declara `ehFuncao` e `ehTipoDeFuncao`. `tools/` fica fora do escopo da regra, mas um arquivo novo que contradiz a convenção que ele mesmo impõe não ajuda. Sugiro `isFuncao` e `isTipoDeFuncao`.
5. **Texto do documento sobre `tools/` e `infra/scripts/`.** A linha 31 do documento diz que o nome "muda" nessas pastas, mas lá só os chamadores das APIs renomeadas foram trocados; restam cerca de 240 declarações com verbo em português. Vale deixar explícito que, em `tools/` e `infra/scripts/`, só os chamadores mudaram.
6. **O exemplo do guia cita um método que não existe.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/docs/guia-do-desenvolvedor.md:208` mostra `findById`, que o `DisciplinaController` real não tem (ele tem `create`, `renomear`, `delete` e `list`). É ilustrativo, mas a esteira confere esse exemplo contra a linha `Exemplo:` da seção, então convém usar um método que exista.
7. **Pendência do Grafana ainda fora do `TODO.md`.** O documento diz "Fica para o `TODO.md` do andar" sobre a leitura de `alerta-de-classificacao-atrasada.int.test.ts`, que cai com um pico do Grafana local. A linha ainda não foi registrada; deve entrar antes do commit.
8. **Nome que pode ser verbo de domínio.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/web/src/api/estrutura.ts:113`, `openAnoLetivo` saiu de `abrirAnoLetivo`, e abrir o ano letivo é ato da escola. O glossário não registra a expressão, então não bloqueia. Se o ato for de domínio, o nome volta a `abrirAnoLetivo`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-19 15:59:01 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

A correção só troca nomes de método e função. Não mexe em coleta, exposição, log, auditoria nem envio externo, e nenhum dado gravado ou mostrado mudou.

Campos pessoais tocados: nenhum. Não há migration nem coluna nova. Em `packages/core/src/db/schema/convite.ts` mudou só um comentário (`criarConvite` → `createConvite`). O `docs/modelo-de-dados.md` trocou só nome de método, e `docs/lgpd.md` não mudou.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhum texto de rota, código de permissão ou guard de objeto mudou; nos docs, `time.ler` continua igual. O `permissao-boot-check.ts` acha a rota pelo metadado do decorator, não pelo nome do método, então trocar o nome não deixa rota sem declaração de acesso. O 404 e o 403 seguem como estavam.

Logs: limpos. Nas chamadas de log alteradas só mudou o método ao redor (`apagar` → `delete`, em `material`). O evento (`material.objeto_nao_apagado`) e os campos, ids e `summarizeError`, são os mesmos. A guarda `regras-log.mjs` não depende de nome de método do `src`.

Auditoria: presente. Os códigos de ação (`escola.criada`, `pedido.concluido`, `suboperador.*`) não mudaram. A porta só passou de `AuditoriaRecorder.gravar` para `save`, e de `listarDaEscola`/`contarDaEscolaEDaPessoaDesde` para `listDaEscola`/`countDaEscolaEDaPessoaDesde`. O `porta-unica.test.ts` acompanhou. Nenhum código guarda ação de auditoria, evento ou métrica tirados do nome do método: procurei uso de `propertyKey`, `Function.name` e `constructor.name` em `src` e não achei.

Envio externo: inalterado. No `openai-compat-adapter.ts` e no `soberania.ts` mudou só nome (`montarMensagens` → `buildMensagens`, `iniciar` → `start`). O que vai ao modelo, o registro em `ExecucaoAgente` (`iniciarExecucao` → `startExecucao`, acompanhado em `REPOSITORIES_SEM_ESCOPO`) e a escolha de provedor são os mesmos.

Seed/fixture: sintético. As duas fixtures novas, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-recusado.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-que-passa.ts`, só têm identificadores, sem dado de pessoa. Os testes alterados usam nome sintético (`'Rede sintética do login'`).

Bloqueantes: nenhum.

Como conferi:
- Comparei, trecho a trecho do diff, as strings antes e depois em 216 trechos. Toda mudança é chave de `Pick<T, '…'>`, `vi.spyOn`, título de teste ou lista de métodos de guarda (`escopo-dos-repositories.ts`, `unscoped.decorator.test.ts`, `architecture.test.ts`). Nenhum evento de log, ação de auditoria, tipo de job, rota, permissão, texto de tela ou valor de banco mudou.
- O apagamento real seguiu apagamento real (`apagarDaListaDeNomes` → `deleteDaListaDeNomes`, `apagarLoteVencido` → `deleteLoteVencido`). A exclusão lógica ganhou nome que diz o que é (`MaterialRepository.excluir` → `softDelete`). O verbo de domínio `eliminar` ficou.
- Storage: `FileStorage.lerBytes`/`apagar` viraram `readBytes`/`delete`. Bucket privado e URL assinada não mudaram.
- Rodei `tools/guardas/guardas.test.ts -t "verbo de mercado"`: 14 de 14 passaram. As suítes de integração não rodei; os números verdes delas são o que o documento da tarefa relata.

Pergunta de fechamento: o código continua respondendo. `leitura-do-titular.ts` (`montar` → `build`) e `eliminacao-do-titular.ts` (`gravarCompartilhamento` → `saveCompartilhamento`) mudaram só de nome, e o arquivo do titular e a lista de compartilhamento saem como antes.

Recomendações:
- `limparSaidaDoModelo` → `clearSaidaDoModelo` (`packages/core/src/ia/openai-compat-adapter.ts`, `clean-output.js`): aqui o verbo quer dizer sanear a saída do modelo, e `clear` dá a ideia de esvaziar. Ficaria mais claro como `sanitizeSaidaDoModelo` ou `cleanSaidaDoModelo`. Não muda comportamento, é só leitura.
- O documento diz que o rename vale também em `tools/`, mas lá ainda há funções com verbo em português (`verificarRepositories`, `lerFontesDeProducao`, `criarRegra`). A guarda não cobre `tools/` de propósito, então o texto da correção fica mais exato dizendo que `tools/` ficou parcial.
- Três títulos de teste trocaram o nome só em parte. Em `apps/worker/test/varrer-envios.int.test.ts` o título ainda cita `` `apagar` ``, que hoje é `delete`. Em `packages/core/src/titular/s3-file-storage*.test.ts` o `guardarBytes` continua, o que é coerente porque `guardar` não está na lista de verbos, mas deixa o par `guardarBytes`/`readBytes` misturado.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-19 15:59:09 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova e nenhuma alterada. O diff não traz migration nem mudança de schema. `packages/core/src/db/schema/convite.ts` só tem um comentário alterado.

Queries verificadas:
- **Os métodos com `@Unscoped`** estão iguais. Nenhum foi acrescentado ou retirado no diff, e todos mantêm a justificativa. Em `TenantResolutionRepository` são `createContas`, `saveFalhaDeLoginPorEmail`, `saveSegredoDeMfa`, `lockContaParaRedefinir`, `clearMfa`, `hasAcessoSuspenso` e `createLinkDaConta`. Em `ExpurgoDeAcessoRepository` são `deleteLoteVencido`, `closeEnviosDeLinkParados` e `clearLoteDeContasSemUso`. Também `CronEscolasRepository.listIds`, `UsageMeter.readDiasFechados` e `ExpurgoDeJobsRepository.deleteLoteVencido`.
- **`REPOSITORIES_SEM_ESCOPO`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/escopo-dos-repositories.ts:63-97`) teve só os nomes trocados. Nenhum método entrou na lista, nenhum saiu, e os motivos são os mesmos. A lista exata em `repositories-com-escopo.test.ts` acompanhou a troca.
- **`PROVAS_DE_ESCOPO`** (`requireEscolaId`, `requestIdentity`, `jobScopeInContext`) não mudou. O analisador não depende de nome de método para reconhecer o escopo.
- **Os controllers** mudaram só o nome do handler. Nenhum `@Body`, `@Query` ou `@Param` foi alterado, e nenhum endpoint passou a receber `escolaId` do cliente.
- **Conferi palavra a palavra o diff de `apps/`, `packages/`, `tools/`, `infra/` e `e2e/`.** Ele só troca identificadores; o que sobra é reordenação de listas ordenadas e o código novo da guarda.
- **Busquei os lugares onde a troca de nome poderia passar sem o verificador de tipos notar.** Procurei expressão regular que ainda caçasse o verbo antigo, chamada por nome em texto (`Proxy`, `startsWith`, registro de rota por nome do handler) e dublê de teste com o nome antigo que deixasse um teste de isolamento passando sem testar nada. Não achei nenhum caso. As duas ocorrências de `Controller.obter` são de controllers que só existem dentro dos testes.
- **Herança:** nenhum método renomeado passou a sobrescrever um da classe base (`ConviteRepository` sobre `ConviteDaEscolaRepository`, os `*Gauge` sobre `EscolaGauge`).

Rodei `architecture.test.ts`, `repositories-com-escopo.test.ts`, `unscoped.decorator.test.ts`, `tenant-resolution.repository.test.ts` e `matriz.test.ts`: 152 de 152 passaram.

Teste de isolamento: presente e efetivo. Não há módulo, tabela nem query nova. Os testes de isolamento que já existiam (`atividade-isolamento.int.test.ts`, `material-isolamento.int.test.ts`, `operacao-isolamento.int.test.ts`) só tiveram a chamada renomeada, com as mesmas asserções. Tirando a cláusula de escopo, eles continuam quebrando como antes.

Bloqueantes: nenhum.

Recomendações:
- O exemplo do §9 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/docs/guia-do-desenvolvedor.md` trocou `abrir(@Param('id'))` por `findById`. Isso muda o sentido do exemplo: antes era uma ação, agora é uma leitura. Vale manter a ação com o nome novo, `open`, ou deixar claro no texto que o exemplo agora é de leitura.
- No `AnoLetivoController`, `abrir` (abrir o ano letivo, que é ação de domínio) virou `open`. Não afeta o isolamento, mas a tabela da correção diz que verbo de domínio fica em português. Fica para a validação decidir se `abrir` de ano letivo é verbo técnico ou de domínio.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-19 15:59:31 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: **APROVADO**

Esta é a rodada 1. A correção só renomeia métodos e funções e cria a guarda `guardas/verbo-de-mercado`. Não encontrei nenhuma mudança de comportamento que toque a regra 70. Para confirmar isso, extraí `git diff -U0` de `apps/` e `packages/` e comparei, trecho a trecho, todos os textos entre aspas que mudaram (288 trechos). Todos são nome de método dentro de `vi.spyOn`, `Pick`, título de teste ou comentário.

O que continua igual:
- **Auditoria:** os nomes das ações (`'lote.aprovado'`, `'entrega.decidida'`, `'correcao.destaque_aberto'`, `'analista.nominal_lido'`, `'funcao.suspensa'`, `'turma.desempenho_lido'`).
- **Contratos e banco:** códigos de permissão (`@RequirePermissao`), rotas e chaves dos esquemas zod. Nenhuma migration, `.sql` ou esquema do Drizzle mudou.
- **Prompts:** nenhum texto de prompt mudou. Fora do nome do método, `buildPedido` ficou igual em `adaptar-atividade.ts`, `relatorio-da-correcao.ts`, `resumo-do-analista.ts` e `gerar-atividade-objetiva.ts`.
- **Gatilhos do tutor:** os gatilhos do assunto delicado e do risco à vida (`turno-do-tutor.ts`) só trocaram de nome (`normalizar` virou `normalize`, `ehAssuntoDelicado` virou `isAssuntoDelicado`).
- **Nome do método fora do código:** nada depende dele. Procurei `getHandler().name` e `propertyKey` em `apps/api/src` e `packages/core/src` e não achei nada.
- **Testes da regra:** todos os arquivos que a regra 70 cita em "Checagem" existem. `mvp-tables.int.test.ts`, `entrega.int.test.ts`, `governanca.int.test.ts` e `e2e/aluno-tutor.spec.ts` não foram tocados.
- **`porta-unica.test.ts`:** a expressão regular que garante uma porta só de escrita na auditoria procura `insert`/`update`/`delete` aplicados à tabela, e não o nome do método. Por isso o rename não a enfraquece.
- **A guarda nova:** não inclui verbo de domínio (`aprovar`, `lancar`, `corrigir`). Ela só lê o que é função, então o campo de dado `podeAprovar` continua intacto (`apps/web/src/areas/professor/atividades/Aprovar.tsx`).

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: não existe tabela `nota`; o resultado oficial é o lote aprovado (`entrega` + `validacao_do_lote`), gravado por `CorrecaoRepository.saveValidacao` (antes `gravarValidacao`) e pela decisão da entrega em `EntregaService`; o mock do e2e grava com `decididaPor: QUEM_DECIDE`. As travas do banco (`entrega_decisao_registrada`, `entrega_decidida_por_da_equipe`, `exigir_validacao_do_lote_aprovado`) não mudaram — todos com autor humano? sim
Decisão autônoma sobre aluno: ausente (`decisao.service.ts` só trocou o nome de `travarPendente`, `criarUsuarios` e `fechar`; a reivindicação continua decidida por pessoa)
Aprovação registrada: ok (entrega, lote e versão adaptada sem mudança de lógica; a exceção do tutor continua só no tutor)
Supervisão do tutor: ok (`tutor.service.ts`, `turno.command.ts` e `tutor.repository.ts` só trocaram nomes; `saveSinal` com `atencao_humana` e `resposta_pronta` continua nos mesmos pontos)
Autonomia declarada e visível: sim (`buildTime`, antes `montarTime`, em `@educa/shared`, `governanca.service.ts` e `textos-da-governanca.test.ts`; os textos da tela não mudaram)
Bloqueantes: nenhum
Recomendações:
- packages/core/src/auditoria/auditoria.int.test.ts:52 e :66 — os títulos ainda dizem `listarDaEscola`, mas o corpo chama `listDaEscola`. Trocar o título.
- packages/core/src/auditoria/porta-unica.test.ts:99 — o exemplo negativo usa `listarDaEscola()`, um nome que não existe mais. Não muda o que o teste prova; vale atualizar para `listDaEscola()`.
- tools/ci (`ehCodigoParaAEsteira` em `caminhos-da-esteira.ts`, `lerAmbienteDeTeste` e `gravarAmbienteDerivado` em `compose.ts`) — o documento diz que a troca vale também em `tools/`, mas a guarda não cobre `tools/` e esses nomes ficaram. Não é da regra 70; fica para o `revisor-geral` decidir se a lacuna é aceita ou se o texto do documento deve dizer "tools/ parcial".
```

Sem fotos da tela nesta tarefa. O diff do `apps/web` que olhei (governança, Aprovar, Tutor do aluno, painel do professor) só troca nomes e não muda nenhum texto da tela.

Arquivos principais que conferi:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tasks/correcoes/2026-11-19-metodos-de-mercado.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/regras-metodo.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/src/atividade/correcao/correcao.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/ia/tasks/turno-do-tutor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/auditoria/porta-unica.test.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-19 16:00:40 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: REPROVADO

**Cenários exigidos** (é uma guarda de lint mais um rename sem mudança de comportamento; ninguém reivindica nada, então concorrência e isolamento entre escolas não se aplicam à guarda):
- Caminho feliz: o verbo técnico em português é recusado em cada tipo de declaração (função, `const` com função, método de classe, estático, abstrato, privado, de interface e de objeto, propriedade de função), no `src` de cada app e pacote.
- Bordas:
  - a palavra que só começa igual (`listagem`, `temporada`, `eholder`);
  - o verbo de domínio (`aprovar`, `lancar`);
  - o nome que não é função;
  - a chave computada e a chave entre aspas;
  - o atalho de objeto;
  - a função anônima;
  - o verbo seguido de número.
- Permissão: o `eslint-disable` não desliga a regra.
- Escopo: a regra vale no `src` e não vale no teste, no `__fixtures__`, no e2e, em `infra/` e em `tools/`.
- O repositório de hoje tem zero violações.
- As listas que nomeiam método acompanham o rename: `REPOSITORIES_SEM_ESCOPO` e as expressões do `architecture.test.ts`.
- O rename não muda dado: permissão, evento, tipo de job, rótulo de rota e valor gravado.

**Cobertos:**
- Os 7 casos do bloco `guarda de verbo de mercado` em `tools/guardas/guardas.test.ts:479-542` existem e passam. Rodei: 14 de 14, contando o das exceções na linha 1067.
- `verbo-recusado.ts` tem 14 marcas, uma por linha, comparadas com `toEqual(marcasDeViolacao(...))`. Isso é asserção de resultado, não de execução.
- `verbo-que-passa.ts` cobre as bordas acima.
- O escopo é provado por `calculateConfigForFile` em 5 caminhos que reprovam e 8 que passam.
- O `eslint-disable` é provado na passada sem comentários.
- A sugestão da mensagem é provada por `it.each`.
- Os 17 blocos de mutação batem uma a uma com as cláusulas de `regras-metodo.mjs` e com a exceção em `index.mjs`. O bloco sem `falha:` (o `TypeError` dentro da regra) é um vermelho legítimo: um caso que rodou e falhou.
- As listas acompanharam: `escopo-dos-repositories.ts` com o teste da lista exata, o `architecture.test.ts` com `createOperador`, `generateConviteDeOperador` e `runOpsOperador`, e conferi que esses três existem em `apps/api/src/ops/operador.ts`.
- Comparei os textos entre aspas do diff de produção: só mudaram chaves de `Pick`/`Omit` e comentários. Nenhum dado gravado, evento ou permissão mudou.
- Não há `.skip`. Nenhum mock esconde a regra. Nada chama IA.

**Bloqueantes:**
1. **A guarda não lê método privado `#`, e o teste diz que lê.**
   - `tools/guardas/regras-metodo.mjs:51`: o `if (no?.type !== 'Identifier') return` descarta o `PrivateIdentifier`. Com isso `#lerX()`, `#gravarPedido()` e `#esperar = ...` passam calados.
   - Hoje há 30 declarações assim no `src` de produção, sem renomear. Exemplos: `apps/api/src/privacidade/privacidade.service.ts:415`, `:466` e `:481` (`#gravarPedido`, `#ehDeQuemPediu`, `#montarPedido`); `apps/api/src/sessao/senha/senha.service.ts:124` e `:141` (`#contar`, `#abrirLink`); `apps/api/src/sessao/completion/login-completion.ts:139` (`#criarSessao`); `apps/api/src/worker.module.ts:72` (`#consumir`).
   - O teste `o repositório de hoje não tem violação: nenhum método nem função de produção começa por verbo técnico em português` (`tools/guardas/guardas.test.ts:537`) afirma algo falso.
   - A exclusão não está declarada em nenhum lugar: nem no documento ("Muda o nome do método…"), nem no cabeçalho da regra, nem no §9 do guia, nem nas fixtures.
   - Correção exigida, uma de duas:
     - (a) aceitar `PrivateIdentifier` em `conferir`, pôr `#lerTurma()` e `#gravar = () => {}` com marca em `verbo-recusado.ts`, renomear os 30 e acrescentar o bloco de mutação da nova cláusula;
     - (b) declarar a exclusão de propósito, com o motivo, no documento, no comentário da regra e no guia, pôr `#lerTurma()` em `verbo-que-passa.ts` e ajustar o nome do teste da linha 537.

**Recomendações:**
- O `const x = useCallback(...)`, `useMutation(...)` ou `useRef(...)` escapa (`ehFuncao` só lê arrow e `function`), enquanto o `const ler = () => {}` local é recusado. Exemplos: `apps/web/src/api/execucoes.ts:95` e `:97`, `apps/web/src/components/ui/overlays/dialog-state.ts:54` e `:59`, `apps/web/src/areas/coordenacao/privacidade/DetalheDoPedido.tsx:82`. Vale declarar isso ou cobrir.
- Outras formas não cobertas: `TSDeclareFunction` (`declare function` e assinatura de sobrecarga) e propriedade cujo tipo é união com função (`lerX?: (() => void) | undefined`).
- Títulos de teste e comentários com o nome antigo:
  - `apps/api/src/config.test.ts:86` e `apps/despachante/src/config.test.ts:36` (`lerConfiguracao`, hoje `loadConfig`);
  - `apps/api/src/ops/operador.test.ts:76`, `redefinir-mfa.test.ts:30`, `uso.test.ts:64` e `revogar-acessos-sala.test.ts:46` (`executarOps…`);
  - `apps/api/src/operacao/operador/operador.repository.test.ts:29` (`criarConvite`);
  - `tools/guardas/repositories-com-escopo.test.ts:80` (`AlunosAtivosRepository.contar`);
  - o comentário de `apps/api/test/architecture.test.ts:900`, que ainda diz "o `criar`".
- O documento diz que muda o nome "em `tools/` e `infra/scripts/`", mas ali só mudaram os chamadores: restam cerca de 200 funções com verbo em português em `tools/` e `infra/scripts/`. Vale ajustar o texto.
- O documento diz que o pico do Grafana em `alerta-de-classificacao-atrasada.int.test.ts` "fica para o `TODO.md` do andar", mas o `TODO.md` não está no diff. O defeito é anterior à correção e foi reproduzido na base. É um teste que só passa com o Grafana folgado e precisa do item registrado.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/regras-metodo.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/guardas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-recusado.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-que-passa.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tasks/correcoes/2026-11-19-metodos-de-mercado.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-19 16:01:43 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

```
VEREDITO: APROVADO
Caminho quente tocado: login | tutor | sala | prova | fila | IA (só renomeação, o comportamento é o mesmo)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- infra/test/alerta-de-classificacao-atrasada.int.test.ts: a leitura das regras do Grafana tem 5 s e não aguenta um pico do Grafana local. O documento já manda isso para o TODO.md. Confiram se o item entrou, para não virar mais um vermelho intermitente na esteira.
- infra/k6/importacao-7h30.js: a função de cenário `gerarAcesso` segue com o verbo em português. É consistente, porque o `exec` aponta para o mesmo nome, e o arquivo está fora do typecheck e da guarda. Fica como pendência de nome para uma próxima passada, se quiserem o k6 no mesmo padrão.
- tools/guardas/index.mjs: a guarda não cobre `infra/scripts/`, embora o rename tenha passado por lá. Vale registrar no guia que a trava vale só no `src` dos apps e pacotes, para ninguém achar que cobre os scripts de carga.
```

O que conferi, sob a pergunta das 10h:

- **Nenhum dado de execução mudou.** No `src` de produção, nenhum texto de nome de fila, tipo de job, prefixo de chave Redis, nome de métrica, evento de log, rota ou chave do `sessionStorage` foi alterado. Todas as diferenças de texto são chaves de `Pick<>` (o typecheck cobre) ou comentários.
- **Scripts Lua:** a operação mandada ao `concurrency-slot.lua` continua `'liberar'`, que é o nome que o script espera. Só o método TS virou `release` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/queue/escola-concurrency-limiter.ts:91`).
- **Sem chamada por nome em tempo de execução:** não há `defineCommand`, nome de função usado em métrica ou span, nem instrumentação automática do Nest que mude o nome de span ou de painel.
- **Colisão com método de classe base:** o `noImplicitOverride` está ligado no `tsconfig.base.json`, então um `run`, `stop` ou `close` que sobrescrevesse método herdado sem querer quebraria o typecheck.
- **Prova online:** `fila-de-respostas.ts` e `espelho-da-fila.ts` mudaram só de nome. A chave do espelho, o envio por item e a retomada continuam iguais.
- **Fora do TypeScript:** procurei os nomes antigos em .mjs, .js, .sh, JSON, YAML, compose, runbook e `docs/infra.md`. Sobram só o k6 (coerente) e os mapas históricos de `tools/renomear/`. Os scripts de carga em `infra/scripts/` foram atualizados junto com o `dist` que eles importam.
- **Testes que procuram texto no código:** os que exigem que um nome não apareça foram atualizados com o nome novo (`lockContasDoProfessor`, `deleteLoteVencido`…), então não passam por ausência.
- **Rodado aqui:** `npm run typecheck` verde. O bloco da guarda nova em `tools/guardas/guardas.test.ts` passou (14 de 14). Os testes do caminho quente também passaram: gateway de IA, rate limit, área do aluno, limites da sala e do assistente, cenários de carga da sala e da importação (26 arquivos, 492 testes).

Não há operação concorrente nova, query nova nem código novo no caminho quente. Por isso não se exige teste de concorrência novo nem atualização do cenário de carga.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-19 17:56:38 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: não existe tabela `nota`. O resultado oficial é o lote aprovado (`entrega` + `validacao_do_lote`). Ele é gravado por `CorrecaoRepository.saveValidacao` e pela decisão da entrega em `EntregaService`. As travas do banco (`entrega_decisao_registrada`, `entrega_decidida_por_da_equipe`, `exigir_validacao_do_lote_aprovado`) não mudaram desde a rodada 1. Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/src/atividade/correcao/correcao.service.ts` só mudou o nome do método privado, de `#montar` para `#build`. A conferência da D56 (`marcaLida !== marcaDoApresentado(montado.apresentado)` → `CONFLITO`) e o `ENTREGA_JA_DECIDIDA` continuam como estavam.

Supervisão do tutor: ok. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/src/tutor/turno.command.ts` só mudou o nome, de `#gravarTurno` para `#saveTurno`. O tutor continua pausado em avaliação aberta (`TUTOR_PAUSADO_EM_AVALIACAO`), as citações continuam exigidas, a resposta continua gravada por `saveResposta` e os sinais continuam respeitando a suspensão da função.

Autonomia declarada e visível: sim. Nada em governança, em agentes ou no `docs/regulacao.md` entrou no diff de r1 para r2.

Bloqueantes: nenhum.

O que auditei na rodada 2: o diff r1→r2, com 44 arquivos e 1580 linhas. Todas as mudanças em `apps/`, `packages/` e `tools/` são de nome:
- Métodos privados `#` passaram a ter verbo em inglês: `#build`, `#run`, `#canComecar`, `#savePedido`, `#buildPedido`, `#isDeQuemPediu`, `#consume`, `#createThread` e os de rate-limit, token-limiter, vínculo e s3.
- Títulos de `describe` e `it` acompanharam as APIs já renomeadas na rodada 1.
- A guarda `tools/guardas/regras-metodo.mjs` passou a ler também o `PrivateIdentifier`. A mudança tem fixture nova e dois blocos de mutação novos (17 → 19).

Procurei no patch por `lancadaPor`, nota, autonomia, aprovação, sugestão, ranking e emoção. Nenhuma linha de produção com esses termos foi tocada. Os nomes das ações de auditoria (`'lote.aprovado'`, `'entrega.decidida'`, `'analista.nominal_lido'`, `'turma.desempenho_lido'`) são dado e não mudaram. A expressão de `porta-unica.test.ts` e o teste de isolamento de `auditoria.int.test.ts` mudaram só no texto do caso.

Recomendações:
- `#canComecar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/src/ia/execucao.processor.ts:115` mistura `can` com `Comecar`, verbo técnico em português que pela tabela da correção viraria `start`. `#canStart` seria mais coerente com a própria convenção. É só nome e não bloqueia.
- Continua valendo a da rodada 1, que já está no `TODO.md`: a guarda não lê `TSAbstractPropertyDefinition`, `TSDeclareFunction`, tipo união com função nem ganchos do React.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-19 17:56:41 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Não há Tech Spec, porque é uma correção pedida sem spec. O documento agora diz o que o diff faz: o `#` privado entra no escopo, e em `tools/`, `infra/scripts/` e `infra/k6/` só os chamadores mudaram.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As sete correções exigidas na rodada 1 foram feitas:
1. **Método privado `#`.** Foi escolhida a opção (a). A regra em `tools/guardas/regras-metodo.mjs` aceita `PrivateIdentifier`, e o cabeçalho dela foi atualizado. O `verbo-recusado.ts` ganhou `#lerTurma()` e `readonly #gravar = () => {}`, com 16 marcas, que batem com o documento. O `verbo-que-passa.ts` ganhou `#readTurma()` e `#lerLimite = 3`. As declarações privadas foram renomeadas (`#savePedido`, `#buildPedido`, `#isDeQuemPediu`, `#count`, `#openLink`, `#createSessao`, `#consume`, `#wait`, `#send` e as demais). A cláusula nova tem dois blocos de mutação, um que tira cada metade da condição.
2. O comentário do C44 em `apps/api/test/architecture.test.ts:899` diz `create`.
3. As funções da regra viraram `isFuncao` e `isTipoDeFuncao`, e os blocos de mutação acompanharam.
4. Os títulos de teste foram trocados, inclusive alguns que a ordem não listava (`llm-config.test.ts`, `validate-config.test.ts`, `graceful-shutdown.test.ts` e os `config.test.ts` do realtime e do worker). Em `varrer-envios.int.test.ts`, cada `` `apagar` `` virou `` `delete` ``.
5. O exemplo do §9 do guia usa agora `@Delete(':id')`, `'disciplina', 'excluir'` e `delete(@Param('id', IdPipe) …)`. É o que existe em `apps/api/src/estrutura/disciplina/disciplina.controller.ts:35-38`.
6. O documento e o §9 do guia dizem que a trava vale só no `src` de `apps/*` e `packages/*`, e que em `tools/`, `infra/scripts/` e `infra/k6/` só o chamador mudou.
7. A pendência do Grafana e as recomendações sem aplicar estão no `TODO.md`, numa seção própria da correção.

Recomendações:
- `packages/core/src/estrutura/turma.repository.ts:202`: o comentário do `createNoAno` ainda diz "(como o `criar`…", e o método irmão hoje se chama `create` (linha 128). É o mesmo tipo de sobra do item 4.
- `apps/api/src/ia/execucao.processor.ts:113`: `#canComecar` segue a tabela (`pode` → `can`), mas fica estranho de ler. `#canStart` ou `#shouldStart` diria mais. A troca não é obrigatória.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-19 17:56:43 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

Esta rodada cobre só o diff r1 para r2 (`036b3df9` para `5db88389`, 44 arquivos). Nada nele muda o que é coletado, mostrado, gravado em log, auditado ou enviado para fora. São trocas de nome de método privado `#` e o ajuste da guarda para lê-los. O resto são títulos de teste, comentários, o guia, o `TODO.md` e o documento da correção. Os arquivos versionados da árvore de trabalho batem com `5db88389`. A diferença que o `git diff` mostra em `tools/guardas/` vem só dos três arquivos ainda não versionados (`regras-metodo.mjs` e as duas fixtures), que o próprio diff r1 para r2 já traz.

**Campos pessoais tocados:** nenhum. Não há migration nem coluna nova, e nenhuma chave de schema Zod mudou.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. Nenhuma rota, controller, código de permissão ou guarda de objeto entrou no diff. O 404 continua igual para "não encontrado" e "sem permissão":
- `#titularAlvo` passou a chamar `#isDeQuemPediu` (antes `#ehDeQuemPediu`), em `apps/api/src/privacidade/privacidade.service.ts:277`, e segue lançando `NAO_ENCONTRADO`.
- `#readGravada` (antes `#lerGravada`), em `apps/api/src/material/licenca.service.ts:93`, faz o mesmo.

**Logs:** limpos. O diff não acrescenta nem altera nenhuma chamada de log. O `material.envio_nao_apagado` em `material.service.ts:468` ficou igual.

**Auditoria:** presente. Os `registro.save(...)` de `pedido.lido`, `pedidos.listados`, `licenca.registrada` e `licenca.alterada` não mudaram. Mudou só o nome do método montador (`#montarPedido` passou a `#buildPedido`), e ele continua montando pelo `pedidoDoTitularSchema.parse`, sem nome de quem registrou e sem matrícula. Nos dois testes de auditoria (`auditoria.int.test.ts` e `porta-unica.test.ts`) mudaram só os títulos, e as asserções são as mesmas.

**Envio externo:** inalterado.
- `ExecucaoProcessor` (`apps/api/src/ia/execucao.processor.ts:53-68`) mudou só nomes: `#podeComecar` passou a `#canComecar` e `#executar` passou a `#run`. A passagem `pendente → rodando` e o registro em `ExecucaoAgente` continuam iguais.
- `#saveTurno` do Tutor (`apps/api/src/tutor/turno.command.ts:278`) grava a mesma coisa.
- `#createExecucao` (`packages/core/src/material/agendamento-da-classificacao.repository.ts:256`) mantém `requireEscolaId()`.

**Arquivo e storage:** `S3FileStorage.#send` (antes `#enviar`, `packages/core/src/titular/s3-file-storage.ts:131`) mantém `CacheControl: 'no-store'` e `ContentDisposition: 'attachment'`. A URL assinada não foi tocada.

**Seed/fixture:** sintético. As fixtures novas da guarda (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-recusado.ts` e `verbo-que-passa.ts`, na mesma pasta) têm só identificadores, sem dado de pessoa.

**Pergunta de fechamento:** o código continua respondendo. O arquivo do titular e a lista de compartilhamento não foram tocados nesta rodada, e o atendimento do pedido do titular mudou só nomes privados.

**Recomendações que ficaram da minha 1ª rodada:**
- `limparSaidaDoModelo` virou `clearSaidaDoModelo`: recusada com motivo (é a tabela da correção que manda trocar `limpar` por `clear`). Aceito o motivo.
- Par `guardarBytes`/`readBytes`: recusada com motivo (`guardar` não está na lista de verbos). Aceito.
- O título de `varrer-envios.int.test.ts` que ainda citava `apagar` foi corrigido nesta rodada.

**Bloqueantes:** nenhum.

**Recomendações:**
- `packages/core/src/identidade/sessao.guard.ts:42`: `readonly #liberarAviso = throttledWarn(...)` passa pela guarda porque o valor é o resultado de uma chamada, não uma função escrita ali. É o mesmo ponto cego de `useCallback`/`useRef` que já está no `TODO.md`, na linha "Alargar a guarda". Vale citar esse caso lá. Não é questão de privacidade.

## test-engineer · 2ª rodada · APROVADO · 2026-11-19 17:56:52 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: o verbo técnico em português é recusado em cada forma que a regra lê. Isso inclui o método privado `#` e a propriedade privada com arrow, que eram o assunto desta rodada.
- Bordas: a palavra que só começa igual, o verbo de domínio, o nome que não é função, a chave computada, a chave entre aspas, o atalho, a função anônima, o verbo seguido de número. Nesta rodada entram também o privado `#` com verbo de mercado e a propriedade privada que não é função.
- Permissão: o `eslint-disable` não desliga a regra.
- Escopo: a regra vale no `src` de apps e pacotes, e não vale no teste, no `__fixtures__`, no e2e, em `infra/` nem em `tools/`.
- O repositório de hoje tem zero violações, agora contando o `#`.
- O rename dos 30 privados não muda comportamento.

Cobertos:
- **A correção exigida foi feita pela opção (a).**
  - A guarda agora aceita o `#`: `tools/guardas/regras-metodo.mjs:51` passou a aceitar `PrivateIdentifier`.
  - `verbo-recusado.ts` ganhou `#lerTurma()` e `readonly #gravar = () => {}`, cada um com a sua marca. São 16 marcas no total, como o documento diz.
  - `verbo-que-passa.ts` ganhou `#readTurma()` e `readonly #lerLimite = 3`, que não é função.
  - O cabeçalho da regra, o §9 do guia e a seção "O que muda" do documento dizem que o `#` é lido. O guia e o documento também dizem agora que a trava só vale no `src`.
- **Dois blocos de mutação novos, um para cada lado da condição:**
  - um tira o `PrivateIdentifier`, e as duas marcas privadas da fixture deixam de ser vistas;
  - o outro deixa só o `PrivateIdentifier`, e todas as marcas comuns deixam de ser vistas.
  - Os dois apontam para `recusa função, const com função, …`, que compara a lista exata de marcas (`toEqual(marcasDeViolacao(RECUSADO))`). Os dois chegam à cláusula pelo motivo certo.
  - Os blocos antigos acompanharam a troca de `ehFuncao`/`ehTipoDeFuncao` para `isFuncao`/`isTipoDeFuncao`.
- **Testes rodados:** `npx vitest run tools/guardas/guardas.test.ts -t "verbo de mercado"` deu 14 de 14 verdes. Entre eles está o teste `o repositório de hoje não tem violação…` (linha 537), que faz o lint de todo o escopo. Com o `#` lido, esse teste agora diz a verdade.
- **Os 30 privados renomeados:** li o diff linha a linha (`privacidade.service.ts`, `senha.service.ts`, `login-completion.ts`, `worker.module.ts`, `rate-limiter.ts`, `s3-file-storage.ts`, `vinculo.repository.ts` e os demais). Só o identificador mudou: nenhum texto, nenhuma condição, nenhum argumento.
- **O `#` que ainda sobra no `src` não é violação:**
  - `#parar = new AbortController()` não é função;
  - `#liberarAviso = throttledWarn(...)` é uma chamada que devolve função, a mesma família do `useCallback`, que já está no `TODO.md`.
- **As recomendações da 1ª rodada foram tratadas:**
  - os títulos de teste e comentários com nome antigo foram trocados;
  - o comentário do `architecture.test.ts:900` foi corrigido;
  - o `TODO.md` ganhou os itens do Grafana, do alargamento da guarda e de `tools/`/`infra/`;
  - o exemplo do guia passou a usar `delete`, método que o `DisciplinaController` tem.
- Não há `.skip`, mock que esconda a regra nem chamada a provedor de IA.

Bloqueantes: nenhum.

Recomendações:
- Os títulos dos dois testes da fixture não citam o caso novo:
  - `recusa função, const com função, método de classe, abstrato, de interface e de objeto, e propriedade de função…` não diz "privado `#`";
  - `deixa passar o verbo de mercado, …` não cita o privado com verbo de mercado nem a propriedade privada que não é função.
- Tanto a lista do documento quanto o nome do teste melhorariam se citassem esses casos.
- `packages/core/src/identidade/sessao.guard.ts:42` (`#liberarAviso = throttledWarn(...)`) escapa da guarda pelo mesmo buraco do `useCallback`. Vale citar esse arquivo como exemplo no item do `TODO.md` sobre alargar a guarda.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/regras-metodo.mjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/guardas.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-recusado.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tools/guardas/__fixtures__/verbo-que-passa.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/tasks/correcoes/2026-11-19-metodos-de-mercado.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-19 17:57:47 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration entre a árvore da rodada 1 (`036b3df9`) e a da rodada 2 (`5db88389`). Nenhum `escolaId` ou `anoLetivoId` mudou. Depois de `5db88389`, a árvore de trabalho só tem diferenças em documentos de `tasks/correcoes/`.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/estrutura/vinculo.repository.ts`: o método privado `#lerComReferencias` passou a se chamar `#readComReferencias`. Ele continua aplicando `#escopo()`, que lê `requireEscolaId()` e `requireAnoEmCurso()` do contexto, e os joins de `turma` e `disciplina` continuam presos a `escolaId`. Isso vale para `list`, `listDoUsuario`, `porId` e `porIdDoUsuario`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/material/agendamento-da-classificacao.repository.ts`: `#criarExecucao` passou a `#createExecucao`. A escola continua vindo de `requireEscolaId()`, e o comentário que protege o termo de escola no `update` e no `delete` acompanhou o nome novo.
- `rate-limit.guard.ts`, `rate-limiter.ts` e `school-semaphore.ts`: só mudou o nome de métodos privados. A chave por escola continua vindo da identidade do token (`identidade.escolaId`).
- `privacidade.service.ts`: `#titularAlvo` e `#isDeQuemPediu` (antes `#ehDeQuemPediu`) seguem respondendo `NAO_ENCONTRADO`, igual ao id inexistente.
- Os outros arquivos de `apps/`, `packages/` e `tools/` no diff são troca de nome de método privado, de `describe` ou `it`, ou de comentário, sem efeito em escopo. A guarda passou a ler também `PrivateIdentifier`. Nenhum endpoint passou a aceitar `escolaId` do cliente, e nada mudou em `@Unscoped()`, em `REPOSITORIES_SEM_ESCOPO` ou na camada de rede.
- Rodei `tools/guardas/repositories-com-escopo.test.ts` e `tools/guardas/guardas.test.ts`: 386 testes, todos passaram.

Teste de isolamento: presente e efetivo. Os testes que já existiam continuam iguais, só com nome novo:
- `auditoria.int.test.ts`: "listDaEscola no contexto de A não traz linha de B" e "sem escola no contexto falha fechado".
- `varrer-envios.int.test.ts`: os dois casos de "duas escolas".

A correção não cria regra de escopo nova que precise de teste novo.

Bloqueantes: nenhum. A rodada 1 não exigiu correção.

Recomendações:
- Fica a da rodada 1, já registrada no documento da tarefa: decidir se `openAnoLetivo` (antes `abrirAnoLetivo`) é ato de domínio. É decisão do Validador.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-19 18:00:10 · `tasks/correcoes/2026-11-19-metodos-de-mercado.md`

VEREDITO: APROVADO
Caminho quente tocado: login | tutor | sala | fila | IA. Só mudaram nomes de métodos privados `#`, sem mudança de comportamento.
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/packages/core/src/identidade/sessao.guard.ts:42`: `#liberarAviso = throttledWarn(...)` ficou com o verbo em português. A guarda não o pega porque o valor é uma chamada que devolve função, e não arrow nem `function`. É o mesmo furo do `useCallback`/`useRef` que já está no `TODO.md`. Ao alargar a guarda, incluir este caso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-19-metodos-de-mercado/apps/api/src/ia/execucao.processor.ts:75`: o nome `#canComecar` ficou estranho. `#start` diria mais, ou então manter `#podeComecar` se "poder" for considerado verbo de domínio. Não afeta carga.

Para esta rodada, conferi o seguinte:
- A árvore de trabalho atual tem hash `5db88389…`, igual ao declarado.
- As renomeações no rate limit (`rate-limiter.ts`, `rate-limit.guard.ts`, `school-semaphore.ts`), no `token-limiter.ts`, em `sala-rate-limits.ts`, em `senha.service.ts`, em `login-completion.ts`, em `execucao.processor.ts`, em `worker.module.ts` e em `s3-file-storage.ts` são só de identificador privado. Nenhuma chave Redis, nome de métrica, evento, fila ou prazo mudou.
- O `typecheck` passou (exit 0).
- O bloco da guarda nova passou com 14 de 14.
- Os testes unitários desses caminhos quentes passaram: sala, token-limiter, semáforo da escola, S3 e sessão, com 130 de 130.
- O bloqueante que o test-engineer deu na 1ª rodada foi corrigido: a guarda agora confere o `#` privado, que tem fixture e bloco de mutação, e os 30 nomes foram trocados.
- As recomendações de infra da 1ª rodada foram atendidas. O Grafana e o `gerarAcesso` do k6 entraram no `TODO.md`. O guia agora diz que a trava vale só no `src` de apps e pacotes.
