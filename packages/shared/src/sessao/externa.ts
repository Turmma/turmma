/**
 * O login pela conta Google ou Microsoft da escola (13.0) termina num redirecionamento à web, e nunca num corpo JSON:
 * quem chega ao retorno é o navegador, vindo do provedor. A falha vai no parâmetro `falha` do endereço da escola
 * (`/e/:slug?falha=...`), e a tela (19.0) mostra o que fazer.
 *
 * - `provedor`: o Google ou a Microsoft responderam com erro (a escola não liberou o app, a pessoa cancelou), não
 *   responderam a tempo, ou o retorno chegou sem o cookie do início. A tela oferece a matrícula ou o e-mail.
 * - `conta_externa_nao_ligada`: a conta não é de um domínio ou tenant da escola, ou não está ligada a ninguém dela
 *   (`CONTA_EXTERNA_NAO_LIGADA`). É a mesma para todos os casos, para não dizer qual deles aconteceu.
 * - `acesso_suspenso`: a conta está ligada a quem tem a eliminação agendada (`ACESSO_SUSPENSO`, F3, tarefa 14.0). Só
 *   sai depois de o provedor validar a conta e de o professor ser achado, pela ligação ou pelo e-mail verificado do
 *   provedor, ou seja, depois da credencial; a conta de quem não é achado nunca a recebe.
 */
export const FALHAS_DO_LOGIN_EXTERNO = ['provedor', 'conta_externa_nao_ligada', 'acesso_suspenso'] as const
export type FalhaDoLoginExterno = (typeof FALHAS_DO_LOGIN_EXTERNO)[number]

/** O parâmetro do endereço da web que leva a falha do login pela conta da escola. */
export const PARAMETRO_DA_FALHA_DO_LOGIN_EXTERNO = 'falha'

/**
 * O aluno que provou a conta da escola para pedir o nome (acesso-e-convites, 14.0) volta à página da sala em
 * `/e/:slug/turma?conta=provada`: o cookie `educa_conta_provada` já está com ele, e a tela passa a mandar o pedido sem senha.
 * O token do link, que o navegador não leva ao servidor no fragmento, é a tela que guarda antes de sair.
 */
export const PARAMETRO_DA_CONTA_PROVADA = 'conta'
export const VALOR_DA_CONTA_PROVADA = 'provada'

/**
 * O aluno que já entrou liga a conta da escola em "Eu" (acesso-e-convites, 15.0; `externa/iniciar?intencao=ligar`). Como o login, termina num
 * redirecionamento: o `retorno` leva o navegador a `/aluno/eu?ligacao=<resultado>` e a tela diz o que fazer.
 *
 * - `ligada`: a conta ficou ligada a ele, ou já estava (ligar a mesma conta duas vezes dá uma ligação só).
 * - `conflito`: a conta está ligada a outro aluno, ou ele já tem outra conta ligada (uma conta por aluno). Nunca diz a quem.
 * - `recusada`: a conta não é de um domínio ou tenant da escola, ou a sessão dele já não vale no retorno.
 * - `provedor`: o Google ou a Microsoft responderam com erro, não responderam a tempo ou o retorno chegou sem o cookie.
 */
export const RESULTADOS_DA_LIGACAO = ['ligada', 'conflito', 'recusada', 'provedor'] as const
export type ResultadoDaLigacao = (typeof RESULTADOS_DA_LIGACAO)[number]

/** O parâmetro de `/aluno/eu` que leva o resultado da ligação da conta da escola. */
export const PARAMETRO_DA_LIGACAO = 'ligacao'

/** A página "Eu" do aluno na web, para onde o retorno do `intencao=ligar` volta. */
export const ENDERECO_DO_EU_DO_ALUNO = '/aluno/eu'
