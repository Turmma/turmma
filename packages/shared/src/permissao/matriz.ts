/**
 * Quem pode chamar o quê, declarado num lugar só (RF17). Toda rota autenticada da API aponta para uma célula
 * daqui com `@RequirePermissao(recurso, acao)`, e a guarda de permissão barra pelo papel da sessão.
 *
 * O alcance diz até onde a célula chega, e é o repository que o aplica ao objeto (regra 10, item 4):
 * - `nunca`: o papel não chama a rota, e ela responde como inexistente;
 * - `proprio`: só o que é da própria pessoa (a sessão, o próprio vínculo, o próprio indicador);
 * - `turma_vinculada`: só turma com vínculo confirmado da pessoa;
 * - `unidade`: a escola do contexto inteira;
 * - `agregado`: só números somados, nunca uma pessoa identificável;
 * - `nominal_auditado`: pessoa identificada, com finalidade e registro em auditoria.
 *
 * A matriz de visibilidade da regra 60, item 11: a rede vê agregado; a coordenação vê a unidade; o professor
 * vê as turmas dele; o aluno vê a si. O indicador de professor segue a regra 70, item 8 (D45).
 */

/** O papel da pessoa na escola. A rede só é declarada aqui: no F1 ela não tem usuário nem rota (F14). */
export const PAPEIS = ['rede', 'coordenador', 'professor', 'aluno'] as const
export type Papel = (typeof PAPEIS)[number]

/** Os papéis que um `usuario` pode ter numa escola. */
export const PAPEIS_DE_USUARIO = ['coordenador', 'professor', 'aluno'] as const satisfies readonly Papel[]
export type PapelDeUsuario = (typeof PAPEIS_DE_USUARIO)[number]

export const ALCANCES = ['nunca', 'proprio', 'turma_vinculada', 'unidade', 'agregado', 'nominal_auditado'] as const
export type Alcance = (typeof ALCANCES)[number]

/** Os alcances que identificam uma pessoa. A rede nunca tem nenhum deles (regra 10, item 8). */
export const ALCANCES_INDIVIDUAIS = ['proprio', 'turma_vinculada', 'unidade', 'nominal_auditado'] as const satisfies readonly Alcance[]

