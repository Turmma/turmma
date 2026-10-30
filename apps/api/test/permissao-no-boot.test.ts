import 'reflect-metadata'
import { ConferenciaDasPermissoes, METADADO_ENTRADA_DE_OPERACAO, METADADO_ROTA_DE_OPERACAO, Permite, RotaAnonima, RotasSemPermissao } from '@educa/nucleo'
import { InvariantException } from '@educa/shared'
import { Controller, Get, Module, SetMetadata } from '@nestjs/common'
import { DiscoveryModule, DiscoveryService, NestFactory } from '@nestjs/core'
import { describe, expect, it } from 'vitest'

@Controller('com-permissao')
class ComPermissaoController {
  @Get()
  @Permite('sistema_contexto', 'ler')
  obter(): void {}
}

@RotaAnonima()
@Controller('anonimo')
class AnonimoController {
  @Get()
  obter(): void {}
}

/** Os marcadores da operação, pelas chaves que `@RotaDeOperacao()` e `@EntradaDeOperacao()` gravam, no método e na classe. */
@Controller('v1/operacao/metodo')
class OperacaoNoMetodoController {
  @Get('eu')
  @SetMetadata(METADADO_ROTA_DE_OPERACAO, true)
  eu(): void {}

  @Get('entrar')
  @SetMetadata(METADADO_ENTRADA_DE_OPERACAO, true)
  entrar(): void {}
}

@SetMetadata(METADADO_ROTA_DE_OPERACAO, true)
@Controller('v1/operacao/classe')
class OperacaoNaClasseController {
  @Get()
  obter(): void {}
}

@Controller('esquecido')
class EsquecidoController {
  @Get('rota-nova')
  rotaNova(): void {}
}

function moduloCom(controladores: Array<new () => object>) {
  @Module({
    imports: [DiscoveryModule],
    controllers: controladores,
    providers: [{ provide: ConferenciaDasPermissoes, useFactory: (descoberta: DiscoveryService) => new ConferenciaDasPermissoes(descoberta), inject: [DiscoveryService] }],
  })
  class ModuloDeTeste {}
  return ModuloDeTeste
}

async function subir(controladores: Array<new () => object>): Promise<void> {
  const app = await NestFactory.createApplicationContext(moduloCom(controladores), { logger: false, abortOnError: false })
  try {
    await app.init()
  } finally {
    await app.close()
  }
}

describe('boot da API: toda rota declara quem pode chamá-la', () => {
  it('sobe com rotas marcadas com @Permite ou @RotaAnonima', async () => {
    await expect(subir([ComPermissaoController, AnonimoController])).resolves.toBeUndefined()
  })

  it('sobe com rotas marcadas com um dos dois marcadores da operação, no método ou na classe', async () => {
    await expect(subir([OperacaoNoMetodoController, OperacaoNaClasseController])).resolves.toBeUndefined()
  })

  it('rota sem @Permite, sem @RotaAnonima e sem marcador da operação derruba o boot, com o nome do controller e do método', async () => {
    const recusa = await subir([ComPermissaoController, OperacaoNoMetodoController, EsquecidoController]).catch((erro: unknown) => erro)

    expect(recusa).toBeInstanceOf(RotasSemPermissao)
    expect(recusa).toBeInstanceOf(InvariantException)
    expect(recusa).toMatchObject({
      name: 'RotasSemPermissao',
      message: 'rota sem @Permite, @RotaAnonima nem marcador da operação',
      codigo: 'ROTA_SEM_PERMISSAO',
      rotas: [{ controller: 'EsquecidoController', metodo: 'rotaNova' }],
    })
  })
})
