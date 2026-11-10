import { verify } from '@node-rs/argon2'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { beforeAll, describe, expect, it } from 'vitest'
import { urlDoBancoDeTeste } from '../ci/compose.ts'
import { DOMINIO_DO_PROVEDOR_SINTETICO, escolaExiste, montarVitrine, type Vitrine } from './escola.ts'

// A vitrine só serve se os três logins abrem a escola montada: o que se prova aqui é que a senha entregue é a que o
// banco guarda, e que cada pessoa está presa à escola e à turma certas. O segundo fator fica de fora: ativá-lo pede a API
// de pé, e a integração só tem o banco.

async function consultar<T extends object>(instrucao: string, parametros: unknown[]): Promise<T[]> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return (await banco.query<T>(instrucao, parametros)).rows
  } finally {
    await banco.end()
  }
}

describe('a escola da vitrine', () => {
  let vitrine: Vitrine

  beforeAll(async () => {
    vitrine = await montarVitrine({ ativarMfa: false })
  })

  it('a coordenadora entra com a senha entregue, na escola montada', async () => {
    const linhas = await consultar<{ senhaHash: string; escolaId: string; papel: string }>(
      'select c.senha_hash as "senhaHash", u.escola_id as "escolaId", u.papel from conta c join usuario u on u.conta_id = c.id where c.email = $1',
      [vitrine.coordenacao.email],
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.escolaId).toBe(vitrine.escola.id)
    expect(linhas[0]?.papel).toBe('coordenador')
    expect(await verify(linhas[0]?.senhaHash ?? '', vitrine.coordenacao.senha)).toBe(true)
    expect(vitrine.coordenacao.segredo).toBeNull()
  })

  it('a professora, que a peça da governança cria sem senha, entra com a senha entregue e tem turma confirmada', async () => {
    const linhas = await consultar<{ senhaHash: string | null; turma: string; estado: string }>(
      `select c.senha_hash as "senhaHash", t.nome as turma, v.estado
         from conta c join usuario u on u.conta_id = c.id
         join vinculo v on v.usuario_id = u.id and v.escola_id = u.escola_id and v.papel = 'professor'
         join turma t on t.id = v.turma_id
        where c.email = $1 and u.escola_id = $2`,
      [vitrine.professora.email, vitrine.escola.id],
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.turma).toBe(vitrine.professora.turma)
    expect(linhas[0]?.estado).toBe('confirmado')
    expect(await verify(linhas[0]?.senhaHash ?? '', vitrine.professora.senha)).toBe(true)
  })

  it('o aluno entra pela matrícula e pela senha entregues, na turma da professora, e não tem conta nem e-mail', async () => {
    const linhas = await consultar<{ senhaHash: string; contaId: string | null; turma: string; estado: string }>(
      `select m.senha_hash as "senhaHash", u.conta_id as "contaId", t.nome as turma, v.estado
         from credencial_matricula m join usuario u on u.id = m.usuario_id
         join vinculo v on v.usuario_id = u.id and v.escola_id = u.escola_id and v.papel = 'aluno'
         join turma t on t.id = v.turma_id
        where m.escola_id = $1 and m.matricula = $2`,
      [vitrine.escola.id, vitrine.aluno.matricula],
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.turma).toBe(vitrine.aluno.turma)
    expect(linhas[0]?.turma).toBe(vitrine.professora.turma)
    expect(linhas[0]?.estado).toBe('confirmado')
    expect(linhas[0]?.contaId).toBeNull()
    expect(await verify(linhas[0]?.senhaHash ?? '', vitrine.aluno.senha)).toBe(true)
  })

  it('a senha de um papel não abre o outro', async () => {
    const linhas = await consultar<{ senhaHash: string }>('select senha_hash as "senhaHash" from conta where email = $1', [vitrine.professora.email])
    expect(await verify(linhas[0]?.senhaHash ?? '', vitrine.coordenacao.senha)).toBe(false)
  })

  it('só tem e-mail do domínio reservado, que não entrega mensagem a ninguém (regra 20, item 17)', async () => {
    const linhas = await consultar<{ email: string }>('select c.email from conta c join usuario u on u.conta_id = c.id where u.escola_id = $1', [vitrine.escola.id])
    expect(linhas.length).toBeGreaterThanOrEqual(4)
    expect(linhas.filter((linha) => !linha.email.endsWith('@educa.invalid'))).toEqual([])
  })

  it('a escola vazia tem as três pessoas com login e a turma, e nenhum dado de tela', async () => {
    const { vazia } = vitrine
    expect(vazia.escola.id).not.toBe(vitrine.escola.id)
    const professora = await consultar<{ senhaHash: string; turma: string; estado: string }>(
      `select c.senha_hash as "senhaHash", t.nome as turma, v.estado
         from conta c join usuario u on u.conta_id = c.id
         join vinculo v on v.usuario_id = u.id and v.escola_id = u.escola_id and v.papel = 'professor'
         join turma t on t.id = v.turma_id
        where c.email = $1 and u.escola_id = $2`,
      [vazia.professora.email, vazia.escola.id],
    )
    expect(professora).toHaveLength(1)
    expect(professora[0]?.turma).toBe(vazia.professora.turma)
    expect(professora[0]?.estado).toBe('confirmado')
    expect(await verify(professora[0]?.senhaHash ?? '', vazia.professora.senha)).toBe(true)

    const aluno = await consultar<{ senhaHash: string; turma: string }>(
      `select m.senha_hash as "senhaHash", t.nome as turma
         from credencial_matricula m join vinculo v on v.usuario_id = m.usuario_id and v.escola_id = m.escola_id and v.papel = 'aluno' and v.estado = 'confirmado'
         join turma t on t.id = v.turma_id
        where m.escola_id = $1 and m.matricula = $2`,
      [vazia.escola.id, vazia.aluno.matricula],
    )
    expect(aluno).toHaveLength(1)
    expect(aluno[0]?.turma).toBe(vazia.professora.turma)
    expect(await verify(aluno[0]?.senhaHash ?? '', vazia.aluno.senha)).toBe(true)

    // É o que a faz vazia: nada do que as telas listam. A cheia, montada pela mesma chamada, tem.
    for (const tabela of ['artefato', 'entrega', 'atividade_aplicada', 'lista_nome', 'consumo_ia']) {
      const naVazia = await consultar<{ total: number }>(`select count(*)::int as total from ${tabela} where escola_id = $1`, [vazia.escola.id])
      const naCheia = await consultar<{ total: number }>(`select count(*)::int as total from ${tabela} where escola_id = $1`, [vitrine.escola.id])
      expect(naVazia[0]?.total, tabela).toBe(0)
      expect(naCheia[0]?.total, tabela).toBeGreaterThan(0)
    }
  })

  it('as duas escolas liberam o Google para o domínio do provedor sintético, e nenhuma conta de pessoa fica ligada a ele', async () => {
    for (const acessos of [vitrine, vitrine.vazia]) {
      const liberados = await consultar<{ provedor: string; valor: string }>('select provedor, valor from provedor_escola where escola_id = $1 and removido_em is null', [acessos.escola.id])
      expect(liberados).toEqual([{ provedor: 'google', valor: DOMINIO_DO_PROVEDOR_SINTETICO }])
      expect(acessos.provedor.dominio).toBe(DOMINIO_DO_PROVEDOR_SINTETICO)
      // O provedor liberado é dado da escola: a vitrine não liga conta de ninguém, e o que o provedor devolve sobre a pessoa não tem onde ficar (regra 20, item 2).
      const ligadas = await consultar<{ total: number }>('select count(*)::int as total from conta_externa where escola_id = $1', [acessos.escola.id])
      expect(ligadas[0]?.total).toBe(0)
    }
  })

  it('a escola cheia tem o acesso da sala vigente, na turma do aluno, com nome livre; a vazia não tem sala', async () => {
    const { sala } = vitrine
    expect(sala).toBeDefined()
    expect(sala?.turma).toBe(vitrine.aluno.turma)
    expect(sala?.token.length).toBeGreaterThan(20)
    expect(sala?.codigo).toMatch(/^\S{4,}$/)
    const vigentes = await consultar<{ turma: string; livres: number }>(
      `select t.nome as turma,
              (select count(*)::int from lista_nome n where n.escola_id = a.escola_id and n.turma_id = a.turma_id and n.estado = 'livre') as livres
         from acesso_turma a join turma t on t.id = a.turma_id and t.escola_id = a.escola_id
        where a.escola_id = $1 and a.revogado_em is null and a.expira_em > now()`,
      [vitrine.escola.id],
    )
    expect(vigentes).toHaveLength(1)
    expect(vigentes[0]?.turma).toBe(vitrine.aluno.turma)
    expect(vigentes[0]?.livres).toBeGreaterThan(0)
    // A escola vazia não tem nome livre: a sala não teria o que mostrar, e o botão da conta só aparece onde há nome.
    expect(vitrine.vazia.sala).toBeUndefined()
    const naVazia = await consultar<{ total: number }>('select count(*)::int as total from acesso_turma where escola_id = $1', [vitrine.vazia.escola.id])
    expect(naVazia[0]?.total).toBe(0)
  })

  it('sabe dizer quando a escola do arquivo já não existe no banco, que o portão recria', async () => {
    expect(await escolaExiste(vitrine.escola.id)).toBe(true)
    expect(await escolaExiste(randomUUID())).toBe(false)
  })
})
