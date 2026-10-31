import {
  InvariantException,
  parametrosDeFerramentaSchema,
  FERRAMENTAS,
  MAXIMO_DE_QUESTOES_POR_ATIVIDADE,
  NOME_DA_FERRAMENTA,
  QUESTOES_PADRAO_POR_ATIVIDADE,
  ROTULOS_DA_ADAPTACAO,
  TAMANHO_MAXIMO_DO_TEMA,
  TIPOS_DE_ADAPTACAO,
  type ChaveDeFuncao,
  type Ferramenta,
  type FerramentaGeradora,
  type ParametrosDeFerramenta,
  type TipoDeAdaptacao,
} from '@educa/shared'
import { ListChecks, NotebookPen, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import type { CampoDeMultipla, CampoDeNumero, CampoDeSelecao, CampoDeTexto, DescricaoDeFerramenta, OpcaoDoCampo, ValoresValidados } from '../../../components/ui/ai/schema-form'
import { lerContexto } from '../comum/turmas-da-professora'

/**
 * **As ferramentas do Assistente, como dado** (D74; P23; `docs/interface.md` 1.2): o catálogo e os campos de cada uma.
 * É o único lugar que os descreve: a página de Ferramentas, o menu da caixa de pedido, o formulário e o cartão dentro da
 * conversa leem daqui, e o `MotorFormulario` desenha os campos. Ferramenta nova é uma linha nova aqui, e não uma tela.
 *
 * Só entram as que existem (`FERRAMENTAS`, em `@educa/shared`): atividade objetiva, plano de aula e Adaptação. As outras
 * do desenho não aparecem, nem desligadas.
 */

/** As quatro categorias da D74, na ordem do catálogo. Categoria sem ferramenta não aparece na tela. */
export const CATEGORIAS_DE_FERRAMENTA = [
  { id: 'planejar', nome: 'Planejar' },
  { id: 'preparar', nome: 'Preparar a aula' },
  { id: 'avaliar', nome: 'Avaliar' },
  { id: 'corrigir', nome: 'Corrigir' },
] as const
export type CategoriaDeFerramenta = (typeof CATEGORIAS_DE_FERRAMENTA)[number]['id']

export interface FerramentaDoCatalogo {
  readonly ferramenta: Ferramenta
  readonly categoria: CategoriaDeFerramenta
  readonly nome: string
  /** O que ela entrega, numa frase. */
  readonly descricao: string
  readonly icone: LucideIcon
  /** A função do Assistente que executa: é por ela que a escola suspende (D60) e que a saída é assinada. */
  readonly funcao: ChaveDeFuncao
}

export const CATALOGO_DE_FERRAMENTAS: readonly FerramentaDoCatalogo[] = [
  {
    ferramenta: 'plano_de_aula',
    categoria: 'planejar',
    nome: NOME_DA_FERRAMENTA.plano_de_aula,
    descricao: 'Objetivos, etapas com o tempo de cada uma e como avaliar, a partir do material da escola.',
    icone: NotebookPen,
    funcao: 'conversa_e_ferramentas',
  },
  {
    ferramenta: 'adaptacao',
    categoria: 'preparar',
    nome: NOME_DA_FERRAMENTA.adaptacao,
    descricao: 'A mesma atividade em outra forma. Você escolhe o tipo de adaptação; o conteúdo cobrado não muda.',
    icone: SlidersHorizontal,
    funcao: 'adaptacao',
  },
  {
    ferramenta: 'atividade_objetiva',
    categoria: 'avaliar',
    nome: NOME_DA_FERRAMENTA.atividade_objetiva,
    descricao: 'Questões de múltipla escolha com gabarito, explicação e a página de onde cada uma saiu.',
    icone: ListChecks,
    funcao: 'conversa_e_ferramentas',
  },
]

/**
 * **"Como vai sair"** (telas do professor, 8.0; RF11): o que cada ferramenta entrega e o que acontece depois, em texto
 * **fixo**, ao lado do formulário. Fixo porque o motor não tem o que mostrar antes de gerar: nenhuma prévia é inventada, e
 * o texto é o mesmo antes, durante e depois da geração. Três linhas no máximo, nesta ordem: o que sai, onde fica
 * (Criados) e se vai à turma, e como. O `Record` faz a ferramenta nova sem texto não compilar.
 *
 * Vocabulário: acerto e página do material, nunca nota, conceito ou pontuação (D46). **A Adaptação não fala de aluno nem de
 * condição**: só do tipo da adaptação, que é o que o sistema registra (D35, D67). As aspas são as tipográficas, como nas outras
 * telas, e a versão adaptada aprovada continua precisando de "Aplicar à turma" (`AplicacaoDoArtefato.tsx`).
 *
 * **O e2e copia o texto à mão** (`e2e/professor-ferramentas.spec.ts`, constante `COMO_VAI_SAIR`): ele não importa este módulo, que
 * puxa o React e os ícones. Quem muda o texto aqui muda lá, e o e2e só roda no portão da tarefa que o altera: esquecer a cópia
 * só aparece na esteira, uma tarefa depois (regra 40, "O preço").
 */
export const COMO_VAI_SAIR: Readonly<Record<Ferramenta, readonly string[]>> = {
  atividade_objetiva: [
    'Questões de múltipla escolha com gabarito, explicação e a página do material de onde cada uma saiu.',
    'Fica em Criados, para você revisar.',
    'Só vai à turma quando você escolher “Aplicar à turma”.',
  ],
  plano_de_aula: [
    'Objetivos, etapas com o tempo de cada uma e como avaliar, com a página do material.',
    'Fica em Criados.',
    'Não vai à turma: é só seu.',
  ],
  adaptacao: [
    'A mesma atividade em outra forma, cobrando o mesmo conteúdo.',
    'Nasce esperando a sua aprovação e fica em Criados. Só o tipo da adaptação é registrado.',
    'Depois de aprovada, vai à turma quando você escolher “Aplicar à turma”.',
  ],
}

export function ehFerramenta(valor: string): valor is Ferramenta {
  return (FERRAMENTAS as readonly string[]).includes(valor)
}

export function ferramentaDoCatalogo(ferramenta: Ferramenta): FerramentaDoCatalogo {
  const achada = CATALOGO_DE_FERRAMENTAS.find((item) => item.ferramenta === ferramenta)
  if (achada === undefined) throw new InvariantException('ferramenta fora do catálogo')
  return achada
}

/** As categorias que têm ferramenta, cada uma com as dela, na ordem da D74. */
export function catalogoPorCategoria(): { readonly id: CategoriaDeFerramenta; readonly nome: string; readonly ferramentas: readonly FerramentaDoCatalogo[] }[] {
  return CATEGORIAS_DE_FERRAMENTA.map((categoria) => ({ ...categoria, ferramentas: CATALOGO_DE_FERRAMENTAS.filter((item) => item.categoria === categoria.id) })).filter((categoria) => categoria.ferramentas.length > 0)
}

/** O tempo extra que a Adaptação oferece, em % sobre o tempo da turma: lista fechada, dentro da faixa do contrato (10 a 100). */
export const TEMPOS_EXTRAS = [
  { valor: '25', rotulo: '25% a mais' },
  { valor: '50', rotulo: '50% a mais' },
  { valor: '100', rotulo: 'O dobro do tempo' },
] as const satisfies readonly OpcaoDoCampo[]

/** O que já se sabe ao abrir o formulário: a turma da caixa de pedido, o que o Assistente entendeu do pedido, a atividade de onde se veio. */
export interface IniciaisDaFerramenta {
  /** O valor do seletor de turma e disciplina (`turmas-da-professora.ts`). */
  readonly turma?: string
  readonly tema?: string
  readonly quantidade?: number
  /** O artefato de origem da Adaptação. */
  readonly origem?: string
}

export interface OpcoesDaDescricao {
  /** As turmas e disciplinas com vínculo confirmado da professora. */
  readonly turmas: readonly OpcaoDoCampo[]
  /** As atividades objetivas que ela já gerou e que não são versão adaptada: o que a Adaptação pode adaptar. */
  readonly atividades: readonly OpcaoDoCampo[]
  readonly iniciais?: IniciaisDaFerramenta
}

function campoDaTurma({ turmas, iniciais }: OpcoesDaDescricao): CampoDeSelecao {
  // Com uma turma só, ela já vem escolhida: a professora de uma turma não escolhe entre uma opção.
  const padrao = iniciais?.turma ?? (turmas.length === 1 ? turmas[0]?.valor : undefined)
  return { tipo: 'selecao', chave: 'turma', rotulo: 'Turma e disciplina', opcoes: turmas, obrigatorio: true, ...(padrao === undefined ? {} : { padrao }) }
}

function campoDoTema(iniciais: IniciaisDaFerramenta | undefined, exemplo: string): CampoDeTexto {
  return {
    tipo: 'texto',
    chave: 'tema',
    rotulo: 'Tema',
    // O tema vai para o modelo: o aviso é o mesmo do título e da justificativa (regra 20, item 3).
    dica: 'O assunto, como está no material da escola. É dele que saem as páginas citadas. Não escreva nome nem condição de aluno.',
    exemplo,
    obrigatorio: true,
    maximo: TAMANHO_MAXIMO_DO_TEMA,
    ...(iniciais?.tema === undefined ? {} : { padrao: iniciais.tema }),
  }
}

/**
 * Os campos de uma ferramenta, com as opções que vêm da escola (as turmas dela, as atividades que ela gerou) e o que já
 * se sabe do pedido. **A Adaptação não tem campo de texto**: a atividade de origem, os tipos de adaptação e o tempo
 * extra são listas fechadas, e o tipo `DescricaoDeFerramenta` não compila com um campo `texto` nela (D35, D67).
 */
export function descricaoDaFerramenta(ferramenta: Ferramenta, opcoes: OpcoesDaDescricao): DescricaoDeFerramenta {
  const { iniciais } = opcoes
  if (ferramenta === 'atividade_objetiva') {
    const quantidade: CampoDeNumero = {
      tipo: 'numero',
      chave: 'quantidade',
      rotulo: 'Questões',
      minimo: 1,
      maximo: MAXIMO_DE_QUESTOES_POR_ATIVIDADE,
      obrigatorio: true,
      padrao: iniciais?.quantidade ?? QUESTOES_PADRAO_POR_ATIVIDADE,
    }
    return { ferramenta, nome: NOME_DA_FERRAMENTA.atividade_objetiva, verbo: 'Gerar atividade', campos: [campoDaTurma(opcoes), campoDoTema(iniciais, 'Estequiometria: reagente limitante'), quantidade] }
  }
  if (ferramenta === 'plano_de_aula')
    return { ferramenta, nome: NOME_DA_FERRAMENTA.plano_de_aula, verbo: 'Gerar plano de aula', campos: [campoDaTurma(opcoes), campoDoTema(iniciais, 'Introdução à estequiometria')] }
  const origem: CampoDeSelecao = {
    tipo: 'selecao',
    chave: 'origem',
    rotulo: 'Atividade de origem',
    dica: 'Uma atividade objetiva que você já gerou. A versão adaptada cobra o mesmo conteúdo.',
    opcoes: opcoes.atividades,
    obrigatorio: true,
    ...(iniciais?.origem === undefined ? {} : { padrao: iniciais.origem }),
  }
  const tipos: CampoDeMultipla = {
    tipo: 'multipla',
    chave: 'tipos',
    rotulo: 'Tipo de adaptação',
    dica: 'Escolha a adaptação, e não o motivo dela: aqui não se escreve sobre o aluno.',
    opcoes: TIPOS_DE_ADAPTACAO.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_DA_ADAPTACAO[tipo] })),
    minimo: 1,
  }
  // Só existe com "Tempo adicional" marcado (campo condicional do motor): sem o tipo, o campo some e o valor não sai.
  const tempoExtra: CampoDeSelecao = { tipo: 'selecao', chave: 'tempoExtra', rotulo: 'Tempo extra', dica: 'Sem escolher, a escola decide o tempo.', opcoes: TEMPOS_EXTRAS, quando: { campo: 'tipos', contem: 'tempo_adicional' } }
  return { ferramenta, nome: NOME_DA_FERRAMENTA.adaptacao, verbo: 'Gerar versão adaptada', campos: [origem, tipos, tempoExtra] }
}

