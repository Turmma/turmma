# Tarefa 1.0 — A tabela da BNCC existe, carregada do `bncc-dados`, e a disciplina tem o componente

**Funcionalidade:** classificacao-bncc · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`, `domain-researcher`
**Porte:** grande

## Objetivo

A tabela pública `habilidade_bncc` tem as habilidades dos anos finais e do EM, `COMPONENTES_BNCC` dá as candidatas, e
cada disciplina tem o componente: pelo nome na migration e na criação, e pela coordenação na Estrutura.

## Contexto necessário

- `techspec.md` §3, §4 (`PATCH /v1/disciplinas/:id`), §9 (Estrutura), §12
- `prd.md` RF1
- `cenarios.md` "Tabela BNCC e componente"
- `.claude/rules/`: 10 (item 1), 50, 80
- Código: `packages/shared/src/importacao/normalizador.ts` (`chaveDaDisciplina`);
  `packages/core/src/estrutura/disciplina.repository.ts` (`criar`, `renomear`);
  `apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx`

## Subtarefas

- [x] 1.1 — Migration: `habilidade_bncc` com o check do código e a carga (§3 "Carga"), `on conflict (codigo) do update`, sem Computação
- [x] 1.2 — Conferir 30 habilidades e as contagens contra o PDF homologado, com o hash no cabeçalho do JSON (o PDF vence)
- [x] 1.3 — `COMPONENTES_BNCC` e as candidatas por série e componente em `packages/shared` (§3 "Componentes")
- [x] 1.4 — `disciplina.componente_bncc` com o check; a migration e o `criar` casam pelo nome; renomear não muda
- [x] 1.5 — `PATCH /v1/disciplinas/:id` com `componenteBncc` (nulo apaga) e `disciplina.componente_alterado` (antes e depois); sem agendar (6.0)
- [x] 1.6 — A Estrutura mostra e define o componente, com "Sem componente"; a Parte A da Estrutura no `docs/interface.md` (§3)
- [x] 1.7 — `docs/modelo-de-dados.md`, item 1 das Regras transversais, com `` `HabilidadeBncc` ``; a D65 (Computação) no `TODO.md`
- [x] 1.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0059_*.sql`, `packages/core/src/db/schema/habilidade-bncc.ts`, `packages/core/src/db/bncc/dados-2026.08.json`, `packages/core/src/db/habilidade-bncc.int.test.ts`, `packages/shared/src/bncc/componentes.ts`, `packages/shared/src/bncc/componentes.test.ts` | novo |
| `packages/core/drizzle/meta/_journal.json`, `packages/shared/src/index.ts`, `packages/core/src/db/schema/disciplina.ts`, `packages/core/src/estrutura/disciplina.repository.ts`, `packages/shared/src/estrutura/disciplina.ts`, `apps/api/src/estrutura/disciplina/disciplina.service.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx`, `apps/web/src/api/estrutura.ts`, `apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx`, `apps/api/test/estrutura.int.test.ts`, `e2e/estrutura.spec.ts`, `docs/modelo-de-dados.md`, `docs/interface.md`, `TODO.md`, `apps/web/src/components/ui/fields/Select.tsx` (o rótulo quebra palavra longa: o nome da disciplina entra nele), `packages/shared/src/privacidade/classificacao.ts` (a tabela nova é classificada), `tools/vitrine/escola.ts` e `e2e/support/governanca.ts` (a escola cheia da vitrine tem a Química com componente e a Física sem) | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| carga duas vezes; descrição mudada | I | mesma contagem, 183 no EM; atualiza  `habilidade-bncc.int.test.ts` › a migration carrega as 913… e › a carga de novo dá a mesma contagem… |
| JSON com um código a menos | I | o código fica. Mutação: `delete` antes do `insert`  `habilidade-bncc.int.test.ts` › o JSON com um código a menos não apaga o código |
| toda linha; Computação | I | `versao` e `localizador`; a carga barra `EF06CO01`, o check o aceita  `habilidade-bncc.int.test.ts` › a migration carrega as 913… (toda linha, sem Computação) e › o check do código recusa… e aceita `EF06CO01` |
| check: `EF03CI03B`, `EF15AR01`, `EM13CNT3010`, `EF07LP01A` | I | recusados, um caso cada  `habilidade-bncc.int.test.ts` › o check do código recusa… (um `expect` por código) e › a linha precisa ser do Fundamental… |
| exceção pública; JSON contra o hash | U | `HabilidadeBncc` no item 1; editar uma descrição deixa vermelho  `architecture.test.ts` › o item 1 das Regras transversais… e `carga.test.ts` › o JSON bate com o hash do cabeçalho; `habilidade-bncc.int.test.ts` › a tabela é pública |
| candidatas: `EF69LP01`; `EF67EF` e `EF89EF`; `EM13CNT301`; LP no EM; Arte, EF e ER; 9º EF com 1º EM | U | uma linha do `cenarios.md` por caso  `componentes.test.ts` › as candidatas por série e componente (um caso por linha do `cenarios.md`) |
| migration do componente: "Química", "QUIMICA", " química "; "Português"; "Projeto de Vida", "Robótica"; disciplina da B | I | casa, nulo, não muda  `habilidade-bncc.int.test.ts` › as disciplinas de antes ganham o componente… e › a disciplina da outra escola segue a mesma regra… |
| criada depois e renomeada | I | nasce com o componente; renomear mantém. Mutação: tirar o casamento do `criar`  `estrutura.int.test.ts` › a disciplina criada depois nasce com o componente que o nome diz… |
| `PATCH` | I | `disciplina.componente_alterado` antes e depois  `estrutura.int.test.ts` › `PATCH` com `componenteBncc` grava o componente e `disciplina.componente_alterado`… |
| `PATCH` com `null`; inexistente; check do banco | I | apaga; `ENTRADA_INVALIDA`; recusado  `estrutura.int.test.ts` › o mesmo caso do `PATCH` (`null` apaga) e › componente que não existe, de outro tipo ou com campo a mais é ENTRADA_INVALIDA |
| `PATCH` da B no contexto da A | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id`  `estrutura.int.test.ts` › isolamento: a coordenação da A não alcança a disciplina da B… |
| professor no `PATCH`; `PATCH` | I | recusado; nenhuma `execucao_agente`  `estrutura.int.test.ts` › o `PATCH` do componente é só da coordenação, não agenda nada… |
| Estrutura: carregando, erro ao salvar, com componente, "Sem componente" | U | um caso cada  `Estrutura.test.tsx` › o componente da BNCC da disciplina: carregando; erro (leitura); com dado; definir; "Sem componente" apaga; erro ao salvar; a disciplina que já não existe |
| 1366 × 768; uma ação cheia; vocabulário | E | `paginaNaoRola`; `VOCABULARIO_DE_NOTA`  `e2e/estrutura.spec.ts` › o componente da BNCC da disciplina: 1366 × 768… |
| 360 px | E | sem rolagem lateral, 44 px, axe  `e2e/estrutura.spec.ts` › o componente da BNCC da disciplina: 360 px… |
| recomeço: segunda pessoa; mesma disciplina reaberta; `PATCH` segurado com troca de disciplina; falha e nova tentativa | E | um caso cada; o erro sai e o foco volta  `e2e/estrutura.spec.ts` › … recomeço (o salvamento segurado, a falha e a nova tentativa, a mesma e a outra disciplina), › o `PATCH` segurado de uma disciplina e a troca para outra (a resposta que chega depois não fecha o diálogo da outra) e › segunda pessoa |

## Como testar

- Check: `packages/core/src/db/migracao-fila-ferramenta.int.test.ts` › "os dois checks terminam validados…"; carga idempotente: `migracao-f4.int.test.ts` › "a escola sem série deixa o material sem linha, e rodar o backfill de novo não duplica nada"
- Exceção: `apps/api/test/architecture.test.ts` › "o item 1 das Regras transversais do docs/modelo-de-dados.md nomeia cada uma"
- `PATCH`: `apps/api/test/estrutura.int.test.ts` › "renomear: a resposta e a listagem trazem o nome novo…" (compara o objeto inteiro: o campo novo muda o esperado)
- Casamento: `packages/shared/src/importacao/normalizador.test.ts` › "\"Química\", \"  QUIMICA \" e \"química\" são a mesma disciplina"
- e2e: `e2e/estrutura.spec.ts` › "o nome repetido fica no campo…"; `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- `npx vitest run --project integracao apps/api/test/estrutura.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/estrutura.spec.ts`
- Armadilha: disciplina não tem auditoria hoje; o recorder vem de `apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts`
- Telas: `coordenacao`, `/coordenacao/estrutura`, `text=Disciplinas` (o editar da linha)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: uma disciplina que casa e outra que não.

