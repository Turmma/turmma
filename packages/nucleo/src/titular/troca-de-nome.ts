import { sql, type SQL } from 'drizzle-orm'
import { TABELAS_AUDITADAS_NA_TROCA_DE_NOME } from '../auditoria/acoes.js'
import { AuditoriaRecorder } from '../auditoria/registro-de-auditoria.js'
import type { AutoriaDoCicloDeVida } from '../ciclo-de-vida/ciclo-de-vida.service.js'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { Database } from '../db/banco.js'

/** O que entra no lugar do nome: o mesmo texto nas sete colunas, para quem lê saber que havia um nome ali. */
export const NOME_REMOVIDO = '[nome removido]'

/** Quantas linhas **examinadas** (não alteradas) cada faixa percorre: a tarefa curta que a janela letiva confere entre uma e outra. */
export const FAIXA_DA_TROCA_DE_NOME = 1000

/**
 * O teto de texto de cada faixa, além do de linhas: o custo do regex cresce com os bytes, e o worker roda com `statement_timeout` de
 * 2 s (regra 80, item 3). 1.000 linhas de 12 KB levaram 580 ms e 1.000 de 50 KB passaram de 2 s. A faixa sempre leva ao menos uma linha.
 */
export const ORCAMENTO_DA_FAIXA_EM_BYTES = 4 * 1024 * 1024

/** Uma coluna de texto livre onde o nome do titular pode ter sido escrito por uma pessoa ou gerado pela IA. */
export interface ColunaDaTroca {
  readonly tabela: 'execucao_agente' | 'consumo_ia' | 'artefato' | 'mensagem_agente' | 'entrega'
  readonly coluna: string
  /** `jsonb` é trocado pelo texto dele e volta a `jsonb` (o resultado tem de ser JSON válido); `text` é trocado direto. */
  readonly tipo: 'jsonb' | 'text'
  /** A coluna aceita nulo: a faixa lê só as linhas com texto, pelo índice parcial de texto não nulo da 0036. */
  readonly anulavel: boolean
  /**
   * O tamanho máximo que o check da tabela aceita (`artefato_titulo_preenchido`, `entrega_justificativa_preenchida`): o
   * `[nome removido]` é mais comprido que um nome curto, e o texto que ficaria acima do limite é cortado, em vez de o check
   * derrubar a faixa e, com ela, a eliminação inteira.
   */
  readonly limite?: number
}

/**
 * As colunas de texto livre da troca de nome, na ordem em que são percorridas (Tech Spec do F3, seção 5, "Eliminação",
 * etapa 2). O tema do professor e o texto do modelo (`execucao_agente.entrada`, `consumo_ia`), o que o Assistente produziu e
 * o professor aprovou (`artefato`), a conversa do professor com o Assistente (`mensagem_agente`) e a justificativa de quem
 * rejeitou uma entrega (`entrega.justificativa`).
 *
 * **Ficam de fora, de propósito:** `incidente` e `incidente_escola` (o texto é da nossa equipe, e a regra "nenhum dado de
 * titular" é disciplina de quem escreve: runbook, "Ao registrar o incidente"); a conversa do Tutor e os sinais (a
 * conversa do aluno sai por inteiro com o `on delete cascade` da eliminação dele); a lista de nomes e a matrícula (saem
 * pelo ciclo de vida); o texto livre da contestação do vínculo (sai no encerramento do ano); e o complemento do pedido
 * (nunca existe). **O nome anterior a uma correção não é procurado** (Tech Spec, seção 13).
 */
export const COLUNAS_DA_TROCA_DE_NOME: readonly ColunaDaTroca[] = [
  { tabela: 'execucao_agente', coluna: 'entrada', tipo: 'jsonb', anulavel: false },
  { tabela: 'consumo_ia', coluna: 'entrada', tipo: 'jsonb', anulavel: true },
  { tabela: 'consumo_ia', coluna: 'saida', tipo: 'jsonb', anulavel: true },
  { tabela: 'artefato', coluna: 'titulo', tipo: 'text', anulavel: false, limite: 160 },
  { tabela: 'artefato', coluna: 'conteudo', tipo: 'jsonb', anulavel: false },
  { tabela: 'mensagem_agente', coluna: 'conteudo', tipo: 'jsonb', anulavel: false },
  { tabela: 'entrega', coluna: 'justificativa', tipo: 'text', anulavel: true, limite: 500 },
]

/** O que o alvo da troca diz ao job: de quem é o nome, de qual pedido e quem assina. */
export interface PedidoDeTroca {
  readonly pedidoId: string
  /** O nome completo atual do titular, sem tratamento: a troca o escapa para regex e para JSON. */
  readonly nome: string
  /** Quem assina cada `titular.nome_trocado`: a pessoa do contexto, ou a rotina. */
  readonly autoria: AutoriaDoCicloDeVida
  /** `true` quando a janela letiva abriu: conferida **antes de cada faixa**, e a troca para sem erro. */
  readonly janelaAberta: () => boolean
  /** Linhas examinadas por faixa. Só o teste troca. */
  readonly faixa?: number
}

