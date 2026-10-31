import { PRAZOS_FIXOS } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { RETENCAO_JOB_REGISTRO_DIAS, RETENCAO_JOB_REGISTRO_FALHO_DIAS } from './expurgo-de-jobs.repository.js'

// A tela de Retenção da coordenação mostra `PRAZOS_FIXOS` à escola, que é a controladora e responde ao titular pelo que o
// sistema diz que guarda (regra 20, item 16). O prazo de `job_registro` mora em `RETENCAO_JOB_REGISTRO_*`, no nucleo, e o
// texto mora no shared, que não importa o nucleo: este teste é o único elo entre os dois.
describe('prazo declarado à escola para o registro das tarefas em segundo plano', () => {
  const { prazo } = PRAZOS_FIXOS.tarefa_em_segundo_plano

  it('diz os dias que o expurgo cumpre: o concluído e o que falhou', () => {
    expect(prazo).toMatch(new RegExp(`^${RETENCAO_JOB_REGISTRO_DIAS} dias; a que falhou, ${RETENCAO_JOB_REGISTRO_FALHO_DIAS} dias;`))
  })

  it('diz que o pedido de acesso ou de eliminação que falhou fica até a equipe resolver, sem prazo de dias', () => {
    expect(prazo).toMatch(/; a do pedido de acesso ou de eliminação que falhou, até a equipe Turmma resolver$/)
  })
})
