# Correção — o toque no "Fechar" do painel do professor, no celular, cai onde o botão estava quando as turmas chegam

**Origem:** esteira run 44906515032 de `spec/camada-ia` (commit `5a907260`), caso `e2e/professores.spec.ts:388` no projeto `celular`, também na repetição (o `expect(locator).toHaveCount` de `fecharPainel`); o run 44915770834 passou.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os seis vêm do PEDIDO do Orquestrador (`test-engineer` é de toda correção). -->

## Sintoma

`W4 (Professores): os quatro estados › o convite vencido se refaz pelo painel; o erro depois de revogar mantém a lista; e a lista que não acaba para no teto`, só no `celular`, cai em `fecharPainel` (`e2e/professores.spec.ts:210`, chamado da linha 426), logo depois de refazer o convite vencido:

```
Locator:  locator('dialog[data-painel-lado][open]')
Expected: 0
Received: 1
```

O painel segue aberto: o toque no "Fechar" dele não fechou nada, e o Playwright não tem como saber. Passa isolado, 20 vezes seguidas, sem carga.

## Fora desta correção

Nada.

## Causa

De qual tarefa foi: o **caso** é da A1 (tarefa 14.0, tela Professores), e o que o faz falhar é da `acesso-e-convites`, tarefa 7.0 (`b8e425d0`): ela moveu a alocação para o painel do professor, e o painel de um professor **alocável** (convite em aberto, aceito ou ativo) lê as turmas e as disciplinas do ano em curso. O vencido não é alocável: o painel dele abre sem essas leituras.

O traço da esteira (`traco-do-e2e-11`, run 44906515032) mostra a sequência, em ms do relógio do traço:

1. 428231: o `POST` do refazer responde 201; o convite passa a `pendente`, que é alocável, e o painel passa a pedir as disciplinas e as turmas.
2. 429570: a resposta de `GET /v1/disciplinas` chega.
3. 430030 (quadro do screencast): o painel está em "Carregando as turmas…", com o "Fechar" a y≈369.
4. 430155: o caso toca o "Fechar".
5. 430231 (quadro seguinte): a folha já cresceu com o "Nenhuma turma." e o "Crie uma turma e uma disciplina primeiro", e o "Fechar" está a y≈237. Os dois textos saem do mesmo render (`PainelDoProfessor.tsx`, `turmasDoProfessor`, com as turmas e as disciplinas lidas); o traço citou o segundo, e o caso novo espera o primeiro.

No celular o painel é a **folha de baixo** (`Sheet`): colada ao pé da janela e com a altura do conteúdo, de modo que, quando o conteúdo cresce, o cabeçalho **sobe**. No computador o painel tem a altura da janela e o cabeçalho não se mexe, e é por isso que o `chromebook` não cai. Sob a CPU lenta do perfil na esteira, a renderização do que chegou demora depois da resposta, e o toque, despachado depois de o Playwright conferir que o botão estava parado, é processado depois do deslocamento: cai onde o botão estava. O caso só esperava o texto "Convite em aberto" no painel, que já aparece no mesmo quadro do "Carregando as turmas…". Não há falha na tela: a folha cresce com o que chega. O erro é do caso, que tocava o cabeçalho de uma folha que ainda ia crescer.

Não é "aumentar o timeout": o toque não é repetido pelo Playwright, e a espera maior não o faria cair no lugar certo.

## Teste que reproduz

`e2e/professores.spec.ts › W4 (Professores): os quatro estados › o "Fechar" do painel só é tocado com a folha assentada…` (caso novo, projetos `celular` e `chromebook`). Ele segura a resposta de `GET /v1/disciplinas` (o painel fica em "Carregando as turmas…"), mede o "Fechar", solta a resposta depois de 300 ms e mede o "Fechar" **logo ao sair de `esperarOPainelAssentar`**: o ponto onde o toque cairia tem de ser o ponto onde o botão fica (dois quadros depois, o mesmo). No celular afirma ainda que o botão subiu com a chegada das turmas, que é a premissa. Com `esperarOPainelAssentar` sem a espera, vermelho no `celular` e verde no `chromebook`:

```
Expected: 347
Received: 215
```

Determinístico: não depende de a resposta cair na janela do toque, porque o caso segura a resposta e mede o botão em vez de tocá-lo. O caso original, `:388`, não reproduz isolado (20 execuções verdes antes da correção, sem carga), e a evidência dele é o traço acima.

## Correção

`e2e/professores.spec.ts`:

- `esperarOPainelAssentar(page)`: espera que nenhum `status` "Carregando…" esteja no painel aberto. As turmas e as disciplinas aparecem no mesmo quadro da mudança de situação, de modo que o carregando já está na tela quando o caso viu o texto novo, e a espera só volta quando a folha cresceu por inteiro.
- `fecharPainel` chama a espera antes de tocar o "Fechar". Os 12 `await fecharPainel(` do arquivo passam por ela, entre eles o do caso `aberto pelo endereço, sem botão que o tenha aberto…`, que abre por `goto` o painel de um professor `pendente` (alocável, sem nada em cache) e tocava o "Fechar" direto, com `tocar(painel, 'Fechar', hasTouch)`: é o mesmo defeito, e a rodada 1 o pegou. O único toque no "Fechar" **do painel** que ficava fora de `fecharPainel` era esse; os de `noDialogo(page)` são do diálogo do convite. No computador, o custo da espera é o do carregando.
- O caso novo acima prova a espera. Da rodada 1: as medidas do "Fechar" afirmam `not.toBeNull()` antes de comparar (sem caixa, a comparação seria de -1 com -1 e passaria sem medir); a leitura segurada se solta num `finally`, e não só pelo `setTimeout` de 300 ms; e o comentário diz que a mutação só fica vermelha porque a primeira medida sai antes dos 300 ms.

