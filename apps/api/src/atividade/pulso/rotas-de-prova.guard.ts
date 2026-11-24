import { DomainException } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { Injectable, type CanActivate } from '@nestjs/common'
import { PulsoService } from './pulso.service.js'

/**
 * A guarda das **rotas de prova** (avaliacao-e-correcao, 2.0; Tech Spec §5.7 e §13): hoje `prova`, o PUT da resposta e o envio, e as que a 3.0 e a 8.0 trazem (`comecar`, `tempo` e `saidas-da-aba`) entram nela quando nascem: a instância
 * que não pulsa há mais de 30 s as recusa com 503, `INDISPONIVEL_TENTE_DE_NOVO`, antes de qualquer leitura e de qualquer gravação. Cobrar a prova de quem a API não deixou
 * responder é o que a regra 80, item 6, proíbe; o aluno tenta de novo (a fila de respostas da tela guarda o que ele marcou) e o tempo da queda volta para ele.
 *
 * **Só as rotas de prova.** A lista do aluno, o Tutor e o resto da API seguem com o pulso parado: recusá-los não devolve tempo a ninguém.
 *
 * Fica depois das guardas globais (a sessão e a permissão já estão no contexto, e o limite por usuário já contou), e `@UseGuards` no método, nunca na classe: a rota nova de
 * prova ganha a guarda por escrita explícita, e o teste de cada rota prova que ela a tem.
 */
@Injectable()
export class RotasDeProvaGuard implements CanActivate {
  constructor(private readonly pulso: PulsoService) {}

  canActivate(): boolean {
    if (!this.pulso.aceitaProva()) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    return true
  }
}
