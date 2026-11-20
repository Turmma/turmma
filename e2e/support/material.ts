import { randomBytes, randomUUID } from 'node:crypto'
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
  /** A licença registrada que ele cita (ingestao-do-material, 6.0): vira material de terceiro (o licenciante é o dela). */
  readonly licencaId?: string
  /** O texto de cada página, na ordem (classificacao-bncc, 12.0): a geração de verdade tira as questões de frases definitórias, e o texto de enchimento não dá nenhuma. Sem ele, o texto de enchimento. */
  readonly textos?: readonly string[]
}

/**
 * Um material já enviado, gravado direto no banco, como a API o deixa em cada estado: atalho para o teste que não é
 * sobre enviar. O `pronto` ganha um trecho por página, com texto inventado.
 */
export function criarMaterialNoBanco(escolaId: string, disciplinaId: string, material: MaterialDeTeste): Promise<string> {
  return comBanco(async (banco) => {
    const paginas = material.estado === 'pronto' ? (material.paginas ?? 3) : null
    const { rows } = await banco.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, licenca_id, declaracao, sha256, tamanho_bytes, paginas, estado, falha)
       values ($1, $2, $3, $8, $9, $10, true, $4, 48000, $5, $6, $7) returning id`,
      [escolaId, disciplinaId, material.titulo, randomBytes(32).toString('hex'), paginas, material.estado, falhaDoMaterial(material), ...origemDoMaterial(material)],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou o material')
    for (let pagina = 1; pagina <= (paginas ?? 0); pagina += 1) {
      await banco.query('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, disciplinaId, id, pagina, material.textos?.[pagina - 1] ?? `Texto sintético da página ${String(pagina)}.`])
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

/** Dá ao material todas as séries da escola, como o envio com séries declaradas deixa: sem isso o material do seed fica "sem série" (ingestao-do-material, 11.0). */
export function vincularMaterialAsSeriesNoBanco(escolaId: string, materialId: string): Promise<void> {
  return comBanco(async (banco) => {
    await banco.query('insert into material_serie (escola_id, material_id, serie_id) select escola_id, $2, id from serie where escola_id = $1', [escolaId, materialId])
  })
}

/** A falha gravada: só o material que `falhou` a tem (o check do banco), com a que o caso pediu ou `sem_texto`. */
function falhaDoMaterial(material: MaterialDeTeste): string | null {
  return material.estado === 'falhou' ? (material.falha ?? 'sem_texto') : null
}

/** A titularidade, a licença de uso e a licença registrada: o que cita a licença registrada é material de terceiro, e o resto é autoria da escola. */
function origemDoMaterial(material: MaterialDeTeste): [string, string, string | null] {
  if (material.licencaId === undefined) return ['escola', 'autoria_da_escola', null]
  return ['terceiro_com_licenca', 'licenca_comercial_autorizada', material.licencaId]
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

/** Os capítulos que a extração deixaria no material (ingestao-do-material, 12.0): o painel os lê de `GET /v1/materiais/:id`. Número nulo é o capítulo que o PDF não numera. */
export function criarCapitulosNoBanco(escolaId: string, materialId: string, capitulos: ReadonlyArray<{ readonly numero: number | null; readonly titulo: string; readonly paginaInicial: number; readonly paginaFinal: number }>): Promise<void> {
  return comBanco(async (banco) => {
    for (const [indice, capitulo] of capitulos.entries()) {
      await banco.query('insert into capitulo_do_material (escola_id, material_id, ordem, numero, titulo, pagina_inicial, pagina_final) values ($1, $2, $3, $4, $5, $6, $7)', [
        escolaId,
        materialId,
        indice + 1,
        capitulo.numero,
        capitulo.titulo,
        capitulo.paginaInicial,
        capitulo.paginaFinal,
      ])
    }
  })
}

/** Dá ao material **só** a série do ano dado (Ensino Fundamental), que a escola precisa ter (`criarTodasAsSeriesNoBanco`). */
export function vincularMaterialAUmaSerieNoBanco(escolaId: string, materialId: string, ano: number): Promise<void> {
  return comBanco(async (banco) => {
    await banco.query("insert into material_serie (escola_id, material_id, serie_id) select escola_id, $2, id from serie where escola_id = $1 and etapa = 'ef_anos_finais' and ano = $3", [escolaId, materialId, ano])
  })
}

/** As séries do material no banco, como `etapa:ano`, em ordem: o que a busca usa para achá-lo. */
export function seriesDoMaterialNoBanco(escolaId: string, materialId: string): Promise<string[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ serie: string }>(
      'select s.etapa || \':\' || s.ano as serie from material_serie ms join serie s on s.escola_id = ms.escola_id and s.id = ms.serie_id where ms.escola_id = $1 and ms.material_id = $2 order by s.etapa, s.ano',
      [escolaId, materialId],
    )
    return rows.map((linha) => linha.serie)
  })
}

/** As edições que substituem o material, com o estado e o rótulo: o que o "Enviar edição nova" deixou no banco. */
export function edicoesDoMaterialNoBanco(escolaId: string, alvoId: string): Promise<Array<{ id: string; titulo: string; estado: string; edicao: string | null }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; titulo: string; estado: string; edicao: string | null }>('select id, titulo, estado, edicao from material where escola_id = $1 and substitui_id = $2 order by id', [escolaId, alvoId])
    return rows
  })
}

/** O título do material no banco: o que o `PATCH` gravou. */
export function tituloDoMaterialNoBanco(escolaId: string, materialId: string): Promise<string | undefined> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ titulo: string }>('select titulo from material where escola_id = $1 and id = $2', [escolaId, materialId])
    return rows[0]?.titulo
  })
}

/** Uma edição que ainda está sendo lida sobre o material, como o envio da edição a deixa (`processando`, `substitui_id` no alvo): o painel do alvo e o da edição não se corrigem enquanto ela existe. Devolve o id dela. */
export function criarEdicaoEmLeituraNoBanco(escolaId: string, alvoId: string, titulo: string): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado, substitui_id)
       select escola_id, disciplina_id, $3, titularidade, licenca, declaracao, $4, tamanho_bytes, null, 'processando', id from material where escola_id = $1 and id = $2 returning id`,
      [escolaId, alvoId, titulo, randomBytes(32).toString('hex')],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou a edição em leitura')
    return id
  })
}