/** Os recursos e as ações de cada um: as rotas do F1 (Tech Spec, seção 4), as do F0 e o indicador de professor. */
export const RECURSOS = {
  /** `GET /v1/sistema/contexto`: a própria sessão. */
  sistema_contexto: ['ler'],
  /** `/v1/sistema/jobs-sinteticos`: só teste e carga, com `ROTAS_SINTETICAS=true`. */
  sistema_job_sintetico: ['criar', 'ler'],
  /** `GET /v1/eu`; `concluir_introducao` é `POST /v1/eu/introducao`, a pessoa marcando que viu a introdução. */
  eu: ['ler', 'concluir_introducao'],
  /** `POST /v1/sessao/atividade`, `DELETE /v1/sessao` e `POST /v1/sessao/escola` com token. */
  sessao: ['registrar_atividade', 'encerrar', 'trocar_escola'],
  /** `PUT /v1/escola/provedores` e `PUT /v1/escola/sessao`. */
  escola_configuracao: ['alterar'],
  ano_letivo: ['ler', 'criar', 'abrir', 'encerrar'],
  serie: ['ler', 'criar'],
  /** `renomear` e `excluir` são `PATCH` e `DELETE /v1/disciplinas/:id` (A1, 1.0), só da coordenação. */
  disciplina: ['ler', 'criar', 'renomear', 'excluir'],
  /**
   * `ler` é a turma aberta por id (`GET /v1/turmas/:id`, 9.0); `listar` é a listagem do ano em curso, só da coordenação;
   * `renomear` e `excluir` são `PATCH` e `DELETE /v1/turmas/:id` (A1, 1.0), também só dela.
   */
  turma: ['ler', 'listar', 'criar', 'renomear', 'excluir'],
  /** `GET /v1/turmas/:id/alunos`. */
  aluno_da_turma: ['ler'],
  /**
   * A lista de nomes da turma (A1, 2.0), só da coordenação: `previa` e `gravar` são `POST /v1/turmas/:id/lista/previa` e
   * `POST /v1/turmas/:id/lista`; `acrescentar`, `POST /v1/turmas/:id/lista/nome`; `retirar`, `DELETE /v1/lista-nomes/:id`;
   * `ler`, `GET /v1/turmas/:id/lista`, com finalidade e auditoria.
   */
  lista_nome: ['ler', 'previa', 'gravar', 'acrescentar', 'retirar'],
  /**
   * O acesso da turma (A1, 4.0), só do professor com vínculo confirmado na turma: `gerar` é `POST /v1/turmas/:id/acesso`;
   * `ler`, `GET /v1/turmas/:id/acesso` (só a validade); `revogar`, `POST /v1/turmas/:id/acesso/revogar`. A coordenação não
   * gera acesso (E27): decide os pedidos, na 8.0.
   */
  acesso_turma: ['gerar', 'ler', 'revogar'],
  /**
   * Os pedidos de reivindicação da turma (A1, 8.0): `ler` é `GET /v1/turmas/:id/reivindicacoes`, os pendentes com nome e
   * hora; `decidir`, `POST /v1/reivindicacoes/decidir`, aprovar ou recusar os selecionados. O professor só na turma com
   * vínculo confirmado; a coordenação em qualquer turma, e a leitura com finalidade e auditoria.
   */
  reivindicacao: ['ler', 'decidir'],
  /** `GET /v1/minha-turma` (A1, 8.0): o aluno aprovado vê a própria turma, e só ele. */
  minha_turma: ['ler'],
  /** Criar e encerrar é da coordenação; confirmar e contestar, do professor dono. */
  vinculo: ['ler', 'criar', 'encerrar', 'ler_proprios', 'confirmar', 'contestar'],
  /** `POST /v1/usuarios/:id/mfa/redefinir`. */
  usuario_mfa: ['redefinir'],
  /**
   * Os professores da escola (A1, 3.0), só da coordenação: `listar` e `cadastrar` são `GET` e `POST /v1/professores`;
   * `refazer_convite` e `revogar_convite`, `POST /v1/professores/:usuarioId/convite/{refazer,revogar}`.
   */
  professor: ['listar', 'cadastrar', 'refazer_convite', 'revogar_convite'],
  /** Uso e desempenho das turmas de um professor (D45): o agregado e o nominal são leituras diferentes. */
  indicador_professor: ['ler_agregado', 'ler_nominal'],
  /**
   * O material da escola (MVP, A2; D75): `enviar`, `listar`, `ler` e `excluir` são `POST`, `GET`, `GET /:id` e `DELETE` de
   * `/v1/materiais`; `buscar`, `GET /v1/materiais/busca`. Só a coordenação envia e exclui. O professor lê e busca só o das
   * disciplinas em que tem vínculo confirmado; o aluno não lê material (o Tutor lê por ele, no servidor).
   */
  material: ['enviar', 'listar', 'ler', 'excluir', 'buscar'],
  /** `GET /v1/time` (MVP, A2): os agentes, as funções, a autonomia e a suspensão na escola. Catálogo, sem dado de pessoa. */
  time: ['ler'],
  /**
   * A conversa do professor com o Assistente de ensino (MVP, A2): `ler_conversa` é `GET /v1/assistente/conversa`;
   * `enviar_mensagem`, `POST /v1/assistente/mensagens`. Só o próprio professor: a coordenação nunca a lê (regra 70, item 8).
   */
  assistente: ['ler_conversa', 'enviar_mensagem'],
  /** `GET /v1/execucoes/:id` (MVP): só quem pediu a execução a consulta. */
  execucao: ['ler'],
  /** `POST /v1/ferramentas/:ferramenta/gerar` (MVP, A2; D18): o professor, para turma e disciplina com vínculo confirmado dele. */
  ferramenta: ['gerar'],
  /**
   * O artefato (MVP, A2): `listar` e `ler` são `GET /v1/artefatos` e `GET /v1/artefatos/:id`; `renomear`, o `PATCH`;
   * `exportar`, `GET /v1/artefatos/:id/pdf`; `adaptar`, `POST /v1/artefatos/:id/adaptar`. Só o professor da turma do
   * artefato. O aluno nunca lê artefato: recebe a prova pela atividade aplicada.
   */
  artefato: ['listar', 'ler', 'renomear', 'exportar', 'adaptar'],
  /**
   * A entrega pendente de decisão (MVP; regra 70, item 3): `listar` é `GET /v1/entregas`; `decidir`,
   * `POST /v1/entregas/:id/decidir`; `aprovar_lote`, `POST /v1/entregas/:id/aprovar-lote`, com o registro da validação
   * (D56). Só o professor da turma decide: a coordenação não aprova no lugar dele.
   */
  entrega: ['listar', 'decidir', 'aprovar_lote'],
  /** A atividade aplicada (MVP, A3), do professor da turma: `aplicar`, `listar` e `encerrar` são as três rotas de `/v1/atividades-aplicadas`. */
  atividade_aplicada: ['aplicar', 'listar', 'encerrar'],
  /**
   * O lado do aluno na atividade (MVP, A3), só dele: `listar` é `GET /v1/minhas-atividades`; `ler_prova`, `responder`,
   * `enviar` e `ler_diagnostico` são `GET …/prova`, `PUT …/respostas/:questao`, `POST …/enviar` e `GET …/meu-diagnostico`.
   */
  minha_atividade: ['listar', 'ler_prova', 'responder', 'enviar', 'ler_diagnostico'],
  /** A correção do lote (MVP, A3; D33, D56), do professor da turma: `ler` é `GET …/correcao`; `abrir_destaque`, o `POST …/destaques/:alunoId/abrir`. */
  correcao: ['ler', 'abrir_destaque'],
  /**
   * `GET /v1/turmas/:id/desempenho` (MVP, A3): o professor lê a turma dele. A coordenação lê com finalidade e auditoria,
   * porque a resposta nomeia alunos (D34) e a turma numa disciplina é de um professor só (D45).
   */
  desempenho_da_turma: ['ler'],
  /** O Tutor (MVP, A4), só do aluno: `enviar_mensagem`, `ler_conversa` e `ler_memoria` são as três rotas de `/v1/tutor`. */
  tutor: ['enviar_mensagem', 'ler_conversa', 'ler_memoria'],
  /** `GET /v1/sinais` (MVP, A4): os sinais do Tutor, só para o professor da turma (D34). A coordenação vê só a soma, no Analista. */
  sinal: ['ler'],
  /**
   * `GET /v1/tutor/uso` (MVP, A4; D8, D47; regra 70, item 4): o uso do Tutor por aluno, só para o professor da turma. É o
   * que faz não existir uso invisível a ele. A coordenação não lê uso nominal de aluno, e o aluno não lê o dos colegas.
   */
  uso_do_tutor: ['ler'],
  /**
   * A governança de IA (MVP, A5), só da coordenação: `ler_resumo`, `ler_funcoes` e `ler_consumo` são os três `GET` de
   * `/v1/governanca`; `suspender_funcao` e `retomar_funcao`, os dois `POST` de `/v1/governanca/funcoes/:chave`. O resumo
   * e o consumo são agregados: sem professor, sem turma, sem aluno.
   */
  governanca: ['ler_resumo', 'ler_funcoes', 'suspender_funcao', 'retomar_funcao', 'ler_consumo'],
  /**
   * O Analista de desempenho escolar (MVP, A5), só da coordenação: `ler_resumo` é `GET /v1/analista/resumo`, agregado
   * com grupo mínimo (D45); `gerar`, `POST /v1/analista/gerar`; `ler_nominal`, `GET /v1/analista/nominal`, com
   * finalidade e auditoria.
   */
  analista: ['ler_resumo', 'gerar', 'ler_nominal'],
  /**
   * A privacidade da escola (F3), só da coordenação: `ler` é `GET /v1/privacidade/retencao`, o prazo de cada categoria,
   * sem pessoa. Ajustar é só da operação, por comando (`ops:retencao`), e não tem rota.
   */
  privacidade_retencao: ['ler'],
  /**
   * Os suboperadores da escola (F3, 8.0), só da coordenação: `ler` é `GET /v1/privacidade/suboperadores`, as empresas que
   * recebem dado da escola dela, vigentes e passadas, sem pessoa. Cadastrar e encerrar é só da operação, por comando
   * (`ops:suboperador`), e não tem rota.
   */
  privacidade_suboperadores: ['ler'],
  /**
   * Os incidentes de segurança que afetaram a escola (F3, 9.0), só da coordenação: `ler` é `GET /v1/privacidade/incidentes`,
   * só a seção da escola dela; `confirmar`, `POST /v1/privacidade/incidentes/:id/confirmar`, que guarda quem recebeu o aviso e
   * quando. Registrar é só da operação, por comando (`ops:incidente`), e não tem rota.
   */
  privacidade_incidentes: ['ler', 'confirmar'],
  /**
   * Achar o titular antes de registrar o pedido (F3, 11.0), só da coordenação: `buscar` é `POST
   * /v1/privacidade/titulares/busca`, com o limite próprio `rl:busca-titular`; `previa`, `GET
   * /v1/privacidade/titulares/:id/previa`, com finalidade e auditoria. Só quem é `usuario` da escola é achado: o aluno
   * que só está na lista de nomes é atendido pela lista da turma (A1).
   */
  privacidade_titulares: ['buscar', 'previa'],
  /**
   * Os pedidos do titular (F3, 11.0), só da coordenação: `registrar`, `listar` e `ler` são `POST`, `GET` e `GET /:id` de
   * `/v1/privacidade/pedidos`; `concluir`, `cancelar` e `corrigir_nome`, os `POST /:id/concluir`, `/:id/cancelar` (14.0: só a eliminação `agendada`, que devolve
   * o acesso) e `/:id/corrigir-nome`. Cada leitura
   * vai para a auditoria com finalidade, e nada alcança o pedido sobre a própria pessoa (mesma `conta_id`). `arquivo` é
   * `POST /:id/arquivo` (13.0): a URL de 5 minutos da versão da escola do titular sem conta ativa, com a finalidade e a
   * auditoria `titular.arquivo_baixado`. A versão completa **nunca** sai por aqui.
   */
  privacidade_pedidos: ['registrar', 'listar', 'ler', 'concluir', 'cancelar', 'corrigir_nome', 'arquivo'],
  /**
   * "Meus dados", do aluno e do professor (F3, 13.0): `listar` é `GET /v1/meus-dados`, os pedidos da própria pessoa na
   * escola ativa; `baixar`, `POST /v1/meus-dados/:id/baixar`, a URL de 5 minutos da versão completa do arquivo dela. É o
   * único caminho da versão completa. A coordenação não é titular de pedido, então não tem a célula.
   */
  meus_dados: ['listar', 'baixar'],
} as const satisfies Record<string, readonly string[]>

