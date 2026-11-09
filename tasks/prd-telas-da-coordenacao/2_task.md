# Tarefa 2.0 — O Painel mostra os números da escola, a fila e o que falta

**Funcionalidade:** telas-da-coordenacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`, `infra-guardian`
**Porte:** pequeno
<!-- test-engineer e revisor-geral são obrigatórios em toda tarefa, marcados ou não.
     O porte diz quanto a tarefa deve levar (criar-tasks, "Porte da tarefa"). -->

## Objetivo

Em `/coordenacao/painel`, a coordenação vê os números da IA na escola, o consumo do mês, o que espera por ela e o que falta para terminar a escola. A tela entra na lateral na 3.0.

## Contexto necessário

- `techspec.md` seções 5, 7c e 9 ("Painel"); `prd.md` RF6, RF7, RF22 e seção 6, ponto 2
- `mockup.md` seção 1: só o cabeçalho e os ladrilhos; regra 70, itens 8 e 9
- Código: `apps/web/src/areas/coordenacao/Governanca.tsx` (os quatro `NumeroPainel` e o `Consumo`); `Estrutura.tsx` (`passosDoRoteiro`)

## Subtarefas

- [x] 2.1 — `o-que-falta-da-escola.ts`: `passosDoRoteiro` sai da Estrutura para um módulo puro, com o endereço de cada passo; a Estrutura o importa
- [x] 2.2 — A tela `Painel` (`Tela` `grade`), por `lazy()`, na rota nova: função suspensa (`Aviso`, com link para `/coordenacao/agentes`); os quatro números de hoje, com "Ver em Registros"; o consumo do mês numa linha
- [x] 2.3 — "Esperando você": os itens de `useFilaDaCoordenacao` e a porta fixa "Pedidos dos titulares", sem número, com "Os prazos aparecem ao abrir. Cada leitura fica na auditoria."
- [x] 2.4 — "Para terminar a escola": só os passos que faltam, com link; sem ano letivo, "Comece pelo ano letivo"; com tudo feito, "A escola está montada"
- [x] 2.5 — Cada bloco com o seu carregando e o seu erro
- [x] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/Painel.tsx`, `apps/web/src/areas/coordenacao/Painel.test.tsx` | novo |
| `apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts`, `apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts` | novo |
| `apps/web/src/areas/coordenacao/Estrutura.tsx`, `apps/web/src/areas/coordenacao/rotas.tsx` | alterado |
| `apps/web/src/caminhos.ts`, `apps/web/src/caminhos.test.ts` | alterado |
| `e2e/painel-da-coordenacao.spec.ts` | novo |
| `apps/web/src/areas/coordenacao/fila-da-coordenacao.ts` | alterado (só exporta `SEM_LEITURA_SOZINHA`, para o Painel usar as mesmas opções de leitura) |
| `apps/web/src/api/governanca.ts` | alterado (`consultaPrimeiraPaginaDoResumo`: a primeira página do resumo, hoje numa chave só do Painel; a §7c conta o resumo como uma requisição) |
| `e2e/areas.spec.ts` | alterado (o professor em `/coordenacao/painel` cai em "Página não encontrada") |

## Testes que provam a regra

