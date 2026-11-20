# Achados das revisões — `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 16:54:27 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só mexe na leitura da tabela pública `habilidade_bncc` e não grava em `Nota`, `Correcao` nem no estado de entrega. Todos com autor humano? Não se aplica, porque não há escrita.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A troca de habilidade da questão continua sendo um pedido do professor, e o texto continua vindo da tabela oficial, nunca do cliente nem do modelo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.service.ts:111-116`). A barreira de conflito (`origemId`, aplicação ou versão) segue igual na linha 208. Nenhum agente ganha a exceção da D47.
Supervisão do tutor: ok. O Tutor não é tocado.
Autonomia declarada e visível: sim. O diff não muda declaração de autonomia nem a tela de governança.
Bloqueantes: nenhum

O que conferi pela regra 70:
- **`BnccRepository.habilidades`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.ts:38-50`) devolve só código, texto oficial e grupo. Não tem campo de pessoa, de aluno nem de nota.
- **`habilidades-do-recorte.ts`** não toca o banco e não produz saída de IA. O `descricaoParaOModelo` só corta o texto oficial no tamanho do contrato.
- **Discursiva e redação (D55):** nada no diff chega a elas. Não aparece campo, prompt nem tela que sugira nota.
- **Vigilância e medição do professor (itens 7 a 9):** o diff não toca nenhuma das duas.
- **Auditoria da troca de habilidade:** sem mudança.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts:46`: o comentário ainda diz que `habilidadesDaSerie` é "a única leitura sem escola", mas esse método foi removido. O certo é apontar para `BnccRepository.habilidades`, no núcleo, ou retirar a frase.
- Esta correção não fecha a ressalva maior 2 da validação: a descrição gravada na questão gerada vem do modelo. Pela regra 70 ela é a mais relevante das duas, e precisa ser feita na correção própria.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 16:54:47 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

A correção junta numa só as três leituras da tabela pública `habilidade_bncc`. Nenhum dado de pessoa entra, sai ou muda de lugar. O que chega à tela e ao modelo continua igual.

**Campos pessoais tocados:** nenhum. A única tabela lida é `habilidade_bncc`, que é pública e não tem `escola_id` (regra 10, item 1). `BnccRepository.habilidades` devolve só `codigo`, `descricao` e `grupo`, e o teste `só devolve código, texto e grupo` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.int.test.ts` prova isso.

**Fora da tabela de dados do docs/lgpd.md:** nada. Não há campo, migration nem auditoria nova.

**Autorização por objeto:** ok. A conferência do objeto continua antes de qualquer leitura da BNCC, nos três caminhos:
- `listHabilidades` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.service.ts:644-656`) confere o material com `alcanceDoMaterial('ler')` ou passa por `recorteDoArtefato`. Nos dois casos o objeto que não existe e o que não é de quem pede respondem `NAO_ENCONTRADO`.
- `cobertura` (`material.service.ts:741-742`) confere `serieDaEscola` primeiro.
- `trocarHabilidade` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.service.ts:205-207`) chama `lockArtefatoParaTrocar` antes de ler o texto oficial. Esse texto continua vindo da tabela, nunca do cliente.

Trocar o id na URL não abre nada novo, porque a leitura que perdeu o escopo só alcança dado público.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** presente e sem mudança. `artefato.habilidade_trocada` continua guardando só códigos. A correção não cria nem altera ação auditável.

**Envio externo:** o que vai ao modelo continua o mesmo. Na classificação (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts:101`), cada candidata segue só com código e texto da BNCC. `candidatasDoRecorte` tira o `grupo` antes de entregar, e o teste unitário `o grupo da leitura não chega a quem consome a candidata` prova isso. O registro em `ExecucaoAgente` e o provedor seguem sem alteração.

**Seed/fixture:** sintético. Os testes usam a carga oficial da BNCC da migration `0059` e habilidades montadas à mão no teste unitário. Não há dado de pessoa. Rodei `habilidades-do-recorte.test.ts`: 6 de 6 passam.

**Pergunta de fechamento:** não muda. A tabela da BNCC não guarda nada sobre aluno, e a resposta do arquivo do titular continua a mesma.

