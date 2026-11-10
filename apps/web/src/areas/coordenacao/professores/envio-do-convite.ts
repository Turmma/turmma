import { ErrorCode, REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO, type EnviarConvitesResponse, type EstadoDoEnvio, type ProfessorDaEscola } from '@educa/shared'
import { errorText } from '../../../components/error-text'

/**
 * O envio do convite por e-mail na tela Professores (acesso-e-convites, 4.0; RF11, RF18; `cenarios.md`, "Telas", linha "Professores,
 * envio"): o rótulo de cada um dos cinco estados, a quem o "Enviar convites" chega, os textos do diálogo e a releitura que acompanha o
 * envio enquanto ele sai. Sem React aqui, para a regra ter teste de unidade.
 */

/** O fuso da escola, o mesmo de `FUSO_DO_USO` na API: a hora do envio é a da parede da escola, e não a do navegador. */
export const FUSO_DA_ESCOLA = 'America/Sao_Paulo'

/** `na_fila` e `enviando` dizem a mesma coisa à coordenação: o e-mail ainda não saiu. */
export const TEXTO_DO_ENVIO_EM_ANDAMENTO = 'Enviando'

/** O envio que não chegou: manda corrigir o e-mail (o "Corrigir o e-mail" do painel) e reenviar, ou copiar o link, sem sugerir que o professor errou. */
export const TEXTO_DO_ENVIO_QUE_FALHOU = 'Não chegou. Corrija o e-mail e reenvie, ou copie o link'

const HORA_DO_ENVIO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO_DA_ESCOLA })

/** `2026-11-12T17:05:00.000Z` → `12/11 às 14:05`, no fuso da escola, sem depender da pontuação que o Intl escolhe. */
export function horaDoEnvio(iso: string): string {
  const partes: Record<string, string> = {}
  for (const parte of HORA_DO_ENVIO.formatToParts(new Date(iso))) partes[parte.type] = parte.value
  return `${partes['day'] ?? ''}/${partes['month'] ?? ''} às ${partes['hour'] ?? ''}:${partes['minute'] ?? ''}`
}

/**
 * O que a lista diz do envio de um professor. O `cancelado` não diz nada: o link foi trocado ou o convite revogado, e vale o estado do
 * convite, que a linha já mostra. Sem envio (convite copiado, ou professor sem convite), também nada.
 */
export function rotuloDoEnvio(professor: Pick<ProfessorDaEscola, 'envio' | 'enviadoEm'>): string {
  const porEstado: Readonly<Record<EstadoDoEnvio, string>> = {
    na_fila: TEXTO_DO_ENVIO_EM_ANDAMENTO,
    enviando: TEXTO_DO_ENVIO_EM_ANDAMENTO,
    enviado: professor.enviadoEm === null ? 'Enviado' : `Enviado em ${horaDoEnvio(professor.enviadoEm)}`,
    falhou: TEXTO_DO_ENVIO_QUE_FALHOU,
    cancelado: '',
  }
  return professor.envio === null ? '' : porEstado[professor.envio]
}

/** O professor que o "Enviar convites" alcança: o que espera o convite (pendente ou vencido), pela mesma matriz pela qual o servidor decide. */
export function esperaOConvite(professor: Pick<ProfessorDaEscola, 'estado'>): boolean {
  return REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[professor.estado] === 'refazer'
}

/** Os professores da lista a quem o "Enviar convites" chega. */
export function professoresQueEsperamOConvite<Professor extends Pick<ProfessorDaEscola, 'estado'>>(professores: readonly Professor[]): Professor[] {
  return professores.filter(esperaOConvite)
}

/** O "Reenviar" do painel: só para quem espera o convite e já teve um envio por e-mail. O primeiro envio é do "Enviar convites". */
export function podeReenviar(professor: Pick<ProfessorDaEscola, 'estado' | 'envio'>): boolean {
  return esperaOConvite(professor) && professor.envio !== null
}

/** Algum professor da lista tem o e-mail ainda por sair: é o que mantém a lista se relendo. */
export function haEnvioEmAberto(professores: readonly Pick<ProfessorDaEscola, 'envio'>[]): boolean {
  return professores.some((professor) => professor.envio === 'na_fila' || professor.envio === 'enviando')
}

