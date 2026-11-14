# Achados das revisões — `tasks/prd-ingestao-do-material/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 22:33:38 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A tarefa só lê `material` (`escola_id`, `edicao`, `substituido_por`) e `artefato.conteudo`. `material` não varia por período, então não precisa de `anoLetivoId`. Os ids são UUID: `fonteDoArtefatoSchema.materialId` é `z.uuid()`.

Queries verificadas:
- `apps/api/src/artefato/artefato.repository.ts:130`, `fontesDosMateriais`. O escopo é `eq(material.escolaId, requireEscolaId())`, tirado do contexto autenticado. O id do material vem do `jsonb` do artefato e nunca do cliente. Com a lista vazia, o `inArray` do drizzle 0.45.2 devolve `false`, e há caso que cobre isso.
- `apps/api/src/artefato/artefato.service.ts:100-113` (`ler`) e `:130-135` (`pdf`). As `fontes` só são lidas depois que `porId` acha o artefato dentro do alcance (`#noAlcance`, com vínculo confirmado). Artefato fora do alcance, de outra escola ou inexistente devolve `NAO_ENCONTRADO` antes de qualquer leitura de material.
- O `PATCH` (`renomear`) devolve o resultado de `ler`, com o mesmo escopo.
- Nenhum endpoint passou a aceitar `escolaId` no corpo ou na query.
- Não há `@Unscoped()` novo.
- A camada de rede não foi tocada.

Teste de isolamento: presente e efetivo.
- `apps/api/src/artefato/artefato.int.test.ts`, caso "isolamento: o artefato de `c` que cita o material de `d`…". Sem a cláusula `escolaId`, `fontesDosMateriais([edicaoNova, d.materialId])` devolveria duas chaves e a fonte viria com o título da escola D (`TITULO_DA_OUTRA`). O teste quebra.
- O projeto não tem RLS que mascarasse a remoção da cláusula, então o teste mede o próprio repository.
- O caso "o artefato de B no contexto de A…" confere que a resposta é igual à do id inexistente e que nem `fontes` nem o título aparecem. Cobre a professora de outra escola, o colega, a professora de Física, a coordenação e o aluno.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/artefato/artefato.int.test.ts`, no caso de isolamento: a última asserção, `(...).size).toBe(1)` no contexto de `d`, não diz qual material foi achado. Trocar por `[...keys()]).toEqual([d.materialId])` deixa explícito que o material de `c` ficou de fora.
- `apps/api/src/artefato/artefato.repository.ts:125-128`: o comentário diz "o de outra escola, como o que o expurgo apagou", o que dá a entender que o material expurgado é de outra escola. Separar os dois casos: a linha apagada e o id de outra escola.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 22:33:47 · `tasks/prd-ingestao-do-material/10_task.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:130`: o `fontesDosMateriais` perdeu o `if (ids.length === 0) return new Map()`. Com lista vazia, ele ainda faz uma ida ao banco que não acha nada (o drizzle 0.45 transforma `inArray([])` em `false`). Na prática a lista não chega vazia, porque toda questão e todo plano têm citação. Mesmo assim vale devolver o retorno antecipado, para não pagar a ida ao banco.

Por que não há bloqueante:
- **Leitura nova (`GET /v1/artefatos/:id` e PDF):** é uma consulta só, em `material`. Ela filtra por `escola_id` e pelo `id`, e o índice único `material_escola_id_unico` começa pelo escopo. Busca no máximo 20 ids distintos, que é o teto do conteúdo, então não precisa de paginação. Roda em paralelo com as outras leituras do `ler`.
- **PDF:** continua sendo gerado dentro do request, como já era antes desta tarefa. A tarefa só muda o texto da linha "Fonte".
- **Front:** `Artefato.tsx` e `ResultadoDaFerramenta.tsx` deixaram de chamar `GET /v1/materiais`, que lia todas as páginas. A carga por tela aberta diminuiu.
- **Escrita:** a tarefa não grava nada, não mexe em fila, não chama modelo e não traz migration.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 22:33:56 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não grava em `Nota` por nenhum caminho: rota, job, seed, importação ou webhook. As escritas novas no banco ficam só em testes e helpers de e2e, e atingem `material`, `artefato`, `vinculo` e `licenca_de_material` (`e2e/support/material.ts:361-372`, `apps/api/src/artefato/artefato.int.test.ts`). Todos com autor humano? Não se aplica, porque não há escrita em Nota.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. O que decide se o PDF sai limpo, como rascunho ou não sai continua igual, e a tarefa só trocou `titulos` por `fontes` na mesma chamada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts:130-135`):
- `aprovada` sai limpo;
- `pendente` sai como rascunho, marcado em toda página;
- `rejeitada` não sai e devolve `VERSAO_ADAPTADA_NAO_APROVADA`.

