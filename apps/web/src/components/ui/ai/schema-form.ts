import type { Ferramenta } from '@educa/shared'

/**
 * **A ferramenta é dado, e o motor é um só** (P23; `docs/interface.md` 1.2 e 11.3): cada ferramenta é uma descrição de
 * campos, e o mesmo formulário a desenha na tela de Ferramentas e no cartão dentro da conversa (D18). Ferramenta nova é
 * uma descrição nova, não uma tela nova.
 *
 * Aqui mora a regra, sem tela: o valor inicial de cada campo, o que falta para gerar e os valores validados que saem.
 *
 * **A Adaptação não tem campo de texto.** Ela recebe o **tipo** de adaptação, de lista fechada, e nunca texto sobre o
 * aluno: texto livre ali é onde o diagnóstico entraria no sistema (D35, D67; regra 20, item 3). O tipo
 * `DescricaoDeFerramenta` recusa o campo de texto na Adaptação em tempo de compilação, e `problemaDaDescricao` recusa em
 * execução a descrição que chegue por outro caminho (um JSON, um `as`).
 */

/**
 * Quando um campo aparece: **só quando outro campo, de múltipla escolha, tem aquela opção marcada**. É condição de lista
 * fechada, de propósito: não há expressão nem comparação com texto, e nada que deixe um campo depender do que alguém
 * escreveu. O tempo extra da Adaptação só existe com "Tempo adicional" marcado.
 */
export interface CondicaoDoCampo {
  /** A chave do campo de múltipla escolha. */
  readonly campo: string
  /** O valor da opção que precisa estar marcada. */
  readonly contem: string
}

interface CampoBase {
  /** O nome do valor na saída: `tema`, `quantidade`, `tipos`. Único na descrição. */
  readonly chave: string
  /** O rótulo visível do campo. */
  readonly rotulo: string
  readonly dica?: string
  /** Sem ela, o campo aparece sempre. Com ela, só aparece, só é validado e só sai no pedido quando a condição vale. */
  readonly quando?: CondicaoDoCampo
}

/** Texto curto, de uma linha: o tema da atividade. É o único campo livre do motor, e a Adaptação não o tem. */
export interface CampoDeTexto extends CampoBase {
  readonly tipo: 'texto'
  /** O texto de exemplo do campo vazio: um pedido-modelo, nunca "digite aqui". */
  readonly exemplo?: string
  readonly obrigatorio?: boolean
  /** Quantos caracteres cabem. Sem ele, 200. */
  readonly maximo?: number
  readonly padrao?: string
}

/** Número inteiro numa faixa: quantas questões, quantos minutos. */
export interface CampoDeNumero extends CampoBase {
  readonly tipo: 'numero'
  readonly minimo: number
  readonly maximo: number
  readonly obrigatorio?: boolean
  readonly padrao?: number
}

export interface OpcaoDoCampo {
  readonly valor: string
  readonly rotulo: string
}

/** Uma opção de uma lista fechada: a turma, a disciplina, o material. */
export interface CampoDeSelecao extends CampoBase {
  readonly tipo: 'selecao'
  readonly opcoes: readonly OpcaoDoCampo[]
  readonly obrigatorio?: boolean
  readonly padrao?: string
}

/** Várias opções de uma lista fechada: os tipos de adaptação. */
export interface CampoDeMultipla extends CampoBase {
  readonly tipo: 'multipla'
  readonly opcoes: readonly OpcaoDoCampo[]
  /** Quantas, no mínimo, precisam ser marcadas. Sem ele, nenhuma. */
  readonly minimo?: number
  readonly padrao?: readonly string[]
}

/** Os campos de lista fechada e de número: os que a Adaptação pode ter. */
export type CampoFechado = CampoDeNumero | CampoDeSelecao | CampoDeMultipla
export type CampoDoMotor = CampoDeTexto | CampoFechado

/** As ferramentas que não aceitam texto livre: nelas, texto livre é texto sobre o aluno. */
export const FERRAMENTAS_SEM_TEXTO_LIVRE = ['adaptacao'] as const satisfies readonly Ferramenta[]
type FerramentaSemTextoLivre = (typeof FERRAMENTAS_SEM_TEXTO_LIVRE)[number]

/**
 * A descrição de uma ferramenta. Para a Adaptação, `campos` só aceita `CampoFechado`: escrever um campo `texto` nela
 * não compila.
 */
