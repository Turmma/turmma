# Achados das revisões — `tasks/prd-acesso-e-convites/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 12:43:56 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A lista passa a ler `convite.enviado_em`, coluna que já existia (3.0) numa tabela que já tem `escola_id`. Convite e usuário não variam por ano letivo, então não há `anoLetivoId` a exigir.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.repository.ts:31-60`, o método `pagina`. A escola vem de `requireEscolaId()`, isto é, do contexto da sessão, e entra no `where` das duas consultas (`usuario.escolaId` na linha 36, `convite.escolaId` na linha 45). O campo novo `enviadoEm` sai da mesma consulta que já tinha escopo e não ganhou caminho de leitura próprio.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/professores/professores.service.ts:45`: a hora só é exposta quando `envio = 'enviado'`, e o DTO de saída é explícito.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/api/professores.ts`: o `POST /v1/professores/convites/enviar` manda no corpo só `usuarioIds`, sem `escolaId`. O endpoint é da 3.0 e esta tarefa não o alterou.
- Nenhum `@Unscoped()` novo. Todo id é UUID (`z.uuid()` no schema).

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts`, no caso "4.0: `enviadoEm`…": o professor da escola B, com um envio `enviado` que tem hora própria, não aparece na lista da A, e a única hora que a lista traz é a da A. Retirando mentalmente `eq(usuario.escolaId, escolaId)`, a linha da B entra na lista e as duas últimas asserções quebram. No e2e, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts`, no caso "segunda pessoa", a coordenação de B na mesma aba não vê "Enviado em" da A, nem durante o carregamento nem depois dele.

Bloqueantes: nenhum.

Recomendações:
- O `eq(convite.escolaId, escolaId)` em `professores.repository.ts:45` não tem teste próprio. Ele é uma defesa em profundidade, porque o `inArray` já está restrito aos ids de usuário da escola, e por isso nenhum teste quebra se só essa cláusula sair. Um caso com um convite de outra escola apontando para o `usuario_id` de um professor da A provaria a cláusula, se o banco aceitar essa combinação.
- O `definirOEnvioDoConvite`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:747`, atualiza os convites só por `usuario_id`, sem a escola. É um ajudante de teste e não roda em produção, mas filtrar também por `escola_id` deixaria o padrão igual ao do código de produção.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-08 12:44:02 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: computador e celular, escola cheia e vazia). O botão "Enviar convites", o diálogo e os rótulos de envio não aparecem em nenhuma foto, porque todo professor da vitrine está "Ativo". Esses estados eu revisei pelo código e pelo e2e. Não fotografei com `--clicar`.
Estados:
- ok. O carregando, o erro de rede, o 429 e o vazio têm texto e foco no `e2e/professores-envio.spec.ts`.
- A tela vazia mantém o convite a "Importar professores" e "Cadastrar professor". Não aparece mensagem que se desculpa.
- "Enviar convites" só aparece com professor esperando convite (`Professores.tsx`, `quemEspera.length > 0`).

Acessibilidade:
- Cada linha tem uma região `aria-live="polite"` (`Professores.tsx`, coluna Situação).
- O foco do diálogo começa no texto e não no botão que envia.
- O erro do diálogo leva o foco.
- O botão de enviar mostra "Enviando…" enquanto o pedido está no ar, e há um `role="status"` só para leitor de tela.
- O e2e roda `seriousViolations`.
- Ressalva nas recomendações: a região `aria-live` fica `display:none` quando vazia.

Chromebook fraco:
- A releitura é de 5 s, só com a aba visível, só com linha em `na_fila` ou `enviando`, e para em 5 min (`envio-do-convite.ts`).
- Ela não cancela a leitura que uma ação pediu (`cancelRefetch: false`).
- O `gcTime: 0` tira do cache o pedido com os ids.
- Rodei os testes de unidade da pasta: 8 arquivos e 141 testes passaram. O e2e eu não rodei.

Celular:
- Nas fotos de 360 px não há rolagem horizontal nem corte.
- Os botões "Importar professores" e "Cadastrar professor" empilham, com 44 px ou mais.
- A fileira de botões e o rodapé do painel quebram linha (`flex-wrap`).
- O e2e cobre 360 px na lista, no diálogo e no painel, com 44 px nas ações principais e 24 px no resto, e cobre 1366 × 768 com `paginaNaoRola`.
- Nada depende de hover. Nenhum fluxo exige o celular.
- Pelo código, "Cancelar" tem o tamanho do botão que envia. Não vi o diálogo em foto.

Ação oficial protegida: sim. Enviar convite não é ação oficial de nota. Mesmo assim, o diálogo diz quantos professores recebem ("Enviar o convite por e-mail a 3 professores") e que "os links enviados ou copiados antes deixam de valer na hora", antes de confirmar. O "Reenviar" diz o nome da pessoa.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/coordenacao/professores/Professores.tsx`, o `<span aria-live="polite" className="… empty:hidden …">` da coluna Situação. A região fica `display:none` quando está vazia, então ela não existe na árvore de acessibilidade. O comentário do código diz que "a região existe antes do texto", e isso não vale para leitores de tela: a primeira mudança de "" para "Enviando" pode não ser anunciada. Sugestão: manter a região sempre renderizada (por exemplo `min-h-0` sem `hidden`, ou `sr-only` quando vazia) e tirar o `gap-1` do contêiner pai. Um caso e2e que confira o anúncio, e não só a presença da região, fecharia isso.
2. `DialogoDeEnviarConvites.tsx` e `Professores.tsx`: se a lista se reler com o diálogo aberto e `quemEspera` cair a 0, o texto diz "a 0 professores" e o botão continua ativo. O servidor devolve `quantidade: 0` e o texto de "a lista mudou" cobre o caso, então é só um detalhe. Poderia desabilitar o botão com 0.
3. No cartão do celular, o contêiner `items-start` do rótulo de envio com a coluna Situação alinhada à direita pode ficar desalinhado em relação ao selo. Isso só aparece com envio, que a vitrine não mostra. Vale uma foto com `--clicar` ou um professor pendente na validação.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 12:44:18 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO

A tarefa 4.0 só passa a mostrar uma coluna que já existia (`convite.enviado_em`). Não cria coluna, não guarda nada novo e não toca em dado de aluno.

**Campos pessoais tocados:** a hora em que o e-mail do convite do professor saiu (`enviadoEm`), que agora aparece na lista da coordenação. O professor é adulto. O nome do professor já aparecia na lista e continua igual.

**Fora da tabela de dados do docs/lgpd.md:** nenhum. O campo já está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md:77`, linha "Envio do convite por e-mail", com `enviadoEm`, finalidade (RF11) e retenção.

**Autorização por objeto:** ok.
- `GET /v1/professores` pega a escola do contexto, nunca de parâmetro (`requireEscolaId()`), nas duas consultas: a dos usuários e a dos convites (`apps/api/src/professores/professores.repository.ts:33-50`).
- O teste de integração novo prova que a lista da escola A não traz a hora do professor da B (`apps/api/test/convites-enviar.int.test.ts`, caso "4.0: `enviadoEm` é a hora que o job gravou…").
- O e2e prova que a coordenação de B, entrando na mesma aba depois da de A, não vê "Enviado em" nem o painel do professor de A aberto pelo endereço (`e2e/professores.spec.ts`, "segunda pessoa…").
- "Reenviar" usa a rota da 3.0, `POST /v1/professores/convites/enviar`, que limita os `usuarioIds` à escola do contexto.

**Saída da API (DTO):** é montada campo a campo em `apps/api/src/professores/professores.service.ts:45`, e o schema é fechado (`z.strictObject`). A hora só sai quando o estado é `enviado`; nos outros estados sai `null`, mesmo que o banco tenha uma hora gravada. O teste confere isso estado por estado. Não sai e-mail, token, valor cifrado nem link. Os testes conferem que o texto da resposta não contém `cifrado` nem `escola.invalid`.

**Logs:** limpos. Os arquivos novos e alterados do front não têm `console` nem `logger`. A mutação usa `gcTime: 0`, o que tira do cache os ids enviados no pedido.

**Auditoria:** presente. O `convite.enviado` já é gravado pela 3.0 e é conferido no teste de integração. A 4.0 não acrescenta nenhuma ação que a regra 20, item 10 mande auditar: a coordenação lê a lista de professores, não dado de aluno.

**Envio externo:** é o e-mail do convite ao professor, enviado pelo worker da 3.0. No ambiente local e no e2e ele vai ao Mailpit, que é local. O e2e confere que o texto do e-mail não traz o nome do professor. Nada vai a provedor de IA e nada de aluno sai.

**Seed/fixture:** sintético. Os nomes são "Ana", "Bia", "Professor sintético", e os endereços terminam em `@escola.invalid`. O ajudante `definirOEnvioDoConvite` (`e2e/support/seed.ts:747`) grava `decode('00','hex')` no lugar do token e do endereço cifrados, e só nos estados em que o envio ainda está aberto.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts`) não lê a tabela `convite`, então não traz o envio do convite do professor (canal, estado, `enviado_em`) nem o fato de o endereço ter ido ao provedor de e-mail. Isso já vinha de antes e é da 3.0, não da 4.0. Ainda assim, para a pergunta "o que o sistema guarda e para onde foi enviado" valer também para professor, convém ligar isso ao pedido do titular, ou deixar escrito em `docs/lgpd.md` por que o convite fica de fora.
2. `FUSO_DA_ESCOLA` está fixo em `America/Sao_Paulo` (`apps/web/src/areas/coordenacao/professores/envio-do-convite.ts:11`), repetindo o `FUSO_DO_USO` da API. Não vaza nada, mas quando o fuso passar a ser configurável por escola, é melhor ler da mesma fonte.

