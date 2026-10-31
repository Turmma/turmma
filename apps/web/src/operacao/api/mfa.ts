import { ErrorCode, configurarSegundoFatorDeOperadorResponseSchema, type ConfigurarSegundoFatorDeOperadorResponse } from '@educa/shared'
import { chamarApi, ErroDaApi } from '../../api/client'
import { desafioDeOperador, esquecerDesafioDeOperador, guardarDesafioDeOperador } from './sessao'

export const CAMINHO_DA_CONFIGURACAO_DO_SEGUNDO_FATOR_DE_OPERADOR = '/v1/operacao/sessao/mfa/configurar'

/** O que a tela mostra: o segredo em texto, a URI `otpauth://` (o QR e o link) e os dez códigos de recuperação. */
export type SegundoFatorParaConfigurar = Omit<ConfigurarSegundoFatorDeOperadorResponse, 'etapa' | 'desafio'>

/**
 * `POST /v1/operacao/sessao/mfa/configurar`, com o desafio `configurar_mfa` no corpo (tarefa 7.0). A API o consome e
 * devolve o segredo novo, os códigos de recuperação e o desafio `mfa` com a versão deste segredo, que fica aqui, na
 * memória da aba, e nunca chega à tela. O segredo e os códigos voltam para quem chamou e vivem só no estado do
 * componente: não passam pelo cache de consultas, e a resposta sai da API com `no-store`.
 *
 * O 503 (Redis fora, sem rede) e o 429 do limite por IP podem ter parado o pedido antes do consumo: o desafio fica, e
 * a pessoa tenta de novo. Qualquer outra recusa — desafio vencido, já usado, segundo fator já ativo — o gastou, e o
 * caminho é entrar de novo.
 */
export async function configurarSegundoFatorDeOperador(): Promise<SegundoFatorParaConfigurar> {
  const desafio = desafioDeOperador('configurar_mfa')
  if (desafio === undefined) throw new ErroDaApi(ErrorCode.NAO_AUTENTICADO)
  try {
    const resposta = await chamarApi(CAMINHO_DA_CONFIGURACAO_DO_SEGUNDO_FATOR_DE_OPERADOR, configurarSegundoFatorDeOperadorResponseSchema, {
      metodo: 'POST',
      corpo: { desafio },
    })
    guardarDesafioDeOperador(resposta.etapa, resposta.desafio)
    return { uri: resposta.uri, segredo: resposta.segredo, codigosRecuperacao: resposta.codigosRecuperacao }
  } catch (erro) {
    const desafioSegue = erro instanceof ErroDaApi && (erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO || erro.codigo === ErrorCode.LIMITE_EXCEDIDO)
    if (!desafioSegue) esquecerDesafioDeOperador()
    throw erro
  }
}
