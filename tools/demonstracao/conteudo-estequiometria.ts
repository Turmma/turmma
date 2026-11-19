/**
 * O material de demonstração do MVP de apresentação (D71, D75; `docs/mvp-rapido.md` 9.5), como dado.
 *
 * Texto **original da equipe Turmma**, escrito do zero a partir de conhecimento comum de química: é isso que
 * torna verdadeira a titularidade e a licença que a coordenação declara na tela ao subir o arquivo (D5). Nada
 * aqui foi copiado nem parafraseado de livro, apostila ou site, e nenhum nome de pessoa, escola ou editora entra.
 *
 * `gerar-material.ts` transforma este conteúdo no PDF commitado ao lado. A paginação é a deste arquivo: uma
 * entrada de `PAGINAS_DO_MATERIAL` é uma página do PDF, e o gerador falha se o conteúdo não couber nela.
 *
 * Como o texto é escrito, para sobreviver à fonte padrão do PDF e voltar igual na extração:
 * - o índice das fórmulas vai na linha do símbolo (`H2O`, `CO2`), porque a fonte padrão não tem dígito subscrito;
 * - o expoente usa `²` e `³`, que a fonte padrão tem (`10²³`);
 * - a seta das equações é `->`, porque a fonte padrão não tem a seta;
 * - uma ideia por frase, com frases definitórias ("X é ..."): o adaptador falso de IA monta questões a partir
 *   delas, e a busca por texto precisa achar o trecho pela palavra.
 *
 * Este módulo não importa nada, para o teste de qualquer pacote poder importar o texto de uma página.
 */

export type BlocoDoMaterial =
  /** O título do capítulo, só na primeira página. */
  | { tipo: 'titulo'; texto: string }
  /** Linha pequena: a identificação do capítulo e a titularidade. */
  | { tipo: 'nota'; texto: string }
  /** O título de uma seção numerada. */
  | { tipo: 'secao'; texto: string }
  | { tipo: 'paragrafo'; texto: string }
  /** O enunciado de um exemplo resolvido. */
  | { tipo: 'enunciado'; texto: string }
  /** Uma equação ou uma relação, numa linha própria. */
  | { tipo: 'destaque'; texto: string }
  /** Uma linha de lista: passo, conta ou exercício. */
  | { tipo: 'item'; texto: string }
  /** Um quadro com moldura: o título e as linhas dele. */
  | { tipo: 'quadro'; titulo: string; itens: readonly string[] }

export interface PaginaDoMaterial {
  /** O número impresso no rodapé, a partir de 1. */
  numero: number
  /** Do que a página trata. Não é impresso: serve a quem cita a página. */
  assunto: string
  blocos: readonly BlocoDoMaterial[]
  /**
   * Frases definitórias ou relações desta página, copiadas dos blocos. São as que o teste procura no PDF,
   * página por página, e as que os outros pacotes usam para saber que o trecho veio da página certa.
   */
  frasesChave: readonly string[]
}

export const MATERIAL_DE_DEMONSTRACAO = {
  arquivo: 'quimica-2-cap-7-estequiometria.pdf',
  titulo: 'Química 2 — Capítulo 7: Estequiometria',
  disciplina: 'Química',
  serie: '2º ano do Ensino Médio',
  capitulo: 7,
  autoria: 'Equipe Turmma',
  titularidade:
    'Material de demonstração. Autoria: equipe Turmma. Texto original, com dado sintético, sem relação com nenhuma escola real.',
} as const

