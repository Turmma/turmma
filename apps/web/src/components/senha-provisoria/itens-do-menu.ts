import { KeyRound } from 'lucide-react'
import type { MenuItem } from '../ui/overlays/Menu'

/**
 * O menu da linha do aluno que já entra, nas duas telas que abrem o diálogo (a aba Alunos do professor e a seção "Alunos aprovados" da coordenação; acesso-e-convites, 12.0): uma ação só, a
 * senha provisória. Mora ao lado do diálogo para as duas telas não divergirem no rótulo, no ícone nem no id.
 */
export const ITENS_DA_LINHA_DA_SENHA_PROVISORIA: readonly MenuItem[] = [{ id: 'gerar-senha-provisoria', rotulo: 'Gerar senha provisória', icone: KeyRound }]
