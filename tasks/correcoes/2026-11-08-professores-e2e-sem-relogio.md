# Correção — dois casos de `professores.spec.ts` dependem de o relógio de parede não recuar entre o cadastro e o refazer

**Origem:** teste intermitente (dois dos uns 14 portões das correções `2026-11-08-*`: `e2e/professores.spec.ts:745` caiu duas vezes, no mesmo passo, com o teto de 90 s).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Ditados pelo PEDIDO do Orquestrador (`test-engineer` é de toda correção). A correção altera 2 arquivos fora de `tasks/` (`e2e/professores.spec.ts` e `e2e/support/seed.ts`) e o TODO.md; não toca `.github/`, `tools/ci/` nem `tools/processo/`. -->

## Sintoma

`e2e/professores.spec.ts:745` (`clique duplo › dois cliques em cadastrar…`), no Chromebook: `locator.click: Test timeout of 90000ms exceeded`, esperando `getByRole('dialog', { name: <o professor> }).getByRole('button', { name: 'Revogar convite' })`
(linha 829, o "Revogar" que vem depois do "Refazer"). O instantâneo da página no fim mostra o painel do professor com **"Convite revogado. Para convidar de novo, cadastre o mesmo e-mail."** e sem o botão: depois do Refazer, a lista
voltou a mostrar o convite velho, que o Refazer revogou.

## Fora desta correção

Os arquivos da tarefa 4.0 em curso (`apps/api/src/professores/professores.repository.ts` e `professores.service.ts`, `apps/api/test/convites-enviar.int.test.ts` e `professores.int.test.ts`, `apps/web/src/areas/coordenacao/*`, `docs/interface.md`,
`docs/roteiro-da-demonstracao.md`, `packages/shared/src/professores/`, `tasks/prd-acesso-e-convites/`, `e2e/professores-envio.spec.ts`), com os trechos da 4.0 que estão em `e2e/professores.spec.ts` (o import de `definirOEnvioDoConvite`, o caso `segunda pessoa…` e os `Enviado em`) e em
`e2e/support/seed.ts` (as funções do envio), e os das correções `2026-11-08-fila-de-carga-sem-relogio` e `2026-11-08-segundo-fator-na-casca` (`tools/ci/`, `e2e/support/casca.ts`, `e2e/mfa.spec.ts`). Ficam na árvore, fora da revisão e do commit desta.
**Também fora:** a escolha do último convite por `desc(expira_em), desc(id)` no repository, que é a origem de a lista depender do relógio. Muda código de produto e a regra do "último convite" em três lugares; vai ao `TODO.md` para o Arquiteto.

## Causa

`professores.repository.ts` escolhe o último convite do professor por `orderBy(asc(usuarioId), desc(expiraEm), desc(id))`. A validade do convite novo (`expira_em = agora + 7 dias`) vem do relógio de parede de quem o cria, e o da máquina de desenvolvimento recua de 0,8 a 2 s a cada uns 15 s
(`timesyncd`; já visto nas correções vizinhas). Quando o recuo cai entre o cadastro pela tela e o "Refazer" feito poucos segundos depois, o convite **novo** sai com a validade **menor** que a do velho (o que o Refazer acabou de revogar), e a lista, o painel e as ações passam a mostrar o
velho: "Convite revogado", sem "Revogar convite". O `id` v7 não desempata, porque segue o mesmo relógio e só vale quando as validades empatam.

Casos afetados são os que **cadastram pela tela (ou pela planilha) e refazem logo depois**: `:745` (clique duplo) e `:1331` (o cadastrado pela planilha). O `W14` (`:457`) cadastra pela tela e refaz também, mas depois de copiar, fechar, ler o painel e rodar a checagem de acessibilidade do diálogo, uns segundos depois, mais do que os 2 s de recuo visto; ele já tem `test.slow()` e passa de 45 s sob carga, e o ajudante nele fez o portão recusá-lo pela duração (46,7 s e 47,3 s, limite 45 s). Por isso ele fica de fora, pelo mesmo critério dos que semeiam pelo banco, e a ordem por `expiraEm` que o `TODO.md` leva ao Arquiteto cobre o que sobra. Os que semeiam o professor pelo banco (`convidarProfessorNoBanco`, `:853`, `:971`, `:1018`, `:1050`, `:1077`) refazem uns 8 s ou mais depois da semeadura, e o recuo máximo
visto é de 2 s. A 4.0 já tinha achado o mesmo na semeadura do envio (`definirOEnvioDoConvite`, que recua a validade uma hora pelo mesmo motivo).

