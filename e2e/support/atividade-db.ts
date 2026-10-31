import { randomBytes } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'

/**
 * O que o e2e do fluxo do aluno (A3 e A4) precisa pronto antes de ele entrar: o material lido e a atividade gerada,
 * gravados direto no banco com dado sintético, e **o que é da professora, feito pela API** (aplicar, encerrar, abrir os
 * destaques e aprovar o lote), com a sessão dela. As telas dela são de outro pacote; aqui interessa o que o aluno vê.
 */

/** As páginas do material sintético: o texto é o que a busca do Tutor acha a partir do enunciado de cada questão. */
const PAGINAS = [
  'Estequiometria é o estudo das quantidades de reagentes e produtos em uma reação química.',
  'A massa molar de uma substância é a soma das massas atômicas dos átomos da fórmula. Na água, dois hidrogênios e um oxigênio.',
  'Na equação balanceada, os coeficientes dão a proporção em mols entre reagentes e produtos, como na síntese da amônia.',
  'O reagente limitante é o que acaba primeiro em uma reação química e determina quanto produto se forma.',
]

export const HABILIDADES_DO_FLUXO = {
  massaMolar: { codigo: 'QUI.EM.05', descricao: 'Calcular a massa molar de uma substância' },
  proporcao: { codigo: 'QUI.EM.06', descricao: 'Aplicar a proporção em mols da equação balanceada' },
  limitante: { codigo: 'QUI.EM.07', descricao: 'Identificar o reagente limitante de uma reação' },
} as const

/** A alternativa certa da questão 3, por extenso: o Tutor não pode repeti-la ao aluno. */
export const ALTERNATIVA_CERTA_DA_QUESTAO_3 = 'O reagente que acaba primeiro e determina quanto produto se forma'
/** O gabarito, pelo índice: questão 1 → B, 2 → C, 3 → A. */
export const GABARITO_DO_FLUXO = [1, 2, 0] as const

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

export interface AtividadeNoBanco {
  readonly artefatoId: string
  readonly materialId: string
}

/** O material `pronto`, com uma página por trecho, e a atividade objetiva de três questões que cita as páginas dele. */
export function criarAtividadeNoBanco(escolaId: string, professoraId: string, turmaId: string, disciplina: string, titulo: string): Promise<AtividadeNoBanco> {
  return comBanco(async (banco) => {
    const { rows: turmas } = await banco.query<{ anoLetivoId: string }>('select ano_letivo_id as "anoLetivoId" from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
    const { rows: disciplinas } = await banco.query<{ id: string }>('select id from disciplina where escola_id = $1 and nome = $2', [escolaId, disciplina])
    const anoLetivoId = turmas[0]?.anoLetivoId
    const disciplinaId = disciplinas[0]?.id
    if (anoLetivoId === undefined || disciplinaId === undefined) throw new Error('o seed do e2e não achou a turma ou a disciplina')
    const { rows: materiais } = await banco.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, paginas, estado)
       values ($1, $2, 'Química 2, capítulo 7: Estequiometria', 'escola', 'autoria_da_escola', true, $3, 48000, $4, 'pronto') returning id`,
      [escolaId, disciplinaId, randomBytes(32).toString('hex'), PAGINAS.length],
    )
    const materialId = materiais[0]?.id
    if (materialId === undefined) throw new Error('o seed do e2e não criou o material')
    for (const [indice, texto] of PAGINAS.entries()) {
      await banco.query('insert into trecho (escola_id, disciplina_id, material_id, pagina, texto) values ($1, $2, $3, $4, $5)', [escolaId, disciplinaId, materialId, indice + 1, texto])
    }
    const citacao = (pagina: number) => ({ materialId, pagina, trecho: `Página ${String(pagina)} do material` })
    const conteudo = {
      tipo: 'atividade_objetiva',
      titulo,
      questoes: [
        { enunciado: 'Qual é a massa molar da água, H2O?', alternativas: ['16 g/mol', '18 g/mol', '20 g/mol', '34 g/mol'], gabarito: GABARITO_DO_FLUXO[0], habilidade: HABILIDADES_DO_FLUXO.massaMolar, citacao: citacao(2), explicacao: 'Dois hidrogênios e um oxigênio somam 18.' },
        { enunciado: 'Na reação N2 + 3 H2 -> 2 NH3, quantos mols de amônia se formam a partir de 6 mol de H2?', alternativas: ['2 mol', '3 mol', '4 mol', '6 mol'], gabarito: GABARITO_DO_FLUXO[1], habilidade: HABILIDADES_DO_FLUXO.proporcao, citacao: citacao(3), explicacao: 'A proporção é de 3 para 2.' },
        {
          enunciado: 'Em uma reação química, o que é o reagente limitante?',
          alternativas: [ALTERNATIVA_CERTA_DA_QUESTAO_3, 'O reagente que sobra quando a reação termina', 'O produto obtido em maior quantidade', 'O reagente de maior massa molar'],
          gabarito: GABARITO_DO_FLUXO[2],
          habilidade: HABILIDADES_DO_FLUXO.limitante,
          citacao: citacao(4),
          explicacao: 'É a definição da página 4.',
        },
      ],
    }
    const { rows: artefatos } = await banco.query<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6, $7) returning id`,
      [escolaId, anoLetivoId, turmaId, disciplinaId, titulo, JSON.stringify(conteudo), professoraId],
    )
    const artefatoId = artefatos[0]?.id
    if (artefatoId === undefined) throw new Error('o seed do e2e não criou a atividade')
    return { artefatoId, materialId }
  })
}

