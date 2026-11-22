# Tarefa 8.0 — A aba Uso da Operação mostra o uso de IA por escola e os 12 meses

**Funcionalidade:** camada-ia · **Depende de:** 5.0, 7.0
**Subagentes obrigatórios:** `frontend-reviewer`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** pequeno

## Objetivo

Na aba Uso, cada escola ganha o grupo "IA (hoje, até agora, e mês)", com chamadas, tokens, reais, custo por aluno contra o
valor, porcentagem e o que a reserva atendeu; a ordem por custo; "Definir orçamento" na célula sem orçamento, que abre o
diálogo da 7.0; e "Ver meses", com os 12 meses anteriores.

## Contexto necessário

- `techspec.md` §4 (as duas primeiras linhas), §9 ("Operação, Uso")
- `prd.md` RF11
- `cenarios.md` §4 ("Operação, Uso", erro, celular e acessibilidade)
- `.claude/rules/50-frontend.md`, `docs/interface.md` §5a
- Código: `apps/web/src/operacao/pages/Uso.tsx`, `apps/web/src/operacao/format.ts` (R$ e números), `apps/web/src/operacao/api/painel.ts`

## Subtarefas

- [x] 8.1 — O grupo "IA" na tabela e no cartão do celular; a infra segue "último dia fechado", e a tela diz
- [x] 8.2 — A ordem por custo na barra; "sem orçamento definido" com "Definir orçamento"; "sem aluno ativo"
- [x] 8.3 — "Ver meses": a lista dos 12, o vazio e "sem retrato (antes da medição)"
- [x] 8.4 — `docs/interface.md` §5a (Uso), com os textos da `cenarios.md` §4
- [x] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/operacao/pages/Uso.tsx`, `apps/web/src/operacao/pages/Uso.test.tsx` | alterado |
| `apps/web/src/operacao/components/MesesDeIa.tsx`, `apps/web/src/operacao/components/MesesDeIa.test.tsx` | novo |
| `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/api/painel.test.ts`, `apps/web/src/operacao/format.ts`, `apps/web/src/operacao/textos.ts` | alterado |
| `e2e/operacao-uso.spec.ts` | alterado |
| `docs/interface.md` | alterado |
| `packages/shared/src/operacao/painel.ts` e `.test.ts`; `apps/api/src/operacao/painel/painel.repository.ts` e `painel.service.ts`; `apps/api/test/painel-leitura.int.test.ts`, `apps/api/test/contracts.test.ts` | alterado (a rede e o orçamento no item do uso: a divergência abaixo) |
| `apps/web/src/operacao/pages/Escolas.tsx`, `Escolas.test.tsx`, `components/NavegacaoDaLista.tsx`, `components/CascaDaOperacao.tsx`, `__fixtures__/render-operacao-screen.tsx`, `textos.test.ts`, `format.test.ts` | alterado (a ordem por custo só no Uso; "Atualize a página" sem "Tentar de novo"; os fixtures e os testes dos textos) |
| `tasks/prd-camada-ia/techspec.md` | alterado pelo Arquiteto (§4 e §9, a divergência abaixo) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| o grupo "IA (hoje, até agora, e mês)" e a infra com "último dia fechado" | U | os dois períodos ditos | `apps/web/src/operacao/pages/Uso.test.tsx` › o grupo "IA (hoje, até agora, e mês)" e a infra com "último dia fechado" |
| chamadas, tokens, reais, custo por aluno contra o valor, porcentagem e `chamadasPeloProvedorDeReserva` na linha | U | RF11 | `apps/web/src/operacao/pages/Uso.test.tsx` › a linha traz chamadas, tokens e reais de hoje e do mês…; › no celular, o cartão diz as mesmas nove medidas… |
| `ordem=custo` na barra e no pedido | U | a ordem | `apps/web/src/operacao/pages/Uso.test.tsx` › a barra oferece nome, mais uso e mais custo de IA…; › `?ordem=custo` no endereço pede `ordem=custo` à API…; `apps/web/src/operacao/pages/Escolas.test.tsx` › a barra de ordem da lista oferece só "Nome" e "Mais uso no mês" |
| "sem orçamento definido" com "Definir orçamento", que abre o diálogo da 7.0 | U | a ação | `apps/web/src/operacao/pages/Uso.test.tsx` › sem valor em nenhum lugar…; › o diálogo abre com a escola da linha…; › o diálogo da escola usa a rede da linha…; › o foco depois de salvar o orçamento (dois casos) |
| "sem aluno ativo", sem porcentagem | U | o estado | `apps/web/src/operacao/pages/Uso.test.tsx` › o valor sem aluno ativo não divide…; `textos.test.ts` › sem aluno ativo, ou sem número de alunos |
| "Ver meses": 12 itens com o mês em pt-BR; vazio "Ainda não há mês fechado com retrato."; "sem retrato (antes da medição)"; carregando; erro "Não foi possível carregar. Tentar de novo" | U | os meses | `apps/web/src/operacao/components/MesesDeIa.test.tsx` (a lista dos 12 e os estados); `Uso.test.tsx` › abre os 12 meses da escola da linha… |
| R$ com vírgula; nenhuma tela calcula porcentagem | U | o formato; a conta é da API | `apps/web/src/operacao/pages/Uso.test.tsx` › nenhuma tela calcula porcentagem…; `textos.test.ts` › o custo por aluno é o custo do mês… e › cada situação do orçamento diz o seu texto… |
| carregando, vazio "Nenhuma escola criada ainda.", erro, com dado; fora do contrato: "Atualize a página" | U | os estados | `apps/web/src/operacao/pages/Uso.test.tsx` › os estados da tela (RF22) (quatro casos); › a API nova com a web antiga… |
| números grandes inteiros na linha a 360 e a 1366 px; cartão e "Ver meses" sem rolagem horizontal a 360 px | E2E | celular | `e2e/operacao-uso.spec.ts` › IA 14.4: chamadas, tokens, reais… ficam inteiros na linha, a 360 e a 1366 px…; › IA: "Ver meses" abre os 12 meses da escola da linha…; › Ver meses: erro com "Tentar de novo", o carregando e o vazio… sem rolagem de lado |
| a linha do uso traz a rede da escola e o orçamento (próprio e vigente), os mesmos da aba Escolas; o item sem eles é fora do contrato (divergência) | U e integração | o alvo do diálogo vem da linha | `apps/api/test/painel-leitura.int.test.ts` › a linha do uso traz a rede da escola e o orçamento próprio e o vigente…; `apps/api/test/contracts.test.ts`; `packages/shared/src/operacao/painel.test.ts` › a resposta do uso é estrita…; `apps/web/src/operacao/api/painel.test.ts` › o item do uso sem a rede e o orçamento da escola… |
| porcentagem com texto, não só cor; alvo de 24 px em "Definir orçamento" e "Ver meses"; nada só por hover | E2E | acessibilidade | `e2e/operacao-uso.spec.ts` › IA: "Definir orçamento" abre o diálogo da escola da linha, com alvo de 24 px…; › IA: "Ver meses" abre os 12 meses… com alvo de 24 px…; › IA: a ordem por custo vai à barra e ao pedido… |

## Como testar

- Estados: `apps/web/src/operacao/pages/Uso.test.tsx` › "o 503 mostra a mensagem dentro da tela, que fica…" e › "sem escola
  nenhuma, o vazio convida a ir para Escolas…"
- Números grandes: `e2e/operacao-uso.spec.ts` › "14.4: as medidas de uma escola com números grandes ficam inteiras na linha…"
- Página e ordem: `e2e/operacao-uso.spec.ts` › "W6: 30 escolas, página e ordem na barra…"
- `npx vitest run --project unidade apps/web/src/operacao/pages/Uso.test.tsx` e `npx playwright test e2e/operacao-uso.spec.ts`
- **Telas:** papel operador, `/operacao/uso` (`USO_DA_OPERACAO`): ao abrir, com `?ordem=custo`, e "Ver meses" de uma escola; sem mockup

## Fora do escopo desta tarefa

O diálogo (7.0); a API (5.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem 53 blocos, um por termo do `--faltando` (`node tools/processo/mutacoes.ts --faltando` volta sem linha faltando) e por linha sem condição que protege (o campo do esquema, a coluna do SQL e o mapeamento da `rede`, o `orcamento` do service, o foco devolvido, o anúncio). Os três blocos que tiram um bloco inteiro de JSX (`CascaDaOperacao`, `MesesDeIa`) provam o termo `(` do `&&`. A linha `{tentando ? 'Tentando de novo…' : ''}` já existia (só mudou o recuo) e só se prova pela remoção do bloco: na tela, o `refetch` de um erro sem dado volta ao "Carregando".
2. **O texto já aparece na tela?** Procurei os textos novos em `e2e/` (`Mais custo de IA no mês`, `Definir orçamento`, `Ver meses`, `IA (hoje, até agora, e mês)`) e rodei isolado o `e2e/operacao-uso.spec.ts` (20 casos nos dois projetos). O vazio "Nenhuma escola criada ainda." é o da spec; o `e2e/operacao-escolas.spec.ts` não o usa para o Uso.
3. **Segundo dado:** o caso da API usa duas escolas em redes com valor e teto diferentes (a rede com valor 4 e teto 300, a escola só com teto 150), e uma terceira sem nada: apagar o `r.id` ou o `orcamento` deixa algo vermelho (blocos 3 a 6).
4. **Checagem anterior que responde antes:** o caso da API dá gasto no mês às duas escolas para entrarem na primeira página da ordem por custo (o banco de teste guarda escolas de outras execuções, todas com custo zero). Na tela, o dublê da rede devolve o 503 que a produção devolve e a resposta fora do contrato é a que o contrato recusa.
5. **Resultado, não forma:** os testes comparam texto na tela e o corpo da resposta; a ausência ("sem parágrafo no anúncio", "só Nome e Mais uso") é medida com a tela parada, depois da leitura.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks de `Uso.tsx`, `MesesDeIa.tsx`, `CascaDaOperacao.tsx` e `painel.ts` contra o código; o texto de `docs/interface.md` (§5a, Uso) cita só o que os casos acima provam.
8. **Divergência:** uma, abaixo, com a coluna da spec preenchida (`techspec.md` §4 e §9, escritas pelo Arquiteto). Procurei `Divergência` e o termo antigo ("a lista do Uso não traz a rede") em `techspec.md` e `cenarios.md`: nada contrário.
9. **Peça que já existe:** `DialogoDoOrcamento` (7.0), `DialogoDaOperacao`, `useDialogState`, `ScrollableList`, `lidoPeloContrato`, `orcamentoDaEscolaNoPainel` e os esquemas de `EscolaDoPainel` foram reaproveitados por importação; nada copiado.
10. **Corrida:** "Ver meses" lê só ao abrir (a chave é por escola) e o salvar do orçamento invalida o Uso por prefixo; o caso "Tentar de novo" e o do carregando do e2e seguram a resposta com `page.route` (a ordem é forçada), e o dia vem da API, não do relógio.
11. **Isolamento:** o `PainelRepository` é `@Unscoped` (leitura do operador, só id, nome e número, nunca pessoa), e o caso da API prova que a rede de cada linha é a da própria escola, não a de outra.
12. **Guardiões marcados:** `frontend-reviewer` (quatro estados, 360 px, 24/44 px, pt-BR, foco devolvido, nada só por cor), mais `tenancy-guardian` e `privacy-guardian` pela divergência (o item do uso ganhou a rede e o orçamento, só id, nome e número). O `achados/indice.md` não tem linha sobre a aba Uso.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O item de `GET /v1/operacao/uso` ganha, fora do `ia`, `rede {id, nome}` e `orcamento` (próprio e vigente), com os esquemas de `EscolaDoPainel`; a web monta o `AlvoDoOrcamento` da própria linha | O diálogo da 7.0 pede a rede e o orçamento da escola, e o item do uso trazia só o grupo `ia`; ler a lista de Escolas falharia com 400 escolas e com a ordem por custo, e não havia leitura de uma escola. O Arquiteto escolheu a alternativa (a) | `techspec.md` §4 (a linha do `GET /v1/operacao/uso` e o parágrafo "O alvo do 'Definir orçamento' (tarefa 8.0)") e §9 ("Operação, Uso"), escritos pelo Arquiteto |
Não são divergências da spec, e por isso ficam fora da tabela:

- **Arquivos além dos previstos.** A 8.0 toca também `Escolas.tsx`, `NavegacaoDaLista.tsx` e `CascaDaOperacao.tsx`: a barra de ordem passa a receber a lista de ordens (o Uso oferece `custo`, Escolas não, como a `techspec.md` §4 já diz), e "Atualize a página" não oferece "Tentar de novo" (o `cenarios.md` §4, "Erro", já diz).
- **Reorganização do e2e.** O W7 (carregando, vazio, erro e com dado, com axe) passou da metade do prazo com as nove colunas de IA na tabela e no cartão (o axe lê o dobro de células): o fim dele, "a página além da última", virou um caso próprio, e as leituras da lista (`usoNaTela`, `nomesNaTela`) passaram a uma ida só ao navegador. O W7 não perdeu asserção: o axe do "com dado" ficou no W6 e no "erro com dado", que leem a mesma tabela.

## Mutações

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta do uso é estrita
 nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
-rede: escolaDoPainelSchema.shape.rede,
 orcamento: orcamentoDeIaDoPainelSchema,
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta do uso é estrita
 rede: escolaDoPainelSchema.shape.rede,
-orcamento: orcamentoDeIaDoPainelSchema,
 dia: usoDoPeriodoDoPainelSchema,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a linha do uso traz a rede da escola
-select e.id, e.nome, r.id as "redeId", r.nome as "redeNome",
+select e.id, e.nome, e.id as "redeId", r.nome as "redeNome",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a linha do uso traz a rede da escola
 nome: linha.nome,
-rede: { id: linha.redeId, nome: linha.redeNome },
+rede: { id: linha.id, nome: linha.redeNome },
 dia: { requisicoes: Number(linha.diaRequisicoes), jobs: Number(linha.diaJobs), bytesStorage: Number(linha.diaBytes) },
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a linha do uso traz a rede da escola
 nome: linha.nome,
-rede: { id: linha.redeId, nome: linha.redeNome },
+rede: { id: linha.redeId, nome: linha.nome },
 dia: { requisicoes: Number(linha.diaRequisicoes), jobs: Number(linha.diaJobs), bytesStorage: Number(linha.diaBytes) },
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › a linha do uso traz a rede da escola
-itens: lida.itens.map(({ ia, ...uso }) => ({ ...uso, orcamento: orcamentoDaEscolaNoPainel(ia.orcamento.escola, ia.orcamento.rede), ia: iaDaEscola(ia) })),
+itens: lida.itens.map(({ ia, ...uso }) => ({ ...uso, orcamento: orcamentoDaEscolaNoPainel(ia.orcamento.escola, ia.orcamento.escola), ia: iaDaEscola(ia) })),
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o GET vai ao caminho da escola
-export const caminhoDoUsoDeIa = (escolaId: string): string => `${CAMINHO_DAS_ESCOLAS}/${encodeURIComponent(escolaId)}/uso-ia`
+export const caminhoDoUsoDeIa = (escolaId: string): string => `${CAMINHO_DAS_ESCOLAS}/${escolaId}/uso-ia`
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o que não é página nem ordem do contrato volta ao padrão
-const numero = /^[1-9]\d{0,4}$/.test(pagina) ? Number(pagina) : CONSULTA_PADRAO.pagina
+const numero = Number(pagina)
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o que não é página nem ordem do contrato volta ao padrão
-return numero <= MAXIMA_PAGINA_DO_PAINEL ? numero : CONSULTA_PADRAO.pagina
+return numero
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o que não é página nem ordem do contrato volta ao padrão
-return { pagina: paginaDaBusca(parametros), ordem: isOrdem(ordem) ? ordem : CONSULTA_PADRAO.ordem }
+return { pagina: paginaDaBusca(parametros), ordem: (ordem ?? CONSULTA_PADRAO.ordem) as OrdemDoPainel }
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o Uso lê a ordem `custo` do endereço
-return { pagina: paginaDaBusca(parametros), ordem: isOrdemDoUso(ordem) ? ordem : CONSULTA_PADRAO.ordem }
+return { pagina: paginaDaBusca(parametros), ordem: isOrdem(ordem) ? ordem : CONSULTA_PADRAO.ordem }
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o Uso lê a ordem `custo` do endereço
-return { pagina: paginaDaBusca(parametros), ordem: isOrdemDoUso(ordem) ? ordem : CONSULTA_PADRAO.ordem }
+return { pagina: paginaDaBusca(parametros), ordem: (ordem ?? CONSULTA_PADRAO.ordem) as OrdemDoUso }
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o item do uso sem a rede e o orçamento da escola
-queryFn: ({ signal }) => operadorAuthedRequest(`${CAMINHO_DO_USO}?${buscaDaConsulta(consulta)}`, lidoPeloContrato(usoDoPainelResponseSchema), { sinal: signal }),
+queryFn: ({ signal }) => operadorAuthedRequest(`${CAMINHO_DO_USO}?${buscaDaConsulta(consulta)}`, usoDoPainelResponseSchema, { sinal: signal }),
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › onze meses, ou um campo de pessoa a mais
-queryFn: ({ signal }) => operadorAuthedRequest(caminhoDoUsoDeIa(escolaId), lidoPeloContrato(usoDeIaDaEscolaDoPainelResponseSchema), { sinal: signal }),
+queryFn: ({ signal }) => operadorAuthedRequest(caminhoDoUsoDeIa(escolaId), usoDeIaDaEscolaDoPainelResponseSchema, { sinal: signal }),
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o GET vai ao caminho da escola
-queryKey: ['operacao', 'uso-ia', escolaId],
+queryKey: ['operacao', 'uso-ia'],
```

```mutacao
arquivo: apps/web/src/operacao/components/CascaDaOperacao.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › a API nova com a web antiga
-const paraAtualizar = erro instanceof RespostaForaDoContrato
+const paraAtualizar = false
```

```mutacao
arquivo: apps/web/src/operacao/components/CascaDaOperacao.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › a API nova com a web antiga
-{!paraAtualizar && (
+{true && (
```

```mutacao
arquivo: apps/web/src/operacao/components/CascaDaOperacao.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o 503 mostra a mensagem dentro da tela
-{!paraAtualizar && (
+{paraAtualizar && (
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › o mês fechado antes da medição diz
-{mes.situacao !== 'sem_retrato' && <Medida rotulo="Custo por aluno" valor={textoDoCustoPorAluno(mes.custoMicros, mes.alunosAtivos, mes.valorPorAlunoMicros)} />}
+{true && <Medida rotulo="Custo por aluno" valor={textoDoCustoPorAluno(mes.custoMicros, mes.alunosAtivos, mes.valorPorAlunoMicros)} />}
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › o mês com retrato traz
-{mes.situacao !== 'sem_retrato' && <Medida rotulo="Custo por aluno" valor={textoDoCustoPorAluno(mes.custoMicros, mes.alunosAtivos, mes.valorPorAlunoMicros)} />}
+{mes.situacao !== 'sem_retrato' && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › o foco vai para a reserva
-<DialogoDaOperacao titulo="Meses de IA" aoFechar={aoFechar} {...(focoDeReserva === undefined ? {} : { focoDeReserva })}>
+<DialogoDaOperacao titulo="Meses de IA" aoFechar={aoFechar}>
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › 12 meses, do mais recente ao mais antigo
-{itens !== undefined ? (
+{false ? (
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › vazio: nenhum dos 12 meses tem retrato
-itens.every((mes) => mes.situacao === 'sem_retrato') ? (
+false ? (
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › carregando: o texto do carregamento
-) : meses.isPending ? (
+) : false ? (
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › fora do contrato
-{forDoContrato ? TEXTO_PARA_ATUALIZAR : TEXTO_DO_CARREGAMENTO_QUE_FALHOU}
+{TEXTO_DO_CARREGAMENTO_QUE_FALHOU}
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › fora do contrato
-{!forDoContrato && (
+{true && (
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › erro: "Não foi possível carregar."
-{!forDoContrato && (
+{false && (
```

```mutacao
arquivo: apps/web/src/operacao/format.ts
teste: apps/web/src/operacao/format.test.ts › o que não é um mês do contrato volta como veio
-return partes === null ? mes : mesPorExtenso.format(new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, 15)))
+return partes === null ? '' : mesPorExtenso.format(new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, 15)))
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › sem valor em nenhum lugar
-{situacao === 'sem_orcamento' && <DefinirOrcamento escola={escola} aoDefinir={aoDefinir} />}
+{situacao !== 'sem_orcamento' && <DefinirOrcamento escola={escola} aoDefinir={aoDefinir} />}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › sem valor em nenhum lugar
-{situacao === 'sem_orcamento' && <DefinirOrcamento escola={escola} aoDefinir={aoDefinir} />}
+{situacao === 'sem_orcamento' && null}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › abre os 12 meses da escola da linha
-if (aberta?.alvo === undefined) return null
+if (aberta?.alvo === undefined) return <div role="dialog" aria-label="Sem escola" />
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › abre os 12 meses da escola da linha
-if (aberta.tipo === 'meses') return <MesesDeIa key={aberta.numero} escola={escola} aoFechar={aoFechar} focoDeReserva={() => focarNaEscola(escola.id)} />
+if (aberta.tipo === 'orcamento') return <MesesDeIa key={aberta.numero} escola={escola} aoFechar={aoFechar} focoDeReserva={() => focarNaEscola(escola.id)} />
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o botão "Definir orçamento" sai da linha
-if (botao) botao.focus()
+if (false) botao.focus()
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › a escola que saiu da página
-else regiaoDoAnuncio.current?.focus()
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o diálogo abre com a escola da linha
-{anuncio !== '' && <p className="rounded-controle border border-ok bg-ok-cx p-3 text-ok wrap-anywhere">{anuncio}</p>}
+{true && <p className="rounded-controle border border-ok bg-ok-cx p-3 text-ok wrap-anywhere">{anuncio}</p>}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o diálogo abre com a escola da linha
-{anuncio !== '' && <p className="rounded-controle border border-ok bg-ok-cx p-3 text-ok wrap-anywhere">{anuncio}</p>}
+{anuncio !== '' && null}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o diálogo abre com a escola da linha
-definirAnuncio('Orçamento salvo.')
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › no computador, o dia e o mês de referência
-{larga ? <TabelaDoUso escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} /> : <Cartoes escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} />}
+{false ? <TabelaDoUso escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} /> : <Cartoes escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} />}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › abaixo de 768 px, cada escola vira um cartão
-{larga ? <TabelaDoUso escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} /> : <Cartoes escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} />}
+{true ? <TabelaDoUso escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} /> : <Cartoes escolas={dados.itens} referencia={dados} aoAbrir={aoAbrir} />}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › a barra oferece nome, mais uso e mais custo de IA
-<SortSelect ordem={consulta.ordem} ordens={ORDENS_DO_USO_DO_PAINEL} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
+<SortSelect ordem={consulta.ordem} ordens={['nome', 'uso'] as const} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
```

```mutacao
arquivo: apps/web/src/operacao/pages/Uso.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o diálogo da escola usa a rede da linha
-return { tipo: 'escola', id: escola.id, nome: escola.nome, redeId: escola.rede.id, orcamento: escola.orcamento }
+return { tipo: 'escola', id: escola.id, nome: escola.nome, redeId: escola.id, orcamento: escola.orcamento }
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › a barra de ordem da lista oferece só
-<SortSelect ordem={consulta.ordem} ordens={ORDENS_DO_PAINEL} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
+<SortSelect ordem={consulta.ordem} ordens={['nome', 'uso', 'custo'] as const} aoEscolher={(ordem) => irPara({ pagina: 1, ordem })} />
```

```mutacao
arquivo: apps/web/src/operacao/components/NavegacaoDaLista.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › a barra oferece nome, mais uso e mais custo de IA
-const ROTULO_DA_ORDEM: Readonly<Record<OrdemDoUso, string>> = { nome: 'Nome', uso: 'Mais uso no mês', custo: 'Mais custo de IA no mês' }
+const ROTULO_DA_ORDEM: Readonly<Record<OrdemDoUso, string>> = { nome: 'Nome', uso: 'Mais uso no mês', custo: 'Custo' }
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › sem aluno ativo, ou sem número de alunos
-if (alunosAtivos === null || alunosAtivos === 0) return TEXTO_SEM_ALUNO_ATIVO
+if (false || alunosAtivos === 0) return TEXTO_SEM_ALUNO_ATIVO
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › sem aluno ativo, ou sem número de alunos
-if (alunosAtivos === null || alunosAtivos === 0) return TEXTO_SEM_ALUNO_ATIVO
+if (alunosAtivos === null || false) return TEXTO_SEM_ALUNO_ATIVO
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › o custo por aluno é o custo do mês pelos alunos ativos
-return valorPorAlunoMicros === null ? custo : `${custo} de ${reais(valorPorAlunoMicros)}`
+return custo
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › cada situação do orçamento diz o seu texto
-if (situacao === 'sem_orcamento') return TEXTO_SEM_ORCAMENTO_DEFINIDO
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › cada situação do orçamento diz o seu texto
-if (situacao === 'sem_retrato') return TEXTO_DO_MES_SEM_RETRATO
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › cada situação do orçamento diz o seu texto
-if (situacao === 'sem_aluno_ativo' || porcentagem === null) return TEXTO_SEM_PORCENTAGEM
+if (false || porcentagem === null) return TEXTO_SEM_PORCENTAGEM
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › cada situação do orçamento diz o seu texto
-if (situacao === 'sem_aluno_ativo' || porcentagem === null) return TEXTO_SEM_PORCENTAGEM
+if (situacao === 'sem_aluno_ativo' || false) return TEXTO_SEM_PORCENTAGEM
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › o que não é página nem ordem do contrato volta ao padrão
-const pagina = parametros.get('pagina') ?? ''
+const pagina = parametros.get('pagina') ?? '7'
```

```mutacao
arquivo: apps/web/src/operacao/components/CascaDaOperacao.tsx
teste: apps/web/src/operacao/pages/Uso.test.tsx › o 503 mostra a mensagem dentro da tela
-{!paraAtualizar && (
-<div className="mt-3 flex flex-wrap items-center gap-3">
-<Button onClick={aoTentarDeNovo} disabled={tentando}>
-Tentar de novo
-</Button>
-<span role="status" className="t-apoio text-erro">
-{tentando ? 'Tentando de novo…' : ''}
-</span>
-</div>
-)}
+{!paraAtualizar && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/MesesDeIa.tsx
teste: apps/web/src/operacao/components/MesesDeIa.test.tsx › erro: "Não foi possível carregar."
-{!forDoContrato && (
-<Button onClick={() => void meses.refetch()}>
-Tentar de novo
-</Button>
-)}
+{!forDoContrato && null}
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | Leitor de tela: o botão "Ver meses" dentro do `<th scope="row">` faz cada célula ser anunciada com "Escola X Ver meses de IA da escola X" (`Uso.tsx:175-180`) | `TODO.md`, e o Validador confere a tela com a marcação de linha: muda a estrutura da tabela e o foco devolvido (`focarNaEscola`), não cabe em poucas linhas |
| revisor-geral (1ª) | `cenarios.md` sem linha em RF11 para os campos novos (`cenarios.md:57`) | O Arquiteto, na retro: o `cenarios.md` é dele, e as tarefas 2.0, 3.0 e 5.0 seguiram o mesmo costume (a divergência está na `techspec.md` §4 e §9) |
| revisor-geral (1ª) | `ColunaDeIa.celula` recebe `aoDefinir` em todas as nove colunas, só a de orçamento usa (`Uso.tsx:60`) | Recusada: refatoração sem mudar comportamento, e mexe nas linhas que os blocos de "Mutações" de `Uso.tsx` citam |
| revisor-geral (1ª) | "Orçamento salvo." continua na tela depois de trocar de página ou de ordem (`Uso.tsx:291`, `357-360`); conferir se Escolas faz igual | `TODO.md`: muda comportamento nas duas abas (Escolas tem o mesmo `definirAnuncio('Orçamento salvo.')`), e o PRD não fala disso |
| test-engineer (1ª) | Axe no diálogo "Meses de IA" com os 12 meses e no "Orçamento de IA" aberto do Uso | `TODO.md`: o e2e do Uso já passou da metade do prazo (divergência do W7 desta tarefa); mais axe pede outro caso, na tarefa que mexer de novo em `e2e/operacao-uso.spec.ts` |
| test-engineer (1ª) | O cartão do celular não confere os valores, só os rótulos | Recusada: o cartão lê a mesma `COLUNAS_DE_IA` da tabela e os valores já são conferidos no caso da tabela (palavras do próprio revisor: "o risco é baixo") |
| frontend-reviewer (1ª) | A 1366 px a tabela tem 16 colunas e rola dentro da moldura; ver na validação se precisa rolar demais, e fixar a coluna da escola ou abreviar cabeçalhos | O Validador, ao fotografar `/operacao/uso` (a vitrine não alcança o operador); a moldura rolável é o que a regra 50 permite |
| frontend-reviewer (1ª) | "Tokens" e "Chamadas da reserva" são termos técnicos: tooltip ou frase de apoio | `TODO.md`: os termos vêm do `cenarios.md` §4, texto de tela que é do Arquiteto |
| frontend-reviewer (1ª) | O vazio de "Ver meses" não diz o próximo passo | Recusada: "Ainda não há mês fechado com retrato." é o texto do `cenarios.md` §4 ("Operação, Uso"), e o RF11 não pede outro |
| frontend-reviewer (1ª) | Conferir na validação o contraste de `text-sutil` sobre `bg-superficie` e do `t-selo` | O Validador, com a tela vista |
| infra-guardian (1ª) | `EXPLAIN` da ordem `custo` com 400 escolas e `consumo_ia` de um ano (`chaveDaOrdem`, `painel.repository.ts:161`) | `TODO.md`: é da 5.0 e não desta tarefa; antes da migração de produção (D42) |
| infra-guardian (1ª) | API nova antes da web antiga: "Atualize a página" até recarregar | Sem ação: tela interna do operador, já tratada na tela e testada (`Uso.test.tsx` › "a API nova com a web antiga") |
| conformidade-reviewer (1ª) | `textoDoCustoPorAluno` divide no cliente; se a conta chegar à coordenação, que venha pronta da API | Sem ação agora: a `techspec.md` §4 manda assim para a Operação, e a coordenação não recebe reais (6.0) |
| revisor-geral (2ª), infra-guardian (2ª) | Sem o `disabled={meses.isFetching}`, o "Tentar de novo" de `MesesDeIa.tsx:84` fica diferente do `ErroDaOperacao` (`CascaDaOperacao.tsx:141`), que desabilita e anuncia "Tentando de novo…"; os cliques repetidos cancelam a leitura anterior, sem corrida | `TODO.md`: o `disabled` saiu por ordem da Mesa (recomendação do `test-engineer` na 1ª: sem efeito visível); reaproveitar o `ErroDaOperacao` no diálogo muda o componente e entra na tarefa que mexer em `MesesDeIa.tsx`, e o padrão não pode ir para tela de escola (D31) sem isso |
| revisor-geral (2ª) | O Arquiteto aponta o RF11 do `cenarios.md` para o caso da ordem por custo de `painel-leitura.int.test.ts`, já que o e2e deixou de provar a ordem | O Arquiteto, na retro (junto com a linha de RF11 para os campos novos, já destinada na 1ª rodada) |
| test-engineer (2ª) | O e2e da ordem por custo passa se a web reordenar sozinha quando todos os custos são zero; trocar o corpo da resposta (`page.route`) por uma ordem que a web não produziria | Recusada por ora: risco baixo nas palavras do revisor, a ordem da API é provada no int da 5.0 e o nome do caso não promete mais |
| tenancy-guardian (2ª) | O e2e deixou de conferir a ordem por custo: ao mexer em `chaveDaOrdem`, conferir que o int da 5.0 continua cobrindo; `usoPorCusto()` lê só a página 1 | Já está no `TODO.md` (a linha da 5.0 sobre `usoPorCusto()`) |
| infra-guardian (2ª) | `EXPLAIN` da ordem `custo` com 400 escolas e um ano de `consumo_ia` | Já está no `TODO.md` (linha desta tarefa), antes da migração de produção (D42) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 23:17:26 | 2026-11-21 23:17:57 | `frontend-reviewer` | 1 | APROVADO | a08021dab38e6b553 |
| 2026-11-21 23:17:36 | 2026-11-21 23:18:09 | `tenancy-guardian` | 1 | APROVADO | a6b64a8408d96ad43 |
| 2026-11-21 23:17:40 | 2026-11-21 23:18:15 | `privacy-guardian` | 1 | APROVADO | a216b3ba09ea2bfb1 |
| 2026-11-21 23:17:46 | 2026-11-21 23:18:15 | `infra-guardian` | 1 | APROVADO | adb7f568f0ba3acb3 |
| 2026-11-21 23:17:43 | 2026-11-21 23:18:22 | `conformidade-reviewer` | 1 | APROVADO | a52e38db179ec46b6 |
| 2026-11-21 23:17:33 | 2026-11-21 23:18:40 | `revisor-geral` | 1 | APROVADO | a8d78f8ee4b723209 |
| 2026-11-21 23:17:30 | 2026-11-21 23:19:43 | `test-engineer` | 1 | REPROVADO | aa200f7ee28e6f1c3 |
| 2026-11-21 23:40:03 | 2026-11-21 23:40:13 | `frontend-reviewer` | 2 | APROVADO | a9f27819f8869c3de |
| 2026-11-21 23:40:09 | 2026-11-21 23:40:24 | `tenancy-guardian` | 2 | APROVADO | a812c99907a2c796a |
| 2026-11-21 23:39:50 | 2026-11-21 23:40:28 | `test-engineer` | 2 | APROVADO | a604bd066942d9c55 |
| 2026-11-21 23:39:56 | 2026-11-21 23:40:30 | `revisor-geral` | 2 | APROVADO | a44940c5131b41757 |
| 2026-11-21 23:40:15 | 2026-11-21 23:40:35 | `privacy-guardian` | 2 | APROVADO | a6fcbddc2fa0881f6 |
| 2026-11-21 23:40:22 | 2026-11-21 23:40:42 | `conformidade-reviewer` | 2 | APROVADO | a06e8d85acc836812 |
| 2026-11-21 23:40:28 | 2026-11-21 23:40:45 | `infra-guardian` | 2 | APROVADO | adce689400ecc1f3a |
