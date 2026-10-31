import { CircleAlert } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { CAIXA_DO_CAMPO } from './field-styles'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'aria-describedby'> {
  /** O rótulo visível, sempre: rótulo só no `placeholder` some quando a pessoa começa a digitar (regra 50, item 11). */
  rotulo: string
  /** O que ajuda a preencher, ligado ao campo por `aria-describedby`: "pelo menos 12 caracteres". */
  dica?: string
  /**
   * O que está errado neste campo e como corrigir, embaixo dele: o campo fica `aria-invalid` e o texto entra no
   * `aria-describedby`, depois da dica, para o leitor de tela ler os dois ao chegar no campo.
   */
  erro?: string | undefined
  /**
   * Ids de outros textos da tela que também descrevem o campo, depois da dica e do erro: o aviso do envio, numa região
   * `role="alert"` ou `role="status"` fora do campo, que o leitor de tela lê de novo ao voltar a ele (17.0, W8).
   */
  descritoTambemPor?: string | undefined
  /**
   * O campo precisa ser preenchido: o rótulo diz "(obrigatório)", em texto, e o leitor de tela ouve `aria-required`. Não
   * é o `required` do navegador, que barraria o envio com a mensagem dele, em outro tom e às vezes em outra língua.
   */
  obrigatorio?: boolean
  /** Um botão ao lado do campo, na mesma linha: o "Mostrar" da senha (`CampoDeSenha`). */
  acao?: ReactNode
  /** O campo em si, para quem precisa pôr o foco nele (o erro que volta do servidor, por exemplo). */
  ref?: Ref<HTMLInputElement>
}

/** O campo de uma linha: 48 px de altura, que passa do alvo de toque do celular (regra 50, itens 2a e 11), e a caixa da D80. */
const CLASSES_DO_CAMPO = `min-h-12 px-3.5 py-2 t-corpo ${CAIXA_DO_CAMPO}`

/**
 * O que está errado num campo, embaixo dele, com o ícone ao lado do texto: o erro nunca é só a cor da borda (regra 50,
 * item 11). É o texto que o `aria-describedby` do campo aponta pelo `id`, e o ícone é decoração (`aria-hidden`), para o
 * leitor de tela ouvir só a frase. Não é `role="alert"`: o campo já o lê ao receber o foco, e o aviso do envio fica numa
 * região própria fora dele (`descritoTambemPor`), que o leitor anuncia uma vez só.
 *
 * Serve ao `Campo`, ao `CampoLongo` e à `Selecao`: o erro tem o mesmo desenho nos três.
 */
export function MensagemDeErro({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <p id={id} className="t-apoio flex min-w-0 items-start gap-1.5 font-bold break-words text-vermelho-texto">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/**
 * A marca de campo obrigatório, ao lado do rótulo: texto, e não asterisco, que ninguém explica (regra 50, item 11). É para
 * quem vê: o leitor de tela já ouve "obrigatório" pelo `aria-required` do campo, e com a marca no nome ouviria duas vezes.
 */
export function MarcaDeObrigatorio() {
  return (
    <span aria-hidden="true" className="text-sm font-normal text-sutil">
      {' '}
      (obrigatório)
    </span>
  )
}

/**
 * Campo de formulário com rótulo visível, dica descrita para o leitor de tela e erro com ícone. O `inputmode` e o
 * `autocomplete` ficam a cargo de quem usa, porque mudam por campo: a matrícula da entrada é numérica e a da página da
 * turma é texto (W11), senha é `current-password`, código do aplicativo é `one-time-code`.
 */
export function Campo({ rotulo, dica, erro, descritoTambemPor, obrigatorio = false, acao, ...props }: Props) {
  const campo = useId()
  const descricao = useId()
  const idDoErro = useId()
  const descritoPor = [dica === undefined ? undefined : descricao, erro === undefined ? undefined : idDoErro, descritoTambemPor === '' ? undefined : descritoTambemPor]
    .filter((valor) => valor !== undefined)
    .join(' ')
  const entrada = (
    <input
      id={campo}
      {...(descritoPor === '' ? {} : { 'aria-describedby': descritoPor })}
      {...(erro === undefined ? {} : { 'aria-invalid': true })}
      {...(obrigatorio ? { 'aria-required': true } : {})}
      {...props}
      className={acao === undefined ? CLASSES_DO_CAMPO : `${CLASSES_DO_CAMPO} min-w-0 flex-1`}
    />
  )
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campo} className="t-apoio font-bold text-tinta">
        {rotulo}
        {obrigatorio && <MarcaDeObrigatorio />}
      </label>
      {dica !== undefined && (
        <p id={descricao} className="t-apoio text-apoio">
          {dica}
        </p>
      )}
      {acao === undefined ? (
        entrada
      ) : (
        <div className="flex items-stretch gap-2">
          {entrada}
          {acao}
        </div>
      )}
      {erro !== undefined && <MensagemDeErro id={idDoErro}>{erro}</MensagemDeErro>}
    </div>
  )
}
