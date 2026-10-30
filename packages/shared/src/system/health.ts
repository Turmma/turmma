/** Corpo de `GET /saude`. `ok` é falso quando o Postgres não responde (HTTP 503). */
export interface HealthResponse {
  ok: boolean
}