/** Em que ponto está a classificação de uma seção do seed: sem execução, ou com a execução no estado que a situação pede (a `aguardando` não entra: o worker do ambiente a levaria). */
export type SituacaoDaSecaoDeTeste = 'nao_agendada' | 'classificada' | 'sem_habilidade' | 'nao_classificada'

export interface SecaoDeTeste {
  readonly paginaInicial: number
  readonly paginaFinal: number
  /** A ordem do capítulo de `criarCapitulosNoBanco` a que a seção pertence; sem ela, é um bloco de páginas. */
  readonly capituloOrdem?: number
  readonly situacao: SituacaoDaSecaoDeTeste
  readonly habilidades?: ReadonlyArray<{ readonly codigo: string; readonly origem: 'ia' | 'coordenacao' }>
  /** A coordenação a corrigiu (`corrigida_em`, sem autor). */
  readonly corrigida?: boolean
}

/**
 * As seções que a extração e a classificação da noite deixariam no material (classificacao-bncc, 8.0): uma por item, na ordem dada, cada uma com a execução que a situação pede e as habilidades com a origem. O painel as lê de
 * `GET /v1/materiais/:id`. Devolve os ids, na ordem. Habilidade de código que a tabela pública não tem é recusada pelo banco (FK).
 */
export function criarSecoesNoBanco(escolaId: string, materialId: string, secoes: readonly SecaoDeTeste[]): Promise<string[]> {
  return comBanco(async (banco) => {
    const ids: string[] = []
    for (const [indice, item] of secoes.entries()) {
      const capituloId = await capituloDaSecaoNoBanco(banco, escolaId, materialId, item.capituloOrdem)
      const execucaoId = await execucaoDaSecaoNoBanco(banco, escolaId, item.situacao)
      const { rows } = await banco.query<{ id: string }>(
        `insert into secao_do_material (escola_id, material_id, capitulo_id, ordem, pagina_inicial, pagina_final, execucao_id, classificada_em, corrigida_em)
         values ($1, $2, $3, $4::smallint, $5, $6, $7, case when $8::boolean then now() end, case when $9::boolean then now() end) returning id`,
        [escolaId, materialId, capituloId, indice + 1, item.paginaInicial, item.paginaFinal, execucaoId, item.situacao === 'classificada' || item.situacao === 'sem_habilidade', item.corrigida === true],
      )
      const id = rows[0]?.id
      if (id === undefined) throw new Error('o seed do e2e não criou a seção')
      for (const habilidade of item.habilidades ?? []) await banco.query('insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, $4)', [escolaId, id, habilidade.codigo, habilidade.origem])
      ids.push(id)
    }
    return ids
  })
}

