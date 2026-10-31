---
name: revisar-tarefa
description: Procedimento da Mesa de revisão — conduz uma rodada de revisão de uma tarefa ou correção e escreve a ordem de correção
argument-hint: <caminho do N_task.md ou do documento da correção>
user-invocable: false
---

Você conduz **uma rodada** de revisão de um documento de trabalho: o `N_task.md` de uma tarefa ou o
`tasks/correcoes/<slug>.md` de uma correção. Quem roda isto é a Mesa de revisão
(`.claude/agents/mesa-de-revisao.md`). O pedido chega do Implementador, com o documento e o nome do
Orquestrador.

<critical>Os revisores são chamados pela ferramenta Agent, como subagentes, um agente NOVO por
rodada. É o fim do subagente que dispara o hook `tools/processo/revisoes.ts`, e é o hook que
registra a rodada na seção "Revisões" do documento. Revisor consultado de outro jeito não registra
nada, e o commit fica bloqueado.</critical>
<critical>Espere TODOS os revisores da rodada terminarem antes de responder. Veredito que não
chegou não existe.</critical>

Documento: `$ARGUMENTS`

## 1. Antes de chamar alguém

1. Leia o documento: a linha "Subagentes obrigatórios" e a seção "Revisões".
2. **Em correção, confira a linha "Subagentes obrigatórios" contra os arquivos alterados**
   (`git status --short`): a natureza de cada arquivo está na tabela de `.claude/skills/criar-tasks/SKILL.md`
   e o caminho, em `tools/processo/guardioes-por-caminho.ts`. Mais de 5 arquivos fora de `tasks/`, ou
   `.github/`, `tools/ci/` e `tools/processo/`, pede `revisor-geral`. Faltou um: é `DEVOLUÇÃO`, dizendo
   qual acrescentar.
   **Correção no meio de uma tarefa:** o documento da correção traz a seção "Fora desta correção",
   com os arquivos da tarefa em curso. Eles não contam aqui, não entram em "Arquivos alterados" do
   prompt, e o prompt diz ao revisor que as outras mudanças da árvore são da tarefa em curso e não
   estão em revisão.
   Quem implementa não escolhe quem o audita, e o hook só cobra o que está escrito na linha.
3. Pergunte ao portão o que ainda falta, pela mesma conta do hook do commit:

   ```bash
   node tools/processo/portao-local.ts revisores <documento>
   ```

   - linha `portão local: …`: o carimbo não vale para o código atual. Não chame revisor. É
     `DEVOLUÇÃO`, com o comando que a linha manda rodar (o portão da tarefa,
     `node tools/processo/portao-local.ts --tarefa`). Três rodadas do `revisor-geral` na A1
     reprovaram só pelo carimbo;
   - linha por revisor (`nenhuma rodada`, `a última rodada terminou …`, `… mudou depois do início
     da … rodada`): **são esses, e só esses, que você chama nesta rodada**;
   - `nada pendente`: todos têm rodada que vale. Vá ao passo 4.

   A caducidade que o comando aplica segue o que o revisor audita: mudança só em arquivo de teste
   caduca só `test-engineer` e `revisor-geral`; mudança só em comentário de `.ts`/`.tsx` caduca só
   o `revisor-geral`, salvo comentário com diretiva; qualquer outra caduca todos.
4. **Fotografe a árvore**, para o diff da próxima rodada ser o que mudou desde esta, e não o que o
   Implementador disser que mudou:

   ```bash
   mkdir -p .processo/ordens
   GIT_INDEX_FILE=.processo/ordens/indice git add -A && GIT_INDEX_FILE=.processo/ordens/indice git write-tree
   ```

   Anote a árvore que o comando imprime numa linha de `.processo/ordens/rodadas.md`:
   `<documento> | rodada <n da Mesa> | <árvore> | <revisores a chamar>`. O número da rodada da Mesa
   é a quantidade de linhas de rodada desse documento que já estão lá, mais um. Esse `git add -A`
   vai para um índice à parte e não prepara commit: o índice do repositório não é tocado.

## 2. A ordem

