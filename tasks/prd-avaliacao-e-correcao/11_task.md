# Tarefa 11.0 — Painel "Acompanhar" e o e2e do professor

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 5.0, 8.0, 9.0, 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

No painel da atividade, o professor acompanha a prova por aluno, estende, abre a segunda chamada e encerra sabendo
quantos ainda fazem; o e2e prova a prova online do lado dele, de aplicar a aprovar.

## Contexto necessário

- `techspec.md` §9
- `prd.md` RF4, RF10; §7 (professor encerra antes do fim)
- `cenarios.md` §1 RF5 (encerrar), §4 (Acompanhar, Estender, Segunda chamada, Encerrar, 360 px), §4b
  (`professor-prova.spec.ts`)
- `docs/interface.md` §1.7; `.claude/rules/50`
- `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx` e `EncerramentoDaAtividade.tsx`
- Da rodada da 5.0 (`5_task.md`, "Recomendações sem aplicar"): o diálogo de estender gera a `chave` **uma vez por abertura** e a reaproveita no reenvio do mesmo pedido (a repetição devolve o gravado, 200); o acompanhamento mostra só a situação e o "termina às" (`limiteEm`), sem "parado há X min" (regra 70, item 7); e `tempo_esgotado` sai sem texto que sugira falta ou consequência

## Subtarefas

- [x] 11.1 — "Acompanhar": lê `acompanhamento` a cada 15 s, só à vista; situação em texto, no fuso da escola; dois alunos
  de mesmo nome distinguidos; nunca na tela da sala; cartões a 360 px
- [x] 11.2 — "Estender" (aluno ou a turma toda, com o efeito antes de confirmar); "Segunda chamada" (convocados por nome,
  janela, duração, tempo adicional, em lista de uma coluna a 360 px)
- [x] 11.3 — "Encerrar" com "3 alunos ainda estão fazendo…"
- [x] 11.4 — `docs/interface.md` §1.7
- [x] 11.5 — Testes e `e2e/professor-prova.spec.ts`

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/atividades/Acompanhamento.tsx` | novo |
| `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx` | novo |
| `apps/web/src/areas/professor/atividades/Estender.tsx` | novo |
| `apps/web/src/areas/professor/atividades/SegundaChamada.tsx` | novo |
| `apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/api/acompanhamento.ts` | novo |
| `e2e/professor-prova.spec.ts` | novo |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Estados do Acompanhar | unidade web | carregando, erro com "Tentar de novo", "Não começou", "Fazendo · termina às 10:42", "Enviou", "Tempo esgotado" em texto | | `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › carregando, a seção diz que lê`, `… › com falha e sem leitura`, `… › a turma sem alunos diz isso`, `… › a situação de cada aluno é texto` e `… › o que a tela não diz`; no painel, `AtividadesDaTurma.test.tsx › a prova aberta mostra "Acompanhar"`, `… › a prova encerrada tem "Segunda chamada"` e `… › a atividade prática e a avaliativa sem janela` |
| Releitura | unidade web | a cada 15 s com a aba à vista; oculta, nenhuma; na tela da sala, nenhuma | relógio falso; aos 14 s, nenhuma | `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › relógio falso: aos 14 s nenhuma leitura nova`, `… › com a janela escondida, nenhuma leitura`, `… › a prova encerrada não é relida`, `… › a releitura que falha deixa o último acompanhamento` e `… › a aba Hoje, que a professora projeta, não lê o acompanhamento` |
| Fuso da escola | unidade web | o horário da escola | o fuso do navegador diferente | `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › o horário é o da escola` (o computador em Tóquio) e `…/prova-online.test.ts › a hora é a da parede da escola` |
| Mesmo nome | unidade web | os dois distinguidos | | `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › dois alunos com o mesmo nome` e `…/prova-online.test.ts › em ordem de nome` |
| Estender | unidade web | "Mais quantos minutos?"; 0 e 121 recusados; "a turma toda"; "Ana termina às 10:52 em vez de 10:42" antes de confirmar; duplo Confirmar e reenvio com a mesma `chave` | com 5 min, 10:47 | `apps/web/src/areas/professor/atividades/Estender.test.tsx › "Mais quantos minutos?", o aluno ou a turma toda`, `… › "a turma toda" diz o que anda junto`, `… › o botão da seção estende a turma toda`, `… › 0 e 121 minutos são recusados`, `… › o duplo clique em confirmar`, `… › a turma toda manda o pedido sem`, `… › a falha fica no diálogo`, `… › a prova que encerrou com o diálogo aberto` e `… › a leitura que estava no ar quando a extensão saiu` |
| Segunda chamada | unidade web | os convocados por nome, a janela, a duração e o tempo adicional antes de confirmar | | `apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só a prova avaliativa com janela, já encerrada`, `… › só quem não começou é convocável`, `… › a confirmação diz os convocados por nome`, `… › o pedido leva só os convocados`, `… › sem convocado, sem janela`, `… › dois cliques em confirmar mandam um pedido só`, `… › quando ninguém é convocável` e `… › o \`CONFLITO\` e o \`ENTRADA_INVALIDA\`` |
| Encerrar | unidade web | a frase inteira da `cenarios.md` §4, com "3" | com 0, sem a frase | `apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx › com 3 fazendo`, `… › com 1 fazendo`, `… › a leitura relida na abertura vale mais que a antiga`, `… › sem a leitura` e `… › a atividade prática não lê o acompanhamento`; as contas em `…/prova-online.test.ts › o aviso do encerramento conta quem faz` |
| Recomeço | e2e | a resposta atrasada do acompanhamento anterior não sobrescreve; a falha do Estender com o diálogo aberto sai ao reabrir | `page.route` segurando | `e2e/professor-prova.spec.ts › recomeço: a leitura atrasada de outra prova não cobre o painel de agora` (`page.route` segura a leitura da primeira prova até a professora estar na segunda; o 503 do Estender sai ao abrir de novo) e, no componente, `Estender.test.tsx › a leitura que estava no ar quando a extensão saiu` |
| 360 px e 1366 × 768 | e2e | cartões, sem rolar de lado; `paginaNaoRola`; Estender e Confirmar com 44 px; segunda chamada em uma coluna | | `e2e/professor-prova.spec.ts › em 360 px e em 1366 × 768` (cartões, `paginaNaoRola` e os 44 px do Estender e do Confirmar) e `… › a segunda chamada abre na prova encerrada` (a uma coluna e o Confirmar com 44 px); os dois projetos rodam os mesmos casos |
| `professor-prova.spec.ts` | e2e `chromebook` e `celular` | aplica com janela e tempo adicional, acompanha, estende; o aluno faz (pela API) e sai da aba uma vez; encerra pelo botão; aprova com "1" na coluna e o aviso (no celular, dentro do cartão do aluno); axe | coluna sem o aviso; contagem errada | `e2e/professor-prova.spec.ts › acompanha cada aluno (a Ana com tempo adicional), e estende o tempo de um` (o limite da Ana é conferido contra o começo mais 60 min, e não 40, com 1 min de folga), `… › encerra pelo botão dizendo quantos ainda fazem` e `… › o lote da prova traz "1" na coluna "Saiu da aba" e o aviso fixo` (a aplicação pela tela, com a janela e o tempo adicional, é de `e2e/professor-aplicacao.spec.ts`, 10.0: divergência acima) |

