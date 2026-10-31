/**
 * A porta do storage privado do arquivo do titular (F3, tarefa 13.0; Tech Spec do F3, seções 2, 5 e 12; regra 00, item
 * 7): o que o sistema precisa de um armazém de objetos, sem saber qual. O adaptador S3 (`s3-file-storage.ts`) atende o
 * SeaweedFS do compose e qualquer storage S3-compatível; o falso (`InMemoryFileStorage`) atende os testes e a fase em que
 * nenhum storage é de pé.
 *
 * **O campo `chave_objeto` nunca sai pela API**: ela entrega só a URL assinada de validade curta (regra 20, item 7), que
 * leva o caminho do objeto, só com ids, e nenhum método daqui devolve a chave para fora. Quem chama passa a chave que o `ArquivoDoTitularRepository` guardou.
 */

/**
 * O armazém falhou ou não respondeu: fora do ar, prazo estourado, credencial recusada. Quem monta o arquivo deixa o
 * pedido "em preparação" e o job tenta de novo; quem baixa responde `INDISPONIVEL_TENTE_DE_NOVO`. A mensagem não leva a
 * chave do objeto, a URL nem o texto do erro do SDK (que pode trazer o endereço interno).
 */
export class FileStorageUnavailableError extends Error {
  constructor() {
    super('armazem_indisponivel')
    this.name = 'FileStorageUnavailableError'
  }
}

export interface DownloadUrlOptions {
  /** O nome que o navegador grava, `meus-dados-AAAA-MM-DD.json`: vai no `content-disposition` assinado. */
  readonly nome: string
  /** Por quantos segundos a URL vale (`VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS`: 5 minutos). */
  readonly validadeSegundos: number
}

export interface FileStorage {
  /** Grava o objeto, sobrescrevendo o que já houver na chave: o job repetido grava os mesmos bytes no mesmo lugar. */
  guardar(chave: string, conteudo: string): Promise<void>
  /** Se o objeto existe. Chave que nunca foi gravada devolve `false`, e só falha de verdade (`FileStorageUnavailableError`) lança. */
  existe(chave: string): Promise<boolean>
  /** Apaga o objeto. Apagar o que não existe não falha: a rotina da noite seguinte repete o que a anterior não terminou. */
  apagar(chave: string): Promise<void>
  /**
   * A URL de download assinada, com `Cache-Control: no-store` e `Content-Disposition: attachment` fixados pela
   * assinatura, e a validade pedida. Não confere se o objeto existe: quem entrega a URL chama `existe` antes.
   */
  urlDeDownload(chave: string, opcoes: DownloadUrlOptions): Promise<string>
}

/** Uma URL que o armazém falso assinou, para o teste conferir a chave, o nome e a validade. */
export interface FakeSignedUrl {
  readonly chave: string
  readonly nome: string
  readonly validadeSegundos: number
  readonly url: string
}

/**
 * O armazém em memória dos testes. **Não é para produção**: os objetos somem com o processo. Faz o que os testes
 * precisam provar da regra: o que foi gravado e apagado, as URLs assinadas e as falhas (`fora` derruba tudo;
 * `falhaAoApagar` derruba só o apagar, que é o que a rotina da noite seguinte repara).
 */
export class InMemoryFileStorage implements FileStorage {
  readonly objetos = new Map<string, string>()
  readonly urlsAssinadas: FakeSignedUrl[] = []
  /** Com `true`, toda operação lança `FileStorageUnavailableError`, como o storage fora do ar. */
  fora = false
  /** Com `true`, só `apagar` lança: o objeto continua lá, para o teste ver a noite seguinte removê-lo. */
  falhaAoApagar = false
  /** Quantas vezes `guardar` rodou, inclusive as que sobrescreveram: a prova de que o job repetido não duplica. */
  guardadas = 0

  async guardar(chave: string, conteudo: string): Promise<void> {
    this.#conferir()
    this.guardadas += 1
    this.objetos.set(chave, conteudo)
  }

  async existe(chave: string): Promise<boolean> {
    this.#conferir()
    return this.objetos.has(chave)
  }

  async apagar(chave: string): Promise<void> {
    this.#conferir()
    if (this.falhaAoApagar) throw new FileStorageUnavailableError()
    this.objetos.delete(chave)
  }

  async urlDeDownload(chave: string, opcoes: DownloadUrlOptions): Promise<string> {
    this.#conferir()
    const url = `https://armazem-falso.invalid/${chave}?validade=${opcoes.validadeSegundos}&nome=${encodeURIComponent(opcoes.nome)}`
    this.urlsAssinadas.push({ chave, nome: opcoes.nome, validadeSegundos: opcoes.validadeSegundos, url })
    return url
  }

  #conferir(): void {
    if (this.fora) throw new FileStorageUnavailableError()
  }
}
