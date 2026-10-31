import type { PapelDeUsuario } from '@educa/shared'

/**
 * O papel em português, como a escola fala (glossário): é o que aparece ao lado do nome da escola no seletor
 * ("Colégio Vista Alegre · professor") e na tela de início. Um lugar só, para as duas telas nunca divergirem.
 */
export const NOME_DO_PAPEL: Readonly<Record<PapelDeUsuario, string>> = { coordenador: 'coordenação', professor: 'professor', aluno: 'aluno' }
