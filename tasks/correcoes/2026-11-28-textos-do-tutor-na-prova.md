# Correção — os textos "o Tutor fica pausado até você encerrar" contradizem a prova com janela da F6

**Origem:** `validacao.md` de `avaliacao-e-correcao` (§4, achado maior): `tasks/prd-avaliacao-e-correcao/validacao.md`.
**Subagentes obrigatórios:** `conformidade-reviewer`, `frontend-reviewer`, `revisor-geral`, `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador (`conformidade-reviewer`, `frontend-reviewer`, `revisor-geral`); o `test-engineer` é de toda correção; `tenancy-guardian`, `privacy-guardian` e `infra-guardian` vieram do `portao-local.ts revisores`, que lista quem o caminho pede (e2e e telas). -->

## Sintoma

Na prova com janela, a tela diz que o Tutor "fica pausado até você encerrar" / "até quem dá a aula encerrar", e a lista da professora diz "Quando a turma terminar, encerre a atividade". A F6 mudou as duas coisas (Tech Spec §5.10, decisão do Joaquim de 23/11): o Tutor trava só da abertura (`abre_em`) até a janela fechar, ou até o limite do aluno se ele for depois (§5.10, item 10: "até o fim da janela, com extensões da turma, ou o limite dele, o que vier depois"), e a prova encerra sozinha quando a janela fecha ou acaba o tempo de quem recebeu mais (item 6). A professora lê "pausado" numa prova de amanhã, quando o Tutor ainda está livre (`tutor-trava-da-prova.int.test.ts › prova de amanhã não trava`). Os textos estão em:

- `apps/web/src/areas/professor/atividades/aprovar.ts:141` (a descrição da escolha "É avaliativa", no diálogo de aplicar) e `:145` (o aviso do painel da atividade e de "Na turma");
- `apps/web/src/areas/aluno/atividades.ts:21` (o aviso da lista, do Início e da escolha do Tutor do aluno);
- `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx:54` (`oQueFazer`: "Quando a turma terminar, encerre a atividade…");
- (rodada 1, `frontend-reviewer`) a tela do Tutor pausado, `apps/web/src/areas/aluno/tutor.ts` ("Ele volta quando quem dá a aula encerrar."), e a mensagem de erro tipado `TUTOR_PAUSADO_EM_AVALIACAO`, em `packages/shared/src/errors/messages.ts` ("Ele volta quando o professor encerrar a avaliação."): a mesma contradição, na jornada que o aluno faz um toque depois do aviso.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A F6 (6.0 e 7.0) mudou o comportamento do servidor, e os textos fixos de antes dela, escritos para a avaliativa sem janela (a única que existia), ficaram. Eram uma constante por tela, sem olhar a `janela` que o contrato já traz (`AtividadeAplicada.janela`, `MinhaAtividade.janela`). É falha da 12.x/11.0 da F6 (as telas), vista na validação.

A avaliativa **sem janela** (a de antes da F6) continua existindo no banco e na tela, com o comportamento antigo (o Tutor trava até a professora encerrar, e ninguém encerra por ela): o texto de hoje fica para ela.

## Teste que reproduz

- `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › o Tutor da prova com janela fica pausado da abertura até a prova fechar…`, `… › a prova com janela encerra sozinha no fim…` e `… › a prova aparece no painel em uma frase…` (a asserção nova do aviso e do "encerra sozinha quando a janela fecha").
- `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prova com janela diz que o Tutor pausa só durante ela…` (a lista de "Aplicar").
- `apps/web/src/areas/aluno/atividades.test.ts › o aviso da avaliação com janela diz que o Tutor pausa só durante a prova…`
- `apps/web/src/areas/aluno/Atividades.test.tsx › a prova com janela diz que o Tutor pausa só durante a prova…`
- `apps/web/src/areas/aluno/Inicio.test.tsx › a prova com janela traz o aviso da prova…`
- `apps/web/src/areas/aluno/EscolhaDaAtividade.test.tsx › a avaliação que espera resposta leva o aviso certo…`
- `apps/web/src/areas/aluno/tutor.test.ts › em avaliação diz o título dela e quando o Tutor volta…` (o texto da pausa e a mensagem `TUTOR_PAUSADO_EM_AVALIACAO` não mandam esperar a professora).
- `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx › a prova com janela nunca mostra o aviso de avaliação sem janela…` (o banner antigo de `Atividade.tsx` não aparece numa prova com janela, que entra por "Antes de começar" ou pela tela de foco).

Vermelhos antes (as funções e as constantes novas não existiam; o `oQueFazer` da prova dizia "Quando a turma terminar") e verdes depois.

## Correção

Só a tela e uma mensagem de erro; nenhum contrato, nenhuma API. Os textos seguem o §5.10, item 10: o Tutor trava da abertura até a janela fechar, ou até o limite do aluno, o que vier depois (rodada 1: a primeira versão dizia "até o fim do tempo de cada aluno", que é menos do que o servidor faz).

- `aprovar.ts`: a descrição da escolha "É avaliativa" passa a dizer "durante a prova, da abertura até a prova fechar (ou até o fim do tempo de quem recebeu mais)" (quem aplica uma avaliativa hoje sempre dá janela, RF1). `AVISO_DA_PROVA_ABERTA` é o aviso da prova aberta, e `avisoDaAvaliativaAberta(aplicada)` escolhe entre ele e o `AVISO_DA_AVALIATIVA_ABERTA`, que fica, para a avaliativa sem janela. `hasJanela(aplicada)` é o predicado único de "tem janela", usado também pelo `oQueFazer`.
- `AtividadesDaTurma.tsx`: `oQueFazer` da prova aberta diz que ela encerra sozinha quando a janela fecha (ou quando acaba o tempo de quem recebeu mais) e que a professora pode encerrar antes; o ramo sem janela leva um comentário dizendo que é o de antes da F6. O painel e a lista de "Aplicar" (`AplicacaoDoArtefato.tsx`) usam `avisoDaAvaliativaAberta`.
- `atividades.ts` (aluno): `AVISO_DA_PROVA` ("Avaliação: o Tutor fica pausado durante a prova, da abertura até ela fechar.", sem "o fim do seu tempo": quem tem tempo adicional lê o mesmo texto, e a tela não revela a adaptação, D35) e `avisoDaAvaliacao(atividade)`; a lista, o Início e a escolha do Tutor usam a função.
- `tutor.ts` e `messages.ts` (rodada 1, item 2 e 3 da ordem): "Ele volta quando a avaliação terminar." na tela do Tutor pausado e em `TUTOR_PAUSADO_EM_AVALIACAO` ("O Tutor fica pausado durante a avaliação. Ele volta quando a avaliação terminar."), verdadeiro para a prova com janela e para a avaliativa sem ela. `e2e/aluno-tutor.spec.ts` acompanha. O banner de `Atividade.tsx` fica com `AVISO_DA_AVALIACAO`: é o da avaliativa sem a prova em foco, isto é, sem janela.
- e2e que citam os textos: `professor-aplicacao.spec.ts`, `aluno-fluxo.spec.ts` e `roteiro-da-demonstracao.spec.ts` (a avaliativa deles tem janela). `aluno-inicio`, `aluno-atividade` e `professor-turma-atividades` usam avaliativa sem janela e seguem com o texto de antes.

## Mutações

--faltando: 0 linhas (21 blocos, 0 motivos)

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › o aviso da avaliação com janela diz que o Tutor pausa só durante a prova
-return atividade.janela === null ? AVISO_DA_AVALIACAO : AVISO_DA_PROVA
+return AVISO_DA_AVALIACAO
```

