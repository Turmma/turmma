import { z } from 'zod'
import {
  ALCANCES_DO_SUBOPERADOR,
  CHAVES_DE_FUNCAO,
  CHAVES_DE_RETENCAO,
  CONTESTACOES_DE_VINCULO,
  DECISORES_DA_REIVINDICACAO,
  InvariantException,
  JOB_DEFINITIONS,
  ESTADOS_DE_MATERIAL,
  ESTADOS_DE_VINCULO,
  ETAPAS,
  ESTADOS_DO_PEDIDO,
  ESTADOS_EM_DECISAO,
  FINALIDADE_DA_LEITURA_DO_ALVO,
  FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR,
  FINALIDADE_DO_ATENDIMENTO_DO_TITULAR,
  FINALIDADE_DO_AJUSTE_DE_RETENCAO,
  FINALIDADE_DO_REGISTRO_DE_INCIDENTE,
  FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR,
  FINALIDADES_DA_LEITURA_DE_ALUNOS,
  FINALIDADES_DO_ARQUIVO,
  FINALIDADES_DA_LEITURA_NOMINAL,
  FINALIDADES_DA_REDEFINICAO_DE_MFA,
  LICENCAS_DE_MATERIAL,
  LICENCAS_DECLARAVEIS,
  MAXIMO_DE_SERIES_DO_MATERIAL,
  MOTIVOS_DA_RECUSA_DO_MATERIAL,
  MOTIVOS_DA_RECUSA_PELA_LICENCA_REGISTRADA,
  MOTIVOS_DE_DESTAQUE,
  MOTIVOS_DE_ENCERRAMENTO_PELA_COORDENACAO,
  MOTIVOS_DE_SUSPENSAO,
  ORIGENS_DA_RETENCAO,
  ORIGENS_DE_VINCULO,
  PAPEIS_DE_USUARIO,
  PAPEIS_DE_VINCULO,
  PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA,
  PAPEIS_DO_TITULAR,
  RISCOS_DO_INCIDENTE,
  CHAVES_DO_RESUMO_DA_IMPORTACAO,
  SOLICITANTES_DO_PEDIDO,
  TIPOS_DE_PLANILHA,
  TIPOS_DE_CONVITE,
  TIPOS_DE_ENTREGA,
  TIPOS_DE_PEDIDO_DO_TITULAR,
  TITULARIDADES_DE_MATERIAL,
  VALIDADES_DO_ACESSO_DIAS,
  VERSOES_DO_ARQUIVO,
} from '@educa/shared'
import { PROVEDORES_EXTERNOS } from '../db/schema/conta-externa.js'
import { TIPOS_DE_REDE } from '../db/schema/rede.js'

/** Os tipos de job que existem: o que a auditoria do job aceita no lugar de texto livre. */
const TIPOS_DE_JOB = Object.keys(JOB_DEFINITIONS) as [keyof typeof JOB_DEFINITIONS, ...Array<keyof typeof JOB_DEFINITIONS>]

/**
 * Nomes que nenhum campo de `antes` ou `depois` pode ter, nem como parte do nome (`nomeDoAluno`,
 * `senhaHash`): a auditoria guarda ids, estados e datas, e fica cinco anos (Tech Spec, seção 3).
 */
export const CAMPOS_PROIBIDOS_NA_AUDITORIA = ['nome', 'email', 'matricula', 'complemento', 'hash', 'senha', 'segredo'] as const

type EsquemaDeEstado = z.ZodObject

/**
 * As tabelas cuja linha alterada pela troca de nome do titular grava `titular.nome_trocado` (F3, 15.0): a execução do
 * agente, o consumo de IA, o artefato e a entrega, que são o que a IA gerou e o que o professor aprovou. A conversa do
 * professor (`mensagem_agente`) também é trocada, mas sem entrada por linha.
 */
export const TABELAS_AUDITADAS_NA_TROCA_DE_NOME = ['execucao_agente', 'consumo_ia', 'artefato', 'entrega'] as const

export interface DefinicaoDeAcao {
  /** A entidade do registro. A de `rede` é a única gravada sem escola, e só pelo operador. */
  readonly entidade: string
  /** Lista fechada do estado anterior, ou `null` quando a ação não tem estado anterior (criação). */
  readonly antes: EsquemaDeEstado | null
  /** Lista fechada do estado posterior, ou `null` quando a ação não tem estado posterior. */
  readonly depois: EsquemaDeEstado | null
  /**
   * Os códigos de finalidade que a ação aceita (`z.enum`), ou `null` quando ela não leva finalidade.
   * Nunca texto livre: a auditoria fica cinco anos, e texto livre é onde o nome do aluno entra.
   */
  readonly finalidade: z.ZodEnum | null
}

/**
 * As contagens do `resumo` da importação que a auditoria `planilha.gravada` leva: as mesmas chaves, com `nomes_corrigidos`
 * escrito `corrigidos` (nenhum campo da auditoria tem "nome" no nome, por mais que seja só um número).
 */
const contagensDaPlanilhaGravada = z.strictObject(
  Object.fromEntries(CHAVES_DO_RESUMO_DA_IMPORTACAO.map((chave) => [chave === 'nomes_corrigidos' ? 'corrigidos' : chave, z.number().int().nonnegative().optional()])),
)

/**
 * Toda ação que a auditoria aceita, com a lista fechada de `antes`, `depois` e `finalidade`. Cada tarefa
 * acrescenta as dela; ação fora daqui é recusada. Todo objeto é `strictObject`: campo fora da lista é
 * recusado, nunca descartado em silêncio.
 */
