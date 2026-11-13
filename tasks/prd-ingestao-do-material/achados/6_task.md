# Achados das revisões — `tasks/prd-ingestao-do-material/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 01:00:24 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: só o `licenciante` de `licenca_de_material` (o nome do dono do direito, que pode ser uma pessoa). Ele aparece apenas para a coordenação: na lista, no rótulo de leitor de tela de "Mudar a vigência" e no diálogo da vigência. A tarefa não toca nenhum dado de aluno, professor ou família, e não cria campo novo. A web lê o que a 5.0 já entrega pela API.

Fora da tabela de dados do docs/lgpd.md: nenhum. "Licença de material" está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:102`, com finalidade, base legal, retenção, auditoria só com ids e o arquivo do titular sem o licenciante.

Autorização por objeto: ok.
- A escola vem do token (5.0). O `PATCH` leva o id como UUID e passa por `encodeURIComponent` (`apps/web/src/areas/coordenacao/material/api/licencas.ts:41`).
- A licença que some da lista (o 404 ao mudar a vigência) é tratada igual a "não encontrado" em `DialogoDeLicenca.tsx`. Não existe ramo separado para "sem permissão".
- O e2e prova o isolamento em `e2e/material-licencas.spec.ts:258`: a coordenação de B não vê a licença de A, nem na lista, nem no sino, nem no cache que a sessão anterior deixou.
- O e2e também prova que o professor não alcança a aba (`e2e/material-licencas.spec.ts:298`).
- O endereço leva só `?aba=licencas`, valor de lista fechada (`apps/web/src/paths.ts:118-125`), nunca o licenciante.

Logs: limpos. Não há `console`, `localStorage` nem `Notification` nos arquivos novos. O sino não relê por tempo (sem `refetchInterval`, `api/licencas.ts:24-30`).

Auditoria: presente onde a regra exige. A leitura de licença não é leitura de dado de aluno. O registro e a mudança de vigência gravam `licenca.registrada` e `licenca.alterada` na API (5.0), só com ids e vigência. A web não acrescenta ação que precise de auditoria nova. O "Atualizar" do sino relê por chave exata e não alcança as leituras auditadas (`fila-da-coordenacao.ts:284-297`).

Envio externo: nenhum. Não há IA nem terceiro nesta tarefa.

Seed/fixture: sintético. As escolas e licenças do e2e são inventadas ("Editora Girassol", "Editora da escola A", "Contrato sintético 001"), em `e2e/support/material.ts:84-135` e `Licencas.test.tsx:42`. A vitrine mostra "Colégio sintético da vitrine cheia" e "Coordenadora sintética".

Fotos da tela: as quatro estão de acordo com a regra.
- `coordenacao--coordenacao-material--Licenças--computador.png` e `vazia--...--Licenças--celular.png` mostram o estado vazio, sem dado de pessoa além do nome da própria coordenadora no menu.
- `...--Registrar-licença--computador.png` e `--celular.png` mostram o diálogo com cinco campos. A ajuda pede o número do documento e diz "Não anexe o contrato". Nenhum campo pede contato ou documento de pessoa.
- O texto do sino ("Uma licença de material vence em dd/mm" / "...venceu; os materiais dela saíram da busca") não leva licenciante, referência nem contagem por pessoa (`fila-da-coordenacao.ts:133-163`). O teste que prova isso é `fila-da-coordenacao.test.ts` › "um item por licença, com ids distintos, e o texto não leva licenciante nem número", e o e2e repete a prova (`e2e/material-licencas.spec.ts:168`).

Pergunta de fechamento: nada de aluno muda nesta tarefa. Para o licenciante e para quem registrou, o arquivo do titular já responde, conforme `docs/lgpd.md:102`: entra o que a pessoa registrou, sem o licenciante e a referência, que são de terceiro.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/areas/coordenacao/material/Licencas.tsx:74`: o rótulo de leitor de tela "da licença de {licenciante}" é correto para quem usa leitor de tela e só a coordenação o vê. Se um dia esse componente for usado fora da coordenação, troque pelo texto da cobertura.
- `registradaAntesDaF4` compara o texto da referência com a frase "registrada antes da F4". Se a coordenação escrever essa frase à mão, a licença dela também ganha o selo. O efeito é só visual e não expõe nada. Um marcador próprio na API seria mais firme, numa tarefa futura.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-13 01:00:32 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: AJUSTES NECESSÁRIOS

Tela vista: sim (6 fotos lidas: Licenças e diálogo de registrar, no computador e no celular, na escola cheia, mais Licenças na escola vazia, nas duas larguras). A vitrine não tem licença registrada, então só vi o estado vazio e o diálogo. A lista com licenças, o diálogo "Mudar a vigência" e o sino com aviso eu revisei pelo código.

Estados: ok. Carregando, erro com "Tentar de novo", vazio e com dado existem em `Licencas.tsx:154-171`. O vazio convida: "Nenhuma licença registrada", o próximo passo e o botão "Registrar licença". Há também o erro de releitura com a lista já na tela e o registro que falhou com o diálogo fechado.