**Todos os que o passo 1 mandou chamar, em paralelo, numa mensagem só**: o `test-engineer`, o
`revisor-geral`, os guardiões e, em tarefa com tela, o `frontend-reviewer`. O `test-engineer` não muta
mais arquivo: as mutações do documento foram provadas pelo portão (`tools/processo/mutacoes.ts`), e
por isso ele lê a mesma árvore que os outros, ao mesmo tempo. Uma rodada de revisor leva de um a
quatro minutos; o que custa é o ciclo de correção. O objetivo de cada rodada é sair com **todos** os
achados de uma vez. Esta é a única regra da ordem (D79): não existe `test-engineer` primeiro, nem
revisor que espere outro aprovar.

### Em tarefa com tela: fotografe antes de chamar os outros

Tarefa com `frontend-reviewer` entre os revisores tem tela, e tela se revisa **vendo**. Quem fotografa é
você, uma vez, **antes de chamar qualquer revisor**, e as fotos vão para todos: cada um olha a mesma
tela pela regra dele. A vitrine usa o banco de teste, e por isso vem antes de alguém rodar teste.

1. **A vitrine**, as duas escolas sintéticas de `tools/vitrine/` (a cheia e a vazia):

   ```bash
   node tools/vitrine/vitrine.ts mostrar || node tools/vitrine/vitrine.ts montar
   ```

   Se o comando disser que a web não responde, suba-a com os specs de e2e que a árvore alterou
   (`git status --short e2e/`), em segundo plano, e monte de novo quando terminar:
   `node tools/ci/e2e.ts --manter-ambiente e2e/<arquivo>.spec.ts`. É uma tentativa só.
2. **As telas da tarefa.** A lista está na linha "Telas" do "Como testar" do documento. Se o documento
   não a tem, tire-a do spec de e2e que a tarefa alterou (com que papel ele entra, que endereço abre,
   em que aba ou botão clica) e de `apps/web/src/paths.ts`.
3. **As fotos**, de cada tela, na escola cheia e na vazia:

   ```bash
   node tools/vitrine/vitrine.ts foto <coordenacao|professora|aluno> <endereço>… [--clicar 'text=<aba ou botão>']
   node tools/vitrine/vitrine.ts foto <papel> <endereço>… [--clicar …] --vazia
   ```

   O comando imprime cada arquivo de `.processo/vitrine/`, no computador (1366 px) e no celular
   (360 px), e avisa quando a página parou em outro endereço. Confira que cada foto é da tela pedida,
   e não da entrada nem de uma tela de erro: abra uma delas como imagem. O comando termina com as
   **telas cuja página rola a 1366 × 768** (a altura medida passa de 768 px), uma linha por tela, ou
   com "Nenhuma tela rola": guarde-a, ela vai no prompt (abaixo).

Em rodada nova depois de uma correção que mexeu em `apps/web`, fotografe de novo: o portão do
Implementador reconstruiu a web, e as fotos da rodada anterior são da tela antiga.

Se depois da tentativa do passo 1 ainda não houver vitrine, a rodada segue pelo código, você escreve
`Fotos da tela: indisponíveis (<o erro, em uma frase>)` no prompt de cada revisor e repete isso no
relatório da rodada. Não é parada: no fim da spec o Validador fotografa cada requisito com tela, e sem
isso a funcionalidade não é aprovada.

## 3. O prompt de cada revisor

Monte você, a partir da árvore. Não use descrição do Implementador sobre o que ele fez.

```
Tarefa: <caminho do documento>

Arquivos alterados nesta tarefa:
<saída de `git status --short`>

[Só em rodada nova deste revisor:]
Rodada anterior: <n>ª, <veredito>. Correções exigidas:
<os bloqueantes da rodada anterior dele, copiados de achados/<documento>.md>
Diff desde a rodada anterior:
<saída de `git diff <árvore da rodada anterior dele> <árvore de agora>`, as duas de rodadas.md>
```

A primeira linha é a que o hook usa para saber em qual documento registrar a rodada: escreva-a
sempre, e não cite outro documento de tarefa no prompt.

Em tarefa com tela, o prompt de **cada** revisor termina com as fotos, uma linha por tela:

