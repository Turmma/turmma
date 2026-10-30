/**
 * Corpo de `GET /prontidao` da API e do realtime. `pronta` é falso (HTTP 503) enquanto a
 * instância drena para sair: é a sonda da borda, e não consulta banco nem Redis.
 */
export interface ReadinessResponse {
  pronta: boolean
}
