# Correção — o "enviaram" da professora não conta a tentativa vencida antes do `fecha_em`

**Origem:** `tasks/prd-avaliacao-e-correcao/validacao.md` §4, achado maior 1 da rodada 2.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `frontend-reviewer` só entra se a tela mudar: a correção é na API, e a tela lê o mesmo número. -->

## Sintoma

Prova com janela aberta até amanhã, o único aluno com a tentativa vencida (o acompanhamento diz "Tempo esgotado") e a
linha da atividade diz "0 de 1 aluno enviaram", com "Os alunos estão respondendo". O aluno já a vê em "Entregues". A
contagem `participacao.enviaram` é a que a professora lê antes de decidir encerrar.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A contagem `enviaram` de `AtividadeAplicadaRepository` (`atividade-aplicada.repository.ts`, `colunas`) é uma subconsulta
`count(*)` de `tentativa_atividade` com `enviada_em is not null`. A tentativa vencida só ganha `enviada_em` quando a
rotina ou o encerramento a gravam (Tech Spec §5.5 e §5.6), e a rotina só age quando o `fecha_em` passa. Até lá a vencida
fica sem `enviada_em` e não entra na conta, contra a Tech Spec §5.5, "vencida sem envio conta como enviada em toda
leitura (RF5)". O acompanhamento já respeita isso (`situacaoDoAluno`, com `limiteDaTentativa` em memória); só a contagem
da atividade ficou de fora. O limite não se calcula em SQL: depende das extensões, das quedas fechadas e da lacuna aberta
do pulso, em ponto fixo.

## Teste que reproduz

`apps/api/src/atividade/extensao.int.test.ts` › a contagem de quem enviou, na leitura da professora › a tentativa vencida, com a janela
ainda aberta, conta como enviada (Tech Spec §5.5, RF5); a que tem tempo, a estendida e a sem limite não, e a vencida de outra
prova não passa para esta. Vermelho antes (`enviaram: 1`, esperado 2: a Ana, vencida há 20 min com a janela aberta, não
contava) e verde depois. O caso lê a mesma prova pela **lista** e pelo **`porId`** do repository (o que o aplicar, a mudança de janela e a
segunda chamada devolvem; o `porId` tem a sua asserção, e o seu bloco), e cobre a prova vizinha com extensão de 120 min para a turma
(que não anda o limite de ninguém das outras), o Caio que enviou e cujo limite passou depois (conta uma vez só), o colega estendido,
o aluno sem limite, e a prova encerrada, que não é recontada quando o limite de quem não enviou passa depois. A resposta do encerrar
confere o mesmo número, mas ela não prova a soma (a vencida já tem `enviada_em` nessa hora): a soma se prova na lista e no `porId` de uma aberta.

Dois casos irmãos, no mesmo bloco `describe`:

- `a queda fechada da API dentro da prova anda o limite…`: a tentativa com o limite base vencido há 2 min e uma queda fechada de 6 min dentro da prova não conta (`enviaram: 0`), e conta quando a queda sai (`enviaram: 1`); é a mesma conta do acompanhamento (a rodada 1 do `test-engineer`, item 1).
- `a aplicação encerrada não custa a segunda ida ao banco, e a aberta custa…`: o `porId` da encerrada faz 1 consulta ao banco e o da aberta faz 2 (a leitura e a das tentativas), contadas no pool, na escola de teste própria (regra 80; rodada 1, item 2).

## Correção

Só a API; nenhum contrato, nenhuma tela. O `AtividadeAplicadaRepository` (`porId` e `list`, os dois caminhos de toda leitura da professora:
aplicar, listar, mudar a janela, encerrar e segunda chamada) passa as linhas por `#contandoAsVencidas`: para as aplicações
**abertas**, lê numa consulta só as tentativas sem `enviada_em` (aluno, começo, `limite_base_em`, extensões, quedas, pulso e o
`now()` do banco) e soma ao `enviaram` as que `limiteDaTentativa` (a mesma função do acompanhamento, do PUT e da rotina) dá como
vencidas (`limite <= now()`, Tech Spec §5.5). A encerrada fica como o encerramento gravou: a vencida já tem `enviada_em`, e a que
ainda tinha tempo segue sem envio.

- `acompanhamento.repository.ts`: os trechos de SQL das extensões, das quedas e do último pulso viraram `extensoesDaAplicacao`,
  `indisponibilidadesDesde` e `ultimoPulsoDaApi`, exportados, para as duas leituras usarem o mesmo (o texto da consulta do acompanhamento não mudou).
- **A junção com `atividade_aplicada` é necessária, e não só filtro**: numa consulta de uma tabela, o drizzle escreve as colunas sem o nome da
  tabela, e dentro da subconsulta `atividade_aplicada_id = atividade_aplicada_id` é verdadeiro para toda linha; as extensões de todas as provas da escola
  entravam no limite de cada tentativa. A primeira versão tinha esse defeito e o teste só o pegou com os casos de antes rodando juntos; a prova
  vizinha, com extensão de 120 min para a turma, o torna determinístico.
