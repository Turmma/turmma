import type { Habilidade } from '@educa/shared'
import type { Trecho } from '../material.js'

/**
 * Texto sintético e original, escrito para os testes da camada de IA: "Química 2, cap. 7 — Estequiometria", seis
 * páginas, na mesma linha do PDF de demonstração (`docs/mvp-rapido.md`, 9.5). As frases são definitórias de propósito
 * ("X é Y", "X corresponde a Y", relação com número): é delas que a versão determinística tira as questões.
 * Nenhum material de terceiro (D5) e nenhuma pessoa (regra 20, item 17).
 */
export const MATERIAL_DE_ESTEQUIOMETRIA = '0b0f6c1e-7a51-4c1b-9d0e-2f3a4b5c6d70'

export const PAGINAS_DE_ESTEQUIOMETRIA: readonly string[] = [
  // 1. Mol e constante de Avogadro
  'Contar átomos um a um é impossível: eles são pequenos demais e numerosos demais. Por isso a Química conta em mols, ' +
    'do mesmo jeito que o comércio conta ovos em dúzias. O mol é a unidade de quantidade de matéria do Sistema Internacional. ' +
    'A constante de Avogadro é o número de entidades elementares que existem em um mol de matéria. ' +
    'Um mol de qualquer substância contém 6,02 × 10²³ entidades elementares. ' +
    'A entidade elementar é o átomo, a molécula, o íon ou a fórmula unitária que compõe a substância.',
  // 2. Massa molar
  'A massa molar é a massa, em gramas, de um mol de uma substância. ' +
    'A massa atômica é a massa de um átomo expressa em unidades de massa atômica. ' +
    'A massa molar da água é 18 g/mol. A massa molar do gás carbônico é 44 g/mol. ' +
    'A massa molar do gás oxigênio é 32 g/mol. A massa molar do cloreto de sódio é 58,5 g/mol. ' +
    'Para passar de massa para quantidade de matéria, divide-se a massa da amostra pela massa molar da substância. ' +
    'Assim, 36 g de água correspondem a 2 mol de água.',
  // 3. Equação química e conservação da massa
  'A equação química é a representação de uma reação por meio de fórmulas e coeficientes. ' +
    'O coeficiente estequiométrico é o número que indica a proporção, em mols, de cada substância na equação balanceada. ' +
    'A lei da conservação da massa é o princípio segundo o qual a massa total dos reagentes se mantém nos produtos. ' +
    'Uma equação balanceada é aquela em que cada elemento tem o mesmo número de átomos nos dois lados. ' +
    'Antes de qualquer cálculo, confere-se o balanceamento: conta feita sobre equação desbalanceada sai errada.',
  // 4. Proporção estequiométrica
  'A proporção estequiométrica é a relação entre as quantidades de matéria de reagentes e produtos indicada pelos coeficientes. ' +
    'Na síntese da água, 2 mol de gás hidrogênio reagem com 1 mol de gás oxigênio e formam 2 mol de água. ' +
    'O cálculo estequiométrico é o procedimento que usa a proporção da equação para prever quantidades de reagentes e produtos. ' +
    'O caminho costuma ter três passos: converter a massa dada em mols, aplicar a proporção da equação e converter o resultado para a unidade pedida.',
  // 5. Reagente limitante
  'Nem sempre os reagentes são misturados na proporção exata da equação. ' +
    'O reagente limitante é o reagente que acaba primeiro e determina a quantidade máxima de produto. ' +
    'O reagente em excesso é o reagente que sobra quando a reação termina. ' +
    'Para achar o limitante, compara-se a quantidade disponível de cada reagente, em mols, com a proporção da equação balanceada.',
  // 6. Rendimento e pureza
  'O rendimento teórico é a quantidade máxima de produto prevista pela proporção estequiométrica. ' +
    'O rendimento real é a quantidade de produto obtida de fato no experimento. ' +
    'O rendimento percentual corresponde a cem vezes a razão entre o rendimento real e o rendimento teórico. ' +
    'A pureza é a porcentagem da amostra formada pela substância de interesse. ' +
    'Perdas no manuseio, reações paralelas e reagentes impuros explicam por que o rendimento real fica abaixo do teórico.',
]

export function trechosDeEstequiometria(paginas: readonly number[] = [1, 2, 3, 4, 5, 6]): Trecho[] {
  return paginas.map((pagina) => {
    const texto = PAGINAS_DE_ESTEQUIOMETRIA[pagina - 1]
    if (texto === undefined) throw new Error(`o material de teste não tem a página ${pagina}`)
    return { materialId: MATERIAL_DE_ESTEQUIOMETRIA, pagina, texto }
  })
}

/** Catálogo curto de habilidades de Química, como o que a fatia guarda em código. */
export const HABILIDADES_DE_ESTEQUIOMETRIA: readonly Habilidade[] = [
  { codigo: 'EM13CNT104', descricao: 'Relacionar mol, massa molar e constante de Avogadro à quantidade de matéria' },
  { codigo: 'EM13CNT101', descricao: 'Aplicar a conservação da massa e a proporção estequiométrica em equação balanceada' },
  { codigo: 'EM13CNT301', descricao: 'Identificar o reagente limitante e o reagente em excesso de uma reação' },
  { codigo: 'EM13CNT302', descricao: 'Calcular o rendimento teórico, o rendimento real e a pureza' },
]

export const CONTEXTO_DE_QUIMICA = { serie: '2ª série do Ensino Médio', disciplina: 'Química' } as const
