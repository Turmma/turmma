import {
  ErrorCode,
  LICENCAS_DE_MATERIAL,
  MAXIMO_DE_BYTES_DO_MATERIAL,
  MENSAGEM_DA_FALHA_DE_MATERIAL,
  motivoDaRecusaDoMaterial,
  NOME_DA_LICENCA,
  NOME_DA_TITULARIDADE,
  SEM_LICENCA,
  MAXIMO_DE_PDFS_POR_LOTE,
  TAMANHO_MAXIMO_TITULO_DO_MATERIAL,
  TITULARIDADES_DE_MATERIAL,
  type LicencaDeclarada,
  type Licenca,
  type Material,
  type MotivoDaRecusaDoMaterial,
  type TitularidadeDeMaterial,
} from '@educa/shared'
import type { CamposDoEnvioDeMaterial } from './api/material'
import { formatQuantity } from '../../../format'

/**
 * As regras da tela Material que não dependem do React (MVP, A2; D5, D75): o que falta no formulário, o que há de errado
 * com o arquivo, por que um envio é recusado e o texto de cada estado. A recusa por licença é a de `packages/shared`, a
 * mesma que a API aplica: a tela não tem regra própria, só o texto.
 */

export const OPCOES_DE_TITULARIDADE = TITULARIDADES_DE_MATERIAL.map((valor) => ({ valor, rotulo: NOME_DA_TITULARIDADE[valor] }))

/** As quatro licenças com que um material entra e, por último, a que a coordenação escolhe quando não tem nenhuma. */
export const OPCOES_DE_LICENCA: ReadonlyArray<{ readonly valor: LicencaDeclarada; readonly rotulo: string }> = [
  ...LICENCAS_DE_MATERIAL.map((valor) => ({ valor, rotulo: NOME_DA_LICENCA[valor] })),
  { valor: SEM_LICENCA, rotulo: 'Não tenho a licença, ou não sei' },
]

/**
 * O formulário como a pessoa o deixou: o que vale para o lote inteiro (RF14: a mesma disciplina, séries, titularidade e licença para os
 * PDFs do lote). Tudo texto, com vazio onde nada foi escolhido. O título é de cada arquivo (`ItemDoLote`); o do rascunho só existe no "Tentar de
 * novo" de um material que falhou, e vira o título do primeiro arquivo escolhido.
 */
export interface RascunhoDoEnvio {
  readonly titulo: string
  readonly disciplinaId: string
  /** De 1 a 7 séries da escola (RF3), na ordem em que a pessoa as marcou. */
  readonly serieIds: readonly string[]
  readonly titularidade: TitularidadeDeMaterial | ''
  /** A licença registrada do material de terceiro (`GET /v1/licencas`); vazio no material que não é de terceiro. */
  readonly licencaId: string
  readonly licenca: LicencaDeclarada | ''
  readonly declaracao: boolean
}

export const RASCUNHO_VAZIO: RascunhoDoEnvio = { titulo: '', disciplinaId: '', serieIds: [], titularidade: '', licencaId: '', licenca: '', declaracao: false }

export type CampoDoEnvio = 'arquivo' | 'titulo' | 'disciplinaId' | 'serieIds' | 'titularidade' | 'licencaId' | 'licenca'

/** Na ordem da tela: o primeiro com erro é o que recebe o foco. */
export const CAMPOS_DO_ENVIO: readonly CampoDoEnvio[] = ['arquivo', 'titulo', 'disciplinaId', 'serieIds', 'titularidade', 'licencaId', 'licenca']

/** O que cada arquivo do lote está passando. `pendente` é o que ainda vai ser enviado, e é o único em que o título se edita. */
export type SituacaoDoItem = 'pendente' | 'enviando' | 'enviado' | 'ja_enviado' | 'falhou'

/** Um PDF do lote: o arquivo, o título (nascido do nome, editável até o envio) e o que aconteceu com ele. */
export interface ItemDoLote {
  readonly chave: number
  readonly arquivo: File
  readonly titulo: string
  readonly situacao: SituacaoDoItem
  /** O que a tela diz do arquivo quando ele falhou. */
  readonly texto?: string
}

