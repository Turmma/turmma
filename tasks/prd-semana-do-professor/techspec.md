# Tech Spec — Semana do professor

**PRD:** `tasks/prd-semana-do-professor/prd.md`
**Status:** rascunho

## 1. Resumo da abordagem

A semana é **calculada na leitura**, nunca gerada para o ano: as alocações do F2 dos vínculos confirmados da professora,
menos os dias de feriado e recesso, mais o registro dela. A `Aula` do `docs/modelo-de-dados.md` vira uma tabela que
guarda **só o texto**, por vínculo, data e início, sem FK para a alocação: a aula passada com texto sobrevive à saída
da grade (RF14), e o feriado esconde a aula sem tocar no texto (RF13). Semana passada usa a **grade de hoje** (Joaquim,
06/11/2026), mais o registro passado que saiu da grade ("fora da grade"). Uma leitura, `GET /v1/semana`, traz aulas,
eventos e itens do dia (RF7); uma escrita, `PUT /v1/aulas`, grava o texto.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/db/schema/aula.ts` + migration | novo | a tabela `aula` (seção 3) |
| `packages/core/src/semana/` | novo | `SemanaRepository` (leitura) e `AulaRepository` (gravação e passo da grade) |
| `packages/core/src/importacao/tipos/grade.ts` | alterado | o passo "o texto acompanha a grade", depois de `gravarAulas` |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado | a entrada `aula` |
| `packages/shared/src/semana/` | novo | o contrato das duas rotas; `TAMANHO_MAXIMO_DO_TEXTO_DA_AULA = 500` |
| `packages/shared/src/permissao/matriz.ts` | alterado | `aula: ['ler', 'gravar']`: professor `proprio`, os outros `nunca` |
| `apps/api/src/semana/` | novo | controller e service |
| `apps/web/src/areas/professor/turmas/` | alterado e novo | abas em `Turmas.tsx`; `semana/`; link no `TurmaHoje.tsx` |
| `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/interface.md` | alterado | o registro, a `Aula`, a seção 1.8 |

## 3. Modelo de dados

```
aula*   id uuid v7, escolaId* (FK escola), anoLetivoId*, vinculoId* (FK composta (escolaId, anoLetivoId, vinculoId) → vinculo, on delete cascade),
        data date*, inicio time*, fim time*, conteudo text*, atualizadoEm timestamptz*
        único (vinculoId, data, inicio); índice (escolaId, anoLetivoId, vinculoId, data)
        check inicio < fim; check char_length(btrim(conteudo)) between 1 and 500
```

A aula se casa com a alocação por (vínculo, dia da semana, início); `fim` é cópia, para a fora da grade. Só existe com
texto. A FK com o vínculo é a do ano e da escola, e leva a linha no expurgo e na eliminação. Migration só de criação.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/semana` | professor (`aula.ler`) | `segunda` (data de segunda-feira) | `ano {inicio, fim}`, `hoje`, `agora`, `gradeImportada`, `calendarioImportado`, `dias[] {data, eventos[] {tipo, descricao}, aulas[] {vinculoId, turmaId, turma, disciplinaId, disciplina, inicio, fim, sala, texto, foraDaGrade}, itens[] {tipo: aplicada \| encerrada \| correcao, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado?}}` |
| PUT | `/v1/aulas` | professor (`aula.gravar`) | `{vinculoId, data, inicio, texto}`; texto aparado, até 500; vazio apaga | `{vinculoId, data, inicio, texto \| null}` |

Contrato estrito, como a grade (campo a mais é `ENTRADA_INVALIDA`, também `segunda` que não é segunda e texto acima de
500). Tudo que não é dela ou não existe: `NAO_ENCONTRADO` (seção 6).

## 5. Fluxo

**Ler** (síncrono; escola do token, ano de `requireAnoEmCurso`, professora do `usuarioId` da sessão): (1) os vínculos
`confirmado` de professor dela, com nomes de turma e disciplina; (2) as alocações deles; (3) os eventos que cruzam a
semana; (4) os registros dela na semana; (5) os itens: `atividade_aplicada` cujo `artefato` tem (turma, disciplina) de
um dos vínculos, aplicada ou encerrada na semana, e a `entrega` `lote_de_correcao` dessas atividades criada na semana,
com o estado de hoje. O service monta os dias: fora do período do ano, nada; dia de `feriado` ou `recesso`, nenhuma aula;
senão, uma aula por alocação do dia da semana, com o registro de mesmo (vínculo, data, início), mais os registros
**passados** sem alocação, `foraDaGrade`. Registro futuro sem alocação é ignorado. Data e hora no fuso do uso
(`FUSO_DO_USO`, o do freio do Tutor), que é o da escola no recorte (D43).

