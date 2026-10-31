import {
  ErrorCode,
  LICENCAS_DE_MATERIAL,
  MAXIMO_DE_BYTES_DO_MATERIAL,
  MENSAGEM_DA_FALHA_DE_MATERIAL,
  motivoDaRecusaDoMaterial,
  NOME_DA_LICENCA,
  NOME_DA_TITULARIDADE,
  SEM_LICENCA,
  TAMANHO_MAXIMO_DO_LICENCIANTE,
  TAMANHO_MAXIMO_TITULO_DO_MATERIAL,
  TITULARIDADES_DE_MATERIAL,
  type LicencaDeclarada,
  type Material,
  type MotivoDaRecusaDoMaterial,
  type TitularidadeDeMaterial,
} from '@educa/shared'
import type { CamposDoEnvioDeMaterial } from './api/material'
import { formatarQuantidade } from '../../../format'

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

/** O formulário como a pessoa o deixou: tudo texto, com vazio onde nada foi escolhido. */
export interface RascunhoDoEnvio {
  readonly titulo: string
  readonly disciplinaId: string
  readonly titularidade: TitularidadeDeMaterial | ''
  readonly licenciante: string
  readonly licenca: LicencaDeclarada | ''
  readonly declaracao: boolean
  readonly temArquivo: boolean
}

export const RASCUNHO_VAZIO: RascunhoDoEnvio = { titulo: '', disciplinaId: '', titularidade: '', licenciante: '', licenca: '', declaracao: false, temArquivo: false }

export type CampoDoEnvio = 'arquivo' | 'titulo' | 'disciplinaId' | 'titularidade' | 'licenciante' | 'licenca'

/** Na ordem da tela: o primeiro com erro é o que recebe o foco. */
export const CAMPOS_DO_ENVIO: readonly CampoDoEnvio[] = ['arquivo', 'titulo', 'disciplinaId', 'titularidade', 'licenciante', 'licenca']

/**
 * Por que o envio será recusado, ou `null`. Só se sabe com a licença escolhida: sem licença, ou com licença e sem a
 * declaração marcada. É a função de `packages/shared`, que a API chama antes de abrir o arquivo.
 */
export function motivoDaRecusa(rascunho: Pick<RascunhoDoEnvio, 'licenca' | 'declaracao'>): MotivoDaRecusaDoMaterial | null {
  return rascunho.licenca === '' ? null : motivoDaRecusaDoMaterial({ licenca: rascunho.licenca, declaracao: rascunho.declaracao })
}

/**
 * O que falta em cada campo, dizendo o que fazer. O arquivo só é exigido do envio que vai entrar: o que será recusado
 * por licença segue sem ele, para a recusa ficar registrada sem o arquivo sair do computador.
 */
export function errosDoRascunho(rascunho: RascunhoDoEnvio): Partial<Record<CampoDoEnvio, string>> {
  const erros: Partial<Record<CampoDoEnvio, string>> = {}
  const titulo = rascunho.titulo.trim()
  if (!rascunho.temArquivo && motivoDaRecusa(rascunho) === null) erros.arquivo = 'Escolha o PDF do material.'
  if (titulo === '') erros.titulo = 'Dê um título ao material, como ele aparece no livro ou na apostila.'
  else if (titulo.length > TAMANHO_MAXIMO_TITULO_DO_MATERIAL) erros.titulo = `O título tem no máximo ${String(TAMANHO_MAXIMO_TITULO_DO_MATERIAL)} caracteres.`
  if (rascunho.disciplinaId === '') erros.disciplinaId = 'Escolha a disciplina do material.'
  if (rascunho.titularidade === '') erros.titularidade = 'Diga de quem é o material.'
  if (rascunho.titularidade === 'terceiro_com_licenca') {
    const licenciante = rascunho.licenciante.trim()
    if (licenciante === '') erros.licenciante = 'Diga quem é o dono do conteúdo que deu a licença.'
    else if (licenciante.length > TAMANHO_MAXIMO_DO_LICENCIANTE) erros.licenciante = `O nome tem no máximo ${String(TAMANHO_MAXIMO_DO_LICENCIANTE)} caracteres.`
  }
  if (rascunho.licenca === '') erros.licenca = 'Escolha a licença de uso. Sem licença declarada, o material não entra.'
  return erros
}

/** O pedido que vai à API, do rascunho sem erro. Com erro, `undefined`. */
export function camposDoEnvio(rascunho: RascunhoDoEnvio): CamposDoEnvioDeMaterial | undefined {
  if (Object.keys(errosDoRascunho(rascunho)).length > 0 || rascunho.titularidade === '' || rascunho.licenca === '') return undefined
  return {
    titulo: rascunho.titulo.trim(),
    disciplinaId: rascunho.disciplinaId,
    titularidade: rascunho.titularidade,
    ...(rascunho.titularidade === 'terceiro_com_licenca' ? { licenciante: rascunho.licenciante.trim() } : {}),
    licenca: rascunho.licenca,
    declaracao: rascunho.declaracao,
  }
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

export const TEXTO_DE_UM_ARQUIVO_POR_VEZ = 'Envie um arquivo por vez. Escolha só o PDF deste material.'

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
  return material.paginas === null ? 'Pronto' : `Pronto · ${formatarQuantidade(material.paginas, 'página', 'páginas')}`
}

/** A titularidade, o licenciante quando há, e a licença, numa linha. */
export function origemDoMaterial(material: Pick<Material, 'titularidade' | 'licenciante' | 'licenca'>): string {
  const titular = material.licenciante === null ? NOME_DA_TITULARIDADE[material.titularidade] : `${NOME_DA_TITULARIDADE[material.titularidade]} (${material.licenciante})`
  return `${titular} · ${NOME_DA_LICENCA[material.licenca]}`
}

/** O que a tela diz de cada falha do envio que não é a recusa por licença. */
export const TEXTOS_DA_FALHA_DO_ENVIO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.CONFLITO]: 'Este arquivo já foi enviado nesta escola. Procure o material na lista abaixo.',
  [ErrorCode.ENTRADA_INVALIDA]: `O arquivo não é um PDF que conseguimos abrir, ou passa de ${String(MEGABYTES_DO_MAXIMO)} MB. Confira o arquivo e envie de novo.`,
  [ErrorCode.NAO_ENCONTRADO]: 'A disciplina escolhida não existe mais. Atualize a página e escolha a disciplina de novo.',
  [ErrorCode.LIMITE_EXCEDIDO]: 'Há materiais demais sendo lidos ou enviados agora. Espere a leitura terminar e envie de novo.',
}

export const TEXTOS_DA_FALHA_DA_EXCLUSAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.NAO_ENCONTRADO]: 'Este material já não está na lista. A lista foi atualizada.',
}

/** O mais novo primeiro: a API lista em ordem de envio, e quem acabou de enviar quer ver o que enviou no topo. */
export function doMaisNovoAoMaisAntigo<Item>(itens: readonly Item[]): Item[] {
  return itens.toReversed()
}