O aviso de IA no PDF continua (`AVISO_DE_IA_NO_PDF` e `AVISO_DE_IA_NO_RASCUNHO`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/pdf-do-artefato.ts:274-275`). Na tela, o aviso "só pode ir aos alunos depois que você aprovar" segue em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/professor/ferramentas/ResultadoDaFerramenta.tsx:62`. A exceção do tutor (D47) não aparece em nenhum outro agente.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. A tarefa não muda nível nem declaração de agente.

Os outros pontos da lista:
- **Auditoria (item 6):** sem mudança. A tarefa não cria saída de IA nova nem novo caminho de aprovação. As `fontes` são lidas agora, a partir do material, e não são conteúdo gerado.
- **Vigilância (item 7):** nada novo. `fontes` traz só `materialId`, título, edição e `substituido`, sem dado de aluno nem de comportamento.
- **Discursiva e redação (item 8, D55):** nenhum campo, tela ou prompt de nota. O chip e o rodapé do PDF dizem só de onde a citação veio.
- **Medir o professor (item 9):** sem métrica nem indicador de professor. A leitura das `fontes` só ocorre depois de `porId`, que já aplica o alcance do professor (`artefato.service.ts:101-104`). O escopo da escola fica no repository (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:130`).
- **`docs/regulacao.md`:** não mudou. O trecho novo de `docs/interface.md` (l.2129-2135) não contradiz a regra 70.

Bloqueantes: nenhum.

Recomendações:
- Vale incluir um caso no `pdf-do-artefato.test.ts` que confira, no mesmo PDF, o rodapé novo com "edição anterior" junto com `AVISO_DE_IA_NO_RASCUNHO`. Isso prova que a mudança da linha "Fonte" não disputa espaço com a marca de rascunho nem a esconde. Hoje cada um tem o seu caso, mas os dois juntos não são provados.
- O `titulos-dos-materiais.ts` continua servindo a conversa e a Turma hoje, e ali a fonte fica sem "edição anterior". Isso não fere a regra 70, mas vale registrar no `TODO.md` para que a citação de material substituído diga a mesma coisa em todas as telas.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-13 22:33:57 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas, cheia e vazia; computador e celular). A foto do artefato é a do Implementador, tirada às 22:02. A escola cheia atual não tem artefato com fontes montado, então a foto dela mostra o chip e a linha "Fontes (1)" da edição anterior, mas não o estado "material da escola". Esses estados estão provados em `Artefato.test.tsx`, `ResultadoDaFerramenta.test.tsx` e `e2e/artefato-fontes.spec.ts`.
Estados: ok. O código não mudou os quatro estados do artefato. O teste novo confirma que nenhum chip nem título de fonte aparece enquanto o artefato carrega ou quando ele falha. O vazio é o "Este artefato não está disponível", que diz o que fazer ("O que você gerou está em Criados").
Acessibilidade: ok. O chip continua sendo botão, com nome acessível "Fonte: título (edição), p. N" e o mesmo texto no cartão aberto. Esse é o contrato do `docs/interface.md` 11.3, atualizado nesta tarefa.
Chromebook fraco: melhora. O artefato e o resultado da ferramenta deixaram de buscar `/v1/materiais`, uma requisição a menos por tela (o teste confirma que não há chamada). Nenhuma lista nova foi criada.
Celular: ok a 360 px. Não há rolagem horizontal nem texto cortado, e a linha "Fontes (1): … (2024, edição anterior), p. 2" quebra bem. A barra inferior fixa cobre parte da questão na foto, mas isso é só o recorte da captura e não é defeito desta tarefa. "Pedir versão adaptada" tem altura de 44 px ou mais. O chip "p. N" tem 28 px (`CitationChip.tsx:73`, `min-h-7`), acima do mínimo de 24 px, e a linha de fontes tem 44 px (`Sources.tsx:24`). Os dois componentes não foram alterados nesta tarefa.
Ação oficial protegida: sim. A tarefa não toca aprovação nem nota. Só mostra a origem da citação.
Bloqueantes: nenhum. Conferi o contrato nos arquivos abaixo, e nenhum deles expõe dado indevido.
- `packages/shared/src/assistente/artefato.ts`: `fonteDoArtefatoSchema` é estrito e só carrega `materialId`, título, edição e `substituido`.
- `apps/api/src/artefato/artefato.repository.ts`: a leitura é escopada por `requireEscolaId()`.
- `apps/api/src/artefato/artefato.service.ts`: o PDF e a tela usam o mesmo `rotuloDaFonte`.
- `apps/web/src/areas/professor/artefatos/Artefato.tsx:274`, `apps/web/src/areas/professor/ferramentas/ResultadoDaFerramenta.tsx:61` e `apps/web/src/components/ui/ai/source-labels.ts`: a tela usa `titulosDasFontes`, sem termo técnico nem texto em inglês.

Recomendações:
- A vitrine da escola cheia deveria montar um artefato com fonte "edição anterior" e outro com "material da escola", para a validação ver os dois estados na foto.
- O título "Artefato" da tela de não disponível é termo interno, mas já existia e não é desta tarefa. Vale trocar por "Material gerado" ou parecido em outra tarefa.
- `Conversa.tsx` e `TurmaHoje.tsx` ainda leem `/v1/materiais`, então o chip lá não traz "edição anterior". O comentário em `titulos-dos-materiais.ts` já registra isso, e o escopo da tarefa o aceita.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 22:34:01 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo de pessoa. As `fontes` levam só `materialId`, `titulo`, `edicao` e `substituido`, todos do material didático da escola. `edicao` e `substituido_por` já estão no mapa de dados de `docs/lgpd.md` (linha 101, F4, 8.0), com finalidade e retenção. O que é de pessoa (`enviadoPor`, `excluidoPor`, `licenciante`) e os dados técnicos (`sha256`, chave do objeto) ficam fora do DTO.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok.
- `GET /v1/artefatos/:id` e o PDF só chamam `fontesDoConteudo` depois de o `porId` achar o artefato dentro do alcance (`apps/api/src/artefato/artefato.service.ts:102-106` e `:126-134`). Trocar o id na URL não abre artefato de outra pessoa.
- `fontesDosMateriais` filtra pela escola do contexto (`apps/api/src/artefato/artefato.repository.ts:133`). Se o jsonb citar um material de outra escola, a fonte sai como "material da escola", e o título dela não aparece.
- O teste cobre a professora de outra escola, a colega de outra turma, a professora de Física, a coordenação, o aluno e o vínculo encerrado: todos recebem o mesmo `NAO_ENCONTRADO` do id inexistente, e o corpo não traz `fontes` nem título (`apps/api/src/artefato/artefato.int.test.ts`, describe "as fontes do artefato").
- `inArray` com lista vazia devolve `false` no drizzle 0.45.2, então tirar a guarda de lista vazia não quebra nada, e há um caso de teste para isso.

**Logs:** limpos. A tarefa não acrescenta log.

**Auditoria:** presente onde a regra exige. A leitura do artefato pelo próprio professor da turma não pede auditoria. A coordenação e a rede não alcançam a rota. O PDF continua sem auditoria, como já estava, porque não traz dado de pessoa.

**Envio externo:** nenhum. A tarefa não chama modelo e não manda nada para fora.

**Seed/fixture:** sintético. Títulos, edições e escolas inventados (`substituirMaterialNoBanco`, `criarArtefatoDoVinculo`, `atividadeSintetica`).

**DTO e contrato:** `fonteDoArtefatoSchema` é estrito (`packages/shared/src/assistente/artefato.ts`). O teste `apps/api/test/contracts.test.ts` confirma que as `fontes` não trazem hash, chave, quem enviou nem licenciante, e que campo a mais é recusado. A web não pede mais `GET /v1/materiais` para o artefato aberto, o que diminui o que chega ao navegador.

**Pergunta de fechamento:** a tarefa não guarda dado novo de aluno e não envia nada para fora. O arquivo do titular e a lista de compartilhamento continuam respondendo como antes.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `fontesDosMateriais` filtra só pela escola, sem olhar a disciplina do vínculo (`apps/api/src/artefato/artefato.repository.ts:130-135`). Hoje isso basta, porque só roda depois do `porId`. Um comentário dizendo que o método não pode ser chamado fora desse caminho evita que alguém o use depois para listar materiais.
2. O texto difere na caixa: a API devolve `TITULO_DA_FONTE_SEM_LINHA = 'material da escola'`, minúsculo, e a web usa `MATERIAL_SEM_TITULO = 'Material da escola'`. Não é questão de LGPD; registro para o `frontend-reviewer`.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/assistente/artefato.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/contracts.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-13 22:34:51 · `tasks/prd-ingestao-do-material/10_task.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. As quatro subtarefas foram feitas e nada avança sobre a 11.0 ou a 12.0.

**Aderência à Tech Spec:** uma divergência existe só no `10_task.md`. É a linha 6, a do e2e que grava a troca de edição direto no banco.

**Portão local:** carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:**

1. `tasks/prd-ingestao-do-material/10_task.md:81` declara que o e2e "nova edição" grava a troca no banco (`substituirMaterialNoBanco`), em vez de passar pela coordenação, e diz que isso já está no `cenarios.md`, nas seções "Edição nova" e "Telas". Não está.
   - `tasks/prd-ingestao-do-material/cenarios.md:236` ainda promete um `[E]` com "nova edição, e o artefato antigo mostrando 'edição anterior'".
   - O caso real em `e2e/artefato-fontes.spec.ts:496-515` é outra coisa: o artefato e a troca são escritos direto no banco, e a extração e a coordenação não passam por ele.
   - A linha "10.0" da `techspec.md` §11 também não registra essa divergência.
   - A 12.0 tem um e2e "editar séries e enviar edição nova", mas ele não confere o artefato antigo com "edição anterior". Assim, ninguém prova a promessa de ponta a ponta, e o `cenarios.md` segue dizendo o contrário.
   - **Correção exigida:** registrar a divergência na linha `[E]` do `cenarios.md` e na linha "10.0" da `techspec.md` §11. O texto deve dizer que o e2e da 10.0 grava a troca no banco e que o caminho completo, com o worker, é o caso de `apps/api/src/artefato/artefato.int.test.ts` ("a troca de edição"). A alternativa é mover a parte da "edição anterior" pela tela para o e2e da 12.0 e anotar isso no `12_task.md`.

**Recomendações:**

- **Dois textos para a mesma ausência.** `TITULO_DA_FONTE_SEM_LINHA = 'material da escola'`, em `packages/shared/src/assistente/artefato.ts`, convive com `MATERIAL_SEM_TITULO = 'Material da escola'`, em `apps/web/src/components/ui/ai/source-labels.ts`. Por isso o mesmo artefato pode mostrar "material da escola" ou "Material da escola", conforme o caminho (os testes do e2e e do `Artefato.test.tsx` cobrem os dois). Vale unificar ou registrar o porquê.
- **Consulta inútil.** `apps/api/src/artefato/artefato.repository.ts:131` perdeu o `if (ids.length === 0) return new Map()`. Com zero ids, vai ao banco à toa. O resultado é o mesmo, mas a guarda antiga era mais barata e mais clara.
- **Estado que a API não produz.** O caso "artefato sem `fontes`" com citação, em `Artefato.test.tsx` e no e2e, monta um estado que a API nunca devolve, porque toda citação gera uma fonte. Vale um comentário dizendo que o caso é só a guarda do componente.
- **Nome do caso de vínculo.** Em `apps/api/src/artefato/artefato.int.test.ts`, o caso "o vínculo encerrado em Química e aberto em Física" é de leitura difícil: quem encerra o vínculo é a professora de Física, num vínculo de Química que o próprio teste criou. Um nome que diga quem perde o acesso a quê ajudaria a próxima leitura.

## test-engineer · 1ª rodada · APROVADO · 2026-11-13 22:34:59 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: `fontes` com título e edição, sem repetir o material, no plano também, e o PDF dizendo o mesmo.
- Artefato antigo depois da troca de edição: `substituido` verdadeiro, com o título e a edição da antiga. A geração nova cita só a edição nova.
- Rascunho que cita material cuja licença venceu: as `fontes` e o PDF continuam, e a geração nova não usa o material.
- Expurgo da linha: a fonte vira "material da escola".
- Isolamento: o artefato da B no contexto da A dá `NAO_ENCONTRADO`, e as `fontes` não levam o título da B nem quando o `jsonb` cita o material dela.
- Permissão: colega de outra turma, professora de Física, coordenação e aluno recebem `NAO_ENCONTRADO`, a mesma resposta do id inexistente.
- Vínculo encerrado em X e aberto em Y.
- Contrato: as `fontes` sem hash, chave do objeto, quem enviou nem licenciante.
- Chip: título e edição, "edição anterior", "material da escola", sem `fontes`, carregando e erro.
- PDF: rodapé da questão e lista de fontes do plano.
- Recomeço na mesma aba e resposta atrasada.
- e2e da troca de edição com a API de verdade.
- Tela de 1366 × 768 sem rolagem.

**Cobertos:** cada linha da tabela de testes tem o seu caso, com o nome citado no documento.
- Em `apps/api/src/artefato/artefato.int.test.ts` há os sete casos de integração, um por cenário de API acima.
- `apps/api/test/contracts.test.ts` e `packages/shared/src/assistente/assistente.test.ts` cobrem o contrato e o `rotuloDaFonte`, com os quatro formatos do texto e o caso sem a linha.
- `apps/api/src/artefato/pdf-do-artefato.test.ts` cobre o rodapé e a lista do plano.
- Do lado da tela, `Artefato.test.tsx` tem os cinco casos do chip, `pecas-revestidas.test.tsx` tem três casos e o sem fontes, e `source-labels.test.ts` e `ResultadoDaFerramenta.test.tsx` cobrem o resto.
- `e2e/artefato-fontes.spec.ts` tem cinco casos. O da resposta atrasada segura o pedido com um portão de verdade, e a divergência que ele implica está registrada.
- Rodei os sete arquivos de unidade e passaram todos (92 testes). Não rodei integração nem e2e: o portão já provou os blocos.

**Mutações:** conferi os blocos contra o `git diff`.
- Toda cláusula nova de `artefato.repository.ts`, `artefato.service.ts`, `pdf-do-artefato.ts`, `packages/shared/src/assistente/artefato.ts`, `source-labels.ts`, `Artefato.tsx` e `ResultadoDaFerramenta.tsx` tem bloco, e o teste citado em cada um chega à cláusula.
- O escopo `escolaId` do `fontesDosMateriais` tem dois blocos. A troca por `where escolaId` só é derrubada por `fontesDosMateriais([d.materialId])` voltar `Map` vazio, e esse caso existe.
- O documento justifica as linhas que o `--faltando` lista sem bloco: ou é condição que já existia e só trocou de argumento, ou é a guarda de teto do contrato, que conteúdo válido nunca alcança. A justificativa procede.
- Saiu a guarda `ids.length === 0`. O caso `fontesDosMateriais([])` com resultado `new Map()` prova o comportamento sem ela.

**Outros pontos:**
- Não há `.skip`, teste comentado nem mock de coisa nossa na integração.
- A web usa a rede falsa, que é a fronteira certa ali.
- Nenhum teste chama provedor de IA pago.
- A tarefa é só de leitura, então não pede teste de concorrência.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/api/src/artefato/artefato.int.test.ts:478-497`: o cenário diz "seguem com título e edição", mas o material licenciado é enviado sem edição, e a asserção confere `edicao: null`. Dar uma edição a ele (por exemplo `update material set edicao = '2025'`) antes de vencer a licença faria o caso provar também a edição.
2. Mesmo caso, linha 478: o cenário se chama "rascunho", mas o artefato do teste é comum. Se "rascunho" quer dizer a versão adaptada pendente, que sai em PDF marcado como rascunho, ainda falta um caso pela rota que junte essa versão, as `fontes` e a licença vencida. Vale deixar claro no `cenarios.md` qual dos dois sentidos vale.
3. A divergência diz "na ordem da primeira citação". Nenhum caso de integração cita dois materiais diferentes, então uma mutação que reordenasse os ids passaria. Um caso com um plano que cite dois materiais, em ordem conhecida, fecha isso. A ordem só aparece em `source-labels.test.ts`, que testa outra peça.
4. Autoconferência, pergunta 3: o plano fala em material de nome igual nas duas escolas, e o teste usa de propósito um título diferente para `d` (`TITULO_DA_OUTRA`). A escolha é melhor para enxergar o vazamento, mas a resposta da pergunta 3 no plano deveria dizer isso.
5. `e2e/artefato-fontes.spec.ts:109-128`: a troca de edição é gravada direto no banco (`substituirMaterialNoBanco`). A troca real, com o worker, está só na integração, e isso está registrado na divergência. Quando a tela de edição chegar, na 12.0, vale ter um e2e que passe por ela.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/pdf-do-artefato.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/contracts.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/assistente/assistente.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/professor/artefatos/Artefato.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/areas/professor/ferramentas/ResultadoDaFerramenta.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/components/ui/ai/pecas-revestidas.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/components/ui/ai/source-labels.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/e2e/artefato-fontes.spec.ts`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-13 22:51:51 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. A consulta lê `material`, que já tem `escolaId`. O artefato também já tem `escolaId`.

Queries verificadas:
- `ArtefatoRepository.fontesDosMateriais` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:135-142`). A guarda `ids.length === 0` voltou. O filtro `eq(material.escolaId, requireEscolaId())` continua vindo do contexto autenticado, não de parâmetro do cliente.
- Quem chama essa query é `fontesDoConteudo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.service.ts:56-60`), e só depois de `porId` em `ler` (linha 102-106). Os ids saem do conteúdo de um artefato que o professor já alcança. Um material que a consulta não acha vira "material da escola", e a resposta não diz se ele existe em outra escola.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.int.test.ts:446-448` a asserção agora confere as chaves (`[...deD.keys()]` igual a `[d.materialId]`), não mais só o tamanho. Sem o filtro por `escolaId`, `edicaoNova` entraria no mapa e o teste quebraria. O caso da linha 445 (`fontesDosMateriais([d.materialId])` no contexto de `c` deve dar `Map` vazio) também quebraria sem o filtro.

Correções da rodada anterior: nenhuma era exigida. As duas recomendações foram atendidas:
- A asserção do caso de isolamento passou a conferir a chave.
- O comentário do repository (linhas 127-133) agora separa a linha que o expurgo apagou do id de outra escola, e diz que a função só se chama depois do `porId`.

O resto do diff não altera nenhum escopo:
- Testes novos: a edição que continua na fonte com a licença vencida, a ordem da primeira citação com dois materiais, e o PDF de rascunho com fonte de "edição anterior".
- Comentários em `Artefato.test.tsx` e `source-labels.ts`.
- Mudanças em documentos.

Bloqueantes: nenhum

Recomendações:
- O caso novo de dois materiais (`artefato.int.test.ts`, linhas 503-516) muda `conteudo` direto pelo banco. Ele prova a ordem, mas não prova escopo. Se quiserem, um próximo caso pode pôr no `jsonb` o `materialId` de outra escola e conferir pela API que sai "material da escola", sem título nem edição.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-13 22:51:56 · `tasks/prd-ingestao-do-material/10_task.md`

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
- A recomendação da 1ª rodada foi atendida. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:136` voltou a ter a guarda `if (ids.length === 0) return new Map()`, então o artefato sem citação não vai mais ao banco. A query da linha 140 continua filtrando pela escola e pela chave primária do material, e a lista de ids é limitada pelas citações de um único artefato. Não há varredura nem falta de paginação.
- O mesmo arquivo ganhou nas linhas 131 a 133 um comentário que diz que `fontesDosMateriais` só pode ser chamado depois do `porId`. Essa ordem só fica garantida por convenção: um uso futuro fora do service leria o título de qualquer material da escola. Se aparecer um segundo lugar que chame a função, vale fazê-la receber o artefato já carregado em vez dos ids soltos. A observação é para a retro; hoje não há esse segundo uso.
- O restante do diff entre as duas rodadas não toca carga nem concorrência. São três testes de integração novos ou ajustados em `artefato.int.test.ts`, um teste em `pdf-do-artefato.test.ts`, comentários em `source-labels.ts`, `Artefato.test.tsx` e `e2e/artefato-fontes.spec.ts`, e mudanças em documentos. Os testes não chamam provedor pago.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-13 22:51:57 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

Esta é a rodada 2. Auditei só o diff entre as árvores `555746a9` e `b99a292d`. Os arquivos que importam para a regra 20 (`artefato.repository.ts`, `artefato.int.test.ts`, `source-labels.ts` e `pdf-do-artefato.test.ts`) estão iguais na árvore `b99a292d` e na cópia de trabalho.

Campos pessoais tocados: nenhum. O diff só mexe em dados de material (`titulo`, `edicao`, `substituido`) e em teste, comentário e documento.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- `fontesDosMateriais` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:135-142`) continua filtrando pela escola do contexto (`requireEscolaId()`). A guarda de lista vazia voltou e não muda o resultado.
- O método tem um só chamador, `artefato.service.ts:58`, e o comentário novo (l.131-133) diz que ele só pode rodar depois do `porId`.
- O teste de isolamento (`artefato.int.test.ts:447-448`) agora diz qual material foi achado: espera exatamente `[d.materialId]`, e não mais só a contagem.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: nenhuma ação do diff precisa dela. Não há leitura de dado de aluno, exportação, mudança de nota ou de permissão.

Envio externo: nenhum novo.

Seed/fixture: sintético. Os nomes usados são "Apostila licenciada", "Química 3 — Capítulo 2: Termoquímica" e "Título confidencial da escola D", e a edição '2025' é gravada pelo próprio teste.

Minhas recomendações da rodada 1:
1. **Comentário dizendo que o método só roda depois do `porId`:** feito, em `artefato.repository.ts:131-133`. O mesmo comentário também separa os dois casos que ficam fora do mapa: a linha que o expurgo apagou e o id de outra escola.
2. **Caixa diferente entre os dois "material da escola":** o motivo foi registrado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/components/ui/ai/source-labels.ts:21-26`. Unificar o texto ficou para o `TODO.md` e está anotado na tabela "Recomendações sem aplicar" do `10_task.md`. Não envolve LGPD.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-13 22:52:06 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa nem no diff da rodada 2. `artefato.service.ts` e `artefato.repository.ts` não citam `Nota` nem `lancadaPor`. Todos com autor humano? sim, porque não há nenhum caminho novo.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não mexe no fluxo de entrega nem no de aprovação. O PDF do rascunho continua com a marca e o aviso de IA de rascunho em toda página, e um caso novo agora prova isso.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim. Nada mudou aqui desde a rodada 1.
Bloqueantes: nenhum
Recomendações: nenhuma nova. A da rodada 1 foi atendida. O caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/pdf-do-artefato.test.ts:155-163` gera o rascunho com uma fonte de "edição anterior" e confere três coisas no mesmo PDF:
- `MARCA_DE_RASCUNHO` aparece em toda página;
- o rodapé diz `(2024, edição anterior)`;
- `AVISO_DE_IA_NO_RASCUNHO` aparece e a palavra "revisado" não.

O que conferi no diff da rodada 2:
- **Guarda de lista vazia em `fontesDosMateriais`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/artefato/artefato.repository.ts:136`): só evita a ida ao banco, e o resultado é o mesmo. O comentário novo (linhas 131-133) diz que a função só pode ser chamada depois do `porId`. É o que acontece: o único chamador está em `artefato.service.ts:58`, sobre um artefato já alcançado. Para a regra 70 é neutro.
- **Testes de integração** (`artefato.int.test.ts`): o caso de isolamento passou a conferir exatamente quais materiais voltam, não só quantos. Entrou um caso de dois materiais citados, na ordem da primeira citação, que um mutante pode derrubar. O caso da licença vencida agora tem edição e prova que o rodapé do PDF mantém `(2025)`. Nada disso cria nota, conceito ou sugestão de nota, e nada decide sobre aluno.
- **Comentários em `source-labels.ts`, `Artefato.test.tsx` e `e2e/artefato-fontes.spec.ts`, e os documentos** (`10_task.md`, `cenarios.md`, `techspec.md`): só explicação e rastreio. Nenhum deles toca as regras 70, D46, D55 ou D45.

O prompt não trouxe fotos da tela, então não houve achado visual a conferir.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-13 22:52:28 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: artefato com dado e artefato inexistente com escola vazia, cada um no computador e no celular). As fotos são da rodada 1. A mudança desde então em `apps/web` é só um comentário em `source-labels.ts` e uma linha de comentário em `Artefato.test.tsx`. O resto do diff é teste de API, o `if (ids.length === 0) return new Map()` no repository e documentação.
Estados: ok. Com dado: título, chip "IA", abas, chip de fonte "p. 2" e a linha "Fontes (1): … (2024, edição anterior), p. 2". Vazio: o card pontilhado "Este artefato não está disponível" diz o motivo possível e aponta para Criados. Carregando e erro não aparecem na vitrine. Pelo código e pelo `Artefato.test.tsx`, a tela do artefato tem `Carregando o artefato…` e `ErrorState`, e o chip não tem estado próprio (decisão registrada na Tech Spec §11, linha 10.0).
Acessibilidade: sem mudança de tela desde a rodada 1. O foco e o rótulo do chip de fonte já estavam aprovados.
Chromebook fraco: sem mudança de código de tela. A foto do computador tem 768 px, a página cabe na janela e nenhuma tela rola a 1366 × 768, então não há conflito com RF de "cabe".
Celular: a 360 px não há rolagem horizontal nem texto cortado. "Renomear", "Exportar em PDF" e "Pedir versão adaptada" ficam empilhados e legíveis, e a ação principal tem altura de 44 px ou mais. O texto da fonte quebra de linha dentro do bloco. Na foto longa, a barra inferior aparece no meio da página: é efeito da captura de página inteira, não defeito.
Ação oficial protegida: sim. A tarefa só mostra a fonte da citação e não aprova nem publica nada. A saída de IA segue com a marca "IA" e o avatar do Assistente. O PDF em rascunho mantém a marca e o aviso de IA, e o novo caso em `pdf-do-artefato.test.ts` prova que a marca de rascunho e o rodapé de "edição anterior" coexistem.
Bloqueantes: nenhum.
Recomendações:
- O título "Artefato" da tela de não disponível é termo interno. O ideal seria "Material gerado" ou "Criado". Já existia e está no `TODO.md`.
- A conversa e a Turma hoje (`apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts`) ficam sem "edição anterior". A tarefa já registra isso como divergência 4.
- Unificar "material da escola" (API) com "Material da escola" (tela). O comentário novo em `source-labels.ts` explica a diferença e a unificação está no `TODO.md`.
- A vitrine da escola cheia deveria montar também um artefato "material da escola" e a tela de edição com "edição anterior". Isso é de `tools/vitrine/` e da tarefa 12.0.

## test-engineer · 2ª rodada · APROVADO · 2026-11-13 22:52:33 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada. Esta rodada confere o diff r1→r2 e as três recomendações:
- a licença vencida com a edição gravada;
- dois materiais citados, na ordem da primeira citação e sem repetir;
- a Autoconferência.

Também entram o reforço no caso de isolamento e a guarda nova `ids.length === 0` no repository.

**Cobertos:**
- **Licença vencida com edição:** `apps/api/src/artefato/artefato.int.test.ts:479`. A edição `'2025'` entra pelo banco antes da geração. As `fontes` e o PDF (`Fonte: Apostila licenciada (2025), p.`) são conferidos antes e depois de a licença vencer. O caso agora prova que a licença vencida não tira a edição da fonte. Antes, com `edicao: null`, isso passava sem provar nada.
- **Dois materiais citados:** `artefato.int.test.ts:502`. O material de id maior é citado primeiro (`.sort().reverse()`), então uma ordenação por id falharia. A terceira questão repete o primeiro material, então tirar o `Set` também falharia. O bloco novo de mutação com `.sort()` no `artefato.service.ts` foi aceito pelo portão. Esse bloco junto com o caso fecha a cláusula "na ordem da primeira citação". A linha nova da tabela em `tasks/prd-ingestao-do-material/10_task.md` cita o caso pelo nome.
- **Isolamento do lado de `d`:** `artefato.int.test.ts:447`. A asserção passou de `.size).toBe(1)` para `[...deD.keys()]).toEqual([d.materialId])`, que confere qual material fica no mapa e não só quantos.
- **Vínculo encerrado:** o caso foi renomeado (`:468`) e a linha da tabela acompanha o nome novo.
- **Guarda `if (ids.length === 0) return new Map()`** (`apps/api/src/artefato/artefato.repository.ts`): está na seção "Cláusulas sem bloco", com motivo correto. É mutante equivalente: o `inArray` vazio do drizzle dá o mesmo resultado, a guarda só poupa a ida ao banco. O retorno é conferido em `artefato.int.test.ts:401`. Não é cláusula nova sem bloco e sem motivo.
- **Rascunho com fonte de "edição anterior"** (`apps/api/src/artefato/pdf-do-artefato.test.ts:155`): confere que a marca de rascunho aparece em toda página e que o rodapé com "edição anterior" sai no mesmo PDF, sem a palavra "revisado". As asserções são sobre o texto do PDF.
- **Comentários de "só a guarda"** no `Artefato.test.tsx` e no `e2e/artefato-fontes.spec.ts`: só documentam, e as asserções seguem iguais.
- Não há `.skip`, teste comentado nem mock da regra. Os testes de IA continuam no adaptador falso. Não há operação concorrente nova nesta rodada.

**Bloqueantes:** nenhum.

**Recomendações:**
- O caso "dois materiais citados" (`artefato.int.test.ts:502`) e outros do mesmo `describe` dependem do `edicaoNova`, gravado no caso "a troca de edição" (`:404`). Rodado sozinho com `-t`, o caso falha por estado ausente e não pela regra. O padrão já existia no bloco; vale anotar para a retro, ou recriar o estado num `beforeAll`.
- No mesmo caso, se o adaptador falso um dia gerar menos de três questões, o "sem repetir" deixa de ser exercitado ali, mas segue provado pelo caminho feliz (`:392`). Uma asserção `expect(conteudo.questoes).toHaveLength(3)` antes do `forEach` deixaria essa premissa explícita.
- Seguem as que já estão em `TODO.md` pela tabela "Recomendações sem aplicar":
  - um caso pela rota com a versão adaptada pendente, licença vencida e `fontes` juntas;
  - o e2e da 12.0 conferindo "edição anterior" pela tela de edição.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-13 22:52:46 · `tasks/prd-ingestao-do-material/10_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção exigida na 1ª rodada foi feita. A divergência do e2e "nova edição" agora aparece nos três documentos, com o mesmo texto:
