import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig } from 'vite'
import { nomeDoChunk } from './chunk-names'
import { pluginRebaixarCor } from './downlevel-color'

// Dentro do compose a API fica atrás da borda, `http://borda:8080`. A web chama caminho relativo e o proxy
// encaminha, então o navegador nunca precisa conhecer o endereço da API nem de CORS.
const destinoApi = process.env['API_URL_INTERNA'] ?? 'http://127.0.0.1:3000'
const proxy = { '/v1': { target: destinoApi, changeOrigin: false } }

/**
 * Navegador mais antigo para o qual o JS e o CSS são gerados. O padrão do Vite 8 é Chrome 111; aqui desce até
 * onde o CSS em camadas (`@layer`) existe, para caber o Chrome 109, último do Windows 7 e 8.1 de laboratório,
 * e o Chromebook que parou de receber atualização (D43, regra 50, item 1).
 */
const NAVEGADORES_MINIMOS = ['chrome99', 'edge99', 'firefox97', 'safari15.4']

export default defineConfig({
  plugins: [react(), tailwindcss(), pluginRebaixarCor()],
  resolve: { conditions: ['source', ...defaultClientConditions] },
  build: {
    target: NAVEGADORES_MINIMOS,
    // A entrada fica `index-*.js`; o chunk da área do operador, `operacao-*.js`; o resto, `parte-*.js` (Tech Spec da
    // A0, seção 9, "Orçamento"). O porquê de ser pelo nome, e não por `manualChunks`, está em `chunk-names.ts`.
    rolldownOptions: { output: { chunkFileNames: nomeDoChunk } },
  },
  server: { proxy },
  preview: { proxy },
})
