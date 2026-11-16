import { ORCAMENTO_DE_IA, LLM_PROVIDER } from '../../../../apps/api/src/ia/ia.module.js'

export const providers = [{ provide: LLM_PROVIDER, useValue: { gerar: async () => ({}) } }, { provide: ORCAMENTO_DE_IA, useValue: {} }]
