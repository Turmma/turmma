import type { FalhaDoLoginExterno } from '../sessao/externa.js'
import type { ErrorCode } from './error-code.js'

/**
 * Mensagem curta, em pt-BR, que diz o que fazer (regra 50, item 12). É fixa por código: a
 * mensagem nunca é montada com dado da requisição, então não tem como carregar valor de campo.
 */
export const MENSAGENS_DE_ERRO: Readonly<Record<ErrorCode, string>> = {
  ERRO_INTERNO: 'Não foi possível concluir agora. Tente de novo em instantes.',
  ENTRADA_INVALIDA: 'Alguns dados não estão corretos. Confira o que foi preenchido e tente de novo.',
  NAO_AUTENTICADO: 'Sua sessão não é válida ou expirou. Entre de novo para continuar.',
  NAO_ENCONTRADO: 'Não encontramos o que você procurou. Confira o endereço ou volte à tela anterior.',
  CONFLITO: 'Isso já existe ou acabou de ser alterado. Atualize a tela e confira antes de tentar de novo.',
  TEMPO_ESGOTADO: 'A operação demorou mais que o esperado. Tente de novo em instantes.',
  INDISPONIVEL_TENTE_DE_NOVO: 'O sistema está indisponível no momento. Tente de novo em instantes.',
  LIMITE_EXCEDIDO: 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.',
  CONTA_SEGURADA: 'Muitas tentativas com senha errada nesta conta. Aguarde de 30 segundos a 15 minutos, como indicado, e tente de novo.',
  JA_RENOVADO: 'Sua sessão acabou de ser renovada em outra aba. Tente de novo.',
  CONTA_EXTERNA_NAO_LIGADA: 'Esta conta não está liberada nesta escola. Entre com a sua matrícula ou procure o professor ou a coordenação.',
  ACESSO_VENCIDO: 'Seu acesso precisa ser renovado. Tente de novo.',
  SESSAO_ENCERRADA: 'Sua sessão terminou. Entre de novo para continuar.',
  REIVINDICACAO_RECUSADA: 'Não foi possível enviar. Confira a matrícula; se estiver certa, chame o professor.',
  MATERIAL_SEM_LICENCA: 'Este material não pode entrar sem licença de uso. Escolha a licença que a escola tem e marque a declaração, ou envie outro material.',
  FUNCAO_SUSPENSA: 'Esta função da IA está suspensa na sua escola. Fale com a coordenação para saber quando ela volta.',
  LIMITE_DIARIO_DO_TUTOR: 'Você chegou ao limite de perguntas ao Tutor por hoje. Amanhã ele volta; se precisar agora, chame o professor.',
  PACOTE_DO_TUTOR_ESGOTADO: 'A sua turma usou todas as perguntas ao Tutor deste mês. Chame o professor para continuar a atividade.',
  TUTOR_PAUSADO_EM_AVALIACAO: 'O Tutor fica pausado enquanto a avaliação está aberta. Ele volta quando o professor encerrar a avaliação.',
  DESTAQUES_NAO_ABERTOS: 'Ainda há casos destacados sem abrir. Abra cada um deles antes de aprovar o lote.',
  ENTREGA_JA_DECIDIDA: 'Esta entrega já foi decidida. Atualize a tela para ver como ela ficou.',
  VERSAO_ADAPTADA_NAO_APROVADA: 'A versão adaptada ainda não foi aprovada. Aprove a versão em "Seu time" antes de aplicar à turma.',
  ATIVIDADE_ENCERRADA: 'Esta atividade já foi encerrada ou enviada, e não recebe mais respostas. Se precisar mudar algo, chame o professor.',
  IA_INDISPONIVEL: 'A IA está indisponível agora. Tente de novo em instantes.',
  IA_TEMPO_ESGOTADO: 'A resposta da IA demorou mais que o esperado. Tente de novo em instantes.',
  IA_SAIDA_INVALIDA: 'A IA não conseguiu montar a resposta desta vez. Tente de novo; se continuar, mude um pouco o pedido.',
  IA_ORCAMENTO_ESGOTADO: 'O uso de IA da escola chegou ao limite do período. Fale com a coordenação para continuar.',
  IA_ENTRADA_INVALIDA: 'Não foi possível concluir agora. Tente de novo em instantes.',
  EXECUCAO_INTERROMPIDA: 'O pedido foi interrompido antes de terminar. Envie de novo.',
  MATERIAL_INSUFICIENTE: 'Não encontramos esse tema no material da escola. Confira o tema ou peça à coordenação para enviar o material.',
  RETENCAO_FORA_DO_LIMITE: 'Este prazo não pode ser usado nesta categoria. Confira o mínimo e o máximo dela, e o prazo da categoria que a limita.',
  PEDIDO_EM_ESTADO_INVALIDO: 'Este pedido não aceita mais esta ação. Atualize a tela para ver como ele ficou.',
  ACESSO_SUSPENSO: 'Seu acesso está suspenso a pedido. Fale com a coordenação da escola.',
}