export const ACOES_DE_AUDITORIA = {
  'rede.criada': {
    entidade: 'rede',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_REDE) }),
    finalidade: null,
  },
  'escola.criada': {
    entidade: 'escola',
    antes: null,
    depois: z.strictObject({ redeId: z.uuid() }),
    finalidade: null,
  },
  /** A coordenação mudou os minutos sem uso até a sessão vencer (5.0): só os dois números, antes e depois. */
  'escola.sessao_alterada': {
    entidade: 'escola',
    antes: z.strictObject({ inatividadeAlunoMin: z.number().int(), inatividadeEquipeMin: z.number().int() }),
    depois: z.strictObject({ inatividadeAlunoMin: z.number().int(), inatividadeEquipeMin: z.number().int() }),
    finalidade: null,
  },
  /**
   * A coordenação trocou a lista de domínios Google e tenants Microsoft liberados para o login pela conta da escola
   * (13.0; regra 20, item 10: alteração de permissão). `antes` e `depois` levam os ids das linhas de `provedor_escola`
   * liberadas, por provedor: a linha nunca é apagada (sai da lista com `removido_em`), e o id continua dizendo qual
   * domínio era. Nunca o texto do domínio aqui, que a auditoria só aceita id, data e código.
   */
  'escola.provedores_alterados': {
    entidade: 'escola',
    antes: z.strictObject({ google: z.array(z.uuid()), microsoft: z.array(z.uuid()) }),
    depois: z.strictObject({ google: z.array(z.uuid()), microsoft: z.array(z.uuid()) }),
    finalidade: null,
  },
  /**
   * A conta Google ou Microsoft de um professor foi ligada a ele no primeiro login por ela (13.0, RF9, RF19): o
   * e-mail verificado batia com o da conta dele na escola. Ou a de um aluno, ligada na aprovação do pedido do nome (14.0,
   * RF14): o autor é quem aprovou (professor ou coordenação), na mesma transação que cria o aluno. `entidadeId` é a ligação
   * (`conta_externa`); leva o usuário e o provedor, nunca o e-mail nem o identificador da conta externa.
   */
  'conta_externa.ligada': {
    entidade: 'conta_externa',
    antes: null,
    depois: z.strictObject({ usuarioId: z.uuid(), provedor: z.enum(PROVEDORES_EXTERNOS) }),
    finalidade: null,
  },
  /**
   * O cookie de renovação anterior voltou depois de o atual já ter sido usado e da janela de 30 s (5.0): alguém
   * guardou um cookie velho. A família inteira foi encerrada; o registro leva a família e quantas sessões caíram.
   */
  'sessao.reuso_de_refresh': {
    entidade: 'sessao',
    antes: null,
    depois: z.strictObject({ familia: z.uuid(), sessoesEncerradas: z.number().int() }),
    finalidade: null,
  },
  /**
   * O segundo fator de uma conta foi apagado (6.0, RF19): por outro coordenador da escola, ou pelo operador a pedido
   * formal dela. `entidadeId` é o usuário da escola do registro; `antes` diz se o MFA estava ativo. O operador leva o
   * número do pedido (`pedidoDoOperador`), nunca texto livre.
   */
  'usuario.mfa_redefinido': {
    entidade: 'usuario',
    antes: z.strictObject({ mfaAtivo: z.boolean() }),
    depois: z.strictObject({ mfaAtivo: z.literal(false), pedidoDoOperador: z.number().int().positive().optional() }),
    finalidade: z.enum([...FINALIDADES_DA_REDEFINICAO_DE_MFA, FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR]),
  },
  /**
   * A coordenação pediu a redefinição, e nada mudou: a conta do usuário também tem usuário ativo em outra escola, e a
   * credencial é global (Tech Spec, seção 5, "TOTP"). A escola recorre ao operador. O registro não diz qual escola.
   */
  'usuario.mfa_redefinicao_recusada': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: z.enum(FINALIDADES_DA_REDEFINICAO_DE_MFA),
  },
  /**
   * A conta trocou a senha pelo link do "esqueci a senha" (acesso-e-convites, tarefa 5.0, RF12, RF17): um registro em **cada escola** em que a conta tem
   * usuário ativo, com esse usuário como autor e como alvo (`entidadeId`), gravados na mesma transação da troca. A rota é anônima e a conta é global:
   * o registro de uma escola não traz nada da outra, nem a senha, o e-mail, o token ou quantas sessões caíram.
   */
  'senha.redefinida': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * A posse do e-mail da conta foi provada (acesso-e-convites, tarefa 7.0, RF12, RF17): pelo aceite de um convite enviado por e-mail (um registro, na escola do
   * convite), pelo link de verificar ou pelo link do "esqueci a senha" (um registro **em cada escola** em que a conta tem usuário ativo, com esse usuário como autor e
   * como alvo, na mesma transação, como o `senha.redefinida`). Grava só quando a conta passa de não verificada a verificada: o segundo link não é fato novo. Nada traz
   * o e-mail, o token nem a outra escola.
   */
  'conta.email_verificado': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * A coordenação ou o professor da turma gerou a senha provisória de um aluno (acesso-e-convites, tarefa 9.0, RF13, RF17): `entidadeId` é o aluno, o autor é quem gerou, e o
   * `depois` leva o papel dele (`coordenador` ou `professor`), que o arquivo do titular mostra ao aluno no lugar do nome do autor (D85). Nunca a senha, o hash, o nome nem a
   * matrícula. O uso dela é `senha_provisoria.usada`.
   */
  'senha_provisoria.gerada': {
    entidade: 'usuario',
    antes: null,
    depois: z.strictObject({ papel: z.enum(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA) }),
    finalidade: null,
  },
  /**
   * A coordenação abriu a confirmação da senha provisória e leu o aluno (acesso-e-convites, tarefa 17.0, regra 20, item 10): `entidadeId` é o aluno, o autor é a coordenação e a finalidade
   * é fixa, escrita pelo servidor. Um registro por leitura, na mesma transação dela; o professor da turma não grava. Nunca o nome nem a matrícula que a leitura devolveu. É leitura, não ato
   * sobre o titular: fica fora do arquivo do titular, nas duas leituras (por alvo e por autor).
   */
  'senha_provisoria.alvo_lido': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: z.enum([FINALIDADE_DA_LEITURA_DO_ALVO]),
  },
  /**
   * O aluno trocou a senha provisória pela dele (acesso-e-convites, tarefa 10.0, RF13, RF17): `entidadeId` é o aluno e o autor é ele mesmo, que a prova com a provisória e cria a
   * nova antes de qualquer tela. Um registro por troca, na mesma transação que grava a senha nova. Nunca a senha, o hash, o nome nem a matrícula; o arquivo do titular o mostra
   * uma vez só, com o aluno como autor (D85).
   */
  'senha_provisoria.usada': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * O convite nasceu, com o `tipo` (A1, tarefa 3.0): o do coordenador, gerado pelo operador (7.0, RF1, RF19) com
   * `ops:convite-coordenador` ou pelo painel da operação (A0b); o do professor, gerado pela coordenação no cadastro dele
   * (A1, RF6). O usuário convidado, ainda inativo, e até quando o convite vale. Só o do coordenador leva `contaNova`, se
   * a conta do e-mail foi criada agora ou já existia: no do professor, nada diz à coordenação se a pessoa tem conta em
   * outra escola (Tech Spec da A1, seção 7; E11). Nunca o nome, o e-mail nem o token.
   */
  'convite.criado': {
    entidade: 'convite',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_CONVITE), usuarioId: z.uuid(), expiraEm: z.iso.datetime(), contaNova: z.boolean().optional() }),
    finalidade: null,
  },
  /**
   * O convite foi revogado, com o `tipo` (A1, tarefa 3.0): o do coordenador pelo operador (7.0, RF19), com
   * `ops:revogar-convite` ou pelo painel da operação (A0b), ou pelo gerar, que revogou o anterior (A0b, estados `aceito`
   * e `sem_coordenacao`); o do professor pela coordenação (A1, RF6). O link deixa de valer, usado ou não.
   */
  'convite.revogado': {
    entidade: 'convite',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_CONVITE) }),
    finalidade: null,
  },
  /**
   * O convite foi refeito, com o `tipo` (A1, tarefa 3.0): o da coordenação pelo painel da operação (A0b, tarefa 3.0), o
   * do professor pela coordenação da escola (A1, RF6). O convite de origem (`origemId`, em aberto) deixou de valer, e
   * `entidadeId` é o convite novo, para o mesmo usuário (`usuarioId`), válido até `expiraEm`. Nunca o nome, o e-mail nem
   * o token.
   */
  'convite.refeito': {
    entidade: 'convite',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_CONVITE), origemId: z.uuid(), usuarioId: z.uuid(), expiraEm: z.iso.datetime() }),
    finalidade: null,
  },
  /**
   * A coordenação mandou o convite por e-mail (acesso-e-convites, tarefa 3.0, RF11, RF17): um registro por convite que entrou na fila, gravado no
   * pedido ("Enviar", "Reenviar") e na mesma transação do convite novo, com a coordenação como autora. `entidadeId` é o convite novo. O job do worker só
   * muda o `envio` e não grava nada aqui. Leva o canal e o tipo; nunca o nome, o e-mail nem o token.
   */
  'convite.enviado': {
    entidade: 'convite',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_CONVITE), canal: z.literal('email') }),
    finalidade: null,
  },
  /**
   * A pessoa abriu o link e aceitou o convite (7.0), com o `tipo` (A1, tarefa 3.0). `usuarioAtivo` diz se o aceite já
   * ativou o usuário (conta nova, que definiu a senha ali) ou se ele espera o login com a senha que a conta já tem (conta
   * de outra escola).
   */
  'convite.aceito': {
    entidade: 'convite',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_CONVITE), usuarioId: z.uuid(), usuarioAtivo: z.boolean() }),
    finalidade: null,
  },
  /**
   * A coordenação cadastrou o professor (A1, tarefa 3.0, RF6, RF16): `entidadeId` é o usuário dele na escola, inativo
   * até o aceite do convite, que vem no `convite.criado` da mesma transação. Sem campo nenhum: nada diz se a conta do
   * e-mail era nova ou já existia em outra escola (Tech Spec da A1, seção 7; E11). Nunca o nome nem o e-mail.
   */
  'professor.cadastrado': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * O usuário que esperava o convite aceito foi ativado no login por e-mail, com o bilhete do convite e depois da senha
   * e do segundo fator que a conta já tinha (7.0; Tech Spec, seção 5, "Etapas"). Leva o convite que o ativou.
   */
  'usuario.ativado_por_convite': {
    entidade: 'usuario',
    antes: null,
    depois: z.strictObject({ conviteId: z.uuid() }),
    finalidade: null,
  },
  /**
   * A escola desativou o usuário (17.0; regra 20, item 18): ele deixa de entrar na requisição seguinte, e o que era
   * credencial dele nesta escola sai. Só contagens e sim ou não: quantas sessões desta escola foram encerradas, se o hash
   * da senha da matrícula foi apagado, se a conta Google ou Microsoft ligada foi desligada, e se a conta global ficou
   * sem usuário ativo em escola nenhuma e foi limpa (e-mail, senha e segundo fator). Nunca quem, nunca a outra escola.
   */
  'usuario.desativado': {
    entidade: 'usuario',
    antes: z.strictObject({ papel: z.enum(PAPEIS_DE_USUARIO) }),
    depois: z.strictObject({
      desativadoEm: z.iso.datetime(),
      sessoesEncerradas: z.number().int().nonnegative(),
      credencialApagada: z.boolean(),
      contaExternaDesligada: z.boolean(),
      contaLimpa: z.boolean(),
    }),
    finalidade: null,
  },
  /**
   * A escola pediu a eliminação do usuário (17.0; Tech Spec, seção 5, "Ciclo de vida"): o usuário, a credencial por
   * matrícula, a conta externa, os vínculos e as sessões dele nesta escola saíram de fato; do aluno aprovado pela lista
   * (A1, 10.0), também a linha `aprovado` da lista e os pedidos que apontavam para ela. O registro de acesso e a
   * auditoria ficam, pela retenção legal. `entidadeId` é o id que o usuário tinha; só contagens e sim ou não.
   */
  'usuario.eliminado': {
    entidade: 'usuario',
    antes: z.strictObject({ papel: z.enum(PAPEIS_DE_USUARIO), desativadoEm: z.iso.datetime().nullable() }),
    depois: z.strictObject({
      sessoesApagadas: z.number().int().nonnegative(),
      vinculosApagados: z.number().int().nonnegative(),
      credencialApagada: z.boolean(),
      contaExternaApagada: z.boolean(),
      linhaDaListaApagada: z.boolean(),
      pedidosApagados: z.number().int().nonnegative(),
      contaLimpa: z.boolean(),
    }),
    finalidade: null,
  },
  /**
   * A coordenação desligou a conta Google ou Microsoft de um usuário ativo (17.0; decidido na 13.0): a professora cuja
   * conta foi recriada com outro identificador liga a nova no login seguinte. `entidadeId` é a ligação que saiu; leva o
   * usuário e o provedor, nunca o e-mail nem o identificador da conta externa.
   */
  'conta_externa.desligada': {
    entidade: 'conta_externa',
    antes: z.strictObject({ usuarioId: z.uuid(), provedor: z.enum(PROVEDORES_EXTERNOS) }),
    depois: null,
    finalidade: null,
  },
  /**
   * A coordenação criou o vínculo (9.0, RF3, RF19): de quem, em que turma e disciplina, com que papel. Nasce pendente. A planilha
   * de alunos (F2, 9.0) abre o do aluno transferido já `confirmado` e diz a `origem` (`lista`). `entidadeId` é o vínculo.
   */
  'vinculo.criado': {
    entidade: 'vinculo',
    antes: null,
    depois: z.strictObject({
      usuarioId: z.uuid(),
      turmaId: z.uuid(),
      disciplinaId: z.uuid().nullable(),
      papel: z.enum(PAPEIS_DE_VINCULO),
      estado: z.enum(['pendente', 'confirmado']),
      origem: z.enum(ORIGENS_DE_VINCULO).optional(),
    }),
    finalidade: null,
  },
  /** O professor dono confirmou o vínculo (9.0, RF4, RF19): a partir daqui ele alcança a turma. */
  'vinculo.confirmado': {
    entidade: 'vinculo',
    antes: z.strictObject({ estado: z.enum(ESTADOS_EM_DECISAO) }),
    depois: z.strictObject({ estado: z.literal('confirmado') }),
    finalidade: null,
  },
  /**
   * O professor dono contestou o vínculo (9.0, RF4, RF19): só o código. O complemento, texto livre do professor, nunca
   * entra aqui (`docs/lgpd.md`), e nenhum campo pode nem ter o nome dele.
   */
  'vinculo.contestado': {
    entidade: 'vinculo',
    antes: z.strictObject({ estado: z.enum(ESTADOS_EM_DECISAO) }),
    depois: z.strictObject({ estado: z.literal('contestado'), contestacao: z.enum(CONTESTACOES_DE_VINCULO) }),
    finalidade: null,
  },
  /** A coordenação encerrou o vínculo (9.0, RF5, RF19): o acesso cai na requisição seguinte. A planilha de alunos (F2, 9.0) o encerra por `realocacao` e diz a `origem` (`lista`). */
  'vinculo.encerrado': {
    entidade: 'vinculo',
    antes: z.strictObject({ estado: z.enum(ESTADOS_DE_VINCULO) }),
    depois: z.strictObject({ estado: z.literal('encerrado'), motivo: z.enum(MOTIVOS_DE_ENCERRAMENTO_PELA_COORDENACAO), origem: z.enum(ORIGENS_DE_VINCULO).optional() }),
    finalidade: null,
  },
  /**
   * A coordenação encerrou o ano letivo, e a virada aconteceu na mesma transação (10.0, RF16): os vínculos do ano que
   * não estavam encerrados foram a `encerrado` por `fim_do_ano`, e o texto livre das contestações do ano foi apagado
   * (`docs/lgpd.md`, retenção até o fim do ano letivo). Na sala das turmas (A1, 10.0): os acessos revogados, os pedidos
   * pendentes fechados como `encerrada` e as linhas livres e reivindicadas da lista apagadas. `entidadeId` é o ano. Só as
   * contagens: nunca quem, nunca o texto, nunca o nome nem a matrícula.
   */
  'ano_letivo.encerrado': {
    entidade: 'ano_letivo',
    antes: z.strictObject({ situacao: z.literal('em_curso') }),
    depois: z.strictObject({
      situacao: z.literal('encerrado'),
      vinculosEncerrados: z.number().int().nonnegative(),
      textosDeContestacaoApagados: z.number().int().nonnegative(),
      acessosRevogados: z.number().int().nonnegative(),
      pedidosEncerrados: z.number().int().nonnegative(),
      linhasDaListaApagadas: z.number().int().nonnegative(),
    }),
    finalidade: null,
  },
  /**
   * A coordenação leu a lista de alunos de uma turma (9.0; regra 20, item 10), com a finalidade. `entidadeId` é a
   * turma; `quantidade`, quantos alunos a página trouxe. Nunca quem.
   */
  'turma.alunos_lidos': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ quantidade: z.number().int().nonnegative() }),
    finalidade: z.enum(FINALIDADES_DA_LEITURA_DE_ALUNOS),
  },
  /**
   * A coordenação gravou um nome avulso na lista da turma (`POST /lista/nome`, A1, 2.0, RF16). A gravação pelo texto passou ao
   * job da planilha (F2, 8.0) e grava `planilha.gravada`, não esta ação: quem monta o arquivo do titular procura o texto lá.
   * `entidadeId` é a turma; `ids`, as linhas que entraram (as que já estavam na lista não entram de novo); `gravados` e `jaExistentes`,
   * as contagens. Nunca o nome nem a matrícula.
   */
  'lista.gravada': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ ids: z.array(z.uuid()), gravados: z.number().int().nonnegative(), jaExistentes: z.number().int().nonnegative() }),
    finalidade: null,
  },
  /**
   * O job `estrutura.gravar-planilha` concluiu uma planilha (F2, 4.0, RF17): `entidadeId` é a `importacao_planilha`; leva o tipo e
   * as contagens do `resumo` (só números, de chaves de lista fechada; `corrigidos` é o `nomes_corrigidos` do resumo, sem a palavra
   * que o mapa proíbe em campo). Nunca o nome, a matrícula, o e-mail nem a descrição de um
   * evento. O autor é a coordenação que gravou; a importação de quem já saiu não grava nem é auditada (sai `desatualizada`),
   * porque a rotina não assina esta ação (`auditoria_rotina_so_nas_acoes`).
   */
  'planilha.gravada': {
    entidade: 'importacao_planilha',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_PLANILHA), contagens: contagensDaPlanilhaGravada }),
    finalidade: null,
  },
  /**
   * A planilha de alunos criou uma turma que a escola ainda não tinha (F2, 7.0, RF17): `entidadeId` é a turma; `depois` leva a
   * série dela, que a planilha tirou do nome ("8ºA" é o 8º ano do Ensino Fundamental), e a origem. Nunca o nome da turma nem de
   * aluno. O autor é a coordenação que gravou a planilha.
   */
  'turma.criada': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ serie: z.strictObject({ etapa: z.enum(ETAPAS), ano: z.number().int() }), origem: z.literal('planilha') }),
    finalidade: null,
  },
  /**
   * A planilha de alunos corrigiu o nome de um aluno aprovado (F2, 8.0, RF4 e RF17): `entidadeId` é o usuário. Sem `antes` nem
   * `depois`: nenhum campo da auditoria leva nome, e o que mudou é só o nome. O autor é a coordenação que gravou a planilha.
   */
  'usuario.nome_corrigido': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * A coordenação corrigiu o e-mail do professor que nunca entrou (acesso-e-convites, 18.0, RF17; Tech Spec, seção 5, "Corrigir o e-mail"): `entidadeId` é o usuário do professor, que muda
   * de conta e fica com o id. Sem `antes` nem `depois`: nenhum campo da auditoria leva e-mail, e o id da conta também não entra. O autor é a coordenação; o arquivo do professor traz
   * o ato com o papel "coordenação", sem o autor (D85).
   */
  'usuario.email_corrigido': {
    entidade: 'usuario',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * A planilha de alunos corrigiu o nome de quem ainda não foi aprovado (F2, 8.0, RF4 e RF17): `entidadeId` é a linha da lista,
   * `livre` ou `reivindicado`. Sem nome, antes nem depois. O autor é a coordenação que gravou a planilha.
   */
  'lista.nome_corrigido': {
    entidade: 'lista_nome',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * A planilha de alunos passou o aluno aprovado de turma (F2, 9.0, RF5 e RF17): `entidadeId` é o usuário; `depois` leva só as duas
   * turmas, a de origem e a de destino. Nunca o nome nem a matrícula. O autor é a coordenação que gravou a planilha e marcou a transferência.
   */
  'aluno.transferido': {
    entidade: 'usuario',
    antes: null,
    depois: z.strictObject({ turmaOrigemId: z.uuid(), turmaDestinoId: z.uuid() }),
    finalidade: null,
  },
  /**
   * A planilha de alunos passou de turma o nome de quem ainda não foi aprovado (F2, 9.0, RF5 e RF17): `entidadeId` é a linha da lista,
   * que volta `livre` na turma nova (o pedido pendente dela, se havia, é encerrado sem decisão). Só as duas turmas; nunca o nome.
   */
  'lista.transferida': {
    entidade: 'lista_nome',
    antes: null,
    depois: z.strictObject({ turmaOrigemId: z.uuid(), turmaDestinoId: z.uuid() }),
    finalidade: null,
  },
  /**
   * A coordenação retirou um nome da lista (A1, 2.0, RF5): a linha sai de fato, porque é pré-cadastro, sem conta nem histórico
   * (Tech Spec da A1, seção 7). `entidadeId` é a linha que saiu; ficam a turma dela e o estado que tinha: `livre` pela rota, e também
   * `reivindicado` pela planilha de alunos, que marca o ausente a desligar (F2, 10.0; o pedido pendente dele é encerrado antes, sem decisão).
   * Nunca o nome.
   */
  'lista_nome.retirado': {
    entidade: 'lista_nome',
    antes: z.strictObject({ turmaId: z.uuid(), estado: z.enum(['livre', 'reivindicado']) }),
    depois: null,
    finalidade: null,
  },
  /**
   * A coordenação leu a lista de nomes de uma turma (A1, 2.0; regra 20, item 10), com a finalidade, a cada leitura.
   * `entidadeId` é a turma; `quantidade`, quantos nomes a página trouxe. O professor não lê a lista.
   */
  'turma.lista_lida': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ quantidade: z.number().int().nonnegative() }),
    finalidade: z.enum(FINALIDADES_DA_LEITURA_DE_ALUNOS),
  },
  /**
   * O professor gerou o link da sala e o código da turma (A1, 4.0, RF9, RF16). `entidadeId` é o acesso novo; `turmaId`, a
   * turma; `validadeDias` e `expiraEm`, até quando vale; `substituidos`, os acessos não revogados da turma que este
   * derrubou na mesma transação ("Gerar novo", também o de outro professor), vazio no primeiro. Nunca o token nem o
   * código, nem o hash deles.
   */
  'acesso_turma.gerado': {
    entidade: 'acesso_turma',
    antes: null,
    depois: z.strictObject({ turmaId: z.uuid(), validadeDias: z.literal(VALIDADES_DO_ACESSO_DIAS), expiraEm: z.iso.datetime(), substituidos: z.array(z.uuid()) }),
    finalidade: null,
  },
  /**
   * O professor revogou o acesso vigente da turma (A1, 4.0, RF9, RF16): o link e o código deixam de valer na hora.
   * `entidadeId` é o acesso; `turmaId`, a turma. O que o "Gerar novo" derruba fica no `substituidos` do
   * `acesso_turma.gerado`, e não aqui.
   */
  'acesso_turma.revogado': {
    entidade: 'acesso_turma',
    antes: null,
    depois: z.strictObject({ turmaId: z.uuid() }),
    finalidade: null,
  },
  /**
   * A coordenação leu os pedidos de reivindicação de uma turma (A1, 8.0; regra 20, item 10), com a finalidade, a cada
   * leitura (também em cada "Atualizar"). `entidadeId` é a turma; `quantidade`, quantos pedidos a página trouxe. O
   * professor com vínculo confirmado lê sem registro.
   */
  'turma.reivindicacoes_lidas': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ quantidade: z.number().int().nonnegative() }),
    finalidade: z.enum(FINALIDADES_DA_LEITURA_DE_ALUNOS),
  },
  /**
   * Uma pessoa decidiu um pedido de reivindicação (A1, 8.0, RF12, RF13 e RF16; D4). `entidadeId` é o pedido; `turmaId`, a
   * turma; `estado`, `aprovada` ou `recusada`; `decididaComo`, o professor da turma ou a coordenação, que o RF16 pede
   * destacada; `alunoId`, o usuário que a aprovação criou, e nulo na recusa. Nunca o nome, a matrícula, o hash nem a marca
   * de tentativa com matrícula errada (Tech Spec da A1, seção 7).
   */
  'reivindicacao.decidida': {
    entidade: 'reivindicacao',
    antes: null,
    depois: z.strictObject({
      turmaId: z.uuid(),
      estado: z.enum(['aprovada', 'recusada']),
      decididaComo: z.enum(DECISORES_DA_REIVINDICACAO),
      alunoId: z.uuid().nullable(),
    }),
    finalidade: null,
  },
  /**
   * A coordenação enviou um material com a titularidade e a licença declaradas (MVP, A2; D5, D75). `entidadeId` é o
   * material. É o registro de quem declarou que a escola pode usar o material, e quando: a linha do material perde quem
   * enviou se a pessoa for eliminada, e este fica. Nunca o título, o nome do licenciante nem o nome do arquivo.
   */
  'material.enviado': {
    entidade: 'material',
    antes: null,
    depois: z.strictObject({ disciplinaId: z.uuid(), titularidade: z.enum(TITULARIDADES_DE_MATERIAL), licenca: z.enum(LICENCAS_DE_MATERIAL), declaracao: z.literal(true) }),
    finalidade: null,
  },
  /**
   * O envio foi recusado antes de abrir o arquivo (MVP, A2; D5): sem licença que permita o uso, sem a declaração
   * marcada ou, no material de terceiro, sem licença registrada vigente (ingestao-do-material, 7.0). **Não há linha em `material`**, e por isso `entidadeId` é a disciplina para a qual o
   * material ia. Leva o que foi declarado, as séries **da escola** que o pedido trazia (só as que a conferência achou: o id de série de outra escola nunca chega aqui) e o motivo; a
   * resposta foi `MATERIAL_SEM_LICENCA`, `LICENCA_VENCIDA` (motivo `licenca_vencida`) ou `NAO_ENCONTRADO` (motivo `licenca_inexistente`, a licença que não é da escola).
   */
  'material.recusado': {
    entidade: 'disciplina',
    antes: null,
    depois: z.strictObject({
      titularidade: z.enum(TITULARIDADES_DE_MATERIAL),
      licenca: z.enum(LICENCAS_DECLARAVEIS),
      declaracao: z.boolean(),
      // De 0 a 7: o envio exige ao menos uma, e só a recusa da edição de um material que a migração deixou sem série (`semSerie`, que herda nenhuma) leva a lista vazia.
      serieIds: z.array(z.uuid()).max(MAXIMO_DE_SERIES_DO_MATERIAL),
      motivo: z.enum([...MOTIVOS_DA_RECUSA_DO_MATERIAL, ...MOTIVOS_DA_RECUSA_PELA_LICENCA_REGISTRADA]),
    }),
    finalidade: null,
  },
  /**
   * A coordenação enviou uma edição nova de um material (ingestao-do-material, 8.0; RF10). `entidadeId` é a **edição nova**, e `substituiId`, o material que ela vai substituir quando ficar pronta. Leva o que a
   * edição herdou e que a escola declarou ao enviar o material (a disciplina, a titularidade, a licença de uso e a declaração): **nunca o título, o rótulo da edição nem o nome do arquivo**.
   */
  'material.edicao_enviada': {
    entidade: 'material',
    antes: null,
    depois: z.strictObject({
      substituiId: z.uuid(),
      disciplinaId: z.uuid(),
      titularidade: z.enum(TITULARIDADES_DE_MATERIAL),
      licenca: z.enum(LICENCAS_DE_MATERIAL),
      declaracao: z.literal(true),
    }),
    finalidade: null,
  },
  /**
   * A edição nova ficou pronta e a anterior saiu da busca (ingestao-do-material, 8.0; RF10). `entidadeId` é o material **substituído**; `substituidoPor`, a edição que o substituiu. Quem grava é a extração, no worker,
   * na mesma transação que tira a edição de `processando`: sem pessoa no contexto, o autor é a `rotina` (o check `auditoria_rotina_so_nas_acoes`), e quem decidiu a troca está em `material.edicao_enviada`.
   */
  'material.substituido': {
    entidade: 'material',
    antes: null,
    depois: z.strictObject({ substituidoPor: z.uuid() }),
    finalidade: null,
  },
  /**
   * A coordenação registrou uma licença de material de terceiro (ingestao-do-material, 5.0; PRD, RF16; Tech Spec, seção 7). `entidadeId` é a licença. Leva só a vigência: **nunca o licenciante, a
   * cobertura nem a referência**, que são texto livre e podem ter nome de pessoa (o teste da sentinela confere). O autor do registro é quem registrou, e a linha perde a autoria se a pessoa for eliminada.
   */
  'licenca.registrada': {
    entidade: 'licenca',
    antes: null,
    depois: z.strictObject({ vigenteDesde: z.iso.date(), vigenteAte: z.iso.date().nullable() }),
    finalidade: null,
  },
  /**
   * A coordenação alterou a vigência, a cobertura ou a referência de uma licença (5.0). `antes` e `depois` são a vigência de antes e de depois da alteração, lida com a linha travada
   * (`for update`): dois `PATCH` ao mesmo tempo deixam dois registros em fila, cada um com o "antes" que de fato encontrou. Sem texto livre, como a registrada.
   */
  'licenca.alterada': {
    entidade: 'licenca',
    antes: z.strictObject({ vigenteDesde: z.iso.date(), vigenteAte: z.iso.date().nullable() }),
    depois: z.strictObject({ vigenteDesde: z.iso.date(), vigenteAte: z.iso.date().nullable() }),
    finalidade: null,
  },
  /**
   * A coordenação excluiu um material (MVP, A2; regra 20, item 15): exclusão lógica da linha, e os trechos dele saem de
   * fato, na mesma transação. `entidadeId` é o material; `trechosApagados`, quantas páginas deixaram a busca.
   */
  'material.excluido': {
    entidade: 'material',
    antes: z.strictObject({ disciplinaId: z.uuid(), estado: z.enum(ESTADOS_DE_MATERIAL) }),
    depois: z.strictObject({ trechosApagados: z.number().int().nonnegative() }),
    finalidade: null,
  },
  /**
   * O professor aplicou uma atividade à turma (MVP, A3; regra 70, item 3; regra 20, item 10): é o ato humano que leva a
   * saída da IA ao aluno. `entidadeId` é a atividade aplicada; `versaoAdaptada` diz se o artefato era versão adaptada, que
   * só se aplica com a entrega aprovada.
   */
  'atividade.aplicada': {
    entidade: 'atividade_aplicada',
    antes: null,
    depois: z.strictObject({ artefatoId: z.uuid(), turmaId: z.uuid(), avaliativa: z.boolean(), versaoAdaptada: z.boolean() }),
    finalidade: null,
  },
  /**
   * O professor da turma aprovou ou rejeitou uma entrega da IA (MVP; regra 70, itens 3 e 6; regra 20, item 10).
   * `entidadeId` é a entrega; o autor do registro é quem decidiu. A aprovação do lote de correção não vem por aqui: é
   * `lote.aprovado`, com a validação. **Nunca a justificativa da rejeição**, que é texto do professor e fica só na entrega.
   */
  'entrega.decidida': {
    entidade: 'entrega',
    antes: z.strictObject({ estado: z.literal('pendente') }),
    depois: z.strictObject({
      tipo: z.enum(TIPOS_DE_ENTREGA),
      funcao: z.enum(CHAVES_DE_FUNCAO),
      turmaId: z.uuid(),
      estado: z.enum(['aprovada', 'rejeitada']),
      artefatoId: z.uuid().nullable(),
      atividadeAplicadaId: z.uuid().nullable(),
    }),
    finalidade: null,
  },
  /**
   * O professor abriu a correção destacada de um aluno, antes de aprovar o lote (MVP, A3; D33, D56). `entidadeId` é a
   * entrega do lote; leva o aluno e os motivos do destaque. Grava uma vez por destaque: abrir de novo não registra outra.
   */
  'correcao.destaque_aberto': {
    entidade: 'entrega',
    antes: null,
    depois: z.strictObject({ atividadeAplicadaId: z.uuid(), alunoId: z.uuid(), motivos: z.array(z.enum(MOTIVOS_DE_DESTAQUE)) }),
    finalidade: null,
  },
  /**
   * O professor aprovou o lote de correção, com todos os destaques abertos (MVP, A3; D33, D56; regra 70, item 6).
   * `entidadeId` é a entrega; `validacaoId`, o registro do que foi apresentado e aberto; as contagens dizem o tamanho do
   * que ele validou. É a partir daqui que cada aluno alcança o próprio diagnóstico. Não há nota (D46).
   */
  'lote.aprovado': {
    entidade: 'entrega',
    antes: z.strictObject({ estado: z.literal('pendente') }),
    depois: z.strictObject({
      estado: z.literal('aprovada'),
      atividadeAplicadaId: z.uuid(),
      turmaId: z.uuid(),
      validacaoId: z.uuid(),
      corrigidos: z.number().int().nonnegative(),
      destaques: z.number().int().nonnegative(),
      destaquesAbertos: z.number().int().nonnegative(),
    }),
    finalidade: null,
  },
  /**
   * A coordenação suspendeu uma função da IA na escola (MVP, A5; D60): a função recusa executar a partir daqui, e as
   * outras do mesmo agente continuam. `entidadeId` é a suspensão; o motivo é código de lista fechada, ou nulo.
   */
  'funcao.suspensa': {
    entidade: 'suspensao_de_funcao',
    antes: null,
    depois: z.strictObject({ funcao: z.enum(CHAVES_DE_FUNCAO), motivo: z.enum(MOTIVOS_DE_SUSPENSAO).nullable() }),
    finalidade: null,
  },
  /** A coordenação retomou a função suspensa (MVP, A5; D60). `entidadeId` é a suspensão que deixou de valer. */
  'funcao.retomada': {
    entidade: 'suspensao_de_funcao',
    antes: z.strictObject({ funcao: z.enum(CHAVES_DE_FUNCAO), suspensaEm: z.iso.datetime() }),
    depois: z.strictObject({ retomadaEm: z.iso.datetime() }),
    finalidade: null,
  },
  /**
   * A coordenação leu o desempenho de uma turma, com os alunos nomeados (MVP, A3; D34; regra 20, item 10), com a
   * finalidade, a cada leitura. `entidadeId` é a turma; `quantidade`, quantos alunos a resposta trouxe. O professor com
   * vínculo confirmado lê a própria turma sem registro.
   */
  'turma.desempenho_lido': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ quantidade: z.number().int().nonnegative(), lotesAprovados: z.number().int().nonnegative() }),
    finalidade: z.enum(FINALIDADES_DA_LEITURA_DE_ALUNOS),
  },
  /**
   * A coordenação abriu o dado nominal do Analista: o detalhe de uma turma, que identifica os professores dela (MVP, A5;
   * D45; regra 20, item 10; regra 70, item 8), com a finalidade, a cada leitura. `entidadeId` é a turma; `professores`,
   * quantos a resposta nomeou. Nunca quem: o registro prova que a leitura aconteceu e por quê, e não repete o dado.
   */
  'analista.nominal_lido': {
    entidade: 'turma',
    antes: null,
    depois: z.strictObject({ professores: z.number().int().nonnegative() }),
    finalidade: z.enum(FINALIDADES_DA_LEITURA_NOMINAL),
  },
  /**
   * A operação ajustou o prazo de uma categoria da retenção da escola (F3, RF2; `ops:retencao`), gravado no contexto
   * dela e sempre com `autor_operador`. `entidadeId` é a escola, que com a `categoria` identifica a linha de
   * `retencao_escola`. `antes` é o prazo próprio da categoria antes do ajuste, e de onde ele vinha; `depois`, o ajuste e
   * o número do contrato que o pede. Nunca texto do contrato.
   */
  'retencao.ajustada': {
    entidade: 'retencao_escola',
    antes: z.strictObject({ meses: z.number().int().positive(), origem: z.enum(ORIGENS_DA_RETENCAO) }),
    depois: z.strictObject({ categoria: z.enum(CHAVES_DE_RETENCAO), meses: z.number().int().positive(), referenciaContrato: z.number().int().positive() }),
    finalidade: z.enum([FINALIDADE_DO_AJUSTE_DE_RETENCAO]),
  },
  /**
   * A operação tirou da lista dos que falharam um job de escola e o mandou de novo à fila (ingestao-do-material, 3.0;
   * `ops:reprocessar-job`), no contexto da escola da linha e sempre com `autor_operador`. `entidadeId` é o job. `depois` é o tipo
   * (da lista fechada dos tipos que existem) e o número do chamado que pede a ação. Nunca o `dados` do job.
   */
  'job.reprocessado': {
    entidade: 'job',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int().positive() }),
    finalidade: null,
  },
  /**
   * A operação encerrou de vez um job de escola que falhou (`ops:descartar-job`), com o efeito do tipo (o PDF fecha o material e sai
   * do storage). Mesmo formato do `job.reprocessado`: o job, o tipo e o chamado, nunca o `dados`.
   */
  'job.descartado': {
    entidade: 'job',
    antes: null,
    depois: z.strictObject({ tipo: z.enum(TIPOS_DE_JOB), chamado: z.number().int().positive() }),
    finalidade: null,
  },
  /**
   * A operação cadastrou um suboperador (F3, RF6; `ops:suboperador cadastrar`). Acima do tenant, sem escola no contexto, e
   * sempre com `autor_operador` (`ENTIDADES_DE_AUDITORIA_SEM_ESCOLA`): `entidadeId` é o suboperador, que a chave, o nome e o
   * contrato dele identificam na tabela. `depois` é o alcance e quantas escolas a lista traz (zero em `todas`). A auditoria
   * não aceita texto livre, então nunca a chave, o nome da empresa, o número do contrato nem as escolas.
   */
  'suboperador.cadastrado': {
    entidade: 'suboperador',
    antes: null,
    depois: z.strictObject({ alcance: z.enum(ALCANCES_DO_SUBOPERADOR), escolas: z.number().int().nonnegative() }),
    finalidade: z.enum([FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR]),
  },
  /** A operação encerrou o suboperador vigente (`ops:suboperador encerrar`): o que ele era e quantas ligações com escola se encerraram junto. */
  'suboperador.encerrado': {
    entidade: 'suboperador',
    antes: z.strictObject({ alcance: z.enum(ALCANCES_DO_SUBOPERADOR) }),
    depois: z.strictObject({ ligacoesEncerradas: z.number().int().nonnegative() }),
    finalidade: z.enum([FINALIDADE_DO_REGISTRO_DE_SUBOPERADOR]),
  },
  /**
   * A operação registrou o incidente na seção da escola (F3, RF8; `ops:incidente registrar`), no contexto dela e sempre com
   * `autor_operador`. `entidadeId` é a seção da escola (`incidente_escola.id`), o id que ela vê. `depois` é o risco e o número de
   * titulares estimados dela: um número, nunca quais. Nunca o texto da seção, nem as outras escolas.
   */
  'incidente.registrado': {
    entidade: 'incidente_escola',
    antes: null,
    depois: z.strictObject({ risco: z.enum(RISCOS_DO_INCIDENTE), titularesEstimados: z.number().int().nonnegative() }),
    finalidade: z.enum([FINALIDADE_DO_REGISTRO_DE_INCIDENTE]),
  },
  /**
   * A coordenação confirmou o recebimento do aviso do incidente (F3, RF9; `POST /v1/privacidade/incidentes/:id/confirmar`): quem
   * e quando saem do autor e da data do registro. `entidadeId` é a seção da escola. Só a chamada que confirmou de fato é
   * auditada; a segunda, que não muda nada, não grava de novo.
   */
  'incidente.confirmado': {
    entidade: 'incidente_escola',
    antes: null,
    depois: null,
    finalidade: z.enum([FINALIDADE_DO_REGISTRO_DE_INCIDENTE]),
  },
  /**
   * A coordenação buscou titulares para atender um pedido (F3, RF10 e RF17; `POST /v1/privacidade/titulares/busca`),
   * com a finalidade fixa. `entidadeId` é a escola, que é o alcance da busca, e `ids` os titulares que a resposta
   * trouxe: **nunca o termo digitado**, que é nome de pessoa e não vai nem à auditoria nem ao log.
   */
  'titular.buscado': {
    entidade: 'escola',
    antes: null,
    depois: z.strictObject({ ids: z.array(z.uuid()) }),
    finalidade: z.enum([FINALIDADE_DO_ATENDIMENTO_DO_TITULAR]),
  },
  /**
   * A coordenação abriu a prévia do titular, antes de registrar o pedido (`GET /v1/privacidade/titulares/:id/previa`;
   * regra 20, item 10): leitura de dado de pessoa, sempre com a finalidade. `entidadeId` é o titular; a resposta nunca
   * traz o nome do homônimo nem a contagem de uso de um professor (D64).
   */
  'titular.previa_lida': {
    entidade: 'titular',
    antes: null,
    depois: null,
    finalidade: z.enum([FINALIDADE_DO_ATENDIMENTO_DO_TITULAR]),
  },
  /**
   * A coordenação listou os pedidos do titular da escola (`GET /v1/privacidade/pedidos`): `entidadeId` é a escola, o
   * alcance da lista, e `ids` os pedidos da página, que trazem o nome de quem pediu.
   */
  'pedidos.listados': {
    entidade: 'escola',
    antes: null,
    depois: z.strictObject({ ids: z.array(z.uuid()) }),
    finalidade: z.enum([FINALIDADE_DO_ATENDIMENTO_DO_TITULAR]),
  },
  /** A coordenação abriu o detalhe de um pedido (`GET /v1/privacidade/pedidos/:id`), com a finalidade. */
  'pedido.lido': {
    entidade: 'pedido_titular',
    antes: null,
    depois: null,
    finalidade: z.enum([FINALIDADE_DO_ATENDIMENTO_DO_TITULAR]),
  },
  /**
   * A coordenação registrou o pedido do titular (F3, RF10 e RF17; `POST /v1/privacidade/pedidos`). `entidadeId` é o
   * pedido; `depois` leva só ids, código e data: nunca nome, matrícula, o termo da busca nem quem pediu por escrito.
   */
  'pedido.registrado': {
    entidade: 'pedido_titular',
    antes: null,
    depois: z.strictObject({
      titularId: z.uuid(),
      papelTitular: z.enum(PAPEIS_DO_TITULAR),
      tipo: z.enum(TIPOS_DE_PEDIDO_DO_TITULAR),
      solicitante: z.enum(SOLICITANTES_DO_PEDIDO),
      chegouEm: z.iso.date(),
    }),
    finalidade: null,
  },
  /**
   * A eliminação do titular ficou agendada (F3, tarefa 14.0; RF14; `POST /v1/privacidade/pedidos`, tipo `eliminacao`): o
   * acesso da pessoa nesta escola está suspenso até o cancelamento ou o 8º dia. Grava junto de `pedido.registrado`, na mesma
   * transação. `eliminarEm` é o instante em que a eliminação passa a poder acontecer; `sessoesEncerradas`, quantas sessões
   * abertas da pessoa o registro encerrou (com o motivo `eliminacao_agendada`). Nunca o nome.
   */
  'pedido.agendado': {
    entidade: 'pedido_titular',
    antes: null,
    depois: z.strictObject({ eliminarEm: z.iso.datetime(), sessoesEncerradas: z.number().int().nonnegative() }),
    finalidade: null,
  },
  /**
   * A coordenação cancelou a eliminação agendada (F3, tarefa 14.0; RF14; `POST /v1/privacidade/pedidos/:id/cancelar`): o
   * acesso da pessoa volta com a mesma senha. `acessoDevolvido` diz se havia pessoa a quem devolver (a que a rotina já
   * eliminou por outro caminho não tem). Só a chamada que cancelou grava; o clique duplo não grava de novo.
   */
  'pedido.cancelado': {
    entidade: 'pedido_titular',
    antes: z.strictObject({ estado: z.literal('agendado') }),
    depois: z.strictObject({ estado: z.literal('cancelado'), acessoDevolvido: z.boolean() }),
    finalidade: null,
  },
  /**
   * A coordenação concluiu o pedido (F3, RF16; `POST /v1/privacidade/pedidos/:id/concluir`): o atendimento terminou,
   * e quem concluiu sai no autor do registro. A eliminação conclui o pedido pelo job, com o autor `rotina` (15.0).
   */
  'pedido.concluido': {
    entidade: 'pedido_titular',
    antes: z.strictObject({ estado: z.enum(ESTADOS_DO_PEDIDO) }),
    depois: z.strictObject({ estado: z.literal('concluido') }),
    finalidade: null,
  },
  /**
   * A coordenação corrigiu o nome do titular no pedido de correção (F3, RF13b; `POST
   * /v1/privacidade/pedidos/:id/corrigir-nome`). **Nunca o nome, nem o anterior nem o novo**: só que a correção
   * aconteceu, sobre qual pedido, e por quem.
   */
  'pedido.nome_corrigido': {
    entidade: 'pedido_titular',
    antes: null,
    depois: null,
    finalidade: null,
  },
  /**
   * Alguém pediu a URL do arquivo do titular (F3, 13.0; RF12 e RF17): o próprio titular, em "Meus dados" (versão
   * `completa`), ou a coordenação, para a versão da escola de quem não tem conta ativa. `entidadeId` é o pedido; `depois`
   * diz só qual versão, e a finalidade sai de lista fechada. **Nunca a URL nem a chave do objeto**: nada que dê acesso ao
   * arquivo vai à auditoria. Grava na mesma transação que confere o arquivo e assina, antes de a resposta sair.
   */
  'titular.arquivo_baixado': {
    entidade: 'pedido_titular',
    antes: null,
    depois: z.strictObject({ versao: z.enum(VERSOES_DO_ARQUIVO) }),
    finalidade: z.enum(FINALIDADES_DO_ARQUIVO),
  },
  /**
   * O nome completo do titular foi trocado por `[nome removido]` numa linha de texto livre que a IA ou uma pessoa gerou
   * (F3, tarefa 15.0; RF15; regra 70, item 6): uma entrada por linha alterada de execução, consumo, artefato e entrega, na
   * transação da faixa. `entidadeId` é a **linha** que mudou; `depois` diz de qual tabela e por qual pedido. **Nunca o nome,
   * nem o anterior nem o novo, nem o trecho**: a auditoria responde "o que a IA gerou, quem aprovou e quando" também
   * depois da troca, e a saída aprovada que mudou fica registrada por linha. A conversa do professor (`mensagem_agente`)
   * é trocada sem entrada por linha: não é saída aprovada.
   */
  'titular.nome_trocado': {
    entidade: 'texto_livre',
    antes: null,
    depois: z.strictObject({ tabela: z.enum(TABELAS_AUDITADAS_NA_TROCA_DE_NOME), pedidoId: z.uuid() }),
    finalidade: null,
  },
} as const satisfies Record<string, DefinicaoDeAcao>