export const PAGINAS_DO_MATERIAL: readonly PaginaDoMaterial[] = [
  {
    numero: 1,
    assunto: 'O que a estequiometria responde; mol e constante de Avogadro',
    blocos: [
      { tipo: 'nota', texto: 'Química 2 — Capítulo 7' },
      { tipo: 'titulo', texto: 'Estequiometria' },
      { tipo: 'nota', texto: MATERIAL_DE_DEMONSTRACAO.serie },
      { tipo: 'nota', texto: MATERIAL_DE_DEMONSTRACAO.titularidade },
      { tipo: 'secao', texto: '7.1 O que a estequiometria responde' },
      {
        tipo: 'paragrafo',
        texto:
          'Estequiometria é o cálculo das quantidades de reagentes e de produtos que participam de uma reação química. Ela responde a três perguntas práticas. Quanto de cada reagente é preciso para obter certa quantidade de produto? Quanto produto se forma a partir do que está disponível? O que sobra quando a reação termina?',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Reagente é a substância que existe antes da reação e é consumida por ela. Produto é a substância que se forma durante a reação.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'O raciocínio é o mesmo de uma receita. Se uma receita de bolo pede 3 ovos para 2 xícaras de farinha, quem tem 6 ovos precisa de 4 xícaras de farinha para manter a proporção. Na química, a receita é a equação balanceada, e a unidade de contagem é o mol.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Todo cálculo estequiométrico segue o mesmo caminho: escrever a equação da reação, balancear, converter o dado do problema em mols, aplicar a proporção da equação e converter o resultado para a unidade pedida.',
      },
      { tipo: 'secao', texto: '7.2 Mol e constante de Avogadro' },
      {
        tipo: 'paragrafo',
        texto:
          'Átomos e moléculas são pequenos demais para serem contados um a um. Por isso a química conta em pacotes, do mesmo jeito que se contam ovos em dúzias. O pacote da química é o mol.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Mol é a quantidade de matéria que contém 6,02 × 10²³ entidades elementares. Constante de Avogadro é o número de entidades que existem em 1 mol: 6,02 × 10²³ por mol. Esse valor é um arredondamento de 6,02214076 × 10²³, o número exato que define o mol.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Entidade elementar é aquilo que está sendo contado: átomo, molécula, íon ou fórmula unitária. Quantidade de matéria é a grandeza que indica quantas entidades há em uma amostra; seu símbolo é n e sua unidade é o mol.',
      },
      { tipo: 'destaque', texto: 'número de entidades = n × 6,02 × 10²³' },
      {
        tipo: 'paragrafo',
        texto:
          'Assim, 1 mol de água contém 6,02 × 10²³ moléculas de H2O, e 0,5 mol de água contém 3,01 × 10²³ moléculas. Cada molécula de H2O tem 2 átomos de hidrogênio e 1 átomo de oxigênio. Logo, 1 mol de H2O contém 2 mol de átomos de hidrogênio e 1 mol de átomos de oxigênio.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Neste material, o índice das fórmulas aparece na mesma linha do símbolo: H2O é a água e CO2 é o gás carbônico. A seta das equações é escrita assim: ->.',
      },
    ],
    frasesChave: [
      MATERIAL_DE_DEMONSTRACAO.titularidade,
      'Estequiometria é o cálculo das quantidades de reagentes e de produtos que participam de uma reação química.',
      'Reagente é a substância que existe antes da reação e é consumida por ela.',
      'Produto é a substância que se forma durante a reação.',
      'Mol é a quantidade de matéria que contém 6,02 × 10²³ entidades elementares.',
      'Constante de Avogadro é o número de entidades que existem em 1 mol: 6,02 × 10²³ por mol.',
      'Entidade elementar é aquilo que está sendo contado: átomo, molécula, íon ou fórmula unitária.',
      'Quantidade de matéria é a grandeza que indica quantas entidades há em uma amostra; seu símbolo é n e sua unidade é o mol.',
    ],
  },
  {
    numero: 2,
    assunto: 'Massa molar; equação balanceada e proporção estequiométrica',
    blocos: [
      { tipo: 'secao', texto: '7.3 Massa molar' },
      {
        tipo: 'paragrafo',
        texto:
          'Massa atômica de um elemento é a massa média dos seus átomos, expressa em unidade de massa atômica (u). Massa molar é a massa de 1 mol de uma substância, expressa em gramas por mol (g/mol). A massa molar de um elemento tem o mesmo valor numérico da sua massa atômica: o carbono tem massa atômica 12 u e massa molar 12 g/mol.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'A massa molar de uma substância é a soma das massas molares de todos os átomos da sua fórmula. A massa de cada elemento é multiplicada pelo índice dele.',
      },
      { tipo: 'paragrafo', texto: 'Massas atômicas usadas neste capítulo, em unidade de massa atômica (u):' },
      { tipo: 'item', texto: 'H = 1; C = 12; N = 14; O = 16; Na = 23; Mg = 24; Al = 27; S = 32; Cl = 35,5; Ca = 40; Fe = 56.' },
      { tipo: 'item', texto: 'Água, H2O: 2 × 1 + 16 = 18 g/mol.' },
      { tipo: 'item', texto: 'Gás carbônico, CO2: 12 + 2 × 16 = 44 g/mol.' },
      { tipo: 'item', texto: 'Carbonato de cálcio, CaCO3: 40 + 12 + 3 × 16 = 100 g/mol.' },
      { tipo: 'item', texto: 'Cloreto de sódio, NaCl: 23 + 35,5 = 58,5 g/mol.' },
      {
        tipo: 'paragrafo',
        texto:
          'A massa e a quantidade de matéria se relacionam pela massa molar. Na relação abaixo, n é a quantidade de matéria em mol, m é a massa em gramas e M é a massa molar em g/mol.',
      },
      { tipo: 'destaque', texto: 'n = m / M' },
      {
        tipo: 'paragrafo',
        texto:
          'Em 90 g de água há n = 90 g / 18 g/mol = 5 mol. A massa de 0,25 mol de gás carbônico é m = n × M = 0,25 mol × 44 g/mol = 11 g.',
      },
      { tipo: 'secao', texto: '7.4 Equação balanceada e proporção estequiométrica' },
      {
        tipo: 'paragrafo',
        texto:
          'Equação química é a representação de uma reação, com os reagentes à esquerda da seta e os produtos à direita. Índice é o número escrito depois do símbolo do elemento, que indica quantos átomos dele há na fórmula. Coeficiente estequiométrico é o número escrito antes de cada fórmula na equação balanceada.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'A lei da conservação da massa afirma que, em um sistema fechado, a massa total dos reagentes é igual à massa total dos produtos. Os átomos não são criados nem destruídos na reação: eles apenas se rearranjam. Equação balanceada é a equação em que cada elemento tem o mesmo número de átomos nos reagentes e nos produtos.',
      },
      { tipo: 'destaque', texto: '2 H2 + O2 -> 2 H2O' },
      {
        tipo: 'paragrafo',
        texto:
          'Nessa equação há 4 átomos de hidrogênio e 2 átomos de oxigênio de cada lado da seta. O balanceamento altera somente os coeficientes. Os índices nunca mudam, porque mudar o índice é mudar a substância.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Proporção estequiométrica é a proporção em mols entre as substâncias de uma reação, dada pelos coeficientes da equação balanceada. Na formação da água, 2 mol de H2 reagem com 1 mol de O2 e formam 2 mol de H2O. Em massa, 4 g de H2 reagem com 32 g de O2 e formam 36 g de H2O: a massa se conserva, porque 4 g + 32 g = 36 g.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'A lei das proporções definidas afirma que uma substância composta é sempre formada pelos mesmos elementos, combinados na mesma proporção em massa. Na água, a proporção é sempre de 1 g de hidrogênio para 8 g de oxigênio.',
      },
    ],
    frasesChave: [
      'Massa atômica de um elemento é a massa média dos seus átomos, expressa em unidade de massa atômica (u).',
      'Massa molar é a massa de 1 mol de uma substância, expressa em gramas por mol (g/mol).',
      'A massa molar de uma substância é a soma das massas molares de todos os átomos da sua fórmula.',
      'Equação química é a representação de uma reação, com os reagentes à esquerda da seta e os produtos à direita.',
      'Índice é o número escrito depois do símbolo do elemento, que indica quantos átomos dele há na fórmula.',
      'Coeficiente estequiométrico é o número escrito antes de cada fórmula na equação balanceada.',
      'A lei da conservação da massa afirma que, em um sistema fechado, a massa total dos reagentes é igual à massa total dos produtos.',
      'Equação balanceada é a equação em que cada elemento tem o mesmo número de átomos nos reagentes e nos produtos.',
      'Proporção estequiométrica é a proporção em mols entre as substâncias de uma reação, dada pelos coeficientes da equação balanceada.',
      'A lei das proporções definidas afirma que uma substância composta é sempre formada pelos mesmos elementos, combinados na mesma proporção em massa.',
    ],
  },
  {
    numero: 3,
    assunto: 'Cálculo mol–mol e cálculo massa–massa, com exemplos resolvidos',
    blocos: [
      { tipo: 'secao', texto: '7.5 Cálculo mol–mol e cálculo massa–massa' },
      {
        tipo: 'paragrafo',
        texto:
          'Cálculo mol–mol é o cálculo em que a quantidade dada e a quantidade pedida estão em mols. Nele basta aplicar a proporção dos coeficientes da equação balanceada.',
      },
      {
        tipo: 'enunciado',
        texto:
          'Exemplo resolvido 1. A amônia, NH3, é produzida pela reação do gás nitrogênio com o gás hidrogênio. Quantos mols de amônia se formam a partir de 6 mol de H2, com N2 suficiente?',
      },
      { tipo: 'destaque', texto: 'N2 + 3 H2 -> 2 NH3' },
      {
        tipo: 'paragrafo',
        texto:
          'A equação está balanceada: há 2 átomos de nitrogênio e 6 átomos de hidrogênio de cada lado da seta. Pela proporção, 3 mol de H2 formam 2 mol de NH3. Então 6 mol de H2, que são o dobro, formam 4 mol de NH3. Nessa reação são consumidos 2 mol de N2.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Cálculo massa–massa é o cálculo em que a quantidade dada e a quantidade pedida estão em gramas. A massa dada é convertida em mols, a proporção é aplicada em mols, e o resultado volta para gramas. O roteiro tem quatro passos.',
      },
      { tipo: 'item', texto: 'Passo 1: escrever e balancear a equação.' },
      { tipo: 'item', texto: 'Passo 2: converter a massa dada em mols, com n = m / M.' },
      { tipo: 'item', texto: 'Passo 3: aplicar a proporção estequiométrica para achar os mols da substância pedida.' },
      { tipo: 'item', texto: 'Passo 4: converter os mols em massa, com m = n × M.' },
      {
        tipo: 'enunciado',
        texto: 'Exemplo resolvido 2. Que massa de água se forma na combustão completa de 64 g de metano, CH4?',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Combustão completa de um composto de carbono e hidrogênio é a reação com gás oxigênio que forma somente gás carbônico e água.',
      },
      { tipo: 'destaque', texto: 'CH4 + 2 O2 -> CO2 + 2 H2O' },
      {
        tipo: 'item',
        texto: 'Passo 1: a equação está balanceada, com 1 átomo de carbono, 4 de hidrogênio e 4 de oxigênio de cada lado.',
      },
      {
        tipo: 'item',
        texto: 'Passo 2: a massa molar do metano é 12 + 4 × 1 = 16 g/mol. Então n = 64 g / 16 g/mol = 4 mol de CH4.',
      },
      { tipo: 'item', texto: 'Passo 3: 1 mol de CH4 forma 2 mol de H2O. Então 4 mol de CH4 formam 8 mol de H2O.' },
      { tipo: 'item', texto: 'Passo 4: m = 8 mol × 18 g/mol = 144 g de água.' },
      {
        tipo: 'paragrafo',
        texto:
          'A conservação da massa confere o resultado. A reação consome 8 mol de O2, que são 256 g, e forma 4 mol de CO2, que são 176 g. Reagentes: 64 g + 256 g = 320 g. Produtos: 176 g + 144 g = 320 g.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'O mesmo resultado sai de uma regra de três em massa, montada a partir da equação. Pela equação, 16 g de CH4 formam 36 g de H2O. Então 64 g de CH4 formam 64 × 36 / 16 = 144 g de H2O.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Cálculo mol–massa é o cálculo em que a quantidade dada está em mols e a quantidade pedida está em gramas, ou o contrário. Ele usa os mesmos passos, sem a conversão que já veio pronta.',
      },
    ],
    frasesChave: [
      'Cálculo mol–mol é o cálculo em que a quantidade dada e a quantidade pedida estão em mols.',
      'Cálculo massa–massa é o cálculo em que a quantidade dada e a quantidade pedida estão em gramas.',
      'Combustão completa de um composto de carbono e hidrogênio é a reação com gás oxigênio que forma somente gás carbônico e água.',
      'Cálculo mol–massa é o cálculo em que a quantidade dada está em mols e a quantidade pedida está em gramas, ou o contrário.',
      'Passo 4: m = 8 mol × 18 g/mol = 144 g de água.',
    ],
  },
  {
    numero: 4,
    assunto: 'Reagente limitante e reagente em excesso',
    blocos: [
      { tipo: 'secao', texto: '7.6 Reagente limitante e reagente em excesso' },
      {
        tipo: 'paragrafo',
        texto:
          'Na prática, os reagentes quase nunca são misturados na proporção exata da equação. Reagente limitante é o reagente que acaba primeiro e determina quanto produto se forma. Reagente em excesso é o reagente que sobra quando a reação termina. Um problema é de reagente limitante quando o enunciado informa a quantidade de dois reagentes.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Um sanduíche leva 2 fatias de pão e 1 fatia de queijo. Com 10 fatias de pão e 3 fatias de queijo, só é possível montar 3 sanduíches, e sobram 4 fatias de pão. O queijo é o limitante e o pão está em excesso, embora haja mais fatias de pão do que de queijo.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Para encontrar o reagente limitante, divide-se a quantidade de matéria disponível de cada reagente, em mol, pelo coeficiente dele na equação balanceada. O menor resultado indica o reagente limitante. A quantidade de produto é sempre calculada a partir do reagente limitante, nunca a partir do reagente em excesso.',
      },
      {
        tipo: 'enunciado',
        texto:
          'Exemplo resolvido 3. Misturam-se 10 g de H2 e 64 g de O2 para formar água. Qual é o reagente limitante, que massa de água se forma e quanto sobra do reagente em excesso?',
      },
      { tipo: 'destaque', texto: '2 H2 + O2 -> 2 H2O' },
      {
        tipo: 'item',
        texto: 'Quantidades disponíveis: n(H2) = 10 g / 2 g/mol = 5 mol; n(O2) = 64 g / 32 g/mol = 2 mol.',
      },
      {
        tipo: 'item',
        texto: 'Divisão pelo coeficiente: para o H2, 5 / 2 = 2,5; para o O2, 2 / 1 = 2. O menor resultado é o do O2, que é o reagente limitante.',
      },
      {
        tipo: 'item',
        texto: 'Produto: 1 mol de O2 forma 2 mol de H2O. Então 2 mol de O2 formam 4 mol de H2O, e 4 mol × 18 g/mol = 72 g de água.',
      },
      {
        tipo: 'item',
        texto: 'Excesso: 2 mol de O2 consomem 4 mol de H2, que são 8 g. Sobram 10 g - 8 g = 2 g de H2.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'A conservação da massa confere o resultado: 8 g de H2 + 64 g de O2 = 72 g de água. Os 2 g de H2 que sobraram não reagiram e continuam no sistema.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'O reagente limitante não é necessariamente o reagente de menor massa. No exemplo havia 10 g de H2 e 64 g de O2, e o limitante foi o O2. A comparação é sempre feita em mols e leva em conta os coeficientes da equação.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Excesso é a quantidade de reagente que sobra depois que o reagente limitante acaba. Quando os reagentes são misturados exatamente na proporção estequiométrica, nenhum deles sobra: os dois acabam ao mesmo tempo.',
      },
    ],
    frasesChave: [
      'Reagente limitante é o reagente que acaba primeiro e determina quanto produto se forma.',
      'Reagente em excesso é o reagente que sobra quando a reação termina.',
      'O menor resultado indica o reagente limitante.',
      'A quantidade de produto é sempre calculada a partir do reagente limitante, nunca a partir do reagente em excesso.',
      'O reagente limitante não é necessariamente o reagente de menor massa.',
      'Excesso é a quantidade de reagente que sobra depois que o reagente limitante acaba.',
    ],
  },
  {
    numero: 5,
    assunto: 'Rendimento e pureza',
    blocos: [
      { tipo: 'secao', texto: '7.7 Rendimento e pureza' },
      {
        tipo: 'paragrafo',
        texto:
          'O cálculo estequiométrico prevê o máximo de produto que uma reação pode formar. Rendimento teórico é a quantidade máxima de produto prevista pelo cálculo estequiométrico. Rendimento real é a quantidade de produto de fato obtida na prática. Rendimento percentual é a razão entre o rendimento real e o rendimento teórico, multiplicada por 100.',
      },
      { tipo: 'destaque', texto: 'rendimento (%) = (massa obtida / massa teórica) × 100' },
      {
        tipo: 'paragrafo',
        texto:
          'O rendimento real costuma ser menor que o teórico por três motivos: a reação pode não se completar, parte do produto se perde ao ser transferida ou filtrada, e reações paralelas consomem reagente. Um rendimento acima de 100% indica erro de medida ou produto ainda impuro ou úmido.',
      },
      {
        tipo: 'enunciado',
        texto:
          'Exemplo resolvido 4. Na decomposição de 200 g de carbonato de cálcio, CaCO3, foram obtidos 89,6 g de óxido de cálcio, CaO. Qual foi o rendimento da reação?',
      },
      { tipo: 'destaque', texto: 'CaCO3 -> CaO + CO2' },
      {
        tipo: 'paragrafo',
        texto:
          'A massa molar do CaCO3 é 100 g/mol, e a do CaO é 40 + 16 = 56 g/mol. Em 200 g de CaCO3 há 2 mol, que formariam 2 mol de CaO, ou 112 g: esse é o rendimento teórico. O rendimento percentual é (89,6 g / 112 g) × 100 = 80%.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Pureza é a porcentagem da massa de uma amostra que corresponde à substância de interesse. Impureza é o material da amostra que não participa da reação estudada. Só a parte pura da amostra entra no cálculo estequiométrico.',
      },
      { tipo: 'destaque', texto: 'massa pura = massa da amostra × pureza / 100' },
      {
        tipo: 'enunciado',
        texto:
          'Exemplo resolvido 5. Uma amostra de 250 g de calcário tem 80% de pureza em CaCO3. Que massa de CO2 se forma na decomposição completa da amostra?',
      },
      {
        tipo: 'paragrafo',
        texto:
          'A massa pura é 250 g × 80 / 100 = 200 g de CaCO3, ou 2 mol. Pela equação do exemplo 4, 2 mol de CaCO3 formam 2 mol de CO2, e 2 mol × 44 g/mol = 88 g de CO2.',
      },
      {
        tipo: 'paragrafo',
        texto:
          'Quando o problema traz pureza e rendimento ao mesmo tempo, a pureza é aplicada primeiro, ao reagente, e o rendimento é aplicado por último, ao produto. Se a decomposição do exemplo 5 tivesse rendimento de 90%, a massa de CO2 obtida seria 88 g × 90 / 100 = 79,2 g.',
      },
    ],
    frasesChave: [
      'Rendimento teórico é a quantidade máxima de produto prevista pelo cálculo estequiométrico.',
      'Rendimento real é a quantidade de produto de fato obtida na prática.',
      'Rendimento percentual é a razão entre o rendimento real e o rendimento teórico, multiplicada por 100.',
      'Pureza é a porcentagem da massa de uma amostra que corresponde à substância de interesse.',
      'Impureza é o material da amostra que não participa da reação estudada.',
      'a pureza é aplicada primeiro, ao reagente, e o rendimento é aplicado por último, ao produto.',
    ],
  },
  {
    numero: 6,
    assunto: 'Erros comuns; exercícios propostos',
    blocos: [
      {
        tipo: 'quadro',
        titulo: '7.8 Erros comuns',
        itens: [
          'Erro 1: calcular com a equação sem balancear. Sem os coeficientes corretos, a proporção sai errada, e todo o resto também.',
          'Erro 2: aplicar os coeficientes diretamente às massas. Os coeficientes indicam proporção em mols, não em gramas.',
          'Erro 3: mudar o índice de uma fórmula para balancear a equação. O balanceamento altera somente os coeficientes.',
          'Erro 4: esquecer o índice ao calcular a massa molar. No CaCO3, a massa do oxigênio entra 3 vezes.',
          'Erro 5: escolher como limitante o reagente de menor massa. O limitante se descobre em mols, dividindo pelo coeficiente.',
          'Erro 6: calcular o produto a partir do reagente em excesso. O produto é calculado a partir do reagente limitante.',
          'Erro 7: aplicar a pureza ao produto ou o rendimento ao reagente. A pureza corrige o reagente, e o rendimento corrige o produto.',
          'Erro 8: deixar o resultado sem unidade. Uma resposta como 144 não diz se são gramas, mols ou moléculas.',
        ],
      },
      { tipo: 'secao', texto: '7.9 Exercícios propostos' },
      {
        tipo: 'paragrafo',
        texto:
          'Use as massas atômicas da seção 7.3. Resolva no caderno, mostre cada passo e confira o resultado pela conservação da massa.',
      },
      { tipo: 'item', texto: '1. Calcule a massa molar do ácido sulfúrico, H2SO4, e a do hidróxido de cálcio, Ca(OH)2.' },
      { tipo: 'item', texto: '2. Quantas moléculas há em 1,5 mol de gás oxigênio, O2?' },
      { tipo: 'item', texto: '3. Qual é a quantidade de matéria, em mol, presente em 245 g de H2SO4?' },
      {
        tipo: 'item',
        texto: '4. Balanceie a equação Al + O2 -> Al2O3 e calcule quantos mols de O2 reagem com 8 mol de Al.',
      },
      {
        tipo: 'item',
        texto: '5. O ferro é obtido pela reação Fe2O3 + 3 CO -> 2 Fe + 3 CO2. Que massa de ferro se forma a partir de 320 g de Fe2O3?',
      },
      {
        tipo: 'item',
        texto:
          '6. Na reação N2 + 3 H2 -> 2 NH3, misturam-se 56 g de N2 e 18 g de H2. Qual é o reagente limitante? Que massa de NH3 se forma? Que massa do reagente em excesso sobra?',
      },
      {
        tipo: 'item',
        texto:
          '7. Na queima de 48 g de magnésio, pela reação 2 Mg + O2 -> 2 MgO, foram obtidos 60 g de MgO. Calcule o rendimento percentual.',
      },
      {
        tipo: 'item',
        texto:
          '8. Uma amostra de 500 g de calcário tem 90% de pureza em CaCO3. Que massa de CaO se forma na decomposição completa da amostra?',
      },
      {
        tipo: 'item',
        texto:
          '9. Uma amostra de 125 g de calcário, com 80% de pureza em CaCO3, é decomposta com rendimento de 60%. Que massa de CO2 é obtida?',
      },
      {
        tipo: 'item',
        texto: '10. Explique, com suas palavras, por que o reagente limitante não é necessariamente o reagente de menor massa.',
      },
    ],
    frasesChave: [
      '7.8 Erros comuns',
      'Os coeficientes indicam proporção em mols, não em gramas.',
      'O balanceamento altera somente os coeficientes.',
      'A pureza corrige o reagente, e o rendimento corrige o produto.',
      '7.9 Exercícios propostos',
      '4. Balanceie a equação Al + O2 -> Al2O3 e calcule quantos mols de O2 reagem com 8 mol de Al.',
    ],
  },
]

