# Tarefa 1.0 — O Assistente, as ferramentas, o artefato e o Analista rodam por comando registrado, ainda no processo (42.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

Cada tarefa de IA que não é o Tutor deixa a closure e ganha um comando registrado, que relê do banco, pelo id da execução,
o que precisa (`preparar`) e grava o que produz (`concluir`). Ainda no processo da API; a 5.0 a leva ao worker. O que a
professora e a coordenação veem não muda.

## Contexto necessário

- `techspec.md` §1, §2 (linhas `apps/api/src/ia/` e `apps/api/src/{tutor,assistente,artefato,governanca}/`), §5 "O comando" e "O contexto no worker"
- `prd.md` RF1; §6; regras 00, 10, 30 (4, 6, 7), 40, 70 (2a, 3)
- `tasks/prd-reengenharia/onda-3a.md` "T9 — o Command por tarefa (42.0)" e "O contexto no worker"
- Código: `apps/api/src/ia/execucao.scheduler.ts` (o `ExecucaoRequest` e o `agendar`, com `entrada` e `aoConcluir` por closure);
  os chamadores `apps/api/src/assistente/assistente.service.ts:97`, `apps/api/src/artefato/ferramentas.service.ts:89` e `:100`,
  `apps/api/src/artefato/artefato.service.ts:162`, `apps/api/src/governanca/analista.service.ts:64`;
  `packages/core/src/ia/tasks/index.ts`; `packages/core/src/ia/prompts/`

## Subtarefas

- [x] 1.1 — **Caracterização, num commit antes** (hash anotado na seção "Divergências"): um teste fixa as mensagens e o hash
  de cada `PROMPT_*` contra a `versao` da tarefa; outro fixa que a entrega do assistente e a do artefato adaptado nascem
  `pendente`, sem autor de decisão
- [x] 1.2 — `ExecucaoCommand<E, S>` (`tarefa`, `fila`, `preparar(execucao)` → `{ entrada, lido, alunoId?, turmaId? }`,
  `concluir(saida, lido, tx, execucaoId)`) e o registro, em `apps/api/src/ia/`; o `agendar` aceita o comando e o `aoGravar`
- [x] 1.3 — Comandos no módulo dono: as duas ferramentas e a adaptação (`artefato/`), `propor_ferramenta` (`assistente/`),
  o Analista (`governanca/`). O `preparar` relê a execução no escopo e repete o alcance do `POST` e a suspensão; `lido` tipado
