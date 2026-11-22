import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * A guarda da D55 sobre as amostras da avaliação (reserva-e-avaliacao, 10.0; `techspec.md` §7b; regra 70, item 2a): a amostra cujo **esperado** é
 * correção, nota, conceito ou devolutiva sobre texto de aluno é proibida, e o arquivo precisa ter as que **pedem** isso com `esperado: recusa`. A
 * avaliação mede se o modelo recusa; amostra que espera outra coisa ensinaria o contrário.
 *
 * Quem reconhece o pedido é o detector da D55 que o núcleo já tem (`conversaPedeJulgamentoDeTextoDeAluno`, em `packages/core/src/ia/tasks/`), injetado
 * por quem chama: o `tsconfig` de `tools/` não compila o núcleo. A guarda cruza o que o detector reconhece com a linha declarada:
 *
 * 1. sem o arquivo de amostras, ela reprova (a lista vazia nunca é "nada a cobrar");
 * 2. amostra de `propor_ferramenta`, em qualquer linha, que o detector reconhece como pedido de julgamento e cujo `esperado` não é `recusa`;
 * 3. amostra da linha `d55_amostras` cujo `esperado` não é `recusa`;
 * 4. amostra com `trazTextoDeAluno` fora da linha `d55_amostras`, ou com `esperado` que não seja `recusa`;
 * 5. arquivo sem nenhuma amostra de recusa na linha `d55_amostras`.
 *
 * A guarda lê o arquivo com um esquema próprio e frouxo (só o que ela confere), de propósito: ela vale mesmo quando o leitor completo
 * (`tools/ia/amostras.ts`) recusaria o arquivo por outro motivo.
 */

export const CAMINHO_DAS_AMOSTRAS_DA_GUARDA = 'tools/ia/amostras/avaliacao-1.json'
export const LINHA_DA_D55 = 'd55_amostras'
export const TAREFA_DA_D55 = 'propor_ferramenta'
export const ESPERADO_DA_D55 = 'recusa'

const amostraLida = z.looseObject({ id: z.string(), esperado: z.string(), entrada: z.record(z.string(), z.unknown()).optional(), trazTextoDeAluno: z.boolean().optional() })
const arquivoLido = z.looseObject({ linhas: z.array(z.looseObject({ id: z.string(), tarefa: z.string(), amostras: z.array(amostraLida).optional() })) })

export type AmostraLida = z.infer<typeof amostraLida>
export type ArquivoDeAmostrasLido = z.infer<typeof arquivoLido>

/** Diz se a conversa da amostra pede nota, conceito, correção ou devolutiva sobre texto de aluno: o detector da D55 do núcleo, com a `entrada` da amostra. */
export type DetectorDaD55 = (entrada: Record<string, unknown>) => boolean

export interface Violacao {
  readonly onde: string
  readonly motivo: string
}

/** O arquivo lido, ou o motivo de não ter sido: o arquivo que some ou não abre é violação, não silêncio. */
export function lerArquivoDaGuarda(raiz: string): { arquivo: ArquivoDeAmostrasLido } | { violacao: Violacao } {
  const caminho = join(raiz, CAMINHO_DAS_AMOSTRAS_DA_GUARDA)
  if (!existsSync(caminho)) return { violacao: { onde: CAMINHO_DAS_AMOSTRAS_DA_GUARDA, motivo: 'o arquivo de amostras não existe: a guarda não passa em branco' } }
  try {
    return { arquivo: arquivoLido.parse(JSON.parse(readFileSync(caminho, 'utf8'))) }
  } catch {
    return { violacao: { onde: CAMINHO_DAS_AMOSTRAS_DA_GUARDA, motivo: 'o arquivo de amostras não abre ou não tem `linhas`' } }
  }
}

function violacoesDaAmostra(linhaId: string, tarefa: string, amostra: AmostraLida, detector: DetectorDaD55): Violacao[] {
  const onde = `${linhaId}, amostra ${amostra.id}`
  const violacoes: Violacao[] = []
  const recusa = amostra.esperado === ESPERADO_DA_D55
  if (linhaId === LINHA_DA_D55 && !recusa) violacoes.push({ onde, motivo: `a linha da D55 só espera "${ESPERADO_DA_D55}" (esperado "${amostra.esperado}")` })
  if (tarefa === TAREFA_DA_D55 && !recusa && amostra.entrada !== undefined && detector(amostra.entrada)) {
    violacoes.push({ onde, motivo: `o detector da D55 reconhece o pedido de julgamento de texto de aluno, e o esperado é "${amostra.esperado}", não "${ESPERADO_DA_D55}"` })
  }
  if (amostra.trazTextoDeAluno === true && (linhaId !== LINHA_DA_D55 || !recusa)) {
    violacoes.push({ onde, motivo: `texto de aluno marcado só vale na linha ${LINHA_DA_D55}, com esperado "${ESPERADO_DA_D55}"` })
  }
  return violacoes
}

/** As violações da D55 no arquivo de amostras. Vazio quando nenhuma amostra espera outra coisa que a recusa e há ao menos uma que a espera. */
export function verificarAmostrasDaD55(arquivo: ArquivoDeAmostrasLido, detector: DetectorDaD55): Violacao[] {
  const violacoes = arquivo.linhas.flatMap((linha) => (linha.amostras ?? []).flatMap((amostra) => violacoesDaAmostra(linha.id, linha.tarefa, amostra, detector)))
  const daD55 = arquivo.linhas.find((linha) => linha.id === LINHA_DA_D55)?.amostras ?? []
  if (!daD55.some((amostra) => amostra.esperado === ESPERADO_DA_D55)) violacoes.push({ onde: LINHA_DA_D55, motivo: `nenhuma amostra de recusa da D55: o arquivo precisa das que pedem o julgamento com esperado "${ESPERADO_DA_D55}"` })
  return violacoes
}

/** A leitura e a verificação juntas, a partir da raiz: é o que o teste do repositório chama. */
export function verificarAmostrasDaD55DaRaiz(raiz: string, detector: DetectorDaD55): Violacao[] {
  const lido = lerArquivoDaGuarda(raiz)
  return 'violacao' in lido ? [lido.violacao] : verificarAmostrasDaD55(lido.arquivo, detector)
}
