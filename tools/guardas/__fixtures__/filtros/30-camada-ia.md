---
paths:
  - "apps/*/src/ia/**"
  - "packages/*/src/ia/**"
  - "**/prompts/**"
  - "**/tutor/**"
---

# Regra 30 — Camada de IA

## Por que esta regra existe

Três pressões distintas se juntam aqui.

A primeira é comercial. O preço alvo é R$ 30 por aluno por mês, e nele cabe o produto
inteiro: infraestrutura, suporte, margem e IA. O tutor do aluno consome muito mais token
que gerar uma prova, porque são muitas mensagens curtas, o dia inteiro, com material no
contexto. Se ninguém medir isso desde a primeira chamada, a margem desaparece sem que
apareça um erro em lugar nenhum.

A segunda é de portabilidade. Não decidimos o provedor de produção, e a conversa sobre
dado em território nacional pode forçar a escolha. Trocar de provedor precisa ser uma
variável de ambiente, não uma refatoração.

A terceira é legal. Sem contrato que vede treinamento com nosso dado, mandar conversa de
aluno para um provedor é criar um problema que não temos como desfazer depois.

## O modelo mental

**Porta e adaptador.** O domínio nunca conhece o provedor. Ele pede uma tarefa a uma
interface, declarando o **perfil** dela. Qual modelo atende cada perfil é configuração.

```
Serviço de domínio → LLMProvider (porta)
                        ├── OllamaAdapter          desenvolvimento e teste, custo zero
                        └── OpenAICompatAdapter    produção, qualquer provedor do padrão
```

| Perfil | Para quê | Modelo |
|---|---|---|
| `rapido` | classificar, extrair campo, resumir curto | barato |
| `padrao` | montar prova, plano de aula, feedback | médio |
| `complexo` | análise pedagógica, redação, apresentação | caro |
| `visao` | ler prova fotografada | visão |

## As regras

1. **Nenhum módulo de domínio importa SDK de provedor.** Um `import OpenAI` fora de
   `packages/nucleo/src/ia/adaptador-*.ts` é erro de revisão, sem discussão.
   Checagem: `guardas/sdk-de-ia-so-no-adaptador`, `tools/guardas/guardas.test.ts`, `llm-integrator`.

2. **Toda chamada declara um perfil**, e o perfil é o mais barato que resolve. Classificar
   uma pergunta curta com perfil `complexo` é desperdício que só aparece na fatura, um mês
   depois, sem culpado.

   ```ts
   // errado
   const r = await openai.chat.completions.create({ model: 'o-caro', ... })

   // certo
   const r = await this.ia.gerar({ perfil: 'rapido', prompt: classificarDuvida, schema })
   ```

   Checagem: só a revisão garante (`llm-integrator`).

3. **Desenvolvimento e teste rodam com Ollama local.** Nenhum teste automatizado chama
   provedor pago — nem uma vez, nem "só este". Teste determinístico usa adaptador falso com
   resposta fixa.
   Checagem: só a revisão garante (`llm-integrator`, `test-engineer`).

4. **Toda execução registra** entrada, saída, modelo, tokens, custo, duração e se houve
   envio externo. É o que sustenta cobrança, depuração e a resposta à escola quando ela
   perguntar por que a IA disse algo.
   Checagem: `apps/api/src/ia/ia.int.test.ts`, `packages/nucleo/src/ia/provedor.test.ts`, `llm-integrator`.

5. **Saída de IA nunca vira registro oficial sozinha.** Nota, mensagem à família e alteração
   de dado exigem aprovação humana com autor e data. Ver regra 70.
   Checagem: `apps/api/src/entrega/entrega.int.test.ts`, `conformidade-reviewer`.

6. **Prompt vive em arquivo versionado**, não em string no meio do service. Prompt é
   comportamento do produto: quando ele muda, alguém precisa conseguir ver o que mudou.
   Checagem: só a revisão garante (`llm-integrator`).

7. **Toda saída estruturada é validada por schema** antes de ser usada, com caminho de erro
   definido. Modelo erra formato, e um JSON quebrado não pode derrubar a correção de uma
   turma inteira.
   Checagem: só a revisão garante (`llm-integrator`).

8. **Timeout, retry com recuo, e orçamento de tokens por aluno, por turma e por escola**
   (pacote do tutor por turma com freio diário por aluno, D38; valores são configuração por
   escola e por rede, nunca constante no código, D41), com corte
   suave e aviso ao coordenador antes do limite. Medir não é otimização aqui, é requisito
   de produto: é o número que valida ou destrói a precificação.
   Checagem: `packages/nucleo/src/ia/adaptador-resiliente.test.ts`, `llm-integrator`.

9. **Sem contrato vedando treinamento, use o provedor local.**
   Checagem: `packages/nucleo/src/ia/provedor.test.ts`, `privacy-guardian`.

10. **O tutor respeita a política da turma no servidor**, nunca no cliente. Durante
    avaliação em andamento ele fica travado, independentemente da política.
    Checagem: `apps/api/src/tutor/tutor.int.test.ts`.

11. **A recusa é testada, não pedida.** Não basta escrever no prompt que ele não deve
    entregar a resposta: o teste tenta arrancar de três formas diferentes, incluindo pedido
    direto, pedido disfarçado de verificação e pedido fatiado em pedaços.
    Checagem: `apps/api/src/tutor/tutor.int.test.ts`, `apps/api/src/tutor/tutor-modelo.int.test.ts`.

12. **Toda geração cita a origem** no material, com material e página. Saída sem
    rastreabilidade é indistinguível do que o professor consegue de graça em qualquer chat,
    e derruba o argumento central do produto.
    Checagem: `apps/api/src/artefato/artefato.int.test.ts`, `llm-integrator`.

## Como isso é checado

O subagente `llm-integrator` audita toda tarefa que chama modelo ou cria agente, e cobra a
estimativa de custo por professor e por aluno. Essa estimativa acumulada é o que vai fechar
a planilha de precificação sem precisar de um projeto separado para isso.