## Fora do escopo desta tarefa

Seções (2.0); o job do `PATCH` (6.0).

## Plano (Implementador)

**Arquivos:** os da tabela "Arquivos previstos", mais `tasks/prd-classificacao-bncc/techspec.md` e `cenarios.md` (as divergências abaixo, antes dos revisores) e as fixtures de `Disciplina` dos testes da coordenação que ganharam `componenteBncc: null`.

**Interfaces:** `COMPONENTES_BNCC`, `NOME_DO_COMPONENTE`, `componenteDoNomeDaDisciplina`, `habilidadeEhCandidata` e `partesDoCodigoBncc` (shared); `disciplinaSchema.componenteBncc`; `renomearDisciplinaRequestSchema` com `nome` e/ou `componenteBncc`; `DisciplinaRepository.travarPorId` e `definirComponente`; ação de auditoria `disciplina.componente_alterado`; `definirComponenteDaDisciplina` (web).

**Testes:** a tabela acima, com o caso de cada linha na coluna "Caso".

### Autoconferência

1. **Mutações:** a seção "Mutações" abaixo, um bloco por cláusula do diff; o que o `--faltando` listava e não tem mutação que um teste veja leva a meia linha do motivo (a defesa que o `for update` torna redundante, o `??` que o tipo pede, a ordem dos ramos). Conferi à mão o que a ferramenta não vê: o campo zod de `disciplina.componente_alterado`, o `UPDATE` da migration e o `ADD CONSTRAINT` (blocos no `.sql`).
2. **Texto na tela:** "Sem componente", "Componente da BNCC: …", "Componente da BNCC" (título), "Salvar componente", "Salvando…" e o aviso do 404 são novos; `grep -rln` em `e2e/` só os acha nos casos novos de `estrutura.spec.ts`. A lista de disciplinas do painel ganhou texto: o caso de `Estrutura.test.tsx` que a compara foi atualizado, e os e2e que contam `listitem` das disciplinas rodam isolados (`estrutura.spec.ts`).
3. **Segundo dado:** a disciplina que casa ("Química", "Português", "Matemática") e a que não casa ("Robótica", "Projeto de Vida") na mesma escola, e a da B com o mesmo nome; o isolamento usa o componente igual ao da B, que é o que deixa a escola tirada do `travarPorId` vermelha.
4. **Checagem anterior:** `PATCH` cai em `JwtAuthGuard` e no papel de coordenação antes do service; o caso do professor e do aluno prova o 404 da rota inexistente, e o da coordenação chega ao service com o corpo válido. O dublê não existe: tudo é Postgres real.
5. **Asserção:** olha a resposta, o banco e a auditoria, não o texto do código; as de ausência (auditoria vazia, nenhuma `execucao_agente`) vêm depois do `PATCH` que a produziria, na mesma cena em que o caso positivo prova que ele rodou.
6. **Guarda nova:** nenhuma. O teste estrutural existente (`architecture.test.ts`) é que lê o item 1 do `docs/modelo-de-dados.md`.
7. **Comentários e docs:** os docblocks dizem o que o código faz (o `PATCH` não agenda nada: a 6.0 acrescenta o job). Os nomes de comando, tabela e caso do `interface.md`, do `modelo-de-dados.md` e do `TODO.md` vêm da árvore.
8. **Divergências:** a tabela abaixo; as duas que mudam a regra de candidatas e a do `PATCH` entraram na `techspec.md` §3 e no `cenarios.md`; o `prd.md` não diz o contrário (RF1 fala em "componente da disciplina", sem listar siglas).
9. **Peça que já existe:** `chaveDaDisciplina` (normalizador), `AuditoriaRecorder`, `FormDialog`, `useSingleSubmit`, `Select`, `listChanged` e `errorText` da tela; `esperarNaTrava`; as fixtures `criarDisciplinaNoBanco` e `montarEstruturaNoBanco` do e2e.
10. **Corrida:** dois `PATCH` iguais em `Promise.all` auditam uma vez só, e a ordem forçada (a trava da linha segurada por outra conexão, `esperarNaTrava`) prova que o de antes é lido depois da trava. Na tela, o `PATCH` segurado com `page.route`.
11. **Isolamento:** todo id é da B lido no contexto da A, e o repository sozinho (`travarPorId`, `definirComponente`) também; tirar o `escola_id` de qualquer um dos dois deixa um `expect` vermelho. A coluna "Caso" está preenchida.
12. **Guardiões:** `tenancy-guardian` (escopo na trava e na escrita, 404 igual), `infra-guardian` (migration expand-only com `lock_timeout`, carga idempotente, `for update` curto), `frontend-reviewer` (quatro estados, 360 px, 44 px, foco), `domain-researcher` (candidatas, Ciências no EF, sem Computação). Não há `achados/indice.md` com linha que toque estas peças.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Biologia, Física e Química procuram em Ciências (`CI`) no Fundamental; Filosofia e Sociologia não têm candidata do Fundamental | A BNCC do Fundamental não tem esses componentes: o conteúdo está em Ciências, e a sigla `BI`/`FI`/`QU` não existe nos códigos. "Componente e anos das séries" (§3) não dizia qual sigla | `techspec.md` §3 "Componentes" (a frase nova), `cenarios.md` "Tabela BNCC e componente" (o caso `[U]` novo), `componentes.test.ts` |
| A tabela ganha, além do check do código, o do recorte da etapa e os de valor de componente e de área | O check do código sozinho aceitaria linha de EF sem componente ou de EM com anos, e a candidata dependeria de dado torto | `techspec.md` §3 "Carga" (a frase nova), `docs/modelo-de-dados.md` item 1, `habilidade-bncc.int.test.ts` › a linha precisa ser do Fundamental… |
| `EF07MA33` fica com o texto do `bncc-dados`, e o PDF vence nas outras 912 | O π da descrição não está na camada de texto do PDF; a conferência registra a exceção no cabeçalho do JSON, com o hash do PDF e o das habilidades | `techspec.md` §3 "Carga", subtarefa 1.2, cabeçalho do `dados-2026.08.json` (`conferencia.excecao`) |
| O `PATCH` roda numa transação com a linha travada e só audita quando o componente muda | Sem a trava, dois `PATCH` iguais auditam duas vezes e o "antes" pode ser o de uma troca que já terminou; a 6.0 usa a auditoria como chave do job | `techspec.md` §3 "Componentes" (a frase nova) e §5 "Agendar", item (b); `cenarios.md` (o caso `[I]` novo) |

