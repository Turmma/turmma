import { isIP } from 'node:net'

/**
 * Prefixos das chaves de limite no Redis de cache. A chave final é `{prefixo}:{id}`, com o id que
 * veio do token verificado (usuário e escola) ou o IP do cliente (só em rota anônima). Toda chave
 * vive uma janela e expira: nada fica guardado além dela (regra 20, IP com retenção curta).
 */
export const PREFIXO_LIMITE_USUARIO = 'rl:u'
export const PREFIXO_LIMITE_ESCOLA = 'rl:e'
export const PREFIXO_LIMITE_IP = 'rl:ip'
/**
 * O limite por IP das rotas de login por senha (identidade, 15.0), num balde próprio: um script lotando o login não
 * gasta o limite anônimo do IP da escola, e a página de acesso e as outras rotas anônimas seguem respondendo.
 */
export const PREFIXO_LIMITE_IP_LOGIN = 'rl:ip-login'

/**
 * O limite por operador Turmma nas rotas `@RotaDeOperacao` (Tech Spec da A0, seção 5, "Limite"), pelo `sub` do token de
 * operador verificado. Balde próprio: dois operadores atrás do mesmo IP não dividem nada, e o operador não gasta o limite
 * de usuário de escola nenhuma.
 */
export const PREFIXO_LIMITE_OPERADOR = 'rl:op'

/**
 * O limite por IP das sete rotas de entrada da operação Turmma (`@EntradaDeOperacao`: convite, e-mail, segundo fator,
 * renovar e sair), num balde próprio, com o mesmo teto do anônimo (A0b, tarefa 9.0). A rede de uma escola sai por um IP
 * só: sem ele, os alunos dela esgotando o `rl:ip` (ou o `rl:ip-login` às 7h30) recusariam ou rebaixariam o operador que
 * estivesse na mesma rede, e as tentativas contra a entrada do operador gastariam o limite dos alunos.
 */
export const PREFIXO_LIMITE_IP_OPERACAO = 'rl:ip:op'

/**
 * O limite da busca de titulares (`rl:busca-titular`, F3, tarefa 11.0; Tech Spec do F3, seção 7c): 30 por minuto **por
 * usuário**, num balde próprio. O balde por usuário e por escola do F0 continua valendo junto; este é mais curto porque
 * a busca acha nome de pessoa. É por usuário e nunca por IP (regra 80, item 1): duas coordenações da mesma escola, atrás
 * do mesmo IP, têm 30 cada.
 */
export const PREFIXO_LIMITE_BUSCA_TITULAR = 'rl:busca-titular'

/** Janela de todo limite. Os limites da configuração são "por minuto". */
export const JANELA_LIMITE_SEGUNDOS = 60

/** Endereço que o sistema não conseguiu ler (socket já destruído). Todos esses dividem uma chave. */
export const IP_DESCONHECIDO = 'desconhecido'

const PREFIXO_IPV4_MAPEADO = '::ffff:'

/**
 * Forma única do endereço, para o mesmo cliente não virar duas chaves: IPv4 mapeado em IPv6
 * (`::ffff:10.0.0.1`) vira IPv4, e IPv6 fica em minúsculas. O que não é IP devolve `undefined`.
 */
export function normalizeIp(endereco: string | undefined): string | undefined {
  if (endereco === undefined) return undefined
  const aparado = endereco.trim().toLowerCase()
  const semMapeamento = aparado.startsWith(PREFIXO_IPV4_MAPEADO) && isIP(aparado.slice(PREFIXO_IPV4_MAPEADO.length)) === 4
    ? aparado.slice(PREFIXO_IPV4_MAPEADO.length)
    : aparado
  return isIP(semMapeamento) === 0 ? undefined : semMapeamento
}

/**
 * O IP que a borda viu, tirado do `X-Forwarded-For`. Vale só a última entrada: é a que o proxy
 * mais próximo escreveu. As anteriores são texto do cliente, e um cliente que manda
 * `X-Forwarded-For` forjado não escolhe a própria chave.
 */
export function forwardedIp(cabecalho: string | string[] | undefined): string | undefined {
  // Cabeçalho repetido: o Node junta as ocorrências com vírgula, e vale a última do mesmo jeito.
  const texto = Array.isArray(cabecalho) ? cabecalho.join(',') : cabecalho
  if (texto === undefined) return undefined
  return normalizeIp(texto.split(',').at(-1))
}

/**
 * IP da chave de limite anônimo. O `X-Forwarded-For` só é lido quando a conexão vem de um proxy
 * confiável (a borda); de qualquer outra origem, vale o endereço da própria conexão.
 */
export function clientIp(enderecoDaConexao: string | undefined, cabecalhoEncaminhado: string | string[] | undefined, conexaoDaBorda: boolean): string {
  const daConexao = normalizeIp(enderecoDaConexao) ?? IP_DESCONHECIDO
  if (!conexaoDaBorda) return daConexao
  return forwardedIp(cabecalhoEncaminhado) ?? daConexao
}

/**
 * Divisão do limite para o seguro em memória: com o Redis fora, cada instância conta sozinha, e a
 * soma das instâncias não passa do limite configurado. Nunca abaixo de 1.
 */
export function insuranceLimit(limite: number, instancias: number): number {
  return Math.max(1, Math.floor(limite / instancias))
}

/** Segundos do `Retry-After`: arredonda para cima, e nunca menos de 1 (zero mandaria repetir já). */
export function retryAfterSeconds(msAteLiberar: number): number {
  return Math.max(1, Math.ceil(msAteLiberar / 1_000))
}
