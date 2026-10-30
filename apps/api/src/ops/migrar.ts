import { InvalidConfigError, createLogger, migrate, validateEnvironment } from '@educa/nucleo'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'

/**
 * Serviço `migrar` do compose: aplica as migrations antes de qualquer instância subir e sai.
 * A saída é só log JSON, com evento, tentativa e SQLSTATE.
 */

const inteiroPositivo = z.coerce.number().int().positive()

const esquemaAmbienteMigrar = z.object({
  BANCO_URL: z.string().regex(/^postgres(ql)?:\/\/[^/]+\/[^/]+$/),
  BANCO_TIMEOUT_CONEXAO_MS: inteiroPositivo,
  MIGRAR_TIMEOUT_CONSULTA_MS: inteiroPositivo,
})

async function executar(): Promise<void> {
  const logger = createLogger({ servico: 'migrar' })
  try {
    const valores = validateEnvironment(esquemaAmbienteMigrar, process.env)
    await migrate(
      { url: valores.BANCO_URL, timeoutConexaoMs: valores.BANCO_TIMEOUT_CONEXAO_MS, timeoutConsultaMs: valores.MIGRAR_TIMEOUT_CONSULTA_MS },
      logger,
    )
  } catch (erro) {
    // A mensagem de configuração inválida cita só o nome da variável; o resto sai resumido pelo logger.
    if (erro instanceof InvalidConfigError) process.stderr.write(`${erro.message}\n`)
    logger.fatal({ evento: 'migracao.abortada', erro })
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await executar()
}
