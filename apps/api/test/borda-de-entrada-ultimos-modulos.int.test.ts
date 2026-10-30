import { ErrorCode, MENSAGENS_DE_ERRO, type PapelDeUsuario } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { montarEscolaComAssistente, type EscolaComAssistente } from './escola-com-assistente.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * A borda de entrada de `atividade/`, `artefato/`, `material/`, `tutor/` e `privacidade/` (reengenharia, 17.0, RF5; D81):
 * cada rota diz o mesmo antes e depois de o controller passar a validar pelo `ZodValidationPipe` e pelo `IdPipe` no
 * parâmetro. O que cada rota responde, ao pé da letra, a id fora do formato, a corpo ou consulta fora do esquema, a corpo
 * que falta e a pessoa de outro papel (a guarda responde antes do pipe). O caso é uma rota por vez, para que a mutação de
 * um parâmetro caia só no caso dele. O upload do material, a `questao` do caminho e a `ferramenta` têm casos próprios, com
 * mais cenário, em `material.int.test.ts`, `atividade.int.test.ts` e `artefato.int.test.ts`. Postgres e Redis reais do
 * compose de teste; nada é gravado, e o banco prova.
 */

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }
const NAO_AUTENTICADO = { status: 401, corpo: { erro: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO } } }
const ENTRADA_INVALIDA = { status: 400, corpo: { erro: { codigo: ErrorCode.ENTRADA_INVALIDA, mensagem: MENSAGENS_DE_ERRO.ENTRADA_INVALIDA } } }

const semRequisicao = (resposta: RespostaHttp) => ({ status: resposta.status, corpo: { ...resposta.corpo, erro: { ...resposta.corpo.erro, requisicaoId: undefined } } })

interface Rota {
  /** O nome do caso: o método e a rota, como o código a declara. */
  readonly nome: string
  /** Quem alcança a rota. */
  readonly papel: PapelDeUsuario
  /** Quem a guarda recusa com o 404 do inexistente. */
  readonly outro: PapelDeUsuario
  readonly metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** O caminho, com o parâmetro que o caso troca. */
  readonly caminho: (parametro: string) => string
  /** O parâmetro de caminho, se houver. */
  readonly parametro?: boolean
  /** O corpo que o esquema aceita, e um que não aceita. Sem eles, a rota não lê corpo. */
  readonly corpo?: unknown
  readonly corpoInvalido?: unknown
  /** A consulta que o esquema aceita (com o `?`), e uma que não aceita. */
  readonly consulta?: string
  readonly consultaInvalida?: string
  /** Sem corpo nenhum: `aceito` passa do pipe (o service responde o 404 do id sorteado), `recusado` é `ENTRADA_INVALIDA`. */
  readonly semCorpo?: 'aceito' | 'recusado'
}

const FORA_DO_FORMATO = 'nao-e-uuid'
const idSorteado = () => randomUUID()
const A_MAIS = () => ({ escolaId: idSorteado() })
const CONSULTA_A_MAIS = () => `escolaId=${idSorteado()}`

