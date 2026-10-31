interface Props {
  /** O que está sendo carregado, em pt-BR: "Carregando os avisos…". */
  rotulo: string
}

/**
 * Estado de carregamento (`docs/interface.md` 10.2): **texto, parado**. Nenhum pulso, nenhum esqueleto animado e nenhum
 * giro: nada que custe CPU no computador fraco da escola, e nada que se mexa sozinho diante do aluno (D59). `role="status"`
 * faz o leitor de tela dizer o que está carregando, uma vez.
 *
 * Esta peça mora na entrada (Tech Spec da X1, seção 7c): não importa nenhuma das peças que ficam fora dela.
 */
export function EstadoCarregando({ rotulo }: Props) {
  return (
    <p role="status" className="t-apoio rounded-cartao border-2 border-borda bg-superficie p-4 text-apoio">
      {rotulo}
    </p>
  )
}
