import {
  ErrorCode,
  loginResponseSchema,
  renovacaoResponseSchema,
  JANELA_DE_RENOVACAO_SIMULTANEA_MS,
  type AcessoDaConta,
  type EtapaComDesafio,
  type PapelDeUsuario,
  type LoginEmailRequest,
  type LoginMatriculaRequest,
  type MfaRequest,
  type LoginResponse,
  type RenovacaoResponse,
} from '@educa/shared'
import { apiRequest, ApiError, EMPTY_BODY, type ResponseSchema, type RequestOptions } from './client'

export const CAMINHO_DA_SESSAO = '/v1/sessao'
export const CAMINHO_DA_RENOVACAO = `${CAMINHO_DA_SESSAO}/renovar`
export const CAMINHO_DA_ENTRADA_POR_EMAIL = `${CAMINHO_DA_SESSAO}/email`
export const CAMINHO_DA_ENTRADA_POR_MATRICULA = `${CAMINHO_DA_SESSAO}/matricula`
export const CAMINHO_DO_SEGUNDO_FATOR = `${CAMINHO_DA_SESSAO}/mfa`
export const CAMINHO_DA_ESCOLA_DA_SESSAO = `${CAMINHO_DA_SESSAO}/escola`
export const CAMINHO_DA_ATIVIDADE = `${CAMINHO_DA_SESSAO}/atividade`

/** A trava das Web Locks: uma renovação por vez no navegador inteiro, contando todas as abas abertas na escola. */
export const NOME_DA_TRAVA_DE_RENOVACAO = 'educa-renovacao'

/**
 * Quanto a web espera, depois de um 409 `JA_RENOVADO`, antes de tentar a renovação outra vez. Precisa passar da
 * janela da API (Tech Spec, seção 5, "Renovar"): dentro dela o cookie anterior é tratado como outra aba renovando
 * junto e recebe 409 de novo, e a segunda recusa mandaria a pessoa para o login no meio da aula. A folga cobre a
 * diferença entre o relógio do servidor e o daqui.
 */
export const ESPERA_DEPOIS_DO_JA_RENOVADO_MS = JANELA_DE_RENOVACAO_SIMULTANEA_MS + 500

/**
 * Por quanto tempo a entrada repete sozinha o 503 do semáforo do login antes de mostrar erro (Tech Spec, seção 5,
 * "Fila"): na rajada das 7h30 o 503 é atraso, e não recusa, e o botão fica em "Entrando…".
 */
export const PRAZO_DA_ENTRADA_NO_503_MS = 30_000

/**
 * O piso da espera entre duas tentativas no 503, qualquer que seja o `Retry-After` recebido. A nossa API nunca manda
 * menos de 1 s (`packages/core/src/rate-limit/keys.ts`), mas quem obedece a um cabeçalho sem conferi-lo repete sem
 * intervalo se ele vier zerado — e aí a escola inteira, atrás do mesmo IP, martela justamente a rota que o semáforo
 * está protegendo às 7h30 (regra 80, itens 1 e 4).
 */
export const ESPERA_MINIMA_NO_503_MS = 1_000

/** Quanto o "Sair" espera antes da única repetição do `DELETE /v1/sessao`. */
export const ESPERA_ENTRE_TENTATIVAS_DE_SAIDA_MS = 1_000

/**
 * O estado da sessão nesta aba, que decide o que a rota protegida mostra:
 * - `desconhecida`: a aba acabou de abrir e ainda não se sabe se o cookie de renovação vale;
 * - `abrindo`: a renovação pelo cookie está em andamento;
 * - `aberta`: há token de acesso em memória;
 * - `anonima`: não há sessão, e a tela de entrada é o caminho;
 * - `vencida`: havia sessão nesta aba e ela acabou (inatividade, ou `NAO_AUTENTICADO` que persistiu depois da
 *   renovação). A tela continua montada e o login abre por cima dela, para ninguém perder o que estava escrevendo
 *   (regra 80, item 6);
 * - `indisponivel`: a API não respondeu (5xx ou sem rede). Não é logout: o caminho é tentar de novo;
 * - `suspensa`: a renovação respondeu `ACESSO_SUSPENSO` (F3, 20.0): quem estava aqui tem a eliminação agendada, e a API
 *   já encerrou as sessões e apagou o cookie. Não há token, o cache saiu, e a rota protegida mostra "Acesso suspenso",
 *   sem "Tentar de novo": repetir não adianta. É fim de sessão como o `vencida`, mas sem login por cima da tela, porque
 *   a senha certa daria o mesmo `ACESSO_SUSPENSO`.
 */
export type EstadoDaSessao = 'desconhecida' | 'abrindo' | 'aberta' | 'anonima' | 'vencida' | 'indisponivel' | 'suspensa'