O prompt não trouxe fotos da tela, então a conferência visual de qual dado aparece para qual papel ficou só pelo código e pelos casos e2e.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 12:44:31 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A tarefa mexe na tela Professores da coordenação e na leitura de `GET /v1/professores`. O envio e a fila são da 3.0 e ficaram fora do escopo.
Rate limit: ok. A releitura passa pelo limite global por usuário e por escola, que fica no Redis: 120 por minuto por usuário e 30000 por escola, segundo o `.env.example`. A releitura gasta 12 pedidos por minuto em uma aba, e só com a aba à vista, com alguma linha em `na_fila` ou `enviando` e por no máximo 5 minutos. O `cancelRefetch: false` impede que as leituras se acumulem.
Fila e prioridade: ok. O diálogo só chama o `POST /v1/professores/convites/enviar` da 3.0, que enfileira. O e-mail sai pelo worker, e nada demorado roda no request.
Concorrência: protegida. No cliente, o `useSingleSubmit` segura o clique duplo. No servidor, o índice único `convite_pendente_unico` (`packages/core/drizzle/0015_convite_pendente_unico.sql:6`) segura os dois "Enviar" ao mesmo tempo, e esse caso já tem teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts`. A leitura atrasada que chega depois do "Reenviar" é cancelada pelo `invalidateQueries`.
Índice e paginação: ok. O `enviadoEm` é só mais uma coluna na consulta que já existia. Essa consulta filtra por escola e usuário, tem o índice `convite_escola_usuario_idx (escola_id, usuario_id)` e já era paginada; o plano da consulta não muda.
Degradação de IA: não se aplica.
Migration: não se aplica. A coluna `enviado_em` já existe desde a 1.0, então não há migration nova.
Métrica e alerta: ok. A tarefa não cria endpoint nem alerta; a rota já existente continua medida pelas métricas HTTP de sempre.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx`: cada releitura usa o `lerPaginas` e lê a lista inteira, até 10 páginas de 100. Uma escola com mais de 100 professores, com a coordenação usando duas abas, chega perto do limite de 120 por minuto por usuário. Vale anotar no `TODO.md` uma releitura só de quem está em envio, ou um intervalo que cresça com o número de páginas, para quando houver rede pública grande.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/envio-do-convite.ts`: a releitura usa `setInterval` próprio, enquanto Material, Time e TurmaHoje usam o `refetchInterval` do TanStack. A escolha tem motivo (o prazo de 5 minutos e o recomeço a cada envio), mas vale uma linha no comentário dizendo por que não seguiu o padrão da casa (D81).

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-08 12:45:15 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A divergência do `enviadoEm` está registrada no `techspec.md` §4 e no `cenarios.md` (RF11, [I]).
Portão local: carimbo válido

Bloqueantes:

- **O diálogo "Enviar convites" pode mandar uma lista vazia.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx:368` e `:400-406`, o `quemEspera` é recalculado a cada renderização, a partir da lista de agora. Com o diálogo aberto, a lista se relê sozinha: a cada 5 s quando há linha em `na_fila` ou `enviando`, e também quando a pessoa volta à aba, porque o `staleTime` é de 30 s e o `refetchOnWindowFocus` está ligado por padrão. Se nesse meio-tempo o último pendente aceita o convite ou tem o convite revogado, acontecem duas coisas:
  - O diálogo passa a dizer "Enviar o convite por e-mail a 0 professores".
  - O clique manda `{ usuarioIds: [] }`, por `mutacaoDoEnvioDeConvites([])` (`api/professores.ts:465`). O `enviarConvitesRequestSchema` tem `.min(1)` (`packages/shared/src/professores/professores.ts:49`), então a API recusa com 400 `ENTRADA_INVALIDA`.

  A pessoa recebe um erro genérico. O texto feito para esse caso, "Nenhum convite entrou na fila: a lista mudou…" (`envio-do-convite.ts:78`), nunca aparece por esse caminho.

  **Correção exigida:** com `quemEspera.length === 0` e o diálogo de lote aberto, nenhum pedido sai. O diálogo diz que ninguém espera o convite agora e tira ou desabilita "Enviar convites", deixando "Fechar". Um caso em `Professores.test.tsx` deve provar isto: a lista relida para zero pendentes com o diálogo aberto não dispara `POST` e mostra o texto.

