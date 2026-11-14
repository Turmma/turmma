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
  /** A licença registrada que ele cita (ingestao-do-material, 6.0): vira material de terceiro, com um licenciante sintético. */
  readonly licencaId?: string
}

/**
 * Um material já enviado, gravado direto no banco, como a API o deixa em cada estado: atalho para o teste que não é
 * sobre enviar. O `pronto` ganha um trecho por página, com texto inventado.
 */
export function criarMaterialNoBanco(escolaId: string, disciplinaId: string, material: MaterialDeTeste): Promise<string> {
  return comBanco(async (banco) => {
    const paginas = material.estado === 'pronto' ? (material.paginas ?? 3) : null
    const { rows } = await banco.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, licenciante, licenca_id, declaracao, sha256, tamanho_bytes, paginas, estado, falha)
       values ($1, $2, $3, $8, $9, $10, $11, true, $4, 48000, $5, $6, $7) returning id`,
      [escolaId, disciplinaId, material.titulo, randomBytes(32).toString('hex'), paginas, material.estado, falhaDoMaterial(material), ...origemDoMaterial(material)],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou o material')
    for (let pagina = 1; pagina <= (paginas ?? 0); pagina += 1) {
      await banco.query('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, disciplinaId, id, pagina, `Texto sintético da página ${String(pagina)}.`])
    }
    return id
  })
}

/**
 * Muitos materiais `pronto` de uma vez, num `insert` só (ingestao-do-material, 7.0: "300 no seed"): a escola que já tem apostila de sobra, para a tela do envio e
 * a lista que cresce. Enviados há dois dias, fora da janela de uma hora dos tetos de envio (`ENVIOS_POR_ESCOLA_NA_JANELA`): são o acervo da escola, e o lote do caso não esbarra neles. Sem trechos: o caso é sobre a tela, e o hash de cada um é próprio, para o envio de verdade não esbarrar em nenhum.
 */
export function criarMateriaisNoBanco(escolaId: string, disciplinaId: string, quantos: number): Promise<void> {
  return comBanco(async (banco) => {
    await banco.query(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado, enviado_em)
       select $1::uuid, $2::uuid, 'Material sintético ' || g, 'escola', 'autoria_da_escola', true, encode(sha256(convert_to($1::text || '-' || g::text, 'UTF8')), 'hex'), 48000, 3, 'pronto', now() - interval '2 days'
         from generate_series(1, $3::int) as g`,
      [escolaId, disciplinaId, quantos],
    )
  })
}

/** A falha gravada: só o material que `falhou` a tem (o check do banco), com a que o caso pediu ou `sem_texto`. */
function falhaDoMaterial(material: MaterialDeTeste): string | null {
  return material.estado === 'falhou' ? (material.falha ?? 'sem_texto') : null
}

/** A titularidade, a licença e o licenciante: o da licença registrada é material de terceiro, e o resto é autoria da escola. */
function origemDoMaterial(material: MaterialDeTeste): [string, string, string | null, string | null] {
  if (material.licencaId === undefined) return ['escola', 'autoria_da_escola', null, null]
  return ['terceiro_com_licenca', 'licenca_comercial_autorizada', 'Editora sintética do teste', material.licencaId]
}

export interface LicencaDeTeste {
  readonly licenciante: string
  readonly cobertura?: string
  readonly referencia?: string
  /** O começo, em dias a partir de hoje no dia de São Paulo (negativo = no passado). */
  readonly desdeEmDias: number
  /** O fim, em dias a partir de hoje no dia de São Paulo; `null` = sem fim. */
  readonly ateEmDias: number | null
}

/**
 * Uma licença de material registrada direto no banco (ingestao-do-material, 6.0): as datas são relativas ao **dia de São Paulo**, que é o
 * dia por que a API calcula a situação, e por isso o caso não depende da hora em que roda. Devolve o id.
 */
export function criarLicencaNoBanco(escolaId: string, licenca: LicencaDeTeste): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>(
      `insert into licenca_de_material (escola_id, licenciante, cobertura, referencia, vigente_desde, vigente_ate)
       values ($1, $2, $3, $4,
               (now() at time zone 'America/Sao_Paulo')::date + $5::int,
               case when $6::int is null then null else (now() at time zone 'America/Sao_Paulo')::date + $6::int end)
       returning id`,
      [escolaId, licenca.licenciante, licenca.cobertura ?? 'Coleção sintética do teste', licenca.referencia ?? 'Contrato sintético 001', licenca.desdeEmDias, licenca.ateEmDias],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou a licença')
    return id
  })
}

/** As licenças da escola como estão no banco: quantas, e o licenciante de cada uma. A ordem é a do `id`, que é UUID e não segue o registro: quem compara mais de uma licença ordena antes. */
export function licencasNoBanco(escolaId: string): Promise<Array<{ id: string; licenciante: string; vigenteDesde: string; vigenteAte: string | null }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; licenciante: string; vigente_desde: string; vigente_ate: string | null }>(
      "select id, licenciante, to_char(vigente_desde, 'YYYY-MM-DD') as vigente_desde, to_char(vigente_ate, 'YYYY-MM-DD') as vigente_ate from licenca_de_material where escola_id = $1 order by id",
      [escolaId],
    )
    return rows.map((linha) => ({ id: linha.id, licenciante: linha.licenciante, vigenteDesde: linha.vigente_desde, vigenteAte: linha.vigente_ate }))
  })
}

/**
 * A troca de edição como a extração a deixa (ingestao-do-material, 10.0): a antiga ganha o rótulo `edicaoAntiga`, sai da busca
 * (`excluido_em`) e aponta a nova (`substituido_por`); a nova nasce `pronto`, herda título e disciplina, sem séries (o caso é sobre a
 * citação, e não sobre a busca) e leva o rótulo `edicaoNova`. Devolve o id da nova. A troca de verdade, com o PDF e o worker,
 * passa de 15 s e tem o caso dela na integração (`artefato.int.test.ts`).
 */
export function substituirMaterialNoBanco(escolaId: string, antigoId: string, edicaoAntiga: string, edicaoNova: string): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado, edicao, substitui_id)
       select escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, $4, tamanho_bytes, paginas, 'pronto', $3, id from material where escola_id = $1 and id = $2 returning id`,
      [escolaId, antigoId, edicaoNova, randomBytes(32).toString('hex')],
    )
    const novoId = rows[0]?.id
    if (novoId === undefined) throw new Error('o seed do e2e não criou a edição nova')
    await banco.query('update material set edicao = $3, excluido_em = now(), substituido_por = $4 where escola_id = $1 and id = $2', [escolaId, antigoId, edicaoAntiga, novoId])
    return novoId
  })
}