/**
 * O texto da tela de convite inválido (F1): expirado, revogado, refeito, já usado e inexistente chegam iguais, e a tela
 * pede outro convite, que é o que resolve todos. A mesma tela serve ao convite do professor, que a coordenação da escola
 * gera, e ao da coordenação, que vem de nós (A1, 14.0); o convite que não vale não diz de que tipo era, e por isso o
 * texto diz a quem pedir nos dois casos.
 */
const CONVITE_QUE_NAO_VALE = 'Este convite não vale mais. Peça outro à coordenação da sua escola. Se o convite era para a coordenação, peça a quem enviou o link.'

/**
 * O que a tela de entrada diz, onde a mensagem geral não serve (regra 50, item 12).
 *
 * - `NAO_AUTENTICADO` no login não é sessão vencida: é a resposta única de senha errada, e-mail que não existe e
 *   conta sem usuário ativo (RF6). A tela não pode dizer qual dos três foi, e o texto vale para os três.
 * - `NAO_ENCONTRADO` é o login com o bilhete de um convite que já não ativa, numa conta sem outro usuário ativo (Tech
 *   Spec da A0b, seção 5): o texto é o da tela de convite inválido, e não diz que a senha estava certa. Só a entrada com
 *   convite o recebe; a entrada do operador (`apps/web/src/operacao/textos.ts`) usa este catálogo e não o recebe.
 * - `CONFLITO` não acontece aqui; quem cair nele vê a mensagem geral.
 */
export const MENSAGENS_DA_ENTRADA: Readonly<Partial<Record<ErrorCode, string>>> = {
  NAO_AUTENTICADO: 'E-mail ou senha incorretos. Confira os dois e tente de novo.',
  NAO_ENCONTRADO: CONVITE_QUE_NAO_VALE,
}

/**
 * O que a tela do endereço da escola diz ao aluno (RF7, tarefa 19.0). A matrícula errada, a matrícula que não existe
 * e o aluno desativado chegam no mesmo `NAO_AUTENTICADO`, e o texto vale para os três: a tela não diz se a matrícula
 * existe (regra 10, item 6).
 */
export const MENSAGENS_DA_ENTRADA_POR_MATRICULA: Readonly<Partial<Record<ErrorCode, string>>> = {
  NAO_AUTENTICADO: 'Matrícula ou senha incorretas. Confira as duas e tente de novo.',
}

/**
 * O que a tela do endereço da escola diz quando o endereço não abre. `NAO_ENCONTRADO` é o slug que não existe ou está
 * fora do formato: a tela diz o que fazer e nunca lista escola nenhuma, que entregaria a base de clientes.
 */
export const MENSAGENS_DO_ACESSO_DA_ESCOLA: Readonly<Partial<Record<ErrorCode, string>>> = {
  NAO_ENCONTRADO: 'Endereço não encontrado. Confira o endereço da escola com o professor ou a coordenação.',
}

/**
 * O que a tela do segundo fator diz (RF12). `NAO_AUTENTICADO` cobre o código errado, o código já usado e o desafio
 * vencido, que chegam iguais de propósito, e o texto vale para os três. `NAO_ENCONTRADO` é o código certo com o convite
 * do bilhete que já não ativa, numa conta sem outro usuário ativo: o texto da tela de convite inválido, como na entrada.
 */
