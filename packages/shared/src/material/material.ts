import { z } from 'zod'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'

/**
 * O material da escola (MVP, A2; D5, D22, D75): a coordenação sobe o PDF com a titularidade e a licença declaradas, e o
 * professor e o Assistente só leem. O arquivo não é guardado: ficam os metadados aqui e o texto por página em `trecho`
 * (`docs/mvp-rapido.md`, seção 4, item 3). Nada de escola vem do cliente.
 */

/** De quem é o material (D75): quem sobe é sempre a coordenação; isto diz o dono. O check `material_titularidade_valida` repete a lista. */
export const TITULARIDADES_DE_MATERIAL = ['escola', 'professor', 'terceiro_com_licenca', 'dominio_publico'] as const
export type TitularidadeDeMaterial = (typeof TITULARIDADES_DE_MATERIAL)[number]

export const NOME_DA_TITULARIDADE: Readonly<Record<TitularidadeDeMaterial, string>> = {
  escola: 'Material próprio da escola',
  professor: 'Material de autoria de professor da escola',
  terceiro_com_licenca: 'Material de terceiro, com licença',
  dominio_publico: 'Domínio público',
}

/** As licenças com que um material entra (D5). O check `material_licenca_valida` repete a lista. */
export const LICENCAS_DE_MATERIAL = ['dominio_publico', 'autoria_da_escola', 'licenca_aberta', 'licenca_comercial_autorizada'] as const
export type LicencaDeMaterial = (typeof LICENCAS_DE_MATERIAL)[number]

export const NOME_DA_LICENCA: Readonly<Record<LicencaDeMaterial, string>> = {
  dominio_publico: 'Domínio público',
  autoria_da_escola: 'Autoria da escola ou de professor dela',
  licenca_aberta: 'Licença aberta (Creative Commons e semelhantes)',
  licenca_comercial_autorizada: 'Licença comercial que autoriza este uso',
}

/** O que o formulário manda quando a coordenação não tem a licença: é recusado antes de abrir o arquivo, e nunca é gravado. */
export const SEM_LICENCA = 'sem_licenca'
export const LICENCAS_DECLARAVEIS = [...LICENCAS_DE_MATERIAL, SEM_LICENCA] as const
export type LicencaDeclarada = (typeof LICENCAS_DECLARAVEIS)[number]

/** `processando` até o texto de todas as páginas estar em `trecho`; `falhou` leva o código da falha. */
export const ESTADOS_DE_MATERIAL = ['processando', 'pronto', 'falhou'] as const
export type EstadoDeMaterial = (typeof ESTADOS_DE_MATERIAL)[number]

/** Por que a extração falhou: código fixo, nunca a mensagem da biblioteca de PDF. */
export const FALHAS_DE_MATERIAL = ['arquivo_invalido', 'sem_texto', 'extracao_falhou'] as const
export type FalhaDeMaterial = (typeof FALHAS_DE_MATERIAL)[number]

export const MENSAGEM_DA_FALHA_DE_MATERIAL: Readonly<Record<FalhaDeMaterial, string>> = {
  arquivo_invalido: 'O arquivo não é um PDF que conseguimos abrir. Confira o arquivo e envie de novo.',
  sem_texto: 'O PDF não tem texto para ler: parece ser só imagem. Envie a versão com texto.',
  extracao_falhou: 'Não foi possível ler o material agora. Envie de novo em instantes.',
}

/** O maior PDF aceito (regra 80, item 3): 20 MB, um arquivo por envio. */
export const MAXIMO_DE_BYTES_DO_MATERIAL = 20 * 1024 * 1024
export const TAMANHO_MAXIMO_TITULO_DO_MATERIAL = 160
export const TAMANHO_MAXIMO_DO_LICENCIANTE = 120
/** O rótulo da edição ("2025", "3ª edição"): o check `material_edicao_preenchida` repete o teto. */
export const TAMANHO_MAXIMO_DA_EDICAO = 60
/** As séries que um material pode declarar: as sete do recorte (6º ao 9º ano e 1º ao 3º do EM; D43). A tabela `material_serie` não admite mais que isso. */
export const MAXIMO_DE_SERIES_DO_MATERIAL = 7
/** Quantos PDFs a tela envia de uma vez, um por vez (RF14): o 21º é recusado antes de enviar. */
export const MAXIMO_DE_PDFS_POR_LOTE = 20

const declaracao = z.union([z.boolean(), z.enum(['true', 'false']).transform((valor) => valor === 'true')])

/**
 * As séries do envio. No multipart a lista chega como o campo `serieIds` repetido: com um só valor o recebimento entrega texto, não lista, e aqui vira lista de um.
 * De 1 a 7, sem repetir (a tabela `material_serie` tem a chave `(escola_id, material_id, serie_id)`): sem série, ou com a mesma duas vezes, é `ENTRADA_INVALIDA`, nunca 500.
 */
