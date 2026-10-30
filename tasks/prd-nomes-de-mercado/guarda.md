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
| sufixo `EmMemoria` | classe, interface e tipo | `InMemory<X>` |
| prefixo `Linha`, `Opcoes`, `Dependencias`, `Configuracao` | interface e tipo | `<X>Row`, `<X>Options`, `<X>Dependencies`, `<X>Config` |
| prefixo `esquema`, `lerConfiguracao` | const e função | `<x>Schema`, `load<X>Config` |
| prefixo `consulta` | const e função em `apps/web/**` | `<x>QueryOptions` |
| prefixo `EntradaDe`, `EntradaDo`, `SaidaDe`, `SaidaDo` | interface e tipo em `**/ia/tarefas/**` | `<X>Input`, `<X>Output` |
| segmento de arquivo ou de pasta: `adaptador-*`, `guarda-*`, `*-em-memoria` | arquivo e pasta, em todo o escopo | o do anexo |
| pasta `limite/` e `fila/` | pasta, só em `packages/**` | `rate-limit/`, `queue/` |

O prefixo só casa quando a letra seguinte é maiúscula. `Erro` não casa `Erros`, e `Linha` não casa `Linhas`.

**O resto é limite declarado.** A regra não lê método, variável local, propriedade, string nem declaração dentro de
função. `Pedido…` e `Resposta…` ficam fora da lista, porque colidem com o domínio. `fila/` e `limite/` valem só em
`packages/`, porque "fila" e "limite" são domínio nos apps.

**Exceção nominal**, na própria `nomes-de-mercado.mjs`, com o motivo: `esquemaDeCor` (`e2e/aparencia.spec.ts`), que é
o esquema de cor da tela (`prefers-color-scheme`), e não um schema zod.

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
  `const consultaX` em `apps/web`, `interface EntradaDoX` em `ia/tarefas/`;
- o nome exato `Botao`;
- um arquivo `adaptador-x.ts`, um `guarda-x.ts` e um `x-em-memoria.ts` em `apps/`;
- uma pasta `fila/` e uma `limite/` em `packages/`;
- `const esquemaDeCor` fora de `e2e/aparencia.spec.ts`.

**Passam:**
- a mesma forma no tipo em que a linha não vale: `function ErroDaOperacao`, `type FalhaDeMaterial`, `function LinhaX`,
  `function XEmMemoria`, `interface esquemaX`, `const consultaX` fora de `apps/web`, `interface EntradaDoX` fora de
  `ia/tarefas/`;
- `class ErroX` declarada dentro de uma função;
- um arquivo em `apps/api/src/fila/` e outro em `apps/api/src/limite/`;
- `const esquemaDeCor` em `e2e/aparencia.spec.ts`;
- `Erros` e `Linhas`;
- os nomes da lista "O que passa".

**Os casos da mensagem e do alcance:**
- a mensagem de `class AdaptadorX` contém `XAdapter`;
- `// eslint-disable-next-line guardas/nome-de-mercado` não desliga a regra;
- `tools/` fica fora;
- a árvore depois da 11.0 passa sem nenhum erro.
