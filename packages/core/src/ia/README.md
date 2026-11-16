# Camada de IA

O domínio pede uma **tarefa** à porta `LLMProvider` e recebe a saída **já validada** e a medição. Ele não conhece
provedor, modelo nem prompt (regra 30). Qual adaptador atende é `IA_ADAPTADOR`: `falso` (determinístico, padrão em
teste e desenvolvimento) ou `openai_compat` (`llama-server` local, ou o provedor contratado).

```ts
import { LLMError, gerarAtividadeObjetiva, type LLMProvider } from '@educa/core'

const { saida, medicao } = await ia.gerar({
  tarefa: gerarAtividadeObjetiva,        // já declara a função (D9), o perfil e o prompt
  escolaId,                              // do contexto ou da execução gravada, nunca do cliente
  entrada: { tema, quantidade: 5, contexto: { serie, disciplina }, habilidades, trechos },
  execucaoId, sinal,                     // o que o ExecucaoProcessor (o worker de IA) entrega ao trabalho
})
// saida: ConteudoDeAtividade, com a página citada conferida contra os trechos
// falha: sempre LLMError (codigoDeIa: IA_INDISPONIVEL | IA_TEMPO_ESGOTADO | IA_SAIDA_INVALIDA | …)
```

- **Tarefas** (`tasks/`, catálogo em `TASK_CATALOG`; os nomes são os de `TAREFAS_DE_IA`, em `@educa/shared`):
  `propor_ferramenta`, `gerar_atividade_objetiva`, `gerar_plano_de_aula`, `adaptar_atividade`, `turno_do_tutor`,
  `relatorio_da_correcao`, `resumo_do_analista`. A entrada é estrita: não existe chave para nome de aluno ou de
  professor. Isso prende a forma, não o que a pessoa escreve: a tarefa com texto livre leva `levaTextoLivreDePessoa`.
- **Toda chamada** confere `SuspensaoDeFuncao` (recusa com `FUNCAO_SUSPENSA`), consulta `OrcamentoDeIa` antes de gastar
  e grava em `RegistroDeConsumo` depois. Entrada e saída vão para o registro, nunca para o log; na conversa do
  professor com o Assistente e na do aluno com o Tutor, nem para o registro (ela mora em `mensagem_agente` e
  `mensagem_tutor`).
- **Suspender uma função recusa execução nova e não apaga o que ela já produziu.** A entrega pendente de uma função
  suspensa continua podendo ser aprovada ou rejeitada pelo professor: quem decide é a pessoa.
- **Prompt** é arquivo versionado em `prompts/`; a versão determinística de cada tarefa é o `falso` dela.

## Na API: como um pacote de domínio dispara uma tarefa

O `IaModule` (`apps/api/src/ia/`) é global. O pacote injeta o `ExecucaoScheduler` e, no `POST`, faz uma chamada:

```ts
constructor(private readonly agendador: ExecucaoScheduler) {}

return this.agendador.agendar({               // responde { execucaoId }: é o corpo do 202
  comando: 'propor_ferramenta',                // o nome da tarefa: o registro acha o comando do módulo dono (o Tutor: 'turno_do_tutor')
  chaveEnvio: pedido.chaveEnvio,               // a mesma chave devolve a mesma execução e não produz duas vezes
  entradaDaExecucao: { tarefa: 'propor_ferramenta' },                  // o que fica em execucao_agente.entrada
  aoGravar: (tx, execucaoId) => mensagens.gravarDoUsuario(tx, execucaoId, pedido),   // mesma transação da execução
})
```

- Escola, ano letivo e quem pediu vêm da sessão. A entrada da tarefa e o que a execução grava são do **comando** do módulo dono
  (`<módulo>/<tarefa>.command.ts`): o `preparar` relê a execução pelo id e repete o alcance do `POST`, e o `concluir` grava na
  transação que a conclui. Ambos rodam depois do `202`, no contexto de quem pediu.
- A suspensão é conferida antes de gravar; a falha vira `falhou` com um `ErrorCode`, e o que o `concluir` gravou é desfeito.
- A tela lê o resultado em `GET /v1/execucoes/:id` (só quem pediu). O Tutor grava `mensagem_tutor` no lugar de `mensagem_agente`.
- Função que roda **sem modelo** (a correção de objetiva): `FuncaoSuspensionCheck.exigirAtiva('correcao_de_objetiva')`.
- As portas também são injetáveis: `SUSPENSAO_DE_FUNCAO` e `ORCAMENTO_DE_IA` (o `POST` do Tutor consulta este último antes de gravar, para
  responder `LIMITE_DIARIO_DO_TUTOR` na hora). O `LLM_PROVIDER` só existe no `main-worker`: a API não chama modelo.
- A execução roda no `main-worker` (`apps/api/src/main-worker.ts`): o `POST` grava a execução `pendente` e o job `ia.executar` no outbox,
  e o worker o conclui, uma vez só. A varredura do `main-worker` encerra o que ficou preso.