export type AcaoDeAuditoria = keyof typeof ACOES_DE_AUDITORIA

type EsquemaDa<Acao extends AcaoDeAuditoria, Parte extends 'antes' | 'depois' | 'finalidade'> = (typeof ACOES_DE_AUDITORIA)[Acao][Parte] extends infer Esquema
  ? Esquema extends z.ZodType
    ? z.input<Esquema>
    : never
  : never

/** O `antes`, o `depois` e a `finalidade` que a ação aceita, conferidos também em tempo de execução. */
export type EstadosDaAcao<Acao extends AcaoDeAuditoria> = {
  antes?: EsquemaDa<Acao, 'antes'>
  depois?: EsquemaDa<Acao, 'depois'>
  finalidade?: EsquemaDa<Acao, 'finalidade'>
}

/**
 * Texto que a auditoria aceita: id e data, dos construtores do zod (`z.uuid()`, `z.iso.datetime()`,
 * `z.iso.date()`) e sem nenhuma verificação a mais. Um `refine` ou um `overwrite` (`trim`, `toLowerCase`)
 * rodam depois do formato e poderiam aceitar ou devolver outro texto; um `z.stringFormat('uuid', ...)`
 * leva o nome do formato sem a regra dele. Texto sem formato é texto livre, e é recusado.
 */
