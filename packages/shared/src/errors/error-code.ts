/**
 * Código tipado de toda resposta de erro da API. O frontend decide o que mostrar pelo código,
 * nunca lendo a mensagem (regra 00, item 9).
 */
export const ErrorCode = {
  ERRO_INTERNO: 'ERRO_INTERNO',
  ENTRADA_INVALIDA: 'ENTRADA_INVALIDA',
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  CONFLITO: 'CONFLITO',
  TEMPO_ESGOTADO: 'TEMPO_ESGOTADO',
  INDISPONIVEL_TENTE_DE_NOVO: 'INDISPONIVEL_TENTE_DE_NOVO',
  LIMITE_EXCEDIDO: 'LIMITE_EXCEDIDO',
  /** Senha errada repetida segurou a conta por um tempo (429 com `Retry-After`): por conta, nunca por IP. */
  CONTA_SEGURADA: 'CONTA_SEGURADA',
  /**
   * O cookie de renovação acabou de ser trocado por outra aba ou requisição (409): a sessão continua, e a web espera
   * a renovação em andamento e tenta uma vez com o cookie atual.
   */
  JA_RENOVADO: 'JA_RENOVADO',
  /**
   * A conta Google ou Microsoft não entra nesta escola (13.0): não é de um domínio ou tenant que ela liberou, ou não
   * está ligada a ninguém dela. Uma resposta só para todos os casos. Chega à web como `?falha=conta_externa_nao_ligada`.
   */
  CONTA_EXTERNA_NAO_LIGADA: 'CONTA_EXTERNA_NAO_LIGADA',
  /**
   * Área da operação (A0): o acesso de 10 min do operador venceu, e a sessão dele continua viva (401). A web renova e
   * repete, sem mandar a pessoa entrar de novo.
   */
  ACESSO_VENCIDO: 'ACESSO_VENCIDO',
  /**
   * Área da operação (A0): a sessão do operador terminou — 30 min sem uso, 8 h, saída ou operador desativado (401). A
   * web leva à entrada dizendo que a sessão terminou, sem confundir com "não encontrado".
   */
  SESSAO_ENCERRADA: 'SESSAO_ENCERRADA',
  /**
   * A reivindicação do nome pela página pública da sala não foi aceita (A1, tarefa 6.0; 409): nome inexistente, de outra
   * turma ou escola, de ano encerrado, já tomado, ou com a matrícula que não é a dele. Uma resposta só para todos, que
   * não diz qual dos dois errou, o nome ou a matrícula (RF10; regra 10, item 6), e nada é gravado.
   */
  REIVINDICACAO_RECUSADA: 'REIVINDICACAO_RECUSADA',
  /**
   * O material não entra (MVP, D5, D75; 422): a licença declarada não permite o uso, ou a coordenação não marcou a
   * declaração. A recusa acontece antes de abrir o arquivo, não grava `material` e fica na auditoria (`material.recusado`).
   */
  MATERIAL_SEM_LICENCA: 'MATERIAL_SEM_LICENCA',
  /**
   * A coordenação suspendeu esta função da IA na escola (D60; 409): o servidor recusa executar, e o que já foi produzido
   * continua onde estava. A resposta não diz quem suspendeu.
   */
  FUNCAO_SUSPENSA: 'FUNCAO_SUSPENSA',
  /** O aluno chegou ao freio diário de trocas com o Tutor (D38; 429). O número vem da configuração da escola. */
  LIMITE_DIARIO_DO_TUTOR: 'LIMITE_DIARIO_DO_TUTOR',
  /** A turma gastou o pacote do mês do Tutor (D38; 429): as trocas de todos os alunos da turma somadas. */
  PACOTE_DO_TUTOR_ESGOTADO: 'PACOTE_DO_TUTOR_ESGOTADO',
  /** Há atividade avaliativa aberta para a turma do aluno, e o Tutor fica travado enquanto ela durar (regra 30, item 10; 409). */
  TUTOR_PAUSADO_EM_AVALIACAO: 'TUTOR_PAUSADO_EM_AVALIACAO',
  /**
   * O lote de correção ainda tem caso destacado que o professor não abriu (D33, D56; 409): a aprovação só passa com
   * todos abertos, e a validação não é gravada.
   */
  DESTAQUES_NAO_ABERTOS: 'DESTAQUES_NAO_ABERTOS',
  /** A entrega já foi aprovada ou rejeitada (409): a segunda decisão não grava nada nem troca a primeira. */
  ENTREGA_JA_DECIDIDA: 'ENTREGA_JA_DECIDIDA',
  /**
   * A versão adaptada ainda não foi aprovada pelo professor (regra 70, item 3; 409): enquanto a entrega dela estiver
   * pendente ou rejeitada, ela não é aplicada à turma.
   */
  VERSAO_ADAPTADA_NAO_APROVADA: 'VERSAO_ADAPTADA_NAO_APROVADA',
  /** A atividade foi encerrada pelo professor ou já foi enviada pelo aluno (409): a resposta não é mais aceita. */
  ATIVIDADE_ENCERRADA: 'ATIVIDADE_ENCERRADA',
  /**
   * Os erros da camada de IA (MVP; regra 30; regra 80, item 4). São os códigos que `execucao_agente.erro` e
   * `consumo_ia.codigo_de_erro` guardam, e o que a tela recebe em `GET /v1/execucoes/:id`: nunca o erro cru do provedor,
   * que pode repetir o prompt. O provedor não respondeu, recusou por limite ou falhou (503).
   */
  IA_INDISPONIVEL: 'IA_INDISPONIVEL',
  /** A chamada ao modelo, ou a execução inteira, passou do prazo (503). */
  IA_TEMPO_ESGOTADO: 'IA_TEMPO_ESGOTADO',
  /** A saída do modelo não passou no schema nem na conferência da tarefa, mesmo depois da repetição (502). Nada dela é usado. */
  IA_SAIDA_INVALIDA: 'IA_SAIDA_INVALIDA',
  /** O orçamento de IA da escola não cobre mais uma chamada (D14; 429). O freio do Tutor por aluno tem código próprio. */
  IA_ORCAMENTO_ESGOTADO: 'IA_ORCAMENTO_ESGOTADO',
  /** Quem chamou a camada de IA mandou entrada fora do schema da tarefa (500): é defeito nosso, e nada foi ao modelo. */
  IA_ENTRADA_INVALIDA: 'IA_ENTRADA_INVALIDA',
  /** A execução ficou parada além do prazo porque o processo caiu ou reiniciou no meio dela (503): a varredura a encerrou. */
  EXECUCAO_INTERROMPIDA: 'EXECUCAO_INTERROMPIDA',
  /**
   * O material da escola não tem trecho sobre o tema pedido (422): sem página para citar, a ferramenta não gera (D6;
   * regra 30, item 12).
   */
  MATERIAL_INSUFICIENTE: 'MATERIAL_INSUFICIENTE',
  /**
   * O ajuste de retenção pedido pela operação (`ops:retencao`; F3, RF2; 422) não cabe: abaixo do piso ou acima do teto
   * da categoria, acima do prazo da categoria que a trava, ou numa categoria que não se ajusta (registro de acesso,
   * auditoria e os outros prazos fixos). Nada é gravado.
   */
  RETENCAO_FORA_DO_LIMITE: 'RETENCAO_FORA_DO_LIMITE',
  /**
   * O pedido do titular não está no estado que a ação pede (F3, RF16; 409): concluir um pedido já concluído ou
   * cancelado, concluir a eliminação, ou corrigir o nome fora de um pedido de correção aberto. Nada é gravado.
   */
  PEDIDO_EM_ESTADO_INVALIDO: 'PEDIDO_EM_ESTADO_INVALIDO',
  /**
   * O acesso desta pessoa está suspenso porque a escola registrou o pedido de eliminação dela (F3, RF14; 403): os 7 dias
   * até a eliminação de fato, em que a coordenação ainda pode cancelar. **Só sai depois da credencial conferida** (a
   * senha certa, o refresh da sessão ou a conta Google ou Microsoft validada pelo provedor): com a senha errada, a
   * resposta é a da matrícula que não existe, e quem não tem a credencial nunca sabe que há pedido (regra 10, item 6).
   */
  ACESSO_SUSPENSO: 'ACESSO_SUSPENSO',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Envelope de toda resposta de erro. Não há campo livre: nem stack, nem consulta, nem valor
 * de campo. "Não encontrado" e "sem permissão" chegam aqui iguais (regra 10, item 6).
 */
export interface ErrorResponse {
  erro: {
    codigo: ErrorCode
    mensagem: string
    requisicaoId: string
  }
}
