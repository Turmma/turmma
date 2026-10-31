import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as loginService from './login.service.js'

/** Os sete nomes que moravam aqui e foram para `request-origin.ts`, `login-identifiers.ts` e `login-completion.ts`. */
const NOMES_QUE_SAIRAM = ['OrigemDaRequisicao', 'ResultadoDoLogin', 'BYTES_DO_REFRESH', 'normalizarEmail', 'hashDoRefresh', 'etapaDoLogin', 'ipParaRegistro']

describe('o login.service não reexporta o que saiu dele', () => {
  it('o módulo só exporta o LoginService', () => {
    expect(Object.keys(loginService)).toEqual(['LoginService'])
  })

  it('nenhuma exportação do arquivo cita um dos sete nomes, que os tipos não aparecem em Object.keys', () => {
    const codigo = readFileSync(new URL('./login.service.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    // Lista de nomes (em quantas linhas for), `export *` e declaração: cada uma é uma exportação do módulo.
    const exportacoes = [...codigo.matchAll(/\bexport\s+(?:type\s+)?\{[^}]*\}|\bexport\s+\*[^\n]*|\bexport\s+(?:declare\s+)?(?:const|let|function|interface|type|class|enum)\s+\w+/g)].map((achado) => achado[0])
    expect(exportacoes.length).toBeGreaterThan(0)
    expect(exportacoes.filter((exportacao) => NOMES_QUE_SAIRAM.some((nome) => new RegExp(`\\b${nome}\\b`).test(exportacao)) || /^export\s+\*/.test(exportacao))).toEqual([])
  })
})