/** O pedido de uma ferramenta, pronto para a API, sem a `chaveEnvio`, que o ciclo de execução sorteia. */
export type PedidoDeFerramenta =
  | { readonly ferramenta: FerramentaGeradora; readonly parametros: ParametrosDeFerramenta }
  | { readonly ferramenta: 'adaptacao'; readonly artefatoId: string; readonly tipos: readonly TipoDeAdaptacao[]; readonly tempoExtraPercentual?: number }

export type PedidoMontado = { readonly ok: true; readonly pedido: PedidoDeFerramenta } | { readonly ok: false; readonly problema: string }

const NAO_FOI_POSSIVEL_MONTAR = 'Confira os campos e tente de novo.'

function ehTipoDeAdaptacao(valor: string): valor is TipoDeAdaptacao {
  return (TIPOS_DE_ADAPTACAO as readonly string[]).includes(valor)
}

/**
 * O pedido que sai do formulário, a partir dos valores já validados pelo motor. **Na Adaptação só entram a atividade, os
 * tipos da lista fechada e o tempo extra**: nenhum outro valor do formulário é copiado, e o que não é tipo de adaptação
 * é recusado. O tempo extra sem "Tempo adicional" marcado é recusado aqui, com o que fazer, antes de a API recusar.
 */
export function montarPedido(ferramenta: Ferramenta, valores: ValoresValidados): PedidoMontado {
  if (ferramenta === 'adaptacao') {
    const { origem, tipos: marcados, tempoExtra } = valores
    if (typeof origem !== 'string' || !Array.isArray(marcados)) return { ok: false, problema: NAO_FOI_POSSIVEL_MONTAR }
    const tipos = marcados.filter((tipo): tipo is TipoDeAdaptacao => typeof tipo === 'string' && ehTipoDeAdaptacao(tipo))
    if (tipos.length === 0 || tipos.length !== marcados.length) return { ok: false, problema: NAO_FOI_POSSIVEL_MONTAR }
    if (tempoExtra === undefined) return { ok: true, pedido: { ferramenta, artefatoId: origem, tipos } }
    if (!tipos.includes('tempo_adicional')) return { ok: false, problema: 'O tempo extra só vale com "Tempo adicional" marcado. Marque esse tipo, ou deixe o tempo extra sem escolha.' }
    const percentual = TEMPOS_EXTRAS.find((opcao) => opcao.valor === tempoExtra)
    if (percentual === undefined) return { ok: false, problema: NAO_FOI_POSSIVEL_MONTAR }
    return { ok: true, pedido: { ferramenta, artefatoId: origem, tipos, tempoExtraPercentual: Number(percentual.valor) } }
  }
  const contexto = typeof valores['turma'] === 'string' ? lerContexto(valores['turma']) : undefined
  if (contexto === undefined) return { ok: false, problema: NAO_FOI_POSSIVEL_MONTAR }
  // A quantidade é da atividade: o plano de aula não a leva, mesmo que um valor com esse nome apareça.
  const parametros = parametrosDeFerramentaSchema.safeParse({ ...contexto, tema: valores['tema'], ...(ferramenta === 'atividade_objetiva' ? { quantidade: valores['quantidade'] } : {}) })
  return parametros.success ? { ok: true, pedido: { ferramenta, parametros: parametros.data } } : { ok: false, problema: NAO_FOI_POSSIVEL_MONTAR }
}

/**
 * O que o cartão já sabe quando a professora escolhe a ferramenta no menu da caixa de pedido e envia: a turma da caixa
 * e, como tema, o que ela escreveu. **A Adaptação nunca recebe o texto da caixa**: o que foi escrito ali não chega a ela
 * por nenhum caminho (D35, D67).
 */
export function iniciaisDoPedido(ferramenta: Ferramenta, texto: string, turma: string | undefined): IniciaisDaFerramenta {
  if (ferramenta === 'adaptacao') return {}
  const tema = texto.trim().slice(0, TAMANHO_MAXIMO_DO_TEMA).trim()
  return { ...(turma === undefined ? {} : { turma }), ...(tema === '' ? {} : { tema }) }
}