**Bloqueantes:** nenhum.

**Recomendações:**
- Antes, `candidatas` voltava `[]` sem consultar o banco quando não havia série. Agora `inArray(etapa, [])` vai ao banco, e o drizzle 0.45.2 transforma isso em `false`. Funciona, e `bncc.repository.int.test.ts` cobre o caso. Mesmo assim, um retorno antecipado em `candidatasDoRecorte` para lista vazia de etapas pouparia a consulta e deixaria de depender de como o drizzle trata lista vazia. Isso é desempenho, não privacidade; fica com o `test-engineer` ou o `revisor-geral`.
- No `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/architecture.test.ts`, a trava `nenhum arquivo do módulo material usa @Unscoped` só lê o primeiro nível de `apps/api/src/material`. Se um dia aparecer uma subpasta ali, a trava não a vê. Vale considerar a leitura recursiva.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 16:54:48 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. `habilidade_bncc` continua tabela pública sem dono (regra 10, item 1, registrada na Tech Spec §11). O que esta correção alcança em `habilidade_da_secao`, `secao_do_material`, `material` e `serie` não mudou.

Queries verificadas:
- `BnccRepository.habilidades` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.ts:38-50`): é o único `@Unscoped`, e a justificativa está escrita. Devolve só código, descrição e grupo, sem `escolaId` nem dado de pessoa. O filtro vem de valores que o servidor já conferiu (o recorte do contexto e um código validado por `habilidadeEhCandidata`).
- As duas junções que continuam em `secoes.repository.ts`:
  - `secoes.repository.ts:152` é limitada por `secao_do_material.escola_id` e por `habilidade_da_secao.escola_id`.
  - `secoes.repository.ts:353` é limitada por `habilidade_da_secao.escola_id`.

  Nas duas, a escola vem do token por `requireEscolaId()`.
- `trocarHabilidade` em `artefato.service.ts`: o recorte é lido com escopo e o código é validado antes da leitura da BNCC. Os erros continuam `ENTRADA_INVALIDA` e `NAO_ENCONTRADO`, como antes.
- `material.service.ts:656` e `:750`: nenhum `escolaId` vem do corpo ou da query.
- `@Unscoped` nos arquivos de `apps/api/src/material`: não sobrou nenhum, conferido com grep.
- Testes que rodei e passaram: o teste de unidade novo (`habilidades-do-recorte.test.ts`), a guarda `repositories-com-escopo` e os casos de `architecture.test.ts` filtrados pelo nome (15 casos). Não rodei o teste de integração do núcleo (`bncc.repository.int.test.ts`) nem o portão.

Teste de isolamento: presente e efetivo. Nenhum escopo de escola foi tirado ou alterado, e os testes de isolamento do módulo `material` seguem como estavam. O teste novo de arquitetura quebra se voltar `@Unscoped` a qualquer arquivo de `material` ou se o `BnccRepository` ganhar um segundo método.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts:46`: o JSDoc da classe ainda diz que a leitura sem escola é "a única leitura sem escola (`habilidadesDaSerie`)", mas esse método saiu. Trocar a frase por uma que aponte para o `BnccRepository`.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/architecture.test.ts:1612-1618`: a guarda só olha a pasta `material`. Uma leitura nova de `habilidade_bncc` em outro módulo, com `@Unscoped` próprio, passaria sem ser vista. Vale trocar a checagem de pasta por uma que proíba `.from(habilidadeBncc)` fora de `packages/core/src/bncc/`, já que as junções com escopo usam `innerJoin` e não seriam afetadas.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-20 16:55:01 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção junta as três leituras de `habilidade_bncc` em um repository só (`BnccRepository`), com um único método `@Unscoped`. As três chamadas passaram a usá-lo: as candidatas da classificação, o texto oficial na troca da habilidade da questão e as habilidades da série na cobertura. Não mexe na ressalva maior 2 da validação, que o documento deixa de fora.

Aderência à Tech Spec: ok. O desvio da regra 10, item 9, está registrado na §6 e na §11 da `techspec.md`. O `cenarios.md` não precisou mudar, porque o comportamento é o mesmo e só a estrutura mudou.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e testes da árvore alterada).

Bloqueantes: nenhum.

Recomendações:
1. **O texto diz que o grupo saiu do banco, mas ele continua no banco.** A §6 da Tech Spec e a seção "Correção" do documento da tarefa dizem que o grupo da cobertura fica em `habilidades-do-recorte.ts`. No código, ele é calculado no SQL do próprio repository, pelo `coalesce(area, componente)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.ts:45`, e a cobertura o lê direto em `material.service.ts:750`. O código está certo; é o texto que precisa ser ajustado, para a validação não procurar o grupo onde ele não está:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md`, §6
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-20-bncc-repository-unico.md`, linha 36
2. **A lista sem série agora vai ao banco.** Antes, `candidatasDoRecorte` voltava vazia direto quando não havia série. Agora consulta o banco com uma lista de etapas vazia, e o resultado continua vazio. O custo é pequeno; se quiser, devolva vazio antes da consulta em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.ts:15`.
3. **O repository passou a depender do arquivo de regras.** O tipo `HabilidadeCandidata` mudou para `habilidades-do-recorte.ts`, e `secoes.repository.ts:25` agora o importa de lá. Funciona, mas o repository fica dependendo do módulo de regras quando deveria ser o contrário. Vale mover o tipo para um lugar neutro, ou para o `@educa/shared`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 16:56:04 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

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

