# Inventário — adenda 2 (X8)

Anexo do `inventario.md`, §5. **Status:** aprovada pelo Joaquim em 29/10/2026, no terminal do Arquiteto (RF2).

**De onde vem.** A revisão da spec, rodada 2 (`revisor-geral`), achou 94 declarações de topo de arquivo que a guarda do RF8
recusaria e que não estão em nenhum anexo. Elas seguem uma regra que o §1 do inventário já aprovou (`Linha<X>`,
`Opcoes<X>`, `Dependencias<X>`, `<X>EmMemoria`, `Adaptador<X>`, `esquema<X>`, `lerConfiguracao<X>`, `consulta<X>`),
mas as varreduras não as listaram. A lista saiu de um script que aplica a gramática da guarda (Tech Spec §5) à árvore de
hoje e tira o que os anexos já citam.

**Como o nome novo foi dado.** A regra do §1, sem o artigo (`LinhaDoMaterial` → `MaterialRow`). Quando o `<X>` é uma peça
que o inventário já renomeia, vale o nome novo dela (`DependenciasDoRebaixamento` → `EscolaIpThrottleDependencies`,
`OpcoesDoFlutuante` → `FloatingOptions`). `Ambiente` vira `Env`, como em `esquemaAmbienteDeIa` → `llmEnvSchema`.

**O que fica de fora, e por quê.** A guarda não recusa, e por isso esta adenda não lista:

- o componente de tela que começa com `Erro`, `Falha`, `Linha` ou `Filtro` (`ErroDaOperacao`, `LinhaDaTarefa`, `FiltroEmMenu`): é nome de produto (PRD §3);
- o tipo que começa com `Erro`, `Falha` ou `Filtro` sem ser classe (`FalhaDeMaterial`, `FiltroDeEstado`, `ErroDaLinhaDaLista`): é resultado ou filtro de domínio;
- `EntradaDoOperadorController`: "entrada" é a rota de login do operador, não a entrada de uma tarefa de IA;
- a constante `CHAVE_*` que não é chave do TanStack Query (`CHAVE_LOCK_MIGRACAO`, `CHAVE_V1`): constante de valor fica (§2);
- a declaração dentro de função ou de bloco (`ArmazemQueOlha`, num teste): variável local fica.

**Colisão.** `SessaoRow` (de `LinhaDeSessao`, num teste) e o `SessaoRow` do anexo do core não se encontram no mesmo
arquivo. Se o `aplicar` achar colisão no mesmo escopo, ele recusa (Tech Spec §5), e a linha ganha um nome distinto
numa adenda própria.

