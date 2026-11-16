import type { Perfil } from './perfis.js'

/**
 * O **prazo único da execução** de uma tarefa de IA, por perfil da tarefa, contado do `rodando` e repassado como `pedido.sinal`
 * (X6, `techspec.md` §5): cobre a espera dos tokens, as duas tentativas do gateway e o degrau. O `rapido` é o turno do Tutor, com
 * o aluno esperando (pior caso de 56 s); o `padrao`, a ferramenta com o professor esperando (pior caso de 136 s, 48.0). O `complexo` e
 * a `visao` não têm chamador hoje e valem o `padrao`.
 *
 * O job `ia.executar` tem `prazoMs` de 150 s, e o prazo de cada perfil fica **abaixo** dele, menos a folga de gravar a falha: a
 * execução termina marcada (`falhou IA_TEMPO_ESGOTADO`) antes de o executor de jobs cortar a tentativa.
 */
export const PRAZO_DA_EXECUCAO_MS: Readonly<Record<Perfil, number>> = { rapido: 60_000, padrao: 140_000, complexo: 140_000, visao: 140_000 }

/** O que sobra entre o prazo da execução e o `prazoMs` do job: o tempo de gravar `falhou` e liberar a vaga. */
export const FOLGA_DO_PRAZO_MS = 5_000