```
Fotos da tela (leia cada arquivo como imagem):
<papel>, <endereço>[, depois de clicar em <o quê>], escola cheia: <arquivos>
<papel>, <endereço>[, …], escola vazia: <arquivos>
Rolam a 1366 × 768: <as linhas que o comando imprimiu no fim, ou "nenhuma">
```

A linha "Rolam" é o que o `frontend-reviewer` cruza com o PRD: tela que o PRD diz que só o miolo rola
(a X2 passou com duas que rolavam a página inteira, C1 e C2) e aparece nela é defeito. Você roda o `foto`
mais de uma vez (escola cheia e vazia, papéis diferentes), e cada chamada termina com a sua lista, que pode
ser "Nenhuma tela rola": a linha "Rolam" **junta as listas de todas as chamadas**, e não só a da última.

## 4. Depois da rodada

Rode `node tools/processo/portao-local.ts revisores <documento>` de novo e leia a seção "Revisões".

**Revisor que terminou `SEM VEREDITO`:** a rodada dele não vale. Chame um revisor novo, uma vez, com
o mesmo prompt. Se repetir, é `BLOQUEIO`.

Depois junte, de **todos** os revisores da rodada:

- **os bloqueantes** de quem reprovou (`REPROVADO`, ou `AJUSTES NECESSÁRIOS`, que conta igual, com ou
  sem veto);
- **as recomendações**, de quem aprovou e de quem reprovou. O destino de cada uma é decisão **sua**,
  não de quem implementa:
  - *aplicar*: a que é barata, isto é, cabe em poucas linhas, em arquivo que a tarefa já toca, e não
    muda comportamento nem contrato. "Anularia as aprovações" não é motivo para não aplicar: na A0b
    nove ficaram para trás assim;
  - *não aplicar, com destino*: `TODO.md`, a tarefa futura que toca o arquivo, ou recusada, com o
    motivo. Recusa por "o PRD não pede" ou "a Tech Spec não pede" cita o RF ou a seção lida; se um RF trata
    do assunto, não é recusa: aplique, ou é DIVERGÊNCIA. Na X4, a 7.0 recusou o Eu a 822 px assim, e o RF20
    pedia que coubesse.

### Há o que corrigir ou aplicar

**Uma ordem só, com tudo**: os bloqueantes primeiro, depois as recomendações a aplicar, e a seção
"Sem aplicar" (passo 5). O Implementador aplica tudo num ciclo, roda o portão da tarefa, que agora
leva minutos, e pede rodada nova; você chama só quem o comando `revisores` apontar.

As recomendações entram em ordem **uma vez por documento**: na primeira ordem que você escrever. Nas
rodadas seguintes só entra recomendação de revisor que **reprovou** naquela rodada; as outras vão
direto para "Sem aplicar", com destino. Na 5.0 do F3 um ciclo inteiro foi gasto só para aplicar
recomendação depois de tudo aprovado.

Antes de enviar, conte as reprovações **seguidas** do mesmo revisor neste documento, pelas últimas
rodadas dele na seção "Revisões". Se `.processo/ordens/rodadas.md` tem uma linha
`<documento> | destravado | <revisor> | depois da <n>ª rodada dele`, conte só as rodadas depois dessa:

| Seguidas | O que você faz |
|---|---|
| nenhuma (só recomendações) ou 1 | envia `ORDEM DE CORREÇÃO` ao Implementador |
| 2 | escreve a ordem e envia `ESCALADA` ao **Orquestrador**, que pede o diagnóstico ao Arquiteto e repassa a ordem com ele |
| 3 | não escreve ordem nova; envia `BLOQUEIO` ao Orquestrador. É parada do Joaquim |

Depois de o Joaquim destravar um bloqueio, a contagem recomeça: é o Orquestrador quem escreve a
linha `destravado` acima.

### Nada a corrigir nem a aplicar

O comando `revisores` responde `nada pendente`, e não sobrou recomendação a aplicar. A aprovação é
final:

```
RELATÓRIO de Mesa
Tarefa: <documento>
Revisão: APROVADO por todos (<revisor rodada>, ...)
Telas vistas: sim (<quantas fotos>, cheia e vazia) | não (<o erro>) | a tarefa não tem tela
Sem aplicar: <arquivo da ordem com a seção "Sem aplicar", ou "nada">
Confira o carimbo e faça o commit.
```

## 5. A ordem de correção

Grave em `.processo/ordens/<nome do documento sem extensão>-r<número da rodada da Mesa>.md`. A
pasta `.processo/` não entra no git: a ordem é de trabalho, e o que os revisores exigiram já fica
em `achados/`, escrito pelo hook.

Cada item leva o Implementador ao ponto exato e diz o que o revisor exigiu, com as palavras dele. O
código e o teste da correção quem escreve é o Implementador: três das cinco escaladas do F3 nasceram
de ordem que ditou regra, texto de tela ou código de teste sem conferir (11.0, 18.0, 19.0).

```
# Ordem de correção — <documento>, rodada <n>
Tipo: bloqueantes | recomendações | bloqueantes e recomendações

## 1. <o defeito, em uma frase>
Revisor: <quem exigiu> (<rodada>ª)
Arquivo: <caminho>
Onde: <função ou bloco> › <o trecho exato que está lá hoje, copiado>
Exigido: <o bloqueante do revisor, copiado de achados/<documento>.md, sem resumir nem completar>
Por quê: <a regra que o trecho viola, com o número dela>

## 2. ...

## Sem aplicar
| Revisor e rodada | Recomendação | Destino ou motivo |
(o Implementador copia esta tabela para "Recomendações sem aplicar" do documento)

## Depois de aplicar
- Cada cláusula nova ganha o seu bloco em "Mutações"
- Rode o teste de cada item isolado, até ficar verde, e depois o portão da tarefa, uma vez:
  `node tools/processo/portao-local.ts --tarefa <documento>`
- Peça rodada nova à Mesa
```

Regras da ordem:

- **Abra o arquivo antes de escrever o item.** O revisor cita `arquivo:linha`, e a linha muda a cada
  edição: você copia o trecho como está agora. Revisor que apontou o lugar errado, ou pediu algo
  que não existe no código, não vira item: é `DIVERGÊNCIA` ao Orquestrador, com `Motivo: ordem`
- Um item por defeito. Dois revisores com o mesmo achado viram um item, com os dois nomes
- Achados que se contradizem não vão para o Implementador: `DIVERGÊNCIA`, com os dois textos
- **Não acrescente exigência, regra, texto de tela nem código seu.** `Exigido` é cópia. Se achar que
  faltou algo, o lugar é o prompt do revisor na próxima rodada
- Correção exigida pelo `test-engineer`: sempre que der, a ordem mexe **só em arquivo de teste**,
  para não caducar os outros
- Nenhum item baixa critério de aceite, desliga teste ou edita documento para acomodar o resultado.
  Se o único jeito de atender o revisor for esse, é `BLOQUEIO`

## 6. As mensagens

Ao Implementador (`protocolo.md`, item 2):

```
ORDEM DE CORREÇÃO de Mesa                 |  DEVOLUÇÃO de Mesa
Tarefa: <documento>                       |  Tarefa: <documento>
Reprovou: <revisor (rodada)>, ...         |  A rodada não começou: <carimbo inválido | falta o guardião X>
Ordem: .processo/ordens/<arquivo>.md      |  Faça: <o comando, ou a linha a corrigir>
Atenda item por item, rode o portão e     |  Depois peça a rodada de novo.
peça rodada nova.                         |
```

Ao Orquestrador, com `/seguir ` na frente. O nome dele veio no pedido do Implementador:

```
/seguir ESCALADA de Mesa             |  /seguir BLOQUEIO de Mesa           |  /seguir DIVERGÊNCIA de Mesa
Tarefa: <documento>                  |  Tarefa: <documento>                |  Tarefa: <documento>
<revisor> reprovou 2 vezes seguidas. |  <revisor> reprovou 3 vezes.        |  Motivo: ordem
Ordem: .processo/ordens/<arquivo>.md |  Achados: achados/<documento>.md    |  <o achado que não se aplica, ou os dois que se contradizem>
```

Depois de enviar, encerre o turno.
