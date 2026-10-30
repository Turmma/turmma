# Achados das revisões — `tasks/prd-nomes-de-mercado/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-30 05:45:32 · `tasks/prd-nomes-de-mercado/2_task.md`

```
VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A tarefa não cria migration, schema nem coluna. O diff fica só em tools/renomear/ e tools/guardas/.
Queries verificadas: nenhuma. A tarefa não tem repository, query nem endpoint. As ferramentas novas (conferir.ts, foto.ts, casos.ts, restos.ts) leem só a árvore do git e os mapas de tools/renomear/mapas/. As três alterações em especificadores.ts, reaplicar.ts e texto.ts só passam a exportar funções que já existiam (literalDoNo, destinoDoCaminho, MAPA_DOS_DOCUMENTOS, lerTodosOsMapas, foraDoPasso5). tools/guardas/index.mjs, regras-tenant.mjs, escopo-dos-repositories.ts e repositories-com-escopo.test.ts não foram tocados, e nenhuma guarda de tenant ficou mais fraca. Nenhum @SemEscopo() novo.
Teste de isolamento: não se aplica. A tarefa não toca módulo de domínio nem dado de escola, e não há escopo para remover. Há um efeito indireto a favor: tools/guardas/filtros-casam.test.ts lê os `files` de configuracaoDasGuardas, entre eles o '**/*.repository.ts' de guardas/tabela-so-no-repository. Assim, um rename futuro que esvazie esse glob e desligue a guarda de tenant em silêncio fica vermelho.
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/filtros-casam.test.ts:47 — EXCECOES_NOMINAIS isenta '**/dist/**' e '**/node_modules/**' da trava contra filtro vazio. Hoje isso não afeta nenhuma guarda de tenant. Se um dia uma exceção nominal for parar no `files` de guardas/tabela-so-no-repository ou nas listas de repositories-com-escopo.test.ts, ela precisa passar por esta auditoria antes de entrar.
- Nas próximas ondas de rename (mapas/*.json), a tenancy-guardian precisa auditar qualquer mapa que renomeie escolaId, anoLetivoId, *.repository.ts, @SemEscopo ou REGRAS_DE_TENANT. O `conferir` prova "só nome", mas não prova que as guardas de escopo continuam alcançando os arquivos renomeados. Essa prova é o filtros-casam rodando na própria onda.
```

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 05:45:39 · `tasks/prd-nomes-de-mercado/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (a tarefa não toca o assunto)
Fila e prioridade: ok (a tarefa não toca o assunto)
Concorrência: protegida (não há banco, fila nem tela; o código só lê a árvore do git)
Índice e paginação: ok (não há query)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código em produção; é ferramenta de linha de comando e teste em `tools/`)
Bloqueantes: nenhum

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.test.ts:244`, o `timeout: 180_000` está muito acima do tempo real: os três arquivos de teste rodaram juntos em 3,2 s, com 111 testes passando. Um teto mais próximo do real, por exemplo 30 s, faria a esteira acusar logo uma varredura que ficou lenta, em vez de esperar três minutos.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts:45`, o `maxBuffer` de 1 GiB no `execFileSync('git', …)` é folgado demais para uma ferramenta local. Não bloqueia, mas um limite menor falha mais cedo se a foto sair do esperado.

O que conferi:
- Fora de `tasks/` e `tools/`, nada foi alterado, então nada chega a `apps/`, `packages/nucleo/`, `infra/`, `.github/` ou `compose.yaml`.
- Em `especificadores.ts`, `reaplicar.ts` e `texto.ts`, o diff só passa a exportar funções e constantes que já existiam.
- Não há chamada de rede nem de provedor de IA. Os únicos processos que o código abre são `git` e `node`, e só sobre o repositório local ou o de teste.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 05:45:49 · `tasks/prd-nomes-de-mercado/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só mexe em `tools/renomear/` e `tools/guardas/`. Não há migration, schema, DTO, endpoint, repository nem tela.

Fora da tabela de dados do docs/lgpd.md: nenhum. Não entra campo novo.

