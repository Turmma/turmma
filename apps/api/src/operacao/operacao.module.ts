import { OperadorTokenIssuer, globalMeter, type Database, type AuthConfig, type Meter } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB } from '../database.module.js'
import { SecretCipher, REDIS_LOGIN_CLIENT, type LoginConfig, LoginLockout, PasswordHasher, HashBulkhead } from '../credencial/index.js'
import { ConviteDeOperadorController } from './convite/convite-operador.controller.js'
import { ConviteDeOperadorService } from './convite/convite-operador.service.js'
import { OperadorChallengeConsumer, OperadorChallengeIssuer } from './operador-challenge.js'
import { operadorDeviceCookie } from './operador-device-cookie.js'
import { EntradaDoOperadorController } from './entrada/entrada.controller.js'
import { EntradaDoOperadorService } from './entrada/entrada.service.js'
import { OperadorMeController } from './eu/eu.controller.js'
import { OperadorMeService } from './eu/eu.service.js'
import { OperacaoLoginFailureCounter } from './login-failure-counter.js'
import { operadorGuardProviders } from './operador.guard.js'
import { OperadorRepository } from './operador/operador.repository.js'
import { PainelController } from './painel/painel.controller.js'
import { PainelService } from './painel/painel.service.js'
import { OperadorMfaController } from './mfa/segundo-fator.controller.js'
import { OperadorMfaService } from './mfa/segundo-fator.service.js'
import { SessaoDoOperadorController } from './sessao/sessao.controller.js'
import { SessaoDoOperadorService } from './sessao/sessao.service.js'

/** O que a área da operação lê da configuração, além da identidade. */
export interface OperacaoModuleOptions {
  /** A chave e a versão do cookie de dispositivo do F1, de que sai a chave própria do operador. */
  readonly dispositivo: LoginConfig['dispositivo']
  /** As chaves de cifra do segredo e a do HMAC dos códigos de recuperação, as do F1 (o AAD da cifra é o `operador.id`). */
  readonly mfa: LoginConfig['mfa']
  /** O medidor da telemetria; sem ele, o global. */
  readonly medidor?: Meter
}

/**
 * A área da operação na API (Tech Spec da A0): as rotas `/v1/operacao/*`, com a `OperadorGuard`, e as de entrada: o
 * convite (5.0), a entrada por e-mail (6.0), o segundo fator (7.0), renovar e sair (8.0). Desde a A0b, o painel: rede e
 * escola (`PainelController`), o único alcance entre escolas da API. O semáforo, o hash de
 * senha, o contador de tentativas e o cliente do Redis de fila do login vêm do `SessaoModule`, que os exporta como
 * global: a mesma instância do login.
 */
@Module({})
export class OperacaoModule {
  static forRoot(identidade: AuthConfig, opcoes: OperacaoModuleOptions): DynamicModule {
    return {
      module: OperacaoModule,
      controllers: [OperadorMeController, ConviteDeOperadorController, EntradaDoOperadorController, OperadorMfaController, SessaoDoOperadorController, PainelController],
      providers: [
        ...operadorGuardProviders(identidade),
        // Uma série só para as duas etapas da entrada, criada uma vez.
        { provide: OperacaoLoginFailureCounter, useFactory: () => new OperacaoLoginFailureCounter(opcoes.medidor ?? globalMeter()) },
        {
          provide: ConviteDeOperadorService,
          useFactory: (banco: Database, hash: PasswordHasher, semaforo: HashBulkhead) =>
            new ConviteDeOperadorService({ banco, hash, semaforo, emissorDeDesafio: new OperadorChallengeIssuer(identidade.chaveAssinatura) }),
          inject: [DB, PasswordHasher, HashBulkhead],
        },
        {
          provide: EntradaDoOperadorService,
          useFactory: (banco: Database, hash: PasswordHasher, semaforo: HashBulkhead, contador: LoginLockout, falhas: OperacaoLoginFailureCounter) =>
            new EntradaDoOperadorService({
              banco,
              hash,
              semaforo,
              contador,
              dispositivo: operadorDeviceCookie(opcoes.dispositivo),
              emissorDeDesafio: new OperadorChallengeIssuer(identidade.chaveAssinatura),
              falhas,
            }),
          inject: [DB, PasswordHasher, HashBulkhead, LoginLockout, OperacaoLoginFailureCounter],
        },
        // O `jti` do desafio do operador no Redis de fila do login, que não expulsa chave, com prefixo próprio.
        { provide: OperadorChallengeConsumer, useFactory: (cliente: Redis) => new OperadorChallengeConsumer(cliente), inject: [REDIS_LOGIN_CLIENT] },
        {
          provide: OperadorMfaService,
          useFactory: (banco: Database, contador: LoginLockout, consumo: OperadorChallengeConsumer, falhas: OperacaoLoginFailureCounter) =>
            new OperadorMfaService({
              banco,
              cifra: new SecretCipher(opcoes.mfa.versaoCifra, opcoes.mfa.chavesCifra),
              chaveRecuperacao: opcoes.mfa.chaveRecuperacao,
              chaveAssinatura: identidade.chaveAssinatura,
              consumo,
              contador,
              dispositivo: operadorDeviceCookie(opcoes.dispositivo),
              emissorDeDesafio: new OperadorChallengeIssuer(identidade.chaveAssinatura),
              emissorDeToken: new OperadorTokenIssuer(identidade.chaveAssinatura),
              ambiente: identidade.ambiente,
              falhas,
            }),
          inject: [DB, LoginLockout, OperadorChallengeConsumer, OperacaoLoginFailureCounter],
        },
        {
          provide: SessaoDoOperadorService,
          useFactory: (banco: Database) => new SessaoDoOperadorService({ banco, emissorDeToken: new OperadorTokenIssuer(identidade.chaveAssinatura), ambiente: identidade.ambiente }),
          inject: [DB],
        },
        { provide: OperadorMeService, useFactory: (banco: Database) => new OperadorMeService(new OperadorRepository(banco)), inject: [DB] },
        { provide: PainelService, useFactory: (banco: Database) => new PainelService(banco), inject: [DB] },
      ],
    }
  }
}