## Como testar

- `apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx`
- O aluno pela API: `e2e/support/aluno-api.ts`; o banco: `e2e/support/atividade-db.ts`
- `node tools/ci/e2e.ts --manter-ambiente e2e/professor-prova.spec.ts`
- **Telas:** professora · a turma aberta · `text=Atividades` → a prova → "Acompanhar"; "Estender"; "Segunda chamada"

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas depois.

1. **A mutação de cada cláusula** está na seção "Mutações": um bloco por condição que o diff acrescenta (cada termo do `hasAcompanhamento`, do `canAbrirSegundaChamada`, de `PODE_ESTENDER`, das condições de JSX do painel, do diálogo de estender e do da segunda chamada; a releitura de 15 s, o `refetchIntervalInBackground`, a chave por (aluno, minutos), a trava `decidindo` nos dois diálogos, a conta do "fazendo", o `staleTime`, o `setQueryData` depois do `cancelQueries`, e as três rotas). O que não tem bloco tem o motivo em prosa na mesma seção. Os blocos de JSX com operando removem o elemento inteiro, e não só o primeiro termo.
2. **O texto na tela:** procurei em `e2e/` os textos novos (`Acompanhar`, `Estender`, `Segunda chamada`, `ainda estão fazendo`) e os que o painel já tinha e passam a conviver com eles (`Encerrar a atividade`, `Mudar janela`): `professor-turma-atividades`, `professor-aplicacao`, `professor-aprovar`, `casca`, `escola-montada`, `aluno-fluxo` e `roteiro-da-demonstracao` rodaram isolados com a estrutura nova (a seção "Acompanhar" só existe na avaliativa com janela, e os que abrem o painel de uma prática não a veem).
3. **O segundo dado de cada cláusula:** o acompanhamento tem um aluno por situação e dois homônimos (com caixa e espaço de sobra diferentes); o "termina às" tem o computador em Tóquio; a releitura tem 14 s e 15 s com o relógio falso, e a janela escondida com o controle de volta; o Estender tem 0, 1, 120, 121, 2,5 e vazio, 10 e 5 min (10:52 e 10:47), o aluno que não começou e a turma toda, e o mesmo pedido, outros minutos e outro alvo; a segunda chamada tem quem enviou, quem esgotou o tempo e quem não começou; o encerramento tem 3, 1 e nenhum fazendo.
4. **A checagem anterior que responde antes:** a conferência dos minutos e a dos campos da janela respondem antes do envio (o caso confere que nenhum `POST` saiu); a leitura do encerramento só existe com o diálogo aberto; a seção "Acompanhar" só monta com `temAcompanhamento`, antes de a leitura sair. Nos casos de unidade o `fakeNetwork` responde só o caminho que o caso declara, e uma rota errada deixa o caso vermelho (blocos das três rotas).
5. **A asserção olha o resultado:** os casos leem o corpo exato do `POST` (`corposDosPedidos`: `alunoId`, `minutos`, `chave`), o texto do efeito, o `role=status` do aviso e o número de leituras da rede; nenhum olha o texto do código. O e2e lê a tela contra a API real e o banco (`atividadesAplicadasNoBanco`).
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo. A catraca do lint (`eslint-suppressions.json`) não ganhou entrada.
7. **Comentário que afirma o que o código não faz:** o docblock de `Acompanhamento` diz "relida a cada 15 s enquanto a prova está aberta e a janela está à vista" (provado pelo relógio falso e pelo bloco da `refetchIntervalInBackground`), "só situação" (o caso `o que a tela não diz`) e "dois homônimos, dois cartões" (o caso do mesmo nome); o de `Estender` diz que o pedido sai uma vez só e que a `chave` nasce por pedido (o `act` com dois cliques e o caso da falha com o reenvio); o de `SegundaChamada` diz que só quem não começou é convocável (o caso da lista, com quem enviou e quem esgotou o tempo fora). `docs/interface.md` §1.7 diz o que a tela faz agora.
8. **Divergências:** as três da tabela abaixo, na `techspec.md` §9 e no `cenarios.md` §4 e §4b; nenhuma muda regra do PRD. Arquivos fora de "Arquivos previstos": `Estender.test.tsx`, `SegundaChamada.test.tsx`, `AtividadesDaTurma.test.tsx`, `EncerramentoDaAtividade.test.tsx`, `prova-online.ts` e `prova-online.test.ts` (as contas do horário, da ordem, dos homônimos e do efeito moram numa peça sem tela, como na 10.0), `e2e/support/aluno-api.ts` (a saída da aba pela API do aluno) e `e2e/support/atividade-db.ts` (o `aplicar` com duração e tempo adicional, e o `encerrarSemLote` da prova que ninguém fez). `Estender.tsx` e `SegundaChamada.tsx` estão previstos.
9. **Peça que já existe:** `ConfirmDialog`, `Sheet`, `SegmentedControl`, `OptionCard`, `Select`, `FormField`, `StatusBadge`, `SectionHeader`, `ErrorState`, `LoadingState`, `errorText`, `formatQuantity`, `CamposDaJanela`, `conferirAProva`, `resumoDaProva`, `recarregarAtividades` e os contratos `acompanhamentoResponseSchema`, `estenderTempoRequestSchema` e `segundaChamadaRequestSchema` do `packages/shared`. Nada de peça nova em `components/ui` (sem entrada no catálogo da seção 10.2).
10. **A operação em duas chamadas ao mesmo tempo:** o clique duplo em "Estender o tempo" e em "Abrir a segunda chamada" manda um pedido só (a trava `decidindo`, provada com os dois cliques no mesmo `act`); o reenvio da extensão leva a mesma `chave` (a API devolve o gravado, 200), e a resposta atrasada de uma leitura não cobre o limite novo (`cancelQueries` antes de `setQueryData`); a corrida entre estender e encerrar é da API (`ATIVIDADE_ENCERRADA`), e a tela diz que a prova já encerrou.
11. **O isolamento quebra sem a cláusula:** a tarefa não cria consulta nem tabela; o acompanhamento, a extensão e a segunda chamada são das rotas da 5.0 e da 9.0 (escopo no repository, autorização por turma, 404 para outra escola), e a tela só passa o id da atividade que a lista da turma trouxe. O nome de aluno fica em `gcTime: 0`, e nunca na tela da sala.
12. **Os guardiões:** `privacy-guardian` (nome de aluno só ao professor da turma, sem matrícula na tela; o tempo adicional da segunda chamada é só o percentual, sem motivo; o resumo diz **quantos** têm tempo adicional, nunca quais; nada vai a log) e `frontend-reviewer` (os quatro estados, 360 px sem rolar de lado, alvos de 44 px em Estender e Confirmar, rótulo e erro em cada campo, `ConfirmDialog` com o efeito antes de gravar, o horário da escola, a situação em texto).

