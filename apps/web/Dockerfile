FROM node:20-alpine AS base

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml /app/
COPY packages/shared/ /app/packages/shared/
COPY apps/web/ /app/apps/web/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @graphmind/web build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["pnpm", "--filter", "@graphmind/web", "start"]
