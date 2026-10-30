# Correção — A gaveta do celular fecha sozinha quando o /v1/eu chega depois do toque no menu

**Origem:** esteira run 40988277250 (spec/nomes-de-mercado, job e2e 6/8, em 95234fd)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`
<!-- test-engineer é obrigatório em toda correção. -->

## Sintoma

`e2e/coordenacao-introducao.spec.ts:201` [celular], "a coordenadora seguinte no mesmo computador vê a introdução dela", caiu na esteira:
`expect(getByRole('dialog', { name: 'Menu' })).toBeVisible()` não achou o elemento (`abrirNavegacao`, `e2e/__fixtures__/casca.ts:64`,
chamado na linha 209 do spec). O commit da esteira era só de documento, e a develop estava verde.

## Fora desta correção

nada

## Causa

Não é a introdução: o caso falha antes dela, ao abrir a gaveta. Na casca (`CascaDaEscola.tsx`) um efeito fechava a gaveta com
`[caminho, usuarioDaSessao]`. `usuarioDaSessao` é `dados?.usuarioId`, e `dados` é `undefined` até o `/v1/eu` voltar: a passagem de
"ninguém" para "alguém" contava como troca de pessoa e fechava a gaveta. O botão do menu já está na barra do topo antes de a consulta
voltar. No caso, `toHaveURL(/agentes$/)` passa com a rota na tela, e o toque em "Abrir o menu" vem logo depois, com o `/v1/eu` ainda a
caminho (CPU ×4 e rede da esteira). A gaveta abre, o `/v1/eu` chega, o efeito a fecha, e `abrirNavegacao` não a vê em 5 s. Defeito do
produto, e não do teste: quem tocasse no menu a esse tempo veria o menu abrir e sumir. Veio com a casca da coordenação no celular, de
tarefa anterior à nomes-de-mercado (a 1.0 desta spec só mexeu em documento e no rename por mapa).

## Teste que reproduz

`apps/web/src/componentes/CascaDaEscola.test.tsx › a gaveta fecha com a rota e com a pessoa da sessão › o /v1/eu que chega depois do toque
no menu não fecha a gaveta…`. A rede segura o `/v1/eu`, a gaveta abre, a consulta é liberada e a gaveta tem de continuar aberta.
Vermelho antes (`expected false to be true`, na asserção da gaveta aberta depois da consulta, e não antes), verde depois. O caso do
e2e fica como está: ele já prova o que quer (a coordenadora seguinte vê a introdução dela).

## Correção

A gaveta passa a fechar quando a pessoa troca de uma para outra (a última conhecida contra a nova), e não quando ela deixa de ser
`undefined`. O efeito da rota ficou à parte, com a rota anterior guardada, para um não fechar pelo outro. Nenhum dado novo, rota nem
campo: só o momento em que a gaveta fecha.

Comportamento que muda, e que fica registrado: A, depois `undefined`, depois A de novo (a mesma pessoa voltando, por exemplo o `resetQueries`
seguido do mesmo `/v1/eu`) já não fecha a gaveta. Antes fechava, na passagem pelo `undefined`. A de A para `undefined` para B continua
fechando, porque a última pessoa conhecida fica guardada durante o esvaziamento; o caso "A, depois ninguém, depois B" prova isso, na
ordem em que o `aoTrocarDeSessao` (`main.tsx`) a faz.

Da rodada 1 (ordem `.processo/ordens/2026-10-30-introducao-da-coordenacao-no-celular-r1.md`): o comentário da gaveta deixou de dizer que a
escola fecha a gaveta (é a rota ou a pessoa que o seletor muda, e o `areas.spec.ts` cobre a troca de escola); a espera do primeiro caso novo
é pelo nome vindo do `/v1/eu`; e o comentário do cabeçalho da casca, que dizia "a coordenação, com sete", passou a dizer quatro lugares na
barra de baixo (`navegacao.ts`, `MAXIMO_NA_BARRA`), só texto.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | "Não há foto da gaveta aberta no celular, porque o clique da vitrine roda a 1366 px. [...] Quando a vitrine aceitar clique na largura do celular, vale tirar essa foto." | `TODO.md`: é de `tools/vitrine/foto.ts` (o clique roda só no computador), fora desta correção. A gaveta aberta fica provada pelo teste de unidade e pelo e2e `coordenacao-introducao.spec.ts:201` [celular] |
| test-engineer (2ª) | "O comportamento A, depois `undefined`, depois A de novo (a gaveta continua aberta) está escrito no documento, mas nenhum teste o fixa. Um caso curto, igual ao da linha 126 mas liberando A em vez de B, guardaria esse comportamento contra uma volta ao jeito antigo." | `TODO.md`, seção da correção: recomendação de revisor que aprovou, na segunda rodada; o comportamento está registrado no documento e a correção não depende dele |
| test-engineer (2ª) | "A seção "Teste que reproduz" do documento cita só o primeiro caso novo. O segundo só aparece na "Correção" e nos blocos de mutação. Vale citá-lo também nessa seção, pelo nome." | Recusada: o segundo caso está citado pelo nome nos blocos de mutação 4 e 5, que é onde o portão o lê, e o documento já o descreve em "Correção" |

## Mutações

```mutacao
arquivo: apps/web/src/componentes/CascaDaEscola.tsx
teste: apps/web/src/componentes/CascaDaEscola.test.tsx › o /v1/eu que chega depois do toque no menu não fecha a gaveta: a pessoa passou de ninguém a alguém, e não de uma a outra
-    const trocouDePessoa = usuarioDaGaveta.current !== undefined && usuarioDaGaveta.current !== usuarioDaSessao
+    const trocouDePessoa = usuarioDaGaveta.current !== usuarioDaSessao
```

```mutacao
arquivo: apps/web/src/componentes/CascaDaEscola.tsx
teste: apps/web/src/componentes/CascaDaEscola.test.tsx › a rota troca com a gaveta aberta
-    if (caminhoDaGaveta.current === caminho) return
+    if (caminhoDaGaveta.current !== caminho) return
```

```mutacao
arquivo: apps/web/src/componentes/CascaDaEscola.tsx
teste: apps/web/src/componentes/CascaDaEscola.test.tsx › a pessoa da sessão troca sob o mesmo caminho
    if (usuarioDaSessao === undefined) return
    const trocouDePessoa = usuarioDaGaveta.current !== undefined && usuarioDaGaveta.current !== usuarioDaSessao
    usuarioDaGaveta.current = usuarioDaSessao
