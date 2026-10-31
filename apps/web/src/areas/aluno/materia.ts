import { BookOpen, BookOpenText, Calculator, Dna, Dumbbell, FlaskConical, Globe, Landmark, Languages, Leaf, Lightbulb, Palette, Atom, Users, type LucideIcon } from 'lucide-react'
// Só o tipo, que o compilador apaga: o `Contador` é peça fora da entrada.
import type { FamiliaDeCor } from '../../components/ui/Contador'

/** A cara de uma matéria na lista: a família do ladrilho e o ícone do `lucide` que ele leva. */
export interface CaraDaMateria {
  readonly familia: FamiliaDeCor
  readonly Icone: LucideIcon
}

/**
 * A cor de cada matéria (`docs/interface.md` 9.1): cor é categoria, nunca julgamento. O laranja nunca vai em matéria. A
 * chave é o nome sem acento e sem caixa.
 */
const MATERIAS: ReadonlyMap<string, CaraDaMateria> = new Map<string, CaraDaMateria>(Object.entries({
  matematica: { familia: 'azul', Icone: Calculator },
  portugues: { familia: 'roxo', Icone: BookOpenText },
  'lingua portuguesa': { familia: 'roxo', Icone: BookOpenText },
  redacao: { familia: 'roxo', Icone: BookOpenText },
  ciencias: { familia: 'verde', Icone: Leaf },
  biologia: { familia: 'verde', Icone: Dna },
  quimica: { familia: 'turquesa', Icone: FlaskConical },
  fisica: { familia: 'anil', Icone: Atom },
  historia: { familia: 'amarelo', Icone: Landmark },
  filosofia: { familia: 'amarelo', Icone: Lightbulb },
  geografia: { familia: 'lima', Icone: Globe },
  sociologia: { familia: 'lima', Icone: Users },
  ingles: { familia: 'vermelho', Icone: Languages },
  'lingua inglesa': { familia: 'vermelho', Icone: Languages },
  arte: { familia: 'rosa', Icone: Palette },
  artes: { familia: 'rosa', Icone: Palette },
  'educacao fisica': { familia: 'rosa', Icone: Dumbbell },
}))

/**
 * O que vale para a disciplina que não está na lista (a escola cadastra o nome que quiser): um livro aberto na família
 * `anil`. O `Ladrilho` só tem as dez famílias de cor e nenhuma é neutra, então a reserva é uma cor fixa; o ícone de livro
 * é o que a distingue das matérias conhecidas.
 */
const RESERVA: CaraDaMateria = { familia: 'anil', Icone: BookOpen }

/** O nome como chave: sem acento, sem caixa e sem espaço nas pontas ("Química", "quimica" e " QUÍMICA " são a mesma). */
function chaveDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** A família e o ícone da matéria pelo nome da disciplina; nome desconhecido cai na reserva. */
export function caraDaMateria(nome: string): CaraDaMateria {
  return MATERIAS.get(chaveDoNome(nome)) ?? RESERVA
}
