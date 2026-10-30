import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { contextoAtual, SemEscopo } from '@educa/nucleo'
import { InvariantException } from '@educa/shared'
import type { ConfiguracaoStorage } from '../config.js'

/** Onde todo arquivo de escola mora no storage: `escolas/{escolaId}/...`. */
export const PREFIXO_DAS_ESCOLAS = 'escolas/'

/** Tempo máximo de conexão e de cada requisição ao storage. A rotina é de madrugada, mas não fica pendurada. */
export const TIMEOUT_CONEXAO_STORAGE_MS = 2_000
export const TIMEOUT_REQUISICAO_STORAGE_MS = 10_000

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * O prefixo da escola, com a barra no fim. Sem ela, `escolas/{a}` também casaria `escolas/{a}x/`, e
 * os bytes de outra pasta somariam na escola.
 */
export function prefixoDaEscola(escolaId: string): string {
  return `${PREFIXO_DAS_ESCOLAS}${escolaId}/`
}

/**
 * Cliente S3 puro (regra 00, item 7): endereço por caminho, que qualquer storage compatível atende, e
 * prazos de conexão e de requisição.
 */
export function criarClienteS3(config: ConfiguracaoStorage): S3Client {
  return new S3Client({
    endpoint: config.url,
    region: config.regiao,
    forcePathStyle: true,
    credentials: { accessKeyId: config.chaveAcesso, secretAccessKey: config.chaveSecreta },
    maxAttempts: 3,
    requestHandler: { connectionTimeout: TIMEOUT_CONEXAO_STORAGE_MS, requestTimeout: TIMEOUT_REQUISICAO_STORAGE_MS },
  })
}

/**
 * Mede quanto cada escola guarda no storage, só listando: nenhum objeto é lido, e nenhum nome de
 * arquivo sai daqui, só a soma dos tamanhos.
 */
export class MedidorDeStorage {
  constructor(
    private readonly s3: Pick<S3Client, 'send'>,
    private readonly bucket: string,
  ) {}

  /** As escolas com alguma pasta no storage. Pasta que não é id de escola é ignorada. */
  @SemEscopo(
    'a consolidação noturna é rotina nossa e mede o storage de todas as escolas; ' +
      'devolve só os ids das pastas, e a medição de cada uma volta ao escopo da escola',
  )
  async listarEscolas(): Promise<string[]> {
    const escolas: string[] = []
    let continuacao: string | undefined
    do {
      const pagina = await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: PREFIXO_DAS_ESCOLAS, Delimiter: '/', ContinuationToken: continuacao }),
      )
      for (const { Prefix: prefixo } of pagina.CommonPrefixes ?? []) {
        const escolaId = prefixo?.slice(PREFIXO_DAS_ESCOLAS.length, -1)
        if (escolaId !== undefined && FORMATO_UUID.test(escolaId)) escolas.push(escolaId)
      }
      continuacao = pagina.IsTruncated === true ? pagina.NextContinuationToken : undefined
    } while (continuacao !== undefined)
    return escolas
  }

  /** Os bytes guardados pela escola do contexto: a soma de tudo sob `escolas/{escolaId}/`. */
  async bytesDaEscola(): Promise<number> {
    const escolaId = contextoAtual()?.escolaId
    if (escolaId === undefined) throw new InvariantException('medição de storage sem escola no contexto')
    let bytes = 0
    let continuacao: string | undefined
    do {
      const pagina = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefixoDaEscola(escolaId), ContinuationToken: continuacao }))
      for (const objeto of pagina.Contents ?? []) bytes += objeto.Size ?? 0
      continuacao = pagina.IsTruncated === true ? pagina.NextContinuationToken : undefined
    } while (continuacao !== undefined)
    return bytes
  }
}
