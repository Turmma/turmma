import { randomBytes } from 'node:crypto'
import type { SessaoFixtures } from './sessao.fixture.js'
import { PAGINAS_DO_MATERIAL, textoDaPagina } from '../../../tools/demonstracao/conteudo-estequiometria.ts'

type Pool = SessaoFixtures['pool']

export interface MaterialSemeado {
  /** As séries para as quais o material foi declarado (`material_serie`). */
  readonly serieIds: readonly string[]
  /** `terceiro_com_licenca` só vale com `licencaId`; o resto é do que a escola usa sem licença registrada. */
  readonly titularidade?: 'escola' | 'terceiro_com_licenca'
  readonly licencaId?: string
  readonly estado?: 'pronto' | 'processando'
  readonly titulo?: string
  /** O texto do material de demonstração (as seis páginas de estequiometria, com as definições que a geração de atividade e plano aproveita), em vez das duas frases curtas de `TEXTO_DA_PAGINA`. */
  readonly deDemonstracao?: boolean
  /** O material que esta edição substituiu: ela fica `excluida`, como a extração da nova a deixa. */
  readonly substituido?: boolean
}

/** As páginas do material semeado: a palavra procurada pelos casos está em todas, para a busca sempre ter o que achar. */
export const TEXTO_DA_PAGINA = (pagina: number): string => `Página ${String(pagina)}: o reagente limitante determina quanto produto se forma na estequiometria.`

/** A licença da escola, gravada direto (a rota real tem o seu teste em `licenca.int.test.ts`): o licenciante é fictício. `ate` nulo é a licença sem fim. */
export async function semearLicenca(pool: Pool, escolaId: string, registradaPor: string, { desde, ate = null }: { readonly desde: string; readonly ate?: string | null }): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate, registrada_por)
     values ($1, 'Editora sintética', 'Apostilas sintéticas de teste', 'contrato sintético 9', $2, $3, $4) returning id`,
    [escolaId, desde, ate, registradaPor],
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('licença de teste não gravada')
  return id
}

/** Quantas páginas de texto o material tem: nenhuma enquanto processa, as seis da demonstração ou as duas curtas. */
function paginasDe({ estado = 'pronto', deDemonstracao = false }: MaterialSemeado): number {
  if (estado !== 'pronto') return 0
  return deDemonstracao ? PAGINAS_DO_MATERIAL.length : 2
}

/** As colunas do material que o filtro lê, na ordem do `insert` de `semearMaterial`, depois de aplicados os padrões. */
function colunasDoMaterial(escolaId: string, disciplinaId: string, enviadoPor: string, opcoes: MaterialSemeado): { valores: unknown[]; paginas: number } {
  const { titularidade = 'escola', licencaId = null, estado = 'pronto', titulo = 'Material sintético da série', substituido = false } = opcoes
  const terceiro = titularidade === 'terceiro_com_licenca'
  const paginas = paginasDe(opcoes)
  const valores = [escolaId, disciplinaId, titulo, titularidade, terceiro ? 'Editora sintética' : null, terceiro ? 'licenca_comercial_autorizada' : 'autoria_da_escola', licencaId, randomBytes(32).toString('hex'), paginas === 0 ? null : paginas, estado, enviadoPor, substituido]
  return { valores, paginas }
}

/** Um material com duas páginas de texto, declarado para as séries pedidas, gravado direto no banco: os casos de série e de licença controlam cada coluna que o filtro lê. */
export async function semearMaterial(pool: Pool, escolaId: string, disciplinaId: string, enviadoPor: string, opcoes: MaterialSemeado): Promise<string> {
  const { valores, paginas } = colunasDoMaterial(escolaId, disciplinaId, enviadoPor, opcoes)
  const { rows } = await pool.query<{ id: string }>(
    `insert into material (escola_id, disciplina_id, titulo, titularidade, licenciante, licenca, licenca_id, declaracao, sha256, tamanho_bytes, paginas, estado, enviado_por, excluido_em)
     values ($1, $2, $3, $4, $5, $6, $7, true, $8, 10, $9, $10, $11, case when $12::boolean then now() end) returning id`,
    valores,
  )
  const id = rows[0]?.id
  if (id === undefined) throw new Error('material de teste não gravado')
  for (const serieId of opcoes.serieIds) await pool.query('insert into material_serie (escola_id, material_id, serie_id) values ($1, $2, $3)', [escolaId, id, serieId])
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    await pool.query('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, disciplinaId, id, pagina, (opcoes.deDemonstracao === true ? textoDaPagina(pagina) : TEXTO_DA_PAGINA(pagina))])
  }
  return id
}
