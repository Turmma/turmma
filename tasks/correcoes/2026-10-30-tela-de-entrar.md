# Correção — a pinta do painel da tela de entrada fica no canto, e não no centro do painel

**Origem:** uso (o Joaquim, sobre `/entrar`: "a imagem nem está centralizada"; e a decisão dele de 30/10, opção B: pinta centrada e parada, composição melhor dentro da pele, sem onça nem movimento).
**Subagentes obrigatórios:** `test-engineer`, `frontend-reviewer`, `conformidade-reviewer`, `privacy-guardian`, `infra-guardian`, `tenancy-guardian`
<!-- Os seis são os que o PEDIDO do Orquestrador ditou. A correção leva 4 arquivos fora de tasks/ e não toca `.github/`, `tools/ci/` nem
     `tools/processo/`: o `revisor-geral` não é obrigatório pelo limite do passo 5. -->

## Sintoma

Na tela `/entrar`, e em toda página que usa a `CascaPublica` (entrada da equipe, endereço da escola, convite, segundo fator,
turma pública), o painel da esquerda a partir de 1024 px mostra a pinta da marca, parada e apagada, **colada no canto de baixo e da
direita** (a 40 px de cada borda). Ela não está no meio do painel nem na altura do formulário: o painel fica com um buraco no
meio e o desenho encostado no canto, e a tela parece solta. Foto do antes (1366 × 768 e 360 × 800):
`/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--correcao2026-10-30-tela-de-entrar/bc71cf70-3784-41d7-950e-f64616dec612/scratchpad/antes-pc.png`
e `antes-cel.png` (no celular a pinta grande não aparece, por desenho).

## Fora desta correção

Nada: a árvore estava limpa. Fora também, por decisão do Joaquim: onça na entrada, movimento (a pinta continua parada, 9.6),
imagem nova e qualquer texto novo (RF20 da X1: textos, ordem de campo e mensagens não mudam). A lista de
`avatar-so-nas-duas-pecas.test.ts` não muda.

## Causa

`CascaPublica.tsx` posiciona a pinta com `absolute right-10 bottom-10`: a posição é a de um canto, escolhida na X1 (14.0) e
escrita em `docs/interface.md` 11.3 e medida por `e2e/casca-publica.spec.ts` (que só confere que ela está inteira dentro do painel).
Nenhum teste dizia onde, dentro do painel, ela devia ficar, e por isso o canto passou por certo.

## Teste que reproduz

`e2e/casca-publica.spec.ts` › `a moldura das páginas públicas` › `/entrar: a pinta do painel está no centro dele, na altura do centro do cartão, com respiro dos quatro lados e abaixo da marca, mesmo em janela baixa`
(e o mesmo caso para `/mfa`, que é a mesma casca com outro conteúdo). Mede, em quatro janelas (1366 × 768, 1366 × 650, 1024 × 768 e
1024 × 500), o centro da pinta contra o centro do painel (2 px de folga) e contra o centro do cartão, o respiro de 40 px de cada lado e
que a caixa da pinta começa abaixo da caixa do `banner`. **Vermelho antes** (nos quatro casos, dois projetos): na primeira versão do
caso, `centro da pinta na horizontal a 1366 px`; depois da rodada 1, com a pinta já no centro, `a pinta começa abaixo da marca a
1024 × 500 px` (as outras três janelas passavam). **Verde depois** (22 casos do arquivo, 34 s; os novos levam de 3,6 a 4,1 s cada, longe dos
15 s do portão: a primeira versão do caso, com um `goto` por janela, levava 11 s, e a página agora abre uma vez só).

## Correção

