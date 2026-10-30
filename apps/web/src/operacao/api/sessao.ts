import {
  ErrorCode,
  entradaDeOperadorResponseSchema,
  renovacaoDeOperadorResponseSchema,
  segundoFatorDeOperadorResponseSchema,
  type EntradaDeOperadorRequest,
  type EntradaDeOperadorResponse,
  type RenovacaoDeOperadorResponse,
} from '@educa/shared'
import { chamarApi, ErroDaApi, SEM_CORPO, type EsquemaDeResposta, type OpcoesDaChamada } from '../../api/cliente'
import { TEXTO_DA_SAIDA_NAO_CONFIRMADA, TEXTO_DA_SESSAO_ENCERRADA } from '../textos'

/**
 * A sessão do operador Turmma na web (Tech Spec da A0, seções 5 e 9). É um módulo à parte do `api/sessao.ts` da escola,
 * de propósito: nenhuma variável, trava, canal ou cookie é dividido com a sessão de escola, e sair de uma nunca mexe na
 * outra (RF6). A mesma pessoa pode ser coordenadora numa escola e operadora, com as duas abas abertas.
 *
 * - O token de acesso (`operador+jwt`, 10 min) vive só aqui, em variável de módulo, e some quando a aba fecha ou
 *   recarrega (regra 50, item 7). Quem guarda a sessão entre recargas é o cookie `turmma_operacao`, `HttpOnly`, que o
 *   JavaScript da página não lê e que o navegador só manda a `/v1/operacao/sessao`.
 * - O desafio da etapa (`desafio-operador+jwt`, 5 min) vai no **corpo** das rotas do segundo fator (tarefa 7.0) e
 *   também vive só aqui. Um F5 o perde, e a pessoa refaz a senha.
 * - Nada em `localStorage`, `sessionStorage`, cookie legível ou URL.
 */

export const CAMINHO_DA_SESSAO_DE_OPERADOR = '/v1/operacao/sessao'
export const CAMINHO_DA_ENTRADA_DE_OPERADOR = `${CAMINHO_DA_SESSAO_DE_OPERADOR}/email`
export const CAMINHO_DO_SEGUNDO_FATOR_DE_OPERADOR = `${CAMINHO_DA_SESSAO_DE_OPERADOR}/mfa`
export const CAMINHO_DA_RENOVACAO_DE_OPERADOR = `${CAMINHO_DA_SESSAO_DE_OPERADOR}/renovar`
export const CAMINHO_DA_SAIDA_DE_OPERADOR = `${CAMINHO_DA_SESSAO_DE_OPERADOR}/sair`

/**
 * A trava das Web Locks da renovação do operador. Nome próprio: a da escola (`educa-renovacao`) seguraria a renovação
 * da coordenadora que está com a outra aba aberta, e as duas sessões não têm nada a ver uma com a outra.
 */
export const NOME_DA_TRAVA_DE_RENOVACAO_DE_OPERADOR = 'turmma-operacao-renovacao'

/**
 * O canal entre as abas da operação. Próprio, e não o `educa-atividade` da escola: o "Sair" do operador encerra as
 * outras abas da operação e nenhuma aba de escola, e a mensagem só diz o que aconteceu, nunca quem nem com que token.
 */
export const CANAL_DA_OPERACAO = 'turmma-operacao'

/** Por quanto tempo a entrada repete sozinha o 503 do semáforo do hash, como a da escola (Tech Spec do F1, "Fila"). */
export const PRAZO_DA_ENTRADA_NO_503_MS = 30_000
/** O piso da espera entre duas tentativas no 503, qualquer que seja o `Retry-After`. */
export const ESPERA_MINIMA_NO_503_MS = 1_000
/** Quanto o "Sair" espera antes da única repetição. */
export const ESPERA_ENTRE_TENTATIVAS_DE_SAIDA_MS = 1_000