const serieIds = z.preprocess(
  (valor) => (typeof valor === 'string' ? [valor] : valor),
  z
    .array(z.uuid())
    .min(1)
    .max(MAXIMO_DE_SERIES_DO_MATERIAL)
    .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, { message: 'série repetida' }),
)

/**
 * Os campos de `POST /v1/materiais` (multipart, além do `arquivo`): título, disciplina, séries, titularidade, licença de uso e a
 * declaração de que a escola pode usar o material. `licencaId` é a licença **registrada** (`licenca_de_material`) do material de terceiro, e só existe nele: o dono do direito
 * (`licenciante`) vem da licença, nunca do pedido (ingestao-do-material, 7.0; RF3 e RF16). `declaracao` chega como texto no multipart (`true` ou `false`). Estrito.
 *
 * O schema aceita o terceiro sem `licencaId`, `sem_licenca` e `declaracao=false`: quem recusa é `motivoDaRecusaDoMaterial`, com `MATERIAL_SEM_LICENCA`
 * e registro em auditoria, e não um `ENTRADA_INVALIDA` que não deixaria rastro. O que o schema recusa é `licencaId` em material que não é de terceiro.
 */
export const enviarMaterialRequestSchema = z
  .strictObject({
    titulo: z.string().trim().min(1).max(TAMANHO_MAXIMO_TITULO_DO_MATERIAL),
    disciplinaId: z.uuid(),
    serieIds,
    titularidade: z.enum(TITULARIDADES_DE_MATERIAL),
    licencaId: z.uuid().optional(),
    licenca: z.enum(LICENCAS_DECLARAVEIS),
    declaracao,
  })
  .refine((pedido) => pedido.licencaId === undefined || pedido.titularidade === 'terceiro_com_licenca', { path: ['licencaId'], message: 'licença registrada só com material de terceiro' })
export type EnviarMaterialRequest = z.infer<typeof enviarMaterialRequestSchema>

/**
 * Os campos de `POST /v1/materiais/:id/edicoes` (multipart, além do `arquivo`; ingestao-do-material, 8.0; RF10): o rótulo da edição e, se a coordenação quiser, outro título. O resto (disciplina, séries,
 * titularidade, licença e declaração) a edição **herda** do material que substitui, lido na transação do envio: o pedido não traz nada disso, e campo a mais é `ENTRADA_INVALIDA`. Sem `titulo`, a edição leva o do alvo.
 */
export const enviarEdicaoRequestSchema = z.strictObject({
  edicao: z.string().trim().min(1).max(TAMANHO_MAXIMO_DA_EDICAO).optional(),
  titulo: z.string().trim().min(1).max(TAMANHO_MAXIMO_TITULO_DO_MATERIAL).optional(),
})
export type EnviarEdicaoRequest = z.infer<typeof enviarEdicaoRequestSchema>

export const MOTIVOS_DA_RECUSA_DO_MATERIAL = ['sem_licenca', 'sem_declaracao'] as const
export type MotivoDaRecusaDoMaterial = (typeof MOTIVOS_DA_RECUSA_DO_MATERIAL)[number]

/**
 * Os motivos com que o envio é recusado pela licença **registrada** do material de terceiro (ingestao-do-material, 7.0), e que entram na auditoria (`material.recusado`) ao lado dos de
 * `MOTIVOS_DA_RECUSA_DO_MATERIAL`: `licenca_vencida` (a data da licença não vale hoje; resposta `LICENCA_VENCIDA`) e `licenca_inexistente` (não é da escola, ou não existe: a resposta é a mesma
 * `NAO_ENCONTRADO` das duas, e a auditoria também não as distingue; regra 10, item 6). Ficam fora da lista dos outros porque quem os diz é a licença lida no banco, e não o pedido.
 */
export const MOTIVOS_DA_RECUSA_PELA_LICENCA_REGISTRADA = ['licenca_vencida', 'licenca_inexistente'] as const
export type MotivoDaRecusaPelaLicencaRegistrada = (typeof MOTIVOS_DA_RECUSA_PELA_LICENCA_REGISTRADA)[number]

/**
 * Por que o material é recusado, ou `null` quando entra (D5, D75). A API chama isto **antes** de abrir o arquivo, e a
 * tela, antes de enviar: a regra é uma só. Sem licença válida, sem a declaração marcada ou, no material de terceiro, sem a licença registrada
 * (`licencaId`), nada é extraído nem gravado. A tela passa só `licenca` e `declaracao`: o que ela deixa de escolher, ela já pede no formulário.
 */