| Cenário | Tipo | O que prova |
|---|---|---|
| os passos | unidade | feito, falta ou "ainda não sei"; a lista de nomes nunca tem marca |
| nenhum número por professor | componente | dois professores com pendências diferentes: só os quatro números da escola; na fila do Painel, nenhum número ao lado de nome de professor |
| fila que falha em parte | componente | uma consulta falha ou vem com `completa: false`: o Painel mostra o que leu, o aviso, e nunca "Tudo em dia"; "Tentar de novo" relê só o que falhou, por chave exata |
| quando relê | componente | o Painel só relê ao abrir se a leitura passou de 5 min (relógio falso); `staleTime` de 5 min e nenhuma releitura na volta do foco, provocada por `focusManager.setFocused(false)` e depois `setFocused(true)`, nem na volta da rede (`onlineManager.setOnline(false)` e depois `setOnline(true)`), com o dado velho; mutações: tirar `refetchOnWindowFocus: false` e tirar `refetchOnReconnect: false`, cada uma vermelha sozinha |
| sem ano letivo | componente, e2e | o bloco "Esperando você", sem ano e com ano só `planejado` ou `encerrado`: nenhuma chamada a turmas e vínculos, e "Tudo em dia". O e2e `--vazia` do Painel confere o mesmo texto no bloco |
| estados da tela | componente | cada bloco nos quatro estados; "A escola está montada" só com tudo lido e sem erro |
| o que o Painel não lê | componente | nenhuma chamada a `/v1/privacidade/pedidos`, `/lista` nem `/reivindicacoes` |
| caminho feliz, escola vazia e permissão | e2e | os números da Governança; "Comece pelo ano letivo"; não rola a 1366 × 768; 360 px; o professor vê "Página não encontrada" |
| recomeço: segunda pessoa na mesma aba; troca de escola | e2e | nenhum número nem item da anterior; os números e a fila de A não aparecem em B, nem enquanto B carrega (sem formulário, os outros casos não se aplicam) |

## Como testar

- Componente: a rede falsa por caminho da 1.0
- e2e: `e2e/governanca.spec.ts › a coordenação abre em Governança…` (`montarEscolaComEntregas`); a guarda de papel, em `e2e/areas.spec.ts`
- Rodar: `npx vitest run --project unidade apps/web/src/areas/coordenacao/Painel.test.tsx`; `node tools/ci/e2e.ts --manter-ambiente e2e/painel-da-coordenacao.spec.ts`
- O resumo da Governança é consulta infinita: o Painel lê só a primeira página, numa chave só dele (`['governanca', 'resumo', 'primeira-pagina']`), porque consulta simples e infinita não dividem chave (Tech Spec, seção 9, Registros › IA; correção 2026-11-09-recomeco-na-mesma-aba-no-celular)
- Telas: `coordenacao`, `/coordenacao/painel`; também com `--vazia`; mockup `/coordenacao`

## Fora do escopo desta tarefa

O item na lateral (3.0); gráfico, filtro e número que o produto não mede.

## Divergências resolvidas nesta tarefa

Preenchida por quem implementa (`/executar-task`, passo 2). Uma linha por decisão que se afasta da
Tech Spec, do `cenarios.md` ou da subtarefa. A coluna "Onde está na spec" é preenchida **antes dos
revisores**: divergência sem ela está só na tarefa, e o `revisor-geral` reprova (foram quatro
reprovações na A1). Sem nenhuma, escreva "nenhuma".

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Os blocos do Painel leem todos ao abrir, numa leva só, e não em duas | O pior caso soma até 74 pedidos de uma página cada, contra 120 por minuto por usuário: a fila, até 51 (cinco listas paginadas em até 10 requisições, mais os incidentes), e o Painel, até 23 (séries e disciplinas, até 10 cada, mais resumo, consumo e funções; anos, professores, turmas e vínculos são as chaves da fila e não somam). Ler em duas levas não muda a soma do minuto, e uma segunda leva só trocaria um carregando por outro | `techspec.md` §12, "Verificado pela conta (tarefa 2.0)", e §7c, "Carga na manhã de segunda" (commit 8e45a1d, do Arquiteto) |

## Mutações

Preenchida por quem implementa (`/executar-task`, passo 2): um bloco por cláusula que o diff
acrescenta, inclusive as que a tabela de testes não cita e as cópias da mesma regra em outro arquivo.
O portão da tarefa aplica cada bloco, roda o teste citado e exige vermelho. Linha com `-` sai, com
`+` entra, com espaço é contexto. Sem cláusula nova, escreva "nenhuma".

