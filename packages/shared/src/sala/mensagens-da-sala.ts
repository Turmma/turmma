import { ErrorCode } from '../errors/error-code.js'
import { MENSAGENS_DE_ERRO } from '../errors/messages.js'

/**
 * Os textos da página pública da turma, `/e/<slug>/turma` (A1, tarefa 17.0; Tech Spec da A1, seção 9, "Textos"; W9).
 * Quem lê é o aluno de 11 anos, no computador da escola: frase curta, o que fazer, sem código de erro e sem falar do
 * "computador" (`docs/interface.md`, seção 2).
 */

/**
 * Por onde a página chegou à turma: o link que o professor mandou (`#<token>`) ou o código digitado. O servidor responde
 * o mesmo `NAO_ENCONTRADO` aos dois (R1), e é a página que sabe qual dos dois usou.
 */
export type CaminhoDaSala = 'link' | 'codigo'

export const MENSAGENS_DA_SALA = {
  /** O `NAO_ENCONTRADO` do código digitado: errado, vencido, revogado, de outra escola. */
  codigoNaoEncontrado: 'Não encontramos turma com este código. Confira as letras e os números; se estiver certo, peça o código atual ao professor.',
  /** O `NAO_ENCONTRADO` do link: vencido, revogado, refeito ou de um ano que acabou. */
  linkNaoVale: 'Este link não vale mais. Peça o código atual ao professor.',
  /** Nome tomado, de outra turma ou matrícula que não é a dele: um texto só, que não diz qual dos dois errou (R2). */
  recusada: MENSAGENS_DE_ERRO.REIVINDICACAO_RECUSADA,
  /** O 503 enquanto a página repete o envio sozinha. */
  tentandoDeNovo: 'O sistema está cheio agora. Tentando de novo…',
  /** O 503 depois do terceiro reenvio: a página para e oferece "Tentar de novo". */
  cheio: 'O sistema está cheio agora.',
  /** O limite sem `Retry-After` (a borda que não o mandou): a página não inventa um número. */
  limiteSemEspera: 'Muitas tentativas agora. Espere alguns minutos ou chame o professor.',
} as const

/**
 * Os minutos do `Retry-After` (em segundos), arredondados para cima, no mínimo 1: 60 s dão 1 minuto, 61 s dão 2. Dizer
 * menos do que falta faria o aluno tentar cedo e ouvir o limite de novo.
 */
export function minutosDaEspera(segundos: number): number {
  return Math.max(1, Math.ceil(segundos / 60))
}

/**
 * O texto do `LIMITE_EXCEDIDO`, o mesmo para o limite do nome (a 6ª matrícula errada, L4) e para o `rl:ip` (L10). Não
 * promete que um código novo destrava: no `rl:ip` isso seria falso. "Chame o professor" cobre os dois: é ele quem gera o
 * código novo que destrava o nome.
 */
export function mensagemDoLimiteDaSala(esperaSegundos?: number): string {
  if (esperaSegundos === undefined || !Number.isFinite(esperaSegundos)) return MENSAGENS_DA_SALA.limiteSemEspera
  const minutos = minutosDaEspera(esperaSegundos)
  return `Muitas tentativas agora. Espere ${String(minutos)} ${minutos === 1 ? 'minuto' : 'minutos'} ou chame o professor.`
}

/**
 * O texto de uma falha da página pública, pelo código e pelo caminho que a página usou. `esgotado` é o 503 que a página
 * já repetiu três vezes. O que não é da sala cai no catálogo geral, que também não traz código nem "computador".
 */
export function mensagemDaSala(codigo: ErrorCode, contexto: { readonly caminho: CaminhoDaSala; readonly esperaSegundos?: number | undefined; readonly esgotado?: boolean }): string {
  switch (codigo) {
    case ErrorCode.NAO_ENCONTRADO:
      return contexto.caminho === 'link' ? MENSAGENS_DA_SALA.linkNaoVale : MENSAGENS_DA_SALA.codigoNaoEncontrado
    case ErrorCode.LIMITE_EXCEDIDO:
      return mensagemDoLimiteDaSala(contexto.esperaSegundos)
    case ErrorCode.INDISPONIVEL_TENTE_DE_NOVO:
      return contexto.esgotado === true ? MENSAGENS_DA_SALA.cheio : MENSAGENS_DA_SALA.tentandoDeNovo
    // A recusa cai aqui: o texto do catálogo é o do W9 (`MENSAGENS_DA_SALA.recusada`).
    default:
      return MENSAGENS_DE_ERRO[codigo]
  }
}