```mutacao
arquivo: apps/web/src/areas/aluno/atividades.ts
teste: apps/web/src/areas/aluno/atividades.test.ts › o aviso da avaliação com janela diz que o Tutor pausa só durante a prova
-return atividade.janela === null ? AVISO_DA_AVALIACAO : AVISO_DA_PROVA
+return AVISO_DA_PROVA
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › com dado: três grupos, cada tarefa no seu
falha: linha('Para fazer', '02').textContent).not.toContain(AVISO_DA_AVALIACAO)
-{atividade.avaliativa && estaParaResponder(atividade) && <span className="block font-medium text-tinta">{avisoDaAvaliacao(atividade)}</span>}
+{estaParaResponder(atividade) && <span className="block font-medium text-tinta">{avisoDaAvaliacao(atividade)}</span>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › com dado: três grupos, cada tarefa no seu
falha: linha('Entregues', '03').textContent).not.toContain(AVISO_DA_AVALIACAO)
-{atividade.avaliativa && estaParaResponder(atividade) && <span className="block font-medium text-tinta">{avisoDaAvaliacao(atividade)}</span>}
+{atividade.avaliativa && <span className="block font-medium text-tinta">{avisoDaAvaliacao(atividade)}</span>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Atividades.tsx
teste: apps/web/src/areas/aluno/Atividades.test.tsx › com dado: três grupos, cada tarefa no seu
-{atividade.avaliativa && estaParaResponder(atividade) && <span className="block font-medium text-tinta">{avisoDaAvaliacao(atividade)}</span>}
+{atividade.avaliativa && estaParaResponder(atividade) && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Inicio.tsx
teste: apps/web/src/areas/aluno/Inicio.test.tsx › avaliativa aberta: a linha traz o aviso de hoje
falha: comum.textContent).not.toContain(AVISO_DA_AVALIACAO)
-{atividade.avaliativa && <p className="min-w-0 text-sm break-words text-apoio">{avisoDaAvaliacao(atividade)}</p>}
+{<p className="min-w-0 text-sm break-words text-apoio">{avisoDaAvaliacao(atividade)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/Inicio.tsx
teste: apps/web/src/areas/aluno/Inicio.test.tsx › avaliativa aberta: a linha traz o aviso de hoje
-{atividade.avaliativa && <p className="min-w-0 text-sm break-words text-apoio">{avisoDaAvaliacao(atividade)}</p>}
+{atividade.avaliativa && null}
```