/** O capítulo de `criarCapitulosNoBanco` de que a seção faz parte, pela ordem; sem ordem, a seção é um bloco de páginas. */
async function capituloDaSecaoNoBanco(banco: Client, escolaId: string, materialId: string, ordem: number | undefined): Promise<string | null> {
  if (ordem === undefined) return null
  const { rows } = await banco.query<{ id: string }>('select id from capitulo_do_material where escola_id = $1 and material_id = $2 and ordem = $3', [escolaId, materialId, ordem])
  return rows[0]?.id ?? null
}

/** A execução que a situação pede: nenhuma na `nao_agendada`, a que falhou na `nao_classificada` e a concluída nas outras. */
async function execucaoDaSecaoNoBanco(banco: Client, escolaId: string, situacao: SituacaoDaSecaoDeTeste): Promise<string | null> {
  if (situacao === 'nao_agendada') return null
  const estado = situacao === 'nao_classificada' ? 'falhou' : 'concluida'
  const { rows } = await banco.query<{ id: string }>(
    `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada, estado, erro, resultado, iniciada_em, concluida_em)
     values ($1, null, 'classificacao_do_material', 'classificar_secoes', null, $2, '{"tarefa":"classificar_secoes"}'::jsonb, $3::text, $4,
             case when $3::text = 'concluida' then '{"tipo":"classificacao_do_material","secoes":1}'::jsonb end, now(), now()) returning id`,
    [escolaId, randomUUID(), estado, estado === 'falhou' ? 'IA_SAIDA_INVALIDA' : null],
  )
  return rows[0]?.id ?? null
}

/** As habilidades que o recorte aceita (o componente e o ano do Ensino Fundamental), em ordem de código, como a tabela pública da BNCC as tem: o seed e a conferência do e2e. */
export function habilidadesDoRecorteNoBanco(componente: string, ano: number): Promise<Array<{ codigo: string; descricao: string }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ codigo: string; descricao: string }>('select codigo, descricao from habilidade_bncc where componente = $1 and $2::smallint = any(anos) order by codigo', [componente, ano])
    return rows
  })
}

/** O componente da BNCC da disciplina, direto no banco (a migration só o preenche pelo nome, e a disciplina do seed tem nome com marca). `null` apaga. */
export function definirComponenteNoBanco(escolaId: string, disciplinaId: string, componente: string | null): Promise<void> {
  return comBanco(async (banco) => {
    await banco.query('update disciplina set componente_bncc = $3 where escola_id = $1 and id = $2', [escolaId, disciplinaId, componente])
  })
}

export interface SecaoNoBanco {
  readonly ordem: number
  readonly corrigida: boolean
  readonly habilidades: ReadonlyArray<{ readonly codigo: string; readonly origem: string }>
}

/** As seções do material como estão no banco, em ordem, com a marca de corrigida e as habilidades (código e origem): o que a correção gravou. */
export function secoesNoBanco(escolaId: string, materialId: string): Promise<SecaoNoBanco[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ ordem: number; corrigida: boolean; habilidades: Array<{ codigo: string; origem: string }> }>(
      `select s.ordem, s.corrigida_em is not null as corrigida,
              coalesce((select json_agg(json_build_object('codigo', h.codigo, 'origem', h.origem) order by h.codigo) from habilidade_da_secao h where h.escola_id = s.escola_id and h.secao_id = s.id), '[]'::json) as habilidades
         from secao_do_material s where s.escola_id = $1 and s.material_id = $2 order by s.ordem`,
      [escolaId, materialId],
    )
    return rows
  })
}

/**
 * Uma correção que outra pessoa fez por fora da tela: troca as habilidades da seção por estas, com a origem da coordenação, e a marca de corrigida. Só simula, no seed do e2e, o que o `PUT` faria por outra aba:
 * grava direto no banco, sem a auditoria do caminho do produto (regra 20, item 10), e não é exemplo para código de verdade.
 */
export function corrigirSecaoNoBanco(escolaId: string, secaoId: string, codigos: readonly string[]): Promise<void> {
  return comBanco(async (banco) => {
    await banco.query('delete from habilidade_da_secao where escola_id = $1 and secao_id = $2', [escolaId, secaoId])
    for (const codigo of codigos) await banco.query("insert into habilidade_da_secao (escola_id, secao_id, codigo, origem) values ($1, $2, $3, 'coordenacao')", [escolaId, secaoId, codigo])
    await banco.query('update secao_do_material set corrigida_em = now() where escola_id = $1 and id = $2', [escolaId, secaoId])
  })
}

/** Quantas execuções da classificação a escola tem: o "Reclassificar" de verdade cria as da noite. */
export function execucoesDaClassificacaoNoBanco(escolaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from execucao_agente where escola_id = $1 and tarefa = 'classificar_secoes'", [escolaId])
    return rows[0]?.n ?? 0
  })
}
