interface Props {
  /** Se está ligado agora. A peça é controlada: ela não guarda estado, e quem usa decide o que `aoMudar` faz. */
  readonly ligado: boolean
  /** Chamado com o valor novo (o contrário de `ligado`), na hora do clique, do toque, do Espaço ou do Enter. */
  readonly aoMudar: (ligado: boolean) => void
  /** O que o interruptor liga ou desliga, em texto: é o nome dele para o leitor de tela. */
  readonly rotulo: string
  /** Fora de uso: não troca, e quem navega pelo teclado não para nele. Não é o "desligado" do trilho, que é `ligado={false}`. */
  readonly desligado?: boolean
}

/**
 * O interruptor da D80 (`docs/interface.md` 10.2): um `<button role="switch" aria-checked>`, em que Espaço e Enter trocam
 * como num botão, e **muda na hora**, sem pedir confirmação. Serve a configuração que vale ao ser trocada; o que precisa
 * de um "salvar" é formulário, e não interruptor.
 *
 * O trilho tem 52 × 32 px: desligado, a face `borda` com a borda `borda-campo` (3:1 contra o chão, porque é a única pista
 * de que ali há um controle); ligado, `azul` com a borda `azul-degrau`. **Os dois estados diferem pela posição da
 * bolinha**, e não só pela cor: à esquerda desligado, à direita ligado. Abaixo de 768 px a área de toque sobe a 44 px de
 * altura (regra 50, item 2a) sem engordar o desenho; o anel de foco a acompanha. **Fora de uso** o trilho vai para
 * `fundo-suave` com borda `borda` e a bolinha em `borda-campo`, sem opacidade: o mesmo jeito das outras peças desligadas.
 */
export function Switch({ ligado, aoMudar, rotulo, desligado = false }: Props) {
  const trilho = desligado
    ? `${ligado ? 'justify-end' : 'justify-start'} border-borda bg-fundo-suave`
    : ligado
      ? 'justify-end border-azul-degrau bg-azul'
      : 'justify-start border-borda-campo bg-borda'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desligado}
      onClick={() => aoMudar(!ligado)}
      className="inline-flex h-11 w-13 shrink-0 cursor-pointer items-center rounded-full disabled:cursor-not-allowed md:h-8"
    >
      <span aria-hidden="true" className={`flex h-8 w-13 items-center rounded-full border-2 px-0.5 ${trilho}`}>
        <span className={`size-6 rounded-full ${desligado ? 'bg-borda-campo' : 'bg-fundo'}`} />
      </span>
    </button>
  )
}