- no `[E]` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md:236-243`;
- na linha "10.0" da §11 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md:205`;
- na tabela de divergências do `10_task.md:82`.

O texto diz que o e2e da 10.0 grava a troca no banco com `substituirMaterialNoBanco` (`e2e/artefato-fontes.spec.ts:124`). Diz também que o caminho completo, com o worker, é o caso "a troca de edição", que existe em `apps/api/src/artefato/artefato.int.test.ts:404`. E registra que o e2e da 12.0 não confere o artefato antigo.

O resto do diff fica dentro da tarefa:
- **Guarda de lista vazia:** voltou a `fontesDosMateriais`, com o comentário "só se chama depois do `porId`".
- **Caso novo "dois materiais citados":** cita primeiro o id maior, então uma ordenação por id falharia, e a mutação `.sort()` tem bloco.
- **Caso do vínculo:** agora prova a edição na linha "Fonte" do PDF depois que a licença vence.
- **PDF:** um caso novo prova o rascunho com "edição anterior".
- Os comentários dos casos "sem fontes" foram aplicados.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/web/src/components/ui/ai/source-labels.ts:21-26` e cinco linhas de "Recomendações sem aplicar" do `10_task.md` mandam ao `TODO.md`, mas o `TODO.md` ainda não tem nenhuma dessas linhas. O modelo da tarefa diz que esse destino é "a linha já escrita no commit da tarefa, e não promessa". A Mesa precisa garantir que essas linhas entrem no commit, ou o comentário no código fica apontando para nada.
- O `[E]` "nova edição, e o artefato antigo mostrando 'edição anterior'" agora está registrado como divergência, mas continua sem um caso que passe pela tela de edição da coordenação e depois abra o artefato antigo. O e2e da 12.0 é o lugar natural para isso, e hoje o `12_task.md` não o pede.
- No caso "dois materiais citados" (`artefato.int.test.ts`), o `citados[indice] ?? primeiro` esconde se a geração devolveu menos de três questões. Um `expect(conteudo.questoes).toHaveLength(3)` antes do `forEach` deixaria a premissa explícita.
