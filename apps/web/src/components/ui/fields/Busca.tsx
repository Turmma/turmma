import { Search } from 'lucide-react'
import { useId } from 'react'
import { CAIXA_DO_CAMPO } from './field-styles'

interface Props {
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  /** O que a busca procura: "Buscar atividades". É o nome do campo para o leitor de tela e o exemplo dentro dele, vazio. */
  readonly rotulo: string
}

/**
 * A busca de uma lista (`docs/interface.md` 10.2): um `<input type="search">` de 44 px, com a lupa de 20 px à esquerda e
 * a caixa dos outros campos (borda de 2 px que se vê, fundo `campo`, o anel no foco). A letra é de 16 px, para o navegador
 * do celular não ampliar a tela ao tocar.
 *
 * **O rótulo não aparece escrito**: é só para o leitor de tela, ligado ao campo por `<label for>`, e se repete como exemplo
 * enquanto o campo está vazio. A lupa é decoração (`aria-hidden`), e a busca não filtra nada sozinha: quem usa a peça diz
 * o que fazer com `valor` e `aoMudar`.
 */
export function Busca({ valor, aoMudar, rotulo }: Props) {
  const campo = useId()
  return (
    <div className="relative w-full min-w-0">
      <label htmlFor={campo} className="sr-only">
        {rotulo}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-5 text-sutil" />
      <input
        id={campo}
        type="search"
        inputMode="search"
        autoComplete="off"
        value={valor}
        placeholder={rotulo}
        onChange={(evento) => aoMudar(evento.target.value)}
        className={`min-h-11 w-full min-w-0 py-2 pr-3 pl-11 text-base font-medium ${CAIXA_DO_CAMPO}`}
      />
    </div>
  )
}