/**
 * O token de acesso vive só aqui, em variável de módulo, e some quando a aba fecha ou recarrega (regra 50, item 7):
 * o Chromebook do carrinho passa por quatro turmas por dia, e nada do aluno anterior pode ficar em `localStorage`,
 * `sessionStorage`, cookie legível ou URL. Quem guarda a sessão entre recargas é o cookie `HttpOnly` da renovação,
 * que o JavaScript da página não lê.
 *
 * O espelho da prova (`areas/aluno/espelho-da-fila.ts`, 53.0) **não é sessão**: guarda em `sessionStorage` só ids da escolha
 * que o servidor ainda não confirmou, com o `usuarioId` do dono, e acompanha o fim da sessão pelos ganchos `aoTrocarDeSessao`
 * (sai no "Sair", fica na sessão vencida). Token, desafio e identidade da pessoa continuam só em memória.
 */
let token: string | undefined
let expiraEm: number | undefined
let estado: EstadoDaSessao = 'desconhecida'
/** A falha que deixou a sessão `indisponivel`, para a tela dizer o que fazer pelo código dela. */
let ultimoErro: unknown

/**
 * Se o último "Sair" chegou à API. Quando não chega, esta aba esquece o token, mas o cookie de renovação continua
 * valendo no servidor: quem ficar no computador volta à sessão da pessoa anterior com um F5. A tela de entrada avisa,
 * em vez de apresentar a saída como concluída.
 */
let saidaConfirmada = true

/**
 * O desafio da etapa que o login devolveu (Tech Spec, seção 4): um JWT de 5 min que vale só na rota daquela etapa. Ele
 * é credencial parcial — quem o tem já provou a senha — e por isso mora aqui, em memória, como o token de acesso: nem
 * URL, nem `localStorage`, nem cookie legível (regra 50, item 7). Recarregar a tela do segundo fator o perde de
 * propósito: a pessoa refaz a senha, e é assim que o Chromebook do carrinho não guarda meia credencial de ninguém.
 */
let desafio: { readonly etapa: EtapaComDesafio; readonly valor: string; readonly acessos: readonly AcessoDaConta[] } | undefined

/**
 * O bilhete que o aceite de convite devolve quando a conta já existe (7.0). Vai no corpo do login por e-mail, nunca na
 * URL nem em armazenamento do navegador, e some assim que o login responde: a partir daí quem carrega o convite é o
 * desafio assinado pela API.
 */
let bilheteDeConvite: string | undefined

/** O que a tela de entrada precisa explicar por ter vindo de outra tela (segundo fator gasto, convite aceito). */
let avisoParaAEntrada: string | undefined

/**
 * O mínimo sobre quem está nesta aba, para o login por cima da tela saber o que oferecer e reconhecer quem volta
 * (20.0): o papel diz se o caminho de volta é a matrícula ou o e-mail, o `escolaSlug` é o endereço público da escola,
 * e o `usuarioId` é o identificador opaco que separa "a mesma pessoa voltou" de "sentou outra pessoa no Chromebook".
 * Nome e escola não entram: quem os mostra é a tela, a partir do cache de consultas, que o fim de sessão esvazia.
 *
 * Vive só em memória, morre com a aba e sai junto com a sessão quando ela é encerrada de vez.
 */
let quemEstaNaAba: { readonly usuarioId: string; readonly papel: PapelDeUsuario; readonly escolaSlug: string } | undefined

/**
 * Quem estava aqui quando a sessão venceu, enquanto não se sabe quem entrou no lugar. É só o identificador opaco, e
 * serve para uma pergunta: quem acabou de entrar é a mesma pessoa, e a tela continua de onde estava, ou sentou outra
 * pessoa no Chromebook, e o que estava aberto tem de sair da frente dela (RF13).
 */
let usuarioAntesDeVencer: string | undefined

const ouvintes = new Set<() => void>()

/**
 * O que precisa ser esquecido quando a sessão desta aba deixa de ser a mesma — ela acabou, ou outra entrou no lugar
 * dela (outra pessoa, ou a mesma pessoa em outra escola). Fora deste módulo, hoje, é o cache do TanStack Query
 * (`main.tsx`): sem esvaziá-lo, a pessoa seguinte no Chromebook do carrinho entra e vê o nome e a escola da anterior,
 * que ficam no cache de `/v1/eu` (regra 20, itens 4 e 5; regra 10, item 1).
 */
const aoTrocar = new Set<() => void>()

/**
 * O que precisa acontecer quando uma sessão passa a valer nesta aba: hoje, mandar o cache de consultas buscar de novo
 * o que falhou enquanto não havia sessão. É o que faz a tela voltar sozinha depois do login por cima (20.0), em vez
 * de ficar no erro de uma busca que morreu com a sessão anterior.
 */
const aoAbrir = new Set<() => void>()

/** Registra o que refazer quando a sessão abre, em qualquer caminho (login, renovação, troca). Devolve o cancelamento. */
export function aoAbrirSessao(ouvinte: () => void): () => void {
  aoAbrir.add(ouvinte)
  return () => {
    aoAbrir.delete(ouvinte)
  }
}

/** Registra o que esvaziar quando a sessão desta aba muda de dono ou acaba. Devolve o cancelamento. */
export function aoTrocarDeSessao(ouvinte: () => void): () => void {
  aoTrocar.add(ouvinte)
  return () => {
    aoTrocar.delete(ouvinte)
  }
}

function anunciar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

