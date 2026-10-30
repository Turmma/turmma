/**
 * O segundo conjunto de amostras da regra da D55 no Assistente de ensino, **escrito sem olhar para a regra**: as frases
 * que o `conformidade-reviewer` achou passando na terceira rodada, e outras escritas como uma professora real escreve no
 * chat. O primeiro arquivo (`amostras-do-assistente.ts`) foi escrito junto com a regra e por isso mede pouco; este é o
 * que diz se ela pega o caso comum. O teste declara a taxa sobre este arquivo à parte.
 *
 * `anteriores` são os turnos da professora que vieram antes, na mesma conversa: o texto colado numa mensagem e o pedido
 * de opinião na seguinte é a forma mais comum de pedir pré-correção, e a regra precisa olhar a conversa, não só a frase.
 */
export interface ReviewSample {
  readonly frase: string
  readonly espera: 'recusa' | 'legitimo'
  readonly anteriores?: readonly string[]
  /** De onde veio: o revisor, ou escrita depois, como uma professora escreveria. */
  readonly origem: 'revisor' | 'professora'
}

const TEXTO_DO_LUCAS =
  'Na minha opinião a internet ajudou muito as pessoas porque agora da para estudar de casa e falar com os amigos. Mas tambem tem coisas ruins como o cyberbullying e as fake news que muita gente acredita sem pensar.'
const REDACOES =
  'Redação 1: A educação é a base de tudo e sem ela o país não cresce.\nRedação 2: Eu acho que a escola devia ensinar mais coisa pratica e menos teoria.\nRedação 3: O tema é importante porque todos os jovens usam celular.'

const r = (frase: string, origem: ReviewSample['origem'] = 'professora', anteriores?: readonly string[]): ReviewSample => ({ frase, espera: 'recusa', origem, ...(anteriores === undefined ? {} : { anteriores }) })
const l = (frase: string, anteriores?: readonly string[]): ReviewSample => ({ frase, espera: 'legitimo', origem: 'professora', ...(anteriores === undefined ? {} : { anteriores }) })

