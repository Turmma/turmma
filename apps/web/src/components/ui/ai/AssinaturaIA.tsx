import { agenteDe, nomeDaAssinatura, type QuemAssina } from './signature'
import { AvatarAgente, type TamanhoDoAvatar } from './AvatarAgente'

/** Os tamanhos de avatar que a assinatura aceita. Quem a usa importa o tipo daqui: o avatar só é importado por ela. */
export type { TamanhoDoAvatar }

/**
 * O selo "IA", em família `ia` (`docs/interface.md` 9.1 e 10.2): cinza, neutro de propósito, no mesmo desenho do selo de
 * estado (24 px de altura, canto de 8, `t-selo`). O selo informa, não chama.
 * **É um só, igual em todo o produto**: toda saída de IA é rotulada como tal (seção 6; Decreto 12.880, art. 11), e quem
 * aprendeu a reconhecê-lo numa tela o reconhece em todas. Não aceita cor, tamanho nem texto de quem usa.
 */
export function SeloIA() {
  return (
    <span data-selo-ia="" className="t-selo inline-flex min-h-6 shrink-0 items-center rounded-selo bg-ia-cx px-2 text-ia">
      {/* O que a sigla quer dizer vai em texto para o leitor de tela, e não num `title`, que só existe no hover. */}
      <span aria-hidden="true">IA</span>
      <span className="sr-only">gerado por inteligência artificial</span>
    </span>
  )
}

type PropsDaAssinatura = QuemAssina & {
  /** 24 px na linha da mensagem (o padrão), 32, 40 ou 48 px no cabeçalho de uma conversa ou de um cartão de agente. */
  readonly tamanho?: TamanhoDoAvatar
  /**
   * O nome da função é o título de uma seção da tela, no nível dado (`h2` ou `h3`), e não um parágrafo: o cartão de cada
   * agente da coordenação. Sem ele, o nome é texto (`p`), como na linha de uma mensagem.
   */
  readonly titulo?: 2 | 3
}

/** O nome corre em linha com o selo (`inline`): quando ele quebra, o selo vai junto, no fim da última linha do nome. */
const CLASSES_DO_NOME = 'inline text-[15px] leading-5 font-bold break-words text-tinta'

/**
 * A assinatura que abre toda saída de IA: o avatar do agente, o **nome da função** e o selo "IA" — "a IA sempre assina"
 * (8.4, princípio 3). Nunca um texto de IA solto na tela, e nunca o avatar sozinho.
 *
 * **O bloco é o `data-assinatura`**: é nele que o teste confere que cada avatar tem o nome em texto visível e um selo ao
 * lado, e é o único lugar do produto, com o balão da `MensagemIA` (que o usa), em que o avatar da onça é desenhado.
 *
 * Quem assina é um agente (`agente`) ou uma função dele (`funcao`): com a função, o nome sai "Assistente · correção de
 * objetiva" e o avatar é o do agente que a declara (`@educa/shared`).
 */
export function AssinaturaIA({ tamanho = 24, titulo, ...quem }: PropsDaAssinatura) {
  const nome = nomeDaAssinatura(quem)
  return (
    <div data-assinatura="" className="flex min-w-0 items-center gap-2">
      <AvatarAgente agente={agenteDe(quem)} tamanho={tamanho} />
      {/* O nome e o selo são um bloco só, em linha: o nome quebra em 360 px e o selo fica colado ao fim dele. */}
      <div className="min-w-0">
        {titulo === 2 ? <h2 className={CLASSES_DO_NOME}>{nome}</h2> : titulo === 3 ? <h3 className={CLASSES_DO_NOME}>{nome}</h3> : <p className={CLASSES_DO_NOME}>{nome}</p>}{' '}
        <span className="ml-1 inline-block align-middle">
          <SeloIA />
        </span>
      </div>
    </div>
  )
}
