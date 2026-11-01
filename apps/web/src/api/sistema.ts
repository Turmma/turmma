import { avisosResponseSchema, systemStatusResponseSchema } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { apiGet } from './client'

export const estadoQueryOptions = queryOptions({
  queryKey: ['sistema', 'estado'],
  queryFn: ({ signal }) => apiGet('/v1/sistema/estado', systemStatusResponseSchema, signal),
})

export const avisosQueryOptions = queryOptions({
  queryKey: ['sistema', 'avisos'],
  queryFn: ({ signal }) => apiGet('/v1/sistema/avisos', avisosResponseSchema, signal),
})
