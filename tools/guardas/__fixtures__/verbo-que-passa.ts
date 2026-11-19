// O que a guarda deixa passar de propósito: o verbo de mercado, o verbo de domínio, a palavra que só começa igual, o nome
// que não é função, a função anônima, o computado e o entre aspas, e o atalho de objeto (o nome é o da variável). Nenhuma marca.
export function findByTurma(): void {}
export function aprovarLote(): void {}
export function lancarNota(): void {}
export function corrigirObjetiva(): void {}
export function listagemDaTurma(): void {}
export function temporada(): void {}
export function eholder(): void {}
export const lerTurmaLimite = 3
export const tem = true
export interface Linha {
  podeEntrar: boolean
  listar: string[]
}
declare const lerChave: 'ler'
declare const read: () => void
export const porta = {
  [lerChave]: () => {},
  'ler-tudo': () => {},
  read,
  contagem: 1,
}
export class Turma {
  matricular(): void {}
  readonly salvarAte = 10
  readonly #lerLimite = 3
  #readTurma(): void {}
}
export default function () {}
