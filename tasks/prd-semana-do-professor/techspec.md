# Tech Spec — Semana do professor

**PRD:** `tasks/prd-semana-do-professor/prd.md` · **Cenários:** `tasks/prd-semana-do-professor/cenarios.md`
**Status:** revisada (`revisao-spec.md`, rodada 5 APROVADA)

## 1. Resumo da abordagem

A semana é **calculada na leitura**: as alocações dos vínculos confirmados, menos feriado e recesso, mais o registro. A
`Aula` vira uma tabela que guarda **só o texto**, sem FK para a alocação: o texto passado sobrevive à saída da grade
(RF14) e ao feriado (RF13). Semana passada usa a **grade de hoje** (Joaquim, 06/11/2026), mais o registro passado que
saiu da grade ("fora da grade"). O texto sai na virada do ano.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/db/schema/aula.ts` + migration | novo | a tabela (seção 3) |
| `packages/core/src/semana/` | novo | `SemanaRepository` (leitura) e `AulaRepository` (gravação, trava, passo da grade) |
| `packages/core/src/importacao/tipos/grade.ts` | alterado | o passo "o texto acompanha a grade", entre `gravarAulas` e `encerrarOsMarcados` |
| `packages/core/src/estrutura/vinculo.repository.ts` | alterado | `virarAno` apaga as linhas de `aula` do ano |
| `packages/core/src/titular/leitura-do-titular.ts`, `troca-de-nome.ts` | alterado | `aula` só na versão `completa` (`naVersao`, critério 5); no comentário da troca, por que fica fora (seção 11) |
| `packages/shared/src/privacidade/classificacao.ts` | alterado | `aula`: chave nova de prazo fixo (a virada), ligação `vinculo_id`; não vira categoria da prévia |
| `packages/shared/src/semana/` | novo | contrato das duas rotas; `TAMANHO_MAXIMO_DO_TEXTO_DA_AULA = 500`; rótulos dos itens |
| `packages/shared/src/permissao/matriz.ts` | alterado | `aula: ['ler', 'gravar']`: professor `proprio`, os outros `nunca` |
| `apps/api/src/semana/` | novo | controller e service |
| `apps/web/src/areas/professor/turmas/` | alterado e novo | abas em `Turmas.tsx`; `semana/`; link no `TurmaHoje.tsx` |
| `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/glossario.md`, `docs/interface.md` | alterado | o registro, a `Aula` (no glossário, o texto sem apontar para a alocação), a seção 1.8 |

## 3. Modelo de dados

```
aula*   id uuid v7, escolaId* (FK escola), anoLetivoId*, vinculoId* (FK composta (escolaId, anoLetivoId, vinculoId) → vinculo, on delete cascade),
        data date*, inicio time*, fim time*, conteudo text*, atualizadoEm timestamptz*
        único (vinculoId, data, inicio); índice (escolaId, anoLetivoId, vinculoId, data)
        check inicio < fim; check char_length(btrim(conteudo)) between 1 and 500
```

Casa com a alocação por (vínculo, dia da semana, início); `fim` é cópia, só para a fora da grade (a troca só do fim na grade não a atualiza). Só existe com texto. Sai
na virada do ano (`virarAno`, na transação do encerramento) e, antes disso, em cascata com o vínculo. Migration só de
criação.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/semana` | professor (`aula.ler`) | `segunda` (data de segunda-feira) | `ano {inicio, fim} \| null`, `hoje`, `agora`, `gradeImportada`, `calendarioImportado`, `dias[] {data, eventos[] {tipo, descricao}, aulas[] {vinculoId, turmaId, turma, disciplinaId, disciplina, inicio, fim, sala, texto, foraDaGrade}, itens[] {tipo: aplicada \| encerrada \| correcao, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado?}}` |
| PUT | `/v1/aulas` | professor (`aula.gravar`) | `{vinculoId, data, inicio, texto}`; texto aparado, até 500; vazio apaga | `{vinculoId, data, inicio, texto \| null}` |

Contrato estrito (campo a mais, `segunda` que não é segunda e texto acima de 500: `ENTRADA_INVALIDA`). Sem ano em curso:
o `GET` responde `ano: null` e nenhum dia, sem `requireAnoEmCurso`; o `PUT`, `NAO_ENCONTRADO`. Tudo que não é
dela ou não existe: `NAO_ENCONTRADO`. Trava esgotada: `INDISPONIVEL_TENTE_DE_NOVO`.

## 5. Fluxo