export type DescricaoDeFerramenta = {
  [F in Ferramenta]: {
    readonly ferramenta: F
    /** O nome da ferramenta, como aparece no catálogo: "Atividade objetiva". */
    readonly nome: string
    /** O botão diz o que acontece, com o objeto: "Gerar atividade" (9.8). */
    readonly verbo: string
    readonly campos: F extends FerramentaSemTextoLivre ? readonly CampoFechado[] : readonly CampoDoMotor[]
  }
}[Ferramenta]

export type ValorDoCampo = string | number | readonly string[]
/** O que o formulário guarda enquanto a pessoa preenche: o número ainda é o texto digitado. */
export type ValoresDoFormulario = Readonly<Record<string, string | readonly string[]>>
/** O que sai para quem pediu, depois de validado: texto aparado, número inteiro, listas sem repetição. */
export type ValoresValidados = Readonly<Record<string, ValorDoCampo>>

export interface Pendencia {
  readonly chave: string
  readonly rotulo: string
  /** O que fazer, em português: "Escreva o tema.", "Use um número de 1 a 20." */
  readonly mensagem: string
}

export type ResultadoDaValidacao = { readonly ok: true; readonly valores: ValoresValidados } | { readonly ok: false; readonly pendencias: readonly Pendencia[] }

export const MAXIMO_DO_TEXTO = 200

/**
 * O que há de errado na própria descrição, ou `undefined`. Quem escreve a descrição em TypeScript é parado pelo tipo;
 * isto para a que vem como dado.
 */
export function problemaDaDescricao(descricao: { readonly ferramenta: Ferramenta; readonly campos: readonly CampoDoMotor[] }): string | undefined {
  const semTexto: readonly Ferramenta[] = FERRAMENTAS_SEM_TEXTO_LIVRE
  if (semTexto.includes(descricao.ferramenta) && descricao.campos.some((campo) => campo.tipo === 'texto'))
    return 'A Adaptação não tem campo de texto: ela recebe o tipo de adaptação, de lista fechada (D35, D67).'
  const chaves = descricao.campos.map((campo) => campo.chave)
  if (new Set(chaves).size !== chaves.length) return 'Dois campos da descrição têm a mesma chave.'
  for (const campo of descricao.campos) {
    if (campo.quando === undefined) continue
    const alvo = descricao.campos.find((outro) => outro.chave === campo.quando?.campo)
    // A condição aponta para uma opção que existe, num campo de múltipla escolha que não é o próprio: do contrário o
    // campo nunca apareceria, ou dependeria de algo que não é lista fechada.
    if (alvo === undefined || alvo === campo || alvo.tipo !== 'multipla' || !alvo.opcoes.some((opcao) => opcao.valor === campo.quando?.contem))
      return `A condição do campo "${campo.rotulo}" não aponta para uma opção de um campo de múltipla escolha.`
    if (alvo.quando !== undefined) return `A condição do campo "${campo.rotulo}" depende de um campo que também é condicional.`
  }
  return undefined
}

/** O campo aparece agora? Sem condição, sempre; com ela, só com a opção marcada no campo de múltipla escolha. */
export function campoVisivel(campo: CampoDoMotor, valores: ValoresDoFormulario): boolean {
  if (campo.quando === undefined) return true
  const marcados = valores[campo.quando.campo]
  return Array.isArray(marcados) && marcados.includes(campo.quando.contem)
}

/** Os valores com que o formulário abre: o padrão de cada campo, ou vazio. Padrão fora da lista de opções é ignorado. */
export function valoresPadrao(campos: readonly CampoDoMotor[]): ValoresDoFormulario {
  const valores: Record<string, string | readonly string[]> = {}
  for (const campo of campos) {
    if (campo.tipo === 'texto') valores[campo.chave] = campo.padrao ?? ''
    else if (campo.tipo === 'numero') valores[campo.chave] = campo.padrao === undefined ? '' : String(campo.padrao)
    else if (campo.tipo === 'selecao') valores[campo.chave] = campo.opcoes.some((opcao) => opcao.valor === campo.padrao) ? (campo.padrao ?? '') : ''
    else valores[campo.chave] = (campo.padrao ?? []).filter((valor) => campo.opcoes.some((opcao) => opcao.valor === valor))
  }
  return valores
}

function pendenciaDe(campo: CampoDoMotor, mensagem: string): Pendencia {
  return { chave: campo.chave, rotulo: campo.rotulo, mensagem }
}

