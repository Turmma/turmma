# Correção — a vitrine não mostra o botão "Entrar com a conta da escola" nem a conta confirmada, e fotografa a onça no meio da entrada de 240 ms

**Origem:** validacao (TODO.md, seção "Da tarefa 16.0 da acesso-e-convites", itens do `conformidade-reviewer` 1ª e do `frontend-reviewer` 2ª); o Validador de `acesso-e-convites` precisa da vitrine com a conta da escola para fotografar os requisitos com tela.
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `conformidade-reviewer`, `tenancy-guardian`, `infra-guardian`, `test-engineer`, `revisor-geral`
<!-- O PEDIDO do Orquestrador ditou: frontend-reviewer, privacy-guardian, test-engineer, revisor-geral. A Mesa devolveu a rodada: tools/vitrine/ pede também o conformidade-reviewer (guardioes-por-caminho.ts). -->

## Sintoma

1. As duas escolas da vitrine (`tools/vitrine/escola.ts`) nascem **sem linha em `provedor_escola`**. A API devolve `provedores: []` em `GET /v1/escolas/:slug/acesso`, e a web
   não desenha o botão: nem o de `/e/<slug>` (`EntrarNaEscola`), nem o da sala (`ContaDaEscolaNaSala`), nem o "Ligar a conta da escola" de "Eu" (`ContaDaEscola`).
   Sem o botão não há como chegar à "Conta da escola confirmada…" da página da turma, e o Validador fotografa cada requisito com tela.
   A escola cheia também não tem **acesso vigente** de turma (link e código): sem ele a página `/e/<slug>/turma` não abre a sala, mesmo com o botão.
2. A foto de uma tela que rola sai com a onça translúcida no computador (a entrada dela dura 240 ms, `Onca.css`, `.onca-entra`). A sala (`/e/<slug>/turma`, 970 px a 1366 × 768),
   que é a tela que o Validador precisa fotografar, saiu translúcida em três fotos seguidas; a entrada `/e/<slug>`, que cabe na janela, saía opaca.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

1. `montarEscolaCheia` e `montarEscolaVazia` montam a escola pelas peças do e2e (`criarEquipeComSenha`, `montarEscolaComEntregas`) e por `insert`
   próprio, e nenhuma delas libera provedor: quem libera é `liberarProvedorDaEscola`, que só os specs da conta da escola chamam. O acesso da sala (`acesso_turma`)
   também só nasce em `gerarAcessoDaSalaNoBanco`, que a vitrine nunca chamou.
2. O `page.screenshot({ fullPage: true })` de uma página mais alta que a janela redimensiona a página para tirar a foto, e o Chromium **reinicia as animações CSS** nesse momento. Medido
   na sala real, com o Chromium do Playwright: a opacidade da onça, 1 e `finished` antes da foto, ficava em 0,42 e `running` logo depois dela. Esperar a animação acabar **antes** da foto
   (a primeira versão desta correção, `esperarAsAnimacoes`) não alcança esse momento; é o que a primeira rodada da Mesa mostrou. A entrada `/e/<slug>` saía opaca só porque cabe na janela e não passa pelo redimensionamento.

**De qual tarefa é:** da 16.0 (a tela da conta da escola na sala é a primeira com botão que depende de provedor liberado); a vitrine é de antes e não precisava do provedor.

## Teste que reproduz

- `tools/vitrine/escola.int.test.ts` › `as duas escolas liberam o Google para o domínio do provedor sintético, e nenhuma conta de pessoa fica ligada a ele` e `a escola cheia tem o acesso da sala vigente, na turma do aluno, com nome livre; a vazia não tem sala`: vermelho no HEAD (zero linhas em `provedor_escola` e em `acesso_turma`).
- `tools/vitrine/escola.test.ts` › `o resumo diz onde está o botão da conta da escola, sem prometer o provedor, e só a escola com sala mostra a sala`: vermelho no HEAD (o resumo não cita o provedor nem a sala).
- `e2e/vitrine-foto.spec.ts` › `a foto da página que rola não recomeça a entrada da onça`: na sala real, com o Chromium. Vermelho sem `animations: 'disabled'` (conferido: falha em `expect(await estados()).toEqual(antes)`, as animações voltam a `running`), verde com ele, nos dois projetos.

## Correção

A vitrine liga o provedor sintético nas duas escolas e abre a sala na cheia; a foto sai com a onça no fim da entrada.

