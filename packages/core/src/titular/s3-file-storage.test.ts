import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3ServiceException, type S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { FileStorageUnavailableError } from './file-storage.js'
import { S3FileStorage, createS3Client, TIMEOUT_REQUISICAO_DO_ARMAZEM_MS } from './s3-file-storage.js'

const CHAVE = 'titular/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/completa.json'
const CONFIG = { url: 'http://storage:8333', regiao: 'us-east-1', chaveAcesso: 'chave_sintetica', chaveSecreta: 'segredo_sintetico_xyz' }

/** O cliente que só registra o que o armazém lhe manda, ou responde com o erro dado. */
function clienteFalso(resposta: unknown | Error): { enviados: unknown[]; cliente: S3Client } {
  const enviados: unknown[] = []
  const cliente = {
    send: async (comando: unknown) => {
      enviados.push(comando)
      if (resposta instanceof Error) throw resposta
      return resposta
    },
  } as unknown as S3Client
  return { enviados, cliente }
}

function naoEncontrado(): S3ServiceException {
  return new S3ServiceException({ name: 'NotFound', $fault: 'client', $metadata: { httpStatusCode: 404 }, message: 'sem objeto em http://storage:8333/educa/titular/x' })
}

/** O que o cliente resolveu de verdade: `requestHandler.configProvider` é a configuração que o SDK usa em cada chamada. */
interface PrazosDoCliente {
  requestTimeout?: number
  throwOnRequestTimeout?: boolean
}
async function prazosDe(cliente: S3Client): Promise<PrazosDoCliente> {
  return (cliente.config.requestHandler as unknown as { configProvider: Promise<PrazosDoCliente> }).configProvider
}

