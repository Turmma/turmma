interface LugarDaNavegacao {
  readonly rotulo: string
  readonly caminho: string
}

interface PropsDeOndeFicaCadaCoisa {
  readonly titulo: string
  /** Os lugares da navegação do papel, na ordem da lateral: a lista sai **dela**, e não de uma lista à parte. */
  readonly lugares: readonly LugarDaNavegacao[]
  /** A frase de cada lugar, pelo rótulo. Lugar sem frase mostraria só o rótulo e um ponto solto: o teste dos textos de cada papel reprova. */
  readonly descricoes: Readonly<Record<string, string>>
}

/**
 * "Onde fica cada coisa": um item por lugar da navegação do papel, na ordem da lateral, com uma frase de cada (telas do aluno e primeiro
 * acesso, 10.0 e 11.0). O lugar que a fase não tem não aparece, e o que a fase acrescentar entra sozinho. Texto, e não link: a pessoa
 * ainda está na introdução, e "Continuar" é o caminho para o primeiro lugar.
 */
export function OndeFicaCadaCoisa({ titulo, lugares, descricoes }: PropsDeOndeFicaCadaCoisa) {
  return (
    <section aria-labelledby="onde-fica-cada-coisa" className="flex w-full min-w-0 flex-col gap-2 text-left">
      <h2 id="onde-fica-cada-coisa" className="t-cartao min-w-0 break-words text-tinta">
        {titulo}
      </h2>
      <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {lugares.map((lugar) => (
          <li key={lugar.caminho} className="t-corpo min-w-0 break-words rounded-controle border-2 border-borda bg-superficie px-4 py-3 text-tinta">
            <span className="font-bold">{lugar.rotulo}</span>
            <span className="text-sutil"> · {descricoes[lugar.rotulo]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