function textoDeIdOuData(esquema: z.ZodType): boolean {
  const semVerificacaoExtra = (esquema._zod.def.checks ?? []).length === 0
  return semVerificacaoExtra && (esquema instanceof z.ZodUUID || esquema instanceof z.ZodISODateTime || esquema instanceof z.ZodISODate)
}

/** Folhas que não carregam texto livre: código fixo, número, sim ou não. */
const FOLHAS_PERMITIDAS: ReadonlySet<string> = new Set(['enum', 'literal', 'boolean', 'number'])

/**
 * Confere um schema falhando fechado: só passa o tipo que esta função conhece e sabe que guarda id,
 * estado ou data. `record`, `unknown`, `any`, `union`, `default`, `pipe`, `lazy`, texto sem formato e
 * qualquer outro tipo viram problema, porque aceitariam campo ou valor que ninguém declarou.
 */
function problemasDoEsquema(esquema: z.ZodType, caminho: string): string[] {
  const { type: tipo } = esquema._zod.def
  if (esquema instanceof z.ZodObject) {
    const problemas: string[] = []
    if (!(esquema.def.catchall instanceof z.ZodNever)) problemas.push(`${caminho}: objeto não estrito`)
    for (const [campo, valor] of Object.entries(esquema.shape)) {
      const minusculo = campo.toLowerCase()
      if (CAMPOS_PROIBIDOS_NA_AUDITORIA.some((proibido) => minusculo.includes(proibido))) problemas.push(`${caminho}.${campo}: nome proibido`)
      problemas.push(...problemasDoEsquema(valor as z.ZodType, `${caminho}.${campo}`))
    }
    return problemas
  }
  if (esquema instanceof z.ZodOptional || esquema instanceof z.ZodNullable) return problemasDoEsquema(esquema.unwrap() as z.ZodType, caminho)
  if (esquema instanceof z.ZodArray) return problemasDoEsquema(esquema.element as z.ZodType, caminho)
  if (tipo === 'string') return textoDeIdOuData(esquema) ? [] : [`${caminho}: texto sem formato de id ou data`]
  return FOLHAS_PERMITIDAS.has(tipo) ? [] : [`${caminho}: tipo não permitido (${tipo})`]
}