- [x] 1.4 — O `aoGravar` fica na requisição (a mensagem de quem pediu, na mesma transação do `pendente`)
- [x] 1.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/execucao-command.ts`, `apps/api/src/ia/registro-de-comandos.ts`, `apps/api/src/artefato/ferramentas.command.ts`, `apps/api/src/artefato/adaptacao.command.ts`, `apps/api/src/assistente/proposta.command.ts`, `apps/api/src/governanca/analista.command.ts`, `apps/api/src/ia/contexto-da-tarefa.ts` (a série e a disciplina da tarefa, que a proposta e a geração dividem), `packages/core/src/ia/prompts/prompts-caracterizados.test.ts` | novo |
| `apps/api/src/ia/execucao.scheduler.ts`, `apps/api/src/ia/ia.module.ts`, `apps/api/src/artefato/ferramentas.service.ts`, `apps/api/src/artefato/artefato.service.ts`, `apps/api/src/artefato/artefato.module.ts`, `apps/api/src/assistente/assistente.service.ts`, `apps/api/src/assistente/assistente.module.ts`, `apps/api/src/governanca/analista.service.ts`, `apps/api/src/governanca/governanca.module.ts`, `apps/api/src/ia/ia.int.test.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `apps/api/src/assistente/assistente.int.test.ts`, `apps/api/src/governanca/analista.int.test.ts`, `apps/api/src/entrega/entrega.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| hash de cada prompt | U | mensagens e hash batem com a `versao`, antes e depois da troca. Mutação: mudar um prompt sem mudar a `versao` | `packages/core/src/ia/prompts/prompts-caracterizados.test.ts` › "a tabela cobre toda tarefa do catálogo, e só elas" e "a mensagem de sistema bate com o hash e a versão da tarefa" (um por tarefa) |
| entrega `pendente` | I | a do assistente e a do artefato adaptado nascem `pendente`, sem autor, antes e depois | `apps/api/src/entrega/entrega.int.test.ts` › "a versão adaptada nasce pendente, sem autor de decisão: a execução que a criou não aprova" e "caracterização do comando: a conversa do Assistente e a geração da atividade concluem sem entrega nem decisão (só a adaptação cria entrega, e pendente)" |
| caminho feliz, um por comando | I | a atividade, o plano, a adaptação, a proposta e o resumo do Analista saem como hoje, pela rota | atividade e adaptação: `artefato.int.test.ts` › "a professora pede no chat, aceita a proposta, gera a atividade…"; plano: › "caminho feliz: as fontes dizem o título e a edição…"; proposta: `assistente.int.test.ts` › "o envio grava a pergunta e a execução juntas…"; resumo: `analista.int.test.ts` › "aprovado o lote da colega, a Química tem duas professoras com dado…"; o agendador: `ia.int.test.ts` › "o agendador roda o comando…" |
| `preparar` relê pelo id | I | a execução gravada com parâmetros diferentes dos da rota produz pelos gravados | `artefato.int.test.ts` › "a atividade e o plano saem pelos parâmetros gravados…" e "a adaptação sai pelos tipos gravados…"; `assistente.int.test.ts` › "a execução produz pelo que ficou gravado…"; `ia.int.test.ts` › "o comando relê a execução pelo id: a da pessoa, no escopo…" |
| sem alcance no `preparar` | I | artefato, turma ou material fora do alcance, vínculo encerrado, função suspensa depois do `202`: `NAO_ENCONTRADO` (ou `FUNCAO_SUSPENSA`), sem modelo nem `consumo_ia`. O `consumo_ia` é conferido nos casos de `artefato.int.test.ts` (o da função suspensa e o do isolamento, por contagem antes e depois) e de `assistente.int.test.ts` (o da pergunta que saiu da conversa e o da função suspensa); o de `ia.int.test.ts` prova só "nem leitura, nem modelo". Mutação: sem a conferência | `artefato.int.test.ts` › "quem perdeu o vínculo depois do 202 não recebe o artefato…" (as ferramentas), "o vínculo encerrado depois do 202, na adaptação…", "a função suspensa depois do 202, nas três tarefas do módulo…" e "edição trocada entre o 202 e a execução…"; `assistente.int.test.ts` › "depois do 202, a pergunta que saiu da conversa…", "a função suspensa depois do 202 não chega ao `preparar`…" e "quem perdeu o vínculo depois do 202…"; `ia.int.test.ts` › "depois do 202, a função suspensa, a execução que saiu do alcance…" |
| isolamento | I | entrada gravada que cita turma ou material da B, lida no contexto da A: `NAO_ENCONTRADO`, nada da B é lido | `artefato.int.test.ts` › "a entrada gravada que cita a turma, o artefato ou a disciplina de quem a pessoa não alcança…"; `ia.int.test.ts` › "o comando relê a execução pelo id: a da pessoa, no escopo…" (a de B, a do colega, a de outro ano); a proposta: `assistente.int.test.ts` › "a pergunta lida é a da própria professora…" (a linha na thread da colega e a que aponta para a turma da colega; a de outra escola nem existe, porque a turma e a thread vão por FK composta com a escola) |
| a conclusão confere a saída | I | geração: contrato, marca de adaptação, citação entregue, `MATERIAL_INSUFICIENTE` antes do modelo, ordem dos trechos e quantidade padrão; adaptação: contrato e origem que some; proposta: citação, contrato e turma da pergunta | `artefato.int.test.ts` › "sem trecho do material, o comando falha com MATERIAL_INSUFICIENTE…", "a tarefa recebe os trechos na ordem do material…", "a saída da geração que não cabe no contrato…", "a adaptação leva ao modelo só o que foi pedido…", "o artefato de origem que some entre o modelo e a gravação…" e "o conteúdo gravado que não lê como atividade é CONFLITO…"; `assistente.int.test.ts` › "a conversa anterior acompanha a nova como turnos…", "o turno anterior longo vai cortado no teto da tarefa" e "a saída que cita página que não foi entregue…" |
| o agendador e o registro | I | o comando é achado pelo nome da tarefa, o resultado que ele devolve é validado antes de concluir, a tarefa sem comando (o Tutor) segue pela closure, e a API sobe com os cinco comandos | `ia.int.test.ts` › "o registro não aceita a mesma tarefa duas vezes…", "o resultado que o comando devolve é validado antes de concluir…", "a tarefa sem comando roda pela closure do pedido…", "a API sobe com o comando de cada tarefa que não é do Tutor…", "o pedido com a entrada gravada de outra tarefa é defeito de quem chama…" |
| o Analista monta no contexto de quem pediu | I | o período preso ao ano, o ano de outra escola, os tetos, a habilidade sem descrição e o recorte sem resposta | `analista.int.test.ts` › "o período vai do começo do ano até hoje…", "o ano letivo que não é da escola do contexto não é achado…", "os tetos das listas, a habilidade sem descrição…" |
| D55 na proposta | I | `propor_ferramenta` com nota na saída continua recusada (`assistente.int.test.ts`) | `assistente.int.test.ts` › "pedido de corrigir e dar nota a uma redação é recusado por regra fixa…" |
| log | I | a linha da execução leva ids, tarefa e código; nunca entrada nem texto (regra 20, item 9). O comando não escreve linha nova (ver Divergências) | `assistente.int.test.ts` › "a descrição de um aluno no pedido não vai para execução, consumo, artefato, auditoria, log nem para a resposta" |

## Como testar

- Precedente da rota: `apps/api/src/artefato/artefato.int.test.ts` › "a professora pede no chat, aceita a proposta, gera a
  atividade…" (fim a fim pelo agendador de hoje); a entrega `pendente`: `apps/api/src/entrega/entrega.int.test.ts` › "a versão
  adaptada nasce pendente, sem autor de decisão…"
- O executor do processo é trocado nas suítes por `EXECUTOR_DE_AGENTE` (`ia.module.ts`); mantenha: a bancada da fila é da 5.0
- Hash: `createHash('sha256')`, como `packages/core/src/ia/golden-seal.test.ts` › "a pasta real confere com o SELO.json"
- Isolamento: `apps/api/test/escola-assistente.fixture.ts` para as duas escolas
- Comando: `npx vitest run --project integracao apps/api/src/artefato/artefato.int.test.ts`
- Armadilha (retro da F4): o teste cria a condição — a função suspensa entre o `202` e o `preparar` se grava no próprio
  caso, pelo helper `suspender`, que insere a linha em `suspensao_de_funcao`, e não herdada de outro caso

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada cláusula do
`preparar` (alcance, suspensão, escopo) é um bloco. Na 9: o `AgenteExecutor` e o `runInContext` já existem; não reescreva.

### Respostas (plano da 1.0)

1. As cláusulas do diff estão na seção "Mutações": cada termo das condições compostas tem bloco ou motivo.
2. Sem tela: não se aplica.
3. O segundo dado: a escola B (turma, disciplina, artefato) lida no contexto da A; o artefato de A com tipos diferentes dos do corpo; dois materiais de ids diferentes na busca; conversa com histórico e sem.
4. O caso cria a condição de que depende: a função suspensa pelo repository de suspensão entre o `202` e o `preparar`, o artefato apagado dentro do modelo, a linha editada por SQL com o executor segurando a execução (`liberar()`); o dublê do modelo recebe a entrada que o comando monta.
5. As asserções olham o que o modelo recebeu (a entrada guardada) e o que o banco tem, e não a forma do código; as de ausência esperam o estado final da execução antes.
6. Sem guarda nova (nenhuma regra de lint nem teste estrutural).
7. Comentários revistos: os de `execucao.scheduler.ts`, dos comandos e dos services descrevem o comando registrado.
8. As divergências estão na seção própria, e na `techspec.md` §5; o `prd.md` não diz o contrário.
9. Reaproveitado: `AgenteExecutor`, `runInContext`, `ExecucaoDaSessaoRepository`, `TurmaDoProfessorRepository`, `ConversaRepository`, `ArtefatoRepository` e `EntregaRepository`; o que moveu (conferência do artefato, constantes) foi movido, e não copiado.
10. A chave de envio duas vezes ao mesmo tempo segue coberta pelos casos de idempotência existentes (`assistente.int.test.ts`, `artefato.int.test.ts`, `analista.int.test.ts`, `ia.int.test.ts`); a conclusão que perde para o prazo, por "a versão adaptada e a entrega nascem juntas ou não nascem…".
11. Cada linha da tabela tem o caso na coluna "Caso".
12. Guardiões lidos: `tenancy-guardian` (escopo no repository, `NAO_ENCONTRADO` igual), `conformidade-reviewer` (entrega `pendente`, D55), `llm-integrator` (prompt versionado e caracterizado, saída validada).

## Fora do escopo desta tarefa

O Tutor e a trava "toda tarefa tem comando" (2.0); o job, o worker e a fila (3.0, 5.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A 1.1 (caracterização) vai no mesmo commit da tarefa, e não num commit antes; não há hash anotado à parte | O hook de commit exige a rodada da Mesa e o carimbo do portão em todo commit `(tarefa N.0)`: um commit só de teste ficaria sem eles. A prova de que a caracterização vem antes: os dois testes (8 casos de prompt e 1 de entrega) rodaram verdes na árvore sem mudança de produção, no HEAD `d945054d` | `techspec.md` §5 "O comando" |
| A caracterização da entrega do assistente prova que a conversa e a geração concluem sem entrega, e só a adaptação cria entrega, `pendente` | O Assistente de ensino não cria entrega (a conversa é texto): não há "entrega do assistente" a fixar `pendente` | `techspec.md` §5 "O comando" |
| `ExecucaoDoPedidoRepository` (`assistente/execucao-do-pedido.repository.ts`) removido, e `artefato/conferencia.ts` entra entre os alterados | `paraExecutar(id)` do `ExecucaoDaSessaoRepository` o substitui (relê pelo id, e não pela chave); `atividadeOriginal` e `exigirMaterialEmUso` foram para a conferência, e as constantes do Assistente e do Analista para o arquivo do comando, para serviço e comando não as copiarem | `techspec.md` §5 "O comando" |
| Nenhuma linha de log nova: a linha "log novo" da tabela virou o caso que já prova que o log não leva texto | A linha da execução é a do executor (`ia.execucao.concluida`, `ia.execucao.falhou`), só com ids, tarefa e código; um log do comando repetiria a mesma informação | `techspec.md` §5 "O comando" |

## Mutações

--faltando: 2 linhas (83 blocos, 2 motivos). Cada bloco foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos num caso que rodou e falhou, e as asserções negativas (`toBeUndefined`, `.not.toEqual`, `toEqual(antes)`) levam o `falha:`. Os blocos tiram cada termo das condições compostas, cada chamada que confere (`exigirMaterialEmUso`, `exigirAdaptacaoFiel`, `exigirCitacoesEntregues`, `exigirFuncaoAtiva`) e o registro de cada comando no módulo dono.

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a entrada gravada que cita a turma
    const origem = await new ArtefatoRepository(this.banco).porId(gravada.artefatoId)
-   if (origem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos, ...(gravada.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: gravada.tempoExtraPercentual }) }
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a professora pede no chat, aceita a proposta
-   const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos, ...(gravada.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: gravada.tempoExtraPercentual }) }
+   const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos }
    const original = atividadeOriginal(origem)
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a adaptação leva ao modelo só o que foi pedido
-   const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos, ...(gravada.tempoExtraPercentual === undefined ? {} : { tempoExtraPercentual: gravada.tempoExtraPercentual }) }
+   const adaptacao: AdaptacaoAplicada = { tipos: gravada.tipos, tempoExtraPercentual: gravada.tempoExtraPercentual }
    const original = atividadeOriginal(origem)
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a adaptação leva ao modelo só o que foi pedido
    const adaptada = conteudoDeAtividadeSchema.safeParse(saida)
-   if (!adaptada.success) throw new LLMError('IA_SAIDA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › o artefato de origem que some entre o modelo e a gravação
    const origem = await new ArtefatoRepository(tx).porId(lido.artefatoId)
-   if (origem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    exigirAdaptacaoFiel(atividadeOriginal(origem), adaptada.data, lido.adaptacao)
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/artefato.int.test.ts › o conteúdo gravado que não lê como atividade é CONFLITO
-   if (lido.tipo !== 'atividade_objetiva' || lido.origemId !== null || !conteudo.success || conteudo.data.adaptacao !== undefined) throw new DomainException(ErrorCode.CONFLITO)
+   if (lido.tipo !== 'atividade_objetiva' || lido.origemId !== null || conteudo.data!.adaptacao !== undefined) throw new DomainException(ErrorCode.CONFLITO)
    return conteudo.data
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/artefato.int.test.ts › licença vencida: a adaptação é recusada
-   if (fora.licencaVencida) throw new DomainException(ErrorCode.LICENCA_VENCIDA)
    if (fora.substituido) throw new DomainException(ErrorCode.EDICAO_SUBSTITUIDA)
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/artefato.int.test.ts › edição substituída: a adaptação do artefato antigo
    if (fora.licencaVencida) throw new DomainException(ErrorCode.LICENCA_VENCIDA)
-   if (fora.substituido) throw new DomainException(ErrorCode.EDICAO_SUBSTITUIDA)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a entrada gravada que cita a turma
  const turma = await new TurmaDoProfessorRepository(banco).turmaComDisciplina(parametros.turmaId, parametros.disciplinaId)
- if (turma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › sem trecho do material, o comando falha com MATERIAL_INSUFICIENTE
- if (achados.length === 0) throw new LLMError('MATERIAL_INSUFICIENTE')
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a tarefa recebe os trechos na ordem do material
- const entregues = [...achados].sort((a, b) => a.materialId.localeCompare(b.materialId) || a.pagina - b.pagina)
+ const entregues = [...achados].sort((a, b) => a.pagina - b.pagina)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a tarefa recebe os trechos na ordem do material
- const entregues = [...achados].sort((a, b) => a.materialId.localeCompare(b.materialId) || a.pagina - b.pagina)
+ const entregues = [...achados].sort((a, b) => a.materialId.localeCompare(b.materialId))
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a saída da geração que não cabe no contrato
- if (!conteudo.success || (conteudo.data.tipo === 'atividade_objetiva' && conteudo.data.adaptacao !== undefined)) throw new LLMError('IA_SAIDA_INVALIDA')
+ if (conteudo.data!.tipo === 'atividade_objetiva' && conteudo.data!.adaptacao !== undefined) throw new LLMError('IA_SAIDA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a saída da geração que não cabe no contrato
- if (!conteudo.success || (conteudo.data.tipo === 'atividade_objetiva' && conteudo.data.adaptacao !== undefined)) throw new LLMError('IA_SAIDA_INVALIDA')
+ if (!conteudo.success) throw new LLMError('IA_SAIDA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a tarefa recebe os trechos na ordem do material
- entrada: { tema: lido.parametros.tema, quantidade: lido.parametros.quantidade ?? QUESTOES_PADRAO_POR_ATIVIDADE, contexto: lido.contexto, habilidades: lido.habilidades, trechos: trechosDaTarefa(lido) },
+ entrada: { tema: lido.parametros.tema, quantidade: lido.parametros.quantidade as number, contexto: lido.contexto, habilidades: lido.habilidades, trechos: trechosDaTarefa(lido) },
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a conversa anterior acompanha a nova como turnos
- const texto = mensagem.autor === 'usuario' ? conteudoDaMensagemDoUsuarioSchema.parse(mensagem.conteudo).texto : conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo).texto
+ const texto = conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo).texto as string
  return { autor: mensagem.autor === 'usuario' ? 'professor' : 'assistente', texto: texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a conversa anterior acompanha a nova como turnos
  const texto = mensagem.autor === 'usuario' ? conteudoDaMensagemDoUsuarioSchema.parse(mensagem.conteudo).texto : conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo).texto
- return { autor: mensagem.autor === 'usuario' ? 'professor' : 'assistente', texto: texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }
+ return { autor: mensagem.autor === 'usuario' ? 'assistente' : 'professor', texto: texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › depois do 202, a pergunta que saiu da conversa
    const pergunta = await conversa.perguntaDaChave(execucao.chaveEnvio)
-   if (pergunta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const turma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(pergunta.turmaId, pergunta.disciplinaId)
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › depois do 202, a pergunta que saiu da conversa
    const turma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(pergunta.turmaId, pergunta.disciplinaId)
-   if (turma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › depois do 202, a pergunta que saiu da conversa
- if (!(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId: pergunta.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
    const mensagem = conteudoDaMensagemDoUsuarioSchema.parse(pergunta.conteudo).texto
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a conversa anterior acompanha a nova como turnos
- const procurado = semProposta && ultimoPedido !== undefined ? `${ultimoPedido} ${mensagem}` : mensagem
+ const procurado = ultimoPedido !== undefined ? `${ultimoPedido} ${mensagem}` : mensagem
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a conversa anterior acompanha a nova como turnos
- const procurado = semProposta && ultimoPedido !== undefined ? `${ultimoPedido} ${mensagem}` : mensagem
+ const procurado = semProposta ? `${ultimoPedido ?? ''} ${mensagem}` : mensagem
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a conversa anterior acompanha a nova como turnos
        turnosAnteriores,
-       ...(semProposta ? { semProposta } : {}),
+       semProposta,
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a execução produz pelo que ficou gravado
        turnosAnteriores,
-       ...(semProposta ? { semProposta } : {}),
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a saída que cita página que não foi entregue
- if (saida.tipo === 'texto') exigirCitacoesEntregues(saida.citacoes, entregues)
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a saída que cita página que não foi entregue
    const conteudo = conteudoDaMensagemDoAgenteSchema.safeParse(
-     saida.tipo === 'texto' ? saida : { ...saida, proposta: { ferramenta: saida.proposta.ferramenta, parametros: { ...saida.proposta.parametros, turmaId: pergunta.turmaId, disciplinaId: pergunta.disciplinaId } } },
+     saida,
    )
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a saída que cita página que não foi entregue
    )
-   if (!conteudo.success) throw new LLMError('IA_SAIDA_INVALIDA')
    return { tipo: 'mensagem', mensagemId: await new ConversaRepository(tx).gravarDoAgente(pergunta.threadId, execucaoId, conteudo.data) }
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › os tetos das listas
- const percentual = (acertos: number, total: number): number => (total === 0 ? 0 : Math.round((acertos * 1000) / total) / 10)
+ const percentual = (acertos: number, total: number): number => Math.round((acertos * 1000) / total) / 10
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › o ano letivo que não é da escola
    const periodoDoAno = await analista.periodoDoAno()
-   if (periodoDoAno === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const hoje = diaDeUso(this.relogio.agora())
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › o período vai do começo do ano
- const fim = hoje < periodoDoAno.inicio ? periodoDoAno.inicio : hoje > periodoDoAno.fim ? periodoDoAno.fim : hoje
+ const fim = hoje > periodoDoAno.fim ? periodoDoAno.fim : hoje
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › o período vai do começo do ano
- const fim = hoje < periodoDoAno.inicio ? periodoDoAno.inicio : hoje > periodoDoAno.fim ? periodoDoAno.fim : hoje
+ const fim = hoje < periodoDoAno.inicio ? periodoDoAno.inicio : hoje
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › com duas professoras alocadas em Química
- if (quantos < GRUPO_MINIMO_DE_PROFESSORES) {
+ if (quantos < GRUPO_MINIMO_DE_PROFESSORES - 1) {
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › os tetos das listas
- if (recortesNominais.length < MAXIMO_DE_RECORTES) recortesNominais.push(identificacao)
+ recortesNominais.push(identificacao)
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › os tetos das listas
- if (recortes.length >= MAXIMO_DE_RECORTES) continue
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › os tetos das listas
- const doRecorte = acertos.filter((linha) => chaveDoRecorte(linha.serieId, linha.disciplinaId) === chave && linha.total > 0)
+ const doRecorte = acertos.filter((linha) => chaveDoRecorte(linha.serieId, linha.disciplinaId) === chave)
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › aprovado o lote da colega
- const doRecorte = acertos.filter((linha) => chaveDoRecorte(linha.serieId, linha.disciplinaId) === chave && linha.total > 0)
+ const doRecorte = acertos.filter((linha) => linha.total > 0)
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › os tetos das listas
- porHabilidade: doRecorte.slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE).map((linha) => ({ habilidade: { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) ?? linha.codigo }, acertos: linha.acertos, total: linha.total })),
+ porHabilidade: doRecorte.slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE).map((linha) => ({ habilidade: { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) as string }, acertos: linha.acertos, total: linha.total })),
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › com duas professoras alocadas em Química
- sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
+ sinais: { travou: sinais.get('travou') as number, resposta_pronta: sinais.get('resposta_pronta') as number, duvida_repetida: sinais.get('duvida_repetida') as number, atencao_humana: sinais.get('atencao_humana') as number },
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
-       ...(alunoId === undefined ? {} : { alunoId }),
        ...(turmaId === undefined ? {} : { turmaId }),
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
        ...(alunoId === undefined ? {} : { alunoId }),
-       ...(turmaId === undefined ? {} : { turmaId }),
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
falha: .not.toEqual(expect.arrayContaining(['alunoId']))
-       ...(alunoId === undefined ? {} : { alunoId }),
+       alunoId,
        ...(turmaId === undefined ? {} : { turmaId }),
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
falha: .not.toEqual(expect.arrayContaining(['turmaId']))
        ...(alunoId === undefined ? {} : { alunoId }),
-       ...(turmaId === undefined ? {} : { turmaId }),
+       turmaId,
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/ia.int.test.ts › o registro não aceita a mesma tarefa duas vezes
-   if (this.comandos.has(executavel.tarefa)) throw new InvariantException('a tarefa já tem comando registrado')
```

