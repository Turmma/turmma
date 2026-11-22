import { ErrorCode } from '@educa/shared'
import { ApiError, type ResponseSchema } from '../client'

/**
 * A resposta da API que o contrato da web não reconhece: a web antiga lendo a API nova (camada-ia, 7.0 e 6.0). Continua sendo o
 * `ERRO_INTERNO` para quem decide pelo código (`isResultadoIncerto`), e a tela a distingue pela classe para dizer o que
 * resolve, que é atualizar a página, e não tentar de novo.
 */
export class RespostaForaDoContrato extends ApiError {
  constructor() {
    super(ErrorCode.ERRO_INTERNO)
    this.name = 'RespostaForaDoContrato'
  }
}

/** A resposta fora do contrato: tentar de novo traz a mesma, e o que resolve é a página nova. */
export const TEXTO_PARA_ATUALIZAR = 'Atualize a página: esta tela ficou desatualizada em relação ao Turmma.'

/**
 * O esquema que, ao recusar a resposta, diz que foi o contrato: em vez do `ERRO_INTERNO` genérico, a leitura falha com
 * `RespostaForaDoContrato`, e a tela diz "Atualize a página".
 */
export function lidoPeloContrato<T>(esquema: ResponseSchema<T>): ResponseSchema<T> {
  return {
    safeParse: (valor) => {
      const lido = esquema.safeParse(valor)
      if (!lido.success) throw new RespostaForaDoContrato()
      return lido
    },
  }
}
