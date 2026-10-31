import type { CategoriaDeRetencao, ChaveDePrazoFixo } from './retencao.js'

/**
 * Toda tabela das migrations, com o que a faz sair e se ela entra no arquivo do titular (F3, RF1 e RF11; Tech Spec do
 * F3, seção 3, "Classificação de toda tabela"). O teste de arquitetura (`apps/api/test/architecture.test.ts`) confere esta
 * lista contra as migrations, nos dois sentidos: tabela criada sem classificação, ou classificação de tabela que não
 * existe, deixa o teste vermelho. Cada tarefa que cria tabela a classifica aqui na mesma tarefa: as do pedido do
 * titular entram com a migration dela (tarefa 11.0); as do incidente entraram na 9.0 e as do suboperador, na 8.0; a do expurgo entrou na 3.0.
 *
 * As sentinelas do arquivo e da troca de nome (tarefas 13.0 e 15.0) saem desta lista, então uma tabela nova entra nelas
 * sozinha.
 */

/** Como a tabela sai, quando sai. */
export type ClasseDaTabela =
  /** O expurgo da categoria apaga ou anonimiza a linha no prazo da escola (`retencao_escola`). */
  | { readonly classe: 'categoria'; readonly categorias: readonly CategoriaDeRetencao[] }
  /** Um prazo que não se ajusta, aplicado por quem `aplicadoPor` diz. */
  | { readonly classe: 'prazo_fixo'; readonly prazo: ChaveDePrazoFixo; readonly aplicadoPor: string }
  /** A tabela não guarda pessoa: fica enquanto a escola existe. */
  | { readonly classe: 'sem_pessoa' }

/**
 * Se a tabela entra no arquivo do titular, e por quais colunas dela a linha se liga a ele (o id do usuário, da conta ou
 * da linha que aponta para ele). As colunas de `COLUNAS_FORA_DO_ARQUIVO` nunca entram, mesmo de tabela que entra.
 */
export type ArquivoDaTabela = { readonly entra: false } | { readonly entra: true; readonly ligacao: readonly string[] }

export type ClassificacaoDaTabela = ClasseDaTabela & { readonly arquivo: ArquivoDaTabela }

const FORA: ArquivoDaTabela = { entra: false }
const SEM_PESSOA: ClassificacaoDaTabela = { classe: 'sem_pessoa', arquivo: FORA }
const EXPURGO_DE_ACESSO = 'sistema.expurgar-acesso'
const FIM_DE_CONTRATO = 'fim de contrato (F12)'

function categoria(categorias: readonly CategoriaDeRetencao[], ...ligacao: string[]): ClassificacaoDaTabela {
  return { classe: 'categoria', categorias, arquivo: { entra: true, ligacao } }
}

function fixo(prazo: ChaveDePrazoFixo, aplicadoPor: string, ...ligacao: string[]): ClassificacaoDaTabela {
  return { classe: 'prazo_fixo', prazo, aplicadoPor, arquivo: ligacao.length === 0 ? FORA : { entra: true, ligacao } }
}

