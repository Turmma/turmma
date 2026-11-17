/**
 * O prazo de um pedido do titular como a tela o escreve, para o e2e conferir sem depender de em que dia o relógio estava.
 *
 * O banco grava a chegada (o caso lê o dia uma vez, de `diaDeHojeNoBanco`, e o passa à semeadura), a tela conta `Faltam N` no dia em que é lida e o teste monta o texto esperado: três
 * relógios. O vencimento (chegada + 15) é fixo desde a semeadura; só o `Faltam N` anda um dia na meia-noite de São Paulo, e
 * a corrida que a cruza lê a tela no dia seguinte ao da semeadura (esteira 44004811034).
 *
 * É um **espelho de propósito** (o e2e é um oráculo independente da tela) de `apps/web/src/areas/coordenacao/privacidade/textos-do-pedido.ts`:
 * `PRAZO_DA_DECLARACAO_COMPLETA_DIAS` (os 15 dias do prazo, linha 28), `dias` (o singular) e `textoDoPrazo` (as quatro frases do prazo aberto
 * e do vencido). Quem muda o prazo ou o texto lá muda aqui também; o e2e dos pedidos fica vermelho se esquecer (a unidade deste ajudante só prova a conta dele).
 *
 * Ajudante puro (não importa o Playwright), para a unidade poder prová-lo: `tools/ci/prazo-do-pedido-no-e2e.test.ts`.
 */

/** O mesmo valor de `PRAZO_DA_DECLARACAO_COMPLETA_DIAS` em `textos-do-pedido.ts`. */
const PRAZO_DA_DECLARACAO_COMPLETA_DIAS = 15
const DIA_EM_MS = 86_400_000

/** O dia como o detalhe e a lista escrevem o prazo: "16/10/2026". */
export const diaCurto = (dia: string) => dia.split('-').reverse().join('/')

/** O dia de calendário `AAAA-MM-DD` mais `dias` (negativo volta). */
export const somarDias = (dia: string, dias: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) + dias * DIA_EM_MS).toISOString().slice(0, 10)

const dias = (quantidade: number): string => `${String(quantidade)} ${quantidade === 1 ? 'dia' : 'dias'}`

/** O texto do prazo de um pedido aberto que vence em `ate` (`AAAA-MM-DD`) e a que `faltam` dias da leitura; negativo é vencido. */
function textoDoPrazo(ate: string, faltam: number): string {
  if (faltam < 0) return `Prazo vencido há ${dias(-faltam)} (venceu em ${diaCurto(ate)})`
  if (faltam === 0) return `O prazo vence hoje, ${diaCurto(ate)}`
  return `${faltam === 1 ? 'Falta' : 'Faltam'} ${dias(faltam)}, até ${diaCurto(ate)}`
}

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Casa o prazo de um pedido semeado `chegouHaDias` antes do dia `diaDaSemeadura` (`AAAA-MM-DD`, o de São Paulo, lido pelo teste
 * **antes** de semear), seja a tela lida nesse dia ou no seguinte. O vencimento sai da semeadura e não anda com o relógio.
 */
export function prazoNaTela(diaDaSemeadura: string, chegouHaDias: number): RegExp {
  const ate = somarDias(somarDias(diaDaSemeadura, -chegouHaDias), PRAZO_DA_DECLARACAO_COMPLETA_DIAS)
  const faltamNaSemeadura = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${diaDaSemeadura}T00:00:00Z`)) / DIA_EM_MS)
  const leituras = [textoDoPrazo(ate, faltamNaSemeadura), textoDoPrazo(ate, faltamNaSemeadura - 1)]
  return new RegExp(leituras.map(escapar).join('|'))
}
