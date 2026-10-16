# Tech Spec — Telas do aluno e primeiro acesso

**PRD:** `tasks/prd-telas-do-aluno-e-primeiro-acesso/prd.md`
**Status:** revisada pelos guardiões em 13/10/2026 (rodada 4, `revisao-spec.md`) e aprovada por delegação do Joaquim; ele revê ao ler, a começar pela seção 12b
**Tamanho:** acima do teto de 2.000 palavras, com aceite por delegação do Joaquim (13/10/2026). Motivo: a revisão dos guardiões exigiu por escrito a data que sobrevive ao fim de um vínculo, a escrita sem ano letivo, o texto do aviso, os estados da `BemVindo`, o custo do Início e as regras da onça. O detalhe de cada teste fica nas tarefas.

## 1. Resumo da abordagem

Quase tudo é `apps/web` e `e2e/`. As telas do aluno são recompostas com as peças da X1 e com duas consultas que
**já existem**: `GET /v1/minhas-atividades` e `GET /v1/tutor/memoria`, que a web ainda não lia (o resultado por
tarefa). O uso do dia fica só na tela do Tutor (seção 7c). A introdução é uma peça só, com uma
tabela de passos por papel, numa tela de foco **dentro** da casca. O backend é mínimo: uma coluna em `usuario`, um
campo no `GET /v1/eu` e uma rota de escrita. O desvio da primeira entrada mora só em `paginas/Inicio.tsx`: as
páginas públicas não mudam.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/nucleo` (`db/schema/usuario.ts`, `drizzle/0037_*`, `titular/leitura-do-titular.ts`) | alterado | a coluna, a migration e o arquivo do titular |
| `packages/shared` (`sessao/eu.ts`, `permissao/matriz.ts`) | alterado | o campo do `/v1/eu` e a ação `eu.concluir_introducao` |
| `apps/api/src/sessao` (`eu.*`, `resolucao-de-tenant.repository.ts`) | alterado | leitura e escrita da data |
| `apps/web/src/areas/aluno/` | novo e alterado | `Inicio`, `Eu`, `BemVindo`; `Atividades`, `Atividade`, `rotas` |
| `apps/web/src/areas/professor/`, `coordenacao/` | novo | `BemVindo` e a rota dele |
| `apps/web/src/componentes/` | novo | `introducao/`, `TelaDeFoco`, `Balao`, `Comemoracao`, `TamanhoDaLetra`, poses em `onca/` |
| `CascaDaEscola.tsx`, `caminhos.ts`, `areas/navegacao.ts`, `paginas/Inicio.tsx` | alterado | foco, endereços, lugares, desvio |
| `apps/web/src/letra.ts`, `index.html`, `estilos.css` | novo e alterado | o tamanho da letra |
| `e2e/`, `tools/vitrine/`, `docs/` | alterado | fixtures, specs, documentos |

## 3. Modelo de dados

```
Usuario   + introducaoVistaEm timestamptz?   (escolaId já existe; sem anoLetivoId: a pessoa não é do ano)
```

Uma migration: `alter table usuario add column introducao_vista_em timestamptz`, sem valor padrão nem índice.

**Por que no usuário.** O vínculo é por turma e ano: a introdução voltaria em janeiro. A conta não serve ao aluno,
que não tem conta, e é a credencial global sem escola (a exceção da regra 10): seriam dois lares para o mesmo
fato. O usuário é a pessoa numa escola, com o papel dela, e é o `sub` do token.

**Duas escolas.** O POST toca só o usuário da sessão. O `/v1/eu` devolve a data **mais antiga** entre a dele e a
dos outros usuários ativos da mesma conta **com o mesmo papel**, os mesmos que `acessosDaConta` lista para o seletor, lidos por um método próprio. Aluno
tem `conta_id` nulo: para ele vale só a data da própria linha.

**Primeira saída (vínculo encerrado).** Quando o `GET /v1/eu` acha a data emprestada e a linha da própria sessão está
nula, ele grava nessa linha `coalesce(introducao_vista_em, now())`, a mesma instrução do POST (o mesmo método de
repository, que não recebe data), no escopo da própria sessão. **Nunca grava o valor emprestado** de outra escola:
dado de A não é persistido em B. Enquanto A está ativa, o GET continua respondendo a mais antiga. Quando o vínculo de A
termina, B já tem a sua data e a introdução não reabre (RF12). **Ressalva:** só vale para quem leu o `/v1/eu` em B
enquanto A estava ativa; vínculo desativado ou com eliminação agendada não empresta. Se a gravação do GET falha, ele
devolve a data lida, sem gravar. A leitura dos acessos da conta com a data é um método próprio, que filtra o papel na
query e devolve só a data mais antiga, sem passar pelo `escolher` do login nem pelo esquema estrito do acesso; a
justificativa do `@SemEscopo` o registra.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/eu` | coordenador, professor, aluno | — | os campos de hoje e `introducaoVistaEm` (data e hora, ou nulo) |
| POST | `/v1/eu/introducao` | os três (`eu.concluir_introducao`, `proprio`; `rede`: `nunca`) | corpo vazio, estrito | `{ introducaoVistaEm }`, a mesma data que o GET devolveria |

