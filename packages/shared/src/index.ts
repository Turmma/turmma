export { CodigoDeErro } from './erros/codigo-de-erro.js'
export type { RespostaDeErro } from './erros/codigo-de-erro.js'
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
} from './erros/mensagens.js'
export { ALCANCES, ALCANCES_INDIVIDUAIS, alcanceDe, MATRIZ, PAPEIS, PAPEIS_DE_USUARIO, RECURSOS } from './permissao/matriz.js'
export type { AcaoDe, Alcance, Papel, PapelDeUsuario, Recurso } from './permissao/matriz.js'
export type { RespostaSaude } from './sistema/saude.js'
export { esquemaRespostaContexto } from './sistema/contexto.js'
export type { RespostaContexto } from './sistema/contexto.js'
export type { RespostaProntidao } from './sistema/prontidao.js'
export { AMBIENTES_DO_SISTEMA, COMPONENTES_DO_SISTEMA, esquemaRespostaEstado, SITUACOES_DE_COMPONENTE } from './sistema/estado.js'
export type { ComponenteDoSistema, RespostaEstado } from './sistema/estado.js'
export { esquemaAviso, esquemaRespostaAvisos, MAXIMO_DE_AVISOS } from './sistema/avisos.js'
export type { Aviso, RespostaAvisos } from './sistema/avisos.js'
export { CODIGOS_DE_FALHA_DE_JOB, CodigoDeFalhaDeJob, ESTADOS_DE_JOB, FILAS } from './sistema/jobs.js'
export type { EstadoDeJob, Fila } from './sistema/jobs.js'
export {
  CPU_MS_MAXIMO_SINTETICO,
  esquemaDadosJobSintetico,
  esquemaPedidoJobSintetico,
  esquemaRespostaEstadoDeJob,
  esquemaRespostaJobAceito,
} from './sistema/jobs-sinteticos.js'
export type { DadosJobSintetico, PedidoJobSintetico, RespostaEstadoDeJob, RespostaJobAceito } from './sistema/jobs-sinteticos.js'
export {
  CAMINHO_REALTIME,
  NAMESPACE_REALTIME_SISTEMA,
  opcoesDoClienteRealtime,
  RECONEXAO_REALTIME,
} from './sistema/realtime.js'
export type { AutenticacaoRealtime, OpcoesDoClienteRealtime } from './sistema/realtime.js'
export {
  esquemaPedidoLoginEmail,
  esquemaRespostaLogin,
  ETAPAS_COM_DESAFIO,
  ETAPAS_DE_LOGIN,
  TAMANHO_MAXIMO_EMAIL,
  TAMANHO_MAXIMO_SENHA,
} from './sessao/login.js'
export type { EtapaComDesafio, EtapaDeLogin, PedidoLoginEmail, RespostaLogin } from './sessao/login.js'
export {
  esquemaPedidoAceitarConvite,
  esquemaPedidoConsultarConvite,
  esquemaRespostaAceitarConvite,
  esquemaRespostaConsultarConvite,
  TAMANHO_MAXIMO_TOKEN_DE_CONVITE,
  TAMANHO_MINIMO_SENHA_NOVA,
  TIPOS_DE_CONVITE,
  VALIDADE_DO_CONVITE_HORAS,
  VALIDADE_DO_CONVITE_HORAS_POR_TIPO,
} from './sessao/convite.js'
export type { PedidoAceitarConvite, PedidoConsultarConvite, RespostaAceitarConvite, RespostaConsultarConvite, TipoDeConvite } from './sessao/convite.js'
export { esquemaPedidoLoginMatricula, TAMANHO_MAXIMO_MATRICULA, TAMANHO_MAXIMO_SLUG_NO_LOGIN } from './sessao/matricula.js'
export type { PedidoLoginMatricula } from './sessao/matricula.js'
export { esquemaRespostaAcessoDaEscola, PROVEDORES_DE_CONTA_DA_ESCOLA } from './sessao/acesso-da-escola.js'
export type { ProvedorDeContaDaEscola, RespostaAcessoDaEscola } from './sessao/acesso-da-escola.js'
export { FALHAS_DO_LOGIN_EXTERNO, PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO } from './sessao/externa.js'
export type { FalhaDoLoginExterno } from './sessao/externa.js'
export {
  esquemaPedidoProvedoresDaEscola,
  esquemaProvedorDaEscola,
  esquemaRespostaProvedoresDaEscola,
  MAXIMO_DE_PROVEDORES_DA_ESCOLA,
  TENANT_DE_CONTA_PESSOAL_MICROSOFT,
} from './estrutura/provedores.js'
export type { PedidoProvedoresDaEscola, ProvedorDaEscola, RespostaProvedoresDaEscola } from './estrutura/provedores.js'
export { esquemaAcessoDaConta, esquemaConcluirIntroducao, esquemaRespostaEu, esquemaRespostaIntroducao } from './sessao/eu.js'
export type { AcessoDaConta, RespostaEu, RespostaIntroducao } from './sessao/eu.js'
export { esquemaPedidoTrocaDeEscola } from './sessao/troca-de-escola.js'
export type { PedidoTrocaDeEscola } from './sessao/troca-de-escola.js'
export { esquemaRespostaRenovacao, JANELA_DE_RENOVACAO_SIMULTANEA_MS } from './sessao/renovacao.js'
export type { RespostaRenovacao } from './sessao/renovacao.js'
export { esquemaPedidoEscolaSessao, esquemaRespostaEscolaSessao, INATIVIDADE_MAXIMA_MIN, INATIVIDADE_MINIMA_MIN } from './sessao/escola-sessao.js'
export type { PedidoEscolaSessao, RespostaEscolaSessao } from './sessao/escola-sessao.js'
export {
  ALFABETO_DO_CODIGO_DE_RECUPERACAO,
  DIGITOS_DO_CODIGO_MFA,
  esquemaPedidoAtivarMfa,
  esquemaPedidoMfa,
  esquemaPedidoRedefinirMfa,
  esquemaRespostaAtivarMfa,
  esquemaRespostaConfigurarMfa,
  FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR,
  FINALIDADES_DA_REDEFINICAO_DE_MFA,
  QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO,
  TAMANHO_DO_CODIGO_DE_RECUPERACAO,
} from './sessao/mfa.js'
export type { FinalidadeDaRedefinicaoDeMfa, PedidoAtivarMfa, PedidoMfa, PedidoRedefinirMfa, RespostaAtivarMfa, RespostaConfigurarMfa } from './sessao/mfa.js'
export { esquemaConsultaPaginada, esquemaDePagina, TAMANHO_MAXIMO_DA_PAGINA, TAMANHO_PADRAO_DA_PAGINA } from './estrutura/paginacao.js'
export type { ConsultaPaginada } from './estrutura/paginacao.js'
export {
  esquemaAnoLetivo,
  esquemaPedidoCriarAnoLetivo,
  esquemaRespostaAnoLetivo,
  esquemaRespostaListaDeAnosLetivos,
  fimCaiAteOAnoSeguinte,
  fimDepoisDoInicio,
  inicioCaiNoAnoLetivo,
  MAIOR_ANO_LETIVO,
  MENOR_ANO_LETIVO,
  SITUACOES_DO_ANO_LETIVO,
} from './estrutura/ano-letivo.js'
export type { AnoLetivo, PedidoCriarAnoLetivo, RespostaAnoLetivo, RespostaListaDeAnosLetivos, SituacaoDoAnoLetivo } from './estrutura/ano-letivo.js'
export { ANOS_DA_ETAPA, esquemaPedidoCriarSerie, esquemaRespostaListaDeSeries, esquemaRespostaSerie, esquemaSerie, ETAPAS, nomeDaSerie } from './estrutura/serie.js'
export type { Etapa, PedidoCriarSerie, RespostaListaDeSeries, RespostaSerie, Serie } from './estrutura/serie.js'
export {
  AREAS_DO_CONHECIMENTO,
  esquemaDisciplina,
  esquemaPedidoCriarDisciplina,
  esquemaPedidoRenomearDisciplina,
  esquemaRespostaDisciplina,
  esquemaRespostaListaDeDisciplinas,
  TAMANHO_MAXIMO_NOME_DISCIPLINA,
} from './estrutura/disciplina.js'
export type {
  AreaDoConhecimento,
  Disciplina,
  PedidoCriarDisciplina,
  PedidoRenomearDisciplina,
  RespostaDisciplina,
  RespostaListaDeDisciplinas,
} from './estrutura/disciplina.js'
export {
  esquemaAlunoDaTurma,
  esquemaConsultaAlunosDaTurma,
  esquemaConsultaTurma,
  esquemaPedidoCriarTurma,
  esquemaPedidoRenomearTurma,
  esquemaRespostaAlunosDaTurma,
  esquemaRespostaListaDeTurmas,
  esquemaRespostaTurma,
  esquemaRespostaTurmaAberta,
  esquemaTurma,
  FINALIDADES_DA_LEITURA_DE_ALUNOS,
  TAMANHO_MAXIMO_NOME_TURMA,
  TURNOS,
} from './estrutura/turma.js'
export type {
  AlunoDaTurma,
  ConsultaAlunosDaTurma,
  ConsultaTurma,
  FinalidadeDaLeituraDeAlunos,
  PedidoCriarTurma,
  PedidoRenomearTurma,
  RespostaAlunosDaTurma,
  RespostaListaDeTurmas,
  RespostaTurma,
  RespostaTurmaAberta,
  Turma,
  Turno,
} from './estrutura/turma.js'
export {
  ERROS_DA_LINHA_DA_LISTA,
  ESTADOS_DO_NOME_DA_LISTA,
  esquemaConsultaListaDaTurma,
  esquemaLinhaDaPrevia,
  esquemaMatriculaDigitada,
  esquemaNomeDaLista,
  esquemaPedidoNomeAvulso,
  esquemaPedidoTextoDaLista,
  esquemaRespostaGravacaoDaLista,
  esquemaRespostaListaDaTurma,
  esquemaRespostaPreviaDaLista,
  MAXIMO_DE_BYTES_DA_LISTA,
  MAXIMO_DE_LINHAS_DA_LISTA,
  RESULTADOS_DA_LINHA_DA_LISTA,
} from './estrutura/lista.js'
export { matriculasQueParecemDocumento, pareceCpfSemPontuacao, pareceDocumento } from './estrutura/documento-na-matricula.js'
export type {
  ConsultaListaDaTurma,
  ErroDaLinhaDaLista,
  EstadoDoNomeDaLista,
  LinhaDaPrevia,
  NomeDaLista,
  PedidoNomeAvulso,
  PedidoTextoDaLista,
  RespostaGravacaoDaLista,
  RespostaListaDaTurma,
  RespostaPreviaDaLista,
  ResultadoDaLinhaDaLista,
} from './estrutura/lista.js'
export {
  AVISO_DO_COMPLEMENTO,
  CONTESTACOES_DE_VINCULO,
  EFEITO_DA_CONTESTACAO,
  ESTADOS_DE_VINCULO,
  ESTADOS_EM_DECISAO,
  esquemaConsultaVinculos,
  esquemaPedidoContestarVinculo,
  esquemaPedidoCriarVinculo,
  esquemaPedidoEncerrarVinculo,
  esquemaRespostaListaDeVinculos,
  esquemaRespostaMeusVinculos,
  esquemaRespostaVinculo,
  esquemaRespostaVinculoDaCoordenacao,
  esquemaVinculo,
  esquemaVinculoDaCoordenacao,
  MOTIVOS_DE_ENCERRAMENTO_DE_VINCULO,
  MOTIVOS_DE_ENCERRAMENTO_PELA_COORDENACAO,
  NOME_DA_CONTESTACAO,
  NOME_DO_ESTADO_DE_VINCULO,
  PAPEIS_DE_VINCULO,
  PAPEIS_DE_VINCULO_PELA_COORDENACAO,
  TAMANHO_MAXIMO_DO_COMPLEMENTO,
} from './estrutura/vinculo.js'
export type {
  ConsultaVinculos,
  ContestacaoDeVinculo,
  EstadoDeVinculo,
  MotivoDeEncerramentoDeVinculo,
  PapelDeVinculo,
  PedidoContestarVinculo,
  PedidoCriarVinculo,
  PedidoEncerrarVinculo,
  RespostaListaDeVinculos,
  RespostaMeusVinculos,
  RespostaVinculo,
  RespostaVinculoDaCoordenacao,
  Vinculo,
  VinculoDaCoordenacao,
} from './estrutura/vinculo.js'
export { esquemaRespostaEuDoOperador, FORMATO_OPERADOR } from './operacao/eu.js'
export {
  esquemaEmailConvidado,
  esquemaIdDoPedido,
  esquemaNomeDigitado,
  esquemaPedidoConviteDaCoordenacao,
  esquemaPedidoCriarEscola,
  esquemaPedidoCriarRede,
  esquemaRedeDoPainel,
  esquemaRespostaConviteDaCoordenacao,
  esquemaRespostaCriadoNoPainel,
  esquemaRespostaEscolasDoPainel,
  esquemaRespostaRedesDoPainel,
  esquemaRespostaUsoDoPainel,
  esquemaSlugDaEscola,
  esquemaConsultaDoPainel,
  esquemaEscolaDoPainel,
  esquemaUsoDaEscolaDoPainel,
  esquemaUsoDoPeriodoDoPainel,
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
  ConsultaDoPainel,
  EscolaDoPainel,
  EstadoDaCoordenacao,
  OrdemDoPainel,
  PedidoConviteDaCoordenacao,
  PedidoCriarEscola,
  PedidoCriarRede,
  RedeDoPainel,
  RespostaConviteDaCoordenacao,
  RespostaCriadoNoPainel,
  RespostaEscolasDoPainel,
  RespostaRedesDoPainel,
  RespostaUsoDoPainel,
  UsoDaEscolaDoPainel,
  UsoDoPeriodoDoPainel,
} from './operacao/painel.js'
export {
  esquemaPedidoCadastrarProfessor,
  esquemaPedidoSemCorpoDoConviteDeProfessor,
  esquemaProfessorDaEscola,
  esquemaRespostaConviteDeProfessor,
  esquemaRespostaListaDeProfessores,
  ESTADOS_DO_PROFESSOR,
  ESTADOS_DO_PROFESSOR_ALOCAVEIS,
  REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO,
  REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO,
} from './professores/professores.js'
export type { EstadoDoProfessor, PedidoCadastrarProfessor, ProfessorDaEscola, RespostaConviteDeProfessor, RespostaListaDeProfessores } from './professores/professores.js'
export {
  ALFABETO_DO_CODIGO_DA_TURMA,
  codigoDaTurmaValido,
  esquemaPedidoGerarAcesso,
  esquemaPedidoRevogarAcesso,
  esquemaRespostaAcessoDaTurma,
  esquemaRespostaAcessoGerado,
  exibirCodigoDaTurma,
  normalizarCodigoDaTurma,
  TAMANHO_DO_CODIGO_DA_TURMA,
  VALIDADES_DO_ACESSO_DIAS,
} from './sala/acesso.js'
export type { PedidoGerarAcesso, RespostaAcessoDaTurma, RespostaAcessoGerado, ValidadeDoAcessoDias } from './sala/acesso.js'
export {
  DECISORES_DA_REIVINDICACAO,
  esquemaPedidoAbrirSala,
  esquemaPedidoReivindicarSala,
  esquemaRespostaReivindicacao,
  esquemaRespostaSalaAberta,
  ESTADOS_DA_REIVINDICACAO,
  MAXIMO_DE_NOMES_NA_SALA,
  TAMANHO_MAXIMO_CODIGO_DIGITADO,
} from './sala/salas.js'
export type { DecisorDaReivindicacao, EstadoDaReivindicacao, PedidoAbrirSala, PedidoReivindicarSala, RespostaReivindicacao, RespostaSalaAberta } from './sala/salas.js'
export { MENSAGENS_DA_SALA, mensagemDaSala, mensagemDoLimiteDaSala, minutosDaEspera } from './sala/mensagens-da-sala.js'
export type { CaminhoDaSala } from './sala/mensagens-da-sala.js'
export {
  DECISOES_DE_PEDIDO,
  esquemaConsultaPedidosDaTurma,
  esquemaPedidoDaTurma,
  esquemaPedidoDecidirReivindicacoes,
  esquemaRespostaDecisao,
  esquemaRespostaPedidosDaTurma,
  MAXIMO_DE_PEDIDOS_POR_DECISAO,
  RESULTADOS_DA_DECISAO,
} from './sala/pedidos.js'
export type {
  ConsultaPedidosDaTurma,
  DecisaoDePedido,
  PedidoDaTurma,
  PedidoDecidirReivindicacoes,
  RespostaDecisao,
  RespostaPedidosDaTurma,
  ResultadoDaDecisao,
} from './sala/pedidos.js'
export { esquemaRespostaMinhaTurma } from './sala/minha-turma.js'
export type { RespostaMinhaTurma } from './sala/minha-turma.js'
export { FORMATO_SLUG, TAMANHO_MAXIMO_SLUG, TIPOS_DE_REDE } from './estrutura/rede-e-escola.js'
export type { TipoDeRede } from './estrutura/rede-e-escola.js'
export type { RespostaEuDoOperador } from './operacao/eu.js'
export {
  esquemaPedidoAceitarConviteDeOperador,
  esquemaPedidoConsultarConviteDeOperador,
  esquemaRespostaAceitarConviteDeOperador,
  esquemaRespostaConsultarConviteDeOperador,
} from './operacao/convite.js'
export { esquemaPedidoEntradaDeOperador, esquemaRespostaEntradaDeOperador } from './operacao/entrada.js'
export { esquemaPedidoSemCorpoDeOperador, esquemaRespostaRenovacaoDeOperador } from './operacao/sessao.js'
export type { PedidoSemCorpoDeOperador, RespostaRenovacaoDeOperador } from './operacao/sessao.js'
export {
  esquemaPedidoConfigurarSegundoFatorDeOperador,
  esquemaPedidoSegundoFatorDeOperador,
  esquemaRespostaConfigurarSegundoFatorDeOperador,
  esquemaRespostaSegundoFatorDeOperador,
} from './operacao/segundo-fator.js'
export type {
  PedidoConfigurarSegundoFatorDeOperador,
  PedidoSegundoFatorDeOperador,
  RespostaConfigurarSegundoFatorDeOperador,
  RespostaSegundoFatorDeOperador,
} from './operacao/segundo-fator.js'
export type { PedidoEntradaDeOperador, RespostaEntradaDeOperador } from './operacao/entrada.js'
export type {
  PedidoAceitarConviteDeOperador,
  PedidoConsultarConviteDeOperador,
  RespostaAceitarConviteDeOperador,
  RespostaConsultarConviteDeOperador,
} from './operacao/convite.js'
export { AGENTES, CHAVES_DE_FUNCAO, ehChaveDeFuncao, FUNCOES, NIVEIS_DE_AUTONOMIA, NOMES_DOS_AGENTES } from './time/funcoes.js'
export type { Agente, ChaveDeFuncao, DeclaracaoDeFuncao, NivelDeAutonomia } from './time/funcoes.js'
export {
  ALTERNATIVAS_POR_QUESTAO,
  esquemaAdaptacaoAplicada,
  esquemaCitacao,
  esquemaConteudoDeAtividade,
  esquemaConteudoDePlanoDeAula,
  esquemaConteudoDoArtefato,
  esquemaHabilidade,
  esquemaQuestaoObjetiva,
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
  esquemaChaveEnvio,
} from './time/chave-envio.js'
export {
  esquemaAgenteDoTime,
  esquemaChaveDeFuncao,
  esquemaFuncaoDoTime,
  esquemaRespostaTime,
  montarTime,
} from './time/time.js'
export type {
  AgenteDoTime,
  FuncaoDoTime,
  RespostaTime,
} from './time/time.js'
export {
  esquemaEntradaDaExecucao,
  esquemaRespostaExecucao,
  esquemaRespostaExecucaoAceita,
  esquemaResultadoDaExecucao,
  esquemaResultadoGravado,
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
  EntradaDaExecucao,
  EstadoDeConsumoDeIa,
  EstadoDeExecucao,
  OrigemDaSaidaDeIa,
  PerfilDeIa,
  RespostaExecucao,
  RespostaExecucaoAceita,
  ResultadoDaExecucao,
  ResultadoGravado,
  TarefaDeIa,
} from './time/execucao.js'
export {
  esquemaConsultaBuscaDeMaterial,
  esquemaConsultaMateriais,
  esquemaMaterial,
  esquemaPedidoEnviarMaterial,
  esquemaRespostaBuscaDeMaterial,
  esquemaRespostaListaDeMateriais,
  esquemaRespostaMaterial,
  esquemaTrechoEncontrado,
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
  ConsultaBuscaDeMaterial,
  ConsultaMateriais,
  EstadoDeMaterial,
  FalhaDeMaterial,
  LicencaDeclarada,
  LicencaDeMaterial,
  Material,
  MotivoDaRecusaDoMaterial,
  PedidoEnviarMaterial,
  RespostaBuscaDeMaterial,
  RespostaListaDeMateriais,
  RespostaMaterial,
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
  esquemaConsultaConversaDoAssistente,
  esquemaConteudoDaMensagemDoAgente,
  esquemaConteudoDaMensagemDoUsuario,
  esquemaMensagemDaConversa,
  esquemaMensagemDoAgente,
  esquemaMensagemDoUsuario,
  esquemaParametrosDeFerramenta,
  esquemaPedidoMensagemAoAssistente,
  esquemaPropostaDeFerramenta,
  esquemaRespostaConversaDoAssistente,
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
  ConsultaConversaDoAssistente,
  ConteudoDaMensagemDoAgente,
  ConteudoDaMensagemDoUsuario,
  FerramentaGeradora,
  MensagemDaConversa,
  MensagemDoAgente,
  MensagemDoUsuario,
  ParametrosDeFerramenta,
  PedidoMensagemAoAssistente,
  PropostaDeFerramenta,
  RespostaConversaDoAssistente,
} from './assistente/conversa.js'
export {
  DECISOES_DE_ENTREGA,
  esquemaAutorDaDecisao,
  esquemaConsultaEntregas,
  esquemaEntrega,
  esquemaPedidoDecidirEntrega,
  esquemaRespostaEntrega,
  esquemaRespostaListaDeEntregas,
  ESTADOS_DE_ENTREGA,
  NOME_DO_TIPO_DE_ENTREGA,
  TAMANHO_MAXIMO_DA_JUSTIFICATIVA,
  TAMANHO_MINIMO_DA_JUSTIFICATIVA,
  TIPOS_DE_ENTREGA,
} from './assistente/entrega.js'
export type {
  ConsultaEntregas,
  DecisaoDeEntrega,
  Entrega,
  EstadoDeEntrega,
  PedidoDecidirEntrega,
  RespostaEntrega,
  RespostaListaDeEntregas,
  TipoDeEntrega,
} from './assistente/entrega.js'
export {
  esquemaAplicacaoDoArtefato,
  esquemaArtefatoResumido,
  esquemaConsultaArtefatos,
  esquemaEntregaDoArtefato,
  esquemaParametroFerramenta,
  esquemaPedidoAdaptarArtefato,
  esquemaPedidoGerarComFerramenta,
  esquemaPedidoRenomearArtefato,
  esquemaRespostaArtefato,
  esquemaRespostaListaDeArtefatos,
  MAXIMO_DE_VERSOES_NO_ARTEFATO,
} from './assistente/artefato.js'
export type {
  ArtefatoResumido,
  ConsultaArtefatos,
  PedidoAdaptarArtefato,
  PedidoGerarComFerramenta,
  PedidoRenomearArtefato,
  RespostaArtefato,
  RespostaListaDeArtefatos,
} from './assistente/artefato.js'
export {
  esquemaAtividadeAplicada,
  esquemaConsultaAtividadesAplicadas,
  esquemaPedidoAplicarAtividade,
  esquemaPedidoSemCorpo,
  esquemaRespostaAtividadeAplicada,
  esquemaRespostaAtividadeEncerrada,
  esquemaRespostaListaDeAtividadesAplicadas,
  ESTADOS_DE_ATIVIDADE_APLICADA,
} from './atividade/atividade-aplicada.js'
export type {
  AtividadeAplicada,
  ConsultaAtividadesAplicadas,
  EstadoDeAtividadeAplicada,
  PedidoAplicarAtividade,
  PedidoSemCorpo,
  RespostaAtividadeAplicada,
  RespostaAtividadeEncerrada,
  RespostaListaDeAtividadesAplicadas,
} from './atividade/atividade-aplicada.js'
export {
  esquemaAcertoPorHabilidade,
  esquemaAlternativa,
  esquemaConsultaMinhasAtividades,
  esquemaMinhaAtividade,
  esquemaNumeroDaQuestao,
  esquemaPedidoResponderQuestao,
  esquemaQuestaoDaProva,
  esquemaQuestaoDoDiagnostico,
  esquemaRespostaAtividadeEnviada,
  esquemaRespostaMeuDiagnostico,
  esquemaRespostaMinhasAtividades,
  esquemaRespostaProva,
  esquemaRespostaQuestaoSalva,
  esquemaRespostaSalva,
  questoesDaProva,
  SITUACOES_DA_MINHA_ATIVIDADE,
} from './atividade/prova.js'
export type {
  AcertoPorHabilidade,
  MinhaAtividade,
  PedidoResponderQuestao,
  QuestaoDaProva,
  RespostaAtividadeEnviada,
  RespostaMeuDiagnostico,
  RespostaMinhasAtividades,
  RespostaProva,
  RespostaQuestaoSalva,
  SituacaoDaMinhaAtividade,
} from './atividade/prova.js'
export {
  esquemaCorrecaoDoAluno,
  esquemaDestaque,
  esquemaDestaquesAbertos,
  esquemaDiagnosticoGravado,
  esquemaFaixaDeAcertos,
  esquemaLoteApresentado,
  esquemaQuestaoDoLote,
  esquemaRespostaCorrecaoDoLote,
  esquemaRespostaCorrigida,
  esquemaRespostaDestaqueAberto,
  esquemaRespostaLoteAprovado,
  esquemaResumoDoLote,
  esquemaValidacaoDoLote,
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
  RespostaCorrecaoDoLote,
  RespostaDestaqueAberto,
  RespostaLoteAprovado,
  ResumoDoLote,
  ValidacaoDoLote,
} from './atividade/correcao.js'
export {
  esquemaConsultaDesempenhoDaTurma,
  esquemaDesempenhoDoAluno,
  esquemaHabilidadeDaTurma,
  esquemaRespostaDesempenhoDaTurma,
  MAXIMO_DE_ALUNOS_NO_DESEMPENHO,
  MAXIMO_DE_HABILIDADES_NO_DESEMPENHO,
} from './atividade/desempenho.js'
export type {
  ConsultaDesempenhoDaTurma,
  RespostaDesempenhoDaTurma,
} from './atividade/desempenho.js'
export {
  esquemaConsultaSinais,
  esquemaGrupoDeSinais,
  esquemaRespostaSinais,
  esquemaSinal,
  MAXIMO_DE_GRUPOS_DE_SINAL,
  NOME_DO_SINAL,
  TIPOS_DE_SINAL,
  TIPOS_DE_SINAL_DE_TRABALHO,
} from './tutor/sinal.js'
export type {
  ConsultaSinais,
  GrupoDeSinais,
  RespostaSinais,
  Sinal,
  TipoDeSinal,
  TipoDeSinalDeTrabalho,
} from './tutor/sinal.js'
export {
  AUTORES_DE_MENSAGEM_DO_TUTOR,
  esquemaConsultaConversaDoTutor,
  esquemaMensagemDoAlunoAoTutor,
  esquemaMensagemDoTutor,
  esquemaMensagemDoTutorAoAluno,
  esquemaPedidoMensagemAoTutor,
  esquemaRespostaConversaDoTutor,
  esquemaRespostaMemoriaDoTutor,
  esquemaSinalNaMemoria,
  esquemaTrabalhoNaMemoria,
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
  ConsultaConversaDoTutor,
  EstadoDoTutor,
  MensagemDoAlunoAoTutor,
  MensagemDoTutor,
  MensagemDoTutorAoAluno,
  PedidoMensagemAoTutor,
  RespostaConversaDoTutor,
  RespostaMemoriaDoTutor,
  TipoDeMensagemDoTutor,
} from './tutor/tutor.js'
export {
  esquemaConsultaUsoDoTutor,
  esquemaReferenciaDaUltimaTroca,
  esquemaRespostaUsoDoTutor,
  esquemaUsoDoAluno,
  MAXIMO_DE_ALUNOS_NO_USO,
} from './tutor/uso.js'
export type {
  ConsultaUsoDoTutor,
  RespostaUsoDoTutor,
  UsoDoAluno,
} from './tutor/uso.js'
export {
  esquemaConsultaConsumo,
  esquemaConsultaResumoDaGovernanca,
  esquemaConsumoSomado,
  esquemaFuncaoDaGovernanca,
  esquemaItemDaGovernanca,
  esquemaPedidoSuspenderFuncao,
  esquemaRespostaConsumo,
  esquemaRespostaFuncaoDaGovernanca,
  esquemaRespostaFuncoesDaGovernanca,
  esquemaRespostaResumoDaGovernanca,
  esquemaSuspensaoVigente,
  MOTIVOS_DE_SUSPENSAO,
  NOME_DO_MOTIVO_DE_SUSPENSAO,
} from './governanca/governanca.js'
export type {
  ConsultaConsumo,
  ConsultaResumoDaGovernanca,
  ConsumoSomado,
  FuncaoDaGovernanca,
  ItemDaGovernanca,
  MotivoDeSuspensao,
  PedidoSuspenderFuncao,
  RespostaConsumo,
  RespostaFuncaoDaGovernanca,
  RespostaFuncoesDaGovernanca,
  RespostaResumoDaGovernanca,
} from './governanca/governanca.js'
export {
  esquemaAlertaDoAnalista,
  esquemaConsultaAnalistaNominal,
  esquemaConteudoDoResumoDoAnalista,
  esquemaPedidoGerarResumoDoAnalista,
  esquemaRecorteDoAnalista,
  esquemaRecorteNominal,
  esquemaRespostaAnalistaNominal,
  esquemaRespostaResumoDoAnalista,
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
  ConsultaAnalistaNominal,
  ConteudoDoResumoDoAnalista,
  FinalidadeDaLeituraNominal,
  HipoteseDoAnalista,
  PedidoGerarResumoDoAnalista,
  RecorteDoAnalista,
  RespostaAnalistaNominal,
  RespostaResumoDoAnalista,
  TipoDeAlertaDoAnalista,
} from './governanca/analista.js'
export {
  ajusteDeRetencaoCabe,
  AUTOR_DA_ROTINA,
  CATEGORIAS_DE_RETENCAO,
  CHAVES_DE_PRAZO_FIXO,
  CHAVES_DE_RETENCAO,
  esquemaPrazoFixo,
  esquemaRespostaRetencao,
  esquemaRetencaoDaCategoria,
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
  RespostaRetencao,
  RetencaoDaCategoria,
} from './privacidade/retencao.js'
export {
  esquemaBaixarArquivoDaEscola,
  esquemaPedidoDeMeusDados,
  esquemaRespostaDoArquivo,
  esquemaRespostaMeusDados,
  FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR,
  FINALIDADES_DO_ARQUIVO,
  FINALIDADES_DO_ARQUIVO_DA_ESCOLA,
  HORAS_EM_PREPARACAO_PARA_ALERTAR,
  nomeDoArquivoDoTitular,
  TIPO_DO_JOB_MONTAR_ARQUIVO,
  TIPOS_DE_PEDIDO_COM_ARQUIVO,
  VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS,
  VALIDADE_DO_ARQUIVO_DIAS,
  VERSOES_DO_ARQUIVO,
} from './privacidade/arquivo.js'
export type { BaixarArquivoDaEscola, FinalidadeDoArquivo, PedidoDeMeusDados, RespostaDoArquivo, RespostaMeusDados, VersaoDoArquivo } from './privacidade/arquivo.js'
export { CLASSIFICACAO_DAS_TABELAS, COLUNAS_FORA_DO_ARQUIVO } from './privacidade/classificacao.js'
export type { ArquivoDaTabela, ClasseDaTabela, ClassificacaoDaTabela } from './privacidade/classificacao.js'
export {
  ALCANCES_DO_SUBOPERADOR,
  CATEGORIAS_DE_DADO_DO_SUBOPERADOR,
  CHAVES_DE_CATEGORIA_DO_SUBOPERADOR,
  esquemaRespostaSuboperadores,
  esquemaSuboperadorDaEscola,
  FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
  FORMATO_DA_CHAVE_DO_SUBOPERADOR,
  FORMATO_DO_CONTRATO_DO_SUBOPERADOR,
  FORMATO_DO_PAIS_DO_SUBOPERADOR,
  MAXIMO_DA_FINALIDADE_DO_SUBOPERADOR,
  MAXIMO_DO_NOME_DO_SUBOPERADOR,
} from './privacidade/suboperador.js'
export type { AlcanceDoSuboperador, CategoriaDeDadoDoSuboperador, RespostaSuboperadores, SuboperadorDaEscola } from './privacidade/suboperador.js'
export {
  CATEGORIAS_DE_DADO_DO_INCIDENTE,
  CHAVES_DE_CATEGORIA_DO_INCIDENTE,
  esquemaIncidenteDaEscola,
  esquemaRespostaIncidentes,
  FINALIDADE_DO_REGISTRO_DE_INCIDENTE,
  HORAS_PARA_A_ESCOLA_CONFIRMAR,
  MAXIMO_DE_ESCOLAS_DO_INCIDENTE,
  MAXIMO_DE_TITULARES_ESTIMADOS,
  MAXIMO_DO_TEXTO_DO_INCIDENTE,
  RISCOS_DO_INCIDENTE,
  TEXTO_DO_PRAZO_LEGAL_DO_INCIDENTE,
} from './privacidade/incidente.js'
export type { CategoriaDeDadoDoIncidente, IncidenteDaEscola, RespostaIncidentes, RiscoDoIncidente } from './privacidade/incidente.js'
export {
  CATEGORIAS_DE_CADASTRO_E_VINCULO,
  ESTADOS_ABERTOS_DO_PEDIDO,
  ESTADOS_DO_PEDIDO,
  ESTADOS_DO_TITULAR,
  esquemaBuscaDeTitulares,
  esquemaCompartilhamento,
  esquemaCorrecaoDeNome,
  esquemaItemDoPedido,
  esquemaLinhaDoCompartilhamento,
  esquemaPedidoDoTitular,
  esquemaRegistroDePedido,
  esquemaRespostaBuscaDeTitulares,
  esquemaRespostaPedidos,
  esquemaRespostaPreviaDoTitular,
  esquemaTitularAchado,
  esquemaTitularDoPedido,
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
  TIPO_DO_JOB_ELIMINAR_TITULAR,
  SOLICITANTES_DO_PEDIDO,
  TIPOS_DE_PEDIDO_DO_TITULAR,
} from './privacidade/titular.js'
export type {
  Compartilhamento,
  EstadoDoPedido,
  EstadoDoTitular,
  ItemDoPedido,
  LinhaDoCompartilhamento,
  OrigemDoCompartilhamento,
  PapelDoTitular,
  PedidoDoTitular,
  RegistroDePedido,
  CorrecaoDeNome,
  RespostaBuscaDeTitulares,
  RespostaPedidos,
  RespostaPreviaDoTitular,
  SolicitanteDoPedido,
  TipoDePedidoDoTitular,
  TitularAchado,
  TitularDoPedido,
} from './privacidade/titular.js'