/** Os PDFs de um lote, um por vez (RF14): o 21º é recusado antes de enviar, na tela, e a API não vê. */
export const MAXIMO_DE_ARQUIVOS_DO_LOTE = MAXIMO_DE_PDFS_POR_LOTE

/** Quantos dos `novos` cabem no lote que já tem `atuais` (o "Tentar de novo" de um material troca um só: `maximo` = 1), e quantos ficaram de fora. */
export function aceitarNoLote(atuais: number, novos: number, maximo: number = MAXIMO_DE_ARQUIVOS_DO_LOTE): { readonly aceitos: number; readonly excedente: number } {
  const aceitos = Math.max(0, Math.min(novos, maximo - atuais))
  return { aceitos, excedente: novos - aceitos }
}

export const TEXTO_DE_UM_ARQUIVO_SO = 'Este envio troca um material só. Escolha um arquivo.'

export function textoDoLimiteDoLote(excedente: number): string {
  const quantos = excedente === 1 ? 'O último arquivo não entrou' : `Os ${String(excedente)} últimos arquivos não entraram`
  return `Um lote tem até ${String(MAXIMO_DE_ARQUIVOS_DO_LOTE)} PDFs. ${quantos}: envie o resto num segundo lote.`
}

/**
 * Por que o envio será recusado, ou `null`. Só se sabe com a licença escolhida: sem licença, ou com licença e sem a
 * declaração marcada. É a função de `packages/shared`, que a API chama antes de abrir o arquivo. O material de terceiro sem licença registrada
 * **não** é recusa da tela: é campo por preencher (`licencaId`), a menos que a pessoa diga que não tem a licença.
 */
export function motivoDaRecusa(rascunho: Pick<RascunhoDoEnvio, 'licenca' | 'declaracao'>): MotivoDaRecusaDoMaterial | null {
  return rascunho.licenca === '' ? null : motivoDaRecusaDoMaterial({ licenca: rascunho.licenca, declaracao: rascunho.declaracao })
}

/** O arquivo que o próximo envio leva: o que ainda não saiu e o que falhou (que a pessoa tenta de novo, com o título que quiser). */
export function devePartir(item: Pick<ItemDoLote, 'situacao'>): boolean {
  return item.situacao === 'pendente' || item.situacao === 'falhou'
}

/** O que está errado no título de um arquivo, ou `undefined`. */
export function erroDoTitulo(titulo: string): string | undefined {
  const aparado = titulo.trim()
  if (aparado === '') return 'Dê um título ao material, como ele aparece no livro ou na apostila.'
  if (aparado.length > TAMANHO_MAXIMO_TITULO_DO_MATERIAL) return `O título tem no máximo ${String(TAMANHO_MAXIMO_TITULO_DO_MATERIAL)} caracteres.`
  return undefined
}

/** O material de terceiro precisa citar uma licença registrada, a menos que a pessoa diga que não tem a licença (isso é recusa, e não campo por preencher). */
function faltaALicencaRegistrada(rascunho: Pick<RascunhoDoEnvio, 'titularidade' | 'licenca' | 'licencaId'>): boolean {
  return rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licenca !== SEM_LICENCA && rascunho.licencaId === ''
}

/** O que está errado no título de cada arquivo que vai partir, pela chave do item. */
function errosDosTitulos(itens: readonly Pick<ItemDoLote, 'chave' | 'titulo' | 'situacao'>[]): Map<number, string> {
  const titulos = new Map<number, string>()
  for (const item of itens.filter(devePartir)) {
    const erro = erroDoTitulo(item.titulo)
    if (erro !== undefined) titulos.set(item.chave, erro)
  }
  return titulos
}

/**
 * O que falta em cada campo, dizendo o que fazer. O arquivo só é exigido do envio que vai entrar: o que será recusado
 * por licença segue sem ele, para a recusa ficar registrada sem o arquivo sair do computador. O título é de cada arquivo (`titulos`, pela chave do item).
 */
