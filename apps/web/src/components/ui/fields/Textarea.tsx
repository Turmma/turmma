import { useId, type Ref } from 'react'
import { RequiredMark, FieldError } from './FormField'
import { FIELD_BOX } from './field-styles'
import { limitarTexto, textoDoContador, type TextLimits } from './text-limits'

interface TextareaProps extends TextLimits {
  /** O rótulo visível, sempre. */
  readonly rotulo: string
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  readonly dica?: string
  /** O que está errado e como corrigir (`problemaDoTexto`, ou o que a API devolveu), mostrado por quem usa quando couber. */
  readonly erro?: string | undefined
  readonly obrigatorio?: boolean
  /** Quantas linhas o campo mostra de início. Sem ele, 3. */
  readonly linhas?: number
  readonly desligado?: boolean
  readonly ref?: Ref<HTMLTextAreaElement>
}

/**
 * O campo de várias linhas, com rótulo, dica, contador e erro: a justificativa de quem rejeita uma entrega (de 8 a 500
 * caracteres) e de quem contesta. É o `FormField` do produto com `textarea`: a mesma caixa (`FIELD_BOX`), com no mínimo
 * 96 px de altura.
 *
 * - **O contador é texto** ("12 de 500"), ligado ao campo por `aria-describedby`: o leitor de tela o ouve ao chegar no
 *   campo, e não a cada tecla. Não muda de cor perto do limite: o campo simplesmente não aceita mais. **A conta é uma
 *   só**, a da API, sem o espaço das pontas (`fields/text-limits.ts`): o limite do campo é o do contador, e não o `maxLength`
 *   do navegador, que contaria o texto cru.
 * - **Só cresce para baixo** (`resize-y`): arrastado para o lado, o campo estouraria a largura da tela.
 * - **O erro diz o que fazer**, embaixo e com o ícone (`FieldError`), e o campo fica `aria-invalid`.
 *
 * **Não é campo de ferramenta.** O `SchemaForm` não tem texto longo, e a Adaptação não tem texto nenhum: texto
 * livre sobre aluno é onde o diagnóstico entraria no sistema (D35, D67).
 */
export function Textarea({ rotulo, valor, aoMudar, dica, erro, obrigatorio = false, linhas = 3, desligado = false, minimo, maximo, ref }: TextareaProps) {
  const campo = useId()
  const idDaDica = useId()
  const idDoContador = useId()
  const idDoErro = useId()
  const descritoPor = [dica === undefined ? undefined : idDaDica, erro === undefined ? undefined : idDoErro, idDoContador].filter((id) => id !== undefined).join(' ')
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={campo} className="t-apoio font-bold text-tinta">
        {rotulo}
        {obrigatorio && <RequiredMark />}
      </label>
      {dica !== undefined && (
        <p id={idDaDica} className="t-apoio text-apoio">
          {dica}
        </p>
      )}
      <textarea
        id={campo}
        ref={ref}
        rows={linhas}
        value={valor}
        disabled={desligado}
        onChange={(evento) => aoMudar(limitarTexto(evento.target.value, maximo))}
        aria-describedby={descritoPor}
        {...(erro === undefined ? {} : { 'aria-invalid': true })}
        {...(obrigatorio ? { 'aria-required': true } : {})}
        className={`min-h-24 w-full min-w-0 resize-y px-3.5 py-2 t-corpo ${FIELD_BOX}`}
      />
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
        {erro !== undefined && <FieldError id={idDoErro}>{erro}</FieldError>}
        <p id={idDoContador} className="ml-auto shrink-0 text-sm text-sutil tabular-nums">
          {textoDoContador(valor, minimo === undefined ? { maximo } : { minimo, maximo })}
          <span className="sr-only"> caracteres</span>
        </p>
      </div>
    </div>
  )
}
