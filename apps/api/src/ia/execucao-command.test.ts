import { runInContext, turnoDoTutor, type DatabaseTransaction, type LLMProvider } from '@educa/core'
import type { ResultadoGravado } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { comoExecutavel, type ExecucaoCommand, type EntradaDaTarefa, type SaidaDaTarefa, type GravadorDaConclusao } from './execucao-command.js'

// O que o comando faz entre o modelo e a conclusão: o que se grava antes da transação da conclusão (a D36) não a abre com uma segunda conexão por dentro dela.

const ENTRADA: EntradaDaTarefa<typeof turnoDoTutor> = { duvida: 'dúvida', contexto: { serie: '2º ano do Ensino Médio', disciplina: 'Química' }, trechos: [], memoria: [], turnosAnteriores: [] }
const SAIDA: SaidaDaTarefa<typeof turnoDoTutor> = { classificacao: 'assunto_delicado', resposta: 'mensagem fixa', citacoes: [] }
const GRAVADO: ResultadoGravado = { tipo: 'mensagem_do_tutor', mensagemId: randomUUID() }
const DO_CONCLUIR: ResultadoGravado = { tipo: 'mensagem_do_tutor', mensagemId: randomUUID() }

function montar(antes: ExecucaoCommand<EntradaDaTarefa<typeof turnoDoTutor>, SaidaDaTarefa<typeof turnoDoTutor>, null>['antesDeConcluir']) {
  const concluir = vi.fn((): Promise<ResultadoGravado> => Promise.resolve(DO_CONCLUIR))
  const comando = comoExecutavel<EntradaDaTarefa<typeof turnoDoTutor>, SaidaDaTarefa<typeof turnoDoTutor>, null>({
    tarefa: turnoDoTutor,
    fila: 'interativa',
    preparar: () => Promise.resolve({ entrada: ENTRADA, lido: null }),
    ...(antes === undefined ? {} : { antesDeConcluir: antes }),
    concluir,
  })
  const ia: LLMProvider = { generate: () => Promise.resolve({ saida: SAIDA, medicao: {} } as never) }
  // O gravador de verdade abre uma transação; aqui ele só entrega uma e conta quantas vezes foi aberto.
  const aberturas = vi.fn()
  const gravar: GravadorDaConclusao = (corpo) => {
    aberturas()
    return corpo({} as DatabaseTransaction, randomUUID())
  }
  const rodar = () =>
    runInContext({ requisicaoId: randomUUID(), escolaId: randomUUID() }, () =>
      comando.run({ id: randomUUID(), tarefa: 'turno_do_tutor', chaveEnvio: randomUUID(), entrada: { tarefa: 'turno_do_tutor' } }, ia, new AbortController().signal, gravar),
    )
  return { concluir, aberturas, rodar }
}

describe('o comando executável', () => {
  it('com `antesDeConcluir` devolvendo o resultado, a conclusão só o registra: o `concluir` não roda e a transação abre uma vez', async () => {
    const antes = vi.fn((): Promise<ResultadoGravado | undefined> => Promise.resolve(GRAVADO))
    const { concluir, aberturas, rodar } = montar(antes)
    expect(await rodar()).toEqual(GRAVADO)
    expect(antes).toHaveBeenCalledTimes(1)
    expect(concluir).not.toHaveBeenCalled()
    expect(aberturas).toHaveBeenCalledTimes(1)
  })

  it('o que `antesDeConcluir` grava já está gravado quando a transação da conclusão abre', async () => {
    const ordem: string[] = []
    const { aberturas, rodar } = montar(() => {
      ordem.push('antes')
      return Promise.resolve(GRAVADO)
    })
    aberturas.mockImplementation(() => ordem.push('conclusão'))
    await rodar()
    expect(ordem).toEqual(['antes', 'conclusão'])
  })

  it('sem resultado de `antesDeConcluir`, ou sem ele, o `concluir` roda na transação da conclusão', async () => {
    for (const antes of [() => Promise.resolve(undefined), undefined]) {
      const { concluir, rodar } = montar(antes)
      expect(await rodar()).toEqual(DO_CONCLUIR)
      expect(concluir).toHaveBeenCalledTimes(1)
    }
  })
})