Acessibilidade: ok pelo que vi.
- Todos os campos têm rótulo e dica.
- O foco vai ao primeiro campo com erro.
- O estado da licença vem em texto e cor.
- Há `role="status"` para o efeito da vigência.
- A tabela vira lista no celular (`Table.tsx`).
- O botão "Mudar a vigência" tem texto extra para leitor de tela com o nome do licenciante.

Chromebook fraco: sem preocupação. É uma lista por escola, sem virtualização necessária, e a releitura é por ação da pessoa, nunca por tempo. A única chamada nova do sino é `licencasQueryOptions`, e ela segue o mesmo padrão das outras.

Celular:
- Em 360 px não há rolagem horizontal nem texto cortado.
- O botão "Registrar licença" tem cerca de 46 px, e os campos do diálogo cerca de 48 px.
- O diálogo rola por dentro (`overflow-y-auto`, `max-h-[calc(100svh-2rem)]`). O corte no pé da foto é a janela, não um defeito.
- Nada depende de hover. A aba Licenças e o item do sino abrem por `?aba=licencas`.
- `e2e/material-licencas.spec.ts` roda nos projetos `chromebook` e `celular`, com `paginaNaoRola` e `larguraExcedenteDoDialogo`.
- Os campos de data aparecem como `mm/dd/yyyy` na foto. É o idioma do navegador de teste, e `index.html` já tem `lang="pt-BR"`, então não cobro nada aqui.

Ação oficial protegida: sim. Registrar e mudar a vigência são ações da coordenação, com formulário explícito. "Mudar a vigência" mostra, antes de confirmar, quantos materiais saem ou voltam à busca (`DialogoDeLicenca.tsx:177-205`). Nenhuma nota nem decisão sobre aluno é tocada.

Bloqueantes:
1. **Termo técnico na tela da coordenação.** O texto interno de projeto vaza para o usuário final em três pontos:
   - `apps/web/src/areas/coordenacao/material/Licencas.tsx:46` mostra o selo "Registrada antes da F4 · revise". "F4" é nome de fase do roadmap, e a coordenadora não sabe o que é.
   - `Licencas.tsx:44` mostra `Documento: {licenca.referencia}`. Nas licenças da migração o valor é "registrada antes da F4", então o termo aparece uma segunda vez como se fosse o número do documento.
   - `Licencas.tsx:109` usa o título da faixa "Uma licença foi criada pela migração" (e o plural). "Migração" é vocabulário de engenharia.

   Correção exigida:
   - Trocar o selo por algo como "Criada automaticamente · revise".
   - Quando `registradaAntesDaF4(licenca)` for verdadeiro, mostrar "Documento: não informado" no lugar da referência literal.
   - Reescrever o título da faixa sem "migração", por exemplo "Uma licença foi criada a partir do nome da editora de cada material" (e o plural).
   - Manter a comparação com `REFERENCIA_DA_MIGRACAO` só como detalhe interno do código.
   - Ajustar `Licencas.test.tsx:325-339` para os textos novos e acrescentar um teste de que a linha da licença antiga não mostra "F4".
   - Avisar a Mesa de que o `techspec.md` e o `cenarios.md` citam "registradas antes da F4". Esse texto é do banco e do documento, não da tela.

Recomendações:
- `fila-da-coordenacao.ts` e o sino estão bem feitos: o título é inteiro, sem licenciante nem número por pessoa, e leva à aba certa. O `tituloInteiro` em `ListItem.tsx` é uma mudança pequena, com teste.
- A sub-aba "Materiais | Licenças" fica logo abaixo da barra de abas de Escola, e nas fotos as duas barras se parecem. Funciona. Se a coordenação confundir os dois níveis, vale diferenciar o estilo da sub-aba.
- No diálogo de registrar, "Quem deu a licença" e "Documento da licença" funcionam. Um exemplo na dica do documento, como "Termo 2026/07", ajudaria a quem não sabe o que digitar.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 01:00:46 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só mexe na web: a aba Licenças, o sino e documentos. Não há mudança em `packages/`, `apps/api` nem `apps/worker`, e nenhum job, seed, importação ou webhook toca em `Nota`. Todos com autor humano? Sim, porque nenhum caminho foi criado ou alterado.

Decisão autônoma sobre aluno: ausente. A situação da licença vem da API. A tela só diz o que a vigência faz com a busca do Assistente e do Tutor, e quem muda a vigência é a coordenação. O diálogo mostra quantos materiais saem ou voltam antes de confirmar. Nenhuma regra da tela esconde ou bloqueia material do aluno por conta própria (`Licencas.tsx:220-221`, `licencas.ts:88-111`).

Aprovação registrada: ok. A tarefa não tem saída de IA. Licença e vigência são atos humanos da coordenação, e a auditoria `licenca.registrada` e `licenca.alterada` foi feita na 5.0 (`docs/lgpd.md:102`). A exceção da D47 não aparece em nenhum outro agente.