`CascaPublica.tsx`: a pinta do painel deixa de ser posicionada no canto (`right-10 bottom-10`, 320 px) e passa a ficar no centro do
painel (`inset-0 m-auto`, 384 px, sem `transform`, parada e a 15% como antes). Como o cartão do formulário já é centrado na altura, a
pinta e ele ficam na mesma linha. O painel mais estreito (512 px, a 1024 de janela) ainda deixa 64 px de cada lado dela. Rodada 1
(`test-engineer` e `frontend-reviewer`): o comentário dizia que a marca não alcançava a pinta e nenhum teste o provava; pela conta, a
1024 × 500 o topo da pinta ficava a uns 58 px e a marca termina a uns 108. Provei a afirmação em vez de tirá-la: o painel ganhou altura
mínima (`lg:min-h-[40rem]`), que põe o topo da pinta a 128 px (20 px abaixo da marca) em qualquer janela, e o caso mede isso nas quatro janelas
acima. Numa janela de computador mais baixa que 40 rem a página rola, em vez de a pinta passar por cima da marca; no celular, empilhado,
nada muda (a classe é `lg:`). `docs/interface.md` 11.3 passa a dizer onde a pinta fica, o porquê (o canto deixava o meio do painel vazio, apontado
pelo Joaquim em 30/10) e que ela não vira onça nem ganha movimento (9.6 e 9.7). Nada de texto, campo, mensagem, onça ou imagem mudou, e
`avatar-so-nas-duas-pecas.test.ts` ficou como estava. A casca é uma só: entrada da equipe, endereço da escola, convite, segundo fator e
turma pública herdam a mudança. Tentei também mais respiro no cartão (`lg:p-10`) e desfiz: nenhum teste o prova e ele não é o defeito.

## Telas vistas

Antes e depois, com o ambiente de teste de pé (`/entrar`, sem sessão, por isso fotografado direto no Playwright e não por
`tools/vitrine/`, que entra como um papel): computador (1366 × 768) e celular (360 × 800), tema claro e escuro (o aparelho no escuro, que é o
que a aparência Sistema segue). O "antes" só existe no claro (a foto foi tirada antes de a correção ser escrita; no escuro a pinta ficava no
mesmo canto). Pasta: `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--correcao2026-10-30-tela-de-entrar/bc71cf70-3784-41d7-950e-f64616dec612/scratchpad/`:
`antes-pc.png`, `antes-cel.png`, `depois-claro-pc.png`, `depois-escuro-pc.png`, `depois-claro-cel.png`, `depois-escuro-cel.png`.
Depois: a pinta está no centro do painel e na altura do cartão, nos dois temas; o celular não mudou (a pinta grande é só de 1024 px para
cima), sem rolagem de lado. Só `/entrar` foi fotografada; as outras telas usam a mesma casca e o e2e mede `/mfa` também.

## Mutações

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: e2e/casca-publica.spec.ts › /entrar: a pinta do painel está no centro dele, na altura do centro do cartão, com respiro dos quatro lados e abaixo da marca, mesmo em janela baixa
-className="pointer-events-none absolute inset-0 m-auto hidden size-96 opacity-15 select-none lg:block"
+className="pointer-events-none absolute right-10 bottom-10 hidden size-96 opacity-15 select-none lg:block"
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: e2e/casca-publica.spec.ts › /entrar: a pinta do painel está no centro dele, na altura do centro do cartão, com respiro dos quatro lados e abaixo da marca, mesmo em janela baixa
-className="pointer-events-none absolute inset-0 m-auto hidden size-96 opacity-15 select-none lg:block"
+className="pointer-events-none absolute inset-0 m-auto hidden size-[32rem] opacity-15 select-none lg:block"
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: e2e/casca-publica.spec.ts › /entrar: a pinta do painel está no centro dele, na altura do centro do cartão, com respiro dos quatro lados e abaixo da marca, mesmo em janela baixa
-bg-papel lg:min-h-[40rem] lg:border-r-2 lg:border-b-0">
+bg-papel lg:border-r-2 lg:border-b-0">
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 19:15:29 | 2026-10-30 19:15:37 | `tenancy-guardian` | 1 | APROVADO | a0fd59d32ac67cb64 |
| 2026-10-30 19:15:21 | 2026-10-30 19:15:38 | `conformidade-reviewer` | 1 | APROVADO | af4ed2ce9f61d8c7f |
| 2026-10-30 19:15:18 | 2026-10-30 19:15:39 | `frontend-reviewer` | 1 | APROVADO | a9cf2450aa5caa0a7 |
| 2026-10-30 19:15:26 | 2026-10-30 19:15:40 | `infra-guardian` | 1 | APROVADO | a5031dcc6d4b8712b |
| 2026-10-30 19:15:24 | 2026-10-30 19:15:41 | `privacy-guardian` | 1 | APROVADO | a8cf9788e6a846df9 |
| 2026-10-30 19:15:16 | 2026-10-30 19:15:57 | `test-engineer` | 1 | APROVADO | a51dedc79d1cb198d |

