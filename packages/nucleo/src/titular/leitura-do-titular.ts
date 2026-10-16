import type { PapelDoTitular, VersaoDoArquivo } from '@educa/shared'
import { sql, type SQL } from 'drizzle-orm'
import { exigirEscolaDoContexto } from '../contexto/escola-do-contexto.js'
import type { Banco, TransacaoBanco } from '../db/banco.js'
import { CompartilhamentoRepository } from './compartilhamento.repository.js'

/**
 * O que a escola guarda do titular, como o arquivo o leva (F3, tarefa 13.0; RF11 e RF12; Tech Spec do F3, seção 3,
 * "Cada tabela da classificação diz se entra no arquivo" e seção 5, "Arquivo"; regra 20, itens 4 e 19; regra 70, itens 3,
 * 6 e 8). Esta é a lista, tabela a tabela, e é por ela que o teste de arquitetura confere a `CLASSIFICACAO_DAS_TABELAS`:
 * tabela que a classificação diz que entra tem leitura aqui, e a leitura daqui é de tabela que a classificação diz que
 * entra.
 *
 * **O critério de cada coluna** (decisão da 13.0, registrada na Tech Spec do F3, seção 5):
 *
 * 1. **Só o que é do titular.** Cada leitura devolve as colunas por **lista permitida**, nunca a linha inteira: coluna
 *    nova numa tabela do arquivo não chega a ele sozinha, e o teste confere que toda coluna da tabela está numa das duas
 *    listas, a do que entra e a do `fora`, cada uma com o motivo.
 * 2. **O id de outra pessoa não entra.** `criado_por`, `decidida_por`, `registrado_por`, `concluido_por`, `cancelado_por`,
 *    `enviado_por`... são o id de quem da escola agiu sobre o titular: ficam na auditoria da escola, e não no arquivo.
 *    Quando o titular é **o autor** de um ato sobre outra pessoa (o professor que aprovou o lote, que decidiu uma
 *    reivindicação, que abriu um destaque), a linha entra só com o ato: o quê, sobre qual lote, e quando, **nunca o dado
 *    da outra pessoa** (o diagnóstico do aluno, o nome na lista).
 * 3. **O que nunca entra, em nenhuma versão** (`COLUNAS_FORA_DO_ARQUIVO`): hash, segredo, chave de envio, chave de objeto,
 *    `sub` da conta externa. Cada uma delas aparece abaixo na lista `fora` da sua tabela.
 * 4. **A saída de IA que o professor não aprovou não chega.** A correção de lote pendente ou rejeitado sai só como o
 *    estado dele ("em validação pelo professor", "rejeitada pelo professor"), sem acertos nem diagnóstico, **nas duas
 *    versões** (regra 70, item 3). O conteúdo do artefato nunca sai: o aluno não lê o artefato, que tem gabarito.
 * 5. **A versão da coordenação** (`coordenacao`, do titular sem conta ativa) nunca traz a conversa do professor com o
 *    Assistente (`thread_agente`, `mensagem_agente`), a `entrada` das execuções que ele pediu, a `entrada` e a `saida` do
 *    consumo de IA, nem a `justificativa` das entregas (regra 70, item 8). Traz a conversa do Tutor, pela exceção
 *    declarada no PRD, seção 6. Também não traz a `introducao_vista_em` do professor (D64); a do aluno vai nas duas.
 */

/** Uma tabela do arquivo: a descrição que o resumo mostra e as leituras, que dependem da versão. */
interface LeituraDaTabela {
  /** O que a tabela é, em linguagem comum: é o texto do resumo que o titular lê. */
  readonly descricao: string
  /** Se a tabela entra na versão. Sem isto, entra nas duas. */
  readonly naVersao?: (versao: VersaoDoArquivo) => boolean
  /**
   * Os `select`s da tabela, cada um com as colunas que o titular vê **nessa ligação**. Todos devolvem a coluna `id`, que
   * é o que junta duas ligações da mesma linha. O escopo é a escola do contexto, e a pessoa vem de quem monta o arquivo.
   */
  readonly consultas: (alvo: AlvoDaLeitura) => readonly SQL[]
  /**
   * O que a tabela tem e o arquivo **não** leva, por coluna e com o motivo. Junto com as colunas que entram, cobre a tabela
   * inteira: é o que prende o critério quando uma coluna nasce.
   */
  readonly fora: Readonly<Record<string, string>>
  /** As colunas **da tabela** que o arquivo leva (na versão completa), para a conferência de cobertura. */
  readonly colunas: readonly string[]
  /** As que a consulta calcula e a tabela não tem, como a `situacao` da correção. */
  readonly derivadas?: readonly string[]
}