## Fora do escopo desta tarefa

A tela do aluno (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| Os homônimos do acompanhamento se distinguem por "(1 de 2)" e "(2 de 2)", e não "pelo segundo nome ou matrícula" | O contrato do acompanhamento (`acompanhamentoResponseSchema`, 5.0) traz `alunoId`, `nome`, `situacao` e `limiteEm`, sem matrícula nem sobrenome separado; a matrícula é dado pessoal que a leitura não precisa carregar (regra 20, item 1), e o segundo nome não é campo. A ordem do id é a da API, e a tela só numera | `cenarios.md` §4 (linha "Acompanhar") e `techspec.md` §9 (o painel da atividade) |
| A segunda chamada oferece só quem **não começou**, e não a cortada pela professora antes do limite | `techspec.md` §5.9 diz que a cortada continua convocável, mas a leitura do acompanhamento a devolve como `enviou` (`extensao.service.ts`: encerrada pela professora com o limite adiante vira `enviou`), igual a quem enviou, e a tela não tem como distingui-la sem ofertar quem já enviou, o que a API recusaria. A API continua aceitando a cortada; a tela oferece o subconjunto seguro | `cenarios.md` §4 (linha "Segunda chamada") e `techspec.md` §9; a recomendação de expor a cortada está na seção "Recomendações sem aplicar" |
| "Aplicar com janela e tempo adicional pela tela" fica em `professor-aplicacao.spec.ts` (10.0), e o `professor-prova.spec.ts` aplica pela API (`atividade-db.aplicar`, com `duracaoMin` e `tempoAdicional`) | O caso novo vale 15 s no portão (metade dos 30 s da esteira; só o prazo que já estava no HEAD vale mais), e a carga do aplicativo no Chromebook com CPU ×4 já gasta uns 12 s dele: o caso que aplicava pela tela levava de 16 a 19 s. Aplicar pela tela continua provado, com a janela e o tempo adicional, no caso da 10.0 | `cenarios.md` §4b (linha de `professor-prova.spec.ts`) |

## Mutações

--faltando: as linhas novas de produção com condição têm bloco (`node tools/processo/mutacoes.ts --faltando` confere): 107 blocos e os motivos abaixo.

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os blocos de JSX com operando (`&& (`) removem o elemento inteiro, ou trocam o operando, e não só o primeiro termo; os que o conferidor lista sem casar (o termo `(` de um `&&`, o elemento depois dele) têm o bloco que troca a condição ou tira a linha, abaixo.

**Sem bloco, com o motivo (cláusula equivalente, só de tipo, ou coberta por bloco que o conferidor não casa):**

- `aplicada.avaliativa` (primeiro termo de `hasAcompanhamento`, em `prova-online.ts`, e de `canAbrirSegundaChamada`): o banco recusa janela fora da avaliativa (`atividade_aplicada_prova_so_na_avaliativa`, 1.0), então `janela != null` já implica avaliativa, e nenhum dado deixa o termo sozinho decidir; fica por clareza. Os outros termos têm bloco.
- `acompanhamento.data?.alunos ?? []` (em `Acompanhamento`, `SegundaChamada` e `EncerramentoDaAtividade`): o `[]` só existe para o tipo; sem ele a renderização lança antes de qualquer asserção, e o caso que cai por exceção não prova a cláusula.
- `lido` (termo do `acao` do cabeçalho, em `aberta && lido && alunos.length > 0`): sem leitura `alunos` é vazio, então `alunos.length > 0` já o implica; os termos `aberta` e `alunos.length > 0` têm bloco.
- `acompanhamento.isPending && <LoadingState …>`, `acompanhamento.isError && !lido && <ErrorState …>` e `lido && alunos.length === 0 && <p …>` (em `Acompanhamento`), e os equivalentes de `SegundaChamada`: **cada termo tem bloco**, e o conferidor só lista o elemento de depois do `&&` e o primeiro termo de um `&&` de três, que não casa. Os blocos tiram a linha (carregando, falha sem leitura, vazio), trocam o termo (`!lido`, `lido`, `lida`, `elegiveis.length === 0`) e tiram o primeiro termo (`isPending`, `isError`: o "Carregando…" fica na tela com o dado, e o `ErrorState` aparece durante o carregamento, com o alerta e o "Tentar de novo"), cada um com o caso que cai. O `!lida` do diálogo da segunda chamada (a releitura que falha, com a lista já na tela, não cobre a lista com o erro: a professora troca de aba por mais de 30 s e volta) tem o bloco que o tira (`{acompanhamento.isError && <ErrorState …>}`), com o caso "a releitura que falha com a lista já na tela"; o bloco `{!lida && <ErrorState …>}` prova o `isError`.
- `alunos.length > 0 && (` e `{marcada && (` (termo `(` do operando): o bloco troca a condição por `(` e o caso cai (o `ul` vazio na turma sem alunos, o seletor de tempo de quem não foi marcado); o conferidor lista o operando por não casar o `(` sozinho.
- `aberta && PODE_ESTENDER[aluno.situacao] && <Estender …>` (termo do elemento): o bloco que tira a linha existe, e os dois blocos de `aberta` e `PODE_ESTENDER` também.
- `aberto !== undefined` e `aplicada.estado === 'aberta'` (termos de `enabled` do encerramento): o primeiro tem bloco (a leitura só sai com a confirmação aberta); o segundo é equivalente, porque o botão "Encerrar a atividade" só existe na atividade aberta.
- `aviso === undefined ? {} : { aviso }` (no `ConfirmDialog` do encerramento) e `alunoId === undefined ? {} : { alunoId }` (no pedido de estender): passar `undefined` e não passar são o mesmo para o diálogo e para o `JSON.stringify`; o ternário existe por causa do `exactOptionalPropertyTypes`, e a frase e o corpo sem `alunoId` têm caso.
- `aluno === undefined ? 'turma' : 'aluno'` (valor inicial do escopo, `useState` do diálogo): com `aluno` indefinido o diálogo da seção nem mostra a escolha, e a abertura em cada alvo é provada pelos casos do efeito.
- **O diálogo de "Estender" e o da "Segunda chamada" são componentes que só existem abertos** (`DialogoDeEstender`, `DialogoDaSegundaChamada`): o escopo, os minutos, a tentativa, a falha, a chave do pedido e os convocados começam do zero a cada abertura **por construção**, e por isso não há linha de reinício (`open()`) a mutar; o que prova é o caso "abrir o diálogo de novo começa outro pedido: o mesmo aluno e os mesmos minutos levam chave nova", e o do recomeço, no e2e. A condição `{aberto && (` de cada um tem bloco.
- `aberto` (o parâmetro do aviso do encerramento, `useAvisoDeQuemAindaFaz`): tem bloco (a leitura só sai com a confirmação aberta).
- `aluno !== undefined` (em `doAluno` e na escolha "Para quem" do diálogo): sem `aluno` o escopo é sempre `turma` e a escolha nem existe; tirar o termo lê `aluno.nomeNaTela` de `undefined` e derruba a renderização (exceção, e não asserção). O `escopo === 'aluno'` tem bloco.
- `atual !== undefined` (primeiro termo da conferência da chave): estreitamento de tipo, porque o `atual.alunoId` da frente lê de `undefined` sem ele; os outros dois termos e o `return atual.chave` têm bloco.
- `{aberto && (` do `Estender` e do `SegundaChamada` (termo `(`): o bloco troca por `{(` e o caso cai (o diálogo fechado nem existe antes do clique).
- `prova === undefined` (primeiro termo do `if` do `confirmar` da segunda chamada) e `if (prova !== undefined) resumo.push(…)`: estreitamento de tipo; sem o termo `prova.janela` lê de `undefined` e lança antes de qualquer pedido (exceção, não asserção). A conferência da janela que dá `undefined` é provada pelo caso "sem convocado, sem janela".
- `prova.duracaoMin === undefined ? {} : { duracaoMin }` (corpo da segunda chamada): `undefined` some no `JSON.stringify`; o ternário é do `exactOptionalPropertyTypes`, e o corpo com e sem duração tem caso.
- `canAbrirSegundaChamada(aplicada) && (` e `aviso !== '' && (` (termo `(`): têm bloco que troca a condição (o botão nas aplicações que não podem, o `role=status` vazio que duplicava o aviso do "Corrigir de novo").
- `tempoAdicional[aluno.alunoId] ?? 0` (valor do seletor): sem o `?? 0` o valor é o texto `undefined`, que não casa com opção, e o navegador mostra a primeira, a mesma "Sem tempo adicional".
- `{elegiveis.length > 0 && (` e `{tentou && … && (` (termo `(`): têm bloco que troca a condição; o conferidor só lista o operando.
- `totais.get(…) ?? 0`, `totais.get(chave) ?? 1` e `vistos.get(chave) ?? 0` (em `alunosDoAcompanhamento`): os mapas têm a chave de todo aluno por construção (o primeiro laço a põe), e o `?? n` só estreita o tipo.

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a atividade prática e a avaliativa sem janela
-  return aplicada.avaliativa && aplicada.janela != null
+  return aplicada.avaliativa
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a prova encerrada não é relida
-  const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), ...(aberta ? { refetchInterval: INTERVALO_DO_ACOMPANHAMENTO_MS, refetchIntervalInBackground: false } : {}) })
+  const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), refetchInterval: INTERVALO_DO_ACOMPANHAMENTO_MS, refetchIntervalInBackground: false })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › com a janela escondida, nenhuma leitura
-  const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), ...(aberta ? { refetchInterval: INTERVALO_DO_ACOMPANHAMENTO_MS, refetchIntervalInBackground: false } : {}) })
+  const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), ...(aberta ? { refetchInterval: INTERVALO_DO_ACOMPANHAMENTO_MS, refetchIntervalInBackground: true } : {}) })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › relógio falso: aos 14 s
-export const INTERVALO_DO_ACOMPANHAMENTO_MS = 15_000
+export const INTERVALO_DO_ACOMPANHAMENTO_MS = 14_000
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › relógio falso: aos 14 s
-export const INTERVALO_DO_ACOMPANHAMENTO_MS = 15_000
+export const INTERVALO_DO_ACOMPANHAMENTO_MS = 16_000
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a prova encerrada mostra a situação, mas sem "Estender"
-{...(aberta && lido && alunos.length > 0 ? { acao: <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} /> } : {})} />
+{...(lido && alunos.length > 0 ? { acao: <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} /> } : {})} />
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a turma sem alunos diz isso
-{...(aberta && lido && alunos.length > 0 ? { acao: <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} /> } : {})} />
+{...(aberta && lido ? { acao: <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} /> } : {})} />
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › carregando, a seção diz que lê
-{acompanhamento.isPending && <LoadingState rotulo="Carregando o acompanhamento da prova…" />}
 {acompanhamento.isError && !lido && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › com falha e sem leitura
-{acompanhamento.isError && !lido && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
 {lido && alunos.length === 0 && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a releitura que falha deixa o último acompanhamento
-{acompanhamento.isError && !lido && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
+{acompanhamento.isError && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a turma sem alunos diz isso
-{lido && alunos.length === 0 && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
 </>
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › carregando, a seção diz que lê
-{lido && alunos.length === 0 && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
+{alunos.length === 0 && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-{lido && alunos.length === 0 && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
+{lido && <p className="text-sm text-sutil">Esta turma ainda não tem alunos para acompanhar. Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui.</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a prova encerrada mostra a situação, mas sem "Estender"
-{aberta && PODE_ESTENDER[aluno.situacao] && <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} aluno={{ aluno, nomeNaTela }} focoDeReserva={focoDeReserva} />}
+{PODE_ESTENDER[aluno.situacao] && <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} aluno={{ aluno, nomeNaTela }} focoDeReserva={focoDeReserva} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-{aberta && PODE_ESTENDER[aluno.situacao] && <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} aluno={{ aluno, nomeNaTela }} focoDeReserva={focoDeReserva} />}
+{aberta && <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} aluno={{ aluno, nomeNaTela }} focoDeReserva={focoDeReserva} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: true, fazendo: true, enviou: false, tempo_esgotado: true }
+const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: true, fazendo: true, enviou: true, tempo_esgotado: true }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: true, fazendo: true, enviou: false, tempo_esgotado: true }
+const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: true, fazendo: true, enviou: false, tempo_esgotado: false }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: true, fazendo: true, enviou: false, tempo_esgotado: true }
+const PODE_ESTENDER: Readonly<Record<SituacaoNoAcompanhamento, boolean>> = { nao_comecou: false, fazendo: true, enviou: false, tempo_esgotado: true }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a atividade prática e a avaliativa sem janela
-if (!hasAcompanhamento(aplicada)) return null
+if (false) return null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a prova aberta mostra "Acompanhar"
-if (!hasAcompanhamento(aplicada)) return null
+if (true) return null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx
teste: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx › a atividade prática não lê o acompanhamento
-const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), staleTime: 0, enabled: aberto && aplicada.estado === 'aberta' && hasAcompanhamento(aplicada) })
+const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), staleTime: 0, enabled: aberto && aplicada.estado === 'aberta' })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx
teste: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx › a leitura relida na abertura vale mais
-const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), staleTime: 0, enabled: aberto && aplicada.estado === 'aberta' && hasAcompanhamento(aplicada) })
+const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), enabled: aberto && aplicada.estado === 'aberta' && hasAcompanhamento(aplicada) })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx
teste: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx › com 3 fazendo
-const fazendo = (acompanhamento.data?.alunos ?? []).filter((aluno) => aluno.situacao === 'fazendo').length
+const fazendo = (acompanhamento.data?.alunos ?? []).filter((aluno) => aluno.situacao !== 'enviou').length
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › "a turma toda" diz o que anda junto
-const doAluno = aluno !== undefined && escopo === 'aluno' ? aluno : undefined
+const doAluno = aluno !== undefined ? aluno : undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a falha fica no diálogo
 const atual = pedidoComChave.current