Recomendações:

- **Fuso da escola fixo na tela.** `envio-do-convite.ts:11` cria a terceira cópia de `'America/Sao_Paulo'` no `apps/web`; as outras duas estão em `areas/professor/turmas/semana/semana.ts:12` e `areas/coordenacao/privacidade/textos-dos-pedidos.ts:203`. Além disso, `configuracao_operacional_escola` guarda um fuso por escola. O ideal é uma constante única em `packages/shared`, e registrar como premissa que a tela não lê o fuso configurado da escola.
- **Mudanças em `e2e/professores.spec.ts` além do que a tarefa descreve.** No caso "segunda pessoa", o login passou a ser `configurarSegundoFatorPelaApi` mais `entrarPelaTelaComSegundoFator`. Além disso, o `page.goto` do endereço do professor de A virou `pushState` mais `popstate` (linhas 1098-1104). Com isso, o caso deixa de provar a carga a frio do link direto `?professor=<id de A>` na sessão de B e passa a provar só a navegação dentro da aplicação. Vale registrar o motivo na tarefa, ou manter um `goto` em outro caso.
- **Região `aria-live` escondida enquanto vazia.** Em `Professores.tsx:306`, a região usa `empty:hidden`, que vira `display:none` quando não há texto. Assim a primeira passagem de vazio para "Enviando" pode não ser anunciada pelo leitor de tela. Isso é com o `frontend-reviewer`.
- **Lista incompleta.** Com `dados.completa === false`, a contagem e os ids do lote cobrem só quem foi carregado, e o diálogo não avisa.
- **Redação da Tech Spec.** O `techspec.md` §4 diz que `enviadoEm` é "só presente com `envio = 'enviado'`", mas o contrato manda o campo sempre, com `null` nos outros estados. Ajustar para "só não nulo com…".
- **Testes de integração da 3.0.** Os ajustes em `apps/api/test/convites-enviar.int.test.ts`, que deixam os casos da 3.0 sem depender da ordem das linhas pelo relógio, são correção de teste instável e ficam fora do objetivo da 4.0. Vale citá-los no relato da tarefa.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 12:46:32 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o diálogo "Enviar convites" diz quantos recebem e que os links anteriores deixam de valer. O e-mail chega pelo Mailpit e o professor aceita. Cada linha mostra o rótulo do seu estado de envio, e a lista se relê a cada 5 s.
- **Bordas:**
  - o lote alcança só quem está pendente ou vencido; quem foi revogado ou está ativo não recebe nada
  - "Reenviar" aparece só para quem já teve envio; o convite copiado não tem rótulo
  - `enviado` sem hora no banco mostra só "Enviado"
  - a hora sai no fuso da escola, mesmo de madrugada e na virada de ano
  - nome longo sem espaço a 360 px
  - o servidor devolve 0 ("a lista mudou")
  - leitura atrasada que chega depois do "Reenviar"
  - abrir o diálogo de novo depois de revogar alguém
- **Carga e concorrência:** clique duplo em "Enviar"; cota de 300 por hora (429); rede caída no meio do envio; aba oculta; parada depois de 5 min.
- **Permissão:** "Enviar convites" só aparece quando alguém espera o convite; "Reenviar" só para quem pode.
- **Isolamento:** a lista da A não traz a hora de envio da B; a segunda coordenadora na mesma aba não vê nada da anterior.

