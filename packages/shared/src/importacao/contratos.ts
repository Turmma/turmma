import { z } from 'zod'

/**
 * Os contratos das planilhas do F2 (Tech Spec, seções 3 e 4; PRD, RF2 a RF10): o que a prévia recebe e devolve, o que gravar
 * recebe e responde, e o estado de uma importação. O navegador lê o CSV ou a primeira aba do XLSX e manda **texto** (como na A1):
 * o arquivo em si nunca chega ao servidor (`docs/lgpd.md`, "Planilha em gravação").
 */

/**
 * As quatro planilhas (PRD, RF1). O check `importacao_planilha_tipo_valido` do banco repete esta lista. Nenhuma traz nota: acrescentar um
 * tipo com nota ("notas do bimestre" vindas de outro sistema) reabre a regra 70, item 1: a nota só nasce pela construção de `Nota`, com
 * `lancadaPor` humano, e o tipo ganha teste próprio.
 */
// Nenhum tipo grava nota. Se um dia houver planilha de notas, ela reabre a regra 70, item 1: a importação em lote precisa gravar
// `lancadaPor` com autor humano e passar pela validação registrada da D56. Não entra por aqui sem esse desenho.
export const TIPOS_DE_PLANILHA = ['alunos', 'professores', 'grade', 'calendario'] as const
export type TipoDePlanilha = (typeof TIPOS_DE_PLANILHA)[number]

/** Onde a importação está (Tech Spec, seção 5, tabela de estados). Casa com o check `importacao_planilha_estado_valido`. */
export const ESTADOS_DA_IMPORTACAO = ['na_fila', 'concluida', 'desatualizada', 'falhou'] as const
export type EstadoDaImportacao = (typeof ESTADOS_DA_IMPORTACAO)[number]

/**
 * Por que uma importação `falhou`, em lista fechada (nunca texto: o erro do Postgres traz o valor da linha, que é nome ou
 * matrícula). `expirou`: ficou mais de 1 h na fila e foi fechada pelo gravar seguinte ou pelo expurgo; `trava_esgotada`: a
 * trava ou o deadlock persistiu em todas as tentativas; `erro_interno`: qualquer outra falha definitiva. Casa com o check
 * `importacao_planilha_erro_valido`.
 */
export const ERROS_DA_IMPORTACAO = ['expirou', 'trava_esgotada', 'erro_interno'] as const
export type ErroDaImportacao = (typeof ERROS_DA_IMPORTACAO)[number]

/** Os tipos de evento do calendário escolar (PRD, RF10). Casa com o check `evento_calendario_tipo_valido`. */
export const TIPOS_DE_EVENTO_DO_CALENDARIO = ['feriado', 'recesso', 'evento'] as const
export type TipoDeEventoDoCalendario = (typeof TIPOS_DE_EVENTO_DO_CALENDARIO)[number]

/** A descrição do evento: texto livre, e por isso curto e sem nome de pessoa (`docs/lgpd.md`). O check do banco repete o 120. */
export const TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO = 120

/** A sala de uma aula da grade: texto curto ("Lab 2"), até 40 caracteres. A planilha acima disso é erro na linha. */
export const TAMANHO_MAXIMO_DA_SALA_DA_AULA = 40

/** Quantas linhas a planilha de professores aceita (PRD, RF6): a 301ª é erro de teto, e nada grava. */
export const MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES = 300

/** O texto da planilha, até 512 KB em UTF-8 (Tech Spec, seção 4; regra 80, item 3). Acima disso, `ENTRADA_INVALIDA`. */
export const MAXIMO_DE_BYTES_DA_PLANILHA = 512 * 1024

/** Quantos bytes o texto ocupa em UTF-8 (o pacote não depende de `TextEncoder` nem de `Buffer`, que o navegador e o Node têm de jeitos diferentes). */
function bytesEmUtf8(texto: string): number {
  let bytes = 0
  for (const caractere of texto) {
    const ponto = caractere.codePointAt(0) ?? 0
    bytes += ponto < 0x80 ? 1 : ponto < 0x800 ? 2 : ponto < 0x10000 ? 3 : 4
  }
  return bytes
}

