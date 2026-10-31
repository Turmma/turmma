import { useEffect } from 'react'

/**
 * Os `<dialog>` modais ficam na camada de cima do navegador na ordem do `showModal`: o último a abrir cobre os outros e os deixa
 * inertes. Um painel que abre pelo endereço (o link do sino, a página recarregada) abre sozinho, e podia cobrir o aviso de
 * incidente da coordenação, que precisa ser lido antes de qualquer outro trabalho (correção 2026-10-17-painel-pelo-endereco-cobre-o-aviso).
 *
 * O diálogo **prioritário** (o aviso) se registra enquanto está na tela; o painel que ia abrir espera, sem abrir, e só abre
 * quando o último prioritário sai (confirmou, ou "Ver depois"). O painel que já estava aberto não é mexido: o aviso, que abre depois,
 * já fica por cima. Fica em módulo próprio, e não em `modal-dialog.ts`, por ser o único estado compartilhado entre os diálogos.
 */

let prioritarios = 0
let aoLiberar: Array<() => void> = []

/** Há um diálogo prioritário na tela agora? */
export function haDialogoPrioritario(): boolean {
  return prioritarios > 0
}

/** Registra um diálogo prioritário. Devolve o que o tira: quando sai o último, quem esperava é chamado, na ordem em que pediu. */
export function registrarDialogoPrioritario(): () => void {
  prioritarios += 1
  let saiu = false
  return () => {
    if (saiu) return
    saiu = true
    prioritarios -= 1
    if (prioritarios > 0) return
    const esperando = aoLiberar
    aoLiberar = []
    for (const chamar of esperando) chamar()
  }
}

/**
 * Chama `abrir` uma vez, quando não houver mais diálogo prioritário. Sem prioritário agora, chama já. Devolve o que desiste da espera
 * (o painel que fecha ou desmonta antes de o aviso sair).
 */
export function quandoNaoHouverPrioritario(abrir: () => void): () => void {
  if (!haDialogoPrioritario()) {
    abrir()
    return () => undefined
  }
  aoLiberar.push(abrir)
  return () => {
    aoLiberar = aoLiberar.filter((chamar) => chamar !== abrir)
  }
}

/** O diálogo que desenha isto é prioritário enquanto estiver montado. */
export function useDialogoPrioritario(): void {
  useEffect(() => registrarDialogoPrioritario(), [])
}