```mutacao
arquivo: apps/api/src/ia/registro-de-comandos.ts
teste: apps/api/src/ia/ia.int.test.ts › o registro não aceita a mesma tarefa duas vezes
    const comando = this.comandos.get(tarefa)
-   if (comando === undefined) throw new InvariantException('a tarefa não tem comando registrado')
+   if (comando === undefined) return undefined as never
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › o comando relê a execução pelo id
falha: .toBeUndefined()
-     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
+     .where(and(eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
    if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › o comando relê a execução pelo id
falha: .toBeUndefined()
-     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
+     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
    if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › o comando relê a execução pelo id
falha: .toBeUndefined()
-     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
+     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id)))
    if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › o comando relê a execução pelo id
-     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.id, id), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
+     .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.anoLetivoId, requireAnoEmCurso()), eq(execucaoAgente.solicitadaPor, requireUsuarioId())))
    if (linha === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › o comando relê a execução pelo id
falha: .toBeUndefined()
-   if (linha === undefined) return undefined
    const entrada = execucaoInputSchema.safeParse(linha.entrada)
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › o comando relê a execução pelo id
falha: .toBeUndefined()
    const entrada = execucaoInputSchema.safeParse(linha.entrada)
-   if (!entrada.success) return undefined
    return { id: linha.id, tarefa: linha.tarefa, chaveEnvio: linha.chaveEnvio, entrada: entrada.data }
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › o pedido com a entrada gravada de outra tarefa é defeito de quem chama
-   if (entradaDaExecucao.tarefa !== alvo.tarefa) throw new LLMError('IA_ENTRADA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › o pedido com a entrada gravada de outra tarefa é defeito de quem chama
-     if (existente.tarefa !== alvo.tarefa) throw new DomainException(ErrorCode.CONFLITO)
      return existente.id
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a versão adaptada e a entrega nascem juntas ou não nascem
falha: .toEqual(antes)
-             if (!(await new ExecucaoRepository(tx).concluirRodando(execucao, resultado))) throw new LLMError('IA_TEMPO_ESGOTADO')
+             await new ExecucaoRepository(tx).concluirRodando(execucao, resultado)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
-   if ('comando' in pedido) {
+   if (!('comando' in pedido)) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › depois do 202, a função suspensa
-   if (lida === undefined || lida.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+   if (lida!.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return comando.executar(lida, this.ia, sinal, gravar)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › depois do 202, a função suspensa
-   if (lida === undefined || lida.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+   if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return comando.executar(lida, this.ia, sinal, gravar)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › a tarefa sem comando roda pela closure do pedido
-     const entrada = typeof pedido.entrada === 'function' ? await (pedido.entrada as () => Promise<Entrada>)() : pedido.entrada
+     const entrada = pedido.entrada as Entrada
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › a tarefa sem comando roda pela closure do pedido
-       ...(pedido.alunoId === undefined ? {} : { alunoId: pedido.alunoId }),
        ...(pedido.turmaId === undefined ? {} : { turmaId: pedido.turmaId }),
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › a tarefa sem comando roda pela closure do pedido
        ...(pedido.alunoId === undefined ? {} : { alunoId: pedido.alunoId }),
-       ...(pedido.turmaId === undefined ? {} : { turmaId: pedido.turmaId }),
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › edição trocada entre o 202 e a execução
    const original = atividadeOriginal(origem)
-   await exigirMaterialEmUso(new ArtefatoRepository(this.banco), original)
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a saída que muda o gabarito é recusada
-   exigirAdaptacaoFiel(atividadeOriginal(origem), adaptada.data, lido.adaptacao)
```

