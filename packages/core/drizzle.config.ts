import { defineConfig } from 'drizzle-kit'

// Gera a migration a partir do schema: `npx drizzle-kit generate --config packages/core/drizzle.config.ts`.
// A migration gerada é revisada e versionada; quem aplica é o serviço `migrar` (src/db/migrar.ts).
export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: './packages/core/src/db/schema/*.ts',
  out: './packages/core/drizzle',
})
