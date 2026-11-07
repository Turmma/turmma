# Correção — o e2e "falha com o diálogo aberto: o CONFLITO do gerar…" cai quando o caso passa de 30 s

**Origem:** esteira run 42277176677 (`b388f260`), `e2e/acesso-da-turma.spec.ts:972`, falha na linha 1070
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `frontend-reviewer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. -->

## Sintoma

Na esteira, o caso cai na última seção (a coordenação encerra o vínculo com a tela aberta). A linha 1070,
`await expect(noDialogo(page).getByRole('button')).toHaveText(['Fechar'])`, espera 5 s e recebe `Array []`:
`getByRole('dialog').getByRole('button')` resolveu a **0 elementos** nas 14 tentativas. As linhas 1068 e 1069 (o aviso da
turma que não existe, dentro do diálogo, com o foco) tinham acabado de passar. O caso levou 37,6 s no runner. A execução anterior passou.

## Fora desta correção

nada

## Causa

A falha é do **teste**, e é de tempo. A tela está certa. A 2.0 da semana-do-professor só mexeu na API: o caso e a tela já estavam
assim antes dela (o caso veio com a 13.0 da A1), e a esteira só o pegou agora porque a releitura precisa cair na janela do fim do caso.

`ListaDePedidos` (aba Alunos) relê os pedidos de 15 em 15 s, e na volta da aba, na hora
(`atualizacao-dos-pedidos.ts`, `agendarRelitura`). No último trecho do caso a coordenação encerra o vínculo com a tela aberta. Se
uma releitura da lista (ou da turma, ou dos alunos) chega depois disso, a API responde `NAO_ENCONTRADO`, `Turma.tsx` troca a
**página inteira** pelo aviso "Esta turma não está disponível" e o diálogo sai junto, como a tela quer (é o desfecho que o caso
"a releitura que cai com o código projetado…" prova). O caso esperava o outro desfecho (o diálogo fica, só com "Fechar"),
e qual dos dois aparece dependia de a releitura cair antes ou depois da linha 1070.

Prova, no trace da esteira (artefato `traco-do-e2e-1`): a lista de pedidos foi lida às 19:18:30.059 e relida às 19:18:45.066 (15,0 s
depois, `GET …/reivindicacoes` 404), 450 ms depois do `GET …/acesso` 404 do gerar; o `error-context.md` da falha mostra a página
já trocada ("Turma" + "Esta turma não está disponível") e sem diálogo. O caso levou 37,6 s no runner, local uns 27 s: na esteira a
releitura cai na janela com mais frequência.

## Teste que reproduz

`e2e/acesso-da-turma.spec.ts` › "falha com o diálogo aberto: o CONFLITO do gerar recarrega a seção…" (o último trecho).

Vermelho antes: forçada a releitura no pior momento (`document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))` logo
depois do aviso no diálogo) e com 1,5 s de espera antes da linha 1070, o caso cai com **a mesma mensagem da esteira**
(`getByRole('dialog').getByRole('button')` … `14 × locator resolved to 0 elements`, `Array []`), na rodada em que fiz isso. Sem a espera o
clique em "Fechar" ganha da resposta e o caso passa (3 de 3), por isso a corrida não é reproduzida pelo disparo sozinho.

Verde depois: o caso corrigido leva o mesmo disparo, com as leituras seguradas, e passa. **Dez execuções seguidas, dez verdes**
(`--repeat-each=10 --workers=1`, 27 s cada, abaixo dos 45 s do caso `test.slow()`).

## Correção

Só o teste (`e2e/acesso-da-turma.spec.ts`); nada em `apps/`. Antes de encerrar o vínculo, o caso segura as leituras da turma que não
são do acesso (`ehUmaLeituraDaTurma`: a turma, os alunos, o desempenho e os pedidos, só `GET`) até o fim. Disparada a releitura no pior
momento, o caso espera a requisição chegar ao servidor (`expect.poll`), e então confere o que já conferia: o aviso dentro do diálogo,
só "Fechar", a seção sem o que a API recusa, o foco no título, o axe. Nada foi afrouxado. No fim, solta as leituras e confere o outro
desfecho, que antes dependia do acaso: a página inteira troca pelo aviso e a seção sai.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | `try/finally` em volta do trecho entre o `page.route` e o `leiturasDaTurma.abrir()`, para as leituras não ficarem presas se uma asserção falhar | Recusada: o próprio revisor diz que hoje não faz mal, porque a página morre com o caso; só o trace da falha mostraria requisições penduradas. Mais estrutura num caso que já é o mais longo do arquivo |
| revisor-geral (1ª) | `page.unroute` logo depois do `abrir()` | Recusada: o `page.route` está no último trecho do caso e a página morre com ele; o revisor diz que só importa se alguém acrescentar um trecho depois. Quem acrescentar desfaz |
| test-engineer (1ª) | Registrar na retro que o "vermelho antes" nasceu de reprodução manual (espera de 1,5 s), não de bloco de mutação | Para a retro (Arquiteto): é registro de processo, não muda a correção |
| frontend-reviewer (1ª) | O cartão e o título da turma mostram sufixo de id | Recusada: é dado sintético da vitrine, e o próprio revisor diz que não é achado de produto |
| revisor-geral (2ª) | Registrar numa linha que a recomendação do `expect.poll` (1ª rodada) foi aplicada de outro jeito, com o motivo do `cancelRefetch: false` | Registrado aqui: a recomendação foi atendida contando só `/reivindicacoes`, porque, com `cancelRefetch: false` (`ListaDePedidos.tsx:88`), o disparo não abre outra leitura se o relógio de 15 s já deixou uma no ar |
| test-engineer (2ª) | O `poll` ainda não prova que a leitura presa veio do `visibilitychange` (seria preciso zerar o contador antes do disparo e usar relógio falso no lugar do de 15 s) | Para a retro (Arquiteto): o próprio revisor diz que, para o que o caso protege, basta haver uma releitura no ar, e que não bloqueia |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 22:58:08 | 2026-11-06 22:58:20 | `infra-guardian` | 1 | APROVADO | a25cf8c6fb9970564 |
| 2026-11-06 22:58:07 | 2026-11-06 22:58:22 | `conformidade-reviewer` | 1 | APROVADO | ad0991dfe109dd128 |
| 2026-11-06 22:58:05 | 2026-11-06 22:58:22 | `tenancy-guardian` | 1 | APROVADO | a83f6d4cf0996bf30 |
| 2026-11-06 22:58:04 | 2026-11-06 22:58:25 | `frontend-reviewer` | 1 | APROVADO | add92b404ebfee817 |
| 2026-11-06 22:58:06 | 2026-11-06 22:58:25 | `privacy-guardian` | 1 | APROVADO | ac904fc7c072ca83a |
| 2026-11-06 22:58:02 | 2026-11-06 22:58:36 | `revisor-geral` | 1 | APROVADO | ad7d283a02e2d9ff3 |
| 2026-11-06 22:57:59 | 2026-11-06 22:59:22 | `test-engineer` | 1 | APROVADO | acc3a7aba6f733ec3 |
| 2026-11-06 23:10:21 | 2026-11-06 23:10:38 | `revisor-geral` | 2 | APROVADO | aca6dd0894c348202 |
| 2026-11-06 23:10:15 | 2026-11-06 23:10:47 | `test-engineer` | 2 | APROVADO | ab37e82bf5f1ec597 |