/**
 * O estado da sessão do operador nesta aba:
 * - `desconhecida`: a aba acabou de abrir e não se sabe se o cookie vale;
 * - `abrindo`: a renovação pelo cookie está em andamento;
 * - `aberta`: há token de acesso em memória;
 * - `anonima`: não há sessão, e a entrada é o caminho (com o aviso do que aconteceu, quando houve);
 * - `indisponivel`: a API não respondeu (503, sem rede). Não é saída: a tela fica e oferece tentar de novo.
 *
 * Não há `vencida` como na escola: a sessão do operador que terminou vai à entrada com a mensagem (Tech Spec, seção 9),
 * porque as telas da operação não têm rascunho que o relógio possa apagar.
 */
export type EstadoDaSessaoDeOperador = 'desconhecida' | 'abrindo' | 'aberta' | 'anonima' | 'indisponivel'

export type EtapaDoDesafioDeOperador = EntradaDeOperadorResponse['etapa']

/** O pedido do segundo fator sem o desafio, que vem daqui e nunca da tela. */
export type CodigoDoSegundoFatorDeOperador = { readonly codigo: string } | { readonly recuperacao: string }

/** O que as abas da operação dizem umas às outras. Nada de pessoa, nem token: só o fato. */
type MensagemDoCanal = { readonly tipo: 'saiu' } | { readonly tipo: 'entrou' } | { readonly tipo: 'uso'; readonly em: number }

let token: string | undefined
let expiraEm: number | undefined
let estado: EstadoDaSessaoDeOperador = 'desconhecida'
let ultimoErro: unknown
let desafio: { readonly etapa: EtapaDoDesafioDeOperador; readonly valor: string } | undefined
/** O que a entrada precisa dizer por ter vindo de outra tela: sessão encerrada, código recusado, saída não confirmada. */
let aviso: string | undefined
/**
 * Quando esta aba (ou outra da operação) mandou por último uma requisição que a API aceitou com a sessão: é o que move
 * o `ultimoUsoEm` no servidor, e é daqui que o relógio de inatividade conta (`operacao/inatividade.ts`).
 */
let ultimoUso: number | undefined

const ouvintes = new Set<() => void>()
/** O que esquecer quando a sessão acaba ou muda de dono: hoje, o cache de consultas da área da operação. */
const aoTrocar = new Set<() => void>()
/** Quem acompanha o último uso: o relógio de inatividade. */
const aoUsar = new Set<() => void>()

let canal: BroadcastChannel | undefined

/**
 * Sobe a cada vez que a sessão desta aba é esquecida. A renovação que estava no ar quando a pessoa saiu volta depois
 * com um token que não é mais de ninguém aqui: ela confere a geração e descarta o que trouxe, em vez de ressuscitar a
 * sessão que acabou de ser encerrada.
 */
let geracao = 0

/**
 * O canal, aberto na primeira vez que alguém precisa dele. Sem `BroadcastChannel` (navegador antigo), cada aba segue
 * sozinha: a saída de uma não chega à outra, mas a outra cai na entrada na próxima requisição, pelo 401 da API.
 */
function canalDaOperacao(): BroadcastChannel | undefined {
  if (canal !== undefined) return canal
  if (typeof BroadcastChannel === 'undefined') return undefined
  canal = new BroadcastChannel(CANAL_DA_OPERACAO)
  canal.addEventListener('message', (evento: MessageEvent<MensagemDoCanal>) => ouvirOutraAba(evento.data))
  return canal
}

function avisarOutrasAbas(mensagem: MensagemDoCanal): void {
  canalDaOperacao()?.postMessage(mensagem)
}

/**
 * O que outra aba da operação contou:
 * - `saiu`: o "Sair" dela encerrou a sessão, que é a mesma cookie desta aba; aqui só se esquece tudo, sem chamar a API;
 * - `entrou`: outra pessoa (ou a mesma) abriu uma sessão nova, e o cookie agora é o dela. O que esta aba tem é da
 *   sessão anterior, e sai daqui antes que alguém o veja com a credencial de outra pessoa;
 * - `uso`: houve requisição aceita lá, e o relógio de inatividade daqui conta a partir dela.
 */
function ouvirOutraAba(mensagem: MensagemDoCanal): void {
  if (mensagem.tipo === 'uso') {
    if (estado === 'aberta') marcarUso(mensagem.em)
    return
  }
  esquecerTudo(undefined)
}

function anunciar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

function definirEstado(novo: EstadoDaSessaoDeOperador): void {
  if (estado === novo) return
  estado = novo
  anunciar()
}

