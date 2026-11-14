# Correção — a adaptação de um artefato herda trecho e citação de material com licença vencida ou edição substituída

**Origem:** validacao.md de ingestao-do-material (`tasks/prd-ingestao-do-material/validacao.md`, seção 4, achado maior 1)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `revisor-geral`, `infra-guardian`
<!-- test-engineer é obrigatório em toda correção, marcado ou não. -->

## Sintoma

`POST /v1/artefatos/:id/adaptar` (`ArtefatoService.adaptar`, `artefato.service.ts`) não olhava o material que o original cita. A
entrada da tarefa é o conteúdo inteiro do original (`{ conteudo: lida.original, adaptacao }`), que leva o **texto da
página citada**, e `exigirAdaptacaoFiel` obriga a versão nova a repetir `materialId`, `pagina` e `trecho`. Então:

- com a **licença vencida**, o texto do material licenciado ia de novo ao provedor e nascia um artefato novo, com
  entrega, citando material que a escola já não pode usar (D5);
- com a **edição substituída**, o artefato gerado antes da troca gerava uma versão nova que citava a edição anterior.

O PRD diz o contrário: RF7 lista a adaptação entre as gerações que só usam material da série; o caso de borda "Licença
vence com atividade em rascunho citando o material" diz "geração nova não usa o material"; RF11 diz "geração nova só cita
a edição atual". Nenhum teste fixava o comportamento. O Joaquim escolheu recusar (pedido do Orquestrador desta correção).

## Fora desta correção

nada

## Causa

A Tech Spec registrou na 9.0 a decisão contrária (a adaptação "não lê material", então não passa pelo filtro de
`proprioOuComLicencaVigente`), sob o argumento de que a adaptação de uma atividade pronta não pode parar porque a licença
venceu depois. Só que a adaptação **lê** o material: o trecho vai dentro do conteúdo do original, para o modelo e de
volta, e a versão nova é uma geração nova que cita a página. O filtro da 9.0 cobria as quatro leituras de trecho e nenhuma
conferência do que o conteúdo já gravado cita.

## Teste que reproduz

`apps/api/src/artefato/artefato.int.test.ts`, no `describe` "a adaptação de artefato cujo material saiu de uso":

- "licença vencida: a adaptação é recusada com LICENCA_VENCIDA antes do 202, sem execução, versão, entrega nem texto do
  material no modelo; vigente, a mesma atividade se adapta" (inclui a licença que vence entre o 202 e a execução)
- "edição substituída: a adaptação do artefato antigo é recusada com EDICAO_SUBSTITUIDA, também depois do expurgo da linha,
  e a atividade gerada da edição nova se adapta"
- "isolamento: o artefato de `g` cujo `jsonb` cita um material em uso de `h` não é adaptado" (regra 10, item 5)
- "edição trocada entre o 202 e a execução: a execução falha com EDICAO_SUBSTITUIDA antes de chamar o modelo, e nada nasce"
- "dois materiais citados, um em uso e outro com a licença vencida: a adaptação é recusada com LICENCA_VENCIDA"

Vermelho antes (os dois primeiros voltavam `202` em vez de `422`), verde depois: 35 casos do arquivo. O reenvio da chave já
aceita, com a licença vencida, devolve a mesma execução (no caso da licença).

## Correção

A adaptação confere o material que o original cita, antes de pedir ao modelo (`exigirMaterialEmUso`, em `artefato.service.ts`; `materiaisForaDoUso`, em `artefato.repository.ts`, que reusa o `proprioOuComLicencaVigente` da 9.0):

- licença de terceiro que não vale hoje (`diaDeUso`, dia de São Paulo): `LICENCA_VENCIDA` (422);
- edição substituída, ou cuja linha o expurgo apagou (ou id que a escola do contexto não alcança): `EDICAO_SUBSTITUIDA` (422), código novo, com a mensagem "gere a atividade de novo". A mensagem de `LICENCA_VENCIDA` manda atualizar a vigência em Licenças, e para a edição trocada isso é falso.
  Usei código novo porque o pedido dizia só "recusar e pedir geração nova" para a edição; se o Joaquim preferir `LICENCA_VENCIDA` também nela, é trocar a linha do `throw` e a mensagem.
- a conferência roda **antes do `202`** (menos no reenvio da chave já aceita, que devolve a mesma execução, como a ferramenta) e **de novo na entrada da execução**, antes de o texto do material ir ao modelo: a licença que vence entre o `202` e a execução falha com `LICENCA_VENCIDA`, sem chamar o modelo. A recusa não grava execução, versão nem entrega.

**O material excluído pela coordenação fica fora da conferência, por escolha declarada** (só licença e edição decidem): o artefato que cita material excluído continua adaptável, e o trecho dele vai ao modelo. Está na Tech Spec §5 e vai ao Joaquim em "Recomendações sem aplicar".

