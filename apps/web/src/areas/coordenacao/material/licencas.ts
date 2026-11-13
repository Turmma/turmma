import {
  ErrorCode,
  registrarLicencaRequestSchema,
  alterarLicencaRequestSchema,
  situacaoDaLicenca,
  vigenciaInvalida,
  type AlterarLicencaRequest,
  type Licenca,
  type RegistrarLicencaRequest,
  type SituacaoDaLicenca,
} from '@educa/shared'
import type { StatusFamily } from '../../../components/ui/StatusBadge'

/**
 * O que a aba Licenças desenha e confere, sem React (ingestao-do-material, 6.0; RF16 e RF17; Tech Spec, seção 9): a situação em texto e
 * em família de cor, as datas por extenso, o que a mudança de vigência faz com a busca e o rascunho dos dois formulários. Fica num módulo
 * puro para cada regra ter teste de unidade e para a tela só desenhar. **Nada aqui lê o licenciante para o sino** (ele pode ser nome de pessoa).
 */

/** A referência que a rotina de migração deu às licenças de antes da F4 (`0053_licenca_de_material_backfill.sql`): a coordenação as revê (R6). */
export const REFERENCIA_DA_MIGRACAO = 'registrada antes da F4'

export function registradaAntesDaF4(licenca: Pick<Licenca, 'referencia'>): boolean {
  return licenca.referencia === REFERENCIA_DA_MIGRACAO
}

