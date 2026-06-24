# build- en runtime-stage delen exact dezelfde base (ABI/libc match voor better-sqlite3/sharp)
FROM node:22-bookworm-slim AS build
WORKDIR /app
# fallback-compile als een prebuilt niet matcht; sharp heeft libvips-dev nodig
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 libvips-dev \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# libvips runtime voor sharp
RUN apt-get update && apt-get install -y --no-install-recommends libvips42 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 28871
CMD ["node", "build"]