- **Provedor.** `montarEscolaCheia` e `montarEscolaVazia` chamam `liberarProvedorDaEscola(escolaId, 'google', DOMINIO_DO_PROVEDOR_SINTETICO)` (a peça do e2e, a mesma que os specs da conta da escola usam).
  O domínio, `escola-a.educa-sintetica.test`, e a conta de teste, `google-aluna-a`, são os do `infra/oidc-falso/config.json` (um caso de `escola.test.ts` lê o arquivo e confere os dois): o botão
  "Entrar com a conta Google da escola" aparece em `/e/<slug>` nas duas escolas. É dado da instituição; **nenhuma `conta_externa` é criada** (o teste de integração confere), então nem e-mail,
  nem nome, nem `hd` de pessoa ficam no banco.
- **Sala.** A cheia ganha o acesso vigente da turma do aluno (`gerarAcessoDaSalaNoBanco`, a 2ºB, que tem nomes livres na lista), com link e código no resumo: sem ele a página
  `/e/<slug>/turma` não abre, e o botão da sala ("Entrar com a conta da escola") não tem onde aparecer. A vazia não tem nome livre e a sala não mostraria o botão, então não ganha sala.
  `Acessos` ganha `provedor` (as duas) e `sala` (opcional, só na cheia).
- **O que o resumo promete, e o que não.** O botão e a sala, que o `foto` fotografa. **A "Conta da escola confirmada" não:** o clique leva ao `oidc-falso`, que o navegador do `foto` não resolve
  (`chromium.launch()` sem o `--host-resolver-rules` do `playwright.config.ts`) e que pede o assunto digitado, e o `--clicar` só clica. O resumo diz isso, e o caminho inteiro
  (clique, `--host-resolver-rules`, `--preencher`) foi para o `TODO.md`; quem o prova hoje é o e2e `conta-da-escola-na-sala.spec.ts`. Esta correção não promete mais do que entrega.
- **Vitrine antiga.** `lerVitrine` devolve `null` para o arquivo de antes do provedor, que cai no "Não há vitrine montada" e manda montar de novo: o agente não fotografa por engano a escola sem botão.
- **Foto.** `tirarAFoto` (`tools/vitrine/captura.ts`, módulo à parte para o e2e importar só ela) passa `animations: 'disabled'` às duas capturas de `fotografar`, a do recorte e a da página inteira
  do `catch`: o Playwright leva a animação que acaba ao último quadro e para a que repete, e é o padrão de mercado para isto (D81). A primeira versão desta correção esperava as
  animações antes da foto, com função própria (`esperarAsAnimacoes`); a Mesa mostrou que a espera não alcança o reinício do `fullPage`, e ela saiu junto com o teste de relógio dela: a opção faz o mesmo
  trabalho no momento certo. Conferido na sala real (opacidade 0,42 sem a opção, 1 com ela) e no e2e.

A cor âmbar da "Conta da escola confirmada" (primeiro item do `frontend-reviewer` no `TODO.md`) é troca de tela e fica como está.

## Mutações

--faltando: 0 linhas (11 blocos, 0 motivos)

A foto sem `animations: 'disabled'`: a página que rola sai com a entrada da onça recomeçada, e as animações voltam a `running`.

```mutacao
arquivo: tools/vitrine/captura.ts
teste: e2e/vitrine-foto.spec.ts › a foto da página que rola não recomeça a entrada da onça
falha: expect(await estados()).toEqual(antes)
- await page.screenshot({ path: arquivo, fullPage: true, animations: 'disabled', ...(recorte === undefined ? {} : { clip: recorte }) })
+ await page.screenshot({ path: arquivo, fullPage: true, ...(recorte === undefined ? {} : { clip: recorte }) })
```

O recorte se perde: a foto sai com a página inteira em vez do pedaço que o `fotografar` pediu.

```mutacao
arquivo: tools/vitrine/captura.ts
teste: e2e/vitrine-foto.spec.ts › a foto da página que rola não recomeça a entrada da onça
falha: expect(readFileSync(arquivo).readUInt32BE(20)).toBe(alturaDoRecorte * escala)
- await page.screenshot({ path: arquivo, fullPage: true, animations: 'disabled', ...(recorte === undefined ? {} : { clip: recorte }) })
+ await page.screenshot({ path: arquivo, fullPage: true, animations: 'disabled' })
```

