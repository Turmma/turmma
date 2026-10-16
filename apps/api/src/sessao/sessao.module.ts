import {
  avisoEspacado,
  criarClienteRedisDaApi,
  EmissorDeToken,
  medidorGlobal,
  type Banco,
  type ConfiguracaoIdentidade,
  type Meter,
} from '@educa/nucleo'
import { Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { randomBytes } from 'node:crypto'
import { BANCO } from '../banco.module.js'
import type { ConfiguracaoLogin } from './configuracao-de-login.js'
import type { ConfiguracaoLoginExterno } from './externa/configuracao-externa.js'
import { CookieOidc } from './externa/cookie-oidc.js'
import { LoginExternoController } from './externa/externa.controller.js'
import { LoginExterno } from './externa/externa.service.js'
import { OpenIdClientAdapter } from './externa/openid-client.adapter.js'
import type { ProvedorExternoPort } from './externa/provedor-externo.port.js'
import { AcessoDaEscolaController } from './acesso-da-escola.controller.js'
import { AcessoDaEscolaService } from './acesso-da-escola.service.js'
import { AcessoDaSala } from './acesso-da-sala.js'
import { AtividadeController } from './atividade.controller.js'
import { RegistroDeAtividade } from './atividade.service.js'
import { AlunosAtivosRepository } from './alunos-ativos.repository.js'
import { ContadorDeTentativas } from './contador-de-tentativas.js'
import { CookieDeDispositivo } from './cookie-dispositivo.js'
import { CifraDoSegredo } from './cifra-do-segredo.js'
import { ConclusaoDeLogin } from './conclusao-de-login.js'
import { BilheteDeConvite } from './bilhete-de-convite.js'
import { ConviteController } from './convite.controller.js'
import { AtivacaoPorConvite, ConviteService } from './convite.service.js'
import { ConsumoDeDesafio, EmissorDeDesafio } from './desafio.js'
import { EuController } from './eu.controller.js'
import { EuRepository } from './eu.repository.js'
import { EuService } from './eu.service.js'
import { HashDeSenha } from './hash-de-senha.js'
import { LoginEmailController } from './login-email.controller.js'
import { LoginService } from './login.service.js'
import { LoginMatriculaController } from './matricula.controller.js'
import { LoginPorMatricula } from './matricula.service.js'
import { ContaMfaController, SessaoMfaController } from './mfa.controller.js'
import { MfaService } from './mfa.service.js'
import { RedefinicaoDeMfa } from './redefinicao-de-mfa.js'
import { RedefinirMfaController } from './redefinir-mfa.controller.js'
import { RenovacaoController } from './renovacao.controller.js'
import { RenovacaoService } from './renovacao.service.js'
import { ResolucaoDeTenantRepository } from './resolucao-de-tenant.repository.js'
import { SaidaController } from './saida.controller.js'
import { ConferenciaNaVez } from './senha/conferencia-na-vez.js'
import { ContadorEmJanela } from './senha/contador-em-janela.js'
import { LimiteDoEmailPorIp } from './senha/limite-email-ip.js'
import { RebaixamentoPorEscola } from './senha/rebaixamento.js'
import { SemaforoDeHash, SemaforoSemProtecao } from './senha/semaforo-de-hash.js'
import { SaidaService } from './saida.service.js'
import { SeguroDoLogin } from './seguro-do-login.js'
import { TrocaDeEscolaController } from './troca-de-escola.controller.js'
import { TrocaDeEscolaService } from './troca-de-escola.service.js'

/** Cliente do Redis de fila do login: contador de tentativas e desafio usado, que não podem ser expulsos. */
export const CLIENTE_REDIS_LOGIN = Symbol('CLIENTE_REDIS_LOGIN')
/** A porta do login pela conta da escola (13.0): o adaptador `openid-client`. */
export const PROVEDOR_EXTERNO = Symbol('PROVEDOR_EXTERNO')

export interface OpcoesDoModuloDeSessao {
  readonly identidade: ConfiguracaoIdentidade
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
    const avisar = avisoEspacado(() => SessaoModule.logger.warn('login.redis_indisponivel'))
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
        { provide: CLIENTE_REDIS_LOGIN, useFactory: () => criarClienteRedisDaApi(opcoes.redisFilaUrl, 'api-login', avisar, opcoes.prazoDoRedisMs ?? opcoes.login.prazoDoRedisMs) },
        { provide: ResolucaoDeTenantRepository, useFactory: (banco: Banco) => new ResolucaoDeTenantRepository(banco), inject: [BANCO] },
        { provide: HashDeSenha, useFactory: () => HashDeSenha.criar(opcoes.login.hash) },
        // Um semáforo por instância, dividido pelo login por e-mail e pelo por matrícula: o teto é das threads do processo.
        // Sem proteção só no controle negativo do cenário "login às 7h30" (16.0), nunca em produção (a configuração recusa).
        {
          provide: SemaforoDeHash,
          useFactory: () => {
            if (!opcoes.login.protecaoDesligada) return new SemaforoDeHash(opcoes.login.concorrenciaDoHash, opcoes.medidor ?? medidorGlobal())
            SessaoModule.logger.warn('login.protecao_desligada')
            return new SemaforoSemProtecao(opcoes.login.concorrenciaDoHash, opcoes.medidor ?? medidorGlobal())
          },
        },
        { provide: ContadorDeTentativas, useFactory: (cliente: Redis) => new ContadorDeTentativas(cliente, opcoes.login.chaveContador), inject: [CLIENTE_REDIS_LOGIN] },
        // Os contadores por IP da 15.0 usam a mesma chave de HMAC do contador de tentativas: o Redis nunca vê o IP.
        { provide: ContadorEmJanela, useFactory: (cliente: Redis) => new ContadorEmJanela(cliente, opcoes.login.chaveContador), inject: [CLIENTE_REDIS_LOGIN] },
        {
          provide: RebaixamentoPorEscola,
          useFactory: (banco: Banco, janela: ContadorEmJanela) =>
            new RebaixamentoPorEscola({ janela, alunosAtivos: () => new AlunosAtivosRepository(banco).contar(), instancias: opcoes.instancias, medidor: opcoes.medidor ?? medidorGlobal() }),
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
              medidor: opcoes.medidor ?? medidorGlobal(),
            }),
          inject: [ContadorEmJanela, ResolucaoDeTenantRepository],
        },
        {
          provide: ConferenciaNaVez,
          useFactory: (semaforo: SemaforoDeHash, contador: ContadorDeTentativas, hash: HashDeSenha) => new ConferenciaNaVez({ semaforo, contador, hash, medidor: opcoes.medidor ?? medidorGlobal() }),
          inject: [SemaforoDeHash, ContadorDeTentativas, HashDeSenha],
        },
        // Um consumo de desafio só, dividido pelo MFA e pela troca de escola: a proporção do seguro dele é uma.
        { provide: ConsumoDeDesafio, useFactory: (cliente: Redis) => new ConsumoDeDesafio(cliente), inject: [CLIENTE_REDIS_LOGIN] },
        {
          provide: SeguroDoLogin,
          useFactory: (contador: ContadorDeTentativas, janela: ContadorEmJanela, consumo: ConsumoDeDesafio) => new SeguroDoLogin(contador, janela, consumo),
          inject: [ContadorDeTentativas, ContadorEmJanela, ConsumoDeDesafio],
        },
        { provide: EuRepository, useFactory: (banco: Banco) => new EuRepository(banco), inject: [BANCO] },
        { provide: EuService, useFactory: (eu: EuRepository, resolucao: ResolucaoDeTenantRepository) => new EuService(eu, resolucao, opcoes.medidor ?? medidorGlobal()), inject: [EuRepository, ResolucaoDeTenantRepository] },
        { provide: CookieDeDispositivo, useFactory: () => new CookieDeDispositivo(opcoes.login.dispositivo.versao, opcoes.login.dispositivo.chave) },
        {
          provide: ConclusaoDeLogin,
          useFactory: (banco: Banco, dispositivo: CookieDeDispositivo, resolucao: ResolucaoDeTenantRepository) =>
            new ConclusaoDeLogin({
              banco,
              dispositivo,
              emissorDeToken: new EmissorDeToken(opcoes.identidade.chaveAssinatura),
              emissorDeDesafio: new EmissorDeDesafio(opcoes.identidade.chaveAssinatura),
              ambiente: opcoes.identidade.ambiente,
              resolucao,
            }),
          inject: [BANCO, CookieDeDispositivo, ResolucaoDeTenantRepository],
        },
        { provide: BilheteDeConvite, useFactory: () => new BilheteDeConvite(opcoes.identidade.chaveAssinatura) },
        { provide: AtivacaoPorConvite, useFactory: (banco: Banco, bilhetes: BilheteDeConvite) => new AtivacaoPorConvite(banco, bilhetes), inject: [BANCO, BilheteDeConvite] },
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
          ) => new LoginService({ resolucao, conferencia, contador, limitePorIp, dispositivo, conclusao, ativacao, medidor: opcoes.medidor ?? medidorGlobal() }),
          inject: [ResolucaoDeTenantRepository, ConferenciaNaVez, ContadorDeTentativas, LimiteDoEmailPorIp, CookieDeDispositivo, ConclusaoDeLogin, AtivacaoPorConvite],
        },
        {
          provide: LoginPorMatricula,
          useFactory: (
            banco: Banco,
            resolucao: ResolucaoDeTenantRepository,
            conferencia: ConferenciaNaVez,
            contador: ContadorDeTentativas,
            rebaixamento: RebaixamentoPorEscola,
            dispositivo: CookieDeDispositivo,
            conclusao: ConclusaoDeLogin,
          ) => new LoginPorMatricula({ banco, resolucao, conferencia, contador, rebaixamento, dispositivo, conclusao, medidor: opcoes.medidor ?? medidorGlobal() }),
          inject: [BANCO, ResolucaoDeTenantRepository, ConferenciaNaVez, ContadorDeTentativas, RebaixamentoPorEscola, CookieDeDispositivo, ConclusaoDeLogin],
        },
        {
          provide: AcessoDaEscolaService,
          useFactory: (banco: Banco, resolucao: ResolucaoDeTenantRepository, provedor: ProvedorExternoPort) => new AcessoDaEscolaService(banco, resolucao, provedor.ligados),
          inject: [BANCO, ResolucaoDeTenantRepository, PROVEDOR_EXTERNO],
        },
        { provide: PROVEDOR_EXTERNO, useFactory: () => new OpenIdClientAdapter(opcoes.loginExterno) },
        // A porta do `sala` para a resolução (A1, tarefa 5.0): a página pública da sala acha a escola, o ano e a turma pelo
        // link ou pelo código sem importar a `ResolucaoDeTenantRepository`, que não sai deste módulo.
        { provide: AcessoDaSala, useFactory: (resolucao: ResolucaoDeTenantRepository) => new AcessoDaSala(resolucao), inject: [ResolucaoDeTenantRepository] },
        {
          provide: LoginExterno,
          useFactory: (banco: Banco, resolucao: ResolucaoDeTenantRepository, provedor: ProvedorExternoPort, conclusao: ConclusaoDeLogin) =>
            new LoginExterno({
              banco,
              resolucao,
              provedor,
              // Sem provedor ligado não há chave configurada: uma chave sorteada no boot, que nenhum cookie decifra.
              cookie: new CookieOidc(opcoes.loginExterno.chaveDoCookie ?? new Uint8Array(randomBytes(32)), opcoes.identidade.ambiente),
              conclusao,
              retorno: opcoes.loginExterno.retorno,
              medidor: opcoes.medidor ?? medidorGlobal(),
            }),
          inject: [BANCO, ResolucaoDeTenantRepository, PROVEDOR_EXTERNO, ConclusaoDeLogin],
        },
        {
          provide: ConviteService,
          useFactory: (banco: Banco, resolucao: ResolucaoDeTenantRepository, hash: HashDeSenha, bilhetes: BilheteDeConvite) =>
            new ConviteService({ banco, resolucao, hash, bilhetes, emissorDeDesafio: new EmissorDeDesafio(opcoes.identidade.chaveAssinatura) }),
          inject: [BANCO, ResolucaoDeTenantRepository, HashDeSenha, BilheteDeConvite],
        },
        {
          provide: MfaService,
          useFactory: (
            banco: Banco,
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
              medidor: opcoes.medidor ?? medidorGlobal(),
            }),
          inject: [BANCO, ResolucaoDeTenantRepository, ContadorDeTentativas, CookieDeDispositivo, ConclusaoDeLogin, ConsumoDeDesafio, AtivacaoPorConvite],
        },
        {
          provide: TrocaDeEscolaService,
          useFactory: (banco: Banco, resolucao: ResolucaoDeTenantRepository, conclusao: ConclusaoDeLogin, consumo: ConsumoDeDesafio) =>
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
        { provide: RedefinicaoDeMfa, useFactory: (banco: Banco) => new RedefinicaoDeMfa(banco), inject: [BANCO] },
        {
          provide: RenovacaoService,
          useFactory: (banco: Banco) =>
            new RenovacaoService({
              banco,
              emissorDeToken: new EmissorDeToken(opcoes.identidade.chaveAssinatura),
              ambiente: opcoes.identidade.ambiente,
              medidor: opcoes.medidor ?? medidorGlobal(),
            }),
          inject: [BANCO],
        },
        { provide: RegistroDeAtividade, useFactory: (banco: Banco) => new RegistroDeAtividade(banco, opcoes.medidor ?? medidorGlobal()), inject: [BANCO] },
        { provide: SaidaService, useFactory: (banco: Banco) => new SaidaService(banco, opcoes.identidade.ambiente), inject: [BANCO] },
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
