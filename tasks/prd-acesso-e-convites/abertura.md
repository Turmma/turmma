# Abertura — acesso-e-convites (F2c)

Esta spec nasceu do corte do F2 em 03/11/2026 (Joaquim), com o PRD, a Tech Spec e os cenários já revisados lá
(`tasks/prd-onboarding-por-convite/revisao-spec.md`, rodadas 1 a 8; a rodada 9 conferiu o corte). Ela pousa **depois do
F2** e **antes da primeira escola real** (`ROADMAP.md`). Ao abrir o andar, o Arquiteto:

1. Confere o PRD, a Tech Spec e os cenários contra o código que o F2 deixou na `develop` (nomes de arquivo, o
   `fechar('encerrada')`, o `desativar`, os expurgos) e roda a `revisar-spec` sobre o que mudou, antes do `criar-tasks`.
2. Confere se a decisão do provedor de e-mail de produção (`docs/decisoes-em-aberto.md`, aberta no corte) já fechou: ela
   segura o portão desta spec.
3. Leva às tarefas as recomendações das rodadas 7 e 8 do F2 que ficaram com esta spec:
   - o aviso do diálogo do "Enviar convites" ("os links enviados ou copiados antes deixam de valer") é teste de tela,
     citado na tarefa da tela (`cenarios.md`, E2E);
   - o PRD RF11 já diz que enviar e reenviar refazem o token;
   - o `docs/lgpd.md` tem as linhas dos campos desta spec, marcadas `(F2c)`, escritas na revisão do F2.
4. Lista de tarefas: o rascunho do `test-engineer` para o F2 inteiro (03/11/2026) separou, nesta parte, a porta e o job
   de e-mail do endpoint "Enviar"; o gerar da provisória do login com bilhete e da troca; e pôs as telas de esqueci,
   verificar e conta da escola junto da API de cada uma.