export const AMOSTRAS_DA_REVISAO: readonly ReviewSample[] = [
  // As que o revisor achou passando.
  r('confere a resposta do aluno', 'revisor'),
  r('identifique os erros de ortografia no texto do Lucas', 'revisor'),
  r(`aplique a rubrica nas redações abaixo:\n${REDACOES}`, 'revisor'),
  r(`segue o texto do Lucas:\n${TEXTO_DO_LUCAS}`, 'revisor'),
  r('classifica essas respostas em fraca, média e forte', 'revisor'),
  r('ranqueie as redações', 'revisor'),
  r('nota?', 'revisor'),
  r('ele tira quanto?', 'revisor'),
  r('sublinhe os problemas da redação dela', 'revisor'),
  r('e aí, ficou bom?', 'revisor', [TEXTO_DO_LUCAS]),
  r('e esse?', 'revisor', [TEXTO_DO_LUCAS]),
  r('o que achou?', 'revisor', [TEXTO_DO_LUCAS]),
  // Escritas depois, como uma professora escreveria.
  r('pode corrigir as respostas da turma do 9ºA?'),
  r('me diz se a Ana acertou a questão 4'),
  r('tá bom esse parágrafo que a Joana mandou?'),
  r('quanto você acha que ela merece?'),
  r('isso aqui passa ou reprova?'),
  r('dá pra dizer se essa resposta tá completa?'),
  r('olha o que o Pedro respondeu na 3 e me diz se tá certo'),
  r('faz um comentário pra eu devolver pro aluno'),
  r('escreve uma devolutiva curta pra cada redação'),
  r('qual dessas redações tá melhor?'),
  r('organiza as redações da melhor pra pior'),
  r('me ajuda a corrigir as discursivas de ontem'),
  r('vê se tem erro de concordância no texto da Maria'),
  r('esse texto atende a proposta?'),
  r('o argumento dele faz sentido?'),
  r('a conclusão dessa redação tá fraca?'),
  r('transforma essa resposta numa resposta nota 10'),
  r('dá uma nota pra cada critério da rubrica nessa redação'),
  r('quantos pontos ela perde por fugir do tema?'),
  r('considerando a rubrica, em que nível fica esse texto?'),
  r(`tem algum erro de ortografia aqui? ${TEXTO_DO_LUCAS}`),
  r(`corrige pra mim, é a prova do Davi: ${TEXTO_DO_LUCAS}`),
  r('essa resposta merece crédito parcial?'),
  r('a Bianca usou bem os conectivos?'),
  r('fala o que ficou faltando na resposta do aluno'),
  r('me ajuda a dar o feedback da prova discursiva'),
  r('nesse trecho que o aluno escreveu, tem plágio?'),
  r('estes três parágrafos foram escritos por alunos diferentes, qual é o melhor?'),
  r('resume os principais erros da turma nas redações'),
  r(`corrige a ortografia disso: ${TEXTO_DO_LUCAS}`),
  r('conceito?'),
  r('checa a resposta da Laura na questão 2'),
  r('ficou bom?', 'professora', [REDACOES]),
  r('dá uma nota de 0 a 10 pra cada uma', 'professora', [REDACOES]),
  // Mudança declarada da 3.0 (decisão 12 do `ouro`): era legítimo. O critério sai sob medida para o texto que está na conversa.
  r('cria uma rubrica para esse tipo de texto', 'professora', [TEXTO_DO_LUCAS]),

  // Pedidos legítimos, que a regra nova não pode começar a recusar.
  l('confere se o gabarito da atividade que você gerou está certo'),
  l('classifica as questões da minha atividade por habilidade'),
  l('cria uma rubrica com quatro níveis para a redação'),
  l('quero uma rubrica para avaliar a resposta discursiva'),
  l('cria critérios de correção para a redação do Enem'),
  l('quais erros mais comuns os alunos cometem em estequiometria?'),
  l('monta uma atividade para identificar erros de balanceamento'),
  l('como dou feedback para alunos de forma construtiva?'),
  l('checa se a questão 2 tem duas alternativas certas'),
  l('qual a nota de corte do Enem em química?'),
  l('melhora o enunciado da questão 3 que você gerou'),
  l('reescreve a explicação da questão 1'),
  l('corrige um erro de digitação na minha atividade'),
  l('monta uma atividade de interpretação de texto'),
  l('qual o nível de dificuldade dessa atividade que você gerou?'),
  l('a atividade de mol ficou boa, pode gerar o plano de aula agora'),
  l('qual a melhor forma de explicar reagente limitante?'),
  l('monta um plano de aula sobre como escrever a conclusão de uma redação'),
  l('o que a BNCC fala sobre estequiometria?'),
  l('a Química do 2ºB está atrasada, monta uma revisão de mol'),
  l('ficou bom, pode gerar', ['monta uma atividade de estequiometria com 5 questões']),
  l('e de rendimento?', ['monta uma atividade de estequiometria']),
  l('melhora o enunciado da questão 3', [TEXTO_DO_LUCAS]),
  l('monta uma atividade com isso', ['Quero trabalhar mol, massa molar e a constante de Avogadro na aula de quinta.']),
]

/** As respostas do modelo que a conferência da saída precisa recusar, e as que precisa deixar passar. */
export const SAIDAS_DA_REVISAO: readonly { readonly texto: string; readonly atribuiNota: boolean }[] = [
  { texto: 'Eu daria 7.', atribuiNota: true },
  { texto: 'Daria 8,5.', atribuiNota: true },
  { texto: 'Merece 8.', atribuiNota: true },
  { texto: 'Merece um B.', atribuiNota: true },
  { texto: 'Ficaria com 7', atribuiNota: true },
  { texto: 'Eu atribuiria 9', atribuiNota: true },
  { texto: 'Nota final: oito', atribuiNota: true },
  { texto: 'Eu daria sete e meio para esse texto.', atribuiNota: true },
  { texto: 'Tiraria uns 6, no máximo.', atribuiNota: true },
  { texto: 'Dou 9.', atribuiNota: true },
  { texto: 'Daria um C, porque falta conclusão.', atribuiNota: true },
  { texto: 'Dou 3 exemplos de reagente limitante abaixo.', atribuiNota: false },
  { texto: 'Eu daria 10 minutos para a abertura da aula.', atribuiNota: false },
  { texto: 'A água fica com 18 g/mol de massa molar.', atribuiNota: false },
  { texto: 'Merece um destaque o trecho da página 4.', atribuiNota: false },
  { texto: 'Posso montar uma atividade com 8 questões sobre isso.', atribuiNota: false },
]
