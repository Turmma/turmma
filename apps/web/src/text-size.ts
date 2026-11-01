import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'wouter'

/**
 * O tamanho da letra do aluno (telas do aluno e primeiro acesso, 8.0; RF11; Tech Spec, seção 5): **Padrão**, **Grande** ou
 * **Maior**. Vale só na área do aluno (`/aluno`), antes de a primeira tela desenhar.
 *
 * O que fica no navegador é só a escolha explícita, em `educa.letra`, com `grande` ou `maior`. Padrão não grava: ele
 * **apaga** a chave, e o `localStorage` volta a ser o que era antes da escolha. É preferência do aparelho, sem pessoa,
 * escola nem papel (regra 20, item 1; regra 50, item 7): o próximo aluno do mesmo computador a herda, e mais nada. Montar,
 * abrir o diálogo e entrar na área nunca escrevem: só `escolherLetra` escreve.
 *
 * Quem pinta o primeiro quadro é o `<script>` em linha do `index.html`, que lê a chave e escreve `data-letra` no `<html>`
 * quando o caminho começa por `/aluno`. O `src/text-size.test.ts` extrai aquele script do arquivo e o confere contra `resolverLetra`.
 */
export type TextSize = 'padrao' | 'grande' | 'maior'

export const TEXT_SIZE_STORAGE_KEY = 'educa.letra'

/** O atributo do `<html>` que o CSS lê (`:root[data-letra]`). Padrão é a ausência dele. */
export const TEXT_SIZE_ATTRIBUTE = 'data-letra'

/**
 * O valor lido do navegador nunca é confiado: só `grande` e `maior` valem, e qualquer outra coisa (inclusive `padrao`, vazio
 * e maiúscula) é Padrão. O que o script e esta função escrevem no `<html>` é `grande` ou `maior`, e mais nada.
 */
export function resolverLetra(valor: string | null | undefined): TextSize {
  return valor === 'grande' || valor === 'maior' ? valor : 'padrao'
}

/**
 * A escolha que o armazenamento **recusou**: com a gravação lançando (política do Chromebook gerenciado, navegação
 * anônima), a escolha vale até a aba fechar, e é daqui que ela é lida. Fica vazia enquanto o armazenamento funciona, e a
 * chave dele é a única fonte da escolha.
 */
let escolhaQueOArmazenamentoRecusou: TextSize | undefined

function escolhaGuardada(): TextSize {
  try {
    return resolverLetra(window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY))
  } catch {
    // Sem acesso ao armazenamento: a letra é a Padrão, calada.
    return 'padrao'
  }
}

/** O que o aluno escolheu, ou Padrão quando ele não escolheu (ou quando o armazenamento não responde). */
export function lerLetra(): TextSize {
  return escolhaQueOArmazenamentoRecusou ?? escolhaGuardada()
}

const ouvintes = new Set<() => void>()

function avisarOsOuvintes(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * Guarda a escolha e avisa quem a mostra. Só `grande` e `maior` gravam; Padrão apaga a chave. Gravação que lança não quebra
 * nada: a escolha vale até a aba fechar.
 */
export function escolherLetra(letra: TextSize): void {
  try {
    if (letra === 'padrao') window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY)
    else window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, letra)
    escolhaQueOArmazenamentoRecusou = undefined
  } catch {
    escolhaQueOArmazenamentoRecusou = letra
  }
  avisarOsOuvintes()
}

/** Outra aba mexeu na chave (ou limpou o armazenamento inteiro, `key` nulo): o que ela gravou vale mais que a memória daqui. */
function aoMudarOArmazenamento(evento: StorageEvent): void {
  if (evento.key !== null && evento.key !== TEXT_SIZE_STORAGE_KEY) return
  escolhaQueOArmazenamentoRecusou = undefined
  avisarOsOuvintes()
}

/**
 * Passa a acompanhar as outras abas (o evento `storage`): a escolha feita numa chega à outra, e a última vence. Chamado uma
 * vez por `main.tsx`, como o `initTheme`, e por isso este módulo mora na entrada e não vira pedaço dividido entre a área do
 * aluno e a galeria. Não lê nem escreve nada no armazenamento. Devolve a função que desliga, para o teste.
 */
export function iniciarLetra(): () => void {
  window.addEventListener('storage', aoMudarOArmazenamento)
  return () => window.removeEventListener('storage', aoMudarOArmazenamento)
}

function assinar(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar)
  return () => {
    ouvintes.delete(aoMudar)
  }
}

/** A letra de agora e como mudá-la, para a peça `TamanhoDaLetra`. Acompanha a mudança que vem de outra aba. */
export function useTextSize(): { readonly letra: TextSize; readonly escolher: (letra: TextSize) => void } {
  const letra = useSyncExternalStore(assinar, lerLetra, (): TextSize => 'padrao')
  return { letra, escolher: escolherLetra }
}

/** O endereço é da área do aluno? Quem decide é o caminho, e o mesmo teste está no script em linha do `index.html`. */
export function noCaminhoDoAluno(caminho: string): boolean {
  return caminho === '/aluno' || caminho.startsWith('/aluno/')
}

/** Escreve (ou tira) o `data-letra` do `<html>`. Padrão não deixa atributo. */
function aplicarLetra(letra: TextSize): void {
  if (letra === 'padrao') document.documentElement.removeAttribute(TEXT_SIZE_ATTRIBUTE)
  else document.documentElement.setAttribute(TEXT_SIZE_ATTRIBUTE, letra)
}

/**
 * Mantém o `data-letra` do `<html>` **enquanto o endereço é o da área do aluno**, e o tira no instante em que ele deixa de
 * ser: o professor e a coordenação não têm o tamanho (Tech Spec, seção 5). Montado uma vez, na raiz (`main.tsx`), e não
 * dentro da área: quem abre `/aluno` sem sessão é levado à entrada sem a área chegar a montar, e o atributo que o script
 * em linha escreveu ficaria para a pessoa seguinte, que pode ser um professor. Só escreve no `<html>`; nunca no
 * armazenamento.
 */
export function useApplyTextSize(): void {
  const [caminho] = useLocation()
  const { letra } = useTextSize()
  const valeAqui = noCaminhoDoAluno(caminho)
  useEffect(() => {
    aplicarLetra(valeAqui ? letra : 'padrao')
    return () => document.documentElement.removeAttribute(TEXT_SIZE_ATTRIBUTE)
  }, [valeAqui, letra])
}
