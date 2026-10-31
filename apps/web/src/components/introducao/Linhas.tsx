/** As frases de um passo da introdução, uma por linha, em `t-corpo`: texto fixo do `textos-da-introducao.ts` de cada papel. */
export function Linhas({ linhas }: { readonly linhas: readonly string[] }) {
  return (
    <ul className="flex w-full min-w-0 flex-col gap-2">
      {linhas.map((linha) => (
        <li key={linha} className="t-corpo min-w-0 break-words rounded-controle border-2 border-borda bg-superficie px-4 py-3 text-tinta">
          {linha}
        </li>
      ))}
    </ul>
  )
}
