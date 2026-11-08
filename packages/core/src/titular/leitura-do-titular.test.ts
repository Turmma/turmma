import { CLASSIFICACAO_DAS_TABELAS, COLUNAS_FORA_DO_ARQUIVO, InvariantException, PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA } from '@educa/shared'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { ACOES_DO_ARQUIVO_POR_ALVO, PAPEL_NO_ARQUIVO_DA_GERACAO } from '../auditoria/acoes-por-alvo.js'
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

  it('a aula da grade (`alocacao`) entra no arquivo do professor pelo vínculo dele, e tem a leitura que a lê (F2, 11.0)', () => {
    expect(CLASSIFICACAO_DAS_TABELAS.alocacao?.arquivo).toEqual({ entra: true, ligacao: ['vinculo_id'] })
    expect(LEITURAS_DO_ARQUIVO.alocacao?.consultas({ ...alvo, versao: 'completa' }).length).toBeGreaterThan(0)
  })

  it('o registro da aula (`aula`, F2b) só entra na versão completa: a da coordenação não o lê nem o descreve (R6, critério 5)', () => {
    const leitura = LEITURAS_DO_ARQUIVO.aula
    expect(leitura?.naVersao?.('completa')).toBe(true)
    expect(leitura?.naVersao?.('coordenacao')).toBe(false)
    // A tabela é classificada, entra no arquivo pelo vínculo do professor e tem prazo fixo: a virada do ano.
    expect(CLASSIFICACAO_DAS_TABELAS.aula).toMatchObject({ classe: 'prazo_fixo', prazo: 'registro_da_aula', arquivo: { entra: true, ligacao: ['vinculo_id'] } })
    // O texto é lido; a ligação pelo vínculo de professor do titular e o escopo de escola estão provados pelo resultado, no teste de integração.
    const instrucao = new PgDialect().sqlToQuery((leitura?.consultas({ ...alvo, versao: 'completa' }) ?? [])[0] ?? ({} as never)).sql
    expect(instrucao).toMatch(/\bt\.conteudo\b/)
    expect(instrucao).toMatch(/from aula t\b/)
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
  describe('a leitura por alvo da auditoria (D85, acesso-e-convites 11.0)', () => {
    const AS_SEIS = ['aluno.transferido', 'lista.transferida', 'usuario.nome_corrigido', 'lista.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada']
    const dialeto = new PgDialect()
    const [, ...porAlvo] = (LEITURAS_DO_ARQUIVO['auditoria']?.consultas({ ...alvo, versao: 'completa' }) ?? []).map((consulta) => dialeto.sqlToQuery(consulta).sql)

    it('são duas leituras por alvo, além da dos atos do titular, e juntas citam exatamente as seis ações da lista fechada', () => {
      expect(porAlvo).toHaveLength(2)
      const citadas = porAlvo.flatMap((instrucao) => [...(instrucao.match(/\bt\.acao in \(([^)]+)\)/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(([, acao]) => acao))
      expect([...citadas].sort()).toEqual([...AS_SEIS].sort())
    })

    it('a lista fechada é a da D85, escrita uma vez no código: a constante que o índice e as leituras usam tem as seis ações, e só como literal de SQL', () => {
      expect([...ACOES_DO_ARQUIVO_POR_ALVO].sort()).toEqual([...AS_SEIS].sort())
      // Os valores vão ao SQL entre aspas: nada de aspas, espaço ou ponto e vírgula entre eles.
      for (const acao of ACOES_DO_ARQUIVO_POR_ALVO) expect(acao).toMatch(/^[a-z_]+\.[a-z_]+$/)
    })

    /** Os nomes de saída da lista do `select`: o da coluna, ou o que vem depois do `as` (o papel calculado). */
    const nomesDeSaida = (lista: string): string[] => lista.split(',').map((trecho) => trecho.trim().replace(/^t\./, '').replace(/^[\s\S]* as /, ''))
    const listaDoSelect = (instrucao: string): string => instrucao.match(/^select (.+?) from auditoria t\b/s)?.[1] ?? ''

    it('nenhuma coluna de COLUNAS_FORA_DO_ARQUIVO nem do `fora` da auditoria sai no `select`: o autor, o `antes` e o `depois` ficam no banco, e só o `papel` é lido do `depois`', () => {
      const leitura = LEITURAS_DO_ARQUIVO['auditoria']
      const daAuditoria = COLUNAS_FORA_DO_ARQUIVO.filter((coluna) => coluna.startsWith('auditoria.')).map((coluna) => coluna.replace('auditoria.', ''))
      const proibidas = [...Object.keys(leitura?.fora ?? {}), ...daAuditoria]
      for (const instrucao of porAlvo) {
        const lista = listaDoSelect(instrucao)
        // O que a leitura entrega, pelo nome de saída: as colunas da lista permitida da auditoria mais o `papel` calculado, e nada mais.
        expect(nomesDeSaida(lista), instrucao).toEqual([...(leitura?.colunas ?? []), ...(leitura?.derivadas ?? [])])
        // O `depois` só aparece como a origem do papel da geração da provisória: tirada essa leitura, nenhuma coluna proibida resta na lista.
        const semOPapel = lista.replace(/t\.depois->>'papel'/g, '')
        for (const coluna of proibidas) expect(semOPapel, coluna).not.toMatch(new RegExp(`\\bt\\.${coluna}\\b`))
      }
    })

    it('o papel é fixo nas ações da lista e da planilha, vem do `depois` só na geração e é o aluno na troca', () => {
      const [dosUsuarios = '', dasListas = ''] = porAlvo
      expect(dasListas).toMatch(/'coordenação' as papel/)
      expect(dosUsuarios).toMatch(/when 'senha_provisoria\.gerada' then case t\.depois->>'papel' when 'coordenador' then 'coordenação' when 'professor' then 'professor' end/)
      expect(dosUsuarios).toMatch(/when 'senha_provisoria\.usada' then 'aluno'/)
      expect(dosUsuarios).toMatch(/else 'coordenação'/)
    })

    it('o papel de quem gerou a provisória tem uma entrada por papel que gera, e cada uma vai ao `case` do SQL', () => {
      // O `Record` do tipo já recusa papel sem entrada; este caso prende o mesmo à lista em execução e ao texto do SQL (papel novo não vira `null` no arquivo).
      expect(Object.keys(PAPEL_NO_ARQUIVO_DA_GERACAO).sort()).toEqual([...PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA].sort())
      const [dosUsuarios = ''] = porAlvo
      for (const papel of PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA) expect(dosUsuarios, papel).toContain(`when '${papel}' then '${PAPEL_NO_ARQUIVO_DA_GERACAO[papel]}'`)
    })
  })
})