export function errosDoRascunho(rascunho: RascunhoDoEnvio, itens: readonly Pick<ItemDoLote, 'chave' | 'titulo' | 'situacao'>[]): Partial<Record<CampoDoEnvio, string>> & { readonly titulos: ReadonlyMap<number, string> } {
  const erros: Partial<Record<CampoDoEnvio, string>> = {}
  if (!itens.some(devePartir) && motivoDaRecusa(rascunho) === null) erros.arquivo = 'Escolha o PDF do material.'
  if (rascunho.disciplinaId === '') erros.disciplinaId = 'Escolha a disciplina do material.'
  if (rascunho.serieIds.length === 0) erros.serieIds = 'Marque ao menos uma série: é por ela que o professor e o Tutor acham o material.'
  if (rascunho.titularidade === '') erros.titularidade = 'Diga de quem é o material.'
  if (faltaALicencaRegistrada(rascunho)) erros.licencaId = 'Escolha a licença registrada do material. É ela que diz de quem é o conteúdo e até quando a escola pode usá-lo.'
  if (rascunho.licenca === '') erros.licenca = 'Escolha a licença de uso. Sem licença declarada, o material não entra.'
  return { ...erros, titulos: errosDosTitulos(itens) }
}

/** Há algum erro no formulário, em campo ou em título? */
export function temErro(erros: ReturnType<typeof errosDoRascunho>): boolean {
  return erros.titulos.size > 0 || CAMPOS_DO_ENVIO.some((campo) => campo !== 'titulo' && erros[campo] !== undefined)
}

/** O que falta para o pedido de um arquivo existir, fora a titularidade e a licença (que `camposDoEnvio` confere, para o tipo): a disciplina, as séries, o título e a licença registrada. */
function pedidoIncompleto(rascunho: RascunhoDoEnvio, titulo: string): boolean {
  return rascunho.disciplinaId === '' || rascunho.serieIds.length === 0 || erroDoTitulo(titulo) !== undefined || faltaALicencaRegistrada(rascunho)
}

/** O pedido de um arquivo à API, do rascunho (sem erro) e do título dele. Com erro no rascunho, `undefined`. */
export function camposDoEnvio(rascunho: RascunhoDoEnvio, titulo: string): CamposDoEnvioDeMaterial | undefined {
  if (pedidoIncompleto(rascunho, titulo) || rascunho.titularidade === '' || rascunho.licenca === '') return undefined
  const comLicencaRegistrada = rascunho.titularidade === 'terceiro_com_licenca' && rascunho.licencaId !== ''
  return {
    titulo: titulo.trim(),
    disciplinaId: rascunho.disciplinaId,
    serieIds: rascunho.serieIds,
    titularidade: rascunho.titularidade,
    ...(comLicencaRegistrada ? { licencaId: rascunho.licencaId } : {}),
    licenca: rascunho.licenca,
    declaracao: rascunho.declaracao,
  }
}

/** As licenças que o material de terceiro pode citar: as que valem hoje. A vencida e a que ainda não começou não se escolhem (RF16). */
export function licencasQueValem<L extends Pick<Licenca, 'situacao'>>(licencas: readonly L[]): L[] {
  return licencas.filter((licenca) => licenca.situacao === 'vigente' || licenca.situacao === 'vence_em_30_dias')
}

/** O que a tela diz de cada recusa: por que, o que aconteceu com o arquivo e o que fazer. */
export const TEXTO_DA_RECUSA: Readonly<Record<MotivoDaRecusaDoMaterial, string>> = {
  sem_licenca:
    'Sem uma licença que permita o uso, o material não entra na base da escola. O arquivo não foi enviado nem lido. Peça a autorização ao dono do conteúdo e envie de novo com a licença.',
  sem_declaracao: 'Falta a declaração de que a escola pode usar este material. O arquivo não foi enviado nem lido. Marque a declaração e envie de novo.',
}

/** O aviso embaixo da licença, antes de enviar: a pessoa sabe o que vai acontecer antes de apertar o botão. */
export const AVISO_DE_SEM_LICENCA = 'Sem licença, o envio é recusado: o arquivo não é enviado nem lido, e a tentativa fica registrada na auditoria da escola.'

const ASSINATURA_DO_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]
/** Quantos bytes do começo do arquivo a tela lê para conferir a assinatura: os mesmos 1024 que a API confere. */
export const BYTES_DA_ASSINATURA = 1024

