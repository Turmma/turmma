import { useContext, useEffect } from 'react'
import { Dialogo, type PropsDoDialogo } from '../../components/ui/overlays/Dialogo'
import { AvisoNoDialogo, ContextoDoAviso } from './AvisoDeInatividade'

/**
 * O diálogo das telas da operação: o `Dialogo` de `components/` (A1, 13.0) com o que só a operação tem, o aviso de
 * inatividade. Aberto, o diálogo deixa a casca inerte: ele se registra, a casca para de desenhar o aviso, e o aviso
 * aparece aqui dentro, onde continua alcançável (`AvisoDeInatividade.tsx`).
 */
export function DialogoDaOperacao(props: Omit<PropsDoDialogo, 'rodape'>) {
  const registrarDialogo = useContext(ContextoDoAviso)?.registrarDialogo
  useEffect(() => registrarDialogo?.(), [registrarDialogo])
  return <Dialogo {...props} rodape={<AvisoNoDialogo />} />
}