## Mutações

--faltando: 43 linhas (41 blocos, 6 motivos)

```mutacao
arquivo: apps/api/src/estrutura/disciplina/disciplina.service.ts
teste: apps/api/test/estrutura.int.test.ts › isolamento: a coordenação da A não alcança a disciplina da B
      const atual = await repositorio.travarPorId(id)
-     if (atual === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      let resultado = atual
```

```mutacao
arquivo: apps/api/src/estrutura/disciplina/disciplina.service.ts
teste: apps/api/test/estrutura.int.test.ts › com o de antes e o de depois
      let resultado = atual
-     if (pedido.nome !== undefined) {
+     if (true) {
        const renomeada = await repositorio.renomear(id, pedido.nome)
        if (renomeada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/estrutura/disciplina/disciplina.service.ts
teste: apps/api/test/estrutura.int.test.ts › a disciplina criada depois nasce com o componente
        resultado = renomeada
      }
-     if (pedido.componenteBncc !== undefined && pedido.componenteBncc !== atual.componenteBncc) {
+     if (pedido.componenteBncc !== atual.componenteBncc) {
        const alterada = await repositorio.definirComponente(id, pedido.componenteBncc)
        if (alterada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/estrutura/disciplina/disciplina.service.ts
teste: apps/api/test/estrutura.int.test.ts › concorrência, ordem forçada
        resultado = renomeada
      }
-     if (pedido.componenteBncc !== undefined && pedido.componenteBncc !== atual.componenteBncc) {
+     if (pedido.componenteBncc !== undefined) {
        const alterada = await repositorio.definirComponente(id, pedido.componenteBncc)
```

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/api/test/estrutura.int.test.ts › a disciplina criada depois nasce com o componente
-     .values({ escolaId: requireEscolaId(), nome: pedido.nome, area: pedido.area ?? null, componenteBncc: componenteDoNomeDaDisciplina(pedido.nome) })
+     .values({ escolaId: requireEscolaId(), nome: pedido.nome, area: pedido.area ?? null, componenteBncc: null })
```

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/api/test/estrutura.int.test.ts › isolamento: a coordenação da A não alcança a disciplina da B
      .from(disciplina)
-     .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
+     .where(and(eq(disciplina.id, id)))
      .for('update')
```

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/api/test/estrutura.int.test.ts › concorrência, ordem forçada
      .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