**Cobertos:** todas as 24 linhas da tabela "Testes que provam a regra" têm teste com o nome citado, inclusive os itens juntados por ponto e vírgula. A releitura tem os seus casos próprios; os cinco estados aparecem em unidade, componente e e2e.
- Rodei `npx vitest run --project unidade apps/web/src/areas/coordenacao/professores/ packages/shared/src/professores/`: 9 arquivos, 145 casos, todos verdes.
- Não rodei a integração nem o e2e, que pedem o ambiente do compose.
- O `TZ: 'Asia/Tokyo'` da unidade (`vitest.config.ts:56`) faz o teste de fuso falhar de verdade se o `timeZone` sair.
- O clique duplo é provado no componente (um pedido só). A corrida no servidor já está no caso paralelo da 3.0 (`convites-enviar.int.test.ts:636-660`).
- Não há `.skip`, `.only`, teste comentado nem provedor de IA. O e-mail sai pelo Mailpit do compose.
- O `vi.mock` de `envio-do-convite` em `Professores.test.tsx` é um espião sobre a peça de verdade. Ele não esconde a regra: a regra tem teste de unidade próprio, e o e2e "a mudança de estado vem pela releitura de 5 s" prova a peça de verdade ligada à tela.

**Bloqueantes:**
1. `packages/shared/src/professores/professores.ts:562` (`enviadoEm: z.iso.datetime().nullable().default(null)`) é uma cláusula nova sem bloco na seção "Mutações".
   - A regra "texto que não é data não passa" está na tabela da tarefa, e o teste existe (`packages/shared/src/professores/professores.test.ts:36`). Falta o bloco que prova que esse teste fica vermelho sem ela.
   - O `--faltando` não a lista porque a linha não tem condição, mas é regra de contrato.
   - Correção: acrescentar o bloco abaixo e, se quiser, um segundo que tire o `.default(null)`. O nome citado no `teste:` não pode levar o `(4.0)`, porque o parêntese é lido como expressão regular, o mesmo problema que o próprio documento já registrou.
   ```mutacao
   arquivo: packages/shared/src/professores/professores.ts
   teste: packages/shared/src/professores/professores.test.ts › a hora do envio
   -  enviadoEm: z.iso.datetime().nullable().default(null),
   +  enviadoEm: z.string().nullable().default(null),
   ```

**Recomendações:**
- **Linhas novas sem bloco, cobertas por teste que já existe:**
  - `DialogoDeEnviarConvites.tsx:49` (`disabled={pedido.isPending}`), coberto pelo caso do clique duplo.
  - `Professores.tsx:366` (`return recarregar()` em `recarregarDepoisDoEnvio`), coberto por "…relê a lista", que espera duas leituras.
  - Um bloco para cada fecharia a lacuna.
- **Asserções enfraquecidas na reescrita contra o relógio** (`apps/api/test/convites-enviar.int.test.ts:658-660`): antes o caso exigia exatamente `['cancelado','na_fila']` entre os convites por e-mail; agora um terceiro convite por e-mail, em outro estado, passaria. Correção sugerida: `expect(convites.filter((c) => c.canal === 'email')).toHaveLength(2)`. O mesmo vale para as linhas 111-113.
- **"O professor abre o link do e-mail, cria a senha e aceita"** (`e2e/professores-envio.spec.ts:172`) para no aviso de `/entrar`. Poderia conferir na lista da coordenação que o professor saiu de "pendente", que é o resultado do aceite.
- **Caso de componente que falta:** o diálogo diz "2 professores" e o servidor devolve `quantidade: 1` ou `0` (alguém revogado entre abrir e confirmar). Hoje só a unidade de `textoDoEnvioFeito` cobre isso.
- **Releitura em tempo real no primeiro e2e** (`e2e/professores-envio.spec.ts:164`): o caso espera a entrega do worker mais a releitura de 5 s no relógio de parede, sem `page.clock`, perto da metade do prazo de 30 s. Instalar o relógio e usar `runFor` tira essa margem.
- **Prova negativa com espera fixa** (`e2e/professores-envio.spec.ts:417`): o `waitForTimeout(250)` é aceitável depois de `entregue` e de dois quadros. O comentário diz que o relógio da página está parado; com `clock.install()` sem `pauseAt`, ele anda sozinho. Vale corrigir o texto.
- **Troca do `page.goto` por `pushState`** (`e2e/professores.spec.ts:1117-1121`): o caso deixa de provar a abertura do endereço de A depois de recarregar a página na sessão de B. Continua provando o que importa, que o painel não abre, mas a recarga sai do caso.
- **O 429 que recomeça** (`Professores.test.tsx`, "a cota da hora (429)…"): o caso diz que reabrir recomeça "sem ele", mas o aviso já tinha sumido com o sucesso. Para provar o recomeço de verdade, feche o diálogo com o 429 ainda na tela e reabra.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/4_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/envio-do-convite.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/Professores.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores-envio.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 13:12:17 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita.**
- `Professores.tsx:340` passa `semDestinatario={quemEspera.length === 0}` ao diálogo de lote.
- Em `DialogoDeEnviarConvites.tsx`, o `etapaDoDialogo` muda para a etapa `sem_destinatario` quando a lista fica vazia e nenhum pedido está no ar. Nessa etapa, "Enviar convites" e "Cancelar" saem da tela, sobra "Fechar", e aparece o texto `TEXTO_SEM_QUEM_ESPERE_O_CONVITE` (`envio-do-convite.ts`). Não há mais caminho para `{ usuarioIds: [] }`.
- Um caso em `Professores.test.tsx` prova isso: a lista é relida para zero pendentes com o diálogo aberto, o texto aparece, não há "a 0 professores" nem os botões "Enviar convites" e "Cancelar", e `corposDoEnvio()` fica vazio.
- Se a lista zera com o pedido no ar, o diálogo continua em "Enviando…" e mostra a contagem que o servidor devolve. Há um caso que prova isso.
- Também ganharam caso a contagem do servidor diferente da do diálogo, com o "Nenhum convite entrou na fila" agora alcançado pelo caminho certo, e o 429 seguido de reabrir o diálogo.