Os pontos que importam para a manhã de segunda:
- **Rate limit e fila:** a correção não muda nada. A classificação continua em job, com o mesmo lote e o mesmo comando. A cobertura e a lista de habilidades fazem as mesmas leituras de antes, agora pelo `BnccRepository`.
- **Concorrência:** a troca de habilidade continua dentro da transação com a trava do artefato. O `BnccRepository` é criado com o `tx` da transação (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.service.ts:207`). O padrão "busca, verifica, grava" não ganhou caso novo.
- **Índice:** `habilidade_bncc` é pública, pequena e não cresce com aluno. As leituras são as de antes (por etapa, por etapa e ano, por código) e o resultado é limitado à série ou à etapa. O caso "sem série" não lê a tabela inteira: no drizzle-orm 0.45.2, `inArray` com lista vazia vira `false`.
- **Testes que rodei:** o typecheck da API e do core passa. Também passam o teste de arquitetura com o caso novo, `habilidades-do-recorte.test.ts`, `bncc.repository.int.test.ts` (5 de 5, com o banco de teste) e `tools/guardas/repositories-com-escopo.test.ts`. Nenhum teste chama provedor pago.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.ts:66-67`: quando não há série, a função vai ao banco com `where false`, e o código antigo voltava `[]` antes da consulta. Basta pôr `if (etapas.length === 0) return []` antes de chamar `bncc.habilidades`. O custo é desprezível; o ganho é não depender de como o drizzle trata lista vazia numa versão futura.

## test-engineer · 1ª rodada · APROVADO · 2026-11-20 16:56:49 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** os três usos (as candidatas da classificação, o texto oficial na troca da habilidade, as habilidades da série na cobertura) passam pelo único `BnccRepository.habilidades` e respondem igual a antes.
- **Bordas reais da BNCC:**
  - o Médio, que não é seriado: a série do Médio lê todas, sem olhar o ano;
  - a habilidade que vale para vários anos (`EF69LP01` aparece no 7º);
  - o código que a tabela não tem;
  - o texto acima do tamanho do contrato, que vai cortado com reticências;
  - recorte sem série;
  - etapas repetidas no recorte;
  - as `EM13LP`, que têm componente e área: a área vence.
- **Permissão:** a troca e a lista seguem fechadas para a coordenação e o aluno. A correção não tocou nisso, e os testes de antes seguem verdes.
- **Isolamento:** a tabela é pública. O que importa é que os repositories com escopo de escola do módulo `material` fiquem sem `@Unscoped`, e que a troca e a cobertura de outra escola continuem respondendo `NAO_ENCONTRADO`.
- **Concorrência:** não se aplica. É só leitura, sem estado novo, e a troca continua na mesma transação (`new BnccRepository(tx)`).

**Cobertos:**
- Os dois testes da seção "Teste que reproduz" existem:
  - `apps/api/test/architecture.test.ts`: dois casos, um para o `BnccRepository` ter só o método `habilidades`, com a justificativa, e outro para nenhum arquivo de `apps/api/src/material` usar `@Unscoped(`;
  - `packages/core/src/bncc/bncc.repository.int.test.ts`: cinco casos, contra a tabela carregada (por etapa, por série no Fundamental e no Médio, por código existente e inexistente, o grupo, e só as três colunas).
- `apps/api/src/material/habilidades-do-recorte.test.ts` prova o que é regra fora do banco: o filtro pelo componente e pelas séries, as etapas sem repetir, a saída só com código e texto, o recorte vazio, o corte em 300, o texto curto que vai como está e o código ausente.
- As oito mutações, conferidas no papel contra o diff, caem todas em asserção que as pega pelo motivo certo:
  - tirar o filtro de etapas ou o `.where`: aparecem códigos fora de `EM13`;
  - tirar o filtro de código: o primeiro da tabela não é o `EF07CI01`;
  - tirar o `eq` da etapa: a série do Médio lê a tabela toda e o total muda;
  - pôr o filtro de ano no Médio: a série do Médio lê zero;
  - tirar o corte: o texto passa de 300;
  - devolver texto para o código ausente: o teste espera `undefined`;
  - inverter a condição em `artefato.service.ts`: a troca para em `ENTRADA_INVALIDA`.
- `--faltando: 0`. Nenhuma cláusula nova está sem bloco.
- Rodei e passaram:
  - a unidade e a arquitetura: 75 testes;
  - `bncc.repository.int.test.ts`: 5 testes;
  - `cobertura.int.test.ts`, `troca-de-habilidade.int.test.ts`, `classificacao-da-coordenacao.int.test.ts` e `classificacao.int.test.ts`: 137 testes.
- Os três primeiros desse último grupo usam o código alterado mas não foram alterados, e por isso o portão da tarefa não os roda.
- Não há `.skip`, teste comentado nem chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O nome do `describe` em `apps/api/test/architecture.test.ts:1605` promete mais do que o teste prova. Ele diz "a tabela pública da BNCC é lida por um repository só", mas só confere a pasta `material` e os métodos do `BnccRepository`. Um `@Unscoped` novo lendo `habilidadeBncc` em outro módulo (por exemplo, `artefato` ou `assistente`) passaria. Duas saídas: um terceiro caso que procure `@Unscoped(` junto de `habilidadeBncc` em `apps/*/src`, ou um nome que diga só o que o teste prova. Não bloqueia, porque a Tech Spec §6 corrigida promete exatamente o que o teste prova.
2. Ficou um comentário velho em `apps/api/src/material/cobertura.repository.ts:46`: "A tabela da BNCC é pública e a única leitura sem escola (`habilidadesDaSerie`)". O método saiu, e o `CoberturaRepository` não tem mais leitura sem escola.
3. O caso em `apps/api/src/material/classificacao.int.test.ts:1032` ainda se chama "`candidatas`: …", nome do método que saiu. Vale renomear para `candidatasDoRecorte`.
4. A troca e a cobertura agora rodam com o `BnccRepository` de verdade, mas as mutações delas no `material.service.ts` não estão declaradas (o filtro `{ etapa, ano }` e o `candidatasDoRecorte` da lista). Hoje só a esteira, com `cobertura.int.test.ts` e `classificacao-da-coordenacao.int.test.ts`, pegaria uma troca de filtro ali. Não bloqueia: não há cláusula condicional nova, e o `--faltando` dá 0.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-20-bncc-repository-unico.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/architecture.test.ts

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-20 17:11:56 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. A `habilidade_bncc` é pública e sem dono (regra 10, item 1). O diff r1→r2 não traz migration.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.ts`: o retorno antecipado sem série deixa de consultar a BNCC. A função continua sem acesso a dado de escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:171-175`: só o tipo mudou. O escopo continua vindo de `requireEscolaId()` e as junções com `habilidadeBncc` (linhas 151 e 352) partem de `habilidadeDaSecao`, que tem escopo de escola. Nada mudou desde a 1ª rodada.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/classificar-secoes.command.ts`: só o tipo mudou. `HabilidadeCandidataBncc` tem só `codigo` e `descricao`, sem dado de escola nem de pessoa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/cobertura.repository.ts:53`: só o comentário mudou, e agora bate com o código.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/bncc/bncc.repository.ts:47`: é o único `.from(habilidadeBncc)` no código de produção. Conferi com grep no repositório.

Teste de isolamento: presente e efetivo. O teste de arquitetura agora percorre todas as subpastas de `apps/api/src/material/` em busca de `@Unscoped`. Um `.from(habilidadeBncc)` fora do `BnccRepository`, ou um `@Unscoped` novo no módulo `material`, faria o teste quebrar. A rodada não mexeu nos testes de isolamento por escola da 1ª rodada.

Correções exigidas da rodada anterior: nenhuma. As recomendações listadas na ordem `-r1` foram todas aplicadas, conforme o diff.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/architecture.test.ts:1620`: a guarda só pega `.from(habilidadeBncc)`. Uma leitura nova da BNCC que entre por `innerJoin`/`leftJoin` a partir de outra tabela pública passaria sem ser vista. Vale incluir as junções na guarda, liberando só as que partem de uma tabela com escopo de escola (`habilidadeDaSecao`), ou registrar essa limitação no comentário do bloco.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 17:12:25 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As seis recomendações da ordem da 1ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/2026-11-20-bncc-repository-unico-r1.md`) foram aplicadas, e nenhuma muda contrato:
1. **Comentário da cobertura:** o JSDoc de `CoberturaRepository` não cita mais `habilidadesDaSerie` e aponta para o `BnccRepository`.
2. **Guarda de arquitetura:** ela agora olha todas as subpastas de `apps/api/src/material/`. Ganhou um terceiro caso: em todo o repositório, só `packages/core/src/bncc/bncc.repository.ts` pode ter `.from(habilidadeBncc)`. Conferi que é o único arquivo que tem hoje, e as junções com escopo de escola continuam passando. O nome do `describe` agora diz só o que o teste prova.
3. **Série vazia:** `candidatasDoRecorte` devolve lista vazia antes de consultar a BNCC. A mutação está declarada no documento e o teste a pega, porque confere que a BNCC não recebeu nenhuma consulta (`filtros` vazio).
4. **Onde mora o grupo:** a §6 da Tech Spec e a seção "Correção" do documento dizem agora que o grupo é calculado no SQL do `BnccRepository`.
5. **Tipo da candidata:** o `HabilidadeCandidata` local saiu e entrou o `HabilidadeCandidataBncc` do `@educa/shared`, com a mesma forma (`codigo`, `descricao`). O `secoes.repository.ts` não importa mais o arquivo de regras, e não sobrou nenhuma referência ao tipo antigo.
6. **Nome do teste:** o caso de `classificacao.int.test.ts` foi renomeado para `candidatasDoRecorte`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-20-bncc-repository-unico.md:30`: a seção que lista os testes ainda usa o nome antigo do `describe` ("a tabela pública da BNCC é lida por um repository só, com um único método @Unscoped"). Ele foi renomeado nesta rodada. Vale alinhar o texto para que a validação ache o teste pelo nome.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-20 17:12:48 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

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
- Rodar `apps/api/test/architecture.test.ts` de dentro de `apps/api` ainda carrega o `dist` velho do `@educa/core`, de 18/11, onde o `BnccRepository` não existe. Por isso o caso do `BnccRepository` falha com `Cannot read properties of undefined (reading 'prototype')`. Pela raiz (`npx vitest run --project unidade`) os dois arquivos tocados passam, 76 de 76. Vale anotar no guia que esse teste se roda pela raiz, ou reconstruir o `@educa/core` antes.
- O teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/architecture.test.ts` só pega a leitura escrita como `.from(habilidadeBncc)`. Um apelido (`import { habilidadeBncc as h }`) ou `db.query.habilidadeBncc` passaria sem ser visto. Isso cabe na retro e não bloqueia, porque o `@Unscoped` do módulo `material` continua coberto pelo outro caso.

Nesta rodada conferi só o diff desde a rodada 1. Não havia correção exigida a conferir. As recomendações que a Mesa aplicou não mexem em fila, IA, migration, rate limit nem concorrência. O retorno antecipado sem série em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.ts` só tira uma leitura da BNCC. A troca para o `HabilidadeCandidataBncc` do `@educa/shared` mantém o mesmo formato, código e descrição.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 17:13:08 · `tasks/correcoes/2026-11-20-bncc-repository-unico.md`

VEREDITO: APROVADO

Cenários exigidos (para a 2ª rodada, sobre o diff entre r1 e r2):
- Sem série, a função não devolve candidata nenhuma e nem chega a consultar a BNCC. É a cláusula nova `if (etapas.length === 0) return []` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.ts:10`.
- Se alguém reintroduzir `@Unscoped` em qualquer subpasta de `apps/api/src/material/`, a guarda tem de falhar.
- Se outro arquivo de produção, em qualquer módulo ou app, ler `habilidade_bncc` por `.from(habilidadeBncc)`, a guarda tem de falhar.
- A troca de `HabilidadeCandidata` por `HabilidadeCandidataBncc` não pode mudar comportamento.

Cobertos:
- O caso `sem série não há candidata, e a BNCC nem é consultada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/habilidades-do-recorte.test.ts:36`) agora confere também que a BNCC não recebeu filtro nenhum (`filtros` igual a `[]`). Sem a cláusula, o falso recebe `{ etapas: [] }` e esse `expect` cai. O vermelho vem do motivo certo, a regra 80, e não de erro de carga. O bloco 9 declara essa mutação.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/architecture.test.ts:1611`, a guarda contra `@Unscoped` no módulo `material` agora olha também as subpastas, porque passou a usar `arquivosDoRepositorio()`.
- O caso novo em `architecture.test.ts:1619` exige que o único arquivo de produção com `.from(habilidadeBncc)` seja `packages/core/src/bncc/bncc.repository.ts`. A lista é exata, então qualquer leitor novo deixa o teste vermelho.
- A troca de tipo não muda comportamento: o `HabilidadeCandidataBncc` é o tipo do schema do contrato da rota. A tabela de testes do documento não ganhou linha nova sem teste.
- Rodei `npx vitest run` nos dois arquivos, `habilidades-do-recorte.test.ts` e `architecture.test.ts`: os dois passaram, com 76 testes verdes.
- Não há `.skip`, teste comentado nem chamada a provedor de IA. O `BnccRepository` falso do teste unitário é proposital: a leitura real está provada no `bncc.repository.int.test.ts`.
- Nenhuma correção era exigida na 1ª rodada. As recomendações aplicadas pela Mesa estão no diff.

Bloqueantes: nenhum.

Recomendações:
1. O bloco 9 está fora da seção "Mutações": ficou entre a tabela "Revisões" e "Recomendações sem aplicar", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-20-bncc-repository-unico.md:124-130`. Ele funciona assim mesmo, porque `lerMutacoes` lê os blocos do documento inteiro e a impressão do carimbo cobre todos. Mas a posição tem efeito colateral: o hook gravou a 2ª rodada do `tenancy-guardian` (linha 138) dentro da tabela de recomendações. O hook ainda lê essa linha, porque `lerRevisoes` vai do título "## Revisões" até o fim do arquivo, mas o documento fica confuso para a validação. Convém levar o bloco e o parágrafo dele para a seção "Mutações" e manter "Revisões" no fim do arquivo, como `linhasDaTabelaDeRevisoes` supõe.
2. O nome do caso novo da guarda diz que "a leitura nova, em outro módulo ou app, entra por ele", mas o teste só pega `.from(habilidadeBncc)`, não `innerJoin(habilidadeBncc, …)`. Os dois joins que existem hoje, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:151` e `:352`, partem de `habilidadeDaSecao`, que tem escopo de escola, então não são leitura da tabela pública sem escola. Ainda assim, convém deixar o nome ou o comentário dizendo que join a partir de tabela com escopo não conta.
