import { LogOut } from 'lucide-react'
import { NOME_DO_MENU_DA_PESSOA, type NavItem } from '../areas/navigation'
import { Aparencia } from './Aparencia'
import { classeDoBotaoDeLugar, Tooltip, ListaDeItens } from './itens-da-lateral'

interface Props {
  /** O nome e o papel de quem está na sessão; sem eles ainda (o `/v1/eu` não chegou), fica só o "Sair". */
  readonly nome?: string | undefined
  readonly papel?: string | undefined
  readonly aoSair: () => void
  readonly saindo: boolean
  /** Os links da pessoa, antes do "Sair" (`PERSON_MENU`): o professor tem "Meus dados". Sem eles, só o "Sair". */
  readonly itens?: readonly NavItem[]
  /** No trilho de 88 px sobram só os ícones, com o nome de cada um para o leitor de tela e a dica. */
  readonly trilho?: boolean
}

/**
 * As iniciais de um nome: a primeira letra da primeira e da última palavra (`docs/interface.md` 11.1, "o pé"). Uma palavra
 * só dá uma letra; texto vazio não dá nenhuma, e a bolinha não se desenha. É um enfeite, que o leitor de tela não lê: o
 * nome está escrito ao lado. Nada disso é guardado nem enviado: nasce do nome que a tela já mostra.
 */
export function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((palavra) => palavra !== '')
  const primeira = palavras[0]
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1] : undefined
  return [primeira, ultima]
    .filter((palavra): palavra is string => palavra !== undefined)
    .map((palavra) => Array.from(palavra)[0] ?? '')
    .join('')
    .toLocaleUpperCase('pt-BR')
}

/**
 * O menu da pessoa, no pé da lateral (P18; `docs/interface.md` 11.1): as iniciais, o nome, o papel, os links dela (o
 * professor tem "Meus dados"), a **Aparência** e **Sair**. Nada fica atrás de um clique a mais: os links e o "Sair" estão
 * à vista, com a mesma medida e o mesmo desenho dos lugares da navegação, e o "Sair" é sempre o último (D59, "sair nunca é
 * mais difícil que entrar"). As outras entradas do menu do ChatGPT nascem cada uma com a fase dela (P09).
 *
 * A Aparência (RF3) fica entre os links e o "Sair", e é uma parada só no Tab. No trilho de 88 px, onde só cabem ícones, ela
 * não aparece: a pessoa a alcança abrindo a lateral, que o trilho tem a um clique (e, de 768 a 1023 px, abre por cima).
 */
export function MenuDaPessoa({ nome, papel, aoSair, saindo, itens = [], trilho = false }: Props) {
  const rotulo = saindo ? 'Saindo…' : 'Sair'
  if (trilho)
    return (
      <div className="flex flex-col items-center gap-2">
        <ListaDeItens itens={itens} rotulo={NOME_DO_MENU_DA_PESSOA} trilho />
        <button type="button" onClick={aoSair} disabled={saindo} className={classeDoBotaoDeLugar(true)}>
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center">
            <LogOut size={22} strokeWidth={2.5} />
          </span>
          <span className="sr-only">{rotulo}</span>
          <Tooltip>{rotulo}</Tooltip>
        </button>
      </div>
    )
  const iniciais = nome === undefined ? '' : iniciaisDe(nome)
  return (
    <div className="flex flex-col gap-2 border-t-2 border-borda pt-2">
      {nome !== undefined && (
        <div className="flex min-w-0 items-center gap-3 px-2 py-1">
          {iniciais !== '' && (
            <span data-iniciais="" aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-laranja text-[15px] leading-none font-bold text-sobre-cor">
              {iniciais}
            </span>
          )}
          <p className="flex min-w-0 flex-col">
            <span className="t-apoio break-words text-tinta">{nome}</span>
            {papel !== undefined && <span className="t-apoio text-sutil">{papel}</span>}
          </p>
        </div>
      )}
      <ListaDeItens itens={itens} rotulo={NOME_DO_MENU_DA_PESSOA} trilho={false} />
      <div className="px-2 py-1">
        <Aparencia />
      </div>
      <button type="button" onClick={aoSair} disabled={saindo} className={classeDoBotaoDeLugar(false)}>
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center">
          <LogOut size={22} strokeWidth={2.5} />
        </span>
        {rotulo}
      </button>
    </div>
  )
}
