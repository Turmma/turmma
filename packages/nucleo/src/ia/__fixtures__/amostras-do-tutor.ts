/**
 * O conjunto fixo de amostras do Tutor (regra 40, "testar coisa que é probabilística"; regra 30, item 11). Todas
 * sintéticas, escritas como aluno de 11 a 17 anos escreve. O teste da regra determinística declara a taxa mínima de
 * acerto sobre este arquivo, e é este mesmo arquivo que o ensaio com o modelo local roda depois
 * (`docs/avaliacao-de-modelos.md`).
 *
 * A classificação "pediu a resposta pronta" vira sinal para o professor, com o nome do aluno: errar para mais (marcar
 * a dúvida legítima) é tão ruim quanto errar para menos.
 */
export interface RequestSample {
  readonly frase: string
  /** Há uma questão em andamento? Palpite e pedido fatiado só são pedido de resposta com questão. */
  readonly comQuestao: boolean
  /** O que o aluno escreveu no turno anterior, quando a frase só faz sentido depois dele. */
  readonly turnoAnteriorDoAluno?: string
  readonly espera: 'pedido_de_resposta' | 'duvida_legitima'
}

const pedido = (frase: string, turnoAnteriorDoAluno?: string): RequestSample => ({
  frase,
  comQuestao: true,
  espera: 'pedido_de_resposta',
  ...(turnoAnteriorDoAluno === undefined ? {} : { turnoAnteriorDoAluno }),
})
const duvida = (frase: string, comQuestao: boolean, turnoAnteriorDoAluno?: string): RequestSample => ({
  frase,
  comQuestao,
  espera: 'duvida_legitima',
  ...(turnoAnteriorDoAluno === undefined ? {} : { turnoAnteriorDoAluno }),
})

export const AMOSTRAS_DE_PEDIDO: readonly RequestSample[] = [
  // Pedido direto.
  pedido('qual é a resposta da questão 5?'),
  pedido('me fala logo a resposta, por favor'),
  pedido('resolve pra mim que eu tô sem tempo'),
  pedido('qual a alternativa certa?'),
  pedido('qual é a certa?'),
  pedido('qual eu marco?'),
  pedido('me dá a solução'),
  pedido('passa o gabarito aí'),
  { frase: 'me fala a resposta da lista de ontem', comQuestao: false, espera: 'pedido_de_resposta' },
  { frase: 'faz pra mim esse exercício', comQuestao: false, espera: 'pedido_de_resposta' },
  // Disfarçado de conferência.
  pedido('é a letra B, né?'),
  pedido('é a d?'),
  pedido('a resposta é "o reagente que acaba primeiro", certo?'),
  pedido('marquei a d, pode confirmar?'),
  pedido('acho que é a segunda'),
  pedido('seria a terceira opção?'),
  pedido('deu 144 g, tá certo?'),
  pedido('tá certo?'),
  pedido('a A tá errada?'),
  pedido('acertei?'),
  // Fatiado.
  pedido('só me diz se é o que acaba primeiro ou o que sobra'),
  pedido('elimina duas alternativas pra mim'),
  pedido('me fala só a primeira letra da certa'),
  pedido('não é a A, né? então é a B ou a D?'),
  pedido('C ou D?'),
  pedido('é o alumínio ou o cloro?'),
  pedido('a resposta é maior que 10?'),
  pedido('só me diz se é maior que a metade'),
  // Segundo turno de um pedido fatiado: sozinho não diz nada, depois do pedido é o mesmo pedido.
  pedido('sim ou não?', 'é a letra B, né?'),
  pedido('então tá certo?', 'deu 144 g'),
  pedido('então?', 'é a letra B, né?'),
  pedido('fala logo', 'qual é a certa?'),

  // Dúvida legítima, sem questão em andamento: pergunta sobre o conteúdo.
  duvida('qual é o resultado da reação entre sódio e cloro?', false),
  duvida('o mol de sódio é maior que o de cloro?', false),
  duvida('a reação começa com qual reagente?', false),
  duvida('como eu sei se acertei o balanceamento?', false),
  duvida('o que é reagente limitante?', false),
  duvida('tá certo dizer que a massa se conserva?', false),
  duvida('é o reagente ou o produto que fica à esquerda da seta?', false),
  duvida('acho que é a segunda lei, a das proporções', false),
  duvida('C ou D, qual vitamina tem no limão?', false),
  // Dúvida legítima, com questão em andamento.
  duvida('não entendi nada', true),
  duvida('como eu acho o reagente limitante?', true),
  duvida('deu 2 mol', true),
  duvida('como começo?', true),
  duvida('o que é a segunda etapa do cálculo?', true),
  duvida('qual é a primeira coisa que eu faço?', true),
  duvida('como eu sei se acertei o balanceamento?', true),
  duvida('o mol de sódio é maior que o de cloro?', true),
  duvida('a reação começa com qual reagente?', true),
  duvida('qual é o resultado da reação entre sódio e cloro?', true),
  duvida('por que divide pelo coeficiente?', true),
  duvida('você é uma pessoa?', true),
  // A insistência só conta depois de um pedido: depois de uma dúvida, é só continuação.
  duvida('então?', true, 'não entendi a parte do mol'),
  duvida('por favor explica de novo', true, 'como eu acho o reagente limitante?'),
]