/** Assina a mudança de estado da sessão (`useSyncExternalStore`). Devolve o cancelamento. */
export function assinarSessao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function estadoDaSessao(): EstadoDaSessao {
  return estado
}

/** A falha da última tentativa de abrir a sessão, quando o estado é `indisponivel`. */
export function erroDaSessao(): unknown {
  return ultimoErro
}

/** O último "Sair" não foi confirmado pela API, e a sessão pode continuar viva no servidor. */
export function saidaPendente(): boolean {
  return !saidaConfirmada
}

export function tokenDeAcesso(): string | undefined {
  return token
}

/**
 * O desafio guardado, se ele for o daquela etapa. A etapa é conferida aqui porque cada rota só aceita a sua: mandar o
 * desafio de `configurar_mfa` para `/v1/sessao/mfa` só renderia um `NAO_AUTENTICADO` confuso na tela.
 */
export function desafioDaEtapa(etapa: EtapaComDesafio): string | undefined {
  return desafio?.etapa === etapa ? desafio.valor : undefined
}

/**
 * Guarda o desafio de uma etapa. Além do login, quem chama é o aceite de convite de conta nova (7.0), que devolve o
 * desafio de `configurar_mfa` sem passar por nenhuma etapa de senha.
 */
export function guardarDesafio(etapa: EtapaComDesafio, valor: string): void {
  desafio = { etapa, valor, acessos: [] }
}

/**
 * Os acessos que vieram com o desafio `escolher` (20.0): o nome da escola e o papel de cada usuário ativo da conta,
 * que é o que a tela da escolha lista. Some com o desafio, num F5, porque sem ele não há como escolher nada.
 */
export function acessosParaEscolher(): readonly AcessoDaConta[] {
  return desafio?.etapa === 'escolher' ? desafio.acessos : []
}

/** Esquece o desafio: ele foi consumido pela API, ou gasto pelo quinto código errado (6.0). */
export function esquecerDesafio(): void {
  desafio = undefined
}

/** Guarda o bilhete do convite aceito por conta que já existe, para o próximo login por e-mail levá-lo (7.0). */
export function guardarBilheteDeConvite(bilhete: string): void {
  bilheteDeConvite = bilhete
}

/**
 * Se esta aba aceitou um convite e ainda não concluiu o login dele. Quem explica o que falta à pessoa é o aviso de
 * `avisoDaEntrada`; esta função é a janela para o bilhete, que não pode ser lido de fora, e é por ela que o teste
 * prova que ele sobrevive à senha errada e some depois do login.
 */
export function convitePendente(): boolean {
  return bilheteDeConvite !== undefined
}

/**
 * O aviso que a entrada mostra por ter vindo de outra tela. Vive só em memória, como o aviso de saída não confirmada
 * (18.0): some quando a sessão abre e um F5 na entrada o apaga.
 */
export function avisoDaEntrada(): string | undefined {
  return avisoParaAEntrada
}

export function definirAvisoDaEntrada(aviso: string | undefined): void {
  avisoParaAEntrada = aviso
}

function definirEstado(novo: EstadoDaSessao): void {
  if (estado === novo) return
  estado = novo
  anunciar()
}

/**
 * Guarda o token que passa a valer nesta aba.
 *
 * `sessaoNova` distingue a sessão recém-gravada pela API (entrada, escolha de escola, troca) da rotação de rotina da
 * mesma sessão. Só a primeira troca o mundo que a tela mostra, e é ela que esvazia o cache — **depois** de o token
 * novo entrar, nunca antes: a limpeza refaz as buscas que estão na tela, e refazê-las com o token da escola de
 * origem é o que traria o dado dela para dentro da escola de destino (regra 10, item 1). Na troca que passa pelo
 * segundo fator, a sessão de origem continua valendo até o código ser aceito, e aquele token funcionaria.
 */
function guardarToken(resposta: RenovacaoResponse, sessaoNova = false): void {
  // Só quando a sessão volta a existir: a renovação de rotina, com a tela aberta, não pode mandar a tela inteira
  // buscar tudo de novo a cada 10 min (regra 80). Quem está na aba é lido de novo do `/v1/eu` desta sessão.
  const voltouAValer = estado !== 'aberta'
  token = resposta.token
  expiraEm = new Date(resposta.expiraEm).getTime()
  estado = 'aberta'
  ultimoErro = undefined
  saidaConfirmada = true
  // Com a sessão aberta, o que levava até ela já foi consumido pela API e não pode sobreviver nesta aba.
  desafio = undefined
  bilheteDeConvite = undefined
  avisoParaAEntrada = undefined
  anunciar()
  if (sessaoNova) limparDadosDaEscola()
  else if (voltouAValer) for (const ouvinte of aoAbrir) ouvinte()
}

/**
 * Esvazia o que guarda dado da escola fora deste módulo — hoje, o cache de consultas. Acontece em todo fim de sessão
 * e em toda sessão nova, inclusive a da troca de escola, que não encerra nada nesta aba mas muda o mundo inteiro que
 * a tela mostra (RF14).
 */
function limparDadosDaEscola(): void {
  for (const ouvinte of aoTrocar) ouvinte()
}