/** O rodapé impresso em cada página, com o número dela: é o que a demonstração cita como "p. 3". */
export function rodapeDaPagina(numero: number): string {
  return `Química 2 · Capítulo 7 · Estequiometria · Material de demonstração Turmma · p. ${String(numero)}`
}

/** Um bloco como as linhas de texto que ele imprime, na ordem. */
export function linhasDoBloco(bloco: BlocoDoMaterial): string[] {
  return bloco.tipo === 'quadro' ? [bloco.titulo, ...bloco.itens] : [bloco.texto]
}

export function paginaDoMaterial(numero: number): PaginaDoMaterial {
  const pagina = PAGINAS_DO_MATERIAL.find((candidata) => candidata.numero === numero)
  if (!pagina) throw new Error(`o material de demonstração não tem a página ${String(numero)}`)
  return pagina
}

/**
 * O texto de uma página como ele é impresso: um bloco por linha, na ordem, com o rodapé no fim. É o que a
 * extração do PDF devolve para a página, a menos da quebra de linha, que o PDF faz na largura do papel
 * (`normalizeTexto` tira essa diferença dos dois lados).
 */
export function textoDaPagina(numero: number): string {
  return [...paginaDoMaterial(numero).blocos.flatMap(linhasDoBloco), rodapeDaPagina(numero)].join('\n')
}

/** Uma linha só, com um espaço entre as palavras: a forma em que o texto do PDF e o deste arquivo se comparam. */
export function normalizarTexto(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}