**O resto do diff não abre problema novo:**
- O rótulo de envio trocou `empty:hidden` por `mt-1 … empty:mt-0`, e o teste prova que a região não tem `display: none`.
- O comentário que explica por que o `setInterval` é próprio cita a D81, que pede um motivo para não seguir o padrão.
- O `toHaveLength(2)` no teste de integração reforça um caso que já existia.
- A redação da techspec sobre `enviadoEm` ficou mais clara.
- O documento da tarefa ganhou as linhas de cobertura, as mutações novas e a tabela "Sem aplicar" de cada revisor. As mutações que miravam linhas que mudaram foram atualizadas.

**Fotos:** nas duas escolas todo professor está "Ativo", então o botão, o diálogo e os rótulos de envio não aparecem. A tela não mostra nada fora do pedido. Esses estados só conferi pelo código e pelos testes.

Recomendações:
- O texto novo "Ninguém espera o convite agora: a lista mudou. Confira a situação de cada professor." é visto pela pessoa e não está em `cenarios.md` (RF11) nem em `docs/interface.md`. Vale registrá-lo lá, junto do "Nenhum convite entrou na fila".
- Em `TextoDaEtapa` (`DialogoDeEnviarConvites.tsx`), o segundo ramo testa `feito !== undefined` em vez de `etapa === 'feito'`. Usar a etapa nos três ramos deixa uma única fonte de verdade.
- O comentário novo em `e2e/professores-envio.spec.ts:416-417` diz que o relógio da página "anda sozinho" e que a garantia vem da resposta já entregue. É melhor dizer só o que garante a prova, sem descrever o `clock.install()`.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/Professores.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/Professores.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/cenarios.md

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-08 13:12:23 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: `/coordenacao/professores` no computador e no celular, na escola cheia e na vazia). O botão "Enviar convites", o diálogo e os rótulos de envio não aparecem nas fotos, porque todo professor da vitrine está "Ativo". Esses estados eu conferi pelo código e pelos testes do diff.
Estados: ok.
- Carregando: `LoadingState` ("Carregando os professores…").
- Vazio: convida, com o título "Nenhum professor ainda", o próximo passo e o botão "Cadastrar professor".
- Erro: `ErrorState` com "tentar de novo".
- Com dado: tabela, e cartões no celular.
- Diálogo de envio: pergunta, envio em andamento, feito, falha com `ErrorAlert` e, novo nesta rodada, a etapa `sem_destinatario`.

Acessibilidade: ok.
- A região `aria-live` do envio fica sempre na árvore. A rodada trocou `empty:hidden` por `empty:mt-0` e `Professores.test.tsx` confirma que ela não ganha `hidden`.
- O foco inicial do diálogo vai para o texto, não para o botão que envia.
- Há `role=status` para "Enviando…".
- O erro vai no `ErrorAlert`.

Chromebook fraco: a mudança desta rodada é só texto e uma ramificação de estado, sem peso novo. A releitura do envio tem prazo de 5 minutos e para sozinha. Não vi lista longa nem upload neste diff.

Celular: ok nas fotos a 360 px. Não há rolagem horizontal. O cartão do professor quebra o nome sem cortar. Os botões "Importar professores" e "Cadastrar professor" têm 44 px (`min-h-11`). `SECONDARY_BUTTON_CLASSES` também dá 44 px a "Cancelar", "Fechar" e "Enviar convites". O diálogo usa `flex-wrap` e `break-words`. Nada depende de hover. Nenhum fluxo exige o celular.