/** O começo do arquivo tem a assinatura de PDF (`%PDF-`)? Confere o conteúdo, e não o nome nem o tipo. */
export function temAssinaturaDePdf(comeco: Uint8Array): boolean {
  for (let inicio = 0; inicio + ASSINATURA_DO_PDF.length <= comeco.length; inicio += 1) {
    if (ASSINATURA_DO_PDF.every((byte, indice) => comeco[inicio + indice] === byte)) return true
  }
  return false
}

const MEGABYTES_DO_MAXIMO = MAXIMO_DE_BYTES_DO_MATERIAL / (1024 * 1024)

/** O que há de errado com o arquivo escolhido, dizendo o que fazer, ou `undefined` se ele pode ser enviado. */
export function problemaDoArquivo(tamanho: number, comeco: Uint8Array): string | undefined {
  if (tamanho > MAXIMO_DE_BYTES_DO_MATERIAL) return `O arquivo passa de ${String(MEGABYTES_DO_MAXIMO)} MB. Divida o material em capítulos e envie um por vez.`
  if (tamanho === 0 || !temAssinaturaDePdf(comeco)) return MENSAGEM_DA_FALHA_DE_MATERIAL.arquivo_invalido
  return undefined
}

/** O título sugerido pelo nome do arquivo: sem a extensão, com espaço no lugar de `_` e `-`, no tamanho do contrato. */
export function tituloPeloArquivo(nomeDoArquivo: string): string {
  return nomeDoArquivo
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TAMANHO_MAXIMO_TITULO_DO_MATERIAL)
}

/** "12 KB", "3,4 MB": o tamanho do arquivo escolhido, para a pessoa conferir que é o certo. */
export function tamanhoPorExtenso(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/** O que o selo de estado de cada material diz: `pronto` leva o número de páginas. */
export function textoDoEstado(material: Pick<Material, 'estado' | 'paginas'>): string {
  if (material.estado === 'processando') return 'Processando'
  if (material.estado === 'falhou') return 'Falhou'
  return material.paginas === null ? 'Pronto' : `Pronto · ${formatQuantity(material.paginas, 'página', 'páginas')}`
}

/** A titularidade, o licenciante quando há, e a licença, numa linha. */
export function origemDoMaterial(material: Pick<Material, 'titularidade' | 'licenciante' | 'licenca'>): string {
  const titular = material.licenciante === null ? NOME_DA_TITULARIDADE[material.titularidade] : `${NOME_DA_TITULARIDADE[material.titularidade]} (${material.licenciante})`
  return `${titular} · ${NOME_DA_LICENCA[material.licenca]}`
}

/** O que a tela diz de cada falha do envio que não é a recusa por licença nem o limite de envios (esse tem o texto próprio, com a hora). */
export const TEXTOS_DA_FALHA_DO_ENVIO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.CONFLITO]: 'Este arquivo já foi enviado nesta escola. Procure o material na lista abaixo.',
  [ErrorCode.ENTRADA_INVALIDA]: `O arquivo não é um PDF que conseguimos abrir, ou passa de ${String(MEGABYTES_DO_MAXIMO)} MB. Confira o arquivo e envie de novo.`,
  [ErrorCode.NAO_ENCONTRADO]: 'A disciplina, a série ou a licença escolhida não existe mais. Atualize a página e escolha de novo.',
  [ErrorCode.LICENCA_VENCIDA]: 'A licença deste material não está vigente. Atualize a vigência em Licenças e envie de novo.',
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'O envio não foi concluído. Tente de novo em instantes.',
  [ErrorCode.LIMITE_EXCEDIDO]: 'Muitos envios por agora. Os que faltam ficam aqui e continuam em instantes.',
}

/** O texto de cada situação de um arquivo do lote, para a região `aria-live` e para a lista; a falha traz o próprio. */
export function textoDoItem(item: Pick<ItemDoLote, 'situacao' | 'texto'>): string {
  switch (item.situacao) {
    case 'pendente':
      return 'Na fila'
    case 'enviando':
      return 'Enviando…'
    case 'enviado':
      return 'Enviado. A leitura das páginas começa agora.'
    case 'ja_enviado':
      return 'Já enviado nesta escola'
    case 'falhou':
      return item.texto ?? 'Não foi enviado'
  }
}

