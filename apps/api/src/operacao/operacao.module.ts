import { OperadorTokenIssuer, globalMeter, type Database, type AuthConfig, type Meter } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { BANCO } from '../database.module.js'
import { CifraDoSegredo, CLIENTE_REDIS_LOGIN, type ConfiguracaoLogin, ContadorDeTentativas, HashDeSenha, SemaforoDeHash } from '../credencial/index.js'
import { ConviteDeOperadorController } from './convite/convite-operador.controller.js'
import { ConviteDeOperadorService } from './convite/convite-operador.service.js'
import { ConsumoDeDesafioDeOperador, EmissorDeDesafioDeOperador } from './operador-challenge.js'
import { cookieDeDispositivoDeOperador } from './operador-device-cookie.js'
import { EntradaDoOperadorController } from './entrada/entrada.controller.js'
import { EntradaDoOperadorService } from './entrada/entrada.service.js'
import { EuDoOperadorController } from './eu/eu.controller.js'
import { EuDoOperadorService } from './eu/eu.service.js'
import { FalhasDeEntradaDaOperacao } from './login-failure-counter.js'
import { provedoresDaGuardaDeOperador } from './operador.guard.js'
import { OperadorRepository } from './operador/operador.repository.js'
import { PainelController } from './painel/painel.controller.js'
import { PainelService } from './painel/painel.service.js'
import { SegundoFatorDoOperadorController } from './mfa/segundo-fator.controller.js'
import { SegundoFatorDoOperadorService } from './mfa/segundo-fator.service.js'
import { SessaoDoOperadorController } from './sessao/sessao.controller.js'
import { SessaoDoOperadorService } from './sessao/sessao.service.js'

/** O que a área da operação lê da configuração, além da identidade. */
export interface OpcoesDoModuloDaOperacao {
  /** A chave e a versão do cookie de dispositivo do F1, de que sai a chave própria do operador. */
  readonly dispositivo: ConfiguracaoLogin['dispositivo']
  /** As chaves de cifra do segredo e a do HMAC dos códigos de recuperação, as do F1 (o AAD da cifra é o `operador.id`). */
  readonly mfa: ConfiguracaoLogin['mfa']
  /** O medidor da telemetria; sem ele, o global. */
  readonly medidor?: Meter
}

/**
 * A área da operação na API (Tech Spec da A0): as rotas `/v1/operacao/*`, com a `GuardaDeOperador`, e as de entrada: o
 * convite (5.0), a entrada por e-mail (6.0), o segundo fator (7.0), renovar e sair (8.0). Desde a A0b, o painel: rede e
 * escola (`PainelController`), o único alcance entre escolas da API. O semáforo, o hash de
 * senha, o contador de tentativas e o cliente do Redis de fila do login vêm do `SessaoModule`, que os exporta como
 * global: a mesma instância do login.
 */
@Module({})
export class OperacaoModule {
  static com(identidade: AuthConfig, opcoes: OpcoesDoModuloDaOperacao): DynamicModule {
    return {
      module: OperacaoModule,
      controllers: [EuDoOperadorController, ConviteDeOperadorController, EntradaDoOperadorController, SegundoFatorDoOperadorController, SessaoDoOperadorController, PainelController],
      providers: [
        ...provedoresDaGuardaDeOperador(identidade),
        // Uma série só para as duas etapas da entrada, criada uma vez.
        { provide: FalhasDeEntradaDaOperacao, useFactory: () => new FalhasDeEntradaDaOperacao(opcoes.medidor ?? globalMeter()) },
        {
          provide: ConviteDeOperadorService,
          useFactory: (banco: Database, hash: HashDeSenha, semaforo: SemaforoDeHash) =>
            new ConviteDeOperadorService({ banco, hash, semaforo, emissorDeDesafio: new EmissorDeDesafioDeOperador(identidade.chaveAssinatura) }),
          inject: [BANCO, HashDeSenha, SemaforoDeHash],
        },
        {
          provide: EntradaDoOperadorService,
          useFactory: (banco: Database, hash: HashDeSenha, semaforo: SemaforoDeHash, contador: ContadorDeTentativas, falhas: FalhasDeEntradaDaOperacao) =>
            new EntradaDoOperadorService({
              banco,
              hash,
              semaforo,
              contador,
              dispositivo: cookieDeDispositivoDeOperador(opcoes.dispositivo),
              emissorDeDesafio: new EmissorDeDesafioDeOperador(identidade.chaveAssinatura),
              falhas,
            }),
          inject: [BANCO, HashDeSenha, SemaforoDeHash, ContadorDeTentativas, FalhasDeEntradaDaOperacao],
        },
        // O `jti` do desafio do operador no Redis de fila do login, que não expulsa chave, com prefixo próprio.
        { provide: ConsumoDeDesafioDeOperador, useFactory: (cliente: Redis) => new ConsumoDeDesafioDeOperador(cliente), inject: [CLIENTE_REDIS_LOGIN] },
        {
          provide: SegundoFatorDoOperadorService,
          useFactory: (banco: Database, contador: ContadorDeTentativas, consumo: ConsumoDeDesafioDeOperador, falhas: FalhasDeEntradaDaOperacao) =>
            new SegundoFatorDoOperadorService({
              banco,
              cifra: new CifraDoSegredo(opcoes.mfa.versaoCifra, opcoes.mfa.chavesCifra),
              chaveRecuperacao: opcoes.mfa.chaveRecuperacao,
              chaveAssinatura: identidade.chaveAssinatura,
              consumo,
              contador,
              dispositivo: cookieDeDispositivoDeOperador(opcoes.dispositivo),
              emissorDeDesafio: new EmissorDeDesafioDeOperador(identidade.chaveAssinatura),
              emissorDeToken: new OperadorTokenIssuer(identidade.chaveAssinatura),
              ambiente: identidade.ambiente,
              falhas,
            }),
          inject: [BANCO, ContadorDeTentativas, ConsumoDeDesafioDeOperador, FalhasDeEntradaDaOperacao],
        },
        {
          provide: SessaoDoOperadorService,
          useFactory: (banco: Database) => new SessaoDoOperadorService({ banco, emissorDeToken: new OperadorTokenIssuer(identidade.chaveAssinatura), ambiente: identidade.ambiente }),
          inject: [BANCO],
        },
        { provide: EuDoOperadorService, useFactory: (banco: Database) => new EuDoOperadorService(new OperadorRepository(banco)), inject: [BANCO] },
        { provide: PainelService, useFactory: (banco: Database) => new PainelService(banco), inject: [BANCO] },
      ],
    }
  }
}