## Recomendações da rodada 1 que ficaram sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Acompanhar o tempo dos casos novos do e2e (cerca de 6 s cada, contra 15 s do portão), na próxima rodada da esteira | Sem código: é acompanhamento. Fica para a esteira da `develop` depois do pouso; se passar de 10 s, vira lote de e2e perto do prazo (já conhecido). Se o item 1 acrescentar um caso, o Implementador registra o tempo dele em "Teste que reproduz" |
| frontend-reviewer (1ª) | Copiar as fotos "antes" e "depois", hoje em `/tmp/.../scratchpad/`, para `.processo/` | Recusada: as fotos desta rodada, da árvore de agora, já estão em `.processo/vitrine/entrar-*.png`; as de `/tmp` são do Implementador e `.processo/` não entra no git. A retro lê o documento, que já descreve o antes e o depois |
| 2026-10-30 19:32:58 | 2026-10-30 19:33:17 | `frontend-reviewer` | 2 | APROVADO | a5354124984894f1a |
| 2026-10-30 19:33:06 | 2026-10-30 19:33:21 | `conformidade-reviewer` | 2 | APROVADO | acef92137393884f1 |
| 2026-10-30 19:33:13 | 2026-10-30 19:33:28 | `privacy-guardian` | 2 | APROVADO | a716ec26d904d2184 |
| 2026-10-30 19:32:50 | 2026-10-30 19:33:31 | `test-engineer` | 2 | APROVADO | a71525ecd58233aee |
| 2026-10-30 19:33:22 | 2026-10-30 19:33:36 | `infra-guardian` | 2 | APROVADO | ac1c457570e50266a |
| 2026-10-30 19:33:30 | 2026-10-30 19:33:39 | `tenancy-guardian` | 2 | APROVADO | a526a7fa0556f9d4a |

## Recomendações da rodada 2 que ficaram sem aplicar

(As seis linhas da rodada 2 acima estão coladas à tabela da rodada 1 porque o hook acrescenta ao fim da última tabela do documento; não foram mexidas.)

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) | Nada prende o `lg:` de `lg:min-h-[40rem]`: trocar por `min-h-[40rem]` empilharia 640 px de painel no celular sem nenhum teste vermelho; o caso de 1023 e 360 px poderia exigir painel empilhado baixo, com uma quarta mutação | `TODO.md`: teste de guarda do `lg:` da altura mínima da `CascaPublica`. Não é barata: acrescenta cláusula e mutação, o que caduca as aprovações de uma correção cujo defeito (a pinta no canto) está provado |
| test-engineer (2ª) | Medir a rolagem vertical a 1024 × 500 (`scrollHeight >= 640`), que o texto afirma e o caso não mede | `TODO.md`, junto com a de cima: a altura do painel já é provada de forma indireta pela pinta abaixo da marca |
| frontend-reviewer (2ª) | A 1024 × 500 o botão "Entrar" fica a poucos pixels da borda inferior e quem não sabe que a página rola pode achar que o formulário termina ali; se virar queixa, `lg:min-h-[40rem]` valer só acima de uma altura de janela | Sem destino de código: janela rara, custo aceito pelo próprio revisor. Fica em `TODO.md` como observação, a reabrir só se houver queixa |
| test-engineer (2ª), frontend-reviewer (2ª), infra-guardian (2ª) | Acompanhar o tempo do caso novo na esteira da `develop` (3,6 a 4,1 s contra os 15 s do portão) | Já está no documento, em "Recomendações da rodada 1 que ficaram sem aplicar" e em "Teste que reproduz": a esteira da `develop` depois do pouso |
