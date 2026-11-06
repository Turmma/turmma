# Correção — o teste da vaga dos publicados parados na fila depende do relógio da máquina

**Origem:** portão local de e2e e infra da spec (`portao-e2e-infra.log`, suíte `integracao`, 06/11/2026 07:07): vermelho com a suíte inteira, verde isolado.
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador; `tenancy-guardian` e `privacy-guardian` entram por caminho (`apps/despachante/`, em `tools/processo/guardioes-por-caminho.ts`), como a Mesa apontou. A correção altera 1 arquivo de teste e este documento, abaixo do limite de 5, e não toca `.github/`, `tools/ci/`
     nem `tools/processo/`. -->

## Sintoma

```
FAIL |integracao| apps/despachante/test/slots.int.test.ts > vagas por escola e filas por prioridade >
  job publicado e parado na fila (pool cheio, réplica fora) segura a vaga além da validade: a escola não ganha publicados acima do teto
AssertionError: 1500 ms: expected { waiting: 4 } to deeply equal { waiting: 2 }
 ❯ apps/despachante/test/slots.int.test.ts:362:91
```

Aconteceu uma vez em 578 arquivos, com a máquina carregada pela suíte inteira (1.014 s). O arquivo, rodado sozinho, passa.

## Fora desta correção

Nada: não há tarefa em curso.

## Causa

O teste põe a validade da vaga em 1 s (`validadeDaVagaMs`) e deixa o despachante rodar solto, com a sondagem padrão de 500 ms, por 3,5 s de
parede. A regra provada é que a rodada renova (`vagas.manter`) a vaga de quem está publicado e parado, e por isso a escola não ganha publicados
acima do teto. Mas a renovação só ganha da validade se **cada rodada chegar ao Redis em menos de 1 s depois da anterior**: a rodada faz
`listarEscolasComPendentes`, `membros`, `publicadosEntre`, `manter` e `livres`, três delas no Postgres. Com o Postgres e o Redis disputados por
dezenas de arquivos de integração, uma rodada passou de 1 s; a vaga venceu antes do `manter`, que usa `ZADD XX` e **não readmite vaga vencida**
(de propósito, `concurrency-slot.lua`); o `livres` contou 0 em uso e a escola reservou mais dois lotes: `waiting: 4`.

Ou seja, a regra do produto está certa (uma vaga vencida não volta, o que o teste da vaga do worker morto prova), e o defeito é do teste, que
mede "a rodada é mais rápida que 1 s" em vez de "a rodada renova a vaga". O segundo meio do teste, com o worker, repete a validade de 1 s e a
renovação de 200 ms, e tem a mesma fragilidade (um atraso de 1 s na renovação deixa a A com três em execução).

## Teste que reproduz

O vermelho do teste antigo depende de a máquina estar lenta: rodado sozinho ele passa. Para ver a causa sem esperar a esteira, o teste antigo foi
rodado sob carga de CPU (48 laços ocupando os 12 núcleos): em 3 execuções, 2 passaram e 1 caiu com a mesma mensagem da esteira, `1000 ms: expected
{ waiting: 4 } to deeply equal { waiting: 2 }`. Isso é diagnóstico da causa, não prova de estabilidade. O teste novo não tem relógio de parede: ele leva a vaga a cinco
segundos do vencimento, por escrita direta no ZSET (o que "quase uma validade sem rodada" deixa no Redis), roda **uma rodada** à mão e exige que a
vaga volte a valer uma validade inteira. A mutação que tira o `manter` da rodada deixa o teste vermelho de forma determinística.

Arquivo: `apps/despachante/test/slots.int.test.ts › job publicado e parado na fila (pool cheio, réplica fora) segura a vaga além da validade: a escola não ganha publicados acima do teto`.

## Correção

Só o arquivo de teste; o código de produção não muda (a regra da vaga está certa).

- O despachante deixa de rodar solto com validade de 1 s: a primeira parte do caso chama `rodada()` à mão. A primeira rodada publica as duas
  vagas da A (teto de lote 2). Depois, três vezes ("três validades"), o caso escreve no ZSET a vaga dos dois publicados a 5 s de vencer (o que
  deixaria "quase uma validade sem rodada"), roda **uma** rodada e exige: nada novo publicado, o vencimento de cada vaga de volta a uma validade
  inteira (`>= VALIDADE_DA_VAGA_MS`, medido contra o `TIME` do Redis, o mesmo relógio do Lua), `waiting: 2` na fila e 2 `publicado` no banco.
  A margem de 5 s não vem de parede: o intervalo entre a escrita e o `manter` é de milissegundos, e o teste exige renovação, não pressa.
