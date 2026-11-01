// Cada forma da gramática de `guarda.md`, no tipo de declaração em que a linha vale, e cada jeito de escrever a mesma
// declaração de topo. A marca "reprova:" fica na linha da declaração. Os nomes que também aparecem em `nome-que-passa.ts`
// (`ErroDaOperacao`, `FalhaDeMaterial`, `LinhaDaTarefa`, `FiltroDeEstado`) passam lá, em outro tipo de declaração.
export class AdaptadorX {} // reprova: guardas/nome-de-mercado
export class GuardaX {} // reprova: guardas/nome-de-mercado
export class FiltroX {} // reprova: guardas/nome-de-mercado
export class InterceptorX {} // reprova: guardas/nome-de-mercado
export class ErroX {} // reprova: guardas/nome-de-mercado
export class FalhaX {} // reprova: guardas/nome-de-mercado
export class EmissorX {} // reprova: guardas/nome-de-mercado
export class ArmazemX {} // reprova: guardas/nome-de-mercado
export class MedicaoX {} // reprova: guardas/nome-de-mercado
export class BancadaX {} // reprova: guardas/nome-de-mercado
export class ErroDaOperacao {} // reprova: guardas/nome-de-mercado
export class FalhaDeMaterial {} // reprova: guardas/nome-de-mercado
export class FiltroDeEstado {} // reprova: guardas/nome-de-mercado

export class XEmMemoria {} // reprova: guardas/nome-de-mercado
export interface RepositorioEmMemoria {} // reprova: guardas/nome-de-mercado
export type CacheEmMemoria = Record<string, string> // reprova: guardas/nome-de-mercado

export interface LinhaX {} // reprova: guardas/nome-de-mercado
export interface LinhaDaTarefa {} // reprova: guardas/nome-de-mercado
export type OpcoesX = Record<string, string> // reprova: guardas/nome-de-mercado
export interface DependenciasX {} // reprova: guardas/nome-de-mercado
export type ConfiguracaoX = Record<string, string> // reprova: guardas/nome-de-mercado

export const esquemaX = 1 // reprova: guardas/nome-de-mercado
export function esquemaDoLote(): void {} // reprova: guardas/nome-de-mercado
export function lerConfiguracaoX(): void {} // reprova: guardas/nome-de-mercado
export function lerConfiguracao(): void {} // reprova: guardas/nome-de-mercado
export const lerConfiguracaoDoAmbiente = (): void => {} // reprova: guardas/nome-de-mercado

export class Botao {} // reprova: guardas/nome-de-mercado
export interface Cartao {} // reprova: guardas/nome-de-mercado
export type Dialogo = Record<string, string> // reprova: guardas/nome-de-mercado
export const Abas = 1 // reprova: guardas/nome-de-mercado
export function Tabela(): void {} // reprova: guardas/nome-de-mercado
export enum Tela { A } // reprova: guardas/nome-de-mercado

// O mesmo nome, escrito de outros jeitos: sem `export`, `default`, `abstract`, declarada e exportada depois.
class AdaptadorSemExport {} // reprova: guardas/nome-de-mercado
export abstract class AdaptadorAbstrato {} // reprova: guardas/nome-de-mercado
abstract class GuardaAbstrata {} // reprova: guardas/nome-de-mercado
export default class AdaptadorPadrao {} // reprova: guardas/nome-de-mercado
const esquemaSemExport = 1 // reprova: guardas/nome-de-mercado
export const primeiro = 1, esquemaNoSegundo = 2 // reprova: guardas/nome-de-mercado
declare class FiltroDeclarado {} // reprova: guardas/nome-de-mercado
export { AdaptadorSemExport, GuardaAbstrata, esquemaSemExport }
