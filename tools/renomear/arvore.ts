import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * A árvore do repositório na memória (Tech Spec da X8, §5: "só grava depois de calcular tudo"). O `aplicar` calcula cada passo
 * sobre ela, e a recusa descarta a árvore: nada foi escrito. Só `gravar` toca o disco, e é o único lugar que chama o git.
 *
 * Só os arquivos versionados entram. O conteúdo é texto, ou `null` para o que não se lê como texto (imagem, fonte, PDF): esses
 * ainda mudam de lugar, mas ninguém os edita.
 */

const BINARIOS = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|pdf|zip|gz)$/i

export interface Movimento {
  de: string
  para: string
  pasta: boolean
}

/** Roda um comando na raiz. O teste troca este por um registro, para o `npm` que não deve rodar. */
export type Executor = (comando: string, argumentos: readonly string[], cwd: string) => void

export const executarDeVerdade: Executor = (comando, argumentos, cwd) => {
  execFileSync(comando, [...argumentos], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
}

function listarVersionados(raiz: string): string[] {
  const saida = execFileSync('git', ['ls-files', '-z', '--cached'], { cwd: raiz, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return saida.split('\0').filter((caminho) => caminho !== '')
}

export class Arvore {
  private readonly original: ReadonlyMap<string, string | null>
  private readonly atualPorCaminho: Map<string, string | null>
  private readonly versoes = new Map<string, number>()
  /** O caminho de origem de cada arquivo que mudou de lugar, para achar o conteúdo original dele. */
  private readonly origem = new Map<string, string>()
  /** Para cada arquivo original que mudou de lugar, onde ele está agora. */
  private readonly destinoDe = new Map<string, string>()
  readonly movimentos: Movimento[] = []

  readonly raiz: string

  private constructor(raiz: string, conteudos: Map<string, string | null>) {
    this.raiz = raiz
    this.original = new Map(conteudos)
    this.atualPorCaminho = conteudos
  }

  static carregar(raiz: string): Arvore {
    const conteudos = new Map<string, string | null>()
    for (const caminho of listarVersionados(raiz)) {
      const absoluto = join(raiz, caminho)
      // Apagado no disco e ainda no índice: não é arquivo da árvore.
      if (!existsSync(absoluto)) continue
      conteudos.set(caminho, BINARIOS.test(caminho) ? null : readFileSync(absoluto, 'utf8'))
    }
    return new Arvore(raiz, conteudos)
  }

  existe(caminho: string): boolean {
    return this.atualPorCaminho.has(caminho)
  }

  /** O caminho é um arquivo que a árvore conhecia e que já não está nele. */
  saiu(caminho: string): boolean {
    return this.destinoDe.has(caminho) && !this.atualPorCaminho.has(caminho)
  }

  conhece(caminho: string): boolean {
    return this.existe(caminho) || this.destinoDe.has(caminho)
  }

  /** Há arquivo da árvore dentro da pasta. */
  temPasta(pasta: string): boolean {
    const prefixo = `${pasta}/`
    for (const caminho of this.atualPorCaminho.keys()) if (caminho.startsWith(prefixo)) return true
    return false
  }

  /** O texto do arquivo, ou `undefined` se ele não existe ou não é texto. */
  lerOuNada(caminho: string): string | undefined {
    return this.atualPorCaminho.get(caminho) ?? undefined
  }

  ler(caminho: string): string {
    const conteudo = this.lerOuNada(caminho)
    if (conteudo === undefined) throw new Error(`${caminho} não existe na árvore, ou não é texto`)
    return conteudo
  }

  escrever(caminho: string, conteudo: string): void {
    if (this.atualPorCaminho.get(caminho) === conteudo) return
    this.atualPorCaminho.set(caminho, conteudo)
    this.versoes.set(caminho, this.versao(caminho) + 1)
  }

  versao(caminho: string): number {
    return this.versoes.get(caminho) ?? 0
  }

  /** Os caminhos de hoje, em ordem. */
  caminhos(): string[] {
    return [...this.atualPorCaminho.keys()].sort()
  }

  /** Onde está hoje o arquivo que a árvore tinha no começo em `caminho`; `undefined` se ele já não existe. */
  atual(caminhoOriginal: string): string | undefined {
    const destino = this.destinoDe.get(caminhoOriginal)
    if (destino !== undefined) return destino
    return this.atualPorCaminho.has(caminhoOriginal) ? caminhoOriginal : undefined
  }

  private moverArquivo(de: string, para: string): void {
    if (!this.existe(de)) throw new Error(`${de} não existe na árvore`)
    if (this.existe(para)) throw new Error(`${para} já existe na árvore`)
    const conteudo = this.atualPorCaminho.get(de) ?? null
    this.atualPorCaminho.delete(de)
    this.atualPorCaminho.set(para, conteudo)
    const raizDoArquivo = this.origem.get(de) ?? de
    this.origem.delete(de)
    this.origem.set(para, raizDoArquivo)
    this.destinoDe.set(raizDoArquivo, para)
    this.versoes.set(para, this.versao(para) + 1)
  }

  mover(de: string, para: string): void {
    this.moverArquivo(de, para)
    this.movimentos.push({ de, para, pasta: false })
  }

  moverPasta(de: string, para: string): void {
    const arquivos = this.caminhos().filter((caminho) => caminho.startsWith(`${de}/`))
    if (arquivos.length === 0) throw new Error(`${de} não existe na árvore, ou não tem arquivo`)
    for (const arquivo of arquivos) this.moverArquivo(arquivo, `${para}/${arquivo.slice(de.length + 1)}`)
    this.movimentos.push({ de, para, pasta: true })
  }

  private conteudoOriginalDe(caminho: string): string | null | undefined {
    return this.original.get(this.origem.get(caminho) ?? caminho)
  }

  /** Os arquivos que a gravação toca: o que mudou de texto, e os dois lados de cada mudança de lugar. */
  tocados(): Set<string> {
    const tocados = new Set<string>()
    for (const [caminho, conteudo] of this.atualPorCaminho) {
      if (this.origem.has(caminho) || conteudo !== this.conteudoOriginalDe(caminho)) tocados.add(caminho)
    }
    for (const [original, destino] of this.destinoDe) {
      if (original !== destino) tocados.add(original)
    }
    return tocados
  }

  /** O que sai de cada arquivo que mudou de texto, sem os que só mudaram de lugar. */
  alterados(): string[] {
    return [...this.atualPorCaminho].filter(([caminho, conteudo]) => conteudo !== this.conteudoOriginalDe(caminho)).map(([caminho]) => caminho)
  }

  /** O `git mv` de cada mudança de lugar, na ordem em que ela foi feita, e depois o texto de cada arquivo alterado. */
  gravar(executar: Executor): string[] {
    const comandos: string[] = []
    const git = (...argumentos: string[]) => {
      comandos.push(`git ${argumentos.join(' ')}`)
      executar('git', argumentos, this.raiz)
    }
    for (const { de, para } of this.movimentos) {
      mkdirSync(dirname(join(this.raiz, para)), { recursive: true })
      if (de.toLowerCase() === para.toLowerCase()) {
        // O sistema de arquivos sem distinção de caixa (o macOS do backup) não aceita o rename só de caixa direto.
        git('mv', de, `${de}.renomear-intermediario`)
        git('mv', `${de}.renomear-intermediario`, para)
      } else {
        git('mv', de, para)
      }
    }
    const escritos = this.alterados()
    for (const caminho of escritos) {
      const absoluto = join(this.raiz, caminho)
      mkdirSync(dirname(absoluto), { recursive: true })
      writeFileSync(absoluto, this.ler(caminho))
    }
    return comandos
  }
}