/** Um storage que leva `esperaMs` para responder 200 a qualquer chamada: o que o prazo do cliente tem de cortar. */
async function storageLento(esperaMs: number): Promise<{ url: string; fechar: () => void }> {
  const pendentes: ReturnType<typeof setTimeout>[] = []
  const servidor = createServer((_requisicao, resposta) => {
    pendentes.push(
      setTimeout(() => {
        resposta.writeHead(200, { 'content-length': '0' })
        resposta.end()
      }, esperaMs),
    )
  })
  servidor.listen(0, '127.0.0.1')
  await once(servidor, 'listening')
  const { port } = servidor.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${String(port)}`,
    fechar: () => {
      for (const pendente of pendentes) clearTimeout(pendente)
      servidor.closeAllConnections()
      servidor.close()
    },
  }
}

describe('ArmazemS3: a URL assinada', () => {
  it('assina com o endereço público, a validade pedida, `no-store` e `attachment` com o nome do arquivo, sem rede', async () => {
    const assinador = createS3Client({ ...CONFIG, url: 'http://127.0.0.1:58333' })
    const armazem = new S3FileStorage(createS3Client(CONFIG), 'educa-local', assinador)
    const url = new URL(await armazem.urlDeDownload(CHAVE, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 300 }))
    expect(url.origin).toBe('http://127.0.0.1:58333')
    expect(url.pathname).toBe(`/educa-local/${CHAVE}`)
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(url.searchParams.get('response-cache-control')).toBe('no-store')
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="meus-dados-2026-10-09.json"')
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    // A chave secreta nunca vai na URL.
    expect(url.toString()).not.toContain(CONFIG.chaveSecreta)
  })

  it('a validade da URL é a pedida: 60 s e 300 s dão assinaturas de validade diferentes', async () => {
    const armazem = new S3FileStorage(createS3Client(CONFIG), 'educa-local')
    const curta = new URL(await armazem.urlDeDownload(CHAVE, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 60 }))
    expect(curta.searchParams.get('X-Amz-Expires')).toBe('60')
    const longa = new URL(await armazem.urlDeDownload(CHAVE, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 300 }))
    expect(longa.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(longa.searchParams.get('X-Amz-Signature')).not.toBe(curta.searchParams.get('X-Amz-Signature'))
  })

  it('o cliente da API usa uma tentativa só e prazo próprio; o padrão do worker é de três tentativas', async () => {
    const daApi = createS3Client({ ...CONFIG, tentativas: 1, timeoutRequisicaoMs: 5_000 })
    expect(await daApi.config.maxAttempts()).toBe(1)
    expect(await prazosDe(daApi)).toMatchObject({ requestTimeout: 5_000, throwOnRequestTimeout: true })
    const doWorker = createS3Client(CONFIG)
    expect(await doWorker.config.maxAttempts()).toBe(3)
    expect(await prazosDe(doWorker)).toMatchObject({ requestTimeout: TIMEOUT_REQUISICAO_DO_ARMAZEM_MS, throwOnRequestTimeout: true })
  })
})

describe('ArmazemS3: as chamadas ao storage', () => {
  it('guarda o objeto sem cache e como anexo, e o apaga pelo mesmo caminho', async () => {
    const { enviados, cliente } = clienteFalso({})
    const armazem = new S3FileStorage(cliente, 'educa-local')
    await armazem.guardar(CHAVE, '{"a":1}')
    await armazem.apagar(CHAVE)
    const [guardar, apagar] = enviados
    expect(guardar).toBeInstanceOf(PutObjectCommand)
    expect((guardar as PutObjectCommand).input).toMatchObject({ Bucket: 'educa-local', Key: CHAVE, Body: '{"a":1}', CacheControl: 'no-store', ContentDisposition: 'attachment' })
    expect(apagar).toBeInstanceOf(DeleteObjectCommand)
    expect((apagar as DeleteObjectCommand).input).toEqual({ Bucket: 'educa-local', Key: CHAVE })
  })

  it('`guardarBytes` grava o PDF do material sem cache e com o prazo da chamada, e `lerBytes` o devolve inteiro', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 0, 255])
    const gravar = clienteFalso({})
    await new S3FileStorage(gravar.cliente, 'educa-local').guardarBytes(CHAVE, bytes, { prazoMs: 5_000 })
    expect(gravar.enviados[0]).toBeInstanceOf(PutObjectCommand)
    expect((gravar.enviados[0] as PutObjectCommand).input).toMatchObject({ Bucket: 'educa-local', Key: CHAVE, Body: bytes, ContentType: 'application/pdf', CacheControl: 'no-store' })

    const ler = clienteFalso({ Body: { transformToByteArray: () => Promise.resolve(bytes) } })
    expect(await new S3FileStorage(ler.cliente, 'educa-local').lerBytes(CHAVE, { prazoMs: 5_000 })).toEqual(bytes)
    expect(ler.enviados[0]).toBeInstanceOf(GetObjectCommand)
    expect((ler.enviados[0] as GetObjectCommand).input).toEqual({ Bucket: 'educa-local', Key: CHAVE })
  })

  it('`lerBytes` do objeto que não existe devolve `undefined`; qualquer outra falha é indisponibilidade, e nunca "ausente"', async () => {
    const ausente = new S3ServiceException({ name: 'NoSuchKey', $fault: 'client', $metadata: { httpStatusCode: 404 }, message: 'sem objeto em http://storage:8333/educa/x' })
    expect(await new S3FileStorage(clienteFalso(ausente).cliente, 'educa-local').lerBytes(CHAVE, { prazoMs: 5_000 })).toBeUndefined()
    const ausenteSemNome = new S3ServiceException({ name: 'UnknownError', $fault: 'client', $metadata: { httpStatusCode: 404 }, message: 'o 404 basta' })
    expect(await new S3FileStorage(clienteFalso(ausenteSemNome).cliente, 'educa-local').lerBytes(CHAVE, { prazoMs: 5_000 })).toBeUndefined()
    const proibido = new S3ServiceException({ name: 'AccessDenied', $fault: 'client', $metadata: { httpStatusCode: 403 }, message: 'negado' })
    for (const falha of [proibido, new Error('connect ECONNREFUSED http://storage:8333/educa-local/segredo')]) {
      const erro = await new S3FileStorage(clienteFalso(falha).cliente, 'educa-local').lerBytes(CHAVE, { prazoMs: 5_000 }).catch((queda: unknown) => queda)
      expect(erro).toBeInstanceOf(FileStorageUnavailableError)
      expect(JSON.stringify(erro)).not.toContain('storage:8333')
    }
    const queda = await new S3FileStorage(clienteFalso(new Error('connect ECONNREFUSED')).cliente, 'educa-local').guardarBytes(CHAVE, new Uint8Array(), { prazoMs: 5_000 }).catch((falha: unknown) => falha)
    expect(queda).toBeInstanceOf(FileStorageUnavailableError)
  })

  it('o prazo da chamada corta `guardarBytes` e `lerBytes`: o storage que demora mais vira indisponibilidade, e o que responde dentro dele é atendido', async () => {
    const storage = await storageLento(1_000)
    const { armazem, encerrar } = S3FileStorage.criar({ ...CONFIG, url: storage.url, bucket: 'educa-local', tentativas: 1, timeoutRequisicaoMs: 10_000 })
    try {
      // O controle: o mesmo storage, com prazo de sobra, atende a gravação.
      await expect(armazem.guardarBytes(CHAVE, new Uint8Array([1]), { prazoMs: 5_000 })).resolves.toBeUndefined()
      await expect(armazem.guardarBytes(CHAVE, new Uint8Array([1]), { prazoMs: 100 })).rejects.toBeInstanceOf(FileStorageUnavailableError)
      await expect(armazem.lerBytes(CHAVE, { prazoMs: 100 })).rejects.toBeInstanceOf(FileStorageUnavailableError)
    } finally {
      encerrar()
      storage.fechar()
    }
  })

  it('`existe` diz que não quando o storage diz que o objeto não está, e que sim quando está', async () => {
    expect(await new S3FileStorage(clienteFalso({}).cliente, 'educa-local').existe(CHAVE)).toBe(true)
    const { enviados, cliente } = clienteFalso(naoEncontrado())
    expect(await new S3FileStorage(cliente, 'educa-local').existe(CHAVE)).toBe(false)
    expect(enviados[0]).toBeInstanceOf(HeadObjectCommand)
  })

  it('qualquer outra falha do storage vira ArmazemIndisponivel, sem o texto do SDK, que traz o endereço e a chave', async () => {
    const queda = new Error('connect ECONNREFUSED http://storage:8333/educa-local/titular/segredo')
    for (const chamada of [
      (armazem: S3FileStorage) => armazem.guardar(CHAVE, '{}'),
      (armazem: S3FileStorage) => armazem.existe(CHAVE),
      (armazem: S3FileStorage) => armazem.apagar(CHAVE),
    ]) {
      const erro = await chamada(new S3FileStorage(clienteFalso(queda).cliente, 'educa-local')).catch((falha: unknown) => falha)
      expect(erro).toBeInstanceOf(FileStorageUnavailableError)
      expect((erro as Error).message).toBe('armazem_indisponivel')
      expect(JSON.stringify(erro)).not.toContain('storage:8333')
    }
    // O 403 e o 500 do storage também não são "objeto ausente".
    const proibido = new S3ServiceException({ name: 'AccessDenied', $fault: 'client', $metadata: { httpStatusCode: 403 }, message: 'negado' })
    await expect(new S3FileStorage(clienteFalso(proibido).cliente, 'educa-local').existe(CHAVE)).rejects.toBeInstanceOf(FileStorageUnavailableError)
  })

  it('`criar` usa o endereço público para assinar e o interno para falar com o storage, e os dois encerram', async () => {
    const { armazem, encerrar } = S3FileStorage.criar({ ...CONFIG, bucket: 'educa-local', urlPublica: 'https://arquivos.exemplo.test' })
    const url = new URL(await armazem.urlDeDownload(CHAVE, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 300 }))
    expect(url.origin).toBe('https://arquivos.exemplo.test')
    encerrar()
    // Sem endereço público, vale o interno.
    const interno = S3FileStorage.criar({ ...CONFIG, bucket: 'educa-local' })
    expect(new URL(await interno.armazem.urlDeDownload(CHAVE, { nome: 'x.json', validadeSegundos: 300 })).origin).toBe('http://storage:8333')
    interno.encerrar()
  })

  it('o prazo corta a chamada: o storage que demora mais que o prazo do cliente vira ArmazemIndisponivel, e o que responde dentro dele é atendido', async () => {
    const storage = await storageLento(1_000)
    const comPrazoPadrao = S3FileStorage.criar({ ...CONFIG, url: storage.url, bucket: 'educa-local', tentativas: 1 })
    const comPrazoCurto = S3FileStorage.criar({ ...CONFIG, url: storage.url, bucket: 'educa-local', tentativas: 1, timeoutRequisicaoMs: 100 })
    try {
      // O controle: o mesmo storage, dentro do prazo padrão, responde. A recusa abaixo é do prazo, e não do servidor de teste.
      expect(await comPrazoPadrao.armazem.existe(CHAVE)).toBe(true)
      await expect(comPrazoCurto.armazem.existe(CHAVE)).rejects.toBeInstanceOf(FileStorageUnavailableError)
    } finally {
      comPrazoPadrao.encerrar()
      comPrazoCurto.encerrar()
      storage.fechar()
    }
  })
})
