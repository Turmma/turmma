import { esquemaRespostaAvisos, esquemaRespostaEstado } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { buscarDaApi } from './cliente'

export const consultaEstado = queryOptions({
  queryKey: ['sistema', 'estado'],
  queryFn: ({ signal }) => buscarDaApi('/v1/sistema/estado', esquemaRespostaEstado, signal),
})

export const consultaAvisos = queryOptions({
  queryKey: ['sistema', 'avisos'],
  queryFn: ({ signal }) => buscarDaApi('/v1/sistema/avisos', esquemaRespostaAvisos, signal),
})