A cheia deixa de liberar o provedor: o botão some da entrada dela.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.int.test.ts › as duas escolas liberam o Google para o domínio do provedor sintético, e nenhuma conta de pessoa fica ligada a ele
- await liberarProvedorDaEscola(coordenadora.escolaId, 'google', DOMINIO_DO_PROVEDOR_SINTETICO)
  const acesso = await gerarAcessoDaSalaNoBanco(coordenadora.escolaId, escola.turmas.doB.id)
```

A vazia deixa de liberar o provedor.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.int.test.ts › as duas escolas liberam o Google para o domínio do provedor sintético, e nenhuma conta de pessoa fica ligada a ele
- await liberarProvedorDaEscola(coordenadora.escolaId, 'google', DOMINIO_DO_PROVEDOR_SINTETICO)
  const segundoFator = ativarMfa ? await ativarSegundoFator(url, coordenadora.email, coordenadora.senha) : null
  return {
    escola: { id: coordenadora.escolaId, nome: coordenadora.escolaNome, slug: coordenadora.slug },
    coordenacao: { nome: coordenadora.nome, email: coordenadora.email, senha: coordenadora.senha, segredo: segundoFator?.segredo ?? null, ultimoPasso: segundoFator?.passo ?? 0 },
    professora: { ...professora, turma, disciplina: 'Química' },
```

A cheia entrega um acesso que não existe no banco: o resumo promete uma sala que não abre.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.int.test.ts › a escola cheia tem o acesso da sala vigente, na turma do aluno, com nome livre; a vazia não tem sala
  await liberarProvedorDaEscola(coordenadora.escolaId, 'google', DOMINIO_DO_PROVEDOR_SINTETICO)
- const acesso = await gerarAcessoDaSalaNoBanco(coordenadora.escolaId, escola.turmas.doB.id)
+ const acesso = { codigo: 'ABC234', token: 'token-que-nao-existe-no-banco-de-teste' }
```

O resumo deixa de dizer onde está o botão da conta da escola.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.test.ts › o resumo diz onde está o botão da conta da escola, sem prometer o provedor, e só a escola com sala mostra a sala
    `  Conta da escola — Google, domínio ${provedor.dominio}`,
-   `    botão "Entrar com a conta Google da escola": ${url}/e/${escola.slug}`,
    `    o botão leva ao provedor sintético (assunto ${CONTA_DO_PROVEDOR_SINTETICO}), que o \`foto\` ainda não alcança: da vitrine só se vê o botão`,
```

O resumo deixa de dizer o código da sala.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.test.ts › o resumo diz onde está o botão da conta da escola, sem prometer o provedor, e só a escola com sala mostra a sala
          `    endereço: ${url}/e/${escola.slug}/turma`,
-         `    código: ${sala.codigo}`,
          `    link: ${url}/e/${escola.slug}/turma#${sala.token}`,
```

A escola sem sala também promete uma sala no resumo.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.test.ts › o resumo diz onde está o botão da conta da escola, sem prometer o provedor, e só a escola com sala mostra a sala
falha: not.toContain('Sala da turma')
    ...(sala === undefined
-     ? []
+     ? ['  Sala da turma sem nome livre']
      : [
```

A vitrine de antes do provedor é lida como se estivesse montada, e a foto sai sem o botão.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.test.ts › trata como não montada a vitrine de antes do provedor, que não mostraria o botão da conta: o agente monta de novo
falha: comArquivo(antiga, (raiz) => expect(lerVitrine(raiz)).toBeNull())
- return vitrine.provedor === undefined || vitrine.vazia?.provedor === undefined ? null : (vitrine as Vitrine)
+ return vitrine as Vitrine
```

A vitrine só com a cheia atualizada também é velha: a vazia fotografaria sem o botão.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.test.ts › trata como não montada a vitrine de antes do provedor, que não mostraria o botão da conta: o agente monta de novo
falha: comArquivo(meia, (raiz) => expect(lerVitrine(raiz)).toBeNull())
- return vitrine.provedor === undefined || vitrine.vazia?.provedor === undefined ? null : (vitrine as Vitrine)
+ return vitrine.provedor === undefined ? null : (vitrine as Vitrine)
```

Sem o arquivo da vitrine, a leitura lança em vez de dizer que não há vitrine.

