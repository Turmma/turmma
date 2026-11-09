import {
  throttledWarn,
  createApiRedisClient,
  TokenIssuer,
  SecretCipher,
  JobOutbox,
  JobOutboxRepository,
  VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  globalMeter,
  type Database,
  type AuthConfig,
  type LoggerBase,
  type Meter,
} from '@educa/core'
import { Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { randomBytes } from 'node:crypto'
import { DB } from '../database.module.js'
import type { LoginConfig } from '../credencial/login-config.js'
import type { ExternalLoginConfig } from '../credencial/external-login-config.js'
import { CookieContaProvada, CookieOidc } from './external/cookie-oidc.js'
import { ExternalLoginController } from './external/external-login.controller.js'
import { ExternalLoginService } from './external/external-login.service.js'
import { OpenIdClientAdapter } from './external/openid-client.adapter.js'
import type { ExternalProviderPort } from './external/external-provider.port.js'
import { AcessoDaEscolaController } from './acesso-da-escola/acesso-da-escola.controller.js'
import { AcessoDaEscolaService } from './acesso-da-escola/acesso-da-escola.service.js'
import { AcessoDaSala } from './tenant/acesso-da-sala.js'
import { AtividadeController } from './atividade/atividade.controller.js'
import { RegistroDeAtividade } from './atividade/atividade.service.js'
import { AlunosAtivosRepository } from './atividade/alunos-ativos.repository.js'
import { LoginLockout } from '../credencial/login-lockout.js'
import { DeviceCookie } from '../credencial/device-cookie.js'
import { REDIS_LOGIN_CLIENT } from '../credencial/login-redis-client.js'
import { ConclusaoDeLogin } from './completion/login-completion.js'
import { ConviteTicket } from './convite/convite-ticket.js'
import { ConviteController } from './convite/convite.controller.js'
import { AtivacaoPorConvite, ConviteService } from './convite/convite.service.js'
import { ChallengeConsumer, ChallengeIssuer } from '../credencial/challenge.js'
import { MeController } from './eu/eu.controller.js'
import { MeRepository } from './eu/eu.repository.js'
import { MeService } from './eu/eu.service.js'
import { PasswordHasher } from '../credencial/password-hasher.js'
import { SenhaProvisoriaController } from '../credencial/senha-provisoria.controller.js'
import { SenhaProvisoriaService } from '../credencial/senha-provisoria.service.js'
import { LoginEmailController } from './login/login-email.controller.js'
import { LoginService } from './login/login.service.js'
import { LoginMatriculaController, TrocaDaProvisoriaController } from './login/matricula.controller.js'
import { LoginPorMatricula } from './login/matricula.service.js'
import { TrocaDaProvisoria } from './login/troca-da-provisoria.service.js'
import { BilheteDaTroca } from '../credencial/bilhete-da-troca.js'
import { ContaMfaController, SessaoMfaController } from './mfa/mfa.controller.js'
import { MfaService } from './mfa/mfa.service.js'
import { RedefinicaoDeMfa } from './mfa/redefinicao-de-mfa.js'
import { RedefinirMfaController } from './mfa/redefinir-mfa.controller.js'
import { RefreshController } from './refresh/renovacao.controller.js'
import { RefreshService } from './refresh/renovacao.service.js'
import { TenantResolutionRepository } from './tenant/tenant-resolution.repository.js'
import { LogoutController } from './logout/saida.controller.js'
import { PasswordVerifier } from '../credencial/senha/password-verifier.js'
import { WindowCounter } from '../credencial/senha/window-counter.js'
import { EmailIpRateLimit } from '../credencial/senha/email-ip-rate-limit.js'
import { EscolaIpThrottle } from '../credencial/senha/ip-throttle.js'
import { HashBulkhead, UnprotectedHashBulkhead } from '../credencial/senha/hash-bulkhead.js'
import { LogoutService } from './logout/saida.service.js'
import { LoginFallbackTracker } from '../credencial/login-fallback.js'
import { TrocaDeEscolaController } from './troca-de-escola/troca-de-escola.controller.js'
import { TrocaDeEscolaService } from './troca-de-escola/troca-de-escola.service.js'
import { ContaController } from './senha/conta.controller.js'
import { SenhaController } from './senha/senha.controller.js'
import { SenhaService, type PisoDoEsqueci } from './senha/senha.service.js'

/** A porta do login pela conta da escola (13.0): o adaptador `openid-client`. */
export const EXTERNAL_PROVIDER = Symbol('EXTERNAL_PROVIDER')

export interface SessaoModuleOptions {
  readonly identidade: AuthConfig
  readonly login: LoginConfig
  /** O login pela conta Google ou Microsoft da escola (13.0), desligado sem as variáveis de um provedor. */
  readonly loginExterno: ExternalLoginConfig
  readonly redisFilaUrl: string
  /** A chave que cifra o token e o endereço do link da conta na fila de envio (`EMAIL_TOKEN_KEY`), a mesma do convite. */
  readonly chaveDoEmail: Uint8Array
  /** O logger JSON do processo, o mesmo do `configureApp`: o `senha.link_na_fila` leva o `linkId`, que o `Logger` do Nest não carrega. */
  readonly logger: LoggerBase
  /** O relógio e a espera do piso do "esqueci a senha", quando o teste precisa prová-lo sem cronômetro. Sem ela, o relógio do sistema e `setTimeout`. */
  readonly pisoDoEsqueci?: PisoDoEsqueci
  /** Quantas instâncias da API dividem os limites de login quando o Redis de fila está fora (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  /** O medidor da telemetria; sem ele, o global (que o `main.ts` liga antes de montar a aplicação). */
  readonly medidor?: Meter
  /**
   * O prazo de cada comando do cliente Redis do login, quando o teste precisa fixá-lo qualquer que seja o `AMBIENTE`
   * (15.5). Sem ela, quem decide é `opcoes.login.prazoDoRedisMs`, que a configuração lê do ambiente: 100 ms em produção
   * e no staging, 2 s em `local`. O `main.ts` não conhece esta opção.
   */
  readonly prazoDoRedisMs?: number
}

/**
 * O módulo de sessão: login (por e-mail e, na 11.0, do aluno por matrícula no endereço da escola), o "esqueci a senha" e o redefinir da equipe (acesso-e-convites, 5.0), renovação, MFA (com a redefinição pela coordenação), convite do coordenador, troca de
 * escola e saída (tarefas 4.0 em diante). É o único que tem a
 * `TenantResolutionRepository`, e não a exporta: a fronteira da resolução de tenant fica dentro dele (Tech Spec,
 * seção 6).
 *
 * O contador de tentativas, os contadores por IP da 15.0 e o desafio usam o Redis de fila, com o cliente da API (sem
 * fila offline, e o prazo por comando que `LOGIN_REDIS_PRAZO_MS` dá: 100 ms em produção e no staging, 2 s em `local`):
 * fora do ar ou travado, os contadores seguem em memória, o desafio é recusado com rastro, e o login não para.
 */
@Module({})
export class SessaoModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('login')

  static forRoot(opcoes: SessaoModuleOptions): DynamicModule {
    const avisar = throttledWarn(() => SessaoModule.logger.warn('login.redis_indisponivel'))
    return {
      module: SessaoModule,
      controllers: [
        LoginEmailController,
        LoginMatriculaController,
        TrocaDaProvisoriaController,
        AcessoDaEscolaController,
        SessaoMfaController,
        ContaMfaController,
        RedefinirMfaController,
        MeController,
        RefreshController,
        AtividadeController,
        LogoutController,
        ConviteController,
        TrocaDeEscolaController,
        ExternalLoginController,
        SenhaController,
        ContaController,
        SenhaProvisoriaController,
      ],
      providers: [
        { provide: REDIS_LOGIN_CLIENT, useFactory: () => createApiRedisClient(opcoes.redisFilaUrl, 'api-login', avisar, opcoes.prazoDoRedisMs ?? opcoes.login.prazoDoRedisMs) },
        { provide: TenantResolutionRepository, useFactory: (banco: Database) => new TenantResolutionRepository(banco), inject: [DB] },
        { provide: PasswordHasher, useFactory: () => PasswordHasher.criar(opcoes.login.hash) },
        // Um semáforo por instância, dividido pelo login por e-mail e pelo por matrícula: o teto é das threads do processo.
        // Sem proteção só no controle negativo do cenário "login às 7h30" (16.0), nunca em produção (a configuração recusa).
        {
          provide: HashBulkhead,
          useFactory: () => {
            if (!opcoes.login.protecaoDesligada) return new HashBulkhead(opcoes.login.concorrenciaDoHash, opcoes.medidor ?? globalMeter())
            SessaoModule.logger.warn('login.protecao_desligada')
            return new UnprotectedHashBulkhead(opcoes.login.concorrenciaDoHash, opcoes.medidor ?? globalMeter())
          },
        },
        { provide: LoginLockout, useFactory: (cliente: Redis) => new LoginLockout(cliente, opcoes.login.chaveContador), inject: [REDIS_LOGIN_CLIENT] },
        // Os contadores por IP da 15.0 usam a mesma chave de HMAC do contador de tentativas: o Redis nunca vê o IP.
        { provide: WindowCounter, useFactory: (cliente: Redis) => new WindowCounter(cliente, opcoes.login.chaveContador), inject: [REDIS_LOGIN_CLIENT] },
        {
          provide: EscolaIpThrottle,
          useFactory: (banco: Database, janela: WindowCounter) =>
            new EscolaIpThrottle({ janela, alunosAtivos: () => new AlunosAtivosRepository(banco).contar(), instancias: opcoes.instancias, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [DB, WindowCounter],
        },
        {
          provide: EmailIpRateLimit,
          useFactory: (janela: WindowCounter, resolucao: TenantResolutionRepository) =>
            new EmailIpRateLimit({
              janela,
              limitePorMinuto: opcoes.login.limiteEmailPorIpMin,
              escolasDaRede: (ip) => resolucao.escolasDaRedeDoIpDeSaida(ip),
              instancias: opcoes.instancias,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [WindowCounter, TenantResolutionRepository],
        },
        {
          provide: PasswordVerifier,
          useFactory: (semaforo: HashBulkhead, contador: LoginLockout, hash: PasswordHasher) => new PasswordVerifier({ semaforo, contador, hash, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [HashBulkhead, LoginLockout, PasswordHasher],
        },
        // Um consumo de desafio só, dividido pelo MFA e pela troca de escola: a proporção do seguro dele é uma.
        { provide: ChallengeConsumer, useFactory: (cliente: Redis) => new ChallengeConsumer(cliente), inject: [REDIS_LOGIN_CLIENT] },
        {
          provide: LoginFallbackTracker,
          useFactory: (contador: LoginLockout, janela: WindowCounter, consumo: ChallengeConsumer) => new LoginFallbackTracker(contador, janela, consumo),
          inject: [LoginLockout, WindowCounter, ChallengeConsumer],
        },
        { provide: MeRepository, useFactory: (banco: Database) => new MeRepository(banco), inject: [DB] },
        { provide: MeService, useFactory: (eu: MeRepository, resolucao: TenantResolutionRepository) => new MeService(eu, resolucao, opcoes.medidor ?? globalMeter()), inject: [MeRepository, TenantResolutionRepository] },
        { provide: DeviceCookie, useFactory: () => new DeviceCookie(opcoes.login.dispositivo.versao, opcoes.login.dispositivo.chave) },
        {
          provide: ConclusaoDeLogin,
          useFactory: (banco: Database, dispositivo: DeviceCookie, resolucao: TenantResolutionRepository) =>
            new ConclusaoDeLogin({
              banco,
              dispositivo,
              emissorDeToken: new TokenIssuer(opcoes.identidade.chaveAssinatura),
              emissorDeDesafio: new ChallengeIssuer(opcoes.identidade.chaveAssinatura),
              ambiente: opcoes.identidade.ambiente,
              resolucao,
            }),
          inject: [DB, DeviceCookie, TenantResolutionRepository],
        },
        { provide: ConviteTicket, useFactory: () => new ConviteTicket(opcoes.identidade.chaveAssinatura) },
        { provide: AtivacaoPorConvite, useFactory: (banco: Database, bilhetes: ConviteTicket) => new AtivacaoPorConvite(banco, bilhetes), inject: [DB, ConviteTicket] },
        {
          provide: LoginService,
          useFactory: (
            resolucao: TenantResolutionRepository,
            conferencia: PasswordVerifier,
            contador: LoginLockout,
            limitePorIp: EmailIpRateLimit,
            dispositivo: DeviceCookie,
            conclusao: ConclusaoDeLogin,
            ativacao: AtivacaoPorConvite,
          ) => new LoginService({ resolucao, conferencia, contador, limitePorIp, dispositivo, conclusao, ativacao, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [TenantResolutionRepository, PasswordVerifier, LoginLockout, EmailIpRateLimit, DeviceCookie, ConclusaoDeLogin, AtivacaoPorConvite],
        },
        {
          provide: LoginPorMatricula,
          useFactory: (
            banco: Database,
            resolucao: TenantResolutionRepository,
            conferencia: PasswordVerifier,
            contador: LoginLockout,
            rebaixamento: EscolaIpThrottle,
            dispositivo: DeviceCookie,
            conclusao: ConclusaoDeLogin,
            bilhetes: BilheteDaTroca,
          ) => new LoginPorMatricula({ banco, resolucao, conferencia, contador, rebaixamento, dispositivo, conclusao, bilhetes, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [DB, TenantResolutionRepository, PasswordVerifier, LoginLockout, EscolaIpThrottle, DeviceCookie, ConclusaoDeLogin, BilheteDaTroca],
        },
        // O bilhete da troca da senha provisória (acesso-e-convites, tarefa 10.0): a mesma chave de assinatura dos outros JWT, com `typ` e `aud` só dele.
        { provide: BilheteDaTroca, useFactory: () => new BilheteDaTroca(opcoes.identidade.chaveAssinatura) },
        {
          provide: TrocaDaProvisoria,
          useFactory: (banco: Database, bilhetes: BilheteDaTroca, hash: PasswordHasher, semaforo: HashBulkhead, contador: LoginLockout, dispositivo: DeviceCookie, conclusao: ConclusaoDeLogin) =>
            new TrocaDaProvisoria({ banco, bilhetes, hash, semaforo, contador, dispositivo, conclusao }),
          inject: [DB, BilheteDaTroca, PasswordHasher, HashBulkhead, LoginLockout, DeviceCookie, ConclusaoDeLogin],
        },
        {
          provide: AcessoDaEscolaService,
          useFactory: (banco: Database, resolucao: TenantResolutionRepository, provedor: ExternalProviderPort) => new AcessoDaEscolaService(banco, resolucao, provedor.ligados),
          inject: [DB, TenantResolutionRepository, EXTERNAL_PROVIDER],
        },
        { provide: EXTERNAL_PROVIDER, useFactory: () => new OpenIdClientAdapter(opcoes.loginExterno) },
        // A porta do `sala` para a resolução (A1, tarefa 5.0): a página pública da sala acha a escola, o ano e a turma pelo
        // link ou pelo código sem importar a `TenantResolutionRepository`, que não sai deste módulo.
        { provide: AcessoDaSala, useFactory: (resolucao: TenantResolutionRepository) => new AcessoDaSala(resolucao), inject: [TenantResolutionRepository] },
        // O cookie da conta que o aluno provou na sala (acesso-e-convites, 14.0): o login externo o grava, e o pedido do nome, no `sala`, o lê e o apaga.
        // Sem provedor ligado não há chave configurada: uma chave sorteada no boot, que nenhum cookie decifra.
        { provide: CookieContaProvada, useFactory: () => new CookieContaProvada(opcoes.loginExterno.chaveDoCookie ?? new Uint8Array(randomBytes(32)), opcoes.identidade.ambiente) },
        {
          provide: ExternalLoginService,
          useFactory: (banco: Database, resolucao: TenantResolutionRepository, provedor: ExternalProviderPort, conclusao: ConclusaoDeLogin, cookieDaConta: CookieContaProvada) =>
            new ExternalLoginService({
              banco,
              resolucao,
              provedor,
              cookie: new CookieOidc(opcoes.loginExterno.chaveDoCookie ?? new Uint8Array(randomBytes(32)), opcoes.identidade.ambiente),
              cookieDaConta,
              conclusao,
              retorno: opcoes.loginExterno.retorno,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [DB, TenantResolutionRepository, EXTERNAL_PROVIDER, ConclusaoDeLogin, CookieContaProvada],
        },
        {
          provide: ConviteService,
          useFactory: (banco: Database, resolucao: TenantResolutionRepository, hash: PasswordHasher, bilhetes: ConviteTicket, verificacao: SenhaService) =>
            new ConviteService({ banco, resolucao, hash, bilhetes, verificacao, emissorDeDesafio: new ChallengeIssuer(opcoes.identidade.chaveAssinatura) }),
          inject: [DB, TenantResolutionRepository, PasswordHasher, ConviteTicket, SenhaService],
        },
        {
          provide: MfaService,
          useFactory: (
            banco: Database,
            resolucao: TenantResolutionRepository,
            contador: LoginLockout,
            dispositivo: DeviceCookie,
            conclusao: ConclusaoDeLogin,
            consumo: ChallengeConsumer,
            ativacao: AtivacaoPorConvite,
          ) =>
            new MfaService({
              banco,
              resolucao,
              contador,
              dispositivo,
              conclusao,
              ativacao,
              cifra: new SecretCipher(opcoes.login.mfa.versaoCifra, opcoes.login.mfa.chavesCifra),
              consumo,
              chaveAssinatura: opcoes.identidade.chaveAssinatura,
              chaveRecuperacao: opcoes.login.mfa.chaveRecuperacao,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [DB, TenantResolutionRepository, LoginLockout, DeviceCookie, ConclusaoDeLogin, ChallengeConsumer, AtivacaoPorConvite],
        },
        {
          provide: TrocaDeEscolaService,
          useFactory: (banco: Database, resolucao: TenantResolutionRepository, conclusao: ConclusaoDeLogin, consumo: ChallengeConsumer) =>
            new TrocaDeEscolaService({
              banco,
              resolucao,
              conclusao,
              consumo,
              emissorDeDesafio: new ChallengeIssuer(opcoes.identidade.chaveAssinatura),
              chaveAssinatura: opcoes.identidade.chaveAssinatura,
            }),
          inject: [DB, TenantResolutionRepository, ConclusaoDeLogin, ChallengeConsumer],
        },
        {
          provide: SenhaService,
          useFactory: (banco: Database, resolucao: TenantResolutionRepository, hash: PasswordHasher, semaforo: HashBulkhead, porMinuto: WindowCounter, cliente: Redis) =>
            new SenhaService({
              banco,
              resolucao,
              hash,
              semaforo,
              porMinuto,
              // O "esqueci" por e-mail digitado conta numa janela de 1 hora, com a mesma chave de HMAC do contador de tentativas: o Redis nunca vê o e-mail.
              porHora: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 60 * 60 * 1000, avisarSeguro: avisar }),
              instancias: opcoes.instancias,
              logger: opcoes.logger,
              cifra: new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, opcoes.chaveDoEmail]])),
              fila: new JobOutbox(new JobOutboxRepository(banco)),
              ...(opcoes.pisoDoEsqueci ?? {}),
            }),
          inject: [DB, TenantResolutionRepository, PasswordHasher, HashBulkhead, WindowCounter, REDIS_LOGIN_CLIENT],
        },
        {
          provide: SenhaProvisoriaService,
          useFactory: (banco: Database, hash: PasswordHasher, semaforo: HashBulkhead, cliente: Redis) =>
            new SenhaProvisoriaService({
              banco,
              hash,
              semaforo,
              // As cotas da provisória (60 por hora por quem gera, 5 por dia por aluno) contam em janelas de 1 h e de 24 h, com a mesma chave de HMAC do contador de tentativas: o Redis nunca vê o id.
              porHora: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 60 * 60 * 1000, avisarSeguro: avisar }),
              porDia: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 24 * 60 * 60 * 1000, avisarSeguro: avisar }),
              instancias: opcoes.instancias,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [DB, PasswordHasher, HashBulkhead, REDIS_LOGIN_CLIENT],
        },
        { provide: RedefinicaoDeMfa, useFactory: (banco: Database) => new RedefinicaoDeMfa(banco), inject: [DB] },
        {
          provide: RefreshService,
          useFactory: (banco: Database) =>
            new RefreshService({
              banco,
              emissorDeToken: new TokenIssuer(opcoes.identidade.chaveAssinatura),
              ambiente: opcoes.identidade.ambiente,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [DB],
        },
        { provide: RegistroDeAtividade, useFactory: (banco: Database) => new RegistroDeAtividade(banco, opcoes.medidor ?? globalMeter()), inject: [DB] },
        { provide: LogoutService, useFactory: (banco: Database) => new LogoutService(banco, opcoes.identidade.ambiente), inject: [DB] },
      ],
      // O `AcessoDaSala` vai ao `SalaModule` (A1, tarefa 5.0), e só ele: a resolução continua dentro deste módulo.
      // `RegistroDeAtividade` é o contrato para o F6: a gravação de resposta de avaliação também conta como uso. O
      // `HashBulkhead` e o `PasswordHasher` vão ao aceite do convite do operador (A0, tarefa 5.0) e à reivindicação do nome
      // na sala (A1, tarefa 6.0): o semáforo é um só por instância, porque o teto que ele guarda é o das threads do processo. Global, como o `DatabaseModule` e o
      // `RateLimitModule`, para o `OperacaoModule` receber a mesma instância sem montar outra.
      global: true,
      exports: [REDIS_LOGIN_CLIENT, LoginLockout, LoginFallbackTracker, RegistroDeAtividade, HashBulkhead, PasswordHasher, AcessoDaSala, CookieContaProvada],
    }
  }

  constructor(@Inject(REDIS_LOGIN_CLIENT) private readonly cliente: Redis) {}

  /** Depois de o servidor fechar: o login que termina durante a drenagem ainda conta a tentativa. */
  onApplicationShutdown(): void {
    this.cliente.disconnect()
  }
}