function marcarUso(momento: number): void {
  if (ultimoUso !== undefined && ultimoUso >= momento) return
  ultimoUso = momento
  for (const ouvinte of aoUsar) ouvinte()
}

/**
 * Esquece tudo o que era da sessão desta aba — token, desafio, erro, uso — e esvazia o cache da área: é o que garante
 * que, depois do "Sair" do operador A, o B que entra no mesmo navegador não vê nem alcança nada de A (retro do F1, o
 * resíduo da pessoa anterior). O aviso é o único que sobra, e é o que explica à pessoa por que ela está na entrada.
 */
function esquecerTudo(novoAviso: string | undefined): void {
  geracao++
  token = undefined
  expiraEm = undefined
  desafio = undefined
  ultimoErro = undefined
  ultimoUso = undefined
  aviso = novoAviso
  estado = 'anonima'
  anunciar()
  for (const ouvinte of aoTrocar) ouvinte()
}

/** Assina a mudança de estado (`useSyncExternalStore`). É também o que liga esta aba ao canal das outras. */
export function assinarSessaoDeOperador(ouvinte: () => void): () => void {
  canalDaOperacao()
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Registra o que esvaziar quando a sessão acaba ou muda de dono. Devolve o cancelamento. */
export function aoTrocarDeSessaoDeOperador(ouvinte: () => void): () => void {
  aoTrocar.add(ouvinte)
  return () => {
    aoTrocar.delete(ouvinte)
  }
}

/** Registra quem acompanha o último uso da sessão (o relógio de inatividade). Devolve o cancelamento. */
export function aoUsarSessaoDeOperador(ouvinte: () => void): () => void {
  aoUsar.add(ouvinte)
  return () => {
    aoUsar.delete(ouvinte)
  }
}

export function estadoDaSessaoDeOperador(): EstadoDaSessaoDeOperador {
  return estado
}

/** A falha que deixou a sessão `indisponivel`. */
export function erroDaSessaoDeOperador(): unknown {
  return ultimoErro
}

/** O token em memória; exposto para o teste provar que o da pessoa anterior não sobra. */
export function tokenDeOperador(): string | undefined {
  return token
}

export function ultimoUsoDaSessaoDeOperador(): number | undefined {
  return ultimoUso
}

export function avisoDaEntradaDeOperador(): string | undefined {
  return aviso
}

/** O aviso que a entrada mostra por ter vindo de outra tela (o segundo fator recusado, por exemplo). */
export function definirAvisoDaEntradaDeOperador(novo: string | undefined): void {
  aviso = novo
  anunciar()
}

/** O desafio guardado, se for o daquela etapa: cada rota só aceita o da sua (Tech Spec, seção 5, "Etapas"). */
export function desafioDeOperador(etapa: EtapaDoDesafioDeOperador): string | undefined {
  return desafio?.etapa === etapa ? desafio.valor : undefined
}

/** Guarda o desafio de uma etapa: quem chama é o aceite do convite (`configurar_mfa`) e a configuração (`mfa`). */
export function guardarDesafioDeOperador(etapa: EtapaDoDesafioDeOperador, valor: string): void {
  desafio = { etapa, valor }
}

export function esquecerDesafioDeOperador(): void {
  desafio = undefined
}

function ehCodigo(erro: unknown, codigo: ErrorCode): boolean {
  return erro instanceof ErroDaApi && erro.codigo === codigo
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

/**
 * Guarda o acesso que passa a valer. `sessaoNova` é a sessão que o segundo fator acabou de abrir: o cache do que
 * havia antes nesta aba não é dela, e as outras abas da operação ficam sabendo que o cookie mudou de dono.
 */
function guardarAcesso(resposta: RenovacaoDeOperadorResponse, momento: number, sessaoNova: boolean): void {
  token = resposta.token
  expiraEm = new Date(resposta.expiraEm).getTime()
  ultimoErro = undefined
  desafio = undefined
  if (sessaoNova) {
    aviso = undefined
    ultimoUso = undefined
    for (const ouvinte of aoTrocar) ouvinte()
    avisarOutrasAbas({ tipo: 'entrou' })
  }
  estado = 'aberta'
  anunciar()
  // Abrir a sessão e renovar pelo cookie não são "uso" no servidor (tarefa 8.0: renovar não move `ultimo_uso_em`);
  // a entrada é, porque a API grava a sessão com o uso de agora.
  if (sessaoNova) marcarUso(momento)
}

/** A trava das Web Locks: uma renovação da operação por vez no navegador, contando as abas da operação. */
function comTravaDeRenovacao<T>(tarefa: () => Promise<T>): Promise<T> {
  const travas = globalThis.navigator?.locks as LockManager | undefined
  return travas === undefined ? tarefa() : travas.request(NOME_DA_TRAVA_DE_RENOVACAO_DE_OPERADOR, tarefa)
}

let renovacaoEmAndamento: Promise<void> | undefined

/**
 * Renova pelo cookie `turmma_operacao` e guarda o acesso novo. Uma renovação por vez nesta aba e no navegador. Duas
 * abas que renovam juntas não se derrubam: a API aceita o cookie anterior por 30 s (tarefa 8.0, C30).
 *
 * Toda recusa do `/renovar` é 401 `SESSAO_ENCERRADA` (tarefa 8.0) e sobe para quem chamou decidir; 503 e falta de rede
 * sobem como `INDISPONIVEL_TENTE_DE_NOVO`, com o token em memória intacto.
 */
export function renovarSessaoDeOperador(): Promise<void> {
  if (estado === 'anonima') return Promise.reject(new ErroDaApi(ErrorCode.SESSAO_ENCERRADA))
  const daGeracao = geracao
  renovacaoEmAndamento ??= comTravaDeRenovacao(() => chamarApi(CAMINHO_DA_RENOVACAO_DE_OPERADOR, renovacaoDeOperadorResponseSchema, { metodo: 'POST' }))
    .then((resposta) => {
      // A sessão foi esquecida enquanto a renovação estava no ar ("Sair", outra aba que saiu): o acesso não fica.
      if (daGeracao !== geracao) throw new ErroDaApi(ErrorCode.SESSAO_ENCERRADA)
      guardarAcesso(resposta, Date.now(), false)
    })
    .finally(() => {
      renovacaoEmAndamento = undefined
    })
  return renovacaoEmAndamento
}

/**
 * Abre a sessão desta aba pelo cookie, ao carregar uma tela da operação. Sem cookie, ou com a sessão que já terminou,
 * a aba fica `anonima` **sem aviso**: quem só abriu `/operacao` pela primeira vez não tem sessão nenhuma que tenha
 * terminado. Com a API fora, fica `indisponivel`, e a tela oferece tentar de novo.
 */
export async function abrirSessaoDeOperadorPeloCookie(): Promise<void> {
  if (token !== undefined) return
  definirEstado('abrindo')
  try {
    await renovarSessaoDeOperador()
  } catch (erro) {
    if (ehCodigo(erro, ErrorCode.SESSAO_ENCERRADA) || ehCodigo(erro, ErrorCode.NAO_AUTENTICADO)) {
      esquecerTudo(undefined)
      return
    }
    ultimoErro = erro
    definirEstado('indisponivel')
  }
}

/** A sessão terminou no servidor: a entrada é o caminho, com a mensagem de sessão encerrada (Tech Spec, seção 9). */
function sessaoEncerrada(): void {
  if (estado === 'anonima') return
  esquecerTudo(TEXTO_DA_SESSAO_ENCERRADA)
}

/** Renova e, se a sessão terminou, leva à entrada com a mensagem antes de devolver o erro. */
async function renovarOuEncerrar(): Promise<void> {
  try {
    await renovarSessaoDeOperador()
  } catch (erro) {
    if (ehCodigo(erro, ErrorCode.SESSAO_ENCERRADA)) sessaoEncerrada()
    throw erro
  }
}

export type OpcoesComSessaoDeOperador = Omit<OpcoesDaChamada, 'token'>

/**
 * Chamada a uma rota `@RotaDeOperacao`, com o token no `Authorization`. As três respostas que a guarda distingue
 * (Tech Spec, seção 5, "Conferência da sessão") não se confundem aqui:
 *
 * - **401 `ACESSO_VENCIDO`**: o acesso de 10 min venceu com a sessão viva. Renova pelo cookie e repete a mesma chamada,
 *   uma vez, sem a pessoa perceber. O token vencido pelo relógio desta aba é renovado antes de a chamada sair.
 * - **401 `SESSAO_ENCERRADA`**: a sessão terminou. Esquece tudo e leva à entrada com a mensagem.
 * - **503 e sem rede**: sobe como está. A tela mostra a mensagem e **fica**: ninguém é mandado para a entrada porque o
 *   banco caiu (regra 80, item 6).
 */
export async function chamarComSessaoDeOperador<T>(caminho: string, esquema: EsquemaDeResposta<T>, opcoes: OpcoesComSessaoDeOperador = {}): Promise<T> {
  if (estado === 'anonima') throw new ErroDaApi(ErrorCode.SESSAO_ENCERRADA)
  if (token === undefined || (expiraEm !== undefined && expiraEm <= Date.now())) await renovarOuEncerrar()
  const enviadaEm = Date.now()
  try {
    const resposta = await chamarApi(caminho, esquema, { ...opcoes, token })
    registrarUso(enviadaEm)
    return resposta
  } catch (erro) {
    if (ehCodigo(erro, ErrorCode.SESSAO_ENCERRADA)) {
      sessaoEncerrada()
      throw erro
    }
    if (!ehCodigo(erro, ErrorCode.ACESSO_VENCIDO)) throw erro
    await renovarOuEncerrar()
    const repetidaEm = Date.now()
    try {
      const resposta = await chamarApi(caminho, esquema, { ...opcoes, token })
      registrarUso(repetidaEm)
      return resposta
    } catch (segundoErro) {
      if (ehCodigo(segundoErro, ErrorCode.SESSAO_ENCERRADA)) sessaoEncerrada()
      throw segundoErro
    }
  }
}

/** A requisição com sessão foi aceita: conta como uso aqui e nas outras abas da operação. */
function registrarUso(momento: number): void {
  if (estado !== 'aberta') return
  marcarUso(momento)
  avisarOutrasAbas({ tipo: 'uso', em: momento })
}

/**
 * `POST /v1/operacao/sessao/email`. Repete sozinha o 503 do semáforo do hash, que vem com `Retry-After` e é atraso, não
 * recusa, por até 30 s; qualquer outro erro sobe na hora. Guarda o desafio da etapa que a API devolveu, e mais nada: o
 * da tentativa anterior sai antes, para a etapa de outra pessoa nunca sobrar na aba.
 */
export async function entrarComoOperador(pedido: EntradaDeOperadorRequest): Promise<EtapaDoDesafioDeOperador> {
  desafio = undefined
  const limite = Date.now() + PRAZO_DA_ENTRADA_NO_503_MS
  for (;;) {
    try {
      const resposta = await chamarApi(CAMINHO_DA_ENTRADA_DE_OPERADOR, entradaDeOperadorResponseSchema, { metodo: 'POST', corpo: pedido })
      desafio = { etapa: resposta.etapa, valor: resposta.desafio }
      aviso = undefined
      return resposta.etapa
    } catch (erro) {
      const espera = erro instanceof ErroDaApi && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO ? erro.esperaSegundos : undefined
      if (espera === undefined) throw erro
      const atraso = Math.max(espera * 1_000, ESPERA_MINIMA_NO_503_MS)
      if (atraso > limite - Date.now()) throw erro
      await esperar(atraso)
    }
  }
}

/**
 * O segundo fator que já está no ar. Dois envios juntos (o clique duplo em "Entrar", o Enter e o clique no mesmo
 * instante, antes de a tela desligar o botão) levam o mesmo desafio, e a API gasta o desafio no primeiro: o segundo
 * voltaria recusado e mandaria à entrada, com "o código não foi aceito", quem acabou de entrar. Aqui o segundo recebe
 * o resultado do primeiro, e sai um pedido só (tarefa 10.0 da A0b). O código do segundo envio não vai a lugar nenhum:
 * com o desafio gasto, a API o recusaria do mesmo jeito.
 */
let segundoFatorEmAndamento: Promise<void> | undefined

/**
 * `POST /v1/operacao/sessao/mfa`, com o desafio `mfa` no corpo. Abre a sessão: o token fica em memória, o cookie
 * `turmma_operacao` vem no cabeçalho, e o cache do que havia antes nesta aba sai.
 *
 * A API consome o desafio antes de conferir o código (tarefa 7.0), e por isso toda recusa dela — código errado, já
 * usado, desafio vencido, conta segurada, versão divergente — o gasta: aqui ele é esquecido também, e a tela manda a
 * pessoa refazer a senha. `ENTRADA_INVALIDA` (formato do código) é recusado antes do consumo, e 503 e sem rede podem
 * ter chegado ou não: nesses o desafio fica, e a pessoa tenta de novo na mesma tela.
 */
export function entrarComSegundoFatorDeOperador(codigo: CodigoDoSegundoFatorDeOperador): Promise<void> {
  segundoFatorEmAndamento ??= enviarSegundoFator(codigo).finally(() => {
    segundoFatorEmAndamento = undefined
  })
  return segundoFatorEmAndamento
}

async function enviarSegundoFator(codigo: CodigoDoSegundoFatorDeOperador): Promise<void> {
  const emAndamento = desafioDeOperador('mfa')
  if (emAndamento === undefined) throw new ErroDaApi(ErrorCode.NAO_AUTENTICADO)
  const enviadaEm = Date.now()
  try {
    const resposta = await chamarApi(CAMINHO_DO_SEGUNDO_FATOR_DE_OPERADOR, segundoFatorDeOperadorResponseSchema, {
      metodo: 'POST',
      corpo: { desafio: emAndamento, ...codigo },
    })
    guardarAcesso(resposta, enviadaEm, true)
  } catch (erro) {
    const desafioSegue = ehCodigo(erro, ErrorCode.ENTRADA_INVALIDA) || ehCodigo(erro, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    if (!desafioSegue) desafio = undefined
    throw erro
  }
}

/** `POST /v1/operacao/sessao/sair`, com uma repetição. A API responde 204 sempre (D59); o que falha aqui é a rede. */
async function sairNaApi(): Promise<boolean> {
  try {
    await chamarApi(CAMINHO_DA_SAIDA_DE_OPERADOR, SEM_CORPO, { metodo: 'POST' })
    return true
  } catch {
    await esperar(ESPERA_ENTRE_TENTATIVAS_DE_SAIDA_MS)
    try {
      await chamarApi(CAMINHO_DA_SAIDA_DE_OPERADOR, SEM_CORPO, { metodo: 'POST' })
      return true
    } catch {
      return false
    }
  }
}

/**
 * A saída que já está no ar. Dois "Sair" juntos (o clique duplo antes de a tela desligar o botão, ou o da faixa e o do
 * aviso de inatividade) esperam a mesma saída: um pedido à API, e a sessão esquecida uma vez (tarefa 10.0 da A0b).
 */
let saidaEmAndamento: Promise<void> | undefined

/**
 * "Sair", a um clique (D59). Esta aba esquece tudo de qualquer jeito, e as outras abas da operação também, pelo canal
 * próprio; nenhuma aba de escola é tocada. Se a API não confirmou, a entrada avisa: o cookie pode continuar valendo.
 */
export function sairComoOperador(): Promise<void> {
  saidaEmAndamento ??= sairNaApi()
    .then((confirmada) => {
      esquecerTudo(confirmada ? undefined : TEXTO_DA_SAIDA_NAO_CONFIRMADA)
      avisarOutrasAbas({ tipo: 'saiu' })
    })
    .finally(() => {
      saidaEmAndamento = undefined
    })
  return saidaEmAndamento
}

/**
 * A inatividade venceu nesta aba (30 min sem uso): encerra a sessão na API, para o cookie não devolvê-la a quem
 * sentar depois, e leva à entrada com a mensagem de sessão encerrada.
 */
export async function encerrarSessaoDeOperadorPorInatividade(): Promise<void> {
  const confirmada = await sairNaApi()
  esquecerTudo(confirmada ? TEXTO_DA_SESSAO_ENCERRADA : `${TEXTO_DA_SESSAO_ENCERRADA} ${TEXTO_DA_SAIDA_NAO_CONFIRMADA}`)
  avisarOutrasAbas({ tipo: 'saiu' })
}
