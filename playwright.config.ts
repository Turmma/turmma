import { defineConfig, devices } from '@playwright/test'
import { MOBILE_PROFILE, CHROMEBOOK_PROFILE, type ProfileOptions } from './e2e/support/profiles.ts'
import { lerAmbienteDeTeste, valorObrigatorio } from './tools/ci/compose.ts'
import { relatoriosDoPlaywright, VARIAVEL_DO_RELATORIO_DO_E2E } from './tools/ci/duracao-do-e2e.ts'

// O e2e roda contra o compose de teste (`npm run test:e2e` ou `npm run ci:e2e`), nunca contra servidor de dev.
const ambienteDeTeste = lerAmbienteDeTeste()
const urlBase = `http://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'WEB_PORTA_HOST')}`

/**
 * O `oidc-falso` do compose (13.0) anuncia os endereços dele com o nome do serviço, `oidc-falso:8080`, que é como a
 * API o alcança dentro da rede do compose. O navegador do Playwright roda na máquina, onde esse nome não existe: sem
 * isto, o botão da conta da escola levaria a um endereço que o navegador não resolve.
 *
 * A regra do resolvedor do Chromium manda esse nome e porta para a porta publicada no host. O cabeçalho `Host`
 * continua sendo `oidc-falso:8080`, e por isso o emissor que o provedor falso anuncia continua o mesmo que a API
 * validou no discovery: nada muda no que a API confere.
 */
const emissorDoOidcFalso = new URL(valorObrigatorio(ambienteDeTeste, 'LOGIN_EXTERNO_GOOGLE_EMISSOR'))
const regraDeNomeDoOidcFalso = `MAP ${emissorDoOidcFalso.host} 127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'OIDC_FALSO_PORTA_HOST')}`

/**
 * Todo spec de tela roda nos dois projetos (D51), sem `testMatch` nem `testIgnore` por projeto. Os dois são
 * Chromium: a limitação de CPU e de rede vem do CDP, que só ele tem.
 */
export default defineConfig<ProfileOptions>({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: process.env['CI'] === 'true',
  retries: 0,
  // Com `EDUCA_RELATORIO_DO_E2E`, o portão da tarefa também recebe a duração de cada caso (`tools/ci/duracao-do-e2e.ts`).
  reporter: relatoriosDoPlaywright(process.env['CI'] === 'true', process.env[VARIAVEL_DO_RELATORIO_DO_E2E]),
  use: {
    baseURL: urlBase,
    locale: 'pt-BR',
    // A aparência Sistema segue o aparelho (X1, RF3): sem fixar, o oráculo em `rgb()` de cada spec dependeria da máquina que
    // roda. O escuro é pedido por teste, com `emulateMedia`, ou por `data-tema`.
    colorScheme: 'light',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    launchOptions: { args: [`--host-resolver-rules=${regraDeNomeDoOidcFalso}`] },
  },
  projects: [
    {
      // Chromebook de entrada: tela de 1366 × 768, CPU ×4 e Fast 3G.
      name: 'chromebook',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, profile: CHROMEBOOK_PROFILE },
    },
    {
      // Celular de entrada: 360 × 800, toque, CPU ×4 e rede móvel lenta.
      name: 'celular',
      use: {
        browserName: 'chromium',
        userAgent: devices['Pixel 7'].userAgent,
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        profile: MOBILE_PROFILE,
      },
    },
  ],
})
