import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'

/**
 * O material da escola no e2e (MVP, A2): o PDF de demonstração, que é o arquivo de verdade que a tela sobe, e o que o
 * teste lê e grava direto no Postgres do compose de teste. Tudo sintético (regra 20, item 17).
 */

/** O PDF de demonstração commitado: seis páginas de "Química 2 — Capítulo 7: Estequiometria", texto original nosso. */
export const CAMINHO_DO_PDF_DE_DEMONSTRACAO = fileURLToPath(new URL('../../tools/demonstracao/quimica-2-cap-7-estequiometria.pdf', import.meta.url))

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

export interface MaterialNoBanco {
  readonly id: string
  readonly titulo: string
  readonly estado: string
  readonly paginas: number | null
  readonly excluido: boolean
  readonly trechos: number
}

/** Os materiais da escola como estão no banco, com os excluídos, em ordem de envio, e quantos trechos cada um tem. */
export function materiaisNoBanco(escolaId: string): Promise<MaterialNoBanco[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<MaterialNoBanco>(
      `select m.id, m.titulo, m.estado, m.paginas, m.excluido_em is not null as excluido,
              (select count(*)::int from trecho t where t.escola_id = m.escola_id and t.material_id = m.id) as trechos
         from material m where m.escola_id = $1 order by m.id`,
      [escolaId],
    )
    return rows
  })
}

/** As recusas por licença que a auditoria da escola guarda: o motivo e o que foi declarado, sem o título. */
export function recusasNaAuditoria(escolaId: string): Promise<Array<{ motivo: string; licenca: string; declaracao: boolean }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ depois: { motivo: string; licenca: string; declaracao: boolean } }>("select depois from auditoria where escola_id = $1 and acao = 'material.recusado' order by em, id", [escolaId])
    return rows.map(({ depois }) => ({ motivo: depois.motivo, licenca: depois.licenca, declaracao: depois.declaracao }))
  })
}

export interface MaterialDeTeste {
  readonly titulo: string
  readonly estado: 'pronto' | 'processando' | 'falhou'
  readonly falha?: 'arquivo_invalido' | 'sem_texto' | 'extracao_falhou'
  /** Páginas do material `pronto`; cada uma ganha um trecho. */
  readonly paginas?: number
}

/**
 * Um material já enviado, gravado direto no banco, como a API o deixa em cada estado: atalho para o teste que não é
 * sobre enviar. O `pronto` ganha um trecho por página, com texto inventado.
 */
export function criarMaterialNoBanco(escolaId: string, disciplinaId: string, material: MaterialDeTeste): Promise<string> {
  return comBanco(async (banco) => {
    const paginas = material.estado === 'pronto' ? (material.paginas ?? 3) : null
    const { rows } = await banco.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado, falha)
       values ($1, $2, $3, 'escola', 'autoria_da_escola', true, $4, 48000, $5, $6, $7) returning id`,
      [escolaId, disciplinaId, material.titulo, randomBytes(32).toString('hex'), paginas, material.estado, material.estado === 'falhou' ? (material.falha ?? 'sem_texto') : null],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou o material')
    for (let pagina = 1; pagina <= (paginas ?? 0); pagina += 1) {
      await banco.query('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, disciplinaId, id, pagina, `Texto sintético da página ${String(pagina)}.`])
    }
    return id
  })
}