/** `AAAA-MM-DD` → `dd/mm/aaaa`, por texto: a data do calendário não tem fuso, e passar por `Date` a levaria ao dia anterior. */
export function dataDaLicenca(data: string): string {
  const [ano = '', mes = '', dia = ''] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

/** `AAAA-MM-DD` → `dd/mm`: o aviso do sino diz o dia e o mês, que é o que a coordenação procura na lista. */
export function diaEMesDaLicenca(data: string): string {
  return dataDaLicenca(data).slice(0, 5)
}

/** O dia de hoje em São Paulo, `AAAA-MM-DD`: o mesmo dia por que a API calcula a `situacao` (`diaDeUso`). */
export function diaDeHojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

/** A família do selo de cada situação: a que vence pede atenção, a vencida é erro, a que ainda não começou é só informação. */
export const FAMILIA_DA_SITUACAO_DA_LICENCA = {
  vigente: 'ok',
  vence_em_30_dias: 'pendente',
  vencida: 'erro',
  futura: 'info',
} as const satisfies Readonly<Record<SituacaoDaLicenca, StatusFamily>>

/** O que o selo diz da licença, em texto: o estado nunca é só a cor (regra 50, item 11). */
export function textoDaSituacaoDaLicenca(licenca: Pick<Licenca, 'situacao' | 'vigenteDesde' | 'vigenteAte'>): string {
  switch (licenca.situacao) {
    case 'vigente':
      return 'Vigente'
    case 'vence_em_30_dias':
      return licenca.vigenteAte === null ? 'Vigente' : `Vence em ${dataDaLicenca(licenca.vigenteAte)}`
    case 'vencida':
      return licenca.vigenteAte === null ? 'Vencida' : `Vencida em ${dataDaLicenca(licenca.vigenteAte)}`
    case 'futura':
      return `Começa em ${dataDaLicenca(licenca.vigenteDesde)}`
  }
}

/** Quantos materiais a licença cobre, por extenso. */
export function textoDosMateriais(materiais: number): string {
  return materiais === 0 ? 'Nenhum material' : materiais === 1 ? '1 material' : `${String(materiais)} materiais`
}

/** O que a situação faz com a busca do Assistente e do Tutor, para a linha da tabela. */
export function textoDaBuscaDaLicenca(licenca: Pick<Licenca, 'situacao' | 'materiais'>): string {
  if (licenca.situacao === 'vigente' || licenca.situacao === 'vence_em_30_dias') return 'Os materiais dela estão na busca.'
  if (licenca.materiais === 0) return 'Nenhum material depende desta licença.'
  return licenca.situacao === 'vencida' ? 'Os materiais dela saíram da busca. Atualize a vigência para eles voltarem.' : 'Os materiais dela entram na busca no dia em que ela começa.'
}

// --- O que a mudança de vigência faz com a busca ---------------------------------------------------------------------------------

/** A licença só deixa o material na busca enquanto está `vigente` ou `vence_em_30_dias` (RF17): `futura` e `vencida` o tiram. */
const NA_BUSCA: ReadonlySet<SituacaoDaLicenca> = new Set<SituacaoDaLicenca>(['vigente', 'vence_em_30_dias'])

export interface EfeitoDaVigencia {
  readonly tipo: 'saem' | 'voltam' | 'nenhum'
  readonly materiais: number
}

/**
 * O que a vigência nova faz com os materiais da licença, antes de confirmar (regra 50, item 8): o antes é a `situacao` que a API deu, e o
 * depois é a da vigência escrita, no dia `hoje` (de São Paulo). Saem os que estavam na busca e deixam de estar; voltam os que estavam fora
 * e passam a estar. A conta é só de leitura: quem decide é a API, e os materiais nunca são reenviados.
 */
export function efeitoDaVigencia(licenca: Pick<Licenca, 'situacao' | 'materiais'>, nova: { readonly vigenteDesde: string; readonly vigenteAte: string | null }, hoje: string): EfeitoDaVigencia {
  const estavaNaBusca = NA_BUSCA.has(licenca.situacao)
  const ficaNaBusca = NA_BUSCA.has(situacaoDaLicenca(hoje, nova.vigenteDesde, nova.vigenteAte))
  const tipo = estavaNaBusca && !ficaNaBusca ? 'saem' : !estavaNaBusca && ficaNaBusca ? 'voltam' : 'nenhum'
  return { tipo, materiais: licenca.materiais }
}

/** A frase que o diálogo da vigência mostra antes de confirmar. */
export function textoDoEfeitoDaVigencia(efeito: EfeitoDaVigencia): string {
  if (efeito.materiais === 0) return 'Nenhum material usa esta licença ainda: a vigência só vale para os que vierem depois.'
  const quantos = textoDosMateriais(efeito.materiais)
  switch (efeito.tipo) {
    case 'saem':
      return `${quantos} ${efeito.materiais === 1 ? 'sai' : 'saem'} da busca do Assistente e do Tutor. O que já foi gerado continua citando a página.`
    case 'voltam':
      return `${quantos} ${efeito.materiais === 1 ? 'volta' : 'voltam'} à busca do Assistente e do Tutor, sem reenviar.`
    case 'nenhum':
      return `${quantos} ${efeito.materiais === 1 ? 'continua' : 'continuam'} onde ${efeito.materiais === 1 ? 'está' : 'estão'} na busca: esta vigência não muda isso.`
  }
}

// --- Os formulários --------------------------------------------------------------------------------------------------------------

export interface RascunhoDaVigencia {
  readonly vigenteDesde: string
  /** Vazio: a licença não tem fim. */
  readonly vigenteAte: string
}

export interface RascunhoDaLicenca extends RascunhoDaVigencia {
  readonly licenciante: string
  readonly cobertura: string
  readonly referencia: string
}

export const RASCUNHO_DA_LICENCA_VAZIO: RascunhoDaLicenca = { licenciante: '', cobertura: '', referencia: '', vigenteDesde: '', vigenteAte: '' }

export const CAMPOS_DA_LICENCA = ['licenciante', 'cobertura', 'referencia', 'vigenteDesde', 'vigenteAte'] as const
export type CampoDaLicenca = (typeof CAMPOS_DA_LICENCA)[number]
export type ErrosDaLicenca = Partial<Record<CampoDaLicenca, string>>

const TEXTO_DA_VIGENCIA_INVERTIDA = 'O fim da vigência não pode vir antes do começo.'

/** Só a vigência: o que o diálogo "Mudar a vigência" confere. */
export function errosDaVigencia(rascunho: RascunhoDaVigencia): ErrosDaLicenca {
  const erros: ErrosDaLicenca = {}
  if (rascunho.vigenteDesde === '') erros.vigenteDesde = 'Escolha o dia em que a licença começa.'
  else if (rascunho.vigenteAte !== '' && vigenciaInvalida(rascunho.vigenteDesde, rascunho.vigenteAte)) erros.vigenteAte = TEXTO_DA_VIGENCIA_INVERTIDA
  return erros
}

/** O formulário inteiro: o que falta ou está fora do que a API aceita, campo a campo, em português (regra 50, item 12). */
export function errosDoRascunhoDaLicenca(rascunho: RascunhoDaLicenca): ErrosDaLicenca {
  const erros: ErrosDaLicenca = errosDaVigencia(rascunho)
  if (rascunho.licenciante.trim() === '') erros.licenciante = 'Diga quem deu a licença: a editora, o sistema de ensino ou o autor.'
  if (rascunho.cobertura.trim() === '') erros.cobertura = 'Diga o que a licença cobre.'
  if (rascunho.referencia.trim() === '') erros.referencia = 'Indique o documento: o número do contrato ou do termo. Não anexe o contrato.'
  return erros
}

/** O pedido de registro, pelo contrato de `packages/shared`; sem ele (algum campo fora do contrato) a tela não envia. */
export function pedidoDeRegistro(rascunho: RascunhoDaLicenca): RegistrarLicencaRequest | undefined {
  const lido = registrarLicencaRequestSchema.safeParse({
    licenciante: rascunho.licenciante,
    cobertura: rascunho.cobertura,
    referencia: rascunho.referencia,
    vigenteDesde: rascunho.vigenteDesde,
    vigenteAte: rascunho.vigenteAte === '' ? null : rascunho.vigenteAte,
  })
  return lido.success ? lido.data : undefined
}

/** O pedido da vigência nova: o fim vazio vai como `null`, que tira o fim. */
export function pedidoDeVigencia(rascunho: RascunhoDaVigencia): AlterarLicencaRequest | undefined {
  const lido = alterarLicencaRequestSchema.safeParse({ vigenteDesde: rascunho.vigenteDesde, vigenteAte: rascunho.vigenteAte === '' ? null : rascunho.vigenteAte })
  return lido.success ? lido.data : undefined
}

/** A vigência escrita no formulário, quando está completa e em ordem: o que a conta do efeito precisa. */
export function vigenciaDoRascunho(rascunho: RascunhoDaVigencia): { readonly vigenteDesde: string; readonly vigenteAte: string | null } | undefined {
  if (Object.keys(errosDaVigencia(rascunho)).length > 0) return undefined
  return { vigenteDesde: rascunho.vigenteDesde, vigenteAte: rascunho.vigenteAte === '' ? null : rascunho.vigenteAte }
}

// --- Os textos de falha ----------------------------------------------------------------------------------------------------------

/** O que a API recusou na vigência é dito no campo do fim, onde a pessoa corrige (`ENTRADA_INVALIDA` não diz o campo). */
export const TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA = 'A licença não foi aceita. Confira as datas da vigência e os textos, e tente de novo.'

export const TEXTOS_DA_FALHA_DO_REGISTRO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.LIMITE_EXCEDIDO]: 'Muitos registros por agora. Espere um pouco e tente de novo.',
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'O registro não foi concluído. Confira a lista de licenças antes de tentar de novo.',
}

export const TEXTOS_DA_FALHA_DA_VIGENCIA: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.NAO_ENCONTRADO]: 'Esta licença não está mais na lista. Nada foi alterado.',
  [ErrorCode.LIMITE_EXCEDIDO]: 'Muitas alterações por agora. Espere um pouco e tente de novo.',
}
