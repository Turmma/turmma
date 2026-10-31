# Contexto de build: raiz do repositório. Um arquivo para todos os serviços: o compose escolhe o `target`
# (`api`, `despachante`, `realtime`, `worker` e `web`), e a imagem de cada um sai com o que tinha antes.

# --- Construção comum: dependências e os dois pacotes que todo serviço usa ---------------------------------------------
FROM node:22.23.2-alpine3.23 AS base
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/despachante/package.json apps/despachante/
COPY apps/realtime/package.json apps/realtime/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/core packages/core
RUN npm run build -w @educa/shared && npm run build -w @educa/core

FROM base AS construcao-api
COPY apps/api apps/api
RUN npm run build -w @educa/api

FROM base AS construcao-despachante
COPY apps/despachante apps/despachante
RUN npm run build -w @educa/despachante

FROM base AS construcao-realtime
COPY apps/realtime apps/realtime
RUN npm run build -w @educa/realtime

FROM base AS construcao-worker
COPY apps/worker apps/worker
RUN npm run build -w @educa/worker

# --- Produção: só as dependências do pacote do alvo, e o que a construção gerou -----------------------------------------
FROM node:22.23.2-alpine3.23 AS producao
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/despachante/package.json apps/despachante/
COPY apps/realtime/package.json apps/realtime/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/

FROM producao AS api
RUN npm ci --omit=dev --ignore-scripts --workspace @educa/api && npm cache clean --force
COPY --from=construcao-api /repo/packages/shared/dist packages/shared/dist
COPY --from=construcao-api /repo/packages/core/dist packages/core/dist
# As migrations, para o serviço `migrar` (mesma imagem, outro comando).
COPY packages/core/drizzle packages/core/drizzle
COPY --from=construcao-api /repo/apps/api/dist apps/api/dist
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM producao AS despachante
RUN npm ci --omit=dev --ignore-scripts --workspace @educa/despachante && npm cache clean --force
COPY --from=construcao-despachante /repo/packages/shared/dist packages/shared/dist
COPY --from=construcao-despachante /repo/packages/core/dist packages/core/dist
COPY --from=construcao-despachante /repo/apps/despachante/dist apps/despachante/dist
USER node
WORKDIR /repo/apps/despachante
CMD ["node", "dist/main.js"]

FROM producao AS realtime
RUN npm ci --omit=dev --ignore-scripts --workspace @educa/realtime && npm cache clean --force
COPY --from=construcao-realtime /repo/packages/shared/dist packages/shared/dist
COPY --from=construcao-realtime /repo/packages/core/dist packages/core/dist
COPY --from=construcao-realtime /repo/apps/realtime/dist apps/realtime/dist
USER node
WORKDIR /repo/apps/realtime
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM producao AS worker
RUN npm ci --omit=dev --ignore-scripts --workspace @educa/worker && npm cache clean --force
COPY --from=construcao-worker /repo/packages/shared/dist packages/shared/dist
COPY --from=construcao-worker /repo/packages/core/dist packages/core/dist
COPY --from=construcao-worker /repo/apps/worker/dist apps/worker/dist
USER node
WORKDIR /repo/apps/worker
CMD ["node", "dist/main.js"]

# --- Web: fumaça do F0, build e `vite preview` com proxy para a API. Não parte do `base`: não usa o `nucleo`. -----------
FROM node:22.23.2-alpine3.23 AS web
WORKDIR /repo
# Tudo como `node`: o preview do Vite grava arquivo temporário em node_modules ao ler a config.
RUN chown node:node /repo
USER node
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/shared/package.json packages/shared/
COPY --chown=node:node packages/core/package.json packages/core/
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node apps/despachante/package.json apps/despachante/
COPY --chown=node:node apps/realtime/package.json apps/realtime/
COPY --chown=node:node apps/web/package.json apps/web/
COPY --chown=node:node apps/worker/package.json apps/worker/
RUN npm ci --ignore-scripts && npm cache clean --force
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/shared packages/shared
COPY --chown=node:node apps/web apps/web
# A galeria das peças só entra no build com VITE_COM_GALERIA=1, que o compose passa (.env.example; outro valor em staging).
ARG VITE_COM_GALERIA=
RUN VITE_COM_GALERIA=$VITE_COM_GALERIA npm run build -w @educa/web
WORKDIR /repo/apps/web
EXPOSE 4173
CMD ["../../node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