Tech Spec §5 ("Como ficou na 9.0") e §11 alinhadas no mesmo commit; `docs/mvp-contratos.md` ganha os dois códigos na rota. O PRD já dizia isso (RF7, RF11, caso de borda), e não muda.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Caso na suíte do material: material de `g` que aponta para licença vigente de `h` conta como sem licença (escopo da subquery de `licenca_de_material`) | `TODO.md`. O filtro é anterior a esta correção e vive em `material.repository.ts`, arquivo que a correção não toca |
| infra-guardian (1ª) | `daChave` faz uma leitura a mais por pedido; o agendador pode dizer se é reenvio | Recusada: a leitura usa o índice único `execucao_agente_chave_na_escola_unica`, o próprio revisor a chama de custo pequeno, e tirá-la muda o contrato do agendador |
| infra-guardian (1ª) | Contador por código para `LICENCA_VENCIDA` e `EDICAO_SUBSTITUIDA` | `TODO.md`. Métrica nova é tarefa própria; não está no caminho quente |
| privacy-guardian (1ª), revisor-geral (1ª), test-engineer (1ª) | Injetar o `Clock` no `ArtefatoService` em vez de `systemClock.agora()` (`artefato.service.ts:76`), o que também permite testar a virada do dia na rota | `TODO.md`. Muda o construtor e a fiação do módulo, e o dia de uso já é coberto pelo filtro da 9.0 |
| conformidade-reviewer (1ª), llm-integrator (1ª) | Confirmar com o Joaquim que material excluído pela coordenação pode continuar indo ao modelo dentro do conteúdo do original | Pergunta ao Joaquim, que o Orquestrador leva; a Mesa não decide regra de produto. A escolha atual fica registrada na Tech Spec §5 |
| conformidade-reviewer (1ª), llm-integrator (1ª), test-engineer (1ª) | Texto de `LICENCA_VENCIDA` manda ir a Licenças (escrito para a coordenação) e a professora é quem o recebe; com as duas falhas sai `LICENCA_VENCIDA`; conferir se a tela da professora trata `EDICAO_SUBSTITUIDA` | Texto de tela e tela da professora são decisão do Joaquim: o Orquestrador leva a pergunta. A Mesa conferiu que `apps/web` só trata esses códigos do lado da coordenação (`areas/coordenacao/material/`) |
| revisor-geral (1ª) | A linha `--faltando: 6 linhas (9 blocos, 2 motivos)` parece saída de ferramenta colada | Recusada: é a convenção da seção "Mutações" dos documentos de correção (`2026-11-02-mutacao-diz-o-expect`, `2026-11-07-testes-sob-carga`, `2026-11-09-byte-alterado-do-cookie-oidc` a trazem) |
| test-engineer (1ª) | O documento manda rodar `npx vitest run <arquivo>`; dizer que é a partir da raiz | Recusada: o documento da correção não traz esse comando (conferido), então não há o que corrigir |
| revisor-geral (2ª) | `cenarios.md:137` diz "como nos três cenários da adaptação abaixo", mas eles estão acima, em Licenças (linhas 123-125) | Quando o Joaquim responder sobre o material excluído, quem edita o `cenarios.md` troca "abaixo" por "acima". É uma palavra, mas o revisor aprovou e a ordem já foi aplicada |
| revisor-geral (2ª), test-engineer (2ª) | A linha do material excluído (`cenarios.md:126` e `:181`) não tem `[I]` nem teste que a fixe | Depende da resposta do Joaquim à pergunta já levada ("material excluído pode ir ao modelo?"). Qualquer que seja, vira um caso `[I]` com mutação (`excluido_em` em `materiaisForaDoUso`) |
| revisor-geral (2ª) | O comentário do `reenvio` (`artefato.service.ts:155`) tem três frases numa linha; a parte do `artefatoId` cabe em uma | Estilo, sem mudar comportamento: fica para a próxima edição desse trecho |
| test-engineer (2ª) | Sem teste da ordem entre os dois códigos (licença vencida e edição substituída juntas saem `LICENCA_VENCIDA`) | Depende da resposta do Joaquim sobre o texto e o código para a professora (já em "Recomendações sem aplicar" do documento). Confirmada a ordem, vira um caso |

## Mutações

--faltando: 6 linhas (11 blocos, 2 motivos)

Cláusulas sem bloco, e por quê:

- `artefato.repository.ts`, o `if (ids.length === 0) return` de `materiaisForaDoUso`: guarda do `inArray` vazio; a atividade objetiva sempre cita (a citação é obrigatória em toda questão), então `exigirMaterialEmUso` nunca chama com lista vazia.
- `artefato.repository.ts`, o `coalesce(..., true)` do `emUso`: guarda de tipo (`proprioOuComLicencaVigente` devolve `SQL | undefined` pelo `or` do drizzle, e nunca é `undefined` em execução); o resultado é o mesmo com ou sem ela.

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts › isolamento: o artefato de `g`
 .select({ id: material.id, substituido: sql<boolean>`${material.substituidoPor} is not null`, emUso: sql<boolean>`coalesce(${proprioOuComLicencaVigente(this.banco, hoje)}, true)` })
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), inArray(material.id, [...ids])))
+.where(and(inArray(material.id, [...ids])))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts › licença vencida: a adaptação é recusada
-return { licencaVencida: linhas.some((linha) => !linha.emUso), substituido: linhas.length < new Set(ids).size || linhas.some((linha) => linha.substituido) }
+return { licencaVencida: false, substituido: linhas.length < new Set(ids).size || linhas.some((linha) => linha.substituido) }
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts › edição substituída: a adaptação do artefato antigo
-return { licencaVencida: linhas.some((linha) => !linha.emUso), substituido: linhas.length < new Set(ids).size || linhas.some((linha) => linha.substituido) }
+return { licencaVencida: linhas.some((linha) => !linha.emUso), substituido: linhas.length < new Set(ids).size }
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts › edição substituída: a adaptação do artefato antigo
-return { licencaVencida: linhas.some((linha) => !linha.emUso), substituido: linhas.length < new Set(ids).size || linhas.some((linha) => linha.substituido) }
+return { licencaVencida: linhas.some((linha) => !linha.emUso), substituido: linhas.some((linha) => linha.substituido) }
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts › licença vencida: a adaptação é recusada
 const fora = await artefatos.materiaisForaDoUso(ids, diaDeUso(systemClock.agora()))
-if (fora.licencaVencida) throw new DomainException(ErrorCode.LICENCA_VENCIDA)
 if (fora.substituido) throw new DomainException(ErrorCode.EDICAO_SUBSTITUIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts › edição substituída: a adaptação do artefato antigo
 if (fora.licencaVencida) throw new DomainException(ErrorCode.LICENCA_VENCIDA)
-if (fora.substituido) throw new DomainException(ErrorCode.EDICAO_SUBSTITUIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts › licença vencida: a adaptação é recusada
-if (!reenvio) await exigirMaterialEmUso(new ArtefatoRepository(this.banco), original)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts › licença vencida: a adaptação é recusada
-const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa === 'adaptar_atividade'
+const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa === 'nenhuma'
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts › licença vencida: a adaptação é recusada
 // Entre o `202` e a execução a licença pode vencer ou a edição ser trocada: o texto do material só vai ao modelo se ainda estiver em uso.
-await exigirMaterialEmUso(new ArtefatoRepository(this.banco), lida.original)
 return { conteudo: lida.original, adaptacao }
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/src/artefato/artefato.int.test.ts › dois materiais citados, um em uso e outro com a licença vencida
-return { licencaVencida: linhas.some((linha) => !linha.emUso), substituido: linhas.length < new Set(ids).size || linhas.some((linha) => linha.substituido) }
+return { licencaVencida: linhas.every((linha) => !linha.emUso), substituido: linhas.length < new Set(ids).size || linhas.some((linha) => linha.substituido) }
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/src/artefato/artefato.int.test.ts › edição trocada entre o 202 e a execução
 // Entre o `202` e a execução a licença pode vencer ou a edição ser trocada: o texto do material só vai ao modelo se ainda estiver em uso.
-await exigirMaterialEmUso(new ArtefatoRepository(this.banco), lida.original)
 return { conteudo: lida.original, adaptacao }
```


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-14 12:31:38 | 2026-11-14 12:32:05 | `tenancy-guardian` | 1 | APROVADO | adcd2ae254bb7e485 |
| 2026-11-14 12:31:46 | 2026-11-14 12:32:08 | `infra-guardian` | 1 | APROVADO | ab9dd5fe53eb6c14f |
| 2026-11-14 12:31:40 | 2026-11-14 12:32:09 | `privacy-guardian` | 1 | APROVADO | ae02479524dd66244 |
| 2026-11-14 12:31:42 | 2026-11-14 12:32:11 | `conformidade-reviewer` | 1 | APROVADO | acdcce24d80b8f61d |
| 2026-11-14 12:31:43 | 2026-11-14 12:32:15 | `llm-integrator` | 1 | APROVADO | a85a70e42ce51e8d2 |
| 2026-11-14 12:31:45 | 2026-11-14 12:32:29 | `revisor-geral` | 1 | REPROVADO | afee6d78d840ade60 |
| 2026-11-14 12:31:48 | 2026-11-14 12:33:16 | `test-engineer` | 1 | APROVADO | a3c6a3f9845bcc058 |
| 2026-11-14 12:43:26 | 2026-11-14 12:43:48 | `revisor-geral` | 2 | APROVADO | a926d17ad2f4c9ca7 |
| 2026-11-14 12:43:31 | 2026-11-14 12:44:39 | `test-engineer` | 2 | APROVADO | a9fc7bf01eb1cc11a |
