import { ANOS_DA_ETAPA, type Etapa } from '../estrutura/serie.js'

/**
 * Como a planilha escreve a turma e a disciplina, e a chave que faz "8ºA", "8º A", "8A", "8a" e "8º ano A" serem a mesma
 * turma (F2, Tech Spec, seção 5, "Planilha"; PRD, RF3). Um lugar só: a prévia, o job e a coluna `turma.chave` do banco
 * calculam por aqui (a migration `0040_f2_planilhas` repete a conta em SQL para as turmas que já existem).
 */

/** Um dígito, o ordinal (`º`, `o`, `°`, `ª`) e a palavra "ano" opcionais, e uma letra: tudo o que sobra depois de tirar acento e caixa. */
const FORMATO_DA_TURMA = /^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$/

/** Sem acento, sem caixa e com os espaços de dentro reduzidos a um: a forma em que dois textos "iguais" ficam iguais. */
function semAcentoNemCaixa(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * A chave da turma: o dígito da série e a letra, em minúsculas, sem acento ("8º ano A" → `8a`). Nome fora do padrão ("Turma
 * Azul", "10A") não tem chave: `null`. A chave é só do nome; se dá para tirar a série dela é outra pergunta
 * (`serieDaChave`).
 */
export function chaveDaTurma(nome: string): string | null {
  const achado = FORMATO_DA_TURMA.exec(semAcentoNemCaixa(nome))
  if (achado === null) return null
  return `${achado[1] ?? ''}${achado[3] ?? ''}`
}

/**
 * A série que a chave diz: 6º a 9º ano do Ensino Fundamental, 1º a 3º do Médio (D43). Dígito fora disso ("4A", "0B") não
 * tem série, e a turma que não existe e não tem série é erro na planilha, nunca "turma nova" (RF3).
 */
export function serieDaChave(chave: string): { readonly etapa: Etapa; readonly ano: number } | null {
  const ano = Number(chave.charAt(0))
  for (const etapa of Object.keys(ANOS_DA_ETAPA) as Etapa[]) {
    const { menor, maior } = ANOS_DA_ETAPA[etapa]
    if (ano >= menor && ano <= maior) return { etapa, ano }
  }
  return null
}

/** A disciplina sem acento nem caixa e sem espaço a mais: "Química" e "  QUIMICA " são a mesma. */
export function chaveDaDisciplina(nome: string): string {
  return semAcentoNemCaixa(nome)
}
