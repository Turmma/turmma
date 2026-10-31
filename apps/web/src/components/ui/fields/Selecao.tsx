import { useId, type Ref } from 'react'
import { MarcaDeObrigatorio, MensagemDeErro } from './Campo'
import { CLASSES_DO_SELETOR, FACE_DO_CAMPO } from './field-styles'

export interface OpcaoDeSelecao {
  readonly valor: string
  readonly rotulo: string
  readonly desabilitada?: boolean
}

interface PropsDaSelecao {
  /** O rótulo, sempre: visível no formulário, e só para o leitor de tela na pílula (`rotuloOculto`). */
  readonly rotulo: string
  readonly opcoes: readonly OpcaoDeSelecao[]
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  /** A primeira linha, que não é uma opção: "Escolha a turma". Sem valor escolhido, é ela que aparece. */
  readonly marcador?: string
  readonly dica?: string
  readonly erro?: string | undefined
  /**
   * `campo` é a seleção de formulário, da largura da coluna. `pilula` é a da barra da caixa de pedido (a turma, no lugar
   * onde o ChatGPT põe o modelo): estreita, com o rótulo só para o leitor de tela.
   */
  readonly variante?: 'campo' | 'pilula'
  readonly rotuloOculto?: boolean
  readonly desligada?: boolean
  /** Precisa de uma opção escolhida: o rótulo diz "(obrigatório)" e o leitor de tela ouve `aria-required`. */
  readonly obrigatoria?: boolean
  readonly ref?: Ref<HTMLSelectElement>
}

/**
 * A seleção de uma opção entre poucas, sobre o **`select` do navegador** (o mesmo de `field-styles.ts`, que a Estrutura já
 * usa), e não uma lista desenhada: o `@radix-ui/react-select` medido neste build pesa perto de 30 kB em brotli, um
 * quinto do teto do primeiro carregamento (regra 50, item 1), para entregar menos do que o nativo entrega de graça — no
 * celular ele abre o seletor do próprio aparelho, no teclado tem busca por letra, e o leitor de tela o conhece desde
 * sempre (regra 50, itens 2a e 11).
 *
 * O que o nativo não dá é linha de duas alturas dentro da lista. Quem precisa disso (o catálogo de ferramentas, com
 * ícone e descrição) usa o `Menu`.
 */
export function Selecao({ rotulo, opcoes, valor, aoMudar, marcador, dica, erro, variante = 'campo', rotuloOculto = false, desligada = false, obrigatoria = false, ref }: PropsDaSelecao) {
  const campo = useId()
  const idDaDica = useId()
  const idDoErro = useId()
  const descritoPor = [dica === undefined ? undefined : idDaDica, erro === undefined ? undefined : idDoErro].filter((id) => id !== undefined).join(' ')
  const pilula = variante === 'pilula'
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${pilula ? '' : 'w-full'}`}>
      <label htmlFor={campo} className={rotuloOculto || pilula ? 'sr-only' : 't-apoio font-bold text-tinta'}>
        {rotulo}
        {obrigatoria && <MarcaDeObrigatorio />}
      </label>
      {dica !== undefined && (
        <p id={idDaDica} className="t-apoio text-apoio">
          {dica}
        </p>
      )}
      <select
        id={campo}
        ref={ref}
        value={valor}
        disabled={desligada}
        onChange={(evento) => aoMudar(evento.target.value)}
        {...(descritoPor === '' ? {} : { 'aria-describedby': descritoPor })}
        {...(erro === undefined ? {} : { 'aria-invalid': true })}
        {...(obrigatoria ? { 'aria-required': true } : {})}
        className={
          pilula
            ? `min-h-11 max-w-full min-w-0 rounded-full px-3 py-1.5 text-sm md:min-h-9 ${FACE_DO_CAMPO}`
            : `${CLASSES_DO_SELETOR} w-full`
        }
      >
        {marcador !== undefined && <option value="">{marcador}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor} disabled={opcao.desabilitada === true}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      {erro !== undefined && <MensagemDeErro id={idDoErro}>{erro}</MensagemDeErro>}
    </div>
  )
}
