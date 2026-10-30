import { OPERACAO_ENTRY_KEY, OPERACAO_ROUTE_KEY } from '@educa/nucleo'
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { GuardaDeOperador } from './guarda-de-operador.js'

/**
 * A rota da área da operação com sessão de operador (Tech Spec da A0, seção 1). Marca a rota, para as guardas da escola
 * a tratarem como sem sessão de escola e o limite contar `rl:op:{sub}`, e aplica a `GuardaDeOperador` no mesmo
 * decorador: não existe rota de operação marcada sem a guarda (C41). Só se usa em `apps/api/src/operacao/` (C40), em
 * rota sob `/v1/operacao` (C42).
 */
export function RotaDeOperacao(): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(OPERACAO_ROUTE_KEY, true), UseGuards(GuardaDeOperador))
}

/**
 * A rota que leva à sessão de operador — convite, entrada, segundo fator, renovar e sair —, numa lista fechada de sete
 * (Tech Spec da A0, seção 4; C43, tarefa 8.0). Sem sessão: o service confere o convite, a senha ou o desafio que recebe.
 * Só se usa em `apps/api/src/operacao/` (C40), em rota sob `/v1/operacao` (C42).
 */
export function EntradaDeOperacao(): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(OPERACAO_ENTRY_KEY, true))
}
