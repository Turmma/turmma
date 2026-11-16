import { TAREFAS_DE_IA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { entradaDeAtividade } from './__fixtures__/inputs.js'
import { defineTask, type TaskDefinition } from './task.js'
import { TASK_CATALOG } from './tasks/index.js'
import { EntradaSemLimiteError, noLimite, piorEntradaDaTarefa, SOBRA_MAXIMA_DO_TETO, tokensDoPedido, tokensDoPiorPedido } from './teto-de-entrada.js'

// As sete definições têm entradas e saídas diferentes: aqui só importam o teto e o esquema, que não dependem delas.
const tarefas = Object.values(TASK_CATALOG) as unknown as ReadonlyArray<TaskDefinition<unknown, unknown>>

describe('o teto de entrada de cada tarefa é o pior pedido válido', () => {
  it('o catálogo tem as tarefas do contrato, e nenhuma fica sem ser conferida', () => {
    expect(tarefas.length).toBeGreaterThan(0)
    expect(tarefas.map((tarefa) => tarefa.nome).sort()).toEqual([...TAREFAS_DE_IA].sort())
  })

  it.each(tarefas.map((tarefa) => [tarefa.nome, tarefa] as const))('%s: o pior pedido cabe no teto, e o teto não sobra mais que a margem', (_nome, tarefa) => {
    const pior = tokensDoPiorPedido(tarefa)
    // Um teto abaixo do pior pedido recusaria pedido válido; um teto folgado demais deixaria de ser a guarda que a 4.0 declara.
    expect(tarefa.maximoDeTokensDeEntrada).toBeGreaterThanOrEqual(pior)
    expect(tarefa.maximoDeTokensDeEntrada).toBeLessThanOrEqual(Math.ceil(pior * (1 + SOBRA_MAXIMA_DO_TETO)))
  })

  it('o pedido de uso comum cabe com folga no teto da tarefa', () => {
    const comum = tokensDoPedido(TASK_CATALOG.gerar_atividade_objetiva, entradaDeAtividade())
    expect(comum).toBeLessThan(TASK_CATALOG.gerar_atividade_objetiva.maximoDeTokensDeEntrada)
  })

  it('a repetição leva a resposta anterior e os problemas: o pedido dela é maior que o primeiro, e a reserva de tokens a conta (49.0)', () => {
    const tarefa = TASK_CATALOG.gerar_atividade_objetiva
    const primeiro = tokensDoPedido(tarefa, entradaDeAtividade())
    const repeticao = tokensDoPedido(tarefa, entradaDeAtividade(), { respostaAnterior: 'x'.repeat(4_000), problemas: ['o campo questoes está vazio'] })
    expect(repeticao).toBeGreaterThan(primeiro + 500)
  })

  it('o pedido de cada tarefa passa pelo esquema de entrada, com o campo opcional que o esquema aceita presente', () => {
    const adaptacao = piorEntradaDaTarefa(TASK_CATALOG.adaptar_atividade)
    // A regra cruzada (a atividade de origem não é versão adaptada; tempo extra só com o tipo) retira o que ela recusa.
    expect(adaptacao.conteudo.adaptacao).toBeUndefined()
    expect(adaptacao.adaptacao.tempoExtraPercentual).toBeUndefined()
    const tutor = piorEntradaDaTarefa(TASK_CATALOG.turno_do_tutor)
    expect(tutor.questao).toBeDefined()
    expect(tutor.trechos).toHaveLength(8)
    expect(tutor.duvida).toHaveLength(2000)
  })

  it('a tarefa sem `maximoDeTokensDeEntrada` não compila', () => {
    const { maximoDeTokensDeEntrada: _teto, ...semTeto } = TASK_CATALOG.relatorio_da_correcao
    // @ts-expect-error o teto de entrada é obrigatório em toda tarefa
    defineTask(semTeto)
    expect(_teto).toBeGreaterThan(0)
  })
})

describe('o gerador do pior pedido: quem contorna o limite falha, um caso por forma', () => {
  const falha = (esquema: z.ZodType): string => {
    try {
      noLimite(esquema, 'raiz')
    } catch (erro) {
      if (erro instanceof EntradaSemLimiteError) return erro.message
      throw erro
    }
    return 'não falhou'
  }

  it('string sem `max`', () => {
    expect(falha(z.strictObject({ texto: z.string().min(1) }))).toBe('raiz.texto: string sem limite de tamanho (`max`)')
  })

  it('array sem `max`', () => {
    expect(falha(z.strictObject({ itens: z.array(z.string().max(5)) }))).toBe('raiz.itens: array sem limite de itens (`max`)')
  })

  it('campo aninhado sem limite, dentro de objeto dentro de array', () => {
    const esquema = z.strictObject({ recortes: z.array(z.strictObject({ disciplina: z.strictObject({ nome: z.string().min(1) }) })).max(3) })
    expect(falha(esquema)).toBe('raiz.recortes[].disciplina.nome: string sem limite de tamanho (`max`)')
  })

  it('campo sem limite num braço de união: o braço grande não esconde o sem limite', () => {
    const esquema = z.union([z.strictObject({ curto: z.string().max(3) }), z.strictObject({ solto: z.string() })])
    expect(falha(esquema)).toBe('raiz|1.solto: string sem limite de tamanho (`max`)')
  })

  it('campo opcional e anulável sem limite', () => {
    expect(falha(z.strictObject({ nota: z.string().optional() }))).toContain('raiz.nota: string sem limite')
    expect(falha(z.strictObject({ nota: z.array(z.string().max(2)).nullable() }))).toContain('raiz.nota: array sem limite')
  })

  it('o que o gerador não sabe montar também falha: formato livre, chaves livres e forma desconhecida', () => {
    expect(falha(z.strictObject({ codigo: z.string().regex(/^[A-Z]{2}\d{2}$/) }))).toContain('regra de formato')
    expect(falha(z.strictObject({ e: z.email() }))).toContain('formato "email"')
    expect(falha(z.record(z.string(), z.string()))).toContain('forma "record"')
    expect(falha(z.object({ a: z.string().max(2) }).catchall(z.string()))).toContain('chaves livres')
    expect(falha(z.strictObject({ qualquer: z.unknown() }))).toContain('forma "unknown"')
  })
})

describe('o gerador do pior pedido: o valor no limite', () => {
  it('texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço', () => {
    const esquema = z.strictObject({
      texto: z.string().min(1).max(7),
      quatro: z.array(z.string().max(2)).length(4),
      lista: z.array(z.number().int().min(0).max(9)).max(3),
      sem: z.number().int().min(0),
      ate: z.number().max(5),
      opcional: z.string().max(3).optional(),
      nulo: z.string().max(2).nullable(),
      id: z.uuid(),
      dia: z.iso.date(),
      escolha: z.enum(['a', 'longo']),
      plano: z.object({ x: z.string().max(1) }),
      braco: z.union([z.strictObject({ x: z.string().max(2) }), z.strictObject({ y: z.string().max(9) })]),
    })
    expect(noLimite(esquema)).toEqual({
      texto: 'aaaaaaa',
      quatro: ['aa', 'aa', 'aa', 'aa'],
      lista: [9, 9, 9],
      sem: Number.MAX_SAFE_INTEGER,
      ate: 5,
      opcional: 'aaa',
      nulo: 'aa',
      id: '0190f5a0-0000-7000-8000-0000000000e1',
      dia: '2026-10-05',
      escolha: 'longo',
      plano: { x: 'a' },
      braco: { y: 'aaaaaaaaa' },
    })
  })

  it('o limite exclusivo fica abaixo do valor: o inteiro em uma unidade, o decimal em meia', () => {
    expect(noLimite(z.number().int().lt(10))).toBe(9)
    expect(noLimite(z.number().lt(5))).toBe(4.5)
  })
})

describe('o gerador do pior pedido: o alvo que some', () => {
  it('tarefa sem `esquemaDeEntrada` é vermelho, e não teto sem prova', () => {
    const semEsquema = { nome: 'turno_do_tutor' as const, esquemaDeEntrada: undefined as never }
    expect(() => piorEntradaDaTarefa(semEsquema)).toThrow(EntradaSemLimiteError)
    expect(() => piorEntradaDaTarefa(semEsquema)).toThrow('tarefa sem `esquemaDeEntrada`')
  })

  /** O esquema que recusa o valor montado num caminho dado: o que a regra cruzada diz, sem trazer o valor. */
  const recusaEm = <T extends z.ZodType>(esquema: T, ...caminho: Array<string | number>) =>
    esquema.superRefine((valor, contexto) => {
      if (valor !== undefined) contexto.addIssue({ code: 'custom', path: caminho, message: 'recusado' })
    })

  it('a regra cruzada que recusa um campo opcional o retira: o pior pedido válido segue sem ele', () => {
    const esquema = z.strictObject({ a: z.string().max(3), b: z.string().max(2).optional() }).superRefine((valor, contexto) => {
      if (valor.b !== undefined) contexto.addIssue({ code: 'custom', path: ['b'], message: 'b não vale aqui' })
    })
    expect(piorEntradaDaTarefa({ nome: 'turno_do_tutor', esquemaDeEntrada: esquema })).toEqual({ a: 'aaa' })
  })

  it('o campo que a regra recusa mas não dá para retirar é vermelho: no meio de um valor nulo, dentro de um array, ou na raiz', () => {
    const mensagem = 'não passa no próprio esquema'
    // O caminho passa por um nulo: não há o que retirar, e o laço não pode quebrar com `TypeError`.
    expect(() => piorEntradaDaTarefa({ nome: 'turno_do_tutor', esquemaDeEntrada: recusaEm(z.strictObject({ x: z.null() }), 'x', 'y', 'z') })).toThrow(mensagem)
    expect(() => piorEntradaDaTarefa({ nome: 'turno_do_tutor', esquemaDeEntrada: recusaEm(z.strictObject({ x: z.null() }), 'x', 'y') })).toThrow(mensagem)
    // Item de array não se retira (a lista ficaria com buraco, e o valor passaria por um pedido que ninguém faz).
    const lista = z.strictObject({ lista: z.array(z.string().max(2).optional()).max(2) }).superRefine((valor, contexto) => {
      if (valor.lista[0] !== undefined) contexto.addIssue({ code: 'custom', path: ['lista', 0], message: 'recusado' })
    })
    expect(() => piorEntradaDaTarefa({ nome: 'turno_do_tutor', esquemaDeEntrada: lista })).toThrow(mensagem)
  })

  it('a regra que recusa sempre o mesmo campo opcional: ele é retirado uma vez, e na volta seguinte o gerador fica vermelho', () => {
    // Na segunda volta o campo já não existe, e retirá-lo não muda nada: sem a conferência de que ele existe, o laço não terminaria.
    const esquema = z.strictObject({ a: z.string().max(3), b: z.string().max(2).optional() }).superRefine((_, contexto) => {
      contexto.addIssue({ code: 'custom', path: ['b'], message: 'recusado' })
    })
    expect(() => piorEntradaDaTarefa({ nome: 'turno_do_tutor', esquemaDeEntrada: esquema })).toThrow('não passa no próprio esquema')
  })

  it('o valor que nem passa no próprio esquema é vermelho: regra cruzada que o gerador não alcança', () => {
    const esquema = z.strictObject({ a: z.string().max(3) }).refine((valor) => valor.a === 'x', { message: 'só x' })
    expect(() => piorEntradaDaTarefa({ nome: 'turno_do_tutor', esquemaDeEntrada: esquema })).toThrow('não passa no próprio esquema')
  })
})
