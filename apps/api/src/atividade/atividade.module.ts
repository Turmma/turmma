import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB } from '../database.module.js'
import { FuncaoSuspensionCheck } from '../ia/funcao-suspension-check.js'
import { REDIS_LOGIN_CLIENT } from '../credencial/index.js'
import { AtividadeAplicadaController } from './atividade-aplicada/atividade-aplicada.controller.js'
import { AtividadeAplicadaService } from './atividade-aplicada/atividade-aplicada.service.js'
import { CorrecaoService } from './correcao/correcao.service.js'
import { DesempenhoController } from './desempenho/desempenho.controller.js'
import { DesempenhoService } from './desempenho/desempenho.service.js'
import { LoteReadMarker } from './correcao/lote-read-marker.js'
import { LoteController } from './correcao/lote.controller.js'
import { MinhaAtividadeController } from './minha-atividade/minha-atividade.controller.js'
import { MinhaAtividadeService } from './minha-atividade/minha-atividade.service.js'

/**
 * A atividade aplicada e a correção de objetiva (MVP, A3; D33, D46, D56): a professora aplica e encerra, o aluno
 * responde, a correção nasce pendente, a professora abre os destaques e aprova o lote com o registro da validação, e só
 * então o aluno alcança o diagnóstico. Não existe `Nota` nesta fatia.
 *
 * A conferência da função suspensa vem do `IaModule`, e o cliente do Redis de fila, do `SessaoModule`, os dois globais.
 */
@Module({
  controllers: [AtividadeAplicadaController, MinhaAtividadeController, LoteController, DesempenhoController],
  providers: [
    { provide: LoteReadMarker, useFactory: (cliente: Redis) => new LoteReadMarker(cliente), inject: [REDIS_LOGIN_CLIENT] },
    { provide: AtividadeAplicadaService, useFactory: (banco: Database, conferencia: FuncaoSuspensionCheck) => new AtividadeAplicadaService(banco, conferencia), inject: [DB, FuncaoSuspensionCheck] },
    { provide: CorrecaoService, useFactory: (banco: Database, leitura: LoteReadMarker) => new CorrecaoService(banco, leitura), inject: [DB, LoteReadMarker] },
    { provide: MinhaAtividadeService, useFactory: (banco: Database) => new MinhaAtividadeService(banco), inject: [DB] },
    { provide: DesempenhoService, useFactory: (banco: Database) => new DesempenhoService(banco), inject: [DB] },
  ],
})
export class AtividadeModule {}