-if (atual !== undefined && atual.alunoId === alunoId && atual.minutos === minutosPedidos) return atual.chave
+if (atual !== undefined && atual.minutos === minutosPedidos) return atual.chave
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a falha fica no diálogo
 const atual = pedidoComChave.current
-if (atual !== undefined && atual.alunoId === alunoId && atual.minutos === minutosPedidos) return atual.chave
+if (atual !== undefined && atual.alunoId === alunoId) return atual.chave
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a falha fica no diálogo
 const atual = pedidoComChave.current
-if (atual !== undefined && atual.alunoId === alunoId && atual.minutos === minutosPedidos) return atual.chave
+if (atual !== undefined && atual.alunoId === alunoId && atual.minutos === minutosPedidos) return crypto.randomUUID()
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › 0 e 121 minutos são recusados
 definirTentou(true)
-if (quantos === undefined || decidindo.current) return
+if (decidindo.current) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
 definirTentou(true)
-if (quantos === undefined || decidindo.current) return
+if (quantos === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
-decidindo.current = true
 const alunoId = doAluno?.aluno.alunoId
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a falha fica no diálogo
-onSettled: () => (decidindo.current = false),
 })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
-await guardarOAcompanhamento(cliente, aplicada.id, acompanhamento)
 aoFechar()
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
 await guardarOAcompanhamento(cliente, aplicada.id, acompanhamento)