Fora do alcance, de propósito: a folha crescer sob o dedo de quem toca depressa é do desenho do painel (`docs/interface.md` 9.3, folha de baixo com a altura do conteúdo), e não foi mexido aqui.

## Mutações

--faltando: 0 linhas (1 blocos, 0 motivos)

O bloco abaixo é a mutação da cláusula inteira, a espera: sem ela o caso novo fica vermelho no `celular`. As cláusulas da rodada 1 não têm bloco próprio, porque nenhuma pode ficar vermelha sozinha: a troca do toque do caso `aberto pelo endereço…` por `fecharPainel` usa a mesma espera (o bloco abaixo a tira) e o defeito que ela cobre depende de a resposta cair na janela do toque, que não se reproduz de forma determinística num caso que toca; o `not.toBeNull()` das medidas é pré-condição (o caso falha, em vez de passar vazio, se o "Fechar" não tiver caixa); o `finally` só solta a leitura que ficaria presa.

```mutacao
arquivo: e2e/professores.spec.ts
teste: e2e/professores.spec.ts › o "Fechar" do painel só é tocado com a folha assentada
projeto: celular
falha: toBe(aoAssentar)
 async function esperarOPainelAssentar(page: Page): Promise<void> {
-  await expect(paineisAbertos(page).getByRole('status').filter({ hasText: /^Carregando/ })).toHaveCount(0, { timeout: SIGN_IN_TIMEOUT_MS })
+  void page
 }
```

**Estabilidade:** com a correção, o caso original (`o convite vencido se refaz pelo painel…`) rodou sozinho 10 vezes seguidas em cada projeto, `celular` e `chromebook` (20 de 20), e o caso novo 10 vezes seguidas no `celular` (10 de 10), todos verdes. Antes da correção o caso original também passava isolado, sem carga (20 de 20): a evidência dele é o traço da esteira, e a do conserto é o caso novo, vermelho no `celular` sem a espera.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | `e2e/professores-envio.spec.ts:112-113` tem a sua própria cópia de `fecharPainel`, sem a espera, e `e2e/alocacao.spec.ts:72-73` e `:191` tocam o "Fechar" do painel direto: "Ou levar `esperarOPainelAssentar` para um apoio comum (`e2e/support/`) e usar nos três arquivos, ou registrar no documento que ficam fora e por quê." | Não aplicada nesta correção: três arquivos a mais e um apoio novo mudam o alcance (a correção é do caso `:388` e do arquivo `professores.spec.ts`), e nenhuma esteira falhou neles. Destino: linha no `TODO.md` ("o toque no Fechar do painel do professor sem esperar a folha assentar, em `professores-envio.spec.ts` e `alocacao.spec.ts`; levar `esperarOPainelAssentar` para `e2e/support/`"). |
| infra-guardian (1ª) | "A correção registra que a folha de baixo cresce sob o dedo de quem toca depressa (`docs/interface.md` 9.3) e que isso é do desenho do painel [...]. Isso deve ir para a retro, porque o professor de verdade no celular passa pelo mesmo deslocamento." | Destino: retro da camada-ia, e linha no `TODO.md` (a folha de baixo cresce sob o dedo no celular; decisão de desenho do painel, `docs/interface.md` 9.3). Mudar a tela é de produto, não desta correção. |

Da rodada 2:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | `e2e/professores.spec.ts`, comentário antes do `setTimeout`: "a frase sobre a mutação ficar vermelha só porque a primeira medida sai antes dos 300 ms explica como o teste foi validado. O lugar dela é o documento da correção, que já a traz, e não o código." | Não aplicada: o item 3 da ordem da rodada 1 (recomendação do test-engineer) pediu o comentário no código, e o revisor-geral aprovou sem reprovar. Destino: recusada, a frase fica como está. |
| test-engineer (2ª) | O documento cita o caso novo com "…" no fim; o título ficou curto, e o texto do documento deveria ser igual ao do caso. | Não aplicada: depois da primeira ordem só entra recomendação de revisor que reprovou na rodada, e o test-engineer aprovou. É retoque de texto, sem efeito no teste. Destino: recusada, com este motivo. |
| test-engineer (2ª) | `professores-envio.spec.ts` e `alocacao.spec.ts` continuam com o toque sem espera. | Já tem destino: `TODO.md` (linha da correção, 1ª rodada). |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 20:22:10 | 2026-11-21 20:22:24 | `infra-guardian` | 1 | APROVADO | a07275369e5316e62 |
| 2026-11-21 20:22:11 | 2026-11-21 20:22:28 | `tenancy-guardian` | 1 | APROVADO | a4ebd0574facedb50 |
| 2026-11-21 20:22:13 | 2026-11-21 20:22:29 | `conformidade-reviewer` | 1 | APROVADO | a014ba255f9a84db9 |
| 2026-11-21 20:22:12 | 2026-11-21 20:22:31 | `privacy-guardian` | 1 | APROVADO | a795ee352ba39e346 |
| 2026-11-21 20:22:09 | 2026-11-21 20:22:39 | `revisor-geral` | 1 | APROVADO | acd9ed13ca0acc02b |
| 2026-11-21 20:22:07 | 2026-11-21 20:23:56 | `test-engineer` | 1 | REPROVADO | a400abb7a04ac4d75 |
| 2026-11-21 21:30:08 | 2026-11-21 21:30:31 | `revisor-geral` | 2 | APROVADO | a77fb7699861f7289 |
| 2026-11-21 21:30:03 | 2026-11-21 21:30:46 | `test-engineer` | 2 | APROVADO | a0e588372b871c50a |
