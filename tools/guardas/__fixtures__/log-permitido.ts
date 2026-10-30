// O jeito certo de logar: evento fixo e ids. Nenhuma linha aqui pode sair com guarda.
declare const logger: Record<'info' | 'warn' | 'error' | 'fatal' | 'child', (...argumentos: unknown[]) => void>
declare const nest: { log(mensagem: string, contexto: string): void }
declare const aluno: { id: string; turmaId: string }
declare const nota: { id: string; valor: number }
declare const uso: { prompt_tokens: number }
declare const resposta: { status: number }
declare const escolaId: string
declare const avaliacaoId: string
declare const fila: string
declare const inicioMs: number
declare const erro: Error
declare const evento: string
declare const erroSemPilha: object
declare function summarizeError(erro: unknown): object

logger.info({ evento: 'correcao.concluida', escolaId, avaliacaoId, alunoId: aluno.id })
logger.warn({ evento: 'nota.aprovada', notaId: nota.id, aluno: { id: aluno.id, turmaId: aluno.turmaId } })
logger.info({ evento: 'nota.aprovada', notaIds: [nota.id], tipo: nota.id.toString() })
logger.error({ evento: 'http.erro', status: 500, erro })
logger.error(erro)
logger.info({ evento: 'boot' }, 'mensagem fixa')
logger.info(`mensagem fixa em template`)
logger.info('mensagem ' + 'fixa')
logger.info({ evento: 'lote', total: 1 + 2, lista: [1, 'a', null, -1, undefined] })
logger.info({ evento: 'job.concluido', fila, duracaoMs: Date.now() - inicioMs, criadoEm: new Date() })
logger.fatal({ evento, erro: summarizeError(erro) })
logger.warn({ evento: 'http.erro', status: resposta.status, erro: erroSemPilha, causa: erro })
logger.info({ evento: 'nota.aprovada', notaId: nota.id.toString(), alunoIds: [aluno.id], tipo: erro ? 'a' : 'b' })
logger.info({ evento: 'ia.execucao', promptTokens: uso.prompt_tokens, respostaStatus: resposta.status, promptVersao: 'v3' })
logger.info({ evento: 'teste', alunoId: aluno.id as string, turmaId: aluno?.turmaId })
logger.child({ servico: 'worker' })
nest.log('banco.conexao_ociosa_perdida', 'banco')
Math.log(nota.valor)