| Nome atual | Nome novo | Tipo | Caminho |
|---|---|---|---|
| `DependenciasDoLimiteDeIa` | `IaRequestRateLimitDependencies` | interface | `apps/api/src/assistente/limite-de-pedidos-de-ia.ts` |
| `esquemaAmbiente` | `envSchema` | const (zod) | `apps/api/src/config.ts` |
| `esquemaAmbienteLogin` | `loginEnvSchema` | const (zod) | `apps/api/src/credencial/configuracao-de-login.ts` |
| `EstadoEmMemoria` | `InMemoryLockoutState` | interface | `apps/api/src/credencial/contador-de-tentativas.ts` |
| `SeguroEmMemoria` | `InMemoryLockout` | classe | `apps/api/src/credencial/contador-de-tentativas.ts` |
| `esquemaClaims` | `claimsSchema` | const (zod) | `apps/api/src/credencial/desafio.ts` |
| `DependenciasDaConferencia` | `PasswordVerifierDependencies` | interface | `apps/api/src/credencial/senha/conferencia-na-vez.ts` |
| `EntradaEmMemoria` | `InMemoryWindowEntry` | interface | `apps/api/src/credencial/senha/contador-em-janela.ts` |
| `DependenciasDoLimiteDoEmail` | `EmailIpRateLimitDependencies` | interface | `apps/api/src/credencial/senha/limite-email-ip.ts` |
| `DependenciasDoRebaixamento` | `EscolaIpThrottleDependencies` | interface | `apps/api/src/credencial/senha/rebaixamento.ts` |
| `LinhaLida` | `ParsedRow` | interface | `apps/api/src/estrutura/lista/leitor-da-lista.ts` |
| `esquemaSemCorpo` | `emptyBodySchema` | const (zod) | `apps/api/src/operacao/painel/painel.controller.ts` |
| `LinhaDaEscola` | `EscolaRow` | interface | `apps/api/src/operacao/painel/painel.repository.ts` |
| `LinhaDoUso` | `UsoRow` | interface | `apps/api/src/operacao/painel/painel.repository.ts` |
| `esquemaAmbienteDoBanco` | `opsDatabaseEnvSchema` | const (zod) | `apps/api/src/ops/comando.ts` |
| `esquemaAmbienteOperador` | `operadorEnvSchema` | const (zod) | `apps/api/src/ops/comando.ts` |
| `esquemaArquivo` | `arquivoSchema` | const (zod) | `apps/api/src/ops/incidente.ts` |
| `esquemaSecao` | `secaoSchema` | const (zod) | `apps/api/src/ops/incidente.ts` |
| `esquemaTexto` | `textoSchema` | const (zod) | `apps/api/src/ops/incidente.ts` |
| `esquemaEmail` | `emailSchema` | const (zod) | `apps/api/src/ops/operador.ts` |
| `esquemaCategorias` | `categoriasSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaChave` | `chaveSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaContrato` | `contratoSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaEscolas` | `escolasSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaFinalidade` | `finalidadeSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaNomeDaEmpresa` | `nomeDaEmpresaSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaPais` | `paisSchema` | const (zod) | `apps/api/src/ops/suboperador.ts` |
| `esquemaDoArmazem` | `fileStorageSchema` | const (zod) | `apps/api/src/privacidade/configuracao-do-armazem.ts` |
| `lerConfiguracaoDoArmazem` | `loadFileStorageConfig` | função | `apps/api/src/privacidade/configuracao-do-armazem.ts` |
| `esquemaAmbienteSala` | `salaEnvSchema` | const (zod) | `apps/api/src/sala/configuracao-da-sala.ts` |
| `lerConfiguracaoSala` | `loadSalaConfig` | função | `apps/api/src/sala/configuracao-da-sala.ts` |
| `esquemaDoConteudo` | `conteudoSchema` | const (zod) | `apps/api/src/sessao/externa/cookie-oidc.ts` |
| `esquemaProvedor` | `provedorSchema` | const (zod) | `apps/api/src/sessao/externa/externa.controller.ts` |
| `esquemaSlugDigitado` | `slugDigitadoSchema` | const (zod) | `apps/api/src/sessao/externa/externa.controller.ts` |
| `LinhaDeSinal` | `SinalRow` | interface | `apps/api/src/tutor/tutor.int.test.ts` |
| `LinhaDoAcesso` | `AcessoRow` | interface | `apps/api/test/acesso-da-turma.int.test.ts` |
| `LinhaDaSecao` | `SecaoRow` | interface | `apps/api/test/incidente.int.test.ts` |
| `LinhaDeAuditoria` | `AuditoriaRow` | interface | `apps/api/test/material-de-teste.ts` |
| `LinhaDoMaterial` | `MaterialRow` | interface | `apps/api/test/material-de-teste.ts` |
| `LinhaDoTrecho` | `TrechoRow` | interface | `apps/api/test/material-de-teste.ts` |
| `LinhaDeProvedor` | `ProvedorRow` | interface | `apps/api/test/provedores-da-escola.int.test.ts` |
| `LinhaDoSuboperador` | `SuboperadorRow` | interface | `apps/api/test/suboperador.int.test.ts` |
| `LinhaDeSessao` | `SessaoRow` | interface | `apps/api/test/troca-de-escola.int.test.ts` |
| `LinhaDeVinculo` | `VinculoRow` | interface | `apps/api/test/virada-do-ano.int.test.ts` |
| `esquemaAutenticacao` | `autenticacaoSchema` | const (zod) | `apps/realtime/src/autenticacao-do-handshake.ts` |
| `consultaDoResumoDoEstado` | `resumoDoEstadoQueryOptions` | função (TanStack Query) | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` |
| `LinhaDaCategoria` | `CategoriaRow` | tipo | `apps/web/src/areas/coordenacao/privacidade/Retencao.tsx` |
| `LinhaDoPrazoFixo` | `PrazoFixoRow` | tipo | `apps/web/src/areas/coordenacao/privacidade/Retencao.tsx` |
| `OpcoesDaDescricao` | `DescricaoOptions` | interface | `apps/web/src/areas/professor/ferramentas/ferramentas.ts` |
| `LinhaDeAluno` | `AlunoRow` | interface | `apps/web/src/areas/professor/turmas/alunos-da-turma.ts` |
| `LinhaDoResumo` | `ResumoRow` | interface | `apps/web/src/componentes/meus-dados/regras.ts` |
| `OpcoesDoTexto` | `TextoOptions` | interface | `apps/web/src/componentes/ui/ia/aprovacao.ts` |
| `OpcoesDoDialogoModal` | `ModalDialogOptions` | interface | `apps/web/src/componentes/ui/sobrepostos/dialogo-modal.ts` |
| `OpcoesDoFlutuante` | `FloatingOptions` | interface | `apps/web/src/componentes/ui/sobrepostos/flutuante.ts` |
| `LinhaDaTipografia` | `TipografiaRow` | interface | `apps/web/src/estilos.test.ts` |
| `OpcoesComSessaoDeOperador` | `OperadorSessaoOptions` | tipo | `apps/web/src/operacao/api/sessao.ts` |
| `OpcoesDoReenvio` | `ReenvioOptions` | interface | `apps/web/src/paginas/reenvio-da-sala.ts` |
| `esquemaFilas` | `filasSchema` | const (zod) | `apps/worker/src/config.ts` |
| `esquemaStorage` | `storageSchema` | const (zod) | `apps/worker/src/config.ts` |
| `DependenciasDoApagarArquivos` | `ApagarArquivosDependencies` | interface | `apps/worker/src/processadores/expurgar-escola.ts` |
| `LinhaDeEfeito` | `EfeitoRow` | interface | `apps/worker/test/reexecucao.int.test.ts` |
| `OpcoesDoPasso` | `PassoOptions` | interface | `e2e/__fixtures__/segundo-fator.ts` |
| `LinhaDaAuditoriaDoPedido` | `AuditoriaDoPedidoRow` | interface | `e2e/__fixtures__/sessao.ts` |
| `esquemaEntidadeId` | `entidadeIdSchema` | const (zod) | `packages/nucleo/src/auditoria/registro-de-auditoria.ts` |
| `esquemaId` | `idSchema` | const (zod) | `packages/nucleo/src/ciclo-de-vida/ciclo-de-vida.service.ts` |
| `esquemaAmbienteJanela` | `windowEnvSchema` | const (zod) | `packages/nucleo/src/configuracao/configuracao-operacional.ts` |
| `esquemaAmbienteVagas` | `concurrencyLimitEnvSchema` | const (zod) | `packages/nucleo/src/configuracao/configuracao-operacional.ts` |
| `esquemaAmbienteBanco` | `databaseEnvSchema` | const (zod) | `packages/nucleo/src/db/banco.ts` |
| `LinhaDaMedicao` | `MedicaoRow` | tipo | `packages/nucleo/src/fila/despacho.repository.ts` |
| `OpcoesLidas` | `ParsedOptions` | interface | `packages/nucleo/src/fila/enfileirador.ts` |
| `esquemaAmostra` | `amostraSchema` | const (zod) | `packages/nucleo/src/ia/__fixtures__/ouro.ts` |
| `esquemaBase` | `baseSchema` | const (zod) | `packages/nucleo/src/ia/__fixtures__/ouro.ts` |
| `esquemaContagem` | `contagemSchema` | const (zod) | `packages/nucleo/src/ia/__fixtures__/ouro.ts` |
| `esquemaContexto` | `contextoSchema` | const (zod) | `packages/nucleo/src/ia/__fixtures__/ouro.ts` |
| `esquemaDasMedidas` | `medidasSchema` | const (zod) | `packages/nucleo/src/ia/__fixtures__/ouro.ts` |
| `esquemaDoCorpus` | `corpusSchema` | função (fábrica de zod) | `packages/nucleo/src/ia/__fixtures__/ouro.ts` |
| `esquemaDaResposta` | `respostaSchema` | const (zod) | `packages/nucleo/src/ia/adaptador-openai-compat.ts` |
| `esquemaDaSaidaEmJson` | `jsonOutputSchema` | função (fábrica de zod) | `packages/nucleo/src/ia/adaptador-openai-compat.ts` |
| `AdaptadorDeRoteiro` | `RoteiroAdapter` | classe | `packages/nucleo/src/ia/adaptador-resiliente.test.ts` |
| `LinhaEmMemoria` | `InMemoryRow` | interface | `packages/nucleo/src/ia/executor.ts` |
| `esquemaMemoriaDoTrabalho` | `memoriaDoTrabalhoSchema` | const (zod) | `packages/nucleo/src/ia/tarefas/turno-do-tutor.ts` |
| `esquemaQuestaoEmAndamento` | `questaoEmAndamentoSchema` | const (zod) | `packages/nucleo/src/ia/tarefas/turno-do-tutor.ts` |
| `OpcoesDeToken` | `TokenOptions` | interface | `packages/nucleo/src/identidade/token-de-operador.test.ts` |
| `esquemaClaimsDeOperador` | `claimsDeOperadorSchema` | const (zod) | `packages/nucleo/src/identidade/verificar-token.ts` |
| `esquemaAmbienteDrenagem` | `drainEnvSchema` | const (zod) | `packages/nucleo/src/instancia/drenagem.ts` |
| `OpcoesDoConsumo` | `ConsumoOptions` | tipo | `packages/nucleo/src/limite/limitador.ts` |
| `esquemaAmbienteLimite` | `rateLimitEnvSchema` | const (zod) | `packages/nucleo/src/limite/limitador.ts` |
| `esquemaAmbienteTelemetria` | `telemetryEnvSchema` | const (zod) | `packages/nucleo/src/telemetria/iniciar.ts` |
| `OpcoesDaEliminacao` | `EliminacaoOptions` | interface | `packages/nucleo/src/titular/eliminacao-do-titular.ts` |
| `LinhaDaPrevia` | `PreviaRow` | tipo | `packages/shared/src/estrutura/lista.ts` |
| `esquemaReferencia` | `referenciaSchema` | const (zod) | `packages/shared/src/estrutura/vinculo.ts` |
| `LinhaDoCompartilhamento` | `CompartilhamentoRow` | tipo | `packages/shared/src/privacidade/titular.ts` |
| `esquemaDoPedido` | `pedidoSchema` | const (zod) | `packages/shared/src/sistema/definicoes-de-job.ts` |
| `esquemaRecusaChaveAMais` | `strictSchema` | função (fábrica de zod) | `packages/shared/src/sistema/definicoes-de-job.ts` |
