/**
 * O começo da chave de cada consulta das telas do Assistente (A2). Ficam num arquivo sem mais nada para a regra do ciclo
 * de execução (`ciclo-de-execucao.ts`) dizer o que invalidar sem carregar a sessão nem a rede.
 */
export const TIME_QUERY_KEY = ['time'] as const
export const CONVERSA_QUERY_KEY = ['assistente', 'conversa'] as const
export const ARTEFATOS_QUERY_KEY = ['artefatos'] as const
export const ENTREGAS_QUERY_KEY = ['entregas'] as const
export const EXECUCOES_QUERY_KEY = ['execucoes'] as const
export const ATIVIDADES_QUERY_KEY = ['atividades-aplicadas'] as const
export const CORRECAO_QUERY_KEY = ['correcao'] as const
export const DESEMPENHO_QUERY_KEY = ['desempenho'] as const
export const SINAIS_QUERY_KEY = ['sinais'] as const
export const USO_DO_TUTOR_QUERY_KEY = ['uso-do-tutor'] as const
