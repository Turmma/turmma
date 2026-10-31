# Camada de IA

O domínio pede uma **tarefa** à porta `LLMProvider` e recebe a saída **já validada** e a medição. Ele não conhece
provedor, modelo nem prompt (regra 30). Qual adaptador atende é `IA_ADAPTADOR`: `falso` (determinístico, padrão em
teste e desenvolvimento) ou `openai_compat` (`llama-server` local, ou o provedor contratado).

```ts
import { ErroDeIa, gerarAtividadeObjetiva, type LLMProvider } from '@educa/nucleo'

const { saida, medicao } = await ia.gerar({
  tarefa: gerarAtividadeObjetiva,        // já declara a função (D9), o perfil e o prompt
  escolaId,                              // do contexto ou da execução gravada, nunca do cliente
  entrada: { tema, quantidade: 5, contexto: { serie, disciplina }, habilidades, trechos },
  execucaoId, sinal,                     // o que o ExecutorDeAgente entrega ao trabalho
})
// saida: ConteudoDeAtividade, com a página citada conferida contra os trechos
// falha: sempre ErroDeIa (codigoDeIa: IA_INDISPONIVEL | IA_TEMPO_ESGOTADO | IA_SAIDA_INVALIDA | …)
```

- **Tarefas** (`tarefas/`, catálogo em `CATALOGO_DE_TAREFAS`; os nomes são os de `TAREFAS_DE_IA`, em `@educa/shared`):
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

O `IaModule` (`apps/api/src/ia/`) é global. O pacote injeta o `AgendadorDeExecucoes` e, no `POST`, faz uma chamada:

```ts
constructor(private readonly agendador: AgendadorDeExecucoes) {}

return this.agendador.agendar({               // responde { execucaoId }: é o corpo do 202
  tarefa: proporFerramenta,                    // o Tutor: turnoDoTutor, com alunoId e turmaId
  chaveEnvio: pedido.chaveEnvio,               // a mesma chave devolve a mesma execução e não produz duas vezes
  entradaDaExecucao: { tarefa: 'propor_ferramenta' },                  // o que fica em execucao_agente.entrada
  aoGravar: (tx, execucaoId) => mensagens.gravarDoUsuario(tx, execucaoId, pedido),   // mesma transação da execução
  entrada: async () => ({ mensagem, contexto, trechos: await materiais.buscar(texto), turnosAnteriores }),
  aoConcluir: async (saida, tx, execucaoId) => ({ tipo: 'mensagem', mensagemId: await mensagens.gravarDoAgente(tx, execucaoId, saida) }),
})
```

- Escola, ano letivo e quem pediu vêm da sessão; `entrada` e `aoConcluir` rodam depois do `202`, no contexto de quem pediu.
- A suspensão é conferida antes de gravar; a falha vira `falhou` com um `CodigoDeErro`, e o que `aoConcluir` gravou é desfeito.
- A tela lê o resultado em `GET /v1/execucoes/:id` (só quem pediu). O Tutor grava `mensagem_tutor` no lugar de `mensagem_agente`.
- Função que roda **sem modelo** (a correção de objetiva): `ConferenciaDeFuncao.exigirAtiva('correcao_de_objetiva')`.
- As portas também são injetáveis: `LLM_PROVIDER`, `EXECUTOR_DE_AGENTE`, `SUSPENSAO_DE_FUNCAO` e `ORCAMENTO_DE_IA` (o
  `POST` do Tutor consulta este último antes de gravar, para responder `LIMITE_DIARIO_DO_TUTOR` na hora).
- O executor roda no processo da API (`TODO(fila)`, D77); na subida, a varredura encerra o que ficou preso.
