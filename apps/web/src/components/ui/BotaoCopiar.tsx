import { useState } from 'react'
import { Botao } from './Botao'

interface Props {
  /** O que vai para a área de transferência. Fica só no estado de quem chama, nunca em armazenamento do navegador. */
  texto: string
  rotulo: string
  /** O aviso de que deu certo, em frase inteira: "Segredo copiado." */
  avisoDeCopiado: string
}

/**
 * Copia um texto para a área de transferência, com aviso do que aconteceu. É o caminho do segundo fator sem celular
 * (regra 50, item 2): o segredo e os códigos de recuperação vão daqui para o gerenciador de senhas do computador.
 *
 * Quando o navegador recusa a cópia (permissão negada, aba sem foco), a tela diz o que fazer em vez de fingir que
 * copiou: o texto está visível e selecionável ao lado.
 */
export function BotaoCopiar({ texto, rotulo, avisoDeCopiado }: Props) {
  const [situacao, definirSituacao] = useState<'parado' | 'copiado' | 'falhou'>('parado')

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto)
      definirSituacao('copiado')
    } catch {
      definirSituacao('falhou')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Botao onClick={() => void copiar()}>{rotulo}</Botao>
      <span role="status" className="text-apoio">
        {situacao === 'copiado' ? avisoDeCopiado : ''}
        {situacao === 'falhou' ? 'Não foi possível copiar. Selecione o texto ao lado e copie pelo seu computador.' : ''}
      </span>
    </div>
  )
}