**Ler** (escola do token, ano em curso, professora do `usuarioId` da sessão): (1) os vínculos `confirmado` de professor
dela, com nomes de turma e disciplina; (2) as alocações deles; (3) os eventos com `fim ≥ segunda` e `inicio ≤ domingo`;
(4) os registros **desses vínculos** na semana; (5) os itens: `atividade_aplicada` cujo `artefato` tem (turma, disciplina)
de um dos vínculos, aplicada ou encerrada na semana, e a `entrega` `lote_de_correcao` delas criada na semana, com o
estado de hoje. O service monta os dias: fora do ano, nada; dia de `feriado` ou `recesso`, nenhuma aula; senão, uma aula
por alocação do dia da semana, com o registro de mesmo (vínculo, data, início), mais os registros **passados** sem
alocação, `foraDaGrade`. Registro futuro sem alocação é ignorado. Data e hora em `FUSO_DO_USO`.
`hoje` é `AAAA-MM-DD` e `agora` é `HH:MM`, ambos de Brasília; "passado" é data menor que `hoje`. `dias` traz só os dias que caem no ano em curso:
de segunda a sexta sempre, e sábado e domingo só quando a grade tem alocação neles (ou há registro passado fora da grade), contada antes de o feriado
tirá-la. `gradeImportada` é "a escola tem alguma alocação no ano em curso" e `calendarioImportado`, "a escola tem algum evento no ano em curso": são da
escola, e não da professora (uma professora sem aula, numa escola com grade, vê `true` e a semana vazia). Sem ano em curso, os dois são `false`.

**Gravar** (uma transação, `lock_timeout` de 2 s), nesta ordem, que é a do job: (1) `travarAnoEmCurso()` (`for share`;
ordena com a virada); (2) o vínculo é dela, `confirmado`, da escola e do ano do contexto, lido sem trava de linha (nunca `VinculoRepository.travar`); (3) só então a **trava do
vínculo**, `pg_advisory_xact_lock(<classe própria>, hashtext(escolaId‖vinculoId))`; (4) a data cai no ano, num dia sem
feriado nem recesso, e há a alocação (vínculo, dia, início) **ou** um registro passado já gravado (o fora da grade se
corrige). Faltou uma: `NAO_ENCONTRADO`, nada gravado; `55P03` vira `INDISPONIVEL_TENTE_DE_NOVO`. Texto vazio: `delete`; senão `insert … on conflict
(vinculo_id, data, inicio) do update` de conteúdo, fim e `atualizadoEm`, com `setWhere` da escola do contexto.

**Reimportar a grade** (job `estrutura.gravar-planilha`, na transação dele, **entre `gravarAulas` e `encerrarOsMarcados`**;
ano de destino como no `AlocacaoRepository`, escola do registro da importação): toma, num comando só e na ordem de `hashtext(escolaId‖vinculoId)`,
a trava dos vínculos que já existiam e têm aula que sai ou entra; só então lê a `aula`. Por (vínculo, dia), pareia as que saem e as que entram por ordem de início. O par **re-chaveia**
os registros do início velho para o início e o fim novos, em todas as datas; na data em que um registro fora da grade já
ocupa o início novo, aquele não se move e fica fora da grade (nenhum texto passado se apaga). A aula que sai sem par
**apaga os registros de data ≥ hoje**; os passados ficam fora da grade. Prévia, resumo, assinatura e auditoria do F2 não
mudam.

**Falhas.** Banco fora: erro na tela, texto guardado no painel. O job que falha desfaz grade e registros juntos.

## 6. Isolamento

- Escola, ano e professora vêm do contexto e da sessão. O `vinculoId` do corpo só vale se o repository o achar com a
  escola, o ano, o usuário da sessão e `confirmado` (regra 10, itens 3 e 4); segunda camada, a FK composta e o
  `setWhere`. O passo da grade recebe só o ano de destino; a escola é a do `requireEscolaId()` do job
- Vínculo de outra escola, de colega, pendente, contestado, encerrado, de outro ano, e id inexistente: a mesma resposta,
  sem gravar (item 6). Coordenação e rede têm `nunca` na matriz, e a única rota indireta da coordenação, o arquivo do
  titular da versão `coordenacao` (`/v1/privacidade/pedidos/:id/arquivo`), não leva a `aula` (seção 7)
- Testes de isolamento: `cenarios.md`, R1 a R7, R1b e J6

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Novos campos | `aula.conteudo`: finalidade "a professora planejar e lembrar o que deu", até a virada do ano, execução de contrato; pode trazer nome de aluno; não vai a IA na F2b (a F11 reabre a linha); entra no `docs/lgpd.md` na tarefa da tabela |
| O que vai para log | só ids e data; nunca o texto (regra 20, item 9) |
| O que entra em auditoria | nada (seção 11) |
| Retenção e expurgo | `virarAno` apaga as do ano; antes, cascata com o vínculo. Fica fora da troca de nome pelo mesmo motivo da contestação: o nome de aluno eliminado não passa da virada |
| Autorização por objeto | o vínculo é do usuário da sessão, confirmado, no ano em curso |
| DTO de saída | o da seção 4, sem e-mail, nome de aluno, acerto nem autor. Arquivo do titular: só na versão `completa`; a `coordenacao` não traz a tabela, e nenhuma contagem da prévia a soma |
| Rascunho na web | em memória, nunca em `localStorage` nem `sessionStorage`; sai na troca de escola e na saída |

## 7b. Conformidade CNE

