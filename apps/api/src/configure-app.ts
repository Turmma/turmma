import { DomainException, GracefulShutdown, AllExceptionsFilter, NestLogger, globalMeter, contextMiddleware, httpMetricsMiddleware, type LoggerBase, type Meter } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { IncomingMessage } from 'node:http'

/**
 * O maior corpo JSON que a API lê: a planilha da coordenação tem até 512 KB de texto (Tech Spec do onboarding, seção 4), que
 * escapada em JSON passa de 600 KB. O padrão do Express (100 KB) devolveria erro interno a uma planilha de tamanho comum; cada
 * campo continua limitado pelo contrato dele.
 */
export const LIMITE_DO_CORPO_JSON = '1mb'

/** O corpo JSON de toda rota que não é a da planilha: o padrão do Express, que valia antes de a planilha existir. Só o JSON: o multipart do envio de material (até 20 MB) tem o limite dele. */
export const LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES = 100 * 1024

/** As rotas da planilha, as únicas (com as duas da lista da turma, abaixo) que leem corpo de até `LIMITE_DO_CORPO_JSON`. */
const PREFIXO_DAS_PLANILHAS = '/v1/importacoes'

/**
 * A prévia e a gravação da lista da turma (`POST /v1/turmas/:id/lista/previa` e `/lista`) seguem a planilha de alunos (F2, 8.0): o
 * mesmo teto de 512 KB e 3.000 linhas, então o mesmo corpo grande. O nome avulso (`/lista/nome`), a leitura e as demais rotas da
 * turma ficam nos 100 KB. O id é o de UUID em minúsculas; outra grafia cai na regra das outras rotas, o lado seguro.
 */
const ROTA_DA_LISTA_DA_TURMA = /^\/v1\/turmas\/[0-9a-f-]{36}\/lista(\/previa)?(\?.*)?$/

/**
 * O teto de 512 KB e de 3.000 linhas vale só nas rotas da planilha e nas duas da lista da turma (F2, 5.0 e 8.0; regra 80, item 3). O leitor de JSON é um só e vale 1 MB,
 * e este middleware, antes dele, recusa pelo `Content-Length` o corpo **JSON** de mais de 100 KB em qualquer outra rota:
 * `ENTRADA_INVALIDA`, sem ler nada. O corpo que não é JSON (o multipart do material, de até 20 MB) não passa por aqui: o limite
 * dele é do `FileInterceptor`. O corpo sem `Content-Length` (em pedaços) continua preso aos 1 MB do leitor. O caminho que não casa
 * exatamente com o prefixo (outra caixa, por exemplo) cai na regra das outras rotas: o erro vai para o lado seguro.
 */
export function limitarCorpoForaDaPlanilha(requisicao: IncomingMessage, _resposta: unknown, seguir: () => void): void {
  const caminho = requisicao.url ?? ''
  const daPlanilha =
    caminho === PREFIXO_DAS_PLANILHAS || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}/`) || caminho.startsWith(`${PREFIXO_DAS_PLANILHAS}?`) || ROTA_DA_LISTA_DA_TURMA.test(caminho)
  const declarado = Number(requisicao.headers['content-length'])
  const ehJson = /^application\/json\b/i.test(requisicao.headers['content-type'] ?? '')
  if (ehJson && !daPlanilha && declarado > LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  seguir()
}

/**
 * Tudo que toda instância da API precisa antes de atender: contexto da requisição, log JSON,
 * erro tipado, duração por rota e servidor HTTP pronto para a drenagem. Os testes de integração montam a aplicação
 * por aqui, para provar a mesma ligação que sobe em produção.
 */
export function configureApp(app: INestApplication, logger: LoggerBase, medidor: Meter = globalMeter()): void {
  // Primeiro middleware: o contexto precisa existir antes do body parser, cujo erro também
  // chega ao filtro com o `requisicaoId`.
  app.use(contextMiddleware)
  // Logo depois: toda requisição é medida, inclusive a recusada pela guarda e a que não casou rota.
  app.use(httpMetricsMiddleware(medidor))
  app.use(limitarCorpoForaDaPlanilha)
  ;(app as NestExpressApplication).useBodyParser('json', { limit: LIMITE_DO_CORPO_JSON })
  app.useLogger(new NestLogger(logger))
  app.useGlobalFilters(new AllExceptionsFilter(logger))
  // Atrás da borda, e com o fechamento dentro do prazo da drenagem.
  app.get(GracefulShutdown).prepararServidor(app.getHttpServer())
}
