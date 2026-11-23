import type { Perfil } from './perfis.js'

/**
 * O **prazo único da execução** de uma tarefa de IA, por perfil da tarefa, contado do `rodando` e repassado como `pedido.sinal`
 * (X6, `techspec.md` §5): cobre a espera dos tokens, as tentativas do gateway (até quatro, com a reserva) e o degrau. O `rapido` é o turno do Tutor, com
 * o aluno esperando (pior caso de 56 s); o `padrao`, a ferramenta com o professor esperando (pior caso de 136 s, 48.0). O `complexo` e
 * a `visao` não têm chamador hoje e valem o `padrao`.
 *
 * **Com o provedor de reserva (reserva-e-avaliacao, 6.0), o prazo não muda.** A execução faz no máximo quatro chamadas, duas por destino
 * (a primeira e a repetição por saída inválida, no principal e na reserva), e as quatro dividem **este** prazo: a reserva usa o que sobra
 * dele, porque leva o mesmo `pedido.sinal` do principal. A chamada que não couber (a quarta, pendurada) termina `IA_TEMPO_ESGOTADO` no
 * instante do prazo do perfil, e nada se soma a ele. Os 56 s e os 136 s acima são a conta das duas tentativas, sem reserva; com a
 * reserva, o pior caso é o próprio prazo, de 60 s e de 140 s.
 *
 * **A vaga de tokens da reserva (7.0) não soma tempo.** A reserva reserva no balde `provedor:modelo` dela **sem esperar** (o principal já esperou os 8 s, dentro deste mesmo prazo): o balde da reserva
 * cheio termina `IA_INDISPONIVEL` (`sem_vaga`) na hora, antes do prazo, e a espera pela vaga nunca vai além dos 8 s do principal.
 *
 * O job `ia.executar` tem `prazoMs` de 150 s, e o prazo de cada perfil fica **abaixo** dele, menos a folga de gravar a falha: a
 * execução termina marcada (`falhou IA_TEMPO_ESGOTADO`) antes de o executor de jobs cortar a tentativa.
 */
export const PRAZO_DA_EXECUCAO_MS: Readonly<Record<Perfil, number>> = { rapido: 60_000, padrao: 140_000, complexo: 140_000, visao: 140_000 }

/** O que sobra entre o prazo da execução e o `prazoMs` do job: o tempo de gravar `falhou` e liberar a vaga. */
export const FOLGA_DO_PRAZO_MS = 5_000
