import type { Arvore } from './arvore.ts'
import { aplicarTrocas } from './ast.ts'
import { reescreverRelativos } from './especificadores.ts'
import type { EntradaDoMapa } from './mapa.ts'
import { atualizarAlvosDoPacote } from './pacotes.ts'
import { formatacao, paraAbsoluto, paraRelativo, type Projeto } from './projetos.ts'

/**
 * Passo 3 do `aplicar`: o arquivo e a pasta mudam de lugar. Os imports, os `vi.mock` e os `require` que citam o caminho são
 * conta de caminho (`reescreverRelativos`): o serviço de linguagem refazia o programa de cada um dos 10 projetos a cada move, e o
 * programa cresce com os dependentes, não com o que se move (~105 s por move no mapa 5, 3h33 no total). O que continua do
 * serviço são as edições do `tsconfig` (`files`, `include`, `exclude`, `paths`), que saem da configuração: um serviço por
 * projeto, sem arquivo de código (`servicoDaConfiguracao`), e cada edição uma vez só. Os `exports` do pacote são daqui. O `git mv`
 * é da gravação.
 */

interface Edicao {
  inicio: number
  comprimento: number
  novo: string
}

function edicoesDaConfiguracao(arvore: Arvore, projetos: readonly Projeto[], de: string, para: string): Map<string, Map<string, Edicao>> {
  const porArquivo = new Map<string, Map<string, Edicao>>()
  for (const projeto of projetos) {
    for (const mudanca of projeto.servicoDaConfiguracao.getEditsForFileRename(paraAbsoluto(arvore, de), paraAbsoluto(arvore, para), formatacao, {})) {
      const arquivo = paraRelativo(arvore, mudanca.fileName)
      if (arquivo === undefined) continue
      const doArquivo = porArquivo.get(arquivo) ?? new Map<string, Edicao>()
      for (const troca of mudanca.textChanges) {
        const chave = `${String(troca.span.start)}:${String(troca.span.length)}`
        if (!doArquivo.has(chave)) doArquivo.set(chave, { inicio: troca.span.start, comprimento: troca.span.length, novo: troca.newText })
      }
      porArquivo.set(arquivo, doArquivo)
    }
  }
  return porArquivo
}

/** Move o arquivo ou a pasta da entrada, com tudo o que cita o caminho. */
export function moverEntrada(arvore: Arvore, projetos: readonly Projeto[], entrada: EntradaDoMapa): void {
  const pasta = entrada.tipo === 'pasta'
  const movimento = { de: entrada.de, para: entrada.para, pasta }
  for (const [arquivo, edicoes] of edicoesDaConfiguracao(arvore, projetos, entrada.de, entrada.para)) {
    arvore.escrever(arquivo, aplicarTrocas(arvore.ler(arquivo), [...edicoes.values()]))
  }
  reescreverRelativos(arvore, movimento, false)
  atualizarAlvosDoPacote(arvore, movimento)
  if (pasta) arvore.moverPasta(entrada.de, entrada.para)
  else arvore.mover(entrada.de, entrada.para)
}
