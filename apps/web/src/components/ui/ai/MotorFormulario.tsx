import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Botao } from '../Botao'
import { Campo, MarcaDeObrigatorio, MensagemDeErro } from '../fields/Campo'
import { Selecao } from '../fields/Selecao'
import type { NivelDoTitulo } from '../Tela'
import {
  campoVisivel,
  MAXIMO_DO_TEXTO,
  problemaDaDescricao,
  resumoDoPedido,
  validarFormulario,
  valoresPadrao,
  type CampoDeMultipla,
  type CampoDoMotor,
  type DescricaoDeFerramenta,
  type Pendencia,
  type ValoresDoFormulario,
  type ValoresValidados,
} from './schema-form'

/** `formulario`: preenchendo. `gerando`: o pedido saiu e a resposta não chegou. `pronto`: o resultado está na tela. */
export type EstadoDoMotor = 'formulario' | 'gerando' | 'pronto'

interface PropsDoMotor {
  /** A ferramenta, como dado. Para a Adaptação o tipo não aceita campo de texto (D35, D67). */
  readonly descricao: DescricaoDeFerramenta
  readonly estado: EstadoDoMotor
  /** Recebe os valores já validados: texto aparado, número inteiro, opções da lista. Só é chamado sem pendência. */
  readonly aoGerar: (valores: ValoresValidados) => void
  /** Com ele, aparece o "Cancelar", do mesmo tamanho do botão que gera (D59). */
  readonly aoCancelar?: () => void
  /** Com ele, o pedido recolhido ganha "Editar os campos", que volta ao formulário com o que foi preenchido. */
  readonly aoEditar?: () => void
  /** O que deu errado na geração, já em português e dizendo o que fazer. Aparece no formulário, acima dos botões. */
  readonly falha?: string
  /** O resultado, no estado `pronto`: o artefato, com a assinatura da IA e as fontes. */
  readonly children?: ReactNode
  /** O nível do título do formulário, que é o nome da ferramenta. Sem ele, 3: o formulário dentro de uma seção ou cartão. */
  readonly nivel?: NivelDoTitulo
  /** O desenho que abre o título, antes do nome (o ícone da ferramenta no cartão da conversa). Só para os olhos: o nome já está escrito ao lado. */
  readonly icone?: ReactNode
}