export const MENSAGENS_DO_SEGUNDO_FATOR: Readonly<Partial<Record<ErrorCode, string>>> = {
  NAO_AUTENTICADO: 'Código incorreto ou já usado. Confira o código que o aplicativo mostra agora e tente de novo.',
  NAO_ENCONTRADO: CONVITE_QUE_NAO_VALE,
  ENTRADA_INVALIDA: 'O código do aplicativo tem 6 dígitos, e o de recuperação tem 12 letras e números. Confira e tente de novo.',
}

/**
 * O que a tela do convite diz. Expirado, revogado, refeito, já usado e inexistente chegam no mesmo `NAO_ENCONTRADO`, e a
 * tela não diz qual deles foi (regra 10, item 6): pede outro convite, que é o que resolve todos.
 */
export const MENSAGENS_DO_CONVITE: Readonly<Partial<Record<ErrorCode, string>>> = {
  NAO_ENCONTRADO: CONVITE_QUE_NAO_VALE,
}

/**
 * O aviso que a tela de entrada mostra quando o segundo fator gastou o desafio no quinto código errado (6.0): a pessoa
 * precisa refazer a senha, e não só digitar outro código.
 */
export const AVISO_DO_SEGUNDO_FATOR_CONSUMIDO =
  'Muitas tentativas com o código do segundo fator. Entre de novo com o e-mail e a senha, e use o código que o aplicativo mostrar então.'

/**
 * O mesmo aviso, com a espera que a API informou no `Retry-After`: sem ela a pessoa tenta de novo na hora e estica o
 * bloqueio da própria conta.
 */
export function avisoDoSegundoFatorConsumido(esperaSegundos?: number): string {
  if (esperaSegundos === undefined || !Number.isFinite(esperaSegundos)) return AVISO_DO_SEGUNDO_FATOR_CONSUMIDO
  return `${AVISO_DO_SEGUNDO_FATOR_CONSUMIDO} Espere ${formatarEspera(esperaSegundos)} antes de tentar.`
}

/**
 * O aviso que a tela de entrada mostra a quem aceitou um convite com uma conta que já existe (Tech Spec, seção 5,
 * "Convite"): o link nunca troca a senha de uma conta existente, e o convite só se completa no login.
 */
export const AVISO_DO_CONVITE_PARA_CONTA_EXISTENTE =
  'Você já tem acesso em outra escola: entre com a sua senha para concluir o convite. Se passar de 30 minutos, peça um convite novo à escola.'

/**
 * O aviso que a tela de entrada mostra ao professor que acabou de criar a senha pelo convite (A1, 14.0): o aceite do
 * professor não abre sessão nem passa pelo segundo fator, e o que falta é entrar com a senha nova.
 */
export const AVISO_DO_CONVITE_COM_SENHA_NOVA = 'Senha criada. Entre com o seu e-mail e a senha que você acabou de criar.'

/**
 * O que o seletor de escola diz quando a troca é recusada (Tech Spec, seção 5, "Troca de escola"). A API responde o
 * mesmo `NAO_ENCONTRADO` para os dois casos — a sessão que não é de e-mail (matrícula ou conta da escola), que só
 * abre a outra escola pelo login dela; e o usuário que deixou de existir naquela escola entre a lista e o clique —,
 * e a mensagem vale para os dois sem dizer qual foi (regra 10, item 6).
 *
 * O caminho que ela oferece é sair e entrar pela escola de destino, que serve a quem entrou pela conta da escola (e
 * pode não ter senha nenhuma) e a quem entrou por e-mail. O endereço daquela escola não é dito aqui porque a web não
 * o tem: `acessos` leva o nome da escola e nada mais dela (Tech Spec, seção 7).
 */
export const AVISO_DA_TROCA_RECUSADA =
  'Não foi possível abrir esta escola por aqui. Saia e entre de novo pelo endereço dela, ou com o seu e-mail e a sua senha; se precisar do endereço, procure a coordenação.'

/**
 * O que a tela `/e/:slug` diz quando a volta do Google ou da Microsoft traz falha (Tech Spec, seção 12). Todo `error`
 * do provedor vira a mesma mensagem, porque não sabemos qual valor eles devolvem quando a escola não liberou o
 * aplicativo, e a tela sempre oferece a matrícula como caminho.
 */