```mutacao
arquivo: apps/api/src/artefato/ferramentas.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a saída que cita página que não foi entregue à tarefa é recusada
- exigirCitacoesEntregues(citacoesDoConteudo(conteudo.data), entregues)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › depois do 202, a função suspensa
-   await exigirFuncaoAtiva(this.suspensao, comando.funcao)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › função suspensa recusa antes de gravar
-   await exigirFuncaoAtiva(this.suspensao, alvo.funcao)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › o resultado que o comando devolve é validado antes de concluir
-             const resultado = resultadoGravadoSchema.parse(await gravarNaTransacao(tx, execucaoId))
+             const resultado = (await gravarNaTransacao(tx, execucaoId)) as never
```

```mutacao
arquivo: apps/api/src/artefato/artefato.module.ts
teste: apps/api/src/ia/ia.int.test.ts › a API sobe com o comando de cada tarefa que não é do Tutor
-      useFactory: (banco: Database, trechos: TrechoSearch, registro: RegistroDeComandos) => comRegistro(registro, new GerarAtividadeObjetivaCommand(banco, trechos)),
+      useFactory: (banco: Database, trechos: TrechoSearch, registro: RegistroDeComandos) => new GerarAtividadeObjetivaCommand(banco, trechos),
```

```mutacao
arquivo: apps/api/src/artefato/artefato.module.ts
teste: apps/api/src/ia/ia.int.test.ts › a API sobe com o comando de cada tarefa que não é do Tutor
-      useFactory: (banco: Database, trechos: TrechoSearch, registro: RegistroDeComandos) => comRegistro(registro, new GerarPlanoDeAulaCommand(banco, trechos)),
+      useFactory: (banco: Database, trechos: TrechoSearch, registro: RegistroDeComandos) => new GerarPlanoDeAulaCommand(banco, trechos),
```