`acessos` não ganha campo. Sem linha achada, o POST responde `NAO_AUTENTICADO`, como `EuService.obter`.

## 5. Fluxo

**Primeira entrada.** Todo login termina em `/`. `Inicio` lê o `/v1/eu`: com a data nula, troca o endereço por
`<área>/bem-vindo`; senão, pela tela de abertura (o aluno, `/aluno/inicio`). Endereço aberto direto não desvia.

**Concluir ou pular.** `POST /v1/eu/introducao`; a resposta entra no cache `['eu']` e a pessoa vai para a tela de
abertura. Se a gravação falha, ela vai do mesmo jeito, e a introdução volta na próxima entrada. Sair da conta no
meio não grava.

**Rever.** Um link para o mesmo endereço. Com a data já gravada, todo passo tem "Fechar", e o POST repetido não
muda nada.

**Escrita.** Uma instrução, síncrona: `update usuario set introducao_vista_em = coalesce(introducao_vista_em,
now()) where escola_id = <contexto> and id = <contexto> returning introducao_vista_em`. A do POST e a do GET usam
`identidadeDaRequisicao()`, nunca `sessaoDaRequisicao()` nem `exigirAnoEmCurso()`: a escola recém-criada ainda não tem
ano em curso e precisa gravar.

**Tela de foco.** `caminhos.ts` lista os três endereços; neles a casca não desenha lateral nem barras, e mantém o
`<main>`, o relógio de inatividade e o `lembrarQuemEsta`. "Sair" fica no topo da `TelaDeFoco`.

**Tamanho da letra.** Chave `educa.letra` (`grande` ou `maior`; ausente é Padrão; voltar a Padrão apaga). O script
em linha da X1 a lê e, se o caminho começa por `/aluno`, escreve `data-letra` no `<html>`; `useTamanhoDaLetra()`,
montado na área do aluno, mantém o atributo e o tira ao sair. No CSS, `font-size` de 112,5% e de 125%.

## 6. Isolamento (obrigatório)

Leitura e escrita da própria pessoa: `escola_id` e `id` do contexto, sem id no caminho nem no corpo (regra 10, item
3). A única leitura entre escolas é a da data nos usuários ativos da mesma conta, por um método próprio,
`@SemEscopo`, com a justificativa que cita a data e a entrada nova na lista de `resolucao-de-tenant.repository.test.ts`. Nada de outra escola sai no DTO.

