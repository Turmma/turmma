import type { Vinculo } from '@educa/shared'
import { BookOpen } from 'lucide-react'
import { IconTile } from '../../../components/ui/IconTile'
import { familiaDaDisciplina } from './familia-da-disciplina'

/** "7ºA · Matemática", ou só a turma quando o vínculo não tem disciplina. */
export function nomeDoVinculo(vinculo: Vinculo): string {
  return vinculo.disciplina === undefined ? vinculo.turma.nome : `${vinculo.turma.nome} · ${vinculo.disciplina.nome}`
}

/** O ladrilho do vínculo: a cor é da disciplina (ou da turma, sem ela), e o desenho é o mesmo para todas. */
export function LadrilhoDoVinculo({ vinculo, tamanho }: { readonly vinculo: Vinculo; readonly tamanho: 40 | 44 }) {
  return (
    <IconTile familia={familiaDaDisciplina(vinculo.disciplina?.id ?? vinculo.turma.id)} tamanho={tamanho}>
      <BookOpen aria-hidden="true" strokeWidth={2.25} />
    </IconTile>
  )
}