export function motivoDaRecusaDoMaterial(pedido: {
  readonly licenca: LicencaDeclarada
  readonly declaracao: boolean
  readonly titularidade?: TitularidadeDeMaterial
  readonly licencaId?: string | undefined
}): MotivoDaRecusaDoMaterial | null {
  if (pedido.licenca === SEM_LICENCA) return 'sem_licenca'
  if (pedido.titularidade === 'terceiro_com_licenca' && pedido.licencaId === undefined) return 'sem_licenca'
  return pedido.declaracao ? null : 'sem_declaracao'
}

/**
 * Um material, como a coordenação e o professor o veem: metadados, estado e quantas páginas viraram trecho. Nunca o
 * texto, o hash do arquivo nem quem enviou (a autoria fica na auditoria, `material.enviado`).
 */
export const materialSchema = z.strictObject({
  id: z.uuid(),
  titulo: z.string().min(1),
  disciplinaId: z.uuid(),
  titularidade: z.enum(TITULARIDADES_DE_MATERIAL),
  licenciante: z.string().min(1).nullable(),
  /** A licença registrada do material de terceiro (`GET /v1/licencas`); nula no material que não é de terceiro. */
  licencaId: z.uuid().nullable(),
  licenca: z.enum(LICENCAS_DE_MATERIAL),
  /** O rótulo da edição que a coordenação deu ao enviá-la; nulo no material que não é edição, e na edição enviada sem rótulo. */
  edicao: z.string().min(1).max(TAMANHO_MAXIMO_DA_EDICAO).nullable(),
  /** O material que esta edição vai substituir (ou substituiu): nulo no material que não é edição, e na edição cuja anterior já saiu no expurgo. */
  substitui: z.uuid().nullable(),
  /** As séries declaradas, de 0 (a escola sem série na migração) a 7, em ordem de id. */
  serieIds: z.array(z.uuid()).max(MAXIMO_DE_SERIES_DO_MATERIAL),
  estado: z.enum(ESTADOS_DE_MATERIAL),
  falha: z.enum(FALHAS_DE_MATERIAL).nullable(),
  /** Páginas do PDF, nulo enquanto processa. */
  paginas: z.number().int().min(1).nullable(),
  /** Páginas com texto que viraram trecho e entram na busca. */
  trechos: z.number().int().nonnegative(),
  enviadoEm: z.iso.datetime(),
})
export type Material = z.infer<typeof materialSchema>

/** Resposta de `POST /v1/materiais` (201). `DELETE /v1/materiais/:id` responde 204, sem corpo. */
export const materialResponseSchema = materialSchema
export type MaterialResponse = Material

/** Quantos dias para trás o resumo conta os envios recusados (RF18): 30, a janela que a coordenação lê como "no último mês". */
export const DIAS_DAS_RECUSAS_NO_RESUMO = 30

/**
 * Os motivos de `material.recusado` que o resumo conta (RF18; Tech Spec, seção 4): os que a API respondeu `MATERIAL_SEM_LICENCA` (`sem_licenca` e `sem_declaracao`) e `LICENCA_VENCIDA`
 * (`licenca_vencida`). `licenca_inexistente` fica de fora: a resposta foi `NAO_ENCONTRADO`, igual à da licença de outra escola, e contá-la diria à coordenação que a escola B existe (regra 10, item 6).
 */
export const MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA: readonly (MotivoDaRecusaDoMaterial | MotivoDaRecusaPelaLicencaRegistrada)[] = ['sem_licenca', 'sem_declaracao', 'licenca_vencida']

const contagem = z.number().int().nonnegative()

/**
 * Uma linha do resumo do material: o que a escola tem de uma disciplina numa série (RF18). `serieId` nulo é a linha **sem série**, o material que a migração deixou sem nenhuma (a escola sem série
 * na época) e a recusa de edição sobre ele. O material com várias séries conta em cada uma delas. Só contagens: nunca título, quem enviou nem licenciante (regra 70, itens 7 e 9).
 */
export const linhaDoResumoDoMaterialSchema = z.strictObject({
  disciplinaId: z.uuid(),
  serieId: z.uuid().nullable(),
  pronto: contagem,
  processando: contagem,
  falhou: contagem,
  /** Os envios recusados por falta de licença, de declaração ou de vigência nos últimos `DIAS_DAS_RECUSAS_NO_RESUMO` dias, na série que a recusa conferiu. */
  recusados30Dias: contagem,
})
export type ResumoDoMaterialRow = z.infer<typeof linhaDoResumoDoMaterialSchema>