```mutacao
arquivo: apps/web/src/areas/coordenacao/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › material processando
-export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
+export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o foco sai e volta
-export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
+export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnReconnect: false } as const
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a rede sai e volta
-export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
+export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false } as const
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › dentro dos 5 minutos
-export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
+export const SEM_LEITURA_SOZINHA = { staleTime: 0, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/fila-da-coordenacao.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › relê as dez leituras
-export const SEM_LEITURA_SOZINHA = { staleTime: 5 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
+export const SEM_LEITURA_SOZINHA = { staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › dentro dos 5 minutos
-return { ...opcoes, ...SEM_LEITURA_SOZINHA }
+return { ...opcoes } as Opcoes & typeof SEM_LEITURA_SOZINHA
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila lista cada pendência
-<div role="region" aria-label={rotulo} tabIndex={0} className={`${LISTA_QUE_ROLA} rounded-cartao`}>
+<div role="region" aria-label={rotulo} className={`${LISTA_QUE_ROLA} rounded-cartao`}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a função de IA suspensa vira um aviso
-.filter((funcao) => funcao.suspensao !== null)
+.filter(() => true)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a função de IA suspensa vira um aviso
-if (suspensas.length === 0) return null
+if (suspensas.length < 0) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › duas funções suspensas
-titulo={suspensas.length === 1 ? 'Uma função de IA está suspensa nesta escola' : 'Funções de IA estão suspensas nesta escola'}
+titulo={suspensas.length > 0 ? 'Uma função de IA está suspensa nesta escola' : 'Funções de IA estão suspensas nesta escola'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › duas funções suspensas
-{suspensas.map((funcao) => nomeDaFuncao(funcao.chave)).join('; ')}. {frase}
+{suspensas.slice(0, 1).map((funcao) => nomeDaFuncao(funcao.chave)).join('; ')}. {frase}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a função de IA suspensa vira um aviso
-<Link to={ROTAS_DA_COORDENACAO.agentes} className={CLASSES_DO_LINK_SECUNDARIO}>
+<Link to={ROTAS_DA_COORDENACAO.governanca} className={CLASSES_DO_LINK_SECUNDARIO}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › as funções de IA: verificando
-return funcoes.isError ? (
+return false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › os quatro números: carregando
-return resumo.isError ? (
+return false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › mostra os quatro números da escola
-<NumeroPainel rotulo="Gerado por IA" valor={numeros.geradoPorIa}
+<NumeroPainel rotulo="Gerado por IA" valor={numeros.rejeitado}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › mostra os quatro números da escola
-<NumeroPainel rotulo="Aprovado por gente" valor={numeros.aprovadoPorPessoa}
+<NumeroPainel rotulo="Aprovado por gente" valor={numeros.rejeitado}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › mostra os quatro números da escola
-<NumeroPainel rotulo="Esperando o professor" valor={numeros.esperando}
+<NumeroPainel rotulo="Esperando o professor" valor={numeros.rejeitado}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › mostra os quatro números da escola
-<NumeroPainel rotulo="Rejeitado" valor={numeros.rejeitado}
+<NumeroPainel rotulo="Rejeitado" valor={numeros.esperando}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › mostra os quatro números da escola
-<Link to={ROTAS_DA_COORDENACAO.governanca} className={CLASSES_DO_LINK_SECUNDARIO}>
-            Ver em Registros
+<Link to={ROTAS_DA_COORDENACAO.agentes} className={CLASSES_DO_LINK_SECUNDARIO}>
+            Ver em Registros
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o consumo do mês: carregando
-return consumo.isError ? (
+return false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o consumo do mês: carregando
-if (consumo.data.porFuncao.length === 0) return
+if (consumo.data.porFuncao.length === 99) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › mostra os quatro números da escola
-Consumo do mês: {textoDoConsumo(consumo.data.total)}. Trocas dos alunos com o Tutor: {textoDoPacoteDoTutor(consumo.data.tutor)}.
+Consumo do mês: {textoDoConsumo(consumo.data.total)}.
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila: carregando
-{fila.situacao === 'carregando' && <EstadoCarregando
+{false && <EstadoCarregando
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila inteira em erro
-{fila.situacao === 'erro' && <EstadoErro
+{false && <EstadoErro
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › lista que veio truncada
-{fila.situacao === 'parcial' && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › clique duplo em
-disabled={fila.tentandoDeNovo} onClick={fila.tentarDeNovo}
+disabled={false} onClick={fila.tentarDeNovo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › uma consulta que falha
-{(fila.situacao === 'pronta' || fila.situacao === 'parcial') && fila.itens.length > 0 && (
+{fila.situacao === 'pronta' && fila.itens.length > 0 && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila: carregando
-{(fila.situacao === 'pronta' || fila.situacao === 'parcial') && fila.itens.length > 0 && (
+{fila.situacao !== 'erro' && fila.itens.length > 0 && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila em dia diz
-{(fila.situacao === 'pronta' || fila.situacao === 'parcial') && fila.itens.length > 0 && (
+{(fila.situacao === 'pronta' || fila.situacao === 'parcial') && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › lista que veio truncada
-{fila.situacao === 'pronta' && fila.itens.length === 0 && <EstadoVazio
+{fila.situacao !== 'carregando' && fila.itens.length === 0 && <EstadoVazio
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila lista cada pendência
-{fila.situacao === 'pronta' && fila.itens.length === 0 && <EstadoVazio
+{fila.situacao === 'pronta' && <EstadoVazio
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o incidente sem confirmação
-{item.urgente && <Estado familia="erro">Urgente</Estado>}
+{false && <Estado familia="erro">Urgente</Estado>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o incidente sem confirmação
-{...(item.contador === undefined && !item.urgente
+{...(item.contador === undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › nenhum número ao lado de nome
-{item.contador !== undefined && <Contador n={item.contador.n} oQueConta={item.contador.oQueConta} />}
+{item.contador === undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a fila em dia diz
-<Linha para={caminhoDaAbaDaPrivacidade('pedidos')}
+<Linha para={caminhoDaAbaDaPrivacidade('retencao')}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o roteiro: carregando
-{anos.isError ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › escola sem nenhum ano
-if (anos.data.itens.length === 0) {
+if (anos.data.itens.length === 99) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › escola sem nenhum ano
-aoAcionar: () => navegar(PARA_O_ANO)
+aoAcionar: () => navegar(ROTAS_DA_COORDENACAO.estrutura)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só ano planejado
-anoEmCurso: anoEmCurso !== undefined,
+anoEmCurso: true,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só ano planejado
-turmas: anoEmCurso === undefined ? 0 : turmas.data?.itens.length,
+turmas: turmas.data?.itens.length,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só ano planejado
-vinculos: anoEmCurso === undefined ? 0 : vinculos.data?.itens.length,
+vinculos: vinculos.data?.itens.length,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › escola sem nenhum ano
-const turmas = useQuery({ ...semLeituraSozinha(consultaTurmas), enabled: anoEmCurso !== undefined })
+const turmas = useQuery({ ...semLeituraSozinha(consultaTurmas), enabled: true })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › escola sem nenhum ano
-const vinculos = useQuery({ ...semLeituraSozinha(consultaVinculos), enabled: anoEmCurso !== undefined })
+const vinculos = useQuery({ ...semLeituraSozinha(consultaVinculos), enabled: true })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-.includes(professor.estado))
+.includes(professor.estado) || true)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-series: series.data?.itens.length,
+series: 1,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-disciplinas: disciplinas.data?.itens.length,
+disciplinas: 1,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras
-const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
+const falhas = [disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras
-const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
+const falhas = [series, professores, turmas, vinculos].filter((consulta) => consulta.isError)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras
-const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
+const falhas = [series, disciplinas, turmas, vinculos].filter((consulta) => consulta.isError)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras
-const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
+const falhas = [series, disciplinas, professores, vinculos].filter((consulta) => consulta.isError)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras
-const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
+const falhas = [series, disciplinas, professores, turmas].filter((consulta) => consulta.isError)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só com tudo lido e sem erro
-const falhas = [series, disciplinas, professores, turmas, vinculos].filter((consulta) => consulta.isError)
+const falhas = [series, disciplinas, professores, turmas, vinculos].filter(() => false)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só com tudo lido e sem erro
-{falhas.length > 0 && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-{faltam.length > 0 && <Lista
+{false && <Lista
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só com tudo lido e sem erro
-{montada && (
+{faltam.length === 0 && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-{faltam.length === 0 && !montada && falhas.length === 0 && <EstadoCarregando
+{!montada && falhas.length === 0 && <EstadoCarregando
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › a escola montada
-{faltam.length === 0 && !montada && falhas.length === 0 && <EstadoCarregando
+{faltam.length === 0 && falhas.length === 0 && <EstadoCarregando
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras
-{faltam.length === 0 && !montada && falhas.length === 0 && <EstadoCarregando
+{faltam.length === 0 && !montada && <EstadoCarregando
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-abaixo={passo.acao}
+abaixo={passo.texto}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada passo que falta
-fim={<Estado familia="pendente">Falta</Estado>}
+fim={undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › ainda não sei
-const tem = (quantos: number | undefined) => (quantos === undefined ? undefined : quantos > 0)
+const tem = (quantos: number | undefined) => (quantos === undefined ? false : quantos > 0)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-(quantos === undefined ? undefined : quantos > 0)
+(quantos === undefined ? undefined : quantos >= 0)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-feito: tem(dados?.series),
+feito: tem(dados?.disciplinas),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-feito: tem(dados?.disciplinas),
+feito: tem(dados?.series),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-feito: tem(dados?.turmas),
+feito: tem(dados?.vinculos),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-feito: tem(dados?.professores),
+feito: tem(dados?.vinculos),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-feito: tem(dados?.vinculos),
+feito: tem(dados?.professores),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada leitura zerada
-feito: dados?.anoEmCurso,
+feito: true,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › a lista de nomes nunca tem marca
-feito: undefined, semMarca: true,
+feito: false, semMarca: true,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada passo leva à tela
-const PARA_AS_TURMAS = ROTAS_DA_COORDENACAO.estrutura
+const PARA_AS_TURMAS = ROTAS_DA_COORDENACAO.professores
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada passo leva à tela
-const PARA_OS_PROFESSORES = ROTAS_DA_COORDENACAO.professores
+const PARA_OS_PROFESSORES = ROTAS_DA_COORDENACAO.estrutura
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › cada passo leva à tela
-export const PARA_O_ANO = `${ROTAS_DA_COORDENACAO.estrutura}?painel=ano`
+export const PARA_O_ANO = ROTAS_DA_COORDENACAO.estrutura
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › só os passos que faltam
-const faltam = passos.filter((passo) => passo.feito === false)
+const faltam = passos.filter((passo) => passo.feito !== true)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › escola montada é com todo passo medido feito
-const montada = passos.every((passo) => passo.feito === true || passo.semMarca === true)
+const montada = passos.every((passo) => passo.feito === true)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › um passo ainda não lido impede
-const montada = passos.every((passo) => passo.feito === true || passo.semMarca === true)
+const montada = passos.every((passo) => passo.feito !== false || passo.semMarca === true)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/o-que-falta-da-escola.ts
teste: apps/web/src/areas/coordenacao/o-que-falta-da-escola.test.ts › a lista de nomes nunca tem marca
-semMarca: true,
+
```

