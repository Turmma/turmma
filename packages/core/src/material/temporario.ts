import { requireEscolaId } from '../context/context-escola.js'

/**
 * A chave do PDF que espera a extração no storage privado (ingestao-do-material, tarefa 1.0; onda 3b, 45.0). A escola só vem do
 * contexto (regra 10, item 3): quem monta a chave é o envio, a extração, a exclusão e o expurgo, cada um no contexto da escola dele, e
 * nenhum deles passa a escola por parâmetro. Só ids na chave, nunca título nem nome de arquivo (regra 20, item 7).
 */
export function chaveDoTemporario(materialId: string): string {
  return `material-temporario/${requireEscolaId()}/${materialId}`
}

/** O prazo de cada chamada ao storage que leva ou traz um PDF de até 20 MB: o armazém não segura a requisição nem o job. */
export const PRAZO_DO_OBJETO_DO_MATERIAL_MS = 30_000