-     .for('update')
    return linha
```

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/api/test/estrutura.int.test.ts › isolamento: a coordenação da A não alcança a disciplina da B
      .set({ componenteBncc: componente })
-     .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
+     .where(and(eq(disciplina.id, id)))
      .returning(colunas)
```

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/api/test/estrutura.int.test.ts › duas disciplinas na mesma escola
      .from(disciplina)
-     .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
+     .where(and(eq(disciplina.escolaId, requireEscolaId())))
      .for('update')
```

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/api/test/estrutura.int.test.ts › duas disciplinas na mesma escola
      .set({ componenteBncc: componente })
-     .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
+     .where(and(eq(disciplina.escolaId, requireEscolaId())))
      .returning(colunas)
```

```mutacao
arquivo: packages/shared/src/estrutura/disciplina.ts
teste: apps/api/test/estrutura.int.test.ts › a disciplina criada depois nasce com o componente
-   .refine((pedido) => pedido.nome !== undefined || pedido.componenteBncc !== undefined, { message: 'Informe o nome ou o componente.' })
+   .refine((pedido) => pedido.componenteBncc !== undefined, { message: 'Informe o nome ou o componente.' })
```

```mutacao
arquivo: packages/shared/src/estrutura/disciplina.ts
teste: apps/api/test/estrutura.int.test.ts › com o de antes e o de depois
-   .refine((pedido) => pedido.nome !== undefined || pedido.componenteBncc !== undefined, { message: 'Informe o nome ou o componente.' })
+   .refine((pedido) => pedido.nome !== undefined, { message: 'Informe o nome ou o componente.' })
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: apps/api/test/estrutura.int.test.ts › com o de antes e o de depois
    entidade: 'disciplina',
    antes: z.strictObject({ componenteBncc: z.enum(COMPONENTES_BNCC).nullable() }),
-   depois: z.strictObject({ componenteBncc: z.enum(COMPONENTES_BNCC).nullable() }),
+   depois: z.strictObject({ componenteBncc: z.literal('inexistente') }),
    finalidade: null,
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › "Projeto de Vida" e "Robótica" ficam sem componente
-   return COMPONENTE_PELA_CHAVE_DO_NOME[chaveDaDisciplina(nome)] ?? null
+   return COMPONENTE_PELA_CHAVE_DO_NOME[chaveDaDisciplina(nome)] ?? 'matematica'
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › `EF67EF` vale no 6º e no 7º
-const CODIGO_DO_FUNDAMENTAL = /^EF(06|07|08|09|67|69|89)([A-Z]{2})\d{2}$/
+const CODIGO_DO_FUNDAMENTAL = /^EF(06|07|08|09|67|69)([A-Z]{2})\d{2}$/
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › Língua Portuguesa no Médio traz `EM13LP` e `EM13LGG`
-const CODIGO_DO_MEDIO = /^EM13(?:(LGG|MAT|CNT|CHS)\d{3}|(LP)\d{2})$/
+const CODIGO_DO_MEDIO = /^EM13(?:(LGG|MAT|CNT|CHS)\d{3}|(XX)\d{2})$/
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › sem série não há candidata
  const partes = partesDoCodigoBncc(codigo)
- if (partes === null) return false
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › o material do 9º ano e do 1º do Médio
  const partes = partesDoCodigoBncc(codigo)
  if (partes === null) return false
- if (partes.etapa === 'em') return series.some((serie) => serie.etapa === 'em') && SIGLAS_NO_MEDIO[componente].includes(partes.sigla)
+ if (partes.etapa === 'em') return SIGLAS_NO_MEDIO[componente].includes(partes.sigla)
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › `EM13CNT301` é candidata de Química e de Física
  const partes = partesDoCodigoBncc(codigo)
  if (partes === null) return false
- if (partes.etapa === 'em') return series.some((serie) => serie.etapa === 'em') && SIGLAS_NO_MEDIO[componente].includes(partes.sigla)
+ if (partes.etapa === 'em') return series.some((serie) => serie.etapa === 'em')
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › Biologia, Física e Química no Fundamental procuram em Ciências
- if (sigla !== partes.sigla) return false
+ if (false) return false
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › o código de um ano só
  const anos = partes.anos ?? []
- return series.some((serie) => serie.etapa === 'ef_anos_finais' && anos.includes(serie.ano))
+ return series.some((serie) => serie.etapa === 'ef_anos_finais')
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › sem série não há candidata
- if (fundamental !== null) return { etapa: 'ef_anos_finais', anos: ANOS_DO_PREFIXO[fundamental[1] ?? ''] ?? [], sigla: fundamental[2] ?? '' }
+ if (true) return { etapa: 'ef_anos_finais', anos: ANOS_DO_PREFIXO[fundamental[1] ?? ''] ?? [], sigla: fundamental[2] ?? '' }
```