```mutacao
arquivo: apps/api/src/artefato/artefato.module.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a professora pede no chat, aceita a proposta
-    { provide: AdaptarAtividadeCommand, useFactory: (banco: Database, registro: RegistroDeComandos) => comRegistro(registro, new AdaptarAtividadeCommand(banco)), inject: [DB, RegistroDeComandos] },
+    { provide: AdaptarAtividadeCommand, useFactory: (banco: Database, registro: RegistroDeComandos) => new AdaptarAtividadeCommand(banco), inject: [DB, RegistroDeComandos] },
```

```mutacao
arquivo: apps/api/src/assistente/assistente.module.ts
teste: apps/api/src/assistente/assistente.int.test.ts › o envio grava a pergunta e a execução juntas
-          useFactory: (banco: Database, trechos: TrechoSearch, registro: RegistroDeComandos) => comRegistro(registro, new ProporFerramentaCommand(banco, trechos)),
+          useFactory: (banco: Database, trechos: TrechoSearch, registro: RegistroDeComandos) => new ProporFerramentaCommand(banco, trechos),
```

```mutacao
arquivo: apps/api/src/governanca/governanca.module.ts
teste: apps/api/src/governanca/analista.int.test.ts › aprovado o lote da colega
-    { provide: ResumoDoAnalistaCommand, useFactory: (banco: Database, registro: RegistroDeComandos) => comRegistro(registro, new ResumoDoAnalistaCommand(banco)), inject: [DB, RegistroDeComandos] },
+    { provide: ResumoDoAnalistaCommand, useFactory: (banco: Database, registro: RegistroDeComandos) => new ResumoDoAnalistaCommand(banco), inject: [DB, RegistroDeComandos] },
```