/**
 * Confere um mapa de ações inteiro: nenhum campo, em nenhuma profundidade, com nome proibido; todo objeto
 * estrito; só tipos que guardam id, estado ou data; finalidade só como `enum`. Devolve os caminhos com
 * problema (só nomes de campo e de tipo, nunca valor).
 */
export function problemasDoMapaDeAcoes(mapa: Readonly<Record<string, DefinicaoDeAcao>>): string[] {
  return Object.entries(mapa).flatMap(([acao, definicao]) => [
    ...(['antes', 'depois'] as const).flatMap((parte) => {
      const esquema = definicao[parte]
      if (esquema === null) return []
      if (!(esquema instanceof z.ZodObject)) return [`${acao}.${parte}: precisa ser objeto estrito`]
      return problemasDoEsquema(esquema, `${acao}.${parte}`)
    }),
    ...(definicao.finalidade === null || definicao.finalidade instanceof z.ZodEnum ? [] : [`${acao}.finalidade: precisa ser enum`]),
  ])
}

/**
 * O mapa tem campo proibido ou objeto não estrito. Os problemas são caminhos do próprio mapa (`teste.acao.depois.dados`),
 * escritos no código e sem dado de pessoa: vão num campo, e a mensagem continua fixa.
 */
export class InvalidAuditoriaMapError extends InvariantException {
  constructor(readonly problemas: readonly string[]) {
    super('mapa de auditoria inválido')
    this.name = 'InvalidAuditoriaMapError'
  }
}

/** Recusa o mapa que tem problema, com os caminhos deles no erro. */
export function exigirMapaDeAcoesValido(mapa: Readonly<Record<string, DefinicaoDeAcao>>): void {
  const problemas = problemasDoMapaDeAcoes(mapa)
  if (problemas.length > 0) throw new InvalidAuditoriaMapError(problemas)
}

// Falha no carregamento do módulo: um mapa com campo proibido não chega a gravar uma linha.
exigirMapaDeAcoesValido(ACOES_DE_AUDITORIA)