```mutacao
arquivo: packages/shared/src/bncc/componentes.ts
teste: packages/shared/src/bncc/componentes.test.ts › sem série não há candidata
- if (medio !== null) return { etapa: 'em', anos: null, sigla: medio[1] ?? medio[2] ?? '' }
+ if (true) return { etapa: 'em', anos: null, sigla: medio[1] ?? medio[2] ?? '' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › com dado: cada linha diz o componente da disciplina
- return componente === null ? 'Sem componente' : `Componente da BNCC: ${NOME_DO_COMPONENTE[componente]}`
+ return `Componente da BNCC: ${NOME_DO_COMPONENTE[componente as ComponenteBncc]}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › "Sem componente" apaga
- const [escolhido, definirEscolhido] = useState<string>(atual ?? SEM_COMPONENTE)
+ const [escolhido, definirEscolhido] = useState<string>(SEM_COMPONENTE)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › erro ao salvar: o diálogo fica aberto
- const sumiu = mutacao.isError && listChanged(mutacao.error, [ErrorCode.NAO_ENCONTRADO])
+ const sumiu = mutacao.isError
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › "Sem componente" apaga
-   enviar(componente ?? null)
+   enviar(componente as ComponenteBncc)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › erro ao salvar: o diálogo fica aberto
      rotuloDoEnvio="Salvar componente"
      rotuloEnviando="Salvando…"
      semNovaTentativa={sumiu}
      focoDeReserva={focoDeReserva}
      falha={
-       mutacao.isError
+       false
          ? errorText(mutacao.error, {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › "Sem componente" apaga
-             disciplina.componenteBncc === null
+             false
                ? `Componente da BNCC de ${disciplina.nome} apagado.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › "Sem componente" apaga
-         atual={alvo.componenteBncc ?? null}
+         atual={null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › "Renomear" a disciplina abre só o diálogo do nome
-     {aberta?.tipo === 'componente_da_disciplina' && alvo !== undefined ? (
+     {alvo !== undefined ? (
        <ComponenteDaDisciplina
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › a carga de novo dá a mesma contagem
-ON CONFLICT ("codigo") DO UPDATE SET "descricao" = EXCLUDED."descricao", "etapa" = EXCLUDED."etapa", "componente" = EXCLUDED."componente", "area" = EXCLUDED."area", "anos" = EXCLUDED."anos", "versao" = EXCLUDED."versao", "localizador" = EXCLUDED."localizador";--> statement-breakpoint
+ON CONFLICT ("codigo") DO NOTHING;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › o JSON com um código a menos não apaga o código
-INSERT INTO "habilidade_bncc" ("codigo", "descricao", "etapa", "componente", "area", "anos", "versao", "localizador")
+DELETE FROM "habilidade_bncc";--> statement-breakpoint
+INSERT INTO "habilidade_bncc" ("codigo", "descricao", "etapa", "componente", "area", "anos", "versao", "localizador")
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › o check do código recusa
-	CONSTRAINT "habilidade_bncc_codigo_valido" CHECK ("habilidade_bncc"."codigo" ~ '^(EF(06|07|08|09|67|69|89)[A-Z]{2}[0-9]{2}|EM13(LGG|MAT|CNT|CHS)[0-9]{3}|EM13LP[0-9]{2})$'),
+	CONSTRAINT "habilidade_bncc_codigo_valido" CHECK ("habilidade_bncc"."codigo" ~ '^(EF[0-9]{2}[A-Z]{2}[0-9]{2}|EM13(LGG|MAT|CNT|CHS)[0-9]{3}|EM13LP[0-9]{2})$'),
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › o check do código recusa
-	CONSTRAINT "habilidade_bncc_codigo_valido" CHECK ("habilidade_bncc"."codigo" ~ '^(EF(06|07|08|09|67|69|89)[A-Z]{2}[0-9]{2}|EM13(LGG|MAT|CNT|CHS)[0-9]{3}|EM13LP[0-9]{2})$'),
+	CONSTRAINT "habilidade_bncc_codigo_valido" CHECK ("habilidade_bncc"."codigo" ~ '^(EF(06|07|08|09|67|69|89)[A-Z]{2}[0-9]{2}[A-Z]?|EM13(LGG|MAT|CNT|CHS)[0-9]{3}|EM13LP[0-9]{2})$'),
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › a linha precisa ser do Fundamental
-         or ("habilidade_bncc"."etapa" = 'em' and "habilidade_bncc"."area" is not null and "habilidade_bncc"."anos" is null)),
+         or ("habilidade_bncc"."etapa" = 'em' and "habilidade_bncc"."area" is not null)),
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › só expande
-ALTER TABLE "disciplina" ADD CONSTRAINT "disciplina_componente_bncc_valido" CHECK ("disciplina"."componente_bncc" is null or "disciplina"."componente_bncc" in (
+ALTER TABLE "disciplina" ADD CONSTRAINT "disciplina_componente_bncc_valido" CHECK (true or "disciplina"."componente_bncc" in (
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › o casamento de novo não desfaz o que a coordenação definiu
-WHERE "disciplina"."componente_bncc" IS NULL
+WHERE true
```

```mutacao
arquivo: packages/core/drizzle/0059_habilidade_bncc.sql
teste: packages/core/src/db/habilidade-bncc.int.test.ts › as disciplinas de antes ganham o componente pelo nome
-	AND regexp_replace(lower(translate(btrim("disciplina"."nome"), 
+	AND regexp_replace(lower(translate("disciplina"."nome", 
```

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: apps/api/test/architecture.test.ts › a CLASSIFICACAO_DAS_TABELAS confere com as migrations
  disciplina: SEM_PESSOA,
  // As habilidades da BNCC (classificacao-bncc, 1.0): tabela pública, sem escola e sem pessoa; a carga é o texto oficial.
- habilidade_bncc: SEM_PESSOA,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: e2e/estrutura.spec.ts › a resposta que chega depois não fecha o diálogo da outra
                : `Componente da BNCC de ${disciplina.nome}: ${NOME_DO_COMPONENTE[disciplina.componenteBncc]}.`,
            )
-           dialogo.fecharSeAinda(aberta)
+           dialogo.fechar()
```

```mutacao
arquivo: apps/web/src/components/ui/fields/Select.tsx
teste: e2e/estrutura.spec.ts › 360 px: sem rolagem lateral, também no diálogo
- <label htmlFor={campo} className={rotuloOculto || pilula ? 'sr-only' : 't-apoio font-bold break-words text-tinta'}>
+ <label htmlFor={campo} className={rotuloOculto || pilula ? 'sr-only' : 't-apoio font-bold text-tinta'}>
```

Sem mutação que um teste veja (cada motivo, a meia linha):

- `if (renomeada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)` e o `alterada`: a linha está travada (`for update`) na mesma transação, então o `update` que se segue sempre a acha; o ramo existe para o tipo (`returning` devolve lista) e para a trava um dia sair.
- `pedido.area ?? null`: linha que já existia, só o `componenteBncc` entrou no `values`.
- `fundamental[1] ?? ''`, `fundamental[2] ?? ''`, `medio[1] ?? medio[2] ?? ''` e `partes.anos ?? []`: o regex garante o grupo; o `??` é o que o `noUncheckedIndexedAccess` pede.
- `(serie) => serie.etapa === 'ef_anos_finais'` (em `habilidadeEhCandidata`): o ramo do Médio já saiu antes, e os anos do Médio (1 a 3) nunca estão entre os do Fundamental (6 a 9); o termo deixa a leitura explícita.
- `rotuloOculto` e `pilula` (no `Select.tsx`): a condição já existia, e só o texto da classe do ramo de baixo mudou; o bloco acima prova o texto novo.
- `mutacao.isError` (em `sumiu`): `mutacao.error` é nulo sem erro e `listChanged(null, …)` é falso; o termo é o estreitamento de tipo.
- `alvo !== undefined` (em `Estrutura.tsx`): o diálogo `componente_da_disciplina` só abre a partir da linha de uma disciplina, que sempre tem alvo; o termo é o estreitamento do tipo, igual ao dos diálogos irmãos.
- O `schema/habilidade-bncc.ts` e o `check` novo de `schema/disciplina.ts`: o schema TypeScript é o espelho do `0059_habilidade_bncc.sql`, que é o que o banco roda e que os blocos `.sql` acima mutam.

## Recomendações sem aplicar

Da rodada 1 (`.processo/ordens/1_task-r1.md`). Viraram linha no `TODO.md` a 1ª, a 3ª, a 5ª, a 6ª e a 7ª; a 2ª e a 4ª foram recusadas, e o resto não muda nada aqui.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian 1ª | `disciplinaSchema` é `.strict()` e ganhou `componenteBncc`: aba com o bundle antigo recusa a resposta até recarregar | `TODO.md` (linha da classificacao-bncc 1.0, rodada 1) |
| infra-guardian 1ª | `ADD CONSTRAINT … CHECK` sem `NOT VALID` varre `disciplina` com ACCESS EXCLUSIVE; na próxima constraint em tabela grande, `NOT VALID` e `VALIDATE` à parte | Recusada: hoje cabe (dezenas de linhas por escola) e o comentário da migration justifica; é conselho para a próxima constraint |
| frontend-reviewer 1ª | A linha do painel com três botões deixa a coluna do nome com ~95 px a 1366 px | `TODO.md`; a foto da rodada 2 (Estrutura, escola cheia, Química com componente) mostra os botões empilhados ao lado do nome, sem rolagem lateral e com o texto legível |
| frontend-reviewer 1ª | O título do diálogo e o rótulo repetem "Componente da BNCC" | Recusada: "aceitável" e "baixa prioridade" pelo próprio revisor, e o texto vem do `docs/interface.md` |
| tenancy-guardian 1ª, revisor-geral 1ª | `renomear` e o schema agora também definem o componente: `atualizar` diria melhor | `TODO.md` |
| revisor-geral 1ª | `AlvoDoDialogo` ganhou `componenteBncc?` e `AcoesDaLinha` sempre mostra "Componente" | `TODO.md` |
| privacy-guardian 1ª, conformidade-reviewer 1ª | Na 6.0, o job disparado por `disciplina.componente_alterado` envia material ao provedor: auditar em `ExecucaoAgente`; AIA (D60) | `TODO.md`, para a 6.0 |
| privacy-guardian 1ª | O cabeçalho do JSON diz "a confirmar com advogado" sobre a BNCC ser ato oficial | Já está em `techspec.md` §12 |
| test-engineer 1ª | " química " é trocado por " física " no teste da migration por causa do índice único | Sem o que mudar: o motivo está no comentário e o caso literal está em `componentes.test.ts` |
| test-engineer 1ª | O `Promise.all` poderia passar por sorte sem a trava | Sem o que mudar: a ordem forçada prova o mesmo, e os dois ficam juntos |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 12:31:07 | 2026-11-17 12:31:43 | `tenancy-guardian` | 1 | APROVADO | a738a61db4be58ecf |
| 2026-11-17 12:31:16 | 2026-11-17 12:32:04 | `infra-guardian` | 1 | APROVADO | a77ab41c56bc79fca |
| 2026-11-17 12:31:24 | 2026-11-17 12:32:05 | `frontend-reviewer` | 1 | APROVADO | aa30c9901119ca640 |
| 2026-11-17 12:32:00 | 2026-11-17 12:32:36 | `conformidade-reviewer` | 1 | APROVADO | a7e05938be87a8344 |
| 2026-11-17 12:31:51 | 2026-11-17 12:32:42 | `privacy-guardian` | 1 | APROVADO | a4eb1391a11af37dc |
| 2026-11-17 12:31:42 | 2026-11-17 12:33:22 | `revisor-geral` | 1 | APROVADO | af8aabc29d08e829b |
| 2026-11-17 12:31:33 | 2026-11-17 12:33:35 | `test-engineer` | 1 | REPROVADO | a5ddeca94c58054a2 |
| 2026-11-17 13:13:26 | 2026-11-17 13:13:52 | `tenancy-guardian` | 2 | APROVADO | a087af2745e95918c |
| 2026-11-17 13:13:50 | 2026-11-17 13:14:10 | `frontend-reviewer` | 2 | APROVADO | a5cf069d528baf4ef |
| 2026-11-17 13:13:37 | 2026-11-17 13:14:11 | `infra-guardian` | 2 | APROVADO | a75bc588f22d096cf |
| 2026-11-17 13:14:30 | 2026-11-17 13:14:55 | `privacy-guardian` | 2 | APROVADO | ab3325fc30ec710fd |
| 2026-11-17 13:14:18 | 2026-11-17 13:15:03 | `revisor-geral` | 2 | APROVADO | abd7830b4277e50dd |
| 2026-11-17 13:14:05 | 2026-11-17 13:15:11 | `test-engineer` | 2 | APROVADO | a126ec2f008893050 |
| 2026-11-17 13:14:42 | 2026-11-17 13:15:14 | `conformidade-reviewer` | 2 | APROVADO | a2f1c35287322c65b |