```mutacao
arquivo: apps/web/src/areas/aluno/EscolhaDaAtividade.tsx
teste: apps/web/src/areas/aluno/EscolhaDaAtividade.test.tsx › a avaliação que espera resposta leva o aviso certo
falha: linha.textContent).not.toContain(AVISO_DA_AVALIACAO)
-{avisar && <span className="min-w-0 text-sm break-words text-apoio">{avisoDaAvaliacao(atividade)}</span>}
+{<span className="min-w-0 text-sm break-words text-apoio">{avisoDaAvaliacao(atividade)}</span>}
```

```mutacao
arquivo: apps/web/src/areas/aluno/EscolhaDaAtividade.tsx
teste: apps/web/src/areas/aluno/EscolhaDaAtividade.test.tsx › a avaliação que espera resposta leva o aviso certo
-{avisar && <span className="min-w-0 text-sm break-words text-apoio">{avisoDaAvaliacao(atividade)}</span>}
+{avisar && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prova com janela diz que o Tutor pausa só durante ela
falha: within(linha).queryByText(AVISO_DA_AVALIATIVA_ABERTA)).toBeNull()
-{aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="text-sm break-words text-sutil">{avisoDaAvaliativaAberta(aplicada)}</p>}
+{aplicada.estado === 'aberta' && <p className="text-sm break-words text-sutil">{avisoDaAvaliativaAberta(aplicada)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prova com janela diz que o Tutor pausa só durante ela
falha: within(linha).queryByText(AVISO_DA_PROVA_ABERTA)).toBeNull()
-{aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="text-sm break-words text-sutil">{avisoDaAvaliativaAberta(aplicada)}</p>}
+{aplicada.avaliativa && <p className="text-sm break-words text-sutil">{avisoDaAvaliativaAberta(aplicada)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prova com janela diz que o Tutor pausa só durante ela
-{aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="text-sm break-words text-sutil">{avisoDaAvaliativaAberta(aplicada)}</p>}
+{aplicada.avaliativa && aplicada.estado === 'aberta' && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a aberta tem "Encerrar a atividade" e nada de correção
falha: within(aberto).queryByText(AVISO_DA_AVALIATIVA_ABERTA)).toBeNull()
-{aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info">{avisoDaAvaliativaAberta(aplicada)}</p>}
+{aplicada.estado === 'aberta' && <p className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info">{avisoDaAvaliativaAberta(aplicada)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a encerrada não se encerra de novo
falha: within(aberto).queryByText(AVISO_DA_AVALIATIVA_ABERTA)).toBeNull()
-{aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info">{avisoDaAvaliativaAberta(aplicada)}</p>}
+{aplicada.avaliativa && <p className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info">{avisoDaAvaliativaAberta(aplicada)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a aberta tem "Encerrar a atividade" e nada de correção
-{aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info">{avisoDaAvaliativaAberta(aplicada)}</p>}
+{aplicada.avaliativa && aplicada.estado === 'aberta' && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a prova com janela encerra sozinha no fim
-if (estado === 'aberta' && hasJanela(aplicada)) return 'Os alunos estão respondendo. A prova encerra sozinha quando a janela fecha (ou quando acaba o tempo de quem recebeu mais), e o Assistente corrige. Se a turma terminar antes, você pode encerrar agora: as respostas param.'
+if (hasJanela(aplicada)) return 'Os alunos estão respondendo. A prova encerra sozinha quando a janela fecha (ou quando acaba o tempo de quem recebeu mais), e o Assistente corrige. Se a turma terminar antes, você pode encerrar agora: as respostas param.'
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › cada situação diz o que fazer com as palavras dela
-if (estado === 'aberta' && hasJanela(aplicada)) return 'Os alunos estão respondendo. A prova encerra sozinha quando a janela fecha (ou quando acaba o tempo de quem recebeu mais), e o Assistente corrige. Se a turma terminar antes, você pode encerrar agora: as respostas param.'
+if (estado === 'aberta') return 'Os alunos estão respondendo. A prova encerra sozinha quando a janela fecha (ou quando acaba o tempo de quem recebeu mais), e o Assistente corrige. Se a turma terminar antes, você pode encerrar agora: as respostas param.'
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/aprovar.ts
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › o Tutor da prova com janela fica pausado da abertura
falha: hasJanela({ ...AVALIATIVA, janela: null })).toBe(false)
-return aplicada.janela !== null && aplicada.janela !== undefined
+return aplicada.janela !== undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/aprovar.ts
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › o Tutor da prova com janela fica pausado da abertura
falha: hasJanela(AVALIATIVA)).toBe(false)
-return aplicada.janela !== null && aplicada.janela !== undefined
+return aplicada.janela !== null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/aprovar.ts
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › o Tutor da prova com janela fica pausado da abertura
-return hasJanela(aplicada) ? AVISO_DA_PROVA_ABERTA : AVISO_DA_AVALIATIVA_ABERTA
+return AVISO_DA_AVALIATIVA_ABERTA
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/aprovar.ts
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › o Tutor da prova com janela fica pausado da abertura
-return hasJanela(aplicada) ? AVISO_DA_PROVA_ABERTA : AVISO_DA_AVALIATIVA_ABERTA
+return AVISO_DA_PROVA_ABERTA
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `conformidade-reviewer` 1ª | Apagar as fotos antigas de `.processo/vitrine/` a cada rodada | É da Mesa, não do Implementador: a Mesa limpa as fotos antes de fotografar a próxima rodada |
| `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`, `revisor-geral`, `test-engineer` 1ª | A vitrine sintética (`tools/vitrine/`) ganhar uma avaliativa aberta com janela, para o aviso novo aparecer em foto | `TODO.md` (a vitrine é ferramenta do processo, fora dos arquivos desta correção; o Validador fotografa no fim da spec) |
| `frontend-reviewer`, `privacy-guardian` 1ª | Foto do Início do aluno saiu com "Página não encontrada" | Erro da Mesa: o endereço certo é `/aluno/inicio`; será fotografado de novo na rodada 2 |
| `revisor-geral` 1ª | `avisoDaAvaliacao` (aluno) testar `janela === null` e não o mesmo predicado do lado do professor | Não aplicada: `MinhaAtividade.janela` é `nullable` sem `optional` (o contrato do aluno sempre a traz), e `hasJanela` é do lado do professor, onde `janela` é opcional; o `=== null` é o teste certo do tipo dela |
| `conformidade-reviewer` 2ª, `revisor-geral` 2ª | A seção "Correção" do documento abre com duas frases quase iguais ("Só a tela; nenhum contrato, nenhuma API." e "Só a tela e uma mensagem de erro; …"): apagar a primeira | O Implementador apaga ao copiar esta tabela para o documento: é edição do próprio documento, sem código. |
| `frontend-reviewer` 2ª | `vitest` de `tutor.test.ts` falha se o `dist` do `@educa/shared` estiver desatualizado; reconstruir o pacote antes do teste | Aviso, sem item: o `dist` é ignorado pelo git, e o fonte está certo. O portão da tarefa já roda com o pacote reconstruído (carimbo válido). |
| `frontend-reviewer` 2ª | O título do teste `atividades.test.ts:42` ainda diz "até o fim do tempo dele" (as asserções já são as novas) | `TODO.md`: ajustar o título na próxima tarefa que tocar `apps/web/src/areas/aluno/atividades.test.ts`. É só título; aplicar agora caducaria duas aprovações por uma palavra. |
| `revisor-geral` 2ª | `hasJanela` importado fora da ordem alfabética em `AtividadesDaTurma.tsx` | Recusada: estética, e o lint passou. |
| `test-engineer` 2ª | O texto da professora diz "o Tutor fica pausado **para a turma** … (ou até o fim do tempo de quem recebeu mais)", mas a trava é por aluno (`tutor.repository.ts:294-305`); o erro é para o lado seguro | `TODO.md`, com a redação que o revisor sugeriu ("…até a prova fechar (para quem tem mais tempo, até o fim do tempo dele)"), a aplicar na próxima tarefa que tocar `aprovar.ts`. Não é o defeito desta correção (a professora espera mais pausa, não menos). |
| `test-engineer` 2ª | `docs/roteiro-da-demonstracao.md:226-227` ainda manda dizer "Avaliação: o Tutor fica pausado até quem dá a aula encerrar", numa avaliativa com janela; o e2e do roteiro já prova o texto novo | `TODO.md`, com prioridade alta: o roteiro é lido ao vivo na demonstração e contradiz a tela. Conferi: o trecho está lá. Fica para o Orquestrador decidir se entra nesta correção (um commit só de documento) ou na `corrigir` seguinte. |
| `conformidade-reviewer`, `frontend-reviewer`, `revisor-geral`, `test-engineer`, `infra-guardian` 2ª | A vitrine sintética ganhar uma avaliativa aberta com janela | Já em `TODO.md` ("Telas do aluno, 3.0: a vitrine cheia semeia atividade aplicada"); o Validador fotografa no fim da spec. |
| `privacy-guardian` 2ª | O "ou até o fim do tempo de quem recebeu mais" não pode ir ao aluno nem à família | Sem ação: só aparece para a professora. Fica para a retro. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 10:57:04 | 2026-11-28 10:57:44 | `conformidade-reviewer` | 1 | APROVADO | a2be373de1ed65ddd |
| 2026-11-28 10:57:26 | 2026-11-28 10:57:45 | `tenancy-guardian` | 1 | APROVADO | a79f639ba3267a2e8 |
| 2026-11-28 10:57:37 | 2026-11-28 10:57:58 | `infra-guardian` | 1 | APROVADO | a31439513c62f0438 |
| 2026-11-28 10:57:10 | 2026-11-28 10:58:00 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | aac2224081592a28c |
| 2026-11-28 10:57:32 | 2026-11-28 10:58:05 | `privacy-guardian` | 1 | APROVADO | a7ec10f42693fa4eb |
| 2026-11-28 10:57:15 | 2026-11-28 10:58:37 | `revisor-geral` | 1 | REPROVADO | ae1183ce9ca307884 |
| 2026-11-28 10:57:21 | 2026-11-28 10:59:40 | `test-engineer` | 1 | REPROVADO | a15d0ff3dd28c62cf |
| 2026-11-28 11:49:05 | 2026-11-28 11:49:47 | `conformidade-reviewer` | 2 | APROVADO | a05cab19ef5fcfef3 |
| 2026-11-28 11:49:17 | 2026-11-28 11:50:01 | `frontend-reviewer` | 2 | APROVADO | a513c7e1c861b6ff1 |
| 2026-11-28 11:49:52 | 2026-11-28 11:50:08 | `tenancy-guardian` | 2 | APROVADO | a47fb870fc3813ab3 |
| 2026-11-28 11:49:30 | 2026-11-28 11:50:31 | `revisor-geral` | 2 | APROVADO | a10b394268f08a9dc |
| 2026-11-28 11:50:11 | 2026-11-28 11:50:34 | `infra-guardian` | 2 | APROVADO | a7f3bad1001a6ba44 |
| 2026-11-28 11:50:01 | 2026-11-28 11:50:38 | `privacy-guardian` | 2 | APROVADO | a6a6926425f4c3ce9 |
| 2026-11-28 11:49:42 | 2026-11-28 11:51:14 | `test-engineer` | 2 | APROVADO | a60d2480634f3ae40 |