interface AlvoDaLeitura {
  readonly escolaId: string
  readonly titularId: string
  readonly versao: VersaoDoArquivo
}

const NOME_DE_COLUNA = /^[a-z][a-z0-9_]*$/

/** `t.a, t.b, ...`: as colunas de uma lista permitida, conferidas pelo formato, nunca vindas de fora. */
export function colunasDoSelect(...nomes: readonly string[]): SQL {
  for (const nome of nomes) if (!NOME_DE_COLUNA.test(nome)) throw new Error(`nome de coluna fora do formato: ${nome}`)
  return sql.raw(nomes.map((nome) => `t.${nome}`).join(', '))
}

/** As colunas de uma versão: as que entram sempre, e as que só a `completa` leva (critério 5). */
const porVersao = (versao: VersaoDoArquivo, sempre: readonly string[], soNaCompleta: readonly string[]): readonly string[] =>
  versao === 'completa' ? [...sempre, ...soNaCompleta] : sempre

/** O motivo-padrão do id de outra pessoa (critério 2): ele vive na auditoria da escola. */
const OUTRA_PESSOA = 'id de outra pessoa da escola: fica na auditoria da escola'
const SEGREDO = 'segredo ou chave de envio: nunca entra, em nenhuma versão'
const ESCOPO = 'a escola do contexto: o arquivo é todo dela'

/**
 * As leituras, na ordem do arquivo. A chave é o nome da tabela. Cada `consultas` recebe a escola, o titular e a versão, e
 * devolve instruções cujo resultado é uma linha por registro, com as colunas permitidas.
 */
