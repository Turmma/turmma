import { randomUUID } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../../../tools/ci/compose.ts'
import { mockAssistenteApi } from '../assistente.ts'
import { entrarPelaApi, irPelaNavegacao, SIGN_IN_TIMEOUT_MS } from '../casca.ts'
import { confirmarVinculosNoBanco, criarAlocacaoDoProfessor, criarEquipeComSenha } from '../seed.ts'
import type { Scenario } from './scenario.ts'

/**
 * "O que você já gerou": mora em Criados, o quarto lugar da navegação do professor (telas do professor, 5.0). Se o lugar mudar
 * de nome, só esta função muda, e os specs que a chamam continuam como estão.
 */
export async function abrirOQueFoiGerado(page: Page, hasTouch: boolean): Promise<void> {
  await irPelaNavegacao(page, 'Criados', hasTouch)
}

/**
 * Um documento gravado direto no banco, na turma e na disciplina de um vínculo, com a autoria de quem a tela dele diria.
 * É o que o teste de isolamento precisa: o documento de **outra** escola, que nenhuma tela dela cria (regra 10, item 5).
 */
export async function criarArtefatoDoVinculo(escolaId: string, vinculoId: string, autorId: string, titulo: string): Promise<{ artefatoId: string; turmaId: string }> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    const { rows: vinculos } = await banco.query<{ ano_letivo_id: string; turma_id: string; disciplina_id: string }>(
      'select ano_letivo_id, turma_id, disciplina_id from vinculo where id = $1 and escola_id = $2',
      [vinculoId, escolaId],
    )
    const vinculo = vinculos[0]
    if (vinculo === undefined) throw new Error('o vínculo do e2e não existe nesta escola')
    // Uma atividade que a API aceita ler: a lista confere o conteúdo contra o contrato antes de devolver o resumo.
    const conteudo = {
      tipo: 'atividade_objetiva',
      titulo,
      questoes: [
        {
          enunciado: 'Qual é a massa molar da água, H2O?',
          alternativas: ['16 g/mol', '18 g/mol', '20 g/mol', '34 g/mol'],
          gabarito: 1,
          habilidade: { codigo: 'QUI.EM.05', descricao: 'Calcular a massa molar de uma substância' },
          citacao: { materialId: randomUUID(), pagina: 2, trecho: 'Na água, dois hidrogênios e um oxigênio.' },
          explicacao: 'Dois hidrogênios e um oxigênio somam 18.',
        },
      ],
    }
    const { rows } = await banco.query<{ id: string }>(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, $6, $7) returning id`,
      [escolaId, vinculo.ano_letivo_id, vinculo.turma_id, vinculo.disciplina_id, titulo, JSON.stringify(conteudo), autorId],
    )
    const artefatoId = rows[0]?.id
    if (artefatoId === undefined) throw new Error('o seed do e2e não criou o documento')
    return { artefatoId, turmaId: vinculo.turma_id }
  } finally {
    await banco.end()
  }
}

/**
 * A professora de uma turma de Química, com a API do Assistente simulada, **entrando pela API e abrindo direto o endereço** (por
 * padrão, Criados): o login pela tela e o Início, que os casos de Criados não provam, ficam de fora. `antes` monta o que a
 * escola já tinha antes de ela abrir a tela, com a turma e a disciplina dela já conhecidas.
 */
export async function entrarEmCriados(page: Page, { endereco = '/professor/criados', antes }: { endereco?: string; antes?: (cena: Scenario) => void } = {}): Promise<Scenario> {
  const api = await mockAssistenteApi(page)
  const professora = await criarEquipeComSenha()
  const alocacao = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, ['Química'])
  await confirmarVinculosNoBanco(professora.escolaId, alocacao.vinculoIds)
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  const disciplinaId = await banco
    .query<{ disciplina_id: string }>('select disciplina_id from vinculo where id = $1 and escola_id = $2', [alocacao.vinculoIds[0], professora.escolaId])
    .then(({ rows }) => rows[0]?.disciplina_id ?? '')
    .finally(() => banco.end())
  const cena: Scenario = { api, professora, turmaId: alocacao.turmaId, turmaNome: alocacao.turmaNome, disciplinaId }
  antes?.(cena)
  await entrarPelaApi(page, professora, endereco)
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
  return cena
}
