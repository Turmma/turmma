import { useEffect, useState } from 'react'

/**
 * O relógio do computador, relido a cada `passoMs`: o que a tela diz de uma janela ("Abre em…", "Fechou") muda com o tempo sem o aluno recarregar. É a hora **deste computador**; o servidor tem a palavra final
 * (`PROVA_FORA_DA_JANELA`), e o relógio da prova em andamento é outro, o do servidor (`RelogioDaProva`).
 */
export function useAgora(passoMs = 30_000): number {
  const [agora, definirAgora] = useState(() => Date.now())
  useEffect(() => {
    const batida = setInterval(() => definirAgora(Date.now()), passoMs)
    return () => clearInterval(batida)
  }, [passoMs])
  return agora
}
