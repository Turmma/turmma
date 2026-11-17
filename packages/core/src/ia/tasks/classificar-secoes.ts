import { CODIGO_DE_HABILIDADE_BNCC } from '@educa/shared'
import { z } from 'zod'
import { PROMPT_CLASSIFICAR_SECOES } from '../prompts/classificar-secoes.js'
import { defineTask, type PromptData } from '../task.js'
import { palavrasEmComum } from '../text.js'

/**
 * A classificação do material pela BNCC (classificacao-bncc, 3.0; Tech Spec, seções 5 "Classificação", 7b e 8): a tarefa da função `classificacao_do_material`. Recebe até 12 seções de um material (capítulo, ou
 * bloco de 10 páginas) e a lista das habilidades candidatas do recorte, e devolve, por seção, de 0 a 3 códigos **dessa lista**. Quem monta a entrada e grava a saída é o worker (4.0); aqui estão o formato, a
 * conferência e a versão determinística.
 *
 * - **Sem pessoa.** A entrada não tem aluno, professor nem turma: é o texto do material da escola e a tabela pública da BNCC. Por isso `levaTextoDeAluno` e `levaTextoLivreDePessoa` são `false` e a única categoria enviada ao
 *   provedor é `material_da_escola` (regra 20, item 13; D62).
 * - **Só as candidatas.** O código que o modelo devolve precisa estar na lista que recebeu: a conferência recusa o que não está (`IA_SAIDA_INVALIDA`), e o formato (`CODIGO_DE_HABILIDADE_BNCC`) recusa o que nem é código da
 *   tabela (minúscula, espaço, sufixo estadual). "Nenhuma" vale: lista vazia é saída válida, e a seção fica `sem_habilidade`.
 * - **Uma resposta por seção**, com o identificador que veio. Seção inventada, omitida, repetida ou de outra execução reprova a saída inteira: a gravação do worker se apoia em `execucao_id`, e uma seção que o modelo
 *   acrescentou nunca seria gravada, mas o que ele fez com as outras não merece confiança.
 * - **O texto do material é dado.** Vai cercado, nunca na instrução; o corte do começo (1.500 caracteres) e dos subtítulos (500) é do schema da entrada, que recusa o que passar.
 */
export const SECOES_POR_EXECUCAO = 12
export const MAXIMO_DE_CODIGOS_POR_SECAO = 3
/** O maior recorte real é a união do Fundamental com o Médio em Língua Portuguesa (267 habilidades da carga `dados-2026.08`): a sobra é para a próxima revisão da BNCC. */
export const CANDIDATAS_MAXIMAS = 300
/** A maior descrição da carga `dados-2026.08` tem 1.500 caracteres. */
export const CARACTERES_DA_DESCRICAO = 1500
export const CARACTERES_DO_TITULO = 200
export const CARACTERES_DO_COMECO = 1500
export const CARACTERES_DOS_SUBTITULOS = 500
const TETO_DE_CODIGO = 12

export const classificarSecoesInputSchema = z.strictObject({
  candidatas: z
    .array(
      z.strictObject({
        codigo: z.string().min(1).max(TETO_DE_CODIGO),
        descricao: z.string().min(1).max(CARACTERES_DA_DESCRICAO),
      }),
    )
    .min(1)
    .max(CANDIDATAS_MAXIMAS),
  secoes: z
    .array(
      z.strictObject({
        secaoId: z.uuid(),
        /** O título do capítulo; nulo no bloco de páginas, que não tem. */
        titulo: z.string().min(1).max(CARACTERES_DO_TITULO).nullable(),
        comeco: z.string().max(CARACTERES_DO_COMECO),
        subtitulos: z.string().max(CARACTERES_DOS_SUBTITULOS),
      }),
    )
    .min(1)
    .max(SECOES_POR_EXECUCAO),
})
export type ClassificarSecoesInput = z.infer<typeof classificarSecoesInputSchema>

export const classificarSecoesOutputSchema = z.strictObject({
  secoes: z
    .array(
      z.strictObject({
        secaoId: z.uuid(),
        codigos: z.array(z.string().regex(CODIGO_DE_HABILIDADE_BNCC)).max(MAXIMO_DE_CODIGOS_POR_SECAO),
      }),
    )
    .min(1)
    .max(SECOES_POR_EXECUCAO),
})
export type ClassificarSecoesOutput = z.infer<typeof classificarSecoesOutputSchema>

/**
 * O que o schema não alcança: a resposta tem uma entrada por seção que veio, cada uma uma vez, e cada código está na lista que veio, sem repetir dentro da seção (a chave de `habilidade_da_secao` é
 * `(escola, seção, código)`). Os problemas são texto fixo: voltam ao modelo na repetição, e nunca levam o que ele escreveu.
 */
