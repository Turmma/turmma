import { useContext, useEffect } from 'react'
import { Dialog, type DialogProps } from '../../components/ui/overlays/Dialog'
import { AvisoNoDialogo, SessionWarningContext } from './AvisoDeInatividade'

/**
 * O diálogo das telas da operação: o `Dialog` de `components/` (A1, 13.0) com o que só a operação tem, o aviso de
 * inatividade. Aberto, o diálogo deixa a casca inerte: ele se registra, a casca para de desenhar o aviso, e o aviso
 * aparece aqui dentro, onde continua alcançável (`AvisoDeInatividade.tsx`).
 */
export function DialogoDaOperacao(props: Omit<DialogProps, 'rodape'>) {
  const registrarDialogo = useContext(SessionWarningContext)?.registrarDialogo
  useEffect(() => registrarDialogo?.(), [registrarDialogo])
  return <Dialog {...props} rodape={<AvisoNoDialogo />} />
}
