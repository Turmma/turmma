import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { FileStorageUnavailableError, type FileStorage, type DownloadUrlOptions } from './armazem-de-arquivos.js'

/** Tempo máximo de conexão e de cada requisição ao storage: o job de arquivo e a resposta da API não ficam pendurados. */
export const TIMEOUT_CONEXAO_DO_ARMAZEM_MS = 2_000
export const TIMEOUT_REQUISICAO_DO_ARMAZEM_MS = 10_000

export interface S3FileStorageConfig {
  /** O endereço por onde este processo alcança o storage (o do compose, na rede interna). */
  readonly url: string
  /**
   * O endereço por onde o **navegador** alcança o storage, e que entra na URL assinada. Sem ele, vale `url`. A assinatura
   * cobre o host: a URL assinada com o endereço interno não abre fora da rede do compose.
   */
  readonly urlPublica?: string
  readonly regiao: string
  readonly bucket: string
  readonly chaveAcesso: string
  readonly chaveSecreta: string
  /** Tentativas por chamada. Sem ele, 3 (o job do worker repete); a API pede 1, porque o cliente espera a resposta. */
  readonly tentativas?: number
  /** Prazo de cada requisição, em ms. Sem ele, `TIMEOUT_REQUISICAO_DO_ARMAZEM_MS`; a API pede um prazo menor. */
  readonly timeoutRequisicaoMs?: number
}

/** O cliente S3 puro (regra 00, item 7): endereço por caminho, que qualquer storage compatível atende, e prazos. */
export function createS3Client(config: Pick<S3FileStorageConfig, 'regiao' | 'chaveAcesso' | 'chaveSecreta' | 'tentativas' | 'timeoutRequisicaoMs'> & { url: string }): S3Client {
  return new S3Client({
    endpoint: config.url,
    region: config.regiao,
    forcePathStyle: true,
    credentials: { accessKeyId: config.chaveAcesso, secretAccessKey: config.chaveSecreta },
    maxAttempts: config.tentativas ?? 3,
    // `throwOnRequestTimeout`: sem ele o handler do SDK só registra um aviso quando o prazo estoura, e a chamada segue esperando.
    requestHandler: { connectionTimeout: TIMEOUT_CONEXAO_DO_ARMAZEM_MS, requestTimeout: config.timeoutRequisicaoMs ?? TIMEOUT_REQUISICAO_DO_ARMAZEM_MS, throwOnRequestTimeout: true },
  })
}

/**
 * O armazém do arquivo do titular sobre qualquer storage S3-compatível (F3, tarefa 13.0). Dois clientes: o que fala com o
 * storage (`cliente`) e o que só assina (`assinador`), com o endereço público. Assinar é conta local, sem rede, então o
 * `assinador` nunca precisa alcançar o storage.
 *
 * Toda falha do storage vira `FileStorageUnavailableError`, sem o texto do SDK: ele traz o endereço interno e a chave do objeto.
 * O objeto ausente em `existe` é a única "falha" que não é falha.
 */
export class S3FileStorage implements FileStorage {
  constructor(
    private readonly cliente: S3Client,
    private readonly bucket: string,
    private readonly assinador: S3Client = cliente,
  ) {}

  /** O armazém pronto para a configuração: o cliente interno e, se houver endereço público, o assinador dele. */
  static criar(config: S3FileStorageConfig): { armazem: S3FileStorage; encerrar(): void } {
    const cliente = createS3Client(config)
    const assinador = config.urlPublica === undefined || config.urlPublica === config.url ? cliente : createS3Client({ ...config, url: config.urlPublica })
    return {
      armazem: new S3FileStorage(cliente, config.bucket, assinador),
      encerrar: () => {
        cliente.destroy()
        if (assinador !== cliente) assinador.destroy()
      },
    }
  }

  async guardar(chave: string, conteudo: string): Promise<void> {
    await this.#enviar(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chave,
        Body: conteudo,
        ContentType: 'application/json; charset=utf-8',
        // Defesa em profundidade: a assinatura da URL já fixa os dois, mas o objeto também nasce sem cache e como anexo.
        CacheControl: 'no-store',
        ContentDisposition: 'attachment',
      }),
    )
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await this.cliente.send(new HeadObjectCommand({ Bucket: this.bucket, Key: chave }))
      return true
    } catch (erro) {
      if (erro instanceof S3ServiceException && (erro.name === 'NotFound' || erro.$metadata.httpStatusCode === 404)) return false
      throw new FileStorageUnavailableError()
    }
  }

  async apagar(chave: string): Promise<void> {
    await this.#enviar(new DeleteObjectCommand({ Bucket: this.bucket, Key: chave }))
  }

  async urlDeDownload(chave: string, opcoes: DownloadUrlOptions): Promise<string> {
    try {
      return await getSignedUrl(
        this.assinador,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: chave,
          ResponseCacheControl: 'no-store',
          ResponseContentDisposition: `attachment; filename="${opcoes.nome}"`,
        }),
        { expiresIn: opcoes.validadeSegundos },
      )
    } catch {
      throw new FileStorageUnavailableError()
    }
  }

  async #enviar(comando: PutObjectCommand | DeleteObjectCommand): Promise<void> {
    try {
      await this.cliente.send(comando)
    } catch {
      throw new FileStorageUnavailableError()
    }
  }
}