```mutacao
arquivo: apps/web/src/caminhos.ts
teste: apps/web/src/caminhos.test.ts › o endereço do Painel
-painel: '/painel',
+painel: '/inicio',
```

```mutacao
arquivo: apps/web/src/caminhos.ts
teste: apps/web/src/caminhos.test.ts › o endereço do Painel
-painel: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.painel}`,
+painel: `${BASE_DA_AREA.coordenador}${ROTAS_DA_COORDENACAO.analista}`,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/rotas.tsx
teste: e2e/painel-da-coordenacao.spec.ts › a escola com entregas
-<Route path={ROTAS_DA_COORDENACAO.painel} component={Painel} />
+<Route path={ROTAS_DA_COORDENACAO.painel} component={Analista} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: e2e/painel-da-coordenacao.spec.ts › a lista longa rola por dentro
-const LISTA_QUE_ROLA = 'max-h-[clamp(9rem,calc(100dvh_-_40rem),18rem)] overflow-y-auto'
+const LISTA_QUE_ROLA = ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › só ano planejado
-const anoEmCurso = anos.data?.itens.find((ano) => ano.situacao === 'em_curso')
+const anoEmCurso = anos.data?.itens.find((ano) => ano.situacao !== 'encerrado')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › cada uma das cinco leituras do roteiro
-<Botao variante="secundario" onClick={() => falhas.forEach((consulta) => void consulta.refetch({ cancelRefetch: false }))}>
+<Botao variante="secundario" onClick={() => [series, disciplinas, professores, turmas, vinculos].forEach((consulta) => void consulta.refetch({ cancelRefetch: false }))}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › clique duplo no Tentar de novo do aviso do roteiro, com a série já no cache
-<Botao variante="secundario" onClick={() => falhas.forEach((consulta) => void consulta.refetch({ cancelRefetch: false }))}>
+<Botao variante="secundario" onClick={() => falhas.forEach((consulta) => void consulta.refetch({ cancelRefetch: true }))}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › duas funções suspensas
-const frase = suspensas.length === 1 ? 'Ela recusa pedido novo até ser retomada.' : 'Elas recusam pedido novo até ser retomada.'
+const frase = suspensas.length > 0 ? 'Ela recusa pedido novo até ser retomada.' : 'Elas recusam pedido novo até ser retomada.'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/Painel.tsx
teste: e2e/painel-da-coordenacao.spec.ts › a escola com entregas
-useTituloDaTela('Painel')
```

```mutacao
arquivo: apps/web/src/api/governanca.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o resumo que a Governança paginou
-queryKey: consultaResumoDaGovernanca.queryKey,
+queryKey: [...consultaResumoDaGovernanca.queryKey, 'primeira'],
```

```mutacao
arquivo: apps/web/src/api/governanca.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o resumo que a Governança paginou
-queryFn: async ({ signal }) => ({ pages: [await lerPaginaDoResumo(undefined, signal)], pageParams: [undefined] }),
+queryFn: async ({ signal }) => ({ pages: [await lerPaginaDoResumo(undefined, signal), await lerPaginaDoResumo(undefined, signal)], pageParams: [undefined] }),
```

```mutacao
arquivo: apps/web/src/api/governanca.ts
teste: apps/web/src/areas/coordenacao/Painel.test.tsx › o resumo que a Governança paginou
-queryFn: async ({ signal }) => ({ pages: [await lerPaginaDoResumo(undefined, signal)], pageParams: [undefined] }),
+queryFn: async ({ signal }) => ({ pages: [await lerPaginaDoResumo(undefined, signal)], pageParams: [] }),
```

```mutacao
arquivo: apps/web/src/main.tsx
teste: e2e/painel-da-coordenacao.spec.ts › o Painel da escola B não traz os números
-void clienteConsultas.resetQueries()
+void clienteConsultas.invalidateQueries()
```

## Recomendações sem aplicar

Recomendação de revisor que não foi aplicada, com destino: `TODO.md`, a tarefa que toca o arquivo,
ou recusada com o motivo. "Anularia as aprovações" não é motivo (`/executar-task`, passo 5). Sem
nenhuma, escreva "nenhuma".

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | `Painel.tsx:59` e `:288`: indício visível de que há mais passos na lista de "Para terminar a escola" (um "mais N abaixo" ou degradê), ou deixar a lista crescer no celular | `TODO.md`: muda o desenho da lista, e o e2e "a lista longa rola por dentro" e a altura de 1366 × 768 dependem dela |
| frontend-reviewer (1ª) | `Painel.tsx:208`: trocar "Pedidos dos titulares" por "Pedidos de pais e alunos" | Recusada: é o termo que a tela de Privacidade usa, e o próprio revisor o chama de coerente. Vai ao `/validar` |
| frontend-reviewer (1ª) | `Painel.tsx:106`: "Ver em Registros" aponta para o que a lateral ainda chama de "Governança" | Tarefa 3.0, que põe o item na lateral |
| conformidade-reviewer (1ª) | Texto do cartão "Aprovado por gente" não cita atividades e planos; ajustar com a Governança | `TODO.md`: o texto vem da Governança, tela que esta tarefa não toca; precisa dos dois juntos |
| conformidade-reviewer (1ª) | Confirmar que a escola vazia da vitrine tem estrutura montada | Nada a aplicar: o frontend-reviewer confirmou que "A escola está montada" é o estado correto nela |
| infra-guardian (1ª) | `techspec.md` §7c: "no máximo ~50" do sino | Feito pelo Arquiteto junto da opção (b) do item 1 (commit 8e45a1d) |
| infra-guardian (1ª) | Anotar na §12 que a premissa continua de pé e que a saída "duas levas" ainda serve se aparecer 429 no staging | Feito pelo Arquiteto (commit 8e45a1d); a §12 diz que duas levas não são saída, e que a saída é ler séries e disciplinas com uma página só |
| infra-guardian (1ª); revisor-geral (1ª) | `Painel.tsx:280`: o "Tentar de novo" do roteiro não fica desligado enquanto lê, como o da fila | `TODO.md`: desligar o botão muda o que o clique duplo do item 4 prova (o `cancelRefetch: false` deixaria de ser o que segura a segunda leitura). Reabrir depois do item 4 |
| revisor-geral (2ª); conformidade-reviewer (2ª) | `Painel.tsx:81`: no plural, "Elas recusam pedido novo até ser retomada" devia concordar ("até serem retomadas"); o teste em `Painel.test.tsx:229` trava o texto atual | `TODO.md`: texto de tela de duas linhas, mas muda o texto que o teste e o bloco de mutação de `› duas funções suspensas` travam; corrigir na próxima tarefa que tocar o Painel ou no `/validar` |
| revisor-geral (2ª) | `Painel.tsx:74`, `:122`, `:144`, `:239`: os quatro "Tentar de novo" dos `EstadoErro` não usam `cancelRefetch: false`, como o resto do `apps/web` | Recusada: o test-engineer conferiu em `query-core` (`query.ts:408`) que sem dado no cache a opção não muda nada, e o clique duplo dos quatro está provado por teste |
| revisor-geral (2ª) | `Painel.tsx:271-272`: o comentário sobre `cancelRefetch: false` está longe da linha 281 que ele explica | `TODO.md`: mover comentário muda linha citada por blocos de mutação; fazer junto de outra mudança no Painel |
| revisor-geral (2ª); infra-guardian (2ª); conformidade-reviewer (2ª); test-engineer (2ª) | `governanca.ts:28-52`: o Painel (consulta simples) e a Governança (consulta infinita) dividem a chave; aviso no JSDoc, chave própria, ou teste que monta a Governança depois do Painel e confere que "Ver mais" continua chegando ao item mais antigo | Tarefa que mexer na Governança (a trilha de auditoria é a regra 70, item 6), com o teste; até lá, `TODO.md` |
| infra-guardian (2ª); frontend-reviewer (2ª) | `Painel.tsx:281`: o "Tentar de novo" do roteiro não fica desligado enquanto lê | `TODO.md` (já estava na rodada 1): hoje é o `cancelRefetch: false` que segura o segundo clique; se o botão for desligado, o teste de clique duplo do roteiro muda junto |
| frontend-reviewer (2ª) | `Painel.tsx:59` e `:288`: sem indício de que há mais passos abaixo na lista que rola por dentro | `TODO.md` (já estava na rodada 1) |
| frontend-reviewer (2ª) | "Ver em Registros" aponta para o que a lateral ainda chama de "Governança" | Tarefa 3.0 (já estava na rodada 1) |
| frontend-reviewer (2ª) | Na foto de 360 px o nome da escola aparece cortado ("Colégio s…") na barra de cima; na lateral do computador o item "Privacidade" fica cortado no fim da rolagem | `/validar`: vêm da casca (shell) e não desta tarefa |
| frontend-reviewer (2ª) | "Pedidos dos titulares" é termo da LGPD | `/validar` (já estava na rodada 1); é o termo da tela de Privacidade |
| test-engineer (2ª) | `Painel.tsx:270`: ano letivo com dado velho e releitura falhada não entra em `falhas`; o roteiro segue sem aviso, em cima do dado velho | `TODO.md`: muda comportamento do roteiro; decidir com o Arquiteto se o aviso deve aparecer |
| test-engineer (2ª) | O e2e da troca de escola vigia só o Painel de B; a Governança de B não tem a mesma vigia | Tarefa que mexer no e2e da Governança; até lá, `TODO.md` |
| test-engineer (2ª) | `tools/processo/mutacoes.ts` não grava no log do portão qual afirmação ficou vermelha | `TODO.md` (processo), para o Orquestrador e o `/retro` da spec |

<!-- A seção "Revisões" é criada no fim deste arquivo pelo hook tools/processo/revisoes.ts,
     quando o primeiro revisor termina, e o que os revisores exigem vai para
     achados/<este arquivo>, resumido em achados/indice.md. Não escreva nenhum dos três à mão
     e não acrescente seção depois de "Revisões". -->


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-16 17:47:49 | 2026-10-16 17:48:28 | `frontend-reviewer` | 1 | APROVADO | a05b44a6d5b99f96c |
| 2026-10-16 17:47:53 | 2026-10-16 17:48:34 | `conformidade-reviewer` | 1 | APROVADO | afe8f6c3a462c8c4b |
| 2026-10-16 17:47:57 | 2026-10-16 17:49:13 | `infra-guardian` | 1 | APROVADO | a7a381f1342516148 |
| 2026-10-16 17:48:05 | 2026-10-16 17:49:34 | `revisor-geral` | 1 | REPROVADO | ae1d797dd96d9f067 |
| 2026-10-16 17:48:01 | 2026-10-16 17:50:53 | `test-engineer` | 1 | REPROVADO | a9f4185712bb310e5 |
| 2026-10-16 19:21:34 | 2026-10-16 19:22:00 | `frontend-reviewer` | 2 | APROVADO | abe8d72d0a8f409d6 |
| 2026-10-16 19:21:40 | 2026-10-16 19:22:06 | `conformidade-reviewer` | 2 | APROVADO | a321bc6a5d465e21f |
| 2026-10-16 19:21:47 | 2026-10-16 19:22:19 | `infra-guardian` | 2 | APROVADO | a69674576eab5271d |
| 2026-10-16 19:22:08 | 2026-10-16 19:23:18 | `revisor-geral` | 2 | APROVADO | a2e228f1bca7358a2 |
| 2026-10-16 19:21:59 | 2026-10-16 19:24:56 | `test-engineer` | 2 | APROVADO | a8b182975960f30e3 |