**Gravar** (uma transação): o vínculo é dela, `confirmado`, do ano em curso; a data cai no ano; e a aula existe — a
alocação (vínculo, dia, início), lida com `for key share`, num dia sem feriado nem recesso, **ou** um registro passado já
gravado (o fora da grade se corrige). Faltou um: `NAO_ENCONTRADO`, nada gravado. Texto vazio: `delete`; senão `insert …
on conflict (vinculo_id, data, inicio) do update` de conteúdo, fim e `atualizadoEm`.

**Reimportar a grade** (o job `estrutura.gravar-planilha`, na transação dele, depois de `gravarAulas`): para cada
(vínculo, dia) com aula que sai e aula que entra, pareia as duas por ordem de início. O par **re-chaveia** os registros
daquele vínculo, dia e início velho para o início e o fim novos, em todas as datas (a semana passada usa a grade de
hoje); um registro fora da grade que já ocupe o início novo sai antes. A aula que sai sem par **apaga os registros de
data ≥ hoje**; os passados ficam fora da grade. Prévia, resumo, assinatura e auditoria do F2 não mudam; a reimportação do
calendário não muda.

**Falhas.** Banco fora: a leitura mostra o erro com "Tentar de novo"; a gravação devolve erro, e o painel guarda o texto.
O job que falha desfaz grade e registros juntos, como hoje.

## 6. Isolamento

- Escola, ano e professora vêm do contexto e da sessão; nenhum método os recebe. O `vinculoId` do corpo só vale se o
  repository o achar com a escola, o ano, o usuário da sessão e `confirmado` (regra 10, itens 3 e 4). Segunda camada:
  a FK composta
- Vínculo de outra escola, de colega, pendente, contestado, encerrado, de outro ano, e id inexistente: a mesma resposta,
  sem gravar (regra 10, item 6). A coordenação e a rede têm `nunca` na matriz (regra 70, item 8)
- **Testes** (quebram sem a cláusula de escopo): `PUT` e `GET` com vínculo de outra escola, de colega e inexistente dão a
  mesma resposta e não gravam; a professora de duas escolas, com o token de uma, não recebe aula, registro nem item da
  outra; o item de atividade do colega de outra disciplina na mesma turma não aparece; o passo da grade da escola A não
  toca registro da escola B de mesmo dia e início

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Novos campos | `aula.conteudo`: finalidade "a professora planejar e lembrar o que deu", retenção a do vínculo, execução de contrato; a linha entra no `docs/lgpd.md` na tarefa da tabela |
| O que vai para log | só ids e data; nunca o texto (regra 20, item 9) |
| O que entra em auditoria | nada: é dado da própria professora, fora da lista do item 10 da regra 20 |
| Retenção e expurgo | cascata com o vínculo (expurgo e eliminação já existem) |
| Autorização por objeto | o vínculo da aula é do usuário da sessão, confirmado, no ano em curso |
| DTO de saída | o da seção 4: sem e-mail, sem nome de aluno, sem acerto; o registro entra no arquivo do titular (regra 20, item 19) |

## 7b. Conformidade CNE

Sem IA no caminho do aluno e sem indicador de professor: nada da Semana chega à coordenação (regra 70, itens 8 e 9; D64).

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Está no caminho quente? | nenhum |
| Carga na manhã de segunda | um `GET` por professor ao abrir, perto das 7h (`docs/infra.md` 3.1, 40 professores por escola), cinco consultas indexadas |
| Fila e prioridade | nenhuma; o passo da grade roda no job e na fila que já existem |
| Limite por escola | `statement_timeout` e corpo de 100 KB já valem; texto de 500 |
| Rate limit | a guarda global por usuário e por escola cobre as duas rotas; nenhum contador novo |
| Corridas de concorrência | (1) **duas gravações da mesma aula**: o único (vínculo, data, início) com `on conflict do update`; uma linha, o último texto; cenário em paralelo. (2) **gravação contra o job da grade**: a gravação lê a alocação com `for key share`; o `delete` do job espera o commit, e o passo seguinte do job apaga o registro futuro que ficou sem aula; cenário em paralelo, sem registro futuro sem alocação no fim |
| Índices novos | o da `aula`; os de `alocacao`, `evento_calendario`, `atividade_aplicada` e `entrega` já começam pelo escopo |
| Migration | só cria tabela |
| Quando cada dependência cai | banco: seção 5, "Falhas"; Redis: a guarda já trata; IA e storage: não usa |
| Métrica, alerta, teste de carga | nenhum: fora do caminho quente |

