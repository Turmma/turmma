import { Test } from '@nestjs/testing'
import { LLM_PROVIDER } from '../../../../apps/api/src/ia/ia.module.js'

export const montar = () => Test.createTestingModule({}).overrideProvider(LLM_PROVIDER).useValue({ gerar: async () => ({}) })
