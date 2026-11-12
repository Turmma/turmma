import { validateEnvironment, type FileStorage } from '@educa/core'
import { S3FileStorage } from '@educa/core/s3-file-storage'
import { z } from 'zod'
import { loadFileStorageConfig } from '../privacidade/file-storage-config.js'

/**
 * O storage dos comandos que apagam objeto (`ops:descartar-job`, o PDF do material): as variáveis `STORAGE_*` da API; sem `STORAGE_URL`
 * (na máquina, com `.env.example`), o storage do compose local pela porta do host. O comando que abre o armazém o fecha em `encerrar`.
 */
export function abrirArmazemDeOperacao(ambiente: Record<string, string | undefined>): { armazem: FileStorage; encerrar: () => void } {
  const porta = validateEnvironment(z.object({ STORAGE_PORTA_HOST: z.coerce.number().int().positive().optional() }), ambiente).STORAGE_PORTA_HOST
  const comEndereco = ambiente['STORAGE_URL'] === undefined && porta !== undefined ? { ...ambiente, STORAGE_URL: `http://127.0.0.1:${String(porta)}` } : ambiente
  return S3FileStorage.criar(loadFileStorageConfig(comEndereco))
}
