/**
 * O que abre por cima de Escola › Grade e calendário fica no endereço, com valor de lista fechada (`?painel=`): o painel da
 * importação da grade e o da importação do calendário. Valor desconhecido é ignorado, e só id ou palavra da lista vai ao endereço,
 * nunca nome nem arquivo (regra 20, item 9).
 */
export const PAINEIS_DA_GRADE = ['importar-grade', 'importar-calendario'] as const
export type PainelDaGrade = (typeof PAINEIS_DA_GRADE)[number]

export function painelDoEndereco(busca: string): PainelDaGrade | undefined {
  const valor = new URLSearchParams(busca).get('painel')
  return PAINEIS_DA_GRADE.find((painel) => painel === valor)
}