export type Recurso = keyof typeof RECURSOS
export type AcaoDe<R extends Recurso> = (typeof RECURSOS)[R][number]

type CelulasDoPapel = { readonly [R in Recurso]: { readonly [A in AcaoDe<R>]: Alcance } }

export const MATRIZ: { readonly [P in Papel]: CelulasDoPapel } = {
  rede: {
    sistema_contexto: { ler: 'nunca' },
    sistema_job_sintetico: { criar: 'nunca', ler: 'nunca' },
    eu: { ler: 'nunca', concluir_introducao: 'nunca' },
    sessao: { registrar_atividade: 'nunca', encerrar: 'nunca', trocar_escola: 'nunca' },
    escola_configuracao: { alterar: 'nunca' },
    ano_letivo: { ler: 'nunca', criar: 'nunca', abrir: 'nunca', encerrar: 'nunca' },
    serie: { ler: 'nunca', criar: 'nunca' },
    disciplina: { ler: 'nunca', criar: 'nunca', renomear: 'nunca', excluir: 'nunca' },
    turma: { ler: 'nunca', listar: 'nunca', criar: 'nunca', renomear: 'nunca', excluir: 'nunca' },
    aluno_da_turma: { ler: 'nunca' },
    lista_nome: { ler: 'nunca', previa: 'nunca', gravar: 'nunca', acrescentar: 'nunca', retirar: 'nunca' },
    acesso_turma: { gerar: 'nunca', ler: 'nunca', revogar: 'nunca' },
    reivindicacao: { ler: 'nunca', decidir: 'nunca' },
    minha_turma: { ler: 'nunca' },
    vinculo: { ler: 'nunca', criar: 'nunca', encerrar: 'nunca', ler_proprios: 'nunca', confirmar: 'nunca', contestar: 'nunca' },
    usuario_mfa: { redefinir: 'nunca' },
    professor: { listar: 'nunca', cadastrar: 'nunca', refazer_convite: 'nunca', revogar_convite: 'nunca' },
    indicador_professor: { ler_agregado: 'agregado', ler_nominal: 'nunca' },
    material: { enviar: 'nunca', listar: 'nunca', ler: 'nunca', excluir: 'nunca', buscar: 'nunca' },
    time: { ler: 'nunca' },
    assistente: { ler_conversa: 'nunca', enviar_mensagem: 'nunca' },
    execucao: { ler: 'nunca' },
    ferramenta: { gerar: 'nunca' },
    artefato: { listar: 'nunca', ler: 'nunca', renomear: 'nunca', exportar: 'nunca', adaptar: 'nunca' },
    entrega: { listar: 'nunca', decidir: 'nunca', aprovar_lote: 'nunca' },
    atividade_aplicada: { aplicar: 'nunca', listar: 'nunca', encerrar: 'nunca' },
    minha_atividade: { listar: 'nunca', ler_prova: 'nunca', responder: 'nunca', enviar: 'nunca', ler_diagnostico: 'nunca' },
    correcao: { ler: 'nunca', abrir_destaque: 'nunca' },
    desempenho_da_turma: { ler: 'nunca' },
    tutor: { enviar_mensagem: 'nunca', ler_conversa: 'nunca', ler_memoria: 'nunca' },
    sinal: { ler: 'nunca' },
    uso_do_tutor: { ler: 'nunca' },
    governanca: { ler_resumo: 'nunca', ler_funcoes: 'nunca', suspender_funcao: 'nunca', retomar_funcao: 'nunca', ler_consumo: 'nunca' },
    analista: { ler_resumo: 'nunca', gerar: 'nunca', ler_nominal: 'nunca' },
    privacidade_retencao: { ler: 'nunca' },
    privacidade_suboperadores: { ler: 'nunca' },
    privacidade_incidentes: { ler: 'nunca', confirmar: 'nunca' },
    privacidade_titulares: { buscar: 'nunca', previa: 'nunca' },
    privacidade_pedidos: { registrar: 'nunca', listar: 'nunca', ler: 'nunca', concluir: 'nunca', cancelar: 'nunca', corrigir_nome: 'nunca', arquivo: 'nunca' },
    meus_dados: { listar: 'nunca', baixar: 'nunca' },
  },
  coordenador: {
    sistema_contexto: { ler: 'proprio' },
    sistema_job_sintetico: { criar: 'unidade', ler: 'unidade' },
    eu: { ler: 'proprio', concluir_introducao: 'proprio' },
    sessao: { registrar_atividade: 'proprio', encerrar: 'proprio', trocar_escola: 'proprio' },
    escola_configuracao: { alterar: 'unidade' },
    ano_letivo: { ler: 'unidade', criar: 'unidade', abrir: 'unidade', encerrar: 'unidade' },
    serie: { ler: 'unidade', criar: 'unidade' },
    disciplina: { ler: 'unidade', criar: 'unidade', renomear: 'unidade', excluir: 'unidade' },
    turma: { ler: 'unidade', listar: 'unidade', criar: 'unidade', renomear: 'unidade', excluir: 'unidade' },
    aluno_da_turma: { ler: 'nominal_auditado' },
    lista_nome: { ler: 'nominal_auditado', previa: 'unidade', gravar: 'unidade', acrescentar: 'unidade', retirar: 'unidade' },
    acesso_turma: { gerar: 'nunca', ler: 'nunca', revogar: 'nunca' },
    reivindicacao: { ler: 'nominal_auditado', decidir: 'unidade' },
    minha_turma: { ler: 'nunca' },
    vinculo: { ler: 'unidade', criar: 'unidade', encerrar: 'unidade', ler_proprios: 'nunca', confirmar: 'nunca', contestar: 'nunca' },
    usuario_mfa: { redefinir: 'unidade' },
    professor: { listar: 'unidade', cadastrar: 'unidade', refazer_convite: 'unidade', revogar_convite: 'unidade' },
    indicador_professor: { ler_agregado: 'agregado', ler_nominal: 'nominal_auditado' },
    material: { enviar: 'unidade', listar: 'unidade', ler: 'unidade', excluir: 'unidade', buscar: 'unidade' },
    time: { ler: 'unidade' },
    assistente: { ler_conversa: 'nunca', enviar_mensagem: 'nunca' },
    execucao: { ler: 'proprio' },
    ferramenta: { gerar: 'nunca' },
    artefato: { listar: 'nunca', ler: 'nunca', renomear: 'nunca', exportar: 'nunca', adaptar: 'nunca' },
    entrega: { listar: 'nunca', decidir: 'nunca', aprovar_lote: 'nunca' },
    atividade_aplicada: { aplicar: 'nunca', listar: 'nunca', encerrar: 'nunca' },
    minha_atividade: { listar: 'nunca', ler_prova: 'nunca', responder: 'nunca', enviar: 'nunca', ler_diagnostico: 'nunca' },
    correcao: { ler: 'nunca', abrir_destaque: 'nunca' },
    desempenho_da_turma: { ler: 'nominal_auditado' },
    tutor: { enviar_mensagem: 'nunca', ler_conversa: 'nunca', ler_memoria: 'nunca' },
    sinal: { ler: 'nunca' },
    uso_do_tutor: { ler: 'nunca' },
    governanca: { ler_resumo: 'agregado', ler_funcoes: 'unidade', suspender_funcao: 'unidade', retomar_funcao: 'unidade', ler_consumo: 'agregado' },
    analista: { ler_resumo: 'agregado', gerar: 'unidade', ler_nominal: 'nominal_auditado' },
    privacidade_retencao: { ler: 'unidade' },
    privacidade_suboperadores: { ler: 'unidade' },
    privacidade_incidentes: { ler: 'unidade', confirmar: 'unidade' },
    privacidade_titulares: { buscar: 'unidade', previa: 'unidade' },
    privacidade_pedidos: { registrar: 'unidade', listar: 'unidade', ler: 'unidade', concluir: 'unidade', cancelar: 'unidade', corrigir_nome: 'unidade', arquivo: 'unidade' },
    meus_dados: { listar: 'nunca', baixar: 'nunca' },
  },
  professor: {
    sistema_contexto: { ler: 'proprio' },
    sistema_job_sintetico: { criar: 'unidade', ler: 'unidade' },
    eu: { ler: 'proprio', concluir_introducao: 'proprio' },
    sessao: { registrar_atividade: 'proprio', encerrar: 'proprio', trocar_escola: 'proprio' },
    escola_configuracao: { alterar: 'nunca' },
    ano_letivo: { ler: 'nunca', criar: 'nunca', abrir: 'nunca', encerrar: 'nunca' },
    serie: { ler: 'nunca', criar: 'nunca' },
    disciplina: { ler: 'nunca', criar: 'nunca', renomear: 'nunca', excluir: 'nunca' },
    turma: { ler: 'turma_vinculada', listar: 'nunca', criar: 'nunca', renomear: 'nunca', excluir: 'nunca' },
    aluno_da_turma: { ler: 'turma_vinculada' },
    lista_nome: { ler: 'nunca', previa: 'nunca', gravar: 'nunca', acrescentar: 'nunca', retirar: 'nunca' },
    acesso_turma: { gerar: 'turma_vinculada', ler: 'turma_vinculada', revogar: 'turma_vinculada' },
    reivindicacao: { ler: 'turma_vinculada', decidir: 'turma_vinculada' },
    minha_turma: { ler: 'nunca' },
    vinculo: { ler: 'nunca', criar: 'nunca', encerrar: 'nunca', ler_proprios: 'proprio', confirmar: 'proprio', contestar: 'proprio' },
    usuario_mfa: { redefinir: 'nunca' },
    professor: { listar: 'nunca', cadastrar: 'nunca', refazer_convite: 'nunca', revogar_convite: 'nunca' },
    indicador_professor: { ler_agregado: 'nunca', ler_nominal: 'proprio' },
    material: { enviar: 'nunca', listar: 'turma_vinculada', ler: 'turma_vinculada', excluir: 'nunca', buscar: 'turma_vinculada' },
    time: { ler: 'unidade' },
    assistente: { ler_conversa: 'proprio', enviar_mensagem: 'proprio' },
    execucao: { ler: 'proprio' },
    ferramenta: { gerar: 'turma_vinculada' },
    artefato: { listar: 'turma_vinculada', ler: 'turma_vinculada', renomear: 'turma_vinculada', exportar: 'turma_vinculada', adaptar: 'turma_vinculada' },
    entrega: { listar: 'turma_vinculada', decidir: 'turma_vinculada', aprovar_lote: 'turma_vinculada' },
    atividade_aplicada: { aplicar: 'turma_vinculada', listar: 'turma_vinculada', encerrar: 'turma_vinculada' },
    minha_atividade: { listar: 'nunca', ler_prova: 'nunca', responder: 'nunca', enviar: 'nunca', ler_diagnostico: 'nunca' },
    correcao: { ler: 'turma_vinculada', abrir_destaque: 'turma_vinculada' },
    desempenho_da_turma: { ler: 'turma_vinculada' },
    tutor: { enviar_mensagem: 'nunca', ler_conversa: 'nunca', ler_memoria: 'nunca' },
    sinal: { ler: 'turma_vinculada' },
    uso_do_tutor: { ler: 'turma_vinculada' },
    governanca: { ler_resumo: 'nunca', ler_funcoes: 'nunca', suspender_funcao: 'nunca', retomar_funcao: 'nunca', ler_consumo: 'nunca' },
    analista: { ler_resumo: 'nunca', gerar: 'nunca', ler_nominal: 'nunca' },
    privacidade_retencao: { ler: 'nunca' },
    privacidade_suboperadores: { ler: 'nunca' },
    privacidade_incidentes: { ler: 'nunca', confirmar: 'nunca' },
    privacidade_titulares: { buscar: 'nunca', previa: 'nunca' },
    privacidade_pedidos: { registrar: 'nunca', listar: 'nunca', ler: 'nunca', concluir: 'nunca', cancelar: 'nunca', corrigir_nome: 'nunca', arquivo: 'nunca' },
    meus_dados: { listar: 'proprio', baixar: 'proprio' },
  },
  aluno: {
    sistema_contexto: { ler: 'proprio' },
    sistema_job_sintetico: { criar: 'nunca', ler: 'nunca' },
    eu: { ler: 'proprio', concluir_introducao: 'proprio' },
    sessao: { registrar_atividade: 'proprio', encerrar: 'proprio', trocar_escola: 'nunca' },
    escola_configuracao: { alterar: 'nunca' },
    ano_letivo: { ler: 'nunca', criar: 'nunca', abrir: 'nunca', encerrar: 'nunca' },
    serie: { ler: 'nunca', criar: 'nunca' },
    disciplina: { ler: 'nunca', criar: 'nunca', renomear: 'nunca', excluir: 'nunca' },
    turma: { ler: 'nunca', listar: 'nunca', criar: 'nunca', renomear: 'nunca', excluir: 'nunca' },
    aluno_da_turma: { ler: 'nunca' },
    lista_nome: { ler: 'nunca', previa: 'nunca', gravar: 'nunca', acrescentar: 'nunca', retirar: 'nunca' },
    acesso_turma: { gerar: 'nunca', ler: 'nunca', revogar: 'nunca' },
    reivindicacao: { ler: 'nunca', decidir: 'nunca' },
    minha_turma: { ler: 'proprio' },
    vinculo: { ler: 'nunca', criar: 'nunca', encerrar: 'nunca', ler_proprios: 'nunca', confirmar: 'nunca', contestar: 'nunca' },
    usuario_mfa: { redefinir: 'nunca' },
    professor: { listar: 'nunca', cadastrar: 'nunca', refazer_convite: 'nunca', revogar_convite: 'nunca' },
    indicador_professor: { ler_agregado: 'nunca', ler_nominal: 'nunca' },
    material: { enviar: 'nunca', listar: 'nunca', ler: 'nunca', excluir: 'nunca', buscar: 'nunca' },
    time: { ler: 'nunca' },
    assistente: { ler_conversa: 'nunca', enviar_mensagem: 'nunca' },
    execucao: { ler: 'proprio' },
    ferramenta: { gerar: 'nunca' },
    artefato: { listar: 'nunca', ler: 'nunca', renomear: 'nunca', exportar: 'nunca', adaptar: 'nunca' },
    entrega: { listar: 'nunca', decidir: 'nunca', aprovar_lote: 'nunca' },
    atividade_aplicada: { aplicar: 'nunca', listar: 'nunca', encerrar: 'nunca' },
    minha_atividade: { listar: 'proprio', ler_prova: 'proprio', responder: 'proprio', enviar: 'proprio', ler_diagnostico: 'proprio' },
    correcao: { ler: 'nunca', abrir_destaque: 'nunca' },
    desempenho_da_turma: { ler: 'nunca' },
    tutor: { enviar_mensagem: 'proprio', ler_conversa: 'proprio', ler_memoria: 'proprio' },
    sinal: { ler: 'nunca' },
    uso_do_tutor: { ler: 'nunca' },
    governanca: { ler_resumo: 'nunca', ler_funcoes: 'nunca', suspender_funcao: 'nunca', retomar_funcao: 'nunca', ler_consumo: 'nunca' },
    analista: { ler_resumo: 'nunca', gerar: 'nunca', ler_nominal: 'nunca' },
    privacidade_retencao: { ler: 'nunca' },
    privacidade_suboperadores: { ler: 'nunca' },
    privacidade_incidentes: { ler: 'nunca', confirmar: 'nunca' },
    privacidade_titulares: { buscar: 'nunca', previa: 'nunca' },
    privacidade_pedidos: { registrar: 'nunca', listar: 'nunca', ler: 'nunca', concluir: 'nunca', cancelar: 'nunca', corrigir_nome: 'nunca', arquivo: 'nunca' },
    meus_dados: { listar: 'proprio', baixar: 'proprio' },
  },
}

/**
 * O alcance da célula. Recurso, ação ou papel fora da matriz dão `nunca`: o que ninguém declarou nasce
 * fechado, mesmo chegando por um texto que o tipo não pegou.
 */
export function alcanceDe(papel: string, recurso: string, acao: string): Alcance {
  if (!Object.hasOwn(MATRIZ, papel)) return 'nunca'
  const celulas: Readonly<Record<string, Readonly<Record<string, Alcance>>>> = MATRIZ[papel as Papel]
  if (!Object.hasOwn(celulas, recurso)) return 'nunca'
  const doRecurso = celulas[recurso] ?? {}
  return Object.hasOwn(doRecurso, acao) ? (doRecurso[acao] ?? 'nunca') : 'nunca'
}