Supervisão do tutor: ok. A tarefa não altera o tutor. O único efeito sobre ele é a busca seguir a vigência, que é decisão da coordenação, e o texto diz isso ("A busca do Assistente e do Tutor já segue a vigência nova", `Licencas.tsx:38`).

Autonomia declarada e visível: sim. Não foi alterada, e nenhum agente novo nem nível novo entra.

Bloqueantes: nenhum.

O que conferi na regra 70 e nas fotos:
- **Fotos:** a lista vazia no computador e no celular e o diálogo de registrar no celular não mostram saída de IA, nota, conceito nem sugestão de nota. Também não há métrica de professor nem nada sobre aluno. O "Sair" fica visível no celular (D59).
- **Item 8 e D64 no sino:** o tipo novo `licenca-vencendo` (`fila-da-coordenacao.ts:128-163`) não traz número por pessoa nem licenciante (que pode ser nome de pessoa), e não deriva de uso nem de atividade do professor. O único `contador` continua sendo o das turmas sem professor.
- **4b e D59:** o sino não relê sozinho. `licencasQueryOptions` não tem `refetchInterval` (`api/licencas.ts:23-30`) e o sino usa `QUEUE_QUERY_OPTIONS`, que inclui `refetchInterval: false` e `refetchOnWindowFocus: false` (`leitura-do-sino.ts:21,30`). Não há notificação do navegador.
- **Item 7:** nada mede comportamento nem infere estado emocional.
- **`docs/regulacao.md` §5:** a frase nova bate com o que a tela faz (a aba Licenças diz, antes de confirmar, quantos materiais saem ou voltam). O rótulo citado no fim da frase, "Licença de material", existe em `docs/lgpd.md:102`.