Ação oficial protegida: sim. O envio de convites diz quantos professores recebem e que os links anteriores deixam de valer, antes de confirmar (`DialogoDeEnviarConvites.tsx:36-41`). Com 0 destinatários nenhum pedido sai (`etapaDoDialogo`, linhas 28-31), e o teste confirma `corposDoEnvio()` vazio. Com o pedido já no ar, a tela segue em "Enviando…" até a resposta chegar. A contagem exibida vem do servidor depois do envio.

Bloqueantes: nenhum.

Recomendações:
- Rodada 1 aprovada sem correções exigidas, e o diff desta rodada só endurece o que já passou. `TEXTO_SEM_QUEM_ESPERE_O_CONVITE` está em português claro e diz o próximo passo: "Confira a situação de cada professor."
- Em `DialogoDeEnviarConvites.tsx:60`, a etapa `sem_destinatario` também afeta o diálogo "Reenviar", que não recebe `semDestinatario`. O comportamento está certo, porque o alvo é um só e é lido pelo painel. Vale um comentário de uma linha dizendo isso.
- Se uma foto futura tiver professor com convite pendente, confira o botão "Enviar convites" e o texto de envio ao lado da situação a 360 px. Hoje só o e2e `e2e/professores-envio.spec.ts` cobre isso.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 13:12:45 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos (2ª rodada, sobre o diff desde a árvore `ef5b80c3`):**
- A correção exigida na 1ª rodada: um bloco de mutação para `enviadoEm: z.iso.datetime().nullable().default(null)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts`.
- Comportamento novo do diálogo:
  - a lista relida para zero pendentes com o diálogo aberto;
  - o mesmo caso com o pedido no ar;
  - o servidor devolvendo uma contagem diferente da mostrada;
  - fechar o diálogo com o aviso de 429 na tela e abri-lo de novo.
- A região `aria-live` passa a ficar sempre na árvore (sai o `empty:hidden`).
- O `toHaveLength(2)` no caso dos dois "Enviar" em paralelo.
- A remoção do bloco cuja linha deixou de existir.

