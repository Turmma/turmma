/**
 * O id de um pedido que a pessoa pode repetir sem duplicar (Tech Spec da A0b, seção 5, "Idempotência"; Tech Spec do F3,
 * seção 4, "A chave de envio é de quem registrou"): um UUID v4, sorteado quando o diálogo abre e esquecido quando ele
 * fecha. O clique duplo e a nova tentativa depois de uma resposta perdida mandam o mesmo id, e o servidor devolve o que
 * já criou em vez de criar outro. Serve ao pedido de rede e de escola da operação e à `chaveEnvio` do pedido do titular.
 *
 * Pelo `crypto.getRandomValues`, e não pelo `crypto.randomUUID`: o segundo só existe em contexto seguro, e o sorteio não
 * pode depender de como o endereço foi aberto.
 */
export function sortearIdDoPedido(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // Versão 4 no nibble alto do byte 6, e a variante RFC 4122 (`10xx`) no byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