Sem IA no caminho do aluno. Regra 70, item 8: o texto não chega à coordenação, nem pelo arquivo do titular. Item 9 e
D64: nenhuma contagem; "Falta preencher" é selo por aula, sem total. Item 7: itens sem nome de aluno.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Está no caminho quente? | nenhum |
| Carga na manhã de segunda | um `GET` por professor ao abrir (`docs/infra.md` 3.1), cinco consultas indexadas; `EXPLAIN` da dos itens na tarefa |
| Fila, limite e rate limit | nenhuma fila nova (o passo roda no job do F2); `statement_timeout`, corpo de 100 KB, texto de 500; a guarda global por usuário e por escola |
| Corridas de concorrência | Ordem global: ano (`for share`) → trava consultiva do vínculo → linha do vínculo (o `FOR UPDATE` de `encerrarOsMarcados` vem depois do passo; J16). A chave composta isola as escolas; a ordem "confere, depois trava" protege o colega (R1). (1) Gravação × gravação: uma linha (G6). (2) Gravação × saída da aula, nas duas ordens (J11a, J11b). (3) Gravação do fora da grade × re-chaveamento: nada sobrescrito nem duplicado (J12). (4) Gravação × virada: o `for share` no ano espera o encerramento, e a gravação responde `NAO_ENCONTRADO` (J14). `lock_timeout` de 2 s (J13). Encerramento avulso do vínculo: aceito, sai na virada |
| Índices e migration | o da `aula`, numa migration só de criação (a 0041); os outros já começam pelo escopo. O teste que mede o que a 0040 mudou (`migracao-f2.int.test.ts`) migra só até ela: a 0041 não entra na comparação de colunas dele |
| Dependência que cai, métrica, carga | seção 5, "Falhas"; nada novo: fora do caminho quente |

## 8. Uso de IA

Não se aplica.

## 9. Frontend

Medidas e textos: `docs/interface.md` 1.8, escrita pela tarefa da aba.

- **Turmas** ganha as `Tabs` "Turmas · Semana" (`?ver=semana`, `replace`), sob demanda. A altura é a da
  turma aberta (X3, RF22, `miolo-do-documento.ts`); nenhuma tela calcula a própria com `calc(100dvh − …)`
- **A semana**: uma coluna por dia, **cartões empilhados por horário, sem régua de horas** (a régua dependeria da métrica
  da fonte, D72); cada cartão é botão com nome acessível ("Terça, 7h30, 7ºA, Matemática"), com o texto em duas linhas ou
  "Falta preencher" (neutro, D59); os itens do dia embaixo, com rótulos de `packages/shared`. Hoje e "agora" em texto.
  Feriado e recesso mostram tipo e descrição. `?semana=` e `?turma=<turmaId>.<disciplinaId>`, só ids e
  datas; navegação presa ao `ano`. Abaixo de 768 px, `SegmentedControl` com os dias, abrindo em hoje (ou na segunda, fora
  da semana de hoje)
- **O painel** é o `Sheet` (`?aula=<vinculoId>.<data>.<HHMM>`): `Textarea` rotulado, contador de `text-limits` com
  `aria-live="polite"`, aviso de não escrever nome de aluno, "Salvar" e "Preparar esta aula"; o foco volta ao cartão ao
  fechar. Falha: "Não foi possível salvar. Tente de novo em instantes", texto guardado; `NAO_ENCONTRADO`: a aula saiu
  da grade, e o texto não foi salvo. Dois cliques mandam uma gravação. "Preparar" guarda a
  turma em `CONTEXTO_ESCOLHIDO` e vai ao Início, sem criar conversa
- **Itens** levam ao painel da atividade (`?aba=atividades&atividade=<id>`) e à revisão da correção (o endereço do sino);
  **Hoje** ganha "Ver a semana desta turma"
- TanStack Query, chave `['semana', segunda]`; a troca de escola já descarta o cache (P30), o rascunho e o painel

## 10. Testes

`cenarios.md`: leitura (S), gravação (G), isolamento (R), reimportação (J) e tela (T), com a camada de cada um.

## 11. Conformidade com as regras

Regras atendidas nas seções 6 a 10. Desvios:

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 20, item 10 | auditoria nas leituras e escritas da lista | a gravação do texto não é auditada: dado da própria professora, sem aluno, nota nem permissão | esta seção |
| 20, item 15 | eliminação apaga de fato | `aula.conteudo` fora da troca de nome: sai na virada do ano, como o texto da contestação | `troca-de-nome.ts`, comentário da lista |
| `docs/modelo-de-dados.md` | a `Aula` vira a `aula` da seção 3 | sem FK para a alocação, sem `status` nem `observacao`: o PRD tirou "não houve aula", e o texto sobrevive à saída da grade | `docs/modelo-de-dados.md`, na tarefa da tabela |

## 12. Premissas não verificadas

Nenhuma.

## 13. Riscos técnicos

- **O passo novo mexe no job da grade do F2**. Mitigação: uma função, antes de `encerrarOsMarcados`, sem tocar prévia,
  resumo, assinatura nem auditoria, provada com a reimportação real