export const LEITURAS_DO_ARQUIVO: Readonly<Record<string, LeituraDaTabela>> = {
  usuario: {
    descricao: 'O seu cadastro na escola',
    colunas: ['id', 'papel', 'nome', 'desativado_em', 'introducao_vista_em'],
    fora: {
      escola_id: ESCOPO,
      conta_id: 'ligação interna com a conta global; o e-mail da conta vem em `conta`',
      eliminacao_agendada_em: 'espelho do pedido de eliminação (14.0): a data do pedido e o `eliminar_em` dele já estão em `pedido_titular`',
    },
    consultas: ({ escolaId, titularId, versao }) => [
      // A data da introdução é do titular: o aluno a recebe nas duas versões (art. 18), e a do professor só na completa (D64).
      sql`select ${colunasDoSelect('id', 'papel', 'nome', 'desativado_em')}, ${versao === 'completa' ? sql.raw('t.introducao_vista_em') : sql.raw("case when t.papel = 'aluno' then t.introducao_vista_em end as introducao_vista_em")} from usuario t where t.escola_id = ${escolaId} and t.id = ${titularId}`,
    ],
  },
  conta: {
    descricao: 'O e-mail da sua conta de acesso',
    colunas: ['id', 'email'],
    fora: {
      senha_hash: SEGREDO,
      mfa_segredo_cifrado: SEGREDO,
      mfa_chave_versao: SEGREDO,
      mfa_ativado_em: 'estado do segundo fator: configuração de segurança, não dado do titular',
      mfa_ultimo_passo: SEGREDO,
    },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'email')} from conta t join usuario u on u.conta_id = t.id where u.escola_id = ${escolaId} and u.id = ${titularId}`,
    ],
  },
  credencial_matricula: {
    descricao: 'A sua matrícula de acesso',
    colunas: ['id', 'matricula', 'criada_em'],
    fora: { escola_id: ESCOPO, usuario_id: 'o próprio titular', senha_hash: SEGREDO },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'matricula', 'criada_em')} from credencial_matricula t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`,
    ],
  },
  conta_externa: {
    descricao: 'A ligação com a conta Google ou Microsoft da escola',
    colunas: ['id', 'provedor'],
    fora: { escola_id: ESCOPO, usuario_id: 'o próprio titular', tenant: SEGREDO, sujeito: SEGREDO, ligada_em: 'a Tech Spec, seção 3, diz "só o provedor"' },
    consultas: ({ escolaId, titularId }) => [sql`select ${colunasDoSelect('id', 'provedor')} from conta_externa t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`],
  },
  vinculo: {
    descricao: 'Os seus vínculos com turmas e disciplinas',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'disciplina_id', 'papel', 'estado', 'contestacao', 'complemento', 'motivo_encerramento', 'criado_em', 'decidido_em', 'encerrado_em'],
    fora: { escola_id: ESCOPO, usuario_id: 'o próprio titular', criado_por: OUTRA_PESSOA },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'disciplina_id', 'papel', 'estado', 'contestacao', 'complemento', 'motivo_encerramento', 'criado_em', 'decidido_em', 'encerrado_em')} from vinculo t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`,
    ],
  },
  lista_nome: {
    descricao: 'O seu nome na lista da turma',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'nome', 'matricula', 'estado', 'criado_em'],
    fora: { escola_id: ESCOPO, usuario_id: 'o próprio titular', criado_por: OUTRA_PESSOA },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'nome', 'matricula', 'estado', 'criado_em')} from lista_nome t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`,
    ],
  },
  reivindicacao: {
    descricao: 'Os pedidos de entrada na turma feitos com o seu nome ou decididos por você',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'lista_nome_id', 'estado', 'solicitada_em', 'decidida_em', 'decidida_como'],
    fora: {
      escola_id: ESCOPO,
      chave_envio: SEGREDO,
      senha_hash: SEGREDO,
      teve_matricula_errada: 'sinal de segurança sobre tentativas de outra pessoa naquele nome, não dado do titular',
      decidida_por: OUTRA_PESSOA,
    },
    consultas: ({ escolaId, titularId }) => [
      // O aluno: todo pedido ligado à linha dele na lista de nomes (`lista_nome.usuario_id`): o que o aprovou e também o
      // recusado antes naquele nome, que pode ter sido de outra pessoa. A recusa devolve o nome a `livre` e o pedido continua
      // apontando para a linha (`devolverNome`, `apps/api/src/sala/decisao.repository.ts`). Entra de propósito, e não
      // identifica ninguém: a linha leva `id`, `ano_letivo_id`, `turma_id`, `lista_nome_id`, o estado, as datas e `decidida_como`,
      // e `decidida_por`, `chave_envio`, `senha_hash` e `teve_matricula_errada` ficam na `fora`.
      // Por isso o texto diz "feitos com o seu nome", e não "que você fez".
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'lista_nome_id', 'estado', 'solicitada_em', 'decidida_em', 'decidida_como')} from reivindicacao t
          where t.escola_id = ${escolaId} and t.lista_nome_id in (select l.id from lista_nome l where l.escola_id = ${escolaId} and l.usuario_id = ${titularId})`,
      // Quem decidiu (o professor): só o ato. A turma e a linha da lista são do aluno que pediu (critério 2).
      sql`select t.id, t.estado, t.decidida_em, t.decidida_como from reivindicacao t where t.escola_id = ${escolaId} and t.decidida_por = ${titularId}`,
    ],
  },
  sessao: {
    descricao: 'As suas sessões abertas no sistema',
    colunas: ['id', 'metodo', 'ultimo_uso_em', 'expira_em', 'encerrada_em', 'motivo'],
    fora: {
      escola_id: ESCOPO,
      conta_id: 'ligação interna com a conta global',
      usuario_id: 'o próprio titular',
      familia: 'identificador técnico da rotação do token',
      refresh_hash: SEGREDO,
      refresh_hash_anterior: SEGREDO,
      atual_apresentado: 'estado técnico da rotação do token',
      rotacionado_em: 'estado técnico da rotação do token',
    },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'metodo', 'ultimo_uso_em', 'expira_em', 'encerrada_em', 'motivo')} from sessao t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`,
    ],
  },
  registro_acesso: {
    descricao: 'Os registros de entrada no sistema, com data, hora e IP',
    colunas: ['id', 'evento', 'ip', 'em'],
    fora: { escola_id: ESCOPO, usuario_id: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'evento', 'ip', 'em')} from registro_acesso t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`,
    ],
  },
  mensagem_tutor: {
    descricao: 'Sua conversa com o Tutor',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'execucao_id', 'atividade_aplicada_id', 'questao', 'material_id', 'pagina', 'autor', 'tipo', 'texto', 'citacoes', 'criada_em'],
    fora: { escola_id: ESCOPO, aluno_id: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'execucao_id', 'atividade_aplicada_id', 'questao', 'material_id', 'pagina', 'autor', 'tipo', 'texto', 'citacoes', 'criada_em')} from mensagem_tutor t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
    ],
  },
  sinal_tutor: {
    descricao: 'Os sinais que o Tutor deu ao professor sobre a sua dúvida',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'execucao_id', 'tipo', 'atividade_aplicada_id', 'questao', 'material_id', 'pagina', 'criado_em'],
    fora: { escola_id: ESCOPO, aluno_id: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'execucao_id', 'tipo', 'atividade_aplicada_id', 'questao', 'material_id', 'pagina', 'criado_em')} from sinal_tutor t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
    ],
  },
  thread_agente: {
    descricao: 'As suas conversas com o Assistente de ensino',
    naVersao: (versao) => versao === 'completa',
    colunas: ['id', 'ano_letivo_id', 'agente', 'criada_em'],
    fora: { escola_id: ESCOPO, usuario_id: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'agente', 'criada_em')} from thread_agente t where t.escola_id = ${escolaId} and t.usuario_id = ${titularId}`,
    ],
  },
  mensagem_agente: {
    descricao: 'O que você escreveu ao Assistente de ensino e o que ele respondeu',
    naVersao: (versao) => versao === 'completa',
    colunas: ['id', 'ano_letivo_id', 'thread_id', 'execucao_id', 'autor', 'conteudo', 'turma_id', 'disciplina_id', 'criada_em'],
    fora: { escola_id: ESCOPO },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'thread_id', 'execucao_id', 'autor', 'conteudo', 'turma_id', 'disciplina_id', 'criada_em')} from mensagem_agente t
          where t.escola_id = ${escolaId} and t.thread_id in (select h.id from thread_agente h where h.escola_id = ${escolaId} and h.usuario_id = ${titularId})`,
    ],
  },
  execucao_agente: {
    descricao: 'Os pedidos que você fez à IA',
    colunas: ['id', 'ano_letivo_id', 'funcao', 'tarefa', 'estado', 'entrada', 'resultado', 'erro', 'criada_em', 'iniciada_em', 'concluida_em', 'anonimizada_em'],
    fora: { escola_id: ESCOPO, solicitada_por: 'o próprio titular', chave_envio: SEGREDO },
    consultas: ({ escolaId, titularId, versao }) => [
      // A `entrada` leva o tema que o professor escreveu: só na versão completa (critério 5).
      sql`select ${colunasDoSelect(...porVersao(versao, ['id', 'ano_letivo_id', 'funcao', 'tarefa', 'estado', 'resultado', 'erro', 'criada_em', 'iniciada_em', 'concluida_em', 'anonimizada_em'], ['entrada']))} from execucao_agente t
          where t.escola_id = ${escolaId} and t.solicitada_por = ${titularId}`,
    ],
  },
  consumo_ia: {
    descricao: 'As chamadas à IA feitas por você ou para você: modelo, tamanho e custo',
    colunas: [
      'id', 'execucao_id', 'tarefa', 'funcao', 'perfil', 'origem', 'modelo', 'prompt_versao', 'tokens_de_entrada', 'tokens_de_saida', 'custo_micros', 'duracao_ms',
      'envio_externo', 'provedor', 'tentativas', 'estado', 'codigo_de_erro', 'entrada', 'saida', 'em',
    ],
    fora: { escola_id: ESCOPO, aluno_id: 'o próprio titular, quando a chamada é do Tutor' },
    consultas: ({ escolaId, titularId, versao }) => {
      // O `entrada` e a `saida` são o que foi enviado ao modelo e o que ele respondeu: só na versão completa (critério 5).
      const colunas = colunasDoSelect(
        ...porVersao(
          versao,
          ['id', 'execucao_id', 'tarefa', 'funcao', 'perfil', 'origem', 'modelo', 'prompt_versao', 'tokens_de_entrada', 'tokens_de_saida', 'custo_micros', 'duracao_ms', 'envio_externo', 'provedor', 'tentativas', 'estado', 'codigo_de_erro', 'em'],
          ['entrada', 'saida'],
        ),
      )
      return [
        // Os dois ramos descem por índice que começa na escola: o do `aluno_id` e o da execução que o titular pediu.
        sql`select ${colunas} from consumo_ia t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
        sql`select ${colunas} from consumo_ia t join execucao_agente e on e.escola_id = t.escola_id and e.id = t.execucao_id
            where t.escola_id = ${escolaId} and e.solicitada_por = ${titularId}`,
      ]
    },
  },
  tentativa_atividade: {
    descricao: 'As atividades que você começou e enviou',
    colunas: ['id', 'ano_letivo_id', 'atividade_aplicada_id', 'iniciada_em', 'enviada_em'],
    fora: { escola_id: ESCOPO, aluno_id: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'atividade_aplicada_id', 'iniciada_em', 'enviada_em')} from tentativa_atividade t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
    ],
  },
  resposta_atividade: {
    descricao: 'As suas respostas nas atividades',
    colunas: ['id', 'ano_letivo_id', 'atividade_aplicada_id', 'questao', 'alternativa', 'respondida_em'],
    fora: { escola_id: ESCOPO, aluno_id: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'atividade_aplicada_id', 'questao', 'alternativa', 'respondida_em')} from resposta_atividade t where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
    ],
  },
  correcao: {
    descricao: 'A correção e o diagnóstico das suas atividades, depois de aprovados pelo professor',
    colunas: ['id', 'ano_letivo_id', 'entrega_id', 'atividade_aplicada_id', 'acertos', 'total', 'em_branco', 'por_habilidade', 'destaques', 'corrigida_em'],
    derivadas: ['situacao'],
    fora: {
      escola_id: ESCOPO,
      aluno_id: 'o próprio titular',
      destaque_aberto_em: 'registro interno da validação do professor sobre o lote',
      destaque_aberto_por: OUTRA_PESSOA,
    },
    consultas: ({ escolaId, titularId }) => [
      // O aluno: o resultado só com o lote aprovado. Lote pendente ou rejeitado sai só como o estado dele (regra 70, item 3): os
      // números e o diagnóstico nem chegam ao `select`, para não haver caminho que os devolva.
      sql`select t.id, t.ano_letivo_id, t.entrega_id, t.atividade_aplicada_id,
            case e.estado when 'aprovada' then 'aprovada_pelo_professor' when 'rejeitada' then 'rejeitada_pelo_professor' else 'em_validacao_pelo_professor' end as situacao,
            case when e.estado = 'aprovada' then t.acertos end as acertos,
            case when e.estado = 'aprovada' then t.total end as total,
            case when e.estado = 'aprovada' then t.em_branco end as em_branco,
            case when e.estado = 'aprovada' then t.por_habilidade end as por_habilidade,
            case when e.estado = 'aprovada' then t.destaques end as destaques,
            case when e.estado = 'aprovada' then t.corrigida_em end as corrigida_em
          from correcao t join entrega e on e.escola_id = t.escola_id and e.id = t.entrega_id
          where t.escola_id = ${escolaId} and t.aluno_id = ${titularId}`,
      // Quem abriu o destaque (o professor): só o ato, sobre qual lote e quando (critério 2).
      sql`select t.id, t.entrega_id from correcao t where t.escola_id = ${escolaId} and t.destaque_aberto_por = ${titularId}`,
    ],
  },
  artefato: {
    descricao: 'Os materiais que você gerou com a IA: título, tipo e datas (nunca o conteúdo)',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'disciplina_id', 'tipo', 'titulo', 'origem_id', 'execucao_id', 'criado_em', 'atualizado_em'],
    fora: {
      escola_id: ESCOPO,
      criado_por: 'o próprio titular',
      conteudo: 'o conteúdo do artefato aplicado tem gabarito, e o aluno nunca o lê (Tech Spec do F3, seção 3)',
    },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'disciplina_id', 'tipo', 'titulo', 'origem_id', 'execucao_id', 'criado_em', 'atualizado_em')} from artefato t where t.escola_id = ${escolaId} and t.criado_por = ${titularId}`,
    ],
  },
  entrega: {
    descricao: 'As entregas da IA que você aprovou ou rejeitou',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'funcao', 'tipo', 'artefato_id', 'atividade_aplicada_id', 'execucao_id', 'estado', 'decidida_em', 'justificativa', 'criada_em'],
    fora: { escola_id: ESCOPO, decidida_por: 'o próprio titular' },
    consultas: ({ escolaId, titularId, versao }) => [
      // A `justificativa` é texto do professor: só na versão completa (critério 5).
      sql`select ${colunasDoSelect(...porVersao(versao, ['id', 'ano_letivo_id', 'turma_id', 'funcao', 'tipo', 'artefato_id', 'atividade_aplicada_id', 'execucao_id', 'estado', 'decidida_em', 'criada_em'], ['justificativa']))} from entrega t
          where t.escola_id = ${escolaId} and t.decidida_por = ${titularId}`,
    ],
  },
  atividade_aplicada: {
    descricao: 'As atividades que você aplicou à turma',
    colunas: ['id', 'ano_letivo_id', 'turma_id', 'artefato_id', 'avaliativa', 'estado', 'aplicada_em', 'encerrada_em'],
    fora: { escola_id: ESCOPO, aplicada_por: 'o próprio titular' },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'turma_id', 'artefato_id', 'avaliativa', 'estado', 'aplicada_em', 'encerrada_em')} from atividade_aplicada t where t.escola_id = ${escolaId} and t.aplicada_por = ${titularId}`,
    ],
  },
  validacao_do_lote: {
    descricao: 'O registro de que você validou a correção de um lote',
    colunas: ['id', 'ano_letivo_id', 'entrega_id', 'atividade_aplicada_id', 'confirmada_em'],
    fora: {
      escola_id: ESCOPO,
      confirmada_por: 'o próprio titular',
      apresentado: 'o resumo do lote e dos destaques, com o id e o motivo de outros alunos (critério 2)',
      aberto: 'quais destaques foram abertos, com o id de outros alunos (critério 2)',
    },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'ano_letivo_id', 'entrega_id', 'atividade_aplicada_id', 'confirmada_em')} from validacao_do_lote t where t.escola_id = ${escolaId} and t.confirmada_por = ${titularId}`,
    ],
  },
  material: {
    descricao: 'Os materiais da escola que você enviou ou excluiu',
    colunas: ['id', 'disciplina_id', 'titulo', 'titularidade', 'licenca', 'declaracao', 'tamanho_bytes', 'paginas', 'estado', 'enviado_em', 'excluido_em'],
    fora: {
      escola_id: ESCOPO,
      licenciante: 'o nome do dono do direito, que é de terceiro',
      sha256: 'identificador técnico do arquivo',
      falha: 'código técnico da extração',
      enviado_por: 'o próprio titular',
      excluido_por: 'o próprio titular',
    },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'disciplina_id', 'titulo', 'titularidade', 'licenca', 'declaracao', 'tamanho_bytes', 'paginas', 'estado', 'enviado_em', 'excluido_em')} from material t
          where t.escola_id = ${escolaId} and (t.enviado_por = ${titularId} or t.excluido_por = ${titularId})`,
    ],
  },
  suspensao_de_funcao: {
    descricao: 'As suspensões de função da IA que você registrou ou retomou',
    colunas: ['id', 'funcao', 'motivo', 'suspensa_em', 'retomada_em'],
    fora: { escola_id: ESCOPO, suspensa_por: 'o próprio titular', retomada_por: 'o próprio titular ou ' + OUTRA_PESSOA },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'funcao', 'motivo', 'suspensa_em', 'retomada_em')} from suspensao_de_funcao t
          where t.escola_id = ${escolaId} and (t.suspensa_por = ${titularId} or t.retomada_por = ${titularId})`,
    ],
  },
  auditoria: {
    descricao: 'O registro do que você fez no sistema',
    colunas: ['id', 'acao', 'entidade', 'entidade_id', 'finalidade', 'em'],
    fora: {
      escola_id: ESCOPO,
      autor_usuario_id: 'o próprio titular',
      autor_operador: 'só existe em ato da nossa equipe',
      requisicao_id: 'identificador técnico da requisição',
      antes: 'pode levar o id e o motivo de outra pessoa (o aluno de um destaque, o usuário de um convite)',
      depois: 'pode levar o id e o motivo de outra pessoa (o aluno de um destaque, o usuário de um convite)',
    },
    consultas: ({ escolaId, titularId }) => [
      // Só o ato: a ação, a entidade, a finalidade e o instante (critério 2).
      sql`select ${colunasDoSelect('id', 'acao', 'entidade', 'entidade_id', 'finalidade', 'em')} from auditoria t where t.escola_id = ${escolaId} and t.autor_usuario_id = ${titularId}`,
    ],
  },
  pedido_titular: {
    descricao: 'Os pedidos que a escola registrou sobre os seus dados',
    colunas: ['id', 'papel_titular', 'tipo', 'solicitante', 'chegou_em', 'estado', 'eliminar_em', 'compartilhamento', 'nome_trocado', 'homonimo', 'registrado_em', 'concluido_em', 'cancelado_em'],
    fora: {
      escola_id: ESCOPO,
      titular_id: 'o próprio titular',
      eliminacao_enfileirada_em: 'marca técnica da fila de eliminação',
      registrado_por: OUTRA_PESSOA,
      concluido_por: OUTRA_PESSOA,
      cancelado_por: OUTRA_PESSOA,
      chave_envio: SEGREDO,
    },
    consultas: ({ escolaId, titularId }) => [
      sql`select ${colunasDoSelect('id', 'papel_titular', 'tipo', 'solicitante', 'chegou_em', 'estado', 'eliminar_em', 'compartilhamento', 'nome_trocado', 'homonimo', 'registrado_em', 'concluido_em', 'cancelado_em')} from pedido_titular t
          where t.escola_id = ${escolaId} and t.titular_id = ${titularId}`,
    ],
  },
}

/** Uma tabela do arquivo, como o JSON a leva. */
export type LinhasDaTabela = Array<Record<string, unknown>>

/**
 * Por onde o dado do titular passou. `empresas` é a foto que o pedido guardou e que a coordenação vê (para o professor, só
 * por período: D64). `usoReal` são as datas reais de uso da IA por empresa, e **só a versão completa do professor as leva**:
 * é o dado que a coordenação nunca vê, e que ele, baixando o próprio arquivo, pode ver (D64; Tech Spec do F3, seção 5).
 */
export interface CompartilhamentoDoArquivo {
  readonly empresas: unknown
  readonly usoReal?: ReadonlyArray<{ readonly provedor: string | null; readonly primeiroEm: string; readonly ultimoEm: string }>
}

export interface DocumentoDoTitular {
  /** A versão que este documento é: `completa` ou `coordenacao`. */
  readonly versao: VersaoDoArquivo
  readonly geradoEm: string
  readonly titular: { readonly id: string; readonly papel: PapelDoTitular }
  /** O que o arquivo leva, em linguagem comum: uma linha por tabela que tem registro, com a quantidade. */
  readonly resumo: ReadonlyArray<{ readonly conteudo: string; readonly registros: number }>
  readonly compartilhamento: CompartilhamentoDoArquivo
  readonly tabelas: Readonly<Record<string, LinhasDaTabela>>
}

/** O que o `montar` precisa além do titular: a versão, a foto do compartilhamento do pedido e o relógio. */
export interface PedidoDeLeitura {
  readonly titularId: string
  readonly papel: PapelDoTitular
  readonly versao: VersaoDoArquivo
  readonly compartilhamento: unknown
  readonly geradoEm: Date
}

/**
 * Monta o documento do titular na escola do contexto (F3, 13.0). **A escola nunca é argumento**: vem do contexto (regra 10,
 * item 3), e cada consulta a leva na cláusula. O resultado de cada consulta sai como `jsonb` do próprio banco, então datas,
 * `inet` e `bigint` chegam como texto e número, e o que o arquivo guarda é o que o Postgres escreveu.
 */
export class LeituraDoTitular {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  async montar(pedido: PedidoDeLeitura): Promise<DocumentoDoTitular> {
    const alvo: AlvoDaLeitura = { escolaId: exigirEscolaDoContexto(), titularId: pedido.titularId, versao: pedido.versao }
    const tabelas: Record<string, LinhasDaTabela> = {}
    const resumo: Array<{ conteudo: string; registros: number }> = []
    for (const [nome, leitura] of Object.entries(LEITURAS_DO_ARQUIVO)) {
      if (leitura.naVersao !== undefined && !leitura.naVersao(pedido.versao)) continue
      const porId = new Map<string, Record<string, unknown>>()
      for (const consulta of leitura.consultas(alvo)) {
        const { rows } = await this.banco.execute<{ linha: Record<string, unknown> }>(sql`select to_jsonb(x) as linha from (${consulta}) x order by x.id`)
        // A mesma linha por duas ligações (o consumo do Tutor casa pelo aluno e pela execução) entra uma vez, pelo `id`.
        for (const { linha } of rows) porId.set(String(linha['id']), semNulosDaCorrecao(nome, linha))
      }
      const linhas = [...porId.values()]
      if (linhas.length === 0) continue
      tabelas[nome] = linhas
      resumo.push({ conteudo: leitura.descricao, registros: linhas.length })
    }
    // As datas reais de uso só no arquivo completo do professor, que ele mesmo baixa (D64).
    const usoReal = pedido.versao === 'completa' && pedido.papel === 'professor' ? await new CompartilhamentoRepository(this.banco).usoRealDoProfessor(pedido.titularId) : undefined
    return {
      versao: pedido.versao,
      geradoEm: pedido.geradoEm.toISOString(),
      titular: { id: pedido.titularId, papel: pedido.papel },
      resumo,
      compartilhamento: {
        empresas: pedido.compartilhamento,
        ...(usoReal === undefined ? {} : { usoReal: usoReal.map(({ provedor, primeiro, ultimo }) => ({ provedor, primeiroEm: primeiro.toISOString(), ultimoEm: ultimo.toISOString() })) }),
      },
      tabelas,
    }
  }
}

/**
 * A correção de lote que o professor não aprovou sai só com o estado dele: as colunas dos números e do diagnóstico saem do
 * JSON, e não como `null`, para o arquivo não dizer nem "tem diagnóstico, escondido".
 */
function semNulosDaCorrecao(tabela: string, linha: Record<string, unknown>): Record<string, unknown> {
  // Só a linha do aluno (a que tem `situacao`) passa por aqui: a do professor que abriu o destaque não leva nenhum dos números.
  if (tabela !== 'correcao' || !('situacao' in linha) || linha['situacao'] === 'aprovada_pelo_professor') return linha
  const { acertos: _a, total: _t, em_branco: _e, por_habilidade: _p, destaques: _d, corrigida_em: _c, ...resto } = linha
  return resto
}
