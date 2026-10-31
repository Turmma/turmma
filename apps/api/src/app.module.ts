import {
  PermissaoBootCheck,
  OperationalSettings,
  UsageMeter,
  GracefulShutdown,
  AuthGuard,
  RateLimitGuard,
  PermissaoGuard,
  SessaoGuard,
  createLogger,
  UsageInterceptor,
  RateLimiter,
  globalMeter,
  TrustedProxies,
  SessaoRepository,
  type FileStorage,
  type Database,
  type RateLimits,
  type LoggerBase,
  type Meter,
  type Clock,
} from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR, DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core'
import { ArtefatoModule } from './artefato/artefato.module.js'
import { AssistenteModule } from './assistente/assistente.module.js'
import { AtividadeModule } from './atividade/atividade.module.js'
import { BANCO, BancoModule } from './database.module.js'
import type { ConfiguracaoApi } from './config.js'
import { EntregaModule } from './entrega/entrega.module.js'
import { EstruturaModule } from './estrutura/estrutura.module.js'
import { GovernancaModule } from './governanca/governanca.module.js'
import { IaModule } from './ia/ia.module.js'
import { LIMITES_DA_ESCOLA, LimiteModule } from './rate-limit.module.js'
import { MaterialModule } from './material/material.module.js'
import { OperacaoModule } from './operacao/operacao.module.js'
import { PrivacidadeModule } from './privacidade/privacidade.module.js'
import { ProfessoresModule } from './professores/professores.module.js'
import type { SorteioDoCodigo } from './sala/codigo-da-sala.js'
import { SalaModule } from './sala/sala.module.js'
import { SessaoModule } from './sessao/index.js'
import { ProntidaoController } from './system/readiness.controller.js'
import { SistemaModule } from './system/system.module.js'
import { TutorModule } from './tutor/tutor.module.js'
import { UsoModule } from './usage.module.js'

/** O que a montagem passa ao `AppModule`: o `main.ts` passa só o `logger`; o resto, só o teste. */
export interface OpcoesDeMontagem {
  /**
   * O logger JSON do processo, o mesmo do `configurarAplicacao`, para a linha que precisa de campo além do evento
   * (`sala.limite_atingido`, com o tipo e a escola). Sem ele, um logger JSON próprio no stdout.
   */
  readonly logger?: LoggerBase
  readonly medidor?: Meter
  readonly prazoDoRedisDeLoginMs?: number
  /** O sorteio do código da turma que o teste da colisão (C6) repete. */
  readonly sortearCodigoDaSala?: SorteioDoCodigo
  /**
   * O armazém do arquivo do titular que o teste usa no lugar do S3 da configuração (F3, 13.0): o falso, que o teste também
   * entrega ao processador do worker, para conferir o que foi gravado e derrubar o storage. Nunca vem do ambiente.
   */
  readonly armazemDeArquivos?: FileStorage
  /** O relógio do arquivo do titular (validade de 7 dias e da URL), que o teste injeta. Nunca vem do ambiente. */
  readonly relogioDaPrivacidade?: Clock
}