Testes de isolamento (integração): com o contexto de B, o usuário de A não é alterado; **dois usuários da mesma
escola e do mesmo papel (dois alunos; dois professores): um faz o POST, a linha do outro fica nula e o `/v1/eu` dele
devolve nulo** (prova o `id = <contexto>`); a professora de A e B marca em A, o `/v1/eu` em B devolve a data e a grava
na linha de B **com `now()`, nunca com a data de A** (data antiga pré-gravada em A: a linha de B fica não nula e
diferente); a professora de A e B e um colega da mesma escola B sem data: ela marca em A e lê B, a linha do colega fica
nula e o `/v1/eu` dele devolve nulo (prova o `id = <contexto>` do GET); **ordem inteira: marca em A, GET em B, A
desativada, GET em B devolve a data**; separado: marca em A, A desativada, primeiro GET em B reabre, que é o declarado;
B sem ano em curso com a professora de A entrando grava sem erro; professora em A e coordenadora em B não herdam
uma da outra; outra conta com a data gravada não empresta; a eliminação agendada não empresta; escola sem ano em
curso e escola entre anos (um encerrado, um planejado): POST 200 e GET com a data.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais tocados | `usuario.nome` (o primeiro nome, na saudação; já vem no `/v1/eu`) |
| Novos campos (atualizar `docs/lgpd.md`) | `usuario.introducao_vista_em`: linha nova no mapa, ao lado da marca da eliminação agendada |
| O que vai para log | nenhuma linha nova |
| O que entra em auditoria | nada: não é leitura de dado alheio nem decisão (regra 20, item 10) |
| O que é enviado a provedor externo | nada |
| Retenção e expurgo | a da tabela `usuario` (`pessoa_desativada`): sai com a linha, no expurgo e na eliminação. O catálogo não ganha classe |
| Arquivo do titular | a coluna entra em `LEITURAS_DO_ARQUIVO.usuario.colunas`; a versão `coordenacao` não a traz para professor (D64), e traz a do aluno, que é dado dele no pedido de acesso (LGPD, art. 18); o teste de cobertura prende as duas escolhas |
| Autorização por objeto | não há objeto: a rota age sobre quem está no token |
| DTO de saída | `introducaoVistaEm`, só da própria pessoa |

No navegador entra uma chave sem identificador, `educa.letra`, gravada só por escolha.

## 7b. Conformidade CNE (quando há IA no caminho do aluno)

