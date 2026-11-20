import type { BnccRepository } from '@educa/core'
import { descricaoParaOModelo, habilidadeEhCandidata, type ComponenteBncc, type Etapa, type HabilidadeCandidataBncc, type SerieDoRecorte } from '@educa/shared'

/**
 * As habilidades candidatas de um recorte: as da BNCC que `habilidadeEhCandidata` aceita para o componente e as séries, na ordem do código. Um conjunto por par componente e séries; quem junta vários recortes (a execução com
 * mais de um material) une os conjuntos. A leitura da tabela é do `BnccRepository`, a única da BNCC (regra 10, item 9); o que é regra do recorte fica aqui, que não toca o banco.
 */
export async function candidatasDoRecorte(bncc: BnccRepository, componente: ComponenteBncc, series: readonly SerieDoRecorte[]): Promise<HabilidadeCandidataBncc[]> {
  const etapas: Etapa[] = [...new Set(series.map((serie) => serie.etapa))]
  if (etapas.length === 0) return []
  const lidas = await bncc.habilidades({ etapas })
  return lidas.filter((habilidade) => habilidadeEhCandidata(habilidade.codigo, componente, series)).map(({ codigo, descricao }) => ({ codigo, descricao }))
}

/**
 * O texto da BNCC de um código, no tamanho do contrato da geração (`descricaoParaOModelo`, o mesmo da questão que a IA gera), para a troca da habilidade da questão. O código já foi conferido contra o recorte: o que a tabela não
 * tem devolve `undefined`.
 */
export async function descricaoOficialDaHabilidade(bncc: BnccRepository, codigo: string): Promise<string | undefined> {
  const [lida] = await bncc.habilidades({ codigo })
  return lida === undefined ? undefined : descricaoParaOModelo(lida.descricao)
}

/**
 * O texto de cada habilidade que o **diagnóstico** mostra (Turmas, resultado do aluno, Analista; classificacao-bncc, correção `descricao-oficial-da-habilidade`): o da tabela `habilidade_bncc`, pelo código, no tamanho do
 * contrato, e **nunca o que ficou gravado no conteúdo da questão**, que num artefato anterior à correção pode ser a paráfrase do modelo. O código que a tabela não tem (o do antigo catálogo, que era nosso) segue com o texto
 * gravado, que é o único que existe para ele. `gravadas` é o que o conteúdo das atividades trouxe, por código.
 */
export async function descricoesDoDiagnostico(bncc: BnccRepository, gravadas: ReadonlyMap<string, string>): Promise<Map<string, string>> {
  if (gravadas.size === 0) return new Map()
  const oficiais = await bncc.habilidades({ codigos: [...gravadas.keys()] })
  const descricoes = new Map(gravadas)
  for (const oficial of oficiais) descricoes.set(oficial.codigo, descricaoParaOModelo(oficial.descricao))
  return descricoes
}