/**
 * Esquece a sessão desta aba, em qualquer caminho: "Sair", `NAO_AUTENTICADO` que persiste depois da renovação,
 * inatividade vencida, ou cookie que não vale mais. O cookie de renovação é apagado pela API, em `DELETE /v1/sessao`.
 *
 * O destino separa os dois fins possíveis:
 * - `anonima` é o fim pedido pela pessoa ("Sair") ou a aba que abriu sem sessão nenhuma: a rota protegida leva à
 *   entrada, e nada desta aba continua;
 * - `vencida` é o fim que chegou sozinho (inatividade, sessão encerrada no servidor): a tela continua montada e o
 *   login abre por cima dela, porque a professora pode estar no meio de uma contestação e perder o que escreveu por
 *   causa do relógio é o mesmo erro de perder resposta de prova (regra 80, item 6);
 * - `suspensa` é o fim que a API decidiu (a eliminação agendada, F3): a área sai, o cache sai, e o que a aba mostra é
 *   a tela "Acesso suspenso". Vale de qualquer estado menos `anonima`, pela mesma razão do `vencida`.
 *
 * Ir para `anonima` vale de qualquer estado: é a saída pedida pela pessoa, e ela chega tanto da sessão aberta quanto
 * da vencida ("Entrar com outra conta"), da suspensa ("Ir para a entrada") ou da aba que nem abriu direito. **Os
 * destinos barrados são `vencida` quando a sessão não está aberta, e `suspensa` quando a aba já está `anonima`:** a
 * saída é final, e um pedido atrasado que volta 401 (ou a renovação que volta 403) depois dela devolveria a aba ao
 * estado vencido ou suspenso — com o Voltar do navegador remontando a tela da pessoa anterior, em vez da entrada.
 *
 * Idempotente por destino: o cache limpo faz a tela que ainda estava montada buscar de novo e receber outro
 * `NAO_AUTENTICADO`, e um segundo encerramento no mesmo destino não pode reiniciar a limpeza.
 */
function encerrarLocalmente(destino: 'anonima' | 'vencida' | 'suspensa'): void {
  // Só a sessão aberta vence sozinha: depois do "Sair", nada mais devolve esta aba à área autenticada.
  if (destino === 'vencida' && estado !== 'aberta') return
  // A renovação que estava no ar quando a pessoa clicou em "Sair" e volta 403 depois dele: a saída é final.
  if (destino === 'suspensa' && estado === 'anonima') return
  // Idempotente por destino: o segundo `NAO_AUTENTICADO` de uma tela ainda montada não reinicia a limpeza.
  if (token === undefined && estado === destino) return
  token = undefined
  expiraEm = undefined
  estado = destino
  usuarioAntesDeVencer = destino === 'vencida' ? quemEstaNaAba?.usuarioId : undefined
  // Na `suspensa` a memória fica: é ela que diz à tela se o caminho de volta é o endereço da escola (aluno) ou a entrada.
  if (destino === 'anonima') quemEstaNaAba = undefined
  // Avisa antes de limpar: assim o React já tem o desmonte da área autenticada agendado quando o cache esvazia, e
  // nenhum observador ainda montado recria a consulta que acabou de sair.
  anunciar()
  limparDadosDaEscola()
}

/** O fim de sessão pedido pela pessoa: a entrada é o caminho, e nada desta aba continua. */
function esquecerSessao(): void {
  encerrarLocalmente('anonima')
}

/** O fim de sessão que chegou sozinho: o login abre por cima da tela, que continua montada. */
function vencerSessao(): void {
  encerrarLocalmente('vencida')
}

/** O fim de sessão que a API decidiu: a eliminação agendada (F3, 20.0). A tela "Acesso suspenso" toma o lugar da área. */
function suspenderSessao(): void {
  encerrarLocalmente('suspensa')
}

/**
 * "Ir para a entrada", na tela "Acesso suspenso": a aba deixa de ser `suspensa` e passa a `anonima`, e a rota protegida
 * já não a mostra. Só vale em `suspensa`: o link não encerra uma sessão aberta que por acaso exista.
 */
export function sairDaSessaoSuspensa(): void {
  if (estado === 'suspensa') esquecerSessao()
}

/**
 * Desiste da sessão vencida: quem sentou no computador é outra pessoa, ou quer entrar por outro caminho. A tela sai
 * junto com o estado dela, e a entrada passa a ser o lugar.
 */
export function descartarSessaoVencida(): void {
  if (estado === 'vencida') esquecerSessao()
}

/** O mínimo sobre quem está nesta aba, para o login por cima saber o que oferecer e reconhecer quem volta (20.0). */
export function quemEstaNaSessao(): { usuarioId: string; papel: PapelDeUsuario; escolaSlug: string } | undefined {
  return quemEstaNaAba
}

/**
 * Guarda quem está, a partir do `/v1/eu` da sessão aberta. Chamado pela área autenticada a cada resposta: o que fica é
 * sempre a pessoa da sessão atual.
 *
 * Devolve `true` quando esta sessão é de **outra pessoa** que entrou depois de a anterior vencer — é o Chromebook do
 * carrinho passando de mão —, e aí a tela que estava aberta não pode continuar com o que a pessoa anterior escreveu
 * nela. Entrar de novo com a mesma pessoa devolve `false`, e nada da tela se perde.
 */