O Tutor continua supervisionado, sem aprovação uma a uma (D47), e nenhuma chamada de modelo é nova. O que esta
spec escreve é texto sobre a IA, em `.ts` com teste: a faixa usa `TEXTO_DA_SUPERVISAO`, a introdução repete a
mesma frase, e a avaliação aberta usa `AVISO_DA_AVALIACAO`. **As falas da onça são texto fixo**: nenhuma varia com
presença, ausência, acerto ou tempo de uso. O teste de unidade dos textos dos três papéis reprova afirmar ser pessoa,
professor ou amigo; prometer voltar, esperar ou estar sempre ali; e termos de vínculo ou saudade. O passo 1 do aluno
diz que o Tutor é um programa e pode errar, com teste. **O aviso de privacidade** diz, em frases de até 15 palavras:
"o resultado das tarefas" (nunca "nota": não existe `Nota`, D46); "o que você escreve para o Tutor e o que ele
responde"; que a conversa com o Tutor fica de 6 a 24 meses e a escola escolhe, e que as tarefas ficam pelo tempo que a escola escolhe, sem chamada nova de API; que o texto e as habilidades a rever passam
por um programa de IA de uma empresa contratada (D62); e que o professor da turma vê as tarefas e o resultado. O teste
exige essas frases, recusa "nota" e tira o piso e o teto de `CATEGORIAS_DE_RETENCAO.conversa_tutor`, sem número à mão:
o intervalo não aparece numa frase sem "Tutor". "Como estou indo" lê só o que `/v1/tutor/memoria` entrega com
`resultado` não nulo (lote aprovado) e mostra `aReforcar` como veio: a web não calcula limiar. Os `sinais` da
memória **não** são mostrados (F9). A comemoração depende só de o envio ter sido confirmado nesta tela. A pose
`acolhendo` não é desenhada. A pendência 12 de `docs/aia/tutor.md` fecha na tarefa do aviso.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Está no caminho quente? | login e tutor, de leve |
| Carga na manhã de segunda | o `/v1/eu` lê uma coluna a mais na mesma consulta, e grava uma vez só `now()` na própria linha quando a data veio de outra escola. O Início **não** lê `GET /v1/tutor/conversa`: a leitura conta as trocas do mês da turma inteira (mais de 10 mil linhas no fim do mês) e iria para a rajada de login das 7h30 (regra 80). O "Hoje: N de 60" fica na tela do Tutor, onde já é lido. O Início só lê `minhas-atividades`, que o aluno já lia ao entrar. O seed de `infra/scripts/carga-login.ts` ganha ano em curso nas três escolas, turmas de 35, vínculo `confirmado` para as contas de aluno da rajada (com a introdução já vista) e atividades aplicadas que encham a primeira página, algumas com tentativa e resposta |
| Fila, limite por escola | nenhuma fila; o limite geral |
| Rate limit | `POST /v1/eu/introducao` usa o contador geral, por usuário e por escola, sem contador próprio |
| Corridas de concorrência | dois POST juntos (clique duplo, duas abas): o segundo espera a trava da linha, e o `coalesce` mantém a primeira data; os dois respondem 200 com a mesma data. Cenário com `Promise.all`. O GET de B, em duas abas logo depois do login ou junto de um POST em B, também mantém a primeira data (`Promise.all` de dois GET) |
| Índices novos, migration | nenhum índice; coluna nula, que o código anterior ignora |
| Quando cada dependência cai | banco: o `/v1/eu` falha e a tela mostra o `EstadoErro` de hoje; o POST que falha não prende ninguém. Tutor fora: o Início não depende dele |
| Métrica, alerta, teste de carga | `infra/k6/login-7h30.js`: o aluno, depois do login, faz também `/v1/eu` e a primeira página de `minhas-atividades`, o que o Início lê; o k6 exige 200 com página não vazia em `minhas-atividades` e 200 em `/v1/eu`, contados em `respostas_inesperadas`. As duas chamadas novas entram em `autenticada_duracao`, com a tag `name` da rota, e a fase `rajada` ganha o limite `autenticada_duracao{grupo:rajada}: p(95) < P95_MAXIMO_DO_LOGIN_MS` (1.000 ms, o mesmo que já vale para B e C na `base`) e o mesmo limite só para a rota `GET /v1/minhas-atividades`, para ela não se esconder na média das outras. A gravação do `GET /v1/eu` que falha conta em `eu.introducao_falha` (contador sem rótulo: nem escola nem pessoa), com o painel "Datas da introdução que não gravaram" em `infra/grafana/paineis/fundacao.json`; sem alerta, porque a resposta sai igual e a introdução só reabre se a pessoa deixar a outra escola antes de a próxima leitura gravar |

## 8. Uso de IA (quando aplicável)

Nenhum caso de uso novo e nenhuma chamada de modelo.

## 9. Frontend

**Lugares.** `NAVEGACAO.aluno`: Início (`/aluno/inicio`, também selecionado em `/aluno/tutor`), Tarefas
(`/aluno/atividades`) e Eu (`/aluno/eu`, também em `/aluno/privacidade`). `RODAPE_DA_LATERAL.aluno` fica vazio, e
`/aluno/minha-turma` redireciona. A tarefa dos lugares cria `Inicio.tsx` e `Eu.tsx` com o que existe (a escolha da
atividade e o cartão da turma), para as tarefas seguintes não tocarem em arquivo comum.