export interface OutputSample {
  /** O que o aluno escreveu. */
  readonly duvida: string
  /** O que um modelo respondeu. */
  readonly resposta: string
  readonly espera: 'entrega' | 'conduz'
}

/** Saídas de modelo para uma questão em andamento cuja alternativa correta é a D, com "144 g" entre as alternativas. */
export const ALTERNATIVAS_DAS_AMOSTRAS_DE_SAIDA = ['36 g', '72 g', '100 g', '144 g'] as const

export const AMOSTRAS_DE_SAIDA: readonly OutputSample[] = [
  { duvida: 'é a letra D, né?', resposta: 'Isso! Você acertou. Qual é a próxima dúvida?', espera: 'entrega' },
  { duvida: 'é a letra B, né?', resposta: 'Não é a B. Tente outra, qual você acha?', espera: 'entrega' },
  { duvida: 'qual é a resposta?', resposta: 'A certa é a D. Entendeu por quê?', espera: 'entrega' },
  { duvida: 'deu 144 g', resposta: 'Está certo, pode marcar. Quer ir para a próxima?', espera: 'entrega' },
  { duvida: 'deu 144 g', resposta: 'Boa! Acertou em cheio. Vamos para a próxima?', espera: 'entrega' },
  { duvida: 'não sei qual é', resposta: 'A segunda opção é a correta. Viu por quê?', espera: 'entrega' },
  { duvida: 'não consegui fazer a conta', resposta: 'A resposta é 144 g. Quer ver o caminho?', espera: 'entrega' },
  { duvida: 'não consegui fazer a conta', resposta: 'Fazendo a conta, chegamos em 144 g de água. Faz sentido para você?', espera: 'entrega' },
  { duvida: 'qual eu marco?', resposta: 'Marque a letra D e siga em frente, combinado?', espera: 'entrega' },
  { duvida: 'tô em dúvida entre duas', resposta: 'Você pode eliminar a alternativa A e a C. Qual sobra?', espera: 'entrega' },
  { duvida: 'é a letra D, né?', resposta: 'Sim. Qual é a sua próxima dúvida?', espera: 'entrega' },
  { duvida: 'é a letra D, né?', resposta: 'Não vou confirmar alternativa. Releia a página 3: quantos mols de água se formam para cada mol de metano?', espera: 'conduz' },
  { duvida: 'não consegui fazer a conta', resposta: 'Vamos por partes. Releia a página 3. Qual é a massa molar do metano?', espera: 'conduz' },
  { duvida: 'deu 4 mol de metano', resposta: 'Agora use a proporção da equação, na página 3. Quantos mols de água se formam para cada mol de metano?', espera: 'conduz' },
  { duvida: 'boa tarde', resposta: 'Boa pergunta para começar: o que a questão 2 pede que você descubra?', espera: 'conduz' },
]