Recomendações:
- A frase do diálogo da vigência "O que já foi gerado continua citando a página" (`licencas.ts:105`) está correta. Quando a 7.0 ligar a licença ao envio, vale conferir que essa promessa continua verdadeira para o que o Assistente gerou e já foi aprovado (a citação até a página, D6), e registrar isso no teste da 7.0.
- A vitrine não tem licença registrada nem aviso no sino, então os dois textos do sino e as quatro situações só foram conferidos pelo código e pelos testes. Para a validação, seria bom a vitrine cheia ter ao menos uma licença em cada situação e o sino aberto com os dois avisos, como pede a seção "Telas" da tarefa (`tasks/prd-ingestao-do-material/6_task.md:69`).

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Licencas.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/licencas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/api/licencas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/regulacao.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 01:00:57 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (a tarefa não cria rota; usa `/v1/licencas` da 5.0)
Fila e prioridade: ok (nada vai para fila nem roda demorado em request)
Concorrência: protegida (o clique duplo em registrar manda um POST só, por `useSingleSubmit` na tela e botão desligado enquanto o pedido corre; há teste unitário e e2e)
Índice e paginação: ok (`lerPaginas` lê `/v1/licencas` paginada por `limite`; a contagem de materiais por licença no repository filtra por `escola_id`, e o repository vem da 5.0)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo no caminho quente)
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/api/licencas.ts:33`: `POST /v1/licencas` não tem chave de idempotência. A trava contra clique duplo está só na tela. Se a resposta se perde e a pessoa tenta de novo, pode surgir uma segunda licença. Hoje a tela relê a lista quando o registro falha, o que mitiga. Fica o registro para quando a API for revista: uma chave `Idempotency-Key` ou restrição única no banco (D49, regra 80 item 7).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Licencas.tsx:232`: a aba usa `useQuery(licencasQueryOptions)` com o padrão global (`staleTime` de 30 s e releitura quando a janela volta ao foco). O sino já desliga essa releitura com `QUEUE_QUERY_OPTIONS`. A carga é pequena porque só a coordenação usa a aba. Ainda assim, vale decidir de forma explícita se a aba também relê ao voltar o foco, para ficar igual ao sino.
- O sino agora faz uma sétima leitura por sessão da coordenação. São um ou dois usuários por escola, sem releitura por tempo, e o "Atualizar" relê com a chave exata. Não pesa às 10h. Se o sino crescer mais, vale um endpoint agregado da fila no lugar de sete GETs.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-13 01:01:34 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
1. **O Painel ainda corta o aviso de licença vencida.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/painel/Painel.tsx:191-205`, os mesmos itens do sino aparecem no bloco "Itens que esperam você" por `ListItem`, mas sem `tituloInteiro`. A tarefa criou essa prop porque "Uma licença de material venceu; os materiais dela saíram da busca" saía com reticências a 360 px, e no Painel o texto continua saindo cortado. Basta repassar `item.tituloInteiro` como o `Sino.tsx:116` já faz, com um caso no `Painel.test.tsx`.
2. **A tela mostra "F4", que a coordenação não conhece.** O selo "Registrada antes da F4 · revise", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Licencas.tsx:53`, usa o nome de uma fase do nosso roadmap. A faixa logo acima, "criada pela migração" (l.120), já diz o fato. Sugiro um texto como "Criada a partir dos materiais antigos · revise". O "Documento: registrada antes da F4" vem do dado que a 5.0 gravou e não se resolve aqui.
3. **Comentário do suporte do e2e não bate com a consulta.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/support/material.ts:480`, `licencasNoBanco` diz devolver "em ordem de registro", mas ordena por `id`, que é UUID. Nenhum caso depende da ordem hoje. Corrija o comentário ou ordene por uma coluna de registro.
4. **Data no formato americano nas fotos.** No diálogo de registrar (`coordenacao--coordenacao-material--Registrar-licença--celular.png`), os campos de data aparecem como `mm/dd/yyyy` porque a vitrine roda o navegador em en-US. Fixar `locale: 'pt-BR'` na vitrine e no e2e mostraria o que a coordenadora vê de fato (regra 50, item 12). Isso é da ferramenta, não da tela.
5. **Nenhuma divergência foi registrada, e concordo.** O endereço `?aba=licencas` e a prop `tituloInteiro` preenchem detalhes que a Tech Spec §9 não fixa e não contrariam nada nela. Os dois ficaram em `docs/interface.md`. Não precisam ir para `techspec.md` nem `cenarios.md`.

Conferi o que a tarefa pede:
- **Itens 6.1 a 6.6:** todos feitos. `grep 'cinco tipos'` não acha mais nada.
- **Contrato e cálculo da situação:** os tipos vêm todos de `@educa/shared`. O efeito da vigência usa o mesmo `situacaoDaLicenca` que a API usa.
- **Sino:** fica sem releitura por tempo (`QUEUE_QUERY_OPTIONS`) e o texto não leva licenciante.
- **Escopo:** a escolha da licença no envio (tarefa 7.0) não foi tocada.
- **Testes:** nenhum `.skip`, `any` ou `TODO` nos arquivos novos.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-13 01:02:01 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** registrar uma licença e vê-la na lista; mudar a vigência sabendo antes quantos materiais saem ou voltam; o sino avisa e leva à aba.
- **Borda:** a licença sem fim, que abre e salva com o fim nulo; o fim no mesmo dia do começo; o fim antes do começo; o último dia da vigência (0), que ainda vale; os 31 e os 30 dias antes do fim; o dia seguinte ao fim (+1) com e sem material; o dia de São Paulo às 23h30 e às 0h01; as licenças de antes da F4, uma ou mais; a lista que passa do teto de páginas; a licença que saiu da lista (`NAO_ENCONTRADO`); `ENTRADA_INVALIDA`; a releitura que falha com a lista vazia ou já na tela.
- **Concorrência:** clique duplo em registrar e em salvar a vigência; o diálogo fechado com o pedido ainda no ar; a resposta atrasada diante de outro diálogo aberto.
- **Permissão:** o professor não alcança a aba.
- **Isolamento:** a coordenação de B não vê a licença de A, nem na lista nem no sino.
- **Recomeço:** outra pessoa entra na mesma aba (login por cima, sem desmontar a tela).
- **Sem leitura por tempo:** o sino não relê sozinho e não dispara notificação do navegador (D59).

**Cobertos:** todos os itens acima, com uma exceção: a parte "o anúncio e a falha da pessoa anterior saem" do recomeço, que é o bloqueante 1. Rodei os sete arquivos de unidade da tarefa com `npx vitest run --project unidade` (Licencas, licencas, fila-da-coordenacao, SinoDaCoordenacao, Sino, ListItem, Painel): 185 de 185 verdes.

Nas mutações, o `--faltando` lista quatro linhas, e as quatro têm motivo que confere com o código. São ramos que o contrato de `packages/shared` repete (`safeParse` e `errosDaVigencia`), e nenhum cenário os separa. Os blocos cobrem cada condição nova do diff em `licencas.ts`, `DialogoDeLicenca.tsx`, `Licencas.tsx`, `Material.tsx`, `fila-da-coordenacao.ts`, `paths.ts`, `ListItem.tsx` e `Sino.tsx`.

Não há `.skip` nem teste comentado. O `vi.mock` de `api/sessao` só embrulha a função real para o teste disparar a troca de sessão, sem esconder a regra. A fila do sino usa o `situacaoDaLicenca` de `packages/shared`, e não uma situação escrita à mão. A tarefa não toca IA.

**Bloqueantes:**

1. **O teste da troca de sessão não prova o que o nome promete.**
   - `apps/web/src/areas/coordenacao/material/Licencas.test.tsx:617-630` › "o diálogo aberto fecha, e o anúncio e a falha da pessoa anterior não passam à seguinte" só confere que o diálogo fecha.
   - Em `apps/web/src/areas/coordenacao/material/Licencas.tsx:257-265`, o efeito também roda `definirAnuncio('')` e `reiniciarORegistro()`. Se eu apago essas duas chamadas, nenhum teste fica vermelho.
   - O cenário acontece de verdade. `aoTrocarDeSessao` dispara no login por cima (`apps/web/src/api/sessao.ts:150-171`), sem desmontar a tela. Então "Licença registrada…" ou "A licença não foi registrada…" da pessoa anterior ficariam na tela da seguinte.
   - O e2e "segunda pessoa" não cobre isso: ele sai por "Sair", vai para `/entrar`, e a tela desmonta.
   - A linha 15 da tabela (`6_task.md:57`) cita esse caso para "o aviso da tentativa anterior sai".
   - **Correção:** no mesmo caso, antes da troca, deixar na tela o anúncio "Licença registrada…" e, em outro passo ou caso, o aviso do registro que falhou com o diálogo fechado. Depois da troca, conferir que os dois somem. Acrescentar um bloco `mutacao` para cada uma das duas chamadas do efeito.

2. **As linhas 16 e 17 da tabela citam um e2e que não faz o que dizem.**
   - `tasks/prd-ingestao-do-material/6_task.md:58-59` atribuem "o registro entra na lista…" e "`paginaNaoRola` depois do registro" ao caso "a aba abre pelo caminho da pessoa, o vazio convida a registrar, o registro entra na lista…".
   - Em `e2e/material-licencas.spec.ts`, esse caso foi dividido. O de nome parecido (l.91) para no formulário incompleto e não registra nem chama `paginaNaoRola`. O registro e o `paginaNaoRola` estão em "o registro entra na lista com a situação em texto, e a página não rola" (l.115).
   - **Correção:** nas duas linhas, citar os dois casos pelo nome de agora.

**Recomendações:**

- **O e2e não dá o segundo clique.** `e2e/material-licencas.spec.ts:243-250` diz "o segundo clique não manda outro pedido", mas clica uma vez só e confere o botão desligado. A linha 6 da tabela cita esse e2e para "clique duplo". O teste de unidade com `dblClick` cobre a regra. Vale usar `dblclick()` no projeto `chromebook`, ou corrigir o comentário e a citação.
- **Ausência conferida antes da presença no sino.** Em `e2e/material-licencas.spec.ts:194-196`, o `toHaveCount(0)` do "venceu" vem logo depois de abrir o sino, antes de qualquer espera pela lista dele. Isso pode passar por estar vazio. Confirmar primeiro o link "vence em" (ou a lista visível) e só depois a ausência, como pede a armadilha da própria tarefa.
- **Datas do e2e perto da meia-noite.** As datas vêm do relógio do Node (`diaEm`) e as do seed do `now()` do Postgres. Perto da meia-noite de São Paulo, os dois podem cair em dias diferentes. O "Como testar" previa `page.clock` e "num sábado também", e o e2e não usa nem um nem outro. Fica registrado para a validação.
- **O vazio sem bloco de mutação.** Ninguém prova o `desligada: emRegistro` e o `emAndamento: emRegistro` do `EmptyState` (`Licencas.tsx:167`). O `useSingleSubmit` da tela continua impedindo o segundo `POST`.
- **Contagem inconsistente em `Painel.test.tsx`.** O comentário de `LEITURAS_DO_PAINEL` diz "onze" e o nome do caso diz "doze", com os incidentes. Alinhar o texto.
- **Idempotência no registro.** A recomendação do próprio documento sobre `Idempotency-Key` no `POST /v1/licencas` (API, 5.0) fica para a retro. Hoje, duas abas ou duas coordenadoras registrando ao mesmo tempo criam duas licenças.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-13 01:23:05 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Esta rodada só mexe em textos da tela (selo "Criada automaticamente · revise", "Documento: não informado", a faixa no singular e no plural, o exemplo na dica do documento), no repasse do `tituloInteiro` no Painel, em testes, no e2e, em comentário e no 6_task.md. Nenhum campo, DTO ou rota novos.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Não há rota nova. A leitura e o registro de licença continuam como foram auditados na rodada 1.

Logs: limpos. A pasta `apps/web/src/areas/coordenacao/material/` não tem `console` nem `logger`.

Auditoria: presente. Nesta rodada não há ação nova que a exija.

Envio externo: nenhum.

Seed/fixture: sintético. As editoras do e2e são fictícias ("Editora Jacarandá", "Migrada", "Orquídea"). O teste do Painel usa "Paulo Sintético", que já estava lá antes. As fotos mostram "Colégio sintético da vitrine" e "Coordenadora sintética".

Fotos (as seis, vistas):
- Licenças, escola cheia e vazia, no computador e no celular: só o estado vazio. Não aparece dado de pessoa, só o nome sintético da coordenadora na casca.
- Diálogo "Registrar licença", no computador e no celular: os campos são licenciante, cobertura, documento e as duas datas. Não há campo de pessoa nem de aluno. O texto pede para não anexar o contrato, só indicar o documento, o que ajuda a coletar menos.

Conferido no código:
- `apps/web/src/areas/coordenacao/painel/Painel.tsx:195` só repassa o `tituloInteiro` quando ele é `true`. Na fila, os únicos itens com essa marca são os dois avisos de licença (`apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts:143` e `:156`), e os títulos deles não levam licenciante, número nem nome de pessoa. Assim, nenhum título que tenha nome de pessoa (como "Refazer o convite de …") passou a aparecer inteiro.
- `apps/web/src/areas/coordenacao/material/Licencas.tsx`: "Documento: não informado" só troca o valor marcador da migração por um texto fixo. Não expõe nem acrescenta dado.
- Os testes novos da troca de sessão (`Licencas.test.tsx`, em "a sessão que troca") provam que o anúncio e a falha do registro da pessoa anterior somem quando outra pessoa entra. Isso é bom para quem divide um computador da escola.

Correções exigidas da rodada 1: nenhuma havia.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-13 01:23:13 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas: computador e celular do vazio e do diálogo "Registrar licença", escola cheia e vazia). A vitrine não tem licença registrada. A licença antiga, a faixa e o sino com avisos foram conferidos pelo código e pelos testes.
Estados: ok. A tela tem carregando, erro, vazio e com dado. O vazio convida ("Nenhuma licença registrada", com a explicação e o botão "Registrar licença"). O botão do vazio fica desligado enquanto o pedido corre, com teste novo.
Acessibilidade: ok. O diálogo tem rótulo em cada campo, dica e foco no primeiro campo (visível na foto). O foco volta ao título da lista. A situação aparece em texto e em cor.
Chromebook fraco: sem novidade nesta rodada. A tela é uma lista pequena e não há imagem nem upload.
Celular: ok. A 360 px não há rolagem horizontal. O botão principal tem mais de 44 px de altura. O diálogo cabe e rola por dentro. As abas quebram em duas linhas sem esconder nenhuma. A faixa de abas inferior fica atrás do diálogo, como esperado. O "mm/dd/yyyy" dos campos de data é o formato do navegador de teste, que segue o idioma de quem usa. Não é defeito da tela.
Ação oficial protegida: sim. Mudar a vigência mostra quantos materiais saem da busca, ou voltam a ela, antes de confirmar. A rodada atual não mexeu nisso.

Conferi cada correção exigida na rodada 1.
- **Selo de "F4":** `Licencas.tsx:51-55` agora mostra "Criada automaticamente · revise".
- **"Documento: {referência}":** `Licencas.tsx:50` mostra "Documento: não informado" quando a licença é antiga. A comparação com `REFERENCIA_DA_MIGRACAO` ficou só em `licencas.ts:21-23`, como detalhe interno.
- **Título da faixa:** `Licencas.tsx:120` deixou de dizer "migração". A busca no código de tela (`Licencas.tsx`, `DialogoDeLicenca.tsx`, `fila-da-coordenacao.ts`) não achou "F4" nem "migra" em texto mostrado ao usuário. Só sobram comentários de código e identificadores.
- **Testes:** `Licencas.test.tsx` foi ajustado. Um teste novo confere "Documento: não informado" e que `document.body` não tem `F4|migra[cç]`. O e2e `material-licencas.spec.ts` confere o mesmo na linha da licença. Há mutações novas para o selo e para o documento.
- **Recomendações da Mesa:** o exemplo "Termo 2026/07" aparece na dica do documento (visto na foto, nos dois tamanhos). `tituloInteiro` chega ao `ListItem` do Painel (`Painel.tsx:195`), com teste de classe e mutações.

Bloqueantes: nenhum.

Recomendações:
- `Licencas.tsx:120`: no singular, "Uma licença foi criada a partir do nome da editora de cada material" soa estranho, porque "de cada material" supõe várias. Algo como "Uma licença foi criada automaticamente, a partir do nome da editora" lê melhor. Se mudar, mude também o texto nos testes, no e2e e no `docs/interface.md`.
- `Licencas.tsx:106` e `:222` (comentários): ainda dizem "faixa da migração" e "antes da F4". Não aparecem na tela, mas é bom uniformizar com o vocabulário novo.
- Sub-aba Materiais/Licenças mais parecida com a barra de Escola: segue para a validação/TODO.md, como combinado.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-13 01:23:42 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As três recomendações que a Mesa mandou aplicar foram feitas:
- **Recomendação 1 (`tituloInteiro` no Painel).** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/painel/Painel.tsx:195` repassa a prop ao `ListItem`. O `Painel.test.tsx` confirma: o aviso de licença tem `break-words` e não `truncate`, e "Uma turma sem professor" continua com `truncate`.
- **Recomendação 2 (selo "F4").** O selo virou "Criada automaticamente · revise", a faixa virou "criada(s) a partir do nome da editora de cada material", e o documento da licença migrada aparece como "não informado". Há teste de unidade de que a tela inteira não mostra "F4" nem "migração", e o e2e diz o mesmo para a linha. A mudança é só de exibição: o banco continua com a `referencia` "registrada antes da F4" (techspec.md:50). O `docs/interface.md:619-621` já descreve a tela nova, então a divergência não ficou só no `N_task.md`.
- **Recomendação 3 (comentário de `licencasNoBanco`).** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/support/material.ts:126`, o comentário agora diz que a ordem segue o `id`, que é UUID e não acompanha o registro.

Os testes novos cobrem código que já existia na rodada 1 e cada um tem seu bloco de mutação no 6_task.md:
- o botão do vazio desligado enquanto o pedido corre (`Licencas.tsx:167`);
- a troca de sessão que apaga o anúncio e a falha do registro (`Licencas.tsx:258-262`).

O e2e agora espera o "vence em" aparecer no sino antes de conferir que o "venceu" sumiu, e com isso a ausência deixa de passar sem prova.

As fotos não mostram nada fora do que a tarefa pede. O vazio da coordenação e o diálogo de registro usam "licença" e "material de terceiro" e mostram a dica nova "Por exemplo: Termo 2026/07." A vitrine não tem licença registrada, então o selo e a faixa novos não aparecem nas fotos e ficam provados só pelos testes.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/licencas.ts:23` (`registradaAntesDaF4`) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Licencas.tsx:108` (`antesDaF4`) ainda usam o nome da fase, que a tela deixou de mostrar. Um nome como `criadaAutomaticamente` ficaria igual ao que a pessoa vê. A linha da tabela de testes do 6_task.md ("registradas antes da F4") pode seguir o mesmo nome.
- A recomendação 4 (locale pt-BR na vitrine) continua aberta e está no TODO.md. As fotos ainda mostram "mm/dd/yyyy" no diálogo (`coordenacao--coordenacao-material--Registrar-licença--celular.png`).

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-13 01:23:52 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Desde a rodada 1 o diff só mexe em textos e testes da aba Licenças, em `tituloInteiro` no Painel e no `6_task.md`. Nada grava em `Nota`, `Correcao` nem em entrega de IA. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A licença de material é um ato da coordenação, não uma saída de IA. O diff não toca nenhum fluxo de entrega de agente.
Supervisão do tutor: ok. O tutor não é tocado.
Autonomia declarada e visível: sim. A governança dos agentes não muda, e a leitura de `/v1/governanca/funcoes` continua entre as leituras do Painel.
Bloqueantes: nenhum

O que conferi:
- **Correções exigidas na rodada 1:** nenhuma, porque ela não teve bloqueante.
- **O diff de agora:**
  - O selo mudou de "Registrada antes da F4 · revise" para "Criada automaticamente · revise".
  - A licença criada assim agora mostra "Documento: não informado".
  - A faixa diz "criada(s) a partir do nome da editora de cada material".
  - O título do aviso de licença na fila do Painel agora aparece inteiro.
  - Entraram testes novos para a troca de sessão e para o vazio com o pedido no ar.
  - O e2e confere que o item do sino aparece antes de conferir o que sumiu.

  "Criada automaticamente" quer dizer criada pela migração, a partir do licenciante que o material já tinha. Não é saída de modelo, e por isso não exige o rótulo de saída de IA nem aprovação pela regra 70 item 3.
- **Fotos:** vi Licenças vazia no computador, Registrar licença no computador e no celular, e Licenças vazia no celular, da escola vazia. Não aparece nada de IA, nenhuma nota ou conceito, nenhum nome ou número por professor. Também não há nada que induza uso, e "Cancelar" e "Sair" estão à vista (D59).
- **Medir o professor (D45, D64):** o diff não acrescenta nenhuma métrica, ranking ou lista por professor. O teste do Painel continua barrando "não usa" e "adoção".
- **`docs/regulacao.md`:** não mudou entre a árvore da rodada 1 e a de agora, e não é preciso reauditar.

Recomendações:
- O comentário de `LEITURAS_DO_PAINEL` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/painel/Painel.test.tsx:172`) e o título do caso na linha 192 agora explicam as "onze mais a dos incidentes". Vale conferir na validação que nenhum caso novo amarre a contagem só a onze.
- A função `registradaAntesDaF4` e a variável `antesDaF4`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/coordenacao/material/Licencas.tsx:47-160`, ainda usam o nome da fase, enquanto o texto da tela já não usa. É só nome, para a retro ou para a X8.

## test-engineer · 2ª rodada · APROVADO · 2026-11-13 01:23:57 · `tasks/prd-ingestao-do-material/6_task.md`

VEREDITO: APROVADO

Esta foi a segunda rodada. Auditei o diff entre as árvores `1a90bd72` e `451cf177` e o que ele afeta. `Licencas.test.tsx` e `Painel.test.tsx` passam: 72 de 72.

**Cenários exigidos** (os da rodada 1, mais os que o diff trouxe):
- Troca de sessão: o diálogo fecha, o anúncio "Licença registrada…" some e a falha do registro que chegou com o diálogo fechado também some.
- A licença criada automaticamente aparece com o selo novo, com "Documento: não informado" e sem nome de fase ou de migração na tela. A faixa diz quantas no singular e no plural, e não aparece quando não há nenhuma.
- O botão "Registrar licença" do estado vazio fica desligado com o pedido no ar.
- No Painel, o título da licença aparece inteiro e os outros títulos são cortados com reticências.
- No sino, um item só desaparece depois de a lista ter chegado.
- A tabela do documento cita os testes pelo nome de agora.

**Cobertos:**
- **Correção 1, feita.** Há dois casos novos em `apps/web/src/areas/coordenacao/material/Licencas.test.tsx`, nas linhas 101 a 134 do diff.
  - "a troca de sessão apaga o anúncio do registro da pessoa anterior": o teste vê o anúncio na tela antes da troca e confere que ele some depois.
  - "a troca de sessão apaga a falha do registro da pessoa anterior, que chegou com o diálogo fechado": o teste segura o pedido, cancela, deixa falhar com 503, vê o aviso e confere que ele some depois da troca.
  - Cada caso tem o seu bloco `mutacao`, um para `definirAnuncio('')` e outro para `reiniciarORegistro()`.
  - Os dois cenários chegam de fato à cláusula. O mock de `aoTrocarDeSessao` só chama os ouvintes e não limpa o cache de consultas. Nada além do efeito apaga o `anuncio` (`Licencas.tsx:236`) ou zera o `registro.isError` (`Licencas.tsx:279`). Sem a chamada, o texto continua na tela e o teste fica vermelho pelo motivo certo.
- **Correção 2, feita.** As linhas 16 e 17 da tabela de `6_task.md` agora citam "o registro entra na lista com a situação em texto, e a página não rola", em `e2e/material-licencas.spec.ts:115`. Esse caso registra, confere a lista e o banco e chama `paginaNaoRola`, nas linhas 122 a 138. O caso da linha 91 aparece com o nome real e com o papel certo (o vazio e o formulário).
- **Texto novo da tela.**
  - O teste "as criadas automaticamente são destacadas…" segue o selo e a faixa novos. O bloco do selo troca o texto novo pelo antigo "Registrada antes da F4", e a asserção pega a troca.
  - O caso novo "Documento: não informado" tem o seu bloco, que volta para `licenca.referencia`. Esse caso também verifica que o corpo da página não traz "F4" nem "migração".
  - O plural e a ausência da faixa usam o texto novo.
  - O e2e da linha 161 confere o selo, "Documento: não informado" e a ausência de "F4".
  - Um grep em `apps/web/src`, `e2e` e no documento não achou nenhuma citação ao texto antigo. Ele só aparece como lado `+` de um bloco de mutação, o que é o esperado.
- **Recomendações da rodada 1 aplicadas.**
  - O vazio com o pedido no ar tem dois blocos: um tira `desligada` e o outro tira `emAndamento`, e cada asserção pega o seu.
  - No Painel, a asserção nova fica dentro de "os tipos da fila do Painel são os seis do sino…" (`Painel.test.tsx:331`). Os blocos `=== false` e `true ?` deixam o teste vermelho, pela classe `break-words` no primeiro caso e pela `truncate` no segundo.
  - No e2e do sino, o teste espera o item "vence em" aparecer antes de conferir que o "venceu" sumiu.
  - "Onze leituras, mais a dos incidentes" virou nome de teste.

Não há `.skip` nem mock que esconda a regra. A troca de sessão é simulada só no ponto de entrada.

Bloqueantes: nenhum.

Recomendações:
- Na linha "registradas antes da F4" da tabela de `6_task.md`, o trecho "(e a que não tem nenhuma, sem a faixa)" é paráfrase. O nome real do caso é "sem nenhuma licença criada automaticamente, sem a faixa". Vale citar pelo nome, como na lição da X3.
- A dica nova do campo do documento ("Por exemplo: Termo 2026/07.", em `DialogoDeLicenca.tsx:133`) não tem asserção. É só texto e não tem condição, então não bloqueia.
- Seguem sem aplicar, com destino já registrado: o `page.clock`/meia-noite vai para a Validação e para o `TODO.md`, e a idempotência do `POST /v1/licencas` vai para o `TODO.md`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-13 01:24:03 · `tasks/prd-ingestao-do-material/6_task.md`

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
- O `TODO.md` ainda não tem as duas recomendações da rodada 1 que a Mesa mandou para lá. A primeira é a `Idempotency-Key` no `POST /v1/licencas`. A segunda é o endpoint agregado do sino, que hoje relê `/v1/licencas` a cada abertura do Painel. Nenhuma das duas aparece em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/TODO.md`. A primeira está registrada só no próprio `6_task.md`, em "Recomendações sem aplicar". Vale lançar as duas no `TODO.md` antes do pouso para não se perderem.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/material-licencas.spec.ts:263`, o e2e não prova mais o segundo clique. Agora ele confere só que o botão fica desligado e que sai um pedido. O clique duplo continua provado pelo caso de unidade "clique duplo em registrar: um POST só", em `Licencas.test.tsx`. Isso basta enquanto a rota não tiver idempotência. Quando a rota ganhar a chave, o e2e deve voltar a provar que o servidor recebe o pedido repetido e grava uma licença só.

O diff desde a rodada 1 mexe só em textos da tela e da documentação, testes e o repasse de `tituloInteiro` no `Painel.tsx`. Nenhum desses pontos acrescenta leitura, escrita, job, chamada de IA ou query nova. A lista de leituras do Painel continua com as mesmas onze, mais a dos incidentes.
