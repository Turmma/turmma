# A guarda do RF8 — Nomes de mercado (X8)

Anexo da Tech Spec §5 e §10 (tarefa 12.0).

## Onde ela vive

A regra é `guardas/nome-de-mercado`, em `tools/guardas/regras-nome.mjs`, e a lista fica em
`tools/guardas/nomes-de-mercado.mjs`. Ela entra em `REGRAS_DAS_GUARDAS`: roda na segunda passada, com
`allowInlineConfig: false`. Vale só em `apps/**`, `packages/**` e `e2e/**`.

Ela não é a `naming-convention`, porque essa não dá o nome de mercado na mensagem e não lê arquivo nem pasta.

## A gramática

Cada entrada da lista tem três partes: a forma, os tipos de declaração em que vale e o nome de mercado, que vai na
mensagem. A regra lê **só a declaração de topo de arquivo**, exportada ou não.

| Forma | Vale em | Nome de mercado |
|---|---|---|
| nome exato do kit: `Botao`, `Cartao`, `Dialogo`, `Abas`, `Tabela`, `Tela` | qualquer declaração | o do anexo web |
| prefixo `Adaptador`, `Guarda`, `Filtro`, `Interceptor`, `Erro`, `Falha`, `Emissor`, `Armazem`, `Medicao`, `Bancada` | classe | `<X>Adapter`, `<X>Guard`, `<X>Filter`, `<X>Interceptor`, `<X>Exception` ou `<X>Error`, `<X>Issuer`, `<X>FileStorage`, `<X>Gauge`, `<X>Fixtures` |
| prefixo `Agendador` (e `AgendadorDe`), `Processador` (e `ProcessadorDe`), `Executor` (e `ExecutorDe`); o nome exato `Processador` e `ExecutorDeJobs` | classe | `<X>Scheduler`, `<X>Processor`, `<X>Executor`; `JobProcessor`, `JobExecutor` |
| sufixo `EmMemoria` | classe, interface e tipo | `InMemory<X>` |
| prefixo `Linha`, `Opcoes`, `Dependencias`, `Configuracao` | interface e tipo | `<X>Row`, `<X>Options`, `<X>Dependencies`, `<X>Config` |
| prefixo `esquema`, `lerConfiguracao`, e o nome exato `lerConfiguracao` | const e função | `<x>Schema`, `load<X>Config` (`loadConfig` no nome exato) |
| prefixo `consulta` | const e função em `apps/web/**` | `<x>QueryOptions` |
| prefixo `METADADO_` | const e função | `<X>_KEY` |
| prefixo `CHAVE_` | const e função em `apps/web/**` | `<X>_QUERY_KEY` |
| prefixo `EntradaDe`, `EntradaDo`, `SaidaDe`, `SaidaDo` | interface e tipo em `**/ia/tasks/**` | `<X>Input`, `<X>Output` |
| segmento de arquivo ou de pasta: `adaptador-*`, `guarda-*`, `*-em-memoria`, `*-de-teste` | arquivo e pasta, em todo o escopo | o do anexo |
| pasta `limite/` e `fila/` | pasta, só em `packages/**` | `rate-limit/`, `queue/` |

`Agendador`, `Processador` e `Executor` como **prefixo** (e as variantes `…De`) são extensão deliberada, e não coluna do `inventario.md` §1: o §1 traz só
`Processador` e `ExecutorDeJobs`, como nomes exatos, e `Agendador…` vem do RF8. O prefixo pega `AgendadorDeExecucao`, que é o caso que o RF8 existe para
recusar, e a variante `…De` dá o nome sem o `De` (`ExecucaoScheduler`). A árvore passa com elas.

O prefixo só casa quando a letra seguinte é maiúscula. `Erro` não casa `Erros`, e `Linha` não casa `Linhas`.

**O resto é limite declarado.** A regra não lê método, variável local, propriedade, string nem declaração dentro de
função, a desestruturação de topo (`export const { esquemaX } = …` passa) e a assinatura sem corpo (`declare function
lerConfiguracao(): void` passa). O caminho é o relativo ao `cwd` do ESLint, que tem de ser a raiz do repositório: um ESLint de
editor com outro `workingDirectory` lê `src/…`, e as linhas com `onde` (`consulta…`, `EntradaDe…`, as pastas `fila/` e `limite/`)
deixam de valer sem aviso. `fila/` e `limite/` valem só em
`packages/`, porque "fila" e "limite" são domínio nos apps.

**Exceção nominal**, na própria `nomes-de-mercado.mjs`, com o motivo: `esquemaDeCor` (`e2e/aparencia.spec.ts`), que é
o esquema de cor da tela (`prefers-color-scheme`), e não um schema zod; e `CHAVE_CHEIO_NAS_CLASSES`
(`apps/web/src/__fixtures__/danger-solid.ts`), a chave `cheio` de um objeto procurada por expressão regular, e não uma chave do TanStack Query.