-    if (trocouDePessoa) fecharGaveta()
+    if (!trocouDePessoa) fecharGaveta()
```

```mutacao
arquivo: apps/web/src/componentes/CascaDaEscola.tsx
teste: apps/web/src/componentes/CascaDaEscola.test.tsx › a troca de pessoa como a aplicação faz, de A por ninguém e de ninguém para B, fecha a gaveta aberta no meio: a última pessoa conhecida fica guardada
-    if (usuarioDaSessao === undefined) return
    const trocouDePessoa = usuarioDaGaveta.current !== undefined && usuarioDaGaveta.current !== usuarioDaSessao
```

```mutacao
arquivo: apps/web/src/componentes/CascaDaEscola.tsx
teste: apps/web/src/componentes/CascaDaEscola.test.tsx › a troca de pessoa como a aplicação faz, de A por ninguém e de ninguém para B, fecha a gaveta aberta no meio: a última pessoa conhecida fica guardada
+    const anterior = usuarioDaGaveta.current
+    usuarioDaGaveta.current = usuarioDaSessao
    if (usuarioDaSessao === undefined) return
-    const trocouDePessoa = usuarioDaGaveta.current !== undefined && usuarioDaGaveta.current !== usuarioDaSessao
-    usuarioDaGaveta.current = usuarioDaSessao
+    const trocouDePessoa = anterior !== undefined && anterior !== usuarioDaSessao
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 04:47:12 | 2026-10-30 04:47:34 | `tenancy-guardian` | 1 | APROVADO | a5c8f287d85cedb0a |
| 2026-10-30 04:47:25 | 2026-10-30 04:47:44 | `infra-guardian` | 1 | APROVADO | a0048e1baf6b1875d |
| 2026-10-30 04:47:16 | 2026-10-30 04:47:50 | `privacy-guardian` | 1 | APROVADO | a3980c1061676a8b0 |
| 2026-10-30 04:47:20 | 2026-10-30 04:47:51 | `conformidade-reviewer` | 1 | APROVADO | a8b439b17e8f4d44c |
| 2026-10-30 04:47:29 | 2026-10-30 04:47:59 | `frontend-reviewer` | 1 | APROVADO | af30724ad52c807f6 |
| 2026-10-30 04:47:08 | 2026-10-30 04:49:24 | `test-engineer` | 1 | REPROVADO | abf9739920b68befe |
| 2026-10-30 04:59:47 | 2026-10-30 05:01:03 | `test-engineer` | 2 | APROVADO | a4fc8facdffba45c9 |
