import { diaDeUso, systemClock, type Clock, type Database } from '@educa/core'
import { MaterialRepository } from './material.repository.js'

/** O teto do texto de um trecho que vai a uma tarefa de IA (`trechoSchema`, em `packages/core/src/ia/material.ts`). */
export const MAXIMO_DE_CARACTERES_DO_TRECHO_PARA_IA = 8_000
export const TRECHOS_PADRAO_PARA_IA = 6
export const MAXIMO_DE_TRECHOS_PARA_IA = 20
/** A busca lê só o começo de um texto longo: a pergunta inteira de uma pessoa cabe com folga. */
const MAXIMO_DE_CARACTERES_DA_BUSCA = 400

/**
 * Uma página do material da escola, com o texto dela: é o que o Assistente e o Tutor recebem para citar (D6). Cabe no
 * `Trecho` da camada de IA (`{ materialId, pagina, texto }`); `titulo` e `disciplinaId` vão a mais, para a citação
 * dizer o nome do material e para quem chama conferir a disciplina.
 */
export interface TrechoDoMaterial {
  readonly materialId: string
  readonly disciplinaId: string
  readonly titulo: string
  /** Página do PDF, a partir de 1. */
  readonly pagina: number
  readonly texto: string
}

export interface PedidoDeTrechos {
  /** O tema da ferramenta, ou a pergunta da pessoa, como ela escreveu. */
  readonly texto: string
  /** A disciplina cujo material pode ser lido. **Quem chama já conferiu** que a pessoa da requisição alcança essa disciplina. */
  readonly disciplinaId: string
  /**
   * A série da turma de quem pede: só o material declarado para ela. **Obrigatória**, e vem da turma que quem chama já conferiu, nunca do corpo do pedido: é o que impede o 9º ano de receber o
   * material só do 6º (RF7).
   */
  readonly serieId: string
  /** Só as páginas deste material. */
  readonly materialId?: string
  readonly limite?: number
}

/**
 * A porta por onde os outros módulos da API (Assistente, Tutor) leem o material da escola. **Não é rota**: não há
 * célula da `MATRIZ` aqui, e por isso o aluno, que não lê material por rota nenhuma, é atendido pelo Tutor no servidor.
 *
 * O que ela garante: a **escola é a do contexto** (regra 10, item 3; em segundo plano, o contexto precisa levar a
 * `escolaId`), só material `pronto` e não excluído, só da disciplina e da **série** pedidas, e só o próprio ou o de
 * licença vigente **hoje** (o dia de São Paulo, do `Clock` da porta). O que ela **não** confere, e fica com
 * quem chama: se a pessoa da requisição pode ler material daquela disciplina (o professor com vínculo confirmado nela,
 * o aluno numa turma que a tem).
 *
 * Nada aqui loga o texto da busca nem o do trecho (regra 20, item 9).
 */
export class TrechoSearch {
  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** O dia de São Paulo em que a licença é conferida, lido do `Clock` da porta: quem lê a página e quem abre o material do aluno (`materialDaTurma`) usam o mesmo dia. */
  hoje(): string {
    return diaDeUso(this.relogio.agora())
  }

  /** Há material da disciplina e da série que a escola pode ler hoje? A ferramenta e o chat respondem `SEM_MATERIAL_DA_SERIE` antes do `202` quando não há. */
  existeMaterialDaSerie({ serieId, disciplinaId }: { readonly serieId: string; readonly disciplinaId: string }): Promise<boolean> {
    return new MaterialRepository(this.banco).existeMaterialDaSerie(serieId.toLowerCase(), disciplinaId.toLowerCase(), this.hoje())
  }

  /**
   * As páginas mais próximas do texto, por relevância. Diferente da rota `GET /v1/materiais/busca`, basta **uma** das
   * palavras: quem busca com a frase inteira de uma pessoa ("como eu descubro o reagente limitante?") não acharia
   * nada se a página precisasse ter todas. A página que tem todas vem na frente. Sem palavra que a busca aproveite
   * (só artigo e preposição), devolve vazio — e quem chama responde `MATERIAL_INSUFICIENTE`, ou diz que não achou.
   */
  async buscar({ texto, disciplinaId, serieId, materialId, limite = TRECHOS_PADRAO_PARA_IA }: PedidoDeTrechos): Promise<TrechoDoMaterial[]> {
    const busca = texto.trim().slice(0, MAXIMO_DE_CARACTERES_DA_BUSCA)
    if (busca === '') return []
    const achados = await new MaterialRepository(this.banco).buscar(
      { texto: busca, disciplinaId: disciplinaId.toLowerCase(), serieId: serieId.toLowerCase(), hoje: this.hoje(), materialId: materialId?.toLowerCase(), limite: Math.min(Math.max(1, limite), MAXIMO_DE_TRECHOS_PARA_IA), palavras: 'qualquer' },
      'unidade',
    )
    return achados.map(paraIa)
  }

  /**
   * As páginas de um material, em ordem, até `limite`: para gerar a partir do capítulo inteiro, ou para o Tutor
   * acompanhar a leitura de um material. Material de outra escola, excluído, ainda `processando`, de outra série, de licença vencida ou inexistente: vazio.
   *
   * **A disciplina é obrigatória, e o filtro é no repository**: é a disciplina que quem chama já conferiu que a pessoa
   * alcança, e o material de outra disciplina da mesma escola responde vazio. O `materialId` costuma vir do cliente ou
   * de um `jsonb`: sem a disciplina aqui, bastaria um id de material para ler o de uma disciplina que a pessoa não tem.
   */
  async doMaterial(materialId: string, disciplinaId: string, serieId: string, limite: number = MAXIMO_DE_TRECHOS_PARA_IA): Promise<TrechoDoMaterial[]> {
    const paginas = await new MaterialRepository(this.banco).paginasDoMaterial(materialId.toLowerCase(), disciplinaId.toLowerCase(), serieId.toLowerCase(), this.hoje(), Math.max(1, limite), 'unidade')
    return paginas.map(paraIa)
  }
}

function paraIa(trecho: TrechoDoMaterial): TrechoDoMaterial {
  return { ...trecho, texto: trecho.texto.slice(0, MAXIMO_DE_CARACTERES_DO_TRECHO_PARA_IA) }
}
