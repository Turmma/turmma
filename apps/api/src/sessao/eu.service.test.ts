import { CodigoDeErro } from '@educa/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../../tools/testes/metricas.ts'
import type { EuRepository } from './eu.repository.js'
import { EuService } from './eu.service.js'
import type { ResolucaoDeTenantRepository } from './resolucao-de-tenant.repository.js'

/**
 * Os dois ramos que o HTTP não alcança: a guarda acabou de ler o usuário ativo, então "sem linha" só acontece se ele sair
 * entre a guarda e o service. O banco real prova o resto (`apps/api/test/introducao.int.test.ts`).
 */
describe('EuService: a pessoa que sumiu entre a guarda e o service é NAO_AUTENTICADO', () => {
  const medidor = new MedidorDeTeste()
  const resolucao = {} as ResolucaoDeTenantRepository
  afterAll(() => medidor.encerrar())

  const sem = (campo: 'doContexto' | 'marcarIntroducaoVista'): EuRepository =>
    ({
      doContexto: async () =>
        campo === 'doContexto'
          ? undefined
          : { usuarioId: 'u', contaId: null, papel: 'aluno', nome: 'Pessoa', escola: { id: 'e', nome: 'Escola', slug: 'escola' }, inatividadeAlunoMin: 30, inatividadeEquipeMin: 120, introducaoVistaEm: null },
      // Com a leitura sem linha, a escrita ainda devolveria uma data: só a primeira guarda do POST segura o erro.
      marcarIntroducaoVista: async () => (campo === 'doContexto' ? new Date() : undefined),
    }) as unknown as EuRepository

  it('o GET sem a linha é NAO_AUTENTICADO', async () => {
    await expect(new EuService(sem('doContexto'), resolucao, medidor.medidor).obter()).rejects.toMatchObject({ codigo: CodigoDeErro.NAO_AUTENTICADO })
  })

  it('o POST sem a linha, na leitura ou na escrita, é NAO_AUTENTICADO', async () => {
    for (const campo of ['doContexto', 'marcarIntroducaoVista'] as const) {
      await expect(new EuService(sem(campo), resolucao, medidor.medidor).concluirIntroducao(), campo).rejects.toMatchObject({ codigo: CodigoDeErro.NAO_AUTENTICADO })
    }
  })
})