```mutacao
arquivo: apps/api/src/assistente/assistente.service.ts
teste: apps/api/src/assistente/assistente.int.test.ts › o envio grava a pergunta e a execução juntas
        const conversa = new ConversaRepository(tx)
-       await conversa.gravarDoUsuario(await conversa.garantirThread(), execucaoId, { texto: pedido.texto, turmaId, disciplinaId })
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › a coordenação de B não lê o resumo de A
- sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
+ sinais: { travou: sinais.get('travou') as number, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › com duas professoras alocadas em Química
- sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
+ sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') as number, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › com duas professoras alocadas em Química
- sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
+ sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') as number, atencao_humana: sinais.get('atencao_humana') ?? 0 },
```

```mutacao
arquivo: apps/api/src/governanca/analista.command.ts
teste: apps/api/src/governanca/analista.int.test.ts › a coordenação de B não lê o resumo de A
- sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
+ sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') as number },
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
-       escolaId: requireEscolaId(),
        execucaoId: execucao.id,
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/ia.int.test.ts › o agendador roda o comando
        escolaId: requireEscolaId(),
-       execucaoId: execucao.id,
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a conversa anterior acompanha a nova como turnos
-   const turnosAnteriores = (await conversa.anteriores(pergunta.id, TURNOS_ANTERIORES_NA_CONVERSA)).reverse().map(turnoAnterior)
+   const turnosAnteriores = (await conversa.anteriores(pergunta.id, TURNOS_ANTERIORES_NA_CONVERSA)).map(turnoAnterior)
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/src/artefato/artefato.int.test.ts › a professora pede no chat, aceita a proposta
-   return { entrada: { conteudo: original, adaptacao }, lido: { original, adaptacao, artefatoId: origem.id } }
+   return { entrada: { conteudo: undefined as never, adaptacao }, lido: { original, adaptacao, artefatoId: origem.id } }
```

