// Cada lugar em que a guarda lê o nome, com o verbo técnico em português. A marca "reprova:" fica na linha do nome.
export function lerTurma(): void {} // reprova: guardas/verbo-de-mercado
function criar(): void {} // reprova: guardas/verbo-de-mercado
export const listarAlunos = (): void => {} // reprova: guardas/verbo-de-mercado
const gerar2 = function (): void {} // reprova: guardas/verbo-de-mercado
export class TurmaRepository {
  buscarPorId(): void {} // reprova: guardas/verbo-de-mercado
  static ehAtivo(): boolean { return true } // reprova: guardas/verbo-de-mercado
  private readonly apagar = (): void => {} // reprova: guardas/verbo-de-mercado
  esperar?: () => void // reprova: guardas/verbo-de-mercado
  #lerTurma(): void {} // reprova: guardas/verbo-de-mercado
  readonly #gravar = (): void => {} // reprova: guardas/verbo-de-mercado
}
export abstract class Base {
  abstract consultarSaldo(): number // reprova: guardas/verbo-de-mercado
}
export interface Porta {
  gravar(): void // reprova: guardas/verbo-de-mercado
  temVaga: () => boolean // reprova: guardas/verbo-de-mercado
}
export const porta = {
  abrir() {}, // reprova: guardas/verbo-de-mercado
  fechar: () => {}, // reprova: guardas/verbo-de-mercado
  podeEntrar: function () { return true }, // reprova: guardas/verbo-de-mercado
}
void criar
void gerar2