export const CLASSIFICACAO_DAS_TABELAS: Readonly<Record<string, ClassificacaoDaTabela>> = {
  // Com categoria: o expurgo noturno da escola (tarefas 3.0 a 5.0).
  mensagem_tutor: categoria(['conversa_tutor'], 'aluno_id'),
  sinal_tutor: categoria(['sinal_tutor'], 'aluno_id'),
  mensagem_agente: categoria(['conversa_professor'], 'thread_id'),
  // A thread vazia sai junto com a última mensagem dela.
  thread_agente: categoria(['conversa_professor'], 'usuario_id'),
  execucao_agente: categoria(['execucao_agente'], 'solicitada_por'),
  // A entrada e a saída saem pelo texto do modelo; o aluno, pelo consumo por aluno. A linha, com os números, fica.
  consumo_ia: categoria(['texto_do_modelo', 'consumo_por_aluno'], 'aluno_id', 'execucao_id'),
  tentativa_atividade: categoria(['trabalho_do_aluno'], 'aluno_id'),
  // Saem em cascata com a tentativa.
  resposta_atividade: categoria(['trabalho_do_aluno'], 'aluno_id'),
  correcao: categoria(['trabalho_do_aluno'], 'aluno_id', 'destaque_aberto_por'),
  reivindicacao: categoria(['reivindicacao_decidida'], 'lista_nome_id', 'decidida_por'),
  artefato: categoria(['autoria_de_artefato'], 'criado_por'),
  material: categoria(['material_excluido'], 'enviado_por', 'excluido_por'),
  vinculo: categoria(['vinculo_encerrado'], 'usuario_id'),
  usuario: categoria(['pessoa_desativada'], 'id'),

  // Prazo fixo, com quem aplica.
  registro_acesso: fixo('registro_acesso', EXPURGO_DE_ACESSO, 'usuario_id'),
  sessao: fixo('sessao', EXPURGO_DE_ACESSO, 'usuario_id'),
  convite: fixo('convite_e_acesso_da_turma', EXPURGO_DE_ACESSO),
  acesso_turma: fixo('convite_e_acesso_da_turma', EXPURGO_DE_ACESSO),
  conta: fixo('credencial', 'limpeza da conta (F1)', 'id'),
  codigo_recuperacao: fixo('credencial', 'limpeza da conta (F1)'),
  credencial_matricula: fixo('credencial', 'desativação e eliminação', 'usuario_id'),
  conta_externa: fixo('credencial', 'desativação e eliminação', 'usuario_id'),
  lista_nome: fixo('lista_de_nomes', 'virada do ano (A1) e eliminação', 'usuario_id'),
  operador: fixo('equipe_turmma', 'desativação do operador (A0)'),
  convite_operador: fixo('equipe_turmma', EXPURGO_DE_ACESSO),
  sessao_operador: fixo('equipe_turmma', EXPURGO_DE_ACESSO),
  acesso_operacao: fixo('equipe_turmma', EXPURGO_DE_ACESSO),
  codigo_recuperacao_operador: fixo('equipe_turmma', 'uso do código e desativação do operador (A0)'),
  auditoria_operacao: fixo('equipe_turmma', FIM_DE_CONTRATO),
  job_registro: fixo('tarefa_em_segundo_plano', 'sistema.expurgar-jobs (F0)'),
  auditoria: fixo('registro_de_decisao', FIM_DE_CONTRATO, 'autor_usuario_id'),
  entrega: fixo('registro_de_decisao', FIM_DE_CONTRATO, 'decidida_por'),
  validacao_do_lote: fixo('registro_de_decisao', FIM_DE_CONTRATO, 'confirmada_por'),
  suspensao_de_funcao: fixo('registro_de_decisao', FIM_DE_CONTRATO, 'suspensa_por', 'retomada_por'),
  atividade_aplicada: fixo('registro_de_decisao', FIM_DE_CONTRATO, 'aplicada_por'),
  // O registro do que o expurgo da escola apagou, só com a categoria e a contagem: 5 anos, pelo próprio expurgo (tarefa
  // 5.0). Sem pessoa, e fora do arquivo; fica no grupo do registro de decisão, que é o dos registros de prestação de contas.
  expurgo_execucao: fixo('registro_de_decisao', 'expurgo da escola, 5 anos (tarefa 5.0)'),
  // O incidente de segurança e a seção de cada escola, com quem da escola confirmou o aviso (F3, 9.0): 5 anos do registro, pelo
  // `sistema.expurgar-acesso`, que apaga o incidente e leva as ligações em cascata. Quem confirma é coordenação, que não é titular
  // de pedido (PRD, seção 4), então a tabela fica fora do arquivo.
  incidente: fixo('registro_de_incidente', EXPURGO_DE_ACESSO),
  incidente_escola: fixo('registro_de_incidente', EXPURGO_DE_ACESSO),
  // O pedido do titular à escola (F3, 11.0): id, tipo, quem pediu, datas, estado e a foto do compartilhamento, sem nome nem
  // texto. Vigência + 5 anos, no fim de contrato (F12), como a auditoria que o registra; entra no arquivo do titular, e o
  // registro também entra no de quem o registrou (o `autor` do mapa, `docs/lgpd.md`).
  //
  // A ligação é só `titular_id`, o critério da 13.0 para `registrado_por`, `concluido_por` e `cancelado_por`: o id de quem da
  // coordenação atendeu o pedido é de **outra pessoa**, e não entra no arquivo de quem pediu. A coordenação não é titular
  // de pedido (PRD, seção 4), então o registro dela não tem arquivo para entrar.
  pedido_titular: fixo('registro_de_decisao', FIM_DE_CONTRATO, 'titular_id'),
  // O próprio arquivo do titular (F3, 13.0): o JSON no storage privado, só com a chave do objeto e as datas. 7 dias depois de
  // pronto, apagado do storage e da tabela pela rotina da escola (`retencao.expurgar-escola`); a eliminação da pessoa marca
  // `apagado_em` e os objetos saem na noite seguinte (15.0). Fora do arquivo: seria o arquivo dentro do arquivo.
  arquivo_titular: fixo('arquivo_do_titular', 'retencao.expurgar-escola (13.0)'),

  // Sem pessoa.
  rede: SEM_PESSOA,
  escola: SEM_PESSOA,
  ano_letivo: SEM_PESSOA,
  serie: SEM_PESSOA,
  disciplina: SEM_PESSOA,
  turma: SEM_PESSOA,
  provedor_escola: SEM_PESSOA,
  configuracao_operacional_escola: SEM_PESSOA,
  uso_infra_diario: SEM_PESSOA,
  trecho: SEM_PESSOA,
  resumo_do_analista: SEM_PESSOA,
  // Guarda o apelido do operador que ajustou, da nossa equipe, e nenhuma pessoa da escola.
  retencao_escola: SEM_PESSOA,
  // A empresa que recebe dado da escola (F3, 8.0): nome, finalidade, país e contrato dela, mais o apelido do operador que a
  // cadastrou. Nenhuma pessoa da escola.
  suboperador: SEM_PESSOA,
  suboperador_escola: SEM_PESSOA,
}