function problemasDaClassificacao(entrada: ClassificarSecoesInput, saida: ClassificarSecoesOutput): string[] {
  const problemas: string[] = []
  const secoesRecebidas = new Set(entrada.secoes.map((secao) => secao.secaoId))
  const candidatas = new Set(entrada.candidatas.map((candidata) => candidata.codigo))
  const respondidas = new Set<string>()
  saida.secoes.forEach((resposta, indice) => {
    const onde = `Entrada ${String(indice + 1)}`
    if (!secoesRecebidas.has(resposta.secaoId)) problemas.push(`${onde}: o identificador não é de nenhuma seção recebida. Use só os identificadores que vieram nos dados.`)
    else if (respondidas.has(resposta.secaoId)) problemas.push(`${onde}: a seção já foi respondida. Devolva uma entrada só por seção.`)
    respondidas.add(resposta.secaoId)
    if (resposta.codigos.some((codigo) => !candidatas.has(codigo))) problemas.push(`${onde}: há código que não está na lista de candidatas. Use só os códigos da lista, copiados exatamente.`)
    if (new Set(resposta.codigos).size !== resposta.codigos.length) problemas.push(`${onde}: não repita código na mesma seção.`)
  })
  if (entrada.secoes.some((secao) => !respondidas.has(secao.secaoId))) problemas.push('Falta a resposta de pelo menos uma seção. Devolva uma entrada para cada seção recebida.')
  return problemas
}

/** O que cada seção diz de si, numa linha: o título, o começo e os subtítulos. */
const textoDaSecao = (secao: ClassificarSecoesInput['secoes'][number]): string => [secao.titulo ?? '', secao.comeco, secao.subtitulos].join('\n')

/** Quantas palavras de conteúdo a habilidade e a seção precisam ter em comum para a versão determinística propor o código. */
const PALAVRAS_EM_COMUM_MINIMAS = 2

function dadosDaClassificacao(entrada: ClassificarSecoesInput): PromptData[] {
  return [
    { tipo: 'habilidades_candidatas', corpo: entrada.candidatas.map((candidata) => `${candidata.codigo}: ${candidata.descricao}`).join('\n') },
    ...entrada.secoes.map((secao) => ({
      tipo: 'secao_do_material',
      atributos: { secaoId: secao.secaoId },
      corpo: [`Título: ${secao.titulo ?? '(bloco de páginas, sem título)'}`, 'Começo do texto:', secao.comeco, 'Linhas de subtítulo:', secao.subtitulos].join('\n'),
    })),
  ]
}

export const classificarSecoes = defineTask({
  nome: 'classificar_secoes',
  funcao: 'classificacao_do_material',
  perfil: 'rapido',
  esquemaDeEntrada: classificarSecoesInputSchema,
  esquemaDeSaida: classificarSecoesOutputSchema,
  prompt: PROMPT_CLASSIFICAR_SECOES,
  // 12 seções × (identificador + até 3 códigos) cabem em ~600 tokens; o teto deixa folga para o JSON, sem deixar o modelo escrever o que não foi pedido (D14).
  maximoDeTokensDeSaida: 800,
  // O pior pedido que o schema aceita (300 candidatas de 1.500 caracteres e 12 seções cheias): `teto-de-entrada.test.ts` o confere. O pedido real é bem menor: o maior recorte da carga mede ~31 mil tokens (`classificar-secoes.test.ts`).
  maximoDeTokensDeEntrada: 121600,
  levaTextoLivreDePessoa: false,
  levaTextoDeAluno: false,
  categoriasEnviadas: ['material_da_escola'],

  montarPedido(entrada) {
    return {
      instrucao: 'Classifique cada seção do material pela BNCC: devolva, para cada uma, de 0 a 3 códigos das habilidades candidatas que o texto dela sustenta, ou nenhum.',
      dados: dadosDaClassificacao(entrada),
    }
  },

  conferir: problemasDaClassificacao,

  /** Os códigos cuja descrição mais divide palavras com o texto da seção, até três, do que mais para o que menos e, no empate, pela ordem dos códigos; sem nenhuma que passe do mínimo, nenhum. */
  falso(entrada): ClassificarSecoesOutput {
    return {
      secoes: entrada.secoes.map((secao) => {
        const texto = textoDaSecao(secao)
        const codigos = entrada.candidatas
          .map((candidata) => ({ codigo: candidata.codigo, comum: palavrasEmComum(candidata.descricao, texto) }))
          .filter((candidata) => candidata.comum >= PALAVRAS_EM_COMUM_MINIMAS)
          .sort((a, b) => b.comum - a.comum || (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
          .slice(0, MAXIMO_DE_CODIGOS_POR_SECAO)
          .map((candidata) => candidata.codigo)
        return { secaoId: secao.secaoId, codigos }
      }),
    }
  },
})
