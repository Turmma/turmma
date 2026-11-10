# Correção — o Verificar não leva mais a `/convite` sem token

**Origem:** triagem da 16.0 de acesso-e-convites (09/11/2026), decisão registrada no `TODO.md` (item "O que `/convite` sem token mostra a quem vem de 'Verificar'", da 8.0) e em `cenarios.md`, "Telas", linha Verificar.
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou: frontend-reviewer, privacy-guardian, test-engineer, revisor-geral. A Mesa devolveu a rodada: os arquivos são de apps/web e e2e/, que pedem os quatro guardiões (guardioes-por-caminho.ts), e acrescentou tenancy-guardian, conformidade-reviewer e infra-guardian. -->

## Sintoma

Quem confirma o e-mail em `/verificar#<token>` vê "Continuar" e, no link que não vale, "Abrir o convite": os dois levam a `/convite` **sem token**
(o token do convite só vive na aba que o abriu), e essa tela só diz "O endereço do convite está incompleto…" a quem acabou de fazer a coisa certa.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A 8.0 seguiu o `cenarios.md` da época ("Continuar" para o convite), e o revisor-geral apontou o beco sem saída (`TODO.md`). A triagem da 16.0
decidiu: o Verificar não tem link para `/convite`. Confirmado: "E-mail confirmado" e a orientação "Volte à aba do convite e aceite de novo; se a
fechou, abra o link do convite outra vez", sem "Continuar". Link que não vale: o aviso de hoje, sem o link "Abrir o convite" (o texto do aviso já
diz "abrindo o convite de novo"). Sem mudança de API, de rota nem de dado.

## Teste que reproduz

`apps/web/src/pages/VerificarEmail.test.tsx`: `e-mail confirmado: diz para voltar à aba do convite e não leva a /convite` e `link que não vale: o aviso diz a saída e não há
link para /convite`. Vermelho no `VerificarEmail.tsx` do HEAD (o `Continuar` e o `Abrir o convite` apareciam como link para `/convite`; 2 falhas em 4),
verde depois (4 em 4). O e2e (`e2e/verificar-email.spec.ts`) passa a afirmar a ausência de links em `main` nos três caminhos e a nova orientação.

## Correção

- `apps/web/src/pages/VerificarEmail.tsx`: tira o `Link` "Continuar" do estado confirmado (o texto de apoio vira a orientação nova) e o "Abrir o
  convite" do estado inválido; saem os imports de `Link`, `buttonVariants`, `SECONDARY_LINK_CLASSES` e `ROUTES`.
- `apps/web/src/pages/VerificarEmail.test.tsx` e `e2e/verificar-email.spec.ts`: os casos acima; o e2e perde o clique em "Continuar" e em "Abrir o
  convite" e os alvos de toque desses dois links (não há mais link a tocar); o aceite que segue depois de verificar continua como estava.
- `docs/interface.md` (seção "Verificar" da 8.0): o texto da tela nova. O `cenarios.md` já tinha sido ajustado pela triagem.

## Autoconferência

Não há dado pessoal novo, rota, tabela nem log: só a tela anônima perde dois links. O token continua saindo da barra antes de qualquer chamada e indo no corpo.
O e2e que cita os textos tirados ("Continuar", "Abrir o convite") é o `verificar-email.spec.ts`, atualizado aqui; `grep -rn "Abrir o convite" e2e/` só acha o dele.

## Mutações

--faltando: 0 linhas (6 blocos, 0 motivos)

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: apps/web/src/pages/VerificarEmail.test.tsx › e-mail confirmado: diz para voltar à aba do convite e não leva a `/convite`
falha: toHaveLength(0)
-        <p className="text-apoio">{VOLTE_AO_CONVITE}</p>
+        <p className="text-apoio">{VOLTE_AO_CONVITE}</p>
+        <a href="/convite">Continuar</a>
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: apps/web/src/pages/VerificarEmail.test.tsx › link que não vale: o aviso diz a saída e não há link para `/convite`
falha: toHaveLength(0)
         {LINK_DE_VERIFICAR_QUE_NAO_VALE}
-      </p>
+      </p>
+      <a href="/convite">Abrir o convite</a>
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: apps/web/src/pages/VerificarEmail.test.tsx › e-mail confirmado: diz para voltar à aba do convite e não leva a `/convite`
falha: getByText(VOLTE_AO_CONVITE)
-const VOLTE_AO_CONVITE = 'Volte à aba do convite e aceite de novo; se a fechou, abra o link do convite outra vez.'
+const VOLTE_AO_CONVITE = 'Volte ao convite e aceite de novo.'
```

Os três blocos do e2e (o que quebra se o link voltar no estado que não vale e no confirmado, e se a casca perder o `main`):

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link vencido, usado ou inventado: o mesmo aviso, sem link para `/convite`; sem token nem se tenta
falha: getByRole('link')).toHaveCount(0)
         {LINK_DE_VERIFICAR_QUE_NAO_VALE}
-      </p>
+      </p>
+      <a href="/convite">Abrir o convite</a>
```

