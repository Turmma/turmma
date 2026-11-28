import { randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { expect } from './profiles.ts'
import type { AlunoDeTeste } from './seed.ts'

/**
 * O aluno que faz a parte dele **pela API**, sem tela: no fluxo do professor (A3 e A4) o que se prova é o que a
 * professora vê e decide. A tela do aluno é de outro pacote, com o e2e dela. Tudo sintético: matrícula e nome inventados.
 */

/** Entra com a matrícula e a senha (`POST /v1/sessao/matricula`) e devolve o token de acesso do aluno. */
export async function entrarComoAlunoPelaApi(request: APIRequestContext, aluno: Pick<AlunoDeTeste, 'slug' | 'matricula' | 'senha'>): Promise<string> {
  const resposta = await request.post('/v1/sessao/matricula', { data: { slug: aluno.slug, matricula: aluno.matricula, senha: aluno.senha } })
  expect(resposta.status(), 'entrada do aluno pela matrícula').toBe(200)
  const corpo = (await resposta.json()) as { etapa: string; token?: string }
  if (corpo.etapa !== 'pronta' || corpo.token === undefined) throw new Error('a entrada do aluno não abriu sessão')
  return corpo.token
}

const comToken = (token: string) => ({ Authorization: `Bearer ${token}` })

/**
 * O aluno começa a atividade (`POST .../comecar`, que cria a tentativa dele) e responde as questões dadas: `null` deixa a
 * questão em branco. Com `enviar`, ele envia; sem, a tentativa fica aberta até a professora encerrar.
 * Só para aplicação sem embaralhar: as alternativas vão para as questões na ordem original, e numa prova embaralhada a ordem
 * de apresentação do aluno é outra.
 */
export async function responderPelaApi(request: APIRequestContext, token: string, atividadeAplicadaId: string, alternativas: readonly (number | null)[], { enviar = true }: { enviar?: boolean } = {}): Promise<void> {
  const comecou = await request.post(`/v1/atividades-aplicadas/${atividadeAplicadaId}/comecar`, { headers: comToken(token), data: {} })
  expect(comecou.status(), 'o aluno começa a atividade').toBe(200)
  for (const [indice, alternativa] of alternativas.entries()) {
    if (alternativa === null) continue
    const salva = await request.put(`/v1/atividades-aplicadas/${atividadeAplicadaId}/respostas/${String(indice + 1)}`, { headers: comToken(token), data: { alternativa } })
    expect(salva.status(), `resposta da questão ${String(indice + 1)}`).toBe(200)
  }
  if (!enviar) return
  const enviada = await request.post(`/v1/atividades-aplicadas/${atividadeAplicadaId}/enviar`, { headers: comToken(token), data: {} })
  expect(enviada.ok(), 'o aluno envia a atividade').toBe(true)
}

/**
 * O aluno pergunta ao Tutor (`POST /v1/tutor/mensagens`) e espera a execução terminar: é quando o sinal, se houver, já
 * nasceu. Devolve o estado final da execução.
 */
export async function perguntarAoTutorPelaApi(request: APIRequestContext, token: string, pergunta: { texto: string; atividadeAplicadaId: string; questao: number }): Promise<string> {
  const aceita = await request.post('/v1/tutor/mensagens', { headers: comToken(token), data: { ...pergunta, chaveEnvio: randomUUID() } })
  expect(aceita.status(), 'a pergunta ao Tutor é aceita').toBe(202)
  const { execucaoId } = (await aceita.json()) as { execucaoId: string }
  let estado = 'pendente'
  await expect
    .poll(
      async () => {
        const execucao = await request.get(`/v1/execucoes/${execucaoId}`, { headers: comToken(token) })
        estado = ((await execucao.json()) as { estado: string }).estado
        return estado === 'concluida' || estado === 'falhou'
      },
      { timeout: 45_000, intervals: [1_000] },
    )
    .toBe(true)
  return estado
}

/**
 * O aluno **sai da aba** da prova, uma vez (`POST .../saidas-da-aba`, 204): a tela dele (12.0) é quem manda a saída de verdade, e este é o mesmo pedido, com a chave
 * uuid v4 que o contrato exige. É o que faz a coluna "Saiu da aba" do lote ter "1" para o professor.
 */
export async function sairDaAbaPelaApi(request: APIRequestContext, token: string, atividadeAplicadaId: string): Promise<void> {
  const saida = await request.post(`/v1/atividades-aplicadas/${atividadeAplicadaId}/saidas-da-aba`, { headers: comToken(token), data: { chave: randomUUID() } })
  expect(saida.status(), 'a saída da aba é aceita').toBe(204)
}

/** O aluno começa a prova (`POST .../comecar`, que cria a tentativa e põe o relógio dele a andar): o caso que não é sobre o "Começar" abre depois direto a tela de foco. */
export async function comecarPelaApi(request: APIRequestContext, token: string, atividadeAplicadaId: string): Promise<void> {
  const comecou = await request.post(`/v1/atividades-aplicadas/${atividadeAplicadaId}/comecar`, { headers: comToken(token), data: {} })
  expect(comecou.status(), 'o aluno começa a prova').toBe(200)
}

/** Uma resposta pelo **número original** da questão e o **índice original** da alternativa: o que a tela manda numa prova embaralhada (a posição na tela não entra). */
export async function responderPelaApiOriginal(request: APIRequestContext, token: string, atividadeAplicadaId: string, questao: number, alternativa: number): Promise<void> {
  const salva = await request.put(`/v1/atividades-aplicadas/${atividadeAplicadaId}/respostas/${String(questao)}`, { headers: comToken(token), data: { alternativa } })
  expect(salva.status(), `resposta da questão ${String(questao)}`).toBe(200)
}

/** O aluno envia a prova (`POST .../enviar`). */
export async function enviarPelaApi(request: APIRequestContext, token: string, atividadeAplicadaId: string): Promise<void> {
  const enviada = await request.post(`/v1/atividades-aplicadas/${atividadeAplicadaId}/enviar`, { headers: comToken(token), data: {} })
  expect(enviada.ok(), 'o aluno envia a prova').toBe(true)
}

/** A prova como o aluno a recebe (`GET .../prova`, já começada): as questões na ordem dele, com as alternativas na ordem dele. */
export async function lerAProvaPelaApi(request: APIRequestContext, token: string, atividadeAplicadaId: string): Promise<{ questoes: { numero: number; alternativas: string[]; ordemDasAlternativas: number[] }[] }> {
  const lida = await request.get(`/v1/atividades-aplicadas/${atividadeAplicadaId}/prova`, { headers: comToken(token) })
  expect(lida.status(), 'a leitura da prova').toBe(200)
  return (await lida.json()) as { questoes: { numero: number; alternativas: string[]; ordemDasAlternativas: number[] }[] }
}
