import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../../tools/ci/compose.ts'
import { S3FileStorage } from './s3-file-storage.js'

// O armazém do arquivo do titular contra o SeaweedFS do compose de teste (F3, tarefa 13.0; Tech Spec do F3, seção 12, premissa "o
// SeaweedFS assina a URL de GET com o SDK S3"): guardar, conferir, baixar pela URL assinada, ver o `no-store` e o `attachment`
// que a assinatura fixa, e apagar. O bucket acumula objetos de outras execuções: cada teste usa uma chave sorteada.

const ambiente = lerAmbienteDeTeste()
const ENDERECO = `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`
const { armazem, encerrar } = S3FileStorage.criar({
  url: ENDERECO,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
})

const chaveNova = (): string => `titular/${randomUUID()}/${randomUUID()}/completa.json`

describe('ArmazemS3 no SeaweedFS', () => {
  afterAll(() => encerrar())

  it('guarda, confere, baixa pela URL assinada com `no-store` e `attachment` e o nome do arquivo, e apaga', async () => {
    const chave = chaveNova()
    const conteudo = JSON.stringify({ versao: 'completa', tabelas: { usuario: [{ id: randomUUID() }] } })
    expect(await armazem.existe(chave)).toBe(false)
    await armazem.guardar(chave, conteudo)
    expect(await armazem.existe(chave)).toBe(true)

    const url = await armazem.urlDeDownload(chave, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 300 })
    const resposta = await fetch(url)
    expect(resposta.status).toBe(200)
    expect(await resposta.text()).toBe(conteudo)
    expect(resposta.headers.get('cache-control')).toBe('no-store')
    expect(resposta.headers.get('content-disposition')).toBe('attachment; filename="meus-dados-2026-10-09.json"')

    await armazem.apagar(chave)
    expect(await armazem.existe(chave)).toBe(false)
    // Apagar o que não existe não falha: a noite seguinte repete o que a anterior não terminou.
    await armazem.apagar(chave)
  })

  it('a URL de uma chave não abre outra, e a que venceu não abre', async () => {
    const chave = chaveNova()
    const outra = chaveNova()
    await armazem.guardar(chave, '{"a":1}')
    await armazem.guardar(outra, '{"b":2}')
    try {
      const url = new URL(await armazem.urlDeDownload(chave, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 300 }))
      // Troca só o caminho do objeto: a assinatura cobre a chave, e o storage recusa.
      const trocada = new URL(url)
      trocada.pathname = url.pathname.replace(chave, outra)
      expect((await fetch(trocada)).status).toBe(403)

      const curta = await armazem.urlDeDownload(chave, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 1 })
      await new Promise((resolver) => setTimeout(resolver, 2_500))
      expect((await fetch(curta)).status).toBe(403)
    } finally {
      await armazem.apagar(chave)
      await armazem.apagar(outra)
    }
  }, 20_000)

  it('o objeto sem assinatura não abre: o bucket é privado', async () => {
    const chave = chaveNova()
    await armazem.guardar(chave, '{"a":1}')
    try {
      const semAssinatura = await fetch(`${ENDERECO}/${valorObrigatorio(ambiente, 'STORAGE_BUCKET')}/${chave}`)
      expect(semAssinatura.status).toBeGreaterThanOrEqual(400)
    } finally {
      await armazem.apagar(chave)
    }
  })
})
