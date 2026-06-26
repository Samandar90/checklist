# ---- Build client (React/Vite) ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

# ---- Build server (Express/TypeScript) ----
FROM node:20-alpine AS server-build
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server ./
RUN npx prisma generate
RUN npm run build

# ---- Final runtime image ----
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm install --omit=dev

COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/prisma ./prisma
COPY --from=server-build /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=client-build /app/client/dist ./public

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