/**
 * Colunas que nunca entram no arquivo do titular, em nenhuma versão (Tech Spec do F3, seção 3): todo hash de senha, de
 * token e de cookie, o segredo do segundo fator e o que o acompanha, os códigos de recuperação, a chave de envio e o
 * identificador opaco da conta externa (`sujeito` e `tenant`). Como `tabela.coluna`; o teste de arquitetura confere que
 * cada uma existe, e que toda coluna com nome de segredo (inclusive o estado do segundo fator, `mfa_*`, menos a data de
 * ativação) está aqui. A `chave_objeto` do arquivo (13.0) e a `chave_envio` do pedido (11.0) entraram com as tabelas deles.
 */
export const COLUNAS_FORA_DO_ARQUIVO: readonly string[] = [
  'conta.senha_hash',
  'conta.mfa_segredo_cifrado',
  'conta.mfa_chave_versao',
  'conta.mfa_ultimo_passo',
  'codigo_recuperacao.hmac',
  'credencial_matricula.senha_hash',
  'conta_externa.sujeito',
  'conta_externa.tenant',
  'sessao.refresh_hash',
  'sessao.refresh_hash_anterior',
  'convite.token_hash',
  'acesso_turma.token_hash',
  'acesso_turma.codigo_hmac',
  'reivindicacao.senha_hash',
  'reivindicacao.chave_envio',
  'execucao_agente.chave_envio',
  'pedido_titular.chave_envio',
  'arquivo_titular.chave_objeto',
  'operador.senha_hash',
  'operador.mfa_segredo_cifrado',
  'operador.mfa_chave_versao',
  'operador.mfa_versao',
  'operador.mfa_ultimo_passo',
  'codigo_recuperacao_operador.hmac',
  'convite_operador.token_hash',
  'sessao_operador.refresh_hash',
  'sessao_operador.refresh_hash_anterior',
]