export function lembrarQuemEsta(eu: { usuarioId: string; papel: PapelDeUsuario; escola: { slug: string } }): boolean {
  quemEstaNaAba = { usuarioId: eu.usuarioId, papel: eu.papel, escolaSlug: eu.escola.slug }
  const outraPessoa = usuarioAntesDeVencer !== undefined && usuarioAntesDeVencer !== eu.usuarioId
  usuarioAntesDeVencer = undefined
  return outraPessoa
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

/** O erro da API com aquele código, ou `undefined`: é por ele que se lê também o `Retry-After`. */
function erroDaApi(erro: unknown, codigo: ErrorCode): ApiError | undefined {
  return erro instanceof ApiError && erro.codigo === codigo ? erro : undefined
}

function ehCodigo(erro: unknown, codigo: ErrorCode): boolean {
  return erroDaApi(erro, codigo) !== undefined
}

function rotacionar(): Promise<RenovacaoResponse> {
  return apiRequest(CAMINHO_DA_RENOVACAO, renovacaoResponseSchema, { metodo: 'POST' })
}

/**
 * Uma renovação por vez no navegador inteiro, pelas Web Locks: duas abas com o token vencido renovam em fila, e a
 * segunda já manda o cookie que a primeira recebeu. Sem a trava, as duas mandariam o mesmo cookie ao mesmo tempo e
 * uma delas acabaria em reuso de refresh, que encerra a família inteira e desloga a professora no meio da aula.
 *
 * `navigator.locks` existe em todo navegador que o build alcança (Chrome 69, Firefox 96, Safari 15.4). Sem ele — um
 * navegador mais antigo, ou o teste de unidade fora do navegador — a fila vale só nesta aba, e o resto do caminho
 * (409 e resposta perdida) continua cobrindo o caso.
 */
function comTravaDeRenovacao<T>(tarefa: () => Promise<T>): Promise<T> {
  const travas = globalThis.navigator?.locks as LockManager | undefined
  return travas === undefined ? tarefa() : travas.request(NOME_DA_TRAVA_DE_RENOVACAO, tarefa)
}

/**
 * A renovação pelo cookie, com as duas recusas que não são logout (Tech Spec, seção 5, "Renovar"):
 *
 * - **409 `JA_RENOVADO`:** outra aba acabou de rotacionar (e o navegador já tem o cookie novo), ou a resposta da
 *   nossa própria renovação se perdeu (e o cookie ainda é o anterior). As duas chegam à API iguais, e só o tempo as
 *   separa: passada a janela, a API rotaciona de novo no segundo caso. Por isso espera e tenta mais uma vez.
 * - **Sem rede ou 5xx:** sobe como `INDISPONIVEL_TENTE_DE_NOVO`, e quem chamou mantém token, tela e formulário.
 */
async function pedirRenovacao(): Promise<RenovacaoResponse> {
  try {
    return await rotacionar()
  } catch (erro) {
    if (!ehCodigo(erro, ErrorCode.JA_RENOVADO)) throw erro
    await esperar(ESPERA_DEPOIS_DO_JA_RENOVADO_MS)
    return rotacionar()
  }
}

let renovacaoEmAndamento: Promise<void> | undefined

/**
 * Renova a sessão pelo cookie e guarda o token novo. Uma só renovação por vez nesta aba (as chamadas que caíram em
 * 401 juntas esperam a mesma), e uma só no navegador (Web Locks).
 */
export function renovarSessao(): Promise<void> {
  // Sessão já encerrada nesta aba: renovar aqui ressuscitaria, pelo cookie que pode ter sobrevivido a um "Sair" que
  // a API não confirmou, justamente a sessão que a pessoa acabou de encerrar — e apagaria o aviso disso. Na sessão
  // `vencida`, renovar devolveria a área autenticada por baixo do diálogo de login sem ninguém ter entrado. Quem abre
  // a aba de novo passa por `abrirSessaoPeloCookie`, que sai de `desconhecida`, e o login passa por `guardarToken`.
  if (estado === 'anonima' || estado === 'vencida') return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
  // `suspensa`: a API já recusou, e repetir o pedido só renderia outro 403 (regra 80: nenhuma chamada sai da aba).
  if (estado === 'suspensa') return Promise.reject(new ApiError(ErrorCode.ACESSO_SUSPENSO))
  renovacaoEmAndamento ??= comTravaDeRenovacao(pedirRenovacao)
    .then(guardarToken, (erro: unknown) => {
      // O lugar único do `ACESSO_SUSPENSO` (Tech Spec, seção 9, "Login suspenso"): serve à aba que abre pelo cookie, à
      // chamada que voltou 401 e ao "Sair". A sessão acaba aqui, e quem chamou ainda recebe o erro.
      if (ehCodigo(erro, ErrorCode.ACESSO_SUSPENSO)) suspenderSessao()
      throw erro
    })
    .finally(() => {
      renovacaoEmAndamento = undefined
    })
  return renovacaoEmAndamento
}

/**
 * Abre a sessão desta aba pelo cookie de renovação, ao carregar a página. Idempotente: chamar de novo enquanto a
 * renovação está em andamento espera a mesma.
 *
 * - Sessão válida: fica `aberta`.
 * - `NAO_AUTENTICADO`: fica `anonima`, e a rota protegida leva à entrada.
 * - `ACESSO_SUSPENSO`: fica `suspensa` (20.0), e a rota protegida mostra "Acesso suspenso".
 * - Qualquer outra falha (5xx, sem rede): fica `indisponivel`. Ninguém é mandado para o login por causa de uma
 *   queda do Postgres ou da rede da escola (Tech Spec, seção 7c; regra 80, item 6).
 */
export async function abrirSessaoPeloCookie(): Promise<void> {
  if (token !== undefined) return
  // Suspensa, a aba não tenta de novo: a tela é final, e o único caminho é o link dela.
  if (estado === 'suspensa') return
  definirEstado('abrindo')
  try {
    await renovarSessao()
  } catch (erro) {
    // O `ACESSO_SUSPENSO` já deixou a aba `suspensa` dentro da renovação: não é queda da API, e `indisponivel` aqui
    // traria de volta o "Tentar de novo" que não adianta. Lido por `estadoDaSessao()`, que a guarda de cima não restringe.
    if (estadoDaSessao() === 'suspensa') return
    ultimoErro = erro
    definirEstado(ehCodigo(erro, ErrorCode.NAO_AUTENTICADO) ? 'anonima' : 'indisponivel')
  }
}

/** O que a chamada com sessão aceita além do token, que vem daqui e nunca de quem chamou. */
export type AuthedRequestOptions = Omit<RequestOptions, 'token'>

/**
 * Chamada a uma rota com sessão. Manda o token no `Authorization` e, no `NAO_AUTENTICADO`, renova uma vez e repete
 * a chamada. Só o `NAO_AUTENTICADO` que persiste depois da renovação encerra a sessão.
 */
export async function authedRequest<T>(caminho: string, esquema: ResponseSchema<T>, opcoes: AuthedRequestOptions = {}): Promise<T> {
  // Sem sessão, a chamada nem sai: às 10h a inatividade vence em muitas abas ao mesmo tempo, e cada tela ainda
  // montada mandaria as consultas dela à API só para ouvir 401 (regra 80). Quem entra de novo passa pelo login, que
  // não usa este caminho. Na `suspensa` vale o mesmo, com o código que diz por quê.
  if (estado === 'anonima' || estado === 'vencida') throw new ApiError(ErrorCode.NAO_AUTENTICADO)
  if (estado === 'suspensa') throw new ApiError(ErrorCode.ACESSO_SUSPENSO)
  // O token já vencido é renovado antes: a requisição que só serviria para receber 401 não chega a sair.
  if (token !== undefined && expiraEm !== undefined && expiraEm <= Date.now()) await renovarComTokenVencido(token)
  const usado = token
  try {
    return await apiRequest(caminho, esquema, { ...opcoes, token: usado })
  } catch (erro) {
    if (!ehCodigo(erro, ErrorCode.NAO_AUTENTICADO)) throw erro
    // A sessão acabou enquanto esta chamada estava no ar (o "Sair" da pessoa, por exemplo): repetir agora só mandaria
    // uma requisição sem credencial nenhuma à API, para ouvir o mesmo 401. Lido por `estadoDaSessao()` de propósito:
    // o estado pode ter mudado durante o `await`, e a variável já estava restringida pela guarda do começo.
    const durante = estadoDaSessao()
    if (durante === 'anonima' || durante === 'vencida' || durante === 'suspensa') throw erro
    await renovarComTokenVencido(usado)
    try {
      return await apiRequest(caminho, esquema, { ...opcoes, token })
    } catch (segundoErro) {
      // Recusada com o token recém-emitido: a sessão acabou mesmo (encerrada, inatividade, usuário desativado).
      if (ehCodigo(segundoErro, ErrorCode.NAO_AUTENTICADO)) vencerSessao()
      throw segundoErro
    }
  }
}

/** `GET` numa rota com sessão, com o `AbortSignal` que o TanStack Query cancela. */
export function authedGet<T>(caminho: string, esquema: ResponseSchema<T>, sinal?: AbortSignal): Promise<T> {
  return authedRequest(caminho, esquema, { sinal })
}

/**
 * Renova, a menos que outra chamada já tenha trocado o token desde que esta saiu: sem isso, uma rajada de consultas
 * feitas com o token velho rotacionaria o cookie uma vez por consulta.
 */
async function renovarComTokenVencido(usado: string | undefined): Promise<void> {
  if (usado !== undefined && usado !== token) return
  try {
    await renovarSessao()
  } catch (erro) {
    if (ehCodigo(erro, ErrorCode.NAO_AUTENTICADO)) vencerSessao()
    throw erro
  }
}

/**
 * Uma etapa do login, com a repetição do 503 do semáforo do hash, que é atraso e não recusa: a web espera o
 * `Retry-After` e tenta sozinha por até 30 s, enquanto o botão mostra "Entrando…" (Tech Spec, seção 5, "Fila").
 * Qualquer outro erro sobe na hora, para a tela dizer o que fazer.
 *
 * Em `pronta`, o token fica em memória e a sessão passa a `aberta`; nas outras etapas, o desafio fica guardado aqui
 * para a tela da etapa, e nenhuma sessão foi gravada.
 */
function guardarEtapa(resposta: LoginResponse): void {
  // Toda etapa `pronta` é uma sessão que a API acabou de gravar: entrada, escolha de escola, ou a troca concluída
  // depois do segundo fator. O cache do que havia antes não é dela.
  if (resposta.etapa === 'pronta') guardarToken(resposta, true)
  else if (resposta.etapa === 'escolher') desafio = { etapa: 'escolher', valor: resposta.desafio, acessos: resposta.acessos }
  else guardarDesafio(resposta.etapa, resposta.desafio)
}

async function enviarEtapa(caminho: string, pedido: unknown, desafioAtual?: string): Promise<LoginResponse> {
  const resposta = await apiRequest(caminho, loginResponseSchema, { metodo: 'POST', corpo: pedido, token: desafioAtual })
  guardarEtapa(resposta)
  return resposta
}

/**
 * A etapa que passa pelo semáforo do hash de senha, com a fila das 7h30 (Tech Spec, seção 5, "Fila"). Só as duas
 * entradas por senha entram aqui: o segundo fator não faz hash de senha, e repetir sozinho um código de 30 s gastaria
 * tentativa do contador da conta por causa de uma instância caindo.
 */
async function etapaComFilaDoSemaforo(caminho: string, pedido: unknown): Promise<LoginResponse> {
  const limite = Date.now() + PRAZO_DA_ENTRADA_NO_503_MS
  for (;;) {
    try {
      return await enviarEtapa(caminho, pedido)
    } catch (erro) {
      // Só o 503 do semáforo é atraso, e ele vem sempre com `Retry-After`. Sem o cabeçalho é queda de rede ou de
      // instância: aí a pessoa precisa saber na hora, em vez de ver "Entrando…" por trinta segundos.
      const espera = erroDaApi(erro, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)?.esperaSegundos
      if (espera === undefined) throw erro
      const atraso = Math.max(espera * 1_000, ESPERA_MINIMA_NO_503_MS)
      // Esperar mais do que resta do orçamento só atrasaria a mensagem: a resposta não chegaria dentro dos 30 s de
      // "Entrando…" que a tela promete, e a pessoa ficaria olhando o botão sem saber que não entrou.
      if (atraso > limite - Date.now()) throw erro
      await esperar(atraso)
    }
  }
}

/**
 * `POST /v1/sessao/email` (RF6). Leva o bilhete do convite aceito nesta aba, quando existe (7.0): é ele, junto com a
 * senha e o segundo fator, que ativa o usuário da escola que convidou. Ele sai da memória assim que a API responde,
 * porque daí em diante quem carrega o convite é o desafio assinado por ela.
 */
export async function entrarPorEmail(pedido: LoginEmailRequest): Promise<LoginResponse> {
  const resposta = await etapaComFilaDoSemaforo(CAMINHO_DA_ENTRADA_POR_EMAIL, bilheteDeConvite === undefined ? pedido : { ...pedido, bilhete: bilheteDeConvite })
  bilheteDeConvite = undefined
  return resposta
}

/** `POST /v1/sessao/matricula` (RF7): o aluno entra pelo endereço da escola, que vai no corpo e nunca no token. */
export function entrarPorMatricula(pedido: LoginMatriculaRequest): Promise<LoginResponse> {
  return etapaComFilaDoSemaforo(CAMINHO_DA_ENTRADA_POR_MATRICULA, pedido)
}

/**
 * `POST /v1/sessao/mfa` (RF12): o código do aplicativo autenticador ou um de recuperação, com o desafio `mfa` no
 * `Authorization`. Sem o desafio nesta aba (um F5 na tela, ou o quinto código errado, que o gasta), a resposta é a
 * mesma da sessão que não vale: a pessoa refaz a senha.
 */
export function entrarComSegundoFator(pedido: MfaRequest): Promise<LoginResponse> {
  const emAndamento = desafioDaEtapa('mfa')
  if (emAndamento === undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
  return enviarEtapa(CAMINHO_DO_SEGUNDO_FATOR, pedido, emAndamento)
}

/**
 * `DELETE /v1/sessao`, com uma repetição. Não passa por `authedRequest` de propósito: encerrar uma sessão que a API
 * já recusou não precisa rotacionar o cookie de renovação só para mandar o pedido outra vez.
 */
async function encerrarNaApi(): Promise<void> {
  // O token de acesso vale 10 min, e a tela pode ter ficado parada mais que isso antes do clique. Sem renovar antes,
  // o `DELETE` levaria um JWT vencido, a guarda responderia 401, e a web contaria como "não há o que encerrar" — com
  // a sessão ainda viva no servidor e o cookie intacto, que devolve tudo à pessoa seguinte do carrinho.
  if (token === undefined || (expiraEm !== undefined && expiraEm <= Date.now())) {
    try {
      await renovarSessao()
    } catch (erro) {
      // Cookie recusado: a sessão acabou mesmo, e não há o que encerrar. Com `ACESSO_SUSPENSO` é igual: a API já
      // encerrou as sessões e apagou o cookie, e avisar "não foi possível sair" aí seria aviso à toa (20.0). Qualquer
      // outra falha é falha da saída.
      if (ehCodigo(erro, ErrorCode.NAO_AUTENTICADO) || ehCodigo(erro, ErrorCode.ACESSO_SUSPENSO)) return
      throw erro
    }
  }
  try {
    await apiRequest(CAMINHO_DA_SESSAO, EMPTY_BODY, { metodo: 'DELETE', token })
  } catch (erro) {
    // Recusada com o token em dia: não há mais sessão para encerrar.
    if (ehCodigo(erro, ErrorCode.NAO_AUTENTICADO)) return
    // A saída acontece no fim da aula, com a rede da escola oscilando: uma repetição resolve a maioria dos casos.
    await esperar(ESPERA_ENTRE_TENTATIVAS_DE_SAIDA_MS)
    try {
      await apiRequest(CAMINHO_DA_SESSAO, EMPTY_BODY, { metodo: 'DELETE', token })
    } catch (segundoErro) {
      // Resposta perdida na primeira tentativa: o pedido chegou, matou a sessão, e só a resposta se perdeu. Avisar
      // "não foi possível encerrar" aí é aviso à toa, e aviso à toa é aviso que ninguém lê.
      if (ehCodigo(segundoErro, ErrorCode.NAO_AUTENTICADO)) return
      throw segundoErro
    }
  }
}

/**
 * "Sair" (RF13). Não propaga erro: o que acontece com a falha é a tela de entrada avisar (`saidaPendente`), porque
 * esta aba esquece o token de qualquer jeito — o computador da escola é compartilhado, e o token em memória é o que
 * a pessoa seguinte alcançaria primeiro.
 */
export async function sair(): Promise<void> {
  try {
    await encerrarNaApi()
    saidaConfirmada = true
  } catch {
    // Sem confirmação da API, o cookie de renovação pode continuar valendo: a sessão não acabou de verdade.
    saidaConfirmada = false
  } finally {
    esquecerSessao()
  }
}

/**
 * `POST /v1/sessao/escola` com o desafio `escolher` (RF14): conclui o login na escola escolhida. Sem o desafio nesta
 * aba — um F5 na tela da escolha —, responde como sessão que não vale, e a pessoa refaz a senha.
 *
 * Não passa pelo semáforo do hash: esta rota não confere senha nenhuma.
 */
export function escolherEscola(usuarioId: string): Promise<LoginResponse> {
  const emAndamento = desafioDaEtapa('escolher')
  if (emAndamento === undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
  return enviarEtapa(CAMINHO_DA_ESCOLA_DA_SESSAO, { usuarioId }, emAndamento)
}

/**
 * `POST /v1/sessao/escola` com o token da sessão aberta (RF14): a troca pelo seletor do cabeçalho. A API cria a
 * sessão na escola de destino e encerra a de origem.
 *
 * Quem esvazia o cache é `guardarToken`, quando o token do destino entra: o dado da escola de origem sai do cliente
 * sem que nenhuma busca saia com a credencial dela (regra 10, item 1).
 *
 * Com a coordenação no destino, a resposta é o desafio do segundo fator e nenhuma sessão muda: a de origem continua
 * valendo até o código ser aceito (Tech Spec, seção 5, "Troca de escola"). Aí o cache **não** é esvaziado agora —
 * a pessoa continua na escola de origem, e pode desistir do código e voltar para a tela dela —, e sim quando a
 * sessão do destino for gravada, pela tela do segundo fator.
 */
export function trocarDeEscola(usuarioId: string): Promise<LoginResponse> {
  return authedRequest(CAMINHO_DA_ESCOLA_DA_SESSAO, loginResponseSchema, { metodo: 'POST', corpo: { usuarioId } }).then((resposta) => {
    guardarEtapa(resposta)
    return resposta
  })
}

/**
 * `POST /v1/sessao/atividade`: houve ponteiro ou teclado nesta aba. Quem decide quando chamar é o relógio de
 * inatividade (`sessao/idle-timeout.ts`), no máximo uma vez a cada 5 min — nenhuma tela fica batendo na API sozinha.
 */
export function registrarAtividade(): Promise<void> {
  return authedRequest(CAMINHO_DA_ATIVIDADE, EMPTY_BODY, { metodo: 'POST' })
}

/**
 * A inatividade venceu nesta aba (RF13): encerra a sessão na API, esvazia o cache e deixa o login por cima da tela.
 *
 * Encerrar na API é o que apaga o cookie de renovação; sem isso, um F5 devolveria a sessão inteira à pessoa seguinte
 * no Chromebook do carrinho. A falha do `DELETE` não muda o que acontece aqui: esta aba esquece a sessão de qualquer
 * jeito, como no "Sair".
 */
export async function encerrarPorInatividade(): Promise<void> {
  try {
    await encerrarNaApi()
    saidaConfirmada = true
  } catch {
    saidaConfirmada = false
  } finally {
    vencerSessao()
  }
}
