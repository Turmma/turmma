import {
  throttledWarn,
  createApiRedisClient,
  TokenIssuer,
  globalMeter,
  type Database,
  type AuthConfig,
  type Meter,
} from '@educa/core'
import { Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { randomBytes } from 'node:crypto'
import { BANCO } from '../banco.module.js'
import type { ConfiguracaoLogin } from '../credencial/configuracao-de-login.js'
import type { ConfiguracaoLoginExterno } from '../credencial/configuracao-externa.js'
import { CookieOidc } from './externa/cookie-oidc.js'
import { LoginExternoController } from './externa/externa.controller.js'
import { LoginExterno } from './externa/externa.service.js'
import { OpenIdClientAdapter } from './externa/openid-client.adapter.js'
import type { ProvedorExternoPort } from './externa/provedor-externo.port.js'
import { AcessoDaEscolaController } from './acesso-da-escola/acesso-da-escola.controller.js'
import { AcessoDaEscolaService } from './acesso-da-escola/acesso-da-escola.service.js'
import { AcessoDaSala } from './tenant/acesso-da-sala.js'
import { AtividadeController } from './atividade/atividade.controller.js'
import { RegistroDeAtividade } from './atividade/atividade.service.js'
import { AlunosAtivosRepository } from './atividade/alunos-ativos.repository.js'
import { ContadorDeTentativas } from '../credencial/contador-de-tentativas.js'
import { CookieDeDispositivo } from '../credencial/cookie-dispositivo.js'
import { CifraDoSegredo } from '../credencial/cifra-do-segredo.js'
import { CLIENTE_REDIS_LOGIN } from '../credencial/cliente-redis-login.js'
import { ConclusaoDeLogin } from './conclusao/conclusao-de-login.js'
import { BilheteDeConvite } from './convite/bilhete-de-convite.js'
import { ConviteController } from './convite/convite.controller.js'
import { AtivacaoPorConvite, ConviteService } from './convite/convite.service.js'
import { ConsumoDeDesafio, EmissorDeDesafio } from '../credencial/desafio.js'
import { EuController } from './eu/eu.controller.js'
import { EuRepository } from './eu/eu.repository.js'
import { EuService } from './eu/eu.service.js'
import { HashDeSenha } from '../credencial/hash-de-senha.js'
import { LoginEmailController } from './login/login-email.controller.js'
import { LoginService } from './login/login.service.js'
import { LoginMatriculaController } from './login/matricula.controller.js'
import { LoginPorMatricula } from './login/matricula.service.js'
import { ContaMfaController, SessaoMfaController } from './mfa/mfa.controller.js'
import { MfaService } from './mfa/mfa.service.js'
import { RedefinicaoDeMfa } from './mfa/redefinicao-de-mfa.js'
import { RedefinirMfaController } from './mfa/redefinir-mfa.controller.js'
import { RenovacaoController } from './renovacao/renovacao.controller.js'
import { RenovacaoService } from './renovacao/renovacao.service.js'
import { ResolucaoDeTenantRepository } from './tenant/resolucao-de-tenant.repository.js'
import { SaidaController } from './saida/saida.controller.js'
import { ConferenciaNaVez } from '../credencial/senha/conferencia-na-vez.js'
import { ContadorEmJanela } from '../credencial/senha/contador-em-janela.js'
import { LimiteDoEmailPorIp } from '../credencial/senha/limite-email-ip.js'
import { RebaixamentoPorEscola } from '../credencial/senha/rebaixamento.js'
import { SemaforoDeHash, SemaforoSemProtecao } from '../credencial/senha/semaforo-de-hash.js'
import { SaidaService } from './saida/saida.service.js'
import { SeguroDoLogin } from '../credencial/seguro-do-login.js'
import { TrocaDeEscolaController } from './troca-de-escola/troca-de-escola.controller.js'
import { TrocaDeEscolaService } from './troca-de-escola/troca-de-escola.service.js'

/** A porta do login pela conta da escola (13.0): o adaptador `openid-client`. */
export const PROVEDOR_EXTERNO = Symbol('PROVEDOR_EXTERNO')

export interface OpcoesDoModuloDeSessao {
  readonly identidade: AuthConfig
  readonly login: ConfiguracaoLogin
  /** O login pela conta Google ou Microsoft da escola (13.0), desligado sem as variáveis de um provedor. */
  readonly loginExterno: ConfiguracaoLoginExterno
  readonly redisFilaUrl: string
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
 * O módulo de sessão: login (por e-mail e, na 11.0, do aluno por matrícula no endereço da escola), renovação, MFA (com a redefinição pela coordenação), convite do coordenador, troca de
 * escola e saída (tarefas 4.0 em diante). É o único que tem a
 * `ResolucaoDeTenantRepository`, e não a exporta: a fronteira da resolução de tenant fica dentro dele (Tech Spec,
 * seção 6).
 *
 * O contador de tentativas, os contadores por IP da 15.0 e o desafio usam o Redis de fila, com o cliente da API (sem
 * fila offline, e o prazo por comando que `LOGIN_REDIS_PRAZO_MS` dá: 100 ms em produção e no staging, 2 s em `local`):
 * fora do ar ou travado, os contadores seguem em memória, o desafio é recusado com rastro, e o login não para.
 */
@Module({})
export class SessaoModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('login')

  static com(opcoes: OpcoesDoModuloDeSessao): DynamicModule {
    const avisar = throttledWarn(() => SessaoModule.logger.warn('login.redis_indisponivel'))
    return {
      module: SessaoModule,
      controllers: [
        LoginEmailController,
        LoginMatriculaController,
        AcessoDaEscolaController,
        SessaoMfaController,
        ContaMfaController,
        RedefinirMfaController,
        EuController,
        RenovacaoController,
        AtividadeController,
        SaidaController,
        ConviteController,
        TrocaDeEscolaController,
        LoginExternoController,
      ],
      providers: [
        { provide: CLIENTE_REDIS_LOGIN, useFactory: () => createApiRedisClient(opcoes.redisFilaUrl, 'api-login', avisar, opcoes.prazoDoRedisMs ?? opcoes.login.prazoDoRedisMs) },
        { provide: ResolucaoDeTenantRepository, useFactory: (banco: Database) => new ResolucaoDeTenantRepository(banco), inject: [BANCO] },
        { provide: HashDeSenha, useFactory: () => HashDeSenha.criar(opcoes.login.hash) },
        // Um semáforo por instância, dividido pelo login por e-mail e pelo por matrícula: o teto é das threads do processo.
        // Sem proteção só no controle negativo do cenário "login às 7h30" (16.0), nunca em produção (a configuração recusa).
        {
          provide: SemaforoDeHash,
          useFactory: () => {
            if (!opcoes.login.protecaoDesligada) return new SemaforoDeHash(opcoes.login.concorrenciaDoHash, opcoes.medidor ?? globalMeter())
            SessaoModule.logger.warn('login.protecao_desligada')
            return new SemaforoSemProtecao(opcoes.login.concorrenciaDoHash, opcoes.medidor ?? globalMeter())
          },
        },
        { provide: ContadorDeTentativas, useFactory: (cliente: Redis) => new ContadorDeTentativas(cliente, opcoes.login.chaveContador), inject: [CLIENTE_REDIS_LOGIN] },
        // Os contadores por IP da 15.0 usam a mesma chave de HMAC do contador de tentativas: o Redis nunca vê o IP.
        { provide: ContadorEmJanela, useFactory: (cliente: Redis) => new ContadorEmJanela(cliente, opcoes.login.chaveContador), inject: [CLIENTE_REDIS_LOGIN] },
        {
          provide: RebaixamentoPorEscola,
          useFactory: (banco: Database, janela: ContadorEmJanela) =>
            new RebaixamentoPorEscola({ janela, alunosAtivos: () => new AlunosAtivosRepository(banco).contar(), instancias: opcoes.instancias, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [BANCO, ContadorEmJanela],
        },
        {
          provide: LimiteDoEmailPorIp,
          useFactory: (janela: ContadorEmJanela, resolucao: ResolucaoDeTenantRepository) =>
            new LimiteDoEmailPorIp({
              janela,
              limitePorMinuto: opcoes.login.limiteEmailPorIpMin,
              escolasDaRede: (ip) => resolucao.escolasDaRedeDoIpDeSaida(ip),
              instancias: opcoes.instancias,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [ContadorEmJanela, ResolucaoDeTenantRepository],
        },
        {
          provide: ConferenciaNaVez,
          useFactory: (semaforo: SemaforoDeHash, contador: ContadorDeTentativas, hash: HashDeSenha) => new ConferenciaNaVez({ semaforo, contador, hash, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [SemaforoDeHash, ContadorDeTentativas, HashDeSenha],
        },
        // Um consumo de desafio só, dividido pelo MFA e pela troca de escola: a proporção do seguro dele é uma.
        { provide: ConsumoDeDesafio, useFactory: (cliente: Redis) => new ConsumoDeDesafio(cliente), inject: [CLIENTE_REDIS_LOGIN] },
        {
          provide: SeguroDoLogin,
          useFactory: (contador: ContadorDeTentativas, janela: ContadorEmJanela, consumo: ConsumoDeDesafio) => new SeguroDoLogin(contador, janela, consumo),
          inject: [ContadorDeTentativas, ContadorEmJanela, ConsumoDeDesafio],
        },
        { provide: EuRepository, useFactory: (banco: Database) => new EuRepository(banco), inject: [BANCO] },
        { provide: EuService, useFactory: (eu: EuRepository, resolucao: ResolucaoDeTenantRepository) => new EuService(eu, resolucao, opcoes.medidor ?? globalMeter()), inject: [EuRepository, ResolucaoDeTenantRepository] },
        { provide: CookieDeDispositivo, useFactory: () => new CookieDeDispositivo(opcoes.login.dispositivo.versao, opcoes.login.dispositivo.chave) },
        {
          provide: ConclusaoDeLogin,
          useFactory: (banco: Database, dispositivo: CookieDeDispositivo, resolucao: ResolucaoDeTenantRepository) =>
            new ConclusaoDeLogin({
              banco,
              dispositivo,
              emissorDeToken: new TokenIssuer(opcoes.identidade.chaveAssinatura),
              emissorDeDesafio: new EmissorDeDesafio(opcoes.identidade.chaveAssinatura),
              ambiente: opcoes.identidade.ambiente,
              resolucao,
            }),
          inject: [BANCO, CookieDeDispositivo, ResolucaoDeTenantRepository],
        },
        { provide: BilheteDeConvite, useFactory: () => new BilheteDeConvite(opcoes.identidade.chaveAssinatura) },
        { provide: AtivacaoPorConvite, useFactory: (banco: Database, bilhetes: BilheteDeConvite) => new AtivacaoPorConvite(banco, bilhetes), inject: [BANCO, BilheteDeConvite] },
        {
          provide: LoginService,
          useFactory: (
            resolucao: ResolucaoDeTenantRepository,
            conferencia: ConferenciaNaVez,
            contador: ContadorDeTentativas,
            limitePorIp: LimiteDoEmailPorIp,
            dispositivo: CookieDeDispositivo,
            conclusao: ConclusaoDeLogin,
            ativacao: AtivacaoPorConvite,
          ) => new LoginService({ resolucao, conferencia, contador, limitePorIp, dispositivo, conclusao, ativacao, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [ResolucaoDeTenantRepository, ConferenciaNaVez, ContadorDeTentativas, LimiteDoEmailPorIp, CookieDeDispositivo, ConclusaoDeLogin, AtivacaoPorConvite],
        },
        {
          provide: LoginPorMatricula,
          useFactory: (
            banco: Database,
            resolucao: ResolucaoDeTenantRepository,
            conferencia: ConferenciaNaVez,
            contador: ContadorDeTentativas,
            rebaixamento: RebaixamentoPorEscola,
            dispositivo: CookieDeDispositivo,
            conclusao: ConclusaoDeLogin,
          ) => new LoginPorMatricula({ banco, resolucao, conferencia, contador, rebaixamento, dispositivo, conclusao, medidor: opcoes.medidor ?? globalMeter() }),
          inject: [BANCO, ResolucaoDeTenantRepository, ConferenciaNaVez, ContadorDeTentativas, RebaixamentoPorEscola, CookieDeDispositivo, ConclusaoDeLogin],
        },
        {
          provide: AcessoDaEscolaService,
          useFactory: (banco: Database, resolucao: ResolucaoDeTenantRepository, provedor: ProvedorExternoPort) => new AcessoDaEscolaService(banco, resolucao, provedor.ligados),
          inject: [BANCO, ResolucaoDeTenantRepository, PROVEDOR_EXTERNO],
        },
        { provide: PROVEDOR_EXTERNO, useFactory: () => new OpenIdClientAdapter(opcoes.loginExterno) },
        // A porta do `sala` para a resolução (A1, tarefa 5.0): a página pública da sala acha a escola, o ano e a turma pelo
        // link ou pelo código sem importar a `ResolucaoDeTenantRepository`, que não sai deste módulo.
        { provide: AcessoDaSala, useFactory: (resolucao: ResolucaoDeTenantRepository) => new AcessoDaSala(resolucao), inject: [ResolucaoDeTenantRepository] },
        {
          provide: LoginExterno,
          useFactory: (banco: Database, resolucao: ResolucaoDeTenantRepository, provedor: ProvedorExternoPort, conclusao: ConclusaoDeLogin) =>
            new LoginExterno({
              banco,
              resolucao,
              provedor,
              // Sem provedor ligado não há chave configurada: uma chave sorteada no boot, que nenhum cookie decifra.
              cookie: new CookieOidc(opcoes.loginExterno.chaveDoCookie ?? new Uint8Array(randomBytes(32)), opcoes.identidade.ambiente),
              conclusao,
              retorno: opcoes.loginExterno.retorno,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [BANCO, ResolucaoDeTenantRepository, PROVEDOR_EXTERNO, ConclusaoDeLogin],
        },
        {
          provide: ConviteService,
          useFactory: (banco: Database, resolucao: ResolucaoDeTenantRepository, hash: HashDeSenha, bilhetes: BilheteDeConvite) =>
            new ConviteService({ banco, resolucao, hash, bilhetes, emissorDeDesafio: new EmissorDeDesafio(opcoes.identidade.chaveAssinatura) }),
          inject: [BANCO, ResolucaoDeTenantRepository, HashDeSenha, BilheteDeConvite],
        },
        {
          provide: MfaService,
          useFactory: (
            banco: Database,
            resolucao: ResolucaoDeTenantRepository,
            contador: ContadorDeTentativas,
            dispositivo: CookieDeDispositivo,
            conclusao: ConclusaoDeLogin,
            consumo: ConsumoDeDesafio,
            ativacao: AtivacaoPorConvite,
          ) =>
            new MfaService({
              banco,
              resolucao,
              contador,
              dispositivo,
              conclusao,
              ativacao,
              cifra: new CifraDoSegredo(opcoes.login.mfa.versaoCifra, opcoes.login.mfa.chavesCifra),
              consumo,
              chaveAssinatura: opcoes.identidade.chaveAssinatura,
              chaveRecuperacao: opcoes.login.mfa.chaveRecuperacao,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [BANCO, ResolucaoDeTenantRepository, ContadorDeTentativas, CookieDeDispositivo, ConclusaoDeLogin, ConsumoDeDesafio, AtivacaoPorConvite],
        },
        {
          provide: TrocaDeEscolaService,
          useFactory: (banco: Database, resolucao: ResolucaoDeTenantRepository, conclusao: ConclusaoDeLogin, consumo: ConsumoDeDesafio) =>
            new TrocaDeEscolaService({
              banco,
              resolucao,
              conclusao,
              consumo,
              emissorDeDesafio: new EmissorDeDesafio(opcoes.identidade.chaveAssinatura),
              chaveAssinatura: opcoes.identidade.chaveAssinatura,
            }),
          inject: [BANCO, ResolucaoDeTenantRepository, ConclusaoDeLogin, ConsumoDeDesafio],
        },
        { provide: RedefinicaoDeMfa, useFactory: (banco: Database) => new RedefinicaoDeMfa(banco), inject: [BANCO] },
        {
          provide: RenovacaoService,
          useFactory: (banco: Database) =>
            new RenovacaoService({
              banco,
              emissorDeToken: new TokenIssuer(opcoes.identidade.chaveAssinatura),
              ambiente: opcoes.identidade.ambiente,
              medidor: opcoes.medidor ?? globalMeter(),
            }),
          inject: [BANCO],
        },
        { provide: RegistroDeAtividade, useFactory: (banco: Database) => new RegistroDeAtividade(banco, opcoes.medidor ?? globalMeter()), inject: [BANCO] },
        { provide: SaidaService, useFactory: (banco: Database) => new SaidaService(banco, opcoes.identidade.ambiente), inject: [BANCO] },
      ],
      // O `AcessoDaSala` vai ao `SalaModule` (A1, tarefa 5.0), e só ele: a resolução continua dentro deste módulo.
      // `RegistroDeAtividade` é o contrato para o F6: a gravação de resposta de avaliação também conta como uso. O
      // `SemaforoDeHash` e o `HashDeSenha` vão ao aceite do convite do operador (A0, tarefa 5.0) e à reivindicação do nome
      // na sala (A1, tarefa 6.0): o semáforo é um só por instância, porque o teto que ele guarda é o das threads do processo. Global, como o `BancoModule` e o
      // `LimiteModule`, para o `OperacaoModule` receber a mesma instância sem montar outra.
      global: true,
      exports: [CLIENTE_REDIS_LOGIN, ContadorDeTentativas, SeguroDoLogin, RegistroDeAtividade, SemaforoDeHash, HashDeSenha, AcessoDaSala],
    }
  }

  constructor(@Inject(CLIENTE_REDIS_LOGIN) private readonly cliente: Redis) {}

  /** Depois de o servidor fechar: o login que termina durante a drenagem ainda conta a tentativa. */
  onApplicationShutdown(): void {
    this.cliente.disconnect()
  }
}
