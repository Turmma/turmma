import { espelhoDaFilaSchema, type EspelhoDaFila } from '@educa/shared'
import type { EscolhaPendente } from '../areas/aluno/respostas'
import { aoTrocarDeSessao, estadoDaSessao } from './sessao'

/**
 * O espelho da fila de respostas (53.0, RF21, regra 80 item 6): a escolha que o servidor ainda não confirmou, guardada
 * em `sessionStorage`, uma chave por atividade, para sobreviver ao F5, à aba reaberta e à sessão que vence com o mesmo
 * aluno. A rede cai, a sessão vence, o aluno volta: a escolha dele não pode ter ficado só na memória da aba.
 *
 * **Só ids e números** (regra 20): o id da atividade, o número da questão, o índice da alternativa, a `sequencia` e o
 * `dono`, o identificador opaco do aluno da sessão. Nunca o enunciado, o nome nem texto. `sessionStorage`, e não
 * `localStorage`: some com a aba, e o Chromebook do carrinho não guarda nada de ninguém depois que ela fecha.
 *
 * **O dono separa "o mesmo aluno voltou" de "sentou outra pessoa"**, e vale também na aba reaberta, em que o navegador
 * devolve o `sessionStorage`. O que é de outro dono, ou não passa pelo esquema estrito, é apagado ao ler e nunca é
 * mandado nem mostrado.
 *
 * **Mora em `api/`, e não na tela, porque a limpeza não pode depender de a Atividade ter sido aberta** (regra 20: nada da
 * pessoa anterior ao alcance de quem senta depois): o gancho do fim do arquivo vale desde que a casca da escola carrega
 * este módulo, e a casca chama `esquecerEspelhosDeOutroDono` a cada `/v1/eu` novo, na entrada de quem quer que seja. Quem
 * grava e hidrata é a fila (`areas/aluno/fila-de-respostas.ts`).
 *
 * Este módulo não é sessão: o token e quem está na aba continuam só em memória (`api/sessao.ts`). Todo acesso ao
 * armazenamento está em `try/catch`: cota cheia, modo restrito ou navegador sem `sessionStorage` deixam a fila só em
 * memória, e a tela segue sem erro.
 */
const PREFIXO = 'educa.escolhas-pendentes.'

const chaveDa = (atividade: string): string => `${PREFIXO}${atividade}`

/** O acesso ao armazenamento que pode lançar (cota, modo restrito, sem `window`) vira o valor de reserva, e a fila segue em memória. */
function tentar<T>(acao: () => T, quandoFalha: T): T {
  try {
    return acao()
  } catch {
    return quandoFalha
  }
}

function apagar(chave: string): void {
  tentar(() => window.sessionStorage.removeItem(chave), undefined)
}

/** As chaves do espelho (de todas as atividades) que estão no armazenamento agora. */
function chavesDoEspelho(): string[] {
  return tentar(() => {
    const guardado = window.sessionStorage
    const chaves: (string | null)[] = []
    for (let indice = 0; indice < guardado.length; indice += 1) chaves.push(guardado.key(indice))
    return chaves.filter((chave): chave is string => chave?.startsWith(PREFIXO) === true)
  }, [])
}

/** O que está na chave, se passa pelo esquema estrito. Ausente, JSON quebrado, campo a mais ou tipo errado: `undefined`. */
function conteudoDa(chave: string): EspelhoDaFila | undefined {
  return tentar(() => espelhoDaFilaSchema.safeParse(JSON.parse(window.sessionStorage.getItem(chave) ?? 'null')).data, undefined)
}

/** Guarda as pendentes da atividade. Sem nenhuma, a chave sai: o espelho só existe enquanto há o que não foi confirmado. */
export function gravarEspelho(dono: string, atividade: string, pendentes: readonly EscolhaPendente[]): void {
  if (pendentes.length === 0) {
    apagar(chaveDa(atividade))
    return
  }
  tentar(() => window.sessionStorage.setItem(chaveDa(atividade), JSON.stringify({ dono, atividade, pendentes })), undefined)
}

/** As pendentes que este `dono` deixou na atividade. O que é de outro dono, de outra atividade ou inválido é apagado e não volta. */
export function lerEspelho(dono: string, atividade: string): readonly EscolhaPendente[] {
  const guardado = conteudoDa(chaveDa(atividade))
  if (guardado?.dono === dono && guardado.atividade === atividade) return guardado.pendentes
  apagar(chaveDa(atividade))
  return []
}

/** Apaga o espelho de toda atividade que não é de `dono` (e o que for ilegível): quem sentou depois não deixa a escolha da pessoa anterior ao alcance de ninguém. */
export function esquecerEspelhosDeOutroDono(dono: string): void {
  for (const chave of chavesDoEspelho()) if (conteudoDa(chave)?.dono !== dono) apagar(chave)
}

/** O "Sair": o espelho de todas as atividades vai embora, não só o da que está aberta. */
export function esquecerTodosOsEspelhos(): void {
  for (const chave of chavesDoEspelho()) apagar(chave)
}

// O fim da sessão decide o que acontece com o espelho. Vencida, ele **fica**: a rede cai, a sessão vence, o mesmo aluno
// volta e as escolhas ainda não salvas saem (RF21). No "Sair" e na suspensão vai embora, de todas as atividades. Entrar
// (`aberta`) não o apaga aqui: a pessoa que entrou só se sabe com o `/v1/eu`, e é a casca quem apaga o dos outros donos. O
// F5 não passa por este gancho (a aba nova abre `anonima` sem trocar de sessão), e por isso o espelho sobrevive a ele.
aoTrocarDeSessao(() => {
  const estado = estadoDaSessao()
  if (estado !== 'vencida' && estado !== 'aberta') esquecerTodosOsEspelhos()
})
