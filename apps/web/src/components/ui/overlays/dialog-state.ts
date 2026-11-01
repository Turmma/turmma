import { useCallback, useRef, useState } from 'react'

/**
 * Uma abertura de um diálogo da tela: o tipo dele, o número **desta** abertura e, quando o diálogo age sobre uma coisa da
 * lista (a escola do convite), o alvo daquela abertura. Cancelar o Nova escola e abrir outro Nova escola são duas
 * aberturas do mesmo tipo, com dois pedidos e dois ids (`pedidos-do-painel.ts`); só o número as separa.
 */
export interface DialogOpening<Tipo extends string, Alvo = never> {
  readonly tipo: Tipo
  /** Único na tela enquanto ela vive; serve também de `key`, para a abertura nova nunca herdar o estado da anterior. */
  readonly numero: number
  /**
   * Sobre o que o diálogo age, fotografado na abertura: a escola do convite (tarefa 7.0). Fica preso à abertura, e não
   * num estado à parte da tela, para a resposta de um pedido nunca ler o alvo de outra abertura.
   */
  readonly alvo?: Alvo
}

/** A abertura seguinte, com o número depois do último que a tela deu. */
export function proximaAbertura<Tipo extends string, Alvo = never>(tipo: Tipo, ultimoNumero: number, alvo?: Alvo): DialogOpening<Tipo, Alvo> {
  return alvo === undefined ? { tipo, numero: ultimoNumero + 1 } : { tipo, numero: ultimoNumero + 1, alvo }
}

/**
 * O diálogo aberto depois que o pedido feito em `esta` abertura termina: fecha só se ela ainda é a aberta. O `onSuccess`
 * da mutação roda mesmo com o diálogo desmontado, e a resposta pode chegar com outro diálogo aberto, do mesmo tipo ou não;
 * esse fica aberto, com o que já foi digitado nele (correção 2026-09-25-resposta-atrasada-fecha-o-dialogo-reaberto).
 */
export function fecharSeAindaAberta<Tipo extends string, Alvo = never>(
  aberta: DialogOpening<Tipo, Alvo> | undefined,
  esta: DialogOpening<Tipo, Alvo>,
): DialogOpening<Tipo, Alvo> | undefined {
  return aberta?.numero === esta.numero ? undefined : aberta
}

/**
 * O diálogo aberto de uma tela, um de cada vez. Quem desenha o diálogo passa a `aberta` para a resposta do pedido dele:
 * o `aoCriar` chama `fecharSeAinda(aberta)` com a abertura em que o pedido saiu, nunca com o tipo.
 *
 * `abertaNaMontagem` deixa o diálogo desse tipo aberto desde a primeira renderização: é a tela cujo endereço o pede
 * (`?convidar=1`, telas do professor, 13.0). Vale na montagem, sem efeito que abra depois; a abertura de agora é a primeira, e a
 * seguinte conta a partir dela.
 */
export function useDialogState<Tipo extends string, Alvo = never>(abertaNaMontagem?: Tipo): {
  readonly aberta: DialogOpening<Tipo, Alvo> | undefined
  readonly abrir: (tipo: Tipo, alvo?: Alvo) => void
  /** O "Cancelar" e o Esc: só o diálogo montado os oferece, e ele é o aberto. */
  readonly fechar: () => void
  readonly fecharSeAinda: (esta: DialogOpening<Tipo, Alvo>) => void
} {
  // Aberto desde a montagem (o endereço o pediu): é a primeira abertura da tela, e a seguinte conta a partir dela.
  const [aberta, definirAberta] = useState<DialogOpening<Tipo, Alvo> | undefined>(() => (abertaNaMontagem === undefined ? undefined : proximaAbertura<Tipo, Alvo>(abertaNaMontagem, 0)))
  const ultimoNumero = useRef(aberta?.numero ?? 0)
  const abrir = useCallback((tipo: Tipo, alvo?: Alvo) => {
    const nova = proximaAbertura(tipo, ultimoNumero.current, alvo)
    ultimoNumero.current = nova.numero
    definirAberta(nova)
  }, [])
  const fechar = useCallback(() => definirAberta(undefined), [])
  const fecharSeAinda = useCallback((esta: DialogOpening<Tipo, Alvo>) => definirAberta((atual) => fecharSeAindaAberta(atual, esta)), [])
  return { aberta, abrir, fechar, fecharSeAinda }
}