Autorização por objeto: ok, porque não se aplica. São ferramentas de linha de comando e testes que só leem a árvore do git (`git ls-tree`, `git cat-file --batch`, `git ls-files`) e não têm rota.

Logs: limpos. Nenhum `console` ou `logger` nos arquivos novos. A saída vai para o stdout do terminal e mostra:
- no `conferir`: o caminho, a categoria e o valor do literal que divergiu (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts:168`);
- no `restos`: `arquivo:linha` e um trecho da linha de até 100 caracteres (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts:556`).

Os dois imprimem só conteúdo que já está versionado num repositório público. Nenhum lê banco, dump ou dado de escola.

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum. Não há `fetch`, HTTP, S3 nem chamada a provedor de IA.

Seed/fixture: sintético. `tools/guardas/__fixtures__/filtros/knip.json` e `30-camada-ia.md` são cópias exatas do `knip.json` e de `.claude/rules/30-camada-ia.md`; conferi com `diff` e são idênticas. Nos testes, procurei e-mail, CPF, telefone, nascimento, diagnóstico, nome próprio e matrícula, e só achei `docs/aia/ouro/nota.txt`, que é nome de arquivo de brinquedo.

Bloqueantes: nenhum.

Recomendações:
- O `filtros-casam.test.ts` também protege a regra 20: se a onda de rename deixar vazio o filtro de `log-sem-dado-pessoal`, do `ESCOPO_DO_ERRO_TIPADO` ou o `paths:` de uma regra, a guarda parava de valer sem ninguém ver. Vale deixar isso dito na retro, porque a trava é o que impede o rename de desligar em silêncio uma checagem de privacidade.
- Se o `restos` ou o `conferir` um dia rodarem na esteira com saída arquivada, o trecho impresso pode trazer string de seed. Hoje o seed é sintético e o repositório é público, então não há exposição nova. Mesmo assim, convém manter a regra 17 (seed sintético) como premissa explícita no docblock de `restos.ts`.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta à secretaria continua a mesma de antes da tarefa.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 05:45:52 · `tasks/prd-nomes-de-mercado/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Ela não toca `apps/`, `packages/`, banco, job, seed, importação nem webhook. O diff fica só em `tools/renomear/`, em `tools/guardas/filtros-casam.test.ts` e na fixture. Todos com autor humano? sim, porque não há caminho novo.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum agente nem saída de IA foi criado ou alterado.
Supervisão do tutor: ok. Nada no tutor mudou. O único "tutor" que aparece é o glob `**/tutor/**` do `paths:` da regra 30, lido como fixture em `tools/guardas/filtros-casam.test.ts:324`.
Autonomia declarada e visível: sim. Governança, `docs/agentes.md` e a tela da coordenação não foram tocados.
Bloqueantes: nenhum

Não há fotos da tela nesta tarefa, e ela não tem tela.

Pela regra 70, conferi três pontos:
- **Os testes citados na regra 70 continuam presos.** Vários itens da regra 70 têm `Checagem:` apontando para o nome de um teste. O `conferir` fica vermelho quando um caso de teste entra ou some (RF7) e quando o texto de um `describe` muda (RF6), e a exceção não o livra disso. Assim, nenhuma onda de rename consegue apagar ou trocar de nome, sem ser acusada, um teste que prova a regra 70. É o oposto de enfraquecer a regra.
- **A fixture é cópia exata do original.** `tools/guardas/__fixtures__/filtros/30-camada-ia.md` é igual a `.claude/rules/30-camada-ia.md`, e `tools/guardas/__fixtures__/filtros/knip.json` é igual ao `knip.json`. Conferi com `diff`. A fixture fica fora de `.claude/rules/`, então não entra no contexto como regra.
- **Os testes passam.** `npx vitest run --project unidade tools/renomear/ tools/guardas/filtros-casam.test.ts`: 6 arquivos e 198 testes, todos verdes.

Os itens 1 a 9 não se aplicam a esta tarefa. Nada nela grava nota, propõe nota em discursiva ou redação, mede o professor ou deixa a coordenação ver a conversa dele com o chat.

Recomendações:
- O `restos` deixa de olhar `docs/decisoes.md`, `tasks/` e o ouro enquanto não existir `mapas/13.json` (`tools/renomear/texto.ts:19`). Quando uma onda renomear `Nota`, `lancadaPor`, `Correcao` ou um arquivo de teste citado em `Checagem:` da regra 70, a tarefa dessa onda precisa atualizar no mesmo commit as citações da regra 70 e de `docs/regulacao.md`. Senão, a `Checagem:` passa a apontar para um caminho que não existe. Vale deixar isso explícito no procedimento de onda do `tasks.md`.
- A pergunta 12 da autoconferência diz que o `conformidade-reviewer` "não toca agente, nota". Para a retro: nas ondas que renomearem a entidade `Nota`, o campo `lancadaPor` ou o construtor `Nota.aprovar`, chamem este revisor de forma explícita, porque a regra 70 item 1 cita esses nomes.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/texto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/filtros-casam.test.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-10-30 05:47:16 · `tasks/prd-nomes-de-mercado/2_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As subtarefas 2.1 a 2.6 foram feitas. Nenhum mapa de onda foi criado e nada foi renomeado. Nos três arquivos alterados, `especificadores.ts`, `reaplicar.ts` e `texto.ts`, a única mudança é passar a exportar o que o `conferir` e o `restos` reusam.

Aderência à Tech Spec: ok. Conferi contra o §5 e o `casos.md`:
- **`conferir`:** fotografa as pastas pedidas, deixa `tools/renomear/` de fora e aplica o mapa à foto de antes (caminho, especificador e nome exportado).
- **`restos`:** tem todas as liberações do §5. O mapa de linha não olha documento enquanto não existir o `13.json`, e com ele o ouro deixa de ser isento.
- **Trava contra filtro vazio:** lê todas as fontes do §5. A base é dividida, e as exceções nominais têm motivo.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **Texto da 2.5 desatualizado.** `tasks/prd-nomes-de-mercado/2_task.md:29` diz que o `eslint.config.mjs` foi copiado para a fixture. Ele não foi: `tools/guardas/filtros-casam.test.ts:212` lê a configuração real, o que é mais forte e é o que o §5 pede ("lido da configuração exportada"). Só o `knip.json` e a regra 30 foram copiados, e conferem byte a byte com os originais. Ajustar o texto da subtarefa.
2. **Duas fontes a mais que a lista do §5.** A trava também lê `ARQUIVOS_DE_TESTE` e os `workspaces` do `package.json` (`filtros-casam.test.ts:221` e `:226`). Não é divergência, mas convém pôr as duas no `casos.md`, para a lista de fontes não ficar só no teste.
3. **Prefixos que a trava não alcança.** Em `tools/processo/guardioes-por-caminho.ts:37`, o `PADRAO` (`apps/`, `packages/`, `e2e/`, `tools/guardas/`, `tools/testes/`) não é exportado, e a trava não o confere. Fica para quando alguém mexer nesse arquivo.
4. **Segunda forma de listar os arquivos.** `filtros-casam.test.ts:62` reimplementa o `arquivosDoRepositorio()` de `guardas.test.ts`, que o "Como testar" manda reusar. É um segundo jeito de fazer o que o projeto já faz. Mover a função para um módulo comum e importar dos dois lados.
5. **Comentário que diz o contrário do teste.** `tools/renomear/restos.ts:97` diz que "a declaração local de outra coisa" não conta. O caso em `restos.test.ts:142-148` mostra que o uso dessa variável local conta, sim, como resto. O erro só deixa o `restos` vermelho a mais, nunca verde a mais. Corrigir o comentário e tirar o caso do `describe('restos: verde')`, já que ele espera um resto.
6. **Mensagem errada no `restos`.** Sem mapa na pasta, o `restos` mostra "o reaplicar não tem o que aplicar" (vem de `lerTodosOsMapas`, em `reaplicar.ts:43`). Trocar por uma mensagem neutra, ou deixar quem chama dar o nome do comando.
7. **Símbolo trocado em todos os pacotes.** O `conferir` (`conferir.ts:112-116`) troca o nome exportado só pelo `de` e ignora o `arquivo` da entrada. Se dois pacotes exportam o mesmo nome e só um é renomeado, sai um vermelho falso no outro. O erro só deixa o `conferir` vermelho a mais, nunca verde a mais, mas a onda que cair nisso vai precisar desse ajuste.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/foto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/casos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/filtros-casam.test.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 05:48:04 · `tasks/prd-nomes-de-mercado/2_task.md`

**VEREDITO: REPROVADO**

**Cenários exigidos:** tirei os cenários de `casos.md` ("`conferir`", "`restos`", "Trava contra filtro vazio"), da Tech Spec §5 e da tabela "Testes que provam a regra".
- **Caminho feliz:** o `conferir` verde com a árvore do `HEAD` e com a onda aplicada (símbolo, arquivo, pasta, pacote e subcaminho). O `restos` limpo com o nome novo. Toda fonte da árvore real casa e rende o mínimo gravado.
- **Bordas:** teste movido com e sem o mapa; nome exportado que muda de arquivo no mesmo pacote ou passa a outro pacote; JSX só reindentado; título em template; fixture, protótipo e `dist`.
- **Quem contorna:** o nome antigo em template, chave, crase, regex, `dist` e `-w`; o glob que só casa dentro de `__fixtures__/`.
- **Liberações do `restos`:** `fica`, `trava`, troca à mão, mapa de linha com e sem o `13.json`, ouro.
- **Alvo ausente:** foto vazia, raiz e mapa inexistentes, fonte que não carrega.
- **Permissão, isolamento e concorrência:** não se aplicam. A tarefa toca só `tools/`, sem dado de escola, banco nem fila.

**Cobertos:** cada linha da tabela tem o teste citado pelo nome, e as contagens batem: 11 e 13 casos, 9, 14, 13, 6, 10 e 5. Os casos de `casos.md` estão todos lá. As fixtures `knip.json` e `30-camada-ia.md` são iguais às reais. Não há `.skip`, teste comentado nem mock. Rodei `npx vitest run --project unidade` nos três arquivos: 111 passaram. Mesmo assim, `tools/renomear/restos.test.ts › restos na árvore` hoje só prova o "não há mapa", porque `mapas/` está vazia. Isso é aceitável até a primeira onda.

**Bloqueantes:**

1. **Uma regra sem teste nenhum.** Em `tools/renomear/foto.ts:87`, o `ts.isNoSubstitutionTemplateLiteral(no)` dentro de `ehTexto` não tem teste. Nenhum teste de `conferir.test.ts` usa template sem substituição fora de título de caso: o de `:46` tem `${s}` e o de `:249` é título. Se esse trecho sair, um texto como `` `texto` `` some da foto, a troca dele passa verde, e nenhum teste fica vermelho.
   - Correção: acrescentar ao `it.each` de `conferir.test.ts:49` uma linha com template sem substituição (de `` `abc` `` para `` `abd` ``, categoria `string`) e um bloco `mutacao` que tire esse trecho.

2. **Cláusulas novas sem bloco de mutação.** Os testes existem e falhariam, mas falta o bloco. Isso é bloqueante por si. A pergunta 1 da Autoconferência diz que "cada categoria da foto" e "a `trava` que não libera" foram mutadas, e não há bloco para isso. Para cada item, falta um bloco que cite o teste indicado:

   | Onde | Cláusula | Teste que o bloco deve citar |
   |---|---|---|
   | `tools/renomear/conferir.ts:114` | o mapa aplicado ao caminho do item, "o caminho dos casos" da §5 (o bloco troca `arquivo` por `item.arquivo`) | `um arquivo de teste foi movido e tem os mesmos casos` |
   | `tools/renomear/foto.ts:94` | a categoria `string`, a linha inteira. Hoje só há o bloco do `!ignorados` (linha 421 do documento) | `muda %s` |
   | `tools/renomear/foto.ts:113-116` | a entrada do especificador na foto. Os blocos existentes só mexem no `ignorados.add` e na forma do especificador | `aparece um especificador fora do mapa` |
   | `tools/renomear/foto.ts:74` | `ExportDeclaration` passada para `nomesDaExportacao` | `a chave de método e de acessor…` |
   | `tools/renomear/foto.ts:80` | o nome da declaração exportada (`export class`, `export function`), o caminho principal do `exportado` | `aparece um nome exportado fora do mapa` |
   | `tools/renomear/foto.ts:43` | a chave identificador em `nomeDaChave` | `muda %s` (a linha da chave) |
   | `tools/renomear/casos.ts:24` | o título que é string, o caminho principal do `caso` | `um caso de teste entra (RF7)` |
   | `tools/renomear/restos.ts:73` | a liberação do título string de `describe`, `it` e `test`. Só as partes de template têm bloco | `o texto de describe, de it e de test` |
   | `tools/renomear/restos.ts:170` | "todos os mapas" (o bloco usa, por exemplo, `mapas.slice(-1)`) | `o de de um mapa anterior, com um mapa mais novo na pasta` |
   | `tools/renomear/restos.ts:171` | só `fica` libera, a `trava` não (o bloco usa, por exemplo, `classe === 'fica' \|\| classe === 'trava'`) | `a ocorrência classificada como trava não libera…` |

**Recomendações:**
- `tools/renomear/conferir.test.ts:359`, caso "o mapa que não existe lança": o `toThrow()` não confere a mensagem e aceita qualquer erro. A pergunta 4 da Autoconferência diz que "cada caso de alvo ausente confere a mensagem".
- `tools/renomear/conferir.test.ts:307`, caso "a exceção vale só no arquivo dela": está no `describe('conferir: verde quando')`, mas a asserção é de vermelho, e só olha o `codigo`. Vale conferir também as divergências.
- Falta um caso de arquivo importador movido para outra profundidade: o texto do import relativo muda e o alvo continua o mesmo, o que deve ficar verde.
- Ramos defensivos sem caso: chave numérica (`foto.ts:43`) e buraco na desestruturação (`foto.ts:58`).
- `tools/guardas/filtros-casam.test.ts:310-311`: o caso do `files` e do `ignores` só confere `toHaveLength(1)`. Vale conferir a mensagem, como fazem os casos do knip.
- A subtarefa 2.5 fala em fixture do `eslint.config.mjs`, mas o teste lê o arquivo real (pergunta 6). O certo é ajustar o texto da 2.5, sem mudar o teste.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 06:07:14 · `tasks/prd-nomes-de-mercado/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As dez correções da ordem `.processo/ordens/2_task-r1.md` estão no diff desta rodada.

- **Itens 1, 3, 4, 5 e 6:** cada um tem um caso novo ou corrigido em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts`:
  - o template sem substituição;
  - o `toThrow` agora confere a mensagem do mapa ausente;
  - "a exceção vale só no arquivo dela" foi para o describe do vermelho e confere as divergências;
  - o arquivo importador movido para outra profundidade;
  - a chave numérica e o buraco na desestruturação.
- **Item 2:** as dez cláusulas pedidas têm bloco de mutação, com mais quatro blocos para os casos novos. A pergunta 1 da Autoconferência diz 114 blocos.
- **Item 7:** o `filtros-casam.test.ts` confere a mensagem de `files` e de `ignores`.
- **Item 8:** o texto da 2.5 mudou e agora bate com o §5 da Tech Spec ("lido da configuração exportada"). A fixture continua só com o `knip.json` e a regra 30, então o documento diz o que o código faz e não há divergência escondida.
- **Itens 9 e 10:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts`, o docblock de `restosDeIdentificador` foi corrigido e a premissa do seed sintético entrou no topo do módulo. O caso foi para `describe('restos: vermelho')` em `restos.test.ts` e o bloco de mutação dele foi renomeado.

O diff só mexe em teste, em comentário e no documento da tarefa. Não há código novo de produção e nada entra em tarefa futura.

Recomendações:
- A seção "Sem aplicar" da ordem manda seis recomendações para o `TODO.md`: o `timeout` de 180 s, o `maxBuffer` de 1 GiB, o `casos.md`, o `PADRAO` de `guardioes-por-caminho.ts`, o `arquivosDoRepositorio` duplicado e a mensagem do `lerTodosOsMapas`. Também manda a do nome exportado homônimo em dois pacotes. Hoje o `TODO.md` não tem nenhuma delas e não está alterado nesta árvore. Quem fecha a tarefa precisa registrá-las antes do commit, para não se perderem.
- O bloco de mutação do especificador (`foto.ts`) só tira o `guardar(...)`. O `ignorados.add(especificador.literal)` já tinha bloco na rodada 1, então nada fica descoberto. Vale dizer isso na própria seção, para quem ler não achar que falta um bloco.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 06:07:40 · `tasks/prd-nomes-de-mercado/2_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (os mesmos da 1ª rodada; esta rodada confere as dez correções e o que o diff mexeu):
- a foto conta cada categoria: string, template, template sem substituição, regex, JSX, chave, caso, exportado e especificador;
- o mapa vale na foto de antes, inclusive no caminho do item;
- a exceção vale só no arquivo dela;
- cada liberação do `restos`, e a `trava`, que não libera;
- todos os mapas entram, inclusive um mapa anterior;
- os casos de borda que a correção trouxe: chave numérica, buraco na desestruturação exportada, importador movido para outra profundidade, variável local com o nome antigo.

**Cobertos:**
- Correção 1 está feita. Em `tools/renomear/conferir.test.ts:57` entrou a linha "um template sem substituição" (de `abc` para `abd`, categoria `string`), e o bloco tira o `ts.isNoSubstitutionTemplateLiteral` de `tools/renomear/foto.ts:87`. Com o trecho fora, o literal não cai em nenhum outro ramo de `itemDoNo` e some da foto, então o teste fica vermelho pelo motivo certo.
- As dez cláusulas da correção 2 têm agora bloco, cada um com o teste pedido:
  - `conferir.ts:114`, contra "um arquivo de teste foi movido e tem os mesmos casos";
  - `foto.ts:94`, contra "muda uma string";
  - `foto.ts:116`, contra "aparece um especificador fora do mapa";
  - `foto.ts:74`, contra "a chave de método e de acessor…";
  - `foto.ts:80`, contra "aparece um nome exportado fora do mapa";
  - `foto.ts:43`, contra "muda uma chave de objeto";
  - `casos.ts:24`, contra "um caso de teste entra" (o portão passa o nome com `-t`, que é busca por trecho, e acha "um caso de teste entra (RF7)");
  - `restos.ts:73`, contra "o texto de describe, de it e de test";
  - `restos.ts:170`, com `slice(-1)`;
  - `restos.ts:171`, com `fica || trava`.
- Conferi que o trecho "antes" de cada bloco existe ao pé da letra no código.
- O documento tem 114 blocos `mutacao`, o mesmo número que a Autoconferência diz.
- Os casos novos têm bloco próprio: chave numérica, buraco na desestruturação e importador movido para outra profundidade (este reusa a cláusula do caminho do item).
- "a exceção vale só no arquivo dela" passou para "vermelho quando" e agora confere as divergências exatas, não só o código de saída.
- O caso da variável local passou para "restos: vermelho" com o nome novo, e o bloco que o cita foi atualizado junto.
- Duas asserções ficaram mais fortes:
  - em `tools/guardas/filtros-casam.test.ts:310`, `toEqual` com a mensagem no lugar de `toHaveLength(1)`;
  - em `conferir.test.ts:382`, `toThrow` passou a exigir a mensagem.
- As contagens da tabela batem com os arquivos: 12, 15 e 9 casos nas três seções do `conferir`.
- `npx vitest run` nos três arquivos de teste da tarefa: 115 de 115 verdes. Não há `.skip`, mock nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- `tools/renomear/conferir.test.ts:382`: `/ENOENT.*mapas\/9\.json/` depende do texto do erro do Node. Se ele mudar entre versões, o teste quebra sem a regra ter mudado. Bastaria exigir só o caminho do mapa na mensagem.
- O bloco de `foto.ts:58` (o buraco na desestruturação) deixa o teste vermelho porque o código lança ao ler `.name` de `undefined`, e não por uma divergência errada. É o efeito real de tirar a cláusula, então vale, mas não prova uma foto errada.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/guardas/filtros-casam.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/foto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/casos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/restos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/conferir.ts