function CampoDeVarias({ campo, marcados, erro, aoMudar }: { campo: CampoDeMultipla; marcados: readonly string[]; erro: string | undefined; aoMudar: (marcados: readonly string[]) => void }) {
  const idDaDica = useId()
  const idDoErro = useId()
  const descritoPor = [campo.dica === undefined ? undefined : idDaDica, erro === undefined ? undefined : idDoErro].filter((id) => id !== undefined).join(' ')
  return (
    <fieldset {...(descritoPor === '' ? {} : { 'aria-describedby': descritoPor })} className="flex min-w-0 flex-col gap-2">
      <legend className="t-apoio font-bold text-tinta">
        {campo.rotulo}
        {(campo.minimo ?? 0) > 0 && <MarcaDeObrigatorio />}
      </legend>
      {campo.dica !== undefined && (
        <p id={idDaDica} className="t-apoio text-apoio">
          {campo.dica}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {campo.opcoes.map((opcao) => {
          const marcado = marcados.includes(opcao.valor)
          // O `<input>` é o nativo, à vista: quem o marca por teclado, por toque ou por leitor de tela não depende de peça nossa. A
          // caixa em volta é a da `Opcao` (borda de 2 px, degrau, 64 px), com a face azul que diz "marcada" além do visto nativo.
          // O anel é do rótulo, por `focus-within`, como o da `Opcao` (4.0): acende também no clique, e nada depende de `:has()`.
          return (
            <label
              key={opcao.valor}
              className={`degrau flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-controle border-2 px-3 py-2 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-foco ${
                marcado ? 'border-azul-borda bg-azul-claro text-azul-texto degrau-azul' : 'border-borda bg-fundo text-tinta hover:bg-fundo-suave degrau-borda'
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={(evento) => aoMudar(evento.target.checked ? [...marcados, opcao.valor] : marcados.filter((valor) => valor !== opcao.valor))}
                className="size-6 shrink-0 accent-azul"
              />
              <span className="t-cartao min-w-0 break-words">{opcao.rotulo}</span>
            </label>
          )
        })}
      </div>
      {erro !== undefined && <MensagemDeErro id={idDoErro}>{erro}</MensagemDeErro>}
    </fieldset>
  )
}

/**
 * O formulário de toda ferramenta: **a ferramenta é dado, e o motor é um só** (P23; `docs/interface.md` 1.2 e 11.3). É o
 * mesmo na tela de Ferramentas e no cartão dentro da conversa (D18): mesmos campos, mesmo contrato. A regra — valor
 * inicial, o que falta, o que sai — está em `schema-form.ts`, com teste.
 *
 * Um campo pode ser **condicional** (`quando`): aparece, é cobrado e sai no pedido só com uma opção marcada em outro
 * campo, de múltipla escolha. O tempo extra da Adaptação aparece com "Tempo adicional" marcado, e some sem ele.
 *
 * Quatro tipos de campo, e nenhum outro: texto curto, número, seleção e múltipla escolha de lista fechada. **Não existe
 * campo de texto longo, nem campo "sobre o aluno"**, e a Adaptação não tem campo de texto nenhum: ela recebe o tipo de
 * adaptação, nunca o diagnóstico (D35, D67).
 *
 * Os três estados:
 * - `formulario`: os campos e o botão `primario` com o verbo da ferramenta. Gerar com algo faltando não sai: cada campo
 *   diz o que falta, um resumo é anunciado, e o foco vai ao primeiro campo pendente (regra 50, item 11).
 * - `gerando`: o pedido recolhido numa linha e o aviso de que está gerando, em texto. Sem brilho nem barra correndo.
 * - `pronto`: o pedido recolhido, "Editar os campos" e o resultado.
 *
 * O estado é de quem usa, porque é ele que sabe quando a geração terminou (`GET /v1/execucoes/:id`).
 */
export function MotorFormulario({ descricao, estado, aoGerar, aoCancelar, aoEditar, falha, children, nivel = 3, icone }: PropsDoMotor) {
  const Titulo = `h${nivel}` as const
  const campos: readonly CampoDoMotor[] = descricao.campos
  const [valores, definirValores] = useState<ValoresDoFormulario>(() => valoresPadrao(campos))
  const [pendencias, definirPendencias] = useState<readonly Pendencia[]>([])
  const [pedido, definirPedido] = useState<ValoresValidados | undefined>(undefined)
  const formulario = useRef<HTMLFormElement>(null)
  const recolhido = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const estadoAnterior = useRef(estado)
  const idDoTitulo = useId()

  // Quando o formulário dá lugar ao pedido recolhido, o botão que tinha o foco some: o foco vai para a linha do pedido,
  // e não para o `body`. E na volta ("Editar os campos", que some com o pedido recolhido), para o título do formulário.
  // Só na troca de estado: a tela que já abre pronta, ou no formulário, não puxa o foco de ninguém.
  useEffect(() => {
    const eraFormulario = estadoAnterior.current === 'formulario'
    if (eraFormulario && estado !== 'formulario') recolhido.current?.focus()
    if (!eraFormulario && estado === 'formulario') titulo.current?.focus()
    estadoAnterior.current = estado
  }, [estado])

  const problema = problemaDaDescricao({ ferramenta: descricao.ferramenta, campos })
  if (problema !== undefined)
    return (
      <p role="alert" className="rounded-cartao border-2 border-vermelho-borda bg-erro-cx p-4 text-erro">
        Esta ferramenta não pôde ser aberta. Avise a equipe Turmma.
      </p>
    )

  function mudar(chave: string, valor: string | readonly string[]): void {
    definirValores((atuais) => ({ ...atuais, [chave]: valor }))
    // A pendência daquele campo some quando a pessoa mexe nele; as outras ficam até a próxima tentativa.
    definirPendencias((atuais) => atuais.filter((pendencia) => pendencia.chave !== chave))
  }

  function aoSubmeter(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const resultado = validarFormulario(campos, valores)
    if (!resultado.ok) {
      definirPendencias(resultado.pendencias)
      const primeira = resultado.pendencias[0]?.chave
      const campoPendente = Array.from(formulario.current?.querySelectorAll<HTMLElement>('[data-campo]') ?? []).find((elemento) => elemento.dataset['campo'] === primeira)
      campoPendente?.querySelector<HTMLElement>('input, select')?.focus()
      return
    }
    definirPendencias([])
    definirPedido(resultado.valores)
    aoGerar(resultado.valores)
  }

  const erroDe = (chave: string) => pendencias.find((pendencia) => pendencia.chave === chave)?.mensagem

  if (estado !== 'formulario')
    return (
      <section aria-labelledby={idDoTitulo} data-motor={estado} className="flex min-w-0 flex-col gap-4">
        <div ref={recolhido} tabIndex={-1} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-cartao border-2 border-borda bg-superficie px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {icone}
            <p className="min-w-0 break-words text-apoio">
              <span id={idDoTitulo} className="font-bold text-tinta">
                {descricao.nome}
              </span>
              {pedido !== undefined && resumoDoPedido(campos, pedido) !== '' && <> · {resumoDoPedido(campos, pedido)}</>}
            </p>
          </div>
          {estado === 'pronto' && aoEditar !== undefined && (
            <Botao variante="discreto" tamanho="compacto" onClick={aoEditar}>
              Editar os campos
            </Botao>
          )}
        </div>
        {estado === 'gerando' ? (
          <p role="status" className="rounded-cartao border-2 border-borda bg-superficie p-4 text-apoio">
            Gerando… Isso leva alguns instantes.
          </p>
        ) : (
          children
        )}
      </section>
    )

  return (
    <form ref={formulario} noValidate onSubmit={aoSubmeter} aria-labelledby={idDoTitulo} data-motor="formulario" className="flex min-w-0 flex-col gap-4">
      <Titulo ref={titulo} tabIndex={-1} id={idDoTitulo} className="t-cartao flex min-w-0 items-center gap-3 text-tinta">
        {icone}
        {descricao.nome}
      </Titulo>
      {campos.map((campo) => {
        // O campo condicional só existe na tela com a opção dele marcada (`campoVisivel`).
        if (!campoVisivel(campo, valores)) return null
        const valor = valores[campo.chave]
        const texto = typeof valor === 'string' ? valor : ''
        return (
          <div key={campo.chave} data-campo={campo.chave} className="min-w-0">
            {campo.tipo === 'texto' && (
              <Campo
                rotulo={campo.rotulo}
                {...(campo.dica === undefined ? {} : { dica: campo.dica })}
                erro={erroDe(campo.chave)}
                value={texto}
                onChange={(evento) => mudar(campo.chave, evento.target.value)}
                {...(campo.exemplo === undefined ? {} : { placeholder: campo.exemplo })}
                maxLength={campo.maximo ?? MAXIMO_DO_TEXTO}
                obrigatorio={campo.obrigatorio === true}
                autoComplete="off"
              />
            )}
            {campo.tipo === 'numero' && (
              <Campo
                rotulo={campo.rotulo}
                dica={campo.dica ?? `De ${String(campo.minimo)} a ${String(campo.maximo)}.`}
                erro={erroDe(campo.chave)}
                value={texto}
                onChange={(evento) => mudar(campo.chave, evento.target.value)}
                inputMode="numeric"
                obrigatorio={campo.obrigatorio === true}
                autoComplete="off"
              />
            )}
            {campo.tipo === 'selecao' && (
              <Selecao
                rotulo={campo.rotulo}
                {...(campo.dica === undefined ? {} : { dica: campo.dica })}
                erro={erroDe(campo.chave)}
                opcoes={campo.opcoes}
                valor={texto}
                aoMudar={(escolhido) => mudar(campo.chave, escolhido)}
                marcador="Escolha…"
                obrigatoria={campo.obrigatorio === true}
              />
            )}
            {campo.tipo === 'multipla' && <CampoDeVarias campo={campo} marcados={Array.isArray(valor) ? valor : []} erro={erroDe(campo.chave)} aoMudar={(marcados) => mudar(campo.chave, marcados)} />}
          </div>
        )
      })}
      <p role="alert" className="rounded-controle border-2 border-vermelho-borda bg-erro-cx p-3 break-words text-erro empty:hidden">
        {pendencias.length > 0 ? `Para gerar, confira: ${pendencias.map((pendencia) => pendencia.rotulo).join(', ')}.` : falha}
      </p>
      <div className="flex flex-wrap gap-3">
        <Botao type="submit">{descricao.verbo}</Botao>
        {aoCancelar !== undefined && (
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
        )}
      </div>
    </form>
  )
}
