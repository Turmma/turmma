import { MENSAGENS_DE_ERRO, type ChaveDeFuncao, type ErrorCode } from '@educa/shared'
import { Hourglass, PauseCircle } from 'lucide-react'
import { aparenciaDaFalha } from '../../../api/ciclo-de-execucao'
import { Button } from '../../../components/ui/Button'
import { Banner } from '../../../components/ui/Banner'
import { QueueAlert } from '../../../components/ui/ai/QueueAlert'

/**
 * O que a tela diz quando a escola suspendeu uma função do Assistente (D60): o que parou, que foi a coordenação, e o que
 * continua valendo. É a mesma frase antes de pedir (a tela já sabe, por `GET /v1/time`) e depois de o servidor recusar
 * (`FUNCAO_SUSPENSA`).
 */
export const TEXTO_DA_SUSPENSAO: Readonly<Partial<Record<ChaveDeFuncao, string>>> = {
  conversa_e_ferramentas: 'A coordenação suspendeu a conversa e as ferramentas do Assistente nesta escola. Enquanto isso ele não responde a pedidos novos; o que você já gerou continua em Criados. Fale com a coordenação para saber quando volta.',
  adaptacao: 'A coordenação suspendeu a Adaptação nesta escola. Enquanto isso o Assistente não prepara versão adaptada nova; as que você já aprovou continuam valendo. Fale com a coordenação para saber quando volta.',
}

/** A função suspensa pela escola: **aviso que explica, e não erro** — cinza, sem alarme, sem "Tentar de novo". */
export function AvisoDeSuspensao({ funcao }: { funcao: ChaveDeFuncao }) {
  return (
    <div data-funcao-suspensa={funcao}>
      <Banner icone={PauseCircle}>{TEXTO_DA_SUSPENSAO[funcao] ?? MENSAGENS_DE_ERRO.FUNCAO_SUSPENSA}</Banner>
    </div>
  )
}

/**
 * A frase sob a caixa de pedido do Assistente, no Início e na conversa: que ele é uma IA e pode errar, e a regra 70, item 3.
 * "Nada chega à turma sem você aprovar" só vale enquanto nenhuma ferramenta entregar direto à turma: se uma passar a
 * entregar, a frase deixa de ser verdade e sai daqui, nas duas telas de uma vez. Texto, sem link (o mockup o liga a
 * Configurações, que não é destas telas).
 */
export function AvisoDeIA() {
  return (
    <p className="px-2 text-center text-[13px] leading-[18px] text-sutil">
      O Assistente é uma IA e pode errar · <strong className="font-bold">Nada chega à turma sem você aprovar</strong>
    </p>
  )
}

/** O aviso de que a função de uma entrega pendente está suspensa, com o mesmo desenho do aviso de suspensão. */
export function AvisoNaEntregaDeFuncaoSuspensa({ texto }: { texto: string }) {
  return (
    <div data-entrega-de-funcao-suspensa="">
      <Banner icone={PauseCircle}>{texto}</Banner>
    </div>
  )
}

/** O que a tela diz a quem passou do limite de pedidos de IA por minuto: o que houve, e que é só esperar. */
export const TEXTO_DO_LIMITE_DE_PEDIDOS = 'Você fez muitos pedidos ao Assistente em pouco tempo. Espere cerca de um minuto e peça de novo: o seu pedido continua aqui.'

interface PropsDaFalha {
  readonly erro: ErrorCode
  /** A função que o pedido usa: é dela a frase da suspensão. */
  readonly funcao: ChaveDeFuncao
  readonly aoTentarDeNovo: () => void
}

/**
 * A falha de um pedido de IA, dentro da conversa e do cartão: **nunca o código nem o erro cru** (regra 80, item 4). O que
 * passa sozinho vira o `QueueAlert`, com "Tentar de novo"; a função suspensa e o limite de pedidos por minuto viram
 * avisos que explicam, sem alarme; e o que pede que
 * algo mude antes (o tema que não está no material, o limite de IA da escola) vem com a mensagem do catálogo.
 */
export function FalhaDoPedido({ erro, funcao, aoTentarDeNovo }: PropsDaFalha) {
  const aparencia = aparenciaDaFalha(erro)
  if (aparencia === 'fila') return <QueueAlert situacao="falha" aoTentarDeNovo={aoTentarDeNovo} />
  if (aparencia === 'suspensa') return <AvisoDeSuspensao funcao={funcao} />
  if (aparencia === 'limite')
    return (
      // Cinza e sem alarme: ninguém errou, é o limite por minuto que protege a escola inteira (regra 80, item 1).
      <div data-limite-de-pedidos="" className="flex min-w-0 flex-col items-start gap-2">
        <Banner icone={Hourglass}>{TEXTO_DO_LIMITE_DE_PEDIDOS}</Banner>
        <Button variante="secundario" onClick={aoTentarDeNovo}>
          Pedir de novo
        </Button>
      </div>
    )
  return (
    <p role="alert" data-falha-do-pedido="" className="min-w-0 rounded-controle bg-erro-cx p-3 break-words text-erro">
      {MENSAGENS_DE_ERRO[erro]}
    </p>
  )
}
