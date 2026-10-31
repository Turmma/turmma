// Fixture da regra do kit visual (eslint.config.mjs, D81, R56): o que mora em `components/ui/` não importa `api/`,
// `areas/` nem `sessao/`. Cada linha marcada é um import que liga o kit a quem fala com a API, a uma tela ou à sessão. O
// que não tem marca (um irmão, o `formatar`, um pacote) é o que o kit pode importar, e não pode ser acusado.

import { clienteDaApi } from '../../../api/cliente' /* reprova: no-restricted-imports */
import type { RespostaDaApi } from '../../../api/tipos' /* reprova: no-restricted-imports */
import { Turmas } from '../../../areas/professor/Turmas' /* reprova: no-restricted-imports */
import { useInatividade } from '../../../sessao/inatividade' /* reprova: no-restricted-imports */
export { ErroDaApi } from '../../../api/cliente' /* reprova: no-restricted-imports */
export * from '../../../areas/aluno/Atividades' /* reprova: no-restricted-imports */

export const carregar = () => import('../../../api/cliente') /* reprova: no-restricted-syntax */
export const tela = () => import('../../../areas/coordenacao/Material') /* reprova: no-restricted-syntax */
export const sessao = () => import('../../../sessao/inatividade') /* reprova: no-restricted-syntax */

import { formatar } from '../../formatar'
import { Botao } from './Botao'
import { Campo } from './campos/Campo'
import { useQuery } from '@tanstack/react-query'
export const peca = () => import('./sobrepostos/Dialogo')

export const usados = [clienteDaApi, Turmas, useInatividade, formatar, Botao, Campo, useQuery]
export type Resposta = RespostaDaApi