/**
 * Resposta de `GET /v1/materiais/resumo` (só a coordenação): uma linha por disciplina e série que tem material ou recusa, e quantos materiais da escola estão sem série (excluído e substituído não contam).
 * Não tem página: é um agregado do tamanho das disciplinas da escola vezes as sete séries.
 */
export const resumoDoMaterialResponseSchema = z.strictObject({
  linhas: z.array(linhaDoResumoDoMaterialSchema),
  semSerie: contagem,
})
export type ResumoDoMaterialResponse = z.infer<typeof resumoDoMaterialResponseSchema>

/** O teto do título de um capítulo: a coluna `capitulo_do_material.titulo` (check `capitulo_do_material_titulo_preenchido`) e o corte do leitor. */
export const TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO = 200

/**
 * Um capítulo que a extração leu do PDF (ingestao-do-material, 4.0; RF4): a posição no material (a partir de 1), o número que o PDF escreve (nulo quando
 * não há ou não cabe em `int`), o título e a faixa de páginas, de 1 em diante. Só o que o painel mostra: nunca o texto das páginas.
 */
export const capituloDoMaterialSchema = z.strictObject({
  ordem: z.number().int().min(1),
  numero: z.number().int().nonnegative().nullable(),
  titulo: z.string().min(1).max(TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO),
  paginaInicial: z.number().int().min(1),
  paginaFinal: z.number().int().min(1),
})
export type CapituloDoMaterial = z.infer<typeof capituloDoMaterialSchema>

/** Resposta de `GET /v1/materiais/:id`: o material, mais os capítulos lidos do PDF em ordem. Vazio: o PDF sem capítulo, ou ainda `processando`. */
export const materialComCapitulosResponseSchema = materialSchema.extend({ capitulos: z.array(capituloDoMaterialSchema) })
export type MaterialComCapitulosResponse = z.infer<typeof materialComCapitulosResponseSchema>

/**
 * Consulta de `GET /v1/materiais`: a página e, se quiser, a disciplina e a série. A coordenação lê os da escola; o professor, só
 * os das disciplinas em que tem vínculo confirmado, com ou sem o filtro. Só os não excluídos.
 */
export const materiaisQuerySchema = paginationQuerySchema.extend({ disciplinaId: z.uuid().optional(), serieId: z.uuid().optional() }).strict()
export type MateriaisQuery = z.infer<typeof materiaisQuerySchema>

export const listaDeMateriaisResponseSchema = pageSchema(materialSchema)
export type ListaDeMateriaisResponse = z.infer<typeof listaDeMateriaisResponseSchema>

export const MAXIMO_DE_TRECHOS_NA_BUSCA = 20
export const TRECHOS_PADRAO_NA_BUSCA = 8
export const TAMANHO_MAXIMO_DA_BUSCA = 200
/** O pedaço da página que a busca devolve: o bastante para conferir de relance, nunca a página inteira. */
export const TAMANHO_MAXIMO_DO_TRECHO_CITADO = 400

/**
 * Consulta de `GET /v1/materiais/busca`: o texto procurado (`q`), a disciplina e quantos trechos. A busca é por texto
 * completo em português (`trecho.busca`), só em material `pronto` e não excluído, e sempre dentro da escola do contexto.
 */
export const buscaDeMaterialQuerySchema = z.strictObject({
  q: z.string().trim().min(2).max(TAMANHO_MAXIMO_DA_BUSCA),
  disciplinaId: z.uuid().optional(),
  /** Só o material declarado para a série. **Filtra, não autoriza**: a série de outra escola não casa com nenhum material desta, e responde como a que não existe. */
  serieId: z.uuid().optional(),
  limite: z.coerce.number().int().min(1).max(MAXIMO_DE_TRECHOS_NA_BUSCA).default(TRECHOS_PADRAO_NA_BUSCA),
})
export type BuscaDeMaterialQuery = z.infer<typeof buscaDeMaterialQuerySchema>

/** Um trecho achado: o material, o título dele, a página e um pedaço curto do texto. É a origem de toda citação (D6). */
export const trechoEncontradoSchema = z.strictObject({
  materialId: z.uuid(),
  titulo: z.string().min(1),
  pagina: z.number().int().min(1),
  trecho: z.string().min(1).max(TAMANHO_MAXIMO_DO_TRECHO_CITADO),
})
export type TrechoEncontrado = z.infer<typeof trechoEncontradoSchema>

/** Resposta de `GET /v1/materiais/busca`: os trechos por relevância. Sem página seguinte: é o topo da busca. */
export const buscaDeMaterialResponseSchema = z.strictObject({ itens: z.array(trechoEncontradoSchema).max(MAXIMO_DE_TRECHOS_NA_BUSCA) })
export type BuscaDeMaterialResponse = z.infer<typeof buscaDeMaterialResponseSchema>