```mutacao
arquivo: apps/web/src/components/CascaPublica.tsx
teste: e2e/verificar-email.spec.ts › link vencido, usado ou inventado: o mesmo aviso, sem link para `/convite`; sem token nem se tenta
falha: getByRole('main')).toBeVisible()
-        <main data-cartao-publico="" className="flex w-full max-w-md flex-col gap-6 lg:rounded-cartao lg:border-2 lg:border-borda lg:bg-superficie lg:p-8">
+        <div data-cartao-publico="" className="flex w-full max-w-md flex-col gap-6 lg:rounded-cartao lg:border-2 lg:border-borda lg:bg-superficie lg:p-8">
           <h1 className="t-titulo break-words">{titulo}</h1>
           {children}
-        </main>
+        </div>
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › verificar pelo Mailpit: "E-mail confirmado", o token fora da barra, a orientação de voltar ao convite sem link para `/convite`, e o aceite segue
falha: getByRole('link')).toHaveCount(0)
-        <p className="text-apoio">{VOLTE_AO_CONVITE}</p>
+        <p className="text-apoio">{VOLTE_AO_CONVITE}</p>
+        <a href="/convite">Continuar</a>
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | Na validação, observar se quem vem pelo link do e-mail entende "o link do convite" sem botão; se o piloto mostrar quem se perde, abrir canal que não dependa do token (e-mail do convite com a mesma instrução) | Observação para o Validador e para o piloto; sem código agora. Registrada no `TODO.md`, dono Arquiteto |
| frontend-reviewer (1ª) | Os dois testes de unidade afirmam `queryAllByRole('link')` vazio no documento inteiro; restringir a `main` seria mais estável se a `CascaPublica` ganhar link de rodapé | Recusada: o revisor-geral confirmou que `queryAllByRole('link')` vale hoje como prova (a casca não tem link), e a quebra por link novo de rodapé é vermelho visível, que se conserta no dia em que o link entrar. O e2e já restringe a `main` |
| privacy-guardian (1ª) | O estado inválido agora não tem ação; só o texto "abrindo o convite de novo" | Remetida pelo próprio revisor ao `frontend-reviewer`, e coberta pelo primeiro item desta tabela. A decisão de não ter link é da triagem da 16.0 (`cenarios.md`, "Telas", Verificar) |
| revisor-geral (1ª) | `VOLTE_AO_CONVITE` copiado em três lugares (componente, teste de unidade, e2e) | Recusada: o projeto escreve o texto esperado por extenso nos testes; o próprio revisor diz que está de acordo com a casa |
| infra-guardian (1ª) | Registro na retro: a tela deixa de mandar a pessoa a um beco sem saída; a carga às 10h não muda | Nada a fazer; a retro lê o registro da rodada em `achados/` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 10:32:19 | 2026-11-10 10:32:35 | `frontend-reviewer` | 1 | APROVADO | a1ce549738a5d4647 |
| 2026-11-10 10:32:23 | 2026-11-10 10:32:38 | `tenancy-guardian` | 1 | APROVADO | a71d63448a05175be |
| 2026-11-10 10:32:19 | 2026-11-10 10:32:43 | `privacy-guardian` | 1 | APROVADO | a4980ce1b0f25735d |
| 2026-11-10 10:32:25 | 2026-11-10 10:32:44 | `conformidade-reviewer` | 1 | APROVADO | aadcb1f7d0d50b836 |
| 2026-11-10 10:32:26 | 2026-11-10 10:32:44 | `infra-guardian` | 1 | APROVADO | a2bbbfd4fb5357e16 |
| 2026-11-10 10:32:22 | 2026-11-10 10:32:50 | `revisor-geral` | 1 | APROVADO | ade1f4642f41fe455 |
| 2026-11-10 10:32:20 | 2026-11-10 10:33:02 | `test-engineer` | 1 | APROVADO | a6b6fc415671ac284 |
| 2026-11-10 10:52:43 | 2026-11-10 10:53:37 | `revisor-geral` | 2 | REPROVADO | a7c64a83757364f1e |
| 2026-11-10 10:52:38 | 2026-11-10 10:53:53 | `test-engineer` | 2 | REPROVADO | a322066ed9ba83c34 |
| 2026-11-10 11:05:50 | 2026-11-10 11:06:11 | `test-engineer` | 3 | APROVADO | a1aa03f97c955625f |
| 2026-11-10 11:05:55 | 2026-11-10 11:06:15 | `revisor-geral` | 3 | APROVADO | af3179027d8676ea2 |