/**
 * Quantas vezes por minuto o mesmo usuário pode pedir a prévia ou o gravar de uma planilha (F2, 5.0; `cenarios.md`, "Limites"): os
 * dois contam no mesmo balde, porque o gravar refaz a prévia. Acima disso, `LIMITE_EXCEDIDO` (429).
 */
export const LIMITE_DA_PLANILHA_POR_MINUTO = 20

/** Quantas prévias ou gravares de planilha a mesma escola classifica ao mesmo tempo (F2, 5.0). A terceira é recusada com `LIMITE_EXCEDIDO`. */
export const VAGAS_DA_PLANILHA_POR_ESCOLA = 2

/** Os minutos que a importação pode esperar `na_fila` antes de o alerta "Importação de planilha parada na fila" disparar (F2, 5.0). */
export const MINUTOS_DA_IMPORTACAO_NA_FILA_PARA_ALERTAR = 30

/** O texto da planilha, até 3.000 linhas de dado, fora o cabeçalho (Tech Spec, seção 4; regra 80, item 3). Acima disso, `ENTRADA_INVALIDA`. */
export const MAXIMO_DE_LINHAS_DA_PLANILHA = 3000

/**
 * Quantas linhas de dado o texto tem: as não vazias, menos o cabeçalho. Conta quebra de linha, e não registro de CSV: uma
 * célula entre aspas com quebra dentro conta mais de uma, e o teto fica do lado seguro (a leitura não fica mais cara que isto).
 */
function linhasDeDado(texto: string): number {
  let linhas = 0
  for (const linha of texto.split(/\r\n|\r|\n/)) {
    if (linha.trim() !== '') linhas += 1
  }
  return Math.max(0, linhas - 1)
}

/** O texto como o navegador o leu, dentro dos tetos de bytes e de linhas. */
const textoDaPlanilhaSchema = z.string().refine((texto) => bytesEmUtf8(texto) <= MAXIMO_DE_BYTES_DA_PLANILHA && linhasDeDado(texto) <= MAXIMO_DE_LINHAS_DA_PLANILHA)

/**
 * Corpo de `POST /v1/importacoes/:tipo/previa`: o texto, a turma (só na lista por turma) e o ano que a coordenação escolhe, o
 * planejado. Estrito: a escola vem da sessão, nunca do corpo (regra 10, item 3).
 */
export const previaDaPlanilhaRequestSchema = z.strictObject({
  texto: textoDaPlanilhaSchema,
  turmaId: z.uuid().optional(),
  anoLetivoId: z.uuid().optional(),
})
export type PreviaDaPlanilhaRequest = z.infer<typeof previaDaPlanilhaRequestSchema>

/**
 * O que a coordenação marcou na prévia: só com a marca dela a reimportação transfere, desliga ou encerra (PRD, seção 6). São
 * ids, nunca nome nem matrícula (`docs/lgpd.md`); o que cada id é depende do tipo (o aluno que muda de turma, o aluno ou o
 * professor ausente, o vínculo que saiu da grade).
 */
export const marcasDaPlanilhaSchema = z.strictObject({
  transferir: z.array(z.uuid()).default([]),
  desligar: z.array(z.uuid()).default([]),
  encerrar: z.array(z.uuid()).default([]),
})
export type MarcasDaPlanilha = z.infer<typeof marcasDaPlanilhaSchema>

/** Corpo de `POST /v1/importacoes/:tipo`: o mesmo da prévia, mais as marcas. O gravar refaz a prévia. */
export const gravarPlanilhaRequestSchema = previaDaPlanilhaRequestSchema.extend({ marcas: marcasDaPlanilhaSchema.default({ transferir: [], desligar: [], encerrar: [] }) })
export type GravarPlanilhaRequest = z.infer<typeof gravarPlanilhaRequestSchema>

/** Resposta de `POST /v1/importacoes/:tipo` (202): o id da importação que entrou na fila. */
export const gravarPlanilhaResponseSchema = z.strictObject({ id: z.uuid() })
export type GravarPlanilhaResponse = z.infer<typeof gravarPlanilhaResponseSchema>

