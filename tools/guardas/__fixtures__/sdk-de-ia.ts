// Violações de propósito fora de packages/core/src/ia/*-adapter.ts. Toda linha marcada com "reprova:"
// precisa sair com a regra citada; linha sem marca não pode sair com nenhuma guarda.
import OpenAI from 'openai' // reprova: @typescript-eslint/no-restricted-imports
import { OpenAI as ClienteDeModelo } from 'openai' // reprova: @typescript-eslint/no-restricted-imports
import { zodResponseFormat } from 'openai/helpers/zod' // reprova: @typescript-eslint/no-restricted-imports
import type { MessageParam } from '@anthropic-ai/sdk/resources' // reprova: @typescript-eslint/no-restricted-imports
import { GoogleGenAI } from '@google/genai' // reprova: @typescript-eslint/no-restricted-imports
import { GoogleGenerativeAI } from '@google/generative-ai' // reprova: @typescript-eslint/no-restricted-imports
import { VertexAI } from '@google-cloud/vertexai' // reprova: @typescript-eslint/no-restricted-imports
import { Mistral } from '@mistralai/mistralai' // reprova: @typescript-eslint/no-restricted-imports
import { createOpenAI } from '@ai-sdk/openai' // reprova: @typescript-eslint/no-restricted-imports
import { generateText } from 'ai' // reprova: @typescript-eslint/no-restricted-imports
import { ChatOpenAI } from '@langchain/openai' // reprova: @typescript-eslint/no-restricted-imports
import cliente = require('ollama') // reprova: @typescript-eslint/no-restricted-imports
import { createRequire } from 'node:module'
export { Ollama } from 'ollama' // reprova: @typescript-eslint/no-restricted-imports
export * from '@google/genai' // reprova: @typescript-eslint/no-restricted-imports
import { algo } from 'openai-compat-sintetico'
import { porta } from '../ia/openai'

const dinamico = await import('ollama') // reprova: guardas/sdk-de-ia-so-no-adaptador
const antigo = require('@anthropic-ai/sdk') // reprova: guardas/sdk-de-ia-so-no-adaptador
const comCreateRequire = createRequire(import.meta.url)('openai') // reprova: guardas/sdk-de-ia-so-no-adaptador
type Cliente = typeof import('openai') // reprova: guardas/sdk-de-ia-so-no-adaptador

export { OpenAI, ClienteDeModelo, zodResponseFormat, GoogleGenAI, GoogleGenerativeAI, VertexAI, Mistral, createOpenAI, generateText, ChatOpenAI }
export { cliente, algo, porta, dinamico, antigo, comCreateRequire }
export type { MessageParam, Cliente }