## Teste que reproduz

O próprio `:745`, com o recuo do relógio simulado de forma determinística: logo depois do cadastro, a validade do convite existente avança uma hora (é o que um relógio que recuou faz ao convite novo, visto do lado dele). Vermelho antes do ajuste, nos mesmos termos do relato:
`locator.click: Test timeout …`, esperando "Revogar convite" no painel, e a página termina com "Convite revogado" (3 ocorrências no instantâneo). Com a validade do convite velho recuada uma hora, que é a correção, o caso passa; recuo de uma hora é muito mais do que o relógio da máquina dá.

## Correção

- `e2e/support/seed.ts`: `anteciparOsConvitesDaPessoa(escolaId, nome)`, que recua uma hora a validade dos convites de professor da pessoa (pelo nome, na escola).
- `e2e/professores.spec.ts`: o ajudante entra nos dois casos que cadastram pela tela ou pela planilha e refazem logo depois: `:745` (depois do cadastro e antes de fechar) e `:1331` (depois de abrir o painel do cadastrado).
  Os casos de `:853`, `:971` e os que semeiam pelo banco ficam como estavam.

**O que continua provado:** o que cada caso afirma segue igual; o ajudante só ordena os convites da pessoa para o "último" ser o que o Refazer criou. A regra do repository (o de validade maior é o último) não muda, nem o produto.

## Mutações

**Sem mutação:** a correção altera só código de teste (`e2e/professores.spec.ts` e `e2e/support/seed.ts`); nenhuma linha de `apps/*/src` nem de `packages/*/src` é minha. O ajudante falha se não achar a pessoa (cláusula de código de teste): a prova é o caso que o usa, que cairia alto no lugar de passar sem efeito. O código de produto que o portão acha na árvore (`apps/api/src/professores/`, `apps/web/src/areas/coordenacao/professores/`, `packages/shared/src/professores/`) é da tarefa 4.0 em curso.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), conformidade-reviewer (1ª), privacy-guardian (1ª) | Filtrar por `usuario_id` em vez de por nome, para não pegar um homônimo da mesma escola | Recusada: os dois casos cadastram pela tela e pela planilha e não têm o `usuario_id` sem uma consulta a mais; os nomes levam sufixo aleatório. O ajudante falha alto se o nome não bater |
| infra-guardian (1ª) | O `W14` (`:457`) segue sem o ajudante e depende de o Refazer vir mais de 2 s depois do cadastro | Sem ação: está escrito na "Causa" do documento e na entrada do `TODO.md`, com o critério de ficar de fora |
| test-engineer (1ª), tenancy-guardian (1ª), privacy-guardian (1ª) | Teste de integração com o relógio recuando entre os dois convites, e teste de isolamento da ordem nova | `TODO.md`, na entrada do repository (dono: Arquiteto): é teste da regra de produto que só existe depois da decisão |

## Estabilidade

Os dois casos (`:745` e `:1331`), com 4 trabalhadores e a máquina disputada por outra linha (load average de 10 a 23), 6 repetições nos dois projetos: 24 de 24 (medida com o ajudante também no `W14`, 36 de 36; o `W14` não carrega mais o ajudante).

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 09:53:01 | 2026-11-08 09:53:17 | `tenancy-guardian` | 1 | APROVADO | a0a176ff689e60922 |
| 2026-11-08 09:53:04 | 2026-11-08 09:53:27 | `conformidade-reviewer` | 1 | APROVADO | ad862dc6d44989535 |
| 2026-11-08 09:52:57 | 2026-11-08 09:53:26 | `revisor-geral` | 1 | APROVADO | a803325de12ac6bcd |
| 2026-11-08 09:53:01 | 2026-11-08 09:53:30 | `privacy-guardian` | 1 | APROVADO | aa3b7a5215f5ca445 |
| 2026-11-08 09:53:07 | 2026-11-08 09:53:36 | `infra-guardian` | 1 | APROVADO | af5676e06d42ae85a |
| 2026-11-08 09:52:54 | 2026-11-08 09:53:44 | `test-engineer` | 1 | APROVADO | a1c61bea9e538a187 |
| 2026-11-08 10:05:39 | 2026-11-08 10:06:01 | `revisor-geral` | 2 | APROVADO | afe3871c42fd88d9c |
| 2026-11-08 10:05:34 | 2026-11-08 10:06:02 | `test-engineer` | 2 | APROVADO | ae43d45ec47c1e6a5 |