- Sem mudança de tela: "Os alunos estão respondendo" e o resumo do encerramento já leem `participacao.enviaram`, que agora é o número certo.
  A frase de `oQueFazer` fica como está; a leitura que o validador sugeriu (dizer o mesmo do acompanhamento quando ninguém mais faz) é texto de
  tela e não é desta correção.

## Mutações

--faltando: 17 linhas (13 blocos, 3 motivos)

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-const venceu = limite !== null && limite.getTime() <= tentativa.agora.getTime()
+const venceu = limite !== null
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-const venceu = limite !== null && limite.getTime() <= tentativa.agora.getTime()
+const venceu = limite.getTime() <= tentativa.agora.getTime()
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-if (venceu) vencidas.set(tentativa.atividadeAplicadaId, (vencidas.get(tentativa.atividadeAplicadaId) ?? 0) + 1)
+if (venceu) vencidas.set(tentativa.atividadeAplicadaId, (vencidas.get(tentativa.atividadeAplicadaId) ?? 1) + 1)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
 .where(
  and(
   eq(tentativaAtividade.escolaId, requireEscolaId()),
   eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
   inArray(tentativaAtividade.atividadeAplicadaId, abertas.map((lida) => lida.id)),
-isNull(tentativaAtividade.enviadaEm),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-const abertas = lidas.filter((lida) => lida.estado === 'aberta')
+const abertas = lidas.filter(() => true)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-return lidas.map((lida) => ({ ...lida, enviaram: lida.enviaram + (vencidas.get(lida.id) ?? 0) }))
+return lidas.map((lida) => ({ ...lida, enviaram: lida.enviaram + (vencidas.get(lida.id) ?? 1) }))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-.innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId), eq(atividadeAplicada.anoLetivoId, tentativaAtividade.anoLetivoId), eq(atividadeAplicada.id, tentativaAtividade.atividadeAplicadaId)))
+.innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId), eq(atividadeAplicada.anoLetivoId, tentativaAtividade.anoLetivoId)))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-inArray(tentativaAtividade.atividadeAplicadaId, abertas.map((lida) => lida.id)),
+inArray(tentativaAtividade.atividadeAplicadaId, []),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-export const ultimoPulsoDaApi = sql`(select ${pulsoDaApi.ultimoEm} from ${pulsoDaApi} limit 1)`.mapWith(pulsoDaApi.ultimoEm)
+export const ultimoPulsoDaApi = sql`(select now() - interval '1 hour')`.mapWith(pulsoDaApi.ultimoEm)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-extensoes: tentativa.extensoes.map((extensao) => ({ alunoId: extensao.alunoId, minutos: extensao.minutos })),
+extensoes: [],
 indisponibilidades: tentativa.indisponibilidades.map((queda) => ({ inicio: new Date(queda.inicio), fim: new Date(queda.fim) })),
 pulso: tentativa.ultimoPulso === null ? null : { ultimoEm: tentativa.ultimoPulso, agora: tentativa.agora },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a queda fechada da API dentro da prova anda o limite
 extensoes: tentativa.extensoes.map((extensao) => ({ alunoId: extensao.alunoId, minutos: extensao.minutos })),