-aoFechar()
 },
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o aluno ou a turma toda, e o efeito do horário
-{ rotulo: 'Para quem', valor: doAluno === undefined ? 'A turma toda' : doAluno.nomeNaTela },
+{ rotulo: 'Para quem', valor: 'A turma toda' },
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o botão da seção estende a turma toda
-{aluno === undefined ? 'Estender a turma toda' : 'Estender'}
+{'Estender'}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
-{...(aluno === undefined ? {} : { 'aria-label': `Estender o tempo de ${aluno.nomeNaTela}` })}
 >
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a falha fica no diálogo
-{...(estender.isError ? { falha: errorText(estender.error, TEXTOS_DA_EXTENSAO) } : {})}
 >
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › 0 e 121 minutos são recusados
-erro={tentou && quantos === undefined ? TEXTO_DOS_MINUTOS_FORA : undefined}
+erro={quantos === undefined ? TEXTO_DOS_MINUTOS_FORA : undefined}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a falha fica no diálogo
-erro={tentou && quantos === undefined ? TEXTO_DOS_MINUTOS_FORA : undefined}
+erro={tentou ? TEXTO_DOS_MINUTOS_FORA : undefined}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a prova que encerrou com o diálogo aberto
-[ErrorCode.ATIVIDADE_ENCERRADA]: 'A prova já foi encerrada, e não dá mais para estender o tempo.',
+[ErrorCode.ATIVIDADE_ENCERRADA]: 'Não foi possível estender o tempo.',
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só a prova avaliativa com janela, já encerrada
-return aplicada.avaliativa && aplicada.estado === 'encerrada' && aplicada.janela != null && aplicada.segundaChamadaDe == null
+return aplicada.avaliativa && aplicada.janela != null && aplicada.segundaChamadaDe == null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só a prova avaliativa com janela, já encerrada
-return aplicada.avaliativa && aplicada.estado === 'encerrada' && aplicada.janela != null && aplicada.segundaChamadaDe == null
+return aplicada.avaliativa && aplicada.estado === 'encerrada' && aplicada.segundaChamadaDe == null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só a prova avaliativa com janela, já encerrada
-return aplicada.avaliativa && aplicada.estado === 'encerrada' && aplicada.janela != null && aplicada.segundaChamadaDe == null
+return aplicada.avaliativa && aplicada.estado === 'encerrada' && aplicada.janela != null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-(acompanhamento.data?.alunos ?? []).filter((aluno) => aluno.situacao === 'nao_comecou'))
+(acompanhamento.data?.alunos ?? []).filter((aluno) => aluno.situacao !== 'enviou'))
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › o pedido leva só os convocados
-definirConvocados((atuais) => (marcada ? [...atuais, alunoId] : atuais.filter((id) => id !== alunoId)))
+definirConvocados((atuais) => [...atuais, alunoId])
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › quem volta a "Sem tempo adicional"
-definirTempoAdicional(percentual === undefined ? resto : { ...resto, [alunoId]: percentual })
+definirTempoAdicional({ ...resto, [alunoId]: percentual as number })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › sem convocado, sem janela
-if (prova === undefined || semConvocados || decidindo.current) return
+if (prova === undefined || decidindo.current) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › dois cliques em confirmar mandam um pedido só
-if (prova === undefined || semConvocados || decidindo.current) return
+if (prova === undefined || semConvocados) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › dois cliques em confirmar mandam um pedido só
-decidindo.current = true
 abrir.mutate({
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-{ rotulo: 'Convocados', valor: escolhidos.length === 0 ? 'Ninguém escolhido ainda' : escolhidos.map(({ nomeNaTela }) => nomeNaTela).join(', ') },
+{ rotulo: 'Convocados', valor: escolhidos.map(({ nomeNaTela }) => nomeNaTela).join(', ') },
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › na tela, a aberta e a segunda chamada não têm o botão
-{canAbrirSegundaChamada(aplicada) && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › "Corrigir de novo" com dois cliques
-{aviso !== '' && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › o pedido leva só os convocados
-{aviso !== '' && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › enquanto lê os alunos
-impedido={lida && elegiveis.length === 0}
+impedido={elegiveis.length === 0}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › o pedido leva só os convocados
-impedido={lida && elegiveis.length === 0}
+impedido={lida}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › dois cliques em confirmar mandam um pedido só
-{...(abrir.isError ? { falha: errorText(abrir.error, TEXTOS_DA_SEGUNDA_CHAMADA) } : {})}
 >
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › quando ninguém é convocável
-{lida && elegiveis.length === 0 && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
 {elegiveis.length > 0 && <ConvocaveisDaTurma {...convocaveis} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › enquanto lê os alunos
-{lida && elegiveis.length === 0 && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
+{elegiveis.length === 0 && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-{tentou && semConvocados && (
+{semConvocados && (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › tempo adicional numa prova sem duração
-{tentou && erros.tempoAdicional !== undefined && (
+{erros.tempoAdicional !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-{marcada && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-erros={tentou ? erros : {}}
+erros={erros}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › a confirmação diz os convocados por nome
-return { abre: '', fecha: '', duracao: aplicada.duracaoMin == null ? '' : String(aplicada.duracaoMin) }
+return { abre: '', fecha: '', duracao: '' }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a situação é texto
-if (aluno.situacao === 'nao_comecou') return 'Não começou'
+if (aluno.situacao === 'nao_comecou') return 'Parado'
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a situação é texto
-if (aluno.situacao === 'enviou') return 'Enviou'
+if (aluno.situacao === 'enviou') return 'Entregue'
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a situação é texto
-if (aluno.situacao === 'tempo_esgotado') return 'Tempo esgotado'
+if (aluno.situacao === 'tempo_esgotado') return 'Faltou'
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a situação é texto
-return aluno.limiteEm === null ? 'Fazendo' : `Fazendo · termina às ${horaNaEscola(aluno.limiteEm, fuso)}`
+return 'Fazendo'
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-const chaveDoNome = (nome: string): string => nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
+const chaveDoNome = (nome: string): string => nome.trim().replace(/\s+/g, ' ')
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-const chaveDoNome = (nome: string): string => nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
+const chaveDoNome = (nome: string): string => nome.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-const chaveDoNome = (nome: string): string => nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
+const chaveDoNome = (nome: string): string => nome.trim().toLocaleLowerCase('pt-BR')
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-const ordenados = [...alunos].sort((a, b) => chaveDoNome(a.nome).localeCompare(chaveDoNome(b.nome), 'pt-BR') || (a.alunoId < b.alunoId ? -1 : a.alunoId > b.alunoId ? 1 : 0))
+const ordenados = [...alunos].sort((a, b) => (a.alunoId < b.alunoId ? -1 : a.alunoId > b.alunoId ? 1 : 0))
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-const ordenados = [...alunos].sort((a, b) => chaveDoNome(a.nome).localeCompare(chaveDoNome(b.nome), 'pt-BR') || (a.alunoId < b.alunoId ? -1 : a.alunoId > b.alunoId ? 1 : 0))
+const ordenados = [...alunos].sort((a, b) => chaveDoNome(a.nome).localeCompare(chaveDoNome(b.nome), 'pt-BR'))
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-return { aluno, nomeNaTela: total > 1 ? `${aluno.nome} (${String(posicao)} de ${String(total)})` : aluno.nome }
+return { aluno, nomeNaTela: aluno.nome }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › em ordem de nome
-return { aluno, nomeNaTela: total > 1 ? `${aluno.nome} (${String(posicao)} de ${String(total)})` : aluno.nome }
+return { aluno, nomeNaTela: `${aluno.nome} (${String(posicao)} de ${String(total)})` }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › maisMinutos soma ao instante
-if (!/^\d+$/.test(texto.trim())) return undefined
+if (texto.trim() === '') return undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › maisMinutos soma ao instante
-return minutos >= EXTENSAO_MINIMA_MIN && minutos <= EXTENSAO_MAXIMA_MIN ? minutos : undefined
+return minutos <= EXTENSAO_MAXIMA_MIN ? minutos : undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › maisMinutos soma ao instante
-return minutos >= EXTENSAO_MINIMA_MIN && minutos <= EXTENSAO_MAXIMA_MIN ? minutos : undefined
+return minutos >= EXTENSAO_MINIMA_MIN ? minutos : undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o efeito de estender
-if (minutos === undefined) return 'Diga quantos minutos a mais: o efeito aparece aqui antes de você confirmar.'
+if (minutos === undefined) return ''
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o efeito de estender
-if (alvo.tipo === 'turma') return `A turma toda ganha ${quanto}: quem está fazendo termina ${quanto} depois, quem ainda não começou terá ${quanto} a mais, e o fim da janela anda junto.`
+if (alvo.tipo === 'turma') return `${nomeDoAlvo}`
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o efeito de estender
-if (aluno.situacao === 'fazendo' && aluno.limiteEm !== null) return `${nome} termina às ${horaNaEscola(maisMinutos(aluno.limiteEm, minutos), fuso)} em vez de ${horaNaEscola(aluno.limiteEm, fuso)}.`
+if (aluno.limiteEm !== null) return `${nome} termina às ${horaNaEscola(maisMinutos(aluno.limiteEm, minutos), fuso)} em vez de ${horaNaEscola(aluno.limiteEm, fuso)}.`
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o aviso do encerramento conta quem faz
-if (fazendo <= 0) return undefined
+if (fazendo < 0) return undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o aviso do encerramento conta quem faz
-return fazendo === 1 ? '1 aluno ainda está fazendo. As respostas salvas dele vão para a correção.' : `${String(fazendo)} alunos ainda estão fazendo. As respostas salvas deles vão para a correção.`
+return `${String(fazendo)} alunos ainda estão fazendo. As respostas salvas deles vão para a correção.`
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a releitura que falha
-queryFn: ({ signal }) => authedGet(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/acompanhamento`, acompanhamentoResponseSchema, signal),
+queryFn: ({ signal }) => authedGet(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/acompanhamentos`, acompanhamentoResponseSchema, signal),
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
-return authedRequest(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/extensoes`, acompanhamentoResponseSchema, { metodo: 'POST', corpo: pedido })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/extensao`, acompanhamentoResponseSchema, { metodo: 'POST', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › o pedido leva só os convocados
-return authedRequest(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/segunda-chamada`, atividadeAplicadaResponseSchema, { metodo: 'POST', corpo: pedido })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(atividadeAplicadaId)}/segunda`, atividadeAplicadaResponseSchema, { metodo: 'POST', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › a leitura que estava no ar quando a extensão saiu
-await cliente.cancelQueries({ queryKey })
 cliente.setQueryData(queryKey, acompanhamento)
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/acompanhamento.ts
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o duplo clique em confirmar
-cliente.setQueryData(queryKey, acompanhamento)
+void queryKey
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-{aberta && PODE_ESTENDER[aluno.situacao] && <Estender aplicada={aplicada} nomeDaTurma={nomeDaTurma} aluno={{ aluno, nomeNaTela }} focoDeReserva={focoDeReserva} />}
 </li>
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a turma sem alunos diz isso
-{alunos.length > 0 && <ListaDoAcompanhamento alunos={alunos} aberta={aberta} aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} />}
+{<ListaDoAcompanhamento alunos={alunos} aberta={aberta} aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={focoDeReserva} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx
teste: apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx › com 3 fazendo
-const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), staleTime: 0, enabled: aberto && aplicada.estado === 'aberta' && hasAcompanhamento(aplicada) })
+const acompanhamento = useQuery({ ...acompanhamentoQueryOptions(aplicada.id), staleTime: 0, enabled: aplicada.estado === 'aberta' && hasAcompanhamento(aplicada) })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o aluno ou a turma toda, e o efeito do horário
-const efeito = efeitoDeEstender(doAluno === undefined ? { tipo: 'turma' } : { tipo: 'aluno', nome: doAluno.nomeNaTela, aluno: doAluno.aluno }, quantos)
+const efeito = efeitoDeEstender({ tipo: 'turma' }, quantos)
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Estender.tsx
teste: apps/web/src/areas/professor/atividades/Estender.test.tsx › o botão da seção estende a turma toda
-{aberto && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-{aberto && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › se a leitura dos alunos falha
-{acompanhamento.isError && !lida && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
 {lida && elegiveis.length === 0 && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › enquanto lê os alunos
-{acompanhamento.isPending && <LoadingState rotulo="Carregando os alunos da turma…" />}
 {acompanhamento.isError && !lida && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › quando ninguém é convocável
-{elegiveis.length > 0 && <ConvocaveisDaTurma {...convocaveis} />}
+{<ConvocaveisDaTurma {...convocaveis} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › quando ninguém é convocável
-{elegiveis.length > 0 && <CamposDaJanela valor={campos} aoMudar={aoMudarCampos} erros={tentou ? erros : {}} desligados={desligados} />}
+{<CamposDaJanela valor={campos} aoMudar={aoMudarCampos} erros={tentou ? erros : {}} desligados={desligados} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › sem convocado, sem janela
-{tentou && semConvocados && (
+{tentou && (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › dois cliques em confirmar mandam um pedido só
-{tentou && erros.tempoAdicional !== undefined && (
+{tentou && (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-{lida && elegiveis.length === 0 && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
+{lida && <p className="text-sm break-words text-apoio">{TEXTO_DE_NINGUEM_PARA_CONVOCAR}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o efeito de estender
-if (aluno.situacao === 'fazendo' && aluno.limiteEm !== null) return `${nome} termina às ${horaNaEscola(maisMinutos(aluno.limiteEm, minutos), fuso)} em vez de ${horaNaEscola(aluno.limiteEm, fuso)}.`
+if (aluno.situacao === 'fazendo') return `${nome} termina às ${horaNaEscola(maisMinutos(aluno.limiteEm as string, minutos), fuso)} em vez de ${horaNaEscola(aluno.limiteEm as string, fuso)}.`
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › a situação de cada aluno é texto
-{acompanhamento.isPending && <LoadingState rotulo="Carregando o acompanhamento da prova…" />}
+{<LoadingState rotulo="Carregando o acompanhamento da prova…" />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/Acompanhamento.tsx
teste: apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx › carregando, a seção diz que lê
-{acompanhamento.isError && !lido && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
+{!lido && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › só quem não começou é convocável
-{acompanhamento.isPending && <LoadingState rotulo="Carregando os alunos da turma…" />}
+{<LoadingState rotulo="Carregando os alunos da turma…" />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › enquanto lê os alunos
-{acompanhamento.isError && !lida && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
+{!lida && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › sem convocado, sem janela
-<fieldset aria-describedby={tentou && semConvocados ? idDoErro : undefined} className="flex min-w-0 flex-col gap-2">
+<fieldset aria-describedby={tentou ? idDoErro : undefined} className="flex min-w-0 flex-col gap-2">
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/SegundaChamada.tsx
teste: apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx › a releitura que falha com a lista já na tela
-{acompanhamento.isError && !lida && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
+{acompanhamento.isError && <ErrorState erro={acompanhamento.error} tentando={acompanhamento.isFetching} aoTentarDeNovo={() => void acompanhamento.refetch({ cancelRefetch: false })} />}
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| Implementador, 11.0 (observação do relatório da 9.0) | Na aplicação de uma **segunda chamada**, o acompanhamento e a `participacao` ainda contam a **turma inteira**, e não só os convocados: o painel mostra os não convocados como "Não começou" e oferece "Estender" a eles, e "N de M enviaram" usa o total da turma. A tela não tem como saber quem foi convocado (o contrato não traz), e esconder "Acompanhar" na segunda chamada tiraria o acompanhamento de quem importa. A correção é na API (a leitura filtrar pelos convocados e a `participacao` contar só eles), e depois a tela já acompanha | `TODO.md` (item da API do acompanhamento, 9.0/5.0), para a correção da próxima rodada da spec |
| Implementador, 11.0 | O acompanhamento devolve a prova cortada pela professora como `enviou`, e por isso a segunda chamada não a oferece (divergência acima). Expor no contrato uma situação a mais (ou o `envio` da tentativa) deixaria a tela convocá-la sem ofertar quem enviou de verdade | `TODO.md` (junto do item acima) |
| Vários revisores, 1ª rodada (ordem `.processo/ordens/11_task-r1.md`, "Sem aplicar") | Os homônimos por "(1 de 2)" (campo no contrato); quem já enviou uma segunda chamada anterior aparecer como `nao_comecou`; o teste de API do autor da extensão; `Estender` em `tempo_esgotado` com a prova aberta; o aviso de "mostrando a última leitura"; o "Conferindo quem ainda faz…"; a professora no cenário k6; a chave de uma nova abertura do diálogo; o `Retry-After` do `shouldRetry`. Todos são da API, de outro arquivo ou comportamento novo | `TODO.md`, um item por linha, logo depois do item do acompanhamento da segunda chamada |
| `revisor-geral`, 2ª rodada | `Acompanhamento.test.tsx`: o caso do relógio falso confere `leituras(rede)` direto depois de `passar(1_000)` e depende de o pedido sair dentro do `act`; se virar intermitente, o `waitFor` com o avanço exato de 1 s é o meio-termo | Sem aplicar: passa no carimbo; só se virar intermitente |
| `revisor-geral`, 2ª rodada | `e2e/professor-prova.spec.ts`: `minutosDoDiaNaEscola` fixa `America/Sao_Paulo`; ler o fuso da escola montada se ele for configurável | `TODO.md` (o fuso do `montarEscola` é o de `e2e/support`) |
| `privacy-guardian`, `tenancy-guardian`, `frontend-reviewer`, `infra-guardian` e `conformidade-reviewer`, 2ª rodada | O campo de homônimos fora de matrícula e sobrenome, o filtro da API pelos convocados vindo do contexto autenticado, a prioridade de "mostrando a última leitura" e do "Conferindo quem ainda faz…", a medição no k6 e o teste do autor da extensão | Já nos itens do `TODO.md` desta tarefa; nada a acrescentar |
| revisor-geral (3ª) | `SegundaChamada.test.tsx`, caso "a releitura que falha com a lista já na tela…": o comentário diz que o `staleTime` é de 30 s, mas o valor vem da configuração geral do `QueryClient`, e não de `acompanhamentoQueryOptions`; se esse padrão mudar, o avanço de 31 s deixa de disparar a releitura e o caso passa a dar verde pelo motivo errado (hoje o `waitFor` das duas leituras segura). Prender o `staleTime` nas opções da consulta deixaria a dependência explícita | `TODO.md`: mexe em `api/acompanhamento.ts` (produção) por uma garantia de teste; não é o que a tarefa muda |
| revisor-geral (3ª) | A asserção `toEqual([''])` do mesmo caso depende de existir exatamente uma região de alerta vazia no diálogo; conferir só que nenhum alerta tem texto (`every(texto => texto === '')`) a deixaria menos frágil | `TODO.md` (higiene de teste; passa hoje, e o caso de "enquanto lê os alunos" usa a mesma forma) |
| test-engineer (3ª) | `e2e/professor-prova.spec.ts:221-232`: ao trocar de prova o TanStack provavelmente cancela a leitura da primeira antes do `liberar()`, e então o `requestfailed` vence a corrida e a resposta atrasada nunca chega à página; o caso segue útil (se a chave perder o id, o "Fantasma Antigo" aparece), mas não diz qual caminho aconteceu. Gravar qual evento venceu e escrevê-lo no comentário | `TODO.md` (esclarece o comentário do caso; não muda o que ele prova) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 03:32:43 | 2026-11-28 03:33:19 | `tenancy-guardian` | 1 | APROVADO | abc742bba3cece08c |
| 2026-11-28 03:32:29 | 2026-11-28 03:33:44 | `privacy-guardian` | 1 | APROVADO | aa498aa3e757f9ed6 |
| 2026-11-28 03:32:32 | 2026-11-28 03:33:46 | `frontend-reviewer` | 1 | APROVADO | af0d28ea676929793 |
| 2026-11-28 03:32:46 | 2026-11-28 03:33:52 | `conformidade-reviewer` | 1 | APROVADO | acf7ba41f8996e9b1 |
| 2026-11-28 03:32:39 | 2026-11-28 03:34:01 | `revisor-geral` | 1 | REPROVADO | a2984d896cad42f87 |
| 2026-11-28 03:32:50 | 2026-11-28 03:34:14 | `infra-guardian` | 1 | APROVADO | a0ae7592bcaa455a6 |
| 2026-11-28 03:32:36 | 2026-11-28 03:36:54 | `test-engineer` | 1 | REPROVADO | abfbc5e0a66da5ae4 |
| 2026-11-28 03:55:04 | 2026-11-28 03:55:35 | `revisor-geral` | 2 | APROVADO | a763d8f58037793e9 |
| 2026-11-28 03:55:23 | 2026-11-28 03:55:47 | `privacy-guardian` | 2 | APROVADO | adc47fc1d720767a0 |
| 2026-11-28 03:55:31 | 2026-11-28 03:55:50 | `frontend-reviewer` | 2 | APROVADO | a61b45c1a646eed54 |
| 2026-11-28 03:55:38 | 2026-11-28 03:55:52 | `tenancy-guardian` | 2 | APROVADO | a9fa5861f6743b7de |
| 2026-11-28 03:55:53 | 2026-11-28 03:56:08 | `infra-guardian` | 2 | APROVADO | a517e9f8d0aeec691 |
| 2026-11-28 03:55:46 | 2026-11-28 03:56:10 | `conformidade-reviewer` | 2 | APROVADO | ab26c506c74b8d838 |
| 2026-11-28 03:55:15 | 2026-11-28 03:57:00 | `test-engineer` | 2 | REPROVADO | afe80fdbda7cf7543 |
| 2026-11-28 04:24:39 | 2026-11-28 04:25:05 | `revisor-geral` | 3 | APROVADO | a58df7055f76f68b2 |
| 2026-11-28 04:24:32 | 2026-11-28 04:25:48 | `test-engineer` | 3 | APROVADO | ac2fe450a95312dc7 |