export interface ResultadoDaTroca {
  /** `false`: a janela abriu no meio, e o que já foi trocado fica. Quem chama não elimina e deixa o pedido `agendado`. */
  readonly concluida: boolean
  /** Quantas linhas mudaram, no total. Nunca por tabela: a coordenação não recebe a contagem (RF15). */
  readonly linhas: number
}

const registro = new AuditoriaRecorder()
const ESPECIAIS_DO_REGEX = new Set([...'\\^$.|?*+()[]{}'])
const AUDITADAS: ReadonlySet<string> = new Set(TABELAS_AUDITADAS_NA_TROCA_DE_NOME)

/** Fronteira de palavra antes do nome. No JSON, também depois de um escape (`\n`, `\t`): a `n` do `\n` não é letra da palavra. */
const ANTES_DO_NOME_EM_TEXTO = '(?<![[:alnum:]_])'
const ANTES_DO_NOME_EM_JSON = '(?:(?<![[:alnum:]_])|(?<=\\\\[nrtbf]))'
const DEPOIS_DO_NOME_EM_TEXTO = '(?![[:alnum:]_])'
/** Em JSON, o nome que é o fim de uma **chave** (`"tipo":`) não é trocado: a chave faz parte do formato, e o check do tipo a exige. */
const DEPOIS_DO_NOME_EM_JSON = '(?![[:alnum:]_])(?!"[[:space:]]*:)'

/**
 * A expressão regular do nome para o Postgres (`regexp_replace` e `~`, sem a flag `i`): **sem caixa** montada letra a
 * letra (`[aA]`, `[éÉ]`), e não pela flag, para não depender da configuração de caractere do banco; com **fronteira de
 * palavra** (`Ana Souza` dentro de `Mariana Souza` não casa); espaços do nome casam qualquer espaço, seguido ou não de
 * outro. No `jsonb` o nome é escapado **para JSON antes de virar regex** (`"`, `\`, controle), porque é o `::text` do
 * `jsonb` que se procura, e o apóstrofo e o acento saem como estão. Todo metacaractere de regex do nome é escapado.
 */
export function padraoDoNome(nome: string, tipo: 'jsonb' | 'text'): string {
  const alvo = (tipo === 'jsonb' ? JSON.stringify(nome.trim()).slice(1, -1) : nome.trim()).replace(/\s+/gu, ' ')
  let corpo = ''
  for (const letra of alvo) {
    if (letra === ' ') {
      corpo += '[[:space:]]+'
      continue
    }
    const variantes = new Set([letra, letra.toLowerCase(), letra.toUpperCase()].filter((variante) => [...variante].length === 1))
    if (variantes.size > 1) corpo += `[${[...variantes].join('')}]`
    else corpo += ESPECIAIS_DO_REGEX.has(letra) ? `\\${letra}` : letra
  }
  return tipo === 'jsonb' ? `${ANTES_DO_NOME_EM_JSON}${corpo}${DEPOIS_DO_NOME_EM_JSON}` : `${ANTES_DO_NOME_EM_TEXTO}${corpo}${DEPOIS_DO_NOME_EM_TEXTO}`
}

/** Os `id`s da faixa que cabem no orçamento de bytes, em ordem: ao menos o primeiro, e nenhum que faça a soma passar dele. */
function idsDentroDoOrcamento(linhas: ReadonlyArray<{ id: string; bytes: number }>): string[] {
  const ids: string[] = []
  let somados = 0
  for (const { id, bytes } of linhas) {
    if (ids.length > 0 && somados + bytes > ORCAMENTO_DA_FAIXA_EM_BYTES) break
    ids.push(id)
    somados += bytes
  }
  return ids
}

/**
 * A troca do nome completo do aluno por `[nome removido]` nos textos livres da escola do contexto (F3, tarefa 15.0; RF15;
 * Tech Spec do F3, seção 5, "Eliminação", etapa 2; regra 20, itens 15 e 19). Só o nome **completo** e **atual**: o primeiro nome
 * sozinho fica, e o nome anterior a uma correção não é procurado (seção 13).
 *
 * - **Faixas de `FAIXA_DA_TROCA_DE_NOME` linhas examinadas** e de até `ORCAMENTO_DA_FAIXA_EM_BYTES` de texto (ao menos uma linha), por `id`, num índice `(escola_id, id)` parcial de texto não
 *   nulo: cada faixa é uma transação curta (um `select` das linhas e um `update` das que casam), e **a janela letiva é
 *   conferida antes de cada uma**. A faixa em que ninguém casou também avança o cursor, e é por isso que o tempo de uma
 *   faixa não depende de quantas linhas mudaram.
 * - **Cada linha alterada de execução, consumo, artefato e entrega grava `titular.nome_trocado`** (a tabela, o id e o
 *   pedido), na mesma transação da faixa, a partir do `returning`: o que a IA gerou e o professor aprovou fica registrado
 *   por linha (regra 70, item 6). A conversa do professor é trocada sem entrada por linha.
 * - **O resultado tem de ser JSON válido**: o `::jsonb` do `update` falha a faixa, e com ela o job, se a troca quebrou o
 *   documento; o job repete e o alerta de 48 h aparece. A fronteira de palavra e a recusa de trocar uma chave protegem o
 *   caso comum.
 * - **Idempotente:** o que já foi trocado não casa mais. A noite seguinte, depois de uma interrupção pela janela, recomeça da
 *   primeira faixa e só altera o que sobrou.
 * - A escola vem do contexto, nunca do argumento; toda instrução leva `escola_id`.
 */
