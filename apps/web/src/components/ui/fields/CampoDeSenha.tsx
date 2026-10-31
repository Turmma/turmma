import { useState, type ComponentProps } from 'react'
import { Campo } from './Campo'
import { CLASSES_DO_BOTAO_SECUNDARIO } from '../button-variants'

type Props = Omit<ComponentProps<typeof Campo>, 'type' | 'acao'>

/**
 * O campo da senha nova, com "Mostrar" (A1, 17.0, W11): quem cria a senha digita uma vez só, e o erro de digitação às
 * cegas só aparece no primeiro login, quando já não há como conferir. O botão é um interruptor (`aria-pressed`), com o
 * nome fixo, e a senha à vista volta a ficar escondida quando a tela que usa o campo sai.
 *
 * Serve à página pública da turma e ao aceite do convite do professor (herdado da 14.0).
 */
export function CampoDeSenha(props: Props) {
  const [aVista, definirAVista] = useState(false)
  return (
    <Campo
      {...props}
      type={aVista ? 'text' : 'password'}
      acao={
        <button type="button" aria-label="Mostrar a senha" aria-pressed={aVista} onClick={() => definirAVista((anterior) => !anterior)} className={`${CLASSES_DO_BOTAO_SECUNDARIO} shrink-0`}>
          Mostrar
        </button>
      }
    />
  )
}
