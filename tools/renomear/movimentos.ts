import type { Arvore } from './arvore.ts'
import { aplicarTrocas, ehCodigo } from './ast.ts'
import { reescreverRelativos } from './especificadores.ts'
import type { EntradaDoMapa } from './mapa.ts'
import { atualizarAlvosDoPacote } from './pacotes.ts'
import { formatacao, paraAbsoluto, paraRelativo, type Projeto } from './projetos.ts'

/**
 * Passo 3 do `aplicar`: o arquivo e a pasta mudam de lugar. O serviço de linguagem diz quais imports (e quais `files`/`include`
 * do `tsconfig`) acompanham (`getEditsForFileRename`), um serviço por projeto e cada edição uma vez só; o `vi.mock` e os
 * `exports` do pacote são daqui. O `git mv` é da gravação.
 */

interface Edicao {
  inicio: number
  comprimento: number
  novo: string
}

const ehConfiguracaoDoTypescript = (caminho: string): boolean => /(^|\/)tsconfig[^/]*\.json$/.test(caminho)

/** O especificador relativo é o único que o `aplicar` deixa o serviço mudar: o de pacote o serviço refaria como caminho relativo. */
function vale(caminho: string, antigo: string): boolean {
  return ehConfiguracaoDoTypescript(caminho) || (ehCodigo(caminho) && antigo.startsWith('.'))
}

function edicoesDoServico(arvore: Arvore, projetos: readonly Projeto[], de: string, para: string): Map<string, Map<string, Edicao>> {
  const porArquivo = new Map<string, Map<string, Edicao>>()
  for (const projeto of projetos) {
    for (const mudanca of projeto.servico.getEditsForFileRename(paraAbsoluto(arvore, de), paraAbsoluto(arvore, para), formatacao, {})) {
      const arquivo = paraRelativo(arvore, mudanca.fileName)
      const texto = arquivo === undefined ? undefined : arvore.lerOuNada(arquivo)
      if (arquivo === undefined || texto === undefined) continue
      const doArquivo = porArquivo.get(arquivo) ?? new Map<string, Edicao>()
      for (const troca of mudanca.textChanges) {
        const antigo = texto.slice(troca.span.start, troca.span.start + troca.span.length)
        const chave = `${String(troca.span.start)}:${String(troca.span.length)}`
        if (vale(arquivo, antigo) && !doArquivo.has(chave)) doArquivo.set(chave, { inicio: troca.span.start, comprimento: troca.span.length, novo: conservarExtensao(antigo, troca.newText) })
      }
      porArquivo.set(arquivo, doArquivo)
    }
  }
  return porArquivo
}

/**
 * O serviço de linguagem refaz o especificador com a extensão do arquivo (`./a.ts`), porque lhe falta a preferência de extensão
 * do projeto. O `aplicar` só muda a pasta e o nome: o import que terminava em `.js` continua terminando em `.js`, e o que terminava
 * em `.ts`, em `.ts`. É só o par `.ts`/`.js`, o que o repositório usa (2795 imports `.js`; os `.mjs` apontam para arquivos `.mjs`).
 */
function conservarExtensao(antigo: string, novo: string): string {
  return antigo.endsWith('.js') && novo.endsWith('.ts') ? `${novo.slice(0, -'.ts'.length)}.js` : novo
}

/** Move o arquivo ou a pasta da entrada, com tudo o que cita o caminho. */
export function moverEntrada(arvore: Arvore, projetos: readonly Projeto[], entrada: EntradaDoMapa): void {
  const pasta = entrada.tipo === 'pasta'
  const movimento = { de: entrada.de, para: entrada.para, pasta }
  for (const [arquivo, edicoes] of edicoesDoServico(arvore, projetos, entrada.de, entrada.para)) {
    arvore.escrever(arquivo, aplicarTrocas(arvore.ler(arquivo), [...edicoes.values()]))
  }
  reescreverRelativos(arvore, movimento, true)
  atualizarAlvosDoPacote(arvore, movimento)
  if (pasta) arvore.moverPasta(entrada.de, entrada.para)
  else arvore.mover(entrada.de, entrada.para)
}