**Cobertos:**
- **Correção exigida: feita.** Há dois blocos novos, ambos citando `› a hora do envio`, sem o `(4.0)`. Os dois ficam vermelhos pelo motivo certo:
  - `z.string()`: o caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.test.ts:37` (`'12/11 às 14:05'` com `success === false`) passaria a aceitar o texto e falha.
  - sem `.default(null)`: a linha 34 recebe `undefined` em vez de `null`, e o `toBeNull` falha.
- **`etapaDoDialogo` e `TextoDaEtapa`:** cada cláusula tem bloco que leva a um caso que alcança essa cláusula. São eles: `return 'pergunta'`, `semDestinatario ?` sem o `!pedidoNoAr`, `if (false)` no texto de sem destinatário, `feito === undefined` invertido, `'feito'` trocado por `'pergunta'`, `etapa === 'pergunta'` voltando a ser `feito === undefined` no botão e no Cancelar/Fechar, e `semDestinatario={false}` em `Professores.tsx`.
  - O caso "a lista relida para zero pendentes…" testa o resultado: o texto exato, nenhum "Enviar" nem "Cancelar", e `corposDoEnvio()` igual a `[]`, ou seja, nenhum pedido saiu.
  - O caso "com o pedido no ar…" é concorrência de verdade: o envio fica preso numa promessa enquanto a releitura chega.
- **`empty:hidden` trocado por `empty:mt-0`:** há bloco que devolve o `empty:hidden`, com `falha: .not.toContain('hidden')`, e o `semDisplayNone` está dentro do caso citado, "cada linha tem a região…" (`Professores.test.tsx:752`).
- **Bloco removido:** era o do `{feito === undefined ? (`, linha que o diff apagou. Os blocos com a linha antiga foram atualizados para `etapa === 'pergunta'`.
- **Tabela de testes:** as duas linhas novas citam os quatro casos pelo nome, e os quatro existem (`Professores.test.tsx:837`, `:855`, `:877`, `:898`).
- **Isolamento:** o diff não toca repository nem endpoint.
- **Testes de integração:** `toHaveLength(2)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts:660` fecha a brecha de um terceiro convite passar pelas buscas por estado.
- **Rodada local:** `npx vitest run` do `Professores.test.tsx` e do `professores.test.ts` passou, 57 de 57. Não há `.skip`, teste comentado nem chamada de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- O `semDisplayNone` (`Professores.test.tsx:105`) confere o texto da classe (`not.toContain('hidden')`), e não o estilo calculado. Ele pega a volta do `empty:hidden`, mas não pega um `display: none` vindo por outra classe, como `sr-only` mal usada ou `invisible`. Fica registrado para a validação; no jsdom não há forma melhor e barata.
- O bloco `if (feito === undefined) return <p>{feito}</p>`, que cita "o diálogo diz 2 professores…", fica vermelho já na primeira asserção ("a 2 professores" some), antes de chegar à contagem do servidor. Ele prova a cláusula, mas um `falha: findByText(/^1 convite entrou na fila/)` deixaria o motivo explícito.
- O caso "a cota da hora (429) ainda na tela: fechar… recomeça sem o aviso" protege contra regressão, mas não tem bloco próprio, porque o diff não traz cláusula nova para ele. Está certo assim; só vale saber que ele não prova nenhuma linha de código desta rodada.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 13:12:45 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não toca em `Nota`, correção, seed de nota, job ou importação de nota. `e2e/support/seed.ts` não mudou desde a rodada 1. Todos com autor humano? sim, porque nenhum caminho novo foi aberto.

Decisão autônoma sobre aluno: ausente

Aprovação registrada: ok. Nenhuma saída de IA entra nesta tarefa. O envio de convite é ato da coordenação, que confirma num diálogo antes de enviar.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nenhum agente novo ou alterado, e a governança não é tocada.

Bloqueantes: nenhum.

O que conferi no diff da rodada 2 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-4_task-r2-codigo.txt`), olhando pela regra 70:

- **Diálogo de envio** (`DialogoDeEnviarConvites.tsx`): ganhou um estado para quando, com o diálogo aberto, ninguém mais espera convite. Ele mostra um texto e só "Fechar", e não envia nada. A coordenação continua confirmando cada envio. "Cancelar" continua do tamanho do botão que envia enquanto há pergunta (D59), e nenhuma saída ficou mais difícil.
- **Coluna "Situação"** (`Professores.tsx:84-91`): mudou só o aviso para leitor de tela, que agora fica sempre presente. O que ela mostra é o estado da conta e do e-mail ("Enviando", "Enviado em…", "Não chegou"). Não é uso de IA, adoção ou desempenho do professor, então não há ranking nem lista nominal de adoção (D45, D64, itens 8 e 9).
- **Resto do diff**: um teste de integração ficou mais estrito (`convites-enviar.int.test.ts:659`), há casos novos de componente, comentários de D81 e e2e, e um ajuste de texto na techspec. Nada disso toca nota, IA, tutor ou indicador.

Fotos (`.processo/vitrine/coordenacao--coordenacao-professores--{computador,celular}.png` e `vazia--…`): lista de professores com nome, disciplina, turma e "Ativo.". Nenhuma saída de IA, nota, conceito, métrica de uso, ordem por desempenho ou ranking do professor. Não há nada que induza uso, e "Sair" fica visível nos dois tamanhos. O diálogo e os textos de envio não aparecem nas fotos, porque todos estão ativos. Conferi esses estados pelo código e pelos testes acima.

Recomendações:
- O texto novo "Ninguém espera o convite agora: a lista mudou. Confira a situação de cada professor." (`envio-do-convite.ts:64`) é bom. Seria útil ter uma foto da vitrine com um professor esperando convite, para que o diálogo e os textos de envio apareçam numa próxima rodada que tenha tela.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 13:12:46 · `tasks/prd-acesso-e-convites/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (o diff não muda a cota de 300 por hora do envio aprovada na rodada 1; o caso de 429 continua coberto em `Professores.test.tsx`)
Fila e prioridade: ok (não mudou desde a rodada 1)
Concorrência: protegida. O estado `semDestinatario` impede que saia um pedido com `usuarioIds` vazio quando a lista é relida com o diálogo aberto. Com o pedido em andamento, o diálogo continua em "Enviando…" e não troca de estado no meio; há teste para isso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/Professores.test.tsx`. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/convites-enviar.int.test.ts`, o caso do clique duplo agora exige exatamente dois convites por e-mail, o que reforça a prova.
Índice e paginação: ok (nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo no servidor)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx:82`: se o envio falhar e depois a lista for relida para zero pendentes, o diálogo mostra ao mesmo tempo o texto de que ninguém espera o convite e o aviso de erro antigo. Vale esconder o `ErrorAlert` nesse estado. Não bloqueia: nenhum pedido sai e não há efeito na carga.
