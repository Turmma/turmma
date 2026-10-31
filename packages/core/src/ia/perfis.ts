import { PERFIS_DE_IA, type PerfilDeIa } from '@educa/shared'

/**
 * O perfil diz o tamanho do modelo que a tarefa precisa, e quem declara é a tarefa, nunca o adaptador (regra 30,
 * item 2). Qual modelo atende cada perfil é configuração (`LLM_MODELO_<PERFIL>`): trocar de provedor ou de modelo
 * não muda uma linha de domínio.
 *
 * A lista é a de `@educa/shared` (`PERFIS_DE_IA`), a mesma que o check de `consumo_ia` repete: uma fonte só.
 */
export const PERFIS = PERFIS_DE_IA
export type Perfil = PerfilDeIa
