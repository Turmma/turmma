import type { ReactNode } from 'react'
import type { QuemAssina } from './signature'
import { AssinaturaIA } from './AssinaturaIA'
import { LinhaAprovacao, type PropsDaLinhaDeAprovacao } from './LinhaAprovacao'

type PropsDaMensagemIA = QuemAssina & {
  /** O conteúdo: o `TextoDaIA`, a pergunta da D18, o cartão de ferramenta, o aviso de fila. */
  readonly children: ReactNode
  /**
   * A situação da saída diante da aprovação humana, quando ela precisa de uma (regra 70, item 3). **Tem lugar fixo**:
   * depois do conteúdo e antes das ações, em toda mensagem, e é sempre a `LinhaAprovacao`.
   */
  readonly aprovacao?: PropsDaLinhaDeAprovacao
  /**
   * As ações da resposta ("Copiar", "Abrir na biblioteca", "Exportar em PDF"), em botões `discreto`. **Sempre
   * visíveis**: nada aparece só no hover (regra 50, item 2a).
   */
  readonly acoes?: ReactNode
  /**
   * `coluna` é a mensagem da conversa: **sem bolha**, na largura da coluna, com a assinatura em cima. `balao` é a de
   * "O que o Assistente fez", e só de lá (11.4): o agente fala em balão à esquerda, com a assinatura em cima e o balão logo abaixo dela.
   */
  readonly variante?: 'coluna' | 'balao'
}

/**
 * A mensagem da IA (`docs/interface.md` 11.3 e 11.4). Nas duas variantes ela **sempre assina**: o avatar do agente, o
 * nome da função e o selo "IA". Não existe jeito de desenhar uma mensagem de IA sem assinatura com esta peça, e é de
 * propósito (regra 70, item 4a; seção 6).
 *
 * Sem coreografia de entrada: a mensagem aparece, e pronto. Na área do aluno movimento é só resposta ao que ele fez
 * (9.5, regra 7), e a peça é a mesma nas três áreas.
 */
export function MensagemIA({ children, aprovacao, acoes, variante = 'coluna', ...quem }: PropsDaMensagemIA) {
  const rodape = (
    <>
      {aprovacao !== undefined && <LinhaAprovacao {...aprovacao} />}
      {acoes !== undefined && <div className="flex min-w-0 flex-wrap items-center gap-1">{acoes}</div>}
    </>
  )
  if (variante === 'balao')
    return (
      <article className="flex min-w-0 flex-col items-start gap-1.5">
        {/* O cabeçalho do balão é a assinatura inteira: o avatar, o nome da função e o selo, num bloco só (RF10). */}
        <AssinaturaIA {...quem} />
        <div className="t-corpo max-w-full min-w-0 rounded-cartao border-2 border-borda bg-superficie px-4 py-3 break-words text-tinta sm:max-w-[85%]">{children}</div>
        {rodape}
      </article>
    )
  return (
    <article className="flex min-w-0 flex-col gap-2">
      <AssinaturaIA {...quem} />
      <div className="t-corpo min-w-0 break-words text-tinta">{children}</div>
      {rodape}
    </article>
  )
}

interface PropsDaMensagemPessoa {
  /** O texto que a pessoa escreveu, como escreveu: as quebras de linha ficam. */
  readonly children: string
}

/**
 * A mensagem de quem escreve: à direita, em bolha `fundo-suave` com a borda de 2 px, até 85% da coluna (11.3; 9.3). A
 * da IA não tem bolha: só a pessoa fala em bolha. O "Você:" é só para o leitor de tela, que não vê de que lado a bolha
 * está.
 */
export function MensagemPessoa({ children }: PropsDaMensagemPessoa) {
  return (
    <article className="flex min-w-0 justify-end">
      <p className="t-corpo max-w-[85%] min-w-0 rounded-cartao border-2 border-borda bg-fundo-suave px-4 py-2.5 break-words whitespace-pre-wrap text-tinta">
        <span className="sr-only">Você: </span>
        {children}
      </p>
    </article>
  )
}

type PropsDoPensando = QuemAssina & {
  /** A execução passou do tempo de costume: o texto muda, uma vez, para dizer que o trabalho continua. */
  readonly demorando?: boolean
}

/**
 * A mensagem da IA enquanto a execução está `pendente` ou `rodando` (`GET /v1/execucoes/:id`): a assinatura e **um
 * texto**. Sem três pontos pulando, sem brilho, sem nada em laço: no Chromebook de entrada a animação contínua custa
 * quadro, e na área do aluno nada se mexe sozinho (regra 50, item 1; 9.5, regra 7). A única mudança é o texto de quem
 * está demorando, anunciada com calma (`aria-live="polite"`).
 */
export function Pensando({ demorando = false, ...quem }: PropsDoPensando) {
  return (
    <article data-pensando="" className="flex min-w-0 flex-col gap-2">
      <AssinaturaIA {...quem} />
      <p aria-live="polite" className="t-corpo min-w-0 break-words text-sutil">
        {demorando ? 'Ainda preparando a resposta. Você não precisa pedir de novo.' : 'Preparando a resposta…'}
      </p>
    </article>
  )
}

interface PropsDaConversa {
  /** O nome da conversa para o leitor de tela: "Conversa com o Assistente de ensino". */
  readonly rotulo: string
  /** As mensagens, na ordem: `MensagemPessoa`, `MensagemIA`, `Pensando`, `AvisoFila`. */
  readonly children: ReactNode
  /**
   * A resposta está chegando (a execução está `pendente` ou `rodando`): o leitor de tela espera a conversa ficar pronta
   * para ler o que entrou, em vez de ler cada pedaço que a tela monta no meio do caminho.
   */
  readonly ocupada?: boolean
}

/**
 * A lista de mensagens de toda conversa do produto (a da Home, a de "O que o Assistente fez", a do Tutor): um registro
 * (`role="log"`) que **anuncia a mensagem que chega**, com calma, sem tirar o foco de onde a pessoa está. Quem usa leitor
 * de tela e acabou de enviar um pedido ouve a resposta sem ter de procurá-la.
 *
 * Só o que entra é anunciado (`additions`): a mensagem antiga que muda de estado não é lida de novo. E, como o registro
 * lê **cada nó que entra**, quem usa liga `ocupada` enquanto a resposta chega (`aria-busy`): a resposta é lida uma vez,
 * inteira, quando fica pronta.
 */
export function Conversa({ rotulo, children, ocupada = false }: PropsDaConversa) {
  return (
    <div role="log" aria-live="polite" aria-relevant="additions" aria-busy={ocupada} aria-label={rotulo} className="flex min-w-0 flex-col gap-6">
      {children}
    </div>
  )
}