- A segunda parte (a réplica volta, a A segue com duas e a B entra) deixa de usar validade de 1 s e renovação de 200 ms, que tinham o mesmo risco:
  usa as padrão (60 s e 15 s), e o laço do despachante é iniciado só aí. O prazo de espera da B subiu de 3 s para 10 s; a regra que ele cobre
  (a B começa com a pilha da A na fila) é a do `maximo('A') === 2` e do estado `concluido`, que não mudaram.
- O comentário de `aguardarVagaVazia` deixava de citar "um teste com 1 s", que não existe mais.

Estabilidade: vem do desenho, e não de uma contagem de execuções. O caso novo não tem espera de parede nem validade curta: a validade que passa é escrita no ZSET, a rodada é chamada à mão, e a asserção que guarda a regra compara o vencimento com o `TIME` do Redis. Rodado sozinho 10 vezes seguidas, passou 10 de 10.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

O nome do caso no bloco é só o pedaço `segura a vaga além da validade`: o Vitest lê o `-t` como expressão regular, e os parênteses do nome inteiro não casariam. A correção não acrescenta cláusula de produção. O bloco prova que o caso novo ainda guarda a regra: sem o `manter` na rodada, a vaga fica a 5 s de
vencer (`expected 5000 to be greater than or equal to 60000`, na primeira validade).

```mutacao
arquivo: apps/despachante/src/outbox-relay.ts
teste: apps/despachante/test/slots.int.test.ts › segura a vaga além da validade
       try {
-        await vagas.manter(fila, escolaId, publicados)
         livres = await vagas.livres(fila, escolaId, limite)
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 07:27:20 | 2026-11-06 07:27:36 | `tenancy-guardian` | 1 | APROVADO | a2b8bc28dce3de3a8 |
| 2026-11-06 07:27:21 | 2026-11-06 07:27:41 | `privacy-guardian` | 1 | APROVADO | a86e059ec7753dc0f |
| 2026-11-06 07:27:19 | 2026-11-06 07:27:43 | `revisor-geral` | 1 | APROVADO | a1ae5542fd037cc93 |
| 2026-11-06 07:27:18 | 2026-11-06 07:27:56 | `infra-guardian` | 1 | APROVADO | a8708bf185b99f6f4 |
| 2026-11-06 07:27:18 | 2026-11-06 07:28:29 | `test-engineer` | 1 | APROVADO | aac4282e35e8782e6 |

## Recomendações sem aplicar

- `revisor-geral`, 1ª rodada: a trava `expect(timeout).toBeLessThan(VALIDADE_DA_VAGA_MS / 2)` de `aguardarVagaVazia` só protege contra a validade padrão, porque o caso de 1 s saiu; dá para simplificar. **Recusada:** o próprio revisor diz que a trava continua certa; simplificar é opcional e mexe em asserção de outro caso, fora do diff desta correção.
- `revisor-geral`, 1ª rodada: a linha `--faltando: 0 linhas (1 blocos, 0 motivos)` fica estranha no meio do texto. **Recusada:** é a linha que `corrigir/SKILL.md` manda estar no começo de "Mutações"; as outras correções do dia a trazem igual.
- `test-engineer`, 1ª rodada: fora do diff, o teste de renovação do worker (`slots.int.test.ts`, perto das linhas 340-341) espera 500 ms de parede contra renovação a cada 200 ms, a mesma fragilidade sob carga que esta correção tirou do outro caso. **Para o `TODO.md`:** relógio do Redis ou renovação acionada à mão, se aparecer vermelho na esteira.
- `infra-guardian`, 1ª rodada: conferir a mutação declarada (tirar `vagas.manter` da rodada) pela ferramenta de mutação. **Não é item de código:** o portão da correção já a prova (`tools/processo/mutacoes.ts`).
| 2026-11-06 07:34:58 | 2026-11-06 07:35:17 | `revisor-geral` | 2 | APROVADO | a296217a0524c23db |
- `revisor-geral`, 2ª rodada: `slots.int.test.ts:383`, "no caso das 1.000 lotes da A" deveria ser "no caso dos 1.000 lotes da A". **Não aplicada:** recomendação de quem aprova só entra na primeira ordem do documento, e mexer no comentário caducaria o `revisor-geral` por uma palavra; corrige-se na próxima correção que tocar o arquivo.
