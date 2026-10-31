import { useSyncExternalStore } from 'react'

/**
 * A aparência da pessoa (D80, item 2; Tech Spec da X1, seção 5): **Sistema**, **Claro** ou **Escuro**.
 *
 * O que fica no navegador é só a escolha explícita, em `educa.aparencia`, com `claro` ou `escuro`. Sistema não grava: ele
 * **apaga** a chave, e o `localStorage` volta a ser o que era antes da escolha. É preferência do aparelho, sem pessoa,
 * escola nem papel (regra 50, item 7; RF24): o próximo aluno do mesmo computador a herda, e mais nada.
 *
 * Quem pinta o primeiro quadro é o `<script>` em linha do `index.html`, que repete a conta de `resolverTema` sem esperar o
 * pacote do React. O teste de `theme.test.ts` extrai aquele script do arquivo e o confere contra esta função, caso a caso.
 */
export type Aparencia = 'sistema' | 'claro' | 'escuro'

/** O tema que a tela pinta de fato: sempre um dos dois, nunca "sistema". */
export type Tema = 'claro' | 'escuro'

export const CHAVE_DA_APARENCIA = 'educa.aparencia'

const CONSULTA_DO_SISTEMA_ESCURO = '(prefers-color-scheme: dark)'

/**
 * A escolha vence o sistema; sem escolha, ou com um valor que não é nenhum dos dois, vale o sistema. O valor lido do
 * navegador nunca é confiado: o que o script e esta função escrevem no `<html>` é `claro` ou `escuro`, e mais nada.
 */
export function resolverTema(escolha: string | null | undefined, sistemaEscuro: boolean): Tema {
  if (escolha === 'claro' || escolha === 'escuro') return escolha
  return sistemaEscuro ? 'escuro' : 'claro'
}

/**
 * A escolha que o armazenamento **recusou**: com a gravação lançando (política do Chromebook gerenciado, navegação
 * anônima), a escolha vale até a aba fechar, e é daqui que ela é lida. Fica vazia enquanto o armazenamento funciona, e a
 * chave dele é a única fonte da escolha.
 *
 * Vale também para Sistema: com o `removeItem` lançando e a leitura funcionando, voltar a Sistema vale na aba, mas a chave
 * antiga continua no armazenamento e volta na próxima carga. É o que o RF4 diz ("vale até a aba fechar"), e é calado.
 */
let escolhaQueOArmazenamentoRecusou: Aparencia | undefined

function escolhaGuardada(): 'claro' | 'escuro' | undefined {
  try {
    const valor = window.localStorage.getItem(CHAVE_DA_APARENCIA)
    return valor === 'claro' || valor === 'escuro' ? valor : undefined
  } catch {
    // Sem acesso ao armazenamento: a aparência é a do sistema, calada.
    return undefined
  }
}

function sistemaEstaEscuro(): boolean {
  try {
    return window.matchMedia(CONSULTA_DO_SISTEMA_ESCURO).matches
  } catch {
    // Sem `matchMedia` (ou recusando): o claro, que é a pele de quem não disse nada.
    return false
  }
}

/** O que a pessoa escolheu, ou Sistema quando ela não escolheu (ou quando o armazenamento não responde). */
export function lerAparencia(): Aparencia {
  return escolhaQueOArmazenamentoRecusou ?? escolhaGuardada() ?? 'sistema'
}

const ouvintes = new Set<() => void>()

/** Escreve o tema de agora no `<html>`, que é o que o CSS lê (`:root[data-tema]`), e o devolve. */
export function aplicarTema(): Tema {
  const tema = resolverTema(lerAparencia(), sistemaEstaEscuro())
  document.documentElement.setAttribute('data-tema', tema)
  return tema
}

function aoMudarAAparencia(): void {
  aplicarTema()
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * Guarda a escolha e a aplica na hora. Só `claro` e `escuro` gravam; Sistema apaga a chave. Leitura ou gravação que lança
 * não quebra nada: a escolha vale até a aba fechar.
 */
export function escolherAparencia(aparencia: Aparencia): void {
  try {
    if (aparencia === 'sistema') window.localStorage.removeItem(CHAVE_DA_APARENCIA)
    else window.localStorage.setItem(CHAVE_DA_APARENCIA, aparencia)
    escolhaQueOArmazenamentoRecusou = undefined
  } catch {
    escolhaQueOArmazenamentoRecusou = aparencia
  }
  aoMudarAAparencia()
}

/**
 * Liga o tema da página: aplica o de agora e passa a acompanhar o aparelho (em Sistema, a página aberta muda com ele) e as
 * outras abas (o evento `storage`). Vale para toda tela, também as públicas, que não têm controle e seguem o que a pessoa
 * já escolheu. Devolve a função que desliga, para o teste.
 */
export function iniciarTema(): () => void {
  aplicarTema()
  let consulta: MediaQueryList | undefined
  try {
    consulta = window.matchMedia(CONSULTA_DO_SISTEMA_ESCURO)
  } catch {
    consulta = undefined
  }
  const aoMudarOSistema = () => aoMudarAAparencia()
  const aoMudarOArmazenamento = (evento: StorageEvent) => {
    // `key` nulo é o armazenamento inteiro limpo. Outra chave não é conosco.
    if (evento.key !== null && evento.key !== CHAVE_DA_APARENCIA) return
    // O que a outra aba gravou (ou apagou) vale mais do que o que esta aba guardou na memória.
    escolhaQueOArmazenamentoRecusou = undefined
    aoMudarAAparencia()
  }
  consulta?.addEventListener('change', aoMudarOSistema)
  window.addEventListener('storage', aoMudarOArmazenamento)
  return () => {
    consulta?.removeEventListener('change', aoMudarOSistema)
    window.removeEventListener('storage', aoMudarOArmazenamento)
  }
}

function assinar(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar)
  return () => {
    ouvintes.delete(aoMudar)
  }
}

/** A aparência de agora e como mudá-la, para a peça `Aparencia`. Acompanha a mudança que vem de outra aba. */
export function useAparencia(): { readonly aparencia: Aparencia; readonly escolher: (aparencia: Aparencia) => void } {
  const aparencia = useSyncExternalStore(assinar, lerAparencia, (): Aparencia => 'sistema')
  return { aparencia, escolher: escolherAparencia }
}