/**
 * Valida o que foi preenchido contra a descrição. Devolve os valores prontos para o pedido, ou **o que falta**, campo a
 * campo, na ordem do formulário. Valor de chave que a descrição não tem é descartado, e opção fora da lista é recusada:
 * o que sai daqui só tem o que a ferramenta declarou.
 */
export function validarFormulario(campos: readonly CampoDoMotor[], valores: ValoresDoFormulario): ResultadoDaValidacao {
  const validados: Record<string, ValorDoCampo> = {}
  const pendencias: Pendencia[] = []
  for (const campo of campos) {
    // O campo que a condição escondeu não é cobrado e não sai no pedido, mesmo com um valor que ficou de antes.
    if (!campoVisivel(campo, valores)) continue
    const bruto = valores[campo.chave]
    if (campo.tipo === 'texto') {
      const texto = typeof bruto === 'string' ? bruto.trim() : ''
      const maximo = campo.maximo ?? MAXIMO_DO_TEXTO
      if (texto === '') {
        if (campo.obrigatorio === true) pendencias.push(pendenciaDe(campo, `Preencha "${campo.rotulo}".`))
      } else if ([...texto].length > maximo) pendencias.push(pendenciaDe(campo, `Use até ${String(maximo)} caracteres em "${campo.rotulo}".`))
      else validados[campo.chave] = texto
    } else if (campo.tipo === 'numero') {
      const texto = typeof bruto === 'string' ? bruto.trim() : ''
      if (texto === '') {
        if (campo.obrigatorio === true) pendencias.push(pendenciaDe(campo, `Preencha "${campo.rotulo}".`))
      } else {
        const numero = /^\d+$/.test(texto) ? Number(texto) : Number.NaN
        if (!Number.isSafeInteger(numero) || numero < campo.minimo || numero > campo.maximo)
          pendencias.push(pendenciaDe(campo, `Use um número inteiro de ${String(campo.minimo)} a ${String(campo.maximo)} em "${campo.rotulo}".`))
        else validados[campo.chave] = numero
      }
    } else if (campo.tipo === 'selecao') {
      const escolhido = typeof bruto === 'string' ? bruto : ''
      if (escolhido === '') {
        if (campo.obrigatorio === true) pendencias.push(pendenciaDe(campo, `Escolha uma opção em "${campo.rotulo}".`))
      } else if (!campo.opcoes.some((opcao) => opcao.valor === escolhido)) pendencias.push(pendenciaDe(campo, `Escolha uma das opções de "${campo.rotulo}".`))
      else validados[campo.chave] = escolhido
    } else {
      const marcados = Array.isArray(bruto) ? bruto : []
      // Na ordem da lista da ferramenta, e sem repetição: o pedido não depende da ordem em que a pessoa clicou.
      const validos = campo.opcoes.map((opcao) => opcao.valor).filter((valor) => marcados.includes(valor))
      const minimo = campo.minimo ?? 0
      if (marcados.some((valor) => !campo.opcoes.some((opcao) => opcao.valor === valor))) pendencias.push(pendenciaDe(campo, `Escolha só entre as opções de "${campo.rotulo}".`))
      else if (validos.length < minimo) pendencias.push(pendenciaDe(campo, minimo === 1 ? `Marque pelo menos uma opção em "${campo.rotulo}".` : `Marque pelo menos ${String(minimo)} opções em "${campo.rotulo}".`))
      else validados[campo.chave] = validos
    }
  }
  return pendencias.length === 0 ? { ok: true, valores: validados } : { ok: false, pendencias }
}

/** O pedido numa linha, para o formulário recolhido enquanto gera e depois de pronto: "Estequiometria · 10 · 2ºB". */
export function resumoDoPedido(campos: readonly CampoDoMotor[], valores: ValoresValidados): string {
  const partes: string[] = []
  for (const campo of campos) {
    const valor = valores[campo.chave]
    if (valor === undefined) continue
    if (campo.tipo === 'texto' && typeof valor === 'string') partes.push(valor)
    else if (campo.tipo === 'numero' && typeof valor === 'number') partes.push(`${campo.rotulo}: ${String(valor)}`)
    else if (campo.tipo === 'selecao') partes.push(campo.opcoes.find((opcao) => opcao.valor === valor)?.rotulo ?? '')
    else if (campo.tipo === 'multipla' && Array.isArray(valor)) partes.push(campo.opcoes.filter((opcao) => valor.includes(opcao.valor)).map((opcao) => opcao.rotulo).join(' + '))
  }
  return partes.filter((parte) => parte !== '').join(' · ')
}