```mutacao
arquivo: apps/api/src/assistente/proposta.command.ts
teste: apps/api/src/assistente/assistente.int.test.ts › o turno anterior longo vai cortado
- return { autor: mensagem.autor === 'usuario' ? 'professor' : 'assistente', texto: texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }
+ return { autor: mensagem.autor === 'usuario' ? 'professor' : 'assistente', texto }
```

```mutacao
arquivo: apps/api/src/artefato/conferencia.ts
teste: apps/api/src/artefato/artefato.int.test.ts › só atividade objetiva se adapta
- if (lido.tipo !== 'atividade_objetiva' || lido.origemId !== null || !conteudo.success || conteudo.data.adaptacao !== undefined) throw new DomainException(ErrorCode.CONFLITO)
+ if (!conteudo.success) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts › o vínculo encerrado depois do 202, na adaptação
      eq(artefato.anoLetivoId, requireAnoEmCurso()),
-     comVinculoConfirmadoDoProfessor(this.banco, { escolaId: artefato.escolaId, anoLetivoId: artefato.anoLetivoId, turmaId: artefato.turmaId }, artefato.disciplinaId),
    )
```

```mutacao
arquivo: apps/api/src/assistente/conversa.repository.ts
teste: apps/api/src/assistente/assistente.int.test.ts › a pergunta lida é a da própria professora
          eq(execucaoAgente.solicitadaPor, usuarioId),
-         eq(threadAgente.usuarioId, usuarioId),
          eq(threadAgente.agente, AGENTE),
```

Termos e linhas sem bloco próprio, com o motivo de cada um (o `--faltando` lista só as duas primeiras):

