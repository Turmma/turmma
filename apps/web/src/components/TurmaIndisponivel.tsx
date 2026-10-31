import { useEffect, useRef } from 'react'

/**
 * O aviso da turma que a API não acha para quem está na tela (`NAO_ENCONTRADO`): um componente só, na página da turma e
 * nas seções dela, do professor e da coordenação (A1, 15.0 e 16.0). O texto é de quem usa: cada papel diz a quem recorrer.
 *
 * `comFoco` é de quem o desenha no lugar do que tinha o foco: quando a turma sai com a tela aberta (a releitura que deixa
 * de achá-la, ou a leitura dos pedidos), o diálogo e os botões saíram com ela, e o foco vem para o aviso, em vez de cair
 * no `body`. Na página que já abre sem a turma, e dentro de uma seção, o foco fica onde está.
 */
export function TurmaIndisponivel({ texto, comFoco = false }: { texto: string; comFoco?: boolean }) {
  const aviso = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (comFoco) aviso.current?.focus()
  }, [comFoco])
  return (
    <p ref={aviso} tabIndex={-1} role="status" className="rounded-cartao border border-linha bg-superficie p-4 text-apoio">
      {texto}
    </p>
  )
}