```mutacao
arquivo: tools/vitrine/escola.ts
teste: tools/vitrine/escola.test.ts › sem arquivo, não há vitrine
  const caminho = caminhoDoArquivo(raiz)
- if (!existsSync(caminho)) return null
  const vitrine = JSON.parse(readFileSync(caminho, 'utf8')) as Partial<Vitrine>
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `privacy-guardian` (1ª) | A onça ainda aparece translúcida em `aluno--e-…-turma--computador.png` | Atendida pelo item 1 da ordem (`animations: 'disabled'`) |
| `privacy-guardian` (1ª) | Se a vitrine fotografar o login por `google-aluna-a`, conferir que a `conta_externa` guarda só provedor e `sujeito`, sem e-mail nem `hd` | Recusada: a vitrine não cria `conta_externa` (o teste de integração desta correção confere zero linhas), e a prova do que o login guarda é dos testes da 14.0, como o próprio revisor diz |
| `conformidade-reviewer` (1ª) | A onça ainda sai apagada na foto da sala | Atendida pelo item 1 da ordem |
| `conformidade-reviewer` (1ª) | A conta confirmada ainda não tem foto | A foto é do Validador; o resumo deixou de prometer o caminho até a conta confirmada (item 3 da ordem), e o que falta para o `foto` chegar lá está no `TODO.md` |
| `frontend-reviewer` (1ª) | Documentar no resumo que a onça só fica opaca depois da correção 1 | Recusada: deixa de existir com o item 1 atendido |
| `frontend-reviewer` (1ª) | `--preencher` no `foto`, para chegar à conta confirmada num comando só | `TODO.md`: muda a interface do comando, não cabe em correção de poucas linhas |
| `frontend-reviewer` (1ª) | "Não é a sua turma? Usar outro código" quebra em duas linhas no celular | Já está no `TODO.md`, e a correção não mexe em `apps/web` |
| `revisor-geral` (1ª) | `escola.ts`: a checagem de vitrine antiga (`provedor === undefined`) é ad hoc; um número de versão no arquivo resolveria | `TODO.md`: muda o formato do arquivo da vitrine |
| `revisor-geral` (1ª) | O resumo diz como chegar à "Conta da escola confirmada", mas nada fotografa essa tela | O resumo deixou de dizer; o Validador fotografa o botão e a sala, e o caminho inteiro está no `TODO.md` |
| `test-engineer` (1ª) | A sala vence em 7 dias e `lerVitrine` não olha o vencimento; a lista de nomes se esgota se o Validador reivindicar os dois nomes livres e o botão some; vale o `mostrar` avisar nos dois casos | `TODO.md`: muda o que o `mostrar` verifica e lê o banco |
| `revisor-geral` e `test-engineer` (1ª) | A espera engole a falha do navegador e não avisa quando bate no teto; o prazo dela é medido com relógio real | Deixou de existir: a função de espera saiu com o item 1 |
| `tenancy-guardian` (1ª) | `escola.int.test.ts`: conferir que o acesso da sala gravado na escola cheia não aparece com o `escola_id` da vazia; "basta uma linha" | `TODO.md`: a separação vem de `gerarAcessoDaSalaNoBanco`, que já filtra por escola; a prova na vitrine é teste novo, e a tarefa futura que tocar `escola.int.test.ts` a aplica |
| `infra-guardian` (1ª) | `vitrine-foto.spec.ts`: no celular a onça é parada, `antes` pode ser `[]`, e a comparação não prova nada além da altura do recorte; afirmar que não há animação, ou deixar escrito | `TODO.md`, junto com a recomendação 4 do `test-engineer` (é a mesma) |
| `revisor-geral` (2ª) | `vitrine-foto.spec.ts:57`: o mapa de `estados()` mistura `playState` com `'infinita'`; função com nome próprio ou objeto `{ infinita, estado }` | `TODO.md`: legibilidade de teste que já passa e tem mutação provada; mexer nele caduca `test-engineer` e `revisor-geral` e pede rodada nova |
| `revisor-geral` (2ª) | `vitrine-foto.spec.ts:66-71`: a altura do PNG lida nos bytes 20 a 23; função `alturaDoPng` em `e2e/support/`, "se outro spec precisar dela" | Recusada: o próprio revisor a condiciona a um segundo uso, e hoje só este spec lê a altura do PNG |
| `test-engineer` (2ª) | As duas chamadas de `foto.ts` (`:251` e `:259`) não têm bloco de mutação; trocar `tirarAFoto` por `page.screenshot` não deixa nada vermelho; um caso de guarda afirmando que `foto.ts` não chama `page.screenshot` direto, com um bloco para cada chamada | `TODO.md`: guarda nova, em arquivo que a correção já tocou, mas que muda o conjunto de testes e as mutações do documento; o item de `--host-resolver-rules` e `--preencher` do TODO toca `foto.ts` e é onde ela entra |
| `test-engineer` (2ª) | `vitrine-foto.spec.ts:73`: conferir `estados()` logo depois de `tirarAFoto`, antes do `devicePixelRatio` e do `readFileSync` | `TODO.md`, junto com as outras do spec: encurta o intervalo entre a foto e a conferência, sem mudar o que o teste prova |
| `test-engineer` (2ª) | O e2e confere o estado das animações depois da foto, e não o pixel da onça no PNG | Recusada: o revisor a chama de "prova indireta, mas suficiente" |
| `test-engineer` (2ª) | No projeto `celular` o caso passa mesmo sem a opção; citar no documento que a primeira mutação só falha no `chromebook` | `TODO.md`, junto com a do `infra-guardian` acima |
| `test-engineer` (2ª) | `escola.ts:32`: o comentário de `DOMINIO_DO_PROVEDOR_SINTETICO` ainda diz que "a sala mostra 'Conta da escola confirmada'"; escrever "no e2e" | `TODO.md`: o item de `--preencher` toca `escola.ts` e é onde o comentário muda junto com o resumo |
| `frontend-reviewer` (2ª) | A foto da conta confirmada continua impossível pelo `foto`; o Validador fotografa o botão e a sala e usa o e2e `conta-da-escola-na-sala.spec.ts` como prova | Já está no `TODO.md` (o item novo desta correção) |
| `frontend-reviewer` (2ª) | "Não é a sua turma? Usar outro código" e "Entrar com a conta da escola" quebram em duas linhas no celular (`apps/web/src/pages/TurmaPublica.tsx`) | Já está no `TODO.md`; a correção não toca `apps/web` |
| `frontend-reviewer` (2ª) | Se o `foto` ganhar `--preencher`, o resumo precisa mudar junto | Já está no item de `--preencher` do `TODO.md` |
| `conformidade-reviewer` (2ª) | Fotografar a "Conta da escola confirmada" quando o `foto` ganhar `--host-resolver-rules` e `--preencher` | Já está no `TODO.md` |
| `privacy-guardian` (2ª) | O link da sala vale 7 dias e circula no resumo; fica "só para a retro" | Já coberto pelo item do `test-engineer` na 1ª rodada (o `mostrar` avisar quando o acesso vence), que foi para o `TODO.md` |
| `privacy-guardian` (2ª) | O e2e grava a escola sintética no banco de teste e não apaga | Recusada: segue o padrão dos outros specs, e o próprio revisor diz que não bloqueia; o portão recria o banco |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 10:54:29 | 2026-11-10 10:55:19 | `privacy-guardian` | 1 | APROVADO | a9266a9c3b90d0b19 |
| 2026-11-10 10:54:33 | 2026-11-10 10:55:24 | `conformidade-reviewer` | 1 | APROVADO | a0f866abcbed06ada |
| 2026-11-10 10:54:25 | 2026-11-10 10:56:54 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a5f8154005df0d7df |
| 2026-11-10 10:54:43 | 2026-11-10 10:57:02 | `revisor-geral` | 1 | REPROVADO | a1569ea85a73a822c |
| 2026-11-10 10:54:38 | 2026-11-10 10:57:51 | `test-engineer` | 1 | REPROVADO | a93cae96ef7ff86eb |
| 2026-11-10 11:25:10 | 2026-11-10 11:25:38 | `frontend-reviewer` | 2 | APROVADO | afd0582123df2a486 |
| 2026-11-10 11:25:27 | 2026-11-10 11:25:55 | `conformidade-reviewer` | 2 | APROVADO | ab580e5f8737b6d0f |
| 2026-11-10 11:25:19 | 2026-11-10 11:25:55 | `privacy-guardian` | 2 | APROVADO | af9ec23f3518e4b1b |
| 2026-11-10 11:25:34 | 2026-11-10 11:26:20 | `tenancy-guardian` | 1 | APROVADO | a6648695ca0368b14 |
| 2026-11-10 11:25:42 | 2026-11-10 11:26:38 | `infra-guardian` | 1 | APROVADO | a2e03a754e05b0bb2 |
| 2026-11-10 11:26:03 | 2026-11-10 11:26:41 | `revisor-geral` | 2 | APROVADO | ae827bd8890f58ee9 |
| 2026-11-10 11:25:54 | 2026-11-10 11:28:00 | `test-engineer` | 2 | APROVADO | a43e4885ee0ceb98d |