| Linha | Motivo |
|---|---|
| `execucao-command.ts:41` e `:42` (`EntradaDaTarefa`, `SaidaDaTarefa`) | Tipos condicionais: só existem para o compilador e somem na execução. Quem prova é o `typecheck`: um comando com a entrada ou a saída da tarefa errada não compila |
| `conferencia.ts` (`atividadeOriginal`): os termos `lido.tipo !== 'atividade_objetiva'`, `lido.origemId !== null` e `conteudo.data.adaptacao !== undefined`, um a um | Cada um sozinho é coberto pelos outros: o conteúdo de um plano não lê como atividade, e o check `artefato_adaptacao_fechada` do banco liga `adaptacao` a `origem_id`, então a versão adaptada tem os dois. O bloco que tira os três juntos (e deixa só `!conteudo.success`) fica vermelho em "só atividade objetiva se adapta"; o termo `!conteudo.success` tem bloco próprio |
| `ferramentas.command.ts` (`gravarArtefato`): o termo `conteudo.data.tipo === 'atividade_objetiva' &&` | Estreitamento de tipo para o compilador: `adaptacao` só existe na atividade, e remover o termo não muda o comportamento. O termo `adaptacao !== undefined` e o `!conteudo.success` têm bloco |
| `ia/contexto-da-tarefa.ts` (`contextoDaTarefa`): o `.slice(0, 60)` da série e o da disciplina | A série tem no máximo o tamanho de `nomeDaSerie`, e o nome da disciplina é preso por `disciplina_nome_preenchido` no banco: o corte nunca chega a cortar, e é só o teto do schema da tarefa |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª), tenancy-guardian (1ª) | O `preparar` do Analista (`analista.command.ts`) não confere de novo, depois do `202`, se quem pediu ainda tem vínculo de coordenação | Tarefa 5.0: é quando o contexto passa a ser montado no worker a partir da linha; hoje o contexto da requisição segura e a saída é só agregado. Muda comportamento |
| tenancy-guardian (1ª), llm-integrator (1ª) | `proposta.command.ts`: ler a pergunta por `mensagem_agente.execucao_id` e não pela `chaveEnvio` | Tarefa 5.0 (o `preparar` vai ao worker). O escopo já está certo; trocar a consulta muda o repository |
| infra-guardian (1ª) | `paraExecutar` devolve `undefined` quando a `entrada` gravada não passa no schema, e vira `NAO_ENCONTRADO` sem sinal: contador ou log só com ids | `TODO.md`. Acrescenta linha de log/métrica, é comportamento novo |
| infra-guardian (1ª) | Medir quanto a releitura da suspensão somada à `paraExecutar` acrescenta à latência da fila `ferramenta` | Tarefa 5.0 (o comando roda no worker), junto da carga da 11.0 |
| infra-guardian (1ª) | `exigirMaterialEmUso` usa `systemClock` direto; injetar o relógio | Tarefa 5.0 (a adaptação vai ao worker). O código é o de antes, só mudou de arquivo |
| infra-guardian (1ª) | O campo `fila` de `ExecucaoCommand` ainda não é lido: precisa de teste de que o Analista (`normal`) não ocupa a `ferramenta` nem a `interativa` | Tarefa 3.0 (3.2, a fila `ferramenta` e as vagas) e 5.0, quando alguém passar a ler o campo |
| conformidade-reviewer (1ª) | `ExecucaoRequest` (closure) aceita qualquer `TaskDefinition`, não só a do Tutor | Tarefa 2.0 (objetivo: "Toda `TarefaDeIa` passa a ter comando, e o `ExecucaoRequest` perde as closures"; subtarefa 2.5) |
| conformidade-reviewer (1ª) | O `concluir` da adaptação não reconfere a suspensão antes de criar a entrega `pendente` | `TODO.md`. O revisor diz que não é violação (a entrega nasce pendente) e o código antigo também não conferia; acrescentaria uma falha nova no `concluir` |
| revisor-geral (1ª) | Os comandos leem a entrada gravada por `as Extract<ExecucaoInput, …>`; conferir o campo `tarefa` no comando | Tarefa 5.0, quando o `preparar` lê a linha no worker. Acrescenta uma falha nova em cada comando, com mutação própria; o agendador já recusa a entrada de outra tarefa (caso "o pedido com a entrada gravada de outra tarefa…") |
| revisor-geral (1ª) | Renomear `ExecucaoComComando.comando` para `tarefa` | Recusada agora: `comando` é o discriminador do pedido (`'comando' in pedido`, `execucao.scheduler.ts`) frente a `ExecucaoRequest`, que já tem `tarefa: TaskDefinition`; o nome `tarefa` colidiria. Refazer na 2.0 (2.5), quando o `ExecucaoRequest` perde as closures |
| revisor-geral (1ª) | `FilaDeIa` (`execucao-command.ts`) é um segundo lugar com nomes de fila | Tarefa 3.0 (3.2 põe `ferramenta` em `QUEUE_NAMES`); o tipo passa a vir de lá |
| revisor-geral (1ª) | `prompts-caracterizados.test.ts` fixa só `prompt.sistema`: `REGRAS_COMUNS` e o JSON Schema que o adaptador junta ficam de fora | `TODO.md` (área do `llm-integrator`, que aprovou sem pedir). A 1.1 pede o hash de cada `PROMPT_*`, e isso está provado |
| test-engineer (1ª) | Caso paralelo (`Promise.all`) pelo comando para a geração por ferramenta e para o Analista | Tarefa 5.0, linha "clique duplo" ("mesma `chaveEnvio` em `Promise.all`: uma execução, um job"); o caminho paralelo do Assistente e da adaptação já passa pelo comando |
| llm-integrator (1ª) | Guardar a estimativa de custo por professor/mês (~R$ 1,00) para a precificação | `TODO.md`. É número de ordem de grandeza, sem medição |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 15:30:47 | 2026-11-15 15:31:41 | `privacy-guardian` | 1 | APROVADO | ac7995308f9b487d3 |
| 2026-11-15 15:30:51 | 2026-11-15 15:31:45 | `infra-guardian` | 1 | APROVADO | a71a76c2adab1e28d |
| 2026-11-15 15:30:29 | 2026-11-15 15:31:50 | `tenancy-guardian` | 1 | APROVADO | a3f6683539562b7ad |
| 2026-11-15 15:30:33 | 2026-11-15 15:31:53 | `conformidade-reviewer` | 1 | APROVADO | afb92d9eff85fd634 |
| 2026-11-15 15:30:43 | 2026-11-15 15:33:03 | `revisor-geral` | 1 | APROVADO | a85d5e3694d721626 |
| 2026-11-15 15:30:36 | 2026-11-15 15:33:51 | `llm-integrator` | 1 | APROVADO | a2cdec85e03c5082e |
| 2026-11-15 15:30:40 | 2026-11-15 15:33:53 | `test-engineer` | 1 | APROVADO | a7b6032b7f6ffc5b8 |
| 2026-11-15 16:07:22 | 2026-11-15 16:07:47 | `tenancy-guardian` | 2 | APROVADO | af4b97fda11f5589c |
| 2026-11-15 16:07:34 | 2026-11-15 16:07:51 | `llm-integrator` | 2 | APROVADO | ad4d8e72ee6cf0535 |
| 2026-11-15 16:07:28 | 2026-11-15 16:07:58 | `conformidade-reviewer` | 2 | APROVADO | a509b6f46dc5e5239 |
| 2026-11-15 16:07:46 | 2026-11-15 16:08:12 | `revisor-geral` | 2 | APROVADO | a7b5796fe2d57ef09 |
| 2026-11-15 16:07:53 | 2026-11-15 16:08:14 | `privacy-guardian` | 2 | APROVADO | a2daaa4f65696446a |
| 2026-11-15 16:07:59 | 2026-11-15 16:08:26 | `infra-guardian` | 2 | APROVADO | a9486358cddf1e66d |
| 2026-11-15 16:07:40 | 2026-11-15 16:09:11 | `test-engineer` | 2 | APROVADO | a4c0880ee3d6a850c |