-indisponibilidades: tentativa.indisponibilidades.map((queda) => ({ inicio: new Date(queda.inicio), fim: new Date(queda.fim) })),
+indisponibilidades: [],
 pulso: tentativa.ultimoPulso === null ? null : { ultimoEm: tentativa.ultimoPulso, agora: tentativa.agora },
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a aplicação encerrada não custa a segunda ida ao banco
-if (abertas.length === 0) return lidas
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a tentativa vencida, com a janela ainda aberta, conta como enviada
-const [linha] = await this.#contandoAsVencidas(await this.#lidas(eq(atividadeAplicada.id, id)))
+const [linha] = await this.#lidas(eq(atividadeAplicada.id, id))
```

Sem bloco, com o motivo (nenhum deles muda o número que a professora lê; cada um tem a razão escrita):

- as cláusulas `eq(tentativaAtividade.escolaId, requireEscolaId())` e `eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso())`: o escopo da regra 10 (item 3), em profundidade. Os ids da consulta vêm de `#lidas`, que já aplica a escola, o ano e o vínculo da professora (`#noAlcance`), e a função é privada: nenhum caso alcança a consulta com um id de fora, então tirar a cláusula não deixa nada vermelho. Fica porque o repository é o único lugar do escopo e uma leitura nova de `tentativa_atividade` não pode confiar no chamador; o `tenancy-guardian` confere à mão.
- `eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId)` e `eq(atividadeAplicada.anoLetivoId, tentativaAtividade.anoLetivoId)` (a junção): são a chave composta da FK da tentativa; o `eq(atividadeAplicada.id, …)`, que decide quais linhas se juntam (e tem o seu bloco), já as impõe, porque o id é único. Sem elas o resultado é o mesmo.
- `eq(atividadeAplicada.turmaId, turmaId)` e `pagina === undefined ? undefined : lt(atividadeAplicada.id, pagina)` (o `list`): linhas de antes, que só ganharam o `const lidas = await` e o `return` depois da soma; a turma e a paginação já têm caso em `atividade.int.test.ts` (a lista com `limite=2` e a segunda página).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), conformidade-reviewer (1ª) | Mover `extensoesDaAplicacao`, `indisponibilidadesDesde` e `ultimoPulsoDaApi` para um arquivo próprio do limite da tentativa | Move arquivo e imports de três consumidores, e as mutações do documento mudam de arquivo: não é barata. Destino: `TODO.md` |
| revisor-geral (1ª) | Encurtar o comentário da junção (linhas 166-167) | O próprio revisor diz "vale manter". Recusada, sem ação |
| test-engineer (1ª) | Caso da fronteira `limite === agora` (Tech Spec §5.5, `limite <= now()`) | O próprio revisor diz que provar a fronteira "exigiria fixar o `now()` do banco" e "sem bloquear". Destino: `TODO.md` |
| conformidade-reviewer (1ª) | A frase `oQueFazer` ("Os alunos estão respondendo") quando ninguém mais tem tempo | Texto de tela, e o documento já o deixa fora ("Sem mudança de tela"). Destino: a tarefa de tela que tocar `oQueFazer`; registrar no `TODO.md` |
| infra-guardian (1ª) | Incluir a lista da professora, com prova aberta e quarenta tentativas, no cenário de carga da prova online | Cenário de carga é outra tarefa. Destino: `TODO.md`, quando o cenário de carga da prova online for revisto |
| privacy-guardian (2ª) | Qualificar a coluna de fora dentro de `extensoesDaAplicacao` (alias ou o nome da tabela), para um chamador futuro com uma tabela só não misturar as extensões de provas da mesma escola | Destino: `TODO.md` (o próprio revisor diz que "pode ir para o `TODO.md`"); entra na seção "Da correção 2026-11-28-enviaram-conta-a-vencida, fora dela" |
| test-engineer (2ª), tenancy-guardian (2ª) | `indisponibilidade` é global: o caso da queda depende de nenhuma outra queda cobrir o intervalo, se outro arquivo de teste rodar junto no mesmo banco | Recusada: o test-engineer escreve que "o caso da linha 340 já tinha esse mesmo risco e a esteira começa com o banco vazio, por isso fica só registrado" |
| test-engineer (2ª) | Comentário no caso `a aplicação encerrada não custa a segunda ida ao banco…` dizendo que a contagem de consultas é a prova | Recusada: não muda número nem teste, e a regra 80 já está no nome do caso. Recomendação de quem aprovou |
| conformidade-reviewer (2ª) | Fronteira `limite <= agora` e a dependência entre os dois repositórios | Já estão na tabela acima, com destino `TODO.md` |
| infra-guardian (2ª) | Cenário de carga com a lista da professora antes do piloto | Já está na tabela acima, com destino `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 13:10:46 | 2026-11-28 13:11:19 | `privacy-guardian` | 1 | APROVADO | a20f7d37a640bfe6e |
| 2026-11-28 13:10:47 | 2026-11-28 13:11:19 | `conformidade-reviewer` | 1 | APROVADO | ae0572a562fe6ca06 |
| 2026-11-28 13:10:43 | 2026-11-28 13:11:20 | `revisor-geral` | 1 | APROVADO | a7afe8f5d5c366eb2 |
| 2026-11-28 13:10:45 | 2026-11-28 13:11:21 | `tenancy-guardian` | 1 | APROVADO | a227404eab13a1d2c |
| 2026-11-28 13:10:48 | 2026-11-28 13:11:38 | `infra-guardian` | 1 | APROVADO | a609d6ca4d6028589 |
| 2026-11-28 13:10:42 | 2026-11-28 13:12:37 | `test-engineer` | 1 | REPROVADO | a2e2d157fb0284116 |
| 2026-11-28 13:27:29 | 2026-11-28 13:28:01 | `tenancy-guardian` | 2 | APROVADO | ae998a11090060337 |
| 2026-11-28 13:27:02 | 2026-11-28 13:28:02 | `test-engineer` | 2 | APROVADO | afb2b8ba4dfa25760 |
| 2026-11-28 13:27:43 | 2026-11-28 13:28:13 | `privacy-guardian` | 2 | APROVADO | a9c15a4b7e42d1495 |
| 2026-11-28 13:27:16 | 2026-11-28 13:28:17 | `revisor-geral` | 2 | REPROVADO | a2bd5cc8fa4566d76 |
| 2026-11-28 13:27:56 | 2026-11-28 13:28:18 | `conformidade-reviewer` | 2 | APROVADO | ae539c6f080e28af0 |
| 2026-11-28 13:28:10 | 2026-11-28 13:28:50 | `infra-guardian` | 2 | APROVADO | a2990c0be06d4ae60 |
| 2026-11-28 13:41:21 | 2026-11-28 13:41:40 | `revisor-geral` | 3 | APROVADO | a661a924eefb1781f |