const ROTAS: readonly Rota[] = [
  {
    nome: 'POST /v1/atividades-aplicadas',
    papel: 'professor',
    outro: 'aluno',
    metodo: 'POST',
    caminho: () => '/v1/atividades-aplicadas',
    corpo: { artefatoId: idSorteado(), turmaId: idSorteado(), avaliativa: false },
    corpoInvalido: { artefatoId: idSorteado(), turmaId: idSorteado(), avaliativa: false, ...A_MAIS() },
  },
  {
    nome: 'GET /v1/atividades-aplicadas',
    papel: 'professor',
    outro: 'aluno',
    metodo: 'GET',
    caminho: () => '/v1/atividades-aplicadas',
    consulta: `?turmaId=${idSorteado()}`,
    consultaInvalida: `?turmaId=${idSorteado()}&${CONSULTA_A_MAIS()}`,
  },
  { nome: 'POST /v1/atividades-aplicadas/:id/encerrar', papel: 'professor', outro: 'aluno', metodo: 'POST', caminho: (id) => `/v1/atividades-aplicadas/${id}/encerrar`, parametro: true, corpo: {}, corpoInvalido: { forcar: true }, semCorpo: 'aceito' },
  { nome: 'GET /v1/atividades-aplicadas/:id/correcao', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/atividades-aplicadas/${id}/correcao`, parametro: true },
  {
    nome: 'POST /v1/atividades-aplicadas/:id/correcao/destaques/:alunoId/abrir, o id da atividade',
    papel: 'professor',
    outro: 'aluno',
    metodo: 'POST',
    caminho: (id) => `/v1/atividades-aplicadas/${id}/correcao/destaques/${idSorteado()}/abrir`,
    parametro: true,
    corpo: {},
    corpoInvalido: { forcar: true },
    semCorpo: 'aceito',
  },
  {
    nome: 'POST /v1/atividades-aplicadas/:id/correcao/destaques/:alunoId/abrir, o id do aluno',
    papel: 'professor',
    outro: 'aluno',
    metodo: 'POST',
    caminho: (alunoId) => `/v1/atividades-aplicadas/${idSorteado()}/correcao/destaques/${alunoId}/abrir`,
    parametro: true,
    corpo: {},
  },
  { nome: 'GET /v1/turmas/:id/desempenho', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/turmas/${id}/desempenho`, parametro: true, consulta: '', consultaInvalida: `?${CONSULTA_A_MAIS()}` },
  { nome: 'POST /v1/entregas/:id/aprovar-lote', papel: 'professor', outro: 'aluno', metodo: 'POST', caminho: (id) => `/v1/entregas/${id}/aprovar-lote`, parametro: true, corpo: {}, corpoInvalido: { apresentado: true }, semCorpo: 'aceito' },
  { nome: 'GET /v1/minhas-atividades', papel: 'aluno', outro: 'professor', metodo: 'GET', caminho: () => '/v1/minhas-atividades', consulta: '?limite=10', consultaInvalida: `?${CONSULTA_A_MAIS()}` },
  { nome: 'GET /v1/atividades-aplicadas/:id/prova', papel: 'aluno', outro: 'professor', metodo: 'GET', caminho: (id) => `/v1/atividades-aplicadas/${id}/prova`, parametro: true },
  {
    nome: 'PUT /v1/atividades-aplicadas/:id/respostas/:questao, o id',
    papel: 'aluno',
    outro: 'professor',
    metodo: 'PUT',
    caminho: (id) => `/v1/atividades-aplicadas/${id}/respostas/1`,
    parametro: true,
    corpo: { alternativa: 0 },
    corpoInvalido: { alternativa: 4 },
  },
  { nome: 'POST /v1/atividades-aplicadas/:id/enviar', papel: 'aluno', outro: 'professor', metodo: 'POST', caminho: (id) => `/v1/atividades-aplicadas/${id}/enviar`, parametro: true, corpo: {}, corpoInvalido: { forcar: true }, semCorpo: 'aceito' },
  { nome: 'GET /v1/atividades-aplicadas/:id/meu-diagnostico', papel: 'aluno', outro: 'professor', metodo: 'GET', caminho: (id) => `/v1/atividades-aplicadas/${id}/meu-diagnostico`, parametro: true },
  { nome: 'GET /v1/artefatos', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: () => '/v1/artefatos', consulta: '?limite=10', consultaInvalida: `?${CONSULTA_A_MAIS()}` },
  { nome: 'GET /v1/artefatos/:id', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/artefatos/${id}`, parametro: true },
  { nome: 'PATCH /v1/artefatos/:id', papel: 'professor', outro: 'aluno', metodo: 'PATCH', caminho: (id) => `/v1/artefatos/${id}`, parametro: true, corpo: { titulo: 'Outro título' }, corpoInvalido: { titulo: '' } },
  { nome: 'GET /v1/artefatos/:id/pdf', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/artefatos/${id}/pdf`, parametro: true },
  {
    nome: 'POST /v1/artefatos/:id/adaptar',
    papel: 'professor',
    outro: 'aluno',
    metodo: 'POST',
    caminho: (id) => `/v1/artefatos/${id}/adaptar`,
    parametro: true,
    corpo: { tipos: ['fonte_ampliada'], chaveEnvio: idSorteado() },
    corpoInvalido: { tipos: [], chaveEnvio: idSorteado() },
  },
  { nome: 'GET /v1/materiais', papel: 'coordenador', outro: 'aluno', metodo: 'GET', caminho: () => '/v1/materiais', consulta: '?limite=10', consultaInvalida: `?${CONSULTA_A_MAIS()}` },
  { nome: 'GET /v1/materiais/busca', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: () => '/v1/materiais/busca', consulta: '?q=estequiometria', consultaInvalida: '?q=estequiometria&limite=0' },
  { nome: 'GET /v1/materiais/:id', papel: 'coordenador', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/materiais/${id}`, parametro: true },
  { nome: 'DELETE /v1/materiais/:id', papel: 'coordenador', outro: 'aluno', metodo: 'DELETE', caminho: (id) => `/v1/materiais/${id}`, parametro: true },
  { nome: 'POST /v1/tutor/mensagens', papel: 'aluno', outro: 'professor', metodo: 'POST', caminho: () => '/v1/tutor/mensagens', corpo: { texto: 'Como se calcula a massa molar?', chaveEnvio: idSorteado() }, corpoInvalido: { texto: '', chaveEnvio: idSorteado() } },
  { nome: 'GET /v1/tutor/conversa', papel: 'aluno', outro: 'professor', metodo: 'GET', caminho: () => '/v1/tutor/conversa', consulta: '', consultaInvalida: `?${CONSULTA_A_MAIS()}` },
  { nome: 'GET /v1/tutor/uso', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: () => '/v1/tutor/uso', consulta: `?turmaId=${idSorteado()}`, consultaInvalida: `?turmaId=${FORA_DO_FORMATO}` },
  { nome: 'GET /v1/sinais', papel: 'professor', outro: 'aluno', metodo: 'GET', caminho: () => '/v1/sinais', consulta: `?turmaId=${idSorteado()}`, consultaInvalida: `?turmaId=${idSorteado()}&${CONSULTA_A_MAIS()}` },
  { nome: 'POST /v1/meus-dados/:id/baixar', papel: 'aluno', outro: 'coordenador', metodo: 'POST', caminho: (id) => `/v1/meus-dados/${id}/baixar`, parametro: true, corpo: {}, corpoInvalido: { finalidade: 'curiosidade' }, semCorpo: 'recusado' },
  { nome: 'POST /v1/privacidade/incidentes/:id/confirmar', papel: 'coordenador', outro: 'aluno', metodo: 'POST', caminho: (id) => `/v1/privacidade/incidentes/${id}/confirmar`, parametro: true, corpo: {}, corpoInvalido: { forcar: true }, semCorpo: 'recusado' },
  { nome: 'POST /v1/privacidade/titulares/busca', papel: 'coordenador', outro: 'aluno', metodo: 'POST', caminho: () => '/v1/privacidade/titulares/busca', corpo: { termo: 'Sintética' }, corpoInvalido: { termo: 'ab' } },
  { nome: 'GET /v1/privacidade/titulares/:id/previa', papel: 'coordenador', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/privacidade/titulares/${id}/previa`, parametro: true },
  {
    nome: 'POST /v1/privacidade/pedidos',
    papel: 'coordenador',
    outro: 'aluno',
    metodo: 'POST',
    caminho: () => '/v1/privacidade/pedidos',
    corpo: { titularId: idSorteado(), tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-10-01', chaveEnvio: idSorteado() },
    corpoInvalido: { titularId: idSorteado(), tipo: 'acesso', solicitante: 'titular', chegouEm: '2026-10-01', chaveEnvio: idSorteado(), ...A_MAIS() },
  },
  { nome: 'GET /v1/privacidade/pedidos', papel: 'coordenador', outro: 'aluno', metodo: 'GET', caminho: () => '/v1/privacidade/pedidos', consulta: '?limite=10', consultaInvalida: '?limite=101' },
  { nome: 'GET /v1/privacidade/pedidos/:id', papel: 'coordenador', outro: 'aluno', metodo: 'GET', caminho: (id) => `/v1/privacidade/pedidos/${id}`, parametro: true },
  { nome: 'POST /v1/privacidade/pedidos/:id/concluir', papel: 'coordenador', outro: 'aluno', metodo: 'POST', caminho: (id) => `/v1/privacidade/pedidos/${id}/concluir`, parametro: true, corpo: {}, corpoInvalido: { forcar: true }, semCorpo: 'recusado' },
  { nome: 'POST /v1/privacidade/pedidos/:id/cancelar', papel: 'coordenador', outro: 'aluno', metodo: 'POST', caminho: (id) => `/v1/privacidade/pedidos/${id}/cancelar`, parametro: true, corpo: {}, corpoInvalido: { forcar: true }, semCorpo: 'recusado' },
  { nome: 'POST /v1/privacidade/pedidos/:id/corrigir-nome', papel: 'coordenador', outro: 'aluno', metodo: 'POST', caminho: (id) => `/v1/privacidade/pedidos/${id}/corrigir-nome`, parametro: true, corpo: { nome: 'Nome Sintético' }, corpoInvalido: { nome: '' } },
  {
    nome: 'POST /v1/privacidade/pedidos/:id/arquivo',
    papel: 'coordenador',
    outro: 'aluno',
    metodo: 'POST',
    caminho: (id) => `/v1/privacidade/pedidos/${id}/arquivo`,
    parametro: true,
    corpo: { finalidade: 'entregar_ao_titular' },
    corpoInvalido: { finalidade: 'curiosidade' },
  },
]

describe('a borda de entrada de atividade, artefato, material, tutor e privacidade: cada rota responde igual antes e depois do ZodValidationPipe e do IdPipe', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste
  let escola: EscolaComAssistente

  beforeAll(async () => {
    // Os limites por usuário e por escola vêm altos: o teste prova a borda, não o rate limit do F0 (`limite.int.test.ts`).
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '2000', LIMITE_REQ_ESCOLA_MIN: '2000' } })
    escola = await montarEscolaComAssistente(api, bancada)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  const sessaoDe = (papel: PapelDeUsuario): SessaoDeTeste => {
    if (papel === 'coordenador') return escola.coordenacao
    return papel === 'professor' ? escola.professora : escola.aluno
  }
  const pedir = (rota: Rota, token: string | undefined, parametro: string, corpo?: unknown, consulta = '') => chamar(api.url, rota.metodo, `${rota.caminho(parametro)}${consulta}`, token, corpo)
  /** O que a escola tem, para provar que nenhuma rota escreveu nada nela. */
  const retrato = async (): Promise<string> => {
    const tabelas = ['atividade_aplicada', 'tentativa_atividade', 'resposta_atividade', 'correcao', 'entrega', 'artefato', 'material', 'mensagem_tutor', 'sinal_tutor', 'execucao_agente', 'pedido_titular', 'auditoria']
    const contagens = await Promise.all(tabelas.map(async (tabela) => (await bancada.pool.query<{ n: string }>(`select count(*) as n from ${tabela} where escola_id = $1`, [escola.escolaId])).rows[0]?.n))
    return JSON.stringify(contagens)
  }

  it.each(ROTAS.map((rota) => [rota.nome, rota] as const))('a borda de %s: o id fora do formato é o 404 do inexistente, o corpo e a consulta fora do esquema são ENTRADA_INVALIDA, e nada é gravado', async (_nome, rota) => {
    const antes = await retrato()
    const token = (await sessaoDe(rota.papel).tokenNovo())
    const consulta = rota.consulta ?? ''
    const sorteado = idSorteado()
    if (rota.parametro === true) {
      const foraDoFormato = semRequisicao(await pedir(rota, token, FORA_DO_FORMATO, rota.corpo, consulta))
      expect(foraDoFormato).toEqual(NAO_ENCONTRADO)
      // O formato que o pipe aceita chega ao service, e o inexistente de lá responde o mesmo, ao pé da letra.
      expect(semRequisicao(await pedir(rota, token, sorteado, rota.corpo, consulta))).toEqual(foraDoFormato)
    }
    if (rota.corpoInvalido !== undefined) expect(semRequisicao(await pedir(rota, token, sorteado, rota.corpoInvalido, consulta))).toEqual(ENTRADA_INVALIDA)
    if (rota.consultaInvalida !== undefined) expect(semRequisicao(await pedir(rota, token, sorteado, rota.corpo, rota.consultaInvalida))).toEqual(ENTRADA_INVALIDA)
    expect(await retrato()).toBe(antes)
  })

  it.each(ROTAS.filter((rota) => rota.parametro === true && (rota.corpoInvalido !== undefined || rota.consultaInvalida !== undefined)).map((rota) => [rota.nome, rota] as const))(
    'com o id e o corpo ou a consulta inválidos ao mesmo tempo, %s responde igual para qualquer id: a resposta não depende de o id existir',
    async (_nome, rota) => {
      const token = await sessaoDe(rota.papel).tokenNovo()
      const corpo = rota.corpoInvalido ?? rota.corpo
      const consulta = rota.consultaInvalida ?? rota.consulta ?? ''
      // A garantia é a regra 10, item 6: a resposta não depende de o id existir (fora do formato ou inexistente dão a mesma). O
      // erro que sai é o do corpo ou da consulta (400) porque o Nest resolve o último parâmetro primeiro, e isso é do framework
      // (onda-1a.md T1): se uma versão inverter a ordem, o que o teste exige continua sendo a igualdade das duas respostas, e
      // a asserção do 400 é a que então se reescreve. O id de outra escola não entra aqui: o pipe não consulta o banco.
      const foraDoFormato = semRequisicao(await pedir(rota, token, FORA_DO_FORMATO, corpo, consulta))
      expect(foraDoFormato).toEqual(semRequisicao(await pedir(rota, token, idSorteado(), corpo, consulta)))
      expect(foraDoFormato).toEqual(ENTRADA_INVALIDA)
    },
  )

  it.each(ROTAS.filter((rota) => rota.semCorpo !== undefined).map((rota) => [rota.nome, rota] as const))('sem corpo nenhum, %s responde como já respondia', async (_nome, rota) => {
    const token = await sessaoDe(rota.papel).tokenNovo()
    const resposta = semRequisicao(await pedir(rota, token, idSorteado(), undefined, rota.consulta ?? ''))
    expect(resposta).toEqual(rota.semCorpo === 'aceito' ? NAO_ENCONTRADO : ENTRADA_INVALIDA)
  })

  it.each(ROTAS.map((rota) => [rota.nome, rota] as const))('a guarda responde antes do pipe: sem sessão, 401; quem não é do papel, o 404 da guarda, mesmo com o id e o corpo fora do esquema (%s)', async (_nome, rota) => {
    const invalido = rota.corpoInvalido ?? rota.corpo
    const consulta = rota.consultaInvalida ?? rota.consulta ?? ''
    const parametro = rota.parametro === true ? FORA_DO_FORMATO : ''
    expect(semRequisicao(await pedir(rota, undefined, parametro, invalido, consulta))).toEqual(NAO_AUTENTICADO)
    expect(semRequisicao(await pedir(rota, await sessaoDe(rota.outro).tokenNovo(), parametro, invalido, consulta))).toEqual(NAO_ENCONTRADO)
  })
})