export const MENSAGENS_DA_FALHA_EXTERNA: Readonly<Record<FalhaDoLoginExterno, string>> = {
  provedor: 'Não foi possível entrar com a conta da escola. Pode ser que a escola ainda não tenha liberado o aplicativo. Entre com a sua matrícula ou procure o professor.',
  conta_externa_nao_ligada: MENSAGENS_DE_ERRO.CONTA_EXTERNA_NAO_LIGADA,
  acesso_suspenso: MENSAGENS_DE_ERRO.ACESSO_SUSPENSO,
}

/**
 * A mensagem do parâmetro `?falha=` do endereço da escola. Valor desconhecido é tratado como falha do provedor: a
 * tela nunca fica sem explicação porque alguém digitou outra coisa na barra.
 */
export function mensagemDaFalhaExterna(valor: string): string {
  if (valor === 'conta_externa_nao_ligada') return MENSAGENS_DA_FALHA_EXTERNA.conta_externa_nao_ligada
  if (valor === 'acesso_suspenso') return MENSAGENS_DA_FALHA_EXTERNA.acesso_suspenso
  return MENSAGENS_DA_FALHA_EXTERNA.provedor
}

/**
 * Quanto esperar, por extenso em pt-BR, a partir dos segundos do `Retry-After`. Arredonda para cima, e para o minuto
 * inteiro acima de um minuto: dizer "2 minutos" quando faltam 90 s atrasa um pouco a pessoa, e dizer "1 minuto" a
 * faria tentar cedo e esticar o bloqueio.
 */
export function formatarEspera(segundos: number): string {
  const inteiros = Math.max(1, Math.ceil(segundos))
  if (inteiros < 60) return `${String(inteiros)} ${inteiros === 1 ? 'segundo' : 'segundos'}`
  const minutos = Math.ceil(inteiros / 60)
  return `${String(minutos)} ${minutos === 1 ? 'minuto' : 'minutos'}`
}

/**
 * A mensagem da tela de entrada para um código, com o tempo de espera quando a API o informou no `Retry-After`
 * (`CONTA_SEGURADA`, RF11). O número vem da nossa própria resposta, nunca do que a pessoa digitou: nenhuma mensagem
 * carrega valor de campo.
 *
 * Sem o `Retry-After`, fica o texto fixo do catálogo, que já diz a faixa de espera.
 */
export function mensagemDaEntrada(codigo: ErrorCode, esperaSegundos?: number): string {
  return mensagemDaTela(MENSAGENS_DA_ENTRADA, codigo, esperaSegundos)
}

/** A mesma coisa na tela do endereço da escola, onde o identificador é a matrícula e não o e-mail (RF7, RF11). */
export function mensagemDaEntradaPorMatricula(codigo: ErrorCode, esperaSegundos?: number): string {
  return mensagemDaTela(MENSAGENS_DA_ENTRADA_POR_MATRICULA, codigo, esperaSegundos)
}

/** A mensagem da tela do segundo fator, com a espera da conta segurada quando a API a informou (RF12). */
export function mensagemDoSegundoFator(codigo: ErrorCode, esperaSegundos?: number): string {
  return mensagemDaTela(MENSAGENS_DO_SEGUNDO_FATOR, codigo, esperaSegundos)
}

/** A mensagem da tela do convite, a mesma para o do coordenador e o do professor. */
export function mensagemDoConvite(codigo: ErrorCode): string {
  return mensagemDaTela(MENSAGENS_DO_CONVITE, codigo)
}

/** A mensagem da tela do endereço da escola quando o próprio endereço não abre. */
export function mensagemDoAcessoDaEscola(codigo: ErrorCode): string {
  return mensagemDaTela(MENSAGENS_DO_ACESSO_DA_ESCOLA, codigo)
}

/**
 * O texto da tela para um código: o da própria tela, se houver, e o do catálogo geral no resto. A conta segurada diz
 * quanto esperar quando a API mandou o `Retry-After`; o número vem da nossa resposta, nunca do que foi digitado.
 */
function mensagemDaTela(textos: Readonly<Partial<Record<ErrorCode, string>>>, codigo: ErrorCode, esperaSegundos?: number): string {
  if (codigo === 'CONTA_SEGURADA' && esperaSegundos !== undefined && Number.isFinite(esperaSegundos)) {
    return `Muitas tentativas com senha errada nesta conta. Espere ${formatarEspera(esperaSegundos)} e tente de novo.`
  }
  return textos[codigo] ?? MENSAGENS_DE_ERRO[codigo]
}