/** "12 de 20 enviados": quantos do lote já saíram (os "já enviados" contam, o arquivo já está na escola), sobre o total. */
export function resumoDoLote(itens: readonly Pick<ItemDoLote, 'situacao'>[]): string {
  const feitos = itens.filter((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado').length
  return `${String(feitos)} de ${String(itens.length)} ${itens.length === 1 ? 'enviado' : 'enviados'}`
}

/** Dia e hora locais de uma espera em segundos, só a hora: "14:35". O texto do limite diz a hora em que o envio continua. */
export function horaDaEspera(esperaSegundos: number, agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(agora.getTime() + esperaSegundos * 1_000))
}

/** O que a tela diz do limite de envios: os que faltam ficam, e a hora em que continuam (RF14, R6). */
export function textoDoLimiteDeEnvios(esperaSegundos: number | undefined, agora: Date = new Date()): string {
  const base = 'Muitos envios por agora. Os que faltam ficam aqui e continuam'
  return esperaSegundos === undefined ? `${base} quando você tocar em "Continuar o envio".` : `${base} às ${horaDaEspera(esperaSegundos, agora)}.`
}

export const TEXTOS_DA_FALHA_DA_EXCLUSAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.NAO_ENCONTRADO]: 'Este material já não está na lista. A lista foi atualizada.',
}

/** O mais novo primeiro: a API lista em ordem de envio, e quem acabou de enviar quer ver o que enviou no topo. */
export function doMaisNovoAoMaisAntigo<Item>(itens: readonly Item[]): Item[] {
  return itens.toReversed()
}

/** Um arquivo escolhido, com o que há de errado nele pelo conteúdo (tamanho e assinatura de PDF), ou `undefined`. */
export interface ArquivoConferido {
  readonly arquivo: File
  readonly problema: string | undefined
}

/** Lê o começo do arquivo e o confere. Sem conseguir ler, o arquivo é tratado como o que não se abre. */
export async function conferirArquivo(arquivo: File): Promise<ArquivoConferido> {
  let comeco = new Uint8Array()
  try {
    comeco = new Uint8Array(await arquivo.slice(0, BYTES_DA_ASSINATURA).arrayBuffer())
  } catch {
    // Tratado abaixo como arquivo que não se abre.
  }
  return { arquivo, problema: problemaDoArquivo(arquivo.size, comeco) }
}

/** O título de um arquivo recém-escolhido: o do "Tentar de novo" para o primeiro de um envio que troca um material, e o do nome do arquivo nos outros. */
export function tituloDoNovoItem(arquivo: File, tituloDoRetorno: string | undefined): string {
  return tituloDoRetorno === undefined || tituloDoRetorno.trim() === '' ? tituloPeloArquivo(arquivo.name) : tituloDoRetorno
}

/** O título com que a recusa de um envio sem arquivo, ou de um lote, entra na tabela. */
export const TITULO_DA_RECUSA_SEM_ARQUIVO = 'Material sem arquivo'

export function tituloDaRecusa(lote: readonly Pick<ItemDoLote, 'titulo'>[]): string {
  const [unico] = lote
  if (unico === undefined) return TITULO_DA_RECUSA_SEM_ARQUIVO
  if (lote.length > 1) return `Lote de ${String(lote.length)} arquivos`
  return unico.titulo.trim() === '' ? TITULO_DA_RECUSA_SEM_ARQUIVO : unico.titulo.trim()
}

/** O que o botão de enviar diz, pela situação do lote: enviando, continuar o que parou, tentar de novo os que falharam, ou o envio em si. */
export function rotuloDoBotaoDeEnvio({ emCurso, parada, itens, umArquivoSo }: { readonly emCurso: boolean; readonly parada: { readonly tipo: string } | undefined; readonly itens: readonly Pick<ItemDoLote, 'situacao'>[]; readonly umArquivoSo: boolean }): string {
  if (emCurso) return 'Enviando…'
  if (parada !== undefined && parada.tipo !== 'cancelado') return 'Continuar o envio'
  const aEnviar = itens.filter(devePartir)
  if (aEnviar.length > 0 && aEnviar.every((item) => item.situacao === 'falhou')) return 'Tentar de novo os que falharam'
  return umArquivoSo || aEnviar.length <= 1 ? 'Enviar material' : `Enviar ${String(aEnviar.length)} materiais`
}