/**
 * As contagens que o `resumo` pode ter. Lista fechada: o `resumo` fica no banco por 90 dias e vai para a auditoria
 * (`planilha.gravada`), e por isso não aceita chave nenhuma que possa carregar nome, matrícula ou e-mail (regra 20, item 9;
 * `cenarios.md`: o resumo não distingue e-mail com conta em outra escola de e-mail novo). Cada tarefa que grava um tipo
 * acrescenta as dela aqui.
 */
export const CHAVES_DO_RESUMO_DA_IMPORTACAO = [
  'entram',
  'ja_existem',
  'nomes_corrigidos',
  'transferidos',
  'desligados',
  'retirados',
  'voltam',
  'turmas_novas',
  'disciplinas_novas',
  'professores_novos',
  'vinculos_criados',
  'vinculos_encerrados',
  'aulas',
  'aulas_removidas',
  'eventos',
  'eventos_removidos',
] as const
export type ChaveDoResumoDaImportacao = (typeof CHAVES_DO_RESUMO_DA_IMPORTACAO)[number]

const contagem = z.number().int().nonnegative()

/** O que a importação fez, só em contagens: chave de fora da lista, ou valor que não seja um inteiro não negativo, é recusado. */
export const resumoDaImportacaoSchema = z.strictObject(Object.fromEntries(CHAVES_DO_RESUMO_DA_IMPORTACAO.map((chave) => [chave, contagem.optional()])) as Record<ChaveDoResumoDaImportacao, z.ZodOptional<typeof contagem>>)
export type ResumoDaImportacao = z.infer<typeof resumoDaImportacaoSchema>

/**
 * Resposta de `GET /v1/importacoes/:id`: o estado, as contagens e, se falhou, o código. `resumo` só existe em `concluida`, e
 * `erro` só em `falhou`: o contrato não deixa a tela ler uma contagem de importação que não gravou.
 */