/** O que acontece com o link de antes, dito no diálogo do "Enviar convites" e no do "Reenviar". */
export const TEXTO_DOS_LINKS_ANTERIORES = 'Os links enviados ou copiados antes deixam de valer na hora.'

/** O diálogo do "Enviar convites" aberto quando a lista se releu e ninguém mais espera o convite (aceitou, ou foi revogado). */
export const TEXTO_SEM_QUEM_ESPERE_O_CONVITE = 'Ninguém espera o convite agora: a lista mudou. Confira a situação de cada professor.'

/** A quantidade do "Enviar convites", antes de confirmar: "Enviar o convite por e-mail a 3 professores." */
export function textoDoEnvioEmLote(quantidade: number): string {
  return `Enviar o convite por e-mail a ${quantidade === 1 ? '1 professor' : `${String(quantidade)} professores`}. Cada um recebe um e-mail com o link para criar a senha.`
}

/** O "Reenviar" de um professor só: um e-mail novo, com um link novo. */
export function textoDoReenvio(nome: string): string {
  return `Um e-mail novo, com um link novo, para ${nome}.`
}

/** O que o diálogo diz depois de enfileirar: a contagem que o servidor devolveu, que é de quem entrou, e não de quem estava na tela. */
export function textoDoEnvioFeito(resposta: EnviarConvitesResponse): string {
  if (resposta.quantidade === 0) return 'Nenhum convite entrou na fila: a lista mudou. Confira a situação de cada professor.'
  const fila = resposta.quantidade === 1 ? '1 convite entrou na fila' : `${String(resposta.quantidade)} convites entraram na fila`
  return `${fila}. A situação de cada professor se atualiza na lista.`
}

/**
 * O texto da falha do envio: o do catálogo. O `LIMITE_EXCEDIDO` (a cota de 300 convites por hora da escola) diz para esperar, e o mesmo botão tenta de
 * novo, sem o aviso da tentativa anterior.
 */
export function falhaDoEnvioDeConvites(erro: unknown): string {
  return errorText(erro, { [ErrorCode.LIMITE_EXCEDIDO]: 'Muitos convites enviados em pouco tempo. Espere alguns minutos e envie de novo.' })
}

/** De quanto em quanto tempo a lista se relê enquanto há envio, e por quanto tempo: depois de 5 minutos o que sobrou não é demora, é falha. */
export const INTERVALO_DA_RELEITURA_MS = 5_000
export const PRAZO_DA_RELEITURA_MS = 300_000

interface ReleituraOptions {
  /** Relê a lista, sem cancelar a releitura que uma ação da pessoa pediu. */
  readonly reler: () => void
  /** Há alguma linha em `na_fila` ou `enviando` agora. */
  readonly haEnvio: () => boolean
  /** A aba está à vista. Oculta, a tela não gasta a rede da escola com uma lista que ninguém olha. */
  readonly visivel: () => boolean
  readonly agora?: () => number
}

/**
 * A releitura do envio: a cada 5 s, só com a aba visível e alguma linha em envio, e para de vez 5 minutos depois de começar. Devolve o que a
 * para. Quem chama começa de novo quando a coordenação pede outro envio.
 */
export function iniciarReleituraDoEnvio({ reler, haEnvio, visivel, agora = Date.now }: ReleituraOptions): () => void {
  // `setInterval` próprio, e não o `refetchInterval` do TanStack que Material, Time e TurmaHoje usam (D81): o `refetchInterval` não tem prazo de fim, e aqui a
  // releitura para sozinha 5 minutos depois de começar e recomeça a cada envio novo da coordenação, o que ele não expressa.
  const inicio = agora()
  const temporizador = setInterval(() => {
    if (agora() - inicio >= PRAZO_DA_RELEITURA_MS) {
      clearInterval(temporizador)
      return
    }
    if (visivel() && haEnvio()) reler()
  }, INTERVALO_DA_RELEITURA_MS)
  return () => clearInterval(temporizador)
}
