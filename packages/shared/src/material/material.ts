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

const declaracao = z.union([z.boolean(), z.enum(['true', 'false']).transform((valor) => valor === 'true')])

/**
 * Os campos de `POST /v1/materiais` (multipart, além do `arquivo`): título, disciplina, titularidade, licença e a
 * declaração de que a escola pode usar o material. `licenciante` é o nome do dono do direito e só existe, obrigatório,
 * quando o material é de terceiro. `declaracao` chega como texto no multipart (`true` ou `false`). Estrito.
 *
 * O schema aceita `sem_licenca` e `declaracao=false`: quem recusa é `motivoDaRecusaDoMaterial`, com `MATERIAL_SEM_LICENCA`
 * e registro em auditoria, e não um `ENTRADA_INVALIDA` que não deixaria rastro.
 */
export const enviarMaterialRequestSchema = z
  .strictObject({
    titulo: z.string().trim().min(1).max(TAMANHO_MAXIMO_TITULO_DO_MATERIAL),
    disciplinaId: z.uuid(),
    titularidade: z.enum(TITULARIDADES_DE_MATERIAL),
    licenciante: z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_LICENCIANTE).optional(),
    licenca: z.enum(LICENCAS_DECLARAVEIS),
    declaracao,
  })
  .refine((pedido) => (pedido.titularidade === 'terceiro_com_licenca') === (pedido.licenciante !== undefined), { path: ['licenciante'], message: 'licenciante só com material de terceiro' })
export type EnviarMaterialRequest = z.infer<typeof enviarMaterialRequestSchema>

export const MOTIVOS_DA_RECUSA_DO_MATERIAL = ['sem_licenca', 'sem_declaracao'] as const
export type MotivoDaRecusaDoMaterial = (typeof MOTIVOS_DA_RECUSA_DO_MATERIAL)[number]

/**
 * Por que o material é recusado, ou `null` quando entra (D5, D75). A API chama isto **antes** de abrir o arquivo, e a
 * tela, antes de enviar: a regra é uma só. Sem licença válida ou sem a declaração marcada, nada é extraído nem gravado.
 */
export function motivoDaRecusaDoMaterial(pedido: { readonly licenca: LicencaDeclarada; readonly declaracao: boolean }): MotivoDaRecusaDoMaterial | null {
  if (pedido.licenca === SEM_LICENCA) return 'sem_licenca'
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
  licenca: z.enum(LICENCAS_DE_MATERIAL),
  estado: z.enum(ESTADOS_DE_MATERIAL),
  falha: z.enum(FALHAS_DE_MATERIAL).nullable(),
  /** Páginas do PDF, nulo enquanto processa. */
  paginas: z.number().int().min(1).nullable(),
  /** Páginas com texto que viraram trecho e entram na busca. */
  trechos: z.number().int().nonnegative(),
  enviadoEm: z.iso.datetime(),
})
export type Material = z.infer<typeof materialSchema>

/** Resposta de `POST /v1/materiais` (201) e de `GET /v1/materiais/:id`. `DELETE /v1/materiais/:id` responde 204, sem corpo. */
export const materialResponseSchema = materialSchema
export type MaterialResponse = Material

/**
 * Consulta de `GET /v1/materiais`: a página e, se quiser, a disciplina. A coordenação lê os da escola; o professor, só
 * os das disciplinas em que tem vínculo confirmado, com ou sem o filtro. Só os não excluídos.
 */
export const materiaisQuerySchema = paginationQuerySchema.extend({ disciplinaId: z.uuid().optional() }).strict()
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