export const importacaoSchema = z
  .strictObject({
    id: z.uuid(),
    tipo: z.enum(TIPOS_DE_PLANILHA),
    estado: z.enum(ESTADOS_DA_IMPORTACAO),
    resumo: resumoDaImportacaoSchema.nullable(),
    erro: z.enum(ERROS_DA_IMPORTACAO).nullable(),
    criadoEm: z.iso.datetime({ offset: true }),
    concluidaEm: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((importacao) => importacao.resumo === null || importacao.estado === 'concluida')
  .refine((importacao) => (importacao.erro === null) === (importacao.estado !== 'falhou'))
export type Importacao = z.infer<typeof importacaoSchema>

/** O que a linha da prévia vira se a planilha for gravada. Cada tipo usa o seu pedaço (alunos, professores, grade, calendário). */
export const RESULTADOS_DA_LINHA_DA_PLANILHA = ['entra', 'ja_existe', 'novo', 'nome_corrigido', 'muda_de_turma', 'fora_da_planilha', 'sai_da_grade', 'volta', 'erro'] as const
export type ResultadoDaLinhaDaPlanilha = (typeof RESULTADOS_DA_LINHA_DA_PLANILHA)[number]

/** O código de um erro ou aviso de linha: palavra de lista fechada de cada tipo, nunca texto montado com o dado da linha. */
const codigoDeLinha = z.string().regex(/^[a-z][a-z0-9_]*$/)

/** Uma linha da prévia: o número dela no arquivo (contando o cabeçalho), o resultado e o código do erro ou do aviso, se houver. */
export const linhaDaPreviaDaPlanilhaSchema = z
  .strictObject({
    linha: z.number().int().positive(),
    resultado: z.enum(RESULTADOS_DA_LINHA_DA_PLANILHA),
    erro: codigoDeLinha.optional(),
    aviso: codigoDeLinha.optional(),
  })
  .refine((linha) => (linha.resultado === 'erro') === (linha.erro !== undefined))
export type PreviaDaPlanilhaRow = z.infer<typeof linhaDaPreviaDaPlanilhaSchema>

/** O que a coordenação pode marcar numa linha da prévia: o id a mandar em `marcas` e a ação. O rótulo traz nome e matrícula, só para ela conferir. */
export const candidatoDaMarcaSchema = z.strictObject({
  id: z.uuid(),
  acao: z.enum(['transferir', 'desligar', 'encerrar']),
  rotulo: z.string(),
})
export type CandidatoDaMarca = z.infer<typeof candidatoDaMarcaSchema>

/** Resposta de `POST /v1/importacoes/:tipo/previa`: as linhas, as contagens do que a planilha faria e os candidatos a marca. */
export const previaDaPlanilhaResponseSchema = z.strictObject({
  linhas: z.array(linhaDaPreviaDaPlanilhaSchema),
  contagens: resumoDaImportacaoSchema,
  candidatos: z.array(candidatoDaMarcaSchema),
})
export type PreviaDaPlanilhaResponse = z.infer<typeof previaDaPlanilhaResponseSchema>

/** O horário de uma aula, "08:50": hora e minuto, como a grade o mostra. */
const horarioDaAula = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/**
 * Uma aula da grade de uma turma (`GET /v1/grade?turmaId=`, Tech Spec, seção 4): o professor vai só com o id e o nome. E-mail
 * de colega nunca sai numa grade, nem para a coordenação (regra 20; `cenarios.md`, "a grade sai sem e-mail"). `diaSemana` de 1
 * (segunda) a 7 (domingo), como o check `alocacao_dia_da_semana_valido`.
 */
export const aulaDaGradeSchema = z.strictObject({
  id: z.uuid(),
  turmaId: z.uuid(),
  disciplinaId: z.uuid().nullable(),
  professor: z.strictObject({ usuarioId: z.uuid(), nome: z.string() }),
  diaSemana: z.number().int().min(1).max(7),
  inicio: horarioDaAula,
  fim: horarioDaAula,
  sala: z.string().nullable(),
})
export type AulaDaGrade = z.infer<typeof aulaDaGradeSchema>

/**
 * Consulta de `GET /v1/grade` (F2, 12.0; Tech Spec, seção 4): a turma, e o ano planejado que a coordenação escolhe (sem ele, o em curso).
 * Estrita: a escola vem da sessão, nunca da consulta (regra 10, item 3).
 */
export const gradeQuerySchema = z.strictObject({ turmaId: z.uuid(), anoLetivoId: z.uuid().optional() })
export type GradeQuery = z.infer<typeof gradeQuerySchema>

/** Resposta de `GET /v1/grade?turmaId=`: as aulas da turma no ano. */
export const gradeResponseSchema = z.strictObject({ aulas: z.array(aulaDaGradeSchema) })
export type GradeResponse = z.infer<typeof gradeResponseSchema>

/** Um evento do calendário do ano (`GET /v1/calendario`): o tipo, de que dia a que dia, e a descrição de até 120 caracteres. */
export const eventoDoCalendarioSchema = z.strictObject({
  id: z.uuid(),
  tipo: z.enum(TIPOS_DE_EVENTO_DO_CALENDARIO),
  inicio: z.iso.date(),
  fim: z.iso.date(),
  descricao: z.string().min(1).max(TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO),
})
export type EventoDoCalendario = z.infer<typeof eventoDoCalendarioSchema>

/**
 * Consulta de `GET /v1/calendario`: o ano planejado que a coordenação escolhe (Tech Spec, seção 4). Sem ele, o ano em curso. Estrita:
 * a escola vem da sessão, nunca da consulta (regra 10, item 3).
 */
export const calendarioQuerySchema = z.strictObject({ anoLetivoId: z.uuid().optional() })
export type CalendarioQuery = z.infer<typeof calendarioQuerySchema>

/** Resposta de `GET /v1/calendario`: os eventos do ano, por data. */
export const calendarioResponseSchema = z.strictObject({ eventos: z.array(eventoDoCalendarioSchema) })
export type CalendarioResponse = z.infer<typeof calendarioResponseSchema>
