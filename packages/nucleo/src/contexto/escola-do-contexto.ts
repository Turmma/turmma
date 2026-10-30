import { InvariantException } from '@educa/shared'
import { contextoAtual } from './contexto.js'

/**
 * A escola da sessão, gravada no contexto pela `GuardaDeSessao`: o escopo de todo repository que atende requisição
 * (regra 10, item 3). Sem escola no contexto, falha fechada: é erro de programação (rota autenticada sem guarda), e
 * nunca vira consulta sem a cláusula.
 */
export function exigirEscolaDoContexto(): string {
  const escolaId = contextoAtual()?.escolaId
  if (escolaId === undefined) throw new InvariantException('consulta com escopo sem escola no contexto')
  return escolaId
}