@Module({})
export class AppModule {
  /**
   * @param opcoes o `main.ts` passa só o `logger`, e o teste passa também o resto: `medidor`, para ler as métricas do
   * login e da sessão (sem ele, vale o medidor global); `prazoDoRedisDeLoginMs`, que fixa o prazo do cliente Redis do
   * login qualquer que seja a configuração. Sem ela, quem decide é `LOGIN_REDIS_PRAZO_MS`, por
   * `config.login.prazoDoRedisMs`; `sortearCodigoDaSala`, o sorteio do código da turma que o teste da colisão repete (C6).
   * Nenhuma das opções vem do ambiente.
   */
  static com(config: ConfiguracaoApi, opcoes: OpcoesDeMontagem = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DiscoveryModule,
        BancoModule.com(config.banco),
        LimiteModule.com(config.limite),
        UsoModule.com(config.redisFilaUrl),
        SessaoModule.com({
          identidade: config.identidade,
          login: config.login,
          loginExterno: config.loginExterno,
          redisFilaUrl: config.redisFilaUrl,
          instancias: config.limite.instancias,
          ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }),
          ...(opcoes.prazoDoRedisDeLoginMs === undefined ? {} : { prazoDoRedisMs: opcoes.prazoDoRedisDeLoginMs }),
        }),
        EstruturaModule,
        ProfessoresModule,
        MaterialModule.com(opcoes.logger ?? createLogger({ servico: 'api' })),
        IaModule.com({ config: config.ia, ...(opcoes.logger === undefined ? {} : { logger: opcoes.logger }) }),
        AssistenteModule.com({ chaveContador: config.login.chaveContador, instancias: config.limite.instancias, logger: opcoes.logger ?? createLogger({ servico: 'api' }) }),
        ArtefatoModule,
        EntregaModule,
        AtividadeModule,
        TutorModule,
        GovernancaModule,
        PrivacidadeModule.com({
          armazem: config.armazem,
          ...(opcoes.armazemDeArquivos === undefined ? {} : { armazemDeTeste: opcoes.armazemDeArquivos }),
          ...(opcoes.relogioDaPrivacidade === undefined ? {} : { relogio: opcoes.relogioDaPrivacidade }),
        }),
        SalaModule.com({
          config: config.sala,
          chaveContador: config.login.chaveContador,
          instancias: config.limite.instancias,
          logger: opcoes.logger ?? createLogger({ servico: 'api' }),
          ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }),
          ...(opcoes.sortearCodigoDaSala === undefined ? {} : { sortearCodigo: opcoes.sortearCodigoDaSala }),
        }),
        OperacaoModule.com(config.identidade, { dispositivo: config.login.dispositivo, mfa: config.login.mfa, ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }) }),
        SistemaModule.com({
          rotasSinteticas: config.rotasSinteticas,
          versao: config.versao,
          ambiente: config.identidade.ambiente,
          avisos: config.avisos,
        }),
      ],
      // A prontidão é da instância, e a drenagem fica no módulo raiz: o Nest encerra o módulo raiz
      // por último, e o prazo da drenagem só é desarmado depois de o pool do banco fechar.
      controllers: [ProntidaoController],
      providers: [
        { provide: GracefulShutdown, useValue: new GracefulShutdown(config.drenagem) },
        {
          // No boot: rota sem @RequirePermissao e sem @Public não sobe (RF17).
          provide: PermissaoBootCheck,
          useFactory: (descoberta: DiscoveryService) => new PermissaoBootCheck(descoberta),
          inject: [DiscoveryService],
        },
        // As guardas globais rodam na ordem de registro (Tech Spec, seção 1): JWT, limite, sessão, permissão. A rota
        // `@RotaDeOperacao` passa pelas quatro como sem sessão de escola e só então pela `GuardaDeOperador`, que o
        // marcador aplica no handler (Tech Spec da A0, seção 1).
        {
          // 1. Só o JWT, sem banco nem Redis: toda rota exige token, salvo as marcadas com `@Public()`.
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new AuthGuard(reflector, config.identidade),
          inject: [Reflector],
        },
        {
          // 2. O limite pelo `sub` e pelo `esc` do token verificado, com os limites da escola: rajada acima do
          // limite é recusada antes de chegar ao Postgres. Na rota `@RotaDeOperacao`, pelo `sub` do token de operador.
          provide: APP_GUARD,
          useFactory: (reflector: Reflector, limitador: RateLimiter, proxies: TrustedProxies, limites: OperationalSettings<RateLimits>) =>
            new RateLimitGuard(reflector, limitador, proxies, limites, config.identidade),
          inject: [Reflector, RateLimiter, TrustedProxies, LIMITES_DA_ESCOLA],
        },
        { provide: SessaoRepository, useFactory: (banco: Database) => new SessaoRepository(banco), inject: [BANCO] },
        {
          // 3. A sessão no Postgres, sem cache: grava escola, usuário, papel, sessão e ano letivo no contexto.
          provide: APP_GUARD,
          useFactory: (reflector: Reflector, sessoes: SessaoRepository) => new SessaoGuard(reflector, sessoes, opcoes.medidor ?? globalMeter()),
          inject: [Reflector, SessaoRepository],
        },
        {
          // 4. O papel da sessão contra a célula da `MATRIZ` que a rota declarou em `@RequirePermissao`.
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new PermissaoGuard(reflector),
          inject: [Reflector],
        },
        {
          // Interceptor roda depois das guardas: conta só a requisição autenticada e dentro do limite,
          // na escola da sessão.
          provide: APP_INTERCEPTOR,
          useFactory: (contador: UsageMeter) => new UsageInterceptor(contador),
          inject: [UsageMeter],
        },
      ],
    }
  }
}