export class TrocaDeNome {
  constructor(private readonly banco: Database) {}

  async trocar({ pedidoId, nome, autoria, janelaAberta, faixa = FAIXA_DA_TROCA_DE_NOME }: PedidoDeTroca): Promise<ResultadoDaTroca> {
    const escolaId = requireEscolaId()
    // Nome vazio casaria tudo: nada a procurar.
    if (nome.trim() === '') return { concluida: true, linhas: 0 }
    let linhas = 0
    // Uma entrada de auditoria por linha, mesmo quando duas colunas dela mudam (`consumo_ia.entrada` e `.saida`, `artefato.titulo` e `.conteudo`).
    const auditadas = new Set<string>()
    for (const coluna of COLUNAS_DA_TROCA_DE_NOME) {
      const padrao = padraoDoNome(nome, coluna.tipo)
      let depoisDe: string | undefined
      for (;;) {
        if (janelaAberta()) return { concluida: false, linhas }
        const faixaFeita = await this.banco.transaction(async (tx) => {
          const examinadas = await tx.execute<{ id: string; bytes: number }>(this.#examinar(coluna, escolaId, depoisDe, faixa))
          if (examinadas.rows.length === 0) return { ultimo: undefined, fim: true, alteradas: 0 }
          const ids = idsDentroDoOrcamento(examinadas.rows)
          const alteradas = await tx.execute<{ id: string }>(this.#trocar(coluna, escolaId, ids, padrao))
          if (AUDITADAS.has(coluna.tabela)) {
            const tabela = coluna.tabela as (typeof TABELAS_AUDITADAS_NA_TROCA_DE_NOME)[number]
            const novas = alteradas.rows.map(({ id }) => id).filter((id) => !auditadas.has(`${tabela}/${id}`))
            for (const id of novas) await registro.gravar(tx, 'titular.nome_trocado', { entidadeId: id, depois: { tabela, pedidoId }, ...autoria })
            // Só marca depois de gravar: a faixa que desfaz (transação) não deixa a linha como já assinada.
            for (const id of novas) auditadas.add(`${tabela}/${id}`)
          }
          // Fim só quando a faixa veio curta **e** nada dela ficou de fora pelo orçamento: o cursor é o último `id` que entrou.
          return { ultimo: ids[ids.length - 1], fim: ids.length === examinadas.rows.length && examinadas.rows.length < faixa, alteradas: alteradas.rows.length }
        })
        linhas += faixaFeita.alteradas
        if (faixaFeita.fim || faixaFeita.ultimo === undefined) break
        depoisDe = faixaFeita.ultimo
      }
    }
    return { concluida: true, linhas }
  }

  /** Os `id`s da próxima faixa: as linhas da escola com texto, depois do cursor, em ordem de `id`. */
  #examinar(coluna: ColunaDaTroca, escolaId: string, depoisDe: string | undefined, faixa: number): SQL {
    const tabela = sql.identifier(coluna.tabela)
    const campo = sql.identifier(coluna.coluna)
    return sql`
      select id, octet_length(${campo}::text) as bytes from ${tabela}
      where escola_id = ${escolaId}
        ${depoisDe === undefined ? sql`` : sql`and id > ${depoisDe}::uuid`}
        ${coluna.anulavel ? sql`and ${campo} is not null` : sql``}
      order by id
      limit ${faixa}
    `
  }

  /** A troca nas linhas da faixa que casam com o nome, devolvendo as que mudaram. */
  #trocar(coluna: ColunaDaTroca, escolaId: string, ids: readonly string[], padrao: string): SQL {
    const tabela = sql.identifier(coluna.tabela)
    const campo = sql.identifier(coluna.coluna)
    const lista = `{${ids.join(',')}}`
    if (coluna.tipo === 'jsonb') {
      return sql`
        update ${tabela} set ${campo} = regexp_replace(${campo}::text, ${padrao}, ${NOME_REMOVIDO}, 'g')::jsonb
        where escola_id = ${escolaId} and id = any(${lista}::uuid[]) and ${campo}::text ~ ${padrao}
        returning id
      `
    }
    const limite = coluna.limite
    const trocado = sql`regexp_replace(${campo}, ${padrao}, ${NOME_REMOVIDO}, 'g')`
    return sql`
      update ${tabela} set ${campo} = ${limite === undefined ? trocado : sql`left(${trocado}, ${limite})`}
      where escola_id = ${escolaId} and id = any(${lista}::uuid[]) and ${campo} ~ ${padrao}
      returning id
    `
  }
}
