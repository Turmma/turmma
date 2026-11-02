// `consulta…` só vale em `apps/web/**`: em outro lugar, "consulta" é domínio.
export const consultaX = 1 // reprova: guardas/nome-de-mercado
export function consultaDaTurma(): void {} // reprova: guardas/nome-de-mercado
export const consultaDoLote = (): void => {} // reprova: guardas/nome-de-mercado
export type consultaDeTipo = Record<string, string>
export interface consultaDeInterface {}
export class consultaDeClasse {}
// `CHAVE_…` só vale em `apps/web/**` (chave do TanStack Query): fora dele é chave de lock, de cookie, de rótulo.
export const CHAVE_DA_TURMA = 1 // reprova: guardas/nome-de-mercado
export const CHAVE_DE_BUSCA = 'x' // reprova: guardas/nome-de-mercado
export function CHAVE_EM_FUNCAO(): void {} // reprova: guardas/nome-de-mercado
export type CHAVE_DE_TIPO = Record<string, string>
export const CHAVES_DA_TURMA = 1
export const CHAVE = 1
