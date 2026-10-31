import { CLASSIFICACAO_DAS_TABELAS, InvariantException } from '@educa/shared'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { selectColumns, LEITURAS_DO_ARQUIVO } from './leitura-do-titular.js'

const texto = (instrucao: ReturnType<typeof selectColumns>): string => new PgDialect().sqlToQuery(instrucao).sql

describe('colunasDoSelect: a lista de colunas que entra no SQL do arquivo', () => {
  it('põe cada coluna sob o alias da tabela, na ordem, sem aspas nem parâmetro', () => {
    expect(texto(selectColumns('id', 'criada_em'))).toBe('t.id, t.criada_em')
  })

  it.each(['id; drop table usuario', 'a b', 'Id', '1id', "id'", 'id--', ''])('recusa o nome fora do formato %j: nada que não seja nome de coluna chega ao SQL', (nome) => {
    expect(() => selectColumns('id', nome)).toThrow(new InvariantException('nome de coluna fora do formato'))
    // O motivo é texto fixo: o nome recusado não entra na mensagem.
    if (nome !== '') expect(() => selectColumns('id', nome)).not.toThrow(nome)
  })
})

describe('LEITURAS_DO_ARQUIVO: a forma das leituras', () => {
  const alvo = { escolaId: '11111111-1111-4111-8111-111111111111', titularId: '22222222-2222-4222-8222-222222222222' }

  it('toda consulta leva a escola do alvo e o titular como parâmetro, nunca no texto, e devolve a coluna `id` que junta as ligações', () => {
    const dialeto = new PgDialect()
    for (const [tabela, leitura] of Object.entries(LEITURAS_DO_ARQUIVO)) {
      for (const versao of ['completa', 'coordenacao'] as const) {
        const consultas = leitura.consultas({ ...alvo, versao })
        expect(consultas.length, tabela).toBeGreaterThan(0)
        for (const consulta of consultas) {
          const { sql: instrucao, params } = dialeto.sqlToQuery(consulta)
          expect(params, `${tabela} ${versao}`).toContain(alvo.escolaId)
          expect(params, `${tabela} ${versao}`).toContain(alvo.titularId)
          expect(instrucao, `${tabela} ${versao}`).not.toContain(alvo.escolaId)
          expect(instrucao, `${tabela} ${versao}`).not.toContain(alvo.titularId)
          expect(instrucao, `${tabela} ${versao}`).toMatch(/\bt\.id\b/)
        }
      }
    }
  })

  it('a versão da coordenação não lê a conversa do professor, a entrada das execuções, o texto do modelo nem a justificativa', () => {
    const dialeto = new PgDialect()
    const daCoordenacao = (tabela: string): string => (LEITURAS_DO_ARQUIVO[tabela]?.consultas({ ...alvo, versao: 'coordenacao' }) ?? []).map((consulta) => dialeto.sqlToQuery(consulta).sql).join('\n')
    expect(LEITURAS_DO_ARQUIVO['thread_agente']?.naVersao?.('coordenacao')).toBe(false)
    expect(LEITURAS_DO_ARQUIVO['mensagem_agente']?.naVersao?.('coordenacao')).toBe(false)
    expect(LEITURAS_DO_ARQUIVO['thread_agente']?.naVersao?.('completa')).toBe(true)
    expect(daCoordenacao('execucao_agente')).not.toMatch(/\bt\.entrada\b/)
    expect(daCoordenacao('consumo_ia')).not.toMatch(/\bt\.(entrada|saida)\b/)
    expect(daCoordenacao('entrega')).not.toMatch(/\bt\.justificativa\b/)
    const daCompleta = (tabela: string): string => (LEITURAS_DO_ARQUIVO[tabela]?.consultas({ ...alvo, versao: 'completa' }) ?? []).map((consulta) => dialeto.sqlToQuery(consulta).sql).join('\n')
    expect(daCompleta('execucao_agente')).toMatch(/\bt\.entrada\b/)
    expect(daCompleta('consumo_ia')).toMatch(/\bt\.entrada, t\.saida\b/)
    expect(daCompleta('entrega')).toMatch(/\bt\.justificativa\b/)
  })

  it('a correção do aluno só sai do banco com o lote aprovado: cada número e o diagnóstico passam pelo `case` da entrega', () => {
    const dialeto = new PgDialect()
    const [doAluno] = LEITURAS_DO_ARQUIVO['correcao']?.consultas({ ...alvo, versao: 'completa' }) ?? []
    const instrucao = dialeto.sqlToQuery(doAluno ?? ({} as never)).sql
    for (const coluna of ['acertos', 'total', 'em_branco', 'por_habilidade', 'destaques', 'corrigida_em']) {
      expect(instrucao, coluna).toMatch(new RegExp(`case when e\\.estado = 'aprovada' then t\\.${coluna} end as ${coluna}`))
    }
    expect(instrucao).toMatch(/join entrega e on e\.escola_id = t\.escola_id and e\.id = t\.entrega_id/)
  })

  it('o resumo do pedido de entrada na turma diz os dois caminhos, o nome da pessoa na lista e a decisão dela, e não que ela fez o pedido', () => {
    // A consulta do aluno liga o pedido pelo nome dele na lista, e o recusado antes naquele nome entra: pode ser de outra pessoa.
    // O texto é o da tela "Meus dados" (`reivindicacao_decidida`, em `apps/web`): a mesma pessoa lê os dois.
    const descricao = LEITURAS_DO_ARQUIVO['reivindicacao']?.descricao
    expect(descricao).toBe('Os pedidos de entrada na turma feitos com o seu nome ou decididos por você')
    expect(descricao).not.toMatch(/que você fez/)
  })

  it('cada coluna de ligação que a classificação dá à tabela é lida: a leitura não ignora uma das formas de a linha chegar ao titular', () => {
    const dialeto = new PgDialect()
    for (const [tabela, classificada] of Object.entries(CLASSIFICACAO_DAS_TABELAS)) {
      if (!classificada.arquivo.entra) continue
      const leitura = LEITURAS_DO_ARQUIVO[tabela]
      const texto = (leitura?.consultas({ ...alvo, versao: 'completa' }) ?? []).map((consulta) => dialeto.sqlToQuery(consulta).sql).join('\n')
      for (const coluna of classificada.arquivo.ligacao) {
        // A `conta` liga por `conta.id` (o `usuario.conta_id` da pessoa), e a `usuario`, por `usuario.id`: as duas pelo `t.id`.
        expect(texto, `${tabela}.${coluna}`).toMatch(new RegExp(`\\b[a-z]\\.${coluna}\\b`))
      }
    }
  })

  it('as respostas do aluno saem com a `sequencia` da escolha: a coluna está na lista que o arquivo descreve e no `select` que o lê (51.0, regra 20, item 19)', () => {
    const leitura = LEITURAS_DO_ARQUIVO.resposta_atividade
    expect(leitura?.colunas).toContain('sequencia')
    const instrucoes = (leitura?.consultas({ ...alvo, versao: 'completa' }) ?? []).map((consulta) => new PgDialect().sqlToQuery(consulta).sql)
    expect(instrucoes).toHaveLength(1)
    // O `select` lê exatamente as colunas que a lista declara, na mesma ordem: nenhuma a mais, nenhuma a menos.
    expect(instrucoes[0]).toMatch(/^select (.+) from resposta_atividade t /)
    expect((instrucoes[0]?.match(/^select (.+) from resposta_atividade t /)?.[1] ?? '').split(', ')).toEqual((leitura?.colunas ?? []).map((coluna) => `t.${coluna}`))
  })
})
