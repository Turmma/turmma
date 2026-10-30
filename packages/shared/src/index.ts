export { ErrorCode } from './errors/error-code.js'
export type { ErrorResponse } from './errors/error-code.js'
export { InvariantException } from './errors/invariant.exception.js'
export {
  avisoDoSegundoFatorConsumido,
  AVISO_DA_TROCA_RECUSADA,
  AVISO_DO_CONVITE_COM_SENHA_NOVA,
  AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE,
  AVISO_DO_SEGUNDO_FATOR_CONSUMIDO,
  formatarEspera,
  MENSAGENS_DA_ENTRADA,
  MENSAGENS_DE_ERRO,
  mensagemDaEntrada,
  mensagemDaEntradaPorMatricula,
  mensagemDaFalhaExterna,
  mensagemDoAcessoDaEscola,
  mensagemDoConvite,
  mensagemDoSegundoFator,
} from './errors/messages.js'
export { ALCANCES, ALCANCES_INDIVIDUAIS, alcanceDe, MATRIZ, PAPEIS, PAPEIS_DE_USUARIO, RECURSOS } from './permissao/matriz.js'
export type { AcaoDe, Alcance, Papel, PapelDeUsuario, Recurso } from './permissao/matriz.js'
export type { HealthResponse } from './system/health.js'
export { contextResponseSchema } from './system/context.js'
export type { ContextResponse } from './system/context.js'
export type { ReadinessResponse } from './system/readiness.js'
export { SYSTEM_ENVIRONMENTS, SYSTEM_COMPONENTS, systemStatusResponseSchema, COMPONENT_STATUSES } from './system/status.js'
export type { SystemComponent, SystemStatusResponse } from './system/status.js'
export { avisoSchema, avisosResponseSchema, MAXIMO_DE_AVISOS } from './system/avisos.js'
export type { Aviso, AvisosResponse } from './system/avisos.js'
export { JOB_FAILURE_CODES, JobFailureCode, JOB_STATES, QUEUE_NAMES } from './system/jobs.js'
export type { JobState, QueueName } from './system/jobs.js'
export {
  JOB_DEFINITIONS,
  defineJob,
  TIPO_CONSOLIDAR_USO,
  TIPO_ELIMINAR_TITULAR,
  TIPO_EXPURGAR_ACESSO,
  TIPO_EXPURGAR_DADO_PESSOAL,
  TIPO_EXPURGAR_ESCOLA,
  TIPO_EXPURGAR_JOBS,
  TIPO_JOB_SINTETICO,
  TIPO_MONTAR_ARQUIVO,
} from './system/job-definitions.js'
export type {
  JobData,
  ParsedJobData,
  JobDefinition,
  JobScope,
  JobDataSchema,
  JobExecutor,
  JobOptions,
  JobRegistry,
  JobRetry,
  JobType,
} from './system/job-definitions.js'
export {
  CPU_MS_MAXIMO_SINTETICO,
  syntheticJobDataSchema,
  syntheticJobRequestSchema,
  jobStateResponseSchema,
  jobAcceptedResponseSchema,
} from './system/synthetic-jobs.js'
export type { SyntheticJobData, SyntheticJobRequest, JobStateResponse, JobAcceptedResponse } from './system/synthetic-jobs.js'
export {
  REALTIME_PATH,
  SYSTEM_REALTIME_NAMESPACE,
  realtimeClientOptions,
  REALTIME_RECONNECTION,
} from './system/realtime.js'
export type { RealtimeAuth, RealtimeClientOptions } from './system/realtime.js'
export {
  loginEmailRequestSchema,
  loginResponseSchema,
  ETAPAS_COM_DESAFIO,
  ETAPAS_DE_LOGIN,
  TAMANHO_MAXIMO_EMAIL,
  TAMANHO_MAXIMO_SENHA,
} from './sessao/login.js'
export type { EtapaComDesafio, EtapaDeLogin, LoginEmailRequest, LoginResponse } from './sessao/login.js'
export {
  aceitarConviteRequestSchema,
  consultarConviteRequestSchema,
  aceitarConviteResponseSchema,
  consultarConviteResponseSchema,
  TAMANHO_MAXIMO_TOKEN_DE_CONVITE,
  TAMANHO_MINIMO_SENHA_NOVA,
  TIPOS_DE_CONVITE,
  VALIDADE_DO_CONVITE_HORAS,
  VALIDADE_DO_CONVITE_HORAS_POR_TIPO,
} from './sessao/convite.js'
export type { AceitarConviteRequest, ConsultarConviteRequest, AceitarConviteResponse, ConsultarConviteResponse, TipoDeConvite } from './sessao/convite.js'
export { loginMatriculaRequestSchema, TAMANHO_MAXIMO_MATRICULA, TAMANHO_MAXIMO_SLUG_NO_LOGIN } from './sessao/matricula.js'
export type { LoginMatriculaRequest } from './sessao/matricula.js'
export { acessoDaEscolaResponseSchema, PROVEDORES_DE_CONTA_DA_ESCOLA } from './sessao/acesso-da-escola.js'
export type { ProvedorDeContaDaEscola, AcessoDaEscolaResponse } from './sessao/acesso-da-escola.js'
export { FALHAS_DO_LOGIN_EXTERNO, PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO } from './sessao/externa.js'
export type { FalhaDoLoginExterno } from './sessao/externa.js'
export {
  provedoresDaEscolaRequestSchema,
  provedorDaEscolaSchema,
  provedoresDaEscolaResponseSchema,
  MAXIMO_DE_PROVEDORES_DA_ESCOLA,
  TENANT_DE_CONTA_PESSOAL_MICROSOFT,
} from './estrutura/provedores.js'
export type { ProvedoresDaEscolaRequest, ProvedorDaEscola, ProvedoresDaEscolaResponse } from './estrutura/provedores.js'
export { acessoDaContaSchema, euResponseSchema, introducaoResponseSchema } from './sessao/eu.js'
export type { AcessoDaConta, EuResponse, IntroducaoResponse } from './sessao/eu.js'
export { trocaDeEscolaRequestSchema } from './sessao/troca-de-escola.js'
export type { TrocaDeEscolaRequest } from './sessao/troca-de-escola.js'
export { renovacaoResponseSchema, JANELA_DE_RENOVACAO_SIMULTANEA_MS } from './sessao/renovacao.js'
export type { RenovacaoResponse } from './sessao/renovacao.js'
export { escolaSessaoRequestSchema, escolaSessaoResponseSchema, INATIVIDADE_MAXIMA_MIN, INATIVIDADE_MINIMA_MIN } from './sessao/escola-sessao.js'
export type { EscolaSessaoRequest, EscolaSessaoResponse } from './sessao/escola-sessao.js'
export {
  ALFABETO_DO_CODIGO_DE_RECUPERACAO,
  DIGITOS_DO_CODIGO_MFA,
  ativarMfaRequestSchema,
  mfaRequestSchema,
  redefinirMfaRequestSchema,
  ativarMfaResponseSchema,
  configurarMfaResponseSchema,
  FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR,
  FINALIDADES_DA_REDEFINICAO_DE_MFA,
  QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO,
  TAMANHO_DO_CODIGO_DE_RECUPERACAO,
} from './sessao/mfa.js'
export type { FinalidadeDaRedefinicaoDeMfa, AtivarMfaRequest, MfaRequest, RedefinirMfaRequest, AtivarMfaResponse, ConfigurarMfaResponse } from './sessao/mfa.js'
export { paginationQuerySchema, pageSchema, TAMANHO_MAXIMO_DA_PAGINA, TAMANHO_PADRAO_DA_PAGINA } from './estrutura/pagination.js'
export type { PaginationQuery } from './estrutura/pagination.js'
export {
  anoLetivoSchema,
  criarAnoLetivoRequestSchema,
  anoLetivoResponseSchema,
  listaDeAnosLetivosResponseSchema,
  fimCaiAteOAnoSeguinte,
  fimDepoisDoInicio,
  inicioCaiNoAnoLetivo,
  MAIOR_ANO_LETIVO,
  MENOR_ANO_LETIVO,
  SITUACOES_DO_ANO_LETIVO,
} from './estrutura/ano-letivo.js'
export type { AnoLetivo, CriarAnoLetivoRequest, AnoLetivoResponse, ListaDeAnosLetivosResponse, SituacaoDoAnoLetivo } from './estrutura/ano-letivo.js'
export { ANOS_DA_ETAPA, criarSerieRequestSchema, listaDeSeriesResponseSchema, serieResponseSchema, serieSchema, ETAPAS, nomeDaSerie } from './estrutura/serie.js'
export type { Etapa, CriarSerieRequest, ListaDeSeriesResponse, SerieResponse, Serie } from './estrutura/serie.js'
export {
  AREAS_DO_CONHECIMENTO,
  disciplinaSchema,
  criarDisciplinaRequestSchema,
  renomearDisciplinaRequestSchema,
  disciplinaResponseSchema,
  listaDeDisciplinasResponseSchema,
  TAMANHO_MAXIMO_NOME_DISCIPLINA,
} from './estrutura/disciplina.js'
export type {
  AreaDoConhecimento,
  Disciplina,
  CriarDisciplinaRequest,
  RenomearDisciplinaRequest,
  DisciplinaResponse,
  ListaDeDisciplinasResponse,
} from './estrutura/disciplina.js'
export {
  alunoDaTurmaSchema,
  alunosDaTurmaQuerySchema,
  turmaQuerySchema,
  criarTurmaRequestSchema,
  renomearTurmaRequestSchema,
  alunosDaTurmaResponseSchema,
  listaDeTurmasResponseSchema,
  turmaResponseSchema,
  turmaAbertaResponseSchema,
  turmaSchema,
  FINALIDADES_DA_LEITURA_DE_ALUNOS,
  TAMANHO_MAXIMO_NOME_TURMA,
  TURNOS,
} from './estrutura/turma.js'
export type {
  AlunoDaTurma,
  AlunosDaTurmaQuery,
  TurmaQuery,
  FinalidadeDaLeituraDeAlunos,
  CriarTurmaRequest,
  RenomearTurmaRequest,
  AlunosDaTurmaResponse,
  ListaDeTurmasResponse,
  TurmaResponse,
  TurmaAbertaResponse,
  Turma,
  Turno,
} from './estrutura/turma.js'
export {
  ERROS_DA_LINHA_DA_LISTA,
  ESTADOS_DO_NOME_DA_LISTA,
  listaDaTurmaQuerySchema,
  linhaDaPreviaSchema,
  matriculaDigitadaSchema,
  nomeDaListaSchema,
  nomeAvulsoRequestSchema,
  textoDaListaRequestSchema,
  gravacaoDaListaResponseSchema,
  listaDaTurmaResponseSchema,
  previaDaListaResponseSchema,
  MAXIMO_DE_BYTES_DA_LISTA,
  MAXIMO_DE_LINHAS_DA_LISTA,
  RESULTADOS_DA_LINHA_DA_LISTA,
} from './estrutura/lista.js'
export { matriculasQueParecemDocumento, pareceCpfSemPontuacao, pareceDocumento } from './estrutura/documento-na-matricula.js'
export type {
  ListaDaTurmaQuery,
  ErroDaLinhaDaLista,
  EstadoDoNomeDaLista,
  PreviaRow,
  NomeDaLista,
  NomeAvulsoRequest,
  TextoDaListaRequest,
  GravacaoDaListaResponse,
  ListaDaTurmaResponse,
  PreviaDaListaResponse,
  ResultadoDaLinhaDaLista,
} from './estrutura/lista.js'
export {
  AVISO_DO_COMPLEMENTO,
  CONTESTACOES_DE_VINCULO,
  EFEITO_DA_CONTESTACAO,
  ESTADOS_DE_VINCULO,
  ESTADOS_EM_DECISAO,
  vinculosQuerySchema,
  contestarVinculoRequestSchema,
  criarVinculoRequestSchema,
  encerrarVinculoRequestSchema,
  listaDeVinculosResponseSchema,
  meusVinculosResponseSchema,
  vinculoResponseSchema,
  vinculoDaCoordenacaoResponseSchema,
  vinculoSchema,
  vinculoDaCoordenacaoSchema,
  MOTIVOS_DE_ENCERRAMENTO_DE_VINCULO,
  MOTIVOS_DE_ENCERRAMENTO_PELA_COORDENACAO,
  NOME_DA_CONTESTACAO,
  NOME_DO_ESTADO_DE_VINCULO,
  PAPEIS_DE_VINCULO,
  PAPEIS_DE_VINCULO_PELA_COORDENACAO,
  TAMANHO_MAXIMO_DO_COMPLEMENTO,
} from './estrutura/vinculo.js'
export type {
  VinculosQuery,
  ContestacaoDeVinculo,
  EstadoDeVinculo,
  MotivoDeEncerramentoDeVinculo,
  PapelDeVinculo,
  ContestarVinculoRequest,
  CriarVinculoRequest,
  EncerrarVinculoRequest,
  ListaDeVinculosResponse,
  MeusVinculosResponse,
  VinculoResponse,
  VinculoDaCoordenacaoResponse,
  Vinculo,
  VinculoDaCoordenacao,
} from './estrutura/vinculo.js'
export { euDoOperadorResponseSchema, FORMATO_OPERADOR } from './operacao/eu.js'
export {
  emailConvidadoSchema,
  idDoPedidoSchema,
  nomeDigitadoSchema,
  conviteDaCoordenacaoRequestSchema,
  criarEscolaRequestSchema,
  criarRedeRequestSchema,
  redeDoPainelSchema,
  conviteDaCoordenacaoResponseSchema,
  criadoNoPainelResponseSchema,
  escolasDoPainelResponseSchema,
  redesDoPainelResponseSchema,
  usoDoPainelResponseSchema,
  slugDaEscolaSchema,
  painelQuerySchema,
  escolaDoPainelSchema,
  usoDaEscolaDoPainelSchema,
  usoDoPeriodoDoPainelSchema,
  ESCOLAS_POR_PAGINA,
  ESTADOS_DA_COORDENACAO,
  GERAR_CONVITE_POR_ESTADO,
  MAXIMA_PAGINA_DO_PAINEL,
  MAXIMO_DE_REDES_DO_PAINEL,
  ORDENS_DO_PAINEL,
  REFAZER_CONVITE_POR_ESTADO,
  REVOGAR_CONVITE_POR_ESTADO,
  TAMANHO_MAXIMO_NOME_DIGITADO,
} from './operacao/painel.js'
export type {
  PainelQuery,
  EscolaDoPainel,
  EstadoDaCoordenacao,
  OrdemDoPainel,
  ConviteDaCoordenacaoRequest,
  CriarEscolaRequest,
  CriarRedeRequest,
  RedeDoPainel,
  ConviteDaCoordenacaoResponse,
  CriadoNoPainelResponse,
  EscolasDoPainelResponse,
  RedesDoPainelResponse,
  UsoDoPainelResponse,
  UsoDaEscolaDoPainel,
  UsoDoPeriodoDoPainel,
} from './operacao/painel.js'
export {
  cadastrarProfessorRequestSchema,
  conviteDeProfessorEmptyBodyRequestSchema,
  professorDaEscolaSchema,
  conviteDeProfessorResponseSchema,
  listaDeProfessoresResponseSchema,
  ESTADOS_DO_PROFESSOR,
  ESTADOS_DO_PROFESSOR_ALOCAVEIS,
  REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO,
  REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO,
} from './professores/professores.js'
export type { EstadoDoProfessor, CadastrarProfessorRequest, ProfessorDaEscola, ConviteDeProfessorResponse, ListaDeProfessoresResponse } from './professores/professores.js'
export {
  ALFABETO_DO_CODIGO_DA_TURMA,
  codigoDaTurmaValido,
  gerarAcessoRequestSchema,
  revogarAcessoRequestSchema,
  acessoDaTurmaResponseSchema,
  acessoGeradoResponseSchema,
  exibirCodigoDaTurma,
  normalizarCodigoDaTurma,
  TAMANHO_DO_CODIGO_DA_TURMA,
  VALIDADES_DO_ACESSO_DIAS,
} from './sala/acesso.js'
export type { GerarAcessoRequest, AcessoDaTurmaResponse, AcessoGeradoResponse, ValidadeDoAcessoDias } from './sala/acesso.js'
export {
  DECISORES_DA_REIVINDICACAO,
  abrirSalaRequestSchema,
  reivindicarSalaRequestSchema,
  reivindicacaoResponseSchema,
  salaAbertaResponseSchema,
  ESTADOS_DA_REIVINDICACAO,
  MAXIMO_DE_NOMES_NA_SALA,
  TAMANHO_MAXIMO_CODIGO_DIGITADO,
} from './sala/salas.js'
export type { DecisorDaReivindicacao, EstadoDaReivindicacao, AbrirSalaRequest, ReivindicarSalaRequest, ReivindicacaoResponse, SalaAbertaResponse } from './sala/salas.js'
export { MENSAGENS_DA_SALA, mensagemDaSala, mensagemDoLimiteDaSala, minutosDaEspera } from './sala/mensagens-da-sala.js'
export type { CaminhoDaSala } from './sala/mensagens-da-sala.js'
export {
  DECISOES_DE_PEDIDO,
  pedidosDaTurmaQuerySchema,
  pedidoDaTurmaSchema,
  decidirReivindicacoesRequestSchema,
  decisaoResponseSchema,
  pedidosDaTurmaResponseSchema,
  MAXIMO_DE_PEDIDOS_POR_DECISAO,
  RESULTADOS_DA_DECISAO,
} from './sala/pedidos.js'
export type {
  PedidosDaTurmaQuery,
  DecisaoDePedido,
  PedidoDaTurma,
  DecidirReivindicacoesRequest,
  DecisaoResponse,
  PedidosDaTurmaResponse,
  ResultadoDaDecisao,
} from './sala/pedidos.js'
export { minhaTurmaResponseSchema } from './sala/minha-turma.js'
export type { MinhaTurmaResponse } from './sala/minha-turma.js'
export { FORMATO_SLUG, TAMANHO_MAXIMO_SLUG, TIPOS_DE_REDE } from './estrutura/rede-e-escola.js'
export type { TipoDeRede } from './estrutura/rede-e-escola.js'
export type { EuDoOperadorResponse } from './operacao/eu.js'
export {
  aceitarConviteDeOperadorRequestSchema,
  consultarConviteDeOperadorRequestSchema,
  aceitarConviteDeOperadorResponseSchema,
  consultarConviteDeOperadorResponseSchema,
} from './operacao/convite.js'
export { entradaDeOperadorRequestSchema, entradaDeOperadorResponseSchema } from './operacao/entrada.js'
export { operadorEmptyBodyRequestSchema, renovacaoDeOperadorResponseSchema } from './operacao/sessao.js'
export type { OperadorEmptyBodyRequest, RenovacaoDeOperadorResponse } from './operacao/sessao.js'
export {
  configurarSegundoFatorDeOperadorRequestSchema,
  segundoFatorDeOperadorRequestSchema,
  configurarSegundoFatorDeOperadorResponseSchema,
  segundoFatorDeOperadorResponseSchema,
} from './operacao/segundo-fator.js'
export type {
  ConfigurarSegundoFatorDeOperadorRequest,
  SegundoFatorDeOperadorRequest,
  ConfigurarSegundoFatorDeOperadorResponse,
  SegundoFatorDeOperadorResponse,
} from './operacao/segundo-fator.js'
export type { EntradaDeOperadorRequest, EntradaDeOperadorResponse } from './operacao/entrada.js'
export type {
  AceitarConviteDeOperadorRequest,
  ConsultarConviteDeOperadorRequest,
  AceitarConviteDeOperadorResponse,
  ConsultarConviteDeOperadorResponse,
} from './operacao/convite.js'
export { AGENTES, CHAVES_DE_FUNCAO, ehChaveDeFuncao, FUNCOES, NIVEIS_DE_AUTONOMIA, NOMES_DOS_AGENTES } from './time/funcoes.js'
export type { Agente, ChaveDeFuncao, DeclaracaoDeFuncao, NivelDeAutonomia } from './time/funcoes.js'
export {
  ALTERNATIVAS_POR_QUESTAO,
  adaptacaoAplicadaSchema,
  citacaoSchema,
  conteudoDeAtividadeSchema,
  conteudoDePlanoDeAulaSchema,
  conteudoDoArtefatoSchema,
  habilidadeSchema,
  questaoObjetivaSchema,
  FERRAMENTAS,
  ROTULOS_DA_ADAPTACAO,
  TIPOS_DE_ADAPTACAO,
  TIPOS_DE_ARTEFATO,
} from './assistente/conteudo.js'
export type {
  AdaptacaoAplicada,
  Citacao,
  ConteudoDeAtividade,
  ConteudoDePlanoDeAula,
  ConteudoDoArtefato,
  Ferramenta,
  Habilidade,
  QuestaoObjetiva,
  TipoDeAdaptacao,
  TipoDeArtefato,
} from './assistente/conteudo.js'
export {
  idempotencyKeySchema,
} from './time/idempotency-key.js'
export {
  agenteDoTimeSchema,
  chaveDeFuncaoSchema,
  funcaoDoTimeSchema,
  timeResponseSchema,
  montarTime,
} from './time/time.js'
export type {
  AgenteDoTime,
  FuncaoDoTime,
  TimeResponse,
} from './time/time.js'
export {
  execucaoInputSchema,
  execucaoResponseSchema,
  execucaoAceitaResponseSchema,
  resultadoDaExecucaoSchema,
  resultadoGravadoSchema,
  ESTADOS_DE_CONSUMO_DE_IA,
  ESTADOS_DE_EXECUCAO,
  ESTADOS_FINAIS_DE_EXECUCAO,
  FORMATO_DO_CODIGO_DE_ERRO,
  FUNCAO_DA_TAREFA_DE_IA,
  INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS,
  ORIGENS_DA_SAIDA_DE_IA,
  PERFIS_DE_IA,
  TAREFAS_DE_IA,
} from './time/execucao.js'
export type {
  ExecucaoInput,
  EstadoDeConsumoDeIa,
  EstadoDeExecucao,
  OrigemDaSaidaDeIa,
  PerfilDeIa,
  ExecucaoResponse,
  ExecucaoAceitaResponse,
  ResultadoDaExecucao,
  ResultadoGravado,
  TarefaDeIa,
} from './time/execucao.js'
export {
  buscaDeMaterialQuerySchema,
  materiaisQuerySchema,
  materialSchema,
  enviarMaterialRequestSchema,
  buscaDeMaterialResponseSchema,
  listaDeMateriaisResponseSchema,
  materialResponseSchema,
  trechoEncontradoSchema,
  ESTADOS_DE_MATERIAL,
  FALHAS_DE_MATERIAL,
  LICENCAS_DE_MATERIAL,
  LICENCAS_DECLARAVEIS,
  MAXIMO_DE_BYTES_DO_MATERIAL,
  MAXIMO_DE_TRECHOS_NA_BUSCA,
  MENSAGEM_DA_FALHA_DE_MATERIAL,
  motivoDaRecusaDoMaterial,
  MOTIVOS_DA_RECUSA_DO_MATERIAL,
  NOME_DA_LICENCA,
  NOME_DA_TITULARIDADE,
  SEM_LICENCA,
  TAMANHO_MAXIMO_DA_BUSCA,
  TAMANHO_MAXIMO_DO_LICENCIANTE,
  TAMANHO_MAXIMO_DO_TRECHO_CITADO,
  TAMANHO_MAXIMO_TITULO_DO_MATERIAL,
  TITULARIDADES_DE_MATERIAL,
  TRECHOS_PADRAO_NA_BUSCA,
} from './material/material.js'
export type {
  BuscaDeMaterialQuery,
  MateriaisQuery,
  EstadoDeMaterial,
  FalhaDeMaterial,
  LicencaDeclarada,
  LicencaDeMaterial,
  Material,
  MotivoDaRecusaDoMaterial,
  EnviarMaterialRequest,
  BuscaDeMaterialResponse,
  ListaDeMateriaisResponse,
  MaterialResponse,
  TitularidadeDeMaterial,
  TrechoEncontrado,
} from './material/material.js'
export {
  CATALOGO_DE_HABILIDADES,
  HABILIDADE_GERAL,
  habilidadeDoCatalogo,
  habilidadesDaDisciplina,
} from './assistente/habilidades.js'
export type {
  DisciplinaDoCatalogo,
  HabilidadeDoCatalogo,
} from './assistente/habilidades.js'
export {
  AUTORES_DE_MENSAGEM_DE_AGENTE,
  camposDaConsultaDeConversa,
  conversaDoAssistenteQuerySchema,
  conteudoDaMensagemDoAgenteSchema,
  conteudoDaMensagemDoUsuarioSchema,
  mensagemDaConversaSchema,
  mensagemDoAgenteSchema,
  mensagemDoUsuarioSchema,
  parametrosDeFerramentaSchema,
  mensagemAoAssistenteRequestSchema,
  propostaDeFerramentaSchema,
  conversaDoAssistenteResponseSchema,
  FERRAMENTAS_GERADORAS,
  MAXIMO_DE_CITACOES_POR_MENSAGEM,
  MAXIMO_DE_MENSAGENS_POR_PAGINA,
  MAXIMO_DE_QUESTOES_POR_ATIVIDADE,
  MENSAGENS_PADRAO_POR_PAGINA,
  NOME_DA_FERRAMENTA,
  QUESTOES_PADRAO_POR_ATIVIDADE,
  TAMANHO_MAXIMO_DO_PEDIDO,
  TAMANHO_MAXIMO_DO_TEMA,
} from './assistente/conversa.js'
export type {
  AutorDeMensagemDeAgente,
  ConversaDoAssistenteQuery,
  ConteudoDaMensagemDoAgente,
  ConteudoDaMensagemDoUsuario,
  FerramentaGeradora,
  MensagemDaConversa,
  MensagemDoAgente,
  MensagemDoUsuario,
  ParametrosDeFerramenta,
  MensagemAoAssistenteRequest,
  PropostaDeFerramenta,
  ConversaDoAssistenteResponse,
} from './assistente/conversa.js'
export {
  DECISOES_DE_ENTREGA,
  autorDaDecisaoSchema,
  entregasQuerySchema,
  entregaSchema,
  decidirEntregaRequestSchema,
  entregaResponseSchema,
  listaDeEntregasResponseSchema,
  ESTADOS_DE_ENTREGA,
  NOME_DO_TIPO_DE_ENTREGA,
  TAMANHO_MAXIMO_DA_JUSTIFICATIVA,
  TAMANHO_MINIMO_DA_JUSTIFICATIVA,
  TIPOS_DE_ENTREGA,
} from './assistente/entrega.js'
export type {
  EntregasQuery,
  DecisaoDeEntrega,
  Entrega,
  EstadoDeEntrega,
  DecidirEntregaRequest,
  EntregaResponse,
  ListaDeEntregasResponse,
  TipoDeEntrega,
} from './assistente/entrega.js'
export {
  aplicacaoDoArtefatoSchema,
  artefatoResumidoSchema,
  artefatosQuerySchema,
  entregaDoArtefatoSchema,
  parametroFerramentaSchema,
  adaptarArtefatoRequestSchema,
  gerarComFerramentaRequestSchema,
  renomearArtefatoRequestSchema,
  artefatoResponseSchema,
  listaDeArtefatosResponseSchema,
  MAXIMO_DE_VERSOES_NO_ARTEFATO,
} from './assistente/artefato.js'
export type {
  ArtefatoResumido,
  ArtefatosQuery,
  AdaptarArtefatoRequest,
  ParametroFerramenta,
  GerarComFerramentaRequest,
  RenomearArtefatoRequest,
  ArtefatoResponse,
  ListaDeArtefatosResponse,
} from './assistente/artefato.js'
export {
  atividadeAplicadaSchema,
  atividadesAplicadasQuerySchema,
  aplicarAtividadeRequestSchema,
  emptyBodyRequestSchema,
  emptyOrMissingBodyRequestSchema,
  atividadeAplicadaResponseSchema,
  atividadeEncerradaResponseSchema,
  listaDeAtividadesAplicadasResponseSchema,
  ESTADOS_DE_ATIVIDADE_APLICADA,
} from './atividade/atividade-aplicada.js'
export type {
  AtividadeAplicada,
  AtividadesAplicadasQuery,
  EstadoDeAtividadeAplicada,
  AplicarAtividadeRequest,
  EmptyBodyRequest,
  AtividadeAplicadaResponse,
  AtividadeEncerradaResponse,
  ListaDeAtividadesAplicadasResponse,
} from './atividade/atividade-aplicada.js'
export {
  acertoPorHabilidadeSchema,
  alternativaSchema,
  minhasAtividadesQuerySchema,
  minhaAtividadeSchema,
  numeroDaQuestaoSchema,
  questaoDoCaminhoSchema,
  responderQuestaoRequestSchema,
  questaoDaProvaSchema,
  questaoDoDiagnosticoSchema,
  espelhoDaFilaSchema,
  atividadeEnviadaResponseSchema,
  meuDiagnosticoResponseSchema,
  minhasAtividadesResponseSchema,
  provaResponseSchema,
  questaoSalvaResponseSchema,
  respostaSalvaSchema,
  sequenciaSchema,
  questoesDaProva,
  SITUACOES_DA_MINHA_ATIVIDADE,
} from './atividade/prova.js'
export type {
  AcertoPorHabilidade,
  MinhasAtividadesQuery,
  EspelhoDaFila,
  MinhaAtividade,
  ResponderQuestaoRequest,
  QuestaoDaProva,
  AtividadeEnviadaResponse,
  MeuDiagnosticoResponse,
  MinhasAtividadesResponse,
  ProvaResponse,
  QuestaoSalvaResponse,
  RespostaSalva,
  SituacaoDaMinhaAtividade,
} from './atividade/prova.js'
export {
  correcaoDoAlunoSchema,
  destaqueSchema,
  destaquesAbertosSchema,
  diagnosticoGravadoSchema,
  faixaDeAcertosSchema,
  loteApresentadoSchema,
  questaoDoLoteSchema,
  correcaoDoLoteResponseSchema,
  corrigidaResponseSchema,
  destaqueAbertoResponseSchema,
  loteAprovadoResponseSchema,
  resumoDoLoteSchema,
  validacaoDoLoteSchema,
  MAXIMO_DE_ALUNOS_NO_LOTE,
  MOTIVOS_DE_DESTAQUE,
  NOME_DO_MOTIVO_DE_DESTAQUE,
} from './atividade/correcao.js'
export type {
  Destaque,
  DestaquesAbertos,
  DiagnosticoGravado,
  LoteApresentado,
  MotivoDeDestaque,
  CorrecaoDoLoteResponse,
  DestaqueAbertoResponse,
  LoteAprovadoResponse,
  ResumoDoLote,
  ValidacaoDoLote,
} from './atividade/correcao.js'
export {
  desempenhoDaTurmaQuerySchema,
  desempenhoDoAlunoSchema,
  habilidadeDaTurmaSchema,
  desempenhoDaTurmaResponseSchema,
  MAXIMO_DE_ALUNOS_NO_DESEMPENHO,
  MAXIMO_DE_HABILIDADES_NO_DESEMPENHO,
} from './atividade/desempenho.js'
export type {
  DesempenhoDaTurmaQuery,
  DesempenhoDaTurmaResponse,
} from './atividade/desempenho.js'
export {
  sinaisQuerySchema,
  grupoDeSinaisSchema,
  sinaisResponseSchema,
  sinalSchema,
  FRASE_DO_AVISO_AO_PROFESSOR,
  MAXIMO_DE_GRUPOS_DE_SINAL,
  NOME_DO_SINAL,
  TIPOS_DE_SINAL,
  TIPOS_DE_SINAL_DE_TRABALHO,
} from './tutor/sinal.js'
export type {
  SinaisQuery,
  GrupoDeSinais,
  SinaisResponse,
  Sinal,
  TipoDeSinal,
  TipoDeSinalDeTrabalho,
} from './tutor/sinal.js'
export {
  AUTORES_DE_MENSAGEM_DO_TUTOR,
  conversaDoTutorQuerySchema,
  mensagemDoAlunoAoTutorSchema,
  mensagemDoTutorSchema,
  mensagemDoTutorAoAlunoSchema,
  mensagemAoTutorRequestSchema,
  conversaDoTutorResponseSchema,
  memoriaDoTutorResponseSchema,
  sinalNaMemoriaSchema,
  trabalhoNaMemoriaSchema,
  ESTADOS_DO_TUTOR,
  MAXIMO_DE_CITACOES_DO_TUTOR,
  MAXIMO_DE_ITENS_NA_MEMORIA,
  TAMANHO_MAXIMO_DA_PERGUNTA_AO_TUTOR,
  TIPOS_DE_MENSAGEM_DO_TUTOR,
  TROCAS_POR_DIA_PADRAO_DO_TUTOR,
  TROCAS_POR_MES_PADRAO_DO_TUTOR,
} from './tutor/tutor.js'
export type {
  AutorDeMensagemDoTutor,
  ConversaDoTutorQuery,
  EstadoDoTutor,
  MensagemDoAlunoAoTutor,
  MensagemDoTutor,
  MensagemDoTutorAoAluno,
  MensagemAoTutorRequest,
  ConversaDoTutorResponse,
  MemoriaDoTutorResponse,
  TipoDeMensagemDoTutor,
} from './tutor/tutor.js'
export {
  usoDoTutorQuerySchema,
  referenciaDaUltimaTrocaSchema,
  usoDoTutorResponseSchema,
  usoDoAlunoSchema,
  MAXIMO_DE_ALUNOS_NO_USO,
} from './tutor/uso.js'
export type {
  UsoDoTutorQuery,
  UsoDoTutorResponse,
  UsoDoAluno,
} from './tutor/uso.js'
export {
  consumoQuerySchema,
  resumoDaGovernancaQuerySchema,
  consumoSomadoSchema,
  funcaoDaGovernancaSchema,
  itemDaGovernancaSchema,
  suspenderFuncaoRequestSchema,
  consumoResponseSchema,
  funcaoDaGovernancaResponseSchema,
  funcoesDaGovernancaResponseSchema,
  resumoDaGovernancaResponseSchema,
  suspensaoVigenteSchema,
  MOTIVOS_DE_SUSPENSAO,
  NOME_DO_MOTIVO_DE_SUSPENSAO,
} from './governanca/governanca.js'
export type {
  ConsumoQuery,
  ResumoDaGovernancaQuery,
  ConsumoSomado,
  FuncaoDaGovernanca,
  ItemDaGovernanca,
  MotivoDeSuspensao,
  SuspenderFuncaoRequest,
  ConsumoResponse,
  FuncaoDaGovernancaResponse,
  FuncoesDaGovernancaResponse,
  ResumoDaGovernancaResponse,
} from './governanca/governanca.js'
export {
  alertaDoAnalistaSchema,
  analistaNominalQuerySchema,
  conteudoDoResumoDoAnalistaSchema,
  gerarResumoDoAnalistaRequestSchema,
  recorteDoAnalistaSchema,
  recorteNominalSchema,
  analistaNominalResponseSchema,
  resumoDoAnalistaResponseSchema,
  FINALIDADES_DA_LEITURA_NOMINAL,
  GRUPO_MINIMO_DE_PROFESSORES,
  HIPOTESES_DO_ANALISTA,
  NOME_DA_FINALIDADE_NOMINAL,
  NOME_DO_ALERTA_DO_ANALISTA,
  TEXTO_DA_HIPOTESE,
  TIPOS_DE_ALERTA_DO_ANALISTA,
} from './governanca/analista.js'
export type {
  AlertaDoAnalista,
  AnalistaNominalQuery,
  ConteudoDoResumoDoAnalista,
  FinalidadeDaLeituraNominal,
  HipoteseDoAnalista,
  GerarResumoDoAnalistaRequest,
  RecorteDoAnalista,
  AnalistaNominalResponse,
  ResumoDoAnalistaResponse,
  TipoDeAlertaDoAnalista,
} from './governanca/analista.js'
export {
  ajusteDeRetencaoCabe,
  AUTOR_DA_ROTINA,
  CATEGORIAS_DE_RETENCAO,
  CHAVES_DE_PRAZO_FIXO,
  CHAVES_DE_RETENCAO,
  prazoFixoSchema,
  retencaoResponseSchema,
  retencaoDaCategoriaSchema,
  FINALIDADE_DO_AJUSTE_DE_RETENCAO,
  ORIGENS_DA_RETENCAO,
  PRAZOS_FIXOS,
  retencaoDaEscola,
  TRAVAS_DE_RETENCAO,
} from './privacidade/retencao.js'
export type {
  AjusteDeRetencao,
  CategoriaDeRetencao,
  ChaveDePrazoFixo,
  DefinicaoDaCategoria,
  DefinicaoDoPrazoFixo,
  OrigemDaRetencao,
  RetencaoResponse,
  RetencaoDaCategoria,
} from './privacidade/retencao.js'
export {
  baixarArquivoDaEscolaSchema,
  pedidoDeMeusDadosSchema,
  arquivoResponseSchema,
  meusDadosResponseSchema,
  FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR,
  FINALIDADES_DO_ARQUIVO,
  FINALIDADES_DO_ARQUIVO_DA_ESCOLA,
  HORAS_EM_PREPARACAO_PARA_ALERTAR,
  nomeDoArquivoDoTitular,
  TIPOS_DE_PEDIDO_COM_ARQUIVO,
  VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS,
  VALIDADE_DO_ARQUIVO_DIAS,
  VERSOES_DO_ARQUIVO,
} from './privacidade/arquivo.js'
export type { BaixarArquivoDaEscola, FinalidadeDoArquivo, PedidoDeMeusDados, ArquivoResponse, MeusDadosResponse, VersaoDoArquivo } from './privacidade/arquivo.js'
export { CLASSIFICACAO_DAS_TABELAS, COLUNAS_FORA_DO_ARQUIVO } from './privacidade/classificacao.js'
export type { ArquivoDaTabela, ClasseDaTabela, ClassificacaoDaTabela } from './privacidade/classificacao.js'
export {
  ALCANCES_DO_SUBOPERADOR,
  CATEGORIAS_DE_DADO_DO_SUBOPERADOR,
  CHAVES_DE_CATEGORIA_DO_SUBOPERADOR,
  suboperadoresResponseSchema,
  suboperadorDaEscolaSchema,
  FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
  FORMATO_DA_CHAVE_DO_SUBOPERADOR,
  FORMATO_DO_CONTRATO_DO_SUBOPERADOR,
  FORMATO_DO_PAIS_DO_SUBOPERADOR,
  MAXIMO_DA_FINALIDADE_DO_SUBOPERADOR,
  MAXIMO_DO_NOME_DO_SUBOPERADOR,
} from './privacidade/suboperador.js'
export type { AlcanceDoSuboperador, CategoriaDeDadoDoSuboperador, SuboperadoresResponse, SuboperadorDaEscola } from './privacidade/suboperador.js'
export {
  CATEGORIAS_DE_DADO_DO_INCIDENTE,
  CHAVES_DE_CATEGORIA_DO_INCIDENTE,
  incidenteDaEscolaSchema,
  incidentesResponseSchema,
  FINALIDADE_DO_REGISTRO_DE_INCIDENTE,
  HORAS_PARA_A_ESCOLA_CONFIRMAR,
  MAXIMO_DE_ESCOLAS_DO_INCIDENTE,
  MAXIMO_DE_TITULARES_ESTIMADOS,
  MAXIMO_DO_TEXTO_DO_INCIDENTE,
  RISCOS_DO_INCIDENTE,
  TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE,
} from './privacidade/incidente.js'
export type { CategoriaDeDadoDoIncidente, IncidenteDaEscola, IncidentesResponse, RiscoDoIncidente } from './privacidade/incidente.js'
export {
  CATEGORIAS_DE_CADASTRO_E_VINCULO,
  ESTADOS_ABERTOS_DO_PEDIDO,
  ESTADOS_DO_PEDIDO,
  ESTADOS_DO_TITULAR,
  buscaDeTitularesSchema,
  compartilhamentoSchema,
  correcaoDeNomeSchema,
  itemDoPedidoSchema,
  linhaDoCompartilhamentoSchema,
  pedidoDoTitularSchema,
  registroDePedidoSchema,
  buscaDeTitularesResponseSchema,
  pedidosResponseSchema,
  previaDoTitularResponseSchema,
  titularAchadoSchema,
  titularDoPedidoSchema,
  FINALIDADE_DO_ATENDIMENTO_DO_TITULAR,
  LIMITE_DA_BUSCA_DE_TITULARES_POR_MINUTO,
  MAXIMO_DE_RESULTADOS_DA_BUSCA,
  MAXIMO_DO_NOME_DO_TITULAR,
  MINIMO_DE_LETRAS_DO_TERMO,
  ORIGENS_DO_COMPARTILHAMENTO,
  PAPEIS_DO_TITULAR,
  HORAS_AGENDADO_PARA_ALERTAR,
  HORAS_PARA_REENFILEIRAR_A_ELIMINACAO,
  PRAZO_DA_ELIMINACAO_DIAS,
  SOLICITANTES_DO_PEDIDO,
  TIPOS_DE_PEDIDO_DO_TITULAR,
} from './privacidade/titular.js'
export type {
  BuscaDeTitulares,
  Compartilhamento,
  EstadoDoPedido,
  EstadoDoTitular,
  ItemDoPedido,
  CompartilhamentoRow,
  OrigemDoCompartilhamento,
  PapelDoTitular,
  PedidoDoTitular,
  RegistroDePedido,
  CorrecaoDeNome,
  BuscaDeTitularesResponse,
  PedidosResponse,
  PreviaDoTitularResponse,
  SolicitanteDoPedido,
  TipoDePedidoDoTitular,
  TitularAchado,
  TitularDoPedido,
} from './privacidade/titular.js'