**Início**: saudação fixa ("Oi, <nome>."), faixa presa e "Para fazer" (até três, da primeira página), cada uma com
"Pedir ajuda ao Tutor", sem número de uso; a avaliação aberta leva o `AVISO_DA_AVALIACAO` e o caminho continua. Limite
do dia e função suspensa seguem avisados na tela do Tutor. **Leituras** (`staleTime`, `refetchOnWindowFocus`): `['eu']`
e `minhas-atividades`, 60 s e `false`; `tutor/memoria` em Eu, 5 min e `false`; o envio da tarefa e a sessão esvaziam
as chaves, como hoje. Aluno sem turma: `minhas-atividades` responde vazio e `tutor/memoria` responde
`NAO_ENCONTRADO`, que Eu trata como "sem resultado", não como erro. **Tarefas**: `separarAtividades` passa a três grupos; `Linha` com `Ladrilho` na cor da matéria
(`materia.ts`: do nome da disciplina para família e ícone `lucide`, com reserva neutra). **Tarefa aberta**: só a
moldura e a `Comemoracao`. **Eu**: cartão da turma, "Como estou indo" e as quatro linhas; "Ajustes" abre um
`Dialogo` com `Aparencia` (X1) e `TamanhoDaLetra`.

**Peças novas**, em `componentes/`, fora da entrada: `TelaDeFoco`, `Balao`, `Comemoracao` (os `@keyframes` num CSS
ao lado, só `transform` e `opacity`, uma vez), `introducao/Introducao` e as três poses da onça. **As três poses usam o mesmo rosto
neutro da cabeça da X1; só o corpo muda** (D80, item 3). A introdução usa acenando e apontando e termina parada. A pose
`comemorando` só é desenhada pela `Comemoracao`, e a `Comemoracao` só é importada por `areas/aluno/Atividade.tsx`. A `Introducao`
recebe passos (`pose`, `fala`, `conteudo`, `obrigatorio`) e avisa "concluiu" ou "pulou"; a fala é o `h1`, recebe o
foco a cada passo, e Enter continua. Os textos moram em `.ts` com teste.

**Estados da `BemVindo`** (os três papéis). Ela lê `['eu']`, do cache se o desvio já o leu, para saber se está
"revendo". *Carregando:* a fala do passo 1, "Sair" à vista e nenhum botão decidido pelo modo (sem "Fechar" nem "Pular").
*Erro:* `EstadoErro` com "Tentar de novo", "Voltar para a abertura" (o primeiro lugar do papel) e "Sair". *Data
desconhecida:* vale o modo primeira vez. *Com dado:* os passos. Sair nunca é mais difícil que entrar (D59). O desvio em
`paginas/Inicio.tsx` espera o `['eu']`: não pisca o Início e não usa data velha depois de POST que falhou.

**Nomes que não mudam:** um `<main>`; `navigation "Seções"`; os `data-*` de hoje; "Enviar a atividade", "Atividade
enviada", "Pedir ajuda ao Tutor nesta questão". **Mudam:** `h1` e título "Atividades" para "Tarefas"; as regiões
"Para responder" e "Já feitas"; a fixture `esperarAtividades`, que vira `esperarInicioDoAluno`.

**Chromebook e celular.** Telas novas por `lazy()` (`tela-<área>-*`, 30 kB); nada da entrada importa a onça. Tudo
provado a 360 px, também com a letra Maior.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | os três grupos; `materia.ts`; os textos dos três papéis (falas sem pessoa, volta ou saudade) e o aviso (frases, prazo, IA da empresa, quem vê, sem "nota"); `letra.ts`; navegação e caminhos |
| Componente (jsdom) | os quatro estados de Início, Tarefas, Eu e `BemVindo`; a comemoração; a `Introducao` (ordem, foco, botões iguais, obrigatório, rever); a casca em foco; o rosto de cada pose igual ao neutro |
| Arquitetura | `comemorando` só pela `Comemoracao`; a `Comemoracao` só em `Atividade.tsx`; a entrada não importa a onça |
| Integração | a rota (repetida, em paralelo, por papel, sem ano em curso), o `/v1/eu` com a data e a primeira saída, o arquivo do titular |
| Carga | `infra/k6/login-7h30.js` com `/v1/eu` e `minhas-atividades` depois do login do aluno, em `autenticada_duracao`, e o p95 delas abaixo de `P95_MAXIMO_DO_LOGIN_MS` na fase `rajada` |
| E2E | os lugares; a primeira entrada por papel; o tamanho da letra; e os specs do aluno, `areas`, `meus-dados`, `escola-montada` e `roteiro-da-demonstracao`, mudando só rótulo e caminho; os três passos obrigatórios, o passo 4 (pular sem escolher não grava; "Maior" aplica na hora e a 360 px não rola) e a segunda entrada em `browser.newContext()` |
| Isolamento | os da seção 6, com os dois usuários da mesma escola e a mutação que tira `id = <contexto>` |
| Matriz e ramos que o HTTP não alcança | "a rede é recusada" é provado pela matriz (`matriz.test.ts` contra `matriz.expectativa.ts`), porque a API não tem sessão de rede; o `NAO_AUTENTICADO` de "sem linha achada" (seção 4) é provado em unidade, com o repository de mentira, porque a guarda acabou de ler o usuário |