/** As respostas que o servidor guardou do aluno numa atividade, pela questão: é o que prova que cada escolha chegou. */
export function respostasNoBanco(escolaId: string, atividadeAplicadaId: string, alunoId: string): Promise<Array<{ questao: number; alternativa: number }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ questao: number; alternativa: number }>(
      'select questao, alternativa from resposta_atividade where escola_id = $1 and atividade_aplicada_id = $2 and aluno_id = $3 order by questao',
      [escolaId, atividadeAplicadaId, alunoId],
    )
    return rows
  })
}

/** A professora pela API, com a sessão dela: o que a tela dela faria, sem passar pela tela. */
export class ProfessoraPelaApi {
  private readonly pedidos: APIRequestContext
  private readonly token: string

  private constructor(pedidos: APIRequestContext, token: string) {
    this.pedidos = pedidos
    this.token = token
  }

  static async entrar(pedidos: APIRequestContext, professora: { readonly email: string; readonly senha: string }): Promise<ProfessoraPelaApi> {
    const resposta = await pedidos.post('/v1/sessao/email', { data: { email: professora.email, senha: professora.senha } })
    const corpo = (await resposta.json()) as { etapa?: string; token?: string }
    if (!resposta.ok() || corpo.etapa !== 'pronta' || corpo.token === undefined) throw new Error(`a professora não entrou pela API: ${String(resposta.status())}`)
    return new ProfessoraPelaApi(pedidos, corpo.token)
  }

  private async chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
    const opcoes = { headers: { Authorization: `Bearer ${this.token}` }, ...(corpo === undefined ? {} : { data: corpo }) }
    const resposta = await (metodo === 'GET' ? this.pedidos.get(caminho, opcoes) : this.pedidos.post(caminho, opcoes))
    if (!resposta.ok()) throw new Error(`${metodo} ${caminho} respondeu ${String(resposta.status())}: ${await resposta.text()}`)
    return (await resposta.json()) as T
  }

  /** Aplica a atividade à turma e devolve o id da aplicação. */
  async aplicar(artefatoId: string, turmaId: string, avaliativa: boolean): Promise<string> {
    return (await this.chamar<{ id: string }>('POST', '/v1/atividades-aplicadas', { artefatoId, turmaId, avaliativa })).id
  }

  /** Encerra a atividade, espera a correção montar o lote, abre os destaques e aprova: é daí que o aluno alcança o diagnóstico. */
  async encerrarEAprovar(atividadeAplicadaId: string): Promise<void> {
    const encerrada = await this.chamar<{ execucaoId: string | null; atividade: { entrega: { id: string } | null } }>('POST', `/v1/atividades-aplicadas/${atividadeAplicadaId}/encerrar`, {})
    // A correção de objetiva é uma conta, feita no próprio encerramento: o lote já vem na resposta. Se um dia ela for para
    // a fila, a execução vem aqui, e o teste a espera.
    for (let tentativa = 0; encerrada.execucaoId !== null; tentativa += 1) {
      const { estado } = await this.chamar<{ estado: string }>('GET', `/v1/execucoes/${encerrada.execucaoId}`)
      if (estado === 'concluida') break
      if (estado === 'falhou' || tentativa > 60) throw new Error(`a correção não concluiu: ${estado}`)
      await new Promise((resolver) => setTimeout(resolver, 500))
    }
    if (encerrada.execucaoId === null && encerrada.atividade.entrega === null) throw new Error('a correção não rodou: a função está suspensa?')
    const correcao = await this.chamar<{ entrega: { id: string }; destaques: { alunoId: string }[] }>('GET', `/v1/atividades-aplicadas/${atividadeAplicadaId}/correcao`)
    for (const destaque of correcao.destaques) await this.chamar('POST', `/v1/atividades-aplicadas/${atividadeAplicadaId}/correcao/destaques/${destaque.alunoId}/abrir`, {})
    await this.chamar('POST', `/v1/entregas/${correcao.entrega.id}/aprovar-lote`, {})
  }
}