## O que fica fora da lista, e por quê

O `inventario.md` §1 diz que a guarda usa os prefixos e sufixos da coluna da esquerda. Estas formas dele **não** entram, e o motivo é de colisão
com nome que existe ou com palavra de domínio (a correção `guarda-formas-do-inventario`, que acrescentou as outras seis):

| Forma do §1 | Por que fica fora |
|---|---|
| `Pedido<X>`, `Resposta<X>` | colidem com o domínio (`PedidoDoTitular`, a resposta do aluno) |
| `Consulta<X>` (DTO HTTP) | a guarda lê o nome, e não sabe se é DTO: `ConsultaComPrazoDoCliente` (`apps/worker/test/queue.fixture.ts`) e `ConsultaDoReact` (`e2e/support/query-cache.ts`) são outra coisa, e "consulta" é palavra de domínio |
| `Agendamento` (BullMQ → `JobSchedule`) | a palavra solta é domínio provável (agendar prova ou aula); o `Agendador…`, que é peça técnica, está na lista |
| `CHAVE_<X>` fora de `apps/web/**` | `CHAVE_DA_TRAVA_*`, `CHAVE_LOCK_MIGRACAO`, `CHAVE_V1` e afins são chave de lock, de cifra e de teste; a chave do TanStack Query só existe na web |
| `Erro<X>` e `Falha<X>` fora de classe | o componente de tela e o tipo de domínio passam (já era assim) |

**O que passa, de propósito:**
- o componente de tela, que é função: `ErroDaOperacao`, `LinhaDaTarefa`;
- o tipo de domínio: `FalhaDeMaterial`, `FiltroDeEstado`;
- a recusa de domínio: `RenovacaoRecusada`;
- os nomes com o kit dentro: `DialogoDeAlocacao`, `CartaoDoAgente`;
- o nome misto: `TurmaController`, `EliminacaoDoTitular`, `PedidoDoTitular`, `CorrecaoService`, `ValidacaoDoLote`;
- a exceção nominal `esquemaDeCor`.

Com o inventário e as adendas 1 a 3 aplicados, a árvore inteira passa.

## Os casos (12.0)

**Recusados:**
- um por linha da tabela, no tipo de declaração em que a linha vale: `class AdaptadorX`, `class ErroX`,
  `interface LinhaX`, `type OpcoesX`, `class XEmMemoria`, `const esquemaX`, `function lerConfiguracaoX`,
  `const consultaX` em `apps/web`, `interface EntradaDoX` em `ia/tasks/`;
- o nome exato `Botao` e o nome exato `function lerConfiguracao`;
- `class AgendadorDeX`, `class ProcessadorX`, `class ExecutorDeX`, o nome exato `class Processador` e `class ExecutorDeJobs`, `const METADADO_X`,
  e `const CHAVE_X` em `apps/web`;
- um arquivo `adaptador-x.ts`, um `guarda-x.ts`, um `x-em-memoria.ts` e um `material-de-teste.ts` em `apps/`;
- uma pasta `fila/` e uma `limite/` em `packages/`;
- `const esquemaDeCor` fora de `e2e/aparencia.spec.ts`.

**Passam:**
- a mesma forma no tipo em que a linha não vale: `function ErroDaOperacao`, `type FalhaDeMaterial`, `function LinhaX`,
  `function XEmMemoria`, `interface esquemaX`, `const consultaX` fora de `apps/web`, `interface EntradaDoX` fora de
  `ia/tasks/`;
- `class ErroX` declarada dentro de uma função;
- um arquivo em `apps/api/src/fila/` e outro em `apps/api/src/limite/`;
- `const esquemaDeCor` em `e2e/aparencia.spec.ts` e `const CHAVE_CHEIO_NAS_CLASSES` em `apps/web/src/__fixtures__/danger-solid.ts`;
- `Erros` e `Linhas`; `Agendadores`, `Processadores`, `METADADOS_X`; `function AgendadorX`; `const CHAVE_X` fora de `apps/web`; `ConsultaX`, `Agendamento`;
- um arquivo `material-de-testes.ts` e `material.fixture.ts`;
- os nomes da lista "O que passa".

**Os casos da mensagem e do alcance:**
- a mensagem de `class AdaptadorX` contém `XAdapter`, e a de `class AgendadorDeX`, `XScheduler`;
- `// eslint-disable-next-line guardas/nome-de-mercado` não desliga a regra;
- `tools/` fica fora;
- a árvore depois da 11.0 passa sem nenhum erro.
