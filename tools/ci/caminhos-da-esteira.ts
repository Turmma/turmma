// Os caminhos que a esteira conta como código (`ehCodigoParaAEsteira`, `portao.ts`) e os que conta como documento, escritos por extenso e
// numa lista só. Quem prova a classificação (`conferir-entregas.test.ts`) e quem prova que a `decidirCommit` conta o mesmo
// (`revisoes.test.ts`, RF16) importam daqui: uma lista que crescesse num dos dois e não no outro deixaria os dois verdes.

export const CODIGO_PARA_A_ESTEIRA: readonly string[] = [
  'apps/api/src/x.ts',
  'packages/core/src/x.ts',
  'infra/Caddyfile',
  'e2e/x.spec.ts',
  'tools/ci/x.ts',
  '.github/workflows/ci.yml',
  '.claude/hooks/x.sh',
  'docs/aia/ouro/x.json',
  'docs/aia/ouro-retido/x.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  'package.json',
  'compose.yaml',
  '.env.example',
  'eslint.config.mjs',
  'eslint-suppressions.json',
  'vitest.config.ts',
  'playwright.config.ts',
  'tsconfig.base.json',
  'knip.json',
  '.gitleaks.toml',
  '.size-limit.json',
]

export const DOCUMENTO_PARA_A_ESTEIRA: readonly string[] = [
  'skills-lock.json',
  'package-lock.json',
  'README.md',
  'tasks/prd-x/tasks.md',
  'docs/guia.md',
  'docs/aia/tutor.md',
  '.claude/skills/x/SKILL.md',
  '.claude/rules/40-testes.md',
  '.claude/agents/implementador.md',
  '.claude/settings/x.json',
  '.claude/settings.json.bak',
  'sub/.claude/settings.json',
  'tsconfig.base.json.bak',
  'sub/tsconfig.json',
  'docs/tsconfig.json',
  'docs/package.json',
]
