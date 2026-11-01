// `EntradaDe…`, `EntradaDo…`, `SaidaDe…` e `SaidaDo…` só valem em `**/ia/tasks/**`, em interface e tipo.
export interface EntradaDoX {} // reprova: guardas/nome-de-mercado
export type EntradaDeTurma = Record<string, string> // reprova: guardas/nome-de-mercado
export interface SaidaDoX {} // reprova: guardas/nome-de-mercado
export type SaidaDeX = Record<string, string> // reprova: guardas/nome-de-mercado
export interface EntradaDeX {} // reprova: guardas/nome-de-mercado
export type SaidaDoLote = Record<string, string> // reprova: guardas/nome-de-mercado
export function EntradaDoItem(): void {}
export class SaidaDoItem {}