## 8. Uso de IA

Não se aplica.

## 9. Frontend

Medidas e textos vão para o `docs/interface.md`, seção **1.8 A Semana**, escrita pela tarefa da aba.

- **Turmas** ganha as `Tabs` "Turmas · Semana" (`?ver=semana`, `replace`); a Semana é pedaço sob demanda. A altura é a da
  turma aberta (X3, RF22, `miolo-do-documento.ts`): do `md` para cima só o painel rola; abaixo de 768 px, a página.
  Nenhuma tela calcula a própria altura com `calc(100dvh − …)`
- **A semana**: uma coluna por dia, **cartões empilhados por horário, sem régua de horas** (a régua dependeria da métrica
  da fonte, D72), com turma e disciplina, horário, sala, o texto em duas linhas ou "Falta preencher", e os itens do dia
  embaixo. Hoje e a aula do `agora` marcados. `?semana=` e `?turma=<turmaId>.<disciplinaId>` no endereço, só ids e datas
  (regra 20, item 9); navegação presa ao `ano`. Abaixo de 768 px, `SegmentedControl` com os dias e um dia por vez
- **O painel da aula** é o `Sheet` (`?aula=<vinculoId>.<data>.<HHMM>`): `Textarea` com o contador de `text-limits`, o
  aviso de não escrever nome de aluno, "Salvar" e "Preparar esta aula". O rascunho mora num store de aba, como o da
  contestação; dois cliques mandam uma gravação. "Preparar" guarda a turma em `CONTEXTO_ESCOLHIDO` e vai ao Início, sem
  criar conversa
- **Itens** levam ao painel da atividade (`?aba=atividades&atividade=<id>` da turma) e à revisão da correção (o endereço
  do sino). **Hoje** ganha "Ver a semana desta turma"
- TanStack Query, chave `['semana', segunda]`; trocar de escola já descarta o cache (P30), e o painel cuja aula sumiu fecha
- Até umas 40 aulas por semana: sem virtualizar

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | montagem dos dias (feriado, recesso, evento, fora do ano, fora da grade); "Falta preencher"; pareamento (aula dupla, horário, saída); contrato |
| Integração | só vínculo confirmado; feriado tira e devolve o texto (RF13); os quatro casos de RF14 com o job real do F2; itens por turma e disciplina (RF7); as duas corridas; arquivo do titular; coordenação sem acesso |
| E2E | Semana, painel, salvar e reabrir, "Preparar", link do Hoje, troca de escola, os três vazios, em `chromebook` e `celular` |
| Isolamento | os da seção 6 |

## 11. Conformidade com as regras

As regras 10, 20, 40, 50, 60 (item 8), 70 (itens 8 e 9) e 80 são atendidas nas seções 6, 7, 7c, 9 e 10. Desvios:

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 20, item 10 | auditoria nas leituras e escritas da lista | a gravação do texto não é auditada: dado da própria professora, sem aluno, nota nem permissão | esta seção |
| `docs/modelo-de-dados.md` | a `Aula` vira a `aula` da seção 3 | sem FK para a alocação, sem `status` nem `observacao`: o PRD tirou "não houve aula", e o texto sobrevive à saída da grade | `docs/modelo-de-dados.md`, na tarefa da tabela |

## 12. Premissas não verificadas

Nenhuma.

## 13. Riscos técnicos

- **O passo novo mexe no job da grade do F2**, que custou muitas rodadas de revisão. Mitigação: uma função, depois de
  `gravarAulas`, sem tocar prévia, resumo, assinatura nem auditoria, provada com a reimportação real
- **"Hoje" na meia-noite**: job e gravação usam `FUSO_DO_USO`; a janela só decide se um registro de hoje fica