As fixtures do e2e e a vitrine passam a criar pessoa **com a introdução vista**; quem testa a introdução pede o
contrário, e pessoa criada pela tela passa por ela no teste.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 00, 40, 80 | seções 4, 10 e 7c | nenhum | — |
| 10 | seção 6 | a leitura da data atravessa escolas pela conta, num método próprio `@SemEscopo`; a alternativa (coluna na `conta`) está recusada na seção 3 | `docs/modelo-de-dados.md` |
| 20 | seção 7 | nenhum | `docs/lgpd.md` |
| 50 | seção 9 | o mockup é contrariado nos 14 pontos do PRD | PRD, seção 6 |
| 70 | seção 7b | nenhum | `docs/aia/tutor.md` |

## 12. Premissas não verificadas

- `⚠️ NÃO VERIFICADO` — os nomes de arquivo das peças da X1 (`Linha`, `Ladrilho`, `Aparencia`, `componentes/onca/`,
  `tema.ts`): a X1 ainda não tem tarefas. Cada tarefa confere antes de importar
- `⚠️ NÃO VERIFICADO` — se a X2 ou a X3 já pousaram quando a introdução for escrita. Por isso "onde fica cada
  coisa" sai de `NAVEGACAO[papel]`, e não de texto fixo
- `⚠️ NÃO VERIFICADO` — o passo "quem dá a aula acompanha" contra o que o professor vê de fato: a tarefa confere
  com `packages/shared/src/tutor/uso.ts` e `sinal.ts`

## 12b. Decididas por delegação, que o Joaquim revê

Delegação de 12/10/2026 e de 13/10/2026 ("você vai revisar e aprovar as specs X3 e X4"). Mudam critério do PRD:

1. **RF12, "uma vez só" com vínculo encerrado:** a primeira saída da seção 3. O `GET /v1/eu` grava `now()` (nunca a
   data de A) na linha da própria sessão; a introdução não reabre quando o vínculo de A termina, **desde que a pessoa
   tenha entrado em B enquanto o vínculo de A estava ativo**.
2. **RF14, texto do aviso:** as frases da seção 7b (resultado das tarefas, o que escreve ao Tutor, prazo da conversa
   e das tarefas, IA de uma empresa contratada, quem vê), sem "nota".
3. **RF19, a onça:** mesmo rosto neutro nas três poses; a introdução só acenando e apontando, e termina parada;
   `comemorando` só na `Comemoracao` da entrega; falas fixas e sem promessa de volta nem vínculo.
4. **RF4 e RF5, o Início sem `tutor/conversa`:** o "Hoje: N de 60" fica só no Tutor; o Início avisa só a avaliação
   aberta, e limite do dia e função suspensa são avisados na tela do Tutor, com o caminho até ela sempre aberto.

## 13. Riscos técnicos

- **A introdução quebra toda entrada do e2e.** Por isso a primeira tarefa já põe a data nas fixtures
- **O `tenancy-guardian` veta a leitura pela conta.** Saída: a introdução passa a ser por escola, e o professor de
  duas escolas a pula na segunda; o RF12 muda junto
- **A comemoração é vetada.** Sai da tarefa aberta
- **Letra Maior estoura a 360 px**: corrige-se a tela, e não o tamanho
