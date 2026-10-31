import type { PARAMETRO_DO_MATERIAL, PARAMETRO_DO_PROFESSOR } from '../../../paths'

/**
 * Os parâmetros que as telas da coordenação põem no endereço para abrir algo por cima delas ou filtrar (Tech Spec da X2, seção 5):
 * `?painel=` e `?situacao=` das Turmas, `?professor=` dos Professores, `?material=` do Material e `?estado=` da IA de Registros e `?ia=` dos Agentes. Só id ou valor de lista fechada vai ao endereço, nunca nome
 * (regra 20, item 9). Mora num arquivo próprio porque duas telas o usam, e uma tela não importa o módulo de outra.
 */
export type ParametroDoEndereco = 'painel' | 'situacao' | 'estado' | 'ia' | typeof PARAMETRO_DO_PROFESSOR | typeof PARAMETRO_DO_MATERIAL

/** O endereço com um parâmetro posto (`valor`) ou tirado (`undefined`), sem mexer nos outros. */
export function enderecoComParametro(caminho: string, busca: string, nome: ParametroDoEndereco, valor: string | undefined): string {
  const parametros = new URLSearchParams(busca)
  if (valor === undefined) parametros.delete(nome)
  else parametros.set(nome, valor)
  const resto = parametros.toString()
  return resto === '' ? caminho : `${caminho}?${resto}`
}
