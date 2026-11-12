import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS } from './envio-de-material.repository.js'

/**
 * O `statement_timeout` da API (`BANCO_TIMEOUT_CONSULTA_MS`, lido por `databaseEnvSchema` em `packages/core/src/db/database.ts`). O valor vem só do `.env.example`:
 * `compose.yaml` (`env_file: .env.example`) e `infra/compose.yml` ("toda variável vem de `.env.example`") não o sobrescrevem em lugar nenhum, então é o mesmo que a
 * produção e o compose de teste usam. Se um dia outro arquivo o sobrescrever, este teste deixa de ver, e a regra de onde o valor mora é que muda.
 */
function timeoutDeConsultaDaApiMs(): number {
  const texto = readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8')
  const valor = /^BANCO_TIMEOUT_CONSULTA_MS=(\d+)\s*$/m.exec(texto)?.[1]
  if (valor === undefined) throw new Error('BANCO_TIMEOUT_CONSULTA_MS não está no .env.example')
  return Number(valor)
}

describe('a espera pela linha do envio', () => {
  it('é de 1 s, e menor que o `statement_timeout` da API: o `lock_timeout` estoura antes e dá `55P03` (503), em vez de `57014`', () => {
    expect(ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS).toBe(1_000)
    expect(ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS).toBeLessThan(timeoutDeConsultaDaApiMs())
  })
})
